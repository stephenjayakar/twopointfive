// Weather (E10): a night storm over the level — rain in the lot and outside every window, lightning that throws every window's shape across the floor through the
// ordinary direct pass, thunder rolled in after the light by the distance, and a wet and glossy car park. One object on the Game (game.weather), stepped from
// Game.update; nothing here is level geometry (the interior footprint below mirrors audio.ts's own outdoors test) and nothing persists past setEnabled(false),
// which puts the boxes it touched back as they were. (The experiment's ground mist at the fire exit — a live smoke domain, +11 ms in its worst view — was cut at
// the merge by the designer's call; the storm touches the smoke solver nowhere now.)
//
//   RAIN       is drawn, not simulated: volumetrics.wgsl (c) evaluates a lattice of falling streaks along every view ray that ends outdoors, lit by the local
//              lights. This file only feeds it numbers through engine.weather (render/frame.ts WeatherFrame): rate, wind shear, wetness, the sky flash.
//   LIGHTNING  a stroke is ONE directional light of kind 2 added to the LightSet for a third of a second — the daylight sun's path (lighting.ts setDaylight)
//              made transient: RtLight.transient keeps it out of every accumulated signal exactly as a muzzle flash is, so the cascades / gather history never
//              see it and nothing ghosts; the history-free direct pass traces its shadow rays like the moon's, so mullions and frames print on the floor for
//              free; volumetrics march it under the roof (window shafts) and the outdoor air takes the lit-sky term. Its intensity follows a two-return-stroke
//              envelope integrated over each frame (a 20 ms pulse still delivers its energy at 20 fps). The AI is not told about it — but the light is real:
//              Sam's meter and the guards' eyes read the probe's irradiance, so a man looking his way past a window CAN glimpse him in a flash (EXPERIMENT.md
//              has the integrator's numbers: one stroke on a still man in the open is worth ~0.1 awareness, under the 0.3 it takes to make a guard say 'huh?').
//   THUNDER    scheduled at the stroke for distance / 343 s later: sfx.ts 'thunderNear' / 'thunderFar' (crack + clap + a long rolled rumble), low-passed and
//              stretched with distance, non-positional with a lean toward the bearing. It is ambience: no GameEvent, nobody hears it as anything. Now and then a
//              calm man on screen passes a remark (one bark site, a long cooldown).
//   WET LOT    while it rains the asphalt slab is darkened and flagged BoxFlag.Gloss (the glossy-floor experiment then mirrors the lamps, the bollards and the lit
//              facade in it — not the strokes, which stay out of the gloss term like out of everything with history — settings.gloss is switched on with the
//              storm and put back after), eased in over WET_SECS.
import { Vec3, v3, clamp } from '../math/vec';
import type { Game, Guard } from './game';
import type { RtLight } from '../render/lights';
import { noWeather } from '../render/frame';
import type { WeatherFrame } from '../render/frame';
import { BoxFlag } from '../scene/boxes';
import type { Box } from '../scene/boxes';
import { isDaylight } from './lighting';
import { onScreen } from './guards';

/** the interior footprint (x0, z0, x1, z1): rays ending inside it draw no rain; the same box audio.ts calls indoors */
export const INTERIOR: [number, number, number, number] = [4, 4, 36, 24];
/** the one roofed piece of the level outside that footprint: the west stair tower's landing the QRF comes up (officeGen: walls x 1.1‥4, z 9.33‥12.87, roof slab
 *  over it) — rays ending on its floor draw no rain either. TODO(level-format lane): both rectangles belong in LevelData with the QRF marks. */
