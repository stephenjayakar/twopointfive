// The ROOM CLEAR (?roomclear[=seed], native --roomclear, __roomclear): the night team breach (nightbreach.ts) on a bigger floor — a small STRUCTURE of four connected
// rooms of the office's east wing, each held, to break down room by room with the same pair of teammates. A playtest scenario like the night breach it stands on,
// staged on the old office with what the demo already has.
//
// WHAT THIS FILE OWNS: the set-up and the score-keeping. The structure is LEVEL DATA (scene/scenarios.ts StructureData: Level.scenarios.roomClear — the office's is
// levels/office.scenarios.ts, exported here as STRUCTURE for its probes; a level with no breach plan gives the team's start too and has no F drill) — the rooms, the doors into each and what lies on the other side
// of them, how many men hold each room and the marks they may stand on (more marks than men: placeDefenders(seed, attempt) deals them, so a tally re-runs a
// placement by its seed and a restart can deal another); the per-room CLEARED state (RoomClearScenario.rooms); and the two ENDS — 'taken' (every room clear) and
// 'wiped' (Sam down). What it does NOT own: how either side fights and how the pair is ordered about. Both are the night breach's as it stands — the defenders are
// its held, pinned men of the fight AI with their guns on the door their mark watches, its blind fire included; the pair is its two operatives and F is still its
// two orders (stack up on the break room's west door, go) and nothing else, so nobody follows Sam on to the next room. This scenario IS the night breach while it is
// up: `game.nightBreach.active` is true, its cast lists hold everybody (`ops` the pair, `hostiles` all the defenders in placement order), and every gate keyed on
// it (no civilians, the response team and the cameras silent, no checkpoint, no attract mode) holds here with no line of its own. What tells the two apart is
// `game.roomClear.active` — THE flag to read for anything that should be on under ?roomclear and off under ?nightbreach.
//
// HOW IT HANGS ON THE NIGHT BREACH: one seam, nightbreach.ts NightBreachLayout. start() here hands the night breach's start() a layout; its staging then asks the
// layout for the defenders' marks instead of taking the breach plan's three (the drill is handed only the break room's men — the room behind ITS door), calls
// staged() once the cast stands, leaves the 'room clear' / 'point man down' calls to this file, and its stop() drops the layout. So every restart under it (Sam
// down and Enter, Shift+Enter, the pause card, restage()) stages the structure again through the night breach's own hook, and nothing else in the game knows this
// file exists but Game (the field, the tick) and the mission (mission.ts: the objective line and marker are this scenario's while it is up, and the stealth
// mission's stages — reach the server room, pull the drive, the fire exit — stand still: two of its three places are inside the structure).
//
// CLEARED: a room is clear while none of its own garrison is up AND no living defender stands inside its bounds on his own feet (so a man of another room who
// walked in — nobody does today: they are pinned — would hold it, and a room can be lost again; a man in Sam's arm holds nothing but still counts as up for his
// own room). Down is down however it came: shot, struck or choked. Nobody has to have walked in or
// looked: men dropped through the doorway from outside clear the room. That is the bookkeeping's truth, said on the HUD as it happens (ROOMCLEAR.announce) — with a
// fog of war over the floor that line tells the player something he may not have seen, which is the fog's to decide.
//
// With the flag off none of this runs: tick() returns on its first line and the layout seam is null. (src/game is one import cycle: the tables below are plain
// literals, nothing here is built from another game module's exports at module load.)
import { Vec3, v3 } from '../math/vec';
import { mulberry32 } from '../math/dice';
import type { Game, Guard } from './game';
import type { RoomClearPlan } from '../scene/level';
import type { NightBreachLayout, NightBreachMark } from './nightbreach';
import type { StructureRoom, StructureData, TeamStart, SquadData } from '../scene/scenarios';
import { SQUAD_MAX_MEN } from '../scene/scenarios';
import type { Door } from './doors';
import { frameOf } from './guards';
import { runnerFled } from './runner';   // (asked inside tick only)
import { responseUp, responseTeam } from './qrf';   // (asked inside tick only: a raid's team still up)
import { OFFICE_SCENARIOS } from '../../levels/office.scenarios';   // (plain literals with type-only imports: safe at the top of the game's import cycle)
import { inBounds } from './squad';
import { squadsStage, squadsStop, squadsTick } from './enemysquads';
import { squadDeal } from './squaddeal';
import { difficultyHere } from './difficulty';
import { lastStandHint } from './laststand';
import { w, WORDS } from './words';   // (a leaf: the dialogue pass's one switch)
import { SAMESTART } from './samestart';   // (a leaf: every mission starts the same way on every try)

