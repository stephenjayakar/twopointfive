// Per-frame uniform block (must match `struct Frame` in common.wgsl) + shared scene bind group.
import { Mat4, Vec3 } from '../math/vec';
import commonSrc from './shaders/common.wgsl' with { type: 'text' };
import sdfRigSrc from './shaders/sdfrig.wgsl' with { type: 'text' };
import { sdfRigWgslConsts } from './sdfrig';
import { wgslWorldConsts } from '../scene/world';
import { AIR_CELL, AIR_W, AIR_H, AIR_ROWS } from '../scene/airGrid';
import { REACH_VEC4S } from './lights';
import { MESH_MAX_CHARS } from './meshbvh';
import { MARK_TABLE_ROWS } from '../scene/markings';
import { cutConfig, CUT_ROWS, CUT_STRIDE } from '../scene/cut';
import { GB_ROWS } from '../scene/boxes';
import { smokeGrid, smokeReadConsts } from '../smoke/smokeGrid';
import smokeReadSrc from './shaders/smoke_read.wgsl' with { type: 'text' };

/** Byte size of the per-frame uniform block = struct Frame in common.wgsl. Layout past the 416 bytes of scalars/vec4s the renderer always had (offsets in BYTES; f[]/u[] index = byte ÷ 4):
 *    416  cardCfg    vec4u              (u[104‥107])  torch bounce cards: x = count this frame; y, z = weather kinds' 3rd / 4th roof footprint packed (1 = a kind with no third roof), w = their fog packed (0 0 0 = no kind)
 *    432  cardSlots  array<vec4u, 2>    (u[108‥115])  the 8 light slots the cards are built from
 *    464  weatherA   vec4f              (f[116‥119])  rain rate, shear x, shear z, wetness
 *    480  weatherB   vec4f              (f[120‥123])  flash rgb, rain top
 *    496  weatherC   vec4f              (f[124‥127])  interior footprint x0 z0 x1 z1 = the first roof (the level's own roofs in force: + two packed roofs in cardCfg.yz and, under a kind, the fog in .w @420, u[105‥107])
 *    512  glassCfg   vec4f              (f[128‥131])  glass: reflection ×, tint depth, dust glow ×, refraction's index (0 = off)
 *    528  weatherD   vec4f              (f[132‥135])  a second no-rain footprint (the office's west stair tower; else the level's second roof) x0 z0 x1 z1
 *    544  volCfg     vec4u              (u[136‥139])  volumetric caps: x = lights per march step / per haze ray (0 = off), y = shadow-ray refresh period (steps), z = march step (tenths of a voxel), w = bits 0‥3 the SHADOW rays' smoke sample count (smokeShadowSteps; 0 = 8) | bits 8‥11 the smoke march's lights lit per step (smokeMarchLights K; 0 = J-lit as before)
 *    560  froxelA    vec4f              (f[140‥143])  froxel volumetrics: near, far (m along the pixel ray), slice curve a, history weight this frame
 *    576  froxelB    vec4u              (u[144‥147])  froxel grid W, H, D, k (shadow-rayed lights per froxel) | fetch filter << 8 | (strata − 1) << 9
 *    592  froxelC    vec4f              (f[148‥151])  froxel sample jitter xyz (0‥1), lookup depth bias (slices)
 *    608  prevCam    vec4f              (f[152‥155])  previous frame's camera position, w = last frame's froxel near boundary
 *    624  rtCfg      vec4f              (f[156‥159])  RT reflections: max roughness traced, rays per pixel, wet-ground anisotropy (+ 2 × the wet ground's break-up in tenths), the reflection target's divisor (0 = the pass is OFF this frame)
 *    640  matCfg     vec4f              (f[160‥163])  materials: analytic-highlight gain, reflection strength, per-ray luminance bound, detail-layer amount (0 = the g-buffer's detail layer off)
 *    656  p5Cfg      vec4u              (u[164‥167])  renderer v3 phase 5 (ultra extras): gather resampling mode, its packed numbers, the reflection pass's mesh / hit-reuse bits (all 0 = the passes as they were); w = the lowest light slot holding a TRANSIENT light this frame (gather_common's subtraction walk starts there; 0 when none is alive — review R2.2)
 *    672  jitter     vec4f              (f[168‥171])  this frame's TAAU jitter (internal px) xy, the previous render's zw
 *    688  markCfg    vec4f              (f[172‥175])  markings: base texel m (0 = off), contrast, emission ×, evaluate-at-reflection-hits
 *    704  sharpCfg   vec4f              (f[176‥179])  SHARP DIRECT (decoupled resolution): internal size xy, OUTPUT (g-buffer / composite) size zw — z 0 = off: every pass exactly as it was
 *    720  sharpCfgB  vec4f              (f[180‥183])  sharp direct's knobs: x = output-res edge rays on (1) / off (0) — informational (passes.ts picks the pipeline), y = the taps' ratio spread that flags a hard shadow edge, z = the hint width (internal px) under which an edge counts as hard, w = the same-plane weight's k
 *    736  sharpCfgC  vec4f              (f[184‥187])  DECOUPLED JITTER under sharp direct (settings.sharpDecouple): xy = the jitter the INTERNAL raster carries relative to the (unjittered) OUTPUT raster, internal px — every internal ↔ output texel map adds it; 0 = the two rasters share one jitter (the sharp path as it was); zw spare
 *    752  rigCfg     vec4f              (f[188‥191])  SDF CHARACTER RIG (render/sdfrig.ts, shaders/sdfrig.wgsl): x = bits (2 smooth-union closest hit in the reflection tracer · 4 soft-shadow character visibility in the direct estimators · 8 its analytic form · 16 smooth union in the soft query · 32 the soft query for broad-class lights too · 64 character SELF-shadow in the direct estimators' shadow rays (common.wgsl selfShadowT) · 128 mesh shadows for NEAR receivers only (common.wgsl meshShadowT, MESH_NEAR_M); bit 1 retired — the round-cone proxy test is unconditional) — 0 = the plain round-cone loops, y = soft-shadow march steps, z = × the lights' angular radius in the soft query, w = the smallest tan(half-angle) it gives a light
 *    768  rigCfgB    vec4f              (f[192‥195])  x = × the per-joint smooth-union radii (0 = plain union), y = closest-hit sphere-trace steps, z = its surface epsilon (m), w = the soft query's smallest march step (m)
 *    784  giCfg      vec4f              (f[196‥199])  GI-in-motion (docs/internal/gi-motion.md): x = the final gather's ray multiplier for YOUNG-history texels (settings.giYoungRays; ≤ 1 = off: the gather as it was), y = the cap on how many texels a frame may take it (count; the rest first-come), z = the history length under which a texel counts as young (frames), w spare
 *    800  weatherE   vec4f              (f[200‥203])  PARTICLE RAIN (game/rainFx.ts, EXPERIMENT): the near-field particle layer's disc — centre x, z, radius (m), and the share 0‥1 of the lattice rain it replaces inside it (on a snow level, where there is no lattice rain: 0, or NEGATIVE the metres past the level's rim the snow goes on falling — particles_common.wgsl snowPast) (volumetrics.wgsl rainNearKeep); w 0 = no particle layer: the lattice exactly as it was
 *    816  weatherF   vec4f              (f[204‥207])  PARTICLE RAIN v2: the drop's PHASE the lattice rain shares with the particles (volumetrics.wgsl rainLight) — x = isotropic floor, y = forward-lobe weight, z = its Henyey-Greenstein g, w = × gain; w 0 = the lattice's isotropic sum exactly as it was
 *    832  = FRAME_BYTES. Every member is 16-byte aligned; adding one = a row here + the struct member in common.wgsl (same order) + its writer in writeFrame + FRAME_BYTES. tools/qa/frame-layout.ts checks the three agree. */
