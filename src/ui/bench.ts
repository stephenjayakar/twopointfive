// THE BENCHMARK (title ▸ Extras ▸ Benchmark, or ?bench on the game's address): one press, hands off, and the machine it ran on has said what the game costs it —
// as a file for tuning the quality levels with, and as a text short enough to paste into a message from a machine nobody on the project can sit at.
// What a run does. It plays A SET OF SCENES (host/benchScenes.ts): real missions on their own floors, each taken by the hands-off player (host/handsoff.ts: the
// game's own keys and cursor, the game's own camera) on a seed that names the deal and the dice. A level is a page load, so a run is one page per scene: the page
// hands its lines to the next through the tab's own session store (the page's half: main.ts) and this module plays ONE page's part — a LEG (BenchLeg):
//   1. waits, the world held still, while auto quality finishes measuring the machine; on the FIRST page it then times that picture AS THE PAGE OPENED;
//   2. THE SCENE, live, auto quality doing what it does in play: frames a second over the whole of it. On every page but the last that is the page's part: its
//      line is handed on and the next scene's page loads;
//   3. on the LAST page, at the scene's heavy moment (rounds in the air, smoke up) the world is HELD STILL where it stands and that one picture is timed as it
//      stood, then under each preset of auto's ladder from the bottom up — stopping where one runs under eight frames a second, the ones above it would only be
//      slower — then, everything put back, with each heavy feature flipped alone: the F8 sweep's rows (ui/perfsweep.ts), one round;
//   4. the scene plays out, and the card comes up: the GPU by name, the browser, the screen, the BOOT's timings of the first page (the freeze at load a person
//      feels — ui/boot.ts), a line per window and the features that move the frame most. The last page's take downloads as the F9 recorder's json (the same
//      file tools/qa/perf-report.ts reads: its sweep events price every feature properly, and a 'bench' event carries everything on the card, every scene's line).
// NOTHING IS SENT ANYWHERE: the text sits in a box with a Copy button and the file lands in the browser's downloads. Esc stops a run and puts everything back.
// ?bench=N = N seconds measured a window instead of four. With no leg handed in (a page of its own, a check) a run is the one page's: steps 1 to 4 on whatever
// scene the page gives, or on its opening picture alone.
// Off the row and the address nothing here runs: tick() returns on its first line, and no setting is read or written.
import type { Engine } from '../engine';
import { AUTO_LADDER, type Quality, type QualityName } from './quality';
import type { PerfRecorder, PerfDump, PerfFrame } from './perfrec';
import { SWEEP_ROWS, type SweepOpts } from './perfsweep';
import type { BootSummary } from './boot';

export interface BenchOpts {
  /** per window: the start that is dropped, then the part that is measured (ms); a window also wants a few frames of each, and gives up waiting for them at capMs */
  settleMs: number; measureMs: number; settleFrames: number; measureFrames: number; capMs: number;
  /** how long auto quality may still be measuring the machine before the benchmark goes ahead anyway (ms), and the frames it lets pass first */
  waitMs: number; waitFrames: number;
  /** a preset whose frame took longer than this (ms, the median) is the last one tried */
  slowMs: number;
  /** a frame longer than this (ms) is the tab having been away, not the machine: the window starts over, at most `retries` times */
  awayMs: number; retries: number;
  /** THE SCENE, in ms of its own running (the time it is held still does not count): it is held once its heavy moment has stood heavyHoldMs, or at heavyCapMs if
   *  that moment never comes; and it is cut off at sceneCapMs */
  heavyHoldMs: number; heavyCapMs: number; sceneCapMs: number;
  /** the features are not flipped one by one on a machine whose held picture takes longer than this a frame (ms): the take would run for a quarter of an hour */
  sweepSlowMs: number;
  /** the sweep's own options, over the benchmark's (a dry run: `only` a few rows) */
  sweep?: Partial<SweepOpts>;
}
export const BENCH_DEFAULTS: BenchOpts = { settleMs: 2000, measureMs: 4000, settleFrames: 3, measureFrames: 5, capMs: 20000, waitMs: 45000, waitFrames: 30, slowMs: 125, awayMs: 3000, retries: 3, heavyHoldMs: 0, heavyCapMs: 300000, sceneCapMs: 600000, sweepSlowMs: 250 };
/** the frames a benchmark's take may hold: its six minutes at 240 a second (the F9 recorder's own ten minutes at 60 are full inside the sweep at 120) */
export const BENCH_FRAMES = 96000;

/** what the page can say of the machine without asking anybody for anything */
export interface BenchMachine {
  /** the WebGPU adapter's own line (vendor, architecture, description: Chrome leaves the last one empty) and whether it is the software fallback */
  webgpu: string; fallback?: boolean;
  /** WebGL's unmasked renderer string: the one place a browser names the chip ("ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, …)"). On a machine with two GPUs it
   *  is WebGL's pick, which need not be WebGPU's */
  webgl?: string;
  browser: string; os: string; userAgent: string;
  threads?: number; memoryGb?: number; screen?: [number, number]; view?: [number, number]; dpr: number; hz?: number; power?: string;
}
export interface BenchStep {
  /** 'opened' = as the page opened · 'scene:<id>' = that scene, live ('scene' in a run with no set) · 'held' = the last scene's heavy moment held still, as it stood · a preset's name (the same picture) */
  id: string; label: string;
  /** the quality it ran at, in the page's words ('auto (medium)', a preset's name), its render scale and the size drawn at */
  quality: string; scale: number; res: [number, number]; frames: number;
  /** frames a second over the window · a frame's time, ms: the median and the 95th percentile · the GPU's time for one (the passes' union; null = this browser gives no GPU timings) · the page's own work for one */
  fps: number; ms: number; p95: number; gpu: number | null; cpu: number;
  /** the heaviest GPU passes, ms each (their sum overstates the frame: the GPU runs passes side by side) */
  top?: [string, number][];
  /** not measured, and why */
  skipped?: string;
}
export interface BenchBoot { toCard: number; beforeScript: number; shaders: number; pipelines: [number, number, number]; longestTask: number; longestGap: number; firstFrameCpu: number; firstFrameGpu: number;
  /** the load's shader text in KB, as compiled and whole (gpu/wgslTrim.ts) · its slowest pipelines [label, ms] · ms the Game took to build — absent in a record from before they were kept */
  text?: [number, number]; slow?: [string, number][]; game?: number }
