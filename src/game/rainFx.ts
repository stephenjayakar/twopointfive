// PARTICLE RAIN — the CPU half of the experiment (exp/particle-rain; docs/review/particle-rain.html). The storm's rain today is a LATTICE of drop columns evaluated
// analytically along every outdoor view ray (volumetrics.wgsl (c)): flat cost, any density, but a streak is lit unshadowed, cannot end on the thing under it, and has no
// parallax of its own past the ray's. This adds a NEAR-FIELD layer of real GPU drops (render/particles.ts kind 'rain', shaders/particles.wgsl rainStep, particles_draw
// rainVertex) over the ground the view is looking at, and tells the lattice to stand back by as much under them (frame.weatherE → volumetrics.wgsl rainNearKeep):
//   RECYCLER  every frame it aims at N drops alive = the lattice's own column density at this rain rate × the OUTDOOR ground inside a disc of radius R round the view's
//             look-at point (capped by the tier: settings.particleRainCount), and files ONE emit record for the frame's share of births — the GPU scatters them over
//             the outdoor part of the disc itself (the 'rainDisc' shape rejects the interior / annex footprints per drop), on top of the rain slab, at terminal fall +
//             the wind; the update kernel drops them through the trace grid and the character capsules, ends each on what it meets and turns it into its splash
//             there; the splat draws lit, shadow-tested streaks and crowns and marks them reactive for the TAA. Deterministic: its own mulberry, seeds handed to the
//             records (the gameplay effects' serial is never advanced by rain).
//   DRIPS     fat slow drops off the EDGES of whatever outdoors gets rained on and stands over a drop — the roof's rim, the cars' roofs and bonnets, the van, the
//             dumpster, the lamp heads — found once from the level's boxes (edge points sampled every 30 cm: outdoors, open sky over the surface, ≥ 0.35 m of fall
//             beside it), a Poisson-ish trickle ∝ the rain rate from the ones inside the disc.
//   OFF       (settings.particleRain false — ?norain2 / the panel; it is ON by default since the merge — or no Particles, or no rain drawn this frame): nothing is filed, the rain ring drains inside a second,
//             frame.weatherE / weatherF are zero and the lattice is exactly what it was.
//   v2 (08-12, the maintainer: 'looks good but kinda flat … arkham city rain reacting to lighting, specular / refracting … wind outside and the rain respond to it'):
//   LOOK      each streak is shaded as a WATER DROP smeared over its shutter, not a grey scatterer: the update kernel scores the three strongest shadow-tested lights through a
//             drop's phase function (an isotropic floor + a forward lobe: a streak between the eye and a lamp flares, one lit from the eye's side is dim) + a strand glint (the
//             water cylinder along the streak mirrors a light where the half vector stands square to it, widened by the emitter's angular size = its energy bound), keeps LAST
//             frame's shade as the streak's TAIL (the point 15 cm up the streak was lit exactly so a frame ago: a streak entering a beam brightens along its length for free), and
//             the splat REFRACTS the scene behind the streak (the composite's copy sampled off the streak's line, depth-aware, luminance-bounded) as an 'over' by its coverage —
//             a drop over dark asphalt beside the lamp's pool shows the pool, one over an even field vanishes into it — plus per-drop length / brightness spread. PRAIN below.
//   WIND      the drops ride the WIND FIELD (game/wind.ts → the particles' wind records: the storm outdoors easing in off the facade, gusting; particles.wgsl windAir): born
//             moving with the air where they enter the slab, dragged toward it as they fall (a drop answers a gust over ~0.9 s, as a real one does), so the streaks SLANT with
//             the storm and swing with its gusts; the LATTICE far field is handed the same mean air (frame shear = −air ÷ 9 m/s, low-passed by the drops' own response) so near
//             and far lean alike; births are thinned into drifting SHEETS (a value noise carried downwind) so curtains of denser rain cross the lot.
import { SideMap } from '../math/side';
import { Vec3, clamp } from '../math/vec';
import type { Game } from './game';
import type { FollowCamera } from './camera';
import type { WeatherFrame } from '../render/frame';
import type { Particles } from '../render/particles';
import { RAIN_MAX_BIRTHS, RAIN_CAP } from '../render/particles';
import { INTERIOR, ANNEX } from './weather';
import { gpuFx } from './particleFx';
import { BoxFlag } from '../scene/boxes';
import { WORLD } from '../scene/world';
import { BLAST_PACE } from './destructionSwitch';
import { snowing, updateSnowFx } from './snowFx';

/** v2's LOOK + WIND knobs (Tab ▸ Weather ▸ p-rain rows; kept per machine: localStorage twopointsix.prain; `__rain.look`). Every one rides to the GPU each frame in the emit block's
 *  tail (render/particles.ts RainLook → particles_common.wgsl EmitBlock.rainCfg‥rainCfgD) or the Frame (weatherF: the phase the LATTICE shares), so every row is live. */
