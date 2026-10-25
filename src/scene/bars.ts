// A WINDOW'S BARS (game/winbars.ts WINBARS — the maintainer, of The Pass's windows: 'for gameplay it'd be nice if they broke off with the glass and just as
// fast. so each bar breaks up with just a single bullet?'). The level kit stands an upright in a window between its bays (levelKit.ts wallX / wallZ, a
// `mullions` count: 8 cm across, four fifths of its wall deep, sill to head); the level file keeps it as a box like any other. As a level is stood up, those
// boxes are marked here (BoxFlag.Bar) and the game's rule reads the mark while its switch is on.
//
// THE RULE, by the box alone (no name, group or material is asked):
//   · UPRIGHT AND SLIM: no more than BAR_ACROSS across and BAR_DEEP deep in plan (its full size), at least BAR_TALL high and higher than it is deep; not
//     tilted, cut, lit, glass or only a picture;
//   · IN A WALL'S OPENING: its foot on a sill at least SILL_MIN off the floor and its head under a lintel, each a piece of a wall the bar is KIT_DEEP of as
//     deep as (the kit's own proportion: a conduit on a breaker box and a pipe on a stove are not) — glazed or not.
// So a post, a table's leg, a door's jamb, a wall's end piece and the floor-to-ceiling uprights of a glazed partition (the office's conference wall: they
// hold the wall's head up) are no bars. On the levels as they stand the rule names every upright the kit built in a window and nothing else
// (tools/qa/winbars-check.ts counts them against the kit's own paint).
import { Box, BoxFlag } from './boxes';

/** a bar's full size in plan (m): across (along its wall) and deep (through it) at most; and how high at least */
export const BAR_ACROSS = 0.1, BAR_DEEP = 0.25, BAR_TALL = 0.4;
/** a bar in a wall's opening stands on a sill at least this far off the floor (m) and is this share of its wall deep (the kit builds 0.8) */
const SILL_MIN = 0.2, KIT_DEEP: readonly [number, number] = [0.72, 0.88];
/** how close counts as touching (m) */
const TOUCH = 0.02;

const plain = (b: Box): boolean => !(b.flags & (BoxFlag.Glass | BoxFlag.NoShadow | BoxFlag.NoPrimary | BoxFlag.Dynamic)) && !b.rot && !b.round && !(b.cut && b.cut.length > 0);
const slim = (b: Box): boolean => plain(b) && b.emissive[0] + b.emissive[1] + b.emissive[2] <= 0 && 2 * Math.min(b.h[0], b.h[2]) <= BAR_ACROSS && 2 * Math.max(b.h[0], b.h[2]) <= BAR_DEEP
  && 2 * b.h[1] >= BAR_TALL && b.h[1] > Math.max(b.h[0], b.h[2]);
/** p (world, plan) in b's own frame (common.wgsl isectBox: local = (c·x − s·z, s·x + c·z)) */
function local(b: Box, x: number, z: number): [number, number] { const dx = x - b.c[0], dz = z - b.c[2], c = Math.cos(b.yaw), s = Math.sin(b.yaw); return [c * dx - s * dz, s * dx + c * dz]; }
/** how deep `w` is along the bar's own deep axis where the bar stands on / under it, or 0: `w` is no wall's piece there (the bar's middle is off its footprint) */
function wallDeep(bar: Box, w: Box, deepX: boolean): number {
  const [lx, lz] = local(w, bar.c[0], bar.c[2]); if (Math.abs(lx) > w.h[0] + TOUCH || Math.abs(lz) > w.h[2] + TOUCH) return 0;
  const turn = Math.abs(Math.cos(w.yaw - bar.yaw)), along = turn > 0.99, cross = turn < 0.01; if (!along && !cross) return 0;
  return 2 * ((deepX === along) ? w.h[0] : w.h[2]);
}
/** a bar in a wall's opening: a sill under its foot and a lintel over its head, both pieces of a wall it is the kit's share of as deep as */
function inOpening(a: Box, boxes: readonly Box[]): boolean {
  const y0 = a.c[1] - a.h[1], y1 = a.c[1] + a.h[1], deep = 2 * Math.max(a.h[0], a.h[2]); if (y0 < SILL_MIN) return false;
  // (which of its own axes runs through the wall: the longer one in plan — a bar square in plan is asked both ways)
  for (const deepX of Math.abs(a.h[0] - a.h[2]) < 1e-6 ? [true, false] : [a.h[0] > a.h[2]]) {
    let sill = false, head = false;
    for (const b of boxes) {
      if (b === a || !plain(b)) continue;
      const foot = Math.abs(b.c[1] + b.h[1] - y0) <= TOUCH, top = Math.abs(b.c[1] - b.h[1] - y1) <= TOUCH; if (!foot && !top) continue;
      const t = wallDeep(a, b, deepX); if (t <= 0 || deep < KIT_DEEP[0] * t || deep > KIT_DEEP[1] * t) continue;
      if (foot) sill = true; else head = true;
      if (sill && head) return true;
    }
  }
  return false;
}
/** is `a` a window's bar among `boxes` (the rule above)? */
export function isBar(a: Box, boxes: readonly Box[]): boolean { return slim(a) && inOpening(a, boxes); }
/** every static's bar mark off (host/standup.ts, before round.ts roundLevel looks for its plain slabs on a level stood up a second time) */
export function barClear(boxes: Box[]): void { for (const b of boxes) b.flags &= ~BoxFlag.Bar; }
/** A LEVEL'S WINDOW BARS, as it is stood up (host/standup.ts populateHost, after round.ts roundLevel): every static's mark is taken off, then put on the ones
 *  the rule names. Idempotent. Marked whether or not WINBARS.on is up — the mark is read only by that rule, and only while it is (so a recording's tables,
 *  laid over the knobs after its level stands, still decide). Returns how many are marked. */
export function barLevel(boxes: Box[]): number {
  barClear(boxes);
  const bars = boxes.filter(b => isBar(b, boxes));   // (judged before any mark is set: the rule does not read the mark)
  for (const b of bars) b.flags |= BoxFlag.Bar;
  return bars.length;
}
