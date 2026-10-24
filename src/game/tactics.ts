// Pursuit tactics (STATUS E12 (a) + (b), the maintainer's words: "they all just run straight at sam. instead they should coordinate flanking maneuvers" and
// "if they notice their buddies dead by a door, they shouldn't just blindly charge in past them!"). Three things, all for HUNTING men — a fix but no eyes on
// their man; the fight inside six metres, the standoff and the shot are untouched — all of them off with Game.tune.tactics (then not one call below does
// anything and guards.ts runs the chase it always ran: tools/qa tactics-identity holds that to the byte) and none of them under the tour (quietUtility):
//   (A) THE FLANKING APPROACH (planApproach). Two or more alert men of one side on one fix, all more than six metres off it and none with eyes on the man:
//       ROLES over the nav grid. The PRESSER has the shortest route: he goes up it at the jog and stops SHORT — kneeling at the last corner or jamb that still
//       covers him from the fix (the last blocked→open transition of his line along his path — the line of FIRE, losOpen: a pane is no opening, and along a
//       glazed wall that corner is the door's jamb) — until the flanker is set, anybody gets eyes on, or
//       tune.flankWait runs out; then 'go go go' and everybody pushes at the run. The FLANKER(s): A* again with the presser's corridor cells (one cell either
//       side too) and the whole quarter of the fix's disc on the presser's bearing made six times dearer, so the route comes into the fix's four-metre disc
//       from a bearing at least 90° round from the presser's — if such a route exists inside 2.2× the direct length; he radios 'moving round', jogs it, radios
//       'set' five metres short of HIS last corner and kneels there for the word. No such route (one door, one corridor): he is a SECOND presser, three
//       metres BEHIND the first up the same line, never abreast. Arriving with nothing there they drop into the search they always had (its spots split
//       between them by whoever is nearer, which two bearings make two halves of the room). Re-planned when the fix moves four metres, when a role-holder
//       drops out, and swapped when the presser is pinned by fire and the flanker is not.
//   (B) THE LONE MAN'S ANGLE. One alert man, nobody else of his side up, his fix on an ARMED intruder (a man of another side always is; Sam once he has fired
//       lately or been seen with a gun in his hand) more than five metres off: he does not run across open floor at a gun. He takes the nearest corner on his
//       way that has a LINE on the fix (hard by a wall, the fix in his line of fire — through a pane is not — never nearer than 5.5 m), calls it in over the net — which brings his side — and holds,
//       kneeling, up to tune.loneWait for a second man (the moment one is up, (A) deals the two of them roles); then he goes on alone at a WALK, pieing the
//       doorways as ever. Inside five metres he fights as he always did.
//   (C) THE KILL-ZONE DOORWAY (dangerDoors + doorGate). A doorway turns dangerous for a side for tune.doorDanger seconds when a man of that side goes down
//       within 2.2 m of it IN A COLLEAGUE'S SIGHT (combat.ts killGuard → tacticsManDown), when one of them finds a colleague's body within 2.2 m of it (the
//       body discovery → tacticsBodyFound), or when a round crosses its opening at a man of that side (the shot events' muzzle → impact segments, scanned in
//       tacticsTick). Then, for that side: every path plans round it if another way exists inside 2.5× the length (goTo → tacticsPenalty: its cells ×20 and
//       more); a man whose path still runs through it — or ends within two metres of it — does NOT walk in (followPath → doorGate): he stacks on the near jamb
//       out of the opening's line (the RoomClearPlan's stack marks when the level has a plan for that door from his side, else 0.9 m along the wall), radios it,
//       which fetches the nearest free colleague to stack behind him, waits up to tune.doorWait for that man, and the two take it as a drill: a stun charge in
//       first if either carries one (giveStuns — nobody on the night staff does; a response team might), else the lead slices the pie — side-steps across the
//       opening a couple of metres back in four steps, muzzle into the room, a quarter second a step — then both cross fast and split (the plan's entry legs,
//       else a stride and a half in and sixty degrees either way); alone after the wait, he slices and goes in at a run. Nobody kneels by a body in that
//       funnel meanwhile (bodyAftermath → bodyDutyBlocked drops the duty). A doorway banged AND entered is plain again at once; entered, soon; else it decays.
// Sites (the whole seam): game.ts update() → tacticsTick, its constructor → loadTactics; guards.ts: the alert branch's chase → tacticsAlert (else chaseFix, the
// old lines), followPath → doorGate, goTo → tacticsPenalty, the aim block → tacticsLook, the body discovery → tacticsBodyFound, bodyAftermath → bodyDutyBlocked;
// combat.ts killGuard → tacticsManDown. The radio lines go through Game.say like everybody's (so the debrief's chronicle has them). Everything readable from
// above is the point: the presser kneeling at his corner, the flanker jogging the long way round, the pair on the jamb slicing the opening before they cross.
import { SideMap, SideSet } from '../math/side';
import { Vec3, v3, clamp, wrapAngle, approachAngle, damp, DEG } from '../math/vec';
import type { Game, Guard } from './game';
import type { Door } from './doors';
import type { Item } from './throwables';
import type { Team } from './teams';
import { wallReactReplan } from './wallreact';
import type { RoomClearPlan } from '../scene/level';
import { goTo, followPath, pieDoorway, PIE_EYES_SECS, dropToSearch, resetChase, pointInView, bodyPos, doorCells, crossesDoor, frameOf, notGettingAnywhere, chaseFix } from './guards';
import { conditionPace } from './condition';
import { LANES, laneCovers, laneDoor, laneDrill } from './lanes';
import { isHostile, teamOfId, foeDown, spokenName, defenderWords } from './teams';
import { sideShotEnergy } from './glasspen';
import { detonateStun } from './combat';
import { placeName, isOffice, ownPlace } from './dialogue';
import { WORDS, wg } from './words';
import { doorSaidName, doorWrittenName, shorthandId } from './doornames';
import { doorWords } from './orders';
import { SUPPRESSION } from './suppression';
import { lookSince } from './pressure';
import { squadLookSince } from './enemysquads';
import { toolSpot, toolStep, latchFirst } from './handleside';
import { simRandom } from '../math/dice';   // the simulation's die (math/dice.ts): the Game's own when it has one, Math.random otherwise
import { railsDown } from './rails';   // (nobody is handed a colleague's man who is on his knee, spared)

// ---------------------------------------------------------------- knobs (Game.tune carries them; these are the shipped values and the per-machine copy)
type TacticsTune = { tactics: boolean; flankWait: number; loneWait: number; doorDanger: number; doorWait: number };
export const TACTICS_DEFAULTS = { flankWait: 6, loneWait: 8, doorDanger: 25, doorWait: 6 };
const LS_KEY = 'twopointsix.tactics';
const KEPT = ['flankWait', 'loneWait', 'doorDanger', 'doorWait'] as const;
/** read the kept knobs into `tune` (game.ts constructor, once): finite numbers in a sane range only; the on/off switch is not kept (an A/B seam boots ON) */
export function loadTactics(tune: TacticsTune) {
  try {
    const j = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null'); if (!j || typeof j !== 'object') return;
    for (const k of KEPT) { const v = (j as Record<string, unknown>)[k]; if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 600) tune[k] = v; }
  } catch { /* no storage (the harness, a locked-down page): the shipped values stand */ }
}
/** write them (the panel calls it on every change) */
export function saveTactics(tune: TacticsTune) {
  try { const out: Record<string, number> = {}; for (const k of KEPT) out[k] = tune[k]; localStorage.setItem(LS_KEY, JSON.stringify(out)); } catch { /* nothing to keep it in */ }
}
/** the four back to the shipped values, the stored copy dropped */
export function resetTactics(tune: TacticsTune) { Object.assign(tune, TACTICS_DEFAULTS); try { localStorage.removeItem(LS_KEY); } catch { /* none */ } }

// ---------------------------------------------------------------- constants
/** (A): men further than JOIN_M from the fix are dealt roles (nearer, the fight / chase as it was); a fix within SHARE_M of another man's is the same fix; the
 *  target's disc the bearings are measured on; the least angle round from the presser a flank must come in at; the longest a flank may be against the direct
 *  route; how dear the presser's corridor (and his quarter of the disc) is to the flanker's search; the corridor's dilation in cells; 'set' this far short of the
 *  flanker's corner; the second presser's station behind the first (stop inside, follow beyond + the hysteresis); a plan re-deals when the fix moves REPLAN_M */
const JOIN_M = 6, SHARE_M = 3, DISC_M = 4, FLANK_MIN_DEG = 90, FLANK_MAX_RATIO = 2.2, CORRIDOR_COST = 6, CORRIDOR_DILATE = 1, SECTOR_M = 5.5, SET_M = 5, BEHIND_M = 3, BEHIND_SLACK_M = 0.8, REPLAN_M = 4;
/** a plan older than this is dropped (its men chase as they always did); seconds a role-holder may make no headway on a leg before he is dropped from it; the
 *  least time between two re-deals of one plan; how near the fix counts as there */
const PLAN_CAP_SECS = 45, ROLE_STALL_SECS = 4, REPLAN_GAP_SECS = 1.0, ARRIVE_M = 1.3;
/** (B): inside FIGHT_M of the fix he fights as ever; his corner is never nearer the fix than HOLD_MIN_M; how far round the first sight-line point he looks for a
 *  wall to put his shoulder to; Sam counts as armed this long after a shot of his was heard / after being seen gun in hand */
const LONE_FIGHT_M = 5, LONE_HOLD_MIN_M = 5.5, LONE_COVER_R = 1.6, ARMED_SHOT_SECS = 60, ARMED_SEEN_SECS = 30;
/** (C): a body / a fall within DOOR_NEAR_M of a doorway's middle marks it; a round's far segment within ROUND_AT_M of a man is 'at' him; the gate picks a
 *  dangerous doorway up this far ahead along the path, or a goal this near it; the door cells' least multiplier (raised with the route's length so a way round
 *  inside 2.5× is always the cheaper); the stack spot along the wall from the jamb and off the wall; the slice line's stand-off (the largest that fits the
 *  floor), its steps and dwell; the entry legs; how long a gate may hold a man all told; the summoned man comes from within SUMMON_M */
const DOOR_NEAR_M = 2.2, ROUND_AT_M = 3, GATE_DETECT_M = 3.5, GATE_GOAL_M = 2.0, DOOR_COST_MIN = 20, STACK_ALONG_M = 0.9, STACK_OFF_M = 0.55, STACK_GAP_M = 0.85;
const SLICE_BACK = [2.5, 2.0, 1.6, 1.25], SLICE_STEPS = 4, SLICE_DWELL = 0.25, SLICE_PACE = 2.4, ENTRY_IN_M = 1.5, ENTRY_SPLIT_DEG = 60, ENTRY_LEG_M = 1.3, GATE_CAP_SECS = 22, SUMMON_M = 25;
/** the stun charge: lands this far inside along the doorway's normal, goes off this long after first contact (or AIR cap after leaving the hand), the men go BEAT after the bang */
const TOSS_IN_M = 2.5, TOSS_FUSE = 0.6, TOSS_AIR_CAP = 2.2, GO_AFTER_BANG = 0.35;

// ---------------------------------------------------------------- records
export type RoleKind = 'presser' | 'flanker' | 'second';
export interface Role {
  kind: RoleKind; plan: Plan;
  /** presser: the corner he stops short at; flanker: his last corner (where he is 'set'); second: unused (his station is off the presser) */
  holdAt: Vec3 | null;
  /** the route dealt him (for the panel / the probes; his feet re-plan it live through goTo with the same costs) and its numbers */
  route: Vec3[]; len: number; bearing: number;
  /** the cells his live A* pays six-fold for (flanker: the presser's corridor + the presser's quarter of the disc); null = plain */
  avoid: Set<number> | null;
  set: boolean; holding: boolean; holdT: number; arrived: boolean; saidMoving: boolean; saidSet: boolean; t0: number;
  /** flanker: metres of ground covered lately (a decaying sum) and where he stood last frame — a flank still being run is waited for */
  ground?: number; lastPos?: Vec3;
}
export interface Plan {
  id: number; team: Team; target: Vec3; t0: number; replannedAt: number; replans: number;
  members: Guard[]; roles: Map<Guard, Role>;
  phase: 'approach' | 'push' | 'done'; goT: number; why: string;
  presserBearing: number; presserLen: number; corridor: Set<number>;
  firstArriveT: number; lastRadioT: number; contact: boolean;
}
export interface Lone { fix: Vec3; holdAt: Vec3 | null; los: boolean; t0: number; holdT: number; called: boolean; released: boolean; releasedWhy: string; }
export type DangerWhy = 'drop' | 'body' | 'rounds' | 'press';
export interface DangerRec { door: Door; team: Team; until: number; t0: number; why: DangerWhy; victim: string | null; banged: boolean; entered: boolean; called: boolean; summoned: Guard | null; }
type GatePhase = 'stack' | 'open' | 'wait' | 'stacked' | 'toss' | 'bang' | 'slice' | 'cross' | 'done';
export interface Gate {
  door: Door; rec: DangerRec; phase: GatePhase; t: number; t0: number;
  side: 1 | -1;              // the face he takes it from (+1 = the +n side of the closed frame line, crossesDoor's convention)
  nearA: number;             // the jamb on his side of the opening along the frame (0 = hinge, W = latch): he stacks past it, the slice starts from it
  spot: Vec3; face: number; role: 'lead' | 'second'; lead: Guard | null;
  slicePts: Vec3[]; sliceLook: Vec3[]; sliceI: number; sliceT: number;
  legs: Vec3[]; legI: number; crossAt: number;
  look: Vec3 | null; crouch: number;
  path: Vec3[] | null; pathI: number; pathFor: Vec3 | null; stallRef: Vec3 | null; stallT: number;
  can: Item | null; tossT: number; landT: number; bangT: number;
  goalNear: boolean; opened: boolean; crossed: boolean;
  hs?: { pos: Vec3; yaw: number } | null;   // (handleside.ts) the place at the handle the lead steps to before he works a shut leaf — null once dealt with
  /** what the wait resolved to (the charge if anybody stacked has one, else the slice) and who throws it */
  action: 'toss' | 'slice'; thrower: Guard | null;
}
interface TState {
  plans: Plan[]; roles: Map<Guard, Role>; lone: Map<Guard, Lone>;
  danger: DangerRec[]; gates: Map<Guard, Gate>; cleared: Map<Guard, Map<Door, number>>;
  seenEv: WeakSet<object>; planSerial: number; lastLoneCallT: number;
  /** game time of the last deal that came to nothing (fewer than two men with a route): no re-try inside a second, or two men on an unreachable fix would run A* every frame */
  dealFailT: number;
}
const states = new SideMap<Game, TState>('tactics.states');
function S(g: Game): TState {
  let s = states.get(g);
  if (!s) { s = { plans: [], roles: new Map(), lone: new Map(), danger: [], gates: new Map(), cleared: new Map(), seenEv: new SideSet(), planSerial: 0, lastLoneCallT: -100, dealFailT: -100 }; states.set(g, s); }
  return s;
}
/** stun charges on a man (nobody on the night staff carries one; a response team, or a probe, hands them out) */
const kit = new SideMap<Guard, { stuns: number }>('tactics.kit');
export function giveStuns(gd: Guard, n: number) { kit.set(gd, { stuns: Math.max(0, n) }); }
export function stunsOf(gd: Guard): number { return kit.get(gd)?.stuns ?? 0; }