export const ANNEX: [number, number, number, number] = [1.1, 9.33, 4.0, 12.87];
const RAIN_TOP = 7.0;            // streaks below this (m): over the sodium heads (5 m), well under the camera
const RAIN_V = 9.0;              // fall speed the shader animates with (m/s) — −wind ÷ this = the streaks' shear (see update())
const WET_SECS = 20;             // dry → fully wet (and back) over this long
const WET_ROUGH = 0.22;          // wet asphalt for the RT reflection pass (Box.rough while it rains; the dry slab keeps whatever the level gave it — 0.92 in the office): a water film over aggregate, glossy but not a mirror
const WET_ALBEDO = 0.5;          // wet asphalt: darker (the water film kills the diffuse scatter off the aggregate) — and glossy (BoxFlag.Gloss; fgather.wgsl boosts the coat outdoors by the wetness)
const SPEED_OF_SOUND = 343;
/** lightning: peak irradiance of the first return stroke on a surface square to it (the daylight sun is 8; a close stroke outshines it for its few milliseconds) */
const FLASH_PEAK = 18;
const FLASH_COLOR: Vec3 = [0.78, 0.86, 1.0];   // ≈ 9000 K
const FLASH_SECS = 0.5;          // envelope support: two return strokes and the odd third flicker (below) are under 0.1 % of peak by then
/** the sky the stroke lights, as radiance added to outdoor air / rain per unit of stroke irradiance (volumetrics.wgsl weatherB) */
const SKY_FLASH_K = 0.045;
/** mean seconds between strokes at storm intensity 1 (÷ intensity below; clamped to the brief's 8‥25 s band, jittered ×0.5‥1.5) */
const FLASH_MEAN_GAP = 11;
const THUNDER_LINES = ['lovely night for it.', 'that one was close.', "glad I'm not out in that.", "it's really coming down.", 'storm\'s right on top of us.'];
const BARK_COOLDOWN = 45;        // seconds between any two weather remarks on the floor
const BARK_CHANCE = 0.35;        // per thunder loud enough to remark on

/** mulberry32: the weather's own dice (never Math.random — the QA harness seeds that one for the game, and a storm must not shift its sequence). Its one word of
 *  state is readable / writable so a checkpoint carries the storm's schedule on exactly (game/savestate.ts → Weather.snapshot / restore). */
function rng32(seed: number) { const R = { a: seed >>> 0, next: () => { R.a = (R.a + 0x6D2B79F5) >>> 0; const a = R.a; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } }; return R; }
/** the storm in a checkpoint: the knobs, the wetness, the schedule (game time of the next stroke, thunder on its way, the last remark) and the dice's state */
export interface WeatherSnap { on: boolean; storm: number; rainRate: number; wind: [number, number]; wetGloss: boolean; wet: number; nextFlashAt: number; thunders: Thunder[]; lastBarkT: number; rng: number; stats: { flashes: number; thunders: number; barks: number }; }

/** One stroke's light curve: return strokes as instant-rise exponential pulses {t0, amp, tau}; value(t) = Σ amp·e^(−(t−t0)/tau) for t ≥ t0. */
export interface Stroke { pulses: { t0: number; amp: number; tau: number }[]; }
/** mean of the stroke's envelope over [a, b] (what a frame spanning that interval should show — exact for any frame length) */
export function strokeMean(s: Stroke, a: number, b: number): number {
  if (b <= a) return strokeAt(s, a);
  let e = 0;
  for (const p of s.pulses) { const lo = Math.max(a, p.t0); if (b <= lo) continue; e += p.amp * p.tau * (Math.exp(-(lo - p.t0) / p.tau) - Math.exp(-(b - p.t0) / p.tau)); }
  return e / (b - a);
}
export function strokeAt(s: Stroke, t: number): number { let e = 0; for (const p of s.pulses) if (t >= p.t0) e += p.amp * Math.exp(-(t - p.t0) / p.tau); return e; }

export interface Flash { light: RtLight; stroke: Stroke; t: number; peak: number; dir: Vec3; bearing: number; distKm: number; }
export interface Thunder { at: number; distKm: number; bearing: number; loud: number; }

export class Weather {
  /** master switch (?noweather boots with it off; the panel / __weather flip it live). Off = nothing of the above exists: no light, boxes restored, frame zeros. A property, so `__weather.enabled = false` from the console tears down exactly as setEnabled(false) does. */
  get enabled(): boolean { return this.on; }
  set enabled(v: boolean) { this.setEnabled(v); }
  private on = true;
  /** storm intensity 0‥1: stroke frequency (mean gap FLASH_MEAN_GAP ÷ this, clamped 8‥25 s) and nearness, wind, the rain bed's level */
  storm = 0.7;
  /** rain rate 0‥1: the fraction of the streak lattice falling (0 = a dry storm: lightning without rain) */
  rainRate = 0.55;
  /** wind (m/s, x / z): the streaks lean by wind ÷ RAIN_V */
  wind: [number, number] = [1.1, 0.45];
  /** switch the glossy-floor experiment on with the wet lot (and back off after) — the wet asphalt then mirrors the lamps, the bollards, the lit facade (not the
   *  strokes: transient lights stay out of the gloss term's light loops like out of every accumulated signal), and the polished floors indoors reflect too */
  wetGloss = true;
  /** current wetness 0‥1 (eases toward rainRate > 0 ? 1 : 0) */
  wet = 0;
  /** the stroke in progress (its light is in the LightSet while this is set), the thunder still on its way, when the next stroke is due (game time) */
  flash: Flash | null = null;
  thunders: Thunder[] = [];
  nextFlashAt = -1;
  /** counters for the probes / panel: strokes fired, thunder played, remarks made, the last thunder's numbers */
  stats = { flashes: 0, thunders: 0, barks: 0, lastThunder: null as (Thunder & { playedAt: number; name: string; gain: number }) | null };
  private dice = rng32(20260809); private rnd = () => this.dice.next();
  private lastBarkT = -1e9;
  private suspended = false;         // day (the breach showcase): the storm holds — no strokes, no rain; back as it was when night returns
  private touched: { box: Box; albedo: Vec3; flags: number; rough: number | undefined; aniso: boolean | undefined }[] = [];   // boxes the wet lot changed, with what to put back (the finish too: the RT reflection pass reads Box.rough / aniso)
  private glossWas: boolean | null = null;   // settings.gloss before the storm switched it on (null = we have not touched it)