/** one heavy feature flipped alone on the held picture (a row of the F8 sweep): what the flip GIVES BACK a frame, ms — the GPU's time (null = no GPU timings) and the frame's.
 *  Negative = the flip costs. One round: a few tenths either way is noise (the take's own sweep events, read by tools/qa/perf-report.ts, say the same with the spread) */
export interface BenchFeature { id: string; label: string; gpu: number | null; ms: number }
/** a scene of the run: its word and name, the mission's address it was played on, how it ended in the scene's own words, and its page's boot */
export interface BenchSceneRun { id: string; name: string; query: string; end?: string; boot?: BenchBoot | null }
/** `set` + `scenes`: which scenes the run played (absent = a file from before the scenes were floors: the one 'scene' line is the office's day showcase, and its
 *  numbers are not read against a set's) */
export interface BenchResult { version: 1; at: string; commit?: string; query: string; set?: string; scenes?: BenchSceneRun[]; machine: BenchMachine; boot: BenchBoot | null; timers: boolean; steps: BenchStep[]; features?: BenchFeature[]; notes: string[] }
/** ONE PAGE'S PART of a run over a set of scenes: what the pages before it measured, and how this page hands on */
export interface BenchLeg {
  /** the set's name, this page's scene, its place in the set (0 = the first page), the most seconds it plays */
  set: string; scene: { id: string; name: string }; index: number; of: number; secs: number;
  /** what the pages before this one measured and said: their lines, their notes, their scenes, the first page's boot, the times the tab was away */
  steps: BenchStep[]; notes: string[]; scenes: BenchSceneRun[]; boot?: BenchBoot | null; away?: number;
  /** not the last page: this page's lines with the earlier ones — the page keeps them and loads the next scene (a throw: they could not be kept — the run ends here) */
  onward(next: Pick<BenchLeg, 'steps' | 'notes' | 'scenes' | 'boot' | 'away'>): void;
  /** the run is over on this page (done, or stopped): nothing is carried further */
  over(): void;
  /** the card was closed, or the run was stopped with nothing to put on one: the page goes back to where the run was started */
  closed?(): void;
}

const median = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length & 1 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (a: number[], p: number) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]; };
const r1 = (v: number) => +v.toFixed(1);
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);
const copy = <T>(v: T): T => (Array.isArray(v) ? [...v] : v) as T;
const PRESET_LABEL: Record<string, string> = { verylow: 'very low', low: 'low', medium: 'medium', high: 'high', ultra: 'ultra' };

