// Interrogation dialogue engine (docs/internal/grab-interrogate-design.md §4, slice 5): a pure-ish function over state the AI already keeps — each man's own
// witness record (game.ts Witness: what HE saw and heard), his sightings, the floor's alarm level, the net's radio check, the lockdown duties — that answers
// 'Sam has this man by the throat and leans on him: what does he say?'. Three axes pick the cell: KNOWLEDGE of Sam (none / heard / glimpsed / saw / sawHurt —
// his own perception only, never the floor's), AGITATION (0‥1 → low / mid / high, from the floor state, what he personally went through, how long he has been
// held, and his temperament), TEMPERAMENT (game.ts TEMPERAMENT: steady / nervy / hard). Each cell has STAGES — 1 the reaction, 2 the pressure, 3 the one useful
// thing he plausibly knows (the INTEL generator) or the admission / refusal that he has none, then 'x', nothing left, tapped for as long as you like — each a
// small pool sampled without repeats per man. Nothing here imports the game beyond types and three read-only values (TEMPERAMENT, rollcallState, escalationOf);
// gather() and the small readers it is built from (knowledgeOf, agitationOf, the token resolvers) are all that touch a Game — the picker works on the plain
// DialogueCtx gather returns (the QA probes synthesize those by hand to sweep the whole matrix). Nothing is written back but the man's own Talk record.
//
// The grab (player.ts startGrab / updateHold) owns 'held': while Guard.held is set its `since` IS the held clock and nothing here touches it; the sandbox
// button's bare exchange with a man nobody holds still stamps talk.heldSince itself and lets it lapse (heldSinceOf), so the probes can sweep the matrix.
//
// An exchange in the arm is two speakers (player.ts askHeld): SAM's line first — SAM_LINES below, picked by pickSamLine for the exchange that is coming
// (his first words / leaning on him / asking for the useful thing, worded for the very thing the man is about to give when peekGive says he will / the last
// word to a man who has nothing left), coloured by the hold's variant, the floor and the man — then, when Sam's bubble ends, the man's answer through
// interrogate() exactly as before. Nothing on the man's side moves until he answers: Sam's pick only reads the context. Questions are the ARM hold's
// (the knife at his throat): with the pistol drawn to his head (E mid-hold, player.ts swapHold) a tap asks nothing until it is holstered again — the one
// place the [gun] lines still reach the air is Sam's remark as he draws (samRemarkFor). One answer does something besides being said: the man who gives
// the keyed door up ('…mine's on my belt') gives his key up with it — game.ts interrogate → player.ts takeKey — and Sam's word on THAT (the 'key' remarks,
// samKeyLineFor) follows his line down.
//
// ============================================================================================================================================================
//   SHAPES (the G7 pass). Most holds now play a SCRIPT: one comic shape — count pedantry, the self-own, the over-cooperator, the rambler, the fan, the stoic,
//   the con, the arbitrary game, the room's own menace — written as four beats for the four staged presses, Sam's line and the man's answer authored TOGETHER
//   (and on some beats Sam's rejoinder once the answer is down: Hold.after, the mechanism his word on a pocketed key already used), dealt per man from his
//   callsign among the scripts that fit his temperament, what he knows of Sam and how rattled he is, and kept for the whole hold (SCRIPTS, at the end of the
//   file, with ROOM_MENACE, the handler's radio and the ambient pairs). The useful thing still comes from the INTEL generator at the giving stages — in the
//   shape's voice where a variant is written — through the same tokens, and the keyed door still puts the man's key in Sam's pocket. The LINES / SAM_LINES
//   pools below are the fallback voice: a man who watched Sam hurt somebody (sawHurt: frightened, never funny), the fifth press and after, a script line whose
//   token went null mid-hold, a synthetic context nothing fits. lintDialogue() holds every speaker to the same rules: ≤ MAX_CHARS (aim ≤ AIM_CHARS) after the
//   longest token expansion, Sam ≤ SAM_MAX_CHARS, tokens only from TOKENS, needs only from NEEDS, and not one phrase off the ORIGINALITY_BLOCKLIST.
// ============================================================================================================================================================
import { SideMap } from '../math/side';
import { v3, approachAngle } from '../math/vec';
import type { Vec3 } from '../math/vec';
import type { Level } from '../scene/level';
import type { Door } from './doors';
import type { Game, Guard, Temperament, Talk } from './game';
import type { HoldVariant } from './character';
import { TEMPERAMENT, isBreathing } from './game';
import { rollcallState, escalationOf, bubbleSecs } from './guards';
import { needsBusy } from './needs';
import { CUES } from './cues';
import { simRandom, hashStr } from '../math/dice';   // the simulation's die (math/dice.ts): the Game's own when it has one, Math.random otherwise
import { defenderWords } from './teams';
import { takeTold } from './takecheck';   // (a leaf: was anybody told the thing is gone)
import { WORDS, w, wg } from './words';   // (a leaf: the dialogue pass's one switch)
import { shakenOf } from './morale';   // (read inside agitationTerms only)

// ---------------------------------------------------------------- axes
export type Knowledge = 'none' | 'heard' | 'glimpsed' | 'saw' | 'sawHurt';
export const KNOWLEDGE: Knowledge[] = ['none', 'heard', 'glimpsed', 'saw', 'sawHurt'];
export type Band = 'low' | 'mid' | 'high';
export const BANDS: Band[] = ['low', 'mid', 'high'];
export const TEMPERAMENTS: Temperament[] = ['steady', 'nervy', 'hard'];
export type StageKey = 1 | 2 | 3 | 'x';
export const STAGES: StageKey[] = [1, 2, 3, 'x'];
/** agitation bands: calm below MID, rattled below HIGH, panicked from there (hard men's 'panicked' is written as cold fury, not pleading) */
export const BAND_MID = 0.3, BAND_HIGH = 0.6;
export function bandOf(a: number): Band { return a >= BAND_HIGH ? 'high' : a >= BAND_MID ? 'mid' : 'low'; }
/** hard limit for one line after token expansion (the bubble is 190 px of 11 px text: ~3 lines of it), the length the writing AIMS at (two bubble lines — the lint
 *  reports the share of lines at or under it, lineLengthReport), and the reach of the sandbox gate until the grab exists */
export const MAX_CHARS = 90, AIM_CHARS = 60;
export const INTERROGATE_REACH = 2.0;
/** seconds held after which 'heldLong' lines unlock; seconds without an exchange after which the SANDBOX (a man nobody holds) treats the next press as a fresh hold;
 *  seconds an aborted choke / whip keeps a man that has since been let go rattled (held, it lasts the hold) */
export const HELD_LONG_SECS = 40, HOLD_LAPSE_SECS = 30, ABORT_RATTLE_SECS = 60;

/**
 * knowledgeOf — what this man knows of SAM, the highest level that holds, from HIS OWN record only (the floor's alarm level moves agitation and unlocks
 * colour lines; it is never knowledge — a man told 'weapons out' over the net has still never perceived anyone):
 *
 *   level      holds when (fields on Guard gd / gd.witness W / W.heard H)                              means
 *   ─────────  ──────────────────────────────────────────────────────────────────────────────────────  ─────────────────────────────────────────────────────
 *   sawHurt    W.sawAct ≠ null (guards.ts witnessKill: the victim in his open view as he dropped, or    he watched Sam shoot / drop / choke a colleague
 *              his eyes on Sam as the shot went) · or W.sawHeld ≠ null (reserved: a colleague held)
 *   saw        gd.lastSeenT ≥ 0 (a REAL sighting, sightGain > 0.25: the licence to shoot) · or          he has had Sam plainly in view at least once
 *              W.alertedBy === 'sight' (glimpses that added up to CONTACT) · or gd.weapon.spent > 0 (fired at him — rounds gone from the magazine he has in, exactly what Guard.shots was: nought again once he has reloaded)
 *   glimpsed   gd.sightT ≥ 0 (a faint glimpse, sightGain > 0.05, moved his fix — never a real sighting)  a shape in the dark, about your size
 *   heard      H.shots + H.kick + H.bang + H.small > 0 (sounds that reached him through his own hearing  he knows SOMEONE is in the building tonight,
 *              model and raised him) · or W.alertedBy ∈ {sound, radio, body} · or W.sawBody / W.called-  never had eyes on who
 *              ToBody (a man is down: found by him, or called in on the net) · or W.dazzled > 0
 *   none       nothing above                                                                             never perceived Sam or any sign of him
 */
export function knowledgeOf(g: Game, gd: Guard): Knowledge {
  const W = gd.witness, H = W.heard;
  if (W.sawAct || W.sawHeld) return 'sawHurt';
  if (gd.lastSeenT >= 0 || W.alertedBy === 'sight' || gd.weapon.spent > 0) return 'saw';
  if (gd.sightT >= 0) return 'glimpsed';
  if (H.shots + H.kick + H.bang + H.small > 0 || W.alertedBy === 'sound' || W.alertedBy === 'radio' || W.alertedBy === 'body' || W.sawBody || W.calledToBody || W.dazzled > 0) return 'heard';
  return 'none';
}

/**
 * agitationOf — 0‥1, the sum of (clamped):
 *
 *   term            value                       source
 *   ──────────────  ──────────────────────────  ────────────────────────────────────────────────────────────────────────────────────────────────
 *   floor           0.22 × escalation (0/1/2)   guards.ts escalationOf: calm / heightened / lockdown (0 under the tour)
 *   episode         +0.15                       g.alarm.episode: somebody is alert or still searching right now
 *   ownAlert        +0.20                       he is 'alert' now, or went alert within the last 60 s (W.alertT)
 *   ownEdge         +0.10                       he is 'suspicious' / 'search' now (not alert)
 *   sawAct          +0.30                       W.sawAct: watched Sam put a man down
 *   sawBody         +0.20                       W.sawBody: walked onto a body himself
 *   calledToBody    +0.12                       W.calledToBody (and did not find one himself): heard a man called in
 *   shots           +0.15                       H.shots > 0: gunfire reached him (anyone's)
 *   bangs           +0.10                       H.kick + H.bang > 0: a door going in / a stun charge
 *   dazzled         +0.15                       W.dazzled > 0: took a stun charge in the open eyes
 *   missing         +0.10                       the net has asked after a man and got nothing (any x.missedAt ≥ 0 / missingRaised)
 *   blackout        +0.08                       g.blackout.active
 *   held            nervy +0.04 per 10 s held (cap +0.15); steady / hard −0.03 per 10 s (cap −0.12): they settle, he does not (heldSinceOf: Guard.held.since)
 *   gunToHead       +0.10                       held with the pistol at his head rather than an arm round the throat (Guard.held.variant 'gun')
 *   aborted         +0.20                       Sam started to choke / pistol-whip him and eased off (talk.abortT): for the rest of the hold, or ABORT_RATTLE_SECS once let go
 *   pressed         +0.03 per press past the third (cap +0.15): the exhausted pool gets rawer the longer you lean
 *   bias            nervy +0.15 · hard −0.10 · steady 0                                                          (TEMPERAMENT)
 */
export function agitationOf(g: Game, gd: Guard): number { return agitationTerms(g, gd).a; }
function agitationTerms(g: Game, gd: Guard): { a: number; why: string[] } {
  const W = gd.witness, H = W.heard, t = temperamentOf(gd), talk = gd.talk; const why: string[] = []; let a = 0;
  const add = (v: number, label: string) => { if (Math.abs(v) < 1e-6) return; a += v; if (Math.abs(v) >= 0.005) why.push(`${label} ${v > 0 ? '+' : ''}${v.toFixed(2)}`); };
  add(0.22 * escalationOf(g), 'floor');
  if (g.alarm.episode && !g.quietUtility) add(0.15, 'episode');
  if (gd.state === 'alert' || (W.alertT >= 0 && g.time - W.alertT < 60)) add(0.2, 'ownAlert'); else if (gd.state === 'suspicious' || gd.state === 'search') add(0.1, 'ownEdge');
  if (W.sawAct) add(0.3, 'sawAct');
  if (W.sawBody) add(0.2, 'sawBody'); else if (W.calledToBody) add(0.12, 'calledToBody');
  if (H.shots > 0) add(0.15, 'shots');
  if (H.kick + H.bang > 0) add(0.1, 'bangs');
  if (W.dazzled > 0) add(0.15, 'dazzled');
  if (missingKnownTo(g, gd)) add(0.1, 'missing');
  if (g.blackout.active) add(0.08, 'blackout');
  const hs = heldSinceOf(g, gd); const held = hs >= 0 ? Math.max(0, g.time - hs) : 0;
  if (held > 0) add(t === 'nervy' ? Math.min(0.15, 0.004 * held) : -Math.min(0.12, 0.003 * held), 'held');
  if (gd.held?.variant === 'gun') add(0.1, 'gunToHead');
  if (talk.abortT >= 0 && (gd.held || g.time - talk.abortT < ABORT_RATTLE_SECS)) add(0.2, 'aborted');
  if (talk.presses > 3) add(Math.min(0.15, 0.03 * (talk.presses - 3)), 'pressed');
  add(t === 'nervy' ? 0.15 : t === 'hard' ? -0.1 : 0, 'bias');
  add(Math.max(0, shakenOf(gd) - Math.max(0, a)), 'dread');   // (morale.ts: a man with a blast's shock still on him is at least as agitated as he is afraid — his words and his body agree; 0 with its switch off)
  return { a: Math.max(0, Math.min(1, a)), why };
}
/** by callsign — and (WORDS) a spawned unit, whatever it is called, is a fighting man, not somebody on nights: hard */
export function temperamentOf(gd: Guard): Temperament { return WORDS.on && gd.unit ? 'hard' : TEMPERAMENT[gd.callsign] ?? 'steady'; }
/** the stages at which this temperament GIVES the useful thing: steady plainly at 3; nervy early, at 2, and whatever else he has at 3; hard only once rattled */
export function givesAt(t: Temperament, band: Band): StageKey[] { return t === 'nervy' ? [2, 3] : t === 'hard' ? (band === 'low' ? [] : [3]) : [3]; }

// ---------------------------------------------------------------- needs (fact predicates by name) and tokens
/** Fact predicates a line may require (all must hold). Evaluated once per exchange into DialogueCtx.facts. The last two say WHO is talking (both simply true with
 *  WORDS off): 'shift' = one of the level's own staff on a beat (not a spawned unit: he walks no route, signs no sheet, knows no routine to give up), 'office' =
 *  that, on the office — the lines about reception, the vending machine, audits and hi-vis are that building's and nobody else's. */
export const NEEDS = ['floorUp', 'lockdown', 'episode', 'heardSmall', 'heardShots', 'heardBang', 'bodyFound', 'bodyCalled', 'bodyKnown', 'missingKnown', 'blackout', 'heldLong', 'rollcallLive', 'dazzled', 'sawShot', 'sawDrop', 'alertNow', 'drewOnYou', 'partnerKnown', 'shift', 'office'] as const;
export type Need = typeof NEEDS[number];
/** Template tokens, resolved at pick time (a line whose token comes back null is simply not eligible). Written {name} in a line; {Name} capitalises the value.
 *    partner      his pair in a lockdown (leader / follower), else the nearest colleague he does not know to be down — by callsign
 *    victim       the man he watched Sam put down (W.sawAct) / saw held
 *    body         the body he found, else the one he heard called in
 *    missing      the first man the net has asked after and not raised (missedAt / missingRaised)
 *    room         the room HE stands in now (roomName: the clear plans' bounds + corridor / lobby / cubicles / car park)
 *    sawWhere     the room Sam was in when this man last had him in view, even faintly (gd.sightPos)
 *    heardWhere   the room the last small noise seemed to come from (H.smallWhere: the doorway it spilled through if not direct)
 *    route        his own patrol, prettified ('the corridor');  partnerRoute  {partner}'s
 *    post         the corridor junction somebody holds in this lockdown ('the east end'), else his own route
 *    door         a keyed door on his route (a locked LevelDoorDef within DOOR_ROUTE_M of his route's line) — null for the cubicle man
 *    caller       who is running the radio check right now (rollcallState.caller)
 *    checker / checked   the man walking a silent colleague's route right now (task checkOn), and whose route it is
 *    clearRoom    the room the lockdown pair is clearing / walking to now (its plan's door if the plan names no room)
 *    breakerRoom  the room the mains breaker is in (level.breaker) — where a man gets sent when the lights go
 *    checkEta     coarse time until the next radio check is due: 'any second now' / 'in a minute or so' / 'in a couple of minutes' / 'in N minutes'
 *    minutes      whole minutes since the last radio check was called ('one', 'two', …) — null before the first
 *    n            how many of them are on tonight, as a word (the roster: he does not know who is down unless he knows)
 *    up           how many he COUNTS as up right now, himself included, as a word: the roster less the men he knows to be down (knownDown) — the count
 *                 pedantry's exact number, the same knowledge the radio check's 'sound off' works from
 *    badge        his badge number: four digits off his callsign (badgeOf) — what a man proud to comply reads out to an 'auditor'
 *    code / padDoor   the four digits of the keypad door nearest his beat and what that door is called ('the office side door') — devices.ts; null on a level with
 *                 no keypad. Giving them (intel 'code') TEACHES Sam the code (game.ts interrogate → devices.ts learnCode), as giving the keyed door hands the key */
export const TOKENS = ['partner', 'victim', 'body', 'missing', 'room', 'sawWhere', 'heardWhere', 'route', 'partnerRoute', 'post', 'door', 'caller', 'checker', 'checked', 'clearRoom', 'breakerRoom', 'checkEta', 'minutes', 'n', 'up', 'badge', 'code', 'padDoor'] as const;
export type Token = typeof TOKENS[number];
/** the longest value each token can take (lintDialogue expands lines with these to check MAX_CHARS); callsigns: 'Lindqvist'; clearRoom's worst is a door name */
const TOKEN_WORST: Record<Token, string> = {
  partner: 'Lindqvist', victim: 'Lindqvist', body: 'Lindqvist', missing: 'Lindqvist', caller: 'Lindqvist', checker: 'Lindqvist', checked: 'Lindqvist',
  room: "the manager's office", sawWhere: "the manager's office", heardWhere: "the manager's office", breakerRoom: "the manager's office", clearRoom: 'the break room side door',
  route: 'the lobby loop', partnerRoute: 'the lobby loop', post: 'the cubicle door', door: 'the server room door',
  checkEta: 'in a couple of minutes', minutes: 'fifteen', n: 'three', up: 'three', badge: '4471', code: '7391', padDoor: 'the office side door',
};
/** …and with WORDS on, where the other levels' doors have names of their own (DOOR_NAMES_NOW): the longest of those (ROUTE_NAMES_NOW stays within 'the lobby loop': the 'routes' fact carries two) */
const TOKEN_WORST_NOW: Partial<Record<Token, string>> = { door: 'the phone shop back door' };
const tokenWorst = (): Record<Token, string> => w({ ...TOKEN_WORST, ...TOKEN_WORST_NOW }, TOKEN_WORST);
/** tokens that always resolve for a living man in a level (coverage lint counts only lines whose tokens are in here or guaranteed by the cell's K) */
const TOKENS_ALWAYS: Token[] = ['room', 'route', 'post', 'breakerRoom', 'checkEta', 'n', 'up', 'badge'];
/** …and the ones a knowledge level guarantees: a glimpse leaves sightPos, a sighting at least the fix or his own feet (gather's fallback); sawHurt names a victim (but may never have had Sam himself in view) */
const TOKENS_BY_K: Record<Knowledge, Token[]> = { none: [], heard: [], glimpsed: ['sawWhere'], saw: ['sawWhere'], sawHurt: ['victim'] };

// ---------------------------------------------------------------- the line table — DRAFT PLACEHOLDERS (see the header)
export interface Line {
  id: string;
  k: Knowledge | '*';          // knowledge cell ('*' = floor colour: any K, gated by needs) — the one axis the picker never widens
  a?: Band | 'mid+';           // agitation band (omitted = any; 'mid+' = mid or high)
  t?: Temperament;             // temperament (omitted = any)
  s: StageKey;                 // 1 reaction · 2 pressure · 3 nothing-left / refusal (INTEL takes the giving stages first) · 'x' exhausted
  text: string; needs?: Need[]; w?: number;
  only?: 'shift' | 'office';   // (WORDS) said only by a man that fact holds for — a gate beside `needs`, not in it: it is no colour and must not weigh like one
  now?: string; away?: string; // (WORDS) the line as it is said now · as it is said by anybody but the office's own staff (saidText)
  guide?: string;              // (WORDS.guide) …and as the writing guide has it (saidText: read only with that key up too)
  bare?: string;               // (WORDS) …and by a man who names nobody (DialogueCtx.nameless): the row without its {victim}
}
/** the words of a row as they are said to THIS man / by him: `text` with WORDS off; on, `bare` from a man who names nobody, `away` off the office's own staff, else `now`, else `text` */
function saidText(l: { text: string; now?: string; away?: string; bare?: string; guide?: string }, ctx: DialogueCtx): string { return !WORDS.on ? l.text : (ctx.nameless && l.bare) || (!ctx.facts.office && l.away) || wg(l.guide, undefined) || l.now || l.text; }
export const LINES: Line[] = [
  // ---- none: never knew you were there — startled, knows nothing (anchor case 1)
  { id: 'n1s', k: 'none', t: 'steady', s: 1, text: "Easy— easy. I'm not moving. Hands are where you can see them." },
  { id: 'n1n', k: 'none', t: 'nervy', s: 1, text: "Wh— who— okay. Okay okay okay. Don't. Please don't." },
  { id: 'n1h', k: 'none', t: 'hard', s: 1, text: "…That's a bad idea, friend. Mostly for you." },
  { id: 'n1a', k: 'none', s: 1, text: 'Where did you— there was nobody there. I checked. There was nobody.' },
  { id: 'n1f', k: 'none', a: 'mid+', s: 1, needs: ['floorUp'], text: "So it's real. They said weapons out and I thought someone sat on his radio." },
  { id: 'n2s', k: 'none', t: 'steady', s: 2, only: 'shift', text: "I don't know you. I walk {route} and I sign the sheet. That's the whole job." },
  { id: 'n2n', k: 'none', t: 'nervy', s: 2, text: "I haven't seen your face. I don't want to. I'm looking at the floor— see?" },
  { id: 'n2h', k: 'none', t: 'hard', s: 2, text: 'You want the tour, reception opens at eight.', away: 'You want the tour, buy a ticket.' },
  { id: 'n2a', k: 'none', s: 2, only: 'shift', text: "Whatever you're here for, it isn't me. I'm nights. I'm nobody." },
  { id: 'n3a', k: 'none', s: 3, only: 'shift', text: "That's it. That's all there is. I do nights and I go home." },
  { id: 'n3n', k: 'none', t: 'nervy', s: 3, only: 'office', text: "I don't KNOW anything— I fill the machine and I walk. That's me. That's all of me." },
  { id: 'n3h', k: 'none', t: 'hard', a: 'low', s: 3, w: 2, text: 'Nothing. You get nothing, and you knew that when you grabbed me.' },
  { id: 'nxa', k: 'none', s: 'x', only: 'shift', text: 'I told you. I just do nights.' },
  { id: 'nxb', k: 'none', s: 'x', text: "Same as before. I don't know. I still don't know." },
  { id: 'nxn', k: 'none', t: 'nervy', s: 'x', text: 'Please. My arm. I answered you.' },
  { id: 'nxh', k: 'none', t: 'hard', s: 'x', text: 'Ask again. Same answer.' },
  // ---- heard: knows someone is in the building, never saw who
  { id: 'h1s', k: 'heard', t: 'steady', s: 1, needs: ['heardSmall'], text: 'So that was you, by {heardWhere}. I wrote it off as the building settling.', now: 'So that was you, by {heardWhere}. I wrote it off as nothing.' },
  { id: 'h1n', k: 'heard', t: 'nervy', s: 1, text: 'I knew it. I KNEW I heard something. Nobody ever believes me.' },
  { id: 'h1h', k: 'heard', t: 'hard', s: 1, text: "Should've trusted my ears and come looking for you." },
  { id: 'h1a', k: 'heard', s: 1, only: 'shift', text: "Something's been off all night. So it's a someone. Fine." },
  { id: 'h1g', k: 'heard', s: 1, needs: ['heardShots'], w: 2, text: "Those were shots. That was you? …Who's down. Tell me who's down." },
  { id: 'h1b', k: 'heard', s: 1, needs: ['bodyKnown'], w: 2, text: "They found {body}. That was you. And now it's my turn, is it." },
  { id: 'h2s', k: 'heard', t: 'steady', s: 2, needs: ['partnerKnown'], only: 'office', text: '{Partner} is going to love this. I told him it was the vending machine.' },
  { id: 'h2n', k: 'heard', t: 'nervy', s: 2, text: "I called it in as nothing. I SAID nothing. They'll put that on me." },
  { id: 'h2h', k: 'heard', t: 'hard', s: 2, text: "You're loud, whoever you are. Loud gets found." },
  { id: 'h2a', k: 'heard', s: 2, only: 'shift', text: "I never saw you. Noises, that's all — and I'm not paid to chase noises." },
  { id: 'h3a', k: 'heard', s: 3, text: "I heard things. I didn't see things. That's the truth and it's all of it." },
  { id: 'h3h', k: 'heard', t: 'hard', a: 'low', s: 3, w: 2, text: "You've had your answer. It was no." },
  { id: 'hxa', k: 'heard', s: 'x', text: 'Noises. All I ever had was noises.' },
  { id: 'hxb', k: 'heard', s: 'x', text: "I've said it. Ears, not eyes." },
  // ---- glimpsed: a shape in the dark
  { id: 'g1s', k: 'glimpsed', t: 'steady', s: 1, text: 'Something moved, over in {sawWhere}. I told myself it was the light.' },
  { id: 'g1n', k: 'glimpsed', t: 'nervy', s: 1, text: 'You were right there. I looked RIGHT at you. Oh no. No no no.' },
  { id: 'g1h', k: 'glimpsed', t: 'hard', s: 1, text: 'Next time the torch stays on you.', now: 'Next time the light stays on you.' },
  { id: 'g1a', k: 'glimpsed', s: 1, text: "I saw— I don't know what I saw. You, I suppose. In {sawWhere}." },
  { id: 'g2a', k: 'glimpsed', s: 2, only: 'shift', text: "A shape. That's what goes in the book. A shape, about your size." },
  { id: 'g2n', k: 'glimpsed', t: 'nervy', a: 'mid+', s: 2, text: 'I nearly called it. Thumb on the button. I nearly— why didn\'t I.' },
  { id: 'g2h', k: 'glimpsed', t: 'hard', s: 2, text: 'Half a second sooner with the light and we\'d be talking the other way round.' },
  { id: 'g3a', k: 'glimpsed', s: 3, text: "Half a second of you in the dark. That's everything I've got." },
  { id: 'g3h', k: 'glimpsed', t: 'hard', a: 'low', s: 3, w: 2, text: 'No. Work it out yourself.' },
  { id: 'gxa', k: 'glimpsed', s: 'x', text: 'A shape. I keep telling you. A shape.' },
  { id: 'gxb', k: 'glimpsed', s: 'x', text: "That's twice you've asked and twice it's the same." },
  // ---- saw: had you plainly / hunted you
  { id: 's1s', k: 'saw', t: 'steady', s: 1, text: 'Everyone on this floor is looking for you. You do know that.', now: 'Every man here is looking for you. You do know that.' },
  { id: 's1n', k: 'saw', t: 'nervy', s: 1, text: "It's you. From {sawWhere}. Okay. Okay— I'm not doing anything. Look. Nothing." },
  { id: 's1p', k: 'saw', t: 'nervy', a: 'high', s: 1, w: 2, text: "They're coming— all of them— you heard the radio same as me—" },
  { id: 's1h', k: 'saw', t: 'hard', s: 1, text: "You. From {sawWhere}. You don't walk out of this building.", now: "You. From {sawWhere}. You don't walk out of here." },
  { id: 's1a', k: 'saw', s: 1, text: 'I had you. In {sawWhere}. I had you and I lost you.' },
  { id: 's1d', k: 'saw', s: 1, needs: ['drewOnYou'], w: 2, text: 'I put rounds your way and you still got behind me. …Fine. Fine.' },
  { id: 's2s', k: 'saw', t: 'steady', s: 2, text: 'Let go now and I count to sixty before I touch the radio. That offer is real.' },
  { id: 's2n', k: 'saw', t: 'nervy', s: 2, text: "What do you want— just say it— say it and I'll say yes—" },
  { id: 's2h', k: 'saw', t: 'hard', s: 2, text: "Squeeze all you like. I've had worse off my brother." },
  { id: 's2a', k: 'saw', s: 2, text: "You've got maybe a minute before someone walks round that corner. Use it." },
  { id: 's3a', k: 'saw', s: 3, text: "That's everything. Do what you're going to do." },
  { id: 's3h', k: 'saw', t: 'hard', a: 'low', s: 3, w: 2, text: 'From me? Nothing. Not a word.' },
  { id: 'sxa', k: 'saw', s: 'x', text: "I've said it all. Twice." },
  { id: 'sxb', k: 'saw', s: 'x', text: 'Still here. Still nothing new.' },
  // ---- sawHurt: watched you shoot / drop a colleague — agitated, hostile, names it (anchor case 2)
  { id: 'k1s', k: 'sawHurt', t: 'steady', s: 1, needs: ['sawShot'], text: "You shot {victim}. I watched you do it. Don't talk to me like we're talking." },
  { id: 'k1n', k: 'sawHurt', t: 'nervy', s: 1, needs: ['sawShot'], text: "{Victim}— is he— you didn't have to— he'd have let you walk past—" },
  { id: 'k1h', k: 'sawHurt', t: 'hard', s: 1, needs: ['sawShot'], text: '{Victim} had a name. Remember it. Somebody is going to ask you for it.', bare: 'He had a name. Somebody is going to make you learn it.' },
  { id: 'k1a', k: 'sawHurt', s: 1, needs: ['sawShot'], text: 'I saw you shoot {victim}. I saw it. Whatever you say next, I saw it.', bare: 'I saw you shoot him. I saw it. Whatever you say next, I saw it.' },
  { id: 'k1d', k: 'sawHurt', s: 1, needs: ['sawDrop'], text: "Is {victim} breathing? …Tell me he's breathing.", bare: "Is he breathing? …Tell me he's breathing." },
  { id: 'k1e', k: 'sawHurt', t: 'hard', s: 1, needs: ['sawDrop'], text: 'I saw what you did to {victim}. Try it from the front some time.', bare: 'I saw what you did to him. Try it from the front some time.' },
  { id: 'k1g', k: 'sawHurt', s: 1, w: 0.6, text: 'I saw what you did to {victim}. Get your arm off me.', bare: 'I saw what you did to him. Get your arm off me.' },   // (the one s1 line that names no particular deed: covers the reserved 'grab' / sawHeld kinds; weighted under the specific ones)
  { id: 'k2s', k: 'sawHurt', t: 'steady', s: 2, text: "What do you want from me? You've shown me what you are." },
  { id: 'k2n', k: 'sawHurt', t: 'nervy', s: 2, text: 'Okay! Okay. Anything. Just— not like {victim}. Please. Not like that.' },
  { id: 'k2h', k: 'sawHurt', t: 'hard', s: 2, needs: ['sawShot'], text: "Every man on this floor heard that. They're not coming to talk.", now: "Every man here heard that. They're not coming to talk." },
  { id: 'k2i', k: 'sawHurt', t: 'hard', s: 2, text: 'You put {victim} down in front of me and now you want a chat. No.', bare: 'You put him down in front of me and now you want a chat. No.' },
  { id: 'k2a', k: 'sawHurt', s: 2, text: '{Victim} first, then me — that the plan? Then get on with it.', bare: 'Him first, then me — that the plan? Then get on with it.' },
  { id: 'k3a', k: 'sawHurt', s: 3, text: "You've had all I've got. The rest you took off {victim}.", bare: "You've had all I've got. The rest you took off him." },
  { id: 'k3h', k: 'sawHurt', t: 'hard', s: 3, w: 2, text: 'No.' },
  { id: 'kxa', k: 'sawHurt', t: 'nervy', s: 'x', text: 'Please. I answered. Please.' },
  { id: 'kxb', k: 'sawHurt', s: 'x', text: "Nothing else. There's nothing else. Ask {victim}— oh. Right.", bare: "Nothing else. There's nothing else. Ask him— oh. Right." },
  { id: 'kxs', k: 'sawHurt', s: 'x', text: "I've nothing left to tell you and no reason left to lie to you." },
  { id: 'kxh', k: 'sawHurt', t: 'hard', s: 'x', text: 'Still no.' },
  // ---- floor colour: any knowledge, the needs do the gating
  { id: 'f2m', k: '*', t: 'steady', s: 2, needs: ['missingKnown'], w: 1.2, text: "{Missing} hasn't answered his radio. That was you as well, wasn't it." },
  { id: 'f2l', k: '*', t: 'hard', s: 2, needs: ['lockdown'], text: "Hear that? Pairs and doors. You're in a box now." },
  { id: 'f2k', k: '*', s: 2, needs: ['lockdown'], text: "It's locked down. Nobody walks alone and every door gets pulled to. Good luck." },
  { id: 'f2b', k: '*', t: 'hard', s: 2, needs: ['bodyCalled'], text: "I heard them call {body} in. I'm telling you nothing." },
  { id: 'f2c', k: '*', t: 'steady', s: 2, needs: ['bodyCalled'], text: "After {body} they said weapons out. Should've listened harder." },
  { id: 'f2f', k: '*', s: 2, needs: ['bodyFound'], text: 'I stood over {body} not long ago. I know exactly what you are.' },
  { id: 'f2o', k: '*', s: 2, needs: ['blackout'], text: 'The lights too? …Course it was you.' },
  { id: 'f2d', k: '*', t: 'nervy', s: 2, needs: ['dazzled'], text: "I still can't see straight. That flash— that was you too, wasn't it—" },
  { id: 'f2r', k: '*', s: 2, needs: ['rollcallLive'], only: 'shift', w: 2, text: "That's the check going now. I don't answer it, they come down {route}." },
  { id: 'fxl', k: '*', t: 'steady', s: 'x', needs: ['heldLong'], text: "My arm's gone dead. Whatever this is, finish it." },
  { id: 'fxn', k: '*', t: 'nervy', s: 'x', needs: ['heldLong'], text: "I can't feel my hand. Please. I've been good. I've answered everything." },
  { id: 'fxe', k: '*', a: 'high', s: 'x', text: "You're running out of floor. You know that. I can hear it in you." },
];

