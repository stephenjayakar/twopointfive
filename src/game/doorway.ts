// DOORWAY MANNERS: how a man on foot shares a doorway with his own side. The maintainer, 10-08: "doors could use some work too … AI does a better job not
// crowding". Measured on the build before this file (tools/qa/door-watch.ts over the loud levels): every man plans his walk as if he were alone (guards.ts goTo)
// and the only thing between two of one side is the push that parts their bodies at 0.6 m (collideGuard) — so a file told to fall in or to stack went through a
// frame two abreast and shoving, a follower stopped 'near enough' in the leaf's swing or on top of the man beside him, and a defender who got his line from a
// threshold planted on it and fought from there with a colleague behind him wanting through. Three rules, for the squad (team 'operative') and the defenders
// (team 'hostile') alike, all from where the men ARE and where they are walking — nothing scripted, no new order, nobody runs:
//   PASS  (doorwayGate, the first thing followPath / the scripted strafe ask): a man whose walk goes through a frame within `reach` looks at his own side about
//         it. A friend going his way ahead of him is followed at `gap` (pace eased from `gap` down to nothing at `gapMin`: one in the opening at a time, nobody
//         pushed through; a friend standing on his line by a door, his own way on past him, is walked ROUND — a corner put in his walk beside the man —
//         and one standing where his own place is, is stopped short of). A friend STANDING in the opening, standing just beyond it, or coming the other way and nearer the frame than he is, holds him short
//         of it (`throat`) — and held more than `aside` seconds he steps to a place off a jamb on his own face (`jambOut` off the wall, `jambPast` past the
//         jamb, a `fileGap` between places, clear of the leaf's swing and of everybody), turned to the door, and goes when it is free. A man IN an opening is
//         never held: he clears it. Nobody waits for ever: `patience` seconds held and he goes anyway (the old shove), with `rest` seconds before he can be
//         held again — under every caller's own stall clock, so a held man is never called stuck or planted 'going nowhere' for it.
//   STAND (doorwayStand, asked by orders.ts for a place in the file): no place in the file is in a frame's strip or where a leaf swings, shut or open, and a
//         follower who has stopped 'near enough' on top of the man ahead of him walks on to his own place. (The swing costs length: places slide back
//         along the trail past the arc, so by a door the file stands a metre or two longer behind Sam — `swing` off keeps the strip only. Stepping the
//         place sideways out of the arc instead was tried: its men were off the trail when Sam walked on and fell further behind.)
//   FIGHT (offThreshold, asked by the fight AI where it would plant and fire): planted in an open doorway `funnel` seconds, he steps off the opening — the
//         squad through it to the side its man is on, a defender back off it on his own side — to a spot that still has the shot, instead of fighting from the frame.
//   STAND, THE LANE (doorwayLane; the squad only): doors stand open now (doors.ts DOORSTAY), and a door standing open is a line of fire from whoever is
//         beyond it. So no place in the file is in the lane of one either (`lane`: stepped square off it), the walk an order gives a man to a mark goes
//         round such a lane where there is a way round that takes no other door (`laneWalk`, orders.ts route), and on the walk to a stack the rear man's gun
//         is on a door standing open by the way (`watch`, cover.ts). Measured on the two squad maps where the door build lost men:
//         rebuild/doors/first-door/notes.md in the project files.
// DOORMANNERS.on off = none of it runs: the build as it was, digest for digest (each rule has its own switch under it for an A/B). The night shift's staff (team
// 'guard') are left as they were — the stealth game's frozen runs hold whatever the switch says.
// (src/game is one import cycle: nothing here is built from another game module's exports at module load.)
import { SideMap } from '../math/side';
import { Vec3, clamp, damp, approachAngle } from '../math/vec';
import type { Game, Guard } from './game';
import type { Door } from './doors';
import { frameOf, crossesDoor, goTo, teamLean } from './guards';
import { GLASSPEN } from './glasspen';

