// CUT BOXES: a box may carry a CUT RECORD — up to MAX_CUT_PLANES planes in its own frame that clip it — so one box can be a wedge, a shard or a snapped end.
// The solid of a cut box is   { p : |p.x| ≤ h.x, |p.y| ≤ h.y, |p.z| ≤ h.z }  ∩  { p : n_k · p ≤ d_k for every plane k }   with p in the box's LOCAL frame (origin
// = its centre, axes = its own: before the yaw / Box.rot, metres). The planes ride with the box for free: move, yaw or tumble the box and the cut goes with it.
//
// ONE MODEL: the rasteriser draws that solid (gbuffer.wgsl, the cut pass), every GPU ray meets it (common.wgsl isectBox → shadows, bounce, reflections, the light
// meter, smoke sight lines, particles) and so do the CPU's rays and segments (boxes.ts rayBox, collision.ts lineBox → rounds, aim, sight, sound, throw arcs).
// What stays the UNCUT box, by decision: everything that pushes against it (collision.ts collideCircle / gather, the nav grid, debris / prop contact), its
// registration in the trace grid and the ray grid (a superset: only costs a test), and the smoke solver's obstacle bake.
//
// THE SWITCH: cutConfig.on (raised once at boot; the scene prelude's `const CUT_BOXES` is compiled from it, so flipping it wants a reload). OFF in this module, so
// everything headless stands as it was (CUTBOXES=1 | 0 in front of a headless tool forces it; the cut probes raise it themselves); the PAGE turns it ON at boot
// (main.ts → initCutSwitch) unless the address says ?nocutboxes / ?cutboxes=0 or this machine kept localStorage twopointsix.cutboxes = '0'. OFF = Box.cut is ignored by
// everything: the plain box, the base build's frame hash for hash. Whoever EMITS cut pieces asks cutBoxesOn() and emits its plain boxes otherwise.
//
// The record's contract (type, packing, limits) is written up in rebuild/cut-pieces/contract.md; the layout below is version 1.
import type { Vec3, Quat } from '../math/vec';

/** one cutting plane in the box's LOCAL frame: the box KEEPS the side n · p ≤ d (n unit, d metres from the box centre along n; what lies beyond is gone) */
export interface CutPlane { n: Vec3; d: number }
/** the most planes one box carries (the GPU record is this many vec4 rows) */
export const MAX_CUT_PLANES = 8;
/** PLANE rows of a box's record in the cut table (boxMat's tail from CUT_BASE: row CUT_BASE + bi × CUT_STRIDE + k = (n.xyz, d) of plane k < CUT_ROWS; an unused row = CUT_PAD) */
export const CUT_ROWS = MAX_CUT_PLANES;
/** vec4 rows a box OWNS in the cut table: its CUT_ROWS plane rows, then one CORE row = (the colour its cut faces show, 1) — or all zero: they show the box's own colour */
export const CUT_STRIDE = CUT_ROWS + 1;
/** the unused row: a zero normal ends the record for every reader (n = 0 keeps everything) */
export const CUT_PAD: readonly [number, number, number, number] = [0, 0, 0, 1];
/** the GPU flag bit of a box that has a record (common.wgsl GEO_CUT; bit 16 of the geo flags word — free up there: the CPU's bit 16, SoundSeal, is never uploaded) */
export const BOX_CUT_BIT = 1 << 16;
/** the switch (see the head of this file). Mutate only at boot (main.ts initCutSwitch) or in a headless probe. */
export const cutConfig = {
  on: false,
  /** A CALM ROOM PAYS NOTHING (render/cutSwap.ts): true = every ray program boots as the build's WITHOUT the cut rule (the scene prelude's CUT_BOXES false: the text
   *  `?nocutboxes` compiles), a second set with the rule is compiled in the background after boot, and the frame takes that set only while a cut box a ray can meet
   *  is alive. false (`?cutprograms=boot`) = the one set, compiled with the rule from boot, as the switch first shipped. Read before the first pipeline is compiled. */
  swap: true,
};
export const cutBoxesOn = () => cutConfig.on;
/** read the switch from the page's URL / localStorage (a no-op headless): ON in the page unless ?nocutboxes / ?cutboxes=0, or this machine kept '0'. Call before
 *  the first pipeline is compiled. */