/** The scenario's knobs (Tab ▸ Sandbox ▸ Room clear, __roomclear.knobs; read at the next staging). */
export const ROOMCLEAR = {
  /** which placement the defenders are dealt (placeDefenders): 0 = the authored one on the first staging. Changed while it is up, the next staging deals the new
   *  seed's first placement. */
  seed: 0,
  /** every restart under it deals the next placement of the same seed (attempt 2, 3, …); off = the same men on the same marks every time */
  reroll: true,
  /** the room-by-room calls on the HUD ('storage clear — 2 rooms to go') and the objective line's ticks */
  announce: true,
  /** a tally's setting: Sam is not in the fight (he stands idle, unseen), so the team IS the pair — both of them down ends it 'wiped'. Off (play): only Sam going
   *  down ends it; with the pair gone the rest is his to take alone. */
  pairOnly: false,
  /** A FRESH PLACEMENT EVERY VISIT: a start that names no seed, with the knob above at 0, on a Game that owns a die (math/dice.ts — the page's always does, fresh
   *  per load; `?seed=N` pins it) deals the placement of a seed read off that die's own seed instead of the authored one: the same level never opens twice on the
   *  same marks. The die is not drawn, so nothing else of the run moves. ON in the page (host/profile.ts pageSwitches; `?freshstart=0` = the authored placement on
   *  every load, as before), off here and on the frozen harness stand; a Game with no die of its own (every harness tool unless it asks for one) is never touched. */
  fresh: false,
  /** THE WAY IN: which of the level's team starts the team is stood on — 0, as shipped, and 1 = the structure's own `team`, k = its k-th (`starts[k − 2]`; past
   *  the last = the last): the way in is the PLAYER'S PICK (the mission sheet's 'Way in' row puts `way=N` on the link — ui/missions.ts), never a surprise.
   *  −1 = DEALT (`?way=any`, the row's 'Dealt'): on a FRESH visit (the switch above on, a start that named no seed, a Game with a die of its own) one of them is
   *  taken off that die's seed, else the structure's own. Decided when the scenario STARTS (a restart keeps the way in and deals other marks). A level with no
   *  `starts` has one way in whatever this says. (Scripted tallies, 24 seeds a level: a second way in costs the scripted commander 16‥21 teammates of 96 — it is
   *  another problem, not the same one from another side, which is why no visit is handed one unasked.) */
  way: 0,
};
/** the placement seed a fresh start deals for a Game's die (1‥9973: never 0, the authored placement's) */
export function freshSeedOf(diceSeed: number): number { return 1 + (diceSeed >>> 0) % 9973; }
/** which of a level's `n` ways in a fresh start takes for a Game's die (0 = the structure's own; another reading of the seed than the placement's) */
export function freshWayOf(diceSeed: number, n: number): number { return n > 1 ? (diceSeed >>> 0) % 7919 % n : 0; }

/** The structure's shapes are level data now (scene/scenarios.ts — a level's `scenarios.roomClear` block): the rooms, the doors into each and what lies on the
 *  other side of them, how many men hold each room and the marks they may stand on. */
export type { StructureDoor, StructureMark, StructureRoom, StructureData } from '../scene/scenarios';
/** THE OFFICE'S STRUCTURE (levels/office.scenarios.ts: the east wing's four rooms) under the name its probes and its tally import it by. The GAME never reads
 *  this: a staging takes the structure of the level it stands on (RoomClearScenario.structure = Level.scenarios.roomClear). */
export const STRUCTURE: StructureData = OFFICE_SCENARIOS.roomClear;

/** one dealt defender: his room (STRUCTURE id), which of its marks, and the mark itself */
export interface Placement { room: string; mark: number; pos: Vec3; watch: string; aimAt: Vec3; name: string; }
/** WHO STANDS WHERE, a pure function of (seed, attempt): seed 0's first attempt is the authored placement (each room's first `garrison` marks); anything else
 *  deals each room's garrison from its marks off mulberry32 over the two numbers — never Math.random, so a tally's seed names a placement whatever else rolled dice.
 *  Rooms in STRUCTURE order, a room's men in mark order; the names run Tango 1‥N down that list. */
