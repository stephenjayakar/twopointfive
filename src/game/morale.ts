// SHAKEN — THE FIRST SLICE OF THE ENEMY'S MORALE (the maintainer, 10-13, a Mousehole room clear on hard, alone: "we could model something like morale or
// psychological state or fear … when a guy is by himself in the dark and i blow open the door to his room with HE, he's probably not in a good place" — and
// "a lot of the value from this comes with good telegraphing": he SAYS it, then he DOES it, with a beat the player can act on).
//
// The man in that replay said "they've blown the wall!", turned eleven degrees and stood upright on the same spot, silent, for twenty seconds.
//   · ONE NUMBER A MAN, `dread` 0‥1 = shock + standing, read as three RUNGS with hysteresis: 0 steady · 1 jumpy · 2 broken. Behaviour keys off the rung alone.
//     FEEDS ADD TO DREAD, RUNGS DRIVE BEHAVIOUR: later slices bring more feeds (a radio check nobody answers, a body found, the lights dying) and touch nothing
//     below the rungs.
//   · SHOCK is what events add, up to `shockCap`; it halves every `halfLife` seconds. This slice's one feed is a BLAST (moraleBlast: frag.ts blast — a frag,
//     the 40 mm —, the door charge, the wall charge): every living hostile man inside `blastM` of it with a line to where it went off once it has gone (asked
//     the frame AFTER: the leaf it tore off still stands in its frame on the blast's own), or inside `nearM` whatever stands between, takes `blast` — all of it
//     inside `nearM`, down to `farK` of it at `blastM`. Never a civilian, an operative or the player; never a man of the side whose grenade it was; never a
//     choreographed man; never a man of the hostage rescue's cast (rescue.ts: any of them may be the one holding its clock).
//   · STANDING is where he is, read `askSecs` apart (each man on his own frames): + `alone` with no living mate inside `aloneM` IN HIS VIEW (a mate through a
//     wall is no company), + `dark` blind-dark where he stands (inTheDark: the place's steady light, his own lamp left out, under the meter's floor; `litAsks`
//     readings running must say lit before the dark is taken off him).
//   · BROKEN is for a man ALONE IN THE DARK only, however much shock he carries (mayBreak — the one predicate a later slice opens other routes through).
//   So: a blast makes a man jumpy; a blast on a man alone in the dark breaks him; alone in the light, or in the dark with a mate at his shoulder, jumpy.
//   · JUMPY, on a blast: he DUCKS — crouched, gun down, turned to it — through any stagger of the blast's own and `duckSecs` past it; the nearest of the men
//     who duck shouts it as they go down. Then the man he was.
//   · BROKEN, on a blast: a short sequence of his own and then a hold, by seconds counted from the END of the blast's own stagger (the blast's owners root a
//     man they folded, gun down, no round — frag.ts, doortools.ts — and nothing here moves him or fires for him before that is over) —
//       down    through the stagger and `downSecs` more: he goes down where he stands, folded;
//       back    to `backUntil`: the cracked call on the net that nobody answers, THEN he scrabbles backward off the hole, low, facing it, at `backSpeed`, up to
//               `backM` and no further than the wall or the furniture behind him;
//       burst   `burstRounds` real rounds into the dust at the hole, `spread` wide, at the place and not at anybody;
//       hold    he stays down where he stopped with his gun on the hole for as long as he is broken — and, still alone, calls again `call2Secs` on.
//     THE BAIT: holding, the first thing to cross the hole (an enemy in his sight inside `baitM` of it, or a thrown thing flying or landing there in his view)
//     gets THE REST OF HIS MAGAZINE at the hole — the gun is then really empty, by the weapon's own count — then the shout that he is out and the guards' own
//     magazine change, stretched to `reloadSecs`; a second thrown thing gets `baitShort` rounds; a third a word and no round.
//   · A REAL SIGHTING ENDS IT, for good: an enemy plainly in his eyes anywhere but at the hole — or anywhere at all once the long burst is spent — and he is
//     the fight's man again (roomfight.ts / guards.ts); he does not turn back to the hole. Nothing here touches health, aim, skill or a reaction beat: his
//     reactT runs on under the duck as under a head-down.
//   · WHO DRIVES HIM: while a sequence has him (`moraleOwns`) guards.ts runs this file's GuardScript for the frame the way it runs frag.ts's flee — his own
//     script, state and fix stand exactly as they were — and the room fight's defender tick yields. His ears are kept open (hearingCheck), his gun is out, and
//     a frame on which the floor's own rules would take him to 'alert' is left to them: he calls his CONTACT and raises what any man at that awareness raises.
// TRAINING (the maintainer, 10-13: "more poorly trained ones could get really scared"; "harder settings have better trained guys … higher morale"): every man
// is GREEN or STEADY (trainingOf — by the `training` knob, then the squad's own key in the level, then the difficulty: MORALE_AT), and it moves two things only,
// where his rungs sit and how he copes:
//   · a STEADY man is the man above in WHEN he breaks (alone and in the dark, at `broken`), and copes trained: down to a crouch, not folded; back off the hole
//     facing it; a flat call on the net; NO burst into the dust; then low on the hole — and a bait draws `baitShort` rounds, never the magazine: he is never dry.
//   · a GREEN man breaks ALONE, lit or dark, and at `greenBroken`; his sequence is the one above as written. Among his mates he ducks like any man — but for
//     the ONE man of a squad its leader's fall has marked (below).
//   · THE LEADER (leaderOf: the first man of his squad — on a floor with no squads, of the men staged in his room — where that man is steady). Killed —
//     combat.ts killGuard → moraleManDown — every green man of his has the standing term `leaderDown` from then on, and the ones with the fall in their eyes
//     `leaderShock` on top (sawLeaderFall: seconds since) and a FLINCH: down for `flinchSecs` facing where he fell, then up. The NEAREST of them says so,
//     spoken, on that frame — one line a squad a death — and is the one man of it a later blast may break with his mates about him; the rest duck and fight.
//   · A LEADER NEVER DUCKS, whatever the mix: fed by a blast he stands, his gun onto the hole, one side step off its line where the floor is free. With men of
//     his ducked inside `orderM` of him and a line between them he gives the order, spoken, `orderBeat` after any stagger; their duck ends `orderSecs` after
//     it (a breath apart, the nearest answering), not after its whole time. A steady man's duck is `steadyDuck`, short of a green man's `duckSecs`: the
//     trained are up first. That is the telegraph of who is who.
//   · NO BREAK IS FOR EVER: rung 2 is held only while more than `holdShock` of shock is on him, and a broken man's sequence lets him go `holdMax` seconds in.
//   · `nerve` (brittle / normal / steady) scales every shock a man takes by `nerveK` (steady: a lone green man in a LIT room is under his line to one blast —
//     on purpose, that is what steady nerve buys).
//   No health, aim, skill or reaction table is read or written by any of it. `training: 'none'` = no training at all, every man the first slice's (what a
//   recording from before the key replays with).
// SHOW, NOT TELL: nothing is drawn or written for the player but the man himself. One die (simRandom), no wall clock, no graphics setting; the clocks are seconds
// COUNTED and ride a checkpoint with the rest (moraleSnapshot / Restore).
// The switch is off in the module and on the frozen stand: every seam returns on its first line, no man is met, no die is drawn — the build as it was.
// Type-only game imports but for the functions below, used inside calls only (src/game is one import cycle).
import { SideMap } from '../math/side';
import type { Game, Guard, GuardScript } from './game';
import { TEMPERAMENT } from './game';
import { squadOf } from './enemysquads';
import { leversShown } from './difficulty';
import { PRESSURE } from './pressure';
import { DIGIN } from './digin';
import { DARKFOE, darkFoeBlind } from './darkfoe';
import type { Character } from './character';
import { Vec3, v3, clamp, lerp, wrapAngle } from '../math/vec';
import { simRandom } from '../math/dice';
import { canSee, canSeeChar, eyeContact, GUARD_EYE, sightGain, sightGainOn, hearingCheck, lightEstimateAt, tickReloadBeat } from './guards';
import type { Eye } from './guards';
import { fireWeapon } from './combat';
import { feedBegin } from './gunreload';
import { isHostile, teamOfId } from './teams';
import { w } from './words';