export function initCutSwitch(): boolean {
  if (typeof location === 'undefined') return cutConfig.on;
  const q = new URLSearchParams(location.search);
  if (q.has('nocutboxes')) cutConfig.on = false;
  else if (q.has('cutboxes')) cutConfig.on = q.get('cutboxes') !== '0';
  else { let kept: string | null = null; try { kept = localStorage.getItem('twopointsix.cutboxes'); } catch { /* no storage: on */ } cutConfig.on = kept !== '0'; }
  if (q.get('cutprograms') === 'boot') cutConfig.swap = false;   // (the cut rule compiled into every ray program from boot — the A/B against the swap)
  return cutConfig.on;
}

/** a plane from any normal (normalised here) and its offset along THAT normal's length: keeps n · p ≤ d */
export function cutPlane(n: Vec3, d: number): CutPlane {
  const L = Math.hypot(n[0], n[1], n[2]); if (!(L > 1e-12)) return { n: [0, 0, 0], d: 1 };
  return { n: [n[0] / L, n[1] / L, n[2] / L], d: d / L };
}
/** the plane through local point p whose normal n points at what is REMOVED */
export function cutThrough(p: Vec3, n: Vec3): CutPlane {
  const L = Math.hypot(n[0], n[1], n[2]); if (!(L > 1e-12)) return { n: [0, 0, 0], d: 1 };
  const u: Vec3 = [n[0] / L, n[1] / L, n[2] / L];
  return { n: u, d: u[0] * p[0] + u[1] * p[1] + u[2] * p[2] };
}
/** the plane through three local points, removing the side the triangle a→b→c turns counter-clockwise towards (its right-hand normal) */
export function cutThrough3(a: Vec3, b: Vec3, c: Vec3): CutPlane {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  return cutThrough(a, [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]);
}
/** the farthest the uncut box reaches along n: max over the box of n · p */
export const cutSupport = (h: Vec3, n: Vec3) => Math.abs(n[0]) * h[0] + Math.abs(n[1]) * h[1] + Math.abs(n[2]) * h[2];

/** is local point p inside the cut solid (eps metres of slack) */
export function cutContains(h: Vec3, cut: readonly CutPlane[] | undefined, p: Vec3, eps = 0): boolean {
  if (Math.abs(p[0]) > h[0] + eps || Math.abs(p[1]) > h[1] + eps || Math.abs(p[2]) > h[2] + eps) return false;
  if (cut) for (const c of cut) if (c.n[0] * p[0] + c.n[1] * p[1] + c.n[2] * p[2] > c.d + eps) return false;
  return true;
}

/** The corners of the cut solid (local frame): every triple of its bounding planes (the box's six + the cuts) that meets in a point inside all the others.
 *  A helper for builders, bounds and tests (≤ 120 triples) — not for a per-frame loop over many boxes. */