/** one window's numbers off the frames the recorder kept for it */
export function benchStats(frames: PerfFrame[], top = 0): Pick<BenchStep, 'frames' | 'fps' | 'ms' | 'p95' | 'gpu' | 'cpu' | 'top'> {
  const dts = frames.map(f => f.dt).filter(d => d > 0), sum = dts.reduce((s, d) => s + d, 0);
  const unions = frames.map(f => f.gpuUnion).filter((u): u is number => typeof u === 'number' && u > 0);
  const out: Pick<BenchStep, 'frames' | 'fps' | 'ms' | 'p95' | 'gpu' | 'cpu' | 'top'> = { frames: frames.length, fps: sum > 0 ? r1(1000 * dts.length / sum) : 0, ms: r1(median(dts)), p95: r1(pct(dts, 0.95)),
    gpu: unions.length ? r1(median(unions)) : null, cpu: r1(median(frames.map(f => f.cpu.update + f.cpu.render + f.cpu.other))) };
  if (top > 0) {
    const by = new Map<string, number[]>(); for (const f of frames) for (const k of Object.keys(f.gpu)) { let l = by.get(k); if (!l) by.set(k, l = []); l.push(f.gpu[k]); }
    const rows = [...by].map(([k, l]) => [k, +median(l).toFixed(2)] as [string, number]).filter(r => r[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, top);
    if (rows.length) out.top = rows;
  }
  return out;
}

export function benchBoot(b: BootSummary | null | undefined): BenchBoot | null {
  if (!b || !b.marks) return null;
  const m = b.marks, s = b.spans ?? {}, n = (v: number | undefined) => typeof v === 'number' && isFinite(v) ? Math.round(v) : 0;
  return { toCard: n(m.interactive), beforeScript: n(s.beforeScript), shaders: n(s.pipelines), pipelines: [b.pipelines?.done ?? 0, b.pipelines?.total ?? 0, b.pipelines?.failed ?? 0],
    longestTask: n(b.maxLongTask), longestGap: n(b.maxRafGap), firstFrameCpu: n(s.firstFrameCpu), firstFrameGpu: n(s.firstFrameGpu),
    ...(b.shaderText ? { text: [n(b.shaderText.after / 1024), n(b.shaderText.before / 1024)] as [number, number] } : {}), ...(b.slowest?.length ? { slow: b.slowest.slice(0, 3).map(t => [t.label, n(t.ms)] as [string, number]) } : {}), game: n(s.gameCtor) };
}

/** THE TEXT a friend sends back: plain lines, no markup, under forty of them */
export function benchReport(r: BenchResult): string {
  const secs = (ms: number) => ms >= 950 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
  const L: string[] = [], M = r.machine, row = (k: string, v: string) => L.push(k.padEnd(10) + v);
  L.push(`twopointsix benchmark · ${r.at.slice(0, 16).replace('T', ' ')} UTC${r.commit ? ` · build ${r.commit.slice(0, 8)}` : ''}${r.set ? ` · scenes ${r.set}` : ''}`);
  row('address', r.query || '(no flags)');
  row('GPU', `${M.webgl || M.webgpu}${M.fallback ? ' · SOFTWARE RENDERING (no GPU in use)' : ''}`);
  if (M.webgl) row('', `WebGPU says: ${M.webgpu}`);
  row('browser', [M.browser, M.os].filter(Boolean).join(' · ') || M.userAgent);
  { const bits: string[] = [];
    if (M.threads) bits.push(`${M.threads} threads`);
    if (M.memoryGb) bits.push(`${M.memoryGb >= 8 ? 'at least ' : ''}${M.memoryGb} GB`);
    if (M.screen) bits.push(`screen ${M.screen[0]}×${M.screen[1]} ×${+M.dpr.toFixed(2)}`);
    if (M.view) bits.push(`window ${M.view[0]}×${M.view[1]}`);
    if (M.hz) bits.push(`${Math.round(M.hz)} Hz`);
    if (M.power) bits.push(M.power);
    if (bits.length) row('machine', bits.join(' · ')); }
  if (r.boot) { const b = r.boot;
    row('load', `${secs(b.toCard)} to the start card · shaders ${secs(b.shaders)} (${b.pipelines[0]} of ${b.pipelines[1]}${b.pipelines[2] ? `, ${b.pipelines[2]} FAILED` : ''}) · longest freeze ${secs(Math.max(b.longestTask, b.longestGap))} · first frame ${secs(b.firstFrameCpu + b.firstFrameGpu)}`);
    // what the shader seconds are made of, for a machine nobody here can sit at: the text handed to the compiler, the pipelines that came back last, the Game's own build
    if (b.text || b.slow) row('', [b.text ? `shader text ${(b.text[0] / 1024).toFixed(1)} MB${b.text[1] > b.text[0] ? ` (${(b.text[1] / 1024).toFixed(1)} whole)` : ''}` : '', b.slow?.length ? `last ready: ${b.slow.map(([l, ms]) => `${l} ${secs(ms)}`).join(', ')}` : '', b.game ? `game built in ${secs(b.game)}` : ''].filter(Boolean).join(' · '));
    // every scene is a load of the page: the first compiles cold, the later ones show what the browser kept
    { const later = (r.scenes ?? []).filter(s => s.boot); if (later.length > 1) row('loads', later.map(s => `${s.id} ${secs(s.boot!.toCard)} (shaders ${secs(s.boot!.shaders)})`).join(' · ')); } }
  L.push('');
  const cols = (a: string, q: string, b: string, c: string, d: string, e: string, f: string) => `${a.padEnd(22)}${q.padEnd(22)}${b.padEnd(11)}${c.padStart(5)}  ${d.padEnd(18)}${e.padEnd(8)}${f}`.trimEnd();
  L.push(cols('', 'quality', 'drawn at', 'fps', 'frame ms (95 %)', 'GPU ms', 'page ms'));
  for (const s of r.steps) {
    if (s.skipped) { L.push(`${s.label.padEnd(22)}not run: ${s.skipped}`); continue; }
    L.push(cols(s.label, `${s.quality} ×${s.scale.toFixed(2)}`, `${s.res[0]}×${s.res[1]}`, s.fps.toFixed(s.fps < 20 ? 1 : 0), `${s.ms.toFixed(1)} (${s.p95.toFixed(1)})`, s.gpu === null ? 'n/a' : s.gpu.toFixed(1), s.cpu.toFixed(1)));
  }
  { const ends = (r.scenes ?? []).filter(s => s.end).map(s => `${s.id} ${s.end}`); if (ends.length) { L.push(''); row('floors', ends.join(' · ')); } }   // (how each fight went: two machines' numbers are of the same fight only where these agree)
  const top = r.steps.find(s => s.id === 'held' && s.top?.length)?.top ?? r.steps.find(s => s.top?.length)?.top;
  if (top) L.push('', `heaviest GPU passes, ms: ${top.map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' · ')}`);
  if (r.features?.length) {   // the ten that move the frame most, either way (the file has them all)
    const val = (f: BenchFeature) => f.gpu ?? f.ms, rows = [...r.features].sort((a, b) => Math.abs(val(b)) - Math.abs(val(a))).slice(0, 10);
    L.push('', `one feature changed at a time, ${r.timers ? 'GPU' : 'frame'} ms given back (one pass: a few tenths is noise):`);
    for (const f of rows) L.push(`${val(f).toFixed(1).padStart(6)}  ${f.label}`);
  }
  for (const n of r.notes) L.push(n);
  return L.join('\n');
}

/** the machine, as far as a page may know it. The first return is what is known at once; `more` fills the same object in a moment later (the browser's own name for
 *  the system and whether the machine is on its battery: both are asked of the browser, neither shows a prompt) */
export function machineFacts(webgpu: string, fallback: boolean | undefined, hz: number): { now: BenchMachine; more: Promise<void> } {
  const nav = (typeof navigator !== 'undefined' ? navigator : {}) as Navigator & { deviceMemory?: number; userAgentData?: { brands?: { brand: string; version: string }[]; platform?: string; getHighEntropyValues?: (h: string[]) => Promise<Record<string, unknown>> }; getBattery?: () => Promise<{ charging: boolean; level: number }> };
  const ua = nav.userAgent ?? '';
  const m: BenchMachine = { webgpu: webgpu || 'unknown', browser: '', os: '', userAgent: ua, dpr: (typeof window !== 'undefined' && window.devicePixelRatio) || 1 };
  if (fallback) m.fallback = true;
  if (hz > 0) m.hz = hz;
  if (nav.hardwareConcurrency) m.threads = nav.hardwareConcurrency;
  if (nav.deviceMemory) m.memoryGb = nav.deviceMemory;
  if (typeof screen !== 'undefined') m.screen = [screen.width, screen.height];
  if (typeof window !== 'undefined') m.view = [window.innerWidth, window.innerHeight];
  { const v = /(Edg|OPR|Firefox)\/([\d.]+)/.exec(ua) ?? /(Chrome)\/([\d.]+)/.exec(ua) ?? /Version\/([\d.]+).*(Safari)/.exec(ua);
    if (v) m.browser = v[2] === 'Safari' ? `Safari ${v[1]}` : `${v[1] === 'Edg' ? 'Edge' : v[1] === 'OPR' ? 'Opera' : v[1]} ${v[2].split('.')[0]}`;
    m.os = /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : ''; }
  if (typeof document !== 'undefined') try {   // the chip by name: a throwaway WebGL context, let go at once
    const gl = document.createElement('canvas').getContext('webgl') as WebGLRenderingContext | null;
    if (gl) { const ext = gl.getExtension('WEBGL_debug_renderer_info'); const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '').trim(); if (name) m.webgl = name.slice(0, 160); gl.getExtension('WEBGL_lose_context')?.loseContext(); }
  } catch { /* no WebGL here: the WebGPU line stands alone */ }
  const more = (async () => {
    try { const d = nav.userAgentData;
      if (d) { const h = await d.getHighEntropyValues?.(['platformVersion', 'architecture', 'fullVersionList']) ?? {};
        const brands = ((h.fullVersionList as { brand: string; version: string }[] | undefined) ?? d.brands ?? []).filter(b => !/not.?a.?brand/i.test(b.brand));
        const b = brands.find(x => !/chromium/i.test(x.brand)) ?? brands[0]; if (b) m.browser = `${b.brand.replace(/^Google /, '')} ${b.version.split('.')[0]}`;
        const os = [d.platform, h.platformVersion, h.architecture].filter(x => typeof x === 'string' && x).join(' '); if (os) m.os = os; } } catch { /* the user agent's own words stand */ }
    try { const b = await nav.getBattery?.(); if (b) m.power = b.charging ? 'plugged in' : `on battery (${Math.round(b.level * 100)} %)`; } catch { /* */ }
  })();
  return { now: m, more };
}

