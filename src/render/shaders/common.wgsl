// ---- shared declarations: frame uniforms, scene buffers, ray queries against the box grid, light evaluation ----
// (WORLD_* / GRID_* / RC_* consts are prepended by the host.)

struct Frame {
  viewProj: mat4x4f,
  invViewProj: mat4x4f,
  prevViewProj: mat4x4f,
  camPos: vec3f, time: f32,
  camDir: vec3f, dt: f32,
  screen: vec2f, invScreen: vec2f,          // full-res target size
  frameIdx: u32, numLights: u32, flags: u32, exposure: f32,
  skyZenith: vec3f, hazeDensity: f32,
  skyHorizon: vec3f, rcInterval0: f32,      // base interval length (m)
  rcC0Dims: vec3u, rcNumCascades: u32,      // c0 probe grid dims (x,y,z)
  rcD0: u32, rcFrameParity: u32, numSmoke: u32, debugView: u32,
  indirectScale: f32, emissiveScale: f32, volSteps: u32, secMinE: f32,   // secMinE: at secondary vertices (cascade interval hits) a light dimmer than this (unshadowed W/m²) is not worth a shadow ray and is dropped
  capColor: vec4f,                          // rgb = section-cap tint for wall tops under the hidden ceiling, a = use albedo fraction
  post: vec4f,                              // x = night-vision amount, y = nv gain, z = hit flash, w = tan(fov/2) (metres → pixels for blur sizing)
  rcJitter: vec4f,                          // xy = this frame's sub-texel offset for the cascades' octahedral direction set (0.5,0.5 = texel centres); z = direct-light adaptive sampling: stop after this many agreeing samples; w = number of transient lights alive this frame
  directCfg: vec4f,                         // x = emitter samples for the strongest light per class, y = samples for the other leaders, z = penumbra filter cap (px), w = direct-light history weight (0 = none)
  lossyCfg: vec4f,                          // the lossy options' numbers (defaults = the untouched path): x = final-gather resolution divisor (2; 3 with gatherThird), y = volumetrics divisor (2; 4 with volQuarter), z = dimRays threshold on a pixel's total unshadowed luminance below which leaders get one shadow sample (0 = off), w spare  · w = the final gather's relative firefly bound K (each ray ≤ K × the cache's irradiance at the shading point ÷ π; 0 = off)
  cardCfg: vec4u,                           // x = torch bounce cards this frame (FLAG_BOUNCE_CARDS; 0 = none: cards.wgsl not dispatched, fgather samples / excludes nothing); y, z = WEATHER KINDS' third / fourth roof footprint (wxRect; 0 = none), w = the fog in the outdoor air (wxFog; 0 = none) — game/weatherKinds.ts
  cardSlots: array<vec4u, 2>,               // the light slot each card k = 0..7 is built from ([k >> 2][k & 3]); cards.wgsl reads it, and writes the slot back into the card rows the gather stages
  weatherA: vec4f,                          // the weather (game/weather.ts → volumetrics.wgsl (c)): x = rain rate 0..1 (0: nothing drawn), y / z = wind shear of the streaks (m sideways per m of height), w = ground wetness 0..1 (splash rings)
  weatherB: vec4f,                          // rgb = radiance a lightning stroke's lit sky adds to outdoor air + rain this frame, w = rain top (m; streaks fade in over the metre below it)
  weatherC: vec4f,                          // the interior footprint x0, z0, x1, z1: no rain on rays that end inside it, none drawn inside its column
  glassCfg: vec4f,                          // glass panes (FLAG_GLASS): x = reflection strength (× the physical Fresnel term; 1 = as computed), y = tint depth (exponent on the pane's albedo per crossing, ÷ cos of the crossing angle), z = dust glow gain (× GLASS_DUST), w = REFRACTION: the index of refraction (≥ 1) while settings.glassRefract, 0 = off — composite bends the view ray through every glass box it meets (composite.wgsl glassRefractPath)
  weatherD: vec4f,                          // a second, small no-rain footprint x0, z0, x1, z1 (the west stair tower's roofed landing): rays ending inside it draw no rain; all zero = none
  volCfg: vec4u,                            // volumetric worst-case caps (volumetrics.wgsl VOL_KMAX): x = K, the most lights a smoke-march step / a haze ray traces shadow rays for (0 = off: the pass exactly as it was); y = the march's shadow-ray refresh period in steps; z = its step in tenths of a voxel; w = bits 0‥3 the SHADOW rays' smoke sample count (smokeShadowSteps(): 0 = 8) | bits 8‥11 the smoke march's per-step light count (vol_common.wgsl smokeMarchLights(); 0 = J-lit)
  froxelA: vec4f,                           // froxel volumetrics (FLAG_FROXEL_VOL, render/froxels.ts): x = distance of slice boundary 0 along the pixel ray (m), y = of boundary D (m), z = slice curve a (thickness grows e^a from first to last slice; → 0 = uniform), w = history weight this frame (0 = none: first frame of a grid, or history off)
  froxelB: vec4u,                           // x, y, z = the froxel grid W × H × D (0 = no grid: the flag is never up then), w = k, shadow-rayed lights per froxel (bits 0‥7) | the fetch's screen filter << 8 (0 = cubic B-spline, 1 = plain trilinear — settings.froxelSharp) | (depth strata for the strongest light − 1) << 9, 2 bits (settings.froxelTopRays)
  froxelC: vec4f,                           // xyz = this frame's sample jitter inside every froxel (0‥1, a Halton triple), w = the lookup's depth bias in slices (toward the eye: what a surface reads never includes scatter from behind it)
  prevCam: vec4f,                           // xyz = the camera position of the PREVIOUS frame (prevViewProj's eye; the froxel history reprojects distances from it), w = the previous frame's froxelA.x (the near boundary follows the camera's height, so the history's slices are laid out on last frame's near)
  rtCfg: vec4f,                             // ray-traced reflections (renderer v3 phase 4, reflect.wgsl): x = max roughness that gets a ray (composite fades the term out toward it), y = rays per pixel (1|2), z = anisotropy 0..1 on aniso-finished (wet) ground + 2 × the wet ground's break-up in tenths (settings.wetBreakup; read an = z − 2·floor(z/2)), w = the reflection target's resolution divisor — 0 = the pass is OFF this frame (nothing dispatched, composite reads nothing: the frame as it was)
  matCfg: vec4f,                            // materials: x = analytic-highlight gain (the GGX image of point / spot / panel lights on a finish; 1 = physical), y = reflection strength × the whole traced term, z = luminance bound on one reflection ray's radiance (firefly guard), w = the g-buffer's detail-layer amount 0..1 (worn paths, dust on tall tops, scuffed skirting, edge wear on metal — 0 = fsBox exactly as it was)
  p5Cfg: vec4u,                             // renderer v3 phase 5 (ultra-only extras; every field 0 = the pass exactly as it was): x = the final gather's resampling mode (0 off · 1 temporal reservoir reuse · 2 + spatial reuse — fgather.wgsl mainGi), y = its numbers: fresh rays per texel (bits 0‥3) | temporal M cap << 8 (8 bits) | spatial taps << 16 (4 bits) | spatial radius in gather texels << 24, z = the reflection pass's bits: 1 = characters are their skinned MESH at reflection hits (closest-hit walk of the mesh-shadow trees, reflect.wgsl; needs FLAG_MESH_SHADOWS up), 2 = the second reflection ray decorrelated (antithetic azimuth) + the hit's lighting reused from last frame's record when the hit point matches (rtHitReuse); w = the lowest light slot holding a TRANSIENT light this frame (lights.ts firstTransientSlot: they are born at the tail) — gather_common's per-hit subtraction walk starts there instead of at 0, testing each slot it visits as before (0 when none is alive)
  jitter: vec4f,                            // xy = this frame's TAAU sub-pixel jitter in internal pixels (0 without TAAU / under a debug view), zw = the previous render's — a screen-space history keyed on the UNJITTERED pixel (the gather's reservoirs) takes both out of its reprojection
  markCfg: vec4f,                           // MARKINGS (scene/markings.ts, shaders/markings.wgsl): x = the base texel in metres (0 = markings OFF: nothing evaluated anywhere, the frame as it was), y = contrast 0‥1 (palette colours lerped from the box albedo), z = × the emission of emissive markings, w = 1 = evaluate markings at reflection hits too
  sharpCfg: vec4f,                          // SHARP DIRECT (docs/internal/sharp-direct.md): xy = the internal size, zw = the OUTPUT size the g-buffer / unshadowed direct / composite / TAA run at this frame — z = 0 = off: every pass as it was. (frame.screen is whichever of the two the pass binding this block runs at: the engine keeps an internal-screen and an output-screen copy of the block)
  sharpCfgB: vec4f,                         // sharp direct's knobs: x = output-resolution EDGE RAYS on (1 — informational: the host dispatches the edge-ray pipeline; where the internal taps straddle a hard shadow edge, one deterministic ray from the output pixel to the class's strongest emitter decides that light) / off (0), y = the taps' visibility-ratio spread that flags such an edge, z = the blur-hint width (internal px) under which the edge counts as hard, w = the same-plane weight's k (plane distance ∕ (z·k))
  sharpCfgC: vec4f,                         // DECOUPLED JITTER under sharp direct: xy = the jitter the INTERNAL raster carries relative to the (unjittered) OUTPUT raster, internal px (gdown / sharp_direct / composite / taau / particles add it to every internal ↔ output texel map); 0 = one jitter for both rasters, the path as it was
  rigCfg: vec4f,                            // SDF CHARACTER RIG (render/sdfrig.ts, shaders/sdfrig.wgsl): x = bits (2 = smooth-union closest hit in the reflection tracer, 4 = soft-shadow character visibility in the direct estimators, 8 = its analytic form, 16 = smooth union in the soft query, 32 = it for broad-class lights too, 64 = character self-shadow in the direct estimators' shadow rays (selfShadowT), 128 = mesh shadows for near receivers only (meshShadowT); bit 1 retired — the round-cone proxy test is unconditional) — 0 = the plain round-cone loops everywhere; y = soft march steps, z = × the lights' angular radius, w = the smallest tan(half-angle) a light is given
  rigCfgB: vec4f,                           // x = × the per-joint smooth-union radii (0 = plain union), y = closest-hit sphere-trace steps, z = its surface epsilon (m), w = the soft query's smallest march step (m)
  giCfg: vec4f,                             // GI-in-motion (docs/internal/gi-motion.md, fgather.wgsl `main`): x = ray multiplier for YOUNG-history gather texels (≤ 1 = off: the gather as it was), y = how many texels a frame may take it (the rest first-come), z = the diffuse history length (frames) under which a texel is young, w spare
  weatherE: vec4f,                          // PARTICLE RAIN (experiment, game/rainFx.ts + shaders/particles*.wgsl): xy = centre xz of the near-field particle layer's disc, z = its radius (m), w = the share 0‥1 of the LATTICE rain volumetrics.wgsl drops inside it (rainNearKeep) — 0 = no particle layer: the lattice exactly as it was (NEGATIVE on a snow level: the metres past the level's rim the snow goes on falling, particles_common.wgsl snowPast — every lattice reader asks `> 0.0`)
  weatherF: vec4f,                          // PARTICLE RAIN v2: the drop's PHASE the lattice's streaks share with the particles' (volumetrics.wgsl rainLight): x = isotropic floor, y = forward-lobe weight, z = its Henyey-Greenstein g, w = × gain — w 0 = the lattice's isotropic sum exactly as it was
};

const FLAG_DIRECT: u32 = 1u;
const FLAG_INDIRECT: u32 = 2u;
const FLAG_VOLUMETRICS: u32 = 4u;
const FLAG_SMOKE: u32 = 8u;
const FLAG_RC_VISWEIGHT: u32 = 16u;
const FLAG_SMOKE_SHADOWS: u32 = 64u;
const FLAG_REACH_MASK: u32 = 32u;  // per-light reach masks over the level's 1 m cells (reach.ts): a light whose mask excludes the shading point's cell is skipped as if evalLight were !ok
const FLAG_BOUNCE: u32 = 128u;
const FLAG_DITHER: u32 = 256u;
const FLAG_SOFTSHADOW: u32 = 512u;
const FLAG_NIGHTVISION: u32 = 1024u;
const FLAG_TEMPORAL: u32 = 2048u;
const FLAG_TILECULL: u32 = 4096u;    // direct pass: per-8x8-tile light list (lights provably zero across the tile's bounds are not scored per pixel) — lossless; off = walk every light, for A/B
const FLAG_SOFT_TILESKIP: u32 = 8192u; // penumbra filter: whole 8x8 tiles provably out of reach of every blur hint skip the pass (softtile.wgsl builds the mask) — lossless; off = every pixel decides for itself, for A/B
const FLAG_TAIL_CHROMA: u32 = 16384u; // experiment: per-channel-unbiased tail (E_pick·V/p) instead of the bounded luminance-unbiased form
const FLAG_CHECKER_DIRECT: u32 = 65536u; // lossy option: shadow rays on a checkerboard half of the pixels per frame, the other half borrows its neighbours' visibility (direct.wgsl)
const FLAG_GRID_SKIP: u32 = 131072u;  // trace grid: run past provably empty cells without touching memory (per-cell Chebyshev distance to the nearest occupied cell) — lossless; off = a load pair per cell as before, for A/B
const FLAG_GRID_YCULL: u32 = 262144u; // trace grid: skip cells / boxes (and globals) whose height band the rest of the ray cannot reach (per-cell 24-slice occupancy, per-item quantised y extent, per-global extent) — lossless; off = every registered box is slab-tested, for A/B
const FLAG_AXIS_BOX: u32 = 524288u;   // slab test: unrotated boxes (rot packed as exactly cos 1, sin 0) skip the rotation and reuse the ray's inverse direction — lossless (see isectBox); off = always rotate + divide, for A/B
const FLAG_GRID_SLABS: u32 = 1048576u; // trace grid: a global is skipped unless the ray SEGMENT's bounds touch its own 5 mm-proud bounds on all three axes (not just a 4 cm height band), and a cell's height span is judged scene.grid.y tighter at both ends — lossless (see traceClosest); off = the height cull exactly as before, for A/B
const FLAG_GLOSS: u32 = 2097152u;      // experiment (default off): floor pixels whose box carries BOX_GLOSS get one traced, Fresnel-weighted reflection ray in the final gather (fgather.wgsl → its own half-res texture → temporal + one à-trous pass → added after the diffuse terms in composite); off = nothing stored, filtered or read
const FLAG_DECALS: u32 = 4194304u;      // experiment E1 (default on in its branch): the g-buffer's fragment stage applies render/decals.ts's marks (decals.wgsl) to the stored albedo / normal / gloss-keep; off = nothing read
const FLAG_MESH_SHADOWS: u32 = 8388608u; // ultra: occluded() / occludedT() test characters against their skinned triangle mesh (meshShadowT below: per-character refit BVH in meshData, render/meshShadows.ts) instead of the round-cone proxies; off = the proxy loops (occludedCapsules / traceCapsules)
const FLAG_PARTICLES: u32 = 16777216u;   // experiment: the GPU particle system is live this frame (render/particles.ts + shaders/particles*.wgsl: its own compute pass and a splat into the HDR target after the composite) — informational for the scene passes, none of which reads it
const FLAG_BOUNCE_CARDS: u32 = 33554432u; // torch bounce cards (default off): the final gather samples each carried spot's footprint as an analytic one-bounce emitter (cards.wgsl builds them, fgather.wgsl samples them and excludes the light's direct term where its rays land inside a footprint); off = nothing built, sampled or excluded
const FLAG_DIRECT_SEED_HOLD: u32 = 67108864u; // direct pass A/B knob (default off): with direct-light history on, the per-pixel sampling pattern advances every other frame instead of every frame
const FLAG_GI_ADAPTIVE_HIST: u32 = 134217728u;
const FLAG_RESTIR: u32 = 1073741824u;   // ReSTIR DI drew the direct light this frame (restir.wgsl); softblur opens its ratio clamp for its per-light hues
const FLAG_GLASS: u32 = 268435456u;    // glass panes (E3, SceneInfo.glass) — composite tints / reflects over what stands behind them and draws the crack decals on them, fgather traces their mirror ray, direct tints light through them; off = scene.glassInfo.x is 0 and nobody loops
const FLAG_FROXEL_VOL: u32 = 536870912u;   // froxel volumetrics (renderer v3 Phase 2b, render/froxels.ts + shaders/froxel.wgsl): haze + smoke in-scatter injected into a camera-frustum voxel grid (frame.froxelA/B/C), accumulated over frames, integrated front to back — composite / the particles read ONE trilinear sample at the pixel's distance and volumetrics.wgsl only draws the rain; off = the per-pixel march exactly as it was

struct BoxGeo { c: vec3f, rot: u32, h: vec3f, flags: u32 };
const BOX_NOPRIMARY: u32 = 1u;
const BOX_NOSHADOW: u32 = 2u;
const BOX_CUTAWAY: u32 = 4u;
const BOX_EMISSIVE: u32 = 16u;
const BOX_AREALIT: u32 = 32u;     // emission carried by an analytic area light instead (see Light kind 3)
const BOX_ROT: u32 = 64u;         // fully rotated box: orientation is the quaternion boxRot(i), not the packed yaw (hand props, sparks, tumbling canisters)
const BOX_GLOSS: u32 = 128u;      // polished floor finish: its on-screen top face gets a traced reflection ray under FLAG_GLOSS (boxes.ts BoxFlag.Gloss)
const GEO_ROUND: u32 = 8u;        // ROUND THINGS (scene/round.ts; only ever raised in a build compiled with ROUND_BOXES): the box is the cylinder about its own y, radius h.x (boxes.ts BOX_ROUND_BIT — the CPU's Dynamic bit, which is not sent then)
const GEO_CUT: u32 = 65536u;      // CUT BOXES (scene/cut.ts; only ever raised in a build compiled with CUT_BOXES): the box is clipped by the planes in its rows of the cut table (boxMat from CUT_BASE)
const BOX_GLASS: u32 = 131072u;   // a glass pane (boxes.ts BoxFlag.Glass, bit 17 — the flag word widened past its byte): never in the trace grid nor the raster; here only so a debug view can tell one
const MAX_GLASS: u32 = 32u;       // panes SceneInfo.glass can hold (boxes.ts MAX_GLASS)

