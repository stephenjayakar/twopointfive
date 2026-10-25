// Box scene representation, GPU packing and the 2D (XZ) uniform grid used by all ray queries.
import { SideMap } from '../math/side';
import { Vec3, Quat, quat } from '../math/vec';
import { WORLD } from './world';
import { makeBuffer, writeWordsIfChanged } from '../gpu/device';
import { CutPlane, CutGlass, cutConfig, cutClip, CUT_CLIP, packCut, CUT_STRIDE, BOX_CUT_BIT, MAX_CUT_PLANES } from './cut';
import { AIR_ROWS } from './airGrid';
import { roundConfig, packRoundRows, ROUND_CORE_W } from './round';
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
  // A THIN THING THAT STANDS FREE (scene/thin.ts thinLevel, as a level is stood up: a stovepipe, a window's bar, a lone post). CPU-only, like SoundSeal (bits
  // 18-31 of the GPU word are the marking row): the fog of war's own sight passes it while FOG.thin is on (game/fogofwar.ts: segmentBlocked's `through`; a teammate's own eye too under FOG.mates — game/guards.ts eyeThrough), and
  // the picture's fog eye learns which boxes carry it from the sight table's own bit list (render/fogofwar.ts FogFrame.thinBits), not from the box's word.
  Thin: 1 << 18,
  // A WINDOW'S BAR (scene/bars.ts barLevel, as a level is stood up: the kit's upright between a window's bays). CPU-only, like Thin: a round that meets one
  // breaks it and a line of fire passes one while WINBARS.on is up (game/winbars.ts; collision.ts shotBlocked's `firePass`); read by nothing else.
  Bar: 1 << 19,
} as const;
/** the most panes SceneInfo.glass carries to the GPU (nearest to the camera's look-at first when a level has more) */
export const MAX_GLASS = 32;
/** the GPU flag bit of a ROUND box (common.wgsl GEO_ROUND; scene/round.ts). Bit 3 of the geo flags word, which on the CPU is Dynamic: no shader reads that one, and
 *  with the round's GPU half up it is not sent (BoxWorld.packBox). */
export const BOX_ROUND_BIT = 8;

export interface Box {
  c: Vec3;            // center
  h: Vec3;            // half extents (local axes)
  yaw: number;        // rotation about +Y (radians)
  albedo: Vec3;       // linear diffuse reflectance
  emissive: Vec3;     // emitted radiance (linear, HDR)
  flags: number;
  owner: number;      // 0 = world, 1..255 = character id (rays from a character skip its own proxies)
  cutHeight: number;  // world Y above which the box is hidden from primary visibility when Cutaway
  /** RENDER-ONLY albedo factor (absent = 1): what the renderer packs is albedo × wetK, while `albedo` itself — which the simulation reads (a round's material by
   *  its paint, destruction's index by shape and tone) — stays as authored. weather.ts darkens rained-on ground with it. */
  wetK?: number;
  /** optional full 3D orientation (unit quaternion, world) for the few things that tilt: hand props, goggles, spark streaks, tumbling
   *  canisters. Raster and rays both honour it (BoxFlag.Rot is set on upload; the grid footprint and CPU picking use it too); `yaw`
   *  should still hold the heading for CPU code that only cares about that. Absent = yaw about +Y as always. */
  rot?: Quat;
  /** DRAWN ELSEWHERE (game/stature.ts — a man drawn a few per cent taller or shorter takes the kit bolted to him along): the centre and half extents the GPU is handed for this box —
   *  its geo words and its trace-grid registration — in place of c / h. The simulation's box (CPU ray casts, picking, everything that reads c / h) stays where it is. Dynamics only;
   *  absent = c / h, as ever. */
  dc?: Vec3; dh?: Vec3;
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
  /** THE PICTURE'S EMISSION, where it is not the box's own (render-only: game/fogofwar.ts FOG.kept — a lamp's face under the fog of war as the team last saw
   *  it, lit or dark): the upload takes these in place of `emissive` / `markGain`; nothing in the game reads them, and `emissive` itself stays the lamp's real
   *  state. Absent = the box's own. Read only: several boxes may be handed one array */
  fogEmit?: Readonly<Vec3>; fogMark?: number;
  /** MOTION IDENTITY (renderer v3, image-quality program E1): a key that names THIS part of THIS object across frames — a door's leaf, a chair's seat, a flying
   *  can's band, the torch in a man's hand (MKEY ranges below; the code that emits the box sets it). With it the g-buffer's motion vector for the box comes from
   *  the transform the SAME part had a frame ago wherever it sat in the dynamic list; without it (sparks, tracers, one-frame effects) the old rule stands: the
   *  box at the same INDEX a frame ago, accepted only if its half-extents and owner match. Statics never need one. */
  mkey?: number;
  /** THE CUT RECORD (scene/cut.ts — read its head): up to MAX_CUT_PLANES planes in this box's LOCAL frame, each keeping the side n · p ≤ d, that clip the box into a
   *  wedge, a shard, a snapped end. Under the switch (cutConfig.on) the raster draws the cut solid and every ray — GPU and CPU — meets it; what pushes against the box
   *  (collision, nav, debris contact) still meets the uncut box. Off, or absent / empty: the plain box. Build it with cut.ts cutRecord / cutPrism (normals unit, no
   *  redundant planes) and REPLACE the array to change a static's cut (the pack shadow compares its identity, as it does `marks`). */
  cut?: CutPlane[];
  /** the CORE colour: what this box's CUT faces show in the picture (white gypsum under paint, pale wood under varnish), matte. Absent = the box's own colour and
   *  finish. Read only with a record under the switch, and packed WITH the record: on a static, replace `cut` when you change it. The box's own six faces, and every
   *  ray that lands on a cut face (bounce, reflections), keep the box's own colour. */
  cutCore?: Vec3;
  /** GLASS (cut.ts CutGlass): this cut box's two z faces are drawn see-through inside a rim in the core colour. Picture only; packed with the record, like cutCore. */
  cutGlass?: CutGlass;
  /** ROUND (scene/round.ts — read its head): this box is a ROUND THING, the cylinder about its own y of radius h[0] (= h[2]) and half height h[1]. Every CPU ray
   *  and segment (rayBox, collision.ts lineBox) and what walks against it (collideCircle) meet the cylinder; with roundConfig.gpu so do the picture (the cut pass)
   *  and every GPU ray. Set by round.ts roundLevel as a level is stood up; never with a cut record. */
  round?: boolean;
  /** what round.ts roundLevel made this box FROM (the kit's slab as the level file has it): its centre, half extents, flags and marks, put back when the level is
   *  stood up with the switch down, and what the level's fingerprint is taken over */
  was?: { c: Vec3; h: Vec3; yaw: number; flags: number; marks?: MarkingDef[] };
}
/** MKEY ranges (Box.mkey): the system in the top byte, its own numbering below — doors (index × 4 + part), props (id × 16 + part), items (serial × 8 + part), the
 *  rig props on a character (owner << 8 | ordinal this frame; the owner-0 lasers stay unkeyed), devices (ordinal over the frame's device boxes), staging / QA boxes
 *  (`test`; `ring` reserved — the launcher's rings stay on the index rule). Two boxes with one key in a frame = the last registered wins; the index space needs
 *  maxBoxes ≤ 65534 (the visible word keeps 1 + index in 16 bits, 0xFFFF = new).
 *  `look` is more than a motion identity: a box keyed in its byte is PICTURE ONLY for the CPU's world ray whatever its flags say (BoxWorld.raycast, lookKeyed
 *  below) — key nothing there that a cursor, an order, a laser or a tripwire should land on. */
export const MKEY = { door: 1 << 24, prop: 2 << 24, item: 3 << 24, rig: 4 << 24, device: 5 << 24, ring: 6 << 24, test: 7 << 24, debris: 8 << 24, look: 9 << 24 } as const;   // debris: the destruction lane's rigid chunks (game/debris.ts), keyed off their serial · look: what a broken wall looks like where it broke (game/edgeLook.ts: plates, lintels, rubble)
/** a LOOK piece (keyed MKEY.look): drawn and lit, in no collision list — a round, an eye and a boot pass through it. Most are NoShadow; under the cut switch the
 *  bigger ones drop that flag so LIGHT's rays meet them and they cast the shadow they draw, which would also hand them to the CPU's ray: this is how it tells */
const lookKeyed = (b: Box): boolean => b.mkey !== undefined && b.mkey >>> 24 === MKEY.look >>> 24;

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
/** GLASS BREAKING (game/glassbreak.ts): a per-pane fracture record in the tail of matBuf AFTER the marking table — GB_STRIDE vec4 rows per SceneInfo.glass slot (4 header
 *  rows: site count, flags, u axis, damage · hu hv type · the dice wave · the dice grid; then 8 sites × 4 rows: place + ring zone · radials + seed + energy + merge · chord
 *  radii · open-piece masks, 12 bits a band, two bands a float — glassbreak.ts fill() is the layout's one writer), read by common.wgsl glassCellOpen and composite's crack drawing only under the prelude
 *  const GLASS_BREAK (render/frame.ts glassBreakConfig; common.wgsl GB_BASE = MARK_BASE + MARK_TABLE_ROWS). The rows exist (zero) whatever the switch: a bigger buffer
 *  is not a different frame. */
export const GB_STRIDE = 36, GB_ROWS = MAX_GLASS * GB_STRIDE;
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
  return e === 0 ? s * m * 5.9604644775390625e-8 : e === 31 ? (m ? NaN : s * Infinity) : s * (1 + m / 1024) * Math.pow(2, e - 15);
}

