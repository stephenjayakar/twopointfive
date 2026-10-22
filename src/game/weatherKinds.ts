// WEATHER KINDS: the weather a level can be STARTED in (`?weather=<kind>`, the Weather row where a mission is picked). No kind = the level as it has always been
// (weather.ts's night storm over the office's two hard-coded footprints — the game byte for byte). A kind is a row of numbers for weather.ts to run: storm, rain,
// wind, the CLOUD COVER (one number 0‥1 — exposed for whoever owns the sun and the moon; nothing here touches them) and the FOG in the outdoor air. This file is
// tables and pure functions only (no game import): the mission list, the page's boot and the headless tools all read it.
//
// THE FOG IS ONE FIELD for the picture and for the simulation: extinction σ(y) = σ0 · e^(−y ∕ H) per metre in the open air (H 0 = uniform), × `leak` under a
// roof. composite.wgsl draws it along every pixel's ray (common.wgsl wxFogTau) and the men's eyes are cut by exactly it (weather.ts airTrans → guards.ts). So both
// read the SAME numbers the fog is QUANTISED into the 32 bits the renderer gets (packFog), and the simulation uses what unpackFog hands back.
import type { Vec3 } from '../math/vec';

export type Rect = [number, number, number, number];   // x0, z0, x1, z1
export type WeatherKind = 'clear' | 'overcast' | 'rain' | 'downpour' | 'fog' | 'dust' | 'snow';
/** the kinds a level can be STARTED in — the Weather row, `?weather=`. NOT 'snow': snow is a LEVEL's own weather (SNOW_LEVELS below), never picked for another */
export const WEATHER_KINDS: readonly WeatherKind[] = ['clear', 'overcast', 'rain', 'downpour', 'fog', 'dust'];

export interface FogSpec {
  /** extinction at the ground, per metre */ sigma: number;
  /** scale height (m): σ halves every 0.69 H; 0 = the same at every height */ H: number;
  /** how much of it stands under a roof (0‥1) */ leak: number;
  /** the colour it takes from the sky's horizon, and how bright (× skyHorizon) */ tint: Vec3; gain: number;
}
export interface WeatherPreset {
  title: string;
  /** one line for the mission list: what it does to the mission */
  words: string;
  /** weather.ts's own knobs: stroke frequency / nearness, the lattice's rate, the wind (m/s x, z) */
  storm: number; rain: number; wind: [number, number];
  /** cloud cover 0‥1: how much of the sky's own light (moon, sun) the weather takes. EXPOSED ONLY — the lights are not this file's */
  cloud: number;
  fog: FogSpec | null;
  /** snowfall 0‥1 (game/snowFx.ts: the flakes in the open air). The PICTURE's alone: no eye, ear or foot reads it. Absent = none */
  snow?: number;
}
/** The six to try. Central America: a dry-season night (clear / dust), the wet season (overcast → rain → a downpour with thunder), fog off the hills before dawn.
 *  Numbers judged on software-rendered stills only (see the page) — they are the maintainer's to move. */
export const WEATHER_PRESETS: Record<WeatherKind, WeatherPreset> = {
  clear:    { title: 'Clear',    words: 'dry and still: sound carries, nothing hides you but the dark', storm: 0, rain: 0, wind: [0.35, 0.15], cloud: 0.05, fog: null },
  overcast: { title: 'Overcast', words: 'dry under a low sky; at night as clear', storm: 0, rain: 0, wind: [0.8, 0.3], cloud: 0.9, fog: null },
  rain:     { title: 'Rain',     words: 'steady rain: footsteps and doors carry about half as far outdoors', storm: 0.25, rain: 0.55, wind: [1.1, 0.45], cloud: 0.95, fog: null },
  downpour: { title: 'Downpour', words: 'a tropical downpour with thunder: small sounds drown, a stroke lights everyone up', storm: 1, rain: 1, wind: [2.6, 1.0], cloud: 1, fog: { sigma: 0.02, H: 6, leak: 0.15, tint: [0.85, 0.9, 1], gain: 0.75 } },
  fog:      { title: 'Fog',      words: 'ground fog: nobody sees past about twenty metres outdoors', storm: 0, rain: 0, wind: [0.2, 0.1], cloud: 0.7, fog: { sigma: 0.113, H: 2.5, leak: 0.15, tint: [0.9, 0.95, 1], gain: 1 } },
  dust:     { title: 'Dust',     words: 'dry wind and dust in the air: far sight dulls, beams stand out', storm: 0, rain: 0, wind: [3.2, 1.2], cloud: 0.25, fog: { sigma: 0.03, H: 8, leak: 0.3, tint: [1, 0.8, 0.55], gain: 1 } },
  // SNOW: a level's own (SNOW_LEVELS). Every number the SIMULATION reads is Overcast's, to the digit: it plays as that level would under a low dry sky
  // (tools/qa/snow-check.ts holds a run in it to the same run in overcast). What it adds is drawn: `snow`, the flakes.
  snow:     { title: 'Snow',     words: 'snow falling on snow: the ground is bright, the air is quiet', storm: 0, rain: 0, wind: [0.8, 0.3], cloud: 0.9, fog: null, snow: 1.48 },
};
export function isWeatherKind(s: unknown): s is WeatherKind { return typeof s === 'string' && (WEATHER_KINDS as readonly string[]).includes(s); }

