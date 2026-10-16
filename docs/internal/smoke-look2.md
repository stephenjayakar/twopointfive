# Smoke look, take 2 — the red team, the battery, the preference test (2026-08-12 afternoon)

**In ten lines.** The maintainer, after a day of smoke changes: "still not in love with it, still quite blocky and some weird boundary effects. the blurring also
does feel a bit funky … set up a scenario with exactly the setting we've been looking at and iterate on it yourself … record a bunch of examples and have a small
web app where you show me pairs animated side by side … a few settings so we're not overfitting to the vending machine one … gently orbiting … read through
all the systems that are interacting here and red team what's going on." This notebook is that: §1 the pipeline a smoke pixel goes through and every place a
block, a boundary or a temporal seam can come from (with what proves each), §2 the four reproducible scenes + the recorder (flipbooks off the GPU, deterministic,
pane-hidden-safe), §3 the blind-pairs page and the fit, §4 the battery's variants (knobs AND candidate fixes), §5 results as they come. First finding before any
recording: the diffusion weight taken as the MAX of four half-res texels was piecewise-constant and, multiplied by a transmittance that dithers per frame (the
march's rotated start offset), stippled the plume's edge in a checker over any bright thing behind it (docs/shots/sbx_base_front_x2 vs sbx_wbilin_front_x2) —
the default is a bilinear weight now; the max survives as variant `wmax`.

Tools: `tools/qa/smoke-battery.js` (`__sb`), `tools/qa/smoke-pref.html` (served by the shot sink at http://localhost:5174/clips/pref.html), the sink's
`/clipframe`, `/clip`, `/pref`, `GET /clips/…` (tools/shot-server.ts). Clips: docs/shots/clips/sb_<scene>__<variant>/f0000.jpg… + meta.json (gitignored with shots).

## 1. Red team: what a smoke pixel goes through, and where each artefact can come from

Path at high (the shipped tier): **solver** (64³ domain, 5.5 cm canister voxel; density × 1.6 at read) → **density read** `smokeDensityAt/In` (trilinear atlas
fetch, × the domain EDGE FADE over the outer 11 %) → **the classic march** `volumetrics.wgsl` at HALF the internal size (`frame.lossyCfg.y` = 2): each half-res
texel marches ONE full-res pixel of its 2×2 block, alternating by texel parity; per-domain stretches at 1.5-voxel (8.25 cm) steps from a start offset
`jitterS` = a per-texel dither ROTATED by the golden ratio every frame; K = 4 lights per step with shadow ray + 4-tap self-shadow refreshed every 2nd step; the
single-scattering integral + the MS octave (√T, half self-shadow); breaks at T < 0.03; writes (in-scatter rgb, T) to `vol` and (rain react, **T_smoke**) to
`volReact` → **composite** (`cs`, per OUTPUT pixel under sharp direct): `upsampleVol` = 3×3 joint-bilateral over the half-res texels, Gaussian in space ×
exp(−|Δz| / 0.05z) in the DEPTH of the pixel each texel marched → `color × T + inscatter` (everything, emissive included) → **GBAA** → **TAAU 1 : 1 resolve**
(smoke has NO motion vector: its history is last frame's plume reprojected as if painted on the surface behind it, then clamped to this frame's 3×3
neighbourhood; reactive inputs = particles + rain luminance, NOT smoke) → **bloom** → **post**: the diffusion = mix toward the frame's Gaussian quarter / eighth
copies by w(τ) with τ from `volReact.g` sampled at the output pixel.

Where blocks / boundaries / seams can come from — most suspicious first, and the variant or still that tests each:

| # | suspect | mechanism | shows as | test |
|---|---|---|---|---|
| A | **diffusion weight = max of 4 half-res texels** | piecewise-constant w at half-res texel size × a T that dithers per frame (jitterS) | a checker / staircase along the plume's edge over anything bright behind it; crawls in motion | **CONFIRMED** on the first still (sbx_base vs sbx_wbilin); default → bilinear; `wmax` keeps it for the record |
| B | **depth-guided upsample of a SMOKE term** | `upsampleVol` weights texels by the depth of the surface BEHIND them; a plume in front of the machine's edge / a desk edge / Sam gets its soft edge carved along that depth edge, and texels across the edge are dropped → fewer texels → coarser | 'weird boundary effects' exactly along silhouettes seen through smoke; blockier smoke where the background is busy | `relax` (depth term let go where the centre texel's T < ½) |
| C | **half-res march, hard silhouette at 1.6×** | at 1.6× the plume goes from T≈1 to T≈0 within a couple of 8 cm steps → its silhouette and internal folds become step-quantised edges, marched at half res and bilinearly upsampled | 2-internal-px (≈2.6 output px) blocks along dense edges; worse in the orbit | `volfull` (÷1), `dens13` / `dens10` |
| D | **TAAU on un-reprojectable smoke** | history = the plume as if stuck to the surface behind; under camera motion (the orbit) it lags and is clamped → smeared / doubled edges, then snaps; the clamp box is 3×3 of the CURRENT frame so bright fronts behind thin smoke pump the clamp | ghosted / lagging plume edges while orbiting; flat interior (temporal average of moving billows) | `taareact` (reactive ∝ 1 − T_smoke, 0.6) |
| E | **jitterS start-offset dither** | the rotated start offset moves every step's sample point per frame: T and in-scatter carry per-texel temporal noise the resolve is meant to average — but the diffusion (post, after the resolve) reads the RAW T of this frame | boundary shimmer of the blurred region frame to frame (the 'funky' blur?) | compare `nodiff` vs `base` in motion; fix = weight from a temporally stable T (resolve it, or reuse last frame's) — variant to add if E ranks |
| F | **the diffusion itself** | screen-space, after the fact: blurs the plume's own in-scatter with what is behind it; the mix boundary follows τ, not any physical scattering geometry; the eighth-res level's blur radius (~10 px) is a constant, not ∝ distance behind the smoke | 'can't explain' funkiness; halos where τ changes fast | `nodiff` / `diff05` — if `nodiff` wins pairs, the feature goes |
| G | **MS octave energy** | adds light without taking it from the single lobe: a plume can read brighter / hazier than its density says | washed-out core under the sodium lamp (S3) | `ms0` / `ms15` |
| H | **edge fade × 1.6** | the fade band (38 cm) at 1.6× is a visible density ramp where a plume presses on its box | a straight soft ramp on big plumes | watch S2 (the doorway plume runs along the box) |
| I | **K 4 / every 2 vs every 1** | a light's shadow answer reused one step: an 8 cm offset of shadow edges inside the plume on alternate steps | faint double edges in torch shafts (S2) | `every1` |
| J | **froxel vs classic** | the tier question itself | softer beams, flatter plume vs cost | `froxel` |
| K | **codec / capture** | none: flipbook JPEGs at q 0.9 off the GPU readback, both sides of a pair stepped on one clock | — | (design) |