// ---------------------------------------------------------------- INTEL: the one useful thing, gated by what he plausibly knows
/** Kinds of useful thing, in the generator's order of preference: what is happening NOW that he can know first, then the standing facts. A future mission hook
 *  reads DialoguePick.kind. Never: anything about Sam he did not perceive, the drive before it is pulled. 'code' (devices.ts, G4): the keypad door's four
 *  digits — every man on nights knows them; live while the level has a pad and Sam has not got its code yet; SAID, it is learned (game.ts interrogate →
 *  learnCode). It ranks after the keyed door (a key opens three doors, the code one), so the corridor men still hand their key over first and the cubicle
 *  man — no keyed door on his beat — is the one who blurts the digits; the sticky-note pair (AMBIENT_PAIRS 'pin') says them out loud for anyone in earshot. */
export const INTEL_KINDS = ['checkOn', 'clearing', 'rollcallLive', 'blackout', 'door', 'code', 'rollcall', 'lockdownPosts', 'routes', 'missing', 'drive'] as const;
export type IntelKind = typeof INTEL_KINDS[number];
export interface IntelItem { kind: IntelKind; text: string; known: boolean; live: boolean; }
/** The comic SHAPE a hold's script plays (SCRIPTS, at the end of the file): its key also selects a shape-voiced variant of a useful thing where one is written. */
export type ShapeKey = 'pedant' | 'selfown' | 'folder' | 'ramble' | 'fan' | 'stoic' | 'con' | 'game' | 'menace';
export const SHAPES: ShapeKey[] = ['pedant', 'selfown', 'folder', 'ramble', 'fan', 'stoic', 'con', 'game', 'menace'];
/** the texts, by kind and by who says them: 'sc:<script id>' → 'shape:t' → 'shape' (the script's voice, when the hold plays one and a variant is written for it) → 't:k' (temperament ×
 *  knowledge) → 't' → '*:k' → '*' — plain facts; intelLead() puts the grudging '…Fine. ' / '…All right. ' in front where the man would not volunteer it (a
 *  shape-voiced text carries its own manner and takes no lead), and a knowledge-keyed variant lets the writing colour a fact by what he saw */
type IntelKey = Temperament | '*' | `${Temperament}:${Knowledge}` | `*:${Knowledge}` | ShapeKey | `${ShapeKey}:${Temperament}` | `sc:${string}`;
const INTEL_TEXT: Record<IntelKind, Partial<Record<IntelKey, string>>> = {
  checkOn:       { '*': "{Checker}'s walking {checked}'s route — he went quiet. He'll come past here.", nervy: "{Checker}'s out looking for {checked}— he went quiet— he'll walk right into us—", hard: "{Checker}'s walking {checked}'s route. This way. Soon." },
  clearing:      { '*': "They're clearing rooms off your last position. {ClearRoom} first.", hard: 'Rooms are being cleared. {ClearRoom} first. Then this one.' },
  rollcallLive:  { '*': "That's a check now. No answer from a man and {caller} sends someone round.", hard: "That's the check. I don't answer, {caller} sends a man. Here." },
  blackout:      { '*': 'Lights die, one of us goes to the breaker in {breakerRoom} — armed.', hard: 'Lights out means a man at the breaker, {breakerRoom}. Armed.' },
  door:          { '*': "{Door} is on a key. We all carry one. Mine's on my belt.", hard: '{Door} is keyed. We all carry one. Take mine and get out.',   // (and Sam DOES: game.ts interrogate → player.ts takeKey the moment this is said — EVERY variant must put the key on his person; gather only offers it while Guard.keys holds that door's)
                   'selfown:steady': "…Belt. The key's on my belt. Well played, I suppose.", 'selfown:nervy': "…belt. It's on my belt. Please don't make it a whole thing.",
                   'sc:selfown-s1': "…On my belt. The key's on my belt. Eleven years, for this.", 'sc:selfown-s2': '…Belt. Left side. Take it— you were going to anyway.', 'sc:selfown-s3': '…Belt clip. Under the hi-vis. Nicely done, I suppose.',
                   'sc:selfown-n2': '…This one. On my belt. I heard it as I said it. I HEARD it.', 'sc:selfown-n3': "…key. Belt, left side. I don't feel better. You said I would.",
                   con: "{Door}'s keyed; every belt carries one. Here— inspect mine.", fan: "{Door}'s keyed— key's on my belt. Do yours open anything? No?" },
  code:          { '*': '{PadDoor} is on a pad — {code}. Same four digits for all of us.', nervy: "The pad by {padDoor}— it's {code}— {code}— don't make me say it twice—", hard: '{PadDoor}: {code} on the pad. Now you know what I know.',   // (SAID = learned: game.ts interrogate → devices.ts learnCode. Never the word for a lock's metal opener after 'door' in these — dialogue-probes reads 'door … key' as a keyed door given)
                   con: '{PadDoor} takes {code} on the pad, sir. Logged monthly, changed never.', fan: 'The pad on {padDoor} is {code}— do YOU get codes, or is it all wire?' },
  rollcall:      { '*': 'Radio check {checkEta}. Miss it, they send a man down your route.', nervy: "A check— {checkEta}— I don't answer, somebody comes looking.", 'nervy:sawHurt': "The check's {checkEta}— {victim} won't answer it— then they ALL come—", hard: 'Radio check {checkEta}. Silence gets a man sent. Do the sums.',
                   con: 'Radio check {checkEta}, sir. No answer, a man walks that route. By the book.', fan: "Radio check's {checkEta}— miss it, they send someone. Do YOU have checks?" },
  lockdownPosts: { '*': "We're paired now. One man holds {post}. Nobody walks alone.", hard: 'Pairs. A man on {post}. Nobody alone — except you.' },
  routes:        { '*': "{N} of us tonight. I've got {route}, {partner} has {partnerRoute}.", nervy: "It's {n} of us— me on {route}, {partner} on {partnerRoute}— that's it—", hard: '{N}. Me, {route}. {Partner}, {partnerRoute}. Happy?',
                   con: '{N} on shift: I take {route}, {partner} {partnerRoute}. All logged, sir.', fan: "{N} of us— I do {route}, {partner} {partnerRoute}. What's YOUR route like?" },
  missing:       { '*': 'Nobody can raise {missing}. His route turns up empty, this all locks down.', hard: '{Missing} is off the air. His route comes up empty, we lock down.' },
  drive:         { '*': "Your rack dropped off the board. Somebody's already been sent to look at it.", hard: 'Your rack went dark on the board. A man is on his way to it.' },
};
/** (WORDS) the variants reworded, by the same keys, laid over INTEL_TEXT's while the switch is on (a man alone on a level has no 'all of us') */
const INTEL_NOW: Partial<Record<IntelKind, Partial<Record<IntelKey, string>>>> = { code: { '*': '{PadDoor} is on a pad — {code}. Same four digits every night.' } };
/** (WORDS.guide) …and the variants the writing guide reworded ('a man' for somebody of his own, 'round', a clause with no verb), laid over both with that key up */
const INTEL_GUIDE: Partial<Record<IntelKind, Partial<Record<IntelKey, string>>>> = {
  rollcallLive: { '*': "That's a check now. If one of us doesn't answer, {caller} sends someone over.", hard: "That's the check. If I don't answer, {caller} sends somebody here." },
  blackout: { hard: 'If the lights go out, somebody goes to the breaker in {breakerRoom}. Armed.' },
  rollcall: { hard: 'Radio check {checkEta}. No answer, they send somebody. Do the math.' },
  drive: { hard: "Your rack went dark on the board. Somebody's on his way to it." } };
const intelTable = (kind: IntelKind): Partial<Record<IntelKey, string>> => w({ ...INTEL_TEXT[kind], ...INTEL_NOW[kind], ...wg(INTEL_GUIDE[kind], undefined) }, INTEL_TEXT[kind]);
/** (WORDS) 'drive' off the office: what was taken there is no rack and hangs on no board (gather swaps it in) */
const DRIVE_AWAY: Partial<Record<Temperament | '*', string>> = { '*': "It's been missed already. Somebody's been sent to look.", hard: "It's been missed. A man is on his way to look." };
/** (WORDS.guide) …as the writing guide has it */
const DRIVE_AWAY_GUIDE: Partial<Record<Temperament | '*', string>> = { '*': "They already know it's gone. Somebody's been sent to look.", hard: "They know it's gone. Somebody's on his way to look." };
const driveAway = (): Partial<Record<Temperament | '*', string>> => wg({ ...DRIVE_AWAY, ...DRIVE_AWAY_GUIDE }, DRIVE_AWAY);
/** the text a man of temperament t and knowledge k gives for `kind` (the most specific variant written) — the plain fact, no shape */
export function intelText(kind: IntelKind, t: Temperament, k: Knowledge): string { const T = intelTable(kind); return T[`${t}:${k}`] ?? T[t] ?? T[`*:${k}`] ?? T['*'] ?? ''; }
/** the script's own / the shape-voiced variant of `kind` for a hold playing script `sc`, or null when none is written (then the plain fact is said, with the shape's / the man's lead) */
export function shapedIntelText(kind: IntelKind, sc: { id: string; shape: ShapeKey }, t: Temperament): string | null { const T = intelTable(kind); return T[`sc:${sc.id}`] ?? T[`${sc.shape}:${t}`] ?? T[sc.shape] ?? null; }
/** the checker's own words when HE is the man walking the silent colleague's route (gather swaps it in) */
const CHECKON_SELF_WAS = "I was sent round {checked}'s route — he'd gone quiet. Now I know why.", CHECKON_SELF_NOW = "I was sent to walk {checked}'s route — he'd gone quiet. Now I know why.";
const checkOnSelf = (): string => wg(CHECKON_SELF_NOW, CHECKON_SELF_WAS);
/** what goes in front of a given fact: a hard man never volunteers ('…Fine. ' — and only once rattled, givesAt); a steady one who has SEEN what Sam is gives it
 *  through his teeth ('…All right. '); a nervy one just spills it */
export function intelLead(t: Temperament, k: Knowledge): string { return t === 'hard' ? '…Fine. ' : t === 'steady' && (k === 'saw' || k === 'sawHurt') ? '…All right. ' : ''; }
/** …and in front of a PLAIN fact said inside a script of this shape (a shape with no entry takes intelLead's): the fan's aside, the audit's 'sir' */
const SHAPE_LEAD: Partial<Record<ShapeKey, string>> = { fan: 'Oh— and ', con: 'Sir: ', ramble: '—okay— ', folder: '' };
/** (WORDS) a fact behind a lead that runs on into it ('Oh— and ', '—okay— ') starts in lower case, unless it starts with 'I' or a man's name */
const runOn = (lead: string, fact: string) => WORDS.on && /[a-z—] $/.test(lead) ? fact.replace(/^(?!I\b|\{(?:Checker|Checked|Missing|Partner|Victim|Caller|Body)\})(\{?)([A-Z])/, (_m, b: string, c: string) => b + c.toLowerCase()) : fact;
/** four digits off a callsign — a badge number that is the same every night for the same man (the con reads it back to him) */
export function badgeOf(callsign: string): string { return String(1000 + hashStr('badge:' + callsign) % 9000); }
/** a small stable string hash (FNV-1a, 32 bit; math/dice.ts has it) — the scripts are DEALT, never rolled: the same man draws the same shape, probes replay to the letter */
export { hashStr };

// ---------------------------------------------------------------- names: rooms, routes, doors, numbers
type Rect = { name: string; x0: number; x1: number; z0: number; z1: number };
const roomRects = new SideMap<Level, { rooms: Rect[]; building: Rect; office: boolean }>('dialogue.roomRects');
/** the office level's open areas, which no clear plan bounds (level.ts: corridor z 10‥12.2, lobby x 4‥12, cubicle farm x 12‥28, break room x 28‥36, all z 12.2‥24; walls x 4‥36, z 4‥24) — used only when the level IS that office (its three route names); any other level is named by its own data (levelRects) */
const OFFICE_AREAS: Rect[] = [{ name: 'the corridor', x0: 4, x1: 36, z0: 10, z1: 12.2 }, { name: 'the lobby', x0: 4, x1: 12, z0: 12.2, z1: 24 }, { name: 'the cubicles', x0: 12, x1: 28, z0: 12.2, z1: 24 }, { name: 'the break room', x0: 28, x1: 36, z0: 12.2, z1: 24 }];
/** WHERE, for a line on the net ('— the mess', 'from outside the store': NOT a noun to put after 'in' — roomName below is that, and every dialogue template
 *  keeps it). A floor with NAMES OF ITS OWN (levelRects: the structure's rooms — the block, the depot, the warehouse… — and the level's `scenarios.places`) has
 *  no car park and no back offices: there a point is in one of the level's own rooms or places, or 'outside' the nearest of them (cues.ts — a line that names
 *  a place names a real one). The office, a level that names nothing, or the cues off: roomName. */
export function placeName(level: Level, p: Vec3): string { return (CUES.on ? ownName(level, p) : null) ?? roomName(level, p); }
/** a named rectangle of floor: `name` as a line says it ('the front hall'), `id` = the structure room's id (null: a place nobody holds, or one of the office's areas) */
export interface PlaceRect extends Rect { id: string | null }
/** the level the game was written on (its three patrol routes): the one floor the office's own room tables below, and chronicle.ts's, are true of */
export const isOffice = (level: Level) => ['corridor', 'cubicles', 'lobby_break'].every(n => level.routes.some(r => r.name === n));
const withThe = (n: string) => /^the |\d$/.test(n) ? n : `the ${n}`;
const ownRects = new SideMap<Level, PlaceRect[] | null>('dialogue.ownRects');
/** THE LEVEL'S OWN NAMES for its floor, first match wins: its structure's rooms (scenarios.roomClear), its clear plans' rooms, then the places nobody holds
 *  (scenarios.places — scene/scenarios.ts PlacesData). null on the office (its names are roomName's tables: the level the game was written on) and on a level
 *  that names nothing. */
export function levelRects(level: Level): PlaceRect[] | null {
  let R = ownRects.get(level);
  if (R === undefined) {
    R = null;
    if (!isOffice(level)) {
      const out: PlaceRect[] = [], add = (name: string, b: { x0: number; x1: number; z0: number; z1: number }, id: string | null) => { out.push({ name: withThe(name), id, x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 }); };
      for (const r of level.scenarios?.roomClear?.rooms ?? []) add(r.name, r.bounds, r.id);
      for (const cp of level.clearPlans ?? []) if (cp.bounds && cp.room && !out.some(r => r.name === withThe(cp.room!))) add(cp.room, cp.bounds, null);
      for (const a of level.scenarios?.places?.areas ?? []) add(a.name, a.bounds, null);
      for (const P of level.scenarios?.quiet?.spots ?? []) if (!out.some(r => r.name === withThe(P.place))) add(P.place, P.area, null);   // (a quiet mission's rooms by the names its block gives them — scene/scenarios.ts QuietData)
      if (out.length) R = out;
    }
    ownRects.set(level, R);
  }
  return R;
}
const rectDist = (r: Rect, p: Vec3) => Math.hypot(Math.max(r.x0 - p[0], 0, p[0] - r.x1), Math.max(r.z0 - p[2], 0, p[2] - r.z1));
/** a man this close to a named rectangle's edge is IN it for a line (metres): the rectangles are the floor inside the walls, so a man in a doorway — a wall's
 *  thickness — stands in none of them, and 'outside the hall' of a man on its threshold is the line being wrong, not the man */
export const PLACE_EDGE = 0.35;
/** … and the one a point is in, or the nearest (`d` metres off its edge; 0 = inside, or within PLACE_EDGE of it and inside no other) — null where levelRects is */
export function ownPlace(level: Level, p: Vec3): { rect: PlaceRect; d: number } | null {
  const R = levelRects(level); if (!R) return null;
  let best = R[0], bd = Infinity;
  for (const r of R) { const d = rectDist(r, p); if (d === 0) return { rect: r, d: 0 }; if (d < bd - 0.02) { bd = d; best = r; } }   // (a doorway between two of them: the first listed — a room of the structure before a place, indoors before a yard)
  return { rect: best, d: bd <= PLACE_EDGE ? 0 : bd };
}
/** (WORDS) a squad row's word for floor a man WATCHES from `from`: the level's own name for the floor at `p` where that is not the floor he stands on ('the
 *  hall', 'the yard') — null for his own floor or floor nobody named, where the row says what it is instead. The rows said a compass bearing ('watching
 *  south'), and the HUD has no compass. */
export function watchedPlace(level: Level, from: Vec3, p: Vec3): string | null {
  if (isOffice(level)) { const a = roomName(level, p); return a !== roomName(level, from) ? a : null; }
  const a = ownPlace(level, p); if (!a || a.d > 0) return null;
  const b = ownPlace(level, from); return b && b.d === 0 && b.rect === a.rect ? null : a.rect.name;
}
function ownName(level: Level, p: Vec3): string | null { const w = ownPlace(level, p); return !w ? null : w.d === 0 ? w.rect.name : `outside ${w.rect.name}`; }
/** WHERE A MAN STANDS, for a line that has to be true of the spot ('still up — in the front hall'; laststand.ts): the named rectangle he is INSIDE — one of
 *  the level's own (levelRects), on the office one of roomName's — or null (open ground the level has no word for: the caller says 'outside the …') */
export function placeIn(level: Level, p: Vec3): PlaceRect | null {
  const w = ownPlace(level, p); if (w) return w.d === 0 ? w.rect : null;
  if (!isOffice(level)) return null;
  roomName(level, p); for (const r of roomRects.get(level)!.rooms) if (p[0] >= r.x0 && p[0] <= r.x1 && p[2] >= r.z0 && p[2] <= r.z1) return { ...r, id: null };
  return null;
}
/** THE WAY A WALK COMES BY, for a line on the net ('coming to you through the north gallery'): the last of the level's own rooms or places the plain nav
 *  path from `a` to `b` crosses before the one it ends in — 'through the …' — or 'from the …' when that is the place the walk starts in (he walks straight in
 *  from where he stands). `into` = the name of the room the walk is bound for, when the caller knows it (b may lie on its threshold). null with the cues off,
 *  on the office and on a level that names none of its floor (levelRects), with no path, or when the walk crosses no named floor on its way. WORDS ONLY: the
 *  search is asked and thrown away — the man's own route is the fight AI's, which on plain floor is this same search (guards.ts goTo). */
export function wayName(level: Level, nav: { findPath(a: Vec3, b: Vec3, maxIter?: number): Vec3[] | null }, a: Vec3, b: Vec3, into: string | null = null): string | null {
  if (!CUES.on || !levelRects(level)) return null;
  const at = (p: Vec3) => { const w = ownPlace(level, p); return w && w.d === 0 ? w.rect.name : null; };
  const room = into ? withThe(into) : null, end = at(b), from = at(a), path = nav.findPath(a, b, 6000); if (!path) return null;
  if (from && (from === room || from === end)) return null;   // (he is already where he is called to: no way to name)
  let way: string | null = from, prev = a;
  walk: for (const q of path) {   // (the walk ends at the room he is called to or at the named floor the fix lies on, whichever it meets first — a fix out on a gallery is never the way to itself)
    const n = Math.max(1, Math.ceil(v3.dist(prev, q) / 0.5));
    for (let i = 1; i <= n; i++) { const r = at(v3.lerp(prev, q, i / n)); if (r && (r === room || r === end)) break walk; if (r) way = r; }
    prev = q;
  }
  return !way ? null : way === from ? `from ${way}` : `through ${way}`;
}
/** every rectangle placeIn answers by: the level's own (levelRects), on the office roomName's tables (no ids) — for a reader of the lines (the QA commander) */
export function placeRects(level: Level): PlaceRect[] {
  const R = levelRects(level); if (R) return R; if (!isOffice(level)) return [];
  roomName(level, [0, 0, 0]); return roomRects.get(level)!.rooms.map(r => ({ ...r, id: null }));
}
const OFFICE_WALLS: Rect = { name: 'inside', x0: 4, x1: 36, z0: 4, z1: 24 };
/** what a level that names none of its floor is called in a line ('in the building', 'by the building'): never a room of the office's */
const NAMELESS = 'the building';
/** The room a floor point is in, as the men would say it. ON THE OFFICE (its three route names): the clear plans' rooms (level.ts bounds) and the mission's
 *  server room, then the corridor, the lobby, the cubicle floor, the break room; anywhere else inside the walls 'the back offices', outside them 'the car
 *  park'. ON ANY OTHER LEVEL those words are not its own (the registry's captor 'holding the server room' — its mission's reach area — on a floor with no
 *  server room): there it is the level's own name for the spot (levelRects: its structure's rooms and its `scenarios.places`), 'outside' the nearest of them,
 *  or — a level that names nothing — 'this floor'. */
export function roomName(level: Level, p: Vec3): string {
  let R = roomRects.get(level);
  if (!R) {
    const rooms: Rect[] = [], office = isOffice(level);
    for (const cp of level.clearPlans ?? []) if (cp.bounds && cp.room && !rooms.some(r => r.name.endsWith(cp.room!))) rooms.push({ name: /^the /.test(cp.room) ? cp.room : `the ${cp.room}`, ...cp.bounds });
    const QS = level.scenarios?.quiet?.spots;   // (a quiet mission's places by their own names — scene/scenarios.ts QuietData: its `mission` is one of them, and no 'server room')
    if (QS) { for (const P of QS) if (!rooms.some(r => r.name === P.place)) rooms.push({ name: P.place, ...P.area }); }
    else { const S = level.mission.serverRoom; if (!rooms.some(r => /server/.test(r.name))) rooms.push({ name: 'the server room', ...S }); }
    let building = OFFICE_WALLS;
    if (office) rooms.push(...OFFICE_AREAS);
    else { building = { name: 'inside', x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity }; for (const r of level.routes) for (const q of r.points) { building.x0 = Math.min(building.x0, q[0] - 3); building.x1 = Math.max(building.x1, q[0] + 3); building.z0 = Math.min(building.z0, q[2] - 3); building.z1 = Math.max(building.z1, q[2] + 3); } }   // (the cues off: another level by the office's table, as it was — its clear-plan rooms, its mission's 'server room', and a footprint from its routes)
    R = { rooms, building, office }; roomRects.set(level, R);
  }
  if (!R.office && CUES.on) { const w = ownPlace(level, p); return w ? w.rect.name : NAMELESS; }   // (a noun, for 'in …': the place he is in, else the nearest the level names — never 'outside …' here)
  for (const r of R.rooms) if (p[0] >= r.x0 && p[0] <= r.x1 && p[2] >= r.z0 && p[2] <= r.z1) return r.name;
  const B = R.building; if (p[0] >= B.x0 && p[0] <= B.x1 && p[2] >= B.z0 && p[2] <= B.z1) return 'the back offices';   // inside the walls but in no named rectangle (a partition's thickness): near enough
  return 'the car park';
}
const ROUTE_NAMES: Record<string, string> = { corridor: 'the corridor', cubicles: 'the cubicles', lobby_break: 'the lobby loop' };
/** (WORDS) the other levels' route ids as a man would say where he walks ('the laneW', 'the sentry a' is the file's word, not his) */
const ROUTE_NAMES_NOW: Record<string, string> = { laneW: 'the west lane', laneE: 'the east lane', clerk: 'the office', north: 'the north side', south: 'the south side', east: 'the east side', sentry_a: 'the west post', sentry_b: 'the east post', ops: 'the ops room', walker: 'the block', fuel: 'the east gate', mast: 'the mast yard', bunk: 'the bunks', teahouse: 'the tea house', watchman: 'the street end', counting: 'the counting room', counting_b: 'the counting room', yard_round: 'the yard', yard_round_b: 'the yard', south_b: 'the south side', north_b: 'the north side', east_b: 'the east side', cook: 'the cook fire', cook_b: 'the cook fire', roundW: 'the west round', roundE: 'the east round' };
/** (WORDS.guide) a patrol route is a loop, not a 'round'; 'armory' as the rest of the game spells it */
const ROUTE_NAMES_GUIDE: Record<string, string | undefined> = { roundW: 'the west loop', roundE: 'the east loop' }, DOOR_NAMES_GUIDE: Record<string, string | undefined> = { armoury_radio: 'the armory side door' };
export function routeName(level: Level, routeI: number): string { const n = level.routes[routeI]?.name ?? 'route'; return ROUTE_NAMES[n] ?? (WORDS.on ? wg(ROUTE_NAMES_GUIDE[n], undefined) ?? ROUTE_NAMES_NOW[n] : undefined) ?? `the ${n.replace(/_/g, ' ')}`; }
const DOOR_NAMES: Record<string, string> = { server: 'the server room door', manager: "the manager's door", storage: 'the storage door', conference: 'the conference door', breakroom_n: 'the break room door', breakroom_w: 'the break room side door', breakroom_ext: 'the outside door', fire_exit: 'the fire exit', server_manager: 'the office side door' };   // (the keypad door — {padDoor})
/** (WORDS) …and their door ids ('the pharm back door', 'the fence e door') */
const DOOR_NAMES_NOW: Record<string, string> = { pharm_back: 'the pharmacy back door', pharm_front: 'the pharmacy front door', phone_back: 'the phone shop back door', fence_e: 'the east fence gate', office_garage: 'the garage side door', armoury_radio: 'the armoury side door' };
function doorName(n: string): string { return DOOR_NAMES[n] ?? (WORDS.on ? wg(DOOR_NAMES_GUIDE[n], undefined) ?? DOOR_NAMES_NOW[n] : undefined) ?? `the ${n.replace(/_/g, ' ')} door`; }
const NUM_WORDS = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen'];
function numWord(n: number): string { return NUM_WORDS[n] ?? String(n); }
/** metres within which a keyed door's frame counts as ON a route's line (server / manager / storage stand ~1.1 m off the corridor line; the cubicle loop never comes within 3 m of one) */
const DOOR_ROUTE_M = 2.5;
function distToRoute(pts: Vec3[], p: Vec3): number {
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]; const abx = b[0] - a[0], abz = b[2] - a[2]; const L2 = abx * abx + abz * abz;
    const t = L2 > 1e-6 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[2] - a[2]) * abz) / L2)) : 0;
    best = Math.min(best, Math.hypot(a[0] + abx * t - p[0], a[2] + abz * t - p[2]));
  }
  return best;
}
/** the keyed door nearest this man's route line, within DOOR_ROUTE_M — by its authored lock (a keep kicked out since is still 'the keyed door' to him) */
function keyedDoorOn(g: Game, gd: Guard): Door | null {
  const pts = g.level.routes[gd.routeI]?.points; if (!pts?.length) return null;
  let best: Door | null = null, bd = DOOR_ROUTE_M;
  for (const d of g.doors.list) { if (!d.def.locked || g.devices?.padOf(d)) continue; const dd = distToRoute(pts, d.frameCentre); if (dd < bd) { bd = dd; best = d; } }   // (a keypad door is on a pad, not a key: it is nobody's 'mine's on my belt' — devices.ts)
  return best;
}
/** …as the men call it ('the server room door'), or null */
export function keyedDoorOnRoute(g: Game, gd: Guard): string | null { const d = keyedDoorOn(g, gd); return d ? doorName(d.def.name) : null; }
/** coarse words for the seconds until the next radio check (deliberately vague: he knows the rhythm, not the clock) */
export function etaWords(secs: number): string { return secs <= 20 ? 'any second now' : secs <= 75 ? 'in a minute or so' : secs <= 150 ? 'in a couple of minutes' : secs <= 900 ? `in ${numWord(Math.round(secs / 60))} minutes` : 'before long'; }   // (past a quarter of an hour nobody on nights is counting: 'before long')