/** the switch and its numbers: off in the module, raised by the page (host/profile.ts pageSwitches; ?nomorale = every man as steady as he was) and by the shipped
 *  stand; the harness's frozen stand leaves it off (TPS_MORALE=1 turns it on). Dread is 0‥1: `jumpy` / `broken` are the rungs' lines, `hyst` how far under its
 *  line a rung holds. `blast` is a blast's shock inside `nearM`, × `farK` by `blastM`, `shockCap` the most shock a man carries; `alone` / `dark` the two standing
 *  terms. The rest are seconds, metres, metres a second and rounds, named as the head of the file names them; `barkSecs` = the least time between two of one
 *  man's lines from this file. `fanDeg` / `fanStep` / `straightM`: the scrabble's fan (backGoal). TRAINING: `training` = who is green — 'difficulty' (the
 *  squad's own key, else MORALE_AT), 'green' / 'mixed' / 'trained' for every squad, 'none' = the first slice's men; `greenBroken` = a green man's broken line;
 *  `leaderDown` his standing term with his leader down, `leaderShock` the shock of seeing it, `flinchSecs` the flinch; `shoutGap` how long the duck's shout waits on a line already in his mouth; `orderM` / `orderBeat` / `orderSecs` /
 *  `orderGap` / `standSecs` / `sideM` the leader's order (the head), `steadyDuck` a steady man's duck; `holdShock` / `holdMax` end a break (the head); `nerve` picks the row of `nerveK` every shock is scaled by. UNTUNED by eye (nobody has seen it on a GPU, nobody has played it). */
export const MORALE = { on: false, halfLife: 25, askSecs: 0.25, alone: 0.25, aloneM: 7, dark: 0.25, litAsks: 3, blast: 0.35, shockCap: 0.5, blastM: 10, nearM: 4, farK: 0.6, jumpy: 0.3, broken: 0.7, hyst: 0.15,
  duckSecs: 2.5, downSecs: 0.6, backUntil: 2.2, backM: 3.5, backSpeed: 2, burstRounds: 5, burstEvery: 0.2, spread: 0.3, call2Secs: 6,
  baitM: 2, baitShort: 5, baitEvery: 0.1, reloadSecs: 3.2, barkSecs: 2, fanDeg: 70, fanStep: 17.5, straightM: 1.5,
  training: 'difficulty' as Training, greenBroken: 0.5, leaderDown: 0.25, leaderShock: 0.3, flinchSecs: 0.8, shoutGap: 0.6, orderM: 4, orderBeat: 0.5, orderSecs: 1, orderGap: 0.15, standSecs: 2.5, sideM: 0.75, steadyDuck: 1, holdShock: 0.05, holdMax: 70,
  nerve: 'normal' as Nerve, nerveK: { brittle: 1.4, normal: 1, steady: 0.7 },
  /** how the dark is read (inTheDark): 'place' = where he STANDS; 'watch' = darkfoe.ts's reading of the floor he is WATCHING, where DARKFOE.on (held off: see inTheDark) */
  darkRead: 'place' as 'place' | 'watch' };
/** who is green (MORALE.training): by the squad's own key and the difficulty · every man green · a steady leader a squad and the rest green · every man steady ·
 *  'none' = no training, the first slice's men (never offered: what a recording from before the key is replayed with) */
export type Training = 'difficulty' | 'green' | 'mixed' | 'trained' | 'none';
export const TRAININGS: Training[] = ['difficulty', 'green', 'mixed', 'trained'];
export type Nerve = 'brittle' | 'normal' | 'steady';
export const NERVES: Nerve[] = ['brittle', 'normal', 'steady'];
/** a squad's mix where neither the knob nor the level says: by the enemy AI's rung (difficulty.ts leversShown — read off the defenders' own tables, so a
 *  recording replays it). 'mixed' = the squad's first man is its steady leader and the rest are green; 'hard' = every man steady but the LAST of a squad of
 *  three or more */
export const MORALE_AT: Record<string, 'mixed' | 'hard'> = { standard: 'mixed', hard: 'hard' };
/** the awareness at which the floor's own rules take a man to 'alert' (guards.ts updateGuard, the state transitions): a frame on which that is owed is theirs */
const ALERT_AW = 0.85;
export const MORALE_STATS = { blasts: 0, fed: 0, ducks: 0, broke: 0, rounds: 0, calls: 0, shouts: 0, baits: 0, reloads: 0, orders: 0, falls: 0, flinches: 0 };
/** every round this file has fired (the newest 96): whose, when, from where to where it was sent, and which burst's — what the check reads */
export const MORALE_LOG: { id: number; t: number; from: Vec3; at: Vec3; of: 'dust' | 'bait' }[] = [];

/** what a sequence has him doing: nothing · the jumpy duck · the broken man's down / back / burst / hold, and the bait's burst and magazine change out of the
 *  hold · the leader's stand · the flinch of a man who saw his leader fall */
export type MoraleAct = 'none' | 'duck' | 'down' | 'back' | 'burst' | 'hold' | 'bait' | 'reload' | 'stand' | 'flinch';
const ACTS: MoraleAct[] = ['none', 'duck', 'down', 'back', 'burst', 'hold', 'bait', 'reload', 'stand', 'flinch'];
/** per man. The feeds' half: `shock`, the two standing terms as last read (`lit` = readings running that said lit, `ask` = seconds since the last), his rung.
 *  The sequence's half: the act and its seconds `t`, the blast it answers (`hole`), where the scrabble ends (`goal`: null = his back is to something already),
 *  rounds left of the burst in hand and seconds to the next, calls made and seconds since the first, baits taken, whether something stood at the hole last
 *  frame, seconds since his last line, whether the duck's shout is his and still owed. `drive` = this file's script has him this frame (stamped `driveT`).
 *  Training's: `green` as last read (with the standing terms, and never inside a sequence: a man keeps the training he went into it with), `leaderDown` = he
 *  is green and his leader is down, `fall` = seconds since he SAW him go (-1: never), `lost` = he is the one man of his squad that fall may break among his
 *  mates (the nearest who saw it); `by` = the leader whose order his duck waits on, `heard` = seconds since that order (-1: not given; his own place in the
 *  line of men getting up is `next`); `said` = a leader's order is out — a ducked man's: the answer is his to give; `brokeT` = seconds in a broken sequence. */
interface Mind { shock: number; alone: boolean; dark: boolean; lit: number; ask: number; rung: 0 | 1 | 2; green: boolean; leaderDown: boolean; fall: number; lost: boolean; by: Guard | null; heard: number; said: boolean; brokeT: number;
  act: MoraleAct; t: number; hole: Vec3 | null; goal: Vec3 | null; rounds: number; next: number; calls: number; callT: number; baits: number; atHole: boolean; bark: number; shout: boolean;
  drive: boolean; driveT: number; script: GuardScript; }
const stateOf = new SideMap<Guard, Mind>('morale.stateOf');
/** a game's blasts not yet asked about (they are asked the frame after: see the head) */
interface Blast { at: Vec3; t: number; who: number }
const blastsOf = new SideMap<Game, Blast[]>('morale.blastsOf');

