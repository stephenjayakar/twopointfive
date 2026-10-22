// THE QUIET MISSION: the level's own night, live, with a thing to take and ways out — on ANY level whose file carries a `scenarios.quiet` block
// (scene/scenarios.ts QuietData), alone or with ONE partner. `?quiet` on the URL (scene/scenarioList.ts; ui/missions.ts lists its rows), `?quiet=N` pins the deal,
// `&squad=1` brings the partner.
//
// WHAT IT IS NOT: a cast. Nobody is posted and nobody is benched for effect — the level's routes are walked by its own night staff (team 'guard', the patrol
// → suspicious → alert → search machine, their radio, their rollcall), its devices sense and its civilians work, exactly as the plain night has them. None of
// the gates keyed on the night breach / the rescue is touched, so everything the plain night runs, this runs.
//
// WHAT IT ADDS, all of it read from the level's data:
//   THE DEAL (replay — "make the game fun and replayable. think door kickers 2"): every start of the encounter deals one of the block's `starts`, one of its
//     `spots` (where the thing is) and one of its `patrols` (which routes are manned) — off the Game's own die (math/dice.ts simRandom: `?seed=` reproduces a
//     run) or, pinned (`?quiet=N`), off a stream of its own that deals the same every time. A restart deals again unless pinned.
//     The deal is WRITTEN INTO the Level for the run — `level.playerSpawn` = the start, `level.mission` = the spot and the first exit in the shape the office's
//     mission has always had — so everything that reads the mission (mission.ts, the objective row, the rack that goes dark, the marker, the debrief's pins, the
//     staff's own talk of the room) reads this one with no second code path; stop() puts the authored ones back. Routes outside the dealt patrol set are off
//     the guard list for the run, their torches out of the light set (as nightbreach.ts benches the shift — here it is the patrol set, not a cast).
//   THE WAYS OUT: every exit of the block is open on every run; out = past its point going its own way (mission.ts outThrough), so an exit faces any way.
//   THE WORDS: the place, the holder, the thing and the exits' names, in the objective lines, the row, the radio and the card (quietWords).
//   ONE PARTNER (squad 1): an operative staged at the start's `mate` mark (else the free floor a stride behind Sam), following from the first tick, under THE PAIR
//     RULES (pairup.ts: its switch and three parts on for the run) and SILENT from the first frame (silent.ts). The level's staff are HOSTILE to him and he to
//     them for the run (teams.ts staffVsOperatives) — on every other floor they never meet and stay neutral; here he is a second intruder: seen by the same eye,
//     heard by the same ears, shot at, and his takedowns land. Cameras, tripwires and civilians sense the player only (devices.ts / civilians.ts: unchanged).
//
// CHECKPOINTS: alone, the plain night's (savestate.ts) — the deal rides in the file and is dealt back on a load. With the partner on the floor a save is refused
// like on every squad run ('a spawned unit is on the floor').
//
// (src/game is one import cycle: nothing here is built from another game module's exports at module load.)
import type { Game, Guard } from './game';
import type { Level } from '../scene/level';
import type { FollowCamera } from './camera';
import type { QuietData, QuietExit, QuietSpot, QuietStart } from '../scene/scenarios';
import { v3, type Vec3 } from '../math/vec';
import { mulberry32, simRandom } from '../math/dice';
import { SAMESTART } from './samestart';   // (a leaf)
import { spawnUnit } from './guards';
import { order } from './squad';
import { kitStage } from './kit';
import { PAIRUP, PAIR_HELD, pairUpApply } from './pairup';
import { PAIR } from './pairorders';
import { SNEAK } from './sneak';
import { SPOTTED } from './spotted';
import { SILENT } from './silent';
import { staffVsOperatives } from './teams';
import { stickyVisitSet } from './stickycam';   // (called inside functions only)

/** what a run was dealt: indices into the block's lists (patrol −1 = every route: the block names no sets) */
export interface QuietDeal { start: number; spot: number; patrol: number }
/** the deal as a checkpoint files it (savestate.ts): the indices, the pin and the team's size */
export interface QuietSnap { deal: QuietDeal; pin: number | null; squad: 0 | 1 }