export const FRAME_BYTES = 832;
/** at most this many torch bounce cards a frame (cards.wgsl workgroups; fgather.wgsl stages 4 rows each in workgroup memory and keeps the exclusion set in 8 bits) */
export const MAX_CARDS = 8;

/** What the weather (game/weather.ts) hands the frame: everything the volumetric pass needs to draw rain / splashes / the sky flash in the OUTDOOR air. All zero =
 *  no weather work anywhere (the shader's first test), which is what ?noweather and every Engine nobody attaches a Weather to get. */
export interface WeatherFrame {
  /** rain rate 0‥1: the fraction of the drop-column lattice that is falling (0 = dry: the pass skips the whole block) */
  rain: number;
  /** SNOWFALL 0‥1 on a level built for snow (game/weather.ts → game/snowFx.ts: how many flakes the particle layer keeps in the air). Read on the CPU only — it is
   *  not in the Frame; with it > 0 `rain` is 0, so no streak, ring or wet ground is drawn anywhere. Absent / 0 = none. */
  snow?: number;
  /** wind shear of the falling streaks: metres sideways per metre of height, x and z (wind speed ÷ fall speed) */
  shearX: number; shearZ: number;
  /** ground wetness 0‥1 (splash rings on outdoor ground scale with it; the darkened / glossed asphalt is done on the boxes themselves) */
  wet: number;
  /** radiance added to outdoor air and rain by a lightning stroke's lit sky this frame (linear rgb; 0 outside a flash) */
  flash: Vec3;
  /** streaks live below this height (m) and fade in over the metre under it */
  rainTop: number;
  /** the building's interior footprint x0, z0, x1, z1: rays that end inside it draw no rain, and no rain is drawn inside its column (the roof is invisible, the rooms stay dry) */
  interior: [number, number, number, number];
  /** a second, small roofed footprint outside the main one — the west stair tower the QRF comes up (rays ending in it draw no rain; all zero = none) */
  annex: [number, number, number, number];
  /** WEATHER KINDS (game/weatherKinds.ts; absent / 0 = none — the frame as it was): a third and a fourth roof footprint packed x0 z0 x1 z1 in 8 bits each of
   *  0.2 m (packRect), and the fog in the outdoor air in 32 bits (packFog). They ride in the three spare words of cardCfg (.y .z .w): the Frame keeps its size. */
  roofC?: number; roofD?: number; fog?: number;
  /** PARTICLE RAIN (experiment, game/rainFx.ts): the near-field particle layer's disc — centre x, z, radius (m), and 0‥1 = the share of the LATTICE rain the shader drops
   *  inside it (volumetrics.wgsl rainNearKeep: the streaks / splash rings there are the particles'); all zero = no particle layer, the lattice exactly as it was */
  nearFade: [number, number, number, number];
  /** PARTICLE RAIN v2: the phase function the lattice's streaks share with the particles' (iso, forward weight, HG g, gain — game/rainFx.ts PRAIN); all zero (w 0) = the isotropic sum as it was */
  phase?: [number, number, number, number];
}
export const noWeather = (): WeatherFrame => ({ rain: 0, shearX: 0, shearZ: 0, wet: 0, flash: [0, 0, 0], rainTop: 4.5, interior: [0, 0, 0, 0], annex: [0, 0, 0, 0], nearFade: [0, 0, 0, 0] });