export const DOORMANNERS = {
  /** THE switch: off = the build before this file, by run digest */
  on: true,
  /** its three rules, each off = that rule as it was (the head comment) */
  pass: true, stand: true, fight: true,
  /** STAND, the half of it that costs something: a place in the file also keeps off where a leaf swings (the file stands a metre or two longer by a door) */
  swing: true,
  /** metres of his walk ahead looked along for a frame; the strip either face of the frame line that is 'the opening'; how far short of the line a held man stops */
  reach: 3.0, half: 0.45, throat: 1.25,
  /** following a friend through: full pace at `gap` metres from him, none at `gapMin`; how hard he brakes for it (m/s²) */
  gap: 1.05, gapMin: 0.7, brake: 8,
  /** seconds held before he goes anyway (under every caller's own stall clock: the strafe's 1.2 s, the room fight's 1.5 s 'going nowhere', the orders' 4 s
   *  'stuck'), and before he can be held again; seconds held by a man standing just beyond the frame (he may be there to stay) */
  patience: 1.1, rest: 2.0, beyond: 0.6,
  /** seconds held before he steps off to a jamb; the place: metres off the wall, past the jamb, between places, from anybody else; the pace he steps at */
  aside: 0.4, jambOut: 0.6, jambPast: 0.5, fileGap: 0.9, apart: 0.85, step: 1.4,
  /** a friend standing on his line this near, his way on past him: he walks round, this far off the man's middle */
  round: 1.2, roundOut: 0.85,
  /** PASS, a friend ON HIS OWN MARK (his order's mark within `ownM` of his feet): he is a standing man whatever his feet are doing — settling onto it, or
   *  stepping back onto it after a nudge — so a man whose way goes on past him walks round him and is never walked into him; and the rule is also asked on
   *  the last `ownEndM` metres of a walk that ENDS by a door (a stack's second rank stands further than 2.5 m from the frame's middle: the man bound for the
   *  wall place beyond it shoved the rear man off his mark, onto his own, and the two then stood on each other's). Off = the rule as it was */
  ownPlace: true, ownM: 0.45, ownEndM: 2.5,
  /** AN OPEN LEAF ACROSS HIS WALK (the squad; doors.ts does it, game.ts hands it this row as `DoorContact.round`): a door pulled open toward a corridor stands
   *  across it, and a man whose walk goes through where the leaf stands herded it round to its frame with his body — onto the man ahead of him, who had to pull
   *  it again (the registry's copy room with four behind Sam: ten seconds on a door Sam had just opened, the leaf pressed back on the man re-opening it by the
   *  three behind). With this the back of a leaf standing open clear of its doorway is a wall to a teammate at a walk, and he goes along it and round its free
   *  end; where there is no way round he has it out of his way as before (`ROUND_SECS` pressed on it). Off = the leaf turns toward shut under him, as it was */
  leafRound: true,
  /** the swing: this far past the leaf's tip is still 'where it sweeps' */
  sweep: 0.2,
  /** STAND, the LANE of a door standing open (`laneAjar` rad or more, or off its hinges): the floor either face of its frame that a man beyond it looks — and
   *  shoots — straight down, out to `laneM` metres or the first wall; as wide as the opening and `laneOut` past each jamb, wider by `laneFlare` a metre of depth
   *  (what a man well back on the far side sees through it). No place in the file is in one, Sam stopped or walking: it is stepped square off it, `laneClear`
   *  past its edge, on the side its man is on (a place with no floor off the lane stays on the trail). Off = places only keep off the strip and the swing */
  lane: true, laneAjar: 0.6, laneM: 6, laneOut: 0.3, laneFlare: 0.12, laneClear: 0.15, laneApart: 0.7, laneMove: true, laneLeaf: true,
  /** STAND, on the walk to the next door: a door standing open by the way (`laneAjar`), with floor beyond it the team has not been on, is the REAR man's to
   *  watch for the whole walk to a stack (cover.ts: the last man of the file, the last two of four — at a walk, his gun on it over his shoulder or walking
   *  backwards past it), not only for his last steps to the mark. Off = on the walk every gun is forward, as it was */
  watch: true,
  /** STAND, a stack in a lane: a door order whose marks stand in the lane of a door standing open onto floor the team has not been on (the stack is what
   *  that door looks at) — one man of it does not walk onto his mark with his back to that door (doortools.ts laneCover: the one furthest from the ordered
   *  door who is not the lead): he covers it first, stood on the line from the middle of the stack through the middle of its opening, `coverM` metres short
   *  of the frame, his gun — and a searcher's weapon light, where guards.ts LIGHTS gives him one — down that line to `coverDeep` metres beyond it (where a
   *  man with a line onto the stack has to stand), while the lead gets onto the door they were sent to. He comes up to his own mark once the lead is on his
   *  and nothing living has been in his eyes for `coverQuiet` s (having looked `coverLook` s at least; `coverCap` s on the place at most, and at once on a
   *  captor's last warning — the door is not kept waiting past that), and the stack waits for him like for any man still walking.
   *  Off = every man straight to his mark, as it was */
  stackCover: true, coverM: 2.0, coverDeep: 2.5, coverLook: 0.8, coverQuiet: 1.0, coverCap: 8,
  /** STAND, the walk to a mark an order gives: the short way does not run down the lane of a door standing open onto floor the team has not been on —
   *  its cells past `laneStrip` metres of the frame cost `laneDear` times plain floor, and where the way round is at most `laneLong` times the short way + 1 m
   *  (and a metre or more of lane the less) it is the way walked (orders.ts route) — never a way through a door the short way does not take. A man going THROUGH
   *  such a door is not kept out of its lane. Its own switch: it does not need `lane` on. Open ground (a flood too big to be a room: cleared.ts) never counts
   *  as floor the team has been on, so a door onto a yard or a big hall stays priced, and the rear man's to watch, for the whole run.
   *  Off = the short way, as it was */
  laneWalk: true, laneDear: 6, laneStrip: 0.7, laneLong: 1.6,
  /** FIGHT: seconds planted in an open doorway before he steps off it, the rest after a step, metres through and past the jamb he steps to */
  funnel: 0.6, funnelRest: 1.5, through: 0.95, past: 0.6,
  /** FIGHT, a defender's step and cover (off = the step as it was): no spot he steps to is more exposed to a rifle at his man (or his fix) than the frame he
   *  stands in — covered, reached only through glass (a pane is no wall: glasspen.ts, at `GLASSPEN.stackEnergy`), reached in clear air — so from a covered
   *  frame he steps only to covered floor or stays; with nobody in his sights a covered spot comes before any other free one; and with them within
   *  `planeDeg` of the door's own wall line (never less than half a metre of it: neither face is 'away from them') covered floor on EITHER face will do —
   *  the face the half-plane calls theirs only ever under cover */
  stepCover: true, planeDeg: 30,
  /** REST (orders.ts restClear): a fall-in follower is not left standing in a frame's strip or where a leaf swings — with Sam stopped, a place the file's
   *  half-metre slack has left in one is given up for his place on the trail (or the nearest clear floor), and a man who has stood `restSecs` in one short
   *  of his place steps to the nearest clear floor (within `clearM`) and waits there. MARKS (orders.ts stackPosts): the stack marks
   *  of the men who are not at a jamb are moved off strips and swings the same way; PODS (doortools.ts offSwing, `podClear`, ships OFF): so are the points men are
   *  left on after an entry — measured on the barracks it loses the entry (11 runs won of 12 → 4: a corner point behind an open leaf is cover). SHORT (orders.ts
   *  restShort): a man who cannot get to his mark does not give it up standing in a strip or a swing, and the
   *  seconds the PASS gate holds him (`heldCap` of them an order) are not counted toward 'stuck'. Each off = as it was */
  restClear: true, restSecs: 1.0, markClear: true, podClear: false, clearM: 1.4, shortClear: true, heldCap: 12,
  /** OWN LEAF (orders.ts stackPosts): a door whose own leaf stands open across the face the stack is ordered on — every mark on its hinge side cut off from
   *  the doorway's front by it — is no longer refused 'no room on that door': where that was the answer the marks are asked again with that one leaf left
   *  out, which gives the marks the door has when shut. Off = the leaf is a wall to its own stack, as it was.
   *  OWN MARK (orders.ts ownMarkFirst, asked where a stack's marks and the door tools' tucked marks are handed out; and per place in stackPostsOn's jambs
   *  and files): a mark within a body's room of Sam is his and the files go on past it — except a mark a man of the very order being dealt already
   *  stands on, on this face of this door. Stacked men are dealt the marks they stand on whatever Sam has since come to stand beside and whichever maker
   *  dealt them, so a door tool given to a stack is not refused 'no room on that door' for Sam's own body, nor are the men shuffled along the wall for
   *  it; and the door tools' tuck does not move such a man onto Sam. A charge's stand-off is not touched (nobody stands on it yet: Sam's place there is
   *  his). Off = Sam's place is his whoever was there first, as it was.
   *  FURNITURE (orders.ts onFurniture, asked per place in stackPostsOn's jambs, files and second rank, the passage file and the corner door's places back): a
   *  place a piece of furniture stands on — a carton, a chair, a bin, a plant, where it is now — is the furniture's, and the file goes on past it as it
   *  does past Sam. One place in thirty was dealt onto a prop: on open floor the man shoves it aside, wedged in a corner he cannot, and stood short of
   *  his mark with the man behind him held off his own. It never costs a door its stack: where keeping off the furniture leaves 'no room', the places
   *  are asked again with the furniture left in, and the places back from a corner door take furnished floor last. Off = the makers ask the walls and the nav grid only, as they did
   *  BACK ON (orders.ts, the order tick's 'as near his mark as he will get'): a man who HAD his mark under him and stands within a metre of it, still —
   *  shouldered off it by a man walking past along the wall — steps back onto it. The older rule could not tell him from a man who never got there (the
   *  runner's settle watchdog counts a mark he has already been closer to as one he cannot reach) and moved the mark to where he had been pushed: half a
   *  metre out from the wall, for good. He goes back for it twice; kept from it both times (somebody stands on it now), the mark comes to him as before.
   *  Off = a man pushed off his mark is dealt the floor he was pushed to */
  ownLeaf: true, ownMark: true, offFurniture: true, backOn: true,
};
/** how often the rules above gave an answer (QA; `fur` = times a place was found on furniture: asks, not answers; `back` = times a man was sent back for a mark he was pushed off) */
export const STACK_OWN = { leaf: 0, mark: 0, fur: 0, back: 0 };