// ---- SNOW LEVELS (the maintainer, 10-14: 'we should probably curate snow levels and have the art be custom. seems like a lot to have it just be slapped on').
// Snow is not a weather laid over a level: it is the weather OF a level built for it — its ground, drifts, caps and paths are that level's own boxes and paint
// (tools/levels/pass.ts), and this file only says which levels those are, by name. On one of them, with the switch on, the Weather is born in the kind 'snow'
// (weather.ts levelKind) whatever the URL's ?weather= says; the page compiles the flakes' half of the particle shaders (render/frame.ts snowConfig → the scene
// prelude's `const WX_SNOW`). `SNOW.on`: ON in the page (`?snow=0` = such a level under the weather any level has), OFF in the module and on the frozen harness
// stand (`TPS_SNOW=1`). No other level reads any of it.
export const SNOW = { on: false };
// ---- THE SNOW'S LOOK (the maintainer on his first GPU look at the pass, 10-14: 'it does need to feel more organic. maybe we could do it with a height map or
// something like that? the rectangles don't seem to work. and i think we can make the material seem much cooler / feel like freshly fallen snow. and maybe we can
// even use the smoke sim for wisps of blowing snow?'). PICTURE ONLY, both: nothing in the simulation reads either word, and the level's boxes (what a boot, a round
// and a ray meet) are the ones the file has. `on`: a snow level's lying snow is ONE SURFACE (render/snowField.ts bakes the level's placed snow into a height field;
// shaders/snow.wgsl shades it and raises its drifts as a mesh) instead of painted boxes. `wisps`: the wind runs fine snow low over the open ground
// (game/snowFx.ts). ON in the page (`?snowlook=0`, `?snowwisps=0`), OFF in the module and on the frozen stand (`TPS_SNOWLOOK=1`, `TPS_SNOWWISPS=1`).
// `tracks` (10-14, his "deforms with character movement"): boots press a trail into the lying snow (game/snowTracks.ts; ?snowtracks=0, TPS_SNOWTRACKS=1). `glow`
// (his "maybe even has some subsurface scattering"): lamp light wraps past the terminator on snow and comes out bluer (the lighting shaders; ?snowglow=0,
// TPS_SNOWGLOW=1). Both picture only, both only where `on` draws the surface.
// `sparkle` (10-14, his "rdr2 has some nice \"sparkle\" on the snow on the ground"): on lit fresh snow a sparse set of grains each holds an ice facet that flashes
// when it mirrors a lamp to the eye, so the points come and go as the view moves (composite.wgsl, in the glow's light loop; ?snowsparkle=0, TPS_SNOWSPARKLE=1).
// Picture only, only where `on` draws the surface.
// `breath` (10-14, his "we should have steam from breaths in the cold levels too"): every living man standing under the open sky breathes out a small puff of steam
// on his own rhythm (game/snowBreath.ts; ?snowbreath=0, TPS_SNOWBREATH=1). Picture only; it needs a snow level and nothing else (not `on`: no surface is read).
// `steam` (10-20, his "the smoke from the gun muzzle is fine so maybe breath should just work like that"): that breath is real gas in the smoke solver — a source on
// each breathing man's mouth, on the fine lattice the gun's gas lives on — in place of the puffs, so it is lit, shadowed, blown and stirred as smoke is
// (game/snowBreath.ts BREATHSTEAM; ?breathsteam=0 = the puffs, TPS_BREATHSTEAM=1). Picture only; it needs `breath`, a snow level and a solver that is drawing.
// `grains` (10-14, on his GPU look at the wisps: "it should really feel like snow blowing around, which I think is much smaller/high frequency (maybe GPU
// particles would be the right fit?) and I love the way the snow dances around with stuff that feels like chaotic fluid dynamics, not just a single static
// pattern that lines up with the wind ... fancier snow close to the character and less fancy (like the current state) outside a radius"; "the nice thing of
// integrating with the fluid system is that you'll naturally get neat interactions where the wind hits a wall", "like vortices past the edge of the door";
// "overall this should be subtle"): near the view's middle the blown snow is thousands of fine GRAINS carried by a small fluid simulation of the wind over the
// level's floor — walls, boxes and door leaves its obstacles (render/airField.ts, game/airSim.ts, game/snowFx.ts updateGrains; ?snowgrains=0,
// TPS_SNOWGRAINS=1). Picture only; it needs a snow level and nothing else. The wisps stand back inside the grains' radius and ride the same air.
// `blast` (10-15, on his GPU: "grenades/he don't seem to really affect snow"): a blast over lying snow blows a crater into it, throws the loose snow about it up
// and out and shoves the wind's simulation (game/snowBlast.ts; ?snowblast=0, TPS_SNOWBLAST=1). Picture only; every blast the destruction feed tells, alike.
// `oneAir` (10-15, after tuning the pass on his GPU: the blown grains "look like the flakes but seem to behave differently. we should probably just unify those
// systems … it feels a bit weird with the flakes falling down and then the blown grains near the ground behaving so differently in a way that makes the air not
// feel physical as a fluid"; the wisps "are something else that we should think of physically. they're the wind blowing small [snow] particles that are near the
// surface, and then when the wind isn't strong enough, they fall back to the ground. so, they should show up when the wind is sufficiently strong"): ONE SNOW IN
// ONE AIR. Every flake falls through the simulated wind field among the walls and the open wind over them (particles.wgsl snowAir); the grains are no kind of
// their own (none is filed); a wisp is snow lifted off the ground only where the air over it is fast enough, carried at that air's own speed, gone where it slows
// (SNOWWISPS.liftLo / liftHi); a flake that lands in such air skips on (SNOWFX.skid). ?snowair=0, TPS_SNOWAIR=1. Picture only; needs the air field (?air).
// `marks` (10-15, his play of the pass: "pushed objects (like the chair) should impact the snow", "all physics objects can affect the snow", "it does look like a
// decal just getting splatted on ... animated a bit? or some GPU particles", "dependent on force"): every thing that moves over lying snow marks it (a pushed
// chair's legs, a rolling grenade, a slab of debris: game/snowMarks.ts), a mark FORMS (its floor sinks in over a moment, what it threw lands after) and kicks
// loose snow up, all by how hard it was made (game/snowTracks.ts stampMark; ?snowmarks=0, TPS_SNOWMARKS=1). Picture only; wants `tracks`.
// `past` (10-17, his play of the pass, of a view by the level's edge: "snowfall missing from bottom left of image"): the snow goes on FALLING past the
// level's rim. A flake high in the air is drawn well off its own ground, toward the camera's foot, so with the rim on the camera's side the flakes that
// would show over the picture's near part are ones in the air past the rim, and there were none: flakes were born, kept and drawn only inside the world's
// rectangle. With it the flakes' space is the view's disc out to SNOWFX.past m past the rim (game/snowFx.ts flakeOpen; particles_common.wgsl snowPast /
// flakeOpen). Nothing lies out there: the ground past the rim stays the dark it is. ?snowpast=0, TPS_SNOWPAST=1. Picture only.
// `under` (10-19, a review of the rule that hides a flake from a surface under a roof): the rule drew each roof's rectangle in by itself, so the seam where two slabs
// of one building meet was open to snow in the doorways on it, and it opened EVERY wall's top, the partitions' inside a building too. With this on a surface is
// under the roofs when it is a wall's thickness inside them on every side, whichever slab, and a top takes the snow only near the roofs' edge: the outer walls'
// (particles_common.wgsl flakeHidden, the prelude's SNOW_UNDER; ?snowunder=0, TPS_SNOWUNDER=1). Picture only.
export const SNOW_LOOK = { on: false, wisps: false, tracks: false, glow: false, sparkle: false, breath: false, steam: false, grains: false, blast: false, oneAir: false, marks: false, past: false, under: false };
export const SNOW_LEVELS: readonly string[] = ['pass', 'tut-sky'];
/** is the level called `name` (LevelData.name; a file's name without '.json') one built for snow — and the switch on? */
export function snowLevel(name: string | null | undefined): boolean { return SNOW.on && !!name && SNOW_LEVELS.includes(name); }
/** the same asked of a page's query: its `levelFile` */
export function snowLevelOfQuery(q: URLSearchParams): boolean { const lf = q.get('levelFile'); return !!lf && /^[\w.-]+\.json$/.test(lf) && snowLevel(lf.replace(/\.json$/, '')); }
/** a kind a checkpoint may carry: one of the row's, or a level's own */
export function isAnyKind(s: unknown): s is WeatherKind { return typeof s === 'string' && Object.prototype.hasOwnProperty.call(WEATHER_PRESETS, s); }
export function weatherTitle(k: WeatherKind | null): string { return k ? WEATHER_PRESETS[k].title : 'As it is'; }
export function weatherWords(k: WeatherKind | null): string { return k ? WEATHER_PRESETS[k].words : "the level's own weather, as it has always played"; }