export const FrameFlags = {
  Direct: 1, Indirect: 2, Volumetrics: 4, Smoke: 8, RcVisWeight: 16, ReachMask: 32 /* direct pass + secondary vertices: skip lights whose CPU reach mask (reach.ts) excludes the shading point's cell — set from settings.lightReach */, SmokeShadows: 64, Bounce: 128, Dither: 256, SoftShadow: 512, NightVision: 1024, Temporal: 2048, TileCull: 4096 /* direct pass: lossless per-tile light culling (set from settings.tileCull, not settings.flags) */, SoftTileSkip: 8192 /* penumbra filter: lossless tile-level pass-through (set from settings.softTileSkip) */, TailChroma: 16384,
  CheckerDirect: 65536 /* LOSSY: shadow rays on half the pixels per frame, checkerboard (set from settings.checkerDirect) */,
  GridSkip: 131072 /* trace grid: DDA runs past provably empty cells without loads — lossless (set from settings.gridSkip) */,
  GridYCull: 262144 /* trace grid: cells / boxes / globals outside the ray's remaining height span are not slab-tested — lossless (set from settings.gridYCull) */,
  AxisBox: 524288 /* slab test: unrotated boxes skip the yaw rotation and its three divisions — lossless (set from settings.axisBoxFast) */,
  GridSlabs: 1048576 /* trace grid: globals rejected by the ray segment's bounds on all three axes, cell height spans judged 3.5 cm tighter — lossless (set from settings.gridSlabs) */,
  Gloss: 2097152 /* EXPERIMENT: traced glossy reflections on floors flagged BoxFlag.Gloss (one reflection ray per gloss texel in the final gather, its own half-res specular texture + history + one blur pass, added un-multiplied by albedo in composite) — default off; off stores / filters / reads nothing (set from settings.gloss) */,
  Decals: 4194304 /* decals (E1): the g-buffer's fragment stage applies the marks in render/decals.ts (bullet holes, scorches, scuffs, chips) to the albedo / normal / gloss-keep it stores — set from settings.decals while any decal exists; off = fsBox exactly as it was */,
  MeshShadows: 8388608 /* EXPERIMENT: every shadow / occlusion ray (direct pass, gather hits, cascades, beams, probes) tests characters against their skinned triangle mesh — a per-character refit BVH written by render/meshShadows.ts each frame, walked in common.wgsl meshShadowT — instead of the 15 analytic capsules; primary visibility and closest-hit shading (gather / gloss hits) stay as they are. Default off (settings.meshShadows); needs meshBinding.enabled; off is the untouched capsule path. */,
  Particles: 16777216 /* GPU particles (E4) (render/particles.ts — sparks, debris chips, dust, casings simulated in a compute pass and splatted into the HDR target after the composite). Set from settings.gpuParticles ∧ a Particles attached; no scene shader reads it (the pass graph does) — it rides in the flags word so the HUD / captures say which path drew the sparks. Off = the CPU box sparks exactly as they were. */,
  BounceCards: 33554432 /* torch bounce cards (settings.torchBounceCards): each carried spot light's footprint on the surface it hits is rebuilt every frame as a one-sided analytic emitter (cards.wgsl) that the final gather samples with one shadow ray instead of discovering the hotspot with its cosine rays — which exclude that light's direct term where they land inside the footprint, so nothing is counted twice (fgather.wgsl). Off = no card pass, nothing sampled or excluded: bit-identical. */,
  DirectSeedHold: 67108864 /* direct pass: the per-pixel sampling pattern advances every OTHER frame while direct-light history is on (settings.directSeedHold) — an A/B knob for the torch-shadow boil study (docs/internal/perf-2026-08-10.md), default off = the pattern advances every frame as before */,
  GiAdaptiveHist: 134217728 /* LOSSY: the indirect's temporal accumulation weighs reprojected history by its consistency with this frame's 3×3 neighbourhood — inside the spread: unclipped, weight 0.93; well outside: clipped as before, weight 0.7 (temporal.wgsl; settings.giAdaptiveHistory) — default off = clip + fixed 0.86 as before */,
  Restir: 1073741824 /* ReSTIR DI is the direct-light estimator this frame (settings.restir; render/shaders/restir.wgsl) — the pass graph picks the pipeline; the one scene shader that reads it is softblur.wgsl (its per-channel ratio clamp opens to 4× for the per-light hues, as for TailChroma); it also lets the HUD / captures / dumps say which estimator drew the frame. Off = direct.wgsl's leader / tail path bit for bit */,
  Glass: 268435456 /* glass panes (E3) — boxes flagged BoxFlag.Glass are kept out of the raster and the trace grid and listed in SceneInfo.glass; composite lays Fresnel reflection (traced in the final gather like the gloss floors, sharing their specular texture + history + à-trous pass), the pane's tint and a dust glow over what the G-buffer shows behind them, and the direct pass tints light that crossed a pane (set from settings.glass; off = no pane list at all: empty openings, the level as it was) */,
  FroxelVol: 536870912 /* froxel volumetrics (renderer v3 Phase 2b, render/froxels.ts): haze + smoke in-scatter injected per froxel of a camera-frustum grid with k shadow rays, temporally accumulated, integrated front to back; composite / particles read one trilinear sample, volumetrics.wgsl keeps only the rain (set from settings.froxelVol while a grid exists; off = the per-pixel march exactly as it was) */,
} as const;

