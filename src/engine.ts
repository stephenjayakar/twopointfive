// Renderer orchestration: owns GPU resources and encodes the frame.
import { Gpu, makeBuffer } from './gpu/device';
import { GpuTimer } from './gpu/timer';
import { BoxWorld } from './scene/boxes';
import { FRAME_BYTES, MAX_CARDS, FrameFlags, FrameParams, createSceneBindGroup, createSceneLayout, writeFrame, writeFrameOut, reachBinding, meshBinding, WeatherFrame, noWeather } from './render/frame';
import { GBuffer, SkinnedDrawable } from './render/gbuffer';
import { RadianceCascades, RcConfig, defaultRcConfig } from './render/rc';
import { LightingPasses } from './render/passes';
import { LightSet, cardSlotsFor } from './render/lights';
import { MeshShadows, MESH_MAX_CHARS } from './render/meshShadows';
import { RigFit, RIG_KPAD } from './render/sdfrig';
import { Decals } from './render/decals';
import { Particles } from './render/particles';
import { TexturePool } from './render/texpool';
import { reachLevel } from './render/reach';
import { WORLD } from './scene/world';
import { FollowCamera } from './game/camera';
import { Vec3, m4, v3 } from './math/vec';

export interface RenderSettings {
  renderScale: number;      // internal resolution relative to what this window gets at the cap: internal height = min(maxInternalHeight, CSS height × dpr) × renderScale — 1.0 = the cap, every step below it is real (Engine.resize)
  maxInternalHeight: number; // cap on internal render height in pixels (keeps cost bounded on big windows) = the preset's resolution: what renderScale 1.0 renders on any window at least that tall in device pixels
  // ---- TAAU (renderer v3 phase 1, render/shaders/taau.wgsl): temporal anti-aliasing with upsampling. On: the scene is rendered at the internal size under a sub-pixel Halton(2,3) jitter of the
  // projection (the g-buffer AND every screen pass that reconstructs a ray from a pixel see the same jittered matrices — frame.viewProj / invViewProj ARE the jittered ones), and a resolve pass
  // folds each frame into an OUTPUT-resolution history (output = what render scale 1.0 would render: min(maxInternalHeight, CSS height × dpr) rows — the canvas backing store; the browser scales
  // that to the window as it always did) which the bloom, the tonemap and a sharpen + grain blit then read. Off (?notaau): no jitter, output = internal, FXAA + the browser's bilinear — the old chain
  // byte for byte.
  taau: boolean;
  taauAlpha: number;         // base new-frame weight (0.1 ≈ ten frames of memory where nothing moves)
  taauClipGamma: number;     // history clip box half-width in σ of the frame's 3×3 neighbourhood (1.0 tight … 1.5 loose: looser = smoother + more ghosting)
  taauPhases: number;        // jitter cycle length (8; 16 spreads samples finer for the deeper upscales); 0 = no jitter (TAA degenerates to a temporal blur of an aliased picture — for A/B only)
  taauSharpen: number;       // RCAS-style contrast-adaptive sharpen in the final blit, 0‥1 (the resolve's reconstruction kernel is a touch soft by design; this puts the bite back)
  taauReactive: number;      // × the reactive inputs (particles' mask, rain share): how far they push a pixel toward this frame (0 = ignore: sparks and rain streaks then ghost / dim under the history)
  taauKernel: number;        // current-frame reconstruction kernel sharpness k: w = exp(−|d|² k), d in output pixels (2.0 ≈ σ 0.5 px; higher = sharper + more aliasing carried per frame)
  taauVelK: number;          // how much fast on-screen motion raises the new-frame weight (0‥1)
  taauMotionAlpha: number;   // MOTION SHARPNESS (docs/internal/tjank.md §vi): the new-frame weight a pixel reprojected at ≥ ½ output px / frame is raised to (0.1 still → this; ramp from ⅛ px / frame): a
                             // resampled history is a blur in motion, and noise in motion reads far less than blur in motion. 0 = off (the old 0.25-at-24-px rule alone)
  taauMotionClip: number;    // A/B, default 0: the share the clip box narrows by at that speed (γσ × (1 − this)) — measured to add nothing to the edge-spread the weight term buys (docs/internal/tjank.md §vi)
  taauSharpenMotion: number; // … and what the final blit's RCAS sharpen gains while the CAMERA moves (the follow camera pans / orbits the whole picture: its look-at point's own screen motion, full at
                             // ½ output px / frame at any of five points round the look-at): taauSharpen + this × that. 0 = off
  taauHistSharp: number;     // C2 (image-quality program): the history de-blur under motion — the Catmull-Rom fetch plus this × (it − a bilinear fetch) while the pixel is being resampled; 0 = off (main's fetch)
  taauLightJump: number;     // A/B, default OFF (1): a lighting change under a still surface (this frame's 3×3 mean ÷ the history in linear luminance, either way) past this ratio takes the new frame at
                             // ≥ ½. Built for the lightning / flicker note and measured to buy nothing there (docs/internal/tjank.md: the resolve's share of a stroke's first frame is 13 % of the
                             // step, and the clip already follows a switched level within 3 %) — kept as a row for the next look at it, not shipped on
  // ---- SHARP DIRECT (decoupled resolution; render/gbuffer.ts encodeDown, render/shaders/sharp_direct.wgsl, composite.wgsl's compute twin, docs/internal/sharp-direct.md): under TAAU at a render scale
  // below 1, rasterise the g-buffer and run the direct light's UNSHADOWED term (every light's analytic contribution: exact, history-free), the albedo / emissive / glass / decal composite and the TAA at
  // the OUTPUT size, keep everything stochastic — the shadow RATIO per emitter class, the gather's irradiance + specular, the reflections, the volumetric march — at the internal size and joint-bilateral
  // upsample it: light pools, cone edges, box edges and print come out native-sharp, penumbrae and bounce stay as soft as they are. Off (?nosharp), TAAU off, a debug view up, or scale 1.0 = every pass
  // exactly as it was.
  sharpDirect: boolean;
  sharpDecouple: boolean;    // DECOUPLED JITTER (image-quality program C3j, sharp direct only): the OUTPUT raster — g-buffer, U, composite, GBAA, the 1 : 1 resolve — runs UNJITTERED (a rock-still picture for the
                             // analytic edge AA) while the INTERNAL raster the stochastic terms live on keeps a ±½ internal-px Halton jitter, so a hard shadow edge computed at internal resolution is still
                             // supersampled across frames and settles smooth in the resolve's history instead of a stair-step. Off = one jitter for both rasters (the sharp path as it was)
  sharpEdgeRays: boolean;    // sharp direct EXPERIMENT (default off): where a hard shadow edge lies within ±2 internal px of an output pixel's taps (sharp_edge.wgsl's mask: the class's visibility ratio ranges by > sharpEdgeSpread
                             // there while every SHADOWED pixel that holds a penumbra hint holds one under sharpEdgeHintPx), one deterministic shadow ray from the output pixel to the CENTRE of the class's strongest emitter decides that
                             // light exactly (binary, at the output resolution; the jitter + TAA antialias it) and only the class's live remainder takes the upsampled ratio — a keyboard's contact shadow goes to 1.6 px. Off = the ratio everywhere
  sharpEdgeSpread: number; sharpEdgeHintPx: number;
  sharpPlaneK: number;       // the ratio upsample's same-plane weight e^(−plane distance ∕ (view distance · k)): 0.01 = a tap a centimetre off this pixel's tangent plane per metre of distance still weighs 0.37
  // ---- DIRECT-QUALITY (lane v3/direct-quality, docs/internal/direct-quality.md): the sharp path's SLIVER rule, GBAA's same-surface clamp, the flash / jump ray budget ----
  sharpSliver: number;       // sharp direct: what an output pixel with NO internal tap on its own surface does (a sliver the internal raster never sampled — a door frame's reveal, a chair leg, a limb's edge):
                             // 0 = borrow the 2×2's ratio whatever surface it lies on (the sharp path as it was: a lit neighbour lends 'lit' to an occluded sliver — the bright line down a door frame in a dark corridor);
                             // 1 = SAME-SURFACE ONLY: nothing is borrowed across surfaces — per class ONE deterministic shadow ray from the output pixel to the strongest live emitter decides that light, the class's
                             // remainder takes the darker of (the neighbours' luminance ratio, lit) — both classes off the same texels and the same rule, so no warm / cool fringe either (sharp_direct.wgsl SLIVER)
  sharpSliverCap: number;    // per 8×8 output tile, at most this many sliver pixels trace (the rest take the conservative remainder rule with no ray) — a bound on the worst case, not a look knob (0 = no rays: the conservative rule everywhere)
  sharpDiag: number;         // diagnostic paint (0 off): 1 = sliver pixels magenta, ring-fallback pixels yellow, in the direct term (docs/review/direct-quality.html's overlays); the fallback CODE always rides in sharpE's alpha for readback either way
  gbaaClamp: boolean;        // GBAA: blend an edge pixel only toward a neighbour AT or BEHIND it (the far side of a silhouette, the other face of a crease) — never toward a NEARER third surface standing over the edge (a man in
                             // front of a partition's top edge took half his colour into the edge pixel: a rim along him). Off = Persson's blend as it was
  restirHueSplit: boolean;   // ReSTIR shade (restir.wgsl HUE SPLIT): the believed-visible mix colours only the luminance its own lights carried; a sample of a light this pixel does not believe visible (tile-dark here / its darkSlot)
                             // keeps its own hue — without it a blocked light's penumbra deep in its own shadow was painted in whatever far dim light the tile still believed (green exit-sign fringes along a blue lamp's shadow, S3). false = as it was
  heldRays: number;          // THE HYBRID ESTIMATOR (restir.wgsl HELD): every light a character CARRIES (owner byte ≠ 0 — the guards' torches, Sam's rail / gun light, muzzle flashes, tracer heads) bypasses the
                             // reservoirs at the pixels it reaches and gets the old leader treatment every frame — the two strongest at the pixel take this many STRATIFIED emitter samples each and are shaded
                             // exactly (E × mean visibility), further ones one importance-picked tail ray a class; static lights (owner 0) keep ReSTIR. A carried light moves every frame: its reservoir history
                             // and the shadow client's ratio history are let go wherever its cone sweeps, and the pool was shaded from one or two fresh rays ('the flashlight direct lighting seems like a huge
                             // regression now. very noisy and lots of rims'; ?norestir 'looks great' — the designer at high). 0 = off: the transient stratum exactly as it was. Tiered (quality.ts Preset.restir.held)
  // ---- THE DENOISER (renderer v3 phase 3, render/denoise.ts + shaders/denoise.wgsl): 'v3' = one core (reprojection with the g-buffer's motion vectors + per-tap depth validation, luminance
  // moments → variance, history length, neighbourhood clamp, variance-guided edge-stopped à-trous) behind three clients — the direct pass's shadow ratio per emitter class (full res), the
  // gather's diffuse irradiance and its specular field (gather res); 'legacy' = dtemporal + softblur, temporal + giblur and the gloss chain exactly as they were (?legacydenoise). The dn*
  // knobs are the v3 clients' (iterations / history caps per tier from ui/quality.ts; Tab ▸ Denoiser rows); directPasses / directHistory / directBlurCap keep their legacy meaning, and
  // under v3 directHistory > 0 is the shadow client's temporal switch, directBlurCap its penumbra-width cap.
  denoiser: 'v3' | 'legacy';
  dnShadowIters: number; dnShadowCap: number; dnShadowClampK: number; dnShadowSigmaL: number; dnShadowPrior: boolean; dnShadowLitAlike: boolean; dnShadowMoveCap: number; dnShadowMoveThresh: number; dnShadowJump: number;
  dnGiIters: number; dnGiCap: number; dnGiClampK: number; dnGiSigmaL: number; dnGiFast: number; dnGiFirefly: number;
  // ---- GI IN MOTION (docs/internal/gi-motion.md; the v3 diffuse client only): giFullRes = the diffuse GI is upsampled (guided) to the INTERNAL resolution first and accumulated / clamped / à-trous
  // filtered there (history at internal res: reprojection error one internal pixel instead of one gather texel, blotch size likewise), composite reading it 1 : 1 — false = the gather-grid chain
  // exactly as it was; giFullIters = its à-trous iterations at internal res (strides gdiv·1, 2, 4, 8: the same ground reach as the gather-grid chain's); giYoungRays = the final gather's ray
  // multiplier for texels whose diffuse history is YOUNG (disoccluded: Sam's wake, a walking man's outline, the screen edge under a pan; ≤ 1 = off, the gather byte for byte as it was),
  // giYoungCap = the fraction of the gather grid that may take it in one frame (the rest first-come), giYoungLen = 'young' = history length under this (frames)
  giFullRes: boolean; giFullIters: number; giYoungRays: number; giYoungCap: number; giYoungLen: number;
  // (D) two follow-ups on the diffuse client (both 0 = off, the client as it was): dnGiClampCut = a valid pixel whose long history the clamp had to DRAG (its bounce changed) has its length cut by how far,
  // relative to the box (the reflection chain's rule) — the next frames weigh the fresh estimate more and the young-history rays fire there; dnGiYoungWiden = the à-trous luminance edge-stop × (1 + it) on
  // texels whose history is young (steadier while one or two frames stand behind the estimate)
  dnGiClampCut: number; dnGiYoungWiden: number;
  // the runtime quality ladder's HEADROOM-AWARE CLIMB (ui/quality.ts Quality.sample): with adaptive resolution on and the GPU measurably idle (presented at the display rate AND the compute passes'
  // union under CLIMB.headroom of the frame budget for CLIMB.window s) the render scale climbs ABOVE the tier's starting scale in 0.05 steps up to 1.0, then the lossy divisors relax (gather ⅓ → ½,
  // volumetrics ¼ → ½); capClimb = past that, the output cap itself climbs toward the window's device rows in 100-row steps (costs the per-OUTPUT-pixel kernels). Off = the ladder as it was.
  ladderClimb: boolean; capClimb: boolean;
  dnSpecIters: number; dnSpecCap: number; dnSpecClampK: number; dnSpecSigmaL: number; dnSpecRough: number;
  dnDepthK: number; dnNormalPow: number; dnMotionVectors: boolean;
  keepHistories: boolean;   // a change of internal size (a scale step, a preset's cap, the window) RESAMPLES the screen-space temporal histories (direct light per class + its depth, the indirect, the
                            // specular) into the new targets instead of restarting them, recycles render targets through a size-keyed pool instead of reallocating (the allocation + first-touch
                            // clears were the +7–20 ms frame after every step), and a gather / volumetric divisor flip re-creates only the targets on that grid (render/passes.ts resize, texpool.ts).
                            // Off = destroy + recreate everything and start every history from nothing, exactly as before
  exposure: number;
  flags: number;
  debugView: number;
  hazeDensity: number;
  indirectScale: number;
  emissiveScale: number;
  volSteps: number;
  skyZenith: Vec3; skyHorizon: Vec3;
  capColor: [number, number, number, number]; // section cap tint (rgb) + albedo mix
  nvAmount: number; nvGain: number; hitFlash: number;
  // ---- ReSTIR DI (renderer v3 Phase 2a, render/shaders/restir.wgsl; the header there is the estimator's description) ----
  restir: boolean;             // the direct-light estimator: true = ReSTIR DI (one reservoir per pixel per emitter class, temporal + spatial reuse, a fixed shadow-ray budget per pixel
                               // whatever the light count); false = direct.wgsl's leader / tail estimator exactly as it was (?norestir). Same four outputs either way
  restirRays: number;          // shadow rays per pixel per frame, 2‥6: 2 = each class alternates re-trace / fresh candidate on a flipping checkerboard · 3 = both temporal samples re-traced +
                               // one fresh candidate alternating between the classes · 4 = re-trace + fresh for both · 5 = + a final visibility ray when spatial reuse picks a neighbour's
                               // sample (spatial reuse then runs everywhere, unbiased) · 6 = + a second fresh candidate per class (presets: ultra 4 · high 4 · medium 4 · low 3 · verylow 2)
  restirSpatial: number;       // spatial taps k per pixel (0 = off): neighbours' temporal reservoirs within restirRadius, plane / normal rejected, pairwise MIS (presets 5 / 3 / 2 / 2 / 1)
  restirHistory: number;       // temporal M cap (1‥30): history length in candidate-equivalents — higher = smoother where nothing changes, slower where visibility does (the tile gradient
                               // and the target-ratio rule catch the big changes at once whatever this says)
  restirRadius: number;        // spatial radius in px at 1000 internal rows (scaled with the target; capped at ~0.6 m on the surface)
  restirGradient: boolean;     // per-8×8-tile temporal gradient: the tile's fresh one-sample estimates vs its temporal ones scale the history's confidence (a shadow arriving / leaving, a
                               // door letting light in resets in a frame instead of converging at the M cap's rate) — off = plain M-capped reuse, for A/B
  restirGradK: number;         // its threshold: the tile's paired z statistic (mean fresh − temporal disagreement over its own sampling noise) under which history keeps full confidence; none past 1.6× it (5: a real change moves dozens of lanes at once, z ≫ 5; the steady state sits at |z| ~ 1 — but with fat tails where one rarely-visible light dominates the
                               // tile's unshadowed weight: at 3.5 the lamp-lit floor behind the cubicles' windows reset 1–2 % of its tiles a frame and crawled, docs/internal/tjank.md §D)
  restirYoung: number;         // below restirRays 5 (no final ray) spatial reuse runs only where the pixel's own history is younger than this many candidates (disocclusions, resets),
                               // where its visibility bias is transient; at 5+ it runs everywhere with the final ray
  restirSpatialAll: boolean;   // A/B: spatial reuse everywhere even without the final ray (biased near shadow edges: a neighbour's visibility stands in for ours)
  restirCoherent: boolean;     // the fresh candidate (light + emitter point) is drawn from a random stream shared by the 8×8 tile instead of per pixel: every pixel's draw is still ∝ its own weights, but the tile
                               // traces near-parallel rays (a SIMD group walks one sort of ray: −0.6 ms of 4 at high on the M4) at the price of one-frame noise correlated in 8×8 blocks (the history decorrelates it)
  restirPenCap: number;        // D5 (image-quality program): the temporal M cap INSIDE PENUMBRAE (pixels whose inherited reservoir carries a blocker hint) — shorter memory where the estimate is a coin
                               // flip's EMA turns its slow random walk into per-frame noise the ratio filter + TAA average; 0 = off (the tier's cap everywhere)
  restirPenRays: boolean;      // D1: a second fresh candidate + shadow ray in those penumbra pixels whatever the tier's ray count (+1 ray where it matters; an auditing tile's penumbra lanes skip their audit)
  restirPermute: boolean;      // D4 (image-quality program): PERMUTATION SAMPLING of the temporal reservoir — each frame the reprojected texel is swapped within a 2×2-ish block by a per-frame XOR pattern (RTXDI's trick), so a
                               // pixel inherits a NEIGHBOUR's history: the reservoirs' slow random walk (temporally red noise the filters cannot average) becomes whiter frame to frame at the price of a
                               // little cross-pixel reuse bias inside penumbrae; the texel's own depth test still rejects across edges. Default off
  restirRatioRaw: boolean;     // A/B: the temporal confidence cut by the RAW target ratio p̂ now ÷ then (the 08-11 rule: a fluorescent's 15 % ↔ 100 % strokes dropped every reservoir under it to 1–3 samples
                               // twice a flicker period) instead of the ratio with each side ÷ its light's power (intensity / hue changes keep the history; a swept cone or a moved lamp still lets go)
  restirSampleHue: boolean;    // A/B: shade every traced sample in its OWN light's hue (the first cut — a red / blue per-pixel mosaic under two overlapping panels of different colours) instead of the
                               // class's believed-visible unshadowed mix at the pixel (restir.wgsl BELIEFS: per-tile lit / dark verdicts from the tile's own rays + the pixel's darkSlot)
  restirKnownDark: boolean;    // the lights an 8×8 tile's own rays found dark everywhere last frame leave its fresh draw (known dark like a reach-masked light: no ray, no coin-flip noise from a lamp
                               // behind the wall — the 'dark speckle' on the break-room lino); false = A/B the unbiased first-cut draw over every live light
  restirAudit: number;         // 0‥1: the share of a tile's frames (spread over every 64, staggered across tiles) on which ALL its lanes spend one extra ray re-testing a tile-dark light (votes only) —
                               // with the 5×5 LIT neighbourhood, what overturns a stale verdict for a light arriving where no tile near had it lit
  restirMotion: number;        // MOTION (lane fix/direct-motion, docs/internal/direct-motion.md; restir.wgsl header MOTION): the temporal reuse under a MOVING camera, as a bitmask — 1 = STOCHASTIC-BILINEAR
                               // reservoir reprojection (one of the four texels round the reprojected point, drawn by bilinear weight, validated as ever: lineages follow the surface and diffuse instead of
                               // sliding as a sheet under a sub-pixel pan), 2 = MOTION-SCALED CONFIDENCE (the M cap whole under restirMotionV px a frame of the pixel's own motion, × restirMotionMin past 1.6 × that: a panning pixel leans on fresh candidates), 4 =
                               // spatial reuse wherever the pixel moves more than restirMotionPx; 0 = the estimator's program byte for byte (passes.ts compiles restir.wgsl twice behind const RESTIR_MOTION;
                               // ?norestirmotion). At rest all three are inert by construction (motion 0)
  restirMotionV: number;       // (2): screen motion in px a frame AT 1000 INTERNAL ROWS (scaled to the target) under which the history keeps its full confidence (1.1 — measured: at high a 0.8-px pan
                               // wants the whole memory, a 1.4–2-px walking pan about two candidates of it; docs/internal/direct-motion.md §2); the cut ramps to the floor by 1.6 × this
  restirMotionMin: number;     // (2)'s floor as a fraction of the M cap (0.1 = a 2-candidate memory at cap 20 however fast the pan)
  restirMotionPx: number;      // (4)'s threshold: screen motion in px a frame AT 1000 INTERNAL ROWS (scaled like restirMotionV) past which the spatial taps run at the pixel (0.5)
  restirMotionTaps: number;    // (4)'s tap count at such a pixel when above the tier's restirSpatial (0‥8; 0 = the tier's own k) — wider spatial reuse only where the history was cut
  restirMotionStatic: boolean; // run the twin program under a STILL camera too (object motion — a walking man's own pixels — then gets the levers; +0.2 ms direct at high for the bigger kernel); false = a still camera
                               // dispatches main's program, so at rest the pass is main's byte for byte and costs the same
  restirMotionDither: boolean; // (1)'s pick: false = a per-pixel bilinear draw among the four texels (lineages diffuse; neighbours may adopt one parent and coalesce), true = ONE global sub-pixel offset a frame
                               // (an R2 sequence: a bijective shift whose average over frames is the true flow — nothing duplicated, the pattern registered to ± ½ px)
  // direct light sampling / reuse knobs (see direct.wgsl, dtemporal.wgsl, softblur.wgsl)
  directSamplesTop: number;    // stratified emitter samples for each class's strongest light (1-8)
  directSamplesOther: number;  // samples for the other leaders (1-4)
  directHistory: number;       // temporal reuse weight for direct light (0 = history-free; 0.7 ≈ 3-frame EMA), depth-validated + variance-clipped, transient lights bypass it
  directPasses: number;        // spatial à-trous passes per class (0-6)
  directBlurCap: number;       // max penumbra filter radius in px
  directAdaptiveMin: number;   // adaptive sampling: stop after this many samples if they all agree (2-4)
  secMinE: number;             // shadow-ray threshold (W/m² unshadowed) for lights at cascade interval hits
  flashlightRadius: number;    // emitter radius used for torches / the rail light (m): a real bezel is ~0.015-0.02; larger = softer torch shadows
  lightReach: boolean;         // direct pass + secondary vertices: per-light CPU reach masks over the level grid (FrameFlags.ReachMask; reach.ts) — a walled-off light never competes for a pixel's leader slots
  giFireflyK: number;          // final gather: each ray's radiance is bounded by giFireflyK × what the radiance cache says the shading point plausibly receives (÷π) — outlier rejection against the LOCAL light field instead of a global 24, so a torch hotspot on a wall cannot boil the bounce round it; 0 = off (the old absolute clamp only). A one-sided clamp, so the presets set it like a trade-off (ui/quality.ts: 4 on high‥verylow, 0 on ultra)
  tileCull: boolean;           // direct pass: each 8x8 tile scores only the lights that can reach its bounds (lossless; FrameFlags.TileCull) — off = every pixel scores every light, for A/B
  softTileSkip: boolean;       // penumbra filter: 8x8 tiles provably out of reach of every blur hint skip each à-trous step outright (lossless; FrameFlags.SoftTileSkip) — off = every pixel decides for itself, for A/B
  smokeRenderSkip: boolean;    // smoke samplers (shadow rays, beams, the volumetric march, probe sight lines) test the solver's per-brick render occupancy and skip the atlas fetch where the trilinear footprint is provably all zero (lossless; FrameFlags.SmokeRenderSkip) — off = always fetch, for A/B
  gridSkip: boolean;           // every traced ray (traceClosest / occluded / occludedT): the DDA runs past cells the grid build proved empty without loading them — one Chebyshev-distance byte per cell (lossless; FrameFlags.GridSkip) — off = a load pair per cell as before, for A/B
  gridYCull: boolean;          // every traced ray: cells and boxes (and the once-per-ray globals) whose stored height band the remaining stretch of the ray cannot reach are not slab-tested (per-cell 24-slice occupancy + per-item quantised extent + per-global extent; the argument is above traceClosest in common.wgsl) (lossless; FrameFlags.GridYCull) — off = every registered box is tested, for A/B
  axisBoxFast: boolean;        // slab test: boxes with yaw exactly 0 (two thirds of the grid items, every global) skip the rotation into the local frame and reuse the ray's inverse direction instead of three divisions — the arithmetic is provably the same bits (isectBox in common.wgsl) (lossless; FrameFlags.AxisBox) — off = always rotate, for A/B
  gridSlabs: boolean;          // every traced ray: the huge once-per-ray "global" slabs (ground, carpet base, floor finishes, ceiling) are skipped unless the ray segment's bounds meet theirs on all three axes (5 mm proud) instead of on height alone (4 cm) — a ray lifted off the floor stops testing four floors — and each cell's height span is judged 3.5 cm tighter at both ends, so a ray no longer re-tests the surface it just left (argument above traceClosest in common.wgsl; tools/qa/grid-globals.ts counts it) (lossless; FrameFlags.GridSlabs) — off = the height cull as it was, for A/B
  /** the final gather's rays drawn from tile-coherent STRATA instead of iid (fgather.wgsl cosineDirK — ported from exp/trace-perf E8, docs/internal/trace-perf.md §2.10; passes.gatherStrata picks the second
   *  pipeline pair, compiled behind `const GATHER_STRATA = true`): UNBIASED stratified directions — the same expectation, temporal noise equal or lower, gather −13‥16 % at high (−0.8 ms at ultra) because
   *  a tile's k-th rays share a quarter of direction space and walk the grid coherently. NOT hash-identical to off by nature (a different sample pattern), so it defaults off: the designer's call.
   *  Off = the gather module exactly as it was. `?gatherStrata`, `__gs.on`, Tab ▸ Indirect light. */
  gatherStrata: boolean;
  // ---- LOSSY trade-offs (all default off; each independently switchable at runtime for A/B — off is exactly the untouched path) ----
  checkerDirect: boolean;      // direct pass: shadow rays on a checkerboard half of the pixels per frame (parity alternates), the other half rebuilds S = U × its traced neighbours' S/U; hard edges and unsupported pixels still trace (FrameFlags.CheckerDirect)
  gatherThird: boolean;        // final gather (rays, temporal, à-trous) at 1/3 resolution instead of 1/2; the composite's joint-bilateral upsample follows the divisor (frame.lossyCfg.x; targets are recreated on change)
  rcHalfRate: boolean;         // radiance-cascade cache at half rate: upper cascades on even frames, c0 + dice bake on odd ones (rc.halfRate); the dice everyone reads is at most a frame older
  rcAmortize: boolean;         // amortized cascade upkeep (rc.amortize; docs/internal/p0a-cascades.md): upper level n re-traces an interleaved 1/rcPeriods[n] of its probes a frame — constant work per frame, c0 + the dice bake whole every frame, a fresh / rebuilt cache primed with whole bakes and a history-free first dice bake. With rcPeriods all 1 (the default until a preset places them) it dispatches exactly what it always did; false = the original path regardless of rcPeriods
  rcPeriods: readonly number[]; // per cascade level [c0 (ignored: always whole), c1, c2, c3, …]: frames a level takes to refresh all its probes under rcAmortize (quality.ts presets; Tab ▸ Indirect light)
  rcChunks: readonly number[];  // per cascade level [–, c1, c2, c3]: workgroups per upper-cascade probe — occupancy only, the same bits for any value (rc.wgsl rcUpper); Tab ▸ Indirect light for A/B
  volQuarter: boolean;         // volumetrics (haze beams + smoke march) at 1/4 resolution instead of 1/2; the composite's depth-aware upsample follows (frame.lossyCfg.y)
  dimRays: boolean;            // direct pass: pixels whose total unshadowed luminance (both classes) is under dimRaysBelow spend one emitter sample per leader instead of directSamplesTop/Other (frame.lossyCfg.z = the threshold, 0 when off)
  dimRaysBelow: number;        // that threshold, in the estimator's irradiance units: 0.01 W/m² unshadowed on a mid-grey surface at exposure 2 lands at ≈2 % of display white after AgX (0.02 ≈ 4 %)
  volLightCap: number;         // volumetrics worst-case cap (Phase 0, volumetrics.wgsl VOL_KMAX): at most this many lights get shadow rays per smoke-march step (the first K by unshadowed bound on that stretch that reach the step) / per haze view ray (the K beams with the largest unshadowed in-scatter, sharing 1.5 × volSteps by it), the rest dropped — and the smoke march walks per-domain stretches with a bounded shortlist. 0 = off: the pass exactly as it was (frame.volCfg.x; presets: ultra 6 · high 4 · medium 3 · low / verylow 2)
  volShadowEvery: number;      // with the cap on: a traced light's shadow ray + self-shadow march is refreshed every N smoke-march steps and reused between (frame.volCfg.y; 2 on every preset — 1 bought nothing visible and cost ultra a third of its march; 3 combs)
  volStepVoxels: number;       // with the cap on: smoke-march step in voxels of the domain walked (frame.volCfg.z in tenths; 1.5 = as ever — ultra / high / medium; 2 — low / verylow)
  // ---- SMOKE AS AN OCCLUDER (perf/smoke-scale, docs/internal/smoke-perf.md): what every SHADOW ray toward a light reads of the smoke it crosses (the direct pass, gather / reflection / card / probe-meter hits,
  // the froxel haze's dimming beyond a plume) — never the plume you look AT (the volumetric march) nor the guards' sight-line probe, both always the field's own 24-tap / per-voxel walk
  smokeDiffuseStart: number;   // optical depth under which the smoke diffusion does nothing (0.35: a plume's thin edge keeps the art behind it crisp; was a fixed 0.15)
  smokeTaaReact: number;       // EXPERIMENT (smoke battery, docs/internal/smoke-look2.md): the TAAU resolve treats a pixel as reactive by (1 − its smoke transmittance) × this (0 = off, as it was): a plume has no motion vectors, so
                               // its history is a stale plume clamped into place — reactive keeps the fresh march instead (crisper billows, more of the march's own noise); volCfg.w bits 16‥19 × 10
  smokeUpsampleRelax: boolean; // EXPERIMENT: composite's depth-guided vol upsample lets go of the depth term where the texel is mostly SMOKE (the smoke in front of a cabinet and of the floor beside it is the same smoke;
                               // guiding by the surface behind it carves the plume's edge along every depth edge behind it); volCfg.w bit 20
  smokeDiffuseWeight: 'max' | 'bilinear';   // EXPERIMENT: the post diffusion's weight = the most transparent of the four half-res texels ('max': no rim on a nearer surface, but piecewise-constant = blocks over a bright
                               // background) or a plain bilinear of the smoke transmittance ('bilinear': smooth, rims possible); PostParams _pad.x
  smokeMultiScatter: number;   // the smoke march's MULTIPLE-SCATTERING octave gain (0 = single scattering as it was; 1.0 default): a second lobe that sees the lights through half the extinction with a
                               // more isotropic phase and reaches the eye through half the extinction too (Wrenninge's art-directable approximation) — the coloured glow of the lit side comes THROUGH an opaque
                               // plume instead of stopping at its shell; frame.volCfg.w bits 12‥15 = round(× 10); Tab ▸ Volumetrics ▸ Smoke solver
  smokeMarchLights: number;    // the froxel-lit smoke march lights this many LIGHTS per step ITSELF (the K strongest by unshadowed bound on each stretch — exact cone edge, a shadow ray every volShadowEvery steps, the step's own self-shadow) and injectJ writes only the ambient into J (frame.volCfg.w bits 8‥11; 0 = the J-lit march exactly as it was — its flat blob and its slice lattice: docs/internal/smoke-look.md; presets: ultra 4 · high 3 · medium 2 · low / verylow 0)
  smokeShadowSteps: number;    // samples those rays take across the hull of the boxes they cross: 8 = as ever (0 also = 8); 3‥15 (frame.volCfg.w; 6 saves ~0.2 ms of direct with three plumes up, 4 ~0.4 but blotches the plume's floor shadow — §4 there)
  // ---- FROXEL VOLUMETRICS (renderer v3 Phase 2b; render/froxels.ts + shaders/froxel.wgsl, docs/internal/p2b-froxels.md): the haze beams lit per froxel of a camera-frustum grid — a
  // per-cluster light list, k shadow rays, temporal accumulation, front-to-back integration — read back per pixel with one cubic-across / linear-along fetch (composite / particles); the smoke
  // keeps its per-pixel density march but takes its LIGHTING from the froxels' J volume; volumetrics.wgsl keeps that march + the rain. Off = the per-pixel march exactly as it was (?nofroxel;
  // Tab ▸ Volumetrics — froxels). H, D, k, history, strata come from the preset (quality.ts Preset.froxel); W follows the window aspect.
  froxelVol: boolean;
  froxelH: number; froxelD: number;   // grid rows and depth slices (W = H × window aspect): ultra 180 × 56 · high 135 × 64 · medium 108 × 48 · low 80 × 32 · verylow 64 × 24
  froxelK: number;             // shadow-rayed lights per froxel, the k with the largest unshadowed in-scatter there (the rest dropped): ultra 5 · high 4 · medium 3 · low / verylow 2
  froxelHistory: number;       // exponential history weight of the accumulated volume (0.9 ≈ 10 frames; 0 = every frame on its own); the reprojected history is clamped to the frame's local box, so lights that move / switch / flash cannot trail
  froxelNear: number; froxelFar: number;   // metres along the pixel ray of slice boundary 0 (a floor: the boundary actually used is max(this, camera height − FROXEL_CONTENT_TOP) — nothing to light hangs higher than that, so a camera 17 m up spends no slices on its first 9 m of open air) and of boundary D (surfaces past `far` read the whole column; nothing is injected past it)
  froxelCurve: number;         // slice curve a: thickness grows e^a from the first slice to the last (2 = 0.3 m under the eye → 2.4 m at 56 m with 64 slices; 0 → uniform)
  froxelTopRays: number;       // shadow rays for each froxel's STRONGEST haze light: 1‥3 equal-weight depth strata of its lit chord (unbiased; a light sheet thinner than a slice — a beam skimming a partition top — is hit-or-miss for one ray a frame, and the history shows that as crawl: N strata cut the amplitude — and the clamp's darkening of such a sheet — see docs/internal/p2b-froxels.md §3.3); ultra 3, high / medium 2, low / verylow 1; froxelB.w bits 9‥10
  froxelSharp: boolean;        // the per-pixel fetch across the screen: false = cubic B-spline over the froxels (C² — no crease at froxel boundaries, half a froxel softer), true = plain trilinear (sharper, shows the grid on a beam's edge); froxelB.w bit 8
  froxelBias: number;          // the lookup's depth bias in slices toward the eye (default 0): a knob against scatter injected in the far part of a surface's own froxel bleeding onto it (a beam just behind a wall top) — every notch of it costs that much of the last slice of scatter in front of every surface (0.75 took a fifth of a beam lying along a floor)
  particleBirths: number;      // GPU particle births a frame (render/particles.ts maxBirthsPerFrame — Phase 0 cap; the emit queue carries the rest into the next frames, long-lived kinds first, stale sparks shed): presets 512 / 384 / 256 / 192 / 128
  debrisCap: number;           // the destruction lane's rigid-debris pool (game/debris.ts: ceiling tiles, monitor housings, desk clutter as tumbling shadow-casting boxes): presets 64 / 64 / 32 / 32 / 32 — the image-quality program's chaos budget (docs/internal/image-quality.md §4)
  torchBounceCards: boolean;   // final gather: every carried spot light's footprint (torches, weapon lights, Sam's rail light — RtLight.card) on the surface its beam hits is rebuilt each frame as a one-sided analytic emitter (render/shaders/cards.wgsl: axis ray + 64 cone samples → claim disc, flux-weighted centroid / radius, radiance × area from the flux that actually landed there × the albedo it landed on) and the gather takes that patch's bounce analytically with ONE shadow ray instead of finding the hotspot with its cosine rays — which drop that light's direct term wherever they land inside the footprint, so nothing is counted twice (fgather.wgsl). The boil round a torch near a wall goes by construction, and the firefly bound stops eating the bounce there. FrameFlags.BounceCards; off = no card pass, nothing sampled or excluded: bit-identical (docs/internal/perf-2026-08-10.md)
  directSeedHold: boolean;     // direct pass A/B knob from the torch-shadow boil study: with direct-light history on, advance the per-pixel emitter-sampling pattern every other frame instead of every frame (FrameFlags.DirectSeedHold) — default off
  giAdaptiveHistory: boolean;  // LOSSY: the indirect's temporal accumulation weighs its reprojected history by how consistent it is with this frame's 3×3 neighbourhood — inside the spread it is kept unclipped at 0.93 (≈ 14 frames: smoother where nothing changes), well outside it is clipped as before at 0.7 (≈ 3 frames: converges faster where the light moved) — instead of clip + a fixed 0.86 (FrameFlags.GiAdaptiveHist; temporal.wgsl; docs/internal/perf-2026-08-10.md) — default off
  // ---- EXPERIMENTS (default off, not part of any preset; off is exactly the untouched path) ----
  gloss: boolean;              // traced glossy reflections on the polished floors (BoxFlag.Gloss: lobby stone, corridor + break-room lino): the final gather spends one jittered mirror ray per gloss texel, shades its hit like a gather hit (+ the fixture's own emission), weights it by Schlick Fresnel on the view angle, and composite adds it after the diffuse terms via its own half-res texture with history + one à-trous pass (FrameFlags.Gloss; costs ~1 extra trace per gloss texel at gather res + two half-res filter dispatches)
  decals: boolean;             // decals (experiment E1, this branch: default ON): the marks the encounter leaves — bullet holes, stun scorches, boot scuffs, chips (render/decals.ts, applied in the g-buffer's fragment stage: decals.wgsl) — off = nothing recorded, nothing uploaded, FrameFlags.Decals never raised: the g-buffer exactly as it was (?nodecals boots with it off)
  glass: boolean;              // GLASS (E3, default ON): boxes flagged BoxFlag.Glass are panes — out of the raster and the trace grid, listed in SceneInfo.glass; composite lays a traced Fresnel reflection (fgather, through the gloss floors' specular chain), the pane's tint and a dust glow over what the G-buffer shows behind them, and the direct pass tints light that crossed a pane (FrameFlags.Glass). Off = no pane list: every glass box is simply an empty opening, which is what the level was before panes were authored
  glassReflect: number;        // × the physical Fresnel reflection (1 = as traced; 0‥3 on the panel)
  glassTintDepth: number;      // exponent on a pane's albedo per crossing (1 = one pane's worth; 0 = clear glass)
  glassDust: number;           // × the dust / grime forward-scatter glow that shows a torch beam or a panel's light ON the pane (1 = fgather's GLASS_DUST albedo)
  glassRefract: boolean;       // REFRACTION (default ON): the view ray bends through every Glass box by Snell's law — in, across the box to the face it leaves by, out — the tint deepens by Beer–Lambert with the glass actually crossed (a box's authored tint = its transmittance square through its own thickness) and the surface behind is read where the bent ray comes out (screen space: composite.wgsl glassRefractPath / refractedRead); a 12 mm pane shifts nothing but at a graze, the water-cooler bottle centimetres. Off = the tint's old albedo^(depth ÷ cos) rule and the read under the pixel, byte for byte
  glassIor: number;            // its index of refraction (1.5 = soda-lime glass; 1.33 water; 1.0 = no bending — the absorption law stays the refracting one)
  meshShadowsNear: boolean;    // mesh shadows for NEAR receivers only (frame.rigCfg bit 128; the HIGH preset's form — quality.ts Preset.mesh 'near'): a shadow ray tests a man's MESH only when it starts within 0.6 m of his cull sphere
                               // (the floor at his boots, the man beside him, his own pixels), his round cones otherwise — the contact seam closed for a bounded cost (docs/internal/render-defects-0812.md §1); false = every ray walks the mesh (ultra)
  meshShadows: boolean;        // mesh-traced character shadows (the ultra experiment): every shadow ray tests characters against their skinned triangle mesh — per character a refit BVH over the shared mannequin topology, re-skinned + refit in two small compute dispatches a frame (render/meshShadows.ts, 'mesh' in the HUD) — instead of the 15 round-cone proxies, so limbs, hands, feet and the head cast their real silhouettes and the proxies' over-occlusion (~17 % of what the old capsules blocked; the fitted cones halved that) goes; primary visibility and closest-hit shading are untouched. Inert unless engine.meshShadowsAvailable (adapter storage-buffer budget, frame.ts meshBinding). FrameFlags.MeshShadows; off = the proxy path bit for bit
  gbaa: boolean;               // GBAA (image-quality program C3; render/shaders/gbaa.wgsl, the g-buffer's `edge` target): single-frame GEOMETRIC edge anti-aliasing — every composite pixel an analytic box edge crosses is
                               // blended with its neighbour across the edge by the far side's exact coverage, before the resolve; no history, no jitter needed for the box edges (pair with taauPhases 0 =
                               // jitter off, the TAA reduced to a noise pass). Under the TAAU path only (debug views / TAAU off bypass it). Default off (the presets place it)
  motionIds: boolean;          // MOTION IDENTITY (image-quality program E1; scene/boxes.ts Box.mkey / BoxWorld.motionIds): keyed dynamic boxes — leaves, furniture, items, hand props, devices — reproject through the
                               // transform the SAME part had last frame wherever it sat in the dynamic list (a spawn / despawn no longer hands everything after it a wrong or zero motion vector for a
                               // frame); off = the g-buffer index-matches by size + owner exactly as before. Default on
  wetChars: boolean;           // wet characters (game/wet.ts + gbuffer.wgsl fsSkin + composite.wgsl): whoever stands in the rain soaks — darker saturated fabric under a glossy clear coat (a GGX lobe per light in composite, dimmed by the direct pass's own shadowing) and drops beading and running down him in his bind-pose space — and dries indoors. The renderer's half only: the CPU model runs regardless (probes read it); off = the g-buffer is handed zeros and every character shades bit for bit as before. Default on
  // ---- PARTICLE RAIN (game/rainFx.ts + the 'rain' particle kind; docs/internal/prain.md, docs/review/prain.html): a NEAR-FIELD layer of real GPU rain drops over the lattice rain
  // volumetrics.wgsl draws — recycled over the outdoor ground within a disc round the view, falling at terminal speed with the wind field's air, killed where they hit (roof, bonnet,
  // pallet, a shoulder) and turned into a splash crown there, lit as WATER (a phase function + the strand glint off the strongest shadow-tested lights) and refracting what is behind
  // them through refract_common.wgsl; drips off roof / bonnet edges; the lattice's own near share faded out under the disc. ON by default (v2); off (?norain2 at boot, Tab ▸ Weather &
  // wind ▸ Rain — particles) = nothing spawned and frame.weatherE / weatherF zero: the lattice rain and the frame byte for byte as they were before the layer ----
  particleRain: boolean;
  particleRainCount: number;   // the most rain drops alive at once (the recycler aims at the LATTICE's own density over the outdoor ground inside the disc × particleRainDensity, capped here; presets 6000 / 4000 / 2500 / 1500 / 800)
  particleRainRadius: number;  // the disc's radius round the view's look-at point (m); 0 = auto: 0.6 × the camera distance (≈ 12.5 m at the follow camera's 21 — the view's corners), 8‥30
  particleRainDensity: number; // × the lattice's drops per m² of ground column at the current rain rate (1 = the same rain, near and far)
  particleRainBright: number;  // × the streaks' / splashes' scattered radiance (1 = calibrated to the lattice's gain)
  particleRainDrips: boolean;  // fat slow drops off roof / car / housing edges near the view (found once from the level's boxes), ∝ the rain rate
  particleRainLattice: number; // 0‥1 = the share of the lattice KEPT inside the disc by hand; −1 = auto: 1 − the particle layer's density share (0 while the layer matches the lattice, so nothing doubles up)
  particleRainReact: number;   // × a streak's luminance (display-referred) into the TAAU reactive mask (0 = the streaks write no reactivity: the resolve smears them — the A/B)
  gpuParticles: boolean;       // GPU particles (the E4 experiment, render/particles.ts — ON by default in this branch): sparks, debris chips, dust puffs and spent casings born / stepped / collided / lit in one compute pass ('particles' in the HUD) and splatted into the HDR target after the composite. The game's effect sites (game/particleFx.ts) route to it while it is on AND a Particles is attached (engine.particles — the headless harness has none); off = the CPU box sparks of game/sparks.ts exactly as they were and none of the new debris / dust / brass. FrameFlags.Particles; ?noparticles at boot
  // ---- MATERIALS + RAY-TRACED REFLECTIONS (renderer v3 phase 4; render/shaders/reflect.wgsl, docs/internal/p4-materials.md). One BRDF everywhere it is affordable: base colour (the box albedo),
  // GGX roughness and metalness per material (Box.rough / metal, levels/*.json materials) written per pixel by the g-buffer (+ its detail layer below); reflect.wgsl spends GGX-VNDF-sampled
  // rays on every pixel under rtMaxRough and adds the analytic GGX image of the point / spot / panel lights no ray can find, the shared denoiser's SPECULAR client (render/denoise.ts, at the
  // reflection target's own divisor, per-pixel roughness, virtual-hit reprojection, lobe-footprint à-trous) settles it, composite adds it × the cutoff fade. REPLACES `gloss` while on (the
  // engine never raises FrameFlags.Gloss with it). Presets: ultra ÷2 · 2 rays · ≤ 0.55, high ÷2 · 1 · ≤ 0.45, medium ÷3 · 1 · ≤ 0.35, low / verylow off (quality.ts); off = no dispatch,
  // no read: the frame bit for bit as before (?nortreflect boots with it off and vetoes the presets) ----
  rtReflect: boolean;          // the switch (frame.rtCfg.w carries the divisor while on, 0 while off)
  rtReflectDiv: number;        // the reflection target's divisor: 1 = full internal res, 2 = half (ultra / high), 3 = a third (medium) — the targets are pooled and re-made on change
  rtRays: number;              // traced rays per reflecting pixel per frame (0 = the analytic highlights only, nothing traced; 1; 2 on ultra)
  rtMaxRough: number;          // finishes rougher than this get no ray and no term (composite fades the term out over the 0.12 under it): 0.45 high, 0.55 ultra, 0.35 medium
  rtAniso: number;             // 0‥1: how far an anisotropic finish (the wet lot) stretches its lobe along the view — 0 = isotropic (a lamp mirrors as a disc), 0.7 = a long streak
  rtStrength: number;          // × the whole reflection term in composite (1 = as traced; the panel's A/B slider)
  rtGlints: number;            // × the analytic GGX highlights of point / spot / panel lights on a finish (1 = physical; 0 = traced term only)
  rtAtrous: number;            // à-trous iterations of the reflection chain's denoise (1‥4, strides 1 2 4 8 — each bounded by the lobe's own footprint anyway): ultra 4, high / medium 3 (2 left the lobe's fading tail mottled: docs/internal/p4-materials.md §3)
  rtHistory: number;           // the reflection chain's history cap in frames for the ROUGHEST finishes (a polish keeps ~6 whatever this says, lino ~¾ of it; a clamp that had to move the history far shortens it): 32
  detail: number;              // the DETAIL LAYER 0‥1 (gbuffer.wgsl fsBox, frame.matCfg.w): physically-explainable wear evaluated at the primary hit only — worn paths on the polished floors (roughness up, a
                               // little darker, off the level's traffic map: patrol routes + door thresholds), grime where the mop does not reach (floor-wall edges), scuffed skirting, dust on top
                               // faces above eye level (rougher, greyer), edge wear on metal (brighter bare metal within 2 cm of an edge). No image textures, no albedo noise. 0 = the g-buffer exactly
                               // as it was; default 0.35 ('lived-in'); Tab ▸ Materials
  // ---- RENDERER V3 PHASE 5 — the ULTRA-only extras (docs/internal/p5-ultra.md). Each behind its own switch; every switch off = every pass byte for byte as it was (frame.p5Cfg all zero); the ultra
  // preset turns them on, every other preset leaves them off (quality.ts Preset.p5). ----
  giResample: 'off' | 'temporal' | 'full';   // the final gather's screen-space RESERVOIR RESAMPLING (ReSTIR-GI-lite, fgather.wgsl mainGi): each gather texel keeps ONE secondary sample {hit point, its normal, its outgoing
                               // radiance} in a reservoir; 'temporal' = fresh cosine rays (giResampleRays, fewer than the plain gather's 4) RIS-combined with the texel's own reprojected reservoir (M capped
                               // at giResampleCap); 'full' = + one spatial pass over giResampleTaps neighbours' reservoirs (pairwise MIS, Jacobian-reweighted, no extra visibility ray — the biased-but-bounded
                               // variant); the estimate is Σ_j f(y_j)·w_j (every sample shaded) → the same outIndirect the diffuse denoiser client consumes. 'off' = the 4-ray gather exactly as it was
  giResampleRays: number;      // fresh candidate rays per gather texel per frame under resampling (1‥4; ultra 2)
  giResampleCap: number;       // temporal confidence cap M (2‥64; 20 ≈ ten frames of 2-ray history at 60 Hz)
  giResampleTaps: number;      // spatial neighbours combined per texel in 'full' (1‥8; ultra 3)
  giResampleRadius: number;    // spatial radius in gather texels (2‥32; ultra 10 ≈ 20 internal px)
  giResampleRevalidate: boolean; // the temporal sample's outgoing radiance is RE-SHADED at its stored point every frame (one directAtPoint + a cache read: a switched light or a swept torch reaches the reused
                               // history at once instead of over M frames); off = the stored radiance is reused as found (plain ReSTIR GI: cheaper, lags a moving light by the confidence cap)
  // ---- MARKINGS (scene/markings.ts, shaders/markings.wgsl; docs/review/legibility.html): pixel-art signifiers ON box faces — key caps, packing tape + glyphs on cartons, drawer seams, the vending
  // product window, text bars, LEDs — flat colour per world-space texel from a ≤ 3-colour palette, AA only at texel edges, minified to their mean under a pixel a texel; written into the g-buffer's
  // albedo / roughness, their emission added in composite and at reflection hits, their area average folded into the secondary rays' albedo, an emissive marking registered as a real area light ----
  markings: boolean;           // the switch (frame.markCfg.x carries the texel while on, 0 while off: nothing evaluated anywhere, the box lists upload slot 0 and the plain albedo — the frame as it was; ?nomarkings)
  markingTexel: number;        // the base world-space texel (m): 0.025; `fine` markings use half, `coarse` double (repacked on change)
  markingContrast: number;     // 0‥1: palette colours lerped from the box's own albedo toward their authored value (1 = as authored)
  markingEmissive: number;     // × the emission of emissive markings (the vending window, UI bars, LEDs); their registered lights follow it too (game/lighting.ts)
  markingReflect: boolean;     // markings are evaluated at REFLECTION hits (reflect.wgsl shadeReflHit: the vending window in the lino) — off = the hit's plain secondary albedo / no emission
  markingReflPattern: boolean; // the analytic highlight of a marking's light is textured with the marking's pattern at the mirror point (reflect.wgsl rtGlints → markings.wgsl markPatternAtMirror); off = the uniform rectangle (A/B only: the sign of frame.markCfg.w)
  markingReflCone: number;     // × the lobe's α added to the ray-cone growth that band-limits a marking at a TRACED reflection hit (0 = the pixel's own cone only — the ray distribution + the specular denoiser realise the lobe; 2 = the whole lobe again = the double blur that erased the vending cans in the lino; default 0.25 trades a little bias for 1-ray noise)
  rtMeshHits: boolean;         // reflections see characters as their skinned MESH (reflect_p5.wgsl: a closest-hit walk of the mesh-shadow trees — render/meshShadows.ts, refit under settings.meshShadows — instead of the
                               // 15 round-cone proxies; the proxy path when meshShadows is off or unavailable). Off = traceClosest's round cones exactly as before
  rtHitReuse: boolean;         // reflections: the second VNDF ray takes the antithetic azimuth of the first (the pair straddles the lobe), and each hit's LIGHTING (albedo/π × direct + bounce) is blended with last frame's
                               // record at this texel when the hit points match (a path-space history keyed on the hit, not the pixel — the one-shadow-ray light pick at an off-screen hit stops flickering
                               // a rough mirror); off = every ray shaded fresh, the R2 pair as before
  // ---- SDF CHARACTER RIG (render/sdfrig.ts fits it, shaders/sdfrig.wgsl traces it, docs/internal/sdf-characters.md): every mannequin's 15 shadow / reflection proxies ARE round cones with radii
  // least-squares fitted to the mesh — unconditionally, at every tier, once a fit is attached (Engine.setRigFit; BoxWorld.upload packs it into the frame's proxy list). What stays switchable is the two
  // extras below, both rows (no preset touches them; ?sdfsmooth / ?charsoft set them from boot): frame.rigCfg bits 2 and 4/8/16/32, all 0 = the plain round-cone loops everywhere. ----
  sdfRigSmooth: boolean;       // (ii) the reflection pass's closest character hit is the sphere-traced SMOOTH UNION of his cones (polynomial smin, a blend radius per joint) with the field's gradient as the normal — a mannequin
                               // in the lino instead of sausage links; dispatches the reflect_p5.wgsl variant like the ultra mesh hits (which win when both are on)
  sdfRigK: number;             // × the per-joint blend radii (render/sdfrig.ts RIG_K; 1 = as authored, 0 = the plain union of the cones) — also pads the cull spheres by the blend's bulge
  sdfRigSteps: number;         // closest-hit sphere-trace steps (24)
  charSoftShadow: boolean;     // (iii) EXPERIMENT: in the direct estimators (restir.wgsl AND direct.wgsl, through direct_common shadowSample) a shadow ray's CHARACTER visibility is the SDF soft-shadow query toward the emitter's
                               // centre with the emitter's angular radius as the cone — deterministic per pixel per light, so a walking man's penumbra needs no history to converge — multiplied with the
                               // ray-traced BOX visibility (still stochastic); the mesh-shadow / round-cone any-hit is then not asked about characters in that pass
  charSoftAnalytic: boolean;   // (iii)'s form: true = the per-cone closest-approach clearance (no march, exact for a capsule, ~15 closest-point solves per man crossed); false = the sphere-marched field (smooth union, charSoftSteps)
  charSoftSteps: number;       // the march's step budget (20)
  charSoftK: number;           // × every light's angular radius in the query (1 = physical; 2 = penumbrae twice as wide)
  charSoftMinDeg: number;      // the smallest half-angle (degrees) a light is given — a bare 1.5 cm torch bezel a metre off would otherwise draw a razor edge the raster aliases (0.35°)
  charSoftSmooth: boolean;     // the march folds the cones with the smooth union (else their plain min — cheaper, the blend only shows at joints)
  charSoftBroad: boolean;      // the soft query for BROAD-class emitters too (ceiling panels, area lights); false = the SHARP class only (torches, lamps, the moon) — a panel's character shadow is all
                               // penumbra already (nothing to trail) and its disc dwarfs a limb, where the one-strip-per-man model under-counts a whole body's cover
  charSelfShadow: boolean;     // CHARACTER SELF-SHADOW (frame.rigCfg bit 64, default ON at every tier; ?noselfshadow / Tab ▸ Renderer — SDF character rig): the direct estimators' shadow rays from a man's own pixels
                               // test HIS OWN body too (common.wgsl selfShadowT: his round cones, or his mesh under meshShadows, from an origin lifted off the surface — the plain owner skip made every
                               // up-facing sliver of him glow under a light his trunk stands in front of: docs/internal/render-defects-0812.md §1); false = the owner skip whole, the frame as it was
}

