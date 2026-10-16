// The run's chronicle — the debrief's memory. A timeline of what happened to Sam and round him this run (spotted, heard, an alarm going up, a man put down, a body
// found, a light shot out, a lock picked …), every entry stamped with the mission clock, the ROOM it happened in and the floor point; his PATH over the floor
// sampled twice a second; and the handful of counters the stealth score is made of that the mission's own tallies (game.ts MissionStats) do not already keep.
// Written where the thing already happens — one-line hooks in guards.ts / combat.ts / lighting.ts / player.ts / game.ts / mission.ts, listed on each helper below —
// through the same gate as the mission's tallies (mission.ts missionLive: live play only — nothing the showcase tour, its puppet or the attract loop does is the
// player's run, and a run that is over stops writing), O(1) per entry, capped, no allocation per frame beyond the half-second path sample.
// Read by the debrief card (ui/debrief.ts: the score, the rating word, the badges, the stats grid, the scrollable timeline, the floor map with the path and the
// pins) and by the QA probes (tools/qa/debrief-probes.ts). Lives on Game.chronicle; restartEncounter() replaces it; the end card and the down card read it as it
// stood when the run ended, and it survives 'Keep playing' (nothing more is written: the mission is done).
import { Vec3, v3, clamp } from '../math/vec';
import type { Game, Guard, GameEvent, LightTarget, MissionStats, DownKind } from './game';
import type { Door } from './doors';
import { PLAYER_ID } from './consts';
import { BUILDING } from './floor';   // (a leaf: the office building's footprint — everything outside it is the grounds: the car park south and east, the verge north and west)
import { gearText, plainShort } from './gear';   // (a leaf: the kit's names as issued, where a row is worded)
import { missionLive } from './mission';
import type { Level } from '../scene/level';
import { isOffice, levelRects, ownPlace } from './dialogue';

// ------------------------------------------------------------ rooms
/** The floor's rooms as the debrief names them: nominal partition lines of the one office level (scene/level.ts — the corridor z 10‥12.2 across the building,
 *  four rooms north of it, three south; the walls themselves are 12 / 24 cm about these lines, which a name does not care about). First match wins. Kept here,
 *  not in the level, while the level format is being turned into data (G1): a `rooms[]` block there replaces this table when it lands. */
export const ROOMS: { name: string; x0: number; x1: number; z0: number; z1: number }[] = [
  { name: 'corridor', x0: 4, x1: 36, z0: 10, z1: 12.2 },
  { name: 'conference room', x0: 4, x1: 14, z0: 4, z1: 10 },
  { name: 'server room', x0: 14, x1: 22, z0: 4, z1: 10 },
  { name: "manager's office", x0: 22, x1: 30, z0: 4, z1: 10 },
  { name: 'storage', x0: 30, x1: 36, z0: 4, z1: 10 },
  { name: 'lobby', x0: 4, x1: 12, z0: 12.2, z1: 24 },
  { name: 'cubicles', x0: 12, x1: 28, z0: 12.2, z1: 24 },
  { name: 'break room', x0: 28, x1: 36, z0: 12.2, z1: 24 },
];
/** … and the rooms of the level a run is on, for the debrief's map: the office's table above, or another level's own names (none: no labels) */
export function roomsOf(level: Level): { name: string; x0: number; x1: number; z0: number; z1: number }[] {
  return isOffice(level) ? ROOMS : (levelRects(level) ?? []).map(r => ({ name: r.name.replace(/^the /, ''), x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 }));
}
/** The room a floor point is in, by name; outside the building the side of it ('south lot' — the car park along the facade — 'east side' with the fire exit and
 *  the dumpster, 'north side', 'west side'). `level` = the level the point is on: off the office it is named by that level's own data ('front hall'; the nearest
 *  named place for a point in none; 'building' on a level that names nothing) — without it, the office's table (the autosave's regions, which only need a partition). */
export function roomOf(p: Vec3, level?: Level): string {
  if (level && !isOffice(level)) {   // another level: ITS rooms and places (dialogue.ts levelRects), never this table's
    const w = ownPlace(level, p); return w ? w.rect.name.replace(/^the /, '') : 'building';   // (a noun for 'the … camera', 'in the …': the place he is in, else the nearest the level names)
  }
  const x = p[0], z = p[2];
  if (x >= BUILDING.x0 && x < BUILDING.x1 && z >= BUILDING.z0 && z < BUILDING.z1) { for (const r of ROOMS) if (x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1) return r.name; return 'corridor'; }
  if (z >= BUILDING.z1) return 'south lot';
  if (x >= BUILDING.x1) return 'east side';
  if (z < BUILDING.z0) return 'north side';
  return 'west side';
}
/** interior = inside the building's footprint (the map shades the grounds darker) */
export function indoors(p: Vec3): boolean { return p[0] >= BUILDING.x0 && p[0] < BUILDING.x1 && p[2] >= BUILDING.z0 && p[2] < BUILDING.z1; }

// ------------------------------------------------------------ the record
export type ChronKind =
  | 'objective'      // the mission thread moved (mission.ts): the server room reached, hands on the drive, the drive out, out through the fire exit
  | 'spotted'        // an alert man had eyes on Sam — a fresh sighting episode (mission.ts, the same edge that counts stats.spotted): by whom, the floor's alarm level then
  | 'contact'        // a man went to 'alert' (guards.ts updateGuard's transition): who, and what did it (sight / sound / radio / body)
  | 'heard'          // a noise of Sam's making reached a man and counted (guards.ts hearingCheck): what it was, who, what it did to him — merged per noise and per kind
  | 'lost'           // an alert man's chase ended without him: down to a search (guards.ts dropToSearch)
  | 'calm'           // a searching man gave it up (guards.ts, the search branch's end)
  | 'alarm'          // the floor's alarm level changed (guards.ts raiseEscalation / stepDownEscalation): stage, up or down, why
  | 'radio'          // a line went over the guards' net (guards.ts say with radio) — the routine radio check is not kept
  | 'shot'           // Sam fired (combat.ts fireWeapon): the weapon, what the round went into, whether a living man was within SHOT_NEAR_M of it — merged per burst
  | 'lightShot'      // a fixture shot out (combat.ts fireWeapon's light pass)
  | 'ocp'            // the OCP knocked something out (lighting.ts ocp): a fixture, a man's torch
  | 'blackout'       // the mains went (lighting.ts setBlackout): tripped by the OCP, shot, thrown by hand
  | 'thrown'         // a canister left his hand (player.ts, the pending throw's release): smoke / stun
  | 'grab'           // a man taken from behind into his arm (player.ts startGrab)
  | 'interrogated'   // one exchange with a man (game.ts interrogate): who, and the useful thing he gave, if any
  | 'keyTaken'       // a key came off a questioned man's belt (player.ts takeKey)
  | 'ko' | 'kill'    // a man put down by Sam (combat.ts killGuard, by 'player'): out cold (takedown / choke / whip / ring) or shot dead
  | 'bodyFound'      // a body discovered (guards.ts: walked onto, or watched going down): whose, by whom, breathing or not
  | 'doorKicked' | 'lockPicked'   // player.ts updateKick's impact / updatePicking's last click
  | 'hit' | 'down'   // a round found Sam (combat.ts fireWeapon → hitPlayer): still up / down
  | 'needBreak'      // a man left his route for a need / came back onto it / had the trip broken off (needs.ts): who, kind, what — the window the player had
  | 'civilianSpotted' | 'civilianReported' | 'civilianComplied' | 'civilianKO' | 'civilianKilled'   // the civilians (civilians.ts): one SAW Sam (or was grabbed) / told a guard or rang it in (or control rang after she got out) / told to stay down and did / put out cold / killed — by Sam's hand
  | 'cameraSpotted' | 'cameraAlarm' | 'laserTripped' | 'deviceDown' | 'codeLearned' | 'codeEntered'   // the devices (devices.ts): a camera called him in / put the floor up, a beam broken, a camera or an emitter shot dead and called in, a door code learned (told / overheard) / keyed in
  | 'checkpoint';    // a checkpoint written or loaded (G5's saveState / loadState call chronCheckpoint)