// ---- the fog in 32 bits (frame.cardCfg.w; 0 = no fog): σ0 8 bits of 0.001 ∕ m · H 5 bits of 0.5 m · leak 3 bits ∕ 7 · tint 3 × 4 bits ∕ 15 · gain 4 bits of 0.25
const q = (x: number, step: number, max: number) => Math.max(0, Math.min(max, Math.round(x / step)));
export function packFog(f: FogSpec | null): number {
  if (!f || !(f.sigma > 0)) return 0;
  const s = Math.max(1, q(f.sigma, 0.001, 255)), h = q(f.H, 0.5, 31), l = q(f.leak, 1 / 7, 7), g = q(f.gain, 0.25, 15);
  const t = (i: number) => q(f.tint[i], 1 / 15, 15);
  return (s | h << 8 | l << 13 | t(0) << 16 | t(1) << 20 | t(2) << 24 | g << 28) >>> 0;
}
/** the fog's 32 bits with its GLOW (the gain) × k, on the gain's own 0.25 steps and never to nothing — hours.ts: by day the veil glows with the daylight there
 *  is, not with the sky a cloud deck brightens. The picture's alone: σ, H, the leak and the tint — everything an eye is tested through — are as packed. */
export function fogGlowWord(w: number, k: number): number {
  w >>>= 0; if (!w || k === 1) return w;
  const g = Math.max(1, Math.min(15, Math.round((w >>> 28) * k)));
  return ((w & 0x0FFFFFFF) | g << 28) >>> 0;
}
export function unpackFog(w: number): FogSpec | null {
  w >>>= 0; if (!w) return null;
  return { sigma: (w & 255) * 0.001, H: ((w >>> 8) & 31) * 0.5, leak: ((w >>> 13) & 7) / 7, tint: [((w >>> 16) & 15) / 15, ((w >>> 20) & 15) / 15, ((w >>> 24) & 15) / 15], gain: (w >>> 28) * 0.25 };
}
/** optical depth of the fog along the straight line a → b: the closed form of ∫ σ0 e^(−y ∕ H) (common.wgsl wxFogTau is this statement for statement), before any roof */
export function fogTau(f: FogSpec, a: Vec3, b: Vec3): number {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); if (!(L > 0)) return 0;
  if (!(f.H > 0)) return f.sigma * L;
  const ya = Math.max(a[1], 0) / f.H, k = (Math.max(b[1], 0) - Math.max(a[1], 0)) / f.H;
  return f.sigma * Math.exp(-ya) * L * (Math.abs(k) < 1e-3 ? 1 - 0.5 * k : (1 - Math.exp(-k)) / k);
}

