// THE STALK (STALK) — the last three metres to a man's back are one held click. The maintainer's design: "when you're close enough to an enemy (like entering the
// closer than ever state) you can click and hold on an enemy and sam will creep toward him · you might want to click, let go to stop, and click again to continue —
// really works well with the paused animation · the game also controls the trajectory and speed and makes things smooth. it ends with you grabbing him · you get
// kicked out of the mode if he gets too far away, turns around, goes through a door in a way that doesn't make sense". Before it those metres were the player's own
// keys into a window a metre deep behind a man who is walking, seen from 21 m up.
//
//   THE HOLD     hands empty, a living man who is not onto him, inside close.ts's mode range (CLOSE.modeM) with nothing solid between, Sam in his rear arc: the LEFT
//                button PRESSED on him (the reticle's man, or the cursor within `cursorM` of him) takes him as the man stalked. While the button stays down the game
//                walks Sam: crouched, toward a point `stationM` behind the man's back, at the man's own speed plus a closing speed that eases off as he nears
//                (`closeMin` + `closeK` a metre out from `grabM`, never over `pace`), facing him. The cursor is free after the press: the man walks, the mouse need not.
//   LETTING GO   the button up: nothing is stalked. Sam is where he is, in the mode's held stride (character.ts creep: the pose stops mid-step), and his keys are
//                his own. The next press takes the man again.
//   THE GRAB     inside `grabM` with the grab on offer (close.ts closeAt: behind him, in reach, room to stand): the hold becomes the grab — game.ts takes
//                `stalkGrab` exactly where it takes the row's (player.ts startGrab).
//   OUT          he is dead, held, onto Sam, or out of the picture · past CLOSE.modeOutM · a wall or a door leaf between them · he has turned until Sam is no longer
//                behind him (`outCos`: a few degrees of grace past the rear arc's own edge) · Sam's hands are no longer empty or are busy · a move key of the
//                player's own (his feet are his again at once). Out = nothing stalked until the button is pressed afresh; a button merely still down does nothing.
//
// What it does NOT touch: what the men see and hear (a creeping Sam files the crouch's footfalls and moves under their eyes as any crouched Sam), the grab itself,
// a civilian's own grab row. With `only` (below) a staff man's 'grab him' row is gone: the held click is the one way to him. The left click that began or carries a stalk is no blow (game.ts asks `stalkHas`).
// ON in the page unless ?stalk=0 (src/host/profile.ts pageSwitches); off here and on the harness's frozen stand (src/host/standup.ts; TPS_STALK=1 turns it on
// there). Off = the build as it was. Check: tools/qa/stalk-check.ts (STALK_BREAK=1 must fail).
import { SideMap } from '../math/side';
import { Vec3, wrapAngle, clamp } from '../math/vec';
import type { Game, Guard } from './game';
import { CLOSE, closeAt, closeLive, closeSubject, closeClear } from './close';
import { holdPolish } from './character';
import { samStaggered } from './samstun';
import { canStand } from './player';

