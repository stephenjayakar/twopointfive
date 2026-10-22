// The HOSTAGE RESCUE playtest (?rescue · native --rescue · __rescue · Tab ▸ Sandbox ▸ Hostage rescue). The night breach (nightbreach.ts) asked whether a team entry
// reads as a fight and the room clear (roomclear.ts) whether a structure can be taken room by room; this asks the next thing: does it still work when the team has
// to FLOW — run past rooms it has not cleared, because somebody at the far end of the corridor is about to be shot. The office at night; the shift, the cleaner and
// the late worker, the response team and the cameras off the floor, as under the night breach (the same four gates). Design: the 'fast rescue' answer page's
// section 3. It stands on the room clear's build: the pair are ordered through its command menu (orders.ts — press X), both sides shoot on their own read
// (roomfight.ts), and its fog of war is on under the flag.
//
//   WHO IS WHERE   two HOSTAGES (civilians of the usual make, down and told to stay down — civilians.ts spawnHostage) along the north wall of the manager's office;
//                  a CAPTOR in the office with his gun on the corridor door; a DOOR MAN in the corridor's east half (knob: just inside the office instead); a ROAMER
//                  who comes to the noise — in the break room or the conference room, drawn at each staging. Sam and two operatives (Blue One, Blue Two) at the lobby arch, the corridor's west end: the conference
//                  room, the cubicles' two openings and the server room all lie between them and the hostages.
//   CLOCK ONE      the captor's. `resolve` runs 0 → 1 over RESCUE.resolveSecs (drawn ± resolveSpread at each staging, so it cannot be counted — unless samestart.ts is on: then it is the knob's to the second, every try) from the moment the
//                  clock starts — hot start (default): Sam's first move, shot or order; quiet start: the first thing a defender hears or sees. At 1 the captor
//                  turns on the nearest hostage, takes aimSecs to line up, and fires; the second hostage follows secondHostageSecs later. A dazzled captor's clock
//                  stands still (the charge is the window), a dead captor's passes to whoever of his side is alive in the room — who is secondHostageSecs from
//                  doing it at the soonest, however far the last man had got — and with nobody of theirs in the room it stops. He shouts it (three steps: shouting / counting / about to); the message line says when the step changes and the panel's summary which it is.
//   CLOCK TWO      every defender's. UNSET until setSecs after he first learns the assault is on (his own ears and eyes: the AI's hearing puts him off 'patrol';
//                  at a hot start the captor begins SET — captorSet): a man caught unset reacts late (unsetReact from the moment he first SEES one of the team)
//                  and, dazzled, stands and stares. SET, he is the room fight's defender as it has him: gun on the entry his own ears fear (the way he was put,
//                  until he has heard something), and dazzled he empties a burst blind down it. The roamer's 'set' is setting OFF: he is let off his post to
//                  hunt the last loud thing the team did (the room fight may have sent him to the gunfire sooner, by his own ears).
//   THE TEAM       the room clear's squad: the X menu's orders for where they are and what they watch — fall in, hold, move there, stack up, cover (orders.ts) and
//                  the DOOR TOOLS on any door, the hostage room's two included: open and clear, bang and clear, breach with a charge, clear from outside
//                  (doortools.ts — the same rows, keys and counts as under the room clear: 2 charges and 3 bangs a staging) — and the room fight for when they
//                  shoot. At a hot start the pair FALL IN the moment the clock starts, without being told (dynamic tempo: whatever Sam passes, they pass).
//   F              GO ON THE HOSTAGE ROOM. A charge set on a door has the press first, as everywhere (doortools.ts: F blows it — and under the rescue the charges
//                  on BOTH of the room's doors go on the one press). Otherwise F is the menu's 'bang and clear' on the hostage room's corridor door without the
//                  menu: whoever is free runs to the stack, the lead boots it, the can goes in, they follow it — the door tools' own order, its can out of the
//                  same three ('open and clear' with none left, or with RESCUE.stun off). The men are the menu's throughout: any order takes a man off it at
//                  any moment (nothing is 'committed'). With the clock not yet running (quiet start) F is two words: the first stacks them and they hold, the
//                  second sends them in.
//   THE FLOW       once the clock runs the pair do not only follow: the last man in the file COVERS each opening Sam passes, unasked, says so, and catches up;
//                  the floor across each opening shows what is known of it (rescueflow.ts — RescueFlow, `flow`; RESCUE.flow / .marks).
//   TWO DOORS      F with a man Sam has posted in the server room (hold / move there / cover / stack up), or pressed from in there with both men on him: that
//                  man takes the SIDE door, the other the corridor door, as two of the door tools' orders through one GATE (doortools.ts DoorGate): neither
//                  door is opened until both are stacked, then the side door's shove waits for the corridor door's boot and the leaves move on one frame; each
//                  man throws his own can and goes in on his own count behind it. A man Sam has put on a 'cover' of his own stays on it: F is a man short.
//                  (The side door's jambs on the server room's side have no floor: the scenario authors that face's marks — SIDE_MARKS, through orders.ts
//                  doorMarks — so the menu's stack up and every door tool work on it from in there too.)
//   THE END        SECURED = nobody of theirs alive in the office, one of the team in it, a hostage alive; held holdSecs → RESCUED: CLEAN with both hostages
//                  alive, COSTLY with one (team up and seconds from the clock's start on the line). LOST (FAILED) = both hostages dead, one hit by Sam's own
//                  round, or Sam down (the game's own down card follows). A restart of any kind stages it again.
//
// Nothing here runs unless start() was called: tick() returns on its first line, and with the scenario off the game is the game as it was.
import { SideSet } from '../math/side';
import { Vec3, v3, clamp } from '../math/vec';
import type { Game, Guard } from './game';
import type { Door } from './doors';
import type { Input } from './input';
import type { FollowCamera } from './camera';
import type { RoomClearPlan } from '../scene/level';
import type { DoorOp, DoorGate } from './doortools';
import { sideOf, doorIdWords } from './orders';
import { doorWrittenName } from './doornames';
import type { Assignment } from './orders';
import { spawnUnit, despawnUnit, resetChase } from './guards';
import { PRESSURE } from './pressure';   // (read inside defenders() only: Hard's master switch — nothing of pressure.ts is touched at load)
import { order, endGuardScript, inBounds } from './squad';
import { fireWeapon, killGuard } from './combat';
import { RescueFlow } from './rescueflow';
import { RESCUEEND, RescueEnd } from './rescueend';   // (read inside methods only: how a rescue is won — out, or cleared)
import { RESCUEFLUSH, RescueFlush } from './rescueflush';   // (likewise: the men left alive come for the hostages)
import { rescueCheckOwns } from './rescuecheck';   // (asked inside defenders() only)
import { propGap, wallBetween } from './roomclear';   // (used inside checkRescue only: nothing of roomclear.ts is touched at load)
import { spawnHostage, hostageSay } from './civilians';
import { WORDS, w } from './words';   // (a leaf: the dialogue pass's one switch)
import { blindTurn, BLIND, SQUAD4, SQUAD4_BUDGET, type BlindBurst } from './nightbreach';
import type { SquadSize } from './loadout';
import { kitStage } from './kit';
import { isOffice, HOSTAGE_LINES } from './dialogue';   // (called inside the crew's lines only: nothing of dialogue.ts is touched at load)
import { CUES } from './cues';
import type { RescueData, Rect, TeamStart } from '../scene/scenarios';
import { OFFICE_SCENARIOS } from '../../levels/office.scenarios';   // (plain literals with type-only imports: safe at the top of the game's import cycle)
import { SAMESTART } from './samestart';   // (a leaf)
import { gunDeal } from './gunroles';   // (called inside the staging only)
import { simRandom } from '../math/dice';   // the simulation's die (math/dice.ts): the Game's own when it has one, Math.random otherwise

/** The scenario's knobs (Tab ▸ Sandbox ▸ Hostage rescue, __rescue.knobs). Who stands where, the stun, the lights and the clock's dealt length are read at a staging
 *  ('restage' applies them); the clocks' other numbers, blind fire and the clock's own switch are read as it runs. */
export const RESCUE = {
  /** 'hot' = the captor's clock starts on Sam's first move, shot or order; 'quiet' = on the first thing a defender hears or sees of the team */
  start: 'hot' as 'hot' | 'quiet',
  /** clock one (off = nobody is shot for the team being slow: the A/B, and the tally's control) */
  clock: true,
  /** seconds from the clock's start to the first hostage shot, ± the spread drawn at each staging; the second hostage this long after the first; his aim on her
   *  (35 since the tally — tools/qa/rescue-tally.ts: at 40 a room-by-room crawl with a bang on every door still brought a hostage out in half its runs; at 35
   *  it fails in most, which is what the design asks of it, and the fast entry keeps a dozen seconds in hand) */
  resolveSecs: 35, resolveSpread: 6, secondHostageSecs: 8, aimSecs: 1.2,
  /** clock two: seconds from a defender first learning of the assault to his being set, and the reaction time a man caught before that is held to on his first alert */
  setSecs: 9, unsetReact: 1.1,
  /** hot start: the captor begins SET on the corridor door (he is expecting somebody through it); off = he starts unset like the others */
  captorSet: true,
  /** seconds the secured room must be held for the run to end */
  holdSecs: 15,
  /** the door man: in the corridor's east half, on the straight run — or just inside the office, a second gun on the door */
  doorMan: 'corridor' as 'corridor' | 'inside',
  /** men elsewhere on the floor who come to the noise (0‥2: the break room, the conference room — the second costs a hostage his shadow in the page's renderer);
   *  `seedRoamers`: which of the two rooms the first is in is drawn at each staging (the conference room is the first door the team passes, the break room the
   *  last — so no room is known empty); off = the break room first */
  roamers: 1, seedRoamers: true,
  /** the pair: F is 'bang and clear' — a stun canister in behind the boot, out of the squad's count (off: 'open and clear'); weapon lights once the clock runs;
   *  the response team's hands (aim.ts TRAINED — read only with the room fight off: with it on their side's FIGHT_SKILL row is their hands) */
  stun: true, opLights: true, trained: true,
  /** the defenders: a set man dazzled fires blind down his door (nightbreach.ts BLIND); weapon lights */
  blindFire: true, defLights: false,
  /** the office's own lights (off = the room as the night has it) */
  roomLights: false,
  /** dynamic tempo (rescueflow.ts): once the clock runs the last man in the file covers each opening Sam passes, unasked, and catches up (off = the pair only
   *  follow — the build as it was: the tally's A/B); a lone man still peels off to cover (off = he stays on Sam); the strips on the floor across each opening
   *  and the objective line's 'behind you' */
  flow: true, flowSolo: true, marks: true,
  /** true = the man covering an opening with one of theirs known behind it stays on it for as long as the room is HOT (rescueflow.ts: until it has been seen
   *  empty, the man is seen elsewhere or down, or FLOW.hotSecs after the last sign of him) — or until Sam calls him on. Ships OFF = as it was (FLOW.hotHold,
   *  6 s after the last sight: 'lost him — moving.'): over 24 seeds of the scripted rescue it bought nothing with the team's goggles on (24 won, nobody lost,
   *  either way) and with them off it cost men — 13 of 48 teammates lost against 3: the pair split for longer, and the man left behind met the roamer alone */
  holdHot: false,
  /** F with a man posted in the server room (or pressed from in there with both men free): he takes the side door, the other the corridor door, on one signal;
   *  a man Sam has put on a cover of his own is left on it. Off = F takes whoever is up to the corridor door — but for one fix that has no switch: a man sent
   *  there from inside the server room goes round by the corridor (roundBy), not through the side door and the hostage room */
  twoDoor: true,
  /** THE FOUR on two doors: the side door is a PAIR's — the man F gives it takes his pair mate with him when the mate stands in that room too (the other pair
   *  the main door, on the one signal) and somebody is left for the main door. Read only on a level that asks for it (scenarios.rescue.side.pair: the consulate) with
   *  the four-man squad staged — every level before it plays as it did whichever way this stands. Off = one man on the side door whoever stands beside him */
  sidePair: true,
  /** HARD'S RESCUE CREW — read only while Hard has it on (difficulty.ts HARD.rescueCrew → PRESSURE.rescueCrew; Standard never looks at them). `crewCallSecs` after his clock starts the
   *  captor calls the assault on their net, and from that word his two men know it is on (their set clocks start) and act on it, each saying so on the net:
   *  `crewCross`  a man who can walk to a spot with a line of fire to the floor outside the hostage door — one the way in does not see until it is nearly
   *               there: a side room's doorway — takes it and keeps his gun on that floor: the stack is in a crossfire
   *  `crewDoor`   the door man with no such spot leaves the corridor for the hostage room and pulls the door to: a second gun on it, set before the team is there
   *  `crewBehind` a roamer with no such spot gets out of sight of the way in and lets the team pass; and any of them on his spot comes up behind once the
   *               team's noise is at the hostage door and nobody is in his sights
   *  Each off = that much of Standard back (all three off = Hard on a rescue as it was: nothing) */
  crewDoor: true, crewCross: true, crewBehind: true, crewCallSecs: 1.5,
  /** in the hostage room with a man of theirs still up in it, the team's men pan their lights across it instead of standing on their sectors (search()) */
  roomSearch: true,
  /** the HUD line shows the captor's clock in seconds (tuning) instead of its three steps */
  clockAsSeconds: false,
  /** how many teammates are staged (game/loadout.ts — the page's ?squad=N; scenarioRun.ts writes it): 2 = the pair, exactly as it always was · 0 / 1 = nobody /
   *  Blue One alone · 3 / 4 = the four-man squad's first three / all of it (nightbreach.ts SQUAD4: a red pair and a blue pair, in pairs for the order menu), the
   *  men past the second stood a stride behind the pair's marks. F takes whoever is up, as ever. */
  squad: 2 as SquadSize,
  /** where the team is staged: the LEVEL's (scene/scenarios.ts RescueData.team — start() writes the team start of the level it stages on here; these are the
   *  office's until it has: the lobby arch at the corridor's west end) */
  samAt: [...OFFICE_SCENARIOS.rescue.team.sam] as Vec3, samYaw: OFFICE_SCENARIOS.rescue.team.samYaw, opsAt: OFFICE_SCENARIOS.rescue.team.ops!.slice(0, 2).map(p => [...p]) as [Vec3, Vec3],
};
/** the team start RESCUE.samAt / samYaw / opsAt were last written from (start()) */
let applied: TeamStart | null = OFFICE_SCENARIOS.rescue.team;   // (the knobs above ARE the office's: a knob moved by hand before the first start on the office stays moved)