interface St {
  t: number;                 // the last frame the gate was asked (a gap = he has been doing something else: clocks afresh)
  heldT: number; pass: number;
  /** stepped off to a jamb: the place, the door and face it is on */
  spot: Vec3 | null; door: Door | null; side: 1 | -1; path: Vec3[] | null; noSpot: number; roundT: number;
  /** FIGHT: seconds planted in an opening; the step under way, its deadline; no step before */
  funnelT: number; step: Vec3 | null; stepBy: number; stepRest: number;
}
const states = new SideMap<Guard, St>('doorway.states');
function stateOf(gd: Guard): St { let s = states.get(gd); if (!s) states.set(gd, s = { t: -1e9, heldT: 0, pass: -1e9, spot: null, door: null, side: 1, path: null, noSpot: -1e9, roundT: -1e9, funnelT: 0, step: null, stepBy: 0, stepRest: -1e9 }); return s; }
export const DOORMANNERS_STATS = { held: 0, aside: 0, passed: 0, stepped: 0, round: 0, rest: 0, marks: 0, covered: 0, stepCover: 0, stepGlass: 0, roundOwn: 0 };
export const DOORMANNERS_DEBUG: { log: ((s: string) => void) | null } = { log: null };

const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const ours = (gd: Guard) => gd.team === 'operative' || gd.team === 'hostile';
function rel(d: Door, p: Vec3) { const F = frameOf(d), x = p[0] - F.hx, z = p[2] - F.hz; return { along: x * F.ux + z * F.uz, perp: x * F.nx + z * F.nz, F }; }
/** p in d's opening: inside the leaf's span, within `half` of the frame line */
export function inOpening(d: Door, p: Vec3, half = DOORMANNERS.half): boolean { const r = rel(d, p); return r.along >= -0.05 && r.along <= r.F.W + 0.05 && Math.abs(r.perp) <= half; }
/** p where d's leaf swings: inside its arc between its stops (and `sweep` past its tip), off the opening's own strip */
export function inSweep(d: Door, p: Vec3): boolean {
  if (d.off) return false;   // (off its hinges, doorblast.ts: no leaf swings there any more)
  const r = rel(d, p); if (r.along >= -0.05 && r.along <= r.F.W + 0.05 && Math.abs(r.perp) <= DOORMANNERS.half) return false;
  if (Math.hypot(r.along, r.perp) > r.F.W + DOORMANNERS.sweep) return false;
  const a = Math.atan2(r.perp, r.along); return a >= d.minA && a <= d.maxA && Math.abs(a) > 0.05;
}
/** STAND: is `p` no place to stand about — in some frame's strip, or where its leaf swings (false with the switch off) */
export function doorwayStand(g: Game, p: Vec3): boolean {
  if (!DOORMANNERS.on || !DOORMANNERS.stand) return false;
  for (const d of g.doors.list) { if (flat(p, d.frameCentre) > d.def.width + 1) continue; if (inOpening(d, p) || (DOORMANNERS.swing && inSweep(d, p))) return true; }
  return false;
}
/** STAND, the lane: the door standing open whose LANE `p` is in (DOORMANNERS.lane: the head of the knobs) — null: none, or the rule is off */
export function doorwayLane(g: Game, p: Vec3, but: Door | null = null): Door | null {
  const K = DOORMANNERS; if (!K.on || !K.stand || !K.lane) return null;
  for (const d of g.doors.list) {
    if (d === but) continue;   // (a stack's own door: stackCover asks about the others)
    if (!d.off && (d.latched || Math.abs(d.angle) < K.laneAjar)) continue;
    if (flat(p, d.frameCentre) > K.laneM + d.def.width) continue;
    const r = rel(d, p), depth = Math.abs(r.perp); if (depth > K.laneM) continue;
    const e = K.laneOut + K.laneFlare * depth; if (r.along < -e || r.along > r.F.W + e) continue;
    if (g.col.solidBlocked([p[0], 0.45, p[2]], [d.frameCentre[0], 0.45, d.frameCentre[2]])) continue;   // (a wall between him and the opening: nobody sees him through it)
    return d;
  }
  return null;
}
/** (STAND, the lane) nav.findPath's `penalty` for a walk an order gives: the lanes of the doors standing open onto floor the team has not been on (a room
 *  nobody of ours has stood in, or open ground: cleared.ts) are dear — bar the doors `not` names (the ones his way goes THROUGH: beyond them the lane is
 *  where he is going). Null: no such door, or the switch is off. */