// ---------------------------------------------------------------- the context: everything the picker needs, read off the game once per exchange
export interface DialogueCtx {
  who: string; k: Knowledge; a: number; band: Band; t: Temperament;
  why: string[];                                   // the agitation terms, for the panel / probes
  facts: Partial<Record<Need, boolean>>;
  tokens: Partial<Record<Token, string | null>>;
  /** {room} is a name of the level's own, not the office's (ROOM_MENACE is the office's furniture: no entry applies) */ ownRooms?: boolean;
  /** (WORDS) he names nobody: a defender's mates go by the TEAM's labels ('Tango 2'), which are not his words — {partner} {victim} {body} {missing} are null and a row says its `bare` */ nameless?: boolean;
  intel: IntelItem[];                              // in INTEL_KINDS order, known / live evaluated
  time: number;
  recent: Map<string, number> | null;              // line id → game time anybody last said it (floor-wide staleness), null for synthetic contexts
}
const recentByGame = new SideMap<object, Map<string, number>>('dialogue.recentByGame');
/** seconds within which a line another man said counts as stale for everybody (× RECENT_W) */
const RECENT_SECS = 90, RECENT_W = 0.25;

/** does a fact stamped on the net at game time T reach a man held since `heldSince` (heldSinceOf; -1 = free): yes if he was not held then (a forearm across the throat is not when you follow the chatter in your ear) */
function heardOnNet(heldSince: number, T: number): boolean { return T >= 0 && (heldSince < 0 || T <= heldSince + 0.5); }
/** the first colleague the net has asked after by name and not raised (guards.ts updateRollcall / partnerWatch stamp missedAt; the route walk sets missingRaised) — as far as THIS man followed it */
function missingKnownTo(g: Game, gd: Guard): Guard | null { const hs = heldSinceOf(g, gd); return g.guards.find(x => x !== gd && (x.missedAt >= 0 || x.missingRaised) && heardOnNet(hs, x.missedAt >= 0 ? x.missedAt : 0)) ?? null; }
/** the men this man KNOWS to be down (he watched it, found him, heard him called in, or heard the net report him off his route) — everyone else is, to him, at his post */
function knownDown(g: Game, gd: Guard): Set<string> {
  const W = gd.witness; const s = new Set<string>();
  if (W.sawAct) s.add(W.sawAct.victim); if (W.sawBody) s.add(W.sawBody.victim); if (W.calledToBody) s.add(W.calledToBody.victim); if (W.sawHeld) s.add(W.sawHeld.who);
  for (const x of g.guards) if (x !== gd && x.missingRaised) s.add(x.callsign);
  return s;
}
/** the roster he counts from: the level's own men (a spawned unit — the showcase's operatives and hostiles — is nobody on his shift) */
function staffCount(g: Game): number { let n = 0; for (const x of g.guards) if (!x.unit) n++; return Math.max(1, n); }
function partnerOf(g: Game, gd: Guard): Guard | null {
  const down = knownDown(g, gd);   // dead or alive to the world, a man he does not KNOW to be down is, as far as he is concerned, still on his route — and one he watched drop is nobody's partner any more
  if (gd.leader && gd.leader !== gd && !down.has(gd.leader.callsign)) return gd.leader;
  const mate = (x: Guard) => !WORDS.on || (x.team === gd.team && !x.unit === !gd.unit);   // (his own side and his own kind: a staff man's colleague is no spawned unit, a unit's no man of the shift, and nobody's is one of Sam's)
  const follower = g.guards.find(x => x !== gd && x.leader === gd && !down.has(x.callsign) && mate(x)); if (follower) return follower;
  let best: Guard | null = null, bd = Infinity;
  for (const x of g.guards) { if (x === gd || down.has(x.callsign) || !mate(x)) continue; const d = v3.distXZ(x.char.pos, gd.char.pos); if (d < bd) { bd = d; best = x; } }
  return best;
}
/** since when this man counts as HELD for the engine's purposes: the hold's own clock while Sam has him (Guard.held.since — the grab owns it, presses never move it),
 *  else the sandbox stand-in for a man nobody holds — talk.heldSince while that exchange is live (the last press within HOLD_LAPSE_SECS, or none yet since the
 *  stamp) — else -1 */
export function heldSinceOf(g: Game, gd: Guard): number {
  if (gd.held) return gd.held.since;
  const talk = gd.talk; return talk.heldSince >= 0 && (talk.lastT < talk.heldSince || g.time - talk.lastT <= HOLD_LAPSE_SECS) ? talk.heldSince : -1;
}

/** Read the game into a DialogueCtx for this man (the only function past the axes that touches Game). */
export function gather(g: Game, gd: Guard): DialogueCtx {
  const W = gd.witness, H = W.heard, L = g.level, R = rollcallState(g), lvl = escalationOf(g);
  const k = knowledgeOf(g, gd); const { a, why } = agitationTerms(g, gd); const band = bandOf(a); const t = temperamentOf(gd);
  const hs = heldSinceOf(g, gd); const held = hs >= 0 ? g.time - hs : 0;
  // tokens
  const partner = partnerOf(g, gd);
  const missingMan = missingKnownTo(g, gd);
  const checker = g.guards.find(x => x.state !== 'dead' && x.task?.kind === 'checkOn') ?? null;
  const checkTask = checker?.task?.kind === 'checkOn' ? checker.task : null;
  const postMan = g.guards.find(x => x.state !== 'dead' && x.post) ?? null;
  const keyed = keyedDoorOn(g, gd);   // the keyed door on his beat — {door}, and (with its key still on his belt) the one useful thing 'door'
  const pad = g.devices?.padNear(gd.char.pos) ?? null;   // the keypad door nearest him — {code} / {padDoor}, and the useful thing 'code' while Sam has not got it (devices.ts)
  const nextAt = R.nextAt >= 0 ? R.nextAt : g.time + (lvl >= 1 ? 45 : 90);
  const tokens: Partial<Record<Token, string | null>> = {
    partner: partner?.callsign ?? null,
    victim: W.sawAct?.victim ?? W.sawHeld?.who ?? null,
    body: W.sawBody?.victim ?? W.calledToBody?.victim ?? null,
    missing: missingMan?.callsign ?? null,
    room: roomName(L, gd.char.pos),
    sawWhere: gd.sightT >= 0 ? roomName(L, gd.sightPos) : gd.lastSeenT >= 0 || W.alertedBy === 'sight' ? roomName(L, gd.lastKnown ?? gd.char.pos) : null,   // (a scripted man's sighting or a bump — squad.ts perceive — stamps lastSeenT and the fix without sightPos: where he had him is the fix, else where he stands)
    heardWhere: H.small > 0 && H.smallWhere ? roomName(L, H.smallWhere) : null,
    breakerRoom: roomName(L, L.breaker.pos),
    route: routeName(L, gd.routeI),
    partnerRoute: partner ? routeName(L, partner.routeI) : null,
    post: postMan?.post ? `the ${postMan.post.name}` : routeName(L, gd.routeI),
    door: keyed ? doorName(keyed.def.name) : null,
    caller: R.caller && R.caller !== gd ? R.caller.callsign : null,   // (himself calling it while held cannot happen: a held man is off the caller rota once the grab lands)
    checker: checker && checker !== gd ? checker.callsign : null,      // (the checker himself gets CHECKON_SELF, which names only {checked})
    checked: checkTask ? checkTask.who.callsign : null,
    clearRoom: g.clearing && g.clearing.stage !== 'done' && g.clearing.cur ? (g.clearing.cur.room ? (/^the /.test(g.clearing.cur.room) ? g.clearing.cur.room : `the ${g.clearing.cur.room}`) : doorName(g.clearing.cur.door)) : null,
    checkEta: R.stage !== 'idle' ? 'any second now' : etaWords(nextAt - g.time),
    minutes: R.checks > 0 ? numWord(Math.max(1, Math.round((g.time - R.t0) / 60))) : null,
    n: numWord(staffCount(g)),
    up: numWord(Math.max(1, staffCount(g) - [...knownDown(g, gd)].filter(n => !g.civilians.some(c => c.callsign === n)).length)),   // (himself included: he is plainly still up, whatever the arm round his neck implies; a civilian's body he found is not one of the shift)
    badge: badgeOf(gd.callsign),
    code: pad?.def.code ?? null,
    padDoor: pad ? doorName(pad.door.def.name) : null,
  };
  const nameless = defenderWords(gd); if (nameless) tokens.partner = tokens.victim = tokens.body = tokens.missing = null;
  // facts
  const shift = gd.team === 'guard' && !gd.unit;
  const facts: Partial<Record<Need, boolean>> = {
    floorUp: lvl >= 1, lockdown: lvl >= 2, episode: g.alarm.episode && !g.quietUtility,
    heardSmall: H.small > 0 && !!H.smallWhere, heardShots: H.shots > 0, heardBang: H.kick + H.bang > 0,
    bodyFound: !!W.sawBody, bodyCalled: !!W.calledToBody && !W.sawBody, bodyKnown: !!(W.sawBody || W.calledToBody),
    missingKnown: !!missingMan, blackout: g.blackout.active, heldLong: held >= HELD_LONG_SECS,
    rollcallLive: R.stage !== 'idle', dazzled: W.dazzled > 0,
    sawShot: W.sawAct?.kind === 'shot', sawDrop: !!W.sawAct && W.sawAct.kind !== 'shot' && W.sawAct.kind !== 'grab',
    alertNow: gd.state === 'alert', drewOnYou: gd.weapon.spent > 0, partnerKnown: !!partner,
    shift: !WORDS.on || shift, office: !WORDS.on || (shift && isOffice(L)),
  };
  // intel: live = true of the world now; known = he could plausibly know it (routine, or it went over the net while he was free to listen)
  const txt = (kind: IntelKind) => intelText(kind, t, k);
  const intel: IntelItem[] = [
    { kind: 'checkOn', text: checker === gd ? checkOnSelf() : txt('checkOn'), live: !!checkTask && checkTask.who !== gd, known: !!checkTask && (checker === gd || heardOnNet(hs, checkTask.t0)) },
    { kind: 'clearing', text: txt('clearing'), live: lvl >= 2 && !!g.clearing && g.clearing.stage !== 'done' && g.clearing.a !== gd && g.clearing.b !== gd, known: heardOnNet(hs, g.alarm.raisedAt) },   // (the order that dealt the clear went out with the raise: guards.ts raiseEscalation → planClears)
    { kind: 'rollcallLive', text: txt('rollcallLive'), live: R.stage !== 'idle' && !!R.caller && R.caller !== gd, known: true },
    { kind: 'blackout', text: txt('blackout'), live: g.blackout.active, known: true },
    { kind: 'door', text: txt('door'), live: !!keyed && gd.keys.has(keyed.lockId), known: true },   // (its key on his belt — 'mine's on my belt', and Sam takes it: player.ts takeKey empties Guard.keys, so it is never true of him twice, nor of a man whose route carries no key to it)
    { kind: 'code', text: txt('code'), live: !!pad && !g.player.codes.has(pad.def.name), known: true },   // (every man on nights knows the pad; once Sam has the code it is no longer a useful thing — nobody gives it twice)
    { kind: 'rollcall', text: txt('rollcall'), live: !g.quietUtility && g.aiEnabled && (!WORDS.on || !!partner), known: true },   // (no checks run under the tour or with the AI off: then it is not true that one is due — nor, WORDS, of a man with nobody left to call one or be sent)
    { kind: 'lockdownPosts', text: txt('lockdownPosts'), live: lvl >= 2 && !!postMan, known: heardOnNet(hs, g.alarm.raisedAt) || postMan === gd },
    { kind: 'routes', text: txt('routes'), live: !!partner, known: true },
    { kind: 'missing', text: txt('missing'), live: !!missingMan && lvl < 2, known: !!missingMan },
    { kind: 'drive', text: facts.office ? txt('drive') : driveAway()[t] ?? driveAway()['*']!, live: g.mission.pulled && g.mission.sweepAt < 0 && takeTold(g), known: true },   // (the rack check went out over the radio — mission.ts sendRackCheck — but Mission keeps no time for it, so this one net fact is not hold-gated: flavour, last in line; a Mission.sweptAt would gate it like the errand)
  ];
  if (!facts.shift) for (const it of intel) it.live = false;   // (WORDS: the routine is the shift's to know — a spawned unit has none of it to give)
  let recent = recentByGame.get(g); if (!recent) { recent = new Map(); recentByGame.set(g, recent); }
  return { who: gd.callsign, k, a, band, t, why, facts, tokens, ownRooms: CUES.on && !isOffice(L), nameless, intel, time: g.time, recent };
}

// ---------------------------------------------------------------- the picker (pure over a DialogueCtx + the man's Talk state)
export interface DialoguePick {
  text: string; id: string;                        // the resolved line and its id ('intel:<kind>' for a generated one, '<script>:<stage>' for a script beat)
  kind: IntelKind | null;                          // the useful thing given, if this exchange gave one (a mission hook may consume it)
  stage: StageKey; stageN: number;                 // the stage this exchange was (1‥3, then 'x'; stageN counts on: 4, 5, …)
  cell: string; k: Knowledge; band: Band; t: Temperament;   // the cell it was picked for
  lineK: Knowledge | '*';                          // the picked line's own knowledge key (never above k — the QA soak asserts it)
  widened: '' | 't' | 'a' | 'repeat';              // how far the pool had to be widened to find anything ('' = exact cell; a script beat is always '')
  after: string | null;                            // Sam's rejoinder once this answer is down (interrogate queues it on Hold.after; the key remark outranks it), or null
  script: string | null; shape: ShapeKey | null;   // the script this hold plays and its shape (null = the pools: sawHurt, the fifth press on, nothing fitted)
}
const TOKEN_RE = /\{([A-Za-z]+)\}/g;
/** the tokens a text uses, as Token keys (lower-cased first letter) */
export function tokensIn(text: string): string[] { const out: string[] = []; for (const m of text.matchAll(TOKEN_RE)) out.push(m[1][0].toLowerCase() + m[1].slice(1)); return out; }
/** expand {tokens} from the table ({Name} capitalises); null if any comes back empty */
export function expand(text: string, tokens: Partial<Record<string, string | null>>): string | null {
  let ok = true;
  const out = text.replace(TOKEN_RE, (_m, raw: string) => { const key = raw[0].toLowerCase() + raw.slice(1); const v = tokens[key]; if (!v) { ok = false; return ''; } return raw[0] !== key[0] ? v[0].toUpperCase() + v.slice(1) : v; });
  return ok ? out : null;
}
export function stageKeyOf(n: number): StageKey { return n <= 1 ? 1 : n === 2 ? 2 : n === 3 ? 3 : 'x'; }
/** Is stage `s` (the stageN-th exchange) one this man GIVES the useful thing at: a giving stage for his temperament and heat (givesAt), or the first 'nothing
 *  left' press of a man who would give and never has. The one test both pickLine and Sam's peek (peekGive) go by, so the question and the answer agree. */
function givingStage(t: Temperament, band: Band, s: StageKey, stageN: number, givenNone: boolean): boolean {
  const gives = givesAt(t, band);
  return gives.includes(s) || (s === 'x' && givenNone && gives.length > 0 && stageN === 4);
}
function lineMatches(l: Line, k: Knowledge, band: Band, t: Temperament, s: StageKey, useT: boolean, useA: boolean): boolean {
  if (l.s !== s) return false;
  if (l.k !== '*' && l.k !== k) return false;
  if (useT && l.t && l.t !== t) return false;
  if (useA && l.a) { if (l.a === 'mid+') { if (band === 'low') return false; } else if (l.a !== band) return false; }
  return true;
}
function needsHold(l: Line, facts: Partial<Record<Need, boolean>>): boolean { return (!WORDS.on || !l.only || !!facts[l.only]) && (!l.needs || l.needs.every(n => !!facts[n])); }
/** The pending useful things: true now, known to him, not yet given, in the order he would give them — the script's pinned kind first (the self-own is BUILT
 *  round the keyed door), then INTEL_KINDS' — each with the text he would say: the shape's own wording where one is written (no lead: it carries its manner),
 *  else the plain fact behind the shape's / the man's lead-in. Items whose tokens do not resolve are simply not pending. */
export function pendingIntel(ctx: DialogueCtx, talk: Talk, sc: Script | null = null): { kind: IntelKind; text: string }[] {
  const out: { kind: IntelKind; text: string }[] = [];
  const order: readonly IntelKind[] = sc?.pin ? [sc.pin, ...INTEL_KINDS.filter(k => k !== sc.pin)] : INTEL_KINDS;
  for (const kind of order) {
    const it = ctx.intel.find(i => i.kind === kind); if (!it || !it.live || !it.known || talk.given.has(kind)) continue;
    const own = kind === 'checkOn' && it.text === checkOnSelf();   // (the checker's own words stay his own whatever the shape)
    const shaped = sc && !own ? shapedIntelText(kind, sc, ctx.t) : null;
    const lead = shaped ? '' : sc && SHAPE_LEAD[sc.shape] !== undefined && !(ctx.t === 'hard') ? SHAPE_LEAD[sc.shape]! : intelLead(ctx.t, ctx.k);   // (a hard man's '…Fine. ' survives any shape: he never volunteers)
    const text = expand(lead + runOn(lead, shaped ?? it.text), ctx.tokens); if (!text) continue;
    out.push({ kind, text });
  }
  return out;
}
/** The first pending useful thing (pendingIntel) — or null. */
export function intelFor(ctx: DialogueCtx, talk: Talk, sc: Script | null = null): { kind: IntelKind; text: string } | null { return pendingIntel(ctx, talk, sc)[0] ?? null; }
/** The rambler's stream swallows a giving stage (RAMBLE_SWALLOWS): at his stage 2, and only when exactly ONE thing is pending — it lands at 3 instead, so the
 *  dud costs Sam a press and never an item (two things pending: he blurts both like any nervy man; none: the dud needs no help). Peek and pick share it. */
function swallowed(sc: Script | null, s: StageKey, ctx: DialogueCtx, talk: Talk): boolean {
  return !!sc && sc.shape === 'ramble' && RAMBLE_SWALLOWS > 0 && s === 2 && ctx.t === 'nervy' && pendingIntel(ctx, talk, sc).length === 1;
}
/** One exchange: advance the man's stage, pick the line for (his cell × that stage), mark it said. `rnd` decides among the pool (seeded by the caller for
 *  replayable soaks / probes). Never returns a line keyed to a knowledge level other than his own. The hold's SCRIPT first (scriptFor: dealt at the first
 *  exchange, kept for the hold, live while his knowledge is still one it was written for): the useful thing at a giving stage — worded by the shape — with the
 *  beat's `take` as Sam's rejoinder, else the beat's own answer with its `after`; presses past the fourth, a beat whose token went null, and a man with no
 *  script go to the pools: a dry cell widens temperament, then agitation, at the staged presses, and at 'nothing left' repeats his own brush-offs (least-said
 *  first) before borrowing anyone else's. */
export function pickLine(ctx: DialogueCtx, talk: Talk, rnd: () => number): DialoguePick {
  const sc0 = scriptFor(ctx, talk);
  const stageN = talk.stage + 1; const s = stageKeyOf(stageN);
  talk.stage = stageN; talk.presses++; talk.lastT = ctx.time;
  const cell = `${ctx.k}·${ctx.band}·${ctx.t}`;
  const sc = sc0 && stageN <= 4 && scriptLive(sc0, ctx) ? sc0 : null;
  const beat = sc ? beatFor(sc, s, ctx) : null;
  const base = { stage: s, stageN, cell, k: ctx.k, band: ctx.band, t: ctx.t, script: sc?.id ?? null, shape: sc?.shape ?? null };
  const sayable = (text: string | undefined) => text && REJOINDERS ? expand(text, ctx.tokens) : null;
  // the giving stages: the INTEL generator first (a late press still gets the one useful thing if he never gave one and now would)
  if (givingStage(ctx.t, ctx.band, s, stageN, talk.given.size === 0) && !swallowed(sc, s, ctx, talk)) {
    const it = intelFor(ctx, talk, sc);
    if (it) { talk.given.add(it.kind); const id = `intel:${it.kind}`; talk.said.add(id); talk.last = { id, cell, stage: String(s), kind: it.kind }; return { ...base, text: it.text, id, kind: it.kind, lineK: ctx.k, widened: '', after: sayable(beat?.take) }; }
  }
  // the script's own beat for this press
  if (sc && beat) {
    const h = himOf(beat, ctx);
    if (h) { const id = `${sc.id}:${String(s)}`; talk.said.add(id); talk.saidN.set(id, (talk.saidN.get(id) ?? 0) + 1); talk.last = { id, cell, stage: String(s), kind: null }; return { ...base, text: h.text, id, kind: null, lineK: h.k, widened: '', after: sayable(beat.after) }; }
  }
  // the pool for this cell and stage: exact, else any temperament, else any agitation too — never another man's knowledge
  const eligible = (useT: boolean, useA: boolean, allowSaid: boolean) => {
    const out: { l: Line; text: string; w: number }[] = [];
    for (const l of LINES) {
      if (!lineMatches(l, ctx.k, ctx.band, ctx.t, s, useT, useA) || !needsHold(l, ctx.facts)) continue;
      if (!allowSaid && talk.said.has(l.id)) continue;
      const text = expand(saidText(l, ctx), ctx.tokens); if (!text) continue;
      let w = (l.w ?? 1) * (l.needs?.length ? 1.6 : 1) * (l.t === ctx.t ? 1.5 : 1) * (l.a ? 1.3 : 1) * (l.k !== '*' ? 1.15 : 1);   // specific beats generic
      const rt = ctx.recent?.get(l.id); if (rt !== undefined && ctx.time - rt < RECENT_SECS) w *= RECENT_W;
      if (allowSaid) w /= 1 + (talk.saidN.get(l.id) ?? 0) * 3;
      out.push({ l, text, w });
    }
    return out;
  };
  // dry-cell policy: at the staged presses widen temperament, then agitation, before ever repeating (lintDialogue guarantees those cells are never dry anyway); at
  // 'nothing left' repeat his OWN brush-offs (least-said first) before borrowing another temperament's voice or another band's heat
  const chain: [boolean, boolean, boolean, DialoguePick['widened']][] = s === 'x'
    ? [[true, true, false, ''], [true, true, true, 'repeat'], [false, true, true, 't'], [false, false, true, 'a']]
    : [[true, true, false, ''], [false, true, false, 't'], [false, false, false, 'a'], [false, false, true, 'repeat']];
  let widened: DialoguePick['widened'] = ''; let pool: { l: Line; text: string; w: number }[] = [];
  for (const [useT, useA, allowSaid, tag] of chain) {
    pool = eligible(useT, useA, allowSaid); widened = tag;
    if (allowSaid && pool.length > 1 && talk.last) { const fresh = pool.filter(p => p.l.id !== talk.last!.id); if (fresh.length) pool = fresh; }   // repeating, but never the very line he said last if there is any other
    if (pool.length) break;
  }
  if (!pool.length) {   // nothing at all for this K and stage (lintDialogue guarantees this cannot happen for the shipped table; a synthetic context with no tokens could get here)
    const text = '…'; talk.last = { id: '-', cell, stage: String(s), kind: null };
    return { ...base, text, id: '-', kind: null, lineK: ctx.k, widened: 'repeat', after: null };
  }
  let total = 0; for (const p of pool) total += p.w;
  let r = rnd() * total; let chosen = pool[pool.length - 1];
  for (const p of pool) { r -= p.w; if (r <= 0) { chosen = p; break; } }
  const { l, text } = chosen;
  talk.said.add(l.id); talk.saidN.set(l.id, (talk.saidN.get(l.id) ?? 0) + 1); ctx.recent?.set(l.id, ctx.time);
  talk.last = { id: l.id, cell, stage: String(s), kind: null };
  return { ...base, text, id: l.id, kind: null, lineK: l.k, widened, after: null };
}

/** The whole exchange for a real man: gather → pick. Mutates gd.talk (stage, said, given); says nothing itself (Game.interrogate does the bubble). Null for a
 *  man who cannot talk (down — dead or out cold — or no longer on the roster). A man Sam holds is on the hold's clock (heldSinceOf) and nothing here touches it;
 *  the sandbox's bare exchange with a man nobody holds stamps talk.heldSince on the first press, or after HOLD_LAPSE_SECS without one. The one thing written
 *  past the man's own Talk: Sam's rejoinder to THIS answer (the beat's `after` / `take`), queued on the hold to go up when the man's line is down (player.ts
 *  Hold.after → sayAfter — the key remark takes its place when the answer gave the keyed door: game.ts interrogate → takeKey runs after this) and put in Sam's
 *  memory under '<pick id>+' so the probes can name it; only for the man actually in his arm (the sandbox's bare exchange has no Sam side). */
export function interrogate(g: Game, gd: Guard, rnd: () => number = simRandom): DialoguePick | null {
  if (gd.state === 'dead' || !g.guards.includes(gd)) return null;
  const talk = gd.talk;
  if (!gd.held && (talk.heldSince < 0 || (talk.lastT >= 0 && g.time - talk.lastT > HOLD_LAPSE_SECS))) talk.heldSince = g.time;
  const pick = pickLine(gather(g, gd), talk, rnd);
  const H = g.player.holding;
  if (pick.after && H && H.g === gd && pick.after.length <= SAM_MAX_CHARS) { const id = `${pick.id}+`; H.after = { text: pick.after, id }; const mem = samMemoryOf(g); mem.said.set(id, g.time); mem.last = id; }
  return pick;
}

/** The VERB on the held man's question row for the next exchange (design §1.4) — what it will put to him, by stage, greyed once he has nothing left; and, off the
 *  same peek Sam's own line takes (peekGive: the one giving test pickLine uses), 'ask what he knows' whenever the man is about to GIVE — a nervy man at his second
 *  exchange, a late give at the fourth — so the row never says 'lean on him' over the pointed question and the intel that lands. What Sam actually SAYS comes
 *  from SAM_LINES (samLineFor). Only the arm hold carries it (player.ts buildInteractables: with the gun at his head there is no question row). DRAFT strings like the rest. */
export function promptFor(g: Game, gd: Guard): { text: string; spent: boolean } {
  const next = stageKeyOf(gd.talk.stage + 1);
  if (next === 1) return { text: 'make him talk', spent: false };   // (nobody gives at the first exchange — givesAt starts at 2 — and the opener is the opener regardless)
  if (peekGive(gather(g, gd), gd.talk)) return { text: 'ask what he knows', spent: false };
  return next === 2 ? { text: 'lean on him', spent: false } : next === 3 ? { text: 'ask what he knows', spent: false } : { text: "he's got nothing left", spent: true };
}
/** One line for the panel / probes: who, temperament, his cell now with the agitation terms, the stage the NEXT press would be, what he has said, the useful thing he would give next. */
export function dialogueSummary(g: Game, gd: Guard): string {
  const ctx = gather(g, gd), talk = gd.talk; const next = stageKeyOf(talk.stage + 1);
  const sc = peekScript(talk); const it = intelFor(ctx, talk, sc && scriptLive(sc, ctx) ? sc : null);
  return `${gd.callsign} (${ctx.t}${gd.state === 'dead' ? ', down' : ''}) · cell ${ctx.k}·${ctx.band}·${ctx.t} · A ${ctx.a.toFixed(2)} [${ctx.why.join(', ') || '—'}] · script ${sc ? `${sc.id} (${sc.shape})` : '—'} · next press: stage ${next}${givesAt(ctx.t, ctx.band).includes(next) ? ' (gives)' : ''} · said ${talk.said.size}${talk.given.size ? ` · gave ${[...talk.given].join('/')}` : ''} · next intel: ${it ? it.kind : '—'}${talk.last ? ` · last: ${talk.last.id} @${talk.last.cell} s${talk.last.stage}` : ''}`;
}

// ---------------------------------------------------------------- Sam's side of the exchange (player.ts askHeld: his line goes up over HIM first; the man answers when it ends)
/** Which kind of line Sam puts, by the exchange that is coming: his first words as the arm settles ('open', stage 1), leaning on him ('press', stage 2),
 *  asking for the useful thing ('ask', stage 3 — and whichever stage the man is about to GIVE at, when a question written for that very thing is preferred: the
 *  'q' lines), and the last word to a man who has nothing left ('dry', stage x — his brush-off then answers it). */
export type SamStage = 'open' | 'press' | 'ask' | 'dry';
export const SAM_STAGES: SamStage[] = ['open', 'press', 'ask', 'dry'];
/** Sam's bubble is one clause, two at most (player.ts samBeat holds it 0.9‥1.4 s): the hard limit after token expansion */
export const SAM_MAX_CHARS = 60;
/** the hands-empty hold carries a blade at his throat (the hold-knife lane): the lines that name it are gated on this one switch — false and they never come up */
export const ARM_HOLD_HAS_KNIFE = true;
/** What a Sam line may ask of the moment (all must hold): the hold's variant — 'gun' the Five-seveN at his head, 'arm' the arm across his throat, 'knife' the
 *  arm AND the blade there (ARM_HOLD_HAS_KNIFE) — the floor ('blackout'; 'alarm' = raised or an episode running, 'calm' = neither; 'lockdown'), and 'heldLong'. */
