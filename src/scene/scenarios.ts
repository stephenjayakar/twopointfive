// What a SCENARIO needs from the level it is played on, as data (Level.scenarios — the level file's own `scenarios` block, docs/level-format.md 'Scenarios'; for the
// office, levels/office.scenarios.ts attached at load). The three playtest scenarios — the night breach (game/nightbreach.ts), the room clear (game/roomclear.ts,
// with the pair or the four) and the hostage rescue (game/rescue.ts + rescueflow.ts) — read their rooms, doors, marks and team start from here and from nowhere
// else, so a level that carries a block is a level they run on. Types, and one pure function (scenarioQuery): nothing here imports the game.
//
// Door names are the level's own door ids (Doors.byName); light groups are its switchable groups (Game.setGroup); every point is world metres on the floor (y 0)
// unless it is something a gun rests on (y ≈ 1.1). What the data must satisfy against the floor is checked in the game, headless: roomclear.ts checkStructure,
// rescue.ts checkRescue, rescueflow.ts RescueFlow.check — tools/qa/scenario-level-probes.ts runs all three on a level file.
import type { Vec3 } from '../math/vec';
import type { BoxData, DoorData, LightData } from './levelData';   // (types only, erased: a kit view SET is written in the level format's own records)

export interface Rect { x0: number; x1: number; z0: number; z1: number }

/** Where the team stands when a scenario is staged: Sam and the way he faces; the teammates' marks (the pair's two; for the four, two more — absent, the second
 *  pair is stood on the free floor a stride behind the first) and the way THEY face (absent: east, +x, as the office has them). */
export interface TeamStart { sam: Vec3; samYaw: number; ops?: Vec3[]; opsYaw?: number }
/** a place a man of theirs is put, and the point his gun rests on from it */
export interface ScenarioMark { pos: Vec3; aimAt: Vec3 }

/** THE NIGHT BREACH on its own: the team's start beside the level's breach plan (plans.breach — the F drill's door, stack and flows stay there), what the room
 *  behind that door is called, and the light group its 'room lights' knob switches. The first pair stand on the PLAN's marks, so of `team` only sam, samYaw
 *  and opsYaw are read here (its `ops` are not; the four's second pair take the room clear's team marks, or a stride behind the first). */
export interface NightBreachData { team: TeamStart; room?: string; lights?: string }

/** THE ROOM CLEAR's structure: the rooms to take. */
/** a way into a room: the leaf's name (Doors.byName) and what is on its other side */
export interface StructureDoor { id: string; from: string }
/** a place a defender may stand: the mark, the door he watches from it (one of his room's) and the point on it his gun rests on */
export interface StructureMark { pos: Vec3; watch: string; aimAt: Vec3 }
export interface StructureRoom {
  id: string; name: string;
  /** the floor inside its walls (where the level has a clear plan for one of its doors, that plan's bounds — checkStructure holds the two together) */
  bounds: Rect;
  doors: StructureDoor[];
  /** how many men hold it, and where they may stand (≥ garrison marks; the first `garrison` are the authored placement) */
  garrison: number; marks: StructureMark[];
}
/** `team`: where the team starts for the room clear. Absent on a level with a breach plan = the night breach's start (the plan's approach marks). A level with
 *  NO breach plan must give it, with the teammates' marks — there the room clear has no F drill: every teammate is the order menu's from the first frame. */
export interface StructureData { name: string; team?: TeamStart; rooms: StructureRoom[];
  /** OTHER WAYS IN: more places the team may start, each a whole start with the teammates' marks (`team` is way in 1, these are 2, 3, …). Nothing stands on one
   *  unless the run asks: `ROOMCLEAR.way` pins one (the mission sheet's Way in row, `?way=N`) or asks for a dealt one (`?way=any`: game/roomclear.ts). Only beside a `team`; each is held
   *  to the rules `team` is (checkStructure: free floor, a way on foot to every teammate's mark and into every room). */
  starts?: TeamStart[];
  /** a bigger floor for the four-man squad: the most defenders this structure may hold ALIVE AT ONCE (absent = five; at most eleven — Sam, the four and eleven
   *  fill the skinning's sixteen: roomclear.ts checkStructure, nightbreach.ts) */
  maxMen?: number;
  /** HARD defenders here do not come in after the team one at a time: the men a lost room draws hold one door of it from back off it (game/pressure.ts
   *  PRESSURE.wayOut — nothing at standard, nothing on a level without the row; whichever scenario stands this structure's defenders) */
  wayOut?: boolean;
  /** false = this floor's men NEVER DIG IN (game/digin.ts — roomfight.ts tickDef: no man of it braces a door, takes cover behind furniture or sets his gun on
   *  the door he expects, at any difficulty and whatever its squads decide) — for a level whose words lean on men standing where they were dealt (Training
   *  5 and 6: a lesson is read at six seconds a line, so its men always had the minute to set a gun on the door the order is taught at). Absent = the game's
   *  own rule, as on every level */
  digIn?: boolean;
  /** THE SQUAD IS ISSUED WALL CHARGES HERE: on this structure the team carries at least this many wall charges for the run, whatever its kit cards carry and
   *  with no visit to the loadout (game/issue.ts, told at every staging; the cards and their store are not touched). Absent = the kit's own count, as it was */
  wallCharges?: number;
  /** the defenders as SQUADS (game/enemysquads.ts; absent or empty = one pool, the game as it was run for run). The data says who and where — never what a squad does
   *  when: holding, wedging a door, going round, going to help are the AI's calls. */
  squads?: SquadData[] }

/** A late squad's way in: not on the floor at the start; it comes by `door` (an outside door) once the floor is loud and the living defenders + `men` fit maxMen. */
export interface SquadArrive { door: string; spawn: Vec3[]; men: number }
/** ONE DEFENDER SQUAD of a structure. Its members are the men dealt into its `rooms` (placeDefenders) — or, with `arrive`, the men who come in later.
 *  The rules (levelData.ts validateLevelData for what the file alone can say, roomclear.ts checkStructure against the floor): with a squads block every room is in
 *  exactly one squad; an `arrive` squad has no rooms and every other at least one; Σ garrison ≤ maxMen ≤ SQUAD_MAX_MEN; `rally` is standable floor inside one of its
 *  rooms (anywhere standable for a late squad); `barricade` doors are doors of its rooms; `arrive.spawn` points are standable, outside every room, joined on foot
 *  to `arrive.door`, and at least `arrive.men` of them. */
