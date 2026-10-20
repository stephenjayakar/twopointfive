// HANDS ON THE WORLD — picking a body up, and working a door by hand. The player's two everyday chores done with his hands and his feet instead of by a state
// flip: `HANDS.on` (the page: on, `?nohands` = as it was; the frozen stand: off, `TPS_HANDS=1`). Off = nothing here runs and every caller takes its old path.
//
// A BODY (HANDS.body). Taking hold of one is a MOVE, not a toggle:
//   · it is taken by the END HE IS AT — the ankles, or under the arms from the head end (the two shoulder particles) — and it is in reach from either end
//     (bodyGripDist: the old reach knew the ankles and the hips only, so a man come back to a body from its head was offered nothing: the 'second time' bug);
//   · reach → he steps in to arm's length, crouches, bows, and both hands go down onto the two limbs where they lie (character.ts haulLayer);
//   · rise  → the pins come on where the limbs are and travel up into his hands at carry height (a lift, not a snap);
//   · carry → as ever: the two particles pinned at his hands, the rest trailing — his hands stay ON them (the layer follows the ragdoll's own particles);
//   · set   → the 'let go of him' row lowers them to the floor before the pins come off. Everything that TEARS a body out of his hands (a sprint, a wedge, a
//     round, a grab) is the old instant release.
//   CARRIED, NOT DRAGGED (HANDS.carry; off = hauled along the floor by the end he took, the four beats above — which is also what he does where there is no
//   room to stand). The same four beats, another hold: he steps in to its HIPS, both hands go down onto it, and it comes up off the floor onto his LEFT
//   SHOULDER (hoistSecs) as he stands — belly on the shoulder, trunk down his back, thighs down his chest under his left arm, the rest of it hanging by its own
//   weight (the ragdoll's hips, spine and knees pinned to spots in HIS frame: a rigid lie, see Lie; every length is the body's own, so no stick is strained).
//   He then WALKS with it, upright, facing the way he goes, at carryPace × his walk; 'put him down' kneels and lays it on its back on clear floor beside or
//   before him (layLie: never through a wall — no clear floor in reach = it is dropped off the shoulder, as a sprint drops it).
//   State: Player.haul (null whenever Player.dragging is). Under a puppet (the showcases) there is none: their drags are the old ones on the old clock.
//   With both hands on a body his gun is put away for the haul (character.ts hideHeldItem) — and its rail light with it, as for any hidden item.
//
// A DOOR (HANDS.door). The 'push it open' / 'pull it open' / 'pull it shut' / 'push it shut' / 'unlock it' rows start a DOOR MOVE (Player.doorMove) instead of
// flinging the leaf:
//   · his free hand goes onto the leaf (game.ts handsOnDoors takes the move's door as it takes an eased one) and the leaf comes round UNDER it at a hand's
//     pace — the same creak / key clack on the way open (Doors.use says them), the same sprung last hand's breadth and latch on the way shut (Doors.pullTo);
//   · the leaf never goes into him: where its sweep crosses the spot he stands on he STEPS CLEAR first (clearSpot: the nearest standing room on his side of
//     the wall that the sweep misses), and the leaf waits for his body rather than pass through it or stall against it;
//   · a leaf that opens TOWARD him is never left standing between him and the doorway: from the hinge side he comes out round its free end as it comes
//     (clearSpot's `toward` half, HANDS.roundM; the leaf waits clear of his way) and ends on the opening's side of it, a stride from walking in;
//   · no such room (a cupboard) → the move is refused and the row does what it always did (the leaf comes past him), so nobody is ever shut in;
//   · a step of his own takes his feet back at once; a leaf that makes no way for half a second (a body, a chair) is left where it stands;
//   · (two-way doors) a limp body lying in the leaf's swing → the move is refused and the row does what it always did: there only a flung leaf leaving its
//     latch moves a body aside (doors.ts shoves one for a hand on one-way doors alone), so a leaf brought round by hand stopped a few degrees open on a limb;
//   · his gun stays up and on the cursor while the leaf is where it already points (doorMoveLowers); a leaf beside or behind his aim turns him to it;
//   · (one-way doors) a leaf brought round toward him passes the teammates stood with him, as the flung one did (Door.pullT) — only ever while clear of HIM.
//   Not under a puppet: the showcases' doors keep their own timings.
//
// Habits: nothing here rolls a die or reads the camera, the canvas or a graphics setting; every input is a row performed (Game.act); all state is the
// Player's (per player), short-lived, and counted as 'busy' by the checkpoints (savestate.ts playerBusy), so it needs no slice of its own.
import { Vec3, v3, clamp, smoothstep, lerp, wrapAngle } from '../math/vec';
import type { Game, Guard } from './game';
import type { Door } from './doors';
import { DOORWAY } from './doors';
import { RAG, RAG_COUNT } from './ragdoll';
import { PLAYER_ID } from './consts';

