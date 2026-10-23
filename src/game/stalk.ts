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
};
/** tallies for the checks and the page's hook (begun = presses that took a man; out = why each ended without a grab) */
export const STALK_STATS = { begun: 0, grabs: 0, out: { let: 0, far: 0, turned: 0, wall: 0, him: 0, hands: 0, keys: 0 }, last: '' };
type Why = keyof typeof STALK_STATS.out;

interface St { on: Guard | null; grab: Guard | null; t: number }
const STATE = new SideMap<Game, St>('stalk.STATE');
function stateOf(g: Game): St { let s = STATE.get(g); if (!s) { s = { on: null, grab: null, t: -1 }; STATE.set(g, s); } return s; }
function end(S: St, why: Why) { if (S.on) { S.on = null; STALK_STATS.out[why]++; STALK_STATS.last = why; } }

/** his bearing to a point, off his facing (0 = dead ahead of him) */
const bearingOf = (gd: Guard, p: ArrayLike<number>): number => wrapAngle(Math.atan2(p[0] - gd.char.pos[0], p[2] - gd.char.pos[2]) - gd.char.bodyYaw);
/** are Sam's hands free for it at all (empty, and nothing else has him) */
function free(g: Game): boolean {
  const pl = g.player;
  return STALK.on && closeLive(g) && !g.puppet && pl.holstered && !pl.down && !pl.holding && !pl.takedown && !pl.dragging && !pl.kick && !pl.picking && !pl.wanding && !pl.wall && !pl.listOpen;
}
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

/** what the stalk asks of his feet this frame: the unit direction, the speed, and the point he faces (the man's chest) */
export interface StalkMove { mx: number; mz: number; pace: number; at: Vec3 }
/** ONCE A FRAME from updatePlayer, before his keys become a step: the left button held / pressed this frame, and whether a move key of his own is down.
 *  null = his feet and his aim are his own. */
export function stalkStep(g: Game, lmb: boolean, lmbHit: boolean, ownKeys: boolean): StalkMove | null {
  const S = stateOf(g); S.t = g.time; S.grab = null;
  if (!free(g)) { end(S, 'hands'); return null; }
  if (!S.on && lmbHit && !ownKeys) { const gd = pressed(g); if (gd) { S.on = gd; STALK_STATS.begun++; } }
  const gd = S.on; if (!gd) return null;
  if (!lmb && !lmbHit) { end(S, 'let'); return null; }
  if (ownKeys) { end(S, 'keys'); return null; }
  const p = g.player.char.pos, why = outOf(g, gd, p, false); if (why) { end(S, why); return null; }
  const gp = gd.char.pos, at: Vec3 = [gp[0], gp[1] + 1.2, gp[2]], dist = Math.hypot(p[0] - gp[0], p[2] - gp[2]);
  if (dist < STALK.grabM) {
    const o = closeAt(g, gd, p);
    if (o.can && o.grab) { S.on = null; S.grab = gd; STALK_STATS.grabs++; STALK_STATS.last = 'grab'; }   // (game.ts takes it this frame, where it takes the row's)
    return { mx: 0, mz: 0, pace: 0, at };   // …or he waits in reach: no room to stand up behind him here (the row says so)
  }
  // toward the point behind his back: from his rear it is a straight line in; from a rear quarter it swings Sam in behind him as he closes
  const yaw = gd.char.bodyYaw, bx = gp[0] - Math.sin(yaw) * STALK.stationM - p[0], bz = gp[2] - Math.cos(yaw) * STALK.stationM - p[2], bl = Math.hypot(bx, bz) || 1;
  const pace = Math.min(STALK.pace, Math.hypot(gd.char.vel[0], gd.char.vel[2]) + STALK.closeMin + clamp(dist - STALK.grabM, 0, 4) * STALK.closeK);
  return { mx: bx / bl, mz: bz / bl, pace, at };
}
/** a man is being stalked, or the stalk has just become a grab: this frame's left click is the stalk's, no blow */
export function stalkHas(g: Game): boolean { const S = STATE.get(g); return !!S && S.t === g.time && (!!S.on || !!S.grab); }
/** the man the stalk reached this frame: the grab to take now (game.ts) */
export function stalkGrab(g: Game): Guard | null { const S = STATE.get(g); return S && S.t === g.time ? S.grab : null; }
/** the man being stalked right now, for the picture and the checks */
export function stalkOn(g: Game): Guard | null { return STATE.get(g)?.on ?? null; }
/** a reset of the floor's men (game.ts resetGuards), a load: nothing is stalked */
export function stalkReset(g: Game) { const S = STATE.get(g); if (S) { S.on = null; S.grab = null; S.t = -1; } }