/** QA hook: set `log` and every plan dealt / re-dealt / ended, every lone hold, every doorway marked and every gate phase says so */
export const TACTICS_DEBUG: { log: ((s: string) => void) | null } = { log: null };
/** counters for the soak's smell line (across games in one process: a run's share is the difference) */
export const TACTICS_STATS = { plans: 0, replans: 0, flankers: 0, seconds: 0, swaps: 0, goes: 0, goTimeouts: 0, arrivals: 0, loneHolds: 0, loneCalls: 0, loneReleases: 0, dangers: 0, gates: 0, summons: 0, bangs: 0, slices: 0, entries: 0, loneEntries: 0, reroutes: 0 };

/** Is any of it live: the switch on, not the tour, the AI on. */
export function tacticsOn(g: Game): boolean { return !!g.tune.tactics && !g.quietUtility && g.aiEnabled; }
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const bearingOf = (p: Vec3, C: Vec3) => Math.atan2(p[0] - C[0], p[2] - C[2]);
const degApart = (a: number, b: number) => Math.abs(wrapAngle(a - b)) / DEG;
/** a free man the tactics may move: alive, in the list, not held / choreographed / on his marks / pinned, not in the standoff */
function freeMan(g: Game, gd: Guard): boolean { return gd.state !== 'dead' && g.guards.includes(gd) && !gd.held && !gd.script && !gd.hold && !gd.pinned && !gd.standoff; }
/** eyes on his man lately (the licence to shoot's half second, doubled): he is fighting or chasing by sight, not working a fix */
const inContact = (g: Game, gd: Guard) => g.time - gd.lastSeenT < PIE_EYES_SECS;
/** pinned by fire or flinching under it (suppression.ts): a presser in that state hands the press to a steadier flanker */
const suppressed = (gd: Guard) => gd.sup.latched || gd.sup.downT > 0 || gd.sup.v >= SUPPRESSION.flinch;

// ---------------------------------------------------------------- geometry over paths and the grid
function pathLen(from: Vec3, path: Vec3[]): number { let L = 0, q = from; for (const w of path) { L += flat(q, w); q = w; } return L; }
/** points every `step` metres along from → path (the start and the very end included) */
function samplePath(from: Vec3, path: Vec3[], step = 0.3): Vec3[] {
  const out: Vec3[] = [[from[0], 0, from[2]]]; let carry = 0; let a: Vec3 = from;
  for (const b of path) {
    const L = flat(a, b); if (L < 1e-6) { a = b; continue; }
    let d = step - carry;
    while (d <= L) { out.push([a[0] + (b[0] - a[0]) * d / L, 0, a[2] + (b[2] - a[2]) * d / L]); d += step; }
    carry = L - (d - step); a = b;
  }
  const last = path.length ? path[path.length - 1] : from; if (flat(out[out.length - 1], last) > 1e-3) out.push([last[0], 0, last[2]]);
  return out;
}
/** the nav cells a route runs through, widened `dilate` cells all round (the presser's corridor) */
function cellsOfPath(g: Game, from: Vec3, path: Vec3[], dilate: number): Set<number> {
  const nav = g.col.nav, cs = nav.cell; const out = new Set<number>();
  for (const p of samplePath(from, path, cs * 0.45)) {
    const cx = Math.floor(p[0] / cs), cz = Math.floor(p[2] / cs);
    for (let dz = -dilate; dz <= dilate; dz++) for (let dx = -dilate; dx <= dilate; dx++) { const x = cx + dx, z = cz + dz; if (x >= 0 && z >= 0 && x < nav.W && z < nav.H) out.add(nav.idx(x, z)); }
  }
  return out;
}
/** the free cells within `R` of C whose bearing about C lies inside `halfDeg` of `bearing`: the presser's quarter of the disc, dear to the flanker */
function sectorCells(g: Game, C: Vec3, bearing: number, R: number, halfDeg: number): Set<number> {
  const nav = g.col.nav, cs = nav.cell; const out = new Set<number>();
  const x0 = Math.max(0, Math.floor((C[0] - R) / cs)), x1 = Math.min(nav.W - 1, Math.floor((C[0] + R) / cs)), z0 = Math.max(0, Math.floor((C[2] - R) / cs)), z1 = Math.min(nav.H - 1, Math.floor((C[2] + R) / cs));
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const p: Vec3 = [(x + 0.5) * cs, 0, (z + 0.5) * cs]; const d = flat(p, C);
    if (d > R || d < 0.75 || nav.blocked[nav.idx(x, z)]) continue;
    if (degApart(bearingOf(p, C), bearing) < halfDeg) out.add(nav.idx(x, z));
  }
  return out;
}
/** the bearing about T at which a walk from → path last comes INTO T's R-disc (his own bearing if he already stands inside it) */
function entryBearing(T: Vec3, from: Vec3, path: Vec3[], R: number): number {
  if (flat(from, T) <= R) return bearingOf(from, T);
  const s = samplePath(from, path, 0.25); let b = bearingOf(s[s.length - 1], T);
  for (let i = 0; i + 1 < s.length; i++) if (flat(s[i], T) > R && flat(s[i + 1], T) <= R) b = bearingOf(s[i], T);
  return b;
}
/** The line a station is judged by, from a man stood at p to the fix area at T, chest to chest height: the line of FIRE (col.shotBlocked — statics, leaves, and
 *  a glass pane, which a round stops in) — the same question the fight asks before a round (guards.ts clearShot). Not the line of sight: eyes pass the conference
 *  glazing, so by sight a man 'has' a fix inside that room from anywhere on the corridor and would take his corner, or hold his angle, on the wrong side of a
 *  pane he can neither fire through nor be fired at through — cover it is (both ways), a position on the fix it is not. Behind brick the two are one line. */
function losOpen(g: Game, p: Vec3, T: Vec3, team: Team): boolean { return !g.col.shotBlocked([p[0], 1.15, p[2]], [T[0], 1.0, T[2]], 0.02, sideShotEnergy(g, team)); }   // (glasspen.ts: a side told not to shoot through glass takes no corner behind a pane)
/** The last point along from → path that is still COVERED from T before the line opens for good on the way in (the last blocked → open transition), at least
 *  `minFromT` off T; null when the whole way is open (or never opens). Where a presser stops short; where a flanker is 'set'. (Along a glazed wall the line
 *  stays shut the length of the glass and opens at the door: the jamb is the corner, not a mullion half way along the panes.) */
function lastCoverPoint(g: Game, from: Vec3, path: Vec3[], T: Vec3, minFromT: number, team: Team): Vec3 | null {
  const s = samplePath(from, path, 0.3); const los = s.map(p => losOpen(g, p, T, team));
  for (let i = s.length - 2; i >= 0; i--) if (!los[i] && los[i + 1] && flat(s[i], T) >= minFromT) return s[Math.max(0, i - 1)];   // (a foot further back than the very edge: his shoulder, not his nose, at the corner)
  return null;
}
/** the point along from → path where `rem` metres of it remain (the path's end if it is shorter) */
function pointShortOfEnd(from: Vec3, path: Vec3[], rem: number): Vec3 {
  const s = samplePath(from, path, 0.25); const total = pathLen(from, path); const want = Math.max(0, total - rem);
  let acc = 0; for (let i = 1; i < s.length; i++) { acc += flat(s[i - 1], s[i]); if (acc >= want) return s[i]; }
  return s[s.length - 1];
}
/** blocked neighbours of the cell under p (walls about it: two or more = a corner or a wall to put a shoulder to) */
function wallsAbout(g: Game, p: Vec3): number {
  const nav = g.col.nav, cs = nav.cell; const cx = Math.floor(p[0] / cs), cz = Math.floor(p[2] / cs); let n = 0;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dz) continue; const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= nav.W || z >= nav.H || nav.blocked[nav.idx(x, z)]) n++; }
  return n;
}
/** the doorway whose middle lies within `r` of p (nearest such), or null */
export function doorNear(g: Game, p: Vec3, r = DOOR_NEAR_M): Door | null {
  let best: Door | null = null, bd = r;
  for (const d of g.doors.list) { const dd = flat(d.frameCentre, p); if (dd < bd) { bd = dd; best = d; } }
  return best;
}
/** 'storage' → 'storage', 'breakroom_w' → 'break room west', 'server_manager' → 'server–manager', 'fire_exit' → 'fire exit' — what a man calls a door on the net */
export function doorLabel(d: Door): string {
  const n = d.def.name; const dir: Record<string, string> = { n: 'north', s: 'south', e: 'east', w: 'west', ext: 'outside' };
  const parts = n.split('_'); const last = parts[parts.length - 1];
  const base = (parts.length > 1 && dir[last] ? parts.slice(0, -1) : parts).join(' ').replace('breakroom', 'break room');
  return parts.length > 1 && dir[last] ? `${base} ${dir[last]}` : base;
}

// ================================================================ (C) dangerous doorways: the records
/** every live record (until > now), optionally for one side */
export function dangerDoors(g: Game, team?: Team): DangerRec[] { const now = g.time; return S(g).danger.filter(r => r.until > now && (!team || r.team === team)); }
/** the live record for this (door, side), or null */
export function dangerAt(g: Game, d: Door, team: Team): DangerRec | null { return S(g).danger.find(r => r.door === d && r.team === team && r.until > g.time) ?? null; }
/** Mark (or re-arm) a doorway dangerous for `team` for tune.doorDanger seconds. */
export function markDanger(g: Game, d: Door, team: Team, why: DangerWhy, victim: string | null = null): DangerRec {
  const st = S(g); let r = st.danger.find(x => x.door === d && x.team === team);
  const until = g.time + Math.max(1, g.tune.doorDanger);
  if (r) { if (r.until <= g.time) { r.t0 = g.time; r.banged = false; r.entered = false; r.called = false; r.summoned = null; TACTICS_STATS.dangers++; } r.until = Math.max(r.until, until); r.why = why; if (victim) r.victim = victim; }
  else { r = { door: d, team, until, t0: g.time, why, victim, banged: false, entered: false, called: false, summoned: null }; st.danger.push(r); TACTICS_STATS.dangers++; }
  TACTICS_DEBUG.log?.(`${g.time.toFixed(2)}s DANGER ${d.def.name} for ${team}: ${why}${victim ? ' (' + victim + ')' : ''} until ${r.until.toFixed(1)}`);
  return r;
}
// ---------------------------------------------------------------- checkpoints (game/savestate.ts): the kill-zone doorways and the doorways men have taken as a drill; the plans, roles,
// lone holds and gates are transient hunt state the tick re-deals inside a frame from the men's own (restored) alert states and fixes
export interface TacticsSnap { danger: { door: number; team: Team; until: number; t0: number; why: DangerWhy; victim: string | null; banged: boolean; entered: boolean; called: boolean }[]; cleared: [number, number, number][]; lastLoneCallT: number; dealFailT: number; }
export function tacticsSnapshot(g: Game): TacticsSnap {
  const st = states.get(g); if (!st) return { danger: [], cleared: [], lastLoneCallT: -100, dealFailT: -100 };
  const di = (d: Door) => g.doors.list.indexOf(d);
  const cleared: [number, number, number][] = [];
  for (const [gd, m] of st.cleared) { const i = g.guards.indexOf(gd); if (i < 0) continue; for (const [d, until] of m) if (until > g.time && di(d) >= 0) cleared.push([i, di(d), until]); }
  return { danger: st.danger.filter(r => r.until > g.time && di(r.door) >= 0).map(r => ({ door: di(r.door), team: r.team, until: r.until, t0: r.t0, why: r.why, victim: r.victim, banged: r.banged, entered: r.entered, called: r.called })), cleared, lastLoneCallT: st.lastLoneCallT, dealFailT: st.dealFailT };
}
/** Game.resetGuards (a restart, the tour's hand-over, a checkpoint's clean slate): everything this Game's tactics held goes with the men it referred to — the
 *  plans, roles, lone holds and gates keyed by Guard objects that no longer stand on the floor, AND the kill-zone doorways (a doorway dangerous to the last
 *  encounter's shift priced the fresh shift's routes round the building for two minutes — review G3.3). The next S(g) builds it afresh. */