export const HANDS = {
  /** THE switch — the page: on (`?nohands` off); the frozen stand: off (`TPS_HANDS=1` on) */
  on: false,
  /** its two halves, for A/B on the panel */
  body: true, door: true,
  // ---- a body
  /** s for the hands to go down onto it · s for it to come up into them · s to lay it down */
  reachSecs: 0.3, liftSecs: 0.35, setSecs: 0.3,
  /** he steps in until the grip is this near (m), and gives up stepping after this long (s): the pins then gather it in as they always did */
  gripM: 0.55, stepSecs: 1.0,
  /** the head end is taken when it is this much nearer than the feet (m) */
  headBias: 0.1,
  /** m the grip stands ahead of him: the ankles · the shoulders (further: his head and arms hang on this side of them, and are not to hang in his knees) · carry
   *  height of the ankles / the shoulders */
  ahead: 0.35, aheadHead: 0.48, carryFeet: 0.42, carryHead: 0.46,
  /** the head end has no leg sticks to stretch: it is 'wedged' when a held shoulder trails its hand by this (m) */
  slackM: 0.4,
  // ---- a body carried
  /** over the shoulder, not along the floor (false = the haul by the end he took, as it was) */
  carry: true,
  /** s it takes from the floor onto his shoulder · s back down onto the floor (a pin travels at most 2.4 m/s — ragdoll.ts PIN_STEP — and both are eased: the
   *  peak is 1.5 × the 1.5 m over the time, so neither may be much under a second or the five pins fall out of step and the body is let go still in the air) */
  hoistSecs: 1.0, lowerSecs: 1.1,
  /** s he may take stepping round to its hips before the lift (past it: lifted from where he is if that is near enough, else hauled along the floor) · how near is near enough beyond gripM (m) */
  carryStepSecs: 2.4, carryNearM: 0.35,
  /** where the middle of its hips rides, in his frame (m): toward his left · ahead · above his soles */
  carrySide: 0.2, carryFwd: -0.02, carryUp: 1.56,
  /** how its trunk hangs down his back (m back per m down) · how its thighs hang down his chest (m ahead per m down) */
  carryBack: 1.35, carryLegs: 1.1,
  /** his pace under it, × his walk · how fast he comes round with it (rad/s: the pins are kinematic and travel at most 2.4 m/s) */
  carryPace: 0.6, carryTurn: 5,
  /** how much of his own step and turn its free limbs are taken through with him each frame (ragdoll.ts ride): 0 = none, as it was — the body's damping is against
   *  the floor, and every arm, shin and the head stream out behind each stride and turn, 40–75° off the hang · 1 = all of it: they hang off him as off a still man */
  carryRide: 0.85,
  /** laid down: how far off his feet its hips go, on the side he lays it (m) */
  layAhead: 0.62,
  // ---- a door
  /** s the hand has at least before the leaf starts · and at most, when it cannot reach it · rad/s under the hand · where an opened leaf is left (rad, short of its stop) */
  doorReach: 0.12, handSecs: 0.3, doorRate: 2.6, openTo: 1.5,
  /** clearance kept between his centre and the leaf's line beyond their own sizes (m) · how far he will step to clear a sweep (m) */
  clearM: 0.06, stepM: 1.3,
  /** a leaf brought round TOWARD him: how far he will walk to end on the OPENING's side of where it will stand, rather than in the pocket behind it */
  roundM: 1.8,
  /** opening a leaf away from him from further off than a hand reaches, he steps in to this far off its face (m) as his hand goes out — if that step is no longer than inM */
  handM: 0.5, inM: 0.75,
  /** s without the leaf making way before the move is dropped */
  stallSecs: 0.5,
  /** rad off his aim within which the leaf he works leaves his gun up and on the cursor */
  aimArc: 1.2,
  // ---- a door somebody else works
  /** every other man's hand on a leaf he works WITHOUT walking it open (teamDoorHand; false = the leaf goes by itself, as it was) · m from the handle spot the
   *  door tools sent him to at which his hand comes up · m from the leaf within which a hand stays on one he has just shoved or is pulling to · the pace he
   *  must be under for a shove to be his hand's (a man walking a leaf open has it already: game.ts handsOnDoors) · rad/s under which a leaf is no longer moving */
  team: true, teamPreM: 0.55, teamReachM: 0.95, teamPace: 0.9, teamVel: 0.25,
};

/** the pick-up of the body in Player.dragging (see the head) */
export interface Haul { end: 'feet' | 'head'; phase: 'reach' | 'rise' | 'carry' | 'set'; t: number; iL: number; iR: number; half: number; from: [Vec3, Vec3]; /** hips ↔ shoulders as he lay (m): the head end's wedge test */ trunk: number;
  /** carried over the shoulder (see the head): the body's own measures — hip to hip, hips to spine, the two thighs (m) — the lie the lift / the laying-down
   *  set out from, the lie on the floor the laying-down ends at, and his facing held through both */
  carry?: { dim: [number, number, number, number]; lie: Lie; to: Lie | null; yaw: number; /** where he stood and faced last frame of the carry (x, z, yaw): what its limbs ride */ at?: [number, number, number]; /** where he steps to for the lift: beside its hips, on his side of it (null: no standing room there — as near its hips as his line to them takes him) */ spot: Vec3 | null }; }
/** how a carried body LIES: the middle of its hips, the unit line left hip → right hip, the unit line hips → spine (square to that), where each thigh points */
export interface Lie { p: Vec3; u: Vec3; t: Vec3; kl: Vec3; kr: Vec3; }
/** a door being worked by hand (see the head): toward `target` rad; `goal` = where his feet are going to be clear of it (null: they are) */
export interface DoorMove { d: Door; open: boolean; target: number; t: number; stage: 'hand' | 'swing'; goal: Vec3 | null; stallT: number; best: number; /** the step being taken for him: the nearest it has got to `goal`, and for how long it has got no nearer */ stepBest: number; stepStall: number; /** the step takes him round the leaf's free end from behind where it will stand: the leaf waits clear of the whole of his way, not only of him */ round?: boolean; }

const bodyOn = () => HANDS.on && HANDS.body, doorOn = () => HANDS.on && HANDS.door;
/** his hands or his feet are spoken for by something else: no door is worked by hand (back to a wall and at a keypad his feet are not his to step with) */
const handsBusy = (g: Game) => { const pl = g.player; return !!(pl.down || pl.holding || pl.dragging || pl.takedown || pl.kick || pl.picking || pl.wanding || pl.coding || pl.wall || pl.charging || g.wallCharge?.setting); };
const mid = (a: Vec3, b: Vec3): Vec3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

// ------------------------------------------------------------------------------------------------------------------------------------------ a body

/** floor distance from the player to an END of a body — the middle of its ankles / of its shoulders — or Infinity when a static stands between (a clear line at shin
 *  height, like player.ts bodyDist's own terms) */
function endDist(g: Game, gd: Guard, end: Haul['end']): number {
  const rag = gd.char.ragdoll; if (!rag) return Infinity;
  const p = g.player.char.pos, m = end === 'feet' ? mid(rag.point(RAG.ankL), rag.point(RAG.ankR)) : mid(rag.point(RAG.shoL), rag.point(RAG.shoR));
  return g.col.solidBlocked([p[0], 0.5, p[2]], [m[0], 0.5, m[2]]) ? Infinity : v3.distXZ(m, p);
}
/** player.ts bodyDist's extra term: the reach to a body's HEAD end, Infinity when the switch is off (or it is nowhere near: no line tested) */
export function bodyGripDist(g: Game, gd: Guard, within: number): number {
  const rag = gd.char.ragdoll; if (!bodyOn() || !rag) return Infinity;
  if (v3.distXZ(mid(rag.point(RAG.shoL), rag.point(RAG.shoR)), g.player.char.pos) >= within) return Infinity;
  return endDist(g, gd, 'head');
}

