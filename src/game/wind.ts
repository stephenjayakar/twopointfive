// WIND — the building's air as ONE field (the designer: "for hvac vents, that should model wind which then also influences the smoke solver"). Three kinds
// of source, every one ANALYTIC and cheap, summed: the level's HVAC supply VENTS (levels/*.json vents[] → Level.vents: a cone jet out of each diffuser's face,
// speed × 1/(1 + (d/reach)²) down its axis × a Gaussian across, cut off at 2.5 × reach, a jet blown at a floor turning to run along it — the field's one text is
// render/shaders/wind_field.wgsl; jetVel / stormVel below repeat it on the CPU), the STORM outdoors (weather.ts's wind vector, read — never its dice — gusting on
// a noise of the clock, nothing inside the two roofed footprints, easing in off the facade), and a GUST through every OPEN EXTERIOR DOOR (a short jet along the
// inward normal ∝ how far the leaf stands open × how hard the storm blows at that face). Every source folds its own state into ONE speed a frame — a vent's slow
// cycling and its spin-down when the mains go (the air handler is on the breaker), the gusting — and that record goes, unchanged, to BOTH GPU consumers:
//   • the particles (render/particles.ts setWind → the update kernel's windAir): dust and paper take their drag against the MOVING air, chips a share
//     of it, brass none; a leaf lying under a diffuser trembles and now and then one is picked up and slides (the impulse lane's 'co-moving gust' generalised);
//   • the smoke solver (smoke.ts setWind → the forces kernel's windForce): the simulated air of every live domain a source overlaps is relaxed toward the field
//     inside its support, and the pressure solve does the rest — a plume under a vent bends, one by an open door in the storm leans in, dust off the ceiling
//     drifts down the jet. The guards' smoke sight lines march THAT density (game.ts probe.querySegment): the picture and the AI stay one model with nothing added.
// Wind never allocates: no smoke domain is placed, kept or retired by it (smoke.ts writeWind only ever reads the live list), no particle is born of it, the record
// pools are fixed. BOUNDED: ≤ WIND_GPU_MAX (8) records to either consumer a frame (the particles take the nearest to the view and share
// the impulses' sixteen slots BEHIND them — a bang is never short of a slot; the solver culls per domain), O(vents + exterior doors) CPU a frame. DETERMINISTIC:
// every wobble is a hash of the game clock and the source's own seed — never Math.random, never anybody's dice (the storm's stroke schedule must not shift).
// `tune.wind` (0‥1, default 1) scales every speed and 0 is the game byte for byte as it was: update() clears both consumers and returns before touching anything
// (tools/qa wind-identity). Knobs WIND below (Tab ▸ Weather ▸ wind rows, kept per machine with the master: localStorage twopointsix.wind).
import { Vec3, v3 } from '../math/vec';
import type { Game } from './game';
import type { Door } from './doors';
import type { VentDef } from '../scene/level';
import { VENT_DEFAULTS } from '../scene/levelData';
import type { WindGpuSource } from '../smoke/types';
import { WIND_GPU_MAX } from '../smoke/types';
import { INTERIOR, ANNEX } from './weather';
import { isDaylight } from './lighting';
import { gpuFx } from './particleFx';

