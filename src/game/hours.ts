// THE HOUR: a level started at another time of day than the one it was authored for (the maintainer, 10-08: "can you also try alternate weather and time of day
// for levels? we may want some loud missions to happen at day"). Every level is authored as a NIGHT: a moon, sodium lamps outside, the rooms' own fixtures. An
// hour is a small record laid over that night without touching the level file: a SUN (one directional light — the same kind-2 light the moon is), the SKY the
// bounce and the reflections read, the haze, the exposure the picture is taken at, and which of the place's own lights burn. `night` is no record at all: the
// level exactly as it is, every byte and every dice draw (tools/qa `probes.ts hours` holds it).
//
//   ?hour=dawn | midday | overcast | dusk | night        the page (main.ts → initHour); the mission sheet's Hour row puts it on the link it loads (ui/missions.ts)
//   applyHour(g, id)                                      live, both ways, any number of times (Tab ▸ Frame ▸ Hour; `__hour.set('dusk')`)
//   HOUR.sun 0‥1 / setSunStrength(g, k)                   THE ONE NUMBER for whoever has clouds: the sun's strength on the picture AND in the meter's stand-in
//
// WHAT AN HOUR DOES, all of it reversible (applyHour(g, 'night') puts back exactly what it found — the light list, every switch, the sky, the storm):
//   · the level's moon out, the hour's sun in at the moon's place in the light list (never last: a loud minute's flashes must not push it past the 64 a frame draws)
//   · sky, haze, exposure: engine.settings, as lighting.ts setDaylight writes them for the breach showcase
//   · THE FIXTURES. Outside lamps (group 'exterior': the sodium heads) are on a photocell — they burn at dawn and dusk as authored and are OUT at midday and on
//     an overcast afternoon. Everything indoors is left as authored at every hour: a windowless room is as dark at noon as at midnight and the men who use a room
//     leave its light on. (Re-made after every restart: game.ts resetLevelState → hourAfterReset.)
//   · the night's STORM held off (HOUR.dry — its own switch, put back with the night). A weather PICKED for the level (weather.ts `kind`) is not the night's
//     storm: it runs at every hour, and its cloud dims this sun (THE WEATHER OVER THE HOUR, below).
//
// ONE MODEL. What an AI eye makes of a man is the light ON him. In the page that is the renderer's own meter (render/probe.ts: shadowed direct light — the sun is
// one of the lights — plus the bounce, which carries the sky), so it follows the hour by itself. Everything the game computes on the CPU — guards.ts
// lightEstimateAt: the meter's stand-in until the probe answers and ALWAYS under the headless harness, and what the team's light and goggle rules read on every
// host — gets the hour here: hourLight() adds the SUN (one shadow test against the statics and the door leaves, the meter's own cosine) and the SKY with one
// bounce off sunlit ground (a handful of rays per half-metre cell, cached; a door leaf in the way is asked every time, so a room lights when its door opens).
// So by day a man in a yard is plain to see from across it, the team's weapon lights go out and its goggles come up outdoors, and a shut room is still a dark
// room. No AI-only shortcut: nothing here reads a side, a state or a difficulty.
//
// SEAMS. Weather: weather.ts calls hourWeatherChanged(g) when its kind changes; this file holds the level's own storm switch and reads Weather.kind / .cloud
// (the stand-in reads the live sky, so the greyed sky is followed). Destruction: a wall that goes changes what the sky reaches — call
// hourWorldChanged(g). Checkpoints carry the hour (savestate.ts `hour`), and with them the session journal (its frame 0 is a checkpoint).
// (src/game is one import cycle: nothing here is built from another game module's exports at module load.)
import { SideMap } from '../math/side';
import { Vec3, v3, clamp, smoothstep } from '../math/vec';
import type { Game, LightTarget } from './game';
import type { RtLight } from '../render/lights';
import { rayBox, BoxFlag, type Box } from '../scene/boxes';
import type { WeatherSnap } from './weather';
import { isDaylight } from './lighting';

export type HourId = 'night' | 'dawn' | 'midday' | 'overcast' | 'dusk';
/** the order of a day, the authored night last — and the order the sheet's row and the keys walk */
export const HOUR_IDS: HourId[] = ['dawn', 'midday', 'overcast', 'dusk', 'night'];

