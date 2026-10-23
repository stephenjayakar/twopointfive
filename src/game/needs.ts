// Needs-driven patrol variation, TELEGRAPHED (STATUS E12 (c) — the maintainer: "i actually really like the needs driven patrol variation, especially if it's
// telegraphed like fear!"). Every man on the night staff carries two or three slow needs — a coffee at the break-room counter, a smoke outside the fire exit,
// water at the cooler, a stretch round the lobby — dealt him for the night off his callsign (which needs, how fast each fills, how far along it starts: the
// same man every run, so a probe and a player see the same Kowalski). A need's level rises only while he is CALM on his route and stands still under everything
// else (a noise he is looking into, a body, an errand, the tour, a floor that is up); when one is full AND his route has brought him to the waiting waypoint
// nearest the place AND nobody else is off his route (the floor is short-staffed: one man away at a time) AND the floor is calm — he goes. But not before he
// has TOLD you, twenty seconds out, the way fear tells you: he looks at his watch and glances the way he will go (T−20 s), says so to the colleague within
// earshot — who grumbles back — or, with nobody near, over the net so the radio strip carries it (T−12 s), rubs his neck and turns to face the way out (T−5 s),
// and walks: at his patrol pace, torch as it hangs on patrol, through the doors on the way, to the spot; does the thing for a fixed spell (25 s at the counter,
// 40 outside, 12 at the cooler; the stretch is the lap itself); walks back to the waypoint he left, says 'right, where was I', and the route resumes where it
// stopped. The whole absence is therefore a constant per man and kind (the probes print them) — a window the player can COUNT on, never luck.
// ONE MODEL: nothing here dulls him. His state stays 'patrol' throughout, so his eyes, ears, the body he might walk onto, the kicked lock he might pass, the
// whistle he might answer are exactly the patrolling man's; and anything that reaches him — awareness to the 'huh?' line, a called body, an errand handed him,
// the floor going up, the tour taking the floor, the response team — CANCELS the trip on the frame, wherever he stands (a man startled halfway to the fire door
// looks into it from there, off his route: interesting, and fair). It is not resumed: the need is put back to half and he returns to his route as the ordinary
// AI has him. `Game.tune.needs` is the switch (default on; off = the patrol byte for byte as it was — tools/qa needs-identity holds it); NEEDS the numbers, Tab ▸
// Sandbox, kept per machine. guards.ts calls needsPatrol from the patrol branch (his feet while a trip owns them) and game.ts needsTick once a frame (levels,
// the deal, the interrupts); character.ts has the two tells (CharacterAnimator.tell); dialogue.ts the lines (NEEDS_LINES); chronicle.ts the 'needBreak' rows.
import { SideMap } from '../math/side';
import { Vec3, v3, clamp, wrapAngle, approachAngle, damp } from '../math/vec';
import type { Game, Guard } from './game';
import { goTo, followPath, escalationOf, notGettingAnywhere } from './guards';
import { hashStr, NEEDS_LINES } from './dialogue';
import { isDaylight } from './lighting';
import { chronicle } from './chronicle';
import { hearPath } from './weather';
import { dozeAsleep } from './doze';
import { WORDS, w, wg } from './words';   // (a leaf: the dialogue pass's one switch)

// ================================================================ the kinds and their places (TODO(LevelData): NEED_SPOTS belongs in the level file beside routes / chokepoints — like qrf.ts
// QRF_MARKS it is checked headlessly against levels/office.json: free nav cells, reachable from every route, the loop's legs walkable, out of every leaf's sweep)
export type NeedKind = 'coffee' | 'smoke' | 'water' | 'stretch';
export const NEED_KINDS: NeedKind[] = ['coffee', 'smoke', 'water', 'stretch'];
/** Where a need is answered: stand at `pos` facing `face` (Character yaw) for the kind's dwell — or, for the stretch, walk `loop` round from `pos` without
 *  stopping and come back. `name` words the panel; the timeline has its own (chronicle.ts NEED_WORDS). */
export interface NeedSpot { kind: NeedKind; name: string; pos: Vec3; face: number; loop?: Vec3[]; }
export const NEED_SPOTS: Record<NeedKind, NeedSpot> = {
  coffee: { kind: 'coffee', name: 'the break-room counter', pos: [34.6, 0, 14.4], face: Math.PI / 2 },             // on the mat at the counter, facing the machine (the counter's face is x 35.15; the coffee machine stands at z 14.3)
  smoke: { kind: 'smoke', name: 'outside the fire exit', pos: [37.6, 0, 22.4], face: 1.1 },                       // out through the fire exit (its leaf sprung shut behind him) onto the east strip, a stride south of the door's sweep, facing out over the lot
  water: { kind: 'water', name: 'the water cooler', pos: [26.9, 0, 22.8], face: Math.PI / 4 },                    // the cooler in the cubicle farm's south-east corner (27.5, 23.4): a step short of it, facing it
  stretch: { kind: 'stretch', name: 'the lobby', pos: [8.4, 0, 17.0], face: 0, loop: [[10.8, 0, 18.6], [9.6, 0, 21.4], [7.4, 0, 22.8], [5.4, 0, 18.4], [8.4, 0, 17.0]] },   // in under the arch to the open floor before reception, once round the seating, back
};

/** WHERE A NEED IS ANSWERED ON THIS LEVEL: a level that carries its own places (its file's scenarios.quiet.needs — scene/scenarios.ts QuietData; any level with a
 *  quiet mission says which errands its floor has, a kind it leaves out is not dealt there) reads them; every other level reads the office's table above, as
 *  it always has. null: no such place on this floor. */