export interface FrameParams {
  viewProj: Mat4; invViewProj: Mat4; prevViewProj: Mat4;
  camPos: Vec3; camDir: Vec3; time: number; dt: number;
  width: number; height: number;
  frameIdx: number; numLights: number; flags: number; exposure: number;
  skyZenith: Vec3; skyHorizon: Vec3; hazeDensity: number;
  rcInterval0: number; rcC0Dims: [number, number, number]; rcNumCascades: number; rcD0: number; rcFrameParity: number;
  numSmoke: number; debugView: number;
  indirectScale: number; emissiveScale: number; volSteps: number;
  capColor: [number, number, number, number];
  post: [number, number, number, number];
  rcJitter: [number, number];
  directCfg: [number, number, number, number];   // samplesTop, samplesOther, blurCapPx, historyWeight
  directAdaptiveMin: number;
  numTransient: number;        // transient (ttl) lights alive this frame — lets the gather skip its subtraction loop
  secMinE: number;             // shadow-ray threshold for lights at cascade interval hits (W/m², unshadowed)
  glassCfg: [number, number, number, number];   // glass experiment: x = reflection strength (× the physical Fresnel term), y = tint depth (exponent on the pane's albedo per crossing), z = dust glow gain, w = refraction: the index of refraction while settings.glassRefract (≥ 1), 0 = off (composite.wgsl glassRefractPath)
  lossyCfg: [number, number, number, number];   // lossy options: gather divisor (2|3), volumetric divisor (2|4), dim-ray luminance threshold (0 = off), the gather's relative firefly bound K (0 = off) — see RenderSettings
  /** torch bounce cards this frame (FrameFlags.BounceCards): the light SLOTS (indices into this frame's uploaded light list) whose footprint cards.wgsl rebuilds, ≤ MAX_CARDS; empty = the card pass is not dispatched and the gather touches nothing */
  cardSlots: number[];
  weather: WeatherFrame;       // rain / splashes / sky flash in the outdoor air (volumetrics.wgsl (c)); noWeather() = nothing drawn
  /** volumetric worst-case caps (volumetrics.wgsl): [K = lights traced per smoke-march step / per haze ray (0 = off, the pass as it was), shadow-ray refresh period in march steps (1‥3), march step in tenths of a voxel (10‥30), 0] */
  volCfg: [number, number, number, number];
  /** the weather air march's step cap, packed into volCfg.w bits 24‥28 (0 = half the tier's beam steps; volumetrics.wgsl wxMaxSteps) */
  wxAirSteps?: number;
  /** froxel volumetrics (render/froxels.ts; all zero = no grid, FrameFlags.FroxelVol never up): A = [near m, far m, slice curve a, history weight], B = [W, H, D, k | sharp << 8 | (strata − 1) << 9], C = [jitter x, y, z, lookup bias in slices] */
  froxelA: [number, number, number, number]; froxelB: [number, number, number, number]; froxelC: [number, number, number, number];
  /** the camera position the PREVIOUS frame was rendered from (prevViewProj's eye — the engine snapshots it per render) */
  prevCamPos: Vec3;
  /** last frame's froxelA[0] (the near boundary rides the camera's height; the history reprojects with the mapping it was laid out on) — rides in prevCam.w */
  froxelPrevNear: number;
  /** RT reflections (renderer v3 phase 4, reflect.wgsl): [max roughness that gets a ray, rays per pixel, wet-ground anisotropy 0‥1, the reflection target's divisor — 0 = the pass is off this
   *  frame: nothing dispatched, composite reads nothing] */
  rtCfg: [number, number, number, number];
  /** materials: [analytic-highlight gain (the GGX image of point / spot / panel lights on a finish — 1 = physical), reflection strength ×, per-ray luminance bound, detail-layer amount 0‥1
   *  (the g-buffer's wear / dust / edge terms; 0 = fsBox exactly as it was)] */
  matCfg: [number, number, number, number];
  /** renderer v3 phase 5, the ultra-only extras (engine.ts settings giResample* / rtMeshHits / rtHitReuse; all zero = every pass exactly as it was): [the final gather's resampling mode 0 off · 1 temporal ·
   *  2 + spatial, its packed numbers (fresh rays | M cap << 8 | spatial taps << 16 | radius << 24), the reflection pass's bits (1 mesh closest-hit for characters, 2 second-ray decorrelation + hit reuse), 0] */
  p5Cfg: [number, number, number, number];
  /** TAAU jitter in internal pixels: [this frame's x, y, the previous render's x, y] (all 0 without TAAU) */
  jitter: [number, number, number, number];
  /** MARKINGS (scene/markings.ts, shaders/markings.wgsl): [base texel in metres — 0 = markings off everywhere (the frame as it was), contrast 0‥1, × the emission of emissive markings,
   *  1 = markings are evaluated at reflection hits too] */
  markCfg: [number, number, number, number];
  /** SHARP DIRECT (renderer v3 follow-up, docs/internal/sharp-direct.md): [internal width, height, OUTPUT width, height] while the decoupled-resolution path is live this frame —
   *  the g-buffer, the direct light's unshadowed term, the composite and the TAA run at the output size, everything stochastic stays internal and is joint-bilateral upsampled. z = 0 = off:
   *  every pass exactly as it was (composite / taau / particles_draw read the same statements they always did). Both frame uniforms (internal-screen and output-screen) carry the same four. */
  sharpCfg: [number, number, number, number];
  /** sharp direct's knobs: [edge rays 0|1 (informational: passes.ts dispatches the edge-ray pipeline by the setting; captures / dumps read it), edge ratio spread + hard-hint width px (sharp_edge.wgsl), same-plane k (sharp_direct.wgsl)] */
  sharpCfgB: [number, number, number, number];
  /** DECOUPLED JITTER (settings.sharpDecouple, sharp direct only): [the internal raster's jitter relative to the output raster in internal px x, y, 0, 0] — 0 = one jitter for both (as it was) */
  sharpCfgC: [number, number, number, number];
  /** SDF CHARACTER RIG (render/sdfrig.ts + shaders/sdfrig.wgsl; engine.ts settings sdfRigSmooth / charSoftShadow …): [bits (2 smooth closest hit in reflections · 4 soft character shadows in the direct
   *  estimators · 8 analytic soft form · 16 smooth union in the soft query · 32 broad lights too; bit 1 retired; 0 = the plain round-cone loops), soft march steps, × light angular radius, min tan(half-angle)] */
  rigCfg: [number, number, number, number];
  /** [× the per-joint smooth-union radii (0 = plain union), closest-hit sphere-trace steps, its epsilon (m), the soft query's min march step (m)] */
  rigCfgB: [number, number, number, number];
  /** GI-IN-MOTION (fgather.wgsl `main`): [young-history ray multiplier k (≤ 1 = off — the gather byte for byte as it was), the per-frame cap on texels that may take it (count), the history length (frames)
   *  under which a texel is 'young', 0] */
  giCfg?: [number, number, number, number];   // (optional: fixtures / probes built before it wrote nothing there — zeros = off)
}

