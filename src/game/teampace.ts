// TEAMMATES ARE SLOWER THAN THE PLAYER, AND SPRINT ONLY FOR A REASON (TEAMPACE.on: on in the page, ?teampace=0; off here and on the frozen stand, TPS_TEAMPACE=1).
//
// The play note this answers: the player moves at 1×, a teammate at 0.8× — "when you send them an order and they start moving, you can always catch up
// with them"; "if you sprint to go somewhere … the teammates should also sprint when they're following you"; sprinting is "in their toolbox, but they should
// use it pretty infrequently, like maybe only if they're running to cover" — "it should just generally make sense, because sprinting is actually just very risky".
//
// Before it the team's legs were capped at guards.ts PACE.max (2.2 m/s) whatever was asked, the player walked at 1.55 and ran at 4.7: an ordered team out-walked
// him to every door, and a file left behind by his sprint closed up at 2.2.
//
//   THE WALK     a teammate's legs are asked for no more than `k` × the player's walk (tune.playerWalk) on an order or on his own — guards.ts teamPace's cap,
//                in PACE.max's place, for the same men (teamPaced). His card still weighs on it (kitload.ts), a hurt man's cap and the silent squad's are under it.
//   FOLLOWING    a man falling in who is off his place closes at up to `followK` × the player's walk (teamFollow), so a walking player does not string his
//                file out behind him. While the PLAYER SPRINTS a follower who is `behindM` off his place — and has nobody to fight — runs with him at the
//                player's own sprint, and keeps it until the player stops running (`follow`).
//   THE FIGHT    what the fight asks of his legs is not a walk to a place and keeps the pace it had (PACE.max): a man who has somebody in his sights or lost
//                one `fightSecs` ago; the leg through an ordered door (ORDERS.entry: the stun's seconds are counted on it); a step the
//                room fight orders (off a doorway's opening, round a friend in his line); the breach drill; a man leaving a grenade who may not run;
//                and a man a grenade took off his place, for `backSecs` after it (a door order waits for its men, and counts the seconds).
//   A REASON     on his own (`own`) a teammate RUNS for one of two things — and for a third when a tutorial step tells him to (`told`: teamTold, at the
//                foot of this file) — each written down as it is taken (TEAMPACE_STATS, TEAMPACE_DEBUG.log):
//                  blast   he is running from a live grenade (frag.ts fragRunning) — at the pace the flee asks, as anybody's legs;
//                  cover   loud has just reached him, he has no man in his sights, the floor he is on is in the line of a man he knows of, his mark is out
//                          of it and in plain sight across `dashM` or more of the same floor: he runs the leg (teamDash) — never round a corner, never
//                          through a doorway, never a man falling in (his place is the player's to move).
//                Never the silent squad, a squad nobody has found, a man sneaking with the player (blast apart: nobody walks off a grenade), never a hurt man.
//   THE COST     a teammate at a run (`runAt`, the sprint clip's own threshold) carries his gun low and fires nothing (teamSprinting: squad.ts, roomfight.ts),
//                his boots are a sprinter's (`step`: the player's own level) to whoever hears them, and a leaf he meets is shouldered as a runner's is.
//
// Off = the build as it was: every function here answers on its first line.
import type { Game, Guard } from './game';
import type { Vec3 } from '../math/vec';
import { SideMap } from '../math/side';
import { PACE, teamPaced } from './guards';
import { fragRunning } from './frag';
import { sneaking } from './sneak';
import { unseenMan } from './unseen';
import { silentMan, silentStep } from './silent';
import { isHurt } from './condition';
import { exposedAt } from './picture';
import { loadPaceOn, loadGait, loadHeard, KITLOAD } from './kitload';

