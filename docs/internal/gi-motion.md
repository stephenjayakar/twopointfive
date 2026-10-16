# GI in motion — what the ‘noise in motion’ actually is, and every lever measured (2026-08-10/11, lane `v3/gi-motion`)

Brief (the lead's, after the image-quality program merged C3j at every tier and the maintainer said “looks great but still a bit too much noise in
motion”; their frame-by-frame read of the recording put it on the INDIRECT term re-converging under camera / actor motion): reproduce the two
shots, MEASURE the flow, prove attribution to the GI (direct-only as the control), then build (A) a headroom-aware climb of the quality ladder,
(B) the diffuse GI denoised at the internal resolution, (C) young-history adaptive gather rays, (D) diffuse-client follow-ups — everything behind
settings whose OFF paths are main byte for byte — and report numbers, crops, cost, a page (docs/review/gi-motion.html — published at (a private page)). Machine / method as
every renderer note: M4 Max, Chrome (the Browser pane) / Metal, dpr 2, this worktree served on :5236 (shot sink :5237), main @ 7b76e9e beside
it on :5238 for the identity hashes and the cross-build cost check; `?paused&quality=<tier>&mute`; a BACKGROUND tab of the shared pane pinned
to 1280×720 CSS at dpr 2 (high = 1368×770 internal → 1777×1000 output) or to 1229×1200 for the maintainer's own 1024×1000 output ('hm').
The maintainer was playing on the same GPU for parts of both evenings and other lanes rendered throughout: every COST number is from
serialized, interleaved takes and §6 says which pairs saw contention; the flow numbers do not depend on timing.

## 0. Outcome in one paragraph

On both reproduced shots the GI's share of the composite's temporal flow under motion is ≈ 0: removing the GI term outright (indirect
scale 0, everything else identical) leaves the flow in every dark tile where it was (0–1 % of the variance in the five clean tiles; 8 % on the panel-lit
floor). What flows is the DIRECT chain under camera motion — ReSTIR's temporal reservoir reuse under a moving
camera (switching the estimator to the old leader / tail path takes 33–56 % of the flow out of the dark tiles and turns 2–7-px blotches into
½-px grain) plus the resolve's motion terms (motion α 0.4, RCAS motion sharpen 0.3: another 10–20 %); the two together land tile for tile
on the OLD renderer's numbers, i.e. that pair IS the whole of ‘v3 is noisier in motion than the old renderer’ here, while at rest v3 is 2–40×
calmer than either. On the static breach shot the wall's slow swim is ReSTIR's crawl too (GI 0 %) and there ReSTIR is the better estimator
(the leader path swims 2× more under one sun + sky). B, C, D were built, validate clean, are identity-proven off and cost nothing off — and
change no number past the take-to-take spread on these shots (they act on a term that is not the one moving); A works as a ladder feature and
buys nothing for the complaint (resolution is not the lever). What does move it inside this lane's remit: ReSTIR's spatial reuse everywhere
+ the extra penumbra ray, and the resolve's motion terms halved — the ‘motion-calm rows’ (quality.ts `MOTION_CALM`, opt-in: `?motioncalm`,
Tab ▸ Frame, `__gimo.calm`): −14 … −24 % of the pan flow per clean tile at high AND the still tiles −23 … −51 % (spatial reuse halves ReSTIR's static
crawl in these tiles), the daylight wall +7 %, +0.79 ms union at high. Proposed for the maintainer's eye (contact-shadow softness with
spatial reuse — image-quality.md's D2 — and motion softness with α 0.25 — tjank.md's reason for 0.4), not shipped as a default. The rest —
reservoir reprojection that does not scramble lineages under sub-pixel camera motion — is restir.wgsl, another lane's file; §7 words it.

## 1. The instrument (`tools/qa/gi-motion.js` → `window.__gim`; tables `tools/qa/gim-report.py`; page `tools/qa/gim-page.py` + `gim-prose.json`)

Both scenes boot `?paused` and, at the start of EVERY take, `__resetClock()` + a seeded `Math.random` + every `anim.phase` zeroed (a take
renders the same jitter / dice sequence whatever ran before it in the page), guards parked dark, the storm off, the film grain off (a per-frame
white noise of its own; it turned out to add < 3 % to these numbers — the first evening's grain-on takes are kept under docs/perf/gim-grain/
to RANK knobs, §2b of the page), and the fluorescent tubes held steady: `lighting.ts` drops a flickering tube to 15 % at 14 Hz in OCCASIONAL
bursts (sin 3.1t + 0.6 sin 7.3t > 1.15), and whichever early takes overlapped a burst measured the strobe's bounce pumping the whole cubicle
floor — whole-tile boil ≈ 16 levels, ‘33 % blotch flow’, and for an hour it looked like variant C exploding under the pan. It is an authored
lighting change (the recording's item (c)), not noise; `steadyTubes()` is now part of every take (and undone when it ends).

- **S1 ‘moonlit cubicles pan’**: night, Sam VISIBLE and holstered, walking east at his walking pace (puppet goal (26, 0, 22.65) from (14.1,
  0, 22.65)) under the real follow camera (yaw 160°, pitch 55°, dist 21 → the camera pans ≈ 2.44 output px / frame at 1777 wide) across
  the window-lit floor by the north wall: 40 still frames, 60 walking frames of settle, 24 captured. Tiles (world rectangles ≈ 1 output px
  per sample, placed off a 5-cm luminance map of the settled frame): `unlit` (the floor east of the window light, L ≈ 32 — 85 % of it DIRECT
  light from a dozen distant panels, 15 % bounce: “unlit” to the eye, not to the estimator), `unlitAisle`, `lightEdge` (the boundary of the window light on the dark floor — a penumbra), `stripe` /
  `moonStripe` (placed inside the moonlit bands — occluded by the desk cluster for part of the pan, so out of every table), `litFloor` (panel-lit, L 132), `sillWall`. `s1still` = the same tiles, camera pinned, Sam out.
- **S2 ‘daylight stack’**: `__breach.start()` from a fresh page state (cast seeded, phases zeroed) stepped 496 frames to the Stack shot —
  Blue One walking his last metre along the break-room wall by the side door, static camera, sun + sky — then 24 captured. Tiles `wall` /
  `wallHigh` behind and beside him, `door`. His silhouette is masked PER FRAME from the g-buffer's id target (a small compute readback:
  character bit / owner byte → 4×4-px blocks dilated 8 px; coverage of `wall` 0.475), so the wall his soft occlusion darkens IS measured.
