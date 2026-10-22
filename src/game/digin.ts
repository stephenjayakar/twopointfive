// DEFENDERS DIG IN AHEAD OF THE TEAM (the harder-defenders goal; default OFF = the room fight exactly as it was).
//
// What it is: a man holding a room the team has NOT reached yet, who learns where the team is — his own ears (the room fight's `noiseAt`: gunfire, a boot, a
// charge somewhere outside his room) or a word on his side's net (the first man of a room to get eyes on the team calls it, once he is past his own reaction) —
// gets ready for them instead of standing where he stood. IT TAKES HIM REAL TIME, in steps the team can catch him at:
//   think (2–5 s) → [gather: alone in his room, run to a room of his side's that still has men, said on the net] → shout, or the room's word on the net when no
//   enemy is in earshot → the bracer runs to a chair / carton / bin,
//   hauls it to the door (0.7 m/s, scraping the whole way), pulls the leaf to, works it under the handle (4–7 s, bumps heard) → the next likeliest door the
//   same way → to cover → set. A room is all set ~15–30 s after its first word of the team; a man caught with his hands on the furniture owes more before his
//   first round (`caught`), a door opened under his hands is not wedged, and anybody in his sight ends the step he is on.
//   · WHICH DOOR: the shortest way round from the noise that does not run through his own room; the men of a room turn about between the two likeliest,
//   · WHO: as shipped the room fight's rally decides first, exactly as ever (a man who means to go to the fight next door goes) and whoever holds his room
//     digs in — the switch never takes a man off the hunt. STAY (off) makes every man who hears them hold and dig in: MEASURED, that is EASIER on a team with
//     flashbangs than today's rush (the men on the hunt are what costs it men between doors; a flashbang undoes most of a dug-in room),
//   · GATHER (off: measured, two men under one flashbang): a man alone in his room doubles up with a room that still has men (never by a way that passes the
//     noise; ≤ 24 m, the move mode's ten seconds),
//   · BRACE: the furniture is really moved (props.ts), and the wedge reuses the Door's own lock (locked against the far face, to a lock no ring fits): it will
//     not open by hand from outside — the team's door tools boot it (their own 'locked. kicking it.'), a charge blows it, a man ordered across is walked round
//     by another door if there is one, Sam gets pick / kick; staff contacts carry a key, so nobody of theirs is ever stuck behind one,
//   · DOORS: a door of his room standing open toward them is walked to and pulled shut first,
//   · COVER: he moves to the spot in the room that SEES that doorway, is not seen from outside it, has a wall at its back and is not in front of another door —
//     the far side of the opening from a mate already on it; FAR: as far back as the room lets him see it (a stun canister reaches eight metres),
//   · DEPTH: every second man of a room takes a spot OFF the door's line instead (neither the doorway nor a can gone off just inside it sees his eyes) that
//     looks onto the floor the team must cross; LEARN (off) makes that every man once their side has heard a flashbang,
//   · STEADY: a man set on a door his room wedged does not flinch when it is booted in (the room fight's startle) — he was waiting for exactly that.
// Nothing here touches hit points, dice, aim or the reaction tables; `steady` withholds one surprise beat from a man who is not surprised, `caught` ADDS one.
// Every step has a cue: their net on the HUD's log (contact called, a man falling back to another room), the shout (said only when Sam or a teammate can hear
// it), the furniture scraping (a GameEvent + the sfx, like any shoved chair; a teammate who hears it says so), a teammate stacked on a wedged door saying it
// is blocked BEFORE anybody boots it, and the boot itself.
//
// Seams (all one added line or one added clause): roomfight.ts tickDef → digInTick, rally → digInStays, reset → digInReset, evidence (the startle) →
// digInBraced, applyWatch → digInLook. Everything else lives here. The two readonly Door fields the wedge writes are put back by digInReset (Door.reset()
// restores `locked` itself). The team has been in a room: its men are the room fight's again (no fear topped up, no second dig-in there).
//
// IMPORT CYCLE (src/game is one): nothing at module level uses another game module's exports.
import { SideMap, SideSet } from '../math/side';
import { Vec3, v3 } from '../math/vec';
import type { Game, Guard } from './game';
import type { Door } from './doors';
import type { Prop } from './props';
import { frameOf } from './guards';
import { order } from './squad';
import { pressWants, pressKeeps } from './pressure';
import { squadsLive, squadDefers, squadMayWedge } from './enemysquads';
import { lastStandMan } from './laststand';
import { hearPath } from './weather';
import { w, WORDS } from './words';
import { doorWords } from './orders';   // (call-time only: what a door is called — one name on one HUD)
import { simRandom } from '../math/dice';   // the simulation's die (math/dice.ts): the Game's own when it has one, Math.random otherwise
import { gunKeepsPost } from './gunroles';   // (call-time only)
import { laneCovers } from './lanes';   // (call-time only: is this spot in a lane his side knows is covered)

export const DIGIN = {
  /** THE switch: off = nothing here runs (the room fight as it was) */
  on: false,
  /** EVERY man who hears them coming holds his room and digs in — nobody goes to the fight next door. Off (shipped): the room fight's rally decides first, as
   *  ever (ROOMFIGHT.rallyK is the dial for how many go), and only a man who holds his room digs in. MEASURED: with nobody on the hunt the scripted team loses
   *  FEWER men than today, flashbangs in hand — the men who come to the fight are what kills it between doors */
  stay: false,
  /** REACH (m, on foot): a man whose way to the fight he hears is longer than this cannot join it in time — he holds his room and digs in, whatever the room
   *  fight's rally would have rolled; a man nearer than this is the rally's (or a press rule's) to send, as ever. 0 (shipped) = no reach rule: the rally
   *  decides for everybody and only the men it leaves at home dig in. MEASURED at 18 m: it claims six men in ten on every level there is (they all sit in one
   *  32 × 20 m shell), and men kept home are men not on the hunt — the scripted team loses FEWER. It is the knob a press / push rule wants beside it (near men
   *  go at once, far men get ready, then come): by itself it only takes the hunters away. AS BUILT the way is measured ONCE, when he first hears them, to the
   *  noise (or the net's fix) that told him: a fight that later moves next door does not release a man judged far, nor claim one judged near */
  reachM: 0,
  /** WITH THE PRESS (pressure.ts) ON TOO: a man SET on his door does not give his room up at the sound of the team's boots outside it (the press's `outEarly`
   *  — he is waiting for exactly that); a man still at his furniture, or who never dug in, goes as that rule has him. Off: the press's rule for everybody */
  holdSet: true,
  /** WITH THE PRESS ON TOO: the man a press leaves to KEEP his room (pressure.ts keepRoom) digs in. Off (hard — difficulty.ts HARD.keeperDigs): he does not,
   *  from the moment he is left until the fight is reset — he is the press's keeper and nothing more, and its last-man rules send him out by another door when
   *  the team's boots reach his. MEASURED (The block, the depot, the records building): the keeper is a man who at standard came hunting; dug in he is behind
   *  the one door a stun canister comes through, and costs the team less than the hunter he was. A man the press has left nowhere (no fight he could go to) still digs in, as ever; a man
   *  already at his furniture when he is made the keeper carries on with it */
  keeper: true,
  /** WITH THE PRESS ON TOO: a man of theirs who gives ground (a failed push, a last man leaving his room) falls back INTO a room of his side's that has dug in
   *  and the team has not reached, when there is one near enough — instead of to the far side of the door he left by. Off: the press's own answer */
  refuge: true,
  /** move to a covered spot that holds the door they will come by (off: he turns to that door from where he stands) */
  cover: true,
  /** haul furniture against that door and wedge it */
  brace: true,
  /** WHERE HE MAY GO FOR IT: the spot he pushes the furniture from is in HIS OWN ROOM and so is the way to it. 'Behind the prop' is a point 0.7 m past it from
   *  the door: for a bin or a carton against a wall that point is IN the wall, and the nearest free floor to it can be the far side — the warehouse's dock men
   *  walked out into the lot for a carton by the east wall and held the building from outside it. On: such a prop is pushed from the best spot behind it inside
   *  the room (within reach of it, nothing solid between, and the haul from there to the door inside the room too), else the next nearest prop is tried, else no furniture (he shuts the door and takes cover, as a man with nothing to haul does). Off = as it was:
   *  only a last-stand man is refused a goal outside his room */
  braceInRoom: true,
  /** pull to a door of his room that stands open toward them */
  doors: true,
  /** the first man of a room to see the team calls it on his side's net: the other rooms learn from it too */
  radio: true,
  /** … once HE has noticed them (on; off = on his first glimpse, as it was — the 10-13 tapes: a calm man at 1–20 % awareness radioing 'they're on us. watch
   *  your doors!' half a second before his own 'huh?', and a man dropped 0.18 s after his first glimpse having told every room). Noticed = roused (alert or
   *  searching: the line the squads' net draws for a man's eyes, enemysquads.ts) AND `noticedSecs` of them in his eyes without a break: this tick runs
   *  before the room fight hands a man his own start, so 'past his own start' alone let a roused man's word out on the very frame of the glimpse */
  noticed: true, noticedSecs: 0.35,
  /** WHERE DOORS STAY AS THEY ARE LEFT (doors.ts DOORSTAY — nothing below runs where every leaf has its closer, or with this off: the 2.5 s wait and his own
   *  door only, as it was): a man who has pulled a door of his room to keeps his hand on it until the latch has it — a leaf with no closer takes four or five
   *  seconds from its stop, not the moment a sprung one had left, and he used to walk off from his furniture before it was home, the wedge never placed. He
   *  pushes it home the last of the way (a one-way leaf: it comes to on its frame) and pulls it again if something stopped it. And before he goes to cover he
   *  shuts the room's OTHER doors that stand open, nearest first: never one a mate has in hand, never by a way that leaves his room, and not at all once
   *  they are heard at any door of it (shut or open: then he takes cover, as he did).
   *  SHIPS OFF: it overshoots the build with closers. On the barracks (144 scripted seeds) defenders wedged 669 doors with it on against 248 on the old build
   *  and 249 with it off, the squad booted 74 against 29, and the men it lost in open-and-clear entries went from 62 to 105. On the block with three squads it
   *  only puts back what closers gave (wedges 133 on, 74 off, 72 seeds). Tab ▸ Sandbox ▸ Defenders dig in turns it on */
  shutOpen: false,
  /** …seconds he gives a pulled leaf to latch before he lets it be · how near home (rad) his hand pushes it the rest · the other doors one man goes to at most */
  shutSecs: 7, shutHomeRad: 0.3, shutDoors: 2,
  /** DEPTH: every second man of a room digs in OFF the line of the door — a spot the doorway and the floor just inside it cannot see (a can thrown in at the
   *  door does not reach his eyes), looking onto the floor the team must cross further in. The first man's gun is on the doorway (off: everybody's is) */
  deep: true,
  /** FAR: a man covering a door holds it from as far back as the room lets him see it (in a long room: past a stun canister's eight metres from the doorway);
   *  off: from four or five metres, as the first cut had it */
  far: true,
  /** LEARN (default off): once his side has heard a stun canister go off (his own ears, or the word on the net), EVERY man digging in keeps off the door's line */
  learn: false,
  /** DOUBLE UP (off as shipped: measured, it puts two men under one flashbang and the team loses fewer): a man alone in his room, who hears them coming, runs to
   *  a room of his side's that still has men in it and digs in THERE (said on the net) — the team finds his room empty and the next one full */
  gather: false,
  /** … no further than this by the floor (m), and never by a way that passes this near the noise (m) */
  gatherM: 24, gatherShyM: 6,
  /** a man SET on a door his room wedged is waiting for the boot: he does not flinch when that door is booted in (off: the room fight's startle as ever — the
   *  one place a reaction beat is touched, and only to take away a surprise that is none) */
  steady: true,
  /** seconds between hearing it and moving [min, max] — his own, drawn per man */
  think: [2, 5] as [number, number],
  /** seconds of work at the door to wedge the furniture under it [min, max] — bumps heard the whole time; a door opened meanwhile is not wedged */
  wedgeSecs: [4, 7] as [number, number],
  /** doors one room wedges at most (the one they will come by first, then the next likeliest, while there is furniture and time) */
  wedges: 2,
  /** caught with his hands on the furniture or the door: seconds MORE before his first round [min, max] (his gun was not in his shoulder) */
  caught: [0.5, 0.9] as [number, number],
  /** a teammate (or Sam) who stands this long (s) at the outside of a wedged door has tried the handle: he says it is blocked — BEFORE anybody boots it */
  trySecs: 0.8,
  /** every step's length × this (1 = as shipped; 2 = digging in takes twice as long — measurement: a team that arrives twice as soon) */
  pace: 1,
  /** the noise this near the door he would brace (m): no time for furniture, cover only */
  closeM: 6,
  /** how far a man goes for a prop / hauls it (m, straight) */
  propM: 9,
  /** hauling pace (m/s) */
  haulSpeed: 0.7,
  /** the furniture's scrape: hearing level (a shoved chair is ~0.3–0.5) and seconds between scrapes */
  scrapeLevel: 0.5, scrapeEvery: 0.8,
  /** a shout carries this many metres of open air (× the propagation's carry) */
  shoutM: 18,
  /** a second door counts as a way in they might take when its way round is at most this much longer (m) */
  altM: 10,
  /** a new spot must beat where he stands by this much (score) */
  better: 0.6,
  /** the fear he keeps on his door while dug in (the room fight's evidence score, 0‥3), and for how long after the last loud noise (s) */
  fear: 2.4, holdSecs: 90,
  /** dug in on one door, the noise now says another: seconds before he shifts */
  redigSecs: 6,
  /** A SET MAN IS NOT LEFT STANDING IN A LANE HIS SIDE KNOWS IS COVERED (lanes.ts: fire that dropped a mate or passed one, called on their net — nothing where
   *  the lanes are off, so the frozen stand is as it was). The spot he takes to cover his door is never one in such a lane's line, and a man already set whose
   *  spot comes to lie in one — nobody in his own sights — picks again, at most every `laneSecs`: another spot of HIS room on the same door, out of the line.
   *  No such spot = he stays where he is, as before; he still does not give the room up (holdSet). false = spots as they were dealt before the rule */
  lanes: true, laneSecs: 2,
};
export const DIGIN_DEFAULTS = JSON.parse(JSON.stringify(DIGIN)) as typeof DIGIN;
/** THE FURNITURE COMES HOME (10-13). A hauling man was asked whether it had made it the frame he stopped at his stand by the door — and furniture that had
 *  swung wide of him on the way (he walks a corner, it follows a pace behind the turn) was then still a hand short of the door: 1.32 to 1.44 m from its place
 *  against a test of 1.3, with four to six seconds of his haul clock unspent. He gave it up ('the furniture did not make it to the door') and took cover beside a
 *  carton that stood a step from the door. On: at his stand, with the clock he was given still running and the thing within his reach, his hands bring it the
 *  rest of the way before he is asked. Nothing else of the haul changes: the same clock ends it, the same test wedges it.
 *  A table of its own (difficulty.ts rewrites DIGIN from its defaults at every level change). OFF here and on the frozen stand (TPS_HAULHOME=1 raises it); the
 *  page puts it on (host/profile.ts; ?nohaulhome = the haul as it was). tools/qa/haulhome-check.ts */