export const PRAIN = {
  // ---- how a drop scatters the lights that reach it (particles.wgsl rainPhase; volumetrics.wgsl rainLight takes iso / fwdK / fwdG too so near and far agree)
  iso: 0.25,          // the isotropic floor of the phase function (1 = v1's grey scatterer exactly; the forward lobe below is 4π-normalised, so iso + fwdK = 1 keeps the all-angle mean at v1's calibration)
  fwdK: 0.75,         // weight of the FORWARD lobe: refraction through the drop throws most light on within a few tens of degrees — a streak between the eye and a lamp flares, one lit from behind the eye is dim
  fwdG: 0.55,         // the lobe's Henyey-Greenstein g (0.55: ×7.8 looking straight into the light through the drop, ×1.3 at 55° off it, ×0.19 with the light behind the eye — a water sphere's transmitted fan reaches out to ~80°, so broad rather than a spike)
  glintK: 1.0,        // the strand GLINT: the water cylinder along the streak mirrors a light where the half vector stands square to the streak (Fresnel × a lobe widened by the emitter's angular size)
  glintRough: 0.08,   // that lobe's own width (+ the emitter's angular half-size per light: Karis' bound — a mirror shows a lamp at the lamp's radiance, never more)
  glintCap: 12,       // and a hard cap per light, × its irradiance × the gain (belt and braces against a firefly)
  gain: 1.9,          // × everything the drop scatters (v1's calibration = 1 at iso 1; the follow camera sees drops lit from its own side, under the lobe: × 1.9 puts them at ~0.8 of v1 there, side-lit 1.1×, 55° off a light 2.3×, straight into it 11×)
  tailKeep: 1.0,      // the streak's TAIL shows last frame's shade × this (1 = the point up the streak lit as it was a frame ago; 0 = head colour all along, v1)
  // ---- what the streak does to what is BEHIND it (particles_draw.wgsl rainFragment: the composite's copy sampled off the streak's line)
  refract: 1.0,       // 0 = off (v1: additive scatter only); 1 = the streak's own coverage REPLACES the background with what the water cylinder refracts of it (refract_common.wgsl — the module shared with the solid-glass lane: Snell in and out of the circular section, the exit ray followed to the scene's depth behind and projected back for the fetch, the two Fresnel transmissions folded in)
  refractReachM: 6,   // m: how far behind the drop the refracted ray is followed at most (the scene depth behind the pixel less the drop's own, capped) — a drop images what lies well off its line, minified with the sides swapped; smaller = subtler
  refractTaps: 3,     // taps ACROSS the cylinder (2 = ±0.55 of its radius · 3 = −0.7 / 0 / +0.7 · 4 = ±0.3, ±0.8), averaged: the pixel spans the whole width
  refractClamp: 6,    // each tap's display-referred luminance is held under this (× display white) — an emitter's face behind a streak must not become a white needle
  refractDepth: 0.3,  // m: a tap landing on something this much NEARER the eye than the drop (Sam's head beside the streak) is not behind it — the centre sample stands in
  refractPaint: 0,    // 0‥1: how much of the PICTURE a refraction read taken BESIDE the streak keeps. A tap is one fixed offset per streak, so with all of it (1 = as it was) a streak whose side tap landed on a red stripe was red from end to end and its neighbour cream: the rain beside The block's striped tent was a displaced picture of the tent (the maintainer, 10-12). 0 = that read hands over its light only (rainRefractTap: no colour of its own — the colour of what is straight behind the streak, else of the light on the drop —, its luminance half way to the pixel's own, its offset's length scattered per pixel and frame); a tap that lands straight BEHIND the streak (the 3-tap set's middle one) is untouched either way
  // ---- the population's spread (particles_draw.wgsl rainVertex, hashed off each drop's seed)
  lenJit: 0.45,       // streak length × (1 ± this) per drop (shutter spread: they do not all fall at one speed to the eye)
  brightJit: 0.7,     // 0 = every drop alike; 1 = a few fat bright ones and many fine (0.5 + 1.5 h², mean 1 — the lattice's `big`)
  minPx: 0.75,        // half-width floor in px: thinner streaks are drawn this wide and dimmed by as much (v1 0.75 = a 1.5 px line)
  maxPx: 1.1,         // half-width CEILING in px: a drop a couple of metres off the lens is a thin bright line, not an 8-px bar — what is wider is drawn this wide and brightened by as much, up to boostCap (v1: no ceiling)
  boostCap: 2.5,      // … the most that narrowing may brighten it
  nearFadeM: 2.6,     // m: a drop nearer the lens than 0.35 × this shows nothing, fully itself from here out (v1: 0.7 → 2 m) — no depth of field, so the ones under the camera's nose go instead of smearing the frame
  beadAmp: 0.4,       // BEADS: a big drop oscillates as it falls (a hundred-odd Hz), so a real streak photographs brightness-modulated along its length — × (1 ± this), 3‥6 beats per streak, phase and count per drop (0 = an even line, v1)
  // ---- WIND (particles.wgsl emit / rainStep ride windAir; the lattice's lean and the sheets are set here on the CPU)
  windK: 1.0,         // × the air's velocity on the drops (0 = they fall plumb whatever blows; 1 = the wind field as the paper and the smoke feel it)
  latticeLean: 0.92,  // the LATTICE far field leans by the storm's air × this ÷ 9 m/s (0.92 = the mean of the height profile a drop falls through; 0 = v1's raw weather shear, opposite in sign to the wind field)
  sheetAmp: 0.5,      // drifting SHEETS: births thinned by (1 + amp·noise)/(1 + amp) on a value noise carried downwind (0 = uniform rain)
  sheetLen: 7,        // m: the sheets' scale
  sheetDrift: 1.0,    // × the mean air speed: how fast they cross the lot
};
export const PRAIN_DEFAULTS: Readonly<typeof PRAIN> = Object.freeze({ ...PRAIN });
/** the v1 LOOK as a partial table over PRAIN (the panel's 'v1 look' button, ?rainv1, the harness's look('v1')): the grey isotropic scatterer, no glint / tail / refraction / spread / width
 *  ceiling / beads, the 2 m near fade, plumb fall under the weather's raw shear, uniform births — v1 exactly, for the A/B */
