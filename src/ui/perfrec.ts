// Perf recorder (F9): a field stress-test dump the maintainer can hand back. Every frame while recording it stores the GPU timer's per-pass totals of the
// last readback that resolved (compute passes — render-pass timestamps are meaningless on Metal), CPU sections timed in main.ts's step() (game update,
// render encode, the rest), wall dt, the presented fps, internal res / effective scale / preset, the camera, counts (lights, dynamic boxes, particles,
// smoke, decals), an AI summary, the weather, and discrete EVENTS (quality ladder steps, settings changes, escalation changes, invalidations it can see).
// Stop → a JSON download and, if the shot server is up (:5174), POST /perf?name=… → docs/perf/<name>.json. tools/qa/perf-report.ts turns a dump into the
// tables docs/internal/renderer-v3 was written from (per-pass mean / σ / p95 / worst, spike frames with the events around them, a contention check).
import type { Engine } from '../engine';
import type { Game } from '../game/game';
import type { FollowCamera } from '../game/camera';
import type { Quality } from './quality';

export interface PerfFrame {
  t: number;            // ms since recording start (wall)
  dt: number;           // wall dt of this frame (ms)
  fps: number;          // the HUD's smoothed fps at that moment
  cpu: { update: number; render: number; other: number };   // ms: game.update, engine.render (encode + submit), everything else in step()
  gpu: Record<string, number>;   // per-pass ms from the timer's last resolved readback (compute passes; keys as the HUD lists them)
  gpuSum: number;       // Σ compute (excludes gbuffer/composite/post/fxaa/pdraw)
  gpuUnion?: number;    // the UNION of those passes' intervals on the GPU timeline (GpuTimer.unionMs): what the frame really cost — Metal runs independent passes side by side when
                        // the queue is full (direct beside the whole cascade chain is the normal state at play cadence), and gpuSum then double-counts the overlap by 35–55 %
                        // of the frame at high / medium (docs/internal/p0a-cascades.md). Absent in dumps recorded before 08-10.
  res: [number, number]; eff: number; preset: string; adaptive: boolean;
  cam: [number, number, number, number, number];   // look x, z, yaw, pitch, dist
  n: { lights: number; dyn: number; particles: number; smoke: number; decals: number; guards: string; qrf: string; rain: number; stroke: number };
}
export interface PerfEvent { t: number; frame: number; kind: string; text: string }
export interface PerfDump {
  version: 1; startedAt: string; machine: string; dpr: number; userAgent: string; commit?: string; query?: string; smokeUnit?: number;   // smokeUnit = bricks to one count of a frame's n.smoke (the smoke solver's `stats.live` is its brick pool in 512s: smoke/smoke.ts). No stamp = a take from before the stamp, clouds on the box solver or the pool on the builds since: tools/qa/perf-sweep.ts smokeUnit() tells which · commit = the one the dev server says it serves (/qa/commit; absent off a static build) · query = the page's URL flags (which mission, which switches)
  note: string; frames: PerfFrame[]; events: PerfEvent[];
  settingsAtStart: Record<string, unknown>; settingsAtEnd: Record<string, unknown>;
}

const RENDER_PASS = /^(gbuffer|composite|post|fxaa|pdraw)$/;
const MAX_FRAMES = 60 * 60 * 10;   // ten minutes at 60

/** the frame ring's columns (a compact TYPED-ARRAY store instead of a JS object per frame — the 1-hour native soak: 36 k PerfFrame objects were ~100 MB of heap; the same JSON comes
 *  out at stop(), field for field and in the same order): fixed numeric columns as f64 (the exact rounded doubles the page always wrote), the gpu passes as per-frame (id, value)
 *  rows over an interned pass-name table (the frame's own key ORDER kept), the strings (preset · guards · qrf) interned */
