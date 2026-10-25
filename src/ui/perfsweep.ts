// Perf SWEEP (F8): a measurement take that prices each heavy feature on the machine it runs on. GPU pass timings overlap (Metal runs independent passes side by side:
// the per-pass sum over-states the frame by a third or more), so a pass's own number is not what switching it off gives back — only an A/B on that machine says.
// One key: the world is frozen where it stands (the scene holds still — Shift+F8 leaves it running), auto quality is held (main.ts stops sampling the ladder while
// `active`; preset and scale stay where they were), the F9 recorder starts, and then ONE row of SWEEP_ROWS at a time is flipped for a second and a half and put back:
// base · flip 1 · base · flip 2 · … · base, a few rounds, the first in the list's order and every later one in a shuffle of its own (sweepOrder). Each segment is a recorder EVENT (kind 'sweep', JSON text) naming
// the row and how much of its start to drop (histories settle, GPU readbacks lag a few frames). At the end every setting is put back, the world goes on and the
// recording downloads as any F9 take does; tools/qa/perf-report.ts turns its sweep events into a table per feature (GPU union and fps given back, with the spread).
// Nothing here runs unless the key is pressed: tick() returns on its first line, and no setting is read or written.
// The picture flickers while it runs — it is a measurement take, not play. THE ROWS ARE DATA: a new settings row to price is one line in SWEEP_ROWS; a row whose
// setting this build does not have, or that is already at the flipped value, is skipped and named in the 'begin' event.
import type { Engine } from '../engine';
import type { Game } from '../game/game';
import { SCALE_STEP, SCALE_FLOOR, type Quality, type QualityName } from './quality';
import type { SmokeSystem } from '../smoke/smoke';
import type { PerfRecorder } from './perfrec';
import { mulberry32 } from '../math/dice';

/** one feature to price: `set` = an engine.settings patch (the flipped values; the base is whatever the page runs at when the sweep starts), or `custom` = one of the
 *  few flips that are not a settings write (arm() below); `needs` = settings the row only means something under (else it is skipped and says so); `or` = the flip
 *  the other way, taken when the page already stands at `set` (the ladder's climb takes these rungs itself); `warm` = its first flip compiles a shader (a second or so on a real GPU):
 *  every such row is switched on once, together, before the first segment, so no round times the compile */
export interface SweepRow { id: string; label: string; set?: Record<string, unknown>; needs?: Record<string, unknown>; or?: { label: string; set: Record<string, unknown> }; warm?: boolean; custom?: 'fog' | 'fogOld' | 'fogEdge' | 'smoke' | 'oneAir' | 'wispMotes' | 'irLight' | 'irLightOne' | 'scaleDown' | 'scaleUp' | 'scaleStart' | 'scaleTop' | 'preset' | 'extra';
  /** a row only the RUNNING world shows (Shift+F8): the reason, said when a frozen take skips it */
  liveOnly?: string;
  /** a row whose flip takes seconds to show (a population of particles that fills and drains at its own pace): its flipped segment AND the baseline after it drop this much
   *  of their start, where every other segment drops SweepOpts.settleMs. The segment's line in the take says so (`settleMs`), and the report cuts by it */
  settleMs?: number;
  /** the same for the baseline after the flip ONLY: a flip that shows at once but leaves the page seconds from how it stood */
  settleAfterMs?: number }
/** a custom row's flip handed in by the page (the game's half lives outside this file): what it writes, the write that returns its own undo, and — where the page knows
 *  how long the flip takes to show — the row's settleMs for this take */
export interface SweepFlip { from: Record<string, unknown>; to: Record<string, unknown>; apply: () => () => void; settleMs?: number;
  /** a page's own row with `warm`: true once its flipped picture really draws (a program compiling in the background), asked through the warm-up */
  ready?: () => boolean }
/** A ROW THE PAGE ADDS (PerfSweep.extra): a switch that is the page's own and no row of SWEEP_ROWS (a prototype page's panel). `flip` is asked once as the take begins,
 *  told which kind of take it is, and answers as a custom row's hook does: the flip, or the reason the row is skipped here (a write a running game takes back every step
 *  says so on a live take, as the fog and the clouds do). `from` / `to` go into the take's begin line as they are: small plain values. Its apply and undo must not go
 *  through Quality (that reads as the player changing the quality by hand, and the take stops). Added rows are flipped in the same rounds as the build's own (after them
 *  in the first round; every later round is one shuffle of all the take's rows, so a take with added rows orders the build's rows differently from one without) and the
 *  take names them like any row, so the report reads them with no change. An id that is taken ('base', a build row's, an earlier added row's) is skipped and says so, as
 *  is a flip that is not one. The benchmark's sweep (SweepOpts.inside) takes the build's rows alone: two machines' benchmarks are the same rows */
export interface SweepExtra { id: string; label: string; flip: (take: { live: boolean }) => SweepFlip | string; liveOnly?: string; warm?: boolean }
/** how long the blown snow takes to stand at new numbers, with room to spare: a grain's slot lives (top + 0.3) × 1.1 + 0.4 s — 8.4 s under the usual 7 m top — and a first set holds its
 *  slots half a second longer (game/snowFx.ts updateGrains). Twelve seconds covers a snow top of nine and a half metres */