export const PRAIN_V1_LOOK: Readonly<Partial<Record<keyof typeof PRAIN, number>>> = Object.freeze({ iso: 1, fwdK: 0, glintK: 0, gain: 1, tailKeep: 0, refract: 0, lenJit: 0, brightJit: 0, minPx: 0.75, maxPx: 64, boostCap: 1, nearFadeM: 2, beadAmp: 0, windK: 0, latticeLean: 0, sheetAmp: 0 });
const PRAIN_LS = 'twopointsix.prain';
const PRAIN_RANGE: Record<keyof typeof PRAIN, [number, number]> = {
  iso: [0, 1], fwdK: [0, 2], fwdG: [0, 0.95], glintK: [0, 8], glintRough: [0.02, 0.5], glintCap: [0, 100], gain: [0.1, 8], tailKeep: [0, 1],
  refract: [0, 1], refractReachM: [0.25, 40], refractTaps: [2, 4], refractClamp: [0.5, 40], refractDepth: [0.02, 5], refractPaint: [0, 1], lenJit: [0, 0.9], brightJit: [0, 1], minPx: [0.5, 2], maxPx: [0.5, 64], boostCap: [1, 8], nearFadeM: [0.5, 8], beadAmp: [0, 1],
  windK: [0, 2], latticeLean: [0, 1.5], sheetAmp: [0, 0.95], sheetLen: [1.5, 30], sheetDrift: [0, 3],
};
export function loadPrain() { try { const raw = localStorage.getItem(PRAIN_LS); if (!raw) return; const o = JSON.parse(raw); for (const k of Object.keys(PRAIN) as (keyof typeof PRAIN)[]) { const v = o[k]; if (typeof v === 'number' && Number.isFinite(v)) PRAIN[k] = clamp(v, PRAIN_RANGE[k][0], PRAIN_RANGE[k][1]); } } catch { /* no storage (bun) / junk */ } }
export function savePrain() { try { localStorage.setItem(PRAIN_LS, JSON.stringify(PRAIN)); } catch { /* */ } }
export function resetPrain() { Object.assign(PRAIN, PRAIN_DEFAULTS); try { localStorage.removeItem(PRAIN_LS); } catch { /* */ } }
/** set knobs by name (the panel / __rain.look), clamped to their ranges; unknown keys ignored */
export function setPrain(k: Partial<Record<keyof typeof PRAIN, number>>) { for (const key of Object.keys(k) as (keyof typeof PRAIN)[]) { const v = k[key]; if (key in PRAIN && typeof v === 'number' && Number.isFinite(v)) PRAIN[key] = clamp(v, PRAIN_RANGE[key][0], PRAIN_RANGE[key][1]); } return PRAIN; }

/** The numbers. `lattice*` MIRROR volumetrics.wgsl's RAIN_CELL / RAIN_PERIOD (the density the near layer matches) and RAIN_TOP is read off the frame each update. */
export const RAIN_FX = {
  latticeCell: 0.45,        // volumetrics.wgsl RAIN_CELL: two columns a cell …
  latticePeriod: 2.2,       // … RAIN_PERIOD: a drop every 2.2 m down each falling column → columns/m² × top ÷ this = drops alive per m² of ground
  fallV: 9.0,               // terminal fall (m/s) = the lattice's RAIN_V (the particles' drag is set so gravity ÷ drag = this)
  radiusK: 0.6,             // auto radius = this × the camera distance (0.6 × 21 m ≈ the follow view's corners), clamped radiusMin‥Max
  radiusMin: 8, radiusMax: 30,
  size: 0.008,              // streak width (m) at size jitter 1 (× 0.5‥1.5 per drop: they are not all alike — the lattice's `big`)
  sizeJit: 0.5,
  topJit: 0.9,              // born up to this far under the slab's top (no layers falling in step)
  speedJit: 0.06,           // ± on the terminal speed per drop
  splashSecs: 0.2,          // a landing's crown + droplets last this long (particles.ts params.rain.sleepV)
  dripPerPointSec: 0.35,    // drips per second per active edge point at rain rate 1 (× rate)
  dripSize: 2.6,            // × the streak width: fat
  dripSpeed: 0.35,          // m/s as it lets go (the drag / gravity bring it up to the fall speed within a second)
  dripMaxPerFrame: 4,       // records are the scarce thing (128 a frame for everybody): a trickle, never a burst
  edgeStep: 0.3,            // sample spacing along an edge (m)
  edgeMinTop: 0.9, edgeMaxTop: 7.6, edgeMinArea: 0.12, edgeMinFall: 0.35,
};