  constructor(private g: Game) { this.wet = this.rainRate > 0 ? 1 : 0; }   // it has been raining all night: the lot starts wet, not drying in front of the player over the first twenty seconds

  /** the weather's dice, reseeded (probes: same seed → same strokes, bearings, distances, remarks) */
  seed(n: number) { this.dice = rng32(n); this.nextFlashAt = -1; }

  /** for a checkpoint (game/savestate.ts): everything the storm's next minutes hang on — a stroke in progress is not carried (a quarter second of light: the load ends any) */
  snapshot(): WeatherSnap { return { on: this.on, storm: this.storm, rainRate: this.rainRate, wind: [this.wind[0], this.wind[1]], wetGloss: this.wetGloss, wet: this.wet, nextFlashAt: this.nextFlashAt, thunders: this.thunders.map(t => ({ ...t })), lastBarkT: this.lastBarkT, rng: this.dice.a, stats: { flashes: this.stats.flashes, thunders: this.stats.thunders, barks: this.stats.barks } }; }
  restore(s: WeatherSnap) {
    const f = (x: number, d: number) => Number.isFinite(x) ? x : d;
    this.endFlash();   // (on / off stays the SESSION's — ?noweather, the panel — the file's `on` is kept for the record only)
    this.storm = f(s.storm, this.storm); this.rainRate = f(s.rainRate, this.rainRate); this.wind = [f(s.wind?.[0], this.wind[0]), f(s.wind?.[1], this.wind[1])]; this.wetGloss = s.wetGloss !== false; this.wet = f(s.wet, this.wet);
    this.nextFlashAt = f(s.nextFlashAt, -1); this.thunders = (s.thunders ?? []).map(t => ({ at: f(t.at, 0), distKm: f(t.distKm, 1), bearing: f(t.bearing, 0), loud: f(t.loud, 0.5) })); this.lastBarkT = f(s.lastBarkT, -1e9);
    if (Number.isFinite(s.rng)) this.dice.a = s.rng >>> 0;
    if (s.stats) { this.stats.flashes = s.stats.flashes | 0; this.stats.thunders = s.stats.thunders | 0; this.stats.barks = s.stats.barks | 0; }
  }

  setEnabled(on: boolean) {
    if (on === this.on) return;
    this.on = on;
    if (!on) this.teardown(); else this.wet = this.rainRate > 0 ? 1 : 0;
  }