export type ChronData = { [k: string]: string | number | boolean | undefined };
export interface ChronEvent { t: number; kind: ChronKind; room: string; pos: Vec3; data: ChronData; }

/** the timeline holds this many entries; the chattier kinds (a noise heard, a burst fired, a radio line, a man losing / giving up, a man's coffee break, a checkpoint
 *  WRITTEN) stop being kept at SOFT so the rest of a very long run — its alarms, bodies, kills, loads — still lands; anything refused is counted in `dropped` (the card says so) */
export const MAX_EVENTS = 700, SOFT_EVENTS = 520;
const CHATTER: ReadonlySet<ChronKind> = new Set<ChronKind>(['heard', 'shot', 'radio', 'lost', 'calm', 'contact', 'needBreak']);
/** is this row chatter (let go of first): the kinds above, and a checkpoint SAVED (a load is the player's doing and priced — it stays news) */
const isChatter = (kind: ChronKind, data: ChronData) => CHATTER.has(kind) || (kind === 'checkpoint' && data.what !== 'load');
/** the counters that are plain numbers (chronicleN moves one by name) */
export type ChronCountKey = { [K in keyof ChronCounts]: ChronCounts[K] extends number ? K : never }[keyof ChronCounts];
/** the path: a point every PATH_SECS of the mission clock, at most PATH_CAP of them — when full the buffer is thinned to every other point and the interval doubles,
 *  so the polyline always spans the whole run (a two-hour run ends up at one point every 4 s) */
export const PATH_CAP = 4000, PATH_SECS = 0.5;
/** a noise of the same kind within this many seconds of the last one heard is the same timeline row (footsteps are a row, not forty); a round within SHOT_MERGE
 *  of the last into the same sort of thing is the same row (a magazine emptied into a wall is one line ×30) */
const HEARD_MERGE_SECS = 8, SHOT_MERGE_SECS = 2.5;
/** a round that stops within this of a living man was fired 'near men' (the score's shots term; a hit is nearer still) */
export const SHOT_NEAR_M = 3;

/** What the score needs beyond MissionStats, counted as the entries are written (so the numbers stay right even when the timeline has stopped keeping chatter). */
export interface ChronCounts {
  seenUp: number;          // sightings that happened with the floor ALREADY up (heightened / lockdown): seen again after they knew is worse
  esc1: number; esc2: number;   // times the floor went up to heightened / to lockdown
  shotsNearMen: number;    // Sam's rounds into or within SHOT_NEAR_M of a living man
  lightsShot: number; ocps: number; blackouts: number;
  kicked: number; picked: number; intel: number; thrown: number; grabs: number; contacts: number; heard: number; radio: number;
  civSeen: number; civReported: number; civComplied: number; civKO: number; civKilled: number;   // the civilians (civilians.ts): saw him · told the men / rang it in · did as told · out cold · dead — the score's own three terms and the 'unseen by staff' badge
  devices: number;         // times security's devices called him in (a camera's 'movement in …' / a beam broken) — the score's small 'they know something' term; a device putting the floor UP is already esc1 / esc2
  hits: number; down: boolean; downBy: string;
  saves: number; loads: number;
}
const newCounts = (): ChronCounts => ({ seenUp: 0, esc1: 0, esc2: 0, shotsNearMen: 0, lightsShot: 0, ocps: 0, blackouts: 0, kicked: 0, picked: 0, intel: 0, thrown: 0, grabs: 0, contacts: 0, heard: 0, radio: 0, civSeen: 0, civReported: 0, civComplied: 0, civKO: 0, civKilled: 0, devices: 0, hits: 0, down: false, downBy: '', saves: 0, loads: 0 });

export class Chronicle {
  events: ChronEvent[] = [];
  /** entries refused by the caps (the card admits to it) */
  dropped = 0;
  counts: ChronCounts = newCounts();
  /** callsigns Sam has had at least one exchange with (the 'talkative' badge wants all of them) */
  questioned = new Set<string>();
  /** the path: x, z, t triples in a flat array, `pathN` of them; sampled every `pathEvery` s of the mission clock, next at `pathNext` */
  path = new Float32Array(PATH_CAP * 3); pathN = 0; pathEvery = PATH_SECS; pathNext = 0;
  /** which hearing-model event has already made a row (three men hearing one shot are one row with three names), and the row it made */
  private heardOf = new WeakMap<object, ChronEvent>();

  /** hearing-model events that were COUNTED (counts.heard) but could not make a row (the caps): the next man hearing the same noise must not count it again */
  private heardNoRow = new WeakSet<object>();