export function tacticsReset(g: Game) { states.delete(g); }
/** …into a state built afresh (whatever this Game's tactics held goes: the men it referred to are gone) */
export function tacticsRestore(g: Game, s: TacticsSnap | null | undefined) {
  states.delete(g); if (!s) return;
  const st = S(g);
  st.lastLoneCallT = Number.isFinite(s.lastLoneCallT) ? s.lastLoneCallT : -100; st.dealFailT = Number.isFinite(s.dealFailT) ? s.dealFailT : -100;
  for (const r of s.danger ?? []) { const d = g.doors.list[r.door]; if (!d || !(r.until > g.time)) continue; st.danger.push({ door: d, team: r.team, until: r.until, t0: r.t0, why: r.why, victim: r.victim ?? null, banged: !!r.banged, entered: !!r.entered, called: !!r.called, summoned: null }); }
  for (const [gi, dI, until] of s.cleared ?? []) { const gd = g.guards[gi], d = g.doors.list[dI]; if (gd && d && until > g.time) setCleared(g, gd, d, until); }
}
/** has this man taken this doorway as a drill already inside its current danger (he walks it freely from then on) */
function clearedFor(g: Game, gd: Guard, d: Door): boolean { const t = S(g).cleared.get(gd)?.get(d); return t !== undefined && t > g.time; }
/** QA / panel: has this man already taken this doorway as a drill inside its current danger (the soak's walk-in smell lets him through) */
export function tacticsCleared(g: Game, gd: Guard, d: Door): boolean { return !!states.get(g) && clearedFor(g, gd, d); }
function setCleared(g: Game, gd: Guard, d: Door, until: number) { const st = S(g); let m = st.cleared.get(gd); if (!m) { m = new Map(); st.cleared.set(gd, m); } m.set(d, until); }

/** combat.ts killGuard, the frame a man goes down (his state already 'dead'): within DOOR_NEAR_M of a doorway AND in the open view of a living man of his own
 *  side → that doorway is a kill zone for them ('drop'). Nobody saw it: nothing yet — whoever finds him there will mark it (tacticsBodyFound). */
export function tacticsManDown(g: Game, victim: Guard) {
  if (!tacticsOn(g)) return;
  const d = doorNear(g, victim.char.pos); if (!d) return;
  const at = victim.char.bones.chest ?? v3.add(victim.char.pos, [0, 1.1, 0]);
  const seen = g.guards.some(o => o !== victim && o.state !== 'dead' && o.team === victim.team && !o.held && g.time >= o.dazzledUntil && pointInView(g, o, at, 16, 60));
  if (seen) markDanger(g, d, victim.team, 'drop', victim.callsign);
}
/** guards.ts, the body discovery (each body called in there): lying within DOOR_NEAR_M of a doorway → a kill zone for the finder's side ('body'). */
export function tacticsBodyFound(g: Game, finder: Guard, body: Guard) {
  if (!tacticsOn(g)) return;
  const d = doorNear(g, bodyPos(body)); if (d) markDanger(g, d, finder.team, 'body', body.callsign);
}
/** guards.ts bodyAftermath: is this body lying in a doorway dangerous to the man's side right now — then nobody walks up to kneel by it (the duty is dropped;
 *  he still comes, and the gate takes him at the jamb). */
export function bodyDutyBlocked(g: Game, gd: Guard, body: Guard): boolean {
  if (!tacticsOn(g)) return false;
  const d = doorNear(g, bodyPos(body)); return !!d && !!dangerAt(g, d, gd.team);
}
/** tacticsTick's share: rounds through doorways. Every shot event not yet looked at whose muzzle → impact segment crosses a doorway's opening: the part of it
 *  beyond the frame passing within ROUND_AT_M of a living man (or one it has just dropped) of a side the shooter is hostile to → dangerous for that side ('rounds'). */
function scanRounds(g: Game) {
  const st = S(g);
  for (const e of g.events) {
    if ((e.kind !== 'shot' && e.kind !== 'guardShot') || !e.from || !e.to || st.seenEv.has(e)) continue;
    st.seenEv.add(e);
    const shooter: Team = e.kind === 'shot' ? 'player' : teamOfId(g, e.who ?? -1);
    for (const d of g.doors.list) {
      const X = crossesDoor(e.from, e.to, d); if (!X) continue;
      for (const o of g.guards) {
        if (!isHostile(shooter, o.team) || o.held) continue;
        if (o.state === 'dead' && !(o.diedAt >= e.time - 1e-6)) continue;   // (a man this very round dropped counts; an old body does not)
        if (distToSegment(o.char.pos, X.at, e.to) <= ROUND_AT_M) markDanger(g, d, o.team, 'rounds', null);
      }
    }
  }
}
function distToSegment(p: Vec3, a: Vec3, b: Vec3): number {
  const dx = b[0] - a[0], dz = b[2] - a[2]; const L2 = dx * dx + dz * dz;
  const t = L2 > 1e-6 ? clamp(((p[0] - a[0]) * dx + (p[2] - a[2]) * dz) / L2, 0, 1) : 0;
  return Math.hypot(a[0] + dx * t - p[0], a[2] + dz * t - p[2]);
}

// ---------------------------------------------------------------- goTo's cost function
/** guards.ts goTo: the per-cell multiplier this man's plan pays from here to `goal`, or undefined = plain A* (always, with the tactics off; and for a corpse, a
 *  choreographed man, or a man with neither a dangerous doorway on his side nor a flank to keep to). Dangerous doorways he has not yet taken as a drill cost
 *  max(DOOR_COST_MIN, 1 + 1.5·L) per cell, L his plain route's length — so any other way in shorter than 2.5× is the cheaper and a longer one is not (he goes to
 *  the door and the gate takes him); a flanker's avoid-set costs CORRIDOR_COST. */
export function tacticsPenalty(g: Game, gd: Guard, goal: Vec3): ((ix: number, iz: number) => number) | undefined {
  if (!tacticsOn(g) || gd.script || gd.state === 'dead') return undefined;
  const st = S(g); const role = st.roles.get(gd); const avoid = role?.avoid ?? null;
  const recs = dangerDoors(g, gd.team).filter(r => !clearedFor(g, gd, r.door) && st.gates.get(gd)?.door !== r.door);   // (the doorway he is stacked on right now is his to take: its cells cost him nothing, or his own entry legs would route round the building)
  if (!avoid && !recs.length) return undefined;
  const nav = g.col.nav, W = nav.W;
  let doorIdx: Set<number> | null = null, doorMult = DOOR_COST_MIN;
  if (recs.length) {
    doorIdx = new Set(); const DC = doorCells(g);
    for (const [i, d] of DC) if (recs.some(r => r.door === d)) doorIdx.add(i);
    const plain = nav.findPath(gd.char.pos, goal); const L = plain ? pathLen(gd.char.pos, plain) : 10;
    doorMult = Math.max(DOOR_COST_MIN, 1 + 1.5 * L);
  }
  return (ix, iz) => { const i = iz * W + ix; let m = 1; if (doorIdx && doorIdx.has(i)) m = doorMult; if (avoid && avoid.has(i)) m = Math.max(m, CORRIDOR_COST); return m; };
}

// ================================================================ (A) the flanking approach: the role planner
/** the roster's role of a man, if any (his plan's), for the panel / soak / probes: 'presser' | 'flanker' | 'second' | 'lone' | 'door:lead' | 'door:second' | null */
export function tacticsRoleOf(g: Game, gd: Guard): string | null {
  const st = states.get(g); if (!st) return null;
  const r = st.roles.get(gd); if (r) return r.kind;
  const G = st.gates.get(gd); if (G) return `door:${G.role}`;
  const L = st.lone.get(gd); if (L && !L.released) return 'lone';
  return null;
}
export function roleRecord(g: Game, gd: Guard): Role | null { return states.get(g)?.roles.get(gd) ?? null; }
export function loneRecord(g: Game, gd: Guard): Lone | null { return states.get(g)?.lone.get(gd) ?? null; }
export function gateRecord(g: Game, gd: Guard): Gate | null { return states.get(g)?.gates.get(gd) ?? null; }
export function plansOf(g: Game): Plan[] { return states.get(g)?.plans ?? []; }

/** Deal roles to `men` (two or more free alert men of one side) over the nav grid toward `target` — see the block comment (A). Registers the plan and its roles
 *  (replacing any these men held) and returns it; null if fewer than two of them have any route at all. `why` names what dealt it (formed / the fix moved /
 *  a man dropped out / the presser pinned) for the log; `prefer` (a swap): this man presses if he has a route. */
/** THE FLANKER'S CALL. 'coming at him / them' says there is somebody to come at. A plan whose every man is out on a LOOK — a pair sent to where the team
 *  was last put after `sweepSecs` of nothing (pressure.ts PRESSURE.sweep, enemysquads.ts drillLook) — with no eye of their side on the team since that look
 *  was called has nobody: he says where he comes in from and no more. Words only (the dialogue pass: `WORDS.on` off = the line as it was); no rule reads it. */