struct SceneInfo { numBoxes: u32, numGlobals: u32, gridW: u32, gridH: u32, globals: array<vec4u, 4>, numCapsules: u32, numChars: u32, capsPerChar: u32, itemsB: u32, charBounds: array<vec4f, 8>, globalsY: array<vec4f, 8>, grid: vec4f, globalsB: array<vec4f, 32>, glassInfo: vec4u, glass: array<vec4f, 96> };   // glassInfo.x: pane count (0 = glass off); glass[3k..3k+2]: pane k = (centre.xyz, cos yaw), (half.xyz, sin yaw), (tint rgb, box index) — boxes.ts packGlass · itemsB: offset of the packed item copies in gridItems (= item count); globalsY: padded (ymin, ymax) of global 2i in .xy, of global 2i+1 in .zw; grid.x: registration slack in metres (how far a traced box can reach outside the cells it is registered in — boxes.ts buildGrid), grid.y: FLAG_GRID_SLABS' height-span shrink per end (m); globalsB[2g] / [2g+1]: min / max corner of global g's world bounds, 5 mm + slack proud of the traced box (FLAG_GRID_SLABS)
// Character shadow / reflection proxies: ROUND CONES (segment a→b, radius r at a; the radius at b rides in misc's top byte — sdfrig.wgsl coneRb; 0 there = r again, an
// untapered cone). `misc` packs owner (low 8 bits), rgb565 albedo (bits 8..23), r_b in millimetres (bits 24..31). The record keeps its old name: boxes.ts writes it.
struct Capsule { a: vec3f, r: f32, b: vec3f, misc: u32 };

struct Light {
  pos: vec3f, kind: u32,          // 0 point, 1 spot, 2 directional, 3 area (one-sided Lambertian disk: normal = dir, radius = disk radius, color = radiance × area)
  dir: vec3f, range: f32,
  color: vec3f, cosOuter: f32,
  cosInner: f32, volumetric: f32, owner: u32, radius: f32,
};

struct SmokeBound {                // a loose box round some of the smoke (smoke.wgsl `boxes`): what a reader clips a ray against before it marches (the marches' and the froxels' comments call one a 'domain', from when it was a solver box). Never storage, never a limit on the smoke
  origin: vec3f, voxel: f32,       // world min corner, voxel size (m) of the lattice it bounds
  pad0: vec3u, live: u32,
  dims: vec3u, pad1: u32,          // its size in voxels
  pad2: f32, readSkip: f32, pad3: f32, pad4: f32,   // (record 0's readSkip: the solver's knob of that name, smoke_read.wgsl spgSkip)
};

@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<storage, read> boxGeo: array<BoxGeo>;
@group(0) @binding(2) var<storage, read> boxMat: array<vec4f>;
@group(0) @binding(3) var<storage, read> gridCells: array<u32>;   // [0, W*H]: per-cell start offsets into gridItems (cell ci owns [start(ci), start(ci+1))); from GRID_CB on: 2 words per cell for the fast traversal (see gridCell below)
@group(0) @binding(4) var<storage, read> gridItems: array<u32>;   // [0, itemsB): box indices per cell in box order; [itemsB, 2·itemsB): the same items packed index16 | qmin8<<16 | qmax8<<24 (quantised padded height extent)
@group(0) @binding(5) var<uniform> scene: SceneInfo;
@group(0) @binding(6) var<storage, read> lights: array<Light>;   // (tried a uniform array: slower for the cascades' hit shading on Apple GPUs)
@group(0) @binding(7) var<uniform> smoke: array<SmokeBound, 8>;   // 0‥3 the coarse lattice's, 4‥7 the fine one's
@group(0) @binding(8) var smokeAtlas: texture_3d<f32>;   // rgba16f, one 10³-texel block per live brick (smoke_read.wgsl; binding 14, the page texture, is declared there; binding 11 is free)
@group(0) @binding(9) var linSamp: sampler;
@group(0) @binding(10) var<storage, read> capsules: array<Capsule>;
struct FogSightT {            // THE FOG OF WAR'S SIGHT TABLE (render/fogofwar.ts FogSight; asked only for a light that carries a fog bit, the picture's smoke and its particles — fogSeenAt below)
  dist: array<vec4f, 3584>,   // [eye × FOG_SIGHT_BINS + bin], four to a vec4: how far that eye's level ray along the bin's bearing goes before a box (the head-of-frame pass, shaders/fogsight.wgsl)
  eyes: array<vec4f, 7>,      // FowU's head (shaders/fogofwar.wgsl), field for field: the eye and its man, …
  looks: array<vec4f, 7>,     // … where he looks, his cone and near field
  cfg: vec4f,                 // x = eyes, y = 1 while this frame's table is written (0: no table — every spot answers 'seen'), z = topPad (m), w = the fog's soft edge: its band (m; 0 = the hard line — shaders/fogofwar.wgsl fowEdge, the fog pass alone reads it)
  soft: vec4f,                // xyz = the cone's soft edges, as FowU.soft · w = one whole number, three bits (4 = FOG.kept, fogKeptOn below): 1 = smoke and dust are drawn under the fog too (fogSmokeOn below; 0 = cut there, as it was), 2 = thin things that stand free do not stop a fog eye (fogThinOn)
  thin: array<vec4u, 32>,     // WHICH statics are thin and free (game/fogofwar.ts FOG.thin; scene/thin.ts): a bit a box index, 4096 boxes (fogThinBox below). In the buffer the sight table's own pass reads here too (the stand-in: render/fogofwar.ts FogSight.stand)
};
@group(0) @binding(11) var<uniform> fogSight: FogSightT;   // (a UNIFORM, 58 KB: the fragment stage's sampled textures are all spoken for — passes.ts lComp)
// binding 12 — the per-light reach rows (render/reach.ts, lights.ts reachBuf) — is declared by the scene prelude (frame.ts scenePrelude) as either a read-only
// storage array<u32> (the default: measured cheaper) or a uniform array<vec4u, REACH_VEC4S> (adapters with only 8 storage buffers per stage, or ?reachUniform
// for A/B), each with a reachWord(w) accessor over the flat word index

fn boxAlbedo(i: u32) -> vec3f { return boxMat[i * 4u].xyz; }
fn boxCutHeight(i: u32) -> f32 { return boxMat[i * 4u].w; }
fn boxEmissive(i: u32) -> vec3f { return boxMat[i * 4u + 1u].xyz * frame.emissiveScale; }
/** the albedo SECONDARY rays see (gather / cascade / probe / card hits): the box's albedo with its markings' area average folded in on the CPU (boxes.ts upload) — the very same three floats as boxAlbedo for a box without markings, or with markings off */
fn boxAlbedoSec(i: u32) -> vec3f { return boxMat[i * 4u + 3u].xyz; }
/** × the emission of the box's emissive markings (a switchable's supply factor: game/lighting.ts) */
fn boxMarkGain(i: u32) -> f32 { return boxMat[i * 4u + 3u].w; }
/** vec4 row where the MARKING table starts in boxMat (its tail: boxes.ts MAT_STRIDE × maxBoxes ÷ 4) — record r's k-th row is boxMat[MARK_BASE + r * 6 + k] (markings.wgsl) */
const MARK_BASE: u32 = MAX_BOXES * 4u;
/** raster orientation of box i as a unit quaternion (equals its yaw for ordinary boxes; raster-only props may tilt) */
fn boxRot(i: u32) -> vec4f { return boxMat[i * 4u + 2u]; }
fn quatRotate(q: vec4f, v: vec3f) -> vec3f { let t = 2.0 * cross(q.xyz, v); return v + q.w * t + cross(q.xyz, t); }
fn boxOwner(b: BoxGeo) -> u32 { return (b.flags >> 8u) & 0xffu; }
/** The surface finish of box i (boxes.ts matWord in boxMat row 1's w: roughness 0‥1 + 2 if bare metal + 4 if anisotropic — three disjoint ranges of one
 *  float): the material half of the one BRDF (base colour = boxAlbedo). The g-buffer writes roughness / metalness per pixel from it (+ its detail layer);
 *  the reflection pass reads the anisotropy. A box nobody gave a finish reads rough 1 (matte: no reflection ray, no analytic highlight). */
struct Finish { rough: f32, metal: bool, aniso: bool };
fn boxFinish(i: u32) -> Finish {
  var w = boxMat[i * 4u + 1u].w; var f: Finish;
  f.aniso = w >= 4.0; w -= select(0.0, 4.0, f.aniso);
  f.metal = w >= 2.0; w -= select(0.0, 2.0, f.metal);
  f.rough = clamp(w, 0.0, 1.0);
  return f;
}

fn skyRadiance(rd: vec3f) -> vec3f {
  let t = clamp(rd.y * 2.5, 0.0, 1.0);
  let below = clamp(-rd.y * 8.0, 0.0, 1.0);
  return mix(mix(frame.skyHorizon, frame.skyZenith, t), frame.skyHorizon * 0.15, below);
}

// ---- WEATHER KINDS (game/weatherKinds.ts, game/weather.ts): the level's third / fourth roof footprint and the FOG in the outdoor air, packed in the three spare words
// of frame.cardCfg (.y .z .w; all 0 = no kind picked; .y is never 0 under a kind — 1 = an empty footprint). Every caller sits behind the scene prelude's
// `const WX_KINDS` (render/frame.ts weatherKindConfig: true only in a page opened with ?weather=<kind>), so without it these are dead code and the modules are as they were. The fog is ONE field for the picture and for the
// men's eyes: extinction σ0·e^(−y∕H) per metre in the open (H 0 = uniform), × leak under a roof — weatherKinds.ts unpackFog / fogTau are these functions on the CPU.
fn wxRect(w: u32) -> vec4f { return vec4f(f32(w & 255u), f32((w >> 8u) & 255u), f32((w >> 16u) & 255u), f32(w >> 24u)) * 0.2; }
fn wxInRect(R: vec4f, p: vec2f) -> bool { return p.x >= R.x && p.y >= R.y && p.x <= R.z && p.y <= R.w; }
/** is ground point p (xz) under one of the roofs the weather is cut by — weatherC, weatherD and (the level's own roofs in force: a kind picked, or its own storm) the two packed ones */
fn wxRoofed(p: vec2f) -> bool {
  var r = wxInRect(frame.weatherC, p) || wxInRect(frame.weatherD, p);
  if (!r && frame.cardCfg.y != 0u) { r = wxInRect(wxRect(frame.cardCfg.y), p); }
  if (!r && frame.cardCfg.z != 0u) { r = wxInRect(wxRect(frame.cardCfg.z), p); }
  return r;
}
/** RAIN OVER A WALL'S FACE (the scene prelude's RAIN_WALLS; the maintainer, 10-19, a depot's yard in the rain: "rain isn't showing up on top of walls properly").
 *  The rain's readability rule hides it from every pixel whose SURFACE is not outdoors, and asked that of the roofs' bare rectangles — a level's own roof is its
 *  ceiling slab grown by centimetres, over the walls — so the walls' OUTER FACES, the doors in them and the walls' tops counted as indoors: the streaks fell over
 *  the yard and stopped dead at the wall behind it. Is ground point p UNDER the roofs: WX_WALL_IN or more inside them on every side — the four corners of a square
 *  that wide about it are all roofed (so the seam where two slabs of one building meet is under the roof, as either slab is). Asked of the level's OWN roofs only:
 *  the office's two rectangles (no kind in force) lie on its walls' centre lines, its outer faces were never hidden, and drawn in they would let the rain into the
 *  rooms' edges. volumetrics.wgsl (c) and particles_draw.wgsl rainFragment ask it. The rooms stay dry to the eye as before; a partition's top inside is under the
 *  roof (the snow's own rule is particles_common.wgsl flakeHidden: under the prelude's SNOW_UNDER it asks the roofs as one too, and opens a top only near their edge). */
const WX_WALL_IN: f32 = 0.2;   // m
fn wxUnderRoof(p: vec2f) -> bool {
  if (!wxRoofed(p)) { return false; }
  if (!WX_KINDS) { return true; }
  if (frame.cardCfg.y == 0u) { return true; }
  let d = WX_WALL_IN;
  return wxRoofed(p + vec2f(d, d)) && wxRoofed(p + vec2f(-d, d)) && wxRoofed(p + vec2f(d, -d)) && wxRoofed(p - vec2f(d, d));
}
struct WxFog { sigma: f32, H: f32, leak: f32, gain: f32, tint: vec3f };
fn wxFog() -> WxFog {
  let w = frame.cardCfg.w;
  return WxFog(f32(w & 255u) * 0.001, f32((w >> 8u) & 31u) * 0.5, f32((w >> 13u) & 7u) / 7.0, f32(w >> 28u) * 0.25, vec3f(f32((w >> 16u) & 15u), f32((w >> 20u) & 15u), f32((w >> 24u) & 15u)) / 15.0);
}
/** optical depth of the fog along ro + rd·[0, L] (rd unit), before any roof */
fn wxFogTau(F: WxFog, ro: vec3f, rd: vec3f, L: f32) -> f32 {
  if (L <= 0.0) { return 0.0; }
  if (F.H <= 0.0) { return F.sigma * L; }
  let ya = max(ro.y, 0.0) / F.H; let k = (max(ro.y + rd.y * L, 0.0) - max(ro.y, 0.0)) / F.H;
  var m = 1.0 - 0.5 * k; if (abs(k) >= 1e-3) { m = (1.0 - exp(-k)) / k; }
  return F.sigma * exp(-ya) * L * m;
}
/** how much thicker the haze the lamps and torches light stands at X in that fog (vol_common.wgsl hazeAt): the fog's own scatterers on top of the thin
 *  haze's, (hazeDensity + σ(X)) ∕ hazeDensity, held to 6× — exactly 1 with no fog */