export const SAM_NEEDS = ['gun', 'arm', 'knife', 'blackout', 'alarm', 'calm', 'lockdown', 'heldLong'] as const;
export type SamNeed = typeof SAM_NEEDS[number];
export interface SamLine {
  id: string;
  s: SamStage | 'q' | 'key' | 'script';   // 'q' = a question written for ONE useful thing (`q`), eligible whenever the man is about to give exactly that (never as the opener);
                               // 'key' = his word as he pockets the man's key (samKeyLineFor) — a remark after the answer that gave the keyed door up, never a question;
                               // 'script' = a line that belongs to a SCRIPT beat or a ROOM_MENACE entry, listed here only so 'is this a line of Sam's' has one table
                               //            to ask (registerScriptLines at the end of the file) — the pool pickers never draw it
  q?: IntelKind;
  t?: Temperament;             // the held man's temperament (omitted = any)
  k?: Knowledge;               // what the man knows of Sam (omitted = any) — an opener for the one who watched a colleague drop, or who was hunting him
  needs?: SamNeed[]; text: string; w?: number;
  now?: string; away?: string; // (WORDS) as on Line: the line as he says it now · to anybody but the office's own staff (saidText)
  guide?: string;              // (WORDS.guide) …and as the writing guide has it (saidText)
}
/** Sam's lines. Original text in the game's own voice: dry, low, economical; a threat is stated once and flatly. Tokens as in LINES ({victim} only where k
 *  guarantees it). Every category keeps ≥ 5 lines that need nothing, so any hold has a pool; the variant / floor / man lines colour it (lintDialogue checks). */
export const SAM_LINES: SamLine[] = [
  // ---- open: the arm has just gone on (stage 1 — his startled / hostile reaction answers it)
  { id: 'So1', s: 'open', text: 'Quiet now. You and I are going to talk.' },
  { id: 'So2', s: 'open', text: 'Not a sound. Nod if you understand me.' },
  { id: 'So3', s: 'open', text: "Evening. Let's keep this between us." },
  { id: 'So4', s: 'open', text: "You're having a bad night. Keep it at bad." },
  { id: 'So5', s: 'open', text: "Relax. If I wanted you dead, you'd have missed it." },
  { id: 'So6', s: 'open', text: "Don't turn around. You won't like the view." },
  { id: 'So7', s: 'open', text: 'Hands still. Breathe through your nose. Good.' },
  { id: 'Sog1', s: 'open', needs: ['gun'], text: 'Feel that at your temple? Good. Whisper.' },
  { id: 'Sog2', s: 'open', needs: ['gun'], text: "That's a gun behind your ear. Indoor voice." },
  { id: 'Sog3', s: 'open', needs: ['gun'], text: 'One twitch toward that radio and this gets loud.' },
  { id: 'Sog4', s: 'open', needs: ['gun'], text: "The pistol's the polite version. Stay polite." },
  { id: 'Sog5', s: 'open', needs: ['gun'], text: "Cold, isn't it. Warm up with an easy question." },
  { id: 'Soa1', s: 'open', needs: ['arm'], text: "That's my arm. It tightens when I get bored." },
  { id: 'Soa2', s: 'open', needs: ['arm'], text: 'Struggle and you sleep. Talk and you sleep later.' },
  { id: 'Soa3', s: 'open', needs: ['arm'], text: 'You can breathe or you can shout. Choose breathe.' },
  { id: 'Sok1', s: 'open', needs: ['knife'], text: 'Feel the edge? Then we understand each other.' },
  { id: 'Sok2', s: 'open', needs: ['knife'], text: 'Easy. The blade only moves if you do.' },
  { id: 'Sob1', s: 'open', needs: ['blackout'], w: 1.4, text: "Dark, isn't it. That was me. Now talk." },
  { id: 'Sox1', s: 'open', needs: ['alarm'], text: "Your friends are jumpy tonight. Don't join them." },
  { id: 'Sol1', s: 'open', needs: ['lockdown'], w: 1.4, text: 'All locked down, and still nobody heard me coming.' },
  { id: 'Soh1', s: 'open', k: 'sawHurt', text: "You saw how {victim} went down. Let's do you differently." },
  { id: 'Soh2', s: 'open', k: 'sawHurt', text: "{Victim} didn't get a conversation. You do. Use it." },
  { id: 'Sos1', s: 'open', k: 'saw', text: 'You were looking for me. Congratulations.' },
  { id: 'Sos2', s: 'open', k: 'saw', text: 'Found me. Not how you pictured it, is it.' },
  { id: 'Soc1', s: 'open', k: 'glimpsed', text: 'That shape in the dark earlier? Hello again.' },
  // ---- press: leaning on him (stage 2 — his 'I don't know you / I'm nobody' answers it)
  { id: 'Sp1', s: 'press', text: 'Think hard. I only ask things twice.' },
  { id: 'Sp2', s: 'press', text: "You're stalling. I can feel your pulse doing it." },
  { id: 'Sp3', s: 'press', text: 'A wrong answer costs nothing. Silence costs more.' },
  { id: 'Sp4', s: 'press', text: "I've got all night. You've got about a minute." },
  { id: 'Sp5', s: 'press', text: "Let's try that again, with words in it." },
  { id: 'Sp6', s: 'press', text: "This is me being patient. It doesn't keep." },
  { id: 'Spg1', s: 'press', needs: ['gun'], text: 'The safety came off before you ever heard me.' },
  { id: 'Spg2', s: 'press', needs: ['gun'], text: 'I can ask louder. The gun only has one volume.' },
  { id: 'Spg3', s: 'press', needs: ['gun'], text: "Talk to me, not the gun. It's a poor listener." },
  { id: 'Spg4', s: 'press', needs: ['gun'], text: 'Every stall, the muzzle drifts an inch. Guess where.' },
  { id: 'Spg5', s: 'press', needs: ['gun'], text: "Nod toward the truth. Slowly. My finger's tired." },
  { id: 'Spa1', s: 'press', needs: ['arm'], text: "Feel that? The arm's asking. Next it insists." },
  { id: 'Spa2', s: 'press', needs: ['arm'], text: 'You go quiet, the arm goes tight. Simple system.' },
  { id: 'Spa3', s: 'press', needs: ['arm'], text: "Air's a privilege from here. Spend it on words." },
  { id: 'Spa4', s: 'press', needs: ['arm'], text: 'I can hold this longer than you can hold out.' },
  { id: 'Spk1', s: 'press', needs: ['knife'], text: "The edge is patient. I'm less so." },
  { id: 'Spk2', s: 'press', needs: ['knife'], text: 'Swallow carefully. Then answer carefully.' },
  { id: 'Spn1', s: 'press', t: 'nervy', text: 'Breathe. Slower. Now spend the breath on words.' },
  { id: 'Spn2', s: 'press', t: 'nervy', text: "Stop shaking. You'll blur the answer." },
  { id: 'Sph1', s: 'press', t: 'hard', text: 'Tough is fine. Tough just takes longer.' },
  { id: 'Sph2', s: 'press', t: 'hard', text: "Save the attitude. Nobody's grading you." },
  { id: 'Sps1', s: 'press', t: 'steady', text: "You're calm. Good. Calm men remember details." },
  { id: 'Spx1', s: 'press', needs: ['alarm'], text: "They're hunting me. You're what's slowing me down." },
  { id: 'Spb1', s: 'press', needs: ['blackout'], text: 'Lights are out. Nobody finds you by accident now.' },
  { id: 'Spl1', s: 'press', needs: ['lockdown'], text: "Your floor's sealed. So is this conversation.", now: "You're sealed in. So is this conversation." },
  // ---- ask: the useful thing (stage 3, or whenever he is about to give — his fact, his admission he has none, or his refusal answers it)
  { id: 'Sa1', s: 'ask', text: 'Tell me something useful and you sleep it off.' },
  { id: 'Sa2', s: 'ask', text: "What's on this floor I should worry about?", now: "What's around here I should worry about?" },
  { id: 'Sa3', s: 'ask', text: 'Last useful thing you know. Make it count.' },
  { id: 'Sa4', s: 'ask', text: "What don't I know yet? Quickly." },
  { id: 'Sa5', s: 'ask', text: "Make yourself useful. It's a short interview." },
  { id: 'Sa6', s: 'ask', text: 'What would ruin my night up here? Besides you.', now: 'What would ruin my night here? Besides you.' },
  { id: 'Sah1', s: 'ask', t: 'hard', text: "Here's where you decide how tomorrow feels." },
  { id: 'San1', s: 'ask', t: 'nervy', text: 'Small words. One useful thing. Go.' },
  { id: 'Sag1', s: 'ask', needs: ['gun'], text: "The gun's listening too. Impress us both." },
  { id: 'Saa1', s: 'ask', needs: ['arm'], text: 'One good answer buys you a lot of air.' },
  // ---- q: the question written for the thing he is about to give (peekGive) — preferred over the plain asks when it fits
  { id: 'Sqd1', s: 'q', q: 'door', text: 'The locked doors up here. Who carries keys?', now: 'The locked doors here. Who carries keys?' },
  { id: 'Sqd2', s: 'q', q: 'door', text: 'That keyed door on your round. How does it open?', guide: 'That keyed door on your route. How does it open?' },
  { id: 'Sqr1', s: 'q', q: 'rollcall', text: 'How long before somebody misses you?' },
  { id: 'Sqr2', s: 'q', q: 'rollcall', text: "When's your next radio check? Don't round down." },
  { id: 'Sqv1', s: 'q', q: 'rollcallLive', text: "That's your radio wanting you. What happens now?" },
  { id: 'Sqv2', s: 'q', q: 'rollcallLive', text: "They're calling names. What if yours stays quiet?" },
  { id: 'Sqn1', s: 'q', q: 'routes', text: 'How many of you tonight, and who walks where?' },
  { id: 'Sqn2', s: 'q', q: 'routes', text: "Head count. Routes. Don't leave yourself out." },
  { id: 'Sqb1', s: 'q', q: 'blackout', text: "Lights die up here — what's the drill?", now: "Lights die — what's the drill?" },
  { id: 'Sqb2', s: 'q', q: 'blackout', text: 'Power drops. Who comes running, and how armed?' },
  { id: 'Sqc1', s: 'q', q: 'checkOn', text: "Someone's off the air. Who goes looking for him?" },
  { id: 'Sqm1', s: 'q', q: 'missing', text: "Your net's a man short. What happens next?" },
  { id: 'Sql1', s: 'q', q: 'lockdownPosts', text: "You've locked down. Where does everyone dig in?" },
  { id: 'Sql2', s: 'q', q: 'clearing', text: "They're sweeping rooms. Which one's first?" },
  { id: 'Sqk1', s: 'q', q: 'drive', text: 'The server room. Anybody watching those racks?', away: "What I took. Anybody noticed it's gone?" },
  // ---- key: the man has just given the keyed door up — and the key on his belt with it (player.ts takeKey): Sam's word as he pockets it, over Sam once the
  //      man's line is down; nobody answers it and no stage moves. Terse: the clack of the key and the kit column's tag have already said the rest.
  { id: 'Sk1', s: 'key', text: "I'll hold on to this." },
  { id: 'Sk2', s: 'key', text: "Your key. You won't be needing it." },
  { id: 'Sk3', s: 'key', text: 'This comes with me. Saves me a lock.' },
  { id: 'Sk4', s: 'key', text: "Thanks. I'll let myself in." },
  { id: 'Sk5', s: 'key', text: 'Off your belt, into my pocket. Keep still.' },
  { id: 'Skh1', s: 'key', t: 'hard', text: 'Generous. I was taking it anyway.' },
  { id: 'Skn1', s: 'key', t: 'nervy', text: 'Easy. Just the key. Keep breathing.' },
  // ---- dry: he has nothing left (stage x — the last word; his 'I told you' answers it)
  { id: 'Sd1', s: 'dry', text: 'Once more, from the top. Humor me.' },
  { id: 'Sd2', s: 'dry', text: 'That had better be all of it.' },
  { id: 'Sd3', s: 'dry', text: "If you're holding out, I'll know before you do." },
  { id: 'Sd4', s: 'dry', text: 'Anything you forgot? Now is cheaper than later.' },
  { id: 'Sd5', s: 'dry', text: "You're sure. Think about how sure." },
  { id: 'Sd6', s: 'dry', text: 'Last chance to be interesting.' },
  { id: 'Sd7', s: 'dry', text: "Then we're about done. Any famous last details?" },
  { id: 'Sd8', s: 'dry', text: "Nothing else? Then you're just heavy now." },
  { id: 'Sdg1', s: 'dry', needs: ['gun'], text: "The gun's bored. Bore it again and we're finished." },
  { id: 'Sda1', s: 'dry', needs: ['arm'], text: "My arm's falling asleep. You're next." },
  { id: 'Sdk1', s: 'dry', needs: ['knife'], text: "The blade's heard enough. Have I?" },
  { id: 'Sdn1', s: 'dry', t: 'nervy', text: 'Easy. Same question, smaller words.' },
  { id: 'Sdh1', s: 'dry', t: 'hard', text: "Still no? Consistent. I'll give you that." },
  { id: 'Sdl1', s: 'dry', needs: ['heldLong'], w: 1.4, text: "We've been at this a while. Wrap it up for me." },
  { id: 'Sdx1', s: 'dry', needs: ['alarm'], text: 'Your friends are close. Be quick, or be quiet for good.' },
];
/** Sam's memory of his own lines (per Game): id → the game time he last said it, and the very last. A line said within SAM_RECENT_SECS stays out while
 *  anything else fits — across men too: the next man grabbed does not hear the same opener — and the last one is never said twice running. */
export interface SamMemory { said: Map<string, number>; last: string | null; }
const samMemByGame = new SideMap<object, SamMemory>('dialogue.samMemByGame');
export function samMemoryOf(g: object): SamMemory { let m = samMemByGame.get(g); if (!m) { m = { said: new Map(), last: null }; samMemByGame.set(g, m); } return m; }
const SAM_RECENT_SECS = 150;
export interface SamPick {
  text: string; id: string;      // the resolved line and its id ('-' if nothing fitted at all — lintDialogue guarantees the shipped table never gets there; 'S:<script>:<stage>' for a script beat)
  s: SamStage;                   // the category it was picked for
  q: IntelKind | null;           // the useful thing the man is about to give (peekGive), if any — the 'q' lines are written to it
  stage: StageKey;               // the exchange this opens (the man's stage once he answers)
  fresh: boolean;                // picked from lines not said lately (false = the pool had run dry of fresh ones)
  script: string | null;         // the script whose beat this is (null = the pools)
}
/** What the man would give at the COMING exchange as things stand — the useful thing's kind — or null. Read-only (intelFor over the same giving test pickLine
 *  uses, the same script and the rambler's same swallow): Sam words his question to it, and the answer a beat later agrees unless the man's heat crossed a band
 *  in that second (then he asked and got a refusal, which reads fine too). */
export function peekGive(ctx: DialogueCtx, talk: Talk): IntelKind | null {
  const stageN = talk.stage + 1, s = stageKeyOf(stageN);
  const sc0 = scriptFor(ctx, talk); const sc = sc0 && stageN <= 4 && scriptLive(sc0, ctx) ? sc0 : null;
  return givingStage(ctx.t, ctx.band, s, stageN, talk.given.size === 0) && !swallowed(sc, s, ctx, talk) ? intelFor(ctx, talk, sc)?.kind ?? null : null;
}
/** the category for the exchange at stage s: the opener, then — unless he is about to give (ask him for it) — pressure at 2, the ask at 3, the last word at x */
export function samStageOf(s: StageKey, gives: boolean): SamStage { return s === 1 ? 'open' : gives ? 'ask' : s === 2 ? 'press' : s === 3 ? 'ask' : 'dry'; }
/** Sam's facts for SAM_NEEDS, off the same context the man's answer is read from plus the hold's variant */
export function samFacts(ctx: DialogueCtx, variant: HoldVariant): Record<SamNeed, boolean> {
  const alarm = !!(ctx.facts.floorUp || ctx.facts.episode || ctx.facts.lockdown);
  return { gun: variant === 'gun', arm: variant === 'arm', knife: variant === 'arm' && ARM_HOLD_HAS_KNIFE, blackout: !!ctx.facts.blackout, alarm, calm: !alarm, lockdown: !!ctx.facts.lockdown, heldLong: !!ctx.facts.heldLong };
}
/** does this line fit the man and the moment (its tier — category or 'q' — is chosen by the caller) */
function samLineFits(l: SamLine, ctx: DialogueCtx, facts: Record<SamNeed, boolean>): boolean {
  if (l.t && l.t !== ctx.t) return false;
  if (l.k && l.k !== ctx.k) return false;
  return !l.needs || l.needs.every(n => facts[n]);
}
/** The chooser both of Sam's picks share: down the `tiers` (lists of lines, most wanted first) the first with anything FRESH that fits the man and the moment
 *  wins — fresh = not said within SAM_RECENT_SECS by Sam's memory; if every tier is stale, anything that fits from all of them, but never the very last line
 *  again while there is another; then a weighted draw (the variant / floor / man lines outweigh the neutral) and the choice written to the memory. null only if
 *  nothing fits at all. */
function chooseSamLine(tiers: SamLine[][], ctx: DialogueCtx, facts: Record<SamNeed, boolean>, mem: SamMemory | null, rnd: () => number): { l: SamLine; text: string; fresh: boolean } | null {
  const eligible = (lines: SamLine[], freshOnly: boolean) => {
    const out: { l: SamLine; text: string; w: number }[] = [];
    for (const l of lines) {
      if (!samLineFits(l, ctx, facts)) continue;
      if (freshOnly && mem) { const at = mem.said.get(l.id); if (at !== undefined && ctx.time - at < SAM_RECENT_SECS) continue; }
      const text = expand(saidText(l, ctx), ctx.tokens); if (!text) continue;
      out.push({ l, text, w: (l.w ?? 1) * (l.needs?.length ? 1.6 : 1) * (l.t ? 1.5 : 1) * (l.k ? 2.5 : 1) });   // the variant / floor / man lines beat the neutral ones
    }
    return out;
  };
  let pool: { l: SamLine; text: string; w: number }[] = []; let fresh = false;
  for (const tier of tiers) { pool = eligible(tier, true); if (pool.length) { fresh = true; break; } }
  if (!pool.length) { pool = eligible(tiers.flat(), false); if (pool.length > 1 && mem?.last) { const rest = pool.filter(p => p.l.id !== mem.last); if (rest.length) pool = rest; } }   // all said lately: anything that fits, but never the very last again if there is another
  if (!pool.length) return null;
  let total = 0; for (const p of pool) total += p.w;
  let r = rnd() * total; let chosen = pool[pool.length - 1];
  for (const p of pool) { r -= p.w; if (r <= 0) { chosen = p; break; } }
  if (mem) { mem.said.set(chosen.l.id, ctx.time); mem.last = chosen.l.id; }
  return { l: chosen.l, text: chosen.text, fresh };
}
/** Sam's line for the coming exchange with this man: the category by the stage it will be — and if he is about to give, FIRST the questions written for that
 *  very thing (the 'q' tier), the plain asks only once those have all been said lately — the pool narrowed by the hold's variant, the floor and the man, fresh
 *  lines before anything said within SAM_RECENT_SECS, the specific outweighing the neutral. Pure over ctx / talk but for Sam's memory. */
export function pickSamLine(ctx: DialogueCtx, talk: Talk, variant: HoldVariant, mem: SamMemory | null, rnd: () => number): SamPick {
  const stageN = talk.stage + 1, s = stageKeyOf(stageN);
  const q = s === 1 ? null : peekGive(ctx, talk); const cat = samStageOf(s, !!q);   // (nobody gives at the first exchange — givesAt starts at 2 — and the opener is the opener regardless)
  // the hold's script first: the beat's own line — its `ask` when the man is about to give (peek), else its `sam` — remembered like any line of his
  const sc0 = scriptFor(ctx, talk); const sc = sc0 && stageN <= 4 && scriptLive(sc0, ctx) ? sc0 : null;
  if (sc) {
    const beat = beatFor(sc, s, ctx); const text = expand(q && beat.ask ? beat.ask : wg(beat.samNow ?? beat.sam, beat.sam), ctx.tokens);
    if (text && text.length <= SAM_MAX_CHARS) { const id = `S:${sc.id}:${String(s)}${q && beat.ask ? '?' : ''}`; if (mem) { mem.said.set(id, ctx.time); mem.last = id; } return { text, id, s: cat, q, stage: s, fresh: true, script: sc.id }; }
  }
  const tiers: SamLine[][] = q ? [SAM_LINES.filter(l => l.s === 'q' && l.q === q), SAM_LINES.filter(l => l.s === 'ask')] : [SAM_LINES.filter(l => l.s === cat)];
  const c = chooseSamLine(tiers, ctx, samFacts(ctx, variant), mem, rnd);
  return c ? { text: c.text, id: c.l.id, s: cat, q, stage: s, fresh: c.fresh, script: null } : { text: '…', id: '-', s: cat, q, stage: s, fresh: false, script: null };
}
/** Sam's line for the next exchange with a real man in his arm (gather → pickSamLine, remembered on the Game). Says nothing itself: player.ts askHeld puts it up. */
export function samLineFor(g: Game, gd: Guard, variant: HoldVariant, rnd: () => number = simRandom): SamPick { return pickSamLine(gather(g, gd), gd.talk, variant, samMemoryOf(g), rnd); }
/** Sam's word as he pockets the key a man has just given up with the keyed door (player.ts takeKey): the 'key' lines, narrowed by the man and the floor like
 *  any other, fresh ones first, remembered like the rest — a remark, not an exchange: nobody answers and no stage moves. null if nothing fits (never, for the
 *  shipped table: lintDialogue keeps SAM_KEY_MIN of them free of conditions). */
export function samKeyLineFor(g: Game, gd: Guard, variant: HoldVariant, rnd: () => number = simRandom): { text: string; id: string } | null {
  const ctx = gather(g, gd);
  const c = chooseSamLine([SAM_LINES.filter(l => l.s === 'key')], ctx, samFacts(ctx, variant), samMemoryOf(g), rnd);
  return c ? { text: c.text, id: c.l.id } : null;
}
/** One of Sam's PISTOL lines as a remark, for the moment he draws on a man already in his arm (player.ts swapHold, E): the [gun] openers — written as his
 *  first words with the muzzle at the man's temple, which is what that moment is — narrowed by the man and the floor like any line, fresh ones first,
 *  remembered like the rest. Nobody answers it and no stage moves. Questions are put with the arm on him now, so this is where the [gun] lines are still
 *  heard (the pool keeps them in every category against the day the pistol hold questions again). null if nothing fits (never, for the shipped table). */
export function samRemarkFor(g: Game, gd: Guard, rnd: () => number = simRandom): { text: string; id: string } | null {
  const ctx = gather(g, gd);
  const c = chooseSamLine([SAM_LINES.filter(l => l.s === 'open' && !!l.needs?.includes('gun'))], ctx, samFacts(ctx, 'gun'), samMemoryOf(g), rnd);
  return c ? { text: c.text, id: c.l.id } : null;
}

// ---------------------------------------------------------------- QA: a synthetic context for sweeping the matrix without a world, and the table lint
/** A hand-made context for cell (k, band, t): every token filled with a plausible value (unless overridden), the facts a knowledge level implies switched on.
 *  `who` names the man (the scripts are dealt off it: the same who, the same script). */
export function synthCtx(k: Knowledge, band: Band, t: Temperament, over: { facts?: Partial<Record<Need, boolean>>; tokens?: Partial<Record<Token, string | null>>; intelLive?: IntelKind[]; who?: string } = {}): DialogueCtx {
  const a = band === 'high' ? 0.75 : band === 'mid' ? 0.45 : 0.1;
  const who = over.who ?? 'synthetic';
  const tokens: Partial<Record<Token, string | null>> = { partner: 'Novak', victim: k === 'sawHurt' ? 'Kowalski' : null, body: null, missing: null, room: 'the corridor', sawWhere: k === 'glimpsed' || k === 'saw' || k === 'sawHurt' ? 'the server room' : null, heardWhere: k === 'heard' ? 'the cubicles' : null, route: 'the corridor', partnerRoute: 'the cubicles', post: 'the east end', door: 'the server room door', caller: 'Reyes', checker: null, checked: null, clearRoom: null, breakerRoom: 'the storage room', checkEta: 'in a minute or so', minutes: null, n: 'three', up: 'three', badge: badgeOf(who), code: '7391', padDoor: 'the office side door', ...over.tokens };
  const facts: Partial<Record<Need, boolean>> = { heardSmall: k === 'heard', sawShot: k === 'sawHurt', partnerKnown: !!tokens.partner, shift: true, office: true, ...over.facts };
  const live = new Set<IntelKind>(over.intelLive ?? ['door', 'rollcall', 'routes']);
  const intel: IntelItem[] = INTEL_KINDS.map(kind => ({ kind, text: intelText(kind, t, k), live: live.has(kind), known: true }));
  return { who, k, a, band, t, why: [], facts, tokens, intel, time: 0, recent: null };
}

/** Words and phrases too much like the interrogations of the game this one tips its hat to (and its cast and places): NOTHING said in this file may contain one —
 *  the writing is original or it is out. Matched case-insensitively as substrings on the raw text (tokens and all); lintDialogue runs it over every speaker:
 *  the pools, Sam's lines, the useful things, the scripts, the rooms, the handler, the pairs. Extend it whenever a reference line comes to mind. */
export const ORIGINALITY_BLOCKLIST: string[] = [
  'equation', 'daisies', 'cripple', 'tuxedo', 'monkey', 'ninja', 'pick a number', 'wallet', 'wet myself', 'blowpipe', 'training exercise', 'death before dishonor',
  'death before dishonour', 'we all die alone', 'i have two', 'the real kind', 'chit-chat', 'chitchat', 'elvis', 'freaking me out', 'freak me out', 'light switch',
  'lightswitch', 'poke you', 'sixth grade', 'grade school', 'fisher', 'lambert', 'grimsdott', 'redding', 'third echelon', 'echelon', 'shetland', 'displace',
  'bathhouse', 'lighthouse', 'penthouse', 'hokkaido', 'panama', 'guns are for', 'knives are for', 'necks snap', 'snap your neck', 'two kinds of people',
  'coma', 'karate', 'kung fu', 'james bond', 'superhero', 'spy movie',
];
/** the blocklisted phrase inside `text`, or null */
export function blockedPhrase(text: string): string | null { const s = text.toLowerCase(); for (const b of ORIGINALITY_BLOCKLIST) if (s.includes(b)) return b; return null; }

/** Dev lint over the tables (the QA probe runs it; empty = clean): unknown tokens / needs, over MAX_CHARS after the worst-case expansion, duplicate ids or texts,
 *  and coverage — every (K, band, T, stage) cell has at least one line it can always reach (no needs, tokens guaranteed for that K), stages 1 and 2 with a line
 *  written FOR that knowledge level (not just floor colour), every INTEL text within the limit with the worst lead-in on. Sam's table too (SAM_LINES): ids and
 *  texts unique across both speakers, tokens that always resolve for the line's K, needs from SAM_NEEDS and not contradictory, ≤ SAM_MAX_CHARS, 'q' lines
 *  naming a real useful thing, and ≥ SAM_POOL_MIN lines per category that need nothing (so any hold, any man, has a pool). The SCRIPTS: four beats each,
 *  Sam ≤ SAM_MAX_CHARS and the man ≤ MAX_CHARS after the worst expansion, tokens guaranteed for every knowledge the script is written for (or its pin), the
 *  opener free of tokens (the one line other probes match verbatim), ≥ SCRIPT_VARIANTS_MIN scripts per (shape × temperament) written, and at least one script
 *  that fits every (temperament × knowledge below sawHurt × band) on a plain floor. The rooms, the handler and the pairs likewise; and the ORIGINALITY_BLOCKLIST
 *  over every string of every speaker. */
