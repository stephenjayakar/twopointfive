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
// QA: tools/qa/qrf-probes.ts (`probes.ts qrf`), soak.ts --loud-at; tools/qa/qrf-squad-check.ts (the squad's drill).
import { QRF_TINT, QRF_TINT2 } from './consts';
import { Vec3, v3, clamp, wrapAngle } from '../math/vec';
import { TOSS_QUICK } from './character';
import { toolSpot } from './handleside';
import type { Game, Guard } from './game';
import type { RoomClearPlan } from '../scene/level';
import type { Door } from './doors';
import type { Item } from './throwables';
import { radioHand } from './handwork';
import { spawnUnit, despawnUnit, escalationOf, hearingCheck, canSee, sightGain, bodyInView, pointInView, standoffPerceive, resetChase, bodyPos, bubbleSecs } from './guards';
import { order, endGuardScript, inBounds } from './squad';
import { sideOf } from './orders';
import type { DoorOp } from './doortools';
import { squadCast, EVERY_KEY, type SquadCast } from './squadcast';
import { detonateStun } from './combat';
import { isDaylight, setGroup } from './lighting';
import { roomName } from './dialogue';
import { doorLabel } from './tactics';
import { WORDS, w } from './words';
import { TRAINED } from './aim';
import { tally, missionLive } from './mission';
import { isBreathing } from './game';
import { chronRadio, chronicle } from './chronicle';
import { simRandom } from '../math/dice';   // the simulation's die (math/dice.ts): the Game's own when it has one, Math.random otherwise

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
interface Target { kind: 'room' | 'point'; plan: RoomClearPlan | null; room: string; pos: Vec3; }
/** the perimeter tier: called (control's line, men picked and moving) → set (posts taken, or the ETA and ten seconds gone) */
interface Perimeter { state: 'called' | 'set'; calledAt: number; etaAt: number; setAt: number; men: { gd: Guard; post: typeof QRF_MARKS.posts[number]; arrivedAt: number; fighting: boolean }[]; spawned: number; peeled: number; }

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
  loudT = -1e9; shotsSince: number[] = []; heardEvents = new WeakSet<object>();
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
function doorSaid(g: Game, name: string): string { const d = WORDS.on ? g.doors.byName(name) : undefined; return d ? doorLabel(d) : name.replace(/_/g, ' '); }
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
function live(g: Game): boolean { return g.aiEnabled && !g.quietUtility && !g.touring && !isDaylight(g) && !g.player.down && !g.nightBreach?.active && !g.rescue?.active && hasResponse(g); }
/** THIS LEVEL HAS A RESPONSE TEAM: the marks above are the office's stairwell. A level that carries its own places (a quiet mission: its file's scenarios.quiet
 *  — scene/scenarios.ts) has the team only if it has the team's door (a floor built round the office's west stair, landing and all); without it there is nobody
 *  to send — no request, no radio promise, no men stood on another building's coordinates. Every other level: as it always was. */