export const QUIET_STATS = { starts: 0, deals: 0, mates: 0 };
/** an exit's half width when its row gives none (the office's fire exit: |z − exfilZ| < 1.8) */
export const EXIT_HALF_W = 1.8;
/** how far past an exit's point still reads as 'out through it' (a strip, not a half plane: an exit whose outward line crosses floor further on is not out there) */
export const EXIT_DEPTH = 12;
/** THE PARTNER RUN THAT HAS THE MODULE SWITCHES RIGHT NOW (the pair rules, the silent posture, staff against operatives): they are tables of their modules, not
 *  of a Game, so a Game dropped mid-run (the harness; a probe that never stops what it started) would leave them on for the next, and two Games in one process
 *  would run on each other's. So they FOLLOW THE GAME THAT IS RUNNING: a Game's constructor, its every update and its mission's start call `current()`, which
 *  hands back what another Game's run holds (kept for when that Game next runs) and takes this one's. One Game (the page): a compare a frame. */
let holder: QuietMission | null = null;
type Held = { pairup: boolean; pair: boolean; sneak: boolean; spotted: boolean; silent: boolean; silentStart: boolean };
const heldNow = (): Held => ({ pairup: PAIRUP.on, pair: PAIR.on, sneak: SNEAK.on, spotted: SPOTTED.on, silent: SILENT.on, silentStart: SILENT.start });
const heldSet = (H: Held) => { PAIRUP.on = H.pairup; PAIR.on = H.pair; SNEAK.on = H.sneak; SPOTTED.on = H.spotted; SILENT.on = H.silent; SILENT.start = H.silentStart; };

/** out through this exit: past its point going its own way, inside its width */
export function outThrough(x: QuietExit, p: Vec3): boolean {
  const dx = p[0] - x.x, dz = p[2] - x.z, along = dx * x.out[0] + dz * x.out[1], side = Math.abs(dx * x.out[1] - dz * x.out[0]);
  return along > 0 && along < EXIT_DEPTH && side < (x.halfW ?? EXIT_HALF_W);
}
/** a point a stride past the exit, on its own line (the marker; a scripted player's goal) */
export function exitPoint(x: QuietExit, past = 0.9): Vec3 { return [x.x + x.out[0] * past, 0, x.z + x.out[1] * past]; }

export class QuietMission {
  active = false;
  /** the partner (dead or alive), or nobody */
  ops: Guard[] = [];
  squad: 0 | 1 = 0;
  /** `?quiet=N`: the deal's own seed — the same deal on every start. null = dealt off the Game's die */
  pin: number | null = null;
  deal: QuietDeal = { start: 0, spot: 0, patrol: -1 };
  /** how many times it has staged since start() */
  staged = 0;
  log: string[] = [];
  private data: QuietData | null = null;
  private authored: { spawn: Vec3; mission: Level['mission'] } | null = null;
  private benched: Guard[] = [];
  private was: Held | null = null;    // the switches as they stood before this run took them (null: it does not have them)
  private mine: Held | null = null;   // … as this run has them: what it wrote at its start, re-read when another Game takes over (a row moved by hand mid-run is the run's from then on)
  private pending: QuietDeal | null = null;   // a checkpoint's deal, for the restart its load makes
  private fallIn = false;                     // the partner is told to follow on the first tick the orders see him
  private cut = false;                        // the camera is put on Sam's start on the next tick (a dealt start is not where the camera was)
  private failure: string | null = null;
  constructor(private g: Game) { this.current(); }

  /** the block in force (null: not up) */
  get block(): QuietData | null { return this.active ? this.data : null; }
  get start_(): QuietStart | null { return this.block?.starts[this.deal.start] ?? null; }
  get spot(): QuietSpot | null { return this.block?.spots[this.deal.spot] ?? null; }
  get exits(): QuietExit[] { return this.block?.exits ?? []; }
  get thing(): string { return this.data?.thing ?? 'the drive'; }
  /** the routes manned on this run, by name (every route when the block names no sets) */
  get patrol(): string[] { const Q = this.block; return Q ? Q.patrols?.[this.deal.patrol] ?? this.g.level.routes.map(r => r.name) : []; }