export const SAM_POOL_MIN = 5;
/** …and at least this many 'key' remarks that need nothing (a man of any temper, any floor, hands his key over to one of them) */
export const SAM_KEY_MIN = 3;
/** at least this many scripts (variants) for every (shape × temperament) the table writes at all */
export const SCRIPT_VARIANTS_MIN = 3;
export function lintDialogue(): string[] {
  const problems: string[] = [];
  const ids = new Set<string>(), texts = new Set<string>();
  const worst = (text: string) => expand(text, tokenWorst()) ?? text;
  const orig = (where: string, text: string) => { const b = blockedPhrase(text); if (b) problems.push(`${where}: "${text}" carries the blocklisted '${b}' — write it fresh`); };
  const dup = (where: string, text: string) => { const key = text.trim().toLowerCase(); if (texts.has(key)) problems.push(`duplicate text (${where}): "${text}"`); texts.add(key); };
  for (const l of SAM_LINES) {
    if (ids.has(l.id)) problems.push(`duplicate id ${l.id}`); ids.add(l.id);
    if (l.s === 'script') continue;   // (a script's lines are linted with their script, below — this entry only lends its text to 'is this Sam's')
    dup(l.id, l.text); orig(l.id, l.text);
    if (!l.text.trim()) problems.push(`${l.id}: empty`);
    const sure = new Set<string>([...TOKENS_ALWAYS, ...(l.k ? TOKENS_BY_K[l.k] : [])]);
    for (const tk of tokensIn(l.text)) { if (!(TOKENS as readonly string[]).includes(tk)) problems.push(`${l.id}: unknown token {${tk}}`); else if (!sure.has(tk)) problems.push(`${l.id}: token {${tk}} is not guaranteed for ${l.k ? `k '${l.k}'` : 'any k'} (the player's lines must always resolve)`); }
    for (const n of l.needs ?? []) if (!(SAM_NEEDS as readonly string[]).includes(n)) problems.push(`${l.id}: unknown need '${n}'`);
    const N = new Set(l.needs ?? []); if ((N.has('gun') && (N.has('arm') || N.has('knife'))) || (N.has('alarm') && N.has('calm')) || (N.has('calm') && N.has('lockdown'))) problems.push(`${l.id}: contradictory needs [${[...N].join(', ')}] — the line can never come up`);
    const len = worst(l.text).length; if (len > SAM_MAX_CHARS) problems.push(`${l.id}: ${len} chars after expansion (> ${SAM_MAX_CHARS}): "${worst(l.text)}"`);
    if (l.w !== undefined && !(l.w > 0)) problems.push(`${l.id}: weight ${l.w} (must be > 0)`);
    if (l.s !== 'q' && l.s !== 'key' && !SAM_STAGES.includes(l.s)) problems.push(`${l.id}: bad stage '${String(l.s)}'`);
    if (l.s === 'q' && (!l.q || !(INTEL_KINDS as readonly string[]).includes(l.q))) problems.push(`${l.id}: a 'q' line needs q from INTEL_KINDS (has ${l.q ?? 'none'})`);
    if (l.s !== 'q' && l.q) problems.push(`${l.id}: q '${l.q}' on a '${l.s}' line (only 'q' lines carry one)`);
    if (l.t && !TEMPERAMENTS.includes(l.t)) problems.push(`${l.id}: bad t ${l.t}`);
    if (l.k && !KNOWLEDGE.includes(l.k)) problems.push(`${l.id}: bad k ${l.k}`);
  }
  // the reworded rows (now / away): the same tokens as the row they stand in for, so only what a new wording can break — length, the blocklist, a twin
  for (const [T, max] of [[SAM_LINES, SAM_MAX_CHARS], [LINES, MAX_CHARS]] as const) for (const l of T) for (const [key, text] of [['now', l.now], ['away', l.away], ['bare', (l as Line).bare], ['guide', l.guide]] as const) {
    if (text === undefined) continue; const W = `${l.id} ${key}`; dup(W, text); orig(W, text);
    if (worst(text).length > max) problems.push(`${W}: ${worst(text).length} chars after expansion (> ${max}): "${worst(text)}"`);
    if (tokensIn(text).some(tk => !tokensIn(l.text).includes(tk))) problems.push(`${W}: a token its row's own text does not carry`);
  }
  for (const s of SAM_STAGES) { const n = SAM_LINES.filter(l => l.s === s && !l.t && !l.k && !l.needs?.length).length; if (n < SAM_POOL_MIN) problems.push(`Player '${s}': only ${n} lines that need nothing (want ≥ ${SAM_POOL_MIN} — a hold with no colour on would run dry)`); }
  { const n = SAM_LINES.filter(l => l.s === 'key' && !l.t && !l.k && !l.needs?.length).length; if (n < SAM_KEY_MIN) problems.push(`Player 'key': only ${n} remarks that need nothing (want ≥ ${SAM_KEY_MIN} — a key handed over must always get a word)`); }
  for (const v of ['gun', 'arm'] as const) for (const s of SAM_STAGES) { if (s === 'ask') continue; if (!SAM_LINES.some(l => l.s === s && l.needs?.includes(v))) problems.push(`Player '${s}': no line for the '${v}' hold`); }
  for (const l of LINES) {
    if (ids.has(l.id)) problems.push(`duplicate id ${l.id}`); ids.add(l.id);
    dup(l.id, l.text); orig(l.id, l.text);
    for (const tk of tokensIn(l.text)) if (!(TOKENS as readonly string[]).includes(tk)) problems.push(`${l.id}: unknown token {${tk}}`);
    for (const n of l.needs ?? []) if (!(NEEDS as readonly string[]).includes(n)) problems.push(`${l.id}: unknown need '${n}'`);
    const len = worst(l.text).length; if (len > MAX_CHARS) problems.push(`${l.id}: ${len} chars after expansion (> ${MAX_CHARS}): "${worst(l.text)}"`);
    if (!l.text.trim()) problems.push(`${l.id}: empty`);
    if (l.w !== undefined && !(l.w > 0)) problems.push(`${l.id}: weight ${l.w} (must be > 0 — the weighted pick degenerates otherwise)`);
    if (l.k !== '*' && !KNOWLEDGE.includes(l.k)) problems.push(`${l.id}: bad k ${l.k}`);
    if (!STAGES.includes(l.s)) problems.push(`${l.id}: bad stage ${String(l.s)}`);
  }
  // the useful things: keys, tokens, and length with the worst lead-in anybody who can say that text can put in front (shape-voiced texts take none)
  const shapeTs = new Map<ShapeKey, Set<Temperament>>(); for (const sc of SCRIPTS) { let S = shapeTs.get(sc.shape); if (!S) { S = new Set(); shapeTs.set(sc.shape, S); } S.add(sc.t); }
  const leadWorstT = (t: Temperament, ks: Knowledge[]) => { let m = Math.max(...ks.map(k => intelLead(t, k).length)); if (t !== 'hard') for (const [sh, S] of shapeTs) if (S.has(t) && SHAPE_LEAD[sh] !== undefined) m = Math.max(m, SHAPE_LEAD[sh]!.length); return m; };
  const leadWorst = (ts: Temperament[], ks: Knowledge[]) => ts.reduce((m, t) => Math.max(m, leadWorstT(t, ks)), 0);
  for (const kind of INTEL_KINDS) for (const [tk, text] of [...Object.entries(intelTable(kind)), ...(kind === 'checkOn' ? [['self', checkOnSelf()]] : [])] as [string, string][]) {
    if (!text) continue;
    orig(`intel ${kind}/${tk}`, text); dup(`intel ${kind}/${tk}`, text);
    for (const t2 of tokensIn(text)) if (!(TOKENS as readonly string[]).includes(t2)) problems.push(`intel ${kind}/${tk}: unknown token {${t2}}`);
    const [aPart, bPart] = tk.split(':') as [string, string | undefined];
    const isScript = aPart === 'sc', isShape = isScript || (SHAPES as string[]).includes(aPart);
    if (aPart !== '*' && aPart !== 'self' && !isShape && !(TEMPERAMENTS as string[]).includes(aPart)) problems.push(`intel ${kind}: bad key '${tk}'`);
    if (isScript ? !SCRIPTS.some(sc => sc.id === bPart) : bPart !== undefined && !(isShape ? (TEMPERAMENTS as string[]).includes(bPart) : (KNOWLEDGE as string[]).includes(bPart))) problems.push(`intel ${kind}: bad second part in key '${tk}'`);
    if (kind === 'door' && !/belt|mine|pocket|clip/i.test(text)) problems.push(`intel door/${tk}: "${text}" never puts the key on his person — the player takes it off him as this is said`);
    let len: number;
    if (isShape) len = worst(text).length;   // (its own manner: no lead)
    else {
      const users = aPart === '*' || aPart === 'self' ? TEMPERAMENTS.filter(t => aPart === 'self' || !INTEL_TEXT[kind][t]) : [aPart as Temperament];   // who can end up saying this variant (a '*' text is shadowed for men with their own), and knowing what
      const ks = bPart !== undefined ? [bPart as Knowledge] : KNOWLEDGE;
      len = worst(text).length + leadWorst(users, ks);
    }
    if (len > MAX_CHARS) problems.push(`intel ${kind}/${tk}: ${len} chars after expansion with the lead-in (> ${MAX_CHARS}): "${worst(text)}"`);
  }
  for (const [tk, text] of Object.entries(driveAway())) { const W = `intel drive/away ${tk}`; orig(W, text); dup(W, text); const len = text.length + leadWorst(tk === '*' ? TEMPERAMENTS.filter(t => !DRIVE_AWAY[t]) : [tk as Temperament], KNOWLEDGE); if (tokensIn(text).length || len > MAX_CHARS) problems.push(`${W}: a token, or ${len} chars with the lead-in (> ${MAX_CHARS})`); }
  // coverage of the pools: reachable without needs (nor `only`: a unit, a man of another level has the cell too) and with only the guaranteed tokens
  for (const k of KNOWLEDGE) for (const band of BANDS) for (const t of TEMPERAMENTS) for (const s of STAGES) {
    const sure = new Set<string>([...TOKENS_ALWAYS, ...TOKENS_BY_K[k]]);
    const reach = (own: boolean) => LINES.some(l => lineMatches(l, k, band, t, s, false, false) && !l.needs?.length && !l.only && tokensIn(l.text).every(x => sure.has(x)) && (!own || l.k === k));
    if (!reach(false)) problems.push(`cell ${k}·${band}·${t} stage ${String(s)}: no line always reachable`);
    else if ((s === 1 || s === 2) && !reach(true)) problems.push(`cell ${k}·${band}·${t} stage ${String(s)}: only floor-colour lines, none written for '${k}'`);
  }
  // …and a spawned unit's own cells (always hard, no `only` row, no man's name: K's own token only where it is a place) in a hard man's or anybody's voice
  for (const k of KNOWLEDGE) for (const band of BANDS) for (const s of STAGES) {
    const sure = new Set<string>([...TOKENS_ALWAYS, ...TOKENS_BY_K[k].filter(x => x !== 'victim')]);
    if (!LINES.some(l => lineMatches(l, k, band, 'hard', s, true, false) && !l.needs?.length && !l.only && tokensIn(l.bare ?? l.text).every(x => sure.has(x)))) problems.push(`cell ${k}·${band}·unit stage ${String(s)}: no line a unit can always reach`);
  }
  // the scripts
  const samLen = (where: string, text: string | undefined) => { if (text === undefined) return; orig(where, text); const w = worst(text); if (w.length > SAM_MAX_CHARS) problems.push(`${where}: the player's "${w}" is ${w.length} chars (> ${SAM_MAX_CHARS})`); if (!text.trim() || text.trim() === '…') problems.push(`${where}: the player says nothing ("${text}")`); };
  const himLen = (where: string, text: string) => { orig(where, text); dup(where, text); const w = worst(text); if (w.length > MAX_CHARS) problems.push(`${where}: "${w}" is ${w.length} chars (> ${MAX_CHARS})`); if (!text.trim() || text.trim() === '…') problems.push(`${where}: he says nothing ("${text}")`); };
  const himStrings = (h: Him): [string, string][] => typeof h === 'string' ? [['*', h]] : Object.entries(h);
  const perShapeT = new Map<string, number>();
  for (const sc of SCRIPTS) {
    const W = `script ${sc.id}`;
    if (ids.has(sc.id)) problems.push(`duplicate id ${sc.id} (script)`); ids.add(sc.id);
    if (!SHAPES.includes(sc.shape)) problems.push(`${W}: unknown shape '${sc.shape}'`);
    if (!TEMPERAMENTS.includes(sc.t)) problems.push(`${W}: bad t '${sc.t}'`);
    if (!sc.k.length || sc.k.some(k => !KNOWLEDGE.includes(k))) problems.push(`${W}: bad k list [${sc.k.join(', ')}]`);
    if (sc.k.includes('sawHurt')) problems.push(`${W}: written for sawHurt — a man who watched the player hurt somebody is frightened, never funny (the pools have him)`);
    if (sc.band && (!sc.band.length || sc.band.some(b => !BANDS.includes(b)))) problems.push(`${W}: bad band list`);
    for (const n of [...(sc.needs ?? []), ...(sc.not ?? [])]) if (!(NEEDS as readonly string[]).includes(n)) problems.push(`${W}: unknown need '${n}'`);
    if (sc.pin && !(INTEL_KINDS as readonly string[]).includes(sc.pin)) problems.push(`${W}: pin '${sc.pin}' is no useful thing`);
    perShapeT.set(`${sc.shape}·${sc.t}`, (perShapeT.get(`${sc.shape}·${sc.t}`) ?? 0) + 1);
    const wide = new Set<string>([...TOKENS_ALWAYS, ...(sc.pin === 'door' ? ['door'] : []), 'partner']);   // script-wide: the always-tokens, the pinned door, and {partner} (checked live when the script is dealt — scriptFits — a man with nobody left draws another); a knowledge-keyed answer may add that knowledge's own (below)
    const gives = new Set(givesAt(sc.t, 'mid'));   // (the beats that can be a giving stage for this temperament, rattled or not: nervy 2/3, steady 3, hard 3)
    for (const s of STAGES) {
      const b = sc.beats[s]; const B = `${W} beat ${String(s)}`;
      if (!b) { problems.push(`${W}: no beat ${String(s)}`); continue; }
      samLen(`${B} sam`, b.sam); samLen(`${B} sam now`, b.samNow);
      if (s === 1 && tokensIn(b.sam).length) problems.push(`${B}: the opener "${b.sam}" carries a token — openers stay literal (other probes match the player's first line verbatim)`);
      for (const tk of tokensIn(b.sam)) if (!wide.has(tk)) problems.push(`${B} sam: token {${tk}} is not guaranteed`);
      for (const [key, text] of himStrings(b.him)) {
        himLen(`${B} him/${key}`, text);
        const ok = new Set(wide); if ((KNOWLEDGE as string[]).includes(key)) for (const tk of TOKENS_BY_K[key as Knowledge]) ok.add(tk);
        for (const tk of tokensIn(text)) { if (!(TOKENS as readonly string[]).includes(tk)) problems.push(`${B} him/${key}: unknown token {${tk}}`); else if (!ok.has(tk)) problems.push(`${B} him/${key}: token {${tk}} is not guaranteed`); }
        if (key !== '*' && !(KNOWLEDGE as string[]).includes(key) && !(TEMPERAMENTS as string[]).includes(key)) problems.push(`${B} him: bad key '${key}'`);
        if ((KNOWLEDGE as string[]).includes(key) && !sc.k.includes(key as Knowledge)) problems.push(`${B} him/${key}: a variant for a knowledge the script is not written for`);
      }
      if (typeof b.him !== 'string' && b.him['*'] === undefined && !sc.k.every(k => (b.him as Record<string, string>)[k] !== undefined)) problems.push(`${B} him: no '*' fallback and not every k covered`);
      if (b.room && s !== 1 && s !== 2) problems.push(`${B}: a room beat past the second press (the menace is the threat, not the payoff)`);
      samLen(`${B} ask`, b.ask); samLen(`${B} after`, b.after); samLen(`${B} take`, b.take); if (b.mild !== undefined) himLen(`${B} mild`, b.mild);
      for (const text of [b.ask, b.after, b.take, b.mild]) if (text) for (const tk of tokensIn(text)) { if (!(TOKENS as readonly string[]).includes(tk)) problems.push(`${B}: unknown token {${tk}}`); else if (!wide.has(tk)) problems.push(`${B}: token {${tk}} is not guaranteed`); }
      if (s === 1 && b.ask) problems.push(`${B}: an 'ask' on the opener (nobody gives at the first exchange)`);
      if ((b.ask || b.take) && !gives.has(s) && !(s === 'x')) problems.push(`${B}: ask / take on a beat a ${sc.t} man never gives at`);
      if (b.room && s === 1 && b.ask) problems.push(`${B}: room opener with an ask`);
    }
  }
  for (const [key, n] of perShapeT) if (n < SCRIPT_VARIANTS_MIN) problems.push(`scripts ${key}: only ${n} written (want ≥ ${SCRIPT_VARIANTS_MIN} variants per shape × temperament)`);
  // every man below sawHurt, on a plain floor with the ordinary useful things live, draws SOME script
  for (const t of TEMPERAMENTS) for (const k of KNOWLEDGE) for (const band of BANDS) {
    if (k === 'sawHurt') continue;
    const ctx = synthCtx(k, band, t, { who: 'lint' }); const talk: Talk = { stage: 0, presses: 0, said: new Set(), saidN: new Map(), given: new Set(), lastT: -1, heldSince: -1, abortT: -1, last: null };
    if (!SCRIPTS.some(sc => scriptFits(sc, ctx, talk))) problems.push(`scripts: nothing fits ${t}·${k}·${band} on a plain floor (door / rollcall / routes live)`);
  }
  // the rooms (a room with no entry gets the menace script's own generic beat)
  for (const [room, list] of Object.entries(ROOM_MENACE)) {
    if (list.length < 2) problems.push(`room '${room}': only ${list.length} variant (want ≥ 2)`);
    list.forEach((r, i) => { const W = `room '${room}' #${i}`; samLen(`${W} sam`, r.sam); if (tokensIn(r.sam).length) problems.push(`${W}: token in the player's threat (rooms stay literal)`); for (const [key, text] of himStrings(r.him)) { himLen(`${W} him/${key}`, text); if (tokensIn(text).some(tk => !TOKENS_ALWAYS.includes(tk as Token))) problems.push(`${W} him/${key}: token not always resolvable`); if (key !== '*' && !(TEMPERAMENTS as string[]).includes(key)) problems.push(`${W} him: bad key '${key}' (rooms vary by temperament only)`); } if (typeof r.him !== 'string' && r.him['*'] === undefined) problems.push(`${W}: no '*' reply`); samLen(`${W} after`, r.after); });
  }
  // the handler
  for (const beat of HANDLER_BEATS) {
    const list = HANDLER_LINES[beat]; if (!list || list.length < 2) { problems.push(`handler '${beat}': ${list?.length ?? 0} exchanges (want ≥ 2)`); continue; }
    list.forEach((x, i) => { const W = `handler '${beat}' #${i}`; for (const [who, text] of [['handler', x.h], ['sam', x.s], ...(x.hNow ? [['handler now', x.hNow] as const] : [])] as const) { orig(`${W} ${who}`, text); dup(`${W} ${who}`, text); const w = text.replace(/\{rack\}/g, '12'); if (w.length > SAM_MAX_CHARS) problems.push(`${W} ${who}: "${w}" is ${w.length} chars (> ${SAM_MAX_CHARS} — the radio strip and the player's bubble are one line)`); if (/\{(?!rack\})/.test(text)) problems.push(`${W} ${who}: only {rack} resolves on the radio`); } });
  }
  // the pairs
  if (AMBIENT_PAIRS.length < 6) problems.push(`pairs: only ${AMBIENT_PAIRS.length} conversations (want ≥ 6)`);
  for (const p of AMBIENT_PAIRS) {
    const W = `pair '${p.id}'`;
    if (ids.has(`pair:${p.id}`)) problems.push(`duplicate pair id ${p.id}`); ids.add(`pair:${p.id}`);
    if (p.lines.length < 2 || p.lines.length > 4) problems.push(`${W}: ${p.lines.length} lines (want 2‥4)`);
    if (p.lines[0]?.who !== 0) problems.push(`${W}: the first line is not the opener's (who 0)`);
    p.lines.forEach((l, i) => { orig(`${W} #${i}`, l.text); dup(`${W} #${i}`, l.text); const w = pairWorst(l.text); if (w.length > AIM_CHARS) problems.push(`${W} #${i}: "${w}" is ${w.length} chars (> ${AIM_CHARS})`); if (/\{(?!other\}|Other\}|code\}|Code\}|padDoor\}|PadDoor\})/.test(l.text)) problems.push(`${W} #${i}: only {other} / {code} / {padDoor} resolve between two men`); if (l.who !== 0 && l.who !== 1) problems.push(`${W} #${i}: who ${l.who}`); });
  }
  // the needs (game/needs.ts): a pool per kind of at least two, the replies, the way back — the same rules as the pairs
  { const NL = NEEDS_LINES; const pools: [string, string[]][] = [...Object.entries(NL.announce).map(([k, v]) => [`needs announce '${k}'`, v] as [string, string[]]), ['needs reply', NL.reply], ['needs replyOther', NL.replyOther], ['needs back', NL.back], ['needs now', Object.values(NL.now)]];
    for (const k of ['coffee', 'smoke', 'water', 'stretch']) { if (!NL.announce[k] || NL.announce[k].length < 2) problems.push(`needs announce '${k}': ${NL.announce[k]?.length ?? 0} lines (want ≥ 2)`); if (!NL.short[k]) problems.push(`needs short '${k}' missing (the radio line names it)`); }
    for (const [W, list] of pools) list.forEach((text, i) => { orig(`${W} #${i}`, text); dup(`${W} #${i}`, text); const w = text.replace(/\{other\}/g, 'Lindqvist'); if (w.length > AIM_CHARS) problems.push(`${W} #${i}: "${w}" is ${w.length} chars (> ${AIM_CHARS})`); if (/\{(?!other\})/.test(text)) problems.push(`${W} #${i}: only {other} resolves here`); });
    const r = NL.radio.replace('{who}', 'Lindqvist').replace('{short}', NL.short.stretch ?? ''); if (r.length > AIM_CHARS) problems.push(`needs radio: "${r}" is ${r.length} chars (> ${AIM_CHARS})`); }
  return problems;
}
/** Coverage matrix for the report / probe: lines per (K × stage), counting a line for every K it can serve ('*' lines under 'any'). */
export function coverageMatrix(): { rows: { k: string; counts: Record<string, number>; total: number }[]; total: number; intel: number } {
  const rows = [...KNOWLEDGE, '*' as const].map(k => { const counts: Record<string, number> = {}; let total = 0; for (const s of STAGES) { const n = LINES.filter(l => l.k === k && l.s === s).length; counts[String(s)] = n; total += n; } return { k: k === '*' ? 'any (needs-gated)' : k, counts, total }; });
  let intel = 0; for (const kind of INTEL_KINDS) intel += Object.values(INTEL_TEXT[kind]).filter(Boolean).length;
  return { rows, total: LINES.length, intel: intel + 1 };   // (+1: the checker's own variant of checkOn, inline in gather)
}
/** Sam's table for the report / probe: per category, how many lines need nothing / name the gun / the arm (or its blade) / a temperament / a knowledge / the floor; the 'q' lines per useful thing; and the 'key' remarks. */
export function samCoverage(): { rows: { s: SamStage; plain: number; gun: number; arm: number; t: number; k: number; floor: number; total: number }[]; q: Partial<Record<IntelKind, number>>; key: number; total: number } {
  const rows = SAM_STAGES.map(s => { const L = SAM_LINES.filter(l => l.s === s); return { s, plain: L.filter(l => !l.t && !l.k && !l.needs?.length).length, gun: L.filter(l => l.needs?.includes('gun')).length, arm: L.filter(l => l.needs?.includes('arm') || l.needs?.includes('knife')).length, t: L.filter(l => !!l.t).length, k: L.filter(l => !!l.k).length, floor: L.filter(l => l.needs?.some(n => n === 'blackout' || n === 'alarm' || n === 'calm' || n === 'lockdown' || n === 'heldLong')).length, total: L.length }; });
  const q: Partial<Record<IntelKind, number>> = {}; for (const l of SAM_LINES) if (l.s === 'q' && l.q) q[l.q] = (q[l.q] ?? 0) + 1;
  return { rows, q, key: SAM_LINES.filter(l => l.s === 'key').length, total: SAM_LINES.filter(l => l.s !== 'script').length };
}
/** The scripts for the report / probe: per shape, the temperaments written (× how many scripts), the knowledge and bands they are written for, the pin. */
export function scriptCoverage(): { shape: ShapeKey; byT: Partial<Record<Temperament, number>>; k: string; band: string; pin: string; total: number }[] {
  return SHAPES.map(shape => { const L = SCRIPTS.filter(sc => sc.shape === shape); const byT: Partial<Record<Temperament, number>> = {}; for (const sc of L) byT[sc.t] = (byT[sc.t] ?? 0) + 1;
    const ks = new Set<string>(), bs = new Set<string>(); for (const sc of L) { sc.k.forEach(k => ks.add(k)); (sc.band ?? BANDS).forEach(b => bs.add(b)); }
    return { shape, byT, k: [...ks].join('/'), band: [...bs].join('/'), pin: L.find(sc => sc.pin)?.pin ?? '—', total: L.length }; });
}
/** Every line each speaker can say, worst-case expanded, for the length report: the men (pools, scripts' answers, useful things with their worst lead, rooms'
 *  replies, the pairs) and Sam (pools, scripts, rooms, the radio). The probe prints the share at or under AIM_CHARS and the longest few. */
export function lineLengthReport(): { men: { where: string; text: string }[]; sam: { where: string; text: string }[] } {
  const worst = (text: string) => expand(text, tokenWorst()) ?? text;
  const men: { where: string; text: string }[] = [], sam: { where: string; text: string }[] = [];
  for (const l of LINES) for (const text of w([l.now ?? l.text, l.away, l.bare], [l.text])) if (text) men.push({ where: `pool ${l.id}`, text: worst(text) });
  for (const l of SAM_LINES) if (l.s !== 'script') for (const text of w([wg(l.guide, undefined) ?? l.now ?? l.text, l.away], [l.text])) if (text) sam.push({ where: `pool ${l.id}`, text: worst(text) });
  for (const kind of INTEL_KINDS) for (const [tk, text] of Object.entries(intelTable(kind))) if (text) men.push({ where: `intel ${kind}/${tk}`, text: ((SHAPES as string[]).includes(tk.split(':')[0]) || tk.startsWith('sc:') ? '' : '…All right. ') + worst(text) });
  for (const sc of SCRIPTS) for (const s of STAGES) { const b = sc.beats[s]; if (!b) continue; if (!b.room) { sam.push({ where: `${sc.id}:${String(s)} sam`, text: worst(wg(b.samNow ?? b.sam, b.sam)) }); for (const [key, text] of (typeof b.him === 'string' ? [['*', b.him]] : Object.entries(b.him))) men.push({ where: `${sc.id}:${String(s)} him/${key}`, text: worst(text) }); } if (b.ask) sam.push({ where: `${sc.id}:${String(s)} ask`, text: worst(b.ask) }); if (b.after) sam.push({ where: `${sc.id}:${String(s)} after`, text: worst(b.after) }); if (b.take) sam.push({ where: `${sc.id}:${String(s)} take`, text: worst(b.take) }); if (b.mild) men.push({ where: `${sc.id}:${String(s)} mild`, text: worst(b.mild) }); }
  for (const [room, list] of Object.entries(ROOM_MENACE)) list.forEach((r, i) => { sam.push({ where: `room ${room} #${i}`, text: r.sam }); for (const [key, text] of (typeof r.him === 'string' ? [['*', r.him]] : Object.entries(r.him))) men.push({ where: `room ${room} #${i} him/${key}`, text: worst(text) }); if (r.after) sam.push({ where: `room ${room} #${i} after`, text: r.after }); });
  for (const beat of HANDLER_BEATS) (HANDLER_LINES[beat] ?? []).forEach((x, i) => { sam.push({ where: `radio ${beat} #${i} sam`, text: x.s.replace(/\{rack\}/g, '12') }); sam.push({ where: `radio ${beat} #${i} handler`, text: wg(x.hNow ?? x.h, x.h).replace(/\{rack\}/g, '12') }); });
  for (const p of AMBIENT_PAIRS) p.lines.forEach((l, i) => men.push({ where: `pair ${p.id} #${i}`, text: pairWorst(l.text) }));
  return { men, sam };
}

// ================================================================================================================================================================
// SCRIPTS — the shapes (G7). Everything above picks from pools; everything below is the authored exchanges the pools now stand behind.
// ================================================================================================================================================================
/** Taste constants, one line each (the maintainer's to turn):
 *    RAMBLE_SWALLOWS  1 = the rambler's stream eats his first giving press when exactly one thing is pending (it lands a press later, never lost); 0 = never
 *    STOIC_BITE       1 = the stoic's (and anyone's) last word is the insult as written; 0 = the `mild` line where a beat carries one
 *    SCRIPT_ROTATE    true = a shape / script already played this session ranks behind the unplayed for the next man; false = the pure hash of his callsign
 *    REJOINDERS       true = Sam's third turn (a beat's `after` / `take`) goes up once the answer is down; false = two turns a press, the old pacing exactly
 *    TALK_TUNE.scripts  false = no scripts at all, every hold from the pools (the probes' A/B; play never touches it) */
export const RAMBLE_SWALLOWS: number = 1;
export const REJOINDERS: boolean = true;
export const STOIC_BITE: number = 1;
export const SCRIPT_ROTATE: boolean = true;
export const TALK_TUNE = { scripts: true };

/** The man's side of a beat: one line, or lines keyed by what he knows of Sam ('none' | 'heard' | …) or — in the room table — by his temperament, with '*' the rest. */
export type Him = string | Record<string, string>;
/** One press of a script. `sam` then `him`; `after` = Sam's rejoinder once the answer is down (Hold.after). At a press where the man GIVES the useful thing,
 *  `ask` (if written) is Sam's line instead, the useful thing is the answer, and `take` (if written) the rejoinder — so a beat reads right whether or not he
 *  had anything to give. `room` = Sam's line and the answer come from ROOM_MENACE for the room they stand in (the beat's own pair when the room has no entry).
 *  `mild` = the answer when STOIC_BITE is 0. */
export interface Beat { sam: string; him: Him; after?: string; ask?: string; take?: string; room?: boolean; mild?: string; /** (WORDS.guide) the player's line as the writing guide has it (read where the beat is said) */ samNow?: string; }
export interface Script {
  id: string; shape: ShapeKey; t: Temperament;
  k: Knowledge[];                 // what he may know of Sam for this to be his script (never sawHurt) — dealt on it, and dropped mid-hold if his knowledge climbs past it
  band?: Band[];                  // how rattled, at the deal (omitted = any)
  needs?: Need[]; not?: Need[];   // floor facts that must / must not hold at the deal (nobody who heard gunfire buys an audit)
  pin?: IntelKind;                // the useful thing the script is built round: dealt only while it is the FIRST thing pending, and given first at his giving press
  beats: Record<StageKey, Beat>;
}
const scriptByTalk = new SideMap<Talk, Script | null>('dialogue.scriptByTalk');
const forcedByTalk = new SideMap<Talk, string | null>('dialogue.forcedByTalk');
/** QA: make this man's NEXT deal a named script (or null = the pools), whatever would have been dealt. Cleared by the deal it forces. */
export function forceScript(talk: Talk, id: string | null) { scriptByTalk.delete(talk); forcedByTalk.set(talk, id); }
/** the deal forced on this man and not yet made (a checkpoint carries it on: game/savestate.ts), undefined = none pending */
export function forcedScriptOf(talk: Talk): string | null | undefined { return forcedByTalk.has(talk) ? forcedByTalk.get(talk)! : undefined; }
/** the script this man's hold plays, if one has been dealt (read-only peek: never deals) */
export function peekScript(talk: Talk): Script | null { return scriptByTalk.get(talk) ?? null; }
export function scriptById(id: string): Script | null { return SCRIPTS.find(sc => sc.id === id) ?? null; }
/** The script for this man: the one already dealt this encounter (kept for the hold, and for a man grabbed again), else — at his FIRST exchange only — dealt now:
 *  of the scripts that fit him and the moment (scriptFits), the ones whose shape and text this session has not yet played rank first (SCRIPT_ROTATE, off
 *  ctx.recent), then a stable hash of his callsign decides; null when nothing fits (sawHurt, a synthetic nobody) or he is met past his first exchange. */