/** WHO STANDS WHERE is level data (scene/scenarios.ts RescueData — Level.scenarios.rescue; the office's: levels/office.scenarios.ts): the hostage room and its
 *  doors, the marks of everybody the scenario stands on the floor, the team's start, the route's openings. Rescue.data is the one place it is read from. */
/** THE OFFICE'S side-door marks, under the name its probes import them by (the game reads the level's own: Rescue.data.side) */
export const SIDE_MARKS = { stack: OFFICE_SCENARIOS.rescue.side!.stack as Vec3[], standoff: OFFICE_SCENARIOS.rescue.side!.standoff as Vec3[] };
const NUMBER = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];
const doorName = (g: Game, id: string) => { const d = g.doors.byName(id); return (d && doorWrittenName(d)) ?? doorIdWords(id); };   // (orders.ts doorWords, by id — or the name its level wrote for it)
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const yawTo = v3.yawTo, wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** the door tools' orders that end with a man holding a point inside a room · how fast a man pans his light across the hostage room looking for somebody (search()) */
const DOOR_ORDERS = new Set(['openClear', 'bangClear', 'charge', 'outside', 'threshold']), SEARCH_RATE = 1.3, SEARCH_HALF = 1.75;

/** The rescue's data against the floor it is laid on (headless, like roomclear.ts checkStructure): every mark where a man can be stood, the men of the room
 *  inside it and with a line to what they cover, the hostages inside it, the team's start joined on foot to the room, the side door a door of the level, and the
 *  route's own check (rescueflow.ts). Empty = sound. canStart does NOT gate on it: a mark a hand's width off is a thing to see and fix, not a refusal. */
export function checkRescue(g: Game, S: RescueData | undefined = g.level.scenarios?.rescue): string[] {
  if (!S) return ['this level has no hostage rescue data (its scenarios.rescue block)'];
  const bad: string[] = [], nav = g.col.nav, R = g.rescue;
  const B = S.room.bounds ?? g.level.clearPlans?.find(p => p.door === S.room.door)?.bounds;
  /** a man can be stood there: his body (r 0.3, the band his own collision tests) is in no wall and no fixed furniture, and walkable floor is within a step of it
   *  (the nav grid is half-metre cells with a body's clearance: a mark in a cell the grid calls taken is fine while free floor is a step away — the office's own
   *  marks beside its furniture are such). False = the place itself is wrong: what else is asked of that mark is not asked. A mark INSIDE a pushable prop where it
   *  rests is said too, on its own line (the staging shoves the two apart: a thing to see, and it gates nothing). */
  const free = (what: string, p: Vec3) => {
    const q: Vec3 = [p[0], 0, p[2]]; g.col.collideCircle(q, 0.3, 0.2, 1.5); const pushed = Math.hypot(q[0] - p[0], q[2] - p[2]);
    const near = nav.nearestFreePoint(p[0], p[2]), prop = g.props.props.find(pr => propGap(pr, p) < 0.3);
    if (prop) bad.push(`${what} (${p[0]}, ${p[2]}): standing in ${prop.def.name}`);
    const why = pushed > 0.15 ? `in a wall or fixed furniture (pushed ${pushed.toFixed(2)} m out)` : !near || Math.hypot(near[0] - p[0], near[2] - p[2]) > 0.8 ? 'no walkable floor within a step' : '';
    if (why) bad.push(`${what} (${p[0]}, ${p[2]}): ${why}`); return !why;
  };
  const way = (a: Vec3, b: Vec3) => { const A = nav.nearestFreePoint(a[0], a[2]), B2 = nav.nearestFreePoint(b[0], b[2]); return !!A && !!B2 && !!nav.findPath(A, B2); };
  const line = (what: string, m: { pos: Vec3; aimAt: Vec3 }) => { if (wallBetween(g, [m.pos[0], 1.6, m.pos[2]], m.aimAt)) bad.push(`${what}: no line from his eyes to the point he covers`); };
  if (!g.doors.byName(S.room.door)) bad.push(`no door '${S.room.door}' in the level (the hostage room's)`);
  if (!B) bad.push(`the hostage room has no bounds: neither room.bounds nor a clear plan for '${S.room.door}'`);
  if ((S.team.ops?.length ?? 0) < 2) bad.push('team.ops: the pair needs two marks');
  const samOk = free('team start, the player', S.team.sam);
  (S.team.ops ?? []).forEach((p, i) => { if (free(`team start, teammate ${i + 1}`, p) && samOk && !way(S.team.sam, p)) bad.push(`team start, teammate ${i + 1}: no way on foot from the player's mark`); });
  if (!S.hostages.length) bad.push('no hostages');
  S.hostages.forEach((h, i) => { const what = `hostage ${i + 1}`; if (free(what, h.pos) && B && !inBounds(h.pos, B)) bad.push(`${what} (${h.pos[0]}, ${h.pos[2]}): outside the hostage room`); });
  for (const [what, m, inside] of [['the captor', S.captor, true], ['the door man, inside', S.doorMan.inside, true], ['the door man, outside', S.doorMan.outside, false], ...(S.guards ?? []).map((r, i): [string, typeof r, boolean] => [`room guard ${i + 1}`, r, true]), ...S.roamers.map((r, i): [string, typeof r, boolean] => [`roamer ${i + 1}`, r, false])] as [string, { pos: Vec3; aimAt: Vec3 }, boolean][]) {
    if (!free(what, m.pos)) continue;
    if (B && inside !== inBounds(m.pos, B)) bad.push(`${what} (${m.pos[0]}, ${m.pos[2]}): ${inside ? 'outside' : 'inside'} the hostage room`);
    if (what !== 'the door man, outside') line(what, m);
    if (samOk && !way(S.team.sam, m.pos)) bad.push(`${what}: no way on foot from the team's start`);
  }
  if (S.side) {
    if (!g.doors.byName(S.side.door)) bad.push(`no door '${S.side.door}' in the level (the side door)`);
    if (S.side.from && !g.doors.byName(S.side.from.door)) bad.push(`no door '${S.side.from.door}' in the level (the room the side door is taken from)`);
    for (const [k, list] of [['stack', S.side.stack], ['standoff', S.side.standoff]] as [string, Vec3[] | undefined][]) (list ?? []).forEach((p, i) => { free(`side door ${k} mark ${i + 1}`, p); });
  }
  if (S.flow) {
    for (const o of S.flow.route) if (!S.flow.regions.some(r => r.id === o.region)) bad.push(`route opening '${o.id}': no region '${o.region}'`);
    const was = R.flow.check(); for (const w of was) bad.push(`route — ${w}`);
  }
  return bad;
}

export type RescueState = 'off' | 'staged' | 'running' | 'secured' | 'rescued' | 'lost';
export type RescueStep = 'waiting' | 'shouting' | 'counting' | 'about to' | 'stopped';
type Role = 'captor' | 'door' | 'guard' | 'roamer';
/** F's entry on the hostage room: the door tools' orders it gave (one a door: `ops`, what of each one's beats the log has had), the gate they go through, the men
 *  it took, whether it is a split (two doors, or one man alone), and when everybody was stacked / the gate opened / the first man was sent in */
interface Entry { ops: { op: DoorOp; side: boolean; seen: number; kicked: boolean; ended: string | null }[]; gate: DoorGate; men: Guard[]; split: boolean; setT: number; goT: number; inT: number }
/** `crew` (Hard's rescue crew — RESCUE.crewDoor): '' not on it (yet) · 'going' the door man on his way in · 'in' inside · 'cross' a man with his gun on the floor
 *  outside the hostage door (`look`) · 'wait' a roamer out of sight until the door goes (`noise0` = the last loud thing the team had done when he hid) · 'out' off it */
interface Def { role: Role; inRoom: boolean; mark: { pos: Vec3; aimAt: Vec3 }; learned: number; set: boolean; sawFoe: boolean; released: boolean; burst: BlindBurst; k: number; crew: '' | 'going' | 'in' | 'cross' | 'wait' | 'out'; look: Vec3 | null; spot: Vec3 | null; noise0: Vec3 | null }
/** Hard's crew: a crossfire spot may be seen from this many points of the way in (one every 1.5 m, its last 4 m aside) and no more */
const CREW_SEEN = 4;
type FDef = Game['fight']['defs'][number];

export class Rescue {
  active = false;
  /** the knobs above, on the instance for the console (__rescue.knobs.resolveSecs = 60; __rescue.restage()) */
  readonly knobs = RESCUE;
  ops: Guard[] = []; hostiles: Guard[] = []; hostages: Guard[] = [];
  /** the level's clear plan for the hostage room's corridor door (its `bounds` are the room) */
  plan: RoomClearPlan | null = null;
  /** F's entry on the hostage room while it is under way (null: none — the pair are the order menu's, or standing as they were staged) */
  entry: Entry | null = null;
  /** how many times it has been staged since start() */
  staged = 0;
  /** what happened when, on the game clock ('staged', 'clock', 'order:…', 'learned:<name>', 'set:<name>', 'caught:<name>' (seen his first of the team while unset), 'step:…', 'act', 'executed:<name>', 'teamfire:<name>',
   *  F's entry as the door tools' beats tell it — 'split:front=…,side=…', 'stacked', 'split:set', 'split:go', 'kick', 'door-flung', 'toss', 'bang' / 'nobang', 'enter1' (the side
   *  door's with ':side': 'stacked:side', 'door-flung:side', 'toss:side', 'bang:side', 'enter:side'), 'clear', 'drill:called-off', 'entry:<why it ended short>' —
   *  'act:broken' / 'act:blocked', 'secured', 'unsecured', 'rescued', 'lost:<why>') — what the probes read */
  log: { t: number; what: string }[] = [];
  /** clock one: 0 → 1; the seconds it was dealt at this staging; the game time it started (NaN = not yet) */
  resolve = 0; resolveSecs = 35; t0 = NaN;
  /** Sam's words on the hostage room so far (0 none · 1 stack · 2 go) */
  doorOrders = 0;
  /** blind rounds the set defenders have fired since the staging */
  blindRounds = 0;
  /** how it ended (null while it runs), and the line that says so */
  result: { state: 'rescued' | 'lost'; grade: 'clean' | 'costly' | 'failed'; why: string; hostages: number; team: number; secs: number } | null = null;
  private defs = new Map<Guard, Def>();
  private act: { by: Guard; victim: Guard; at: number; def: unknown; hold: boolean } | null = null;
  /** who held the clock last (a man who takes it over from another has to take the room in hand first: clock()) */
  private capBy: Guard | null = null;
  private executed = new Set<Guard>(); private counted = new Set<Guard>();
  private securedAt = NaN; private step: RescueStep = 'waiting'; private barkAt = 0;
  private noise: Vec3 | null = null; private heard = new SideSet<object>(); private lastOrder: object | null = null;
  /** Hard's crew: when the captor called the assault on their net (NaN = not yet; Infinity = nobody was left to call it) */
  private alarmAt = NaN; private way: Vec3[] | null = null;
  private benched: Guard[] | null = null; private said = new Set<string>();
  private cut = false; private failure: string | null = null;
  /** the hostages' voices (voices()): when the next low line is due, whose turn it is, when a teammate's word to them is due (NaN: none) */
  private murmurAt = 0; private murmurN = 0; private ackAt = NaN;
  /** dynamic tempo: the openings on the route, what is known of each, and the pair's unasked covers (rescueflow.ts) */
  readonly flow: RescueFlow;
  /** the room was called by F's last entry (F does nothing more until one of theirs is back in it) */
  private called = false;
  private searchT = new Map<Guard, number>(); private searchA = new Map<Guard, { A: Assignment; face: number | null; watch: Vec3 | null; there: string }>();
  /** the assignments the scenario itself gave (post()): such a man is as free for F as one falling in */
  private auto = new SideSet<object>();
  /** the corridor just outside the server room's door (roundBy) */
  private serverOut: Vec3 | null = null;
  /** how it is won (rescueend.ts: the hostages led out, or the floor cleared — RESCUEEND) · the men left alive coming for them (rescueflush.ts — RESCUEFLUSH) */
  readonly ending: RescueEnd; readonly flush: RescueFlush;
  constructor(private g: Game) { this.flow = new RescueFlow(g, this); this.ending = new RescueEnd(g, this); this.flush = new RescueFlush(g, this); }