const MAX_PASSES = 48, NUM_COLS = 24;
const C = { t: 0, dt: 1, fps: 2, cpuUpdate: 3, cpuRender: 4, cpuOther: 5, gpuSum: 6, gpuUnion: 7, resW: 8, resH: 9, eff: 10, adaptive: 11, cam0: 12, cam1: 13, cam2: 14, cam3: 15, cam4: 16, lights: 17, dyn: 18, particles: 19, smoke: 20, decals: 21, rain: 22, stroke: 23 } as const;
class FrameRing {
  n = 0;
  // the columns are allocated on the FIRST recording (≈ 25 MB for the ten-minute cap) — a page that never presses F9 keeps nothing but this object
  num!: Float64Array; gpuN!: Uint8Array; gpuId!: Uint8Array; gpuVal!: Float64Array; str!: Uint16Array; private unionMissing!: Uint8Array;   // str = preset · guards · qrf (interned); unionMissing: gpuUnion undefined = the key left out, as before
  private allocated = false;
  private passIdx = new Map<string, number>(); readonly passNames: string[] = [];
  private strIdx = new Map<string, number>(); readonly strings: string[] = [];
  private ensure(): void {
    if (this.allocated) return; this.allocated = true;
    this.num = new Float64Array(MAX_FRAMES * NUM_COLS); this.gpuN = new Uint8Array(MAX_FRAMES); this.gpuId = new Uint8Array(MAX_FRAMES * MAX_PASSES); this.gpuVal = new Float64Array(MAX_FRAMES * MAX_PASSES);
    this.str = new Uint16Array(MAX_FRAMES * 3); this.unionMissing = new Uint8Array(MAX_FRAMES);
  }
  intern(s: string): number { let i = this.strIdx.get(s); if (i === undefined) { i = this.strings.length; this.strings.push(s); this.strIdx.set(s, i); } return i; }
  passId(k: string): number { let i = this.passIdx.get(k); if (i === undefined) { i = this.passNames.length; if (i >= 255) return 255; this.passNames.push(k); this.passIdx.set(k, i); } return i; }
  get full() { return this.n >= MAX_FRAMES; }
  reset() { this.ensure(); this.n = 0; }
  /** the row's numeric columns + the gpu rows + the strings — the caller has rounded every number as the page's frame() did */
  push(cols: number[], gpu: [string, number][], unionMissing: boolean, preset: string, guards: string, qrf: string): void {
    const f = this.n++; const b = f * NUM_COLS; for (let i = 0; i < NUM_COLS; i++) this.num[b + i] = cols[i];
    const gn = Math.min(MAX_PASSES, gpu.length); this.gpuN[f] = gn; for (let i = 0; i < gn; i++) { this.gpuId[f * MAX_PASSES + i] = this.passId(gpu[i][0]); this.gpuVal[f * MAX_PASSES + i] = gpu[i][1]; }
    this.unionMissing[f] = unionMissing ? 1 : 0; this.str[f * 3] = this.intern(preset); this.str[f * 3 + 1] = this.intern(guards); this.str[f * 3 + 2] = this.intern(qrf);
  }
  /** the JS object the page always wrote for frame f (built at stop() only) */
  frameAt(f: number): PerfFrame {
    const b = f * NUM_COLS, v = this.num; const gpu: Record<string, number> = {}; const gn = this.gpuN[f];
    for (let i = 0; i < gn; i++) { const id = this.gpuId[f * MAX_PASSES + i]; if (id < 255) gpu[this.passNames[id]] = this.gpuVal[f * MAX_PASSES + i]; }
    const o: PerfFrame = { t: v[b + C.t], dt: v[b + C.dt], fps: v[b + C.fps], cpu: { update: v[b + C.cpuUpdate], render: v[b + C.cpuRender], other: v[b + C.cpuOther] }, gpu, gpuSum: v[b + C.gpuSum], gpuUnion: this.unionMissing[f] ? undefined : v[b + C.gpuUnion],
      res: [v[b + C.resW], v[b + C.resH]], eff: v[b + C.eff], preset: this.strings[this.str[f * 3]], adaptive: v[b + C.adaptive] !== 0,
      cam: [v[b + C.cam0], v[b + C.cam1], v[b + C.cam2], v[b + C.cam3], v[b + C.cam4]],
      n: { lights: v[b + C.lights], dyn: v[b + C.dyn], particles: v[b + C.particles], smoke: v[b + C.smoke], decals: v[b + C.decals], guards: this.strings[this.str[f * 3 + 1]], qrf: this.strings[this.str[f * 3 + 2]], rain: v[b + C.rain], stroke: v[b + C.stroke] } };
    if (this.unionMissing[f]) delete (o as { gpuUnion?: number }).gpuUnion;   // (JSON.stringify skips undefined either way; the key order stays the page's: gpuSum, gpuUnion, res …)
    return o;
  }
  /** t of the last frame (the note) */
  lastT(): number { return this.n ? this.num[(this.n - 1) * NUM_COLS + C.t] : 0; }
}