export function needSpot(g: Game, kind: NeedKind): NeedSpot | null {
  const Q = g.level.scenarios?.quiet; if (!Q) return NEED_SPOTS[kind] ?? null;
  const s = Q.needs?.[kind]; return s ? ownSpot(s, kind) : null;
}
const owned = new SideMap<object, NeedSpot>('needs.owned');
function ownSpot(s: { name: string; pos: Vec3; face: number; loop?: Vec3[] }, kind: NeedKind): NeedSpot { let o = owned.get(s); if (!o) owned.set(s, o = { kind, name: s.name, pos: s.pos, face: s.face, ...(s.loop ? { loop: s.loop } : {}) }); return o; }

// ================================================================ numbers (Tab ▸ Sandbox ▸ needs rows; the kept ones persist per machine — loadNeeds / saveNeeds)
export const NEEDS = {
  /** × every man's fill rate (1 = as dealt: a coffee fills in 6–9 min of calm patrol, a smoke in 8–12, water in 6–10, the stretch in 5–7) */
  rateK: 1,
  /** men off their routes at once, floor-wide (telegraphing counts as off: the slot is his from the watch check on) */
  maxAway: 1,
  /** the telegraph, seconds before he walks: the whole lead (the watch check + glance open it), when he says it, when he rubs his neck and turns to go */
  announceLead: 20, sayLead: 12, stretchLead: 5,
  /** a colleague his raised voice reaches is told to his face and answers `replyAfter` s later: this many metres of open air along the SOUND'S PATH (collision.ts
   *  SoundPaths — × its carry: 0.72 of it round a corner and in at the door, 0.32 through a shut leaf; the whistle's model); nobody that near and it goes over the net */
  partnerM: 14, replyAfter: 1.5,
  /** the dwell per kind (s): standing at the counter / outside / at the cooler; the stretch's is the lap itself (0 = no standing about) */
  dwell: { coffee: 25, smoke: 40, water: 12, stretch: 0 } as Record<NeedKind, number>,
  /** a trip only ever starts from a waypoint whose authored wait is at least this (a place he stands at anyway: legible), and — fromNearest — only from the one of
   *  those nearest the spot by path (so the absence per man and kind is one number); false = any waiting waypoint, the moment the need is full */
  minWait: 2, fromNearest: true,
  /** a kind whose place is nearer than this (m, by path) to the waypoint he would leave from is not dealt him at all: his route covers it already (Novak waits beside the cooler) */
  minTripM: 4,
  /** what a need is put back to when a trip is broken off, and what every need of his is capped at once he has been through an alarm (adrenaline: nobody wants a
   *  coffee straight after a manhunt) */
  afterCancel: 0.5, afterAlert: 0.3,
  /** seconds after coming back before HE may go again on any need, and the least gap between any two departures floor-wide */
  restSecs: 90, floorGapSecs: 30,
  /** the walk there and back: × the patrol pace (1 = exactly the route's walk); seconds of no headway on a leg before the trip is given up where he stands */
  paceK: 1, stuckSecs: 6,
};
export const NEEDS_DEFAULTS = { rateK: 1, maxAway: 1, announceLead: 20, dwell: { ...NEEDS.dwell } };
/** per-kind fill windows (minutes of calm patrol from empty to full, dealt per man inside the range) and how far along a fresh man may start (0.3‥0.7 of full: the
 *  first man is over his line two to four minutes into a quiet run, and goes when his route next brings him to that need's waypoint) */
const FILL_MIN: Record<NeedKind, [number, number]> = { coffee: [6, 9], smoke: [8, 12], water: [6, 10], stretch: [5, 7] };
const LEVEL0 = [0.3, 0.7];
/** levels keep filling past full up to this (which of two full needs is the more pressing), and the calm a man must have to fill / to schedule (under the 0.3 'huh?') */
const LEVEL_CAP = 1.5, CALM_AWARENESS = 0.3, SCHEDULE_AWARENESS = 0.15;
/** the glance the way he will go: this long after the watch check comes up (so the eyes are off the wrist first), held this long */
const GLANCE_AT = 1.1, GLANCE_SECS = 2.2;

// ================================================================ per-man memory (dies with the Guard object: resetGuards / restartEncounter make fresh men with fresh needs)
export interface Need { kind: NeedKind; level: number; fillMin: number; wp: number; tripM: number; }
export type TripPhase = 'telegraph' | 'going' | 'dwell' | 'returning';
export interface Trip {
  kind: NeedKind; spot: NeedSpot; phase: TripPhase; forced: boolean;
  /** game times: scheduled (the watch check), due to walk, walked, reached the spot, due to start back, back on the waypoint (−1 = not yet) */
  t0: number; departAt: number; leftAt: number; arrivedAt: number; dwellUntil: number; backAt: number;
  /** the waypoint he leaves from and comes back to (route.points[wp]), and the yaw of the way out (the first leg of the path: what he glances along and turns to) */
  wp: number; outYaw: number;
  /** the telegraph's beats done: watch check / said it (and to whom, or over the net) / the partner's answer due & done / neck rub */
  watched: boolean; told: boolean; partner: Guard | null; radio: boolean; replyAt: number; replied: boolean; necked: boolean;
  /** the stretch: index of the loop point being walked to (−1 = not on the loop) */
  loopI: number;
  /** the line he used (QA) */
  line: string;
  /** the floor's last-departure stamp before this trip took it (given back if the telegraph is broken off: nobody walked) */
  gapBefore: number;
}
export interface NeedMem { needs: Need[]; trip: Trip | null; lastBackAt: number; trips: number; cancels: number; shaken: boolean; dealt: boolean; }
const memOf = new SideMap<Guard, NeedMem>('needs.memOf');
function mem(gd: Guard): NeedMem { let M = memOf.get(gd); if (!M) { M = { needs: [], trip: null, lastBackAt: -1e9, trips: 0, cancels: 0, shaken: false, dealt: false }; memOf.set(gd, M); } return M; }
/** read-only peek for the panel / the probes (null: the needs have never touched this man — the switch off, a unit, a corpse from before) */
export function needsMem(gd: Guard): Readonly<NeedMem> | null { return memOf.get(gd) ?? null; }
/** the trip this man is on (telegraphing, away, coming back), or null */
export function needsTrip(gd: Guard): Readonly<Trip> | null { return memOf.get(gd)?.trip ?? null; }
/** is he busy with a need — telegraphing one or off his route on one? (dialogue.ts chatty: no small talk with a man who has just told you he is off) */
export function needsBusy(gd: Guard): boolean { return !!memOf.get(gd)?.trip; }

