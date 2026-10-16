# Ray traversal — the lab notebook (exp/trace-perf)

> **Port note (main).** What reached main from this branch: **E8** (§2.10 — `settings.gatherStrata`, default OFF pending the maintainer's call; fgather.wgsl
> `cosineDirK`, the second gather pipeline pair in passes.ts, `?gatherStrata` / `__gs` / the Tab ▸ Indirect light row) and **the lab** (§0 — `tools/qa/trace-lab.js`,
> `src/render/shaders/trace_lab.wgsl` with its profile kernels updated to the round-cone proxies, `tools/qa/gpu-quiet.sh`, `tools/qa/trace-page.py`, `?trace=N` →
> `const TRACE_VARIANT` in the scene prelude, `__hotCommon` / `__scenePrelude` / `__traceConfig` / `__commonSource` / `__daylight`, `rc.hotSwap`, `particles.hotSwapSim`,
> plus this notebook, docs/perf/trace-*.json, docs/shots/tr_*.jpg and docs/review/trace-perf.html as the record). NOT ported: the traversal variants V1‥V8, H1's blocker
> guesses, the E11 dim-skip probe, the 97/98/99 trace-twice instruments and the three dispatchers — common.wgsl on main is untouched, so `TRACE_VARIANT` is unread by the
> engine's shaders and only variant 0 (today's walk) exists; the lab's generated selectors then call occluded / occludedT / traceClosest directly. To price the next
> idea, add `…V<N>` copies + the dispatchers as §5 describes and `__tl.use(N)`. Port measurements (main @ 95e5d6b, M4 Max, high 1368×770, calm cubicles, 6 × 20
> serialized frames interleaved): gather 2.032 → 1.704 ms (−16.1 %), union 11.01 → 10.68; LDR tile means within +0.04‥0.14 %, indirect-only means within −0.5‥+0.05 %,
> temporal sd 0.96‥1.02×; the OFF pair `__png`-hash-identical to main in two views (cubicles fa468b32, lobby 17879b71) with the prelude's new const line in place.

Branch `exp/trace-perf` off main @ e3d532b. One job: make `occluded()` / `occludedT()` / `traceClosest()` (common.wgsl) and what feeds
them faster, with exactness proofs. Every attempt is logged here, failures included. Instruments: `tools/qa/trace-lab.js` (`__tl`) +
`src/render/shaders/trace_lab.wgsl`; how to reproduce any number is in §0.

Machine: M4 Max, Chrome 148 / Metal 3, other lanes' tabs mostly idle (A/A takes agree ≤ 2 % unless stated). Presets pinned by URL.
Frame numbers are SERIALIZED still renders of a staged scene (engine.render + onSubmittedWorkDone + a MessageChannel yield per frame),
medians over ≥ 48 frames, variants interleaved round-robin; "union" = `timer.unionMs()` over the compute passes.

## 0. Instruments (how every number below was made)