/** the page's half: the veil over the game while it runs, and the card with the text at the end. A page without a document (a headless check) passes none */
export interface BenchView { progress(text: string | null): void; show(report: string, close: () => void, saved?: boolean): void }
/** keep: a screen of the page's own is up over its card and holds it inert itself (the card is not handed back from here then) */
export function benchView(keep?: () => boolean): BenchView | null {
  if (typeof document === 'undefined') return null;
  let veil: HTMLElement | null = null, card: HTMLElement | null = null;
  // the page's own card under the veil and under the report takes no key and no focus meanwhile (its buttons are a Tab away otherwise, and the title takes the
  // focus back a tick after it opens); put back as it stood
  let under: { el: HTMLElement; was: boolean } | null = null;
  const hold = (on: boolean) => {
    if (on) { if (!under) { const el = document.getElementById('menu'); if (el) { under = { el, was: el.hasAttribute('inert') }; el.setAttribute('inert', ''); } } }
    else if (under) { if (!under.was && !keep?.()) under.el.removeAttribute('inert'); under = null; }
  };
  const FONT = 'ui-monospace,Menlo,Consolas,monospace';
  const button = (label: string, on: () => void) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = `font:13px ${FONT};padding:8px 16px;color:#e8ece6;background:#2a302c;border:1px solid #5a655c;border-radius:3px;cursor:pointer`; b.addEventListener('click', on); return b; };
  return {
    progress(text) {
      if (text === null) { veil?.remove(); veil = null; if (!card) hold(false); return; }
      hold(true);
      if (!veil) { veil = document.createElement('div'); veil.id = 'bench-veil'; veil.style.cssText = `position:fixed;inset:0;z-index:60;display:flex;align-items:flex-end;justify-content:center;padding-bottom:3vh;font:12px ${FONT};color:#e8ece6;text-shadow:0 1px 3px #000,0 0 8px #000`; document.body.appendChild(veil); }
      veil.textContent = text;
    },
    show(report, close, saved = true) {
      card?.remove(); hold(true);
      const c = card = document.createElement('div'); c.id = 'bench-card'; c.style.cssText = `position:fixed;inset:0;z-index:61;display:flex;align-items:center;justify-content:center;background:rgba(8,10,9,.82);font:13px ${FONT};color:#e8ece6`;
      const box = document.createElement('div'); box.style.cssText = 'display:flex;flex-direction:column;gap:12px;width:min(980px,94vw)';
      const ta = document.createElement('textarea'); ta.id = 'bench-report'; ta.readOnly = true; ta.value = report; ta.spellcheck = false; ta.wrap = 'off';
      ta.style.cssText = `width:100%;height:min(${report.split('\n').length * 18 + 30}px,70vh);box-sizing:border-box;resize:none;padding:12px 14px;font:12px/18px ${FONT};color:#e8ece6;background:#141816;border:1px solid #5a655c;border-radius:3px;white-space:pre;overflow:auto`;
      const said = document.createElement('span'); said.style.cssText = 'align-self:center;opacity:.75'; said.textContent = saved ? 'Nothing was sent. The full recording is in your downloads.' : 'Nothing was sent.';
      const copyB = button('Copy', () => {
        const done = (ok: boolean) => { copyB.textContent = ok ? 'Copied' : 'Select the text and copy it'; };
        ta.focus(); ta.select();
        const old = () => { try { done(document.execCommand('copy')); } catch { done(false); } };
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(report).then(() => done(true), old); else old();
      });
      const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap';
      row.append(copyB, button('Close', () => { c.remove(); if (card === c) { card = null; if (!veil) hold(false); } close(); }), said);
      box.append(ta, row); c.append(box); document.body.appendChild(c); ta.focus(); ta.select();
      setTimeout(() => { if (card === c && !c.contains(document.activeElement)) { ta.focus(); ta.select(); } }, 80);   // (a card that opened under it this frame may ask for the focus a tick later)
    },
  };
}


/** the scene this page plays (the page's: its mission taken by the hands-off player) */
export interface BenchScene {
  /** start it: null = it runs, else why not */
  start(): string | null;
  active(): boolean; stop(): void;
  /** its heavy moment is on the screen right now (rounds in the air, smoke up) */
  heavy(): boolean;
  /** how it ended, in a few words (asked once it is over) */
  said?(): string;
}
/** the F8 sweep, as the benchmark drives it (the page's PerfSweep) */
export interface BenchSweep { start(o: Partial<SweepOpts>): string; active(): boolean; flipped(): string; progress(): string; stop(why: string): void;
  /** the segment under way is past its own settle (a slow row's is seconds). A sweep that cannot say: the first two fifths of each segment are left out */
  settled?(): boolean }
