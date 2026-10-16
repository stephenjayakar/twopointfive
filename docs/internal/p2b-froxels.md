# P2b — froxel volumetrics: the haze and the smoke lit per froxel, one fetch per pixel (2026-08-10, lane `v3/p2b-froxel`)

Brief: docs/internal/renderer-v3.md rev 2 / STATUS "RENDERER V3" Phase 2b — replace the per-pixel volumetric march (haze beams: pixels × beams × steps ×
shadow rays; smoke: pixel rays × per-domain stretches × steps × K lights) with a camera-frustum voxel grid ("froxels", Wronski 2014 / Hillaire 2015): light
lists per froxel, one shadow ray per froxel-light, temporal accumulation with reprojection, front-to-back integration, ONE trilinear fetch per pixel — cost
per froxel, flat in how many beams cross a pixel. Budget: volumetrics p95 ≤ 1.2 ms at high in the gate minute (≤ 2.5 in torture), ultra ≤ 2 / medium ≤ 1 /
low ≤ 0.8 / verylow ≤ 0.6. Machine / method as the Phase-0 / P1 notes: M4 Max, Chrome (the Browser pane) / Metal, dpr 2, this worktree on :5187 (shot sink
:5207), `?paused&quality=…&mute`, SERIALIZED frames (one `__runFrames(1)` → `queue.onSubmittedWorkDone()` → MessageChannel yields → the timer's per-frame
stamps + `unionMs`), the stress minute of tools/qa/stress-scene.js (`fight:false` = the gate take, `fight:true` = torture), interleaved ABBA blocks
(tools/qa/froxel-ab.js: A = the march = `settings.froxelVol=false`, B = froxels; 6 × 100 frames each; frames another GPU client visibly shared dropped by
tools/qa/stress-report.ts's bloom rule, raw arrays kept), crops = tiles of the OUTPUT frame ×2–×4. Other lanes rendered on the same GPU through the night;
the lead's program gate had the GPU to itself for a quarter of an hour in the middle (this lane stood down for it). Everything below is after `git merge
main` with Phase 1 TAAU in (the froxel look was re-verified under the jittered projection: §3.7).

## 1. The design as built

**Grid.** `render/froxels.ts` owns W × H × D rgba16f volumes: `froxelVol` (the raw haze estimate, then — same texture, the raw is dead once the temporal
kernel read it — the INTEGRATED volume consumers fetch), `froxelHist0/1` (the accumulated haze, ping-pong), and on a HALF-RES grid ⌈W/2⌉ × ⌈H/2⌉ × D:
`froxelSmokeJ` (the smoke's source radiance J) and `froxelTransient` (the transient lights' haze); plus `froxelClusters` (⌈W/8⌉ × ⌈H/8⌉ × ⌈D/4⌉ rgba32uint).
H, D, k, history, strata come from the preset (`PRESETS[*].froxel`): **ultra 180 × 56 · k 5 · 3 strata — high 135 × 64 · k 4 · 2 — medium 108 × 48 · k 3 · 2 —
low 80 × 32 · k 2 · 1 — verylow 64 × 24 · k 2 · 1** — every tier's froxel is 7–9 of its OWN output pixels across, so a beam edge reads alike on all five; W = H × the WINDOW's aspect
(not the internal size's, which wobbles a fraction of a froxel across render-scale steps and would re-make the volumes on every ladder move), capped at
2.4 H. Memory (3 haze volumes + J + transient + clusters, 16:9): ultra ≈ 86 MB · high 56 · medium 28 · low 10 · verylow 5. The grid is re-made (history restarted)
on a preset hop or a window reshape only; a spell of ≥ 10 s with the setting off lets the volumes go. The brief's numbers (high 160 × 90, ultra 240 × 135
× 96) were the starting point: at 11 px a froxel the beam apex came out visibly blunter than the march's wedge and there was budget to spare (§2), so rows
went up and ultra's slices came down (D barely shows from this camera — §3.1 — and 96 slices at 180 rows is 130 MB); ultra's first take at 180 × 64 · k 6
read p95 2.36 in the gate minute, over its 2 ms, and 56 slices · k 5 read 1.64 with no difference I could find in a crop (§2).

**Slices** are exponential in DISTANCE ALONG THE PIXEL'S OWN RAY (radial — what `distance(P, camPos)` gives every consumer): boundary s of D sits at
d(s) = near + (far − near)(e^{a s/D} − 1)/(e^a − 1), a = `froxelCurve` 2, far = `froxelFar` 56 m, and **near = max(`froxelNear` 0.5, camera height − 8 m)**
(`Engine.FROXEL_CONTENT_TOP`: nothing anyone can see scatter hangs above the street-lamp heads, so the follow camera 17 m up starts its first slice 9 m out
instead of spending 24 of 64 slices on open air; a spectate close-up or the viewer gets 0.5). From the follow camera that is 0.25 m slices at the near end,
~0.55 m at 20 m, 2 m at the far end. THE mapping — `froxelDist / froxelSlice / froxelDir / froxelFetch` — lives in common.wgsl and reads `frame.froxelA`
(near, far, a, history weight), `froxelB` (W, H, D, k | filter << 8 | (strata − 1) << 9), `froxelC` (this frame's Halton(2,3,5) jitter, lookup bias) and `prevCam`
(last frame's eye + last frame's near, for the reprojection) — the Frame block grew 560 → 624 bytes (tools/qa/frame-layout.ts holds both sides).

**Kernels** (`shaders/froxel.wgsl`, prelude scene + lighting_common + vol_common; ONE compute pass 'volFroxel' ahead of the 2D 'volumetrics' pass —
its own timing because it is a FIXED cost per tier where the 2D pass scales with pixels, and auto quality's calibration counts it in `fixed`):
- `cull` — one thread per CLUSTER (8 × 8 froxels × 4 slices; high = 30 × 17 × 16): the cluster's world box (its 8 corner froxel-boundaries, padded) against
  every light — range sphere · the haze's own 0.002 W/m² floor · spot cone (the clustered-shading cone–sphere test) · a panel's front half-space · a
  directional light only under the ceiling — and every live smoke domain (overlapping = `smOn`, within 0.75 m = `smNear`) → a 64-bit light mask + the two
  smoke masks. Lights with `volumetric` 0 (every ceiling panel) enter only clusters near smoke. This is the per-froxel light list the brief asks for, on the
  GPU (41 lights × ~8 k clusters of trivial tests: not measurable), errs toward 'in'; nothing per froxel is O(lights).
- `inject` — one thread per froxel, the HAZE. Four sub-rays across the froxel (2 × 2 strata + the frame's jitter, scrambled per froxel), one jittered depth.
  For each light of the cluster's mask (steady lights only; reach mask first): its lit chord of the froxel along each sub-ray is EXACT — range sphere ∩
  cone (`coneInterval`) ∩ the panel's half-space — and over it the inverse-square core integrates in closed form ((atan((tB−δ)/D) − atan((tA−δ)/D))/D, the
  equi-angular integral the march estimated with 4–24 steps), ÷ the whole span = that sub-ray's mean; the froxel's estimate is the mean of the four
  (footprint average — one ray through a decimetre-wide froxel either threads a torch's cone near its head or misses it, and the trilinear fetch showed
  that as stair-steps: §3.1). Ranked by unshadowed in-scatter (mean E × volumetric × phase), the k strongest get a shadow ray from a point INSIDE their lit
  chord on the sub-ray the frame picked; the strongest gets N at N equal-weight depth strata of it (`froxelTopRays`: ultra 3, high / medium 2 — a lit sheet
  thinner than a slice, the beam skimming a partition top, is hit-or-miss for one ray a frame and the history shows that variance as crawl AND, through the
  clamp, as a darker sheet; N strata cut both: §3.3); the rest are dropped, never credited unshadowed (P0-C's rule: a torch behind a wall must not glow this side of it). × `smokeTransCoarse` (5 taps over the
  live domains the segment toward the light crosses; 1 at once when it crosses none) = a beam dims beyond a plume. × hazeDensity × hazeAt (the drifting
  dust noise, once). → raw volume rgb (a = 0: the thin haze's extinction is ignored, as it always was). NaN-guarded (a NaN would live for ever in a history).
- `injectJ` — one thread per texel of the half-res grid. (a) TRANSIENT lights (muzzle flashes, tracer heads, lightning — one to three frames each) never
  enter the accumulated volume: their haze is evaluated HERE at the texel's four froxel centres and the chord midpoint, un-jittered (smooth, no history),
  one shadow ray × the smoke's transmittance toward it each (`hazeShadowed`, the steady lights' own function) → `froxelTransient`, only while
  `frame.rcJitter.w` (their count) > 0. (b) SMOKE J: the light field the per-pixel smoke march scatters
  — at the texel centre, un-jittered (no history, cannot flicker), only where the march can read it (the texel's trilinear reach — ±1.5 slices along, ±3
  froxel widths across — touches a live domain box: exact reject; the cluster masks only say 'near'), every texel every frame: the k strongest lights by
  unshadowed E ≥ the march's 0.03 floor, a shadow ray each from the texel centre — for the SUN the mean of 4 depth
  strata of the texel instead (one centre ray made the sunlit slab under a window a terrace of whole slices through the breach's daytime plume: §3.6), × the smoke phase × `smokeSelfShadowIn` (the march's own 4-tap
  self-shadow), + `diceMeanRadianceWalled` (the ambient, never through a wall). (A checkerboard refresh — half the texels a frame, −30 % of the kernel —
  was in until the last day: the moment the camera moves the stale half belongs to froxels that have slid elsewhere in the world, and a plume came out
  hatched at slice pitch. J has no history to reproject through, so it went.)
- `temporal` — the raw haze reprojected into last frame's accumulated volume (froxel centre → `prevViewProj` → uv, distance to `prevCam.xyz` → slice
  through last frame's near), trilinear; clamped to the box of this frame's FOUR NEIGHBOURS ACROSS the screen ± a quarter of their range (not the depth
  neighbours: a beam is a slice or two thick, its depth neighbours are dark air, and with them in the box a dark history passed for plausible everywhere
  inside a beam that had just swept in — its far end, five froxels a frame, rendered at a fraction of its brightness: §3.5); blended at `froxelHistory`
  0.93, halved where the clamp had to move the history. → the accumulated volume.
- `integrate` — one thread per column, front to back: + the transient volume (trilinear at the column) while transients live, then Hillaire's
  energy-conserving step S += T · L · (1 − e^{−σΔ})/σ (→ L·Δ in clear air), T · = e^{−σΔ} → the integrated volume: slice k = (in-scatter, transmittance) from
  the eye to boundary k + 1.

**Consumers.** composite.wgsl `froxelVol`: ONE `froxelFetch` at the pixel's own distance — cubic B-SPLINE across the screen (four trilinear taps, Sigg–
Hadwiger offsets: the plain trilinear kernel shows every froxel boundary as a crease along a beam edge, §3.1; `froxelSharp` switches it back for A/B),
linear along the ray, `froxelBias` slices nearer (default 0 — see §3.4 for why the 0.75 the lane started with went) — laid BEHIND the 2D pass's smoke
transmittance exactly as the march always composed haze after smoke; the particles' splat the same at each particle's own depth (better than the old
'share of the column' — a spark inside a plume). Debug view 5 shows haze + smoke + rain as before.

**What stayed per pixel: the smoke's DENSITY.** The first cut injected the smoke's density into the froxels too — and threw the sim away: the plume's
2–8 cm voxels are far finer than any affordable froxel, and every billow came out a soft blob (§3.2, docs/shots/p2b_h-sheet-plume.png). So the froxels light
the smoke and the pixels march it: volumetrics.wgsl under the flag keeps P0-C's per-domain stretch march (`smokeMarchJ`: the same stretches, step, masked
density sample, energy-conserving step, 3 % early-out) but reads the LIGHTING of each lit step from J — one trilinear fetch, half a slice nearer on purpose (the texel a floor-hugging plume's lowest samples
share with the floor has its centre under the slab, every light occluded: read exactly, it darkened the plume's base by up to half) — where it used to
spend K shadow rays + a self-shadow march + the ambient's wall test per step. Then the rain and `volReact` as before. `volQuarter` therefore now means 'smoke march + rain at quarter res' (medium−).

**OFF = the march byte for byte.** `settings.froxelVol` (default on; `?nofroxel`; Tab ▸ Volumetrics — froxels; not a preset row — the tiers carry
grid/k/history/topRays). Flag down: volumetrics.wgsl runs every line it ran (nine helpers moved verbatim into vol_common.wgsl), composite / particles take
their old reads, no kernel is dispatched, and after 10 s the volumes are freed. Proven: §4.

**Hooks / QA.** `__froxel` {on, grid, state, set(k, v), split(), restart(), summary()}, `__hotFroxel(src?)` (froxel.wgsl from disk into the five
pipelines — how every variant below was A/B'd on one staged scene), `passes.froxelSplitTiming` ('volInject' 'volTemporal' 'volInteg' instead of
'volFroxel'), tools/qa/froxel-ab.js (`__froxab.ab / runAll / summary / table`), tools/qa/froxel-scenes.js (`__fxs`: two fixed torch-like spots instead of a
guard's hand — a march / froxel pair frames the same beam to the pixel — and the batches: beams, plume, trail, flash, door, lot, sdFrames).

## 2. Cost — all five tiers, gate and torture (march → froxels)

`vol` = the volumetric TOTAL per frame ('volFroxel' + the 2D 'volumetrics' pass; A = the march's one pass), `union` = the union of the compute passes' GPU
intervals; mean / p95 / max over the take. All rows below come from ONE quiet quarter of an hour the lead cleared for this lane (ioreg idle but for this
tab; 0–2 % of frames dropped by the bloom rule and it changed nothing), except where a row says otherwise. The window's takes had the strongest light's
shadow term in its earlier form (two strata + a third where they disagreed, at ultra / high; one ray below); what ships (3 / 2 / 2 / 1 / 1 equal strata,
§3.3) is the same ray count at high, one more at ultra where a shadow edge crossed and at medium — high's torture re-take below reads the same mean / p95,
medium's gate re-take +0.07. Internal size = the tier's default under TAAU
(1.0 / 0.77 / 0.67 / 0.6 / 0.5 of the 1000-row cap at this 1600 × 900 CSS window, dpr 2); the second table pins `renderScale` 1.0 for the Phase-0 table's sizes.

**Gate minute** (`fight:false`: 41 lights, 7 carried, 2–3 smoke domains, the shift + the QRF walking; the orbiting follow camera at 18 m):

| tier | internal | grid (W×H×D · k · strata) | vol march | vol FROXEL | budget | union march | union FROXEL |
|---|---|---|---|---|---|---|---|
| ultra | 2133×1200 | 320×180×56 · 5 · 3 · 86 MB | 4.11 / 5.77 / 6.49 | **1.35 / 1.64 / 1.84** | ≤ 2 | 36.4 / 40.0 / 42.8 | 33.1 / 35.5 / 35.7 |
| high | 1368×770 | 240×135×64 · 4 · 2 · 56 MB | 2.27 / 3.01 / 4.78 | **0.94 / 1.11 / 1.31** | ≤ 1.2 | 16.9 / 25.1 / 31.1 ¹ | 14.4 / 15.8 / 19.5 |
| medium | 1072×603 | 192×108×48 · 3 · 1 · 27 MB | 1.31 / 2.10 / 2.75 | **0.57 / 0.59 / 4.39** ² | ≤ 1 | 10.8 / 12.4 / 18.2 | 9.9 / 11.0 / 17.6 |
| low | 768×432 | 142×80×32 · 2 · 1 · 10 MB | 0.85 / 1.18 / 1.77 | **0.41 / 0.52 / 2.49** ² | ≤ 0.8 | 7.3 / 9.4 / 19.9 | 6.8 / 7.7 / 14.6 |
| verylow | 533×300 | 114×64×24 · 2 · 1 · 5 MB | 1.17 / 1.57 / 2.56 | **0.55 / 0.79 / 1.11** ³ | ≤ 0.6 | 6.7 / 8.8 / 17.4 | 7.0 / 8.7 / 16.8 |

¹ the march's own take caught another client for 28 frames (dropped; its raw p95 3.15) — a second take in the window read 2.18 / 2.82 / 5.31 → 1.03 / 1.11 /
5.96 with one shared frame in each max. ² the max is one frame: the first after a smoke grenade opens a domain in view re-makes nothing but fills a band of
J texels at once; p99 0.66 / 0.59. ³ verylow at 533 × 300 is below the size where this GPU keeps its clocks up: every FIXED-cost pass reads ~2× there (rc,
smoke, bloom too — the Phase-0 note's 'low-res tiers read fixed passes double'); the same tier at 1066 × 600 (next table) reads 0.35 / 0.39 / 0.52. The
volFroxel kernel alone: ultra 1.16 / 1.44, high 0.85 / 0.98, medium 0.48 / 0.52, low 0.31 / 0.39, verylow 0.38 / 0.52 (mean / p95); the 2D pass that is
left (smoke march reading J + rain): 0.14–0.23 / 0.20–0.33. Medium's row is at 1 stratum; re-taken with the 2 it ships with (§3.3), on the shared GPU at the
end of the lane: 1.26 / 1.90 / 2.42 → **0.58 / 0.66 / 1.18**, union 10.7 / 11.9 / 19.9 → 10.0 / 10.9 / 23.3, volFroxel 0.49 / 0.59 (+0.07 ms p95 for the
extra ray, as the cost model has it; docs/perf/p2b-gate-medium-strata2-shared.json).

**Gate minute at `renderScale` 1.0** (the Phase-0 sizes; ultra is 1.0 by default = the row above):

| tier | internal | vol march | vol FROXEL | union march | union FROXEL |
|---|---|---|---|---|---|
| high | 1777×1000 | 2.85 / 3.54 / 4.06 | **1.00 / 1.11 / 1.31** | 22.3 / 23.9 / 25.8 | 20.0 / 21.2 / 21.8 |
| medium | 1600×900 | 1.32 / 1.84 / 2.36 | **0.51 / 0.59 / 0.59** | 17.2 / 19.0 / 27.0 | 16.1 / 17.0 / 25.6 |
| low | 1280×720 | 0.89 / 1.25 / 1.70 | **0.37 / 0.39 / 0.46** | 11.5 / 12.7 / 13.3 | 10.8 / 11.6 / 11.9 |
| verylow | 1066×600 | 0.79 / 1.11 / 1.51 | **0.35 / 0.39 / 0.52** | 8.1 / 8.8 / 24.3 | 7.5 / 7.8 / 20.9 |

The froxel cost does not move with the pixel count (0.94 → 1.00 at high from 1.05 M to 1.78 M pixels: the 2D remainder is all that scales) — which is the
point of the phase: the march's p95 was 2.8–3.5 at high depending on how many beams crossed how many pixels; the froxels' is 1.1 whatever the camera sees.

**Torture minute** (`fight:true`: everything in the gate minute + the shift and the QRF firing on staged targets — muzzle flashes, tracers, sparks — and a
smoke or stun grenade every few seconds: 6–8 live smoke domains, 42 lights):

| tier | vol march | vol FROXEL | union march | union FROXEL |
|---|---|---|---|---|
| ultra | 12.2 / 20.8 / 24.2 | **2.10 / 2.69 / 2.95** | 58.4 / 82.5 / 88.3 | 47.5 / 66.3 / 76.2 |
| high | 7.59 / 14.0 / 17.4 | **1.62 / 2.16 / 2.42** (budget ≤ 2.5) | 28.4 / 41.1 / 47.4 | 22.6 / 31.7 / 41.8 |
| medium | 5.07 / 9.76 / 13.6 | **0.86 / 1.25 / 1.57** | 19.7 / 28.8 / 32.4 | 15.5 / 22.0 / 24.4 |
| low | 4.07 / 7.27 / 8.52 | **0.61 / 0.92 / 1.11** | 13.4 / 18.7 / 22.2 | 9.7 / 13.1 / 19.4 |
| verylow | 3.98 / 8.26 / 9.63 | **0.63 / 0.85 / 1.05** | 10.9 / 17.1 / 26.5 | 7.8 / 9.8 / 17.4 |

The march's torture cost was the smoke: pixel rays × per-domain stretches × K shadow rays per step, ×6–8 domains. Under the froxels those rays are J's — per
texel near a domain, not per pixel step — and the frame's worst minute comes down by 10–16 ms of union at ultra / high, 4–7 ms at medium‥verylow.
Re-taken at high after J's last change (every texel every frame, the sun's strata — §3.6) with the other lanes back on the GPU (ioreg ≈ 75 % before the
take; 6 frames dropped by the bloom rule): march 8.28 / 12.8 / 14.9 → froxels **1.64 / 2.16 / 9.24**, union 30.0 / 39.9 / 45.4 → 24.4 / 34.4 / 48.8 — the
same mean and p95 as the quiet take; the max and 13 frames of 600 over 3 ms (p99 7.3) are the shared GPU (the quiet take's max was 2.42 with 0 over 3),
which the interleaving cannot remove from a max (docs/perf/p2b-torture-high-jfull-shared.json).

**Where the tiers came from.** Every tier is sized so a froxel is 7–9 of its own output pixels across (a beam edge then reads alike on all five) and k so
the gate p95 lands at about half the budget, leaving the other half for torture's smoke: high's first grid (the brief's 160 × 90 · k 4) met the budget with
1.1 ms to spare and its apex was visibly blunter than at 135 rows (§3.1); ultra's first (240 × 135 × 96 · k 6, then 180 × 64 · k 6) read 2.36 p95 — over —
and 56 slices · k 5 · 3 strata read 1.64 with no crop I could tell from the 64-slice one; medium / low / verylow took the same 'rows ≈ output rows / 5.6'
rule and the k that kept torture inside the tier's gate budget. `tools/qa/quality-plan.ts` has the kernel as a FIXED cost per tier (`REF.froxelHigh` 0.8 ms
× (h/135)² × (d/64) × (k + strata + 1)/7) and the 2D pass at 0.3 ms × pixels: auto's calibration counts 'volFroxel' among the fixed passes, so a weak GPU
that used to be pushed down a tier by the march's per-pixel cost now sees a constant it can plan around.

## 3. Look — crops, march against froxels

Every pair below is the SAME frame to the pixel: `__fxs` puts two fixed torch-like spots (the guards' hand-torch numbers: 70 W/sr-ish, 7° / 19° cone,
7 cm emitter) in the cubicle bay instead of a torch in a breathing guard's hand, parks everyone, kills the lightning, and flips `settings.froxelVol`
between captures. Sheets are in docs/shots/ (p2b_*-sheet*.png = the crops side by side, ×2–×4 nearest).

**3.1 Torch beam edge / apex** (p2b_tiers-apex-vol.png, p2b_tiers-apex-final.png — all five tiers, volumetrics-only and final, ×3 round the apex;
p2b_s-*.jpg the whole frames). Ultra / high: the froxel beam is the march's beam minus its last ~40 cm of wedge — the apex rounds off where the cone is
narrower than a froxel (7 cm emitter + 7° inner cone: the first two froxels hold the whole cone and the B-spline spreads them over their neighbours), and
the edge is a half-froxel (≈ 4 output px) softer along its length. Inside the beam the two agree to a few percent (tile means 15.3 vs 15.2, 19.9 vs 20.2).
Medium / low / verylow: the froxel beam is CLEANER than the march — at those tiers the march ran at quarter res (`volQuarter`) and TAAU's upscale showed
its 4 × 4 blocks along every beam edge; the froxel edge is the same soft line at every tier. What was tried and dropped for the apex: plain trilinear
across the screen (`froxelSharp`: creases at every froxel boundary along the edge — worse than soft), one centre ray per froxel instead of the 2 × 2
footprint (stair-steps where the ray threads / misses the narrow cone), more rows (180 at high: sharper apex, +0.5 ms, over budget in torture). The
blunt apex is the one visible price of the phase at the top tiers; from the follow camera it is a 6–10 px spot at the torch head.

**3.2 Lit smoke plume with a shadowed core** (p2b_h-sheet-plume.png; p2b_h-frox / h-march + -vol; and on the final build from 7 m, p2b_h2-close-sheet.png —
volumetrics-only and final, march left / froxels right). Identical billow for billow — by construction: the
density is still marched per pixel at 8 cm; only the light on each step comes from J. The shadowed core (torch A entering the plume from the right, the
far half dark) lands in the same place; the lit rim is a shade smoother (J is trilinear over 15 cm texels where the march shadow-tested every step) —
p2b_h-sheet-plume-vol.png ×3. The first cut, density in the froxels too, survives as the p2b_j-sheet-plume*.png pair for the record: a soft grey blob, the
sim thrown away.

**3.3 Temporal stability — static scene** (`__fxs.sdFrames`: 24 lossless frames of the two-torch rig at high, volumetrics-only, grain off; per-pixel sd
over time in 80 px tiles; p2b_sd10-sheet.png = mean | froxel sd × 40 | march sd × 40, torch A alone). The march has NO temporal noise but TAAU's jitter
(its blue-noise offsets are per pixel, fixed in time): lit-tile sd 0.01–0.08 / 255, 0.1–0.5 % relative. The froxels jitter xy + depth every frame and
lean on the 0.93 history: median lit tile 0.25 / 255 = 1.2 % relative; the beam's bright core beside the emitter 0.8 / 255 (65 / 255 mean: 1.2 %, p99
2.2); the apex tile 0.26 (1.4 %); and the worst RELATIVE spot is the thin lit sheet where torch B's beam skims on over a partition top (13–18 / 255 mean;
p2b_sdS-region.png): that sheet is thinner than a slice, one shadow ray a frame hits or misses it, and the history shows the variance two ways — as crawl,
and, through the neighbourhood clamp (a noisy froxel among dark neighbours is clamped DOWN more often than up), as a darker sheet. By strata for the
strongest light (`froxelTopRays`, the same 24 frames each; docs/shots/ab/p2b-sdS{1,2,3}-frox-*.png against p2b-sdSM-march-*.png):

| strata | sheet tiles: sd / 255 (relative) | sheet brightness vs the march | beam body vs the march | median lit tile |
|---|---|---|---|---|
| 1 (low, verylow) | 0.76 / 0.67 / 0.49 (6.0 / 4.9 / 3.5 %) | 72 / 91 / 84 % | 92 % | 1.5 % |
| 2 (high, medium) | 0.56 / 0.55 / 0.35 (3.7 / 3.4 / 2.4 %) | 86 / 110 / 89 % | 93 % | 1.2 % |
| 3 (ultra) | 0.43 / 0.43 / 0.33 (2.7 / 2.4 / 2.1 %) | 89 / 119 / 90 % | 93 % | 1.1 % |

(the middle sheet tile straddles the partition's shadow edge, which the two draw a froxel apart — hence > 100 %). Medium takes 2 strata for this (+1 ray
per froxel on its k 3: §2's medium rows were measured at 1 and re-taken below); low / verylow keep 1 — at their froxel size the sheet is a blur either way
and verylow has no headroom at 533 × 300. Under grain and TAAU none of the crawl is visible from the follow camera; in a still ×4 crop of the sheet you can
find it flipping frames. The 7 % the beam body reads under the march everywhere is the clamp's bias too (history 0 reads 100 % and boils); left as is.

**3.4 A moving torch — trailing** (p2b_trail-sheet4.png: torch A swept 36° in 12 frames = 180°/s, then held; the moving frame and 1 / 2 / 4 / 8 frames
after the stop, volumetrics-only). No ghost beam is left behind (the neighbourhood clamp across the screen empties a froxel the beam left within a
frame); the cost is the other way round — while sweeping, the beam's NEW position is built from ≤ 2 frames of samples, so it is mottled (single-sample
noise, ±15 % over a few froxels) and reads 95 % of its settled brightness in the moving frame, 96 / 97 / 98 / 98 % at +1 / 2 / 4 / 8 — settled to the eye
by the second frame. The first version clamped against the DEPTH neighbours too and a swept beam came out at 66 % (a beam is a slice or two thick: its
depth neighbours are dark air, so a dark history always passed) — that is why the box is the four neighbours across the screen only (§1). Under TAAU
the two histories compound to nothing visible: TAAU's own clamp follows the beam (p2b_taau-sheet-*.png, swept torch under jitter: no double edge, no lag
beyond the above).

**3.5 Muzzle flash** (p2b_flash-sheet.png; `__fxs.flash`: a 60-unit, 7 m, ttl 0.04 s flash in the rig = frames 0‥2 alive, 3‥4 gone). Frame energy
(whole-frame mean, volumetrics-only) froxel 29.07 / 12.16 / 3.91 / 3.35 / 3.35 vs march 29.22 / 12.26 / 3.91 / 3.39 / 3.39: the flash lights the haze
AT ONCE at the march's energy (−0.5 %) and leaves NOTHING (frames 3–4 = the base haze, identical) — because transients never enter the history: `injectJ`
draws them un-jittered into `froxelTransient` and `integrate` adds it (§1). The first version let them into the accumulated volume: 55 % on the flash
frame and an afterglow for six.

**3.6 Daylight — the breach's sun shafts and its stun plume** (p2b_sun-sheet-vol.png / p2b_sun-sheet.png: t = 3 s window shafts, t = 12 s, t = 20 s
the bang's plume; p2b_sun3-plume-sheet.png the plume ×1 after the J fix, static and 40 frames into the moving CLEAR shot). The window shafts (kind 2,
roof-tested per froxel: lit only under the ceiling, as the march's per-step test) match the march's in place and brightness (frame means 17.3 vs 17.1),
edges a froxel softer. The plume was the lane's last bug: lit by the sun through the window, J's ONE centre ray per texel made the sunlit slab a
terrace of whole slices through the smoke (p2b_sun-c-plume-sheet.png — six hard bands), and the checkerboard refresh hatched it further the moment the
camera moved (p2b_sun2-c-plume-sheet.png). Now: 4 depth strata for the sun's visibility, every texel every frame → p2b_sun3-plume-sheet.png, the same
plume as the march's (a faint two-level gradation is findable in the ×2 vol-only crop if you look for it; not in the composite).

**3.7 The rest.** Door-crack leak (p2b_door3-sheet-cam.png / -sliver.png / -gain.png: torch B inside the storage room 30 cm from its door, corridor lights off; shut, then 0.22 rad
ajar): shut = NOTHING on the corridor side in either (the shadow ray is per froxel-light from inside the lit chord; a 4 cm leaf is hit like any box);
ajar = the same sliver of lit haze through the crack, the froxels' a froxel wider and softer. Street lamp in rain (p2b_lot-sheet.png): the sodium cone
matches (frame means within 1 %), rain streaks identical (still per pixel), the cone's edge against the dark lot a touch softer. Particles inside a beam
take the froxel value at their own depth instead of the column's share. TAAU (§3.4): the froxel fetch uses the
jittered depth like every screen pass (worldFromDepth), and no beam edge crawls under jitter — TAAU's history sees a stable soft edge and holds it.

## 4. OFF = the march, proven

`?paused&quality=high&mute&nofroxel` on this branch against `?paused&quality=high&mute` on main at the merge base, both stepped identically (menu closed,
`__stage` pin, guards parked, `anim.phase` zeroed, smoke canister spawned then `smoke.params.frozen = true` at frame 240 so the field holds AND renders,
40 more frames), `__png` of the final composite and of debug view 5: **md5-identical** both pairs, twice — mid-lane (offid-*: 1765395a…93a6 / 8ce8f262…66ee) and again on
the final build against main at 16aac22 (offid2-main-1 = offid2-branch-off-1 = 0b65de22a9358dfcfda9eafbdc947266, offid2-main-2 = offid2-branch-off-2 =
50e8e8b40d384f44d4946b114c451d01; max channel difference 0 over 1777 × 1000) — lossless, kept out of the repo for their size; the noise floor between two
boots of the same build is also 0. With the flag down no froxel kernel is dispatched, the 2D
pass compiles the same nine helpers from vol_common.wgsl it used to hold inline, composite / particles take the `else` of one uniform branch, and
`probes.ts perf` (frame-layout, flags, cards) passes. Guards' smoke sight-lines: untouched — `smoke.sightBlocked` reads the CPU-side density bricks,
nothing in this lane is on that path (soak + tour green, below).

## 5. Gates

typecheck clean · `tools/qa/gate.sh perf frame-layout weather glass breach player particles` ALL PASS · `quality-plan.ts` (auto's picks = main's after
P1 for every synthetic machine: M4 Max → high ×0.77, M1-class HiDPI → low ×0.6, iGPU → verylow ×0.5; the froxel kernel sits in the fixed column) · `tour.ts --runs 2` PASS (13 stops × 2, 0 hit
flashes) · `soak.ts --seeds 1,2 --minutes 6` 0 violations · `bun run build` OK · GPU validation: error scopes round preset hops ultra→verylow→ultra
(the grid re-made 4×), a window resize mid-frame, `volQuarter` on/off, weather on/off + a lightning strike, the breach start→abort (daylight in and out),
`?nofroxel`, `?notaau` — no validation errors, no uncaptured errors (`__errs` empty after each). Re-run after the SECOND `git merge main` (Phase 3, the shared
denoiser, b56d5ca; conflicts in main.ts hooks, passes.ts imports, quality.ts Preset / rows / REF / presetCost — every side's fields kept: dn + froxel,
dnShadowFactor / dnGiFactor + vol2D / froxelHigh): typecheck, the same gate.sh families, tour × 2, soak 1,2 × 6 min, quality-plan (M4 Max → high ×0.77, M1-class
→ low ×0.6), build — all green; error scopes round the five presets each with smoke + a flash, denoiser legacy ↔ v3, froxels off ↔ on, TAAU off ↔ on, the
breach in / out, a lightning strike — clean; volFroxel 0.73 ms at high on the two-torch rig (as before the merge: the denoiser does not touch this pass).
The first merge (TAAU): conflicts in
engine.ts / passes.ts / particles.ts / volumetrics.wgsl / quality.ts resolved keeping both sides (volReact @binding 3, smokeJ @4; encodeDraw takes
reactView + froxelView; Preset carries taau + froxel; calibration's fixed-pass regex has both 'taau' and 'volFroxel').

## 6. What remains

- **The apex.** A beam's last 40 cm of wedge at the torch head is rounder than the march drew it (§3.1) at ultra / high. More rows fix it linearly and
  cost quadratically; the real fix is a per-pixel analytic term for the first metre of each SPOT's cone (closed form, no shadow ray — the emitter's own
  froxel is never occluded) blended over the froxel value near the apex. Half a day; not started.
- **Sweep mottling.** A torch swept fast is built from ≤ 2 frames of samples where it lands (§3.4): ±15 % mottle for a frame or two. More sub-rays while
  `moved` is high (the temporal kernel knows) would trade 0.1 ms for it. Not started.
- **J under a moving camera** now costs every texel every frame (§3.6). A ping-pong J with the haze's reprojection would bring the checkerboard's −30 %
  back without the hatching (+4 MB at high). Only matters in torture (0.3–0.5 ms at high); not started.
- `QRF_MARKS`-style TODO: `Engine.FROXEL_CONTENT_TOP` (8 m: nothing visible scatters above the lamp heads) is a constant of THIS level; a level with a
  tall atrium wants it from LevelData.
- The brief's 'k strongest per froxel' is k per FROXEL by unshadowed in-scatter after the cluster cull; a per-cluster pre-sort (k+2 candidates per cluster,
  froxels only re-rank those) would halve `inject` at ultra. Not needed inside the budgets, noted for P4.