export const STALK = {
  on: false,
  /** THE CLICK IS THE ONLY WAY IN (the maintainer: "we should get rid of E to grab then. lmb is the only way"): with the stalk on, a staff man has no 'grab him'
   *  row — the list says 'hold LMB to grab him' and the interaction key does nothing to him. A civilian keeps her row (nobody stalks her). Nothing with `on`
   *  off. ?stalkonly=0 puts the row back beside the stalk. */
  only: true,
  /** m: the press is ON a man when the cursor's floor point is this near him (or the reticle has him) */
  cursorM: 1.1,
  /** cos of his bearing to Sam under which a press can begin one (−0.25 = the grab's own rear arc, 104.5° off his facing) · and past which Sam is no longer
   *  behind him and the stalk is over (93°: a few degrees of grace so a man swaying on his feet does not throw him out) */
  beginCos: -0.25, outCos: -0.05,
  /** m: the point behind his back Sam is walked toward · inside this the hold becomes the grab (under close.ts's reach of 1.05) */
  stationM: 0.55, grabM: 0.95,
  /** m/s: never faster than this · the closing speed on the man at `grabM` · and what each metre beyond it adds */
  pace: 1.6, closeMin: 0.3, closeK: 0.6,
  /** 1/s: how quickly his speed takes up what the stalk asks, speeding up · and slowing (his own walk's are 6 and 12: gentler in, so the creep starts like a breath) */
  easeUp: 4, easeDown: 9,
  /** THE BODY SAYS HOW CLOSE (the maintainer: "we want very very smooth transitions from regular crouching to the closer than ever state. then, once you click
   *  and hold its very smooth to gradually shift the animation until you end on a grab, and you can be interrupted any time"). Behind a man he could stalk, or
   *  stalking him, Sam's pose is a function of the DISTANCE to that man's back and of nothing else: from `reachFrom` m in, the left arm comes up for his neck
   *  (the tell's own reach, character.ts readyLayer, at a weight that is `reach` by the time the grab fires), and from `riseFrom` m in he comes up out of the
   *  crouch (`rise` of the way to his feet by `riseBy` m — the grab itself stands him up the rest). Both run straight by the distance. Because it is the distance's, letting go of the button holds
   *  the pose where it is — a frame of the move, paused — and the next press goes on from it; his own keys behind the same man show the same body. What the men
   *  see and hear of him is the crouch's, as it was. `tell` off = the tell in reach alone, as before the stalk. */
  tell: true, reachFrom: 2.9, reach: 1, riseFrom: 2.3, riseBy: 1.05, rise: 0.7,
  /** THE STEP IN: the grab a stalk ends in closes the last of the gap in one step over `catchSecs` (a step longer than `catchM` takes up to `catchLong` times that: the haul back has what is left of HOLD.secs.grab; `turnIn`: he comes round to the man's back through the step, not in its first frames) —
   *  a lunge: off the mark over its first three frames, most of the way inside a third of it, landing gently (stepEase). The grab's own way in covers a
   *  fifth of the gap in its first FRAME. His legs are given the step, at no more than `catchStride` m/s. 0 = the grab's own.
   *  THE YANK: once the step has landed the man is hauled `yank` m straight back the way he was facing from — Sam going back with him — over what is left of
   *  the grab: movement across the floor is what the game's camera shows of a grab (the pose's share: character.ts HOLD.yank). Less where something solid
   *  stands behind the pair (`yankRoom` m kept clear behind Sam); 0 = he is held where he stood. */
  catchSecs: 0.3, catchM: 0.75, catchLong: 1.1, turnIn: true, catchStride: 1.5, yank: 0.28, yankRoom: 0.4,
  /** THE SAME AT A CORNER (the maintainer: "curious if we can make this language work for working corners. like when you're at a corner you can either grab
   *  or CQC with the right timing"). With his back on a wall (the wall hold, not the stack) and his hands empty, the left button HELD is a man lying in wait:
   *  nothing moves, and the moment a man who is not onto him is inside `cornerM` with Sam at least `cornerDeg`° round from his nose — he has come past the
   *  corner, most of a pace — Sam comes off the wall onto him: the grab, by the same eased step in. Pressed too soon it simply waits; let go, nothing happens; a man who comes
   *  round FACING him is not taken (the right button's knockout is still the player's own timing, as off a wall). `corner` off = the button on a wall does
   *  nothing, as before. The page: ?stalkcorner=0. */
  corner: true, cornerM: 1.35, cornerDeg: 110,
  /** BROKEN OFF BY THE MAN (stalkStep): `jolt` = how much of the animator's duck (character.ts flinchFrom, soft) Sam gives when the man turns off his back with
   *  the stalk on AND comes on round to face him (Sam inside `joltFace`° of his nose within `joltSecs` s: a patrol's quarter turn is not that) — the whole of it,
   *  at once, when the man is onto him. 0 = none: the stalk ends and he sinks back into the crouch, as it was. joltFace 180 = at any turn that ends the stalk.
   *  THE WAIT SHOWS (closeTick): on the wall with the button held he coils — sunk `cornerCoil` of the way into the crouch, the lead hand tucked toward the man at `cornerReach[0]`
   *  of the grab's reach, growing to `cornerReach[1]` as the nearest man he could take comes from `cornerSee` m to `cornerM`; he comes up out of the coil over
   *  `cornerRise` s of the step in. `cornerShow` off = the wall stance alone, as it was */
  jolt: 0.6, joltFace: 50, joltSecs: 0.6, cornerShow: true, cornerSee: 3.2, cornerReach: [0.25, 0.55] as [number, number], cornerCoil: 0.3, cornerRise: 0.24,
};
/** tallies for the checks and the page's hook (begun = presses that took a man; out = why each ended without a grab) */
export const STALK_STATS = { begun: 0, grabs: 0, corner: 0, out: { let: 0, far: 0, turned: 0, wall: 0, him: 0, hands: 0, keys: 0 }, last: '' };
type Why = keyof typeof STALK_STATS.out;

