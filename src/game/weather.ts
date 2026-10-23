// Weather (E10): a night storm over the level — rain in the lot and outside every window, lightning that throws every window's shape across the floor through the
// ordinary direct pass, thunder rolled in after the light by the distance, and a wet and glossy car park. One object on the Game (game.weather), stepped from
// Game.update; nothing here is level geometry (the interior footprint below mirrors audio.ts's own outdoors test) and nothing persists past setEnabled(false),
// which puts the boxes it touched back as they were. (The experiment's ground mist at the fire exit — a live smoke domain, +11 ms in its worst view — was cut at
// the merge by the maintainer's call; the storm touches the smoke solver nowhere now.)
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
import { WORLD } from '../scene/world';
import { hourWeatherChanged } from './hours';   // (called inside setKind only)
import { WEATHER_BOOT, WX_OWN, WEATHER_PRESETS, isAnyKind, snowLevel, packFog, unpackFog, fogGlowWord, fogTau, packRect, unpackRect, inRect } from './weatherKinds';
import type { WeatherKind, Rect, FogSpec } from './weatherKinds';
import { WORDS } from './words';   // (a leaf: the dialogue pass's one switch)
import { levelNameOf } from '../scene/levelLoad';   // (asked inside levelKind only)

// ---- WEATHER KINDS (weatherKinds.ts; `?weather=<kind>`, the mission list's Weather row). `Weather.kind` null = everything in this file exactly as it was: the night
// storm, the two office footprints below, and NOTHING of the simulation touched (hearMask and airTrans answer exactly 1). With a kind set:
//   ROOFS      the no-rain footprints are the LEVEL's own ceiling slabs (roofsOf: up to four — the compound's yard and the barracks' courtyard are open sky), for the
//              rain drawn, the wet men, the rain bed in the mixer, the wind and the fog alike; the renderer gets the first two as before (weatherC / D) and the other
//              two packed in spare words of the Frame (frame.ts roofC / roofD → cardCfg.y / .z), so the Frame is the size it was.
//   FOG        one field for picture and simulation (weatherKinds.ts): composite.wgsl draws it along every pixel's ray, vol_common.wgsl thickens the lit haze by it,
//              and airTrans() below is its transmittance along a sight line — guards.ts / roomfight.ts / civilians.ts / devices.ts multiply it into the smoke
//              transmittance they already carry, so fog blinds an eye by the smoke's own thresholds (< 0.3 nothing, 0.3‥0.8 slower).
//   HEARING    rain is NOISE at the listener (it drowns SMALL sounds; a loud one is placed as in dry air: loudLen): hearMask() stretches every sound's path by 1 + WX_SIM.rainK × the very bed level the mixer plays there (full outdoors,
//              a third under a roof), and for WX_SIM.thunderSecs after a near thunder plays by WX_SIM.thunderK more. hearPath() is propagate() with that applied —
//              the one call the hearing model's consumers make.
//   LIGHTNING  was real light already: the renderer's meter and the eyes read it. A downpour simply has more of it, closer. The meter's CPU stand-in (headless
//              always) gets the stroke too, under a picked weather: strokeLight().
//   CLOUD      `Weather.cloud` 0‥1 — for whoever owns the sun and the moon to read; nothing here dims a light. By day hours.ts does (cloudLight: the light on open ground at
//              1 − 0.75 c^3.4 of the hour's own, moved from the sun to the sky as the deck closes, the disc spread and the colours greyed past half cover); the
//              night's moon is left as the level has it.
// The kind rides in the checkpoint (WeatherSnap.kind) and so in a session journal's frame 0: a load / a replay runs under the weather the file was made in.
/** the simulation's weather constants (not knobs: a recording does not carry them) */
export const WX_SIM = { rainK: 1.2, thunderK: 1.5, thunderSecs: 1.4, thunderLoud: 0.45, roofBed: 0.32,
  /** rain drowns SMALL sounds: a gunshot, a charge or a door going in is placed (and a calm man's first beat on it taken) off the path as it is in the air, not the
   *  path the noise at his ears stretched — false = the first cut's behaviour, where rain also blurred where a man puts gunfire (a call left to the maintainer) */
  loudDry: true };