  /** the core append: null when refused (caps). `pos` is copied; `level` = the level the run is on (the row's room is in ITS words). */
  add(t: number, kind: ChronKind, pos: Vec3, data: ChronData, level?: Level): ChronEvent | null {
    const n = this.events.length;
    if (n >= MAX_EVENTS || (n >= SOFT_EVENTS && isChatter(kind, data))) { this.dropped++; return null; }
    const e: ChronEvent = { t, kind, room: roomOf(pos, level), pos: [pos[0], 0, pos[2]], data };
    this.events.push(e); return e;
  }
  /** the latest row of `kind` whose data[keyName] === key within `win` seconds of `t`, looking back no further than a handful of rows (O(1)) */
  recent(kind: ChronKind, keyName: string, key: string | number, t: number, win: number): ChronEvent | null {
    const ev = this.events;
    for (let i = ev.length - 1, k = 0; i >= 0 && k < 8; i--, k++) { const e = ev[i]; if (t - e.t > win) return null; if (e.kind === kind && e.data[keyName] === key) return e; }
    return null;
  }
  heardRow(e: object): ChronEvent | undefined { return this.heardOf.get(e); }
  bindHeard(e: object, row: ChronEvent) { this.heardOf.set(e, row); }
  heardCounted(e: object): boolean { return this.heardNoRow.has(e); }
  markHeardCounted(e: object) { this.heardNoRow.add(e); }
  /** one path sample at mission time t (thins itself when full) */
  sample(x: number, z: number, t: number) {
    if (this.pathN >= PATH_CAP) {   // keep every other point, twice the interval from here: the whole run stays on the map at half the resolution
      const P = this.path; let w = 0; for (let r = 0; r < this.pathN; r += 2, w++) { P[w * 3] = P[r * 3]; P[w * 3 + 1] = P[r * 3 + 1]; P[w * 3 + 2] = P[r * 3 + 2]; }
      this.pathN = w; this.pathEvery *= 2;
    }
    const i = this.pathN * 3; this.path[i] = x; this.path[i + 1] = z; this.path[i + 2] = t; this.pathN++;
    this.pathNext = t + this.pathEvery;
  }
}

// ------------------------------------------------------------ writing (the hooks call these; every one is a no-op outside a live run)
const nowOf = (g: Game) => g.mission.stats.elapsed;
const posOf = (g: Game): Vec3 => g.player.char.pos;
/** the generic entry: `kind` at `pos` (Sam's feet by default) with `data` — what a lane with a new verb calls (and what the named helpers below come down to) */
export function chronicle(g: Game, kind: ChronKind, data: ChronData = {}, pos?: Vec3): ChronEvent | null {
  if (!missionLive(g)) return null;
  return g.chronicle.add(nowOf(g), kind, pos ?? posOf(g), data, g.level);
}
/** the generic entry AND one of the counters, by name: the counter moves whenever the run is live — whether or not the capped timeline still takes the ROW (a
 *  three-hour run whose timeline filled long ago is still priced for the lockdown it then raises; review U9.2). What the civilians / devices lanes call. */
export function chronicleN(g: Game, kind: ChronKind, count: ChronCountKey, data: ChronData = {}, pos?: Vec3): ChronEvent | null {
  if (!missionLive(g)) return null;
  g.chronicle.counts[count]++;
  return g.chronicle.add(nowOf(g), kind, pos ?? posOf(g), data, g.level);
}

/** Once a frame from mission.ts updateMission (inside its live gate, after the clock moved): the path sample when it is due. */
export function tickChronicle(g: Game) {
  const C = g.chronicle, t = nowOf(g);
  if (t >= C.pathNext) { const p = posOf(g); C.sample(p[0], p[2], t); }
}

/** mission.ts: the stage machine moved — `text` is the row ('reached the server room', 'the drive is out', …) */
export function chronObjective(g: Game, text: string, pos?: Vec3) { return chronicle(g, 'objective', { text }, pos); }

/** mission.ts, the sighting-episode edge (the one that counts stats.spotted): an alert man has eyes on him afresh. Weighted for the score by the floor's alarm level
 *  at that moment — seen again once they already know is worse (counts.seenUp). */
export function chronSpotted(g: Game, by: Guard | undefined) {
  const lvl = g.escalation;
  return lvl >= 1 ? chronicleN(g, 'spotted', 'seenUp', { by: by?.callsign ?? 'a guard', lvl }) : chronicle(g, 'spotted', { by: by?.callsign ?? 'a guard', lvl });   // (every counter below moves with the run LIVE, row kept or not — review U9.2; chronShot always had it so)
}

/** guards.ts updateGuard, the transition into 'alert' (right where witness.alertedBy is booked): who, and what did it. */
export function chronContact(g: Game, gd: Guard) { return chronicleN(g, 'contact', 'contacts', { who: gd.callsign, cause: gd.witness.alertedBy ?? 'radio' }, gd.char.pos); }

/** guards.ts hearingCheck, at each place a noise actually raised a man (the light dying near him, the odd quiet report, gunfire / a stun charge / a door going in,
 *  a door or furniture noise, a footfall): only noises of SAM's making count (his events carry no `who`, or his id, or 0 — a clatter nobody living made, which on
 *  this floor is a gun leaving a hand he emptied); one row per noise however many hear it (their names join the row), and a run of the same kind of noise inside
 *  HEARD_MERGE_SECS is one row with a count. `where` = where the man places it (the doorway it came through), else the source. */
export function chronHeard(g: Game, gd: Guard, ev: GameEvent, where?: Vec3) {
  if (!missionLive(g)) return null;
  const who = ev.who; if (who !== undefined && who !== PLAYER_ID && who !== 0) return null;   // a colleague's round, a guard's own door: not Sam's doing
  const C = g.chronicle, t = nowOf(g);
  const react = gd.awareness >= 0.85 ? 'alerted' : gd.awareness >= 0.3 ? 'investigates' : 'pricks up';
  let row = C.heardRow(ev);
  if (!row) {
    if (C.heardCounted(ev)) return null;   // (counted for the first man who heard it, no row to be had: the second is not another noise)
    const what = heardWhat(ev);
    row = C.recent('heard', 'what', what, t, HEARD_MERGE_SECS) ?? undefined;
    if (row) row.data.n = (Number(row.data.n) || 1) + 1;
    else { C.counts.heard++; row = C.add(t, 'heard', where ?? ev.pos, { what, by: gd.callsign, k: 1, n: 1, react }, g.level) ?? undefined; if (!row) C.markHeardCounted(ev); }
    if (!row) return null;
    C.bindHeard(ev, row);
  }
  const names = String(row.data.by);
  if (!names.split(', ').includes(gd.callsign)) { const k = Number(row.data.k) || 1; row.data.by = k < 3 ? `${names}, ${gd.callsign}` : names; row.data.k = k + 1; }
  if (RANK[react] > RANK[String(row.data.react)]) row.data.react = react;   // the row says the most it did to anybody
  return row;
}
const RANK: Record<string, number> = { 'pricks up': 0, investigates: 1, alerted: 2 };
/** what a hearing-model event of Sam's IS, in the timeline's words */
export function heardWhat(e: GameEvent): string {
  switch (e.kind) {
    case 'shot': return (e.level ?? 0) >= 1 ? 'gunfire' : e.weapon ? 'a muffled shot' : 'a canister';   // (a canister's pop / skitter goes in as a quiet 'shot' with no weapon row)
    case 'guardShot': return 'gunfire';
    case 'kick': return 'a door kicked in';
    case 'bang': return e.frag ? 'a grenade' : 'a stun charge';
    case 'door': return (e.level ?? 0) >= 0.6 ? 'a door slammed' : 'a door';
    case 'prop': return e.who === 0 ? 'a clatter' : (e.level ?? 0) >= 0.5 ? 'a crash of furniture' : 'a scrape';
    case 'step': return 'footsteps';
    case 'lightOut': return 'a light going out';
    case 'glass': return 'a round into the glass';
  }
  return 'a noise';
}

