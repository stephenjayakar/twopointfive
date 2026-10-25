// THIN THINGS THAT STAND FREE (game/fogofwar.ts FOG.thin — the maintainer, of a taken room on The Pass: 'weird vertical striations due to fog of war + squad's
// vision'). The fog of war's eye — the squad's own line of sight (collision.ts segmentBlocked) and the picture's ray (common.wgsl occludedTBoxes) alike — was
// stopped by ANY static box, so a stovepipe ten centimetres across, a window's bar or a lone post each threw a sliver of 'not seen' across everything behind
// it. As a level is stood up, the statics a look goes round are marked here (BoxFlag.Thin) and the fog's two eyes pass them while FOG.thin is on.
//
// THE RULE, by the box alone (no name, group or material is asked):
//   · NARROW: under THIN_WIDTH across in plan BOTH ways (its full size; a round box by its diameter) — a rail, a low wall's cap or a plank is long one way;
//   · FREE: nothing stands BESIDE it. Another solid box whose footprint meets its own (grown by a finger) over a real share of its height makes it part of
//     something: a door's jamb is beside its wall and its stop beside the jamb (they are what seals a shut leaf: with them passed, every shut door leaked),
//     a wall's short end piece is beside the wall, a pilaster is on one. What a thing stands ON or UNDER (the floor, a stove, a lintel, a sill, a roof it goes
//     through) is not beside it, and neither is a pane of glass (a look goes through that anyway) nor the other slabs of the same round thing;
//   · NOT A DOOR'S: nothing within DOOR_NEAR of a door's shut leaf is marked, whatever stands beside it (a jamb between its leaf and a glass sidelight has
//     nothing solid beside it, and is still what the leaf shuts against).
// A fully rotated or cut box is never marked, nor one no ray meets.
import { Box, BoxFlag } from './boxes';

/** a static narrower than this both ways in plan (m, its full size) can be one a look goes round: over a stovepipe (0.10), a window's bar (0.19) and a
 *  slim post (0.18); under a gate post (0.34), a wall's end piece (0.24 thick and longer) and a pillar */
export const THIN_WIDTH = 0.25;
/** how close in plan counts as beside (m), and the share of the thin box's height that must have something beside it (added up over its neighbours).
 *  These three and DOOR_NEAR are the rule itself, not knobs: a level is marked as it stands up, so changing one changes what an old recording's level marks */
const BESIDE = 0.03, SHARE = 0.25;
/** nothing this near a door's shut leaf in plan (m; the leaf's line from a hand before its hinge to a hand past its latch) is marked */
export const DOOR_NEAR = 0.3;
/** a door as this rule needs it (scene/level.ts LevelDoorDef's own fields) */
export interface ThinDoor { hinge: [number, number]; closedDir: number; width: number }
function atDoor(b: Box, doors: readonly ThinDoor[]): boolean {
  if (b.c[1] - b.h[1] > 2.2) return false;   // (over the head of every leaf)
  for (const d of doors) {
    const ux = Math.cos(d.closedDir), uz = Math.sin(d.closedDir), px = b.c[0] - d.hinge[0], pz = b.c[2] - d.hinge[1], t = Math.max(-0.1, Math.min(d.width + 0.1, px * ux + pz * uz));
    if (Math.hypot(px - ux * t, pz - uz * t) < DOOR_NEAR) return true;
  }
  return false;
}

const solid = (b: Box): boolean => !(b.flags & (BoxFlag.NoShadow | BoxFlag.Glass));
const narrow = (b: Box, width: number): boolean => !b.rot && !(b.cut && b.cut.length > 0) && 2 * Math.max(b.h[0], b.h[2]) < width;
/** a's footprint grown by `pad`, against b's: the two yawed rectangles overlap in plan (separating axes: each one's two; a box's local x and z in the world's
 *  plan are (c, −s) and (s, c) — common.wgsl isectBox: local = (c·x − s·z, s·x + c·z)) */