export class PerfRecorder {
  recording = false;
  private ring = new FrameRing(); private events: PerfEvent[] = [];
  private t0 = 0; private startedAt = ''; private settings0: Record<string, unknown> = {};
  private commit: string | undefined;
  private lastPreset = ''; private lastEff = 0; private lastEsc = -1; private lastQualityNote = ''; private lastSettingsKey = ''; private lastReallocs = 0;
  /** CPU section marks written by main.ts's step() each frame (ms) */
  cpuUpdate = 0; cpuRender = 0; cpuFrameStart = 0;
  constructor(private engine: Engine, private game: Game, private cam: FollowCamera, private quality: Quality, private hudNote: (s: string) => void) {}
  /** frames recorded so far (the ring's count) */
  get frameCount(): number { return this.ring.n; }
  toggle(): void { if (this.recording) this.stop(); else this.start(); }
  start(note = ''): void {
    this.ring.reset(); this.events = []; this.t0 = performance.now(); this.startedAt = new Date().toISOString(); this.recording = true;
    if (this.commit === undefined && typeof document !== 'undefined') try { void fetch('/qa/commit', { cache: 'no-store' }).then(r => r.ok ? r.text() : '').then(t => { const c = t.trim(); if (/^[0-9a-f]{7,40}$/.test(c)) this.commit = c; }).catch(() => {}); } catch { /* no dev server */ }   // (asked on the first recording, as the session journal asks: ui/sessionrec.ts)
    this.settings0 = this.snapSettings(); this.lastSettingsKey = JSON.stringify(this.settings0);
    this.lastPreset = this.quality.label; this.lastEff = this.engine.effectiveScale; this.lastEsc = -1; this.lastQualityNote = this.quality.lastChange ?? ''; this.lastReallocs = this.engine.passes.reallocs;
    this.event('start', note || 'recording started (F9 stops; the dump downloads and goes to the shot server if it is up)');
    this.hudNote('● REC — F9 to stop');
  }
  stop(): PerfDump | null {
    if (!this.recording) return null;
    this.recording = false; this.event('stop', `${this.ring.n} frames`);
    const frames: PerfFrame[] = new Array(this.ring.n); for (let f = 0; f < this.ring.n; f++) frames[f] = this.ring.frameAt(f);   // (the objects exist only for the dump: built here, serialized, dropped)
    const dump: PerfDump = { version: 1, startedAt: this.startedAt, machine: this.engine.gpu?.adapterInfo ?? 'unknown', dpr: (typeof window !== 'undefined' && window.devicePixelRatio) || 1, userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'bun', ...(this.commit ? { commit: this.commit } : {}), ...(typeof location !== 'undefined' ? { query: location.search } : {}), ...(typeof (this.game as unknown as { smoke?: { stats?: { pool?: number } } }).smoke?.stats?.pool === 'number' ? { smokeUnit: 512 } : {}),
      note: `twopointsix perf recording · ${this.ring.n} frames · ${(this.ring.n ? this.ring.lastT() / 1000 : 0).toFixed(1)} s`,
      frames, events: this.events, settingsAtStart: this.settings0, settingsAtEnd: this.snapSettings() };
    this.deliver(dump); this.hudNote(`REC saved — ${this.ring.n} frames`);
    return dump;
  }
  event(kind: string, text: string): void { this.events.push({ t: +(performance.now() - this.t0).toFixed(1), frame: this.ring.n, kind, text }); }