function flankCall(g: Game, plan: Plan, m: Guard, place: string): string {
  const who = defenderWords(m) ? 'them' : 'him';
  if (!WORDS.on) return `moving round — coming at ${who} from ${place}`;
  let since = Infinity;
  for (const o of plan.members) { const t = lookSince(g, o) ?? squadLookSince(g, o); if (t === null) return `${wg('going around', 'moving round')} — coming at ${who} from ${place}`; since = Math.min(since, t); }
  const seen = g.guards.some(o => o.team === plan.team && o.lastSeenT > since);
  return seen ? `${wg('going around', 'moving round')} — coming at ${who} from ${place}` : `${wg('going around', 'moving round')} — coming in from ${place}`;
}
export function planApproach(g: Game, men: Guard[], target: Vec3, why = 'formed', prefer: Guard | null = null): Plan | null {
  const st = S(g); const nav = g.col.nav; const team = men[0].team;
  const T: Vec3 = [target[0], 0, target[2]];
  // any old plan these men were in goes (its other members are re-dealt below if they are in `men`, else fall back to the chase)
  for (const m of men) { const old = st.roles.get(m)?.plan; if (old && old.phase !== 'done') endPlan(g, old, `re-dealt (${why})`, false); }
  // (asked twice for every man who is not the presser — his direct route, then the base of his flank's price — and the answer is the same both times: nothing it
  // reads moves inside this deal, and with a dangerous doorway on his side it costs a whole path search. Made once a man; the roster's own delete / set kept as it was.)
  const pens = new Map<Guard, ReturnType<typeof tacticsPenalty>>();
  const dangerOnly = (m: Guard) => { const r = st.roles.get(m); st.roles.delete(m); let p = pens.get(m); if (!pens.has(m)) { p = tacticsPenalty(g, m, T); pens.set(m, p); } if (r) st.roles.set(m, r); return p; };   // (his side's dangerous doorways priced in, no avoid-set: the direct route)
  const routes = men.map(m => { const path = nav.findPath(m.char.pos, T, 6000, dangerOnly(m)); return { gd: m, path, len: path ? pathLen(m.char.pos, path) : Infinity }; }).filter(r => r.path && Number.isFinite(r.len));
  if (routes.length < 2) { st.dealFailT = g.time; TACTICS_DEBUG.log?.(`${g.time.toFixed(2)}s PLAN not dealt (${why}): ${routes.length} of ${men.length} men have a route to (${T[0].toFixed(1)}, ${T[2].toFixed(1)})`); return null; }
  routes.sort((a, b) => a.len - b.len);
  if (prefer) { const i = routes.findIndex(r => r.gd === prefer); if (i > 0) routes.unshift(...routes.splice(i, 1)); }
  const P0 = routes[0];
  const corridor = cellsOfPath(g, P0.gd.char.pos, P0.path!, CORRIDOR_DILATE);
  const pBear = entryBearing(T, P0.gd.char.pos, P0.path!, DISC_M);
  const sector = sectorCells(g, T, pBear, SECTOR_M, FLANK_MIN_DEG);
  const avoid = new Set<number>(corridor); for (const c of sector) avoid.add(c);
  const plan: Plan = { id: ++st.planSerial, team, target: T, t0: g.time, replannedAt: g.time, replans: 0, members: routes.map(r => r.gd), roles: new Map(), phase: 'approach', goT: -1, why, presserBearing: pBear, presserLen: P0.len, corridor, firstArriveT: -1, lastRadioT: -100, contact: false };
  const mk = (kind: RoleKind, holdAt: Vec3 | null, route: Vec3[], len: number, bearing: number, av: Set<number> | null): Role => ({ kind, plan, holdAt, route, len, bearing, avoid: av, set: false, holding: false, holdT: 0, arrived: false, saidMoving: false, saidSet: false, t0: g.time });
  // the presser: up the short route to the last corner that still hides him (else the disc's edge)
  const pHold = lastCoverPoint(g, P0.gd.char.pos, P0.path!, T, 1.0, P0.gd.team) ?? pointShortOfEnd(P0.gd.char.pos, P0.path!, DISC_M);
  plan.roles.set(P0.gd, mk('presser', pHold, P0.path!, P0.len, pBear, null));
  // the others: a flank if the dear-corridor search finds a way in from the other side inside the ratio, else a second presser
  const W = nav.W;
  const penF = (m: Guard) => { const base = dangerOnly(m); return (ix: number, iz: number) => Math.max(base ? base(ix, iz) : 1, avoid.has(iz * W + ix) ? CORRIDOR_COST : 1); };
  for (const r of routes.slice(1)) {
    const fp = nav.findPath(r.gd.char.pos, T, 6000, penF(r.gd));
    const flen = fp ? pathLen(r.gd.char.pos, fp) : Infinity; const fBear = fp ? entryBearing(T, r.gd.char.pos, fp, DISC_M) : pBear;
    const apart = degApart(fBear, pBear);
    if (fp && flen <= FLANK_MAX_RATIO * Math.max(P0.len, r.len) && apart >= FLANK_MIN_DEG - 0.5) {
      const setAt = lastCoverPoint(g, r.gd.char.pos, fp, T, 1.0, r.gd.team) ?? pointShortOfEnd(r.gd.char.pos, fp, DISC_M + 0.5);
      plan.roles.set(r.gd, mk('flanker', setAt, fp, flen, fBear, avoid)); TACTICS_STATS.flankers++;
      TACTICS_DEBUG.log?.(`  ${r.gd.callsign}: FLANKER — ${flen.toFixed(1)} m (direct ${r.len.toFixed(1)}, presser ${P0.len.toFixed(1)}), comes in at ${Math.round(fBear / DEG)}° = ${Math.round(apart)}° round from the presser, set at (${setAt[0].toFixed(1)}, ${setAt[2].toFixed(1)})`);
    } else {
      plan.roles.set(r.gd, mk('second', null, r.path!, r.len, pBear, null)); TACTICS_STATS.seconds++;
      TACTICS_DEBUG.log?.(`  ${r.gd.callsign}: SECOND presser — ${fp ? `the dear route ${flen.toFixed(1)} m vs ${(FLANK_MAX_RATIO * Math.max(P0.len, r.len)).toFixed(1)} allowed, ${Math.round(apart)}° round (want ≥ ${FLANK_MIN_DEG})` : 'no other route at all'}`);
    }
  }
  for (const [m, role] of plan.roles) { st.roles.set(m, role); st.lone.delete(m); m.path = []; m.pathGoal = null; m.stallRef = null; }   // (a fresh leg for everybody: goTo plans it with the new costs)
  st.plans.push(plan); TACTICS_STATS.plans++; if (why !== 'formed') TACTICS_STATS.replans++;
  TACTICS_DEBUG.log?.(`${g.time.toFixed(2)}s PLAN #${plan.id} (${why}) on (${T[0].toFixed(1)}, ${T[2].toFixed(1)}): presser ${P0.gd.callsign} ${P0.len.toFixed(1)} m in at ${Math.round(pBear / DEG)}°, holds at (${pHold[0].toFixed(1)}, ${pHold[2].toFixed(1)}); ` + [...plan.roles].filter(([, r]) => r.kind !== 'presser').map(([m, r]) => `${m.callsign} ${r.kind}`).join(', '));
  // the flanker says so (radio: the debrief hears it); a re-deal only if the roles are news
  for (const [m, role] of plan.roles) if (role.kind === 'flanker' && !role.saidMoving) { role.saidMoving = true; g.say(m, flankCall(g, plan, m, placeName(g.level, role.holdAt ?? T)), true); plan.lastRadioT = g.time; }
  return plan;
}
/** Dissolve a plan: its roles come off the roster (the men chase / search as they always did from where they stand, chase clocks fresh). */
function endPlan(g: Game, plan: Plan, why: string, resetMen = true) {
  const st = S(g); if (plan.phase === 'done') return;
  plan.phase = 'done';
  for (const [m, r] of plan.roles) { if (st.roles.get(m) === r) { st.roles.delete(m); if (resetMen && m.state !== 'dead') { m.path = []; m.pathGoal = null; m.stallRef = null; resetChase(m); } } }
  st.plans = st.plans.filter(p => p !== plan);
  TACTICS_DEBUG.log?.(`${g.time.toFixed(2)}s PLAN #${plan.id} ends: ${why}`);
}
/** a member still fit to hold a role: free, alert, a fix, his man not down */
function fitForRole(g: Game, m: Guard): boolean { return freeMan(g, m) && m.state === 'alert' && !!m.lastKnown && !foeDown(g, m) && !(g.time < m.dazzledUntil); }
/** Once a frame: keep every plan honest (drop unfit men, re-deal on a moved fix / a lost presser / a pinned presser, time it out) and deal new ones. */
function tickPlans(g: Game) {
  const st = S(g); const now = g.time;
  for (const plan of [...st.plans]) {
    // members no longer fit come off (a dead man, one grabbed, one who dropped to search on his own, one dazzled)
    for (const m of [...plan.members]) if (!fitForRole(g, m) || st.roles.get(m)?.plan !== plan) { plan.members = plan.members.filter(x => x !== m); if (st.roles.get(m)?.plan === plan) st.roles.delete(m); plan.roles.delete(m); }
    const live = plan.members;
    if (now - plan.t0 > PLAN_CAP_SECS) { endPlan(g, plan, 'out of time'); continue; }
    if (live.length < 2 && plan.phase === 'approach') { endPlan(g, plan, live.length ? `${live[0].callsign} is on his own now` : 'nobody left'); continue; }
    if (!live.length) { endPlan(g, plan, 'nobody left'); continue; }
    plan.contact = live.some(m => inContact(g, m));
    // the freshest fix among them has moved: everybody's fix becomes it (they are on the net) and the roles are dealt again from where they stand
    let fresh: Guard = live[0]; for (const m of live) if (m.fixT > fresh.fixT) fresh = m;
    const fix = fresh.lastKnown!;
    if (flat(fix, plan.target) > REPLAN_M && now - plan.replannedAt > REPLAN_GAP_SECS) {
      for (const m of live) if (m !== fresh) { m.lastKnown = v3.copy(fix); }
      if (now - plan.lastRadioT > 4) { g.say(fresh, `${defenderWords(fresh) ? "they've" : "he's"} moved — ${placeName(g.level, fix)}`, true); plan.lastRadioT = now; }
      const far = live.filter(m => flat(m.char.pos, fix) > JOIN_M && !inContact(g, m));
      endPlan(g, plan, 'the fix moved');
      if (far.length >= 2) planApproach(g, far, fix, 'the fix moved');
      continue;
    }
    if (plan.phase !== 'approach') continue;
    if (now - plan.replannedAt > REPLAN_GAP_SECS && wallReactReplan(g, plan.team, plan.replannedAt, live)) { const rest = live.filter(m => !inContact(g, m)); endPlan(g, plan, 'a wall opened'); if (rest.length >= 2) planApproach(g, rest, fix, 'a wall opened'); continue; }   // wallreact.ts: one of them has learned of a hole a man fits through since the roles were dealt — the routes are dealt again over the floor as it now is (false on its first line with nothing broken)
    const presser = live.find(m => plan.roles.get(m)?.kind === 'presser') ?? null;
    if (!presser) { const rest = live.filter(m => !inContact(g, m)); endPlan(g, plan, 'the presser dropped out'); if (rest.length >= 2) planApproach(g, rest, fix, 'the presser dropped out'); continue; }
    // the presser pinned by fire, a flanker steadier: the flanker presses from where he is, the pinned man falls in behind when he can
    if (suppressed(presser) && now - plan.replannedAt > REPLAN_GAP_SECS) {
      const fl = live.find(m => plan.roles.get(m)?.kind === 'flanker' && m.sup.v < presser.sup.v - 0.05 && !suppressed(m));
      if (fl) { TACTICS_STATS.swaps++; endPlan(g, plan, `${presser.callsign} pinned — ${fl.callsign} presses`); const p2 = planApproach(g, live, fix, 'the presser pinned', fl); if (p2) { const r = p2.roles.get(fl); if (r) r.holdT = g.tune.flankWait; } continue; }   // (no waiting for anybody: he goes as soon as he is at his corner)
    }
  }
  // new plans: unplanned free alert men of one side, no eyes on their man, more than JOIN_M off a fix they share (or paired in the lockdown)
  if (now - st.dealFailT < REPLAN_GAP_SECS) return;   // (a deal that found no two routes a moment ago: not again this second)
  const cands = g.guards.filter(m => fitForRole(g, m) && !st.roles.has(m) && !st.gates.has(m) && !inContact(g, m) && flat(m.char.pos, m.lastKnown!) > JOIN_M);
  const used = new Set<Guard>();
  for (const seed of cands) {
    if (used.has(seed)) continue;
    // a live plan of his side on (about) his fix takes him in by a re-deal
    const near = st.plans.find(p => p.team === seed.team && p.phase === 'approach' && flat(p.target, seed.lastKnown!) <= SHARE_M && now - p.replannedAt > REPLAN_GAP_SECS);
    if (near) { const men = [...near.members.filter(m => !inContact(g, m)), seed]; used.add(seed); endPlan(g, near, `${seed.callsign} joins`); planApproach(g, men, seed.lastKnown!, `${seed.callsign} joins`); continue; }
    const group = cands.filter(o => !used.has(o) && o.team === seed.team && (o === seed || flat(o.lastKnown!, seed.lastKnown!) <= SHARE_M || o.leader === seed || seed.leader === o));
    if (group.length < 2) continue;
    for (const o of group) { used.add(o); if (o !== seed && flat(o.lastKnown!, seed.lastKnown!) > SHARE_M) o.lastKnown = v3.copy(seed.lastKnown!); }   // (a lockdown pair on two fixes works the leader's… the seed's: they are one unit)
    planApproach(g, group, seed.lastKnown!, 'formed');
  }
}

