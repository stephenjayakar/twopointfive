// The WIND field made visible (Tab ▸ Weather & wind ▸ Wind — field view): a 2D canvas laid over the view, drawn only while one of its switches is on, of
// (a) the FIELD — a 1 m lattice of arrows on a plane at height h round the camera's look-at, each game.wind.at(p) (the analytic sum both GPU consumers
// evaluate: wind.ts jetVel / stormVel), length ∝ speed (capped), coloured thin green → amber → red by speed in the HUD's palette, faded toward the disc's rim;
// (b) the SOURCES — every source the level has: a vent = its cone (apex, axis × dMax, the widening rim) + name and face speed, the storm = one big arrow
// standing off the upwind facade, a door gust = an arrow in through the doorway while it blows; inactive ones dim; (c) WHAT THE PARTICLES GET — the ≤ 8
// records wind.ts packed for the GPU particles this frame drawn bright and tagged, the rest greyed; (d) the PROBE — wind.at(the aim point) live in the
// section header. Nothing here touches the renderer or the game's state (WIND_STATS.atCalls ticks, a counter): the frame is byte for byte what it was, on or off.
import { Vec3, v3 } from '../math/vec';
import type { FollowCamera } from '../game/camera';
import type { Game } from '../game/game';
import type { WindSource } from '../game/wind';

const MAX_SAMPLES = 600;   // the field's budget a frame (a disc of radius 13 on a 1 m lattice is ~530)
/** speed → the HUD's colours: thin green under 0.5 m/s, amber by 1.5, red from 3 */
function speedColour(s: number, a: number): string {
  const g = [121, 214, 154], y = [243, 200, 106], r = [255, 122, 92];
  const t = s < 0.5 ? 0 : s < 1.5 ? (s - 0.5) : 1 + Math.min(1, (s - 1.5) / 1.5);
  const [c0, c1, k] = t <= 1 ? [g, y, t] : [y, r, t - 1];
  return `rgba(${Math.round(c0[0] + (c1[0] - c0[0]) * k)},${Math.round(c0[1] + (c1[1] - c0[1]) * k)},${Math.round(c0[2] + (c1[2] - c0[2]) * k)},${a.toFixed(3)})`;
}

export class WindViz {
  showField = false; showSources = false; showPacked = false; probe = false;
  /** disc radius of the field lattice round the look-at (m), the plane's height (m), metres of arrow per m/s, the longest arrow (m) */
  radius = 8; height = 1.0; scale = 0.6; maxLen = 0.9;
  /** the last frame's numbers for the panel: samples taken, arrows drawn, CPU ms (EMA), the probe's reading */
  stats = { samples: 0, drawn: 0, ms: 0, msPeak: 0, at: [0, 0, 0] as Vec3, atSpeed: 0 };
  private canvas: HTMLCanvasElement | null = null; private ctx: CanvasRenderingContext2D | null = null; private clear = true;
  private tmp: Vec3 = [0, 0, 0]; private p: Vec3 = [0, 0, 0];
  constructor(private host: HTMLElement | null) {}
  get on() { return this.showField || this.showSources || this.showPacked || this.probe; }