export const defaultSettings = (): RenderSettings => ({
  renderScale: 1.0, maxInternalHeight: 1000, keepHistories: true, exposure: 2.0,
  taau: true, taauAlpha: 0.1, taauClipGamma: 1.0, taauPhases: 8, taauSharpen: 0.25, taauReactive: 0.8, taauKernel: 6.0, taauVelK: 1.0, taauLightJump: 1.0, taauMotionAlpha: 0.4, taauMotionClip: 0, taauSharpenMotion: 0.3, taauHistSharp: 0,   // TAAU on by default (?notaau boots the old FXAA chain); the presets place phases / gamma / sharpen per tier (ui/quality.ts)
  sharpDirect: false,   // sharp direct OFF by default (the presets place it per tier — ui/quality.ts Preset.iq; ?sharp / ?nosharp force it from boot; Tab ▸ Frame; live only under TAAU below scale 1.0 with no debug view — engine.resize)
  sharpSliver: 1, sharpSliverCap: 24, sharpDiag: 0, gbaaClamp: true, heldRays: 6, restirHueSplit: true,   // direct-quality lane: same-surface-only slivers with an output-res ray, GBAA's same-surface clamp, the hybrid estimator at high's K 6 (the presets tier it; 0 / false / 0 = each path as it was)
  sharpDecouple: false, sharpEdgeRays: false, sharpEdgeSpread: 0.3, sharpEdgeHintPx: 2.5, sharpPlaneK: 0.01,   // edge rays OFF by default: they take a keyboard's contact shadow to 1.6 px (crisper than the old renderer's 7) but a binary ray cannot draw the soft penumbra a hard one overlaps, and the fired region's rim shows the estimator's own 1–2 % bias as a faint line — docs/internal/sharp-direct.md §2 (E); Tab ▸ Frame / __sharp.set({edgeRays:true}) to judge
  denoiser: 'v3',   // the v3 core by default (?legacydenoise boots the three old chains); iterations / caps below are 'high's until a preset places them
  dnShadowIters: 3, dnShadowCap: 12, dnShadowClampK: 1.25, dnShadowSigmaL: 4, dnShadowPrior: true, dnShadowLitAlike: true, dnShadowMoveCap: 3, dnShadowMoveThresh: 0.04, dnShadowJump: 0.5,
  dnGiIters: 4, dnGiCap: 24, dnGiClampK: 1.0, dnGiSigmaL: 4, dnGiFast: 3, dnGiFirefly: 0,   // (k 1.0 / fast 3: the sweep in docs/internal/p3-denoise.md §3 — 10 % of a lights-off in 16 frames vs legacy's 14, at half its torch-hotspot boil)
  giFullRes: false, giFullIters: 4, giYoungRays: 1, giYoungCap: 0.08, giYoungLen: 4,   // GI in motion: both OFF by default until a preset places them (ui/quality.ts Preset.dn.giFull / giYoungK); Tab ▸ Indirect light rows
  dnGiClampCut: 0, dnGiYoungWiden: 0,                                                     // (D): off until measured (Tab ▸ Denoiser rows)
  ladderClimb: true, capClimb: false,   // the ladder spends measured headroom on scale + divisors by default (it only ever acts on presented frames with GPU timings that show the room); the output-cap climb is opt-in (Tab ▸ Frame)
  dnSpecIters: 1, dnSpecCap: 16, dnSpecClampK: 1.0, dnSpecSigmaL: 2, dnSpecRough: 0.08,
  dnDepthK: 0.004, dnNormalPow: 12, dnMotionVectors: true,
  flags: FrameFlags.Direct | FrameFlags.Indirect | FrameFlags.Volumetrics | FrameFlags.Smoke | FrameFlags.RcVisWeight | FrameFlags.SmokeShadows | FrameFlags.Bounce | FrameFlags.Dither | FrameFlags.SoftShadow | FrameFlags.Temporal,
  debugView: 0, hazeDensity: 0.035, indirectScale: 0.35, emissiveScale: 1.0, volSteps: 20,
  skyZenith: [0.015, 0.025, 0.05], skyHorizon: [0.04, 0.05, 0.08],
  capColor: [0.010, 0.012, 0.016, 0.3],
  nvAmount: 0, nvGain: 475, hitFlash: 0,   // nvGain = intensifier tube gain (log curve), not a linear multiplier
  restir: true, restirRays: 4, restirSpatial: 3, restirHistory: 20, restirRadius: 16, restirGradient: true, restirGradK: 5, restirYoung: 8, restirSpatialAll: false, restirCoherent: false, restirSampleHue: false, restirRatioRaw: false, restirKnownDark: true, restirAudit: 0.25, restirPermute: false, restirPenCap: 0, restirPenRays: false,   // ReSTIR DI on; the presets place rays / taps / cap per tier (quality.ts), these are 'high'
  restirMotion: 6, restirMotionV: 1.1, restirMotionMin: 0.35, restirMotionPx: 0.5, restirMotionDither: false, restirMotionTaps: 6, restirMotionStatic: false,   // MOTION (direct-motion lane, docs/internal/direct-motion.md; these are HIGH's — floor .35 / 6 taps since the 08-12 SPRINT take: at three times the walking pan the .1 floor made the light's edge noisier than no cut at all, .35 + taps sits between; the walking pan keeps most of its win): 6 = the motion-scaled confidence (2) + wider spatial reuse under motion (4) — measured at high: the light's edge under a walking pan −43 % flow, the lit floor −27 %, the dark floor −7 % (−46 / −32 with 6 taps), a slow pan and the still picture unchanged, main's 1–3.7 % motion darkening gone; the stochastic reprojection (1) stays an A/B row (a NEGATIVE at slow pans: +12‥34 %); the presets tier Min / Taps; 0 (?norestirmotion) = the estimator's program byte for byte
  directSamplesTop: 8, directSamplesOther: 4, directHistory: 0.5, directPasses: 3, directBlurCap: 10, directAdaptiveMin: 3, secMinE: 0.006, flashlightRadius: 0.07,   // adaptive: 8/4 is the budget in penumbrae, `directAdaptiveMin` rays where samples agree
  lightReach: true,
  giFireflyK: 4,
  tileCull: true,              // proven exact: 4 views × final/direct/indirect bit-identical off vs on under the deterministic capture protocol (08-06); toggle stays in the Direct light panel
  softTileSkip: true,          // exact by construction (argument in softblur.wgsl); A/B via the Direct light panel toggle / frame flag 8192
  smokeRenderSkip: true,       // exact by construction (argument above renderOccRegions in smoke.wgsl); A/B via the Smoke panel toggle / frame flag 32768
  gridSkip: true,              // exact by construction (one DDA iteration per cell as before, only the loads of provably empty cells go); A/B via the Direct light panel toggle / frame flag 131072
  gridYCull: true,             // exact under the grid's own registration invariant (argument above traceClosest in common.wgsl); A/B via the Direct light panel toggle / frame flag 262144
  axisBoxFast: true,           // exact by IEEE identities (1·x − 0·z = x); A/B via the Direct light panel toggle / frame flag 524288
  gridSlabs: true,             // exact with a 5 mm margin over < 0.4 mm of float differences (argument above traceClosest); −40 % slab tests on rays leaving the floor per tools/qa/grid-globals.ts; A/B via the Direct light panel toggle / frame flag 1048576
  gatherStrata: true,          // ON since 08-12 (the designer: 'gatherStrata is looking great!'): unbiased, −13‥16 % gather, a different sample pattern (not hash-identical to the iid gather — ?nogatherstrata / __gs.on = false for the module exactly as it was) / Tab ▸ Indirect light for A/B
  checkerDirect: false, gatherThird: false, rcHalfRate: false, volQuarter: false, dimRays: false, dimRaysBelow: 0.01,
  rcAmortize: true, rcPeriods: [1, 1, 1, 1],   // the schedule is on but traces every level whole until a preset (quality.ts) places periods — bit-identical to the original dispatch meanwhile
  rcChunks: [1, 1, 2, 8],                        // c2's items over 2 workgroups per probe, c3's over 8: the cascades 1.77 → 1.05 ms on the M4 Max with the same output bits (docs/internal/p0a-cascades.md §6); [1,1,1,1] = the original one-workgroup-per-probe dispatch
  volLightCap: 0, volShadowEvery: 2, volStepVoxels: 1.5,   // the cap is off until a preset places it (quality.ts: every preset does); Tab ▸ Direct light ▸ CAP rows
  smokeMultiScatter: 0, smokeTaaReact: 0.3, smokeDiffuseStart: 0.35, smokeUpsampleRelax: true, smokeDiffuseWeight: 'bilinear',   // (taareact 0.6 → 0.3 08-14: 'some pixelation in motion' — a fully reactive plume shows the march's own dither before anything averages it)   // (08-14 SHIP SET = the S1 blind-pairs winner 'combo': density 1.3 (smoke.ts) · MS off · upsample relax · TAAU smoke-reactive 0.6 · diffusion on — every part beat the 08-12 defaults pairwise; docs/internal/smoke-look2.md §5)   // (bilinear since the battery's first still: the four-texel max stippled the plume's edge over a bright front — docs/shots/sbx_base vs sbx_wbilin)
  smokeMarchLights: 0,                                       // the froxel-lit smoke march's own lights per step (0 = every light through J, as it was; the presets raise it — quality.ts Preset.caps.marchLights); Tab ▸ Volumetrics ▸ Smoke
  smokeShadowSteps: 8,                                       // shadow rays take eight samples through the smoke they cross — the estimator as it always was (docs/internal/smoke-perf.md §4 has 6 / 4's cost and look); Tab ▸ Smoke
  froxelVol: true, froxelH: 135, froxelD: 64, froxelK: 4, froxelHistory: 0.93, froxelNear: 0.5, froxelFar: 56, froxelCurve: 2.0, froxelBias: 0.0, froxelSharp: false, froxelTopRays: 2,   // froxel volumetrics ON (high's grid until a preset places its own); ?nofroxel / Tab ▸ Volumetrics — froxels
  particleBirths: 6144,        // = MAX_NEW_PER_FRAME, i.e. uncapped, until a preset places it; Tab ▸ Renderer — particles
  debrisCap: 64,               // the chaos budget's upper figure until a preset places it; Tab ▸ Sandbox ▸ chaos rows
  torchBounceCards: false,     // default off until the presets place it (quality.ts); Tab ▸ Indirect light
  directSeedHold: false,
  giAdaptiveHistory: false,
  gloss: false,
  decals: true,                // decals (E1): bullet holes, scorches, scuffs, chips in the g-buffer's fragment stage — on by default (Tab ▸ Renderer — decals; ?nodecals)
  meshShadowsNear: false,      // (quality.ts apply writes it with meshShadows: high = near-only, ultra = every ray)
  meshShadows: false,          // mesh-traced character shadows: the ULTRA preset switches it on (every ray) and HIGH in its near-only form, every other preset off (quality.ts apply); ?meshShadows / the Tab row flip it by hand until the preset next changes; Tab ▸ Direct light, the pause menu's trade-offs, or ?meshShadows
  gbaa: false,                 // GBAA off (Tab ▸ Frame; the image-quality program's per-tier configs place it with taauPhases 0)
  motionIds: true,             // motion identity for keyed dynamic boxes (Tab ▸ Frame; off = the index rule as it was)
  wetChars: true,              // wet characters: on (Tab ▸ Weather ▸ wet characters; nothing shows unless somebody is actually wet — weather off = everybody dry = the untouched path)
  gpuParticles: true,          // the experiment this branch is for: on unless ?noparticles / the Tab ▸ 'Renderer — particles (EXP)' row says otherwise; not part of any preset
  particleRain: true, particleRainCount: 4000, particleRainRadius: 0, particleRainDensity: 1, particleRainBright: 1, particleRainDrips: true, particleRainLattice: -1, particleRainReact: 6,   // PARTICLE RAIN: ON (v2) — ?norain2 boots without it, Tab ▸ Weather & wind ▸ Rain — particles flips it live; the count is 'high's until a preset places its own (quality.ts Caps.rain)
  glass: true, glassReflect: 1, glassTintDepth: 1, glassDust: 1,   // glass panes (E3): ON by default (?noglass boots without it; Tab ▸ Renderer — glass; the pause card's trade-offs row)
  glassRefract: true, glassIor: 1.5,   // refraction through the glass boxes: ON (?norefract boots without it; Tab ▸ Renderer — glass; __glass.refract / .ior)
  rtReflect: false, rtReflectDiv: 2, rtRays: 1, rtMaxRough: 0.45, rtAniso: 0.7, rtStrength: 1, rtGlints: 1, rtAtrous: 3, rtHistory: 32,   // RT reflections: OFF here — the presets switch it on with their own divisor / rays / cutoff (quality.ts); Tab ▸ Materials
  detail: 0.35,                // the detail layer: 'lived-in' (Tab ▸ Materials; ?detail=0 boots without it — with ?nortreflect the untouched frame)
  giResample: 'off', giResampleRays: 2, giResampleCap: 20, giResampleTaps: 3, giResampleRadius: 10, giResampleRevalidate: true,   // phase 5: OFF here — the ultra preset switches the three on (quality.ts Preset.p5); Tab ▸ Indirect light / Materials rows
  rtMeshHits: false, rtHitReuse: false,
  markings: true, markingTexel: 0.025, markingContrast: 1, markingEmissive: 1, markingReflect: true, markingReflPattern: true, markingReflCone: 0.25,   // markings ON (?nomarkings boots without them; Tab ▸ Renderer — markings)
  sdfRigSmooth: false, sdfRigK: 1, sdfRigSteps: 24, charSoftShadow: false, charSoftAnalytic: true, charSoftSteps: 20, charSoftK: 1, charSoftMinDeg: 0.35, charSoftSmooth: false, charSoftBroad: false, charSelfShadow: true,   // the SDF character rig's two extras: OFF (self-shadow: ON, all tiers) (rows on Tab ▸ Renderer — SDF character rig; ?sdfsmooth / ?charsoft from boot; no preset touches them) — the round cones themselves have no switch
});