export interface SquadData {
  id: string;
  /** what their radio calls the squad ('Alpha'); absent = the id */
  name?: string;
  /** the rooms it holds (StructureRoom ids) */
  rooms?: string[];
  /** where it regroups or falls back to (a floor point, y 0); absent = the AI picks */
  rally?: Vec3;
  /** doors it may shut and wedge; absent = every door of its rooms but one two of its own rooms share; [] = never */
  barricade?: string[];
  /** false = its men stay in its rooms: no press, no flank, no going to help (absent = true). On a floor where EVERY squad stays, one man still walks to a squad
   *  that has gone silent on the net (game/stayask.ts) */
  mayLeave?: boolean;
  /** how its men take a fright (game/morale.ts trainingOf): every man green · its first man a steady leader and the rest green · every man steady; absent = the difficulty's mix */
  training?: 'green' | 'mixed' | 'trained';
  arrive?: SquadArrive;
}
/** the most defenders alive at once on a structure with `maxMen` (16 skinned characters less Sam and the four) */
export const SQUAD_MAX_MEN = 11;
/** a squad's barricade doors where the file names none: every door of its rooms except one shared by two of its own rooms */
export function squadBarricade(q: SquadData, rooms: StructureRoom[]): string[] {
  if (q.barricade) return q.barricade;
  const mine = rooms.filter(r => q.rooms?.includes(r.id)), ids = mine.flatMap(r => r.doors.map(d => d.id));
  return [...new Set(ids)].filter(id => ids.filter(x => x === id).length < 2);
}

/** THE HOSTAGE RESCUE's flow (rescueflow.ts): the corridor the team runs and the openings off it. AS BUILT the flow reads a corridor that runs along +x and is
 *  walked west to east (an opening is 'passed' when Sam's x goes by it; `north` says which side of the corridor it is on). A level whose route is not that shape
 *  leaves `flow` out: the rescue then runs without the unasked covers and the strips, as with RESCUE.flow and RESCUE.marks off. */
export interface RouteOpening {
  id: string; name: string; short: string;
  /** the room it opens on: a `regions` id */
  region: string;
  kind: 'glass' | 'doorway' | 'door'; door: string | null;
  /** the middle of its threshold · where a man stands to cover it · what his gun is on · its half width · which side of the corridor it is on (true = −z) */
  at: Vec3; mark: Vec3; watch: Vec3; half: number; north: boolean;
  /** his words taking it, and the seconds of look it gets once he is on the mark */
  call: string; side: 'left' | 'right'; look: number;
}
export interface RescueFlowData {
  corridor: Rect;
  /** the rooms off the route: `door` = a door whose clear plan's bounds are the room where the level has one, `rect` otherwise */
  regions: { id: string; door: string | null; rect: Rect }[];
  route: RouteOpening[];
  /** the man left holding the corridor when Sam turns into a side room watches a point `ahead` m on from his mark (x no further than `xMax`) at this z */
  hold: { ahead: number; xMax: number; z: number };
}
export interface RescueData {
  /** Sam, and the pair's two marks */
  team: TeamStart;
  room: {
    /** the hostage room as the lines call it ("manager's office") and, optionally, where it is ('far end of the corridor') */
    name: string; where?: string;
    /** its main door — the one F's entry takes */
    door: string;
    /** its floor inside its walls. Absent = the bounds of the level's clear plan for `door` (one of the two must exist) */
    bounds?: Rect;
    /** the light group the 'room lights' knob switches */
    lights?: string;
    /** the point on the main door the men inside keep their guns on */
    doorAim: Vec3;
    /** the floor just outside the main door (where a man let off his post goes when he has heard nothing) and the point the first man in keeps his gun on
     *  once the room is called. Absent = 1 m / 0.4 m out of the door from `doorAim`, away from the room. */
    outside?: Vec3; hold?: Vec3;
  };
  /** the room's second door, if it has one: F with a man posted beyond it takes both doors on one signal */
  side?: {
    door: string;
    /** the point the men inside keep on it once the room is called */
    hold: Vec3;
    /** the room it is taken FROM: that room's own door (its clear plan's bounds, or `bounds`) — a man sent from in there to the main door goes out by that door */
    from?: { door: string; bounds?: Rect };
    /** a floor laid out for four: with the four-man squad staged, the man F sends to this door takes his pair mate standing in the same room with him (a pair on
     *  each door) while that leaves somebody for the main door. Absent = one man, as on every level before it */
    pair?: boolean;
    /** authored marks for the face of the side door the team comes at (orders.ts doorMarks: where its jambs have no floor to stack on) */
    stack?: Vec3[]; standoff?: Vec3[];
  };
  hostages: { pos: Vec3; face: number }[];
  captor: ScenarioMark;
  /** the door man's two places (RESCUE.doorMan): just inside the room, or out on the route */
  doorMan: { inside: ScenarioMark; outside: ScenarioMark };
  /** men elsewhere on the floor who come to the noise (RESCUE.roamers takes the first N, rotated by a staging-time draw) */
  roamers: ScenarioMark[];
  /** more guns who never leave the hostage room, each on his own mark inside it (absent = the captor and the door man are all it holds) */
  guards?: ScenarioMark[];
  /** the level's own cast (absent = the knobs', RESCUE.roamers of the marks in order): `roamers` of the roamer marks are manned, WHICH is drawn at each staging
   *  (RESCUE.seedRoamers off: the first so many, as written). The RESCUE.roamers knob is not read on such a level */
  cast?: { roamers: number };
  flow?: RescueFlowData;
}