export const HAULHOME = { on: false };
export const DIGIN_STATS = {
  heard: 0, far: 0, dug: 0, moved: 0, stayed: 0, hauls: 0, /** braceInRoom: props pushed from beside (the spot behind was not his room's) · props passed over for it */ braceBeside: 0, bracePassed: 0, braced: 0, kicked: 0, pulledTo: 0, radio: 0, shouts: 0, scrapes: 0, callouts: 0, noRally: 0, aborted: 0, caught: 0, steady: 0, tried: 0, deep: 0, bangCalls: 0, gathered: 0, gatherLost: 0,
  /** men of a press / last men who fell back INTO a dug-in room (pressure.ts's fall-back seam) */
  refuge: 0,
  /** DIGIN.lanes: set men who left a spot in a covered lane for another of their room · who found none and stayed */
  laneMoved: 0, laneKept: 0,
  /** rooms that dug in · of them, entered by the team · with a cue before the first step in · with every living man of the room set by then · with a man still at his furniture / door by then */
  rooms: 0, entered: 0, cueFirst: 0, readyFirst: 0, halfReady: 0,
  /** which cue had come by the first step in (a room can have several) */
  cueRadio: 0, cueShout: 0, cueScrape: 0, cueTried: 0, cueKick: 0,
  /** doors still wedged when the team first stepped into their room's fight (found shut and blocked), seconds from a room's first word of the team to its first man in (summed) and to every man set (summed, over readyN rooms) */
  wedgedAtEntry: 0, knowToEntry: 0, knowToReady: 0, readyN: 0,
  /** doors a man would have wedged but passed over for the way they swing: they open away from him, and furniture on his side holds nothing (doors.ts wedgeHolds) */
  opensAway: 0,
  /** …and wedges that WERE put on a door that opens away from the man who put it there (counted whatever the switch says: with the rule on this stays 0) */
  wedgedAway: 0,
};
export const DIGIN_LOG: { t: number; who: string; what: string }[] = [];
/** DIGIN.shutOpen's own counts: leaves pushed home the last of the way · that latched under a hand past the old 2.5 s · pulled again after something stopped
 *  them · other doors of a room gone to · leaves let be unlatched */
export const DIGIN_SHUT = { home: 0, held: 0, again: 0, more: 0, left: 0 };

