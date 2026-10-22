// A MAN FLINCHES WHEN FIRE COMES CLOSE (the maintainer, from play: 'we should have some flinching when there's fire near a character' — 'maybe also
// proportional to training too' — 'so very inexperienced characters get freaked out by gunfire and may even run away').
//   · THE FLINCH, FOR ANYBODY: every round of a side hostile to him that passes or strikes close to a living character — a defender, a man of the night staff,
//     a civilian, a teammate, the player's own man — ducks him off it (character.ts flinchFrom: head down and turned away from where it came from, trunk folded
//     over the gun, knees soft; both hands stay on the weapon). It is fed where the round exists (suppression.ts noteRound, the same closest-approach and
//     strike distances that feed the suppression scalar, before anybody's temperament or cover is weighed): under `least` nothing, from there up to `full` the
//     duck grows from `far` of itself to all of it. A burst is one duck, and a round on his way back up puts him straight back down (the animator's own rule).
//   · BY TRAINING: the animator already makes it big and slow for an untrained body and a dip of the head for a drilled one (CharacterAnimator.trained: the
//     player and his teammates are drilled, the response team nearly). Among the defenders and the night staff a STEADY man (morale.ts trainingOf) shows
//     `steadyK` of what a GREEN man shows. So: a green man folds, a steady one ducks, an operator dips his head.
//   · IT IS THE PICTURE: nothing here touches anybody's aim, spread, cadence, reaction clock or health. What the body does it does to the man's own eye and
//     muzzle, as every pose does (one model for the picture and the AI): a head ducked a hand's breadth for half a second.
//   · WHAT IT LEAVES ALONE: the suppression model's own start on the rising edge over its flinch line (the bark, the late round) is as it was. A choreographed
//     man flinches only where his script says so (GuardScript.flinch: the tutorial's men behind the trucks ask for it, and get this same duck round by round);
//     a show on the floor and the utility stages get nothing; a man in somebody's arm, a fled man, a body: nothing. A round of his own side going past him:
//     nothing (`friendly` would have it).
//   · THE VERY GREEN MAY RUN (`run`, and only where the nerve rule and the runner are on: morale.ts, runner.ts): a GREEN defender or night-staff man kept
//     under close hostile fire — the suppression scalar over its flinch line — for `breakSecs` in all (the count eases back at `easeK` of a second a second
//     while the fire is off him) who is ALONE (morale.ts hasMate: no living man of his side near him in his view) breaks: runner.ts's own sequence, started
//     through its seam (runnerBreak) — he shouts it, holds low a beat, the weapon leaves his hand and he runs for his mates or out of the building. With a mate
//     at his shoulder he stays, flinching. A steady man never does: he ducks and, pinned long enough, shifts to cover, as he did. Never a civilian, an
//     operative, the player, the response team, a rescue's cast, a choreographed man (that file's own list).
// By behaviour, never by hit points; nothing is drawn or written for the player but the man himself. No die, no wall clock: the one clock is game seconds
// counted, and rides a checkpoint. The switch is off in the module and on the frozen stand: with it off both seams return on their first line and no man
// has a record here. Type-only game imports but for the functions below, used inside calls only (src/game is one import cycle).
import { SideMap } from '../math/side';
import type { Game, Guard } from './game';
import type { Character } from './character';
import { Vec3, v3, clamp, lerp } from '../math/vec';
import { SUPPRESSION } from './suppression';
import { MORALE, trainingOf, hasMate } from './morale';
import { RUNNER, runnerBreak, runnerOwns } from './runner';
import { isHostile, teamOfId } from './teams';
import { PLAYER_ID } from './consts';

/** the switch and its numbers: off in the module, raised by the page (host/profile.ts pageSwitches; ?flinch=0 = nobody ducks at a round but on the suppression
 *  model's own edge, as it was). `least` / `full`: what a round must weigh (suppression.ts: wNear by how near it passed + wHit by how near it struck) to duck a
 *  man at all, and to duck him all the way — between them from `far` of the duck up to the whole; `steadyK` × for a steady defender; `friendly`: a round of
 *  his own side ducks him too. `run` (off in the module like the switch itself, raised by the page; ?flinchrun=0): a green man alone under close fire for `breakSecs` s drops it and runs; `easeK`: s of that count that
 *  drain a second while no fire is on him; `askSecs`: how often a man over the count who has a mate by him is asked again. UNTUNED: every number is a first number. */
export const FLINCH = { on: false, least: 0.06, full: 0.35, far: 0.45, steadyK: 0.65, friendly: false, run: false, breakSecs: 2.5, easeK: 0.5, askSecs: 0.25 };
/** QA: since the last reset — ducks given (a round on a man already down counts: it keeps him there) · green men who broke and ran under fire · `last`: set to
 *  an array and every duck files the character id it was given to */
export const FLINCH_STATS: { ducks: number; broke: number; last: number[] | null } = { ducks: 0, broke: 0, last: null };

/** a green man's seconds under close fire (only men who have some) */
const stateOf = new SideMap<Guard, { under: number }>('flinch.stateOf');

