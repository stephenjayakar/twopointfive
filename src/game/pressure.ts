// Defenders that PRESS a room their side has lost, come ROUND through a second door of it, and FALL BACK to fight again — the loud squad scenarios' harder
// defenders, each behaviour behind its own switch and the whole of it behind `PRESSURE.on` (default OFF: nothing here runs, no die is drawn, and the room fight is
// roomfight.ts exactly as it was — its three seams are `pressOwns` at the head of rally(), `pressTick` at the tail of tick() and `pressStop` in stop()).
//
// Nothing here is more hit points, a faster trigger, a truer aim or a die on the outcome. It is the SAME men with the SAME senses doing something less dumb with
// what they hear, and each thing they do says so first — one model for the picture and the AI: a call is `g.say` on their radio net (the '<callsign> (radio):'
// line in the log, the way tactics.ts's alert men already tell each other 'moving round' / 'set' — what a man knows of a press beyond his own ears is what went
// over that net), boots are 'step' hearing events the teammates' own ears take (roomfight.ts stepEars), a door is the door.
//
//  PRESS (PRESSURE.press). Today a defender who hears a fight at a mate's post goes to it only if the noise is still fresh when his beat is up, and then three
//    times in four (roomfight.ts rally): a room that falls in a second draws nobody, and its neighbours wait in theirs to be cleared in turn. With the switch
//    on, a fight at a post of his side's in another room is a thing he ACTS on for `memorySecs` after he heard it: after the same beat of his own (FIGHT_SKILL
//    rally) he calls it ('they've hit the others — get in there!' / 'with you — moving!') and goes at it, the fight AI's man exactly as the stock rally's is.
//    Who goes is situation, not dice: a lone garrison goes, a room of several leaves its farthest man at home, at most `maxMen` to a press. A man this file
//    does not take is the stock rally's as before (`pressOwns`): the hook never leaves a man standing who would have gone.
//    `gather` (off) is the other way to press, kept for A/B: they RUN to spots outside that room's doors, off their lines, hold them from outside ('hold the
//    doors — let them come to us!') until a fight inside, the trap sprung at one door (`converge`) or `siegeSecs`, and go together on a word ('go — go — go!').
//    One man by himself never goes in on that road: he holds the door from outside and says so. Measured: a formed-up push into a room four rifles hold LOSES
//    (the team keeps more men than today); going at once, while the entry is still on, is what costs the team.
//  FLANK (PRESSURE.flank). The second and later men of a press look at the door their shortest way goes through: if a man of the press has it already and
//    another door of that room is not absurdly far round (≤ flankMaxM, ≤ max(flankK × his shortest way, shortest + flankSlackM)), he takes that one — 'going
//    round — keep them there!', a run on a path that does not cross the room, his boots filed for the team's ears, then 'in position — on them!' and in. So
//    the press arrives at two doors, and the door the team did not watch is the one it comes through.
//  FALL BACK (PRESSURE.fallBack). (a) A man of a press who can see enough of it down (his own nerve, the stock fall-back's number — or every other man of it
//    lies where he can see him) with the enemy on him goes BACK out to a spot outside the door he came by and holds that door from there: 'back — get back!
//    hold the door!'. (b) The last man up in a room, with two or more of the team in his own sight, does not die at his post: after his own beat he leaves by
//    a door the trouble is not at, plants beyond it watching it, and tells whoever of his side holds the room he has come into ('they're right behind me —
//    watch that door!' — their evidence for that door goes up). (c) `outEarly`: he does not have to see them — on a floor gone loud, the team's boots at one
//    door of his room send him out by another before the door goes. WHERE a man falls back to is one seam (`PRESSURE_HOOKS.fallBackTo`) another module may
//    answer — a room his side has dug in. The stock fall-back (roomfight.ts lost → breakOff) is untouched and still runs first. Men somebody else has pinned
//    to their room (the rescue's men with the hostages: rallyAt Infinity / lostAt ahead of the clock) and a man in Sam's arm are never this file's.
//  STAND AND FIGHT (PRESSURE.second — off in the build, ON under the difficulty switch's hard). A team that does not wait in the room it took is met in the
//    open, on its way to the next door, by the men the press sent at that room — and a man who walks on at four rifles while he shoots loses. With this on, a
//    hunter the press called who gets his eyes on one of them OUT of the room he was called to (and is out of it himself) stops where he stands and fights
//    from there, the room fight's holder again: a set gun, the first of them calling it on their net ('contact — they're out in the open! stand and
//    fight!'). A team still in the room is pressed exactly as before. Off = they walk on at you one by one, as they did.
//
// What the counts mean (`pressureStats`, tools/qa/playthrough.ts files them per run): a behaviour FIRED when a man acted on it; its cue is the call at that
// moment; it LANDED when that man first had eyes on an enemy or an enemy on him; `lead` = seconds from HIS call to that (summed; ≥ 1 s = the cue came first);
// `heard` = a teammate's own ears had that man's boots (roomfight.ts Op.stepBy) before he landed.
import { SideMap, SideSet } from '../math/side';
import { Vec3, v3, clamp } from '../math/vec';
import type { Game, Guard } from './game';
import type { Door } from './doors';
import type { RoomFight } from './roomfight';
import { FIGHT_SKILL } from './roomfight';
import { frameOf, canSeeChar, sightGainOn, clearShot, doorCells, lightEstimateAt, LIGHTS } from './guards';
import { order, endGuardScript } from './squad';
import { isHostile } from './teams';
import { sideShotEnergy } from './glasspen';
import { DIGIN, digInStays, digInSet, digInRefuge, digInPhase } from './digin';
import { squadOwns, squadStaysIn, squadsLive } from './enemysquads';
import { silentStep } from './silent';
import { lastStandMan } from './laststand';
import { bang } from './effects';
import { DOORTOOLS } from './doortools';
import { giveStuns, stunsOf, markDanger, dangerAt, dangerDoors } from './tactics';
import { hearPath } from './weather';
import { WORDS, w } from './words';
import { laneExposed, laneHolds, laneWarns } from './lanes';
import { teamTread } from './teampace';
import { loadGait, loadHeard } from './kitload';   // (a teammate's card in the defenders' ears: his footfall as the mixer has it)
import { simRandom } from '../math/dice';   // the simulation's die (math/dice.ts): the Game's own when it has one, Math.random otherwise

export const PRESSURE = {
  /** the master switch: off = none of this file runs */
  on: false,
  /** the three behaviours, each measurable alone (all need `on`) */
  press: true, flank: true, fallBack: true,
  /** HARD ON A LEVEL THAT DECLARES SQUADS (enemysquads.ts): the press above stands down there — the squads own who moves — so harder defenders are the
   *  squads themselves as a DRILLED GARRISON: enemysquads.ts SQUADS.drill* (each rule its own switch there), read only while `on` and this row are both
   *  up and squads are staged. Off = hard on a squads level is standard run for run, as it was */
  squadDrill: true,
  /** stand and fight: a hunter the press called who meets the team out of the room he was called to stops and fights from where he stands (needs press;
   *  nothing under `gather`, whose men are set outside the doors already) */
  second: false,
  /** the stood man KEEPS THE MAN HE IS ON (needs second): planted where he stands with his fix and his aim as they are (roomfight.ts standOn). Off = as the
   *  rule was first measured: stood by a scripted leg to his own feet — a frame without senses, his watch turned to a room door, and the beat of a man
   *  surprised (0.9–2 s without a round) owed against the man he was already looking at. ON with `secondSet` since it measured no easier than that
   *  (straight on, seeds 145-288: the office four −12 teammates of 576, −43 to +19; The block −21, −51 to +8) */
  secondKeeps: true,
  /** with secondKeeps: he is a SET GUN on that man (the short beat of a defender whose man shows where he is looking, the pre-aim if his gun was on him).
   *  Off = no beat, no pre-aim: measured clearly EASIER than the rule as first measured (office straight on, seeds 145-288: +41 teammates of 576, +8 to +75) —
   *  most of the first rule's bite was the set gun's pre-aim, which the stood man got by being re-planted */
  secondSet: true,
  /** men to one press (a far room that goes together — `byWay` — is not cut in two by it: its men are over the count) */
  maxMen: 4,
  /** of several men holding one room, the one farthest from the fight stays to keep it (false = every man who hears it goes) */
  keepRoom: true,
  /** s a fight he heard stays worth going to */
  memorySecs: 15,
  /** × his beat between hearing the fight and calling it and going (1 = the stock rally's own beat, FIGHT_SKILL rally: 1.5–4 s). The dial for how long a team
   *  that keeps moving has before the press is on it */
  organiseK: 1,
  /** STAND TO — surprise lost before the first entry. The first loud thing they hear is not a room of theirs being hit (the team's gunfire on the way in): the
   *  man best placed calls it on the net ('shots outside — they're coming. stand to!'). While the report stands nobody walks off to it by himself, and the
   *  men of every room but the one the noise is nearest keep their hands off the furniture and stand ready. When a room IS hit ('contact! …' on the net)
   *  it is ALL HANDS, for the rest of the fight: no man is left at home to keep a room and a press takes every man who hears it (maxMen is not asked).
   *  Nobody comes, and nothing more is heard, for `standSecs`: they stand down, on the net, and the stock rules are back (a later report starts it again).
   *  Off = a report is a fight at the nearest mate's post, as it was. A fight that starts as a fight (the first loud thing is a boot, a charge, a round in a
   *  room) never comes through here: a team that kept surprise meets the defenders it met with this off. Off in the build, ON under the
   *  difficulty switch's hard (difficulty.ts HARD.warned) */
  warned: false,
  /** stood to, ALL HANDS GO THROUGH THE PRESS (needs warned): the stock rally's clock does not run while the report stands, so at the hit every man takes his
   *  beat and joins the press (round by another door, stand and fight). Off = as the rule was first measured: the clocks armed at the report have run out by
   *  the hit, and three men in four leave that frame by the stock rally, each by himself, the rest through the press. OFF: measured easier for the team
   *  (The block with surprise lost, seeds 145-288: +18 runs won of 144, +3 to +33; +17 teammates of 576, −17 to +51) — men who all arrive together
   *  at the bang meet the team at its strongest */
  standPress: false,
  /** THE KEEPER IS A MAN SOMEBODY LEFT (digin.ts asks `pressKeeps` with DIGIN.keeper off): he counts as the press's keeper only once a mate of his room has
   *  gone to a press. Off = as the rule was first measured: named keeper when the first man of his room finished his beat, he was kept off his furniture
   *  even when that man never went. ON: measured no easier (The block, seeds 145-288: +6 teammates of 576, −16 to +30; runs won −5 of 144, −15 to +5) */
  keeperLeft: true,
  /** s between the first man hearing it and his call */
  reportSecs: 1.4,
  /** s stood to with nobody coming and nothing more heard before they stand down */
  standSecs: 75,
  /** s after the room is hit that a man who stood ready is still the press's, not the furniture's (his beat toward the fight starts at the hit) */
  standGrace: 5,
  /** s before a man who has been in a press joins another */
  againSecs: 14,
  /** A CHARGE EACH (0 = none: f6cf9316's press run for run; on under hard on The block only — difficulty.ts HARD_AT; record
   *  rebuild/hard-everywhere/round2-block.md): every defender carries this many stun charges, the team's own kind, and a man of a press let
   *  go at the fight takes the door he was put down for as a DRILL instead of walking in (tactics.ts's kill-zone doorway, built for the night staff's response
   *  team and never yet handed a charge): on the jamb out of the opening, the call on their net ('they're in there — … stack on me, charge first'), his second
   *  fetched or the wait run out, the leaf shoved, 'bang out', the can in round the jamb and heard on the floor before it goes, 'going in'. All of that is what
   *  the player is given to answer it with: a voice at the door, an arm round the jamb, a can bouncing. Handed to each man of a fight once, the first frame the press sees him (a charge spent is not replaced); what it does to a man
   *  is combat.ts FLASH, the same numbers both ways */
  stuns: 0,
  /** A CHARGE GOES ONLY WHERE THEY ARE KNOWN TO BE (on; off = a man let go with a charge marked whatever door the press put him down for — the 10-13 tapes:
   *  eight charges burst in rooms no teammate was in, each after a man of that room was shot through a window from outside, two of them after their own net
   *  had said the team was in the yard, one dazzling their own man). 'A fight at a mate's post' is what sends a press; it does not say the team is IN that
   *  room. A door is taken charge first only on something that does: a living man of theirs who has NOTICED them has had one of the team in his sight in
   *  that room, the team's own unsuppressed gunfire came from inside it, they booted a door of it, or the man at the door has their boots in his ears through it — inside `stunKnowSecs`, and
   *  with nothing newer (by more than `stunMovedSecs`) putting them somewhere else. A man let go without it walks on as the fight AI's man, as he did before
   *  anybody carried a charge, and takes the door as the drill the moment his side has it (`stunLate`); a door already marked and not yet banged is let be the
   *  moment the newest thing they know puts the team elsewhere (`stunOff`: tactics.ts's 'the doorway is plain again'). */
  stunKnown: true, stunKnowSecs: 20, stunMovedSecs: 3,
  /** A LAST MAN ALONE KEEPS HIS ROOM (on; off = the last of them alive pressed like anybody — 'they've hit the others — get in there!' on a net with
   *  nobody left on it, and off alone at four rifles; the 10-13 tapes have it five times, each stopped short by a covered lane a moment later). With it on
   *  he neither starts a press nor walks off on the stock rally: his room, his doors, and the rules for a room's last man (fall back, dig in) as they are. */
  lastHolds: true,
  /** THE PICKET (off: every staging as it was; off under hard too — difficulty.ts HARD.picket, built and measured, not shipped; record rebuild/hard-everywhere/depot-and-pairs.md):
   *  NEVER TWO MEN IN ONE FLASH, in the room the team comes to first. Its men are the ones no rule above reaches: no fight comes before theirs, so they hear
   *  nothing, go nowhere, and one can through one door folds the pair of them where they stand (measured: worth next to nothing, at standard and hard alike).
   *  Where that room has a second door, one of the pair stands OUTSIDE it instead — beyond the door farthest on foot from the team's start, off its line, his gun
   *  on it (where that door opens into the next room, as on the depot and The block, he stands in that room, beside its men). The can does not reach him; he hears the room go, says so, and comes in by his door behind the men who took it. Only that room (a man of any other
   *  room is one who would have come hunting: posting him outside was measured to make the big floor far easier), only when the two would share a can (burst
   *  1.6 m inside a door, both within its reach with a line to it), never a man the scenario pins. He can be seen, and dealt with, before the entry */
  picket: false,
  /** READS THE DOORS BETWEEN (off: 51ce9c3's hard run for run; ON under hard — HARD.byWay): where his room stands to the fight decides who goes. NEXT DOOR
   *  (his room shares a door with the room being fought over): as ever — he goes on his own beat and the farthest man of his room keeps it, because that door
   *  is the team's next. NOT next door (a corridor, a hall or another room between): nobody is coming for his room next, so nobody is kept and the men of one
   *  room go TOGETHER. The first to place the noise says so and the men of his room know it from him (a noise heard and not placed is otherwise a man who
   *  turns to his furniture), the place stays put for `memorySecs` (not lost when the next shot comes to him by another doorway), and the first whose beat is
   *  up waits for the last of them — no beat is shortened; they leave on the slower man's — and they go by one door (the second takes the first's door and
   *  role: the other door stays free for a man who goes round), so they are let go the same moment and the fight AI has two men on
   *  one fix instead of one man walking twenty metres to land alone on a team that has had fifteen seconds to set. Measured (the depot's stores, 19 m and three
   *  doors from the crew room): the pair that left together was worth three times the two that left one at a time */
  byWay: false,
  /** HARD'S RESCUE CREW (off; ON under hard — HARD.rescueCrew): on a hostage rescue the captor's two men act on his word (rescue.ts crew(): a gun on the
   *  hostage door from a side room · the door man inside · a roamer who hides and comes up behind — each its own RESCUE row). Nothing in this file reads it */
  rescueCrew: false,
  /** HARD'S DRILLED DEFENDERS (off; ON under hard — HARD.drilled): on the night breach by itself, a defender is half as shaken by a stun canister or a
   *  boot, so the burst he fires blind down the door he was watching is partly fired instead of lost to the seconds he spent doubled over (roomfight.ts
   *  DRILLED). Nothing in this file reads it; like every row here it does nothing with `on` off */
  drilled: false,
  /** the way round a flanker will take: metres at most, and against his shortest way to that room */
  flankMaxM: 46, flankK: 3, flankSlackM: 14,
  /** the last man's beat before he gives a room up: s, with two of the enemy in view the whole of it */
  lastManSecs: [0.35, 0.9] as [number, number],
  /** …and he does not wait to see them: alone in his room on a floor gone loud, the team's boots at one door of it send him out by another (false = only the
   *  sight of two of them does) */
  outEarly: true,
  /** s a fight heard elsewhere on the floor keeps a man that ready to give his room up · his beat between the boots at his door and his move */
  loudSecs: 90, outSecs: [0.8, 1.6] as [number, number],
  /** false = every man goes at the fight the moment his own beat is up (a flanker: the moment he is round); true = they FORM UP outside the doors first and go
   *  together on a word — the knobs under this one are that mode's */
  gather: false,
  /** s from a press's first call until its men stop waiting for more of them (two alive: set; one: he holds the door from outside) */
  gatherSecs: 8,
  /** s more they wait for a man still on his way round */
  flankSecs: 6,
  /** s a press set on a quiet room's doors holds them from outside before it goes in (0 = in as soon as it is set) */
  siegeSecs: 25,
  /** the men holding the doors listen for the team moving inside and go on that */
  listen: false,
  /** the men at a quiet door go through when they hear the trap sprung at another */
  converge: true,
  /** s between the word and the move: the cue's own length */
  wordSecs: 0.9,
  /** THE WAY OUT (off: every level as it was; ON under hard — difficulty.ts HARD.wayOut; record rebuild/hard-everywhere/round2-records-pair.md).
   *  Only on a floor whose structure asks for it (scene/scenarios.ts StructureData.wayOut — levels/records.json: a pair's building, one man in the first room,
   *  every hunter's way in through the one door two rifles are already on). There the men a lost room draws do not walk into it one at a time: they FORM UP
   *  on ONE door of it — the nearest to the first of them (the `gather` road above, whatever that row says) — and hold it from back off it: `wayOutM` past
   *  the reach of the can that comes out of a door first (effects.ts bang.dazzleRadius round where it goes off), each with a line to the door, none in
   *  another's, out of the place's own light where the floor allows — guns on the door the team has to leave by. Nobody goes round, nobody goes in at the
   *  noise, a man with no such spot stays home; the lead says it on their net ('back off the doors — out of their flash! let them come out to us!'): that
   *  line is the cue. They go in on the word only when `wayOutSecs` have brought nobody out. The measured answer is SPEED: they need some eight
   *  seconds from the door going to be set, and a pair that goes straight on through that door meets them walking (the record's rush row); a can thrown
   *  long, another door with a can for the hall, or no light in the doorway are a player's to try — not measured */
  wayOut: false, wayOutM: 0.6, wayOutSecs: 60,
  /** GO AND LOOK (off: every level as it was; ON under hard where the page says so — difficulty.ts HARD.sweep. The maintainer, 10-13: 'harder settings have
   *  better trained guys, more proactive, higher morale, better kit'). Their side has had word of the team — one of them properly in a man's sight, a loud
   *  thing in a man's ears — and then NOTHING for `sweepSecs`. On the floor as it was nobody moves again: each man holds the spot the noise left him on
   *  until the team comes to him, however long they take over it. With this on two of them go and look, together: the holding man nearest the place that
   *  word put the team who has a mate within `sweepPairM` of him, and that mate, on his word on their net ('gone quiet. with me — we go and look.': that
   *  line is the cue, `sweepBeat` before either moves), let go at that place as the stock rally lets a man go — the fight AI's own hunt, its doorway drill
   *  and its search; where they end up calm, they hold. ONE look per word: a place looked at is not looked at again until the team is seen or heard anew,
   *  and never oftener than every `sweepSecs`. Nobody goes to a room a man of theirs holds (he is looking at it), while a man is still out, a press or a
   *  fall-back is live or a report stands; somebody always stays (`sweepMen` is never fewer than two nor all of them); and A LOOK THAT LOSES A MAN IS THE
   *  LAST: nobody else walks out that fight. Never a squad's man (enemysquads.ts has its own form of this), a last stand's, a hostage rescue's, one on
   *  his way to cover or wedging a door (digin.ts; a man SET on his door may go), or one who knows a covered lane lies that way (lanes.ts). The dead say
   *  nothing: a man dropped without a sound is no word. No die is drawn. */
  sweep: false, sweepSecs: 20, sweepMen: 2, sweepBeat: 1.5, sweepPairM: 12,
};