export interface HourDef {
  id: HourId; label: string;
  /** the local time it stands for (Central America, about 15° north: a high noon sun, short twilights) */
  clock: string;
  /** the sheet's sentence */
  words: string;
  /** the sun: where it stands (bearing 0 = north = −z, 90 = east = +x — weather.ts's convention; elevation above the horizon), its colour, its irradiance on a
   *  face turned to it (the light meter reads 100 % at 4.5), its angular radius (rad: the penumbra — an overcast sky is a very wide sun) and how much it lights
   *  the building's dust (shafts through a door, under a ceiling only: volumetrics.wgsl's rule for directional lights) */
  sun: { bearingDeg: number; elevDeg: number; color: Vec3; intensity: number; radius: number; volumetric: number };
  sky: { zenith: Vec3; horizon: Vec3 };
  haze: number; exposure: number;
  /** the outside lamps burn as authored (a photocell: dawn, dusk) or are out */
  lamps: boolean;
  /** the cloud cover already IN these numbers (the grey day's deck; none = a clear sky): a picked weather's cloud counts only past it (THE WEATHER OVER THE HOUR) */
  cloud?: number;
}
/** The hours to try. Numbers chosen by the meter's arithmetic and by software-rendered stills (rebuild/weather-and-hours/hours): nobody has seen one on a GPU. */
export const HOURS: Record<Exclude<HourId, 'night'>, HourDef> = {
  dawn: { id: 'dawn', label: 'Dawn', clock: '06:40', words: 'early light, with a low orange sun, long shadows across the yard and the lights still on',
    sun: { bearingDeg: 105, elevDeg: 22, color: [1.0, 0.62, 0.38], intensity: 2.6, radius: 0.02, volumetric: 1.2 },
    sky: { zenith: [0.16, 0.22, 0.38], horizon: [0.56, 0.42, 0.34] }, haze: 0.05, exposure: 1.9, lamps: true },
  midday: { id: 'midday', label: 'Midday', clock: '12:30', words: 'a high white sun, with hard short shadows, every yard in plain sight and the rooms dark by contrast',
    sun: { bearingDeg: 195, elevDeg: 56, color: [1.0, 0.97, 0.9], intensity: 6.0, radius: 0.012, volumetric: 0.6 },
    sky: { zenith: [0.3, 0.45, 0.8], horizon: [0.7, 0.76, 0.84] }, haze: 0.03, exposure: 1.7, lamps: false },
  overcast: { id: 'overcast', label: 'Grey day', clock: '15:30', words: 'an overcast afternoon, with flat gray light, almost no shadows and nothing to hide in outdoors',
    sun: { bearingDeg: 240, elevDeg: 50, color: [0.92, 0.95, 1.0], intensity: 1.0, radius: 0.25, volumetric: 0 },
    sky: { zenith: [0.55, 0.58, 0.63], horizon: [0.6, 0.62, 0.65] }, haze: 0.045, exposure: 2.0, lamps: false, cloud: 0.9 },
  dusk: { id: 'dusk', label: 'Dusk', clock: '17:00', words: 'late light, with a low red sun, the lights coming on and the yard half in shadow',
    sun: { bearingDeg: 255, elevDeg: 22, color: [1.0, 0.5, 0.26], intensity: 2.2, radius: 0.02, volumetric: 1.2 },
    sky: { zenith: [0.13, 0.18, 0.36], horizon: [0.6, 0.38, 0.24] }, haze: 0.045, exposure: 2.0, lamps: true },
};
const NIGHT = { label: 'Night', clock: '02:00', words: 'the level as it was built, with the moon, the lights outside and the storm' };
export function hourLabel(id: HourId): string { return id === 'night' ? NIGHT.label : HOURS[id].label; }
export function hourClock(id: HourId): string { return id === 'night' ? NIGHT.clock : HOURS[id].clock; }
export function hourWords(id: HourId): string { return id === 'night' ? NIGHT.words : HOURS[id].words; }

/** THE VISIT'S CHOICE (the page's ?hour=, the harness's PT_HOUR): what standGame lays over the level it stands up. `sun` is the one number a weather dims under
 *  cloud (1 = the hour's own sun; picture and meter stand-in alike). `dry`: hold the night's storm off while an hour other than night is in. */
export const HOUR: { id: HourId; sun: number; /** `sun` was SET for the visit (?sun=, PT_SUN): it stands whatever cloud a picked weather brings; not set = the cloud dims the sun (THE WEATHER OVER THE HOUR, below) */ sunGiven: boolean; dry: boolean; /** the page's running game's hour, for screens that hold no Game (main.ts sets it; the mission sheet's no-load shortcut asks) */ live: (() => HourId) | null } = { id: 'night', sun: 1, sunGiven: false, dry: true, live: null };
/** the hour the page is standing at right now: the running game's where a page has one (a checkpoint or the panel may have moved it off the visit's), else the visit's */
export function hourLive(): HourId { return HOUR.live?.() ?? HOUR.id; }

const ALIAS: Record<string, HourId> = { day: 'midday', noon: 'midday', afternoon: 'overcast', sunrise: 'dawn', sunset: 'dusk', evening: 'dusk' };
/** a word → an hour ('' / unknown = night) */
export function hourIdOf(v: unknown): HourId { const s = typeof v === 'string' ? v.toLowerCase() : ''; return (HOUR_IDS as string[]).includes(s) ? s as HourId : Object.hasOwn(ALIAS, s) ? ALIAS[s] : 'night'; }
/** main.ts, before the stand-up: ?hour=<id> (and ?sun=0‥1, the sun's strength) for this visit — nothing is stored: with no flag the level is its own night */
export function initHour(q: URLSearchParams) {
  HOUR.id = hourIdOf(q.get('hour'));
  const s = q.get('sun'); if (s !== null && Number.isFinite(parseFloat(s))) { HOUR.sun = clamp(parseFloat(s), 0, 1); HOUR.sunGiven = true; }
  if (q.has('noweather')) HOUR.dry = false;   // (the storm is already off for the visit by its own flag: nothing of it to hold, nothing to bring back with the night)
}
/** the hour off a query handed to a RUNNING game (scenarioRun.ts startFromQuery — the harness's way in: a tool that passes 'hour=midday&sun=0.5' beside the scenario's
 *  own flags); no `hour` key = nothing touched, so a start from a plain scenario query leaves the visit's hour where the stand-up put it */