export function cutVerts(h: Vec3, cut: readonly CutPlane[] | undefined): Vec3[] {
  const P: { n: Vec3; d: number }[] = [
    { n: [1, 0, 0], d: h[0] }, { n: [-1, 0, 0], d: h[0] }, { n: [0, 1, 0], d: h[1] }, { n: [0, -1, 0], d: h[1] }, { n: [0, 0, 1], d: h[2] }, { n: [0, 0, -1], d: h[2] },
  ];
  if (cut) for (const c of cut) if (c.n[0] !== 0 || c.n[1] !== 0 || c.n[2] !== 0) P.push(c);
  const scale = Math.max(h[0], h[1], h[2], 1e-6), eps = 1e-7 * scale + 1e-9, out: Vec3[] = [];
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) for (let k = j + 1; k < P.length; k++) {
    const a = P[i].n, b = P[j].n, c = P[k].n;
    const bcx = b[1] * c[2] - b[2] * c[1], bcy = b[2] * c[0] - b[0] * c[2], bcz = b[0] * c[1] - b[1] * c[0];
    const det = a[0] * bcx + a[1] * bcy + a[2] * bcz; if (Math.abs(det) < 1e-9) continue;
    const cax = c[1] * a[2] - c[2] * a[1], cay = c[2] * a[0] - c[0] * a[2], caz = c[0] * a[1] - c[1] * a[0];
    const abx = a[1] * b[2] - a[2] * b[1], aby = a[2] * b[0] - a[0] * b[2], abz = a[0] * b[1] - a[1] * b[0];
    const p: Vec3 = [(P[i].d * bcx + P[j].d * cax + P[k].d * abx) / det, (P[i].d * bcy + P[j].d * cay + P[k].d * aby) / det, (P[i].d * bcz + P[j].d * caz + P[k].d * abz) / det];
    let ok = true; for (let m = 0; m < P.length && ok; m++) if (P[m].n[0] * p[0] + P[m].n[1] * p[1] + P[m].n[2] * p[2] > P[m].d + eps) ok = false;
    if (!ok) continue;
    let dup = false; for (const q of out) if (Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) + Math.abs(q[2] - p[2]) < 4 * eps) { dup = true; break; }
    if (!dup) out.push(p);
  }
  return out;
}

export interface CutResult {
  /** the record to put on Box.cut — undefined when no plane touches the box (a plain box) */
  cut: CutPlane[] | undefined;
  /** nothing is left of the box (do not emit it) */
  empty: boolean;
  /** planes that still cut something but did not fit in MAX_CUT_PLANES (the shallowest ones are the ones left out: the solid kept is a superset of the one asked for) */
  dropped: number;
}
/** THE BUILDER: a valid record for a box of half-extents h from any list of planes — normals normalised, planes that touch nothing or that the others make
 *  redundant removed, at most MAX_CUT_PLANES kept (deepest first: the ones that take the most off). Pure and deterministic; allocates — call it when a piece is
 *  made, not per frame. */
export function cutRecord(h: Vec3, planes: readonly CutPlane[]): CutResult {
  let list: CutPlane[] = [];
  for (const raw of planes) {
    const c = cutPlane(raw.n, raw.d); if (c.n[0] === 0 && c.n[1] === 0 && c.n[2] === 0) continue;
    const s = cutSupport(h, c.n), tol = 1e-6 * Math.max(h[0], h[1], h[2]) + 1e-8;
    if (c.d >= s - tol) continue;                                 // the whole box is on the kept side (a plane lying ON a face of the box included: that face is already there)
    if (c.d <= -s + tol) return { cut: undefined, empty: true, dropped: 0 };   // …or none of it
    // the same plane given twice (an outline with a point in the middle of an edge), or two parallel ones: only the tighter cuts — a copy would take a row from a real edge
    let twin = -1; for (let i = 0; i < list.length && twin < 0; i++) { const o = list[i].n; if (o[0] * c.n[0] + o[1] * c.n[1] + o[2] * c.n[2] > 1 - 1e-9) twin = i; }
    if (twin >= 0) { if (c.d < list[twin].d) list[twin] = c; continue; }
    list.push(c);
  }
  if (!list.length) return { cut: undefined, empty: false, dropped: 0 };
  const verts = cutVerts(h, list); if (verts.length < 4) return { cut: undefined, empty: true, dropped: 0 };
  { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const v of verts) { x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]); z0 = Math.min(z0, v[2]); z1 = Math.max(z1, v[2]); }
    const tiny = 1e-5; if (x1 - x0 < tiny || y1 - y0 < tiny || z1 - z0 < tiny) return { cut: undefined, empty: true, dropped: 0 }; }   // (a sliver with no thickness: nothing to draw)
  // redundant = no corner of the solid lies on the plane's face with room to spare (it contributes at most an edge)
  const scale = Math.max(h[0], h[1], h[2]), eps = 1e-6 * scale + 1e-8;
  list = list.filter(c => { let on = 0; for (const v of verts) if (Math.abs(c.n[0] * v[0] + c.n[1] * v[1] + c.n[2] * v[2] - c.d) < eps) on++; return on >= 3; });
  let dropped = 0;
  if (list.length > MAX_CUT_PLANES) {
    const depth = (c: CutPlane) => cutSupport(h, c.n) - c.d;     // how far into the box the plane reaches
    dropped = list.length - MAX_CUT_PLANES;
    list = list.map((c, i) => ({ c, i })).sort((a, b) => depth(b.c) - depth(a.c) || a.i - b.i).slice(0, MAX_CUT_PLANES).sort((a, b) => a.i - b.i).map(e => e.c);
  }
  return { cut: list.length ? list : undefined, empty: false, dropped };
}