type Def = RoomFight['defs'][number];
/** WHERE a man who gives ground goes is one seam: `fallBackTo`, when set, is asked first by every fall-back in this file (why = 'push': his press failed ·
 *  'seen': last man with two of them in view · 'door': last man with their boots at his door) and may answer a spot (and the door he will then watch, if one)
 *  — a room his side has dug in, say; null = this file's own answer (back out of the door he came by · beyond a door the trouble is not at). A spot he has no
 *  way to on foot is ignored. */
export const PRESSURE_HOOKS: { fallBackTo: null | ((g: Game, D: Def, why: 'push' | 'seen' | 'door') => { spot: Vec3; door: Door | null } | null) } = { fallBackTo: null };
function hooked(g: Game, D: Def, why: 'push' | 'seen' | 'door', threat: Vec3): { spot: Vec3; door: Door | null } | null {
  const h = PRESSURE_HOOKS.fallBackTo?.(g, D, why) ?? null;
  if (h) return g.col.nav.findPath(D.gd.char.pos, h.spot)?.length ? h : null;
  // nobody else answering, and digin.ts on as well: a room of his side's that has dug in and the team has not reached — he falls back INTO the next fight
  // (`threat` = what he is giving ground to; digin.ts has walked the way there itself)
  return DIGIN.on && DIGIN.refuge ? digInRefuge(g, g.fight, D, threat) : null;
}
type Room = NonNullable<Def['room']>;
type Entry = Room['entries'][number];
interface Man {
  D: Def; role: 'press' | 'flank'; door: Door; spot: Vec3;
  /** the room he left for it */
  from: Room | null;
  /** on a leg THIS module ordered (a stock fall-back taking him off it drops him from the press) */
  moving: boolean; set: boolean; setAt: number; tries: number; stepT: number; small0: number;
  /** when he said what he was about to do */
  cueT: number;
  /** when he was let go at the fight */
  freeAt: number; landT: number; arrived: boolean; heard: boolean; fell: boolean; replantT: number; fought: boolean; out: boolean;
  /** when he last asked for a way back */
  askT?: number;
  /** PRESSURE.stunKnown: his door is marked for the drill on his account · when he last listened at it */
  charged?: boolean; earT?: number;
}
interface Press { id: number; room: Room; at: Vec3; t0: number; phase: 'gather' | 'word' | 'go'; teamIn: boolean; setAt: number; loneAt?: number; sprung?: boolean; listenAt: number; moving: boolean; wordAt: number; goAt: number; n0: number; lone: boolean; men: Man[] }
/** a last man who gave his room up */
interface Out { door: Door | null; def: Def; moving: boolean; plantT: number; fought: boolean; stepT: number }
const newStats = () => ({
  pressFormed: 0, pressMen: 0, pressSieges: 0, pressConverge: 0, pressWords: 0, pressLone: 0, pressArrived: 0, pressLate: 0, pressLanded: 0, pressCueFirst: 0, pressHeard: 0, pressLead: 0,
  flankSent: 0, flankSet: 0, flankArrived: 0, flankLate: 0, flankLanded: 0, flankCueFirst: 0, flankHeard: 0, flankLead: 0,
  fbPush: 0, fbLast: 0, fbEarly: 0, fbPlanted: 0, fbFought: 0, fbTold: 0,
  /** stand to: reports called, stood down with nobody coming, rooms hit while stood to, and Σ s between the call and that hit */
  warnCalls: 0, warnStoodDown: 0, warnHits: 0, warnLead: 0,
  secondStood: 0, secondCalls: 0,
  pairsTold: 0, pairsWaited: 0, pairsWent: 0,
  /** PRESSURE.stuns: doors marked charge first · a charge held back (nothing put the team in that room) · of those, with a man of the team in it all the same (a count: the floor's truth) · marked later, once something did · a mark let be
   *  (the team is known to be elsewhere) · charges that went off through a marked door, and of them into a room no man of the team stood in (a count: the
   *  floor's truth, which no defender is given) · the last man alone who kept his room */
  stunMarked: 0, stunHeld: 0, stunHeldIn: 0, stunLate: 0, stunOff: 0, stunBangs: 0, stunEmpty: 0, lastHeld: 0,
  /** PRESSURE.sweep: looks called · men let go on one · a look called off in its beat (the team was seen or heard again, or a man of the pair was no longer free to go) */
  lookCalled: 0, lookMen: 0, lookOff: 0,
});
/** STAND TO: the report standing. 'heard' = a man has it in his ears, 'called' = it is on the net and nobody has come yet, 'over' = a room was hit (or the
 *  first loud thing WAS a room being hit: there never was a report) */
interface Warn {
  phase: 'heard' | 'called' | 'over'; t0: number; by: Def;
  /** when it was called (−1: never) and the last loud thing any of them heard while it stood */
  callT: number; lastT: number;
  /** the room of theirs the noise points at: its garrison braces, the men of every other room are the reaction force (null: no report) */
  room: Room | null;
  /** when a room was hit */
  hitT?: number;
}
interface State {
  presses: Press[]; of: Map<Def, Man>; outs: Out[]; serial: number;
  /** the fight these counts were of has stopped: the next one starts them again */
  stale: boolean;
  think: Map<Def, { room: Room; at: number; /** PRESSURE.byWay: since when he has waited for a mate */ held?: number }>; stay: Map<Def, Room>; called: Map<Def, { T: Room; t: number }>; stoodT: number;
  /** rooms a man has left for a press this fight (keeperLeft) */
  sent: Set<Room>; doneAt: Map<Def, number>; last: Map<Def, number>; tried: Map<Def, number>;
  /** what a man alone in his room last heard of the team at a door of it: when he listened, which entry, when he heard it */
  ear: Map<Def, { t: number; i: number; at: number }>;
  warn: Warn | null;
  /** PRESSURE.byWay: a far fight he has placed, or that a man of his room placed and told him of (a noise he heard and could not place himself) */
  told: Map<Def, { T: Room; at: Vec3; t: number }>;
  /** PRESSURE.stunKnown: when the team was last HEARD in a room (their own gunfire from inside it, a door of it booted, boots through the door a man stands
   *  at), the newest such sound anywhere, the events already read, and the doors marked charge first with the room beyond each */
  heard: { t: number; p: Vec3 }[]; evSeen: WeakSet<object>; marks: Map<Door, { R: Room | null; team: Guard['team']; own: boolean }>; bangs: WeakMap<object, boolean>; lastHeld: Set<Def>;
  /** PRESSURE.sweep: the newest word their side has of the team (when, where) · the word the last look was called on · the look called and not yet gone */
  word: { t: number; p: Vec3 } | null; swept: number; look: { at: Vec3; goT: number; w: number; men: Def[] } | null; /** the men of the last look while any is still out · one of them went down out there · when the last look was called */ out: Def[] | null; lookLost: boolean; lookT: number;
  stats: ReturnType<typeof newStats>;
}
const STATES = new SideMap<Game, State>('pressure.STATES');
const stateOf = (g: Game): State => { let s = STATES.get(g); if (!s) { s = { presses: [], of: new Map(), outs: [], serial: 0, stale: false, think: new Map(), stay: new Map(), called: new Map(), stoodT: -100, sent: new Set(), doneAt: new Map(), last: new Map(), tried: new Map(), ear: new Map(), warn: null, told: new Map(), heard: [], evSeen: new SideSet(), marks: new Map(), bangs: new SideMap(), lastHeld: new Set(), word: null, swept: -Infinity, look: null, out: null, lookLost: false, lookT: -Infinity, stats: newStats() }; STATES.set(g, s); } return s; };