/** the field's shape constants — render/shaders/wind_field.wgsl carries the same five under WIND_* (tools/qa wind-probes compares), + how a vent record becomes a jet */
export const WIND_FIELD = { deflectH: 0.55, deflectLoss: 0.35, supportSigma: 2.6, stormTop: 8.0, stormLee: 1.5, /** dMax = cutK × reach */ cutK: 2.5, /** r0 = coreK × the face's size */ coreK: 0.4 };
/** The lane's knobs (Tab ▸ Weather ▸ wind rows; persisted with tune.wind). */
export const WIND = {
  def: 1,                                        // tune.wind's default: the master 0‥1 (× every source's speed; 0 = still air, nothing packed anywhere)
  vents: true, ventK: 1,                         // the level's diffusers, × their authored speed
  storm: true, stormK: 1,                        // the weather's wind outdoors as a source, × its speed
  doors: true, doorK: 1, doorReach: 2.2, doorSpreadDeg: 22, doorOpenRad: 1.2,   // gusts through open exterior doors: reach (m), cone half-angle, the leaf angle that counts as fully open
  gusts: true, gustAmp: 0.25, gustPeriod: 3.5, stormGustAmp: 0.35, stormGustPeriod: 2.5,   // × (1 ± amp) on a value noise of the clock, per source
  rampUp: 3, rampDown: 4,                        // s: a vent spinning up (cycle on / mains back) and down (cycle off / blackout)
  smokeRelax: 3,                                 // 1/s at a jet's core: how hard the solver's air is pulled toward the field (× the jet's own profile off the core)
  sheetWake: 0.35, sheetKick: 2.0, debrisK: 0.15,   // the particle kernel's three (particles.wgsl windKnobs): air speed over a resting leaf that may pick it up, × that = its hop, a chip's coupling
  nearM: 14,                                     // particles: jets whose support comes within this of the view's look-at point are packed, nearest first
};
export const WIND_DEFAULTS = JSON.parse(JSON.stringify(WIND)) as typeof WIND;
const LS_KEY = 'twopointsix.wind';
type WindTune = { wind?: number; moths?: boolean };
const PERSISTED = ['vents', 'ventK', 'storm', 'stormK', 'doors', 'doorK', 'gusts', 'gustAmp', 'smokeRelax', 'sheetWake', 'sheetKick', 'debrisK'] as const;
export function loadWind(tune: WindTune) {
  tune.wind = WIND.def;
  try { const raw = localStorage.getItem(LS_KEY); if (!raw) return; const o = JSON.parse(raw);
    if (typeof o.wind === 'number' && isFinite(o.wind)) tune.wind = Math.max(0, Math.min(1, o.wind));
    if (typeof o.moths === 'boolean') tune.moths = o.moths;   // (the moths' switch rides with the wind's rows; a stale `motes` key from before 08-11 is ignored)
    for (const k of PERSISTED) { const v = o[k]; if (typeof (WIND as any)[k] === 'boolean' ? typeof v === 'boolean' : (typeof v === 'number' && isFinite(v))) (WIND as any)[k] = v; }
  } catch { /* no storage (bun) / junk */ }
}
export function saveWind(g: Game) { try { const T = g.tune as WindTune; const o: Record<string, unknown> = { wind: windOf(g), moths: T.moths !== false }; for (const k of PERSISTED) o[k] = (WIND as any)[k]; localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch { /* */ } }
export function resetWindKnobs(g: Game) { Object.assign(WIND, JSON.parse(JSON.stringify(WIND_DEFAULTS))); const T = g.tune as WindTune; T.wind = WIND.def; T.moths = true; try { localStorage.removeItem(LS_KEY); } catch { /* */ } }
/** the master as the systems read it: tune.wind clamped 0‥1 (nothing suspends wind wholesale — the tour keeps its draughts, they change no beat) */
export function windOf(g: Game): number { const w = (g.tune as WindTune).wind; return Math.max(0, Math.min(1, w ?? 0)); }

// ------------------------------------------------------------------ the field (render/shaders/wind_field.wgsl, statement for statement)
const smoothstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** The JET's air at p (m/s, into `out`): a diffuser at `pos` blowing along unit `dir` at `speed` at its face — see wind_field.wgsl windJet. */
export function jetVel(pos: Vec3, dir: Vec3, speed: number, reach: number, tanSpread: number, r0: number, dMax: number, floorY: number, p: Vec3, out: Vec3 = [0, 0, 0]): Vec3 {
  out[0] = 0; out[1] = 0; out[2] = 0;
  if (!(speed > 0)) return out;
  const qx = p[0] - pos[0], qy = p[1] - pos[1], qz = p[2] - pos[2];
  const d = qx * dir[0] + qy * dir[1] + qz * dir[2];
  if (d <= 0 || d >= dMax) return out;
  const rx = qx - dir[0] * d, ry = qy - dir[1] * d, rz = qz - dir[2] * d; const r = Math.hypot(rx, ry, rz);
  const sigma = r0 + d * tanSpread;
  if (r > WIND_FIELD.supportSigma * sigma) return out;
  const x = d / Math.max(reach, 1e-3), rs = r / sigma;
  let s = speed * Math.exp(-rs * rs) / (1 + x * x) * (1 - smoothstep(0.7 * dMax, dMax, d));
  const ap = d + r0 / Math.max(tanSpread, 0.02);
  let ux = dir[0] * ap + rx, uy = dir[1] * ap + ry, uz = dir[2] * ap + rz; { const l = Math.hypot(ux, uy, uz) || 1; ux /= l; uy /= l; uz /= l; }
  if (floorY > -100 && dir[1] < -0.5) {
    const h = p[1] - floorY;
    if (h < 0) return out;
    if (h < WIND_FIELD.deflectH) {
      const t = 1 - h / WIND_FIELD.deflectH;
      let hx = rx, hz = rz; const hl = Math.hypot(hx, hz);
      if (hl > 1e-3) { hx /= hl; hz /= hl; } else { hx = dir[2] + 0.37; hz = 0.29 - dir[0]; const l = Math.hypot(hx, hz); hx /= l; hz /= l; }
      const k = t * t; let mx = ux + (hx - ux) * k, my = uy + (0 - uy) * k, mz = uz + (hz - uz) * k; const ml = Math.hypot(mx, my, mz) || 1; ux = mx / ml; uy = my / ml; uz = mz / ml;
      s *= 1 - WIND_FIELD.deflectLoss * t;
    }
  }
  out[0] = ux * s; out[1] = uy * s; out[2] = uz * s; return out;
}
const inRect = (x: number, z: number, R: readonly number[]) => x > R[0] && z > R[1] && x < R[2] && z < R[3];
/** The STORM's air at p: `wind` outdoors, nothing inside the interior / annex footprints or over stormTop — see wind_field.wgsl windStorm. */
export function stormVel(wind: Vec3, interior: readonly number[], annex: readonly number[], p: Vec3, out: Vec3 = [0, 0, 0]): Vec3 {
  out[0] = 0; out[1] = 0; out[2] = 0;
  if (p[1] > WIND_FIELD.stormTop || p[1] < 0 || inRect(p[0], p[2], interior) || inRect(p[0], p[2], annex)) return out;
  const dOut = Math.max(Math.max(interior[0] - p[0], p[0] - interior[2]), Math.max(interior[1] - p[2], p[2] - interior[3]));
  const k = smoothstep(0, WIND_FIELD.stormLee, dOut) * (0.55 + 0.45 * Math.max(0, Math.min(1, p[1] / 2.5)));
  out[0] = wind[0] * k; out[1] = wind[1] * k; out[2] = wind[2] * k; return out;
}

// ------------------------------------------------------------------ noise off the clock (no dice: a pure function of game time and a seed)
function hashU(x: number): number { x = Math.imul((x ^ 0x9E3779B9) >>> 0, 0x85EBCA6B) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0xC2B2AE35) >>> 0; x ^= x >>> 16; return x >>> 0; }
const hash01 = (x: number) => (hashU(x) >>> 8) / 16777216;
/** smooth value noise in [−1, 1] at x, one lattice value per integer, per seed */
export function vnoise(seed: number, x: number): number {
  const i = Math.floor(x), f = x - i; const a = hash01(seed ^ Math.imul(i, 2654435761)) * 2 - 1, b = hash01(seed ^ Math.imul(i + 1, 2654435761)) * 2 - 1;
  const t = f * f * (3 - 2 * f); return a + (b - a) * t;
}
const hashStr = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h >>> 0; };