/** the cut solid's own bounds in the box's local frame */
export function cutBounds(h: Vec3, cut: readonly CutPlane[] | undefined): { min: Vec3; max: Vec3 } {
  if (!cut || !cut.length) return { min: [-h[0], -h[1], -h[2]], max: [h[0], h[1], h[2]] };
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const v of cutVerts(h, cut)) for (let a = 0; a < 3; a++) { if (v[a] < min[a]) min[a] = v[a]; if (v[a] > max[a]) max[a] = v[a]; }
  if (!(min[0] <= max[0])) return { min: [0, 0, 0], max: [0, 0, 0] };
  return { min, max };
}
/** The same solid in the TIGHTEST box of the same orientation: { off = the new centre in the old local frame, h, cut re-expressed about it }. Emit pieces fitted:
 *  the uncut box is what the trace grid registers, what the raster covers before it discards and what collision pushes against. */
export function cutFit(h: Vec3, cut: readonly CutPlane[] | undefined): { off: Vec3; h: Vec3; cut: CutPlane[] | undefined } {
  if (!cut || !cut.length) return { off: [0, 0, 0], h: [h[0], h[1], h[2]], cut: undefined };
  const B = cutBounds(h, cut);
  const off: Vec3 = [(B.min[0] + B.max[0]) / 2, (B.min[1] + B.max[1]) / 2, (B.min[2] + B.max[2]) / 2];
  const nh: Vec3 = [(B.max[0] - B.min[0]) / 2, (B.max[1] - B.min[1]) / 2, (B.max[2] - B.min[2]) / 2];
  const moved = cut.map(c => ({ n: [c.n[0], c.n[1], c.n[2]] as Vec3, d: c.d - (c.n[0] * off[0] + c.n[1] * off[1] + c.n[2] * off[2]) }));
  return { off, h: nh, cut: cutRecord(nh, moved).cut };
}
/** rotate a local vector into the world by a box's orientation (rot if it has one, else its yaw: local +x → (cos, 0, −sin), +z → (sin, 0, cos) — boxes.ts's convention) */
export function cutToWorld(v: Vec3, yaw: number, rot?: Quat): Vec3 {
  if (rot) {
    const qx = rot[0], qy = rot[1], qz = rot[2], qw = rot[3];
    const tx = 2 * (qy * v[2] - qz * v[1]), ty = 2 * (qz * v[0] - qx * v[2]), tz = 2 * (qx * v[1] - qy * v[0]);
    return [v[0] + qw * tx + (qy * tz - qz * ty), v[1] + qw * ty + (qz * tx - qx * tz), v[2] + qw * tz + (qx * ty - qy * tx)];
  }
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  return [cs * v[0] + sn * v[2], v[1], -sn * v[0] + cs * v[2]];
}
/** Fit a box to its cut IN PLACE (centre, half-extents and record replaced; orientation kept). Returns false — and leaves the box alone — if nothing is left of it. */
export function fitCutBox(b: { c: Vec3; h: Vec3; yaw: number; rot?: Quat; cut?: CutPlane[] }): boolean {
  if (!b.cut || !b.cut.length) return true;
  const r = cutRecord(b.h, b.cut); if (r.empty) return false;
  const f = cutFit(b.h, r.cut); const w = cutToWorld(f.off, b.yaw, b.rot);
  b.c = [b.c[0] + w[0], b.c[1] + w[1], b.c[2] + w[2]]; b.h = f.h; b.cut = f.cut;
  return true;
}

