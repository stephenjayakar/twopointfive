// Box scene representation, GPU packing and the 2D (XZ) uniform grid used by all ray queries.
import { Vec3, Quat, v3, quat } from '../math/vec';
import { WORLD } from './world';
import { makeBuffer } from '../gpu/device';
import { MarkingDef, MARKING_TEXEL, MAX_MARKS_PER_BOX, MARK_TABLE_ROWS, MARK_SLOT_SHIFT, MARK_SLOT_MAX, markStats, markRecordRows, packMarking, secondaryAlbedo, AREA_LIT_MARKS } from './markings';

export const BoxFlag = {
  NoPrimary: 1,      // not rasterized into the G-buffer (ceilings, light-only geometry)
  NoShadow: 2,       // ignored by all rays (decals, glow cards)
  Cutaway: 4,        // rasterized only below mat.cutHeight (the viewer stage drops its back wall to a lip when the orbit camera goes behind it); rays see the full box
  Dynamic: 8,        // rebuilt every frame (character proxies, props on bones)
  Emissive: 16,      // has non-zero emission (lets shaders early-out)
  AreaLit: 32,       // its emission is represented by an analytic area light: rays ignore the emissive term (no double count, no small-emitter aliasing in the cascades)
  Rot: 64,           // carries a full 3D rotation (Box.rot; set automatically on upload): raster AND rays use the quaternion in boxMat instead of the packed yaw
  Gloss: 128,        // polished floor finish (lobby stone, the lino): under FrameFlags.Gloss the final gather traces one Fresnel-weighted reflection ray for on-screen pixels of its top face (fgather.wgsl glossReflection) — the last free bit of the GPU flag byte
  SoundSeal: 1 << 16,   // CPU-only (bits 8-15 of the GPU word are the owner byte, so CPU flags start at 1<<16): a dynamic occluder that currently seals sound (a door leaf near closed)
  // GLASS (experiment E3). The GPU flag word is a u32 whose low byte holds the flags above and whose second byte is the owner; bits 16-31 were simply never sent
  // (upload masked Box.flags to 0xff because the only higher bit, SoundSeal, is CPU-only). Rather than repurpose Cutaway (the viewer's stage wall needs it) the
  // word is WIDENED: Glass keeps the same bit on both sides (1<<17 here = BOX_GLASS 131072u in common.wgsl) and upload() passes exactly that bit through.
  // A glass box is authored geometry (levels/*.json flag name 'Glass', albedo = the pane's transmission tint) that no traced ray and no raster triangle ever
  // sees: upload() keeps it out of the trace grid AND the visible list and instead lists it in SceneInfo.glass (≤ MAX_GLASS panes, 3 vec4f each), where
  // composite / fgather / direct test view and shadow segments against it analytically (Fresnel reflection + tint + dust glow; common.wgsl glassTrace).
  // CPU: movement collision and sound treat it as a wall, sight passes through it (collision.ts segmentBlocked's `through`), a round / kick / bang breaks it.
  Glass: 1 << 17,
} as const;
/** the most panes SceneInfo.glass carries to the GPU (nearest to the camera's look-at first when a level has more) */
export const MAX_GLASS = 32;

export interface Box {
  c: Vec3;            // center
  h: Vec3;            // half extents (local axes)
  yaw: number;        // rotation about +Y (radians)
  albedo: Vec3;       // linear diffuse reflectance
  emissive: Vec3;     // emitted radiance (linear, HDR)
  flags: number;
  owner: number;      // 0 = world, 1..255 = character id (rays from a character skip its own proxies)
  cutHeight: number;  // world Y above which the box is hidden from primary visibility when Cutaway
  /** optional full 3D orientation (unit quaternion, world) for the few things that tilt: hand props, goggles, spark streaks, tumbling
   *  canisters. Raster and rays both honour it (BoxFlag.Rot is set on upload; the grid footprint and CPU picking use it too); `yaw`
   *  should still hold the heading for CPU code that only cares about that. Absent = yaw about +Y as always. */
  rot?: Quat;
  name?: string;      // optional tag (light fixtures etc.)
  /** The surface FINISH (renderer v3 phase 4 — the one BRDF: base colour = albedo, GGX roughness 0‥1, metalness): absent rough = ROUGH_DEFAULT, matte — no reflection ray is
   *  ever spent on the box — and `metal` = a bare conductor (F0 = its albedo, most of its diffuse gone) rather than a dielectric coat (F0 0.04 over the paint). Authored per
   *  material / per box in the level file (levelData.ts MaterialData.rough / metal, BoxData.rough / metal); the three below reach the GPU as ONE float in boxMat row 1's w
   *  (matWord, decoded by common.wgsl boxFinish) — the g-buffer writes roughness / metalness per pixel from it (+ the detail layer), reflect.wgsl reads the anisotropy. */
  rough?: number; metal?: boolean;
  /** anisotropic finish — the lobe stretched along the view direction so a lamp mirrors as a long streak, not a disc: the wet lot's standing water
   *  (game/weather.ts sets it with the rain; runtime only, never authored) */
  aniso?: boolean;
  /** MARKINGS (scene/markings.ts): up to MAX_MARKS_PER_BOX pixel-art signifiers ON this box's faces — key caps, packing tape, drawer seams, the vending
   *  window, text bars, LEDs, glyphs — authored in the level file (BoxData.markings / a prop part's) or by the code that makes the box (door leaves). The
   *  upload registers the list in the marking table (the tail of matBuf) and names its first record in the top 14 bits of the GPU flags word; the g-buffer,
   *  composite and the reflection pass evaluate them; the secondary rays get their area average folded into `boxAlbedoSec` (the 4th mat row). */
  marks?: MarkingDef[];
  /** × the emission of this box's emissive markings (runtime: game/lighting.ts writes a switchable's supply factor here — a blackout, the OCP, a flicker —
   *  next to the box's own emissive; absent = 1) */
  markGain?: number;
  /** MOTION IDENTITY (renderer v3, image-quality program E1): a key that names THIS part of THIS object across frames — a door's leaf, a chair's seat, a flying
   *  can's band, the torch in a man's hand (MKEY ranges below; the code that emits the box sets it). With it the g-buffer's motion vector for the box comes from
   *  the transform the SAME part had a frame ago wherever it sat in the dynamic list; without it (sparks, tracers, one-frame effects) the old rule stands: the
   *  box at the same INDEX a frame ago, accepted only if its half-extents and owner match. Statics never need one. */
  mkey?: number;
}
/** MKEY ranges (Box.mkey): the system in the top byte, its own numbering below — doors (index × 4 + part), props (id × 16 + part), items (serial × 8 + part), the
 *  rig props on a character (owner << 8 | ordinal this frame; the owner-0 lasers stay unkeyed), devices (ordinal over the frame's device boxes), staging / QA boxes
 *  (`test`; `ring` reserved — the launcher's rings stay on the index rule). Two boxes with one key in a frame = the last registered wins; the index space needs
 *  maxBoxes ≤ 65534 (the visible word keeps 1 + index in 16 bits, 0xFFFF = new). */
export const MKEY = { door: 1 << 24, prop: 2 << 24, item: 3 << 24, rig: 4 << 24, device: 5 << 24, ring: 6 << 24, test: 7 << 24, debris: 8 << 24 } as const;   // debris: the destruction lane's rigid chunks (game/debris.ts), keyed off their serial

