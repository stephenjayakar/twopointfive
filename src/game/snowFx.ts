// SNOW — the flakes in the air of a level built for snow (weatherKinds.ts SNOW_LEVELS; the maintainer, 10-14: 'curate snow levels and have the art be custom').
// The snow that LIES is that level's own boxes and paint (tools/levels/pass.ts): nothing here or in any shader lays snow on a surface. What falls is drawn by the
// particle rain's machinery in another dress — the same third ring of GPU slots, the same emit record, the same shadow-tested lights and wind field — with the
// rain's own half of it untouched: a page is one level for its life, a snow level never draws rain (weather.ts hands it rain 0), and the flake's statements sit
// behind the scene prelude's `const WX_SNOW` (render/frame.ts snowConfig), dead code on every other page.
//   A FLAKE   falls at ~1.25 m/s against the rain's 9 — so it rides the AIR almost whole (drag = gravity ÷ fall: it answers a gust in a tenth of a second where a
//             drop takes most of one), sways on its own slow flutter, and lands without a splash (particles.wgsl rainStep under WX_SNOW). It is a diffuse white
//             scatterer, not water: a broad phase, no glint, nothing refracted, drawn as a soft round dot (particles_draw.wgsl rainFragment under WX_SNOW).
//   THE DISC  round the view's look-at point, as the rain's. A flake is in the air for seconds, so two things the rain never needed: what is MISSING of the
//             population is laid through the slab's whole HEIGHT at once (a fresh disc is full now, not after the first flakes have come down from the top;
//             the steady trickle enters at the top, as snow does), and a flake that leaves the disc's
//             square is carried round to the far side of it at its height (the wrap: frame.weatherE carries the disc, its lattice share 0 — or, NEGATIVE, the metres past the level's rim the snow goes on falling: SNOW_LOOK.past) — the view moves at a
//             walk or a cut and the air it comes to is already snowing.
//   NOBODY    reads any of it: no eye, ear or foot. Its dice are its own (never Math.random, never the game's die). Play under snow is play under Overcast, to
//             the run digest (tools/qa/snow-check.ts).
//   WISPS     (the switch weatherKinds.ts SNOW_LOOK.wisps; the maintainer, 10-14: 'it does need to feel more organic … wisps of blowing snow'). Spindrift: fine snow
//             the wind runs low over the open ground in streamers. A wisp is one more particle of the same ring, told from a flake by the ASPECT it is filed with
//             (2: every flake's is 1) — born in the bottom half metre over open ground inside the view's disc, and only where a GUST PATCH lies (a noise stretched
//             along the wind and carried down it: the emit kernel throws its tries until one lands in a patch, so no slot is spent on a wisp that is not born), it
//             runs with the wind field's air × its own speed, snakes on a slow crosswind meander, slides over what faces up, piles against a wall and is gone,
//             dies under a roof; it is lit by the flake's own shadow-tested lights and drawn as a long soft streak along its motion, nearly all light and hardly
//             any cover, so many of them lie over one another as a veil (particles.wgsl wispStep, particles_draw.wgsl wispVertex — every statement behind the
//             prelude's `const SNOW_WISPS`). Its three live numbers ride in the rain look's refraction slots, which a snow level never reads (refraction is off).
//             Off (the switch, or no wind): nothing is filed and every flake statement runs as it did. tools/qa/snowwisps-check.ts.
//   GRAINS    (the switch SNOW_LOOK.grains; the maintainer on the wisps on his GPU, 10-14: 'it should really feel like snow blowing around, which I think is much
//             smaller/high frequency (maybe GPU particles would be the right fit?) … chaotic fluid dynamics, not just a single static pattern that lines up with
//             the wind … fancier snow close to the character and less fancy (like the current state) outside a radius'; 'overall this should be subtle'). Inside
//             a radius of the view's middle the blown snow is thousands of fine grains, a third kind in the same ring (aspect 3). A grain's SLOT is filed with a
//             flake's life (the ring retires in order: a short-lived record would only wait behind the flakes), and in that time the GPU picks the grain up off
//             the ground, flies it a second or two and lays it down again, over and over (particles.wgsl grainStep) — carried by the AIR FIELD, a small fluid
//             simulation of the wind over the level's floor with the walls and door leaves as its obstacles (render/airField.ts; game/airSim.ts feeds it), so
//             the snow runs round a wall's end, jets through a gap and curls behind a door's edge. With them on, the wisps stand back from the view's middle
//             and ride the same air. Off: nothing is filed, no field is built, the wisps as they were. tools/qa/snowgrains-check.ts.
import { SideMap } from '../math/side';
import { Vec3, clamp } from '../math/vec';
import type { Game } from './game';
import type { FollowCamera } from './camera';
import type { WeatherFrame } from '../render/frame';
import { snowConfig, snowLookConfig } from '../render/frame';
import type { Particles } from '../render/particles';
import { RAIN_MAX_BIRTHS, RAIN_CAP } from '../render/particles';
import { gpuFx } from './particleFx';
import { WORLD } from '../scene/world';
import { SNOWTRACKS } from './snowTracks';
import { SNOW_LOOK, WX_OWN } from './weatherKinds';
import { windOf } from './wind';
import { airSimStats, airLive, airWant } from './airSim';
import { stepSnowBlast, snowBlastFeed, snowBlastPuffs, snowBlastThrow } from './snowBlast';

