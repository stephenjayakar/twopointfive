# P2a — ReSTIR DI for the direct pass (2026-08-10/11, lane `v3/p2a-restir`; final numbers on the tree merged with TAAU + the v3 denoiser + froxels)

Brief: docs/internal/renderer-v3.md §"v3 in one paragraph" / STATUS "RENDERER V3": *replace direct's leader/tail heuristic with ReSTIR DI
(fixed rays/pixel regardless of light count) … budget at high: direct 3.0 ms p95 at ~1600×900*. Phase 0 gate baseline (STATUS): direct 9.5 ms
mean at high 1777×1000 in the stress minute (41 lights), 13.5 ultra, 7.9 medium, 4.7 low, 2.4 verylow.

## 1. What was there, measured first (M4 Max, high 1777×1000, cubicles, 37 lights, serialized frames, `__hotDirect` shader variants)

| variant of direct.wgsl | direct ms | what it isolates |
|---|---|---|
| as shipped (8/4/3, checkerboard on) | 7.3 | — |
| every `occludedT` call stubbed | 2.8 | **rays ≈ 4.5 ms (62 %)** at ~9 rays / pixel |
| shadow phase skipped (scoring + stores only) | 1.9 | tail walk / loops / rng ≈ 0.9 |
| scoring loop emptied too | 1.05 | scoring ≈ 0.85; the rest is light staging, tile cull, 4 stores, and the private `lw[64]` / `top[6]` arrays |
| 1 leader / class × 1 ray, no tail | 3.8 | ≈ 0.5 ms per coherent ray per pixel |
| checkerboard off vs on | 7.37 / 7.53 | the checkerboard buys nothing on this GPU (quality.ts already suspected ×0.92) |