export function makeBox(p: Partial<Box> & { c: Vec3; h: Vec3 }): Box {
  return { yaw: 0, albedo: [0.5, 0.5, 0.5], emissive: [0, 0, 0], flags: 0, owner: 0, cutHeight: 1e6, ...p };
}

/** roughness a box without a finish is taken to have: fully matte — over every preset's rtMaxRough, so the reflection pass skips it outright */
export const ROUGH_DEFAULT = 1.0;
/** The finish as the one f32 the GPU gets (boxMat[3i+1].w): roughness clamped to 0‥1, + 2 if metal, + 4 if anisotropic — three plain floats' worth in
 *  disjoint ranges, so common.wgsl boxFinish() peels them off with two compares (no bit tricks on a float the driver may renormalise). */
export function matWord(b: Box): number {
  const r = b.rough ?? ROUGH_DEFAULT;
  return (r < 0 ? 0 : r > 1 ? 1 : r) + (b.metal ? 2 : 0) + (b.aniso ? 4 : 0);
}

export const GEO_STRIDE = 8; // words (32 B): cx cy cz rot | hx hy hz flags
/** GLASS BREAKING (game/glassbreak.ts): a per-pane cell table in the tail of matBuf AFTER the marking table — GB_STRIDE vec4 rows per SceneInfo.glass slot (header:
 *  impact count, dropped-cell mask, u axis, damage; hu hv type; 16 impact points 2 per row; 16 impact energies 4 per row), read by common.wgsl glassCellOpen and
 *  composite's crack network only under the prelude const GLASS_BREAK (render/frame.ts glassBreakConfig; common.wgsl GB_BASE = MARK_BASE + MARK_TABLE_ROWS). The
 *  rows exist (zero) whatever the switch: a bigger buffer is not a different frame. */
export const GB_STRIDE = 14, GB_ROWS = MAX_GLASS * GB_STRIDE;
export const MAT_STRIDE = 16; // words (64 B): albedo.rgb cutHeight | emissive.rgb finish (matWord: roughness + metal + aniso — was the owner, which no shader read from here: boxOwner() takes it from the geo flags) | rotation quaternion xyzw (= yaw for ordinary boxes, the full 3D rotation for boxes with Box.rot; raster and rays both use it) | SECONDARY albedo.rgb (= albedo unless markings are folded in — common.wgsl boxAlbedoSec: what gather / cascade / probe hits read) + markGain (× the emission of the box's emissive markings)

// f32 -> f16 bits (round-to-nearest), for pack2x16float on the CPU.
const f16Scratch = new Float32Array(1); const u32Scratch = new Uint32Array(f16Scratch.buffer);
function f16bits(v: number): number {
  f16Scratch[0] = v; const x = u32Scratch[0];
  const sign = (x >>> 16) & 0x8000; let exp = ((x >>> 23) & 0xff) - 127 + 15; let mant = x & 0x7fffff;
  if (exp <= 0) { if (exp < -10) return sign; mant |= 0x800000; const shift = 14 - exp; let r = mant >>> shift; if ((mant >>> (shift - 1)) & 1) r++; return sign | r; }
  if (exp >= 31) return sign | 0x7c00;
  let r = sign | (exp << 10) | (mant >>> 13); if (mant & 0x1000) r++; return r;
}
export const pack2x16f = (a: number, b: number) => (f16bits(a) | (f16bits(b) << 16)) >>> 0;
/** the value an f16 bit pattern denotes (what unpack2x16float hands the shader) */
function f16value(bits: number): number {
  const s = bits & 0x8000 ? -1 : 1, e = (bits >> 10) & 31, m = bits & 1023;
  return e === 0 ? s * m * 2 ** -24 : e === 31 ? (m ? NaN : s * Infinity) : s * (1 + m / 1024) * 2 ** (e - 15);
}