/** player.ts toggleDrag, the body just taken (Player.dragging set): which end, which hand has which limb, and the move's first beat */
export function haulBegin(g: Game, gd: Guard) {
  const pl = g.player, c = pl.char, rag = gd.char.ragdoll; pl.haul = null; if (!bodyOn() || !rag || g.puppet) return;
  if (HANDS.carry && standRoom(g, c.pos)) {   // over the shoulder: taken by the hips, from whichever side he is at
    const hl = rag.point(RAG.hipL), hr = rag.point(RAG.hipR), pm = mid(hl, hr);
    if (!g.col.solidBlocked([c.pos[0], 0.5, c.pos[2]], [pm[0], 0.5, pm[2]])) {
      const dim: [number, number, number, number] = [v3.dist(hl, hr), v3.dist(pm, rag.point(RAG.spine)), v3.dist(hl, rag.point(RAG.kneeL)), v3.dist(hr, rag.point(RAG.kneeR))];
      // he lifts it from BESIDE its hips (not stood on its legs or its chest): the spot a grip's length off them square to its trunk, on his side
      const ax = v3.sub(rag.point(RAG.spine), pm), n = unit([-ax[2], 0, ax[0]], [1, 0, 0]), sgn = n[0] * (c.pos[0] - pm[0]) + n[2] * (c.pos[2] - pm[2]) < 0 ? -1 : 1;
      let spot: Vec3 | null = [pm[0] + n[0] * sgn * HANDS.gripM, c.pos[1], pm[2] + n[2] * sgn * HANDS.gripM];
      if (g.col.solidBlocked([pm[0], 0.5, pm[2]], [spot[0], 0.5, spot[2]]) || !standRoom(g, spot)) spot = null;
      pl.haul = { end: 'feet', phase: 'reach', t: 0, iL: RAG.hipL, iR: RAG.hipR, half: 0.1, from: [v3.copy(hl), v3.copy(hr)], trunk: 0.45, carry: { dim, lie: lieOf(rag), to: null, yaw: c.bodyYaw, spot } };
      return;
    }
  }
  pl.haul = dragHaul(g, gd);
}
/** the haul along the floor: which end, which hand has which limb */
function dragHaul(g: Game, gd: Guard): Haul {
  const c = g.player.char, rag = gd.char.ragdoll!;
  const dh = endDist(g, gd, 'head'), df = endDist(g, gd, 'feet');   // (an end behind a wall is no end to take it by: the body is not to come through the wall to his hands)
  const end: Haul['end'] = dh + HANDS.headBias < df ? 'head' : 'feet';   // (Infinity: no line to that end)
  let iL: number = end === 'feet' ? RAG.ankL : RAG.shoL, iR: number = end === 'feet' ? RAG.ankR : RAG.shoR;
  const a = rag.point(iL), b = rag.point(iR), m = mid(a, b);
  // the limb on his right goes to his right hand (seen from where he stands, facing the grip)
  const fx = m[0] - c.pos[0], fz = m[2] - c.pos[2];   // his line to it; his right on the floor is (−fz, fx)
  if ((a[0] - m[0]) * -fz + (a[2] - m[2]) * fx > 0) { const k = iL; iL = iR; iR = k; }
  const trunk = Math.max(0.45, v3.dist(rag.point(RAG.pelvis), mid(rag.point(RAG.shoL), rag.point(RAG.shoR))));
  return { end, phase: 'reach', t: 0, iL, iR, half: end === 'feet' ? 0.1 : clamp(v3.dist(a, b) / 2, 0.1, 0.24), from: [v3.copy(rag.point(iL)), v3.copy(rag.point(iR))], trunk };
}

// ---- carried over the shoulder
const Y: Vec3 = [0, 1, 0];
const unit = (v: Vec3, or: Vec3): Vec3 => { const l = v3.len(v); return l > 1e-6 ? v3.scale(v, 1 / l) : or; };
/** room for him to stand upright at p (player.ts canStand's own test, at a spot) */
function standRoom(g: Game, p: Vec3): boolean { const q: Vec3 = [p[0], p[1], p[2]]; g.col.collideCircle(q, 0.42, 1.0, 1.7, 2); return Math.hypot(q[0] - p[0], q[2] - p[2]) < 0.01; }
/** the unit direction a turned toward b by s of the angle between them (the short way; dead opposite: round by way of up) */
function turnDir(a: Vec3, b: Vec3, s: number): Vec3 {
  const ang = Math.acos(clamp(v3.dot(a, b), -1, 1)); if (ang < 1e-4) return b;
  let ax = v3.cross(a, b); if (v3.len(ax) < 1e-4) ax = v3.cross(a, Y); if (v3.len(ax) < 1e-4) ax = v3.cross(a, [1, 0, 0]);
  ax = v3.normalize(ax); const th = ang * s, co = Math.cos(th), si = Math.sin(th), x = v3.cross(ax, a), k = v3.dot(ax, a) * (1 - co);
  return unit([a[0] * co + x[0] * si + ax[0] * k, a[1] * co + x[1] * si + ax[1] * k, a[2] * co + x[2] * si + ax[2] * k], b);
}
/** how the body lies now */
function lieOf(rag: { point(i: number): Vec3 }): Lie {
  const hl = rag.point(RAG.hipL), hr = rag.point(RAG.hipR), p = mid(hl, hr), u = unit(v3.sub(hr, hl), [1, 0, 0]);
  const t0 = v3.sub(rag.point(RAG.spine), p), t = unit(v3.mad(t0, u, -v3.dot(t0, u)), [0, 0, 1]);
  return { p, u, t, kl: unit(v3.sub(rag.point(RAG.kneeL), hl), [0, -1, 0]), kr: unit(v3.sub(rag.point(RAG.kneeR), hr), [0, -1, 0]) };
}
/** between two lies: the hips along the straight line, every direction turned (the trunk kept square to the hip line) */
function lieMix(a: Lie, b: Lie, s: number): Lie {
  const u = turnDir(a.u, b.u, s), t0 = turnDir(a.t, b.t, s), t = unit(v3.mad(t0, u, -v3.dot(t0, u)), b.t);
  return { p: v3.lerp(a.p, b.p, s), u, t, kl: turnDir(a.kl, b.kl, s), kr: turnDir(a.kr, b.kr, s) };
}
/** on his shoulder the body RIDES him: its free limbs go through `carryRide` of his own step and turn since the last frame (ragdoll.ts ride) before they are
 *  simulated, so what swings them is the share left over and gravity — they hang and sway off him instead of trailing every stride like a flag */