function plansMeet(a: Box, b: Box, pad: number): boolean {
  const dx = b.c[0] - a.c[0], dz = b.c[2] - a.c[2];
  const ca = Math.cos(a.yaw), sa = Math.sin(a.yaw), cb = Math.cos(b.yaw), sb = Math.sin(b.yaw);
  const ahx = a.h[0] + pad, ahz = a.h[2] + pad, bhx = b.h[0], bhz = b.h[2];
  const ac = Math.abs(ca * cb + sa * sb), as = Math.abs(sa * cb - ca * sb);   // (|cos|, |sin| of the turn between the two)
  if (Math.abs(dx * ca - dz * sa) > ahx + bhx * ac + bhz * as) return false;
  if (Math.abs(dx * sa + dz * ca) > ahz + bhx * as + bhz * ac) return false;
  if (Math.abs(dx * cb - dz * sb) > bhx + ahx * ac + ahz * as) return false;
  if (Math.abs(dx * sb + dz * cb) > bhz + ahx * as + ahz * ac) return false;
  return true;
}
/** b's centre is inside a's footprint (grown by `pad`): two slabs of one round thing, not two things side by side */
function centreIn(a: Box, b: Box, pad: number): boolean {
  const dx = b.c[0] - a.c[0], dz = b.c[2] - a.c[2], c = Math.cos(a.yaw), s = Math.sin(a.yaw);
  return Math.abs(c * dx - s * dz) <= a.h[0] + pad && Math.abs(s * dx + c * dz) <= a.h[2] + pad;
}
/** Does `a` stand free among `boxes` — narrow, and nothing solid beside it (the rule above, but for the doors: thinLevel asks those)? What stands beside
 *  it is ADDED UP over its neighbours: three courses of a wall, each beside a tenth of a post that closes a gap in it, are a wall beside it. */
function standsFree(a: Box, boxes: readonly Box[], width = THIN_WIDTH): boolean {
  if (!solid(a) || !narrow(a, width)) return false;
  const a0 = a.c[1] - a.h[1], a1 = a.c[1] + a.h[1], need = Math.max(0.02, SHARE * (a1 - a0)), ra = Math.hypot(a.h[0], a.h[2]) + BESIDE;
  let beside = 0;
  for (const b of boxes) {
    if (b === a || !solid(b)) continue;
    const over = Math.min(a1, b.c[1] + b.h[1]) - Math.max(a0, b.c[1] - b.h[1]);
    if (over <= 0) continue;   // (above it or under it)
    const dx = b.c[0] - a.c[0], dz = b.c[2] - a.c[2], reach = ra + (b.rot ? Math.hypot(b.h[0], b.h[1], b.h[2]) : Math.hypot(b.h[0], b.h[2]));
    if (dx * dx + dz * dz > reach * reach) continue;   // (nowhere near — and a tumbled box is judged by this alone, its sphere: rare among statics, and the careful answer is 'beside')
    if (!b.rot) {
      if (!plansMeet(a, b, BESIDE)) continue;
      if (narrow(b, width) && centreIn(a, b, 0)) continue;   // (the same thing's other slab: its middle is inside this one — a door's stop beside its jamb is not)
    }
    beside += over; if (beside > need) return false;
  }
  return true;
}
/** every mark off (host/standup.ts, before round.ts roundLevel reads the list: it knows the kit's octagon by slabs that carry no flag) */
export function thinClear(boxes: Box[]): void { for (const b of boxes) b.flags &= ~BoxFlag.Thin; }
/** A LEVEL'S THIN THINGS, as it is stood up (host/standup.ts populateHost, after round.ts roundLevel: a round pipe is one box by then): every static's mark
 *  is taken off, then put on the ones that stand free. Idempotent. Marked whether or not FOG.thin is on — the mark is read only by the fog's own eyes and, under FOG.mates, a teammate's (guards.ts eyeThrough), and
 *  only while it is (so a recording's tables, laid over the knobs after its level stands, still decide). Returns how many are marked. */
export function thinLevel(boxes: Box[], doors: readonly ThinDoor[] = [], width = THIN_WIDTH): number {
  thinClear(boxes);
  const free = boxes.filter(b => solid(b) && narrow(b, width) && !atDoor(b, doors) && standsFree(b, boxes, width));   // (judged before any mark is set: the rule does not read the mark)
  for (const b of free) b.flags |= BoxFlag.Thin;
  return free.length;
}