/** the identity of a cascade GRID (what needs its own buffers / dice volume): probe counts, directions, cascade count — the interval length is a live uniform (RadianceCascades.setInterval0) */
const rcGridKey = (c: RcConfig) => `${c.nx}x${c.ny}x${c.nz}/d${c.d0}/c${c.cascades}`;

/** What the renderer needs from the smoke sim: the domain table (uniform), the density atlas, the per-brick render occupancy (`occ`, 16 words per domain,
 *  bound as a uniform block — see smokeDensityAt in common.wgsl), how many domain slots to walk, and the sim's encoder. */
export interface SmokeBinding { uniform: GPUBuffer; atlasView: GPUTextureView; occ: GPUBuffer; count: number; encode?: (enc: GPUCommandEncoder, ts: (n: string) => GPUComputePassTimestampWrites | undefined) => void; }

/** glassLightMasks' sample lattice: three stations along a pane × a cell just off either face (module consts — review R1.4: no per-light-per-pane literals) */
const GLASS_STATIONS: readonly number[] = [-0.7, 0, 0.7], GLASS_SIDES: readonly number[] = [-0.55, 0.55];

export class Engine {
  device: GPUDevice;
  world: BoxWorld;
  lights: LightSet;
  rc: RadianceCascades;
  gbuffer: GBuffer;
  passes: LightingPasses;
  timer: GpuTimer;
  /** the render-target pool the g-buffer and the lighting passes share (render/texpool.ts): a size the adaptive ladder returns to costs no allocation */
  pool: TexturePool;
  sceneLayout: GPUBindGroupLayout;
  sceneBG: GPUBindGroup | null = null;
  frameBuf: GPUBuffer; frameData = new ArrayBuffer(FRAME_BYTES);
  /** SHARP DIRECT this frame (settings.sharpDirect ∧ TAAU ∧ no debug view ∧ internal ≠ output — resize decides), the OUTPUT frame block (the same bytes with screen = the output size: frame.ts writeFrameOut)
   *  and its scene group, group 0 of every pass that runs at the output size then */
  sharpOn = false; frameBufOut: GPUBuffer; frameDataOut = new ArrayBuffer(FRAME_BYTES); sceneBGOut: GPUBindGroup | null = null;
  dummyStorage: GPUBuffer;
  smoke: SmokeBinding;
  settings: RenderSettings = defaultSettings();
  /** what the weather wants drawn in the outdoor air this frame (game/weather.ts writes it before render; all zero = nothing, the default) */
  weather: WeatherFrame = noWeather();
  /** the view's look-at point as of the last render() (the smoke solver ranks its domains by distance from it for half-rate stepping — smoke.ts fullRateDomains) */
  viewFocus: Vec3 = [0, 0, 0];
  frameIdx = 0;
  /** effectiveScale = internal height / (CSS height × dpr), the true pixel ratio (the cost model's unit; = capScale × renderScale); capScale = min(1, maxInternalHeight / (CSS height × dpr)),
   *  what renderScale 1.0 gets on this window */
  effectiveScale = 1; capScale = 1; lastDt = 1 / 60;
  /** internal (render) size — what the g-buffer and every lighting pass run at */
  width = 0; height = 0;
  /** OUTPUT size = the canvas backing store: with TAAU the cap's rows (min(maxInternalHeight, CSS height × dpr)) whatever the render scale — the resolve upsamples internal → this and the
   *  bloom / tonemap / sharpen run here; without it = the internal size, as it always was */
  outWidth = 0; outHeight = 0;
  // ---- TAAU bookkeeping (see RenderSettings.taau): this frame's jitter, the jittered matrices the frame uniform carries, and what the NEXT frame reprojects with
  /** this frame's jitter in internal pixels (0, 0 with TAAU off, under a debug view, or with taauPhases 0) */
  jitter: [number, number] = [0, 0];
  /** the previous render's jitter (frame.jitter.zw: a history keyed on the unjittered pixel — the gather's reservoirs — takes both jitters out of its reprojection) */
  private prevJitter: [number, number] = [0, 0];
  private vpJ = m4.create(); private invVpJ = m4.create();
  /** the previous RENDER's jittered / unjittered view-projection (what its depth and histories were made with) and camera pose (cut detection); valid once havePrev */
  private prevVpJ = m4.create(); private prevVpU = m4.create(); private prevCamPos: Vec3 = [0, 0, 0]; private prevCamFwd: Vec3 = [0, 0, -1]; private havePrev = false;
  /** the unjittered camera moved since the last render (direct-motion lane: passes.restirMotionLive keys on it) */
  camMovedAny = false;
  private taauWas = false; private debugWas = 0;
  /** GI in motion: frames left in which the young-history extra gather rays stand down after a cut / a wholesale history restart, and the denoiser core last frame ran with */
  private giCutHold = 0; private dnWas: 'v3' | 'legacy' = 'v3';
  /** why the TAAU history was last dropped, and how many times (the Tab panel words it; QA counts it) */
  taaResets = 0; lastTaaReset = '';
  /** Drop the TAAU history: the next resolve takes this frame's picture outright (a camera cut nobody could reproject across). The engine calls it itself on a jump of the eye
   *  (> 2.5 m or > 30° between two renders), when TAAU or a debug view switches, and on the first frame; game code may call it for cuts it knows about (harmless twice). */
  resetTaa(reason = 'by hand') { this.passes.resetTaa(); this.taaResets++; this.lastTaaReset = reason; }
  /** radical-inverse (Halton) of i in base b */
  private static halton(i: number, b: number) { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; }
  skin: SkinnedDrawable | null = null;
  /** mesh-shadow trees for the skinned characters (attached by whoever owns the CharacterRenderer: game.ts / the viewer); bound at scene binding 13 */
  meshShadows: MeshShadows | null = null;
  /** the decal list (experiment E1, render/decals.ts — owned by the Game, which feeds it; null in the viewer): synced + uploaded each frame before the g-buffer, which
   *  reads it at its group 1 binding 3 under FrameFlags.Decals */
  decals: Decals | null = null;
  /** the GPU particle system (render/particles.ts; attached by game.ts — the viewer has none): stepped after the cascades, drawn into the HDR target after the composite while settings.gpuParticles is on */
  particles: Particles | null = null;
  /** measurement only: timestamp the particles' render pass as 'pdraw' (render-pass timings are unreliable on Metal and feed every GPU total — leave off) */
  particlesTimeDraw = false;
  /** false when this adapter's storage-buffer budget left no slot for the mesh binding (frame.ts meshBinding): settings.meshShadows is then inert */
  readonly meshShadowsAvailable: boolean;
  cpuMs = { boxes: 0, encode: 0 };
  /** extra GPU work encoded after lighting (irradiance probes etc.): (enc, sceneBG, diceView, ts) */
  extraPasses: ((enc: GPUCommandEncoder, sceneBG: GPUBindGroup, diceView: GPUTextureView, ts: (n: string) => GPUComputePassTimestampWrites | undefined) => void)[] = [];
  afterSubmit: (() => void)[] = [];