export class BoxWorld {
  statics: Box[] = [];
  dynamics: Box[] = [];
  /** MOTION IDENTITY (Box.mkey): on = a keyed dynamic box hands the g-buffer the index its key had LAST frame in the top 16 bits of its `visible` word (upload();
   *  gbuffer.wgsl vsBox reads its previous transform there); off = every word is the bare index and the vertex stage index-matches as it always did — mirrored from
   *  engine.settings.motionIds each frame. `mkeyPrev` = key → index in last frame's combined list. */
  motionIds = true;
  private mkeyPrev = new Map<number, number>(); private mkeyCur = new Map<number, number>();
  /** how the last upload's dynamics were matched: keyed and found / keyed but new / unkeyed (index rule) */
  mkeyStats = { matched: 0, fresh: 0, unkeyed: 0 };
  /** Combined list uploaded this frame (statics first, then dynamics). */
  all: Box[] = [];
  maxBoxes: number;
  geoData: ArrayBuffer; geoF32: Float32Array; geoU32: Uint32Array;
  matData: Float32Array;
  geoBuf: GPUBuffer; matBuf: GPUBuffer;
  // grid — cellStart holds two regions in ONE buffer: [0, W*H] the plain per-cell start offsets into `items` (what the flag-off tracer and the
  // smoke obstacle bake read, unchanged), then from GRID_CB = W*H+1 two words per cell for the fast traversal (common.wgsl): heightMask24 | cheby<<24
  // and start24 | min(count,255)<<24. `items` likewise: [0, itemCount) plain box indices, [itemCount, 2*itemCount) index | qmin<<16 | qmax<<24.
  cellStart: Uint32Array; // (gridW*gridH + 1) + 2*gridW*gridH
  items: Uint32Array; itemCount = 0;
  cellBuf: GPUBuffer; itemBuf: GPUBuffer;
  globals: number[] = []; // indices of huge boxes tested once per ray
  /** occupancy of the last grid build: empty cells, mean look-ahead (Chebyshev distance to the nearest occupied cell) over the empty ones, busiest cell,
   *  and the registration slack handed to the tracer (metres a traced box may reach past the cells it is registered in; see buildGrid) */
  gridStats = { cells: WORLD.gridW * WORLD.gridH, empty: 0, meanSkip: 0, maxPerCell: 0, slack: 0 };
  private gridRanges = new Int32Array(0);                                   // per box this build: x0, x1, z0, z1 (cells; x0 < 0 = not in the grid), qmin, qmax (quantised padded height extent)
  private gridFill = new Uint32Array(WORLD.gridW * WORLD.gridH);            // running offsets while scattering items
  private gridMask = new Uint32Array(WORLD.gridW * WORLD.gridH);            // per cell: 24-slice height occupancy
  private gridDist = new Uint8Array(WORLD.gridW * WORLD.gridH);             // per cell: Chebyshev distance to the nearest occupied cell (0 = occupied), clamped to 255
  infoBuf: GPUBuffer; infoData = new Uint32Array(4 + 16 + 4 + 32 + 32 + 4 + 128 + 4 + MAX_GLASS * 12); infoF32 = new Float32Array(this.infoData.buffer);   // struct SceneInfo in common.wgsl: header, 16 global indices, capsule header, 8 character bounds, 16 global (ymin, ymax) pairs, grid vec4 (x = registration slack), 16 global bounds (min.xyz _, max.xyz _), glassInfo vec4u (x = pane count), MAX_GLASS panes × 3 vec4f
  /** GLASS (experiment): false = every Glass box is skipped outright — no pane list, and (as always) no grid entry / no raster: an empty opening, the level as it
   *  was before panes were authored. Mirrored from engine.settings.glass each frame. */
  glassEnabled = true;
  /** where the camera looks (XZ used): panes are listed nearest-first from here and the list is cut at MAX_GLASS */
  glassFocus: Vec3 = [20, 0, 14];
  /** the panes uploaded this frame, in SceneInfo order (indices into `all` = statics): for the panel, the probes and the CPU shatter code's bookkeeping */
  glassList: number[] = [];
  /** static box indices carrying BoxFlag.Glass (intact or broken), rebuilt when statics change — the game's shatter / restore / 'break all' walk this */
  glassStatics: number[] = [];
  private glassScratch: { i: number; d: number }[] = []; private glassStaticsN = -1;
  /** GLASS BREAKING (game/glassbreak.ts): fills slot k's GB_STRIDE rows for static `staticIndex` into `dst` at float offset `off` (returns false = the pane is whole: zeros);
   *  null = no such system attached. Consulted by packGlass every frame in SceneInfo order; the table is uploaded only while any pane has something to say (and once more
   *  when the last goes whole so the rows read zero again). */
  glassCellFill: ((staticIndex: number, dst: Float32Array, off: number) => boolean) | null = null;
  private gbData = new Float32Array(GB_ROWS * 4); private gbLive = false;
  /** How far (m) each global's uploaded bounds (SceneInfo.globalsB, the FLAG_GRID_SLABS reject) stand outside the box the GPU traces, on top of the
   *  registration slack: ~100× every float difference between this f64 build and the tracer's f32 slab test (argument above traceClosest in
   *  common.wgsl), and still under the 1–2 cm every ray origin is lifted off its surface — which is what lets a ray leaving the floor skip the floor. */
  static readonly GLOBAL_PAD = 0.005;
  /** …and the same 5 mm is all FLAG_GRID_SLABS keeps of WORLD.gridYPad when it judges a cell's height span: the packed items carry the full 4 cm against
   *  float differences that total < 0.4 mm (tallied in the same place), so the shader hands gridYPad − ITEM_PAD_KEEP of it back at lookup time
   *  (SceneInfo.grid.y) without the packed data changing — enough that a ray lifted 1–2 cm off a desk, a floor finish or a wall top stops re-testing the
   *  very surface it left in its first cell. */
  static readonly ITEM_PAD_KEEP = 0.005;
  // character proxies (see struct Capsule in common.wgsl — traced as ROUND CONES; the record and these members keep their old name): 8 floats each
  static readonly MAX_CAPSULES = 128; static readonly CAPS_PER_CHAR = 15;   // (15 × up to 8 characters; the level has 4)
  capsuleData = new Float32Array(BoxWorld.MAX_CAPSULES * 8); capsuleU32 = new Uint32Array(this.capsuleData.buffer); capsuleCount = 0; charCount = 0;
  capsuleBuf: GPUBuffer;
  /** The SDF CHARACTER RIG's fit (render/sdfrig.ts; the engine writes it from its attached fit each frame before upload): with it set, upload() turns the frame's list into the rig —
   *  slot i's radius becomes the fitted r0[i], the fitted r1[i] rides in the top byte of the record's misc word (millimetres; RB_QUANT), and each character's cull sphere is fitted to
   *  his cones (+ kPad for the smooth union's bulge). null = no fit attached: the list exactly as addCharacterCapsules wrote it (hand radii, no r1 byte — sdfrig.wgsl coneRb then
   *  reads r again, an untapered cone — and the game's 1.5 m spheres). */
  rig: { r0: Float32Array; r1: Float32Array; kPad: number } | null = null;
  static readonly RB_QUANT = 0.001;   // = render/sdfrig.ts RB_QUANT (shaders/sdfrig.wgsl coneRb decodes it)
  visible: Uint32Array; visibleCount = 0; visibleBuf: GPUBuffer;
  staticsDirty = true;
  // ---- MARKINGS (scene/markings.ts): the table of packed records lives in the TAIL of matBuf, from vec4 row maxBoxes × MAT_STRIDE / 4 (common.wgsl MARK_BASE) —
  // no new binding: every shader that has the scene group can read a box's markings. A box's list is registered on first upload (deduplicated by CONTENT +
  // albedo + size, so every carton of a size shares one set of records — 'identical on every instance of a kind' literally), its first record's 1-based
  // slot rides in bits 18‥31 of the GPU flags word, and its area-averaged albedo goes to the 4th mat row for the secondary rays. `markingsEnabled` off =
  // slot 0 everywhere and the secondary albedo = the albedo: byte for byte the frame without markings.
  markingsEnabled = true;
  /** the base texel (m) the records were packed at; setMarkingTexel() repacks the table when the setting moves */
  markingTexel = MARKING_TEXEL;
  markData = new Float32Array(MARK_TABLE_ROWS * 4); markRows = 0; private markDirty = false;   // the table (vec4 rows) and how many rows are taken
  private markByKey = new Map<string, { slot: number; n: number; rows: number; sec: Vec3; anyEmit: boolean; marks: MarkingDef[]; base: Vec3; h: Vec3 }>();
  private markOfBox = new WeakMap<Box, { key: string; slot: number; sec: Vec3; a0: number; a1: number; a2: number; marks: MarkingDef[] }>();
  markStatsInfo = { lists: 0, records: 0, rows: 0, boxes: 0, dropped: 0, uploads: 0 };

  constructor(private device: GPUDevice, maxBoxes = WORLD.maxBoxes) {
    this.maxBoxes = maxBoxes;
    if (maxBoxes !== WORLD.maxBoxes) throw new Error('BoxWorld: maxBoxes must be WORLD.maxBoxes (the shaders place the marking table after that many mat rows)');
    this.geoData = new ArrayBuffer(maxBoxes * GEO_STRIDE * 4); this.geoF32 = new Float32Array(this.geoData); this.geoU32 = new Uint32Array(this.geoData);
    this.matData = new Float32Array(maxBoxes * MAT_STRIDE);
    const S = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
    this.geoBuf = makeBuffer(device, maxBoxes * GEO_STRIDE * 4, S | GPUBufferUsage.COPY_SRC, 'boxGeo');   // (COPY_SRC: the g-buffer snapshots both into its 'previous frame' buffer for the motion vectors — render/gbuffer.ts snapshotPrev)
    this.matBuf = makeBuffer(device, maxBoxes * MAT_STRIDE * 4 + MARK_TABLE_ROWS * 16 + GB_ROWS * 16, S | GPUBufferUsage.COPY_SRC, 'boxMat');   // + the marking table in its tail (+ the glass-breaking cell table after it: GB_ROWS, zero unless a pane has come apart)
    if (WORLD.gridW + WORLD.gridH > 96) throw new Error('trace grid: the DDA in common.wgsl caps a ray at 96 cell visits; W + H must stay ≤ 96 for that cap to be unreachable');
    if (maxBoxes > 65536 || maxBoxes * WORLD.gridW * WORLD.gridH >= 1 << 24) throw new Error('trace grid: packed items keep the box index in 16 bits and cell starts in 24');
    this.cellStart = new Uint32Array(WORLD.gridW * WORLD.gridH + 1 + 2 * WORLD.gridW * WORLD.gridH);
    this.items = new Uint32Array(65536);
    this.cellBuf = makeBuffer(device, this.cellStart.byteLength, S, 'gridCells');
    this.itemBuf = makeBuffer(device, this.items.byteLength, S, 'gridItems');
    this.infoBuf = makeBuffer(device, this.infoData.byteLength, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'sceneInfo');
    this.capsuleBuf = makeBuffer(device, this.capsuleData.byteLength, S, 'capsules');
    this.visible = new Uint32Array(maxBoxes);
    this.visibleBuf = makeBuffer(device, this.visible.byteLength, S, 'visibleBoxes');
  }