- Per take: 24 consecutive OUTPUT frames read back losslessly (`engine.readbackFrame`: every scripted step renders the offscreen target once);
  each tile re-projected every frame through that frame's own view-projection (sub-pixel, bilinear luma) — a point of floor is followed
  through the pan. Metrics per tile: **flow** = temporal sd of luma per world sample, mean over the tile, in 8-bit levels and ÷ the tile
  mean; `sdLow` = the same of a 6-frame running mean; `|Δ|` = mean frame-to-frame |difference| (≈ 1.13 × sd for white noise, ≪ sd for a
  slow crawl); **boil** = mean of (max − min); **blotch size** = autocorrelation half-width of each frame's residual along the tile's rows,
  output px; coverage. Views: 0 = the composite; **‘D’ = the composite with `indirectScale` 0** — the GI term removed with EVERYTHING else
  (resolve, sharp direct, grain state) identical, so the GI's marginal share = 1 − var_D / var_0; 4 / 3 = the indirect-only / direct-only
  debug views (the terms naked — no resolve, no sharp direct — attribution of the terms, not of the picture). Crops ×3 nearest of frames
  11–13 round every tile + a boil map (max − min, ×8) + one annotated frame; `run(tag, {variant, extra, views, scenes})` fire-and-forget →
  `docs/perf/gim-<tag>.json` (saved after every sequence: the shared pane was closed under this lane twice and my tab hijacked once — the
  tab has to stay in the background), `runs([...])` queues them in one boot, `costCurve()` / `climbSim()` for §6, `apply()` throws on an
  unknown settings key (a mistyped variant name silently measuring main cost the iq lane an evening).
- Reproducibility: repeats of main in one page agree to ±2 % (unlit), ±3 % (litFloor, lightEdge); nothing under
  those is a finding. Grain on vs off moved main by ≤ 3 %.

## 2. Attribution (high, 1368×770 → 1777×1000; levels of 8-bit output luma; pan = 2.44 px / frame)

| S1 pan, composite | unlit (L 33) | unlitAisle (30) | lightEdge (73) | sillWall (88) | litFloor (133) | S2 wall (85) | S2 door (58) |
|---|---|---|---|---|---|---|---|
| main — flow (blotch px) | 0.439 (2.0) | 0.531 (1.1) | 1.589 (7.0) | 0.318 (0.6) | 0.582 (2.6) | 0.905 (12: whole-tile) | 0.988 |
| main WITHOUT the GI term (‘D’) | 0.466 | 0.528 | 1.673 | 0.327 | 0.557 | 0.952 | 1.125 |
| → GI's share of the variance | 0 % | 1 % | 0 % | 0 % | 8 % | 0 % | 0 % |
| GI term naked (view 4; L ≈ 30) | 0.271 (½ px) | 0.294 | 0.310 | 0.385 | 0.380 | 0.358 | 0.188 |
| direct term naked (view 3; L 70–200) | 1.129 (3.5 px) | 0.842 | 3.121 | 0.336 | 0.736 | 1.028 | 1.620 |
| main STILL (same tiles, camera pinned) | 0.191 | 0.126 | 0.260 | 0.049 | 0.157 | — | — |
| ReSTIR off (leader / tail), pan | 0.292 (½ px) | 0.411 | 0.704 | 0.303 | 0.296 | 1.841 | 1.488 |
| resolve's motion terms off, pan | 0.355 | 0.473 | 1.373 | 0.273 | 0.538 | 0.904 | 0.988 |
| shadow client's occluder cue off | 0.441 | 0.525 | — | 0.317 | 0.584 | **0.674** | 0.810 |
| both off = ‘floor’ | **0.235** | 0.379 | 0.531 | 0.261 | 0.306 | 1.840 | 1.488 |
| the OLD renderer (pre-v3, native rows) | **0.244** (0.6) | 0.401 | 0.749 | 0.287 | 0.270 | 2.233 | 1.665 |
| floor STILL / old STILL / ReSTIR-off STILL | 0.005 / 0.089 / 0.005 | 0.014 / 0.105 / 0.013 | 0.095 / 0.346 / 0.095 | 0.011 / 0.127 / 0.007 | 0.018 / 0.128 / 0.017 | — | — |

