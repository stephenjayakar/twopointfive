// Decals (EXPERIMENT E1): the marks an encounter leaves on the level — bullet holes, the scorch of a stun charge, boot scuffs on a kicked leaf,
// the pale chip a ring airfoil knocks out of the plaster. NOT geometry and not boxes in the trace grid: a small ring-allocated list on the CPU,
// bucketed into the level's 1 m XZ cells, uploaded (when it changed) as ONE read-only storage buffer that the g-buffer's FRAGMENT stage reads
// (render/shaders/decals.wgsl): for the shaded pixel's world position + face normal + box index it walks its cell's few entries, rejects by
// bounding sphere / facing / plane distance / owning box, and modulates the albedo it writes (darken + tint, a paler chipped rim), tilts the
// normal a little across a crater's bevel, and lowers the albedo target's alpha where soot should kill the polished floors' gloss. Because it is
// the g-buffer albedo / normal that change, everything downstream — the traced direct light, the final gather's bounce AT the pixel, the gloss
// term — responds without knowing decals exist. (What does NOT respond: the bounce OFF a marked surface onto its neighbours — secondary hits
// shade with the box's own material — and the AI's light meter, which is irradiance, not albedo.)
//
// Marks on a DYNAMIC box (a door leaf, a piece of loose furniture) are stored in that box's local frame and re-derived every frame from where
// the box now stands (sync), restricted on the GPU to pixels of that very box; marks on statics are world-fixed and paint any surface that passes
// the facing + plane tests (a scorch runs across the floor slab AND the rug lying on it). Lifetime: the encounter — the ring recycles the oldest
// past CAP, resetLevelState() clears the lot.
//
// One buffer, four regions (word offsets exported to the shader by decalWgslConsts, so both sides read one layout):
//   [0]                       header vec4u: count, list length, serial, 0
//   [CELL0, +CELLS_V4)        the cell table: one u32 per 1 m cell = start16 | count16 into the index list (4 cells a vec4)
//   [LIST0, +LIST_V4)         the index list: decal indices per cell, oldest first (4 a vec4)
//   [REC0, +3·CAP)            the records, 3 vec4 each: (pos.xyz, radius) (normal.xyz, param) (tangent.xyz, bits(kind3 | attached1 | seed12 | box16))
//                             (box16 = the box an attached mark rides, DECAL_ANY_BOX for a world-fixed one, or — kind glassHit — the static index of ITS pane)
//
// Kind 'wetprint' (game/wet.ts): a wet shoe print, param = how wet — the one kind whose record is EDITED after the fact (wet.ts agePrints lowers param as it
// dries and calls touch(); remove() retires it before the ring would).
// Kind 'glassHit' (E3 × E1): a round's hole + crack star on a glass pane. Panes are in no raster, so the g-buffer's decalSurface skips the kind outright; it is
// composite.wgsl that evaluates it (glassMarks in decals.wgsl) at the point the view ray crosses the pane, from the same cell lists, and modulates the pane's
// transmission / reflection there. Same ring, same lifetime, same buffer — the composite pass binds it too (passes.ts group 1 binding 10).
import { Vec3, v3, quat } from '../math/vec';
import { Box, BoxWorld } from '../scene/boxes';
import { WORLD } from '../scene/world';
import { makeBuffer } from '../gpu/device';

export type DecalKind = 'bullet' | 'scorch' | 'scuff' | 'chip' | 'glassHit' | 'wetprint' | 'damage';
const KIND_CODE: Record<DecalKind, number> = { bullet: 1, scorch: 2, scuff: 3, chip: 4, glassHit: 5, wetprint: 6, damage: 7 };   // (kind rides in 3 bits of the record: 'damage' took the last code — its LOOK is the integer part of param: decals.wgsl damageMark)
/** GPU box index meaning "any surface that passes the facing / plane tests" (statics) */
export const DECAL_ANY_BOX = 0xffff;