Not suspects (checked): the solver and emission (identical to Aug 9), the composite's `color × T + inscatter` order (emissive is attenuated), the sharp
path's texel mapping (`pin` / `gpx` consistent), bloom (unthresholded, energy-conserving; the diffusion no longer reads it).

## 2. The scenes and the recorder

`__sb.SCENES`: **S1 vending** (dark break room as it boots, the two fronts lit, a can thrown to rest 1.5 m in front), **S2 doorway + torches** (both rooms dark,
can on the west sill, two parked torches into the doorway — the tour's picture), **S3 sodium lamp, rain** (can 1.5 m off the east lamp's pole, storm 0.6 / rain
0.5 seeded), **S4 corridor exit sign** (camera along the west corridor at the sign, plume mid-corridor). Every scene: seed → `restartEncounter` (civilians off,
AI off, guards parked or pinned with torches) → pin → the can as the real thrown ITEM → 3.5 s of growth → a 5 s clip at 30 sim-fps under a 12–14° eased ORBIT.
Framing stills: docs/shots/sb_S1_framing3 · sb_S2_framing2 · sb_S3_framing3 · sb_S4_framing (approved by the maintainer 08-12).

Recorder: per frame `__runFrames(1, 1/30)` + one offscreen render of the same state → `engine.readbackFrame` → OffscreenCanvas JPEG q 0.9 → `POST /clipframe`.
Deterministic frame for frame whatever the render speed, works with the pane hidden (MediaRecorder recorded nothing off a hidden pane — the canvas is not
composited), ~1 min per 150-frame clip. Cross-build anchor: the same file served into the Aug-9 worktree's page (:5256) records `build: 'aug9'` clips.