export function hourFromQuery(g: Game, q: URLSearchParams): void {
  if (!q.has('hour')) return;
  applyHour(g, hourIdOf(q.get('hour')));
  const s = q.get('sun'); if (s !== null && Number.isFinite(parseFloat(s))) setSunStrength(g, parseFloat(s));
}
/** a link with the hour on it (night = none: the bare link is the level as it was made) — whatever hour the link carried is replaced */
export function hourHref(href: string, id: HourId = HOUR.id): string {
  const [path, query = ''] = href.split('?'); const keys = query.split('&').filter(k => k && !/^hour(=|$)/.test(k));
  if (id !== 'night') keys.push(`hour=${id}`);
  return keys.length ? `${path}?${keys.join('&')}` : path;
}

// ================================================================================================================================ the hour on a Game
interface Ray { d: Vec3; c6: number[]; }
interface Open { ray: number; len: number; /** a sky ray: 0; a ground ray: the sunlit and sky-lit shares of the floor point it ends on */ sunK: number; skyK: number }
interface HourState {
  def: HourDef; sun: RtLight; toSun: Vec3; sunK: number;
  /** sunK was set by hand (?sun=, the panel's slider, a file that says so): a picked weather's cloud leaves it alone */
  given: boolean;
  /** how far a picked weather's cloud has the sun's disc spread and the colour out of the sky (cloudSoft: 0 = the hour's own) */
  soft: number;
  /** the sky's luminance under that cloud, of the hour's own (cloudLight) */
  skyK: number;
  /** the level's own storm was found OFF when the hour came in (the panel, ?noweather): a picked weather leaving puts it off again, and the night does not bring it back */
  wasOff: boolean;
  moons: RtLight[]; lamps: Map<LightTarget, boolean>; sky: { zenith: Vec3; horizon: Vec3 }; haze: number; exposure: number;
  /** the night's storm as it stood when this hour held it off (weather.ts's own checkpoint slice: its dice, the stroke it had scheduled, thunder still due) — null: not held */
  storm: WeatherSnap | null;
  /** which statics cast shadows, as one number: a wall gone or a thing knocked flat since the cells were asked is seen by the next reading */
  casters: number;
  /** the box the shadow casters stand in: a ray that has left it meets nothing more */
  box: { x0: number; x1: number; z0: number; z1: number; top: number };
  cells: Map<number, Open[]>; fine: Map<number, Open[]>;
}
const states = new SideMap<Game, HourState>('hours.states');
export const SUN_NAME = 'sun', SUN_GROUP = 'hour';
/** the hour this game stands at ('night' = the level as authored) */
export function hourOf(g: Game): HourId { return states.get(g)?.def.id ?? 'night'; }
/** the hour's sun in this game's light set (null at night) */
export function hourSun(g: Game): RtLight | null { return states.get(g)?.sun ?? null; }
export function isHourSun(g: Game, l: RtLight): boolean { return states.get(g)?.sun === l; }
/** the sun's strength 0‥1 on this game (1 at night: there is none to dim) */
export function sunStrength(g: Game): number { return states.get(g)?.sunK ?? 1; }
/** was the sun's strength set by hand (?sun=, the panel) rather than left to the weather's cloud */
export function sunGiven(g: Game): boolean { return states.get(g)?.given ?? false; }
/** THE ONE NUMBER, live: the sun at k of the hour's own (0 = behind solid cloud). The picture's light and the meter stand-in's read the same RtLight.
 *  `given` (the default: a hand set it) holds it against a picked weather's cloud; false = a number carried over (a file, the breach's day handing the hour
 *  back) that the cloud may move again. */
export function setSunStrength(g: Game, k: number, given = true) {
  const st = states.get(g); if (!st) return;
  st.sunK = clamp(Number.isFinite(k) ? k : 1, 0, 1); st.given = given; st.sun.intensity = st.sun.peakIntensity = st.def.sun.intensity * st.sunK;
  if (!given) underWeather(g, st);   // (a carried number is the cloud's to move: under the weather this game is in, it is that cloud's now — a file made under another, or before the cloud took the sky's share)
}

