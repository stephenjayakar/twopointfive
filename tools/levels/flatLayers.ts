// FLAT DECALS IN ORDER — the heights of the look's floor decals, so the picture can tell which lies on which.
//
// The fault (the maintainer, 10-11, on the block: "also seeing some zorder issues on the floor in the screenshot"): the skins told two decals that cross apart
// by 20 µm of height (`+ (n % 100) * 0.00002`). The depth buffer cannot: depth32float, near 0.5 m, far 120 m, near → 0 (src/math/vec.ts perspective) holds
// about 1.2e-7 × z² metres a step at z metres from the camera — 52 µm at the camera's own 21 m, 190 µm zoomed out to 40. Two paints 20 µm apart share a depth
// there and every pixel of the overlap goes to whichever the rasteriser's rounding favours: a cover plate through its chamber's rim, a ring through a trench.
// The look had only ever been drawn on the software adapter; it was first seen on a GPU.
//
// The rule: where two flat decals of DIFFERENT paint overlap on the plan, the upper one's top face is at least `FLAT_STEP` above the lower one's — about
// ten depth steps at 21 m seen from the camera's pitch, three at 40 (and small enough that no decal's centre crosses a centimetre: a checkpoint's level
// fingerprint, savestate.ts, is the same before and after). Which is the upper one is what the skin wrote (the higher top; the later one where they tie). Two of the SAME paint are left
// alone: whichever wins a pixel, it is the same pixel — so a path's joints and a ring's corners do not climb a step each. Nothing is moved that did not have
// to be, and nothing is moved down.
import type { Vec3 } from '../../src/math/vec';

export interface Flat { c: Vec3; h: Vec3; yaw?: number }
/** the least height between the top faces of two flat decals of different paint that overlap on the plan (m) */
export const FLAT_STEP = 0.0007;
/** a flat decal: thin, lying down, at the floor (a rug is thicker and stands clear of them all; a wall's dado is tall). Up to 5 cm: the marks laid ON a carpet
 *  (the consulate's stars, 3 cm up, were 0.2 mm apart and past the 3 cm this stopped at) */
export const isFlat = (b: Flat) => b.h[1] <= 0.004 && b.c[1] + b.h[1] <= 0.05 && b.c[1] - b.h[1] >= 0;

const top = (b: Flat) => b.c[1] + b.h[1];
/** do the two overlap on the plan by more than `slack` (two that only touch along an edge do not)? Rectangles turned about y: local x = (cos, −sin). */
export function flatsOverlap(a: Flat, b: Flat, slack = 0.002): boolean {
  const dx = b.c[0] - a.c[0], dz = b.c[2] - a.c[2];
  if (dx * dx + dz * dz >= (Math.hypot(a.h[0], a.h[2]) + Math.hypot(b.h[0], b.h[2])) ** 2) return false;
  const ca = Math.cos(a.yaw ?? 0), sa = Math.sin(a.yaw ?? 0), cb = Math.cos(b.yaw ?? 0), sb = Math.sin(b.yaw ?? 0);
  const ax: [number, number][] = [[ca, -sa], [sa, ca]], bx: [number, number][] = [[cb, -sb], [sb, cb]];
  for (const [ux, uz] of [...ax, ...bx]) {
    const ra = a.h[0] * Math.abs(ux * ax[0][0] + uz * ax[0][1]) + a.h[2] * Math.abs(ux * ax[1][0] + uz * ax[1][1]);
    const rb = b.h[0] * Math.abs(ux * bx[0][0] + uz * bx[0][1]) + b.h[2] * Math.abs(ux * bx[1][0] + uz * bx[1][1]);
    if (Math.abs(dx * ux + dz * uz) >= ra + rb - slack) return false;
  }
  return true;
}
const samePaint = (p: readonly number[], q: readonly number[]) => p[0] === q[0] && p[1] === q[1] && p[2] === q[2];

/** Raise, where it has to be, each flat's centre so the rule above holds. `paint(b)` = the colour it is drawn in. `fixed` = flats of the level itself that lie
 *  among them (a threshold, a mat): never moved, and a decal that lies on one keeps the same step over it — as does one raised to within a step UNDER one
 *  (it goes over it: nothing is moved down, and a fixed one cannot give way). `grow(b)` = this one is SOLID (feet and rounds land
 *  on it): its top is raised by making it thicker, its underside staying where it was — a decal is moved whole. Returns how many moved and the highest top. */
export function layFlats<T extends Flat>(flats: T[], paint: (b: T) => readonly number[], step = FLAT_STEP, fixed: T[] = [], grow?: (b: T) => boolean): { moved: number; top: number; was: Map<T, number> } {
  const order = [...flats.map(b => ({ b, fix: false })), ...fixed.map(b => ({ b, fix: true }))].map((x, i) => ({ ...x, i, t: top(x.b), p: paint(x.b) })).sort((x, y) => x.t - y.t || +y.fix - +x.fix || x.i - y.i);
  const was = new Map<T, number>(); let moved = 0, high = 0;
  for (let k = 0; k < order.length; k++) { const d = order[k]; if (d.fix) continue; let t = d.t;
    // what lies under it (everything before it in the order) it must clear by a step; a FIXED one that started above it (after it in the order) it must
    // either stay a step under or, once it has been raised to within a step of it, go over — asked again until nothing moves it (it only ever goes up)
    for (let again = true; again;) { again = false;
      for (let j = 0; j < order.length; j++) { const e = order[j]; if (j === k || (j > k && !e.fix)) continue;
        if (e.t + step <= t + 1e-9 || (j > k && t + step <= e.t + 1e-9) || samePaint(d.p, e.p) || !flatsOverlap(d.b, e.b)) continue;
        t = e.t + step; again = true; } }
    if (t > d.t + 1e-9) { t = Math.round(t * 1e5) / 1e5; was.set(d.b, d.t); moved++;
      if (grow?.(d.b)) { const y0 = d.b.c[1] - d.b.h[1], hh = Math.round((t - y0) * 5e5) / 1e6; d.b.h[1] = hh; d.b.c[1] = Math.round((y0 + hh) * 1e6) / 1e6; d.t = d.b.c[1] + hh; }
      else { d.t = t; d.b.c[1] = Math.round((t - d.b.h[1]) * 1e5) / 1e5; } }
    high = Math.max(high, d.t);
  }
  return { moved, top: high, was };
}