  /** Fire a stroke now (the panel's button, the probes, the tour if it ever wants one). bearing: radians, 0 = from the north (+z toward −z… see dirOf); distKm sets the thunder's delay and colour of sound. */
  strike(opts: { bearing?: number; elevDeg?: number; distKm?: number; peak?: number } = {}): Flash | null {
    if (!this.on || this.suspended) return null;
    if (this.flash) this.endFlash();
    const r = this.rnd;
    const bearing = opts.bearing ?? r() * Math.PI * 2;
    const elev = (opts.elevDeg ?? (24 + r() * 30)) * Math.PI / 180;
    const distKm = opts.distKm ?? (0.3 + Math.pow(r(), 1.3) * 3.7 * (1.15 - 0.5 * this.storm));   // a heavier storm sits closer
    const peak = opts.peak ?? FLASH_PEAK * (0.55 + 0.9 * r()) * clamp(1.25 - distKm * 0.18, 0.45, 1.2);
    // two return strokes, sometimes a third flicker: instant rise, 22 ms and 50 ms decays, 85 ms apart (the brief's ~60 + 120 ms)
    const stroke: Stroke = { pulses: [{ t0: 0, amp: 1, tau: 0.022 }, { t0: 0.085, amp: 0.35 + 0.45 * r(), tau: 0.05 }] };
    if (r() < 0.3) stroke.pulses.push({ t0: 0.2 + 0.05 * r(), amp: 0.25 + 0.25 * r(), tau: 0.03 });
    const dir = dirOf(bearing, elev);
    const light: RtLight = {
      name: 'lightning', group: 'weather', kind: 2, pos: [0, 0, 0], dir, color: v3.copy(FLASH_COLOR), intensity: 0, range: 1e6, innerDeg: 0, outerDeg: 0,
      radius: 0.006,          // angular radius (rad): a channel is a line, not a disc — frames and mullions print hard (3 cm of penumbra over five metres of throw, under a mullion's own width; at 0.012 the lobby's bars washed out by the couch)
      volumetric: 1.3,        // marched under the roof like the sun (volumetrics.wgsl kind 2): the window shafts flash with the floor
      owner: 0, enabled: true, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: peak,
      transient: true,        // lights.ts: the kind word's transient bit without the ttl envelope — out of the cascades / gather history, lit through the direct pass only
    };
    this.g.engine.lights.add(light);
    this.flash = { light, stroke, t: 0, peak, dir, bearing, distKm };
    this.thunders.push({ at: this.g.time + distKm * 1000 / SPEED_OF_SOUND, distKm, bearing, loud: clamp(1.15 - distKm * 0.22, 0.25, 1) });
    this.stats.flashes++;
    this.applyFlash(0, 1 / 60);   // lit from this very frame (update() has already run, or runs next and re-integrates)
    return this.flash;
  }

  private camYaw = 0;
  /** once a frame from Game.update (after the fixtures, before the light-meter queries); camYaw = the follow camera's yaw (which ear the thunder leans to) */
  update(dt: number, camYaw = 0) {
    const g = this.g; this.camYaw = camYaw;
    const frame: WeatherFrame = ((g.engine as { weather?: WeatherFrame }).weather ??= noWeather());   // (the QA harness's engine stand-in has none until now)
    if (!this.on) { zero(frame); return; }
    // day (the breach): the storm holds still and shows nothing — no stroke, no thunder, no wet lot, no rain bed; the night gets it back as it was
    const day = isDaylight(g);
    if (day !== this.suspended) { this.suspended = day; if (day) { if (this.flash) this.endFlash(); this.thunders.length = 0; this.setWet(false); g.audio.rain?.(0); } this.nextFlashAt = -1; }
    if (this.suspended) { zero(frame); return; }
    const raining = this.rainRate > 0.001;
    // wetness eases in / out; the lot's boxes follow it past a threshold (one flip each way, not a per-frame albedo animation the grid would not notice anyway)
    this.wet = clamp(this.wet + (raining ? dt : -dt) / WET_SECS, 0, 1);
    this.setWet(this.wet > 0.02);
    // ---- strokes
    if (this.nextFlashAt < 0) this.nextFlashAt = g.time + this.gap(true);
    if (this.storm > 0.01 && g.time >= this.nextFlashAt) { this.strike(); this.nextFlashAt = g.time + this.gap(false); }
    // the stroke in progress: THIS frame shows the envelope over [t, t + dt] (a stroke fired just above starts at t = 0, so its first, brightest interval is the
    // one drawn), then the clock moves on; once t has passed FLASH_SECS every interval worth drawing has been drawn and the light leaves the set
    if (this.flash) { const f = this.flash; if (f.t >= FLASH_SECS) this.endFlash(); else { this.applyFlash(f.t, dt); f.t += dt; } }
    // ---- thunder
    for (let i = this.thunders.length - 1; i >= 0; i--) { const th = this.thunders[i]; if (g.time >= th.at) { this.thunders.splice(i, 1); this.playThunder(th); } }
    // ---- the rain bed follows the rate and where the listener stands (outdoors full, indoors a third — the mixer has no windows to open); indoors = the building OR
    //      the roofed stair tower, the two rectangles the rain itself is drawn by (= wet.ts underRoofRect — inlined, wet.ts imports this module; review U9.9)
    const pp = g.player.char.pos; const inR = (r: [number, number, number, number]) => pp[0] >= r[0] && pp[2] >= r[1] && pp[0] <= r[2] && pp[2] <= r[3];
    const out = !(inR(INTERIOR) || inR(ANNEX));
    g.audio.rain?.(raining ? (0.35 + 0.65 * this.rainRate) * (out ? 1 : 0.32) : 0);
    // ---- what the frame draws
    frame.rain = raining ? this.rainRate : 0;
    frame.shearX = -this.wind[0] / RAIN_V; frame.shearZ = -this.wind[1] / RAIN_V;   // MINUS: a lattice column stands at base + K·y and its drop slides DOWN it toward −K, so for the drop to be carried WITH the wind K = −wind ÷ fall speed (it was +, and the far-field rain drifted against the storm that moves the smoke and the paper — found by the particle-rain lane, 08-12)
    frame.wet = this.wet;
    const fl = this.flash ? this.flash.light.intensity * SKY_FLASH_K : 0;
    frame.flash = [FLASH_COLOR[0] * fl, FLASH_COLOR[1] * fl, FLASH_COLOR[2] * fl];
    frame.rainTop = RAIN_TOP;
    frame.interior = INTERIOR;
    frame.annex = ANNEX;
  }