  /** what the scenario takes from the level it stands on (Level.scenarios.rescue; null = the level has none, and it cannot start) */
  get data(): RescueData | null { return this.g.level.scenarios?.rescue ?? null; }
  /** the hostage room's floor inside its walls: the data's own bounds, else the level's clear plan's for the room's door */
  get bounds(): Rect | undefined { const S = this.data; return S?.room.bounds ?? (this.plan ?? this.g.level.clearPlans?.find(p => p.door === S?.room.door))?.bounds; }
  /** the room the side door is taken from (the office: the server room), where the data names one */
  private get fromBounds(): Rect | undefined { const f = this.data?.side?.from; return f ? f.bounds ?? this.g.level.clearPlans?.find(p => p.door === f.door)?.bounds : undefined; }
  /** `dist` out of a door's frame on the side AWAY from a room (its floor rect): the floor point */
  private outOf(d: Door, room: Rect | undefined, dist: number): Vec3 {
    const th = d.def.closedDir, snap = (x: number) => Math.abs(x) < 1e-9 ? 0 : Math.abs(Math.abs(x) - 1) < 1e-9 ? Math.sign(x) : x;
    const s = room ? -sideOf(d, [(room.x0 + room.x1) / 2, 0, (room.z0 + room.z1) / 2]) : 1;
    return [d.frameCentre[0] + snap(-Math.sin(th)) * s * dist, 0, d.frameCentre[2] + snap(Math.cos(th)) * s * dist];
  }
  /** the floor just outside the hostage room's main door · the point its first man in keeps his gun on once the room is called */
  private roomPoint(which: 'outside' | 'hold'): Vec3 {
    const S = this.data!, given = S.room[which]; if (given) return v3.copy(given);
    const d = this.g.doors.byName(S.room.door), A = S.room.doorAim, k = which === 'outside' ? 1 : 0.4;
    if (!d) return [A[0], 0, A[2]];
    const o = this.outOf(d, this.bounds, k); return [A[0] + (o[0] - d.frameCentre[0]), 0, A[2] + (o[2] - d.frameCentre[2])];
  }

  /** why it cannot start right now (null = it can) */
  canStart(): string | null {
    const g = this.g, S = this.data;
    if (g.quiet?.active) return 'a quiet mission is up on this floor (quit it first)';   // (quiet.ts refuses the other way round: one scenario a floor)
    if (!S) return 'this level has no hostage rescue data (its scenarios.rescue block)';
    if ((S.team.ops?.length ?? 0) < 2) return 'this level\'s rescue block has no start marks for the pair (team.ops needs two)';   // (start() reads both)
    if (!this.bounds) return `this level has no clear plan for the '${S.room.door}' door`;
    if (!g.doors.byName(S.room.door)) return `the door '${S.room.door}' is not in the level`;
    if (!g.tune.teams) return 'sides are switched off (tune.teams)';
    if (!g.aiEnabled) return 'the AI is switched off (sandbox: no AI) — nobody would move';
    if (g.director?.staging && g.director.run) return `the level script's program '${g.director.run.name}' is running`;
    if (g.touring || g.quietUtility || g.puppet) return 'a show is running';
    if (g.nightBreach?.active) return g.roomClear?.active ? 'the room clear is staged' : 'the night breach is staged';
    if (g.guards.some(x => x.unit)) return 'a spawned unit is already on the floor';
    return null;
  }
  /** Start it: the floor cleared of everybody but the cast, a fresh encounter, the cast on its marks. Returns the reason when refused (or when the staging itself
   *  failed — then everything is put back as stop() puts it). */
  start(): string | null {
    if (this.active) return null;
    const why = this.canStart(); if (why) return why;
    { const T = this.data!.team; if (T !== applied) { applied = T; RESCUE.samAt = [...T.sam] as Vec3; RESCUE.samYaw = T.samYaw; RESCUE.opsAt = [[...T.ops![0]] as Vec3, [...T.ops![1]] as Vec3]; } }   // (once per team start: a knob moved by hand since stays moved)
    this.bench();
    this.active = true; this.staged = 0; this.log.length = 0; this.failure = null;
    this.g.restartEncounter();   // (the benched shift is off the list and spawnCivilians stands nobody while this is up: the fresh floor is empty) → onEncounterRestart stages
    return this.active ? null : (this.failure ?? 'the staging failed');
  }
  /** Stop it: the cast gone, the shift and the building's own civilians back, a fresh night encounter. */
  stop() {
    if (!this.active) return;
    const g = this.g;
    this.active = false;
    this.clearCast();
    if (this.benched) { for (const gd of this.benched) if (!g.engine.lights.lights.includes(gd.flashlight)) g.engine.lights.add(gd.flashlight); g.guards = [...this.benched, ...g.guards]; this.benched = null; }
    g.restartEncounter();
    g.msg(w(g.level.routes.length ? 'hostage rescue off — the night shift is back' : 'hostage rescue off', 'hostage rescue off — the night shift is back'));   // (a level with nobody on a route has no shift to come back)
  }
  /** Stage it afresh (the knobs re-read): a restart of the encounter, which stages. */
  restage() { if (this.active) this.g.restartEncounter(); }
  /** restartEncounter's last act (game.ts): the scenario, while it is up, stages itself on the fresh encounter; a staging that throws ends it cleanly. */
  onEncounterRestart() {
    if (!this.active) return;
    try { this.stage(); }
    catch (e) { this.failure = `the staging failed: ${e instanceof Error ? e.message : String(e)}`; console.error('hostage rescue:', e); this.stop(); this.g.msg(`hostage rescue — ${this.failure}`); }
  }
  /** who has the pair: 'door' = F's entry on the hostage room is under way (the dynamic tempo stands aside — rescueflow.ts), 'free' otherwise. The men are the
   *  order menu's either way. */
  get mode(): 'free' | 'door' { return this.entry ? 'door' : 'free'; }
  /** F's entry has this man right now: he is on one of its door orders (the flow leaves him be; the menu does not ask — any order takes him) */
  owns(gd: Guard): boolean { const E = this.entry; return this.active && !!E && E.ops.some(e => e.ended === null && e.op.men.includes(gd)); }
  /** Call F's entry off (the console's; a menu order does it man by man): its men stop where they are, as the menu's. Always null — nothing is committed. */
  callOff(): string | null {
    const E = this.entry; if (!this.active || !E) return null;
    for (const o of E.men) if (o.state !== 'dead' && this.owns(o)) this.post(o);   // (off the door order: it ends itself, and a can it held goes back in the bag — doortools.ts)
    this.note('drill:called-off'); this.endEntry(false);
    return null;
  }
  /** is this civilian one of the scenario's hostages (player.ts: no grab row on her) */
  isHostage(gd: Guard): boolean { return this.active && this.hostages.includes(gd); }