export interface BenchDeps {
  /** the boot's timeline (ui/boot.ts summary), where the page has one */
  boot?: () => BootSummary | null;
  /** the machine (machineFacts): asked once, when a run starts */
  machine?: () => { now: BenchMachine; more: Promise<void> };
  view?: BenchView | null;
  /** a reason the benchmark cannot run right now, or null */
  blocked?: () => string | null;
  /** a screen of the page's own came up over the picture being timed (the title's windows only): the run stops, with why */
  covered?: () => string | null;
  /** the display's rate as the page has measured it by now, Hz (0 = not yet): asked again at the end, a run started with the page knows none at its start */
  hz?: () => number;
  /** the tab was hidden since this was last asked (the page's visibilitychange). A page that cannot say goes by the frame's gap alone (opts.awayMs) */
  away?: () => boolean;
  /** the smoke row a preset writes (quality.apply: smoke.params.rbIters), put back with the rest */
  smoke?: { params: { rbIters: number } };
  scene?: BenchScene | null; sweep?: BenchSweep | null;
}

type State = 'idle' | 'waiting' | 'opened' | 'scene' | 'held' | 'sweep' | 'tail';
interface Phase { id: string; preset: QualityName | null }
interface Win { id: string; gpu: number | null; ms: number }

export class Bench {
  state: State = 'idle';
  /** the last run: its numbers, its text, how it ended ('done' | 'stopped: why') and the recording behind it */
  result: BenchResult | null = null; report = ''; last = ''; dump: PerfDump | null = null;
  /** the sweep running right now is this run's own (the page's sweep refuses a second one while a benchmark runs: this is how it knows its caller) */
  sweeping = false;
  /** every state the last run went through, in order (the checks read it: a poll can miss a short one) */
  acts: State[] = [];
  private opts: BenchOpts = BENCH_DEFAULTS;
  private plan: Phase[] = []; private at = -1; private steps: BenchStep[] = []; private notes: string[] = []; private features: BenchFeature[] | null = null;
  private t0 = 0; private frames = 0; private segT0 = 0; private segFrames = 0; private measuring = false; private from = 0; private measT0 = 0; private retries = 0; private away = 0;
  private sceneMs = 0; private sceneFrom: [number, number][] = []; private heavyAt = -1; private skip = new Set<number>(); private query = '';
  /** this page's part of a run over a set (null: the run is this page's alone) · the scene was played · where its line goes among the steps */
  private leg: BenchLeg | null = null; private played = false; private sceneAt = 0; private scenes: BenchSceneRun[] = []; private boot0: BenchBoot | null | undefined;
  private wins: Win[] = []; private winId = ''; private winFrom = 0; private winFirst = -1; private wasSettled = false;
  private machine: BenchMachine | null = null; private back: (() => void) | null = null; private setPreset: ((p: QualityName) => void) | null = null;
  private keys: ((e: KeyboardEvent) => void) | null = null;
  /** the card of a run over pages is up */
  private carded = false;
  constructor(private engine: Engine, private quality: Quality, private rec: PerfRecorder, private deps: BenchDeps = {}) {}

  get active(): boolean { return this.state !== 'idle'; }
  /** the world holds still (host/loop.ts frozen) for all of a run but the scene itself: the wait and the first window on the level's opening picture — the same
   *  picture on every machine — and the presets and the features on the scene's heavy moment */
  get freezing(): boolean { return this.carded || (this.active && this.state !== 'scene' && this.state !== 'tail'); }
  /** a window is being timed on a picture held still: nothing of the page's quality model runs under it (main.ts: no sample() while the world is held, and the boot's
   *  calibration, where the wait gave up on it, picks nothing in the middle of a window; it goes on in the scene) */
  get timing(): boolean { return this.state === 'opened' || this.state === 'held' || this.state === 'sweep'; }
  get progress(): string { return this.active ? this.state : this.last; }

  start(o: Partial<BenchOpts> = {}, leg: BenchLeg | null = null): string {
    if (this.active) return 'already running';
    const no = this.rec.recording ? 'a recording is running' : this.deps.blocked?.() ?? null; if (no) return `not now: ${no}`;
    this.opts = { ...BENCH_DEFAULTS, ...o };
    this.leg = leg; this.played = false; this.sceneAt = 0; this.scenes = leg ? [...leg.scenes] : []; this.boot0 = leg && leg.index > 0 ? leg.boot : undefined;
    this.acts = []; this.go('waiting'); this.last = ''; this.result = null; this.report = ''; this.dump = null; this.steps = leg ? [...leg.steps] : []; this.notes = leg ? [...leg.notes] : []; this.features = null; this.away = leg?.away ?? 0;
    this.sceneFrom = []; this.heavyAt = -1; this.skip.clear(); this.wins = []; this.query = typeof location !== 'undefined' ? location.search : ''; this.winId = ''; this.sweeping = false;
    this.t0 = performance.now(); this.frames = 0;
    try { const f = this.deps.machine?.(); this.machine = f?.now ?? null; void f?.more.catch(() => {}); } catch { this.machine = null; }
    this.grabKeys(true); this.say(0);
    return 'waiting for the page to settle';
  }
  private go(s: State): void { this.state = s; this.acts.push(s); }
  stop(why = 'stopped'): void { if (this.active) this.finish(why, false); }