export function doorwayLanePrice(g: Game, not: (d: Door) => boolean = () => false): ((ix: number, iz: number) => number) | null {
  const K = DOORMANNERS; if (!K.on || !K.stand || !K.laneWalk) return null;
  const C = g.cleared, open = g.doors.list.filter(d => { if ((!d.off && (d.latched || Math.abs(d.angle) < K.laneAjar)) || not(d)) return false;
    const a = C.roomBy(d, 1), b = C.roomBy(d, -1); return !(a && b && C.isKnown(a) && C.isKnown(b)); });
  if (!open.length) return null;
  const nav = g.col.nav, memo = new Map<number, number>();
  return (ix, iz) => { const i = nav.idx(ix, iz); let v = memo.get(i);
    if (v === undefined) { const p: Vec3 = [(ix + 0.5) * nav.cell, 0, (iz + 0.5) * nav.cell]; v = 1;
      for (const d of open) { if (flat(p, d.frameCentre) > K.laneM + d.def.width) continue;
        const r = rel(d, p), depth = Math.abs(r.perp); if (depth > K.laneM || (depth < K.laneStrip && (!K.laneLeaf || d.off || r.perp * d.angle <= 0))) continue;   // (no free strip along the wall on the face its leaf stands on: the grid knows no leaves, and that way round a lane is through the leaf)
        const e = K.laneOut + K.laneFlare * depth; if (r.along < -e || r.along > r.F.W + e) continue;
        if (g.col.solidBlocked([p[0], 0.45, p[2]], [d.frameCentre[0], 0.45, d.frameCentre[2]])) continue;
        v = K.laneDear; break; }
      memo.set(i, v); }
    return v; };
}
/** STAND, the lane: the place for a man of the file whose place `p` is in an open door's lane — square off it, beside the lane on the side he is on (`from`;
 *  a man on its middle: the `k`-th of the file to one side, the next to the other), where he can stand and walk straight to from `p`, in no other lane, strip
 *  or swing, and `laneApart` clear of the places the men ahead of him in the file have (`taken`: two places a stride apart in one lane would step off it to
 *  the same spot). null: `p` is in no lane, or there is no such floor (the place stays `p`) */
export function doorwayOffLane(g: Game, p: Vec3, from: Vec3, k: number, taken: Vec3[] = []): Vec3 | null {
  const d = doorwayLane(g, p); if (!d) return null;
  const K = DOORMANNERS, r = rel(d, p), F = r.F, e = K.laneOut + K.laneFlare * Math.abs(r.perp) + K.laneClear;
  const fa = rel(d, from).along - F.W / 2, first = Math.abs(fa) > 0.15 ? Math.sign(fa) : (k & 1 ? 1 : -1);
  for (const s of [first, -first]) for (let j = 0; j < 3 + 2 * taken.length; j++) {
    const al = s > 0 ? F.W + e + j * 0.4 : -e - j * 0.4;
    const q: Vec3 = [F.hx + F.ux * al + F.nx * r.perp, 0, F.hz + F.uz * al + F.nz * r.perp];
    if (g.col.nav.isBlocked(q[0], q[2]) || g.col.solidBlocked([p[0], 0.45, p[2]], [q[0], 0.45, q[2]])) break;   // (a wall or furniture that side: no further out)
    if (K.laneLeaf && behindLeaf(d, al, r.perp)) continue;
    if (doorwayStand(g, q) || doorwayLane(g, q) || taken.some(t => flat(t, q) < K.laneApart)) continue;
    return q;
  }
  return null;
}
/** (the lane, `laneLeaf`) is the place at (along, perp) of d's frame BEHIND its open leaf: the straight line from it to the middle of the opening is cut by the
 *  leaf where it stands, a body's breadth past its tip — from there the only way to the opening is round the tip, and his body takes the leaf shut with him */
function behindLeaf(d: Door, along: number, perp: number): boolean {
  if (d.off) return false;
  const W = d.def.width, L = W + 0.35, lx = Math.cos(d.angle) * L, lz = Math.sin(d.angle) * L, cx = W / 2 - along, cz = -perp;   // (in the frame's own along / perp: the leaf from the hinge, the line from the place to the opening's middle)
  const den = cx * lz - cz * lx; if (Math.abs(den) < 1e-6) return false;
  const s = -(along * lz - perp * lx) / den, t = -(along * cz - perp * cx) / den;
  return s > 0 && s < 1 && t > 0 && t < 1;
}
/** `leafRound`: does this man go round a leaf standing open across his walk (game.ts asks it for his body on the doors: DoorContact.round) — on the move
 *  only (`ROUND_PACE` m/s): a man stood by a leaf, on his mark, is not walked along it */
export const ROUND_PACE = 0.5;
export function roundsLeaves(gd: Guard): boolean { return DOORMANNERS.on && DOORMANNERS.leafRound && gd.team === 'operative'; }
/** STAND: is the file's switch on (orders.ts asks before it looks at who stands by whom) */
export function doorwayFile(): boolean { return DOORMANNERS.on && DOORMANNERS.stand; }