  /** why it cannot start right now (null = it can) */
  canStart(squad: 0 | 1 = 0): string | null {
    const g = this.g, Q = g.level.scenarios?.quiet;
    if (!Q) return 'this level carries no quiet mission (its scenarios.quiet block)';
    if (!Q.starts?.length || !Q.spots?.length || !Q.exits?.length) return 'its quiet mission wants at least one start, one spot and one exit';
    if (!g.aiEnabled) return 'the AI is switched off (sandbox: no AI) — nobody would walk his route';
    if (squad && !g.tune.teams) return 'sides are switched off (tune.teams): no partner';
    if (g.director?.staging && g.director.run) return `the level script's program '${g.director.run.name}' is running`;
    if (g.touring || g.quietUtility || g.puppet) return 'a show is running';
    if (g.nightBreach?.active || g.rescue?.active) return 'another scenario is staged';
    if (g.guards.some(x => x.unit)) return 'a spawned unit is already on the floor';
    return null;
  }
  /** Start it: the deal, a fresh encounter on it, the partner beside Sam. Returns the reason when refused (or when the staging failed: everything put back). */
  start(pin: number | null = null, squad: 0 | 1 = 0): string | null {
    if (this.active) return null;
    const why = this.canStart(squad); if (why) return why;
    const g = this.g;
    this.data = g.level.scenarios!.quiet!; this.pin = pin; this.squad = squad; this.failure = null; this.staged = 0; this.log.length = 0;
    this.authored = { spawn: g.level.playerSpawn, mission: g.level.mission };
    this.current();
    if (squad) {   // the pair rules and the silent posture, for this run (put back by release; the pair's stored row keeps its own word while held — pairup.ts PAIR_HELD)
      this.was = heldNow(); PAIR_HELD.row = PAIRUP.on; holder = this;
      PAIRUP.on = true; pairUpApply();   // (the switch's own road to its three parts: this visit's word against one of them — `?sneak=0`, SNEAK=off — stands, as under the switch anywhere else)
      SILENT.on = true; SILENT.start = true;
      this.mine = heldNow();
      staffVsOperatives(true);
    }
    this.active = true; QUIET_STATS.starts++;
    try { g.restartEncounter(); }   // → beforeRestart deals and writes the level; onEncounterRestart stages
    catch (e) {   // a throw the staging's own catch did not take (onEncounterRestart → stop): everything put back, then the plain night's own encounter made afresh — never a Player on the dealt start among half the shift
      this.failure = `the staging failed: ${e instanceof Error ? e.message : String(e)}`; console.error('quiet mission:', e); this.active = false; this.putBack(); this.release(); this.ops = []; this.data = null; this.pending = null;
      stickyVisitSet(g, 0);   // (the mission's cameras are not the plain night's: let go of before its player is kitted)
      try { g.restartEncounter(); } catch (e2) { console.error('quiet mission: the plain night did not restart either:', e2); }
    }
    return this.active ? null : (this.failure ?? 'the staging failed');
  }
  /** Stop it: the partner gone, every route manned, the level's authored mission and spawn back, a fresh night encounter. */
  stop() {
    if (!this.active) return;
    const g = this.g;
    this.active = false; this.putBack(); this.release();
    this.ops = []; this.data = null; this.pending = null;
    g.restartEncounter();   // (resetGuards takes the partner away with every other unit)
  }
  /** the level as authored: every route manned, its own mission and spawn, its own holder's lights */
  private putBack() {
    const g = this.g; this.unbench();
    if (this.authored) { g.level.playerSpawn = this.authored.spawn; g.level.mission = this.authored.mission; this.authored = null; }
    this.rack();
  }
  /** THE RUN IS OVER: the module switches it took, put back as they stood before it — each one only while it still stands as the run wrote it (a row moved by
   *  hand during the run, on the panel, is the player's word and stays where he put it). */
  release() {
    if (this.was && this.mine) { const W = this.was, M = this.mine, N = heldNow(), out = { ...N }; for (const k of Object.keys(W) as (keyof Held)[]) if (N[k] === M[k]) out[k] = W[k]; heldSet(out); staffVsOperatives(false); PAIR_HELD.row = null; }
    this.was = this.mine = null;
    if (holder === this) holder = null;
  }
  /** THIS GAME IS THE ONE RUNNING (its constructor, the first statement of its update, its mission's start): another Game's partner run hands the switches back
   *  as they stood before it — kept as it had them, for when that Game next runs — and this Game's own run, if it has one up, takes them again. */
  current() {
    if (holder === this) return;
    if (holder) { const H = holder; if (H.was) { H.mine = heldNow(); heldSet(H.was); H.was = null; staffVsOperatives(false); PAIR_HELD.row = null; } holder = null; }
    if (this.active && this.squad && this.mine) { this.was = heldNow(); PAIR_HELD.row = PAIRUP.on; heldSet(this.mine); staffVsOperatives(true); holder = this; }
  }
  /** deal afresh on the same run (the panel; the probes) */
  restage() { if (this.active) this.g.restartEncounter(); }