const SLOW_SNOW_MS = 12000;
/** a steady light that leaves the picture or comes into it is in every accumulated signal (the reservoirs, the bounce, the reflections), and what a pixel's history
 *  holds steers how many rays it asks for (penumbras, young history, the audit): a second for those to stand at the new set, where a setting's flip gets half of one. Inferred, not measured */
const IR_SETTLE_MS = 1000;
/** a slow row's wait is in the WORLD's seconds (a wisp lives its life there), and the world runs behind the clock on a page under 20 frames a second, in slow motion
 *  or behind a menu: the wait is stretched by how far behind it ran over the segment before, this many times at most (a world that stands still must not hold the take) */
const SLOW_WORLD_MAX = 3;
export const SWEEP_ROWS: SweepRow[] = [
  { id: 'fog', label: 'fog of war off', custom: 'fog' },
  { id: 'fogOld', label: 'fog of war: the old pass', custom: 'fogOld', warm: true },   // (the fog pass part's two programs, one picture: old minus new = what the new one saves; skipped on a build with one program)
  { id: 'fogEdge', label: 'fog of war: the hard edge of before', custom: 'fogEdge' },   // (the soft band across each sight edge — game/fogofwar.ts FOG.edge; shaders/fogofwar.wgsl fowEdge: every pixel of the fog pass searches the sight table for the line, for each live eye, both ways — against the hard line it was. All inside the compute pass 'fogofwar': its own column and the union show it, on a page held at the display's rate too. More eyes on the floor, more of it. Skipped on a build from before the soft edge)
  { id: 'rcPeriods', label: 'light cache refreshed over 1,1,2,4 frames (Medium\'s)', set: { rcPeriods: [1, 1, 2, 4] } },
  { id: 'rcHalfRate', label: 'light cache at half rate', set: { rcHalfRate: true } },
  { id: 'secMinE', label: 'light cache: no shadow ray under 0.02 W/m²', set: { secMinE: 0.02 } },
  { id: 'held2', label: 'held-light rays 2', set: { heldRays: 2 } },
  { id: 'held0', label: 'held-light rays off', set: { heldRays: 0 } },
  { id: 'meshNear', label: 'mesh shadows off', set: { meshShadows: false, meshShadowsNear: false } },
  { id: 'reflect', label: 'reflections off', set: { rtReflect: false } },
  { id: 'sharp', label: 'sharp direct off', set: { sharpDirect: false, sharpDecouple: false, gbaa: false } },
  { id: 'marchLights', label: 'smoke march lights 0', set: { smokeMarchLights: 0 }, needs: { froxelVol: true } },   // (the per-pixel path lights its march by the row below: the knob is only read on the froxel path)
  { id: 'volK', label: 'beams and smoke: 2 lights a step', set: { volLightCap: 2 } },
  { id: 'volQuarter', label: 'beams and smoke march at quarter size', set: { volQuarter: true }, or: { label: 'beams and smoke march back at full size', set: { volQuarter: false } } },
  { id: 'froxel', label: 'beams on the froxel path', set: { froxelVol: true } },
  { id: 'smoke', label: 'dust and smoke not drawn', custom: 'smoke' },
  { id: 'wxAir', label: 'weather dust in the air: 3 steps a ray', set: { wxAirSteps: 3 } },   // (the dust volume's march, a sun shadow ray a step: this row minus the baseline = most of what the volume costs while a weather is in; nothing moves in clear air)
  { id: 'air', label: 'wind sim off', set: { airSim: false }, needs: { airSim: true }, liveOnly: 'a frozen world steps no air', settleAfterMs: SLOW_SNOW_MS },   // (the air solver's compute pass, timed as 'air': a fixed cost on its own grid, stepped only on a frame with time in it that something reads the air on — today the snow. With it off the snow is flakes on the plain storm wind and wisps in gust patches; when it comes back the wisps and the flakes take seconds to stand as they stood (and under ?snowair=0 a whole first set of grains is filed over the ones still in the ring): the baseline after it waits that out. A build from before the solver has no such setting and skips the row)
  { id: 'oneAir', label: 'one snow in one air off: the blown grains of before', custom: 'oneAir', liveOnly: 'a frozen world files no snow', settleMs: SLOW_SNOW_MS },   // (ui/sweepSnow.ts: the snow as it opens against the snow of before it. The grains' first set is filed over nine seconds and lives as long once the switch is back, so each side waits that out. The wind sim steps on both sides: the solver's own price is the row above. The update is the compute pass 'particles'; the DRAW is a render pass the GPU columns leave out: only the frame time sees that)
  { id: 'wispMotes', label: 'blown snow wisps: the combed streak of before', custom: 'wispMotes', liveOnly: 'a frozen world files no snow' },   // (ui/sweepSnow.ts: a wisp as a puff of motes against the streak it was. All of it is the particle DRAW's fragment work, a render pass the GPU columns leave out: only the frame time of a take not held at the display's rate sees it. A wisp keeps the look it was filed with, so each side waits out a wisp's life: the flip names that wait itself, off the wisps' own numbers)
  { id: 'restirRays', label: 'direct light: 3 rays a pixel', set: { restirRays: 3 } },
  { id: 'restirSpatial', label: 'direct light: 2 spatial taps', set: { restirSpatial: 2 } },
  { id: 'penRays', label: 'direct light: no second ray in penumbras', set: { restirPenRays: false } },
  { id: 'spatialAll', label: 'direct light: spatial taps on young history only', set: { restirSpatialAll: false } },
  { id: 'audit', label: 'direct light: no audit rays', set: { restirAudit: 0 } },
  { id: 'irLight', label: 'goggles: infrared lights off', custom: 'irLight', settleMs: IR_SETTLE_MS },   // (the illuminators on the goggles — game/irlight.ts, render/lights.ts LightSet.ir: up to five wide spots for as long as the goggles are down, steady lights in the tube's picture like so many carried torches: the direct pass's reservoirs, the bounce, the reflections. LightSet.irCap, the picture's alone: frozen and live takes. Skipped with the goggles up)
  { id: 'irLightOne', label: 'goggles: one infrared light alone', custom: 'irLightOne', settleMs: IR_SETTLE_MS },   // (the first of them — the player's — with the teammates' out: against the row above and the baseline, how the price grows with the count)
  { id: 'heldAdaptive', label: 'TRADE: held lights stop at 2 rays where they agree', set: { heldAdaptive: true }, warm: true },   // (the lighting part's trade rows: skipped by name on a build without them)
  { id: 'stableRetrace', label: 'TRADE: settled lit samples re-traced every other frame', set: { restirStableRetrace: true }, warm: true },
  { id: 'dimClass', label: 'TRADE: dim emitter classes take one ray', set: { restirDimClass: 0.05 }, warm: true },
  { id: 'shadowIters', label: 'shadow filter: 2 passes', set: { dnShadowIters: 2 } },
  { id: 'shadowOccl', label: 'hidden torch fix off', set: { dnShadowOccl: false } },   // (the flashlight leak fix's switch in the shadow filter and sharp direct: skipped by name on a build without it)
  { id: 'giIters', label: 'bounce filter: 3 passes', set: { dnGiIters: 3 } },
  { id: 'cards', label: 'torch bounce cards off', set: { torchBounceCards: false } },
  { id: 'scaleDown', label: 'render scale one step down', custom: 'scaleDown' },
  { id: 'scaleUp', label: 'render scale one step up', custom: 'scaleUp' },
  { id: 'scaleStart', label: 'render scale where the preset starts', custom: 'scaleStart' },   // (the two ends of the ladder's climb: what the whole climb costs, whichever end the take starts at)
  { id: 'scaleTop', label: 'render scale at the top of the climb', custom: 'scaleTop' },
  { id: 'gatherHalf', label: 'bounce gather at half size (the climb\'s next rung)', set: { gatherThird: false }, or: { label: 'bounce gather back at third size (the climb\'s rung undone)', set: { gatherThird: true } } },
  { id: 'preset', label: 'the whole other preset', custom: 'preset' },
];