  addStatic(b: Box): number { this.statics.push(b); this.staticsDirty = true; return this.statics.length - 1; }

  // ---- markings ----
  /** The 1-based slot of the first record of box b's marking list (0 = none / table full), registering the list on first sight; also caches the box's
   *  secondary albedo. Keyed by the list's content + the box's albedo + size, so identical objects share records. */
  private markSlotOf(b: Box): { slot: number; sec: Vec3 } {
    const marks = b.marks!; const cached = this.markOfBox.get(b);
    if (cached && cached.marks === marks && cached.a0 === b.albedo[0] && cached.a1 === b.albedo[1] && cached.a2 === b.albedo[2]) return cached;
    const key = `${JSON.stringify(marks)}|${b.albedo.join(',')}|${b.h.join(',')}`;
    let ent = this.markByKey.get(key);
    if (!ent) {
      const n = Math.min(marks.length, MAX_MARKS_PER_BOX);
      let rows = 0; for (let k = 0; k < n; k++) rows += markRecordRows(marks[k]);
      if (this.markRows + rows > MARK_TABLE_ROWS || this.markRows + 1 > MARK_SLOT_MAX) { this.markStatsInfo.dropped++; ent = { slot: 0, n: 0, rows: 0, sec: [b.albedo[0], b.albedo[1], b.albedo[2]], anyEmit: false, marks, base: [b.albedo[0], b.albedo[1], b.albedo[2]], h: [b.h[0], b.h[1], b.h[2]] }; }
      else {
        const first = this.markRows; this.markRows += rows;
        ent = { slot: first + 1, n, rows, sec: [0, 0, 0], anyEmit: false, marks, base: [b.albedo[0], b.albedo[1], b.albedo[2]], h: [b.h[0], b.h[1], b.h[2]] };
        this.packList(ent); this.markStatsInfo.lists++; this.markStatsInfo.records += n; this.markStatsInfo.rows = this.markRows;
      }
      this.markByKey.set(key, ent);
    }
    const out = { key, slot: ent.slot, sec: ent.sec, a0: b.albedo[0], a1: b.albedo[1], a2: b.albedo[2], marks };
    this.markOfBox.set(b, out); return out;
  }
  private packList(ent: { slot: number; n: number; sec: Vec3; anyEmit: boolean; marks: MarkingDef[]; base: Vec3; h: Vec3 }) {
    let row = ent.slot - 1; const n = ent.n;
    const stats = ent.marks.slice(0, n).map(m => markStats(m, ent.base, this.markingTexel));
    const anyEmit = stats.some(st => st.emask !== 0);
    for (let k = 0; k < n; k++) { const m = ent.marks[k]; packMarking(this.markData, row, m, stats[k], k === n - 1, anyEmit, AREA_LIT_MARKS.has(m)); row += markRecordRows(m); }
    const sec = secondaryAlbedo(ent.base, ent.h, ent.marks.slice(0, n), this.markingTexel); ent.sec[0] = sec[0]; ent.sec[1] = sec[1]; ent.sec[2] = sec[2]; ent.anyEmit = anyEmit;
    this.markDirty = true;
  }
  /** repack every registered list at a new base texel (engine.settings.markingTexel moved) or after AREA_LIT_MARKS changed (game.ts registers the lights after the first upload) */
  repackMarkings(texel = this.markingTexel) { this.markingTexel = texel; for (const ent of this.markByKey.values()) if (ent.slot) this.packList(ent); }
  /** how full the append-only marking table is: rows taken / MARK_TABLE_ROWS (the editor compacts past two thirds; its lint warns on a level that alone nears it) */
  get markTableFill(): number { return this.markRows / MARK_TABLE_ROWS; }
  /** Forget every registered marking list (the table is append-only: right for the game's fixed set of lists, but an editor session paints a new list per
   *  stroke). The next upload re-registers exactly the lists the boxes then carry. Returns the rows that were taken. */
  resetMarkTable(): number {
    const taken = this.markRows;
    this.markRows = 0; this.markByKey.clear(); this.markOfBox = new WeakMap(); this.markDirty = true;
    this.markStatsInfo.lists = 0; this.markStatsInfo.records = 0; this.markStatsInfo.rows = 0;
    return taken;
  }
  /** the records of box b's list as packed (for the panel / __mark.list) — [] when it has none */
  markRecordsOf(b: Box): { row: number; rows: number; head: number[] }[] {
    if (!b.marks?.length) return []; const { slot } = this.markSlotOf(b); if (!slot) return [];
    const out: { row: number; rows: number; head: number[] }[] = []; const n = Math.min(b.marks.length, MAX_MARKS_PER_BOX); let row = slot - 1;
    for (let k = 0; k < n; k++) { const rows = markRecordRows(b.marks[k]); out.push({ row, rows, head: Array.from(this.markData.subarray(row * 4, row * 4 + 32)) }); row += rows; }
    return out;
  }