  constructor(public gpu: Gpu, rcCfg: RcConfig = defaultRcConfig) {
    const device = this.device = gpu.device;
    const maxStorage = device.limits.maxStorageBuffersPerShaderStage;
    if (maxStorage < 9) reachBinding.storage = false;   // the per-light reach rows: storage by default (measured cheaper), the uniform binding when this adapter cannot afford a 9th storage buffer in the compute stage — decided HERE so the viewer and every other Engine user get the same fallback (main.ts only adds ?reachUniform for A/B)
    if (maxStorage < 8) throw new Error(`This GPU / browser exposes ${maxStorage} storage buffers per shader stage; the renderer needs 8 (scene group 6 + the cascade trace's / light probe's 2) — the WebGPU default, which every core (non-compatibility-mode) adapter provides.`);   // (readable on the #fatal card instead of a pipeline-creation failure deep in the pass graph; the per-light reach masks ride in a uniform to keep this at 8 — frame.ts binding 12)
    // the mesh-shadow trees want one more read-only storage slot in the scene group: 6 + reach (1 if storage) + mesh 1, plus the cascade trace's / probe's 2 in
    // their own group, must fit the per-stage limit — 10 with the reach rows in storage, which is exactly what Chrome offers on Metal. Where it does not fit the
    // binding is left out of the layout altogether (a stub meshLoad() in the prelude) and the experiment is unavailable rather than costing the reach rows their
    // measured storage path. Decided once, here, before any scene pipeline is compiled.
    meshBinding.enabled = 6 + (reachBinding.storage ? 1 : 0) + 1 + 2 <= maxStorage;
    this.meshShadowsAvailable = meshBinding.enabled;
    this.timer = new GpuTimer(device, gpu.hasTimestamps);
    this.sceneLayout = createSceneLayout(device);
    this.world = new BoxWorld(device);
    this.lights = new LightSet(device);
    this.frameBuf = makeBuffer(device, FRAME_BYTES, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'frame');
    this.frameBufOut = makeBuffer(device, FRAME_BYTES, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'frameOut');
    this.dummyStorage = makeBuffer(device, 256, GPUBufferUsage.STORAGE, 'dummy');
    // smoke placeholder until the sim is attached
    const dummyTex = device.createTexture({ size: [1, 1, 1], dimension: '3d', format: 'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING });
    const smokeUbo = makeBuffer(device, 64 * 8, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'smokeDomainsDummy');
    const smokeOcc = makeBuffer(device, 64 * 8 + 4 * 8, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'smokeOccDummy');   // 16 words × 8 domains + the 8 per-domain box words (= smoke.ts OCC_BUFFER_BYTES, common.wgsl array<vec4u, 34>), all zero (count is 0 anyway)
    this.smoke = { uniform: smokeUbo, atlasView: dummyTex.createView(), occ: smokeOcc, count: 0 };
    this.rc = new RadianceCascades(device, this.sceneLayout, { ...rcCfg }, true);   // (deferred: its kernels are init()'s, like every other boot pipeline)
    this.pool = new TexturePool(device);
    this.gbuffer = new GBuffer(device, this.sceneLayout, this.pool, this.world.maxBoxes);   // (its previous-transform buffer is sized to the world's box capacity)
    this.passes = new LightingPasses(device, this.sceneLayout, gpu.format, gpu.linearSampler, this.pool);
  }

  /** true once init() has resolved: every boot pipeline exists and render() may run */
  ready = false;
  /** THE BOOT'S SECOND HALF. The constructor is synchronous and cheap (layouts, buffers, shader-module handles); this creates every pipeline the renderer boots with — the cascades',
   *  the g-buffer's, the lighting passes' (+ froxels, the v3 denoiser, the target-ops kernels) — through createComputePipelineAsync / createRenderPipelineAsync (gpu/device.ts has
   *  the why: the synchronous forms froze the whole browser on a cold shader cache), all in flight at once, and resolves when the last is ready. `opts.sharp` / `opts.gbaa`: also
   *  prepare the sharp-direct trio + its g-buffer down pass / the GBAA kernel, which are otherwise compiled synchronously on the first frame a preset switches them on. Await it
   *  (or use Engine.create) before the first render(); gpu/device.ts pipelineProgress counts the pipelines in for a progress line. */
  init(opts: { sharp?: boolean; gbaa?: boolean; onGroup?: (name: string) => void } = {}): Promise<void> {
    return this.initP ??= Promise.all([this.rc.init().then(() => opts.onGroup?.('cascades')), this.gbuffer.init({ sharp: opts.sharp }).then(() => opts.onGroup?.('gbuffer')), this.passes.init(opts)])   // (onGroup: the boot timeline's per-group marks — passes reports froxels / denoiser / targetOps / passes itself)
      .then(() => { this.ready = true; });   // (memoised: a second caller awaits the same build)
  }
  private initP: Promise<void> | null = null;
  /** construct + init in one await (the viewer, the editor, tools) */
  static async create(gpu: Gpu, opts: { sharp?: boolean; gbaa?: boolean; rcCfg?: RcConfig; onGroup?: (name: string) => void } = {}): Promise<Engine> {
    const e = new Engine(gpu, opts.rcCfg ?? defaultRcConfig);
    await e.init(opts);
    return e;
  }

  setSmoke(s: SmokeBinding) { this.smoke = s; this.sceneBG = null; this.sceneBGOut = null; }
  /** Attach the mesh-shadow trees for the characters `skin` draws (or null to detach); the scene group rebinds on the next frame. */
  setMeshShadows(m: MeshShadows | null) { this.meshShadows = m; this.sceneBG = null; this.sceneBGOut = null; }
  /** the SDF character rig's radius fit for the mannequin `skin` draws (render/sdfrig.ts fitRig — game.ts / the viewer attach it beside the mesh shadows). BoxWorld.upload packs it into every frame's proxy
   *  list (fitted r0 / r1 per slot, the cull sphere fitted); null = the list as the game wrote it: hand radii, no taper byte (each record traced as an untapered cone), 1.5 m spheres */
  rigFit: RigFit | null = null;
  setRigFit(f: RigFit | null) { this.rigFit = f; }
  /** Are the proxies the FITTED cones this frame? (a fit attached — the game and the viewer always attach one; without it they are the game's hand capsules traced as untapered cones) */
  get sdfRigOn(): boolean { return !!this.rigFit; }
  /** Attach the decal list the g-buffer reads (or null); the g-buffer's object group rebinds by itself (keyed on the buffer). */
  setDecals(d: Decals | null) { this.decals = d; }
  /** Is FrameFlags.Decals up this frame? (the setting, a list attached, and at least one mark in it — an empty list costs the fragment stage nothing) */
  get decalsOn(): boolean { return this.settings.decals && !!this.decals && this.decals.count > 0; }
  /** Attach the GPU particle system (or null): its passes join the frame from the next render() while settings.gpuParticles is on. */
  setParticles(p: Particles | null) { this.particles = p; }
  /** Is the GPU particle path live this frame? (the setting ∧ a Particles attached) — what game/particleFx.ts routes the effect sites by */
  get particlesOn(): boolean { return this.settings.gpuParticles && !!this.particles; }

  /** A new cascade grid (a preset with another probe density, the Tab panel's 'rebuild cache'). WORLD-SPACE cache: what a (re)started instance does about its empty / stale contents
   *  (amortized upkeep, holding the old dice while the new one fills…) is render/rc.ts's business (renderer v3 lane P0-A); this side only decides WHICH instance is live and rebuilds
   *  the bind groups that name its dice view. The SCREEN histories are deliberately left alone: the indirect's history converges on the refilled cache through its own clip + EMA.
   *  Instances are PARKED by grid, not destroyed (rcPark): the auto ladder's medium ↔ low step crosses probe grids, and building an instance costs 10–40 ms of pipeline / buffer
   *  creation on the reference machine (measured 08-11) — a parked one is swapped back in for nothing, still holding the light field it had (minutes stale at worst: closer to right
   *  than the black a fresh one starts from; the dice EMA refreshes 90 % of it in seven frames). ~1.5 MB per parked grid. A rebuild request for the grid already live (the Tab
   *  button) still starts that grid over from nothing, as it says. */
  rebuildRc(cfg: RcConfig) {
    const key = rcGridKey(cfg), cur = rcGridKey(this.rc.cfg);
    if (key === cur) { this.rc.destroy(); this.rc = new RadianceCascades(this.device, this.sceneLayout, { ...cfg }); this.rc.invalidateWorld(); }   // (re-primed: whole-level bakes first + a history-free first dice bake — P0-A)
    else {
      const old = this.rc; this.rcPark.set(cur, old);
      const parked = this.rcPark.get(key);
      if (parked) { this.rcPark.delete(key); parked.setInterval0(cfg.interval0); this.rc = parked; }
      else { this.rc = new RadianceCascades(this.device, this.sceneLayout, { ...cfg }); this.rc.invalidateWorld(); }
      this.rc.staggerUpper = old.staggerUpper;   // (halfRate / diceBlend are written every frame; the stagger switch is a by-hand Tab row — it follows the renderer, not the instance)
      while (this.rcPark.size > 2) { const [k, v] = this.rcPark.entries().next().value as [string, RadianceCascades]; v.destroy(); this.rcPark.delete(k); }
    }
    this.passes.externalViewsChanged(); this.sceneBG = null;
  }
  /** parked cascade instances by grid (rebuildRc) */
  private rcPark = new Map<string, RadianceCascades>();
  /** Build (and park) the instances for these grids now — at boot, behind the start card, where pipeline creation is free — so the ladder's first step onto any of them later
   *  swaps instead of builds (ui/quality.ts hands over the ladder's grids). No-op for the live grid or one already parked. */
  prewarmRc(cfgs: RcConfig[]) {
    // A prewarmed instance has never baked: its dice is zeros, which is no history — re-primed like rebuildRc's fresh build (whole-level bakes + a history-free first
    // dice bake once it goes live), else its first ~10 live frames blend the real field in at 0.3 a frame from black and the bounce, the smoke's ambient AND the light
    // meter dip on the ladder's first hop onto it (review R10.1). The flags just sit on the parked instance until it is swapped in.
    for (const cfg of cfgs) {
      const key = rcGridKey(cfg); if (key === rcGridKey(this.rc.cfg) || this.rcPark.has(key)) continue;
      const inst = new RadianceCascades(this.device, this.sceneLayout, { ...cfg }); inst.invalidateWorld(); this.rcPark.set(key, inst);
    }
  }
  get rcParked(): string[] { return [...this.rcPark.keys()]; }
  /** Something changed the WORLD wholesale (level geometry reloaded, the light rig swapped — lighting.ts setDaylight): re-prime the radiance cache in place (rc.invalidateWorld —
   *  P0-A) AND every parked grid, which would otherwise come back on a later hop holding the field from before the change (a night grid parked through the daytime show, a
   *  day grid swapped in at night: seven frames of the wrong bounce and the wrong light-meter reading — review R10.1). Not for screen events — resize / scale / checkerboard /
   *  divisor flips leave the world cache valid and must not call this. */
  invalidateWorldCache() { this.rc.invalidateWorld(); for (const parked of this.rcPark.values()) parked.invalidateWorld(); }

  private ensureSceneBG() {
    const meshBuf = this.meshShadows?.buf ?? this.dummyStorage;   // (256 zero bytes = a zero header = an empty tree, and the flag is never raised without a MeshShadows anyway)
    if (this.sceneBG && this.sceneBGItems === this.world.itemBuf && this.sceneBGMesh === meshBuf) return;
    this.sceneBG = createSceneBindGroup(this.device, this.sceneLayout, {
      frame: this.frameBuf, boxGeo: this.world.geoBuf, boxMat: this.world.matBuf, gridCells: this.world.cellBuf, gridItems: this.world.itemBuf,
      sceneInfo: this.world.infoBuf, lights: this.lights.buf, smoke: this.smoke.uniform, smokeAtlasView: this.smoke.atlasView, smokeOcc: this.smoke.occ, lightReach: this.lights.reachBuf, linSamp: this.gpu.linearSampler, capsules: this.world.capsuleBuf,
      mesh: meshBuf,
    });
    this.sceneBGItems = this.world.itemBuf; this.sceneBGMesh = meshBuf;
  }
  private sceneBGItems: GPUBuffer | null = null; private sceneBGMesh: GPUBuffer | null = null;
  /** the OUTPUT frame block's twin of the scene group (sharp direct): every resource the same but binding 0 = frameBufOut; rebuilt with the same keys */
  private ensureSceneBGOut() {
    const meshBuf = this.meshShadows?.buf ?? this.dummyStorage;
    if (this.sceneBGOut && this.sceneBGOutItems === this.world.itemBuf && this.sceneBGOutMesh === meshBuf && this.sceneBGOutSmoke === this.smoke.uniform) return;
    this.sceneBGOut = createSceneBindGroup(this.device, this.sceneLayout, {
      frame: this.frameBufOut, boxGeo: this.world.geoBuf, boxMat: this.world.matBuf, gridCells: this.world.cellBuf, gridItems: this.world.itemBuf,
      sceneInfo: this.world.infoBuf, lights: this.lights.buf, smoke: this.smoke.uniform, smokeAtlasView: this.smoke.atlasView, smokeOcc: this.smoke.occ, lightReach: this.lights.reachBuf, linSamp: this.gpu.linearSampler, capsules: this.world.capsuleBuf,
      mesh: meshBuf,
    });
    this.sceneBGOutItems = this.world.itemBuf; this.sceneBGOutMesh = meshBuf; this.sceneBGOutSmoke = this.smoke.uniform;
  }
  private sceneBGOutItems: GPUBuffer | null = null; private sceneBGOutMesh: GPUBuffer | null = null; private sceneBGOutSmoke: GPUBuffer | null = null;
  /** The scene bind group (group 0 of every scene pipeline), built if need be — for tools that run their own kernel against the live scene (MeshShadows.debugTrace). */
  sceneBindGroup(): GPUBindGroup { this.ensureSceneBG(); return this.sceneBG!; }
  /** Is the mesh-shadow path live this frame? (the setting, the adapter budget and an attached MeshShadows all three) */
  get meshShadowsOn(): boolean { return this.settings.meshShadows && this.meshShadowsAvailable && !!this.meshShadows; }

  resize() {
    const canvas = this.gpu.canvas;
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.max(1, Math.floor(canvas.clientWidth * dpr)), ch = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    // canvas backing store at internal res; browser upscales. Internal height = min(maxInternalHeight, CSS height × dpr) × renderScale: the cap is what ×1.0 means on
    // this window and every step of the scale below it renders fewer pixels (until 08-11 the scale multiplied the window and was THEN capped, so on a HiDPI window —
    // 1440 device px against a 1000-px cap — everything from ×0.70 to ×1.00 rendered the same 1000 rows: a dead zone on the slider and rungs the adaptive ladder
    // announced but never took)
    const capH = Math.min(this.settings.maxInternalHeight, ch);                            // the rows this window gets at the current cap (render scale 1.0)
    const h = Math.max(16, Math.floor(capH * Math.max(0.05, Math.min(1, this.settings.renderScale || 1)) + 1e-6));
    const scale = h / ch, w = Math.max(16, Math.floor(cw * scale + 1e-6));
    this.capScale = capH / ch; this.effectiveScale = scale;   // effectiveScale keeps its meaning — internal / (CSS × dpr), what was actually rendered — the cost model's pixel term and game.ts's metres-per-pixel are in those units
    // OUTPUT size: with TAAU the cap's rows whatever the scale (exactly what scale 1.0 renders — so the resolve's cost is bounded by the preset, and 'TAAU at 0.77' presents the same canvas as 'no TAAU at
    // 1.0'); without it the internal size (the canvas the browser upscales, as before)
    const oh = this.settings.taau ? Math.max(16, Math.floor(capH + 1e-6)) : h, ow = this.settings.taau ? Math.max(16, Math.floor(cw * (oh / ch) + 1e-6)) : w;
    if (canvas.width !== ow || canvas.height !== oh) { canvas.width = ow; canvas.height = oh; }
    // SHARP DIRECT: live only where there is something to decouple — TAAU on (the output-size history), the internal size below the output, and no debug view (those bypass the resolve and read
    // internal-size diagnostics); mirrored into the passes BEFORE their resize, like the TAAU switch (the composite-size set follows it)
    const sharp = !!this.settings.sharpDirect && this.settings.taau && this.settings.debugView === 0 && (ow !== w || oh !== h);
    this.passes.setSharp(sharp);
    this.passes.setGbaa(!!this.settings.gbaa && this.settings.taau && this.settings.debugView === 0 && (sharp || this.settings.taauPhases <= 0));   // GBAA: on the TAAU path only (its blend sits between the composite and the resolve; the debug views and the FXAA chain bypass it), and only on a 1 : 1 raster it can own — sharp direct live, or the jitter off — never under the jittered upscale (that is C4: measured softer than main)
    this.passes.setSceneCopy(!!this.settings.particleRain && !!this.particles);   // PARTICLE RAIN v2: keep a copy of the composite for the rain streaks to refract (GBAA's own when GBAA is on; else one the particles fill before their splat) — off = nothing kept
    if (w !== this.width || h !== this.height || ow !== this.outWidth || oh !== this.outHeight || this.passes.stale || sharp !== this.sharpOn) {   // (stale: TAAU / GBAA switched — the output- or composite-size set is rebuilt even at an unchanged size)
      this.width = w; this.height = h; this.outWidth = ow; this.outHeight = oh; this.sharpOn = sharp;
      this.gbuffer.keepTargets = this.passes.keepHistories = this.settings.keepHistories;
      this.gbuffer.resize(w, h, ow, oh, sharp); this.passes.resize(w, h, ow, oh); this.passes.externalViewsChanged();   // (the passes' bind groups name the g-buffer's views: rebuilt against the new ones)
    }
  }

  /** GLASS: per light, the bits of the listed panes (world.glassList order = SceneInfo.glass order; the first 24) that light can possibly shine THROUGH onto
   *  anything: the pane's bounds inside the light's range box (a directional light: every pane), and — for a light with a reach mask (reach.ts: the level's
   *  static fixtures) — some 1 m cell just off either face of the pane inside that mask (a light that reaches neither side of a pane lights nothing through
   *  it). Errs toward 'set' like the reach masks themselves. → RtLight.glassMask, which upload() packs above the owner byte; direct.wgsl glassPairMask narrows
   *  it per 8×8 tile. lights × panes cheap tests a frame; nothing with the experiment off or no pane listed. */
  /** irradiance (W/m², unshadowed, on-axis) under which a light's tint through a pane is invisible: a 20 % tint of it is under half a per cent of display white */
  static readonly GLASS_MIN_E = 0.02;
  /** froxel volumetrics: the height (m) above which nothing scatters light anyone can see (street-lamp heads at 5 m, plumes and beams under them) — the grid's near boundary is at least the camera's
   *  height over it, so the follow camera's first slices are not spent on open air; the near boundary of the frame before, for the history's reprojection */
  static readonly FROXEL_CONTENT_TOP = 8; private froxelPrevNear = 0; private froxelMapKey = 0;
  /** the froxels have rendered a frame since boot (the boot's own 'first frame' cut restarts nothing — there is no history yet — so a boot renders the bits it always did) */
  private havePrevFrox = false;
  private glassLightMasks() {   // (GLASS_STATIONS / GLASS_SIDES below the class: the sample lattice as module consts, not two array literals per light per pane per frame — review R1.4)
    const w = this.world, list = this.settings.glass ? w.glassList : [];
    const LL = this.lights.lights;
    if (!list.length) { for (let i = 0; i < LL.length; i++) LL[i].glassMask = 0; return; }
    const W = WORLD.gridW, H = WORLD.gridH, cs = WORLD.gridCell;
    const cellOf = (x: number, z: number) => { const cx = Math.floor((x - WORLD.min[0]) / cs), cz = Math.floor((z - WORLD.min[2]) / cs); return cx < 0 || cz < 0 || cx >= W || cz >= H ? -1 : cz * W + cx; };
    for (let n = 0; n < LL.length; n++) {
      const l = LL[n]; if (!l.enabled) { l.glassMask = 0; continue; }
      let m = 0;
      const peak = Math.max(l.color[0], l.color[1], l.color[2]) * l.intensity;   // on-axis intensity (W/sr-ish): what evalLight divides by d²
      const cosO = Math.cos(Math.min(89, l.outerDeg + 8) * Math.PI / 180);      // a spot's cone, opened 8° (the pane is judged by a handful of points, not its whole face)
      for (let k = 0; k < list.length && k < 24; k++) {
        const b = w.statics[list[k]]; if (!b) continue;
        if (l.kind !== 2) {   // range box vs the pane's world bounds; then: could this light put GLASS_MIN_E on any of the pane at all (distance to its nearest point, the spot's cone / the panel's facing over its corners and centre)? A light too dim or pointed away tints nothing anybody can see
          const c = Math.abs(Math.cos(b.yaw)), sn = Math.abs(Math.sin(b.yaw)); const ex = c * b.h[0] + sn * b.h[2], ez = sn * b.h[0] + c * b.h[2];
          const r = l.range + 0.05;
          if (Math.abs(l.pos[0] - b.c[0]) > r + ex || Math.abs(l.pos[1] - b.c[1]) > r + b.h[1] || Math.abs(l.pos[2] - b.c[2]) > r + ez) continue;
          const qx = Math.max(Math.abs(l.pos[0] - b.c[0]) - ex, 0), qy = Math.max(Math.abs(l.pos[1] - b.c[1]) - b.h[1], 0), qz = Math.max(Math.abs(l.pos[2] - b.c[2]) - ez, 0);
          const d2 = Math.max(qx * qx + qy * qy + qz * qz, l.radius * l.radius, 0.01);
          if (peak / d2 < Engine.GLASS_MIN_E) continue;
          if ((l.kind === 1 || l.kind === 3) && qx * qx + qy * qy + qz * qz > (ex + b.h[1] + ez) ** 2 * 0.5) {   // facing (only judged from further off than ~the pane's own size: a torch a metre from a bay aimed between the sample points must not drop the bit and pop the tint): some corner / the centre of the pane inside the (opened) cone, or in front of the one-sided panel
            let facing = false;
            for (let ci = 0; ci < 9 && !facing; ci++) {
              const px = ci === 8 ? b.c[0] : b.c[0] + (ci & 1 ? ex : -ex), py = ci === 8 ? b.c[1] : b.c[1] + (ci & 2 ? b.h[1] : -b.h[1]), pz = ci === 8 ? b.c[2] : b.c[2] + (ci & 4 ? ez : -ez);
              const dx = px - l.pos[0], dy = py - l.pos[1], dz = pz - l.pos[2]; const dl = Math.hypot(dx, dy, dz) || 1;
              const cd = (dx * l.dir[0] + dy * l.dir[1] + dz * l.dir[2]) / dl;
              facing = l.kind === 3 ? cd > 0.02 : cd > cosO;
            }
            if (!facing) continue;
          }
        }
        if (l.reach) {   // some cell just off either face, at three stations along the pane, inside the light's reach
          const thinX = b.h[0] < b.h[2];   // thin along local x (a pane in a wall along Z) or along local z
          const c = Math.cos(b.yaw), sn = Math.sin(b.yaw);
          const nx = thinX ? c : sn, nz = thinX ? -sn : c;                 // world direction of the thin axis (local +x → (cos, 0, −sin), +z → (sin, 0, cos))
          const tx = thinX ? sn : c, tz = thinX ? c : -sn;                 // …and of the long one
          const half = thinX ? b.h[2] : b.h[0];
          let any = false;
          for (const u of GLASS_STATIONS) for (const side of GLASS_SIDES) { const ci = cellOf(b.c[0] + tx * u * half + nx * side, b.c[2] + tz * u * half + nz * side); if (ci >= 0 && reachLevel(l.reach, ci) > 0) { any = true; break; } }
          if (!any) continue;
        }
        m |= 1 << k;
      }
      l.glassMask = m >>> 0;
    }
  }
  private offscreenTarget: GPUTexture | null = null;
  /** Read back the last offscreen frame (render with present=false first) as RGBA8 pixels — for automated captures. */
  async readbackFrame(): Promise<{ w: number; h: number; data: Uint8Array; bgra: boolean } | null> {
    const tex = this.offscreenTarget; if (!tex) return null;
    const w = tex.width, h = tex.height; const bpr = Math.ceil(w * 4 / 256) * 256;
    const buf = this.device.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const enc = this.device.createCommandEncoder(); enc.copyTextureToBuffer({ texture: tex }, { buffer: buf, bytesPerRow: bpr }, [w, h]); this.device.queue.submit([enc.finish()]);
    await buf.mapAsync(GPUMapMode.READ);
    const src = new Uint8Array(buf.getMappedRange()); const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) data.set(src.subarray(y * bpr, y * bpr + w * 4), y * w * 4);
    buf.unmap(); buf.destroy();
    return { w, h, data, bgra: this.gpu.format.startsWith('bgra') };
  }
  /** present=false renders into an internal target instead of the swap chain (scripted runs while the tab is hidden, where getCurrentTexture() stalls). */
  render(cam: FollowCamera, time: number, dt: number, present = true) {
    if (!this.ready) throw new Error('Engine.render() before init() resolved — await engine.init() / Engine.create() first');   // (a readable line instead of setPipeline(undefined) deep in a pass)
    this.lastDt = dt; this.viewFocus = cam.target;
    this.passes.smokeDiffuseBilinear = this.settings.smokeDiffuseWeight === 'bilinear'; this.passes.smokeDiffuseTau0 = this.settings.smokeDiffuseStart ?? 0.35;   // (smoke battery experiment, post.wgsl diffuseMode)
    this.gbuffer.keepTargets = this.passes.keepHistories = this.settings.keepHistories;   // (the switch for everything a change of size does — texpool.ts; mirrored before either can happen below)
    if (!this.settings.keepHistories && this.pool.parkedBytes) this.pool.evict(true);    // switched off: nothing stays parked
    else this.pool.tick();                                                                 // parked targets not wanted back within a couple of minutes are let go
    this.passes.setDivisors(this.settings.gatherThird ? 3 : 2, this.settings.volQuarter ? 4 : 2);   // (lossy options; re-creates the targets on the grid that changed)
    this.passes.setTaau(this.settings.taau);   // (mirrored before resize: the output-size target set — the resolve's history pair — exists only while it is on)
    this.passes.setRt(this.settings.rtReflect, this.settings.rtReflectDiv);   // (likewise before resize: the reflection targets' divisor — pooled + re-made on change like the gather's — and the switch that first allocates them at all)
    this.passes.setGi(this.settings.giResample !== 'off');   // (phase 5, likewise: the gather's reservoir pair exists from the first frame resampling is asked for — an off machine pays no memory)
    this.passes.setGiFull(!!this.settings.giFullRes && this.settings.denoiser !== 'legacy', this.settings.giFullIters);   // (GI in motion, likewise before resize: the diffuse client's INTERNAL-res set exists from the first frame it is asked for; the v3 core only)
    this.passes.setHitReuse(this.settings.rtHitReuse);      // (phase 5: the reflection pass's hit-record pair, made on first use the same way)
    this.resize();
    cam.aspect = this.width / this.height;
    cam.rebuild();
    // ---- TAAU: this frame's jitter and the matrices everything downstream sees. The jitter is a translation of the projection in NDC (content at unjittered pixel s lands at s + jitter); the
    // frame uniform carries the JITTERED view-projection, its inverse and the previous render's jittered one, so the g-buffer, every pass that rebuilds a ray from a pixel (worldFromDepth) and
    // every reprojection into an internal-resolution history agree to the bit; only the resolve (and the HUD, which projects on the CPU with the camera's own matrices) ever sees unjittered ones.
    const taauOn = this.settings.taau, s0 = this.settings;
    if (taauOn !== this.taauWas) { this.taauWas = taauOn; if (taauOn) this.resetTaa('taau on'); }
    if (taauOn && (s0.debugView !== 0) !== (this.debugWas !== 0)) this.resetTaa('debug view');
    this.debugWas = s0.debugView;
    let jx = 0, jy = 0;
    if (taauOn && s0.debugView === 0 && s0.taauPhases > 0) { const n = Math.max(1, Math.floor(s0.taauPhases)); const i = (this.frameIdx % n) + 1; jx = Engine.halton(i, 2) - 0.5; jy = Engine.halton(i, 3) - 0.5; }
    const decouple = this.sharpOn && !!s0.sharpDecouple && (jx !== 0 || jy !== 0);   // DECOUPLED JITTER: the internal raster keeps the full ±½ INTERNAL-px jitter, the output raster none (writeFrameOut / jitterRes below)
    if (this.sharpOn && !decouple) { jx *= this.width / this.outWidth; jy *= this.height / this.outHeight; }   // sharp direct: the raster to antialias is the OUTPUT one — ± ½ output px, expressed in internal px as everything downstream expects (the same NDC translation either way)
    this.jitter[0] = jx; this.jitter[1] = jy;
    m4.copy(this.vpJ, cam.viewProj);
    if (jx !== 0 || jy !== 0) { const ax = 2 * jx / this.width, ay = -2 * jy / this.height; for (let c = 0; c < 4; c++) { const w = this.vpJ[c * 4 + 3]; this.vpJ[c * 4] += ax * w; this.vpJ[c * 4 + 1] += ay * w; } m4.invert(this.invVpJ, this.vpJ); }
    else m4.copy(this.invVpJ, cam.invViewProj);
    let cutNow = false;   // (a cut this frame: the young-history extra gather rays stand down for it — every texel is young on a cut and the picture is being cut anyway; giCfg below)
    if (!this.havePrev) { m4.copy(this.prevVpJ, this.vpJ); m4.copy(this.prevVpU, cam.viewProj); this.prevCamPos = v3.copy(cam.pos); this.prevCamFwd = v3.copy(cam.forward); this.havePrev = true; cutNow = true; if (taauOn) this.resetTaa('first frame'); }
    else {   // a cut nobody can reproject across: the eye jumped rooms (> 2.5 m between two renders — 150 m/s; the follow camera is damped, the tour / breach / attract cut) or swung > 30° at once
      const jump = v3.dist(cam.pos, this.prevCamPos), turn = v3.dot(cam.forward, this.prevCamFwd);
      if (jump > 2.5 || turn < 0.866) { cutNow = true; if (taauOn) this.resetTaa(jump > 2.5 ? `cut (${jump.toFixed(1)} m)` : 'cut (turn)'); else this.passes.dropRestirBeliefs(); }   // (resetTaa drops the ReSTIR tiles' light beliefs too; without TAAU that is all a cut needs from here)
    }
    if (cutNow) this.giCutHold = Math.max(1, Math.round(this.settings.giYoungLen)) + 1; else if (this.giCutHold > 0) this.giCutHold--;   // (held until the histories a cut restarted are no longer 'young' by the gather's own test — else the whole grid asks on the frame the hold ends)
    { const dn = this.settings.denoiser === 'legacy' ? 'legacy' : 'v3'; if (dn !== this.dnWas) { this.dnWas = dn; this.passes.youngHold = 6; } }   // (the denoiser switch this frame zeroes the diffuse moments in the encode below: fold it in now, not a frame late)
    if (this.passes.youngHold > 0) { this.giCutHold = Math.max(this.giCutHold, Math.max(this.passes.youngHold, Math.round(this.settings.giYoungLen) + 1)); this.passes.youngHold = 0; }   // the same for a wholesale history restart the passes did (restartHistories, the denoiser switch, a keepHistories-off resize)
    const matSame = this.prevVpU.every((v, i) => v === cam.viewProj[i]);
    const camStill = taauOn && matSame;
    // the CAMERA's own motion this frame in output px (the look-at point and four points 3 m round it through the previous / current unjittered view-projection — an orbit leaves the
    // look-at itself still): the motion-sharpen term of the final blit (taauSharpenMotion) and the direct-motion twin's switch below
    let px = 0;
    if (this.havePrev && !matSame) {
      const prj = (m: ArrayLike<number>, q: Vec3): [number, number] | null => { const x = m[0] * q[0] + m[4] * q[1] + m[8] * q[2] + m[12], y = m[1] * q[0] + m[5] * q[1] + m[9] * q[2] + m[13], w = m[3] * q[0] + m[7] * q[1] + m[11] * q[2] + m[15]; return w > 1e-4 ? [x / w, y / w] : null; };
      for (const off of [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]]) { const q: Vec3 = [cam.target[0] + off[0], cam.target[1], cam.target[2] + off[1]]; const a = prj(this.prevVpU, q), b = prj(cam.viewProj, q); if (a && b) px = Math.max(px, Math.hypot((b[0] - a[0]) * 0.5 * (this.outWidth || this.width), (b[1] - a[1]) * 0.5 * (this.outHeight || this.height))); }
    }
    // the unjittered camera MOVED since the last render (TAAU or not; a cut is not motion): the direct-motion lane's twin ReSTIR program dispatches on these frames only. By displacement,
    // not matrix equality — the follow camera's damping keeps nudging the f32 matrices for seconds after the picture has visibly settled, and the twin (+0.2 ms at high, its levers inert
    // under a pixel's own 1 px/frame) would run all that while (review of 5a08434); 0.02 px a frame is far under anything either program does differently
    this.camMovedAny = this.havePrev && !cutNow && px > 0.02;
    let camMot = 0;
    if (taauOn && !camStill) camMot = Math.max(0, Math.min(1, (px - 0.125) / 0.375));   // 0 at ≤ ⅛ px / frame … 1 at ≥ ½ (taau.wgsl MOTION_PX's ramp)
    const t0 = performance.now();
    this.world.glassEnabled = this.settings.glass; this.world.glassFocus = cam.target;   // (the pane list is nearest-to-the-look-at first, and empty with the experiment off)
    this.world.markingsEnabled = this.settings.markings;
    this.world.rig = this.rigFit ? { r0: this.rigFit.r0, r1: this.rigFit.r1, kPad: RIG_KPAD * Math.max(1, this.settings.sdfRigK ?? 1) } : null;   // the SDF rig: the fit packed into this frame's proxy list at upload (r0 over the hand radius, r1 in misc's top byte, the cull sphere fitted + the smooth union's bulge at k ≥ 1 — never tighter than the k = 1 sphere: it is also the mesh shadows' broad phase at ultra, and a finger can reach a few cm past the forearm cone) — null = no fit attached: the list as the game wrote it
    this.world.motionIds = this.settings.motionIds !== false;   // motion identity: keyed dynamic boxes hand the g-buffer last frame's index of their key (off = the bare index, the old rule)   // markings: off = every box uploads slot 0 and its plain albedo in the secondary row (the frame as it was)
    { const mt = Math.max(0.005, Math.min(0.2, this.settings.markingTexel)); if (this.settings.markings && mt !== this.world.markingTexel) this.world.repackMarkings(mt); }   // the base texel moved (the review page's A/B): every list repacked at the new lattice
    this.world.upload();
    this.glassLightMasks();   // (glass: which listed panes each light can reach at all → RtLight.glassMask, packed by the upload below; all 0 with the experiment off)
    this.lights.dirMasks = this.settings.restir;   // the moon's / sun's directional reach masks ride only with the ReSTIR estimator (render/reach.ts reachMaskForDirectional; the OFF path's rows stay as they were)
    const numLights = this.lights.upload(time);
    if (this.decals) { this.decals.enabled = this.settings.decals; this.decals.frame(this.world); }   // decals (E1): the setting is the switch (off = nothing recorded or written); attached marks follow their boxes as of THIS upload, the buffer is rewritten only when the list changed
    this.passes.setDecalBuffer(this.decals?.buf ?? null);   // (the composite reads it too: the crack stars rounds leave on glass panes — a no-op unless the buffer changed)
    this.cpuMs.boxes = performance.now() - t0;
    this.ensureSceneBG();

    const s = this.settings;
    // torch bounce cards: nominate the carried spots (RtLight.card) uploaded this frame — the MAX_CARDS nearest the view's look-at point if there are more —
    // by light slot; cards.wgsl rebuilds each one's footprint card ahead of the gather. None with the setting off (no dispatch, flag down).
    const cardSlots = s.torchBounceCards ? cardSlotsFor(this.lights.lights, cam.target, MAX_CARDS) : [];
    this.passes.numCards = cardSlots.length;
    const meshOn = this.meshShadowsOn;   // FrameFlags.MeshShadows this frame (setting ∧ adapter budget ∧ trees attached); the trees are re-skinned + refit below before anything traces
    const decalsOn = this.decalsOn;      // FrameFlags.Decals this frame (setting ∧ a list attached ∧ something in it)
    const partOn = this.particlesOn;     // FrameFlags.Particles this frame (setting ∧ a Particles attached): its emits are dealt slots and uploaded now, stepped after the cascades, drawn after the composite
    const rtOn = s.rtReflect;            // RT reflections this frame (frame.rtCfg.w = the divisor, 0 while off) — and Gloss is then held DOWN whatever settings.gloss says (the reflection pass covers the polished floors: rtReflect ⊃ gloss)
    const giMode = s.giResample === 'full' ? 2 : s.giResample === 'temporal' ? 1 : 0;   // phase 5: the gather's reservoir resampling this frame (frame.p5Cfg.x; passes.setGi — mirrored above, before resize — makes / keeps its reservoir pair)
    const rtP5Bits = (s.rtMeshHits && meshOn ? 1 : 0) | (s.rtHitReuse ? 2 : 0);   // phase 5: the reflection pass's bits (frame.p5Cfg.z) — any of them up dispatches the reflect_p5.wgsl variant, none = main's reflect.wgsl, the same program as before the phase
    const rigBits = (s.sdfRigSmooth ? 2 : 0) | (s.charSoftShadow ? 4 : 0) | (s.charSoftShadow && s.charSoftAnalytic ? 8 : 0) | (s.charSoftSmooth ? 16 : 0) | (s.charSoftBroad ? 32 : 0) | (s.charSelfShadow ? 64 : 0) | (s.meshShadowsNear ? 128 : 0);   // the SDF character rig's EXTRAS this frame (frame.rigCfg.x: 2 smooth-union closest hit · 4/8/16/32 the soft character query · 64 character self-shadow · 128 mesh shadows near-only; bit 1 retired — the round cones themselves are unconditional)
    this.passes.rtP5 = rtP5Bits !== 0 || (rigBits & 2) !== 0;   // (the rig's smooth closest hit rides in the same variant's tracer tail — reflect.wgsl stays main's program)
    this.particles?.prepare(dt, partOn, s.particleBirths);
    // froxel volumetrics (Phase 2b): the grid follows the preset's rows / slices and the window's aspect (a preset hop or a reshape re-makes it and restarts its history; the render scale never
    // touches it); a spell off lets the volumes go after ten seconds. FrameFlags.FroxelVol is up exactly while a grid is dispatched.
    const numTransientNow = this.lights.lights.reduce((n, l) => n + ((l.ttl >= 0 || l.transient) && l.enabled ? 1 : 0), 0);   const firstTransientNow = numTransientNow ? this.lights.firstTransientSlot : 0;   // (+ the lowest SLOT holding one, from the upload above — the gather's subtraction loop starts there instead of at slot 0 (frame.p5Cfg.w; 0 when none is alive, so a still's frame block is byte for byte what it was — review R2.2))   // transient (ttl / flagged) lights alive this frame — the gather skips its subtraction loop at 0, the froxels draw them outside their history
    const fx = this.passes.froxels;
    const froxOn = s.froxelVol && s.froxelH >= 8 && s.froxelD >= 4 && (s.flags & (FrameFlags.Volumetrics | FrameFlags.Smoke)) !== 0;   // (beams AND smoke both off: nothing for the grid to hold — the old path draws the same nothing)
    const froxNear = Math.max(0.05, s.froxelNear, cam.pos[1] - Engine.FROXEL_CONTENT_TOP);   // (nothing to light hangs above FROXEL_CONTENT_TOP: the first slice starts where a ray from this height could first meet anything)
    const froxFar = Math.max(froxNear + 1, s.froxelFar);
    if (froxOn) {
      // W follows the WINDOW's aspect (canvas CSS box), not the internal size's: resize() floors width and height separately, so the internal aspect wobbles by a fraction of a froxel across
      // render-scale steps and would re-make the volumes on the ladder's every move; capped for ultrawide windows (32:9 at ultra would be 180 MB)
      const cv = this.gpu.canvas as HTMLCanvasElement; const aspect = (cv.clientWidth > 0 && cv.clientHeight > 0) ? cv.clientWidth / cv.clientHeight : this.width / Math.max(1, this.height);
      const H = Math.round(s.froxelH), W = Math.max(8, Math.min(Math.round(H * 2.4), Math.round(H * aspect)));
      if (fx.configure(W, H, Math.round(s.froxelD), fx.allocated ? 'grid change' : 'first use')) this.passes.froxelViewsChanged();
      if (fx.idle > 0) fx.restartHistory();   // back after a spell off: whatever the history holds is stale
      if (cutNow && this.havePrevFrox) fx.restartHistory();   // a camera CUT (the same > 2.5 m / > 30° rule that drops the TAA history above): the haze volumes' temporal reprojection cannot follow it either — without this the beams of the room cut FROM ghosted over the room cut TO for the ~14 frames the 0.93 history takes to forget (review R2.8)
      this.havePrevFrox = true;
      const mapKey = s.froxelFar * 1000 + s.froxelCurve; if (mapKey !== this.froxelMapKey) { if (this.froxelMapKey) fx.restartHistory(); this.froxelMapKey = mapKey; }   // far / curve moved (a Tab slider): the history is laid out on the old mapping — restart it (near rides the camera every frame and reprojects through prevCam.w)
    } else if (fx.allocated) { fx.idle++; if (fx.idle > 600) { fx.release(); this.passes.froxelViewsChanged(); } }
    this.rc.halfRate = s.rcHalfRate;
    this.rc.amortize = s.rcAmortize; this.rc.setPeriods(s.rcPeriods); this.rc.setChunks(s.rcChunks);   // amortized cascade upkeep (rc.ts): the settings are the source of truth, mirrored like the other cache options
    const jf = (this.rc.staggerUpper || this.rc.halfRate) ? (this.frameIdx >> 1) : this.frameIdx;   // same direction jitter for the pair of frames that share cascade work (stagger: c2+ every other frame; half rate: uppers even / c0 + bake odd)
    this.rc.setDiceBlend((s.flags & FrameFlags.Temporal) ? 0.3 : 1.0);
    const fp: FrameParams = {
      viewProj: taauOn ? this.vpJ : cam.viewProj, invViewProj: taauOn ? this.invVpJ : cam.invViewProj, prevViewProj: taauOn ? this.prevVpJ : cam.prevViewProj,   // (TAAU off: the camera's own three, untouched — the old path bit for bit)
      camPos: cam.pos, camDir: cam.forward, time, dt, width: this.width, height: this.height,
      frameIdx: this.frameIdx, numLights, flags: (s.flags & ~(FrameFlags.ReachMask | FrameFlags.TileCull | FrameFlags.SoftTileSkip | FrameFlags.SmokeRenderSkip | FrameFlags.CheckerDirect | FrameFlags.GridSkip | FrameFlags.GridYCull | FrameFlags.AxisBox | FrameFlags.GridSlabs | FrameFlags.Gloss | FrameFlags.MeshShadows | FrameFlags.Decals | FrameFlags.Particles | FrameFlags.Glass | FrameFlags.BounceCards | FrameFlags.DirectSeedHold | FrameFlags.GiAdaptiveHist | FrameFlags.FroxelVol | FrameFlags.Restir))
        | (s.nvAmount > 0.001 ? FrameFlags.NightVision : 0) | (s.lightReach ? FrameFlags.ReachMask : 0) | (s.tileCull ? FrameFlags.TileCull : 0) | (s.softTileSkip ? FrameFlags.SoftTileSkip : 0) | (s.smokeRenderSkip ? FrameFlags.SmokeRenderSkip : 0) | (s.checkerDirect ? FrameFlags.CheckerDirect : 0)
        | (s.gridSkip ? FrameFlags.GridSkip : 0) | (s.gridYCull ? FrameFlags.GridYCull : 0) | (s.axisBoxFast ? FrameFlags.AxisBox : 0) | (s.gridSlabs ? FrameFlags.GridSlabs : 0) | (s.gloss && !rtOn ? FrameFlags.Gloss : 0) | (meshOn ? FrameFlags.MeshShadows : 0)
        | (decalsOn ? FrameFlags.Decals : 0) | (partOn ? FrameFlags.Particles : 0) | (s.glass ? FrameFlags.Glass : 0) | (cardSlots.length > 0 ? FrameFlags.BounceCards : 0) | (s.directSeedHold ? FrameFlags.DirectSeedHold : 0) | (s.giAdaptiveHistory ? FrameFlags.GiAdaptiveHist : 0)
        | (froxOn ? FrameFlags.FroxelVol : 0) | (s.restir ? FrameFlags.Restir : 0),
      exposure: s.exposure,   // tileCull / softTileSkip / smokeRenderSkip / gridSkip / gridYCull / axisBoxFast / gridSlabs / gloss / meshShadows / decals / gpuParticles / glass / torchBounceCards / directSeedHold / giAdaptiveHistory: the boolean settings are the single source of truth for their bits (frame.ts FrameFlags is the one table; the cards bit only while a card light is actually up, the decals bit only while a mark exists)
      skyZenith: s.skyZenith, skyHorizon: s.skyHorizon, hazeDensity: s.hazeDensity,
      rcInterval0: this.rc.cfg.interval0, rcC0Dims: [this.rc.cfg.nx, this.rc.cfg.ny, this.rc.cfg.nz], rcNumCascades: this.rc.cfg.cascades, rcD0: this.rc.cfg.d0, rcFrameParity: this.frameIdx & 1,
      numSmoke: this.smoke.count, debugView: s.debugView, indirectScale: s.indirectScale, emissiveScale: s.emissiveScale, volSteps: s.volSteps,
      capColor: s.capColor, post: [s.nvAmount, s.nvGain, s.hitFlash, Math.tan(cam.fov / 2)],
      directCfg: [s.directSamplesTop, s.directSamplesOther, s.directBlurCap, s.directHistory * this.passes.directHistoryScale],   // (× ½ / ¾ on the two frames after the direct histories were resampled across a size change — passes.ts directCarryAge; 1 otherwise)
      rcJitter: (s.flags & FrameFlags.Temporal) ? [0.1 + 0.8 * ((jf * 0.7548776662466927) % 1), 0.1 + 0.8 * ((jf * 0.5698402909980532) % 1)] : [0.5, 0.5],
      directAdaptiveMin: s.directAdaptiveMin,
      numTransient: numTransientNow,
      secMinE: s.secMinE,   // R2 sequence over the octahedral texel: cascade direction aliasing becomes noise for the indirect temporal filter
      lossyCfg: [this.passes.gatherDiv, this.passes.volDiv, s.dimRays ? Math.max(0, s.dimRaysBelow) : 0, Math.max(0, s.giFireflyK)],   // .w: the gather's relative firefly bound (0 = off)
      cardSlots,
      weather: this.weather,   // rain / splashes / sky flash: drawn by the volumetric pass under FLAG_VOLUMETRICS (beams off = no weather on screen; the game side carries on)
      glassCfg: [Math.max(0, s.glassReflect), Math.max(0, s.glassTintDepth), Math.max(0, s.glassDust), s.glassRefract && s.glass ? Math.max(1, Math.min(3, s.glassIor || 1.5)) : 0],   // .w: refraction — the index of refraction while on (≥ 1), 0 = off (composite.wgsl glassRefractPath)
      volCfg: [Math.max(0, Math.min(6, Math.round(s.volLightCap || 0))), Math.max(1, Math.min(3, Math.round(s.volShadowEvery || 1))), Math.max(10, Math.min(30, Math.round((s.volStepVoxels || 1.5) * 10))),
        Math.max(3, Math.min(15, Math.round(s.smokeShadowSteps || 8))) | (Math.max(0, Math.min(6, Math.round(s.smokeMarchLights || 0))) << 8) | (Math.max(0, Math.min(15, Math.round((s.smokeMultiScatter ?? 1.0) * 10))) << 12) | (Math.max(0, Math.min(15, Math.round((s.smokeTaaReact ?? 0) * 10))) << 16) | ((s.smokeUpsampleRelax ? 1 : 0) << 20)],   // (+ bits 16‥19 the TAAU smoke reactivity × 10, bit 20 the upsample's depth relax — smoke battery experiments)   // (.w bits 12‥15: the multiple-scattering octave's gain × 10, vol_common.wgsl smokeMsGain)   // (.w bits 8‥11: the march's own lights per step, vol_common.wgsl smokeMarchLights — 0 = the J-lit march as it was)   // volumetric caps: K lights per march step / haze ray (0 = the pass as it was), shadow-ray reuse period, march step in tenths of a voxel; .w = the SHADOW rays' smoke sample count (common.wgsl smokeShadowSteps: 8 = as ever)
      froxelA: [froxNear, froxFar, Math.max(0, s.froxelCurve), froxOn ? fx.historyWeight(s.froxelHistory) : 0],   // froxel volumetrics: the mapping every kernel / consumer shares (common.wgsl froxelDist / froxelSlice) + this frame's history weight (0 on a fresh grid)
      froxelB: fx.allocated ? [fx.grid.w, fx.grid.h, fx.grid.d, Math.max(0, Math.min(6, Math.round(s.froxelK))) | (s.froxelSharp ? 256 : 0) | ((Math.max(1, Math.min(3, Math.round(s.froxelTopRays))) - 1) << 9)] : [0, 0, 0, 0],   // k | sharp << 8 | (strata − 1) << 9
      froxelC: [...fx.jitter(this.frameIdx), Math.max(0, s.froxelBias)] as [number, number, number, number],
      prevCamPos: this.prevCamPos, froxelPrevNear: this.froxelPrevNear || froxNear,   // the eye (TAAU's per-render snapshot, seeded with this frame's on the first) and the near boundary of the previous RENDER — read by the froxel history's reprojection and the specular denoiser's mirror-image validation
      rtCfg: [Math.max(0, Math.min(1, s.rtMaxRough)), Math.max(0, Math.min(4, Math.round(s.rtRays))), Math.max(0, Math.min(1, s.rtAniso)), rtOn ? this.passes.rtDiv : 0],   // .w = 0: the reflection pass is off this frame (nothing reads the rest then)
      matCfg: [Math.max(0, s.rtGlints), Math.max(0, s.rtStrength), 60, Math.max(0, Math.min(1, s.detail))],   // .w = the g-buffer's detail-layer amount (0 = fsBox as it was)
      // phase 5 (ultra extras): the gather's resampling mode + its packed numbers, the reflection pass's mesh / hit-reuse bits — every field 0 = the passes as they were. The mesh bit rides only while
      // the mesh-shadow trees are actually skinned this frame (meshOn): with meshShadows off / unavailable the reflections keep the capsules, as asked
      p5Cfg: [giMode | (giMode && s.giResampleRevalidate ? 16 : 0), (Math.max(1, Math.min(4, Math.round(s.giResampleRays))) & 15) | ((Math.max(2, Math.min(64, Math.round(s.giResampleCap))) & 255) << 8) | ((Math.max(1, Math.min(8, Math.round(s.giResampleTaps))) & 15) << 16) | ((Math.max(2, Math.min(32, Math.round(s.giResampleRadius))) & 255) << 24),
        rtP5Bits, firstTransientNow],
      jitter: [this.jitter[0], this.jitter[1], this.prevJitter[0], this.prevJitter[1]],
      markCfg: [s.markings ? this.world.markingTexel : 0, Math.max(0, Math.min(1, s.markingContrast)), Math.max(0, s.markingEmissive), s.markingReflect ? (s.markingReflPattern === false ? -1 : 1) * (1 + Math.max(0, Math.min(4, s.markingReflCone))) : 0],   // markings: .x 0 = off everywhere; .w 0 = not at reflection hits, else ±(1 + the traced-hit cone's lobe share) — negative = the analytic highlight left uniform (markings.wgsl markConeK / reflect.wgsl)
      sharpCfg: this.sharpOn ? [this.width, this.height, this.outWidth, this.outHeight] : [0, 0, 0, 0],   // sharp direct: the two sizes every twin kernel maps between (z 0 = off: every pass as it was)
      sharpCfgB: [s.sharpEdgeRays ? 1 : 0, Math.max(0.05, s.sharpEdgeSpread), Math.max(0, s.sharpEdgeHintPx), Math.max(1e-4, s.sharpPlaneK)],   // its knobs (edge rays, edge spread, hard-hint width, plane k)
      sharpCfgC: [decouple ? this.jitter[0] : 0, decouple ? this.jitter[1] : 0,   // DECOUPLED JITTER: what every internal ↔ output texel map adds under it (0 = one raster jitter, the sharp path as it was)
        (Math.max(0, Math.min(3, Math.round(s.sharpSliver))) & 3) | ((Math.max(0, Math.min(3, Math.round(s.sharpDiag))) & 3) << 4) | ((Math.max(0, Math.min(64, Math.round(s.sharpSliverCap))) & 127) << 8),   // .z = the SLIVER rule | diag paint << 4 | per-tile ray cap << 8 (sharp_direct.wgsl; 0 = the fallback as it was) — an exact small integer
        s.gbaaClamp ? 1 : 0],   // .w = GBAA's same-surface clamp (gbaa.wgsl; 0 = the blend as it was)
      rigCfg: [rigBits, Math.max(4, Math.min(64, Math.round(s.charSoftSteps ?? 20))), Math.max(0.05, s.charSoftK ?? 1), Math.tan(Math.max(0.02, Math.min(5, s.charSoftMinDeg ?? 0.35)) * Math.PI / 180)],   // the SDF character rig: the extras' bits (0 = the plain round-cone loops) + the soft query's numbers
      rigCfgB: [Math.max(0, Math.min(3, s.sdfRigK ?? 1)), Math.max(4, Math.min(64, Math.round(s.sdfRigSteps ?? 24))), 0.0015, 0.012],   // × the joint blend radii, closest-hit steps, its epsilon, the soft march's smallest step,
      // GI in motion: the young-history ray multiplier (0 = off — the gather as it was: giYoungRays ≤ 1, the legacy denoiser (no history length to read), phase 5's resampling gather (its reservoirs
      // carry their own confidence), or a cut this frame / the two after), the texel cap (fraction × the gather grid), the 'young' length
      giCfg: (() => { const k = Math.max(1, Math.min(4, Math.round(s.giYoungRays))); const on = k > 1 && s.denoiser !== 'legacy' && giMode === 0 && this.giCutHold === 0 && (s.flags & FrameFlags.Temporal) !== 0 && s.dnGiCap >= 1; return on ? [k, Math.ceil(Math.max(0, Math.min(1, s.giYoungCap)) * this.passes.gw * this.passes.gh), Math.max(1, Math.min(s.giYoungLen, s.dnGiCap)), 0] : [0, 0, 0, 0]; })() as [number, number, number, number],   // (dnGiCap < 1 = the diffuse client keeps no history: every texel would read young every frame; and 'young' can never be more than the cap the stored length saturates at)
    };
    this.froxelPrevNear = froxNear;
    writeFrame(this.frameData, fp);
    this.device.queue.writeBuffer(this.frameBuf, 0, this.frameData);
    this.passes.edgeRays = !!s.sharpEdgeRays; this.passes.sliverRays = Math.round(s.sharpSliver) >= 1 && Math.round(s.sharpSliverCap) > 0;   // (either ray user picks the sharp kernel's traced variant)
    if (this.sharpOn) { writeFrameOut(this.frameDataOut, this.frameData, this.outWidth, this.outHeight, decouple ? { viewProj: cam.viewProj, invViewProj: cam.invViewProj, prevViewProj: this.prevVpU } : undefined); this.device.queue.writeBuffer(this.frameBufOut, 0, this.frameDataOut); this.ensureSceneBGOut(); this.passes.sceneBGOut = this.sceneBGOut; }   // the OUTPUT frame block + its scene group for the output-size passes (decoupled: with the camera's own unjittered matrices — its raster stands still)
    else this.passes.sceneBGOut = null;
    const jitterRes: [number, number] = decouple ? [0, 0] : this.sharpOn ? [this.jitter[0] * this.outWidth / this.width, this.jitter[1] * this.outHeight / this.height] : this.jitter;   // the resolve reads the jitter in the pixels of the picture it resolves (the output's under sharp direct; none when the output raster is decoupled from the internal jitter)
    if (taauOn) this.passes.setTaauFrame({ prevViewProjU: this.prevVpU, jitter: jitterRes, bypass: s.debugView !== 0, alpha: s.taauAlpha, clipGamma: s.taauClipGamma, reactK: s.taauReactive, kSharp: s.taauKernel, velK: s.taauVelK, sharpen: s.taauSharpen + s.taauSharpenMotion * camMot, camStill, lightJump: s.taauLightJump, motionA: s.taauMotionAlpha, motionClip: s.taauMotionClip, histSharp: s.taauHistSharp,
      particles: partOn && s.debugView === 0 && !!this.particles && this.particles.drawEnabled && this.particles.liveSlots > 0 });   // (the resolve's own uniform: last frame's UNJITTERED view-projection for the output history, this frame's jitter, the knobs; 'particles' = their splat runs this frame, so its reactive mask is fresh)
    // what the NEXT render reprojects with / detects a cut against (snapshotted now: everything above has read the previous values)
    m4.copy(this.prevVpJ, this.vpJ); m4.copy(this.prevVpU, cam.viewProj); this.prevCamPos = v3.copy(cam.pos); this.prevCamFwd = v3.copy(cam.forward);
    this.prevJitter[0] = this.jitter[0]; this.prevJitter[1] = this.jitter[1];

    const t1 = performance.now();
    const timer = this.timer; timer.beginFrame();
    const enc = this.device.createCommandEncoder({ label: 'frame' });
    const ts = (n: string) => timer.pass(n);
    if (this.smoke.encode) this.smoke.encode(enc, ts);
    if (meshOn && this.world.charCount > 0) this.meshShadows!.encode(enc, Math.min(this.world.charCount, MESH_MAX_CHARS), ts('mesh'));   // skin + refit every listed character's tree from this frame's joint matrices — before the cascades, the first pass that traces
    this.gbuffer.encode(enc, this.sharpOn ? this.sceneBGOut! : this.sceneBG!, this.world.visibleBuf, this.world.visibleCount, this.skin, this.dummyStorage, this.decals?.buf ?? this.dummyStorage, ts('gbuffer') as GPURenderPassTimestampWrites | undefined);   // (the decal buffer is only read under FrameFlags.Decals: without a list the dummy is bound and the flag stays down) — under sharp direct at the OUTPUT size (the output frame block: its pixel-footprint terms mean an output pixel)
    this.gbuffer.encodeDown(enc, this.sceneBG!);   // sharp direct: the internal-size view every internal pass binds, derived from that raster (a no-op with it off)
    this.rc.encode(enc, this.sceneBG!, timer, this.frameIdx);
    if (partOn && this.particles!.hasWork) this.particles!.encodeUpdate(enc, this.sceneBG!, this.rc.diceView, ts('particles'));   // (only ask the timer for a slot when the pass WILL encode: an allocated-but-unwritten timestamp pair resolves to stale garbage — ultra summed a fictional 7–12 ms 'particles' with nothing alive, 08-10 measurements)   // births + the step (collide against this frame's boxes, shade off this frame's lights and dice) — a return with nothing live
    let canvasView: GPUTextureView;
    if (present) canvasView = this.gpu.ctx.getCurrentTexture().createView();
    else {
      if (!this.offscreenTarget || this.offscreenTarget.width !== this.outWidth || this.offscreenTarget.height !== this.outHeight) {   // (pooled like the real targets under keepHistories, so a scripted resize measures what a presented one costs — the canvas's own backing store aside)
        const desc = { label: 'offscreen', size: [this.outWidth, this.outHeight] as [number, number], format: this.gpu.format, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC };
        if (this.settings.keepHistories) { this.pool.release(this.offscreenTarget); this.offscreenTarget = this.pool.acquire(desc).tex; }
        else { this.offscreenTarget?.destroy(); this.offscreenTarget = this.device.createTexture(desc); }
      }
      canvasView = this.offscreenTarget.createView();
    }
    this.passes.directPasses = s.directPasses; this.passes.directHistory = s.directHistory; this.passes.debugView = s.debugView;
    this.passes.gatherStrata = !!s.gatherStrata;   // (stratified gather directions: which gather pipeline pair the encode takes this frame)
    this.passes.glassRefract = !!(s.glassRefract && s.glass && this.world.glassList.length > 0);   // (glass refraction: composite's GLASS_REFRACT twin — only while there is a pane list to bend through; glass off / no panes = the module as it was)
    { const P = this.passes; P.restirOn = s.restir; P.restirRays = s.restirRays; P.restirSpatial = s.restirSpatial; P.restirHistory = s.restirHistory; P.restirRadius = s.restirRadius; P.restirGradient = s.restirGradient; P.restirGradK = s.restirGradK; P.restirYoung = s.restirYoung; P.restirSpatialAll = s.restirSpatialAll; P.restirCoherent = s.restirCoherent; P.restirSampleHue = s.restirSampleHue; P.restirRatioRaw = s.restirRatioRaw; P.restirPermute = s.restirPermute; P.restirPenCap = s.restirPenCap; P.restirPenRays = s.restirPenRays; P.restirAudit = s.restirAudit; P.heldRays = s.heldRays; P.restirHueSplit = s.restirHueSplit; P.restirKnownDark = s.restirKnownDark; P.restirJitter = this.jitter;
      P.restirMotion = s.restirMotion; P.restirMotionLive = s.restirMotion > 0 && (this.camMovedAny || s.restirMotionStatic); P.restirMotionV = s.restirMotionV; P.restirMotionMin = s.restirMotionMin; P.restirMotionPx = s.restirMotionPx; P.restirMotionDither = s.restirMotionDither; P.restirMotionTaps = s.restirMotionTaps;   // (MOTION: 0 = main's pipeline; passes.encode picks the RESTIR_MOTION twin otherwise)
      if (s.restir) P.writeRestir(this.lights); }   // ReSTIR DI: the settings are the source of truth; the uniform (cfg + last frame's slot maps and light records, kept by lights.upload above) goes up every frame the pass runs
    { // the denoiser: which core, and the v3 clients' knobs (the settings are the source of truth, mirrored like every other pass option)
      this.passes.dnMode = s.denoiser === 'legacy' ? 'legacy' : 'v3';
      const K = this.passes.den.knobs;
      K.shIters = s.dnShadowIters; K.shCap = s.directHistory > 0 ? s.dnShadowCap : 0; K.shClampK = s.dnShadowClampK; K.shSigmaL = s.dnShadowSigmaL; K.shPrior = s.dnShadowPrior; K.shLitAlike = s.dnShadowLitAlike; K.shMoveCap = s.dnShadowMoveCap; K.shMoveThresh = s.dnShadowMoveThresh; K.shJump = s.dnShadowJump;
      K.giIters = s.dnGiIters; K.giCap = s.dnGiCap; K.giClampK = s.dnGiClampK; K.giSigmaL = s.dnGiSigmaL; K.giFast = s.dnGiFast; K.giFirefly = s.dnGiFirefly; K.giClampCut = s.dnGiClampCut; K.giYoungWiden = s.dnGiYoungWiden;
      K.spIters = s.dnSpecIters; K.spCap = s.dnSpecCap; K.spClampK = s.dnSpecClampK; K.spSigmaL = s.dnSpecSigmaL; K.spRough = s.dnSpecRough; K.spMaxRough = s.rtMaxRough; K.rfIters = s.rtAtrous; K.rfCap = s.rtHistory;   // (+ the reflection chain's per-pixel cutoff, its own iteration count and history cap)
      K.depthK = s.dnDepthK; K.normalPow = s.dnNormalPow; K.motionVectors = s.dnMotionVectors;   // (the g-buffer writes gVel on both the TAAU and the FXAA path: prev − now through frame.prevViewProj, jittered or not — consistent with the reprojection either way)
      K.ratioHi = (fp.flags & (FrameFlags.TailChroma | FrameFlags.Restir)) ? 4 : 1;   // the ratio clamp's upper bound: shadowed ≤ unshadowed per channel, except the chroma-exact tail's single samples and the ReSTIR estimator's per-light hues (one warm light under a mixed U tops U's red channel legitimately)
      if (this.passes.dnMode === 'v3' || rtOn) this.passes.den.writeParams({ gatherDiv: this.passes.gatherDiv, reflDiv: rtOn ? this.passes.rtDiv : 0, temporalFlag: (fp.flags & FrameFlags.Temporal) !== 0, shadowTemporal: s.directHistory > 0, historyScale: this.passes.directHistoryScale < 1 ? 0.5 : 1, cueUv: s.restir && (fp.flags & FrameFlags.Restir) !== 0, fullRes: this.passes.giFullOn });   // (the reflection chain is the v3 specular client under either core; + the internal-res diffuse chain's block while that path is wanted)
      this.passes.youngOn = (fp.giCfg?.[0] ?? 0) > 1;   // (GI in motion: the gather's young-texel counter is zeroed each frame the multiplier is up)
    }
    // the particles' splat goes INTO the HDR target between the composite and the bloom (so hot sparks bloom and nothing has a history to smear); debug views keep the screen theirs.
    // Not timestamped: render-pass timings on Metal read as a frame (see the dev notes) and would poison the HUD total and auto quality's calibration — particles.timeDraw opts in for a look
    const overlay = partOn && s.debugView === 0 && this.particles!.drawEnabled ? (e: GPUCommandEncoder) => this.particles!.encodeDraw(e, this.sharpOn ? this.sceneBGOut! : this.sceneBG!, this.passes.hdrView, this.passes.reactView, this.sharpOn ? this.gbuffer.depthOView : this.gbuffer.depthView, this.passes.volView, this.passes.froxels.view, this.particlesTimeDraw ? ts('pdraw') as GPURenderPassTimestampWrites | undefined : undefined, s.particleRain ? this.passes.sceneCopy : null) : undefined;   // (+ the composite's copy for the particle rain's refraction while it rains particles)   // (sharp direct: the splat lands in the OUTPUT-size hdr against the output-size depth)
    this.passes.encode(enc, this.sceneBG!, this.gbuffer, this.rc, canvasView, ts, fp.flags, overlay);
    for (const f of this.extraPasses) f(enc, this.sceneBG!, this.rc.diceView, ts);
    this.gbuffer.snapshotPrev(enc, this.world, this.skin);   // this frame's box transforms + joint palette → the 'previous' buffers the NEXT g-buffer pass reads for its motion vectors (copies at the tail of the command buffer; next frame's uploads are ordered after them)
    timer.resolve(enc);
    this.device.queue.submit([enc.finish()]);
    timer.afterSubmit();
    this.particles?.afterSubmit();
    for (const f of this.afterSubmit) f();
    this.cpuMs.encode = performance.now() - t1;
    this.frameIdx++;
  }
}

export { FrameFlags };