export interface SweepOpts {
  rounds: number;
  /** per segment: the start that is dropped (ms AND frames, whichever is longer), then the part that is measured */
  settleMs: number; measureMs: number; settleFrames: number; measureFrames: number;
  /** true = the world keeps running (stand still); false = frozen where it stands */
  live: boolean;
  /** only these row ids (a dry run) */
  only?: string[];
  /** a sweep inside somebody else's take (the benchmark's: ui/bench.ts): the recording goes on when it ends, it puts no line or tag of its own on the screen, and it
   *  flips the build's rows alone (none of PerfSweep.extra) */
  inside?: boolean;
}
export const SWEEP_DEFAULTS: SweepOpts = { rounds: 3, settleMs: 500, measureMs: 1000, settleFrames: 12, measureFrames: 30, live: false };

type Undo = () => void;
const WARM_MS = 2500, WARM_FRAMES = 20, WARM_CAP_MS = 15000;
/** the order one round flips its rows in: round 0 as listed, every later round a shuffle of its own off a fixed die keyed by the round number (so a take's plan is the same
 *  every time). Rows that sit together in the list then do not sit together in every round: a few slow seconds on the machine cannot hit the same neighbours twice. */
export function sweepOrder<T>(rows: readonly T[], round: number): T[] {
  const a = [...rows]; if (!round) return a;
  const rnd = mulberry32(0x5eed + round * 7919);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
interface Armed { row: SweepRow; label: string; from: Record<string, unknown>; to: Record<string, unknown>; apply: () => Undo; ready?: () => boolean }   // (ready: a warm row whose program compiles in the background says when it draws)
interface Seg { round: number; armed: Armed | null }
interface Live { a: Armed; undo: Undo }   // (a row that stands flipped right now, and the way back)
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);
const copy = <T>(v: T): T => (Array.isArray(v) ? [...v] : v) as T;

