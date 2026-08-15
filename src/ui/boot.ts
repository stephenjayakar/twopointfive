// Boot instrumentation: named marks on the way from 'script start' to 'start card interactive' (performance.mark / measure under the 'boot:' prefix, so they show
// in a DevTools performance recording too), the pipeline count gpu/device.ts keeps, the main thread's long tasks and the longest gap between animation frames while
// booting (what a person feels as 'the tab froze'), and the GPU's first-frame latency — summarised on window.__boot and in ONE console line when the card goes live.
// main.ts calls mark() at each phase boundary; nothing here touches the renderer.
import { pipelineProgress } from '../gpu/device';

export interface BootSummary {
  /** ms since navigation start, per mark (script, gpu, engine, level, world, gltf, pipelines, game, hooks, firstSubmit, gpuReady, interactive …) */
  marks: Record<string, number>;
  /** durations of the phases that have a beginning and an end (levelParse, gltf, gameCtor, pipelines, firstFrameCpu, firstFrameGpu …) */
  spans: Record<string, number>;
  pipelines: { total: number; done: number; failed: number };
  longTasks: { start: number; dur: number }[]; maxLongTask: number;
  /** the longest interval between two animation-frame callbacks between script start and the app's own loop taking over (a compositor stalled by the GPU process shows here even when no JS task is long) */
  maxRafGap: number; rafGapAt: number;
  userAgent: string;
}

const t0 = performance.now();
const marks: Record<string, number> = {}; const spans: Record<string, number> = {};
const longTasks: { start: number; dur: number }[] = [];
let maxRafGap = 0, rafGapAt = 0, rafLast = 0, rafOn = true;

let po: PerformanceObserver | null = null;
/** the boot's long tasks are the ones up to gpuReady (mark() disconnects the observer there); the cap is belt and braces for a page that never gets that far */
const LONGTASK_CAP = 256;
const takeLong = (list: PerformanceEntry[]) => { for (const e of list) { if (longTasks.length >= LONGTASK_CAP) break; longTasks.push({ start: +e.startTime.toFixed(1), dur: +e.duration.toFixed(1) }); } };
try {   // long tasks (≥ 50 ms of uninterrupted main-thread work), buffered from navigation start where the browser supports it
  po = new PerformanceObserver(list => takeLong(list.getEntries()));
  po.observe({ type: 'longtask', buffered: true });
} catch { /* no longtask entries in this browser: maxLongTask stays 0 and says so */ }
{ // the animation-frame cadence during boot: a probe loop that does nothing but time itself, stopped when main.ts starts the real one (stopRafProbe)
  const tick = (now: number) => { if (rafLast > 0) { const gap = now - rafLast; if (gap > maxRafGap) { maxRafGap = gap; rafGapAt = rafLast; } } rafLast = now; if (rafOn) requestAnimationFrame(tick); };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tick);
}
export function stopRafProbe() { rafOn = false; }

/** a named instant on the boot timeline ('gpu', 'level', …): performance.mark('boot:<name>') + the table */
export function mark(name: string): number {
  const t = performance.now(); marks[name] = +t.toFixed(1);
  try { performance.mark('boot:' + name); } catch { /* */ }
  if (name === 'gpuReady' && po) { try { takeLong(po.takeRecords()); po.disconnect(); } catch { /* */ } po = null; }   // the boot is over: what the observer still holds is taken, and it stops listening (it used to collect every long task of a three-hour session — review U9.7)
  return t;
}
/** a named duration (a phase with a start and an end); also a performance.measure so it shows on a DevTools timeline */
export function span(name: string, start: number, end = performance.now()): number {
  const d = end - start; spans[name] = +d.toFixed(1);
  try { performance.measure('boot:' + name, { start, end }); } catch { /* */ }
  return d;
}
mark('script');
spans.beforeScript = +t0.toFixed(1);   // navigation start → this module evaluating (HTML, the bundle's fetch + parse)

/** the boot's pipeline count, frozen by main.ts when the last boot pipeline resolved (hot swaps / lazy variants made later through the same helpers do not count as boot) */
let frozenPl: { total: number; done: number; failed: number } | null = null;
export function freezePipelines() { const P = pipelineProgress; frozenPl = { total: P.total, done: P.done, failed: P.failed }; }
export function summary(): BootSummary {
  if (po) takeLong(po.takeRecords());   // (entries the observer has queued but not yet delivered — its callback runs at low priority, after the line would have printed)
  const P = frozenPl ?? pipelineProgress;
  return { marks: { ...marks }, spans: { ...spans }, pipelines: { total: P.total, done: P.done, failed: P.failed }, longTasks: [...longTasks], maxLongTask: longTasks.reduce((m, e) => Math.max(m, e.dur), 0),
    maxRafGap: +maxRafGap.toFixed(1), rafGapAt: +rafGapAt.toFixed(1), userAgent: navigator.userAgent };
}
/** the one console line: 'boot 2140 ms to interactive · gpu 180 · level 95 · gltf 310 · game 420 · 97 pipelines in 1250 · first frame cpu 38 / gpu 210 · longest task 160 · longest frame gap 240' */
export function line(): string {
  const s = summary(), m = s.marks, sp = s.spans; const f = (v: number | undefined) => v === undefined ? '—' : String(Math.round(v));
  return `boot ${f(m.interactive)} ms to interactive (script at ${f(sp.beforeScript)}) · adapter+device ${f(sp.gpu)} · level ${f(sp.level)} · glTF ${f(sp.gltf)} · game ctor ${f(sp.gameCtor)} · ${s.pipelines.done}/${s.pipelines.total} pipelines in ${f(sp.pipelines)}${s.pipelines.failed ? ` (${s.pipelines.failed} FAILED)` : ''} · first frame cpu ${f(sp.firstFrameCpu)} / gpu ${f(sp.firstFrameGpu)} · longest main-thread task ${f(s.maxLongTask)} · longest frame gap ${f(s.maxRafGap)}`;
}
/** window.__boot: the live view (summary() re-read on every access) + the line */
export function expose() {
  Object.defineProperty(window, '__boot', { configurable: true, get: () => ({ ...summary(), line: line() }) });
}