/** THE LINES (placeholders in the register of the defenders' own — the writing pass is the maintainer's). `say` = the lines that name nobody; `he` = the
 *  `dark` / `lit` = said only by a man who stands in the one or the other (a man in a lit room does not say he cannot see); `he` = the
 *  register every man had before the dialogue pass and the night staff still have (their intruder is one man); `they` = a scenario's defender as the pass has
 *  him, up against a team (words.ts). duck: shouted to his mates as he goes down. call / again: on the net, to nobody who answers. out: shouted as the
 *  magazine change after the long burst begins. spent: the third thing through the hole, and nothing left to throw at it. clear: the STEADY man's call, flat,
 *  on the net. lost: a green man with mates about him and his leader down, shouted. order: the leader to the green man on the floor beside him, spoken.
 *  okay: the green man's answer as he gets up. */
type LineKind = 'duck' | 'call' | 'again' | 'out' | 'spent' | 'clear' | 'lost' | 'order' | 'okay';
const LINES: Record<LineKind, { say: string[]; he?: string[]; they?: string[]; dark?: string[]; lit?: string[] }> = {
  duck: { say: ['down! get down!', 'get down — stay down!', 'heads down!'] },
  call: { say: [], dark: ['can\'t see a thing — somebody get in here!'], lit: ['right in my room — somebody get in here!'], he: ['he\'s coming in — I\'ve got nobody in here!', 'anyone on this net? he\'s right on top of me!'],
    they: ['they\'re coming in — I\'ve got nobody in here!', 'anyone on this net? they\'re right on top of me!'] },
  again: { say: ['is anybody there? answer me!', 'nobody\'s coming. nobody\'s coming—', 'please — somebody answer!'] },
  out: { say: ['I\'m out! I\'m out!', 'empty — I\'m empty!', 'I\'m dry! changing!'] },
  spent: { say: ['no — no, stay back!', 'keep away from me!', 'don\'t — don\'t come in!'] },
  clear: { say: ['breach on my room. I\'m alone in here.'], he: ['he\'s breached. I\'m on my own in here.', 'he\'s through. holding it on my own.'],
    they: ['they\'ve breached. I\'m on my own in here.', 'they\'re through. holding it on my own.'] },
  lost: { say: ['they got him! they got him!', 'he\'s down. oh no, he\'s down.', 'we\'ve lost him! what do we do?'] },
  order: { say: ['get up. watch that hole. breathe.', 'on your feet. eyes on that hole.', 'up. gun on the hole. breathe.'] },
  okay: { say: ['okay — okay.', 'yeah. yeah, I\'m up.', 'I\'m up. I\'m up.'] },
};
/** this file's lines — every kind's, or one kind's (the check: a line said came from the right pool; the words lint's bubble length and blocklist) */
export function moraleLines(kind?: LineKind): string[] { return (kind ? [LINES[kind]] : Object.values(LINES)).flatMap(l => [...l.say, ...(l.dark ?? []), ...(l.lit ?? []), ...(l.he ?? []), ...(l.they ?? [])]); }
/** one line of a kind from this man — on the net or shouted — unless he said one of this file's inside `barkSecs` (`force`: the call and the 'out' are the
 *  telegraph, never held back) */
function bark(g: Game, gd: Guard, S: Mind, kind: LineKind, radio: boolean, force = false): boolean {
  if (!force && S.bark < MORALE.barkSecs) return false;
  const L = LINES[kind], pool = [...L.say, ...((S.dark ? L.dark : L.lit) ?? []), ...((gd.team !== 'guard' ? w(L.they, L.he) : L.he) ?? [])];   // (words.ts: 'they' is a scenario's defender under the pass — off, every man's intruder is 'he', as it was)
  g.say(gd, pool[Math.floor(simRandom() * pool.length) % pool.length], radio); S.bark = 0;
  if (radio) MORALE_STATS.calls++; else MORALE_STATS.shouts++;
  return true;
}

const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const chestOf = (c: Character): Vec3 => c.bones.chest ?? [c.pos[0], c.pos[1] + 1.2, c.pos[2]];
const headOf = (c: Character): Vec3 => c.bones.head ?? [c.pos[0], c.pos[1] + 1.6, c.pos[2]];
/** a man this file is about at all: a living defender or a man of the night staff — never a civilian, an operative, a body */
const ours = (gd: Guard) => gd.state !== 'dead' && !gd.civ && (gd.team === 'hostile' || gd.team === 'guard');
/** a man of the hostage rescue's cast (rescue.ts): whoever of them holds its clock is that file's, gun on the hostage — none of them is this file's at all */
const rescued = (g: Game, gd: Guard) => !!g.rescue?.active && g.rescue.hostiles.includes(gd);
/** may a sequence have him this frame: the AI on, no show on the floor, free of Sam's arm, and nobody's choreography but a room fight's own walk */
function reacts(g: Game, gd: Guard): boolean {
  if (!g.aiEnabled || g.touring || g.quietUtility || gd.held) return false;
  return !gd.script || !!g.fight?.defs.some(D => D.gd === gd);
}
function mind(g: Game, gd: Guard): Mind {
  let S = stateOf.get(gd);
  if (!S) { S = { shock: 0, alone: false, dark: false, lit: 0, ask: (gd.char.id % 4) / 4 * MORALE.askSecs, rung: 0, green: false, leaderDown: false, fall: -1, lost: false, by: null, heard: -1, said: false, brokeT: 0, act: 'none', t: 0, hole: null, goal: null, rounds: 0, next: 0, calls: 0, callT: 0, baits: 0, atHole: false, bark: MORALE.barkSecs, shout: false,
      drive: false, driveT: -1, script: { goal: null } };
    stateOf.set(gd, S); stand(g, gd, S, true); }   // (first met: where he stands, as it reads now — the men's readings fall on different frames from here)
  return S;
}

/** IS HE BLIND-DARK WHERE HE STANDS — the one place this file reads light: the CPU's estimate of the place's STEADY light at his chest and head (guards.ts
 *  lightEstimateAt: no flash, tracer or stroke of lightning) with his own lamp left out, under the meter's floor (Game.tune.visFloor) = a man who cannot be made
 *  out, and cannot make much out. The same number on the page and in the harness, so a recording replays as it was played; it has no bounce in it (a room lit
 *  only round a corner reads darker here than on screen).
 *  THE OTHER READING, `darkRead: 'watch'` and DARKFOE.on: darkfoe.ts `darkFoeBlind(g, gd)` — is the floor he is WATCHING dark to him (the same estimate through the
 *  meter, his own lamp left out, three rays out to twelve metres). It is wired and HELD OFF, because it is another question: measured on the compound's hut
 *  (headless, the shipped stand), a man standing in no light at all whose door has just been blown off reads NOT dark by it from the next reading on — the lit
 *  yard is in view through the hole, 6 of 8 points — so his standing term goes, he is under his broken line a second in and the sequence lets him go: the very
 *  man this file was written for. And a lamp-lit room reads dark by it wherever under a third of the floor ahead of him is at the meter's 0.3. 'place' is the
 *  build as it was. */
export function inTheDark(g: Game, gd: Guard): boolean {
  if (MORALE.darkRead === 'watch' && DARKFOE.on) return darkFoeBlind(g, gd);
  const c = gd.char, id = c.id, own = (owner: number) => owner === id;
  return Math.max(lightEstimateAt(g, chestOf(c), own, true), lightEstimateAt(g, headOf(c), own, true)) < g.tune.visFloor;
}
/** has he company: a living man of his own side inside `aloneM` with nothing solid between his eyes and that man's chest */
function hasMate(g: Game, gd: Guard): boolean {
  const c = gd.char, eye = headOf(c);
  for (const o of g.guards) { if (o === gd || !ours(o) || o.team !== gd.team || o.held) continue;
    if (flat(o.char.pos, c.pos) <= MORALE.aloneM && !g.col.segmentBlocked(eye, chestOf(o.char))) return true; }
  return false;
}

// ---------------------------------------------------------------- training: who is green, who leads (no die anywhere: the roster's own order)
/** the men he is counted with, in their stable order: his squad's (enemysquads.ts); on a floor with no squads staged, the men the room clear staged in his
 *  room (roomclear.ts: a lone keeper is a band of one); null for a man of the night staff and a defender nobody staged in a room */