// ================================================================================================================================ the weather over the hour
// A PICKED WEATHER (weather.ts `kind`: ?weather=, the sheet's Weather row) and an hour are chosen apart and meet here, in three rules:
//   · THE STORM. A picked weather always runs — rain at midday rains. With none picked the hour keeps the level's own night storm off (HOUR.dry), as before.
//   · CLOUD → THE LIGHT. Weather.cloud c (0‥1) takes light off the GROUND and moves what is left from the sun to the sky — Kasten & Czeplak's two fits (1980):
//       all of it, on open ground      G(c) = G(0) · (1 − 0.75 c^3.4)        cloudSun      clear 1.00 · dust 0.99 · fog 0.78 · overcast 0.48 · rain 0.37 · downpour 0.25
//       the sky's share of it          d(c) = d0 + (1 − d0) · c²                           (d0 = the hour's own share under its own sky, off its own numbers)
//     so the SUN stands at (1 − c²) × cloudSun(c) of the hour's own — the ONE NUMBER above: midday's is 0.93 in dust, 0.40 in fog, 0.09 under an
//     overcast, 0.04 in rain and NOTHING in a downpour — and the SKY at d(c) ∕ d0 × cloudSun(c) of its own luminance (it brightens as the deck closes: cloud is
//     brighter than blue). Both are the lights the picture is drawn with AND the ones the meter's stand-in reads (hourLight: the sun's RtLight, the live sky),
//     so they dim together. A sun strength set by hand (?sun=, the slider) stands; the sky still follows the cloud. sunToCloud() hands it back.
//     An hour that is ITSELF a weather (the grey day: HourDef.cloud 0.9) already has that much cloud in its numbers: a picked weather moves it only by what it
//     adds past that (a clear, dusty, foggy or overcast grey day is the grey day; rain and a downpour darken it — c² and cloudSun both taken from the hour's
//     own cover, so level open ground still gets exactly cloudSun(c) ∕ cloudSun(own)).
//   · CLOUD → THE SUN'S DISC AND THE COLOURS. Past half cover (cloudSoft) the sun spreads toward the grey day's wide disc (shadows soften and go), its shafts leave
//     the dust, and the colour drains out of sun and sky toward a deck's grey at the same luminance.
// Night is not touched by any of it: the moon stays as the level has it whatever the cloud (the weather part's 'overcast' at night is 'clear' — a call left open).
// Not touched by day either: the exposure (the hour's; a downpour at noon is a dim picture, as it is a dim day) and the photocell (the lamps follow the hour).
/** the light on open ground under cloud cover c (0‥1), of a clear sky's */
export function cloudSun(c: number): number { return 1 - 0.75 * Math.pow(clamp(c, 0, 1), 3.4); }
/** how far cloud cover c has spread the sun and greyed the sky (0 under half cover, 1 under a solid deck) */
export function cloudSoft(c: number): number { return smoothstep(0.5, 1, c); }
const SOFT_RADIUS = 0.25;   // (the grey day's own disc)
const GREY: Vec3 = [0.948, 1, 1.086], GREY_LUM = 0.2126 * 0.948 + 0.7152 + 0.0722 * 1.086;   // a cloud deck's cool grey (the grey day's own sky)
/** colour c drained toward that grey by w and scaled by k, its luminance otherwise kept */
export function greyed(c: Vec3, w: number, k = 1): Vec3 { const l = lum(c) / GREY_LUM; return [(c[0] + (l * GREY[0] - c[0]) * w) * k, (c[1] + (l * GREY[1] - c[1]) * w) * k, (c[2] + (l * GREY[2] - c[2]) * w) * k]; }
/** the sky's share of the light on open ground at an hour AS AUTHORED (its sun on a level face against its sky's dome on it — the stand-in's own sum) */
function skyShare(d: HourDef): number {
  rays(); const zen = lum(d.sky.zenith), hor = lum(d.sky.horizon); let K = 0;
  for (const q of SKY) K += (hor + (zen - hor) * clamp(q.d[1] * 2.5, 0, 1)) * q.c6[2];
  const S = lum(d.sun.color) * d.sun.intensity * Math.max(0, Math.sin(d.sun.elevDeg * DEG));
  return K + S > 0 ? K / (K + S) : 1;
}
/** [sun, sky] under cover c, each as a factor of the hour's own (1, 1 with no more cloud than the hour has in it) */
export function cloudLight(d: HourDef, c: number): [number, number] {
  const ch = d.cloud ?? 0; c = Math.max(clamp(c, 0, 1), ch);
  if (c === ch) return [1, 1];
  // the share moves from the hour's OWN (at its own cover) to 1 under a solid deck along c²: b = own + (1 − own)·u, u = (c² − ch²) ∕ (1 − ch²) — so the sun's
  // factor (1 − b) ∕ (1 − own) is 1 − u whatever the share (no sun, no sky: nothing divides by it), and sun + sky on level ground is exactly the total's
  const own = skyShare(d), u = (c * c - ch * ch) / (1 - ch * ch), f = cloudSun(c) / cloudSun(ch);
  return [(1 - u) * f, own > 1e-6 ? (own + (1 - own) * u) / own * f : 1];
}
/** the light on level open ground under cover c as a factor of the hour's own (the sun's and the sky's parts together) */
export function cloudTotal(d: HourDef, c: number): number { const ch = d.cloud ?? 0; return cloudSun(Math.max(clamp(c, 0, 1), ch)) / cloudSun(ch); }
function underWeather(g: Game, st: HourState) {
  const W = g.weather, kind = W?.kind ?? null, d = st.def, S = g.engine.settings;
  // the level's own storm: held off while no weather is picked (kept as it stood, to come back with the night); a picked weather is on and stays on
  if (!kind && W?.enabled) { if (st.wasOff) W.setEnabled(false); else if (HOUR.dry) { st.storm ??= W.snapshot(); W.setEnabled(false); } }
  const c = kind ? W!.cloud : 0, [sunK, skyK] = cloudLight(d, c), soft = Math.max(0, cloudSoft(c) - cloudSoft(d.cloud ?? 0));
  if (!st.given) st.sunK = sunK;
  // the fog's veil glows with the frame's sky horizon (common.wgsl wxFogApply) — which the cloud has just BRIGHTENED (fog at midday: sky ×1.97 while the light on
  // the ground is ×0.78). What a parcel of fog scatters is the light that reaches it, so the glow follows the total, not the sky's share: × total ∕ sky.
  if (W) W.fogGlow = skyK > 1e-6 ? cloudTotal(d, c) / skyK : 1;
  st.sun.intensity = st.sun.peakIntensity = d.sun.intensity * st.sunK;
  if (soft === st.soft && skyK === st.skyK) return;
  st.soft = soft; st.skyK = skyK;
  st.sun.color = greyed(d.sun.color, soft); st.sun.volumetric = d.sun.volumetric * (1 - soft);
  const r = d.sun.radius + (Math.max(d.sun.radius, SOFT_RADIUS) - d.sun.radius) * soft; if (r !== st.sun.radius) { st.sun.radius = r; sunReach(g, st.sun, r); }
  S.skyZenith = greyed(d.sky.zenith, soft, skyK); S.skyHorizon = greyed(d.sky.horizon, soft, skyK);
}
/** weather.ts Weather.setKind, last: the weather under a running game changed — the hour's storm switch, sun and sky follow (nothing at night) */
export function hourWeatherChanged(g: Game) { const st = states.get(g); if (!st) return; underWeather(g, st); g.engine.invalidateWorldCache?.(); }
/** a sun strength set by hand (the slider, ?sun=) handed back to the weather's cloud */
export function sunToCloud(g: Game) { const st = states.get(g); if (!st) return; st.given = false; underWeather(g, st); }