const LS_KEY = 'twopointsix.digin';
const KEPT = ['on', 'stay', 'cover', 'brace', 'doors', 'radio', 'deep', 'far', 'learn', 'gather', 'steady', 'holdSet', 'refuge', 'keeper', 'shutOpen'] as const;
const KEPT_NUM = ['wedges', 'pace', 'reachM'] as const;   // (the sliders the panel has)
const NUM_MAX = { wedges: 3, pace: 3, reachM: 60 } as const;
export function saveDigIn() { try { const out: Record<string, boolean | number> = {}; for (const k of KEPT) out[k] = DIGIN[k]; for (const k of KEPT_NUM) out[k] = DIGIN[k]; localStorage.setItem(LS_KEY, JSON.stringify(out)); } catch { /* no storage: nothing to keep */ } }
export function loadDigIn() {
  try { const j = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null'); if (j && typeof j === 'object') { for (const k of KEPT) { const v = (j as Record<string, unknown>)[k]; if (typeof v === 'boolean') DIGIN[k] = v; } for (const k of KEPT_NUM) { const v = (j as Record<string, unknown>)[k]; if (typeof v === 'number' && Number.isFinite(v)) DIGIN[k] = Math.min(NUM_MAX[k], Math.max(0, v)); } } } catch { /* nothing stored */ }
  try { if (new URLSearchParams(location.search).has('digin')) DIGIN.on = true; } catch { /* no page (the harness) */ }   // ?digin: on for the visit
}
export function resetDigIn() { Object.assign(DIGIN, JSON.parse(JSON.stringify(DIGIN_DEFAULTS))); try { localStorage.removeItem(LS_KEY); } catch { /* none */ } }
loadDigIn();

// ---------------------------------------------------------------- the room fight, as much of it as this file reads (roomfight.ts keeps these private; mirrored)
interface Entry { door: Door; at: Vec3; out: [number, number] }
interface Room { id: number; cells: Set<number>; entries: Entry[] }
interface Def {
  gd: Guard; station: Vec3; room: Room | null; ev: number[]; watch: number; want: number; glanceNext: number; glanceUntil: number;
  noiseAt: Vec3 | null; noiseT: number; noiseOut: boolean; mode: 'hold' | 'move' | 'free'; rallyAt: number; rallyGo: boolean; moveKind: 'fallback' | 'cover'; moveT: number; cameBy: Door | null; stallAt: Vec3; stallT: number;
}
interface Fight { g: Game; defs: Def[]; ops: { gd: Guard }[]; inRoom(R: Room | null, p: Vec3): boolean; freeNear(p: Vec3): Vec3 | null; note(gd: Guard | null, what: string): void }

type Phase = 'idle' | 'think' | 'toRoom' | 'toProp' | 'haul' | 'toDoor' | 'shut' | 'wedge' | 'toCover' | 'set';
interface Man { far: boolean; owe: number; haulBy: number; deep: boolean; look: Vec3 | null; triedDeep: boolean; gathered: boolean; gatherTo: Room | null; dugOnce: boolean; /** laststand.ts told him to (it says its own lines) */ ordered: boolean; phase: Phase; until: number; know: Vec3; knowT: number; room: Room | null; entry: number; brace: number; prop: Prop | null; stand: Vec3; rest: Vec3; scrapeT: number; setAt: number; spot: Vec3 | null; kept: boolean }
type Cue = 'radio' | 'shout' | 'scrape' | 'tried' | 'kick';
interface RoomSt { room: Room; expected: number; second: number; at: number; t0: number; men: Guard[]; bracer: Guard | null; wedged: number; cueAt: number; cues: Set<Cue>; enteredAt: number; readyAt: number; callout: boolean }
interface St { men: WeakMap<Guard, Man>; rooms: Map<Room, RoomSt>; wedges: Map<Door, { keySide: 1 | -1; lockId: string; kicked: boolean; tried: boolean; byT: number }>; fix: { at: Vec3; t: number; room: Room | null; heard: boolean } | null; called: WeakSet<Guard>; used: Set<Prop>; away: Set<Door>; frameT: number; bangCall: number }
const states = new SideMap<Game, St>('digin.states');
const stateOf = (g: Game): St => { let s = states.get(g); if (!s) { s = { men: new SideMap(), rooms: new Map(), wedges: new Map(), fix: null, called: new SideSet(), used: new Set(), away: new Set(), frameT: -1, bangCall: NaN }; states.set(g, s); } return s; };

const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const pick = (r: [number, number]) => r[0] + simRandom() * (r[1] - r[0]);
const paced = (r: [number, number]) => pick(r) * Math.max(0.1, DIGIN.pace);
const oneOf = <T>(a: T[]): T => a[Math.floor(simRandom() * a.length)] ?? a[0];
const at = (p: Vec3, y: number): Vec3 => [p[0], y, p[2]];
function log(F: Fight, gd: Guard | null, what: string) { DIGIN_LOG.push({ t: F.g.time, who: gd ? gd.callsign : '-', what }); if (DIGIN_LOG.length > 400) DIGIN_LOG.splice(0, 150); F.note(gd, `dig-in: ${what}`); }

// ---------------------------------------------------------------- who can hear it (Sam and the living teammates: the cue is only a cue if it reaches them)
function listeners(F: Fight): { gd: Guard | null; head: Vec3 }[] {
  const g = F.g, out: { gd: Guard | null; head: Vec3 }[] = [];
  if (!g.player.down) out.push({ gd: null, head: at(g.player.char.pos, 1.6) });
  for (const O of F.ops) if (O.gd.state !== 'dead') out.push({ gd: O.gd, head: at(O.gd.char.pos, 1.6) });
  return out;
}
/** the nearest thing to an ear a sound of this reach gets to: the listener, or undefined (reach in metres of open air, cut by the propagation's carry) */
function heardBy(F: Fight, src: Vec3, reachM: number): { gd: Guard | null } | undefined {
  const g = F.g; let best: { gd: Guard | null } | undefined, bd = Infinity;
  for (const L of listeners(F)) { if (flat(src, L.head) > reachM) continue; const p = hearPath(g, at(src, 1.2), L.head); if (p.pathLen < reachM * p.carry && p.pathLen < bd) { bd = p.pathLen; best = L; } }
  return best;
}
/** … by the hearing model's law for door / furniture noise (guards.ts hearingCheck: level · (1 − d/12) · carry > 0.08) */
function heardNoise(F: Fight, src: Vec3, level: number): { gd: Guard | null } | undefined {
  const g = F.g; let best: { gd: Guard | null } | undefined, bd = Infinity;
  for (const L of listeners(F)) { if (flat(src, L.head) >= 12) continue; const p = hearPath(g, at(src, 0.5), L.head); if (level * Math.max(0, 1 - p.pathLen / 12) * p.carry > 0.08 && p.pathLen < bd) { bd = p.pathLen; best = L; } }
  return best;
}
function cue(F: Fight, R: RoomSt | null, kind: Cue) { if (!R || !isNaN(R.enteredAt)) return; R.cues.add(kind); if (isNaN(R.cueAt)) R.cueAt = F.g.time; }
/** a line of his out loud: said (bubble / log, as any bark) only when somebody on the team's side can hear it */
function shout(F: Fight, st: St, gd: Guard, text: string, R: RoomSt | null): boolean {
  if (heardBy(F, gd.char.pos, DIGIN.shoutM)) { F.g.say(gd, text); DIGIN_STATS.shouts++; cue(F, R, 'shout'); log(F, gd, `shouts (heard): ${text}`); return true; }
  log(F, gd, `shouts (nobody to hear it): ${text}`); return false;
}

// ---------------------------------------------------------------- which door will they come by
function pathLen(from: Vec3, path: Vec3[]): number { let L = 0, q = from; for (const w of path) { L += flat(q, w); q = w; } return L; }
/** how far it is on foot from `a` to `b` (∞: no way found) */
function wayTo(F: Fight, a: Vec3, b: Vec3): number { const p = F.freeNear(a) ?? a, q = F.freeNear(b) ?? b; const path = F.g.col.nav.findPath(p, q, 6000); return path ? pathLen(p, path) : Infinity; }
/** entries of the room by the length of the way round from `from` to their far side, never through the room itself; [expected, second or -1] */
function expectEntries(F: Fight, room: Room, from: Vec3): [number, number] {
  const nav = F.g.col.nav; const src = F.freeNear(from) ?? from;
  const dear = (ix: number, iz: number) => room.cells.has(nav.idx(ix, iz)) ? 30 : 1;
  const L = room.entries.map(e => {
    const o = F.freeNear([e.at[0] + e.out[0] * 1.2, 0, e.at[2] + e.out[1] * 1.2]); if (!o) return Infinity;
    const path = nav.findPath(src, o, 6000, dear); if (!path) return Infinity;
    let through = 0; for (const w of path) if (F.inRoom(room, w)) through++;
    return pathLen(src, path) + through * 6;
  });
  if (!L.some(Number.isFinite)) room.entries.forEach((e, i) => { L[i] = flat(e.at, from) * 1.5; });   // (no way found at all: the nearest door, as the room fight itself reckons)
  const idx = L.map((_, i) => i).sort((a, b) => L[a] - L[b]);
  const first = idx[0] ?? -1, second = idx.length > 1 && L[idx[1]] - L[first] < DIGIN.altM ? idx[1] : -1;
  return [first, second];
}

// ---------------------------------------------------------------- where to hold it from
function coverSpot(F: Fight, st: St, D: Def, M: Man, R: RoomSt, deep: boolean): { spot: Vec3 | null; here: boolean; look: Vec3 | null } {
  const g = F.g, nav = g.col.nav, col = g.col, room = R.room, E = room.entries, e = E[M.entry], c = D.gd.char; if (!e) return { spot: null, here: false, look: null };
  const Fr = frameOf(e.door); const n: [number, number] = [-e.out[0], -e.out[1]];
  const I: Vec3 = [e.at[0] + n[0] * 0.5, 1.2, e.at[2] + n[1] * 0.5];
  // DEEP: where a can thrown in at the door goes off (a stride and a half in, low and at head height), and the floor the men behind it must cross
  const B: Vec3[] = [[e.at[0] + n[0] * 1.6, 0.5, e.at[2] + n[1] * 1.6], [e.at[0] + n[0] * 1.6, 1.6, e.at[2] + n[1] * 1.6], [e.at[0] + n[0] * 2.4, 1.2, e.at[2] + n[1] * 2.4]];
  const K: Vec3[] = []; for (const f of [3, 4.5]) for (const l of [-2.2, 0, 2.2]) { const k: Vec3 = [e.at[0] + n[0] * f + Fr.ux * l, 1.2, e.at[2] + n[1] * f + Fr.uz * l]; if (F.inRoom(room, k) && !nav.isBlocked(k[0], k[2])) K.push(k); }
  const outs: Vec3[] = [[e.at[0] + e.out[0] * 1.6, 1.5, e.at[2] + e.out[1] * 1.6], [e.at[0] + e.out[0] * 1.3 + Fr.ux, 1.5, e.at[2] + e.out[1] * 1.3 + Fr.uz], [e.at[0] + e.out[0] * 1.3 - Fr.ux, 1.5, e.at[2] + e.out[1] * 1.3 - Fr.uz]];
  const others = E.map((x, i) => i === M.entry ? null : { I: [x.at[0] - x.out[0] * 0.5, 1.2, x.at[2] - x.out[1] * 0.5] as Vec3, O: [x.at[0] + x.out[0] * 1.6, 1.5, x.at[2] + x.out[1] * 1.6] as Vec3 }).filter(x => x) as { I: Vec3; O: Vec3 }[];
  const mates = F.defs.filter(X => X !== D && X.gd.state !== 'dead' && X.room === room).map(X => { const m = st.men.get(X.gd); return { p: m?.spot ?? X.station, entry: m && m.phase !== 'idle' ? m.entry : -1 }; });
  const alone = mates.length === 0;
  const sideOf = (p: Vec3) => Math.sign(n[0] * (p[2] - I[2]) - n[1] * (p[0] - I[0]));
  // (`hope`: no line is asked — the score the place would have if every one of them came out its best way, which no real answer can beat: each line only ever
  // adds to the sum when it falls that way, and the sum is the same additions in the same order. What the search below uses to leave most of a room unasked.
  // `bar`: the search's fifth-best so far — a place whose lines to the DOOR are answered, then its lines from OUTSIDE, and whose best case for what is left still
  // falls short of it is given up there.)
  const score = (p: Vec3, self: boolean, hope = false, bar = -Infinity): number | null => {
    const d = flat(p, I); if (!self && (d < 2.2 || d > (deep || DIGIN.far ? 12 : 10))) return null;
    if (!hope && DIGIN.lanes && laneCovers(g, D.gd, p)) return self ? -5 : null;   // in the line of guns his side knows of: no spot to hold a door from
    if (!hope && !self && DIGIN.lanes) {                                           // (… nor is a spot whose last stride is: a walk counts as arrived a stride short of its mark)
      const dx = c.pos[0] - p[0], dz = c.pos[2] - p[2], L = Math.hypot(dx, dz);
      if (L > 0.3 && laneCovers(g, D.gd, [p[0] + dx / L * 0.3, p[1], p[2] + dz / L * 0.3])) return null;
    }
    let s: number;
    if (deep) {
      const eye = at(p, 1.6);
      if (!hope && (!col.segmentBlocked(eye, I) || B.some(b => !col.segmentBlocked(b, eye)))) return self ? -5 : null;   // off the door's line: neither the doorway nor a can gone off just inside it sees his eyes
      let sees = 0; if (hope) sees = K.length; else for (const k of K) if (!col.segmentBlocked(at(p, 1.5), k)) sees++;
      if (!hope && sees < 2) return self ? -5 : null;                             // … and the floor they must cross IS in his sights
      s = 0.4 * sees + 0.5 * Math.max(0, 1 - Math.abs(d - 5) / 5);
    } else {
      if (!hope && col.segmentBlocked(at(p, 1.5), I)) return self ? -5 : null;    // he must SEE the doorway from there
      s = DIGIN.far ? 0.9 * Math.min(1, d / 9) + (flat(p, B[1]) > 8.4 ? 0.8 : 0) : 0.8 * Math.max(0, 1 - Math.abs(d - 4.5) / 4.5);   // far: the back of the room — and past a stun canister's reach from the door, where the room is that long
    }
    let walls = 0; for (let a = 0; a < 8; a++) if (nav.isBlocked(p[0] + Math.cos(a * Math.PI / 4) * 0.6, p[2] + Math.sin(a * Math.PI / 4) * 0.6)) walls++;
    const back = Math.min(4, walls) * 0.15, cut = bar > -Infinity && !hope, far = cut ? 0.06 * flat(p, c.pos) : 0;
    if (cut) { const best = rest(p, self, outside(p, s, true), back, true); if (best === null || best - far < bar) return null; }
    s = outside(p, s, hope);
    if (cut) { const best = rest(p, self, s, back, true); if (best === null || best - far < bar) return null; }
    return rest(p, self, s, back, hope);
  };
  const outside = (p: Vec3, s: number, hope: boolean): number => { outs.forEach((o, k) => { if (hope || col.segmentBlocked(o, at(p, 1.2))) s += k === 0 ? 1.2 : 0.6; }); return s; };   // not seen from outside it: they have to come IN to find him
  const rest = (p: Vec3, self: boolean, s: number, back: number, hope: boolean): number | null => {
    s += back;                                                                    // something at his back
    for (const o of others) {
      if (flat(p, o.I) < 2) s -= 1.5;                                             // not in front of another door
      else if (alone && (hope || !col.segmentBlocked(at(p, 1.5), o.I))) s += 0.7; // alone in a room with two ways in: a spot that sees both
      if (!hope && !col.segmentBlocked(o.O, at(p, 1.2))) s -= 0.5;
    }
    for (const m of mates) { if (!self && flat(p, m.p) < 1.6) return null; if (m.entry === M.entry && sideOf(p) === sideOf(m.p)) s -= 0.6; }   // crossfire: the other side of the opening from a mate on the same door
    return s;
  };
  /** deep: the middle of the crossing floor he has in his sights from `p` — where his gun rests */
  const lookFrom = (p: Vec3): Vec3 | null => { if (!deep) return null; let x = 0, z = 0, k = 0; for (const q of K) if (!col.segmentBlocked(at(p, 1.5), q)) { x += q[0]; z += q[2]; k++; } return k ? [x / k, 0, z / k] : null; };
  const here = score(c.pos, true) ?? -5;
  // ONLY THE FIVE BEST PLACES ARE EVER TRIED (below), and scoring a place is up to a dozen sight lines: a big room asked whole was thousands of them in the one
  // frame a man picks his spot, and every man of the room picks in the same second. So each free cell first gets its HOPE (no lines, see score), the cells are
  // taken best hope first, and the asking stops once five real scores stand at or above every hope still unasked: no cell left could be among the five, nor tie
  // with the fifth. The five, their scores and their order (best first, the room's own cell order between equals — what the stable sort of the whole list gave)
  // are what they were; the lines not asked are questions, nothing more (col.segmentBlocked writes nothing).
  const pre: { p: Vec3; n: number; hope: number }[] = []; let nth = 0;
  for (const ci of room.cells) {
    const p: Vec3 = [((ci % nav.W) + 0.5) * nav.cell, 0, (((ci / nav.W) | 0) + 0.5) * nav.cell];
    if (nav.isBlocked(p[0], p[2])) continue;
    const n = nth++, h = score(p, false, true); if (h === null) continue;
    pre.push({ p, n, hope: h - 0.06 * flat(p, c.pos) });
  }
  pre.sort((a, b) => b.hope - a.hope);
  const cand: { p: Vec3; s: number; n: number }[] = [], top: number[] = []; let fifth = -Infinity;   // (top: the five best real scores so far, best first)
  for (const q of pre) {
    if (top.length >= 5 && q.hope < fifth) break;
    const s0 = score(q.p, false, false, fifth); if (s0 === null) continue;
    const s = s0 - 0.06 * flat(q.p, c.pos); cand.push({ p: q.p, s, n: q.n });
    let k = top.length; while (k > 0 && top[k - 1] < s) k--; if (k < 5) { top.splice(k, 0, s); if (top.length > 5) top.length = 5; if (top.length === 5) fifth = top[4]; }
  }
  cand.sort((a, b) => b.s - a.s || a.n - b.n);
  for (const k of cand.slice(0, 5)) {
    if (k.s <= here + DIGIN.better) break;
    const path = nav.findPath(c.pos, k.p); if (!path?.length) continue;
    const last = path[path.length - 1]; if (flat(last, k.p) > 0.8 || pathLen(c.pos, path) > 18) continue;
    if (path.some(w => flat(w, e.at) < 0.9 || !F.inRoom(room, w) && flat(w, k.p) > 0.8)) continue;   // never by way of the doorway, nor out of the room
    return { spot: k.p, here: here > -5, look: lookFrom(k.p) };
  }
  return { spot: null, here: here > -5, look: here > -5 ? lookFrom(c.pos) : null };
}

/** his side has met a stun canister: his own ears, or the word on the net a second after the first man to hear one said so */
function knowsBangs(F: Fight, st: St, D: Def): boolean {
  return D.gd.witness.heard.bang > 0 || (DIGIN.radio && !isNaN(st.bangCall) && F.g.time - st.bangCall > 1);
}
/** off the door's line: every second man of the room to dig in (depth), or everybody once the word is they throw flashbangs (learn) */
function wantsDeep(F: Fight, st: St, D: Def, R: RoomSt): boolean {
  if (DIGIN.learn && knowsBangs(F, st, D)) return true;
  return DIGIN.deep && R.men.filter(m => m.state !== 'dead').indexOf(D.gd) % 2 === 1;
}

// ---------------------------------------------------------------- moving (the room fight's own 'move' mode: his script's legs, his own senses, planted on arrival or contact)
function move(F: Fight, D: Def, goal: Vec3, speed: number) {
  const gd = D.gd, c = gd.char;
  D.mode = 'move'; D.moveKind = 'fallback'; D.cameBy = null; D.moveT = 0; D.stallAt = v3.copy(c.pos); D.stallT = 0; gd.pinned = false;   // ('fallback': planted without cover's breath of head-down — he is not under fire)
  order(gd, { goal, speed, face: null, strafe: false, aimAt: null, upper: 'aim', stance: 'none', crouch: false });
}
function fear(D: Def, M: Man) { if (M.entry >= 0 && M.entry < D.ev.length) D.ev[M.entry] = Math.max(D.ev[M.entry], DIGIN.fear); }

function nearestProp(F: Fight, st: St, D: Def, e: Entry, skip?: Set<Prop>): Prop | null {
  const g = F.g, c = D.gd.char; let best: Prop | null = null, bd = Infinity;
  for (const p of g.props.props) {
    if (st.used.has(p) || skip?.has(p)) continue; const pp: Vec3 = [p.x, 0, p.z];
    if (!F.inRoom(D.room, pp) && !(F.freeNear(pp) && F.inRoom(D.room, F.freeNear(pp)!))) continue;
    const a = flat(c.pos, pp), b = flat(pp, e.at); if (a > DIGIN.propM || b > DIGIN.propM) continue;
    if (a + b < bd) { bd = a + b; best = p; }
  }
  return best;
}
function scrape(F: Fight, st: St, gd: Guard, M: Man, R: RoomSt | null, thud = false) {
  const g = F.g, p = M.prop!; const pos: Vec3 = [p.x, 0.3, p.z]; const level = thud ? Math.min(1, DIGIN.scrapeLevel + 0.1) : DIGIN.scrapeLevel;
  g.audio.play(thud ? 'propThud' : 'propScrape', pos, thud ? 0.6 : 0.5, { rate: (thud ? p.tune.thudRate : p.tune.scrapeRate) * (0.95 + simRandom() * 0.1) });
  g.events.push({ kind: 'prop', pos: [p.x, 0, p.z], time: g.time, loud: false, level, who: gd.char.id });   // (heard like any shoved furniture: blamed on him, so his own side ignore it)
  DIGIN_STATS.scrapes++;
  const L = heardNoise(F, pos, level); if (!L) return;
  cue(F, R, 'scrape');
  if (L.gd && R && !R.callout) { R.callout = true; DIGIN_STATS.callouts++; g.say(L.gd, oneOf(['movement inside. they\'re blocking the door.', 'furniture moving in there. they know we\'re coming.']), true); log(F, L.gd, 'calls the furniture he hears'); }
}
function wedge(F: Fight, st: St, D: Def, M: Man, R: RoomSt, e: Entry) {
  const g = F.g, d = e.door; const mut = d as unknown as { keySide: 1 | -1; lockId: string };
  if (!st.wedges.has(d)) st.wedges.set(d, { keySide: d.keySide, lockId: d.lockId, kicked: false, tried: false, byT: NaN });
  mut.keySide = g.doors.side(d, [e.at[0] + e.out[0] * 0.8, 0, e.at[2] + e.out[1] * 0.8]); mut.lockId = `wedge:${d.def.name}`;   // locked against the FAR face, to a lock no ring fits
  d.locked = true; d.pick = 0; R.wedged++;
  if (!g.doors.pullFace(d, [e.at[0] - e.out[0] * 0.8, 0, e.at[2] - e.out[1] * 0.8])) DIGIN_STATS.wedgedAway++;
  DIGIN_STATS.braced++; scrape(F, st, D.gd, M, R, true); log(F, D.gd, `wedges ${d.def.name}`);
}
const wedgeable = (g: Game, d: Door) => !d.def.steel && !d.locked && !d.lockBroken && !d.def.locked && !g.devices?.padOf(d);
/** where his own ears last put them (never where they ARE) */
const heardAt = (D: Def, M: Man): Vec3 => D.noiseAt && D.noiseOut && D.noiseT > M.knowT ? D.noiseAt : M.know;

// ---------------------------------------------------------------- doors that stay where they are left (DIGIN.shutOpen)
/** the rule is live: its own switch, and leaves that stay as they are left (Doors.stay: DOORSTAY, and no showcase on the stage) */
const shutsOpen = (g: Game) => DIGIN.shutOpen && g.doors.stay;
/** (its own fields on a man, all unread with the rule off: the OTHER door of his room he has gone to shut — an entry's index, -1 / unset = none —, how many
 *  such he has gone to this time, when his hand took the leaf it is on and when it last pulled) */
interface Man { /** DIGIN.noticed: since when he has had them in his eyes without a break */ eyesT?: number; /** DIGIN.lanes: not asked for a spot out of a covered lane before this */ laneT?: number; also?: number; alsoN?: number; /** HAULHOME: the haul (by its clock) whose last hand he is bringing · how far it was from its place when last it had gained, and when */ homeT?: number; homeD?: number; homeAt?: number; handT?: number; pullT?: number; pushes?: number; pullA?: number; stalls?: number }
/** the entry whose door his hands are on, or he is on his way to: the one he braces, the other door he went to shut, else his own */
const doorOf = (g: Game, M: Man): number => M.brace >= 0 ? M.brace : shutsOpen(g) && (M.also ?? -1) >= 0 ? M.also! : M.entry;
/** seconds a hand waits on a pulled leaf for its latch */
const latchSecs = (g: Game) => shutsOpen(g) ? DIGIN.shutSecs : 2.5;
/** his hand goes on the leaf: pulled to, the wait begun */
function handOn(F: Fight, D: Def, M: Man, d: Door) {
  const g = F.g; g.doors.pullTo(d, D.gd.char.id); DIGIN_STATS.pulledTo++; M.phase = 'shut'; M.until = g.time + latchSecs(g); M.handT = M.pullT = g.time; M.pushes = 0; M.pullA = Math.abs(d.angle); M.stalls = 0;
}
/** …and stays on it: true = still waiting for the latch. A one-way leaf nearly home is pushed the rest of the way (it comes to on its frame; a double-acting
 *  one would be sent through, and is waited for); a leaf something stopped (a touch ends a pull) is pulled again, twice at most with nothing gained; a breath
 *  between any two. One off its hinges is nothing to wait for */
function handWaits(F: Fight, D: Def, M: Man, d: Door): boolean {
  const g = F.g; if (d.latched || g.time > M.until) return false;
  if (!shutsOpen(g)) return true;
  if (d.off) return false;
  if (g.time - (M.pullT ?? -100) <= 0.6) return true;
  if (!d.closing) {
    const a = Math.abs(d.angle); M.stalls = a > (M.pullA ?? 9) - 0.03 ? (M.stalls ?? 0) + 1 : 0; M.pullA = a;
    if (M.stalls >= 2) return false;                                               // (pulled twice and it has not come an inch: something is in its way — furniture, a body — and he does not stand there shoving it)
    g.doors.pullTo(d, D.gd.char.id); M.pullT = g.time; DIGIN_SHUT.again++; log(F, D.gd, `pulls ${d.def.name} again`);
  }
  else if ((d.minA === 0 || d.maxA === 0) && Math.abs(d.angle) < DIGIN.shutHomeRad && Math.abs(d.angle) > 0.012 && (M.pushes ?? 0) < 4) { g.doors.pullTo(d, D.gd.char.id); M.pullT = g.time; M.pushes = (M.pushes ?? 0) + 1; DIGIN_SHUT.home++; }   // (a leaf already on its frame, or lying on a body, is not shoved again and again)
  return true;
}
/** they are at a door of his room by the sound of it — shut or open: no time for errands, he takes cover */
const atADoor = (D: Def, M: Man, R: RoomSt) => { const heard = heardAt(D, M); return R.room.entries.some(e => flat(heard, e.at) <= DIGIN.closeM); };
/** the nearest OTHER door of his room that stands open with nobody's hand on it: he goes to pull it to. False = none (or the rule is off): to cover.
 *  `not`: the entry he has just had his hand on */
function shutMore(F: Fight, st: St, D: Def, M: Man, R: RoomSt, not: number): boolean {
  const g = F.g; if (!shutsOpen(g) || !DIGIN.doors || (M.alsoN ?? 0) >= DIGIN.shutDoors || atADoor(D, M, R)) return false;
  const E = R.room.entries, c = D.gd.char, from = F.freeNear(c.pos) ?? c.pos;
  const taken = (i: number) => F.defs.some(X => { if (X === D || X.gd.state === 'dead' || X.room !== R.room) return false; const m = st.men.get(X.gd); return !!m && ['toProp', 'haul', 'toDoor', 'shut', 'wedge'].includes(m.phase) && doorOf(g, m) === i; });
  let best = -1, at: Vec3 | null = null, bd = 12;
  for (let i = 0; i < E.length; i++) {
    const e = E[i], d = e.door; if (i === not || d.latched || d.off || d.lockBroken || d.closing || Math.abs(d.angle) <= 0.05 || taken(i)) continue;
    const stand = F.freeNear([e.at[0] - e.out[0] * 1.2, 0, e.at[2] - e.out[1] * 1.2]); if (!stand || !F.inRoom(R.room, stand) || flat(c.pos, stand) >= bd) continue;
    const path = flat(from, stand) < 0.5 ? [stand] : g.col.nav.findPath(from, stand, 6000); if (!path?.length) continue;
    if (path.some(w => !F.inRoom(R.room, w) && flat(w, stand) > 0.8 && flat(w, from) > 0.8)) continue;   // (findPath hands back corners: the room is asked at each)
    best = i; at = stand; bd = flat(c.pos, stand);
  }
  if (best < 0 || !at) return false;
  M.also = best; M.alsoN = (M.alsoN ?? 0) + 1; M.brace = -1; M.prop = null; M.stand = at; M.phase = 'toDoor'; move(F, D, at, g.tune.guardChase);
  DIGIN_SHUT.more++; log(F, D.gd, `goes to shut ${E[best].door.def.name} as well`);
  return true;
}

/** braceInRoom: `to` is his room's floor and the way to it from `from` does not leave the room (findPath hands back corners: each is asked) */
function wayInRoom(F: Fight, room: Room, from: Vec3, to: Vec3): boolean {
  if (!F.inRoom(room, to)) return false;
  const path = F.g.col.nav.findPath(F.freeNear(from) ?? from, to, 6000); if (!path?.length) return false;
  return path.every(w => F.inRoom(room, w) || flat(w, to) < 0.8 || flat(w, from) < 0.8);
}
/** braceInRoom: he can push this prop to the door from `q` without leaving his room — q is within reach of it with nothing solid between (not the far side
 *  of a wall or a counter), he gets to q inside the room, and the haul from q to his stand at the door stays inside it too */
function pushable(F: Fight, D: Def, room: Room, pp: Vec3, q: Vec3, stand: Vec3): boolean {
  return flat(q, pp) < 1.6 && !F.g.col.solidBlocked([q[0], 0.45, q[2]], [pp[0], 0.45, pp[2]]) && wayInRoom(F, room, D.gd.char.pos, q) && wayInRoom(F, room, q, stand);
}
/** braceInRoom: the best place in his room to push this prop toward the door from — free floor within arm's reach of it, as nearly behind it as the room has
 *  (never on the door's side of it: the haul keeps the furniture a pace AHEAD of him, and a carton that starts behind him trails him to the door and stops
 *  short). null = none (the prop sits in a pocket where only the far side of a wall is behind it) */
function pushSpot(F: Fight, D: Def, room: Room, e: Entry, pp: Vec3, stand: Vec3): Vec3 | null {
  const nav = F.g.col.nav; const dx = pp[0] - e.at[0], dz = pp[2] - e.at[2], dl = Math.hypot(dx, dz) || 1;
  const cand: { p: Vec3; s: number }[] = [];
  for (const r of [0.7, 1.0, 1.3]) for (let a = 0; a < 12; a++) {
    const ux = Math.cos(a * Math.PI / 6), uz = Math.sin(a * Math.PI / 6), q: Vec3 = [pp[0] + ux * r, 0, pp[2] + uz * r];
    const behind = (ux * dx + uz * dz) / dl; if (behind < 0.25 || nav.isBlocked(q[0], q[2]) || !F.inRoom(room, q)) continue;
    cand.push({ p: q, s: behind - 0.3 * (r - 0.7) });                             // behind it first, near it second
  }
  cand.sort((a, b) => b.s - a.s);
  for (const k of cand.slice(0, 6)) if (pushable(F, D, room, pp, k.p, stand)) return k.p;
  return null;
}

// ---------------------------------------------------------------- the phases
/** furniture for entry `idx` of his room: off to the prop (then hauled, then worked under the door). false = nothing to haul / no time / not that kind of door */
function startBrace(F: Fight, st: St, D: Def, M: Man, R: RoomSt, idx: number): boolean {
  const g = F.g, e = R.room.entries[idx]; if (!DIGIN.brace || R.wedged >= DIGIN.wedges || !e || !wedgeable(g, e.door) || st.wedges.has(e.door) || !(squadMayWedge(g, D.gd, e.door) || lastStandMan(g, D.gd))) return false;   // (laststand.ts: the last stand wedges any door of its room)
  if (flat(heardAt(D, M), e.at) < DIGIN.closeM) return false;                     // they are at that door by the sound of it: no time for furniture
  let p = nearestProp(F, st, D, e);
  const stand = F.freeNear([e.at[0] - e.out[0] * 1.4, 0, e.at[2] - e.out[1] * 1.4]);
  if (!p || !stand || !F.inRoom(R.room, stand)) return false;
  let pp: Vec3 = [p.x, 0, p.z]; const dx = pp[0] - e.at[0], dz = pp[2] - e.at[2], dl = Math.hypot(dx, dz) || 1;
  let goal = F.freeNear([pp[0] + dx / dl * 0.7, 0, pp[2] + dz / dl * 0.7]) ?? F.freeNear(pp);   // behind it, to push it toward the door
  if (DIGIN.braceInRoom) {                                                          // THE GOAL RULE: he pushes it from inside his own room, gets there without leaving it, and hauls it to the door inside it
    const passed = new Set<Prop>();
    for (;;) {
      if (goal && pushable(F, D, R.room, pp, goal, stand)) break;
      const behind = pushSpot(F, D, R.room, e, pp, stand);
      if (behind) { goal = behind; DIGIN_STATS.braceBeside++; log(F, D.gd, `takes ${p.def.name} from the nearest floor of room ${R.room.id} behind it`); break; }
      passed.add(p); DIGIN_STATS.bracePassed++; log(F, D.gd, `leaves ${p.def.name}: no floor of room ${R.room.id} to push it from`);
      const q = passed.size < 3 ? nearestProp(F, st, D, e, passed) : null; if (!q) return false;   // (the two next nearest, then none: no furniture — the door is shut and covered instead)
      p = q; pp = [p.x, 0, p.z]; const qx = pp[0] - e.at[0], qz = pp[2] - e.at[2], ql = Math.hypot(qx, qz) || 1;
      goal = F.freeNear([pp[0] + qx / ql * 0.7, 0, pp[2] + qz / ql * 0.7]) ?? F.freeNear(pp);
    }
  }
  if (!goal) return false;
  if (lastStandMan(g, D.gd) && !F.inRoom(R.room, goal)) return false;   // (laststand.ts: a man of the last stand does not leave its room for furniture)
  R.bracer = D.gd; M.brace = idx; M.prop = p; st.used.add(p); M.stand = stand; M.rest = [e.at[0] - e.out[0] * 0.6, 0, e.at[2] - e.out[1] * 0.6];
  M.phase = 'toProp'; DIGIN_STATS.hauls++; move(F, D, goal, g.tune.guardChase);
  return true;
}
/** DOUBLE UP: alone in his room — the room of his side's with the most men still holding it, away from the noise, that he can run to without passing it */
function gatherTo(F: Fight, st: St, D: Def, M: Man): { room: Room; spot: Vec3 } | null {
  const g = F.g, nav = g.col.nav, c = D.gd.char, hold = (X: Def) => X.gd.state !== 'dead' && X.mode === 'hold' && g.time - X.gd.lastSeenT > 3;
  if (F.defs.some(X => X !== D && X.room === D.room && X.gd.state !== 'dead')) return null;   // (not alone: he has a mate to dig in with)
  const rooms = new Map<Room, Def[]>();
  for (const X of F.defs) { if (X === D || !X.room || X.room === D.room || !X.room.entries.length || !hold(X)) continue; if (F.inRoom(X.room, M.know) || !isNaN(st.rooms.get(X.room)?.enteredAt ?? NaN)) continue; (rooms.get(X.room) ?? rooms.set(X.room, []).get(X.room)!).push(X); }
  const mine = flat(c.pos, M.know); let best: { room: Room; spot: Vec3; s: number } | null = null;
  const shy = (ix: number, iz: number) => Math.hypot((ix + 0.5) * nav.cell - M.know[0], (iz + 0.5) * nav.cell - M.know[2]) < DIGIN.gatherShyM + 2 ? 20 : 1;
  for (const [room, men] of rooms) {
    const X = men[0], far = flat(X.station, M.know);
    if (men.length < 2 && far < mine + 3) continue;                                // (one man to one man: only AWAY from them — two singles never swap rooms)
    const spot = F.freeNear([X.station[0] + (c.pos[0] > X.station[0] ? 1.2 : -1.2), 0, X.station[2]]) ?? F.freeNear(X.station); if (!spot || !F.inRoom(room, spot)) continue;
    const path = nav.findPath(c.pos, spot, 6000, shy); if (!path?.length) continue;
    if (pathLen(c.pos, path) > DIGIN.gatherM || path.some(w => flat(w, M.know) < DIGIN.gatherShyM)) continue;
    const s = men.length * 10 + far - pathLen(c.pos, path) * 0.2;
    if (!best || s > best.s) best = { room, spot, s };
  }
  return best;
}
function begin(F: Fight, st: St, D: Def, M: Man) {
  const g = F.g, gd = D.gd, room = D.room!;
  if (DIGIN.gather && !M.gathered) {
    M.gathered = true; const to = gatherTo(F, st, D, M);
    if (to) {
      M.gatherTo = to.room; M.room = null; M.phase = 'toRoom'; DIGIN_STATS.gathered++; move(F, D, to.spot, g.tune.guardChase);
      g.say(gd, oneOf([w('I\'m coming to you. hold that door for me!', 'i\'m coming to you. hold that door for me!'), 'falling back to you. don\'t shoot!']), true); log(F, gd, `leaves room ${room.id} for room ${to.room.id}`);
      for (const X of st.rooms.values()) cue(F, X, 'radio');
      return;
    }
  }
  let R = st.rooms.get(room); const first = !R;
  if (!R) { const [a, b] = expectEntries(F, room, M.know); R = { room, expected: a, second: b, at: g.time, t0: M.knowT, men: [], bracer: null, wedged: 0, cueAt: NaN, cues: new Set(), enteredAt: NaN, readyAt: NaN, callout: false }; st.rooms.set(room, R); DIGIN_STATS.rooms++; if (st.fix && g.time - st.fix.t < 20) cue(F, R, 'radio'); }
  else if (g.time - R.at > 4) { const [a, b] = expectEntries(F, room, M.know); R.expected = a; R.second = b; R.at = g.time; }
  if (R.expected < 0) { M.phase = 'idle'; return; }
  if (!R.men.includes(gd)) R.men.push(gd);
  const on = (i: number) => F.defs.filter(X => X !== D && X.gd.state !== 'dead' && X.room === room && (st.men.get(X.gd)?.phase ?? 'idle') !== 'idle' && st.men.get(X.gd)!.entry === i).length;
  M.room = room; M.entry = R.second >= 0 && on(R.expected) > on(R.second) ? R.second : R.expected; M.brace = -1; M.spot = null; fear(D, M);   // (the likeliest door first, then turn about)
  const e = room.entries[M.entry];
  log(F, gd, `digs in: room ${room.id}, expects ${room.entries[R.expected].door.def.name}${R.second >= 0 ? ' (or ' + room.entries[R.second].door.def.name + ')' : ''}, takes ${e.door.def.name}`);
  if (first && !M.ordered && !shout(F, st, gd, oneOf(['they\'re coming this way. get ready!', 'they\'re working through the rooms. watch that door!', 'that\'s next door. get set, get set!']), R) && DIGIN.radio) {
    g.say(gd, oneOf(['we hear it. getting ready for them here.', 'copy. we\'re digging in.', 'heard. they\'ll find this room ready.']), true); DIGIN_STATS.radio++; cue(F, R, 'radio');   // out of the team's earshot: the room says it on its side's net instead (their net is on the HUD's log)
  }
  // furniture against the door they will come by: one man of the room, if there is time and something to haul
  if (!R.bracer && M.entry === R.expected) {
    // …a door his furniture can hold (it opens toward him: `holds`). The one they are expected by; where THAT opens away from him and he would have wedged it
    // (`away`), the room's next door instead, in the order a first wedge is followed by (afterWedge) — a wedge the rule takes off one door goes on the next, and
    // a room that was not going to wedge still does not
    const first = room.entries[R.expected]; let braced = false;
    if (holds(g, first)) braced = startBrace(F, st, D, M, R, R.expected);
    else if (away(F, st, D, M, R, first)) for (const i of nextDoors(R)) if (holds(g, room.entries[i]) && startBrace(F, st, D, M, R, i)) { log(F, gd, `instead: ${room.entries[i].door.def.name}`); braced = true; break; }
    if (braced) { shout(F, st, gd, oneOf(['block that door. get something against it!', 'get that against the door!']), R); return; }
  }
  shutOrCover(F, st, D, M, R);
}
/** a wedge HOLDS this entry's door (THE HOLD TEST, doors.ts wedgeHolds: one predicate, asked from the inside of the entry — its `out` points out of his room): a
 *  wedge or a dragged desk on his side only stops a leaf that swings toward him; one that opens away is pulled open from outside whatever stands behind it */
const holds = (g: Game, e: Entry) => g.doors.wedgeHolds(e.door, [e.at[0] - e.out[0] * 0.8, 0, e.at[2] - e.out[1] * 0.8]);
/** …would he have gone to wedge this entry but for the way its door swings: startBrace's own first tests (a door a wedge is allowed on, time for it, furniture
 *  in reach, floor of his room to stand on at it), asked without starting anything — so the rule only ever moves a wedge that was going to be placed */
function wouldBrace(F: Fight, st: St, D: Def, M: Man, R: RoomSt, e: Entry): boolean {
  const g = F.g; if (!DIGIN.brace || R.wedged >= DIGIN.wedges || !wedgeable(g, e.door) || st.wedges.has(e.door) || !(squadMayWedge(g, D.gd, e.door) || lastStandMan(g, D.gd))) return false;
  if (flat(heardAt(D, M), e.at) < DIGIN.closeM || !nearestProp(F, st, D, e)) return false;
  const stand = F.freeNear([e.at[0] - e.out[0] * 1.4, 0, e.at[2] - e.out[1] * 1.4]); return !!stand && F.inRoom(R.room, stand);
}
/** …a door passed over for it: counted once a door, said in the log. True = it was (he would have wedged it) */
function away(F: Fight, st: St, D: Def, M: Man, R: RoomSt, e: Entry): boolean {
  if (!wouldBrace(F, st, D, M, R, e)) return false;
  if (!st.away.has(e.door)) { st.away.add(e.door); DIGIN_STATS.opensAway++; log(F, D.gd, `${e.door.def.name} opens away from him: nothing to wedge`); }
  return true;
}
/** the room's doors after the one they are expected by: the second-likeliest first, then as authored */
const nextDoors = (R: RoomSt): number[] => R.room.entries.map((_, i) => i).filter(i => i !== R.expected).sort((a, b) => (a === R.second ? -1 : 0) - (b === R.second ? -1 : 0));
/** his door standing open toward them: he goes to it and pulls it to — then to cover */
function shutOrCover(F: Fight, st: St, D: Def, M: Man, R: RoomSt) {
  const e = R.room.entries[M.entry], d = e.door;
  if (DIGIN.doors && !d.latched && Math.abs(d.angle) > 0.05 && !d.lockBroken && flat(heardAt(D, M), e.at) > DIGIN.closeM && !(shutsOpen(F.g) && d.off)) {   // (shutOpen: a door off its hinges is nothing to walk to and shut)
    const stand = F.freeNear([e.at[0] - e.out[0] * 1.2, 0, e.at[2] - e.out[1] * 1.2]);
    if (stand && F.inRoom(R.room, stand) && flat(D.gd.char.pos, stand) < 12) { M.brace = -1; M.prop = null; M.also = -1; M.stand = stand; M.phase = 'toDoor'; move(F, D, stand, F.g.tune.guardChase); log(F, D.gd, `goes to shut ${d.def.name}`); return; }
  }
  if (shutMore(F, st, D, M, R, -1)) return;                                         // (shutOpen: the room's other doors that stand open, before he takes cover)
  toCover(F, st, D, M, R);
}
// (`orStay` false: only if there is a spot to walk to — with none nothing of him is touched and the answer is false: a man asked to leave a line he cannot leave.)
function toCover(F: Fight, st: St, D: Def, M: Man, R: RoomSt, orStay = true): boolean {
  const g = F.g; const wantDeep = wantsDeep(F, st, D, R);
  const dp = DIGIN.cover && wantDeep ? coverSpot(F, st, D, M, R, true) : null;
  const deep = !!dp && (!!dp.spot || dp.here);                                                                      // (… or already standing off its line with the crossing in his sights)
  let p = dp?.spot ?? null; if (!deep) p = DIGIN.cover ? coverSpot(F, st, D, M, R, false).spot : null;
  if (!p && !orStay) return false;
  M.triedDeep = wantDeep; M.deep = deep; M.look = deep ? dp!.look : null;
  if (M.deep) { DIGIN_STATS.deep++; log(F, D.gd, 'keeps off the door\'s line'); }
  M.brace = -1; M.prop = null; fear(D, M);
  if (p) { M.spot = p; M.phase = 'toCover'; DIGIN_STATS.moved++; move(F, D, p, g.tune.guardChase); log(F, D.gd, `to cover on ${R.room.entries[M.entry].door.def.name}`); }
  else { DIGIN_STATS.stayed++; settle(F, D, M); }
  return true;
}
function settle(F: Fight, D: Def, M: Man) {
  M.phase = 'set'; M.setAt = F.g.time; M.also = -1; M.alsoN = 0; M.spot = v3.copy(D.gd.char.pos); if (!M.dugOnce) { M.dugOnce = true; DIGIN_STATS.dug++; }
  D.watch = D.want = M.entry; fear(D, M);
  log(F, D.gd, `set on ${M.room?.entries[M.entry]?.door.def.name ?? '?'}`);
}
const newMan = (): Man => ({ far: false, owe: 0, haulBy: 0, deep: false, look: null, triedDeep: false, gathered: false, gatherTo: null, dugOnce: false, ordered: false, phase: 'idle', until: 0, know: [0, 0, 0], knowT: -100, room: null, entry: -1, brace: -1, prop: null, stand: [0, 0, 0], rest: [0, 0, 0], scrapeT: -100, setAt: -100, spot: null, kept: false });
function drop(st: St, M: Man, gd?: Guard) {
  if (M.prop) { M.prop.vx = 0; M.prop.vz = 0; st.used.delete(M.prop); }          // (furniture left where it stands is somebody else's to haul)
  const R = M.room ? st.rooms.get(M.room) : null; if (R && gd && R.bracer === gd) R.bracer = null;
  M.prop = null; M.brace = -1; M.also = -1; M.alsoN = 0; M.phase = 'idle';
}
/** the team in his eyes while his hands were on the furniture / the door: the gun has to come up first */
function caught(F: Fight, D: Def, M: Man, what: string) { M.owe = pick(DIGIN.caught); DIGIN_STATS.caught++; DIGIN_STATS.aborted++; log(F, D.gd, `caught ${what}`); }   // (owed NEXT frame, on top of the beat the room fight gives him this one — its own is a max() that would swallow it)
/** one door wedged: the next likeliest while the room has furniture, doors and its quota left — else to cover */
function afterWedge(F: Fight, st: St, D: Def, M: Man, R: RoomSt) {
  M.prop = null; M.brace = -1;
  if (R.wedged < DIGIN.wedges) {
    const E = R.room.entries;
    for (const i of [R.expected, ...nextDoors(R)]) { if (!holds(F.g, E[i])) { away(F, st, D, M, R, E[i]); continue; } if (startBrace(F, st, D, M, R, i)) { log(F, D.gd, `next: ${E[i].door.def.name}`); return; } }
  }
  shutOrCover(F, st, D, M, R);
}

/** how near his stand he sets it down against the door (haul) — and inside which HAULHOME calls him 'at his stand' · how far from him his hands still have it */
const HAUL_NEAR = 0.9, HOME_REACH = 1.2;
/** HAULHOME: stopped at his stand with the thing a hand short of the door and his haul clock still running — his hands bring it the rest of the way.
 *  False = not that (the switch off, the clock out, it is out of his hands, the door no longer one a wedge holds) or it has stopped coming (half a second
 *  with nothing gained: caught on something): he is asked as he always was */
function bringsHome(F: Fight, st: St, D: Def, M: Man, R: RoomSt, e: Entry | undefined, p: Prop): boolean {
  const g = F.g, c = D.gd.char, pp: Vec3 = [p.x, 0, p.z];
  if (!HAULHOME.on || !e || g.time >= M.haulBy || flat(c.pos, M.stand) >= HAUL_NEAR || flat(pp, c.pos) > HOME_REACH || !wedgeable(g, e.door) || !holds(g, e)) return false;
  const d = flat(pp, M.rest);
  if (M.homeT !== M.haulBy) { M.homeT = M.haulBy; M.homeD = d; M.homeAt = g.time; log(F, D.gd, 'brings it the last of the way'); }
  else if (g.time - (M.homeAt ?? g.time) >= 0.5) { if (d > (M.homeD ?? d) - 0.03) return false; M.homeD = d; M.homeAt = g.time; }
  haul(F, st, D, M, R); return true;
}
/** hauling: the prop is kept a pace ahead of him on his way to the door, then set down against it */
function haul(F: Fight, st: St, D: Def, M: Man, R: RoomSt | null) {
  const g = F.g, c = D.gd.char, p = M.prop; if (!p || !g.props.props.includes(p)) return;
  if (g.time < M.haulBy) { D.moveT = Math.min(D.moveT, 5); D.stallT = 0; D.stallAt[0] = c.pos[0]; D.stallAt[2] = c.pos[2]; }   // a haul is slow on purpose: the room fight's ten seconds / 'going nowhere' are for a man running — this leg has its own clock (haulBy), after which those plant him
  const pp: Vec3 = [p.x, 0, p.z];
  let tx = M.stand[0] - c.pos[0], tz = M.stand[2] - c.pos[2]; const tl = Math.hypot(tx, tz);
  let want: Vec3;
  if (tl < HAUL_NEAR || flat(pp, M.rest) < 0.8) want = M.rest;
  else { tx /= tl; tz /= tl; want = [c.pos[0] + tx * 0.75, 0, c.pos[2] + tz * 0.75]; }
  let vx = (want[0] - p.x) / 0.2, vz = (want[2] - p.z) / 0.2; const vl = Math.hypot(vx, vz), cap = DIGIN.haulSpeed / Math.max(0.1, DIGIN.pace) * 1.6;
  if (vl > cap) { vx *= cap / vl; vz *= cap / vl; }
  if (flat(pp, c.pos) > 2.2) { vx = 0; vz = 0; }                                  // it has caught on something behind him: left where it is
  p.vx = vx; p.vz = vz; p.wake(); p.lastWho = c.id;
  if (Math.hypot(vx, vz) > 0.3 && g.time - M.scrapeT > DIGIN.scrapeEvery) { M.scrapeT = g.time; scrape(F, st, D.gd, M, R); }
}

/** roomfight.ts tickDef, every frame for every defender it runs (after the held check, before its own modes) */
export function digInTick(rf: unknown, def: unknown, _dt: number) {
  const F = rf as Fight, D = def as Def, g = F.g, gd = D.gd; if (gd.state === 'dead' || g.rescue?.active) return;   // (the hostage rescue has its own script for these men: nothing here runs in it)
  const st = stateOf(g);
  if (st.frameT !== g.time) { st.frameT = g.time; watch(F, st); }
  let M = st.men.get(gd);
  if (!M) { M = newMan(); st.men.set(gd, M); }
  const R = M.room ? st.rooms.get(M.room) ?? null : null;
  if (M.owe > 0) { gd.reactT += M.owe; M.owe = 0; }
  if (g.time - gd.lastSeenT >= 0.25) M.eyesT = undefined; else M.eyesT ??= g.time;
  if (D.mode === 'free') { if (M.phase !== 'idle') drop(st, M, gd); return; }
  if (D.mode === 'move') { if (M.phase === 'haul') { if (M.homeT === M.haulBy) { log(F, gd, 'was moved off his furniture'); drop(st, M, gd); } else haul(F, st, D, M, R); } return; }   // (HAULHOME: a man bringing the last hand in is planted — a leg another rule gives him then is not a haul, and the thing stays where it is)
  const dazzled = g.time < gd.dazzledUntil, contact = g.time - gd.lastSeenT < 3;
  // the word on the net: the first of a room to have eyes on them, once he is past his own start
  if (DIGIN.radio && !squadsLive(g) && !dazzled && !st.called.has(gd) && g.time - gd.lastSeenT < 0.25 && gd.reactT <= 0 && (!DIGIN.noticed || (gd.state === 'alert' || gd.state === 'search') && g.time - (M.eyesT ?? g.time) >= DIGIN.noticedSecs) && (!st.fix || g.time - st.fix.t > 10)) {
    const heard = !!heardBy(F, gd.char.pos, DIGIN.shoutM);                        // (he says it out loud into his radio: a cue only to a team within earshot of HIM)
    st.called.add(gd); st.fix = { at: v3.copy(gd.char.pos), t: g.time, room: D.room, heard }; DIGIN_STATS.radio++;
    g.say(gd, oneOf(w(['contact! they\'re here. hold your rooms!', 'they\'re on us. watch your doors!'], ['contact! they\'re inside. hold your rooms!', 'they\'re in here. watch your doors!'])), true); log(F, gd, `calls contact on the net${heard ? '' : ' (out of the team\'s earshot)'}`);
    for (const X of st.rooms.values()) cue(F, X, 'radio');                         // (their net is on the HUD's log whoever is in earshot — the game's convention)
  }
  // … and the first man to have heard a stun canister go off (and still have his wits) says what they are using
  if (DIGIN.learn && DIGIN.radio && isNaN(st.bangCall) && !dazzled && gd.witness.heard.bang > 0 && g.time - gd.lastSeenT > 1.5 && gd.reactT <= 0) {
    st.bangCall = g.time; DIGIN_STATS.bangCalls++;
    g.say(gd, oneOf(['flashbangs! keep off the doors!', 'they\'re throwing stun grenades. stay off the doors!']), true); log(F, gd, 'calls the flashbangs on the net');
    for (const X of st.rooms.values()) cue(F, X, 'radio');
  }
  if (dazzled) return;
  if (M.phase !== 'idle' && M.phase !== 'think' && M.phase !== 'toRoom' && (!R || D.room !== M.room)) { drop(st, M, gd); return; }   // he is somewhere else now (fell back, planted through a door): the room fight's man again
  if (M.phase !== 'idle' && (DIGIN.stay || M.far && DIGIN.reachM > 0)) D.rallyAt = NaN;   // held here, not weighing the fight next door: no rally clock left running to send him the frame he is let go
  switch (M.phase) {
    case 'idle': {
      if (contact || !D.room || !D.room.entries.length) return;
      if (!isNaN(st.rooms.get(D.room)?.enteredAt ?? NaN)) return;                 // the team has been in his room: the room fight's man from there on
      let know: Vec3 | null = null, t = -100;
      if (D.noiseAt && D.noiseOut && g.time - D.noiseT < 6 && D.noiseT > M.knowT) { know = D.noiseAt; t = D.noiseT; }
      else if (st.fix && st.fix.room !== D.room && st.fix.t > M.knowT && g.time - st.fix.t > 0.8 && g.time - st.fix.t < 8) { know = st.fix.at; t = st.fix.t; }
      if (!know) return;
      if (gunKeepsPost(gd)) { M.knowT = t; return; }   // (gunroles.ts: the belt-fed gun was posted on the floor's longest line and stays on it — heard, and let lie; false with that switch off)
      if (!DIGIN.keeper && !DIGIN.stay && DIGIN.reachM <= 0 && pressKeeps(g, D)) { M.knowT = t; return; }   // (DIGIN.keeper off: the press's keeper does not start on his room — heard, and let lie)
      M.know = v3.copy(know); M.knowT = t; M.phase = 'think'; M.until = g.time + paced(DIGIN.think); DIGIN_STATS.heard++;
      M.far = DIGIN.reachM > 0 && wayTo(F, gd.char.pos, know) > DIGIN.reachM; if (M.far) DIGIN_STATS.far++;   // too far to join that fight in time: his room is his job
      return;
    }
    case 'think':
      if (contact) { M.phase = 'idle'; DIGIN_STATS.aborted++; return; }
      if (!D.room || !isNaN(st.rooms.get(D.room)?.enteredAt ?? NaN) || listeners(F).some(L => F.inRoom(D.room, L.head))) { M.phase = 'idle'; return; }   // they are in his room already (he was blind, or thinking): the room fight's man
      if (g.time < M.until) return;
      if (squadDefers(g, gd)) return;   // (enemysquads.ts: his squad has heard and not yet said what it does — or he is about to be sent: the door waits for the word)
      if (!DIGIN.stay && !(M.far && DIGIN.reachM > 0) && pressWants(g, D)) return;   // (pressure.ts on as well: he is on his beat toward a press, or in one — the press has him first; whether the man it leaves to keep the room digs in is the next line's)
      if (!DIGIN.keeper && !DIGIN.stay && !(M.far && DIGIN.reachM > 0) && pressKeeps(g, D)) { M.phase = 'idle'; return; }   // (DIGIN.keeper off: made the keeper while he thought — he does not dig in)
      if (!DIGIN.stay && !(M.far && DIGIN.reachM > 0) && !isNaN(D.rallyAt) && D.rallyGo && g.time < D.rallyAt + 0.5) return;   // (stay off) he is weighing the fight next door and means to go: the room fight's rally has him first — only a man who holds his room digs in
      begin(F, st, D, M);
      return;
    case 'toRoom':                                                                // planted: with the others, or stopped on the way (contact, a door, ten seconds)
      if (D.room && D.room === M.gatherTo && !contact) { M.gatherTo = null; M.phase = 'think'; M.until = g.time + 0.4; log(F, gd, `is in with room ${D.room.id}`); }
      else { M.gatherTo = null; M.phase = 'idle'; DIGIN_STATS.gatherLost++; log(F, gd, 'did not make it to the others'); }
      return;
    case 'toProp': {                                                              // planted: at the prop, or stopped short
      const p = M.prop; if (contact || !p || !R || !g.props.props.includes(p)) { DIGIN_STATS.aborted++; drop(st, M, gd); return; }   // (…or a blast took the prop apart)
      if (flat(gd.char.pos, [p.x, 0, p.z]) < 1.7) { const sp = DIGIN.haulSpeed / Math.max(0.1, DIGIN.pace); M.phase = 'haul'; M.scrapeT = -100; M.haulBy = g.time + flat(gd.char.pos, M.stand) / sp * 1.6 + 3; move(F, D, M.stand, sp); return; }
      shutOrCover(F, st, D, M, R); return;
    }
    case 'haul': {                                                                // planted: at the door with it, or stopped short
      const p = M.prop; if (!p || !R || !g.props.props.includes(p)) { drop(st, M, gd); return; }
      p.vx = 0; p.vz = 0; const e = R.room.entries[M.brace];
      if (contact) { caught(F, D, M, 'hauling'); drop(st, M, gd); return; }
      if (e && flat([p.x, 0, p.z], M.rest) < 1.3 && wedgeable(g, e.door) && holds(g, e)) {
        if (!e.door.latched) { handOn(F, D, M, e.door); return; }
        M.phase = 'wedge'; M.until = g.time + paced(DIGIN.wedgeSecs); M.scrapeT = g.time; return;
      }
      if (bringsHome(F, st, D, M, R, e, p)) return;   // (HAULHOME: a hand short with his clock running — he brings it the rest of the way)
      log(F, gd, 'the furniture did not make it to the door');
      shutOrCover(F, st, D, M, R); return;
    }
    case 'toDoor': {                                                              // planted: at his open door, or stopped short
      if (!R) { drop(st, M, gd); return; } const i = doorOf(g, M), e = R.room.entries[i];
      if (contact) { DIGIN_STATS.aborted++; settle(F, D, M); return; }
      if (shutsOpen(g) && (M.also ?? -1) >= 0 && atADoor(D, M, R)) { log(F, gd, `leaves ${e.door.def.name}: they are at a door`); toCover(F, st, D, M, R); return; }   // (on his way to another door of the room, and the noise has come to one of them)
      if (flat(gd.char.pos, e.at) < 2.2 && !e.door.latched && !e.door.lockBroken) { log(F, gd, `pulls ${e.door.def.name} to`); handOn(F, D, M, e.door); return; }
      if (!shutMore(F, st, D, M, R, i)) toCover(F, st, D, M, R);
      return;
    }
    case 'shut': {                                                                // a hand on the leaf until it latches
      const i = doorOf(g, M), e = R!.room.entries[i];
      if (contact) { caught(F, D, M, 'at the door'); drop(st, M, gd); return; }
      if (flat(gd.char.pos, e.at) > 3) { log(F, gd, 'was moved off the door'); toCover(F, st, D, M, R!); return; }
      if (handWaits(F, D, M, e.door)) return;
      if (shutsOpen(g)) { if (!e.door.latched) { DIGIN_SHUT.left++; log(F, gd, `lets ${e.door.def.name} be: it will not latch`); } else if (g.time - (M.handT ?? g.time) > 2.5) DIGIN_SHUT.held++; }
      if (M.brace >= 0 && M.prop && e.door.latched && wedgeable(g, e.door) && holds(g, e)) { M.phase = 'wedge'; M.until = g.time + paced(DIGIN.wedgeSecs); M.scrapeT = g.time; return; }
      if (!shutMore(F, st, D, M, R!, i)) toCover(F, st, D, M, R!);
      return;
    }
    case 'wedge': {                                                               // working the furniture under the door: heard, and no gun in his shoulder
      const e = R!.room.entries[M.brace];
      if (contact) { caught(F, D, M, 'wedging the door'); drop(st, M, gd); return; }
      if (!e || !M.prop || !g.props.props.includes(M.prop) || !e.door.latched || !wedgeable(g, e.door) || !holds(g, e)) { log(F, gd, 'the door came open under his hands'); toCover(F, st, D, M, R!); return; }
      if (flat(gd.char.pos, e.at) > 3) { log(F, gd, 'was moved off the door'); toCover(F, st, D, M, R!); return; }
      if (g.time - M.scrapeT > DIGIN.scrapeEvery * 1.6) { M.scrapeT = g.time; scrape(F, st, gd, M, R, true); }
      if (g.time < M.until) return;
      wedge(F, st, D, M, R!, e); afterWedge(F, st, D, M, R!); return;
    }
    case 'toCover':                                                               // planted: there, or stopped by what he saw
      if (contact) DIGIN_STATS.aborted++;
      settle(F, D, M); return;
    case 'set': {
      if (g.time - R!.enteredAt > 1) { M.phase = 'idle'; return; }               // they are in: his fear of that door is no longer topped up, his eye is his own again (the room fight's evidence takes it from here)
      const last = Math.max(D.noiseT, M.knowT, gd.lastSeenT);
      if (g.time - last > DIGIN.holdSecs && !lastStandMan(g, gd)) { M.phase = 'idle'; log(F, gd, 'stands down'); return; }   // (laststand.ts: the last stand stays set)
      fear(D, M);
      if (!contact && DIGIN.lanes && isNaN(R!.enteredAt) && g.time >= (M.laneT ?? 0) && g.time - M.setAt > DIGIN.laneSecs) {
        if (!laneCovers(g, gd, gd.char.pos)) M.laneT = g.time + 0.5;                   // (asked twice a second, not every frame)
        else if (toCover(F, st, D, M, R!, false)) { M.laneT = g.time + DIGIN.laneSecs; DIGIN_STATS.laneMoved++; log(F, gd, 'moves out of their line'); return; }   // set in a lane that has cost them: another spot of his room, out of the line
        else { M.laneT = g.time + 4 * DIGIN.laneSecs; DIGIN_STATS.laneKept++; }        // none: he stays as he is, and is not asked again for a while
      }
      if (!contact && !M.triedDeep && DIGIN.learn && DIGIN.cover && isNaN(R!.enteredAt) && knowsBangs(F, st, D)) { toCover(F, st, D, M, R!); return; }   // set on the door, and now the word is they throw flashbangs: off its line
      if (R!.second < 0 || R!.men.length > 1) D.glanceNext = Math.max(D.glanceNext, g.time + 3);   // nothing else to watch for: his eye stays on his door
      // the noise has moved: another door is now the likely one
      if (!contact && D.noiseAt && D.noiseOut && D.noiseT > M.knowT + 4 && g.time - D.noiseT < 2 && g.time - M.setAt > DIGIN.redigSecs) {
        M.know = v3.copy(D.noiseAt); M.knowT = D.noiseT;
        const was = R!.expected; const [a, b] = expectEntries(F, R!.room, M.know); R!.expected = a; R!.second = b; R!.at = g.time;
        if (a >= 0 && a !== was && M.entry === was && !F.defs.some(X => X !== D && X.gd.state !== 'dead' && X.room === D.room && st.men.get(X.gd)?.entry === a && st.men.get(X.gd)?.phase !== 'idle')) {
          M.entry = a; log(F, gd, `shifts to ${R!.room.entries[a].door.def.name}`); toCover(F, st, D, M, R!);
        }
      }
      return;
    }
  }
}

/** once a frame: a room all set, the team's first step into a room that dug in, and wedges that have been booted */
function watch(F: Fight, st: St) {
  const g = F.g, S = DIGIN_STATS;
  for (const [d, w] of st.wedges) if (!w.kicked && d.lockBroken) {                // the wedge found the hard way: the door that would not open IS the cue, if nothing came before it
    w.kicked = true; S.kicked++;
    for (const R of st.rooms.values()) if (R.room.entries.some(e => e.door === d)) cue(F, R, 'kick');
  }
  for (const [d, w] of st.wedges) if (!w.tried && !w.kicked && d.locked) {          // a hand on the handle from outside: the wedge found the quiet way, by whoever stands at the door
    const c = d.frameCentre, by = listeners(F).find(L => flat(L.head, c) < 1.7 && g.doors.side(d, L.head) === d.keySide && (L.gd ? Math.hypot(L.gd.char.vel[0], L.gd.char.vel[2]) : Math.hypot(g.player.char.vel[0], g.player.char.vel[2])) < 0.4);
    if (!by) { w.byT = NaN; continue; }
    if (isNaN(w.byT)) w.byT = g.time;
    if (g.time - w.byT < DIGIN.trySecs) continue;
    w.tried = true; S.tried++;
    const dn = doorWords(d);   // (words.ts: the line NAMES its door — a man within reach of two doors said 'door's blocked' of the one he was not stacked on)
    if (WORDS.on && Math.abs(d.angle) > 0.05) { if (by.gd) oneOf(['', '']); }   // (a leaf standing open is no door to call wedged: the line is not said — his die is still drawn, the rule and its cue are as they were)
    else if (by.gd) g.say(by.gd, oneOf(WORDS.on ? [`the ${dn} is blocked. something heavy behind it.`, `the ${dn} is wedged from inside. they know we're here.`] : ['door\'s blocked. something heavy behind it.', 'it\'s wedged from inside. they know we\'re here.']), true); else g.msg(WORDS.on ? `the ${dn} is wedged from inside` : 'the door is wedged from inside');
    log(F, by.gd, `tries ${d.def.name}: wedged`);
    for (const R of st.rooms.values()) if (R.room.entries.some(e => e.door === d)) cue(F, R, 'tried');
  }
  for (const R of st.rooms.values()) {
    if (!isNaN(R.enteredAt)) continue;
    const home = F.defs.filter(X => X.gd.state !== 'dead' && X.room === R.room), ph = (X: Def) => st.men.get(X.gd)?.phase ?? 'idle';
    if (isNaN(R.readyAt) && home.length && home.every(X => ph(X) === 'set')) { R.readyAt = g.time; S.readyN++; S.knowToReady += g.time - R.t0; log(F, null, `room ${R.room.id} all set, ${(g.time - R.t0).toFixed(1)} s after the first word of them`); }
    if (!listeners(F).some(L => F.inRoom(R.room, L.head))) continue;
    R.enteredAt = g.time; S.entered++; S.knowToEntry += g.time - R.t0;
    if (!isNaN(R.cueAt)) S.cueFirst++;
    if (R.cues.has('radio')) S.cueRadio++; if (R.cues.has('shout')) S.cueShout++; if (R.cues.has('scrape')) S.cueScrape++; if (R.cues.has('tried')) S.cueTried++; if (R.cues.has('kick')) S.cueKick++;
    const busy = home.filter(X => ['toProp', 'haul', 'toDoor', 'shut', 'wedge', 'think', 'toCover'].includes(ph(X))).length;
    if (!isNaN(R.readyAt)) S.readyFirst++; else if (busy) S.halfReady++;
    for (const e of R.room.entries) if (st.wedges.has(e.door) && !e.door.lockBroken && e.door.locked) S.wedgedAtEntry++;
    log(F, null, `team into room ${R.room.id} ${(g.time - R.t0).toFixed(1)} s after its first word of them: cues ${[...R.cues].join('+') || 'none'}${isNaN(R.cueAt) ? '' : ' (first ' + (g.time - R.cueAt).toFixed(1) + ' s before)'}, ${home.filter(X => ph(X) === 'set').length}/${home.length} set, ${busy} still busy, ${R.wedged} wedged`);
  }
}

/** roomfight.ts evidence: a door of his room booted in — a man set on a door his room wedged was waiting for exactly that */
export function digInBraced(g: Game, gd: Guard, d: Door): boolean {
  if (!DIGIN.steady || !digInSetOn(g, gd, d)) return false;
  DIGIN_STATS.steady++; return true;
}
/** the same question with nothing counted: `gd` is set on `d`, a door his room wedged (doorforce.ts: that leaf is his barricade, not a door to force) */
export function digInSetOn(g: Game, gd: Guard, d: Door): boolean {
  const st = states.get(g); if (!st || !st.wedges.has(d)) return false;
  const M = st.men.get(gd); return !!M && M.phase === 'set';
}

/** laststand.ts: this man is TOLD to dig in where he holds (the last stand's order — no noise faked, no squad's news): after `beat` he starts on his room as
 *  if he had heard them at `know`. False = he is already at it, has no room with a door, or the team has been in it */
export function digInOrder(g: Game, def: unknown, know: Vec3, beat: number): boolean {
  const D = def as Def, st = stateOf(g), gd = D.gd;
  let M = st.men.get(gd);
  if (!M) { M = newMan(); st.men.set(gd, M); }
  if (M.phase !== 'idle' || D.mode !== 'hold' || !D.room || !D.room.entries.length || !isNaN(st.rooms.get(D.room)?.enteredAt ?? NaN)) return false;
  M.know = v3.copy(know); M.knowT = g.time; M.far = false; M.gathered = true; M.ordered = true; M.phase = 'think'; M.until = g.time + beat; DIGIN_STATS.heard++;
  return true;
}
/** laststand.ts: the stand is called off (its switch flipped mid-fight) — a man it ORDERED to dig in lets go of whatever he was at, as the dig-in's own
 *  stand-down does (one who dug in on his own ears, or his squad's word, is not the stand's to release) */
export function digInRelease(g: Game, gd: Guard) { const st = states.get(g), M = st?.men.get(gd); if (!st || !M || !M.ordered) return; M.ordered = false; if (M.phase !== 'idle') drop(st, M, gd); }
/** laststand.ts: where his dig-in stands ('idle' = not at it) */
export function digInPhase(g: Game, gd: Guard): string { return states.get(g)?.men.get(gd)?.phase ?? 'idle'; }
/** laststand.ts: the team has been in this room since somebody dug in there */
export function digInEntered(g: Game, room: unknown): boolean { return !isNaN(states.get(g)?.rooms.get(room as Room)?.enteredAt ?? NaN); }
/** laststand.ts: this room's doors that stand wedged (not yet booted) */
export function digInWedged(g: Game, room: unknown): { door: Door; at: Vec3 }[] { const st = states.get(g); if (!st) return []; return (room as Room).entries.filter(e => { const w = st.wedges.get(e.door); return !!w && !w.kicked; }); }
/** roomfight.ts applyWatch: a man set off the door's line rests his gun on the floor they must cross, not on a door he cannot see (writes `pt` in place) */
export function digInLook(g: Game, gd: Guard, pt: Vec3) {
  const M = states.get(g)?.men.get(gd); if (!M || M.phase !== 'set' || !M.deep || !M.look) return;
  pt[0] = M.look[0]; pt[2] = M.look[2];
}

/** roomfight.ts rally: a man who is digging in holds his room */
export function digInStays(g: Game, gd: Guard): boolean {
  const M = states.get(g)?.men.get(gd); if (!M || M.phase === 'idle' || !DIGIN.stay && !(M.far && DIGIN.reachM > 0)) return false;   // (only the men the fight is out of reach of, unless `stay` keeps everybody)
  if (!M.kept) { M.kept = true; DIGIN_STATS.noRally++; }
  return true;
}

/** pressure.ts lastMan: he is SET on his door (dug in, gun on it) */
export function digInSet(g: Game, gd: Guard): boolean { return states.get(g)?.men.get(gd)?.phase === 'set'; }

/** pressure.ts's fall-back seam (asked when nobody else answers PRESSURE_HOOKS.fallBackTo): WHERE a man who gives ground goes when his side has a room dug in
 *  that the team has not reached — a spot beside a man of that room who is not in a fight himself, and the door of it he comes in by (the one he then watches,
 *  and tells them to). `threat` is what he is giving ground to (the caller's: the men in his sight, the boots at his door). The nearest such room by the
 *  floor, no further than the gather's reach, never by a way that passes the threat. null = none: the press's own answer. The way is walked HERE (the caller
 *  does not search again) */
export function digInRefuge(g: Game, rf: unknown, def: unknown, threat: Vec3): { spot: Vec3; door: Door | null } | null {
  const st = states.get(g); if (!st || !st.rooms.size) return null;
  const F = rf as Fight, D = def as Def, gd = D.gd, c = gd.char, nav = g.col.nav;
  const shy = (ix: number, iz: number) => Math.hypot((ix + 0.5) * nav.cell - threat[0], (iz + 0.5) * nav.cell - threat[2]) < DIGIN.gatherShyM ? 20 : 1;
  let best: { spot: Vec3; door: Door | null; L: number } | null = null;
  for (const R of st.rooms.values()) {
    if (R.room === D.room || !isNaN(R.enteredAt) || F.inRoom(R.room, threat) || listeners(F).some(L => F.inRoom(R.room, L.head))) continue;
    const X = F.defs.find(x => x !== D && x.gd.state !== 'dead' && x.mode === 'hold' && x.room === R.room && g.time - x.gd.lastSeenT > 3 && !['idle', 'think', 'toRoom'].includes(st.men.get(x.gd)?.phase ?? 'idle')); if (!X) continue;
    const xp = X.gd.char.pos, spot = F.freeNear([xp[0] + (c.pos[0] > xp[0] ? 1.2 : -1.2), 0, xp[2]]) ?? F.freeNear(xp); if (!spot || !F.inRoom(R.room, spot)) continue;
    const path = nav.findPath(c.pos, spot, 6000, shy); if (!path?.length) continue;
    const L = pathLen(c.pos, path); if (L > DIGIN.gatherM || (best && L >= best.L)) continue;
    // (findPath hands back the corners of the way, not every cell of it: the threat and the doors are measured against its LEGS)
    let near = Infinity, door: Door | null = null, bd = 1.3, q: Vec3 = c.pos;
    for (const w of path) { near = Math.min(near, legDist(threat, q, w)); for (const e of R.room.entries) { const d = legDist(e.at, q, w); if (d < bd) { bd = d; door = e.door; } } q = w; }
    if (near < DIGIN.gatherShyM * 0.5) continue;
    best = { spot, door, L };
  }
  if (best) { DIGIN_STATS.refuge++; log(F, gd, `falls back to a dug-in room${best.door ? ` by ${best.door.def.name}` : ''} (${best.L.toFixed(1)} m)`); }
  return best;
}
/** flat distance from p to the leg a→b */
function legDist(p: Vec3, a: Vec3, b: Vec3): number {
  const dx = b[0] - a[0], dz = b[2] - a[2], l2 = dx * dx + dz * dz, t = l2 > 0 ? Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[2] - a[2]) * dz) / l2)) : 0;
  return Math.hypot(p[0] - (a[0] + dx * t), p[2] - (a[2] + dz * t));
}