/** THE LEVEL'S OWN NAMES FOR ITS FLOOR (`scenarios.places`): the spaces no scenario holds — halls, corridors, yards, side rooms — so a line that says WHERE
 *  ('still up — in the front hall', the debrief's 'pantry') names a real place of THIS level and never one of the office's. `name` is as the lines say it,
 *  without the article ('front hall'; "registrar's office"); `bounds` the floor inside its walls (outdoors: the ground the name means). Areas may not overlap a
 *  structure room's meaning: where a point is in both, the structure's room wins (game/dialogue.ts placeName). Nothing in the simulation reads this: words,
 *  and where the HUD's marker sits for a place their net has named. A level without it names only its structure's rooms ('outside the sala'). */
export interface PlaceArea { name: string; bounds: Rect }
export interface PlacesData { areas: PlaceArea[] }

/** THE QUIET MISSION (game/quiet.ts — `?quiet`): the level's own night, live — its routes walked, its devices and civilians as on the plain night, nobody posted
 *  and nobody benched — with a thing to take from a place and ways out, alone or with ONE partner (the pair rules, game/pairup.ts, silent from the first
 *  frame). REPLAY: the run's seed deals one of `starts`, one of `spots` and one of `patrols`; every exit is open on every run. Every point is floor (y 0)
 *  but a spot's `front` (the holder's face, y ≈ 1). Checked against the built floor by game/quiet.ts checkQuiet (tools/qa/quiet-check.ts). */
export interface QuietStart {
  sam: Vec3; samYaw: number;
  /** where the one partner stands (absent: the nearest free floor a stride behind Sam) */
  mate?: Vec3;
  /** 'the west gate': for the logs and the debrief */
  name?: string;
}
export interface QuietSpot {
  /** the room as the objective line says it ('the records room') and its floor inside its walls: stepping in = reached */
  place: string; area: Rect;
  /** the door the marker points at on the way in */
  door: string;
  /** what the thing is taken from, as the row says it ('the grey cabinet', 'rack 3') */
  holder: string;
  /** names the lights that go dark once it is out: switchables `rack<N>_leds` / `rack<N>_glow` (scene/levelKit.ts rack) — none by that name, nothing goes dark */
  rackIndex: number;
  /** the point on the holder's face (the marker; reach is measured from it) and half its width along that face */
  front: Vec3; halfW: number;
  /** true = this holder is on a network or an alarm: emptying it shows on somebody's board and a man is sent to look (game/takecheck.ts; Training 1's trunk also says so: the man who comes is its last lesson). Absent = nobody is
   *  told — a file out of a safe is missed by no one; only a man who hears it come out comes to look */
  wired?: boolean;
}
/** a way out: past (x, z) going `out` (a unit vector on the floor), within `halfW` (default 1.8) of it sideways — so it may face any way */
export interface QuietExit { name: string; door: string; x: number; z: number; out: [number, number]; halfW?: number }
/** a place a man stands for something: the shift's errands (game/needs.ts NeedSpot — `loop` is the stretch's lap) and the civilians' phones / ways off the floor (game/civilians.ts CivSpot) */
export interface QuietStand { name: string; pos: Vec3; face: number; loop?: Vec3[] }
export interface QuietData {
  /** what is taken, with its article (absent: 'the drive') */
  thing?: string;
  starts: QuietStart[];
  spots: QuietSpot[];
  exits: QuietExit[];
  /** sets of route names: the routes manned on a run (absent: every route, every run) */
  patrols?: string[][];
  /** THE LEVEL'S OWN PLACES for what the office keeps in tables of its own — read on this level whichever way it is booted (the plain night too): the shift's
   *  errands by kind (a kind left out is not dealt here), where a frightened civilian rings security from, and where she gets off the floor */
  needs?: { coffee?: QuietStand; smoke?: QuietStand; water?: QuietStand; stretch?: QuietStand };
  phones?: QuietStand[];
  wayouts?: QuietStand[];
  /** false = this shift keeps NO radio check (guards.ts updateRollcall: nobody sounds off, so nobody is sent round a silent man's route) — for a level whose men
   *  stand posts its words lean on (the Training lessons: a reader slower than the check found the posts empty). Absent = the game's check, as on every level */
  radioCheck?: boolean;
}
/** how many routes a patrol set may man: Sam, one partner and six fill the eight characters that cast shadows (guards.ts spawnUnit's budget) */
export const QUIET_MAX_ROUTES = 6;

/** A LESSON (game/lesson.ts — the Training group of the mission list): STEPS laid over whichever scenario the level's row starts (a quiet mission, a room clear).
 *  Each step is a LINE on the HUD's objective row naming the key, and a DONE-TEST the game reads off its own state: the line moves on when the player has done
 *  the thing, never on a clock. The lesson only READS the game (it moves nobody, ends nothing): past its last step the scenario's own objective stands and ends
 *  the run as it always does. Tests are plain records `{ is: '<kind>', … }` (the kinds and their fields: game/lesson.ts LESSON_TESTS, which also checks them
 *  against the built floor — tools/qa/lesson-check.ts). */
