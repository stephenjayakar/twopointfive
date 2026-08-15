// Perf recorder (F9): a field stress-test dump the designer can hand back. Every frame while recording it stores the GPU timer's per-pass totals of the
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
  version: 1; startedAt: string; machine: string; dpr: number; userAgent: string; commit?: string;
  note: string; frames: PerfFrame[]; events: PerfEvent[];
  settingsAtStart: Record<string, unknown>; settingsAtEnd: Record<string, unknown>;
}

const RENDER_PASS = /^(gbuffer|composite|post|fxaa|pdraw)$/;
const MAX_FRAMES = 60 * 60 * 10;   // ten minutes at 60

export class PerfRecorder {
  recording = false;
  private frames: PerfFrame[] = []; private events: PerfEvent[] = [];
  private t0 = 0; private startedAt = ''; private settings0: Record<string, unknown> = {};
  private lastPreset = ''; private lastEff = 0; private lastEsc = -1; private lastQualityNote = ''; private lastSettingsKey = ''; private lastReallocs = 0;
  /** CPU section marks written by main.ts's step() each frame (ms) */
  cpuUpdate = 0; cpuRender = 0; cpuFrameStart = 0;
  constructor(private engine: Engine, private game: Game, private cam: FollowCamera, private quality: Quality, private hudNote: (s: string) => void) {}

  toggle(): void { if (this.recording) this.stop(); else this.start(); }
  start(note = ''): void {
    this.frames = []; this.events = []; this.t0 = performance.now(); this.startedAt = new Date().toISOString(); this.recording = true;
    this.settings0 = this.snapSettings(); this.lastSettingsKey = JSON.stringify(this.settings0);
    this.lastPreset = this.quality.label; this.lastEff = this.engine.effectiveScale; this.lastEsc = -1; this.lastQualityNote = this.quality.lastChange ?? ''; this.lastReallocs = this.engine.passes.reallocs;
    this.event('start', note || 'recording started (F9 stops; the dump downloads and goes to the shot server if it is up)');
    this.hudNote('● REC — F9 to stop');
  }
  stop(): PerfDump | null {
    if (!this.recording) return null;
    this.recording = false; this.event('stop', `${this.frames.length} frames`);
    const dump: PerfDump = { version: 1, startedAt: this.startedAt, machine: this.engine.gpu?.adapterInfo ?? 'unknown', dpr: window.devicePixelRatio || 1, userAgent: navigator.userAgent,
      note: `twopointsix perf recording · ${this.frames.length} frames · ${(this.frames.length ? this.frames[this.frames.length - 1].t / 1000 : 0).toFixed(1)} s`,
      frames: this.frames, events: this.events, settingsAtStart: this.settings0, settingsAtEnd: this.snapSettings() };
    this.deliver(dump); this.hudNote(`REC saved — ${this.frames.length} frames`);
    return dump;
  }
  event(kind: string, text: string): void { this.events.push({ t: +(performance.now() - this.t0).toFixed(1), frame: this.frames.length, kind, text }); }