/** the pairs that break the rule (for the check): different paint, overlapping on the plan, tops nearer than `gap`. With `fixed`, also a flat against one
 *  of the level's own. */
export function flatClashes<T extends Flat>(flats: T[], paint: (b: T) => readonly number[], gap = FLAT_STEP - 2e-5, fixed: T[] = []): [T, T][] {
  const out: [T, T][] = [], all = [...flats, ...fixed], ps = all.map(paint);
  for (let i = 0; i < flats.length; i++) for (let j = i + 1; j < all.length; j++)
    if (Math.abs(top(all[i]) - top(all[j])) < gap && !samePaint(ps[i], ps[j]) && flatsOverlap(all[i], all[j])) out.push([all[i], all[j]]);
  return out;
}

// ---- EVERY LEVEL'S OWN FLOOR (the maintainer, 10-11, on Training 3: "more bad zsorting in tutorial level") ----
// The sweep above was the look's skin's alone. The same fault stood in levels built straight from the kit: two GROUND FINISHES laid one over the other at the
// same 4 mm (the training ground's gravel court and generator slab over the yard's dirt; the police post's room floors over its ground), two floor decals that
// cross at one height (a pair of trenches, two mats) — tops in the SAME plane, so on a GPU each pixel of the overlap went to either paint and the split moved
// with the camera. tools/levels/export.ts now runs `layFloor` over every level it writes, before the look's skin: the same rule, asked of everything drawn
// whose top face is at the floor. A solid finish is raised by making it thicker (0.7 mm: nothing a foot, a round or a save's fingerprint can tell).
// TIERS: what a switch can leave out of a loaded level (lived-in furniture, then the dressing) is swept AFTER what it stands on, which it never moves — so the
// level without them is the same level, heights included.

/** thin and at the floor: what the export's sweep may raise (wider than `isFlat`: a rug, a mat, a ground finish) */
export const isFloorFlat = (b: Flat) => b.h[1] <= 0.008 && top(b) <= 0.05 && b.c[1] - b.h[1] >= -1e-6;
/** anything whose TOP FACE is at the floor: what a floor flat can share a plane with (the ground slab itself, a thick threshold) */
export const atFloor = (b: Flat) => top(b) <= 0.05 && top(b) > -0.01;
/** how a caller's boxes are read: the colour drawn, is it drawn at all (not NoPrimary, not glass), is it a decal (NoShadow: no ray, foot or round meets it) */
export interface FlatView<T> { paint(b: T): readonly number[]; drawn(b: T): boolean; decal(b: T): boolean }

/** The export's sweep: each tier's floor flats laid in order over everything of the tiers before it (never moved) and its own thick floor-level boxes. Returns how many were raised. */
export function layFloor<T extends Flat>(tiers: T[][], v: FlatView<T>, step = FLAT_STEP): number {
  let moved = 0; const below: T[] = [];
  for (const tier of tiers) { const drawn = tier.filter(b => v.drawn(b) && atFloor(b)), mov = drawn.filter(isFloorFlat);
    moved += layFlats(mov, v.paint, step, [...below, ...drawn.filter(b => !isFloorFlat(b))], b => !v.decal(b)).moved; below.push(...drawn); }
  return moved;
}
/** THE export's sweep of one level's box list, said once, so a check that holds a file against its generator makes the same one. `lived` = the index of the first
 *  lived-in box, `gen` = of the first dressing box (each the list's length where the level has none); `F` = the three flag bits (this file imports nothing of the game). */
export function layLevelFloor<T extends Flat & { albedo: readonly number[]; flags?: number }>(boxes: T[], lived: number, gen: number, F: { NoPrimary: number; Glass: number; NoShadow: number }): number {
  return layFloor<T>([boxes.slice(0, lived), boxes.slice(lived, gen), boxes.slice(gen)],
    { paint: b => b.albedo, drawn: b => !((b.flags ?? 0) & (F.NoPrimary | F.Glass)), decal: b => !!((b.flags ?? 0) & F.NoShadow) });
}
/** … of a generator's level as `build()` hands it back (no dressing yet): its own boxes, then its lived things — the tail whose group `isLived` (src/scene/lived.ts)
 *  takes. What tools/qa's 'the file is the generator's level' lines call before they compare: the file was swept when it was written. */
export function layGeneratedFloor<T extends Flat & { albedo: readonly number[]; flags?: number }>(boxes: T[], groups: readonly (string | undefined)[] | undefined, isLived: (tag: string | undefined) => boolean, F: { NoPrimary: number; Glass: number; NoShadow: number }): number {
  const at = groups ? groups.findIndex(isLived) : -1; return layLevelFloor(boxes, at < 0 ? boxes.length : at, boxes.length, F);
}
/** the pairs of a level's floor-level boxes that break the rule (for the check): both drawn, different paint, overlapping on the plan, tops nearer than `gap` */
export function floorClashes<T extends Flat>(boxes: T[], v: FlatView<T>, gap = FLAT_STEP - 2e-5): [T, T][] {
  const fl = boxes.filter(b => v.drawn(b) && atFloor(b)); return flatClashes(fl, v.paint, gap);
}