export function hasResponse(g: Game): boolean { return !g.level.scenarios?.quiet || !!g.doors.byName(QRF_MARKS.door); }
function alive(Q: Qrf, g: Game): Guard[] { return Q.men.filter(m => m.state !== 'dead' && g.guards.includes(m)); }
/** the floor's freshest fix on Sam: the man (staff or response) who had eyes on him last and still holds a fix, else the alarm's own place */
function bestFix(g: Game): { pos: Vec3; t: number } | null {
  let best: Guard | null = null;
  for (const x of g.guards) if (x.state !== 'dead' && x.team === 'guard' && x.lastKnown && x.lastSeenT > (best?.lastSeenT ?? -1e9)) best = x;
  if (best && best.lastSeenT > -50) return { pos: v3.copy(best.lastKnown!), t: best.lastSeenT };
  if (g.alarm.placed) return { pos: v3.copy(g.alarm.pos), t: g.alarm.raisedAt };
  return best?.lastKnown ? { pos: v3.copy(best.lastKnown), t: -100 } : null;
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
  const Q = g.qrf;
  if (Q.state !== 'idle') {
    if (g.time - Q.refusedAt > 20) { Q.refusedAt = g.time; control(g, Q.state === 'deployed' ? "negative, two-six — the response team is already on your floor. that's everyone we've got tonight" : 'negative — QRF is already rolling to you. one team, one lift; hold what you have'); note(Q, g, 'refused'); }
    return false;
  }
  if (!g.tune.qrf && reason !== 'panel') return false;
  if (!live(g) && reason !== 'panel') return false;
  if (!hasResponse(g)) { note(Q, g, 'no-team:this level has no stairwell for one'); return false; }
  const size = Math.min(clamp(Math.round(g.tune.qrfSize), 2, 4), CHAR_BUDGET - 1 - g.guards.length);
  if (size < 2) { note(Q, g, `no-room:${CHAR_BUDGET - 1 - g.guards.length}`); return false; }   // (the renderer's character budget has no room for even a pair: nothing is promised on the radio that cannot come)
  Q.state = 'requested'; Q.reason = reason; Q.requestedAt = g.time; Q.arriveAt = g.time + Math.max(12, g.tune.qrfEta); Q.answered = Q.said30 = Q.said10 = false;
  const sp = staffVoice(g); const n = bodiesFound(g);
  const line = reason === 'bodies' ? `control, ${sp?.callsign ?? 'two-six'} — ${n >= 2 ? `${n} men down` : 'men down'} on two-six and whoever did it is still up here. we need the response team` : reason === 'gunfire' ? `control, ${sp?.callsign ?? 'two-six'} — shots fired on two-six${w('', ', automatic fire')}. this is past us — get the response team up here` : `control, ${sp?.callsign ?? 'two-six'} — send the response team up to two-six. now`;
  if (sp) radio(g, sp, line); else if (reason === 'silent') controlRow(g, 'all stations, control — shots reported on two-six and nobody up there is answering. response team, go'); else control(g, 'two-six has gone quiet with an alarm up — response team, go');
  note(Q, g, `request:${reason}`);
  return true;
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
  if (!roster || on || (Q.silentAt < 0 && g.time - Q.loudT >= LOUD_MEMORY_SECS) || !g.doors.byName(QRF_MARKS.door)) { Q.silentAt = -1; Q.silentSaid = false; return false; }
  if (Q.silentAt < 0) { Q.silentAt = g.time; note(Q, g, 'silent'); }
  const t = g.time - Q.silentAt;
  if (!Q.silentSaid && t >= SILENT_CHECK_SECS) { Q.silentSaid = true; controlRow(g, 'two-six, control — radio check. shots reported on your floor and nothing since. any station on two-six, respond'); note(Q, g, 'radio-check'); }
  if (t < SILENT_GO_SECS) return false;
  Q.silentSpent = true;   // (asked for, or refused for want of room in the character budget: either way once)
  return requestQrf(g, 'silent');
}

