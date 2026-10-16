// A PAR: a room clear run AGAINST A CLOCK (the Door Kickers star rating). A level file carries a `scenarios.par` block (scene/scenarios.ts ParData:
// gold / silver / bronze seconds and `lossSecs`); while that level's room clear is up, this module times the run and, once, names the medal.
//
//   THE CLOCK STARTS on the first thing anybody DOES: the squad's first order (a row on orders.log), Sam's first stride off the mark the staging stood him on
//   (PAR_START_M), or his first round or throw — whichever comes first: reading the house from the start line is free, doing anything is not.
//   IT STOPS when the room clear ends 'taken' (roomclear.ts `end`, at its own `endAt`). A run that ends 'wiped' has no time.
//   EVERY TEAMMATE LOST (down at the end: dead, out cold or wounded — the floor keeps all three as state 'dead') adds `lossSecs`: the total is what the medals
//   are held against, so a run that loses men ranks under a clean one of the same pace.
//   THE MEDAL IS JUDGED ON WHAT IS SHOWN: the total in whole seconds, as the clock words it (65.4 s reads 1:05 and is inside a 1:05 gold).
//
// WHAT IT IS NOT: a rule. Like the lesson (lesson.ts) it only READS the game — it moves nobody, ends nothing and writes nothing the simulation reads (one HUD
// line through Game.msg at the end, which no AI and no digest reads) — so a level with the block plays the same run with `PAR.on` false (`?nopar`), and a level
// without the block returns on the first line of every entry point. Seams: game.ts (`par.tick()` right after updateMission), mission.ts objectiveText (the room
// clear's row carries the clock), savestate.ts (the clock's slice — though the game refuses a checkpoint while a squad is on the floor, so today it is unreached).
// No dice, no camera, nothing off the GPU. A BEST TIME is the page's to keep (main.ts + ui/parBest.ts): it hands its words back through `best()`, which only
// words the line already said.
//
// (src/game is one import cycle: nothing here is built from another game module's exports at module load.)
import type { Game } from './game';
import type { ParData } from '../scene/scenarios';
import type { Vec3 } from '../math/vec';

/** the switch: off = a par level plays as its room clear alone, no clock (and nothing here runs) */
export const PAR = { on: true };
export const PAR_STATS = { started: 0, finished: 0 };
/** how far Sam walks from where the staging stood him before the clock is his (metres): more than a shuffle, less than the way to any door */
export const PAR_START_M = 1.0;

export type Medal = 'gold' | 'silver' | 'bronze' | 'none';
const MEDALS: readonly Exclude<Medal, 'none'>[] = ['gold', 'silver', 'bronze'];
/** a finished run against its par: `secs` on the clock, `lost` teammates × `lossSecs` = `penalty`, `total` = their sum, `shown` = the total in whole seconds
 *  (what the player reads, and what the medals are held against); `next` = the medal above the one earned and how many seconds faster it needed (null on gold) */
export interface ParResult { secs: number; lost: number; of: number; penalty: number; total: number; shown: number; medal: Medal; next: { medal: Medal; bar: number; short: number } | null; line: string }
/** a checkpoint's slice: when the clock started on the game clock (null: not yet) and whether the result has been said */
export interface ParSnap { t0: number | null; said: boolean }

