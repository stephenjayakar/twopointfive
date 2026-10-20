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
//   AN ENTRY     the leg through an ordered door (ORDERS.entry) is `entryK` × the player's walk.
//   A REASON     on his own (`own`) a teammate runs for one of three things, each written down as it is taken (TEAMPACE_STATS, TEAMPACE_DEBUG.log):
//                  blast   he is running from a live grenade (frag.ts fragRunning) — at the pace the flee asks, as anybody's legs;
//                  lane    he is stood in the opening of a doorway with a fight on and steps off it (roomfight.ts doorway) — at the pace that step asks;
//                  cover   loud has just reached him, he has no man in his sights, the floor he is on is in the line of a man he knows of, his mark is out of it and in plain sight across
//                          `dashM` or more of the same floor: he runs the leg (teamDash) — never round a corner, never through a doorway.
//                Never the silent squad, a squad nobody has found, a man sneaking with the player (blast apart: nobody walks off a grenade), never a hurt man.
//   THE COST     a teammate at a run (`runAt`, the sprint clip's own threshold) carries his gun low and fires nothing (teamSprinting: squad.ts, roomfight.ts),
//                and his boots are a sprinter's (`step`: the player's own level) to whoever hears them.
//
// Off = the build as it was: every function here answers on its first line.
import type { Game, Guard } from './game';
import type { Vec3 } from '../math/vec';
import { SideMap } from '../math/side';
import { PACE, teamPaced } from './guards';
import { fragRunning } from './frag';
import { sneaking } from './sneak';
import { unseenMan } from './unseen';
import { silentMan } from './silent';
import { isHurt } from './condition';
import { exposedAt } from './picture';
import { loadPaceOn, KITLOAD } from './kitload';