/** The numbers (judged on software-rendered stills only — the maintainer's to move; `__snow.fx` on the console, live). Authored data, not player switches. */
export const SNOWFX = {
  perM2: 34.6,        // (the maintainer's, tuned on his GPU 10-15 with the weather's snowfall at 1.48: together far past the cap below — the look he passed is the cap's worth of flakes in view; was 12)
                      // flakes in the air over a square metre of open ground at snowfall 1 (the slab is the weather's rain top: 7 m)
  fallV: 1.25,        // m/s: a flake's terminal fall (× 0.8‥1.2 per flake on the GPU, off its seed)
  size: 0.028,        // m across at size jitter 1 (drawn soft: it reads smaller) — the maintainer's, 10-15 (was 0.05)
  sizeJit: 0.6,
  flutter: 0.41,      // m/s: the sway a flake adds of its own to the air it rides — the maintainer's, 10-15 (was 0.3)
  flutterRate: 2.2,   // rad/s of that sway (× 0.6‥1.6 per flake)
  // how a flake scatters the lights that reach it (the rain's phase function with a snow crystal's numbers: broad, a mild forward lobe, no glint)
  iso: 0.26, fwdK: 0.25, fwdG: 0.45, gain: 9,   // (iso: the maintainer's, 10-15; was 0.75)
  skyK: 1.5,            // × the sky dome's light on a flake (1 = a white scatterer's honest share; over it = the licence that lets snow be seen falling through a yard no lamp reaches)
  brightJit: 0.5,     // a few big bright ones among many fine
  minPx: 1, maxPx: 4, boostCap: 1.5, nearFadeM: 2.6,
  fadeIn: 0.4,        // s: a flake born in mid air comes up, it does not pop
  shutter: 1 / 120,   // s of its motion one flake shows: a dot, not a streak
  windK: 1.0,         // × the air's velocity on the flakes
  sheetAmp: 0.3, sheetLen: 9, sheetDrift: 1.0,   // denser and thinner curtains crossing the yard, carried downwind
  radiusK: 0.75, radiusMin: 10, radiusMax: 30,   // the disc = this × the camera distance (wider than the rain's: a flake drifts metres on its way down)
  past: 12,           // m past the level's rim the snow goes on falling, inside the view's disc (SNOW_LOOK.past; 0 = no flake past the rim) — live
  // ---- ONE SNOW IN ONE AIR (SNOW_LOOK.oneAir; particles.wgsl snowAir): the air a flake falls through — all LIVE
  airLow: 2.0,        // m: under this the air is the simulated field's (the walls' own: slack in a lee, fast through a gap) …
  airHigh: 3.4,       // … over this the open wind; between, blended (a wall's top is at 3 m)
  airLift: 1,         // × the field's lift (air going up and over what it meets)
  skid: 0.75,         // the chance a flake landing where the air is fast enough to lift snow (SNOWWISPS.liftLo ‥ liftHi) skips on along the ground instead of lying (0 = every flake lies where it lands)
};

/** The WISPS' numbers (judged on software-rendered stills only, never seen moving — the maintainer's to move; `__snow.wisps` on the console, live: speedK / opacity /
 *  gain at once, the rest with the next births — a wisp lives a few seconds). Authored data, not player switches. */
export const SNOWWISPS = {
  perM2: 3,           // wisps over a square metre of open ground inside the view's disc at a steady blow (they gather into the gust patches: several times this there, none between)
  max: 1000,          // … and no more than this alive (the ring is the flakes' first: at this many the flakes keep their own cap of 4000)
  life: 4.5,          // s (× 1 ± lifeJit per wisp)
  lifeJit: 0.25,
  y0: 0.04, y1: 0.42, // m: born between these heights over the ground
  size: 0.6,          // m across at birth (× 1 ± sizeJit; it widens by three fifths over its life)
  sizeJit: 0.5,
  speedK: 5,          // × the wind field's air at the ground (WX_OWN.wind: the field's where the wisp IS — nothing in a roof's lee; off: the storm's own vector everywhere open): the snow's weather is a quiet 0.85 m/s (0.5 at the ground) and spindrift at that speed does not read as blowing — LIVE
  stretch: 0.12,      // s of its own motion a wisp is drawn along (× 0.6‥1.4 per wisp): its length = its speed × this (0.3 when it was a combed streak: a puff only leans)
  motes: 0.55,        // 0‥1: A PUFF OF FINE SNOW — how many motes a puff holds (his 10-15 clip of a ground blizzard: "gentle, shimmering puffs of very small, a little
                      // sparkly particles"); 0 = the combed streak of before ("stretched out particle billboards"; with stretch 0.3). Sixteenths; reaches the wisps filed next
  sparkle: 0.5,       // 0‥1: how hard a mote glints now and then (0 = none). Sixteenths too
  opacity: 0.3,       // the streak's peak weight at its core (× 0.5‥1.5 per wisp) — LIVE
  gain: 2,            // × the light a flake would show there — LIVE
  meander: 0.8,       // m/s of crosswind sway on a slow noise the wisps run through (they snake together)
  gustLen: 5,         // m across a gust patch (three times as long down the wind)
  gustPow: 3,         // births × (the storm's gust this frame)^this: they come and go with the wind's own gusting (wind.ts stormGustAmp)
  minAir: 0.15,       // m/s: under this much storm air nothing blows
  // ---- ONE SNOW IN ONE AIR (SNOW_LOOK.oneAir): a wisp is snow the wind LIFTS off the ground — all LIVE. The speeds are the air's at the ground, in m/s as the
  // wind sim's row shows them (the pass: 0.47 with no gust, 0.3 ‥ 0.63 through one, more where the walls squeeze it). speedK, gustLen, gustPow are not read then.
  liftLo: 0.42,       // m/s: air slower than this lifts nothing …
  liftHi: 0.7,        // … at this every wisp that tries is lifted (between: as many as the air is fast)
  dropK: 0.7,         // × liftLo: in air slower than this a wisp sinks back and is gone
};
/** The GRAINS' numbers (never seen on a GPU, never seen moving — the maintainer's to move; `__snow.grains` on the console: all LIVE but `max`, `size` and
 *  `sizeJit`, which reach the grains filed next — every slot is refiled inside nine seconds). Authored data, not player switches. */
export const SNOWGRAINS = {
  max: 2600,          // grains' slots in the ring: each lies or flies (how many fly is the air's doing — a third to a half in a steady blow, nearly all in a gust)
  radius: 9,          // m about the view's middle they live in; they thin over its outer third, where the wisps take over
  size: 0.02,         // m across (× 1 ± sizeJit): fine snow — on screen a pixel or two
  sizeJit: 0.5,
  speedK: 5,          // × the air field's velocity = a flying grain's (the wisps' own speedK: at the snow's quiet 0.85 m/s of storm nothing reads as blowing; the field itself stays the game's air as it is)
  opacity: 0.5,       // a grain's weight (× 0.5‥1.5 per grain)
  gain: 1.5,          // × the light a flake would show there
  eddy: 0.45,         // the small eddies added on top of the field's air, as a share of that air's speed
  lift: 1,            // × the field's lift (air going up and over what it meets)
  wispsKeep: 0.6,     // × the wisps' cap while the grains run (the ring is shared: at 1 the flakes' cap falls by about a fifth)
  wispsBack: 0,       // 0‥1 how far the wisps stand back from the view's middle while the grains run (1 = thinned to nothing inside the grains' radius, as the
                      // grains first shipped; 0 = wisps everywhere, with the grains: the maintainer, 10-15, "i actually like the far wisps … maybe we could
                      // have both the near and far ones everywhere?") — LIVE
  minAir: 0.15,       // m/s: under this much storm air nothing blows
  // how a flying grain is DRAWN (the maintainer on his GPU, 10-15: "the long wisps do look like a stretched particle" — each was a hard line along 1∕45 s of its
  // flight, 10‥20 cm, all one way): a short dash with a fading tail. All three LIVE on the grains in the air (particles_draw.wgsl grainVertex)
  shutter: 0.008,     // s of its own motion a grain is drawn along (0 = a round dot)
  dash: 3,            // … but never longer than this many of its own widths (0‥15)
  tail: 0.8,          // how far the dash's tail end fades (0 = an even line, 1 = to nothing)
};