/** Once a frame from game.ts (after the guards and the alarm). */
export function updateQrf(g: Game, dt: number) {
  const Q = g.qrf; if (!Q) return;
  // ---- the trigger's memory: Sam's reports at gunfire level that reached a living staff man's ears this frame (the hearing model's rule for gunfire: 80 m straight)
  for (const e of g.events) {   // (each report once, whichever frame it was filed on: a round let go between two updates carries the earlier stamp)
    if ((e.level ?? 0) < 1 || (e.kind !== 'shot' && e.kind !== 'guardShot') || Q.heardEvents.has(e)) continue;
    Q.heardEvents.add(e);
    if (e.kind === 'shot') { for (const x of g.guards) if (!x.unit && x.state !== 'dead' && !x.held && v3.dist(e.pos, x.char.pos) <= 80) { Q.loudT = g.time; break; } }
    if (Q.state === 'deployed' && g.time - Q.deployedAt > SETTLE_IN_SECS) Q.shotsSince.push(g.time);   // (the gunfight that counts toward the compound's lockdown is one the team is on the floor and IN — not the exchange they walked in on)
  }
  while (Q.shotsSince.length && g.time - Q.shotsSince[0] > GUNFIGHT_WINDOW) Q.shotsSince.shift();
  if (Q.state === 'idle') {
    if (!g.tune.qrf || !live(g) || !g.tune.qrfSilent) { Q.silentAt = -1; Q.silentSaid = false; }   // (the silent net's clock runs only while the rule could act: a run not live for a stretch starts it afresh, cue first)
    if (!g.tune.qrf || !live(g)) return;
    if (g.tune.qrfSilent && silentNet(g, Q)) return;
    if (escalationOf(g) < 2) return;
    if (g.time - Q.loudT < LOUD_MEMORY_SECS) requestQrf(g, 'gunfire');
    else if (bodiesFound(g) >= 2) requestQrf(g, 'bodies');
    return;
  }
  // ---- the telegraph (runs on under anything: the men are on the stairs whether or not the tour has since started — but nothing new is SAID under its flag)
  const quiet = g.quietUtility || g.touring;
  if (Q.state === 'requested' && g.time - Q.requestedAt >= ANSWER_SECS) {
    Q.state = 'inbound'; Q.answered = true;
    if (!quiet) control(g, Q.reason === 'silent' ? `all stations — QRF is rolling to two-six: ${Math.min(4, clamp(Math.round(g.tune.qrfSize), 2, 4))} men, west stairwell, ${Math.round(Q.arriveAt - g.time)} seconds`   // (nobody on two-six is left to be told to hold)
      : `copy two-six. QRF is rolling — ${Math.min(4, clamp(Math.round(g.tune.qrfSize), 2, 4))} men, west stairwell, ${Math.round(Q.arriveAt - g.time)} seconds. lock down and hold what you've got`);
    note(Q, g, 'control');
  }
  if ((Q.state === 'inbound' || Q.state === 'requested') && !Q.said30 && Q.arriveAt - g.time <= CALL30) { Q.said30 = true; if (Q.arriveAt - Q.requestedAt > CALL30 + 5 && !quiet) { control(g, Q.reason === 'silent' ? 'all stations — QRF is thirty seconds out from two-six, coming up the west stairs' : 'two-six, QRF is thirty seconds out — coming up the west stairs. check your fire that end'); note(Q, g, 'thirty'); } }
  if ((Q.state === 'inbound' || Q.state === 'requested') && Q.arriveAt - g.time <= CALL10) arriving(g, Q, quiet);
  if (Q.state === 'arriving' && g.time >= Q.arriveAt) deploy(g, Q, quiet);
  if (Q.state === 'deployed' && !Q.everyoneSaid && g.time - Q.deployedAt > 4.5) { Q.everyoneSaid = true; if (!quiet && Q.men.length) control(g, "all stations — that's the response team on your floor, and that's everyone we've got tonight. make it count"); }   // (said once: there is no second wave, and they know it)
  if (Q.state === 'arriving' || Q.state === 'deployed') tickMen(g, Q, dt);
}

/** T−10: the men exist from here — stood on the landing behind the shut steel door, lights on (the glow under it), boots on the stairs through it, the lead's word. */
function arriving(g: Game, Q: Qrf, quiet: boolean) {
  Q.state = 'arriving'; Q.said10 = true;
  const want = clamp(Math.round(g.tune.qrfSize), 2, 4); const room = CHAR_BUDGET - 1 - g.guards.length; const n = Math.min(want, room);
  const door = g.doors.byName(QRF_MARKS.door); const yaw = Math.PI / 2;
  for (let i = 0; i < n; i++) {
    let gd: Guard;
    const at = i === 0 && door ? toolSpot(g, door, g.doors.side(door, QRF_MARKS.landing[0]), QRF_MARKS.landing[0])?.pos ?? QRF_MARKS.landing[0] : QRF_MARKS.landing[i];   // (handleside.ts: #1 is the man on the bar — at the handle of a leaf that opens toward the landing, clear of its swing)
    try { gd = spawnUnit(g, { team: 'guard', pos: at, yaw, weapon: 'aks74u', name: `QRF-${i + 1}`, light: true, tint: [...QRF_TINT], tint2: [...QRF_TINT2] }); }
    catch (e) { note(Q, g, `spawn-failed:${i}:${String((e as Error)?.message ?? e).slice(0, 40)}`); break; }
    gd.trained = true; gd.hold = false; gd.state = 'search'; gd.awareness = HUNT_AWARENESS; gd.foe = 'player';
    gd.heardUpTo = g.eventSeq;
    order(gd, { goal: null, face: yaw, stance: 'highReady', upper: 'none', aimAt: null, crouch: false });   // at the high port on the landing, facing the door
    Q.men.push(gd);
  }
  Q.bangs = Q.men.length;
  if (n < want) note(Q, g, `capped:${Q.men.length}/${want}`);
  if (!Q.men.length) { Q.state = 'deployed'; Q.deployedAt = g.time; if (!quiet) control(g, 'two-six — QRF is held below, nobody is coming through that door. you are on your own up there'); note(Q, g, 'nobody'); return; }   // (the character budget went between the request and now: the wave is spent, honestly)
  if (door) g.audio.play('stairBoots', [door.frameCentre[0] - 1.2, 0.3, door.frameCentre[2]], 0.75);
  if (!quiet) radio(g, Q.men[0], `QRF on the stairs — ${Q.men.length} of us, ten seconds. we come in the west stair door: nobody west of the lobby arch, check your fire`);
  note(Q, g, `ten:${Q.men.length}`);
  Q.phase = 'landing'; Q.phaseT = 0;
}