  /** call once per presented frame, after engine.render, with the wall dt (s) and the HUD's fps */
  frame(dtWall: number, fps: number): void {
    if (!this.recording) return;
    if (this.ring.full) { this.event('cap', 'ring full — stopping'); this.stop(); return; }
    const E = this.engine, g = this.game, T = E.timer;
    const src: Map<string, number> = (T.lastFrame && T.lastFrame.size ? T.lastFrame : T.results);
    const gpu: [string, number][] = []; let sum = 0;
    for (const [k, v] of src) { const ran = typeof T.ranThisFrame === 'function' ? T.ranThisFrame(k) : true; if (!ran) continue; gpu.push([k, +v.toFixed(3)]); if (!RENDER_PASS.test(k)) sum += v; }
    const now = performance.now();
    const other = Math.max(0, (now - this.cpuFrameStart) - this.cpuUpdate - this.cpuRender);
    const c = this.cam as unknown as { target: number[]; yaw: number; pitch: number; distance: number };
    const guardsByState: Record<string, number> = {}; let lit = 0;
    for (const gd of g.guards) { guardsByState[gd.state] = (guardsByState[gd.state] ?? 0) + 1; if (gd.flashlight?.enabled) lit++; }
    const wx = (g as unknown as { weather?: { rainRate?: number; wetness?: number; strokeT?: number; enabled?: boolean } }).weather;
    const P = (E as unknown as { particles?: { stats?: { alive?: number } } }).particles;
    const smoke = (g as unknown as { smoke?: { stats?: { live?: number } } }).smoke;
    const decals = (g as unknown as { decals?: { count?: number; list?: unknown[] } }).decals;
    const union = typeof T.unionMs === 'function' && T.lastRaw?.length ? +T.unionMs(['gbuffer', 'composite', 'post', 'fxaa', 'pdraw']).toFixed(2) : undefined;
    const cols = new Array<number>(NUM_COLS);
    cols[C.t] = +(now - this.t0).toFixed(1); cols[C.dt] = +(dtWall * 1000).toFixed(2); cols[C.fps] = +fps.toFixed(1);
    cols[C.cpuUpdate] = +this.cpuUpdate.toFixed(2); cols[C.cpuRender] = +this.cpuRender.toFixed(2); cols[C.cpuOther] = +other.toFixed(2);
    cols[C.gpuSum] = +sum.toFixed(2); cols[C.gpuUnion] = union ?? 0;
    cols[C.resW] = E.width; cols[C.resH] = E.height; cols[C.eff] = +E.effectiveScale.toFixed(3); cols[C.adaptive] = this.quality.adaptive ? 1 : 0;
    cols[C.cam0] = +(c.target?.[0] ?? 0).toFixed(2); cols[C.cam1] = +(c.target?.[2] ?? 0).toFixed(2); cols[C.cam2] = +(c.yaw ?? 0).toFixed(3); cols[C.cam3] = +(c.pitch ?? 0).toFixed(3); cols[C.cam4] = +(c.distance ?? 0).toFixed(2);
    cols[C.lights] = E.lights.activeCount; cols[C.dyn] = (E.world as unknown as { dynamics: unknown[] }).dynamics?.length ?? 0; cols[C.particles] = P?.stats?.alive ?? 0; cols[C.smoke] = smoke?.stats?.live ?? 0;
    cols[C.decals] = decals?.count ?? decals?.list?.length ?? 0; cols[C.rain] = +(wx?.rainRate ?? 0).toFixed(2); cols[C.stroke] = +((wx as { strokeT?: number } | undefined)?.strokeT ?? 0).toFixed(2);
    this.ring.push(cols, gpu, union === undefined, this.quality.label, Object.entries(guardsByState).map(([k, v]) => `${k}:${v}`).join(' ') + ` lit:${lit}`, (g as unknown as { qrf?: { state?: string } }).qrf?.state ?? '-');
    // events it can see for itself
    if (this.quality.label !== this.lastPreset) { this.event('preset', `${this.lastPreset} → ${this.quality.label}`); this.lastPreset = this.quality.label; }
    if (Math.abs(E.effectiveScale - this.lastEff) > 0.004) { this.event('scale', `effective ×${this.lastEff.toFixed(2)} → ×${E.effectiveScale.toFixed(2)} = ${E.width}×${E.height} (render scale ×${E.settings.renderScale.toFixed(2)} of the cap; ${E.settings.keepHistories ? 'histories resampled, targets from the pool' : 'keepHistories OFF: histories restarted, targets reallocated → expect one slow frame'})`); this.lastEff = E.effectiveScale; }
    const qn = this.quality.lastChange ?? ''; if (qn && qn !== this.lastQualityNote) { this.event('ladder', qn); this.lastQualityNote = qn; }
    if (E.passes.reallocs !== this.lastReallocs) { this.event('targets', E.passes.lastRealloc); this.lastReallocs = E.passes.reallocs; }   // render targets re-made (resize / divisor flip / explicit history restart): what was pooled, resampled, cleared
    const esc = (g as unknown as { escalation?: number }).escalation ?? -1; if (esc !== this.lastEsc) { if (this.lastEsc >= 0) this.event('alarm', `escalation ${this.lastEsc} → ${esc}`); this.lastEsc = esc; }
    if ((this.ring.n & 31) === 0) { const k = JSON.stringify(this.snapSettings()); if (k !== this.lastSettingsKey) { this.event('settings', diffKeys(this.lastSettingsKey, k)); this.lastSettingsKey = k; } }
  }