export class BoxWorld {
  statics: Box[] = [];
  dynamics: Box[] = [];
  /** PICTURE ONLY, the renderer's own: dynamic boxes left out of the RASTER this frame (still packed, still what every reader of the list sees, never written) — the squad's
   *  weapon lasers while composite draws them as light in the air (engine.ts ← passes.setBeams, settings.beamAir). null = none, the list drawn as ever. */
  hidePrimary: Set<Box> | null = null;
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
  /** the cell table as last uploaded, bit for bit (packGlass writes the buffer only when the freshly filled table differs from it) */
  private gbSent = new Uint32Array(GB_ROWS * 4); private gbBits = new Uint32Array(this.gbData.buffer);
  /** THE AIR GRID (scene/airGrid.ts; game/airDust.ts is its writer): the weather's dust share per plan cell, in matBuf's tail after the marking and glass
   *  tables and BEFORE the cut table (so its place does not move with the cut switch) — AIR_ROWS vec4 rows read by common.wgsl wxIndoor under the prelude's WX_VOL. Written only when handed a changed grid. */
  setAirGrid(cells: Float32Array) {
    this.device.queue.writeBuffer(this.matBuf, this.maxBoxes * MAT_STRIDE * 4 + MARK_TABLE_ROWS * 16 + GB_ROWS * 16, cells.buffer, cells.byteOffset, Math.min(cells.byteLength, AIR_ROWS * 16));
  }
  /** how many statics' geo + mat rows the last WHOLE write of the two buffers covered (−1 = none yet): upload() writes only the dynamics' tail while they still stand */
  private rowsStatN = -1;
  /** the visible list as last uploaded, word for word */
  private visibleSent: Uint32Array;
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
  rig: { r0: Float32Array; r1: Float32Array; kPad: number; byOwner?: Map<number, { r0: Float32Array; r1: Float32Array; pad?: number }> } | null = null;
  static readonly RB_QUANT = 0.001;   // = render/sdfrig.ts RB_QUANT (shaders/sdfrig.wgsl coneRb decodes it)
  visible: Uint32Array; visibleCount = 0; visibleBuf: GPUBuffer;
  staticsDirty = true;
  /** bumped by game/wallbreak.ts whenever a static was appended, re-shaped in place or cut off at runtime (a holed wall's pieces): upload() re-packs changed statics by
   *  itself; a host that mirrors the statics elsewhere (the native engine's acceleration structure) folds this into its static serial */
  geomSerial = 0;
  // ---- THE STATIC SLICE, PACKED ONCE (the CPU-frame lane, docs/internal/cpu-frame.md): the 782 statics used to be re-packed every frame — 4 trig calls, an f16 pack, matWord,
  // the marking slot lookup a box — for words that never change. Now every static's PACK INPUTS (centre, yaw, halves, flags, owner, albedo, emissive, cutHeight, the finish, the
  // marking gain, the rotation, the marking list's identity + length) are shadowed per INDEX in `statShadow`, and a box whose inputs read equal to its shadow keeps the words it
  // packed before (the geo / mat arrays are written only by this class); anything else — a hidden static, a dimmed fixture, a moved editor box, a replaced Box object with other
  // values — is repacked on the spot. Writers need raise no flag: the compare IS the truth (~25 field reads a box, a few µs for the office). What is not per box is an EPOCH:
  // the marking table's state (a list registered / repacked / the table reset) and the markings switch — `packEpoch` bumps and every static repacks. Bytes: identical by
  // construction (the pack is a pure function of the shadowed inputs), proven by tools/cpu-frame/tables-hash.ts against the pre-lane recording.
  private static readonly SS = 24;   // shadow floats per static: c0 c1 c2 yaw h0 h1 h2 flags owner a0 a1 a2 e0 e1 e2 cutHeight matWord markGain hasRot r0 r1 r2 r3 marksLen
  private statShadow = new Float64Array(0);
  private statShadowMarks: (MarkingDef[] | undefined)[] = [];
  private statMarked = new Uint8Array(0);   // per static: it counted toward markStatsInfo.boxes when last packed
  private statShadowN = 0;                  // statics the shadow covers (0 = nothing packed yet)
  private packEpoch = 0; private statEpoch = -1; private statMarksOn = true;
  /** the trace grid (buildGrid: cells / items / globals / SceneInfo's grid rows) — false = not built and not uploaded (the native host: its RT walks its own BLAS and reads none of
   *  it; the smoke obstacle bake reads region A once per change — its caller sets this); the CPU raycast has its own static grid (rayGrid) and works either way. Default true. */
  gridEnabled = true;
  // the static half of the trace grid, cached: per static its cell range + quantised height (as buildGrid computes them), the mask bits, its global-ness and its slack, rebuilt only
  // when a static's pack inputs changed (the shadow above says so) — buildGrid then scatters statics from the cache and computes dynamics as before
  private gridStatRanges = new Int32Array(0);   // per static: x0 x1 z0 z1 qmin qmax (x0 −1 = not in the grid; −2 = a global)
  private gridStatBits = new Uint32Array(0);
  private gridStatSlack = 0; private gridStatN = -1; private gridStatGlobals: number[] = []; private gridDynBits = new Uint32Array(1);
  // … and the statics' own scatter (per cell: how many statics are registered in it, their slice bits OR-ed), made with that cache: a build starts from a copy of these two
  private gridStatCounts = new Uint32Array(WORLD.gridW * WORLD.gridH); private gridStatMask = new Uint32Array(WORLD.gridW * WORLD.gridH);
  // THE LAST BUILD'S DYNAMIC HALF: per dynamic x0 x1 z0 z1 qmin qmax bits (x0 −1 = not in the grid) + the globals list + the list's length. A frame whose statics' cache stands and
  // whose dynamics register exactly as these did would build the same cells and items word for word — it builds nothing and writes neither buffer (gridLiveN −1 = no build stands)
  private gridLast = new Int32Array(0); private gridLastGlobals: number[] = []; private gridLiveN = -1;
  /** how many frames' trace grids were built, and how many were found standing (QA / the panel) */
  gridBuilds = { built: 0, kept: 0 };
  // ---- THE CPU RAYCAST's OWN GRID over the statics (rayGrid — the CPU-frame lane): raycast() used to test every box in `all` (~1100) per ray, three rays a frame in the calm office
  // (two laser tripwires + the cursor's aim ray) — a quarter of Game.update. Now the STATIC prefix of `all` (as of the last upload) is walked through a 2D DDA over WORLD's 1 m
  // cells, testing only the statics registered in each cell (once per ray — a stamp), the few too big for the grid or reaching outside it once per ray as GLOBALS, and the
  // dynamics (the tail of `all`) by the same brute force as before. Every static is registered whatever its flags (skipFlags are judged per query exactly as the brute force did:
  // a static hidden by destruction and restored later is findable; a pane IS a hit unless the caller skips Glass), padded RAY_PAD each side so a face on a cell line is in
  // both cells. The per-box test (rayBox with the running best as tmax) is unchanged, so a hit's t and normal are the same bits; the candidate SET is what shrank. The one
  // rule the brute force had that a walk does not is 'first index wins a tie', kept explicitly (r.t === best && i < bi). Rebuilt in upload() when the static prefix changed
  // (the pack shadow's signal or the count); tools/cpu-frame/raycast-diff.ts is the differential proof (10⁵ random + axis-aligned rays: hit index, t and normal identical).
  static readonly RAY_PAD = 1e-3;
  private rgStart = new Uint32Array(WORLD.gridW * WORLD.gridH + 1); private rgItems = new Uint32Array(4096); private rgGlobals: number[] = [];
  private rgN = -1;   // statics the ray grid covers (= the static prefix of `all` at its build; −1 = never built)
  private rgFill = new Uint32Array(WORLD.gridW * WORLD.gridH); private rgRanges = new Int32Array(0);
  private rgStamp = new Uint32Array(0); private rgRay = 0;
  private rcBest = 0; private rcBi = -1; private rcBn: Vec3 = [0, 1, 0];
  /** A RAY ASKED BY THE PICTURE (the cursor's pick under a HUD read — game/orders.ts hover): `fn` with the ray grid's stamps the asker's own (`own.w`, kept
   *  between asks) and the last ray's scratch put back after, so it writes nothing a snapshot of the game holds. Not to be nested. */
  rayAside<T>(own: { w?: object }, fn: () => T): T {
    type Q = { stamp: Uint32Array<ArrayBuffer>; ray: number };
    let q = own.w as Q | undefined; if (!q || q.stamp.length < this.rgStamp.length) q = { stamp: new Uint32Array(this.rgStamp.length), ray: 0 };   // (boxes added since: an empty table is a clean one)
    const mine = { stamp: this.rgStamp, ray: this.rgRay, best: this.rcBest, bi: this.rcBi, bn: this.rcBn };
    this.rgStamp = q.stamp; this.rgRay = q.ray; own.w = undefined;   // (an ask inside this one on the same store makes a table of its own: this one's ray ids are in use)
    try { return fn(); }
    finally { own.w = { stamp: this.rgStamp, ray: this.rgRay } satisfies Q; this.rgStamp = mine.stamp; this.rgRay = mine.ray; this.rcBest = mine.best; this.rcBi = mine.bi; this.rcBn = mine.bn; }
  }
  /** the ray grid's shape, for the panel / the differential test */
  rayGridStats = { statics: 0, globals: 0, items: 0 };
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
  private markOfBox = new SideMap<Box, { key: string; slot: number; sec: Vec3; a0: number; a1: number; a2: number; marks: MarkingDef[] }>();
  markStatsInfo = { lists: 0, records: 0, rows: 0, boxes: 0, dropped: 0, uploads: 0 };
  // ---- CUT BOXES (scene/cut.ts): under the switch (latched here at construction — the shaders were compiled from the same value) a box with a cut record raises
  // BOX_CUT_BIT in its GPU flags word and its planes are packed into the CUT TABLE, a third tail region of matBuf after the marking and glass tables: CUT_STRIDE vec4
  // rows per box INDEX (common.wgsl CUT_BASE + bi × CUT_STRIDE: the planes, then the core colour's row), uploaded over the index range packed this frame. Cut boxes are listed AFTER the plain ones in
  // `visible` ([visibleCount, visibleCount + visibleCutCount)): the g-buffer draws them with its cut pipeline. Switch off = none of it exists: no bit, no table, no
  // second list — the words and the buffer of the build without it.
  readonly cutOn: boolean;
  /** ROUND THINGS (scene/round.ts): the GPU's half is up — a round box carries GEO_ROUND in its flags word (bit 3: the CPU's Dynamic, which no shader reads), its
   *  prism's planes in its rows of the cut table (for the cut pass alone: no BOX_CUT_BIT, no ray reads them), and it is drawn from the cut list's picture-only end
   *  (cut always: every ray program holds the round rule from boot). Needs the cut switch, whose table and pipeline these are. */
  readonly roundOn: boolean;
  private cutData = new Float32Array(0);
  private cutLo = 1 << 30; private cutHi = -1; private cutLoD = 1 << 30; private cutHiD = -1; private cutSplit = 0;   // the rows packed this frame, as two index ranges: the statics' (below cutSplit) and the dynamics'
  /** how many of this frame's visible boxes are cut (they follow the plain ones in `visible`) */
  visibleCutCount = 0;
  /** how many of those — the FIRST ones of the cut list — a ray can meet (not NoShadow). The g-buffer draws exactly these whole on a frame whose ray programs carry
   *  no cut rule (render/cutSwap.ts drawsCut), so picture and rays agree; the picture-only ones behind them (glass plates) are drawn cut always */
  visibleCutTraced = 0;
  /** how many boxes of the last upload carry a record AND can be met by a ray (not NoShadow: a glass plate is picture only) — what render/cutSwap.ts takes the cut
   *  programs by: 0 = the frame runs the boot's programs, which have no cut rule */
  cutTraced = 0;
  private cutVisible = new Uint32Array(0);
  private statShadowCut: (CutPlane[] | undefined)[] = [];
  /** the boxes carrying a record in the last uploaded list, and their planes (counted when asked: the debug hook's and the probes' number) */
  get cutStats(): { boxes: number; planes: number } {
    let boxes = 0, planes = 0;
    if (this.cutOn) for (const b of this.all) { const c = b.cut; if (c !== undefined && c.length > 0) { boxes++; planes += Math.min(c.length, MAX_CUT_PLANES); } }
    return { boxes, planes };
  }