/** a fresh staging (roomfight.ts reset): wedged doors get their own lock back, everything remembered dropped */
export function digInReset(g: Game) {
  const st = states.get(g); if (!st) return;                                     // (nothing dug in since the last one: nothing to put back — and nothing touched with the switch off)
  for (const [d, w] of st.wedges) { const mut = d as unknown as { keySide: 1 | -1; lockId: string }; mut.keySide = w.keySide; mut.lockId = w.lockId; if (!d.lockBroken) d.locked = !!d.def.locked; }
  states.delete(g);
  for (const k of Object.keys(DIGIN_STATS) as (keyof typeof DIGIN_STATS)[]) DIGIN_STATS[k] = 0; DIGIN_LOG.length = 0;
  DIGIN_SHUT.home = DIGIN_SHUT.held = DIGIN_SHUT.again = DIGIN_SHUT.more = DIGIN_SHUT.left = 0;
}

export function digInSummary(g: Game): string {
  if (!DIGIN.on && !squadsLive(g)) return 'off';   // (enemysquads.ts: a squads level's men dig in on their squad's word whatever the switch says)
  const S = DIGIN_STATS, st = states.get(g);
  return `${S.dug} dug in (${S.moved} moved) · ${S.braced} doors wedged (${S.kicked} booted) · ${st ? st.rooms.size : 0} rooms · cue first ${S.cueFirst}/${S.entered}`;
}