export function placeDefenders(seed: number, attempt = 1, S: { rooms: StructureRoom[] } = STRUCTURE): Placement[] {
  const authored = seed === 0 && attempt <= 1;
  const die = mulberry32((Math.imul(seed | 0, 0x9E3779B1) ^ Math.imul(attempt | 0, 0x85EBCA6B)) | 0); for (let i = 0; i < 4; i++) die();
  const out: Placement[] = [];
  for (const R of S.rooms) {
    const idx = R.marks.map((_, i) => i);
    if (!authored) for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(die() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
    for (const k of idx.slice(0, R.garrison).sort((a, b) => a - b)) { const m = R.marks[k]; out.push({ room: R.id, mark: k, pos: v3.copy(m.pos), watch: m.watch, aimAt: v3.copy(m.aimAt), name: `Tango ${out.length + 1}` }); }
  }
  return out;
}

/** how near a mark may stand to a piece of furniture at its rest place: a man's body (player.ts BODY_R 0.42) and a hand's width */
const MARK_CLEAR_M = 0.45;
/** The structure against the level it stands in — every problem, in words (empty = sound): its doors exist, a room's bounds are its doors' clear plans' bounds, it
 *  has marks enough for its garrison, every mark is on floor a man can stand on inside its room — clear of the furniture, which the nav grid does not know —
 *  watches one of its room's doors and has a line past the WALLS to the point it aims at, the men fit the character budget beside Sam and the pair, and at least
 *  one room has more than one way in. All of it is asked of the level as authored (statics, the props' rest places), never of where a leaf or a chair happens to be
 *  this frame: the staging puts both back. start() refuses on the first of them; probes.ts roomclear-data prints them all. */
export function checkStructure(g: Game, S: { rooms: StructureRoom[]; team?: TeamStart; starts?: TeamStart[]; maxMen?: number; squads?: SquadData[] } | undefined = g.level.scenarios?.roomClear): string[] {
  if (!S) return ['this level has no room clear structure (its scenarios.roomClear block)'];
  const bad: string[] = [];
  const nav = g.col.nav;
  if (!g.level.breach && !(S.team?.ops && S.team.ops.length >= 2)) bad.push('the level has no breach plan, and the structure does not say where the team starts (team.sam, team.ops)');
  if (S.starts?.length && !S.team) bad.push('starts: other ways in are given beside the structure\'s own team start, never without one');
  // where the team starts — the structure's own start, then each other way in (`starts`): free floor, and a way on foot from Sam's mark to every teammate's and into every room
  for (const [k, T] of [S.team, ...(S.starts ?? [])].entries()) if (T) {
    const start = k ? `team start ${k + 1}` : 'team start', its = k ? `the team's start ${k + 1}` : "the team's start";
    if (k && !(T.ops && T.ops.length >= 2)) bad.push(`${start}: needs the teammates' marks (ops, two at least)`);
    for (const [who, p] of [['Player', T.sam], ...(T.ops ?? []).map((q, i): [string, Vec3] => [`teammate ${i + 1}`, q])] as [string, Vec3][]) {
      if (nav.isBlocked(p[0], p[2])) bad.push(`${start}, ${who} (${p[0]}, ${p[2]}): not on floor a man can stand on`);
      else if (who !== 'Player' && !nav.findPath(T.sam, p)) bad.push(`${start}, ${who}: no way on foot from the player's mark`);
    }
    for (const R of S.rooms) if (R.marks.length && !nav.isBlocked(T.sam[0], T.sam[2]) && !nav.isBlocked(R.marks[0].pos[0], R.marks[0].pos[2]) && !nav.findPath(T.sam, R.marks[0].pos)) bad.push(`${R.name}: no way on foot from ${its}`);
  }
  const men = S.rooms.reduce((n, r) => n + r.garrison, 0);
  if (S.maxMen && men <= Math.min(SQUAD_MAX_MEN, S.maxMen)) { /* a structure made for more (levels/block.json): the staging lifts the four-man squad's budget to fit — up to eleven, the skinning's sixteen with Sam and the four */ } else
  if (S.maxMen && men > 5) bad.push(`${men} defenders: the structure's maxMen is ${S.maxMen}${S.maxMen > SQUAD_MAX_MEN ? ` and at most ${SQUAD_MAX_MEN} fit beside the player and the four (sixteen characters are skinned)` : ''}`); else
  if (men > 5) bad.push(`${men} defenders: only five fit beside the player and the pair (eight characters cast shadows)`);   // (the same five beside the four-man squad — NIGHTBREACH.squad 4, ?squad4 — whose budget is ten: nightbreach.ts SQUAD4_BUDGET)
  bad.push(...checkSquads(g, S));
  if (!S.rooms.some(r => r.doors.length > 1)) bad.push('no room has more than one way in');
  for (const R of S.rooms) {
    if (R.garrison < 1) bad.push(`${R.name}: nobody holds it`);
    if (R.marks.length < R.garrison) bad.push(`${R.name}: ${R.marks.length} marks for ${R.garrison} men`);
    for (const d of R.doors) {
      if (!g.doors.byName(d.id)) bad.push(`${R.name}: no door '${d.id}' in the level`);
      const B = doorPlan(g, d.id)?.bounds;   // (a plan is for the room its door is entered INTO; the one door two rooms share has none)
      if (B && !sameBounds(B, R.bounds)) bad.push(`${R.name}: its bounds are not the level's clear plan's for '${d.id}'`);
    }
    R.marks.forEach((m, i) => {
      const at = `${R.name} mark ${i} (${m.pos[0]}, ${m.pos[2]})`;
      if (!inBounds(m.pos, R.bounds)) bad.push(`${at}: outside the room`);
      if (g.col.nav.isBlocked(m.pos[0], m.pos[2])) bad.push(`${at}: not on floor a man can stand on`);
      const prop = g.props.props.find(p => propGap(p, m.pos) < MARK_CLEAR_M);
      if (prop) bad.push(`${at}: ${propGap(prop, m.pos).toFixed(2)} m from ${prop.def.name} — he would stand in it`);
      if (!R.doors.some(d => d.id === m.watch)) bad.push(`${at}: watches '${m.watch}', which is no door of this room`);
      if (wallBetween(g, [m.pos[0], 1.6, m.pos[2]], m.aimAt)) bad.push(`${at}: no line from his eyes to the point he covers`);
    });
  }
  return bad;
}
/** The squads block against the floor (scene/scenarios.ts SquadData; what the file alone can say — refs, one squad a room, headcounts — is levelData.ts's and is
 *  asked again here, since a structure may reach the game without passing the validator: office.scenarios.ts, a probe's own): rally points and spawn points on
 *  floor a man can stand on, a rally inside one of its squad's rooms, spawns outside every room and joined on foot to the door they come by. Empty = sound; no
 *  squads block = nothing to say. */
export function checkSquads(g: Game, S: { rooms: StructureRoom[]; maxMen?: number; squads?: SquadData[] }): string[] {
  const Q = S.squads; if (!Q?.length) return [];
  const bad: string[] = [], nav = g.col.nav, owner = new Map<string, string>(), ids = new Set<string>();
  const men = S.rooms.reduce((n, r) => n + r.garrison, 0), cap = S.maxMen ?? 5;
  for (const q of Q) {
    const w = `squad '${q.id}'`;
    if (ids.has(q.id)) bad.push(`${w}: two squads share the id`); ids.add(q.id);
    const mine = (q.rooms ?? []).map(id => { const r = S.rooms.find(x => x.id === id); if (!r) bad.push(`${w}: no room '${id}' in the structure`); else if (owner.has(id)) bad.push(`${w}: room '${id}' is already squad '${owner.get(id)}'s`); else owner.set(id, q.id); return r; }).filter((r): r is StructureRoom => !!r);
    if (q.arrive ? mine.length > 0 : mine.length === 0) bad.push(q.arrive ? `${w}: a late squad holds no rooms` : `${w}: holds no room`);
    if (q.rally) {
      if (nav.isBlocked(q.rally[0], q.rally[2])) bad.push(`${w}: its rally point (${q.rally[0]}, ${q.rally[2]}) is not on floor a man can stand on`);
      else if (!q.arrive && !mine.some(r => inBounds(q.rally!, r.bounds))) bad.push(`${w}: its rally point (${q.rally[0]}, ${q.rally[2]}) is inside none of its rooms`);
    }
    for (const id of q.barricade ?? []) if (!mine.some(r => r.doors.some(d => d.id === id))) bad.push(`${w}: '${id}' is no door of its rooms — it cannot wedge it`);
    const A = q.arrive; if (!A) continue;
    const door = g.doors.byName(A.door);
    if (!door) bad.push(`${w}: no door '${A.door}' in the level to arrive by`);
    if (!(A.men >= 1) || A.spawn.length < A.men) bad.push(`${w}: ${A.spawn.length} spawn points for ${A.men} men`);
    if (A.men > cap) bad.push(`${w}: ${A.men} men can never fit maxMen ${cap}`);
    A.spawn.forEach((p, i) => {
      const at = `${w} spawn ${i} (${p[0]}, ${p[2]})`, inside = S.rooms.find(r => inBounds(p, r.bounds));
      if (inside) bad.push(`${at}: inside the ${inside.name} — a late squad starts outside every room`);
      if (nav.isBlocked(p[0], p[2])) bad.push(`${at}: not on floor a man can stand on`);
      else if (door && !doorSides(door).some(s => !nav.isBlocked(s[0], s[2]) && nav.findPath(p, s))) bad.push(`${at}: no way on foot to '${A.door}'`);
    });
  }
  for (const r of S.rooms) if (!owner.has(r.id)) bad.push(`the ${r.name} is in no squad (with a squads block every room is in exactly one)`);
  if (men > cap) bad.push(`${men} men in the rooms' garrisons: more than maxMen ${cap}`);
  return bad;
}
/** the floor a stride either side of a door's opening (its hinge-to-latch middle ± 0.9 m along the leaf's normal) */
function doorSides(d: Door): Vec3[] {
  const F = frameOf(d), cx = F.hx + F.ux * F.W / 2, cz = F.hz + F.uz * F.W / 2;
  return [[cx + F.nx * 0.9, 0, cz + F.nz * 0.9], [cx - F.nx * 0.9, 0, cz - F.nz * 0.9]];
}
const sameBounds = (a: StructureRoom['bounds'], b: StructureRoom['bounds']) => a.x0 === b.x0 && a.x1 === b.x1 && a.z0 === b.z0 && a.z1 === b.z1;
/** a floor point's distance to a prop's footprint where it RESTS (its home pose; 0 = inside it) */
export function propGap(p: { home: [number, number, number]; hx: number; hz: number }, at: Vec3): number {
  const dx = at[0] - p.home[0], dz = at[2] - p.home[1], c = Math.cos(p.home[2]), s = Math.sin(p.home[2]);
  return Math.hypot(Math.max(0, Math.abs(c * dx - s * dz) - p.hx), Math.max(0, Math.abs(s * dx + c * dz) - p.hz));
}
/** the sight line a→b against the level's STATICS alone: col.segmentBlocked with the door leaves taken out for the one call (a leaf swung across a mark's line
 *  on a living floor is no fault of the structure's — the staging shuts every one of them) */
export function wallBetween(g: Game, a: Vec3, b: Vec3): boolean {
  const leaves = g.col.dynamicBoxes; g.col.dynamicBoxes = [];
  try { return g.col.segmentBlocked(a, b); } finally { g.col.dynamicBoxes = leaves; }
}
/** the level's own stack-and-enter plan for a door, where it has one (plans.roomClear by door; the break room's west door is the breach plan's as well) — what an
 *  order to 'stack on that door' would run on */
export function doorPlan(g: Game, door: string): RoomClearPlan | null { return g.level.clearPlans?.find(p => p.door === door) ?? (g.level.breach?.door === door ? g.level.breach : null); }

export type RoomClearEnd = 'taken' | 'wiped';
export type RoomClearState = 'off' | 'live' | RoomClearEnd;
/** (words.ts) how long a room that came clear waits for others to be called with it */
const CLEAR_SAY_SECS = 0.6;
const listed = (a: string[], and: string) => a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} ${and} ${a[a.length - 1]}`;
/** the one line for rooms that came clear together: a room the team has stood in is 'clear'; one it never entered — its men died somewhere else — is only known
 *  to have nobody left, and is said so ('mess clear · nobody left in store or comms room') */
function clearWords(g: Game, rooms: StructureRoom[]): string {
  // (the room is asked of its first FLOOR point: its middle is often a table, which is no room at all to cleared.ts and reads as known)
  const stood = (r: StructureRoom) => {
    const b = r.bounds;
    for (let z = b.z0 + 0.25; z < b.z1; z += 0.5) for (let x = b.x0 + 0.25; x < b.x1; x += 0.5) { const id = g.cleared.roomAt([x, 0, z]); if (id) return g.cleared.isKnown(id); }
    return true;
  };
  const ours = rooms.filter(stood).map(r => r.name), theirs = rooms.filter(r => !stood(r)).map(r => r.name);
  return [ours.length ? `${listed(ours, 'and')} clear` : '', theirs.length ? `nobody left in ${listed(theirs, 'or')}` : ''].filter(Boolean).join(' · ');
}
/** one room as the scenario keeps it: its men, whether it is clear, and when it became so (game clock; NaN while it is held) */
export interface RoomState { def: StructureRoom; defenders: Guard[]; cleared: boolean; clearedAt: number; }

export class RoomClearScenario {
  readonly knobs = ROOMCLEAR;
  /** the structure of the level this game stands on (Level.scenarios.roomClear; null = the level has none, and the scenario cannot start) */
  get structure(): StructureData | null { return this.g.level.scenarios?.roomClear ?? null; }
  /** the rooms as staged, in the structure's order (empty while it is off) */
  rooms: RoomState[] = [];
  /** how it ended (null while it is being fought over), when on the game clock, and in a few words why */
  end: RoomClearEnd | null = null; endAt = NaN; endWhy = '';
  /** what a 'wiped' end is CALLED on the log and the objective row: 'team wiped' only when no teammate was up as it ended — Sam down with men still standing is 'Sam down' (words.ts: off = 'team wiped' always, as it was) */
  private endSay = 'team wiped';
  /** the placement on the floor: defender i of game.nightBreach.hostiles stands as placement[i] — and the (seed, attempt) that dealt it */
  placement: Placement[] = []; seed = 0; attempt = 0;
  /** the seed this start read off the Game's own die, dealt at a staging while ROOMCLEAR.fresh is on and the knob stands at 0; 0 = none (a start that named its
   *  seed, a Game with no die): the knob's seed */
  private fresh = 0;
  /** THE WAY IN the last staging stood the team on (ROOMCLEAR.way): 0 = the structure's own `team`, k = `starts[k − 1]`. Asked at every staging (`wayNow`), as
   *  the seed is: a fresh visit's way holds through its restarts, and a seed named or the switch thrown mid-run takes the next staging back to the structure's own. */
  way = 0;
  /** the way in a staging made now would take: pinned by the knob, a fresh visit's own off the Game's die where the knob asks for a dealt one (−1), else the structure's */
  private wayNow(): number {
    const K = ROOMCLEAR, S = this.structure, n = S?.team ? 1 + (S.starts?.length ?? 0) : 1;
    return K.way >= 1 ? Math.min(n, Math.floor(K.way)) - 1 : K.way < 0 && K.fresh && !SAMESTART.on && K.seed === 0 && this.fresh && this.g.dice ? freshWayOf(this.g.dice.seed, n) : 0;
  }
  /** the team start a staging made now stands the team on (null: the structure gives none) */
  private startNow(): TeamStart | null { const S = this.structure, k = this.wayNow(); return (k > 0 && S?.starts?.[k - 1]) || S?.team || null; }
  /** where Sam was stood by the last staging (the debrief's insertion pin); null while off or on a structure with no team start */
  get startAt(): Vec3 | null { const S = this.structure; return this.active ? ((this.way > 0 && S?.starts?.[this.way - 1]) || S?.team)?.sam ?? null : null; }
  /** what happened when, on the game clock: 'staged:<seed>/<attempt>', 'cleared:<room>', 'lost:<room>', 'pair:down', 'end:taken' / 'end:wiped' — what the probes
   *  and a tally read */
  log: { t: number; what: string }[] = [];
  private pairSaid = false; private entrySaid = false; private teamSaid = false;
  /** (words.ts) rooms that came clear and have not been called yet, and when the one line for them is due: a garrison that dies in ANOTHER room empties its own rooms on
   *  one frame, and each used to get a line of its own — four in 0.4 s */
  private clearDue: StructureRoom[] = []; private clearAt = NaN;
  private obj: { text: string; pos: Vec3 | null; ticks: boolean; hint: string } | null = null;
  private readonly layout: NightBreachLayout;
  constructor(private g: Game) {
    const self = this;
    this.layout = { name: 'room clear', defenders: () => this.deal(), staged: () => this.onStaged(),
      get budget() { const n = self.structure?.maxMen ? self.structure.rooms.reduce((k, r) => k + r.garrison, 0) : 0; return n > 5 ? 5 + n : undefined; },   // (a structure with maxMen: Sam, the four and its men)
      get team() { return self.startNow() ?? undefined; },   // (the structure's own start, where it gives one: a level with no breach plan has no approach marks to stand the team on — or the other way in this start took, ROOMCLEAR.way)
      stagedLine: () => `room clear — ${this.placement.length} armed men hold ${this.rooms.length} rooms: ${this.rooms.map(r => r.def.name).join(', ')}. ${!this.g.nightBreach.noDrill ? `F: stack up on the ${this.drillRoom()?.name ?? 'door'} · X: orders (door tools on any door)` : this.g.nightBreach.ops.length ? 'X: your orders (door tools on any door)' : 'You are alone'}` };   // (noDrill: a level with no breach plan, or a loadout of fewer than two — game/loadout.ts)
  }
  /** up: the night breach is staged on THIS scenario's floor */
  get active(): boolean { const nb = this.g.nightBreach; return !!nb && nb.active && nb.layout === this.layout; }

  /** why it cannot start right now (null = it can): the night breach's own reasons, and the structure's against this level */
  canStart(): string | null {
    const nb = this.g.nightBreach;
    if (nb.active) return 'the night breach is already staged — stop it first';
    if (!this.structure) return 'this level has no room clear structure (its scenarios.roomClear block)';
    return nb.canStart(this.layout) ?? checkStructure(this.g, this.structure)[0] ?? null;
  }
  /** Start it (`seed`: the placement to deal — written to the knob; absent = the knob as it stands). Already up, a different seed stages it again on that seed.
   *  Returns the reason when refused, or when the staging failed. */
  start(seed?: number): string | null {
    const want = seed !== undefined && Number.isFinite(seed) ? Math.floor(seed) : null;
    if (this.active) { if (want !== null) { ROOMCLEAR.seed = want; this.fresh = 0; if (want !== this.seed || this.wayNow() !== this.way) this.restage(); } return null; }   // (against the seed ON THE FLOOR, not the knob: the slider may already have been moved to it)
    const seed0 = ROOMCLEAR.seed, fresh0 = this.fresh;   // (written BEFORE the staging is asked for: the way in it is asked about is this start's, not the last one's — and put back if it is refused)
    if (want !== null) ROOMCLEAR.seed = want;
    this.fresh = want === null && this.g.dice ? freshSeedOf(this.g.dice.seed) : 0;   // (kept whatever the switch says: deal() and wayNow() ask the switch at every staging)
    const why = this.canStart(); if (why) { ROOMCLEAR.seed = seed0; this.fresh = fresh0; return why; }
    this.log.length = 0; this.attempt = 0;
    difficultyHere(this.structure?.name ?? '');   // (difficulty.ts HARD_AT: what hard is on this structure beside the build's hard)
    const r = this.g.nightBreach.start(this.layout);   // (a staging that throws has already stopped it, which drops the layout)
    if (r !== null || !this.active) { this.clear(); return r ?? 'the staging failed'; }
    return null;
  }
  /** Stop it: the night breach's stop — the cast gone, the shift back, a fresh night encounter. */
  stop() { if (this.active) this.g.nightBreach.stop(); this.clear(); }
  /** Stage it afresh (the knobs re-read; with `reroll` the next placement of the seed). */
  restage() { if (this.active) this.g.nightBreach.restage(); }
  private clear() { squadsStop(this.g); this.rooms = []; this.placement = []; this.end = null; this.endAt = NaN; this.endWhy = ''; this.endSay = 'team wiped'; this.pairSaid = this.entrySaid = this.teamSaid = false; this.obj = null; this.clearDue = []; this.clearAt = NaN; }
  private note(what: string) { this.log.push({ t: this.g.time, what }); if (this.log.length > 400) this.log.splice(0, 100); }

  /** the night breach's staging asks who the defenders are (NightBreachLayout.defenders): this staging's placement, the break room's men marked as the drill's.
   *  The attempt counts stagings of ONE seed since start(): a seed changed under it deals that seed's first placement. */
  private deal(): NightBreachMark[] {
    this.way = this.wayNow();   // (the night breach's staging has just read `layout.team` off the same answer)
    const K = ROOMCLEAR, same = SAMESTART.on, seed = K.seed !== 0 || !K.fresh || same ? K.seed : this.fresh, again = this.attempt > 0 && seed === this.seed;   // (SAMESTART: the knob's own placement — 0 = the level's, as written — on every visit and every restart, a named seed's first attempt too; ROOMCLEAR.fresh: the knob at 0 on a start that named no seed deals the seed read off the Game's die; this.fresh is 0 where there is none)
    this.seed = seed; this.attempt = again && K.reroll && !same ? this.attempt + 1 : 1;
    this.placement = placeDefenders(this.seed, this.attempt, this.structure!);
    const drillRoom = this.drillRoom()?.id;
    return this.placement.map(p => ({ pos: p.pos, aimAt: p.aimAt, name: p.name, drill: p.room === drillRoom }));
  }
  /** the room behind the breach plan's door (the one F's entry takes) — undefined if the plan's door is no door of the structure */
  private drillRoom(): StructureRoom | undefined { const door = this.g.level.breach?.door; return door === undefined ? undefined : this.structure?.rooms.find(r => r.doors.some(d => d.id === door)); }
  /** … and tells it the cast stands (NightBreachLayout.staged): every way into the structure shut, each room given its men, the score wiped */
  private onStaged() {
    const g = this.g, nb = g.nightBreach;
    const S = this.structure!;
    for (const id of new Set(S.rooms.flatMap(r => r.doors.map(d => d.id)))) { const d = g.doors.byName(id); if (d) { d.reset(); d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; } }   // (shut and latched as the drill shuts its own two; reset() has put each lock back as the level has it)
    const dealt = this.placement; this.clear(); this.placement = dealt;
    // (a man the staging posted outside his room — pressure.ts PRESSURE.picket — is of the room he stands in, so the one he left can be called clear behind him)
    const roomOf = (i: number) => (nb.marks[i]?.picket ? S.rooms.find(r => inBounds(nb.marks[i].pos, r.bounds))?.id : undefined) ?? dealt[i]?.room;
    this.rooms = S.rooms.map(def => ({ def, defenders: nb.hostiles.filter((_, i) => roomOf(i) === def.id), cleared: false, clearedAt: NaN }));
    squadsStage(g, squadDeal(S, dealt.map(p => p.room), !!g.level.scenarios?.lesson), nb.hostiles, dealt.map(p => p.room));   // enemysquads.ts: the structure's squads take their men (no squads block: nothing — or, squaddeal.ts, squads cut from its rooms)
    this.note(`staged:${this.seed}/${this.attempt}`);
  }

  /** Once a frame from Game.update, right after the night breach's own tick: the rooms' state and the two ends. A return on its first line while it is off. */
  tick(_dt: number) {
    if (!this.active) { if (this.rooms.length) this.clear(); return; }   // (stopped from under it — the night breach's own stop row, a staging that failed on a restart)
    const g = this.g, nb = g.nightBreach, K = ROOMCLEAR;
    if (!this.rooms.length || nb.hostiles.length !== this.placement.length) return;   // (between a despawn and the restage that answers it)
    squadsTick(g);   // enemysquads.ts: each squad's contact, news, choice and men on the move (a return on its first line with none staged)
    const live = nb.hostiles.filter(h => h.state !== 'dead' && !runnerFled(h));   // (runner.ts, false with its switch off: a man who dropped it and ran holds nothing and is nobody left to take)
    for (const R of this.rooms) {   // (kept after an end as well — the log stays true — but nothing more is said)
      const c = !R.defenders.some(h => h.state !== 'dead' && !runnerFled(h)) && !live.some(h => !h.held && inBounds(h.char.pos, R.def.bounds));
      if (c === R.cleared) continue;
      R.cleared = c; R.clearedAt = c ? g.time : NaN; this.obj = null; this.note(`${c ? 'cleared' : 'lost'}:${R.def.id}`);
      const left = this.rooms.filter(r => !r.cleared).length;
      if (WORDS.on) {   // one line for the rooms that come clear within CLEAR_SAY_SECS of each other; a room lost again inside that beat was never called
        const k = this.clearDue.indexOf(R.def);
        if (c) { this.clearDue.push(R.def); if (!(this.clearAt >= g.time)) this.clearAt = g.time + CLEAR_SAY_SECS; }
        else if (k >= 0) this.clearDue.splice(k, 1);
        else if (K.announce && left > 0 && !this.end) g.msg(`${R.def.name} is held again`);
      } else
      if (K.announce && left > 0 && !this.end) g.msg(c ? `${R.def.name} clear — ${left} room${left > 1 ? 's' : ''} to go` : `${R.def.name} is held again`);
    }
    if (this.clearDue.length && !(this.clearAt > g.time)) {
      const left = this.rooms.filter(r => !r.cleared).length, said = clearWords(g, this.clearDue); this.clearDue = []; this.clearAt = NaN;
      if (K.announce && left > 0 && !this.end) g.msg(`${said} — ${left} room${left > 1 ? 's' : ''} to go`);
    }
    const pairUp = nb.ops.filter(o => o.state !== 'dead').length, play = !this.end && !g.player.down && live.length > 0;
    if (!this.pairSaid && pairUp === 0 && nb.ops.length) { this.pairSaid = true; this.note('pair:down'); if (!K.pairOnly && play) g.msg(`${nb.ops.length > 2 ? 'the whole squad' : nb.ops.length > 1 ? 'both men' : 'your man'} down — the rest is yours`); }
    if (!this.entrySaid && nb.state === 'failed') { this.entrySaid = true; if (pairUp > 0 && play) g.msg(`point man down at the door — the ${this.drillRoom()?.name ?? 'room'} is yours to take`); }   // (the drill's entry is off with a man still up: he holds where he stands — nightbreach.ts)
    if (this.end) return;
    if (g.player.down) this.finish('wiped', 'player down');   // (first: the last defender and Sam down inside one frame is no win — the mission has failed and the down card is coming)
    else if (g.rails?.endsNow()) this.finish('taken', 'the mission is done');   // (a tutorial mission — rails.ts — is over when its last step is, whoever is still in a room)
    else if (g.rails?.holdsEnd()) { if (pairUp === 0 && nb.ops.length && (K.pairOnly || g.rails.skyOn)) this.finish('wiped', nb.ops.length > 2 ? 'the squad down' : 'the pair down'); }   // …and not before it (the men of a later beat are not on the floor yet) — but a team that is all down has still lost
    else if (live.length === 0 && !responseUp(g)) this.finish('taken', `${this.rooms.length} rooms clear, ${nb.ops.length ? `${pairUp} of ${nb.ops.length} teammates up` : 'alone'}`);
    else if (K.pairOnly && pairUp === 0 && nb.ops.length) this.finish('wiped', nb.ops.length > 2 ? 'the squad down' : 'the pair down');
    else if (live.length === 0 && !this.teamSaid) { this.teamSaid = true; this.obj = null; this.note('team-up'); if (K.announce) g.msg(`rooms clear — ${responseTeam(g)} still on the ground`); }   // (qrf.ts RESPONSE.raid: the place is not taken while the team it called is up — said once, and it stays on the objective row)
  }
  /** A man the night breach adopted after the staging (stress.ts — extra enemies) is this structure's too: a row of the placement and a man of his room, so the
   *  room is not clear and the structure not taken while he is up. After nightBreach.adopt, the same frame (tick holds while the two lists differ in length). */
  adopt(gd: Guard, p: Placement) { const R = this.rooms.find(r => r.def.id === p.room); if (!this.active || !R || R.defenders.includes(gd)) return; this.placement.push(p); R.defenders.push(gd); }
  /** laststand.ts: a defender who has made his stand in another room is THAT room's man from now on — the one he left can clear behind him */
  rehome(gd: Guard, room: string) {
    const to = this.rooms.find(r => r.def.id === room); if (!this.active || !to || to.defenders.includes(gd)) return;
    for (const R of this.rooms) { const i = R.defenders.indexOf(gd); if (i >= 0) R.defenders.splice(i, 1); }
    to.defenders.push(gd); this.obj = null; this.note(`rehomed:${gd.callsign}>${room}`);
  }
  private finish(end: RoomClearEnd, why: string) {
    this.end = end; this.endAt = this.g.time; this.endWhy = why; this.obj = null; this.note(`end:${end}`);
    this.endSay = w(end === 'wiped' && this.g.player.down && this.g.nightBreach.ops.some(o => o.state !== 'dead') ? 'player down' : 'team wiped', 'team wiped');
    const loose = end === 'taken' && this.g.snatch?.active && this.g.snatch.owes ? this.g.snatch.objective()?.text.replace(/^objective ▸ /, '') : null;   // (a snatch level, snatch.ts: the house is the team's and the man is not — it is not over)
    // (a defuse mission whose charge has gone off stays FAILED — defuse.ts: the house taken after that is said as what it is, never as a win)
    if (end === 'taken' && this.g.defuse?.active && this.g.defuse.end === 'failed') { this.g.msg(`the house is taken, too late — a charge went off: the mission stays failed. Shift+Enter stages it again`); return; }
    this.g.msg(loose ? `structure taken — ${why}. not over: ${loose}` : end === 'taken' ? `structure taken — ${why}. Shift+Enter stages it again` : this.endSay === 'player down' ? 'player down. Enter stages it again' : `team wiped — ${why}. ${this.g.player.down ? 'Enter' : 'Shift+Enter'} stages it again`);
  }

  /** where it stands, in one word */
  get state(): RoomClearState { return !this.active ? 'off' : this.end ?? 'live'; }
  /** who of the team is up */
  get team(): { sam: boolean; ops: number } { return { sam: !this.g.player.down, ops: this.active ? this.g.nightBreach.ops.filter(o => o.state !== 'dead').length : 0 }; }
  /** the room a floor point is in (STRUCTURE id; null = none of them — the corridor, the cubicles, a doorway's thickness) */
  roomAt(p: Vec3): string | null { return this.structure?.rooms.find(r => inBounds(p, r.bounds))?.id ?? null; }
  /** The HUD's objective while it is up (mission.ts objectiveText / objectivePos; null = the mission's own): the rooms, ticked off as they clear, and a marker on
   *  the first room still held (none once it has ended). Worded when something changes, not every frame. */
  objective(): { text: string; pos: Vec3 | null } | null {
    if (!this.active || !this.rooms.length) return null;
    const ticks = ROOMCLEAR.announce;
    const hint = this.end ? null : lastStandHint(this.g), hk = hint?.key ?? '';   // (laststand.ts, default off: the rooms the defenders' net has named — null with its switches off)
    if (this.obj && this.obj.ticks === ticks && this.obj.hint === hk) return this.obj;
    const said = (r: RoomState) => !!hint && !r.cleared && hint.rooms.has(r.def.id);
    const next = (this.rooms.find(said) ?? (hint?.spots.length ? null : this.firstOpen()))?.def.bounds;
    const spot = next ? null : hint?.spots[0] ?? null;   // (laststand.ts `places`: nobody named a room still held, and one of them named a place that is no room of the list — the marker goes there)
    const text = this.end === 'taken' ? 'structure taken — shift+enter stages it again'
      : this.end === 'wiped' ? `${this.endSay} — ${this.g.player.down ? 'enter' : 'shift+enter'} stages it again`
      : 'objective ▸ clear the structure: ' + this.rooms.map(r => (ticks && r.cleared ? '✓ ' : '') + (said(r) ? `[${r.def.name}]` : r.def.name)).join(' · ') + (hint?.spots ?? []).map(s => ` · [${s.name}]`).join('') + (this.teamSaid ? ` · [${responseTeam(this.g)}]` : '');
    this.obj = { text, pos: this.end ? null : next ? [(next.x0 + next.x1) / 2, 0, (next.z0 + next.z1) / 2] : spot ? [spot.pos[0], 0, spot.pos[2]] : null, ticks, hint: hk };
    return this.obj;
  }
  /** the room the marker stands on: the first still held in the level's order — on a second way in (way > 0) the one nearest that start, since the level's order
   *  was written from its own start and would point the team past the door they stand at */
  private firstOpen(): RoomState | undefined {
    const open = this.rooms.filter(r => !r.cleared), T = this.way > 0 ? this.structure?.starts?.[this.way - 1] : null;
    if (!T || open.length < 2) return open[0];
    const d = (r: RoomState) => { const b = r.def.bounds; return Math.hypot((b.x0 + b.x1) / 2 - T.sam[0], (b.z0 + b.z1) / 2 - T.sam[2]); };
    return open.reduce((a, b) => d(b) < d(a) ? b : a);
  }
  /** one line for the panel / the console */
  summary(): string {
    if (!this.active) return 'room clear off';
    const T = this.team;
    return `room clear ${this.state}${this.end ? ` (${this.endWhy})` : ''} · placement ${this.seed}/${this.attempt}${this.structure?.starts?.length ? ` · way in ${this.way + 1} of ${1 + this.structure.starts.length}` : ''} · ${this.rooms.map(r => `${r.def.name} ${r.cleared ? 'clear' : `${r.defenders.filter(h => h.state !== 'dead').length}/${r.defenders.length}`}`).join(' · ')} · team ${T.ops}/${this.g.nightBreach.ops.length}${T.sam ? ' + player' : ', player down'} · seed ${this.seed}/${this.attempt}`;
  }
}