function carryRides(c: { pos: Vec3; bodyYaw: number }, rag: { ride(about: Vec3, dx: number, dz: number, dyaw: number): void }, K: NonNullable<Haul['carry']>) {
  const was = K.at, k = HANDS.carryRide; K.at = [c.pos[0], c.pos[2], c.bodyYaw];
  if (!was || !(k > 0)) return;
  const dx = c.pos[0] - was[0], dz = c.pos[2] - was[1], dyaw = wrapAngle(c.bodyYaw - was[2]);
  if (Math.hypot(dx, dz) > 0.5 || Math.abs(dyaw) > 1) return;   // put somewhere by something other than his legs (a teleport): the pins gather it in, as they always did
  rag.ride([was[0], 0, was[1]], dx * k, dz * k, dyaw * k);
}
/** the five pins of a lie: both hips, the spine, both knees — each at the body's own length from the last, so the trunk is carried rigid and no thigh is stretched */
function liePins(rag: { setPin(i: number, p: Vec3): void }, dim: [number, number, number, number], L: Lie) {
  const hl = v3.mad(L.p, L.u, -dim[0] / 2), hr = v3.mad(L.p, L.u, dim[0] / 2);
  rag.setPin(RAG.hipL, hl); rag.setPin(RAG.hipR, hr); rag.setPin(RAG.spine, v3.mad(L.p, L.t, dim[1]));
  rag.setPin(RAG.kneeL, v3.mad(hl, L.kl, dim[2])); rag.setPin(RAG.kneeR, v3.mad(hr, L.kr, dim[3]));
}
/** over his left shoulder, face down: hips on the shoulder, its right hip toward his left, trunk back and down, thighs ahead and down */
function shoulderLie(g: Game): Lie {
  const c = g.player.char, f = c.forward(), L: Vec3 = [f[2], 0, -f[0]];
  const p: Vec3 = [c.pos[0] + L[0] * HANDS.carrySide + f[0] * HANDS.carryFwd, c.pos[1] + HANDS.carryUp, c.pos[2] + L[2] * HANDS.carrySide + f[2] * HANDS.carryFwd];
  const k = v3.normalize([f[0] * HANDS.carryLegs, -1, f[2] * HANDS.carryLegs]);
  return { p, u: L, t: v3.normalize([-f[0] * HANDS.carryBack, -1, -f[2] * HANDS.carryBack]), kl: k, kr: k };
}
/** where it can be laid: on its back, straight, across the front of him — in front first, else round to whichever side of him has the floor (he turns to it:
 *  `yaw`), head to that side's right then left. A side is free when he can reach it and the body's line (0.95 m each way from its hips) meets no static.
 *  null = no clear floor round him at all. */
function layLie(g: Game): { lie: Lie; yaw: number } | null {
  const c = g.player.char, at: Vec3 = [c.pos[0], c.pos[1] + 0.3, c.pos[2]];
  for (const turn of [0, 0.785, -0.785, 1.571, -1.571, 2.356, -2.356, 3.1416]) {   // (in front of him first, then round both ways to behind him: he turns to the side that has the floor)
    const yaw = c.bodyYaw + turn, d: Vec3 = [Math.sin(yaw), 0, Math.cos(yaw)], p0 = v3.mad(c.pos, d, HANDS.layAhead), m: Vec3 = [p0[0], c.pos[1] + 0.3, p0[2]];
    if (g.col.solidBlocked(at, m)) continue;
    for (const side of [1, -1]) {
      const t: Vec3 = [-d[2] * side, 0, d[0] * side];
      if (g.col.solidBlocked(m, v3.mad(m, t, 0.95)) || g.col.solidBlocked(m, v3.mad(m, t, -0.95))) continue;
      const k = v3.normalize([-t[0], -0.06, -t[2]]);
      return { lie: { p: [p0[0], c.pos[1] + 0.11, p0[2]], u: v3.cross(Y, t), t: v3.normalize([t[0], 0.17, t[2]]), kl: k, kr: k }, yaw };
    }
  }
  return null;
}
/** is he walking with it on his shoulder (player.ts: upright, facing the way he goes)? */
export function haulUpright(g: Game): boolean { const h = g.player.haul; return !!h?.carry && h.phase === 'carry'; }
/** player.ts: is he down on his heels for this beat? (along the floor: always; over the shoulder: until it is half way up, and from the moment he lays it down) */
export function haulCrouch(g: Game): boolean { const h = g.player.haul; return !h?.carry || h.phase === 'reach' || (h.phase === 'set' && h.t > HANDS.lowerSecs * 0.2) || (h.phase === 'rise' && h.t < HANDS.hoistSecs * 0.45); }
/** player.ts: the facing he keeps through the lift and the laying-down of a carried body (null = his own) */
export function haulYaw(g: Game): number | null { const h = g.player.haul; return h?.carry && (h.phase === 'rise' || h.phase === 'set') ? h.carry.yaw : null; }

/** the two spots in front of him the held limbs are carried at (left hand's, right hand's) */
function carrySpots(g: Game, h: Haul): [Vec3, Vec3] {
  const c = g.player.char, f = c.forward(), y = h.end === 'feet' ? HANDS.carryFeet : HANDS.carryHead;
  const ahead = h.end === 'feet' ? HANDS.ahead : HANDS.aheadHead, hx = c.pos[0] + f[0] * ahead, hz = c.pos[2] + f[2] * ahead;
  return [[hx + f[2] * h.half, y, hz - f[0] * h.half], [hx - f[2] * h.half, y, hz + f[0] * h.half]];
}

/** player.ts, each frame a body is in tow, in place of its two setPin lines: runs the move's beat, places the pins and feeds the animator's hands.
 *  false = no move of this file's is on (the switch off, a puppet's drag, a hold begun before it came on): the caller pins the ankles as it always did. */