const lum = (c: Vec3) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const DEG = Math.PI / 180;
function toSunOf(d: HourDef): Vec3 { const e = d.sun.elevDeg * DEG, b = d.sun.bearingDeg * DEG; return v3.normalize([Math.sin(b) * Math.cos(e), Math.sin(e), -Math.cos(b) * Math.cos(e)]); }

/** Lay hour `id` over the game, or take it off ('night'). Idempotent; any hour → any hour. True when something changed. */
export function applyHour(g: Game, id: HourId): boolean {
  const cur = states.get(g);
  if ((cur?.def.id ?? 'night') === id || !(id === 'night' || Object.hasOwn(HOURS, id))) return false;
  if (isDaylight(g)) return false;   // the breach showcase's own day is in (lighting.ts setDaylight took the hour out and puts it back): two days are not laid over each other
  if (cur) takeOut(g, cur);
  if (id !== 'night') putIn(g, HOURS[id], cur);   // (hour → hour: a strength set by hand stays where it was; left to the weather, it is the cloud's over the new hour)
  g.engine.invalidateWorldCache?.();   // the light rig swapped wholesale: the radiance cache snaps to the hour instead of blending toward it (lighting.ts setDaylight's reason; a stand-in engine has none)
  return true;
}
function putIn(g: Game, def: HourDef, from?: HourState) {
  const S = g.engine.settings, L = g.engine.lights, toSun = toSunOf(def), W = g.weather, kind = !!W?.kind;
  const st: HourState = { def, toSun, sunK: from ? from.sunK : clamp(HOUR.sun, 0, 1), given: from ? from.given : HOUR.sunGiven || HOUR.sun !== 1, soft: 0, skyK: 1,
    wasOff: kind ? from?.wasOff ?? false : !!W && !W.enabled, moons: [], lamps: new Map(), sky: { zenith: v3.copy(S.skyZenith), horizon: v3.copy(S.skyHorizon) }, haze: S.hazeDensity, exposure: S.exposure, storm: kind ? from?.storm ?? null : null, casters: castersOf(g),
    sun: null as unknown as RtLight, box: boxOf(g), cells: new Map(), fine: new Map() };
  // the moon out (every steady directional light of the level: it has no switch of its own), the sun in where the moon stood
  let at = 0;
  L.lights.forEach((l, i) => { if (l.kind === 2 && l.ttl < 0 && !l.transient && l.enabled) { l.enabled = false; st.moons.push(l); at = i + 1; } });
  const I = def.sun.intensity * st.sunK;
  st.sun = { name: SUN_NAME, group: SUN_GROUP, kind: 2, pos: [0, 0, 0], dir: v3.scale(toSun, -1), color: v3.copy(def.sun.color), intensity: I, range: 1e6, innerDeg: 0, outerDeg: 0, radius: def.sun.radius,
    volumetric: def.sun.volumetric, owner: 0, enabled: true, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: I, broad: false };
  L.lights.splice(at, 0, st.sun);
  S.skyZenith = v3.copy(def.sky.zenith); S.skyHorizon = v3.copy(def.sky.horizon); S.hazeDensity = def.haze; S.exposure = def.exposure;
  states.set(g, st);
  underWeather(g, st);   // the storm held off — or a picked weather kept, with its cloud over this sun and sky
  if (!st.sun.reachDir) sunReach(g, st.sun, st.sun.radius);   // which indoor cells see the sky its way (the direct estimator's candidate domain) — asked once, for the disc the cloud left it
  lampsOut(g, st);
}
function takeOut(g: Game, st: HourState) {
  const S = g.engine.settings;
  for (const [t, was] of st.lamps) if (!t.on) t.on = was;   // (a lamp somebody switched ON under the hour — the perimeter's call for the lot lights — stays as they left it)
  for (const l of st.moons) l.enabled = true;
  g.engine.lights.remove(st.sun);
  S.skyZenith = v3.copy(st.sky.zenith); S.skyHorizon = v3.copy(st.sky.horizon); S.hazeDensity = st.haze;
  S.exposure = st.exposure * (S.exposure / st.def.exposure);   // (the Brightness slider moved under the hour: the same turn of it carried back; untouched = exactly what was found)
  states.delete(g); if (g.weather) g.weather.fogGlow = 1;
  if (st.storm && g.weather && !g.weather.enabled) { g.weather.setEnabled(true); g.weather.restore(st.storm); }   // the storm back where it stood: its dice, its next stroke, the thunder it still owed
}
/** A directional light's reach mask is asked along ONE direction (game.ts buildDirReach). A wide sun — the overcast's disc is a soft box some twenty degrees
 *  across — reaches cells its centre does not: the mask is the union over the centre and four directions on the disc's rim (a cell wrongly dark there would
 *  get no candidate at all; one wrongly lit only costs a ray). */