/** the first frame his walk goes through within `reach`: the door, the face he comes at it from, where he cuts the line, metres of walk to there */
function doorAhead(g: Game, gd: Guard): { d: Door; side: 1 | -1; at: Vec3; dist: number } | null {
  const pos = gd.char.pos, R = DOORMANNERS.reach; let a = pos, run = 0;
  for (let i = gd.pathI; i < gd.path.length && run < R; i++) {
    const b = gd.path[i]; let best: { d: Door; side: 1 | -1; at: Vec3; dist: number } | null = null;
    for (const d of g.doors.list) {
      if (flat(pos, d.frameCentre) > R + d.def.width) continue;
      const x = crossesDoor(a, b, d); if (!x) continue;
      const dist = run + flat(a, x.at); if (dist <= R && (!best || dist < best.dist)) best = { d, side: x.side, at: x.at, dist };
    }
    if (best) return best;
    run += flat(a, b); a = b;
  }
  return null;
}
/** his own side about him, living, other than himself: the men, and Sam with the squad */
function friends(g: Game, gd: Guard): { pos: Vec3; vel: Vec3; gd: Guard | null; id: number }[] {
  const out: { pos: Vec3; vel: Vec3; gd: Guard | null; id: number }[] = [];
  for (const o of g.guards) if (o !== gd && o.team === gd.team && o.state !== 'dead') out.push({ pos: o.char.pos, vel: o.char.vel, gd: o, id: o.char.id });
  if (gd.team === 'operative' && !g.player.down) { const c = g.player.char; out.push({ pos: c.pos, vel: c.vel, gd: null, id: c.id }); }
  return out;
}
/** ease `gd` to `p` over open floor (a step of this file's: no plan, a metre or so) — his pace eased in (a teammate's no faster than PACE.accel, like any
 *  walk of his), his feet moved; true = there */
function stepTo(g: Game, gd: Guard, p: Vec3, pace: number, dt: number, turn: boolean): boolean {
  const c = gd.char, dx = p[0] - c.pos[0], dz = p[2] - c.pos[2], d = Math.hypot(dx, dz);
  if (d < 0.1) { gd.speed = damp(gd.speed, 0, 10, dt); c.vel = [0, 0, 0]; return true; }
  const was = gd.speed; gd.speed = damp(gd.speed, pace * clamp(d / 0.45, 0.35, 1), 6, dt); teamLean(g, gd, was, dt); const s = Math.min(d, gd.speed * dt);
  c.pos[0] += dx / d * s; c.pos[2] += dz / d * s; c.vel = [dx / d * gd.speed, 0, dz / d * gd.speed];
  if (turn) c.bodyYaw = approachAngle(c.bodyYaw, Math.atan2(dx, dz), 5.5 * dt);
  return false;
}
function spotFree(g: Game, gd: Guard, p: Vec3, apart: number): boolean {
  if (g.col.nav.isBlocked(p[0], p[2])) return false;
  if (gd.team === 'operative' && !g.player.down && flat(g.player.char.pos, p) < apart) return false;
  for (const o of g.guards) { if (o === gd || o.state === 'dead') continue; if (flat(o.char.pos, p) < apart) return false; const so = states.get(o), s = so && g.time - so.t <= 0.5 && g.time >= so.t ? so.spot : null; if (s && flat(s, p) < apart) return false; }   // (a place off a jamb another man is waiting at is his — while he is still at this file's gate: a wait he was taken off keeps no floor)
  return true;
}
/** a place off a jamb of `d` on face `side` for a held man: the nearest he can walk straight to that is free, off every swing and every opening */
function jambSpot(g: Game, gd: Guard, d: Door, side: 1 | -1): Vec3 | null {
  const K = DOORMANNERS, F = frameOf(d), pos = gd.char.pos; let best: Vec3 | null = null, bd = Infinity;
  for (let k = 0; k < 3; k++) for (const lat of [F.W + K.jambPast + k * K.fileGap, -(K.jambPast + k * K.fileGap)]) {
    const p: Vec3 = [F.hx + F.ux * lat + F.nx * side * K.jambOut, 0, F.hz + F.uz * lat + F.nz * side * K.jambOut];
    const dd = flat(pos, p); if (dd >= bd || !spotFree(g, gd, p, K.apart)) continue;
    if (g.col.solidBlocked([pos[0], 0.45, pos[2]], [p[0], 0.45, p[2]])) continue;
    let bad = false; for (const o of g.doors.list) { if (flat(p, o.frameCentre) > o.def.width + 1) continue; if (inOpening(o, p, 0.6) || inSweep(o, p)) { bad = true; break; } }
    if (bad) continue;
    best = p; bd = dd;
  }
  return best;
}
/** does `o`'s walk go through `d` within reach — metres of walk to the line and the face he comes from, or null */
function through(g: Game, o: Guard, d: Door): { dist: number; side: 1 | -1 } | null {
  const pos = o.char.pos, R = DOORMANNERS.reach; let a = pos, run = 0;
  for (let i = o.pathI; i < o.path.length && run < R; i++) { const b = o.path[i]; const x = crossesDoor(a, b, d); if (x) { const dist = run + flat(a, x.at); return dist <= R ? { dist, side: x.side } : null; } run += flat(a, b); a = b; }
  return null;
}

/** PASS. The pace `gd` walks his path at this frame (≤ `speed`) — or null: this file has his feet (he is stepping to, or standing at, a place off a jamb), the
 *  caller's walk has not arrived. Asked by followPath and the scripted strafe before they move him. */