export interface LessonTest { is: string; [k: string]: unknown }
export interface LessonStep {
  /** a short handle for the logs and the scripted run ('crouch') — unique in its lesson */
  id: string;
  /** what the objective row says while the step is up: what to do and the key that does it ('Crouch: press C') */
  line: string;
  /** the line while a gun's key again opens its setup (game/slotsetup.ts SLOTSETUP.on), where the step's keys are others then (absent: `line`) */
  setupLine?: string;
  /** the line while his own actions are a ring (game/handring.ts HANDRING.on), where the step's keys are others then: the whistle has no key of its own
   *  there, it is the ring's last wedge (absent: `line`) */
  ringLine?: string;
  /** the line while a charge his own hands set goes off from his own actions (game/ownblow.ts OWNBLOW.on), where the step names the squad's key for
   *  it (absent: `line`) */
  blowLine?: string;
  /** the line while the SQUAD's ring or menu is up (game/orders.ts): the hold is one line, what to press in the ring the next (absent: `line`) */
  menuLine?: string;
  /** the line while a page UNDER the ring's first is showing (the first page's key pressed: what is left to press — absent: `menuLine`) */
  pageLine?: string;
  /** the line while plan mode is DOWN on a step that is done in the mode (a checkpoint put back, the mode put away by hand: what puts it up again —
   *  absent: `line`) */
  planLine?: string;
  done: LessonTest;
  /** seconds the test must stay true before the step counts (absent: the frame it turns true) */
  hold?: number;
  /** where the HUD's marker points while the step is up (absent: no marker) */
  at?: Vec3;
  /** the marker rides on a MAN instead: the one on the patrol route of this name, while he is on his feet (then `at`, if the step has one) — 'come up
   *  behind him': which him */
  atMan?: string;
  // ---- on a rails level only (game/rails.ts; a lesson without `rails` carries none of these) ----
  /** actions this step turns on, for the rest of the mission · actions it turns off again */
  allow?: string[]; deny?: string[];
  /** sent to the level's script the tick the step comes up, as the signal 'lesson:<cue>' */
  cue?: string;
  /** an authored checkpoint, kept the tick this step comes up and named so ('the yard') */
  checkpoint?: string;
  /** the fog of war from this step on */
  fog?: boolean;
  /** the step teaches the command key HELD: a tap of it gives no order while the step is up, and these words come up under the line ('Keep [B] held') */
  noTap?: string;
  /** a lookout for the fog of war while this step is up (as `rails.sky.eye`): a place the PLAYER is shown without a man's eyes on it, its own charge on a wall.
   *  The picture's alone: the squad knows nothing through it (rails.ts RAILS.eyeView) */
  eye?: { at: Vec3; yaw: number; fov?: number };
  /** A CARD that pauses the page when the step comes up (ui/railcard.ts): a heading and a few sentences on a rule of the game no key press shows — a new
   *  line in `text` is a new paragraph, a key in brackets is drawn as a key. Closed with Enter or a click; then the step's line is what to try. Once a run */
  explain?: { title?: string; text: string };
  /** an ARROW on the ground in place of the ring: from the step's `at` it points at this place ('walk into the wall': which way) */
  toward?: Vec3;
  /** once a man of the squad is under an order to the step's mark: the sky seat's view goes back to the squad (the hand's shift eased out, the mark no
   *  longer kept in the picture), and `nv: false` puts the night vision up for the walk out */
  onWay?: { nv?: boolean };
  /** (rails) THE LINE ONCE THE ORDER IS GIVEN: while the men carry out what the step asks for, the line says what they are doing and never asks again
   *  (`line`, for RAILS.afterSecs after an order — one of `on`, or any but the word — went out on this step; `word`: the line once the word has been given) */
  after?: { line?: string; on?: string[]; word?: string };
}
/** A TUTORIAL MISSION'S FRAME over a lesson (game/rails.ts): what the player can do at all, and what nobody can lose */
export interface RailsData {
  /** the actions that work from the first step (rails.ts ACTS); every other key, button and wheel is dropped from the tick's input */
  allow: string[];
  /** seconds a teammate who would have gone down spends on a knee before he is up again (absent: he goes down) */
  respawn?: number;
  /** the fog of war at the first step (absent: as the scenario's start has it) */
  fog?: boolean;
  /** nobody on the floor is the player: he is parked at `park`, out of the picture and every sense, and the view rides the squad (`reach`: metres the
   *  walk keys may shift it off them). `eye`: a lookout the mission stands for the fog of war (the man left with the trucks): a place and the way it looks
   *  (`yaw`, radians, a man's own: 0 = +Z; `fov` degrees, 120 unless said), one more eye of the PICTURE's for as long as the seat is the sky's (drawn, not seen: the squad
   *  knows nothing through it — rails.ts RAILS.eyeView) */
  sky?: { park: Vec3; reach?: number; eye?: { at: Vec3; yaw: number; fov?: number };
    /** the squad holds ON A KNEE where the mission stood it until its first order (men behind their trucks under fire), not at the low ready on its feet */
    low?: boolean };
  /** false: no teammate shows an aiming laser on this level, red or infrared (game/irlaser.ts laserOn) */
  lasers?: boolean;
  /** the orders the squad's menu lists on this level, by id (orders.ts rowsFor: 'move', 'stack', 'go', 'walltools', 'wallCharge', 'work' …): a row not named is
   *  not there, on the ring or under the quick key. Absent: every row the game has */
  orders?: string[];
  /** the verbs Space offers on this level (an Interactable row's `verb`: 'grab', 'pick', 'code'…): a thing in reach whose verb is not here has
   *  no row, so a tap never lands on something no step taught (absent: every row, as on any level) */
  rows?: string[];
}
export interface LessonData {
  /** the family of systems it teaches, as the row says it ('Moving unseen') */
  title: string;
  steps: LessonStep[];
  /** a tutorial mission's frame (absent: a lesson as it always was) */
  rails?: RailsData;
}

/** A PAR (game/par.ts): the level's room clear run AGAINST A CLOCK. The clock runs from the squad's first order (or Sam's first stride off his start) to the
 *  room clear's 'taken'; every teammate lost adds `lossSecs`; the total is held against three times, best first (gold < silver < bronze, seconds). The par only
 *  READS the game: a level with the block plays the same run with it switched off (PAR.on). Only beside a `roomClear`. */
export interface ParData { gold: number; silver: number; bronze: number; lossSecs: number }
/** A MISSION'S OWN ISSUE (game/kit.ts kitIssue): kit this level hands the squad whatever the machine keeps, with no visit to the loadout screen. `members` is
 *  keyed by the man's place on the roster ('0' = you, '1'‥'4' = the teammates in order); each record is the FIELDS THAT DIFFER from his issue card (kit.ts
 *  MemberKit: the rest of the card is as issued) — `{ '1': { weapon: 'shotgun', bangs: 2, charges: 0 } }` = Red One carries the breaching shotgun, two stun canisters and no charge; `{}` = every man as issued. A card the
 *  pouches rule does not allow is trimmed as any card is. A level without the block is staged with the cards the machine keeps, as ever. */
export interface IssueCard { weapon?: 'rifle' | 'pistol' | 'shotgun'; suppressed?: boolean; light?: boolean; nvg?: boolean; bangs?: number; charges?: number; smoke?: number; frags?: number; walls?: number; shells?: number;
  /** yours alone, on a card with the rifle: the launcher's sponge rounds, 0‥5 (game/kit.ts RINGS_MAX). A mission that names your card hands none over it
   *  (kit.ts ISSUE.whole), so one that wants them on the tube says how many: with any, the launcher comes up on them, the grenades its next load */
  rings?: number }