const ZERO4: [number, number, number, number] = [0, 0, 0, 0];
/** typed views over a frame block, made once per ArrayBuffer (the engine writes the same two blocks every frame — review R1.4: no fresh views per call) */
const frameViews = new WeakMap<ArrayBuffer, { f: Float32Array; u: Uint32Array; b: Uint8Array }>();
function viewsOf(buf: ArrayBuffer) { let v = frameViews.get(buf); if (!v) { v = { f: new Float32Array(buf), u: new Uint32Array(buf), b: new Uint8Array(buf) }; frameViews.set(buf, v); } return v; }
export function writeFrame(dst: ArrayBuffer, p: FrameParams) {
  const { f, u } = viewsOf(dst);
  f.set(p.viewProj, 0); f.set(p.invViewProj, 16); f.set(p.prevViewProj, 32);
  f.set(p.camPos, 48); f[51] = p.time;
  f.set(p.camDir, 52); f[55] = p.dt;
  f[56] = p.width; f[57] = p.height; f[58] = 1 / p.width; f[59] = 1 / p.height;
  u[60] = p.frameIdx; u[61] = p.numLights; u[62] = p.flags; f[63] = p.exposure;
  f.set(p.skyZenith, 64); f[67] = p.hazeDensity;
  f.set(p.skyHorizon, 68); f[71] = p.rcInterval0;
  u[72] = p.rcC0Dims[0]; u[73] = p.rcC0Dims[1]; u[74] = p.rcC0Dims[2]; u[75] = p.rcNumCascades;
  u[76] = p.rcD0; u[77] = p.rcFrameParity; u[78] = p.numSmoke; u[79] = p.debugView;
  f[80] = p.indirectScale; f[81] = p.emissiveScale; u[82] = p.volSteps; f[83] = p.secMinE;
  f[84] = p.capColor[0]; f[85] = p.capColor[1]; f[86] = p.capColor[2]; f[87] = p.capColor[3];
  f[88] = p.post[0]; f[89] = p.post[1]; f[90] = p.post[2]; f[91] = p.post[3];
  f[92] = p.rcJitter[0]; f[93] = p.rcJitter[1]; f[94] = p.directAdaptiveMin; f[95] = p.numTransient;
  f[96] = p.directCfg[0]; f[97] = p.directCfg[1]; f[98] = p.directCfg[2]; f[99] = p.directCfg[3];
  f[100] = p.lossyCfg[0]; f[101] = p.lossyCfg[1]; f[102] = p.lossyCfg[2]; f[103] = p.lossyCfg[3];
  const nc = Math.min(p.cardSlots.length, MAX_CARDS);
  u[104] = nc; u[105] = 0; u[106] = 0; u[107] = 0;                     // cardCfg: x = card count this frame
  for (let k = 0; k < MAX_CARDS; k++) u[108 + k] = k < nc ? p.cardSlots[k] >>> 0 : 0;   // cardSlots: array<vec4u, 2> = 8 light slots
  const w = p.weather;
  f[116] = w.rain; f[117] = w.shearX; f[118] = w.shearZ; f[119] = w.wet;                 // weatherA @464
  f[120] = w.flash[0]; f[121] = w.flash[1]; f[122] = w.flash[2]; f[123] = w.rainTop;   // weatherB @480
  f[124] = w.interior[0]; f[125] = w.interior[1]; f[126] = w.interior[2]; f[127] = w.interior[3];   // weatherC @496
  f[128] = p.glassCfg[0]; f[129] = p.glassCfg[1]; f[130] = p.glassCfg[2]; f[131] = p.glassCfg[3];   // glassCfg @512
  f[132] = w.annex[0]; f[133] = w.annex[1]; f[134] = w.annex[2]; f[135] = w.annex[3];   // weatherD @528
  u[105] = (w.roofC ?? 0) >>> 0; u[106] = (w.roofD ?? 0) >>> 0; u[107] = (w.fog ?? 0) >>> 0;   // cardCfg.yzw @420: the weather kinds' extra roofs + fog (0 0 0 = none, as these words always were)
  u[136] = p.volCfg[0] >>> 0; u[137] = p.volCfg[1] >>> 0; u[138] = p.volCfg[2] >>> 0; u[139] = (p.volCfg[3] | (((p.wxAirSteps ?? 0) & 31) << 24)) >>> 0;   // volCfg @544
  f[140] = p.froxelA[0]; f[141] = p.froxelA[1]; f[142] = p.froxelA[2]; f[143] = p.froxelA[3];   // froxelA @560
  u[144] = p.froxelB[0] >>> 0; u[145] = p.froxelB[1] >>> 0; u[146] = p.froxelB[2] >>> 0; u[147] = p.froxelB[3] >>> 0;   // froxelB @576
  f[148] = p.froxelC[0]; f[149] = p.froxelC[1]; f[150] = p.froxelC[2]; f[151] = p.froxelC[3];   // froxelC @592
  f[152] = p.prevCamPos[0]; f[153] = p.prevCamPos[1]; f[154] = p.prevCamPos[2]; f[155] = p.froxelPrevNear;    // prevCam @608 (w = last frame's near)
  f[156] = p.rtCfg[0]; f[157] = p.rtCfg[1]; f[158] = p.rtCfg[2]; f[159] = p.rtCfg[3];           // rtCfg @624
  f[160] = p.matCfg[0]; f[161] = p.matCfg[1]; f[162] = p.matCfg[2]; f[163] = p.matCfg[3];       // matCfg @640
  u[164] = p.p5Cfg[0] >>> 0; u[165] = p.p5Cfg[1] >>> 0; u[166] = p.p5Cfg[2] >>> 0; u[167] = p.p5Cfg[3] >>> 0;   // p5Cfg @656
  f[168] = p.jitter[0]; f[169] = p.jitter[1]; f[170] = p.jitter[2]; f[171] = p.jitter[3];       // jitter @672
  f[172] = p.markCfg[0]; f[173] = p.markCfg[1]; f[174] = p.markCfg[2]; f[175] = p.markCfg[3];   // markCfg @688
  f[176] = p.sharpCfg[0]; f[177] = p.sharpCfg[1]; f[178] = p.sharpCfg[2]; f[179] = p.sharpCfg[3];   // sharpCfg @704
  f[180] = p.sharpCfgB[0]; f[181] = p.sharpCfgB[1]; f[182] = p.sharpCfgB[2]; f[183] = p.sharpCfgB[3];   // sharpCfgB @720
  f[184] = p.sharpCfgC[0]; f[185] = p.sharpCfgC[1]; f[186] = p.sharpCfgC[2]; f[187] = p.sharpCfgC[3];   // sharpCfgC @736
  f[188] = p.rigCfg[0]; f[189] = p.rigCfg[1]; f[190] = p.rigCfg[2]; f[191] = p.rigCfg[3];               // rigCfg @752
  f[192] = p.rigCfgB[0]; f[193] = p.rigCfgB[1]; f[194] = p.rigCfgB[2]; f[195] = p.rigCfgB[3];           // rigCfgB @768
  const gc = p.giCfg ?? ZERO4; f[196] = gc[0]; f[197] = gc[1]; f[198] = gc[2]; f[199] = gc[3];   // giCfg @784 (p.giCfg; absent = zeros = the gather as it was)
  const nf = w.nearFade ?? ZERO4;
  f[200] = nf[0]; f[201] = nf[1]; f[202] = nf[2]; f[203] = nf[3];   // weatherE @800 (particle rain's near-field disc; a WeatherFrame written before the field existed reads as zeros)
  const pf = w.phase ?? ZERO4;
  f[204] = pf[0]; f[205] = pf[1]; f[206] = pf[2]; f[207] = pf[3];   // weatherF @816 (particle rain v2: the drop's phase for the lattice; zeros = isotropic as it was)
}

/** The OUTPUT-screen twin of a frame block already written by writeFrame: the same bytes with screen / invScreen (f[56‥59]) replaced by the output size — what the passes that run at the OUTPUT
 *  resolution under sharp direct (the g-buffer raster, the unshadowed-direct + composite kernels, the TAA resolve, the particles' splat) bind as group 0, so `frame.screen`, worldFromDepth and every
 *  pixel-footprint term mean THEIR pixel there with no shader knowing the difference. */
export function writeFrameOut(dst: ArrayBuffer, src: ArrayBuffer, outW: number, outH: number, mats?: { viewProj: Mat4; invViewProj: Mat4; prevViewProj: Mat4 }) {
  viewsOf(dst).b.set(viewsOf(src).b);
  const f = viewsOf(dst).f; f[56] = outW; f[57] = outH; f[58] = 1 / outW; f[59] = 1 / outH;
  if (mats) { f.set(mats.viewProj, 0); f.set(mats.invViewProj, 16); f.set(mats.prevViewProj, 32); f[168] = 0; f[169] = 0; f[170] = 0; f[171] = 0; }   // (+ frame.jitter @672 zeroed: this raster has none) — DECOUPLED JITTER: the output raster's own (unjittered) matrices — the g-buffer, U, the composite, GBAA and the 1 : 1 resolve then run on a still raster while the internal terms keep their jitter
}

/** WGSL prelude for every shader that touches the scene: world consts (+ the size of the per-light reach uniform, which needs lights.ts's MAX_LIGHTS) + common declarations (group 0). */
/** How the per-light reach rows are bound (set before the Engine is built): a read-only STORAGE buffer by default — measured 0.12–0.17 ms cheaper on the
 *  direct pass than the uniform on Apple GPUs (divergent indexing of a uniform array), A/B'd both ways twice — which makes 9 storage buffers in the compute
 *  stage; an adapter that only offers the WebGPU default of 8 gets the UNIFORM binding instead (the Engine constructor decides, for game and viewer alike;
 *  ?reachUniform in main.ts forces it for A/B). */