export interface WispStats { active: boolean; why: string; target: number; blow: number; births: number; totalBirths: number; records: number; }
export interface GrainStats { active: boolean; why: string; target: number; pop: number; births: number; totalBirths: number; records: number; radius: number; air: boolean; u0: number; wind: [number, number]; }
export interface SnowStats { active: boolean; why: string; radius: number; centre: [number, number]; areaOut: number; target: number; capped: boolean; pop: number; births: number; totalBirths: number; frames: number; }
interface SnowState { seed: number; serial: number; birthAcc: number; pop: number; lastEmitted: number; fillAt: number; wasActive: boolean; bandOff: [number, number]; stats: SnowStats;
  /** WISPS: their own record serial and birth carry (the flakes' dice are never advanced by a wisp); the flake births filed since the ring last took any (the ring's running count is both kinds': the flakes are dealt first, so theirs is the first of it) */
  wSerial: number; wAcc: number; flakeFiled: number; wisps: WispStats;
  /** GRAINS: their own record serial, the steady refiling's carry, and what is still owed of the first set (−1 = not yet reckoned: the ring holds none of them) */
  gSerial: number; gAcc: number; gFill: number; gHold: number; gSeen: boolean; grains: GrainStats;
  /** ONE SNOW IN ONE AIR was in force last frame (oneAirCfg) */
  oneAir: boolean; }
const states = new SideMap<Game, SnowState>('snowFx.states');
function stateOf(g: Game): SnowState {
  let s = states.get(g);
  if (!s) { s = { seed: 0x5a0f1a4e, serial: 1, birthAcc: 0, pop: 0, lastEmitted: -1, fillAt: -1, wasActive: false, bandOff: [0, 0], stats: { active: false, why: 'never run', radius: 0, centre: [0, 0], areaOut: 0, target: 0, capped: false, pop: 0, births: 0, totalBirths: 0, frames: 0 },
    wSerial: 1, wAcc: 0, flakeFiled: 0, wisps: { active: false, why: 'never run', target: 0, blow: 0, births: 0, totalBirths: 0, records: 0 },
    oneAir: false, gSerial: 1, gAcc: 0, gFill: -1, gHold: 0, gSeen: false, grains: { active: false, why: 'never run', target: 0, pop: 0, births: 0, totalBirths: 0, records: 0, radius: 0, air: false, u0: 0, wind: [0, 0] } }; states.set(g, s); }
  return s;
}
function nextSeed(s: SnowState): number { let x = (s.serial++ * 2654435761) >>> 0; x = (x ^ 61) ^ (x >>> 16); x = (x + (x << 3)) >>> 0; x ^= x >>> 4; x = Math.imul(x, 0x27d4eb2d) >>> 0; x ^= x >>> 15; return (x ^ s.seed) >>> 0; }
/** reseed the recycler (probes / captures: same seed → the same flakes) */
export function seedSnow(g: Game, n: number) { const s = stateOf(g); s.seed = n >>> 0; s.serial = 1; s.birthAcc = 0; s.pop = 0; s.lastEmitted = -1; s.fillAt = -1; s.bandOff[0] = 0; s.bandOff[1] = 0; s.wSerial = 1; s.wAcc = 0; s.flakeFiled = 0; s.gSerial = 1; s.gAcc = 0; s.gFill = -1; s.gSeen = false; }
function nextWispSeed(s: SnowState): number { let x = (s.wSerial++ * 2246822519) >>> 0; x = (x ^ 61) ^ (x >>> 16); x = (x + (x << 3)) >>> 0; x ^= x >>> 4; x = Math.imul(x, 0x27d4eb2d) >>> 0; x ^= x >>> 15; return (x ^ s.seed ^ 0x77159) >>> 0; }
function nextGrainSeed(s: SnowState): number { let x = (s.gSerial++ * 3266489917) >>> 0; x = (x ^ 61) ^ (x >>> 16); x = (x + (x << 3)) >>> 0; x ^= x >>> 4; x = Math.imul(x, 0x27d4eb2d) >>> 0; x ^= x >>> 15; return (x ^ s.seed ^ 0x6a41) >>> 0; }
export function wispStats(g: Game): WispStats { return stateOf(g).wisps; }
export function grainStats(g: Game): GrainStats { return stateOf(g).grains; }
/** do the grains run this frame (the switch, on a level in snow, on a page whose shaders were built with them — a grain filed to shaders that do not know one is
 *  stepped and drawn as a flake that never lands)? */
export function grainsOn(g: Game): boolean { return SNOW_LOOK.grains && !SNOW_LOOK.oneAir && snowLookConfig.grains && snowing(g) && airLive(g); }
/** ONE SNOW IN ONE AIR this frame (SNOW_LOOK.oneAir, on a level in snow, on a page whose particle shaders read the air field — snowLookConfig.grains is that
 *  compile switch — and with a field to read)? Then no grain is filed, the flakes and the wisps ride snowAir, and the wisps are lifted by the air's own speed.
 *  With no field (`?air=0`, a device that built none) the snow is the flakes and the wisps as they were before the grains. */
export function oneAirOn(g: Game): boolean { return SNOW_LOOK.oneAir && snowLookConfig.grains && snowing(g) && airLive(g); }   // (… and only where there is air for them to ride: with no field — `?air=0`, a device that could not build one — none is filed, and the flakes and wisps keep the whole ring)
/** do wisps run this frame (the switch, on a level in snow — and on a page whose shaders were built with them: a wisp filed to shaders that do not know one is
 *  stepped and drawn as a flake a foot across)? */