const staff = (gd: Guard) => !gd.civ && (gd.team === 'hostile' || gd.team === 'guard');
/** a man of the room fight's on its own walk carries a script that is not choreography (runner.ts reacts) */
const fightMan = (g: Game, gd: Guard) => !!g.fight?.defs.some(D => D.gd === gd);

/** ONE ROUND WENT CLOSE TO `c` (suppression.ts noteRound, for every living, free character it weighed anything on): `near` = what it weighs before his
 *  temperament, his cover or whose it was are counted; `from` = the muzzle it left; `hostile` = it was a round of a side hostile to his. `gd` = the man, null
 *  for the player. */
export function flinchRound(g: Game, c: Character, gd: Guard | null, near: number, from: Vec3, hostile: boolean): void {
  const K = FLINCH; if (!K.on || near < K.least || (!hostile && !K.friendly) || g.quietUtility) return;
  if (gd) { if (gd.state === 'dead' || runnerOwns(gd) || !free(g, gd)) return; }
  else if (g.touring || g.player.down) return;
  const k = lerp(K.far, 1, clamp((near - K.least) / Math.max(1e-6, K.full - K.least), 0, 1)) * flinchScale(g, gd);
  c.anim.flinchFrom(v3.sub(from, c.pos), k); FLINCH_STATS.ducks++; if (FLINCH_STATS.last) FLINCH_STATS.last.push(c.id);
}
/** is his body his own to duck with: a show on the floor ducks only the men its script says; off a show, a man with no script, a man whose script is his
 *  everyday body (a teammate's orders, a civilian's errand, the room fight's walk), or a choreographed man whose script asks — never one whose script says no */
function free(g: Game, gd: Guard): boolean {
  const sc = gd.script; if (g.touring) return !!sc?.flinch;
  if (!sc || sc.flinch === true) return true;
  return sc.flinch !== false && (gd.team === 'operative' || !!gd.civ || fightMan(g, gd));
}
/** HOW MUCH OF THE DUCK HIS TRAINING LEAVES HIM (× the animator's own share by his body's drill): a steady defender or night-staff man `steadyK`, anybody
 *  else 1 — and 1 for everybody with the rule off. suppression.ts hands it to its own start on the flinch line, so the two ducks are one size on one man. */
export function flinchScale(g: Game, gd: Guard | null): number {
  return FLINCH.on && gd && staff(gd) && !gd.trained && trainingOf(g, gd) === 'steady' ? FLINCH.steadyK : 1;
}

/** is he a man the run is asked of at all: a living green defender or night-staff man, free, not already fled */
function green(g: Game, gd: Guard): boolean {
  return gd.state !== 'dead' && staff(gd) && !gd.held && !gd.trained && !runnerOwns(gd) && trainingOf(g, gd) === 'green';
}
/** ONCE A FRAME (game.ts update, after the suppression scalar has decayed and before the runner's own tick): each green man's seconds under close hostile
 *  fire counted up or eased back, and the man over the count who is alone handed to the runner. */
export function flinchTick(g: Game, dt: number): void {
  const K = FLINCH;
  if (!K.on || !K.run || !RUNNER.on || !MORALE.on || !g.tune.suppression || !g.aiEnabled || g.touring || g.quietUtility) return;
  const S = SUPPRESSION;
  for (const gd of g.guards) {
    const had = stateOf.get(gd);
    if (!green(g, gd)) { if (had) stateOf.delete(gd); continue; }
    const sup = gd.sup, theirs = sup.srcId === PLAYER_ID ? isHostile(gd.team, 'player') : sup.srcId >= 0 && isHostile(gd.team, teamOfId(g, sup.srcId));
    if (!(sup.v >= S.flinch && theirs && g.time - sup.srcT < S.srcMemorySecs)) {
      if (had) { had.under -= dt * K.easeK; if (had.under <= 0) stateOf.delete(gd); }
      continue;
    }
    const T = had ?? { under: 0 }; if (!had) stateOf.set(gd, T);
    T.under += dt; if (T.under < K.breakSecs) continue;
    if (!hasMate(g, gd) && runnerBreak(g, gd)) { FLINCH_STATS.broke++; stateOf.delete(gd); }
    else T.under = K.breakSecs - K.askSecs;   // (a mate by him, or the runner will not have him this frame: asked again shortly — he does not bolt the instant the mate falls unless the fire is still on him then)
  }
}
/** QA: a man's seconds under close fire (0 = none on record) */
export function flinchUnder(gd: Guard): number { return stateOf.get(gd)?.under ?? 0; }

// ---------------------------------------------------------------- checkpoints (game/savestate.ts): each roster man's count by roster index
export interface FlinchSnap { men: (number | null)[] }
/** nothing (no key in the file) while no man has a count */
export function flinchSnapshot(g: Game): FlinchSnap | undefined {
  const men = g.guards.map(gd => stateOf.get(gd)?.under ?? null);
  return men.some(m => m !== null) ? { men } : undefined;
}
/** …onto the fresh roster (a file without the slice: nobody has one) */
export function flinchRestore(g: Game, s: FlinchSnap | null | undefined) {
  g.guards.forEach((gd, i) => { const u = s?.men?.[i];
    if (typeof u === 'number' && Number.isFinite(u) && u > 0) stateOf.set(gd, { under: u }); else stateOf.delete(gd); });
}