interface St { on: Guard | null; grab: Guard | null; t: number; /** on a wall with the button held and nothing in the way of a grab: he is lying in wait */ wait?: boolean; /** the button went down and has not come up or taken a man since: a stalk may begin */ armed?: boolean;
  /** the man who broke a stalk off by turning, and when: if he comes round to FACE Sam inside STALK.joltSecs, Sam ducks */ broke?: { gd: Guard; t: number; /** where Sam stood */ at: Vec3 } | null }
const STATE = new SideMap<Game, St>('stalk.STATE');
function stateOf(g: Game): St { let s = STATE.get(g); if (!s) { s = { on: null, grab: null, t: -1 }; STATE.set(g, s); } return s; }
function end(S: St, why: Why) { if (S.on) { S.armed = false; S.on = null; STALK_STATS.out[why]++; STALK_STATS.last = why; } }

/** his bearing to a point, off his facing (0 = dead ahead of him) */
const bearingOf = (gd: Guard, p: ArrayLike<number>): number => wrapAngle(Math.atan2(p[0] - gd.char.pos[0], p[2] - gd.char.pos[2]) - gd.char.bodyYaw);
/** are Sam's hands free for it at all (empty, and nothing else has him) */
function free(g: Game): boolean {
  const pl = g.player;
  return STALK.on && closeLive(g) && !g.puppet && pl.holstered && !pl.down && !pl.holding && !pl.takedown && !pl.dragging && !pl.kick && !pl.picking && !pl.wanding && !pl.wall && !pl.listOpen && able(g);
}
/** the gate game.ts puts on a grab, so nothing is handed over that it would refuse: not folded by a blast, no hand on a breaker's lever */
const able = (g: Game): boolean => !samStaggered(g) && !g.player.breakerMove;
/** why this man cannot be stalked from `p` right now, or null when he can (`begin`: the stricter test a press must pass — the rear arc itself) */
function outOf(g: Game, gd: Guard, p: ArrayLike<number>, begin: boolean): Why | null {
  if (gd.civ || !closeSubject(g, gd) || gd.state === 'alert') return 'him';
  const d = Math.hypot(p[0] - gd.char.pos[0], p[2] - gd.char.pos[2]);
  if (d >= (begin ? CLOSE.modeM : CLOSE.modeOutM)) return 'far';
  if (Math.cos(bearingOf(gd, p)) > (begin ? STALK.beginCos : STALK.outCos)) return 'turned';
  if (!closeClear(g, gd.char.pos, p)) return 'wall';
  return null;
}
/** COULD A PRESS ON THIS MAN BEGIN ONE from where Sam stands (the row's hint asks) */
export function stalkCould(g: Game, gd: Guard): boolean { return free(g) && outOf(g, gd, g.player.char.pos, true) === null; }
/** the man a press at the cursor is on: the reticle's if he can be stalked, else the nearest such man within `cursorM` of the cursor's floor point */
function pressed(g: Game): Guard | null {
  const p = g.player.char.pos, a = g.aimPoint;
  if (g.aimGuard && outOf(g, g.aimGuard, p, true) === null) return g.aimGuard;
  let best: Guard | null = null, bd = STALK.cursorM;
  for (const gd of g.guards) { const d = Math.hypot(a[0] - gd.char.pos[0], a[2] - gd.char.pos[2]); if (d < bd && outOf(g, gd, p, true) === null) { best = gd; bd = d; } }
  return best;
}