function sunReach(g: Game, sun: RtLight, radius: number) {
  g.buildDirReach(sun);
  if (!(radius > 0.05) || !sun.reachDir) return;
  const acc = new Uint32Array(sun.reachDir), d0 = v3.copy(sun.dir), u = v3.normalize(v3.cross(d0, Math.abs(d0[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), w = v3.cross(d0, u), k = Math.tan(radius);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; sun.dir = v3.normalize([d0[0] + (u[0] * Math.cos(a) + w[0] * Math.sin(a)) * k, d0[1] + (u[1] * Math.cos(a) + w[1] * Math.sin(a)) * k, d0[2] + (u[2] * Math.cos(a) + w[2] * Math.sin(a)) * k]);
    g.buildDirReach(sun); const m = sun.reachDir!; for (let j = 0; j < acc.length; j++) acc[j] |= m[j]; }
  sun.dir = d0; sun.reachDir = acc;
}
/** the photocell: with the lamps out for the hour, every outside fixture's switch recorded as it stands and opened */
function lampsOut(g: Game, st: HourState) {
  if (st.def.lamps) return;
  for (const t of g.targets) if (t.group === 'exterior' && t.kind !== 'breaker') { st.lamps.set(t, t.on); t.on = false; }
}
/** game.ts resetLevelState, last: the level's switches are back as authored — the hour's are made again over them, and what the sky reaches is asked afresh
 *  (the destruction's hidden statics are back) */
export function hourAfterReset(g: Game) { const st = states.get(g); if (!st) return; st.lamps.clear(); lampsOut(g, st); st.cells.clear(); st.fine.clear(); st.casters = castersOf(g); }
/** the statics changed under a running game (a wall gone, a cover knocked flat): what the sky reaches is asked afresh */
export function hourWorldChanged(g: Game) { const st = states.get(g); if (st) { st.cells.clear(); st.fine.clear(); st.box = boxOf(g); st.casters = castersOf(g); } }
/** which statics cast shadows right now, folded to one number (destruction.ts hides a static by raising NoShadow; a wall that breaks changes the list): cheap
 *  enough to ask at every reading, so the cells never outlive the walls they were asked of — whoever changes the statics need not know this file exists */
function castersOf(g: Game): number { const S = g.engine.world.statics; let h = S.length * 7919; for (let i = 0; i < S.length; i++) if (S[i].flags & BoxFlag.NoShadow) h = (h + (i + 1) * 31) | 0; return h; }

// ================================================================================================================================ the meter's stand-in
const N6: Vec3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];   // guards.ts METER_NORMALS (probe.wgsl's six)
/** the sample directions of the ambient: the sky's dome in three bands (zenith cap above 70°, six at 50°, eight at 16° — each weighted by its band's solid
 *  angle) and eight just under the horizon, which end on the floor some six metres out: the ground's one bounce (a sunlit yard through a doorway) */
const SKY: Ray[] = [], GND: Ray[] = [];
const GND_ELEV = -12 * DEG, CELL = 0.5, CELL_Y = 1.3, DOOR_M = 7, GROUND_ALBEDO = 0.25;
function rays() {
  if (SKY.length) return;
  const add = (to: Ray[], elev: number, n: number, w: number, turn = 0) => { for (let i = 0; i < n; i++) { const a = (i + turn) / n * 2 * Math.PI; const d: Vec3 = [Math.cos(a) * Math.cos(elev), Math.sin(elev), Math.sin(a) * Math.cos(elev)]; to.push({ d, c6: N6.map(N => Math.max(0, v3.dot(N, d)) * w) }); } };
  const s = (deg: number) => Math.sin(deg * DEG);
  add(SKY, 90 * DEG, 1, 2 * Math.PI * (1 - s(70)));
  add(SKY, 50 * DEG, 6, 2 * Math.PI * (s(70) - s(32)) / 6);
  add(SKY, 16 * DEG, 8, 2 * Math.PI * s(32) / 8, 0.5);
  add(GND, GND_ELEV, 8, 2 * Math.PI * s(25) / 8, 0.25);
}
/** common.wgsl skyRadiance's luminance, off the LIVE sky (a weather that greys it is read here too) */
function skyLum(g: Game, y: number): number {
  const S = g.engine.settings, zen = lum(S.skyZenith), hor = lum(S.skyHorizon); const t = clamp(y * 2.5, 0, 1), below = clamp(-y * 8, 0, 1);
  return (hor + (zen - hor) * t) * (1 - below) + hor * 0.15 * below;
}
function boxOf(g: Game): HourState['box'] {
  const b = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, top: 0 };
  for (const s of g.engine.world.statics) {
    if (s.flags & BoxFlag.NoShadow) continue;
    const r = Math.hypot(s.h[0], s.h[2]);   // (a yawed box: its circle)
    b.x0 = Math.min(b.x0, s.c[0] - r); b.x1 = Math.max(b.x1, s.c[0] + r); b.z0 = Math.min(b.z0, s.c[2] - r); b.z1 = Math.max(b.z1, s.c[2] + r); b.top = Math.max(b.top, s.c[1] + s.h[1]);
  }
  if (!(b.x1 > b.x0)) return { x0: 0, x1: 40, z0: 0, z1: 28, top: 8 };
  b.top += 0.1; return b;
}
/** how far a ray from P along d runs before it is out of the casters' box (≤ 60 m) */
function reachOf(B: HourState['box'], P: Vec3, d: Vec3): number {
  let t = 60;
  if (d[1] > 1e-4) t = Math.min(t, (B.top - P[1]) / d[1]);
  if (d[0] > 1e-4) t = Math.min(t, (B.x1 - P[0]) / d[0]); else if (d[0] < -1e-4) t = Math.min(t, (B.x0 - P[0]) / d[0]);
  if (d[2] > 1e-4) t = Math.min(t, (B.z1 - P[2]) / d[2]); else if (d[2] < -1e-4) t = Math.min(t, (B.z0 - P[2]) / d[2]);
  return Math.max(t, 0);
}
const NO_BOXES: Box[] = [];
/** the statics alone between a and b (the door leaves are asked apart, every time: a cell's rays are kept, a door is not) */
function staticBlocked(g: Game, a: Vec3, b: Vec3): boolean {
  const col = g.col, dyn = col.dynamicBoxes; col.dynamicBoxes = NO_BOXES;
  try { return col.segmentBlocked(a, b); } finally { col.dynamicBoxes = dyn; }
}
/** the ambient's rays that leave point C unblocked by the statics: sky rays out of the casters' box, ground rays to the floor point they end on with that
 *  point's own sun and sky */