/** per-Game: when anybody last walked off (the floor-wide gap) */
const floorOf = new SideMap<object, { lastDepartAt: number }>('needs.floorOf');
function floor(g: Game) { let F = floorOf.get(g); if (!F) { F = { lastDepartAt: -1e9 }; floorOf.set(g, F); } return F; }

/** module-wide counters for the QA soak, and the last few things that happened (probes / the panel) */
export const NEEDS_STATS = { dealt: 0, scheduled: 0, forced: 0, departed: 0, arrived: 0, completed: 0, cancelled: 0, radioed: 0, told: 0, replies: 0, stuck: 0 };
export const NEEDS_LOG: { t: number; who: string; what: string }[] = [];
export const NEEDS_DEBUG: { log: ((s: string) => void) | null } = { log: null };
function log(g: Game, gd: Guard, what: string) { NEEDS_LOG.push({ t: g.time, who: gd.callsign, what }); if (NEEDS_LOG.length > 200) NEEDS_LOG.splice(0, 50); NEEDS_DEBUG.log?.(`${g.time.toFixed(2)}s ${gd.callsign}: ${what}`); }

// ================================================================ the deal: which needs a man has, off his callsign and his route
const frac = (s: string) => (hashStr(s) % 100000) / 100000;
function pathMetres(g: Game, from: Vec3, to: Vec3): number {
  const p = g.col.nav.findPath(from, to, 6000); if (!p) return Infinity;
  let s = 0, prev = from; for (const q of p) { s += Math.hypot(q[0] - prev[0], q[2] - prev[2]); prev = q; } return s;
}
/** the waypoint of his route a trip of this kind starts from: among those with an authored wait ≥ minWait, the nearest to the spot by path (fromNearest), with its
 *  distance; wp −1 = his route has no such waypoint / the spot cannot be reached from any */
function departurePoint(g: Game, gd: Guard, spot: NeedSpot): { wp: number; m: number } {
  const R = gd.route; let best = -1, bm = Infinity;
  for (let i = 0; i < R.points.length; i++) { if ((R.wait[i] ?? 0) < NEEDS.minWait) continue; const m = pathMetres(g, R.points[i], spot.pos); if (m < bm) { bm = m; best = i; } }
  return { wp: best, m: bm };
}
/** Deal this man his needs (once): every kind ranked by a hash of his callsign, kinds his route already covers (or cannot reach) dropped, the first two or three
 *  kept — each with its fill time inside the kind's window and a starting level, both off the callsign too. Staff only (a unit has no night to get through). */
function deal(g: Game, gd: Guard, M: NeedMem) {
  M.dealt = true;
  if (gd.team !== 'guard' || gd.unit || gd.routeI < 0) return;
  const cs = gd.callsign;
  const ranked = NEED_KINDS.map(k => ({ k, r: hashStr(`${cs}:${k}:rank`) })).sort((a, b) => a.r - b.r).map(x => x.k);
  const want = 2 + (hashStr(`${cs}:count`) % 2);
  for (const k of ranked) {
    if (M.needs.length >= want) break;
    const sp = needSpot(g, k); if (!sp) continue;   // (this floor has no such place)
    const dp = departurePoint(g, gd, sp);
    if (dp.wp < 0 || !Number.isFinite(dp.m) || dp.m < NEEDS.minTripM) continue;
    const [lo, hi] = FILL_MIN[k];
    M.needs.push({ kind: k, level: LEVEL0[0] + frac(`${cs}:${k}:level0`) * (LEVEL0[1] - LEVEL0[0]), fillMin: lo + frac(`${cs}:${k}:fill`) * (hi - lo), wp: dp.wp, tripM: dp.m });
  }
  NEEDS_STATS.dealt++;
  log(g, gd, `dealt ${M.needs.map(n => `${n.kind} (fills in ${n.fillMin.toFixed(1)} min, at ${n.level.toFixed(2)}, from wp${n.wp} ${n.tripM.toFixed(0)} m)`).join(', ') || 'nothing'}`);
}

// ================================================================ gates
/** the run is one the needs may play in at all: somebody home in their heads, not the tour / the attract loop / a puppet beat, not the breach's daylight, the
 *  response team not on its way or on the floor, Sam on his feet */