So the lever is the ray COUNT (and, it turned out, ray coherence and the tracer's inlined code size), not the scoring: scoring every listed light per
pixel is ~0.85 ms and it is what keeps U exact for the ratio filter, so ReSTIR here keeps the exact per-pixel scoring as its candidate pdf and spends its
budget on which lights get shadow rays.

## 2. The estimator as built (`src/render/shaders/restir.wgsl`; `settings.restir`, default on; `?norestir` = direct.wgsl bit for bit)

Per pixel, per emitter class c ∈ {sharp, broad} (the two-class output is kept: dtemporal / softblur / composite are untouched consumers):

* **Candidates / source pdf.** The tile's light list (FLAG_TILECULL, verbatim) is scored unshadowed per pixel exactly as before (evalLight); U_c is stored
  exact. Lights the reach mask walls off from the pixel's cell are in U but never candidates (as before: known dark). ONE fresh candidate per class is
  drawn by weighted reservoir sampling inside that loop with p_i = w_i / W_live — i.e. p ∝ p̂ exactly, so a single draw already IS a draw from the target
  and "M candidates" adds nothing unless each is shadow-rayed (rays 6 traces a second one). Its emitter point is one of a 16×16 lattice on the disk (the
  same √u·r, 2πv mapping shadowSample uses), so the sample is exactly representable in 8 bits and the temporal re-trace hits the very point found visible.
  The candidate is shadow-rayed (occludedT: visibility incl. smoke, blocker distance → the PCSS penumbra hint, as before).
* **Reservoir.** 64 bits per class + a 12-bit log view-depth signature shared by the two: light slot 6 · M 5 · V 3 (eighths, incl. smoke) · lattice 4+4 ·
  last own hint 4 (log px) · W f16 · p̂ log-12 (its target where/when selected = MIS's p̂_i(x_i)) · valid. One rgba32uint-sized record per pixel in a
  storage BUFFER (8×8-tiled), ping-ponged — two more storage buffers in the compute stage (scene 8 + 2 = 10 at ultra on Metal, the ceiling; 8 on a
  default adapter), no new storage texture (the direct pass already binds the default four). 22 MB the pair at 1368×770, 41 MB at 1777×1000. Rebuilt
  zeroed on any internal-size change (a frame of fresh candidates re-seeds it — no resample: a resampled reservoir would name the wrong pixel's sample).
* **Light identity.** Slots are array order minus disabled lights, so a torch switching off renumbers everything after it: `lights.ts` keeps the previous
  upload's records (`prevData`) and two byte maps by object identity (`slotFwd` prev→cur, 255 = gone; `slotInv` cur→prev, 255 = new), riding in the
  pass's 4.2 KB uniform with the previous frame's 64 light records. A reservoir whose light is gone is dropped.
* **Temporal — the domain.** The reservoir belongs to the surface point at the UNJITTERED pixel centre (`RestirU.jitter` = this frame's TAAU jitter +
  the previous dispatch's): every shadow ray of the pass leaves that point and the reprojection starts from it (`frame.prevViewProj` — the jittered
  matrix — plus the g-buffer's per-pixel object motion `gVel`, then the previous raster's jitter taken back out), so under a still camera a pixel inherits
  ITS OWN reservoir every frame whatever the jitter does; nearest texel, validated by the texel's own 12-bit log view-depth signature (dtemporal's 0.5 %
  test). U stays exact at the jittered point; only the shadow term sits ≤ ½ px off, under the ratio-space blur anyway. (Reprojecting the jittered P — the
  first cut — hands a still pixel its NEIGHBOUR's reservoir every other frame; that texel's visibility is not this point's, the history under-covers what
  only this point sees, MIS starves the fresh candidate there, and soft shadows come out 4–10 % dark: §3.4.)
* **Temporal — confidence.** M ← min(M, cap 20) × min(r, 1/r)·1.02, r = p̂_now / p̂_then of the sample's light, where p̂_then is that light's PREVIOUS record
  (`prevLights`) evaluated at this point — a light changing (a cone that swept off the pixel, a dimmed panel, a restrike's 5 % ↔ 100 % strokes either
  way), not an irradiance gradient — × the tile gradient (below). The sample is RE-TRACED from this point every frame it is planned (rays ≥ 3; at rays 2
  every other frame, else its stored V one frame stale). A sample that WAS visible and re-traces occluded is let go (M 0: the shadow's leading edge is
  1-spp fresh for a frame, which the filter is built for). A pixel whose samples all come back DARK keeps a zero-weight reservoir with its M ('looked,
  was dark' is information: keeping only lit outcomes biased every soft shadow +5‥35 % bright, worst where M was reset most — §3.4); a zero-weight history
  is not re-traced (nothing to multiply), it only weighs against the fresh candidate — and where it meets a LIT fresh sample inside a tile whose signed
  gradient already leans bright (z > 2) it is released per pixel (the trailing edge of a walking man's shadow, which the tile-wide reset left mottled at
  8×8 granularity for ~M frames — §3.5).
* **Combine (fresh ⊕ temporal).** Generalized balance heuristic with confidence weights: m_T(y) = M·p̂_prev(y) / (M·p̂_prev(y) + M_f·p̂_now(y)) (p̂_prev(y) = that same
  previous-record-at-this-point target),
  m_j(x_j) = p̂_now(x_j) / (M·p̂_prev(x_j) + M_f·p̂_now(x_j)), where p̂_prev(x_j) is the fresh candidate's target under LAST frame's light record
  (`prevLights[slotInv]`) — a light that did not exist last frame has p̂_prev = 0 and enters at full weight: a muzzle flash or a restrike lights in
  the frame it appears, and once gone it is simply an invalid slot. Weights w = m·p̂·V·W; W_new = Σw / (p̂(y)·V(y)); M ← min(M + M_f, cap 20).
* **Tile gradient (the "A-SVGF" part).** Per 8×8 tile per class, over lanes that have both a fresh one-sample estimate f = W_live·V_f and a temporal one
  t = p̂·V·W: z = Σ(f−t) / √(Σ(f−t)² + floor). |z| ~ N(0,1) whatever the light level in the steady state; a shadow edge sweeping through the tile, a door
  letting light in, a man stepping in front of a lamp moves dozens of lanes the same way (z ≫ 5): confidence 1 below |z| 3.5, 0 past 5.6, applied to the
  tile's M that frame; the signed z also gates the per-pixel release above. (A first version compared Σf/Σt against a ratio threshold and twitched in the dark, where a handful of Bernoulli votes are all
  the tile has — the diagnostic view showed 8×8 resets peppering every shadowed floor.)
* **Spatial.** k taps from a golden-angle disc (radius 16 px @1000 rows, ≤ 0.6 m on the surface) on the neighbours' TEMPORAL reservoirs of last frame
  (their own reprojection: no intra-frame dependency, one dispatch), plane / normal rejection, PAIRWISE MIS against the canonical sample (defensive
  form: m_i = (1/k)·M_i p̂_i(x_i)/(M_i p̂_i(x_i) + (M_c/k) p̂_c(x_i)), m_c = (1/k)Σ (M_c/k) p̂_c(y)/(M_i p̂_i(y) + (M_c/k) p̂_c(y)), a rejected pair's
  share returned to the canonical), the neighbour's stored V standing in for ours in the weight. Without a final visibility ray that stand-in softens
  hard contact shadows by up to the radius, so below rays 5 the spatial pass runs only where the pixel's own history is YOUNG (M < 8: disocclusions,
  drops, cuts — noisy anyway, and the bias lasts the few frames it takes M to grow); rays 5+ traces the final ray and runs it everywhere. What next frame
  inherits is the TEMPORAL stage (no M inflation loop through the spatial pass).
* **Shade.** (Superseded 08-11 by §5: S is now the luminance Σw coloured by the BELIEVED-VISIBLE unshadowed mix at the pixel; the form below is
  the fallback and an A/B row.) Every sample traced this frame shades with its own light's hue: S = Σ_j hue(light_j)·w_j over the temporal sample, the fresh
  candidate(s) and the accepted neighbours (luminance Σw = the unbiased estimate of the class's visible light, capped at W_live), × the glass tint of
  the reservoir's own light. A first version tinted the class's live U by the visible FRACTION (aggregate hue): a floor lit by a warm lamp with the
  moon in its U but behind the ceiling came out blue-grey. softblur's per-channel ratio clamp opens to 4× under FLAG_RESTIR (as it already does for
  the chroma-exact tail): one warm light under a mixed U tops U's red channel legitimately.
* **The moon / the sun.** Scored unshadowed, a directional light reaches every up-facing surface indoors; it out-drew a dim desk lamp for the fresh
  candidate on every indoor floor and its ray died in the ceiling (a wasted ray + a penumbra hint everywhere + torch light indoors starving for fresh
  samples under a daytime sun). `reach.ts reachMaskForDirectional`: outdoor cells + indoor cells with an unblocked static path toward the light (five
  points × three heights, the level's own raycast, glass passing) — 472 / 1120 cells for the moon — used ONLY while the ReSTIR path is on (`lights.ts
  dirMasks`; the OFF path keeps its all-ones row). Cubicles at high: 2.8 → 1.7 rays / pixel, 4.2 → 3.55 ms.
* **Ray plan per tier** (`restirRays`, ONE tracer call site, fixed queue positions so a SIMD group traces the same kind of ray at each step): 2 = per
  frame one class re-traces its history sample and the other traces a fresh candidate (swapping every frame — by FRAME, not on a checkerboard: lanes
  tracing different kinds of ray side by side cost more than the rays saved, the same reason CheckerDirect buys nothing here) · 3 = both re-trace +
  one fresh alternating · 4 = both + both · 5 = + the final ray for spatial picks · 6 = + a second fresh candidate per class.
* **What feeds the shadow denoiser (the v3 client now, softblur under `?legacydenoise`):** unchanged in kind — S per class + own hint in alpha (from any
  blocked ray this frame; else last frame's own hint at this surface, one frame of memory; else 0 = inherit), U exact. Both cores open their per-channel
  ratio clamp to 4× under FLAG_RESTIR (engine.ts `K.ratioHi`, softblur.wgsl `ratioOf`).
* **Rejected on measurement:** tile-coherent fresh draws (a random stream shared by the 8×8 tile: −0.6 ms of 4, but LDR temporal sd on the lamp-lit
  desk 0.10 → 4.6 — 8×8-correlated one-sample noise reads as crawling blocks; kept as an A/B row, off) · checkerboard alternation of the ray plan ·
  four inlined tracer call sites (−1 ms for the same rays once queued through one).

Debug: view 11 = history M per class + gradient resets, view 12 = rays / taps / neighbour-shaded per pixel (the filter chain steps aside for both);
`tools/qa/restir-bench.js` (`__rb`: measure / ab / diag / hot / slope / quality / dyn* / stressAll / meter / identityCapture).

## 3. Numbers (M4 Max, Chrome / Metal, serialized frames — CLAUDE.md's protocol; the final takes below are on the merged tree: TAAU + the v3 denoiser + froxel volumetrics, 08-11)

### 3.1 The stress minute, all five tiers, restir OFF vs ON interleaved in blocks over the same evolving scene

`__rb.stressAll`: `__stress.setup({fight:false})` = QRF deployed with weapon lights, rain 0.55, two canisters, 0.6°/frame orbit, 41 lights; 4 blocks × 80
frames per side, sides alternating ABBA; per frame the direct pass, the shadow denoiser ('softblur' names either core), Σ compute and the UNION of compute
intervals. docs/perf/p2a-stress-v3-<tier>.json (the tiers' TAAU sizes) and p2a-stress-v3s10-<tier>.json (renderScale 1.0 = the pre-TAAU pixel counts).

| tier · internal res · restir tier | direct OFF mean · p95 · max | direct ON | union OFF mean · p95 · max | union ON |
|---|---|---|---|---|
| **ultra** 2133×1200 (rays 4 · k 5) | 13.19 · 14.48 · 19.73 | **7.50 · 7.86 · 8.78** | 32.93 · 34.47 · 46.92 | **26.81 · 27.72 · 28.18** |
| **high** 1368×770 = ×0.77 (rays 4 · k 3) | 6.03 · 6.95 · 13.57 | **3.37 · 3.60 · 9.44** | 13.55 · 14.42 · 27.92 | **10.89 · 11.34 · 24.84** |
| high at renderScale 1.0 = 1777×1000 | 9.32 · 10.22 · 15.79 | **5.30 · 5.64 · 5.90** | 19.43 · 20.45 · 33.55 | **15.14 · 15.86 · 16.19** |
| **medium** 1072×603 = ×0.67 (rays 4 · k 2) | 3.94 · 4.39 · 9.70 | **2.11 · 2.23 · 9.04** | 9.45 · 9.83 · 23.53 | **7.62 · 7.93 · 25.30** |
| medium at 1.0 = 1600×900 | 7.88 · 8.98 · 10.16 | **4.42 · 4.85 · 9.90** | 15.97 · 17.04 · 24.90 | **12.42 · 13.11 · 26.54** |
| **low** 768×432 = ×0.6 (rays 3 · k 2) | 2.38 · 2.95 · 7.47 | **1.38 · 1.90 · 4.92** | 6.98 · 8.72 · 19.27 | 6.95 · 9.11 · 17.89 |
| low at 1.0 = 1280×720 | 4.58 · 4.92 · 11.08 | **2.36 · 2.88 · 3.54** | 10.29 · 10.62 · 24.77 | **8.02 · 8.78 · 16.52** |
| **verylow** 533×300 = ×0.5 (rays 2 · k 1) | 1.33 · 1.84 · 4.13 | **0.79 · 1.05 · 2.16** | 6.62 · 8.78 · 15.07 | 6.92 · 8.39 · 16.32 |
| verylow at 1.0 = 1066×600 | 2.41 · 2.62 · 4.72 | **1.59 · 1.90 · 2.49** | 7.05 · 7.47 · 16.06 | 6.76 · 8.26 · 10.49 |
| *pre-merge takes (legacy denoiser, no froxels), for the record:* ultra r4k5 | 13.17 · 14.42 · 20.45 | 7.06 · 7.54 · 8.19 | | |
| high ×0.77 r4k3 · r3k2 | 5.95 · 6.68 · 7.08 | 3.16 · 3.47 · 5.18 (r3k2 2.63 · 3.21 · 4.65) | 14.73 · 15.6 · 16.38 | 12.21 · 13.5 · 20.97 |
| ultra r6k5 · r5k5 (rejected: 12.68 mean for no gain · +3.5 for the final ray) | 13.06 · 14.22 | 12.68 · 13.43 (r5: 10.55 · 11.21) | | |

Direct halves at every tier (0.51–0.60 of the leader path; the max column loses its spikes: the pass no longer scales with how many lights the orbit
swings into view). The union follows at ultra / high / medium (−6.1 / −2.7 / −1.8 ms mean; high's p95 14.42 → 11.34 against the program gate's 14); at
low / verylow the direct pass is no longer on the frame's critical path (Metal runs it beside the cascade chain, whose fixed cost is the long pole there)
and the union does not move outside the take's noise. Against the brief's direct p95 targets (high ≤ 3.5 · ultra ≤ 7 · medium ≤ 3 · low ≤ 2 · verylow
≤ 1.5) at the tiers' shipping sizes: 3.60 · 7.86 · 2.23 · 1.90 · 1.05 — high and ultra a hair over on this merged tree (3.47 / 7.54 on the pre-merge
take; the other lanes' passes now share the GPU timeline inside the frame and a P4 lane was measuring beside this one), the rest inside.

### 3.2 Where the direct pass's time went, and the slope against light count

Cubicles still, high. The first working cut cost MORE than the pass it replaced (non-ray overhead 2.5 ms: private candidate arrays, four inlined tracer
call sites, per-class structs); the lean rewrite (raw reservoir words, luminances only, ONE `traceSample` call site fed by a fixed six-slot queue) took the
overhead to 1.7 ms and the same rays a millisecond cheaper; alternating the odd ray by FRAME instead of on a checkerboard made rays 2 / 3 actually cheaper
than 4; the moon's directional reach mask (2.8 → 1.7 rays / pixel indoors) took 4.2 → 3.55. At 1777×1000: leader path 7.1–7.3 ms → ReSTIR 3.55 (rays 4)
/ 2.97 (3) / 2.54 (2). Slope (`__rb.slope`, high 1368×770, the level's groups switched off one after another, 37 → 6 lights, docs/perf/p2a-v3-slope.json):
**0.072 ms / light OFF → 0.036 ms / light ON** (4.42 → 2.37 ms at 37 lights, 3.56 → 2.13 at 11). What is left of the slope is the exact per-pixel scoring of
every listed light — kept on purpose (it is U, and the candidate pdf); the ray cost no longer moves with the light count at all.

### 3.3 Still quality: temporal noise and filtered means (cubicles, high ×0.77, 30 frames per variant after 60 warm; docs/perf/p2a3-quality-cub4.json, crops docs/shots/p2a/p2a_q_cub4_<tile>_<variant>.jpg ×3)

| tile (300² output px) | LDR temporal sd, 8-bit steps: off → r4k3 · r3k2 · r2k1 (v3 denoiser) | the same under the legacy pair: off → r4k3 | filtered broad-class mean ÷ off: r4k3 · r3k2 · r2k1 | offRef (no early-out) ÷ off |
|---|---|---|---|---|
| chairs17 (chair + desk shadows under a panel) | 0.045 → 0.108 · 0.101 · 0.095 | 0.073 → 0.154 | 0.979 · 0.976 · 0.977 | 0.995 |
| under18 (desk under the flickering panel) | 0.064 → 0.145 · 0.138 · 0.143 | 0.126 → 0.231 | 0.977 · 0.973 · 0.976 (sharp 0.998) | 1.000 |
| aisle (open floor between panels) | 0.011 → 0.042 · 0.041 · 0.040 | 0.018 → 0.060 | 0.982 · 0.981 · 0.981 | 0.998 |

Boil fraction (|Δ| > 8 steps) ≤ 0.0002 everywhere, both estimators. So: after the v3 shadow client the ReSTIR picture carries 2–4× the leader path's
residual temporal noise, at a level of a tenth of an 8-bit step (the legacy pair leaves about 1.5× more of it); and it sits 2–2.5 % under the leader
path in the broad class's filtered mean — of which ~1.5 % is the estimator (§3.4) and the rest is the leader path's own early-out reading BRIGHT of the
reference in these tiles. In the crops the one visible difference is the outer penumbra of the chair's shadow (chairs17): the leader path at
adaptive-min 3 paints it fully dark to the tile's corner, the no-early-out reference and all three ReSTIR tiers fade it out sooner and alike
(docs/shots/p2a/p2a_q_cub4_chairs17_{off,offRef,r4k3}.jpg) — the reference sides with ReSTIR.

### 3.4 Bias, raw (denoiser off, dS means vs the no-early-out leader path `directAdaptiveMin 9`; docs/perf/p2a-rawbias5…9.json, p2a4-fix1.json)

The investigation that shaped §2's temporal rules, in order:

| variant | under18 broad | chairs17 | aisle | note |
|---|---|---|---|---|
| drop every zero estimate (first cut) | **1.20–1.38** (r2: 1.40) | 1.06 | 1.02 | survivorship: only lit outcomes reach the history; worst in low-M pixels (M < 10: ×1.66, M ≥ 10: ×1.19) |
| standard combine (zero-weight kept, nothing dropped), jittered domain | 0.89 | 0.93 | 0.96 | converged (warm 40 = warm 160); the same with every ray from the unjittered origin |
| the same, TAAU jitter off | 0.993 | 0.991 | 0.987 | → the dark bias is the jittered REPROJECTION handing over the neighbour's reservoir |
| + drop only 'was visible, now occluded' | 0.90 | 0.96 | 0.98 | |
| **unjittered domain** (rays + reprojection from the unjittered centre) r4k3 · r3k2 · r2k1 | **0.983 · 0.976 · 0.978** | 0.984 · 0.983 · 0.984 | 0.986 · 0.985 · 0.984 | jitter on; jitter off reads 0.995 / 0.989 / 0.988 |
| + the per-pixel trailing-edge release (as shipped), high ×0.77 | 0.976 (r2k1 0.973) | 0.985 | 0.984 | |
| for scale: the SHIPPING leader path (adaptive-min 3) vs the same reference | +6 % on the lamp-lit desk, −10 % in the panel penumbra | | | (its early-out declares all-lit / all-dark after 3 agreeing samples) |

Residual: −1.5…−2.5 % in the broad class in partial-occlusion regions, ~−0.5…−1.2 % of it present without jitter (the M-capped EMA and the ½-px domain
offset), the sharp class within 0.3 %. Spatial reuse adds nothing measurable (k 0 vs k 3 agree to 0.5 %).

### 3.5 Dynamics (v3 denoiser, high ×0.77; `__p3` scenes from the denoiser lane with restir off / on variants + `__rb.dynFlash`; crops docs/shots/p2a/p2a3_* / p2a4_*)

* **Door spill** (storage door swung open, the bulb's wedge across the corridor floor; tile mean luma per frame, docs/perf/p2a3-dyn-door.json): off 54.9
  55.1 56.2 58.5 61.9 65.5 69.1 73.7 75.7 76.0 … / on 55.6 55.7 56.8 59.2 62.7 66.4 70.2 72.6 74.9 75.4 … — the wedge tracks the leaf frame for frame, no lag
  either way (the light exists throughout; what changes is visibility, which is re-traced every frame).
* **Muzzle flash** (engine flash at a fixed point in the dark corridor, ttl 3 frames; docs/perf/p2a-v3-flash.json): off 231.4 202.7 106.9 8.5 8.4 … / on
  231.2 202.8 106.9 8.1 8.0 … — lit in the frame it appears at the same level (a light absent from `prevLights` enters MIS at full weight), gone with
  nothing left behind (its slot is invalid next frame; the gather takes transients out of its on-screen reuse as before).
* **A man walking under a panel with his torch on** (p2a3_strafe_f{4,8,12}_{off,on,onL} before the trailing-edge release, p2a4_strafe_* after): the leading
  edge of his floor shadow is fresh every frame (visible-then-occluded samples are dropped); the trailing edge — floor his shadow just left — was the one
  visible artefact of the zero-weight history: dark history × 20 against one lit fresh sample = a 1/(M+1) climb, reset by the tile gradient only where
  most of an 8×8 tile moved, so a mottled band ~0.5 m behind him at tile granularity (p2a3_strafe_f8_on). With the per-pixel release (a dark history
  meeting a lit sample in a tile whose signed z > 2) the band is gone to the eye at ×3 (p2a4_strafe_f8_on vs _off); the tile means did not move (§3.4 last row).
* **Hard contact shadows from a small emitter** (the manager's desk lamp, P3's `deskLamp` pin, ×4: docs/shots/p2a/p2a4_desklamp_{off,on}.jpg): the lamp
  base's contact rim and the shade's shadow boundary read alike — no stair-stepping from tracing the shadow term at the unjittered centre.
* **Blackout / restrike** (mains cut for 2 s then restored, whole-frame mean per frame, seeded dice, docs/perf/p2a3-dyn-blackout4.json + crops
  p2a3_blackout_f*): the cut is instant with both (30.4 → 2.1 within the frame: U is exact and S is capped at the live unshadowed total, so no history
  can hold light that no longer exists); the beacons and the staggered restrike then differ between two OFF takes as much as between off and on (the
  restrike's per-fixture stagger and flicker draw from the game's dice at different counts per run) — no lag or hold-over visible in the crops, but this
  scene cannot give a frame-exact overlay. NB for whoever stages it next: `__resetClock()` after a restart puts every mains fixture back before its
  `restoredAt` (dark for seconds), and a `restartEncounter()` restrikes the whole floor — settle ≥ 300 frames.
* **Lights switched off / on by group** (pre-merge take under the legacy pair, docs/perf/p2a-dyn3-switch.json): off is instant with both (the residual is
  the bounce converging); switching four groups back ON, ReSTIR's first frames read 58 → 77 → 85 → 91 % of the leader path's level (f0…f4, equal by f8):
  the returning lights restrike through 5 % ↔ 100 % strokes and the symmetric target ratio deliberately distrusts a history whose light just jumped —
  1-spp for those frames, which the filter smooths at some cost in level. Not chased further.

### 3.6 OFF identity, light meter, GPU validation

* **`?norestir` is main, bit for bit:** the deterministic still (seeded dice, parked guards, zeroed phases, clock reset, 24 steps, high ×0.77 under TAAU +
  v3 + froxels) hashes e30630e9 on this branch with `?norestir` (two boots) AND on main @ ed5e19f served beside it — the same 1777×1000 LDR frame
  (docs/shots/ab/p2a_ident_mine_norestir_{a,b}.png, p2a_ident_main_a.png).
* **Light meter unchanged:** Sam's visibility at five spots off / on / off again (docs/perf/p2a-v3-meter.json): 0.684 / 0.681 / 0.681 · 0.498 / 0.499 /
  0.499 · 0.069 / 0.068 / 0.067 · 0.455 / 0.456 / 0.453 — and 0.754 / 0.876 / 0.876 at the spot under the flickering cubicles tube (the first read caught
  its dropout; on = off-again). The probe pass keeps its own every-light loop by design.
* **Validation** (error scopes + the uncaptured list, docs/perf/p2a-v3-post.json): all five presets with an orbiting camera and back, render-scale steps
  0.6 / 0.85 / 0.5 / 1.0 / 0.77, debug views 0–13, every restir tier + gradient / coherent / spatial-everywhere toggles + off / on, legacy ↔ v3 × restir
  off / on, froxels off / on, TAAU off / on, a 4 s blackout + restrike, six flashes, the breach (daylight: both kind-2 lights carry a directional reach
  mask), a histories restart — zero validation / OOM errors, zero uncaptured.

### 3.7 Gates (the merged tree, 9347641 + the doc)

typecheck clean · `tools/qa/gate.sh perf frame-layout player breach weather glass` exit 0 (perf 24 · frame-layout 9 · player 166 · breach 13 · weather 12 ·
glass 39 PASS lines, 0 FAIL) · `tools/qa/quality-plan.ts` exit 0 (the model prices direct by the ReSTIR tier: the M4 still plans high ×0.77, M1-class HiDPI
verylow) · `tour.ts --runs 2`: 2/2 PASS · `soak.ts --seeds 1,2 --minutes 6` and `--seeds 3 --minutes 6 --loud-at 1`: 0 exceptions, no violation kinds ·
`bun run build` OK. In the browser on the merged tree: boots clean at every preset with restir + v3 + froxels, no console / GPU errors (§3.6).

## 4. What is left, and what Phase 3 (the shared denoiser) inherits

* **The signal Phase 3 gets** is the one softblur gets today: per class S (rgb) + a signed penumbra hint (alpha; from any blocked ray this frame, else last
  frame's own hint at this surface, else 0 = inherit) and U exact. Under ReSTIR S is already temporally smooth where nothing changes (an M-capped history in
  SAMPLE space, ~20 candidate-equivalents) and carries 1–4-spp noise exactly where the history was dropped or cut: disocclusions, the trailing edge of a
  moving shadow, a tile the gradient reset, the first frames of a new light. That is a variance signal a ReLAX/SVGF-class filter wants explicitly: the
  reservoir's M (÷ cap) per pixel per class IS the history-length / confidence input such filters derive from moment history — export it (two spare bits
  would not do; a small r8 pair or the hint texture's spare precision) instead of making the v3 core re-derive it from moments — the one integration step
  left between the two lanes now that both are in.
* **Ratio space stays the right domain**: U is exact per pixel and per frame (cone edges, N·L, falloff, flicker all exact), so filtering S/U and
  re-multiplying keeps every unshadowed edge sharp for free; the per-light hue means S/U is no longer ≤ 1 per channel (softblur's clamp is at 4× under
  the flag) — Phase 3 should filter luminance ratio + chroma separately or accept the wider clamp.
* **Not done here:** the spatial pass's final
  visibility ray below rays 5 (young-only reuse is the stop-gap); the 12-bit depth signature has no normal (a plane test with the current normal stands in);
  `restirCoherent` (tile-shared draws) is parked as an A/B row — a real win (−0.6 ms of 4) if Phase 3's filter can eat 8×8-correlated one-frame noise, which
  softblur cannot; the OFF path's `directSamples*` / `directAdaptiveMin` / CheckerDirect / dimRays knobs are inert under ReSTIR and could leave the presets
  once ?norestir is retired; the light-meter probe keeps its own every-light loop (by design: one model for AI and picture means the same LIGHTS and the
  same occlusion, not the same estimator — and it must not inherit screen-space noise).
* **Known look differences vs the leader/tail path (§3.3–3.5):** penumbrae carry 2–4× the residual temporal noise after the v3 shadow client (0.10–0.15
  of an 8-bit step vs 0.045–0.064 — invisible at 60 Hz, but it is what the numbers say); the broad class sits 1.5–2.5 % dark of the no-early-out reference
  in partial occlusion (the shipping leader path's own early-out is +6 % / −10 % off the same reference, and paints outer penumbrae fully dark where
  ReSTIR and the reference fade them); the trailing edge of a moving shadow is 1–4-spp fresh for a frame or two where the release fires (by design); where two visible lights of ONE class differ strongly in colour (the red beacons beside a white
  torch in a blackout) the per-pixel hue follows the reservoir's light and flips at the reservoir's rate — a slow chroma crawl the filter mostly hides;
  the moon through a slit narrower than the reach mask's five looks per cell is lost indoors (errs the way the other reach masks do).

## 5. Follow-up 08-11 (lane `v3/restir-speckle`): the vending-floor speckle — per-tile light beliefs

**Symptom** (flagged by the P4 lane on main @ 220487b, reproduced on eec7cfc): with `settings.restir` on, the break-room lino under the two vending
fronts (a RED and a BLUE emissive panel = two kind-3 area lights of the broad class, 0.44 / 0.38 m discs 1 m up) carries a sparse dark per-pixel
speckle / mottle that the leader path does not: temporal sd of 8-bit luma on the P4 'vending' view's tiles (contact / lobe / a dim tile at the far end,
high ×0.77, gloss + reflections + detail off, storm off) 0.18 / 0.15 / — ON vs 0.020 / 0.002 / 0.010 OFF; crops docs/shots/rs_on_ng_contact.jpg,
rs_off_ng_contact.jpg, rs_vending_on_nogloss.jpg (whole frame: the dim end is worst).

**Not the cause** — the four hypotheses the brief listed, each checked with a per-pixel readback of the fresh / temporal visibilities and picks
(debug view 12 hot-patched through `__rb.hot`): over 480 k floor pixel-frames NO sample on either panel (slots 29 / 30) ever came back occluded or
partial (`fPartial = 0`), so (a) a reused emitter point occluded across the disc, (b) a missing emitter cosine in p̂ (evalLight's `ce` term is there;
W ≤ 60000 f16, M ≤ 20), (c) self-shadowing by the machine's own boxes (the disc sits 7 cm proud of the front, rays stop 3 cm short) do not occur here,
and (d) the spatial pass is not running on that floor at all in the steady state (taps 0.002 / pixel: history is never young).

**The causes, measured:**
1. *Chroma.* The shade step coloured every traced sample in its OWN light's hue (S = Σ_j hue(light_j)·w_j — §2 Shade, chosen so a warm lamp under an
   occluded moon does not read blue-grey). Under two overlapping panels of different colours each pixel wears the colour of whichever panel its
   reservoir happens to hold (temporal weight M/(M+1) ≈ 0.95); the reservoir's light is a per-pixel Markov chain switching every ~M frames, spatially
   white → a red / blue MOSAIC crawling at the reservoir's rate, which the shadow denoiser neither averages (temporally correlated over ~20 frames) nor
   blurs (no penumbra hint → hint-free tile pass-through). Excluding the occluded candidates below and keeping the per-sample hue leaves the sd where it
   was (0.20) and shows the mosaic bare (docs/shots/rs_excl_contact.jpg); a spatial chroma high-pass reads 4.9 vs 1.6 OFF.
2. *Luma.* The fresh candidate on that floor: red 33 %, blue 23 %, `street_lamp_e` (slot 3, behind the outer wall, reach level > 0 through the fire
   exit / windows) 37 %, `panel_corridor_20` (slot 17, behind the shut break-room door) 8 % — 45 % of the fresh rays go to lights that are NEVER visible
   there (80 % at the dim end, where the panels have fallen off and the lamp has not). Unbiased, but each is a coin flip worth ±W_live: the estimate is
   an EMA (α = 1/(M+1)) of Bernoullis → ±14 % (near) to ±30 % (dim end) per pixel, crawling; runs of dark draws are the dark specks (at low / verylow the
   zero-weight path makes them black). Every blocked ray also planted an 18 px 'penumbra' hint from the wall's blocker distance on half the floor, so the
   denoiser smeared the mosaic into blobs and paid for it. Swapping in an aggregate hue over the LIVE set (the pre-§2 form) confirms the split: sd 0.062 /
   0.085 (luma alone) but the floor turns orange — the lamp's sodium hue is 37 % of U (docs/shots/rs_agg_lobe.jpg): the hue must exclude occluded lights.

**The mechanism** (`restir.wgsl` header BELIEFS; three commits c26649e, 29a77a5, 5b883dc):
* Per 8×8 tile, one 16-B record behind the reservoir texels in the same buffer (`tileRecIndex`; passes.ts `allocRestir` sizes tiles × 65 × 16 B): a
  64-bit DARK mask (every ray this tile spent on light slot s last frame came back blocked) and a 64-bit LIT mask (some ray of the tile saw it), by slot,
  remapped through `ru.fwd` like the reservoirs. Lanes 0‥24 load the 5×5 tile neighbourhood's records; a light is TILE-DARK here iff DARK here and LIT
  in none of the 25 (a shadow EDGE a tile or two away keeps the light in play: without the neighbourhood the storage door's opening wedge came in as 8×8
  stair-steps along the leaf's retreating shadow — docs/shots/rs_door_new_f20.jpg is with it, indistinguishable from rs_door_off_f20.jpg). Votes are two
  atomicOr masks fed by every traced ray (fresh, re-trace, audit; an un-retraced history's stored V > 0 counts as seen); lane s writes slot s of the record
  out (seen → LIT; tried and only blocked → DARK; untried → carried, except a DARK bit must be re-earned on the tile's audit frames); lane 0 stores it in
  the same barrier skeleton the temporal gradient uses (now unconditional). `passes.resetTaa` (a camera cut) zeroes the record tail: screen-anchored and
  unvalidated, unlike the depth-validated reservoirs.
* HUE: S = Σw × hue(Σ_i E_i·β_i), β = 0 for tile-dark lights and for the pixel's own `darkSlot` (6 spare bits of the two B words: the light this pixel's
  fresh ray last found dark inside a tile that has it lit — the interior of a COLOURED SHADOW keeps the other light's hue; cleared when seen again), 1
  otherwise; the per-sample form is the fallback where nothing believed visible reaches the pixel, and the A/B row `restirSampleHue`.
* DRAW (`restirKnownDark`, default on): tile-dark lights leave the fresh draw — known dark exactly as a reach-masked light is (in U and W_live, no ray, its
  true 0); the fresh weight is W_f = Σ over the drawn set. On `restirAudit` (¼) of its frames, staggered across tiles, EVERY lane of a tile that has a dark
  set traces one AUDIT ray (kind-1 queue slot; ∝ unshadowed weight within a class ∝ its dark weight) whose outcome only votes. A quarter of the LANES
  auditing every frame measured +0.4 ms (a SIMD group idles through a queue slot only some lanes fill — §2's checkerboard lesson); whole tiles a quarter of
  the time cost a fraction. A y whose light the draw excludes takes m_T = 1. Blocked rays toward tile-dark lights set no blur hint.
* What it costs in expectation: nothing while the verdicts are right (a tile-dark light contributes its true 0); a light visible from a SLIVER of a tile
  that no reservoir there holds lit and no tile in the 5×5 sees reads dark by its share on that sliver until an audit ray from the sliver draws it (≤ the
  audit period). Uv / Wf sit in workgroup memory across the trace loop (registers through the inlined tracer are what this pass pays for).

**Numbers** (M4 Max, serialized; 'old' below = the first cut's hue + draw emulated inside the new shader by the two A/B rows — hint gating stays — and
'main' = eec7cfc's shader hot-swapped; OFF = the leader path):
* Vending tiles, temporal sd of 8-bit luma, contact / lobe / dim — **ultra** r4k5: OFF 0.020/0.003/0.002 · old 0.217/0.234/0.605 · NEW 0.015/0.007/0.006;
  **high** r4k3: OFF 0.024/0.008/0.003 · old 0.219/0.248/0.712 (main 0.18/0.15/—) · NEW 0.024/0.012/0.009; **medium** r4k2: OFF 0.050/0.017/0.011 · old
  0.211/0.235/0.731 · NEW 0.037/0.026/0.017; **low** r3k2: OFF 0.095/0.030/0.015 · old 0.223/0.243/0.763 · NEW 0.056/0.048/0.040; **verylow** r2k1: OFF
  0.133/0.037/0.023 · old 0.234/0.238/0.654 · NEW 0.063/0.056/0.050. Spatial high-pass at high (luma / chroma, contact tile): OFF 0.55 / 1.66, main 0.72 /
  4.90, NEW 0.55 / 1.64. Tile means agree with OFF within 0.3 % (verylow contact −1 %). Crops ×3: docs/shots/rs_p_<preset>_{off,old,new}_{contact,dim}.jpg,
  rs_new3_contact / _dim, rs_vending_new2.jpg (whole frame).
* Coloured shadows (Sam in front of the two machines, docs/shots/rs_sam_{off,new,old}_{red,blue}.jpg): mean RGB inside the blue-lit shadow OFF (48.3, 46.4,
  87.4) / NEW (48.5, 46.7, 87.5); inside the red-lit one OFF (122.9, 58.3, 70.5) / NEW (121.2, 58.4, 71.8) — 1–2 levels of 255 less saturated where the tile
  straddles the shadow (the tile-wide part of the belief); the mosaic around them is gone (rs_sam_old_blue.jpg shows it).
* §3.3's bench (cubicles, high ×0.77, filtered broad-class means ÷ the no-early-out reference, 16 frames after 40): chairs17 old r4k3 0.984 → NEW 0.986 / r3
  0.986 / r2 0.985; under18 0.973 → 0.989 / 0.987 / 0.988; aisle 0.984 → 0.985 (sharp class 0.998 as before) — the envelope tightens to −1.1…−1.5 %
  (the coin flips' upper excursions were being clipped by the S ≤ W_live cap: a dark bias the draw no longer has). LDR sd chairs 0.096 → 0.044 (OFF
  0.039–0.070), under 0.161 → 0.059 (OFF 0.050–0.063), aisle 0.040 → 0.014 (OFF 0.010): the '2–4× the leader path's residual noise' of §3.3 is gone.
* Dynamics: the storage door's wedge, tile luma per frame, same session — OFF 64.2 → 69.6 (f19) → 80.5 (f39), NEW 64.4 → 69.6 → 80.3 (per-LANE audits
  without the neighbourhood tracked too; per-TILE audits without it lagged 3.8 by f39 and stair-stepped); the muzzle flash OFF 231.6 / 202.7 / 106.8 /
  8.5 vs NEW 231.4 / 202.6 / 106.7 / 8.2 (= §3.5).
* Cost, high 1368×770, 37 lights, main's shader vs NEW interleaved 3 rounds × 24 frames (direct · shadow denoiser · union): break room 1.70 → 1.86 ·
  1.16‥1.81 → 0.85 · 7.10 → 6.6‥7.0; corridor 2.23 → 2.43 · 1.28 → 0.99 · 7.07 → 6.98; cubicles 2.29 → 2.52 · 1.45 → 1.06 · 7.46 → 7.30. The direct pass
  pays +0.16‥0.22 ms (the neighbourhood load + remap, the vote atomics, the audit rays, one barrier); the shadow denoiser gets 0.3‥0.4 ms back (no bogus
  hints: more hint-free tiles pass through); the union is 0.1‥0.16 ms LOWER. (Steps on the way, cubicles direct: lane audits 2.85, tile audits 2.52, +
  the stash 2.39‥2.48, + masks / neighbourhood 2.52.)
* GPU validation: an error scope + the uncaptured list round the per-preset runs (debug views 11 / 12 / 3 / 13, restir off / on, knownDark off / on,
  audit 1 / 0, render scale 0.6 and back, a resetTaa) — nothing at any of the five presets.

**Knobs** (Tab ▸ Direct light): `restir: A/B per-sample hue (the mosaic)` = `settings.restirSampleHue` (false), `restir: known-dark lights leave the
draw` = `restirKnownDark` (true), `restir: audit fraction` = `restirAudit` (0.25 of a tile's frames). `?norestir` is untouched (direct.wgsl not edited).
**Left:** the sliver case above is a documented, transient, dark-side bias rather than noise; the belief record has 64 spare bits a tile; `restirCoherent`
still parked; the hue is one frame behind a light's first arrival in a tile that had it dark (the fallback covers the frame).
* Other fixtures (high, temporal sd, OFF · first cut · NEW; tile means within 1 % of OFF except where noted; crops docs/shots/rs_f_<view>_{off,old,new}_<tile>.jpg
  ×3): corridor lino under its panels 0.010 / 0.006 · 0.091 / 0.074 · 0.024 / 0.013; server floor under the cold panel 0.006 · 0.045 · 0.006; a cubicle
  desk (monitor glow + the flickering panel) 0.014 · 0.258 · 0.057 (the old crop is visibly grainy with dark specks on the carton, the new one reads
  as OFF); lobby stone through the frontage glass 0.014 · 0.016 · 0.017 (level −1.6 % for both ReSTIR variants: pre-existing) and its moon patch 0.012 ·
  0.011 · 0.011; the wet lot in the rain (sd dominated by the animated rain / wet gloss) 2.1 / 3.7 · 1.8 / 3.6 · 2.2 / 3.9; storage shelving under the bulb
  0.041 / 0.027 · 0.030 / 0.028 · 0.024 / 0.028.
* OFF identity: `?norestir` still hashes bit-identical to main — 65351eed on this branch (:5188) and on main @ 80714df served beside it (`__rb.identityCapture`,
  high ×0.77, TAAU on). direct.wgsl / direct_common.wgsl are not touched.
* Gates (b62eee1): typecheck clean · `tools/qa/gate.sh perf frame-layout player breach glass` exit 0 (24 · 9 · 166 · 13 · 39 PASS lines, 0 FAIL) ·
  `tour.ts --runs 1` PASS · `soak.ts --seeds 2 --minutes 4` no violations · `bun run build` OK.