export interface IssueData { members: { [place: string]: IssueCard } }
/** A SNATCH (game/snatch.ts — an overlay on a level's ROOM CLEAR, as a lesson is one on a mission): ONE unarmed man the team has to take alive. He is a
 *  civilian of the usual make (game/civilians.ts: his eyes, his ears, his run, his hands on his head), put on the floor at every staging of the room clear;
 *  the overlay adds who he gives up to, which way out he will not run at, and what ends the mission. A level without the block is the game as it was. */
export interface SnatchData {
  /** who he is and where he keeps while the floor is quiet: `points` (default: `pos` alone) are the marks he moves between, `wait` the seconds at each */
  man: { name: string; pos: Vec3; face: number; tint: Vec3; tint2?: Vec3; points?: Vec3[]; wait?: number[] };
  /** the WAYS OFF THE FLOOR he runs for once it is loud (nearest first by walking): a spot beyond a gate or an outside door — on it, he is gone */
  exits: { name: string; pos: Vec3 }[];
  /** THE WAY HE IS TAKEN OFF THE FLOOR (game/snatchout.ts, while its switch is up): the team's own vehicle by its way in — `pos` is the spot at its open doors a
   *  man is put in from. Tied, he is led there by the player and the mission is won the moment he is in it, the house taken or not. Without the key, or with the
   *  switch off, the snatch ends as it did: the house taken with him in hand. */
  van?: { name: string; pos: Vec3 };
}

/** A DEFUSE mission's overlay on a room clear (game/defuse.ts): timed charges in rooms of the structure, all on ONE clock. A charge is made safe by a man
 *  standing at it and working it `workSecs`; the clock running out sets off every charge still live — a real blast where it stands. Read by game/defuse.ts
 *  and by nothing else: a level without the block is the room clear as it was. */
export interface DefuseDevice {
  id: string;
  /** the objective row's and the order menu's words for it ('charge 1': a name the level shows — no compass words, the HUD has none) */
  name: string;
  /** the point on it a hand goes to (world; y = the height of the thing it sits on) */
  pos: Vec3;
  /** the planar unit normal out of it, toward the floor a man stands on to work it */
  n: [number, number];
}
export interface DefuseData {
  /** the one clock, seconds from the team's first move */
  secs: number;
  /** seconds of work at a charge to make it safe (absent: game/defuse.ts DEFUSE.workSecs) */
  workSecs?: number;
  devices: DefuseDevice[];
  /** the blast of one charge (absent: game/defuse.ts DEFUSE's) — frag.ts blast()'s radii and the destruction engine's */
  blast?: { lethalM?: number; woundM?: number; radius?: number; power?: number };
}
/** THE KIT VIEW (src/host/kitView.ts — the start page's Team & kit step shows the team as picked, stood at the mission's own way-in door, drawn by a second
 *  instance of the page opened `?kitview`): where the men stand and how the camera looks, per WAY IN. `ways` is indexed as the team starts are — [0] the
 *  structure's own `team`, [k] its `starts[k − 1]` (roomclear.ts RoomClearScenario.way). A way needs only its `door` (a door id): the slots, the camera and the
 *  lamps are worked out from the door's frame and the side the team starts on; every other key lays an authored value over that. Picture only: no rule of the
 *  game reads this block, and a level without it shows the menu's standing man as before. */