  /** seconds to the next stroke: mean FLASH_MEAN_GAP ÷ storm clamped to 8‥25 s, ×0.5‥1.5; the first one of a night comes sooner (6‥12 s) so a visitor standing at the windows is not kept waiting */
  private gap(first: boolean): number {
    if (first) return 6 + 6 * this.rnd();
    const mean = clamp(FLASH_MEAN_GAP / Math.max(this.storm, 0.05), 8, 25);
    return mean * (0.5 + this.rnd());
  }
  private applyFlash(t: number, dt: number) {
    const f = this.flash!; f.light.intensity = f.peak * strokeMean(f.stroke, t, t + Math.max(dt, 1e-4)); f.light.enabled = f.light.intensity > 1e-3 * f.peak;
  }
  private endFlash() { const f = this.flash; if (!f) return; this.g.engine.lights.remove(f.light); this.flash = null; }

  private playThunder(th: Thunder) {
    const g = this.g;
    // near: the crack and the clap on top of the roll; far: the roll alone, darker and slower. Low-passed further with every kilometre, leaned toward the bearing.
    const near = th.distKm < 1.3;
    const name = near ? 'thunderNear' : 'thunderFar';
    const gain = (near ? 1.0 : 0.85) * th.loud * (0.6 + 0.4 * this.storm);
    const lowpass = clamp(9000 * Math.exp(-th.distKm * 0.75), 500, 9000);
    const rate = clamp(1.02 - th.distKm * 0.06, 0.78, 1.02) * (0.96 + 0.08 * this.rnd());
    const cy = Math.cos(this.camYaw), sy = Math.sin(this.camYaw);         // pan: the bearing against where the camera faces this frame
    const bx = Math.sin(th.bearing), bz = -Math.cos(th.bearing);           // unit vector TOWARD the storm cell (flat; dirOf's convention: bearing 0 = north = −z)
    const right = bx * cy - bz * sy;                                        // (camera right = (cos yaw, 0, −sin yaw) for forward (−sin, ·, −cos))
    g.audio.play(name, null, gain, { lowpass, rate, pan: clamp(right * 0.6, -0.6, 0.6), wet: near ? 0.35 : 0.55 });
    this.stats.thunders++; this.stats.lastThunder = { ...th, playedAt: g.time, name, gain };
    // somebody passes a remark: a calm, free man of the staff whose head is on screen — a bubble, never the log — not too often. The three dice for it are thrown
    // on EVERY thunder, whoever is on screen, so the stroke schedule after it never depends on where the camera happened to be (same seed → same storm).
    const rBark = this.rnd(), rWho = this.rnd(), rLine = this.rnd();
    if (th.loud > 0.45 && g.time - this.lastBarkT > BARK_COOLDOWN && rBark < BARK_CHANCE) {
      const cands = g.guards.filter((gd: Guard) => gd.state === 'patrol' && !gd.held && !gd.script && !gd.unit && gd.awareness < 0.2 && onScreen(g, gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.7, 0])));
      if (cands.length) {
        const gd = cands[Math.floor(rWho * cands.length) % cands.length];
        g.say(gd, THUNDER_LINES[(this.stats.barks + Math.floor(rLine * 2)) % THUNDER_LINES.length]);
        this.stats.barks++; this.lastBarkT = g.time;
      }
    }
  }

  /** The wet lot: the asphalt slab darkened + BoxFlag.Gloss (and settings.gloss on, if wetGloss), or everything put back. Idempotent both ways. */
  private wetOn = false;
  private setWet(on: boolean) {
    if (on === this.wetOn) return;
    this.wetOn = on;
    const g = this.g; const S = g.engine.settings as { gloss?: boolean };
    if (on) {
      const st: Box[] = g.engine.world.statics;
      // the lot's ground: the one big slab whose top is the y = 0 the cars stand on (found by shape, not index — the level is being moved to data; a stage without
      // one, the viewer's, simply has nothing to wet). BoxWorld.upload repacks every box each frame, so the new albedo / flag reach the GPU on the next one.
      const asphalt = st.find(b => b.c[1] < 0 && b.c[1] + b.h[1] > -0.01 && b.h[0] > 18 && b.h[2] > 12);   // (40 × 28 m: the interior carpet base is 32 × 20 and must never match)
      if (asphalt) { this.touched.push({ box: asphalt, albedo: v3.copy(asphalt.albedo), flags: asphalt.flags, rough: asphalt.rough, aniso: asphalt.aniso }); asphalt.albedo = [asphalt.albedo[0] * WET_ALBEDO, asphalt.albedo[1] * WET_ALBEDO, asphalt.albedo[2] * WET_ALBEDO * 1.04]; asphalt.flags |= BoxFlag.Gloss; asphalt.rough = WET_ROUGH; asphalt.aniso = true; }   // (+ the finish the RT reflection pass reads: standing water at WET_ROUGH, its lobe stretched along the view — the sodium lamp becomes a streak, settings.rtAniso says how long)
      if (this.wetGloss && S.gloss !== undefined && this.glossWas === null) { this.glossWas = S.gloss; S.gloss = true; }
    } else {
      for (const t of this.touched) { t.box.albedo = t.albedo; t.box.flags = t.flags; if (t.rough === undefined) delete t.box.rough; else t.box.rough = t.rough; if (t.aniso === undefined) delete t.box.aniso; else t.box.aniso = t.aniso; }
      this.touched.length = 0;
      if (this.glossWas !== null) { if (S.gloss === true) S.gloss = this.glossWas; this.glossWas = null; }   // (only if it is still what we set: a gloss switched off by hand during the storm stays off)
    }
  }

  /** everything off and put back: the stroke's light out of the set, thunder forgotten, boxes restored, gloss as it was, the frame zeroed, the rain bed silent */
  private teardown() {
    this.endFlash(); this.thunders.length = 0; this.nextFlashAt = -1; this.setWet(false); this.wet = 0;
    const frame = (this.g.engine as { weather?: WeatherFrame }).weather; if (frame) zero(frame);
    this.g.audio.rain?.(0);
  }

  /** one line for the panel / probes */
  summary(): string {
    const f = this.flash; const th = this.thunders[0];
    return `${this.enabled ? (this.suspended ? 'held (day)' : 'storm ' + this.storm.toFixed(2)) : 'off'} · rain ${this.rainRate.toFixed(2)} wet ${this.wet.toFixed(2)} · ${f ? `STROKE ${f.t.toFixed(2)} s I=${f.light.intensity.toFixed(1)}` : `next stroke in ${Math.max(0, this.nextFlashAt - this.g.time).toFixed(0)} s`}${th ? ` · thunder in ${(th.at - this.g.time).toFixed(1)} s (${th.distKm.toFixed(1)} km)` : ''} · ${this.stats.flashes} strokes ${this.stats.thunders} thunders ${this.stats.barks} remarks`;
  }
}

/** direction the light TRAVELS (Light.dir) for a stroke seen at compass bearing `bearing` (0 = north, +z south… the level's +Z is south: bearing 0 puts the cell
 *  north of the building, π/2 east) and elevation `elev` above the horizon */
function dirOf(bearing: number, elev: number): Vec3 {
  const to: Vec3 = [Math.sin(bearing) * Math.cos(elev), Math.sin(elev), -Math.cos(bearing) * Math.cos(elev)];   // unit vector from the ground TOWARD the stroke
  return [-to[0], -to[1], -to[2]];
}
function zero(f: WeatherFrame) { f.rain = 0; f.wet = 0; f.flash = [0, 0, 0]; f.shearX = 0; f.shearZ = 0; }