export function wispsOn(g: Game): boolean { return SNOW_LOOK.wisps && snowLookConfig.wisps && snowing(g); }
export function snowStats(g: Game): SnowStats { return stateOf(g).stats; }
/** was the snow one snow in one air on the last frame stepped (the page's `__snow.oneAir`, the checks)? */
export function oneAirActive(g: Game): boolean { return stateOf(g).oneAir; }
/** is this frame a snow level's (the weather handed a snowfall over)? — rainFx.ts asks first and stands down */
/** SNOW OVER A WALL'S FACE — particles_common.wgsl flakeHidden on the CPU (the same rule, the same number; tools/qa/snow-check.ts `walls` holds the two together).
 *  Is the surface point (x, y, z) one that shows no snow in front of it: UNDER one of the level's roofs — inside its rectangle drawn in by FLAKE_WALL_IN and below
 *  the ceiling. A wall's outer face, the door in it and the wall's top are in the open (the rectangle is the outer walls grown by centimetres, so a test of the bare
 *  rectangle hid the snow over every outer wall). Picture only: nothing in the game asks this. */
export const FLAKE_WALL_IN = 0.2;   // m
export function flakeHidden(roofs: readonly (readonly number[])[], x: number, y: number, z: number, ceilY: number, wallIn = FLAKE_WALL_IN): boolean {
  if (y > ceilY - 0.05) return false;
  for (const R of roofs) if (x >= R[0] + wallIn && z >= R[1] + wallIn && x <= R[2] - wallIn && z <= R[3] - wallIn) return true;
  return false;
}
/** SNOW PAST THE LEVEL'S RIM (SNOW_LOOK.past) — particles_common.wgsl flakeOpen on the CPU: may a flake be in the air over ground point (x, z)? Under none of
 *  `roofed`'s roofs, and inside the world's rim grown by `past` m; with past 0 it is the rain's own rule (a quarter metre INSIDE the rim), as it was. A flake high in
 *  the air is drawn well off its own ground toward the camera's foot, so with the rim on the camera's side the near part of the picture is snowed on by flakes that
 *  are past the rim. Nothing lies out there: wisps, kicks and prints keep the world's rim. Picture only. */
export function flakeOpen(roofed: (x: number, z: number) => boolean, x: number, z: number, past: number): boolean {
  const x0 = WORLD.min[0], z0 = WORLD.min[2], x1 = WORLD.max[0], z1 = WORLD.max[2];
  if (past <= 0) return x > x0 + 0.25 && z > z0 + 0.25 && x < x1 - 0.25 && z < z1 - 0.25 && !roofed(x, z);
  return x > x0 - past && z > z0 - past && x < x1 + past && z < z1 + past && !roofed(clamp(x, x0 + 0.26, x1 - 0.26), clamp(z, z0 + 0.26, z1 - 0.26));   // (past the rim: the roof rule of the rim beside it)
}
/** is ground point (x, z) past the world's rectangle (particles_common.wgsl pastWorld) */
export const pastWorld = (x: number, z: number): boolean => x < WORLD.min[0] || z < WORLD.min[2] || x > WORLD.max[0] || z > WORLD.max[2];
/** Past the rim the fall thins sooner toward the disc's edge than inside it (shares of the disc's radius; particles_common.wgsl PAST_RIM_IN / PAST_RIM_OUT hold
 *  the same two). The ring's flakes are a fixed number spread over all the open air in the disc, and a flake past the rim shows only over the near part of the
 *  picture: with the level's own taper (0.7‥1) the fall by an edge was a quarter thinner than in the middle of the yard; with this one it is the yard's. */
export const PAST_TAPER = [0.5, 0.8] as const;
/** the share of throws kept at `r01` of the disc's radius, over ground at (x, z): the emit kernel's own acceptance, and the sooner one past the world's rim */
export function flakeTaper(r01: number, x: number, z: number, past: number, sooner: readonly [number, number] = PAST_TAPER): number {
  if (past <= 0 || !pastWorld(x, z)) return rimTaper(r01);
  const t = clamp((r01 - sooner[0]) / (sooner[1] - sooner[0]), 0, 1); return Math.min(rimTaper(r01), 1 - t * t * (3 - 2 * t));
}
/** how far past the rim the snow falls this frame (m): the switch and the number, 0 = not at all */
export const snowPastM = (): number => SNOW_LOOK.past ? clamp(SNOWFX.past, 0, 40) : 0;
export function snowing(g: Game): boolean { return ((g.engine as { weather?: WeatherFrame }).weather?.snow ?? 0) > 0.001; }

const DOWN: Vec3 = [0, -1, 0];
const num = (v: unknown, d: number) => typeof v === 'number' && Number.isFinite(v) ? v : d;
const rimTaper = (r01: number) => { const t = clamp((r01 - 0.7) / 0.3, 0, 1); return 1 - t * t * (3 - 2 * t); };   // (the emit kernel's own acceptance toward the disc's rim)