  /** once per presented frame, after the recorder's frame(), with the frame's wall time (s): a return on its first line while no benchmark runs */
  tick(rawDt: number): void {
    if (this.state === 'idle') return;
    const now = performance.now(), o = this.opts;
    const away = this.deps.away ? this.deps.away() : rawDt * 1000 > o.awayMs;   // (the tab was away since the last frame: that frame says nothing of the machine)
    if (this.state === 'waiting') {
      if (away) { this.t0 = now; this.frames = 0; return; }   // (opened in a tab nobody was looking at: the wait starts when it is looked at)
      { const c = this.deps.covered?.() ?? null; if (c) { this.finish(c, false); return; } }
      this.frames++;
      const waited = now - this.t0;
      if (this.frames < o.waitFrames || (this.quality.calibrating && waited < o.waitMs)) return;
      if (this.quality.calibrating) this.notes.push(`auto quality was still measuring after ${Math.round(waited / 1000)} s: "as it opened" is its starting point, not its pick`);
      this.rec.start('benchmark (ui/bench.ts): the opening picture held still, the scene live, its heavy moment held still under each preset and each sweep row; the bench event at the end carries the report', BENCH_FRAMES);
      if (this.leg && this.leg.index > 0) { this.scene(); return; }   // (a later page of a set: its opening picture is not a line of the run)
      this.go('opened'); this.plan = [{ id: 'opened', preset: null }]; this.at = -1; this.next(); return;
    }
    if (!this.rec.recording) { this.finish('the recorder stopped', false); return; }
    if (away) this.away++;
    const full = this.rec.framesLeft < 60;   // (the recorder stops itself when its ring is full, and its file would go out without the report: end first)
    switch (this.state) {
      case 'opened': case 'held': { const c = this.state === 'opened' ? this.deps.covered?.() ?? null : null;
        if (full || c) this.finish(c ?? 'the recording was full', false); else this.windowTick(away, now); return; }
      case 'scene': case 'tail': {
        const S = this.deps.scene!, room = this.rec.framesLeft > 600;
        if (away) this.skip.add(this.rec.frameCount - 1); else this.sceneMs += rawDt * 1000;
        const t = this.sceneMs;
        if (!S.active()) { this.sceneEnd(); if (this.state !== 'scene') this.finish('done', true); else if (!this.handOn()) this.hold(); return; }   // (the last page's scene ended before its heavy moment came: the picture it left is the one held)
        if (!room || t >= o.sceneCapMs) { this.notes.push(room ? 'the scene was cut off: it ran past its time' : 'the scene was cut off: the recording was full'); this.sceneEnd(); try { S.stop(); } catch { /* */ } if (this.state === 'scene' && this.handOn()) return; if (this.state === 'scene' && room) this.hold(); else this.finish('done', true); return; }
        if (this.state === 'scene' && this.lastLeg) {
          if (this.heavyAt < 0 && S.heavy()) this.heavyAt = t;
          const late = this.heavyAt < 0 && t >= o.heavyCapMs; if (late) this.notes.push(`the scene's heavy moment had not come ${Math.round(t / 1000)} s in: the picture held is the one it showed then`);
          if (late || (this.heavyAt >= 0 && t - this.heavyAt >= o.heavyHoldMs)) { this.sceneEnd(); this.hold(); return; }
        }
        this.say(this.state === 'tail' ? 0.92 : this.lastLeg ? 0.08 + 0.3 * Math.min(1, t / o.heavyCapMs) : 0.05 + 0.9 * Math.min(1, t / (1000 * (this.leg?.secs ?? 240))));
        return;
      }
      case 'sweep': {
        const W = this.deps.sweep!, id = W.active() ? W.flipped() : '';
        if (this.wasSettled && this.winFirst < 0) this.winFirst = this.rec.frameCount - 1;   // (the frame just recorded was drawn under what stood at the last tick)
        if (id !== this.winId) { this.winClose(); this.winId = id; this.winFrom = this.rec.frameCount; }
        this.wasSettled = W.active() && !!W.settled?.();
        if (!W.active()) { this.sweeping = false; this.featuresOf(); this.resume(); return; }
        if (full) { this.finish('the recording was full', false); return; }
        { const m = /^(\d+)\/(\d+)$/.exec(W.progress()); this.say(0.6 + 0.3 * (m ? +m[1] / Math.max(1, +m[2]) : 0)); }
        return;
      }
    }
  }

  private get settings(): Record<string, unknown> { return this.engine.settings as unknown as Record<string, unknown>; }
  /** the last page of a set, or a run that is one page's */
  private get lastLeg(): boolean { return !this.leg || this.leg.index >= this.leg.of - 1; }
  private say(frac: number): void { const L = this.leg; this.deps.view?.progress(`Benchmark ${Math.round(100 * (L ? (L.index + frac) / L.of : frac))} % · Esc stops`); }
  private labelOf(ph: Phase): string { return ph.preset ? PRESET_LABEL[ph.preset] ?? ph.preset : ph.id === 'opened' ? 'as it opened' : this.played ? 'the scene held still' : 'held still'; }

  // ---- a timed window on a picture held still (the opening picture; the scene's heavy moment as it stood and under each preset)
  private next(): void {
    this.at++;
    const ph = this.plan[this.at];
    if (!ph) { if (this.state === 'opened') this.scene(); else this.sweep(); return; }
    if (ph.preset) try { this.setPreset?.(ph.preset); } catch (e) { this.finish(`a preset failed (${ph.preset}: ${String(e).slice(0, 80)})`, false); return; }
    this.segT0 = performance.now(); this.segFrames = 0; this.measuring = false; this.retries = 0;
    this.say(this.state === 'opened' ? 0.02 : 0.4 + 0.2 * this.at / this.plan.length);
  }
  private windowTick(away: boolean, now: number): void {
    const o = this.opts;
    if (away && this.retries < o.retries) { this.retries++; this.segT0 = now; this.segFrames = 0; this.measuring = false; return; }   // (the tab was away: this window's frames say nothing of the machine)
    this.segFrames++;
    const t = now - this.segT0;
    if (!this.measuring) { if ((t >= o.settleMs && this.segFrames >= o.settleFrames) || t >= o.capMs) { this.measuring = true; this.from = this.rec.frameCount; this.measT0 = now; } return; }
    const n = this.rec.frameCount - this.from, mt = now - this.measT0;
    if (!((mt >= o.measureMs && n >= o.measureFrames) || (mt >= o.capMs && n >= 1))) return;
    const ph = this.plan[this.at];
    const fr = this.framesOf(this.from, this.rec.frameCount), l = fr[fr.length - 1];   // (what it was drawn at: the window's own last frame's word)
    const step: BenchStep = { id: ph.id, label: this.labelOf(ph), quality: ph.preset ?? this.quality.label, scale: +l.eff.toFixed(2), res: l.res, ...benchStats(fr, ph.preset ? 0 : 5) };
    this.steps.push(step);
    if (ph.preset && step.ms > o.slowMs) {   // the presets above this one would only be slower
      for (const rest of this.plan.slice(this.at + 1)) this.steps.push({ id: rest.id, label: this.labelOf(rest), quality: rest.id, scale: 0, res: [0, 0], frames: 0, fps: 0, ms: 0, p95: 0, gpu: null, cpu: 0, skipped: `${step.label} ran at ${step.fps.toFixed(1)} fps` });
      this.at = this.plan.length - 1;
    }
    this.next();
  }
  private framesOf(a: number, b: number): PerfFrame[] { const fr: PerfFrame[] = []; for (let f = a; f < b; f++) fr.push(this.rec.frameAt(f)); return fr; }