interface DripPoint { pos: Vec3; fall: number; box: number; }
/** the drip lines being found again in shares (BLAST_PACE): the walk where it stopped, the statics it is over, the samples left of this frame's share */
interface DripJob { walk: Generator<void, DripPoint[]>; boxes: number; serial: number; left: number; hold: number; }
interface RainState {
  seed: number; birthAcc: number; dripAcc: number; wasActive: boolean; edges: DripPoint[] | null; edgeBoxes: number; job: DripJob | null; kind?: string | null;
  stats: RainStatsCpu; serial: number;
  /** the drops in the air UNDER THE CURRENT DISC, estimated: the births of the last meanFall seconds (popLog: game time, count — a sky drop lands that long after its birth), each cut by
   *  the overlap when the disc jumps, all dropped when the ring is cleared — the lattice's near share follows their sum ÷ target, so no hole opens while a fresh disc fills */
  pop: number; popLog: { t: number; dt: number; n: number }[]; clock: number; lastC: [number, number] | null;
  /** the longest life a drip is filed with (its fall from the highest edge + the splash): the ring's FIFO retires in order, so a drip's slot holds the tail that long — the capacity clamp counts it */
  dripLifeMax: number;
  /** v2 WIND: the lattice's lean this frame (frame shear x / z, low-passed toward −air ÷ 9 by the drops' own response), the drifting sheets' offset (∫ mean air dt, m), the storm's mean air handed to both (m/s, for the panel) */
  shear: [number, number]; bandOff: [number, number]; air: [number, number]; shearInit: boolean;
}
export interface RainStatsCpu { active: boolean; why: string; radius: number; centre: [number, number]; areaOut: number; latticePerM2: number; target: number; capped: boolean; keep: number; fill: number; birthsPerSec: number; births: number; drips: number; edgesActive: number; edgesTotal: number; frames: number; totalBirths: number; totalDrips: number; }
const states = new SideMap<Game, RainState>('rainFx.states');
function stateOf(g: Game): RainState {
  let s = states.get(g);
  if (!s) { s = { seed: 0x5eed1e5, birthAcc: 0, dripAcc: 0, wasActive: false, edges: null, edgeBoxes: 0, job: null, serial: 1, pop: 0, popLog: [], clock: 0, lastC: null, dripLifeMax: 0, shear: [0, 0], bandOff: [0, 0], air: [0, 0], shearInit: false, stats: { active: false, why: 'off', radius: 0, centre: [0, 0], areaOut: 0, latticePerM2: 0, target: 0, capped: false, keep: 1, fill: 0, birthsPerSec: 0, births: 0, drips: 0, edgesActive: 0, edgesTotal: 0, frames: 0, totalBirths: 0, totalDrips: 0 } }; states.set(g, s); }
  return s;
}
/** mulberry32 step on the state's own word (never Math.random: the harness seeds that one for the game, and rain must not shift it) */
function rnd(s: RainState): number { s.seed = (s.seed + 0x6D2B79F5) >>> 0; const a = s.seed; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function nextSeed(s: RainState): number { let x = (s.serial++ * 2654435761) >>> 0; x = (x ^ 61) ^ (x >>> 16); x = (x + (x << 3)) >>> 0; x ^= x >>> 4; x = Math.imul(x, 0x27d4eb2d) >>> 0; x ^= x >>> 15; return x >>> 0; }
/** reseed the recycler's dice + record serial (probes / captures: same seed → the same drops) */
export function seedRain(g: Game, n: number) { const s = stateOf(g); s.seed = n >>> 0; s.serial = 1; s.birthAcc = 0; s.dripAcc = 0; s.pop = 0; s.popLog.length = 0; s.lastC = null; s.bandOff[0] = 0; s.bandOff[1] = 0; s.shearInit = false; }

const inRect = (r: readonly [number, number, number, number], x: number, z: number) => x >= r[0] && z >= r[1] && x <= r[2] && z <= r[3];
let roofW: { underRoof(x: number, z: number): boolean } | null = null;   // the Weather whose footprints are in force for the call being made (a weather kind picked: the level's own roofs) — set on entry by updateRainFx / buildDripEdges, never read between calls
const outdoors = (x: number, z: number) => !(roofW ? roofW.underRoof(x, z) : inRect(INTERIOR, x, z) || inRect(ANNEX, x, z)) && x > WORLD.min[0] + 0.25 && z > WORLD.min[2] + 0.25 && x < WORLD.max[0] - 0.25 && z < WORLD.max[2] - 0.25;
const ZERO4 = Object.freeze([0, 0, 0, 0]) as unknown as [number, number, number, number];   // (shared: never written through — every writer below checks for it first)
const rimTaper = (r01: number) => { const t = clamp((r01 - 0.7) / 0.3, 0, 1); return 1 - t * t * (3 - 2 * t); };   // = the emit kernel's 1 − smoothstep(0.7, 1, r) acceptance and volumetrics.wgsl rainNearKeep's ease

/** Once a frame (game.ts, after the weather has written this frame's rain and before render): the recycler + the drips + frame.weatherE. */
export function updateRainFx(g: Game, dt: number, cam: FollowCamera) {
  if (snowing(g)) { updateSnowFx(g, dt, cam); return; }   // a level built for snow (snowFx.ts): the ring holds flakes — no rain is drawn there, so nothing below has anything to do
  const st = stateOf(g); const S = st.stats;
  { const W = g.weather; const k = W?.levelRoofs ? W.kind ?? 'own' : null; roofW = k ? W : null; if (k !== (st.kind ?? null)) { st.kind = k; st.edges = null; st.job = null; } }   // (a weather kind's roofs are the level's own: the drip edges are found again under them)
  const e = g.engine as unknown as { settings: Record<string, unknown>; weather?: WeatherFrame; particles?: Particles | null };   // (the QA harness's engine stand-in has settings but may lack the rest)
  const wf = e.weather; const set = e.settings;
  const P = gpuFx(g);
  const on = set.particleRain === true;
  // (a still re-rendered with dt 0 — the start card after an attract stop, the pause card — runs the whole path: nothing is born at dt 0, and the disc + the lattice's share are recomputed for
  // the camera the still shows, over whatever the ring holds then — an encounter restart has just emptied it, so the lattice comes straight back under a fresh disc)
  const rain = Math.max(0, wf?.rain ?? 0);
  const why = !on ? 'off' : !P ? 'no GPU particles' : !wf ? 'no weather frame' : rain <= 0.001 ? 'no rain drawn (storm off / held by day / rate 0)' : '';
  // the drip lines once, on the first frame the switch is on (a few thousand CPU ray tests: at boot with ?prain) — and again when the statics change (a wall blown: its
  // pieces are new boxes). BLAST_PACE: that second time in shares over the frames after, the old lines dripping meanwhile; a first time nobody can see yet likewise
  if (on && (st.job || !st.edges || st.edgeBoxes !== g.engine.world.statics.length)) { if (BLAST_PACE.on) paceDripEdges(g, st, !why && !st.edges); else buildDripEdges(g, st); }
  if (why) {
    if (wf && (!wf.nearFade || wf.nearFade[3] !== 0)) wf.nearFade = ZERO4;
    if (wf && (!wf.phase || wf.phase[3] !== 0)) wf.phase = ZERO4;   // (v2: the lattice's phase function off = its isotropic sum exactly as it was)
    if (st.wasActive) { P?.clearRain(); st.wasActive = false; st.birthAcc = 0; st.dripAcc = 0; st.pop = 0; st.popLog.length = 0; st.lastC = null; st.shearInit = false; }
    S.active = false; S.why = why; S.births = 0; S.drips = 0; S.target = 0; S.keep = 1; S.fill = 0;
    return;
  }
  const Pp = P!; const w = wf!;
  st.wasActive = true; S.active = true; S.why = 'raining'; S.frames++;
  // the knobs that ride in the kind's numbers (the panel / __rain edit the settings; the splat reads kp)
  Pp.params.rain.brightOrOpacity = num(set.particleRainBright, 1); Pp.params.rain.restitution = num(set.particleRainReact, 6); Pp.params.rain.sleepV = RAIN_FX.splashSecs; Pp.params.rain.drag = Pp.params.rain.gravity / RAIN_FX.fallV;
  // ---- v2: the LOOK block (every PRAIN row, live) …
  const K = PRAIN; const L = Pp.rainLook;
  L.iso = K.iso; L.fwdK = K.fwdK; L.fwdG = K.fwdG; L.glintK = K.glintK; L.glintRough = K.glintRough; L.glintCap = K.glintCap; L.gain = K.gain; L.tailKeep = K.tailKeep;
  L.refract = K.refract; L.refractReachM = K.refractReachM; L.refractTaps = K.refractTaps; L.refractClamp = K.refractClamp; L.refractDepth = K.refractDepth; L.refractPaint = K.refractPaint; L.lenJit = K.lenJit; L.brightJit = K.brightJit; L.minPx = K.minPx; L.maxPx = K.maxPx; L.boostCap = K.boostCap; L.nearFadeM = K.nearFadeM; L.beadAmp = K.beadAmp;
  L.windK = K.windK; L.sheetAmp = K.sheetAmp; L.sheetLen = K.sheetLen;
  { const ph = (w.phase && w.phase !== ZERO4) ? w.phase : (w.phase = [0, 0, 0, 0]); ph[0] = K.iso; ph[1] = K.fwdK; ph[2] = K.fwdG; ph[3] = K.gain; }   // … the LATTICE takes the same phase (volumetrics.wgsl rainLight under weatherF.w > 0), so the two layers flare and dim alike
  // ---- v2: WIND. The drops themselves ride the wind records on the GPU (born with the air, dragged toward it); here the LATTICE far field is handed the same air — the storm source's
  // vector this frame (its gust, the knobs and the master folded in) × the mean of the height profile a drop falls through, as a shear of the OPPOSITE sign to the raw weather shear
  // (the lattice's columns lean toward +shear at the top and its drops slide toward −shear: for them to drift WITH the air like the particles, shear = −air ÷ fall), eased by the
  // drops' own drag constant so a gust swings near and far together — and the sheets' noise is carried downwind by its running integral
  { const storm = g.wind.byName('storm'); const on = !!storm && storm.speed > 0;
    const ax = on ? storm.dir[0] * storm.speed * K.windK : 0, az = on ? storm.dir[2] * storm.speed * K.windK : 0;
    st.air[0] = ax; st.air[1] = az;
    if (K.latticeLean > 0) {
      const tx = -ax * K.latticeLean / RAIN_FX.fallV, tz = -az * K.latticeLean / RAIN_FX.fallV;
      const a = st.shearInit ? 1 - Math.exp(-dt * Pp.params.rain.drag) : 1; st.shearInit = true;
      st.shear[0] += (tx - st.shear[0]) * a; st.shear[1] += (tz - st.shear[1]) * a;
      w.shearX = st.shear[0]; w.shearZ = st.shear[1];
    } else st.shearInit = false;   // (0 = the weather's own shear, untouched)
    st.bandOff[0] += ax * K.sheetDrift * dt; st.bandOff[1] += az * K.sheetDrift * dt;
    L.bandOffX = st.bandOff[0]; L.bandOffZ = st.bandOff[1];
  }
  // ---- the disc: round the look-at point, sized to the view
  const rSet = num(set.particleRainRadius, 0);
  const R = rSet > 0 ? clamp(rSet, 3, 40) : clamp(RAIN_FX.radiusK * cam.distance, RAIN_FX.radiusMin, RAIN_FX.radiusMax);
  const cx = cam.target[0], cz = cam.target[2];
  // the OUTDOOR ground inside it, weighted by the rim taper the births are thinned by (1 m cells by their centres — what the GPU's per-drop rejection integrates to)
  let area = 0;
  { const x0 = Math.floor(cx - R), x1 = Math.ceil(cx + R), z0 = Math.floor(cz - R), z1 = Math.ceil(cz + R);
    for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) { const px = x + 0.5, pz = z + 0.5; const r = Math.hypot(px - cx, pz - cz) / R; if (r >= 1 || !outdoors(px, pz)) continue; area += rimTaper(r); } }
  const top = w.rainTop > 0 ? w.rainTop : 7;
  const latticePerM2 = rain * (2 / (RAIN_FX.latticeCell * RAIN_FX.latticeCell)) * (top / RAIN_FX.latticePeriod);   // drops alive per m² of outdoor ground column in the lattice at this rate
  const want = latticePerM2 * area * num(set.particleRainDensity, 1);
  const meanFall = Math.max(0.2, (top - 0.5 * RAIN_FX.topJit) / RAIN_FX.fallV);   // seconds a sky drop is in the air over open asphalt (shorter over a car: the count then runs a little under — fine)
  const life = (top + 0.3) / (RAIN_FX.fallV * 0.94) + RAIN_FX.splashSecs + 0.05;   // the life a sky drop is FILED with (fall + splash + margin; the landing cuts it) — the ring holds its slot that long + the FIFO's slack …
  const lifeMax = Math.max(life, set.particleRainDrips !== false ? st.dripLifeMax : 0);   // … and retires slots in ORDER, so a drip filed with a longer life (a lamp head's 5 m fall from rest) holds the tail for its own
  const sheetK = 1 + clamp(K.sheetAmp, 0, 0.95);                                   // (v2: the sheets thin births on the GPU by (1 + amp·noise) ÷ (1 + amp), mean 1 ÷ (1 + amp) — so (1 + amp) × as many are filed, and each holds a slot whether or not it was born)
  const ringMost = RAIN_CAP * meanFall / (lifeMax + dt + 0.1) * 0.92 / sheetK;    // … so this many alive is what the ring carries without its window ever lapping (a sky drop's slot is never recycled under it either way: CAP ÷ births/s > its life)
  const cap = Math.max(0, Math.min(num(set.particleRainCount, 4000), ringMost));
  const target = Math.min(want, cap);
  const perSec = target / meanFall;
  // the drops actually in the air under THIS disc (st.pop): filled by the births below, drained over the mean fall, and cut by the overlap when the disc jumps (a camera cut, a
  // teleport) or by a cleared ring (an encounter restart) — the lattice stands back only by as much, so a fresh disc never opens a hole while its first drops fall in
  st.clock += dt;
  const log = st.popLog;
  if (st.lastC) { const jump = Math.hypot(cx - st.lastC[0], cz - st.lastC[1]); if (jump > 0.05 * R) { const k = Math.max(0, 1 - jump / (1.4 * R)); for (const e of log) e.n *= k; } st.lastC[0] = cx; st.lastC[1] = cz; } else st.lastC = [cx, cz];
  if (Pp.rainStats.live === 0) log.length = 0;
  while (log.length && st.clock - log[0].t >= meanFall) log.shift();   // (an entry = the births of the frame ENDING at t, spread over its dt: gone once all of it is older than the fall)
  // ---- sky drops: the frame's births (counted into the window now, filed as one record below)
  st.birthAcc = Math.min(st.birthAcc + perSec * sheetK * dt, RAIN_MAX_BIRTHS * 2);   // (× sheetK filed: the sheets' thinning on the GPU brings the born back to perSec on average)
  let births = Math.floor(st.birthAcc); st.birthAcc -= births;
  births = Math.min(births, RAIN_MAX_BIRTHS - RAIN_FX.dripMaxPerFrame);
  if (!(births > 0 && area > 0 && dt > 0)) births = 0;
  if (births > 0) log.push({ t: st.clock, dt, n: births / sheetK });
  st.pop = 0; for (const e of log) { const older = st.clock - meanFall - (e.t - e.dt); st.pop += e.n * (older > 0 && e.dt > 0 ? clamp(1 - older / e.dt, 0, 1) : 1); }   // the oldest entry prorated by the part of its frame still inside the window: the sum is continuous, not a 43 / 44-frame flicker
  let fill = target > 1 ? clamp(st.pop / target, 0, 1) : 0; if (fill > 0.97) fill = 1;
  // the lattice's share KEPT inside the disc: by hand, or auto = whatever the particles do not supply (a capped tier keeps the rest of the lattice; a matched one drops it all) — × how full the layer is yet
  const kSet = num(set.particleRainLattice, -1);
  const keep = kSet >= 0 ? clamp(kSet, 0, 1) : (want > 1e-3 ? clamp(1 - target / want, 0, 1) : 1);
  if (area > 0) { const nf = (w.nearFade && w.nearFade !== ZERO4) ? w.nearFade : (w.nearFade = [0, 0, 0, 0]); nf[0] = cx; nf[1] = cz; nf[2] = R; nf[3] = (1 - keep) * fill; }
  else if (!w.nearFade || w.nearFade[3] !== 0) w.nearFade = ZERO4;
  // ---- sky drops: one record for the frame's births
  if (births > 0) {   // (v2: filed at the terminal FALL alone — the emit kernel adds the wind field's air where each drop is actually born, gust and lee and all, and the step drags it toward that air as it falls)
    Pp.emit('rain', [cx, top, cz], DOWN, births, { shape: 'rainDisc', radius: R, speed: RAIN_FX.fallV, speedJit: RAIN_FX.speedJit, life, lifeJit: 0, size: RAIN_FX.size, sizeJit: RAIN_FX.sizeJit, lift: RAIN_FX.topJit, seed: nextSeed(st) });
  }
  // ---- drips off the edges inside the disc
  let drips = 0; S.edgesActive = 0;
  if (set.particleRainDrips !== false && dt > 0) {
    const act: DripPoint[] = dripScratch; act.length = 0;
    const R2 = (R * 0.92) * (R * 0.92);
    for (const d of st.edges!) { const dx = d.pos[0] - cx, dz = d.pos[2] - cz; if (dx * dx + dz * dz < R2) act.push(d); }
    S.edgesActive = act.length; S.edgesTotal = st.edges!.length;
    if (act.length) {
      st.dripAcc = Math.min(st.dripAcc + RAIN_FX.dripPerPointSec * rain * act.length * dt, RAIN_FX.dripMaxPerFrame * 3);
      let n = Math.min(Math.floor(st.dripAcc), RAIN_FX.dripMaxPerFrame); st.dripAcc -= n;
      while (n-- > 0) {
        const d = act[Math.min(act.length - 1, Math.floor(rnd(st) * act.length))];
        drips += Pp.emit('rain', d.pos, [0, -1, 0], 1, { shape: 'cone', spread: 0.05, speed: RAIN_FX.dripSpeed, speedJit: 0.5, life: dripLife(d.fall), lifeJit: 0, size: RAIN_FX.size * RAIN_FX.dripSize, sizeJit: 0.2, posJit: 0.012, seed: nextSeed(st) });
      }
    } else st.dripAcc = 0;
  }
  S.radius = R; S.centre[0] = cx; S.centre[1] = cz; S.areaOut = area; S.latticePerM2 = latticePerM2; S.target = target; S.capped = want > cap; S.keep = keep; S.fill = fill; S.birthsPerSec = perSec; S.births = births; S.drips = drips; S.totalBirths += births; S.totalDrips += drips;
}
const dripScratch: DripPoint[] = [];
const DOWN: Vec3 = [0, -1, 0];
/** the life a drip off an edge `fall` m up is filed with: a drag-slowed free fall, generously (the landing cuts it to the splash anyway), + the splash */
const dripLife = (fall: number) => Math.sqrt(2 * fall / 9.8) * 1.25 + 0.15 + RAIN_FX.splashSecs;
const num = (v: unknown, d: number) => typeof v === 'number' && Number.isFinite(v) ? v : d;