/** Once a frame, in the rain recycler's place (game.ts → rainFx.ts updateRainFx, after the weather and the wind, before render). */
export function updateSnowFx(g: Game, dt: number, cam: FollowCamera) {
  const st = stateOf(g); const S = st.stats; const F = SNOWFX;
  stepSnowBlast(g, dt);   // (a blast in the snow, snowBlast.ts: what is still throwing ages — before anything is filed for it below)
  const e = g.engine as unknown as { settings: Record<string, unknown>; weather?: WeatherFrame };
  const wf = e.weather; const set = e.settings; const P: Particles | null = gpuFx(g);
  const snow = Math.max(0, wf?.snow ?? 0);
  const why = !P ? 'no GPU particles' : !wf ? 'no weather frame' : snow <= 0.001 ? 'no snow' : set.particleRain !== true ? 'the particle rain is off (?norain2 / the panel): the flakes are its ring' : !snowConfig.on ? 'this page was not opened on a snow level (the flake\'s shader half is compiled at boot)' : '';
  if (why) {
    if (st.wasActive) { P?.clearRain(); st.wasActive = false; st.birthAcc = 0; st.pop = 0; st.fillAt = -1; }
    S.active = false; S.why = why; S.births = 0; S.target = 0; S.pop = 0;
    { const Ws = st.wisps; Ws.active = false; Ws.why = why; Ws.births = 0; Ws.target = 0; st.wAcc = 0; st.flakeFiled = 0; }
    grainsOff(st, P, why);
    if (P) oneAirCfg(g, st, P, false);
    return;
  }
  const Pp = P!; const w = wf!; const W = g.weather;
  st.wasActive = true; S.active = true; S.why = 'snowing'; S.frames++;
  // the kind's numbers, as the flake's step and splat read them (particles.ts KindParams, RAIN's slots): terminal fall = gravity ÷ drag; no splash (the step ends a
  // landed flake); the fade-in; the shutter
  const kp = Pp.params.rain;
  kp.drag = kp.gravity / F.fallV; kp.sleepV = 0.02; kp.holdOrFade = F.fadeIn; kp.shutterOrGrowth = F.shutter; kp.brightOrOpacity = 1; kp.restitution = num(set.particleRainReact, 6);
  // the look block: a flake's phase; the rain's water — glint, tail, refraction, beads, length spread — all off. Under WX_SNOW the glint's idle slots carry the sky's weight (rainCfg.w) and the
  // flutter (particles.wgsl rainStep: rainCfgB.x m/s, rainCfgB.y rad/s)
  const L = Pp.rainLook;
  L.iso = F.iso; L.fwdK = F.fwdK; L.fwdG = F.fwdG; L.gain = F.gain; L.glintK = F.skyK; L.glintRough = F.flutter; L.glintCap = F.flutterRate; L.tailKeep = 0;
  L.refract = 0; L.refractPaint = 0; L.lenJit = 0; L.brightJit = F.brightJit; L.minPx = F.minPx; L.maxPx = F.maxPx; L.boostCap = F.boostCap; L.nearFadeM = F.nearFadeM; L.beadAmp = 0;
  L.windK = F.windK; L.sheetAmp = F.sheetAmp; L.sheetLen = F.sheetLen;
  if (w.phase && w.phase[3] !== 0) w.phase = [0, 0, 0, 0];   // (no lattice here to share a phase with)
  // the curtains ride the air the flakes ride
  { const storm = g.wind.byName('storm'); const on = !!storm && storm.speed > 0;
    const ax = on ? storm.dir[0] * storm.speed * F.windK : 0, az = on ? storm.dir[2] * storm.speed * F.windK : 0;
    st.bandOff[0] += ax * F.sheetDrift * dt; st.bandOff[1] += az * F.sheetDrift * dt;
    L.bandOffX = st.bandOff[0]; L.bandOffZ = st.bandOff[1]; }
  // ---- the disc, and the open ground inside it (1 m cells by their centres, under the rim's taper — what the GPU's per-flake rejection integrates to)
  const rSet = num(set.particleRainRadius, 0);
  const R = rSet > 0 ? clamp(rSet, 3, 40) : clamp(F.radiusK * cam.distance, F.radiusMin, F.radiusMax);
  const cx = cam.target[0], cz = cam.target[2];
  const roofed = (x: number, z: number) => !!W?.underRoof(x, z);
  const past = snowPastM();   // (SNOW_LOOK.past: the flakes' own air goes on this far past the rim — `area` below is theirs, `inside` the ground snow can LIE on, be lifted off, be kicked up from: inside the world's rim)
  let area = 0, inside = 0;
  // (WISPS ON THE WIND FIELD, WX_OWN.wind: `blown` = that open ground weighed by the share of the storm's wind the field has over it — nothing in a roof's lee —
  // which is what the GPU's own throws then keep of a wisp record, particles.wgsl wispGust × wispShare. The flakes' `area` is not touched.)
  const onField = WX_OWN.wind && wispsOn(g); let blown = 0;
  { const x0 = Math.floor(cx - R), x1 = Math.ceil(cx + R), z0 = Math.floor(cz - R), z1 = Math.ceil(cz + R);
    for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) { const px = x + 0.5, pz = z + 0.5; const r = Math.hypot(px - cx, pz - cz) / R; if (r >= 1) continue;
      if (!flakeOpen(roofed, px, pz, past)) continue;
      const k = flakeTaper(r, px, pz, past); area += k;
      if (past > 0 && pastWorld(px, pz)) continue;   // (past the rim: the flakes' air only)
      inside += k; if (onField) blown += k * g.wind.stormShare(px, pz); } }
  const top = w.rainTop > 0 ? w.rainTop : 7;
  const want = F.perM2 * snow * area * num(set.particleRainDensity, 1);
  // A flake is in the air for one whole fall (`air`) and is FILED with the slowest flake's (the ring retires slots in order, by the life they were filed with).
  // Two kinds of birth: the steady TRICKLE enters at the top of the slab, target ÷ air a second, as snow does; the MAKE-UP — the first frame of a level, a restart,
  // a cut to open ground — is laid through the slab's whole height at once, so the air is full now and not six seconds from now. A fill of N emptying off the
  // bottom as the trickle comes in at the top is N in the air throughout: births in, pop ÷ air out, is the same sum.
  const air = Math.max(0.3, top / F.fallV);
  const life = (top + 0.3) / (F.fallV * 0.8) * 1.1 + 0.4;   // (a tenth over: the flutter and a gust's lift)
  const sheetK = 1 + clamp(F.sheetAmp, 0, 0.95);   // (the curtains thin births on the GPU: (1 + amp) × as many are filed, as the rain's sheets are)
  const wOn = wispsOn(g), gOn = grainsOn(g), oa = oneAirOn(g);
  const wispMax = SNOWWISPS.max * (gOn && st.grains.active ? clamp(SNOWGRAINS.wispsKeep, 0, 1) : 1);   // (fewer only while grains are in the air: in a wind too light to lift them the wisps are all the blown snow there is)
  const grainSlots = gOn ? grainCap() * (st.gHold > 0 ? 2.06 : 1.06) + 64 : 0;   // (GRAINS: a slot each for a flake's life, the hand-over between two records, a margin — and twice that while a first set's slots wait out their life behind the refills)
  const wispSlots = wOn ? wispMax / Math.max(0.5, SNOWWISPS.life) * (Math.max(life, SNOWWISPS.life * (1 + SNOWWISPS.lifeJit)) + dt + 0.1) : 0;   // (WISPS: the slots theirs hold at their cap — a wisp's waits out the flakes filed ahead of it, the ring retires in order)
  const ringMost = (RAIN_CAP * 0.92 - wispSlots - grainSlots) / (sheetK * (1 + (life + dt + 0.1) / air));   // (the ring holds a whole make-up fill AND the trickle filed while that fill's slots wait out their life)
  const cap = Math.max(0, Math.min(num(set.particleRainCount, 4000), ringMost));
  const target = Math.min(want, cap);
  // the flakes in the air, reckoned: births are counted when the RING has taken them (its own running count), not when they are filed — a frame that was never
  // drawn (a paused page, a hidden tab) sheds what was filed for it, and the air is still empty. A cleared ring = none.
  { const em = Pp.rainStats.emitted; if (st.lastEmitted >= 0 && em > st.lastEmitted) { st.pop += (wOn || gOn ? Math.min(em - st.lastEmitted, st.flakeFiled) : em - st.lastEmitted) / sheetK; st.flakeFiled = 0; } st.lastEmitted = em; }   // (with WISPS in the ring its count is both kinds': the flakes' share is what was filed of them — they are dealt first)
  if (Pp.rainStats.live === 0) st.pop = 0;
  st.pop = Math.max(0, st.pop - st.pop * Math.min(1, dt / air));
  const go = area > 0 && dt > 0;
  let room = go ? Math.max(0, Math.min(RAIN_MAX_BIRTHS, Math.floor(RAIN_CAP * 0.95 - Pp.rainStats.live))) : 0;   // (never more than the ring has room for: a second fill on the heels of the first may not lap flakes still falling)
  st.birthAcc = Math.min(st.birthAcc + (target / air) * sheetK * dt, RAIN_MAX_BIRTHS * 2);
  const trickle = Math.min(Math.floor(st.birthAcc), room); st.birthAcc -= Math.floor(st.birthAcc); room -= trickle;
  // the make-up: one fill at a time — none filed while the last waits on the ring (a tick that was not drawn; two ticks to a frame under ?fixedstep)
  const fill = go && st.pop < 0.85 * target && st.fillAt !== Pp.rainStats.emitted ? Math.min(room, Math.ceil((target - st.pop) * sheetK)) : 0;
  // the disc for the flake's wrap (frame.weatherE: centre, radius — and no lattice share: there is no lattice rain to stand back. The slot carries the metres past the rim instead, negative)
  { const nf = (w.nearFade && !Object.isFrozen(w.nearFade)) ? w.nearFade : (w.nearFade = [0, 0, 0, 0]); nf[0] = cx; nf[1] = cz; nf[2] = area > 0 ? R : 0; nf[3] = past > 0 ? -past : 0; }   // (w: the metres past the rim, NEGATIVE — particles_common.wgsl snowPast; 0 = none)
  const rec = (lift: number) => ({ shape: 'rainDisc' as const, radius: R, speed: F.fallV, speedJit: 0.1, life, lifeJit: 0, size: F.size, sizeJit: F.sizeJit, lift, seed: nextSeed(st) });
  let filed = 0;
  if (trickle > 0) filed += Pp.emit('rain', [cx, top, cz], DOWN, trickle, rec(Math.min(0.6, top)));
  if (fill > 0) { const n = Pp.emit('rain', [cx, top, cz], DOWN, fill, rec(top - 0.25)); if (n > 0) st.fillAt = Pp.rainStats.emitted; filed += n; }
  const births = trickle + fill;
  if (wOn || gOn) st.flakeFiled = Math.min(st.flakeFiled + filed, RAIN_MAX_BIRTHS);
  let left = go ? RAIN_MAX_BIRTHS - births : 0;   // (the wisps' and the grains' slots are held back from the flakes' cap above: the ring has room for them by that sum)
  if (wOn && SNOW_LOOK.blast && dt > 0) left -= snowBlastPuffs(g, Pp, Math.max(0, Math.min(left, Math.floor(RAIN_CAP * 0.985 - Pp.rainStats.live))));   // (a blast's puff of powder goes first, and may dip into the ring's last slack: it is of the moment)
  if (oa && SNOW_LOOK.blast && dt > 0) left -= snowBlastThrow(g, Pp, Math.max(0, Math.min(left, Math.floor(RAIN_CAP * 0.985 - Pp.rainStats.live))), F.size, F.sizeJit);   // (ONE AIR: what a blast throws up is the same snow that is falling)
  if (SNOW_LOOK.marks && dt > 0) left -= markKicks(g, Pp, Math.max(0, Math.min(left, Math.floor(RAIN_CAP * 0.985 - Pp.rainStats.live))), F.size, F.sizeJit, cx, cz, R);   // (the loose snow a boot, a chair, a landing can kicks up: snowTracks.ts stampMark — of the moment too)
  if (wOn) { updateWisps(g, st, Pp, dt, cx, cz, R, oa ? inside : onField ? blown : inside, left, wispMax, oa); left -= st.wisps.births; }   // (a wisp is lifted off lying snow: the ground inside the rim)
  else if (st.wisps.active) { const Ws = st.wisps; Ws.active = false; Ws.why = 'the switch is off'; Ws.births = 0; Ws.target = 0; st.wAcc = 0; }
  if (gOn) updateGrains(g, st, Pp, dt, cx, cz, left, life);
  else grainsOff(st, Pp, oa ? 'one snow in one air: no grains of their own' : !SNOW_LOOK.grains && !SNOW_LOOK.oneAir ? 'the switch is off' : SNOW_LOOK.oneAir ? 'one snow in one air, and no air to ride (the wind sim is off)' : 'no air to ride (the wind sim is off)');   // (the words a read-out shows beside the layer's box: never 'off' beside a ticked one)
  oneAirCfg(g, st, Pp, oa);
  S.radius = R; S.centre[0] = cx; S.centre[1] = cz; S.areaOut = area; S.target = target; S.capped = want > cap; S.pop = st.pop; S.births = births; S.totalBirths += births;
}
/** THE KICK (SNOW_LOOK.marks): the loose snow each mark made since the last frame threw up, filed as FLAKE records — the falling snow's own kind, a little finer,
 *  born a hand over the mark and going up and on the way the thing was going — as far as the frame's births allow. The strongest `puffRecs` of them a frame (each
 *  is a record of its own, and a frame has few: the wisps and the grains keep theirs); the rest wait a frame, the weakest dropped past `puffWait`. One outside the
 *  middle of the view's disc is dropped: a flake born past the disc is wrapped back into it, and its puff would rise from bare floor. Returns how many it filed. */