// ---------------------------------------------------------------- moving on a role (the alert branch, no eyes on his man)
export interface TacMove { move: number; aim: Vec3 | null; pied: boolean; crouch: number; }
/** walk / jog / run to `goal` the way the chase always did (goTo → pie the doorways → followPath); true once there */
function advance(g: Game, gd: Guard, dt: number, goal: Vec3, pace: number, out: TacMove): boolean {
  goTo(g, gd, goal);
  const pie = pieDoorway(g, gd, dt, pace, inContact(g, gd)); out.pied = true;
  const arrived = followPath(g, gd, dt, pie.speed); out.move = gd.speed;
  if (pie.look) out.aim = pie.look;
  return arrived;
}
/** planted, low, chest and gun toward `at` */
function kneelToward(g: Game, gd: Guard, dt: number, at: Vec3, out: TacMove, crouch = 1) {
  const c = gd.char; gd.speed = damp(gd.speed, 0, 8, dt); c.vel = [0, 0, 0]; gd.stallRef = null;
  out.move = 0; out.crouch = crouch; out.aim = [at[0], 1.05, at[2]];
  c.bodyYaw = approachAngle(c.bodyYaw, Math.atan2(at[0] - c.pos[0], at[2] - c.pos[2]), 4 * dt);
}
/** the flankers of a plan are all set (or there are none), or somebody has eyes on the man */
function readyToGo(g: Game, plan: Plan): boolean {
  if (plan.contact) return true;
  const pr = presserOf(plan);
  for (const [m, r] of plan.roles) {
    if (!plan.members.includes(m) || inContact(g, m)) continue;
    if (r.kind === 'flanker' && !r.holding) return false;
    if (r.kind === 'second' && pr && flat(m.char.pos, pr.char.pos) > BEHIND_M + 1.5) return false;   // (his second closed up behind him, not strung out down the corridor)
  }
  return true;
}
/** some flanker of the plan is not yet set but still covering ground toward his corner (more than ~0.8 m/s over the last second and a half) */
function flankersRunning(g: Game, plan: Plan): boolean {
  for (const [m, r] of plan.roles) if (r.kind === 'flanker' && plan.members.includes(m) && !r.holding && (r.ground ?? 0) > 1.2 && g.time - r.t0 > 1.0) return true;
  return false;
}
function goNow(g: Game, plan: Plan, caller: Guard, why: string) {
  if (plan.phase !== 'approach') return;
  plan.phase = 'push'; for (const r of plan.roles.values()) r.holding = false; plan.goT = g.time; TACTICS_STATS.goes++; if (why === 'timeout') TACTICS_STATS.goTimeouts++;
  g.say(caller, why === 'contact' ? 'eyes on — go go go' : why === 'timeout' ? "can't wait — pushing, go" : 'go go go', true); plan.lastRadioT = g.time;
  for (const m of plan.members) { m.path = []; m.pathGoal = null; m.stallRef = null; }
  TACTICS_DEBUG.log?.(`${g.time.toFixed(2)}s PLAN #${plan.id} GO (${why}) by ${caller.callsign}`);
}
/** the man reaches the fix (or as near as the floor lets him): off the roster into the search everybody always dropped to — the presser says so */
function arrive(g: Game, gd: Guard, role: Role) {
  const st = S(g), plan = role.plan;
  role.arrived = true; TACTICS_STATS.arrivals++;
  if (plan.firstArriveT < 0) plan.firstArriveT = g.time;
  st.roles.delete(gd); plan.roles.delete(gd); plan.members = plan.members.filter(m => m !== gd);
  dropToSearch(g, gd, role.kind === 'presser' || plan.members.length === 0 ? 'not here — spread out, check your side' : null);
  if (!plan.members.length) endPlan(g, plan, 'everybody there');
}
function moveRole(g: Game, gd: Guard, role: Role, dt: number): TacMove {
  const T = g.tune, plan = role.plan, out: TacMove = { move: 0, aim: null, pied: false, crouch: 0 };
  const fix = plan.target; const c = gd.char;
  const jog = T.guardInvestigate, run = T.guardChase;
  if (plan.phase === 'push') {   // everybody at the run to the fix itself; the second keeps his station behind the presser on the way
    if (role.kind === 'second') { const pr = presserOf(plan); if (pr && pr !== gd && !roleOfMan(g, pr)?.arrived && flat(c.pos, pr.char.pos) < BEHIND_M) { kneelToward(g, gd, dt, fix, out, 0); return out; } }
    if (advance(g, gd, dt, fix, run, out) || flat(c.pos, fix) < ARRIVE_M) arrive(g, gd, role);
    else if (notGettingAnywhere(gd, dt, ROLE_STALL_SECS)) arrive(g, gd, role);   // (a fix he cannot quite reach: he searches from where he got to, as the chase always ended)
    if (!out.aim) out.aim = [fix[0], 1.1, fix[2]];
    return out;
  }
  switch (role.kind) {
    case 'presser': {
      const hold = role.holdAt ?? fix;
      if (!role.holding) {
        if (advance(g, gd, dt, hold, jog, out) || flat(c.pos, hold) < 0.5) { role.holding = true; gd.path = []; gd.pathGoal = null; TACTICS_DEBUG.log?.(`${g.time.toFixed(2)}s ${gd.callsign} (presser) at his corner (${c.pos[0].toFixed(1)}, ${c.pos[2].toFixed(1)})`); }
        else if (notGettingAnywhere(gd, dt, ROLE_STALL_SECS)) { role.holding = true; role.holdAt = v3.copy(c.pos); gd.path = []; gd.pathGoal = null; }   // (the corner as near as he gets to it)
        if (!out.aim) out.aim = [fix[0], 1.1, fix[2]];
      } else {
        kneelToward(g, gd, dt, fix, out);
        if (!flankersRunning(g, plan)) role.holdT += dt;   // (his patience runs out on a flanker who is getting nowhere — one still covering ground round to his corner he waits for: the pincer is the point)
        if (readyToGo(g, plan)) goNow(g, plan, gd, plan.contact ? 'contact' : 'set');
        else if (role.holdT >= T.flankWait) goNow(g, plan, gd, 'timeout');
      }
      return out;
    }
    case 'flanker': {   // the long way round, at the run (he has twice the ground to cover and the two should close together)
      const setAt = role.holdAt ?? fix;
      if (!role.saidSet && (flat(c.pos, setAt) <= SET_M || role.holding)) { role.saidSet = true; role.set = true; g.say(gd, 'set', true); plan.lastRadioT = g.time; }
      if (!role.holding) {
        role.ground = (role.ground ?? 0) * Math.exp(-dt / 1.5) + flat(c.pos, role.lastPos ?? c.pos); role.lastPos = v3.copy(c.pos);   // (metres covered lately, ~1.5 s window: the presser's clock reads it)
        if (advance(g, gd, dt, setAt, run, out) || flat(c.pos, setAt) < 0.5) { role.holding = true; role.set = true; gd.path = []; gd.pathGoal = null; TACTICS_DEBUG.log?.(`${g.time.toFixed(2)}s ${gd.callsign} (flanker) set at (${c.pos[0].toFixed(1)}, ${c.pos[2].toFixed(1)})`); }
        else if (notGettingAnywhere(gd, dt, ROLE_STALL_SECS)) { role.holding = true; role.set = true; role.holdAt = v3.copy(c.pos); gd.path = []; gd.pathGoal = null; if (!role.saidSet) { role.saidSet = true; g.say(gd, wg('set — can\'t get any farther around', 'set — as far round as I get'), true); } }
        if (!out.aim) out.aim = [fix[0], 1.1, fix[2]];
      } else { kneelToward(g, gd, dt, fix, out); role.holdT += dt; }
      return out;
    }
    case 'second': {   // up the presser's line, BEHIND him: follow the man, stop three metres short of him, kneel when he kneels
      const pr = presserOf(plan);
      if (!pr) { if (!out.aim) out.aim = [fix[0], 1.1, fix[2]]; return out; }
      const gap = flat(c.pos, pr.char.pos); const prRole = plan.roles.get(pr);
      const moving = gd.path.length > 0 && gd.pathI < gd.path.length && gd.speed > 0.2;
      if (gap > BEHIND_M + (moving ? 0 : BEHIND_SLACK_M)) { advance(g, gd, dt, pr.char.pos, gap > BEHIND_M + 3 ? run : jog, out); if (!out.aim) out.aim = [fix[0], 1.1, fix[2]]; }
      else { gd.path = []; gd.pathGoal = null; kneelToward(g, gd, dt, fix, out, prRole?.holding ? 1 : 0); }
      return out;
    }
  }
}
function presserOf(plan: Plan): Guard | null { for (const [m, r] of plan.roles) if (r.kind === 'presser' && plan.members.includes(m)) return m; return null; }
function roleOfMan(g: Game, gd: Guard): Role | null { return S(g).roles.get(gd) ?? null; }

// ================================================================ (B) the lone man's angle
/** Is the man this guard is after ARMED, as far as he can know: an AI foe always carries a gun; Sam if a shot of his has reached this man's ears lately, or if
 *  he has had Sam in view lately with a gun in his hand. */
export function armedIntruder(g: Game, gd: Guard): boolean {
  if (gd.foe !== 'player') return !!gd.foe;
  const H = gd.witness.heard;
  if (H.shots > 0 && H.lastShotT >= 0 && g.time - H.lastShotT < ARMED_SHOT_SECS) return true;
  if (g.player.lastFireT >= 0 && g.time - g.player.lastFireT < ARMED_SHOT_SECS && H.lastT >= 0 && g.time - H.lastT < ARMED_SHOT_SECS && H.lastT >= g.player.lastFireT - 1) return true;   // (a sub-gunshot report of his that this man heard as an odd noise: he has put the two together)
  return !!g.player.gunInHand() && gd.sightT >= 0 && g.time - gd.sightT < ARMED_SEEN_SECS;
}
/** nobody else of his side is alert (and free): he is on his own with it */
function alone(g: Game, gd: Guard): boolean { return !g.guards.some(o => o !== gd && o.team === gd.team && o.state === 'alert' && !o.held && !o.hold); }   // (only another man ALERT is a second gun: one still searching two rooms off is raised by the call and dealt a role with him; a man on the tour's marks is scenery)
/** The corner he holds: along his own route to the fix, the first point that has a LINE on it (losOpen: the line of fire — seeing it through a pane is not
 *  having it; never nearer than LONE_HOLD_MIN_M) pulled onto the nearest cell hard by a wall that keeps the line; a line from where he stands already, the
 *  same search about his feet; no line short of the limit, the point on the route with six metres still to go (he covers the approach from there). los =
 *  whether the spot actually has the line. */
function loneCorner(g: Game, gd: Guard, fix: Vec3): { p: Vec3; los: boolean } {
  const nav = g.col.nav, from = gd.char.pos;
  const path = nav.findPath(from, fix, 6000, tacticsPenalty(g, gd, fix)) ?? [];
  const s = samplePath(from, path, 0.3);
  let cand: Vec3 | null = null;
  for (const p of s) { if (flat(p, fix) < LONE_HOLD_MIN_M) break; if (losOpen(g, p, fix, gd.team)) { cand = p; break; } }
  TACTICS_DEBUG.log?.(`${g.time.toFixed(2)}s ${gd.callsign} LONE corner search from (${from[0].toFixed(2)}, ${from[2].toFixed(2)}) to (${fix[0].toFixed(1)}, ${fix[2].toFixed(1)}): path ${path.length} pts / ${s.length} samples, first sight ${cand ? `(${cand[0].toFixed(1)}, ${cand[2].toFixed(1)}) ${flat(cand, fix).toFixed(1)} m off it` : 'none short of the limit'}`);
  if (!cand) return { p: pointShortOfEnd(from, path, LONE_HOLD_MIN_M + 0.5), los: false };   // (no sight of it short of the limit: he holds six metres up his own route and covers the way in)
  // onto a wall: the free cell within LONE_COVER_R of it with the most statics about it that still sees the fix and is no nearer it than the limit
  const cs = nav.cell; let best = cand, bw = wallsAbout(g, cand), bd = 0;
  const R = Math.ceil(LONE_COVER_R / cs); const cx = Math.floor(cand[0] / cs), cz = Math.floor(cand[2] / cs);
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= nav.W || z >= nav.H || nav.blocked[nav.idx(x, z)]) continue;
    const q: Vec3 = [(x + 0.5) * cs, 0, (z + 0.5) * cs]; const d = flat(q, cand); if (d > LONE_COVER_R || flat(q, fix) < LONE_HOLD_MIN_M) continue;
    const w = wallsAbout(g, q); if (w < 2) continue;
    if (!(w > bw || (w === bw && best !== cand && d < bd))) continue;   // more wall about it wins; as much, the nearer
    if (!(nav.walkable(cand, q) || !g.col.solidBlocked([cand[0], 0.5, cand[2]], [q[0], 0.5, q[2]])) || !losOpen(g, q, fix, gd.team)) continue;   // (a step he can take — the grid's walkable is shy of the very wall he wants his shoulder on, so a clear line at shin height does too: the SOLID question — and the fix still in his line from there: the line of FIRE, losOpen; a pane blocks both)
    best = q; bw = w; bd = d;
  }
  return { p: best, los: true };
}
/** The call: over the net, once per hold — and his side comes (calm men take it as they take a colleague's shots: alert on the fix, the far end a beat later). */
function loneCall(g: Game, gd: Guard, L: Lone) {
  L.called = true; TACTICS_STATS.loneCalls++; S(g).lastLoneCallT = g.time;
  const where = placeName(g.level, L.fix);
  g.say(gd, gd.foe === 'player' && !(WORDS.on && gd.unit) ? `he's armed — ${where}. holding my corner, get a second man to me` : `armed contact, ${where} — holding here, need another gun on it`, true);
  g.audio.play('radio', gd.char.bones.head ?? gd.char.pos, 0.7);
  for (const o of g.guards) {
    if (o === gd || o.state === 'dead' || o.held || o.hold || o.pinned || o.team !== gd.team || o.script) continue;   // (his own side, free to come: not the man in Sam's arm, not one on choreographed marks)
    const wasCalm = o.state === 'patrol' || o.state === 'suspicious' || o.state === 'search';
    o.awareness = Math.max(o.awareness, 0.92);
    if (wasCalm || !o.lastKnown) o.lastKnown = v3.copy(L.fix);
    if (wasCalm) o.reactT = Math.max(o.reactT, 0.25 + Math.min(1.2, flat(o.char.pos, gd.char.pos) / 25) + simRandom() * 0.4);
    if (o.foe === null && gd.foe && gd.foe !== 'player' && !railsDown(g, gd.foe)) o.foe = gd.foe;   // (a unit with nobody yet takes his colleague's man)
  }
}
function moveLone(g: Game, gd: Guard, L: Lone, dt: number): TacMove | null {
  const T = g.tune, c = gd.char, out: TacMove = { move: 0, aim: null, pied: false, crouch: 0 };
  if (L.released) {   // on alone, carefully: the chase as it always was, at a walk
    const r = chaseFix(g, gd, dt, T.guardWalk);
    return { move: r.move, aim: r.aim, pied: r.pied, crouch: 0 };
  }
  const hold = L.holdAt!;
  if (L.holdT <= 0 && flat(c.pos, hold) > 0.2) {
    const there = advance(g, gd, dt, hold, T.guardInvestigate, out);
    if (there || notGettingAnywhere(gd, dt, ROLE_STALL_SECS)) { L.holdAt = v3.copy(c.pos); L.holdT = 1e-3; gd.path = []; gd.pathGoal = null; }
    if (!out.aim) out.aim = [L.fix[0], 1.1, L.fix[2]];
    return out;
  }
  if (L.holdT <= 0) { L.holdT = 1e-3; gd.path = []; gd.pathGoal = null; TACTICS_STATS.loneHolds++; TACTICS_DEBUG.log?.(`${g.time.toFixed(2)}s ${gd.callsign} LONE hold at (${c.pos[0].toFixed(1)}, ${c.pos[2].toFixed(1)}), fix (${L.fix[0].toFixed(1)}, ${L.fix[2].toFixed(1)}) ${flat(c.pos, L.fix).toFixed(1)} m, los ${L.los}`); }
  kneelToward(g, gd, dt, L.fix, out); L.holdT += dt;
  if (!L.called && L.holdT > 0.4) loneCall(g, gd, L);
  if (L.holdT >= T.loneWait || (L.holdT > 1.0 && !alone(g, gd))) { L.released = true; L.releasedWhy = L.holdT >= T.loneWait ? 'waited' : 'a second man is up'; TACTICS_STATS.loneReleases++; gd.path = []; gd.pathGoal = null; resetChase(gd); TACTICS_DEBUG.log?.(`${g.time.toFixed(2)}s ${gd.callsign} LONE release: ${L.releasedWhy}`); }
  return out;
}

/** guards.ts, the alert branch with a fix and no eyes on his man (in place of the chase; null = the chase as it always was, chaseFix): his role in a flanking
 *  approach if he holds one, else the lone man's angle if that is what he is, else nothing of ours. */