  private bench() {
    const g = this.g; const staff = g.guards.filter(x => !x.unit); if (!staff.length) return;
    for (const gd of staff) { gd.flashlight.enabled = false; g.engine.lights.remove(gd.flashlight); }
    this.benched = [...(this.benched ?? []), ...staff]; g.guards = g.guards.filter(x => !!x.unit);
  }
  private clearCast() {
    const g = this.g;
    for (const gd of [...this.ops, ...this.hostiles]) { if (gd.script) endGuardScript(gd, 'patrol'); despawnUnit(g, gd); }
    g.civilians = g.civilians.filter(c => !this.hostages.includes(c));
    this.ops = []; this.hostiles = []; this.hostages = []; this.entry = null; this.defs.clear(); this.act = null;
    this.searchT.clear(); this.searchA.clear(); this.flow.reset(); this.ending.reset(); this.flush.reset(); this.marks(false);
  }
  /** the scenario's own additions to the squad's door work, for as long as it is up: the side door's marks from the server room (SIDE_MARKS → orders.ts
   *  doorMarks) and the room's two doors linked on the charge trigger (doortools.ts linked) */
  private marks(on: boolean) {
    const g = this.g, S = this.data, side = S?.side, fd = S ? g.doors.byName(S.room.door) : undefined, sd = side ? g.doors.byName(side.door) : undefined, M = g.orders.doorMarks;
    for (let i = M.length - 1; i >= 0; i--) if (sd && M[i].door === sd) M.splice(i, 1);
    g.doorTools.linked = g.doorTools.linked.filter(d => d !== fd && d !== sd); g.doorTools.lights = null;
    if (!on) return;
    if (sd && side?.stack?.length) M.push({ door: sd, side: this.faceOf(sd), stack: side.stack, standoff: side.standoff ?? side.stack });
    g.doorTools.linked.push(...[fd, sd].filter((d): d is Door => !!d));
  }
  /** the face of one of the room's doors that is NOT the room's (orders.ts sideOf's sign): the side the team comes at it from */
  private faceOf(d: Door): 1 | -1 { const B = this.bounds; return B ? (-sideOf(d, [(B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2]) as 1 | -1) : 1; }

  /** Everybody on his mark on the fresh encounter restartEncounter has just made (no unit standing, no civilian, the level as authored, Sam at the spawn). */
  private stage() {
    const g = this.g, K = RESCUE, S = this.data; if (!S) throw new Error('the level has no hostage rescue data');
    const MARKS = { hostages: S.hostages, captor: S.captor, doorIn: S.doorMan.inside, doorOut: S.doorMan.outside, roamers: S.roamers };
    this.ops = []; this.hostiles = []; this.hostages = []; this.entry = null; this.defs.clear();
    this.called = false; this.searchT.clear(); this.searchA.clear(); this.flow.reset(); this.ending.reset(); this.flush.reset();
    this.plan = g.level.clearPlans?.find(p => p.door === S.room.door) ?? null; this.marks(true);
    { const sv = S.side?.from ? g.doors.byName(S.side.from.door) : undefined; this.serverOut = sv ? this.outOf(sv, this.fromBounds, 1.0) : null; }
    g.fight.reset(); g.fight.blindFire = K.blindFire;   // (the room fight starts clean on the new cast)
    if (K.roomLights && S.room.lights) g.setGroup(S.room.lights, true);
    const d = g.doors.byName(S.room.door)!; d.reset(); d.angle = 0; d.vel = 0; d.latched = true; d.closing = false;   // the hostage room's door shut on its latch (the night leaves it ajar)
    const side = S.side ? g.doors.byName(S.side.door) : undefined; if (side) { side.reset(); side.angle = 0; side.vel = 0; side.latched = true; side.closing = false; side.locked = false; }   // the side door from the server room: shut, and for the scenario not locked — the flank that has to be earned through the server room's own locked door
    // the opposition: captor, door man, roamers — put down to hold their marks, calm, until their own ears and eyes say otherwise (held hostile units: the room
    // fight's defenders from the first frame — what each watches, fears and does about it is his own; this keeps his set clock)
    const cast: { role: Role; inRoom: boolean; mark: { pos: Vec3; aimAt: Vec3 }; name: string }[] = [{ role: 'captor', inRoom: true, mark: MARKS.captor, name: 'Captor' }];
    cast.push(K.doorMan === 'inside' ? { role: 'door', inRoom: true, mark: MARKS.doorIn, name: 'Door man' } : { role: 'door', inRoom: false, mark: MARKS.doorOut, name: 'Door man' });
    (S.guards ?? []).forEach((m, i) => cast.push({ role: 'guard', inRoom: true, mark: m, name: `Room guard ${i + 1}` }));   // (the level's own: more guns that never leave the room — in no crew, not the door man)
    if (S.cast) {   // THE LEVEL'S OWN CAST: so many of its roamer marks manned, which ones drawn here (a partial shuffle off the staging's dice — no room is known empty)
      const idx = MARKS.roamers.map((_, i) => i), n = Math.max(0, Math.min(idx.length, Math.round(S.cast.roamers)));
      if (K.seedRoamers) for (let i = 0; i < n; i++) { const j = i + Math.floor(simRandom() * (idx.length - i)); if (!SAMESTART.on) [idx[i], idx[j]] = [idx[j], idx[i]]; }   // (seedRoamers off, or samestart.ts on: the first n marks, as written — the die is drawn either way, here and twice below, so a run with the switch on rolls the same stream as the run with it off)
      idx.slice(0, n).sort((a, b) => a - b).forEach((m, i) => cast.push({ role: 'roamer', inRoom: false, mark: MARKS.roamers[m], name: `Roamer ${i + 1}` }));
    } else {
    const swap = K.seedRoamers && simRandom() < 0.5 && !SAMESTART.on ? 1 : 0;   // (a staging-time draw, like the clock's length below)
    for (let i = 0; i < Math.max(0, Math.min(MARKS.roamers.length, Math.round(K.roamers))); i++) cast.push({ role: 'roamer', inRoom: false, mark: MARKS.roamers[(i + swap) % MARKS.roamers.length], name: `Roamer ${i + 1}` });
    }
    cast.forEach((c, k) => {
      const gd = spawnUnit(g, { team: 'hostile', pos: c.mark.pos, yaw: v3.yawTo(c.mark.pos, c.mark.aimAt), name: c.name, light: K.defLights, budget: 1 + cast.length });   // (a level's own cast may be more than the eight the shadow capsules hold: this many, Sam and them)
      gd.hold = true; gd.pinned = true; this.hostiles.push(gd);
      this.defs.set(gd, { role: c.role, inRoom: c.inRoom, mark: c.mark, learned: NaN, set: false, sawFoe: false, released: false, burst: { until: -1, n: 0, next: 0 }, k, crew: '', look: null, spot: null, noise0: null });
    });
    gunDeal(g, this.hostiles.map((gd, k) => ({ gd, watch: cast[k].mark.aimAt, hostage: cast[k].role === 'captor' })));   // (gunroles.ts: the cast's guns off the table — nobody is touched and no die is drawn with its switch off)
    const capSet = K.start === 'hot' && K.captorSet; if (capSet) this.defs.get(this.hostiles[0])!.set = true;
    // the team at the lobby arch: the pair calm where they stand until an order moves them, Sam with the rifle in his hands
    const yaw = S.team.opsYaw ?? Math.PI / 2, at: Vec3[] = [K.opsAt[0], K.opsAt[1]];
    for (let i = 2; i < K.squad; i++) at.push(S.team.ops?.[i] ? v3.copy(S.team.ops[i]) : g.nightBreach.standBy(at[i - 2], [...at, K.samAt], yaw));   // (the loadout's third and fourth: the level's own marks where it has them, else a stride behind the pair's)
    for (let i = 0; i < K.squad; i++) {
      const m = K.squad > 2 ? SQUAD4[i] : null;   // (up to two: the pair as ever, in no pair of the order menu's — three or four: the four-man squad's roster and colours)
      const gd = spawnUnit(g, m ? { team: 'operative', pos: at[i], yaw, name: m.name, light: false, pair: m.pair, tint: m.tint, tint2: m.tint2, budget: Math.max(SQUAD4_BUDGET, 2 + g.guards.length) } : { team: 'operative', pos: at[i], yaw, name: i === 0 ? 'Blue One' : 'Blue Two', light: false, budget: 2 + g.guards.length });
      gd.hold = true; gd.pinned = true; gd.trained = K.trained; this.ops.push(gd);
    }
    // the hostages: the building's own two civilians' names and clothes when the level has them
    const defs = g.level.civilians ?? [];
    MARKS.hostages.forEach((m, i) => {
      const cd = defs[i];
      this.hostages.push(spawnHostage(g, { name: cd?.name ?? (['Marta', 'Owen', 'Ines'][i] ?? `Hostage ${i + 1}`), kind: cd?.kind ?? (i === 0 ? 'cleaner' : 'worker'), tint: cd?.tint ?? (i === 0 ? [0.3, 0.42, 0.5] : i === 1 ? [0.5, 0.48, 0.42] : [0.46, 0.33, 0.36]), tint2: cd?.tint2, pos: m.pos, face: m.face }));
    });
    this.resolve = 0; this.resolveSecs = Math.max(5, K.resolveSecs + (simRandom() * 2 - 1) * (SAMESTART.on ? 0 : K.resolveSpread)); this.t0 = NaN;   // (samestart.ts on: the clock is the knob's to the second; else a staging-time draw, as every Guard's construction draws: nothing is drawn while it runs)
    this.doorOrders = 0; this.blindRounds = 0; this.result = null;
    this.act = null; this.capBy = null; this.executed.clear(); this.counted.clear(); this.securedAt = NaN; this.step = 'waiting'; this.barkAt = 0; this.noise = null; this.alarmAt = NaN; this.way = null; this.lastOrder = g.orders.log[g.orders.log.length - 1] ?? null;
    const pl = g.player;
    g.teleportPlayer(v3.copy(K.samAt)); pl.char.bodyYaw = pl.char.aimYaw = K.samYaw;
    if (pl.hasRifle) pl.slot = 'rifle'; pl.holstered = false;
    this.staged++; this.said.clear(); this.cut = true; this.murmurAt = g.time + 4; this.murmurN = 0; this.ackAt = NaN;
    kitStage(g, this.ops);   // each member's kit and uniform (kit.ts): nothing written on a teammate while every card is as issued (your own four counts are, under the pouches rule: kitPlayer)
    this.note('staged'); if (capSet) this.note(`set:${this.hostiles[0].callsign}`);
    const who = `${NUMBER[S.hostages.length] ?? S.hostages.length} hostage${S.hostages.length === 1 ? '' : 's'} in the ${this.place()}`;
    const n = this.ops.length, fall = n > 2 ? ', and the squad fall in' : n === 2 ? ', and the pair fall in' : n ? ', and your man falls in' : '';   // (the loadout's size — two: the line as it always read)
    g.msg(K.start === 'hot'
      ? `hostage rescue — shots heard inside. ${who}. the clock starts when you move${fall}. ${n ? 'F: bang and clear · X: orders (door tools on any door)' : 'You are alone'}`
      : `hostage rescue — ${who}. nobody knows you are here yet. ${n ? 'F: stack up, F: go · X: orders' : 'You are alone'}`);
  }
  /** the hostage room in words: its name and where it is ("manager's office, far end of the corridor") */
  private place(): string { const R = this.data?.room; return R ? `${R.name}${R.where ? `, ${R.where}` : ''}` : 'hostage room'; }
  note(what: string) { this.log.push({ t: this.g.time, what }); if (this.log.length > 600) this.log.splice(0, 150); }
  private once(key: string, text: string) { if (!this.said.has(key)) { this.said.add(key); this.g.msg(text); } }
  private get over(): boolean { return this.result !== null; }
  /** dynamic tempo: the clock is running (the team stops waiting for the word door by door) */
  get dynamic(): boolean { return !isNaN(this.t0); }

  /** What F does, for a caller that is not the key (the panel's button, the console): a charge set on a door has the press — it blows — else it is Sam's word
   *  on the hostage room. */
  press(): 'blow' | 'stack' | 'go' | 'bang' | null {
    const DT = this.g.doorTools; if (!this.active || this.g.player.down) return null;
    DT.sync();   // (a staging this frame: last run's charges are not this one's)
    if (DT.set.length) { DT.trigger(); return 'blow'; }
    return this.orderDoor();
  }
  /** Sam's word on the hostage room (F — a charge set on a door has had the press before this is asked: doortools.ts). The clock running: one press is bang and
   *  clear — stack, and go the moment they are set. Before it (quiet start): the first press stacks them, the second sends them in. Returns what the press did. */
  orderDoor(): 'stack' | 'go' | 'bang' | null {
    const g = this.g, DT = g.doorTools;
    if (!this.active || this.over || g.player.down) return null;
    DT.sync();
    const hot = RESCUE.start === 'hot', E = this.entry;
    if (E) {   // under way: the one thing left to say is the second word, to men stacked and holding for it
      if (E.gate.go) return null;
      E.gate.go = true; this.doorOrders = 2;
      this.note('order:go'); g.msg('you: go');
      return 'go';
    }
    if (this.called) { if (!this.captor()) return null; this.called = false; }   // the room is theirs already — unless one of theirs has come back into it: then the order stands again
    const S = this.data; if (!S) return null;
    const fd = g.doors.byName(S.room.door), sd = (S.side ? g.doors.byName(S.side.door) : null) ?? null; if (!fd) return null;
    const on = DT.ops.filter(o => o.door === fd || o.door === sd), ch = on.find(o => o.kind === 'charge');   // the menu already has men at work on one of the room's doors: F does not take them off it
    if (ch && (DT.chargeOn(ch.door) || ch.phase === 'place')) { g.msg(DT.chargeOn(ch.door) ? 'the charge is set — F blows it' : 'the charge is not set yet'); return null; }   // (a charge already blown: its men are going in — the next line's answer)
    if (on.some(o => o.kind !== 'outside')) { g.msg('they are on that door already'); return null; }
    const who = this.pick(); if (!who) { g.msg(!this.ops.length ? 'you are alone — the hostage room is yours to take' : 'nobody free for the hostage room — whoever is up is covering where you put him (X: fall in)'); return null; }
    const dyn = this.dynamic || hot;   // (a hot start's first order starts the clock itself)
    const two = this.launch(fd, sd, who.front, who.side, dyn); if (two === null) return null;
    const did: 'stack' | 'bang' = dyn ? 'bang' : 'stack';
    this.doorOrders = dyn ? 2 : 1;
    if (hot) this.startClock('order');   // (after the men are spoken for: nobody falls in unasked)
    this.note(`order:${did}`); g.msg(did === 'bang' ? `you: ${this.entry?.ops.some(e => e.op.kind === 'bangClear') ? 'bang' : 'open'} and clear — hostage room${two}` : `you: stack up — hostage room${two}`);
    return did;
  }
  /** Who F takes, and to which door (null: nobody is free). A man Sam has put on a 'cover' of his own stays on it — unless he stands in the server room, where
   *  any man Sam has posted is the side door's; with nobody posted there and Sam himself in it with both men, the man nearer the side door takes it. */
  private pick(): { front: Guard[]; side: Guard[] } | null {
    const g = this.g, O = g.orders, up = this.ops.filter(o => o.state !== 'dead'); if (!up.length) return null; if (!RESCUE.twoDoor) return { front: up, side: [] };   // (the switch off: F takes whoever is up, as it always did)
    const posted = (o: Guard) => { const A = O.of(o); return !!A && A.post !== null && !this.auto.has(A) && !this.flow.gave(A); };   // Sam put him there himself
    const sd = this.data?.side ? g.doors.byName(this.data.side.door) : undefined, SB = this.fromBounds;
    const side: Guard[] = [];
    if (sd && SB && this.bounds) {
      const near = (l: Guard[]) => l.filter(o => inBounds(o.char.pos, SB)).sort((a, b) => flat(a.char.pos, sd.frameCentre) - flat(b.char.pos, sd.frameCentre))[0] ?? null;
      let first = near(up.filter(posted));
      if (!first && inBounds(g.player.char.pos, SB)) { const free = up.filter(o => !posted(o)); if (free.length >= 2) first = near(free); }
      if (first) { side.push(first);
        // a level laid out for four (side.pair) and RESCUE.sidePair: his pair mate in the same room goes through the side door behind him — a pair on each door —
        // as long as that leaves somebody for the main door (a pair alone in there still splits one and one, as ever)
        const pr = first.unit?.pair, mate = RESCUE.sidePair && this.data?.side?.pair && pr ? up.find(o => o !== first && o.unit?.pair === pr && inBounds(o.char.pos, SB)) : undefined;
        if (mate && up.some(o => o !== first && o !== mate && !(posted(o) && O.of(o)!.order === 'cover'))) side.push(mate); }
    }
    const front = up.filter(o => !side.includes(o) && !(posted(o) && O.of(o)!.order === 'cover'));
    return front.length || side.length ? { front, side } : null;
  }
  /** F's entry, given: the door tools' own order on the corridor door for `front` and on the side door for `side` (doortools.ts order — bang and clear while the
   *  squad has a can and RESCUE.stun is on, open and clear otherwise), through one gate; `go` false = they stack and hold for the second word. Returns the
   *  words for which doors (null: no order could be given, and why has been said). */
  private launch(fd: Door, sd: Door | null, front: Guard[], side: Guard[], go: boolean): string | null {
    const g = this.g, DT = g.doorTools;
    const gate = DT.together(go), ops: Entry['ops'] = [], why: string[] = [];
    const give = (who: Guard[], d: Door, isSide: boolean) => {
      const op = DT.order(RESCUE.stun && DT.bangs > 0 ? 'bangClear' : 'openClear', who, d, this.faceOf(d), gate);
      if (typeof op === 'string') { why.push(`${isSide ? 'side door' : WORDS.on && !isOffice(g.level) ? 'main door' : 'corridor door'} — ${op}`); return; }
      this.flow.release(op.men);   // (theirs no longer: the flow's jobs on them end where they stand)
      ops.push({ op, side: isSide, seen: 0, kicked: false, ended: null });
      for (const o of op.men) this.roundBy(o);
    };
    if (front.length) give(front, fd, false);   // (the corridor door first: with one can left it is that door's, and the side door's man goes in behind it — doortools.ts)
    if (side.length && sd) give(side, sd, true);
    if (why.length || !ops.length) g.msg(`the hostage room: ${why.join(' · ') || 'nobody to take it'}`);
    if (!ops.length) return null;
    const cans = ops.filter(e => e.op.kind === 'bangClear').length;
    if (RESCUE.stun && cans < ops.length) g.msg(cans ? `one bang left — it goes in by the ${ops.find(e => e.op.kind === 'bangClear')!.side ? 'side' : isOffice(g.level) ? 'corridor' : 'main'} door, the other door goes in behind it` : 'no bangs left — they go in without one');
    const taken = ops.flatMap(e => e.op.men), split = !!this.bounds && RESCUE.twoDoor && (ops.some(e => e.side) || taken.length === 1);
    this.entry = { ops, gate, men: taken, split, setT: NaN, goT: NaN, inT: NaN }; this.said.delete('set');
    if (split) this.note(`split:${ops.map(e => `${e.side ? 'side' : 'front'}=${e.op.men.map(m => m.callsign).join('+')}`).join(',')}`);
    return ops.length > 1 ? ' · both doors' : ops[0].side ? ' · side door' : '';
  }
  private startClock(why: string) {
    if (!isNaN(this.t0)) return;
    const g = this.g;
    this.t0 = g.time; this.note(`clock:${why}`);
    // dynamic tempo: nobody had to say it — where Sam goes now, the pair flows (unless he has already given them something to do)
    const up = this.ops.filter(o => o.state !== 'dead');
    if (this.mode === 'free' && up.length) { const p = g.player.char.pos, idle = up.filter(o => !g.orders.has(o));   // (a first order to ONE man leaves the other at the arch otherwise)
      if (idle.length === up.length) g.orders.give('fallIn', { kind: 'none', at: [p[0], 0, p[2]] }, 'all');
      else for (const o of idle) g.orders.give('fallIn', { kind: 'none', at: [p[0], 0, p[2]] }, g.orders.squad().indexOf(o));
      if (idle.length) this.lastOrder = g.orders.log[g.orders.log.length - 1] ?? null; }
  }

  /** Once a frame from Game.update, after the door tools have had F for a set charge, after the night breach's and the room clear's ticks and before the door
   *  tools', the order menu's and the room fight's (so what F orders here is walked, posed and fought the same frame): a return on its first line while the
   *  scenario is off. */
  tick(dt: number, input: Input, cam: FollowCamera | null) {
    if (!this.active) return;
    const g = this.g;
    if ([...this.ops, ...this.hostiles].some(x => !g.guards.includes(x)) || this.hostages.some(h => !g.civilians.includes(h))) {   // the cast was taken off the floor under it by something short of a restart: a full restart, which stages
      g.restartEncounter(); if (!this.active) return;
    }
    if (this.cut && cam) { this.cut = false; cam.target = v3.copy(g.followPos()); cam.desired = v3.copy(cam.target); }
    this.tickEntry();   // (first: what the door tools did last frame goes into the log at its own time, ahead of what this frame makes of it)
    if (input.hit('KeyF')) this.orderDoor();
    this.hear();
    this.defenders();
    this.flush.tick();   // (rescueflush.ts: the room fallen and the team loud — the men left alive are sent for the hostages; a return on its first line with its switch off)
    this.flow.tick();
    this.search();
    g.doorTools.lights = RESCUE.opLights;
    for (const o of this.ops) if (o.unit) o.unit.light = this.dynamic && RESCUE.opLights;   // weapon lights once the clock runs (guards.ts attachFlashlight reads the unit's own switch)
    this.clock(dt);
    this.ending.tick();   // (rescueend.ts: this frame's word to the hostages — a return on its first line with its switch off)
    this.outcome();
    this.voices();
  }

  /** this frame's loud things: the last one the TEAM did is where a roamer goes; in a hot start Sam's first move or shot starts the clock */
  private hear() {
    const g = this.g, pl = g.player; const mine = new Set<number>([pl.char.id, ...this.ops.map(o => o.char.id)]);
    for (const e of g.events) {
      if (this.heard.has(e)) continue; this.heard.add(e);   // (each event once: this runs before the frame's own events are pushed, so 'this frame' is no test)
      const bang = e.kind === 'bang' && !(e.frag && !mine.has(e.who ?? -1));   // (a stun charge's event carries neither a level nor a thrower — and here only the team carries charges; a defender's own grenade, frag.ts, is not the team's noise)
      if (!bang && ((e.level ?? 0) < 1 || !mine.has(e.who ?? -1))) continue;
      if (bang || e.kind === 'shot' || e.kind === 'guardShot' || e.kind === 'kick') { this.noise = [e.pos[0], 0, e.pos[2]]; if (RESCUE.start === 'hot') this.startClock('noise'); }
    }
    const O = g.orders.log[g.orders.log.length - 1] ?? null;   // one of Sam's menu orders since the staging (orders.ts): an order like F's
    if (O !== this.lastOrder) { this.lastOrder = O; if (O && RESCUE.start === 'hot') this.startClock('order'); }
    if (RESCUE.start === 'hot' && isNaN(this.t0) && flat(pl.char.pos, RESCUE.samAt) > 0.6) this.startClock('move');
  }

  /** CLOCK TWO: who has learned, who is set, the late reaction of a man caught before it, the roamers let go. With the room fight on (roomfight.ts, the default)
   *  each man's watch, his blind burst and whether he stays are his own — all this adds is that an UNSET man's burst is spent before it starts (he stands and
   *  stares); with it off, the leash and the burst are this module's, as on the night breach's branch. */
  private defenders() {
    const g = this.g, K = RESCUE, own = g.fight.on;
    g.fight.blindFire = K.blindFire;
    const hard = own && this.crewOn;   // Hard's rescue crew (crew() below)
    if (hard && isNaN(this.alarmAt) && !isNaN(this.t0) && g.time >= this.t0 + K.crewCallSecs) this.crewCall();
    for (const h of this.hostiles) {
      const D = this.defs.get(h)!; if (h.state === 'dead') continue;
      const acting = this.act?.by === h;
      if (hard && D.role !== 'captor' && isNaN(D.learned) && g.time >= this.alarmAt) { D.learned = g.time; this.note(`learned:${h.callsign}`); }   // the captor's word on the net: he knows it is on
      if (isNaN(D.learned) && (h.state !== 'patrol' || h.awareness >= 0.3) && !rescueCheckOwns(g, h)) {   // (rescuecheck.ts: a man walking to a silent mate's post has learned nothing of the team by it)
        D.learned = g.time; this.note(`learned:${h.callsign}`);
        if (K.start === 'quiet') this.startClock('heard');
      }
      if (!D.sawFoe && h.sawFoeThisFrame) { D.sawFoe = true; if (!D.set) { h.reactT = Math.max(h.reactT, K.unsetReact); this.note(`caught:${h.callsign}`); } }   // caught before he was set: the first of the team he SEES costs him the beat he needs to find his gun and his feet (hearing the fight down the corridor cost him nothing)
      if (!D.set && !isNaN(D.learned) && g.time >= D.learned + K.setSecs && g.time >= h.dazzledUntil && !h.held) { D.set = true; this.note(`set:${h.callsign}`); }
      const F = own ? g.fight.defs.find(d => d.gd === h) : undefined;   // the room fight's record of him while he holds a post of its own
      const crewed = hard && this.crew(h, D, F);   // (a roamer who is the crew's is not sent to the noise at set; the rest of this loop is his as any man's)
      if (D.role === 'roamer' && !crewed) {
        if (D.released) continue;
        if (F && F.mode === 'free') { D.released = true; this.note(`released:${h.callsign}`); continue; }   // his own ears sent him to the gunfire already (or off his post): he is the room fight's
        if (D.set) {   // set OFF: to the last loud thing the team did (else to the hostage room's door), on the fight AI's own legs from here on
          D.released = true; h.hold = false; h.pinned = false;
          if (F) { F.mode = 'free'; F.freeAt = g.time; F.rallyAt = NaN; }   // (the way the room fight's own rally lets a man go: he stays on its roster — its skill, its smoke — and holds again where he ends up)
          if (h.script) endGuardScript(h, 'alert');
          if (h.state !== 'alert' || !h.foe) { h.state = 'alert'; h.awareness = 1; h.reactT = 0; h.lastKnown = v3.copy(this.noise ?? this.roomPoint('outside')); resetChase(h); }
          this.note(`released:${h.callsign}`); continue;
        }
      }
      if (acting) continue;   // (the captor turning on a hostage is on the scenario's script for that second: clock())
      if (own) {
        if (F && D.inRoom) { F.rallyAt = Infinity; F.lostAt = g.time + 1; }   // the men with the hostages do not go to a fight next door and do not give the room up: they are the clock
        if (!D.set && F && g.time < h.dazzledUntil) F.burst.n = BLIND.rounds;   // caught unset by the flash: no burst — its turns are spent as they come due
        continue;
      }
      if (h.script) endGuardScript(h, h.state);
      h.hold = true; h.pinned = true;
      if (h.state === 'patrol' && h.awareness < 0.3) h.char.bodyYaw = v3.yawTo(h.char.pos, D.mark.aimAt);
      if (D.set && K.blindFire && g.aiEnabled && blindTurn(g, h, D.k, D.burst, D.mark.aimAt)) this.blindRounds++;
    }
    if (own) this.blindRounds = g.fight.blindRounds;
  }

  // ---------------------------------------------------------------- HARD'S RESCUE CREW (RESCUE.crewCross / crewDoor / crewBehind — defenders() comes here only while Hard is on)
  /** The captor's word on their net, `crewCallSecs` into his clock: from it his two men know the assault is on (defenders() starts their set clocks on it). The
   *  line is the player's first cue — it goes to the radio strip like every line on their net. Nobody left to call it, or to hear it: it is never called. */
  private crewCall() {
    const g = this.g;
    const cap = this.hostiles.find(h => this.defs.get(h)!.role === 'captor' && h.state !== 'dead' && !h.held);
    const mates = this.hostiles.filter(h => h.state !== 'dead' && this.defs.get(h)!.role !== 'captor');
    if (!cap || !mates.length || !this.crewWay(this.roomPoint('outside')).length) { this.alarmAt = Infinity; return; }   // (nor with no way in to hide from: the spots are picked against it)
    if (g.time < cap.dazzledUntil) return;   // (blind: the word waits for his eyes)
    this.alarmAt = g.time; this.note('crew:call');
    g.say(cap, isOffice(g.level) || !CUES.on ? 'they\'re here! get off the corridor — guns on my door!' : 'they\'re here! get out of the open — guns on my door!', true);   // (off the office the way in is no 'corridor': a line that names no place)
  }
  /** One of the captor's two men on the word, each saying what he does on the net as he does it (the cue):
   *  CROSS (crewCross) — he takes a spot with a line of fire to the floor outside the hostage door that the way in does not see until it is nearly there (a side
   *  room's doorway, not the corridor), and rests his gun on that floor: the stack is in a crossfire. No such spot within his reach:
   *  DOOR (crewDoor) — the door man goes in through the hostage room's door to the mark the level gives a second gun in there, and pulls it to behind him;
   *  BEHIND (crewBehind) — a roamer gets out of sight of the way in and waits.
   *  And a man on a cross or waiting, once the team's noise is AT the hostage door and nobody is in his sights, comes up behind it.
   *  Every move is the room fight's own 'move' (his senses stay his: a man of the team seen close stops him where he is, to fight from there).
   *  True = a roamer who is the crew's this frame: defenders() does not send him to the noise at set the way Standard does. */
  private crew(h: Guard, D: Def, F: FDef | undefined): boolean {
    const g = this.g, K = RESCUE;
    if (D.role === 'captor' || D.crew === 'out' || D.crew === 'in' || !F) return false;
    const P = this.roomPoint('outside');
    if (D.crew === '') {
      if (D.inRoom || D.released || F.mode === 'free') { D.crew = 'out'; return false; }
      if (!(g.time >= this.alarmAt + (D.role === 'roamer' ? 0.8 : 1.6))) return false;   // (his own beat after the word, the door man the last to move; NaN / Infinity: no word yet, or none coming)
      if (F.mode !== 'hold' || h.held || g.time < h.dazzledUntil || g.time - h.lastSeenT < 2) return false;   // one of the team in his sights (or on the move already): the word waits — he fights where he stands
      const one = this.hostiles.some(o => o !== h && o.state !== 'dead' && this.defs.get(o)!.crew === 'cross');   // one gun on the stack is the crossfire: the door man is then the second gun inside
      const x = K.crewCross && !(one && D.role === 'door') ? this.crewCrossSpot(h, P, D.role === 'door' ? 14 : 9) : null;
      if (x) {
        if (flat(x, h.char.pos) > 0.4) this.crewMove(h, F, x, null); else { h.state = 'alert'; h.awareness = Math.max(h.awareness, 0.92); }   // (staying put: roused, as a man the room fight plants is)
        D.crew = 'cross'; D.look = P; D.spot = x; D.noise0 = this.noise; this.note(`crew:cross:${h.callsign}`);
        g.say(h, D.role === 'door' ? (isOffice(g.level) || !CUES.on ? w('off the corridor — I\'ve got your door from the side.', 'off the corridor — i\'ve got your door from the side.') : w('out of the open — I\'ve got your door from the side.', 'out of the open — i\'ve got your door from the side.')) : w('I can see your door from here — let them stack on it.', 'i can see your door from here — let them stack on it.'), true);   // (words.ts: 'I' as every other hostile line has it)
      } else if (D.role === 'door') {
        const S = this.data!, d = g.doors.byName(S.room.door), spot = S.doorMan.inside.pos, path = K.crewDoor && d ? g.col.nav.findPath(h.char.pos, spot) : null;
        if (!d || !path?.length || flat(path[path.length - 1], spot) > 0.8) { D.crew = 'out'; return false; }
        this.crewMove(h, F, spot, d); D.crew = 'going'; D.spot = v3.copy(spot); this.note(`crew:in:${h.callsign}`); g.say(h, w('coming in — I\'ve got the door.', 'coming in — i\'ve got the door.'), true);
      } else if (K.crewBehind) {
        const y = this.crewHide(h, F, P); if (y) this.crewMove(h, F, y, null); else { h.state = 'alert'; h.awareness = Math.max(h.awareness, 0.92); }
        D.crew = 'wait'; D.spot = y; D.noise0 = this.noise; this.note(`crew:wait:${h.callsign}`); g.say(h, w('staying dark — I\'ll come up behind them.', 'staying dark — i\'ll come up behind them.'), true);
      } else { D.crew = 'out'; return false; }
      return D.role === 'roamer';
    }
    if (D.crew === 'going') {
      const d = g.doors.byName(this.data!.room.door);
      if (d && !d.latched && !d.closing && inBounds(h.char.pos, this.bounds) && flat(h.char.pos, d.frameCentre) > 1.1 && flat(h.char.pos, d.frameCentre) < 3) g.doors.pullTo(d, h.char.id);   // just through it: he pulls the door to behind him (the team finds it shut, as on Standard)
      if (F.mode === 'move') return false;
      if (inBounds(h.char.pos, this.bounds)) { D.inRoom = true; D.crew = 'in'; this.note(`crew:inside:${h.callsign}`); }
      else { D.crew = 'out'; this.note(`crew:short:${h.callsign}`); }   // stopped short by a man of the team in his sights: he holds where the room fight planted him
      return false;
    }
    // on a cross, or waiting: not sent to the noise at set, not the room fight's to send to a fight next door
    if (D.released || F.mode === 'free') { D.released = true; D.crew = 'out'; return false; }
    if (D.crew === 'cross' && F.mode === 'hold' && D.spot && flat(h.char.pos, D.spot) > 1.2) { D.crew = 'out'; F.rallyAt = NaN; this.note(`crew:short:${h.callsign}`); return false; }   // stopped short of his spot, or moved off it since (the room fight's own fall-back): no line from here — he is Standard's man again
    F.rallyAt = Infinity;
    const N = this.noise, atDoor = N !== null && N !== D.noise0 && (flat(N, P) < 3 || inBounds(N, this.bounds));   // the last loud thing the team did is at the hostage door (the boot, the charge) or in the room
    if (K.crewBehind && atDoor && g.time - h.lastSeenT > 2.5 && !h.held && g.time >= h.dazzledUntil) {
      D.released = true; D.crew = 'out'; h.hold = false; h.pinned = false;
      F.mode = 'free'; F.freeAt = g.time; F.rallyAt = NaN;
      if (h.script) endGuardScript(h, 'alert');
      if (h.state !== 'alert' || !h.foe) { h.state = 'alert'; h.awareness = 1; h.reactT = 0; h.lastKnown = v3.copy(P); resetChase(h); }
      this.note(`crew:behind:${h.callsign}`); this.note(`released:${h.callsign}`); g.say(h, 'they\'re on the door — moving up behind!', true);
    }
    return D.role === 'roamer';
  }
  /** off his post on the room fight's 'move' (as its own fall-back and digin.ts's moves are): planted where he gets to, watching `by` if he came through it */
  private crewMove(h: Guard, F: FDef, goal: Vec3, by: Door | null) {
    F.mode = 'move'; F.moveKind = 'fallback'; F.cameBy = by; F.moveT = 0; F.stallAt = v3.copy(h.char.pos); F.stallT = 0; h.pinned = false;
    order(h, { goal: v3.copy(goal), speed: this.g.tune.guardChase + 0.3, face: null, strafe: false, aimAt: null, upper: 'aim', stance: 'none', crouch: false });
  }
  /** the way a man coming for the hostages walks — the team's start to the floor outside the hostage door `P` — as a point at eye height every metre and a half */
  private crewWay(P: Vec3): Vec3[] {
    if (this.way) return this.way;
    const out: Vec3[] = [], path = this.g.col.nav.findPath(RESCUE.samAt, P, 12000) ?? [];
    let q: Vec3 = RESCUE.samAt, t = 0;
    for (const w of path) { const L = flat(q, w); for (; t < L; t += 1.5) out.push([q[0] + (w[0] - q[0]) * t / L, 1.5, q[2] + (w[2] - q[2]) * t / L]); t -= L; q = w; }
    return this.way = out;
  }
  /** does a walk from `c` along `path` put a foot where `bad` says, asked every half metre of it (the path's own points are its corners only) */
  private crewLegs(c: Vec3, path: Vec3[], bad: (p: Vec3) => boolean): boolean {
    let q = c;
    for (const w of path) { const L = flat(q, w), n = Math.max(1, Math.ceil(L / 0.5)); for (let i = 1; i <= n; i++) if (bad([q[0] + (w[0] - q[0]) * i / n, 0, q[2] + (w[2] - q[2]) * i / n])) return true; q = w; }
    return false;
  }
  /** from how many of those points a man standing at `p` is seen (glass hides nobody); the last `nearM` of the way are not counted */
  private crewSeen(p: Vec3, P: Vec3, nearM: number): number {
    const col = this.g.col, e: Vec3 = [p[0], 1.5, p[2]]; let n = 0;
    for (const w of this.crewWay(P)) if (flat(w, P) > nearM && flat(w, p) < 25 && !col.segmentBlocked(w, e)) n++;
    return n;
  }
  /** A gun on the stack: floor in ANOTHER room than the one the hostage door opens onto (and not the hostage room), 5 to 14 m from `P`, with a clear line of
   *  FIRE to two of the places a stack stands along that wall (a pane or a shut leaf across it is no line: it is asked once, on the word). Where he stands, if
   *  it passes; else within `walk` of him, seen from at most CREW_SEEN points of the way in before its last four metres — the least seen first, then the
   *  nearest — and not another man's spot. Null = there is none he can walk to */
  private crewCrossSpot(h: Guard, P: Vec3, walk: number): Vec3 | null {
    const g = this.g, col = g.col, nav = col.nav, c = h.char.pos, B = this.bounds;
    const dr = g.doors.byName(this.data!.room.door), th = dr ? dr.def.closedDir : 0, ux = Math.cos(th), uz = Math.sin(th), out = g.fight.roomAt(P);
    const T: Vec3[] = [-2.4, -1.2, 0, 1.2, 2.4].map((k): Vec3 => [P[0] + ux * k, 1.2, P[2] + uz * k]).filter(t => !nav.isBlocked(t[0], t[2]));   // where a stack stands: along the wall either side of the door
    const fires = (p: Vec3) => { const d = flat(p, P); if (d < 5 || d > 14 || g.fight.roomAt(p) === out) return false; let n = 0; for (const t of T) if (!col.shotBlocked([p[0], 1.5, p[2]], t)) n++; return n >= 2; };
    const taken: Vec3[] = []; for (const o of this.hostiles) if (o !== h && o.state !== 'dead') { taken.push(o.char.pos); const s = this.defs.get(o)!.spot; if (s) taken.push(s); }
    const cand: { p: Vec3; x: number; d: number }[] = [];
    if (fires(c)) return v3.copy(c);   // (where the level stood him already has it)
    const x0 = Math.floor((c[0] - walk) / nav.cell), x1 = Math.ceil((c[0] + walk) / nav.cell), z0 = Math.floor((c[2] - walk) / nav.cell), z1 = Math.ceil((c[2] + walk) / nav.cell);
    for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
      const p: Vec3 = [(ix + 0.5) * nav.cell, 0, (iz + 0.5) * nav.cell], d = flat(p, c);
      if (d < 0.5 || d > walk || nav.isBlocked(p[0], p[2]) || inBounds(p, B) || !fires(p) || taken.some(q => flat(q, p) < 1.5)) continue;
      cand.push({ p, x: this.crewSeen(p, P, 4), d });
    }
    cand.sort((a, b) => a.x - b.x || a.d - b.d);
    let tries = 0;
    for (const k of cand) {
      if (k.x > CREW_SEEN || tries++ >= 24) break;
      const path = nav.findPath(c, k.p); if (!path?.length || flat(path[path.length - 1], k.p) > 0.8) continue;
      let L = 0, q: Vec3 = c; for (const w of path) { L += flat(q, w); q = w; }
      if (L <= walk * 1.4 && !this.crewLegs(c, path, w => inBounds(w, B))) return k.p;
    }
    return null;
  }
  /** a roamer out of sight: the floor of his own room seen from the fewest places a man coming for the hostages looks in from — the way in, and just outside
   *  each of the room's doors. Null = where he stands is as good as it gets */
  private crewHide(h: Guard, F: FDef, P: Vec3): Vec3 | null {
    const g = this.g, col = g.col, nav = col.nav, room = F.room, c = h.char.pos;
    if (!room || room.cells.size > 900) return null;
    const inRoom = (p: Vec3) => room.cells.has(nav.idx(Math.floor(p[0] / nav.cell), Math.floor(p[2] / nav.cell)));
    const W: Vec3[] = []; for (const e of room.entries) for (const k of [1.6, 3.2]) W.push([e.at[0] + e.out[0] * k, 1.5, e.at[2] + e.out[1] * k]);
    const seen = (p: Vec3) => { let n = this.crewSeen(p, P, 0); for (const w of W) if (!col.segmentBlocked(w, [p[0], 1.5, p[2]])) n++; return n; };
    let best: Vec3 | null = null, bs = seen(c), bl = 8; if (bs === 0) return null;
    for (const ci of room.cells) {
      const p: Vec3 = [((ci % nav.W) + 0.5) * nav.cell, 0, (((ci / nav.W) | 0) + 0.5) * nav.cell], d = flat(p, c);
      if (nav.isBlocked(p[0], p[2]) || d > 8) continue;
      const n = seen(p); if (n > bs || n === bs && (!best || d >= bl)) continue;
      const path = nav.findPath(c, p); if (!path?.length || flat(path[path.length - 1], p) > 0.8 || this.crewLegs(c, path, w => !inRoom(w) && flat(w, p) > 0.8)) continue;
      bs = n; bl = d; best = p;
    }
    return best;
  }
  /** roomfight.ts applyWatch: a man with the stack in his line of fire rests his gun on the floor outside the hostage door (writes `pt` in place) */
  crewLook(gd: Guard, pt: Vec3) { const D = this.defs.get(gd); if (D && D.crew === 'cross' && D.look && this.crewOn) { pt[0] = D.look[0]; pt[2] = D.look[2]; } }
  /** cues.ts: a man of Hard's crew lying in wait — on his gun from a side room, or staying dark to come up behind — whose place the net must not give away */
  crewHides(gd: Guard): boolean { const D = this.defs.get(gd); return !!D && (D.crew === 'cross' || D.crew === 'wait') && this.crewOn; }
  /** Hard's rescue crew is on: Hard's own row (difficulty.ts HARD.rescueCrew → PRESSURE.rescueCrew) and one of its three rules */
  private get crewOn() { return PRESSURE.on && PRESSURE.rescueCrew && (RESCUE.crewDoor || RESCUE.crewCross || RESCUE.crewBehind); }