/** T: the bar goes down and the leaf is thrown into the corridor off its real hinge (it booms off its stop like a kicked one — a guard's doing, so the shift do not
 *  come running to it; Sam hears it down the corridor), the stairwell rings, and they file in. */
function deploy(g: Game, Q: Qrf, quiet: boolean) {
  Q.state = 'deployed'; Q.deployedAt = g.time; Q.phase = 'file'; Q.phaseT = 0; Q.filed = 0;
  const door = g.doors.byName(QRF_MARKS.door); const lead = alive(Q, g)[0];
  if (door && lead) flingOpen(g, door, lead);
  if (door) g.audio.play('stairDoor', door.frameCentre, 1.0);
  if (missionLive(g)) { g.mission.stats.qrf = Math.max(g.mission.stats.qrf, 1) as 0 | 1 | 2; g.mission.stats.qrfAt = g.mission.stats.elapsed; }
  if (!quiet) radio(g, lead, `QRF on two-six — ${alive(Q, g).length} in through the west stairs, moving as one element`);
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
    const d = g.doors.byName(QRF_MARKS.door), up = alive(Q, g);
    if (!d || d.off || d.latched || d.def.closer === false || !up.length) Q.doorPulled = true;
    else { const land = g.doors.pullFace(d, QRF_MARKS.landing[0]); let last: Guard | null = null, ld = Infinity, through = true;   // (pullFace: which side of the FRAME — Doors.side is the leaf's, and the leaf stands open)
      for (const m of up) { const dd = flat(m.char.pos, d.frameCentre); if (g.doors.pullFace(d, m.char.pos) === land || dd < 1.5) through = false; if (dd < ld) { ld = dd; last = m; } }
      if (through && last) { Q.doorPulled = true; if (ld < 6) { g.doors.pullTo(d, last.char.id); note(Q, g, 'door-to'); } } }
  }
  if (Q.perim) tickPerimeter(g, Q, dt); else if (Q.state === 'deployed') maybePerimeter(g, Q);
  if (!el.length) { if (Q.phase !== 'fight') { dropDrill(Q); Q.phase = 'fight'; note(Q, g, 'wiped'); } return; }   // (dropDrill: a can of theirs still in a dead hand goes on its own short fuse, not never)
  if (Q.state === 'arriving') { for (const m of el) perceiveScripted(g, Q, m, dt); return; }   // on the landing: ears open (deaf to before they existed), nothing else
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
  if (contact && (Q.phase !== 'file' || flat(contact.char.pos, g.player.char.pos) < 8)) toFight(g, Q, el, contact);
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
  const due = Math.min(el.length, Math.floor(Q.phaseT / FILE_GAP) + 1);
  while (Q.filed < due) {
    const i = Q.filed; const m = el[i]; if (!m) break;
    m.state = 'search'; m.awareness = Math.max(m.awareness, HUNT_AWARENESS);
    route(Q, m, [QRF_MARKS.entry[i] ?? QRF_MARKS.entry[0]], { speed: 2.4, face: QRF_MARKS.entryFace[i] ?? Math.PI / 2, stance: 'none', upper: 'aim', aimAt: sectorPoint(QRF_MARKS.entry[i] ?? QRF_MARKS.entry[0], QRF_MARKS.entryFace[i] ?? Math.PI / 2), crouch: i === 3, strafe: false });
    Q.filed++; note(Q, g, `in:${i + 1}`);
  }
  for (const m of el) advance(Q, m);
  const allIn = Q.filed >= el.length && el.every(m => m.char.pos[0] > 4.4 && (m.script?.arrived || flat(m.char.pos, m.script?.goal ?? m.char.pos) < 0.9));
  if (allIn || Q.phaseT > FILE_GAP * el.length + 6) { Q.phase = 'fan'; Q.phaseT = 0; note(Q, g, 'fan'); }
}
const sectorPoint = (p: Vec3, yaw: number, d = 5, y = 1.0): Vec3 => [p[0] + Math.sin(yaw) * d, y, p[2] + Math.cos(yaw) * d];