export function tacticsAlert(g: Game, gd: Guard, dt: number): TacMove | null {
  if (!tacticsOn(g) || !gd.lastKnown || gd.pinned || gd.hold) return null;
  const st = S(g);
  const role = st.roles.get(gd);
  if (role && role.plan.phase !== 'done') return moveRole(g, gd, role, dt);
  if (st.gates.has(gd)) { st.lone.delete(gd); return chaseFix(g, gd, dt, g.tune.guardChase); }   // on a kill-zone doorway's drill: the gate inside followPath has his feet (and holds the chase's watchdogs off); nothing else of ours meanwhile
  // the lone man: alert alone on an armed man's fix more than LONE_FIGHT_M off
  const fix = gd.lastKnown; let L = st.lone.get(gd) ?? null;
  if (L && flat(L.fix, fix) > REPLAN_M) { st.lone.delete(gd); L = null; }   // (a new place: a new corner, or none)
  if (L?.released && !foeDown(g, gd)) { if (flat(L.fix, fix) > 0.05) L.fix = v3.copy(fix); return moveLone(g, gd, L, dt); }   // going on carefully: at a walk all the way in, not a sprint over the last five metres
  const applies = armedIntruder(g, gd) && flat(gd.char.pos, fix) > LONE_FIGHT_M && !foeDown(g, gd) && (alone(g, gd) || !!L);
  if (!applies) { if (L) st.lone.delete(gd); return null; }
  if (!L) { const cn = loneCorner(g, gd, fix); L = { fix: v3.copy(fix), holdAt: cn.p, los: cn.los, t0: g.time, holdT: 0, called: false, released: false, releasedWhy: '' }; st.lone.set(gd, L); gd.path = []; gd.pathGoal = null; gd.stallRef = null; }
  else if (flat(L.fix, fix) > 0.05) L.fix = v3.copy(fix);
  return moveLone(g, gd, L, dt);
}

// ---------------------------------------------------------------- the tick
/** Once a frame from game.ts update(), before the guards move: expire what has lapsed, read this frame's rounds for doorways, keep the plans and gates honest,
 *  deal new plans. Nothing at all with the tactics off. */
export function tacticsTick(g: Game, dt: number) {
  const st = states.get(g);
  if (!tacticsOn(g)) { if (st && (st.plans.length || st.roles.size || st.lone.size || st.gates.size)) { for (const p of [...st.plans]) endPlan(g, p, 'tactics off'); st.roles.clear(); st.lone.clear(); st.gates.clear(); } return; }
  const s = S(g);
  // housekeeping: men no longer in the list, records past their time
  for (const m of [...s.lone.keys()]) if (!g.guards.includes(m) || m.state !== 'alert' || s.roles.has(m)) s.lone.delete(m);
  for (const m of [...s.cleared.keys()]) if (!g.guards.includes(m) || m.state === 'dead') s.cleared.delete(m);
  const before = s.danger.length; s.danger = s.danger.filter(r => r.until > g.time || g.time - r.until < 60);   // (kept a minute past for the panel; the tests all read `until`)
  void before; void dt;
  scanRounds(g);
  tickGates(g);
  tickPlans(g);
}

// ================================================================ (C) the gate: a man whose way runs through a dangerous doorway takes it as a drill
/** which face of d the point is on, in crossesDoor's convention (+1 = the +n side of the closed frame line) */
function sideOf(d: Door, p: Vec3): 1 | -1 { const F = frameOf(d); return (p[0] - F.hx) * F.nx + (p[2] - F.hz) * F.nz >= 0 ? 1 : -1; }
const alongOf = (d: Door, p: Vec3) => { const F = frameOf(d); return (p[0] - F.hx) * F.ux + (p[2] - F.hz) * F.uz; };
/** a point in the door's frame: `a` along hinge → latch, `b` out from the frame line on side sg */
function doorPt(d: Door, a: number, b: number, sg: 1 | -1, y = 0): Vec3 { const F = frameOf(d); return [F.hx + F.ux * a + F.nx * sg * b, y, F.hz + F.uz * a + F.nz * sg * b]; }
/** the level's clear plan for this door taken from side sg with its stack past the jamb at `nearA`, if it has one (its marks and entry legs are authored better than computed ones) */
function planFor(g: Game, d: Door, sg: 1 | -1, nearA: number): RoomClearPlan | null {
  for (const p of g.level.clearPlans ?? []) {
    if (p.door !== d.def.name) continue;
    if (sideOf(d, p.stack[0]) !== sg) continue;
    const a = alongOf(d, p.stack[0]); if ((nearA <= 0) !== (a < d.def.width / 2)) continue;
    return p;
  }
  return null;
}
/** where the k-th man (0 lead, 1 second) stacks: the plan's marks, else STACK_ALONG_M (+ STACK_GAP_M for the second) along the wall past the near jamb, STACK_OFF_M
 *  off it, on a free cell (a few fallbacks about that); and the facing there — along the wall toward the opening */
function stackSpot(g: Game, d: Door, sg: 1 | -1, nearA: number, k: 0 | 1, plan: RoomClearPlan | null): { pos: Vec3; face: number } {
  const nav = g.col.nav; const out = nearA <= 0 ? -1 : 1;   // which way along the frame line the wall runs from the near jamb
  const jamb = doorPt(d, nearA, STACK_OFF_M, sg);
  const faceOf = (p: Vec3) => Math.atan2(jamb[0] - p[0], jamb[2] - p[2]);
  if (plan) { const p = plan.stack[k]; if (!nav.isBlocked(p[0], p[2])) return { pos: v3.copy(p), face: plan.stackFace[k] }; }
  for (const along of [STACK_ALONG_M, 1.2, 0.7, 1.6]) for (const off of [STACK_OFF_M, 0.8, 1.05]) {
    const p = doorPt(d, nearA + out * (along + k * STACK_GAP_M), off, sg);
    if (!nav.isBlocked(p[0], p[2])) return { pos: p, face: faceOf(p) };
  }
  const p = nav.nearestFreePoint(jamb[0] + (nearA <= 0 ? -1 : 1) * frameOf(d).ux * (1 + k), jamb[2] + (nearA <= 0 ? -1 : 1) * frameOf(d).uz * (1 + k)) ?? jamb;
  return { pos: [p[0], 0, p[2]], face: faceOf([p[0], 0, p[2]]) };
}
/** the slice: SLICE_STEPS + 1 stations across the opening from the near jamb to the far one, as far back on his side as the floor allows (SLICE_BACK), each with
 *  the point in the room his muzzle is on from there (pivoting through the doorway's middle: from the near station he sees the far side of the room) */
function sliceStations(g: Game, d: Door, sg: 1 | -1, nearA: number): { pts: Vec3[]; look: Vec3[] } | null {
  const nav = g.col.nav, W = d.def.width; const dir = nearA <= 0 ? 1 : -1; const a0 = nearA - dir * 0.2, span = W + 0.4;
  for (const B of SLICE_BACK) {
    const pts: Vec3[] = []; let ok = true;
    for (let k = 0; k <= SLICE_STEPS && ok; k++) { const p = doorPt(d, a0 + dir * span * (k / SLICE_STEPS), B, sg); if (nav.isBlocked(p[0], p[2]) || (pts.length && !nav.walkable(pts[pts.length - 1], p))) ok = false; else pts.push(p); }
    if (!ok) continue;
    const look = pts.map(p => { const a = alongOf(d, p); return doorPt(d, W / 2 + (W / 2 - a) * 0.8, -2.2, sg, 1.1); });
    return { pts, look };
  }
  return null;
}
/** the entry legs for man k: the plan's (its points beyond the frame line), else a stride and a half straight in and ENTRY_LEG_M more at ±ENTRY_SPLIT_DEG (the
 *  lead toward the far-jamb side he finished his slice on, the second the other way), kept to free cells */
function entryLegs(g: Game, d: Door, sg: 1 | -1, nearA: number, k: 0 | 1, plan: RoomClearPlan | null): Vec3[] {
  const nav = g.col.nav, F = frameOf(d), W = d.def.width;
  if (plan) { const legs = plan.entry[k].filter(p => ((p[0] - F.hx) * F.nx + (p[2] - F.hz) * F.nz) * sg < -0.2 && !nav.isBlocked(p[0], p[2])); if (legs.length) return legs.map(p => v3.copy(p)); }
  const P1 = doorPt(d, W / 2, -ENTRY_IN_M, sg);
  const inx = -F.nx * sg, inz = -F.nz * sg; const toward = (nearA <= 0 ? 1 : -1) * (k === 0 ? 1 : -1);   // + = toward the latch end of the frame
  const ang = ENTRY_SPLIT_DEG * DEG;
  const cands: Vec3[] = [1, -1].map(s => [P1[0] + (inx * Math.cos(ang) - inz * Math.sin(ang) * s) * ENTRY_LEG_M, 0, P1[2] + (inx * Math.sin(ang) * s + inz * Math.cos(ang)) * ENTRY_LEG_M] as Vec3);
  cands.sort((p, q) => (((q[0] - P1[0]) * F.ux + (q[2] - P1[2]) * F.uz) * toward) - (((p[0] - P1[0]) * F.ux + (p[2] - P1[2]) * F.uz) * toward));
  const legs: Vec3[] = [];
  if (!nav.isBlocked(P1[0], P1[2])) legs.push(P1); else { const q = nav.nearestFreePoint(P1[0], P1[2]); if (q) legs.push([q[0], 0, q[2]]); }
  for (const P2 of cands) { if (!nav.isBlocked(P2[0], P2[2]) && (!legs.length || nav.walkable(legs[legs.length - 1], P2))) { legs.push(P2); break; } }
  return legs;
}
/** Step him along a local path to `target` at `speed` (his body turned to `face`, or to the way he goes), the frame's push-out doing the rest; true once there. */
function stepGate(g: Game, gd: Guard, G: Gate, dt: number, target: Vec3, speed: number, face: number | null): boolean {
  const c = gd.char, nav = g.col.nav; speed = conditionPace(g, gd, speed);   // (condition.ts: a hurt man's legs, whoever asks for them)
  if (!G.path || G.pathFor !== target) { G.path = nav.findPath(c.pos, target) ?? [v3.copy(target)]; const last = G.path[G.path.length - 1]; if (!last || flat(last, target) > 0.05) G.path.push(v3.copy(target)); G.pathI = 0; G.pathFor = target; }
  let arrived = false;
  while (G.pathI < G.path.length) {
    const wp = G.path[G.pathI]; const dx = wp[0] - c.pos[0], dz = wp[2] - c.pos[2]; const d = Math.hypot(dx, dz);
    if (d < (G.pathI === G.path.length - 1 ? 0.12 : 0.4)) { G.pathI++; continue; }
    gd.speed = damp(gd.speed, speed * clamp(d / 0.6, 0.3, 1), 6, dt);
    const step = Math.min(d, gd.speed * dt); c.pos[0] += dx / d * step; c.pos[2] += dz / d * step; c.vel = [dx / d * gd.speed, 0, dz / d * gd.speed];
    c.bodyYaw = approachAngle(c.bodyYaw, face ?? Math.atan2(dx, dz), 6 * dt);
    break;
  }
  if (G.pathI >= G.path.length) { arrived = true; gd.speed = damp(gd.speed, 0, 10, dt); c.vel = [0, 0, 0]; if (face !== null) c.bodyYaw = approachAngle(c.bodyYaw, face, 5 * dt); }
  return arrived || flat(c.pos, target) < 0.15;
}
function standGate(gd: Guard, dt: number, face: number | null) { const c = gd.char; gd.speed = damp(gd.speed, 0, 10, dt); c.vel = [0, 0, 0]; if (face !== null) c.bodyYaw = approachAngle(c.bodyYaw, face, 5 * dt); }
/** the other man on this doorway for this side, by role */
function gateMate(g: Game, G: Gate, role: 'lead' | 'second', except: Guard): { gd: Guard; G: Gate } | null {
  for (const [o, H] of S(g).gates) if (o !== except && H.door === G.door && H.rec.team === G.rec.team && H.role === role && o.state !== 'dead') return { gd: o, G: H };
  return null;
}
/** The lead's call, once per danger record: what he can see of why, and — the summons — the nearest free man of his side within SUMMON_M who is not himself
 *  fighting comes to stack behind him (his fix becomes the second mark; a patrolling man is startled straight into it, no 'huh?'). */