/** guards.ts dropToSearch: the alert chase is over without him. */
export function chronLost(g: Game, gd: Guard) { return chronicle(g, 'lost', { who: gd.callsign }, gd.char.pos); }
/** guards.ts, the search branch letting go: he gives it up ('returning to patrol'). */
export function chronCalm(g: Game, gd: Guard) { return chronicle(g, 'calm', { who: gd.callsign }, gd.char.pos); }

/** guards.ts raiseEscalation (an actual rise) / stepDownEscalation: the floor's alarm level moved to `stage` (0 calm · 1 heightened · 2 lockdown), `up` or down,
 *  and for a rise what caused it (a search that found nobody, a body, a man missing, a hostage). Pinned at the alarm's fix when there is one. */
export function chronAlarm(g: Game, stage: number, up: boolean, cause = '') {
  const pos: Vec3 = g.alarm.placed ? g.alarm.pos : posOf(g);
  return up ? chronicleN(g, 'alarm', stage >= 2 ? 'esc2' : 'esc1', { stage, up, cause }, pos) : chronicle(g, 'alarm', { stage, up, cause }, pos);
}

/** guards.ts say, when the line goes over the net (radio) — except the routine radio check, which is nobody's news. */
export function chronRadio(g: Game, gd: Guard, text: string) {
  if (/^(\w+: )?radio check — sound off$|^radio check/.test(text)) return null;   // (the staff's, and a defender squad's own: "Bravo: radio check — sound off")
  return chronicleN(g, 'radio', 'radio', { who: gd.callsign, text: text.length > 96 ? text.slice(0, 94) + '…' : text }, gd.char.pos);
}

/** combat.ts fireWeapon, Sam's round: which weapon, what it went into (a man / geometry), and whether a living man stood within SHOT_NEAR_M of where it stopped
 *  (the score's 'shots near men'). A burst into the same sort of thing is one row with a count. */
export function chronShot(g: Game, weapon: string, hitGuard: Guard | null, hitP: Vec3) {
  if (!missionLive(g)) return null;
  const C = g.chronicle, t = nowOf(g);
  if (hitGuard) { C.counts.shotsNearMen++; return null; }   // into a man: the 'kill' row (killGuard, a moment ago) already says everything this one would
  let near = false, nearest = '';
  { let bd = SHOT_NEAR_M; for (const gd of g.guards) { if (gd.state === 'dead') continue; const d = v3.dist(gd.char.bones.chest ?? gd.char.pos, hitP); if (d < bd) { bd = d; near = true; nearest = gd.callsign; } } }
  if (near) C.counts.shotsNearMen++;
  const into = near ? `past ${nearest}` : 'geometry';
  const prev = C.recent('shot', 'into', into, t, SHOT_MERGE_SECS);
  if (prev && prev.data.weapon === weapon) { prev.data.n = (Number(prev.data.n) || 1) + 1; return prev; }
  return C.add(t, 'shot', posOf(g), { weapon, into, near, n: 1 }, g.level);
}
/** combat.ts fireWeapon's light pass: a fixture shot out. */
export function chronLightShot(g: Game, tg: LightTarget) { return chronicleN(g, 'lightShot', 'lightsShot', { name: fixtureName(tg) }, tg.pos); }
/** lighting.ts ocp: the OCP put something out — a fixture, or the torch in a man's hand. */
export function chronOcp(g: Game, what: string, pos: Vec3) { return chronicleN(g, 'ocp', 'ocps', { what }, pos); }
/** lighting.ts setBlackout (not the panel's button): the mains went — tripped by the OCP, destroyed by a round, thrown by hand. */
export function chronBlackout(g: Game, cause: string) { if (missionLive(g) && cause === 'ocp') g.chronicle.counts.ocps++; return chronicleN(g, 'blackout', 'blackouts', { cause }, g.level.breaker.pos); }
/** a fixture's name in words: 'panel_corridor_12' → 'a corridor ceiling panel', 'desk_lamp' → 'the desk lamp' */
export function fixtureName(tg: { name: string; group: string }): string {
  if (/^panel_/.test(tg.name)) return `a ${tg.group} ceiling panel`;
  if (/^monitor\d*/.test(tg.name)) return 'a monitor';
  if (/^beacon\d*/.test(tg.name)) return 'an emergency beacon';
  if (/^exit_sign/.test(tg.name)) return 'an exit sign';
  if (/^vending/.test(tg.name)) return 'a vending machine';
  return 'the ' + tg.name.replace(/_?\d+$/, '').replace(/_/g, ' ');
}

/** player.ts, the pending throw's release: a canister is away. */
export function chronThrown(g: Game, kind: string) { return chronicleN(g, 'thrown', 'thrown', { kind }); }
/** player.ts startGrab: a man taken into the arm. */
export function chronGrab(g: Game, gd: Guard) { return chronicleN(g, 'grab', 'grabs', { who: gd.callsign }, gd.char.pos); }
/** game.ts interrogate: one exchange — who, the stage it was, and the useful thing's kind if he gave one (counts.intel; `questioned` keeps who has been leaned on) */
export function chronInterrogated(g: Game, gd: Guard, kind: string | null, stage: number) {
  if (!missionLive(g)) return null;
  if (!gd.civ) g.chronicle.questioned.add(gd.callsign); if (kind) g.chronicle.counts.intel++;   // (questioned = MEN of the shift leaned on — the 'talkative' badge counts them against the roster; a civilian's row stands in the timeline, her intel counts)
  return chronicle(g, 'interrogated', { who: gd.callsign, gave: kind ?? '', stage, ...(gd.civ ? { civilian: true, she: gd.civ.she, her: gd.civ.her } : {}) }, gd.char.pos);
}
/** player.ts takeKey (a fresh key only — the same edge as the tally) */
export function chronKey(g: Game, gd: Guard) { return chronicle(g, 'keyTaken', { who: gd.callsign }, gd.char.pos); }