  private snapSettings(): Record<string, unknown> {
    const S = this.engine.settings as unknown as Record<string, unknown>; const out: Record<string, unknown> = {};
    for (const k of Object.keys(S)) { const v = S[k]; if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') out[k] = v; }
    return out;
  }
  /** the dump out of the process: a download + a POST to the shot server on the page; a native host overrides it (Bun.write into docs/perf/) — hence not private */
  deliver(dump: PerfDump): void {
    const name = `perf-${this.startedAt.replace(/[:.]/g, '-')}`; const body = new Blob(serializeDump(dump), { type: 'application/json' });
    if (typeof document !== 'undefined') try { const a = document.createElement('a'); a.href = URL.createObjectURL(body); a.download = name + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); } catch { /* no DOM */ }
    try { void fetch(`http://localhost:5174/perf?name=${encodeURIComponent(name)}`, { method: 'POST', body, headers: { 'Content-Type': 'application/json' } }).catch(() => {}); } catch { /* no sink */ }
    if (typeof window !== 'undefined') (window as unknown as { __lastPerfDump?: PerfDump }).__lastPerfDump = dump;
  }
}
/** the dump's JSON in PARTS — the same text `JSON.stringify(dump)` gives, the frames in 1024-frame slices — so a 36 k-frame recording never stands as one 50 MB string (a Blob / Bun.write take the parts) */
export function serializeDump(dump: PerfDump): string[] {
  const frames = dump.frames; const parts: string[] = [];
  const head = JSON.stringify({ ...dump, frames: [] });   // '{"version":1,…,"frames":[],"events":…}' with the dump's own key order — split at the frames slot
  const at = head.indexOf('"frames":[]'); if (at < 0) return [JSON.stringify(dump)];
  parts.push(head.slice(0, at + '"frames":['.length));
  for (let i = 0; i < frames.length; i += 1024) { const sl = JSON.stringify(frames.slice(i, i + 1024)); parts.push((i ? ',' : '') + sl.slice(1, -1)); }
  parts.push(head.slice(at + '"frames":['.length));
  return parts;
}
function diffKeys(a: string, b: string): string {
  try { const A = JSON.parse(a || '{}'), B = JSON.parse(b); const ch: string[] = []; for (const k of Object.keys(B)) if (A[k] !== B[k]) ch.push(`${k} ${A[k]} → ${B[k]}`); return ch.slice(0, 8).join(', ') || 'settings changed'; } catch { return 'settings changed'; }
}