export interface KitViewLamp {
  /** RtLight.kind (render/lights.ts): 0 point · 1 spot · 3 area disk */
  kind: 0 | 1 | 3;
  /** where it hangs, from the door's middle on the wall's line: [along the wall toward the stack, out from the wall on the team's side, up] (m) — and the
   *  point it is turned on, the same way (an area disk's normal) */
  offset: Vec3; aim: Vec3;
  /** intensity 0 = this lamp is not hung */
  color: Vec3; intensity: number; range: number; innerDeg: number; outerDeg: number;
  /** the emitter's size (m): what softens its shadows */
  radius: number; volumetric: number; broad: boolean;
}
export interface KitViewLight {
  /** the key: a porch lamp over the door · the fill: a wide soft panel out in the yard that lifts the men's backs off the ground */
  porch: KitViewLamp & {
    /** a small glowing box that gives the lamp a source in the picture: its centre the same way as `offset`, its half extents [along the wall, up, out] and
     *  the radiance of its faces as a multiple of `color` (absent = none) */
    fixture?: { at: Vec3; half: Vec3; glow: number };
    /** ITS INTENSITY BY DAY — at an hour whose outside lamps are out (game/hours.ts HourDef.lamps false: midday, the grey day; the level's own
     *  `exterior` fixtures are opened by the same photocell). Absent: 0 — the lamp and its glowing box are not hung in full sun. A way under a roof
     *  (the plan's `indoors`) is on no photocell: `intensity` at every hour */
    day?: number };
  fill: KitViewLamp;
  /** the level's own interior lights, times this (0 = their groups switched off, 1 = as authored); the exterior group and every weapon light are left alone */
  roomLights: number;
  /** on a night (the level's `moon` is lit): the moon's intensity and the sky's two colours, times these */
  moonScale: number; skyScale: number;
  /** Sam's weapon light, the mark of the picked man: `on` false = off; else dim and tight, turned on `aim` (door-relative, as a lamp's) */
  sam: { on: boolean; intensity: number; innerDeg: number; outerDeg: number; volumetric: number; aim: Vec3 };
}
/** a way's `light`: any of the table's keys, a lamp's or Sam's own keys one by one */
export interface KitViewLightOver { porch?: Partial<KitViewLight['porch']>; fill?: Partial<KitViewLamp>; roomLights?: number; moonScale?: number; skyScale?: number; sam?: Partial<KitViewLight['sam']> }
export interface KitViewWay {
  /** the way-in door the team is stood at (a door id) — or none, where the way is anchored on a `span` (below) */
  door?: string;
  /** which side of the door the stack forms on, along the wall: 1 (absent) = past the jamb away from the hinge, -1 = the hinge's side */
  side?: 1 | -1;
  /** the camera (radians; FollowCamera.pin's yaw and pitch): absent = worked out from the wall. the picture is framed on the way's five places whatever the team's size, and `dist` is only where the fit to the page starts from */
  pin?: { yaw: number; pitch: number; dist?: number };
  /** authored places, [x, z, yaw in degrees (0 = +z, 90 = +x)]: [0] Sam, then the teammates from the door outward. A man with no slot takes the worked-out one —
   *  and ONE PLACE CAN BE WRITTEN ALONE: `null` holds a place that is left to the plan (`[null, null, [x, z, yaw]]` = the second stack man's only) */
  slots?: ([number, number, number] | null)[];
  /** laid over src/host/kitView.ts KIT_VIEW_LIGHT, key by key */
  light?: KitViewLightOver;
  /** out of the picture, in this instance only: `hide` = box ids, or box groups whole; `hidePaint` = box groups of which only the paint on the ground goes
   *  (boxes under 1 cm half-height: a look file's floor decals and the level's painted marks, not what stands on it) */
  hide?: string[]; hidePaint?: string[];
  /** ONE THING MORE OUT OF THE PICTURE, the plan's own list kept (box ids, or box groups whole): added to what goes — to what the plan works out where the
   *  way writes no `hide` (a written `hide` REPLACES that list; this never does), to the written `hide` where it does. A piece of the building named here
   *  is the author's word that it goes: the plan's "not a thing to sink" is not said of it */
  hideMore?: string[];
  /** = light.roomLights */
  roomLights?: number;
  /** THE ANCHOR WHERE THERE IS NO DOOR (src/host/kitViewPlan.ts): `span` = two floor points [x, z] — a stretch of blank wall to breach, or the two posts of an
   *  open gate; the file then writes no `door`: no leaf to push, crack or charge — the rows that work a leaf play the gun's there (src/host/kitView.ts `Row.leaf`).
   *  `kind` says which ('door' with a `door`; a span: absent = measured — wall between its ends 'wall', open floor 'gap') */
  span?: [[number, number], [number, number]]; kind?: 'door' | 'wall' | 'gap';
  /** this way is staged on a BESPOKE SET, not in the level: a key of the block's `sets`. `door` / `span` / `slots` / `hide` are then the set's */
  set?: string;
  /** WHAT kitViewPlan MEASURES, written down (each absent = measured; an authored one is taken as written and never corrected): a point on the team's
   *  side of the anchor (absent: Sam's start for the way) · which side of the anchor the stack falls on screen · the spacing the authored stack `slots`
   *  were laid out at (absent: read off slots[1] → [2]; under the picture's 1.1 m they are spread to it) · the wall at the anchor: its face on the team's
   *  side from the anchor's line, its thickness, its top (m) · the card switch's lane, m out from the file · free floor in front of the face and behind
   *  the anchor's line (m) · the pane a gun is shown through (a Glass box's id, and where the man stands [x, z, yaw°]); false = none · boxes (ids or
   *  groups) the camera's own occluder test must leave standing · the men are under a roof · light groups left lit with the room lights out */
  ref?: [number, number]; hand?: 'left' | 'right'; slotGap?: number;
  wall?: { face?: number; thickness?: number; top?: number };
  lane?: number; out?: number; inside?: number;
  pane?: { box: string; stand?: [number, number, number] } | false;
  show?: string[]; indoors?: boolean; keepLights?: string[];
  /** THE WAY'S OWN LAMPS THAT BURN BY DAY. The way's own lamps — its set's `lights`, its `add.lamps` — are on the level's photocell as the porch lamp is
   *  (src/host/kitViewPlan.ts kitPlanDayOut): at an hour whose outside lamps are out (game/hours.ts HourDef.lamps false: midday, the grey day) a way under
   *  the open sky has them OUT, each with its fixture's glow, as the game's own photocell takes the level's `exterior` fixtures (a set's gate lamp burned at
   *  noon with its box glowing) — all but a lamp that stands UNDER A COVER (a ceiling or a roof over it: a room's lamp, lit at every hour as the game
   *  leaves rooms). Lamp ids or light groups written here burn at every hour. Absent: none. A way under a roof (the plan's `indoors`) is on
   *  no photocell; a lamp in the group `exterior` is the game's own photocell's, whatever is written; a sun or a moon (`dir`) is no lamp. A name that is
   *  no own lamp of the way is a plan problem */
  dayLights?: string[];
  /** THE ROOM BEHIND THE ANCHOR STAYS LIT (absent: it goes out with every room light — the wedge the picture shows behind the wall is then dark unless a
   *  yard lamp reaches it): the light groups with a lamp BEHIND the wall's far face that reaches the floor a metre in (src/host/kitViewPlan.ts
   *  kitPlanLitInside) are left lit as well as `keepLights` (written or measured). A level's own way; a set keeps its lamps lit anyway */
  litInside?: boolean;
  /** A LEVEL'S OWN WAY WITH A PIECE OR A LAMP MORE (a weak real door shows its place without a whole set): boxes and lamps in the level format's own
   *  records and in LEVEL coordinates, present in the picture only — `?kitview` lays them in AFTER the level's own (src/host/kitViewSet.ts kitViewAddLevel:
   *  box i of the level is still box i), the mission never loads them. The plan has the boxes on its floor like any box of the level and leaves the lamps' groups lit —
   *  and an added piece is SHOWN: never sunk for standing in the camera's line; where it hides a man or stands on the line of places the plan's problem
   *  names it (the way's `show` with its name: it stays; its `hide` with its name: it goes). A box's `material` may be look alternatives 'a|b', as a set's.
   *  Ids new to the level's own records (two ways may write the same id: one way is ever laid in), each record under the level format's own rule;
   *  never on a way that names a `set` (the set is the place to put them). `laid` is the LOADER's word, never a file's: the level this block rides on has
   *  the records in it already (the picture's built level: the plan lays nothing twice, the validator asks that they ARE there) */
  add?: { boxes?: BoxData[]; lamps?: LightData[]; laid?: boolean };
}
/** A BESPOKE SET for the picture (the owner, 10-15: "feel free to make a bespoke set for the gear screen if there isn't a good existing one in the level
 *  already. it should then just show off the vibe of the level / be recognizable"): a small stage the picture loads INSTEAD of the level's geometry — a
 *  wall with a door or a gate, a pane, a lamp, a few things of the level's — in the level format's own records, so its boxes take the level's `materials`
 *  by name and the picture keeps the level's sky, hour and weather. World metres, inside the world's bounds; it brings its own ground. `ref` = a point on
 *  the team's side of its anchor (no team start of the level means anything on a set). */