  /** restartEncounter's FIRST act (game.ts): the deal for the encounter about to be made, written into the level before the fresh Player and Guards read it. */
  beforeRestart() {
    if (!this.active || !this.data) return;
    const g = this.g, Q = this.data;
    this.unbench();
    this.deal = this.pending ?? this.dealOne(Q); this.pending = null; QUIET_STATS.deals++;
    const S = Q.starts[this.deal.start], P = Q.spots[this.deal.spot], X = Q.exits[0];
    g.level.playerSpawn = [S.sam[0], 0, S.sam[2]];
    g.level.mission = { serverRoom: { ...P.area }, entryDoor: P.door, rack: { index: P.rackIndex, front: [...P.front] as Vec3, halfW: P.halfW }, exfilDoor: X.door, exfilX: X.x, exfilZ: X.z, exfilOut: [X.out[0], X.out[1]] };
    this.rack();
    // the routes this run does not man: off the guard list (resetGuards stands up whoever is on it), their torches out of the light set
    const manned = new Set(this.patrol);
    const off = g.guards.filter(x => !x.unit && !manned.has(x.route.name));
    for (const gd of off) { gd.flashlight.enabled = false; g.engine.lights.remove(gd.flashlight); }
    this.benched = off; if (off.length) g.guards = g.guards.filter(x => !off.includes(x));
  }
  /** restartEncounter's last act: Sam faced as the start has him, the partner staged. A staging that throws ends the mission cleanly. */
  onEncounterRestart() {
    if (!this.active) return;
    try { this.stage(); }
    catch (e) { this.failure = `the staging failed: ${e instanceof Error ? e.message : String(e)}`; console.error('quiet mission:', e); stickyVisitSet(this.g, 0); this.stop(); this.g.msg(`quiet mission — ${this.failure}`); }
  }
  /** once a frame (game.ts, with the scenarios' ticks): the partner told to follow, the first tick the orders have him */
  tick(cam: FollowCamera | null = null) {
    if (!this.active) return;
    const g = this.g;
    if (this.squad && this.ops[0] && !g.guards.includes(this.ops[0])) {   // the partner was despawned under it by something short of a restart (a bare resetGuards — the panel's reset, a console): a full restart, which stages
      g.restartEncounter(); if (!this.active) return;
    }
    if (this.cut && cam) { this.cut = false; cam.target = v3.copy(g.followPos()); cam.desired = v3.copy(cam.target); }
    if (!this.fallIn) return;
    const m = this.ops[0];
    if (!m || m.state === 'dead' || !g.orders.active) return;
    this.fallIn = false;
    const why = g.orders.give('fallIn', g.orders.targetAt(g.player.char.pos), 'all');
    this.note(why ? `fall in refused: ${why}` : 'partner following');
  }