(The two tiles placed inside the moonlit bands — `stripe`, `moonStripe` — turned out to be occluded by the desk cluster's partition for part
of the pan (the sampler follows the floor point with no depth test and read the partition's edge there); their numbers are in the JSON and
out of every table. `lightEdge` — the boundary of the window light on the dark floor, a penumbra — is the tile that stands in for ‘the
stripes’: the largest relative flow of all, 2.2 %.)

Reading it. (i) With the GI term gone the composite's flow in the dark tiles does not drop (it rises a hair — the picture is darker); only the
panel-lit floor (8 %) carries a measurable GI part; the light's edge 0 %, the breach wall 0 %. The GI term naked does flow (0.27–0.39
levels of ~30, ½-px = per-pixel grain the resolve then averages) but it is a term worth 4–9 levels of these tiles' 30–90, and the direct term
naked flows 3–4× as much at 3–4-px blotch size in the same tiles. (ii) ReSTIR off is the single biggest mover under the pan (unlit −33 %,
lightEdge −56 %, litFloor −49 %; blotch size 2–7 → ½–1 px); the resolve's motion terms off −19 / −14 / −7 %; both off = the old renderer, tile
for tile (0.235 vs 0.244 unlit; 0.531 vs 0.749 at the light's edge, where old was worse). (iii) STILL: v3's ReSTIR crawls 0.19 levels in ‘unlit’ where the
leader path under the same denoiser + resolve sits at 0.005 — the leader path's error is white per frame and the shadow client + TAAU eat it
whole; ReSTIR's is temporally persistent by construction (M-capped reservoirs) and 3–4-px wide after the shadow à-trous: a frozen faint
pattern at rest (the documented ‘slow crawl’). Under a pan the integer-pixel reservoir reprojection hands ~44 % of pixels a neighbour's
reservoir every frame (2.44 px / frame), lineages merge and split, and the frozen pattern becomes one that changes frame to frame at every
world point — flow, at blotch scale, strongest where a dozen dim panels compete for two reservoir slots (‘unlit’). That is why the lead's read
(“blotchy 3–4 px, 2.2–2.7× the still level → gather-texel-sized GI”) pointed at the GI and was not it: the direct chain makes blotches that
size too. (iv) The daylight wall inverts it: one sun + sky, static camera — ReSTIR holds the sun in its reservoirs and the leader path swims 2×
more (S2 1.84 vs 0.905; the old renderer 2.23); what swims there in main is ReSTIR's crawl plus the shadow client's occluder cue shortening the
history round the walking man (−25 % without the cue, which exists for the trailing edge of a walking man's shadow — the shadow lane's trade).

## 3. What was built (all behind settings; OFF = main byte for byte — `__sh.identityHash` v3 de204b4e / v1 fcd5b4d3 = main's at high, and
= main's at medium; and OFF costs nothing: gather 1.835 / temporal 0.262 / direct 2.49 / softblur 1.18 ms on both trees, same view, §6)

**(A) the headroom-aware climb** (`ui/quality.ts` `CLIMB` / `sample(dt, gpuUnionMs)`, `settings.ladderClimb` default ON, `capClimb` default
off; main.ts hands `engine.timer.unionMs()` minus the render passes — 0 without timestamp queries, NaN when no new readback resolved since
the last sample): over 1-s windows in which the rate held (≥ 57 fps — under any display's refresh; a 60 Hz panel's rAF never averages better
than 60.0) AND the compute union stayed under 60 % of a 60-fps budget for 3 windows running, one rung up ≥ 4 s apart: the render scale by
0.05 past the tier's start up to **0.95** (not 1.0: at 1.0 the internal size equals the output size, engine.resize has nothing to decouple and
sharp direct + its jitter + GBAA switch off — the ‘1.0 + TAA’ look image-quality.md rejected), then the lossy divisors (gather ⅓ → ½ then
volumetrics ¼ → ½, union under 65 %), then — capClimb only — the output cap in 100-row steps toward the window's device rows. Back-off: the
union over 80 % undoes the newest rung at once; the rate under 55 for two windows undoes the newest once if the dip began within a climb gap
of the last climb, else (or if it outlives that) every rung, and the plain cut follows a cooldown later only if still slow; failed rungs held
60 s doubling per repeat; `?quality=` holds the climb off for the visit (harness pages), a menu pin keeps it. **The ladder's older bug, found in
review and fixed here:** `cruisingFps 62` made ‘auto ↑ a preset’ unreachable on a 60 Hz display, so a machine calibrated low during a loaded
boot or stepped down by a transient stayed down all session; now the rate gate is 57 and, with timings, the union is PRICED AT THE NEXT PRESET
by the cost model (`Quality.hopRatio`: `presetCost` of the current preset as rendered — live scale, divisors, cap, sharp — vs the next at its
start; medium → high ≈ ×1.5, low → medium ≈ ×2.1 on a 720-row window, never a flat ×2) against 0.9 × the plan budget; a hop that comes
straight back down is held off 60 s doubling; a window without a fresh readback withholds only the union's verdict. `tools/qa/quality-plan.ts`
section (E) drives all of it through `Quality.simulate` / a closed loop that re-derives the union from what is rendered: 39 PASS incl. ‘60.0 Hz
+ 9 ms union at high climbs 0.77 → 0.95 → gather ½’, ‘auto at medium at 60.0 fps ∪ 6 goes up; ∪ 9.5 stays and climbs its scale; low ∪ 9.5
stays’, ‘hop → starve → held → re-tried a minute on’, back-off order, no oscillation inside the hold, capClimb steps.