/** PRESSURE.wayOut on a floor whose structure asks for it: the press forms up and holds the lost room's doors from back off them */
const wayOut = (g: Game) => PRESSURE.wayOut && g.level.scenarios?.roomClear?.wayOut === true;
/** the press forms up outside the doors before it goes (the `gather` row, or the way out) */
const forms = (g: Game) => PRESSURE.gather || wayOut(g);
const KITTED = new SideSet<Guard>('pressure.KITTED');   // PRESSURE.stuns: the men who have been handed theirs
const ROOM_CELLS = 500;   // past this a 'room' is open floor (roomfight.ts's own line between the two)
const STAND_OFF_BAND = 7, STAND_OFF_TRIES = 10;   // PRESSURE.wayOut: how deep the band of floor past the can's reach is · how many of the nearest spots in it he walks the way to
const PAIR_WAIT_SECS = 6;   // PRESSURE.byWay: a man waits this long at most for a mate to be ready (past the longest beat there is)
const CUE_FIRST_SECS = 1;   // a cue counts as having come first when the player had at least this long between it and the man
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const pick = (r: [number, number]) => r[0] + simRandom() * (r[1] - r[0]);
const alive = (D: Def) => D.gd.state !== 'dead';
const note = (g: Game, F: RoomFight, gd: Guard, what: string) => { F.log.push({ t: g.time, who: gd.callsign, what: `[pressure] ${what}` }); if (F.log.length > 600) F.log.splice(0, 200); };
const cellOf = (g: Game, p: Vec3) => { const nav = g.col.nav; return nav.idx(Math.floor(p[0] / nav.cell), Math.floor(p[2] / nav.cell)); };
const eyeOf = (gd: Guard): Vec3 => { const h = gd.char.bones.head; return h ? [h[0], h[1], h[2]] : [gd.char.pos[0], 1.6, gd.char.pos[2]]; };

/** the room of his side's he hears fought over: the nearest post of a mate's in ANOTHER room to where his own ears put the noise (he knows where his side
 *  stands; he does not know where the enemy does), if that is a real room and not his */
function target(F: RoomFight, D: Def): { T: Room; at: Vec3 } | null {
  if (!D.noiseAt) return null;
  const mine = picketHears(F, D);   // (a picket still on his post: a noise in the room he was posted outside, or at a door of it, is that room's — he knows whose it is)
  if (mine) return { T: mine, at: v3.copy(D.noiseAt) };
  let best: { T: Room; at: Vec3 } | null = null, bd = 9;
  for (const X of F.defs) {
    if (X === D || X.room === D.room || X.mode === 'free') continue;
    const d = flat(X.station, D.noiseAt); if (d >= bd) continue;
    const T = (PICKET_WENT.has(X.gd) ? undefined : PICKETS.get(X.gd)) ?? F.roomAt(X.station);   // (a picket on his post stands for the room he was posted outside, not the one his feet are in)
    if (!T || T === D.room || T.cells.size > ROOM_CELLS || !T.entries.length) continue;
    bd = d; best = { T, at: X.station };
  }
  return best;
}

/** the pickets of this staging (PRESSURE.picket): a man posted outside his garrison's room knows it is his side's, wherever in it the noise is */
const PICKETS = new SideMap<Guard, Room>('pressure.PICKETS'), PICKET_WENT = new SideSet<Guard>('pressure.PICKET_WENT');
const PICKET_DOOR_M = 2.5;   // (a noise this near a door of his room is AT it)
/** the room a picket hears fought over while he is still on his post: his garrison's, if the noise is in it or at a door of it. Once he has gone in he is a man
 *  like any other of the room he stands in */
function picketHears(F: RoomFight, D: Def): Room | null {
  const mine = PICKETS.get(D.gd); if (!mine || PICKET_WENT.has(D.gd) || D.room === mine || !D.noiseAt) return null;
  return F.roomAt(D.noiseAt) === mine || mine.entries.some(e => flat(e.at, D.noiseAt!) < PICKET_DOOR_M) ? mine : null;
}
/** PRESSURE.picket at a staging (nightbreach.ts stage(), before the cast is spawned): `marks` = where the scenario stands its defenders, `teamAt` = where the team
 *  starts. Returns the marks with the first room's picket moved outside it (`picket` = the room he is of; never the drill's man afterwards) — the same array
 *  when the switch is off or nothing qualifies */
export function picketMarks<M extends { pos: Vec3; aimAt: Vec3; drill?: boolean }>(g: Game, marks: M[], teamAt: Vec3): (M & { picket?: object })[] {
  if (!PRESSURE.on || !PRESSURE.press || !PRESSURE.picket) return marks;   // (what he does from his post is the press's: no press, no picket)
  const F = g.fight, nav = g.col.nav, by = new Map<Room, number[]>();
  const flashM = bang.dazzleRadius, burstM = DOORTOOLS.airIn;   // (what a can thrown through a door reaches, and how far inside the frame line it goes off)
  marks.forEach((m, i) => { const T = F.roomAt(m.pos); if (T && T.cells.size <= ROOM_CELLS) { const l = by.get(T); if (l) l.push(i); else by.set(T, [i]); } });
  const wayLen = (a: Vec3, b: Vec3) => { const path = nav.findPath(a, b, 20000); if (!path?.length) return Infinity; let L = 0, q = a; for (const w of path) { L += flat(q, w); q = w; } return L; };   // (once a staging: a budget that does not lose the far door of a big floor)
  // the room the team comes to first: the one with the shortest way on foot from its start to the near side of a door of it
  let first: Room | null = null, fd = Infinity, near: Entry | null = null;
  for (const T of by.keys()) for (const e of T.entries) { if (e.door.def.steel) continue; const d = wayLen(teamAt, [e.at[0] + e.out[0] * 1.2, 0, e.at[2] + e.out[1] * 1.2]); if (d < fd) { fd = d; first = T; near = e; } }
  const idx = first ? by.get(first)! : [];
  const T = first as Room | null; if (!T || idx.length < 2) return marks;
  const ways = T.entries.filter(e => !e.door.def.steel); if (ways.length < 2) return marks;
  const share = new Set<number>();   // the men of it one can would take together, through whichever door
  for (const e of ways) {
    const b: Vec3 = [e.at[0] - e.out[0] * burstM, 1.2, e.at[2] - e.out[1] * burstM];
    const hit = idx.filter(i => { const h: Vec3 = [marks[i].pos[0], 1.6, marks[i].pos[2]]; return v3.dist(h, b) < flashM && !g.col.segmentBlocked(b, h); });
    if (hit.length >= 2) for (const i of hit) share.add(i);
  }
  if (!share.size) return marks;
  let best: { e: Entry; spot: Vec3; L: number } | null = null;
  for (const e of ways) {
    if (e === near) continue;   // (never the door the team comes to)
    const fr = frameOf(e.door);
    for (const [depth, lat] of [[2.4, 1.2], [2.4, -1.2], [3.0, 1.6], [3.0, -1.6], [1.2, 1.7], [1.2, -1.7]]) {
      const p: Vec3 = [e.at[0] + e.out[0] * depth + fr.ux * lat * (1 + fr.W / 3.2), 0, e.at[2] + e.out[1] * depth + fr.uz * lat * (1 + fr.W / 3.2)];
      if (nav.isBlocked(p[0], p[2]) || T.cells.has(cellOf(g, p)) || marks.some(m => flat(m.pos, p) < 0.9)) continue;
      if (g.col.solidBlocked([p[0], 1.1, p[2]], [e.at[0] + e.out[0] * 0.5, 1.1, e.at[2] + e.out[1] * 0.5])) continue;   // (he stands where he sees his door)
      const L = wayLen(p, teamAt); if (L === Infinity) continue;
      if (!best || L > best.L) best = { e, spot: p, L };
      break;
    }
  }
  if (!best) return marks;
  let who = -1, wd = Infinity; for (const i of share) { const d = flat(marks[i].pos, best.e.at); if (d < wd) { wd = d; who = i; } }
  const out: (M & { picket?: object })[] = marks.slice();
  out[who] = { ...marks[who], pos: best.spot, aimAt: [best.e.at[0], 1.1, best.e.at[2]] as Vec3, drill: false, picket: T };
  return out;
}
/** …and once he is spawned on it (nightbreach.ts): `room` = what picketMarks put on his mark */
export function postPicket(gd: Guard, room: object) { PICKETS.set(gd, room as Room); }

/** roomfight.ts rally() asks this first: true = this module has the man — he is in a press, on his beat toward one, or the one of his room who stays to keep
 *  it — so the stock walk-over-by-himself does not start. Anybody this module has NOT taken (a fight out on the open floor, the press switch off, a man it turned
 *  down) is the stock rally's exactly as before: the hook never leaves a man standing who would have gone. */
export function pressOwns(g: Game, D: Def): boolean {
  if (!PRESSURE.on || !PRESSURE.press) return false;
  const st = stateOf(g);
  if (st.of.has(D) || st.think.has(D)) return true;
  if (lastAlone(g.fight, D)) return true;   // (PRESSURE.lastHolds: nor does the stock rally walk him off — nobody is left to go to. The other askers of this read it the same way and lose nothing: no mate is alive to call him (buddy.ts), laststand.ts leaves him be, and cues.ts gives no 'staying' word to an empty net)
  if (awaiting(st)) { if (PRESSURE.standPress) D.rallyAt = NaN; return true; }   // (stood to: nobody walks off to a report by himself — and with standPress the stock walk's clock does not run on under it)
  const keep = st.stay.get(D); return !!keep && aim(st, g.fight, D)?.T === keep && staysHome(g.fight, st, D);
}
/** digin.ts asks this before a man starts on his room: true = he is in a press or on his beat toward one (the press has him first; the man LEFT to keep a room
 *  is not wanted — digin.ts asks `pressKeeps` about him) */
export function pressWants(g: Game, def: unknown): boolean {
  if (!PRESSURE.on || !PRESSURE.press) return false;
  const st = STATES.get(g), D = def as Def; if (!st) return false;
  if (readyMan(st, D, g.time)) return true;   // (stood to: the reaction force keeps its hands off the furniture)
  const m = st.of.get(D); return st.think.has(D) || (!!m && !m.fell);   // (a man of a press that has FAILED and fallen back is nobody's errand: where he has planted is his room now)
}
/** digin.ts asks this too (DIGIN.keeper off): true = a press has LEFT him to keep his room (`keepRoom`) — one of the men who, at standard, would have come.
 *  It holds from that moment until the press takes him itself (his mates are down) or the fight is reset, whether or not the fight he was held out of is
 *  still on: a man kept back from a fight does not turn to his furniture once it has moved on */
export function pressKeeps(g: Game, def: unknown): boolean {
  if (!PRESSURE.on || !PRESSURE.press) return false;
  const st = STATES.get(g), D = def as Def; if (!st?.stay.has(D)) return false;
  return !PRESSURE.keeperLeft || (!!D.room && st.sent.has(D.room));
}
/** the man who was left to keep his room still has it to keep: a mate of that room is up (out on the press or back) — alone for good, he is a lone garrison */
function staysHome(F: RoomFight, st: State, D: Def): boolean {
  for (const X of F.defs) if (X !== D && alive(X) && !PICKETS.has(X.gd) && (X.room === D.room || st.of.get(X)?.from === D.room)) return true;   // (a picket standing in it is not of it)
  return false;
}
/** a spot outside entry `e` of room T, off the door's line (the stock fall-back's table: roomfight.ts breakOff), that `D` can walk to WITHOUT crossing T */
function gatherSpot(g: Game, F: RoomFight, st: State, D: Def, T: Room, e: Entry): { spot: Vec3; L: number } | null {
  const nav = g.col.nav, c = D.gd.char; const fr = frameOf(e.door);
  const dear = (ix: number, iz: number) => T.cells.has(nav.idx(ix, iz)) ? 40 : 1;
  if (wayOut(g)) return standOffSpot(g, F, st, D, T, e, dear);   // (no floor that far back with a line to the door: not his door — never the stock spots, which are inside the flash)
  for (const [depth, lat] of [[3.0, 1.6], [3.0, -1.6], [2.4, 1.2], [2.4, -1.2], [1.2, 2.4], [1.2, -2.4], [1.2, 1.7], [1.2, -1.7], [2.6, 0]]) {
    const p: Vec3 = [e.at[0] + e.out[0] * depth + fr.ux * lat * (1 + fr.W / 3.2), 0, e.at[2] + e.out[1] * depth + fr.uz * lat * (1 + fr.W / 3.2)];
    if (nav.isBlocked(p[0], p[2]) || T.cells.has(cellOf(g, p))) continue;
    if (F.defs.some(X => X !== D && alive(X) && flat(X.gd.char.pos, p) < 0.9)) continue;
    let taken = false; for (const m of st.of.values()) if (m.D !== D && flat(m.spot, p) < 0.9) { taken = true; break; }
    if (taken) continue;
    const path = nav.findPath(c.pos, p, 6000, dear); if (!path?.length) continue;
    let L = 0, q: Vec3 = c.pos, through = false; for (const w of path) { L += flat(q, w); q = w; if (T.cells.has(cellOf(g, w))) through = true; }
    if (through || flat(q, p) > 0.8) continue;
    return { spot: p, L };
  }
  return null;
}