  // ---------------------------------------------------------------- checkpoints (savestate.ts)
  snapshot(): QuietSnap | null { return this.active ? { deal: { ...this.deal }, pin: this.pin, squad: this.squad } : null; }
  /** a checkpoint's deal, for the restart its load is about to make (called before it; ignored out of range) */
  restoreDeal(s: QuietSnap | null | undefined) {
    const Q = this.data; if (!this.active || !Q || !s?.deal) return;
    const d = s.deal, ok = Number.isInteger(d.start) && d.start >= 0 && d.start < Q.starts.length && Number.isInteger(d.spot) && d.spot >= 0 && d.spot < Q.spots.length && Number.isInteger(d.patrol) && d.patrol >= -1 && d.patrol < (Q.patrols?.length ?? 0);
    if (ok) this.pending = { start: d.start, spot: d.spot, patrol: Q.patrols?.length ? Math.max(0, d.patrol) : -1 };
  }

  /** how many men a deal's patrol set mans on this level (−1: not a deal this level's block deals) — savestate.ts canLoad */
  rosterOf(d: QuietDeal | null | undefined): number {
    const Q = this.data ?? this.g.level.scenarios?.quiet; if (!Q || !d) return -1;
    if (!(Number.isInteger(d.start) && d.start >= 0 && d.start < Q.starts.length && Number.isInteger(d.spot) && d.spot >= 0 && d.spot < Q.spots.length)) return -1;
    if (!Q.patrols?.length) return this.g.level.routes.length;
    return Number.isInteger(d.patrol) ? Q.patrols[d.patrol]?.length ?? -1 : -1;
  }

  summary(): string {
    if (!this.active || !this.data) return this.g.level.scenarios?.quiet ? 'off · this level carries one' : 'off · this level carries none';
    const Q = this.data, S = this.start_!, P = this.spot!;
    return `on · ${this.pin === null ? 'dealt' : `pinned ${this.pin}`} · start ${this.deal.start + 1}/${Q.starts.length}${S.name ? ` (${S.name})` : ''} · ${this.thing} in ${P.holder}, ${P.place} (${this.deal.spot + 1}/${Q.spots.length}) · patrol ${Q.patrols ? `${this.deal.patrol + 1}/${Q.patrols.length}` : 'all'}: ${this.patrol.join(', ') || 'nobody'} · ${Q.exits.length} way${Q.exits.length === 1 ? '' : 's'} out · ${this.squad ? `partner ${this.ops[0]?.state === 'dead' ? 'down' : 'up'}` : 'alone'}`;
  }