export function haulPins(g: Game, dt: number): boolean {
  const pl = g.player, c = pl.char, h = pl.haul, body = pl.dragging, rag = body?.char.ragdoll;
  if (!h || !body || !rag) { c.anim.haul = null; return false; }
  h.t += dt;
  const pL = rag.point(h.iL), pR = rag.point(h.iR);
  if (h.carry && h.phase === 'reach') {
    const dHip = v3.distXZ(mid(pL, pR), c.pos), sp = h.carry.spot, there = sp ? v3.distXZ(sp, c.pos) < 0.1 : dHip <= HANDS.gripM + 0.08;
    if ((there && h.t >= HANDS.reachSecs) || h.t >= HANDS.carryStepSecs) {
      if (dHip <= HANDS.gripM + HANDS.carryNearM && standRoom(g, c.pos)) { h.phase = 'rise'; h.t = 0; h.carry.lie = lieOf(rag); h.carry.yaw = v3.yawTo(c.pos, mid(pL, pR)); rag.wake(); }
      else { pl.haul = dragHaul(g, body); return haulPins(g, 0); }   // (no room to stand where the step in left him, or he walked off from it: by an end along the floor, as it was)
    }
  }
  const K = h.carry;
  if (K) {
    if (h.phase === 'rise') { liePins(rag, K.dim, lieMix(K.lie, shoulderLie(g), smoothstep(0, 1, h.t / HANDS.hoistSecs))); if (h.t >= HANDS.hoistSecs) { h.phase = 'carry'; h.t = 0; } }
    else if (h.phase === 'carry') { carryRides(c, rag, K); liePins(rag, K.dim, shoulderLie(g)); }
    else if (h.phase === 'set' && K.to) liePins(rag, K.dim, lieMix(K.lie, K.to, smoothstep(0, 1, h.t / HANDS.lowerSecs)));
    feed(g, h);
    return true;
  }
  const carry = carrySpots(g, h);
  if (h.phase === 'reach') {
    const near = v3.distXZ(mid(pL, pR), c.pos) <= HANDS.gripM + 0.08;
    if ((near && h.t >= HANDS.reachSecs) || h.t >= HANDS.stepSecs) { h.phase = 'rise'; h.t = 0; h.from = [v3.copy(pL), v3.copy(pR)]; rag.wake(); }
  }
  if (h.phase === 'rise') {
    const s = smoothstep(0, 1, h.t / HANDS.liftSecs);
    rag.setPin(h.iL, v3.lerp(h.from[0], carry[0], s)); rag.setPin(h.iR, v3.lerp(h.from[1], carry[1], s));
    if (h.t >= HANDS.liftSecs) { h.phase = 'carry'; h.t = 0; }
  } else if (h.phase === 'carry') {
    rag.setPin(h.iL, carry[0]); rag.setPin(h.iR, carry[1]);
  } else if (h.phase === 'set') {
    const s = smoothstep(0, 1, h.t / HANDS.setSecs), y = rag.radius(h.iL) + 0.02;
    rag.setPin(h.iL, [h.from[0][0], lerp(h.from[0][1], y, s), h.from[0][2]]); rag.setPin(h.iR, [h.from[1][0], lerp(h.from[1][1], y, s), h.from[1][2]]);
  }
  feed(g, h);
  return true;
}
/** the animator's two wrist spots: on the limbs themselves, a palm's depth above their middles; open hands on the way down, closed from the lift on */
function feed(g: Game, h: Haul) {
  const c = g.player.char, rag = g.player.dragging!.char.ragdoll!;
  const up = (i: number): Vec3 => { const p = rag.point(i); return [p[0], p[1] + rag.radius(i) * 0.6 + 0.02, p[2]]; };
  if (h.carry) {
    // his left hand on its thighs (it ends up round them, the arm over the legs that hang down his chest), his right on its back until it is nearly up
    const f = c.forward(), Lf: Vec3 = [f[2], 0, -f[0]], km = mid(rag.point(RAG.kneeL), rag.point(RAG.kneeR)), hm = mid(rag.point(RAG.hipL), rag.point(RAG.hipR));
    const on = h.phase === 'carry' ? 1 : h.phase === 'rise' ? smoothstep(0.35, 0.9, h.t / HANDS.hoistSecs) : h.phase === 'set' ? 1 - smoothstep(0.1, 0.6, h.t / HANDS.lowerSecs) : 0;   // how far it is on his shoulder
    const th = v3.lerp(hm, km, 0.75), l: Vec3 = [th[0] + Lf[0] * 0.06 * on, th[1] + 0.085, th[2] + Lf[2] * 0.06 * on], r = up(RAG.spine), y = l[1] - c.pos[1];
    c.anim.haul = { l, r, rw: 1 - on, look: 0.7 * (1 - on), tilt: 0.1 * on, bow: lerp(0.12 + 0.5 * (1 - smoothstep(0.2, 0.7, y)), 0.07, on), grip: h.phase === 'reach' ? 0.25 : 0.8 };
    return;
  }
  const l = up(h.iL), r = up(h.iR), y = (l[1] + r[1]) / 2 - c.pos[1];
  // (hauling: he watches where he goes, not his hands, and stands as tall as the hold lets him — with the old stoop, the look at his hands and the bow all at
  //  once his head hung at his chest and bobbed there with every step)
  const hauling = h.phase === 'carry' ? smoothstep(0, 0.4, h.t) : 0;
  c.anim.haul = { l, r, look: lerp(0.7, 0.15, hauling), bow: (0.12 + 0.5 * (1 - smoothstep(0.2, 0.6, y))) * lerp(1, 0.6, hauling), grip: h.phase === 'reach' ? 0.25 : h.phase === 'set' ? lerp(0.85, 0.3, clamp(h.t / HANDS.setSecs, 0, 1)) : 0.85 };
}

/** is the body wedged in a way the leg sticks do not show (the head end: a held shoulder left behind its hand, or his trunk drawn out — the hips caught on
 *  something the shoulders have gone round)? */
export function haulSlack(g: Game): boolean {
  const pl = g.player, h = pl.haul, rag = pl.dragging?.char.ragdoll; if (!h || !rag || h.end !== 'head' || h.phase !== 'carry') return false;
  const carry = carrySpots(g, h), sL = rag.point(h.iL), sR = rag.point(h.iR);
  if (Math.max(v3.dist(sL, carry[0]), v3.dist(sR, carry[1])) > HANDS.slackM) return true;
  return v3.dist(rag.point(RAG.pelvis), mid(sL, sR)) > h.trunk * 1.3 + 0.1;
}
/** the 'let go of him' row: lay it down instead of dropping it. false = nothing to lay down this way (the caller lets go as it always did). */
export function haulSetDown(g: Game): boolean {
  const pl = g.player, h = pl.haul, rag = pl.dragging?.char.ragdoll; if (!h || !rag) return false;
  if (h.phase === 'set') return true;
  if (h.phase === 'reach') return false;   // not yet in his hands: he simply leaves it
  if (h.carry) {   // off his shoulder onto clear floor (none in reach: the caller drops it, as a sprint does)
    const to = layLie(g); if (!to) return false;
    h.carry.lie = lieOf(rag); h.carry.to = to.lie; h.carry.yaw = to.yaw; h.phase = 'set'; h.t = 0;
    return true;
  }
  h.phase = 'set'; h.t = 0; h.from = [v3.copy(rag.point(h.iL)), v3.copy(rag.point(h.iR))];
  return true;
}
/** has the laying-down run its course (player.ts then lets go, quietly)? */
export function haulSetDone(g: Game): boolean {
  const pl = g.player, h = pl.haul; if (!h || h.phase !== 'set') return false;
  if (!h.carry) return h.t >= HANDS.setSecs;
  const rag = pl.dragging?.char.ragdoll, to = h.carry.to; if (!rag || !to) return true;
  const at = mid(rag.point(RAG.hipL), rag.point(RAG.hipR));   // (down, and its hips where they were going — not let go of a hand's breadth up; the floor stops them a little over the mark)
  return h.t >= HANDS.lowerSecs && (h.t >= HANDS.lowerSecs + 0.5 || (Math.hypot(at[0] - to.p[0], at[2] - to.p[2]) < 0.06 && at[1] < to.p[1] + 0.12));
}
/** how fast his feet may go with a body: the step in to it at the crouch's pace, planted through the lift and the laying-down, the haul at its own (k × crouch) */
export function haulPace(g: Game): number { const h = g.player.haul; return !h || h.phase === 'carry' ? 0.6 : h.phase === 'reach' ? 1 : 0; }
/** …in m/s: the same along the floor; with it over his shoulder he walks, at carryPace × his walk */
export function haulSpeed(g: Game): number { return haulUpright(g) ? g.tune.playerWalk * HANDS.carryPace : g.tune.playerCrouch * haulPace(g); }