function bandOf(g: Game, gd: Guard): Guard[] | null {
  const Q = squadOf(g, gd); if (Q) return Q.men;
  return gd.team === 'hostile' ? g.roomClear?.rooms.find(r => r.defenders.includes(gd))?.defenders ?? null : null;
}
/** the difficulty's mix, read once a tick (difficulty.ts leversShown clones two tables to answer): the enemy AI's rung — where rows under it were moved by
 *  hand and it stands on none, the rung the press being on or off implies */
const mixAt = new SideMap<Game, { key: string; mix: 'mixed' | 'hard' }>('morale.mixAt');
function mixNow(g: Game): 'mixed' | 'hard' {
  const key = `${g.time}|${PRESSURE.on}|${DIGIN.on}`, had = mixAt.get(g); if (had && had.key === key) return had.mix;
  const mix = MORALE_AT[leversShown().ai ?? (PRESSURE.on ? 'hard' : 'standard')] ?? 'mixed'; mixAt.set(g, { key, mix });
  return mix;
}
/** IS HE GREEN OR STEADY. The response team and any `trained` man: steady, always. Then the knob (every man green · every man steady · 'mixed' for every squad);
 *  then the squad's own `training` key in the level; then the difficulty's mix (MORALE_AT). In a mix a man with no band — the night staff, a defender nobody
 *  staged in a room — is what his temperament says (game.ts TEMPERAMENT: the nervy ones are green), an unnamed one green on the roster's odd places. */
export function trainingOf(g: Game, gd: Guard): 'green' | 'steady' {
  const k = MORALE.training;
  if (gd.trained || k === 'trained' || k === 'none') return 'steady';
  if (k === 'green') return 'green';
  const own = k === 'mixed' ? undefined : squadOf(g, gd)?.def.training;
  if (own === 'trained') return 'steady'; if (own === 'green') return 'green';
  const men = bandOf(g, gd);
  if (!men) { const t = TEMPERAMENT[gd.callsign]; return (t ? t === 'nervy' : g.guards.indexOf(gd) % 2 === 1) ? 'green' : 'steady'; }
  const mix = k === 'mixed' || own === 'mixed' ? 'mixed' : mixNow(g), i = men.indexOf(gd);
  return mix === 'mixed' ? (i === 0 ? 'steady' : 'green') : men.length >= 3 && i === men.length - 1 ? 'green' : 'steady';
}
/** HIS LEADER: the first man of his squad (or band), where that man is steady — himself, if he is that man; null for a man with no band, where nobody leads,
 *  and with no training at all */
export function leaderOf(g: Game, gd: Guard): Guard | null {
  if (MORALE.training === 'none') return null;
  const L = bandOf(g, gd)?.[0] ?? null;
  return L && trainingOf(g, L) === 'steady' ? L : null;
}
/** the first slice's sequence — the fold, the cracked call, the burst into the dust, the whole magazine on the bait — is a green man's, and every man's with
 *  no training at all */
const folds = (S: Mind) => S.green || MORALE.training === 'none';
/** what a shock of `x` is to these men (MORALE.nerve) */
const nerved = (x: number) => x * (MORALE.nerveK[MORALE.nerve] ?? 1);

/** his standing terms read afresh (`first`: as the place reads, no dwell owed), and with them whether he is green and whether his leader is down */
function stand(g: Game, gd: Guard, S: Mind, first = false) {
  S.alone = !hasMate(g, gd);
  if (inTheDark(g, gd)) { S.dark = true; S.lit = 0; } else if (first || ++S.lit >= MORALE.litAsks) S.dark = false;
  if (S.act === 'none') S.green = trainingOf(g, gd) === 'green';   // (inside a sequence he keeps the training he went into it with: a knob moved under him lands when it lets him go)
  const L = S.green ? leaderOf(g, gd) : null; S.leaderDown = !!L && L.state === 'dead'; if (!S.leaderDown) S.lost = false;
}
/** DOES HE KNOW SOMETHING IS UP: a shock still on him, or off his calm round (suspicious, searching, alert). Where he stands counts for nothing until he does:
 *  a calm man alone in a dark corridor is steady. */
const roused = (gd: Guard, S: Mind) => S.shock > 0 || gd.state !== 'patrol';
const standing = (gd: Guard, S: Mind) => roused(gd, S) ? (S.alone ? MORALE.alone : 0) + (S.dark ? MORALE.dark : 0) + (S.leaderDown ? MORALE.leaderDown : 0) : 0;
const dread = (gd: Guard, S: Mind) => clamp(S.shock + standing(gd, S), 0, 1);
/** MAY HE BREAK, whatever his shock: a steady man alone in the dark; a green man alone, lit or dark — or, with his leader down, the ONE man of the squad that
 *  fall marked (`lost`): the rest, with mates at their shoulders, duck and stay in the fight (a later slice's feeds open other routes here and nowhere else) */
const mayBreak = (S: Mind) => S.green ? S.alone || (S.leaderDown && S.lost) : S.alone && S.dark;
/** the rung his dread reads, holding the one he is on down to `hyst` under its line (a green man's broken line is his own) — and held at broken only while
 *  more than `holdShock` of shock is still on him: where he stands does not keep a man broken for good */
function rungNow(gd: Guard, S: Mind): 0 | 1 | 2 {
  const K = MORALE, d = dread(gd, S), br = S.green ? K.greenBroken : K.broken;
  return mayBreak(S) && S.shock > K.holdShock && (d >= br || (S.rung === 2 && d >= br - K.hyst)) ? 2 : d >= K.jumpy || (S.rung >= 1 && d >= K.jumpy - K.hyst) ? 1 : 0;
}
/** A FEED FOR ANY EVENT (later slices'): `amount` of shock on one man, scaled by the nerve, up to the cap. Nothing with the switch off or on a man not this
 *  file's. */
export function moraleShock(g: Game, gd: Guard, amount: number) {
  if (!MORALE.on || !ours(gd) || rescued(g, gd)) return;
  const S = mind(g, gd); S.shock = Math.min(MORALE.shockCap, S.shock + nerved(amount));
}
/** THE LEADER'S DEATH (combat.ts killGuard, the victim not yet 'dead'): every living green man whose leader he is carries `leaderDown` from here; the ones
 *  with the fall in their eyes take `leaderShock`, remember when, and flinch — and the nearest of those says it, at once, and is the squad's `lost` man. */
export function moraleManDown(g: Game, victim: Guard) {
  if (!MORALE.on || !ours(victim)) return;
  const at = victim.char.pos; let near: Guard | null = null, nd = Infinity;
  for (const gd of g.guards) {
    if (gd === victim || !ours(gd) || rescued(g, gd) || trainingOf(g, gd) !== 'green' || leaderOf(g, gd) !== victim) continue;
    const S = mind(g, gd); S.leaderDown = true;
    if (g.time < gd.dazzledUntil || !canSeeChar(g, gd, victim.char, false).visible) continue;
    S.shock = Math.min(MORALE.shockCap, S.shock + nerved(MORALE.leaderShock)); S.fall = 0; MORALE_STATS.falls++;
    if ((S.act === 'none' || S.act === 'duck') && reacts(g, gd)) { begin(S, 'flinch', at); MORALE_STATS.flinches++; }
    const d = flat(gd.char.pos, at); if (d < nd) { nd = d; near = gd; }
  }
  if (near) { const S = mind(g, near); S.lost = true; bark(g, near, S, 'lost', false, true); }
}
/** seconds since he saw his leader go down (Infinity: he never did, or the switch is off) */
export function sawLeaderFall(gd: Guard): number { const S = MORALE.on ? stateOf.get(gd) : null; return S && S.fall >= 0 ? S.fall : Infinity; }

/** THE FEED'S SEAM (frag.ts blast, doortools.ts blow, wallcharge.ts blow — after each has judged its people): a blast went off at `at`, `who`'s (0: nobody's).
 *  Only filed here: who it shook is asked on the next tick, with the world as the blast left it. */