fn wxHazeK(X: vec3f) -> f32 {
  if (frame.cardCfg.w == 0u) { return 1.0; }
  if (WX_VOL) { return min(1.0 + wxAir(X).x / max(frame.hazeDensity, 1e-3), 6.0); }   // (the air as a volume: the one field below — a room's own share, nothing above a roof)
  let F = wxFog(); var sg = F.sigma; if (F.H > 0.0) { sg *= exp(-max(X.y, 0.0) / F.H); }
  if (wxRoofed(X.xz)) { sg *= F.leak; }
  return min(1.0 + sg / max(frame.hazeDensity, 1e-3), 6.0);
}
fn wxHash(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
/** the fog's BANKS: a slow drifting unevenness over the ground, mean 1 (the picture only — the men's eyes take the mean) */
fn wxBank(p: vec2f) -> f32 {
  let q = p * 0.11 + vec2f(frame.time * 0.03, frame.time * 0.012); let i = floor(q); let f = fract(q); let u = f * f * (3.0 - 2.0 * f);
  let a = mix(mix(wxHash(i), wxHash(i + vec2f(1.0, 0.0)), u.x), mix(wxHash(i + vec2f(0.0, 1.0)), wxHash(i + vec2f(1.0, 1.0)), u.x), u.y);
  return 0.72 + 0.56 * a;
}
/** the fog over a pixel: `color` seen from the camera along unit rd to distance L (sky: to the ground plane, or 200 m) → color·T + A·(1 − T), A = the horizon's
 *  light in the fog's tint (+ a stroke's lit sky). Call only with frame.cardCfg.w != 0. */
fn wxFogApply(color: vec3f, rd: vec3f, dist: f32, sky: bool) -> vec3f {
  let F = wxFog(); var L = dist;
  if (sky) { L = 200.0; if (rd.y < 0.0) { L = min(200.0, frame.camPos.y / max(-rd.y, 1e-4)); } }
  var tau = wxFogTau(F, frame.camPos, rd, L);
  let E = frame.camPos + rd * L;
  let roofed = !sky && wxRoofed(E.xz);
  if (roofed) { tau *= F.leak; }
  let T = exp(-tau * wxBank(E.xz));
  // (the glow is the SKY's light in the fog: what has leaked in under a roof dims the room as it dims it for the men's eyes, and glows with nothing — a dark room
  // stays dark, where the horizon's colour over it lifted it to navy and showed whoever stood in it)
  let A = select(frame.skyHorizon * F.tint * F.gain + frame.weatherB.xyz * 0.5, vec3f(0.0), roofed);
  return color * T + A * (1.0 - T);
}
// ---- THE VEIL AT THE BUILDING'S SHELL (const WX_EDGE, render/frame.ts weatherEdgeConfig; false = wxFogApply above for every pixel, the picture as it was). wxFogApply asks
// 'roofed?' of the ground point under the pixel's SURFACE, and a roof's footprint is its slab + ROOF_PAD (the packed third / fourth: + up to 0.2 m more) — so the OUTSIDE
// face of an outside wall, which stands a few centimetres inside that rectangle, was classed as indoors: no veil, no glow, while a man standing at it — outside the
// rectangle — took the whole of both. From the play camera he showed as a flat shape in the fog's colour laid over a wall the fog had not touched. An outside wall's
// face is IN the outdoor air: it is asked where its own normal points (wxFogApplySurf), and the roof's edge is a ramp, not a line — from the wall's outer face to about
// its inner one, so the wall's cut top, a window's reveal and a doorway's threshold grade across the wall's own thickness and the ground at its foot is in the open
// to the last centimetre. The picture only — the men's eyes (weather.ts airTrans) take the footprints as they are.
const WX_EDGE_W: f32 = 0.5;      // the box the footprints are averaged over (m)
const WX_EDGE_IN: f32 = 0.04;    // where the ramp starts, inside the footprint's edge (m): an outside wall's outer face (slab + ROOF_PAD − the wall's 2 cm past its slab); it ends WX_EDGE_W ∕ 2 inside
const WX_EDGE_OUT: f32 = 0.4;    // how far along its own normal a face is asked again (m): clear of ROOF_PAD + the packed roofs' 0.2 m
fn wxRoofCover1(R: vec4f, p: vec2f, h: f32) -> f32 { let o = max(min(p + h, R.zw) - max(p - h, R.xy), vec2f(0.0)); return o.x * o.y; }
/** how far under the roofs wxRoofed asks ground point p (xz) is: 0 in the open and up to WX_EDGE_IN inside a footprint's edge, 1 from WX_EDGE_W ∕ 2 inside it, a ramp
 *  between (the share of the WX_EDGE_W box round p the footprints cover — two that meet or overlap count once — taken from its value at the ramp's start) */
fn wxRoofCover(p: vec2f) -> f32 {
  let h = 0.5 * WX_EDGE_W;
  var a = wxRoofCover1(frame.weatherC, p, h) + wxRoofCover1(frame.weatherD, p, h);
  if (frame.cardCfg.y != 0u) { a += wxRoofCover1(wxRect(frame.cardCfg.y), p, h); }
  if (frame.cardCfg.z != 0u) { a += wxRoofCover1(wxRect(frame.cardCfg.z), p, h); }
  let c0 = 0.5 + WX_EDGE_IN / WX_EDGE_W;
  return clamp((min(a / (WX_EDGE_W * WX_EDGE_W), 1.0) - c0) / (1.0 - c0), 0.0, 1.0);
}
/** wxFogApply for a SURFACE pixel under WX_EDGE: `nxz` = the horizontal part of the face's normal (0 0 for a man and what he carries: he is where he stands). Under a
 *  roof by r — the lesser of the point's own cover and the cover where the face looks — the veil is thinned toward the leak and its glow put out by exactly r; r 0 / 1
 *  are wxFogApply's two cases. */
fn wxFogApplySurf(color: vec3f, rd: vec3f, dist: f32, nxz: vec2f) -> vec3f {
  let F = wxFog();
  let E = frame.camPos + rd * dist;
  var r = wxRoofCover(E.xz);
  if (r > 0.0) { r = min(r, wxRoofCover(E.xz + nxz * WX_EDGE_OUT)); }
  let T = exp(-wxFogTau(F, frame.camPos, rd, dist) * mix(1.0, F.leak, r) * wxBank(E.xz));
  let A = (frame.skyHorizon * F.tint * F.gain + frame.weatherB.xyz * 0.5) * (1.0 - r);
  return color * T + A * (1.0 - T);
}

// ---- THE WEATHER'S AIR AS A VOLUME (const WX_VOL, render/frame.ts weatherVolConfig; false = the veil above, the picture as it was). The fog / dust is a MEDIUM with
// an extinction at every point, and the volumetric pass marches it (volumetrics.wgsl wxAirMarch): a pixel is veiled by what its own ray crosses, the sun and the
// moon light it through shadow rays, the sky and the bounce light it through the radiance cache, the lamps' cones stand in it (wxHazeK above takes the same field).
//   in the open     σ0·e^(−y∕H), eased to nothing between the ceiling plane and WX_TOP above it — the picture is a building with its roof lifted off, and the
//                   air over the roof went with it; the open air's layer ends a little higher so the yard's lamps still stand in it
//   under a roof    below the ceiling plane: σ0·e^(−y∕H) × the room's SHARE at that spot of the plan — the air grid (scene/airGrid.ts; game/airDust.ts carries
//                   the dust in at open doors and blown walls, a shut room keeps the weather's `leak`); nothing at or above the ceiling plane
// The men's eyes are cut by the same grid (game/weather.ts airTrans). The roofs are the four footprints wxRoofed asks.
const WX_TOP: f32 = 3.0;   // how far above the ceiling plane the open air's layer runs out (m)
/** the roof footprint ground point p (xz) stands under — wxRoofed's own four, the first that holds it — or an empty one (z < x) in the open */
fn wxRoofAt(p: vec2f) -> vec4f {
  if (wxInRect(frame.weatherC, p)) { return frame.weatherC; }
  if (wxInRect(frame.weatherD, p)) { return frame.weatherD; }
  if (frame.cardCfg.y != 0u) { let R = wxRect(frame.cardCfg.y); if (wxInRect(R, p)) { return R; } }
  if (frame.cardCfg.z != 0u) { let R = wxRect(frame.cardCfg.z); if (wxInRect(R, p)) { return R; } }
  return vec4f(0.0, 0.0, -1.0, -1.0);
}
fn wxGrid(c: vec2i) -> f32 { let k = u32(clamp(c.y, 0, WXD_H - 1) * WXD_W + clamp(c.x, 0, WXD_W - 1)); return boxMat[WXD_BASE + (k >> 2u)][k & 3u]; }
/** the room's share of the weather's air at p (xz) under footprint R: the air grid, bilinear between the cells whose CENTRES the footprint holds (a cell is the
 *  room's when its centre is under the roof — game/airDust.ts sorts them the same way), so the open air's 1 never bleeds in through a wall */
fn wxIndoor(p: vec2f, R: vec4f) -> f32 {
  let lo = ceil((R.xy - WORLD_MIN.xz) / WXD_CELL - 0.5); let hi = max(lo, floor((R.zw - WORLD_MIN.xz) / WXD_CELL - 0.5));
  let g = clamp((p - WORLD_MIN.xz) / WXD_CELL - 0.5, lo, hi);
  let i = floor(g); let f = g - i; let c0 = vec2i(i); let c1 = min(c0 + vec2i(1), vec2i(hi));
  return mix(mix(wxGrid(c0), wxGrid(vec2i(c1.x, c0.y)), f.x), mix(wxGrid(vec2i(c0.x, c1.y)), wxGrid(c1), f.x), f.y);
}
/** the weather's air at X: (extinction per metre, 1 under a roof ∕ 0 in the open). Call only with frame.cardCfg.w != 0. */
fn wxAir(X: vec3f) -> vec2f {
  let F = wxFog(); var sg = F.sigma; if (F.H > 0.0) { sg *= exp(-max(X.y, 0.0) / F.H); }
  let R = wxRoofAt(X.xz);
  if (R.z > R.x) { if (X.y >= CEIL_Y) { return vec2f(0.0, 1.0); } return vec2f(sg * wxIndoor(X.xz, R), 1.0); }
  return vec2f(sg * (1.0 - smoothstep(CEIL_Y, CEIL_Y + WX_TOP, X.y)), 0.0);
}

// Ray vs axis-aligned bounds → (tEnter, tExit)
fn isectBounds(ro: vec3f, invRd: vec3f, bmin: vec3f, bmax: vec3f) -> vec2f {
  let t0 = (bmin - ro) * invRd; let t1 = (bmax - ro) * invRd;
  let tmn = min(t0, t1); let tmx = max(t0, t1);
  return vec2f(max(max(tmn.x, tmn.y), tmn.z), min(min(tmx.x, tmx.y), tmx.z));
}

fn safeInv(v: vec3f) -> vec3f {
  return vec3f(select(1.0 / v.x, 1e20, abs(v.x) < 1e-20), select(1.0 / v.y, 1e20, abs(v.y) < 1e-20), select(1.0 / v.z, 1e20, abs(v.z) < 1e-20));
}

// Ray vs yawed (or, with BOX_ROT, fully rotated) box `bi`. Returns vec2(t, code). t < 0 → miss. code: axis*2 + (1 if local normal negative), 7 = origin inside.
// invRd = safeInv(rd) from the caller; axisFast (FLAG_AXIS_BOX): a box with yaw 0 packs rot as exactly (1.0, 0.0) = 0x3C00, and for those the
// local frame IS the world frame — 1·x − 0·z evaluates to x exactly whatever the contraction, so lo = p, ld = rd and inv = invRd bit for bit —
// which skips two half unpacks, both rotations and the three divisions for two thirds of all items and every global. Lossless; off = always rotate.
const ROT_IDENTITY: u32 = 0x3C00u;
// ---- CUT BOXES (scene/cut.ts; called only inside `if (CUT_BOXES)` blocks — the scene prelude's const, false = this is dead code and the module is as it was): a box
// flagged GEO_CUT keeps only the side n_k · p ≤ d_k of each plane in its CUT_ROWS rows of the cut table (box-local frame; a zero normal ends the record). The solid
// is convex, so the ray's stay inside it is still ONE interval: the slab interval [tN, tF] cut down plane by plane — a plane the ray crosses INTO the kept side may
// raise tN (and is then the face it enters by), one it crosses OUT of lowers tF. Codes: a box face keeps isectBox's 0‥5, 7 = origin inside the cut solid, and cut
// plane k answers −1 − k (negative: every caller's `code > 6.5` inside test and its t tests read it as an ordinary face; boxNormalFromCode decodes it).
// cut.ts cutClip is this loop on the CPU (rayBox, lineBox).
fn cutPlaneRow(bi: u32, k: u32) -> vec4f { return boxMat[CUT_BASE + bi * CUT_STRIDE + k]; }
/** the row after a box's planes: (the colour its cut faces show, 1), or all zero = they show the box's own (Box.cutCore) */
fn cutCoreRow(bi: u32) -> vec4f { return boxMat[CUT_BASE + bi * CUT_STRIDE + CUT_ROWS]; }
fn isectCut(lo: vec3f, ld: vec3f, tmn: vec3f, tN0: f32, tF0: f32, tmax: f32, bi: u32) -> vec2f {
  var tN = tN0; var tF = tF0; var code = 7.0;
  for (var k = 0u; k < CUT_ROWS; k++) {
    let pl = cutPlaneRow(bi, k);
    if (all(pl.xyz == vec3f(0.0))) { break; }
    let den = dot(pl.xyz, ld); let num = pl.w - dot(pl.xyz, lo);
    if (den < 0.0) { let t = num / den; if (t > tN) { tN = t; code = -1.0 - f32(k); } }
    else if (den > 0.0) { tF = min(tF, num / den); }
    else if (num < 0.0) { return vec2f(-1.0, 0.0); }
  }
  if (tN > tF || tF < 0.0 || tN > tmax) { return vec2f(-1.0, 0.0); }
  if (tN < 0.0) { return vec2f(0.0, 7.0); }
  if (code < 0.0) { return vec2f(tN, code); }
  code = 4.0 + select(0.0, 1.0, ld.z > 0.0);
  if (tN == tmn.x) { code = select(0.0, 1.0, ld.x > 0.0); }
  else if (tN == tmn.y) { code = 2.0 + select(0.0, 1.0, ld.y > 0.0); }
  return vec2f(tN, code);
}
// ---- ROUND THINGS (scene/round.ts; called only inside `if (ROUND_BOXES)` blocks — the scene prelude's const, false = this is dead code and the module is as it was): a
// box flagged GEO_ROUND is the cylinder about its own y, radius h.x (= h.z), between its two y faces. The ray's stay inside is ONE interval: its stay between the
// ends (the y slab) cut down to its stay inside the circle. The circle's quadratic is solved from where the ray enters the box round it (tBox), so a ray from far
// off loses no bits to the distance. Codes: an end keeps isectBox's 2 / 3, 7 = origin inside, and the SIDE answers ROUND_SIDE (negative, under the cut planes'
// −1‥−8: every caller's `code > 6.5` inside test and its t tests read it as an ordinary face). The side's normal needs the hit point: roundNormalAt, asked by the
// closest-hit walks after boxNormalFromCode. boxes.ts rayBoxRound is this on the CPU (rayBox, and collision.ts lineBox).
const ROUND_SIDE: f32 = -9.0;
fn isectRound(lo: vec3f, ld: vec3f, R: f32, tNy: f32, tFy: f32, tBox: f32, tmax: f32) -> vec2f {
  var tN = tNy; var tF = tFy; var code = 2.0 + select(0.0, 1.0, ld.y > 0.0);
  let p = lo.xz + ld.xz * tBox;
  let a = dot(ld.xz, ld.xz); let hb = dot(p, ld.xz); let c = dot(p, p) - R * R;
  if (a < 1e-12) { if (c > 0.0) { return vec2f(-1.0, 0.0); } }   // along the axis: inside the circle for every t, or never
  else {
    let disc = hb * hb - a * c; if (disc < 0.0) { return vec2f(-1.0, 0.0); }
    let s = sqrt(disc); let ta = tBox + (-hb - s) / a;
    if (ta >= tN) { tN = ta; code = ROUND_SIDE; }
    tF = min(tF, tBox + (-hb + s) / a);
  }
  if (tN > tF || tF < 0.0 || tN > tmax) { return vec2f(-1.0, 0.0); }
  if (tN < 0.0) { return vec2f(0.0, 7.0); }
  return vec2f(tN, code);
}
/** the normal of a round box's SIDE at world point wp on it: straight out from its axis (a yaw about that axis changes nothing; a tilted one goes through its own frame) */
fn roundNormalAt(b: BoxGeo, bi: u32, wp: vec3f) -> vec3f {
  let p = wp - b.c;
  if ((b.flags & BOX_ROT) != 0u) { let q = boxRot(bi); let l = quatRotate(vec4f(-q.xyz, q.w), p); return quatRotate(q, normalize(vec3f(l.x, 0.0, l.z) + vec3f(1e-9, 0.0, 0.0))); }
  return normalize(vec3f(p.x, 0.0, p.z) + vec3f(1e-9, 0.0, 0.0));
}
fn isectBox(ro: vec3f, rd: vec3f, b: BoxGeo, tmax: f32, bi: u32, invRd: vec3f, axisFast: bool) -> vec2f {
  let p = ro - b.c;
  var lo: vec3f; var ld: vec3f; var inv: vec3f;
  if ((b.flags & BOX_ROT) != 0u) { let qi = vec4f(-boxRot(bi).xyz, boxRot(bi).w); lo = quatRotate(qi, p); ld = quatRotate(qi, rd); inv = safeInv(ld); }   // rare: one extra fetch + two quaternion rotations
  else if (axisFast && b.rot == ROT_IDENTITY) { lo = p; ld = rd; inv = invRd; }
  else { let cs = unpack2x16float(b.rot); lo = vec3f(cs.x * p.x - cs.y * p.z, p.y, cs.y * p.x + cs.x * p.z); ld = vec3f(cs.x * rd.x - cs.y * rd.z, rd.y, cs.y * rd.x + cs.x * rd.z); inv = safeInv(ld); }
  let tA = (-b.h - lo) * inv; let tB = (b.h - lo) * inv;
  let tmn = min(tA, tB); let tmx = max(tA, tB);
  let tN = max(max(tmn.x, tmn.y), tmn.z);
  let tF = min(min(tmx.x, tmx.y), tmx.z);
  if (tN > tF || tF < 0.0 || tN > tmax) { return vec2f(-1.0, 0.0); }
  if (ROUND_BOXES) { if ((b.flags & GEO_ROUND) != 0u) { return isectRound(lo, ld, b.h.x, tmn.y, tmx.y, tN, tmax); } }   // ROUND THINGS: the cylinder inside the box (above); dead code without the switch
  if (CUT_BOXES) { if ((b.flags & GEO_CUT) != 0u) { return isectCut(lo, ld, tmn, tN, tF, tmax, bi); } }   // CUT BOXES: the slab interval cut down by the box's planes (below); dead code without the switch
  if (tN < 0.0) { return vec2f(0.0, 7.0); }
  var code = 4.0 + select(0.0, 1.0, ld.z > 0.0);
  if (tN == tmn.x) { code = select(0.0, 1.0, ld.x > 0.0); }
  else if (tN == tmn.y) { code = 2.0 + select(0.0, 1.0, ld.y > 0.0); }
  return vec2f(tN, code);
}

fn boxNormalFromCode(b: BoxGeo, code: f32, bi: u32) -> vec3f {
  if (CUT_BOXES) { if (code < 0.0 && code > ROUND_SIDE + 0.5) { return quatRotate(boxRot(bi), cutPlaneRow(bi, u32(-code - 0.5)).xyz); } }   // CUT BOXES: a cut face — plane k's own normal, out of the box's frame (boxRot = the yaw for an ordinary box)
  let c = u32(code);
  let sgn = select(1.0, -1.0, (c & 1u) == 1u);
  let axis = c >> 1u;
  if ((b.flags & BOX_ROT) != 0u) { var ln = vec3f(0.0); ln[axis] = sgn; return quatRotate(boxRot(bi), ln); }
  let cs = unpack2x16float(b.rot);
  if (axis == 0u) { return vec3f(cs.x, 0.0, -cs.y) * sgn; }   // local +x → world (cos,0,-sin)
  if (axis == 1u) { return vec3f(0.0, sgn, 0.0); }
  if (axis == 2u) { return vec3f(cs.y, 0.0, cs.x) * sgn; }    // local +z → world (sin,0,cos)
  return vec3f(0.0, 1.0, 0.0);
}

struct Hit { t: f32, idx: i32, n: vec3f, inside: bool, capAlbedo: vec3f };
const CAPSULE_HIT: i32 = 0x7ffffff0;   // Hit.idx of a character-proxy hit (a round cone; the name is the record's): capAlbedo then holds his tint

fn capsuleOwner(c: Capsule) -> u32 { return c.misc & 0xffu; }
/** `skip` packs up to two character ids (bits 0-7: usually the receiving pixel's owner; bits 8-15: the light's owner) whose boxes / proxies a ray ignores. */
fn skipsOwner(owner: u32, skip: u32) -> bool { return owner != 0u && (owner == (skip & 0xffu) || owner == ((skip >> 8u) & 0xffu)); }
// THIN THINGS THAT STAND FREE DO NOT CUT THE FOG'S SIGHT (game/fogofwar.ts FOG.thin). While a FOG EYE's ray is walked (fogEyeThin raised by the fog's own
// callers and put back: fogSeenAt below, shaders/fogofwar.wgsl main / pre, shaders/fogsight.wgsl) a box the ray MEETS is passed when somebody carries it (any
// owner: another man's gun, a tracer's streak — the squad's own lines never met those) or when the level marked it thin and free (its bit in fogSight.thin:
// a stovepipe, a window's bar, a lone post — never a door's jamb). Asked only of a box already hit, so a shadow ray pays one false bool per hit.
var<private> fogEyeThin: bool = false;
fn fogThinBox(b: BoxGeo, bi: u32) -> bool {
  if (!fogEyeThin) { return false; }
  if (boxOwner(b) != 0u) { return true; }
  return bi < 4096u && ((fogSight.thin[bi >> 7u][(bi >> 5u) & 3u] >> (bi & 31u)) & 1u) != 0u;
}
fn capsuleAlbedo(c: Capsule) -> vec3f { let p = c.misc >> 8u; return vec3f(f32((p >> 11u) & 31u) / 31.0, f32((p >> 5u) & 63u) / 63.0, f32(p & 31u) / 31.0); }

fn raySphere(ro: vec3f, rd: vec3f, ce: vec3f, ra: f32, tmax: f32) -> bool {
  let oc = ro - ce; let b = dot(oc, rd); let c = dot(oc, oc) - ra * ra;
  if (c <= 0.0) { return true; }
  let h = b * b - c; if (h < 0.0 || b > 0.0) { return false; }
  return (-b - sqrt(h)) <= tmax;
}
// ---- the character PROXIES: every man's 15 ROUND CONES (record `Capsule`: segment a→b, radius r at a, coneRb() at b — shaders/sdfrig.wgsl has the primitive:
// isectRoundCone / roundConeNormal / sdRoundCone, render/sdfrig.ts the radius fit the CPU packs into the records). Per character a bounding-sphere cull
// (scene.charBounds), then his capsPerChar records; the whole character shares one owner byte, so the first skipped record skips him.
/** Closest proxy hit within tmax (skipping `skipOwner`'s two owners). Returns (t, record index) with index < 0 on a miss. */
fn traceCapsules(ro: vec3f, rd: vec3f, tmax: f32, skipOwner: u32) -> vec2f {
  var best = tmax; var bi = -1.0;
  for (var ch = 0u; ch < scene.numChars; ch++) {
    let bs = scene.charBounds[ch];
    if (!raySphere(ro, rd, bs.xyz, bs.w, best)) { continue; }
    let first = ch * scene.capsPerChar; let last = min(first + scene.capsPerChar, scene.numCapsules);
    for (var i = first; i < last; i++) {
      let cp = capsules[i];
      if (skipsOwner(capsuleOwner(cp), skipOwner)) { break; }
      let t = isectRoundCone(ro, rd, cp.a, cp.b, cp.r, coneRb(cp));
      if (t >= 0.0 && t < best) { best = t; bi = f32(i); }
    }
  }
  return vec2f(best, bi);
}
/** Any proxy hit within [0, tmax] (skipping `skipOwner`'s two owners). */
fn occludedCapsules(ro: vec3f, rd: vec3f, tmax: f32, skipOwner: u32) -> bool {
  for (var ch = 0u; ch < scene.numChars; ch++) {
    let bs = scene.charBounds[ch];
    if (!raySphere(ro, rd, bs.xyz, bs.w, tmax)) { continue; }
    let first = ch * scene.capsPerChar; let last = min(first + scene.capsPerChar, scene.numCapsules);
    for (var i = first; i < last; i++) {
      let cp = capsules[i];
      if (skipsOwner(capsuleOwner(cp), skipOwner)) { break; }
      let t = isectRoundCone(ro, rd, cp.a, cp.b, cp.r, coneRb(cp));
      if (t >= 0.0 && t < tmax) { return true; }
    }
  }
  return false;
}
/** the proxy's outward normal at a point p on it (traceClosest / traceClosestMesh tails) */
fn proxyNormal(p: vec3f, cp: Capsule) -> vec3f { return roundConeNormal(p, cp.a, cp.b, cp.r, coneRb(cp)); }

// ---- mesh-traced character shadows (FLAG_MESH_SHADOWS; data written by render/meshShadows.ts every frame the flag is up, layout described there;
// meshLoad() and MESH_MAX_CHARS come from the scene prelude). The CPU twin of every function here is render/meshbvh.ts (triHit / bvhAnyHit):
// same tolerances, same visiting order — tools/qa/mesh-shadow-ref.ts checks that one against brute force, and its fixture checks this one
// against that (main.ts __meshTrace).
const MESH_EPS_UV: f32 = 1e-5;    // barycentric slack: triangles are this much fat at their edges, so a ray through a shared edge cannot slip between both
const MESH_TMIN: f32 = 1e-4;      // hits nearer than this are ignored (origins sit on some other surface, a centimetre or more off it)
// Möller–Trumbore, both faces: t in (MESH_TMIN, tmax] of the triangle whose three skinned corners start at element c0, or −1.
fn meshTri(c0: u32, ro: vec3f, rd: vec3f, tmax: f32) -> f32 {
  let a = bitcast<vec3f>(meshLoad(c0).xyz);
  let e1 = bitcast<vec3f>(meshLoad(c0 + 1u).xyz) - a;
  let e2 = bitcast<vec3f>(meshLoad(c0 + 2u).xyz) - a;
  let p = cross(rd, e2); let det = dot(e1, p);
  if (abs(det) < 1e-12) { return -1.0; }
  let inv = 1.0 / det; let s = ro - a;
  let u = dot(s, p) * inv;
  if (u < -MESH_EPS_UV || u > 1.0 + MESH_EPS_UV) { return -1.0; }
  let q = cross(s, e1);
  let v = dot(rd, q) * inv;
  if (v < -MESH_EPS_UV || u + v > 1.0 + MESH_EPS_UV) { return -1.0; }
  let t = dot(e2, q) * inv;
  return select(-1.0, t, t > MESH_TMIN && t <= tmax);
}
// Character k's tree, stackless: a missed (or finished) node jumps to its skip link, a hit internal node steps to its left child (i + 1), a hit
// leaf tests its ≤ 4 triangles. ANY hit ends it: returns that triangle's t (a real blocker in (MESH_TMIN, tmax], not necessarily the nearest),
// or −1. Links only ever point forward, so a well-formed tree ends within N steps; `it` caps a malformed one at N regardless.
fn meshAnyHitChar(k: u32, ro: vec3f, rd: vec3f, invRd: vec3f, tmax: f32) -> f32 {
  let hd = meshLoad(0u);                        // (N, NODE_BASE, TRI_BASE, T)
  let N = hd.x;
  let nb = hd.y + k * N * 2u; let tb = hd.z + k * hd.w * 3u;
  var i = 0u; var it = 0u;
  loop {
    if (i >= N || it >= N) { break; }
    it++;
    let n0 = meshLoad(nb + i * 2u); let n1 = meshLoad(nb + i * 2u + 1u);
    let t0 = (bitcast<vec3f>(n0.xyz) - ro) * invRd; let t1 = (bitcast<vec3f>(n1.xyz) - ro) * invRd;
    let tmn = min(t0, t1); let tmx = max(t0, t1);
    let tN = max(max(tmn.x, tmn.y), max(tmn.z, 0.0));
    let tF = min(min(tmx.x, tmx.y), min(tmx.z, tmax));
    if (tN > tF) { i = n0.w; continue; }         // box missed over [0, tmax]: skip the subtree
    let cnt = n1.w >> 24u;
    if (cnt == 0u) { i = i + 1u; continue; }     // internal: descend (left child is next in memory)
    let ts = n1.w & 0xffffffu;
    for (var q = 0u; q < cnt; q++) {
      let t = meshTri(tb + (ts + q) * 3u, ro, rd, tmax);
      if (t >= 0.0) { return t; }
    }
    i = n0.w;                                    // leaf done: on to the skip link
  }
  return -1.0;
}
// Every character in this frame's list: bounding-sphere cull (scene.charBounds, as the proxy loops do), owner skip (all of a character's records carry
// his id — the first one is enough), then his tree, whose root box is the exact broad phase. NOT the proxies: tools/qa/mesh-shadow-ref.ts found 6–12 %
// of the rays the mesh blocks (shins, feet, hands) touched no capsule at all (the proxies of the time; the fitted cones are slimmer still), so gating on
// them would clip the very silhouette this is for. First blocker found (its t), or −1.
// NEAR-ONLY mode (frame.rigCfg bit 128 = settings.meshShadowsNear, the HIGH tier's form of mesh shadows — docs/internal/render-defects-0812.md §1): only a receiver within MESH_NEAR_M of a
// man's cull sphere tests his MESH; anything farther keeps his round cones (statement for statement the loop occludedCapsules runs). The mesh is what closes the lit seam
// between a rasterised limb and the shadow its slimmer proxy casts beside it — a CONTACT defect: the floor at his boots, the desk under his hand, the man beside him — while a
// torch throwing his shadow on a wall three metres off reads the same off either; and it is the rays that start ON or BESIDE a lit man (a torch full on him) that made the
// every-ray mesh walk cost 0.9 ms of direct light at high in a four-man corridor. 0 = every ray walks the mesh (ultra, as it was).
const MESH_NEAR_M: f32 = 0.6;
fn meshShadowT(ro: vec3f, rd: vec3f, tmax: f32, skipOwner: u32) -> f32 {
  let invRd = safeInv(rd);
  let nc = min(scene.numChars, MESH_MAX_CHARS);
  let nearOnly = (u32(frame.rigCfg.x) & 128u) != 0u;
  for (var ch = 0u; ch < nc; ch++) {
    let bs = scene.charBounds[ch];
    if (!raySphere(ro, rd, bs.xyz, bs.w, tmax)) { continue; }
    let first = ch * scene.capsPerChar;
    if (skipsOwner(capsuleOwner(capsules[first]), skipOwner)) { continue; }
    if (nearOnly && distance(ro, bs.xyz) > bs.w + MESH_NEAR_M) {   // a far receiver: his round cones (occludedCapsules' inner loop; the nearest of them, as traceCapsules hands the penumbra hint)
      let last = min(first + scene.capsPerChar, scene.numCapsules);
      var best = -1.0;
      for (var i = first; i < last; i++) { let cp = capsules[i]; let t = isectRoundCone(ro, rd, cp.a, cp.b, cp.r, coneRb(cp)); if (t >= 0.0 && t < tmax && (best < 0.0 || t < best)) { best = t; } }
      if (best >= 0.0) { return best; }
      continue;
    }
    let t = meshAnyHitChar(ch, ro, rd, invRd, tmax);
    if (t >= 0.0) { return t; }
  }
  return -1.0;
}

// ---- CHARACTER SELF-SHADOW (frame.rigCfg bit 64 = settings.charSelfShadow; direct_common.wgsl shadowSample asks it for a man's own pixels — docs/internal/render-defects-0812.md §1).
// Every shadow ray leaving a man's pixel skips ALL of his own proxies / his own mesh (the owner byte, above): the proxies are fitted ±2–3 cm round the mesh, and even the
// mesh's own facets sit a hair off the smooth-shaded surface, so testing them from the surface point would print acne. The price was that his own body never stood between
// any part of him and a light: crouched under the moon through a window, the tops of his thighs, boots and tucked forearms lit up as brightly as the crown of his head — the
// bright outline round the whole silhouette of a dark suit seen from above. This is the visibility that skip threw away: ONLY his own records (or his own tree while
// FLAG_MESH_SHADOWS refits it), traced from the point lifted SELF_N off the surface along the shading normal and SELF_T along the ray, counting only what the ray ENTERS
// beyond that. A round cone the lifted origin still lies inside is the record the pixel sits on (or its neighbour across a joint) — not an occluder (isectRoundCone's 0);
// every record is convex, so a ray that has left one along its outward normal never re-enters it: the limb a pixel belongs to cannot shadow it, only the others can.
// Returns the blocker's distance from P (≥ SELF_T), or −1. `owner` ≠ 0 (the caller checks, and never asks for the holder of the light itself: a torch inside a fist).
const SELF_N: f32 = 0.035;
const SELF_T: f32 = 0.05;
fn selfShadowT(P: vec3f, N: vec3f, rd: vec3f, tmax: f32, owner: u32) -> f32 {
  if (tmax <= SELF_T) { return -1.0; }
  let ro = P + N * SELF_N + rd * SELF_T; let tm = tmax - SELF_T;
  for (var ch = 0u; ch < scene.numChars; ch++) {
    let first = ch * scene.capsPerChar;
    if (first >= scene.numCapsules) { break; }
    if (capsuleOwner(capsules[first]) != owner) { continue; }
    if ((frame.flags & FLAG_MESH_SHADOWS) != 0u && ch < MESH_MAX_CHARS) { let t = meshAnyHitChar(ch, ro, rd, safeInv(rd), tm); return select(-1.0, t + SELF_T, t >= 0.0); }   // his skinned mesh (the tree meshShadowT walks for everybody else)
    let last = min(first + scene.capsPerChar, scene.numCapsules);
    var best = -1.0;
    for (var i = first; i < last; i++) {
      let cp = capsules[i];
      let t = isectRoundCone(ro, rd, cp.a, cp.b, cp.r, coneRb(cp));
      if (t > 0.0 && t < tm && (best < 0.0 || t < best)) { best = t; }   // (t == 0: the lifted origin lies inside this record — skipped)
    }
    return select(-1.0, best + SELF_T, best >= 0.0);   // (one owner = one character: nothing else in the list is his)
  }
  return -1.0;
}

// ---- CLOSEST mesh hit (renderer v3 phase 5: reflect.wgsl under frame.p5Cfg.z bit 1 — a mirror shows a man as his skinned mesh, not his capsules). The same
// per-character trees and skinned corners as the shadow walk above (valid whenever FLAG_MESH_SHADOWS is up: render/meshShadows.ts refits them each such
// frame), walked to the NEAREST triangle instead of the first: a hit leaf tests all its triangles and shrinks the search distance, so every later node
// test prunes against the best hit so far. Skip links only run forward, so the walk still ends within N steps. ----
struct MeshHit { t: f32, k: i32, n: vec3f };   // k = character index in this frame's list (−1 = no hit), n = the triangle's face normal turned toward the ray origin
/** Möller–Trumbore as meshTri, returning the face normal e1 × e2 (unnormalised) in .xyz and t (or −1) in .w */
fn meshTriN(c0: u32, ro: vec3f, rd: vec3f, tmax: f32) -> vec4f {
  let a = bitcast<vec3f>(meshLoad(c0).xyz);
  let e1 = bitcast<vec3f>(meshLoad(c0 + 1u).xyz) - a;
  let e2 = bitcast<vec3f>(meshLoad(c0 + 2u).xyz) - a;
  let p = cross(rd, e2); let det = dot(e1, p);
  if (abs(det) < 1e-12) { return vec4f(0.0, 0.0, 0.0, -1.0); }
  let inv = 1.0 / det; let s = ro - a;
  let u = dot(s, p) * inv;
  if (u < -MESH_EPS_UV || u > 1.0 + MESH_EPS_UV) { return vec4f(0.0, 0.0, 0.0, -1.0); }
  let q = cross(s, e1);
  let v = dot(rd, q) * inv;
  if (v < -MESH_EPS_UV || u + v > 1.0 + MESH_EPS_UV) { return vec4f(0.0, 0.0, 0.0, -1.0); }
  let t = dot(e2, q) * inv;
  return vec4f(cross(e1, e2), select(-1.0, t, t > MESH_TMIN && t <= tmax));
}
/** character k's nearest triangle along the ray within tmaxIn: (face normal unnormalised, t) or .w = −1 */
fn meshClosestChar(k: u32, ro: vec3f, rd: vec3f, invRd: vec3f, tmaxIn: f32) -> vec4f {
  let hd = meshLoad(0u);
  let N = hd.x;
  let nb = hd.y + k * N * 2u; let tb = hd.z + k * hd.w * 3u;
  var best = tmaxIn; var nrm = vec3f(0.0); var found = false;
  var i = 0u; var it = 0u;
  loop {
    if (i >= N || it >= N) { break; }
    it++;
    let n0 = meshLoad(nb + i * 2u); let n1 = meshLoad(nb + i * 2u + 1u);
    let t0 = (bitcast<vec3f>(n0.xyz) - ro) * invRd; let t1 = (bitcast<vec3f>(n1.xyz) - ro) * invRd;
    let tmn = min(t0, t1); let tmx = max(t0, t1);
    let tN = max(max(tmn.x, tmn.y), max(tmn.z, 0.0));
    let tF = min(min(tmx.x, tmx.y), min(tmx.z, best));
    if (tN > tF) { i = n0.w; continue; }         // box missed over [0, best]: skip the subtree
    let cnt = n1.w >> 24u;
    if (cnt == 0u) { i = i + 1u; continue; }     // internal: descend
    let ts = n1.w & 0xffffffu;
    for (var q = 0u; q < cnt; q++) {
      let r = meshTriN(tb + (ts + q) * 3u, ro, rd, best);
      if (r.w >= 0.0) { best = r.w; nrm = r.xyz; found = true; }
    }
    i = n0.w;                                    // leaf done: on to the skip link (the shrunk `best` prunes what follows)
  }
  return vec4f(nrm, select(-1.0, best, found));
}
/** every character in this frame's list: bounding-sphere cull against the best distance so far, owner skip, then his tree — the nearest mesh hit within tmax, if any */
fn meshClosest(ro: vec3f, rd: vec3f, tmax: f32, skipOwner: u32) -> MeshHit {
  var mh: MeshHit; mh.t = tmax; mh.k = -1; mh.n = -rd;
  let invRd = safeInv(rd);
  let nc = min(scene.numChars, MESH_MAX_CHARS);
  for (var ch = 0u; ch < nc; ch++) {
    let bs = scene.charBounds[ch];
    if (!raySphere(ro, rd, bs.xyz, bs.w, mh.t)) { continue; }
    if (skipsOwner(capsuleOwner(capsules[ch * scene.capsPerChar]), skipOwner)) { continue; }
    let r = meshClosestChar(ch, ro, rd, invRd, mh.t);
    if (r.w >= 0.0) { mh.t = r.w; mh.k = i32(ch); mh.n = r.xyz; }
  }
  if (mh.k >= 0) { let l2 = dot(mh.n, mh.n); mh.n = select(-rd, mh.n * inverseSqrt(l2), l2 > 1e-20); if (dot(mh.n, rd) > 0.0) { mh.n = -mh.n; } }   // (both faces hit alike: turn the face normal toward where the ray came from)
  return mh;
}

// ---- trace-grid fast path (FLAG_GRID_SKIP / FLAG_GRID_YCULL; data written by boxes.ts buildGrid every upload, next to the plain arrays) ----
// gridCells[GRID_CB + 2ci]     = heightMask (bit s ⇔ some box registered in ci covers quantised heights [10s, 10s+9]) | cheby << 24
// gridCells[GRID_CB + 2ci + 1] = start (24 bits) | min(count, 255) << 24          cheby = Chebyshev distance (cells) to the nearest occupied cell, 0 = occupied
// gridItems[itemsB + k]        = box index (16 bits) | qmin << 16 | qmax << 24     q = gridYq of the box's y extent widened by 4 cm each way
// scene.globalsY               = the same padded extent per global, in metres (globalMissesY)
//
// Why both are exact (same hit.t / idx / code, same occlusion answers, flag on or off):
//  * Empty runs. An empty cell has no items, so not loading its (equal) start/end pair changes nothing; a cell at Chebyshev distance d from
//    every occupied cell is followed, whatever the ray does, by d−1 more cells within d−1 king moves of it — all empty too. The DDA still takes
//    exactly one loop iteration per cell with the very same float stepping and the same break tests, so `iter` counts what it always counted
//    (and GRID_W + GRID_H ≤ 96 is asserted host-side: a ray leaves the grid after at most W + H steps, the cap never binds either way).
//  * Height cull. Every test the cull drops is one that could not have changed anything. The DDA visits the cells along the ray in t order and
//    a box is registered in every cell its footprint overlaps, so by the time the walk enters cell k at tCell, any box that the ray meets at a
//    point BEHIND tCell was already met in the (earlier) cell holding that point: traceClosest already has hit.t ≤ that t (the re-test is a
//    no-op under the strict <), occluded / occludedT already returned. What is left are hits ahead, at t in [tCell, tEnd] (tEnd = tmax, or the
//    current hit.t), i.e. at heights between y(tCell) and y(tEnd) — inside the box, hence inside its stored [ymin, ymax], hence inside the
//    cell's mask. A cell whose mask misses the quantised span, or an item whose extent misses it, therefore only ever produced misses / no-ops,
//    and dropping those leaves the sequence of state-changing tests, their order and the hit state they see untouched (ties included). The
//    4 cm pad on the stored extents dwarfs everything float in y: f32 vs f64 quantiser boundaries (~1e-7 m), y(t) rounding (~1e-5 m), the
//    drift of the accumulated tNext against the true cell lines (< 1e-4 m of height over a whole ray), corner tie attribution (~1e-6 m).
//    "Registered in every cell it can be hit in" is true of the f64 footprint, but the box the GPU traces is made of f32 centres / half sizes /
//    origin offsets and, when yawed, f16 cos/sin: its faces can sit up to scene.grid.x metres (measured per build; ~1e-5 axis-aligned, mm for a
//    yawed car) outside the registered cells. A ray grazing such a sliver meets the box just BEFORE the line into its first registered cell,
//    i.e. up to slack/|rd ⟂ line| behind tCell — so the span a cell is judged by starts that far back (tBack: slack × the tDelta of the axis
//    just stepped, which is exactly 1/|rd ⟂|), clamped to the DDA start. For all but grazing rays that is a few micrometres of extra height.
//    (Nothing can lie behind the DDA start itself: every caller's origin is inside WORLD_MIN/MAX, so t0 = 0 — an origin-inside answer comes
//    from the start cell, whose span holds ro.y — and an origin outside the world has no box before its entry point.)
//  * Tighter spans (FLAG_GRID_SLABS). Tallying those terms: the y-cull needs the stored extents to out-reach the tracer by the accumulated tNext
//    drift (≤ 68 steps × ½ ulp(64 m) ≈ 2.6e-4 m of height), y(t) and cell-entry rounding (~2e-5), the f32-vs-f64 quantiser inputs (~2e-6) and
//    the ~2e-5 by which a reported hit can sit outside its box (below) — under 3.5e-4 m in all — and they carry 4 cm. So the span a cell is judged
//    by may be pulled in by scene.grid.y = 4 cm − 5 mm at BOTH ends without a hittable box failing either per-end test (each end was argued on
//    its own above), still with a 5 mm margin, 14× the tally. When the pull-in crosses the ends over (a span under 7 cm: level rays), qlo > qhi
//    only makes both per-item tests stricter, and an item passing both has qmin ≤ qhi < qlo ≤ qmax — its slices cover the whole hull [qhi, qlo] —
//    so the cell is walked only if its mask holds EVERY hull slice (an ordered span: any). That is what stops a ray lifted 1–2 cm off a desk,
//    floor finish or wall top by its pass from slab-testing the surface it just left (its padded band reached up past the origin; nothing
//    else about the walk changes).
//  * Globals by segment bounds (FLAG_GRID_SLABS). If isectBox reports t ≥ 0 for box b there is a t* ∈ [0, tmax] (the reported t, or 0 from
//    inside) lying in every axis' slab interval, and the point ro + rd·t* taken exactly sits within |lo| · 3·2⁻²⁴ + ½ ulp ≈ 2e-5 m of the box
//    on each axis (lo = ro − c and the two slab distances are each one rounding off; yaw 0 makes the local frame the world frame bit for bit, a
//    yawed global's f16 outline is inside footprint + slack by construction of the slack). Every coordinate of that point also lies between ro
//    and pEnd = ro + rd·tmax as computed (affine in t; pEnd is off by ≤ two roundings below 128 m ≈ 1.5e-5). So a global whose bounds — footprint and height
//    extent + slack + 5 mm (boxes.ts GLOBAL_PAD) — clear [min(ro, pEnd), max(ro, pEnd)] on ANY axis cannot report a hit: 5 mm against < 4e-5.
//    A skipped global answered "miss" before, and a miss moves nothing in any of the three queries (closest: no state; any-hit: no early out),
//    so the survivors run in the same order against the same state. The old test was this on y alone with 4 cm: every ray lifted 1–2 cm off a
//    floor still slab-tested all four floor-level globals (ground, carpet base, two finishes) — four of its ~ten box tests — for nothing.
struct CellWalk { start: u32, end: u32, qlo: u32, qhi: u32 };   // items [start, end) to test in this cell; quantised height span for the per-item test
fn gridYq(y: f32) -> u32 { return u32(clamp((y - GRID_YQ0) * GRID_YQS, 0.0, GRID_YQMAX)); }
fn gridSliceMask(qlo: u32, qhi: u32) -> u32 { let slo = qlo / 10u; let shi = qhi / 10u; return (0xffffffu >> (23u - (shi - slo))) << slo; }
// What to walk in cell ci for a ray whose remaining stretch spans heights ya..yb (either order), judged `shrink` tighter at each end (0, or
// scene.grid.y under FLAG_GRID_SLABS). `run` counts down the cells an earlier empty cell's Chebyshev distance has already vouched for: those
// cost no memory traffic at all.
fn gridCell(ci: u32, ya: f32, yb: f32, run: ptr<function, u32>, gskip: bool, ycull: bool, shrink: f32) -> CellWalk {
  var w: CellWalk; w.start = 0u; w.end = 0u; w.qlo = 0u; w.qhi = 255u;
  if (*run > 0u) { *run = *run - 1u; return w; }
  let w0 = gridCells[GRID_CB + 2u * ci];
  let dist = select(0u, w0 >> 24u, gskip);
  if (dist > 0u) { *run = dist - 1u; return w; }
  var m = 0xffffffu;
  var need = 1u;                       // how much of m the cell's mask must hold: any slice of an ordered span; ALL of a crossed one (see above)
  if (ycull) { w.qlo = gridYq(min(ya, yb) + shrink); w.qhi = gridYq(max(ya, yb) - shrink); m = gridSliceMask(min(w.qlo, w.qhi), max(w.qlo, w.qhi)); need = select(1u, m, w.qlo > w.qhi); }   // (shrink 0: + 0.0 and the min/max of an ordered pair are identities, need stays 1 — the flag-off walk is value for value the old one)
  if ((w0 & m) < need) { return w; }   // ordered: (w0 & m) == 0; crossed: (w0 & m) != m, i.e. some hull slice has no box in this cell
  let w1 = gridCells[GRID_CB + 2u * ci + 1u];
  w.start = w1 & 0xffffffu;
  let n = w1 >> 24u;
  if (n == 255u) { w.end = gridCells[ci + 1u]; } else { w.end = w.start + n; }   // 255 = long cell: take the plain end
  return w;
}
// Box index of item k, or −1 when the height cull proves the box outside the ray's remaining span (cull on: reads the packed copy instead).
fn gridItem(k: u32, w: CellWalk, ycull: bool) -> i32 {
  if (!ycull) { return i32(gridItems[k]); }
  let it = gridItems[scene.itemsB + k];
  if ((it >> 24u) < w.qlo || ((it >> 16u) & 255u) > w.qhi) { return -1; }
  return i32(it & 0xffffu);
}
// The globals (huge boxes tested once per ray, all thin horizontal slabs in practice) get the same treatment in float: global g whose padded
// [ymin, ymax] misses the heights the ray covers over [0, tmax] can only answer "miss" — a hit or an origin-inside answer places a ray point of
// that t range inside the box — and a miss changes nothing in any of the three queries, so not asking is exact.
fn globalMissesY(g: u32, ySpan: vec2f) -> bool {
  let gy = scene.globalsY[g >> 1u];
  let e = select(gy.xy, gy.zw, (g & 1u) == 1u);
  return e.y < ySpan.x || e.x > ySpan.y;
}
// FLAG_GRID_SLABS: the same on all three axes against the segment's bounds [sLo, sHi] = [min(ro, pEnd), max(ro, pEnd)] and the global's own
// 5 mm-proud bounds (argument above): outside on any axis ⇒ it can only answer "miss".
fn globalOutside(g: u32, sLo: vec3f, sHi: vec3f) -> bool {
  return any(scene.globalsB[2u * g + 1u].xyz < sLo) || any(scene.globalsB[2u * g].xyz > sHi);
}
// Which of the two global rejects applies to global g for this ray (slabs: the three-axis one; else the height band when the y-cull is on).
fn globalSkipped(g: u32, sLo: vec3f, sHi: vec3f, ycull: bool, slabs: bool) -> bool {
  if (slabs) { return globalOutside(g, sLo, sHi); }
  return ycull && globalMissesY(g, vec2f(sLo.y, sHi.y));
}

// Closest hit through globals + XZ uniform grid. skipOwner: boxes owned by this character id are ignored (0 = none).
fn traceClosest(ro: vec3f, rd: vec3f, tmaxIn: f32, skipOwner: u32) -> Hit {
  var hit: Hit; hit.t = tmaxIn; hit.idx = -1; hit.inside = false; hit.n = vec3f(0.0, 1.0, 0.0);
  let invRd = safeInv(rd);
  let tb = isectBounds(ro, invRd, WORLD_MIN, WORLD_MAX);
  if (tb.x > tb.y || tb.y < 0.0) { return hit; }
  var tmax = min(tmaxIn, tb.y);
  hit.t = tmax;
  var code = 0.0;
  var found = false;
  let gskip = (frame.flags & FLAG_GRID_SKIP) != 0u; let ycull = (frame.flags & FLAG_GRID_YCULL) != 0u; let fast = gskip || ycull; let axisFast = (frame.flags & FLAG_AXIS_BOX) != 0u;
  let slabs = (frame.flags & FLAG_GRID_SLABS) != 0u; let shrink = select(0.0, scene.grid.y, slabs);
  let yFar = ro.y + rd.y * tmax;
  let pEnd = vec3f(ro.x + rd.x * tmax, yFar, ro.z + rd.z * tmax);
  let sLo = min(ro, pEnd); let sHi = max(ro, pEnd);   // the segment's bounds over [0, tmax]: a global clear of them (its padded height band without FLAG_GRID_SLABS, its padded box with it) can only answer "miss", so it is not asked
  for (var g = 0u; g < scene.numGlobals; g++) {
    if (globalSkipped(g, sLo, sHi, ycull, slabs)) { continue; }
    let bi = scene.globals[g >> 2u][g & 3u];
    let b = boxGeo[bi];
    let r = isectBox(ro, rd, b, hit.t, bi, invRd, axisFast);
    if (r.x >= 0.0 && r.x < hit.t) { hit.t = r.x; hit.idx = i32(bi); code = r.y; found = true; }
  }
  var run = 0u;
  // 2D DDA
  let t0 = max(tb.x, 0.0);
  let p = ro + rd * t0;
  var cell = vec2i(clamp(vec2i(floor(p.xz / GRID_CELL)), vec2i(0), vec2i(GRID_W - 1, GRID_H - 1)));
  let stp = vec2i(select(-1, 1, rd.x >= 0.0), select(-1, 1, rd.z >= 0.0));
  let tDelta = vec2f(abs(GRID_CELL * invRd.x), abs(GRID_CELL * invRd.z));
  let nextBoundary = (vec2f(cell) + vec2f(select(0.0, 1.0, rd.x >= 0.0), select(0.0, 1.0, rd.z >= 0.0))) * GRID_CELL;
  var tNext = vec2f(t0) + (nextBoundary - p.xz) * vec2f(invRd.x, invRd.z);
  tNext = select(tNext, vec2f(1e30), vec2<bool>(abs(rd.x) < 1e-20, abs(rd.z) < 1e-20));
  var tCell = t0;
  var tBack = 0.0;                     // slack × tDelta of the axis last stepped (= slack / |rd ⟂ that line|): how far behind tCell a registered box may already have been met (see above)
  let slack = scene.grid.x / GRID_CELL;
  for (var iter = 0; iter < 96; iter++) {
    if (tCell > hit.t) { break; }
    let ci = u32(cell.y * GRID_W + cell.x);
    var cw: CellWalk;
    if (fast) { cw = gridCell(ci, ro.y + rd.y * max(tCell - tBack, t0), ro.y + rd.y * hit.t, &run, gskip, ycull, shrink); }
    else { cw.start = gridCells[ci]; cw.end = gridCells[ci + 1u]; cw.qlo = 0u; cw.qhi = 255u; }
    for (var k = cw.start; k < cw.end; k++) {
      let gi = gridItem(k, cw, ycull); if (gi < 0) { continue; }
      let bi = u32(gi);
      let b = boxGeo[bi];
      if (skipsOwner(boxOwner(b), skipOwner)) { continue; }
      let r = isectBox(ro, rd, b, hit.t, bi, invRd, axisFast);
      if (r.x >= 0.0 && r.x < hit.t) { hit.t = r.x; hit.idx = i32(bi); code = r.y; found = true; }
    }
    if (tNext.x < tNext.y) { tCell = tNext.x; tNext.x += tDelta.x; cell.x += stp.x; tBack = tDelta.x * slack; }
    else { tCell = tNext.y; tNext.y += tDelta.y; cell.y += stp.y; tBack = tDelta.y * slack; }
    if (tCell > tmax || cell.x < 0 || cell.y < 0 || cell.x >= GRID_W || cell.y >= GRID_H) { break; }
  }
  if (found) {
    if (code > 6.5) { hit.inside = true; hit.n = -rd; }
    else {
      hit.n = boxNormalFromCode(boxGeo[u32(hit.idx)], code, u32(hit.idx));
      if (ROUND_BOXES) { if (code < ROUND_SIDE + 0.5) { hit.n = roundNormalAt(boxGeo[u32(hit.idx)], u32(hit.idx), ro + rd * hit.t); } }   // ROUND THINGS: a round's side
    }
  } else { hit.idx = -1; hit.t = tmaxIn; }
  // the character proxies (few, sphere-culled per character): the round cones' closest hit and normal
  if (scene.numCapsules > 0u) {
    let ch = traceCapsules(ro, rd, hit.t, skipOwner);
    if (ch.y >= 0.0) {
      let cp = capsules[u32(ch.y)];
      hit.t = ch.x; hit.idx = CAPSULE_HIT; hit.inside = false; hit.capAlbedo = capsuleAlbedo(cp);
      hit.n = proxyNormal(ro + rd * ch.x, cp);
    }
  }
  return hit;
}

// traceClosest whose CHARACTERS are their skinned mesh (renderer v3 phase 5 — the reflection pass's tracer: reflect_p5.wgsl). The box walk is traceClosest's
// statement for statement (kept apart so that function — every other pass's tracer — stays exactly what it was; keep the two in step); the tail takes the
// nearest mesh triangle (meshClosest above: t, face normal, the character's albedo off his first record — the one tint all his records carry) while
// frame.p5Cfg.z bit 1 is up AND the trees are refit this frame (FLAG_MESH_SHADOWS), else the smooth union of his cones under frame.rigCfg bit 2, else the
// round cones exactly as traceClosest — so meshShadows off / unavailable falls back cleanly, and with both bits down the result is bit for bit traceClosest's.
fn traceClosestMesh(ro: vec3f, rd: vec3f, tmaxIn: f32, skipOwner: u32) -> Hit {
  var hit: Hit; hit.t = tmaxIn; hit.idx = -1; hit.inside = false; hit.n = vec3f(0.0, 1.0, 0.0);
  let invRd = safeInv(rd);
  let tb = isectBounds(ro, invRd, WORLD_MIN, WORLD_MAX);
  if (tb.x > tb.y || tb.y < 0.0) { return hit; }
  var tmax = min(tmaxIn, tb.y);
  hit.t = tmax;
  var code = 0.0;
  var found = false;
  let gskip = (frame.flags & FLAG_GRID_SKIP) != 0u; let ycull = (frame.flags & FLAG_GRID_YCULL) != 0u; let fast = gskip || ycull; let axisFast = (frame.flags & FLAG_AXIS_BOX) != 0u;
  let slabs = (frame.flags & FLAG_GRID_SLABS) != 0u; let shrink = select(0.0, scene.grid.y, slabs);
  let yFar = ro.y + rd.y * tmax;
  let pEnd = vec3f(ro.x + rd.x * tmax, yFar, ro.z + rd.z * tmax);
  let sLo = min(ro, pEnd); let sHi = max(ro, pEnd);
  for (var g = 0u; g < scene.numGlobals; g++) {
    if (globalSkipped(g, sLo, sHi, ycull, slabs)) { continue; }
    let bi = scene.globals[g >> 2u][g & 3u];
    let b = boxGeo[bi];
    let r = isectBox(ro, rd, b, hit.t, bi, invRd, axisFast);
    if (r.x >= 0.0 && r.x < hit.t) { hit.t = r.x; hit.idx = i32(bi); code = r.y; found = true; }
  }
  var run = 0u;
  let t0 = max(tb.x, 0.0);
  let p = ro + rd * t0;
  var cell = vec2i(clamp(vec2i(floor(p.xz / GRID_CELL)), vec2i(0), vec2i(GRID_W - 1, GRID_H - 1)));
  let stp = vec2i(select(-1, 1, rd.x >= 0.0), select(-1, 1, rd.z >= 0.0));
  let tDelta = vec2f(abs(GRID_CELL * invRd.x), abs(GRID_CELL * invRd.z));
  let nextBoundary = (vec2f(cell) + vec2f(select(0.0, 1.0, rd.x >= 0.0), select(0.0, 1.0, rd.z >= 0.0))) * GRID_CELL;
  var tNext = vec2f(t0) + (nextBoundary - p.xz) * vec2f(invRd.x, invRd.z);
  tNext = select(tNext, vec2f(1e30), vec2<bool>(abs(rd.x) < 1e-20, abs(rd.z) < 1e-20));
  var tCell = t0;
  var tBack = 0.0;
  let slack = scene.grid.x / GRID_CELL;
  for (var iter = 0; iter < 96; iter++) {
    if (tCell > hit.t) { break; }
    let ci = u32(cell.y * GRID_W + cell.x);
    var cw: CellWalk;
    if (fast) { cw = gridCell(ci, ro.y + rd.y * max(tCell - tBack, t0), ro.y + rd.y * hit.t, &run, gskip, ycull, shrink); }
    else { cw.start = gridCells[ci]; cw.end = gridCells[ci + 1u]; cw.qlo = 0u; cw.qhi = 255u; }
    for (var k = cw.start; k < cw.end; k++) {
      let gi = gridItem(k, cw, ycull); if (gi < 0) { continue; }
      let bi = u32(gi);
      let b = boxGeo[bi];
      if (skipsOwner(boxOwner(b), skipOwner)) { continue; }
      let r = isectBox(ro, rd, b, hit.t, bi, invRd, axisFast);
      if (r.x >= 0.0 && r.x < hit.t) { hit.t = r.x; hit.idx = i32(bi); code = r.y; found = true; }
    }
    if (tNext.x < tNext.y) { tCell = tNext.x; tNext.x += tDelta.x; cell.x += stp.x; tBack = tDelta.x * slack; }
    else { tCell = tNext.y; tNext.y += tDelta.y; cell.y += stp.y; tBack = tDelta.y * slack; }
    if (tCell > tmax || cell.x < 0 || cell.y < 0 || cell.x >= GRID_W || cell.y >= GRID_H) { break; }
  }
  if (found) {
    if (code > 6.5) { hit.inside = true; hit.n = -rd; }
    else {
      hit.n = boxNormalFromCode(boxGeo[u32(hit.idx)], code, u32(hit.idx));
      if (ROUND_BOXES) { if (code < ROUND_SIDE + 0.5) { hit.n = roundNormalAt(boxGeo[u32(hit.idx)], u32(hit.idx), ro + rd * hit.t); } }   // ROUND THINGS: a round's side
    }
  } else { hit.idx = -1; hit.t = tmaxIn; }
  if (scene.numCapsules > 0u) {
    if ((frame.p5Cfg.z & 1u) != 0u && (frame.flags & FLAG_MESH_SHADOWS) != 0u) {   // the men as their MESH: nearest triangle over every character nearer than the box hit
      let mh = meshClosest(ro, rd, hit.t, skipOwner);
      if (mh.k >= 0) { hit.t = mh.t; hit.idx = CAPSULE_HIT; hit.inside = false; hit.capAlbedo = capsuleAlbedo(capsules[u32(mh.k) * scene.capsPerChar]); hit.n = mh.n; }
    } else if (rigSmoothOn()) {   // the men as the SMOOTH UNION of their round cones (SDF rig, use ii — shaders/sdfrig.wgsl rigClosest): a mannequin, not sausage links, in the mirror
      let rh = rigClosest(ro, rd, hit.t, skipOwner);
      if (rh.ch >= 0) { let base = u32(rh.ch) * scene.capsPerChar; hit.t = rh.t; hit.idx = CAPSULE_HIT; hit.inside = false; hit.capAlbedo = capsuleAlbedo(capsules[base]); hit.n = rigNormal(base, ro + rd * rh.t, frame.rigCfgB.x); if (dot(hit.n, rd) > 0.0) { hit.n = -hit.n; } }
    } else {   // the round cones, exactly as traceClosest
      let ch = traceCapsules(ro, rd, hit.t, skipOwner);
      if (ch.y >= 0.0) {
        let cp = capsules[u32(ch.y)];
        hit.t = ch.x; hit.idx = CAPSULE_HIT; hit.inside = false; hit.capAlbedo = capsuleAlbedo(cp);
        hit.n = proxyNormal(ro + rd * ch.x, cp);
      }
    }
  }
  return hit;
}

// Any-hit visibility query. Returns true if something blocks [0, tmax].
fn occluded(ro: vec3f, rd: vec3f, tmaxIn: f32, skipOwner: u32) -> bool {
  let invRd = safeInv(rd);
  let tb = isectBounds(ro, invRd, WORLD_MIN, WORLD_MAX);
  if (tb.x > tb.y || tb.y < 0.0) { return false; }
  let tmax = min(tmaxIn, tb.y);
  let gskip = (frame.flags & FLAG_GRID_SKIP) != 0u; let ycull = (frame.flags & FLAG_GRID_YCULL) != 0u; let fast = gskip || ycull; let axisFast = (frame.flags & FLAG_AXIS_BOX) != 0u;
  let slabs = (frame.flags & FLAG_GRID_SLABS) != 0u; let shrink = select(0.0, scene.grid.y, slabs);
  let yEnd = ro.y + rd.y * tmax;
  let pEnd = vec3f(ro.x + rd.x * tmax, yEnd, ro.z + rd.z * tmax);
  let sLo = min(ro, pEnd); let sHi = max(ro, pEnd);
  for (var g = 0u; g < scene.numGlobals; g++) {
    if (globalSkipped(g, sLo, sHi, ycull, slabs)) { continue; }
    let bi = scene.globals[g >> 2u][g & 3u];
    let r = isectBox(ro, rd, boxGeo[bi], tmax, bi, invRd, axisFast);
    if (r.x >= 0.0) { return true; }
  }
  var run = 0u;
  let t0 = max(tb.x, 0.0);
  let p = ro + rd * t0;
  var cell = vec2i(clamp(vec2i(floor(p.xz / GRID_CELL)), vec2i(0), vec2i(GRID_W - 1, GRID_H - 1)));
  let stp = vec2i(select(-1, 1, rd.x >= 0.0), select(-1, 1, rd.z >= 0.0));
  let tDelta = vec2f(abs(GRID_CELL * invRd.x), abs(GRID_CELL * invRd.z));
  let nextBoundary = (vec2f(cell) + vec2f(select(0.0, 1.0, rd.x >= 0.0), select(0.0, 1.0, rd.z >= 0.0))) * GRID_CELL;
  var tNext = vec2f(t0) + (nextBoundary - p.xz) * vec2f(invRd.x, invRd.z);
  tNext = select(tNext, vec2f(1e30), vec2<bool>(abs(rd.x) < 1e-20, abs(rd.z) < 1e-20));
  var tCell = t0;
  var tBack = 0.0;
  let slack = scene.grid.x / GRID_CELL;
  for (var iter = 0; iter < 96; iter++) {
    let ci = u32(cell.y * GRID_W + cell.x);
    var cw: CellWalk;
    if (fast) { cw = gridCell(ci, ro.y + rd.y * max(tCell - tBack, t0), yEnd, &run, gskip, ycull, shrink); }
    else { cw.start = gridCells[ci]; cw.end = gridCells[ci + 1u]; cw.qlo = 0u; cw.qhi = 255u; }
    for (var k = cw.start; k < cw.end; k++) {
      let gi = gridItem(k, cw, ycull); if (gi < 0) { continue; }
      let bi = u32(gi);
      let b = boxGeo[bi];
      if (skipsOwner(boxOwner(b), skipOwner)) { continue; }
      let r = isectBox(ro, rd, b, tmax, bi, invRd, axisFast);
      if (r.x >= 0.0) { return true; }
    }
    if (tNext.x < tNext.y) { tCell = tNext.x; tNext.x += tDelta.x; cell.x += stp.x; tBack = tDelta.x * slack; }
    else { tCell = tNext.y; tNext.y += tDelta.y; cell.y += stp.y; tBack = tDelta.y * slack; }
    if (tCell > tmax || cell.x < 0 || cell.y < 0 || cell.x >= GRID_W || cell.y >= GRID_H) { break; }
  }
  if (scene.numCapsules > 0u) {
    if ((frame.flags & FLAG_MESH_SHADOWS) != 0u) { return meshShadowT(ro, rd, tmax, skipOwner) >= 0.0; }   // characters as their skinned mesh (ultra); else their round-cone proxies
    return occludedCapsules(ro, rd, tmax, skipOwner);
  }
  return false;
}

// Shadow ray that also reports roughly WHERE it was blocked: distance to the first blocker found (proxies exact-nearest,
// boxes in DDA order ≈ near-first), or -1 when the segment is clear. Feeds the PCSS-style penumbra-width hint.
fn occludedT(ro: vec3f, rd: vec3f, tmaxIn: f32, skipOwner: u32) -> f32 {
  var tCap = -1.0;
  if (scene.numCapsules > 0u) {
    if ((frame.flags & FLAG_MESH_SHADOWS) != 0u) { tCap = meshShadowT(ro, rd, tmaxIn, skipOwner); }   // ultra: the skinned mesh — the FIRST blocking triangle found, so the penumbra hint's blocker distance can be off by up to a body's thickness (boxes below are near-first, not nearest, likewise)
    else { let c = traceCapsules(ro, rd, tmaxIn, skipOwner); if (c.y >= 0.0) { tCap = c.x; } }
  }
  return occludedTBoxes(ro, rd, tmaxIn, skipOwner, tCap);
}
// occludedT's box walk on its own (its statements, unchanged): the nearest of a box blocker nearer than tCap and tCap itself (−1 = clear). The SDF rig's soft-shadow
// query (direct_common.wgsl shadowSample under frame.rigCfg bit 4) asks this with tCap −1 and multiplies the characters' analytic visibility in itself.
fn occludedTBoxes(ro: vec3f, rd: vec3f, tmaxIn: f32, skipOwner: u32, tCap: f32) -> f32 {
  let invRd = safeInv(rd);
  let tb = isectBounds(ro, invRd, WORLD_MIN, WORLD_MAX);
  if (tb.x > tb.y || tb.y < 0.0) { return tCap; }
  let tmax = select(min(tmaxIn, tb.y), tCap, tCap >= 0.0);      // a nearer box than the capsule still wins below
  let gskip = (frame.flags & FLAG_GRID_SKIP) != 0u; let ycull = (frame.flags & FLAG_GRID_YCULL) != 0u; let fast = gskip || ycull; let axisFast = (frame.flags & FLAG_AXIS_BOX) != 0u;
  let slabs = (frame.flags & FLAG_GRID_SLABS) != 0u; let shrink = select(0.0, scene.grid.y, slabs);
  let yEnd = ro.y + rd.y * tmax;
  let pEnd = vec3f(ro.x + rd.x * tmax, yEnd, ro.z + rd.z * tmax);
  let sLo = min(ro, pEnd); let sHi = max(ro, pEnd);
  for (var g = 0u; g < scene.numGlobals; g++) {
    if (globalSkipped(g, sLo, sHi, ycull, slabs)) { continue; }
    let bi = scene.globals[g >> 2u][g & 3u];
    let r = isectBox(ro, rd, boxGeo[bi], tmax, bi, invRd, axisFast);
    if (r.x >= 0.0) { return r.x; }
  }
  var run = 0u;
  let t0 = max(tb.x, 0.0);
  let p = ro + rd * t0;
  var cell = vec2i(clamp(vec2i(floor(p.xz / GRID_CELL)), vec2i(0), vec2i(GRID_W - 1, GRID_H - 1)));
  let stp = vec2i(select(-1, 1, rd.x >= 0.0), select(-1, 1, rd.z >= 0.0));
  let tDelta = vec2f(abs(GRID_CELL * invRd.x), abs(GRID_CELL * invRd.z));
  let nextBoundary = (vec2f(cell) + vec2f(select(0.0, 1.0, rd.x >= 0.0), select(0.0, 1.0, rd.z >= 0.0))) * GRID_CELL;
  var tNext = vec2f(t0) + (nextBoundary - p.xz) * vec2f(invRd.x, invRd.z);
  tNext = select(tNext, vec2f(1e30), vec2<bool>(abs(rd.x) < 1e-20, abs(rd.z) < 1e-20));
  var tCell = t0;
  var tBack = 0.0;
  let slack = scene.grid.x / GRID_CELL;
  for (var iter = 0; iter < 96; iter++) {
    let ci = u32(cell.y * GRID_W + cell.x);
    var cw: CellWalk;
    if (fast) { cw = gridCell(ci, ro.y + rd.y * max(tCell - tBack, t0), yEnd, &run, gskip, ycull, shrink); }
    else { cw.start = gridCells[ci]; cw.end = gridCells[ci + 1u]; cw.qlo = 0u; cw.qhi = 255u; }
    var bestInCell = -1.0;
    for (var k = cw.start; k < cw.end; k++) {
      let gi = gridItem(k, cw, ycull); if (gi < 0) { continue; }
      let bi = u32(gi);
      let b = boxGeo[bi];
      if (skipsOwner(boxOwner(b), skipOwner)) { continue; }
      let r = isectBox(ro, rd, b, tmax, bi, invRd, axisFast);
      if (r.x >= 0.0 && (bestInCell < 0.0 || r.x < bestInCell) && !fogThinBox(b, bi)) { bestInCell = r.x; }
    }
    if (bestInCell >= 0.0) { return bestInCell; }
    if (tNext.x < tNext.y) { tCell = tNext.x; tNext.x += tDelta.x; cell.x += stp.x; tBack = tDelta.x * slack; }
    else { tCell = tNext.y; tNext.y += tDelta.y; cell.y += stp.y; tBack = tDelta.y * slack; }
    if (tCell > tmax || cell.x < 0 || cell.y < 0 || cell.x >= GRID_W || cell.y >= GRID_H) { break; }
  }
  return tCap;
}

// ---- smoke: every read of the density (the volumetric march + self-shadow, shadow-ray / beam / probe transmittance) is shaders/smoke_read.wgsl, which the scene prelude puts behind this file ----

// ---- analytic lights ----
// Light.kind packs flags above the low byte: bit 8 = transient (muzzle flash etc.: kept out of every accumulated signal), bit 9 = broad emitter class.
// Light.owner packs the owner id in its low byte (every reader masks & 0xffu) and, above it, the GLASS experiment's per-light pane mask: bit 8+k = pane k of
// SceneInfo.glass is one this light can possibly shine through (in range, a face in its reach — engine.ts glassLightMasks; 24 panes, any beyond are taken as set)
const LIGHT_TRANSIENT: u32 = 256u;
const LIGHT_BROAD: u32 = 512u;
const MAX_BLUR_PX: f32 = 32.0;   // encoding scale of the direct-light blur hint (|S.a| = px / MAX_BLUR_PX, clamped to 1); the live cap is frame.directCfg.z
fn lightKind(li: Light) -> u32 { return li.kind & 255u; }
// THE FOG OF WAR'S LIGHT CLASSES (game/fogofwar.ts rule 4g, lights.ts RtLight.fog — no bit on any light while the rule is off): a light with LIGHT_FOG_SEEN lights
// only what the team sees (a torch, a weapon light, a flash in a room nobody watches is not in the picture of that room, and still falls on floor the team does
// see); one with LIGHT_FOG_UNSEEN lights only what it does not (a lamp put out where nobody looked, still lit in the picture of that room until somebody looks).
const LIGHT_FOG_SEEN: u32 = 0x2000000u;
const LIGHT_FOG_UNSEEN: u32 = 0x4000000u;
// AN INFRARED LIGHT (lights.ts LIGHT_IR; game/irlight.ts: the illuminators on the goggles): a light only the intensifier tube sees by. It is in the list only on a
// frame whose picture is the tube's, and every pass of the picture takes it as a steady light like any other (evalLight; the engine restarts the screen
// histories the frame the tube comes off). The game's own readings never do: evalLightTrue gives nothing for it, and directIrradiance (the cascades the light meter reads its bounce from) skips it.
const LIGHT_IR: u32 = 0x8000000u;
const FOG_SIGHT_BINS: i32 = 2048;       // render/fogofwar.ts FOG_BINS (change both together)
var<private> fogSeenKeyP: vec3f = vec3f(3e38); var<private> fogSeenKeyN: vec3f = vec3f(0.0); var<private> fogSeenVal: f32 = 1.0;   // the last spot asked and its answer: one spot is asked once however many lights fall on it
fn fogSightD(k: i32, j: i32) -> f32 { let i = k * FOG_SIGHT_BINS + j; return fogSight.dist[i >> 2u][i & 3]; }
/// one eye's say on the spot q (plan): .x = its weight (the cone: 1 inside, 0 outside, between across a soft edge; 2 = at the eye's own feet), .y = how far its
/// ray must go to reach the spot, .z / .w = 1 where the table's ray on each side of the spot's bearing goes that far.
fn fogEyeSay(k: i32, e: vec4f, q: vec2f, pad: f32) -> vec4f {
  let to = q - e.xz; let d = length(to);
  if (d <= pad + 0.02) { return vec4f(2.0, 0.0, 1.0, 1.0); }
  let rd = to / d; let L = fogSight.looks[k]; let soft = fogSight.soft;
  var w = 1.0;
  if (L.z > -1.5 && d > L.w) {
    let c = dot(rd, L.xy);
    if (soft.x > soft.y) { w = smoothstep(soft.y, soft.x, c); } else if (c < L.z) { w = 0.0; }
    if (soft.z > 0.0) { w = max(w, 1.0 - smoothstep(L.w, L.w + soft.z, d)); }
  }
  if (w <= 0.0) { return vec4f(0.0); }
  let u = (atan2(rd.y, rd.x) / 6.283185307179586 + 0.5) * f32(FOG_SIGHT_BINS) - 0.5;
  let j = i32(floor(u)); let need = d - pad;
  return vec4f(w, need, select(0.0, 1.0, fogSightD(k, (j + FOG_SIGHT_BINS) % FOG_SIGHT_BINS) >= need), select(0.0, 1.0, fogSightD(k, (j + 1) % FOG_SIGHT_BINS) >= need));
}
/// How far the team sees the spot P (its normal N, or 0 for a point in the air): 1 = seen, 0 = not, between = across a cone's soft edge. THE FOG PASS'S OWN RULE
/// (shaders/fogofwar.wgsl fowSeen: in plan, at each eye's height, the spot taken a hand off its face, a top face above the eye within topPad) answered from the
/// sight table: what stands between an eye and a spot depends on the bearing alone, so where the table's rays either side of the spot's bearing AGREE (both go
/// that far, or neither) that is the answer, and only where they differ — a sight edge, a wall seen along its length — is the fog pass's own ray walked. So the
/// light a class cuts ends on the line the fog is drawn to. 1 while no table is written (the fog is not drawn either). Compute and fragment stages (the walk
/// reads the grid); the vertex stage has fogSeenBins.
/// the head's last float, a whole number of three bits (render/fogofwar.ts FogSight.encode): the air's (1), thin things' (2) and what lies still (4) (only over a table written this frame)
fn fogSmokeOn() -> bool { return (u32(fogSight.soft.w + 0.5) & 1u) != 0u; }
fn fogThinOn() -> bool { return fogSight.cfg.y == 1.0 && (u32(fogSight.soft.w + 0.5) & 2u) != 0u; }
/// FOG.kept: what lies still stays as the team last saw it (particles.wgsl marks a resting particle on seen floor; particles_draw.wgsl then draws it under the fog)
fn fogKeptOn() -> bool { return fogSight.cfg.y == 1.0 && (u32(fogSight.soft.w + 0.5) & 4u) != 0u; }
fn fogSeenAt(P: vec3f, N: vec3f) -> f32 {
  if (all(P == fogSeenKeyP) && all(N == fogSeenKeyN)) { return fogSeenVal; }
  fogSeenKeyP = P; fogSeenKeyN = N; fogSeenVal = 1.0;
  let cfg = fogSight.cfg;
  if (cfg.y != 1.0) { return 1.0; }
  let q = vec2f(P.x + N.x * 0.06, P.z + N.z * 0.06);
  var best = 0.0;
  let thinWas = fogEyeThin; fogEyeThin = fogThinOn();   // (FOG.thin: the walks below are fog eyes' — put back before this returns)
  for (var k = 0; k < i32(cfg.x); k++) {
    let e = fogSight.eyes[k]; if (e.w < 0.5) { continue; }
    let top = N.y > 0.5 && P.y > e.y - 0.05;
    let say = fogEyeSay(k, e, q, select(0.06, max(cfg.z, 0.06), top));
    if (say.x > 1.5) { best = 1.0; break; }
    if (say.x <= best) { continue; }
    var clear = say.z > 0.5;
    if (say.z != say.w) { let to = q - e.xz; clear = occludedTBoxes(e.xyz, vec3f(to.x, 0.0, to.y) / max(length(to), 1e-6), say.y, u32(e.w + 0.5), -1.0) < 0.0; }
    if (clear) { best = say.x; if (best >= 1.0) { break; } }
  }
  fogEyeThin = thinWas;
  fogSeenVal = best;
  return best;
}
/// fogSeenAt for a point in the air, from the table alone (no walk: the vertex stage does not see the grid) — seen where either ray beside its bearing goes that far
fn fogSeenBins(P: vec3f) -> f32 {
  let cfg = fogSight.cfg;
  if (cfg.y != 1.0) { return 1.0; }
  var best = 0.0;
  for (var k = 0; k < i32(cfg.x); k++) {
    let e = fogSight.eyes[k]; if (e.w < 0.5) { continue; }
    let say = fogEyeSay(k, e, P.xz, 0.06);
    if (say.x > 1.5) { return 1.0; }
    if (say.z + say.w > 0.5) { best = max(best, say.x); }
  }
  return best;
}
/// what is left of light `li` at the spot P under the fog's light classes: 1 for a light with no fog bit (every light while the rule is off)
// (the picture's own march of the smoke — volumetrics.wgsl — takes a plume's density through this. fogSmokeOn(), as the page has it: the air is the place
// — game/fogofwar.ts FOG.air — and a plume is drawn wherever it stands; the fog pass then dims each pixel by the SURFACE behind it, so a plume over unseen
// floor is dimmed where the ground behind it on the screen is unseen and not where that ground is seen. Off: smoke over floor nobody on the team
// sees is not in the picture, as it was. Shadow rays and the game's readings take the smoke as it is either way.)
fn fogSmoke(dens: f32, X: vec3f) -> f32 { if (dens <= 0.002 || fogSmokeOn()) { return dens; } return dens * fogSeenAt(X, vec3f(0.0)); }
fn lightFogK(li: Light, P: vec3f, N: vec3f) -> f32 {
  let fc = li.kind & (LIGHT_FOG_SEEN | LIGHT_FOG_UNSEEN);
  if (fc == 0u) { return 1.0; }
  let s = fogSeenAt(P, N);
  return select(1.0 - s, s, (fc & LIGHT_FOG_SEEN) != 0u);
}
fn lightTransient(li: Light) -> bool { return (li.kind & LIGHT_TRANSIENT) != 0u; }
fn lightBroad(li: Light) -> bool { return (li.kind & LIGHT_BROAD) != 0u; }
/** the emissive MARKING an area light stands for (lights.ts RtLight.markRef: box index << 2 | ordinal), −1 = an ordinary light */
fn lightMarkRef(li: Light) -> i32 { return select(-1, i32((li.kind >> 11u) & 0x3fffu), (li.kind & 1024u) != 0u); }
/** the panes (bits, SceneInfo.glass order) light `li` can possibly shine through: its CPU mask for panes 0‥23, every listed pane past that */
fn lightGlassMask(li: Light) -> u32 { let n = glassCount(); if (n == 0u) { return 0u; } let allN = select(0xffffffffu, (1u << n) - 1u, n < 32u); return ((li.owner >> 8u) | 0xff000000u) & allN; }

struct LightEval { L: vec3f, dist: vec3f, E: vec3f, ok: bool }; // dist.x = distance to light (for shadow ray)

fn lightWindow(d: f32, range: f32) -> f32 { let x = d / range; let w = clamp(1.0 - x * x * x * x, 0.0, 1.0); return w * w; }

// Irradiance at P with normal N from light li (before visibility). For volumetrics pass N = vec3f(0) to skip the cosine.
/** Reach level 0..3 of light `slot` (index into `lights` this frame) at the 1 m cell holding P: 0 = none of the cell's five looks sees the
 *  light (walled off — or, rarely, lit only across a strip between the looks: reach.ts header), 1 = a sliver of the cell or only through a
 *  doorway (or only its neighbour, when reach.ts builds with the dilation ring), 2 = part, 3 = all of it. Always 3 with the flag off or P
 *  off the grid. (reach.ts) */
fn lightReachLevel(slot: u32, P: vec3f) -> u32 {
  if ((frame.flags & FLAG_REACH_MASK) == 0u) { return 3u; }
  let cx = i32(floor((P.x - WORLD_MIN.x) / GRID_CELL)); let cz = i32(floor((P.z - WORLD_MIN.z) / GRID_CELL));
  if (cx < 0 || cz < 0 || cx >= GRID_W || cz >= GRID_H) { return 3u; }
  let ci = u32(cz * GRID_W + cx);
  let w = slot * REACH_ROW_WORDS + (ci >> 4u);   // flat u32 word: 16 cells a word, REACH_ROW_WORDS words a slot
  return (reachWord(w) >> ((ci & 15u) * 2u)) & 3u;
}
fn lightReaches(slot: u32, P: vec3f) -> bool { return lightReachLevel(slot, P) != 0u; }
/** ranking weight for a reach level: a light seen from a sliver of the cell competes for leader slots at a quarter of its score */
fn reachRankWeight(lv: u32) -> f32 { return select(select(0.25, 0.6, lv == 2u), 1.0, lv >= 3u); }

/// evalLight as the PICTURE takes it: the light's irradiance under the fog's light classes (lightFogK — a torch nobody on the team sees the spot of gives nothing
/// there). Every pass of the picture asks this one; the game's own readings (probe.wgsl: the light meter, the guards' eyes) ask evalLightTrue.
fn evalLight(li: Light, P: vec3f, N: vec3f) -> LightEval {
  var r = evalLightRaw(li, P, N);
  if (r.ok && (li.kind & (LIGHT_FOG_SEEN | LIGHT_FOG_UNSEEN)) != 0u) {
    let k = lightFogK(li, P, N);
    if (k <= 0.002) { r.ok = false; r.E = vec3f(0.0); } else { r.E *= k; }
  }
  return r;
}
/// the light as it IS (the fog's classes not asked): what the game's own readings take. A light that exists only in the fog's picture (LIGHT_FOG_UNSEEN: a lamp
/// remembered lit) is no light here.
fn evalLightTrue(li: Light, P: vec3f, N: vec3f) -> LightEval {
  if ((li.kind & (LIGHT_FOG_UNSEEN | LIGHT_IR)) != 0u) { var r: LightEval; r.ok = false; r.E = vec3f(0.0); return r; }   // (… and an infrared light is no light to a bare eye, a camera or the meter)
  return evalLightRaw(li, P, N);
}
fn evalLightRaw(li: Light, P: vec3f, N: vec3f) -> LightEval {
  var r: LightEval; r.ok = false; r.E = vec3f(0.0);
  let kind = lightKind(li);
  if (kind == 2u) {
    r.L = -li.dir; r.dist = vec3f(1e6, 0.0, 0.0);
    let c = select(max(dot(N, r.L), 0.0), 1.0, all(N == vec3f(0.0)));
    if (c <= 0.0) { return r; }
    r.E = li.color * c; r.ok = true; return r;
  }
  let d = li.pos - P; let dist2 = dot(d, d); let dist = sqrt(dist2);
  if (dist > li.range) { return r; }
  r.L = d / dist; r.dist = vec3f(dist, 0.0, 0.0);
  var att = lightWindow(dist, li.range) / max(dist2, li.radius * li.radius);
  if (kind == 1u) {
    let cd = dot(-r.L, li.dir);
    if (cd < li.cosOuter) { return r; }
    att *= smoothstep(li.cosOuter, li.cosInner, cd);
  } else if (kind == 3u) {
    let ce = dot(-r.L, li.dir);            // emitter-side cosine: Lambertian panel, dark from behind
    if (ce <= 0.0) { return r; }
    att *= ce;
  }
  let c = select(max(dot(N, r.L), 0.0), 1.0, all(N == vec3f(0.0)));
  if (c <= 0.0 || att <= 0.0) { return r; }
  r.E = li.color * (att * c); r.ok = true;
  return r;
}

// Sum of shadowed direct irradiance from all analytic lights at P,N. maxLum: skip shadow rays for negligible contributions.
// includeTransient: false for anything that feeds an accumulated signal (cascades, dice, gather history) so a one-frame flash cannot linger there
fn directIrradiance(P: vec3f, N: vec3f, skipOwner: u32, minE: f32, includeTransient: bool) -> vec3f {
  var E = vec3f(0.0);
  let Po = P + N * 0.01;
  for (var i = 0u; i < frame.numLights; i++) {
    let li = lights[i];
    if (!includeTransient && lightTransient(li)) { continue; }
    if ((li.kind & (LIGHT_FOG_UNSEEN | LIGHT_IR)) != 0u) { continue; }   // (an infrared light likewise, whatever includeTransient says)   // a lamp that is lit only in the fog's picture (lights.ts RtLight.fogGhost) gives the cascades nothing: the game's light meter reads its bounce from them, and must never read a light that is not there
    if (!lightReaches(i, P)) { continue; }   // walled off from this cell (reach.ts): neither scored nor traced
    let ev = evalLight(li, P, N);
    if (!ev.ok) { continue; }
    if (max(ev.E.x, max(ev.E.y, ev.E.z)) < minE) { continue; }   // too dim to be worth a ray at a secondary vertex: dropped (half-crediting it unshadowed leaked far panels through walls once their range grew)
    if (occluded(Po, ev.L, ev.dist.x - 0.02, skipOwner | ((li.owner & 0xffu) << 8u))) { continue; }
    E += ev.E;
  }
  return E;
}

// ---- torch bounce cards (FLAG_BOUNCE_CARDS) ----
// Is the surface point x (normal nx) inside a card's claim region W, given the card's rows c0 = (C, R) and c1 = (n, ·) (cards.wgsl)? Within
// CARD_PLANE_EPS of the card's plane, facing the way the card faces, inside radius R about C (in the plane). The ONE predicate both sides use —
// cards.wgsl to decide which of the light's flux the card claims, fgather.wgsl to decide where that light's direct term is excluded — so the
// claimed flux and the excluded region agree whatever R is. R = 0 (no card) is never inside.
const CARD_PLANE_EPS: f32 = 0.025;
const CARD_COS_MIN: f32 = 0.8;
fn onCard(x: vec3f, nx: vec3f, c0: vec4f, c1: vec4f) -> bool {
  let d = x - c0.xyz; let h = dot(d, c1.xyz);
  return c0.w > 0.0 && abs(h) < CARD_PLANE_EPS && dot(nx, c1.xyz) > CARD_COS_MIN && dot(d, d) - h * h < c0.w * c0.w;
}

// ---- glass panes (FLAG_GLASS): analytic tests against SceneInfo.glass — the panes live in no traced structure, so every traced ray in the frame passes
// them for free; the three places that care (composite: what the eye sees through / in a pane; fgather: the mirror ray off it; direct: light that crossed
// one) ask here. A pane is a thin yawed box: (centre, cos yaw), (half, sin yaw), (tint, box index). ≤ MAX_GLASS slab tests on uniform data per call.
// ---- GLASS BREAKING (game/glassbreak.ts + game/glassPattern.ts; only ever CALLED inside `if (GLASS_BREAK)` blocks — the prelude const, false = the module as it was): per
// SceneInfo.glass slot k a record of GB_STRIDE vec4 rows in boxMat's tail after the marking table (GB_BASE, generated into the prelude by render/frame.ts; boxes.ts packGlass ←
// glassbreak.ts fill(), the layout's one writer): row 0 = (site count n ≤ 8, flags: 1 something is open · 2 the pane has RUN · 4 dicing · 8 gone · 16 web, u axis: 0 = the
// pane's local x spans it / 1 = local z, damage 0‥1), row 1 = (hu, hv, type, 0), row 2 = the dice wave (the blow's u, v, the open threshold on a clump's key, grain), row 3 = (dice cols, rows, seed, 0),
// then 4 rows per site: (u, v, rot, ring-zone radius) · (radials, 24-bit seed, energy, merge share) · the four rho · the open-piece masks (bands 0 | 1 << 12, 2 | 3 << 12,
// 4 | 5 << 12, 6). The functions below are glassPattern.ts's statement for statement — a blow's SITE cuts the glass round it into pieces (sector s between radial cracks s and
// s+1; band 0 the crater, 1‥2 the ring pieces between the chords, 3‥6 the daggers: near / far of the sector's left and right half), territories are the power diagram of the
// sites — and a piece whose bit is set has fallen out: every ray then passes that part of the pane as if no glass were there (view, mirror, light), which is the hole; the CPU's
// raycast / segment tests ask glassbreak.ts openAt, the same rule. A DICING tempered pane (flag 4) opens by clumps instead: the cells of a jittered lattice (gbClumpKey).
const GB_STRIDE: u32 = 36u;
const GB_HDR: u32 = 4u;
const GP_ANG_JIT: f32 = 0.6;
const GP_RHO_LO: f32 = 0.78;
const GP_RHO_SPAN: f32 = 0.44;
const GP_SPLIT_LO: f32 = 0.35;
const GP_SPLIT_SPAN: f32 = 0.3;
const GP_CUT_NONE: f32 = 0.45;
const GP_CUT_LO: f32 = 0.9;
const GP_CUT_SPAN: f32 = 1.0;
const GP_CUT_TILT: f32 = 0.9;
const GP_C2_DRAWN: f32 = 0.45;
const GP_WEB_RING: f32 = 0.45;
const GP_DICE_JIT: f32 = 0.6;
const GP_DICE_DELAY: f32 = 1.4;
const GP_TAU: f32 = 6.283185307179586;
struct GbSite { c: vec2f, rot: f32, rz: f32, n: u32, seed: u32, e: f32, merge: f32, rho: vec4f, m: vec4f };
fn gbRow(k: u32, r: u32) -> vec4f { return boxMat[GB_BASE + k * GB_STRIDE + r]; }
fn gbHeader(k: u32) -> vec4f { return gbRow(k, 0u); }
fn gbSiteLoad(k: u32, i: u32) -> GbSite {
  let o = GB_HDR + i * 4u; let a = gbRow(k, o); let b = gbRow(k, o + 1u);
  var S: GbSite; S.c = a.xy; S.rot = a.z; S.rz = a.w; S.n = clamp(u32(b.x + 0.5), 3u, 12u); S.seed = u32(b.y); S.e = b.z; S.merge = b.w; S.rho = gbRow(k, o + 2u); S.m = gbRow(k, o + 3u);
  return S;
}
/** glassPattern.ts gpHash: (seed, a, b) → 24 bits */
fn gpHash(seed: u32, a: u32, b: u32) -> u32 {
  var h = seed ^ ((a + 1u) * 0x9E3779B1u) ^ ((b + 1u) * 0x85EBCA77u);
  h = (h ^ (h >> 15u)) * 0x2C1B3C6Du;
  h = (h ^ (h >> 12u)) * 0x297A2D39u;
  return (h ^ (h >> 15u)) >> 8u;
}
fn gpJit(seed: u32, a: u32, b: u32) -> f32 { return f32(gpHash(seed, a, b)) / 16777216.0; }
fn gpWrap(k: i32, n: u32) -> u32 { return u32(k + i32(n)) % n; }   // (k in −1 ‥ n)
/** where radial k sits, in sectors */
fn gpBound(S: GbSite, k: i32) -> f32 { return f32(k) + GP_ANG_JIT * (gpJit(S.seed, gpWrap(k, S.n), 7u) - 0.5); }
fn gpAngle(S: GbSite, k: i32) -> f32 { return S.rot + GP_TAU * gpBound(S, k) / f32(S.n); }
fn gpRho(S: GbSite, k: i32, b: u32) -> f32 { return S.rho[b] * (GP_RHO_LO + GP_RHO_SPAN * gpJit(S.seed, gpWrap(k, S.n), b)); }
fn gpChordPt(S: GbSite, k: i32, b: u32) -> vec2f { let a = gpAngle(S, k); return S.c + gpRho(S, k, b) * vec2f(cos(a), sin(a)); }
/** past chord b of sector s (the side away from the site)? */
fn gpBeyond(S: GbSite, s: i32, b: u32, uv: vec2f) -> bool { let A = gpChordPt(S, s, b); let B = gpChordPt(S, s + 1, b); return (B.x - A.x) * (uv.y - A.y) - (B.y - A.y) * (uv.x - A.x) < 0.0; }
fn gpMerged(S: GbSite, s: u32) -> bool { return gpJit(S.seed, s, 21u) < S.merge; }
/** where sector s's branch crack sits, in sectors */
fn gpSplit(S: GbSite, s: i32) -> f32 { let b0 = gpBound(S, s); let b1 = gpBound(S, s + 1); return b0 + (b1 - b0) * (GP_SPLIT_LO + GP_SPLIT_SPAN * gpJit(S.seed, u32(s), 23u)); }
/** the snap across half h of sector s: (point, unit normal away from the site); .z of the second = 0 when this dagger runs unbroken */
struct GpCut { p: vec2f, n: vec2f, on: bool };
fn gpCut(S: GbSite, s: i32, h: u32) -> GpCut {
  var c: GpCut; c.on = !(gpJit(S.seed, u32(s), 27u + h) < GP_CUT_NONE); c.p = S.c; c.n = vec2f(1.0, 0.0);
  if (!c.on) { return c; }
  let sp = gpSplit(S, s); let mid = select((sp + gpBound(S, s + 1)) * 0.5, (gpBound(S, s) + sp) * 0.5, h == 0u);
  let am = S.rot + GP_TAU * mid / f32(S.n); let rc = S.rho.w * (GP_CUT_LO + GP_CUT_SPAN * gpJit(S.seed, u32(s), 25u + h));
  let an = am + (gpJit(S.seed, u32(s), 29u + h) - 0.5) * GP_CUT_TILT;
  c.p = S.c + rc * vec2f(cos(am), sin(am)); c.n = vec2f(cos(an), sin(an));
  return c;
}
/** the sector (.x) of pane point uv round site S and its position across the fan in sectors (.y) */
fn gpSector(S: GbSite, uv: vec2f) -> vec2f {
  let d = uv - S.c; let n = i32(S.n);
  if (dot(d, d) < 1e-12) { return vec2f(0.0, max(0.0, gpBound(S, 0))); }
  var t = (atan2(d.y, d.x) - S.rot) / GP_TAU; t = (t - floor(t)) * f32(n);
  let s0 = min(n - 1, i32(floor(t)));
  if (t < gpBound(S, s0)) { if (s0 == 0) { return vec2f(f32(n - 1), t + f32(n)); } return vec2f(f32(s0 - 1), t); }
  if (t >= gpBound(S, s0 + 1)) { if (s0 == n - 1) { return vec2f(0.0, t - f32(n)); } return vec2f(f32(s0 + 1), t); }
  return vec2f(f32(s0), t);
}
/** the sector (.x) and band (.y, 0‥6) of pane point uv round site S */
fn gpSectorBand(S: GbSite, uv: vec2f) -> vec2u {
  let st = gpSector(S, uv); let s = i32(st.x + 0.5); let su = u32(s);
  if (!gpBeyond(S, s, 0u, uv)) { return vec2u(su, 0u); }
  let merged = gpMerged(S, su);
  if (!merged && !gpBeyond(S, s, 1u, uv)) { return vec2u(su, 1u); }
  if (!gpBeyond(S, s, 2u, uv)) { return vec2u(su, select(2u, 1u, merged)); }
  let h = select(0u, 1u, st.y >= gpSplit(S, s)); let c = gpCut(S, s, h);
  return vec2u(su, select(3u, 5u, c.on && dot(c.n, uv - c.p) > 0.0) + h);
}
/** whose territory uv is in: the least power distance |p − c|² − rz² (n ≥ 1) */
fn gbNearest(k: u32, n: u32, uv: vec2f) -> u32 {
  var bi = 0u; var bd = 1e30;
  for (var i = 0u; i < n; i++) { let a = gbRow(k, GB_HDR + i * 4u); let q = uv - a.xy; let d = dot(q, q) - a.w * a.w; if (d < bd) { bd = d; bi = i; } }
  return bi;
}
/** is piece (sector s, band b) of site S out? */
fn gbPieceOpen(S: GbSite, s: u32, b: u32) -> bool {
  let w = u32(S.m[b >> 1u]);   // (packed integers are exact in f32; + 0.5 would round a 24-bit odd word up — markings.wgsl's rule)
  return ((w >> (s + 12u * (b & 1u))) & 1u) == 1u;
}
/** pane-local point (glassTrace's frame: Rᵀ·(X − c)) → the record's (u, v) */
fn gbUV(k: u32, lp: vec3f) -> vec2f { return select(vec2f(lp.x, lp.y), vec2f(lp.z, lp.y), gbHeader(k).z > 0.5); }
fn gbLocal(k: u32, X: vec3f) -> vec3f { let p0 = scene.glass[k * 3u]; let p1 = scene.glass[k * 3u + 1u]; let p = X - p0.xyz; return vec3f(p0.w * p.x - p1.w * p.z, p.y, p1.w * p.x + p0.w * p.z); }
/** the centre of dice clump (c, r) of pane k (glassPattern.ts gpDiceCentre): its lattice cell's centre, jittered */
fn gbClumpCentre(hh: vec2f, g: vec2f, seed: u32, c: u32, r: u32) -> vec2f {
  return -hh + (vec2f(f32(c), f32(r)) + 0.5 + GP_DICE_JIT * (vec2f(gpJit(seed, c, r), gpJit(seed ^ 0x5bd1e9u, c, r)) - 0.5)) * 2.0 * hh / g;
}
/** the order key of the dice clump holding uv (gpDiceClump + gpDiceKey): the nearest jittered centre among the 3 × 3 cells round uv's own, then metres from the blow to it + its hashed delay */
fn gbClumpKey(k: u32, uv: vec2f) -> f32 {
  let hh = gbRow(k, 1u).xy; let d3 = gbRow(k, 3u); let g = max(d3.xy, vec2f(1.0)); let seed = u32(d3.z); let blow = gbRow(k, 2u).xy;
  let c0 = vec2i(clamp(floor((uv + hh) / (2.0 * hh) * g), vec2f(0.0), g - 1.0)); let gi = vec2i(g + 0.5);
  var best = vec2u(c0); var bp = vec2f(0.0); var bd = 1e30;
  for (var r = max(0, c0.y - 1); r <= min(gi.y - 1, c0.y + 1); r++) { for (var c = max(0, c0.x - 1); c <= min(gi.x - 1, c0.x + 1); c++) {
    let p = gbClumpCentre(hh, g, seed, u32(c), u32(r)); let q = p - uv; let d = dot(q, q);
    if (d < bd) { bd = d; best = vec2u(u32(c), u32(r)); bp = p; }
  } }
  let cell = min(2.0 * hh.x / g.x, 2.0 * hh.y / g.y);
  return distance(bp, blow) + GP_DICE_DELAY * cell * gpJit(seed ^ 0x3c6ef3u, best.x, best.y);
}
/** has the glass of pane k at pane point uv fallen out? (flags = the header's) */
fn gbOpenUV(k: u32, fl: u32, n: u32, uv: vec2f) -> bool {
  if ((fl & 1u) == 0u) { return false; }
  if ((fl & 8u) != 0u) { return true; }
  if ((fl & 4u) != 0u) { return gbClumpKey(k, uv) < gbRow(k, 2u).z; }   // a tempered pane letting go: the clumps the wave has reached
  if (n == 0u) { return false; }
  let S = gbSiteLoad(k, gbNearest(k, n, uv)); let sb = gpSectorBand(S, uv);
  if (sb.y >= 3u && (fl & 2u) == 0u) { return false; }   // the uncut sheet beyond the rings of a pane that has not run
  return gbPieceOpen(S, sb.x, sb.y);
}
/** has the part of pane k at local point lp fallen out? (a whole pane — nothing open — answers in one fetch) */
fn glassCellOpen(k: u32, lp: vec3f) -> bool {
  let h = gbHeader(k); let fl = u32(h.y + 0.5);
  if ((fl & 1u) == 0u) { return false; }
  return gbOpenUV(k, fl, min(u32(h.x + 0.5), 8u), gbUV(k, lp));
}
struct GlassHit { t: f32, idx: i32, n: vec3f, tint: vec3f, trans: vec3f };   // nearest crossing in (tmin, tmax): distance, pane slot (−1 = none), the entered face's WORLD normal (toward the origin's side), that pane's tint; trans = product of the tints of EVERY pane crossed in range (1 = none) — two panes in line tint twice, reflect once
fn glassCount() -> u32 { return select(0u, min(scene.glassInfo.x, MAX_GLASS), (frame.flags & FLAG_GLASS) != 0u); }
fn glassTrace(ro: vec3f, rd: vec3f, tmin: f32, tmax: f32) -> GlassHit {
  var g: GlassHit; g.t = tmax; g.idx = -1; g.n = vec3f(0.0, 1.0, 0.0); g.tint = vec3f(1.0); g.trans = vec3f(1.0);
  let n = glassCount();
  for (var k = 0u; k < n; k++) {
    let p0 = scene.glass[k * 3u]; let p1 = scene.glass[k * 3u + 1u];
    let cs = vec2f(p0.w, p1.w);                                     // cos, sin of the pane's yaw (isectBox's convention: local = Rᵀ · world)
    let p = ro - p0.xyz;
    let lo = vec3f(cs.x * p.x - cs.y * p.z, p.y, cs.y * p.x + cs.x * p.z);
    let ld = vec3f(cs.x * rd.x - cs.y * rd.z, rd.y, cs.y * rd.x + cs.x * rd.z);
    let inv = safeInv(ld);
    let tA = (-p1.xyz - lo) * inv; let tB = (p1.xyz - lo) * inv;
    let tmn = min(tA, tB); let tmx = max(tA, tB);
    let tN = max(max(tmn.x, tmn.y), tmn.z); let tF = min(min(tmx.x, tmx.y), tmx.z);
    if (tN > tF || tN <= tmin || tN >= tmax) { continue; }        // a miss, behind / at the origin (an origin INSIDE the pane sees no pane), or past the segment's end
    if (GLASS_BREAK) { if (glassCellOpen(k, lo + ld * tN)) { continue; } }   // GLASS BREAKING: this part of the pane has fallen out — no glass on the ray here
    let tint = scene.glass[k * 3u + 2u].xyz;
    g.trans *= tint;
    if (tN < g.t) {
      g.t = tN; g.idx = i32(k); g.tint = tint;
      var ln = vec3f(0.0);                                          // entered face: the axis whose near slab came last, facing back at the ray
      if (tN == tmn.x) { ln.x = -sign(ld.x); } else if (tN == tmn.y) { ln.y = -sign(ld.y); } else { ln.z = -sign(ld.z); }
      g.n = vec3f(cs.x * ln.x + cs.y * ln.z, ln.y, -cs.y * ln.x + cs.x * ln.z);   // local +x → (cos, 0, −sin), +z → (sin, 0, cos), as boxNormalFromCode
    }
  }
  return g;
}
/** Transmittance only (no normal, no nearest): the tint product of every pane in `mask` (bit k = pane k; direct.wgsl culls per tile) crossed strictly inside (tmin, tmax). */
fn glassTransmit(ro: vec3f, rd: vec3f, tmin: f32, tmax: f32, maskIn: u32) -> vec3f {
  var tr = vec3f(1.0);
  let n = glassCount();
  var mask = maskIn & select(0xffffffffu, (1u << n) - 1u, n < 32u);
  while (mask != 0u) {
    let k = countTrailingZeros(mask); mask = mask & (mask - 1u);
    let p0 = scene.glass[k * 3u]; let p1 = scene.glass[k * 3u + 1u];
    let cs = vec2f(p0.w, p1.w);
    let p = ro - p0.xyz;
    let lo = vec3f(cs.x * p.x - cs.y * p.z, p.y, cs.y * p.x + cs.x * p.z);
    let ld = vec3f(cs.x * rd.x - cs.y * rd.z, rd.y, cs.y * rd.x + cs.x * rd.z);
    let inv = safeInv(ld);
    let tA = (-p1.xyz - lo) * inv; let tB = (p1.xyz - lo) * inv;
    let tmn = min(tA, tB); let tmx = max(tA, tB);
    let tN = max(max(tmn.x, tmn.y), tmn.z); let tF = min(min(tmx.x, tmx.y), tmx.z);
    if (tN > tF || tN <= tmin || tN >= tmax) { continue; }
    if (GLASS_BREAK) { if (glassCellOpen(k, lo + ld * tN)) { continue; } }   // (GLASS BREAKING: light through the hole, untinted)
    tr *= scene.glass[k * 3u + 2u].xyz;
  }
  return tr;
}
/** Schlick's Fresnel for glass (n = 1.5 → F0 = 0.04) at cosine `c` of the angle between the ray and the pane normal. */
fn glassFresnel(c: f32) -> f32 { let u = 1.0 - clamp(c, 0.0, 1.0); let u2 = u * u; return 0.04 + 0.96 * u2 * u2 * u; }

// ---- misc ----
fn luminance(c: vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }

fn worldFromDepth(pix: vec2f, depth: f32) -> vec3f {
  let ndc = vec4f(pix * frame.invScreen * vec2f(2.0, -2.0) + vec2f(-1.0, 1.0), depth, 1.0);
  let w = frame.invViewProj * ndc;
  return w.xyz / w.w;
}

// ---- froxel volumetrics (FLAG_FROXEL_VOL): the one mapping every producer / consumer of the volume shares (render/froxels.ts fills frame.froxelA/B/C) ----
// The grid is W × H over the screen (froxel (ix, iy) covers uv [ix/W, (ix+1)/W) — the same uv the G-buffer's pixels have, jitter and all) × D slices in
// DISTANCE ALONG THE PIXEL'S OWN RAY from the eye (radial, what `distance(P, camPos)` gives a consumer): slice boundary s (0‥D, continuous) sits at
//   d(s) = near + (far − near) · (e^{a·s/D} − 1) / (e^a − 1)      — thickness grows by e^a from the first slice to the last (a → 0: uniform)
// A texel of the INTEGRATED volume (slice k, centre w = (k + ½)/D) holds (rgb = in-scatter reaching the eye from everything nearer than boundary k+1,
// a = transmittance of that stretch), so what lies in front of a surface at distance d is the trilinear sample at w = (s(d) − ½)/D — one fetch.
fn froxelCurveA() -> f32 { return max(frame.froxelA.z, 1e-3); }
fn froxelDist(s: f32) -> f32 { let a = froxelCurveA(); return frame.froxelA.x + (frame.froxelA.y - frame.froxelA.x) * (exp(a * s / f32(frame.froxelB.z)) - 1.0) / (exp(a) - 1.0); }
fn froxelSliceN(d: f32, near: f32) -> f32 { let a = froxelCurveA(); let u = (d - near) / (frame.froxelA.y - near) * (exp(a) - 1.0); return f32(frame.froxelB.z) / a * log(max(1.0 + u, 1e-6)); }
fn froxelSlice(d: f32) -> f32 { return froxelSliceN(d, frame.froxelA.x); }
/** the slice coordinate distance d had in LAST frame's volume (its near boundary rode last frame's camera height: frame.prevCam.w) — the history's reprojection */
fn froxelSlicePrev(d: f32) -> f32 { return froxelSliceN(d, frame.prevCam.w); }
/** unit direction of the eye ray through screen uv (0‥1, y down — a G-buffer pixel's uv is (pix + ½) · invScreen) */
fn froxelDir(uv: vec2f) -> vec3f { return normalize(worldFromDepth(uv * frame.screen, 1.0) - frame.camPos); }
/** (in-scatter rgb, transmittance a) between the eye and distance `dist` along the ray through `uv`, from the integrated froxel volume `vt` — biased frame.froxelC.w
 *  slices toward the eye so a surface never collects scatter injected behind it (the froxel it sits in straddles it). ACROSS the screen the fetch is a cubic
 *  B-spline (four trilinear taps — Sigg & Hadwiger's offsets): a froxel is a dozen pixels wide, and the trilinear kernel alone shows every froxel boundary as
 *  a crease along a beam's edge; the B-spline is C² across them (softer by half a froxel, never creased). Along the ray it stays linear (that axis is the eye's own). */
fn froxelW(vt: texture_3d<f32>, uv: vec2f, w: f32) -> vec4f {
  let G = vec2f(frame.froxelB.xy);
  let tc = uv * G - 0.5; let it = floor(tc); let f = tc - it;
  let f2 = f * f; let f3 = f2 * f;
  let w0 = (1.0 / 6.0) * (-f3 + 3.0 * f2 - 3.0 * f + 1.0); let w1 = (1.0 / 6.0) * (3.0 * f3 - 6.0 * f2 + 4.0);
  let w2 = (1.0 / 6.0) * (-3.0 * f3 + 3.0 * f2 + 3.0 * f + 1.0); let w3 = (1.0 / 6.0) * f3;
  let g0 = w0 + w1; let g1 = w2 + w3;
  let h0 = (it - 0.5 + w1 / g0) / G; let h1 = (it + 1.5 + w3 / g1) / G;   // (texel centres sit at (i + ½) / G)
  return g0.y * (g0.x * textureSampleLevel(vt, linSamp, vec3f(h0.x, h0.y, w), 0.0) + g1.x * textureSampleLevel(vt, linSamp, vec3f(h1.x, h0.y, w), 0.0))
       + g1.y * (g0.x * textureSampleLevel(vt, linSamp, vec3f(h0.x, h1.y, w), 0.0) + g1.x * textureSampleLevel(vt, linSamp, vec3f(h1.x, h1.y, w), 0.0));
}
fn froxelFetch(vt: texture_3d<f32>, uv: vec2f, dist: f32) -> vec4f {
  let D = f32(frame.froxelB.z);
  let s = clamp(froxelSlice(dist) - frame.froxelC.w, 0.0, D);
  let w = (max(s, 1.0) - 0.5) / D;
  var v: vec4f;
  if ((frame.froxelB.w & 256u) != 0u) { v = textureSampleLevel(vt, linSamp, vec3f(uv, w), 0.0); } else { v = froxelW(vt, uv, w); }
  if (s < 1.0) { return mix(vec4f(0.0, 0.0, 0.0, 1.0), v, s); }   // inside the first slice: between nothing and its far boundary
  return v;
}

// Octahedral mapping: unit dir <-> [0,1]^2
fn octEncode(n: vec3f) -> vec2f {
  let p = n.xz / (abs(n.x) + abs(n.y) + abs(n.z));
  let q = select(p, (1.0 - abs(p.yx)) * select(vec2f(-1.0), vec2f(1.0), p >= vec2f(0.0)), n.y < 0.0);
  return q * 0.5 + 0.5;
}
fn octDecode(uv: vec2f) -> vec3f {
  let f = uv * 2.0 - 1.0;
  var n = vec3f(f.x, 1.0 - abs(f.x) - abs(f.y), f.y);
  let t = clamp(-n.y, 0.0, 1.0);
  n.x += select(t, -t, n.x >= 0.0);
  n.z += select(t, -t, n.z >= 0.0);
  return normalize(n);
}

fn hash13(p: vec3f) -> f32 { var q = fract(p * 0.1031); q += dot(q, q.zyx + 31.32); return fract((q.x + q.y) * q.z); }
fn ign(pix: vec2f) -> f32 { return fract(52.9829189 * fract(0.06711056 * pix.x + 0.00583715 * pix.y)); }