/** The drip lines, once per level: every static box's TOP EDGES that are outdoors, get rained on (open sky over the surface just inside the edge) and stand over a drop
 *  (a solid at least edgeMinFall below the point just outside the edge) — sampled every edgeStep along each edge, 3.5 cm proud of the face and a hair under the top.
 *  Roof rims (the NoPrimary slab included: invisible, but where the water comes off), car roofs / bonnets, the van, the dumpster's lid, the AC units, the lamp heads. */
function buildDripEdges(g: Game, st: RainState) {
  const walk = dripWalk(g, { left: Infinity }); let r = walk.next(); while (!r.done) r = walk.next();
  setDripEdges(st, r.value, g.engine.world.statics.length);
}
function setDripEdges(st: RainState, out: DripPoint[], boxes: number) {
  st.edges = out; st.edgeBoxes = boxes; st.job = null;
  st.dripLifeMax = out.reduce((m, d) => Math.max(m, dripLife(d.fall)), 0);
}
/** BLAST_PACE: the same lines, `BLAST_PACE.dripSamples` edge samples a frame (`now` = all of it this frame: rain is drawn and there are no lines to drip off yet),
 *  begun once the statics have stood still `dripHold` frames where there are lines to go on with. Statics changed again part way: the walk starts over. The lines
 *  in use are swapped whole when the walk ends. */