function openRays(g: Game, st: HourState, C: Vec3): Open[] {
  rays(); const out: Open[] = [], B = st.box;
  SKY.forEach((r, i) => { const len = reachOf(B, C, r.d); if (len > 0.05 && !staticBlocked(g, C, v3.mad(C, r.d, len))) out.push({ ray: i, len, sunK: 0, skyK: 0 }); });
  GND.forEach((r, i) => {
    const len = Math.min((C[1] - 0.03) / -r.d[1], reachOf(B, C, r.d)); if (len < 0.3) return;
    const G = v3.mad(C, r.d, len); if (G[1] > 0.2 || staticBlocked(g, C, G)) return;   // (it left the box before it came down: open ground nobody models)
    const sunK = st.toSun[1] > 0 && !staticBlocked(g, G, v3.mad(G, st.toSun, reachOf(B, G, st.toSun))) ? st.toSun[1] : 0;
    const skyK = staticBlocked(g, G, [G[0], B.top, G[2]]) ? 0 : 1;
    if (sunK > 0 || skyK > 0) out.push({ ray: SKY.length + i, len, sunK, skyK });
  });
  return out;
}
/** The hour's light at world point P, added to the meter stand-in's six faces (guards.ts lightEstimateAt, before it takes its best face): the SUN where the
 *  statics and the door leaves leave P a line to it, and the AMBIENT — the sky through whatever is open above and beside P, and one bounce off lit ground —
 *  from the rays of P's half-metre cell (asked once of the statics, kept; taken at P itself where the cell's centre is behind something P is not). A door
 *  leaf within DOOR_M is tested against every kept ray, each call. Nothing at night. What it has not got, named: bounce off walls, a second bounce (a room
 *  two doors in from the day is black here and merely dim on screen), bodies' shadows, smoke. */