function markKicks(g: Game, Pp: Particles, room: number, size: number, sizeJit: number, cx: number, cz: number, R: number): number {
  const T = g.snowTracks; if (!T || !T.kicks.length) return 0;
  const K = SNOWTRACKS, Q = T.kicks, near = R * 0.7; let filed = 0, recs = 0;
  Q.sort((a, b) => b.force - a.force || a.serial - b.serial);
  let keep = 0;
  for (const k of Q) {
    if (Math.hypot(k.x - cx, k.z - cz) > near) continue;
    const n = Math.min(Math.round(K.puff * Math.pow(k.force, 1.5)), Math.round(K.puffMost)); if (n <= 0) continue;
    if (n > room - filed) continue;   // (no births left for it this frame: it is not kicked late)
    if (recs >= K.puffRecs) { if (keep < K.puffWait) Q[keep++] = k; continue; }
    const l = Math.hypot(k.dx, k.dz), dir: [number, number, number] = l > 1e-3 ? [k.dx / l * 0.42, 0.91, k.dz / l * 0.42] : [0, 1, 0];
    filed += Math.max(0, Pp.emit('rain', [k.x, 0.16, k.z], dir, n, { shape: 'rainDisc', radius: Math.max(0.06, k.wide), speed: K.puffUp * (0.5 + 0.5 * k.force), speedJit: 0.7, life: K.puffLife, lifeJit: 0.3,
      size: size * 0.75, sizeJit, lift: 0.12, seed: (0x51ed27 + k.serial * 40503) >>> 0 })); recs++;
  }
  Q.length = keep; markKicked += filed;
  return filed;
}
let markKicked = 0;
/** flakes kicked up off marks so far (the page's `__snow.markStats`, a check) */
export const marksKicked = () => markKicked;
/** how a wisp filed now is drawn, in the colour word's fourth byte (particles_draw.wgsl wispVertex): SNOWWISPS.motes × 16 + SNOWWISPS.sparkle, in sixteenths */
export const wispLookByte = () => Math.round(clamp(+SNOWWISPS.motes || 0, 0, 1) * 15) * 16 + Math.round(clamp(+SNOWWISPS.sparkle || 0, 0, 1) * 15);
/** WISPS, once a frame behind the flakes (only with the switch on, on a level in snow): this frame's share of births as ONE record of the flakes' own shape — the disc,
 *  the bottom half metre, aspect 2 (what tells the GPU it is a wisp) — after the flakes have had the frame's birth budget; the three live numbers go into the rain
 *  look's refraction slots (dead on a snow level: refraction is off there). No wind (the storm source still), no open ground, a still frame: nothing filed.
 *  `area` = the open ground in the view's disc (m²) — with WX_OWN.wind on, that ground weighed by the wind FIELD's share over it (updateSnowFx `blown`). */