function paceDripEdges(g: Game, st: RainState, now: boolean) {
  const n = g.engine.world.statics.length;
  const serial = g.engine.world.geomSerial;   // (a wall rebuilt in its own slots mid-walk: the count stands, the serial moves — the walk starts over)
  if (!st.job || st.job.boxes !== n || st.job.serial !== serial) { const job: DripJob = { walk: null!, boxes: n, serial, left: 0, hold: st.edges ? BLAST_PACE.dripHold : 0 }; job.walk = dripWalk(g, job); st.job = job; }
  const job = st.job; if (!now && job.hold-- > 0) return;
  job.left = now ? Infinity : BLAST_PACE.dripSamples;
  const r = job.walk.next(); if (r.done) setDripEdges(st, r.value, n);
}
/** the walk itself: it stops (yields) whenever `share.left` samples are used up — a sample that gets as far as its ray tests is one, sixteen turned away before them another */
function* dripWalk(g: Game, share: { left: number }): Generator<void, DripPoint[]> {
  roofW = g.weather?.levelRoofs ? g.weather : null;
  const statics = g.engine.world.statics; const col = g.col;
  const out: DripPoint[] = []; const cand = new Int32Array(24);
  const F = RAIN_FX;
  for (let bi = 0; bi < statics.length; bi++) { const b = statics[bi];
    if (b.flags & (BoxFlag.NoShadow | BoxFlag.Glass | BoxFlag.Dynamic)) continue;
    if (b.rot) continue;                                                  // (fully rotated dressing — the bike's tubes: no ledge worth a drip)
    const top = b.c[1] + b.h[1];
    if (top < F.edgeMinTop || top > F.edgeMaxTop || 4 * b.h[0] * b.h[2] < F.edgeMinArea) continue;
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
    const toWorld = (lx: number, lz: number): [number, number] => [b.c[0] + c * lx + s * lz, b.c[2] - s * lx + c * lz];   // local (x, z) → world (the boxes' yaw convention: rayBox's inverse)
    // four edges: (axis along, the fixed local coord on the other axis, outward normal in local)
    const edges: [number, number, number, number, number][] = [   // [alongIsX(1|0), fixed, nX, nZ, halfLen]
      [1, b.h[2], 0, 1, b.h[0]], [1, -b.h[2], 0, -1, b.h[0]], [0, b.h[0], 1, 0, b.h[2]], [0, -b.h[0], -1, 0, b.h[2]],
    ];
    for (const [alongX, fixed, nx, nz, half] of edges) {
      const len = 2 * half; const n = Math.max(1, Math.round(len / F.edgeStep));
      for (let k = 0; k < n; k++) {
        const u = -half + (k + 0.5) * len / n;
        const lx = alongX ? u : fixed, lz = alongX ? fixed : u;
        const [qx, qz] = toWorld(lx + nx * 0.035, lz + nz * 0.035);          // just outside the edge …
        const [ix, iz] = toWorld(lx - nx * 0.06, lz - nz * 0.06);            // … and just inside it, on the top face
        const out0 = outdoors(qx, qz);
        if ((share.left -= out0 ? 1 : 1 / 16) < 0) yield;
        if (!out0) continue;
        // nothing solid AT the drip point (a ledge tucked into a bigger box: no)
        let inside = false;
        const nc = col.gather(qx - 0.01, qz - 0.01, qx + 0.01, qz + 0.01, top - 0.05, top - 0.005, cand);
        for (let i = 0; i < nc && !inside; i++) { const o = statics[cand[i]]; if (!o || cand[i] === bi) continue; const cc = Math.cos(o.yaw), ss = Math.sin(o.yaw); const px = qx - o.c[0], pz = qz - o.c[2]; const ox = cc * px - ss * pz, oz = ss * px + cc * pz; if (Math.abs(ox) < o.h[0] && Math.abs(oz) < o.h[2] && top - 0.02 > o.c[1] - o.h[1] && top - 0.02 < o.c[1] + o.h[1]) inside = true; }
        if (inside) continue;
        // open sky over the surface just inside the edge (else a canopy keeps it dry: no water to come off it)
        if (col.solidBlocked([ix, top + 0.05, iz], [ix, 9.5, iz], 0.02)) continue;
        // a drop beside it: the first solid straight down from just under the top, at least edgeMinFall below
        const hit = col.raycast([qx, top - 0.02, qz], [0, -1, 0], 9);
        if (!hit || hit.t < F.edgeMinFall) continue;
        out.push({ pos: [qx, top - 0.012, qz], fall: hit.t, box: bi });
      }
    }
  }
  return out;
}