export function needsLive(g: Game): boolean {
  return g.tune.needs && g.aiEnabled && !g.quietUtility && !g.touring && !g.puppet && !isDaylight(g) && (!g.qrf || g.qrf.state === 'idle') && !g.player.down;
}
/** the floor is one a man would leave his route on: calm (level 0), no alarm episode running, the mains on */
function floorCalm(g: Game): boolean { return escalationOf(g) === 0 && !g.alarm.episode && !g.blackout.active; }
/** HE is calm and free: patrolling, nothing on his mind or in his hands — nobody's script, errand, body, lockdown role or arm */
function manCalm(g: Game, gd: Guard, awareness: number): boolean {
  return gd.state === 'patrol' && gd.awareness < awareness && !gd.held && !gd.script && !gd.task && !gd.bodyDuty && !gd.hold && !gd.pinned && !gd.leader && !gd.post && g.guards.includes(gd);
}
/** why a trip under way must be broken off NOW, or null (the same tests, named for the log / the timeline) */
function interruptOf(g: Game, gd: Guard): string | null {
  if (!g.tune.needs) return 'switched off';
  if (gd.state === 'dead') return 'down';
  if (!g.aiEnabled) return 'AI off'; if (g.quietUtility || g.touring || g.puppet) return 'the tour'; if (isDaylight(g)) return 'daylight'; if (g.qrf && g.qrf.state !== 'idle') return 'the response team'; if (g.player.down) return 'target down';
  if (escalationOf(g) > 0) return 'the floor went up'; if (g.alarm.episode) return 'an alarm'; if (g.blackout.active) return 'the lights went';
  if (gd.held) return 'grabbed'; if (gd.bodyDuty) return 'a body'; if (gd.task) return `an errand (${gd.task.kind})`; if (gd.script) return 'orders'; if (gd.hold || gd.pinned) return 'held by a script'; if (gd.leader || gd.post) return 'lockdown duty';
  if (gd.state !== 'patrol') return gd.state === 'alert' ? 'contact' : `went ${gd.state}`;
  if (gd.awareness >= CALM_AWARENESS) return 'heard something';
  if (!g.guards.includes(gd)) return 'reset';
  return null;
}

// ================================================================ once a frame (game.ts, before the guards move): levels, the after-alert cap, interrupts, the deal of a trip
export function needsTick(g: Game, dt: number) {
  if (!g.tune.needs) {   // OFF: nothing, ever — no memory made, no clock run (the identity card) — except that a trip under way when the switch went off is broken off, not left hanging for the day it comes back on
    for (const gd of g.guards) { const M = memOf.get(gd); if (M?.trip) cancelTrip(g, gd, M, 'switched off'); }
    return;
  }
  const live = needsLive(g), calmFloor = floorCalm(g);
  if (!g.guards.some(x => memOf.has(x))) floor(g).lastDepartAt = -1e9;   // a fresh roster (boot, resetGuards, restartEncounter): the floor's gap starts clean with the men
  let away = 0;
  for (const gd of g.guards) { const M = memOf.get(gd); if (M?.trip) { const why = interruptOf(g, gd); if (why) cancelTrip(g, gd, M, why); else away++; } }
  for (const gd of g.guards) {
    if (gd.state === 'dead' || gd.team !== 'guard' || gd.unit) continue;
    const M = mem(gd); if (!M.dealt) deal(g, gd, M);
    if (!M.needs.length) continue;
    // the adrenaline cap: a man who has hunted (or whose floor has been in an alarm) comes back to at most afterAlert on everything, once he is calm again
    if (gd.state === 'alert' || gd.state === 'search' || g.alarm.episode || escalationOf(g) > 0) M.shaken = true;
    else if (M.shaken && gd.state === 'patrol') { M.shaken = false; for (const n of M.needs) n.level = Math.min(n.level, NEEDS.afterAlert); log(g, gd, `calm again — needs capped at ${NEEDS.afterAlert}`); }
    if (!live || !calmFloor || M.trip || !manCalm(g, gd, CALM_AWARENESS)) continue;
    // filling: only a calm man on a calm floor, walking or waiting on his own route
    for (const n of M.needs) n.level = Math.min(LEVEL_CAP, n.level + dt / 60 / n.fillMin * NEEDS.rateK);
    // the deal of a trip: a full need, HIS moment (standing at that need's waypoint), the floor's slot free, his own rest had, no line of his in the air
    if (away >= NEEDS.maxAway || g.time - floor(g).lastDepartAt < NEEDS.floorGapSecs || g.time - M.lastBackAt < NEEDS.restSecs) continue;
    if (!(gd.wait > 0) || gd.awareness >= SCHEDULE_AWARENESS || (gd.bubble && g.time - gd.bubble.t < gd.bubble.dur + 0.5)) continue;   // (wait > 0 ⇔ he stands at route.points[wp]: the patrol branch sets it on arrival and advances wp when it runs out — his `speed` is stale through a wait, so it is not asked)
    let pick: Need | null = null;
    for (const n of M.needs) if (n.level >= 1 && (NEEDS.fromNearest ? n.wp === gd.wp : (gd.route.wait[gd.wp] ?? 0) >= NEEDS.minWait) && (!pick || n.level > pick.level)) pick = n;
    if (!pick) continue;
    if (scheduleTrip(g, gd, M, pick.kind, false)) away++;
  }
}

// ================================================================ a trip: scheduled → (telegraph) → going → dwell → returning → back
/** Put this man on a trip of `kind` from where he stands, the telegraph starting now (the watch check this frame). False if the place cannot be reached from here. */
function scheduleTrip(g: Game, gd: Guard, M: NeedMem, kind: NeedKind, forced: boolean): boolean {
  const spot = needSpot(g, kind); const c = gd.char;
  if (!spot) { const n = M.needs.find(x => x.kind === kind); if (n) n.level = 0; log(g, gd, `${kind}: this floor has no place for it — dropped`); return false; }
  const path = g.col.nav.findPath(c.pos, spot.pos, 6000);
  if (!path || !path.length) { const n = M.needs.find(x => x.kind === kind); if (n) n.level = 0; log(g, gd, `${kind}: no way to ${spot.name} from here — dropped`); return false; }
  // the way OUT: the bearing of the path's first stretch (a few metres along it, so a first node at his feet does not point him at the floor)
  let q = path[0]; for (const p of path) { q = p; if (Math.hypot(p[0] - c.pos[0], p[2] - c.pos[2]) > 2.5) break; }
  const outYaw = Math.atan2(q[0] - c.pos[0], q[2] - c.pos[2]);
  const now = g.time; const F = floor(g);
  M.trip = { kind, spot, phase: 'telegraph', forced, t0: now, departAt: now + NEEDS.announceLead, leftAt: -1, arrivedAt: -1, dwellUntil: -1, backAt: -1, wp: gd.wp, outYaw,
    watched: false, told: false, partner: null, radio: false, replyAt: -1, replied: false, necked: false, loopI: -1, line: '', gapBefore: F.lastDepartAt };
  F.lastDepartAt = Math.max(F.lastDepartAt, now + NEEDS.announceLead);   // the floor's gap counts from when he WILL walk (so a second man let go by maxAway ≥ 2 still leaves floorGapSecs after him); given back if the telegraph comes to nothing
  NEEDS_STATS.scheduled++; if (forced) NEEDS_STATS.forced++;
  log(g, gd, `${forced ? 'SENT' : 'schedules'} ${kind} → ${spot.name} from wp${gd.wp} (${(pathLen(c.pos, path)).toFixed(0)} m); walks at +${NEEDS.announceLead} s`);
  return true;
}
const pathLen = (from: Vec3, p: Vec3[]) => { let s = 0, prev = from; for (const q of p) { s += Math.hypot(q[0] - prev[0], q[2] - prev[2]); prev = q; } return s; };
/** Break the trip off wherever he is: the record goes, the need drops to afterCancel, nothing is resumed (the ordinary AI has him from this spot; back on 'patrol'
 *  his route's own logic walks him on). No line — whatever interrupted him has his mouth. */