/** PRESSURE.wayOut: a spot to hold entry `e` of T from that a can through that door does not reach — `wayOutM` past the stun charge's radius (effects.ts
 *  bang.dazzleRadius) from where a can thrown out through the door goes off (DOORTOOLS.airIn outside the frame), on the far side of the door's wall and not
 *  along it, with a line for a round to a man stepping out, room for his shoulders, nobody standing there. Asked first for a spot the place's own light does
 *  not reach, well clear of his mates and their lines to the door; then, on a floor too small for that, for any spot a body's width clear of them. The
 *  nearest on foot of the first few that pass, by a way that does not cross T */
function standOffSpot(g: Game, F: RoomFight, st: State, D: Def, T: Room, e: Entry, dear: (ix: number, iz: number) => number): { spot: Vec3; L: number } | null {
  const nav = g.col.nav, c = D.gd.char, cs = nav.cell, m0 = bang.dazzleRadius + PRESSURE.wayOutM, m1 = m0 + STAND_OFF_BAND;
  const burst: Vec3 = [e.at[0] + e.out[0] * DOORTOOLS.airIn, 0, e.at[2] + e.out[1] * DOORTOOLS.airIn], mouth: Vec3 = [e.at[0] + e.out[0] * 0.7, 1.2, e.at[2] + e.out[1] * 0.7];
  const taken: Vec3[] = []; for (const m of st.of.values()) if (m.D !== D && alive(m.D)) taken.push(m.spot);
  const offLine = (p: Vec3, a: Vec3) => {   // p's distance from the line a → mouth, where it stands beside that line
    const dx = mouth[0] - a[0], dz = mouth[2] - a[2], L2 = dx * dx + dz * dz || 1, t = ((p[0] - a[0]) * dx + (p[2] - a[2]) * dz) / L2;
    return t <= 0 || t >= 1 ? Infinity : Math.hypot(p[0] - (a[0] + dx * t), p[2] - (a[2] + dz * t));
  };
  const cand: { p: Vec3; d: number; ok?: boolean; lit?: boolean; way?: { L: number } | null }[] = [];   // (the cheap tests on the band, every other cell each way; lines, light and ways only on the nearest, once each)
  const x0 = Math.floor((burst[0] - m1) / cs), x1 = Math.floor((burst[0] + m1) / cs), z0 = Math.floor((burst[2] - m1) / cs), z1 = Math.floor((burst[2] + m1) / cs);
  for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
    if ((ix | iz) & 1) continue;
    const p: Vec3 = [(ix + 0.5) * cs, 0, (iz + 0.5) * cs], d = flat(p, burst);
    if (d < m0 || d > m1 || (p[0] - e.at[0]) * e.out[0] + (p[2] - e.at[2]) * e.out[1] < Math.max(1.2, 0.2 * d)) continue;   // (the door's own side of its wall, and not along the wall: a graze sees the frame, not the man in it)
    if (nav.isBlocked(p[0], p[2]) || T.cells.has(nav.idx(ix, iz))) continue;
    if (nav.isBlocked(p[0] + cs, p[2]) || nav.isBlocked(p[0] - cs, p[2]) || nav.isBlocked(p[0], p[2] + cs) || nav.isBlocked(p[0], p[2] - cs)) continue;   // (room for his shoulders)
    if (F.defs.some(X => X !== D && alive(X) && flat(X.gd.char.pos, p) < 0.9)) continue;
    cand.push({ p, d: flat(p, c.pos) });
  }
  cand.sort((a, b) => a.d - b.d);
  const lit = (q: Vec3) => g.visibilityOf(lightEstimateAt(g, [q[0], 1.2, q[2]], () => true, true)) >= LIGHTS.litAt;   // (the place's own steady light, nothing anybody carries)
  const wayTo = (q: Vec3): { L: number } | null => {
    const path = nav.findPath(c.pos, q, 6000, dear); if (!path?.length) return null;
    let L = 0, w0: Vec3 = c.pos; for (const w of path) { L += flat(w0, w); w0 = w; if (T.cells.has(cellOf(g, w))) return null; }
    return flat(w0, q) > 0.8 ? null : { L };
  };
  // dark and well clear of his mates and their lines · any light, a body's width clear · a floor too small for lanes: behind a mate, his turn when that one is down
  for (const [apart, lane, dark] of [[1.4, 0.8, true], [1.0, 0.45, false], [1.0, 0, false]] as const) {
    let best: { spot: Vec3; L: number } | null = null, tries = 0;
    for (const k of cand) {
      if (tries >= STAND_OFF_TRIES || (best && k.d >= best.L)) break;
      if (k.ok === false || k.way === null || taken.some(q => flat(q, k.p) < apart || offLine(k.p, q) < lane || offLine(q, k.p) < lane)) continue;
      if (k.ok === undefined) k.ok = !g.col.shotBlocked([k.p[0], 1.35, k.p[2]], mouth, 0.02, sideShotEnergy(g, D.gd.team));
      if (!k.ok || (dark && (k.lit ??= lit(k.p)))) continue;
      if (k.way === undefined) { tries++; k.way = wayTo(k.p); }
      if (k.way && (!best || k.way.L < best.L)) best = { spot: k.p, L: k.way.L };
    }
    if (best) return best;
  }
  return null;
}

export function run(g: Game, D: Def, spot: Vec3, door: Door | null, fast = 0) {
  const gd = D.gd;
  D.mode = 'move'; D.moveKind = 'fallback'; D.cameBy = door; D.moveT = 0; D.stallAt = v3.copy(gd.char.pos); D.stallT = 0; D.rallyAt = NaN; gd.pinned = false;
  order(gd, { goal: v3.copy(spot), speed: g.tune.guardChase + fast, face: null, strafe: false, aimAt: null, upper: 'aim', stance: 'none', crouch: false });
}
/** PRESSURE.stuns: a man with a charge on him, let go at the fight: the door he was put down for is taken as the drill, charge first (tactics.ts's doorway).
 *  `T` = the room the fight is in when the caller has it (the press's own); the room fight's seam with the press off names a door only, and the test is then
 *  asked of the rooms that door gives on to, his own aside. PRESSURE.stunKnown: no door is marked on a fight at a mate's post alone — their side must have
 *  something that puts the team IN that room (`teamPlaced`). The press's own men ask again at the door (tickPress); the seam's men are asked the once. */
export function charge(g: Game, D: Def, door: Door, T?: Room | null): boolean {
  if (!(PRESSURE.stuns > 0 && stunsOf(D.gd) > 0)) return false;
  const F = g.fight, st = stateOf(g);
  let R: Room | null = T ?? null;
  if (PRESSURE.stunKnown) {
    const cand = T ? [T] : roomsBy(F, D, door);
    R = cand.find(X => teamPlaced(g, F, st, X).known) ?? null;
    if (!R) { st.stats.stunHeld++; if (cand.some(X => teamStands(g, F, X))) st.stats.stunHeldIn++; note(g, F, D.gd, `no charge at ${door.def.name}: nothing puts them in that room`); return false; }
  }
  const prev = dangerAt(g, door, D.gd.team), had = st.marks.get(door);
  markDanger(g, door, D.gd.team, 'press'); st.stats.stunMarked++;
  st.marks.set(door, { R, team: D.gd.team, own: had ? had.own : !prev || prev.why === 'press' });   // (own: a doorway their side already held dangerous for its own reason — a man down in it, rounds through it — is never ours to call off)
  return true;
}
/** the rooms a door gives on to, the one he stands in and the one he holds aside */
function roomsBy(F: RoomFight, D: Def, door: Door): Room[] {
  const fr = frameOf(door), c = door.frameCentre, mine = F.roomAt(D.gd.char.pos), out: Room[] = [];
  for (const k of [1, -1]) { const R = F.roomAt([c[0] + fr.nx * k, 0, c[2] + fr.nz * k]); if (R && R !== mine && R !== D.room && !out.includes(R)) out.push(R); }
  return out;
}
/** p is in room T or in one of its doorways (a doorway's cells are no room's) */
const inRoom = (g: Game, T: Room, p: Vec3) => T.cells.has(cellOf(g, p)) || T.entries.some(e => flat(e.door.frameCentre, p) < 1.2);
/** a man of the team stands in R — the floor's truth, for the counts only: no defender is given it */
const teamStands = (g: Game, F: RoomFight, R: Room) => F.ops.some(O => O.gd.state !== 'dead' && inRoom(g, R, O.gd.char.pos)) || inRoom(g, R, g.player.char.pos);
/** the last of his side alive (PRESSURE.lastHolds): there are no others to have been hit, and nobody on their net to go with */
const lastAlone = (F: RoomFight, D: Def) => PRESSURE.lastHolds && !F.defs.some(X => X !== D && alive(X));
/** PRESSURE.stunKnown — WHAT THEIR SIDE HAS TO GO ON THAT THE TEAM IS IN ROOM T: the newest thing inside stunKnowSecs that put the team IN it and the newest
 *  that put them anywhere else. Sounds are `learn`'s (the team's own gunfire and boots through doors, placed where they were made). Eyes are asked of the
 *  living who have NOTICED (roused, not in Sam's arm — a calm man's half glimpse is nothing he has said on their net, and a dead man's went with him): where
 *  each last had one of them in his sight, and when. `known` = in it, with nothing newer by stunMovedSecs elsewhere; `moved` = the newest word is elsewhere. */
function teamPlaced(g: Game, F: RoomFight, st: State, T: Room): { known: boolean; moved: boolean } {
  let inT = -Infinity, other = -Infinity;
  const put = (t: number, p: Vec3) => { if (g.time - t > PRESSURE.stunKnowSecs) return; if (inRoom(g, T, p)) inT = Math.max(inT, t); else other = Math.max(other, t); };
  for (const h of st.heard) put(h.t, h.p);
  for (const X of F.defs) { const m = X.gd; if (alive(X) && !m.held && (m.state === 'alert' || m.state === 'search')) put(m.sightT, m.sightPos); }
  const moved = other > inT + PRESSURE.stunMovedSecs;
  return { known: inT > -Infinity && !moved, moved };
}
/** one more thing heard of the team at p (a spot heard from again is the one entry, its time moved on) */
function heardAt(st: State, t: number, p: Vec3) {
  const h = st.heard.find(x => flat(x.p, p) < 2); if (h) { h.t = Math.max(h.t, t); h.p = v3.copy(p); } else st.heard.push({ t, p: v3.copy(p) });
}
/** once a frame while anybody carries a charge. PRESSURE.stunKnown: the team's own loud doings read off the floor's events and kept where they were made
 *  (gunfire the whole floor hears — roomfight.ts's own line: a row of level 1 and up, so not a suppressed pistol — and a door they boot, kept at that door);
 *  then the doors `charge` marked: one whose room the team is now known to have left is let be, unless the charge is already thrown or their side holds that
 *  doorway dangerous for a reason of its own. Last the counts, off EVERY doorway their side holds dangerous, whoever marked it: a charge gone off, and
 *  whether a man of the team was there to take it (the floor's truth — nothing a defender is given). */
function learn(g: Game, F: RoomFight, st: State) {
  if (PRESSURE.stunKnown) {
    const pid = g.player.char.id, now = g.time;
    for (const e of g.events) {
      if ((e.kind !== 'shot' && e.kind !== 'guardShot' && e.kind !== 'kick') || e.who === undefined || st.evSeen.has(e)) continue;
      st.evSeen.add(e);
      if (e.kind !== 'kick' && (e.level ?? 0) < 1) continue;
      if (e.who !== pid && !F.ops.some(O => O.gd.char.id === e.who)) continue;
      let p = e.pos;
      if (e.kind === 'kick') { let bd = 2.5; for (const d of g.doors.list) { const q = flat(d.frameCentre, e.pos); if (q < bd) { bd = q; p = d.frameCentre; } } }
      heardAt(st, e.time, p);
    }
    if (st.heard.length > 24 || st.heard.length && now - st.heard[0].t > PRESSURE.stunKnowSecs) st.heard = st.heard.filter(h => now - h.t <= PRESSURE.stunKnowSecs).slice(-24);
    for (const [door, k] of st.marks) {
      const r = dangerAt(g, door, k.team);
      if (!r) { st.marks.delete(door); continue; }
      if (r.why !== 'press') k.own = false;
      if (!k.own || !k.R || r.banged || r.entered || !teamPlaced(g, F, st, k.R).moved) continue;
      r.until = Math.min(r.until, now); st.marks.delete(door); st.stats.stunOff++;   // their newest word puts the team somewhere else: nobody bangs an empty room on an old one
      for (const m of st.of.values()) if (m.door === door && m.charged) m.charged = false;
      const by = F.defs.find(alive); if (by) note(g, F, by.gd, `the charge at ${door.def.name} is off: the team is known to be somewhere else`);
    }
  } else for (const [door, k] of st.marks) if (!dangerAt(g, door, k.team)) st.marks.delete(door);
  for (const r of dangerDoors(g)) {
    if (st.bangs.get(r) === r.banged || !F.defs.some(X => X.gd.team === r.team)) continue;
    st.bangs.set(r, r.banged); if (!r.banged) continue;
    const R = st.marks.get(r.door)?.R ?? null, c = r.door.frameCentre, by = (p: Vec3) => R ? inRoom(g, R, p) : flat(p, c) < 6;
    st.stats.stunBangs++; if (!F.ops.some(O => O.gd.state !== 'dead' && by(O.gd.char.pos)) && !by(g.player.char.pos)) st.stats.stunEmpty++;
  }
}
/** handed to the fight AI as the stock rally hands a man over: off his post, roused, the fight's place his fix — he works a doorway a slice at a time by himself */
export function loose(g: Game, D: Def, at: Vec3) {
  const gd = D.gd;
  if (gd.script) endGuardScript(gd, 'alert');
  D.mode = 'free'; D.freeAt = g.time; D.rallyAt = NaN; gd.hold = false; gd.pinned = false;
  gd.state = 'alert'; gd.awareness = Math.max(gd.awareness, 0.92); if (g.time - gd.lastSeenT > 1) gd.lastKnown = v3.copy(at); gd.path = []; gd.pathGoal = null;
}
/** a man on a scripted leg files his own boots (the fight AI's men do it in guards.ts; a script's tread is sound only), so the team's ears get them */
export function boots(g: Game, gd: Guard, last: number): number {
  if (gd.speed < 0.4 || g.time - last < (gd.speed > 2 ? 0.33 : 0.5)) return last;
  g.events.push({ kind: 'step', pos: v3.copy(gd.char.pos), time: g.time, loud: false, level: gd.speed > 2 ? 0.8 : 0.4, who: gd.char.id });
  return g.time;
}
/** a teammate's boots in his ears, and where they come to him from: the sound model's own answer, by the rule every man's ears use on an enemy's step */
function teamBoots(g: Game, F: RoomFight, gd: Guard): Vec3 | null {
  const ear = v3.add(gd.char.pos, [0, 1.5, 0]); let best: Vec3 | null = null, bl = 0.12;
  for (const O of F.ops) {
    const o = O.gd; if (o.state === 'dead' || o.speed < 0.5 || v3.dist(o.char.pos, gd.char.pos) > 9) continue;
    const pr = hearPath(g, v3.add(o.char.pos, [0, 1, 0]), ear);
    const l = teamTread(g, o, o.speed, 0.4) * clamp(1 - pr.pathLen / 9, 0, 1) * pr.carry;   // (guards.ts hearingCheck's own line for a step)
    if (l > bl) { bl = l; best = pr.via; }   // where it comes to him FROM: the doorway it spills through, the man himself only with nothing between
  }
  return best;
}
const hearsTeam = (g: Game, F: RoomFight, gd: Guard) => !!teamBoots(g, F, gd);
/** planted outside a door: that door is what he watches */
function watchDoor(D: Def, door: Door) {
  const i = D.room ? D.room.entries.findIndex(e => e.door === door) : -1; if (i < 0 || !D.room) return;
  D.ev[i] = Math.max(D.ev[i], 1.5); D.watch = D.want = i; D.home = v3.copy(D.room.entries[i].at); D.pt[0] = D.home[0]; D.pt[1] = 0; D.pt[2] = D.home[2];
}