// ------------------------------------------------------------------ sources
export type WindWhy = 'vent' | 'storm' | 'door' | 'glass';   // (glass: the gust through a shot-out EXTERIOR pane — game/glassbreak.ts pushes the record onto Wind.all and writes its `base` off the storm × the open share each frame)
/** One live source (extends the GPU record with what the CPU keeps about it): `base` = its authored / derived full speed, `on` = the vent's spin 0‥1, `gust` = this frame's ×, `speed` = the product × the master */
export interface WindSource extends WindGpuSource { why: WindWhy; base: number; on: number; gust: number; seed: number; vent?: VentDef; door?: Door; }
/** counters for the probes / panel */
export const WIND_STATS = { frames: 0, active: 0, toParticles: 0, toSmoke: 0, doorGusts: 0, stormFrames: 0, atCalls: 0 };
const DEG = Math.PI / 180;
const cx = (INTERIOR[0] + INTERIOR[2]) / 2, cz = (INTERIOR[1] + INTERIOR[3]) / 2;

export class Wind {
  /** every source the level can have (vents, one storm, one per exterior door), built once; `active` = the ones blowing this frame (speed > 0), rebuilt in place each update */
  readonly all: WindSource[] = []; readonly active: WindSource[] = [];
  /** what went to the particles this frame (nearest the view first, ≤ WIND_GPU_MAX) — the solver gets `active` and culls per domain itself */
  readonly forParticles: WindSource[] = [];
  private storm: WindSource; private scratch: Vec3 = [0, 0, 0]; private scratchW: Vec3 = [0, 0, 0];
  constructor(private g: Game) {
    for (const v of g.level.vents ?? []) {
      const dir = v3.normalize(v.dir); const size = v.size ?? VENT_DEFAULTS.size; const dMax = WIND_FIELD.cutK * v.reach; const tanSpread = Math.tan(Math.max(0, Math.min(89, v.spread)) * DEG); const r0 = WIND_FIELD.coreK * size;
      const bc: Vec3 = v3.mad(v.pos, dir, dMax / 2); const br = Math.hypot(dMax / 2, r0 + dMax * tanSpread) * 1.05 + 0.3;   // a sphere round the cone's support (+ the wall jet's skirt)
      this.all.push({ kind: 'jet', why: 'vent', name: v.name, vent: v, pos: v3.copy(v.pos), dir, speed: 0, base: v.speed, on: 1, gust: 1, reach: v.reach, tanSpread, r0, dMax, floorY: 0, bound: { c: bc, r: br }, seed: hashStr(v.name) });   // TODO(G2): floorY = the vent's floor's y once floors carry more than one
    }
    this.storm = { kind: 'storm', why: 'storm', name: 'storm', pos: [0, 0, 0], dir: [1, 0, 0], speed: 0, base: 0, on: 1, gust: 1, reach: 0, tanSpread: 0, r0: 0, dMax: 0, interior: [...INTERIOR], annex: [...ANNEX], bound: { c: [cx, 1, cz], r: 1e6 }, seed: hashStr('storm') };
    this.all.push(this.storm);
    for (const d of g.doors.list) {
      if (!d.def.exterior) continue;
      const cd = d.def.closedDir; const n1: Vec3 = [-Math.sin(cd), 0, Math.cos(cd)];
      const fc = d.frameCentre; const inward: Vec3 = inRect(fc[0] + n1[0], fc[2] + n1[2], INTERIOR) ? n1 : [-n1[0], 0, -n1[2]];
      if (inRect(fc[0] - inward[0], fc[2] - inward[2], ANNEX)) continue;   // its outside is the roofed stair tower (the QRF's west door): no weather blows in from there
      const reach = WIND.doorReach, dMax = WIND_FIELD.cutK * reach, tanSpread = Math.tan(WIND.doorSpreadDeg * DEG), r0 = d.def.width * 0.4;
      const pos: Vec3 = [fc[0] - inward[0] * 0.15, 1.05, fc[2] - inward[2] * 0.15];   // just outside the frame, chest height: the gust comes IN through the opening
      this.all.push({ kind: 'jet', why: 'door', name: 'door:' + d.def.name, door: d, pos, dir: inward, speed: 0, base: 0, on: 1, gust: 1, reach, tanSpread, r0, dMax, bound: { c: v3.mad(pos, inward, dMax / 2), r: Math.hypot(dMax / 2, r0 + dMax * tanSpread) + 0.3 }, seed: hashStr('door:' + d.def.name) });
    }
  }
  /** the storm's wind vector this frame before gusting (m/s), or null when there is none: weather off, day, or a dead calm */
  /** the storm's wind vector when it should be felt (weather on, night, the storm knob up, rain or storm actually running, a real speed) — null otherwise; glassbreak's gusts through shot-out panes ask the same question (one test) */
  stormWind(): Vec3 | null {
    const g = this.g; const W = g.weather;
    if (!W || !W.enabled || isDaylight(g) || !WIND.storm) return null;
    if (!(W.rainRate > 0.001 || W.storm > 0.01)) return null;
    const wx = W.wind[0] * WIND.stormK, wz = W.wind[1] * WIND.stormK; if (!(Math.hypot(wx, wz) >= 0.05)) return null;   // (× stormK FIRST: a zero knob is a dead calm, not a NaN direction)
    return [wx, 0, wz];
  }