export const reachBinding = { storage: true };
/** Whether the mesh-shadow buffer (render/meshShadows.ts: per-character refit triangle BVHs + skinned corners, ONE read-only storage buffer at binding 13) is
 *  part of the scene group at all. It costs a storage-buffer slot in every scene pipeline whether or not settings.meshShadows is on, so the Engine
 *  constructor turns it off on adapters whose per-stage budget cannot take scene 6 + reach 1 + mesh 1 + the cascade trace's / probe's 2 = 10 (Chrome on
 *  Metal offers exactly 10); the prelude then declares a stub meshLoad() and the setting is inert (engine.meshShadowsAvailable says which). */
export const meshBinding = { enabled: true };
/** RAY-TRAVERSAL LAB (ported from exp/trace-perf, docs/internal/trace-perf.md; tools/qa/trace-lab.js + shaders/trace_lab.wgsl): `variant` becomes the compile-time const
 *  `TRACE_VARIANT` at the head of the scene prelude — the lab's generated selector functions switch on it, and a traversal experiment can add V-suffixed copies of
 *  occluded / occludedT / traceClosest to common.wgsl behind thin dispatchers on the same const (the branch's negative-result variants were NOT ported: only 0 = today's walk
 *  exists, so any N compiles the reference and the engine's own shaders never read the const). Set once before the Engine builds a pipeline (main.ts ?trace=N).
 *  `common` overrides the bundled common.wgsl TEXT for the in-page lab: __hotCommon installs an edited file into every tracing pipeline without a reboot. */
export const traceConfig = { variant: 0, common: null as string | null };
/** GLASS BREAKING (game/glassbreak.ts, docs/internal/glassbreak.md): the compile-time switch for its shader reads — the scene prelude's `const GLASS_BREAK` (glassTrace /
 *  glassTransmit passing fallen cells in common.wgsl, the crack network in composite.wgsl). main.ts raises it at BOOT from the persisted `tune.glassBreak` before the Engine
 *  builds a pipeline; false = every such statement is dead code the compiler drops — the modules as they were (flag-off identity is hash-proven against main). A page
 *  reload applies a change of the switch to the GPU side. */
export const glassBreakConfig = { on: false };
/** WEATHER KINDS (game/weatherKinds.ts, game/weather.ts): the compile-time switch for their shader reads — the scene prelude's `const WX_KINDS` (the level's own
 *  roofs and the fog in the outdoor air: common.wgsl wx*, read by composite / vol_common / volumetrics / fgather / particles_common). main.ts raises it at BOOT
 *  when the page is opened with ?weather=<kind>, or (WX_OWN.roofs) on a level that is not the office's family — its own storm reads its own roofs; false = every such statement is dead code the compiler drops — the modules as they were. */
export const weatherKindConfig = { on: false };
/** SNOW (game/weatherKinds.ts SNOW_LEVELS, game/snowFx.ts): the compile-time switch for the particle shaders' flake half — the scene prelude's `const WX_SNOW`
 *  (particles.wgsl rainStep: a flake rides the air, flutters, wraps round the view's disc and lands without a splash; particles_draw.wgsl rainFragment: a soft
 *  round flake, nothing refracted). main.ts raises it at BOOT on a page whose level is one built for snow; false = every such statement is dead code the compiler
 *  drops — the rain's modules as they were. A page is one level for its whole life, so the two never meet. */
export const snowConfig = { on: false };
/** THE SNOW'S LOOK (game/weatherKinds.ts SNOW_LOOK; picture only): two more compile-time words for a page opened on a snow level, raised by main.ts at BOOT with
 *  snowConfig. `surface` → the prelude's `const SNOW_SURF`: the g-buffer shades the snow paint as one surface off the level's snow field and draws its drifts as a
 *  mesh (shaders/snow.wgsl, render/snowField.ts). `wisps` → `const SNOW_WISPS`: the particle shaders' half of the wisps the wind runs over the ground
 *  (game/snowFx.ts). false = dead code the compiler drops: every module as it was. */
export const snowLookConfig = { surface: false, wisps: false, tracks: false, glow: false, sparkle: false, grains: false };   // (`grains` → `const SNOW_GRAINS`: the particle shaders' half of the fine grains that ride the air field, render/airField.ts; `tracks` → `const SNOW_TRACKS`: snow.wgsl reads the trail texture; `glow` → `const SNOW_GLOW`: the lighting shaders' wrap on snow pixels; `sparkle` → `const SNOW_SPARKLE`: composite.wgsl's facet flashes on lit fresh snow)
/** THE VEIL AT THE BUILDING'S SHELL (common.wgsl wxFogApplySurf — a picked weather's fog on the outside faces of outside walls, a ramp across a roof's edge): the
 *  scene prelude's `const WX_EDGE`. On by default; main.ts lowers it at BOOT for ?nowallfog = the fog classed by the surface point alone, the picture as it was
 *  (composite.wgsl takes wxFogApply, the statement it always had). Read only under WX_KINDS: with no weather picked it is dead code either way. Picture only. */
export const weatherEdgeConfig = { on: true };
/** THE WEATHER'S AIR AS A VOLUME (common.wgsl wxAir / wxIndoor, volumetrics.wgsl wxAirMarch; game/airDust.ts): a picked weather's dust / fog is a MEDIUM the
 *  volumetric pass marches — thicker the more of it a pixel looks through, lit by the sun / moon with shadow rays and by the sky's light, carried into rooms at
 *  open doors and blown walls — in place of composite.wgsl's flat veil over what counts as outdoors (wxFogApply / wxFogApplySurf). The scene prelude's `const WX_VOL`.
 *  On by default; main.ts lowers it at BOOT for ?flatfog = the veil exactly as it was. Read only under WX_KINDS: with no weather picked it is dead code either way. */
export const weatherVolConfig = { on: true };
/** RAIN IS NOT LIT THROUGH A SHUT DOOR OR A WALL (volumetrics.wgsl rainLight): the rain's streaks and splashes were lit UNSHADOWED by every light whose reach
 *  mask (render/reach.ts) has their cell — and a mask counts every door as standing open and knows nothing of a light that is carried, so a bulb in a shut room
 *  lit the rain in a wedge outside its door and a weapon light pointed at a wall from inside lit the rain beyond it. The scene prelude's `const RAIN_SHADOW`:
 *  one shadow ray where the mask is not sure (a cell reached only through a doorway or by a sliver), for a carried light and for a flash. On by default;
 *  main.ts lowers it at BOOT for ?norainshadow = the rain lit as it was. Picture only. */