  /** call once per presented frame, after engine.render, with the wall dt (s) and the HUD's fps */
  frame(dtWall: number, fps: number): void {
    if (!this.recording) return;
    if (this.frames.length >= MAX_FRAMES) { this.event('cap', 'ring full — stopping'); this.stop(); return; }
    const E = this.engine, g = this.game, T = E.timer;
    const src: Map<string, number> = (T.lastFrame && T.lastFrame.size ? T.lastFrame : T.results);
    const gpu: Record<string, number> = {}; let sum = 0;
    for (const [k, v] of src) { const ran = typeof T.ranThisFrame === 'function' ? T.ranThisFrame(k) : true; if (!ran) continue; gpu[k] = +v.toFixed(3); if (!RENDER_PASS.test(k)) sum += v; }
    const now = performance.now();
    const other = Math.max(0, (now - this.cpuFrameStart) - this.cpuUpdate - this.cpuRender);
    const c = this.cam as unknown as { target: number[]; yaw: number; pitch: number; distance: number };
    const guardsByState: Record<string, number> = {}; let lit = 0;
    for (const gd of g.guards) { guardsByState[gd.state] = (guardsByState[gd.state] ?? 0) + 1; if (gd.flashlight?.enabled) lit++; }
    const wx = (g as unknown as { weather?: { rainRate?: number; wetness?: number; strokeT?: number; enabled?: boolean } }).weather;
    const P = (E as unknown as { particles?: { stats?: { alive?: number } } }).particles;
    const smoke = (g as unknown as { smoke?: { stats?: { live?: number } } }).smoke;
    const decals = (g as unknown as { decals?: { count?: number; list?: unknown[] } }).decals;
    this.frames.push({
      t: +(now - this.t0).toFixed(1), dt: +(dtWall * 1000).toFixed(2), fps: +fps.toFixed(1),
      cpu: { update: +this.cpuUpdate.toFixed(2), render: +this.cpuRender.toFixed(2), other: +other.toFixed(2) },
      gpu, gpuSum: +sum.toFixed(2), gpuUnion: typeof T.unionMs === 'function' && T.lastRaw?.length ? +T.unionMs(['gbuffer', 'composite', 'post', 'fxaa', 'pdraw']).toFixed(2) : undefined,
      res: [E.width, E.height], eff: +E.effectiveScale.toFixed(3), preset: this.quality.label, adaptive: this.quality.adaptive,
      cam: [+(c.target?.[0] ?? 0).toFixed(2), +(c.target?.[2] ?? 0).toFixed(2), +(c.yaw ?? 0).toFixed(3), +(c.pitch ?? 0).toFixed(3), +(c.distance ?? 0).toFixed(2)],
      n: { lights: E.lights.activeCount, dyn: (E.world as unknown as { dynamics: unknown[] }).dynamics?.length ?? 0, particles: P?.stats?.alive ?? 0, smoke: smoke?.stats?.live ?? 0,
           decals: decals?.count ?? decals?.list?.length ?? 0, guards: Object.entries(guardsByState).map(([k, v]) => `${k}:${v}`).join(' ') + ` lit:${lit}`,
           qrf: (g as unknown as { qrf?: { state?: string } }).qrf?.state ?? '-', rain: +(wx?.rainRate ?? 0).toFixed(2), stroke: +((wx as { strokeT?: number } | undefined)?.strokeT ?? 0).toFixed(2) },
    });
    // events it can see for itself
    if (this.quality.label !== this.lastPreset) { this.event('preset', `${this.lastPreset} → ${this.quality.label}`); this.lastPreset = this.quality.label; }
    if (Math.abs(E.effectiveScale - this.lastEff) > 0.004) { this.event('scale', `effective ×${this.lastEff.toFixed(2)} → ×${E.effectiveScale.toFixed(2)} = ${E.width}×${E.height} (render scale ×${E.settings.renderScale.toFixed(2)} of the cap; ${E.settings.keepHistories ? 'histories resampled, targets from the pool' : 'keepHistories OFF: histories restarted, targets reallocated → expect one slow frame'})`); this.lastEff = E.effectiveScale; }
    const qn = this.quality.lastChange ?? ''; if (qn && qn !== this.lastQualityNote) { this.event('ladder', qn); this.lastQualityNote = qn; }
    if (E.passes.reallocs !== this.lastReallocs) { this.event('targets', E.passes.lastRealloc); this.lastReallocs = E.passes.reallocs; }   // render targets re-made (resize / divisor flip / explicit history restart): what was pooled, resampled, cleared
    const esc = (g as unknown as { escalation?: number }).escalation ?? -1; if (esc !== this.lastEsc) { if (this.lastEsc >= 0) this.event('alarm', `escalation ${this.lastEsc} → ${esc}`); this.lastEsc = esc; }
    if ((this.frames.length & 31) === 0) { const k = JSON.stringify(this.snapSettings()); if (k !== this.lastSettingsKey) { this.event('settings', diffKeys(this.lastSettingsKey, k)); this.lastSettingsKey = k; } }
  }

  private snapSettings(): Record<string, unknown> {
    const S = this.engine.settings as unknown as Record<string, unknown>; const out: Record<string, unknown> = {};
    for (const k of Object.keys(S)) { const v = S[k]; if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') out[k] = v; }
    return out;
  }
  private deliver(dump: PerfDump): void {
    const name = `perf-${this.startedAt.replace(/[:.]/g, '-')}`; const body = JSON.stringify(dump);
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: 'application/json' })); a.download = name + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); } catch { /* headless */ }
    try { void fetch(`http://localhost:5174/perf?name=${encodeURIComponent(name)}`, { method: 'POST', body, headers: { 'Content-Type': 'application/json' } }).catch(() => {}); } catch { /* no sink */ }
    (window as unknown as { __lastPerfDump?: PerfDump }).__lastPerfDump = dump;
  }
}
function diffKeys(a: string, b: string): string {
  try { const A = JSON.parse(a || '{}'), B = JSON.parse(b); const ch: string[] = []; for (const k of Object.keys(B)) if (A[k] !== B[k]) ch.push(`${k} ${A[k]} → ${B[k]}`); return ch.slice(0, 8).join(', ') || 'settings changed'; } catch { return 'settings changed'; }
}