// ---- a roof footprint in 32 bits (frame.cardCfg.y / .z; 0 = none): x0 z0 x1 z1, 8 bits each of 0.2 m
export const ROOF_Q = 0.2;
export function packRect(r: Rect | null | undefined): number {
  if (!r || !(r[2] > r[0]) || !(r[3] > r[1])) return 0;
  // rounded OUTWARD (a packed roof never shrinks: no strip of rain inside a wall; it grows by under ROOF_Q)
  const lo = (x: number) => Math.max(0, Math.min(255, Math.floor(x / ROOF_Q + 1e-6))), hi = (x: number) => Math.max(0, Math.min(255, Math.ceil(x / ROOF_Q - 1e-6)));
  return (lo(r[0]) | lo(r[1]) << 8 | hi(r[2]) << 16 | hi(r[3]) << 24) >>> 0;
}
export function unpackRect(w: number): Rect { w >>>= 0; return [(w & 255) * ROOF_Q, ((w >>> 8) & 255) * ROOF_Q, ((w >>> 16) & 255) * ROOF_Q, (w >>> 24) * ROOF_Q]; }
export const inRect = (r: readonly number[], x: number, z: number) => x >= r[0] && z >= r[1] && x <= r[2] && z <= r[3];

// ---- the choice: on the URL only (not kept per machine — a plain URL is always the level as it is)
/** the weather the NEXT Game is born in (null = as it is). Set before the game is stood up: main.ts from ?weather=, tools/qa/playthrough.ts from
 *  --set '{"WEATHER":{"kind":"fog"}}'. `locked` (the PAGE: raised by initWeather) = the weather is the URL's for the page's whole life — the renderer's half is a
 *  compile-time const fixed at boot (render/frame.ts weatherKindConfig), so Weather.setKind refuses any other kind and a checkpoint made in another weather is
 *  refused by canLoad; headless (never locked) a checkpoint / a journal's frame 0 puts its own kind in. */
