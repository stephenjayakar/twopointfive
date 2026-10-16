// How a run went, said once it is over (the end card's record: ui/verdictCard.ts draws it, ui/verdictStore.ts keeps what this machine keeps of it).
//
// THE MODULE ONLY READS THE GAME (as par.ts and lesson.ts do): it moves nobody, draws no die and writes nothing the simulation reads, so a run is the same run
// with `VERDICT.on` false, digest for digest, on either stand. `tick()` comes after the scenarios, the mission and the snatch / defuse overlays have had this
// frame, so every end they wrote is in.
//
//   A TRY starts at the squad's first order, Sam's first stride (PAR_START_M off the mark he was staged on) or the first round or throw — the par clock's rule,
//     for every kind of mission: restarting before that is free. `started` goes up then and the run's clock runs from there.
//   THE END is each mission kind's own (a room clear taken or wiped, a hostage rescue's result, the night breach's room, a snatch or defuse level's own end, the
//     quiet game's exfil) or a player down. One `RunVerdict` is made then and never again for that run: won or lost in one word, the seconds, one row per man
//     (who was up at the end, when and where a man fell and to whom, when he dropped somebody, where he walked), the defenders, and — for a win — THE WAY it
//     was won, read off the run, one way a run:
//       quiet   no defender ever went alert or searching and no alarm was raised
//       dark    the mains were cut (a hand at the breaker, the OCP, a round into it) and were still out when the team was first found
//       walls   a man of the team went through a hole a blast opened in a wall
//       doors   anything else
//     in that order, so two pips on a mission card are two different plans.
//   CHEATS (god mode, no AI, unlimited ammo, invisible) on at any frame of the try: `void` — the card still shows, nothing is kept of it.
//   THE CARD: the stealth mission raises its own (`mission.debrief`); for every other end this module says when (`takeDue()`, read by the page).
//
// Per-player by construction: the men are `humans(g)` (today the one Player) then the AI teammates; nothing here asks for "the" player by name but that list.
// Not in a checkpoint: a load is the SAME try (`resumed`), and for the kinds that can be loaded (the quiet game alone) the way won is read off the chronicle,
// which a checkpoint does carry. `kept` is the page's note to the card (which try of the streak this was, the ways won so far) — display only.
import type { Game, Guard } from './game';
import type { Vec3 } from '../math/vec';
import { activeScenario, teamOf } from './scenarioRun';
import { roomOf } from './chronicle';
import { hostileTo } from './teams';
import { PAR_START_M } from './par';
import { runnerFled } from './runner';   // (asked inside the verdict only: false with its switch off)

export const VERDICT = {
  on: true,
  /** seconds between a squad mission's end and its card (the stealth mission's own card keeps its own beat) */
  winSecs: 2.0, lossSecs: 2.6,
};

/** the way a run was won, read off the run */
export type Approach = 'doors' | 'walls' | 'dark' | 'quiet';
export type ManState = 'up' | 'wounded' | 'out' | 'dead';
export type ManTone = 'you' | 'red' | 'blue' | null;

/** one man of the team at the run's end. Times are seconds from the try's start; `path` is x, z, t triples sampled as he walked. */
export interface VerdictMan {
  id: number; name: string; tone: ManTone; human: boolean;
  state: ManState; downAt: number; downRoom: string; downBy: string; downPos: [number, number] | null;
  drops: number[]; path: number[];
}
export interface RunVerdict {
  kind: ReturnType<typeof activeScenario>;
  won: boolean; word: string; why: string;
  /** seconds from the try's start to the end */
  secs: number;
  approach: Approach | null;
  /** a cheat was on during the try: nothing of it is kept */
  void: boolean;
  /** nobody of the team was lost */
  clean: boolean;
  men: VerdictMan[]; lost: number; of: number;
  /** the defenders: how many went down of how many, and where (x, z pairs) */
  foes: { down: number; of: number; fell: number[] };
  hostages: { alive: number; of: number } | null;
  /** where the team started (the map's mark) */
  start: [number, number];
}
/** the page's note to the card: which try of the streak this was (0 = not a counted try), the ways won on this mission so far */
export interface KeptNote { streak: number; fresh: boolean; gold: boolean; ways: Partial<Record<Approach, { first: boolean; clean: boolean }>>; /** a Training lesson's run: nothing is kept of it and the card grades nothing — no ways, no tries */ lesson?: boolean }

interface Track { id: number; name: string; tone: ManTone; human: boolean; gd: Guard | null; state: ManState; downAt: number; downRoom: string; downBy: string; downPos: [number, number] | null; drops: number[]; path: number[]; every: number; next: number }
const PATH_CAP = 1500, PATH_SECS = 0.5, HOLE_M = 0.9;