export function scriptFor(ctx: DialogueCtx, talk: Talk): Script | null {
  if (scriptByTalk.has(talk)) return scriptByTalk.get(talk)!;
  let sc: Script | null = null;
  if (forcedByTalk.has(talk)) { const id = forcedByTalk.get(talk)!; forcedByTalk.delete(talk); sc = id ? scriptById(id) : null; }
  else if (TALK_TUNE.scripts && talk.stage === 0) {
    const fits = SCRIPTS.filter(x => scriptFits(x, ctx, talk));
    if (fits.length) {
      const played = (key: string) => SCRIPT_ROTATE && !!ctx.recent?.has(key);
      fits.sort((a, b) => (Number(played(`script:${a.id}`)) - Number(played(`script:${b.id}`))) || (Number(played(`shape:${a.shape}`)) - Number(played(`shape:${b.shape}`))) || (hashStr(`${ctx.who}|${a.id}`) - hashStr(`${ctx.who}|${b.id}`)));
      sc = fits[0];
    }
  }
  if (sc && ctx.recent) { ctx.recent.set(`script:${sc.id}`, ctx.time); ctx.recent.set(`shape:${sc.shape}`, ctx.time); }
  scriptByTalk.set(talk, sc);
  return sc;
}
/** Does this script fit the man and the moment: his temperament, what he knows, how rattled, the floor facts it asks for / rules out, its pinned useful thing
 *  pending, and every line it would say to HIM resolving now (a man with no colleague left does not draw a script that names one). */
export function scriptFits(sc: Script, ctx: DialogueCtx, talk: Talk): boolean {
  if (sc.t !== ctx.t || !sc.k.includes(ctx.k)) return false;
  if (sc.band && !sc.band.includes(ctx.band)) return false;
  if (sc.needs?.some(n => !ctx.facts[n]) || sc.not?.some(n => !!ctx.facts[n])) return false;
  if (sc.pin && pendingIntel(ctx, talk, null)[0]?.kind !== sc.pin) return false;   // (built round it: dealt only when it is the FIRST thing he would give anyway — a live radio check or an errand outranks the key and gets another script)
  for (const s of STAGES) { const b = beatFor(sc, s, ctx); for (const text of [b.sam, b.ask, b.after, b.take, b.mild]) if (text && expand(text, ctx.tokens) === null) return false; if (!himOf(b, ctx)) return false; }
  return true;
}
/** still his script this press: his knowledge of Sam has not climbed past what it was written for (a shot rang out while he was held: he answers from the pools now) */
export function scriptLive(sc: Script, ctx: DialogueCtx): boolean { return sc.k.includes(ctx.k); }
/** the beat for stage s — a `room` beat swapped for the room's own menace where the table has the room (variant dealt off his callsign) */
export function beatFor(sc: Script, s: StageKey, ctx: DialogueCtx): Beat {
  const b = sc.beats[s]; if (!b.room) return b;
  const list = ctx.ownRooms ? undefined : ROOM_MENACE[ctx.tokens.room ?? '']; if (!list?.length) return b;   // (the table is the office's furniture: a corridor of another level has no copier)
  const r = list[hashStr(`${ctx.who}|room|${sc.id}`) % list.length];
  return { ...b, sam: r.sam, samNow: undefined, him: r.him, after: r.after ?? b.after };
}
/** the man's line off a beat for THIS man: by his knowledge, else his temperament, else '*'; STOIC_BITE 0 takes `mild` where written; null if it does not resolve */
export function himOf(b: Beat, ctx: DialogueCtx): { text: string; k: Knowledge | '*' } | null {
  let raw: string | undefined; let k: Knowledge | '*' = '*';
  if (STOIC_BITE === 0 && b.mild) raw = b.mild;
  else if (typeof b.him === 'string') raw = b.him;
  else if (b.him[ctx.k] !== undefined) { raw = b.him[ctx.k]; k = ctx.k; }
  else raw = b.him[ctx.t] ?? b.him['*'];
  if (raw === undefined) return null;
  const text = expand(raw, ctx.tokens); return text ? { text, k } : null;
}

/** ENVIRONMENTAL MENACE: the threat is where they are standing (the `menace` scripts' room beat). Keyed by the room as the men say it (roomName); each entry
 *  Sam's threat + the reply ('*', or by temperament — hard men give it two words). Rooms this level does not have (a stairwell) wait here for the next one;
 *  a room with no entry gets the script's own generic beat. */
export interface RoomLine { sam: string; him: Him; after?: string; }
export const ROOM_MENACE: Record<string, RoomLine[]> = {
  'the server room': [
    { sam: 'Server room. Know what the fire gas does to lungs?', him: { '*': "They made us watch a video. I'd rather not be in the sequel.", hard: 'Roughly.' } },
    { sam: "Cold aisle's four degrees. I can wait in it. Can you?", him: { '*': "I'm in a polo shirt. This was already unfair.", hard: 'Wore a vest.' } },
    { sam: 'Lot of cable in here. Tidy loops. Strong ties.', him: { '*': "I did those loops. Don't make me regret neatness.", hard: 'I tied them. They hold.' } },
  ],
  'the break room': [
    { sam: 'That chest freezer takes a man who folds.', him: { '*': "It's full of someone's batch cooking. …Mostly full.", hard: "It's full. Lunches. I checked." } },
    { sam: 'I could make you drink from the jug on the left.', him: { '*': "That's stewed since six. That's not a threat, that's a grievance.", hard: 'I drink that. Try harder.' } },
    { sam: 'Microwave still does that sparking thing?', him: { '*': "Only with foil. …You'd find foil, wouldn't you.", hard: 'Unplugged it myself.' } },
  ],
  'the car park': [
    { sam: 'Long ramp. Handbrakes fail more than people think.', him: { '*': 'Mine did, once. Nobody believed me then either.', hard: 'I take the bus.' } },
    { sam: 'Nobody hears anything down a ramp.', him: { '*': "They don't hear anything UP it. I've radioed for a year.", hard: 'I noticed.' } },
  ],
  'the conference room': [
    { sam: 'Conference room. I could make you present the quarter.', him: { '*': "I've seen the numbers. That's crueller than the arm.", hard: 'Seen worse decks.' } },
    { sam: "Forty chairs. I'll sit you in the one that squeaks.", him: { '*': "Facing the projector? That's sick. …Sorry. Sir.", hard: 'I oil that one.' } },
    { sam: 'Whiteboard says Q3 TARGETS. Want to be a bullet point?', him: { '*': "There's no room. They never wipe it. It's from two Q3s ago.", hard: 'Wipe it first.' } },
  ],
  'the corridor': [
    { sam: "There's a shredder by the copier. Cross-cut.", him: { '*': "It jams on three sheets. You'd be there all night. …So would I.", hard: 'It jams.' } },
    { sam: 'Confidential waste bin. Locked lid. Roomy.', him: { '*': 'They only empty it Thursdays. …What day is it.', hard: 'Thursdays. Plan ahead.' } },
    { sam: 'Long corridor. Very polished. You ever been curled?', him: { '*': "I signed off that polish. I'd feel involved.", hard: 'Floor is level. Checked.' } },
  ],
  'the lobby': [
    { sam: 'Lot of glass in a lobby. All of it loud.', him: { '*': "The big pane's already cracked. Facilities know. Facilities 'know'.", hard: 'Glass is glass.' } },
    { sam: 'Reception has a bell. I could ring it with you.', him: { '*': "Nobody comes when you ring it. That's the frightening part.", hard: 'Nobody comes.' } },
    { sam: 'Revolving door still catching heels?', him: { '*': "It took a courier's shoe in May. We've still got the shoe.", hard: 'I use the side door.' } },
  ],
  'the cubicles': [
    { sam: 'Forty desks. Forty staplers. Think about it.', him: { '*': 'Half are empty. The desks, not the— well. Both.', hard: 'Thought. Unmoved.' } },
    { sam: 'Partitions. Nobody sees over. Nobody looks.', him: { '*': "Someone's put a 'hang in there' kitten up. I'd see that. Last.", hard: 'I look.' } },
    { sam: 'That laminator runs hot. Takes a while to notice.', him: { '*': "It's signed out to me. Everything bad here is signed out to me.", hard: 'Signed it back in.' } },
  ],
  "the manager's office": [
    { sam: "Manager's office. Heavy award on that desk.", him: { '*': "'Regional Excellence'. It's acrylic. It'd still hurt.", hard: 'Acrylic.' } },
    { sam: "Nice letter opener. She won't miss it till Monday.", him: { '*': "She'd miss it. She'd email about it. All staff. Twice.", hard: "She'd notice." } },
  ],
  'the storage room': [
    { sam: 'Shelving to the ceiling. Badly anchored.', him: { '*': "I reported that! There's a ticket! …Don't close the ticket.", hard: 'I anchored it.' } },
    { sam: 'Lot of toner in here. You know what toner does?', him: { '*': 'Gets everywhere? …Oh. You mean worse than everywhere.', hard: 'Gets on you too.' } },
  ],
  'the back offices': [
    { sam: 'Drop ceiling. Lots of room up there.', him: { '*': "There's a pigeon up there since March. We named it. Don't.", hard: 'After you.' } },
    { sam: 'Nobody comes down here. I checked the dust.', him: { '*': "The cleaners skip it. I don't blame them. I blame them a bit.", hard: 'I come down here.' } },
  ],
  'the stairwell': [
    { sam: "Four flights. Handrail's loose on two of them.", him: { '*': 'I put the tape on it! The tape IS the fix!', hard: 'I use the lift.' } },
    { sam: 'Stairwells echo. Once.', him: { '*': "That's— yes. I've dropped keys in here. Everyone knew.", hard: 'So whisper.' } },
  ],
};

/** what most scripts are written for: a man who never had Sam plainly in view (KN), or one who may have hunted him too (KS — its openers answer to that) */
const KN: Knowledge[] = ['none', 'heard', 'glimpsed'], KS: Knowledge[] = ['none', 'heard', 'glimpsed', 'saw'];
/** The scripts. Three or more per (shape × temperament) written; ids '<shape>-<t><n>'. Sam: dry, low, tired, exact — a threat is said once. The men: people on
 *  bad pay in a tower after hours. Every string here is original to this project (ORIGINALITY_BLOCKLIST keeps it so). Sam ≤ SAM_MAX_CHARS, the men aim at
 *  AIM_CHARS. Steady men give at their third press, nervy at the second (and third), hard at the third once rattled — the `ask` / `take` sit on those beats. */
export const SCRIPTS: Script[] = [
  // ================================================================ STEADY
  // ---- count pedantry: asked how many, he wants the arithmetic defined; the definition becomes the threat; the number is exact ({up})
  { id: 'pedant-s1', shape: 'pedant', t: 'steady', k: KN, band: ['low', 'mid'], needs: ['office'], beats: {
    1: { sam: 'How many of you on tonight? Whisper it.', him: 'On tonight, or on this floor? Those are different lists.' },
    2: { sam: 'The list that gets shorter if you stall.', him: '…Floor. You mean floor. {Up}, counting me. Sorry— nerves.' },
    3: { sam: 'Good. Now something I cannot count myself.', him: "That's the lot. I count things. It's most of the job." },
    x: { sam: 'Still {up}?', him: "Unless you've been busy. …Please don't answer that." } } },
  { id: 'pedant-s2', shape: 'pedant', t: 'steady', k: KN, band: ['low', 'mid'], needs: ['office'], beats: {
    1: { sam: 'Head count. This floor. Now.', him: 'Counting how — bodies present, or badged in? They drift.' },
    2: { sam: "Count the ones who'd miss you.", him: "…That's a smaller number. {Up} present. Me included." },
    3: { sam: 'See, you round beautifully. Next fact.', him: "There isn't a next fact. I peaked at counting." },
    x: { sam: 'Any advance on {up}?', him: "It's not an auction. …{Up}. Final answer. Please stop bidding." } } },
  { id: 'pedant-s3', shape: 'pedant', t: 'steady', k: KN, band: ['low', 'mid'], needs: ['office'], beats: {
    1: { sam: 'Numbers. How many walking this floor?', him: 'Walking right now, or rostered? Two of them sit down a lot.' },
    2: { sam: "The arm doesn't take footnotes.", him: "{Up}. Call it {up}. Including the one you're wearing." },
    3: { sam: 'Now where the other feet go.', him: 'I only do my stretch— {route}. The rest is rumour and biscuits.' },
    x: { sam: "You've gone quiet. Recounting?", him: 'Checking my working. Still {up}. Still including me, ideally.' } } },
  // ---- the self-own: Sam doubts he even works here; he proves it with the keyed door and hears himself do it (pin: door → the key comes off his belt at 3)
  { id: 'selfown-s1', shape: 'selfown', t: 'steady', k: KS, pin: 'door', needs: ['office'], beats: {
    1: { sam: "You're not staff. Staff would have heard me.", him: { '*': "I am staff. Eleven years. There's a photo on the lanyard. Look.", saw: 'Staff enough to chase you round {sawWhere}. Eleven years.' } },
    2: { sam: 'Anyone can print a lanyard. Staff know the doors.', him: "I know the doors. {Door}'s keyed and mine's on my— …no." },
    3: { sam: 'Finish the sentence. Then I finish with the arm.', him: 'There is no end to that sentence. It just stops there. Forever.' },
    x: { sam: "Anything else you'd like to prove?", him: "No. I'm done proving things. Clearly not my strength." } } },
  { id: 'selfown-s2', shape: 'selfown', t: 'steady', k: KS, pin: 'door', needs: ['office'], beats: {
    1: { sam: "Contract badge. You don't know this floor.", him: { '*': 'Better than the day lot. Try me. …On reflection, do not try me.', saw: 'I knew it well enough to spot you in it. Briefly.' } },
    2: { sam: "Bet you can't even open {door}.", him: "Course I can, it's only the key off my— I see what you did there." },
    3: { sam: 'So finish it. Slowly. Hands still.', him: 'Nothing to finish. I trail off professionally. Years of practice.' },
    x: { sam: "You've gone shy.", him: "I'm reviewing everything I've ever said out loud. It's a long list." } } },
  { id: 'selfown-s3', shape: 'selfown', t: 'steady', k: KS, pin: 'door', needs: ['office'], beats: {
    1: { sam: "You're the temp. Temps know nothing.", him: { '*': "Permanent nights, thank you. I've a drawer with my name on it.", saw: 'The temp nearly had you in {sawWhere}. Permanent, actually.' } },
    2: { sam: 'A drawer. Not a key, though.', him: 'Keys, plural. One for {door}, on my— …that was the whole trick, was it.' },
    3: { sam: 'It was. Where.', him: 'Nowhere. I own a drawer and no keys. Write that down.' },
    x: { sam: 'Tell me about the drawer.', him: 'No. The drawer stays between me and the drawer.' } } },
  // ---- the fan: delighted to be held by somebody competent; the useful thing falls out as an aside (INTEL fan variants); Sam wants to go home
  { id: 'fan-s1', shape: 'fan', t: 'steady', k: KN, band: ['low'], beats: {
    1: { sam: 'Not a word.', him: "…You're an actual professional. Aren't you. Sorry— whispering. Wow." },
    2: { sam: "This is the part where you're frightened.", him: 'I am! Bit of both. Is the arm thing hard to learn? Roughly?' },
    3: { sam: 'One useful thing. Then you can gush.', him: "I don't know anything useful. I know YOU now. That's huge for me.", take: 'There it is. Thank you. Stop smiling.' },
    x: { sam: 'We never met.', him: "Course not. …Can I say I met 'someone'? No details. A vibe." } } },
  { id: 'fan-s2', shape: 'fan', t: 'steady', k: KN, band: ['low'], beats: {
    1: { sam: 'Easy. Hands where they are.', him: "They're staying. Are those the goggles that— they are. Brilliant." },
    2: { sam: 'You should be more worried.', him: "Oh, I'm terrified. Do you lot get dental? Genuine question." },
    3: { sam: 'Question for question. Mine first.', him: "I've nothing worth trading. Nights, mate. They give us a torch.", take: 'Good. And no. No dental.' },
    x: { sam: 'Forget my face.', him: 'Never saw it. Felt the forearm, though. Textbook. Shutting up.' } } },
  { id: 'fan-s3', shape: 'fan', t: 'steady', k: KN, band: ['low'], needs: ['office'], beats: {
    1: { sam: 'Shh.', him: "Twenty years reading about this stuff and it happens on MY floor." },
    2: { sam: "Focus. You're being held.", him: 'I know! Properly, too. Is there a course? Evening classes?' },
    3: { sam: "Tell me something and I'll say there's a course.", him: "I've got nothing. Ask me anything, though. Love a quiz.", take: "There's no course." },
    x: { sam: 'Not a word to anyone.', him: "Who'd believe me? …I'll know, though. Quietly. For years." } } },
  // ---- the con: an unannounced audit / pen test / drill assessment; he is proud to comply; the penny drops on the last press (calm floors, calm men only)
  { id: 'con-s1', shape: 'con', t: 'steady', k: ['none', 'heard'], band: ['low', 'mid'], not: ['heardShots', 'bodyKnown', 'floorUp', 'heardBang'], needs: ['office'], beats: {
    1: { sam: 'Security audit. Unannounced. Badge number.', him: 'Oh— {badge}. Is this the fire-door thing? I flagged that. Twice.' },
    2: { sam: "I ask, you answer. That's the audit.", him: "Sorry. Yes. It's just— nobody audits nights. Ever. Carry on." },
    3: { sam: 'Item three. Staffing and access. Go.', him: "Staffing's thin and access is a joke. Quote me. Please quote me.", take: 'Very thorough. Head office will be thrilled.' },
    x: { sam: 'That concludes the audit.', him: "…Auditors don't usually do the arm, do they. Thinking about it." } } },
  { id: 'con-s2', shape: 'con', t: 'steady', k: ['none', 'heard'], band: ['low', 'mid'], not: ['heardShots', 'bodyKnown', 'floorUp', 'heardBang'], needs: ['office'], beats: {
    1: { sam: "Penetration test. You're doing well so far.", him: 'Am I? Brilliant. Do I get a— is there a certificate at the end?' },
    2: { sam: 'Depends on the next answers.', him: 'Right. Focused. This is my certificate face.' },
    3: { sam: "Walk me through tonight's cover.", him: "Cover's me, a torch and optimism. Put 'optimism'. It sounds funded.", take: "Textbook. I'll mention you by badge." },
    x: { sam: 'Test complete.', him: "You're not writing any of this dow— oh. Oh, I see. Oh no." } } },
  { id: 'con-s3', shape: 'con', t: 'steady', k: ['none', 'heard'], band: ['low', 'mid'], not: ['heardShots', 'bodyKnown', 'floorUp', 'heardBang'], needs: ['office'], beats: {
    1: { sam: "Fire drill assessment. Don't turn round.", samNow: "Fire drill assessment. Don't turn around.", him: "Finally. I've said for years the night drill is a work of fiction." },
    2: { sam: "Assessors don't chat. Badge.", him: "{Badge}. Sorry. It's just nice to be assessed for once." },
    3: { sam: "Muster procedure. Who's where.", him: "Muster's the car park. It's always the car park. Rain or rain.", take: 'Exemplary. Gold star.' },
    x: { sam: 'Drill over. As you were.', him: 'Hang on. Assessors come in through the FRONT.' } } },
  // ---- the arbitrary game: a nonsense rule, kept with total seriousness; the rule pays off on the last press
  { id: 'game-s1', shape: 'game', t: 'steady', k: KS, beats: {
    1: { sam: "New rule. You don't say 'basically'.", him: { '*': "I— fine. I wasn't going to. …Was I? Now I can feel it queuing.", saw: 'You had a gun on you an hour ago and THIS is the rule. Fine.' } },
    2: { sam: 'Rule two. Count down from seven. Slowly.', him: 'Seven. Six. Why seven— five. Four.' },
    3: { sam: 'Hold at four. Now something useful.', him: "Useful. Er. Three? No— that's counting again. Sorry. Four.", take: 'Good. Stay at four.' },
    x: { sam: 'You may finish.', him: 'Three, two, one. So basic— NO. Nearly. So nearly.' } } },
  { id: 'game-s2', shape: 'game', t: 'steady', k: KS, needs: ['office'], beats: {
    1: { sam: "Blink twice if you've ever validated parking.", him: { '*': "That's— twice. There. What have I just admitted to?", saw: 'Hunted you all night and you open with PARKING. …Twice. There.' } },
    2: { sam: 'Everything. Now hum. One note. Low.', him: 'Mmmm— this is the strangest thing that has ever— mmmm.' },
    3: { sam: 'Stop humming. Talk.', him: "About what? You've had blinking AND humming. I'm out of face.", take: 'Better than the humming.' },
    x: { sam: 'Resume humming.', him: "Mmmm. …I've lost the note. Was it this one? Mmmm? Lower?" } } },
  { id: 'game-s3', shape: 'game', t: 'steady', k: KS, beats: {
    1: { sam: "Every answer starts with 'respectfully'. Go.", him: { '*': 'Respectfully— what? Respectfully, what was the question?', saw: 'Respectfully, I nearly had you earlier. Respectfully.' } },
    2: { sam: "There wasn't one. Well done.", him: 'Respectfully, this is a very odd night for a Tuesday sort of man.' },
    3: { sam: 'Respectfully, tell me something.', him: "Respectfully, I've got nothing. With the greatest respect. Nothing.", take: "You dropped the 'respectfully'. I'll allow it." },
    x: { sam: 'Dismissed.', him: "Respectfully— can I stop now? It's stuck in my mouth. Respectfully." } } },
  // ---- environmental menace: the threat is the room (beat 2 from ROOM_MENACE; the beat's own pair where the room is unnamed)
  { id: 'menace-s1', shape: 'menace', t: 'steady', k: KS, needs: ['office'], beats: {
    1: { sam: 'Look around. Tell me where we are.', him: { '*': '{Room}. …Why, where did you think you were?', saw: '{Room}. Same floor I chased you round. Smaller, now.' } },
    2: { sam: 'Quiet corner. Nobody walks past for hours.', him: "I walk past. That's the job. …I see the flaw in that now.", room: true },
    3: { sam: 'So. Something useful, or the tour continues.', him: "Nothing useful. Continue the tour. I've had worse shifts. Just." },
    x: { sam: 'Enjoy {room}.', him: 'I used to.' } } },
  { id: 'menace-s2', shape: 'menace', t: 'steady', k: KS, needs: ['office'], beats: {
    1: { sam: 'You know this floor. Every room.', him: { '*': "Every bin, every squeaky tile. Small life, but it's indexed.", saw: 'Well enough to nearly corner you in it. Nearly is the word.' } },
    2: { sam: 'Then you know what in here would hurt.', him: 'The chairs, long term. Short term— you, I assume.', room: true },
    3: { sam: 'Or you tell me what I need.', him: 'You need a different hostage. Said with respect. And urgency.' },
    x: { sam: "We'll stay here a while.", him: "Fine. It's warmer than {route}." } } },
  { id: 'menace-s3', shape: 'menace', t: 'steady', k: KS, needs: ['office'], beats: {
    1: { sam: 'Nice spot you picked to stand in.', him: { '*': "I didn't pick it. There's a rota. The rota picked it.", saw: 'I was standing in it looking for YOU. The rota will hear of this.' } },
    2: { sam: "Rota didn't mention the sharp edges in here.", him: 'Health and safety did. Laminated sign. Nobody reads laminate.', room: true },
    3: { sam: 'Talk, and we both leave {room}.', him: "I've nothing. We live here now. I'll show you where the kettle is." },
    x: { sam: 'Comfortable?', him: 'In {room}? Nobody ever has been. There was a survey.' } } },
  // ================================================================ NERVY (gives at his second press, and the third if there is more: `ask` / `take` on both)
  // ---- count pedantry, panicked: the clarifying question is a spiral; the number keeps coming back, checked and rechecked
  { id: 'pedant-n1', shape: 'pedant', t: 'nervy', k: KN, band: ['low', 'mid'], beats: {
    1: { sam: 'How many of you tonight? Quietly.', him: 'Including me? Including YOU? Sorry— is that a trick one—' },
    2: { sam: 'Including anyone with a radio. Go.', him: '{Up}! {Up}. Including me. Not you. Unless— no. {Up}.', take: 'And breathe. In through the number.' },
    3: { sam: 'You never actually said the number.', ask: "Keep going. You're on a roll.", him: '{Up}! Sorry! {Up}. I panicked about the rounding.' },
    x: { sam: 'Final count?', him: "{Up}. Wait— still {up}? You'd tell me. You wouldn't tell me." } } },
  { id: 'pedant-n2', shape: 'pedant', t: 'nervy', k: KN, band: ['low', 'mid'], needs: ['office'], beats: {
    1: { sam: 'Staff on this floor. A number.', him: 'A number or THE number? They come apart after midnight—' },
    2: { sam: "The one that's true right now.", him: '{Up}. True right now. Ask again in a minute and I— sorry. {Up}.', take: 'See. True things. More of those.' },
    3: { sam: 'What else is true right now?', ask: 'What else is true right now?', him: "My arm's asleep and there's {up} of us. That's everything true." },
    x: { sam: 'Recount.', him: "{Up}. …You're not writing any of this down, are you. Nobody does." } } },
  { id: 'pedant-n3', shape: 'pedant', t: 'nervy', k: KN, band: ['low', 'mid'], needs: ['office'], beats: {
    1: { sam: 'How many on shift?', him: 'Shift or floor? Payroll says one thing, the floor says—' },
    2: { sam: 'Say the floor thing.', him: "{Up}. Floor says {up}. Payroll's a liar anyway.", take: 'The floor thing. Good. Stay on the floor.' },
    3: { sam: 'More floor things.', ask: 'More floor things.', him: "That's all the floor says. The floor's not chatty. I am. Sorry." },
    x: { sam: 'Last count.', him: "{Up}, and I'd like to stay in it. The count. Keep me in the count." } } },
  // ---- the self-own, sprung at once: he proves he works here with the keyed door before Sam has finished doubting it (pin: door → given at 2)
  { id: 'selfown-n1', shape: 'selfown', t: 'nervy', k: KS, pin: 'door', needs: ['office'], beats: {
    1: { sam: "You don't work here. Where's your badge?", him: { '*': "I DO— badge, radio, key to {door}, all here on my— oh no.", saw: 'I DO— I CHASED you— key to {door} right here on my— oh no.' } },
    2: { sam: "You've gone pale. Finish the thought.", ask: 'Go on. You were doing so well.', him: "There's no thought. Thought's gone. I'm mostly lanyard now." },
    3: { sam: 'Anything else on that belt?', ask: 'What else is on you? Keep declaring.', him: 'I walked straight into that. My sister says I do that. At weddings.' },
    x: { sam: 'Anything else to declare?', him: "A packed lunch and poor judgement. That's the lot. That's me." } } },
  { id: 'selfown-n2', shape: 'selfown', t: 'nervy', k: KS, pin: 'door', needs: ['office'], beats: {
    1: { sam: "Agency cover? You've never seen this floor.", him: { '*': 'Three years! I know every door— {door} sticks, you jiggle it—', saw: 'Three years! I nearly HAD you— and {door} sticks, you jiggle—' }, after: 'Do you.' },
    2: { sam: 'Which key.', ask: 'Which key would that be.', him: 'No key. Figure of speech. We jiggle… morale. Nothing else.' },
    3: { sam: 'Noted. Anything further?', ask: 'Noted. Keep being helpful.', him: "I'd like it noted I was helpful BEFORE I was stupid. In that order." },
    x: { sam: 'Noted.', him: 'Is it? Is there a form? There is always, always a form.' } } },
  { id: 'selfown-n3', shape: 'selfown', t: 'nervy', k: KS, pin: 'door', needs: ['office'], beats: {
    1: { sam: "You're lost. Visitors sign in downstairs.", him: { '*': 'VISITOR? I lock up! {Door}, nightly, with my own—', saw: 'VISITOR? I nearly CAUGHT you! I lock {door} with my own—' }, after: 'Own what.' },
    2: { sam: "Say it. You'll feel better.", ask: "Say 'key'. You'll feel better.", him: '…breath. My own breath. I lock up by breathing on it. Firmly.' },
    3: { sam: 'Anything else you lock up?', ask: 'Anything else you lock up?', him: "My bike. Badly, it turns out. It's been a year of this." },
    x: { sam: 'Deep breaths.', him: "That's what the wellness app says. The app has never met you." } } },
  // ---- the over-cooperator: folds before the question ends; Sam is thrown; pressed again he volunteers something useless and very specific
  { id: 'folder-n1', shape: 'folder', t: 'nervy', k: KS, band: ['low', 'mid'], needs: ['office'], beats: {
    1: { sam: "Right. Here's how this goes—", him: { '*': 'Yes. Anything. Everything. You choose where I start. I trust you.', saw: "Yes! It's you— fine— anything. Everything. You pick where I start." }, after: "…I hadn't finished the threat." },
    2: { sam: 'One useful thing. Just one.', him: "I don't HAVE a useful thing— I've a locker code— it's four ones—", after: 'Keep it.', take: 'Huh. I had a whole second half planned.' },
    3: { sam: "Since you're in the mood. What else.", ask: "Since you're in the mood. What else.", him: "Wifi's Synergy-something, capital S. Unchanged since the merger.", after: '…Thank you?' },
    x: { sam: "We're done.", him: 'Good biscuits are behind the decaf. Nobody looks behind the decaf.', after: "I'll treasure that." } } },
  { id: 'folder-n2', shape: 'folder', t: 'nervy', k: KS, band: ['low', 'mid'], needs: ['office'], beats: {
    1: { sam: 'Listen carefully—', him: { '*': "Listening. Agreeing. Whatever it is, I've agreed. Backdate it.", saw: "Listening! I saw what you— agreed. Whatever it is. Backdate it." }, after: "That's… efficient." },
    2: { sam: 'Then tell me the thing I want.', him: "I want to! I've got nothing! I've got a parking code! It's expired!", after: 'Tempting.', take: "You didn't even haggle." },
    3: { sam: 'More.', ask: 'More.', him: "Locker forty. Code's my birthday. It's on the group chat. With cake." },
    x: { sam: 'Stop helping.', him: "The printer on three jams if you look at it. That's my last one." } } },
  { id: 'folder-n3', shape: 'folder', t: 'nervy', k: KS, band: ['low', 'mid'], needs: ['office'], beats: {
    1: { sam: "You're going to answer some—", him: { '*': 'Yes. Yes to the questions. Yes to the tone. All of it. Pre-yes.', saw: "Yes— I know who you— yes to all of it. The tone. Pre-yes." }, after: 'I usually get to finish.' },
    2: { sam: 'Fine. What should I know?', him: "That I'm cooperating? Very hard? Can that go somewhere? On a file?", after: "There's no file.", take: '…People normally make me work for that.' },
    3: { sam: 'And?', ask: 'And?', him: 'And the coffee machine takes exact change and holds grudges.' },
    x: { sam: 'Enough.', him: "Fridge cake marked 'Dave' isn't Dave's. There is no Dave. Never was.", after: 'Noted. No Dave.' } } },
  // ---- the rambler: panic as an unstoppable stream; Sam cannot get a word in and gives up — a DUD when nothing is pending (Sam's rejoinder says so), one press late when one thing is (RAMBLE_SWALLOWS)
  { id: 'ramble-n1', shape: 'ramble', t: 'nervy', k: KS, band: ['mid', 'high'], needs: ['office'], beats: {
    1: { sam: 'Not a sound. Nod if—', him: { '*': "—sorry, I talk when I'm scared, my podcast's actually ABOUT that—", saw: "—it's you— sorry— I talk when I'm scared, my podcast's ABOUT that—" }, after: 'Your what.' },
    2: { sam: 'One fact. Small. Go.', him: "—forty listeners, it's on focus, ironically, and breathing, and—", after: "That's not intel. That's a trailer.", take: '…Was that in there the whole time?' },
    3: { sam: 'Another. Smaller.', ask: 'Another. Smaller.', him: '—and HR said the chair thing was MY posture— MINE— in writing—', after: "I'm putting you down as 'no'." },
    x: { sam: 'Are you done?', him: '—day ninety of the streak and THIS is what my heart rate gets—' } } },
  { id: 'ramble-n2', shape: 'ramble', t: 'nervy', k: KS, band: ['mid', 'high'], needs: ['office'], beats: {
    1: { sam: "Quiet. I'll ask, you'll—", him: { '*': '—is this the parking? Because I appealed the parking, formally—', saw: "—you're the— is this the parking? I APPEALED the parking, formally—" }, after: "It's not about the parking." },
    2: { sam: "Focus. What's on this floor?", him: '—forty a month to park at my own JOB, and the ramp floods, and—', after: 'Still not the parking.', take: 'A fact. In among the parking. Fine.' },
    3: { sam: 'Last try. Something useful.', ask: 'Last try. Something useful.', him: "—I've photos of the ramp. Timestamped. I'll forward you the—", after: "He'll forward me the ramp." },
    x: { sam: 'Breathe.', him: '—and they validate for VISITORS. Visitors! YOU would get validated!' } } },
  { id: 'ramble-n3', shape: 'ramble', t: 'nervy', k: KS, band: ['mid', 'high'], beats: {
    1: { sam: 'Whisper. Only when I—', him: { '*': "—okay, okay, context: eleven weeks of nights, body clock in a bin—", saw: "—okay— YOU— context: eleven weeks of nights, body clock in a bin—" }, after: 'I said when.' },
    2: { sam: 'One thing I can use.', him: '—the app says I slept four hours in PIECES, it draws you a graph—', after: "I can't use the graph.", take: 'Usable. Barely. Go on hyperventilating.' },
    3: { sam: 'Something about tonight.', ask: 'Something about tonight.', him: "—tonight's three coffees and a sort of oat bar with opinions—", after: "We're done here." },
    x: { sam: 'Finished?', him: '—it had RAISINS in it, unannounced, which I think legally—' } } },
  // ---- the arbitrary game, complied with in terror
  { id: 'game-n1', shape: 'game', t: 'nervy', k: KS, beats: {
    1: { sam: 'Rule one: no vowels louder than this.', him: { '*': 'wht— sorry— what? okay. okay. tiny vowels. tiny.', saw: "it's y— sorry— tiny vowels. okay. i can do tiny." } },
    2: { sam: 'Good. Now a fact. Tiny vowels.', him: "a fct— no fact. i've gt nothing. this is very hard.", take: 'Vowels crept up at the end. Watch it.' },
    3: { sam: 'Another.', ask: 'Another.', him: "cn i— can I have one loud vowel. Just an 'oh'. On account." },
    x: { sam: 'One.', him: "OH. …thank you. that's been building since the arm." } } },
  { id: 'game-n2', shape: 'game', t: 'nervy', k: KS, beats: {
    1: { sam: "From now on you're Unit Two. Say it.", him: { '*': "Unit Two. Why Two— who's One— am I not One material?", saw: "Unit Two— I nearly caught— fine. Unit Two. Who's ONE?" } },
    2: { sam: 'Unit Two, report.', him: 'Unit Two has nothing to report and would like that minuted!', take: 'Adequate, Unit Two.' },
    3: { sam: 'Further, Unit Two?', ask: 'Further, Unit Two?', him: 'Unit Two requests to be One. Once. Before whatever this is ends.' },
    x: { sam: 'Denied.', him: 'Unit Two saw that coming and is still, somehow, hurt.' } } },
  { id: 'game-n3', shape: 'game', t: 'nervy', k: KS, beats: {
    1: { sam: 'You get five words. Total. Budget them.', him: { '*': "Five?! That's— wait, do these— oh no.", saw: "Five?! But you're the— do these count— oh no." }, after: "Seven. I'll restart the meter. Once." },
    2: { sam: "Meter's running. Spend wisely.", him: 'Nothing. Know nothing. Two left. …Help.', take: 'Way over budget. Worth it.' },
    3: { sam: "I'll extend your credit. Talk.", ask: "I'll extend your credit. Talk.", him: 'Can unused words roll over? Asking for a— no. Wasted four.' },
    x: { sam: "Budget's closed.", him: "Mm. Mm-mm. …That's humming, not words. Loophole. —Six. Damn." } } },
  // ---- environmental menace, opened with (nervy men give at 2, so the room is the opener)
  { id: 'menace-n1', shape: 'menace', t: 'nervy', k: KS, needs: ['office'], beats: {
    1: { sam: 'Bad room to be caught in. Look at it.', him: { '*': "It's a bad room to be EMPLOYED in! I've said! There's a survey!", saw: "YOU'RE the bad thing in it! Sorry. Sorry. Also the room, yes." }, room: true },
    2: { sam: "Or you talk. Talking's warmer.", him: "I'd talk! I've nothing to talk WITH! Threaten me near a plant!", take: 'See. Warmer already.' },
    3: { sam: 'Keep talking.', ask: 'Keep talking.', him: "Can we do this in the lobby? There's a ficus. It calms me." },
    x: { sam: "We're staying.", him: "Then I'm naming things. That vent's Gary. Hi Gary. Help me, Gary." } } },
  { id: 'menace-n2', shape: 'menace', t: 'nervy', k: KS, needs: ['office'], beats: {
    1: { sam: 'You know what happens in rooms like this.', him: { '*': 'Meetings? Oh— you mean— oh, worse than meetings. Right.', saw: "You do! You happen! I've SEEN you happen! …Sorry. Go on." }, room: true },
    2: { sam: "Unless you've something better to offer.", samNow: "Unless you've got something better to offer.", him: "Better than THAT? I've got a bus pass and regrets! Take both!", take: 'Better. Marginally.' },
    3: { sam: 'Go on.', ask: 'Go on.', him: 'Never liked {room}. Now it is mutual. I feel that.' },
    x: { sam: 'Settle in.', him: "I'm telling facilities about you. Anonymously. SO anonymously." } } },
  { id: 'menace-n3', shape: 'menace', t: 'nervy', k: KS, needs: ['office'], beats: {
    1: { sam: 'Look where we are. Take your time.', him: { '*': "{Room}. I know. I KNOW. I've had the induction. Twice.", saw: '{Room}— with YOU— which is the worst version of {room} so far.' }, room: true },
    2: { sam: 'Talk and I lose interest in the furniture.', him: "Lose it anyway! Please! It's dreadful furniture! Nobody'd blame you!", take: 'Interest lost.' },
    3: { sam: 'And?', ask: 'What else.', him: "I'm going to have such SPECIFIC nightmares. With an inventory." },
    x: { sam: 'Still with me?', him: "Physically. The rest of me is in the car park. Running. Badly." } } },
  // ================================================================ HARD (fewer words. Attitude at 1 and 2; the useful thing at 3 only once rattled, through his teeth; a flat insult to close — `mild` when STOIC_BITE is 0)
  // ---- the stoic
  { id: 'stoic-h1', shape: 'stoic', t: 'hard', k: KS, beats: {
    1: { sam: 'Quiet.', him: { '*': 'I was.', saw: "You weren't. Earlier." } },
    2: { sam: 'It gets tighter from here.', him: 'Arms do.' },
    3: { sam: 'Last time I ask nicely.', him: 'That was nicely?' },
    x: { sam: 'Anything to add?', him: 'A mint. For you. Urgently.', mild: "No. And I'd have said." } } },
  { id: 'stoic-h2', shape: 'stoic', t: 'hard', k: KS, beats: {
    1: { sam: "Don't.", him: { '*': "Wasn't.", saw: 'Already did. Missed.' } },
    2: { sam: "You're calm, for a man in an arm.", him: 'Not my first arm.' },
    3: { sam: 'One thing, and you keep your evening.', him: "This was my evening. You've had it." },
    x: { sam: 'Nothing else?', him: 'You grunt when you crouch. Get that looked at.', mild: 'Nothing. Same as before, only later.' } } },
  { id: 'stoic-h3', shape: 'stoic', t: 'hard', k: KS, needs: ['shift'], beats: {
    1: { sam: 'Easy.', him: { '*': 'For you, apparently.', saw: 'It was, nearly. For me.' } },
    2: { sam: 'I can wait.', him: "So can I. I'm paid to. Badly, but hourly." },
    3: { sam: "One fact. Then I'm a rumour.", him: "You're already a rumour. Short one." },
    x: { sam: 'Last word?', him: 'You breathe loud. For a rumour.', mild: 'Same answer. Shorter.' } } },
  { id: 'stoic-h4', shape: 'stoic', t: 'hard', k: KS, beats: {
    1: { sam: 'Not a sound.', him: { '*': 'Deal.', saw: 'Bit late for quiet. But deal.' } },
    2: { sam: "You've done this before.", him: 'Been done to. Twice. Better both times.' },
    3: { sam: 'Then you know the part where you talk.', him: 'I know the part where you get bored.' },
    x: { sam: "We're finished.", him: 'You were finished at the knees. Years back.', mild: 'We were finished at hello.' } } },
  // ---- the arbitrary game, played with contempt
  { id: 'game-h1', shape: 'game', t: 'hard', k: KS, beats: {
    1: { sam: 'Rule: you answer in under three words.', him: { '*': 'Suits me.', saw: 'Missed you. Twice.' } },
    2: { sam: "What's your job?", him: 'Standing. Mostly.' },
    3: { sam: 'What ruins my night in here?', him: 'Me. Shortly.', take: "More than three. I'll let it go." },
    x: { sam: 'Closing remarks?', him: 'Two words.', mild: 'None. Obviously.' } } },
  { id: 'game-h2', shape: 'game', t: 'hard', k: KS, beats: {
    1: { sam: 'Nod for yes. Shrug for no.', him: { '*': "I'll narrate. This is a shrug.", saw: 'This is a shrug. That, earlier, was a warning shot.' } },
    2: { sam: 'Are you going to be difficult?', him: 'Nod. Big one.' },
    3: { sam: 'Something useful. Use words.', him: 'Shrug. Slow, meaningful shrug.', take: 'See. Words.' },
    x: { sam: 'Anything else?', him: 'Picture a gesture.', mild: 'Shrug.' } } },
  { id: 'game-h3', shape: 'game', t: 'hard', k: KS, beats: {
    1: { sam: "We'll play a game.", him: { '*': "You'll play. I'm equipment.", saw: 'We played earlier. You hid.' } },
    2: { sam: "Count the exits you can't reach.", him: 'All of them. Good game. Next.' },
    3: { sam: "Now one thing I don't know.", him: 'How this ends for you. Nor do I. Fun.', take: 'You lose gracefully.' },
    x: { sam: 'Rematch?', him: 'Bring a longer arm.', mild: 'Not tonight.' } } },
  // ---- environmental menace, met with a shrug
  { id: 'menace-h1', shape: 'menace', t: 'hard', k: KS, needs: ['office'], beats: {
    1: { sam: 'Know where you are?', him: { '*': 'Work.', saw: 'Behind on my paperwork. About you.' } },
    2: { sam: 'Rooms like this keep secrets.', him: 'This one keeps a draught.', room: true },
    3: { sam: 'Or one useful sentence.', him: "Do the room thing. I'm curious now." },
    x: { sam: 'Thoughts?', him: 'You rehearse these. It shows.', mild: 'None for you.' } } },
  { id: 'menace-h2', shape: 'menace', t: 'hard', k: KS, needs: ['office'], beats: {
    1: { sam: 'Look around you.', him: { '*': 'Seen it. Nightly.', saw: 'Saw it. Saw you in it. Preferred it empty.' } },
    2: { sam: 'Plenty in here to regret.', him: 'The carpet, mainly.', room: true },
    3: { sam: 'Talk instead.', him: 'No. Go on. Redecorate.' },
    x: { sam: 'Anything?', him: "You'd never get the deposit back.", mild: 'Nothing.' } } },
  { id: 'menace-h3', shape: 'menace', t: 'hard', k: KS, needs: ['office'], beats: {
    1: { sam: 'Cosy in here.', samNow: 'Cozy in here.', him: { '*': "Isn't.", saw: 'Was. Then you.' } },
    2: { sam: 'Lot of hard surfaces.', him: "I mop them. I'd know.", room: true },
    3: { sam: 'Or you give me something.', him: "I'll take the surfaces." },
    x: { sam: 'Last chance.', him: 'For you to lift properly. Bend the knees.', mild: 'Pass.' } } },
];