/** A PRISM from a convex outline: the polygon `poly` (points (u, v) in the plane across `axis`, either winding) extruded ± halfT along `axis` (0 = x, 1 = y,
 *  2 = z; (u, v) = the next two axes in order: axis x → (y, z), y → (z, x), z → (x, y)). Returns the fitted box { off, h } in the frame the polygon was given in and
 *  its record: one plane per polygon edge that is not already a side of the bounding rectangle. More than MAX_CUT_PLANES such edges: the ones that take least off
 *  are left out (`dropped`; the piece is then a little bigger than the outline — split the outline or accept it). A glass shard = its cell's outline across the
 *  pane's thin axis; a wall chunk = its outline across the wall's. */
export function cutPrism(axis: 0 | 1 | 2, halfT: number, poly: readonly (readonly [number, number])[]): { off: Vec3; h: Vec3; cut: CutPlane[] | undefined; dropped: number; empty: boolean } {
  const ua = (axis + 1) % 3, va = (axis + 2) % 3;
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity, area2 = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    u0 = Math.min(u0, p[0]); u1 = Math.max(u1, p[0]); v0 = Math.min(v0, p[1]); v1 = Math.max(v1, p[1]); area2 += p[0] * q[1] - q[0] * p[1];
  }
  const off: Vec3 = [0, 0, 0], h: Vec3 = [0, 0, 0];
  if (poly.length < 3 || !(Math.abs(area2) > 1e-12) || !(halfT > 0)) return { off, h, cut: undefined, dropped: 0, empty: true };
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2; off[ua] = cu; off[va] = cv; h[axis] = halfT; h[ua] = (u1 - u0) / 2; h[va] = (v1 - v0) / 2;
  const sgn = area2 > 0 ? 1 : -1, planes: CutPlane[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length]; const eu = q[0] - p[0], ev = q[1] - p[1];
    if (Math.abs(eu) + Math.abs(ev) < 1e-12) continue;
    const n: Vec3 = [0, 0, 0]; n[ua] = sgn * ev; n[va] = -sgn * eu;                 // outward normal of the edge (the polygon's inside is on its other side)
    const at: Vec3 = [0, 0, 0]; at[ua] = p[0] - cu; at[va] = p[1] - cv;
    planes.push(cutThrough(at, n));
  }
  const r = cutRecord(h, planes);
  return { off, h, cut: r.cut, dropped: r.dropped, empty: r.empty };
}

/** GLASS on a cut box (Box.cutGlass — picture only, the g-buffer's cut pass): the box's two faces across its own z (a glass plate: cutPrism over z) are drawn see-through by a
 *  screen door — `see` of their pixels (0‥0.98; fewer toward a grazing view) are left to what is behind — inside a rim `rim` pixels wide (0‥3.75, in quarters) that
 *  is drawn, with the cut faces and the box's side faces, in the core colour: the bright edge of sheet glass. `anim` = the door's pattern steps with the TAAU jitter
 *  (the resolve averages it to a tint); false = one fixed pattern. No ray sees any of it. */