export const rainShadowConfig = { on: true };
/** A SPLASH IS THE SAME SPLASH AT EVERY ZOOM (volumetrics.wgsl splashAt; the maintainer, 10-19, three zooms of one yard: "the low res rain isn't scale
 *  invariant"). The ring a landing drop throws up is drawn in the volumetric pass, whose texel is 2 or 4 pixels: the ring's line is never drawn thinner than
 *  a texel AT ITS DISTANCE, and it was drawn at full brightness however wide that made it — so with the camera pulled back a 2 cm ring became a blob a
 *  texel or two across (30 cm of yard) as bright as the ring, and a third of the lit ground was blobs where, close in, a hundredth of it is rings. The scene
 *  prelude's `const RAIN_SCALE`: the ring keeps its LIGHT, not its brightness — drawn wider than its 6 mm line it is dimmer by the footprint it gained (what
 *  the streaks beside it always did: RAIN_W / halfW). Close in (a texel under 6 mm at the ground) nothing changes. On by default; main.ts lowers it at BOOT
 *  for ?norainscale = the rings as they were. Picture only. */
export const rainScaleConfig = { on: true };
/** the prelude's consts for it: the switch, and where the air grid (scene/airGrid.ts) sits in boxMat's tail — after the marking and glass tables and BEFORE the cut
 *  table, so this text is the same with the cut switch on or off (the cut swap's boot programs are the ?nocutboxes text character for character: probes.ts cutboxes-pack) */
function weatherVolWgsl(): string {
  return `const WX_VOL: bool = ${weatherVolConfig.on ? 'true' : 'false'}; const WXD_BASE: u32 = MAX_BOXES * 4u + ${MARK_TABLE_ROWS + GB_ROWS}u; const WXD_W: i32 = ${AIR_W}; const WXD_H: i32 = ${AIR_H}; const WXD_CELL: f32 = ${AIR_CELL};   // the weather's air as a volume (render/frame.ts weatherVolConfig; scene/airGrid.ts)\n`;
}
/** the common.wgsl text the prelude is built from right now (the lab reads it to derive which variants exist) */
export function commonSource(): string { return traceConfig.common ?? commonSrc; }
/** `cut`: compile the CUT BOXES rule in (scene/cut.ts). The default is what a module compiled at BOOT gets: the rule only when the switch is on AND the programs are not
 *  swapped (cutConfig.swap false) — under the swap (render/cutSwap.ts) every boot module is the build's without the rule, and the cut set asks with `true`. */
export function scenePrelude(cut: boolean = cutConfig.on && !cutConfig.swap): string {
  const commonText = `const TRACE_VARIANT: u32 = ${traceConfig.variant | 0}u;   // ray-traversal lab variant (render/frame.ts traceConfig; 0 = the reference walk — unread by the engine's shaders)\nconst WX_KINDS: bool = ${weatherKindConfig.on ? 'true' : 'false'};   // weather kinds (render/frame.ts weatherKindConfig): false = the wx* reads below are dead code\nconst WX_SNOW: bool = ${snowConfig.on ? 'true' : 'false'};   // a level built for snow (render/frame.ts snowConfig): the rain ring's particles are FLAKES — false = the wx snow statements are dead code\nconst SNOW_SURF: bool = ${snowLookConfig.surface ? 'true' : 'false'};   // a snow level's lying snow is one surface (render/frame.ts snowLookConfig; shaders/snow.wgsl) — false = dead code\nconst SNOW_WISPS: bool = ${snowLookConfig.wisps ? 'true' : 'false'}; const SNOW_TRACKS: bool = ${snowLookConfig.tracks ? 'true' : 'false'}; const SNOW_GLOW: bool = ${snowLookConfig.glow ? 'true' : 'false'}; const SNOW_SPARKLE: bool = ${snowLookConfig.sparkle ? 'true' : 'false'}; const SNOW_GRAINS: bool = ${snowLookConfig.grains ? 'true' : 'false'};   // … and the wind runs wisps of fine snow over it (game/snowFx.ts) — false = dead code\nconst RAIN_SCALE: bool = ${rainScaleConfig.on ? 'true' : 'false'};   // a splash ring drawn wider than its line keeps its light, not its brightness (render/frame.ts rainScaleConfig): false = as bright however wide, as it was\nconst RAIN_SHADOW: bool = ${rainShadowConfig.on ? 'true' : 'false'};   // rain asks a shadow ray where a light's reach mask is not sure (render/frame.ts rainShadowConfig): false = lit by the mask alone, as it was\nconst WX_EDGE: bool = ${weatherEdgeConfig.on ? 'true' : 'false'};   // the weather's veil at the building's shell (render/frame.ts weatherEdgeConfig): false = composite.wgsl fogs by the surface point alone, as it always did\nconst GLASS_BREAK: bool = ${glassBreakConfig.on ? 'true' : 'false'}; const GB_BASE: u32 = MAX_BOXES * 4u + ${MARK_TABLE_ROWS}u;   // glass breaking (render/frame.ts glassBreakConfig; game/glassbreak.ts): false = the cell-table reads in glassTrace / glassTransmit / composite are dead code; GB_BASE = the cell table's first vec4 row in boxMat (after the marking table: scene/markings.ts MARK_TABLE_ROWS)\n` + (cut ? `const CUT_BOXES: bool = true; const CUT_ROWS: u32 = ${CUT_ROWS}u; const CUT_STRIDE: u32 = ${CUT_STRIDE}u; const CUT_BASE: u32 = MAX_BOXES * 4u + ${MARK_TABLE_ROWS + GB_ROWS + AIR_ROWS}u;   // cut boxes (scene/cut.ts cutConfig): a box flagged GEO_CUT is clipped by the planes in its CUT_ROWS rows of boxMat from CUT_BASE (after the marking and glass tables and the weather's air grid) — isectBox, boxNormalFromCode, the g-buffer's cut pass\n` : `const CUT_BOXES: bool = false; const CUT_ROWS: u32 = ${CUT_ROWS}u; const CUT_STRIDE: u32 = ${CUT_STRIDE}u; const CUT_BASE: u32 = 0u;   // cut boxes off (scene/cut.ts cutConfig): the cut reads in isectBox / boxNormalFromCode are dead code\n`) + commonSource() + '\n' + smokeReadConsts(smokeGrid()) + smokeReadSrc;   // (+ every smoke read: the lattices' numbers as consts — smoke/smokeGrid.ts — then shaders/smoke_read.wgsl)
  const decl = reachBinding.storage
    ? '@group(0) @binding(12) var<storage, read> lightReachS: array<u32>;\nfn reachWord(w: u32) -> u32 { return lightReachS[w]; }\n'
    : '@group(0) @binding(12) var<uniform> lightReachU: array<vec4u, REACH_VEC4S>;\nfn reachWord(w: u32) -> u32 { return lightReachU[w >> 2u][w & 3u]; }\n';
  const mesh = meshBinding.enabled
    ? '@group(0) @binding(13) var<storage, read> meshData: array<vec4u>;   // mesh-shadow trees + skinned corners (render/meshShadows.ts layout; walked by meshShadowT under FLAG_MESH_SHADOWS)\nfn meshLoad(i: u32) -> vec4u { return meshData[i]; }\n'
    : 'fn meshLoad(i: u32) -> vec4u { return vec4u(0u); }   // no mesh-shadow binding on this adapter (frame.ts meshBinding): a zero header = an empty tree, and the engine never raises the flag\n';
  return wgslWorldConsts() + weatherVolWgsl() + `const REACH_VEC4S: u32 = ${REACH_VEC4S}u;   // lightReach uniform: MAX_LIGHTS × REACH_ROW_WORDS u32 as vec4u (render/lights.ts)\nconst MESH_MAX_CHARS: u32 = ${MESH_MAX_CHARS}u;   // characters with a mesh-shadow tree (render/meshbvh.ts)\n` + commonText + '\n' + decl + mesh
    + sdfRigWgslConsts() + sdfRigSrc + '\n';   // the SDF character rig (render/sdfrig.ts's per-slot table as consts + the generated charSdf fold, then shaders/sdfrig.wgsl): the round-cone primitive common.wgsl's proxy loops call, plus the smooth-union / soft-query extras — compiled only into the modules that name them, and not taken while frame.rigCfg.x is 0
}