export class Verdict {
  private run: object | null = null;
  private t0 = NaN;
  private origin: Vec3 = [0, 0, 0];
  private order0: unknown = null;
  private fired0 = 0;
  /** this run was begun before a checkpoint load: the same try, not counted again */
  resumed = false;
  /** a cheat was on at some frame of the try */
  cheat = false;
  private foundAt = -1; private darkAt = -1; private darkWhenFound = false; private through = false;
  private wallSerial = 0; private holes: Vec3[] = [];
  private tracks = new Map<number, Track>();
  private foes = new Set<Guard>(); private fell = new Set<Guard>(); private fellAt: number[] = [];
  private res: RunVerdict | null = null;
  private cardAt = -1;
  kept: KeptNote | null = null;

  constructor(readonly g: Game) {}

  /** a run a verdict can be given on: never a show's, the tour's or a puppet's */
  get live(): boolean { const g = this.g; return VERDICT.on && !g.touring && !g.quietUtility && !g.puppet && !g.missionInTour; }
  /** the run this module is reading (the page keys its own bookkeeping on it) */
  get current(): object | null { return this.run; }
  /** the try has started: the first order, stride or round has been (or the run was loaded from a checkpoint) */
  get started(): boolean { return Number.isFinite(this.t0); }
  /** the run's verdict, once it is over (null before, and for a run that is not this mission any more) */
  get result(): RunVerdict | null { return VERDICT.on && this.run === this.g.mission ? this.res : null; }
  /** seconds since the try started */
  get secs(): number { return this.started ? Math.max(0, this.g.time - this.t0) : 0; }
  /** The page asks once a frame: true the one frame the end card is due for an end the stealth mission's own card does not cover. */
  takeDue(): boolean {
    if (!this.res || this.cardAt < 0 || this.run !== this.g.mission || this.g.time < this.cardAt) return false;
    this.cardAt = -1; return this.live;
  }
  summary(): string { const R = this.result; return R ? verdictLine(R, this.kept) : this.started ? `try running · ${clock(this.secs)}` : 'not started'; }

  tick() {
    if (!this.live) return;
    const g = this.g, lg = g.orders?.log ?? [], tail = lg[lg.length - 1] ?? null;
    if (this.run !== g.mission) this.fresh(tail);
    if (this.res) return;
    this.roster();
    if (!this.started) {
      const p = g.player.char.pos, moved = Math.hypot(p[0] - this.origin[0], p[2] - this.origin[2]) > PAR_START_M;
      if (moved || this.fired() !== this.fired0 || tail !== this.order0) this.t0 = g.time;
    }
    if (this.started && (g.godMode || !g.aiEnabled || g.infiniteAmmo || g.playerInvisible)) this.cheat = true;
    this.watch();
    const end = this.ended();
    if (end) this.close(end);
  }

  private fired(): number { const g = this.g; return (g.mission?.stats?.shots ?? 0) + (g.chronicle?.counts?.thrown ?? 0); }
  private fresh(tail: unknown) {
    const g = this.g;
    this.run = g.mission; this.res = null; this.cardAt = -1; this.kept = null; this.cheat = false;
    this.foundAt = -1; this.darkAt = -1; this.darkWhenFound = false; this.through = false; this.holes = [];
    this.wallSerial = g.destr?.walls?.serial ?? 0;
    this.tracks.clear(); this.foes.clear(); this.fell.clear(); this.fellAt = [];
    const p = g.roomClear?.active ? g.roomClear.startAt ?? g.player.char.pos : g.player.char.pos;
    this.origin = [p[0], p[1], p[2]]; this.order0 = tail; this.fired0 = this.fired();
    // a checkpoint load is a fresh mission object carrying the old run's chronicle: its clock the mission's own (the page counts the load as another try)
    this.resumed = (g.chronicle?.counts?.loads ?? 0) > 0;
    this.t0 = this.resumed ? g.time - (g.mission.stats.elapsed ?? 0) : NaN;
  }

  /** the humans of the team (one today), then its AI men: a track each, made the first frame he is seen */
  private roster() {
    const g = this.g;
    for (const pl of humans(g)) if (!this.tracks.has(pl.char.id)) this.tracks.set(pl.char.id, track(pl.char.id, 'Player', 'you', true, null));
    const paired = !!g.orders?.paired;
    for (const gd of teamOf(g)) if (!this.tracks.has(gd.char.id)) this.tracks.set(gd.char.id, track(gd.char.id, gd.callsign, paired ? gd.unit?.pair ?? null : null, false, gd));
  }