  /** Begin a frame's proxy list. Characters append CAPS_PER_CHAR records each via addCharacterCapsules(). */
  resetCapsules() { this.capsuleCount = 0; this.charCount = 0; }
  /** caps: array of [ax,ay,az, r, bx,by,bz] (exactly CAPS_PER_CHAR entries; pad with zero-radius), bound = [cx,cy,cz,radius]. */
  addCharacterCapsules(owner: number, albedo: Vec3, caps: number[][], bound: [number, number, number, number]) {
    if (this.charCount >= 8) return;
    const rgb565 = ((Math.round(albedo[0] * 31) & 31) << 11) | ((Math.round(albedo[1] * 63) & 63) << 5) | (Math.round(albedo[2] * 31) & 31);
    const misc = ((owner & 0xff) | (rgb565 << 8)) >>> 0;
    const base = this.charCount * BoxWorld.CAPS_PER_CHAR;
    for (let i = 0; i < BoxWorld.CAPS_PER_CHAR; i++) {
      const c = caps[i] ?? [0, -100, 0, 0, 0, -100, 0]; const o = (base + i) * 8;
      this.capsuleData[o] = c[0]; this.capsuleData[o + 1] = c[1]; this.capsuleData[o + 2] = c[2]; this.capsuleData[o + 3] = c[3];
      this.capsuleData[o + 4] = c[4]; this.capsuleData[o + 5] = c[5]; this.capsuleData[o + 6] = c[6]; this.capsuleU32[o + 7] = misc;
    }
    const bo = 24 + this.charCount * 4; this.infoF32[bo] = bound[0]; this.infoF32[bo + 1] = bound[1]; this.infoF32[bo + 2] = bound[2]; this.infoF32[bo + 3] = bound[3];
    this.charCount++; this.capsuleCount = this.charCount * BoxWorld.CAPS_PER_CHAR;
  }
  /** Turn the frame's proxy list into the SDF rig (see `rig`): per real record (radius > 0) the fitted r0 as its radius and r1 packed above the albedo; per character the cull sphere
   *  fitted to the cones' ends + radii (+ the smooth union's pad + 1 cm) about the middle of their box. Idempotent — a render with no game step re-applies it to the same records and
   *  gets the same words (the ends are never touched, r0 / r1 come from the fit, the sphere is rebuilt from both). */
  private applyRig(rig: { r0: Float32Array; r1: Float32Array; kPad: number }) {
    const D = this.capsuleData, U = this.capsuleU32, N = BoxWorld.CAPS_PER_CHAR;
    for (let c = 0; c < this.charCount; c++) {
      let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
      for (let i = 0; i < N; i++) {
        const o = (c * N + i) * 8; if (!(D[o + 3] > 0)) continue;   // (a padding record: nothing to fit, never hit)
        const r0 = rig.r0[i], r1 = rig.r1[i];
        D[o + 3] = r0; U[o + 7] = ((U[o + 7] & 0x00ffffff) | (Math.max(1, Math.min(255, Math.round(r1 / BoxWorld.RB_QUANT))) << 24)) >>> 0;
        const r = Math.max(r0, r1);
        x0 = Math.min(x0, D[o] - r, D[o + 4] - r); y0 = Math.min(y0, D[o + 1] - r, D[o + 5] - r); z0 = Math.min(z0, D[o + 2] - r, D[o + 6] - r);
        x1 = Math.max(x1, D[o] + r, D[o + 4] + r); y1 = Math.max(y1, D[o + 1] + r, D[o + 5] + r); z1 = Math.max(z1, D[o + 2] + r, D[o + 6] + r);
      }
      if (x0 > x1) continue;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2; let rad = 0;
      for (let i = 0; i < N; i++) {
        const o = (c * N + i) * 8; if (!(D[o + 3] > 0)) continue;
        rad = Math.max(rad, Math.hypot(D[o] - cx, D[o + 1] - cy, D[o + 2] - cz) + D[o + 3], Math.hypot(D[o + 4] - cx, D[o + 5] - cy, D[o + 6] - cz) + rig.r1[i]);
      }
      const bo = 24 + c * 4; this.infoF32[bo] = cx; this.infoF32[bo + 1] = cy; this.infoF32[bo + 2] = cz; this.infoF32[bo + 3] = rad + rig.kPad + 0.01;
    }
  }

  /** Footprint half extents in world XZ for a yawed box. */
  static footprint(b: Box): [number, number] {
    if (b.rot) {   // XZ half extents of the rotated box's world AABB: |R| · h
      const ax = quat.rotate(b.rot, [1, 0, 0]), ay = quat.rotate(b.rot, [0, 1, 0]), az = quat.rotate(b.rot, [0, 0, 1]);
      return [Math.abs(ax[0]) * b.h[0] + Math.abs(ay[0]) * b.h[1] + Math.abs(az[0]) * b.h[2], Math.abs(ax[2]) * b.h[0] + Math.abs(ay[2]) * b.h[1] + Math.abs(az[2]) * b.h[2]];
    }
    const cs = Math.abs(Math.cos(b.yaw)), sn = Math.abs(Math.sin(b.yaw));
    return [cs * b.h[0] + sn * b.h[2], sn * b.h[0] + cs * b.h[2]];
  }
  /** World Y half extent (yawed boxes: h.y; fully rotated ones: the |R|·h row, like footprint()). */
  static heightExtent(b: Box): number {
    if (!b.rot) return b.h[1];
    const ax = quat.rotate(b.rot, [1, 0, 0]), ay = quat.rotate(b.rot, [0, 1, 0]), az = quat.rotate(b.rot, [0, 0, 1]);
    return Math.abs(ax[1]) * b.h[0] + Math.abs(ay[1]) * b.h[1] + Math.abs(az[1]) * b.h[2];
  }
  /** The height quantiser the traversal's y-cull uses (GRID_YQ* in world.ts / common.wgsl): floor((y − y0)·s) clamped to [0, levels−1]. */
  static yLevel(y: number): number {
    const q = Math.floor((y - WORLD.gridY0) * (WORLD.gridYLevels / (WORLD.gridY1 - WORLD.gridY0)));
    return q < 0 ? 0 : q > WORLD.gridYLevels - 1 ? WORLD.gridYLevels - 1 : q;
  }