export function moraleBlast(g: Game, at: Vec3, who = 0) {
  if (!MORALE.on) return;
  let B = blastsOf.get(g); if (!B) blastsOf.set(g, B = []);
  B.push({ at: v3.copy(at), t: g.time, who }); MORALE_STATS.blasts++;
}
/** a restart (game.ts clearAftermath, beside frag.ts's): a blast filed and not yet asked about is the old floor's — the fresh shift is not shaken by it.
 *  `men` (the debugger's switch put off): every man's dread, rung and sequence are dropped too, so that the switch put back on starts clean */
export function moraleReset(g: Game, men = false) { blastsOf.delete(g); if (men) for (const gd of g.guards) stateOf.delete(gd); }
/** one filed blast, the frame after: shock to every man of ours in its reach, each man's rung, and what each does about it — the nearest ducker says so, and a
 *  leader with a green man of his on the floor beside him stands over him (the head: LEADER AND GREEN MAN) */
function feed(g: Game, b: Blast) {
  const K = MORALE, from: Vec3 = [b.at[0], Math.max(b.at[1], 0.3), b.at[2]], side = b.who ? teamOfId(g, b.who) : null;
  let caller: Guard | null = null, cd = Infinity; const fed: Guard[] = [];
  for (const gd of g.guards) {
    if (!ours(gd) || rescued(g, gd) || gd.team === side || !reacts(g, gd)) continue;   // (his own side's grenade is no surprise to him: guards.ts ownBang)
    const d = flat(gd.char.pos, b.at); if (d > K.blastM) continue;
    if (d > K.nearM && g.col.segmentBlocked(from, chestOf(gd.char))) continue;
    const S = mind(g, gd);
    S.shock = Math.min(K.shockCap, S.shock + nerved(K.blast) * (d <= K.nearM ? 1 : lerp(1, K.farK, (d - K.nearM) / Math.max(1e-3, K.blastM - K.nearM)))); MORALE_STATS.fed++;
    S.rung = rungNow(gd, S); fed.push(gd);
    if (S.rung === 2) { begin(S, 'down', b.at); S.baits = 0; S.atHole = false; S.brokeT = 0; MORALE_STATS.broke++; }
    else if (S.rung === 1 && (S.act === 'none' || S.act === 'duck' || S.act === 'stand' || S.act === 'flinch')) { begin(S, 'duck', b.at); MORALE_STATS.ducks++; }
  }
  // a leader fed by it does not duck: he stands — over the men of his it has ducked inside `orderM` of him with a line between them, who wait on his order
  for (const L of fed) {
    const SL = stateOf.get(L)!, ducked = SL.act === 'duck' && SL.t === 0; if (SL.rung === 2 || !(ducked || SL.act === 'none') || leaderOf(g, L) !== L) continue;
    const his = fed.filter(o => { const S = stateOf.get(o)!; return o !== L && S.act === 'duck' && S.t === 0 && flat(o.char.pos, L.char.pos) <= K.orderM && leaderOf(g, o) === L && !g.col.segmentBlocked(headOf(L.char), chestOf(o.char)); });
    if (!ducked && !his.length) continue;   // (too far off to be rattled, and nobody of his down beside him: the man he was)
    begin(SL, 'stand', b.at); if (ducked) MORALE_STATS.ducks--;
    for (const o of his) stateOf.get(o)!.by = L;
  }
  for (const gd of fed) { const S = stateOf.get(gd)!, d = flat(gd.char.pos, b.at); if (S.act === 'duck' && S.t === 0 && d < cd) { cd = d; caller = gd; } }
  if (caller) mind(g, caller).shout = true;   // (said on his first frame down, after his ears have had the bang — or `shoutGap` after the floor's own CONTACT, where that is in his mouth: his duck has a line of its own either way)
}
function begin(S: Mind, act: MoraleAct, hole: Vec3 | null = S.hole) { S.act = act; S.t = 0; S.hole = hole ? v3.copy(hole) : null; S.goal = null; S.rounds = 0; S.next = 0; S.by = null; S.heard = -1; S.said = false; }
function end(S: Mind) { S.act = 'none'; S.t = 0; S.goal = null; S.rounds = 0; S.next = 0; S.drive = false; S.shout = false; S.by = null; S.heard = -1; S.said = false; }

/** the enemies plainly in his eyes this frame: the test and the sight-gain bar the room fight's own walk breaks off on (roomfight.ts tickMove) — nobody for a
 *  man with magnesium in his eyes. `hole` = he is holding on it: he ALSO sees along his line to it, the same eye laid on what he is watching (a crouched man's
 *  chest and head sit well off his gun line, and a man who walked in on the far side of them was not seen at all). */
function seenBy(g: Game, gd: Guard, hole: Vec3 | null = null): Character[] {
  const out: Character[] = []; if (g.time < gd.dazzledUntil) return out;
  const eye = headOf(gd.char), E: Eye | null = hole ? { pos: eye, look: v3.normalize([hole[0] - eye[0], 0, hole[2] - eye[2]]), range: GUARD_EYE.range, halfDeg: GUARD_EYE.halfDeg, nearM: GUARD_EYE.nearM, nearDeg: GUARD_EYE.nearDeg } : null;
  const P = g.player;   // (the one player there is: asked as a side, like any other enemy of his)
  if (isHostile(gd.team, 'player') && !P.down && !g.playerInvisible) { let vis = canSee(g, gd); if (!vis.visible && E) vis = eyeContact(g, E, P.char, true, false, gd.smokeTrans); if (vis.visible && sightGain(g, gd, vis.dist) > 0.25) out.push(P.char); }
  for (const o of g.guards) { if (o.state === 'dead' || !isHostile(gd.team, o.team)) continue; let vis = canSeeChar(g, gd, o.char, false); if (!vis.visible && E) vis = eyeContact(g, E, o.char, false, false, gd.smokeTrans); if (vis.visible && sightGainOn(g, gd, o, vis.dist) > 0.25) out.push(o.char); }
  return out;
}
/** a thing somebody else threw, still on the move inside `baitM` of the hole with a line to his eyes */
function thrown(g: Game, gd: Guard, hole: Vec3): boolean {
  const eye = headOf(gd.char);
  for (const it of g.items.items) if (!it.settled && it.who !== gd.char.id && flat(it.pos, hole) <= MORALE.baitM && Math.hypot(it.vel[0], it.vel[1], it.vel[2]) > 0.5 && !g.col.segmentBlocked(eye, it.pos)) return true;
  return false;
}
/** how far he can go from where he stands along (dx, dz), a quarter metre at a time up to `max`: as far as the floor is free at his shins and his chest —
 *  short of the wall, the furniture or the man in the way */
function clearRun(g: Game, gd: Guard, dx: number, dz: number, max: number): number {
  const c = gd.char, p = c.pos, prop = g.props.raycast([p[0], 0.45, p[2]], [dx, 0, dz], max + c.radius)?.t ?? Infinity;
  let far = 0;
  for (let s = 0.25; s <= max + 1e-6; s += 0.25) {
    const x = p[0] + dx * s, z = p[2] + dz * s, r = s + c.radius;
    if (r > prop || g.col.nav.isBlocked(x, z)) break;
    if (g.col.solidBlocked([p[0], 0.45, p[2]], [p[0] + dx * r, 0.45, p[2] + dz * r]) || g.col.solidBlocked([p[0], 1.0, p[2]], [p[0] + dx * r, 1.0, p[2] + dz * r])) break;
    if (g.guards.some(o => o !== gd && o.state !== 'dead' && flat(o.char.pos, [x, 0, z]) < 0.6)) break;
    far = s;
  }
  return far;
}
/** the way off the hole from where he stands, a unit vector on the floor (on it: the way his back is turned) */
function awayFrom(c: Character, hole: Vec3): [number, number] {
  const dx = c.pos[0] - hole[0], dz = c.pos[2] - hole[2], l = Math.hypot(dx, dz);
  return l > 0.05 ? [dx / l, dz / l] : [-Math.sin(c.bodyYaw), -Math.cos(c.bodyYaw)];
}
/** where the scrabble ends: straight back off the hole where that gives `straightM`; else the longest clear run of a small fan about it — straight, then to
 *  his left and his right by turns, `fanStep` degrees at a time out to `fanDeg`, in that order always (the first of two equal runs is kept) — up to `backM`.
 *  null = nowhere to go */