  /** a man put down by hand with no name on it (an ordered takedown: pairorders.ts leaves `killerId` alone) is the partner's where the team has ONE AI man —
   *  no defender lays a hand on his own; with more men than one it is nobody's tick */
  private onlyMate(h: { killerId: number; downBy: string | null; downKind: string | null }) {
    if (h.killerId >= 0 || h.downBy !== 'guard' || h.downKind === 'shot' || h.downKind === 'wounded') return undefined;
    let one: ReturnType<typeof track> | undefined, n = 0;
    for (const T of this.tracks.values()) if (!T.human) { one = T; n++; }
    return n === 1 ? one : undefined;
  }

  /** this frame read: who is where, who fell, who dropped whom, whether the team has been found, the mains, a hole walked through */
  private watch() {
    const g = this.g, now = this.secs;
    // the defenders: every man hostile to the player this run has met
    for (const h of g.guards) if (!this.foes.has(h) && h.team !== 'operative' && hostileTo(h, 'player')) this.foes.add(h);
    let hunting = false;
    for (const h of this.foes) {
      if (h.state === 'dead') {
        if (!this.fell.has(h)) { this.fell.add(h); this.fellAt.push(h.char.pos[0], h.char.pos[2]); const by = this.tracks.get(h.killerId) ?? (h.killerId < 0 && h.downBy === 'player' ? this.tracks.get(g.player.char.id) : undefined) ?? this.onlyMate(h); by?.drops.push(now); }
      } else if (h.state === 'alert' || h.state === 'search') hunting = true;
    }
    if (g.mission.stats.blackout && this.darkAt < 0) this.darkAt = now;
    if (hunting && this.foundAt < 0) { this.foundAt = now; this.darkWhenFound = this.darkAt >= 0 && !!g.blackout?.active; }
    // holes a blast opened in walls since the run began
    const W = g.destr?.walls;
    if (W && W.serial !== this.wallSerial) {
      for (const c of W.since(this.wallSerial) ?? []) { if (c.kind === 'reset') this.holes = []; else if (c.kind === 'hole' && c.cause === 'blast' && c.walkable) this.holes.push(c.pos); }
      this.wallSerial = W.serial;
    }
    // the men
    for (const T of this.tracks.values()) {
      if (T.state !== 'up') continue;
      const pl = T.human ? humans(g).find(x => x.char.id === T.id) : null, gd = T.gd;
      const c = pl ? pl.char : gd!.char, p = c.bones?.hips ?? c.pos;
      const down = pl ? pl.down : gd!.state === 'dead';
      if (down) {
        T.state = pl ? 'dead' : gd!.wound ? 'wounded' : gd!.downKind !== null && gd!.downKind !== 'shot' ? 'out' : 'dead';
        T.downAt = now; T.downPos = [p[0], p[2]]; T.downRoom = roomOf(p, g.level);
        T.downBy = pl ? g.chronicle?.counts?.downBy ?? '' : g.guards.find(x => x.char.id === gd!.killerId)?.callsign ?? '';
        T.path.push(p[0], p[2], now);
        continue;
      }
      if (now >= T.next || !T.path.length) {
        T.path.push(c.pos[0], c.pos[2], now); T.next = now + T.every;
        if (T.path.length >= PATH_CAP * 3) { const half: number[] = []; for (let i = 0; i < T.path.length; i += 6) half.push(T.path[i], T.path[i + 1], T.path[i + 2]); T.path = half; T.every *= 2; }
      }
      if (!this.through) for (const h of this.holes) if (Math.hypot(c.pos[0] - h[0], c.pos[2] - h[2]) < HOLE_M) { this.through = true; break; }
    }
  }

  /** this frame's end, by the mission kind's own rule (null = still running) */
  private ended(): { won: boolean; word: string; why: string } | null {
    const g = this.g, m = g.mission, kind = activeScenario(g);
    const lost = (word: string, why: string) => ({ won: false, word, why }), won = (word: string, why: string) => ({ won: true, word, why });
    if (kind === 'roomclear' && g.defuse?.active && g.defuse.end === 'failed') return lost('BLOWN', '');   // (the blast that fails it can take him with it: the charge is the why)
    if (humans(g).every(pl => pl.down)) return lost('DOWN', g.chronicle?.counts?.downBy ? `by ${g.chronicle.counts.downBy}` : '');
    if (kind === 'roomclear') {
      const rc = g.roomClear, S = g.snatch, D = g.defuse;
      if (S?.active) return S.end === 'won' ? won('TAKEN ALIVE', S.why) : S.end === 'lost' ? lost(S.lost === 'gone' ? 'GOT AWAY' : 'DEAD', S.why) : rc.end === 'wiped' ? lost('WIPED', rc.endWhy) : null;
      if (D?.active) return D.won ? won('DEFUSED', rc.endWhy) : D.end === 'failed' ? lost('BLOWN', '') : D.end === 'over' || rc.end === 'wiped' ? lost('WIPED', rc.endWhy) : null;
      return rc.end === 'taken' ? won('CLEAR', rc.endWhy) : rc.end === 'wiped' ? lost('WIPED', rc.endWhy) : null;
    }
    if (kind === 'rescue') { const R = g.rescue.result; return R ? R.state === 'rescued' ? won('RESCUED', R.why) : lost('LOST', R.why) : null; }
    if (kind === 'nightbreach') { const H = g.nightBreach.hostiles; return H.length && H.every(h => h.state === 'dead' || runnerFled(h)) ? won('CLEAR', '') : m.stage === 'failed' ? lost('FAILED', '') : null; }
    return m.stage === 'done' ? won('OUT', '') : m.stage === 'failed' ? lost('FAILED', '') : null;
  }