export interface Decal {
  kind: DecalKind;
  /** world placement (re-derived every sync for an attached decal): centre on the surface, unit face normal, unit in-plane tangent (the scuff's direction; the noise's orientation otherwise) */
  pos: Vec3; n: Vec3; t: Vec3;
  /** bounding / shape radius (m); kind parameter (bullet: calibre scale, scorch: soot intensity 0‥1, scuff: streak length m, chip: unused, glassHit: impact strength 0‥1, wetprint: how wet 0‥1 — game/wet.ts lowers it as the print dries); 12-bit look seed; running number */
  radius: number; param: number; seed: number; serial: number;
  /** glassHit only: the static (level) index of the pane it is on — the shader draws it on that pane alone; −1 otherwise */
  pane: number;
  /** the dynamic box it rides (door leaf, prop part) with its placement in that box's local frame — null / null for a world-fixed mark */
  box: Box | null; local: { p: Vec3; n: Vec3; t: Vec3 } | null;
  /** GPU box index the shader restricts it to this frame (DECAL_ANY_BOX for statics; an attached decal's own box, re-resolved per sync) */
  boxIdx: number;
  /** attached box absent from this frame's box list: kept, not drawn */
  hidden: boolean;
}

export interface DecalOpts {
  /** in-plane direction (world; projected into the plane and normalised here) — the scuff's streak; default: any perpendicular of the normal */
  tangent?: Vec3;
  /** kind parameter (see Decal.param); defaults per kind */
  param?: number;
  /** ride this (dynamic) box: pos / normal / tangent are converted into its local frame now and follow it from then on, and only ITS pixels take the mark */
  attach?: Box;
  /** keep the whole mark on the face of this box that was hit: the centre is pulled in from the face's edges by the radius (a face narrower than the mark centres it) and snapped onto the face plane */
  clampTo?: Box;
  /** the 12-bit look seed, given (glass hits hash it from WHERE the pane was hit, so a capture repeats whatever else was marked first); default: off the running number */
  seed?: number;
  /** glassHit: the static index of the pane the mark is on (required for that kind; ignored for the others) */
  pane?: number;
}

// ---- buffer layout (words of 16 bytes) — decalWgslConsts() hands the same numbers to the shader
const CELLS = WORLD.gridW * WORLD.gridH;
const CELLS_V4 = Math.ceil(CELLS / 4);
export const DECAL_CAP = 512;          // live decals (ring: the oldest goes)
export const DECAL_LIST_CAP = 4096;    // cell-list entries in all (a decal sits in ≤ 4 cells: radius < 1 m cell)
export const DECAL_MAX_PER_CELL = 48;  // newest-N kept per cell: bounds the per-pixel loop where somebody empties magazines into one square metre
const LIST_V4 = DECAL_LIST_CAP / 4;
const CELL0 = 1, LIST0 = CELL0 + CELLS_V4, REC0 = LIST0 + LIST_V4;
const TOTAL_V4 = REC0 + DECAL_CAP * 3;
export const DECAL_BYTES = TOTAL_V4 * 16;

/** Measurement only (?decalStress=N in main.ts, read when the g-buffer shader is built): evaluate the decal lookup N times per fragment so its cost rises above the
 *  timer's noise floor — the reported delta ÷ N is the honest per-fragment figure. 1 = production. */
export const decalDebug = { repeat: 1 };
/** WGSL consts for render/shaders/decals.wgsl: the layout above + the caps (prepended by gbuffer.ts next to the scene prelude) */
export function decalWgslConsts(binding = 3): string {
  return `@group(1) @binding(${binding | 0}) var<storage, read> decalBuf: array<vec4u>;   // render/decals.ts — the g-buffer binds it at 3, the composite pass (glass cracks) at 10. UNSIGNED words: the cell / list regions are small integers (subnormal bit patterns as f32) and a record's bits word can be a NaN pattern — a float-typed view may flush or canonicalise those on load on some hardware; the float rows are bitcast<vec4f> at the read (review R2.1 / R10.3)\nconst DECAL_CELL0: u32 = ${CELL0}u;\nconst DECAL_LIST0: u32 = ${LIST0}u;\nconst DECAL_REC0: u32 = ${REC0}u;\nconst DECAL_CAP: u32 = ${DECAL_CAP}u;\nconst DECAL_LIST_CAP: u32 = ${DECAL_LIST_CAP}u;\nconst DECAL_REPEAT: u32 = ${Math.max(1, decalDebug.repeat | 0)}u;   // measurement only (decalDebug.repeat): 1 in production\n`;
}