function cancelTrip(g: Game, gd: Guard, M: NeedMem, why: string) {
  const T = M.trip; if (!T) return;
  M.trip = null; M.cancels++; NEEDS_STATS.cancelled++;
  const n = M.needs.find(x => x.kind === T.kind); if (n) n.level = Math.min(n.level, NEEDS.afterCancel);
  gd.stallRef = null; gd.char.anim.cancelTell();   // (a tell half-way up comes down now: the arm is the aim's / the flinch's from this frame)
  if (T.phase === 'telegraph') { const F = floor(g); if (F.lastDepartAt === T.departAt) F.lastDepartAt = T.gapBefore; }                                // nobody walked: the floor's gap is as it was
  else chronicle(g, 'needBreak', { who: gd.callsign, kind: T.kind, what: 'cancelled', why, phase: T.phase }, gd.char.pos);   // (a telegraph that came to nothing left no window: no row)
  log(g, gd, `${T.kind} CANCELLED in ${T.phase} — ${why}`);
}
/** the line for a slot, dealt off his name and his count so a probe hears the same and a night varies */
function pickLine(pool: string[], gd: Guard, salt: string): string { return pool[hashStr(`${gd.callsign}|${mem(gd).trips}|${mem(gd).cancels}|${salt}`) % pool.length]; }
/** the colleague he tells: the nearest living staff man (not in Sam's arm) whose head the words reach inside partnerM by the sound's own path */
function partnerFor(g: Game, gd: Guard): Guard | null {
  const mouth = gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.6, 0]); let best: Guard | null = null, bd = Infinity;
  for (const o of g.guards) {
    if (o === gd || o.state === 'dead' || o.held || o.team !== 'guard' || o.unit) continue;
    if (v3.dist(o.char.pos, gd.char.pos) > NEEDS.partnerM + 2) continue;   // (straight-line pre-filter: the propagation is the dear part)
    const pr = hearPath(g, mouth, o.char.bones.head ?? v3.add(o.char.pos, [0, 1.6, 0]));
    if (pr.pathLen < NEEDS.partnerM * pr.carry && pr.pathLen < bd) { bd = pr.pathLen; best = o; }
  }
  return best;
}
/** say it: to the partner's face (a bubble; he will answer), else over the net ('radio: …' — the strip the player reads their traffic on) */
function announce(g: Game, gd: Guard, T: Trip) {
  T.told = true; NEEDS_STATS.told++;
  const P = partnerFor(g, gd);
  if (P) {
    T.partner = P; T.replyAt = g.time + NEEDS.replyAfter; { const was = (g.level.scenarios?.quiet ? NEEDS_LINES.announceOwn[T.kind] : undefined) ?? NEEDS_LINES.announce[T.kind] ?? NEEDS_LINES.announce.coffee; T.line = pickLine(wg(was.map(t => NEEDS_LINES.now[t] ?? t), was), gd, 'announce'); }   // (a level with places of its own — quiet.ts — hears no 'fire door', no 'lobby')
    g.say(gd, T.line);
    log(g, gd, `tells ${P.callsign} (${v3.distXZ(P.char.pos, gd.char.pos).toFixed(1)} m): "${T.line}"`);
  } else {
    T.radio = true; NEEDS_STATS.radioed++; T.line = NEEDS_LINES.radio.replace('{who}', gd.callsign).replace('{short}', (WORDS.on && g.level.scenarios?.quiet ? NEEDS_LINES.shortOwn[T.kind] : undefined) ?? NEEDS_LINES.short[T.kind] ?? T.kind);   // (the net hears no 'fire door' either on a level with places of its own)
    g.say(gd, T.line, true); g.audio.play('radio', gd.char.bones.head ?? gd.char.pos, 0.4, { rate: 1.05 });
    log(g, gd, `radios it: "${T.line}"`);
  }
}
/** the partner's grumble, if he is still one to give it (alive, free, calm-ish, not mid-line himself) */
function partnerReply(g: Game, gd: Guard, T: Trip) {
  T.replied = true; const P = T.partner; if (!P) return;
  if (P.state === 'dead' || P.held || (P.state !== 'patrol' && P.state !== 'suspicious') || P.awareness >= 0.45 || !g.guards.includes(P) || (P.bubble && g.time - P.bubble.t < P.bubble.dur) || dozeAsleep(P)) {   // (doze.ts: a man asleep in his chair grumbles at nobody)
    log(g, gd, `${P.callsign} says nothing back (${P.state}, aw ${P.awareness.toFixed(2)})`); return; }
  const third = g.guards.find(x => x !== gd && x !== P && x.team === 'guard' && !x.unit && x.state !== 'dead') ?? null;
  const pool = third && (hashStr(`${P.callsign}|${mem(gd).trips}|other`) % 3 === 0) ? NEEDS_LINES.replyOther.map(s => s.replace(/\{other\}/g, third.callsign)) : w(T.kind === 'stretch' ? NEEDS_LINES.reply.filter(s => s !== 'Bring me one.') : NEEDS_LINES.reply, NEEDS_LINES.reply);   // (words.ts: there is nothing to bring back from a stretch of the legs)
  const line = pool[hashStr(`${P.callsign}|${gd.callsign}|${mem(gd).trips}|reply`) % pool.length];
  g.say(P, line); NEEDS_STATS.replies++;
  log(g, gd, `${P.callsign} answers: "${line}"`);
}