export interface KitViewSet { boxes: BoxData[]; doors?: DoorData[]; lights?: LightData[]; ref: [number, number] }
export interface KitViewData { ways: KitViewWay[]; /** the bespoke sets a way may name (`set`) */ sets?: { [name: string]: KitViewSet } }
/** THE RESPONSE TEAM (game/qrf.ts, behind its switch RESPONSE.on): the men who come from OUTSIDE the level once its own net has called for them. It is part
 *  of a level's design, not a rule of the game: a level carries this block only where somebody would plausibly come (`why` says who, in the level's own
 *  terms), and a level without it has no team — nothing is promised on its radio and nobody is stood up. Every point is floor (y 0). Checked against the
 *  built floor by game/qrf.ts checkResponse (tools/qa/response-check.ts): free cells, a walk from every muster to its fan and on into the level, the door a
 *  way names. A way's `name` is spoken on the net and drawn on the HUD's radio strip: no compass word in a new one. */
export interface ResponseWay {
  /** the way in as their net says it, with its article ('the main gate', 'the west stairwell') */
  name: string;
  /** the door they come through, thrown open as they arrive (absent: an open way — a gap in a wall, a road — they walk in by) */
  door?: string;
  /** where the men are stood up ten seconds before they come, in element order (#1 nearest the way in), out of sight of the floor: four marks */
  muster: Vec3[];
  /** the fan they take just inside, in the same order, and the way each man faces there (Character yaw: 0 south, π/2 east) */
  entry: Vec3[]; entryFace: number[];
  /** how control says they are coming ('coming up the west stairs'; absent: 'coming in by <name>') */
  coming?: string;
  /** who is told to stay clear as they come in ('nobody west of the lobby arch'; absent: nothing is added) */
  clear?: string;
  /** boots on stairs through the door before it goes (the office's stairwell); absent or false: no such sound */
  stairs?: boolean;
}
/** an outside post of the lockdown tier: where a man stands, the way he faces, and the stretch of wall his light sweeps (two points, y ≈ 1) */
export interface ResponsePost { name: string; pos: Vec3; yaw: number; sweep: [Vec3, Vec3] }
export interface ResponseData {
  /** WHY THIS PLACE HAS ONE, in a sentence of the level's own design: who they are and where they come from. Words for the level's write-up and its
   *  checks (the game never reads it); a block without it is refused */
  why: string;
  /** the place as control addresses it ('two-six', 'the post') and with its preposition ('on two-six', 'at the post') */
  site: string; at: string;
  /** the team as the net names it, with its article ('the response team', 'the army picket'), and the stem of its men's callsigns ('QRF' → QRF-1; absent: 'QRF') */
  team: string; tag?: string;
  /** the ways in, the usual one first. A run is dealt one (RESPONSE.deal); a level may give only one */
  ways: ResponseWay[];
  /** how many come, fewest and most (2‥4; absent: the sandbox's number) and seconds from the call to the way in, shortest and longest (absent: the sandbox's).
   *  A run is dealt one of each from the game's own die; the level's first answer (deal off, or a call from the panel): the most men, the middle of the time */
  men?: [number, number]; eta?: [number, number];
  /** the lockdown past the team (a man of theirs down, three of the floor's found down, a running gunfight): the outside posts in the order they are manned,
   *  and where its own men are stood up when the character budget has room. Absent or empty: this place has no second tier */
  posts?: ResponsePost[]; outside?: Vec3[];
  /** WHERE THEY LOOK WITH NO WORD TO GO ON, on a floor with no room plans: the places a team sent here would walk to and look at, by name (free floor each).
   *  Absent: the quiet block's spots and scenarios.places' areas, by their middles */
  sweep?: { name: string; pos: Vec3 }[];
  /** A SQUAD'S RAID ON THIS PLACE BRINGS THEM (game/qrf.ts RESPONSE.raid): the team stands with the defenders against the squad and is counted inside the
   *  eleven; it is asked for by a defender who heard gunfire and has lived a few seconds since to say so — a man of `room` (a scenarios.roomClear room id:
   *  where this place's set, or its telephone, is) or, with no room named, any of them. Those men down first, nobody calls. A block with `raid` answers
   *  raids only; one without answers a quiet night gone loud, never a raid */
  raid?: { room?: string };
}
export interface LevelScenarios { nightBreach?: NightBreachData; roomClear?: StructureData; rescue?: RescueData; places?: PlacesData; quiet?: QuietData; lesson?: LessonData; par?: ParData; snatch?: SnatchData; defuse?: DefuseData; issue?: IssueData; kitView?: KitViewData; response?: ResponseData;
  /** WHAT A DOOR IS CALLED where its id cannot say it (game/doornames.ts, words.ts WORDS.doors): a row a door — its id and the name on the squad's rows
   *  and in a defender's call, written as it is read there ('yard gate', 'records side door': no 'the'). For a door whose id carries a bearing or a letter
   *  and that the room clear structure does not list (or a level with no structure): the HUD has no compass. No bearing in a name, no two doors of a level
   *  called the same (probes.ts words-doornames holds both, and the list of doors still owed a name); a door the level has, once (the validator). A door
   *  with no row keeps the name it had. Words only: not in the level's fingerprint. */
  doorNames?: { door: string; name: string }[] }

/** THE MISSION LIST'S GROUPS (ui/missions.ts draws a heading per group — the maintainer, 10-10: 'we can build out a few levels in groups. a tutorial group
 *  for all the gameplay systems could be good too'; 10-11: 'can we also reorganize the missions into nicer groups?'), in the order the list shows them. A
 *  group is a KIND OF PLAY, every mission is under exactly one, and none holds more than eight (probes.ts missions-list). SHOW, NOT TELL: a heading is a
 *  word or two; `line` is its tooltip, never drawn. A group with no row draws nothing. */