export class PerfSweep {
  active = false;
  private opts: SweepOpts = SWEEP_DEFAULTS;
  private plan: Seg[] = []; private at = -1; private segT0 = 0; private segG0: number | null = null; private slow = 1; private segFrames = 0; private live: Live[] = []; private warming = false; private warmReady: (() => boolean)[] = []; private segSettle = 0;
  private base: Record<string, unknown> = {};
  private tag: HTMLElement | null = null; private preset = ''; private hand = false; private own = false;   // (the preset the page should be at right now: the start's, or the preset row's while it is flipped)
  /** the last finished (or stopped) sweep: 'done' | 'stopped: why' — what a script polls */
  last = '';
  constructor(private engine: Engine, private game: Game, private quality: Quality, private smoke: SmokeSystem, private rec: PerfRecorder, private note: (s: string) => void,
    /** a reason the page cannot be measured right now (auto quality still calibrating, the start card up), or null */
    private blocked: () => string | null = () => null) {}
  /** the 'one snow in one air off' row's flip (ui/sweepSnow.ts, set by the page): its flip, or why not here. Unset = a page without it: the row is skipped */
  oneAir: (() => SweepFlip | string) | null = null;
  /** the wisps' row, the same way */
  wispMotes: (() => SweepFlip | string) | null = null;
  /** rows of the page's own (SweepExtra), set by the page. None = the build's rows alone, as it was */
  extra: SweepExtra[] = [];
  /** a row's way back threw during this take: the closing line does not say everything is back */
  private stuck = false;
  /** the world holds still for the take (host/loop.ts frozen: no game step, the picture stays live) */
  get freezing(): boolean { return this.active && !this.opts.live; }
  get progress(): string { return this.active ? `${this.at + 1}/${this.plan.length}` : this.last; }
  /** the segment under way is past its settle: its frames from here are the ones that count (a caller pricing the rows as they go: ui/bench.ts) */
  get settled(): boolean { return this.active && !this.warming && this.at >= 0 && performance.now() - this.segT0 >= this.segSettle && this.segFrames >= this.opts.settleFrames; }
  /** the row flipped right now ('base' between two flips, '' while warming up or with no sweep on) — what a script watching the page keys on */
  get flipped(): string { return !this.active || this.warming || this.at < 0 ? '' : this.plan[this.at]?.armed?.row.id ?? 'base'; }
  toggle(live = false): void { if (this.active) this.stop('F8'); else this.start({ live }); }

  start(o: Partial<SweepOpts> = {}): string {
    if (this.active) return 'already sweeping';
    const no = this.blocked(); if (no) { this.note(`SWEEP: not now (${no})`); return `not now: ${no}`; }
    this.opts = { ...SWEEP_DEFAULTS, ...o };
    const S = this.settings; this.base = {};   // what the sweep's own rows write, as it stands now: finish() puts exactly these back (nothing the game moved meanwhile)
    for (const row of SWEEP_ROWS) for (const k of Object.keys(row.set ?? {})) if (k in S) this.base[k] = copy(S[k]);
    this.base.renderScale = S.renderScale;
    const armed: Armed[] = [], skipped: { id: string; why: string }[] = [];
    for (const row of SWEEP_ROWS) {
      if (this.opts.only && !this.opts.only.includes(row.id)) continue;
      const a = this.arm(row); if (typeof a === 'string') skipped.push({ id: row.id, why: a }); else armed.push(a);
    }
    const ids = new Set(['base', ...SWEEP_ROWS.map(r => r.id)]);   // ('base' is what a segment between two flips is called)
    if (!this.opts.inside) for (const x of this.extra) {
      const id = typeof x?.id === 'string' ? x.id : '';
      if (this.opts.only && !this.opts.only.includes(id)) continue;
      const a = this.armExtra(x, ids); if (typeof a === 'string') skipped.push({ id: `added row '${id}'`, why: a }); else { ids.add(id); armed.push(a); }
    }
    if (!armed.length) { this.note('SWEEP: nothing to flip here'); return 'nothing to flip'; }
    this.plan = [];
    for (let r = 0; r < this.opts.rounds; r++) for (const a of sweepOrder(armed, r)) this.plan.push({ round: r, armed: null }, { round: r, armed: a });
    this.plan.push({ round: this.opts.rounds - 1, armed: null });
    this.active = true; this.last = ''; this.stuck = false; this.preset = this.quality.current; this.watch(true); this.segG0 = null; this.slow = 1;
    if (!this.rec.recording) this.rec.start('perf sweep (F8): one feature flipped at a time; the sweep events name each segment');
    const secs = Math.round(this.plan.reduce((t, _, i) => t + this.settleOf(i) + this.opts.measureMs, 0) / 1000);
    this.rec.event('sweep', JSON.stringify({ op: 'begin', mode: this.opts.live ? 'live' : 'frozen', rounds: this.opts.rounds, settleMs: this.opts.settleMs, measureMs: this.opts.measureMs, settleFrames: this.opts.settleFrames, measureFrames: this.opts.measureFrames,
      preset: this.quality.label, res: [this.engine.width, this.engine.height], scale: S.renderScale, smoke: this.smoke.stats.live, timers: !!this.engine.timer?.enabled,
      rows: armed.map(a => ({ id: a.row.id, label: a.label, from: a.from, to: a.to })), skipped }));
    if (!this.opts.inside) this.note(`SWEEP: measuring for about ${secs >= 90 ? `${Math.round(secs / 60)} min` : `${secs} s`}, hands off. The picture will flicker. F8 stops`);
    this.at = -1;
    const warm = armed.filter(a => a.row.warm);
    if (warm.length) {   // their shaders compiled before anything is timed: all of them on together for a few seconds, then off, then the first segment
      this.live = [];
      try { for (const a of warm) this.live.push({ a, undo: a.apply() }); }   // (each one tracked as it is made: a flip that throws leaves the earlier ones undoable)
      catch (e) { const why = `a flip failed (warm-up: ${String(e).slice(0, 80)})`; this.finish(why, false); return why; }
      this.warmReady = warm.flatMap(a => a.ready ? [a.ready] : []);
      this.warming = true; this.segT0 = performance.now(); this.segFrames = 0;
      this.rec.event('sweep', JSON.stringify({ op: 'warm', ids: warm.map(a => a.row.id) }));
      this.showTag('SWEEP warming up · F8 stops');
    } else this.next();
    return `sweeping ${armed.length} rows × ${this.opts.rounds} rounds, about ${secs} s${skipped.length ? ` (skipped: ${skipped.map(s => s.id).join(', ')})` : ''}`;
  }