/** guards.ts, the patrol branch, once a frame for a man not held / paired / posted: if a trip owns his feet this frame, run them (stand and telegraph, walk out,
 *  dwell, walk back) and return true — the branch then skips its own route logic (his `wait` clock stands still meanwhile, so the route resumes exactly where it
 *  was); false = not on a trip, the branch walks his route as ever. `walk` = the branch's own patrol pace. */
export function needsPatrol(g: Game, gd: Guard, dt: number, walk: number): boolean {
  const M = memOf.get(gd); const T = M?.trip; if (!M || !T) return false;
  const c = gd.char; const now = g.time;
  const stand = () => { gd.speed = damp(gd.speed, 0, 8, dt); c.vel = [0, 0, 0]; };
  const pace = walk * NEEDS.paceK;
  switch (T.phase) {
    case 'telegraph': {
      stand();
      gd.sweep = damp(gd.sweep, Math.sin(gd.lookPhase * 0.9) * 0.45, 2, dt);   // (the waiting man's look-about, a little quieter: he has somewhere to be)
      const toGo = T.departAt - now;
      if (!T.watched) { T.watched = true; c.anim.tell('watch'); }                                             // T−lead: the watch (a second, eyes down on it)…
      const g0 = now - T.t0 - GLANCE_AT;                                                                       // …then the look the way he will go, held a couple of seconds (eased in and out, the neck's own limit)
      if (g0 > 0 && g0 < GLANCE_SECS) c.anim.lookYawExtra = clamp(wrapAngle(T.outYaw - c.bodyYaw), -1.1, 1.1) * Math.min(1, g0 / 0.35, (GLANCE_SECS - g0) / 0.45);
      else c.anim.lookYawExtra = Math.sin(gd.lookPhase * 1.3) * 0.3;
      if (!T.told && toGo <= NEEDS.sayLead) announce(g, gd, T);                                               // T−12: says so
      if (T.told && !T.replied && T.replyAt >= 0 && now >= T.replyAt) partnerReply(g, gd, T);                 // …and is grumbled at
      if (!T.necked && toGo <= NEEDS.stretchLead) { T.necked = true; c.anim.tell('neck'); }                    // T−5: the neck, and he turns to face the way out
      if (T.necked) c.bodyYaw = approachAngle(c.bodyYaw, T.outYaw, 2.2 * dt);
      if (toGo <= 0) {                                                                                         // T: off he goes
        T.phase = 'going'; T.leftAt = now; T.loopI = -1; floor(g).lastDepartAt = Math.max(floor(g).lastDepartAt, now); NEEDS_STATS.departed++;
        gd.stallRef = null; goTo(g, gd, T.spot.pos, true);
        chronicle(g, 'needBreak', { who: gd.callsign, kind: T.kind, what: 'left', to: T.spot.name, ...(g.level.scenarios?.quiet ? { own: 1 } : {}) }, c.pos);
        log(g, gd, `walks (${T.kind})`);
      }
      return true;
    }
    case 'going': {
      const goal = T.loopI >= 0 ? T.spot.loop![T.loopI] : T.spot.pos;
      goTo(g, gd, goal);
      const arrived = followPath(g, gd, dt, pace);
      gd.sweep = damp(gd.sweep, Math.sin(gd.lookPhase * 0.7) * 0.25, 2, dt); c.anim.lookYawExtra = 0;
      if (arrived) {
        gd.stallRef = null;
        if (v3.distXZ(c.pos, goal) > 1.2) { NEEDS_STATS.stuck++; cancelTrip(g, gd, M, 'no way through'); return true; }   // (an empty plan reads as arrived: he is not there — and this frame is still his: followPath has moved him once, the route takes him from the next)
        if (T.spot.loop && T.loopI + 1 < T.spot.loop.length) { if (T.loopI < 0) { T.arrivedAt = now; NEEDS_STATS.arrived++; log(g, gd, `at ${T.spot.name} after ${(now - T.leftAt).toFixed(1)} s — round the loop`); } T.loopI++; goTo(g, gd, T.spot.loop[T.loopI], true); return true; }
        if (T.spot.loop) { T.phase = 'returning'; T.dwellUntil = now; goTo(g, gd, gd.route.points[T.wp], true); log(g, gd, `loop walked in ${(now - T.arrivedAt).toFixed(1)} s — heading back`); return true; }
        T.phase = 'dwell'; T.arrivedAt = now; T.dwellUntil = now + (NEEDS.dwell[T.kind] ?? 20); NEEDS_STATS.arrived++;
        log(g, gd, `at ${T.spot.name} after ${(now - T.leftAt).toFixed(1)} s — ${(T.dwellUntil - now).toFixed(0)} s here`);
      } else if (notGettingAnywhere(gd, dt, NEEDS.stuckSecs)) { NEEDS_STATS.stuck++; cancelTrip(g, gd, M, 'stuck on the way'); return true; }
      return true;
    }
    case 'dwell': {
      stand();
      c.bodyYaw = approachAngle(c.bodyYaw, T.spot.face, 2.5 * dt);
      gd.sweep = damp(gd.sweep, Math.sin(gd.lookPhase * 0.5) * 0.3, 2, dt); c.anim.lookYawExtra = Math.sin(gd.lookPhase * 0.8) * 0.35;
      if (now >= T.dwellUntil) { T.phase = 'returning'; gd.stallRef = null; goTo(g, gd, gd.route.points[T.wp], true); log(g, gd, `done — heading back to wp${T.wp}`); }
      return true;
    }
    case 'returning': {
      const goal = gd.route.points[T.wp];
      goTo(g, gd, goal);
      const arrived = followPath(g, gd, dt, pace);
      gd.sweep = damp(gd.sweep, Math.sin(gd.lookPhase * 0.7) * 0.25, 2, dt); c.anim.lookYawExtra = 0;
      if (arrived) {
        gd.stallRef = null;
        if (v3.distXZ(c.pos, goal) > 1.5) { NEEDS_STATS.stuck++; cancelTrip(g, gd, M, 'no way back'); return true; }
        T.backAt = now; M.trip = null; M.trips++; M.lastBackAt = now; NEEDS_STATS.completed++;
        const n = M.needs.find(x => x.kind === T.kind); if (n) n.level = 0;
        const away = Math.round(now - T.leftAt);
        g.say(gd, pickLine(NEEDS_LINES.back, gd, 'back'));
        chronicle(g, 'needBreak', { who: gd.callsign, kind: T.kind, what: 'back', away }, c.pos);
        log(g, gd, `back on wp${T.wp} — away ${away} s (${T.kind}: out ${(T.arrivedAt - T.leftAt).toFixed(0)} s, there ${(T.dwellUntil - T.arrivedAt).toFixed(0)} s, back ${(now - T.dwellUntil).toFixed(0)} s)`);
        return false;   // (this frame is the route's again: the wait he had left runs on from here)
      } else if (notGettingAnywhere(gd, dt, NEEDS.stuckSecs)) { NEEDS_STATS.stuck++; cancelTrip(g, gd, M, 'stuck coming back'); return true; }
      return true;
    }
  }
  return false;
}