  /** Once a frame (game.ts, after the weather and the doors): every source's speed for this frame, the active list, and the hand-off to both GPU consumers. */
  update(dt: number) {
    const g = this.g; const master = windOf(g);
    const P = gpuFx(g); const S = g.smoke;
    this.active.length = 0; this.forParticles.length = 0;
    if (master <= 0) { P?.setWind(this.forParticles, KNOBS0); S.setWind?.(this.active, WIND.smokeRelax); return; }   // 0 = still air everywhere: nothing packed, nothing forced, nothing evaluated
    WIND_STATS.frames++;
    const t = g.time; const gustOn = WIND.gusts;
    const sw = this.stormWind(); const stormSpeed = sw ? Math.hypot(sw[0], sw[2]) : 0;
    if (sw) WIND_STATS.stormFrames++;
    for (const s of this.all) {
      let base = 0, target = 1;
      if (s.why === 'vent') {
        const v = s.vent!;
        base = WIND.vents ? v.speed * WIND.ventK : 0;
        if (v.period && v.period > 0) { const duty = v.duty ?? VENT_DEFAULTS.duty; const ph = (((t - (v.phase ?? 0)) / v.period) % 1 + 1) % 1; if (ph > duty) target = 0; }   // cycling: on for `duty` of each period from `phase`
        if ((v.mains ?? VENT_DEFAULTS.mains) && g.blackout.active) target = 0;                                                                                     // the air handler is on the breaker
        const rate = target > s.on ? 1 / Math.max(0.1, WIND.rampUp) : 1 / Math.max(0.1, WIND.rampDown);
        s.on += Math.max(-rate * dt, Math.min(rate * dt, target - s.on));
        s.gust = gustOn ? 1 + WIND.gustAmp * vnoise(s.seed, t / WIND.gustPeriod) : 1;
      } else if (s.why === 'storm') {
        if (!sw) { s.speed = 0; s.base = 0; continue; }
        base = stormSpeed; s.dir[0] = sw[0] / stormSpeed; s.dir[1] = 0; s.dir[2] = sw[2] / stormSpeed; s.on = 1;
        s.gust = gustOn ? 1 + WIND.stormGustAmp * vnoise(s.seed, t / WIND.stormGustPeriod) : 1;
      } else if (s.why === 'glass') {   // GLASS BREAKING: a jet in through a shot-out exterior pane — its speed this frame is what glassbreak.ts last wrote into `base` (0 while the pane is under a quarter open or the storm is still); gusting like a vent
        base = s.base; s.on = 1;
        s.gust = gustOn ? 1 + WIND.gustAmp * vnoise(s.seed, t / (0.6 * WIND.gustPeriod)) : 1;
      } else {   // a door: ∝ how far its leaf stands open × the storm at that face (a third of it whatever the bearing: an open door in a gale draws)
        const d = s.door!;
        if (!sw || !WIND.doors) { s.speed = 0; s.base = 0; continue; }
        const open = Math.min(1, Math.abs(d.angle) / WIND.doorOpenRad); if (open < 0.04) { s.speed = 0; s.base = 0; continue; }
        const facing = Math.max(0, (sw[0] * s.dir[0] + sw[2] * s.dir[2]) / stormSpeed);
        base = stormSpeed * WIND.doorK * open * (0.35 + 0.65 * facing); s.on = 1;
        s.gust = gustOn ? 1 + WIND.stormGustAmp * vnoise(s.seed, t / WIND.stormGustPeriod) : 1;
        WIND_STATS.doorGusts++;
      }
      s.base = base; s.speed = base * s.on * s.gust * master;
      if (s.speed > 0.005) this.active.push(s); else s.speed = 0;
    }
    WIND_STATS.active += this.active.length;
    // the particles get the jets nearest the view's look-at point (their particles are where the camera is; a leaf trembling off screen is nobody's loss) + the storm; the
    // solver gets every active source and keeps the ones over its live domains (smoke off screen still bends — a guard may be looking through it)
    if (P) {
      const f = g.engine.viewFocus ?? g.player.char.pos;
      for (const s of this.active) if (s.kind === 'jet' && v3.dist(s.bound.c, f) < WIND.nearM + s.bound.r) this.forParticles.push(s);
      if (this.forParticles.length > WIND_GPU_MAX - (sw ? 1 : 0)) { this.forParticles.sort((a, b) => v3.dist(a.bound.c, f) - v3.dist(b.bound.c, f)); this.forParticles.length = WIND_GPU_MAX - (sw ? 1 : 0); }
      if (sw && this.storm.speed > 0) this.forParticles.push(this.storm);
      P.setWind(this.forParticles, [WIND.sheetWake, WIND.sheetKick, WIND.debrisK]);
      WIND_STATS.toParticles += this.forParticles.length;
    }
    if (S.setWind) { S.setWind(this.active, WIND.smokeRelax); WIND_STATS.toSmoke += this.active.length; }
  }