// ------------------------------------------------------------------------------------------------------------------------------------------ a door

const leafU = (d: Door, angle: number): [number, number] => { const a = d.def.closedDir + angle; return [Math.cos(a), Math.sin(a)]; };
/** floor distance from q to the leaf's centre line were it at `angle` */
function leafDist(d: Door, angle: number, q: Vec3): number {
  const u = leafU(d, angle), vx = q[0] - d.def.hinge[0], vz = q[2] - d.def.hinge[1]; const t = clamp(vx * u[0] + vz * u[1], 0, d.def.width);
  return Math.hypot(vx - u[0] * t, vz - u[1] * t);
}
/** which side of the leaf's line at `angle` q is on (+1 / −1: doors.ts perp ≥ 0 / < 0) and how far off it */
function leafPerp(d: Door, angle: number, q: Vec3): number { const u = leafU(d, angle); return u[0] * (q[2] - d.def.hinge[1]) - u[1] * (q[0] - d.def.hinge[0]); }
const bodyR = (d: Door) => 0.34 + d.thick / 2 + HANDS.clearM;   // (0.34: the living contacts' radius, game.ts updateDoors)
/** the nearest the leaf's line comes to q anywhere on its way from a0 to a1 */
function sweepDist(d: Door, a0: number, a1: number, q: Vec3): number {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 0.1)); let m = Infinity;
  for (let k = 0; k <= n; k++) m = Math.min(m, leafDist(d, a0 + (a1 - a0) * k / n, q));
  return m;
}
/** does the floor segment p → q cross the leaf's line as it stands at `angle`? */
function crossesLeaf(d: Door, angle: number, p: Vec3, q: Vec3): boolean {
  const s0 = leafPerp(d, angle, p), s1 = leafPerp(d, angle, q); if (s0 * s1 > 0) return false;
  const t = s0 / (s0 - s1 || 1e-9), x = p[0] + (q[0] - p[0]) * t, z = p[2] + (q[2] - p[2]) * t; const u = leafU(d, angle);
  const along = (x - d.def.hinge[0]) * u[0] + (z - d.def.hinge[1]) * u[1];
  return along > -0.1 && along < d.def.width + 0.1;
}
/** the side of the line the leaf will STAND on at a1 that q is on: > 0 = the opening's (the side the latch jamb is on), < 0 = the pocket behind the leaf */
function openSide(d: Door, a1: number, q: Vec3): number {
  const u = leafU(d, 0), L: Vec3 = [d.def.hinge[0] + u[0] * d.def.width, 0, d.def.hinge[1] + u[1] * d.def.width];
  return leafPerp(d, a1, q) * Math.sign(leafPerp(d, a1, L) || 1);
}
/** Where to stand for the leaf to go from a0 to a1 without meeting him: null = where he is; a spot = the nearest standing room the sweep misses, on his side
 *  of the wall, that he can walk straight to (no static between, none of the leaf); undefined = there is none within a step.
 *  A leaf brought round TOWARD him must also not end up between him and the doorway: the standing room wanted then is on the OPENING's side of where the leaf
 *  will stand (within HANDS.roundM — he comes out round its free end as it comes, and the leaf waits for him: DoorMove.round), from in front of the hinge half
 *  and from beside the hinge alike; only with none there is it the old answer (stay where he is if the sweep misses him, else the nearest room at all). */
function clearSpot(g: Game, d: Door, a0: number, a1: number): Vec3 | null | undefined {
  const p = g.player.char.pos, need = bodyR(d);
  const clear = sweepDist(d, a0, a1, p) >= need;
  const wall = leafPerp(d, 0, p);   // his side of the wall the door is in (the closed leaf's line); in the threshold itself either side will do
  const toward = Math.abs(a1) > Math.abs(a0) + 0.3 && Math.abs(wall) > 0.05 && wall * a1 > 0;
  if (clear && !(toward && openSide(d, a1, p) < 0.05)) return null;
  const find = (reach: number, front: boolean): Vec3 | undefined => {
    let best: Vec3 | undefined, bs = Infinity;
    for (let r = 0.15; r <= reach + 1e-6 && !best; r += 0.1) {
      for (let k = 0; k < 16; k++) {
        const a = k * Math.PI / 8, q: Vec3 = [p[0] + Math.sin(a) * r, p[1], p[2] + Math.cos(a) * r];
        if (sweepDist(d, a0, a1, q) < need + 0.02) continue;
        if (front && openSide(d, a1, q) < need) continue;   // (a body clear of its line: beyond the tip but ON the line he would clip it walking in)
        const side = leafPerp(d, 0, q); if (Math.abs(wall) > 0.2 && side * wall <= 0) continue;
        if (crossesLeaf(d, a0, p, q)) continue;
        if (g.col.solidBlocked([p[0], 0.5, p[2]], [q[0], 0.5, q[2]])) continue;
        const t: Vec3 = [q[0], q[1], q[2]]; if (g.col.collideCircle(t, 0.32, 0.2, 1.5) && v3.distXZ(t, q) > 0.02) continue;
        const tip = leafU(d, a0), hx = d.def.hinge[0] + tip[0] * d.def.width * 0.85, hz = d.def.hinge[1] + tip[1] * d.def.width * 0.85;
        const score = Math.hypot(q[0] - hx, q[2] - hz);   // of a ring's free spots, the one nearest the handle: the hand stays on it longest
        if (score < bs) { bs = score; best = q; }
      }
    }
    return best;
  };
  if (toward) { const q = find(HANDS.roundM, true); if (q) return q; if (clear) return null; }
  return find(HANDS.stepM, false);
}

/** a limp body lying where the leaf would sweep on its way from a0 to a1: any particle of any ragdoll (one in his hands handsBusy has refused already), or a
 *  man down wounded where he lies (game.ts updateDoors: the same weak contact, 0.3 round his body) */