/** combat.ts killGuard, by the player's hand: shot dead ('kill', with what) or out cold ('ko': the takedown's cross, the choke, the pistol-whip, a ring to the head —
 *  told apart the way killGuard's own log line is: `how` + the caller's line). */
export function chronDown(g: Game, gd: Guard, how: DownKind, line?: string) {
  if (how === 'shot') return chronicle(g, 'kill', { who: gd.callsign, weapon: /^knife/.test(line ?? '') ? 'knife' : (g.player.gunInHand() ? plainShort(g.player.gunInHand()!.def) : 'a round') }, gd.char.pos);   // (the knife: close.ts's lethal blow, told by its line as the ring and the whip are)
  const method = how === 'wounded' ? 'wounded' : how === 'choked' ? 'choke' : /^ring/.test(line ?? '') ? 'ring' : /whip/.test(line ?? '') ? 'whip' : 'takedown';
  return chronicle(g, 'ko', { who: gd.callsign, method }, gd.char.pos);
}
/** guards.ts: a body discovered — walked onto (bodyInView) or watched going down (the standoff's end): whose, by whom, and found breathing or not. */
export function chronBodyFound(g: Game, body: Guard, by: Guard) {
  const h = body.char.bones.hips ?? body.char.pos;
  return chronicle(g, 'bodyFound', { who: body.callsign, by: by.callsign, breathing: body.downKind !== null && body.downKind !== 'shot', ...(body.wound ? { wounded: true } : null) }, [h[0], 0, h[2]]);
}
/** combat.ts fireWeapon → hitPlayer (god mode off): a round found Sam — 'down' the once, 'hit' while the vest still has something left. `by`: whose round. */
export function chronHit(g: Game, by?: string) {
  const C = g.chronicle; if (C.counts.down || !missionLive(g)) return null;
  if (g.player.down) { C.counts.down = true; C.counts.downBy = by ?? ''; return chronicle(g, 'down', { by: by ?? '' }); }
  return chronicleN(g, 'hit', 'hits', { by: by ?? '', left: g.player.hitsLeft });
}
/** player.ts updateKick's impact frame / updatePicking's opening click */
export function chronDoor(g: Game, kind: 'doorKicked' | 'lockPicked', d: Door) { return chronicleN(g, kind, kind === 'doorKicked' ? 'kicked' : 'picked', { door: d.def.name.replace(/_/g, ' ') }, d.frameCentre); }
/** G5's seam: a checkpoint written ('save') or restored ('load', counted for the card and the score) — `label` names it ('server room', 'autosave 3'). A SAVE row is
 *  chatter to the caps (a long run's ninety autosaves must not crowd its alarms out); a load stays. */
export function chronCheckpoint(g: Game, what: 'save' | 'load', label = '') { return chronicleN(g, 'checkpoint', what === 'load' ? 'loads' : 'saves', { what, label }); }

// ------------------------------------------------------------ reading: the run in numbers, the score, the rating, the badges, the words
/** Everything the card and the score read, in one flat record: the mission's own tallies (MissionStats) + the chronicle's counters + the roster size. Pure data, so
 *  the QA probes can make one up (score monotonicity) and the card's builders never touch the Game. */
export interface RunCounts {
  elapsed: number; stage: string; done: boolean; failed: boolean; sandbox: boolean; blackout: boolean;
  seen: number; seenUp: number; alarms: number; esc1: number; esc2: number; bodies: number;
  kills: number; kos: number; shots: number; shotsNearMen: number; lightsShot: number; ocps: number;
  kicked: number; picked: number; keys: number; intel: number; questioned: number; roster: number;
  hits: number; down: boolean; loads: number; thrown: number; grabs: number; dropped: number;
  devices: number;
  /** the civilians (civilians.ts): times one saw Sam / reports that reached the men (told, rung in, from outside) / told to stay down / knocked out / killed */
  civSeen: number; civReported: number; civComplied: number; civKO: number; civKilled: number;
}
export function runCounts(g: Game): RunCounts {
  const s: MissionStats = g.mission.stats, C = g.chronicle, n = C.counts, st = g.mission.stage;
  return { elapsed: s.elapsed, stage: st, done: st === 'done', failed: st === 'failed', sandbox: s.sandbox, blackout: s.blackout,
    seen: s.spotted, seenUp: n.seenUp, alarms: s.alerts, esc1: n.esc1, esc2: n.esc2, bodies: s.bodies,
    kills: s.kills, kos: s.knockouts, shots: s.shots, shotsNearMen: n.shotsNearMen, lightsShot: n.lightsShot, ocps: n.ocps,
    kicked: n.kicked, picked: n.picked, keys: s.keys, intel: n.intel, questioned: C.questioned.size, roster: g.guards.filter(x => !x.unit).length,
    hits: n.hits, down: n.down || (g.player.down && st !== 'done'), loads: n.loads, thrown: n.thrown, grabs: n.grabs, dropped: C.dropped, devices: n.devices,
    civSeen: n.civSeen, civReported: n.civReported, civComplied: n.civComplied, civKO: n.civKO, civKilled: n.civKilled };
}
/** a blank record (the probes' synthetic runs start from it) */
export const blankCounts = (): RunCounts => ({ elapsed: 0, stage: 'infiltrate', done: false, failed: false, sandbox: false, blackout: false, seen: 0, seenUp: 0, alarms: 0, esc1: 0, esc2: 0, bodies: 0, kills: 0, kos: 0, shots: 0, shotsNearMen: 0, lightsShot: 0, ocps: 0, kicked: 0, picked: 0, keys: 0, intel: 0, questioned: 0, roster: 3, hits: 0, down: false, loads: 0, thrown: 0, grabs: 0, dropped: 0, devices: 0, civSeen: 0, civReported: 0, civComplied: 0, civKO: 0, civKilled: 0 });

/** The stealth score's price list (points off a hundred; every term only ever takes away, so nothing a run does can raise its score — the probes hold it to that).
 *  In the Chaos Theory spirit: being SEEN is the expensive thing (more so once the floor already knows), an alarm and each step the floor goes up cost on their own,
 *  a body found costs, a kill costs ten times a knockout, rounds put near men and fixtures shot out cost a little, getting hit / going down / leaning on a
 *  checkpoint cost, and dawdling past par costs a point a minute. */