/** Every line of Sam's the scripts and the rooms can put in his mouth, listed into SAM_LINES as 's: script' entries (ids 'S:<script>:<stage>' + '?' the ask,
 *  '+' the rejoinder, '+?' the take; 'S:room:<room>:<i>') — so 'is this text one of Sam's' has one table to ask and the length report one list to walk. The
 *  pool pickers filter by category and never draw them. Runs once, below. */
function registerScriptLines() {
  for (const sc of SCRIPTS) for (const s of STAGES) {
    const b = sc.beats[s]; if (!b) continue; const base = `S:${sc.id}:${String(s)}`;
    SAM_LINES.push({ id: base, s: 'script', t: sc.t, text: b.sam, guide: b.samNow });
    if (b.ask) SAM_LINES.push({ id: `${base}?`, s: 'script', t: sc.t, text: b.ask });
    if (b.after) SAM_LINES.push({ id: `${base}+`, s: 'script', t: sc.t, text: b.after });
    if (b.take) SAM_LINES.push({ id: `${base}+?`, s: 'script', t: sc.t, text: b.take });
  }
  for (const [room, list] of Object.entries(ROOM_MENACE)) list.forEach((r, i) => { SAM_LINES.push({ id: `S:room:${room}:${i}`, s: 'script', text: r.sam }); if (r.after) SAM_LINES.push({ id: `S:room:${room}:${i}+`, s: 'script', text: r.after }); });
}

// ================================================================================================================================================================
// THE HANDLER — Sam's side of the net at the mission's beats (mission.ts calls handlerBeat at the ones it owns; the alarm, the blackout and a body found are
// edges read here once a frame, updateAmbient → tickRadio). Two lines, never more: hers into the radio strip ('radio: <HANDLER_TAG> ▸ …' — overlay.ts draws
// 'radio: ' lines and nothing else), his RADIO_REPLY_SECS later as a bubble over him with the radio glyph AND into the strip ('radio: you ▸ …'). Never in a
// fight (a man at 'alert'), never with a man in his arm or under his hands (his mouth is busy, and the soak holds Sam's bubble in a hold to the hold's rules),
// never under the tour, each beat once a run. She has no name in the fiction yet: HANDLER_TAG is what the strip calls her.
// ================================================================================================================================================================
export const HANDLER_TAG = 'handler';
export const RADIO_REPLY_SECS = 1.7;
/** seconds after the guards' own radio line that an edge-read beat waits (the strip shows three lines: theirs first, then hers, then his) */
export const RADIO_EDGE_DELAY = 2.6;
export const HANDLER_BEATS = ['server', 'drive', 'rack', 'alarm', 'lockdown', 'blackout', 'bodyKo', 'bodyDead'] as const;
export type HandlerBeat = typeof HANDLER_BEATS[number];
/** her line (h), his answer (s). {rack} = the mission rack's number. Dry; the joke is usually his age, her hours, or the building. A man found dead is not a joke beat.
 *  hOwn / sOwn (words.ts): the same half of the exchange on a level that is not the office — no 'floor', no corridor; read in handlerBeat. */
export const HANDLER_LINES: Record<HandlerBeat, { h: string; s: string; hOwn?: string; sOwn?: string; /** (WORDS.guide) her line as the writing guide has it */ hNow?: string }[]> = {
  server: [
    { h: "That's you in. Rack {rack}, east bank. Gently.", hNow: "You're in. Rack {rack}, east bank. Gently.", s: "Gently is all I've got left at this hour." },
    { h: 'Server room. Try not to lean on anything load-bearing.', s: 'At my age everything I lean on is load-bearing.' },
    { h: 'Rack {rack}. And lift with the legs this time.', s: 'The legs filed a grievance in the lobby.' },
  ],
  drive: [
    { h: 'Drive shows dark on my board. Nicely done.', s: 'Tell my knees. They did the crouching.' },
    { h: "That's the drive. You can stop holding your breath.", s: 'That was my back, not my breath.' },
    { h: 'Got it. Fire exit, east end. No sightseeing.', s: "I've seen it. It's an office. They're all this office." },
  ],
  rack: [
    { h: "They've noticed the rack. Someone's coming to frown at it.", s: "Let him frown. I'll be elsewhere." },
    { h: 'Heads up— a ticket just opened on your rack. Fast, for them.', s: 'First time for everything.' },
  ],
  alarm: [
    { h: 'That sounded expensive. You in one piece?', s: "Define piece. I'm upright." },
    { h: "Floor's awake now. So am I, thanks for that.", s: 'You were asleep?', hOwn: "They're awake now. So am I, thanks for that." },
    { h: 'Overtime just kicked in, if that helps.', s: 'Helps the invoice. Not the corridor.', sOwn: 'Helps the invoice. Not me.' },
  ],
  lockdown: [
    { h: "They've paired up and locked down. Old school.", s: 'Old school I can do. I am old school.' },
    { h: 'Lockdown. Doors, pairs, the lot. Your doing?', hNow: 'Lockdown. Doors, pairs, the works. Your doing?', s: 'Allegedly.' },
  ],
  blackout: [
    { h: "Board says you killed the floor's lights. Subtle.", s: 'Subtle was twenty years ago. This is efficient.', hOwn: 'Board says you killed their lights. Subtle.' },
    { h: "Blackout. Someone's walking to a breaker, armed and annoyed.", s: 'Annoyed I can work with.' },
  ],
  bodyKo: [
    { h: "They've found your sleeper. He'll wake up embarrassed.", s: "We've all been there." },
    { h: 'Net says man down, breathing. Yours?', s: 'Mine breathe. House style.' },
  ],
  bodyDead: [
    { h: "They've found him. That's on the record now.", s: "So is the rest of tonight." },
    { h: 'Man down on their net. Not breathing.', s: 'I heard. Keep the channel clear.' },
  ],
};
interface RadioState { run: object | null; done: Set<HandlerBeat>; queue: { at: number; beat: HandlerBeat }[]; reply: { at: number; text: string } | null; lastAt: number; esc: number; blackout: boolean; found: number; }
const radioByGame = new SideMap<object, RadioState>('dialogue.radioByGame');
function radioState(g: Game): RadioState {
  let R = radioByGame.get(g); if (!R) { R = { run: null, done: new Set(), queue: [], reply: null, lastAt: -100, esc: 0, blackout: false, found: 0 }; radioByGame.set(g, R); }
  if (R.run !== g.mission) { R.run = g.mission; R.done.clear(); R.queue.length = 0; R.reply = null; R.lastAt = -100; R.esc = escalationOf(g); R.blackout = g.blackout.active; R.found = g.guards.filter(x => x.found).length; }   // a fresh run (restartEncounter makes a new Mission): every beat may sound again, and the edges start from where the floor stands
  return R;
}
/** the run is really the player's and still going (mission.ts missionLive's test, without the import cycle), and Sam is on his feet — and (words.ts) it is the night
 *  she talks him through: with a squad's scenario up (a night breach, a room clear, a rescue) her dry asides about his knees are not that fight's */
function radioLive(g: Game): boolean { const s = g.mission.stage; return !g.quietUtility && !g.puppet && !g.touring && g.aiEnabled && s !== 'done' && s !== 'failed' && !g.player.down && !(WORDS.on && (g.nightBreach?.active || g.rescue?.active)) && !(WORDS.radioHome && !isOffice(g.level)); }
/** nobody is fighting, and Sam's mouth and hands are free */
function radioClear(g: Game): boolean { return !g.guards.some(x => x.state === 'alert') && !g.player.holding && !g.player.takedown; }
/** Sound a beat now (delay 0) or queue it `delay` seconds out (re-checked when it comes due). False if it will never sound: said already this run, the run is
 *  not live, or — for an immediate one — the moment is wrong (a fight, a man in his arm, another beat too close). Deterministic: the variant is dealt off the
 *  beat and the run's start, so a probe hears the same two lines every time and a player different ones most nights. */
export function handlerBeat(g: Game, beat: HandlerBeat, delay = 0): boolean {
  const R = radioState(g);
  if (!radioLive(g) || R.done.has(beat)) return false;
  if (delay > 0) { if (!R.queue.some(q => q.beat === beat)) R.queue.push({ at: g.time + delay, beat }); return true; }
  if (!radioClear(g) || g.time - R.lastAt < 5 || R.reply) return false;
  const pool = HANDLER_LINES[beat]; if (!pool?.length) return false;
  const L = pool[hashStr(`${beat}|${Math.round(g.mission.t0 * 10)}`) % pool.length];
  const rack = String(g.level.mission.rack.index + 1);
  const own = WORDS.on && !isOffice(g.level), hNow = wg(L.hNow ?? L.h, L.h), h = own ? L.hOwn ?? hNow : hNow, s = own ? L.sOwn ?? L.s : L.s;
  R.done.add(beat); R.lastAt = g.time;
  g.msg(`radio: ${HANDLER_TAG} ▸ ${h.replace(/\{rack\}/g, rack)}`); g.audio.play('radio', null, 0.3, { rate: 1.12 });
  R.reply = { at: g.time + RADIO_REPLY_SECS, text: s.replace(/\{rack\}/g, rack) };
  return true;
}
/** Once a frame (updateAmbient): the edges she reacts to on her own — the floor going up a level, the lights dying, a body found (breathing or not) — queued a
 *  beat behind the guards' own call; queued beats coming due; and his reply when its moment comes (dropped, not delayed, if a fight broke out meanwhile). */
function tickRadio(g: Game) {
  const R = radioState(g);
  const esc = escalationOf(g); if (esc > R.esc) handlerBeat(g, esc >= 2 ? 'lockdown' : 'alarm', RADIO_EDGE_DELAY); R.esc = esc;
  const bo = g.blackout.active; if (bo && !R.blackout) handlerBeat(g, 'blackout', RADIO_EDGE_DELAY); R.blackout = bo;
  let found = 0, ko = false; for (const x of g.guards) if (x.found) { found++; if (found > R.found && isBreathing(x)) ko = true; }
  if (found > R.found) handlerBeat(g, ko ? 'bodyKo' : 'bodyDead', RADIO_EDGE_DELAY + 0.6); R.found = found;
  for (let i = R.queue.length - 1; i >= 0; i--) { const q = R.queue[i]; if (g.time < q.at) continue; if (!radioLive(g) || R.done.has(q.beat)) { R.queue.splice(i, 1); continue; } if (handlerBeat(g, q.beat)) R.queue.splice(i, 1); else if (g.time - q.at > 20) R.queue.splice(i, 1); }   // (a beat that cannot find a quiet moment inside twenty seconds has missed it)
  if (R.reply && g.time >= R.reply.at) {
    const p = R.reply; R.reply = null;
    if (radioLive(g) && radioClear(g) && !(g.player.bubble && g.time - g.player.bubble.t < g.player.bubble.dur)) { g.player.bubble = { text: p.text, t: g.time, dur: Math.min(2.4, Math.max(1.3, 0.9 + 0.025 * p.text.length)), radio: true }; g.msg(`radio: you ▸ ${p.text}`); }
  }
}

// ================================================================================================================================================================
// AMBIENT PAIRS — two men on a calm floor who find themselves within a few metres of each other stop, half turn, and talk: two to four lines that leak the
// building (the gadget it installed, the noise nobody has ever gone to look at, the colleague who does the sheet in pencil, the PIN on a sticky note — the
// G4 keypad hook). guards.ts updateEscalation calls updateAmbient once a frame (the one hook); the men are held with the scripted `hold` flag for the length
// of it (they stand and sweep, and it comes off the frame either of them stops being a calm patrol) and say their lines through Game.say like any bark.
// Never under the tour, never on a floor that is up, never while Sam has a man in his arm, AMBIENT.cooldown between conversations, each played once before any repeats.
// ================================================================================================================================================================
export const AMBIENT = { pairM: 4.5, cooldown: 70, firstAfter: 20, gap: 0.45, faceRate: 2.5 };
/** a pair line with its tokens at their longest ({other} a callsign, {code} four digits, {padDoor} the side door's name) — the lint's length check and the length report */
export function pairWorst(text: string): string { return text.replace(/\{other\}/gi, 'Lindqvist').replace(/\{code\}/gi, TOKEN_WORST.code).replace(/\{padDoor\}/g, TOKEN_WORST.padDoor).replace(/\{PadDoor\}/g, TOKEN_WORST.padDoor[0].toUpperCase() + TOKEN_WORST.padDoor.slice(1)); }
export interface PairTalk { id: string; lines: { who: 0 | 1; text: string; /** the line on a level that is not the office (words.ts) */ own?: string }[]; note?: string; /** about the office building itself — its gents, lifts, vending machine, badges, town halls: dealt only there (words.ts) */ office?: true; }
/** {other} = a third man's callsign (a conversation that names one waits for a night with three men up). who 0 opens; 1 answers. ≤ AIM_CHARS a line. */
export const AMBIENT_PAIRS: PairTalk[] = [
  { id: 'sensor', office: true, lines: [{ who: 0, text: "They've put a sensor in the gents. Little red eye." }, { who: 1, text: "That's the air freshener." }, { who: 0, text: 'It clicked at me.' }, { who: 1, text: "It does that. It's judging, not recording." }] },
  { id: 'thunk', office: true, lines: [{ who: 0, text: 'Hear that? Sort of a thunk.' }, { who: 1, text: 'Vending machine. Drops one at midnight.' }, { who: 0, text: 'Drops one what?' }, { who: 1, text: "Nobody's ever gone to look." }] },
  { id: 'pencil', lines: [{ who: 0, text: '{Other} did the sheet in pencil again.' }, { who: 1, text: 'So?' }, { who: 0, text: 'So Thursday never officially happened.' }, { who: 1, text: 'Lucky Thursday.' }] },
  { id: 'pin', note: "the keypad's real digits, said aloud (devices.ts overhear: the player learns them iff the line CARRIES to him — col.sound, the guards' own ears the other way round); {code} / {padDoor} resolve off the pad nearest the pair, and a level with no pad never deals this one", lines: [{ who: 0, text: 'They redid the pad on {padDoor}. {Code} now.' }, { who: 1, text: 'Out loud. In a corridor. Lovely.', own: 'Out loud. Lovely.' }, { who: 0, text: "It's on a sticky ON the pad. I wrote it big." }, { who: 1, text: 'You ARE security. Somehow.', own: 'And you GUARD the thing. Somehow.' }] },
  { id: 'overtime', office: true, lines: [{ who: 0, text: "Overtime sheet's gone digital." }, { who: 1, text: 'Meaning?' }, { who: 0, text: 'Meaning it rounds down on its own now.' }, { who: 1, text: 'Progress.' }] },
  { id: 'poster', office: true, lines: [{ who: 0, text: "New poster by the lifts. 'Own the outcome.'" }, { who: 1, text: 'Which outcome?' }, { who: 0, text: "Doesn't say. Eagle, though. Big eagle." }, { who: 1, text: "I'll own the eagle." }] },
  { id: 'jug', lines: [{ who: 0, text: "Who made the six o'clock jug?" }, { who: 1, text: 'Day shift. As a warning.' }, { who: 0, text: 'I drank it.' }, { who: 1, text: "Then you've been warned." }] },
  { id: 'photos', office: true, lines: [{ who: 0, text: "They're redoing badge photos Monday." }, { who: 1, text: "Mine's from nine kilos ago." }, { who: 0, text: 'Mine blinks. In a photo. Somehow.' }] },
  { id: 'costcentre', office: true, lines: [{ who: 0, text: "Town hall called us 'a cost centre'." }, { who: 1, text: "We're a corridor." }, { who: 0, text: 'A cost corridor.' }, { who: 1, text: 'Walk it, then. Cheaply.' }] },
];
interface AmbientRun { a: Guard; b: Guard; talk: PairTalk; i: number; at: number; other: string | null; /** the keypad the pair's {code} / {padDoor} mean, resolved when the talk was dealt (null: none on this level) */ pad: { code: string; door: string; lockId: string } | null; held: [boolean, boolean]; }
// ---------------------------------------------------------------- NEEDS — what a man says stepping off his route for a coffee / a smoke / water / a stretch (game/needs.ts):
// to the colleague within earshot (announce, by kind — that man answers from `reply`, or `replyOther` naming a third man when there is one), over the net when
// nobody is near enough (`radio`: '{who} — two minutes, {short}'), and to himself coming back onto the route (`back`). Terse; ≤ AIM_CHARS a line like the pairs.
export const NEEDS_LINES = {
  announce: {
    coffee: ['Two minutes — grabbing a coffee.', 'Coffee. Back in two.', "I'm doing a coffee run. Two minutes."],
    smoke: ['Going for a smoke by the fire door.', 'Quick smoke. Fire exit. Back in five.', 'Nipping out the fire door for one.'],
    water: ['Getting some water. One minute.', "Throat's gone. Water — one minute.", 'Cooler run. Back in a sec.'],
    stretch: ['Stretching my legs — lobby and back.', 'Legs have seized. Quick lap of the lobby.', 'Walking the lobby loop. Back in a minute.'],
  } as Record<string, string[]>,
  /** the same, for a level whose places are its own (needs.ts: one with a `scenarios.quiet` block): nothing of the office's fire door, cooler or lobby in them */
  announceOwn: {
    coffee: ['Two minutes — grabbing a coffee.', 'Coffee. Back in two.'],
    smoke: ['Going out for a smoke.', 'Quick smoke. Back in five.'],
    water: ['Getting some water. One minute.', "Throat's gone. Water — one minute."],
    stretch: ['Stretching my legs. Back in a minute.', 'Legs have seized. Quick lap.'],
  } as Record<string, string[]>,
  /** (WORDS.guide) an announce line as the writing guide has it, by the line it stands for (needs.ts reads it where the line is picked) */
  now: { 'Nipping out the fire door for one.': 'Stepping out the fire door for a smoke.', 'Legs have seized. Quick lap of the lobby.': 'My legs are stiff. Quick lap around the lobby.', 'Legs have seized. Quick lap.': 'My legs are stiff. Quick lap.' } as Record<string, string>,
  reply: ['Go on then.', 'Again?', 'Bring me one.', "Don't be long.", "Clock's running.", "I'll hold the fort. Such as it is."],
  replyOther: ["Don't be long — {other} wanders enough for two.", 'Fine. If {other} asks, I never saw you.'],
  /** {who} = his own callsign, {short} = SHORT[kind] */
  radio: '{who} — two minutes, {short}.',
  short: { coffee: 'coffee', smoke: 'smoke, fire door', water: 'water', stretch: 'stretching my legs' } as Record<string, string>,
  /** the same on a level whose places are its own (announceOwn's rule; words.ts): no fire door */
  shortOwn: { smoke: 'smoke' } as Record<string, string>,
  back: ['Right. Where was I.', 'Okay. Back on it.', 'As I was.', '…and back to the glamour.'],
};
/** every line of it (the QA soak's pool: a needs line only ever from a man on a trip, his partner, or a man just back), radio lines expanded per callsign given */
export function needsLines(callsigns: string[] = []): string[] {
  const L = NEEDS_LINES; const out = [...Object.values(L.announce).flat(), ...Object.values(L.announceOwn).flat(), ...wg(Object.values(L.now), []), ...L.reply, ...L.back];
  for (const o of callsigns) for (const r of L.replyOther) out.push(r.replace(/\{other\}/g, o));
  for (const w of callsigns) for (const s of [...Object.values(L.short), ...Object.values(L.shortOwn)]) out.push(L.radio.replace('{who}', w).replace('{short}', s));
  return out;
}

