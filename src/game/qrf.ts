// The response to going loud (STATUS E12(0) — the maintainer: "right now it's just too easy to just go lethal and clear the area … add QRF"). One model, no magic:
// the trigger is what the floor's own alarm and ears already know (a locked-down floor that has HEARD Sam's gunfire — the hearing model's own 80 m gate for a
// report at level ≥ 1, so the suppressed pistol's odd noise never counts and the FN2000's crack always does — or has walked onto two of its men down), the
// telegraph is radio traffic on the net the HUD already shows (the request, control's ETA, thirty seconds, ten seconds — and boots on the stairs through the
// door), and the men are ordinary Guards (guards.ts spawnUnit, side 'guard': the shift's colleagues, Sam's enemies, on the same net) who come up the west
// stairwell, throw its steel fire door open into the corridor with their weapon lights behind it, and clear toward the last fix as ONE four-man element through
// the squad runner (squad.ts order): a file behind the point man's own trail, muzzles covering the openings either side and the rear, the room holding the fix
// stacked on, banged and flowed into by all four (the level's own RoomClearPlan marks for the first two, the deep point and the door for three and four),
// called, held all round for a beat, then the next room by walking distance — until one of them SEES him (the shared sight test at the shared rate, or a bump,
// or a colleague held in front of them), when all four are handed to the ordinary alert AI (closing, bursts, muzzle discipline, suppression, the standoff) and
// re-formed once nobody has had him for eight seconds. Carbines with lights, one stun charge a man, hard men, trained hands (aim.ts TRAINED), short beats.
// They never stand down, never leave, and there is one wave a night (a second request is refused on the radio). Past that — a QRF man killed, three men down,
// or a running gunfight — control locks the COMPOUND down: the exterior lamps come up and men take posts outside every exit (spawned if the renderer's
// character budget has room; on this floor it has none — Sam + 3 staff + 4 QRF is the 8 the shadow-capsule list holds — so the element's rear pair peels off
// and jogs out through the doors to them), pinned there covering the doors from outside: leaving by the fire exit is now a walk into their arcs.
// State on Game.qrf; knobs on Game.tune (qrf / qrfEta / qrfSize / perimeter / perimeterEta / perimeterSize, Tab ▸ Sandbox, kept per machine); reset with the
// guards (Game.resetGuards → resetQrf; the men are units, resetGuards despawns them). Never under the tour, the breach's daylight, or with the AI off.
// THE ROOM IS TAKEN BY THE SQUAD'S OWN CODE (tune.qrfSquad — the page ships it on; off = the element's own drill below on the level's authored marks, as it
// was): at the door the four are handed, as a second cast (squadcast.ts), to the very classes Sam's squad runs — doortools.ts's stack on the jambs worked out
// from the door, the hand on the leaf, the can, who goes first, each man's corners, the search that flows them on through the room until none of its floor
// is unseen; orders.ts's walk onto a mark and pose on it. A room that holds the fix is banged and entered; any other is worked from the threshold first
// (sliced from the jambs, its blind pocket banged) and then stepped into. What the squad's code learns, they have with no second edit. Everything else is
// still theirs: when, where to, the file down the corridor, their senses, and the fight on contact (startDrill / phaseDrill).
// THE TEAM IS THE LEVEL'S OWN (`RESPONSE` below — the page ships it on; off = everything above on the office's one stairwell, as it was): a level has a
// team only if its file says so (scenarios.response: who they are, the ways they come in by, how many and how soon as ranges, where the second lift
// stands, and WHY this place has one), each call is dealt a way, a size and a time off the game's own die, the radio speaks the level's words, and where
// they go is what was SAID on the defenders' net (picture.ts: an idea a man on the net held long enough to say, or was told) — kept by control past the
// man who said it — or the alarm's own place, never where the player is. With nothing said, on a floor with no room plans, they walk the level's named
// places. Whoever is against them on the level (a partner, a teammate) is their enemy by the shared sight test, not Sam alone.
// QA: tools/qa/qrf-probes.ts (`probes.ts qrf`), soak.ts --loud-at; tools/qa/qrf-squad-check.ts (the squad's drill); tools/qa/response-check.ts (the level's own team).
import { SideSet } from '../math/side';
import { QRF_TINT, QRF_TINT2 } from './consts';
import { Vec3, v3, clamp, wrapAngle } from '../math/vec';
import { TOSS_QUICK } from './character';
import { toolSpot } from './handleside';
import type { Game, Guard } from './game';
import type { RoomClearPlan } from '../scene/level';
import type { ResponseData, ResponsePost } from '../scene/scenarios';
import type { Door } from './doors';
import type { Item } from './throwables';
import { radioHand } from './handwork';
import { MAX_SKINNED, spawnUnit, despawnUnit, escalationOf, hearingCheck, canSee, canSeeChar, sightGain, sightGainOn, bodyInView, pointInView, standoffPerceive, resetChase, bodyPos, bubbleSecs } from './guards';
import { hostileTo, foeChar } from './teams';
import { PICTURE, ideasOf } from './picture';
import { runnerOwns } from './runner';
import { SQUAD_MAX_MEN } from '../scene/scenarios';
import { order, endGuardScript, inBounds } from './squad';
import { sideOf } from './orders';
import type { DoorOp } from './doortools';
import { squadCast, EVERY_KEY, type SquadCast } from './squadcast';
import { detonateStun } from './combat';
import { isDaylight, setGroup } from './lighting';
import { roomName } from './dialogue';
import { doorLabel } from './tactics';
import { WORDS, w, wg } from './words';
import { doorWrittenName } from './doornames';   // (a leaf: the name a level wrote for a door)
import { TRAINED } from './aim';
import { tally, missionLive } from './mission';
import { isBreathing } from './game';
import { chronRadio, chronicle } from './chronicle';
import { simRandom } from '../math/dice';   // the simulation's die (math/dice.ts): the Game's own when it has one, Math.random otherwise
import { railsDown } from './rails';   // (a spared teammate on his knee is nobody the response makes out: asked inside its sight loop only)

// ================================================================ authored marks (TODO(level-format lane): these belong in LevelData beside routes / chokepoints / clearPlans)
/** Everything the response needs from THIS level: the door it comes through, where the men stand on the landing behind it (in element order: #1 at the bar), the
 *  fan they take up just inside, the outside posts of the perimeter tier (facing = Character yaw, forward [sin, 0, cos]: 0 south, π/2 east) with the stretch of
 *  wall each sweeps his light across, and where outside men are stood up when the character budget lets the tier spawn them. Checked headlessly against
 *  level.ts: free nav cells, straight walkable legs between neighbours, out of every leaf's sweep. */
export const QRF_MARKS = {
  door: 'stairwell',
  /** the landing (level.ts: inner floor x 1.34‥3.88, z 9.57‥12.63; the doorway's walkable column is z 11.25) */
  landing: [[3.1, 0, 11.25], [2.25, 0, 11.25], [3.1, 0, 10.3], [2.25, 0, 10.3]] as Vec3[],
  /** just inside: point man a few strides up the corridor facing east, two and three either side of him quartering the conference glass / the lobby arch, four
   *  last through holding the door end (the leaf swings in along the NORTH side of this end, everybody south or east of its sweep) */
  entry: [[6.7, 0, 11.2], [5.9, 0, 10.55], [5.9, 0, 11.8], [5.4, 0, 11.25]] as Vec3[],
  entryFace: [Math.PI / 2, 2.4, 0.75, Math.PI / 2],
  /** outside posts, in the order they are manned: the fire exit (the way out the mission names) from the lot's east strip, the break room's outside door from the
   *  walkway west of the van, the lobby glazing from under the dark west lamp, the south lot from under its lamp */
  posts: [
    { name: 'fire exit', pos: [38.9, 0, 24.2] as Vec3, yaw: -2.48, sweep: [[36.15, 1.0, 19.9], [36.15, 1.0, 21.5]] as Vec3[] },
    { name: 'break-room door', pos: [27.4, 0, 25.7] as Vec3, yaw: 1.95, sweep: [[30.9, 1.0, 24.15], [32.4, 1.0, 24.15]] as Vec3[] },
    { name: 'lobby front', pos: [2.3, 0, 20.6] as Vec3, yaw: Math.PI / 2, sweep: [[3.9, 1.0, 17.6], [3.9, 1.0, 22.4]] as Vec3[] },
    { name: 'south lot', pos: [17.4, 0, 26.4] as Vec3, yaw: Math.PI, sweep: [[14.5, 1.2, 24.15], [23.5, 1.2, 24.15]] as Vec3[] },   // (a stride east of the south lamp's pole)
  ],
  /** where the perimeter tier's own men are stood up when the budget has room for them: the lot's south-east corner by the gate, out of everybody's way */
  outsideSpawn: [[38.6, 0, 26.6], [37.4, 0, 26.9], [38.8, 0, 25.4], [37.2, 0, 25.6]] as Vec3[],
};

// ================================================================ the team is the level's own (RESPONSE)
/** THE RESPONSE TEAM AS LEVEL DESIGN (the maintainer, 10-18: "let's make it part of the level design and always make sense (ideally w.r.t. the concept/design
 *  of the level) and not all levels should have it"; "having some randomization and modeling their knowledge based on what they've heard on the radio could make
 *  it really fun"). ON in the page (`?response=0` = the build as it was), OFF here and on the frozen harness stand (TPS_RESPONSE=1; a FROZEN_HOLDS row).
 *  With `on`: a level has a team only where its file says so (scene/scenarios.ts ResponseData — the ways in, the marks, the words, how many and how long);
 *  the office's own block (levels/office.scenarios.ts) is the marks above, number for number. `deal` and `net` act only with `on`; each off = that rule as it
 *  was. Untuned by play. */
export const RESPONSE = {
  on: false,
  /** A RUN IS DEALT ITS RESPONSE when the call goes out (so after play began: samestart.ts leaves what is rolled in play alone): how many come, by which way,
   *  after how long — each inside what the level's block allows, off the game's own die. Off (and a call from the panel): the level's first answer */
  deal: true,
  /** THE TEAM GOES ON WHAT WAS SAID ON THE NET (picture.ts): the freshest place a man on the defenders' net has held long enough to have said, kept by
   *  control past the man who said it — never every living man's private fix the instant he has it. Off, or the picture off: the floor's fix, as it was */
  net: true,
  /** no way is dealt whose muster an enemy stands inside this many metres of when the call goes out (nobody is stood up at his elbow); a dealt time is to
   *  the nearest `etaStep` s; the net's word is read this often (s) */
  clearM: 12, etaStep: 5, wordSecs: 0.5,
  /** A SQUAD'S RAID BRINGS THE LEVEL'S TEAM TOO, where its block says so (ResponseData.raid): the team stands with the defenders, and is asked for by a
   *  defender of the block's room who heard gunfire and has lived `callSecs` since to say so — those men down first, nobody calls. Off: no raid ever
   *  brings a team, as it was (`?responseraid=0`) */
  raid: true, callSecs: 6,
};
/** one way in, with the level's words, as the code below reads it — the dealt way of the level's block, or (the switch off) the office's constant above */
interface Marks { door: string | null; name: string; muster: readonly Vec3[]; entry: readonly Vec3[]; entryFace: readonly number[]; coming: string; clear: string | null; stairs: boolean;
  posts: readonly ResponsePost[]; outside: readonly Vec3[]; site: string; at: string; team: string; tag: string; }
/** this level's block (null: it has none — with RESPONSE.on, no team) */
export function responseOf(g: Game): ResponseData | null { return g.level.scenarios?.response ?? null; }
/** A RAID ON A PLACE THAT HAS A TEAM TO CALL (RESPONSE.raid): a squad's room clear under way on a level whose block carries `raid`. The team is then the
 *  DEFENDERS' (side 'hostile': the squad's enemies and Sam's), counted inside the eleven a squad ever faces, and it has no second lift */
function raid(g: Game): boolean { return RESPONSE.on && RESPONSE.raid && !!g.nightBreach?.active && !g.rescue?.active && !!responseOf(g)?.raid && (!g.level.scenarios?.snatch || !!g.snatch?.out.on); }   // (a snatch level's block answers only the snatch that ends in the van — snatchout.ts: with that rule off the level is as it was, and nobody comes)
/** a raid is over: the room clear has ended — except on a snatch that ends in the van (snatchout.ts), where the house taken ends nothing while the man is still to be driven off */
const raidOver = (g: Game): boolean => g.snatch?.out.ruled ? !!g.snatch.end || g.roomClear?.end === 'wiped' : !!g.roomClear?.end;
/** the side the team stands on: the shift's — or, in a raid, the defenders' */
const sideOfTeam = (g: Game): 'guard' | 'hostile' => raid(g) ? 'hostile' : 'guard';
/** a raid: the men who can call it in — the living defenders of the block's room (where the set is), any defender when it names none; never the team itself */
function callers(g: Game): Guard[] {
  const R = responseOf(g), id = R?.raid?.room, nb = g.nightBreach;
  const room = id ? g.roomClear?.rooms.find(r => r.def.id === id) : null;
  const of: readonly Guard[] = room ? room.defenders : id ? [] : nb?.hostiles ?? [];
  return of.filter(x => x.state !== 'dead' && !x.held && !runnerOwns(x) && g.guards.includes(x));
}
/** a raid: the man who makes the call now — a caller who heard gunfire himself and has lived `callSecs` since (null: nobody has, yet or ever) */
function raidVoice(g: Game): Guard | null { const Q = g.qrf; return callers(g).find(x => g.time - (Q.heardAt.get(x) ?? Infinity) >= RESPONSE.callSecs) ?? null; }
/** a raid: is the team up (stood at its way in, or on the floor, a man of it living)? The structure is not taken while it is (roomclear.ts) */
export function responseUp(g: Game): boolean { const Q = g.qrf; return !!Q && raid(g) && (Q.state === 'arriving' || Q.state === 'deployed') && Q.men.some(m => m.state !== 'dead' && g.guards.includes(m)); }
/** …and its name on the net, for the line that says so */
export function responseTeam(g: Game): string { return responseOf(g)?.team ?? 'the response team'; }
function marksOf(g: Game): Marks | null {
  const Q = g.qrf;
  if (Q.marks && Q.marksOn === RESPONSE.on && Q.marksWay === Q.way) return Q.marks;
  let M: Marks | null;
  if (!RESPONSE.on) M = { door: QRF_MARKS.door, name: 'the west stairwell', muster: QRF_MARKS.landing, entry: QRF_MARKS.entry, entryFace: QRF_MARKS.entryFace, coming: 'coming up the west stairs', clear: 'nobody west of the lobby arch', stairs: true,
    posts: QRF_MARKS.posts as unknown as ResponsePost[], outside: QRF_MARKS.outsideSpawn, site: 'two-six', at: 'on two-six', team: 'the response team', tag: 'QRF' };
  else {
    const R = responseOf(g), y = R ? R.ways[Q.way] ?? R.ways[0] : null;
    M = R && y ? { door: y.door ?? null, name: y.name, muster: y.muster, entry: y.entry, entryFace: y.entryFace, coming: y.coming ?? `coming in by ${y.name}`, clear: y.clear ?? null, stairs: !!y.stairs,
      posts: R.posts ?? [], outside: R.outside ?? [], site: R.site, at: R.at, team: R.team, tag: R.tag ?? 'QRF' } : null;
  }
  Q.marks = M; Q.marksOn = RESPONSE.on; Q.marksWay = Q.way;
  return M;
}
/** how many more men the floor can be given: the eight that cast shadows, as it was — or, the team the level's own, the skinned characters one frame draws
 *  (guards.ts MAX_SKINNED) less the civilians: the men past the eighth character have no shadow proxy (guards.ts spawnUnit's `budget`) */
function roomFor(g: Game): number { const n = (RESPONSE.on ? MAX_SKINNED - g.civilians.length : CHAR_BUDGET) - 1 - g.guards.length; return raid(g) ? Math.min(n, SQUAD_MAX_MEN - g.nightBreach.hostiles.length - g.qrf.men.length) : n; }   // (a raid: never more than the eleven a squad ever faces, the garrison as staged and the team together)
const budgetOf = (g: Game) => RESPONSE.on ? { budget: MAX_SKINNED - g.civilians.length } : {};
/** the most men this level's response may ever have on the floor, element and outside posts together (the level's `men`; the sandbox's two numbers without) */
function mostMen(g: Game): number { const R = RESPONSE.on ? responseOf(g) : null; return R?.men ? R.men[1] : 8; }