export function doorwayGate(g: Game, gd: Guard, dt: number, speed: number): number | null {
  const K = DOORMANNERS; if (!K.on || !K.pass || !ours(gd) || gd.state === 'dead' || g.touring || !(speed > 0)) return speed;
  const st = stateOf(gd), c = gd.char, t = g.time, pos = c.pos;
  if (t - st.t > 0.5 || t < st.t) { st.heldT = 0; st.spot = null; st.door = null; }
  st.t = t;
  if (st.spot && gd.path !== st.path) { st.spot = null; st.door = null; }   // (given a new walk while he waited at a jamb: the old door is no longer his business — the time he has been held is kept: a walk re-planned every half second, a file behind a moving Sam, must not start his patience again each time)
  const turn = !(gd.script?.over && gd.script.over.walk && gd.script.over.face !== null);   // (walking with his chest on a man he has seen: his feet are eased and stepped, his body left to the fight)
  const release = (replan: boolean) => { const was = st.spot; st.spot = null; st.door = null; if (was && replan && gd.pathGoal) goTo(g, gd, gd.pathGoal, true); };
  // in an opening: he clears it, whoever stands about
  for (const d of g.doors.list) if (flat(pos, d.frameCentre) <= d.def.width + 1 && inOpening(d, pos)) { release(false); st.heldT = 0; return speed; }
  let X = st.spot && st.door ? { d: st.door, side: st.side, at: st.door.frameCentre, dist: flat(pos, st.door.frameCentre) } : doorAhead(g, gd);
  const waiting = !!st.spot;
  // his heading (for the man ahead of him by a door, whether or not his own walk goes through it)
  let hx = 0, hz = 0; { const wp = gd.path[gd.pathI]; if (wp) { const dx = wp[0] - pos[0], dz = wp[2] - pos[2], l = Math.hypot(dx, dz); if (l > 1e-3) { hx = dx / l; hz = dz / l; } } }
  const goalLeft = gd.pathGoal ? flat(pos, gd.pathGoal) : Infinity;
  let byDoor = !!X; if (!byDoor) for (const d of g.doors.list) if (flat(pos, d.frameCentre) <= 2.5) { byDoor = true; break; }
  // … or the last metres of a walk to an order's own mark by one (a stack's rear places lie further out than that): there only a mate standing on HIS mark is anything to him
  let endBy = false; if (!byDoor && K.ownPlace && gd.pathGoal && goalLeft <= K.ownEndM && g.orders.of(gd)?.post) for (const d of g.doors.list) if (flat(gd.pathGoal, d.frameCentre) <= 2.5) { endBy = true; break; }
  if (!byDoor && !endBy) { st.heldT = Math.max(0, st.heldT - 2 * dt); return speed; }
  if (t < st.pass) { if (waiting) release(true); return speed; }   // (going anyway: held long enough)
  const gapK = (d: number) => clamp((d - K.gapMin) / (K.gap - K.gapMin), 0, 1);
  const onOwn = (o: Guard | null) => { if (!K.ownPlace || !o) return false; const A = g.orders.of(o); return !!A?.post && flat(o.char.pos, A.post) < K.ownM; };   // (on the mark his order gave him)
  let scale = 1, hold = false, patience = K.patience, stay = false, who = '', round: Vec3 | null = null, roundD = 0, roundOwn = false;   // hold: kept short of the frame (he may step off to a jamb) · stay: his own place is where the man ahead stands
  for (const o of friends(g, gd)) {
    const dO = flat(pos, o.pos), vO = Math.hypot(o.vel[0], o.vel[2]); let s = 1, h = false, mine = false;   // mine: the frame is his before this man's — he is not held for him
    if (X) {
      const r = rel(X.d, o.pos), inSpan = r.along >= -0.3 && r.along <= r.F.W + 0.3, far = r.perp * X.side < 0;
      const away = vO > 0.4 && -(o.vel[0] * r.F.nx + o.vel[2] * r.F.nz) * X.side > 0.2 * vO;   // (walking the way he is going, through and on)
      const short = clamp((X.dist - K.throat) / 0.5, 0, 1);
      const so = o.gd ? states.get(o.gd) : null, walking = vO > 0.2 || (!!so && t - so.t <= 0.25 && t >= so.t);   // (his walk counts while he walks it, or stands held at this gate — a path left unfinished by a man who settled short of its end, or planted to fire, says nothing)
      const thr = o.gd && walking ? through(g, o.gd, X.d) : null;
      if (inOpening(X.d, o.pos)) { if (away) s = gapK(dO); else { s = short; h = true; } }
      else if (far && thr && thr.side !== X.side) { if ((waiting && !(states.get(o.gd!)?.spot && c.id < o.id)) || thr.dist < X.dist - 0.01 || (Math.abs(thr.dist - X.dist) <= 0.01 && o.id < c.id)) { s = short; h = true; } }   // (coming the other way and nearer the frame: his first)
      else if (far && inSpan && Math.abs(r.perp) <= K.half + 0.9) { if (away) s = gapK(dO); else if (vO < 0.4) { s = short; patience = Math.min(patience, K.beyond); } }   // (standing just beyond it — in the way of whoever comes through: a beat short of the frame for him to move, no stepping aside for it)
      else if (!far && thr && thr.side === X.side && !waiting) { if (thr.dist < X.dist - 0.01 || (Math.abs(thr.dist - X.dist) <= 0.01 && o.id < c.id)) s = gapK(dO); else mine = true; }   // (for the same frame, the same way: the nearer goes first and is followed, not passed)
    }
    if (s === 1 && !h && !mine && !waiting && dO < K.gap && (hx || hz)) {   // a man ahead of him on his line by a door, not coming at him: followed at the gap, never walked into
      const ux = (o.pos[0] - pos[0]) / (dO || 1), uz = (o.pos[2] - pos[2]) / (dO || 1);
      if (ux * hx + uz * hz > 0.7) {
        const own = vO < 0.6 && onOwn(o.gd);   // (on his own mark: standing, whatever his last steps onto it say)
        if (!byDoor && !own) continue;
        if (!own && vO > 0.4 && o.vel[0] * hx + o.vel[2] * hz > 0.3 * vO) s = gapK(dO);   // walking his way: followed
        else if (vO < 0.2 || own) {   // standing: ON his own place — he stops short of him; his way on well past him — he walks round him; his place just by him — his walk as it was
          if (gd.pathGoal && flat(o.pos, gd.pathGoal) < 0.4) { s = gapK(dO); stay = true; }
          else if (goalLeft > dO + 0.8 && dO < K.round && (!round || dO < roundD)) { round = o.pos; roundD = dO; roundOwn = own; }
        }
      }
    }
    if (s < scale) { scale = s; who = o.gd ? o.gd.callsign : 'Player'; } if (h) hold = true;
  }
  if (round && scale > 0.5 && t >= st.roundT) {   // a friend standing on his line, his own way on past him: a corner put in his walk beside the man, on the side he is already off to (the walk is planned as if he were alone)
    st.roundT = t + 1;
    const px = -hz, pz = hx, sgn = (pos[0] - round[0]) * px + (pos[2] - round[2]) * pz >= 0 ? 1 : -1;
    for (const sd of [sgn, -sgn]) {
      const cand: Vec3 = [round[0] + px * sd * K.roundOut, 0, round[2] + pz * sd * K.roundOut];
      if (g.col.nav.isBlocked(cand[0], cand[2]) || g.col.solidBlocked([pos[0], 0.45, pos[2]], [cand[0], 0.45, cand[2]]) || !spotFree(g, gd, cand, 0.6)) continue;
      gd.path.splice(gd.pathI, 0, cand); DOORMANNERS_STATS.round++; if (roundOwn) DOORMANNERS_STATS.roundOwn++; DOORMANNERS_DEBUG.log?.(`${t.toFixed(2)} ${gd.callsign} at ${pos[0].toFixed(2)},${pos[2].toFixed(2)} goes round a man at ${round[0].toFixed(2)},${round[2].toFixed(2)}${roundOwn ? ' (on his own mark)' : ''} by ${cand[0].toFixed(2)},${cand[2].toFixed(2)}`); break;
    }
  }
  const held = scale < 0.2 || (waiting && hold);   // (a man at a jamb is held as long as the frame is not his, however far off it his place is)
  if (held) {
    if (st.heldT === 0) { DOORMANNERS_STATS.held++; DOORMANNERS_DEBUG.log?.(`${t.toFixed(2)} ${gd.callsign} at ${pos[0].toFixed(1)},${pos[2].toFixed(1)} held for ${who}${X ? ` at ${X.d.def.name}` : ''}${hold ? ' (short of the frame)' : ''}${stay ? ' (his place is by him)' : ''}`); }
    st.heldT += dt;
    if (st.heldT >= patience) { st.heldT = 0; st.pass = t + K.rest; DOORMANNERS_STATS.passed++; DOORMANNERS_DEBUG.log?.(`${t.toFixed(2)} ${gd.callsign} held ${patience}s by ${X?.d.def.name ?? 'a man ahead'}: goes anyway`); if (waiting) release(true); return speed; }
  } else st.heldT = Math.max(0, st.heldT - 2 * dt);
  if (waiting) {
    if (!hold) { release(true); return speed * scale; }
    if (stepTo(g, gd, st.spot!, Math.min(speed, K.step), dt, turn) && turn) { const fc = st.door!.frameCentre; c.bodyYaw = approachAngle(c.bodyYaw, Math.atan2(fc[0] - pos[0], fc[2] - pos[2]), 5.5 * dt); }
    return null;
  }
  if (held && hold && X && st.heldT >= K.aside && t >= st.noSpot) {   // held short of the frame by a man in it / coming through: off to a jamb, out of his way
    const p = jambSpot(g, gd, X.d, X.side);
    if (p) { st.spot = p; st.door = X.d; st.side = X.side; st.path = gd.path; DOORMANNERS_STATS.aside++; DOORMANNERS_DEBUG.log?.(`${t.toFixed(2)} ${gd.callsign} steps off to a jamb of ${X.d.def.name}`); stepTo(g, gd, p, Math.min(speed, K.step), dt, turn); return null; }
    st.noSpot = t + 1;
  }
  if (scale < 1) { const want = speed * scale; gd.speed = Math.min(gd.speed, Math.max(want, gd.speed - K.brake * dt)); return want; }
  return speed;
}