// ================================================================ the panel's button / the probes: send a man now
/** 'send Kowalski for a coffee now': the full telegraph from this frame wherever he stands (his slot or the floor's gap notwithstanding), then the trip. Returns
 *  a note for the panel: why not, if not. */
export function needsSend(g: Game, gd: Guard | null | undefined, kind: NeedKind = 'coffee'): string {
  if (!gd) return 'no such man';
  if (!g.tune.needs) return 'needs are switched off';
  if (gd.state === 'dead') return `${gd.callsign} is down`;
  if (gd.team !== 'guard' || gd.unit) return `${gd.callsign} is not on the night staff`;
  if (!needsLive(g)) return 'not now (the tour / daylight / the response team / the AI off / the player down)';
  if (!floorCalm(g)) return 'not now — the floor is up (or in the dark)';
  const why = manCalm(g, gd, CALM_AWARENESS) ? null : interruptOf(g, gd) ?? 'busy';
  if (why) return `${gd.callsign} would not go now: ${why}`;
  const M = mem(gd); if (!M.dealt) deal(g, gd, M);
  if (M.trip) return `${gd.callsign} is already ${M.trip.phase === 'telegraph' ? 'about to go' : 'away'} (${M.trip.kind})`;
  if (!scheduleTrip(g, gd, M, kind, true)) return `${gd.callsign} cannot get to ${needSpot(g, kind)?.name ?? `a place for ${kind} (this floor has none)`} from where he stands`;
  return `${gd.callsign}: ${kind} — watch him (walks in ${NEEDS.announceLead} s)`;
}
/** the probes: put a man's need at a level (deals him first); false if he does not carry that kind */
export function needsSetLevel(g: Game, gd: Guard, kind: NeedKind, level: number): boolean {
  const M = mem(gd); if (!M.dealt) deal(g, gd, M);
  const n = M.needs.find(x => x.kind === kind); if (!n) return false; n.level = level; return true;
}

// ================================================================ persistence (one key, per machine — the switch and the fairness knobs)
const LS_KEY = 'twopointsix.needs';
export function saveNeeds(tune: { needs: boolean }) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ on: tune.needs, rateK: NEEDS.rateK, maxAway: NEEDS.maxAway, announceLead: NEEDS.announceLead, dwell: NEEDS.dwell })); }
  catch { /* no storage (the harness, a locked-down page): nothing to keep */ }
}
export function loadNeeds(tune: { needs: boolean }) {
  try {
    const j = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null'); if (!j || typeof j !== 'object') return;
    if (typeof j.on === 'boolean') tune.needs = j.on;
    if (Number.isFinite(j.rateK)) NEEDS.rateK = clamp(j.rateK, 0.1, 60);
    if (Number.isFinite(j.maxAway)) NEEDS.maxAway = clamp(Math.round(j.maxAway), 0, 3);
    if (Number.isFinite(j.announceLead)) NEEDS.announceLead = clamp(j.announceLead, 8, 60);
    if (j.dwell && typeof j.dwell === 'object') for (const k of NEED_KINDS) if (Number.isFinite(j.dwell[k])) NEEDS.dwell[k] = clamp(j.dwell[k], 0, 180);
  } catch { /* nothing stored, or not readable: the shipped values stand */ }
}
/** the knobs back to the shipped values (the switch back on) and the stored copy dropped */
export function resetNeeds(tune: { needs: boolean }) {
  tune.needs = true; NEEDS.rateK = NEEDS_DEFAULTS.rateK; NEEDS.maxAway = NEEDS_DEFAULTS.maxAway; NEEDS.announceLead = NEEDS_DEFAULTS.announceLead; Object.assign(NEEDS.dwell, NEEDS_DEFAULTS.dwell);
  try { localStorage.removeItem(LS_KEY); } catch { /* none */ }
}