export const SCORE = {
  seen: 12, seenUp: 4,            // per sighting episode; + seenUp for one that happened with the floor already heightened / locked down
  alarm: 6,                       // per alarm episode (somebody went to alert while nobody was)
  heightened: 5, lockdown: 8,     // the floor going up a level
  body: 6,                        // per body found, dead or out cold
  kill: 10, ko: 1,                // per man: shot dead / put down breathing
  shotNear: 2, shotNearCap: 12,   // per round into or within SHOT_NEAR_M of a living man, capped
  light: 1, lightCap: 4,          // per fixture shot out, capped (the OCP is free: it is the quiet tool)
  hit: 4, down: 25, load: 3,      // a round in the vest; going down; each checkpoint load
  civReported: 15, civKO: 10, civKilled: 40,   // the civilians (civilians.ts): a report that reached the men (told to one, rung in, control's call after she got out); one put out cold — ten knockouts' worth of a guard's; one KILLED — four kills' worth (and with tune.civilianKillFails the run is over anyway); being merely SEEN by one costs nothing by itself: it is what she then does that costs
  device: 2, deviceCap: 8,        // per time a camera / a tripwire called him in (they know SOMETHING moved — being heard's worth), capped; the floor going up on a camera's word costs as any rise does
  parSecs: 20 * 60, perMin: 1, timeCap: 10,   // a point per whole minute over par, capped
};
export interface ScoreLine { label: string; pts: number; }
/** 0‥100 and the itemised deductions that made it (largest first). */
export function stealthScore(c: RunCounts): { score: number; lines: ScoreLine[] } {
  const S = SCORE; const lines: ScoreLine[] = [];
  const take = (pts: number, label: string) => { if (pts > 0) lines.push({ label, pts }); };
  take(c.seen * S.seen + c.seenUp * S.seenUp, `seen ${times(c.seen)}${c.seenUp ? ` (${c.seenUp} with the floor already up)` : ''}`);
  take(c.alarms * S.alarm, `${c.alarms} alarm${c.alarms === 1 ? '' : 's'} raised`);
  take(c.esc1 * S.heightened + c.esc2 * S.lockdown, `the floor went up ${times(c.esc1 + c.esc2)}${c.esc2 ? ` (${c.esc2} to lockdown)` : ''}`);
  take(c.bodies * S.body, `${c.bodies} bod${c.bodies === 1 ? 'y' : 'ies'} found`);
  take(c.kills * S.kill, `${c.kills} killed`);
  take(c.kos * S.ko, `${c.kos} knocked out`);
  take(Math.min(S.shotNearCap, c.shotsNearMen * S.shotNear), `${c.shotsNearMen} round${c.shotsNearMen === 1 ? '' : 's'} at or near men`);
  take(Math.min(S.lightCap, c.lightsShot * S.light), `${c.lightsShot} light${c.lightsShot === 1 ? '' : 's'} shot out`);
  take(Math.min(S.deviceCap, c.devices * S.device), `called in by security ${times(c.devices)}`);
  take(c.civReported * S.civReported, `a civilian told them ${times(c.civReported)}`);
  take(c.civKO * S.civKO, `${c.civKO} civilian${c.civKO === 1 ? '' : 's'} knocked out`);
  take(c.civKilled * S.civKilled, `${c.civKilled} CIVILIAN${c.civKilled === 1 ? '' : 'S'} KILLED`);
  take(c.hits * S.hit, `hit ${times(c.hits)}`);
  take(c.down ? S.down : 0, 'went down');
  take(c.loads * S.load, `${c.loads} checkpoint load${c.loads === 1 ? '' : 's'}`);
  const over = Math.floor(Math.max(0, c.elapsed - S.parSecs) / 60); take(Math.min(S.timeCap, over * S.perMin), `${over} min over par`);
  const off = lines.reduce((a, l) => a + l.pts, 0);
  lines.sort((a, b) => b.pts - a.pts);
  return { score: clamp(Math.round(100 - off), 0, 100), lines };
}
const times = (n: number) => n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`;

/** The rating word for a score: the bands, best first. */
export const BANDS: { min: number; word: string; blurb: string }[] = [
  { min: 90, word: 'GHOST', blurb: 'in and out, and the night none the wiser' },
  { min: 70, word: 'SHADOW', blurb: 'they know something happened — not much more' },
  { min: 40, word: 'OPERATIVE', blurb: 'the job got done; the floor will be talking about it' },
  { min: 0, word: 'ASSAULT', blurb: 'loud, seen, and paid for' },
];
export function ratingOf(score: number): { word: string; blurb: string } { for (const b of BANDS) if (score >= b.min) return b; return BANDS[BANDS.length - 1]; }

/** the badges' two numbers: fixtures shot out for 'lights out', and the clock 'speedrun' beats (a straight run — lobby, corridor, the picked server door, the rack,
 *  out through the break room — is about two minutes flat out) */
export const BADGE = { lightsOutN: 3, speedrunSecs: 4 * 60 };
export interface Badge { id: string; name: string; on: boolean; hint: string; }
/** The run's badges — every one a plain yes / no off the counts, shown lit or dim: never seen · no alarms · no kills · pacifist (not one round at or near a man) ·
 *  lights out (BADGE.lightsOutN fixtures shot out) · talkative (every man on the floor questioned) · locksmith (a lock picked and none kicked) · speedrun (out
 *  inside BADGE.speedrunSecs — only a finished run can have it). */
export function badgesOf(c: RunCounts): Badge[] {
  return [
    { id: 'unseen', name: 'never seen', on: c.seen === 0, hint: 'no alert man ever had eyes on you' },
    { id: 'quiet', name: 'no alarms', on: c.alarms === 0 && c.esc1 + c.esc2 === 0, hint: 'nobody went to alert, the floor never went up' },
    { id: 'nokills', name: 'no kills', on: c.kills === 0, hint: 'nobody shot dead (a man out cold is not a kill)' },
    { id: 'pacifist', name: 'pacifist', on: c.shotsNearMen === 0 && c.kills === 0, hint: `not one round into or within ${SHOT_NEAR_M} m of a man` },
    { id: 'lightsout', name: 'lights out', on: c.lightsShot >= BADGE.lightsOutN, hint: `${BADGE.lightsOutN}+ fixtures shot out` },
    { id: 'talkative', name: 'talkative', on: c.roster > 0 && c.questioned >= c.roster, hint: 'every man on the floor questioned' },
    { id: 'unseenStaff', name: 'unseen by civilians', on: c.civSeen === 0 && c.civKO === 0 && c.civKilled === 0, hint: 'no cleaner or late worker ever laid eyes on you (or a hand of yours on them)' },
    { id: 'locksmith', name: 'locksmith', on: c.picked >= 1 && c.kicked === 0, hint: 'a lock picked and none kicked in' },
    { id: 'speedrun', name: 'speedrun', on: c.done && c.elapsed < BADGE.speedrunSecs, hint: `out inside ${fmtMMSS(BADGE.speedrunSecs)}` },
  ];
}

/** mm:ss off seconds (the timeline's stamps, the card's clock) */
export function fmtMMSS(sec: number): string { const s = Math.max(0, Math.floor(sec)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }

/** The whole debrief in one record: what ui/debrief.ts renders and the probes assert on. */
export interface Debrief { counts: RunCounts; score: number; lines: ScoreLine[]; rating: string; blurb: string; badges: Badge[]; summary: string; state: 'done' | 'down' | 'sofar'; }
export function debriefOf(g: Game): Debrief {
  const counts = runCounts(g); const { score, lines } = stealthScore(counts); const r = ratingOf(score); const badges = badgesOf(counts);
  const state: Debrief['state'] = counts.done ? 'done' : counts.failed || counts.down ? 'down' : 'sofar';
  return { counts, score, lines, rating: r.word, blurb: r.blurb, badges, summary: summaryLine(counts, score, r.word, badges, state), state };
}
/** the one line the 'copy summary' button puts on the clipboard: 'GHOST 94 · 11:32 · seen 0 · alarms 0 · KOs 3 · kills 0 · …' */
export function summaryLine(c: RunCounts, score: number, word: string, badges: Badge[], state: 'done' | 'down' | 'sofar'): string {
  const parts = [`${word} ${score}`, fmtMMSS(c.elapsed), `seen ${c.seen}`, `alarms ${c.alarms}`, `bodies found ${c.bodies}`, `KOs ${c.kos}`, `kills ${c.kills}`, `shots ${c.shots}`];
  if (c.civSeen || c.civReported || c.civKO || c.civKilled) parts.push(`civilians: saw you ${c.civSeen} · told them ${c.civReported}${c.civKO ? ` · KO ${c.civKO}` : ''}${c.civKilled ? ` · KILLED ${c.civKilled}` : ''}`);
  if (c.ocps) parts.push(`OCP ${c.ocps}`); if (c.kicked || c.picked) parts.push(`doors kicked ${c.kicked} / picked ${c.picked}`); if (c.keys) parts.push(`keys ${c.keys}`); if (c.intel) parts.push(`intel ${c.intel}`); if (c.loads) parts.push(`loads ${c.loads}`);
  const on = badges.filter(b => b.on).map(b => b.name); if (on.length) parts.push(on.join(', '));
  if (state !== 'done') parts.push(state === 'down' ? 'went down' : 'run so far'); if (c.sandbox) parts.push('sandbox flags on');
  return `twopointsix — ${parts.join(' · ')}`;
}

/** One timeline row in words: '02:14 · corridor · heard: a door kicked in · Kowalski investigates'. */
export function fmtEvent(e: ChronEvent): string { return `${fmtMMSS(e.t)} · ${e.room} · ${eventText(e)}`; }
const STAGE_NAME = ['calm', 'heightened', 'lockdown'];
const CAUSE: Record<string, string> = { sight: 'eyes on you', sound: 'heard it', radio: 'over the net', body: 'a body', held: 'a man held', search: 'the search found nobody', missing: 'a man missing', hostage: 'a man held', device: 'security had you on camera', civilian: 'a civilian told them', time: 'the clock ran out' };
/** what frightened a civilian, in the timeline's words (civilians.ts CivCause) */
const CIV_CAUSE: Record<string, string> = { sam: 'saw you', gun: 'saw you, gun in hand', body: 'found a body', gunfire: 'heard the shooting', shot: 'heard a muffled shot', bang: 'heard a stun charge', scream: 'heard the screaming', noise: 'a crash beside her', grabbed: 'you had her by the throat', panel: 'panicked' };
/** the needs' kinds in the timeline's words (needs.ts NEED_SPOTS names the places; the row names the errand) */
const NEED_WORDS: Record<string, string> = { coffee: 'a coffee at the break-room counter', smoke: 'a smoke outside the fire exit', water: 'water at the cooler', stretch: 'a stretch round the lobby' };
/** …and on a level whose places are its own (the row carries `own` and the stand's name — needs.ts) */
const NEED_SHORT: Record<string, string> = { coffee: 'a coffee', smoke: 'a smoke', water: 'water', stretch: 'a stretch' };
export function eventText(e: ChronEvent): string {
  const d = e.data; const n = Number(d.n) || 1;
  switch (e.kind) {
    case 'objective': return String(d.text);
    case 'spotted': return `SPOTTED by ${d.by}${Number(d.lvl) >= 1 ? ' — and the floor was already up' : ''}`;
    case 'contact': return `${d.who}: CONTACT — ${CAUSE[String(d.cause)] ?? d.cause}`;
    case 'heard': { const k = Number(d.k) || 1; const react = String(d.react); const verb = k > 1 ? (react === 'alerted' ? 'alerted' : react === 'investigates' ? 'investigate' : 'prick up their ears') : (react === 'pricks up' ? 'pricks up his ears' : react); return `heard: ${d.what}${n > 1 ? ` ×${n}` : ''} · ${d.by}${k > 3 ? ` +${k - 3}` : ''} ${verb}`; }
    case 'lost': return `${d.who} lost you — searching`;
    case 'calm': return `${d.who} gives up the search`;
    case 'alarm': return d.up ? `ALARM ▲ ${STAGE_NAME[Number(d.stage)] ?? d.stage}${d.cause ? ` — ${CAUSE[String(d.cause)] ?? d.cause}` : ''}` : `alarm ▼ ${STAGE_NAME[Number(d.stage)] ?? d.stage}`;
    case 'radio': return `${d.who} (radio): “${d.text}”`;
    case 'shot': return `fired${n > 1 ? ` ×${n}` : ''} (${gearText(String(d.weapon))}) — ${d.into === 'geometry' ? 'into the scenery' : /^past /.test(String(d.into)) ? String(d.into) : `into ${d.into}`}`;
    case 'lightShot': return `shot out ${d.name}`;
    case 'ocp': return `OCP → ${d.what}`;
    case 'blackout': return d.cause === 'shot' ? 'shot the breaker — mains gone for good' : d.cause === 'hand' ? 'threw the breaker by hand' : 'OCP → the breaker: mains tripped';
    case 'thrown': return d.kind === 'cam' ? 'placed a sticky camera' : d.kind === 'he40' ? 'fired a 40 mm grenade' : d.kind === 'frag' ? 'threw a frag grenade' : `threw a ${d.kind === 'flash' ? 'stun' : 'smoke'} canister`;
    case 'grab': return `grabbed ${d.who} from behind`;
    case 'interrogated': return d.civilian ? `questioned ${d.who} — ${d.gave ? `${d.she ?? 'she'} gave up ${INTEL[String(d.gave)] ?? d.gave}` : `nothing more in ${d.her ?? 'her'}`}` : `questioned ${d.who} — ${d.gave ? `he gave up ${INTEL[String(d.gave)] ?? d.gave}` : Number(d.stage) >= 4 ? 'nothing left in him' : 'nothing useful yet'}`;
    case 'keyTaken': return `took ${d.who}'s key`;
    case 'ko': return d.method === 'wounded' ? `${d.who} shot — down wounded, out of the fight` : `${d.who} out cold — ${d.method === 'choke' ? 'choked out' : d.method === 'whip' ? 'pistol-whipped' : d.method === 'ring' ? gearText('a ring to the head') : 'the takedown'}`;
    case 'kill': return d.weapon === 'knife' ? `${d.who} killed — the knife` : `${d.who} shot dead (${gearText(String(d.weapon))})`;
    case 'bodyFound': return `${d.by} found ${d.who} ${d.wounded ? 'shot and breathing' : d.breathing ? 'out cold' : 'dead'}${d.civilian ? ' — the floor goes up hard' : ''}`;
    case 'doorKicked': return `kicked in the ${d.door} door`;
    case 'lockPicked': return `picked the ${d.door} door's lock`;
    case 'hit': return `hit${d.by ? ` — ${d.by}'s round` : ''}`;
    case 'down': return `DOWN${d.by ? ` — ${d.by}'s round` : ''}`;
    case 'needBreak': return d.what === 'left' ? `${d.who} left his route — ${d.own ? `${NEED_SHORT[String(d.kind)] ?? d.kind} (${d.to})` : NEED_WORDS[String(d.kind)] ?? d.kind}` : d.what === 'back' ? `${d.who} back on his route (${d.away} s away)` : `${d.who}'s ${d.kind} break broken off (${d.why})`;
    case 'civilianSpotted': return `${d.who} ${CIV_CAUSE[String(d.cause)] ?? 'saw you'}`;
    case 'civilianReported': return d.how === 'phone' ? `${d.who} rang it in — ${CIV_CAUSE[String(d.cause)] ?? d.cause}${d.sent ? ` — ${d.sent} sent` : ''}` : d.how === 'outside' ? `${d.who} got out and control rang the floor${d.sent ? ` — ${d.sent} sent` : ''}` : `${d.who} told ${d.to} — ${CIV_CAUSE[String(d.cause)] ?? d.cause}${d.how === 'found' ? ' (he found her hiding)' : ''}`;
    case 'civilianComplied': return `told ${d.who} to stay down — and let her go`;
    case 'civilianKO': return `${d.who} (the ${d.label}) out cold — ${d.method === 'choke' ? 'choked out' : d.method === 'whip' ? 'pistol-whipped' : d.method === 'ring' ? gearText('a ring to the head') : 'the takedown'} — a CIVILIAN`;
    case 'civilianKilled': return `${d.who} (the ${d.label}) KILLED (${gearText(String(d.weapon))}) — a civilian`;
    case 'cameraSpotted': return `camera ${d.n} called you in${d.sent ? ` — ${d.sent} sent to look` : ''}`;
    case 'cameraAlarm': return `camera ${d.n} had you long enough — the floor goes up`;
    case 'laserTripped': return `${d.by === 'player' ? 'broke' : d.by === 'body' ? 'the body you hauled broke' : `a thrown ${d.by === 'flash' ? 'stun' : d.by} broke`} the ${e.room} beam${d.sent ? ` — ${d.sent} sent` : ''}`;
    case 'deviceDown': return `${String(d.device).replace(/_/g, ' ')} shot dead${d.sent ? ` — ${d.sent} sent to it` : ''}`;
    case 'codeLearned': return d.how === 'told' ? `${d.from} gave up the ${String(d.door).replace(/_/g, ' ')} code` : `overheard the ${String(d.door).replace(/_/g, ' ')} code${d.from ? ` (${d.from})` : ''}`;
    case 'codeEntered': return `keyed the code — the ${String(d.door).replace(/_/g, ' ')} door`;
    case 'checkpoint': return `checkpoint ${d.what === 'load' ? 'loaded' : 'saved'}${d.label ? ` (${d.label})` : ''}`;
  }
  return e.kind;
}
/** the interrogation's useful things (dialogue.ts intel kinds) in the timeline's words */
const INTEL: Record<string, string> = { door: 'the keyed door (and his key)', code: 'a door code', routes: "a colleague's route", rollcall: 'when the radio check is due', rollcallLive: 'that a radio check is on now', checkOn: 'that a man is out looking for a colleague', clearing: 'which room the pair is clearing', blackout: 'who is on the breaker', lockdownPosts: 'where the lockdown posts are', missing: 'that a man is missed', drive: 'that the rack is being looked at' };