  /** Rebuild combined list, pack, grid, and upload. Call once per frame after dynamics are set. */
  upload() {
    const all = this.all; all.length = 0;
    for (const b of this.statics) all.push(b); for (const b of this.dynamics) all.push(b);
    if (all.length > this.maxBoxes) throw new Error(`too many boxes: ${all.length}`);
    const gf = this.geoF32, gu = this.geoU32, mf = this.matData;
    let nv = 0, marked = 0;
    if (this.staticsDirty || this.glassStaticsN !== this.statics.length) { this.glassStatics.length = 0; for (let i = 0; i < this.statics.length; i++) if (this.statics[i].flags & BoxFlag.Glass) this.glassStatics.push(i); this.staticsDirty = false; this.glassStaticsN = this.statics.length; }
    const marksOn = this.markingsEnabled;
    const nStat = this.statics.length; let matched = 0, fresh = 0, unkeyed = 0;
    for (let i = 0; i < all.length; i++) {
      const b = all[i]; const o = i * GEO_STRIDE;
      let flags = (b.flags & 0xff) | ((b.owner & 0xff) << 8) | (b.rot ? BoxFlag.Rot : 0) | (b.flags & BoxFlag.Glass);   // GPU word: flag bits 0-7, owner byte 8-15 (boxOwner() in common.wgsl), Glass at bit 17 (the one CPU flag ≥ 1<<16 that is passed through: BOX_GLASS), the marking slot in 18-31 (below); everything else up there is CPU-only and never reaches the GPU
      if (b.emissive[0] + b.emissive[1] + b.emissive[2] > 0) flags |= BoxFlag.Emissive;
      let s0 = b.albedo[0], s1 = b.albedo[1], s2a = b.albedo[2];   // the secondary albedo (4th mat row): the albedo itself unless markings fold in
      if (marksOn && b.marks !== undefined && b.marks.length > 0 && !b.rot) {   // (a tilted box never carries markings: the face frame assumes yaw only)
        const mk = this.markSlotOf(b);
        if (mk.slot > 0 && mk.slot <= MARK_SLOT_MAX) { flags |= mk.slot << MARK_SLOT_SHIFT; s0 = mk.sec[0]; s1 = mk.sec[1]; s2a = mk.sec[2]; marked++; }
      }
      gf[o] = b.c[0]; gf[o + 1] = b.c[1]; gf[o + 2] = b.c[2]; gu[o + 3] = pack2x16f(Math.cos(b.yaw), Math.sin(b.yaw));
      gf[o + 4] = b.h[0]; gf[o + 5] = b.h[1]; gf[o + 6] = b.h[2]; gu[o + 7] = flags >>> 0;
      const m = i * MAT_STRIDE;
      mf[m] = b.albedo[0]; mf[m + 1] = b.albedo[1]; mf[m + 2] = b.albedo[2]; mf[m + 3] = b.cutHeight;
      mf[m + 4] = b.emissive[0]; mf[m + 5] = b.emissive[1]; mf[m + 6] = b.emissive[2]; mf[m + 7] = matWord(b);   // (the finish: read through common.wgsl boxFinish by the g-buffer / reflect.wgsl — every other shader ignores the word, as it ignored the owner that sat here)
      if (b.rot) { mf[m + 8] = b.rot[0]; mf[m + 9] = b.rot[1]; mf[m + 10] = b.rot[2]; mf[m + 11] = b.rot[3]; }
      else { const s2 = Math.sin(b.yaw / 2), c2 = Math.cos(b.yaw / 2); mf[m + 8] = 0; mf[m + 9] = s2; mf[m + 10] = 0; mf[m + 11] = c2; }   // yaw about +Y (local +X → (cos, 0, −sin), +Z → (sin, 0, cos): the same convention as the packed yaw the rays use)
      mf[m + 12] = s0; mf[m + 13] = s1; mf[m + 14] = s2a; mf[m + 15] = b.markGain ?? 1;   // secondary albedo + the marking emission gain (game/lighting.ts drives it with the switchable's supply)
      if (!(b.flags & (BoxFlag.NoPrimary | BoxFlag.Glass))) {   // a pane is never rasterised: the G-buffer holds what stands BEHIND it and composite lays the glass over that (composite.wgsl)
        // MOTION IDENTITY: the word's top 16 bits = where the g-buffer finds this box's PREVIOUS transform — 0 = the index rule as before (statics; unkeyed dynamics; the switch off),
        // 0xFFFF = a keyed box new this frame (nothing to reproject: it did not move), else 1 + the index its key had last frame (gbuffer.wgsl vsBox)
        let pslot = 0;
        if (this.motionIds && i >= nStat && b.mkey !== undefined) { const pi = this.mkeyPrev.get(b.mkey); if (pi === undefined) { pslot = 0xFFFF; fresh++; } else { pslot = pi + 1; matched++; } this.mkeyCur.set(b.mkey, i); }
        else if (i >= nStat) unkeyed++;
        this.visible[nv++] = i | (pslot << 16);
      } else if (this.motionIds && i >= nStat && b.mkey !== undefined) this.mkeyCur.set(b.mkey, i);
    }
    { const t = this.mkeyPrev; this.mkeyPrev = this.mkeyCur; this.mkeyCur = t; t.clear(); this.mkeyStats.matched = matched; this.mkeyStats.fresh = fresh; this.mkeyStats.unkeyed = unkeyed; }
    this.visibleCount = nv; this.markStatsInfo.boxes = marked;
    const q = this.device.queue;
    q.writeBuffer(this.geoBuf, 0, this.geoData, 0, all.length * GEO_STRIDE * 4);
    q.writeBuffer(this.matBuf, 0, this.matData.buffer, 0, all.length * MAT_STRIDE * 4);
    if (this.markDirty) { q.writeBuffer(this.matBuf, this.maxBoxes * MAT_STRIDE * 4, this.markData.buffer, 0, Math.max(1, this.markRows) * 16); this.markDirty = false; this.markStatsInfo.uploads++; }   // the marking table (its tail region), only when a list was registered / repacked
    q.writeBuffer(this.visibleBuf, 0, this.visible.buffer, 0, nv * 4);
    this.packGlass();
    this.buildGrid();
  }

  /** SceneInfo.glass: every static Glass pane, nearest to glassFocus first, at most MAX_GLASS — three vec4f each: (c.xyz, cos yaw), (h.xyz, sin yaw),
   *  (tint rgb = albedo, box index). glassInfo.x = the count (0 with glassEnabled off: the shaders then never loop). Written into infoData; buildGrid uploads it. */
  static readonly GLASS_WORD = 4 + 16 + 4 + 32 + 32 + 4 + 128;   // word offset of glassInfo in infoData (the panes follow at +4)
  private packGlass() {
    const info = this.infoData, f = this.infoF32, W0 = BoxWorld.GLASS_WORD; const list = this.glassList; list.length = 0;
    if (this.glassEnabled) {
      const sc = this.glassScratch; sc.length = 0; const fx = this.glassFocus[0], fz = this.glassFocus[2];
      for (const i of this.glassStatics) { const b = this.statics[i]; sc.push({ i, d: (b.c[0] - fx) ** 2 + (b.c[2] - fz) ** 2 }); }
      sc.sort((a, b) => a.d - b.d);   // nearest the look-at first (composite / fgather find the on-screen ones early; the cut at MAX_GLASS drops the farthest)
      for (let k = 0; k < Math.min(MAX_GLASS, sc.length); k++) list.push(sc[k].i);
    }
    info[W0] = list.length; info[W0 + 1] = list.length; info[W0 + 2] = 0; info[W0 + 3] = 0;
    for (let k = 0; k < list.length; k++) {
      const b = this.statics[list[k]]; const o = W0 + 4 + k * 12;
      f[o] = b.c[0]; f[o + 1] = b.c[1]; f[o + 2] = b.c[2]; f[o + 3] = Math.cos(b.yaw);
      f[o + 4] = b.h[0]; f[o + 5] = b.h[1]; f[o + 6] = b.h[2]; f[o + 7] = Math.sin(b.yaw);
      f[o + 8] = b.albedo[0]; f[o + 9] = b.albedo[1]; f[o + 10] = b.albedo[2]; f[o + 11] = list[k];
    }
    // GLASS BREAKING: the per-slot cell table (only with a system attached; uploaded while any pane carries impacts, and once more when the last goes whole so the rows read zero again)
    if (this.glassCellFill) {
      const gb = this.gbData; gb.fill(0); let any = false;
      for (let k = 0; k < list.length; k++) if (this.glassCellFill(list[k], gb, k * GB_STRIDE * 4)) any = true;
      if (any || this.gbLive) this.device.queue.writeBuffer(this.matBuf, this.maxBoxes * MAT_STRIDE * 4 + MARK_TABLE_ROWS * 16, gb.buffer, 0, gb.byteLength);
      this.gbLive = any;
    }
  }