* `?trace=N` boots the whole renderer on traversal variant N (frame.ts `traceConfig` → `const TRACE_VARIANT` in the scene prelude → the
  dispatchers at the end of common.wgsl's traversal section pick `…V<N>` at compile time; 0 = the reference walk, byte-identical frame).
* `__hotCommon(src?, variant?)` swaps an edited common.wgsl and/or variant into every tracing pipeline of the live page (direct, restir,
  both gathers, reflect, volumetrics, froxels, the three cascade kernels, the particle sim) — `__tl.use(v)`.
* `__tl.scene('B1'…'B5')`, `__tl.ab(apply, variants)` (per-pass + union medians, interleaved), `__tl.aa()` (contention check).
* `__tl.points('camera'|'level')` → `__tl.bench({cls, fn})` = N·reps rays of one class through one query per variant, the lab's own
  timestamped compute pass, medians of interleaved runs, minus an 'empty' pass that only generates the rays → **Mrays/s of traversal alone**.
  Receivers = the real g-buffer's depth / normal / owner at a stratified pixel lattice (exactly what fgather / restir shade).
  Classes: `ao` (cosine hemisphere, 0.3–2 m, occluded), `light` (a light picked ∝ unshadowed luminance, a point on its disk as
  shadowSample draws it, occludedT), `panel` (same, ceiling panels only), `sun` (the kind-2 light: moon at night / sun by day, 80 m,
  occludedT), `column` (straight up to the ceiling), `gather` (cosine hemisphere, 40 m, traceClosest), `reflect` (mirror of the eye ray,
  48 m, traceClosest), `random` (anywhere in the air, any direction, 30 m, occluded).
* `__tl.exact({fn, cls, a, b})` runs variants a and b on the SAME rays in the same thread → disagreement counters (any-hit boolean;
  occludedT sign + |Δt| > 1e-4; traceClosest hit/miss, idx, |Δt| > 1e-4, normal) + the first offending rays. `exactAll(b)` = 12 combos.
* `__tl.idHash('B1')` = the deterministic capture protocol (seeded Math.random before frame 1, staged, phases zeroed, 12 serialized steps
  + 24 renders, grain 0) → FNV hash of the final LDR frame. Reference @ high 1368×770: **B1 ae9c56db · B3 674bd13e** (reproduced on
  three boots, and again through the new dispatchers at variant 0 — the dispatch is free and identical). B2 (torch guards + Sam
  visible) is NOT reproducible boot to boot (async light-meter readback drives the men) — timing only.

Scenes: B1 cubicles at night from follow-camera height (37 lights, 6 characters, 1079 boxes of which 303 dynamic, 2779 grid items,
344/1120 cells empty, max 18 items/cell) · B2 corridor under the panels, three torch guards + Sam · B3 lobby stone + frontage glass ·
B4 the stress minute (`__stress.setup({fight:false})`: QRF lights, smoke, rain) · B5 daylight corridor (sun shadow rays).

## 1. Profile first — where does traversal time go?

### 1a. In the frame (B1, high 1368×770; instruments 97/98/99 = trace twice)

| pass | 1× (ms) | any-hit ×2 | closest ×2 | both ×2 | ⇒ any-hit share | ⇒ closest share | traversal in pass |
|---|---|---|---|---|---|---|---|
| direct (ReSTIR) | 2.75 | 4.06 | 2.82 | 4.00 | **1.31 ms (48 %)** | ~0 | 1.3 ms |
| gather | 2.10 | 3.21 | 2.82 | 3.87 | **1.11 (53 %)** | **0.72 (34 %)** | 1.8 ms (87 %) |
| cascades Σ | 1.18 | 1.83 | 1.38 | 2.10 | 0.65 (55 %) | 0.20 (17 %) | 0.85 ms (72 %) |
| froxels | 0.52 | 0.66 | 0.52 | 0.66 | 0.13 (25 %) | 0 | 0.13 |
| reflect | 0.13 | 0.20 | 0.13 | 0.20 | 0.07 | ~0 | 0.07 |
| **union** | **10.55** | 13.83 | 11.80 | 14.68 | **3.3 ms (31 %)** | **1.25 (12 %)** | **≈ 4.1 ms = 39 % of the frame** |

So: any-hit shadow rays are the prize (3.3 ms of 10.6), closest hits second (1.25 ms). The gather spends 87 % of itself tracing.
A 25 % faster tracer is worth ≈ 1 ms at high in this view.

### 1b. Per ray (the reference any-hit walk with counters, B1 receivers)

| class | hit % | answered by global / grid / capsule | cells visited | lists loaded | items fetched (y-culled) | slab tests (yawed) | capsule spheres / tests |
|---|---|---|---|---|---|---|---|
| light | 68 | 27 / 40 / 0.2 | 3.7 | 1.6 | 7.6 (3.8) | 3.8 (1.6) | 1.95 / 0.66 |
| panel | 56 | 0 / 56 / 0.3 | 5.1 | 2.3 | 10.5 (5.2) | 5.3 (2.2) | 2.7 / 0.9 |
| ao | 23 | 3 / 19 / 0.1 | 1.7 | 1.1 | 6.4 (3.5) | 2.9 (1.3) | 4.6 / 0.7 |
| sun (moon) | 99.9 | 93 / 7 / 0 | 0.3 | 0.2 | 0.8 | 0.4 | 0 |
| column | 100 | 100 / 0 / 0 | 0 | 0 | 0 | 0 | 0 |
| random | 82 | 69 / 13 / 0 | 1.6 | 0.4 | 1.3 | 0.7 | 1.1 / 0 |

Reading: the walk is already lean per ray — a shadow ray to a light loads ~1.6 cell headers, ~7.6 item words (half rejected by the
1.5 cm height cull before the 32-B box fetch), slab-tests ~3.8 boxes for 0.4 hits, and checks 5 globals against segment bounds
(4.7 rejected). ~450 ALU ops and ~165 B per ray at 600 Mrays/s is ~2 % of the GPU's ALU peak: the tracer is LATENCY / DIVERGENCE
bound (dependent load chain cell word → item word → box → test, lanes finishing at different depths), not bandwidth or ALU bound.
Straight-up rays (column, most of 'sun' indoors) are answered by the ceiling global in one slab test — the 'column path' idea (H4) has
nothing left to win indoors. Every MISS pays the character loop (6 bounding spheres from the uniform + capsule tests near a man).

### 1c. Micro-bench, reference walk (B1 receivers, 4.2 M rays per take)

| class / query | Mrays/s | ms per M rays |
|---|---|---|
| ao / occluded | 1185 | 0.84 |
| light / occludedT | 607 | 1.65 |
| panel / occludedT | 665 | 1.50 |
| sun / occludedT | 5730 | 0.17 |
| column / occluded | 21400 | 0.05 |
| gather / traceClosest | 744 | 1.34 |
| reflect / traceClosest | 1524 | 0.66 |
| random / occluded | 703 | 1.42 |


### 1d. Per ray, CLOSEST hits (the reference traceClosest with counters, B1 receivers)

| class | hit % | final answer global / grid / capsule | cells visited | lists loaded | item words (y-culled) | slab tests (yawed) → hits | capsule spheres / tests |
|---|---|---|---|---|---|---|---|
| gather (cosine, 40 m) | 99.5 | 56 / 43 / 0 | 3.7 | 1.9 | 12.7 (6.4) | 6.3 (2.5) → 0.53 | 6 / 0.01 |
| reflect (mirror, 48 m) | 100 | 57 / 43 / 0 | 2.6 | 1.5 | 10.3 (4.8) | 5.5 (2.1) → 0.57 | 6 / 0.01 |

A gather ray's closest hit is the ceiling / floor slab (a global, tested first, which bounds the walk) more often than furniture; it then walks
~3.7 cells testing ~6 boxes before tCell passes hit.t. Every closest ray pays all six character spheres (hit.t-limited).

## 2. Hypotheses, in the order the profile put them

(each entry: hypothesis · change · micro-bench before → after · scene ms before → after · exact? · verdict)

### 2.0 The two probes that set the ceiling (B1 receivers, micro-bench)

* **Character phase** (a probe: `world.charCount = 0` for still renders): frame union 10.49 → 9.90 ms (−5.6 %; direct −0.19, gather −0.27,
  cascades −0.06). Per ray: light 4.19 → 3.15 ms net for 2.8 M rays (−25 %), gather −12 %, ao −11 %. Six bounding-sphere tests (+ capsule
  tests near a man) on every ray that reaches the character phase are a fifth of a shadow ray's instructions BECAUSE the box walk is so lean.
  In B1 Sam (invisible but present) and a civilian stand inside the view, so this is real near-character work, not waste.
* **Coherence** (the same rays, lanes regrouped): 32 lanes tracing the SAME ray → light 876 → 4157 Mrays/s (4.7×), panel 4.5×, gather
  4.1×, ao 1.8×; scattering the receivers (stride 7919) halves throughput. Letting a SIMD group merely PICK THE SAME LIGHT (own receiver, own
  disk point — 'lightC', which is what a direct-pass tile mostly does) → 802 → 2502 Mrays/s (3.1×). Gather directions binned per 32 lanes:
  azimuth quadrant 1.20×, azimuth half × cosθ half 1.25×, azimuth eighth 1.40×, 8 az × 4 cosθ cells 1.35–1.76×.
  ⇒ **The walk is divergence-bound** (execution + memory divergence between lanes), not ALU- or bandwidth-bound: identical work per lane runs
  4–5× faster. Per-ray instruction trimming cannot buy much; only (a) removing whole rays, (b) making lanes agree, or (c) shrinking what a
  divergent lane touches can. It also means the direct pass's real shadow rays (≈ 3000 Mrays/s effective) already run near 'lightC', while
  the gather's rays (scattered secondary origins, random directions) run at the incoherent figure.

### 2.1 V1 — item loop unrolled ×2, paired loads (H3/H5: latency hiding) · EXACT (44 M rays, 12 combos, 0 disagreements)
Both packed item words, then both 32-B box records, loaded before either test. Micro: light +0.9 %, panel +3.9 %, ao −3.1 %, gather +0.7 %,
reflect +1.9 % (all inside the ±4 % run-to-run band). Frame B1 high: direct / gather within one timer quantum (0.065 ms). **Verdict: no
effect** — consistent with divergence, not load latency, being the limiter. Not worth its hunk.

### 2.2 V2 — character bounds read from the capsule STORAGE buffer instead of the uniform (H8-ish) · EXACT
Micro: light +2.9 %, panel −2.7 %, ao −1.6 %, gather 0.0. **Verdict: no effect.** Dynamically indexed uniform reads are not the problem here.

### 2.3 V3 — analytic AABB reject before the yawed slab test (H8: fewer divisions) · EXACT
Micro: light −0.9 %, panel −5.3 %, ao −7.4 %, gather −5.1 %. Frame: direct +2.5 %, gather +3.2 % (slower). **Verdict: negative.** The extra
test sits on the per-item critical path and the yawed AABBs are fat (diagonal partitions), so it rejects little and costs always. Dropped.

### 2.4 V4 — occludedT with the character phase LAST (boxes over the whole segment, then men over [0, tBox)) · boolean EXACT, hint-EQUIVALENT
(4305 / 1.9 M light rays and 49 k / 4.1 M moon rays report a different blocker distance in B1: a capsule nearer than the first box; the
occluded / not answer never differs.) Micro: light +6…12 %, panel +7…9 %; lightC 0. Frame B1: direct 0.0 % (the pass's rays are lightC-like
and 27 % of them are answered by the ceiling global before any character test either way). **Verdict: real on incoherent shadow rays,
invisible in this frame; superseded by V6.**

### 2.5 V5 — the walk flattened into ONE loop (item-or-step per iteration; H5: SIMD utilisation) · EXACT (44 M rays)
Micro: light −10.9 %, lightC −10.5 %, panel −6.6 %, ao −3.1 %, gather −5.0 %. Frame: direct +7.3 %, gather +3.2 %. **Verdict: negative** —
the nested cell/item loops win on this GPU (the flattened body carries both halves every iteration); matches Aila & Laine's while-while.

### 2.6 V6 — characters registered in the GRID (region C: per-cell character mask + a distance field that counts their cells as occupied);
the walk ORs the masks it passes and tests only those men · occluded / traceClosest EXACT (44 M rays), occludedT = V4's order (hint-equivalent)
Micro: ao +6.8 %, panel +5.9 %, reflect +5.9 %, light −0.9 %, gather −1.2 %. Frame B1: 0.0 % — every man in B1 stands inside the view, so
most rays cross a marked column and test him exactly as before; the saving only exists for rays that pass nobody. **Verdict: correct and
cheap (13 KB, one OR per loaded cell), pays only in character-free regions; the right hook for the SDF-characters lane** (test a rig only
where the ray's cells carry its bit) rather than a win to bank today. CPU hunks: boxes.ts region C + charBoundsCpu; WGSL: gridCellV6,
traceCapsulesM / occludedCapsulesM / meshShadowTM, the three V6 walks; world.ts GRID_CC.

### 2.7 V8 — cell lists in big-occluder-first order (H3 sort; boxes.ts sortItems) + in-cell index tie-break for closest hits · EXACT vs V0
on index-ordered data (15 M rays); with the sort ON the any-hit / occludedT answers are order-independent by construction and traceClosest
reproduces index-order tie winners. Timing: see §2.9's table (pending).

### 2.8 V8 timing (quiet GPU, aa 0.65 %): B1 high, `?sortItems` + variant 8 vs index order + variant 0
direct 2.69 = 2.69, gather 2.03 = 2.03, union 10.22 = 10.22. **Verdict: nil.** With ~2 slab tests per loaded cell there is no in-cell order left to exploit.

### 2.9 H1 — blocker GUESSES in the direct pass (temporal-cache idea, intra-frame form) · boolean-exact, hint-equivalent
`occludedTI` = occludedTV0 that also names the blocking box; `direct_common.wgsl shadowSampleG` tries the pixel's running guess (one box fetch +
one slab test, `guessBlocks`: rejects hidden / glass / own-owner boxes) before the walk and adopts the walk's blocker as the next guess;
`restir.wgsl const RESTIR_GUESS` routes the queued rays through it. Frame B1 high, quiet (aa 0 %): **direct 2.95 → 3.34 ms (+13 %)**.
Why it loses: the on-screen majority is LIT and a lit ray can never be shortcut (proving 'clear' needs the whole walk); occluded rays already
exit early; the guess test and the extra live state are paid by every ray. The temporal (last-frame texture) version has the same cost
structure with a somewhat better hit rate — not built. **Verdict: negative; kept off (const false) as the record.**

### 2.10 E8 — TILE-COHERENT STRATIFIED GATHER DIRECTIONS (consumer side) · unbiased, different sample pattern
`fgather.wgsl cosineDirK(N, k, K)`: ray k of every texel from stratum (k + frame) mod 4 — (azimuth half) × (cos²θ half) for the main
gather's 4 rays; a Latin square over the same four cells for mainGi's K = 2 fresh rays (both azimuth halves and both θ bands every frame,
pairing alternating); K azimuth sectors otherwise — each texel's own two rnd() as the jitter inside, the same draw COUNT as before.
passes.ts compiles the module twice behind `const GATHER_STRATA` and picks per frame by `settings.gatherStrata` (`?gatherStrata`, `__gs.on`).
* B1 high, quiet (aa 0–0.65 %, four takes): **gather 2.03 → 1.77 ms (−12.9 %)**, union 10.16 → 9.90 (−2.6…−3.2 %); every other pass unchanged.
* Quality (B1 high, denoised gi[0] linear + final LDR, 12-frame temporal stats, two takes, four tiles): energy within ±1 % (noise);
  gi relative temporal sd strata ≤ iid in every tile (centre 0.0027/0.0029 → 0.0026/0.0023, desk tops 0.0027/0.0028 → 0.0011/0.0015,
  the others equal); LDR sd equal (0.020–0.026). It IS stratified sampling: same expectation, never more variance.
* Matrix (below): −14…−16 % gather in every scene at high, −9…−15 % at medium, −4…−7 % at ultra with the azimuth-halves K = 2 form
  (re-run with the Latin square pending).
**Verdict: THE win of the night.** Not hash-identical by construction (a different sample pattern), so it stays default OFF on the branch;
recommended ON.

### 2.11 E10 probe — one light-pick threshold for the whole frame at gather hits (maximal coherence for the gather's off-screen shadow rays)
gather 1.77 → 1.77 (strata on both sides). **Nil**: those rays are not pick-divergence-bound (and after E8 a tile's hits already cluster).

## 3. Scene matrix (serialized still frames, medians of 3 × 30 interleaved per config; A/A first)

high 1368×770 (configs ref / strata / v6 / v6+strata):
* B1: direct 2.69 / 2.69 / 2.69 / 2.69 · gather 2.10 / 1.77 / 2.23 / 1.83 · rc 1.11 / 1.11 / 1.18 / 1.18 · union 10.36 / 9.96 / (12.58) / (14.16) — the
  bracketed unions are contaminated (p75 19–22: another tab woke up mid-take); pass medians hold.
* B3: direct 3.54 / 3.54 / 3.47 / 3.54 · gather 1.77 / 1.51 / 1.77 / 1.51 · union 12.12 / 12.12 / 12.98 / 12.32 (p75 ~18: contended)
* B2: direct 2.95 ×4 · gather 2.56 / 2.16 / 2.56 / 2.10 · union 11.01 / 10.62 / 11.01 / 10.55 (clean) → strata −3.5 %, V6 0.0 % with four men in view
* B5 (daylight): direct 3.21 ×4 · gather 2.29 / 1.97 / 2.29 / 1.90 · union 11.86 / 11.47 / 11.86 / 11.40 (clean) → strata −3.3…−3.9 %
ultra 1920×1080 (ref / strata; mesh shadows + P5 on):
* B3: gather 5.05 / 4.85 · direct 7.01 / 7.14 · union 34.87 / 35.39 (aa 2.2 %) · B2: gather 6.55 / 6.23 · union 21.23 / 20.77 (−2.2 %) ·
  B5: gather 6.03 / 5.64 · union 22.28 / 21.82 (−2.1 %)   [K = 2 as azimuth halves; Latin-square re-run below]
medium 1072×603 (ref / strata):
* B1: gather 1.38 / 1.25 · union 7.60 / 7.41 (−2.5 %) · B3: gather 1.05 / 0.92 · union 7.73 / 7.60 · B2: gather 1.70 / 1.44 · union 8.00 / 7.67 (−4.1 %,
  aa 25 %: contended) · B5: gather 1.51 / 1.31 · union 8.91 / 8.72 (−2.1 %)

ultra 1920×1080 re-run with the Latin-square K = 2 strata (mainGi): B1 gather 5.57 → 4.78 (−14.1 %), union 31.26 → 28.44 (aa 1.6 %, wide
quartiles: treat the union as indicative); B2 gather 6.82 → 6.03 (−11.5 %), union 23.20 → 23.07. So E8 holds at ultra once the two fresh
rays cover four cells: **−0.8 ms of gather at ultra**.

### 3.1 The lossy row's pixels — V6 (= V4's occludedT order) against V0, two torch guards close up in the lobby (view 'L2'), high
40 renders per capture, direct-only debug view and the final frame, sequence V0a · V6a · V0b · V6b (torch flicker makes every capture differ):
* same-setting floors: V0a/V0b direct max 65 · mean 0.474 · >2: 35 439 · >8: 7 927; V6a/V6b 69 · 0.468 · 35 312 · 8 046; final 49 · 0.327 / 56 · 0.462
* cross pairs: V0a/V6a direct 63 · 0.468 · 35 143 · 7 769; V0b/V6b 68 · 0.466; V0a/V6b 70 · 0.473; final 0.348 / 0.300 / 0.374
Every cross pair sits AT the same-setting floor (the lane's criterion: a real effect cannot vanish in any adjacent cross pair) — the changed
blocker distance is invisible here. Crops: docs/shots/tr_v6_{man,feet}_{direct,final}_{V0a,V6a}.jpg.

## 4. Conclusions

1. **The tracer core is close to what this data structure can give.** Per ray it does little redundant work; what it costs is lanes of a
   SIMD group waiting for each other (4–5× between iid and identical rays). Nine tracer-side variants, all exact or boolean-exact, all
   measured: none moves a pass by more than the timer quantum in a real frame; two are 5–13 % worse.
2. **The win is where the rays are made:** stratifying the gather's directions per tile (E8) is unbiased, quality-neutral-or-better and takes
   13–16 % off the frame's biggest tracing pass at every preset (−0.26 ms high, −0.8 ms ultra, −0.13…−0.26 medium; frame −2.5…−4 %).
3. **What to merge:** E8 (behind `settings.gatherStrata`, recommend on), the lab (it prices the next idea in minutes), V6's region-C
   character mask as the seam for the SDF-characters lane. Not V1/V2/V3/V5/V8/H1.
4. **Next structural steps** (see the review page §9): full ray binning in the gather workgroup (needs the shading rng decoupled from the
   direction rng; the lab prices it at up to 1.35–1.76× on gather rays vs E8's 1.25×), a bounded-bias skip of negligible shadow rays at
   gather hits (E11 probe below), and NOT a BVH.

## 5. Hunk list (for hand-merging)

* **E8** — `src/render/shaders/fgather.wgsl`: `cosineDirK` (after cosineDir) + `let dir = cosineDirK(N, k, RAYS)` in main's ray loop +
  `cosineDirK(N, k, K)` in mainGi's fresh loop; `src/render/passes.ts`: `gatherStrata` + `pFGs/pFGRs` members, the second module/pipelines in
  `init()`, `hotSwapGather` building both pairs, the pipeline pick in the gather encode; `src/engine.ts`: `RenderSettings.gatherStrata`
  (+ default false) and `this.passes.gatherStrata = !!s.gatherStrata` in render; `src/main.ts`: `?gatherStrata` + `__gs`.
* **Lab** — `tools/qa/trace-lab.js`, `src/render/shaders/trace_lab.wgsl`, `tools/qa/gpu-quiet.sh`, `tools/qa/trace-page.py`; `src/render/frame.ts`
  (`traceConfig`, `commonSource`, TRACE_VARIANT line in scenePrelude); `src/main.ts` (`?trace`, `?subgroups`, `__scenePrelude`, `__traceConfig`,
  `__commonSource`, `__hotCommon`, `__daylight`); `src/render/rc.ts hotSwap`, `src/render/particles.ts hotSwapSim`; `src/gpu/device.ts gpuWant`;
  common.wgsl: the V0 renames + the three dispatchers (+ instruments 97/98/99).
* **V6** — `src/scene/boxes.ts`: `charBoundsCpu` / `gridChars` / `gridDistC` members, the CPU copy in `addCharacterCapsules`, the character
  mask + region C block in `buildGrid`, `cellStart` sized for region C; `src/scene/world.ts GRID_CC`; common.wgsl: `gridCellV6`,
  `traceCapsulesM` / `occludedCapsulesM` / `meshShadowTM`, `traceClosestV6` / `occludedV6` / `occludedTV6`, dispatcher cases 6.
* **V4** — common.wgsl `occludedTV4` + dispatcher case 4 (only if wanted).
* Everything else in common.wgsl between the V1 header and the dispatchers is the record of the negative results and can be dropped on merge
  (V1, V2 + `CHAR_BOUNDS_BASE`/`charBoundS` + the boxes.ts storage-tail copy, V3 + `isectBoxV3`, V5, V8 + `sortItems`/`?sortItems`,
  `occludedTI`/`guessBlocks` + direct_common `shadowSampleG`/`dcGuess` + restir `RESTIR_GUESS`/`traceSampleG`, gather_common `GATHER_DIMSKIP`).

### 2.12 E11 probe — skip the shadow ray of a NEGLIGIBLE off-screen gather hit (bounded bias; maintainer's call)
`gather_common.wgsl const GATHER_DIMSKIP` (0 = off, folds away) + fgather main setting `dapSkipBelow = k · RAYS · lum(Eref)` per pixel from the
cache's irradiance (the firefly bound's own read): an off-screen hit whose whole unshadowed direct sum W would enter the pixel below k × Eref
is credited unshadowed instead of traced. B1 high on top of E8 (aa 0.6 %): **gather 1.70 → 1.57 ms (−7.7 %) at k = 0.005, → 1.38 (−19 %) at
k = 0.02**; union −1.8 / −3.6 %; the denoised indirect's mean in three tiles moved ≤ 0.7 % (inside the noise) at either k. A real, cheap
lever on the gather's remaining any-hit share — but it IS a bias (light that a blocker would have stopped, credited at up to k of the pixel's
indirect per ray), so it stays a probe (const 0) for the maintainer to decide with the noise harness and eyes on a doorway-lit room.

### 2.13 Not built, and why (the rest of the brief's list)
* **H2 occupancy bitmasks per cell / a coarse 4 m mip.** The walk already rejects 1.6 of a shadow ray's 3.7 cells on the 24-slice mask
  without touching a list, and runs past 0.5–0.7 provably-empty cells per ray on the Chebyshev distance for free; a 64-slice mask could only
  turn some of the 1.6 LOADED cells into rejected ones (their items are then culled at 1.5 cm anyway: 3.8 of 7.6 words). That is the same
  'fewer instructions on a lane that is waiting for its neighbours' trade V1/V3 lost; not worth the second word per cell.
* **H5 subgroups.** `?subgroups` now requests the feature (the adapter has it), but nothing uses it: the two things subgroup ops could do
  here — make loop exits uniform (`subgroupAll`) or process one lane's cell cooperatively — are respectively what the hardware scheduler
  already does (V5 shows the nested exits are handled well) and inapplicable to incoherent rays (lanes sit in different cells). The register /
  live-state angle of H5 was tried as V1 / V5.
* **H8 box records through a texture.** The whole traced set is 35 KB of `BoxGeo` (fits every cache level); V2 showed the address space of a
  small hot array does not matter; and the texture path would cost an rgba32float texture rewritten per frame + a binding in the scene group
  of every pipeline. With the walk shown divergence-bound rather than fetch-bound, skipped.
* **f16 / quantised geometry (H8, lossy).** An exact 16-byte box or item record is impossible (f16 centres are 3 cm off at 32 m); a
  quantised one (~0.25–1 mm) would halve the distinct cache lines a divergent group touches, but 40 % of B1's items are yawed (cos / sin do
  not fit) and it makes the tracer core lossy — the one place the maintainer's bar is bit-exactness. Not pursued.
* **H6 dynamic boxes.** Answered by reading boxes.ts: the 303 dynamic boxes at rest (rig props, leaves, devices, items) are re-binned into
  the SAME grid every frame with the statics (buildGrid runs per upload); there is no linear per-ray list to replace.
* **H1 temporal form** — see 2.9: same cost structure as the intra-frame guess that lost 13 %.

Note on the cascades (read, not measured): rc's kernels put ONE probe per workgroup and its 64+ directions across the lanes, so a SIMD group
fans out from one origin (level 1: a hemisphere per group; level 3: 1/32 of the sphere — coherent). A probe-major mapping (adjacent lanes =
adjacent probes, same direction) would give parallel rays 2–8 m apart: same control flow, disjoint cells. Neither is obviously better and the
closest-hit share of the cascades is 0.2 ms, so it was left alone; the 0.65 ms of shadow rays at interval hits already converge on light i
at loop step i across lanes.