/** the storm's numbers when no kind is picked (the fields' initialisers below — setKind(null) puts them back) */
const LEGACY = { storm: 0.7, rain: 0.55, wind: [1.1, 0.45] as [number, number], cloud: 0.95 };
const ROOF_PAD = 0.06;   // a roof reaches this far past its slab: two slabs a couple of centimetres apart (the office's stair tower and its main roof) leave no strip of sky between them
const NO_RECT: Rect = [1e6, 1e6, -1e6, -1e6];   // a footprint nothing is inside (and no ray crosses)
/** the level's roofs as footprints: its ceiling slabs (render/reach.ts buildInteriorCells's own test), biggest first, at most four (no level has more) */
export function roofsOf(boxes: readonly Box[]): Rect[] {
  const out: Rect[] = [];
  for (const b of boxes) {
    const y0 = b.c[1] - b.h[1], y1 = b.c[1] + b.h[1];
    if (!(y0 >= WORLD.ceilingY - 0.25 && y1 <= WORLD.ceilingY + 0.45) || b.h[0] < 0.45 || b.h[2] < 0.45) continue;
    out.push([b.c[0] - b.h[0] - ROOF_PAD, b.c[2] - b.h[2] - ROOF_PAD, b.c[0] + b.h[0] + ROOF_PAD, b.c[2] + b.h[2] + ROOF_PAD]);
  }
  const area = (r: Rect) => (r[2] - r[0]) * (r[3] - r[1]);
  return out.sort((a, b) => area(b) - area(a)).slice(0, 4);
}

/** a ground slab a picked rain wets: its top is the ground everybody stands on (the lot's y = 0, or the base a level's houses stand on a millimetre over it —
 *  room floors lie at 4 mm, grass at a centimetre: neither), it is drawn, it is not small, and some of it has no roof over it (the footprints the rain is drawn by) */
function openGround(b: Box, roofs: readonly Rect[]): boolean {
  const top = b.c[1] + b.h[1];
  if (!(top > -0.011 && top < 0.003) || b.h[0] * b.h[2] < 4 || (b.flags & (BoxFlag.NoPrimary | BoxFlag.Glass | BoxFlag.Dynamic)) !== 0) return false;
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
    const x = b.c[0] + b.h[0] * (i - 2) * 0.45, z = b.c[2] + b.h[2] * (j - 2) * 0.45;
    if (!roofs.some(r => inRect(r, x, z))) return true;
  }
  return false;
}

/** a level that carries its own places (a quiet mission: its file's scenarios.quiet — scene/scenarios.ts): the office's footprints below are not its building's */
const ownFloor = (g: Game): boolean => !!g.level?.scenarios?.quiet;
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
/** in place of "glad I'm not out in that." from a man who IS out in it (words.ts) */
const THUNDER_OUT = "it's not letting up, huh.";
const BARK_COOLDOWN = 45;        // seconds between any two weather remarks on the floor
const BARK_CHANCE = 0.35;        // per thunder loud enough to remark on

/** mulberry32: the weather's own dice (never Math.random — the QA harness seeds that one for the game, and a storm must not shift its sequence). Its one word of
 *  state is readable / writable so a checkpoint carries the storm's schedule on exactly (game/savestate.ts → Weather.snapshot / restore). */