## 3. The blind-pairs page and the fit

`pref.html?judge=<name>`: pairs WITHIN a scene, every variant against every other once, order and left/right from a seeded shuffle (a reload resumes the same
deck), both flipbooks on one frame clock, keys 1 / 2 / = / space / ← → / r (reveal after choosing) / s (skip), an optional 'why'; each choice POSTed as a JSON line
to docs/perf/smoke-pref.jsonl. Fit: Bradley–Terry per scene and pooled (ties = half a win each way), 200 bootstrap resamples for the intervals; report = ranking +
P(beats base) per variant + the 'why' lines grouped by loser.

## 4. Battery 1 — variants

Knobs: `base` · `dens10` · `dens13` · `ms0` · `ms15` · `nodiff` · `diff05` · `froxel` · `every1` · `d13ms12nd`. Candidate fixes (all default OFF but the bilinear
weight): `wmax` (the old weight, for the record) · `relax` (B) · `taareact` (D) · `volfull` (C) · `fixpack` (relax + taareact + volfull). Anchor: `aug9` per scene.
15 clips × 4 scenes on main + 4 anchors ≈ 64 clips ≈ 70 min of recording; 105 within-scene pairs per scene is too many to judge — the page takes `?variants=` to
cut the deck (first pass: base, aug9, nodiff, dens13, ms0, relax, taareact, volfull, fixpack = 36 pairs a scene; the rest on demand).

## 5. Results

**S1 (vending), the maintainer, 28 pairs = the full round robin, 08-12 evening.** Bradley–Terry strengths (base = 0): dens13 +7.0 (6/7) · fixpack +7.0
(6/7) · taareact +6.0 (5/7) · relax +4.9 (4/7) · ms0 +4.9 (4/7) · base 0 (2/7) · volfull −4.6 (1/7) · nodiff −11.5 (0/7). Almost no cycles. Reading: every
candidate fix beat base (D and B are real); density 1.3 beat 1.6 decisively; multiple scattering OFF beat on; the diffusion STAYS (nodiff lost every pair —
the concept is right, the artefacts were the problem); full-res volumetrics lost on its own (its cost buys nothing the eye wants). Follow-ups recorded for all
four scenes: `combo` (density 1.3 · MS 0 · relax · taareact · vol ÷2 · diffusion on), `combo_ms05`, `dens10`. S2–S4 and the follow-ups await judging (deferred by
the maintainer 08-13); the anchor decks S1r–S4r (Aug-9 vs main on the pre-markings office: base / nodiff / combo) and the glass deck G1 (glassbreak on vs off) are
recorded too. The page is ACTIVE since 08-13 (online BT picks the most informative pair; 2.5-s middle loops).

**08-14 — SHIPPED without further judging** (the maintainer: "is there enough signal to get something i'd be happy shipping? maybe even reverting to some older
stuff"): the defaults are now `combo` = density 1.3 · MS 0 · upsample relax · TAAU smoke-reactive 0.6 · diffusion 1.0 (bilinear weight, Gaussian levels) · classic
march at high / ultra · vol ÷2. Why this and not a full revert: every one of its parts beat the 08-12 defaults pairwise in S1's full round robin, three of them are
artefact fixes rather than taste (bilinear weight, relax, taareact), and the two taste moves both go TOWARD the old renderer (density 1.6 → 1.3 → the old 1.0;
the MS octave, added 08-12, off again) — while the two things the maintainer explicitly preferred about the new path stay (the classic per-pixel march, and the
diffusion: `nodiff` lost all seven of its pairs). Gun smoke and dust render at their own 1.0 (fxDensityScale). Everything remains a Tab row; the recorded decks
(S1–S4, S1r–S4r, G1) stay on the sink for whenever there is time — `combo` is in them, so a later session can confirm or overturn this directly.