  constructor(private device: GPUDevice, maxBoxes = WORLD.maxBoxes) {
    this.maxBoxes = maxBoxes;
    if (maxBoxes !== WORLD.maxBoxes) throw new Error('BoxWorld: maxBoxes must be WORLD.maxBoxes (the shaders place the marking table after that many mat rows)');
    this.geoData = new ArrayBuffer(maxBoxes * GEO_STRIDE * 4); this.geoF32 = new Float32Array(this.geoData); this.geoU32 = new Uint32Array(this.geoData);
    this.matData = new Float32Array(maxBoxes * MAT_STRIDE);
    const S = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
    this.geoBuf = makeBuffer(device, maxBoxes * GEO_STRIDE * 4, S | GPUBufferUsage.COPY_SRC, 'boxGeo');   // (COPY_SRC: the g-buffer snapshots both into its 'previous frame' buffer for the motion vectors — render/gbuffer.ts snapshotPrev)
    this.cutOn = cutConfig.on; this.roundOn = this.cutOn && roundConfig.gpu;
    if (this.cutOn) this.cutData = new Float32Array(maxBoxes * CUT_STRIDE * 4);
    this.matBuf = makeBuffer(device, maxBoxes * MAT_STRIDE * 4 + MARK_TABLE_ROWS * 16 + GB_ROWS * 16 + AIR_ROWS * 16 + (this.cutOn ? maxBoxes * CUT_STRIDE * 16 : 0), S | GPUBufferUsage.COPY_SRC, 'boxMat');   // + the marking table in its tail (+ the glass-breaking cell table after it: GB_ROWS, zero unless a pane has come apart)
    if (WORLD.gridW + WORLD.gridH > 96) throw new Error('trace grid: the DDA in common.wgsl caps a ray at 96 cell visits; W + H must stay ≤ 96 for that cap to be unreachable');
    if (maxBoxes > 65536 || maxBoxes * WORLD.gridW * WORLD.gridH >= 1 << 24) throw new Error('trace grid: packed items keep the box index in 16 bits and cell starts in 24');
    this.cellStart = new Uint32Array(WORLD.gridW * WORLD.gridH + 1 + 2 * WORLD.gridW * WORLD.gridH);
    this.items = new Uint32Array(65536);
    this.cellBuf = makeBuffer(device, this.cellStart.byteLength, S, 'gridCells');
    this.itemBuf = makeBuffer(device, this.items.byteLength, S, 'gridItems');
    this.infoBuf = makeBuffer(device, this.infoData.byteLength, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'sceneInfo');
    this.capsuleBuf = makeBuffer(device, this.capsuleData.byteLength, S, 'capsules');
    this.visible = new Uint32Array(maxBoxes); this.visibleSent = new Uint32Array(maxBoxes);
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
  /** THE BUFFERS ARE NOT WHAT THE BOOKS SAY: a rollback snapshot put back (game/rollback.ts) writes these books back with the boxes — what was sent, how many,
   *  which grid stands — while the GPU's buffers are as the abandoned moment left them. The next upload packs and writes every static, the visible list, the
   *  glass table, the marking table and both grids whole. Reads nothing of the simulation and changes none of it. */
  forgetSent() { this.packEpoch++; this.visibleSent.fill(0xffffffff); this.gbSent.fill(0xffffffff); this.gbLive = true; this.markDirty = true; this.gridLiveN = -1; this.rowsStatN = -1; }
  /** repack every registered list at a new base texel (engine.settings.markingTexel moved) or after AREA_LIT_MARKS changed (game.ts registers the lights after the first upload) */
  repackMarkings(texel = this.markingTexel) { this.markingTexel = texel; for (const ent of this.markByKey.values()) if (ent.slot) this.packList(ent); this.packEpoch++; }   // (every static repacks: the secondary albedos may have moved)
  /** how full the append-only marking table is: rows taken / MARK_TABLE_ROWS (the editor compacts past two thirds; its lint warns on a level that alone nears it) */
  get markTableFill(): number { return this.markRows / MARK_TABLE_ROWS; }
  /** Forget every registered marking list (the table is append-only: right for the game's fixed set of lists, but an editor session paints a new list per
   *  stroke). The next upload re-registers exactly the lists the boxes then carry. Returns the rows that were taken. */
  resetMarkTable(): number {
    const taken = this.markRows;
    this.markRows = 0; this.markByKey.clear(); this.markOfBox = new SideMap(); this.markDirty = true; this.packEpoch++;   // (every static repacks — and so re-registers its list)
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
  addCharacterCapsules(owner: number, albedo: Vec3 | Vec3[], caps: number[][], bound: [number, number, number, number]) {
    if (this.charCount >= 8) return;
    // (one colour for the whole man, or — character materials, render/charMaterials.ts proxyAlbedos — one per record in caps' order)
    const perCap = Array.isArray(albedo[0]) ? albedo as Vec3[] : null;
    const pack = (a: Vec3) => ((Math.round(Math.min(1, Math.max(0, a[0])) * 31) & 31) << 11) | ((Math.round(Math.min(1, Math.max(0, a[1])) * 63) & 63) << 5) | (Math.round(Math.min(1, Math.max(0, a[2])) * 31) & 31);
    const one = albedo as Vec3;
    const rgb565 = perCap ? 0 : ((Math.round(one[0] * 31) & 31) << 11) | ((Math.round(one[1] * 63) & 63) << 5) | (Math.round(one[2] * 31) & 31);
    const misc = ((owner & 0xff) | (rgb565 << 8)) >>> 0;
    const base = this.charCount * BoxWorld.CAPS_PER_CHAR;
    for (let i = 0; i < BoxWorld.CAPS_PER_CHAR; i++) {
      const c = caps[i] ?? [0, -100, 0, 0, 0, -100, 0]; const o = (base + i) * 8;
      this.capsuleData[o] = c[0]; this.capsuleData[o + 1] = c[1]; this.capsuleData[o + 2] = c[2]; this.capsuleData[o + 3] = c[3];
      this.capsuleData[o + 4] = c[4]; this.capsuleData[o + 5] = c[5]; this.capsuleData[o + 6] = c[6]; this.capsuleU32[o + 7] = perCap ? ((owner & 0xff) | (pack(perCap[i] ?? perCap[0]) << 8)) >>> 0 : misc;
    }
    const bo = 24 + this.charCount * 4; this.infoF32[bo] = bound[0]; this.infoF32[bo + 1] = bound[1]; this.infoF32[bo + 2] = bound[2]; this.infoF32[bo + 3] = bound[3];
    this.charCount++; this.capsuleCount = this.charCount * BoxWorld.CAPS_PER_CHAR;
  }
  /** Turn the frame's proxy list into the SDF rig (see `rig`): per real record (radius > 0) the fitted r0 as its radius and r1 packed above the albedo; per character the cull sphere
   *  fitted to the cones' ends + radii (+ the smooth union's pad + 1 cm) about the middle of their box. Idempotent — a render with no game step re-applies it to the same records and
   *  gets the same words (the ends are never touched, r0 / r1 come from the fit, the sphere is rebuilt from both). */
  private applyRig(base: { r0: Float32Array; r1: Float32Array; kPad: number; byOwner?: Map<number, { r0: Float32Array; r1: Float32Array; pad?: number }> }) {
    const D = this.capsuleData, U = this.capsuleU32, N = BoxWorld.CAPS_PER_CHAR;
    for (let c = 0; c < this.charCount; c++) {
      const rig = base.byOwner?.get(U[c * N * 8 + 7] & 0xff) ?? base;   // (the cast: a man's own fit by his id — the owner byte every one of his records carries — else the shared one)
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
      const bo = 24 + c * 4; this.infoF32[bo] = cx; this.infoF32[bo + 1] = cy; this.infoF32[bo + 2] = cz; this.infoF32[bo + 3] = rad + base.kPad + 0.01 + ((rig as { pad?: number }).pad ?? 0);   // (pad: a cast outfit's reach outside its cones — sdfrig.ts RigFit.pad; nothing on the mannequin)
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

  /** Rebuild combined list, pack, grid, and upload. Call once per frame after dynamics are set. `between` = a pack BETWEEN two game ticks of one drawn frame (host/loop.ts,
   *  the fixed step): everything as ever, but the motion-identity map stays the last DRAWN frame's, so the pack that is drawn still resolves 'where was this box last frame'. */
  upload(between = false) {
    const all = this.all; all.length = 0;
    for (const b of this.statics) all.push(b); for (const b of this.dynamics) all.push(b);
    if (all.length > this.maxBoxes) throw new Error(`too many boxes: ${all.length}`);
    let nv = 0, marked = 0;
    if (this.staticsDirty || this.glassStaticsN !== this.statics.length) { this.glassStatics.length = 0; for (let i = 0; i < this.statics.length; i++) if (this.statics[i].flags & BoxFlag.Glass) this.glassStatics.push(i); this.staticsDirty = false; this.glassStaticsN = this.statics.length; }
    const marksOn = this.markingsEnabled;
    const nStat = this.statics.length; let matched = 0, fresh = 0, unkeyed = 0;
    // ---- statics: packed only where the shadow says the inputs moved (see statShadow); the visible prefix rebuilt from their flags every frame (a flag test a box)
    const SS = BoxWorld.SS; let staticsChanged = false;
    if (this.statShadow.length < nStat * SS) { this.statShadow = new Float64Array(Math.max(nStat, this.maxBoxes) * SS); this.statMarked = new Uint8Array(Math.max(nStat, this.maxBoxes)); this.statShadowMarks.length = 0; this.statShadowCut.length = 0; this.statShadowN = 0; }
    const forceAll = this.statEpoch !== this.packEpoch || this.statMarksOn !== marksOn || this.statShadowN !== nStat;
    const S = this.statShadow, SM = this.statShadowMarks, SK = this.statMarked;
    const cutOn = this.cutOn, roundOn = this.roundOn, SC = this.statShadowCut; let nc = 0, nct = 0; this.cutSplit = nStat;
    let np = Math.max(this.cutVisible.length, cutOn ? this.maxBoxes : 0);   // (the cut list is filled from both ends: traceable boxes from the front, picture-only ones from the back)
    if (cutOn && this.cutVisible.length < this.maxBoxes) this.cutVisible = new Uint32Array(this.maxBoxes);
    const cv = this.cutVisible;
    for (let i = 0; i < nStat; i++) {
      const b = all[i]; const so = i * SS; const c = b.c, h = b.h, al = b.albedo, em = b.fogEmit ?? b.emissive, rot = b.rot, marks = b.marks;
      const mw = matWord(b), mg = b.fogMark ?? b.markGain ?? 1, wk = b.wetK ?? 1, ml = marks === undefined ? -1 : marks.length;
      if (!forceAll && S[so] === c[0] && S[so + 1] === c[1] && S[so + 2] === c[2] && S[so + 3] === b.yaw && S[so + 4] === h[0] && S[so + 5] === h[1] && S[so + 6] === h[2]
        && S[so + 7] === b.flags && S[so + 8] === b.owner && S[so + 9] === al[0] * wk && S[so + 10] === al[1] * wk && S[so + 11] === al[2] * wk && S[so + 12] === em[0] && S[so + 13] === em[1] && S[so + 14] === em[2]
        && S[so + 15] === b.cutHeight && S[so + 16] === mw && S[so + 17] === mg && S[so + 23] === ml && SM[i] === marks && (!cutOn || SC[i] === b.cut)
        && (rot ? S[so + 18] === 1 && S[so + 19] === rot[0] && S[so + 20] === rot[1] && S[so + 21] === rot[2] && S[so + 22] === rot[3] : S[so + 18] === 0)) {
        if (SK[i]) marked++;
      } else {
        staticsChanged = true;
        SK[i] = this.packBox(i, b, marksOn) ? 1 : 0; if (SK[i]) marked++;
        S[so] = c[0]; S[so + 1] = c[1]; S[so + 2] = c[2]; S[so + 3] = b.yaw; S[so + 4] = h[0]; S[so + 5] = h[1]; S[so + 6] = h[2]; S[so + 7] = b.flags; S[so + 8] = b.owner;
        S[so + 9] = al[0] * wk; S[so + 10] = al[1] * wk; S[so + 11] = al[2] * wk; S[so + 12] = em[0]; S[so + 13] = em[1]; S[so + 14] = em[2]; S[so + 15] = b.cutHeight; S[so + 16] = mw; S[so + 17] = mg;
        if (rot) { S[so + 18] = 1; S[so + 19] = rot[0]; S[so + 20] = rot[1]; S[so + 21] = rot[2]; S[so + 22] = rot[3]; } else { S[so + 18] = 0; S[so + 19] = 0; S[so + 20] = 0; S[so + 21] = 0; S[so + 22] = 0; }
        S[so + 23] = ml; SM[i] = marks; if (cutOn) SC[i] = b.cut;
      }
      if (cutOn && b.cut !== undefined && b.cut.length > 0 && !(b.flags & BoxFlag.NoShadow)) nct++;
      if (!(b.flags & (BoxFlag.NoPrimary | BoxFlag.Glass))) {   // (a static's word is its bare index: pslot 0 = the index rule; a pane is never rasterised)
        if (roundOn && b.round === true) cv[--np] = i;   // (ROUND THINGS: drawn by the cut pipeline, cut always — the rays' round rule is in every program)
        else if (cutOn && b.cut !== undefined && b.cut.length > 0) { if (b.flags & BoxFlag.NoShadow) cv[--np] = i; else cv[nc++] = i; } else this.visible[nv++] = i;   // (CUT BOXES: a cut static goes to the cut list, drawn by the cut pipeline)
      }
    }
    this.statEpoch = this.packEpoch; this.statMarksOn = marksOn; this.statShadowN = nStat;
    if (forceAll || staticsChanged) { this.gridStatN = -1; this.rgN = -1; this.rowsStatN = -1; }   // (the cached static half of the trace grid, and the raycast's grid, are rebuilt from these words below)
    if (this.rgN !== nStat) this.buildRayGrid(nStat);
    // ---- dynamics: packed every frame, as ever
    const hide = this.hidePrimary;
    for (let i = nStat; i < all.length; i++) {
      const b = all[i];
      if (this.packBox(i, b.dc ? BoxWorld.drawnOf(b) : b, marksOn)) marked++;
      if (cutOn && b.cut !== undefined && b.cut.length > 0 && !(b.flags & BoxFlag.NoShadow)) nct++;
      if (!(b.flags & (BoxFlag.NoPrimary | BoxFlag.Glass)) && !(hide !== null && hide.has(b))) {   // a pane is never rasterised: the G-buffer holds what stands BEHIND it and composite lays the glass over that (composite.wgsl)
        // MOTION IDENTITY: the word's top 16 bits = where the g-buffer finds this box's PREVIOUS transform — 0 = the index rule as before (statics; unkeyed dynamics; the switch off),
        // 0xFFFF = a keyed box new this frame (nothing to reproject: it did not move), else 1 + the index its key had last frame (gbuffer.wgsl vsBox)
        let pslot = 0;
        if (this.motionIds && b.mkey !== undefined) { const pi = this.mkeyPrev.get(b.mkey); if (pi === undefined) { pslot = 0xFFFF; fresh++; } else { pslot = pi + 1; matched++; } this.mkeyCur.set(b.mkey, i); }
        else unkeyed++;
        if (roundOn && b.round === true) cv[--np] = i | (pslot << 16);
        else if (cutOn && b.cut !== undefined && b.cut.length > 0) { if (b.flags & BoxFlag.NoShadow) cv[--np] = i | (pslot << 16); else cv[nc++] = i | (pslot << 16); } else this.visible[nv++] = i | (pslot << 16);
      } else if (this.motionIds && b.mkey !== undefined) this.mkeyCur.set(b.mkey, i);
    }
    if (between) this.mkeyCur.clear();
    else { const t = this.mkeyPrev; this.mkeyPrev = this.mkeyCur; this.mkeyCur = t; t.clear(); this.mkeyStats.matched = matched; this.mkeyStats.fresh = fresh; this.mkeyStats.unkeyed = unkeyed; }
    this.visibleCount = nv; this.markStatsInfo.boxes = marked;
    this.visibleCutTraced = nc; this.cutTraced = nct;
    if (cutOn) { for (let k = 0; k < nc; k++) this.visible[nv + k] = cv[k]; for (let k = np; k < cv.length; k++) this.visible[nv + nc++] = cv[k]; }   // CUT BOXES: the cut list rides behind the plain one in `visible` — the traceable ones first, then the picture-only ones
    this.visibleCutCount = nc;
    const q = this.device.queue;
    // the statics' rows are on the GPU already unless a static was (re)packed since they were last written whole (upload's shadow above) — then only the dynamics' tail goes up,
    // and the two buffers read exactly as a whole write would have left them
    if (forceAll || staticsChanged || this.rowsStatN !== nStat) {
      q.writeBuffer(this.geoBuf, 0, this.geoData, 0, all.length * GEO_STRIDE * 4);
      q.writeBuffer(this.matBuf, 0, this.matData.buffer, 0, all.length * MAT_STRIDE * 4);
      this.rowsStatN = nStat;
    } else if (all.length > nStat) {
      q.writeBuffer(this.geoBuf, nStat * GEO_STRIDE * 4, this.geoData, nStat * GEO_STRIDE * 4, (all.length - nStat) * GEO_STRIDE * 4);
      q.writeBuffer(this.matBuf, nStat * MAT_STRIDE * 4, this.matData.buffer, nStat * MAT_STRIDE * 4, (all.length - nStat) * MAT_STRIDE * 4);
    }
    if (this.markDirty) { q.writeBuffer(this.matBuf, this.maxBoxes * MAT_STRIDE * 4, this.markData.buffer, 0, Math.max(1, this.markRows) * 16); this.markDirty = false; this.markStatsInfo.uploads++; }   // the marking table (its tail region), only when a list was registered / repacked
    writeWordsIfChanged(this.device, this.visibleBuf, 0, this.visible, this.visibleSent, nv + nc);   // (the visible list is index words: the same until a box comes, goes or changes its flags; CUT BOXES: the cut list rides behind it)
    if (cutOn) {   // CUT BOXES: the rows packed this frame — the statics that changed and the dynamics, a range each (a re-cut wall far below the debris uploads its own rows, not everything between)
      const base = this.maxBoxes * MAT_STRIDE * 4 + MARK_TABLE_ROWS * 16 + GB_ROWS * 16 + AIR_ROWS * 16;   // (the cut table is boxMat's LAST region: after the weather's air grid)
      if (this.cutHi >= this.cutLo) { const o = this.cutLo * CUT_STRIDE * 16; q.writeBuffer(this.matBuf, base + o, this.cutData.buffer, o, (this.cutHi - this.cutLo + 1) * CUT_STRIDE * 16); this.cutLo = 1 << 30; this.cutHi = -1; }
      if (this.cutHiD >= this.cutLoD) { const o = this.cutLoD * CUT_STRIDE * 16; q.writeBuffer(this.matBuf, base + o, this.cutData.buffer, o, (this.cutHiD - this.cutLoD + 1) * CUT_STRIDE * 16); this.cutLoD = 1 << 30; this.cutHiD = -1; }
    }
    this.packGlass();
    this.buildGrid();
  }
  /** a dynamic box as the GPU gets it when the game draws it somewhere else than the simulation has it (Box.dc / dh): a copy at the drawn centre and size */
  private static drawnOf(b: Box): Box { return { ...b, c: b.dc!, h: b.dh ?? b.h }; }
  /** box i's geo + mat words (the pack proper — statement for statement what upload's one loop did per box; returns whether it counted as marked) */
  private packBox(i: number, b: Box, marksOn: boolean): boolean {
    const gf = this.geoF32, gu = this.geoU32, mf = this.matData; const o = i * GEO_STRIDE; let marked = false;
    const round = this.roundOn && b.round === true;   // (round wins over a cut record, here as in rayBox and lineBox: nothing gives a round box one)
    let flags = (b.flags & (this.roundOn ? 0xf7 : 0xff)) | (round ? BOX_ROUND_BIT : 0) | ((b.owner & 0xff) << 8) | (b.rot ? BoxFlag.Rot : 0) | (b.flags & BoxFlag.Glass);   // GPU word: flag bits 0-7, owner byte 8-15 (boxOwner() in common.wgsl), Glass at bit 17 (the one CPU flag ≥ 1<<16 that is passed through: BOX_GLASS), the marking slot in 18-31 (below); everything else up there is CPU-only and never reaches the GPU
    const em = b.fogEmit ?? b.emissive;   // (the picture's emission: Box.fogEmit)
    if (em[0] + em[1] + em[2] > 0) flags |= BoxFlag.Emissive;
    const wk = b.wetK ?? 1;   // (render-only: see Box.wetK)
    let s0 = b.albedo[0] * wk, s1 = b.albedo[1] * wk, s2a = b.albedo[2] * wk;   // the secondary albedo (4th mat row): the albedo itself unless markings fold in
    if (marksOn && b.marks !== undefined && b.marks.length > 0 && !b.rot) {   // (a tilted box never carries markings: the face frame assumes yaw only)
      const mk = this.markSlotOf(b);
      if (mk.slot > 0 && mk.slot <= MARK_SLOT_MAX) { flags |= mk.slot << MARK_SLOT_SHIFT; s0 = mk.sec[0] * wk; s1 = mk.sec[1] * wk; s2a = mk.sec[2] * wk; marked = true; }
    }
    const cutRows = round || (this.cutOn && b.cut !== undefined && b.cut.length > 0);
    if (round) {   // ROUND THINGS: the picture's prism in this index's rows of the cut table (no cut bit: a ray meets the cylinder — common.wgsl isectBox)
      const q = i * CUT_STRIDE * 4; packRoundRows(this.cutData, q, b.h[0]); this.cutData[q + 32] = 0; this.cutData[q + 33] = 0; this.cutData[q + 34] = 0; this.cutData[q + 35] = ROUND_CORE_W;
    } else if (cutRows) {   // CUT BOXES: the flag bit + this index's rows of the cut table (uploaded by upload() over the packed range)
      flags |= BOX_CUT_BIT; packCut(b.cut!, this.cutData, i * CUT_STRIDE * 4, b.cutCore, b.cutGlass);
    }
    if (cutRows) { if (i < this.cutSplit) { if (i < this.cutLo) this.cutLo = i; if (i > this.cutHi) this.cutHi = i; } else { if (i < this.cutLoD) this.cutLoD = i; if (i > this.cutHiD) this.cutHiD = i; } }
    gf[o] = b.c[0]; gf[o + 1] = b.c[1]; gf[o + 2] = b.c[2]; gu[o + 3] = pack2x16f(Math.cos(b.yaw), Math.sin(b.yaw));
    gf[o + 4] = b.h[0]; gf[o + 5] = b.h[1]; gf[o + 6] = b.h[2]; gu[o + 7] = flags >>> 0;
    const m = i * MAT_STRIDE;
    mf[m] = b.albedo[0] * wk; mf[m + 1] = b.albedo[1] * wk; mf[m + 2] = b.albedo[2] * wk; mf[m + 3] = b.cutHeight;
    mf[m + 4] = em[0]; mf[m + 5] = em[1]; mf[m + 6] = em[2]; mf[m + 7] = matWord(b);   // (the finish: read through common.wgsl boxFinish by the g-buffer / reflect.wgsl — every other shader ignores the word, as it ignored the owner that sat here)
    if (b.rot) { mf[m + 8] = b.rot[0]; mf[m + 9] = b.rot[1]; mf[m + 10] = b.rot[2]; mf[m + 11] = b.rot[3]; }
    else { const s2 = Math.sin(b.yaw / 2), c2 = Math.cos(b.yaw / 2); mf[m + 8] = 0; mf[m + 9] = s2; mf[m + 10] = 0; mf[m + 11] = c2; }   // yaw about +Y (local +X → (cos, 0, −sin), +Z → (sin, 0, cos): the same convention as the packed yaw the rays use)
    mf[m + 12] = s0; mf[m + 13] = s1; mf[m + 14] = s2a; mf[m + 15] = b.fogMark ?? b.markGain ?? 1;   // secondary albedo + the marking emission gain (game/lighting.ts drives it with the switchable's supply)
    return marked;
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
      if (any || this.gbLive) {   // (… and only when the table is not what the buffer already holds: a broken pane's rows stand still between blows, and the list's order between camera moves)
        const now = this.gbBits, sent = this.gbSent; let same = true;
        for (let w = 0; w < now.length; w++) if (now[w] !== sent[w]) { same = false; break; }
        if (!same) { this.device.queue.writeBuffer(this.matBuf, this.maxBoxes * MAT_STRIDE * 4 + MARK_TABLE_ROWS * 16, gb.buffer, 0, gb.byteLength); sent.set(now); }
      }
      this.gbLive = any;
    }
  }

  /** the trace-grid registration of one box (buildGrid's per-box arithmetic, verbatim): its cell range + quantised padded height into `ranges` at r, the mask bits, and its
   *  contribution to the registration slack; −1 = out of the grid / no cells / a pane / NoShadow, −2 = it wants to be a GLOBAL (the caller decides by the 16 cap) */
  private gridRegister(i: number, b: Box, ranges: Int32Array, r: number, bitsOut: Uint32Array, bi: number, canGlobal: boolean): number {
    const W = WORLD.gridW, H = WORLD.gridH, cs = WORLD.gridCell, pad = WORLD.gridYPad;
    if (b.flags & (BoxFlag.NoShadow | BoxFlag.Glass)) { ranges[r] = -1; return 0; }   // (a pane is never in the trace grid, on or off, intact or broken: no traced ray meets glass — SceneInfo.glass is where the shaders find it)
    const [ex, ez] = BoxWorld.footprint(b);
    let slack = 0;
    if (!b.rot) {
      const rot = this.geoU32[i * GEO_STRIDE + 3]; const c = Math.abs(f16value(rot & 0xffff)), s = Math.abs(f16value(rot >>> 16));
      if (c !== 0 && s !== 0) { const det = c * c + s * s; slack = Math.max(slack, (c * b.h[0] + s * b.h[2]) / det - ex, (s * b.h[0] + c * b.h[2]) / det - ez); }   // (axis-aligned: c, s ∈ {0, 1} exactly, no slack)
    }
    let x0 = Math.floor((b.c[0] - ex) / cs), x1 = Math.floor((b.c[0] + ex) / cs);
    let z0 = Math.floor((b.c[2] - ez) / cs), z1 = Math.floor((b.c[2] + ez) / cs);
    x0 = Math.max(0, x0); z0 = Math.max(0, z0); x1 = Math.min(W - 1, x1); z1 = Math.min(H - 1, z1);
    if (x1 < x0 || z1 < z0) { ranges[r] = -1; return slack; }
    const area = (x1 - x0 + 1) * (z1 - z0 + 1);
    if (area > 96 && canGlobal) { ranges[r] = -2; return slack; }
    ranges[r] = x0; ranges[r + 1] = x1; ranges[r + 2] = z0; ranges[r + 3] = z1;
    // padded, quantised height extent (the y-cull compares these against the ray's remaining height span; the pad covers every rounding
    // difference between this f64 build and the tracer's f32 arithmetic many times over) and the 24 coarse slices it touches
    const ey = BoxWorld.heightExtent(b);
    const qmin = BoxWorld.yLevel(b.c[1] - ey - pad), qmax = BoxWorld.yLevel(b.c[1] + ey + pad);
    ranges[r + 4] = qmin; ranges[r + 5] = qmax;
    const s0 = Math.floor(qmin / 10), s1 = Math.floor(qmax / 10);
    bitsOut[bi] = ((0xffffff >>> (23 - (s1 - s0))) << s0) >>> 0;
    return slack;
  }

  private buildGrid() {
    const W = WORLD.gridW, H = WORLD.gridH, N = W * H, CB = N + 1;
    const all = this.all; const nStat = this.statics.length;
    if (!this.gridEnabled) { this.gridLiveN = -1; this.finishInfo(0); return; }
    const counts = this.cellStart;
    const mask = this.gridMask;
    this.globals.length = 0;
    if (this.gridRanges.length < all.length * 6) this.gridRanges = new Int32Array(Math.max(all.length, this.maxBoxes) * 6);
    const ranges = this.gridRanges; // per DYNAMIC box: x0,x1,z0,z1 (cell coords; x0 = -1 → not in the grid), qmin, qmax (the statics' are gridStatRanges)
    // Registration slack: how far (m) the box the GPU actually traces can reach outside the footprint it is registered with. Yawed boxes are
    // intersected with the f16 cos/sin packed above — not quite orthonormal — so their traced outline is the footprint scaled by up to
    // ~1 + 2⁻¹⁰ (millimetres on a car); measured here per build from the very bits the shader unpacks. Plus WORLD.gridJitter for the f32
    // rounding of centres, half sizes and ray-relative offsets. The height cull looks this far back across the cell line it just crossed
    // (common.wgsl gridCell callers), which is what keeps it exact for a ray grazing such a sliver.
    // ---- the statics' half, from the cache (rebuilt when any static's pack inputs moved — upload's shadow — or the count changed): the same words gridRegister
    //      would compute this frame, since nothing they depend on changed; the globals among them come first (index order), as they always did
    let same = this.gridLiveN === all.length;
    this.gridLiveN = -1;   // (no build stands until this one is whole on the GPU, or found to be the standing one: an upload that throws part way leaves the next frame a full build)
    if (this.gridStatN !== nStat) {
      if (this.gridStatRanges.length < nStat * 6) { this.gridStatRanges = new Int32Array(Math.max(nStat, this.maxBoxes) * 6); this.gridStatBits = new Uint32Array(Math.max(nStat, this.maxBoxes)); }
      const SR = this.gridStatRanges, SB = this.gridStatBits, SG = this.gridStatGlobals; SG.length = 0; let sl = 0;
      for (let i = 0; i < nStat; i++) { sl = Math.max(sl, this.gridRegister(i, all[i], SR, i * 6, SB, i, SG.length < 16)); if (SR[i * 6] === -2) { SG.push(i); SR[i * 6] = -1; } }
      this.gridStatSlack = sl; this.gridStatN = nStat;
      const SC = this.gridStatCounts, SK = this.gridStatMask; SC.fill(0); SK.fill(0);
      for (let i = 0; i < nStat; i++) {
        const r = i * 6; const x0 = SR[r]; if (x0 < 0) continue;
        const x1 = SR[r + 1], z0 = SR[r + 2], z1 = SR[r + 3]; const bits = SB[i];
        for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { SC[z * W + x]++; SK[z * W + x] |= bits; }
      }
      same = false;
    }
    let slack = this.gridStatSlack;
    const SR = this.gridStatRanges;
    for (const gi of this.gridStatGlobals) this.globals.push(gi);
    // ---- the dynamics, registered afresh every frame — and held against the last build's (gridLast): cell range, height levels and slice bits per box, and who is a global
    const nDyn = all.length - nStat;
    if (this.gridDynBits.length < nDyn) this.gridDynBits = new Uint32Array(Math.max(nDyn, this.maxBoxes));
    if (this.gridLast.length < nDyn * 7) { this.gridLast = new Int32Array(Math.max(nDyn, this.maxBoxes) * 7); same = false; }
    const dynBits = this.gridDynBits, L = this.gridLast;
    for (let i = nStat; i < all.length; i++) {
      const b = all[i]; const r = i * 6, d = i - nStat, l = d * 7;
      slack = Math.max(slack, this.gridRegister(i, b.dc ? BoxWorld.drawnOf(b) : b, ranges, r, dynBits, d, this.globals.length < 16));
      const x0 = ranges[r]; if (x0 === -2) { this.globals.push(i); ranges[r] = -1; }
      if (ranges[r] < 0) { if (L[l] !== -1) { same = false; L[l] = -1; } continue; }
      const bits = dynBits[d] | 0;
      if (L[l] !== x0 || L[l + 1] !== ranges[r + 1] || L[l + 2] !== ranges[r + 2] || L[l + 3] !== ranges[r + 3] || L[l + 4] !== ranges[r + 4] || L[l + 5] !== ranges[r + 5] || L[l + 6] !== bits) {
        same = false; L[l] = x0; L[l + 1] = ranges[r + 1]; L[l + 2] = ranges[r + 2]; L[l + 3] = ranges[r + 3]; L[l + 4] = ranges[r + 4]; L[l + 5] = ranges[r + 5]; L[l + 6] = bits;
      }
    }
    { const G = this.globals, LG = this.gridLastGlobals;
      if (LG.length !== G.length) same = false; else for (let k = 0; k < G.length; k++) if (LG[k] !== G[k]) { same = false; break; }
      if (!same) { LG.length = G.length; for (let k = 0; k < G.length; k++) LG[k] = G[k]; } }
    if (same) {   // the grid the two buffers hold IS this frame's: only the info block (slack, globals' bounds, the capsules) is this frame's own
      this.gridLiveN = all.length; this.gridStats.slack = slack + WORLD.gridJitter; this.gridBuilds.kept++;
      this.finishInfo(this.itemCount);
      return;
    }
    this.gridBuilds.built++;
    counts.set(this.gridStatCounts); counts[N] = 0; mask.set(this.gridStatMask);
    for (let i = nStat; i < all.length; i++) {
      const r = i * 6; const x0 = ranges[r]; if (x0 < 0) continue;
      const x1 = ranges[r + 1], z0 = ranges[r + 2], z1 = ranges[r + 3]; const bits = dynBits[i - nStat];
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { counts[z * W + x]++; mask[z * W + x] |= bits; }
    }
    // exclusive prefix sum -> starts (region A: plain, read by the flag-off tracer and the smoke obstacle bake)
    let sum = 0; let maxPer = 0; for (let c = 0; c < N; c++) { const n = counts[c]; if (n > maxPer) maxPer = n; counts[c] = sum; sum += n; } counts[N] = sum;
    if (2 * sum > this.items.length) { this.items = new Uint32Array(Math.max(2 * sum, this.items.length * 2)); this.itemBuf.destroy(); this.itemBuf = makeBuffer(this.device, this.items.byteLength, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 'gridItems'); }
    const fill = this.gridFill; fill.fill(0); // running offsets
    const items = this.items;
    for (let i = 0; i < all.length; i++) {   // (index order: the statics from their cache, then the dynamics)
      const R = i < nStat ? SR : ranges;
      const r = i * 6; const x0 = R[r]; if (x0 < 0) continue; const x1 = R[r + 1], z0 = R[r + 2], z1 = R[r + 3];
      const packed = (i | (R[r + 4] << 16) | (R[r + 5] << 24)) >>> 0;   // region B item: index16 | qmin8 | qmax8 (levels ≤ 239 fit a byte)
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
    this.finishInfo(sum);
    const q = this.device.queue;
    q.writeBuffer(this.cellBuf, 0, this.cellStart);
    q.writeBuffer(this.itemBuf, 0, this.items.buffer, 0, Math.max(4, 2 * sum * 4));
    this.gridLiveN = all.length;
  }
  /** SceneInfo's header / globals rows / capsule words + the rig fit + the capsule and info uploads — the part of buildGrid that is not the grid (runs with gridEnabled off too:
   *  then no globals, an itemsB of 0, and the cell / item buffers untouched) */
  private finishInfo(sum: number) {
    const W = WORLD.gridW, H = WORLD.gridH, pad = WORLD.gridYPad, all = this.all;
    if (!this.gridEnabled) { this.globals.length = 0; this.itemCount = 0; this.gridStats.empty = 0; this.gridStats.meanSkip = 0; this.gridStats.maxPerCell = 0; this.gridStats.slack = WORLD.gridJitter; }
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
    this.device.queue.writeBuffer(this.infoBuf, 0, info);
  }

  /** CPU ray cast against all boxes (closest hit). Used for mouse picking / aim point. A glass pane IS hit by default (the maintainer, 08-11: "pointing at glass should
   *  target that point in the glass, not what's behind it" — the reticle, the arm and the throw arc sit on the pane; a round finds it anyway, combat.ts through
   *  StaticCollision.raycast); pass BoxFlag.Glass in skipFlags to see through panes (a laser's reach, a tracer's line). */
  /** glass-break's hook (game/glassbreak.ts sets it beside StaticCollision.glassOpen): a Glass static whose CELL at the hit point has fallen is no hit — the aim
   *  ray, the reticle and the throw arc pass through the hole like a round and a sight line do (W4G.10) */
  glassOpen: ((index: number, p: Vec3) => boolean) | null = null;
  /** A LOOK piece (MKEY.look — a blown wall's plates, lintel and rubble) is not met, shadow-casting or not: the game's callers ask where something LANDS (the
   *  cursor's aim, an order's point, a weapon laser's dot, a tripwire's reach), and a round along the same line goes through it (the collision lists never held
   *  one). `withLook` is for an instrument standing in for the PICTURE's rays (tools/qa/cut-cost.js: what the raster shows, what a gather ray stops on). */
  raycast(ro: Vec3, rd: Vec3, tmax = 1e9, skipFlags: number = BoxFlag.NoShadow | BoxFlag.NoPrimary, skipOwner = 0, withLook = false): { t: number; index: number; n: Vec3 } | null {
    const all = this.all; this.rcBest = tmax; this.rcBi = -1; this.rcBn = [0, 1, 0];
    const nS = this.rgN;
    if (nS < 0 || nS > all.length) {   // no grid for this list (never uploaded): the brute force as it was
      for (let i = 0; i < all.length; i++) if (withLook || !lookKeyed(all[i])) this.rayTest(i, ro, rd, skipFlags, skipOwner);
    } else {
      // dynamics and globals first (they tighten `best` before the walk), then the statics cell by cell along the ray
      for (let i = nS; i < all.length; i++) if (withLook || !lookKeyed(all[i])) this.rayTest(i, ro, rd, skipFlags, skipOwner);
      const G = this.rgGlobals; for (let k = 0; k < G.length; k++) this.rayTest(G[k], ro, rd, skipFlags, skipOwner);
      this.rayWalk(ro, rd, skipFlags, skipOwner);
    }
    return this.rcBi >= 0 ? { t: this.rcBest, index: this.rcBi, n: this.rcBn } : null;
  }
  /** one candidate of raycast(): the brute force's per-box test, statement for statement, + the tie rule the index order gave it */
  private rayTest(i: number, ro: Vec3, rd: Vec3, skipFlags: number, skipOwner: number) {
    const b = this.all[i]; if (b.flags & skipFlags) return; if (skipOwner && b.owner === skipOwner) return;   // (e.g. the cursor's aim ray must not land on the player's own gun / goggles)
    const r = rayBox(ro, rd, b, this.rcBest);
    if (r && (r.t < this.rcBest || (r.t === this.rcBest && i < this.rcBi))) {
      if (this.glassOpen && (b.flags & BoxFlag.Glass) && i < this.statics.length && this.glassOpen(i, [ro[0] + rd[0] * r.t, ro[1] + rd[1] * r.t, ro[2] + rd[2] * r.t])) return;   // through the hole in a holed pane
      this.rcBest = r.t; this.rcBi = i; this.rcBn = r.n;
    }
  }
  /** the statics along the ray: a 2D DDA over the XZ cells from where the ray enters the grid, each cell's registered statics tested once (the stamp), stopping once the next
   *  cell begins past the best hit (a static's entry point lies in a cell it is registered in — the padded footprint contains it — so nothing nearer can be beyond) */
  private rayWalk(ro: Vec3, rd: Vec3, skipFlags: number, skipOwner: number) {
    const W = WORLD.gridW, H = WORLD.gridH, cs = WORLD.gridCell; const gx = W * cs, gz = H * cs;
    const ox = ro[0], oz = ro[2], dx = rd[0], dz = rd[2];
    let t0 = 0, t1 = Infinity;
    if (dx !== 0) { const ta = (0 - ox) / dx, tb = (gx - ox) / dx; if (ta < tb) { if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; } else { if (tb > t0) t0 = tb; if (ta < t1) t1 = ta; } } else if (ox < 0 || ox > gx) return;
    if (dz !== 0) { const ta = (0 - oz) / dz, tb = (gz - oz) / dz; if (ta < tb) { if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; } else { if (tb > t0) t0 = tb; if (ta < t1) t1 = ta; } } else if (oz < 0 || oz > gz) return;
    if (!(t0 <= t1)) return;   // (misses the grid — or NaN)
    let cx = Math.floor((ox + dx * t0) / cs), cz = Math.floor((oz + dz * t0) / cs);
    if (cx < 0) cx = 0; else if (cx > W - 1) cx = W - 1; if (cz < 0) cz = 0; else if (cz > H - 1) cz = H - 1;
    const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0, stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;
    const dtx = stepX ? cs / Math.abs(dx) : Infinity, dtz = stepZ ? cs / Math.abs(dz) : Infinity;
    let tmx = dx > 0 ? ((cx + 1) * cs - ox) / dx : dx < 0 ? (cx * cs - ox) / dx : Infinity;
    let tmz = dz > 0 ? ((cz + 1) * cs - oz) / dz : dz < 0 ? (cz * cs - oz) / dz : Infinity;
    if (++this.rgRay === 0xffffffff) { this.rgStamp.fill(0); this.rgRay = 1; }
    const ray = this.rgRay, stamp = this.rgStamp, start = this.rgStart, items = this.rgItems;
    let tEnter = t0;
    for (;;) {
      if (tEnter > this.rcBest) return;
      const c = cz * W + cx; const e = start[c + 1];
      for (let k = start[c]; k < e; k++) { const i = items[k]; if (stamp[i] === ray) continue; stamp[i] = ray; this.rayTest(i, ro, rd, skipFlags, skipOwner); }
      if (tmx < tmz) { tEnter = tmx; cx += stepX; if (cx < 0 || cx >= W) return; tmx += dtx; }
      else if (tmz < Infinity) { tEnter = tmz; cz += stepZ; if (cz < 0 || cz >= H) return; tmz += dtz; }
      else return;   // (a vertical ray: one cell)
    }
  }
  /** register the static prefix all[0, n) of the last upload in the ray grid (see the members): padded footprints into cells, the oversize / out-of-grid ones as globals */
  private buildRayGrid(n: number) {
    const W = WORLD.gridW, H = WORLD.gridH, cs = WORLD.gridCell, N = W * H, pad = BoxWorld.RAY_PAD; const all = this.all;
    if (this.rgRanges.length < n * 4) this.rgRanges = new Int32Array(Math.max(n, this.maxBoxes) * 4);
    if (this.rgStamp.length < this.maxBoxes) { this.rgStamp = new Uint32Array(this.maxBoxes); this.rgRay = 0; }
    const R = this.rgRanges, start = this.rgStart; start.fill(0); this.rgGlobals.length = 0;
    for (let i = 0; i < n; i++) {
      const b = all[i]; const r = i * 4; const [ex, ez] = BoxWorld.footprint(b);
      const x0 = Math.floor((b.c[0] - ex - pad) / cs), x1 = Math.floor((b.c[0] + ex + pad) / cs), z0 = Math.floor((b.c[2] - ez - pad) / cs), z1 = Math.floor((b.c[2] + ez + pad) / cs);
      if (!(x0 >= 0 && z0 >= 0 && x1 < W && z1 < H) || (x1 - x0 + 1) * (z1 - z0 + 1) > 96) { R[r] = -1; this.rgGlobals.push(i); continue; }   // (reaches outside the grid, or huge — a floor: tested every ray; NaN geometry lands here too)
      R[r] = x0; R[r + 1] = x1; R[r + 2] = z0; R[r + 3] = z1;
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) start[z * W + x]++;
    }
    let sum = 0; for (let c = 0; c < N; c++) { const k = start[c]; start[c] = sum; sum += k; } start[N] = sum;
    if (sum > this.rgItems.length) this.rgItems = new Uint32Array(Math.max(sum, this.rgItems.length * 2));
    const fill = this.rgFill; fill.fill(0); const items = this.rgItems;
    for (let i = 0; i < n; i++) {
      const r = i * 4; const x0 = R[r]; if (x0 < 0) continue; const x1 = R[r + 1], z0 = R[r + 2], z1 = R[r + 3];
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const c = z * W + x; items[start[c] + fill[c]++] = i; }
    }
    this.rgN = n; this.rayGridStats.statics = n; this.rayGridStats.globals = this.rgGlobals.length; this.rayGridStats.items = sum;
  }
}

export function rayBox(ro: Vec3, rd: Vec3, b: Box, tmax: number): { t: number; n: Vec3 } | null {
  if (b.round === true) return rayBoxRound(ro, rd, b, tmax);   // ROUND THINGS (scene/round.ts): the cylinder (below)
  if (b.cut !== undefined && cutConfig.on && b.cut.length > 0) return rayBoxCut(ro, rd, b, tmax);   // CUT BOXES: the cut solid (below) — every other box takes the lines it always took
  if (b.rot) return rayBoxRot(ro, rd, b, tmax);
  // (the CPU-frame lane: the slab loop written out over the three axes and scalars — the same statements in the same order as the array form it replaces, so t and n are the same bits; the two
  //  scratch arrays a test allocated are gone. rayBox is the game's hottest CPU function: ~1000 calls a frame from the raycasts alone.)
  const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw);
  const px = ro[0] - b.c[0], py = ro[1] - b.c[1], pz = ro[2] - b.c[2];
  // world -> local (R^T)
  const lx = cs * px - sn * pz, lz = sn * px + cs * pz, ly = py;
  const dx = cs * rd[0] - sn * rd[2], dz = sn * rd[0] + cs * rd[2], dy = rd[1];
  const ix = 1 / (dx || 1e-20), iy = 1 / (dy || 1e-20), iz = 1 / (dz || 1e-20);
  const h = b.h; let t0 = 0, t1 = tmax; let axis = -1, sgn = 0;
  { let ta = (-h[0] - lx) * ix, tb = (h[0] - lx) * ix; let s = -1; if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; s = 1; } if (ta > t0) { t0 = ta; axis = 0; sgn = s; } if (tb < t1) t1 = tb; if (t0 > t1) return null; }
  { let ta = (-h[1] - ly) * iy, tb = (h[1] - ly) * iy; let s = -1; if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; s = 1; } if (ta > t0) { t0 = ta; axis = 1; sgn = s; } if (tb < t1) t1 = tb; if (t0 > t1) return null; }
  { let ta = (-h[2] - lz) * iz, tb = (h[2] - lz) * iz; let s = -1; if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; s = 1; } if (ta > t0) { t0 = ta; axis = 2; sgn = s; } if (tb < t1) t1 = tb; if (t0 > t1) return null; }
  // Origin INSIDE the box (no face entered ahead of it — an origin exactly ON a face heading in counts as inside too): no hit, deliberately. Callers lean on it: the
  // cursor's pick and a round's static hit start rays at muzzles and lenses that may sit in their own housing, an item or a spark born inside a static leaves it
  // freely, an eye momentarily inside a swinging leaf still sees (collision.ts segmentBlockedDynamic). What must NOT lean on it is a blocked-or-not question about a
  // segment born on a wall's face — collision.ts segmentBlocked judges statics by the full slab interval (lineBox) for exactly that reason. Same rule in rayBoxRot.
  if (axis < 0) return null;
  const ln0 = axis === 0 ? sgn : 0, ln1 = axis === 1 ? sgn : 0, ln2 = axis === 2 ? sgn : 0;   // the local face normal (the other two components the literal 0 they always were)
  const n: Vec3 = [cs * ln0 + sn * ln2, ln1, -sn * ln0 + cs * ln2];
  return { t: t0, n };
}
/** Same slab test in the frame of a fully rotated box (Box.rot). */
function rayBoxRot(ro: Vec3, rd: Vec3, b: Box, tmax: number): { t: number; n: Vec3 } | null {
  // qi = quat.conj(b.rot); o = quat.rotate(qi, v3.sub(ro, b.c)); d = quat.rotate(qi, rd) — over scalars, quat.rotate's expression each (v' = v + 2w(qv × v) + 2 qv × (qv × v))
  const R = b.rot!; const qx = -R[0], qy = -R[1], qz = -R[2], qw = R[3];
  const sx = ro[0] - b.c[0], sy = ro[1] - b.c[1], sz = ro[2] - b.c[2];
  let tx = 2 * (qy * sz - qz * sy), ty = 2 * (qz * sx - qx * sz), tz = 2 * (qx * sy - qy * sx);
  const o0 = sx + qw * tx + (qy * tz - qz * ty), o1 = sy + qw * ty + (qz * tx - qx * tz), o2 = sz + qw * tz + (qx * ty - qy * tx);
  const vx = rd[0], vy = rd[1], vz = rd[2];
  tx = 2 * (qy * vz - qz * vy); ty = 2 * (qz * vx - qx * vz); tz = 2 * (qx * vy - qy * vx);
  const d0 = vx + qw * tx + (qy * tz - qz * ty), d1 = vy + qw * ty + (qz * tx - qx * tz), d2 = vz + qw * tz + (qx * ty - qy * tx);
  const h = b.h; let t0 = 0, t1 = tmax; let axis = -1, sgn = 0;
  { const inv = 1 / (d0 || 1e-20); let ta = (-h[0] - o0) * inv, tb = (h[0] - o0) * inv; let s = -1; if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; s = 1; } if (ta > t0) { t0 = ta; axis = 0; sgn = s; } if (tb < t1) t1 = tb; if (t0 > t1) return null; }
  { const inv = 1 / (d1 || 1e-20); let ta = (-h[1] - o1) * inv, tb = (h[1] - o1) * inv; let s = -1; if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; s = 1; } if (ta > t0) { t0 = ta; axis = 1; sgn = s; } if (tb < t1) t1 = tb; if (t0 > t1) return null; }
  { const inv = 1 / (d2 || 1e-20); let ta = (-h[2] - o2) * inv, tb = (h[2] - o2) * inv; let s = -1; if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; s = 1; } if (ta > t0) { t0 = ta; axis = 2; sgn = s; } if (tb < t1) t1 = tb; if (t0 > t1) return null; }
  if (axis < 0) return null;   // origin inside: no hit — the rule rayBox documents (kept on purpose; see there for who leans on it and who must not)
  const ln: Vec3 = [0, 0, 0]; ln[axis] = sgn;
  return { t: t0, n: quat.rotate(b.rot!, ln) };
}