function rng32(seed: number) { const R = { a: seed >>> 0, next: () => { R.a = (R.a + 0x6D2B79F5) >>> 0; const a = R.a; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } }; return R; }
/** the storm in a checkpoint: the knobs, the wetness, the schedule (game time of the next stroke, thunder on its way, the last remark) and the dice's state */
export interface WeatherSnap { kind?: WeatherKind | null; thunderUntil?: number; on: boolean; storm: number; rainRate: number; wind: [number, number]; wetGloss: boolean; wet: number; nextFlashAt: number; thunders: Thunder[]; lastBarkT: number; rng: number; stats: { flashes: number; thunders: number; barks: number }; }

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
  /** the weather the level was STARTED in (weatherKinds.ts), or null = as it has always been. Set at birth from WEATHER_BOOT, by a checkpoint, or setKind(). */
  kind: WeatherKind | null = null;
  /** the no-rain footprints in force: the office's two when no kind is picked, else the level's own roofs (≤ 4; the 3rd and 4th at the renderer's 0.2 m) */
  roofs: Rect[] = [INTERIOR, ANNEX];
  /** the fog in the air, as the renderer's 32 bits decode it (null = none) — the one set of numbers picture and simulation share */
  fog: FogSpec | null = null;
  private fogWord = 0;
  /** the fog's glow in the PICTURE as a factor of the frame's sky horizon (1 = as packed). hours.ts writes it under an hour: a cloud deck brightens the sky
   *  it scales, and the veil would glow with that instead of with the daylight left. Nothing the simulation reads. */
  fogGlow = 1;
  /** game time until which a thunderclap is drowning the floor's small noises (kinds only) */
  thunderUntil = -1e9;
  /** CLOUD COVER 0‥1: how much of the sky's own light this weather takes. A number to READ — nothing in this file dims the moon or the sun (when no kind is
   *  picked the lights must stay as they are: test `kind` before applying it). */
  get cloud(): number { return !this.on ? 0 : this.kind ? WEATHER_PRESETS[this.kind].cloud : LEGACY.cloud; }
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

  constructor(private g: Game) { const born = this.levelKind() ?? (WEATHER_BOOT.kind === 'snow' ? null : WEATHER_BOOT.kind); if (!born && ownFloor(g)) this.ownNight(); this.wet = this.rainRate > 0 ? 1 : 0; if (born) this.setKind(born); else this.syncRoofs(); }   // (wet from the first frame: it has been raining all night — the lot starts wet, not drying in front of the player over the first twenty seconds)
  /** A LEVEL BUILT FOR SNOW (weatherKinds.ts SNOW_LEVELS, the switch SNOW.on) is born in the kind 'snow' and stays in it: the level's own weather, whatever a
   *  URL or a tool picked for the visit. null = any other level (and every level with the switch off): the rules below, untouched. */
  private levelKind(): WeatherKind | null { return snowLevel(levelNameOf(this.g.level)) && (!WEATHER_BOOT.locked || WEATHER_BOOT.kind === 'snow') ? 'snow' : null; }   // (a page — locked — that was not opened on the snow level has no flake in its shaders: a level of that name loaded into it later stands under the weather any level has)
  /** SNOWFALL 0‥1 (the kind's preset): what game/snowFx.ts draws flakes by. The picture's alone — nothing an eye, an ear or a foot reads. */
  snowRate = 0;
  /** NO WEATHER PICKED ON A FLOOR THAT IS NONE OF THE OFFICE'S (ownFloor): the legacy storm rains by the office's two rectangles, which are another building's —
   *  so such a level's own night is DRY AND STILL (no rain, no strokes, no wind: nothing drawn, nobody wet, nothing blown), under its own roofs for whoever asks.
   *  A picked weather (the mission's row, ?weather=) is the level's own roofs and that kind, as on any level. */
  private ownNight() { this.storm = 0; this.rainRate = 0; this.wind = [0, 0]; this.fogWord = 0; this.fog = null; this.roofs = this.ownRoofs(); }
  /** NO WEATHER PICKED ON A SQUAD LEVEL THAT IS NOT THE OFFICE'S SHELL (weatherKinds.ts WX_OWN.roofs): the level's own storm, every number of it as ever, cut by
   *  the level's OWN roofs — the rain drawn, the wet men, the wind, the rain bed, the wet ground — where it used to be cut by the office's two rectangles (the
   *  records office: no rain on its car park, which lies inside the office's footprint). True while that is in force. The office, and every level whose roofs ARE
   *  the office's two (the block), keep INTERIOR / ANNEX to the bit; a quiet level keeps its dry night (ownNight). The simulation's weather stays out
   *  of it as with any unpicked storm (hearMask / airTrans answer 1). */
  get ownStorm(): boolean { return this.own; }
  private own = false;
  private fits: boolean | null = null;   // do the office's two rectangles fit this level's roofs (asked once: a level's ceiling slabs are authored)
  private officeFit(): boolean {
    if (this.fits === null) {
      const boxes = this.g.level?.boxes; const R = boxes?.length ? roofsOf(boxes) : null;
      const near = (a: Rect, b: readonly number[]) => a.every((v, i) => Math.abs(v - b[i]) < 0.3);
      this.fits = !R || (R.length === 2 && near(R[0], INTERIOR) && near(R[1], ANNEX));   // (no level at all — a bare stage — is nobody's building: as it was)
    }
    return this.fits;
  }
  /** the footprints follow the rule in force (the constructor, setKind, and the top of every update: the switch is live) */
  private syncRoofs(tellWind = false) {
    const g = this.g; const own = !this.kind && WX_OWN.roofs && WEATHER_BOOT.packed && !ownFloor(g) && !this.officeFit();   // (packed: a page whose shaders were compiled without the third and fourth roof's reads keeps the two rectangles — main.ts)
    if (own === this.own && !tellWind) return;
    if (own !== this.own) {
      this.own = own; this.setWet(false);   // (what is wet hangs on the roofs: put the ground back, the next update wets it by the new rule)
      if (!this.kind) this.roofs = own ? this.ownRoofs() : [INTERIOR, ANNEX];   // (a quiet level is never here: its roofs are ownNight's)
    }
    (g as { wind?: { reroof?(r: readonly Rect[] | null, own?: boolean): void } }).wind?.reroof?.(this.kind || own ? this.roofs : null, own);   // (wind.ts is built after this object: its constructor asks for the roofs itself)
  }
  /** `roofs` are THE LEVEL'S OWN and in force — a picked weather, or the level's own storm under WX_OWN — as against the office's two rectangles: the one
   *  question the wind, the drips and the wet ground ask */
  get levelRoofs(): boolean { return !!this.kind || this.own; }
  /** the level's own ceiling slabs as the no-rain footprints (roofs 0 / 1 exact, 2 / 3 as the Frame packs them) */
  private ownRoofs(): Rect[] { return roofsOf(this.g.level?.boxes ?? []).map((r, i) => i < 2 ? r : unpackRect(packRect(r))); }

  /** Put the level in a weather (null = back as it has always been): the preset's storm / rain / wind, the level's own roofs, the fog — from this frame. A stroke
   *  in progress and thunder on its way are dropped; the ground is as wet as if it had been that way all night. */
  setKind(kind: WeatherKind | null): boolean {
    { const own = this.levelKind(); if (own && kind !== own) { console.warn(`weather: this level is in '${own}' and stays in it ('${kind ?? 'the level\'s own'}' was asked for)`); return false; } }   // a level built for snow stays in it: no pick, tool or restored file takes it out (and the page's shaders are that kind's)
    if (WEATHER_BOOT.locked && kind !== WEATHER_BOOT.kind) { console.warn(`weather: this page was opened in '${WEATHER_BOOT.kind ?? 'the level\'s own'}' — open it with ?weather=${kind ?? ''} for another (the renderer's half is compiled at boot)`); return false; }
    const g = this.g; this.setWet(false); this.kind = kind; this.own = false; this.snowRate = 0;   // (what is wet depends on the kind: put the ground back, the next update wets it by the new rule; the footprints are dealt afresh below)
    if (kind && !this.on) this.on = true;   // (a picked weather IS on: the simulation follows it, so the picture must)
    this.endFlash(); this.thunders.length = 0; this.nextFlashAt = -1; this.thunderUntil = -1e9;
    if (kind) {
      const P = WEATHER_PRESETS[kind];
      this.storm = P.storm; this.rainRate = P.rain; this.wind = [P.wind[0], P.wind[1]]; this.snowRate = P.snow ?? 0;
      this.fogWord = packFog(P.fog); this.fog = unpackFog(this.fogWord);
      this.roofs = this.ownRoofs();
    } else if (ownFloor(g)) { this.ownNight(); }
    else {
      this.storm = LEGACY.storm; this.rainRate = LEGACY.rain; this.wind = [LEGACY.wind[0], LEGACY.wind[1]];
      this.fogWord = 0; this.fog = null; this.roofs = [INTERIOR, ANNEX];
    }
    this.wet = this.on && this.rainRate > 0 ? 1 : 0;
    this.syncRoofs(true);   // (the wind is told the footprints in force — wind.ts is built after this object: its constructor asks for the roofs itself; no kind on a level of another shape than the office = its own roofs, WX_OWN)
    g.airDust?.reseed();   // (airDust.ts — the dust in the rooms under THESE roofs, of THIS fog; built after this object like the wind: its constructor seeds itself)
    hourWeatherChanged(g);   // the level started at another hour (hours.ts): this weather's cloud over that sun and sky, the level's own storm held off again when the kind is taken away — nothing at night
    return true;
  }
  /** can a checkpoint's weather be put in here? null, or the reason (the page's weather is its URL's: WEATHER_BOOT.locked) */
  refuses(s: WeatherSnap | null | undefined): string | null {
    const k = isAnyKind(s?.kind) ? s!.kind! : null;
    { const own = this.levelKind(); if (own && k !== own) return `made in other weather (${k ?? 'the level\'s own'}; this level is in ${own})`; }
    return WEATHER_BOOT.locked && k !== this.kind ? `made in other weather (${k ?? 'the level\'s own'}; this page is in ${this.kind ?? 'the level\'s own'}) — open the mission in that weather to load it` : null;
  }
  /** is (x, z) under one of the footprints the rain is cut by */
  underRoof(x: number, z: number): boolean { this.syncRoofs(); for (const r of this.roofs) if (inRect(r, x, z)) return true; return false; }
  /** the rain bed's level at a listener (0‥1): what the mixer plays there, and what hearMask drowns small noises by */
  rainBed(x: number, z: number): number { return this.rainRate > 0.001 ? (0.35 + 0.65 * this.rainRate) * (this.underRoof(x, z) ? WX_SIM.roofBed : 1) : 0; }
  private get simLive(): boolean { return !!this.kind; }   // (a kind is never off and never held for the day: setKind / setEnabled / update)
  /** HEARING under this weather: the factor (≥ 1) a sound's path is stretched by for a listener at `ear` — exactly 1 with no kind picked */
  hearMask(ear: Vec3): number {
    if (!this.simLive) return 1;
    let k = 1 + WX_SIM.rainK * this.rainBed(ear[0], ear[2]);
    if (this.g.time < this.thunderUntil) k += WX_SIM.thunderK * (this.underRoof(ear[0], ear[2]) ? 0.6 : 1);
    return k;
  }
  /** SIGHT under this weather: the fog's transmittance along a → b (the field composite.wgsl draws: fogTau × the roof leak, the leak averaged over four points of
   *  the line) — exactly 1 with no kind picked or no fog in it */
  airTrans(a: Vec3, b: Vec3): number {
    const f = this.fog; if (!f || !this.simLive) return 1;
    let leak = 0;
    const air = this.g.airDust;
    if (air?.live) { const n = Math.min(24, Math.max(4, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.75))); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; leak += air.shareAt(a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t); } return Math.exp(-fogTau(f, a, b) * leak / n); }   // (airDust.ts: the dust where it actually stands — thick on an open door's threshold, the leak in a shut room)
    for (let i = 0; i < 4; i++) { const t = (i + 0.5) / 4; leak += this.underRoof(a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t) ? f.leak : 1; }
    return Math.exp(-fogTau(f, a, b) * leak / 4);
  }

  /** the weather's dice, reseeded (probes: same seed → same strokes, bearings, distances, remarks) */
  seed(n: number) { this.dice = rng32(n); this.nextFlashAt = -1; }

  /** for a checkpoint (game/savestate.ts): everything the storm's next minutes hang on — a stroke in progress is not carried (a quarter second of light: the load ends any) */
  snapshot(): WeatherSnap { return { ...(this.kind ? { kind: this.kind, thunderUntil: this.thunderUntil } : {}), on: this.on, storm: this.storm, rainRate: this.rainRate, wind: [this.wind[0], this.wind[1]], wetGloss: this.wetGloss, wet: this.wet, nextFlashAt: this.nextFlashAt, thunders: this.thunders.map(t => ({ ...t })), lastBarkT: this.lastBarkT, rng: this.dice.a, stats: { flashes: this.stats.flashes, thunders: this.stats.thunders, barks: this.stats.barks } }; }
  restore(s: WeatherSnap) {
    const f = (x: number, d: number) => Number.isFinite(x) ? x : d;
    this.endFlash();   // (on / off stays the SESSION's — ?noweather, the panel — the file's `on` is kept for the record only)
    { const k = isAnyKind(s.kind) ? s.kind : null; if (k !== this.kind) this.setKind(k); }   // the KIND is the file's (a file from before kinds = none): the run it holds was played under it
    { const own = this.levelKind(); if (own && (isAnyKind(s.kind) ? s.kind : null) !== own) return; }   // (a file made in other weather on a level that keeps its own — refuses() said so: none of its rain, wind or wet comes in)
    this.thunderUntil = f(s.thunderUntil ?? -1e9, -1e9);
    this.storm = f(s.storm, this.storm); this.rainRate = f(s.rainRate, this.rainRate); this.wind = [f(s.wind?.[0], this.wind[0]), f(s.wind?.[1], this.wind[1])]; this.wetGloss = s.wetGloss !== false; this.wet = f(s.wet, this.wet);
    this.nextFlashAt = f(s.nextFlashAt, -1); this.thunders = (s.thunders ?? []).map(t => ({ at: f(t.at, 0), distKm: f(t.distKm, 1), bearing: f(t.bearing, 0), loud: f(t.loud, 0.5) })); this.lastBarkT = f(s.lastBarkT, -1e9);
    if (Number.isFinite(s.rng)) this.dice.a = s.rng >>> 0;
    if (s.stats) { this.stats.flashes = s.stats.flashes | 0; this.stats.thunders = s.stats.thunders | 0; this.stats.barks = s.stats.barks | 0; }
    this.syncRoofs();   // (a replay's knobs are put in after this object was made: the footprints follow the rule now in force)
  }

  setEnabled(on: boolean) {
    if (on === this.on) return;
    if (!on && this.kind) return;   // a PICKED weather stays on: the men's eyes and ears run under it, so the picture does (drop ?weather= for the level's own, which this switches)
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
    this.syncRoofs();
    const frame: WeatherFrame = ((g.engine as { weather?: WeatherFrame }).weather ??= noWeather());   // (the QA harness's engine stand-in has none until now)
    if (!this.on) { zero(frame); return; }
    // day (the breach): the storm holds still and shows nothing — no stroke, no thunder, no wet lot, no rain bed; the night gets it back as it was
    const day = isDaylight(g) && !this.kind;   // (a PICKED weather is the level's by day too: only the level's own night storm waits for the night)
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
    const pp = g.player.char.pos;
    g.audio.rain?.(this.rainBed(pp[0], pp[2]));   // (the footprints in force: INTERIOR / ANNEX unless a kind was picked)
    // ---- what the frame draws
    frame.rain = raining ? this.rainRate : 0;
    frame.snow = this.snowRate;   // (a snow level's flakes: game/snowFx.ts — no rain is drawn there, the rate above is 0)
    frame.shearX = -this.wind[0] / RAIN_V; frame.shearZ = -this.wind[1] / RAIN_V;   // MINUS: a lattice column stands at base + K·y and its drop slides DOWN it toward −K, so for the drop to be carried WITH the wind K = −wind ÷ fall speed (it was +, and the far-field rain drifted against the storm that moves the smoke and the paper — found by the particle-rain lane, 08-12)
    frame.wet = this.wet;
    const fl = this.flash ? this.flash.light.intensity * SKY_FLASH_K : 0;
    frame.flash = [FLASH_COLOR[0] * fl, FLASH_COLOR[1] * fl, FLASH_COLOR[2] * fl];
    frame.rainTop = RAIN_TOP;
    if (!this.kind && !this.own) { frame.interior = INTERIOR; frame.annex = ANNEX; frame.roofC = 0; frame.roofD = 0; frame.fog = 0; }
    else { const R = this.roofs; frame.interior = R[0] ?? NO_RECT; frame.annex = R[1] ?? NO_RECT; frame.roofC = packRect(R[2]) || 1; frame.roofD = packRect(R[3]); frame.fog = this.kind ? fogGlowWord(this.fogWord, this.fogGlow) : 0; }   // (roofC is never 0 while the level's own roofs are in force: 1 = an empty footprint — the shaders' 'all four roofs' test; the fog is a picked kind's alone)
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
    if (this.kind && th.loud > WX_SIM.thunderLoud) this.thunderUntil = g.time + WX_SIM.thunderSecs;   // a clap near enough to remark on drowns the small noises under it (hearMask)
    // somebody passes a remark: a calm, free man of the staff whose head is on screen — a bubble, never the log — not too often. The three dice for it are thrown
    // on EVERY thunder, whoever is on screen, so the stroke schedule after it never depends on where the camera happened to be (same seed → same storm).
    const rBark = this.rnd(), rWho = this.rnd(), rLine = this.rnd();
    if (th.loud > 0.45 && g.time - this.lastBarkT > BARK_COOLDOWN && rBark < BARK_CHANCE) {
      const cands = g.guards.filter((gd: Guard) => gd.state === 'patrol' && !gd.held && !gd.script && !gd.unit && gd.awareness < 0.2 && onScreen(g, gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.7, 0])));
      if (cands.length) {
        const gd = cands[Math.floor(rWho * cands.length) % cands.length];
        let line = THUNDER_LINES[(this.stats.barks + Math.floor(rLine * 2)) % THUNDER_LINES.length];
        if (WORDS.on && /not out in that/.test(line)) { const p = gd.char.pos; if (!g.col.solidBlocked([p[0], 1.9, p[2]], [p[0], 10.9, p[2]])) line = THUNDER_OUT; }   // (nothing solid over his head: he is out in it — one ray off the level's own roofs, no die)
        g.say(gd, line);
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
      const soak = (b: Box) => { this.touched.push({ box: b, albedo: v3.copy(b.albedo), flags: b.flags, rough: b.rough, aniso: b.aniso }); b.albedo = [b.albedo[0] * WET_ALBEDO, b.albedo[1] * WET_ALBEDO, b.albedo[2] * WET_ALBEDO * 1.04]; b.flags |= BoxFlag.Gloss; b.rough = WET_ROUGH; b.aniso = true; };
      if (asphalt) soak(asphalt);
      // A PICKED weather rains on whatever level it is picked for: every other ground slab with open sky over some of it is wet too (a compound's yard, a barracks'
      // courtyard — the slab the houses stand on, their own floors lying over it indoors). The level's own storm, no kind picked, wets the lot alone, as it always did.
      // Those slabs are darkened FOR THE RENDERER ONLY (Box.wetK): their albedo is what a round's material is read from (destruction.ts / particleFx.ts surfOf — a
      // dirt yard at half its tone reads as metal), and a picked rain must not move a run for the look of the ground. The lot keeps its old way, as measured.
      const wetOnly = (b: Box) => { this.touched.push({ box: b, albedo: b.albedo, flags: b.flags, rough: b.rough, aniso: b.aniso }); b.wetK = WET_ALBEDO; b.flags |= BoxFlag.Gloss; b.rough = WET_ROUGH; b.aniso = true; };
      if (this.levelRoofs) for (const b of st) if (b !== asphalt && openGround(b, this.roofs)) wetOnly(b);   // (+ the finish the RT reflection pass reads: standing water at WET_ROUGH, its lobe stretched along the view — the sodium lamp becomes a streak, settings.rtAniso says how long)
      if (this.wetGloss && S.gloss !== undefined && this.glossWas === null) { this.glossWas = S.gloss; S.gloss = true; }
    } else {
      for (const t of this.touched) { t.box.albedo = t.albedo; delete t.box.wetK; t.box.flags = t.flags; if (t.rough === undefined) delete t.box.rough; else t.box.rough = t.rough; if (t.aniso === undefined) delete t.box.aniso; else t.box.aniso = t.aniso; }
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
    return `${this.own ? `own roofs ${this.roofs.length} · ` : ''}${this.kind ? this.kind + (this.fog ? ` fog σ${this.fog.sigma.toFixed(3)}/H${this.fog.H}` : '') + ` cloud ${this.cloud.toFixed(2)} · ` : ''}${this.enabled ? (this.suspended ? 'held (day)' : 'storm ' + this.storm.toFixed(2)) : 'off'} · rain ${this.rainRate.toFixed(2)} wet ${this.wet.toFixed(2)} · ${f ? `STROKE ${f.t.toFixed(2)} s I=${f.light.intensity.toFixed(1)}` : `next stroke in ${Math.max(0, this.nextFlashAt - this.g.time).toFixed(0)} s`}${th ? ` · thunder in ${(th.at - this.g.time).toFixed(1)} s (${th.distKm.toFixed(1)} km)` : ''} · ${this.stats.flashes} strokes ${this.stats.thunders} thunders ${this.stats.barks} remarks`;
  }
}