  // ---------------------------------------------------------------- inside
  private note(s: string) { this.log.push(`${this.g.time.toFixed(2)} ${s}`); if (this.log.length > 60) this.log.splice(0, 30); }
  private dealOne(Q: QuietData): QuietDeal {
    if (this.pin === null && SAMESTART.on) { simRandom(); simRandom(); simRandom(); return { start: 0, spot: 0, patrol: Q.patrols?.length ? 0 : -1 }; }   // (samestart.ts: a mission that names no pin is the first of each of its lists, on every load and every restart; the three draws are made all the same, so the run rolls the stream it would with the switch off)
    const r = this.pin === null ? simRandom : mulberry32((this.pin | 0) ^ 0x51ed270b);
    const pick = (n: number) => Math.min(n - 1, Math.floor(r() * n));
    // (three draws whatever the lists' lengths: a list grown by one does not shift the others' draws)
    const start = pick(Q.starts.length), spot = pick(Q.spots.length), patrol = pick(Math.max(1, Q.patrols?.length ?? 1));
    return { start, spot, patrol: Q.patrols?.length ? patrol : -1 };
  }
  /** the benched routes' men back on the guard list (their own Guard objects, in route order: resetGuards rebuilds from them), torches back in the light set */
  private unbench() {
    const g = this.g; if (!this.benched.length) return;
    for (const gd of this.benched) if (!g.engine.lights.lights.includes(gd.flashlight)) g.engine.lights.add(gd.flashlight);
    const staff = [...g.guards.filter(x => !x.unit), ...this.benched].sort((a, b) => a.routeI - b.routeI);
    g.guards = [...staff, ...g.guards.filter(x => !!x.unit)]; this.benched = [];
  }
  /** what goes dark when the thing comes out: the switchables named for the mission's holder (game.ts: the constructor's rule, for the mission in force) */
  private rack() { const g = this.g, n = g.level.mission.rack.index; g.rackTargets = g.targets.filter(t => t.name === `rack${n}_leds` || t.name === `rack${n}_glow`); }
  private stage() {
    const g = this.g, S = this.start_!, pl = g.player;
    this.ops = [];
    pl.char.bodyYaw = pl.char.aimYaw = S.samYaw; pl.char.update(0);
    if (this.squad) {
      const at = S.mate ? v3.copy(S.mate) : this.behind(S);
      const m = spawnUnit(g, { team: 'operative', pos: at, yaw: S.samYaw, name: 'Blue One', light: false, pair: 'blue' });
      m.state = 'patrol'; m.awareness = 0; m.hold = false; m.pinned = false;
      order(m, { goal: null, face: m.char.bodyYaw, stance: 'lowReady', upper: 'none', aimAt: null, light: false, crouch: false });
      this.ops.push(m); this.fallIn = true; QUIET_STATS.mates++;
      kitStage(g, this.ops);   // his card (kit.ts): nothing written while it is as issued (yours under the pouches rule: your four counts, one of each — kitPlayer)
    }
    this.staged++; this.cut = true;
    this.note(`staged: ${this.summary()}`);
    const P = this.spot!;
    g.msg(`${P.place} — ${this.thing} is in ${P.holder}. ${this.squad ? 'Your partner is on you, silent · X: his orders' : 'You are alone'}`);
  }
  /** the free floor nearest a stride behind Sam, walkable from him */
  private behind(S: QuietStart): Vec3 {
    const nav = this.g.col.nav, back: Vec3 = [S.sam[0] - Math.sin(S.samYaw) * 1.1, 0, S.sam[2] - Math.cos(S.samYaw) * 1.1];
    let best: Vec3 | null = null, bs = Infinity;
    for (let dx = -2; dx <= 2; dx += 0.5) for (let dz = -2; dz <= 2; dz += 0.5) {
      const p: Vec3 = [back[0] + dx, 0, back[2] + dz];
      if (nav.isBlocked(p[0], p[2]) || v3.distXZ(p, S.sam) < 0.8 || !nav.walkable(S.sam, p)) continue;
      const s = Math.hypot(dx, dz); if (s < bs) { bs = s; best = p; }
    }
    if (!best) throw new Error(`no free floor beside the start at (${S.sam[0]}, ${S.sam[2]}) for the partner — give the start a 'mate' mark`);
    return best;
  }
}

/** THE FLOOR A MAN STANDS ON AT A HOLDER'S FACE — one rule for the checker (what an author is told) and the game (where a man sent to look at it stands): of
 *  the free nav cells within a stride and a bit of the face, the nearest that is on the face's side of every solid (a clear line at chest height: never the next
 *  room's floor through a thin wall, never round the holder's corner) and, given the room, inside it. `ok` false = no such cell: `pos` is then the nearest free
 *  cell whatever is between (null: none at all), which the checker reports and the game still walks to. */
export function holderStand(g: Game, front: Vec3, area?: { x0: number; x1: number; z0: number; z1: number } | null): { pos: Vec3 | null; ok: boolean; clear: boolean; inside: boolean } {
  const nav = g.col.nav, e = 0.3; let best: Vec3 | null = null, bs = Infinity, clear = false, inside = false;
  for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
    const dx = i * 0.2, dz = j * 0.2, x = front[0] + dx, z = front[2] + dz; if (nav.isBlocked(x, z)) continue;
    const c = !g.col.solidBlocked([x, 1.0, z], [front[0], 1.0, front[2]]), n = !area || (x >= area.x0 - e && x <= area.x1 + e && z >= area.z0 - e && z <= area.z1 + e);
    const s = Math.hypot(dx, dz) + (c ? 0 : 100) + (n ? 0 : 10);   // (a clear line first, then the room, then the nearest)
    if (s < bs) { bs = s; best = [x, 0, z]; clear = c; inside = n; }
  }
  return { pos: best, ok: !!best && clear && inside, clear, inside };
}