/** the drip points (QA / a debug draw) */
export function rainDripPoints(g: Game): readonly DripPoint[] { const st = stateOf(g); if (!st.edges || st.job) buildDripEdges(g, st); return st.edges!; }
/** BLAST_PACE: the drip lines are being found again in shares (QA: rainDripPoints would finish the walk whole) */
export function rainDripPending(g: Game): boolean { return !!stateOf(g).job; }
export function rainStats(g: Game): RainStatsCpu { return stateOf(g).stats; }
/** one line for the panel / the probes */
export function rainSummary(g: Game): string {
  const st = stateOf(g); const S = st.stats; const P = (g.engine as unknown as { particles?: Particles | null }).particles; const rs = P?.rainStats;
  if (!S.active) return `particle rain: ${S.why}${rs && rs.live ? ` · ${rs.live} slots still draining` : ''}`;
  const air = Math.hypot(st.air[0], st.air[1]);
  return `particle rain ▸ R ${S.radius.toFixed(1)} m at (${S.centre[0].toFixed(1)}, ${S.centre[1].toFixed(1)}) · outdoor ${S.areaOut.toFixed(0)} m² · lattice ${S.latticePerM2.toFixed(1)}/m² → target ${S.target.toFixed(0)} alive${S.capped ? ' (CAPPED)' : ''} (${(S.fill * 100).toFixed(0)} % in the air) · lattice kept ${(S.keep * 100).toFixed(0)} % inside · ${S.birthsPerSec.toFixed(0)}/s (${S.births} + ${S.drips} drips this frame) · edges ${S.edgesActive}/${S.edgesTotal} · air ${air.toFixed(2)} m/s → lean ${(Math.hypot(st.shear[0], st.shear[1]) * 100).toFixed(0)} cm/m${P ? ` · scene copy ${P.rainSceneCopy}` : ''}${rs ? ` · ring live ${rs.live} born ${rs.born} recs ${rs.records} dropped ${rs.droppedBirths}/${rs.droppedRecs}` : ''}`;
}
/** the storm's air the rain rides this frame (m/s, xz) and the lattice's shear — the panel / __rain */
export function rainWind(g: Game): { air: [number, number]; shear: [number, number]; bandOff: [number, number] } { const st = stateOf(g); return { air: [st.air[0], st.air[1]], shear: [st.shear[0], st.shear[1]], bandOff: [st.bandOff[0], st.bandOff[1]] }; }