/** the medal a total earns against a par (pure): judged in whole seconds, as the clock shows it */
export function medalOf(D: ParData, total: number): Medal { const t = Math.floor(total); return t <= D.gold ? 'gold' : t <= D.silver ? 'silver' : t <= D.bronze ? 'bronze' : 'none'; }
/** a run's result against a par (pure: what tick() files at the end, and what a tally asks of two numbers) */
export function parResult(D: ParData, secs: number, lost: number, of = 0): ParResult {
  const penalty = lost * D.lossSecs, total = secs + penalty, shown = Math.floor(total), medal = medalOf(D, total);
  const k = medal === 'none' ? 2 : MEDALS.indexOf(medal) - 1, up = k >= 0 ? MEDALS[k] : null;
  const next = up ? { medal: up as Medal, bar: D[up], short: shown - D[up] } : null;
  const line = `par ▸ ${clock(secs)}${lost ? ` +${clock(penalty)} (${lost} lost) = ${clock(total)}` : ''} · ${medal === 'none' ? 'no medal' : medal.toUpperCase()}`
    + (next ? ` · ${next.medal} was ${clock(next.bar)}` : '');
  return { secs, lost, of, penalty, total, shown, medal, next, line };
}
/** m:ss */
export function clock(s: number): string { const n = Math.max(0, Math.floor(s)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; }

export class Par {
  /** the Mission this clock belongs to (a restart makes a fresh one: the clock starts over) */
  private run: object | null = null;
  /** where the staging stood Sam, the last order on the log then (by identity: the log is trimmed from the front), his rounds and throws then, and when the
   *  clock started (NaN: not yet) */
  private origin: Vec3 = [0, 0, 0]; private order0: object | null = null; private fired0 = 0; private t0 = NaN;
  private res: ParResult | null = null; private said = false;
  /** the HUD row the result was said on, and the page's words about this machine's best (presentation: `best()`) */
  private saidRow: { text: string } | null = null; private bestWords = '';
  log: string[] = [];
  constructor(private g: Game) {}

  /** the level's par while it is LIVE: the switch on, the block there, its room clear up, no show running (null = stood down) */
  get data(): ParData | null {
    const g = this.g; if (!PAR.on) return null;
    const D = g.level.scenarios?.par; if (!D) return null;
    if (g.touring || g.quietUtility || g.puppet) return null;
    return g.roomClear?.active ? D : null;
  }
  /** has the clock started (for THIS mission) */
  get started(): boolean { return this.run === this.g.mission && Number.isFinite(this.t0); }
  /** seconds on the clock now (0 before it starts; held at the end's own time once the room clear has ended) */
  get secs(): number { if (!this.started) return 0; const rc = this.g.roomClear, t = rc?.end ? rc.endAt : this.g.time; return Math.max(0, t - this.t0); }
  /** teammates down now, of how many */
  private lost(): [number, number] { const ops = this.g.nightBreach?.ops ?? []; return [ops.filter(o => o.state === 'dead').length, ops.length]; }
  /** Sam's rounds and throws so far this mission (the mission's own tally + the chronicle's count: both fresh with the mission) */
  private fired(): number { const g = this.g; return (g.mission?.stats?.shots ?? 0) + (g.chronicle?.counts?.thrown ?? 0); }
  /** the finished run (null: not taken yet, wiped, or no par here) */
  result(): ParResult | null { return this.data && this.run === this.g.mission ? this.res : null; }
  /** the result's line as shown: with the page's words about the best time, once it has handed them in */
  get shown(): string | null { const R = this.result(); return R ? R.line + (this.bestWords ? ` · ${this.bestWords}` : '') : null; }
  /** THE PAGE's words about this machine's best time for this run (main.ts, the frame the result first appears): they go on the line already said and on the
   *  end row. Presentation only — nothing the simulation reads. */
  best(words: string) { if (!this.result() || !words) return; this.bestWords = words; if (this.saidRow) this.saidRow.text = this.shown!; }

  /** once a frame (game.ts, right after updateMission: this frame's orders and the room clear's end are in) */
  tick() {
    const D = this.data; if (!D) return;
    const g = this.g, lg = g.orders?.log ?? [], tail = lg[lg.length - 1] ?? null;
    if (this.run !== g.mission) { this.fresh(tail); this.t0 = NaN; this.said = false; this.note(`armed: gold ${D.gold} · silver ${D.silver} · bronze ${D.bronze} · a man lost ${D.lossSecs}`); }
    const rc = g.roomClear;
    if (!Number.isFinite(this.t0)) {
      const p = g.player.char.pos, moved = Math.hypot(p[0] - this.origin[0], p[2] - this.origin[2]) > PAR_START_M, shot = this.fired() !== this.fired0;
      if (moved || shot || tail !== this.order0 || rc.end) { this.t0 = rc.end ? Math.min(g.time, rc.endAt) : g.time; PAR_STATS.started++; this.note(`clock started (${tail !== this.order0 ? 'an order' : shot ? 'a round or a throw' : moved ? 'the player moved' : 'the end'})`); }
      else return;
    }
    if (this.res || rc.end !== 'taken') return;
    const [lost, of] = this.lost();
    this.res = parResult(D, this.secs, lost, of); PAR_STATS.finished++; this.note(this.res.line);
    if (!this.said) { this.said = true; g.msg(this.res.line); this.saidRow = g.messages[g.messages.length - 1] ?? null; }   // (the HUD's log: said once — a checkpoint loaded after the end does not say it again)
  }
  /** this mission's marks: where Sam stands, the log's tail, his rounds so far — what 'the first thing done' is measured from */
  private fresh(tail: object | null) {
    const g = this.g; this.run = g.mission; this.res = null; this.saidRow = null; this.bestWords = ''; this.log.length = 0;
    const p = g.roomClear.startAt ?? g.player.char.pos; this.origin = [p[0], p[1], p[2]]; this.order0 = tail; this.fired0 = this.fired();
  }

  /** the room clear's objective row with the clock on it (mission.ts objectiveText; with no par live, the row as it was handed in): the clock FIRST, then
   *  the room clear's own words; at the end the result */
  objective(text: string): string {
    const R = this.result(); if (!R) return this.row() + text;
    return `structure taken · ${this.shown!.replace(/^par ▸ /, '')} — shift+enter stages it again`;
  }
  /** what leads the row while the run is on ('' = nothing: no par live, or the run is over) */
  row(): string {
    const D = this.data; if (!D) return '';
    const rc = this.g.roomClear;
    if (rc.end) return '';   // (taken: objective() words it · wiped: no time)
    if (this.run !== this.g.mission || !this.started) return `par ${clock(D.gold)} / ${clock(D.silver)} / ${clock(D.bronze)} · `;
    const [lost] = this.lost(), total = this.secs + lost * D.lossSecs, up = MEDALS.find(m => Math.floor(total) <= D[m]);
    return `⏱ ${clock(this.secs)}${lost ? ` +${clock(lost * D.lossSecs)}` : ''} → ${up ? `${up} ${clock(D[up])}` : 'past bronze'} · `;
  }

  /** a checkpoint's slice (savestate.ts): absent with no par live */
  snapshot(): ParSnap | undefined { if (!this.data) return undefined; const mine = this.run === this.g.mission; return { t0: mine && Number.isFinite(this.t0) ? this.t0 : null, said: mine && this.said }; }
  /** a checkpoint loaded (savestate.ts, after the mission slice — Game.time is the file's again, so the file's own start stands). A file without the slice
   *  (made with the par off): the clock starts over from the load */
  restore(s: ParSnap | undefined) {
    const D = this.data; if (!D) return;
    const lg = this.g.orders?.log ?? [];
    this.fresh(lg[lg.length - 1] ?? null);
    this.t0 = s && typeof s.t0 === 'number' && Number.isFinite(s.t0) ? s.t0 : NaN; this.said = !!s?.said;
    this.note(`checkpoint loaded: ${Number.isFinite(this.t0) ? `clock at ${clock(this.secs)}` : 'clock not started'}`);
  }
  private note(s: string) { this.log.push(`${this.g.time.toFixed(2)} ${s}`); if (this.log.length > 40) this.log.splice(0, 20); }
}