export const WEATHER_BOOT: { kind: WeatherKind | null; locked: boolean; packed: boolean } = { kind: null, locked: false, packed: true };   // (packed: the picture reads all four roofs — false only on a page whose shaders were compiled without the weather kinds' half, where WX_OWN then stands down: main.ts)
/** THE LEVEL'S OWN STORM RAINS BY THE LEVEL'S OWN ROOFS (weather.ts syncRoofs). With no weather picked the night storm cut its rain, its wet men, its wind and its
 *  rain bed by the OFFICE's two rectangles on every level — on a level whose building is another shape (the records office, the compound, the barracks) that left
 *  the open ground inside the office's footprint dry and still, and rained through whatever roof lay outside it. `roofs` true = such a level's storm is cut by its
 *  own ceiling slabs (roofsOf), exactly as a picked weather's is; the office and the levels built in its shell keep the two rectangles to the bit. ON in the page
 *  (`?ownroofs=0` = as it was), OFF in the module and on the frozen harness stand (`TPS_OWNROOFS=1`). Read every frame: it flips on a running game.
 *  `wind` (10-14, the maintainer of the pass: "ideally the snow particles and wisps all share a wind field too. and that could also integrate with the smoke
 *  system too?"): ONE WIND FIELD OUTDOORS, ROOF BY ROOF (wind.ts syncField, render/shaders/wind_field.wgsl windStormRoofs). The storm record held two rectangles,
 *  so a level of three or four roofs of its own handed it their BOUNDING BOX — on a level built round a yard (the pass, the compound) that box is the yard: flakes
 *  fell plumb there, smoke there did not lean, and the wisps had to run on the storm's raw vector. True = such a level's storm blows wherever none of its roofs is
 *  overhead, in the particles, in the smoke solver and for whoever asks the CPU (`Wind.at`), and the wisps read that field where they are. A level of one or two
 *  roofs keeps the rectangles it had, by value. THIS ONE CHANGES PLAY on a level of three or four roofs: smoke in a yard bends to the storm, and smoke is what
 *  every eye looks through. ON in the page (`?wxwind=0` = as it was), OFF in the module and on the frozen stand (`TPS_WXWIND=1`). Read every frame. */
export const WX_OWN = { roofs: false, wind: false };
export const WEATHER_KEY = 'weather';
export function weatherOfSearch(search: string | URLSearchParams): WeatherKind | null {
  const v = (typeof search === 'string' ? new URLSearchParams(search) : search).get(WEATHER_KEY);
  return isWeatherKind(v) ? v : null;
}
/** read ?weather= at boot; an unknown name is said once and boots the level as it is */
export function initWeather(qs: URLSearchParams): WeatherKind | null {
  const v = qs.get(WEATHER_KEY);
  if (v !== null && v !== '' && !isWeatherKind(v) && v !== 'default') console.warn(`?weather=${v}: not a weather (${WEATHER_KINDS.join(' | ')}) — the level's own`);
  WEATHER_BOOT.locked = true;
  return WEATHER_BOOT.kind = isWeatherKind(v) ? v : null;
}
/** the query string `search` ('?a&b=c' or '') with the weather put on it (null = taken off) — every other flag kept, in order */
export function weatherSearch(search: string, kind: WeatherKind | null): string {
  const all = search.replace(/^\?/, '').split('&'), parts = all.filter(p => p && p.split('=')[0] !== WEATHER_KEY);
  if (!kind && !all.some(p => p.split('=')[0] === WEATHER_KEY)) return search;   // (nothing to take off: the string it was, to the character)
  if (kind) parts.push(`${WEATHER_KEY}=${kind}`);
  return '?' + parts.join('&');
}