function backGoal(g: Game, gd: Guard, hole: Vec3): Vec3 | null {
  const K = MORALE, p = gd.char.pos, [dx, dz] = awayFrom(gd.char, hole);
  let far = clearRun(g, gd, dx, dz, K.backM), bx = dx, bz = dz;
  if (far < K.straightM) for (let a = K.fanStep; a <= K.fanDeg + 1e-6 && K.fanStep > 0; a += K.fanStep) for (const sgn of [1, -1]) {
    const r = sgn * a * Math.PI / 180, x = dx * Math.cos(r) + dz * Math.sin(r), z = dz * Math.cos(r) - dx * Math.sin(r), run = clearRun(g, gd, x, z, K.backM);
    if (run > far + 1e-6) { far = run; bx = x; bz = z; }
  }
  return far >= 0.5 ? [p[0] + bx * far, 0, p[2] + bz * far] : null;
}
/** the leader's one side step off the hole's line: `sideM` to his left, else to his right, where the floor is free that far and the step leaves him his line
 *  to `to` (the nearest of his men on the floor, if any). null = he stands where he is */
function sideGoal(g: Game, gd: Guard, hole: Vec3, to: Guard | null): Vec3 | null {
  const K = MORALE, p = gd.char.pos, [dx, dz] = awayFrom(gd.char, hole);
  for (const sgn of [1, -1]) {
    const x = dz * sgn, z = -dx * sgn; if (clearRun(g, gd, x, z, K.sideM) < K.sideM - 1e-6) continue;
    const at: Vec3 = [p[0] + x * K.sideM, 0, p[2] + z * K.sideM];
    if (!to || !g.col.segmentBlocked([at[0], 1.6, at[2]], chestOf(to.char))) return at;
  }
  return null;
}
/** one turn of a burst: a real round through the game's own firing path (roomfight.ts blind()'s call) at the hole, once the gun is round on it. false = the
 *  burst is over (dry, or mid-change) */
function round(g: Game, gd: Guard, S: Mind, dt: number, every: number, of: 'dust' | 'bait'): boolean {
  const c = gd.char, hole = S.hole!; if (gd.reloadT >= 0) return false;
  S.next -= dt; if (S.next > 0) return true;
  const at: Vec3 = [hole[0], 1.1, hole[2]];
  if (gd.muzzleDown || Math.abs(wrapAngle(v3.yawTo(c.pos, hole) - c.gunYaw)) > 0.5) return true;   // (not on it yet, or down for a mate in the line: the turn waits, it is not lost)
  if (!gd.weapon.fire()) return false;
  fireWeapon(g, c, at, false, { steady: true, spread: MORALE.spread, blind: true });
  S.rounds--; S.next = every; MORALE_STATS.rounds++;
  MORALE_LOG.push({ id: c.id, t: g.time, from: v3.copy(c.muzzle), at, of }); if (MORALE_LOG.length > 96) MORALE_LOG.shift();
  return S.rounds > 0;
}
/** the long burst is spent and the gun is empty: the guards' own magazine change (guards.ts startReloadBeat's beat, tickReloadBeat's end — every fire site
 *  waits on it, and on a gun with nothing in it) — said in THIS file's words, shouted — stretched to `reloadSecs` */
function runDry(g: Game, gd: Guard, S: Mind) {
  const c = gd.char; begin(S, 'reload');
  const row = gd.reloadT < 0 ? feedBegin(gd.weapon) : gd.weapon.reloadRow;   // (gunreload.ts: the gun's own row, as ever — a tube gun's by the shell under that key)
  if (gd.reloadT < 0) { gd.weapon.burst = null; c.anim.reload(); g.audio.play('magOut', c.pos, 0.5); }
  gd.reloadT = Math.max(gd.reloadT, row.dur, MORALE.reloadSecs);
  bark(g, gd, S, 'out', false, true); MORALE_STATS.reloads++;
}
/** a bait taken: the first is the rest of the magazine, the second `baitShort` rounds, the third a word. A STEADY man's is `baitShort` rounds, twice and no
 *  more, and never his last round: his gun is never empty by this file's hand */
function bait(g: Game, gd: Guard, S: Mind) {
  S.baits++; MORALE_STATS.baits++;
  if (!folds(S)) { const n = Math.min(MORALE.baitShort, gd.weapon.roundsReady - 1); if (S.baits <= 2 && n > 0) { begin(S, 'bait'); S.rounds = n; } return; }   // (two throws have taught him: the third thing through the hole he watches)
  if (S.baits === 1) { begin(S, 'bait'); S.rounds = gd.weapon.def.magCapacity + 1; }   // (more than it can hold: the burst ends when the gun says it is dry)
  else if (S.baits === 2) { begin(S, 'bait'); S.rounds = MORALE.baitShort; }
  else if (S.baits === 3) bark(g, gd, S, 'spent', false, true);
}

/** what this file's script holds him to this frame, by his act — `rooted`: a stagger has him (down where he is, gun down, whatever the act) */
function pose(gd: Guard, S: Mind, rooted: boolean) {
  const s = S.script, c = gd.char, hole = S.hole!, low = rooted || S.act === 'duck' || S.act === 'flinch' || (S.act === 'down' && folds(S)) || S.act === 'reload', walks = S.act === 'back' || S.act === 'stand';
  s.goal = walks && !rooted ? S.goal : null; s.speed = MORALE.backSpeed; s.strafe = walks; s.face = v3.yawTo(c.pos, hole);
  s.aimAt = low ? null : [hole[0], 1.1, hole[2]]; s.upper = low ? 'none' : 'aim'; s.stance = low ? 'lowReady' : 'none'; s.crouch = S.act !== 'stand'; s.over = null;   // (the leader stands)
}

/** ONCE A FRAME, right after the room fight's tick (game.ts update) and before anybody moves: shock decays, each man's standing is read on his own frames, the
 *  blasts filed since last frame are fed, the rungs are read, and every man in a sequence is taken a step through it. A return on its first line with the
 *  switch off. */