/** default bounding radius / parameter per kind */
const DEFAULTS: Record<DecalKind, { radius: number; param: number }> = {
  bullet: { radius: 0.03, param: 1 },      // chipped rim out to ≤ 3 cm, dark core ~1.1 cm × calibre scale
  scorch: { radius: 0.75, param: 1 },      // soot disc, intensity 1
  scuff: { radius: 0.1, param: 0.16 },     // (radius is re-derived from the streak length below)
  chip: { radius: 0.013, param: 1 },
  glassHit: { radius: 0.12, param: 1 },  // the crack star's reach from the hole (glass.ts draws 0.075‥0.2 off the hit's seed)
  wetprint: { radius: 0.17, param: 1 },  // a wet shoe print (game/wet.ts wetFootfall): the sole fits inside 17 cm of its centre; param = how wet, aged toward 0
  damage: { radius: 0.05, param: 0.8 },   // the destruction lane's marks (game/destruction.ts): floor(param) = the look — 0 a DENT in sheet metal, 1 a SHRED in fabric, 2 a CRACK in a dark screen — fract(param) = strength
};
const SCUFF_HALF_W = 0.016;

export class Decals {
  /** live decals, oldest first (the ring drops from the front) */
  readonly list: Decal[] = [];
  /** off: add() records nothing, frame() uploads nothing, the engine keeps FrameFlags.Decals down — the buffer stays exactly as it was (settings.decals mirrors in here) */
  enabled = true;
  readonly buf: GPUBuffer;
  private data = new ArrayBuffer(DECAL_BYTES); private f32 = new Float32Array(this.data); private u32 = new Uint32Array(this.data);
  private dirty = true; private serial = 0;
  private cellLists: number[][] = Array.from({ length: CELLS }, () => []);
  /** what the last build packed: decals drawn, list entries, the busiest cell's count (after the per-cell cap), entries dropped by the caps, uploads so far, build time */
  stats = { count: 0, listLen: 0, maxCell: 0, dropped: 0, uploads: 0, buildMs: 0 };
  static readonly CAP = DECAL_CAP;

  constructor(private device: GPUDevice) {
    this.buf = makeBuffer(device, DECAL_BYTES, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 'decals');
  }

  get count() { return this.list.length; }

  /** Leave a mark of `kind` centred at `pos` on a surface whose outward normal is `normal` (world). `size` overrides the kind's radius (the scuff's LENGTH goes in
   *  opts.param). Returns the decal, or null when decals are off. Never touches Math.random (seeded QA runs must not shift): the look seed counts. */
  add(kind: DecalKind, pos: Vec3, normal: Vec3, size?: number, opts: DecalOpts = {}): Decal | null {
    if (!this.enabled) return null;
    const n = v3.normalize(normal);
    let t = opts.tangent ? v3.sub(opts.tangent, v3.scale(n, v3.dot(opts.tangent, n))) : perpendicular(n);
    if (v3.len(t) < 1e-4) t = perpendicular(n); t = v3.normalize(t);
    const def = DEFAULTS[kind];
    const param = opts.param ?? def.param;
    let radius = size ?? def.radius;
    if (kind === 'scuff') radius = 0.5 * param + SCUFF_HALF_W + 0.06;   // the streak + its echo mark (decals.wgsl scuffMark) inside one bounding circle
    let p = v3.copy(pos);
    if (opts.clampTo) p = clampToFace(opts.clampTo, p, n, kind === 'scuff' ? 0.5 * param : radius);
    const serial = ++this.serial;
    const seed = opts.seed !== undefined ? opts.seed & 0xfff : (Math.imul(serial, 2654435761) >>> 20) & 0xfff;
    const pane = kind === 'glassHit' ? (opts.pane ?? -1) : -1;
    if (kind === 'glassHit' && (pane < 0 || pane >= DECAL_ANY_BOX)) return null;   // a crack star belongs to one pane or to nothing
    const d: Decal = { kind, pos: p, n, t, radius, param, seed, serial, pane, box: null, local: null, boxIdx: DECAL_ANY_BOX, hidden: false };
    if (opts.attach) { const b = opts.attach; d.box = b; d.local = { p: toLocal(b, p, true), n: toLocal(b, n, false), t: toLocal(b, t, false) }; d.boxIdx = DECAL_ANY_BOX; d.hidden = true; }   // (index unknown until the next sync finds the box in the frame's list; drawn from then)
    if (this.list.length >= DECAL_CAP) this.list.shift();
    this.list.push(d); this.dirty = true;
    return d;
  }