  private close(end: { won: boolean; word: string; why: string }) {
    const g = this.g, m = g.mission, kind = activeScenario(g), secs = this.secs;
    const men: VerdictMan[] = [...this.tracks.values()].map(T => ({ id: T.id, name: T.name, tone: T.tone, human: T.human, state: T.state, downAt: T.downAt, downRoom: T.downRoom, downBy: T.downBy, downPos: T.downPos, drops: T.drops.slice(), path: T.path.slice() }));
    const lost = men.filter(x => x.state !== 'up').length;
    let foesDown = 0; for (const h of this.foes) if (h.state === 'dead') foesDown++;
    const R = kind === 'rescue' ? g.rescue.result : null;
    this.res = {
      kind, won: end.won, word: end.word, why: end.why, secs, approach: end.won ? this.approach(kind) : null, void: this.cheat || (this.resumed && !!m.stats.sandbox),
      clean: lost === 0, men, lost, of: men.length, foes: { down: foesDown, of: this.foes.size, fell: this.fellAt.slice() },
      hostages: R ? { alive: R.hostages, of: g.rescue.hostages.length } : null, start: [this.origin[0], this.origin[2]],
    };
    // the stealth mission raises its own card (the exfil, a player down, a snatch lost); every other end is this module's to announce
    // (a player down on a mission not yet over gets the mission's down card next frame even where this frame's order hid it: a charge that went off after the mission's own tick)
    const own = m.debrief || m.stage === 'done' || (m.stage === 'failed' && m.downCardAt > 0) || (m.stage !== 'failed' && humans(g).every(pl => pl.down));
    this.cardAt = own ? -1 : g.time + (end.won ? VERDICT.winSecs : VERDICT.lossSecs);
  }

  /** the way a won run was won (the head comment's four, in its order) */
  private approach(kind: RunVerdict['kind']): Approach {
    const g = this.g, s = g.mission.stats, n = g.chronicle?.counts;
    // a loaded run lost this module's own latches: for the kinds that can be loaded the chronicle says the same
    // …and for the stealth game the mission's own books decide with it, loaded or not: an alarm raised by a camera or a frightened civilian found the
    // run though no man of the shift was ever seen hunting
    const stealth = kind === null || kind === 'quiet', loaded = this.resumed && stealth;
    const found = this.foundAt >= 0 || (stealth && (s.alerts > 0 || s.spotted > 0 || (n?.esc1 ?? 0) + (n?.esc2 ?? 0) > 0));
    if (!found) return 'quiet';
    if (this.darkWhenFound || (loaded && this.foundAt < 0 && s.blackout)) return 'dark';
    return this.through ? 'walls' : 'doors';
  }
}

/** the humans playing (one today; a second player joins this list and every rule above already asks it) */
function humans(g: Game) { return [g.player]; }
function track(id: number, name: string, tone: ManTone, human: boolean, gd: Guard | null): Track { return { id, name, tone, human, gd, state: 'up', downAt: -1, downRoom: '', downBy: '', downPos: null, drops: [], path: [], every: PATH_SECS, next: 0 }; }

/** m:ss */
export function clock(s: number): string { const t = Math.max(0, Math.floor(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; }
/** the verdict as one line (the copy button, a console read-out) */
export function verdictLine(R: RunVerdict, kept: KeptNote | null = null): string {
  const parts = [`${R.word} ${clock(R.secs)}`];
  if (R.approach && !kept?.lesson) parts.push(R.approach);
  if (R.of > 1) parts.push(`${R.of - R.lost} of ${R.of} up`);
  if (R.foes.of) parts.push(`${R.foes.down} of ${R.foes.of} defenders down`);
  if (R.hostages) parts.push(`${R.hostages.alive} of ${R.hostages.of} hostages alive`);
  if (kept?.streak) parts.push(`try ${kept.streak}`);
  if (R.void) parts.push('cheats on: not kept');
  return parts.join(' · ');
}