export function moraleTick(g: Game, dt: number) {
  if (!MORALE.on) return;
  const K = MORALE, k = Math.pow(2, -dt / K.halfLife);
  for (const gd of g.guards) {
    if (!ours(gd) || rescued(g, gd)) { stateOf.delete(gd); continue; }
    const S = mind(g, gd); S.drive = false;
    S.shock *= k; if (S.shock < 0.01) S.shock = 0;
    S.bark = Math.min(S.bark + dt, 60); if (S.fall >= 0) S.fall += dt;
    S.ask += dt; if (S.ask >= K.askSecs) { S.ask = 0; stand(g, gd, S); }
  }
  const B = blastsOf.get(g);
  if (B && B.length) { const due = B.filter(b => g.time > b.t); if (due.length) { blastsOf.set(g, B.filter(b => g.time <= b.t)); for (const b of due) feed(g, b); } }
  for (const gd of g.guards) {
    const S = stateOf.get(gd); if (!S || !ours(gd)) continue;
    S.rung = rungNow(gd, S);
    if (S.act !== 'none') step(g, gd, S, dt);
  }
}
/** one frame of a man's sequence: decides the act, fires its rounds, says its lines, and whether this file's script has him this frame */
function step(g: Game, gd: Guard, S: Mind, dt: number) {
  const K = MORALE;
  if (!reacts(g, gd) || !S.hole) { end(S); return; }
  if (!gd.script && gd.state !== 'alert' && gd.awareness >= ALERT_AW) return;   // the floor's own rules owe him 'alert' this frame (his CONTACT, the alarm, the net): theirs, not this file's
  if (S.calls > 0) S.callT += dt;
  const rooted = g.time < gd.staggerUntil;   // (the blast's own stagger, or anything else that has folded him: no step, no round, and the sequence's clock stands)
  if (S.act === 'duck') {   // ---- jumpy: down at once, and for his seconds once the stagger is over (a steady man's are fewer); from then an enemy in his eyes has him up — and so has his leader's order, `orderSecs` on and in his place in the line
    if (S.heard >= 0) S.heard += dt;
    if (!rooted) { S.t += dt;
      if (S.heard >= K.orderSecs + S.next) { if (S.said) bark(g, gd, S, 'okay', false, true); end(S); return; }
      if (S.t >= (folds(S) ? K.duckSecs : K.steadyDuck) || seenBy(g, gd).length) { end(S); return; } }
    drive(g, gd, S, dt, rooted); return;
  }
  if (S.act === 'flinch') {   // ---- he saw his leader go down: down facing where he fell for the beat, whatever is in his eyes, then the man he was
    if (!rooted) { S.t += dt; if (S.t >= K.flinchSecs) { end(S); return; } }
    drive(g, gd, S, dt, rooted); return;
  }
  if (S.act === 'stand') {   // ---- the leader: on his feet, gun on the hole, a side step; with men of his ducked beside him, the order `orderBeat` after any stagger; then the man he was
    if (!rooted) {
      const his = () => g.guards.filter(o => { const M = stateOf.get(o); return !!M && M.by === gd && M.act === 'duck'; }).sort((a, b) => flat(a.char.pos, gd.char.pos) - flat(b.char.pos, gd.char.pos));
      if (S.t === 0) { const to = his()[0]; S.goal = sideGoal(g, gd, S.hole, to ?? null); S.script.arrived = false; }   // (his first frame on his own feet: the step is dealt from where the stagger left him)
      S.t += dt;
      if (S.t >= K.standSecs || seenBy(g, gd).length) { end(S); return; }
      if (S.goal && S.script.arrived) S.goal = null;
      if (!S.said && S.t >= K.orderBeat) { S.said = true; const men = his();   // (nearest first: they get up a breath apart, and the nearest answers for them)
        if (men.length) { bark(g, gd, S, 'order', false, true); MORALE_STATS.orders++; men.forEach((o, i) => { const M = stateOf.get(o)!; M.heard = 0; M.next = i * K.orderGap; M.said = i === 0; }); } } }
    drive(g, gd, S, dt, rooted); return;
  }
  const owned = S.act === 'bait' || S.act === 'reload';   // (the bait's rounds and the change after them run out whatever he sees, whatever he has calmed to)
  if (S.rung < 2 && !owned) { end(S); return; }
  if (rooted) { drive(g, gd, S, dt, true); return; }
  const seen = owned ? [] : seenBy(g, gd, S.act === 'hold' ? S.hole : null);
  if (seen.length && S.act !== 'hold') { end(S); return; }   // an enemy plainly in his eyes: the fight's man from here, for good
  S.t += dt; S.brokeT += dt;
  if (S.act === 'hold' && S.brokeT >= K.holdMax) { end(S); return; }   // long enough: he is his squad's man again, whatever his dread still reads
  switch (S.act) {
    case 'down':
      if (S.t >= K.downSecs) { const t = S.t; begin(S, 'back'); S.t = t; S.goal = backGoal(g, gd, S.hole); S.script.arrived = false;   // say, then do: the call goes out as the scrabble starts
        if (S.calls === 0) { if (!folds(S)) bark(g, gd, S, 'clear', true, true); else if (S.alone) bark(g, gd, S, 'call', true, true);   // (the squad's `lost` man, broken among his mates, has nobody to call — and said his piece when his leader fell)
          S.calls = 1; S.callT = 0; } }
      break;
    case 'back':
      if (S.t >= K.backUntil || !S.goal || S.script.arrived) { if (folds(S)) { begin(S, 'burst'); S.rounds = K.burstRounds; } else begin(S, 'hold'); }   // (a steady man holds his fire for something to shoot at)
      break;
    case 'burst':
      if (!round(g, gd, S, dt, K.burstEvery, 'dust') || S.t > K.burstRounds * K.burstEvery + 2) begin(S, 'hold');
      break;
    case 'hold':
      if (S.calls === 1 && S.callT >= K.call2Secs && S.alone && folds(S)) { bark(g, gd, S, 'again', true, true); S.calls = 2; }
      if (seen.length) {   // at the hole with the magazine still his to spend: the bait. Anywhere else, or any time after it: the hold is over
        if (S.baits === 0 && seen.some(c => flat(c.pos, S.hole!) <= K.baitM)) { bait(g, gd, S); S.atHole = true; } else { end(S); return; }
      } else { const at = thrown(g, gd, S.hole); if (at && !S.atHole) bait(g, gd, S); S.atHole = at; }
      break;
    case 'bait':
      if (!round(g, gd, S, dt, K.baitEvery, 'bait') || S.t > (gd.weapon.def.magCapacity + 1) * K.baitEvery + 2) { if (S.baits === 1 && folds(S)) runDry(g, gd, S); else begin(S, 'hold'); }
      break;
    case 'reload':
      if (gd.reloadT < 0) begin(S, 'hold');
      break;
  }
  drive(g, gd, S, dt, false);
}
/** this file's script has him this frame: posed for his act, his gun out (a staff man's torch goes to his belt as on any alarm), his ears open, a magazine
 *  change in hand run on, his reaction beat run down as under a head-down */
function drive(g: Game, gd: Guard, S: Mind, dt: number, rooted: boolean) {
  pose(gd, S, rooted); S.drive = true; S.driveT = g.time; gd.drawn = true;
  hearingCheck(g, gd);
  if (S.shout && S.act !== 'duck') S.shout = false;
  if (S.shout && !(gd.bubble && g.time - gd.bubble.t < MORALE.shoutGap)) { S.shout = false; bark(g, gd, S, 'duck', false, true); }
  if (gd.reloadT >= 0) tickReloadBeat(g, gd, dt);
  if (gd.reactT > 0) gd.reactT -= dt;
}

/** THE BODY'S SEAM (guards.ts updateGuard, beside frag.ts's flee): the script his body follows this frame, null = he is nobody's but his own. The caller runs it
 *  through squad.ts runGuardScript for this frame only — his own script, state and fix are left as they were. A man going down is folded (the clutch). */
export function moraleScript(g: Game, gd: Guard): GuardScript | null {
  if (!MORALE.on) return null;
  const S = stateOf.get(gd); if (!S || !S.drive || S.driveT !== g.time) return null;
  if (S.act === 'down' && folds(S)) gd.char.anim.clutch = 1;
  return S.script;
}
/** has a sequence of this file's got him (the other drivers yield: roomfight.ts tickDef) — as of the last tick */
export function moraleOwns(gd: Guard): boolean { return MORALE.on && !!stateOf.get(gd)?.drive; }
/** his dread, 0‥1 (0 with the switch off or a man never met) */
export function dreadOf(gd: Guard): number { if (!MORALE.on) return 0; const S = stateOf.get(gd); return S ? dread(gd, S) : 0; }
/** his dread while an event's shock is still on him, 0 otherwise — dialogue.ts agitationOf reads it, so that a shaken man's words and his body agree (where he
 *  stands alone moves no line of his: a calm man in a dark office is not rattled) */