/** STALK.corner: the man the wait at a corner takes this frame — the nearest who has come past him — or null (not on a wall with empty hands; nobody past) */
function cornerGate(g: Game): boolean {
  const pl = g.player, w = pl.wall;
  return !(!STALK.on || !STALK.corner || !w || w.kind === 'stack' || w.drawn || !closeLive(g) || g.puppet || !pl.holstered || pl.down || pl.holding || pl.takedown || pl.dragging || pl.kick || pl.picking || pl.wanding || pl.listOpen || !able(g) || (pl.crouch && !canStand(g)));   // (the last: startGrab would refuse it, with its line, every frame the button stayed down)
}
function cornerMan(g: Game): Guard | null {
  const pl = g.player;
  if (!cornerGate(g)) return null;
  const p = pl.char.pos, cos = Math.cos(STALK.cornerDeg * Math.PI / 180); let best: Guard | null = null, bd = STALK.cornerM;
  for (const gd of g.guards) {
    if (gd.civ || !closeSubject(g, gd) || gd.state === 'alert') continue;
    const d = Math.hypot(p[0] - gd.char.pos[0], p[2] - gd.char.pos[2]);
    if (d < bd && Math.cos(bearingOf(gd, p)) <= cos && closeClear(g, gd.char.pos, p)) { best = gd; bd = d; }
  }
  return best;
}
/** the animator's SOFT duck (character.ts flinchFrom): it leaves a hand's errand alone — a pistol he draws the next instant keeps its draw and its click */
function duck(g: Game, gd: Guard, k: number) { const p = g.player.char.pos; g.player.char.anim.flinchFrom([gd.char.pos[0] - p[0], 0, gd.char.pos[2] - p[2]], k, true); }
/** the man who turned off his back with a stalk on (St.broke): if HE comes on round until where Sam stood is inside `joltFace` degrees of his nose — or he is
 *  onto him — inside `joltSecs`, Sam ducks: part of the duck for the turn, the whole for a man onto him. A man who only turned a quarter (a patrol's corner)
 *  never gets there. Only while Sam's hands are still empty and idle, nobody else is being stalked, he has not gone a pace from where he was caught, and
 *  nothing solid is between them. */
function brokeDuck(g: Game, S: St) {
  const b = S.broke; if (!b) return; const p = g.player.char.pos;
  if (g.time - b.t > STALK.joltSecs || S.on || !free(g) || !closeSubject(g, b.gd) || Math.hypot(p[0] - b.at[0], p[2] - b.at[2]) > 1) { S.broke = null; return; }
  if (!closeClear(g, b.gd.char.pos, p)) return;
  if (b.gd.state === 'alert') { duck(g, b.gd, 1); S.broke = null; }
  else if (Math.abs(bearingOf(b.gd, b.at)) <= STALK.joltFace * Math.PI / 180) { duck(g, b.gd, STALK.jolt); S.broke = null; }
}
/** THE POLISH, UP OR DOWN TOGETHER (the page's ?stalkpolish=0, and journal.ts for a recording from before the fourth pass): the turn through the step, the longer
 *  long step, the wait's pose at a corner, the duck when the man turns round — and the hold's share (character.ts holdPolish). Up = the tables' own numbers. */
const POLISH_UP = { catchLong: STALK.catchLong, jolt: STALK.jolt } as const;   // (this file's own table, as the module has it)
export function stalkPolish(up: boolean) {
  STALK.turnIn = STALK.cornerShow = up; STALK.catchLong = up ? POLISH_UP.catchLong : 1; STALK.jolt = up ? POLISH_UP.jolt : 0; holdPolish(up);
}
/** what the stalk asks of his feet this frame: the unit direction, the speed, and the point he faces (the man's chest) */
export interface StalkMove { mx: number; mz: number; pace: number; at: Vec3 }
/** ONCE A FRAME from updatePlayer, before his keys become a step: the left button held / pressed this frame, and whether a move key of his own is down.
 *  null = his feet and his aim are his own. */