/** FIGHT. A man the fight AI would have stand where he is — planted to fire, or holding a post he was pinned on where he stopped: stood in an open doorway
 *  `funnel` seconds, he steps off the opening — one of the squad through it on the side his man (or his fix) is on, else back; a defender back on the side
 *  away from them, never out toward them — to a free spot with a line of fire to `aimAt`, and, with nobody in his sights (`needShot` false), failing that to
 *  any free spot off it. A defender's spot is never more exposed to a rifle at them than the frame itself (a window is no wall), covered floor comes before
 *  other free floor, and with them along the door's own wall covered floor on either face will do (`stepCover`). True = this file moved his feet this frame
 *  (he is on the step); false = stand as he would have. */
export function offThreshold(g: Game, gd: Guard, aimAt: Vec3 | null, dt: number, needShot: boolean): boolean {
  const K = DOORMANNERS; if (!K.on || !K.fight || !ours(gd) || gd.script || g.touring || !aimAt) return false;
  const st = stateOf(gd), c = gd.char, t = g.time, pace = Math.min(g.tune.guardInvestigate, K.step);
  if (st.step) {
    if (t > st.stepBy || stepTo(g, gd, st.step, pace, dt, false)) { st.step = null; st.stepRest = t + K.funnelRest; return false; }
    return true;
  }
  if (t < st.stepRest) return false;
  let door: Door | null = null;
  for (const d of g.doors.list) { if (d.latched || Math.abs(d.angle) < 0.6 || flat(c.pos, d.frameCentre) > d.def.width + 1) continue; if (inOpening(d, c.pos)) { door = d; break; } }
  if (!door) { st.funnelT = 0; return false; }
  if ((st.funnelT += dt) < K.funnel) return false;
  st.funnelT = 0;
  const F = frameOf(door), off = (aimAt[0] - F.hx) * F.nx + (aimAt[2] - F.hz) * F.nz, sgn = off >= 0 ? 1 : -1;
  // the squad steps THROUGH, to the side its man is on (and failing that back off it); a defender steps back off it on his own side and never out toward them
  const foe = gd.team === 'hostile', cov = foe && K.stepCover;
  // (stepCover) them ALONG the door's wall: the half-plane says nothing there, so covered floor on either face will do
  const along = (aimAt[0] - F.hx) * F.ux + (aimAt[2] - F.hz) * F.uz - F.W / 2, flatOn = cov && Math.abs(off) < Math.max(0.5, Math.abs(along) * Math.tan(K.planeDeg * Math.PI / 180));
  const sides = foe ? (flatOn ? [-sgn, sgn] : [-sgn]) : [sgn, -sgn];
  // how a man stood at p (chest and head) is exposed to a rifle at his man / his fix: 0 covered · 1 reached only through glass · 2 reached in clear air
  const exposed = (p: Vec3): number => {
    let e = 0;
    for (const y of [1.1, 1.5]) { const P: Vec3 = [p[0], y, p[2]]; if (g.col.shotBlocked(aimAt, P, 0.02, GLASSPEN.stackEnergy)) continue; if (!g.col.solidBlocked(aimAt, P)) return 2; e = 1; }
    return e;
  };
  const here = cov ? exposed(c.pos) : 0;
  // the passes: a spot with the shot; (a defender, stepCover) a covered spot; then, with nobody in his sights, any free spot off the opening
  const passes: [line: boolean, cover: boolean][] = needShot ? [[true, false]] : cov ? [[true, false], [false, true], [false, false]] : [[true, false], [false, false]];
  for (const [line, cover] of passes) for (const side of sides) for (const lat of [F.W + K.past, -K.past]) {
    if (foe && side === sgn && !cover) continue;   // (the face the half-plane calls theirs: only ever under cover)
    const p: Vec3 = [F.hx + F.ux * lat + F.nx * side * K.through, 0, F.hz + F.uz * lat + F.nz * side * K.through];
    if (!spotFree(g, gd, p, 0.8) || g.col.solidBlocked([c.pos[0], 0.45, c.pos[2]], [p[0], 0.45, p[2]]) || (line && g.col.shotBlocked([p[0], 1.4, p[2]], aimAt))) continue;
    let bad = false; for (const o of g.doors.list) { if (flat(p, o.frameCentre) > o.def.width + 1) continue; if (inOpening(o, p) || (o !== door && inSweep(o, p))) { bad = true; break; } }
    if (bad) continue;
    // (stepCover) never to a spot more exposed to them than the frame he stands in — a window is no wall — and the cover pass takes covered floor only
    if (cov) { const e = exposed(p); if (cover ? e > 0 : e > here) { if (!cover && e === 1) DOORMANNERS_STATS.stepGlass++; continue; } }
    st.step = p; st.stepBy = t + 1.5; DOORMANNERS_STATS.stepped++; if (cover) DOORMANNERS_STATS.stepCover++; DOORMANNERS_DEBUG.log?.(`${t.toFixed(2)} ${gd.callsign} steps off ${door.def.name}'s opening${cover ? ' (to cover)' : ''}`);
    stepTo(g, gd, p, pace, dt, false); return true;
  }
  st.stepRest = t + 1;
  return false;
}