const toldOf = (g: Game, st: State, D: Def) => { const t = st.told.get(D); return t && g.time - t.t < PRESSURE.memorySecs ? t : undefined; };
/** PRESSURE.byWay: his room and the room being fought over share a door (a man posted on open floor is next door to nothing) */
const nextDoor = (R: Room | null, T: Room) => !!R && R.entries.some(e => T.entries.some(x => x.door === e.door));

/** a holding man with a fight at a mate's post in his ears: after his own beat he joins the press on that room (or starts it) */
function consider(g: Game, F: RoomFight, st: State, D: Def) {
  const gd = D.gd;
  // (rallyAt Infinity = somebody pinned him to his room — the rescue's men with the hostages: not ours either)
  const ok0 = D.mode === 'hold' && !st.of.has(D) && (D.noiseOut || !!picketHears(F, D)) && !gd.held && D.rallyAt !== Infinity && g.time >= gd.dazzledUntil && g.time >= gd.staggerUntil
    && g.time - D.noiseT < PRESSURE.memorySecs && g.time - gd.lastSeenT > 3
    && g.time - (st.doneAt.get(D) ?? -100) > PRESSURE.againSecs && !st.outs.some(o => o.def === D)
    && !lastStandMan(g, gd)                // (laststand.ts, default off: a man of the last stand is not the press's)
    && !laneHolds(g, gd, D.noiseAt)        // (lanes.ts: held short of a covered lane, and this fight is at its guns — he keeps its mouth)
    && !squadOwns(g, gd)                   // (enemysquads.ts: on a squads level who leaves his room for a fight elsewhere is his squad's call)
    && !(DIGIN.on && digInStays(g, gd));   // (digin.ts's reach rule: the fight is too far for him to join in time — his room is his job, and he digs in)
  // PRESSURE.lastHolds: the last of them alive has no others to go to, and nobody on the net to call — he keeps his room (counted once, the first time he would have gone)
  const ok = ok0 && !lastAlone(F, D);
  if (lastAlone(F, D)) st.stay.delete(D);   // (and no press's keeper either: his room is his own again, digin.ts's to brace)
  if (ok0 && !ok && !st.lastHeld.has(D) && aim(st, F, D)) { st.lastHeld.add(D); st.stats.lastHeld++; note(g, F, gd, 'the last of them alive: keeps his room, nobody to go to'); }
  const told = toldOf(g, st, D);   // (PRESSURE.byWay: a fight not next door that he placed, or was told of by a man of his room — it stays placed for `memorySecs`)
  const heard = ok ? aim(st, F, D) : null;
  if (heard && told && heard.T !== told.T && nextDoor(D.room, heard.T)) st.told.delete(D);   // (a newer fight he places himself, next door: that is his now — a far one takes the old one's place below)
  const tg = heard ?? (ok && !reportStands(st, D) && told && st.told.has(D) ?   // (stood to: a report is nobody's room being hit, told of or not)
    { T: told.T, at: told.at } : null);
  if (tg && st.stay.get(D) === tg.T && !staysHome(F, st, D)) st.stay.delete(D);
  if (!tg || st.stay.get(D) === tg.T) { st.think.delete(D); return; }
  const mates = PICKETS.has(gd) ? [] : F.defs.filter(X => X !== D && alive(X) && X.room === D.room && X.mode === 'hold' && !st.of.has(X) && !PICKETS.has(X.gd));   // (a picket stands in somebody else's room, or in none: he keeps nobody's, and nobody stays for his)
  const th = st.think.get(D);
  if (!th || th.room !== tg.T) {
    st.think.set(D, { room: tg.T, at: g.time + pick(FIGHT_SKILL.hostile.rally) * PRESSURE.organiseK });
    // PRESSURE.byWay, a fight that is not next door: he says what he has placed, and the men of his room who heard it and could not place it know it from him —
    // each on his own beat from here (the pair then leaves on the slower man's, below)
    if (PRESSURE.byWay && heard && told?.T !== heard.T && !PICKETS.has(gd) && D.room && !nextDoor(D.room, tg.T)) {
      st.told.set(D, { T: tg.T, at: v3.copy(tg.at), t: g.time });   // (and he does not lose the place himself when the next shot comes to him by another doorway)
      let n = 0;
      for (const X of F.defs) if (X !== D && alive(X) && X.room === D.room && X.mode === 'hold' && !st.of.has(X) && !st.think.has(X) && toldOf(g, st, X)?.T !== tg.T && !PICKETS.has(X.gd) && X.noiseOut && g.time - X.noiseT < 1.5) { st.told.set(X, { T: tg.T, at: v3.copy(tg.at), t: g.time }); n++; }
      if (n) { st.stats.pairsTold++; g.say(gd, w('they\'ve hit the others — get ready, we go together!', 'that\'s the others they\'ve hit — get ready, we go together!'), false); note(g, F, gd, `by way: tells ${n} of his room where the fight is`); }
    }
    return;
  }
  if (g.time < th.at) return;
  // PRESSURE.byWay: a fight that is not next door — the men of one room go together, on the slower man's beat, and nobody is kept
  const others = PRESSURE.byWay && !PICKETS.has(gd) ? F.defs.filter(X => X !== D && alive(X) && X.room === D.room && X.mode !== 'free' && !st.of.has(X) && !PICKETS.has(X.gd) && !X.gd.held && X.rallyAt !== Infinity) : [];
  const farRoom = PRESSURE.byWay && !PICKETS.has(gd) && !!D.room && !nextDoor(D.room, tg.T), far = farRoom && others.length > 0;
  if (far) {
    let wait = false;
    for (const X of others) {
      const tx = st.think.get(X);
      // a mate on his beat toward the same fight — or told of it and free to come (his own beat starts the frame he hears of it)
      if (tx ? tx.room === tg.T && tx.at > g.time : toldOf(g, st, X)?.T === tg.T && X.mode === 'hold' && g.time >= X.gd.dazzledUntil && g.time >= X.gd.staggerUntil && g.time - X.gd.lastSeenT > 3 && g.time - (st.doneAt.get(X) ?? -100) > PRESSURE.againSecs) wait = true;
    }
    if (wait && g.time - (th.held ?? g.time) < PAIR_WAIT_SECS * Math.max(1, PRESSURE.organiseK)) {
      if (th.held === undefined) { th.held = g.time; st.stats.pairsWaited++; note(g, F, gd, `by way: room ${tg.T.id} is not next door, waits for his mate`); }
      return;
    }
    st.stats.pairsWent++;
  }
  st.think.delete(D);
  // somebody keeps the room: of several holding it, the one farthest from the fight stays at home
  if (!far && PRESSURE.keepRoom && !stoodTo(st) && mates.length && ![D, ...mates].some(X => st.stay.get(X) === tg.T)) {
    let keeper = D, fd = flat(D.station, tg.at); for (const X of mates) { const d = flat(X.station, tg.at); if (d > fd) { fd = d; keeper = X; } }
    st.stay.set(keeper, tg.T); if (keeper === D) { note(g, F, gd, 'stays to keep his room'); return; }
  }
  // (the way out: a hold the team has already come out into is not joined — a man walking to it now walks into them alone — and no second one is formed)
  if (wayOut(g) && st.presses.some(p => p.room === tg.T && p.sprung)) { st.doneAt.set(D, g.time); return; }
  let P = st.presses.find(p => p.room === tg.T && (forms(g) ? p.phase === 'gather' : g.time - p.t0 < 25));
  const up = P ? P.men.filter(m => !m.out && alive(m.D)) : [];
  // (PRESSURE.byWay: a far room that goes together is not cut in two by the count — the second man of it goes where the first went)
  if (!stoodTo(st) && up.length >= PRESSURE.maxMen && !(farRoom && (others.length > 0 || up.some(m => m.from === D.room)))) { st.doneAt.set(D, g.time); return; }   // (stood to: all hands)
  const held = wayOut(g) && up.length ? up[0].door : null;   // (the way out: one door, the first man's — every gun on it, the other left alone)
  const ways = tg.T.entries.filter(e => !e.door.def.steel && (!held || e.door === held)).map(e => ({ e, w: gatherSpot(g, F, st, D, tg.T, e) })).filter(x => x.w) as { e: Entry; w: { spot: Vec3; L: number } }[];
  if (!ways.length) {   // no spot outside any door of it that he can reach: forming up is off; going at it is not
    if (forms(g)) { st.doneAt.set(D, g.time); note(g, F, gd, 'no way to a door of that room'); return; }
    ways.push({ e: tg.T.entries[0], w: { spot: v3.copy(gd.char.pos), L: 0 } });
  }
  ways.sort((a, b) => a.w.L - b.w.L);
  let way = ways[0], role: Man['role'] = 'press';
  // PRESSURE.byWay: the room goes by ONE door — the second man of a far room takes the door and the role the first took, so the pair lands as a pair and the
  // other door is left for whoever goes round (two men of one room each put down for a door of their own left the man next door nothing to flank by)
  const lead = farRoom ? up.find(m => m.from === D.room) : undefined;
  if (lead) { way = ways.find(x => x.e.door === lead.door) ?? way; role = lead.role; }
  else if (PRESSURE.flank && up.length && !wayOut(g)) {   // (the way out: nobody goes round — every gun on the door they will come out of)
    const takenDoors = new Set(up.map(m => m.door));
    if (takenDoors.has(way.e.door)) {
      const round = ways.find(x => !takenDoors.has(x.e.door) && x.w.L <= Math.min(PRESSURE.flankMaxM, Math.max(PRESSURE.flankK * ways[0].w.L, ways[0].w.L + PRESSURE.flankSlackM)));
      if (round) { way = round; role = 'flank'; }
    }
  }
  if (!P) { P = { id: ++st.serial, room: tg.T, at: v3.copy(tg.at), t0: g.time, phase: forms(g) ? 'gather' : 'go', teamIn: false, setAt: -1, listenAt: 0, moving: false, wordAt: 0, goAt: g.time, n0: 0, lone: false, men: [] }; st.presses.push(P); st.stats.pressFormed++; }
  else if (P.phase === 'gather' && (!up.length || P.lone)) { P.t0 = g.time; P.setAt = -1; P.moving = false; if (P.loneAt !== undefined) P.loneAt = g.time; }   // a press that had come down to one man holding a door: the clock starts again for the two of them
  const m: Man = { D, role, door: way.e.door, spot: way.w.spot, from: D.room, moving: true, set: false, setAt: 0, tries: 0, stepT: -100, small0: 0, cueT: g.time, freeAt: 0, landT: -1, arrived: false, heard: false, fell: false, replantT: -1, fought: false, out: false };
  P.men.push(m); st.of.set(D, m); st.called.set(D, { T: tg.T, t: g.time }); if (D.room) st.sent.add(D.room); if (PICKETS.has(gd)) PICKET_WENT.add(gd);
  if (P.phase === 'go') {   // no forming up: a presser goes at the fight now, a flanker runs round to his door first
    P.n0++; m.freeAt = g.time;
    if (role === 'press') { m.moving = false; m.set = true; m.charged = charge(g, D, m.door, P.room); loose(g, D, P.at); } else run(g, D, m.spot, m.door);
  } else run(g, D, m.spot, m.door);
  if (role === 'flank') { st.stats.flankSent++; g.say(gd, w('going around — keep them there!', 'going round — keep them there!'), true); }
  else { st.stats.pressMen++; g.say(gd, forms(g) ? (up.length ? 'with you — on the door!' : 'they\'ve hit the others — on that door!') : (up.length ? 'with you — moving!' : 'they\'ve hit the others — get in there!'), true); }
  note(g, F, gd, `press ${P.id} on room ${tg.T.id}: ${role} to ${m.door.def.name} (${way.w.L.toFixed(1)} m)`);
}