function gateCall(g: Game, gd: Guard, G: Gate) {
  const rec = G.rec; if (rec.called) return;
  rec.called = true;
  // (words.ts: doorLabel reads the OFFICE's door ids; another level's are its author's own shorthand, so there the door is its room's — 'the mess door' — or
  // 'this door' of one no named floor is beside; and a defender's callsign is the player's label for him, no name for the net: teams.ts spokenName)
  const dn = doorLabel(G.door), own = WORDS.on && !isOffice(g.level), at = own ? ownPlace(g.level, G.door.frameCentre) : null;
  const said = own ? doorSaidName(G.door) ?? (shorthandId(G.door.def.name) ? null : doorWords(G.door)) : null;   // (ONE name a door: the squad's own words for it where its id reads as words or doornames.ts names it — the room nearest its frame is only the fallback, and was the wrong room's name for a door between two)
  const wrote = !own ? doorWrittenName(G.door) : undefined;   // (the office: its men say a door its level has named by that name, as the squad's row does — one name a door)
  const door = !own ? wrote ? `the ${wrote}` : `the ${dn} door` : said ? `the ${said}` : at && at.d < 1.5 ? `${at.rect.name} door` : 'this door';
  const vm = rec.victim ? g.guards.find(o => o.callsign === rec.victim) : null, victim = vm ? spokenName(vm) : rec.victim;
  const line = rec.why === 'rounds' ? `taking rounds through ${door} — nobody through it, on the wall with me`
    : rec.why === 'press' ? `they're in there — ${own ? door : wrote ?? `${dn} door`}, stack on me, charge first`
    : victim ? `${victim}'s down in ${WORDS.doors && !/door$/.test(door) ? door : `${door}way`} — hold short of it, stack on me` : `man down at ${door} — hold, don't go through`;
  g.say(gd, line, true); g.audio.play('radio', gd.char.bones.head ?? gd.char.pos, 0.7);
  // the summons
  let best: Guard | null = null, bd = SUMMON_M;
  for (const o of g.guards) {
    if (o === gd || o.state === 'dead' || o.team !== gd.team || !freeMan(g, o) || S(g).gates.has(o) || S(g).roles.has(o) || inContact(g, o)) continue;
    if (o.state === 'alert' && o.lastKnown && flat(o.lastKnown, G.door.frameCentre) > 6) continue;   // (a man fighting his own fight elsewhere keeps it)
    const dd = flat(o.char.pos, gd.char.pos); if (dd < bd) { bd = dd; best = o; }
  }
  if (!best) return;
  const spot = stackSpot(g, G.door, G.side, G.nearA, 1, planFor(g, G.door, G.side, G.nearA)).pos;
  best.lastKnown = v3.copy(spot); best.awareness = Math.max(best.awareness, 0.5); best.searchT = 0; best.path = []; best.pathGoal = null; best.stallRef = null; best.bodyDuty = null; best.searchPlan = null; best.task = null;
  if (best.state === 'patrol') { best.state = 'suspicious'; best.reactT = 0.5; }
  else if (best.state === 'search') { best.state = 'suspicious'; best.reactT = 0.3; best.pieing = null; }   // (called off his search from inside ANOTHER man's update: his own may already have run this frame, so the doorway he was slicing is let go of here)
  else best.reactT = Math.max(best.reactT, 0.3);
  rec.summoned = best; TACTICS_STATS.summons++;
  g.say(best, spokenName(gd) ? `copy — coming to you, ${gd.callsign}` : 'copy — coming to you');
  TACTICS_DEBUG.log?.(`${g.time.toFixed(2)}s GATE ${G.door.def.name}: ${gd.callsign} calls it, ${best.callsign} summoned from ${bd.toFixed(1)} m to (${spot[0].toFixed(1)}, ${spot[2].toFixed(1)})`);
}
/** Does this man's way take him through (or up to) a doorway dangerous to his side that he has not yet taken as a drill — then the gate has him: built here. */
function tryEngage(g: Game, gd: Guard, recs: DangerRec[]): Gate | null {
  const c = gd.char;
  for (const rec of recs) {
    if (clearedFor(g, gd, rec.door)) continue;
    const d = rec.door; let side: 1 | -1 | 0 = 0, goalNear = false;
    // the remaining path crossing it within GATE_DETECT_M of walk…
    let acc = 0, prev: Vec3 = c.pos;
    for (let i = gd.pathI; i < gd.path.length && acc <= GATE_DETECT_M; i++) {
      const wp = gd.path[i]; const L = flat(prev, wp); const X = crossesDoor(prev, wp, d);
      if (X && acc + L * X.t <= GATE_DETECT_M) { side = X.side; break; }
      acc += L; prev = wp;
    }
    // …or ending within GATE_GOAL_M of its middle, a few strides ahead of him (a body lying in front of it, a mark beside it)
    if (!side && gd.pathGoal && flat(gd.pathGoal, d.frameCentre) < GATE_GOAL_M && flat(c.pos, gd.pathGoal) < GATE_DETECT_M + 1.0 && flat(c.pos, d.frameCentre) < GATE_DETECT_M + GATE_GOAL_M) { side = sideOf(d, c.pos); goalNear = true; }
    // …or he is the man the lead's call fetched, coming up on the marks
    if (!side && rec.summoned === gd && flat(c.pos, d.frameCentre) < GATE_DETECT_M + 2.5) { side = sideOf(d, c.pos); goalNear = true; }
    if (!side) continue;
    const sg = side as 1 | -1;
    const a = alongOf(d, c.pos); const nearA = a < d.def.width / 2 && !latchFirst(g, d, doorPt(d, d.def.width + STACK_ALONG_M, STACK_OFF_M, sg)) ? 0 : d.def.width;   // (handleside.ts: a SHUT leaf is taken from its latch jamb — the handle is there, and crossing a shut door to it shows him to nobody)
    const plan = planFor(g, d, sg, nearA);
    const lead = [...S(g).gates].find(([o, H]) => o !== gd && H.door === d && H.rec.team === gd.team && H.role === 'lead' && o.state !== 'dead' && H.phase !== 'cross' && H.phase !== 'done' && H.side === sideOf(d, c.pos));   // (a lead on the FAR side of it is no man to stack behind: reaching him means walking the funnel — this man leads his own side)
    const role: 'lead' | 'second' = lead ? 'second' : 'lead';
    const useSide = lead ? lead[1].side : sg, useNear = lead ? lead[1].nearA : nearA, usePlan = lead ? planFor(g, d, useSide, useNear) : plan;
    const ss = stackSpot(g, d, useSide, useNear, role === 'lead' ? 0 : 1, usePlan);
    if (laneCovers(g, gd, ss.pos) || laneDoor(g, gd, doorPt(d, d.def.width / 2, 1.2, -useSide as 1 | -1), d.frameCentre, stunsOf(gd) > 0)) continue;   // (lanes.ts: that jamb — or the floor beyond the doorway — is in the line of guns his side knows of: he is stopped short by that rule instead)
    const G: Gate = { door: d, rec, phase: 'stack', t: 0, t0: g.time, side: useSide, nearA: useNear, spot: ss.pos, face: ss.face, role, lead: lead ? lead[0] : null,
      slicePts: [], sliceLook: [], sliceI: 0, sliceT: 0, legs: [], legI: 0, crossAt: -1, look: null, crouch: 0, path: null, pathI: 0, pathFor: null, stallRef: null, stallT: 0,
      can: null, tossT: -1, landT: -1, bangT: -1, goalNear, opened: false, crossed: false, action: 'slice', thrower: null };
    S(g).gates.set(gd, G); TACTICS_STATS.gates++;
    TACTICS_DEBUG.log?.(`${g.time.toFixed(2)}s GATE ${d.def.name} takes ${gd.callsign} (${gd.state}, ${role}${goalNear ? ', goal beside it' : ', path through it'}) from side ${useSide} — stack at (${ss.pos[0].toFixed(1)}, ${ss.pos[2].toFixed(1)})`);
    return G;
  }
  return null;
}
/** guards.ts followPath, first thing (after the un-stick): true = the gate has this man's feet this frame (followPath then reports 'not arrived' and moves
 *  nobody). False at once — five comparisons and a filter — for everybody with no dangerous doorway on his side, and always with the tactics off. */
export function doorGate(g: Game, gd: Guard, dt: number, speed: number): boolean {
  if (!tacticsOn(g) || gd.script || gd.held || gd.hold || gd.pinned || gd.state === 'dead' || (gd.state === 'patrol' && !gd.drawn)) return false;
  const st = S(g); let G = st.gates.get(gd) ?? null;
  if (!G) {
    const recs = dangerDoors(g, gd.team); if (!recs.length || inContact(g, gd)) return false;
    G = tryEngage(g, gd, recs); if (!G) return false;
  }
  void speed;
  return runGate(g, gd, G, dt);
}
/** a charge in the air or on the floor when its thrower leaves the drill (eyes on his man, shot, out of time): it goes off on its own short fuse — the can
 *  was thrown on a fuse nobody but his gate ran, and would have lain there a minute and a half */