  clear() { if (this.list.length) { this.list.length = 0; this.dirty = true; } }
  /** take one decal out before the ring gets to it (game/wet.ts retires dried footprints); true if it was live */
  remove(d: Decal): boolean { const i = this.list.indexOf(d); if (i < 0) return false; this.list.splice(i, 1); this.dirty = true; return true; }
  /** a record was edited in place (a print's `param` lowered as it dries): rebuild + upload on the next frame */
  touch() { this.dirty = true; }

  /** Attached decals: find each one's box in this frame's list (statics first, then dynamics — BoxWorld.upload's order) and re-derive its world placement from
   *  where the box stands now. Cheap when nothing moved (a cached index check + three compares per decal). Called by frame(); the QA harness calls it by hand. */
  sync(world: BoxWorld) {
    const all = world.all; const nStat = world.statics.length;
    for (const d of this.list) {
      if (!d.box || !d.local) continue;
      let idx = d.boxIdx;
      if (idx === DECAL_ANY_BOX || all[idx] !== d.box) { const k = world.dynamics.indexOf(d.box); idx = k < 0 ? -1 : nStat + k; }
      if (idx < 0 || idx >= DECAL_ANY_BOX) { if (!d.hidden) { d.hidden = true; this.dirty = true; } continue; }
      const b = d.box;
      const p = toWorld(b, d.local.p, true), n = toWorld(b, d.local.n, false), t = toWorld(b, d.local.t, false);
      if (d.hidden || idx !== d.boxIdx || !near(p, d.pos) || !near(n, d.n) || !near(t, d.t)) { d.pos = p; d.n = n; d.t = t; d.boxIdx = idx; d.hidden = false; this.dirty = true; }
    }
  }

  /** Once per rendered frame, after BoxWorld.upload (engine.render): sync the attached ones, and if anything changed rebuild the cell table + records and write
   *  the buffer. Off (enabled false): nothing — the buffer keeps whatever it last held and the engine never raises the flag. */
  frame(world: BoxWorld) {
    if (!this.enabled) return;
    this.sync(world);
    if (!this.dirty) return;
    this.build();
    this.device.queue.writeBuffer(this.buf, 0, this.data, 0, DECAL_BYTES);
    this.stats.uploads++; this.dirty = false;
  }