function drop(st: State, g: Game, m: Man) { m.out = true; if (st.of.get(m.D) === m) st.of.delete(m.D); st.doneAt.set(m.D, g.time); }

function tickPress(g: Game, F: RoomFight, st: State, P: Press): boolean {
  const teamIn = F.ops.some(O => O.gd.state !== 'dead' && P.room.cells.has(cellOf(g, O.gd.char.pos))); if (teamIn) P.teamIn = true;
  for (const m of P.men) {
    if (m.out) continue;
    const D = m.D, gd = D.gd;
    if (!alive(D) || !F.defs.includes(D)) { drop(st, g, m); continue; }
    if (!m.arrived && (flat(gd.char.pos, m.door.frameCentre) < 2.5 || P.room.cells.has(cellOf(g, gd.char.pos)))) {   // (a count only: he is at the room — and LATE when the team has been in it and gone)
      m.arrived = true; const late = P.teamIn && !teamIn, S = st.stats;
      if (m.role === 'flank') { S.flankArrived++; if (late) S.flankLate++; } else { S.pressArrived++; if (late) S.pressLate++; }
      if (late) note(g, F, gd, `press ${P.id}: at ${m.door.def.name}, the team has moved on`);
    }
    if (m.landT < 0 && !m.fell) {   // the man himself arrives: he has eyes on the enemy, or the enemy on him
      if (!m.heard && F.ops.some(O => O.stepBy?.by === gd && O.stepBy.t > m.cueT)) m.heard = true;
      if (g.time - gd.lastSeenT < 0.1 || F.teamSees(gd)) {
        m.landT = g.time; const lead = g.time - m.cueT, first = lead >= CUE_FIRST_SECS, S = st.stats;
        if (m.role === 'flank') { S.flankLanded++; S.flankLead += lead; if (first) S.flankCueFirst++; if (m.heard) S.flankHeard++; }
        else { S.pressLanded++; S.pressLead += lead; if (first) S.pressCueFirst++; if (m.heard) S.pressHeard++; }
        note(g, F, gd, `press ${P.id}: lands ${lead.toFixed(1)} s after his shout${m.heard ? ', boots heard' : ''}`);
      }
    }
    if (D.mode === 'move') { if (!m.moving) { drop(st, g, m); continue; } m.stepT = boots(g, gd, m.stepT); continue; }   // (not moving = the stock fall-back took him: he is its man now)
    if (P.phase !== 'go') {
      if (D.mode === 'free') { drop(st, g, m); continue; }
      if (m.moving) {   // he has planted (roomfight.ts tickMove): there, in contact on the way, or stopped short
        m.moving = false;
        const contact = g.time - gd.lastSeenT < 2;
        if (contact || flat(gd.char.pos, m.spot) < 1.5 || ++m.tries >= 3) {
          m.set = true; m.setAt = g.time; m.small0 = gd.witness.heard.small; if (!contact) watchDoor(D, m.door);
          if (m.role === 'flank') { st.stats.flankSet++; if (!contact) g.say(gd, 'in position!', true); }
          note(g, F, gd, `press ${P.id}: set at ${m.door.def.name}${contact ? ' (in contact)' : ''}`);
        } else { m.moving = true; run(g, D, m.spot, m.door); }
      }
      continue;
    }
    // ---- let go at the fight
    if (m.fell) {
      if (m.moving && D.mode === 'hold') { m.moving = false; m.replantT = g.time; watchDoor(D, m.door); st.stats.fbPlanted++; note(g, F, gd, `press ${P.id}: back outside ${m.door.def.name}`); }
      if (m.replantT >= 0 && !m.fought && gd.lastSeenT > m.replantT + 0.2) { m.fought = true; st.stats.fbFought++; }
      continue;
    }
    if (m.moving) {   // a flanker off his leg: round at his door, or met on the way (roomfight.ts tickMove planted him) — or stopped short, and he sets off again
      const contact = g.time - gd.lastSeenT < 0.5, fc = gd.foe === 'player' ? g.player.char : gd.foe ? gd.foe.char : null;
      if (!contact && flat(gd.char.pos, m.spot) > 1.5 && ++m.tries < 3) { run(g, D, m.spot, m.door); continue; }
      const there = flat(gd.char.pos, m.spot) <= 1.5;
      m.moving = false; m.set = true; m.setAt = g.time;
      if (m.role === 'flank' && there && !contact) { st.stats.flankSet++; g.say(gd, 'in position — on them!', true); }
      if (there && !contact) m.charged = charge(g, D, m.door, P.room);
      loose(g, D, contact && fc ? fc.pos : P.at);   // (met on the way: the mover's own whole beat, roomfight.ts tickMove's — nothing here shortens it)
      note(g, F, gd, `press ${P.id}: ${there ? `round at ${m.door.def.name}` : 'let go short of his door'}${contact ? ', in contact' : ''}`);
    }
    // PRESSURE.stunKnown: asked for the charge and turned down (nothing said the team was in there) — he listens at the door as he comes to it, and the moment
    // his side has them in that room (his ears, a mate's eyes, their own gunfire) the door is the drill, charge first. Only a man who was turned down asks
    // again (charged === false: one never asked — let go already in contact, or short — is not); the room fight's own seam with the press off has no such second ask
    if (PRESSURE.stunKnown && PRESSURE.stuns > 0 && m.charged === false && m.set && !m.moving && g.time - P.goAt < 30 && stunsOf(gd) > 0 && g.time - gd.lastSeenT > 0.5 && !P.room.cells.has(cellOf(g, gd.char.pos))) {
      if (flat(gd.char.pos, m.door.frameCentre) < 5 && g.time - (m.earT ?? -1) > 0.3) {
        m.earT = g.time; const via = teamBoots(g, F, gd);
        if (via && (inRoom(g, P.room, via) || flat(via, m.door.frameCentre) < 1.5)) heardAt(st, g.time, inRoom(g, P.room, via) ? via : m.door.frameCentre);
      }
      if (teamPlaced(g, F, st, P.room).known && (m.charged = charge(g, D, m.door, P.room))) { st.stats.stunLate++; note(g, F, gd, `press ${P.id}: they are in there — ${m.door.def.name} charge first after all`); }
    }
    if (PRESSURE.fallBack && g.time - m.freeAt > 0.5 && g.time >= gd.dazzledUntil && g.time - P.goAt < 30) {
      // the push has failed for him when enough of it lies where he can see it and the enemy is on him: back out to the door he came by
      const eye = eyeOf(gd); let dead = 0, up = 0;
      for (const x of P.men) {
        if (x === m) continue;
        if (alive(x.D)) { if (!x.fell && !x.out) up++; continue; }
        const b = x.D.gd.char.bones.hips ?? x.D.gd.char.pos;
        if (flat(b, gd.char.pos) < 6 && !g.col.segmentBlocked(eye, [b[0], 0.3, b[2]])) dead++; else up++;   // (a man down where he cannot see him is, to him, a man still up)
      }
      const pressed = g.time - gd.lastSeenT < 4 || g.time - gd.witness.heard.lastShotT < 2.5;
      if (dead > 0 && pressed && (up === 0 || dead / P.n0 >= D.nerve) && g.time - (m.askT ?? -1) > 0.5) {
        m.askT = g.time;   // (with no way back at all he asks again in half a second, not every frame)
        const to = hooked(g, D, 'push', g.time - gd.lastSeenT < 4 ? gd.sightPos : P.at);
        if (to || g.col.nav.findPath(gd.char.pos, m.spot)?.length) {
          m.fell = true; m.moving = true; gd.hold = true; gd.path = []; gd.pathGoal = null;
          if (to) { m.spot = v3.copy(to.spot); if (to.door) m.door = to.door; run(g, D, to.spot, to.door, 0.3); } else run(g, D, m.spot, m.door, 0.3);
          st.stats.fbPush++; g.say(gd, 'back — get back! hold the door!', true); note(g, F, gd, `press ${P.id}: the push has failed, back to ${m.door.def.name}`);
        }
      }
    }
  }
  const up = P.men.filter(m => !m.out);
  if (P.phase === 'gather') {
    if (!P.sprung && wayOut(g) && P.men.some(m => !alive(m.D) || g.time - m.D.gd.lastSeenT < 1)) P.sprung = true;   // (the team has come out into the hold: consider() sends nobody else to it)
    if (!up.length) return g.time - P.t0 > PRESSURE.memorySecs;
    // the word: everybody set and a breath taken — or nobody still on his way has any of his own time left (a man going round has `flankSecs` more of it)
    const waited = g.time - P.t0, allSet = up.every(m => m.set), due = up.every(m => m.set || g.time - m.cueT > PRESSURE.gatherSecs + (m.role === 'flank' ? PRESSURE.flankSecs : 0));
    if (up.length >= 2 && waited > 1 && (allSet || due)) {
      const lead = up.find(m => m.set) ?? up[0];
      // set on the doors. A fight still going on in there (their own ears, and none of them in one himself) is a mate to get to and an enemy looking the other
      // way: in now. A room gone quiet is four rifles waiting: they HOLD its doors from outside and make the team come out through them, and go in only when
      // `siegeSecs` have brought nobody.
      const hold = wayOut(g), siege = hold ? PRESSURE.wayOutSecs : PRESSURE.siegeSecs;   // (the way out: they stay back — no going in at a fight heard inside, at boots, nor round when the door they hold is fought at)
      if (P.setAt < 0) { P.setAt = g.time; if (siege > 0) { st.stats.pressSieges++; g.say(lead.D.gd, hold ? 'back off the doors — out of their flash! let them come out to us!' : 'hold the doors — let them come to us!', true); note(g, F, lead.D.gd, `press ${P.id}: set, holds the doors (${up.length} men, ${new Set(up.map(m => m.door)).size} doors)`); } }
      // the trap sprung at one door (a man of the press in contact there) is heard at the others: the men with nobody in front of them go THROUGH — at the
      // noise, by their own ears — and the team that walked out into one door has the others at its back
      if (PRESSURE.converge && !hold && up.some(m => m.set && g.time - m.D.gd.lastSeenT < 2)) {
        const go = up.filter(m => m.set && g.time - m.D.gd.lastSeenT > 3 && g.time >= m.D.gd.dazzledUntil && !!m.D.noiseAt && g.time - m.D.noiseT < 2 && m.D.noiseT > m.D.movedAt + 0.5);
        if (go.length) {
          P.phase = 'go'; P.goAt = g.time; P.n0 = up.length; st.stats.pressConverge++;
          g.say(go[0].D.gd, w('they\'re coming out — get around them, go!', 'they\'re coming out — get round them, go!'), true); note(g, F, go[0].D.gd, `press ${P.id}: the trap is sprung, ${go.length} go round`);
          for (const m of up) { m.freeAt = g.time; if (go.includes(m)) { m.moving = false; loose(g, m.D, m.D.noiseAt!); } }
          return false;
        }
      }
      const calm = up.every(m => g.time - m.D.gd.lastSeenT > 3);
      // …or the team heard on the move in there: boots through the sound model (a teammate's by the rule the team's own ears use on a defender's — roomfight.ts
      // stepEars; the player's by the stock hearing, which counts them). Men walking to their marks are not men covering doors: that is the moment.
      if (PRESSURE.listen && !hold && calm && g.time >= P.listenAt) { P.listenAt = g.time + 0.2; if (up.some(m => m.set && g.time - m.setAt > 0.5 && (hearsTeam(g, F, m.D.gd) || m.D.gd.witness.heard.small > m.small0))) P.moving = true; }
      const fight = !hold && calm && up.some(m => !!m.D.noiseAt && g.time - m.D.noiseT < 2 && m.D.noiseT > m.D.movedAt + 0.5 && P.room.cells.has(cellOf(g, m.D.noiseAt)));   // (heard since he planted: what a mover heard on the way is booked to him the frame he stops)
      if (g.time - P.setAt < 0.6 || !(fight || (calm && (P.moving || g.time - P.setAt > siege)))) return false;
      P.phase = 'word'; P.wordAt = g.time; P.lone = false; st.stats.pressWords++;
      g.say(lead.D.gd, P.moving && !fight ? 'they\'re moving — go, go!' : 'go — go — go!', true); note(g, F, lead.D.gd, `press ${P.id}: the word${fight ? ', a fight inside' : P.moving ? ', boots inside' : ''} (${up.length} men, ${new Set(up.map(m => m.door)).size} doors)`);
    } else if (P.lone && (P.loneAt !== undefined ? g.time - P.loneAt > 40 : waited > PRESSURE.gatherSecs + 40)) { for (const m of up) drop(st, g, m); return true;   // (he stays where he planted, the stock room fight's holder again)
    } else if (up.length === 1 && up[0].set && !P.lone && waited > PRESSURE.gatherSecs) {
      P.lone = true; st.stats.pressLone++; if (wayOut(g)) P.loneAt = g.time;   // (the way out holds long: his forty seconds run from now, not from the forming up)
      g.say(up[0].D.gd, 'I\'ve got this door — they\'re not coming out!', true); note(g, F, up[0].D.gd, `press ${P.id}: alone, holds ${up[0].door.def.name} from outside`);
    }
    return false;
  }
  if (P.phase === 'word') {
    if (g.time - P.wordAt < PRESSURE.wordSecs) return false;
    P.phase = 'go'; P.goAt = g.time; P.n0 = up.length;
    for (const m of up) { m.moving = false; m.freeAt = g.time; loose(g, m.D, P.at); }
    return false;
  }
  // 'go': over when every man of it is down, back at a post, or it is old
  if (up.some(m => m.moving && m.D.mode === 'move') && g.time - P.goAt < 90) return false;
  if (!up.length || g.time - P.goAt > 45 || up.every(m => m.D.mode === 'hold' && !m.moving && (m.fell ? m.fought || g.time - m.replantT > 30 : g.time - P.goAt > 30))) { for (const m of up) drop(st, g, m); return true; }
  return false;
}