export function createSceneLayout(device: GPUDevice): GPUBindGroupLayout {
  const all = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE;
  const cf = GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE;
  const entries: GPUBindGroupLayoutEntry[] = [
      { binding: 0, visibility: all, buffer: { type: 'uniform' } },
      { binding: 1, visibility: all, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: all, buffer: { type: 'read-only-storage' } },
      { binding: 3, visibility: cf, buffer: { type: 'read-only-storage' } },
      { binding: 4, visibility: cf, buffer: { type: 'read-only-storage' } },
      { binding: 5, visibility: all, buffer: { type: 'uniform' } },
      { binding: 6, visibility: cf, buffer: { type: 'read-only-storage' } },
      { binding: 7, visibility: cf, buffer: { type: 'uniform' } },
      { binding: 8, visibility: cf, texture: { sampleType: 'float', viewDimension: '3d' } },
      { binding: 9, visibility: cf, sampler: { type: 'filtering' } },
      { binding: 10, visibility: cf, buffer: { type: 'read-only-storage' } },
      { binding: 11, visibility: all, buffer: { type: 'uniform' } },   // the fog of war's sight table (render/fogofwar.ts FogSight; common.wgsl fogSeenAt reads it for a light with a fog bit, the picture's smoke and its particles) — a uniform: no sampled texture is left to a fragment stage
      { binding: 12, visibility: cf, buffer: { type: reachBinding.storage ? 'read-only-storage' : 'uniform' } },   // per-light reach masks (lights.ts reachBuf: REACH_BYTES = 17.5 KB as array<vec4u, REACH_VEC4S>). Uniform for the storage-buffer budget: the group binds 6 storage buffers (1 2 3 4 6 10); the cascade trace and the light probe add 2 each in group 1 = 8 in the compute stage = the WebGPU DEFAULT maxStorageBuffersPerShaderStage, so any core adapter runs it (engine.ts still checks ≥ 8 at boot with a readable message)
  ];
  if (meshBinding.enabled) entries.push({ binding: 13, visibility: cf, buffer: { type: 'read-only-storage' } });   // mesh-shadow trees (meshShadows.ts): the group's 8th storage buffer where the adapter affords 10 per stage (see meshBinding)
  entries.push({ binding: 14, visibility: cf, texture: { sampleType: 'uint', viewDimension: '3d' } });   // the smoke's page texture (a TEXTURE: the storage-buffer slots are all spoken for)
  return device.createBindGroupLayout({ label: 'sceneLayout', entries });
}

export interface SceneBuffers {
  frame: GPUBuffer; boxGeo: GPUBuffer; boxMat: GPUBuffer; gridCells: GPUBuffer; gridItems: GPUBuffer; sceneInfo: GPUBuffer; lights: GPUBuffer; smoke: GPUBuffer; smokeAtlasView: GPUTextureView; lightReach: GPUBuffer; linSamp: GPUSampler; capsules: GPUBuffer;
  /** the mesh-shadow buffer (MeshShadows.buf), or any ≥ 32-byte storage buffer of zeros while none is attached (a zero header is an empty tree); ignored when !meshBinding.enabled */
  mesh: GPUBuffer;
  /** the smoke's page texture (smoke/smoke.ts; engine.ts has a 1³ stand-in until a solver is attached) */
  smokePage: GPUTextureView;
  /** the fog of war's sight table (render/fogofwar.ts FogSight.buf) — or, for the group the table's own pass is bound with, a stand-in as large, all zeros */
  fogSight: GPUBuffer;
}
export function createSceneBindGroup(device: GPUDevice, layout: GPUBindGroupLayout, b: SceneBuffers): GPUBindGroup {
  const entries: GPUBindGroupEntry[] = [
      { binding: 0, resource: { buffer: b.frame } },
      { binding: 1, resource: { buffer: b.boxGeo } },
      { binding: 2, resource: { buffer: b.boxMat } },
      { binding: 3, resource: { buffer: b.gridCells } },
      { binding: 4, resource: { buffer: b.gridItems } },
      { binding: 5, resource: { buffer: b.sceneInfo } },
      { binding: 6, resource: { buffer: b.lights } },
      { binding: 7, resource: { buffer: b.smoke } },
      { binding: 8, resource: b.smokeAtlasView },
      { binding: 9, resource: b.linSamp },
      { binding: 10, resource: { buffer: b.capsules } },
      { binding: 11, resource: { buffer: b.fogSight } },
      { binding: 12, resource: { buffer: b.lightReach } },
  ];
  if (meshBinding.enabled) entries.push({ binding: 13, resource: { buffer: b.mesh } });
  entries.push({ binding: 14, resource: b.smokePage });
  return device.createBindGroup({ label: 'sceneBG', layout, entries });
}