export function stalkStep(g: Game, lmb: boolean, lmbHit: boolean, ownKeys: boolean): StalkMove | null {
  const S = stateOf(g); S.t = g.time; S.grab = null; S.wait = false; brokeDuck(g, S);
  if (!free(g)) { end(S, 'hands'); if (lmb || lmbHit) { S.wait = cornerGate(g); const gd = cornerMan(g); if (gd) { S.grab = gd; STALK_STATS.grabs++; STALK_STATS.corner++; STALK_STATS.last = 'corner'; } } return null; }
  if (lmbHit) S.armed = true; else if (!lmb) S.armed = false;
  // (a press made with a move key still down waits for the key: the button held on him begins it the frame his own feet stop — once a press)
  const had = S.on;
  if (!S.on && S.armed && !ownKeys) { const gd = pressed(g); if (gd) { S.on = gd; S.armed = false; STALK_STATS.begun++; } }
  const gd = S.on; if (!gd) return null;
  if (!lmb && !lmbHit) { end(S, 'let'); return null; }
  if (ownKeys) { end(S, 'keys'); return null; }
  const p = g.player.char.pos, why = outOf(g, gd, p, false);
  if (why) {   // (STALK.jolt: broken off by the man himself, Sam shrinks back off him — at once when the man is onto him, and when he has turned off his back only if he comes on round to face Sam: brokeDuck; not on the frame a stalk began)
    if (had === gd && STALK.jolt > 0) { if (why === 'him') duck(g, gd, 1); else if (why === 'turned') S.broke = { gd, t: g.time, at: [p[0], p[1], p[2]] }; }
    end(S, why); brokeDuck(g, S); return null; }
  const gp = gd.char.pos, at: Vec3 = [gp[0], gp[1] + 1.2, gp[2]], dist = Math.hypot(p[0] - gp[0], p[2] - gp[2]);
  if (dist < STALK.grabM) {
    const o = closeAt(g, gd, p);
    if (o.can && o.grab) { S.on = null; S.grab = gd; STALK_STATS.grabs++; STALK_STATS.last = 'grab'; }   // (game.ts takes it this frame, where it takes the row's)
    if ((o.can && o.grab) || o.win?.grab) return { mx: 0, mz: 0, pace: 0, at };   // …or he waits in reach: no room to stand up behind him here (the row says so)
    // …or he is in reach on the man's flank, outside the grab's own arc (the man turned a little): he is walked on round to the point behind his back, below
  }
  // toward the point behind his back: from his rear it is a straight line in; from a rear quarter it swings Sam in behind him as he closes
  const yaw = gd.char.bodyYaw, bx = gp[0] - Math.sin(yaw) * STALK.stationM - p[0], bz = gp[2] - Math.cos(yaw) * STALK.stationM - p[2], bl = Math.hypot(bx, bz) || 1;
  const pace = Math.min(STALK.pace, Math.hypot(gd.char.vel[0], gd.char.vel[2]) + STALK.closeMin + clamp(dist - STALK.grabM, 0, 4) * STALK.closeK);
  return { mx: bx / bl, mz: bz / bl, pace, at };
}
/** THE TELL BY DISTANCE (close.ts closeTick, once a frame): the man Sam's body speaks of — the one stalked, else the nearest he could begin on —
 *  the point the arm goes for (his neck), and how much of the reach and of the rise the distance asks for. null = none of it (the tell as close.ts has it). */
