// BRISK THROUGH AN OPEN DOOR'S LINE ON THE WALK UP (STACKLINE.on — ships on; `?nostackline` for a visit, TPS_STACKLINE in the harness's environment).
// A man ordered to stack on a door walks briskly (ORDERS.brisk) until he is `briskIn` from his mark and takes the last steps slowly (ORDERS.onto). When the
// door STANDS OPEN those slow steps are taken in what the room beyond can see — and shoot — through it, and the man whose mark is past the opening crosses
// its whole front at them. Traced on the warehouse with four (seed 9, shipped stand): the squad has taken the front office; the door from it to the manager's
// office was pulled open by a defender eleven seconds before; 'stack up' on it finds the four standing in what the manager's office sees through that
// opening (that small room is all line: 6 to 10 m² of their floor can see any spot of it); Blue Two's mark is at the far jamb, and one second and 0.9 m into
// his walk he is shot through the opening by a man who has just come into the manager's office by its other door.
//
//   THE RULE   a man walking to a mark of the order 'stack' on a door that stands open, on his mark's face of it and with a clear line at chest height to
//              the mouth of the opening, does not drop to the slow last steps: he keeps the orders' own brisk walk (ORDERS.brisk, handed in by the
//              caller — nobody runs) until he is on his mark. That is all.
//   NOT        a shut door (a leaf stops a round: the walk up to it is as it was) · a team in the silent posture (silent.ts: it keeps its own pace) · any
//              mark that carries a pace of its own (the threshold's slice, the entry) · a man already on his mark · the door tools' OWN walk-ups (a tool
//              given straight on a door files the men under the tool's order, not 'stack': those marks keep their slow last steps — not covered, and
//              not measured).
//   WHAT IT IS NOT: a way round. One was built first — the walk priced by the floor beyond the door that can see each step — and measured on every door face
//              of every squad level: it found a better way for one walk in eight, took 3 % off the line for 1.4 % more walking, and left one stack that
//              no longer formed (the way round a standing leaf is through it). The room in front of an open door is nearly all line; there is no way round
//              to find. It is not in the code. The pace alone takes 14 to 16 % off the line and forms the stack a third of a second sooner.
// Nothing here moves a mark (stackroom.ts, orders.ts stackPosts — a mark beside an open door is itself in its line, and that is theirs), deals a watch
// (cover.ts, rearwatch.ts), finds a way (orders.ts route) or touches the entry (doortools.ts). No state: four sight lines a frame for a man on his last
// steps, asked of the level's solids and the leaves as they stand — nothing to save, no dice, nothing read off a camera or a graphics setting.
// (src/game is one import cycle: nothing below is built from another game module's exports at module load.)
import type { Vec3 } from '../math/vec';
import type { Game, Guard } from './game';
import type { Door } from './doors';
import type { Assignment } from './orders';
import { frameOf } from './guards';
import { squadSilent } from './silent';

export const STACKLINE = {
  /** THE switch: off = the slow last steps onto a stack mark whatever the door, as they were */
  on: true,
  /** a leaf at this angle or more (rad), unlatched, STANDS OPEN (rearwatch.ts's own figure); one off its hinges always does */
  ajar: 0.6,
  /** strips the opening is cut into · the height a line is asked at (m) · how far short of the frame line a sight line to a strip ends (so the frame's own
   *  jambs are not in it) */
  bins: 4, eye: 1.2, inset: 0.2,
  /** within this of his mark he is on it: the order's own last settle, never paced (m) */
  onMark: 0.35,
};
/** frames a man was kept at the brisk pace */
export const STACKLINE_STATS = { paced: 0 };

/** a leaf that stands open (or is off its hinges): what is beyond it sees through it NOW */
export function stackLineOpen(d: Door): boolean { return !!d.off || (!d.latched && Math.abs(d.angle) >= STACKLINE.ajar); }
/** has the floor point `p`, on the face `face` of `d`, a clear line at chest height to the mouth of its opening (a point `inset` out from any strip of it)
 *  — the level's solids and the leaves as they stand. Wider than 'some floor beyond sees him' by the jambs' thickness: a man hard beside the frame counts */
export function stackLineSees(g: Game, d: Door, p: Vec3, face: 1 | -1): boolean {
  const K = STACKLINE, F = frameOf(d);
  for (let k = 0; k < K.bins; k++) { const a = F.W * (k + 0.5) / K.bins, dx = F.hx + F.ux * a + F.nx * face * K.inset - p[0], dz = F.hz + F.uz * a + F.nz * face * K.inset - p[2], L = Math.hypot(dx, dz);
    if (L < 0.05 || !g.col.raycast([p[0], K.eye, p[2]], [dx / L, 0, dz / L], L)) return true; }
  return false;
}
/** THE PACE for a man `left` metres short of his mark: `brisk` (the caller's own brisk walk), or null — not a man walking up to a stack on a door that
 *  stands open with a line to its mouth (the head comment's terms) */
export function stackLinePace(g: Game, gd: Guard, A: Assignment, left: number, brisk: number): number | null {
  const K = STACKLINE; if (!K.on || A.order !== 'stack' || !A.shy || A.shy !== A.door || !A.post || left < K.onMark) return null;
  const d = A.shy, p = gd.char.pos; if (!stackLineOpen(d) || squadSilent(g)) return null;
  const F = frameOf(d), face = (A.post[0] - F.hx) * F.nx + (A.post[2] - F.hz) * F.nz >= 0 ? 1 : -1; if (((p[0] - F.hx) * F.nx + (p[2] - F.hz) * F.nz) * face < 0.05 || !stackLineSees(g, d, p, face)) return null;
  STACKLINE_STATS.paced++; return brisk;
}