/** REST / MARKS: `p` is in a door's way for a man left standing there — in some frame's own strip, or where a leaf swings (asked whatever `stand` and
 *  `swing` say: restClear and markClear are their own switches) */
export function doorwayInWay(g: Game, p: Vec3): boolean {
  for (const d of g.doors.list) { if (flat(p, d.frameCentre) > d.def.width + 1) continue; if (inOpening(d, p) || inSweep(d, p)) return true; }
  return false;
}
/** REST: the PASS gate has `gd` held this frame — short of a frame for a man in it, or stepped off to a jamb */
export function doorwayHeld(g: Game, gd: Guard): boolean { const st = states.get(gd); return !!st && g.time - st.t <= 0.25 && g.time >= st.t && (st.heldT > 0 || !!st.spot); }
/** REST / MARKS: the nearest floor to `p`, within `clearM`, that is not `bad` — floor a man can stand on and walk straight to from `p`, never through a
 *  frame to its other face, `apart` clear of every `taken`; of the nearest ring that has any, the spot farthest from the doors by it. null: none */
export function doorwayClearNear(g: Game, p: Vec3, bad: (q: Vec3) => boolean, taken: Vec3[] = [], apart = DOORMANNERS.apart, face: Vec3 | null = null): Vec3 | null {
  // (`face`: with `p` in a frame's own strip, the face of that frame the answer is on — the one `face` is on)
  const K = DOORMANNERS, by = g.doors.list.filter(d => flat(p, d.frameCentre) <= d.def.width + 1 + K.clearM).map(d => { const at = rel(d, p); return { d, at: Math.abs(at.perp) <= K.half && face ? rel(d, face) : at }; });
  for (let r = 0.2; r <= K.clearM + 1e-6; r += 0.2) {
    let best: Vec3 | null = null, bs = -1;
    for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6, q: Vec3 = [p[0] + Math.sin(a) * r, 0, p[2] + Math.cos(a) * r];
      if (g.col.nav.isBlocked(q[0], q[2]) || bad(q) || taken.some(t => flat(t, q) < apart) || g.col.solidBlocked([p[0], 0.45, p[2]], [q[0], 0.45, q[2]])) continue;
      let ok = true, far = Infinity;
      for (const { d, at } of by) { const rq = rel(d, q); far = Math.min(far, flat(q, d.frameCentre));
        if (Math.abs(at.perp) > K.half && rq.perp * at.perp < 0 && rq.along > -0.3 && rq.along < rq.F.W + 0.3) { ok = false; break; } }
      if (ok && far > bs) { best = q; bs = far; }
    }
    if (best) return best;
  }
  return null;
}