/** CUT BOXES (scene/cut.ts): the same test against a box with a cut record — the slab interval in the box's frame (yawed or fully rotated), cut down by the
 *  record's planes (cutClip: common.wgsl isectCut's statements). The entry is a box face or a cut plane, whichever the ray meets LAST on its way in; the normal is
 *  that face's. Origin inside the cut solid = no hit, the rule rayBox documents; an origin inside the box but in the part cut AWAY is outside, and can hit. */
function rayBoxCut(ro: Vec3, rd: Vec3, b: Box, tmax: number): { t: number; n: Vec3 } | null {
  let ox: number, oy: number, oz: number, dx: number, dy: number, dz: number; let cs = 1, sn = 0;
  const px = ro[0] - b.c[0], py = ro[1] - b.c[1], pz = ro[2] - b.c[2];
  if (b.rot) {   // (over scalars, rayBoxRot's expressions: no arrays on the raycast's path)
    const R = b.rot; const qx = -R[0], qy = -R[1], qz = -R[2], qw = R[3];
    let tx = 2 * (qy * pz - qz * py), ty = 2 * (qz * px - qx * pz), tz = 2 * (qx * py - qy * px);
    ox = px + qw * tx + (qy * tz - qz * ty); oy = py + qw * ty + (qz * tx - qx * tz); oz = pz + qw * tz + (qx * ty - qy * tx);
    const vx = rd[0], vy = rd[1], vz = rd[2];
    tx = 2 * (qy * vz - qz * vy); ty = 2 * (qz * vx - qx * vz); tz = 2 * (qx * vy - qy * vx);
    dx = vx + qw * tx + (qy * tz - qz * ty); dy = vy + qw * ty + (qz * tx - qx * tz); dz = vz + qw * tz + (qx * ty - qy * tx);
  } else {
    cs = Math.cos(b.yaw); sn = Math.sin(b.yaw);
    ox = cs * px - sn * pz; oy = py; oz = sn * px + cs * pz; dx = cs * rd[0] - sn * rd[2]; dy = rd[1]; dz = sn * rd[0] + cs * rd[2];
  }
  const h = b.h; let t0 = 0, t1 = tmax; let axis = -1, sgn = 0;
  { const inv = 1 / (dx || 1e-20); let ta = (-h[0] - ox) * inv, tb = (h[0] - ox) * inv; let s = -1; if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; s = 1; } if (ta > t0) { t0 = ta; axis = 0; sgn = s; } if (tb < t1) t1 = tb; if (t0 > t1) return null; }
  { const inv = 1 / (dy || 1e-20); let ta = (-h[1] - oy) * inv, tb = (h[1] - oy) * inv; let s = -1; if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; s = 1; } if (ta > t0) { t0 = ta; axis = 1; sgn = s; } if (tb < t1) t1 = tb; if (t0 > t1) return null; }
  { const inv = 1 / (dz || 1e-20); let ta = (-h[2] - oz) * inv, tb = (h[2] - oz) * inv; let s = -1; if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; s = 1; } if (ta > t0) { t0 = ta; axis = 2; sgn = s; } if (tb < t1) t1 = tb; if (t0 > t1) return null; }
  if (!cutClip(b.cut!, ox, oy, oz, dx, dy, dz, t0, t1)) return null;
  const k = CUT_CLIP.k;
  if (k < 0 && axis < 0) return null;   // origin inside the cut solid
  let ln: Vec3;
  if (k >= 0) { const n = b.cut![k].n; ln = [n[0], n[1], n[2]]; } else { ln = [0, 0, 0]; ln[axis] = sgn; }
  if (b.rot) return { t: CUT_CLIP.t0, n: quat.rotate(b.rot, ln) };
  return { t: CUT_CLIP.t0, n: [cs * ln[0] + sn * ln[2], ln[1], -sn * ln[0] + cs * ln[2]] };
}