function updateWisps(g: Game, st: SnowState, Pp: Particles, dt: number, cx: number, cz: number, R: number, area: number, room: number, max = SNOWWISPS.max, oneAir = false) {
  const K = SNOWWISPS; const S = st.wisps;
  const L = Pp.rainLook; L.refractReachM = oneAir ? SNOWFX.windK : K.speedK; L.refractClamp = K.opacity; L.refractDepth = K.gain;   // (particles_common.wgsl rainCfgC.yzw — read by wispAir / wispStep / wispVertex under SNOW_WISPS)
  const storm = g.wind.byName('storm'); const air = storm && windOf(g) > 0 ? storm.speed * SNOWFX.windK : 0;   // (the wind's master at 0 = still air: the storm source keeps its last speed then, and the GPU has no wind at all)
  // ONE AIR: what lifts a wisp is the air over the ground where it would be born (particles.wgsl: liftLo ‥ liftHi against the field's speed there) — here only
  // whether ANY ground in the level can have air that fast this frame: the storm's at the ground through this gust, and half as much again where walls squeeze it
  const peak = oneAir ? airSimStats(g).speed * 1.5 : 0;
  const why = !(air >= K.minAir) ? 'no wind to run them' : !(area > 0) ? 'no open ground in view that the wind reaches' : oneAir && !(peak > K.liftLo) ? 'the air is too slow to lift snow' : '';
  if (why) { S.active = false; S.why = why; S.births = 0; S.target = 0; S.blow = 0; st.wAcc = 0; return; }
  const blow = oneAir ? 1 : Math.pow(clamp(storm!.gust, 0, 2), K.gustPow);
  const target = Math.min(max, K.perM2 * area * blow * num((g.engine as unknown as { settings: Record<string, unknown> }).settings.particleRainDensity, 1));
  st.wAcc = Math.min(st.wAcc + target / Math.max(0.5, K.life) * dt, 96);
  let n = Math.min(Math.floor(st.wAcc), Math.max(0, room)); st.wAcc -= Math.floor(st.wAcc);
  if (!(dt > 0)) n = 0;
  if (n > 0) n = Pp.emit('rain', [cx, K.y1, cz], DOWN, n, { shape: 'rainDisc', radius: R, speed: 0.01, speedJit: 0, life: K.life, lifeJit: K.lifeJit, size: K.size, sizeJit: K.sizeJit, lift: Math.max(0, K.y1 - K.y0), aspect: 2,
    color: [clamp(K.stretch / 2, 0, 1), clamp(K.meander / 4, 0, 1), clamp(K.gustLen / 32, 0, 1)], top: wispLookByte(), seed: nextWispSeed(st) });
  S.active = true; S.why = 'blowing'; S.target = target; S.blow = blow; S.births = n; S.totalBirths += n; if (n > 0) S.records++;
}
/** ONE SNOW IN ONE AIR, once a frame: ask for the air (it is stepped only while something reads it) and hand the particle step its numbers (render/particles.ts
 *  grainCfg floats 20‥27 = particles.wgsl grain.f / .g; [7] = there is a field to read, [0] the storm's air at the ground with no gust). Off: [20] = 0 and the
 *  step is what it was. */