function limpInSweep(g: Game, d: Door, a0: number, a1: number): boolean {
  const reach = d.def.width + 0.3, q: Vec3 = [0, 0, 0];
  for (const list of [g.guards, g.civilians]) for (const gd of list) {
    if (gd.wound) { const at = gd.wound.pose === 'back' ? gd.char.bones.hips : gd.char.pos; if (sweepDist(d, a0, a1, at) < 0.3 + d.thick / 2 + 0.02) return true; }
    const rag = gd.char.ragdoll; if (!rag) continue;
    for (let i = 0; i < RAG_COUNT; i++) {
      rag.point(i, q); const r = rag.radius(i);
      if (q[1] - r > d.height || Math.hypot(q[0] - d.def.hinge[0], q[2] - d.def.hinge[1]) > reach) continue;
      if (sweepDist(d, a0, a1, q) < r + d.thick / 2 + 0.02) return true;
    }
  }
  return false;
}

/** game.ts updateDoors, a 'push' / 'pull' / 'unlock' row performed on d: start working it by hand. false = not this way (the switch, a puppet, a lock against
 *  him, hands full, no room to stand clear, on a two-way door a body in its swing): the caller does what it always did (Doors.use). */
export function doorMoveBegin(g: Game, d: Door): boolean {
  const pl = g.player, p = pl.char.pos;
  if (!doorOn() || g.puppet || d.off || handsBusy(g)) return false;
  if (g.doors.lockedOut(d, p, pl.keys)) return false;
  const open = d.isClosed();
  if (pl.doorMove && pl.doorMove.d === d && pl.doorMove.open === open) return true;   // the same row tapped again while it is being done: one move, one creak
  let target = 0;
  if (open) {
    const sgn = DOORWAY.oneWay ? d.swing : Math.abs(d.angle) > 0.02 ? Math.sign(d.angle) : leafPerp(d, d.angle, p) >= 0 ? -1 : 1;
    target = sgn * Math.min(HANDS.openTo, (sgn < 0 ? -d.minA : d.maxA) - 0.02); if (Math.abs(target) < 0.3) return false;
  }
  if (clearSpot(g, d, d.angle, target) === undefined) return false;
  if (!DOORWAY.oneWay && limpInSweep(g, d, d.angle, target)) return false;   // (see the head: on two-way doors a body in the swing is the flung leaf's to move)
  // a step in to it as the hand goes out, when the leaf is to be pushed open AWAY from him from further off than a hand reaches and the step is a short one: to
  // arm's length of the face, toward the handle's half (it is on his way through) — the leaf does not wait for it. One that opens TOWARD him he reaches for from
  // where he stands — the arm goes out, the leaf comes to the hand as his feet clear its sweep — rather than walk into the sweep to walk back out of it.
  let goal: Vec3 | null = null;
  if (open && leafPerp(d, d.angle, p) * target < 0) {
    const u = leafU(d, d.angle), W = d.def.width, vx = p[0] - d.def.hinge[0], vz = p[2] - d.def.hinge[1];
    const s = clamp(vx * u[0] + vz * u[1], W * 0.45, W * 0.85), fx = d.def.hinge[0] + u[0] * s, fz = d.def.hinge[1] + u[1] * s, off = Math.hypot(p[0] - fx, p[2] - fz);
    if (off > HANDS.handM + 0.12 && off - HANDS.handM <= HANDS.inM) { const k = HANDS.handM / off; const q: Vec3 = [fx + (p[0] - fx) * k, p[1], fz + (p[2] - fz) * k]; if (!g.col.solidBlocked([p[0], 0.5, p[2]], [q[0], 0.5, q[2]])) goal = q; }
  }
  pl.easing = null;
  pl.doorMove = { d, open, target, t: 0, stage: 'hand', goal, stallT: 0, best: Math.abs(target - d.angle), stepBest: Infinity, stepStall: 0 };
  return true;
}

/** game.ts updateDoors, each frame before the leaves are stepped: the leaf of the move on round under his hand (see the head) */
export function doorMoveTick(g: Game, dt: number) {
  const pl = g.player, m = pl.doorMove; if (!m) return;
  const d = m.d, p = pl.char.pos; m.t += dt;
  const far = Math.min(v3.distXZ(d.pos, p), v3.distXZ(d.frameCentre, p)) > d.def.width + 1.4;
  if (!doorOn() || d.off || far || handsBusy(g)) { pl.doorMove = null; return; }
  if (m.stage === 'hand') {
    // the hand first: on the leaf (the door layer's own weight), or as long as a hand takes when the leaf is out of its reach — then it is unlatched, with its
    // creak (and the key's clack), exactly as the row always said, and the swing is the hand's; his feet set off for standing room the sweep misses, if they need it
    const hw = pl.char.anim.doorHands();
    if (m.t < HANDS.doorReach || (Math.max(hw.L, hw.R) < 0.6 && m.t < HANDS.handSecs)) return;
    const goal = clearSpot(g, d, d.angle, m.target);
    if (goal === undefined) { pl.doorMove = null; if (m.open === d.isClosed()) g.doors.use(d, p, PLAYER_ID, pl.keys); return; }   // (no room after all: as it always was — unless the leaf has meanwhile got where the row wanted it)
    if (m.open) { g.doors.use(d, p, PLAYER_ID, pl.keys); if (d.latched) { pl.doorMove = null; return; } }
    m.stage = 'swing'; m.t = 0; if (goal) { m.goal = goal; m.stepBest = Infinity; m.stepStall = 0; m.round = m.open && openSide(d, m.target, p) < 0.05 && openSide(d, m.target, goal) > 0; }   // (else: clear where he is — a step in to a leaf going away from him runs on)
  }
  const rem = m.target - d.angle, left = Math.abs(rem);
  if (m.open ? left < 0.02 : Math.abs(d.angle) < 0.14) { d.vel = 0; if (!m.open) g.doors.pullTo(d, PLAYER_ID); pl.doorMove = null; return; }   // open: left standing · shut: the sprung last bit and the latch are the door's own
  if (left < m.best - 1e-4 || m.goal) { m.best = Math.min(m.best, left); m.stallT = 0; }   // (while his feet are still on their way clear, the leaf is only waiting for them: no stall is counted)
  else { m.stallT += dt; if (m.stallT > HANDS.stallSecs) { d.vel = 0; pl.doorMove = null; return; } }
  const rate = HANDS.doorRate * clamp(left / 0.45, 0.3, 1) * smoothstep(-0.05, 0.12, m.t);
  const next = d.angle + Math.sign(rem) * Math.min(left, rate * Math.min(dt, 0.05));
  const now = leafDist(d, d.angle, p), then = leafDist(d, next, p);
  d.latched = false; d.closing = false; d.vel = 0; d.lastWho = PLAYER_ID; if (m.open) d.quietT = Math.min(d.quietT, -1.0);
  const free = then >= bodyR(d) - 0.02;
  // coming out round its free end from behind where it will stand: his way crosses the line the leaf ends on, so the leaf keeps clear of the whole of the way
  // he still has to go, not only of where he is — it would otherwise be standing across it by the time he got there
  let held = false;
  if (m.goal && m.round) for (let i = 1; i <= 6 && !held; i++) { const k = i / 6; held = leafDist(d, next, [p[0] + (m.goal[0] - p[0]) * k, p[1], p[2] + (m.goal[2] - p[2]) * k]) < bodyR(d) - 0.02; }
  if (!held && (free || then >= now)) d.angle = clamp(next, d.minA, d.maxA);   // never into him: it waits for his step (and one already against him only ever goes away)
  // (one-way) a leaf he is bringing round TOWARD himself is a pull, as the flung one was (doors.ts pullT): it comes past whoever stands with him on that side instead
  // of stalling on them. Only while it is clear of HIM — the pull's licence would let it through him too, and that is the thing this move is for.
  if (m.open && free && DOORWAY.oneWay && g.doors.pullFace(d, p)) d.pullT = Math.max(d.pullT, 0.05);
}