  /** A man F sends to the corridor door from inside the server room goes out the way he came in — by the server room's own door: the short way is the side door
   *  and the hostage room itself (the side door is unlocked for the scenario, and a leaf opens to anybody in uniform). His first leg is the corridor outside it
   *  (orders.ts walks its own way round only for a door locked against Sam). */
  private roundBy(op: Guard) {
    const A = this.g.orders.of(op), SB = this.fromBounds;
    if (!A || !A.post || A.via.length || !SB || !this.serverOut || !inBounds(op.char.pos, SB) || inBounds(A.post, SB)) return;
    A.via = [v3.copy(this.serverOut)]; A.goal = A.via[0];
  }
  /** A man the scenario lets go of where he stands: handed to the order menu as its 'cover' (gun up on `look` — default the way he faces — until Sam says
   *  otherwise; the room fight shoots for him through it). */
  private post(op: Guard, look?: Vec3, door?: string) {
    const p = op.char.pos, y = look ? v3.yawTo(p, look) : op.char.bodyYaw;
    const watch: Vec3 = look ? [look[0], 1.1, look[2]] : [p[0] + Math.sin(y) * 4, 1.1, p[2] + Math.cos(y) * 4];
    const words = door ? `covering ${door}` : 'holding';
    this.g.orders.assign(op, { order: 'cover', post: [p[0], 0, p[2]], face: y, watch, stance: 'none', upper: 'aim', going: words, there: words });
    const A = this.g.orders.of(op); if (A) this.auto.add(A);
  }