/** ROUND THINGS (scene/round.ts): the same test against a round box — the cylinder about its own y, radius h[0], between its two end faces. The ray's stay inside
 *  is one interval: its stay between the ends, cut down to its stay inside the circle (common.wgsl isectRound's statements). The normal is the end's, or points
 *  straight out from the axis at the place the ray meets the side. Origin inside = no hit, the rule rayBox documents. */
function rayBoxRound(ro: Vec3, rd: Vec3, b: Box, tmax: number): { t: number; n: Vec3 } | null {
  let ox: number, oy: number, oz: number, dx: number, dy: number, dz: number; let cs = 1, sn = 0;
  const px = ro[0] - b.c[0], py = ro[1] - b.c[1], pz = ro[2] - b.c[2];
  if (b.rot) {   // (rayBoxRot's expressions over scalars)
    const R = b.rot; const qx = -R[0], qy = -R[1], qz = -R[2], qw = R[3];
    let tx = 2 * (qy * pz - qz * py), ty = 2 * (qz * px - qx * pz), tz = 2 * (qx * py - qy * px);
    ox = px + qw * tx + (qy * tz - qz * ty); oy = py + qw * ty + (qz * tx - qx * tz); oz = pz + qw * tz + (qx * ty - qy * tx);
    const vx = rd[0], vy = rd[1], vz = rd[2];
    tx = 2 * (qy * vz - qz * vy); ty = 2 * (qz * vx - qx * vz); tz = 2 * (qx * vy - qy * vx);
    dx = vx + qw * tx + (qy * tz - qz * ty); dy = vy + qw * ty + (qz * tx - qx * tz); dz = vz + qw * tz + (qx * ty - qy * tx);
  } else {
    cs = Math.cos(b.yaw); sn = Math.sin(b.yaw);
    ox = cs * px - sn * pz; oy = py; oz = sn * px + cs * pz; dx = cs * rd[0] - sn * rd[2]; dy = rd[1]; dz = sn * rd[0] + cs * rd[2];
  }
  const R = b.h[0], hy = b.h[1]; let t0 = 0, t1 = tmax; let face = 0, sgn = 0;   // face: 0 = none entered (the origin is inside), 1 = an end, 2 = the side
  { const inv = 1 / (dy || 1e-20); let ta = (-hy - oy) * inv, tb = (hy - oy) * inv; let s = -1; if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; s = 1; } if (ta > t0) { t0 = ta; face = 1; sgn = s; } if (tb < t1) t1 = tb; if (t0 > t1) return null; }
  const a = dx * dx + dz * dz, hb = ox * dx + oz * dz, c = ox * ox + oz * oz - R * R;
  if (a < 1e-18) { if (c > 0) return null; }   // along the axis: inside the circle for every t, or never
  else { const disc = hb * hb - a * c; if (disc < 0) return null; const s = Math.sqrt(disc), ta = (-hb - s) / a, tb = (-hb + s) / a; if (ta > t0) { t0 = ta; face = 2; } if (tb < t1) t1 = tb; if (t0 > t1) return null; }
  if (face === 0) return null;   // origin inside
  let l0 = 0, l1 = sgn, l2 = 0;
  if (face === 2) { const hx = ox + dx * t0, hz = oz + dz * t0, il = 1 / (Math.sqrt(hx * hx + hz * hz) || 1); l0 = hx * il; l1 = 0; l2 = hz * il; }
  if (b.rot) return { t: t0, n: quat.rotate(b.rot, [l0, l1, l2]) };
  return { t: t0, n: [cs * l0 + sn * l2, l1, -sn * l0 + cs * l2] };
}