/** direction the light TRAVELS (Light.dir) for a stroke seen at compass bearing `bearing` (0 = north, +z south… the level's +Z is south: bearing 0 puts the cell
 *  north of the building, π/2 east) and elevation `elev` above the horizon */
function dirOf(bearing: number, elev: number): Vec3 {
  const to: Vec3 = [Math.sin(bearing) * Math.cos(elev), Math.sin(elev), -Math.cos(bearing) * Math.cos(elev)];   // unit vector from the ground TOWARD the stroke
  return [-to[0], -to[1], -to[2]];
}
function zero(f: WeatherFrame) { f.rain = 0; f.snow = 0; f.wet = 0; f.flash = [0, 0, 0]; f.shearX = 0; f.shearZ = 0; f.roofC = 0; f.roofD = 0; f.fog = 0; }

/** HEARING through the weather: `g.col.sound.propagate(src, ear)` with the path stretched by the weather's noise at the listener (Weather.hearMask) — the very
 *  object propagate() returned when no kind is picked. Every consumer of the hearing model asks through this. */
export function hearPath(g: Game, src: Vec3, ear: Vec3, keep = true): ReturnType<Game['col']['sound']['propagate']> {
  const p = g.col.sound.propagate(src, ear, keep); const k = g.weather ? g.weather.hearMask(ear) : 1;
  return k === 1 ? p : { ...p, pathLen: p.pathLen * k };
}
/** the length a LOUD sound's path is taken at (guards.ts hearingCheck: where a routed shot is placed, how long a far man takes to place it): hearPath's own with
 *  the weather's stretch taken back out (WX_SIM.loudDry) — exactly `pathLen` with no kind picked or no noise at the ear */