  update(game: Game, cam: FollowCamera, w: number, h: number) {
    if (!this.on) { if (!this.clear && this.ctx && this.canvas) { this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); this.canvas.style.display = 'none'; this.clear = true; } return; }
    const t0 = performance.now();
    if (this.probe) { const a = game.aimPoint; game.wind.at([a[0], a[1] + 0.05, a[2]], this.stats.at); this.stats.atSpeed = Math.hypot(this.stats.at[0], this.stats.at[1], this.stats.at[2]); }
    const c = this.context(w, h); if (!c) return;
    this.clear = false; this.stats.samples = 0; this.stats.drawn = 0;
    c.lineCap = 'round'; c.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    if (this.showSources || this.showPacked) this.sources(c, game, cam, w, h);
    if (this.showField) this.field(c, game, cam, w, h);
    if (this.probe) this.probeMark(c, game, cam, w, h);
    const ms = performance.now() - t0; this.stats.ms = this.stats.ms * 0.9 + ms * 0.1; this.stats.msPeak = Math.max(ms, this.stats.msPeak * 0.99);
  }
  summary(): string {
    if (!this.on) return 'off (nothing drawn, nothing sampled)';
    const s = this.stats; const parts: string[] = [];
    if (this.showField) parts.push(`field ${s.samples} samples → ${s.drawn} arrows @ h ${this.height.toFixed(1)} m, r ${this.radius} m`);
    if (this.showSources || this.showPacked) parts.push(this.showPacked ? 'sources (GPU-packed bright)' : 'sources');
    if (this.probe) parts.push(`at cursor ${s.atSpeed.toFixed(2)} m/s (${s.at.map(x => x.toFixed(2)).join(', ')})`);
    parts.push(`cpu ${s.ms.toFixed(2)} ms (peak ${s.msPeak.toFixed(2)})`);
    return parts.join(' · ');
  }

  private context(w: number, h: number): CanvasRenderingContext2D | null {
    if (!this.host) return null;
    if (!this.canvas) { const cv = document.createElement('canvas'); cv.className = 'windviz'; cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;'; this.host.appendChild(cv); this.canvas = cv; this.ctx = cv.getContext('2d'); }
    const cv = this.canvas, c = this.ctx; if (!c) return null;
    const dpr = Math.min(2, window.devicePixelRatio || 1); const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    cv.style.display = ''; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h); return c;
  }
  /** an arrow from world a to world b (shaft + two head strokes in screen space); false when either end is off / behind */
  private arrow(c: CanvasRenderingContext2D, cam: FollowCamera, w: number, h: number, a: Vec3, b: Vec3, colour: string, width: number, head = 6): boolean {
    const [x0, y0, o0] = cam.project(a, w, h, 1.15), [x1, y1, o1] = cam.project(b, w, h, 1.15); if (!o0 || !o1) return false;
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy); if (L < 1.5) return false;
    const ux = dx / L, uy = dy / L, hd = Math.min(head, L * 0.45);
    c.strokeStyle = colour; c.lineWidth = width; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1);
    c.moveTo(x1, y1); c.lineTo(x1 - ux * hd - uy * hd * 0.55, y1 - uy * hd + ux * hd * 0.55); c.moveTo(x1, y1); c.lineTo(x1 - ux * hd + uy * hd * 0.55, y1 - uy * hd - ux * hd * 0.55); c.stroke();
    return true;
  }
  private field(c: CanvasRenderingContext2D, game: Game, cam: FollowCamera, w: number, h: number) {
    const R = Math.max(2, Math.min(13, this.radius)); const f = cam.target; const cx = Math.round(f[0]), cz = Math.round(f[2]); const y = this.height;
    let step = 1; while (Math.PI * (R / step) * (R / step) > MAX_SAMPLES) step += 0.5;
    const v = this.tmp, p = this.p, q: Vec3 = [0, 0, 0];
    for (let x = cx - R; x <= cx + R; x += step) for (let z = cz - R; z <= cz + R; z += step) {
      const d = Math.hypot(x - f[0], z - f[2]); if (d > R) continue;
      p[0] = x; p[1] = y; p[2] = z; game.wind.at(p, v); this.stats.samples++;
      const s = Math.hypot(v[0], v[1], v[2]); const fade = 1 - Math.max(0, (d / R - 0.55) / 0.45);
      if (s < 0.02) { const [sx, sy, ok] = cam.project(p, w, h, 1.05); if (ok) { c.fillStyle = `rgba(121,214,154,${(0.18 * fade).toFixed(3)})`; c.fillRect(sx - 1, sy - 1, 2, 2); } continue; }   // still air: a faint lattice dot
      const len = Math.min(this.maxLen, s * this.scale) / s; q[0] = p[0] + v[0] * len; q[1] = p[1] + v[1] * len; q[2] = p[2] + v[2] * len;
      if (this.arrow(c, cam, w, h, p, q, speedColour(s, 0.35 + 0.6 * fade), 1.4, 5)) this.stats.drawn++;
    }
  }
  private sources(c: CanvasRenderingContext2D, game: Game, cam: FollowCamera, w: number, h: number) {
    const packed = new Set<WindSource>(this.showPacked ? game.wind.forParticles : []);
    for (const s of game.wind.all) {
      const live = s.speed > 0; const isPacked = packed.has(s);
      const alpha = this.showPacked ? (isPacked ? 1 : live ? 0.35 : 0.15) : (live ? 0.9 : 0.25);
      const col = this.showPacked && isPacked ? `rgba(255,210,122,${alpha})` : live ? `rgba(159,243,201,${alpha})` : `rgba(140,160,150,${alpha})`;
      if (s.kind === 'storm') { this.storm(c, cam, w, h, s, col, alpha); continue; }
      // a jet (vent or door): apex, the axis to dMax, the rim circle where it dies (r0 + dMax·tanSpread) with four generators, the reach circle dashed
      const apex = s.pos, dir = s.dir; const end = v3.mad(apex, dir, s.dMax);
      this.arrow(c, cam, w, h, apex, v3.mad(apex, dir, Math.max(0.6, Math.min(s.dMax, s.reach))), col, s.why === 'door' ? 2.2 : 1.8, 8);
      const [ux, uz] = Math.abs(dir[1]) > 0.7 ? [[1, 0, 0], [0, 0, 1]] as [Vec3, Vec3] : [[-dir[2], 0, dir[0]], [0, 1, 0]] as [Vec3, Vec3];
      const ring = (centre: Vec3, rad: number, dashed: boolean) => { c.strokeStyle = col; c.lineWidth = 1; c.setLineDash(dashed ? [4, 4] : []); c.beginPath(); let first = true; for (let k = 0; k <= 20; k++) { const a = k / 20 * Math.PI * 2; const pt = v3.mad(v3.mad(centre, ux, Math.cos(a) * rad), uz, Math.sin(a) * rad); const [x, y, ok] = cam.project(pt, w, h, 1.15); if (!ok) { first = true; continue; } if (first) { c.moveTo(x, y); first = false; } else c.lineTo(x, y); } c.stroke(); c.setLineDash([]); };
      const rimR = s.r0 + s.dMax * s.tanSpread; ring(end, rimR, false); ring(v3.mad(apex, dir, s.reach), s.r0 + s.reach * s.tanSpread, true);
      c.strokeStyle = col; c.lineWidth = 0.8; c.beginPath(); for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; const rim = v3.mad(v3.mad(end, ux, Math.cos(a) * rimR), uz, Math.sin(a) * rimR); const [x0, y0, o0] = cam.project(v3.mad(v3.mad(apex, ux, Math.cos(a) * s.r0), uz, Math.sin(a) * s.r0), w, h, 1.15), [x1, y1, o1] = cam.project(rim, w, h, 1.15); if (o0 && o1) { c.moveTo(x0, y0); c.lineTo(x1, y1); } } c.stroke();
      const [lx, ly, lok] = cam.project(apex, w, h, 1.05);
      if (lok) { c.fillStyle = col; c.fillText(`${s.name.replace(/^door:/, '⇥ ')}${live ? ` ${s.speed.toFixed(1)} m/s` : ' (off)'}${isPacked ? ' ▶GPU' : ''}`, lx + 6, ly - 5); }
    }
  }
  /** the storm: one big arrow standing 4 m off the upwind facade, pointing along the wind, length ∝ speed */
  private storm(c: CanvasRenderingContext2D, cam: FollowCamera, w: number, h: number, s: WindSource, col: string, alpha: number) {
    const I = s.interior; if (!I) return;
    const cx = (I[0] + I[2]) / 2, cz = (I[1] + I[3]) / 2; const live = s.speed > 0;
    const dir: Vec3 = live ? s.dir : [1, 0, 0]; const hx = (I[2] - I[0]) / 2 + 4, hz = (I[3] - I[1]) / 2 + 4;
    const k = Math.min(Math.abs(dir[0]) > 1e-3 ? hx / Math.abs(dir[0]) : 1e9, Math.abs(dir[2]) > 1e-3 ? hz / Math.abs(dir[2]) : 1e9);   // back the arrow's midpoint out of the footprint along −dir
    const mid: Vec3 = [cx - dir[0] * k, 3, cz - dir[2] * k]; const L = live ? Math.min(10, 2 + s.speed * 1.5) : 3;
    this.arrow(c, cam, w, h, v3.mad(mid, dir, -L / 2), v3.mad(mid, dir, L / 2), col, live ? 3.5 : 1.5, 14);
    const [lx, ly, ok] = cam.project(mid, w, h, 1.05); if (ok) { c.fillStyle = `rgba(159,243,201,${alpha})`; c.fillText(live ? `storm ${s.speed.toFixed(1)} m/s${this.showPacked ? ' ▶GPU' : ''}` : 'storm (calm / off)', lx + 8, ly + 14); }
  }
  private probeMark(c: CanvasRenderingContext2D, game: Game, cam: FollowCamera, w: number, h: number) {
    const a = game.aimPoint; const p: Vec3 = [a[0], a[1] + 0.05, a[2]]; const v = this.stats.at; const s = this.stats.atSpeed;
    const [x, y, ok] = cam.project(p, w, h, 1.05); if (!ok) return;
    if (s >= 0.02) { const len = Math.min(this.maxLen * 1.5, s * this.scale) / s; this.arrow(c, cam, w, h, p, [p[0] + v[0] * len, p[1] + v[1] * len, p[2] + v[2] * len], speedColour(s, 1), 2.2, 7); }
    c.fillStyle = 'rgba(223,255,234,0.95)'; c.fillText(`${s.toFixed(2)} m/s`, x + 8, y - 8);
  }
}