/** the last man up in a room does not die at his post. (b) Two or more of the enemy in view: after his own beat he gives the room up through a door the trouble
 *  is not at. (c) He does not have to see them: on a floor gone loud (a fight heard elsewhere inside `loudSecs`), the team's boots at one door of his room —
 *  his own ears, the rule the team's ears use on a defender's — send him out by another before the door goes, to hold that one from its far side. */
function lastMan(g: Game, F: RoomFight, st: State, D: Def) {
  const gd = D.gd, c = gd.char, nav = g.col.nav;
  // (lostAt ahead of the clock = somebody holds him to his room — the rescue's men with the hostages)
  const ok = D.mode === 'hold' && !st.of.has(D) && D.room && D.room.cells.size <= ROOM_CELLS && !gd.held && !(D.lostAt > g.time) && g.time >= gd.dazzledUntil && g.time >= gd.staggerUntil
    && g.time - D.movedAt > 6 && g.time - (st.tried.get(D) ?? -100) > 6 && !st.outs.some(o => o.def === D)
    && !F.defs.some(X => X !== D && alive(X) && X.room === D.room && X.mode !== 'free')
    && !squadStaysIn(g, gd)    // (enemysquads.ts: a squad told to stay in its rooms — mayLeave false — gives none up)
    && !lastStandMan(g, gd);   // (laststand.ts: nor does a man of the last stand)
  if (!ok) { st.last.delete(D); return; }
  const R = D.room!; let why: 'seen' | 'door' | null = null, threat: Vec3 = gd.sightPos, shut = -1;
  if (gd.state === 'alert' && g.time - gd.lastSeenT < 1.5) {
    let seen = 0;   // (his own eyes: the game's sight test — cone, range, line, smoke — and some light on the man)
    for (const O of F.ops) {
      if (O.gd.state === 'dead' || !isHostile(gd.team, O.gd.team) || flat(O.gd.char.pos, c.pos) > 14) continue;
      const vis = canSeeChar(g, gd, O.gd.char, false); if (vis.visible && sightGainOn(g, gd, O.gd, vis.dist) > 0) seen++;
    }
    if (seen >= 2) why = 'seen';
  } else if (PRESSURE.outEarly && R.entries.length > 1 && D.noiseAt && g.time - D.noiseT < PRESSURE.loudSecs && g.time - gd.lastSeenT > 3
    && !(DIGIN.on && DIGIN.holdSet && digInSet(g, gd))) {   // (a man SET on his door — digin.ts — is waiting for exactly those boots: he holds)
    let e = st.ear.get(D); if (!e) { e = { t: -1, i: -1, at: -100 }; st.ear.set(D, e); }
    if (g.time - e.t > 0.25) {
      e.t = g.time; const p = teamBoots(g, F, gd);
      if (p) { let bi = -1, bd = 5; R.entries.forEach((x, i) => { const d = flat(x.at, p); if (d < bd && !R.cells.has(cellOf(g, p))) { bd = d; bi = i; } }); if (bi >= 0) { e.i = bi; e.at = g.time; } }
    }
    if (e.i >= 0 && e.i < R.entries.length && g.time - e.at < 3) { why = 'door'; shut = e.i; threat = R.entries[shut].at; }
  }
  if (!why) { st.last.delete(D); return; }
  const at = st.last.get(D); if (at === undefined) { st.last.set(D, g.time + pick(why === 'seen' ? PRESSURE.lastManSecs : PRESSURE.outSecs)); return; }
  if (g.time < at) return;
  st.last.delete(D);
  let best: { spot: Vec3; door: Door; L: number } | null = null;
  R.entries.forEach((e, i) => {
    if (i === shut || D.ev[i] > 0.3 || flat(e.at, threat) < 3 || e.door.def.steel || g.doors.lockedOut(e.door, c.pos)) return;
    const fr = frameOf(e.door); let spot: Vec3 | null = null;
    for (const [depth, lat] of [[3.0, 1.6], [3.0, -1.6], [2.4, 1.2], [2.4, -1.2], [1.2, 2.4], [1.2, -2.4], [1.2, 1.7], [1.2, -1.7], [2.6, 0]]) {
      const p: Vec3 = [e.at[0] + e.out[0] * depth + fr.ux * lat * (1 + fr.W / 3.2), 0, e.at[2] + e.out[1] * depth + fr.uz * lat * (1 + fr.W / 3.2)];
      if (nav.isBlocked(p[0], p[2]) || R.cells.has(cellOf(g, p))) continue;
      if (F.defs.some(X => X !== D && alive(X) && flat(X.gd.char.pos, p) < 0.9)) continue;
      spot = p; break;
    }
    if (!spot) return;
    const path = nav.findPath(c.pos, spot); if (!path?.length) return;
    let L = 0, q: Vec3 = c.pos, toward = false; for (const w of path) { L += flat(q, w); q = w; if (flat(w, threat) < 2) toward = true; }
    if (L > 18 || toward || flat(q, spot) > 0.8) return;
    if (!best || L < best.L) best = { spot, door: e.door, L };
  });
  const B = (hooked(g, D, why, threat) ?? best) as { spot: Vec3; door: Door | null; L?: number } | null;
  st.tried.set(D, g.time);   // (whether or not there was a way out: he does not ask again for a while — his own clock, so the stock fall-back keeps its own)
  if (!B) { note(g, F, gd, `last man: ${why === 'seen' ? 'two of them in view' : `boots at ${R.entries[shut].door.def.name}`}, no way out of room ${R.id}`); return; }
  run(g, D, B.spot, B.door, 0.3);
  st.outs.push({ door: B.door, def: D, moving: true, plantT: -1, fought: false, stepT: -100 });
  if (why === 'seen') { st.stats.fbLast++; g.say(gd, 'too many — I\'m out the back!', true); } else { st.stats.fbEarly++; g.say(gd, 'they\'re at the door — I\'m out the back!', true); }
  note(g, F, gd, `last man: ${why === 'seen' ? 'two of them in view' : `boots at ${R.entries[shut].door.def.name}`}, gives room ${R.id} up${B.door ? ` through ${B.door.def.name}` : ''}`);
}
function tickOut(g: Game, F: RoomFight, st: State, o: Out): boolean {
  const D = o.def, gd = D.gd;
  if (!alive(D) || !F.defs.includes(D)) return true;
  if (o.moving) {
    if (D.mode === 'move') { o.stepT = boots(g, gd, o.stepT); return false; }
    o.moving = false; o.plantT = g.time; st.stats.fbPlanted++;
    // whoever of his side holds the room he has come into hears it from him: the door he came by is the one to watch
    const mates = F.defs.filter(X => X !== D && alive(X) && X.mode === 'hold' && X.room === D.room && flat(X.gd.char.pos, gd.char.pos) < 12);
    let told = 0; for (const X of mates) { const i = X.room && o.door ? X.room.entries.findIndex(e => e.door === o.door) : -1; if (i >= 0) { X.ev[i] = Math.max(X.ev[i], 1.2); told++; } }
    if (told) { st.stats.fbTold++; g.say(gd, 'they\'re right behind me — watch that door!', true); }
    note(g, F, gd, `last man: plants${o.door ? ` beyond ${o.door.def.name}` : ''}${told ? `, tells ${told}` : ''}`);
    return false;
  }
  if (!o.fought && gd.lastSeenT > o.plantT + 0.2) { o.fought = true; st.stats.fbFought++; note(g, F, gd, 'last man: fights again'); st.doneAt.set(D, g.time); return true; }
  if (g.time - o.plantT > 90) { st.doneAt.set(D, g.time); return true; }
  return false;
}

// ---------------------------------------------------------------- STAND TO (PRESSURE.warned): surprise lost before the first entry
/** boots on doors and charges gone off, as their ears have counted them */
const charges = (F: RoomFight) => F.defs.reduce((n, X) => n + X.gd.witness.heard.kick + X.gd.witness.heard.bang, 0);
/** the fight is on, by what their side can know of it: a boot or a charge heard anywhere, a man blinded, off on the hunt, with eyes on an enemy, with the noise
 *  inside his own room — or gone from the net (a man down, however quietly) */
function fightOn(g: Game, F: RoomFight): boolean {
  if (charges(F) > 0) return true;
  for (const X of F.defs) {
    if (!alive(X) || X.mode === 'free' || g.time < X.gd.dazzledUntil || g.time - X.gd.lastSeenT < 5) return true;
    if (X.noiseAt && g.time - X.noiseT < 5 && !X.noiseOut) return true;
  }
  return false;
}
/** the report is heard or called and no room is hit yet (standTo runs first each frame: a fight that is on has ended this) */
const awaiting = (st: State) => PRESSURE.warned && !!st.warn && st.warn.phase !== 'over';
/** a report was called and a room has since been hit: all hands, for the rest of the fight */
const stoodTo = (st: State) => PRESSURE.warned && !!st.warn && st.warn.callT >= 0 && st.warn.phase === 'over';
/** a man of the reaction force: a report stands (or its room was hit only just now) and the room it points at is not his */
const readyMan = (st: State, D: Def, now: number) => {
  const w = st.warn; if (!PRESSURE.warned || !w || !w.room || D.room === w.room) return false;
  return w.phase !== 'over' || (w.callT >= 0 && now - w.hitT! < PRESSURE.standGrace);
};
/** the fight a man's ears give him to go to. Stood to, a report is nobody's room being hit, however near a mate's post it was: not while it stands, and not
 *  once a room IS hit either (what he heard before the hit is the report still) */
const reportStands = (st: State, D: Def) => { const w = PRESSURE.warned ? st.warn : null; return !!w && (w.phase !== 'over' || (w.callT >= 0 && D.noiseT < w.hitT! - 0.5)); };
const aim = (st: State, F: RoomFight, D: Def): { T: Room; at: Vec3 } | null => reportStands(st, D) ? null : target(F, D);
/** the held room of theirs the noise points at: the one with a door the shortest way on foot from it */
function roomFor(g: Game, F: RoomFight, at: Vec3): Room | null {
  const free = (p: Vec3) => (F as unknown as { freeNear(p: Vec3): Vec3 | null }).freeNear(p);   // (the room fight's own 'nearest free floor', private there: read as digin.ts reads it)
  const nav = g.col.nav, from = free(at) ?? at, ways: { R: Room; o: Vec3; d: number }[] = [], done = new Set<Room>();
  for (const X of F.defs) {
    const R = X.room; if (!alive(X) || X.mode !== 'hold' || !R || done.has(R) || R.cells.size > ROOM_CELLS) continue;
    done.add(R);
    for (const e of R.entries) { const o = free([e.at[0] + e.out[0] * 1.2, 0, e.at[2] + e.out[1] * 1.2]); if (o) ways.push({ R, o, d: flat(from, o) }); }
  }
  ways.sort((a, b) => a.d - b.d);
  let best: Room | null = null, bl = Infinity;
  for (const { R, o, d } of ways) {
    if (d >= bl) break;   // (no way on foot is shorter than the straight line: nothing further can win)
    const path = nav.findPath(from, o, 6000, (ix, iz) => R.cells.has(nav.idx(ix, iz)) ? 30 : 1); if (!path) continue;
    let L = 0, q: Vec3 = from; for (const p of path) { L += flat(q, p); q = p; }
    if (L < bl) { bl = L; best = R; }
  }
  return best;
}
/** once a frame, before anybody is considered for a press. No die is drawn here, and a fight that starts as a fight (the first loud thing is a room being hit)
 *  is 'over' on the frame it is first heard: every such run is exactly what it is with the switch off */
function standTo(g: Game, F: RoomFight, st: State) {
  const w = st.warn, holds = (X: Def) => alive(X) && X.mode === 'hold';
  if (!w) {   // the first loud thing any of them hears, as the man best placed heard it
    let by: Def | null = null;
    for (const D of F.defs) if (holds(D) && D.noiseAt && g.time - D.noiseT < 1 && (!by || flat(D.station, D.noiseAt) < flat(by.station, by.noiseAt!))) by = D;
    const on = st.presses.length > 0 || fightOn(g, F);
    if (!by && !on) return;
    const room = by && !on ? roomFor(g, F, by.noiseAt!) : null;   // (no held room it could be for: nothing to stand to)
    st.warn = { phase: room ? 'heard' : 'over', t0: g.time, by: by ?? F.defs[0], callT: -1, lastT: g.time, room };
    return;
  }
  if (w.phase === 'over') return;
  if (fightOn(g, F)) {   // a room is being hit: the stock press's from here — with every hand in it, if the report was called
    w.phase = 'over'; w.hitT = g.time;
    if (w.callT < 0) return;
    st.stats.warnHits++; st.stats.warnLead += g.time - w.callT;
    const gd = (F.defs.find(X => holds(X) && X.room !== w.room && g.time >= X.gd.dazzledUntil) ?? F.defs.find(holds))?.gd;
    if (gd) { g.say(gd, 'contact! that\'s them — everybody, go!', true); note(g, F, gd, `stand to: a room is hit ${(g.time - w.callT).toFixed(1)} s after the call, all hands`); }
    return;
  }
  if (w.phase === 'called') {
    for (const D of F.defs) if (holds(D) && D.noiseAt && D.noiseT > w.lastT) w.lastT = D.noiseT;   // (more of it outside: they are still out there)
    if (g.time - w.lastT <= PRESSURE.standSecs) return;
    const gd = F.defs.find(holds)?.gd; st.warn = null; st.stats.warnStoodDown++;   // nobody came (the next report is a new one)
    if (gd) { if (!PRESSURE.sweep) g.say(gd, 'nothing. stand down — hold where you are.', true); note(g, F, gd, 'stand to: nobody came, stands down'); }   // (PRESSURE.sweep: nobody is told to hold where he is — the quiet that stood them down is the quiet a pair goes to look into, and goLook's line, later this frame or the next, is what is said)
    return;
  }
  if (g.time - w.t0 < PRESSURE.reportSecs) return;
  w.phase = 'called'; w.callT = w.lastT = g.time;
  const gd = (holds(w.by) ? w.by : F.defs.find(holds) ?? w.by).gd;
  st.stats.warnCalls++; g.say(gd, WORDS.on ? 'that was outside — they\'re coming. get ready!' : 'shots outside — they\'re coming. stand to!', true);   // (the report may have been a boot or a charge: he names no shots)
  note(g, F, gd, `stand to: calls the report, room ${w.room!.id} is the nearest of theirs to it`);
}