// ---------------------------------------------------------------- CIVILIANS (game/civilians.ts): the cleaner and the late worker. Everything they and the men say ABOUT them —
// bubbles all, but for a guard's report over the net ('radio: …') and control's own lines. Tokens: {room} = roomName ('the cubicles'), {name} = the civilian's
// name, {label} = 'cleaner' / 'late worker', {cs} = the guard's callsign, {she} / {her} = the civilian's pronouns. Terse and frightened; ≤ AIM_CHARS a line.
export const CIV_LINES = {
  /** a glimpse of something in the dark (awareness over the glimpse line): she stops and looks */
  glimpse: ['Hello…?', 'Is somebody there?', "…who's that?", 'Hello? …Security?'],
  /** it came to nothing: back to work */
  shrug: ['…nothing. Jumpy tonight.', 'Hearing things.', '…get a grip, {name}.', 'This building.'],
  /** the beat frozen before she runs, by what did it */
  gasp: {
    sam: ['— oh god —', 'Who — WHO ARE YOU —', 'No. No no no —'],
    gun: ["He's got a GUN —", 'GUN — oh god, oh god —', "— that's a GUN —"],
    body: ['Oh god — oh GOD —', "He's — is he DEAD —?", "Somebody's — oh no. No —"],
    gunfire: ['Was that a SHOT —?!', '— shooting — oh god —', 'That was a GUN —'],
    shot: ['What was — was that a SHOT?', "— that's — no. NO —"],
    bang: ['— what the — !', 'JESUS — what WAS that —'],
    scream: ["What — what's HAPPENING —?!", '{other}?! — oh god —'],
    noise: ['What was THAT —', '— okay. No. No.'],
    grabbed: ['— he GRABBED me — he —', 'GET AWAY FROM ME —'],
    panel: ['— oh god —'],
  } as Record<string, string[]>,
  /** shouted on the run */
  flee: ['HELP! SECURITY!', 'SECURITY —!', 'Somebody HELP —!', 'HELP —!'],
  /** to the guard she reaches, by cause */
  report: {
    sam: ["There's someone in {room} — a man — all in black —", 'A MAN — {room} — creeping about in the dark —', "{room} — somebody's IN there — I saw him —"],
    gun: ["A man in {room} — he's got a GUN —", "{room} — there's a man with a GUN in there —"],
    body: ["{room} — there's a man on the FLOOR — one of yours —", 'One of your lot — DOWN — {room} — not moving —'],
    gunfire: ['SHOOTING — {room} — I heard it — a gun —', 'That was a gunshot — {room} — it WAS —'],
    shot: ['A bang — like a shot — {room} —', 'Something went off in {room} — like a gun but — quiet —'],
    bang: ['An EXPLOSION — {room} — a flash and —', 'Something BLEW UP — {room} —'],
    scream: ['{room} — screaming — somebody screamed —', 'I heard SCREAMING — {room} —'],
    noise: ['{room} — a crash — somebody is IN there —'],
    grabbed: ['He GRABBED me — {room} — a man — he had a KNIFE at me —', 'A man — he had me by the THROAT — {room} —'],
    panel: ["There's someone in {room} —"],
  } as Record<string, string[]>,
  /** the guard's word to her (a bubble), then what he puts on the net (armed / body / anyone) */
  guardAck: {
    someone: ["All right — all right. Stay here. I'll look.", 'Okay. Get behind the desk and stay put.', "Easy. Stay here, stay down. I'll go and see."],
    armed: ['DOWN — get down and STAY down.', 'Behind me. On the floor. Do NOT move.', 'Get down. Stay there. — control —'],
  },
  guardRadio: {
    someone: "control, {cs} — {name}'s seen somebody, {room}. walking it now",
    armed: "control, {cs} — {name} saw an ARMED man, {room}. weapons out, I'm going",
    body: "control, {cs} — {name} says there's a man DOWN, {room}. going now",
    gunfire: 'control, {cs} — {name} heard it too, {room}. moving',
    grabbed: 'control, {cs} — he had {name} by the throat, {room}. armed. going now',
  } as Record<string, string>,
  /** the call from a phone (two beats), and control putting it out */
  phone: ["Security? — it's {name}, fourth floor — there's a MAN up here — {room} —", '…yes — {room} — I SAW him — please, just — send someone —'],
  phoneArmed: ["Security — {name}, on four — a man with a GUN — {room} —", '— YES a gun — {room} — hurry — please —'],
  control: {
    someone: 'all callsigns, control — {name} on four just rang in a prowler, {room}. somebody walk it. eyes open',
    armed: 'all callsigns, control — {name} on four rang it in: ARMED intruder, {room}. weapons out, get there',
    body: 'all callsigns, control — {name} says a man is DOWN, {room}. weapons out, get there now',
    outside: 'all callsigns, control — {name} just came off your floor at a run. says there is a man up there, {room}. treat it as real',
  } as Record<string, string>,
  /** crouched in a corner */
  cower: ['please — please —', "I didn't see anything — I DIDN'T —", 'oh god oh god oh god', "don't — don't —", '— breathe — breathe —'],
  /** in Sam's arm: what comes out of her before any question, then what she knows (by kind), then nothing */
  heldFear: ['Please — I just CLEAN here —', "Don't — please — I've got kids —", 'okay — okay — OKAY —', "I won't scream — I won't — please —"],
  heldFearWorker: ["Please — I'm just — I do the ACCOUNTS —", "Take the laptop — take anything — please —", 'okay — okay — OKAY —'],
  intel: {
    cleaner: ["The side door — the number's ON it. A sticky. Seven three nine one.", 'Three of them tonight. The big one walks the corridor. All night.', 'The one in here — Novak — he goes for water. The far corner. Often.'],
    worker: ["Their room's downstairs. They come up the west stairs. The steel door.", 'Reyes does the front. Sits in the break room half the night.', "There's a camera on the corridor. East end. It swings."],
  } as Record<string, string[]>,
  dry: ["That's ALL I know — I swear —", "I don't KNOW anything else —", 'Please — that\'s everything —'],
  /** 'stay down, stay quiet': Sam's word, her answer */
  comply: { sam: ['Down. Stay down, stay quiet — and you go home tonight.', 'On the floor. Not a sound. You never saw me.', 'Face the wall. Count to a thousand. Slowly.'], civ: ['okay — okay —', "I won't — I won't move —", '…yes. yes. okay.'] },
  /** Sam's side of a question to her (the arm's row) */
  samAsk: ['Quietly. Who else is on this floor?', 'Breathe. Now — what do you know that I want?', "Shh. The guards. Where, and how many?", 'Easy. Talk to me and this ends well.'],
  /** a guard coming on her crouched in a corner: his line, then she tells him (report) */
  found: ["Hey — hey. It's all right. What happened?", "{name}? — what is it, what did you see?", "{name} — look at me. What HAPPENED?"],
  /** a guard walking onto her on the floor: out cold / dead — over the net */
  foundDown: {
    cold: "control, {cs} — it's {name}, the {label} — {she}'s DOWN. out cold, breathing. someone's on this floor",
    dead: "control, {cs} — {name}'s DEAD. the {label}. somebody's KILLED {her} — lock it down, all of it",
  },
  outrage: 'all callsigns, control — the {label} is dead. whoever this is does not walk out of here. find him',
  /** passing pleasantries with a calm guard (once in a long while) */
  greet: { civ: ['Evening.', "Don't mind me.", 'Mind the wet floor.', 'Nearly done in here.', 'You lot never sleep.'], guard: ['Evening, {name}.', 'Late one tonight, {name}?', "You're all right.", 'Careful by the stairs — lift\'s off again.', 'Leave the bins, {name}. Go home.'] },
  /** back to work after a fright that came to nothing / after the men have it */
  settle: ['…okay. Okay. Back to it.', 'Right. Deep breaths.', "…they've got it. They've got it."],
  /** the response team is coming: control clears the floor, she goes */
  qrf: 'control to all — response team inbound. get the cleaning staff OFF that floor. now',
  evac: ["Going — I'm GOING —", 'Out — yes — out —', "— I'm going, I'm going —"],
  /** words.ts — the same moments on a level that is NOT the office (civilians.ts `away`): no fourth floor, no 'up here', no building security on the other end, no
   *  sticky note, nobody named. What she knows there: the digits of the level's keypad if it has one (`intelPad`, {code} spelt out — Sam learns them as off the office's
   *  sticky), then how many men walk the place tonight ({n}, a word: CIV_COUNT), then `dry`. */
  own: {
    phone: "It's {name} — listen — there's a MAN in here — {room} —", phoneArmed: "It's {name} — a man with a GUN — {room} —",
    control: {
      someone: 'all callsigns, control — {name} just rang in a prowler, {room}. somebody walk it. eyes open',
      armed: 'all callsigns, control — {name} rang it in: ARMED intruder, {room}. weapons out, get there',
      outside: 'all callsigns, control — {name} just came out at a run. says there is a man in there, {room}. treat it as real',
    } as Record<string, string>,
    heldFear: 'Please — I just WORK here —',
    intelPad: "The door with the pad — I've seen them do it. {code}.",
    intel: ['{n} of them tonight. Walking round. All night.'],
    samAsk: 'Quietly. Who else is here tonight?',
    foundCold: "control, {cs} — it's {name}, the {label} — {she}'s DOWN. out cold, breathing. someone's about",
  },
  /** words.ts — reworded on every level: not every spot she reaches a man at has a desk, and the late worker is no cleaning staff */
  now: { guardAck: 'Okay. Get down somewhere and stay put.', qrf: 'control to all — response team inbound. get the civilians OFF that floor. now' },
  /** words.ts `guide` — the pools above as the writing guide has them, place for place: read with wg() where civilians.ts picks the line */
  guide: {
    report: {
      sam: ["There's someone in {room} — a man — all in black —", 'A MAN — {room} — sneaking around in the dark —', "{room} — somebody's IN there — I saw him —"],
      body: ["{room} — there's a man on the FLOOR — one of yours —", 'One of your guys — DOWN — {room} — not moving —'],
    } as Record<string, string[]>,
    control: {
      someone: 'all callsigns, control — {name} on four just called in a prowler, {room}. somebody walk it. eyes open',
      armed: 'all callsigns, control — {name} on four called it in: ARMED intruder, {room}. weapons out, get there',
      outside: "all callsigns, control — {name} just ran off your floor. says there's a man up there, {room}. treat it as real",
    } as Record<string, string>,
    greetCiv: ['Evening.', "Don't mind me.", 'Mind the wet floor.', 'Nearly done in here.', 'You guys never sleep.'],
    greetGuard: ['Evening, {name}.', 'Late one tonight, {name}?', "You're fine.", "Careful by the stairs — elevator's out again.", 'Leave the trash, {name}. Go home.'],
    own: {
      control: {
        someone: 'all callsigns, control — {name} just called in a prowler, {room}. somebody walk it. eyes open',
        armed: 'all callsigns, control — {name} called it in: ARMED intruder, {room}. weapons out, get there',
        outside: "all callsigns, control — {name} just ran out. says there's a man in there, {room}. treat it as real",
      } as Record<string, string>,
      intel: ['{n} of them tonight. Walking around. All night.'],
      foundCold: "control, {cs} — it's {name}, the {label} — {she}'s DOWN. out cold, breathing. someone's here",
    } },
};
/** {n} in CIV_LINES.own.intel, by the count (past the end: the last) */
export const CIV_COUNT = ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'A lot'];
/** every civilian line and every line said about one (the QA soak's pool: only ever from a civilian's mouth, the guard beside one, or control) */
export function civilianLines(): string[] {
  const L = CIV_LINES; const out: string[] = [...L.glimpse, ...L.shrug, ...Object.values(L.gasp).flat(), ...L.flee, ...Object.values(L.report).flat(), ...L.guardAck.someone, ...L.guardAck.armed, ...Object.values(L.guardRadio), ...L.phone, ...L.phoneArmed, ...Object.values(L.control), ...L.cower, ...L.heldFear, ...L.heldFearWorker, ...Object.values(L.intel).flat(), ...L.dry, ...L.comply.sam, ...L.comply.civ, ...L.samAsk, ...L.found, L.foundDown.cold, L.foundDown.dead, L.outrage, ...L.greet.civ, ...L.greet.guard, ...L.settle, L.qrf, ...L.evac];
  const O = L.own; out.push(O.phone, O.phoneArmed, ...Object.values(O.control), O.heldFear, O.intelPad, ...O.intel.flatMap(t => CIV_COUNT.map(n => t.replace('{n}', n))), O.samAsk, O.foundCold, L.now.guardAck, L.now.qrf); { const G = L.guide; out.push(...wg([...Object.values(G.report).flat(), ...Object.values(G.control), ...G.greetCiv, ...G.greetGuard, ...Object.values(G.own.control), ...G.own.intel.flatMap(t => CIV_COUNT.map(n => t.replace('{n}', n))), G.own.foundCold], []).filter(t => !out.includes(t))); }   // (words.ts: the variants)
  return out;
}

// ---------------------------------------------------------------- HOSTAGES (game/rescue.ts names the moment, civilians.ts hostageSay says it; words.ts WORDS.on).
// A hostage is a civilian's record put down and bound, and until the dialogue pass she whimpered the office cleaner's corner lines ("I didn't see anything —")
// at men who had taken her at gunpoint. These are hers: said to the captor, to the one bound beside her, to whoever comes through the door. The civilians'
// register (frightened, broken off, the odd word in capitals), ≤ AIM_CHARS a line; {other} = another hostage's name (a line that needs one is left out when
// there is none). `team` is the one line the other way: a teammate's word to them once the room is his, in the squad's own lower case.
export const HOSTAGE_LINES = {
  /** held, a man of theirs standing over them, nothing happening yet: low, to him or to nobody */
  wait: ['Please — just let us go —', "We'll do what you say — please —", 'Please. Please.', "I can't feel my hands —", '— breathe. Just breathe. —', 'I want to go home —', "We haven't seen your faces — we haven't —"],
  /** he is shouting at the door and counting */
  threat: ["Please — don't — we've done NOTHING —", 'He means it — oh god, he MEANS it —', "Don't — please, please don't —", 'Somebody — PLEASE —'],
  /** his gun is on her */
  aimed: ['No — no, PLEASE —', "Don't — I'm begging you —", 'Wait — WAIT —'],
  /** he has shot the one beside her */
  shot: ['NO —!', '{other}! — oh god — {other} —', 'He SHOT {other} — he —', '— no no no no —'],
  /** the team's first loud thing at the room: a boot, a charge, rounds through the door */
  entry: ['— what was THAT —', "They're shooting — oh god —", "In HERE — we're in HERE —", '{other} — stay DOWN — stay down —'],
  /** nobody of theirs left in the room, and nobody of the team in it yet */
  alone: ['Hello? — is somebody there —?', "We're in here — HELP —", 'In here — please —'],
  /** the room is the team's */
  secured: ["Don't shoot — please — we're hostages —", 'Oh thank god — thank god —', 'Is it over? — is it OVER —?', 'Are they — are they gone —?'],
  /** a teammate to them, a beat after */
  team: ["stay down. you're safe — we've got you.", "you're all right. stay where you are.", 'friendlies. stay down till we say.'],
};
export type HostageMoment = Exclude<keyof typeof HOSTAGE_LINES, 'team'>;
/** every hostage line and the team's word to them (dialogue-probes: lengths, the blocklist, nothing of the office's civilians in it) */
export function hostageLines(): string[] { return Object.values(HOSTAGE_LINES).flat(); }

// ---------------------------------------------------------------- THE MAN A SNATCH IS FOR (game/snatch.ts `voice`, said through civilians.ts civSay / civilianAnswer).
// He is a civilian's record too, and until these he spoke the office's late worker ("I do the ACCOUNTS —", "…get a grip, {name}."): wrong for the man the team
// came for. Calm he says nothing; frightened, what he says is by what he is doing. The team is 'they' / 'you' to him; nothing of the office's in it.
export const SNATCH_LINES = {
  /** the first loud thing has reached him and he is running for a way out */
  running: ["They're here — they're HERE —", 'Not me — not ME —', 'Out — get me OUT —'],
  /** gone to ground with no way out left, hands not up */
  cornered: ['Stay back — stay BACK —', "I've nothing for you — nothing —", '— no, no, no —'],
  /** his hands on his head, a man of the team on him or just gone */
  handsUp: ["don't shoot! don't shoot!", "All right — all RIGHT — they're up —", "I'm not armed — look — nothing —"],
  /** tied where he gave up */
  tied: ["You've the wrong man —", "I'm not fighting you — easy —", 'They will come for me. You know that.'],
  /** in Sam's arm, the first press */
  held: ["All right — I'm not fighting — all right —", 'Easy — I have no gun — nothing —'],
  /** and every press after: he gives nothing */
  dry: ['I say nothing to you.', 'Ask whoever sent you.'],
};
/** every line of his (the say sites pass one of these through as it is) */
export function snatchLines(): string[] { return Object.values(SNATCH_LINES).flat(); }

interface AmbientState { next: number; run: AmbientRun | null; played: Map<string, number>; count: number; }
const ambientByGame = new SideMap<object, AmbientState>('dialogue.ambientByGame');
export function ambientState(g: Game): AmbientState { let S = ambientByGame.get(g); if (!S) { S = { next: -1, run: null, played: new Map(), count: 0 }; ambientByGame.set(g, S); } return S; }
function ambientLive(g: Game): boolean { return g.aiEnabled && !g.quietUtility && !g.puppet && !g.touring && escalationOf(g) === 0 && !g.alarm.episode && !g.blackout.active && !g.player.holding && !g.player.down; }
/** a calm patrolling staff man with nothing on his hands or his mind, not already talking, not held still by anybody's script */
function chatty(g: Game, x: Guard): boolean { return x.team === 'guard' && !x.unit && x.state === 'patrol' && !x.held && !x.script && !x.task && !x.bodyDuty && !x.pinned && !x.hold && !x.leader && !x.post && x.awareness < 0.15 && !(x.bubble && g.time - x.bubble.t < x.bubble.dur + 1) && !needsBusy(x) && g.guards.includes(x); }   // (needsBusy: a man telling the floor he is off for a coffee, or away on one — game/needs.ts — is not stopping to chat)
/** still fit to keep talking (the hold flag is ours by now) */
function stillChatty(g: Game, x: Guard): boolean { return x.state === 'patrol' && !x.held && !x.script && !x.task && !x.bodyDuty && x.awareness < 0.3 && g.guards.includes(x); }
function endAmbient(g: Game, S: AmbientState) { const r = S.run; if (!r) return; if (!r.held[0]) r.a.hold = false; if (!r.held[1]) r.b.hold = false; S.run = null; S.next = g.time + AMBIENT.cooldown; }
/** A RESTART (game.ts restartEncounter): the pairs' clock starts over, as on a floor just stood up — the first chat is AMBIENT.firstAfter from the restart, and a
 *  conversation under way went with the old shift (left to the per-frame hook it would end a frame later and set the cooldown against the new one). It used to
 *  keep the `next` of the page's first frame: after twenty calm seconds and a restart the first pair to meet stopped to talk at once, where a freshly stood-up
 *  floor's walk on (tools/qa/restart-probes.ts). The played ledger stays on the office (and everywhere with words.ts off): each conversation once before any repeats, across
 *  restarts too. Off the office, under the dialogue pass, a pair is heard once a RUN, so there a restart clears it. */
export function ambientRestart(g: Game) { const S = ambientByGame.get(g); if (!S) return; S.run = null; S.next = -1; if (WORDS.on && !isOffice(g.level)) S.played.clear(); }   // (words.ts: off the office a chat is heard once a RUN, so there the ledger is the run's — a load puts the file's back after this)
/** the line of a pair as it will be said: its `own` wording off the office (words.ts), else its text */
const pairSaid = (l: PairTalk['lines'][number], own: boolean) => own ? l.own ?? l.text : l.text;
/** The one per-frame hook (guards.ts updateEscalation): the handler's radio, then the pairs — advance a conversation under way (or drop it the frame either
 *  man stops being a calm patrol), else look for two chatty men within AMBIENT.pairM with a clear line between them and start the least-played conversation. */
export function updateAmbient(g: Game, dt: number) {
  tickRadio(g);
  const S = ambientState(g);
  if (S.run) {
    const r = S.run;
    if (!ambientLive(g) || !stillChatty(g, r.a) || !stillChatty(g, r.b)) { endAmbient(g, S); return; }
    for (const [me, him] of [[r.a, r.b], [r.b, r.a]] as const) { const c = me.char; c.bodyYaw = approachAngle(c.wantBody, Math.atan2(him.char.pos[0] - c.pos[0], him.char.pos[2] - c.pos[2]), AMBIENT.faceRate * dt); }   // half turned to each other while it lasts (the patrol's hold branch keeps their feet)
    if (g.time < r.at) return;
    if (r.i >= r.talk.lines.length) { endAmbient(g, S); return; }
    const L = r.talk.lines[r.i++]; const who = L.who === 0 ? r.a : r.b;
    const pad = r.pad;
    const raw = pairSaid(L, WORDS.on && !isOffice(g.level));
    const text = raw.replace(/\{Other\}/g, r.other ?? '').replace(/\{other\}/g, r.other ?? '').replace(/\{Code\}|\{code\}/g, pad?.code ?? '').replace(/\{PadDoor\}/g, pad ? pad.door[0].toUpperCase() + pad.door.slice(1) : '').replace(/\{padDoor\}/g, pad?.door ?? '');
    g.say(who, text);
    if (pad && /\{code\}/i.test(raw)) g.devices?.overhearSaid(g, who, pad.lockId);   // the digits are in the air: Sam has them if they carried to him (devices.ts overhear — the propagation, not a radius)
    r.at = g.time + bubbleSecs(text) + AMBIENT.gap;   // (say's own bubble length, then a breath)
    return;
  }
  if (!ambientLive(g)) { S.next = -1; return; }
  if (S.next < 0) { S.next = g.time + AMBIENT.firstAfter; return; }
  if (g.time < S.next) return;
  S.next = g.time + 1;   // (look again in a second if nothing pairs up now)
  const men = g.guards.filter(x => chatty(g, x));
  for (let i = 0; i < men.length; i++) for (let j = i + 1; j < men.length; j++) {
    const a = men[i], b = men[j];
    if (v3.distXZ(a.char.pos, b.char.pos) > AMBIENT.pairM) continue;
    if (g.col.solidBlocked([a.char.pos[0], 1.4, a.char.pos[2]], [b.char.pos[0], 1.4, b.char.pos[2]])) continue;
    const third = g.guards.find(x => x !== a && x !== b && !x.unit && x.state !== 'dead' && !knownDown(g, a).has(x.callsign)) ?? null;
    const K = g.devices?.padNear(a.char.pos) ?? null; const pad = K ? { code: K.def.code, door: doorName(K.door.def.name), lockId: K.def.name } : null;   // the pad they would mean (a level with none: no sticky-note talk)
    const own = WORDS.on && !isOffice(g.level);   // (words.ts, off the office: the building's own chats are out, the tokens are asked of the line that will be SAID, and — three chats left — each is heard once a run: silence after them, not a loop)
    const fits = AMBIENT_PAIRS.filter(p => (third || !p.lines.some(l => /\{other\}/i.test(pairSaid(l, own)))) && (pad || !p.lines.some(l => /\{code\}|\{padDoor\}/i.test(pairSaid(l, own)))) && !(own && (p.office || (S.played.get(p.id) ?? 0) >= 1)));
    if (!fits.length) return;
    fits.sort((p, q) => ((S.played.get(p.id) ?? 0) - (S.played.get(q.id) ?? 0)) || (hashStr(`${a.callsign}|${b.callsign}|${S.count}|${p.id}`) - hashStr(`${a.callsign}|${b.callsign}|${S.count}|${q.id}`)));
    const talk = fits[0]; S.played.set(talk.id, (S.played.get(talk.id) ?? 0) + 1); S.count++;
    const opener = hashStr(`${a.callsign}${b.callsign}${S.count}`) & 1 ? a : b; const other2 = opener === a ? b : a;
    S.run = { a: opener, b: other2, talk, i: 0, at: g.time + 0.3, other: third?.callsign ?? null, pad, held: [opener.hold, other2.hold] };
    opener.hold = true; other2.hold = true;
    return;
  }
}

// ================================================================================================================================================================
// CHECKPOINTS (game/savestate.ts): the floor-wide line ledger, Sam's remark memory, the handler's radio state and the ambient pairs' ledger — plain data. A
// conversation UNDER WAY is not carried: the file has the two men walking on (their hold flags come off in the save's copy of them; nothing here restarts it).
// ================================================================================================================================================================
export interface DialogueSnap {
  recent: [string, number][]; sam: { said: [string, number][]; last: string | null };
  radio: { done: string[]; queue: { at: number; beat: string }[]; reply: { at: number; text: string } | null; lastAt: number; esc: number; blackout: boolean; found: number } | null;
  ambient: { next: number; played: [string, number][]; count: number };
}
export function dialogueSnapshot(g: Game): DialogueSnap {
  const R = radioByGame.get(g); const A = ambientByGame.get(g);
  return {
    recent: [...(recentByGame.get(g) ?? [])], sam: { said: [...(samMemByGame.get(g)?.said ?? [])], last: samMemByGame.get(g)?.last ?? null },
    radio: R && R.run === g.mission ? { done: [...R.done], queue: R.queue.map(q => ({ at: q.at, beat: q.beat })), reply: R.reply ? { ...R.reply } : null, lastAt: R.lastAt, esc: R.esc, blackout: R.blackout, found: R.found } : null,
    ambient: { next: A ? (A.run ? g.time + AMBIENT.cooldown : A.next) : -1, played: [...(A?.played ?? [])], count: A?.count ?? 0 },
  };
}
/** …after the file's mission object is in place (the radio state is bound to it) */
export function dialogueRestore(g: Game, s: DialogueSnap | null | undefined) {
  recentByGame.delete(g); samMemByGame.delete(g); radioByGame.delete(g); ambientByGame.delete(g);
  if (!s) return;
  const fin = (x: number, d = 0) => Number.isFinite(x) ? x : d;
  recentByGame.set(g, new Map((s.recent ?? []).map(([k, t]) => [String(k), fin(t)] as [string, number])));
  { const m = samMemoryOf(g); for (const [k, t] of s.sam?.said ?? []) m.said.set(String(k), fin(t)); m.last = s.sam?.last ?? null; }
  if (s.radio) { const R = radioState(g); const S = s.radio; const beats = new Set(Object.keys(HANDLER_LINES));
    for (const b of S.done ?? []) if (beats.has(b)) R.done.add(b as HandlerBeat);
    R.queue.length = 0; for (const q of S.queue ?? []) if (beats.has(q.beat)) R.queue.push({ at: fin(q.at), beat: q.beat as HandlerBeat });
    R.reply = S.reply ? { at: fin(S.reply.at), text: String(S.reply.text) } : null; R.lastAt = fin(S.lastAt, -100); R.esc = S.esc | 0; R.blackout = !!S.blackout; R.found = S.found | 0; }
  { const A = ambientState(g); A.next = fin(s.ambient?.next ?? -1, -1); A.played = new Map((s.ambient?.played ?? []).map(([k, n]) => [String(k), n | 0] as [string, number])); A.count = s.ambient?.count | 0; A.run = null; }
}

registerScriptLines();