**(B) the diffuse GI denoised at the internal resolution** (`settings.giFullRes`, `giFullIters` 4; `Preset.dn.giFull` places it — no tier
does): denoise.wgsl `giUpsample` (composite's joint-bilateral 3×3 — depth-plane + normal guides at each texel's own sample pixel — raw ⅓-res
gather → an internal-size texture) → `giTemporalF` (the diffuse temporal step at internal res: value history, moments, fast history all
internal-size, reprojection error an internal pixel; the clamp / firefly / young-variance STATISTICS still from the 5×5 RAW gather texels
round the pixel's own — `radApronRaw` — because a box of 5 interpolated pixels is narrower than the estimator's correlation length and clamps
the long history down to the fast one: the first cut boiled MORE) → `radAtrous` ×4 at strides {1,2,4,8} × the gather divisor → composite reads
it 1 : 1 (`upsampleIndirect`'s size test; the SHARP composite takes a guided bilinear of the 4 internal texels). passes.ts: 8 pooled rgba16f
internal-size textures made on FIRST use, released after 600 frames off, resampled on resize; the two pipelines + stride variants compiled
async (`denoise.ts prepareFull`; the gather-grid chain carries the frame until every variant of the CURRENT stride set exists — a divisor flip
under the climb compiles nothing inside a frame). Memory + 64 MB at high, ~133 at ultra 0.9. Cost +0.79 ms temporal, +0.85 union at high.

**(C) young-history gather rays** (`settings.giYoungRays` k, `giYoungCap` 0.08, `giYoungLen` 4 = min(len, dnGiCap); `Preset.dn.giYoungK` —
no tier sets it): fgather.wgsl `main` — a texel whose point had no usable diffuse history last frame (behind / off last frame's screen, another
surface by the stored view depth, or a history the denoiser calls young: `youngTexel`, two texture loads of last frame's moments / history at
the reprojected texel — the gather-grid pair, or the internal-res pair while B runs, told apart by size) traces k× the cosine rays this frame.
Decided per 8×8 TILE (workgroup vote; ONE atomic per tile on a 16-B counter the CPU zeroes each frame; the tile's young lanes fire iff its first
slot is under the cap — a SIMD group pays for its slowest lane anyway and arrival order no longer decides who wins past the cap); the base ray
loop is the untouched `for k < RAYS` text and program, the extra rays go through `youngRay()` and the sum is re-normalised to the true count;
k = 0 across a camera cut and every wholesale history restart (restartHistories, the denoiser switch, a fresh target set, the B ↔ gather-grid
switch — `passes.youngHold` folded into the engine's `giCutHold`), when every texel is young. `frame.giCfg` @752 (k, cap in texels, young
length) → `FRAME_BYTES` 768 (frame-layout ALL PASS; `FrameParams.giCfg` optional so older probes / fixtures still write a frame). Young
counts in play: 0 at rest, 1–2 % of the grid under the S1 pan, bounded 8 %. Cost: **+0.52 ms gather at high AT REST** with k = 3 (the test +
three barriers before the ray loop keep the scheduler from overlapping the tile's memory latency with ray work — not the extra rays, of which
there are none at rest); 0 with k ≤ 1 (the block is skipped whole; measured = main).

**(D)** `settings.dnGiClampCut` (the reflection chain's rule for the bounce: a valid pixel whose long history the clamp had to DRAG keeps a
shorter one, restarting as young past most of a box) and `dnGiYoungWiden` (the per-pixel-spec young allowance on the diffuse à-trous σ);
`DnParams` 112 → 128 B (`gi3`, zeroed in the reflection chain's block), both 0 = the client as it was. Neither moved a composite number here.

**denoise.wgsl lines touched, for the merge** (diff vs 7b76e9e; nothing in shPack / shTemporal / shAtrous or the specular entry points):
`struct DnParams` — the `gi2.w` comment (now: the raw divisor in the internal-res block) and `gi3: vec4f` APPENDED (128 B; denoise.ts sizes
all three uniform buffers from `paramData.byteLength`); `radTemporalCore(gid, haveFastTex, cur4, sc)` — signature (dropped `lid`, takes the
centre value + the stats cell), `od` from `rtHist` not `rtCur`, `stats5(sc)`, and ONE new statement in the diffuse clamp branch
(`if (!SPEC && dn.gi3.x > 0.0) {…}`); `giTemporal` / `specTemporal` call sites pass `wgA[…], lp`; NEW after giTemporal: bindings `rtCurF`
@74 / `upOut` @84, `radApronRaw`, `giTemporalF`, `giUpsample`; ONE new statement in `radAtrous` after the pp young line (`if (!SPEC &&
dn.gi3.y > 0.0) {…}`). Other files: fgather.wgsl (`main`: the tile-vote block + the extra-ray line, `youngTexel`, `youngRay`, bindings 14–16 +
`struct GiYoung`), denoise.ts (paramsFull / lGiUp / lGiTempF / prepareFull / encodeGiUpsample / encodeRadiance's `full` / gi3), passes.ts (the
giF set, setGiFull / reallocGiFull / giFullLive / fullStrides, ensureFgBG + lFG bindings 14–16, youngBuf / youngOn / youngHold /
readYoungCount, the temporal branch, compIndView), composite.wgsl (`upsampleIndirect`'s 1 : 1 branch), engine.ts (settings, giCfg + the cut
hold, setGiFull, dnWas), frame.ts + common.wgsl (`giCfg`), quality.ts (Dn.giFull / giYoungK, CLIMB, LADDER cruising / hop, sample,
hopRatio, simulate, MOTION_CALM), main.ts (`__gimo`, `?nogim`, `?motioncalm`, unionMs / NaN into sample), bindings.ts (Indirect light /
Frame / Denoiser rows), tools/qa (gi-motion.js, gim-report.py, gim-page.py, gim-prose.json, quality-plan.ts (E), frame-layout.ts,
materials-probes.ts).

## 4. Numbers (grain off; flow in levels; green in the page = −15 % vs main, red = +15 %)

### 4.1 High — every variant, S1 pan · S1 still · S2

| variant | unlit | unlitAisle | lightEdge | sillWall | litFloor | still unlit / lightEdge / litFloor | S2 wall / door |
|---|---|---|---|---|---|---|---|
| OLD renderer | 0.244 | 0.401 | 0.749 | 0.287 | 0.270 | 0.089 / 0.346 / 0.128 | 2.233 / 1.665 |
| main (C3j) | 0.439 | 0.531 | 1.589 | 0.318 | 0.582 | 0.191 / 0.260 / 0.157 | 0.905 / 0.988 |
| main, repeat | 0.449 | 0.526 | 1.637 | 0.318 | 0.586 | 0.190 / 0.260 / 0.157 | 0.905 / 0.988 |
| A: scale 0.90 | 0.476 | 0.499 | 1.599 | 0.334 | 0.577 | 0.146 / 0.267 / 0.141 | 0.901 / 1.001 |
| B: GI at internal res | 0.448 | 0.525 | 1.636 | 0.318 | 0.587 | 0.190 / 0.260 / 0.156 | 0.907 / 0.989 |
| C: young rays ×3 | 0.448 | 0.526 | 1.637 | 0.321 | 0.587 | 0.190 / 0.259 / 0.157 | 0.905 / 0.988 |
| B + C | 0.449 | 0.525 | 1.637 | 0.316 | 0.586 | 0.190 / 0.260 / 0.156 | 0.907 / 0.989 |
| tOnly: motion α 0.25 + sharpen 0.15 | 0.390 | 0.475 | 1.562 | 0.278 | 0.550 | 0.191 / 0.260 / 0.156 | 0.905 / 0.988 |
| rSAP: restir spatialAll + penRays | 0.418 | 0.495 | 1.440 | 0.308 | 0.442 | 0.093 / 0.198 / 0.078 | 0.969 / 1.067 |
| **MOTION_CALM = rSAP + tOnly** | 0.377 | 0.441 | 1.347 | 0.269 | 0.443 | 0.093 / 0.201 / 0.078 | 0.969 / 1.067 |
| … with history 20 → 10 | 0.366 | 0.427 | 1.101 | 0.270 | 0.419 | 0.115 / 0.232 / 0.084 | 1.112 / 1.201 |
| c4: … history 6 | 0.352 | 0.433 | 0.886 | 0.270 | 0.380 | 0.136 / 0.243 / 0.086 | 1.198 / 1.245 |
| c4 + B + C | 0.356 | 0.432 | 0.893 | 0.270 | 0.376 | 0.136 / 0.243 / 0.084 | 1.199 / 1.246 |
| floor (ReSTIR off + resolve motion terms off) | 0.235 | 0.379 | 0.531 | 0.261 | 0.306 | 0.005 / 0.095 / 0.018 | 1.840 / 1.488 |
| (B + C in the GI-only view 4, pan: main → BC) | 0.271 → 0.272 | 0.294 → 0.301 | 0.310 → 0.291 | 0.385 → 0.383 | 0.380 → 0.367 | still 0.129 → 0.134 | S2 0.358 → 0.363 |

A, B, C, B+C, D (grain-on takes: CD1 / BCD = C / BC to 3 decimals) sit inside the take-to-take spread of main in every composite tile of both
shots, and B+C is main to three decimals even in the GI-only view under the pan (the residual it reshapes is under an 8-bit level there). The
knob sweep that found rSAP / tOnly (24 rows, grain on: restirHistory 8/4, rays 5/6, spatialAll, spatial 5, permute, penCap 6, penRays,
gradK 2, coherent; motion α 0.3/0.2/0.1, motion sharpen 0, histSharp 0, shadowCap 20/6, directHistory 0.5; four repeats of main) is the
page's §2b table (docs/perf/gim-grain/): winners spatialAll, penRays (unlit −13 %, litFloor −10 %), history 4–8 (litFloor −24 … −41 %, the
light's edge likewise — paid for at rest and on the daylight wall), motion α ↓ and motion sharpen 0 (−12 % each in the dark tiles); losers gradK 2 (+74 %),
coherent (×8), permute, rays 5/6 (unlit −25 % but the moonlit band +25 %), shadowCap 6.

### 4.2 Every tier and the maintainer's window (S1 pan: unlit · unlitAisle · lightEdge · sillWall · litFloor | STILL unlit / litFloor | S2 wall / door)

| tier · variant | unlit | unlitAisle | lightEdge | sillWall | litFloor | still unlit / litFloor | S2 wall / door |
|---|---|---|---|---|---|---|---|
| **ultra** (1920×1080 → 2133×1200) | | | | | | | |
| OLD renderer | 0.238 (-43 %) | 0.406 (-12 %) | 0.687 (-68 %) | 0.266 (-2 %) | 0.264 (-54 %) | 0.075 / 0.117 | — / — |
| main | 0.421 | 0.462 | 2.164 | 0.272 | 0.572 | 0.113 / 0.108 | 0.816 / 1.047 |
| MOTION_CALM | 0.415 (-1 %) | 0.416 (-10 %) | 1.680 (-22 %) | 0.255 (-6 %) | 0.483 (-16 %) | 0.052 / 0.059 | 0.893 / 1.127 |
| B | 0.427 (+1 %) | 0.464 (+0 %) | 2.158 (-0 %) | 0.270 (-1 %) | 0.561 (-2 %) | — / — | — / — |
| **high** (1368×770 → 1777×1000) | | | | | | | |
| OLD renderer | 0.244 (-44 %) | 0.401 (-24 %) | 0.749 (-53 %) | 0.287 (-10 %) | 0.270 (-54 %) | 0.089 / 0.128 | 2.233 / 1.665 |
| main | 0.439 | 0.531 | 1.589 | 0.318 | 0.582 | 0.191 / 0.157 | 0.905 / 0.988 |
| MOTION_CALM | 0.377 (-14 %) | 0.441 (-17 %) | 1.347 (-15 %) | 0.269 (-15 %) | 0.443 (-24 %) | 0.093 / 0.078 | 0.969 / 1.067 |
| B + C | 0.449 (+2 %) | 0.525 (-1 %) | 1.637 (+3 %) | 0.316 (-1 %) | 0.586 (+1 %) | 0.190 / 0.156 | 0.907 / 0.989 |
| B | 0.448 (+2 %) | 0.525 (-1 %) | 1.636 (+3 %) | 0.318 (+0 %) | 0.587 (+1 %) | 0.190 / 0.156 | 0.907 / 0.989 |
| floor | 0.235 (-46 %) | 0.379 (-29 %) | 0.531 (-67 %) | 0.261 (-18 %) | 0.306 (-47 %) | 0.005 / 0.018 | 1.840 / 1.488 |
| A: ×0.90 | 0.476 (+8 %) | 0.499 (-6 %) | 1.599 (+1 %) | 0.334 (+5 %) | 0.577 (-1 %) | 0.146 / 0.141 | 0.901 / 1.001 |
| **high at the maintainer's 1024×1000** (788×770 → 1024×1000) | | | | | | | |
| OLD renderer | 0.244 (-41 %) | 0.397 (-26 %) | 0.745 (-56 %) | 0.278 (-10 %) | 0.274 (-53 %) | 0.086 / 0.131 | — / — |
| main | 0.414 | 0.533 | 1.676 | 0.308 | 0.586 | 0.183 / 0.128 | — / — |
| MOTION_CALM | 0.366 (-12 %) | 0.478 (-10 %) | 1.279 (-24 %) | 0.264 (-14 %) | 0.459 (-22 %) | 0.088 / 0.096 | — / — |
| B + C | 0.412 (-0 %) | 0.544 (+2 %) | 1.741 (+4 %) | 0.309 (+0 %) | 0.593 (+1 %) | — / — | — / — |
| floor | 0.233 (-44 %) | 0.379 (-29 %) | 0.508 (-70 %) | 0.262 (-15 %) | 0.281 (-52 %) | — / — | — / — |
| A: ×0.90 | 0.570 (+38 %) | 0.535 (+0 %) | 1.862 (+11 %) | 0.335 (+9 %) | 0.546 (-7 %) | — / — | — / — |
| **medium** (1072×603 → 1600×900) | | | | | | | |
| OLD renderer | 0.243 (-60 %) | 0.420 (-34 %) | 0.735 (-63 %) | 0.271 (-33 %) | 0.308 (-52 %) | 0.079 / 0.173 | 2.300 / 1.623 |
| main | 0.607 | 0.634 | 2.004 | 0.405 | 0.641 | 0.209 / 0.137 | 0.926 / 0.971 |
| MOTION_CALM | 0.412 (-32 %) | 0.507 (-20 %) | 1.729 (-14 %) | 0.305 (-25 %) | 0.649 (+1 %) | 0.106 / 0.098 | 0.997 / 1.059 |
| B + C | 0.630 (+4 %) | 0.630 (-1 %) | 1.961 (-2 %) | 0.403 (-0 %) | 0.741 (+16 %) | — / — | 0.927 / 0.972 |
| floor | 0.235 (-61 %) | 0.383 (-40 %) | 0.572 (-71 %) | 0.260 (-36 %) | 0.320 (-50 %) | — / — | — / — |
| **low** (768×432 → 1280×720) | | | | | | | |
| OLD renderer | 0.260 (-66 %) | 0.438 (-49 %) | 0.969 (-45 %) | 0.286 (-46 %) | 0.349 (-65 %) | 0.105 / 0.204 | 2.261 / 1.634 |
| main | 0.759 | 0.860 | 1.763 | 0.529 | 0.985 | 0.294 / 0.188 | 0.749 / 0.602 |
| MOTION_CALM | 0.524 (-31 %) | 0.626 (-27 %) | 1.610 (-9 %) | 0.410 (-22 %) | 0.673 (-32 %) | 0.382 / 0.130 | 0.826 / 0.695 |
| B + C | 0.767 (+1 %) | 0.858 (-0 %) | 1.752 (-1 %) | 0.531 (+0 %) | 0.980 (-1 %) | — / — | — / — |
| floor | 0.243 (-68 %) | 0.409 (-52 %) | 0.643 (-64 %) | 0.291 (-45 %) | 0.337 (-66 %) | — / — | — / — |
| **verylow** (533×300 → 1066×600) | | | | | | | |
| OLD renderer | 0.276 (-67 %) | 0.514 (-45 %) | 1.316 (-28 %) | 0.289 (-51 %) | 0.415 (-58 %) | 0.107 / 0.297 | — / — |
| main | 0.837 | 0.938 | 1.837 | 0.587 | 0.997 | 0.292 / 0.225 | — / — |
| MOTION_CALM | 0.610 (-27 %) | 0.764 (-19 %) | 1.182 (-36 %) | 0.451 (-23 %) | 0.713 (-28 %) | 0.439 / 0.164 | — / — |
| B + C | 0.775 (-7 %) | 0.959 (+2 %) | 1.752 (-5 %) | 0.578 (-2 %) | 0.871 (-13 %) | — / — | — / — |

GI's share of the composite variance per tier (S1 pan, main; unlit / unlitAisle / lightEdge / sillWall / litFloor · S2 wall): ultra 0/0/0/0/14 % · 0 %; high 0/1/0/0/8 % · 0 %; high at the maintainer's 1024×1000 0/0/0/0/0 %; medium 0/0/0/0/0 % · 0 %; low 3/0/0/0/33 % · 0 %; verylow 4/0/7/0/22 %.

## 5. The rows that do move it — MOTION_CALM (proposed, opt-in)

`quality.ts MOTION_CALM = { restirSpatialAll: true, restirPenRays: true, taauMotionAlpha: 0.25, taauSharpenMotion: 0.15 }`,
`Quality.applyMotionCalm(on)` (re-applied after preset changes while on; off = the engine defaults — no preset places any of the four),
`?motioncalm`, Tab ▸ Frame ‘MOTION-CALM rows’, `__gimo.calm(bool)`. At high: S1 pan −14 / −17 / −15 / −15 / −24 % (unlit / unlitAisle /
lightEdge / sillWall / litFloor), S1 STILL −51 / −23 / −50 % (unlit / lightEdge / litFloor), S2 wall +7 %, door +8 %; cost +0.79 ms
union (direct +0.66 — the spatial pass everywhere + the penumbra ray; the resolve terms are free). Why not the reservoir memory too: history
20 → 10 / 6 buys 3–6 % more in the dark tiles under the pan — and 31–44 % at the light's EDGE, the penumbra, where a moving camera hurts ReSTIR's
visibility reuse most — but costs the still tiles half of what spatial reuse wins there and the daylight wall +23 / +32 %; it is the row to
revisit if the penumbra edges are what the eye catches.
The two things to look at by eye before it becomes a preset default: contact shadows under spatial reuse everywhere (image-quality.md's D2
measured them softer; the penumbra ray offsets part of it) and edge sharpness in a pan with α 0.25 (tjank.md §vi raised α to 0.4 for it; the
history de-blur `taauHistSharp` 0.5 stays on and carries part of that job now).

## 6. Cost, memory, the climb on this machine

Serialized calm-still unions on the cubicles view (sharp-harness `costAB`: ABAB × 4 blocks of 20 frames after 10 warm, medians; high,
1368×770 → 1777×1000). Contention: other lanes rendered throughout — the A medians wander 9.8–11.0 ms between pairs and three pairs carry a
contended block in their p95 (BC 18.0, rSAP 16.2 / 18.4, A090 20.3); the interleaving keeps the DELTAS honest to ~±0.15 ms, the absolutes are
this evening's. Cross-build (the same view on main @ 7b76e9e vs this tree with everything off): gather 1.835 / 1.835, temporal 0.262 / 0.262,
direct 2.49 / 2.49, softblur 1.18 / 1.18, union 9.77 / 9.70 — the compiled-in B / C / D code costs nothing off.

| high, calm still | Δ union | where | memory |
|---|---|---|---|
| B (giFullRes, 4 iters) | +0.85 | temporal +0.79 | +64 MB (8 × internal rgba16f; ~133 at ultra 0.9; 0 while off) |
| C (giYoungRays 3) — AT REST | +0.65 | gather +0.52 (the test + barriers, no extra rays at rest) | 16 B |
| B + C | +1.44 | gather +0.52, temporal +0.92 | +64 MB |
| rSAP (spatialAll + penRays) | +0.98 | direct +0.79 | 0 |
| MOTION_CALM (rSAP + resolve terms) | +0.79 | direct +0.66 | 0 |
| tOnly (resolve terms alone) | +0.07 | — | 0 |
| A: scale 0.90 (vs 0.77) | +1.38 | direct +0.72, gather +0.46, softblur +0.33 | (pool) |
| gather ½ instead of ⅓ | +2.03 | gather +2.10 | (pool) |

Against the bars (union: ultra ≤ 22, high ≤ 14 — main 13.6 stress p95 with C3j — medium ≤ 8, low ≤ 5, verylow ≤ 3.5): B + C at high would
sit at ~15 in the stress minute — over the bar for no measurable benefit; the brief's fallback (“tier B to ultra only”) is moot because it buys
nothing there either (ultra's gather is the resampled `mainGi`, where C does not apply, and B is untested against it — left off).
MOTION_CALM's +0.8 keeps high inside 14 only just (13.6 → ~14.4 predicted p95): if it becomes a default, `restirPenRays` (+~0.15) is the
piece to drop first at high; medium and below have the room.

**The climb on this machine at the maintainer's window** (high, 1229×1200-CSS pane → 1024×1000 output; `__gim.costCurve()`: serialized
calm-still union per rung, cubicles view — then `__gim.climbSim()`: the REAL `Quality.sample()` fed 60 fps and those unions + 0.5 ms slack,
window by window): ×0.77 (788×770) 7.1 ms · ×0.80 6.8 · ×0.85 7.0 · ×0.90 7.5 · ×0.95 (972×950) 8.0 · [×1.00 7.3 — sharp direct off there, not
a rung] · gather ½ at the top 9.5. The ladder: preset high at t = 1 s → 0.80 at 6 s → 0.85 at 11 → 0.90 at 16 → 0.95 at 21 → gather ½ res at 26 s,
and stays (union ≈ 9.5–10 of 16.7, under the 60 / 65 % bands, nothing failed). In play the recording's frames were ~9 ms at ×0.77 rather than
7: scaled the same way that is ≈ 10 ms at ×0.95 — right at the band — so expect it to hold 0.90–0.95 with the gather at ⅓, and to hand the
rungs back in the loud minute (the back-off) and re-earn them after. docs/perf/gim-climb.json has the per-pass rows.

## 7. Recommendation, residuals, not done

- **Per tier** (§4.2): keep C3j as merged everywhere. `?motioncalm` by eye, then — if the contact shadows and the pan sharpness pass — the four
  rows into `PRESETS` (spatialAll / penRays into `Preset.restir`, the two resolve terms into `Preset.taau`), one line per tier:
  **ultra** −1 / −10 / −22 / −6 / −16 % pan (its unlit floor is already the calmest of the tiers), still tiles halved, wall +9 % — yes;
  **high** −14 / −17 / −15 / −15 / −24 %, still −51 / −50 %, wall +7 %, +0.79 ms calm-still union (13.6 stress p95 → ~14.4 predicted: drop
  penRays there first if the bar must hold) — yes; **medium** −32 / −20 / −14 / −25 / +1 %, still −49 %, wall +8 % — yes; **low / verylow**
  −31 / −27 / −9 / −22 / −32 % and −27 / −19 / −36 / −23 / −28 % under the pan BUT the darkest tile's STILL crawl goes UP (0.29 → 0.38 /
  0.44: with 3 / 2 rays a pixel, spatial reuse everywhere trades its own noise in) — there take the two resolve terms only (free) and leave
  the ReSTIR pair for a second look. B / C at any tier: no (verylow's −7 / −13 % is the only place they register at all, inside its noise).
- **A (ladderClimb):** ship on. On this M4 Max at the maintainer's window the calm-still union per rung and the ladder's settled rung are on
  the page (§7); it also fixes auto ↑ on 60 Hz displays, which is worth having regardless of this lane.
- **B / C / D:** leave in the tree, OFF at every tier (identity-proven, zero cost off). They are the tools for a shot whose flow IS the bounce
  (a torch swung across a wall in a dark room, the blackout's beacons) — not measured here, and not the complaint. If C is ever placed, its
  at-rest cost wants the young test moved out of the ray kernel (a tiny pre-pass writing a per-tile flag) first.
- **For the ReSTIR lane (restir.wgsl — not mine):** the target is the ‘floor’ row — the leader path's motion numbers with ReSTIR's daylight
  numbers. Under camera motion: reproject the temporal reservoir with a bilinear-STOCHASTIC pick among the 4 source pixels instead of the
  nearest (lineages then diffuse smoothly instead of merging / splitting in blocks); scale the M cap by (1 − k·|screen motion in px|) so a
  panning pixel leans on fresh candidates whose error the resolve CAN average; and / or shade from the 2×2 reservoirs round the reprojected
  point while |motion| > ½ px (spatial reuse where it is needed, free at rest). The instrument here measures any of them in two minutes
  (`__gim.run('h_x', {variant:'main', extra:{…}})` on a `?paused&quality=high&mute` boot of that lane's server + `python3 tools/qa/gim-report.py`).
- **Residuals, said plainly.** (1) Even with MOTION_CALM the unlit floor under a pan flows 0.38 levels where the old renderer flowed 0.24, and
  the light's edge 1.35 where old flowed 0.75 — faint 2–3-px mottling sliding under the floor and a busier penumbra edge when you look for them;
  the reservoir reprojection is the rest. (2) The daylight wall's slow
  whole-tile swim (0.9 levels over 24 frames) is untouched (+7 % with the bundle); the occluder cue is a quarter of it. (3) Luma only —
  chroma flow (the vending fronts) is not measured. (4) No stress-minute p95 was re-taken for the bundle (the calm-still delta and image-quality.md's D2 stress numbers stand in); the
  low / verylow still-crawl rise wants a tOnly take at those tiers before anything is placed there.
- **Not done, deliberately:** no default changed on the direct estimator, the shadow client or the resolve (other lanes' files or the
  maintainer's by-eye calls); no restir.wgsl work; B not tiered anywhere; the maintainer's exact GPU contention not reproduced for cost
  (serialized interleaved takes instead); the froxel haze's own temporal behaviour under the pan not separated (it sits inside ‘D’ = not GI,
  and is small in these tiles); `__iq.crawl` pan-sharpness for α 0.25 not re-taken (tjank.md / image-quality.md have the α curve; the
  by-eye call supersedes it anyway).