  /** The air's velocity at p this frame (m/s): the sum over every active source — what the GPU consumers evaluate, on the CPU (the moths, the panel, the probes). */
  at(p: Vec3, out: Vec3 = [0, 0, 0]): Vec3 {
    WIND_STATS.atCalls++;
    out[0] = 0; out[1] = 0; out[2] = 0; const q = this.scratch, w = this.scratchW;
    for (const s of this.active) {
      if (s.kind === 'storm') { w[0] = s.dir[0] * s.speed; w[1] = 0; w[2] = s.dir[2] * s.speed; stormVel(w, s.interior!, s.annex!, p, q); }
      else jetVel(s.pos, s.dir, s.speed, s.reach, s.tanSpread, s.r0, s.dMax, s.floorY ?? -1e9, p, q);
      out[0] += q[0]; out[1] += q[1]; out[2] += q[2];
    }
    return out;
  }
  /** the source called `name` (a vent's id, 'storm', 'door:<door>') */
  byName(name: string): WindSource | undefined { return this.all.find(s => s.name === name); }
  /** one line per source for the panel / probes */
  describe(): string[] { return this.all.map(s => `${s.name.padEnd(18)} ${s.speed > 0 ? 'ON ' : 'off'} speed ${s.speed.toFixed(2)} (base ${s.base.toFixed(2)} × on ${s.on.toFixed(2)} × gust ${s.gust.toFixed(2)})`); }
  summary(): string {
    const g = this.g; const m = windOf(g); const P = gpuFx(g); const ss = (g.smoke as { stats?: { windSrcs?: number; windDomains?: number } }).stats;
    return `wind ${m.toFixed(2)}${m <= 0 ? ' (still air)' : ''} · ${this.active.length}/${this.all.length} sources blowing (${this.active.filter(s => s.why === 'vent').length} vents${this.storm.speed > 0 ? `, storm ${this.storm.speed.toFixed(1)} m/s` : ''}${this.active.some(s => s.why === 'door') ? `, ${this.active.filter(s => s.why === 'door').length} door gust(s)` : ''}) · particles ${P ? `${P.stats.winds} records, ${P.stats.windWoken} leaves picked up` : 'off'} · solver ${ss ? `${ss.windSrcs ?? 0} sources over ${ss.windDomains ?? 0} domains` : 'off'}`;
  }
}
const KNOBS0: [number, number, number] = [WIND.sheetWake, WIND.sheetKick, WIND.debrisK];