  /** once per presented frame, right after the recorder's frame(): a return on its first line while no sweep runs */
  tick(): void {
    if (!this.active) return;
    if (!this.rec.recording) { this.finish('the recorder stopped', false); return; }
    if (this.byHand()) { this.finish('quality was changed by hand', false); return; }
    this.segFrames++;
    const o = this.opts;
    if (this.warming) {   // (held past its few seconds while a warm row's program is still compiling, to a limit)
      const t = performance.now() - this.segT0;
      if (t >= WARM_MS && this.segFrames >= WARM_FRAMES && (t >= WARM_CAP_MS || this.warmReady.every(r => { try { return r(); } catch { return true; } }))) { this.warming = false; this.next(); }
      return;
    }
    if (performance.now() - this.segT0 >= this.segSettle + o.measureMs && this.segFrames >= o.settleFrames + o.measureFrames) this.next();
  }
  stop(why = 'stopped'): void { if (this.active) this.finish(why, false); }

  private get settings(): Record<string, unknown> { return this.engine.settings as unknown as Record<string, unknown>; }
  /** the start of segment i that is dropped, ms: the take's own, or a slow row's — for its flipped segment and for the baseline right after it (the flip takes as long to go as to come) */
  private settleOf(i: number): number { return Math.max(this.opts.settleMs, Math.round(this.slow * Math.max(this.plan[i]?.armed?.row.settleMs ?? 0, this.plan[i - 1]?.armed?.row.settleMs ?? 0, this.plan[i - 1]?.armed?.row.settleAfterMs ?? 0))); }
  /** the game's own clock, s (null on a page whose game has none) */
  private clock(): number | null { const t = (this.game as unknown as { time?: unknown }).time; return typeof t === 'number' ? t : null; }
  private next(): void {
    this.at++;
    const seg = this.plan[this.at], a = seg?.armed ?? null;
    try { this.undoLive(); if (a) this.live = [{ a, undo: a.apply() }]; }
    catch (e) { this.finish(`a flip failed (${a ? a.row.id : 'undo'}: ${String(e).slice(0, 80)})`, false); return; }   // (never out of the frame loop with the world frozen and a row flipped)
    if (!seg) { this.finish('done', true); return; }
    const t = performance.now(), g = this.clock();   // (how far behind the clock the world ran over the segment that just ended: SLOW_WORLD_MAX)
    this.slow = this.opts.live && g !== null && this.segG0 !== null ? Math.min(SLOW_WORLD_MAX, Math.max(1, (t - this.segT0) / Math.max(1, (g - this.segG0) * 1000))) : 1;
    this.segT0 = t; this.segG0 = g; this.segFrames = 0; this.segSettle = this.settleOf(this.at);
    this.rec.event('sweep', JSON.stringify({ op: 'seg', i: this.at, of: this.plan.length, round: seg.round, id: a ? a.row.id : 'base', state: a ? 'flip' : 'base', ...(this.segSettle > this.opts.settleMs ? { settleMs: this.segSettle } : {}) }));
    this.showTag(`SWEEP ${Math.round(100 * this.at / this.plan.length)} % · ${a ? a.label : 'base'} · F8 stops`);
  }
  /** however it ends: if the player changed the quality by hand since the take began (`keep`), his preset stands and only what the sweep itself had flipped at that moment is put
   *  back (keepBack); else every flip is undone and every row the sweep writes is back where it started */
  private finish(why: string, done: boolean): void {
    const keep = !done && this.byHand(); this.watch(false);
    if (keep) this.keepBack(); else { try { this.undoLive(); } catch { /* */ } this.restoreAll(); }
    this.live = []; this.warming = false;
    this.active = false; this.last = done ? 'done' : `stopped: ${why}`;
    if (this.rec.recording) { this.rec.event('sweep', JSON.stringify({ op: 'end', done, why })); if (!this.opts.inside) this.rec.stop(); }
    this.showTag(null);
    if (!this.opts.inside) this.note(done ? 'SWEEP done: the perf-….json that just downloaded is the take' : keep ? `SWEEP stopped (${why}): your quality stands as you set it, the sweep's own flip is back` : `SWEEP stopped (${why}): ${this.stuck ? "one row's way back failed, the rest is back as it was" : 'everything is back as it was'}`);
  }
  /** the quality was set by hand since the take began: any quality.apply that was not the preset row's own (the same preset picked again counts: the card's scale slider pins it),
   *  or — on a page whose Quality cannot be watched — the preset no longer the one the sweep stands at */
  private byHand(): boolean { return this.hand || this.quality.current !== this.preset || this.quality.calibrating; }
  /** for the length of a take, quality.apply on THIS page's Quality says when it is called (an own property over the class's method, taken off again at the end) */
  private watch(on: boolean): void {
    const Q = this.quality as unknown as { apply?: (n: QualityName) => void }; this.hand = false; this.own = false;
    if (Object.prototype.hasOwnProperty.call(Q, 'apply')) delete Q.apply;
    const real = Q.apply; if (!on || typeof real !== 'function') return;
    Q.apply = (n: QualityName) => { if (!this.own) this.hand = true; real.call(Q, n); };
  }
  private undoLive(): void {   // (every undo runs, whatever one of them throws: a page's own row must not leave the others flipped. The first throw is the caller's)
    const l = this.live; this.live = []; let threw = false, err: unknown;
    for (const x of l.reverse()) try { x.undo(); } catch (e) { if (!threw) { threw = true; err = e; } }
    if (threw) { this.stuck = true; throw err; }
  }
  /** a hand quality change found a row (or the warm-up's rows) flipped. The rows his preset writes stand as it wrote them; the rest of the flip goes back: a flip that is not a
   *  setting (fog, the clouds) by its own undo, a setting no preset writes (the hidden torch fix, the trade rows) to what it was — unless it no longer stands at the flipped value */
  private keepBack(): void {
    const S = this.settings, wrote = this.presetKeys();
    for (const { a, undo } of this.live.reverse()) {
      try {
        const c = a.row.custom;
        if (c === 'preset') continue;   // (the preset he picked is the page's now, not the one this row was to put back)
        if (c && !c.startsWith('scale')) { undo(); continue; }   // (every custom row but the scale rows writes something that is not a setting: its own undo is the only way back)
        for (const k of Object.keys(a.to)) if (!wrote.has(k) && same(S[k], a.to[k])) S[k] = copy(a.from[k]);   // (plain rows and the scale rows: from / to are keyed by the setting)
      } catch { /* */ }
    }
  }
  /** the settings a preset writes: the class's own apply run on a stand-in that carries a copy of Quality's fields and a scratch copy of the settings, so nothing of the page is
   *  touched (not its settings, the light cache, the smoke rows, the ladder's rungs nor what this machine remembers). If that run breaks part-way the rows it had written by then
   *  still count; with none at all, keepBack puts back whatever still stands at its flipped value */
  private presetKeys(): Set<string> {
    const keys = new Set<string>(), Q = this.quality as unknown as Record<string, unknown>;
    try {
      const scratch = new Proxy<Record<string, unknown>>({ ...this.settings }, { set: (t, k, v) => { if (typeof k === 'string') { keys.add(k); t[k] = v; } return true; } });
      const standIn = Object.create(Object.getPrototypeOf(Q)) as Record<string, unknown> & { apply(name: QualityName): void };
      for (const k of Object.keys(Q)) { const v = Q[k]; if (k !== 'apply') standIn[k] = v instanceof Map ? new Map(v) : Array.isArray(v) ? [...v] : v && typeof v === 'object' ? { ...v } : v; }   // (not the take's own watch on apply)
      Object.assign(standIn, { engine: { settings: scratch, rc: { cfg: { ...this.engine.rc.cfg } }, rebuildRc() { /* */ } }, smoke: { params: {} }, auto: false });
      standIn.apply(this.quality.current as QualityName);
    } catch { /* (what was written before it broke stands) */ }
    return keys;
  }
  /** every setting the sweep's rows write, back to what it was at the start (each flip's own undo has already run: this is the belt to its braces) */
  private restoreAll(): void { const S = this.settings; for (const k of Object.keys(this.base)) if (!same(S[k], this.base[k])) S[k] = copy(this.base[k]); }
  /** every plain setting + the smoke row a preset writes, as they stand: the preset row's undo (quality.apply writes dozens of rows) */
  private snapshot(): () => void {
    const S = this.settings, P = this.smoke.params, snap: Record<string, unknown> = {}, rb = P.rbIters;
    for (const k of Object.keys(S)) { const v = S[k]; if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string' || Array.isArray(v)) snap[k] = copy(v); }
    return () => { for (const k of Object.keys(snap)) if (!same(S[k], snap[k])) S[k] = copy(snap[k]); P.rbIters = rb; };
  }

  /** a row the page added, made ready the same way (its flip is the page's: asked here, once). The page's half is held to its shape before the take leans on it: a flip
   *  that is not one, values the take's lines cannot carry, or a wait that is no number skip the row and say so, never stop the take */
  private armExtra(x: SweepExtra, taken: Set<string>): Armed | string {
    if (typeof x?.id !== 'string' || !x.id || typeof x.label !== 'string' || typeof x.flip !== 'function') return 'not a row (id, label, flip)';
    if (taken.has(x.id)) return `another row is called '${x.id}'`;
    if (x.liveOnly && !this.opts.live) return `live takes only (Shift+F8): ${x.liveOnly}`;
    let f: SweepFlip | string; try { f = x.flip({ live: this.opts.live }); } catch (e) { return `its flip failed (${String(e).slice(0, 80)})`; }
    if (typeof f === 'string') return f || 'skipped by the page';
    const plain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
    if (!plain(f) || !plain(f.from) || !plain(f.to) || typeof f.apply !== 'function') return 'its flip is not one (from, to, apply)';
    let from: Record<string, unknown>, to: Record<string, unknown>;
    try { from = JSON.parse(JSON.stringify(f.from)); to = JSON.parse(JSON.stringify(f.to)); } catch { return "its from / to cannot be written into the take's lines"; }
    const flip = f, settleMs = typeof f.settleMs === 'number' && Number.isFinite(f.settleMs) && f.settleMs > 0 ? f.settleMs : undefined;
    return { row: { id: x.id, label: x.label, custom: 'extra', warm: !!x.warm, liveOnly: x.liveOnly, settleMs }, label: x.label, from, to, ready: typeof f.ready === 'function' ? () => !!flip.ready!() : undefined,
      apply: () => { const undo = flip.apply(); if (typeof undo !== 'function') throw new Error(`'${x.id}' gave no way back`); return undo; } };
  }
  /** a row made ready against this page's state: its flip and undo, or the reason it does not apply here */
  private arm(row: SweepRow): Armed | string {
    const S = this.settings, E = this.engine;
    if (row.set) {
      for (const k of Object.keys(row.set)) if (!(k in S)) return `this build has no setting '${k}'`;
      const other = !!row.or && Object.keys(row.set).every(k => same(S[k], row.set![k])), to = other ? row.or!.set : row.set, label = other ? row.or!.label : row.label, from: Record<string, unknown> = {};
      for (const k of Object.keys(to)) { if (!(k in S)) return `this build has no setting '${k}'`; from[k] = copy(S[k]); }
      for (const k of Object.keys(row.needs ?? {})) if (!same(S[k], row.needs![k])) return `only read with ${k} ${String(row.needs![k])}; here it is ${String(S[k])}`;
      if (Object.keys(to).every(k => same(S[k], to[k]))) return 'already so';
      if (row.liveOnly && !this.opts.live) return `live takes only (Shift+F8): ${row.liveOnly}`;
      return { row, label, from, to, apply: () => { for (const k of Object.keys(to)) S[k] = copy(to[k]); return () => { for (const k of Object.keys(from)) S[k] = copy(from[k]); }; } };
    }
    switch (row.custom) {
      case 'fog': {   // the PASS's switch (the frame the engine reads), never the game's: the game's own switch forgets what the squad has seen. Frozen only: a running game writes the frame back every step
        const fog = this.game.fogOfWar, F = E.fogFrame;
        if (this.opts.live) return 'frozen takes only';
        if (!fog?.on || !F?.on) return 'fog of war is off here';
        return { row, label: row.label, from: { fogOfWar: true }, to: { fogOfWar: false }, apply: () => { F.on = false; return () => { F.on = true; }; } };
      }
      case 'fogOld': {   // which of the fog pass's two programs draws (the renderer's own switch on the frame; the game never writes it). Read loosely: a build with one program has no such field
        const F = E.fogFrame as ({ on: boolean; count?: number; pass?: 'hint' | 'old' } | null | undefined);
        if (!F?.on || (F.count !== undefined && F.count <= 0)) return 'fog of war is off here';
        if (F.pass === undefined) return 'this build has one fog pass';
        if (F.pass !== 'hint') return 'the old fog pass is already on';
        const ran = () => (E as unknown as { passes?: { fogPass?: { ran?: string } | null } }).passes?.fogPass?.ran;   // (the program the last frame really ran: the other one draws while the one asked for compiles)
        return { row, label: row.label, from: { fogPass: 'hint' }, to: { fogPass: 'old' }, apply: () => { F.pass = 'old'; return () => { F.pass = 'hint'; }; }, ready: () => { const r = ran(); return r === undefined || r === 'old'; } };
      }
      case 'fogEdge': {   // the band, to nothing and back. The pass reads it off the frame, and a running game writes the frame from its own table (the fog's `knobs`) every step: so both are written and both put back — on a frozen take the frame's holds, on a live one the game's. Read loosely: a build from before the soft edge has neither number. (The game's table is a journaled one: a run tape taken across a live take carries the flips as its own rows)
        const fog = this.game.fogOfWar as unknown as { on?: boolean; knobs?: Record<string, unknown> } | null | undefined;
        const F = E.fogFrame as ({ on: boolean; count?: number; full?: boolean; sight?: boolean; edge?: number } | null | undefined), K = fog?.knobs;
        if (!fog?.on || !F?.on || (F.count !== undefined && F.count <= 0)) return 'fog of war is off here';
        if (!K || typeof K.edge !== 'number' || typeof F.edge !== 'number') return "this build's fog has no soft edge";
        if (F.full === false) return 'the soft edge is only read under the full fog picture, and that is off here (?fogfull=0)';
        if (F.sight === false) return "the fog's sight table is not written here (its program is still compiling, or a debug view is up): nothing reads the soft edge";
        if (!(K.edge > 0) || !(F.edge > 0)) return 'the fog already has its hard edge here (?fogedge=0)';
        return { row, label: row.label, from: { fogEdge: K.edge }, to: { fogEdge: 0 }, apply: () => { const was = { game: K.edge, frame: F.edge }; K.edge = 0; F.edge = 0; return () => { K.edge = was.game; F.edge = was.frame; }; } };
      }
      case 'smoke': {   // every live cloud out of the picture (and out of the shadow rays' way). Frozen only: with the world running a solver switched off would lose what is emitted meanwhile
        const P = this.smoke.params, n = this.smoke.stats.live, bricks = this.smoke.stats.pool;
        if (this.opts.live) return 'frozen takes only';
        if (!P.enabled || !n) return 'no dust or smoke is live here';
        return { row, label: `${row.label} (${bricks} bricks of it here)`, from: { smoke: n }, to: { smoke: 0 }, apply: () => { P.enabled = false; return () => { P.enabled = true; }; } };
      }
      case 'oneAir': case 'wispMotes': {   // the game's snow, written and put back by the page's hook for the row (ui/sweepSnow.ts)
        const hook = this[row.custom];
        if (!hook) return 'this page has no snow to flip';
        if (!this.opts.live) return `live takes only (Shift+F8): ${row.liveOnly}`;
        const f = hook(); if (typeof f === 'string') return f;
        return { row: f.settleMs ? { ...row, settleMs: f.settleMs } : row, label: row.label, from: f.from, to: f.to, apply: f.apply };
      }
      case 'irLight': case 'irLightOne': {   // the goggles' infrared lights out of the PICTURE (the upload's own cap: none, or the first alone — the game files the player's first) and back. The list the game reads stands, so a teammate's tube sees what it saw and a live take or a replay runs as it would have
        const L: typeof E.lights | undefined = E.lights, one = row.custom === 'irLightOne';   // (asked for: the sweep's own checks stand it on pages with no light set)
        if (!L || typeof L.irCap !== 'number') return "this build's goggles carry no infrared light";
        if (!L.tube) return 'the goggles are up here: no infrared light is in the picture';
        const n = L.irCount;   // (how many the last upload took)
        if (!n) return 'no infrared light is in the picture here (?noirlight, or the place is light enough for the goggles alone)';
        if (one && n < 2) return 'one infrared light burns here: the row before prices it';
        return { row, label: `${row.label} (${n} of them here)`, from: { irLights: n }, to: { irLights: one ? 1 : 0 }, apply: () => { const was = L.irCap; L.irCap = one ? 1 : 0; return () => { L.irCap = was; }; } };
      }
      case 'scaleDown': case 'scaleUp': case 'scaleStart': case 'scaleTop': {
        const cur = S.renderScale as number, top = this.quality['scaleTop']();   // (1.0 would drop sharp direct: the ladder's own top, shed or not)
        const start = Math.min(top, this.quality['maxScale'] as number);   // (where this preset's scale stood before the ladder climbed)
        const to = row.custom === 'scaleTop' ? top : row.custom === 'scaleStart' ? +start.toFixed(2) : +(cur + (row.custom === 'scaleUp' ? SCALE_STEP : -SCALE_STEP)).toFixed(2);
        if (Math.abs(to - cur) < 1e-3) return 'already so';
        if (to < SCALE_FLOOR - 1e-6 || to > top + 1e-6) return `render scale ${cur.toFixed(2)} has no step that way`;
        return { row, label: `${row.label} (×${cur.toFixed(2)} to ×${to.toFixed(2)})`, from: { renderScale: cur }, to: { renderScale: to }, apply: () => { S.renderScale = to; return () => { S.renderScale = cur; }; } };
      }
      case 'preset': {   // the next preset down as a whole (from Medium: High) — every row quality.apply writes, then all of it put back. Frozen only: a running game reads some of those rows (the debris cap) and writes others (the sky)
        if (this.opts.live) return 'frozen takes only';
        const cur = this.quality.current as QualityName; const to: QualityName | null = cur === 'high' || cur === 'ultra' ? 'medium' : cur === 'medium' ? 'high' : null;
        if (!to) return `no preset row from ${cur}`;
        const Q = this.quality, auto = Q.auto;
        return { row, label: `the whole ${to[0].toUpperCase()}${to.slice(1)} preset`, from: { preset: cur }, to: { preset: to }, apply: () => {
          const back = this.snapshot(), climbed = [...Q['climbed']], failed = new Map(Q['failed']), failCount = new Map(Q['failCount']), shed = Q.shed;   // apply() forgets the ladder's standing rungs; the settings they raised come back with the snapshot, so the ladder must know them again
          Q.auto = false; this.preset = to; this.own = true; try { Q.apply(to); } finally { this.own = false; }   // (auto off round the two applies: apply() must not file the flipped preset as this machine's pick)
          return () => { this.preset = cur; this.own = true; try { Q.apply(cur); } finally { this.own = false; } Q.auto = auto; Q.shed = shed; Q['climbed'] = climbed; for (const [k, v] of failed) Q['failed'].set(k, v); for (const [k, v] of failCount) Q['failCount'].set(k, v); back(); };
        } };
      }
    }
    return 'unknown row';
  }

  private showTag(text: string | null): void {
    if (typeof document === 'undefined') return;
    if (text === null) { this.tag?.remove(); this.tag = null; return; }
    if (this.opts.inside) return;
    if (!this.tag) { const t = document.createElement('div'); t.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:50;padding:4px 10px;font:12px ui-monospace,Menlo,monospace;color:#fff;background:rgba(160,30,30,.85);border-radius:3px;pointer-events:none'; document.body.appendChild(t); this.tag = t; }
    this.tag.textContent = text;
  }
}