// ---------------------------------------------------------------- targeting
/** Choose where the element goes next and set it moving: the room holding the fix if a plan covers it (else the fix itself as a point to close on and hold), then
 *  rooms by walking distance from the fix, skipping any called clear lately (theirs or the shift's) unless the fix is inside it. `fresh`: re-read the floor's fix first. */
function pickTarget(g: Game, Q: Qrf, el: Guard[], fresh: boolean) {
  const bf = bestFix(g);
  if (bf && (fresh || !Q.fix || bf.t > Q.fixT)) { Q.fix = bf.pos; Q.fixT = Math.max(Q.fixT, bf.t); }
  const fix: Vec3 = Q.fix ?? [20, 0, 11.1];   // (nothing at all to go on: the middle of the corridor, and the rooms off it)
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
  Q.targetAt = g.time;
  const same = !!prev && prev.kind === next.kind && prev.room === next.room && flat(prev.pos, next.pos) < 2;
  if (same && prevPhase === 'move') return;   // (the periodic re-read came to the same place: the walk goes on as it is, and nothing is said twice)
  if (same && next.kind === 'point' && flat(from, next.pos) < 3) { Q.phase = 'hold'; Q.phaseT = 0; return; }   // (already standing on the only place worth standing: keep the hold, look again in a beat)
  Q.target = next;
  startMove(g, Q, el);
  const lead = el[0];
  radio(g, lead, next.kind === 'room' ? `element moving — ${next.room}, by the ${doorSaid(g, next.plan!.door)} door` : `element moving — ${next.room}, on the last fix`);
  note(Q, g, `target:${next.kind}:${next.room}`);
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
  const bf = bestFix(g);
  if (bf && bf.t > Q.fixT + 0.5 && flat(bf.pos, Q.fix ?? bf.pos) > RETARGET_M && g.time - Q.targetAt > 3) { Q.fix = bf.pos; Q.fixT = bf.t; pickTarget(g, Q, el, false); return; }
  if (Q.fix && Q.fixT > Q.targetAt && flat(Q.fix, T.kind === 'room' ? T.pos : T.pos) > RETARGET_M && g.time - Q.targetAt > 3 && Q.cueRush) { pickTarget(g, Q, el, false); return; }
  if (g.time - Q.targetAt > RETARGET_SECS && Q.phaseT > RETARGET_SECS) { pickTarget(g, Q, el, true); return; }
  // there: the point man on his mark (or as near as the floor lets him) — a room: into the stack; a point: hold all round, then choose again
  const arrived = !!lead.script?.arrived || (flat(lp, lead.script?.goal ?? lp) < 1.0 && lead.speed < 0.2 && Q.phaseT > 2);
  const eta = 60;
  if (arrived || Q.phaseT > eta) {
    if (T.kind === 'room' && flat(lp, T.plan!.stack[0]) < 4) { if (!(g.tune.qrfSquad && startDrill(g, Q, el))) startStack(g, Q, el); }
    else if (T.kind === 'room') { radio(g, lead, `can't get onto the ${T.room} from here — next`); Q.cleared.set(T.room, g.time - RECLEAR_SECS + 30); hold360(g, Q, el); }
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
  radio(g, el[0], `stack on the ${doorSaid(g, P.door)} door — ${Q.target!.room}`); note(Q, g, `stack:${Q.target!.room}`);
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
    it.onBounce = (sp, p) => g.audio.play('canisterBounce', p, Math.min(1, sp / 4));
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
  const C = Q.cast ??= squadCast(g, { mine: gd => Q.men.includes(gd), team: 'guard', ring: EVERY_KEY });
  C.tools.sync(); C.tools.bangs = Q.bangs; C.tools.charges = 0; C.tools.frags = 0; C.tools.lights = true;   // (sync first: a roster that has changed — a man peeled off to the perimeter — starts the tools afresh, counts and all)
  const inside = !!Q.fix && !!P.bounds && inBounds(Q.fix, P.bounds);
  const kind = !inside ? 'threshold' : Q.bangs > 0 ? 'bangClear' : 'openClear';
  const op = C.tools.order(kind, el, d, sideOf(d, P.stack[0]));
  if (typeof op === 'string') { Q.bangs = C.tools.bangs; note(Q, g, `drill-no:${op}`); return false; }
  Q.op = op; Q.opBeat = 0; Q.drills++; Q.phase = 'drill'; Q.phaseT = 0; Q.can = null; Q.canLandT = NaN;
  radio(g, el[0], `stack on the ${doorSaid(g, P.door)} door — ${T.room}`); note(Q, g, `stack:${T.room}`); note(Q, g, `drill:${kind}`);
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
    const P = T.plan, here = (p: Vec3) => !!P?.bounds && inBounds(p, P.bounds), bf = bestFix(g);
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
  } else { radio(g, el[0], why === 'too long' ? `${T.room} is taking too long — leave it, next` : `can't get onto the ${T.room} from here — next`); Q.cleared.set(T.room, g.time - RECLEAR_SECS + 30); hold360(g, Q, el); }
}