export function shakenOf(gd: Guard): number { if (!MORALE.on) return 0; const S = stateOf.get(gd); return S && S.shock > 0 ? dread(gd, S) : 0; }
/** his rung: 0 steady · 1 jumpy · 2 broken */
export function rungOf(gd: Guard): 0 | 1 | 2 { return MORALE.on ? stateOf.get(gd)?.rung ?? 0 : 0; }
/** QA: what the rule has of a man (null = never met) */
export function moraleOf(gd: Guard): Readonly<Omit<Mind, 'script'>> | null { return stateOf.get(gd) ?? null; }
/** 'morale ▸ Tango 2 0.85 BROKEN hold (alone, dark) · Tango 4 0.35 jumpy duck' — every living man with anything on him; '' with the switch off */
export function moraleSummary(g: Game): string {
  if (!MORALE.on) return '';
  const men = g.guards.filter(gd => ours(gd) && stateOf.has(gd)).map(gd => [gd, stateOf.get(gd)!] as const).filter(([, S]) => S.rung > 0 || S.act !== 'none' || S.shock > 0.005);
  return 'morale ▸ ' + (men.map(([gd, S]) => `${gd.callsign} ${dread(gd, S).toFixed(2)} ${['steady', 'jumpy', 'BROKEN'][S.rung]}${S.act !== 'none' ? ` ${S.act}` : ''}${S.alone || S.dark || S.leaderDown ? ` (${[S.alone ? 'alone' : '', S.dark ? 'dark' : '', S.leaderDown ? 'leader down' : ''].filter(Boolean).join(', ')})` : ''}`).join(' · ') || 'every man steady');
}
/** 'men ▸ S g g g · S g g g · S g g' — who is steady (S) and who green (g), a band at a time in its own order (a squad; with no squads, a room), the
 *  living men only; men with no band (the night staff) as one last group. The debugger's Enemy nerve section — the rungs are the 'morale ▸' row's. '' with
 *  the switch off */
export function moraleRoster(g: Game): string {
  if (!MORALE.on) return '';
  const groups: Guard[][] = [], loose: Guard[] = [], seen = new Set<Guard[]>();
  for (const gd of g.guards) { if (!ours(gd) || rescued(g, gd)) continue; const B = bandOf(g, gd); if (!B) loose.push(gd); else if (!seen.has(B)) { seen.add(B); groups.push(B.filter(o => ours(o))); } }
  if (loose.length) groups.push(loose);
  return 'men ▸ ' + (groups.map(B => B.map(gd => trainingOf(g, gd) === 'steady' ? 'S' : 'g').join(' ')).join(' · ') || 'nobody');
}

// ---------------------------------------------------------------- the visit's choices (the page: host/profile.ts pageSwitches; the debugger's Enemy nerve section)
const VISIT = 'twopointsix.morale.visit';
type Kept = { on?: unknown; training?: unknown; nerve?: unknown };
const kept = (): Kept => { try { const k = JSON.parse(globalThis.sessionStorage?.getItem(VISIT) ?? '{}'); return k && typeof k === 'object' ? k : {}; } catch { return {}; } };
/** a choice made by hand in the debugger stands for the VISIT — through a restart (nothing rewrites the table) and through the page load a change of level
 *  costs (kept in the tab's own store, read back by moraleFromQuery) — and no longer: a new tab opens on the page's own. ONLY THE ROW TOUCHED is kept: what
 *  the address or a recording put on the other rows is not made the visit's by it. */
export function moraleKeep(row: 'on' | 'training' | 'nerve') { try { globalThis.sessionStorage?.setItem(VISIT, JSON.stringify({ ...kept(), [row]: MORALE[row] })); } catch { /* no store */ } }
/** THE PAGE'S RULE for the switch and the two choices: the visit's kept choice, and over it the address — `?nomorale`, `?training=green|mixed|trained`,
 *  `?nerve=brittle|steady`. No flag and nothing kept (the harness's shipped stand: no store): on, by difficulty, normal. */
export function moraleFromQuery(q: URLSearchParams) {
  const k = kept(), tr = (v: unknown) => TRAININGS.find(t => t === v), nv = (v: unknown) => NERVES.find(n => n === v);
  MORALE.on = !q.has('nomorale') && k.on !== false;
  MORALE.training = tr(q.get('training')) ?? tr(k.training) ?? 'difficulty';
  MORALE.nerve = nv(q.get('nerve')) ?? nv(k.nerve) ?? 'normal';
}
/** runner.ts: the man is that file's from here (he drops it and runs) — whatever sequence has him ends where it stands; his dread and his rung are left as they are */
export function moraleRelease(gd: Guard) { const S = stateOf.get(gd); if (S && (S.act !== 'none' || S.drive)) end(S); }

// ---------------------------------------------------------------- checkpoints (game/savestate.ts): each man's dread and sequence by roster index, and the blasts not yet asked
export interface MoraleSnap { men: (number[] | null)[]; holes: (number[] | null)[]; blasts: number[][] }
const n3 = (p: Vec3 | null) => p ? [p[0], p[1], p[2]] : [NaN, NaN, NaN];
/** nothing (no key in the file) with the switch off or before the rule has met anybody */
export function moraleSnapshot(g: Game): MoraleSnap | undefined {
  if (!MORALE.on) return undefined;
  const men = g.guards.map(gd => { const S = stateOf.get(gd); return S ? [S.shock, S.alone ? 1 : 0, S.dark ? 1 : 0, S.lit, S.ask, S.rung, ACTS.indexOf(S.act), S.t, S.rounds, S.next, S.calls, S.callT, S.baits, S.atHole ? 1 : 0, S.bark, S.shout ? 1 : 0, S.green ? 1 : 0, S.leaderDown ? 1 : 0, S.fall, S.by ? g.guards.indexOf(S.by) : -1, S.heard, S.said ? 1 : 0, S.lost ? 1 : 0, S.brokeT] : null; });
  const B = blastsOf.get(g) ?? [];
  if (!men.some(m => m) && !B.length) return undefined;
  return { men, holes: g.guards.map(gd => { const S = stateOf.get(gd); return S && S.hole ? [...n3(S.hole), ...n3(S.goal)] : null; }), blasts: B.map(b => [b.at[0], b.at[1], b.at[2], b.t, b.who]) };
}
/** …onto the fresh roster (a file without the slice: every man is met afresh, steady, on his first tick) */
export function moraleRestore(g: Game, s: MoraleSnap | null | undefined) {
  const f = (x: unknown, d = 0) => typeof x === 'number' && Number.isFinite(x) ? x : d;
  g.guards.forEach((gd, i) => { const M = s?.men?.[i], H = s?.holes?.[i];
    if (!M) { stateOf.delete(gd); return; }
    const p3 = (o: number): Vec3 | null => H && Number.isFinite(H[o]) ? [H[o], H[o + 1], H[o + 2]] : null;
    stateOf.set(gd, { shock: clamp(f(M[0]), 0, 1), alone: !!M[1], dark: !!M[2], lit: f(M[3]), ask: Math.max(0, f(M[4])), rung: (M[5] === 2 ? 2 : M[5] === 1 ? 1 : 0), green: !!M[16], leaderDown: !!M[17], fall: f(M[18], -1), by: g.guards[f(M[19], -1)] ?? null, heard: f(M[20], -1), said: !!M[21], lost: !!M[22], brokeT: Math.max(0, f(M[23])), act: ACTS[f(M[6])] ?? 'none', t: Math.max(0, f(M[7])), hole: p3(0), goal: p3(3),
      rounds: f(M[8]), next: f(M[9]), calls: f(M[10]), callT: f(M[11]), baits: f(M[12]), atHole: !!M[13], bark: f(M[14], MORALE.barkSecs), shout: !!M[15], drive: false, driveT: -1, script: { goal: null } }); });
  const B = (s?.blasts ?? []).map(b => ({ at: [f(b[0]), f(b[1]), f(b[2])] as Vec3, t: f(b[3]), who: f(b[4]) }));
  if (B.length) blastsOf.set(g, B); else blastsOf.delete(g);
}