// ================================================================ numbers
/** the renderer's character budget this counts against (guards.ts spawnUnit's MAX_CHARACTERS = scene/boxes.ts BoxWorld's eight shadow-capsule characters, Sam
 *  included): the element is capped at what is left of it, the perimeter tier spawns only into what is left after that and otherwise re-tasks element men */
const CHAR_BUDGET = 8;
/** how long a heard report of Sam's stays 'gunfire confirmed' for the trigger (long enough to span the alarm episode it started and the lockdown that follows it) */
const LOUD_MEMORY_SECS = 180;
/** THE SILENT NET (tune.qrfSilent): seconds from the last man of the shift leaving the net — after Sam's gunfire was heard on it — to control's radio check,
 *  and to control sending the response team on the silence alone */
const SILENT_CHECK_SECS = 6, SILENT_GO_SECS = 14;
/** the telegraph: control answers the request after ANSWER s; the door goes ETA s after the request (tune.qrfEta); called again at T−30 and T−10 (the men exist on
 *  the landing from T−10: their lights under the door, their boots on the stairs) */
const ANSWER_SECS = 1.6, CALL30 = 30, CALL10 = 10;
/** entry: seconds between men through the door; how long they hold the fan inside before moving */
const FILE_GAP = 0.55, ENTRY_HOLD = 1.6;
/** the element on the move: pace (m/s; the staff jog to a noise at 1.75, chase at 2.7), the pace when the cue is fresh gunfire, spacing down the file (m), how far
 *  either side of the trail two and three walk when the floor there is open, seconds between station updates */
const MOVE_SPEED = 2.15, RUSH_SPEED = 2.6, FILE_SPACING = 1.3, FILE_OFFSET = 0.42, STATION_SECS = 0.35;
/** re-target when the fix moves this far, or this often regardless; a room called clear (by them or the shift's pair) is not taken again inside RECLEAR s unless the fix is in it */
const RETARGET_M = 4, RETARGET_SECS = 20, RECLEAR_SECS = 90;
/** the room: seconds the stack may take before they go anyway, the bang's landing depth into the room and its fuse after first contact, the beat between men
 *  flowing in, how long the flow may take before it is called, the hold all round after the call */
const STACK_CAP = 5.5, BANG_DEPTH = 2.3, BANG_FUSE = 0.7, FLOW_GAP = 0.42, FLOW_CAP = 6.5, HOLD360_SECS = 1.6;
/** tune.qrfSquad: the longest one room may take by the squad's drill before the element gives it up. The net under doortools.ts's own caps (a minute to
 *  stack, the threshold's, the search's), so longer than those in a row: it is not what ends an entry that is going */
const DRILL_CAP = 120;
/** the fight: contact older than this (nobody's eyes on him, no report of his) and the element re-forms; awareness the scripted men are held at (hunting, not alarmed anew every frame) */
const REGROUP_SECS = 8, HUNT_AWARENESS = 0.7;
/** the perimeter tier's own trigger past deployment: this many level-1 reports (anybody's) inside the window = a running gunfight — counted from SETTLE_IN s after the
 *  door, so the exchange they walk in on is not it; this many men down on the floor */
const GUNFIGHT_SHOTS = 3, GUNFIGHT_WINDOW = 20, SETTLE_IN_SECS = 8, DOWN_FOR_PERIMETER = 3;
/** an outside man on his way to his post breaks the walk for a sighting only this close (or with rounds coming past him); at the post, any sighting is contact */
const WALKOUT_ENGAGE_M = 6;
/** outside: the jog to the post, the light's sweep period across the door (s) */
const POST_SPEED = 2.6, SWEEP_SECS = 5;

export type QrfState = 'idle' | 'requested' | 'inbound' | 'arriving' | 'deployed';
export type QrfReason = 'gunfire' | 'bodies' | 'panel' | 'silent';
type Phase = 'landing' | 'file' | 'fan' | 'move' | 'stack' | 'breach' | 'bang' | 'flow' | 'drill' | 'called' | 'hold' | 'fight' | 'regroup';
interface Target { kind: 'room' | 'point'; plan: RoomClearPlan | null; room: string; pos: Vec3; /** RESPONSE: the word (its time) this point was chosen on */ word?: number; }
/** the perimeter tier: called (control's line, men picked and moving) → set (posts taken, or the ETA and ten seconds gone) */
interface Perimeter { state: 'called' | 'set'; calledAt: number; etaAt: number; setAt: number; men: { gd: Guard; post: ResponsePost; arrivedAt: number; fighting: boolean }[]; spawned: number; peeled: number; }

/** Game.qrf: the whole response's state (see the module comment). Everything but `state` is bookkeeping the probes and the panel read. */
export class Qrf {
  state: QrfState = 'idle';
  reason: QrfReason | null = null;
  /** game times: the request, when the door goes (request + ETA), when the first man came through; −1 = not yet */
  requestedAt = -1; arriveAt = -1; deployedAt = -1;
  answered = false; said30 = false; said10 = false; refusedAt = -100; everyoneSaid = false;
  /** the element in order (#1 point … #4 rear); dead men stay listed (the roles shift past them); `perim` = the outside tier's record once called */
  men: Guard[] = [];
  perim: Perimeter | null = null;
  /** stun charges left in the element's pool (one per man who came up the stairs; whoever is at the door puts it in) */
  bangs = 0;
  /** the score's inputs: QRF men down (any cause), and whether one of theirs fired the frame Sam went down (a round from the response is what ended the run) */
  lost = 0; gotSam = false; samWasDown = false;
  /** the trigger's memory: when a living staff man last had a report of SAM's at gunfire level in his ears (the hearing model's 80 m gate), and the level-1
   *  reports of anybody's since deployment (the perimeter tier's 'running gunfight') */
  loudT = -1e9; /** a raid: when a man who can call first heard gunfire (−1e9: not yet) */ raidT = -1e9; /** …and when each such man first heard it: the call is his to make `callSecs` after that */ heardAt = new Map<Guard, number>(); shotsSince: number[] = []; heardEvents = new SideSet<object>();
  /** the silent net (tune.qrfSilent — see `silentNet`): when the whole shift was first off the net with Sam's gunfire in its memory (−1 = it is not), whether
   *  control's radio check has been said, and whether the request it led to was made or refused (once a night either way) */
  silentAt = -1; silentSaid = false; silentSpent = false;
  /** what happened when, in order (probes / the panel's line): request, control, thirty, ten, door, in:N, target:…, stack, bang, flow, clear:…, contact, regroup, man-down:…, perimeter:… */
  log: { t: number; what: string }[] = [];
  // ---- the element's script
  phase: Phase = 'landing'; phaseT = 0;
  target: Target | null = null; targetAt = -100; fix: Vec3 | null = null; fixT = -100; cueRush = false;
  cleared = new Map<string, number>();
  // ---- the script's plumbing (module-internal; public only so the plain functions below can reach it)
  wps = new Map<Guard, Vec3[]>();
  trail: Vec3[] = []; stationT = 0; pointId = -1; moveSpeed = MOVE_SPEED;   // pointId: char id of the man walking the target leg (a new #1 after a death takes it up afresh)
  /** DOORSTAY: the stair door has been pulled to behind the element (or there was nothing to pull) */
  doorPulled = false;
  filed = 0; flowed = 0; can: Item | null = null; canLandT = NaN; stackMarks: Vec3[] = []; shovedAt = NaN;
  seenIds = new Set<number>();   // element / perimeter men already reported down
  aimPts = new Map<Guard, Vec3>(); stations = new Map<Guard, Vec3>();
  /** tune.qrfSquad: the element as a second cast of the squad's orders and door tools (built at its first door) · the entry it is on (phase 'drill') · how
   *  many of that entry's beats are in `log` · rooms begun this way, and taken */
  cast: SquadCast | null = null; op: DoorOp | null = null; opBeat = 0; drills = 0; drillsIn = 0;
  /** tune.qrfSquad: the room the squad's drill last took (or gave up on) and the fix they went there on — that fix is used up there (pickTarget) */
  spent: { room: string; fixT: number } | null = null;
  /** RESPONSE, a floor with no room plans: the word (its `fixT`) they have already stood on the place of — the level's named places come next (pickTarget) */
  sweptT = -1e9;
  /** RESPONSE: what this run's call was dealt — which of the level's ways (an index into its block), how many men (−1: the sandbox's number) — and the
   *  marks read off it (marksOf's own cache) */
  way = 0; size = -1; marks: Marks | null = null; marksOn = false; marksWay = -1;
  /** RESPONSE.net: THE NET'S WORD — per enemy, the freshest place said on the defenders' net (a man on it held the idea long enough to have said it, or was
   *  told it), kept by control past the man who said it; `wordT` = when it was last read */
  word = new Map<Guard | 'player', { at: Vec3; t: number; how: string }>(); wordT = -1e9;
  /** does this man belong to the response (element or perimeter)? — the QA soak's script invariant asks */
  owns(gd: Guard): boolean { return this.men.includes(gd) || !!this.perim?.men.some(m => m.gd === gd); }
  /** one line for the panel / probes */
  summary(g: Game): string {
    if (this.state === 'idle') return `QRF ▸ idle${this.loudT > -1e8 ? ` · gunfire heard ${Math.round(g.time - this.loudT)} s ago` : ''} · bodies found ${bodiesFound(g)} · alarm ${escalationOf(g)}`;
    const left = this.arriveAt > g.time ? ` · door in ${Math.ceil(this.arriveAt - g.time)} s` : '';
    const alive = this.men.filter(m => m.state !== 'dead' && g.guards.includes(m)).length;
    return `QRF ▸ ${this.state} (${this.reason})${left}${this.state === 'deployed' ? ` · ${alive}/${this.men.length} up · ${this.phase}${this.target ? ' → ' + this.target.room : ''} · bangs ${this.bangs} · lost ${this.lost}` : ''}${this.perim ? ` · PERIMETER ${this.perim.state} (${this.perim.men.length} out: ${this.perim.spawned} spawned, ${this.perim.peeled} peeled)` : ''}`;
  }
}