// ================================================================ checkpoints (game/savestate.ts): every staff man's needs + the trip under way, and the floor's gap clock
/** one man's slice, by roster index (null = the needs have never touched him: a corpse from before, the switch off) */
export interface NeedsManSnap { needs: Need[]; trip: (Omit<Trip, 'spot' | 'partner'> & { partner: number }) | null; lastBackAt: number; trips: number; cancels: number; shaken: boolean; dealt: boolean; }
export interface NeedsSnap { men: (NeedsManSnap | null)[]; lastDepartAt: number; }
export function needsSnapshot(g: Game): NeedsSnap {
  const men = g.guards.map((gd): NeedsManSnap | null => {
    const M = memOf.get(gd); if (!M) return null;
    const T = M.trip;
    return { needs: M.needs.map(n => ({ ...n })), lastBackAt: M.lastBackAt, trips: M.trips, cancels: M.cancels, shaken: M.shaken, dealt: M.dealt,
      trip: T ? { kind: T.kind, phase: T.phase, forced: T.forced, t0: T.t0, departAt: T.departAt, leftAt: T.leftAt, arrivedAt: T.arrivedAt, dwellUntil: T.dwellUntil, backAt: T.backAt, wp: T.wp, outYaw: T.outYaw,
        watched: T.watched, told: T.told, partner: T.partner ? g.guards.indexOf(T.partner) : -1, radio: T.radio, replyAt: T.replyAt, replied: T.replied, necked: T.necked, loopI: T.loopI, line: T.line, gapBefore: T.gapBefore } : null };
  });
  return { men, lastDepartAt: floorOf.get(g)?.lastDepartAt ?? -1e9 };
}
/** …and back onto the (fresh) roster: a trip comes back in the phase it was in — the man telegraphing goes on to walk at his departAt, the man at the counter
 *  finishes his coffee, the man walking there or back plans his path afresh next frame (goTo) from where he stands */
export function needsRestore(g: Game, s: NeedsSnap | null | undefined) {
  if (!s) return;
  floor(g).lastDepartAt = Number.isFinite(s.lastDepartAt) ? s.lastDepartAt : -1e9;
  s.men?.forEach((S, i) => {
    const gd = g.guards[i]; if (!gd || !S) return;
    const M = mem(gd);
    M.needs = (S.needs ?? []).filter(n => NEED_KINDS.includes(n.kind)).map(n => ({ kind: n.kind, level: clamp(Number(n.level) || 0, 0, LEVEL_CAP), fillMin: Math.max(0.1, Number(n.fillMin) || 1), wp: n.wp | 0, tripM: Number(n.tripM) || 0 }));
    M.lastBackAt = Number.isFinite(S.lastBackAt) ? S.lastBackAt : -1e9; M.trips = S.trips | 0; M.cancels = S.cancels | 0; M.shaken = !!S.shaken; M.dealt = !!S.dealt;
    const T = S.trip;
    M.trip = T && needSpot(g, T.kind) && gd.state !== 'dead' ? { kind: T.kind, spot: needSpot(g, T.kind)!, phase: T.phase, forced: !!T.forced, t0: T.t0, departAt: T.departAt, leftAt: T.leftAt, arrivedAt: T.arrivedAt, dwellUntil: T.dwellUntil, backAt: T.backAt, wp: T.wp | 0, outYaw: T.outYaw,
      watched: !!T.watched, told: !!T.told, partner: T.partner >= 0 ? g.guards[T.partner] ?? null : null, radio: !!T.radio, replyAt: T.replyAt, replied: !!T.replied, necked: !!T.necked, loopI: T.loopI | 0, line: T.line ?? '', gapBefore: T.gapBefore } : null;
  });
}

// ================================================================ panel / QA
/** 'needs ▸ Kowalski coffee 0.82 · smoke 0.40 | Novak AWAY coffee (dwell, 12 s left) | Reyes stretch 1.00 — waits for wp6 · slot 1/1' */
export function needsSummary(g: Game): string {
  if (!g.tune.needs) return 'needs ▸ off';
  const parts: string[] = []; let away = 0;
  for (const gd of g.guards) {
    const M = memOf.get(gd); if (!M || gd.state === 'dead' || !M.needs.length) continue;
    const T = M.trip;
    if (T) { away++;
      const s = T.phase === 'telegraph' ? `about to go — ${T.kind} in ${Math.max(0, T.departAt - g.time).toFixed(0)} s${T.told ? (T.radio ? ' (radioed)' : ` (told ${T.partner?.callsign ?? '?'})`) : ''}` : T.phase === 'going' ? `walking to ${T.spot.name}` : T.phase === 'dwell' ? `at ${T.spot.name}, ${Math.max(0, T.dwellUntil - g.time).toFixed(0)} s left` : `coming back to wp${T.wp}`;
      parts.push(`${gd.callsign} AWAY ${s}${T.forced ? ' [sent]' : ''}`);
    } else {
      const full = M.needs.filter(n => n.level >= 1).sort((a, b) => b.level - a.level)[0];
      parts.push(`${gd.callsign} ${M.needs.map(n => `${n.kind} ${n.level.toFixed(2)}`).join(' ')}${full ? ` — waits for wp${full.wp}` : ''}${g.time - M.lastBackAt < NEEDS.restSecs ? ` (rests ${Math.ceil(NEEDS.restSecs - (g.time - M.lastBackAt))} s)` : ''}`);
    }
  }
  const gap = NEEDS.floorGapSecs - (g.time - floor(g).lastDepartAt);
  return `needs ▸ ${needsLive(g) && floorCalm(g) ? '' : 'FROZEN · '}${parts.join(' | ') || 'nobody dealt yet'} · slot ${away}/${NEEDS.maxAway}${gap > 0 ? ` · floor gap ${Math.ceil(gap)} s` : ''}`;
}