export const TEAMPACE = {
  on: false,
  /** a teammate's walk, × the player's (tune.playerWalk) */
  k: 0.8,
  /** a follower off his place closes at up to this × the player's walk */
  followK: 1,
  /** the leg through an ordered door, × the player's walk */
  entryK: 0.8,
  /** followers run while the player sprints; `behindM`: how far off his place a man starts to */
  follow: true, behindM: 1.0,
  /** on their own: a run for a reason (blast, lane, cover) */
  own: true,
  /** a run to cover: the least leg worth running (m), how exposed the floor he stands on must be (picture.ts exposedAt), how often it is asked (s) */
  dashM: 2.5, dashSeen: 0.5, dashEvery: 0.25,
  /** … and how lately a shot, a charge or a boot must have reached his ears (s) */
  dashHot: 6,
  /** m/s from which a teammate is running: the gun goes low, nothing is fired, the boots are a sprinter's (character.ts BLEND.jogAt) */
  runAt: 2.7,
  /** … and a pace over this under a reason is counted as a run (a footfall's own walk-or-run line: kitload.ts loadGait) */
  countAt: 2.0,
  /** m/s² a man with leave to run picks pace up at (guards.ts PACE.accel is 2.6: a walker leaning into a walk) */
  accel: 6,
  /** a sprinting teammate's footfall (the player's own sprint is 1) */
  step: 1,
  /** two runs of one man this close together are one (s) */
  gap: 1,
};
export type RunWhy = 'follow' | 'blast' | 'lane' | 'cover';
/** runs taken, by reason, and the seconds spent at them (read by the checks and the tallies; nothing in the game reads it) */
export const TEAMPACE_STATS = { follow: 0, blast: 0, lane: 0, cover: 0, secs: 0 };
export const TEAMPACE_DEBUG: { log?: (s: string) => void } = {};
const BREAK = (() => { try { return String((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.TEAMPACE_BREAK ?? '') === '1'; } catch { return false; } })();

/** what a man has leave for: `why` ('close' a follower closing on his place, 'entry' through the ordered door — neither is a run), the most his legs may be
 *  asked for while it lasts, when it ends, when he last ran under it, and when a run to cover was last asked about */
type Leave = { why: RunWhy | 'close' | 'entry'; top: number; until: number; ranT: number; askT: number; dash: boolean };
const leave = new SideMap<Guard, Leave>('teampace.leave');
const FRAME = 2 / 60;

/** this teammate's pace is the rule's this frame */
export function teamSlow(g: Game, gd: Guard): boolean { return TEAMPACE.on && !BREAK && teamPaced(g, gd); }
/** a teammate's walk, m/s */
export function teamWalk(g: Game): number { return g.tune.playerWalk * TEAMPACE.k; }
/** he is one of the quiet: no run of his own, none behind the player */
function quiet(g: Game, gd: Guard): boolean { return sneaking(g, gd) || unseenMan(g, gd) || silentMan(g, gd); }

/** leave to go faster than the walk for `secs` (this frame and the next: 0). False = none (the switch off, a man the rule has not, a quiet or a hurt man) */
export function teamLeave(g: Game, gd: Guard, why: Leave['why'], top: number, secs = 0): boolean {
  if (!teamSlow(g, gd)) return false;
  if (why !== 'close' && why !== 'entry') { if (why === 'follow' ? !TEAMPACE.follow : !TEAMPACE.own) return false; if ((why !== 'blast' && quiet(g, gd)) || isHurt(g, gd)) return false; }
  const was = leave.get(gd), until = g.time + secs + FRAME;
  if (was && g.time <= was.until && was.until > until && was.top >= top) return true;   // (a longer leave for more pace stands: a follower's frame of closing does not end his step off a doorway)
  leave.set(gd, { why, top, until, ranT: was?.ranT ?? -1e9, askT: was?.askT ?? -1e9, dash: was?.dash ?? false });
  return true;
}
function live(g: Game, gd: Guard): Leave | null { const L = leave.get(gd); return L && g.time <= L.until ? L : null; }

/** the most a teammate's legs may be asked for this frame (guards.ts teamPace, for a man teamPaced has): PACE.max with the switch off */
export function teamCap(g: Game, gd: Guard): number {
  if (!TEAMPACE.on || BREAK) return PACE.max;
  if (TEAMPACE.own && fragRunning(g, gd)) teamLeave(g, gd, 'blast', g.tune.playerSprint);
  const L = live(g, gd), cap = Math.max(teamWalk(g), L ? L.top : 0);
  if (L && L.why !== 'close' && L.why !== 'entry' && gd.speed > TEAMPACE.countAt) {   // he is running under it: written down once a run
    const t = g.time;
    if (t - L.ranT > TEAMPACE.gap) { TEAMPACE_STATS[L.why]++; TEAMPACE_DEBUG.log?.(`${t.toFixed(2)} ${gd.callsign} runs: ${L.why} (${gd.speed.toFixed(1)} m/s)`); }
    else if (t > L.ranT) TEAMPACE_STATS.secs += t - L.ranT;
    leave.set(gd, { ...L, ranT: t });
  }
  return cap;
}
/** × his card for a leg asked at `speed` (guards.ts teamLegs): at a run a card weighs as it does on the player's sprint — part of it. Null = as it was */
export function teamRunLegs(g: Game, gd: Guard, speed: number): number | null {
  if (!TEAMPACE.on || BREAK || speed < TEAMPACE.runAt || !teamPaced(g, gd)) return null;
  return speed * (1 + (loadPaceOn(g, gd) - 1) * KITLOAD.sprint);
}
/** how fast his legs pick pace up (guards.ts teamLean): a man with leave to run gets to it as a runner does — PACE.accel otherwise */
export function teamAccel(g: Game, gd: Guard): number {
  if (!TEAMPACE.on || BREAK) return PACE.accel;
  const L = live(g, gd); return L && L.why !== 'close' && L.why !== 'entry' ? Math.max(PACE.accel, TEAMPACE.accel) : PACE.accel;
}
/** he is at a run this frame: gun low, nothing fired, a sprinter's boots */
export function teamSprinting(g: Game, gd: Guard): boolean { return TEAMPACE.on && !BREAK && gd.speed >= TEAMPACE.runAt && teamPaced(g, gd); }
/** his footfall's level at this pace — null: as it was */
export function teamStep(g: Game, gd: Guard, moveSpeed: number): number | null { return TEAMPACE.on && !BREAK && moveSpeed >= TEAMPACE.runAt && teamPaced(g, gd) ? TEAMPACE.step : null; }

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
/** the leg through an ordered door: its leave (orders.ts, a leg with a pace of its own) */
export function teamEntry(g: Game, gd: Guard): void { const top = g.tune.playerWalk * TEAMPACE.entryK; if (TEAMPACE.on && top > teamWalk(g)) teamLeave(g, gd, 'entry', top); }
/** A RUN TO COVER, the question itself: loud has reached him in the last `dashHot` seconds, he has nobody in his sights (a man who has fights), the floor he
 *  is on is in a known man's line, his mark `to` (`d` off, in plain sight on the same floor; `least`: the shortest leg worth it) is out of it */
export function teamDashNow(g: Game, gd: Guard, to: Vec3, d: number, least = TEAMPACE.dashM): boolean {
  const T = TEAMPACE; if (!T.own || !teamSlow(g, gd)) return false;
  const p = gd.char.pos;
  return d >= least && g.time - g.fight.hotOf(gd) < T.dashHot && !g.fight.engaged(gd) && !quiet(g, gd) && !isHurt(g, gd)
    && g.fight.roomAt(p) === g.fight.roomAt(to) && !g.col.solidBlocked([p[0], 0.45, p[2]], [to[0], 0.45, to[2]])
    && exposedAt(g, gd, p) >= T.dashSeen && exposedAt(g, gd, to) <= 0;
}
/** … and the pace to run the leg at, or null (orders.ts, of a man walking to his mark or his place): asked every `dashEvery` seconds a man, kept between;
 *  once running he runs the leg out */
export function teamDash(g: Game, gd: Guard, to: Vec3, d: number): number | null {
  const T = TEAMPACE; if (!T.own || !teamSlow(g, gd)) return null;
  const was = leave.get(gd), t = g.time, run = g.tune.playerSprint;
  if (was && t - was.askT < T.dashEvery) return was.dash && d > 0.6 && teamLeave(g, gd, 'cover', run) ? run : null;
  const yes = teamDashNow(g, gd, to, d, was?.dash ? 0.6 : T.dashM);
  leave.set(gd, { why: was?.why ?? 'cover', top: was?.top ?? 0, until: was?.until ?? -1e9, ranT: was?.ranT ?? -1e9, askT: t, dash: yes });
  return yes && teamLeave(g, gd, 'cover', run) ? run : null;
}
/** the pace a teammate runs from a blast at (frag.ts, squadthrow.ts): the flee's own with the rule on, the old cap without */
export function teamBlastPace(g: Game, gd: Guard, run: number): number {
  return gd.team === 'operative' && PACE.on ? (TEAMPACE.on && !BREAK && TEAMPACE.own && !isHurt(g, gd) ? run : Math.min(run, PACE.max)) : run;
}