/** player.ts, the movement input: what the hands' moves do to his feet this frame. `own` = he is steering himself. null = nothing (his feet are his);
 *  [0, 0] = planted; else the unit direction of the step being taken for him. (A sprint lets go of a body in any beat: player.ts reads his own keys for that.) */
export function handsStep(g: Game, own: boolean, dt: number): [number, number] | null {
  const pl = g.player, c = pl.char;
  const h = pl.haul;
  if (h && pl.dragging) {
    if (h.phase === 'rise' || h.phase === 'set') return [0, 0];
    if (h.phase === 'reach') {
      const rag = pl.dragging.char.ragdoll; if (!rag || pl.listOpen) return [0, 0];
      if (own && !h.carry) { h.t = Math.max(h.t, HANDS.stepSecs); return null; }   // a step of his own: no walking him in — the pins gather it to him from where he goes, as they always did (not so on the way to lift it: he gets under it first, and only a sprint calls that off)
      if (h.carry?.spot) { const sp = h.carry.spot, dx = sp[0] - c.pos[0], dz = sp[2] - c.pos[2], dl = Math.hypot(dx, dz); return dl > 0.06 ? [dx / dl, dz / dl] : [0, 0]; }
      const m = mid(rag.point(h.iL), rag.point(h.iR)), dx = m[0] - c.pos[0], dz = m[2] - c.pos[2], dl = Math.hypot(dx, dz);
      return dl > HANDS.gripM ? [dx / dl, dz / dl] : [0, 0];
    }
    return null;
  }
  const m = pl.doorMove;
  if (m?.goal) {
    const done = () => { m.goal = null; return null; };
    if (own) return done();   // a step of his own: his feet are his again (the leaf still will not go into him)
    if (pl.listOpen) return [0, 0];   // (choosing a row: feet still, the leaf waits)
    const dx = m.goal[0] - c.pos[0], dz = m.goal[2] - c.pos[2], dl = Math.hypot(dx, dz);
    if (dl < m.stepBest - 0.002) { m.stepBest = dl; m.stepStall = 0; } else m.stepStall += dt;   // (his real way made — a chair, a man in the way of the step ends it where he got to)
    if (dl < 0.06 || m.stepStall > 0.25) return done();
    return [dx / dl, dz / dl];
  }
  return null;
}

/** player.ts, his carriage: does the door he is working bring his gun down off the cursor? Not while the leaf is where the gun already points (within aimArc of
 *  his aim: the muzzle and its light stay on the doorway and the free hand does the work), nor inside 0.6 s of a round of his; a leaf beside or behind his aim
 *  turns him to it, gun lowered, for the move's length. */
export function doorMoveLowers(g: Game): boolean {
  const pl = g.player, m = pl.doorMove, c = pl.char; if (!m || g.time - pl.lastFireT <= 0.6) return false;
  const u = m.d.dir(), W = m.d.def.width * 0.6, x = m.d.def.hinge[0] + u[0] * W - c.pos[0], z = m.d.def.hinge[1] + u[1] * W - c.pos[2];
  let off = Math.atan2(x, z) - c.aimYaw; off = Math.atan2(Math.sin(off), Math.cos(off));
  return Math.abs(off) > HANDS.aimArc;
}
/** ANOTHER MAN'S HAND ON A DOOR HE WORKS (HANDS.team; game.ts handsOnDoors asks for every man but the player who has no leaf under his hand by its own
 *  rules — those know a leaf he WALKS open and one he is bringing round past himself). Three more, all read off what the game already holds, none moving a
 *  leaf or a man: the door tools' lead a step from the handle he was sent to (his hand is up on the wood as he arrives, so the shove is seen to be his); a
 *  leaf he has just shoved from where he stands, while it is still in reach; a leaf he is pulling to (the squad's 'shut that door', staff shutting their own
 *  doors behind them). It moves no leaf and nobody's feet — the leaf's motion is doors.ts's and the door tools' as ever (hands-probes.ts hands-team: the same
 *  angles every frame, row on or off); the pose is character.ts doorLayer's free arm and lean, and a pose feeds the simulation like any other (where a round
 *  leaves, where an eye is), so a play-through's digest is not the row-off one. Never under a show. */
export function teamDoorHand(g: Game, gd: Guard): Door | null {
  if (!doorOn() || !HANDS.team || g.touring) return null;
  const c = gd.char; if (c.anim.kicking) return null;
  for (const op of g.doorTools.ops) { const k = op.kick; if (op.lead === gd && op.phase === 'kick' && k && k.hand && !op.door.off && Math.hypot(c.pos[0] - k.pos[0], c.pos[2] - k.pos[2]) < HANDS.teamPreM) return op.door; }
  const slow = Math.hypot(c.vel[0], c.vel[2]) < HANDS.teamPace;
  for (const d of g.doors.list) {
    if (d.off || d.lastWho !== c.id || Math.abs(d.vel) < HANDS.teamVel) continue;
    const opening = d.vel * d.angle > 0 || Math.abs(d.angle) < 0.05;
    if (!(d.closing || (opening && slow))) continue;
    if (leafDist(d, d.angle, c.pos) < HANDS.teamReachM) return d;
  }
  return null;
}
/** player.ts cancelActions / a restart: hands off everything */
export function handsCancel(g: Game) { g.player.doorMove = null; }
export function handsSummary(g: Game): string {
  const pl = g.player, h = pl.haul, m = pl.doorMove;
  return `${HANDS.on ? 'on' : 'off'}${HANDS.on && !HANDS.body ? ' · bodies off' : ''}${HANDS.on && !HANDS.door ? ' · doors off' : ''}${h ? ` · body: ${h.end} ${h.phase}` : ''}${m ? ` · door: ${m.open ? 'opening' : 'shutting'}${m.goal ? ' (stepping clear)' : ''}` : ''}`;
}