  /** Pack the list: bucket every drawn decal into the 1 m cells its bounding circle overlaps (newest DECAL_MAX_PER_CELL per cell, DECAL_LIST_CAP entries in all —
   *  anything beyond is dropped from the OLD end and counted in stats.dropped), then the records. Exposed for the harness (no GPU there: it inspects the words). */
  build() {
    const t0 = performance.now();
    const W = WORLD.gridW, H = WORLD.gridH, cs = WORLD.gridCell;
    const lists = this.cellLists; for (const l of lists) l.length = 0;
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const d = list[i]; if (d.hidden) continue;
      const r = d.radius + 0.04;   // + the plane tolerance / edge softening the shader adds round the shape
      const x0 = Math.max(0, Math.floor((d.pos[0] - r - WORLD.min[0]) / cs)), x1 = Math.min(W - 1, Math.floor((d.pos[0] + r - WORLD.min[0]) / cs));
      const z0 = Math.max(0, Math.floor((d.pos[2] - r - WORLD.min[2]) / cs)), z1 = Math.min(H - 1, Math.floor((d.pos[2] + r - WORLD.min[2]) / cs));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) lists[z * W + x].push(i);
    }
    const u = this.u32, f = this.f32;
    let k = 0, maxCell = 0, dropped = 0;
    for (let c = 0; c < CELLS; c++) {
      const arr = lists[c]; let from = Math.max(0, arr.length - DECAL_MAX_PER_CELL); let n = arr.length - from;
      if (k + n > DECAL_LIST_CAP) { const room = Math.max(0, DECAL_LIST_CAP - k); from += n - room; n = room; }
      dropped += arr.length - n; if (n > maxCell) maxCell = n;
      u[CELL0 * 4 + c] = (k | (n << 16)) >>> 0;
      for (let j = 0; j < n; j++) { u[LIST0 * 4 + k] = arr[from + j]; k++; }
    }
    for (let c = CELLS; c < CELLS_V4 * 4; c++) u[CELL0 * 4 + c] = 0;
    let drawn = 0;
    for (let i = 0; i < list.length; i++) {
      const d = list[i]; const o = (REC0 + i * 3) * 4;
      f[o] = d.pos[0]; f[o + 1] = d.pos[1]; f[o + 2] = d.pos[2]; f[o + 3] = d.hidden ? 0 : d.radius;
      f[o + 4] = d.n[0]; f[o + 5] = d.n[1]; f[o + 6] = d.n[2]; f[o + 7] = d.param;
      f[o + 8] = d.t[0]; f[o + 9] = d.t[1]; f[o + 10] = d.t[2];
      u[o + 11] = (KIND_CODE[d.kind] | (d.box ? 8 : 0) | (d.seed << 4) | ((d.box ? d.boxIdx : d.pane >= 0 ? d.pane : DECAL_ANY_BOX) << 16)) >>> 0;   // box16: the ridden box, or the crack's own pane, or 'any'
      if (!d.hidden) drawn++;
    }
    u[0] = list.length; u[1] = k; u[2] = this.serial >>> 0; u[3] = 0;
    this.stats.count = drawn; this.stats.listLen = k; this.stats.maxCell = maxCell; this.stats.dropped = dropped; this.stats.buildMs = performance.now() - t0;
  }

  /** harness / panel: the packed cell word for the cell holding world point (x, z) → { start, count } as the shader unpacks it (after the last build) */
  cellAt(x: number, z: number): { start: number; count: number; indices: number[] } {
    const cx = Math.floor((x - WORLD.min[0]) / WORLD.gridCell), cz = Math.floor((z - WORLD.min[2]) / WORLD.gridCell);
    if (cx < 0 || cz < 0 || cx >= WORLD.gridW || cz >= WORLD.gridH) return { start: 0, count: 0, indices: [] };
    const w = this.u32[CELL0 * 4 + cz * WORLD.gridW + cx]; const start = w & 0xffff, count = w >>> 16;
    const indices: number[] = []; for (let j = 0; j < count; j++) indices.push(this.u32[LIST0 * 4 + start + j]);
    return { start, count, indices };
  }
  /** harness: a copy of the packed words (header + cells + list + records) as last built */
  words(): Uint32Array { return this.u32.slice(0); }
}

// ---- box frames (the same conventions as boxes.ts rayBox / props.ts: local +X → world (cos yaw, 0, −sin yaw), local +Z → (sin yaw, 0, cos yaw); Box.rot when present)
function toLocal(b: Box, v: Vec3, point: boolean): Vec3 {
  const d: Vec3 = point ? v3.sub(v, b.c) : v3.copy(v);
  if (b.rot) return quat.rotate(quat.conj(b.rot), d);
  const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw);
  return [cs * d[0] - sn * d[2], d[1], sn * d[0] + cs * d[2]];
}
function toWorld(b: Box, l: Vec3, point: boolean): Vec3 {
  let w: Vec3;
  if (b.rot) w = quat.rotate(b.rot, l);
  else { const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); w = [cs * l[0] + sn * l[2], l[1], -sn * l[0] + cs * l[2]]; }
  return point ? v3.add(w, b.c) : w;
}
/** Pull `p` (on the face of `b` whose outward normal is `n`) in from that face's edges by `r` and onto the face plane exactly. */
function clampToFace(b: Box, p: Vec3, n: Vec3, r: number): Vec3 {
  const lp = toLocal(b, p, true), ln = toLocal(b, n, false);
  const a = Math.abs(ln[0]) >= Math.abs(ln[1]) && Math.abs(ln[0]) >= Math.abs(ln[2]) ? 0 : Math.abs(ln[1]) >= Math.abs(ln[2]) ? 1 : 2;
  for (let i = 0; i < 3; i++) {
    if (i === a) { lp[i] = (ln[a] >= 0 ? 1 : -1) * b.h[i]; continue; }
    const lim = b.h[i] - r; lp[i] = lim <= 0 ? 0 : Math.max(-lim, Math.min(lim, lp[i]));
  }
  return toWorld(b, lp, true);
}
function perpendicular(n: Vec3): Vec3 { return v3.normalize(Math.abs(n[1]) < 0.9 ? v3.cross(n, [0, 1, 0]) : v3.cross(n, [1, 0, 0])); }
function near(a: Vec3, b: Vec3) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 1e-5; }