  private buildGrid() {
    const W = WORLD.gridW, H = WORLD.gridH, cs = WORLD.gridCell, N = W * H, CB = N + 1;
    const all = this.all; const counts = this.cellStart; counts.fill(0, 0, N + 1);
    const mask = this.gridMask; mask.fill(0);
    this.globals.length = 0;
    if (this.gridRanges.length < all.length * 6) this.gridRanges = new Int32Array(Math.max(all.length, this.maxBoxes) * 6);
    const ranges = this.gridRanges; // per box: x0,x1,z0,z1 (cell coords; x0 = -1 → not in the grid), qmin, qmax
    const pad = WORLD.gridYPad;
    // Registration slack: how far (m) the box the GPU actually traces can reach outside the footprint it is registered with. Yawed boxes are
    // intersected with the f16 cos/sin packed above — not quite orthonormal — so their traced outline is the footprint scaled by up to
    // ~1 + 2⁻¹⁰ (millimetres on a car); measured here per build from the very bits the shader unpacks. Plus WORLD.gridJitter for the f32
    // rounding of centres, half sizes and ray-relative offsets. The height cull looks this far back across the cell line it just crossed
    // (common.wgsl gridCell callers), which is what keeps it exact for a ray grazing such a sliver.
    let slack = 0; const gu = this.geoU32;
    for (let i = 0; i < all.length; i++) {
      const b = all[i]; const r = i * 6;
      if (b.flags & (BoxFlag.NoShadow | BoxFlag.Glass)) { ranges[r] = -1; continue; }   // (a pane is never in the trace grid, on or off, intact or broken: no traced ray meets glass — SceneInfo.glass is where the shaders find it)
      const [ex, ez] = BoxWorld.footprint(b);
      if (!b.rot) {
        const rot = gu[i * GEO_STRIDE + 3]; const c = Math.abs(f16value(rot & 0xffff)), s = Math.abs(f16value(rot >>> 16));
        if (c !== 0 && s !== 0) { const det = c * c + s * s; slack = Math.max(slack, (c * b.h[0] + s * b.h[2]) / det - ex, (s * b.h[0] + c * b.h[2]) / det - ez); }   // (axis-aligned: c, s ∈ {0, 1} exactly, no slack)
      }
      let x0 = Math.floor((b.c[0] - ex) / cs), x1 = Math.floor((b.c[0] + ex) / cs);
      let z0 = Math.floor((b.c[2] - ez) / cs), z1 = Math.floor((b.c[2] + ez) / cs);
      x0 = Math.max(0, x0); z0 = Math.max(0, z0); x1 = Math.min(W - 1, x1); z1 = Math.min(H - 1, z1);
      if (x1 < x0 || z1 < z0) { ranges[r] = -1; continue; }
      const area = (x1 - x0 + 1) * (z1 - z0 + 1);
      if (area > 96 && this.globals.length < 16) { this.globals.push(i); ranges[r] = -1; continue; }
      ranges[r] = x0; ranges[r + 1] = x1; ranges[r + 2] = z0; ranges[r + 3] = z1;
      // padded, quantised height extent (the y-cull compares these against the ray's remaining height span; the pad covers every rounding
      // difference between this f64 build and the tracer's f32 arithmetic many times over) and the 24 coarse slices it touches
      const ey = BoxWorld.heightExtent(b);
      const qmin = BoxWorld.yLevel(b.c[1] - ey - pad), qmax = BoxWorld.yLevel(b.c[1] + ey + pad);
      ranges[r + 4] = qmin; ranges[r + 5] = qmax;
      const s0 = Math.floor(qmin / 10), s1 = Math.floor(qmax / 10);
      const bits = ((0xffffff >>> (23 - (s1 - s0))) << s0) >>> 0;
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { counts[z * W + x]++; mask[z * W + x] |= bits; }
    }
    // exclusive prefix sum -> starts (region A: plain, read by the flag-off tracer and the smoke obstacle bake)
    let sum = 0; let maxPer = 0; for (let c = 0; c < N; c++) { const n = counts[c]; if (n > maxPer) maxPer = n; counts[c] = sum; sum += n; } counts[N] = sum;
    if (2 * sum > this.items.length) { this.items = new Uint32Array(Math.max(2 * sum, this.items.length * 2)); this.itemBuf.destroy(); this.itemBuf = makeBuffer(this.device, this.items.byteLength, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 'gridItems'); }
    const fill = this.gridFill; fill.fill(0); // running offsets
    const items = this.items;
    for (let i = 0; i < all.length; i++) {
      const r = i * 6; const x0 = ranges[r]; if (x0 < 0) continue; const x1 = ranges[r + 1], z0 = ranges[r + 2], z1 = ranges[r + 3];
      const packed = (i | (ranges[r + 4] << 16) | (ranges[r + 5] << 24)) >>> 0;   // region B item: index16 | qmin8 | qmax8 (levels ≤ 239 fit a byte)
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const c = z * W + x; const k = counts[c] + fill[c]++; items[k] = i; items[sum + k] = packed; }
    }
    this.itemCount = sum;
    // Chebyshev distance of every cell to the nearest occupied one (two-pass 8-neighbour chamfer: exact for the chessboard metric). An empty cell at
    // distance d lets the DDA take its next d−1 steps without touching memory: any cell within d−1 king moves is empty as well.
    const dist = this.gridDist;
    for (let c = 0; c < N; c++) dist[c] = counts[c + 1] > counts[c] ? 0 : 255;
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
      const c = z * W + x; let d = dist[c]; if (d === 0) continue;
      if (x > 0) d = Math.min(d, dist[c - 1] + 1);
      if (z > 0) { d = Math.min(d, dist[c - W] + 1); if (x > 0) d = Math.min(d, dist[c - W - 1] + 1); if (x < W - 1) d = Math.min(d, dist[c - W + 1] + 1); }
      dist[c] = d;
    }
    for (let z = H - 1; z >= 0; z--) for (let x = W - 1; x >= 0; x--) {
      const c = z * W + x; let d = dist[c]; if (d === 0) continue;
      if (x < W - 1) d = Math.min(d, dist[c + 1] + 1);
      if (z < H - 1) { d = Math.min(d, dist[c + W] + 1); if (x < W - 1) d = Math.min(d, dist[c + W + 1] + 1); if (x > 0) d = Math.min(d, dist[c + W - 1] + 1); }
      dist[c] = d;
    }
    // region B: two words per cell for the fast traversal
    let empty = 0, skipSum = 0;
    for (let c = 0; c < N; c++) {
      const n = counts[c + 1] - counts[c]; const d = dist[c];
      if (d > 0) { empty++; skipSum += d; }
      counts[CB + 2 * c] = (mask[c] | (d << 24)) >>> 0;
      counts[CB + 2 * c + 1] = (counts[c] | (Math.min(n, 255) << 24)) >>> 0;   // count 255 = "long cell": the shader reads the end from region A instead
    }
    this.gridStats.empty = empty; this.gridStats.meanSkip = empty ? skipSum / empty : 0; this.gridStats.maxPerCell = maxPer; this.gridStats.slack = slack + WORLD.gridJitter;
    const info = this.infoData; info[0] = all.length; info[1] = this.globals.length; info[2] = W; info[3] = H;
    const infoF = this.infoF32;
    infoF[88] = this.gridStats.slack; infoF[89] = pad - BoxWorld.ITEM_PAD_KEEP; infoF[90] = 0; infoF[91] = 0;   // SceneInfo.grid: x = registration slack (m), y = how much tighter than the packed extents FLAG_GRID_SLABS judges a cell's height span at each end (m)
    const gpad = BoxWorld.GLOBAL_PAD + this.gridStats.slack;
    for (let i = 0; i < 16; i++) {
      const gi = this.globals[i]; info[4 + i] = gi ?? 0;
      const yo = 56 + 2 * i, bo = 92 + 8 * i;   // globalsY pair, globalsB min/max vec4s
      if (gi === undefined) { infoF[yo] = 0; infoF[yo + 1] = 0; infoF.fill(0, bo, bo + 8); continue; }
      const g = all[gi]; const ey = BoxWorld.heightExtent(g); const [ex, ez] = BoxWorld.footprint(g);
      infoF[yo] = g.c[1] - ey - pad; infoF[yo + 1] = g.c[1] + ey + pad;   // globalsY: the same padded height extent per global, in metres (the tracer skips a global the ray's heights never reach)
      // globalsB: the global's world bounds on all three axes, GLOBAL_PAD + slack proud of the traced box — the FLAG_GRID_SLABS reject skips a global the
      // ray's segment [ro, ro + rd·tmax] cannot touch in x, y or z (floors under a ray that leaves the floor, the corridor / break-room finishes for rays
      // that never cross them, the ceiling for exterior rays), where globalsY's 4 cm still had every ray off the floor test all four floor slabs
      infoF[bo] = g.c[0] - ex - gpad; infoF[bo + 1] = g.c[1] - ey - gpad; infoF[bo + 2] = g.c[2] - ez - gpad; infoF[bo + 3] = 0;
      infoF[bo + 4] = g.c[0] + ex + gpad; infoF[bo + 5] = g.c[1] + ey + gpad; infoF[bo + 6] = g.c[2] + ez + gpad; infoF[bo + 7] = 0;
    }
    info[20] = this.capsuleCount; info[21] = this.charCount; info[22] = BoxWorld.CAPS_PER_CHAR; info[23] = sum;   // [23] = itemsB: where the packed copies of the items start
    if (this.rig) this.applyRig(this.rig);   // the SDF character rig: fitted radii / r1 bytes / cull spheres over the game's list (idempotent — a render with no game step re-applies it to the same records)
    this.device.queue.writeBuffer(this.capsuleBuf, 0, this.capsuleData.buffer, 0, Math.max(32, this.capsuleCount * 32));
    const q = this.device.queue;
    q.writeBuffer(this.cellBuf, 0, this.cellStart);
    q.writeBuffer(this.itemBuf, 0, this.items.buffer, 0, Math.max(4, 2 * sum * 4));
    q.writeBuffer(this.infoBuf, 0, info);
  }

  /** CPU ray cast against all boxes (closest hit). Used for mouse picking / aim point. A glass pane IS hit by default (the designer, 08-11: "pointing at glass should
   *  target that point in the glass, not what's behind it" — the reticle, the arm and the throw arc sit on the pane; a round finds it anyway, combat.ts through
   *  StaticCollision.raycast); pass BoxFlag.Glass in skipFlags to see through panes (a laser's reach, a tracer's line). */
  /** glass-break's hook (game/glassbreak.ts sets it beside StaticCollision.glassOpen): a Glass static whose CELL at the hit point has fallen is no hit — the aim
   *  ray, the reticle and the throw arc pass through the hole like a round and a sight line do (W4G.10) */
  glassOpen: ((index: number, p: Vec3) => boolean) | null = null;
  raycast(ro: Vec3, rd: Vec3, tmax = 1e9, skipFlags: number = BoxFlag.NoShadow | BoxFlag.NoPrimary, skipOwner = 0): { t: number; index: number; n: Vec3 } | null {
    let best = tmax, bi = -1; let bn: Vec3 = [0, 1, 0];
    for (let i = 0; i < this.all.length; i++) {
      const b = this.all[i]; if (b.flags & skipFlags) continue; if (skipOwner && b.owner === skipOwner) continue;   // (e.g. the cursor's aim ray must not land on the player's own gun / goggles)
      const r = rayBox(ro, rd, b, best);
      if (r && r.t < best) {
        if (this.glassOpen && (b.flags & BoxFlag.Glass) && i < this.statics.length && this.glassOpen(i, [ro[0] + rd[0] * r.t, ro[1] + rd[1] * r.t, ro[2] + rd[2] * r.t])) continue;   // through the hole in a holed pane
        best = r.t; bi = i; bn = r.n;
      }
    }
    return bi >= 0 ? { t: best, index: bi, n: bn } : null;
  }
}