  // ---- the scene, live
  private scene(): void {
    const S = this.deps.scene ?? null, L = this.leg; let why: string | null = 'this page has no scene to play';
    if (S) try { why = S.start(); if (!why && !S.active()) why = 'the scene did not start'; } catch (e) { why = String(e).slice(0, 80); }
    this.sceneAt = this.steps.length;
    if (L) this.scenes.push({ id: L.scene.id, name: L.scene.name, query: this.query, boot: benchBoot(this.deps.boot?.() ?? null) });
    if (why) { this.notes.push(L ? `${L.scene.name} was not played (${why})` : `no scene was played (${why}): the opening picture stands in for it`); if (!this.handOn()) this.hold(); return; }
    this.go('scene'); this.played = true; this.sceneMs = 0; this.heavyAt = -1; this.sceneFrom.push([this.rec.frameCount, -1]);
  }
  /** the scene's line, off the frames of its live stretches, put where it was played among the steps (what it was drawn at is its own last frame's word: auto
   *  quality runs under it); and how it ended, on its row of the run's scenes */
  private sceneLine(L: BenchLeg | null = this.leg): void {
    const fr: PerfFrame[] = []; for (const [a, b] of this.sceneFrom) for (let f = a; f < b; f++) if (!this.skip.has(f)) fr.push(this.rec.frameAt(f));
    this.sceneFrom = []; this.skip.clear();
    if (L && this.played) { const row = this.scenes[this.scenes.length - 1]; let said = ''; try { said = this.deps.scene?.said?.() ?? ''; } catch { /* */ } if (row && said) row.end = said; }
    if (!fr.length) return;
    const l = fr[fr.length - 1], name = L?.scene.name ?? 'the scene';
    this.steps.splice(Math.min(this.sceneAt, this.steps.length), 0, { id: L ? `scene:${L.scene.id}` : 'scene', label: L ? name : 'the scene, live', quality: l.preset, scale: +l.eff.toFixed(2), res: l.res, ...benchStats(fr) });
    if (fr[0].preset !== l.preset) this.notes.push(`auto quality moved during ${name}: ${fr[0].preset} at its start, ${l.preset} at its end`);
  }
  /** not the last page of a set: this page's lines go on to the next scene's page (true: handed on — the veil stays up over the load) */
  private handOn(): boolean {
    const L = this.leg; if (!L || this.lastLeg) return false;
    this.sceneEnd(); this.sceneLine();
    this.go('idle'); this.last = 'next scene'; this.grabKeys(false);
    if (this.rec.recording) this.rec.stop(false);
    this.leg = null;
    try { L.onward({ steps: this.steps, notes: this.notes, scenes: this.scenes, boot: this.boot0 !== undefined ? this.boot0 : benchBoot(this.deps.boot?.() ?? null), away: this.away }); } catch (e) { this.deps.view?.progress(null); console.error(e); try { L.closed?.(); } catch { /* */ } }   // (the lines could not be carried: the veil comes down and the page goes back to where the run was started)
    return true;
  }
  /** the live stretch that just ended (the scene is played in two: up to its heavy moment, and from there to its end) */
  private sceneEnd(): void { const l = this.sceneFrom[this.sceneFrom.length - 1]; if (l && l[1] < 0) l[1] = this.rec.frameCount; }
  private resume(): void {
    const S = this.deps.scene;
    if (S?.active() && this.sceneFrom.length) { this.go('tail'); this.sceneFrom.push([this.rec.frameCount, -1]); return; }
    this.finish('done', true);
  }