// ================================================================ knobs kept per machine
const TUNE_KEY = 'twopointsix.qrf';
/** `?qrfsquad=0` on the page's address: the element's own drill for this visit — over the machine's memory of the row, and never written into it */
function ownDrillAsked(): boolean { try { const q = (globalThis as { location?: { search?: string } }).location?.search; return !!q && /[?&]qrfsquad=(0|off|false)\b/i.test(q); } catch { return false; } }
function storedTune(): Record<string, unknown> | null { try { const raw = localStorage.getItem(TUNE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } }   // (null: no storage (the harness), nothing kept, or junk in it)
export function loadQrfTune(g: Game) {
  const o = storedTune() as { [k: string]: any } | null, T = g.tune;
  if (o) {
    if (typeof o.qrf === 'boolean') T.qrf = o.qrf; if (typeof o.perimeter === 'boolean') T.perimeter = o.perimeter; if (typeof o.qrfSilent === 'boolean') T.qrfSilent = o.qrfSilent; if (typeof o.qrfSquad === 'boolean') T.qrfSquad = o.qrfSquad;
    if (Number.isFinite(o.qrfEta)) T.qrfEta = clamp(o.qrfEta, 15, 240); if (Number.isFinite(o.perimeterEta)) T.perimeterEta = clamp(o.perimeterEta, 10, 180);
    if (Number.isFinite(o.qrfSize)) T.qrfSize = clamp(Math.round(o.qrfSize), 2, 4); if (Number.isFinite(o.perimeterSize)) T.perimeterSize = clamp(Math.round(o.perimeterSize), 2, 4);
  }
  if (ownDrillAsked()) T.qrfSquad = false;
}
export function saveQrfTune(g: Game) {
  const T = g.tune, kept = storedTune()?.qrfSquad, qrfSquad = ownDrillAsked() ? (typeof kept === 'boolean' ? kept : QRF_TUNE_DEFAULTS.qrfSquad) : T.qrfSquad;   // (under the address's word the row's memory stays as it was)
  try { localStorage.setItem(TUNE_KEY, JSON.stringify({ qrf: T.qrf, qrfEta: T.qrfEta, qrfSize: T.qrfSize, perimeter: T.perimeter, perimeterEta: T.perimeterEta, perimeterSize: T.perimeterSize, qrfSilent: T.qrfSilent, qrfSquad })); } catch { /* */ }
}
/** the knobs back to what game.ts's tune ships (its literal — keep the two in step) and the machine's memory of them dropped, like every other module's 'defaults' (whistle / needs / tactics …);
 *  for a Tab ▸ Sandbox 'QRF ▸ defaults' button and the console */
export const QRF_TUNE_DEFAULTS = { qrf: true, qrfEta: 75, qrfSize: 4, perimeter: true, perimeterEta: 45, perimeterSize: 2, qrfSilent: true, qrfSquad: true } as const;
export function resetQrfTune(g: Game) { Object.assign(g.tune, QRF_TUNE_DEFAULTS); if (ownDrillAsked()) g.tune.qrfSquad = false; try { localStorage.removeItem(TUNE_KEY); } catch { /* none */ } }

// ================================================================ small shared helpers
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
function note(Q: Qrf, g: Game, what: string) { Q.log.push({ t: g.time, what }); if (Q.log.length > 200) Q.log.splice(0, 50); }
/** control's voice: a line on the net with nobody in the building saying it (the HUD draws 'radio: …' lines — ui/overlay.ts) */
function control(g: Game, text: string) { g.msg('radio: CONTROL — ' + text); g.audio.play('radio', null, 0.55); }
/** … and with a row in the run's timeline (the silent net's two lines: with nobody of the shift left to say why the team came, the debrief would not know) */
function controlRow(g: Game, text: string) { control(g, text); chronicle(g, 'radio', { who: 'CONTROL', text: text.length > 96 ? text.slice(0, 94) + '…' : text }); }
/** a plan's door as the element says it: the shift's own words for it (tactics.ts doorLabel: 'break room west', not 'breakroom w') — the bare id with the words switch off */
function doorSaid(g: Game, name: string): string { const d = WORDS.on ? g.doors.byName(name) : undefined; return (d && doorWrittenName(d)) ?? `${d ? doorLabel(d) : name.replace(/_/g, ' ')} door`; }   // (…or the name its level wrote for it, as the squad's row says it: doornames.ts)
/** a response man's radio line: his bubble if he is on screen, and the net's log line under his callsign (guards.ts say would file a unit's radio under his name
 *  without the 'radio:' the HUD keys on — these men ARE on the shift's net) */
function radio(g: Game, gd: Guard | null | undefined, text: string) {
  if (!gd || gd.state === 'dead') { control(g, text); return; }
  gd.bubble = { text, t: g.time, dur: bubbleSecs(text), radio: true }; radioHand(gd, gd.bubble.dur);   // (handwork.ts: his hand to the handset while it is on the net — picture only)
  g.msg(`radio: ${gd.callsign} — ${text}`); g.audio.play('radio', gd.char.bones.head ?? gd.char.pos, 0.7);
  chronRadio(g, gd, text);   // (the run's timeline keeps what went over the net — chronicle.ts, as guards.ts say does for the shift)
}
/** the shift's man best placed to call it in: living, not in Sam's arm, staff (not a unit), calm for choice */
function staffVoice(g: Game): Guard | null {
  let best: Guard | null = null, br = -1;
  for (const x of g.guards) { if (x.unit || x.team !== 'guard' || x.state === 'dead' || x.held) continue; const r = x.state === 'alert' ? 0 : x.state === 'patrol' ? 2 : 1; if (r > br) { br = r; best = x; } }
  return best;
}
function bodiesFound(g: Game): number { let n = 0; for (const x of g.guards) if (!x.unit && x.state === 'dead' && x.found) n++; return n; }
/** the run is Sam's to answer for (not the tour, not the breach's daylight, somebody home in the guards' heads, Sam on his feet) */
function live(g: Game): boolean { if (raid(g)) return g.aiEnabled && !g.quietUtility && !g.touring && !g.player.down && hasResponse(g);   // (a raid: day or night, the squad's run itself)
  return g.aiEnabled && !g.quietUtility && !g.touring && !isDaylight(g) && !g.player.down && !g.nightBreach?.active && !g.rescue?.active && hasResponse(g); }
/** THIS LEVEL HAS A RESPONSE TEAM: the marks above are the office's stairwell. A level that carries its own places (a quiet mission: its file's scenarios.quiet
 *  — scene/scenarios.ts) has the team only if it has the team's door (a floor built round the office's west stair, landing and all); without it there is nobody
 *  to send — no request, no radio promise, no men stood on another building's coordinates. Every other level: as it always was. */
export function hasResponse(g: Game): boolean {
  if (RESPONSE.on) { const R = responseOf(g); return !!R && (!R.raid || raid(g)) && R.ways.some(y => !y.door || !!g.doors.byName(y.door)); }   // (the level's own: no block, no team — whatever doors it has)
  return !g.level.scenarios?.quiet || !!g.doors.byName(QRF_MARKS.door);
}
/** … and, for the panel's buttons: is there a way in to stand a team on (the switch off: the stair door — the gate above passes any level without a quiet block) */
export function responseHere(g: Game): boolean { return RESPONSE.on ? hasResponse(g) : !!g.doors.byName(QRF_MARKS.door); }
function alive(Q: Qrf, g: Game): Guard[] { return Q.men.filter(m => m.state !== 'dead' && g.guards.includes(m)); }
/** the floor's freshest fix on Sam: the man (staff or response) who had eyes on him last and still holds a fix, else the alarm's own place */
function bestFix(g: Game): { pos: Vec3; t: number } | null {
  let best: Guard | null = null;
  for (const x of g.guards) if (x.state !== 'dead' && x.team === sideOfTeam(g) && x.lastKnown && x.lastSeenT > (best?.lastSeenT ?? -1e9)) best = x;
  if (best && best.lastSeenT > -50) return { pos: v3.copy(best.lastKnown!), t: best.lastSeenT };
  if (g.alarm.placed) return { pos: v3.copy(g.alarm.pos), t: g.alarm.raisedAt };
  return best?.lastKnown ? { pos: v3.copy(best.lastKnown), t: -100 } : null;
}
/** RESPONSE.net — is this man on the defenders' net: one of the team's side, up, not in an arm, not a runner (picture.ts onNet's rule for the staff) */
function onTheirNet(g: Game, x: Guard): boolean { return x.team === sideOfTeam(g) && !x.civ && x.state !== 'dead' && !x.held && !runnerOwns(x) && (!raid(g) || g.qrf.men.includes(x) || callers(g).includes(x)); }   // (a raid: control hears the men at the set — what the rest know reaches it only by being told to them, picture.ts — and the team itself)
const netRule = (g: Game) => RESPONSE.on && RESPONSE.net && PICTURE.on && !g.touring;
/** RESPONSE.net — control keeps what is SAID: every `wordSecs`, each idea a man on the net has held for the picture's `tellSecs` (he has said it) or was
 *  told (somebody did) is the net's word of that enemy if it is the freshest; a place since found empty adds nothing and takes nothing away (the last
 *  word only grows old: 'one man, the duty room, two minutes old'). Read
 *  whether or not a team has been called: what the team is briefed on is what was said before it came. */
function readNet(g: Game, Q: Qrf) {
  if (g.time - Q.wordT < RESPONSE.wordSecs) return; Q.wordT = g.time;
  for (const m of g.guards) {
    if (!onTheirNet(g, m)) continue;
    for (const I of ideasOf(g, m)) {
      if (I.how === 'fix') continue;   // (his own guess at where the man went: picture.ts tell passes on what a man has seen or heard, never that — it is not said)
      if (I.how !== 'told' && g.time - I.since < PICTURE.tellSecs) continue;
      const W = Q.word.get(I.who);
      if (I.lost) continue;   // (he has since looked and found the place empty: nothing new to say — the last place said stays the last word, and grows old)
      if (!W || I.t > W.t + 1e-6) Q.word.set(I.who, { at: v3.copy(I.at), t: I.t, how: I.how });
    }
  }
  for (const who of Q.word.keys()) if (who !== 'player' && (who.state === 'dead' || !g.guards.includes(who))) Q.word.delete(who);   // (an enemy down, or gone from the floor, is nobody to go to)
}
/** the freshest word on the net, and how many enemies it has heard of */
function netWord(Q: Qrf): { pos: Vec3; t: number; n: number } | null {
  let best: { at: Vec3; t: number } | null = null;
  for (const W of Q.word.values()) if (!best || W.t > best.t) best = W;
  return best ? { pos: v3.copy(best.at), t: best.t, n: Q.word.size } : null;
}
/** WHERE THE TEAM BELIEVES HE IS. RESPONSE.net: the net's freshest word, or the alarm's own place when that was raised later (a body found, a lens, a
 *  missing man's post: said on the net too) — nothing else. Otherwise the floor's fix, as it was. */
function fixOf(g: Game): { pos: Vec3; t: number } | null {
  if (!netRule(g)) return bestFix(g);
  const W = netWord(g.qrf), A = g.alarm.placed ? { pos: v3.copy(g.alarm.pos), t: g.alarm.raisedAt } : null;
  return W && A ? (A.t > W.t ? A : W) : W ?? A;
}
/** the net's word in a save, and back (savestate.ts: a checkpoint is only ever taken with the response idle — the word is what an idle one holds): who by
 *  roster index (−1 = Sam), the clock as an age */
export interface ResponseWordSnap { who: number; at: Vec3; age: number; how: string }
export function responseWordSnapshot(g: Game): ResponseWordSnap[] { const out: ResponseWordSnap[] = []; for (const [who, W] of g.qrf?.word ?? []) { const i = who === 'player' ? -1 : g.guards.indexOf(who); if (who === 'player' || i >= 0) out.push({ who: i, at: v3.copy(W.at), age: g.time - W.t, how: W.how }); } return out; }
export function responseWordRestore(g: Game, rows: ResponseWordSnap[] | undefined) {
  const Q = g.qrf; if (!Q) return; Q.word.clear(); Q.wordT = -1e9;
  for (const r of rows ?? []) { const who = r.who < 0 ? 'player' as const : g.guards[r.who]; if (who && Array.isArray(r.at) && Number.isFinite(r.age)) Q.word.set(who, { at: [r.at[0], 0, r.at[2]], t: g.time - r.age, how: String(r.how) }); }
}
/** the brief as control gives it with the ETA: what the net has, in the level's own room names ('last word: one man, records room, a minute old') */
function brief(g: Game): string {
  const W = netWord(g.qrf), F = fixOf(g);
  if (!F) return 'no word on where';
  const age = g.time - F.t, old = age < 20 ? 'just now' : age < 90 ? 'a minute old' : `${Math.round(age / 60)} minutes old`;
  if (!W || F.t > W.t) return `last word: the alarm, ${roomName(g.level, F.pos)}, ${old}`;
  return `last word: ${W.n >= 2 ? `${Math.min(W.n, 5)} of them` : 'one man'}, ${roomName(g.level, F.pos)}, ${old}`;
}

// ================================================================ the trigger and the telegraph
export function resetQrf(g: Game) {
  const Q = g.qrf; if (!Q) return;
  dropDrill(Q);
  for (const m of [...Q.men, ...(Q.perim?.men.map(p => p.gd) ?? [])]) if (m.script && g.guards.includes(m)) endGuardScript(m, 'patrol');   // (resetGuards despawns them next; a bare resetQrf from the panel leaves ordinary alert-able men, then despawns them itself — qrfStandDown)
  const fresh = new Qrf(); Object.assign(Q, fresh);   // (keep the object main.ts / the panel hold; every field back to a fresh response's)
}
/** Panel: take the whole response back out of the world now — men despawned, state idle (a restart does the same through resetGuards). */
export function qrfStandDown(g: Game) { const Q = g.qrf; const men = [...Q.men, ...(Q.perim?.men.map(p => p.gd) ?? [])]; resetQrf(g); for (const m of men) if (g.guards.includes(m)) despawnUnit(g, m); g.note('QRF stood down (sandbox)'); }

/** Ask for the response team. From the trigger below (reason 'gunfire' / 'bodies') or the panel ('panel': no conditions but a live run). Refused — on the radio,
 *  at most every 20 s — once one is already on its way or has been: there is one wave a night. Returns whether it was requested now. */
export function requestQrf(g: Game, reason: QrfReason): boolean {
  const Q = g.qrf, M0 = marksOf(g);
  if (Q.state !== 'idle') {
    if (g.time - Q.refusedAt > 20) { Q.refusedAt = g.time;
      control(g, !RESPONSE.on || !M0 ? (Q.state === 'deployed' ? "negative, two-six — the response team is already on your floor. that's everyone we've got tonight" : wg("negative — QRF is already rolling to you. one team, one elevator. hold what you've got", 'negative — QRF is already rolling to you. one team, one lift; hold what you have'))
        : Q.state === 'deployed' ? `negative, ${M0.site} — ${M0.team} is already with you. that's everyone we've got tonight` : wg(`negative — ${M0.team} is already on its way to you. there's no second team. hold what you've got`, `negative — ${M0.team} is already on its way to you. there is no second one; hold what you have`));
      note(Q, g, 'refused'); }
    return false;
  }
  if (!g.tune.qrf && reason !== 'panel') return false;
  if (!live(g) && reason !== 'panel') return false;
  if (!hasResponse(g)) { note(Q, g, RESPONSE.on ? 'no-team:this level has none' : 'no-team:this level has no stairwell for one'); return false; }
  if (roomFor(g) < 2) { note(Q, g, `no-room:${roomFor(g)}`); return false; }   // (the renderer's character budget has no room for even a pair: nothing is promised on the radio that cannot come — and nothing is dealt)
  const D = dealt(g, reason);   // (the renderer's character budget has no room for even a pair: nothing is promised on the radio that cannot come)
  Q.way = D.way; Q.size = RESPONSE.on ? D.men : -1; if (RESPONSE.on) note(Q, g, `dealt:way ${D.way}:men ${D.men}:eta ${D.eta}`);
  const M = marksOf(g)!;
  Q.state = 'requested'; Q.reason = reason; Q.requestedAt = g.time; Q.arriveAt = g.time + Math.max(12, D.eta); Q.answered = Q.said30 = Q.said10 = false;
  const rd = raid(g), sp = rd ? raidVoice(g) ?? callers(g)[0] ?? null : staffVoice(g); const n = bodiesFound(g);
  if (!RESPONSE.on) {
    const line = reason === 'bodies' ? `control, ${sp?.callsign ?? 'two-six'} — ${n >= 2 ? `${n} men down` : 'men down'} on two-six and whoever did it is still up here. we need the response team` : reason === 'gunfire' ? `control, ${sp?.callsign ?? 'two-six'} — shots fired on two-six${w('', ', automatic fire')}. this is past us — get the response team up here` : `control, ${sp?.callsign ?? 'two-six'} — send the response team up to two-six. now`;
    if (sp) radio(g, sp, line); else if (reason === 'silent') controlRow(g, 'all stations, control — shots reported on two-six and nobody up there is answering. response team, go'); else control(g, 'two-six has gone quiet with an alarm up — response team, go');
  } else {
    const who = sp?.callsign ?? M.site;
    const line = reason === 'bodies' ? `control, ${who} — ${n >= 2 ? `${n} men down` : 'men down'} ${M.at} and whoever did it is still here. we need ${M.team}` : reason === 'gunfire' ? (rd ? `control, ${who} — we are being hit ${M.at}. send ${M.team}` : `control, ${who} — shots fired ${M.at}. this is past us — send ${M.team}`) : `control, ${who} — send ${M.team} to ${M.site}. now`;
    if (sp) radio(g, sp, line); else if (reason === 'silent') controlRow(g, `all stations, control — shots reported ${M.at} and nobody there is answering. ${M.team}, go`); else control(g, `${M.site} has gone quiet with an alarm up — ${M.team}, go`);
  }
  note(Q, g, `request:${reason}`);
  return true;
}
/** staging: no enemy of theirs (Sam, a living operative) stands within `clearM` of this mark — nobody is stood up at his elbow */
function clearOfFoes(g: Game, p: Vec3): boolean {
  if (flat(g.player.char.pos, p) < RESPONSE.clearM) return false;
  for (const x of g.guards) if (x.team === 'operative' && x.state !== 'dead' && flat(x.char.pos, p) < RESPONSE.clearM) return false;
  return true;
}
/** the radio's words for this level's team, for the lines other modules say of it (null: the switch off, or the level has none — the office's own words stand) */
export function responseWords(g: Game): { site: string; at: string; team: string } | null { const R = RESPONSE.on ? responseOf(g) : null; return R ? { site: R.site, at: R.at, team: R.team } : null; }
/** WHAT THIS CALL GETS: the way in, how many, how long. The switch off: the sandbox's two numbers and the one stairwell, as it was. On: the level's block
 *  — its first answer (the first way, its most men, the middle of its time; a block that gives no range: the sandbox's number), or with RESPONSE.deal one of
 *  each off the game's own die. A way an enemy stands at the muster of is never dealt (staging, not knowledge: nobody is stood up at his elbow). A call from
 *  the panel is the sandbox's own numbers on the first way: the rows there say what comes. */
function dealt(g: Game, reason: QrfReason): { way: number; men: number; eta: number } {
  const T = g.tune, R = RESPONSE.on ? responseOf(g) : null, sandbox = clamp(Math.round(T.qrfSize), 2, 4);
  if (!R || reason === 'panel') return { way: 0, men: sandbox, eta: T.qrfEta };
  const men: [number, number] = R.men ?? [sandbox, sandbox], eta: [number, number] = R.eta ?? [T.qrfEta, T.qrfEta];
  const open: number[] = []; R.ways.forEach((y, i) => { if (!y.door || g.doors.byName(y.door)) open.push(i); });
  if (!RESPONSE.deal) return { way: open[0] ?? 0, men: men[1], eta: (eta[0] + eta[1]) / 2 };
  const a = simRandom(), b = simRandom(), c = simRandom();   // (three draws whatever the level allows: a recording replays them in step)
  const clear = open.filter(i => clearOfFoes(g, R.ways[i].muster[0])), from = clear.length ? clear : open;
  const step = RESPONSE.etaStep, span = men[1] - men[0] + 1;
  return { way: from[Math.floor(a * from.length) % from.length] ?? 0, men: men[0] + Math.floor(b * span) % span, eta: clamp(Math.round((eta[0] + c * (eta[1] - eta[0])) / step) * step, eta[0], eta[1]) };
}

/** THE SILENT NET (tune.qrfSilent; off = the trigger exactly as it was). The trigger below wants a locked-down floor, and only a living man of the shift locks
 *  it down — so a player who shot the whole shift met nobody: three bodies, a minute in an empty building, control silent with gunfire in its ears (the missions
 *  goal's fault S2: the response came in 2 of 24 loud runs). The rule: Sam's gunfire was heard on the net (`loudT`, inside its memory) and now EVERY man of the
 *  shift is off it (down, out cold, or in Sam's arm) — control hears a net that reported shots go quiet. After SILENT_CHECK_SECS it asks for a radio check, aloud
 *  (the cue: the player hears that somebody is listening); nobody answering by SILENT_GO_SECS, it sends the response team on the silence alone, with the same
 *  telegraph any request gets (the ETA, thirty seconds, ten, boots on the stairs). A man back on the net before then (let go of) cancels it. Quiet work never
 *  starts it: loudT is gunfire-level reports of Sam's only. Only where the level has the team's door. Returns whether the team was asked for now. */
function silentNet(g: Game, Q: Qrf): boolean {
  if (Q.silentSpent) return false;
  let roster = 0, on = 0;
  for (const x of g.guards) { if (x.unit || x.team !== 'guard') continue; roster++; if (x.state !== 'dead' && !x.held) on++; }
  if (!roster || on || (Q.silentAt < 0 && g.time - Q.loudT >= LOUD_MEMORY_SECS) || !responseHere(g)) { Q.silentAt = -1; Q.silentSaid = false; return false; }
  if (Q.silentAt < 0) { Q.silentAt = g.time; note(Q, g, 'silent'); }
  const t = g.time - Q.silentAt;
  if (!Q.silentSaid && t >= SILENT_CHECK_SECS) { Q.silentSaid = true; const M = marksOf(g); controlRow(g, !RESPONSE.on || !M ? 'two-six, control — radio check. shots reported on your floor and nothing since. any station on two-six, respond' : `${M.site}, control — radio check. shots reported ${M.at} and nothing since. any station ${M.at}, respond`); note(Q, g, 'radio-check'); }
  if (t < SILENT_GO_SECS) return false;
  Q.silentSpent = true;   // (asked for, or refused for want of room in the character budget: either way once)
  return requestQrf(g, 'silent');
}

/** Once a frame from game.ts (after the guards and the alarm). */
export function updateQrf(g: Game, dt: number) {
  const Q = g.qrf; if (!Q) return;
  const rd = raid(g);
  if (rd && raidOver(g) && (Q.state === 'requested' || Q.state === 'inbound')) { note(Q, g, 'called-off:the run is over'); const log = Q.log; Object.assign(Q, new Qrf()); Q.log = log; return; }   // (a raid over — taken or lost — with the team still on the road: it never arrives)
  // ---- the trigger's memory: Sam's reports at gunfire level that reached a living staff man's ears this frame (the hearing model's rule for gunfire: 80 m straight)
  for (const e of g.events) {   // (each report once, whichever frame it was filed on: a round let go between two updates carries the earlier stamp)
    if ((e.level ?? 0) < 1 || (e.kind !== 'shot' && e.kind !== 'guardShot') || Q.heardEvents.has(e)) continue;
    Q.heardEvents.add(e);
    if (e.kind === 'shot' && !rd) { for (const x of g.guards) if (!x.unit && x.state !== 'dead' && !x.held && v3.dist(e.pos, x.char.pos) <= 80) { Q.loudT = g.time; break; } }
    else if (rd) { for (const x of callers(g)) if (v3.dist(e.pos, x.char.pos) <= 80) { Q.loudT = g.time; if (!Q.heardAt.has(x)) Q.heardAt.set(x, g.time); if (Q.raidT < -1e8) { Q.raidT = g.time; note(Q, g, `raid-heard:${x.callsign}`); } } }   // (a raid: anybody's gunfire, in the ears of each man who can call it in — the first of it he hears starts HIS `callSecs`)
    if (Q.state === 'deployed' && g.time - Q.deployedAt > SETTLE_IN_SECS) Q.shotsSince.push(g.time);   // (the gunfight that counts toward the compound's lockdown is one the team is on the floor and IN — not the exchange they walked in on)
  }
  while (Q.shotsSince.length && g.time - Q.shotsSince[0] > GUNFIGHT_WINDOW) Q.shotsSince.shift();
  if (netRule(g) && g.aiEnabled && hasResponse(g)) readNet(g, Q);   // (RESPONSE.net: control listens from the first minute, team or no team)
  if (Q.state === 'idle') {
    if (!g.tune.qrf || !live(g) || !g.tune.qrfSilent) { Q.silentAt = -1; Q.silentSaid = false; }   // (the silent net's clock runs only while the rule could act: a run not live for a stretch starts it afresh, cue first)
    if (!g.tune.qrf || !live(g)) return;
    if (rd) {   // a raid: a man who can call has heard gunfire and lived `callSecs` to say so — the men at the set down first, nobody calls
      if (!raidOver(g) && g.time - Q.loudT < LOUD_MEMORY_SECS && raidVoice(g) && !requestQrf(g, 'gunfire')) { Q.raidT = -1e9; Q.heardAt.clear(); }   // (asked and refused — no room on the floor for even a pair: the next gunfire he hears is a new call to make)
      return;
    }
    if (g.tune.qrfSilent && silentNet(g, Q)) return;
    if (escalationOf(g) < 2) return;
    if (g.time - Q.loudT < LOUD_MEMORY_SECS) requestQrf(g, 'gunfire');
    else if (bodiesFound(g) >= 2) requestQrf(g, 'bodies');
    return;
  }
  // ---- the telegraph (runs on under anything: the men are on the stairs whether or not the tour has since started — but nothing new is SAID under its flag)
  const quiet = g.quietUtility || g.touring;
  const M = marksOf(g), own = RESPONSE.on && !!M;   // (own: the level's words; else the office's lines, letter for letter)
  if (Q.state === 'requested' && g.time - Q.requestedAt >= ANSWER_SECS) {
    Q.state = 'inbound'; Q.answered = true;
    const n = Math.min(4, Q.size > 0 ? Q.size : clamp(Math.round(g.tune.qrfSize), 2, 4)), secs = Math.round(Q.arriveAt - g.time);
    if (!quiet && !own) control(g, Q.reason === 'silent' ? `all stations — QRF is rolling to two-six: ${n} men, west stairwell, ${secs} seconds`   // (nobody on two-six is left to be told to hold)
      : `copy two-six. QRF is rolling — ${n} men, west stairwell, ${secs} seconds. lock down and hold what you've got`);
    else if (!quiet) { const word = netRule(g) ? ` ${brief(g)}.` : '';
      control(g, Q.reason === 'silent' ? `all stations — ${M!.team} is rolling to ${M!.site}: ${n} men, by ${M!.name}, ${secs} seconds.${word}`
        : `copy ${M!.site}. ${M!.team} is rolling — ${n} men, by ${M!.name}, ${secs} seconds.${word} lock down and hold what you've got`); }
    note(Q, g, 'control');
  }
  if ((Q.state === 'inbound' || Q.state === 'requested') && !Q.said30 && Q.arriveAt - g.time <= CALL30) { Q.said30 = true; if (Q.arriveAt - Q.requestedAt > CALL30 + 5 && !quiet) {
    control(g, !own ? (Q.reason === 'silent' ? 'all stations — QRF is thirty seconds out from two-six, coming up the west stairs' : wg('two-six, QRF is thirty seconds out — coming up the west stairs. check your fire on that side', 'two-six, QRF is thirty seconds out — coming up the west stairs. check your fire that end'))
      : Q.reason === 'silent' ? `all stations — ${M!.team} is thirty seconds out from ${M!.site}, ${M!.coming}` : `${M!.site}, ${M!.team} is thirty seconds out — ${M!.coming}. check your fire ${wg('on that side', 'that end')}`);
    note(Q, g, 'thirty'); } }
  if ((Q.state === 'inbound' || Q.state === 'requested') && Q.arriveAt - g.time <= CALL10) arriving(g, Q, quiet);
  if (Q.state === 'arriving' && g.time >= Q.arriveAt) deploy(g, Q, quiet);
  if (Q.state === 'deployed' && !Q.everyoneSaid && g.time - Q.deployedAt > 4.5) { Q.everyoneSaid = true; if (!quiet && Q.men.length) control(g, !own ? "all stations — that's the response team on your floor, and that's everyone we've got tonight. make it count" : `all stations — that's ${M!.team} with you now, and that's everyone we've got tonight. make it count`); }   // (said once: there is no second wave, and they know it)
  if (Q.state === 'arriving' || Q.state === 'deployed') tickMen(g, Q, dt);
}

/** T−10: the men exist from here — stood on the landing behind the shut steel door, lights on (the glow under it), boots on the stairs through it, the lead's word. */
function arriving(g: Game, Q: Qrf, quiet: boolean) {
  Q.state = 'arriving'; Q.said10 = true;
  const own = RESPONSE.on;
  if (own && RESPONSE.deal) reDeal(g, Q, quiet);
  const M = marksOf(g)!;
  const want = Q.size > 0 ? Q.size : clamp(Math.round(g.tune.qrfSize), 2, 4); const room = roomFor(g); const n = Math.min(want, room);
  const door = M.door ? g.doors.byName(M.door) : undefined; const yaw = own ? v3.yawTo(M.muster[0], M.entry[0]) : Math.PI / 2;
  for (let i = 0; i < n; i++) {
    let gd: Guard;
    const at = i === 0 && door ? toolSpot(g, door, g.doors.side(door, M.muster[0]), M.muster[0])?.pos ?? M.muster[0] : M.muster[i];   // (handleside.ts: #1 is the man on the bar — at the handle of a leaf that opens toward the landing, clear of its swing)
    try { gd = spawnUnit(g, { team: sideOfTeam(g), pos: at as Vec3, yaw, weapon: 'aks74u', name: `${M.tag}-${i + 1}`, light: true, tint: [...QRF_TINT], tint2: [...QRF_TINT2], ...budgetOf(g) }); }
    catch (e) { note(Q, g, `spawn-failed:${i}:${String((e as Error)?.message ?? e).slice(0, 40)}`); break; }
    gd.trained = true; gd.hold = false; gd.state = 'search'; gd.awareness = HUNT_AWARENESS; gd.foe = 'player';
    gd.heardUpTo = g.eventSeq;
    order(gd, { goal: null, face: yaw, stance: 'highReady', upper: 'none', aimAt: null, crouch: false });   // at the high port on the landing, facing the door
    Q.men.push(gd);
  }
  Q.bangs = Q.men.length;
  if (n < want) note(Q, g, `capped:${Q.men.length}/${want}`);
  if (!Q.men.length) { Q.state = 'deployed'; Q.deployedAt = g.time; if (!quiet) control(g, !own ? wg("two-six — QRF is held up downstairs. nobody's coming through that door. you're on your own", 'two-six — QRF is held below, nobody is coming through that door. you are on your own up there') : wg(`${M.site} — ${M.team} is held up, nobody's coming. you're on your own`, `${M.site} — ${M.team} is held up, nobody is coming. you are on your own`)); note(Q, g, 'nobody'); return; }   // (the character budget went between the request and now: the wave is spent, honestly)
  if (!own) { if (door) g.audio.play('stairBoots', [door.frameCentre[0] - 1.2, 0.3, door.frameCentre[2]], 0.75); }
  else if (M.stairs) g.audio.play('stairBoots', [M.muster[0][0], 0.3, M.muster[0][2]], 0.75);
  if (!quiet) radio(g, Q.men[0], !own ? wg(`QRF on the stairs — ${Q.men.length} of us, ten seconds. we're coming in the west stair door. nobody west of the lobby arch, check your fire`, `QRF on the stairs — ${Q.men.length} of us, ten seconds. we come in the west stair door: nobody west of the lobby arch, check your fire`)
    : `${M.tag} at ${M.name} — ${Q.men.length} of us, ten seconds.${M.clear ? ` ${M.clear},` : ''} check your fire`);
  note(Q, g, `ten:${Q.men.length}`);
  Q.phase = 'landing'; Q.phaseT = 0;
}
/** RESPONSE.deal, ten seconds out: an enemy now stands at the muster of the way that was dealt — another of the level's ways that is clear is taken instead,
 *  and control says so (nobody is stood up at his elbow; with no other way clear they come as dealt) */
function reDeal(g: Game, Q: Qrf, quiet: boolean) {
  const R = responseOf(g); if (!R || R.ways.length < 2) return;
  const clearOf = (i: number) => clearOfFoes(g, R.ways[i].muster[0]);
  if (clearOf(Q.way)) return;
  const other = R.ways.findIndex((y, i) => i !== Q.way && (!y.door || !!g.doors.byName(y.door)) && clearOf(i)); if (other < 0) return;
  Q.way = other; const M = marksOf(g)!;
  if (!quiet) control(g, `${M.site} — change of plan: ${M.team} is ${M.coming}`);
  note(Q, g, `re-dealt:way ${other}`);
}

/** T: the bar goes down and the leaf is thrown into the corridor off its real hinge (it booms off its stop like a kicked one — a guard's doing, so the shift do not
 *  come running to it; Sam hears it down the corridor), the stairwell rings, and they file in. */
function deploy(g: Game, Q: Qrf, quiet: boolean) {
  Q.state = 'deployed'; Q.deployedAt = g.time; Q.phase = 'file'; Q.phaseT = 0; Q.filed = 0;
  const M = marksOf(g)!, own = RESPONSE.on;
  const door = M.door ? g.doors.byName(M.door) : undefined; const lead = alive(Q, g)[0];
  if (door && lead) flingOpen(g, door, lead);
  if (door && (!own || M.stairs)) g.audio.play('stairDoor', door.frameCentre, 1.0);
  if (missionLive(g)) { g.mission.stats.qrf = Math.max(g.mission.stats.qrf, 1) as 0 | 1 | 2; g.mission.stats.qrfAt = g.mission.stats.elapsed; if (own) g.mission.stats.qrfWho = M.team; }
  if (!quiet) radio(g, lead, !own ? `QRF on two-six — ${alive(Q, g).length} in through the west stairs, moving as one element` : `${M.tag} ${M.at} — ${alive(Q, g).length} in by ${M.name}, moving as one element`);
  note(Q, g, 'door');
}
/** throw a shut (or nearly shut) leaf open away from `by` at a kick's pace without breaking anything: unlatched from the side that always opens */
function flingOpen(g: Game, d: Door, by: Guard) {
  if (Math.abs(d.angle) > 1.0) return;
  const side = g.doors.side(d, by.char.pos);   // (this is the crash-bar side: the bolt is only ever against the corridor face, and stays thrown — the closer — or, where doors stay, the last man's hand (tickMen) — latches it locked again behind them)
  d.latched = false; d.closing = false; d.vel = -side * 7.5; d.sinceBash = 0; d.quietT = -0.5; d.creakArmed = false; d.lastWho = by.char.id;
  g.audio.play('doorBash', d.pos, 0.9, { rate: 0.85 });
}

// ================================================================ the men, every frame
function tickMen(g: Game, Q: Qrf, dt: number) {
  Q.phaseT += dt;
  // men taken out of the world from under us (a reset that did not come through resetQrf, a despawn): forget them; nobody left and nothing pending = the wave is spent
  Q.men = Q.men.filter(m => g.guards.includes(m));
  if (Q.perim) Q.perim.men = Q.perim.men.filter(p => g.guards.includes(p.gd));
  manDown(g, Q);
  const el = alive(Q, g).filter(m => !Q.perim?.men.some(p => p.gd === m));
  // trained: short beats (a dazzle or a ring in the body keeps its own length); and nobody of theirs ever talks himself calm — a man the AI has dropped below the
  // hunt is put back on it (the element re-forms him below; an outside man goes back to his post)
  for (const m of [...alive(Q, g), ...(Q.perim?.men.map(p => p.gd).filter(x => x.state !== 'dead') ?? [])]) {
    if (g.time >= m.dazzledUntil && g.time >= m.staggerUntil && m.reactT > TRAINED.reactCap) m.reactT = TRAINED.reactCap;
    if (!m.script && (m.state === 'patrol' || m.state === 'suspicious')) { m.state = 'search'; m.awareness = Math.max(m.awareness, HUNT_AWARENESS); m.searchT = 0; }
    m.bodyDuty = null; m.task = null;   // (the shift's found-body script and its errands are dealt to any scripted colleague on the net — guards.ts — and are not theirs: a body called in moves the alarm's place, which is the fix they clear toward anyway)
  }
  // DOORSTAY: no closer latches the stair door behind them any more (flingOpen) — the last man through pulls it to once they are all on the floor and clear of
  // it, and the bolt bites again as the latch catches. With the closers on (the switch off, a showcase) the door does it itself, as it always did.
  if (Q.state === 'deployed' && !Q.doorPulled && g.doors.stay && g.time - Q.deployedAt > 1.5) {
    const MK = marksOf(g), d = MK?.door ? g.doors.byName(MK.door) : undefined, up = alive(Q, g);
    if (!d || d.off || d.latched || d.def.closer === false || !up.length) Q.doorPulled = true;
    else { const land = g.doors.pullFace(d, MK!.muster[0] as Vec3); let last: Guard | null = null, ld = Infinity, through = true;   // (pullFace: which side of the FRAME — Doors.side is the leaf's, and the leaf stands open)
      for (const m of up) { const dd = flat(m.char.pos, d.frameCentre); if (g.doors.pullFace(d, m.char.pos) === land || dd < 1.5) through = false; if (dd < ld) { ld = dd; last = m; } }
      if (through && last) { Q.doorPulled = true; if (ld < 6) { g.doors.pullTo(d, last.char.id); note(Q, g, 'door-to'); } } }
  }
  if (Q.perim) tickPerimeter(g, Q, dt); else if (Q.state === 'deployed') maybePerimeter(g, Q);
  if (!el.length) { if (Q.phase !== 'fight') { dropDrill(Q); Q.phase = 'fight'; note(Q, g, 'wiped'); } return; }   // (dropDrill: a can of theirs still in a dead hand goes on its own short fuse, not never)
  if (Q.state === 'arriving') {   // on the landing: ears open (deaf to before they existed), nothing else — behind the office's shut steel door
    let seer: Guard | null = null; for (const m of el) if (perceiveScripted(g, Q, m, dt) && !seer) seer = m;
    if (RESPONSE.on && seer && !marksOf(g)?.door) { note(Q, g, 'seen-at-the-muster'); deploy(g, Q, g.quietUtility || g.touring); toFight(g, Q, el, seer); }   // (a level's muster is open ground: a man who sees his enemy from it does not stand out the ten seconds)
    return; }
  switch (Q.phase) {
    case 'file': phaseFile(g, Q, el); break;
    case 'fan': if (Q.phaseT > ENTRY_HOLD) pickTarget(g, Q, el, true); break;
    case 'move': phaseMove(g, Q, el, dt); break;
    case 'stack': phaseStack(g, Q, el); break;
    case 'breach': phaseBreach(g, Q, el); break;
    case 'bang': phaseBang(g, Q, el); break;
    case 'flow': phaseFlow(g, Q, el); break;
    case 'drill': phaseDrill(g, Q, el); break;
    case 'called': if (Q.phaseT > 1.2) { hold360(g, Q, el); } break;
    case 'hold': if (Q.phaseT > HOLD360_SECS) pickTarget(g, Q, el, false); break;
    case 'fight': phaseFight(g, Q, el); return;   // the AI has them: no script senses to run
    case 'regroup': if (Q.phaseT > 1.5 || el.every(m => m.script?.arrived)) pickTarget(g, Q, el, true); break;
    case 'landing': break;
  }
  // the scripted men's senses (the runner takes them off the AI): eyes on him and all of them go to the fight — except while they are still filing through the door
  // with him not close: then it is where they go the moment they are in (nobody fights from the funnel), and the man's own meter stays where it is
  let contact: Guard | null = null;
  for (const m of el) { if (!m.script) continue; if (perceiveScripted(g, Q, m, dt) && !contact) contact = m; }
  if (contact && (Q.phase !== 'file' || flat(contact.char.pos, (RESPONSE.on ? foeChar(g, contact)?.pos : null) ?? g.player.char.pos) < 8)) toFight(g, Q, el, contact);
  else if (contact) { Q.fix = v3.copy(contact.lastKnown ?? g.player.char.pos); Q.fixT = g.time; Q.cueRush = true; contact.awareness = Math.min(contact.awareness, 0.84); }
}

/** The senses updateGuard would have run for a man the runner drives (squad.ts perceive's shape): this frame's noises through the shared hearing model — LESS the
 *  element's own doings (their door, their bang, their boots: events carrying one of their ids, and the charge they put in) — Sam through the shared sight test
 *  at the shared rate, a bump, a colleague held up in front of him (the standoff's own perception), a colleague on the floor in his view (found, counted, said).
 *  A noise is a CUE (the element's fix moves; awareness is capped under the alert line); eyes on him is CONTACT (true). */
function perceiveScripted(g: Game, Q: Qrf, m: Guard, dt: number): boolean {
  if (!g.aiEnabled) return false;
  const ids = new Set<number>(); for (const x of Q.men) ids.add(x.char.id); if (Q.perim) for (const p of Q.perim.men) ids.add(p.gd.char.id);
  for (const e of g.events) if (e.id === undefined) e.id = ++g.eventSeq;
  const own = (e: typeof g.events[number]) => (e.who !== undefined && ids.has(e.who)) || (e.kind === 'bang' && !isNaN(Q.canLandT) && Q.can && flat(e.pos, Q.can.pos) < 1.5);
  const fixBefore = m.lastKnown ? v3.copy(m.lastKnown) : null;
  const all = g.events; g.events = all.filter(e => !own(e));
  try { hearingCheck(g, m); } finally { g.events = all; }
  m.heardUpTo = g.eventSeq;
  let seen = false, glimpse = false;
  const vis = canSee(g, m);
  if (vis.visible) { const rate = sightGain(g, m, vis.dist); if (rate > 0.05) { glimpse = true; m.awareness = clamp(m.awareness + rate * dt, 0, 1); m.lastKnown = v3.copy(g.player.char.pos); m.sightPos = v3.copy(g.player.char.pos); m.sightT = g.time; if (rate > 0.25) m.lastSeenT = g.time; seen = m.awareness >= 0.85; } }   // (updateGuard's rule: a real sighting keeps the licence fresh; the alert itself is the meter filling — from a hunting man's 0.7 that is a quarter second on a lit Sam, seconds on a shape in the half-dark)
  const pp = g.player.char.pos, gp = m.char.pos;
  if (!g.player.down && !g.playerInvisible && Math.hypot(pp[0] - gp[0], pp[2] - gp[2]) < 0.62) { m.awareness = 1; m.lastKnown = v3.copy(pp); m.lastSeenT = g.time; seen = true; }
  if (standoffPerceive(g, m)) seen = true;
  m.sawPlayerThisFrame = seen; m.sawFoeThisFrame = seen;
  if (RESPONSE.on && seen) m.foe = 'player';
  // RESPONSE: the enemy is whoever is against them on this level — a partner, a teammate — seen by the same eye at the same rate as Sam (the test the AI's
  // own men are seen by: guards.ts canSeeChar / sightGainOn); the one he makes out is the one he is after
  if (RESPONSE.on && !seen) for (const o of g.guards) {
    if (o.state === 'dead' || o.civ || !hostileTo(m, o) || railsDown(g, o)) continue;
    const vo = canSeeChar(g, m, o.char, false); if (!vo.visible) continue;
    const rate = sightGainOn(g, m, o, vo.dist); if (rate <= 0.05) continue;
    glimpse = true; m.awareness = clamp(m.awareness + rate * dt, 0, 1); m.lastKnown = v3.copy(o.char.pos); m.sightPos = v3.copy(o.char.pos); m.sightT = g.time; if (rate > 0.25) m.lastSeenT = g.time;
    if (m.awareness >= 0.85) { seen = true; m.foe = o; m.sawFoeThisFrame = true; break; }
  }
  if (m.awareness > m.witness.peakAwareness) m.witness.peakAwareness = m.awareness;
  if (seen) return true;
  if (glimpse) return false;   // (the meter is filling on him: leave it be — no cue, no clamp)
  // a cue: a report, a door going in, a colleague's contact reached his ears THIS frame and put his fix somewhere new — the element's fix follows it (gunfire means
  // 'he is THERE': the next leg is run, not walked)
  const H = m.witness.heard;
  if (H.lastT >= g.time - 1e-6 && m.lastKnown && (!fixBefore || flat(fixBefore, m.lastKnown) > 1)) { Q.fix = v3.copy(m.lastKnown); Q.fixT = g.time; Q.cueRush = H.lastShotT >= g.time - 1e-6 || H.kick > 0 && H.lastT >= g.time - 1e-6; }
  m.awareness = clamp(m.awareness, HUNT_AWARENESS * 0.85, 0.8);   // (heard, not seen: it moves them, it does not scatter them into four chases; and nothing wears a hunting man's edge off)
  // a colleague down in his view: he is found (the debrief counts him), it is said once, and they push on — no covering the body, no widening out: that is the shift's script
  if (g.time - m.sawBodyT > 6) {
    const o = bodyInView(g, m);
    if (o) {
      m.sawBodyT = g.time; m.witness.sawBody = { victim: o.callsign, t: g.time, breathing: isBreathing(o) };
      let n = 0; const eye = m.char.bones.head ?? v3.add(m.char.pos, [0, 1.65, 0]); const bp = bodyPos(o);
      for (const x of g.guards) if (x.state === 'dead' && !x.found && x.team === m.team && (x === o || (flat(bodyPos(x), bp) < 3 && !g.col.segmentBlocked(eye, v3.add(bodyPos(x), [0, 0.3, 0]))))) { x.found = true; tally(g, 'bodies'); n++; }
      if (n) radio(g, m, `${o.callsign} down in ${w('', 'the ')}${roomName(g.level, bp)}${n > 1 ? ` — ${n} of them` : ''}, ${o.wound ? 'hit, breathing' : isBreathing(o) ? 'out cold, breathing' : 'dead'}. pushing on`);
      note(Q, g, `found:${o.callsign}`);
    }
  }
  return false;
}

/** A response man went down since last frame: the nearest of theirs with him in view (or close by) says so on the net and he counts as found; the perimeter tier hears of it (maybePerimeter). */
function manDown(g: Game, Q: Qrf) {
  const theirs = [...Q.men, ...(Q.perim?.men.map(p => p.gd) ?? [])];
  for (const d of theirs) {
    if (d.state !== 'dead' || Q.seenIds.has(d.char.id)) continue;
    Q.seenIds.add(d.char.id); Q.lost++;
    const bp = bodyPos(d);
    let sp: Guard | null = null, bd = Infinity;
    for (const o of theirs) { if (o === d || o.state === 'dead' || !g.guards.includes(o)) continue; const dd = flat(o.char.pos, bp); if (dd < bd && (dd < 6 || pointInView(g, o, v3.add(bp, [0, 0.4, 0]), 14, 100))) { bd = dd; sp = o; } }
    if (sp) { if (!d.found) { d.found = true; tally(g, 'bodies'); } sp.witness.sawBody = { victim: d.callsign, t: g.time, breathing: isBreathing(d) }; radio(g, sp, `man down — ${d.callsign} is hit, ${roomName(g.level, bp)}!${d.downBy === 'player' ? ' it\'s him — on me!' : ''}`); }
    note(Q, g, `man-down:${d.callsign}${sp ? '' : ':unseen'}`);
  }
  // the run ending on one of THEIR rounds: Sam went down this frame and a response man let a round go this frame (aim.ts stamps every round through the model)
  if (g.player.down && !Q.samWasDown && !Q.gotSam) { for (const o of theirs) if (o.aim.lastShot && Math.abs(o.aim.lastShot.t - g.time) < 1e-6) { Q.gotSam = true; note(Q, g, `got-sam:${o.callsign}`); break; } }
  Q.samWasDown = g.player.down;
}

// ---------------------------------------------------------------- entry
function phaseFile(g: Game, Q: Qrf, el: Guard[]) {
  // one man through the doorway every FILE_GAP, each to his fan mark facing his sector, gun up: nobody lingers in the funnel
  const due = Math.min(el.length, Math.floor(Q.phaseT / FILE_GAP) + 1), MK = marksOf(g)!;
  while (Q.filed < due) {
    const i = Q.filed; const m = el[i]; if (!m) break;
    m.state = 'search'; m.awareness = Math.max(m.awareness, HUNT_AWARENESS);
    const e = (MK.entry[i] ?? MK.entry[0]) as Vec3, ef = MK.entryFace[i] ?? Math.PI / 2;
    route(Q, m, [e], { speed: 2.4, face: ef, stance: 'none', upper: 'aim', aimAt: sectorPoint(e, ef), crouch: i === 3, strafe: false });
    Q.filed++; note(Q, g, `in:${i + 1}`);
  }
  for (const m of el) advance(Q, m);
  const allIn = Q.filed >= el.length && el.every(m => (RESPONSE.on || m.char.pos[0] > 4.4) && (m.script?.arrived || flat(m.char.pos, m.script?.goal ?? m.char.pos) < 0.9));
  if (allIn || Q.phaseT > FILE_GAP * el.length + (RESPONSE.on ? Math.max(6, flat(MK.muster[0] as Vec3, MK.entry[0] as Vec3) / 1.6) : 6)) { Q.phase = 'fan'; Q.phaseT = 0; note(Q, g, 'fan'); }
}
const sectorPoint = (p: Vec3, yaw: number, d = 5, y = 1.0): Vec3 => [p[0] + Math.sin(yaw) * d, y, p[2] + Math.cos(yaw) * d];

// ---------------------------------------------------------------- targeting
/** Choose where the element goes next and set it moving: the room holding the fix if a plan covers it (else the fix itself as a point to close on and hold), then
 *  rooms by walking distance from the fix, skipping any called clear lately (theirs or the shift's) unless the fix is inside it. `fresh`: re-read the floor's fix first. */
function pickTarget(g: Game, Q: Qrf, el: Guard[], fresh: boolean) {
  const bf = fixOf(g);
  if (bf && ((fresh && !(netRule(g) && Q.fix && bf.t < Q.fixT - 1e-6)) || !Q.fix || bf.t > Q.fixT)) { Q.fix = bf.pos; Q.fixT = Math.max(Q.fixT, bf.t); }   // (RESPONSE.net: a word older than what they last had themselves does not take them back)
  const fix: Vec3 = Q.fix ?? (RESPONSE.on ? v3.copy(marksOf(g)?.entry[0] ?? el[0].char.pos) : [20, 0, 11.1]);   // (nothing at all to go on: the middle of the corridor, and the rooms off it)
  const plans = g.level.clearPlans ?? [];
  const rooms = new Map<string, RoomClearPlan[]>();
  for (const p of plans) { const k = p.room ?? p.door; (rooms.get(k) ?? rooms.set(k, []).get(k)!).push(p); }
  const recent = (k: string) => { const t = Math.max(Q.cleared.get(k) ?? -1e9, g.clearedAt.get(k) ?? -1e9); return g.time - t < RECLEAR_SECS; };
  const inside = (ps: RoomClearPlan[]) => ps.some(p => p.bounds && inBounds(fix, p.bounds));
  let best: { k: string; ps: RoomClearPlan[]; d: number } | null = null;
  for (const [k, ps] of rooms) {
    // (tune.qrfSquad: a room the squad's drill has been through on this very fix has used it up — 'clear, negative contact' is not followed by the same
    // room again on the same word; a newer fix in it is a new word. The element's own drill, as it was: the room that holds the fix, again and again)
    const isIn = inside(ps) && !(g.tune.qrfSquad && Q.spent?.room === k && Q.spent.fixT >= Q.fixT); if (recent(k) && !isIn) continue;
    let d = Infinity; for (const p of ps) { const dc = g.doors.byName(p.door)?.frameCentre; if (dc) d = Math.min(d, pathLen(g, fix, [dc[0], 0, dc[2]])); }
    if (isIn) d = -1;
    if (!best || d < best.d) best = { k, ps, d };
  }
  const from = el[0].char.pos; const prev = Q.target; const prevPhase = Q.phase;
  // the fix out on the open floor (corridor, cubicles, lobby, the lot) and not where they already stand: close on IT first, in formation, and hold there — a room comes after
  const fixOpen = !plans.some(p => p.bounds && inBounds(fix, p.bounds));
  let next: Target;
  if (fixOpen && flat(from, fix) > 5 && !(prev?.kind === 'point' && flat(prev.pos, fix) < RETARGET_M && prevPhase === 'hold')) {
    next = { kind: 'point', plan: null, room: roomName(g.level, fix), pos: nearestFree(g, fix) ?? v3.copy(fix) };
  } else if (best) {
    let plan = best.ps[0], bl = Infinity;
    for (const p of best.ps) { const L = pathLen(g, from, p.stack[0]); if (L < bl) { bl = L; plan = p; } }   // whichever of its doors is the shorter walk
    next = { kind: 'room', plan, room: best.k, pos: v3.copy(plan.stack[0]) };
  } else next = { kind: 'point', plan: null, room: roomName(g.level, fix), pos: nearestFree(g, fix) ?? v3.copy(fix) };
  // RESPONSE, a floor with no room plans (a quiet mission's): the word's place first, as above — and once they have stood on it, or with no word at all, the
  // level's own named places by the walk from it, each once in a while. A team does not stand on a minute-old word all night.
  let sweep = false;
  if (RESPONSE.on && !plans.length) {
    if (prev?.kind === 'point' && prevPhase === 'hold') { Q.cleared.set(prev.room, g.time); if (prev.word !== undefined) Q.sweptT = Math.max(Q.sweptT, prev.word); }   // (stood there, or could not get onto it: either way that word is used up and the place is not walked to again for a while)
    if (next.kind === 'point' && flat(from, next.pos) < 3) Q.sweptT = Math.max(Q.sweptT, Q.fixT);
    if (next.kind === 'point') next.word = Q.fixT;
    if (!Q.fix || Q.sweptT >= Q.fixT) { const s = sweepNext(g, Q, from, fix); if (s) { next = s; sweep = true; } }
  }
  Q.targetAt = g.time;
  const same = !!prev && prev.kind === next.kind && prev.room === next.room && flat(prev.pos, next.pos) < 2;
  if (same && prevPhase === 'move') return;   // (the periodic re-read came to the same place: the walk goes on as it is, and nothing is said twice)
  if (same && next.kind === 'point' && flat(from, next.pos) < 3) { Q.phase = 'hold'; Q.phaseT = 0; return; }   // (already standing on the only place worth standing: keep the hold, look again in a beat)
  Q.target = next;
  startMove(g, Q, el);
  const lead = el[0];
  radio(g, lead, next.kind === 'room' ? `element moving — ${next.room}, by the ${doorSaid(g, next.plan!.door)}`
    : sweep ? (bf ? `nothing here — element moving on, ${next.room}` : `nothing on the net — element sweeping, ${next.room}`)
    : netRule(g) && !bf ? `nothing on the net — element clearing from ${marksOf(g)?.name ?? 'the door'}` : `element moving — ${next.room}, on the last ${netRule(g) ? 'word' : 'fix'}`);
  note(Q, g, `target:${next.kind}:${next.room}${sweep ? ':sweep' : ''}`);
}
/** RESPONSE: the next of the level's named places to walk to and look at (the quiet block's spots, then scenarios.places) — the nearest by the walk from
 *  `fix` that nobody of theirs has stood on in the last while; standing within three metres of one is having looked */
function sweepNext(g: Game, Q: Qrf, from: Vec3, fix: Vec3): Target | null {
  let best: Target | null = null, bd = Infinity;
  for (const p of sweepPlaces(g)) {
    const c = nearestFree(g, p.pos); if (!c) continue;
    if (flat(from, c) < 3) Q.cleared.set(p.name, g.time);
    if (g.time - (Q.cleared.get(p.name) ?? -1e9) < RECLEAR_SECS) continue;
    const d = pathLen(g, Q.fix ? fix : from, c); if (d < bd) { bd = d; best = { kind: 'point', plan: null, room: p.name, pos: c }; }   // (from the word's place outward; with no word at all, from where they stand)
  }
  return best;
}
/** … the list: the block's own `sweep`, or the quiet block's spots and scenarios.places' areas by their middles */
function sweepPlaces(g: Game): { name: string; pos: Vec3 }[] {
  const S = g.level.scenarios; if (S?.response?.sweep?.length) return S.response.sweep;
  const mid = (b: { x0: number; x1: number; z0: number; z1: number }): Vec3 => [(b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2];
  return [...(S?.quiet?.spots ?? []).map(s => ({ name: s.place, pos: mid(s.area) })), ...(raid(g) ? g.roomClear?.rooms ?? [] : []).filter(r => !r.defenders.some(h => h.state !== 'dead' && !runnerOwns(h))).map(r => ({ name: r.def.name, pos: mid(r.def.bounds) })),
    ...(S?.places?.areas ?? []).map(a => ({ name: a.name, pos: mid(a.bounds) }))];   // (a raid: a held room whose men have all gone quiet is a place to look — one that still answers is not walked through)
}
/** THE LEVEL'S BLOCK AGAINST ITS BUILT FLOOR (tools/qa/response-check.ts runs it on every level file that has one): a way's door is a door of the level;
 *  its four muster marks and four fan marks stand on free floor a body's width apart; each man's walk from his muster mark to his fan mark is a short one,
 *  and from the fan the floor the level's men walk can be reached; every outside post, and the marks its men come on at, likewise; a quiet mission's every
 *  start has a way whose muster is not at its elbow. Returns what is wrong, in words (nothing: the block stands). */
export function checkResponse(g: Game): string[] {
  const R = responseOf(g), out: string[] = []; if (!R) return out;
  const nav = g.col.nav, at = (p: readonly number[]) => `(${p[0]}, ${p[2]})`, free = (p: readonly number[]) => !nav.isBlocked(p[0], p[2]);
  const walk = (a: readonly number[], b: readonly number[]) => pathLen(g, [a[0], 0, a[2]], [b[0], 0, b[2]]);
  const apart = (ps: readonly Vec3[], what: string) => { for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (flat(ps[i], ps[j]) < 0.6) out.push(`${what}: marks ${i + 1} and ${j + 1} are ${flat(ps[i], ps[j]).toFixed(2)} m apart`); };
  const floor = g.level.routes[0]?.points[0] ?? g.level.playerSpawn;
  R.ways.forEach((y, k) => {
    const W = `way ${k + 1} '${y.name}'`;
    if (y.door && !g.doors.byName(y.door)) out.push(`${W}: no door '${y.door}' on this level`);
    y.muster.forEach((p, i) => { if (!free(p)) out.push(`${W}: muster mark ${i + 1} ${at(p)} is not free floor`); });
    y.entry.forEach((p, i) => { if (!free(p)) out.push(`${W}: fan mark ${i + 1} ${at(p)} is not free floor`); });
    apart(y.muster, `${W} muster`); apart(y.entry, `${W} fan`);
    y.muster.forEach((p, i) => { const e = y.entry[i]; if (!e || !free(p) || !free(e)) return; const L = walk(p, e); if (!(L <= 30)) out.push(`${W}: man ${i + 1}'s walk from muster to his fan mark is ${L === Infinity ? 'no walk at all' : L.toFixed(1) + ' m'} (30 m at most)`); });
    if (y.entry[0] && free(y.entry[0]) && walk(y.entry[0], floor) === Infinity) out.push(`${W}: no walk from the fan ${at(y.entry[0])} to the level's floor ${at(floor)}`);
    if (y.door) { const d = g.doors.byName(y.door); if (d && y.muster[0] && y.entry[0] && g.doors.pullFace(d, y.muster[0]) === g.doors.pullFace(d, y.entry[0])) out.push(`${W}: the muster and the fan are on the same side of '${y.door}'`); }
  });
  for (const s of g.level.scenarios?.quiet?.starts ?? []) if (!R.ways.some(y => flat(s.sam, y.muster[0]) >= RESPONSE.clearM)) out.push(`start '${s.name ?? at(s.sam)}': every way's muster is within ${RESPONSE.clearM} m of it`);
  (R.posts ?? []).forEach((p, i) => { if (!free(p.pos)) out.push(`post ${i + 1} '${p.name}' ${at(p.pos)} is not free floor`); else if (!(R.outside ?? []).some(o => free(o) && walk(o, p.pos) < Infinity)) out.push(`post ${i + 1} '${p.name}': no walk to it from any outside mark`); });
  (R.outside ?? []).forEach((p, i) => { if (!free(p)) out.push(`outside mark ${i + 1} ${at(p)} is not free floor`); });
  (R.sweep ?? []).forEach((p, i) => { if (!free(p.pos)) out.push(`sweep place ${i + 1} '${p.name}' ${at(p.pos)} is not free floor`); else if (R.ways[0]?.entry[0] && walk(R.ways[0].entry[0], p.pos) === Infinity) out.push(`sweep place ${i + 1} '${p.name}': no walk to it from the first way in`); });
  return out;
}
function pathLen(g: Game, a: Vec3, b: Vec3): number { const p = g.col.nav.findPath(a, b); if (!p) return Infinity; let L = 0, q = a; for (const r of p) { L += flat(q, r); q = r; } return L; }
function nearestFree(g: Game, p: Vec3): Vec3 | null { return g.col.nav.isBlocked(p[0], p[2]) ? g.col.nav.nearestFreePoint(p[0], p[2]) : [p[0], 0, p[2]]; }

// ---------------------------------------------------------------- movement as one element
/** where the walk to a room ends: a length past the stack marks along the stack line away from the door (squad.ts Clearing.approach's rule), so they turn into the stack in file */
function approachEnd(g: Game, P: RoomClearPlan): Vec3 {
  const nav = g.col.nav; const u = v3.normalize([P.stack[1][0] - P.stack[0][0], 0, P.stack[1][2] - P.stack[0][2]]);
  for (const k of [1.6, 1.1, 0.6, 0]) { const q: Vec3 = [P.stack[0][0] + u[0] * k, 0, P.stack[0][2] + u[2] * k]; if (!nav.isBlocked(q[0], q[2]) && !g.col.solidBlocked([P.stack[0][0], 0.45, P.stack[0][2]], [q[0], 0.45, q[2]])) return q; }   // (solid, not sight: a station across a glass pane is not one he can step to)
  return v3.copy(P.stack[0]);
}
function startMove(g: Game, Q: Qrf, el: Guard[]) {
  Q.phase = 'move'; Q.phaseT = 0; Q.trail = [v3.copy(el[0].char.pos)]; Q.stationT = 0; Q.pointId = el[0].char.id;
  const goal = Q.target!.kind === 'room' ? approachEnd(g, Q.target!.plan!) : Q.target!.pos;
  Q.moveSpeed = Q.cueRush ? RUSH_SPEED : MOVE_SPEED; Q.cueRush = false;
  route(Q, el[0], [goal], { speed: Q.moveSpeed, face: null, strafe: false, stance: 'none', upper: 'aim', aimAt: null, crouch: false });
  // the file: each man behind walks to ONE station point of his own that is moved under him a few times a second (the runner keeps a path whose goal has only
  // crept, so the walk stays a walk — squad.ts / guards.ts goTo — and re-plans when it jumps: a corner turned, a doorway threaded)
  el.forEach((m, i) => { if (i > 0) { m.state = 'search'; const st = stationOf(Q, m); st[0] = m.char.pos[0]; st[1] = 0; st[2] = m.char.pos[2]; Q.wps.delete(m); order(m, { goal: st, speed: Q.moveSpeed, face: null, strafe: false, stance: 'none', upper: 'aim', crouch: false, aimAt: aimOf(Q, m) }); } });
}
function aimOf(Q: Qrf, m: Guard): Vec3 { let a = Q.aimPts.get(m); if (!a) { a = [m.char.pos[0], 1, m.char.pos[2] + 1]; Q.aimPts.set(m, a); } return a; }
function stationOf(Q: Qrf, m: Guard): Vec3 { let s = Q.stations.get(m); if (!s) { s = v3.copy(m.char.pos); Q.stations.set(m, s); } return s; }
function phaseMove(g: Game, Q: Qrf, el: Guard[], dt: number) {
  const lead = el[0]; const T = Q.target; if (!T) { pickTarget(g, Q, el, true); return; }
  if (!lead.script || lead.char.id !== Q.pointId) { startMove(g, Q, el); return; }   // (the point man died: the new #1 takes the walk up from where he is)
  // the trail the file walks in: the point man's own footsteps, a crumb every 0.6 m
  const lp = lead.char.pos; if (flat(Q.trail[Q.trail.length - 1], lp) > 0.6) { Q.trail.push(v3.copy(lp)); if (Q.trail.length > 80) Q.trail.shift(); }
  // stations down the file, re-dealt a few times a second: k × spacing back along the trail, a step out to alternate sides where the floor is open (two covers
  // left, three right), the rear man on the trail itself; pace by how far adrift each is; muzzles out to their sides, the rear man's over his shoulder now and then
  Q.stationT -= dt;
  if (Q.stationT <= 0) {
    Q.stationT = STATION_SECS;
    const nav = g.col.nav; const fwd = lead.char.forward();
    el.forEach((m, k) => {
      if (k === 0) return;
      const back = trailPoint(Q.trail, lp, k * FILE_SPACING);
      const dir = trailDir(Q.trail, lp, k * FILE_SPACING) ?? fwd;
      const side = k === 1 ? 1 : k === 2 ? -1 : 0;   // (his left = [f.z, 0, −f.x])
      let want: Vec3 = [back[0] + dir[2] * FILE_OFFSET * side, 0, back[2] - dir[0] * FILE_OFFSET * side];
      if (nav.isBlocked(want[0], want[2]) || (side && !nav.walkable(back, want))) want = nav.isBlocked(back[0], back[2]) ? (nearestFree(g, back) ?? back) : back;
      const st = stationOf(Q, m); st[0] = want[0]; st[1] = 0; st[2] = want[2];
      if (!m.script || m.script.goal !== st) order(m, { goal: st, face: null, strafe: false, stance: 'none', upper: 'aim', crouch: false, aimAt: aimOf(Q, m) });   // (a man fresh off another leg — a flow point, a stack mark — is put on his station)
      const gap = flat(m.char.pos, st);
      m.script!.speed = Q.moveSpeed * (gap > 3.5 ? 1.4 : gap > 1.8 ? 1.15 : gap < 0.5 ? 0.75 : 1.0);
      // sectors: two and three quarter out to their sides ahead, four looks back down the trail every few seconds
      const a = aimOf(Q, m); const yawF = Math.atan2(dir[0], dir[2]);
      const yaw = k === 3 ? (Math.sin(g.time * 0.9) > 0.3 ? yawF + Math.PI : yawF) : yawF + (k === 1 ? -1.0 : 1.0);
      a[0] = m.char.pos[0] + Math.sin(yaw) * 5; a[1] = 1.0; a[2] = m.char.pos[2] + Math.cos(yaw) * 5;
      m.script!.aimAt = a;
    });
    // the point man eases off if the file has stretched (a door held them, a corner): nobody arrives alone
    const worst = Math.max(0, ...el.slice(1).map((m, i) => flat(m.char.pos, lp) - (i + 1) * FILE_SPACING));
    lead.script.speed = Q.moveSpeed * (worst > 5 ? 0.35 : worst > 3 ? 0.7 : 1);
  }
  // a fresher fix elsewhere: re-target (not more than every few seconds, and only for a real move of it)
  const bf = fixOf(g);
  if (bf && bf.t > Q.fixT + 0.5 && flat(bf.pos, Q.fix ?? bf.pos) > RETARGET_M && g.time - Q.targetAt > 3) { Q.fix = bf.pos; Q.fixT = bf.t; pickTarget(g, Q, el, false); return; }
  if (Q.fix && Q.fixT > Q.targetAt && flat(Q.fix, T.kind === 'room' ? T.pos : T.pos) > RETARGET_M && g.time - Q.targetAt > 3 && Q.cueRush) { pickTarget(g, Q, el, false); return; }
  if (g.time - Q.targetAt > RETARGET_SECS && Q.phaseT > RETARGET_SECS) { pickTarget(g, Q, el, true); return; }
  // there: the point man on his mark (or as near as the floor lets him) — a room: into the stack; a point: hold all round, then choose again
  const arrived = !!lead.script?.arrived || (flat(lp, lead.script?.goal ?? lp) < 1.0 && lead.speed < 0.2 && Q.phaseT > 2);
  const eta = 60;
  if (arrived || Q.phaseT > eta) {
    if (T.kind === 'room' && flat(lp, T.plan!.stack[0]) < 4) { if (!(g.tune.qrfSquad && startDrill(g, Q, el))) startStack(g, Q, el); }
    else if (T.kind === 'room') { radio(g, lead, `can't get ${wg('into', 'onto')} the ${T.room} from here — next`); Q.cleared.set(T.room, g.time - RECLEAR_SECS + 30); hold360(g, Q, el); }
    else hold360(g, Q, el);
  }
}
/** the point on the trail `s` metres back from the head `head` (walking the crumbs backwards; the oldest crumb if the trail is shorter) */
function trailPoint(trail: Vec3[], head: Vec3, s: number): Vec3 {
  let prev = head, left = s;
  for (let i = trail.length - 1; i >= 0; i--) { const q = trail[i]; const d = flat(prev, q); if (d >= left) { const t = left / Math.max(d, 1e-6); return [prev[0] + (q[0] - prev[0]) * t, 0, prev[2] + (q[2] - prev[2]) * t]; } left -= d; prev = q; }
  return v3.copy(prev);
}
/** the trail's forward direction at that point (unit, flat), or null if the trail has no length yet */
function trailDir(trail: Vec3[], head: Vec3, s: number): Vec3 | null {
  const a = trailPoint(trail, head, s + 0.5), b = trailPoint(trail, head, Math.max(0, s - 0.5)); const d = flat(a, b); if (d < 0.05) return null;
  return [(b[0] - a[0]) / d, 0, (b[2] - a[2]) / d];
}
/** hold all round where they stand: each man squares off to a quarter (point ahead, two left, three right, four behind), guns up, for a beat */
function hold360(g: Game, Q: Qrf, el: Guard[]) {
  Q.phase = 'hold'; Q.phaseT = 0;
  const f = el[0].char.bodyYaw;
  el.forEach((m, k) => { const yaw = f + [0, -Math.PI / 2, Math.PI / 2, Math.PI][k % 4]; order(m, { goal: null, face: yaw, strafe: false, stance: 'none', upper: 'aim', crouch: k === 3, aimAt: sectorPoint(m.char.pos, yaw) }); });
  note(Q, g, 'hold');
}

// ---------------------------------------------------------------- the room: stack, breach, bang, flow, call
function stackMarksFor(g: Game, P: RoomClearPlan, n: number): Vec3[] {
  const out: Vec3[] = [v3.copy(P.stack[0]), v3.copy(P.stack[1])]; const u = v3.normalize([P.stack[1][0] - P.stack[0][0], 0, P.stack[1][2] - P.stack[0][2]]); const nav = g.col.nav;
  for (let k = 2; k < n; k++) {
    let q: Vec3 | null = null;
    for (const s of [0.85 * (k - 1), 0.85 * (k - 1) + 0.4, 0.85 * (k - 1) - 0.3]) { const c: Vec3 = [P.stack[1][0] + u[0] * s, 0, P.stack[1][2] + u[2] * s]; if (!nav.isBlocked(c[0], c[2])) { q = c; break; } }
    out.push(q ?? v3.copy(out[out.length - 1]));
  }
  return out.slice(0, n);
}
function startStack(g: Game, Q: Qrf, el: Guard[]) {
  const P = Q.target!.plan!; Q.phase = 'stack'; Q.phaseT = 0; Q.stackMarks = stackMarksFor(g, P, el.length); Q.shovedAt = NaN; Q.can = null;
  el.forEach((m, i) => route(Q, m, [Q.stackMarks[i]], { speed: 1.7 - i * 0.08, face: P.stackFace[Math.min(i, 1)], stance: i === 0 ? 'stack' : 'highReady', stackSide: P.stackSide, upper: 'none', aimAt: v3.copy(P.stackAim[Math.min(i, 1)]), crouch: false, strafe: false }));
  radio(g, el[0], `stack on the ${doorSaid(g, P.door)} — ${Q.target!.room}`); note(Q, g, `stack:${Q.target!.room}`);
}
function phaseStack(g: Game, Q: Qrf, el: Guard[]) {
  for (const m of el) advance(Q, m);
  const planted = el.filter(m => m.script?.arrived).length;
  if ((planted >= Math.min(el.length, 3) && Q.phaseT > 1.2) || Q.phaseT > STACK_CAP) {
    if (el[1]) el[1].char.anim.signal('go');
    Q.phase = 'breach'; Q.phaseT = 0;
    const P = Q.target!.plan!; const d = g.doors.byName(P.door);
    if (d && d.isClosed()) route(Q, el[0], [P.kickFrom], { speed: 1.3, face: P.kickFace, stance: 'highReady', upper: 'none', aimAt: null });
    note(Q, g, 'squeeze');
  }
}
function phaseBreach(g: Game, Q: Qrf, el: Guard[]) {
  const P = Q.target!.plan!; const d = g.doors.byName(P.door); const lead = el[0]; advance(Q, lead);
  const s = Math.sign(P.fling) || -1;
  if (isNaN(Q.shovedAt)) {   // step one: the point man planted square to the leaf by the lock (or out of time) works the lever and throws it into the room
    const shut = !!d && d.isClosed();
    const planted = !shut || (!!lead.script?.arrived && flat(lead.char.pos, P.kickFrom) < 0.15 && Math.abs(wrapAngle(lead.char.bodyYaw - P.kickFace)) < 0.15);
    if (!((planted && Q.phaseT > 0.45) || Q.phaseT > 1.8)) return;
    if (d && !d.off && g.doors.openFor(d, s) < 1.0) {   // the keyed shove (squad.ts RoomClear's 'open' breach): the bolt stays as it was, the leaf unlatched and thrown hard into the room off its real hinge
      d.latched = false; d.closing = false; d.vel = s * Math.max(Math.abs(d.vel), Math.abs(P.fling)); d.quietT = -1.0; d.creakArmed = false; d.lastWho = lead.char.id; g.audio.play('doorBash', d.pos, 0.6, { rate: 1.1 });
      g.say(lead, 'door!');
    }
    Q.shovedAt = g.time; note(Q, g, 'shove');
    return;
  }
  // step two: once the leaf is round (or 0.8 s of it), the charge — if the pool has one — chopped in from where he stands square to the doorway
  if (d && d.angle * s < 0.9 && g.time - Q.shovedAt < 0.8) return;
  Q.shovedAt = NaN;
  if (Q.bangs > 0 && d) {
    const fc = d.frameCentre; const B = P.bounds;
    let n: Vec3 = [Math.cos(d.def.closedDir + Math.PI / 2), 0, Math.sin(d.def.closedDir + Math.PI / 2)];   // square off the closed leaf's line
    const probe: Vec3 = [fc[0] + n[0], 0, fc[2] + n[2]];
    const inRoom = B ? inBounds(probe, B) : flat(probe, P.entry[0][P.entry[0].length - 1]) < flat([fc[0] - n[0], 0, fc[2] - n[2]], P.entry[0][P.entry[0].length - 1]);
    if (!inRoom) n = [-n[0], 0, -n[2]];
    const land: Vec3 = [fc[0] + n[0] * BANG_DEPTH, 0.05, fc[2] + n[2] * BANG_DEPTH];
    const hand = lead.char.jointUnder('handL') ?? v3.add(lead.char.pos, [0, 1.3, 0]); const from: Vec3 = [hand[0], Math.max(0.9, hand[1]), hand[2]];
    const sol = g.items.solve(from, land, 9);
    const it = Q.can = g.items.spawn('flash', from, sol.v0, { fuse: 99, who: lead.char.id, heading: v3.yawOf(sol.v0) });   // (fuse 99: it goes on OUR count below)
    it.onBounce = (sp, p, g) => g.audio.play('canisterBounce', p, Math.min(1, sp / 4));
    g.audio.play('throw', from, 0.7); lead.char.anim.tossItem(TOSS_QUICK); Q.bangs--; Q.canLandT = NaN;
    g.say(lead, 'bang out!'); note(Q, g, 'bang-out');
    // everybody's head off the doorway while it cooks
    el.forEach((m, i) => { const away: Vec3 = [m.char.pos[0] - n[0] * 3 + (i - 1.5) * n[2], 0.6, m.char.pos[2] - n[2] * 3 - (i - 1.5) * n[0]]; order(m, { aimAt: away }); });
    Q.phase = 'bang'; Q.phaseT = 0;
  } else { g.say(lead, 'no bang — going dry. go!'); startFlow(g, Q, el); }
}
/** a can of the element's that went off this tick: the floor-wide 'bang' report detonateStun filed is re-filed as THEIRS — a slam's worth of noise carrying
 *  their man's id (phaseBang's note on why) */
function theirBang(g: Game, Q: Qrf, at: Vec3, who: Guard) {
  for (let i = g.events.length - 1; i >= 0; i--) { const e = g.events[i]; if (e.kind === 'bang' && e.time === g.time && flat(e.pos, at) < 1) { g.events.splice(i, 1); break; } }
  g.events.push({ kind: 'door', pos: [at[0], 0, at[2]], time: g.time, loud: true, level: 1.0, who: who.char.id });
  note(Q, g, 'bang');
}
function phaseBang(g: Game, Q: Qrf, el: Guard[]) {
  const it = Q.can; if (!it) { startFlow(g, Q, el); return; }
  if (isNaN(Q.canLandT) && (it.bounces > 0 || it.settled)) Q.canLandT = g.time;
  if ((!isNaN(Q.canLandT) && g.time - Q.canLandT >= BANG_FUSE) || Q.phaseT > 2.4) {
    it.fired = true;
    // combat.ts detonateStun: the burst, the flash, the bang in Sam's ears, the daze on every man with it in his open view — bar the element, heads turned off the
    // doorway behind the wall (the flash test would not know the jamb at the point man's shoulder from the opening); and the floor-wide 'bang' report it files is
    // re-filed as THEIRS (a slam's worth of noise carrying the point man's id): the shift were told on the net what is going in, they do not answer their own side's
    // charge with 'flashbang! go, go!' — the hearing model's standing rule for a noise a colleague made
    const all = g.guards; g.guards = all.filter(x => !Q.men.includes(x));
    try { detonateStun(g, it); } finally { g.guards = all; }
    theirBang(g, Q, it.pos, el[0]);
    startFlow(g, Q, el);
  }
}
/** All of them in: one and two to the plan's points of domination sweeping its sectors (the RoomClear pair's own legs), three up the point man's wall to the deep
 *  point, four through onto the door side just inside — a beat apart, never on each other's heels. */
function startFlow(g: Game, Q: Qrf, el: Guard[]) {
  Q.phase = 'flow'; Q.phaseT = 0; Q.flowed = 0; Q.can = null;
  g.say(el[0], 'go! go! go!'); note(Q, g, 'flow');
}
function flowLegs(P: RoomClearPlan, k: number): { pts: Vec3[]; face: number; aim: Vec3 } {
  const last = <T,>(a: T[]) => a[a.length - 1];
  if (k === 0) return { pts: P.entry[0], face: P.podFace[0], aim: v3.copy(last(P.entryAim[0])) };
  if (k === 1) return { pts: P.entry[1], face: P.podFace[1], aim: v3.copy(last(P.entryAim[1])) };
  if (k === 2) return { pts: [P.entry[0][0], P.searchPath[0]], face: P.searchFace, aim: v3.copy(last(P.searchAimWalk)) };
  const fb = P.formUp[1] ?? P.formUp[0]; return { pts: [P.entry[1][0], last(fb)], face: P.formFace[1] ?? P.formFace[0], aim: v3.copy(P.stackAim[0]) };
}
function phaseFlow(g: Game, Q: Qrf, el: Guard[]) {
  const P = Q.target!.plan!;
  const due = Math.min(el.length, Math.floor(Q.phaseT / FLOW_GAP) + 1);
  while (Q.flowed < due) {
    const k = Q.flowed; const m = el[k]; if (!m) break;
    const L = flowLegs(P, k);
    route(Q, m, L.pts, { speed: k < 2 ? 2.4 : 2.1, face: L.face, stance: 'none', upper: 'aim', aimAt: L.aim, crouch: false, strafe: false });
    Q.flowed++;
  }
  for (const m of el) advance(Q, m);
  const inCount = el.filter(m => m.script?.arrived).length;
  if (Q.phaseT > 1.6 && Q.flowed >= 2) { const said = Q.log.some(l => l.what === `sides:${Q.target!.room}` ); if (!said && el[0].script?.arrived) { g.say(el[0], P.lines.side1 || 'my side clear.'); if (el[1]) g.say(el[1], P.lines.side2 || 'door side clear.'); note(Q, g, `sides:${Q.target!.room}`); } }
  if ((inCount >= el.length && Q.phaseT > 2.5) || Q.phaseT > FLOW_CAP) {
    Q.phase = 'called'; Q.phaseT = 0; Q.cleared.set(Q.target!.room, g.time); g.clearedAt.set(Q.target!.room, g.time);   // (the shift's pair reads the same ledger: nobody sends them round a room the team has just called)
    if (el[2]) g.say(el[2], 'deep — clear.'); if (el[3]) g.say(el[3], 'door — clear.');
    radio(g, el[0], `${Q.target!.room} clear — negative contact. ${Q.bangs > 0 ? 'moving on' : 'no bangs left, moving on'}`);
    note(Q, g, `clear:${Q.target!.room}`);
  }
}

// ---------------------------------------------------------------- the room by the squad's own drill (tune.qrfSquad)
/** At the door: the element handed to the squad's door tools as a second cast (squadcast.ts) — the men of the response and nobody else, on the guards' side,
 *  with the building's keys (a locked door is opened, never booted: the shift's own), their own count of cans and no charges. The order is one the squad's
 *  menu gives: BANG AND CLEAR on a room the fix is in (open and clear with no can left), else THE THRESHOLD — the room sliced from the jambs, its blind pocket
 *  banged if a can is left, then stepped into. On the face of the door the level's plan stacks on. False (and nothing begun) when the tools refuse it — no
 *  floor at the jambs, the door gone: the element's own drill takes the room, as with the switch off. */
function startDrill(g: Game, Q: Qrf, el: Guard[]): boolean {
  const T = Q.target!, P = T.plan!, d = g.doors.byName(P.door); if (!d) return false;
  const C = Q.cast ??= squadCast(g, { mine: gd => Q.men.includes(gd), team: sideOfTeam(g), ring: EVERY_KEY });
  C.tools.sync(); C.tools.bangs = Q.bangs; C.tools.charges = 0; C.tools.frags = 0; C.tools.lights = true;   // (sync first: a roster that has changed — a man peeled off to the perimeter — starts the tools afresh, counts and all)
  const inside = !!Q.fix && !!P.bounds && inBounds(Q.fix, P.bounds);
  const kind = !inside ? 'threshold' : Q.bangs > 0 ? 'bangClear' : 'openClear';
  const op = C.tools.order(kind, el, d, sideOf(d, P.stack[0]));
  if (typeof op === 'string') { Q.bangs = C.tools.bangs; note(Q, g, `drill-no:${op}`); return false; }
  Q.op = op; Q.opBeat = 0; Q.drills++; Q.phase = 'drill'; Q.phaseT = 0; Q.can = null; Q.canLandT = NaN;
  radio(g, el[0], `stack on the ${doorSaid(g, P.door)} — ${T.room}`); note(Q, g, `stack:${T.room}`); note(Q, g, `drill:${kind}`);
  return true;
}
/** the entry let go of (contact, a reset, its end): every man off the cast's orders where he stands, the tools emptied — a can they had not yet thrown back in the element's pool */
function dropDrill(Q: Qrf) {
  const C = Q.cast, op = Q.op; Q.op = null; if (!C) return;
  if (op && C.tools.ops.includes(op)) Q.bangs = C.tools.bangs + (op.bangHeld ? 1 : 0);   // let go of while it ran: the can in a hand comes back
  else if (op && 'ended' in op) Q.bangs = C.tools.bangs;   // ended by the tools: their count is the count (end() gave an unthrown can back)
  // (neither: the tools started afresh under it and their count is a new bag's — the element's own, as last read, stands)
  C.orders.clear(); C.tools.reset(); C.tools.charges = 0; C.tools.frags = 0;
}
/** Once a frame while the entry runs: the squad's two ticks in the order Game.update gives its own (the tools hand out each stage, the orders walk and pose the
 *  men), the entry's beats copied into the response's log, its can made THEIRS to the shift's ears (phaseBang's rule), and its end read: 'in' = the room is
 *  taken and called; anything else = they could not get onto it, said, and the next room. */
function phaseDrill(g: Game, Q: Qrf, el: Guard[]) {
  const C = Q.cast, op = Q.op, T = Q.target; if (!C || !op || !T) { dropDrill(Q); hold360(g, Q, el); return; }
  // a fresher fix somewhere else while nobody is through the door yet: the entry is let go of and they go to it (phaseMove's two rules — a report on the
  // net, or a shot they heard themselves). One inside this room changes nothing: they are on their way in
  if (op.crossed.size === 0 && g.time - Q.targetAt > 3) {
    const P = T.plan, here = (p: Vec3) => !!P?.bounds && inBounds(p, P.bounds), bf = fixOf(g);
    const net = !!bf && bf.t > Q.fixT + 0.5 && flat(bf.pos, Q.fix ?? bf.pos) > RETARGET_M && !here(bf.pos);
    const own = !net && !!Q.fix && Q.fixT > Q.targetAt && Q.cueRush && flat(Q.fix, T.pos) > RETARGET_M && !here(Q.fix);
    if (net || own) { if (net) { Q.fix = bf!.pos; Q.fixT = bf!.t; } dropDrill(Q); note(Q, g, 'drill-end:re-target'); pickTarget(g, Q, el, false); return; }
  }
  for (const m of el) if (m.held && C.orders.has(m)) C.orders.clear([m]);   // (in Sam's arm: off the entry — the orders would walk him out of it)
  C.tools.tick(); C.orders.tick();
  for (; Q.opBeat < op.beats.length; Q.opBeat++) note(Q, g, `drill:${op.beats[Q.opBeat].what}`);
  if (op.can && !op.can.fired) { Q.can = op.can; Q.canLandT = g.time; }   // (perceiveScripted: the charge they put in is not a noise to them)
  if (op.bangT === g.time && op.bangAt) theirBang(g, Q, op.bangAt, op.threw ?? op.lead);   // (it went off this tick: the shift were told on the net what is going in)
  if (C.tools.ops.includes(op) && Q.phaseT <= DRILL_CAP) { Q.bangs = C.tools.bangs + (op.bangHeld ? 1 : 0); return; }
  const why = C.tools.ops.includes(op) ? 'too long' : (op as DoorOp & { ended?: string }).ended ?? 'gone';
  dropDrill(Q); note(Q, g, `drill-end:${why}`);
  if (why !== 'gone') Q.spent = { room: T.room, fixT: Q.fixT };
  if (why === 'gone') { hold360(g, Q, el); return; }   // (the tools started afresh under it: they re-form where they stand, and the next pick is the room again if it is still the one)
  if (why === 'in') {
    Q.drillsIn++; Q.phase = 'called'; Q.phaseT = 0; Q.cleared.set(T.room, g.time); g.clearedAt.set(T.room, g.time);   // (the shift's pair reads the same ledger — phaseFlow)
    radio(g, el[0], `${T.room} clear — negative contact. ${Q.bangs > 0 ? 'moving on' : 'no bangs left, moving on'}`);
    note(Q, g, `clear:${T.room}`);
  } else { radio(g, el[0], why === 'too long' ? `${T.room} is taking too long — leave it, next` : `can't get ${wg('into', 'onto')} the ${T.room} from here — next`); Q.cleared.set(T.room, g.time - RECLEAR_SECS + 30); hold360(g, Q, el); }
}

// ---------------------------------------------------------------- contact: the fight is the AI's; the element re-forms when it goes cold
function toFight(g: Game, Q: Qrf, el: Guard[], seer: Guard) {
  const fix = seer.lastKnown ? v3.copy(seer.lastKnown) : v3.copy(g.player.char.pos);
  for (const m of el) {
    if (m.script) endGuardScript(m, 'alert');
    m.hold = false; m.pinned = false; m.state = 'alert'; m.awareness = Math.max(m.awareness, m === seer ? 1 : 0.95); m.lastKnown = v3.copy(m === seer && m.lastKnown ? m.lastKnown : fix);
    m.reactT = m === seer ? 0.12 : 0.2 + simRandom() * 0.25; m.fireCd = Math.max(m.fireCd, 0.35); m.searchT = 0; m.foe = RESPONSE.on && seer.foe ? seer.foe : 'player'; resetChase(m);
    m.witness.alertedBy = m === seer ? 'sight' : 'radio'; m.witness.alertT = g.time;
  }
  dropDrill(Q);   // (tune.qrfSquad: the entry they were on is let go of — a can already in the air still goes off, on its own short fuse)
  Q.fix = fix; Q.fixT = g.time; Q.phase = 'fight'; Q.phaseT = 0; Q.can = null;
  g.say(seer, 'CONTACT!'); radio(g, el.find(m => m !== seer) ?? seer, `${RESPONSE.on ? marksOf(g)?.tag ?? 'QRF' : 'QRF'} — contact, ${roomName(g.level, fix)}! push him`);
  g.audio.play('radio', seer.char.bones.head ?? seer.char.pos, 0.8); if (g.time - g.lastStingT > 8) { g.audio.play('alertSting', null, 0.75); g.lastStingT = g.time; }
  note(Q, g, `contact:${seer.callsign}`);
}
function phaseFight(g: Game, Q: Qrf, el: Guard[]) {
  // contact = anybody of theirs with eyes on him lately, or Sam's own report in their ears lately (the dead man's last sight counts: he was shot looking at him)
  let contactT = -1e9;
  for (const m of Q.men) { contactT = Math.max(contactT, m.lastSeenT); if (m.state !== 'dead') contactT = Math.max(contactT, m.witness.heard.lastShotT); }
  const seeing = el.some(m => m.sawPlayerThisFrame || (RESPONSE.on && m.sawFoeThisFrame));
  // a man the chase has dropped to the search while it is still warm goes straight back on the freshest fix (no 'CONTACT!' — he never left it)
  if (g.time - contactT <= REGROUP_SECS) {
    const bf = fixOf(g);
    for (const m of el) if (m.state !== 'alert') { m.state = 'alert'; m.awareness = Math.max(m.awareness, 0.9); m.reactT = 0.15; if (bf) m.lastKnown = v3.copy(bf.pos); m.searchT = 0; m.searchPlan = null; resetChase(m); }
    return;
  }
  if (seeing) return;
  // cold: re-form on the point man where he stands, then choose again off the freshest fix
  Q.phase = 'regroup'; Q.phaseT = 0;
  const lead = el[0]; const f = lead.char.bodyYaw;
  el.forEach((m, k) => {
    m.standoff = null; m.pieing = null; m.searchPlan = null; m.state = 'search'; m.awareness = HUNT_AWARENESS;
    const yaw = f + [0, -Math.PI / 2, Math.PI / 2, Math.PI][k % 4];
    if (k === 0) order(m, { goal: null, face: f, strafe: false, stance: 'none', upper: 'aim', crouch: false, aimAt: sectorPoint(m.char.pos, f) });
    else { const st: Vec3 = [lead.char.pos[0] - Math.sin(f) * k * 1.1 + Math.cos(f) * (k === 1 ? 0.5 : k === 2 ? -0.5 : 0), 0, lead.char.pos[2] - Math.cos(f) * k * 1.1 - Math.sin(f) * (k === 1 ? 0.5 : k === 2 ? -0.5 : 0)]; route(Q, m, [nearestFree(g, st) ?? st], { speed: 2.2, face: yaw, strafe: false, stance: 'none', upper: 'aim', crouch: false, aimAt: sectorPoint(st, yaw) }); }
  });
  radio(g, lead, `lost him. on me — re-form, we clear toward ${w('', 'the ')}${roomName(g.level, fixOf(g)?.pos ?? lead.char.pos)}`);
  note(Q, g, 'regroup');
}

// ---------------------------------------------------------------- waypoint plumbing (RoomClear's: a queue per man, the runner's goal is its head)
function route(Q: Qrf, m: Guard, pts: readonly Vec3[], patch: Parameters<typeof order>[1] = {}) { const w: Vec3[] = pts.map(p => v3.copy(p)); Q.wps.set(m, w); order(m, { ...patch, goal: w[0] ?? null }); }
function advance(Q: Qrf, m: Guard): boolean { const w = Q.wps.get(m); if (!w || !m.script) return !!m.script?.arrived; while (w.length > 1 && flat(m.char.pos, w[0]) < 0.75) { w.shift(); order(m, { goal: w[0] }); } return w.length <= 1 && !!m.script.arrived; }

// ================================================================ tier 2: the compound locked down round him
function maybePerimeter(g: Game, Q: Qrf) {
  if (!g.tune.perimeter || !live(g) || Q.perim || raid(g)) return;   // (a raid: one team, no second lift)
  if (RESPONSE.on && !marksOf(g)?.posts.length) return;   // (this place has no second tier)
  const down = g.guards.filter(x => x.team === 'guard' && x.state === 'dead' && (!netRule(g) || x.found)).length;   // (RESPONSE.net: men they have FOUND down, not men who are)
  const why = Q.lost > 0 ? (RESPONSE.on ? 'one of ours down' : 'a QRF man down') : down >= DOWN_FOR_PERIMETER ? `${down} men down` : Q.shotsSince.length >= GUNFIGHT_SHOTS ? 'a running gunfight' : null;
  if (why) callPerimeter(g, why);
}
/** Lock the compound down (the trigger above, or the panel): control's word, the exterior lamps up, and men to the outside posts — spawned by the gate if the
 *  character budget has room, else the element's rear men re-tasked (two stay inside whatever the knob says). One activation a night. */
export function callPerimeter(g: Game, why = 'panel'): boolean {
  const Q = g.qrf; if (Q.perim) return false;
  if (Q.state !== 'deployed' && why !== 'panel') return false;
  if (!hasResponse(g)) return false;   // (the posts are the office's lot)
  const MK = marksOf(g)!; if (!MK.posts.length) return false;
  const want = Math.min(clamp(Math.round(g.tune.perimeterSize), 2, 4), MK.posts.length);
  const P: Perimeter = { state: 'called', calledAt: g.time, etaAt: g.time + Math.max(5, g.tune.perimeterEta), setAt: -1, men: [], spawned: 0, peeled: 0 };
  Q.perim = P;
  control(g, !RESPONSE.on ? `all stations — lock the compound down. nobody leaves the site: outside team, a man on every exit, ${Math.round(g.tune.perimeterEta)} seconds. exterior lights coming up. (${why})`
    : `all stations — lock ${MK.site} down, ${why}. nobody leaves: a man on every way out, ${Math.round(g.tune.perimeterEta)} seconds${g.targets.some(t => t.group === 'exterior') ? '. outside lights coming up' : ''}`);
  setGroup(g, 'exterior', true);   // the lot's sodium lamps, all of them (the dark one by the lobby too): a switch in the gatehouse — back as authored on a restart (resetLevelState)
  if (missionLive(g)) g.mission.stats.qrf = 2;
  // who mans it
  const outside = RESPONSE.on ? MK.outside.filter(p => clearOfFoes(g, p)) : MK.outside;   // (RESPONSE: a mark an enemy stands by stands nobody up — the rear men go out instead)
  const room = roomFor(g); const nSpawn = Math.min(want, Math.max(0, room), outside.length, RESPONSE.on ? Math.max(0, mostMen(g) - alive(Q, g).length) : want);   // (RESPONSE: never more of them on the floor than the level's most)
  for (let i = 0; i < nSpawn; i++) {
    try {
      const gd = spawnUnit(g, { team: 'guard', pos: outside[i] as Vec3, yaw: Math.PI, weapon: 'aks74u', name: `GATE-${i + 1}`, light: true, tint: [...QRF_TINT], tint2: [...QRF_TINT2], ...budgetOf(g) });
      gd.trained = true; gd.hold = false; gd.state = 'search'; gd.awareness = HUNT_AWARENESS; gd.heardUpTo = g.eventSeq;
      P.men.push({ gd, post: MK.posts[P.men.length], arrivedAt: -1, fighting: false }); P.spawned++;
    } catch (e) { note(Q, g, `perim-spawn-failed:${String((e as Error)?.message ?? e).slice(0, 40)}`); break; }
  }
  const el = alive(Q, g); const spare = Math.max(0, el.length - 2);
  const nPeel = Math.min(want - P.men.length, spare);
  const onDrill = nPeel > 0 && !!Q.op; if (onDrill) { dropDrill(Q); note(Q, g, 'drill-end:peel'); }   // (tune.qrfSquad: men leave the element under an entry — it is let go of whole, and who is left re-forms)
  for (let i = 0; i < nPeel; i++) {
    const gd = el[el.length - 1 - i];   // the rear men go out
    if (gd.script) endGuardScript(gd, 'search'); gd.state = 'search'; gd.standoff = null; gd.pieing = null; gd.searchPlan = null;
    P.men.push({ gd, post: MK.posts[P.men.length], arrivedAt: -1, fighting: false }); P.peeled++;
  }
  Q.men = Q.men.filter(m => !P.men.some(p => p.gd === m));   // (peeled men leave the element's order; they stay 'owned' through perim)
  for (const m of P.men.map(p => p.gd)) { Q.wps.delete(m); Q.stations.delete(m); }
  for (const p of P.men) toPost(g, p);
  if (onDrill) hold360(g, Q, alive(Q, g));
  const names = P.men.map(p => p.gd.callsign);
  if (P.men.length) radio(g, P.men[0].gd, `${names.join(', ')} — going outside. ${P.men.map(p => p.post.name).join(' and ')}, from the outside, lights on the doors`);
  else control(g, wg("there's no outside team — the lights are all you get. watch the exits from inside", 'no outside team to be had — the lamps are all you get. watch the exits from inside'));
  note(Q, g, `perimeter:${why}:${P.spawned}s+${P.peeled}p`);
  return true;
}
function toPost(g: Game, p: Perimeter['men'][number]) {
  const gd = p.gd; gd.pinned = false; gd.hold = false; p.fighting = false;
  order(gd, { goal: v3.copy(p.post.pos), speed: POST_SPEED, face: p.post.yaw, strafe: false, stance: 'none', upper: 'aim', crouch: false, aimAt: v3.copy(p.post.sweep[0]) });
}
function tickPerimeter(g: Game, Q: Qrf, dt: number) {
  const P = Q.perim!;
  for (const p of P.men) {
    const gd = p.gd; if (gd.state === 'dead') continue;
    if (gd.held) continue;   // in Sam's arm: off the script (startGrab ended it) and off his own eyes — not re-ordered to the post from under the arm (he squares back up if he ever gets out of it: the else branch below)
    if (gd.script) {
      if (p.arrivedAt < 0 && (gd.script.arrived || (flat(gd.char.pos, p.post.pos) < 0.7 && gd.speed < 0.2))) { p.arrivedAt = g.time; gd.pinned = true; note(Q, g, `post:${p.post.name}`); }
      // the light works the door: the aim point eased to and fro along the stretch of wall the post covers
      if (p.arrivedAt >= 0) { const u = 0.5 + 0.5 * Math.sin((g.time - p.arrivedAt) * (2 * Math.PI / SWEEP_SECS)); const [a, b] = p.post.sweep; gd.script.aimAt = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; }
      const eyes = perceiveScripted(g, Q, gd, dt);
      const him = (RESPONSE.on ? foeChar(g, gd)?.pos : null) ?? g.player.char.pos;   // (RESPONSE: the man he has made out — perceiveScripted names him — not Sam whoever it was)
      if (eyes && p.arrivedAt < 0 && flat(gd.char.pos, him) > WALKOUT_ENGAGE_M && gd.sup.v < 0.3) { gd.awareness = Math.min(gd.awareness, 0.84); Q.fix = v3.copy(him); Q.fixT = g.time; }   // on his way out and Sam not on top of him: he calls it (the element's fix) and keeps going — the post is the order
      else if (eyes) {   // eyes on him from the post (or at arm's length on the way): the AI fires from where he stands (pinned at the post), the others are told where
        endGuardScript(gd, 'alert'); gd.pinned = p.arrivedAt >= 0; gd.state = 'alert'; gd.awareness = 1; gd.reactT = 0.35; gd.fireCd = Math.max(gd.fireCd, 0.4); if (!RESPONSE.on) gd.foe = 'player'; resetChase(gd); p.fighting = true;   // (a beat to shout it before the first burst — a man walking out into a lit lot has that long)
        gd.witness.alertedBy = 'sight'; gd.witness.alertT = g.time;
        g.say(gd, 'CONTACT — outside!'); radio(g, gd, `contact outside — ${p.post.name}, he's coming out!`); if (g.time - g.lastStingT > 8) { g.audio.play('alertSting', null, 0.75); g.lastStingT = g.time; }
        note(Q, g, `perim-contact:${p.post.name}`);
      }
    } else {
      // fighting from the post; eight seconds cold (or the AI talked him down a state) and he squares back up to the door
      const cold = g.time - Math.max(gd.lastSeenT, gd.witness.heard.lastShotT) > REGROUP_SECS && !gd.sawPlayerThisFrame && !(RESPONSE.on && gd.sawFoeThisFrame);
      if (cold || (gd.state !== 'alert')) { gd.state = 'search'; gd.awareness = HUNT_AWARENESS; gd.standoff = null; gd.searchPlan = null; toPost(g, p); if (p.arrivedAt >= 0 && flat(gd.char.pos, p.post.pos) < 1) gd.pinned = true; }
    }
  }
  if (P.state === 'called') {
    const allSet = P.men.length > 0 && P.men.every(p => p.gd.state === 'dead' || p.arrivedAt >= 0);
    if (allSet || g.time > P.etaAt + 10) {
      P.state = 'set'; P.setAt = g.time;
      const up = P.men.filter(p => p.gd.state !== 'dead' && p.arrivedAt >= 0);
      if (up.length) radio(g, up[0].gd, `perimeter set — eyes on ${up.map(p => p.post.name).join(' and ')}. lights are up outside; nobody walks out of here`);
      else control(g, wg('perimeter is what it is — lights up, no eyes outside. hold the exits from inside', 'perimeter is what it is — lamps up, no eyes outside. hold the exits from inside'));
      note(Q, g, `perimeter-set:${up.length}`);
    }
  }
}