/** the quiet mission that is up on this game (null: none) */
export function quietOf(g: Game): QuietMission | null { return g.quiet?.active ? g.quiet : null; }

/** THE WORDS, off the level's data: what mission.ts, the row, the radio and the card say while a quiet mission is up */
export function quietWords(g: Game) {
  const Q = quietOf(g); if (!Q) return null;
  const P = Q.spot!, thing = Q.thing, exits = Q.exits;
  const outs = exits.length === 1 ? exits[0].name : exits.length === 2 ? `${exits[0].name} or ${exits[1].name}` : `${exits.slice(0, -1).map(x => x.name).join(', ')} or ${exits[exits.length - 1].name}`;
  return { place: P.place, holder: P.holder, thing, outs, bare: thing.replace(/^(the|a|an) /i, '') };
}
/** the exit Sam went out by (the nearest whose line he is past), for the last line and the card */
export function exitTaken(g: Game, p: Vec3): QuietExit | null {
  const Q = quietOf(g); if (!Q) return null;
  let best: QuietExit | null = null, bd = Infinity;
  for (const x of Q.exits) if (outThrough(x, p)) { const d = Math.hypot(p[0] - x.x, p[2] - x.z); if (d < bd) { bd = d; best = x; } }
  return best;
}
/** the way out nearest `p` on foot-less distance (the marker; null with none up) */
export function nearestExit(g: Game, p: Vec3): QuietExit | null {
  const Q = quietOf(g); if (!Q) return null;
  let best: QuietExit | null = null, bd = Infinity;
  for (const x of Q.exits) { const d = Math.hypot(p[0] - x.x, p[2] - x.z); if (d < bd) { bd = d; best = x; } }
  return best;
}

// ---------------------------------------------------------------- the checker (tools/qa/quiet-check.ts; the probes): the block against the BUILT floor
/** Everything the level file's validator cannot say (scene/levelData.ts checks shapes and names): free floor, the ways on foot, first sight. `g` is a Game stood
 *  up on the level, as booted (nothing started). Returns the faults, each a line an author can act on. */