export function stalkTell(g: Game): { gd: Guard; at: Vec3; reach: number; rise: number } | null {
  if (!STALK.tell || !free(g)) return null;
  const p = g.player.char.pos; let gd = STATE.get(g)?.on ?? null, bd = Infinity;
  if (!gd) for (const x of g.guards) { const d = Math.hypot(p[0] - x.char.pos[0], p[2] - x.char.pos[2]); if (d < bd && d < CLOSE.modeM && outOf(g, x, p, true) === null) { gd = x; bd = d; } }
  if (!gd) return null;
  const gp = gd.char.pos, d = Math.hypot(p[0] - gp[0], p[2] - gp[2]), neck = gd.char.bones.neck ?? gd.char.bones.head, at: Vec3 = neck ? [neck[0], neck[1], neck[2]] : [gp[0], gp[1] + 1.45, gp[2]];
  // (straight by the distance, not an S: an S did all of its work between 1.8 and 1.5 m and nothing either side — the animator's own easing rounds the ends)
  const by = (from: number, to: number) => clamp((from - d) / Math.max(0.05, from - to), 0, 1);
  return { gd, at, reach: STALK.reach * by(STALK.reachFrom, STALK.grabM), rise: at[1] - gp[1] > 1.2 ? STALK.rise * by(STALK.riseFrom, Math.max(STALK.grabM, STALK.riseBy)) : 0 };   // (a man sat or bent low: nothing to come up for)
}
/** THE WAIT AT A CORNER, ON HIS BODY (close.ts closeTick): lying in wait this frame — where his hands point (the neck of the nearest man he could take, else
 *  out from the wall at his own shoulder height), how much of the grab's reach, and how far he is sunk */
export function stalkWait(g: Game): { at: Vec3; reach: number; coil: number } | null {
  const S = STATE.get(g), pl = g.player, w = pl.wall; if (!STALK.cornerShow || !S || !S.wait || !w || g.time - S.t > 0.1 || !cornerGate(g)) return null;
  const p = pl.char.pos; let best: Guard | null = null, bd = STALK.cornerSee;
  for (const gd of g.guards) { if (gd.civ || !closeSubject(g, gd) || gd.state === 'alert') continue; const d = Math.hypot(p[0] - gd.char.pos[0], p[2] - gd.char.pos[2]); if (d < bd && closeClear(g, gd.char.pos, p)) { best = gd; bd = d; } }
  const neck = best ? best.char.bones.neck ?? best.char.bones.head : null, R = STALK.cornerReach;
  const at: Vec3 = neck ? [neck[0], neck[1], neck[2]] : best ? [best.char.pos[0], 1.45, best.char.pos[2]] : [p[0] + w.n[0] * 0.8, 1.35, p[2] + w.n[2] * 0.8];
  const near = best ? clamp((STALK.cornerSee - bd) / Math.max(0.05, STALK.cornerSee - STALK.cornerM), 0, 1) : 0;
  return { at, reach: R[0] + (R[1] - R[0]) * near, coil: STALK.cornerCoil };
}
/** a man is being stalked, or the stalk has just become a grab: this frame's left click is the stalk's, no blow */
export function stalkHas(g: Game): boolean { const S = STATE.get(g); return !!S && S.t === g.time && (!!S.on || !!S.grab); }
/** the man the stalk reached this frame: the grab to take now (game.ts) */
export function stalkGrab(g: Game): Guard | null { const S = STATE.get(g); return S && S.t === g.time ? S.grab : null; }
/** the man being stalked right now, for the picture and the checks */
export function stalkOn(g: Game): Guard | null { return STATE.get(g)?.on ?? null; }
/** a reset of the floor's men (game.ts resetGuards), a load: nothing is stalked */
export function stalkReset(g: Game) { const S = STATE.get(g); if (S) { S.on = null; S.grab = null; S.t = -1; S.wait = false; S.armed = false; S.broke = null; } }

/** the step in's ease (STALK.catchSecs), 0‥1 → 0‥1: he is off the mark over the first `P` of it (a quadratic, so the first frame is no snap) and from there
 *  it is a cubic ease-out, joined with one slope: some three fifths of the way inside a third of the time, landing gently */
export function stepEase(u: number): number {
  const v = clamp(u, 0, 1), P = 0.15, B = 1 / ((1 - P) * (1 - P) * (1 + 0.5 * P)), A = 3 * B * (1 - P) * (1 - P) / (2 * P);
  return v < P ? A * v * v : 1 - B * (1 - v) ** 3;
}