export type MissionGroup = 'tutorial' | 'training' | 'raids' | 'strongholds' | 'clock' | 'quiet-alone' | 'quiet-two';
export const MISSION_GROUPS: { id: MissionGroup; title: string; line: string }[] = [
  { id: 'tutorial', title: 'Tutorial', line: 'The game, a mission at a time' },   // (game/rails.ts: missions on rails — one thing at a time, everything not yet met switched off)
  { id: 'training', title: 'Training', line: 'One family of systems at a time' },
  { id: 'raids', title: 'Raids', line: 'Small buildings, up to seven defenders' },   // (where a squad's mission that names no group falls: ui/missions.ts groupOf)
  { id: 'strongholds', title: 'Strongholds', line: 'Eight to eleven defenders' },
  { id: 'clock', title: 'On the clock', line: 'A hostage, a runner, a charge or a par time' },
  { id: 'quiet-alone', title: 'Quiet, alone', line: 'Light, noise and cameras' },
  { id: 'quiet-two', title: 'Quiet, as two', line: 'You and one partner, silent from the start' },
];

/** a row of a LESSON group (the tutorial's missions, the Training levels): its own team size and no other, the kit as issued, no levers, no verdict kept */
export const lessonGroup = (g: string | undefined): boolean => g === 'training' || g === 'tutorial';

/** One row of a scenario list (what a picker shows and a URL starts): which kind, how many teammates, on which level file. THE SMALLEST SHAPE — nothing reads it
 *  in the game yet; `scenarioQuery` is how a row becomes the page's query string. */
export interface ScenarioEntry {
  id: string; title: string;
  kind: 'nightbreach' | 'roomclear' | 'rescue' | 'quiet';
  /** teammates: the pair or the four (the rescue is the pair's as built); a quiet mission's is nobody or one partner */
  squad: 0 | 1 | 2 | 4;
  /** which heading of the mission list it sits under (MISSION_GROUPS; absent = by what it is — ui/missions.ts groupOf: quiet by its team, a rescue 'clock', else 'raids') */
  group?: MissionGroup;
  /** this row deploys at ITS OWN SIZE and no other, as a Training row does: the line every other size shows greyed on the loadout screen (game/loadout.ts
   *  squadChoices). A design call, not an inability: the level still stages any size from a URL or a harness tool (loadout-probes.ts knows the difference) */
  only?: string;
  /** a file under levels/ (absent = the bundled office) */
  level?: string;
  /** THE ROW'S OWN HOUR AND WEATHER (game/rowset.ts, ROWSET.on): what a visit to this row is always started in — a tutorial mission's level is built for one
   *  hour and one sky (a fuel halt at dusk in dust, a plan laid by day). They win over the link's `hour=` / `weather=`, and the mission sheet draws no Hour
   *  or Weather row for such a row. Absent (every row but those): the visitor's pick, else the level's own night and weather, as ever. A weather a level can
   *  be STARTED in: never 'snow' (a level built for snow keeps its own and names none). Types only: nothing here imports the game */
  hour?: import('../game/hours').HourId; weather?: Exclude<import('../game/weatherKinds').WeatherKind, 'snow'>;
  /** the room clear's placement seed · a quiet mission's deal, pinned (absent: dealt from the page's die on every start) */
  seed?: number;
  /** the picker's one line under the title: what the scenario is for (scene/scenarioList.ts; absent = the title alone) */
  blurb?: string;
  /** A TUTORIAL MISSION'S OPENING CARD (ui/loadbrief.ts; display only): where we are and why, in a sentence or two · what this mission teaches, one short
   *  line a thing, five at most — the things, not their keys (the keys are each step's own line) */
  scene?: string; teaches?: string[];
  /** the picker tags the row 'untuned': it runs, nobody has balanced it */
  untuned?: boolean;
  /** CUT FROM THE MISSION LIST (the maintainer's tap, 2026-10-13: 'Three' — the four-man office room clear and both yard rows, then the block's three-squads row): the row stays in this table,
   *  so its id, its own address, its level file and every check that names it hold as they were; no list draws it (ui/missions.ts listedMissions;
   *  `?offlist=0` draws it again) */
  offList?: boolean;
  /** DISPLAY ONLY — the mission list's sheet (ui/missions.ts); nothing in the game reads these three. Where it is, in a few words */
  place?: string;
  /** which way the run leans: sneaking, shooting, or the player's choice */
  lean?: 'quiet' | 'loud' | 'either';
  /** how many men hold the floor against the team as the row stages it (tools/qa missions probe boots each row and counts) */
  defenders?: number;
  /** DISPLAY ONLY — THE WAYS IN, named for the mission sheet's 'Way in' row (ui/missions.ts): the level's own team start first, then each of its
   *  `scenarios.roomClear.starts` in the file's order (tools/qa/fresh-start-check.ts holds the count against the level file). Absent = one way in, no choice. */
  ways?: readonly string[];
  /** DISPLAY ONLY — the level's file names defender SQUADS (`scenarios.roomClear.squads`): the mission sheet and the short list then word Hard as the squads' own
   *  there, never the one pool's (game/difficulty.ts `squadsOf`; tools/qa/levers-probes.ts holds every row against its level file). Absent = one pool. */
  squads?: boolean;
}
/** the query string that boots an entry: `?levelFile=<file>&roomclear=<seed>&squad4` */
export function scenarioQuery(e: ScenarioEntry): string {
  const q: string[] = [];
  if (e.level) q.push(`levelFile=${encodeURIComponent(e.level)}`);
  q.push((e.kind === 'roomclear' || e.kind === 'quiet') && e.seed !== undefined ? `${e.kind}=${e.seed}` : e.kind);
  if (e.kind === 'quiet') { if (e.squad === 1) q.push('squad=1'); }   // (alone is the kind's own size: no key)
  else if (e.squad === 4) q.push(e.kind === 'rescue' ? 'squad=4' : 'squad4');   // (the rescue reads the loadout's count, never the room clear's flag)
  return '?' + q.join('&');
}