export const TEAMPACE = {
  on: false,
  /** a teammate's walk, × the player's (tune.playerWalk) */
  k: 0.8,
  /** a follower off his place closes at up to this × the player's walk (at 1 a file strings out behind a walking player: nobody closes on a man at his own pace) */
  followK: 1.3,
  /** followers run while the player sprints; `behindM`: how far off his place a man starts to */
  follow: true, behindM: 1.0,
  /** a man who lost his man this long ago still moves at the fight's pace (s) */
  fightSecs: 2,
  /** … and a man a grenade took off his place goes back to it at the fight's pace, this long after he stopped running from it (s; 0 = at the walk) */
  backSecs: 6,
  /** on their own: a run for a reason (blast, cover) */
  own: true,
  /** a run to cover: the least leg worth running (m), how exposed the floor he stands on must be (picture.ts exposedAt), how often it is asked (s) */
  dashM: 2.5, dashSeen: 0.5, dashEvery: 0.25,
  /** … and how lately a shot, a charge or a boot must have reached his ears (s) */
  dashHot: 6,
  /** m/s from which a teammate is running: the gun goes low, nothing is fired, the boots are a sprinter's (character.ts BLEND.jogAt) */
  runAt: 2.7,
  /** m/s² a man with leave to run picks pace up at (guards.ts PACE.accel is 2.6: a walker leaning into a walk) */
  accel: 6,
  /** a sprinting teammate's footfall (the player's own sprint is 1) */
  step: 1,
  /** two runs of one man this close together are one (s) */
  gap: 1,
};
export type RunWhy = 'follow' | 'blast' | 'cover' | 'told';
/** runs taken, by reason, and the seconds spent at them (read by the checks and the tallies; nothing in the game reads it) */
export const TEAMPACE_STATS = { follow: 0, blast: 0, cover: 0, told: 0, secs: 0 };
export const TEAMPACE_DEBUG: { log?: (s: string) => void } = {};
const BREAK = (() => { try { return String((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.TEAMPACE_BREAK ?? '') === '1'; } catch { return false; } })();

/** what a man has leave for — 'close' a follower closing on his place, 'fight' a move the fight asks (neither is a run) — the most his legs may be asked
 *  for while it lasts, and when it ends */
type Leave = { why: RunWhy | 'close' | 'fight'; top: number; until: number };
const leave = new SideMap<Guard, Leave>('teampace.leave');
/** when he last ran under a reason, and which (the tally's own: a run is written down once) */
const ran = new SideMap<Guard, { t: number; why: RunWhy }>('teampace.ran');
/** a run to cover as last asked: when, for which mark, the answer */
const dash = new SideMap<Guard, { t: number; x: number; z: number; yes: boolean }>('teampace.dash');
/** the last moment a man had a reason to run, whatever his legs were doing (the checks' question: was that speed a run for a reason) */
const reasonT = new SideMap<Guard, number>('teampace.reasonT');
/** a leave given for 'this frame' lasts this long (s): past the next step at any frame rate the page runs */
const FRAME = 0.1;

/** this teammate's pace is the rule's this frame */
export function teamSlow(g: Game, gd: Guard): boolean { return TEAMPACE.on && !BREAK && teamPaced(g, gd); }
/** a teammate's walk, m/s */
export function teamWalk(g: Game): number { return g.tune.playerWalk * TEAMPACE.k; }
/** he is one of the quiet: no run of his own, none behind the player */
function quiet(g: Game, gd: Guard): boolean { return sneaking(g, gd) || unseenMan(g, gd) || silentMan(g, gd); }
const isRun = (why: Leave['why']): why is RunWhy => why !== 'close' && why !== 'fight';

/** leave to go faster than the walk for `secs` more than this frame. False = none (the switch off, a man the rule has not; for a run: a quiet or a hurt man) */
export function teamLeave(g: Game, gd: Guard, why: Leave['why'], top: number, secs = 0): boolean {
  if (!teamSlow(g, gd)) return false;
  if (isRun(why)) { if (why === 'follow' ? !TEAMPACE.follow : !TEAMPACE.own) return false; if (quiet(g, gd) || isHurt(g, gd)) return false; }
  const was = leave.get(gd), until = g.time + secs + FRAME;
  if (was && g.time <= was.until && was.until > until && was.top >= top) return true;   // (a longer leave for more pace stands: a follower's frame of closing does not end the fight's step)
  leave.set(gd, { why, top, until });
  return true;
}
function live(g: Game, gd: Guard): Leave | null { const L = leave.get(gd); return L && g.time <= L.until ? L : null; }
/** the fight has his legs: a man in his sights, or one lost `fightSecs` ago (not a man only turning to where he heard something: that is a walk still) */
function fighting(g: Game, gd: Guard): boolean { const O = g.fight.opOf(gd); return !!O && (!!O.tgt || g.time - O.lostAt < TEAMPACE.fightSecs); }
/** he may run from the grenade he is leaving (frag.ts): not with `own` off, not a hurt man — who leave it at the fight's pace */
function blastRun(g: Game, gd: Guard): boolean { return TEAMPACE.own && !isHurt(g, gd); }

/** the most a teammate's legs may be asked for this frame (guards.ts teamPace, for a man teamPaced has): PACE.max with the switch off. Asking changes nothing */
export function teamCap(g: Game, gd: Guard): number {
  if (!TEAMPACE.on || BREAK) return PACE.max;
  if (fragRunning(g, gd)) return blastRun(g, gd) ? Math.max(PACE.max, g.tune.playerSprint) : PACE.max;
  const L = live(g, gd), cap = Math.max(teamWalk(g), L ? L.top : 0);
  return cap < PACE.max && fighting(g, gd) ? PACE.max : cap;
}
/** the reason he may be running for this frame, if any */
function runWhy(g: Game, gd: Guard): RunWhy | null { if (fragRunning(g, gd)) return blastRun(g, gd) ? 'blast' : null; const L = live(g, gd); return L && isRun(L.why) ? L.why : null; }
/** ONCE A FRAME A MAN, after his legs have moved (squad.ts): a run under a reason is written down — once a run, and its seconds */
export function teamRan(g: Game, gd: Guard): void {
  if (!teamSlow(g, gd)) return;
  if (TEAMPACE.backSecs > 0 && fragRunning(g, gd)) teamLeave(g, gd, 'fight', PACE.max, TEAMPACE.backSecs);   // (the way back to his place: a door order counts the seconds its men are off it)
  const why = runWhy(g, gd); if (!why) return;
  reasonT.set(gd, g.time);
  if (gd.speed < TEAMPACE.runAt) return;
  const was = ran.get(gd), t = g.time;
  if (!was || t - was.t > TEAMPACE.gap) { TEAMPACE_STATS[why]++; TEAMPACE_DEBUG.log?.(`${t.toFixed(2)} ${gd.callsign} runs: ${why} (${gd.speed.toFixed(1)} m/s)`); }
  else if (t > was.t) TEAMPACE_STATS.secs += t - was.t;
  ran.set(gd, { t, why });
}
/** seconds since he last had a reason to run (Infinity: never, or the rule is off) — a check that holds the team to its pace asks it of a man going faster */
export function teamRunAgo(g: Game, gd: Guard): number { const t = reasonT.get(gd); return t === undefined || t > g.time ? Infinity : g.time - t; }
/** × his card for a leg asked at `speed` (guards.ts teamLegs): at a run a card weighs as it does on the player's sprint — part of it. Null = as it was */
export function teamRunLegs(g: Game, gd: Guard, speed: number): number | null {
  if (speed < TEAMPACE.runAt || !teamSlow(g, gd)) return null;
  return speed * (1 + (loadPaceOn(g, gd) - 1) * KITLOAD.sprint);
}
/** how fast his legs pick pace up (guards.ts teamLean): a man with a reason to run gets to it as a runner does — PACE.accel otherwise */
export function teamAccel(g: Game, gd: Guard): number {
  if (!TEAMPACE.on || BREAK) return PACE.accel;
  return runWhy(g, gd) ? Math.max(PACE.accel, TEAMPACE.accel) : PACE.accel;
}
/** he is at a run this frame: gun low, nothing fired, a sprinter's boots */
export function teamSprinting(g: Game, gd: Guard): boolean { return gd.speed >= TEAMPACE.runAt && teamSlow(g, gd); }
/** A TEAMMATE'S FOOTFALL, the level one step is heard at (guards.ts, squad.ts, pressure.ts — `base`: the caller's own walking level): a run's 0.8 over the
 *  walk-or-run line his card draws, the silent squad's step or `base` under it, × what his card rattles — and at a run under the rule, a sprinter's */
export function teamTread(g: Game, gd: Guard, speed: number, base: number): number {
  return (speed >= TEAMPACE.runAt && teamSlow(g, gd) ? TEAMPACE.step : loadGait(g, gd, speed) > 2 ? 0.8 : silentStep(g, gd) ?? base) * loadHeard(g, gd);
}

/** fall in's pace for a man `d` off his place, the player doing `samV` (orders.ts). Null = the switch is off or the rule has not this man: as it was */
export function teamFollow(g: Game, gd: Guard, samV: number, d: number, gain: number): number | null {
  if (!teamSlow(g, gd)) return null;
  const T = TEAMPACE, walk = teamWalk(g), want = samV + gain * (d - 0.3), sprint = g.tune.playerSprint;
  if (T.follow && g.player.sprinting && !g.fight.busy(gd, 0.5)) {
    const L = live(g, gd), running = !!L && L.why === 'follow';
    if ((running || d > T.behindM) && teamLeave(g, gd, 'follow', sprint)) return Math.max(walk, Math.min(sprint, want));   // (once running he runs until the player stops: in his place he does the player's own pace)
  }
  const top = Math.max(walk, g.tune.playerWalk * T.followK);
  if (top > walk) teamLeave(g, gd, 'close', top);
  return Math.max(walk, Math.min(top, want));
}
/** a move the fight asks of him — the leg through an ordered door, a step the room fight orders, the breach drill — keeps the pace it had, for `secs` more
 *  than this frame */
export function teamFight(g: Game, gd: Guard, secs = 0): void { if (TEAMPACE.on) teamLeave(g, gd, 'fight', PACE.max, secs); }
/** A RUN TO COVER, the question itself: loud has reached him in the last `dashHot` seconds, he has nobody in his sights (a man who has fights), the floor he
 *  is on is in a known man's line, his mark `to` (`d` off, in plain sight on the same floor; `least`: the shortest leg worth it) is out of it. `running` =
 *  asked of a man already on the leg: what STARTED him — the loud, the line on the floor under him — is not asked again (a leg begun is run out: the floor
 *  he crosses leaves the line before he is behind anything); what would stop any man still is — a man in his sights, a mark the line has found, a wall */
export function teamDashNow(g: Game, gd: Guard, to: Vec3, d: number, least = TEAMPACE.dashM, running = false): boolean {
  const T = TEAMPACE; if (!T.own || !teamSlow(g, gd)) return false;
  const p = gd.char.pos;
  return d >= least && (running || g.time - g.fight.hotOf(gd) < T.dashHot) && !g.fight.engaged(gd) && !quiet(g, gd) && !isHurt(g, gd)
    && g.fight.roomAt(p) === g.fight.roomAt(to) && !g.col.solidBlocked([p[0], 0.45, p[2]], [to[0], 0.45, to[2]])
    && (running || exposedAt(g, gd, p) >= T.dashSeen) && exposedAt(g, gd, to) <= 0;
}
/** … and the pace to run the leg at, or null (orders.ts, of a man walking to the mark an order gave him): asked every `dashEvery` seconds a man and whenever
 *  his mark has moved, kept between; once running he runs the leg out */
export function teamDash(g: Game, gd: Guard, to: Vec3, d: number): number | null {
  const T = TEAMPACE; if (!T.own || !teamSlow(g, gd)) return null;
  const t = g.time, run = g.tune.playerSprint, old = dash.get(gd), was = old && t >= old.t && t - old.t < T.dashEvery * 2 ? old : undefined;   // (an answer two asks old is a leg he LEFT — sent elsewhere, fallen in — not one he is on: asked again later of a mark by the old one, he is asked afresh)
  const same = !!was && Math.hypot(was.x - to[0], was.z - to[2]) < 0.5;
  let yes: boolean;
  if (was && same && t - was.t < T.dashEvery) yes = was.yes && d > 0.6;
  else { const on = !!was && same && was.yes; yes = teamDashNow(g, gd, to, d, on ? 0.6 : T.dashM, on); dash.set(gd, { t, x: to[0], z: to[2], yes }); }
  return yes && teamLeave(g, gd, 'cover', run) ? run : null;
}
/** A RUN THE MISSION TELLS HIM TO MAKE (orders.ts, of a man walking to the mark an order gave him; rails.ts runs: a tutorial step's `onWay.run` — the way
 *  back to the trucks once the job is done): the pace to run the leg at, or null. One more reason, under the same leave as the others: `own` off, a quiet
 *  man and a hurt one still walk — and, as on a run to cover, a man with somebody in his sights does not turn his back and run with his gun low: he
 *  fights at the fight's pace until it is over. The caller asks only outside the last metres of the leg (orders.ts ORDERS.briskIn): they are walked in */
export function teamTold(g: Game, gd: Guard): number | null {
  if (!g.rails?.runs(gd) || !teamSlow(g, gd) || g.fight.engaged(gd)) return null;
  const run = g.tune.playerSprint; return teamLeave(g, gd, 'told', run) ? run : null;
}
/** the pace a teammate leaves a grenade at (frag.ts, squadthrow.ts — what teamCap gives a man fragRunning): the flee's own with the rule on and a run
 *  allowed him, the old cap without */
export function teamBlastPace(g: Game, gd: Guard, run: number): number {
  return gd.team === 'operative' && PACE.on ? (TEAMPACE.on && !BREAK && blastRun(g, gd) ? run : Math.min(run, PACE.max)) : run;
}
