// The renderer's SETTINGS — the knob table every surface reads and writes (the Tab panel, the presets, the URL flags, the game's few reads: emissiveScale, flashlightRadius,
// debrisCap, decals, markings …) — kept in a module of their own so a host that is not the WebGPU Engine (the QA harness's stand-in) can build a settings object without importing src/engine.ts and the whole render pass graph behind it. src/engine.ts re-exports both names, so every existing import
// (`import { RenderSettings, defaultSettings } from '../engine'`) still resolves; the values are the same object, byte for byte.
import type { Vec3 } from './math/vec';
import { FrameFlags } from './render/frame';

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
                             // regression now. very noisy and lots of rims'; ?norestir 'looks great' — the maintainer at high). 0 = off: the transient stratum exactly as it was. Tiered (quality.ts Preset.restir.held)
  heldAdaptive: boolean;     // TRADE (lighting cost; restir.wgsl TRADES, default OFF at every tier = the estimator exactly as it was): a carried light's first two strata that agree stand for all heldRays — 2 rays instead of K in the cone's interior and behind walls, the full K where they differ. Costs: BIASED in a wide penumbra (stopping on agreement pulls a pixel toward lit / dark — one truly 90 % lit reads ≈ 94 %, the worst case ±5 % of that light, so its penumbra hardens a little and grains more), and an occluder thinner than the lens spread can be missed by both rays. Needs heldRays > 2.
  restirStableRetrace: boolean;   // TRADE: a reservoir sample that is fully lit, at ¾ of its memory or more, with no penumbra measured at the pixel last frame, is re-traced every OTHER frame (the fresh candidates still look every frame). Cost: a shadow ARRIVING on such a pixel (a man walking into a static light) can show one frame late at part weight along its leading edge.
  restirDimClass: number;    // TRADE, 0‥0.5 (0 = off): an emitter class (sharp / broad) holding less than this share of a pixel's live unshadowed light takes ONE shadow ray a frame (re-trace and fresh on alternate frames) and no second penumbra ray. Costs: more grain in that class's share — worst where the bright class is itself shadowed
  // ---- THE DENOISER (renderer v3 phase 3, render/denoise.ts + shaders/denoise.wgsl): 'v3' = one core (reprojection with the g-buffer's motion vectors + per-tap depth validation, luminance
  // moments → variance, history length, neighbourhood clamp, variance-guided edge-stopped à-trous) behind three clients — the direct pass's shadow ratio per emitter class (full res), the
  // gather's diffuse irradiance and its specular field (gather res); 'legacy' = dtemporal + softblur, temporal + giblur and the gloss chain exactly as they were (?legacydenoise). The dn*
  // knobs are the v3 clients' (iterations / history caps per tier from ui/quality.ts; Tab ▸ Denoiser rows); directPasses / directHistory / directBlurCap keep their legacy meaning, and
  // under v3 directHistory > 0 is the shadow client's temporal switch, directBlurCap its penumbra-width cap. dnShadowOccl (default ON, ?noleakfix) = the shadow client reads every
  // tap and its own history under BOTH hypotheses about the light that differs between them — as visible as the rest (the ratio stands) or hidden (the ratio × U there / U here) —
  // and takes the one nearer this pixel's own ratio: a carried torch on the far side of a wall is in U but in nobody's S, and ratios averaged across its cone's edge or across the
  // frames it bobbed over drew that cone, faint, on whatever another light showed behind the wall. The same switch keeps texels where a class has NO light (the prior, ratio 1) out of
  // the temporal stage's 5×5 statistics and the pixel's own sample inside the history clamp's box (a thin unlit face no longer shows a hidden lamp as a bright line). Off = the client as it was.
  denoiser: 'v3' | 'legacy';
  dnShadowIters: number; dnShadowCap: number; dnShadowClampK: number; dnShadowSigmaL: number; dnShadowPrior: boolean; dnShadowLitAlike: boolean; dnShadowOccl: boolean; dnShadowMoveCap: number; dnShadowMoveThresh: number; dnShadowJump: number;
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
  /** the frame rate the quality ladder works to (ui/quality.ts HOLD / ladderBands; ?aim=asnow|60|90|120|display, ?aim=0 = asnow; Tab ▸ Frame): 0 = AS NOW (aim at a 60 Hz budget, spend headroom on resolution, cut
   *  only under 45 fps — the ladder byte for byte as it was before the aim); 60 / 90 / 120 = HOLD that rate (never more than the display has been seen to show): cut resolution, then the preset, the moment a
   *  fight would drop under it, climb only on the headroom left under ITS budget; 999 = hold the display's own rate. Trades resolution for frame rate. DEFAULT 60 (the maintainer's pick, 10-10: '60fps can be our target'); ?aim=asnow = the old ladder for the visit. */
  ladderAim: number;
  /** the as-now ladder's PACED CHECK (ui/quality.ts PACED; ?ladderpaced=0; Tab ▸ Frame): a page something else holds to a low frame rate (the browser's energy saver, a power mode) is not cut
   *  for it, a cut (or a preset drop) that bought no frame rate is taken back, and a scale left low is given back as far as it provably costs nothing. false = the rule as it was (the union over 11 ms = the GPU is the limit). */
  ladderPaced: boolean;
  /** the same check under an aim (ui/quality.ts, the block under PACED; ?ladderheld=0; Tab ▸ Frame): hold 60 on a page something else holds to a low frame rate keeps its pixels — a slow
   *  frame far over its GPU work takes a judged cut (to where the union fits the aim's frame less 6 ms); the frame no shorter there = the pixels straight back and that rate remembered
   *  as the page's pace, where nothing is cut for the union's size and a scale left low comes back on the frame's own room, each step judged. false = an aim as it was. */
  ladderHeld: boolean;
  /** auto lets sharp direct go before it shrinks the picture (ui/quality.ts SHED; ?laddershed=0; Tab ▸ Frame): where auto's ladder would take pixels off the tier's own picture or give the
   *  preset up, and sharp direct is drawing, sharp direct goes instead (its output-size kernels are the part of a frame fewer pixels do not shrink), stays off across auto's preset hops, and
   *  comes back when the union priced with it fits again. false = the ladder as it was. Auto only: a pinned preset keeps its rows. */
  ladderShed: boolean;
  /** one light-cache grid at every preset (ui/quality.ts ONE CACHE GRID; ?onegrid=0): low and verylow run the 40 × 4 × 28 probe grid the other presets run, so the light meter the
   *  guards and teammates see by (render/shaders/probe.wgsl reads the cache's dice) reads the same shadow whatever the graphics setting, and no ladder step swaps the cache under a
   *  mission. false = low and verylow on their coarser 32 × 3 × 22 grid, as it was. Read when a preset is applied. */
  oneCacheGrid: boolean;
  /** one smoke pressure solve at every preset (ui/quality.ts ONE SMOKE SOLVE; ?onesolve=0): every preset runs high's red/black pairs, so the smoke a sight line reads has the
   *  same shape whatever the graphics setting. Read when a preset is applied. */
  oneSmokeSolve: boolean;
  /** the floor rung sheds an open fire's smoke (ui/quality.ts FIRE SMOKE SHED; ?fireshed=0): on verylow a brazier burns with its flame, embers, light and sound and files no
   *  smoke on the solver, which then need not stay awake for it (and under auto the first rung up from the floor keeps that). false = every preset keeps the fire's
   *  smoke, as it was. Read when a preset is applied. */
  fireSmokeShed: boolean;
  /** what the preset on says of an open fire's smoke (written by ui/quality.ts when a preset is applied; game/fire.ts reads it beside the solver's `drawing`): false = this
   *  preset draws the fire without its smoke. Picture only, and never the game's own table (FIRE.smoke.on, the page's ?firesmoke=0, puts it off at every preset). */
  fireSmoke: boolean;
  /** the smoke keeps High's look down the ladder (ui/quality.ts SMOKE KEEP; ?smokekeep=0|1|2; Tab ▸ Frame): 1 = on the presets under high the smoke march stays at half size
   *  with high's lights a step and step length, on the preset's own (froxel) path — the ladder's render scale pays for it; 2 = high's whole volumetric path there too (the
   *  per-pixel march for haze and smoke, high's beam steps); 0 = each preset's own smoke rows, as it was. verylow, the floor, keeps its own at every value. Read when a
   *  preset is applied. */
  smokeKeep: number;
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
  gridSkip: boolean;           // every traced ray (traceClosest / occluded / occludedT): the DDA runs past cells the grid build proved empty without loading them — one Chebyshev-distance byte per cell (lossless; FrameFlags.GridSkip) — off = a load pair per cell as before, for A/B
  gridYCull: boolean;          // every traced ray: cells and boxes (and the once-per-ray globals) whose stored height band the remaining stretch of the ray cannot reach are not slab-tested (per-cell 24-slice occupancy + per-item quantised extent + per-global extent; the argument is above traceClosest in common.wgsl) (lossless; FrameFlags.GridYCull) — off = every registered box is tested, for A/B
  axisBoxFast: boolean;        // slab test: boxes with yaw exactly 0 (two thirds of the grid items, every global) skip the rotation into the local frame and reuse the ray's inverse direction instead of three divisions — the arithmetic is provably the same bits (isectBox in common.wgsl) (lossless; FrameFlags.AxisBox) — off = always rotate, for A/B
  gridSlabs: boolean;          // every traced ray: the huge once-per-ray "global" slabs (ground, carpet base, floor finishes, ceiling) are skipped unless the ray segment's bounds meet theirs on all three axes (5 mm proud) instead of on height alone (4 cm) — a ray lifted off the floor stops testing four floors — and each cell's height span is judged 3.5 cm tighter at both ends, so a ray no longer re-tests the surface it just left (argument above traceClosest in common.wgsl; tools/qa/grid-globals.ts counts it) (lossless; FrameFlags.GridSlabs) — off = the height cull as it was, for A/B
  /** the final gather's rays drawn from tile-coherent STRATA instead of iid (fgather.wgsl cosineDirK — ported from exp/trace-perf E8, docs/internal/trace-perf.md §2.10; passes.gatherStrata picks the second
   *  pipeline pair, compiled behind `const GATHER_STRATA = true`): UNBIASED stratified directions — the same expectation, temporal noise equal or lower, gather −13‥16 % at high (−0.8 ms at ultra) because
   *  a tile's k-th rays share a quarter of direction space and walk the grid coherently. NOT hash-identical to off by nature (a different sample pattern), so it defaults off: the maintainer's call.
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
  wxAirSteps: number;          // the most steps a view ray takes through a weather's dust / fog in the air (volumetrics.wgsl wxAirMarch; each step = one sun shadow ray): 0 = half the tier's beam steps (ultra 12 … verylow 4), 3‥24 = that many. The F8 sweep prices it (row 'wxAir').
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
  charMats: boolean;           // CHARACTER MATERIALS (render/charMaterials.ts + game/charLook.ts + gbuffer.wgsl vsSkin / fsSkin): a man shaded per material SLOT — skin, two cloths, webbing, boot, helmet, dark
                               // metal, rubber, lens, a marking — each with its own colour and highlight out of a table per side (operators / defenders / civilians), creases and ridges from the mesh's own
                               // curvature, the ground's dust up from the sole, and one colour per shadow proxy for bounce rays and reflections. Off (the default with the shipped mannequin, which carries
                               // no slots: `?charmats` dresses it by joint as a stand-in) = his two tints, the frame as it was. main.ts raises it when the loaded mesh has slot-named materials
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
  airSim: boolean;             // THE AIR AS A SIMULATED FIELD (render/airField.ts, game/airSim.ts): step it — live, so a perf sweep can price it mid-take (the game's own switch, AIR_SIM.on / ?air=0, is whether a field is built and fed at all); off = the field stands as it was last stepped
  airEvery: number;            // … and sixtieths of a second between its steps (1 = 60 Hz whatever the page draws at; 2 halves its cost and its turbulence's time resolution)
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
  wetBreakup: number;          // 0‥1, PICTURE ONLY: how far wet ground (an aniso finish under the storm) breaks up into pooled low spots and damp aggregate (detail.wgsl wetGround: roughness up on the high ground, so the reflection is patchy and dull there) — 0 = one even film, the wet lot as it was (?nowetbreak); rides frame.rtCfg.z in tenths beside the anisotropy
  beamReflect: boolean;        // PICTURE ONLY: a weapon laser's beam and a tracer's streak (NoShadow boxes no ray can meet) show in the ray-traced reflections — the reflection pass is handed the nearest 8 as line segments and adds their analytic mirror image (reflect.wgsl beamImage); off = no segment handed, the pass's arithmetic as it was (?nobeamreflect)
  beamAir: boolean;            // PICTURE ONLY: the squad's weapon lasers (either band) are drawn as LIGHT IN THE AIR — a thin additive line that is faint in clear air, brighter in haze, smoke and rain, with a dot that blooms where it lands and a glint at the emitter (composite.wgsl beamAir) — instead of as an opaque glowing box. false / ?nobeamair = the boxes exactly as they were. Tripwire beams and tracers are boxes either way.
  wetMirror: boolean;          // PICTURE ONLY: the ray-traced reflections give the WET ground the share the older gloss path always gave it (Fresnel × (1 + 2 × wetness): 12 % from this camera, not 4 %), so a storm's ground mirrors a lit man as strongly at high as it did at low; with it the image of a laser drawn as light in the air loses its own floor of 35 % for that same share. Off (?nowetmirror) = the traced weight as it was. Never seen on a GPU
  beamAirK: number;            // × the line's brightness in the air (1 = as tuned; the dot is not scaled)
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
  sharpSliver: 1, sharpSliverCap: 24, sharpDiag: 0, gbaaClamp: true, heldRays: 6, restirHueSplit: true, heldAdaptive: false, restirStableRetrace: false, restirDimClass: 0,   // direct-quality lane: same-surface-only slivers with an output-res ray, GBAA's same-surface clamp, the hybrid estimator at high's K 6 (the presets tier it; 0 / false / 0 = each path as it was)
  sharpDecouple: false, sharpEdgeRays: false, sharpEdgeSpread: 0.3, sharpEdgeHintPx: 2.5, sharpPlaneK: 0.01,   // edge rays OFF by default: they take a keyboard's contact shadow to 1.6 px (crisper than the old renderer's 7) but a binary ray cannot draw the soft penumbra a hard one overlaps, and the fired region's rim shows the estimator's own 1–2 % bias as a faint line — docs/internal/sharp-direct.md §2 (E); Tab ▸ Frame / __sharp.set({edgeRays:true}) to judge
  denoiser: 'v3',   // the v3 core by default (?legacydenoise boots the three old chains); iterations / caps below are 'high's until a preset places them
  dnShadowIters: 3, dnShadowCap: 12, dnShadowClampK: 1.25, dnShadowSigmaL: 4, dnShadowPrior: true, dnShadowLitAlike: true, dnShadowOccl: true, dnShadowMoveCap: 3, dnShadowMoveThresh: 0.04, dnShadowJump: 0.5,
  dnGiIters: 4, dnGiCap: 24, dnGiClampK: 1.0, dnGiSigmaL: 4, dnGiFast: 3, dnGiFirefly: 0,   // (k 1.0 / fast 3: the sweep in docs/internal/p3-denoise.md §3 — 10 % of a lights-off in 16 frames vs legacy's 14, at half its torch-hotspot boil)
  giFullRes: false, giFullIters: 4, giYoungRays: 1, giYoungCap: 0.08, giYoungLen: 4,   // GI in motion: both OFF by default until a preset places them (ui/quality.ts Preset.dn.giFull / giYoungK); Tab ▸ Indirect light rows
  dnGiClampCut: 0, dnGiYoungWiden: 0,                                                     // (D): off until measured (Tab ▸ Denoiser rows)
  ladderClimb: true, capClimb: false, ladderAim: 60, ladderPaced: true, ladderHeld: true, ladderShed: true, oneCacheGrid: true, oneSmokeSolve: true, fireSmokeShed: true, fireSmoke: true, smokeKeep: 1,   // the ladder spends measured headroom on scale + divisors by default (it only ever acts on presented frames with GPU timings that show the room); the output-cap climb is opt-in (Tab ▸ Frame)
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
  gridSkip: true,              // exact by construction (one DDA iteration per cell as before, only the loads of provably empty cells go); A/B via the Direct light panel toggle / frame flag 131072
  gridYCull: true,             // exact under the grid's own registration invariant (argument above traceClosest in common.wgsl); A/B via the Direct light panel toggle / frame flag 262144
  axisBoxFast: true,           // exact by IEEE identities (1·x − 0·z = x); A/B via the Direct light panel toggle / frame flag 524288
  gridSlabs: true,             // exact with a 5 mm margin over < 0.4 mm of float differences (argument above traceClosest); −40 % slab tests on rays leaving the floor per tools/qa/grid-globals.ts; A/B via the Direct light panel toggle / frame flag 1048576
  gatherStrata: true,          // ON since 08-12 (the maintainer: 'gatherStrata is looking great!'): unbiased, −13‥16 % gather, a different sample pattern (not hash-identical to the iid gather — ?nogatherstrata / __gs.on = false for the module exactly as it was) / Tab ▸ Indirect light for A/B
  checkerDirect: false, gatherThird: false, rcHalfRate: false, volQuarter: false, dimRays: false, dimRaysBelow: 0.01,
  rcAmortize: true, rcPeriods: [1, 1, 1, 1],   // the schedule is on but traces every level whole until a preset (quality.ts) places periods — bit-identical to the original dispatch meanwhile
  rcChunks: [1, 1, 2, 8],                        // c2's items over 2 workgroups per probe, c3's over 8: the cascades 1.77 → 1.05 ms on the M4 Max with the same output bits (docs/internal/p0a-cascades.md §6); [1,1,1,1] = the original one-workgroup-per-probe dispatch
  volLightCap: 0, volShadowEvery: 2, volStepVoxels: 1.5,   // the cap is off until a preset places it (quality.ts: every preset does); Tab ▸ Direct light ▸ CAP rows
  smokeMultiScatter: 0, smokeTaaReact: 0.3, smokeDiffuseStart: 0.35, smokeUpsampleRelax: true, smokeDiffuseWeight: 'bilinear',   // (taareact 0.6 → 0.3 08-14: 'some pixelation in motion' — a fully reactive plume shows the march's own dither before anything averages it)   // (08-14 SHIP SET = the S1 blind-pairs winner 'combo': density 1.3 (smoke.ts) · MS off · upsample relax · TAAU smoke-reactive 0.6 · diffusion on — every part beat the 08-12 defaults pairwise; docs/internal/smoke-look2.md §5)   // (bilinear since the battery's first still: the four-texel max stippled the plume's edge over a bright front — docs/shots/sbx_base vs sbx_wbilin)
  wxAirSteps: 0,
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
  charMats: false,             // character materials: off = the two tints (main.ts turns it on for a mesh that carries slot materials; ?charmats / ?nocharmats; Tab ▸ Materials ▸ Characters)
  wetChars: true,              // wet characters: on (Tab ▸ Weather ▸ wet characters; nothing shows unless somebody is actually wet — weather off = everybody dry = the untouched path)
  gpuParticles: true,          // the experiment this branch is for: on unless ?noparticles / the Tab ▸ 'Renderer — particles (EXP)' row says otherwise; not part of any preset
  airSim: true, airEvery: 1,   // the air field's step: on, at 60 Hz; not part of any preset
  particleRain: true, particleRainCount: 4000, particleRainRadius: 0, particleRainDensity: 1, particleRainBright: 1, particleRainDrips: true, particleRainLattice: -1, particleRainReact: 6,   // PARTICLE RAIN: ON (v2) — ?norain2 boots without it, Tab ▸ Weather & wind ▸ Rain — particles flips it live; the count is 'high's until a preset places its own (quality.ts Caps.rain)
  glass: true, glassReflect: 1, glassTintDepth: 1, glassDust: 1,   // glass panes (E3): ON by default (?noglass boots without it; Tab ▸ Renderer — glass; the pause card's trade-offs row)
  glassRefract: true, glassIor: 1.5,   // refraction through the glass boxes: ON (?norefract boots without it; Tab ▸ Renderer — glass; __glass.refract / .ior)
  rtReflect: false, rtReflectDiv: 2, rtRays: 1, rtMaxRough: 0.45, rtAniso: 0.7, wetBreakup: 1, beamReflect: true, beamAir: true, wetMirror: true, beamAirK: 1, rtStrength: 1, rtGlints: 1, rtAtrous: 3, rtHistory: 32,   // RT reflections: OFF here — the presets switch it on with their own divisor / rays / cutoff (quality.ts); Tab ▸ Materials
  detail: 0.35,                // the detail layer: 'lived-in' (Tab ▸ Materials; ?detail=0 boots without it — with ?nortreflect the untouched frame)
  giResample: 'off', giResampleRays: 2, giResampleCap: 20, giResampleTaps: 3, giResampleRadius: 10, giResampleRevalidate: true,   // phase 5: OFF here — the ultra preset switches the three on (quality.ts Preset.p5); Tab ▸ Indirect light / Materials rows
  rtMeshHits: false, rtHitReuse: false,
  markings: true, markingTexel: 0.025, markingContrast: 1, markingEmissive: 1, markingReflect: true, markingReflPattern: true, markingReflCone: 0.25,   // markings ON (?nomarkings boots without them; Tab ▸ Renderer — markings)
  sdfRigSmooth: false, sdfRigK: 1, sdfRigSteps: 24, charSoftShadow: false, charSoftAnalytic: true, charSoftSteps: 20, charSoftK: 1, charSoftMinDeg: 0.35, charSoftSmooth: false, charSoftBroad: false, charSelfShadow: true,   // the SDF character rig's two extras: OFF (self-shadow: ON, all tiers) (rows on Tab ▸ Renderer — SDF character rig; ?sdfsmooth / ?charsoft from boot; no preset touches them) — the round cones themselves have no switch
});