export function hourLight(g: Game, P: Vec3, acc: number[]): void {
  const st = states.get(g); if (!st) return;
  if (castersOf(g) !== st.casters) hourWorldChanged(g);
  const sun = st.sun, Isun = sun.enabled && sun.intensity > 0 ? lum(sun.color) * sun.intensity : 0;
  if (Isun > 0.002) {
    const t = reachOf(st.box, P, st.toSun);
    if (t <= 0.05 || !g.col.segmentBlocked(P, v3.mad(P, st.toSun, t))) for (let k = 0; k < 6; k++) { const cs = v3.dot(N6[k], st.toSun); if (cs > 0) acc[k] += Isun * cs; }
  }
  // the cell's rays stand for P while nothing — a wall, a shut leaf — is between P and the point they were asked from: else the quarter-cell's, else P's own, unkept
  const ix = Math.floor(P[0] / CELL), iz = Math.floor(P[2] / CELL), C: Vec3 = [(ix + 0.5) * CELL, CELL_Y, (iz + 0.5) * CELL];
  let from = C, open: Open[];
  if (!g.col.segmentBlocked(P, C)) { const key = (iz + 2048) * 4096 + (ix + 2048); let o = st.cells.get(key); if (!o) { o = openRays(g, st, C); st.cells.set(key, o); } open = o; }
  else {
    const jx = Math.floor(P[0] / (CELL / 2)), jz = Math.floor(P[2] / (CELL / 2)), C2: Vec3 = [(jx + 0.5) * CELL / 2, CELL_Y, (jz + 0.5) * CELL / 2];
    if (!g.col.segmentBlocked(P, C2)) { from = C2; const k2 = (jz + 4096) * 8192 + (jx + 4096); let o = st.fine.get(k2); if (!o) { o = openRays(g, st, C2); st.fine.set(k2, o); } open = o; }
    else { from = P; open = openRays(g, st, P); }
  }
  if (!open.length) return;
  let leaves: Box[] | null = null;
  for (const db of g.col.dynamicBoxes) if (Math.hypot(db.c[0] - P[0], db.c[2] - P[2]) < DOOR_M) (leaves ??= []).push(db);
  let Eup = -1;   // the sky's irradiance on open ground (what a floor point in the yard sends back, with the sun's) — asked only when a ground ray is open
  for (const o of open) {
    const sky = o.ray < SKY.length, r = sky ? SKY[o.ray] : GND[o.ray - SKY.length];
    if (leaves) { let hit = false; for (const db of leaves) { const h = rayBox(from, r.d, db, o.len); if (h && h.t >= 0) { hit = true; break; } } if (hit) continue; }
    if (!sky && Eup < 0) { Eup = 0; for (const q of SKY) Eup += skyLum(g, q.d[1]) * q.c6[2]; }
    const Lr = sky ? skyLum(g, r.d[1]) : GROUND_ALBEDO / Math.PI * (Isun * o.sunK + Eup * o.skyK);
    if (Lr <= 0) continue;
    for (let k = 0; k < 6; k++) acc[k] += Lr * r.c6[k];
  }
}
/** the hour's light alone at P, as the meter would report it (the best of the six faces, W/m²) — for the panel, the probes and the page's read-out */
export function hourLightAt(g: Game, P: Vec3): number { const acc = [0, 0, 0, 0, 0, 0]; hourLight(g, P, acc); return Math.max(...acc); }

/** one line for the panel / `__hour.summary()` */
export function hourSummary(g: Game): string {
  const st = states.get(g); if (!st) return 'night (the level as authored)';
  const d = st.def, out = [...st.lamps.keys()].length;
  return `${d.label} ${d.clock} · sun ${d.sun.elevDeg}° up at ${(st.sun.intensity).toFixed(2)} (×${st.sunK.toFixed(2)}${st.given ? ' set' : g.weather?.kind ? ` under ${g.weather.kind}'s cloud` : ''}${st.skyK !== 1 ? `, sky ×${st.skyK.toFixed(2)}` : ''}) · exposure ${g.engine.settings.exposure.toFixed(2)} · outside lamps ${d.lamps ? 'as authored' : `out (${out})`}${st.storm ? ' · storm held' : ''} · ${st.cells.size} cells`;
}