export function rayBox(ro: Vec3, rd: Vec3, b: Box, tmax: number): { t: number; n: Vec3 } | null {
  if (b.rot) return rayBoxRot(ro, rd, b, tmax);
  const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw);
  const px = ro[0] - b.c[0], py = ro[1] - b.c[1], pz = ro[2] - b.c[2];
  // world -> local (R^T)
  const lx = cs * px - sn * pz, lz = sn * px + cs * pz, ly = py;
  const dx = cs * rd[0] - sn * rd[2], dz = sn * rd[0] + cs * rd[2], dy = rd[1];
  const inv = [1 / (dx || 1e-20), 1 / (dy || 1e-20), 1 / (dz || 1e-20)];
  const o = [lx, ly, lz]; let t0 = 0, t1 = tmax; let axis = -1, sgn = 0;
  for (let a = 0; a < 3; a++) {
    let ta = (-b.h[a] - o[a]) * inv[a], tb = (b.h[a] - o[a]) * inv[a]; let s = -1;
    if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; s = 1; }
    if (ta > t0) { t0 = ta; axis = a; sgn = s; }
    if (tb < t1) t1 = tb;
    if (t0 > t1) return null;
  }
  // Origin INSIDE the box (no face entered ahead of it — an origin exactly ON a face heading in counts as inside too): no hit, deliberately. Callers lean on it: the
  // cursor's pick and a round's static hit start rays at muzzles and lenses that may sit in their own housing, an item or a spark born inside a static leaves it
  // freely, an eye momentarily inside a swinging leaf still sees (collision.ts segmentBlockedDynamic). What must NOT lean on it is a blocked-or-not question about a
  // segment born on a wall's face — collision.ts segmentBlocked judges statics by the full slab interval (lineBox) for exactly that reason. Same rule in rayBoxRot.
  if (axis < 0) return null;
  const ln: Vec3 = [0, 0, 0]; ln[axis] = sgn;
  const n: Vec3 = [cs * ln[0] + sn * ln[2], ln[1], -sn * ln[0] + cs * ln[2]];
  return { t: t0, n };
}
/** Same slab test in the frame of a fully rotated box (Box.rot). */
function rayBoxRot(ro: Vec3, rd: Vec3, b: Box, tmax: number): { t: number; n: Vec3 } | null {
  const qi = quat.conj(b.rot!); const o = quat.rotate(qi, v3.sub(ro, b.c)); const d = quat.rotate(qi, rd);
  let t0 = 0, t1 = tmax; let axis = -1, sgn = 0;
  for (let a = 0; a < 3; a++) {
    const inv = 1 / (d[a] || 1e-20);
    let ta = (-b.h[a] - o[a]) * inv, tb = (b.h[a] - o[a]) * inv; let s = -1;
    if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; s = 1; }
    if (ta > t0) { t0 = ta; axis = a; sgn = s; }
    if (tb < t1) t1 = tb;
    if (t0 > t1) return null;
  }
  if (axis < 0) return null;   // origin inside: no hit — the rule rayBox documents (kept on purpose; see there for who leans on it and who must not)
  const ln: Vec3 = [0, 0, 0]; ln[axis] = sgn;
  return { t: t0, n: quat.rotate(b.rot!, ln) };
}