/** The map's pins: which kinds get a glyph on the floor map, and the glyph (ui/debrief.ts draws them; the legend lists them). */
export const PIN: Partial<Record<ChronKind, { glyph: string; cls: string; label: string }>> = {
  spotted: { glyph: '◉', cls: 'seen', label: 'spotted' },
  alarm: { glyph: '!', cls: 'alarm', label: 'alarm up' },
  kill: { glyph: '✕', cls: 'kill', label: 'kill' },
  ko: { glyph: 'z', cls: 'ko', label: 'knockout' },
  ocp: { glyph: '✦', cls: 'light', label: 'OCP / light' },
  lightShot: { glyph: '✦', cls: 'light', label: 'OCP / light' },
  blackout: { glyph: '✦', cls: 'light', label: 'OCP / light' },
  bodyFound: { glyph: '◇', cls: 'body', label: 'body found' },
  down: { glyph: '✚', cls: 'down', label: 'you went down' },
  doorKicked: { glyph: '▮', cls: 'door', label: 'door kicked / picked' },
  lockPicked: { glyph: '▯', cls: 'door', label: 'door kicked / picked' },
  cameraSpotted: { glyph: '◎', cls: 'seen', label: 'camera / beam' },
  cameraAlarm: { glyph: '◎', cls: 'alarm', label: 'camera / beam' },
  laserTripped: { glyph: '≋', cls: 'seen', label: 'camera / beam' },
  civilianSpotted: { glyph: '◉', cls: 'seen', label: 'a civilian saw / told' },
  civilianReported: { glyph: '☎', cls: 'alarm', label: 'a civilian saw / told' },
  civilianKO: { glyph: 'z', cls: 'ko', label: 'knockout' },
  civilianKilled: { glyph: '✕', cls: 'kill', label: 'kill' },
};
/** does this row get a pin (an alarm going DOWN does not) */
export function pinned(e: ChronEvent): boolean { return !!PIN[e.kind] && !(e.kind === 'alarm' && !e.data.up); }