export interface CutGlass { see: number; rim: number; anim?: boolean }
/** the record as the GPU gets it: CUT_STRIDE vec4 rows at dst[o‥o + CUT_STRIDE × 4) — CUT_ROWS plane rows (n.xyz, d), the unused ones CUT_PAD, then the core row
 *  (core.rgb, w), all zero without a core colour and without glass. w = 1 (a core colour) + 2 (glass) + 4 (its pattern steps) + 8 × the rim in quarter pixels, + the
 *  see-through share as its fraction: 1 exactly = a plain core, as before glass existed (gbuffer_cut.wgsl fsBoxCut decodes it). `round` (Box.cutRound, 1‥3; not with
 *  glass) adds 128 × itself: the picture shades the prism's faces round that axis as one round face. `old` (Box.cutOld; not with glass) adds 512: an old break.
 *  `arc` (Box.cutArc; with `round`, and only where the record leaves its last row unused) rides in that unused row's w as CUT_PAD's 1 + arc: no reader of a
 *  plane looks past a zero normal. */
export function packCut(cut: readonly CutPlane[], dst: Float32Array, o: number, core?: Vec3, glass?: CutGlass, round = 0, old = false, arc = 0) {
  for (let k = 0; k < CUT_ROWS; k++) {
    const c = k < cut.length ? cut[k] : undefined, q = o + k * 4;
    if (c) { dst[q] = c.n[0]; dst[q + 1] = c.n[1]; dst[q + 2] = c.n[2]; dst[q + 3] = c.d; }
    else { dst[q] = CUT_PAD[0]; dst[q + 1] = CUT_PAD[1]; dst[q + 2] = CUT_PAD[2]; dst[q + 3] = CUT_PAD[3]; }
  }
  if (arc > 0 && round >= 1 && cut.length < CUT_ROWS) dst[o + (CUT_ROWS - 1) * 4 + 3] = CUT_PAD[3] + arc;
  const q = o + CUT_ROWS * 4;
  if (core) { dst[q] = core[0]; dst[q + 1] = core[1]; dst[q + 2] = core[2]; dst[q + 3] = 1; } else { dst[q] = 0; dst[q + 1] = 0; dst[q + 2] = 0; dst[q + 3] = 0; }
  if (glass) dst[q + 3] += 2 + (glass.anim ? 4 : 0) + 8 * Math.round(Math.min(3.75, Math.max(0, glass.rim)) * 4) + Math.min(0.98, Math.max(0, glass.see));
  else dst[q + 3] += (round >= 1 && round <= 3 ? 128 * round : 0) + (old ? 512 : 0);   // (Box.cutRound: 128 × (1 + the axis), above the rim's four bits; Box.cutOld: 512 — never with glass)
}

/** THE CPU CLIP every ray / segment test shares: the interval [t0, t1] of the local line o + t·d already inside the uncut box, cut down by the record. Result in
 *  CUT_CLIP: { t0, t1, k = the plane the line ENTERS the solid through at t0 (−1 = t0 was not moved: the box's own face, or the origin) }; false = nothing left.
 *  The same statements as common.wgsl isectCut. */
export const CUT_CLIP = { t0: 0, t1: 0, k: -1 };
export function cutClip(cut: readonly CutPlane[], ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, t0: number, t1: number): boolean {
  let k = -1;
  for (let i = 0; i < cut.length && i < MAX_CUT_PLANES; i++) {
    const n = cut[i].n; if (n[0] === 0 && n[1] === 0 && n[2] === 0) break;
    const den = n[0] * dx + n[1] * dy + n[2] * dz, num = cut[i].d - (n[0] * ox + n[1] * oy + n[2] * oz);
    if (den < 0) { const t = num / den; if (t > t0) { t0 = t; k = i; } }
    else if (den > 0) { const t = num / den; if (t < t1) t1 = t; }
    else if (num < 0) return false;
    if (t0 > t1) return false;
  }
  CUT_CLIP.t0 = t0; CUT_CLIP.t1 = t1; CUT_CLIP.k = k; return true;
}