  /** F'S ENTRY as it goes: the door tools run it (doortools.ts — the stack, the boot, the can, the count behind it, the men onto their points); this reads each
   *  order's beats into the scenario's log under the names it has always used, says the two things the door tools do not ('set', the room called), and ends it:
   *  the room CALLED once nobody of theirs is left in it — the men posted on its two ways in — or let go of short of that. */
  private tickEntry() {
    const E = this.entry; if (!E) return;
    const g = this.g, t = g.time, B = this.bounds;
    const out: { t: number; what: string; k: number }[] = [], put = (at: number, what: string, k: number) => out.push({ t: at, what, k });
    for (const e of E.ops) {
      const op = e.op, tag = e.side ? ':side' : '';
      if (!e.kicked && op.kick && !isNaN(op.kick.t)) { e.kicked = true; put(op.kick.t, `kick${tag}`, 3); }   // (the boot thrown; the door tools' own 'kick' beat is its landing)
      for (; e.seen < op.beats.length; e.seen++) { const b = op.beats[e.seen], w = b.what;
        if (w === 'stacked') put(b.t, `stacked${tag}`, 0);
        else if (w === 'kick' || w === 'shove') { put(b.t, `door-flung${tag}`, 4); if (op.kind === 'openClear') put(b.t, `nobang${tag}`, 5); }
        else if (w === 'open already') { put(b.t, `door-open${tag}`, 4); if (op.kind === 'openClear') put(b.t, `nobang${tag}`, 5); }
        else if (w.startsWith('toss:')) put(b.t, `toss${tag}`, 5);
        else if (w.startsWith('bang')) put(b.t, `bang${tag}`, 5);
        else if (w === 'go') { put(b.t, e.side ? 'enter:side' : 'enter1', 5); if (isNaN(E.inT)) E.inT = b.t; }
        else if (w.startsWith('end: ')) e.ended = w.slice(5);
      }
    }
    const live = E.ops.filter(e => e.ended === null);
    if (isNaN(E.setT) && live.length && live.every(e => !isNaN(e.op.readyT))) {   // everybody on his door
      E.setT = Math.max(...live.map(e => e.op.readyT)); if (E.split) put(E.setT, 'split:set', 1);
      const last = live[live.length - 1].op.lead; if (last.state !== 'dead') g.say(last, live.length > 1 ? 'both doors — set.' : 'set.');
    }
    if (isNaN(E.goT) && !isNaN(E.gate.openT)) { E.goT = E.gate.openT; if (E.split) put(E.goT, 'split:go', 2); }
    out.sort((a, b) => a.t - b.t || a.k - b.k); for (const o of out) this.log.push({ t: o.t, what: o.what });
    if (!isNaN(E.setT) && !E.gate.go) this.once('set', 'stacked and set. F: go');
    if (live.length) return;
    // every order has ended: called off / never got there — or they went in, and the room is theirs or it is not
    const up = E.men.filter(o => o.state !== 'dead');
    if (up.length > 0 && E.ops.every(e => e.ended === 're-ordered' || e.ended === 'nobody left on it')) { this.note('drill:called-off'); this.endEntry(false); return; }   // taken off it by an order of Sam's (the menu's, to any of them) — at any point: the door tools' men are theirs only while they stand on the order
    if (isNaN(E.inT)) { this.note(`entry:${up.length ? E.ops[0].ended : 'lost'}`); this.endEntry(false); return; }
    const theirs = this.hostiles.some(h => h.state !== 'dead' && !h.held && inBounds(h.char.pos, B));
    if (!theirs && up.some(o => inBounds(o.char.pos, B))) { this.note('clear'); g.say(w(up.find(o => inBounds(o.char.pos, B)) ?? up[0], up[0]), 'room clear — hostages.'); this.called = true; this.endEntry(true); }
    else if (!up.length) { this.note('entry:lost'); this.endEntry(false); }
    else if (t > Math.max(E.inT + 14, ...E.ops.map(e => (e.op.beats[e.op.beats.length - 1]?.t ?? -Infinity) + 5))) { this.note('entry:stalled'); this.endEntry(false); }   // it ended inside without the room being called: whoever is up fights on from where the door tools left him
  }
  /** The hostage room entered and a man of theirs still up in it: the team's men inside do not stand on the sectors the door tools left them holding — each PANS
   *  his muzzle (and the weapon light on it) from one wall of the room to the other and back, SEARCH_RATE rad/s, until somebody's eyes find a man; the room fight
   *  takes a muzzle from there, as it does off any order. Nothing of where the man stands goes into it — the room's four corners do. (Why: sight between two AI
   *  men is the light on the man. A captor caught unset fires no blind burst, and two men holding crossed sectors in a dark office stood four metres from him,
   *  neither side seeing the other, until somebody else's gun went off.) Only for a man the door tools have finished with, standing where they put him on one
   *  of their orders: one Sam has re-ordered since is Sam's. */
  private search() {
    const g = this.g, B = this.bounds, O = g.orders, F = g.fight, t = g.time; if (!B || !RESCUE.roomSearch) return;
    if (!this.hostiles.some(h => h.state !== 'dead' && !h.held && inBounds(h.char.pos, B))) { for (const o of this.searchT.keys()) this.searched(o); return; }
    for (const o of this.ops) {
      const A = O.of(o), p = o.char.pos;
      if (o.state === 'dead' || !A || !DOOR_ORDERS.has(A.order) || !A.post || flat(p, A.post) > 0.6 || !inBounds(p, B) || g.doorTools.ops.some(op => op.men.includes(o))) { this.searched(o); continue; }
      if (F.contact(o) || F.engaged(o)) continue;   // (he has a man: the room fight's)
      let t1 = this.searchT.get(o); if (t1 === undefined) { t1 = t; this.searchT.set(o, t1); this.searchA.set(o, { A, face: A.face, watch: A.watch, there: A.there }); A.there = 'searching the room'; this.note(`search:${o.callsign}`); }
      const mid = yawTo(p, [(B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2]); let lo = 0, hi = 0;
      for (const c of [[B.x0, B.z0], [B.x1, B.z0], [B.x0, B.z1], [B.x1, B.z1]]) { const d = clamp(wrap(yawTo(p, [c[0], 0, c[1]]) - mid), -SEARCH_HALF, SEARCH_HALF); lo = Math.min(lo, d); hi = Math.max(hi, d); }   // (never round behind him: a corner at his back is not swept through the wall)
      const span = hi - lo; if (span < 0.1) continue;
      const u = ((t - t1) * SEARCH_RATE / span + (this.ops.indexOf(o) % 2 ? 0.5 : 0)) % 2, yaw = mid + lo + span * (u < 1 ? u : 2 - u);   // (a triangle wave across what the room subtends from where he stands; the second man half a pass out of step)
      A.watch = [p[0] + Math.sin(yaw) * 4, 1.2, p[2] + Math.cos(yaw) * 4]; A.face = yaw; A.search = true; A.searchT = t;   // (searching: his weapon light is on for it — guards.ts LIGHTS)
    }
  }
  /** his search is over: the sector the door tools left him on, back (if he is still on that order) */
  private searched(o: Guard) {
    const was = this.searchA.get(o); this.searchT.delete(o); this.searchA.delete(o);
    if (was && this.g.orders.of(o) === was.A) { was.A.face = was.face; was.A.watch = was.watch; was.A.there = was.there; }
  }
  /** F's entry is over. The room called: its men — those still where the door tools left them — hold it as the order menu's, each with his gun on a way in
   *  (the first man through the corridor door has that door, everybody else the side door); short of that they stay as they are: the menu's, on whatever
   *  order has them. */
  private endEntry(called: boolean) {
    const E = this.entry; if (!E) return; this.entry = null; this.doorOrders = 0; this.said.delete('set');
    if (!called) return;
    const O = this.g.orders, S = this.data; if (!S) return; let first = true;
    for (const e of E.ops) for (const o of e.op.men) {
      if (o.state === 'dead' || O.of(o) !== e.op.mine.get(o)) continue;   // (re-ordered since: he is on Sam's order, not ours to post)
      if ((!e.side && first) || !S.side) { first = false; this.post(o, this.roomPoint('hold'), doorName(this.g, S.room.door)); } else this.post(o, v3.copy(S.side.hold), doorName(this.g, S.side.door));   // (a room with one door: everybody's gun on it)
    }
  }

  /** rescuecheck.ts: the last loud thing the team did, where a roamer is sent when he is let off his post (null: he goes to the hostage room's door) */
  get noiseAt(): Vec3 | null { return this.noise; }
  /** rescuecheck.ts: the living and the dead of the cast as their radio check reads them — who he is, whether he is posted in the hostage room, his post,
   *  when he learned of the team (NaN: he has not), whether the rescue has let him off his post, and whether Hard's crew has dealt with him (given him a
   *  part, or let him out of it: either way the crew's own words and moves cover him) */
  cast(): { gd: Guard; role: 'captor' | 'door' | 'guard' | 'roamer'; inRoom: boolean; post: Vec3; learnedAt: number; released: boolean; crewed: boolean }[] {
    return this.hostiles.map(gd => { const D = this.defs.get(gd)!; return { gd, role: D.role, inRoom: D.inRoom, post: D.mark.pos, learnedAt: D.learned, released: D.released, crewed: D.crew !== '' }; });
  }

  /** rescueflush.ts: a man it sends is nobody's to send again — not the roamer's release at set, not Hard's crew */
  letGo(gd: Guard) { const D = this.defs.get(gd); if (D) { D.released = true; D.crew = 'out'; } }
  /** the floor just outside the hostage room's main door (rescueflush.ts: which man is nearest it) */
  get outsidePoint(): Vec3 { return this.roomPoint('outside'); }
  /** the floor a metre outside the hostage room's side door; null on a level with none */
  get sideOutside(): Vec3 | null { const n = this.data?.side?.door, d = n ? this.g.doors.byName(n) : undefined; return d ? this.outOf(d, this.bounds, 1.0) : null; }
  /** THE WAY ROUND to the side door, as the team's own man is sent (entry: the door of the room it is taken from first, where the level names one, then the
   *  floor outside the side door itself) — rescueflush.ts walks a man of theirs the same marks; empty on a level with no side door */
  get sideWay(): Vec3[] { const o = this.sideOutside; return o ? [...(this.serverOut ? [v3.copy(this.serverOut)] : []), o] : []; }
  /** who holds the hostages right now: the living man of theirs in the office nearest a living hostage (null = nobody: the clock stands) */
  captor(): Guard | null {
    const B = this.bounds; let best: Guard | null = null, bd = 1e9;
    const all = this.hostages.filter(h => h.state !== 'dead'); if (!all.length) return null;
    const alive = RESCUEEND.on || RESCUEFLUSH.on ? all.filter(x => inBounds(x.char.pos, B)) : all;   // (the rules that let a hostage leave the room: a man standing in it has the ones still IN it — one walked out of it is had by line and reach, flush.holder below)
    const was = this.capBy; if (alive.length && was && was.state !== 'dead' && !was.held && inBounds(was.char.pos, B)) return was;   // the man who has it keeps it while he can: a second man walking in takes nothing over
    if (alive.length) for (const h of this.hostiles) {
      if (h.state === 'dead' || h.held || !inBounds(h.char.pos, B)) continue;
      const d = Math.min(...alive.map(x => flat(x.char.pos, h.char.pos))); if (d < bd) { bd = d; best = h; }
    }
    return best ?? this.flush.holder(was);   // (rescueflush.ts, null with its switch off: nobody of theirs in the room — a man with a line to one of them from outside it has her)
  }
  /** THE CAPTOR'S LAST WARNING, as the men at a door have it (doortools.ts DOORTOOLS.thrLast): `d` is one of the hostage room's doors, a man of theirs still
   *  holds the hostages, and his clock is at its last step — 'about to' (the step the HUD words for Sam the moment it is reached, and the captor's "last
   *  chance! i mean it!" from his next bark: never a count of seconds) — or his gun is on one of them already ("that's it — time's up!"), or one of them
   *  has been shot. The step itself is the cue: no sound is propagated for it. Read only: nothing of the clock is touched */
  lastWarning(d: Door): boolean {
    const S = this.data; if (!this.active || this.over || !RESCUE.clock || isNaN(this.t0) || !S) return false;
    if (d.def.name !== S.room.door && d.def.name !== S.side?.door) return false;
    return (this.step === 'about to' || this.act !== null || this.executed.size > 0) && this.captor() !== null;
  }
  /** CLOCK ONE. */
  private clock(dt: number) {
    const g = this.g, K = RESCUE; if (isNaN(this.t0) || this.over) return;
    const A = this.act;
    if (!K.clock) { if (A) { this.endAct(); this.note('act:broken'); } return; }   // (switched off under him: he is let off his script, not left standing on it)
    if (A) {
      const by = A.by;
      if (by.state === 'dead' || g.time < by.dazzledUntil || g.time < by.staggerUntil || by.held || A.victim.state === 'dead') { this.endAct(); this.note('act:broken'); return; }   // shot, blinded or grabbed with his gun on her: the round never comes (and the clock is where it was — the next second he is free he turns again)
      if (g.time < A.at) return;
      if ((RESCUEEND.on || RESCUEFLUSH.on) && !this.flush.victims(by, [A.victim]).length) { this.endAct(); this.note('act:broken'); return; }   // she was walked out of his line while he brought the gun up: no round
      const c = by.char, v = A.victim, chest = v.char.bones.chest ?? v3.add(v.char.pos, [0, 0.6, 0]);
      if (!by.weapon.fire()) { by.weapon.rearm(); by.weapon.fire(); }
      const pl = g.player, upBefore = this.ops.filter(o => o.state !== 'dead').length, flash = pl.hitFlash, down = pl.down;
      fireWeapon(g, c, chest, false, { steady: true, spread: 0.01 });
      const took = pl.down !== down || pl.hitFlash > flash || this.ops.filter(o => o.state !== 'dead').length < upBefore;   // one of the team was standing in the line: the round is his (an AI round tests the men it is hostile to, never a civilian — the hostage's death is the scenario's to deal)
      this.endAct(); { const A = this.data?.room.doorAim; if (A && (!(RESCUEEND.on || RESCUEFLUSH.on) || inBounds(by.char.pos, this.bounds))) by.lastKnown = [A[0], 0, A[2]]; } by.awareness = 1;   // (back on the door he holds — a man who shot from outside the room, rescueflush.ts, keeps what he was hunting)
      if (took) { this.note('act:blocked'); return; }   // (the clock stays where it was: he turns on her again the next moment he can)
      this.executed.add(v); killGuard(g, v, v3.normalize(v3.sub(chest, c.muzzle)), false, 'shot', 'guard');
      if (WORDS.on) { const o = this.hostages.find(h => h !== v && h.state !== 'dead'); if (o) hostageSay(g, o, 'shot', v); this.murmurAt = g.time + 6; }
      this.resolve = Math.max(0, 1 - K.secondHostageSecs / this.resolveSecs);
      return;
    }
    const cap = this.captor();
    if (!cap) { this.setStep('stopped'); return; }
    if (this.capBy !== cap && RESCUEFLUSH.on && this.flush.came(cap)) this.resolve = Math.max(0, 1 - RESCUEFLUSH.killSecs / this.resolveSecs);   // (rescueflush.ts: a man who CAME for them has made up his mind — killSecs from it, however little of the clock had run)
    else if (this.capBy && this.capBy !== cap) this.resolve = Math.min(this.resolve, Math.max(0, 1 - K.secondHostageSecs / this.resolveSecs));   // the clock has passed to another man (the captor is down, or this one has just come in): he is that long from doing it, however far the last one had got
    this.capBy = cap;
    if (g.time < cap.dazzledUntil || g.time < cap.staggerUntil) return;   // blind (or doubled over a ring): the clock stands for as long as he is
    this.resolve = Math.min(1, this.resolve + dt / this.resolveSecs);
    this.setStep(this.resolve >= 0.8 ? 'about to' : this.resolve >= 0.4 ? 'counting' : 'shouting');
    if (g.time >= this.barkAt && cap.state !== 'dead') { this.barkAt = g.time + 5 + this.resolve * 2; g.say(cap, this.step === 'about to' ? w('last chance! I mean it!', 'last chance! i mean it!') : this.step === 'counting' ? w('I\'m counting! back off!', 'i\'m counting! back off!') : w('stay out! I\'ll do it!', 'stay out! i\'ll do it!')); }
    if (this.resolve >= 1) {
      const alive = this.hostages.filter(h => h.state !== 'dead'); if (!alive.length) return;
      const mine = RESCUEEND.on || RESCUEFLUSH.on ? this.flush.victims(cap, alive) : alive; if (!mine.length) return;   // (a hostage may have left the room: his gun goes on one he HAS — in the room with him, or in his line)
      const v = mine.reduce((a, b) => flat(a.char.pos, cap.char.pos) <= flat(b.char.pos, cap.char.pos) ? a : b);
      const at = v.char.bones.chest ?? v3.add(v.char.pos, [0, 0.6, 0]);
      // (for that second he is on the scenario's script — and off the room fight's roster, which lets nobody else script a man holding a post of its own: his
      // record is kept and handed back, so what he had heard at which door is not lost — endAct)
      // (and `hold` off for it: the roster takes up any HOLDING hostile it does not have, the same frame)
      const F = g.fight; const def = F.defs.find(d => d.gd === cap) ?? null; if (def) F.defs = F.defs.filter(d => d !== def);
      const held = cap.hold; cap.hold = false;
      if (cap.script) endGuardScript(cap, cap.state === 'dead' ? 'patrol' : cap.state);
      order(cap, { goal: null, face: v3.yawTo(cap.char.pos, v.char.pos), strafe: false, aimAt: v3.copy(at), stance: 'none', upper: 'aim', crouch: false, hot: true });
      this.act = { by: cap, victim: v, at: g.time + K.aimSecs, def, hold: held }; this.note('act'); g.say(cap, 'that\'s it — time\'s up!');
      if (WORDS.on) hostageSay(g, v, 'aimed');
    }
  }
  /** the act is over, one way or the other: the man off the scenario's script and back on the room fight's roster as it had him */
  private endAct() {
    const A = this.act; if (!A) return; this.act = null;
    const by = A.by, F = this.g.fight;
    if (by.state !== 'dead' && by.script) endGuardScript(by, 'alert');
    if (by.state !== 'dead') by.hold = A.hold;
    if (A.def && this.g.guards.includes(by) && !F.defs.some(d => d.gd === by)) F.defs.push(A.def as typeof F.defs[number]);
  }
  private setStep(s: RescueStep) {
    if (s === this.step) return; this.step = s; this.note(`step:${s}`);
    if (s === 'counting') this.g.msg('the captor is counting down');
    else if (s === 'about to') this.g.msg('the captor is about to shoot a hostage');
  }

  /** the hostages' count, the room secured and held, the run's end */
  private outcome() {
    const g = this.g, K = RESCUE; if (this.over) return;
    for (const h of this.hostages) {
      if (h.state !== 'dead' || this.counted.has(h)) continue; this.counted.add(h);
      if (this.executed.has(h)) { this.note(`executed:${h.callsign}`); g.msg(`${h.civ?.name ?? 'a hostage'} has been shot`); }
      else if ((RESCUEEND.on || RESCUEFLUSH.on) && this.hostiles.some(x => x.char.id === h.killerId)) { this.note(`killed:${h.callsign}`); g.msg(`${h.civ?.name ?? 'a hostage'} has been killed`); }   // (a hostage on her feet caught by a grenade of THEIRS: frag.ts names its thrower — theirs to answer for, as a round of theirs is)
      else { this.note(`teamfire:${h.callsign}`); this.end('lost', `${h.civ?.name ?? 'a hostage'} was hit by your own fire`); return; }
    }
    const alive = this.hostages.filter(h => h.state !== 'dead').length;
    if (!alive) { this.end('lost', this.hostages.length === 2 ? 'both hostages are dead' : this.hostages.length === 1 ? 'the hostage is dead' : 'every hostage is dead'); return; }
    if (g.player.down) { this.end('lost', 'you are down'); return; }   // (the game's own down card follows; the pair fighting on without Sam is for later)
    const B = this.bounds, pad = isNaN(this.securedAt) ? 0 : 0.4;   // (once it is held, a step onto the threshold does not let go of it; and a room taken without a sound — a quiet start's clock never started — is taken all the same)
    const theirs = this.hostiles.some(h => h.state !== 'dead' && !h.held && inBounds(h.char.pos, B));
    const ours = (!g.player.down && inBounds(g.player.char.pos, B, pad)) || this.ops.some(o => o.state !== 'dead' && inBounds(o.char.pos, B, pad));
    if (RESCUEEND.on) { const how = this.ending.won(); if (how) { this.end('rescued', how === 'out' ? `${alive} of ${this.hostages.length} hostages out` : `${alive} of ${this.hostages.length} hostages alive · building cleared`); return; } }   // (rescueend.ts: the two ways it is won — the hold below ends nothing)
    const kept = RESCUEEND.on && !isNaN(this.securedAt) && (!theirs || !this.hostages.some(h => h.state !== 'dead' && inBounds(h.char.pos, B)));   // (the rule on: a room taken stays taken while nobody of theirs is back in it with the hostages — the team may walk out of it with them, and leave them anywhere)
    if ((!theirs && ours) || kept) {
      if (isNaN(this.securedAt)) { this.securedAt = g.time; this.note('secured'); g.msg(RESCUEEND.on ? 'hostage room secured — bring them out, or clear the building' : `hostage room secured — hold it (${Math.round(K.holdSecs)} s)`);
        if (WORDS.on && !this.said.has('h:secured')) { this.said.add('h:secured'); const h = this.hostages.find(x => x.state !== 'dead'); if (h && hostageSay(g, h, 'secured')) this.ackAt = g.time + 2.4; } }
      else if (!RESCUEEND.on && g.time - this.securedAt >= K.holdSecs) this.end('rescued', `${alive} of ${this.hostages.length} hostages alive`);
    } else if (!isNaN(this.securedAt)) { this.securedAt = NaN; this.note('unsecured'); g.msg(theirs ? 'contact in the hostage room — it is not yours yet' : 'nobody is holding the hostage room'); }
  }
  /** THE HOSTAGES' VOICES (the dialogue pass — words.ts; the words are dialogue.ts HOSTAGE_LINES, the saying civilians.ts hostageSay). One low line at a time
   *  across the room, in turn, while a man of theirs stands over them — pleading with him, and with his shouting once he is counting; calling out once
   *  nobody of theirs is left in it and nobody of the team has come; a cry at the team's first loud thing at the room; and when the room is the team's, one
   *  of them finding her voice and a teammate in the room answering a beat later. The gun on one of them and the shot are said where they happen (clock()).
   *  Nothing is drawn from the game's die and nobody's ears are moved: whose turn it is is a count, the gaps are fixed, the line is off the hostage's own die. */
  private voices() {
    if (!WORDS.on) return;
    const g = this.g, B = this.bounds, alive = this.hostages.filter(h => h.state !== 'dead');
    if (!isNaN(this.ackAt) && g.time >= this.ackAt) {
      this.ackAt = NaN;
      if (alive.length && !isNaN(this.securedAt)) {
        const there = this.ops.filter(o => o.state !== 'dead' && inBounds(o.char.pos, B, 0.4));
        const by = there.find(o => !(o.bubble && g.time - o.bubble.t < o.bubble.dur)) ?? there[0];   // (not over his own 'room clear' if another man is in the room)
        if (by) g.say(by, HOSTAGE_LINES.team[this.staged % HOSTAGE_LINES.team.length]);
      }
    }
    if (this.over || this.act || !alive.length || !isNaN(this.securedAt)) return;
    const N = this.noise;
    if (N && !this.said.has('h:entry') && (inBounds(N, B) || flat(N, this.roomPoint('outside')) < 3)) {   // the boot, the charge, the first rounds at their door
      this.said.add('h:entry'); const h = alive[this.murmurN++ % alive.length];
      hostageSay(g, h, 'entry', alive.find(o => o !== h) ?? null); this.murmurAt = g.time + 6; return;
    }
    const running = !isNaN(this.t0), pressed = this.step === 'counting' || this.step === 'about to';
    if (this.said.has('h:secured') && !this.captor()) return;   // they have been told to stay down by the people who came for them: a room let go of again is the team's to say, not theirs to call down
    if (pressed && !this.said.has('h:pressed')) { this.said.add('h:pressed'); this.murmurAt = Math.min(this.murmurAt, g.time + 1.5); }   // (his counting is answered in a breath, whatever the quiet spell before it had left on the clock)
    if (g.time < this.murmurAt) return;
    const h = alive[this.murmurN++ % alive.length];
    hostageSay(g, h, !this.captor() ? 'alone' : pressed ? 'threat' : 'wait');
    this.murmurAt = g.time + (pressed ? 7 : running ? 11 : 16) + (this.murmurN % 3) * 2;
  }
  private end(state: 'rescued' | 'lost', why: string) {
    const g = this.g;
    const team = (g.player.down ? 0 : 1) + this.ops.filter(o => o.state !== 'dead').length;
    const secs = isNaN(this.t0) ? 0 : (isNaN(this.securedAt) || state === 'lost' ? g.time : this.securedAt) - this.t0;
    const timed = isNaN(this.t0) ? 'room secured before anybody knew' : isNaN(this.securedAt) && state === 'rescued' ? `${secs.toFixed(0)} s after the clock started` : `room secured ${secs.toFixed(0)} s after the clock started`;   // (a floor cleared with the room never stood in — rescueend.ts — has no 'secured' to time)
    const left = this.hostages.filter(h => h.state !== 'dead').length;
    const grade = state === 'lost' ? 'failed' : left === this.hostages.length ? 'clean' : 'costly';
    this.result = { state, grade, why, hostages: left, team, secs };
    this.endAct();
    this.note(`${state}${state === 'lost' ? `:${why}` : ''}`);
    g.msg(state === 'rescued'
      ? `${grade === 'clean' ? 'CLEAN' : 'COSTLY'} — ${why} · team ${team}/${1 + this.ops.length} up · ${timed}. Shift+Enter stages it again`
      : `FAILED — ${why}. Shift+Enter stages it again`);
  }

  /** where it stands, in one word */
  get state(): RescueState {
    if (!this.active) return 'off';
    if (this.result) return this.result.state;
    if (!isNaN(this.securedAt)) return 'secured';
    return isNaN(this.t0) ? 'staged' : 'running';
  }
  /** the HUD's objective line and marker while it is up (mission.ts): the hostage room, and how far the captor's clock has got — never in seconds */
  objective(): { text: string; pos: Vec3 | null } | null {
    if (!this.active) return null;
    const B = this.bounds, pos: Vec3 | null = B ? [(B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2] : null;
    const R = this.result;
    if (R) return { text: R.state === 'rescued' ? `${R.grade === 'clean' ? 'clean' : 'costly'} — ${R.why} · shift+enter stages it again` : `failed — ${R.why} · ${this.g.player.down ? 'enter' : 'shift+enter'} stages it again`, pos: null };
    const alive = this.hostages.filter(h => h.state !== 'dead').length;
    if (RESCUEEND.on && (!isNaN(this.securedAt) || this.ending.lead)) {   // (rescueend.ts: where to take them — and the clock, when a man of theirs has one of them again)
      const o = this.ending.objective(); return { text: RESCUE.clock && !isNaN(this.t0) && this.step !== 'stopped' ? `${o.text} · the captor is ${this.step}` : o.text, pos: o.pos }; }
    if (!isNaN(this.securedAt)) return { text: `objective ▸ hold the hostage room · ${Math.max(0, Math.ceil(RESCUE.holdSecs - (this.g.time - this.securedAt)))} s`, pos };
    const clock = !RESCUE.clock || isNaN(this.t0) ? '' : this.step === 'stopped' ? ' · nobody on them' : ` · the captor is ${this.step}`;
    const behind = RESCUE.marks && this.dynamic ? this.flow.line() : '';   // (the openings Sam has come past, and what is known of each — in place of the directions he no longer needs)
    return { text: behind ? `objective ▸ get to the hostages (${alive} alive)${clock} · ${behind}` : `objective ▸ get to the hostages (${alive} alive) — ${this.place()}${clock}`, pos };
  }
  /** the captor's clock as the player is shown it */
  get clockStep(): RescueStep { return this.step; }
  /** one line for the panel / the console */
  summary(): string {
    if (!this.active) return 'hostage rescue off';
    const up = (l: Guard[]) => l.filter(x => x.state !== 'dead').length;
    const clock = !RESCUE.clock ? 'clock off' : isNaN(this.t0) ? 'clock not started' : RESCUE.clockAsSeconds ? `clock ${(this.resolve * this.resolveSecs).toFixed(0)}/${this.resolveSecs.toFixed(0)} s` : `captor ${this.step}`;
    const set = this.hostiles.filter(h => h.state !== 'dead' && this.defs.get(h)?.set).length;
    return `hostage rescue ${this.state} · hostages ${up(this.hostages)}/${this.hostages.length} · ${clock} · team ${up(this.ops)}/${this.ops.length} up${this.entry ? `, F's entry (${this.entry.ops.map(e => `${e.side ? 'side' : 'front'}: ${e.ended ?? e.op.phase}`).join(', ')})` : ''} · defenders ${up(this.hostiles)}/${this.hostiles.length} up, ${set} set${this.blindRounds ? ` · ${this.blindRounds} blind rounds` : ''}${this.result ? ` · ${this.result.why}` : ''} · staged ×${this.staged}${RESCUE.flow || RESCUE.marks ? ` · ${this.flow.summary()}` : ''}`;
  }
}