export function loudLen(g: Game, pathLen: number, ear: Vec3): number { const k = WX_SIM.loudDry && g.weather ? g.weather.hearMask(ear) : 1; return k === 1 ? pathLen : pathLen / k; }
/** A STROKE OF LIGHTNING in the light meter's CPU stand-in (guards.ts lightEstimateAt, which leaves directional lights out): the renderer's meter reads the
 *  stroke's light like any other, so a page's eyes glimpse a man in a flash — and headless nobody did. Under a PICKED weather the stand-in gets it too: the
 *  flash's own light this frame on the six faces, where the statics and the door leaves leave the point a line to it (one segment, as the stand-in tests every
 *  light). With no kind picked nothing is added: the level's own night storm stays out of the stand-in, as it has always been. */
export function strokeLight(g: Game, P: Vec3, acc: number[]): void {
  const W = g.weather, l = W?.kind ? W.flash?.light : null; if (!l || !l.enabled) return;
  const I = (0.2126 * l.color[0] + 0.7152 * l.color[1] + 0.0722 * l.color[2]) * l.intensity; if (!(I > 0.002)) return;
  const tx = -l.dir[0], ty = -l.dir[1], tz = -l.dir[2], t = ty > 0.05 ? Math.min(60, Math.max(0, (WORLD.ceilingY + 6 - P[1]) / ty)) : 60;   // (to well over every roof: past that nothing is in the way)
  if (t > 0.05 && g.col.segmentBlocked(P, [P[0] + tx * t, P[1] + ty * t, P[2] + tz * t])) return;
  if (tx > 0) acc[0] += I * tx; else acc[1] -= I * tx;
  if (ty > 0) acc[2] += I * ty; else acc[3] -= I * ty;
  if (tz > 0) acc[4] += I * tz; else acc[5] -= I * tz;
}
/** SIGHT through the weather: the fog's transmittance along a → b (1 exactly with no kind picked) — multiplied into the smoke transmittance wherever an eye is tested */
export function airTrans(g: Game, a: Vec3, b: Vec3): number { return g.weather ? g.weather.airTrans(a, b) : 1; }