/** STAND AND FIGHT, once a frame: a hunter the press called (its man still, or one it has let go of — for `CALLED_SECS` after the call) with his eyes and a
 *  clear shot on one of them out of the room he was called to, himself out of it and out of any door frame, stops where he stands — a scripted leg to his
 *  own feet, which roomfight.ts plants as its holder, his threat the man he sees. A man he sees and cannot hit (a pane, a jamb) he goes round to, as before */
const CALLED_SECS = 30;
function standAndFight(g: Game, F: RoomFight, st: State) {
  for (const D of F.defs) {
    const gd = D.gd, c = gd.char, k = st.called.get(D), m = st.of.get(D);
    if (!k || g.time - k.t > CALLED_SECS || !alive(D) || gd.held || D.mode !== 'free' || m?.fell || g.time - gd.lastSeenT >= 0.1 || g.time < gd.dazzledUntil || g.time < gd.staggerUntil) continue;
    const dc = doorCells(g), at = cellOf(g, gd.sightPos), mine = cellOf(g, c.pos), dAt = dc.get(at), fc = gd.foe === 'player' ? g.player.char : gd.foe ? gd.foe.char : null;
    if (!fc || k.T.cells.has(at) || k.T.cells.has(mine) || dc.has(mine)) continue;   // (never in a door frame himself: his mates need it)
    if (dAt && k.T.entries.some(e => e.door === dAt)) continue;                      // one of them in that room's own door frame is not out of it (frames are no room's cells)
    if (!clearShot(g, c, [fc.pos[0], fc.pos[1] + 1.2, fc.pos[2]])) continue;
    if (laneExposed(g, gd)) continue;   // (lanes.ts: where he stands is floor his side knows a gun covers — no place to plant himself; the lane's own rule has him out of it)
    gd.hold = true; gd.path = []; gd.pathGoal = null;
    if (PRESSURE.secondKeeps) F.standOn(D, PRESSURE.secondSet); else run(g, D, v3.copy(c.pos), null);
    if (m) drop(st, g, m); else st.doneAt.set(D, g.time);
    st.stats.secondStood++;
    if (g.time - st.stoodT > 6) { st.stoodT = g.time; st.stats.secondCalls++; g.say(gd, 'contact — they\'re out in the open! stand and fight!', true); }
    note(g, F, gd, 'meets the team in the open, stands and fights');
  }
}

/** GO AND LOOK (PRESSURE.sweep), once a frame after the press's own rules: the word is kept every frame; a look is called when it has gone quiet */
function goLook(g: Game, F: RoomFight, st: State) {
  if (g.rescue?.active) return;   // (a hostage rescue's men are pinned to their room by rescue.ts a frame at a time: nobody of that floor walks off to look)
  let up = 0;
  for (const X of F.defs) {
    if (!alive(X)) continue;
    up++;
    const m = X.gd;
    if (!m.held && m.lastSeenT >= 0 && m.lastSeenT > (st.word?.t ?? -Infinity)) st.word = { t: m.lastSeenT, p: v3.copy(m.sightPos) };   // (lastSeenT: a man of the team properly in his sight — a faint glimpse moves sightPos alone, and is nobody's word)
    if (X.noiseAt && X.noiseT > (st.word?.t ?? -Infinity)) st.word = { t: X.noiseT, p: v3.copy(X.noiseAt) };
  }
  // the men of the last look: one of them down while he was out, and nobody else walks out this fight; all of them holding again, and that look is over
  if (st.out) { if (st.out.some(D => !alive(D))) { st.lookLost = true; st.out = null; const by = F.defs.find(alive); if (by) note(g, F, by.gd, 'go and look: a man of the look is down — nobody else walks out'); } else if (st.out.every(D => D.mode !== 'free')) st.out = null; }
  const w = st.word; if (!w || st.lookLost) return;
  const dug = (D: Def) => { const ph = digInPhase(g, D.gd); return ph !== 'idle' && ph !== 'set'; };   // (on his way to cover or at a door with a wedge: busy. Set on his door, he has done getting ready)
  const free = (D: Def) => alive(D) && D.mode === 'hold' && !st.of.has(D) && !D.gd.held && D.rallyAt !== Infinity && g.time >= D.gd.dazzledUntil && g.time >= D.gd.staggerUntil
    && !st.outs.some(o => o.def === D) && !lastStandMan(g, D.gd) && !squadOwns(g, D.gd) && !dug(D) && !laneHolds(g, D.gd, w.p) && !laneWarns(g, D.gd, w.p);
  const L = st.look;
  if (L) {
    if (w.t > L.w || !L.men.every(free)) { st.look = null; st.stats.lookOff++; if (w.t <= L.w) st.swept = -Infinity; return; }   // (word of them in the beat, or a man of the pair taken: nobody goes on the old call — the next quiet spell is its own)
    if (g.time < L.goT) return;
    st.look = null; st.out = L.men;
    for (const D of L.men) { loose(g, D, L.at); st.stats.lookMen++; note(g, F, D.gd, `goes to look where the team was last put (${flat(D.gd.char.pos, L.at).toFixed(1)} m)`); }
    return;
  }
  if (st.swept >= w.t || g.time - w.t < PRESSURE.sweepSecs || g.time - st.lookT < PRESSURE.sweepSecs) return;
  if (st.presses.length || st.outs.length || awaiting(st) || squadsLive(g)) return;
  const n = Math.min(Math.max(2, PRESSURE.sweepMen), up - 1); if (n < 2) return;   // (never fewer than two, and somebody always stays)
  if (F.defs.some(X => alive(X) && X.mode === 'free')) return;   // (a man is out already: his look is the look)
  const R = F.roomAt(w.p);
  if (R && F.defs.some(X => alive(X) && X.mode === 'hold' && X.room === R)) return;   // (a man of theirs holds the room that word is of: he is looking at it)
  const C = F.defs.filter(free).sort((a, b) => flat(a.station, w.p) - flat(b.station, w.p));
  for (const lead of C) {   // the nearest man who has his mates within a call of him: the pair leaves as a pair
    const mates = C.filter(D => D !== lead && flat(D.station, lead.station) <= PRESSURE.sweepPairM).sort((a, b) => flat(a.station, lead.station) - flat(b.station, lead.station)).slice(0, n - 1);
    if (mates.length < n - 1) continue;
    st.swept = w.t; st.lookT = g.time; st.look = { at: v3.copy(w.p), goT: g.time + PRESSURE.sweepBeat, w: w.t, men: [lead, ...mates] };
    st.stats.lookCalled++; g.say(lead.gd, WORDS.on ? 'it\'s gone quiet. with me — let\'s go look.' : 'gone quiet. with me — we go and look.', true);
    note(g, F, lead.gd, `go and look: nothing of the team for ${(g.time - w.t).toFixed(0)} s, calls ${n} to where they were last put`);
    return;
  }
}

/** once a frame from RoomFight.tick, after the defenders' and the teammates' own ticks */
export function pressTick(g: Game, F: RoomFight, _dt: number) {
  // (THE KIT IS ITS OWN LEVER — difficulty.ts `kit`: what a defender carries is handed out whether or not the press is on. With the press off nobody is sent at
  // a door charge first; a man with one uses it where the doorway drill has him go in by a door his side holds dangerous — tactics.ts)
  if (PRESSURE.stuns > 0) { for (const D of F.defs) if (!KITTED.has(D.gd)) { KITTED.add(D.gd); giveStuns(D.gd, PRESSURE.stuns); } }
  else for (const D of F.defs) if (KITTED.delete(D.gd)) giveStuns(D.gd, 0);   // (the row put back to 0 mid-fight: the charges go back with it)
  if (PRESSURE.stuns > 0) { const st = stateOf(g); if (st.stale) { st.stale = false; st.stats = newStats(); } learn(g, F, st); }   // (with the press off too: the kit lever's men go through `charge` as the press's do)
  if (!PRESSURE.on) return;
  const st = stateOf(g);
  if (st.stale) { st.stale = false; st.stats = newStats(); }
  if (PRESSURE.press && PRESSURE.warned && !squadsLive(g)) standTo(g, F, st);   // (enemysquads.ts: on a squads level a shot heard before the first entry is each squad's own to answer — 'heard it — on the doors' — and nobody stands to on the press's word: no squad's man could go on its 'everybody, go!')
  if (PRESSURE.press) for (const D of F.defs) if (alive(D)) consider(g, F, st, D);
  if (st.presses.length) st.presses = st.presses.filter(P => !tickPress(g, F, st, P));
  if (PRESSURE.second && PRESSURE.press && !PRESSURE.gather) standAndFight(g, F, st);
  if (PRESSURE.fallBack) for (const D of F.defs) if (alive(D)) lastMan(g, F, st, D);
  if (st.outs.length) st.outs = st.outs.filter(o => !tickOut(g, F, st, o));
  if (PRESSURE.sweep && PRESSURE.press) goLook(g, F, st);
}
/** the fight is over (RoomFight.stop): every press forgotten. The counts stay for whoever reads them after the run; a new fight starts them again. */
export function pressStop(g: Game) {
  const st = STATES.get(g); if (!st) return;
  st.presses = []; st.of.clear(); st.outs = []; st.think.clear(); st.stay.clear(); st.called.clear(); st.stoodT = -100; st.sent.clear(); st.doneAt.clear(); st.last.clear(); st.tried.clear(); st.ear.clear(); st.warn = null; st.told.clear(); st.heard = []; st.marks.clear(); st.lastHeld.clear(); st.word = null; st.swept = -Infinity; st.look = null; st.out = null; st.lookLost = false; st.lookT = -Infinity; st.stale = true;
}
/** the counts of this run (tools/qa/playthrough.ts files them per run), with the stock room fight's own beside them */
/** (the dialogue pass, tactics.ts flankCall) when the look this man is on was called — he is one of the pair sent to where the team was last put
 *  (PRESSURE.sweep: called and not yet gone, or still out) — or null. Words only: no rule reads it. */
export function lookSince(g: Game, gd: Guard): number | null {
  const st = STATES.get(g); if (!st) return null;
  return st.look?.men.some(D => D.gd === gd) || st.out?.some(D => D.gd === gd) ? st.lookT : null;
}
export function pressureStats(g: Game): Record<string, number> {
  const s = STATES.get(g)?.stats ?? newStats(), f = g.fight.stats;
  return { ...s, pressLead: +s.pressLead.toFixed(2), flankLead: +s.flankLead.toFixed(2), warnLead: +s.warnLead.toFixed(2), stockRallied: f.rallied, stockFellBack: f.fellBack, stockTookCover: f.tookCover };
}
export function pressureSummary(g: Game): string {
  if (!PRESSURE.on) return 'off';
  const st = STATES.get(g); if (!st) return 'on · nothing yet';
  const s = st.stats;
  return `${['press', 'flank', 'fallBack', 'second'].filter(k => (PRESSURE as any)[k]).join(' + ') || 'nothing switched'} · ${st.presses.length} live · ${s.pressFormed} presses, ${s.pressWords} words, ${s.flankSent} round, ${s.fbPush + s.fbLast} fell back${PRESSURE.second ? `, ${s.secondStood} stood` : ''}`;
}

/** what a visit keeps of this (read once, at import, below; the headless harness has no store) */
const KEPT = ['on', 'press', 'flank', 'fallBack', 'second', 'secondKeeps', 'secondSet', 'maxMen', 'keepRoom', 'keeperLeft', 'organiseK', 'gather', 'warned', 'standPress', 'picket', 'byWay', 'wayOut', 'rescueCrew', 'drilled', 'squadDrill', 'sweep'] as const;   // (not `stuns`: it is hard's on one level — difficulty.ts HARD_AT — and a stored copy would follow the machine to every other)
const LS = 'twopointsix.pressure';
export const PRESSURE_DEFAULTS: typeof PRESSURE = JSON.parse(JSON.stringify(PRESSURE));
export function loadPressure() {
  try { const o = JSON.parse(globalThis.localStorage?.getItem(LS) ?? 'null'); if (o) for (const k of KEPT) if (typeof o[k] === typeof PRESSURE[k]) (PRESSURE as Record<string, unknown>)[k] = o[k]; } catch { /* no store, or not ours: the build's values */ }
}
/** the shipped values back, and the kept copy dropped */
export function resetPressure() {
  Object.assign(PRESSURE, JSON.parse(JSON.stringify(PRESSURE_DEFAULTS)));
  try { globalThis.localStorage?.removeItem(LS); } catch { /* no store */ }
}
export function savePressure() {
  try { globalThis.localStorage?.setItem(LS, JSON.stringify(Object.fromEntries(KEPT.map(k => [k, PRESSURE[k]])))); } catch { /* no store */ }
}
loadPressure();   // (read at import, as digin.ts reads its own: the boot card's difficulty row is up before main.ts gets to its flags; headless there is no store)