  // ---- its heavy moment held still: as it stood, each preset, then each feature
  private hold(): void {
    const Q = this.quality, S = this.settings, P = this.deps.smoke?.params, rb = P?.rbIters;
    const cur = Q.current as QualityName, auto = Q.auto, shed = Q.shed, QQ = Q as unknown as { climbed?: unknown[]; failed?: Map<string, number>; failCount?: Map<string, number> };
    const snap: Record<string, unknown> = {}; for (const k of Object.keys(S)) { const v = S[k]; if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string' || Array.isArray(v)) snap[k] = copy(v); }
    const climbed = QQ.climbed ? [...QQ.climbed] : null, failed = QQ.failed ? new Map(QQ.failed) : null, failCount = QQ.failCount ? new Map(QQ.failCount) : null;
    let changed = false;
    // every row a preset writes, the ladder's own standing rungs and the page's quality mode, exactly as they stood (apply() forgets the rungs; auto is off round every
    // apply here, so no preset of the benchmark's is filed as this machine's pick)
    this.back = () => {
      if (changed) { Q.auto = false; Q.apply(cur); }
      Q.auto = auto; Q.shed = shed;   // (… and a shed standing: apply() with auto off ends it, and the settings put back below have sharp direct off)
      if (climbed) QQ.climbed = climbed; if (failed && QQ.failed) for (const [k, v] of failed) QQ.failed.set(k, v); if (failCount && QQ.failCount) for (const [k, v] of failCount) QQ.failCount.set(k, v);
      for (const k of Object.keys(snap)) if (!same(S[k], snap[k])) S[k] = copy(snap[k]);
      if (P && rb !== undefined) P.rbIters = rb;
    };
    this.setPreset = (p: QualityName) => { changed = true; Q.auto = false; Q.apply(p); };
    this.go('held'); this.plan = [{ id: 'held', preset: null }, ...AUTO_LADDER.map(p => ({ id: p as string, preset: p }))]; this.at = -1; this.next();
  }
  private putBack(): void { try { this.back?.(); } catch { /* */ } this.back = null; this.setPreset = null; }
  private sweep(): void {
    this.putBack();
    const W = this.deps.sweep ?? null, held = this.steps.find(s => s.id === 'held');
    if (!W) { this.resume(); return; }
    if (held && held.ms > this.opts.sweepSlowMs) { this.notes.push(`the features were not timed one by one: the held picture ran at ${held.fps.toFixed(1)} fps`); this.resume(); return; }
    this.sweeping = true; let said = '';
    try { said = W.start({ rounds: 1, settleFrames: 4, measureFrames: 8, ...this.opts.sweep, inside: true }); } catch (e) { said = `not now: ${String(e).slice(0, 80)}`; }
    if (!W.active()) { this.sweeping = false; this.notes.push(`the features were not timed one by one (${said})`); this.resume(); return; }
    this.go('sweep'); this.wins = []; this.winId = ''; this.winFrom = this.rec.frameCount; this.winFirst = -1; this.wasSettled = false;
  }
  /** a sweep segment that just ended: its frames' medians from where the sweep called it settled (histories, GPU readbacks a few frames late, a slow row's
   *  seconds), or with the first two fifths left out where the sweep cannot say */
  private winClose(): void {
    const first = this.winFirst; this.winFirst = -1; this.wasSettled = false;
    if (!this.winId) return;
    const all = this.framesOf(this.winFrom, this.rec.frameCount), fr = this.deps.sweep?.settled ? (first >= 0 ? this.framesOf(first, this.rec.frameCount) : []) : all.slice(Math.floor(all.length * 0.4));
    if (fr.length) { const s = benchStats(fr); this.wins.push({ id: this.winId, gpu: s.gpu, ms: s.ms }); }
  }
  /** each flipped segment against the two baselines beside it */
  private featuresOf(): void {
    const W = this.wins, out: BenchFeature[] = [];
    for (let i = 0; i < W.length; i++) {
      const w = W[i]; if (w.id === 'base') continue;
      const near = [W[i - 1], W[i + 1]].filter(b => b && b.id === 'base'); if (!near.length) continue;
      const mean = (f: (b: Win) => number | null) => { const v = near.map(f).filter((x): x is number => x !== null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
      const bg = mean(b => b.gpu), bm = mean(b => b.ms)!;
      out.push({ id: w.id, label: SWEEP_ROWS.find(r => r.id === w.id)?.label ?? w.id, gpu: bg !== null && w.gpu !== null ? +(bg - w.gpu).toFixed(2) : null, ms: +(bm - w.ms).toFixed(2) });
    }
    if (out.length) this.features = out;
  }

  private finish(why: string, done: boolean): void {
    const timed = this.state !== 'waiting', L = this.leg; this.leg = null;
    if (this.sweeping) { this.sweeping = false; this.winId = ''; this.featuresOf();   // (cut off inside its sweep: the rows it got through are still priced, the one under way is not)
      try { this.deps.sweep?.stop('the benchmark stopped'); } catch { /* */ } }
    this.putBack();
    this.sceneEnd(); if (!done) try { if (this.deps.scene?.active()) this.deps.scene.stop(); } catch { /* */ }
    this.go('idle'); this.last = done ? 'done' : `stopped: ${why}`; this.grabKeys(false);
    const view = this.deps.view ?? null; view?.progress(null);
    try { L?.over(); } catch { /* */ }
    const back = () => { this.carded = false; try { L?.closed?.(); } catch { /* */ } };   // (a run over pages was on a scene's address: with no card to close, the page goes back by itself to where the run was started)
    if (!timed && !this.steps.length) { back(); return; }   // (stopped before anything was timed: nothing to show)
    this.sceneLine(L);
    if (!this.steps.length || !timed) { if (this.rec.recording) this.rec.stop(false); if (!this.steps.length) { back(); return; } }   // (stopped inside the first window: no number to show, and no file worth keeping)
    if (this.away) this.notes.push(`the tab was away ${this.away} time${this.away > 1 ? 's' : ''} during the run: a window it hit was started over, a feature timed across it may be off`);
    { const hz = this.deps.hz?.() ?? 0; if (this.machine && hz > 0) this.machine.hz = hz; }
    if (!done) this.notes.push(`stopped early (${why})`);
    const timers = !!this.engine.timer?.enabled;
    if (!timers) this.notes.push('this browser gives no GPU timings: the frame time is the whole story here');
    const res: BenchResult = { version: 1, at: new Date().toISOString(), query: this.query, machine: this.machine ?? { webgpu: this.engine.gpu?.adapterInfo ?? 'unknown', browser: '', os: '', userAgent: '', dpr: 1 },
      ...(L ? { set: L.set, scenes: this.scenes } : {}), boot: this.boot0 !== undefined ? this.boot0 : benchBoot(this.deps.boot?.() ?? null), timers, steps: this.steps, ...(this.features ? { features: this.features } : {}), notes: this.notes };
    if (this.rec.commit) res.commit = this.rec.commit;
    this.result = res; this.report = benchReport(res);
    if (this.rec.recording) { this.rec.event('bench', JSON.stringify(res)); this.dump = this.rec.stop(); }   // (the take downloads here, as any F9 one does)
    this.carded = !!L && !!view;   // (a scene's page: its fight is not left running, hands off and unwatched, under the card — the world holds until the card is closed)
    view?.show(this.report, back, !!this.dump);
  }
  /** while it runs the keyboard is the benchmark's: Esc stops it, and no other key goes on to a listener after this one or does its default (the browser's own
   *  shortcuts pass). The page's listeners registered BEFORE this one still hear the key: its Esc and its hotkeys stand down by themselves while a run is on (main.ts) */
  private grabKeys(on: boolean): void {
    if (typeof window === 'undefined') return;
    if (this.keys) { window.removeEventListener('keydown', this.keys, true); this.keys = null; }
    if (!on) return;
    this.keys = (e: KeyboardEvent) => { if (e.metaKey || e.ctrlKey || e.altKey || /^F(5|11|12)$/.test(e.code)) return; e.stopImmediatePropagation(); e.preventDefault(); if (e.code === 'Escape') this.stop('Esc'); };
    window.addEventListener('keydown', this.keys, true);
  }
}