// ---------------------------------------------------------------- contact: the fight is the AI's; the element re-forms when it goes cold
function toFight(g: Game, Q: Qrf, el: Guard[], seer: Guard) {
  const fix = seer.lastKnown ? v3.copy(seer.lastKnown) : v3.copy(g.player.char.pos);
  for (const m of el) {
    if (m.script) endGuardScript(m, 'alert');
    m.hold = false; m.pinned = false; m.state = 'alert'; m.awareness = Math.max(m.awareness, m === seer ? 1 : 0.95); m.lastKnown = v3.copy(m === seer && m.lastKnown ? m.lastKnown : fix);
    m.reactT = m === seer ? 0.12 : 0.2 + simRandom() * 0.25; m.fireCd = Math.max(m.fireCd, 0.35); m.searchT = 0; m.foe = 'player'; resetChase(m);
    m.witness.alertedBy = m === seer ? 'sight' : 'radio'; m.witness.alertT = g.time;
  }
  dropDrill(Q);   // (tune.qrfSquad: the entry they were on is let go of — a can already in the air still goes off, on its own short fuse)
  Q.fix = fix; Q.fixT = g.time; Q.phase = 'fight'; Q.phaseT = 0; Q.can = null;
  g.say(seer, 'CONTACT!'); radio(g, el.find(m => m !== seer) ?? seer, `QRF — contact, ${roomName(g.level, fix)}! push him`);
  g.audio.play('radio', seer.char.bones.head ?? seer.char.pos, 0.8); if (g.time - g.lastStingT > 8) { g.audio.play('alertSting', null, 0.75); g.lastStingT = g.time; }
  note(Q, g, `contact:${seer.callsign}`);
}
function phaseFight(g: Game, Q: Qrf, el: Guard[]) {
  // contact = anybody of theirs with eyes on him lately, or Sam's own report in their ears lately (the dead man's last sight counts: he was shot looking at him)
  let contactT = -1e9;
  for (const m of Q.men) { contactT = Math.max(contactT, m.lastSeenT); if (m.state !== 'dead') contactT = Math.max(contactT, m.witness.heard.lastShotT); }
  const seeing = el.some(m => m.sawPlayerThisFrame);
  // a man the chase has dropped to the search while it is still warm goes straight back on the freshest fix (no 'CONTACT!' — he never left it)
  if (g.time - contactT <= REGROUP_SECS) {
    const bf = bestFix(g);
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
  radio(g, lead, `lost him. on me — re-form, we clear toward ${w('', 'the ')}${roomName(g.level, bestFix(g)?.pos ?? lead.char.pos)}`);
  note(Q, g, 'regroup');
}

// ---------------------------------------------------------------- waypoint plumbing (RoomClear's: a queue per man, the runner's goal is its head)
function route(Q: Qrf, m: Guard, pts: readonly Vec3[], patch: Parameters<typeof order>[1] = {}) { const w: Vec3[] = pts.map(p => v3.copy(p)); Q.wps.set(m, w); order(m, { ...patch, goal: w[0] ?? null }); }
function advance(Q: Qrf, m: Guard): boolean { const w = Q.wps.get(m); if (!w || !m.script) return !!m.script?.arrived; while (w.length > 1 && flat(m.char.pos, w[0]) < 0.75) { w.shift(); order(m, { goal: w[0] }); } return w.length <= 1 && !!m.script.arrived; }

// ================================================================ tier 2: the compound locked down round him
function maybePerimeter(g: Game, Q: Qrf) {
  if (!g.tune.perimeter || !live(g) || Q.perim) return;
  const down = g.guards.filter(x => x.team === 'guard' && x.state === 'dead').length;
  const why = Q.lost > 0 ? 'a QRF man down' : down >= DOWN_FOR_PERIMETER ? `${down} men down` : Q.shotsSince.length >= GUNFIGHT_SHOTS ? 'a running gunfight' : null;
  if (why) callPerimeter(g, why);
}
/** Lock the compound down (the trigger above, or the panel): control's word, the exterior lamps up, and men to the outside posts — spawned by the gate if the
 *  character budget has room, else the element's rear men re-tasked (two stay inside whatever the knob says). One activation a night. */
export function callPerimeter(g: Game, why = 'panel'): boolean {
  const Q = g.qrf; if (Q.perim) return false;
  if (Q.state !== 'deployed' && why !== 'panel') return false;
  if (!hasResponse(g)) return false;   // (the posts are the office's lot)
  const want = clamp(Math.round(g.tune.perimeterSize), 2, 4);
  const P: Perimeter = { state: 'called', calledAt: g.time, etaAt: g.time + Math.max(5, g.tune.perimeterEta), setAt: -1, men: [], spawned: 0, peeled: 0 };
  Q.perim = P;
  control(g, `all stations — lock the compound down. nobody leaves the site: outside team, a man on every exit, ${Math.round(g.tune.perimeterEta)} seconds. exterior lights coming up. (${why})`);
  setGroup(g, 'exterior', true);   // the lot's sodium lamps, all of them (the dark one by the lobby too): a switch in the gatehouse — back as authored on a restart (resetLevelState)
  if (missionLive(g)) g.mission.stats.qrf = 2;
  // who mans it
  const room = CHAR_BUDGET - 1 - g.guards.length; const nSpawn = Math.min(want, Math.max(0, room));
  for (let i = 0; i < nSpawn; i++) {
    try {
      const gd = spawnUnit(g, { team: 'guard', pos: QRF_MARKS.outsideSpawn[i], yaw: Math.PI, weapon: 'aks74u', name: `GATE-${i + 1}`, light: true, tint: [...QRF_TINT], tint2: [...QRF_TINT2] });
      gd.trained = true; gd.hold = false; gd.state = 'search'; gd.awareness = HUNT_AWARENESS; gd.heardUpTo = g.eventSeq;
      P.men.push({ gd, post: QRF_MARKS.posts[P.men.length], arrivedAt: -1, fighting: false }); P.spawned++;
    } catch (e) { note(Q, g, `perim-spawn-failed:${String((e as Error)?.message ?? e).slice(0, 40)}`); break; }
  }
  const el = alive(Q, g); const spare = Math.max(0, el.length - 2);
  const nPeel = Math.min(want - P.men.length, spare);
  const onDrill = nPeel > 0 && !!Q.op; if (onDrill) { dropDrill(Q); note(Q, g, 'drill-end:peel'); }   // (tune.qrfSquad: men leave the element under an entry — it is let go of whole, and who is left re-forms)
  for (let i = 0; i < nPeel; i++) {
    const gd = el[el.length - 1 - i];   // the rear men go out
    if (gd.script) endGuardScript(gd, 'search'); gd.state = 'search'; gd.standoff = null; gd.pieing = null; gd.searchPlan = null;
    P.men.push({ gd, post: QRF_MARKS.posts[P.men.length], arrivedAt: -1, fighting: false }); P.peeled++;
  }
  Q.men = Q.men.filter(m => !P.men.some(p => p.gd === m));   // (peeled men leave the element's order; they stay 'owned' through perim)
  for (const m of P.men.map(p => p.gd)) { Q.wps.delete(m); Q.stations.delete(m); }
  for (const p of P.men) toPost(g, p);
  if (onDrill) hold360(g, Q, alive(Q, g));
  const names = P.men.map(p => p.gd.callsign);
  if (P.men.length) radio(g, P.men[0].gd, `${names.join(', ')} — going outside. ${P.men.map(p => p.post.name).join(' and ')}, from the outside, lights on the doors`);
  else control(g, 'no outside team to be had — the lamps are all you get. watch the exits from inside');
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
      if (eyes && p.arrivedAt < 0 && flat(gd.char.pos, g.player.char.pos) > WALKOUT_ENGAGE_M && gd.sup.v < 0.3) { gd.awareness = Math.min(gd.awareness, 0.84); Q.fix = v3.copy(g.player.char.pos); Q.fixT = g.time; }   // on his way out and Sam not on top of him: he calls it (the element's fix) and keeps going — the post is the order
      else if (eyes) {   // eyes on him from the post (or at arm's length on the way): the AI fires from where he stands (pinned at the post), the others are told where
        endGuardScript(gd, 'alert'); gd.pinned = p.arrivedAt >= 0; gd.state = 'alert'; gd.awareness = 1; gd.reactT = 0.35; gd.fireCd = Math.max(gd.fireCd, 0.4); gd.foe = 'player'; resetChase(gd); p.fighting = true;   // (a beat to shout it before the first burst — a man walking out into a lit lot has that long)
        gd.witness.alertedBy = 'sight'; gd.witness.alertT = g.time;
        g.say(gd, 'CONTACT — outside!'); radio(g, gd, `contact outside — ${p.post.name}, he's coming out!`); if (g.time - g.lastStingT > 8) { g.audio.play('alertSting', null, 0.75); g.lastStingT = g.time; }
        note(Q, g, `perim-contact:${p.post.name}`);
      }
    } else {
      // fighting from the post; eight seconds cold (or the AI talked him down a state) and he squares back up to the door
      const cold = g.time - Math.max(gd.lastSeenT, gd.witness.heard.lastShotT) > REGROUP_SECS && !gd.sawPlayerThisFrame;
      if (cold || (gd.state !== 'alert')) { gd.state = 'search'; gd.awareness = HUNT_AWARENESS; gd.standoff = null; gd.searchPlan = null; toPost(g, p); if (p.arrivedAt >= 0 && flat(gd.char.pos, p.post.pos) < 1) gd.pinned = true; }
    }
  }
  if (P.state === 'called') {
    const allSet = P.men.length > 0 && P.men.every(p => p.gd.state === 'dead' || p.arrivedAt >= 0);
    if (allSet || g.time > P.etaAt + 10) {
      P.state = 'set'; P.setAt = g.time;
      const up = P.men.filter(p => p.gd.state !== 'dead' && p.arrivedAt >= 0);
      if (up.length) radio(g, up[0].gd, `perimeter set — eyes on ${up.map(p => p.post.name).join(' and ')}. lights are up outside; nobody walks out of here`);
      else control(g, 'perimeter is what it is — lamps up, no eyes outside. hold the exits from inside');
      note(Q, g, `perimeter-set:${up.length}`);
    }
  }
}