export function checkQuiet(g: Game): string[] {
  const Q = g.level.scenarios?.quiet, out: string[] = [];
  if (!Q) return ['the level carries no scenarios.quiet block'];
  const nav = g.col.nav, at = (p: readonly number[]) => `(${p[0]}, ${p[2]})`;
  const free = (what: string, p: Vec3) => { const b = nav.isBlocked(p[0], p[2]); if (b) out.push(`${what} ${at(p)} is not free floor a man can stand on`); return !b; };
  const way = (a: Vec3, b: Vec3) => { const path = nav.findPath(a, b, 20000); return !!path && path.length > 0; };
  Q.starts.forEach((S, i) => { const w = `starts[${i}]${S.name ? ` '${S.name}'` : ''}`; free(`${w}.sam`, S.sam); if (S.mate) { if (free(`${w}.mate`, S.mate) && !nav.walkable(S.sam, S.mate) && !way(S.sam, S.mate)) out.push(`${w}.mate ${at(S.mate)} cannot be walked to from sam ${at(S.sam)}`); if (v3.distXZ(S.sam, S.mate) < 0.7) out.push(`${w}.mate stands on top of sam (${v3.distXZ(S.sam, S.mate).toFixed(2)} m): give them a body's room`); } });
  const fronts = Q.spots.map((P, i) => { const w = `spots[${i}] '${P.place}'`;
    const A = P.area, e = 0.3; if (P.front[0] < A.x0 - e || P.front[0] > A.x1 + e || P.front[2] < A.z0 - e || P.front[2] > A.z1 + e) out.push(`${w}.front ${at(P.front)} is outside its area (x ${A.x0}‥${A.x1}, z ${A.z0}‥${A.z1})`);
    const H = holderStand(g, P.front, A), s = H.pos;   // (the floor in front of the holder's face — the face itself is on the furniture: the cell the game sends a man to)
    if (!s) out.push(`${w}: no free floor within 1.2 m of the holder's face ${at(P.front)} — nobody can reach it`);
    else if (!H.clear) out.push(`${w}: every free cell by the holder's face ${at(P.front)} has a solid between it and the face (nearest ${at(s)}) — the face is on the wrong side of the furniture, or inside it`);
    else if (!H.inside) out.push(`${w}: the floor before the holder ${at(s)} is outside the room's area — the thing would be taken without the room being reached`);
    return s; });
  const outs = Q.exits.map((X, i) => { const w = `exits[${i}] '${X.name}'`;
    const p = exitPoint(X, 0.6); if (!free(`${w}: the floor a stride past it`, p)) return null;
    const inn: Vec3 = [X.x - X.out[0] * 0.6, 0, X.z - X.out[1] * 0.6]; if (nav.isBlocked(inn[0], inn[2])) out.push(`${w}: the floor a stride short of it ${at(inn)} is not free — it cannot be walked out through`);
    const d = g.doors.byName(X.door); if (d) { const m = Math.hypot(d.frameCentre[0] - X.x, d.frameCentre[2] - X.z); if (m > 4) out.push(`${w}: its door '${X.door}' is ${m.toFixed(1)} m from its point — the marker would point at the wrong door`); }
    return p; });
  Q.starts.forEach((S, i) => fronts.forEach((f, j) => { if (f && !nav.isBlocked(S.sam[0], S.sam[2]) && !way(S.sam, f)) out.push(`no way on foot from starts[${i}] ${at(S.sam)} to spots[${j}] '${Q.spots[j].place}' ${at(f)}`); }));
  fronts.forEach((f, j) => outs.forEach((o, k) => { if (f && o && !way(f, o)) out.push(`no way on foot from spots[${j}] '${Q.spots[j].place}' to exits[${k}] '${Q.exits[k].name}' ${at(o)}`); }));
  // no start in the first sight of a man on his route's first waypoint (a run that begins seen is no run): the eye's reach and a clear line, whichever way he faces
  const routes = new Map(g.level.routes.map(r => [r.name, r] as const));
  const sets = Q.patrols ?? [g.level.routes.map(r => r.name)];
  const seen = new Set<string>();
  for (const set of sets) for (const name of set) { const r = routes.get(name); if (!r || !r.points.length) continue; const eye: Vec3 = [r.points[0][0], 1.6, r.points[0][2]];
    Q.starts.forEach((S, i) => { for (const [who, p] of [['sam', S.sam], ['mate', S.mate]] as const) { if (!p) continue; const k = `${name}:${i}:${who}`; if (seen.has(k)) continue; seen.add(k);
      const d = v3.distXZ(eye, p); if (d < FIRST_SIGHT_M && !g.col.segmentBlocked(eye, [p[0], 1.0, p[2]])) out.push(`starts[${i}].${who} ${at(p)} is in plain view of '${name}' on his first waypoint ${at(r.points[0])}, ${d.toFixed(1)} m off — the run would begin seen`); } }); }
  for (const [k, s] of Object.entries(Q.needs ?? {})) if (s) { free(`needs.${k} '${s.name}'`, s.pos); for (const [i, p] of (s.loop ?? []).entries()) free(`needs.${k}.loop[${i}]`, p); }
  (Q.phones ?? []).forEach((s, i) => free(`phones[${i}] '${s.name}'`, s.pos));
  (Q.wayouts ?? []).forEach((s, i) => free(`wayouts[${i}] '${s.name}'`, s.pos));
  if ((Q.phones?.length || Q.wayouts?.length) && !(g.level.civilians?.length)) out.push('phones / wayouts are given but the level has no civilians: nobody will use them');
  if (g.level.civilians?.length && !Q.wayouts?.length && !Q.phones?.length && !g.level.routes.length) out.push('the level has civilians and gives them no phone, no way out and no guard to run to');
  return out;
}
/** how far a man on his first waypoint is taken to see a start (the guards' eye reaches 16 m: guards.ts GUARD_EYE) */
const FIRST_SIGHT_M = 16;