function looseCan(G: Gate) { if (G.can && !G.can.fired) G.can.fuse = Math.min(G.can.fuse, TOSS_FUSE); }
function releaseGate(g: Game, gd: Guard, G: Gate, why: string) {
  const st = S(g); st.gates.delete(gd); looseCan(G);
  if (G.phase !== 'stack') setCleared(g, gd, G.door, Math.max(G.rec.until, g.time) + 1);
  if (G.role === 'lead' && !G.crossed && (G.phase === 'slice' || G.phase === 'done')) {   // looked into and not taken: the man stacked behind him has seen it sliced from a metre away — he is not made to wait and slice it all over again
    const mate = gateMate(g, G, 'second', gd);
    if (mate && mate.G.phase === 'stacked') { st.gates.delete(mate.gd); setCleared(g, mate.gd, G.door, Math.max(G.rec.until, g.time) + 1); mate.gd.path = []; mate.gd.pathGoal = null; mate.gd.stallRef = null; mate.gd.char.anim.crouchTarget = 0; TACTICS_DEBUG.log?.(`${g.time.toFixed(2)}s GATE ${G.door.def.name} lets ${mate.gd.callsign} go with him`); }
  }
  if (G.crossed) { G.rec.entered = true; TACTICS_STATS.entries++; if (!gateMate(g, G, 'second', gd) && G.role === 'lead' && !G.lead) TACTICS_STATS.loneEntries++; if (G.rec.banged) G.rec.until = Math.min(G.rec.until, g.time); else G.rec.until = Math.min(G.rec.until, g.time + 6); }
  gd.path = []; gd.pathGoal = null; gd.stallRef = null; gd.char.anim.crouchTarget = 0;
  TACTICS_DEBUG.log?.(`${g.time.toFixed(2)}s GATE ${G.door.def.name} lets ${gd.callsign} go: ${why} (phase ${G.phase}${G.crossed ? ', crossed' : ''})`);
}
/** One frame of a man's gate. */
function runGate(g: Game, gd: Guard, G: Gate, dt: number): boolean {
  const T = g.tune, c = gd.char, d = G.door, now = g.time;
  // out of it: eyes on his man (he fights), the record lapsed before he committed, too long all told, no longer hunting
  const hunting = gd.state === 'alert' || gd.state === 'search' || gd.state === 'suspicious' || (gd.state === 'patrol' && gd.drawn);
  // (a release from in here still answers TRUE for the frame: his path has just been emptied for a fresh plan, and followPath must not read that as 'arrived')
  if (inContact(g, gd)) { releaseGate(g, gd, G, 'eyes on'); return true; }
  if (!hunting) { releaseGate(g, gd, G, `now ${gd.state}`); return true; }
  if (now - G.t0 > GATE_CAP_SECS) { releaseGate(g, gd, G, 'out of time'); return true; }
  if (G.rec.until <= now && (G.phase === 'stack' || G.phase === 'wait' || G.phase === 'stacked')) { releaseGate(g, gd, G, 'the doorway is plain again'); return true; }
  // (lanes.ts LANES.drill: the loss that marked this doorway opens a lane his side calls a second later — after the gate took him. Until he commits — the
  // charge thrown, the doorway crossed — he is asked again each frame, the frame he would commit included. A second whose lead has thrown or gone, and
  // the man who is to throw the charge the lead's wait settled on, are the drill's: they go with it)
  if (LANES.on && LANES.drill && (G.phase === 'stack' || G.phase === 'wait' || G.phase === 'stacked' || G.phase === 'open' || G.phase === 'slice')) {
    const LG = G.role === 'second' && G.lead ? S(g).gates.get(G.lead) ?? null : null, mate = G.role === 'lead' ? gateMate(g, G, 'second', gd) : null;
    const going = !!LG && (LG.phase === 'toss' || LG.phase === 'bang' || LG.phase === 'cross' || (LG.action === 'toss' && LG.thrower === gd));
    const can = stunsOf(gd) > 0 || (!!mate && stunsOf(mate.gd) > 0) || (!!LG && !!G.lead && stunsOf(G.lead) > 0);   // (a charge of theirs goes in first: his own, or the stacked mate's)
    const at = G.phase === 'slice' && G.slicePts.length ? G.slicePts[Math.min(G.sliceI, G.slicePts.length - 1)] : G.phase === 'open' && G.hs ? G.hs.pos : G.spot;
    if (!going && laneDrill(g, gd, at, doorPt(d, d.def.width / 2, 1.2, -G.side as 1 | -1), d.frameCentre, can)) { releaseGate(g, gd, G, 'a lane his side knows of is on it'); return true; }
  }
  gd.stallRef = null; gd.alertStallT = 0; gd.chaseT = 0;   // (standing here on purpose: the branches' no-headway watchdogs are not to read it as a wedge)
  G.t += dt;
  const inside: Vec3 = doorPt(d, d.def.width / 2, -1.0, G.side, 1.1);   // a metre into the room through the middle: what a stacked man's muzzle rests on
  // a second whose lead has gone (dead, released, fighting) leads from where he is
  if (G.role === 'second' && (!G.lead || !S(g).gates.has(G.lead) || G.lead.state === 'dead')) { G.role = 'lead'; G.lead = null; if (G.phase === 'stacked') { G.phase = 'wait'; } TACTICS_DEBUG.log?.(`${now.toFixed(2)}s GATE ${d.def.name}: ${gd.callsign} leads now`); }
  switch (G.phase) {
    case 'stack': {
      G.look = inside; G.crouch = 0;
      const there = stepGate(g, gd, G, dt, G.spot, T.guardInvestigate, flat(c.pos, G.spot) < 1.2 ? G.face : null);
      if (there || G.t > 5) {
        G.t = 0;
        if (G.role === 'lead') { gateCall(g, gd, G); G.phase = 'wait'; }
        else G.phase = 'stacked';
        TACTICS_DEBUG.log?.(`${now.toFixed(2)}s GATE ${d.def.name}: ${gd.callsign} stacked (${G.role}) at (${c.pos[0].toFixed(2)}, ${c.pos[2].toFixed(2)})${there ? '' : ' — short of the mark'}`);
      }
      return true;
    }
    case 'wait': {   // on the jamb, low, muzzle on the opening, until a second man is stacked behind him or doorWait is up
      standGate(gd, dt, G.face); G.look = inside; G.crouch = 0.5;
      const mate = gateMate(g, G, 'second', gd); const set = mate && mate.G.phase === 'stacked';
      if (set || G.t >= T.doorWait) {
        G.thrower = stunsOf(gd) > 0 ? gd : mate && set && stunsOf(mate.gd) > 0 ? mate.gd : null; G.action = G.thrower ? 'toss' : 'slice';
        TACTICS_DEBUG.log?.(`${now.toFixed(2)}s GATE ${d.def.name}: ${gd.callsign} ${set ? `has ${mate!.gd.callsign} behind him` : `waited ${G.t.toFixed(1)} s, alone`} → ${G.action}${d.isClosed() ? ' (the leaf first)' : ''}`);
        G.phase = 'open'; G.t = 0;
      }
      return true;
    }
    case 'open': {   // a shut leaf: his hand round the jamb on the lever, shoved into the room (keyed, as staff open their own doors) and the closer held off; then the charge or the slice
      if (!G.opened && G.hs !== null && d.isClosed()) {   // (handleside.ts) the lever is worked from the handle's own place: a lead stacked out of reach of it, or on the hinge jamb, steps there first — and the rest of the drill is taken from that jamb
        if (G.hs === undefined) { const h = g.doors.pullFace(d, c.pos) ? toolSpot(g, d, G.side, c.pos) : null; G.hs = h && !h.far ? h : null; }   // (the face it opens into only, and only beside its jamb: on the other the stack's own jamb is the handle's — nobody steps in front of a marked doorway for a lever)
        if (G.hs && !(stepGate(g, gd, G, dt, G.hs.pos, T.guardInvestigate, G.hs.yaw) && toolStep(g, gd, G.hs.pos)) && G.t < 3) { G.look = inside; G.crouch = 0.4; return true; }
        if (G.hs) { G.nearA = d.def.width; G.spot = G.hs.pos; G.face = G.hs.yaw; G.t = 0; } G.hs = null; }
      standGate(gd, dt, G.face); G.look = inside; G.crouch = 0.4;
      if (!G.opened) { G.opened = true; if (d.isClosed()) { g.doors.use(d, c.pos, c.id, gd.keys); d.quietT = Math.min(d.quietT, -6); G.t = 0; TACTICS_DEBUG.log?.(`${now.toFixed(2)}s GATE ${d.def.name}: ${gd.callsign} shoves the leaf`); } else G.t = 1; }
      if (G.t >= 0.8) { G.t = 0; if (G.action === 'toss' && G.thrower && G.thrower.state !== 'dead' && !d.isClosed()) beginToss(g, gd, G, G.thrower); else beginSlice(g, gd, G); }
      return true;
    }
    case 'stacked': {   // the second: tucked in behind the lead, muzzle over him on the opening; goes when he goes
      standGate(gd, dt, G.face); G.crouch = 0.3;
      const lead = G.lead ? S(g).gates.get(G.lead) : null;
      G.look = lead && (lead.phase === 'toss' || lead.phase === 'bang') ? awayLook(d, G, c.pos) : inside;
      if (lead && lead.phase === 'cross' && lead.crossAt >= 0 && now >= lead.crossAt + 0.5) beginCross(g, gd, G);
      else if (lead && lead.phase === 'done') { releaseGate(g, gd, G, 'the lead is through'); return true; }
      return true;
    }
    case 'toss': {   // the charge has left the hand: heads down and away till it goes
      standGate(gd, dt, G.face); G.look = awayLook(d, G, c.pos); G.crouch = 0.7;
      const it = G.can!; const landed = it.bounces > 0 || it.settled;
      if (landed && G.landT < 0) G.landT = now;
      if ((G.landT >= 0 && now - G.landT >= TOSS_FUSE) || now - G.tossT > TOSS_AIR_CAP) {
        it.fired = true; detonateStun(g, it);
        for (let i = g.events.length - 1; i >= 0; i--) { const e = g.events[i]; if (e.kind === 'bang' && e.time === now) { e.announced = true; break; } }   // (their own charge: nobody on their side shouts 'flashbang!' at it)
        G.rec.banged = true; G.bangT = now; G.phase = 'bang'; TACTICS_STATS.bangs++;
        TACTICS_DEBUG.log?.(`${now.toFixed(2)}s GATE ${d.def.name}: bang at (${it.pos[0].toFixed(1)}, ${it.pos[2].toFixed(1)})`);
      }
      return true;
    }
    case 'bang': {
      standGate(gd, dt, G.face); G.look = inside; G.crouch = 0.4;
      if (now - G.bangT >= GO_AFTER_BANG) { g.say(gd, 'going in'); beginCross(g, gd, G); }
      return true;
    }
    case 'slice': {   // across the opening station by station, muzzle into the room, a quarter second on each
      G.crouch = 0.35;
      const i = Math.min(G.sliceI, G.slicePts.length - 1); const p = G.slicePts[i], look = G.sliceLook[i]; G.look = look;
      const faceIn = Math.atan2(look[0] - c.pos[0], look[2] - c.pos[2]);
      const there = stepGate(g, gd, G, dt, p, SLICE_PACE, faceIn);
      if (there) { G.sliceT += dt; if (G.sliceT >= SLICE_DWELL) { G.sliceI++; G.sliceT = 0; } }
      if (G.sliceI >= G.slicePts.length) {
        TACTICS_DEBUG.log?.(`${now.toFixed(2)}s GATE ${d.def.name}: ${gd.callsign} has sliced it (${G.t.toFixed(1)} s)`);
        if (G.goalNear) { releaseGate(g, gd, G, 'sliced — his mark is this side of it'); return true; }
        g.say(gd, gateMate(g, G, 'second', gd) ? wg('clear as far as I can see — crossing, on me', 'clear as far as I see — crossing, on me') : 'crossing');
        beginCross(g, gd, G);
      }
      return true;
    }
    case 'cross': {   // fast through the funnel and off it to his side
      G.crouch = 0; 
      if (now < G.crossAt) { standGate(gd, dt, G.face); G.look = inside; return true; }
      const leg = G.legs[Math.min(G.legI, G.legs.length - 1)];
      if (!leg) { G.crossed = sideOf(d, c.pos) !== G.side; releaseGate(g, gd, G, 'no leg to run'); return true; }
      G.look = G.legI + 1 < G.legs.length ? [G.legs[G.legI + 1][0], 1.1, G.legs[G.legI + 1][2]] : doorPt(d, alongOf(d, leg) + (alongOf(d, leg) > d.def.width / 2 ? 1.5 : -1.5), -3.0, G.side, 1.0);
      const there = stepGate(g, gd, G, dt, leg, T.guardChase, null);
      if (sideOf(d, c.pos) !== G.side) G.crossed = true;
      if (there || flat(c.pos, leg) < 0.35) { G.legI++; if (G.legI >= G.legs.length) { releaseGate(g, gd, G, 'in'); return true; } }
      else if (G.t > 3.5) { releaseGate(g, gd, G, 'the entry leg went nowhere'); return true; }
      return true;
    }
    case 'done': default: { releaseGate(g, gd, G, 'done'); return true; }
  }
}
/** eyes and muzzle down and away from the opening (the charge is about to go): the foot of the wall behind him along it */
function awayLook(d: Door, G: Gate, pos: Vec3): Vec3 { const F = frameOf(d); const out = G.nearA <= 0 ? -1 : 1; return [pos[0] + F.ux * out * 1.4 + F.nx * G.side * 0.4, 0.15, pos[2] + F.uz * out * 1.4 + F.nz * G.side * 0.4]; }
function beginSlice(g: Game, gd: Guard, G: Gate) {
  const st = sliceStations(g, G.door, G.side, G.nearA);
  if (!st || G.door.isClosed()) { TACTICS_DEBUG.log?.(`${g.time.toFixed(2)}s GATE ${G.door.def.name}: no slice (${st ? 'the leaf is shut' : 'no floor for it'}) — straight to the cross`); if (G.goalNear) { G.phase = 'done'; return; } beginCross(g, gd, G); return; }
  G.slicePts = st.pts; G.sliceLook = st.look; G.sliceI = 0; G.sliceT = 0; G.phase = 'slice'; G.t = 0; G.path = null; TACTICS_STATS.slices++;
}
function beginCross(g: Game, gd: Guard, G: Gate) {
  const k: 0 | 1 = G.role === 'lead' ? 0 : 1;
  G.legs = entryLegs(g, G.door, G.side, G.nearA, k, planFor(g, G.door, G.side, G.nearA)); G.legI = 0; G.phase = 'cross'; G.t = 0; G.path = null;
  G.crossAt = g.time + (G.role === 'lead' ? 0 : 0.5);
  TACTICS_DEBUG.log?.(`${g.time.toFixed(2)}s GATE ${G.door.def.name}: ${gd.callsign} crosses (${G.role}) → ${G.legs.map(p => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`).join(' → ') || 'no legs'}`);
}
function beginToss(g: Game, gd: Guard, G: Gate, thrower: Guard) {
  const d = G.door; const K = kit.get(thrower); if (K) K.stuns = Math.max(0, K.stuns - 1);
  const ch = thrower.char; const dir = G.nearA <= 0 ? 1 : -1;
  const from = doorPt(d, G.nearA + dir * 0.35, 0.3, G.side, 1.1);   // his arm round the near jamb: the can leaves the hand at the opening's edge, not from behind the wall (a lob from the stack mark meets the wall)
  const land = doorPt(d, d.def.width / 2 + dir * 0.2, -TOSS_IN_M, G.side, 0);
  const sol = g.items.solve(from, land, 9);
  const it = g.items.spawn('flash', from, sol.v0, { fuse: 99, who: ch.id, heading: v3.yawOf(sol.v0) });   // (fuse 99: it goes off on OUR clock — TOSS_FUSE after it lands — not the item's)
  it.onBounce = (sp, p, g) => g.audio.play('canisterBounce', p, Math.min(1, sp / 4));
  g.audio.play('throw', from, 0.7);
  g.say(thrower, 'bang out'); if (thrower !== gd) { const M = S(g).gates.get(thrower); if (M) M.look = awayLook(d, M, thrower.char.pos); }
  G.can = it; G.tossT = g.time; G.landT = -1; G.phase = 'toss'; G.t = 0;
  TACTICS_DEBUG.log?.(`${g.time.toFixed(2)}s GATE ${d.def.name}: ${thrower.callsign} puts a charge in toward (${land[0].toFixed(1)}, ${land[2].toFixed(1)})`);
}
/** keep the gates honest once a frame (a man reset out of the list, a corpse) — the phases themselves run from followPath */
function tickGates(g: Game) {
  const st = S(g);
  for (const [m, G] of [...st.gates]) if (!g.guards.includes(m) || m.state === 'dead' || m.held) { st.gates.delete(m); looseCan(G); TACTICS_DEBUG.log?.(`${g.time.toFixed(2)}s GATE ${G.door.def.name} drops ${m.callsign} (${m.state}${m.held ? ', held' : ''})`); }
}
/** guards.ts, just before the aim is eased on: a gated man's eyes and muzzle (the opening, the slice's stations, the floor while the charge goes) and how low he
 *  is — null for everybody else. */
export function tacticsLook(g: Game, gd: Guard): { aim: Vec3; crouch: number } | null {
  if (!g.tune.tactics) return null;
  const G = states.get(g)?.gates.get(gd); if (!G || !G.look) return null;
  return { aim: G.look, crouch: G.crouch };
}

// ---------------------------------------------------------------- panel / QA
/** One line: the plans (who presses, who flanks, phase), the lone men, the dangerous doorways with their seconds left, the men on a gate. '' when nothing is up. */
export function tacticsSummary(g: Game): string {
  const st = states.get(g); if (!st) return g.tune.tactics ? '' : 'tactics ▸ off';
  const parts: string[] = [];
  if (!g.tune.tactics) parts.push('OFF');
  for (const p of st.plans) parts.push(`plan #${p.id} ${p.phase} on (${p.target[0].toFixed(1)}, ${p.target[2].toFixed(1)}): ` + p.members.map(m => { const r = p.roles.get(m); return `${m.callsign} ${r?.kind ?? '?'}${r?.holding ? ' (holding)' : ''}${r?.kind === 'flanker' ? ` ${Math.round(degApart(r.bearing, p.presserBearing))}° round` : ''}`; }).join(', '));
  for (const [m, L] of st.lone) parts.push(`${m.callsign} lone: ${L.released ? `on at a walk (${L.releasedWhy})` : L.holdT > 0 ? `holding ${L.holdT.toFixed(1)} s${L.called ? ', called' : ''}` : 'to his corner'}`);
  for (const r of st.danger) if (r.until > g.time) parts.push(`${r.door.def.name} dangerous for ${r.team} (${r.why}${r.victim ? ' ' + r.victim : ''}) ${Math.ceil(r.until - g.time)} s${r.banged ? ' banged' : ''}${r.entered ? ' entered' : ''}`);
  for (const [m, G] of st.gates) parts.push(`${m.callsign} on the ${G.door.def.name} door: ${G.role} ${G.phase}`);
  return parts.length ? 'tactics ▸ ' + parts.join(' · ') : '';
}