function oneAirCfg(g: Game, st: SnowState, Pp: Particles, on: boolean) {
  const c = Pp.grainCfg; if (!c || c.length < 28) return;   // (a stand-in pool in a check may carry the grains' older length)
  st.oneAir = on;
  if (!on) { c[20] = 0; return; }
  airWant(g);
  const A = airSimStats(g); const F = SNOWFX, K = SNOWWISPS;
  c[0] = Math.max(A.calm, 1e-3); c[5] = F.airLift; c[7] = 1; c[8] = 0; c[9] = 0; c[10] = 0; c[11] = 0;
  c[20] = 1; c[21] = Math.max(0, K.liftLo); c[22] = Math.max(K.liftHi, K.liftLo + 1e-3); c[23] = clamp(F.skid, 0, 1);
  c[24] = Math.max(0, F.airLow); c[25] = Math.max(F.airHigh, F.airLow + 0.01); c[26] = F.airLift; c[27] = clamp(K.dropK, 0, 1);
}
const grainCap = () => clamp(Math.round(SNOWGRAINS.max), 0, 6000);
/** the grains stand down: the GPU is told there is no field (every grain lies, nothing is drawn) and nothing more is filed */
function grainsOff(st: SnowState, P: Particles | null, why: string) {
  const S = st.grains; if (P && P.grainCfg) { P.grainCfg[7] = 0; P.grainCfg[11] = 0; }   // (a stand-in pool in a check has no grains' numbers to clear)
  S.active = false; S.why = why; S.births = 0; S.target = 0; S.pop = 0; S.air = false; st.gAcc = 0; st.gFill = -1; st.gHold = 0; st.gSeen = false;
}
/** GRAINS, once a frame behind the flakes and the wisps (only with the switch on, on a level in snow): keep `max` grain SLOTS in the ring and hand the GPU this
 *  frame's numbers (render/particles.ts grainCfg). A slot is a record of the flakes' shape with aspect 3 (what tells the GPU it is a grain). THE FIRST SET is filed
 *  with lives spread evenly from nothing to a flake's; from then on `max` ÷ that life are refiled a second, each with the whole of it — so as many leave the ring
 *  each second as enter it and the number in it holds from the first frame (a set filed all at once with one life would all let go together, every nine
 *  seconds, for good). Where a grain lies and when it flies is the GPU's (particles.wgsl grainStep) and the air's (game/airSim.ts → render/airField.ts). No
 *  wind: nothing is filed and what is there lies. `pop` is reckoned (first set owed + the steady state), not counted. */
function updateGrains(g: Game, st: SnowState, Pp: Particles, dt: number, cx: number, cz: number, room: number, slotLife: number) {
  const K = SNOWGRAINS; const S = st.grains; const c = Pp.grainCfg;
  const e = g.engine as unknown as { settings: Record<string, unknown> };
  // the air they ride is the game's one simulated field (airSim.ts: the wind's own sources, the level's walls and leaves) — asked for each frame they are
  // on (it is stepped only while something reads it); its ambient before the gusting is the speed a lying grain is picked up against
  airWant(g);
  const A = airSimStats(g); const u0 = A.calm;   // (the storm's air at the ground: what lifts lying snow — a vent's or a door's draught alone does not start them)
  S.wind[0] = A.wind[0]; S.wind[1] = A.wind[1]; S.air = true; S.u0 = u0; S.radius = K.radius;
  const why = !(u0 >= K.minAir) ? 'no wind to carry them' : '';
  c[0] = Math.max(u0, K.minAir); c[1] = Math.max(1, K.radius); c[2] = Math.max(0, K.opacity); c[3] = Math.max(0, K.gain); c[4] = Math.max(0, K.eddy); c[5] = K.lift; c[6] = Math.max(0, K.speedK); c[7] = why ? 0 : 1;
  snowBlastFeed(g, c);   // (a blast throwing the lying grains this frame: snowBlast.ts → c[8‥15])
  c[16] = clamp(K.shutter, 0, 0.2); c[17] = clamp(K.dash, 0, 15.9); c[18] = clamp(K.tail, 0, 1); c[19] = clamp(+K.wispsBack || 0, 0, 1);
  const target = why ? 0 : Math.round(grainCap() * clamp(num(e.settings.particleRainDensity, 1), 0, 1));
  if (Pp.rainStats.live > 0) st.gSeen = true;
  if (why || (st.gSeen && Pp.rainStats.live === 0)) { st.gFill = -1; st.gAcc = 0; st.gSeen = false; }   // (no wind, or the ring was cleared under them — it held particles and now holds none: the first set is owed again)
  st.gHold = Math.max(0, st.gHold - Math.max(0, dt));
  let births = 0;
  if (!why && dt > 0) {
    if (st.gFill < 0) { st.gFill = target; st.gHold = slotLife + 0.5; }
    const rec = (life: number, lifeJit: number) => ({ shape: 'rainDisc' as const, radius: K.radius, speed: 0.01, speedJit: 0, life, lifeJit, size: K.size, sizeJit: K.sizeJit, lift: 0, aspect: 3, seed: nextGrainSeed(st) });
    st.gAcc = Math.min(st.gAcc + target / slotLife * dt, 96);
    const trickle = Math.min(Math.floor(st.gAcc), Math.max(0, room)); st.gAcc -= Math.floor(st.gAcc);
    if (trickle > 0) { const n = Pp.emit('rain', [cx, 0.3, cz], DOWN, trickle, rec(slotLife, 0)); births += n; room -= n; if (n > 0) S.records++; }
    const fill = Math.min(st.gFill, Math.max(0, room));
    if (fill > 0) { const n = Pp.emit('rain', [cx, 0.3, cz], DOWN, fill, rec(slotLife * 0.5, 1)); births += n; st.gFill -= n; if (n > 0) S.records++; }
  }
  S.active = !why; S.why = why || 'blowing'; S.target = target; S.pop = why ? 0 : Math.max(0, target - Math.max(0, st.gFill)); S.births = births; S.totalBirths += births;
}
/** one line for the panel / the probes */
export function snowSummary(g: Game): string {
  const S = stateOf(g).stats;
  return S.active ? `snow ▸ R ${S.radius.toFixed(1)} m at (${S.centre[0].toFixed(1)}, ${S.centre[1].toFixed(1)}) · open ${S.areaOut.toFixed(0)} m² · target ${S.target.toFixed(0)} flakes${S.capped ? ' (capped)' : ''} · ~${S.pop.toFixed(0)} in the air · ${S.totalBirths} born` : `snow: ${S.why}`;
}
