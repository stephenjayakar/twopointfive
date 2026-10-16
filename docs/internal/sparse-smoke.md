# Sparse smoke: bricks on one lattice instead of eight boxes

> **10-10, later the same day: THIS IS THE SMOKE SOLVER NOW AND THE BOXES ARE DELETED (§10).** He saw it on his Mac ("big plumes of smoke are sick"), picked "As default", then: "let's just remove the box smoke if this
> is the way we want to do it" · "we can always revive from git history". No switch is left. The last commit with both solvers is 1530281c (the pool there behind `?sparsesmoke`). EVERYTHING BELOW §1 IS THE
> RECORD AS IT WAS WRITTEN, with the prototype's file names and its switch; read `sparse.ts` as `smoke.ts`, `sparse.wgsl` as `smoke.wgsl`, `sparseGrid.ts` as `smokeGrid.ts`, `smoke_sparse_read.wgsl` as `smoke_read.wgsl`,
> `dust_look_sparse.wgsl` as `dust_look.wgsl`, 'Tab ▸ Sparse smoke' as 'Tab ▸ Smoke pool', `?sparsesmoke=N` as `?smokepool=N`, and any "off = today's solver" as history.

> **Summary.** The ask (10-10): "we shied away from adaptive grids to not have smoke domain limits before … explore what's possible here". The answer: no octree and no adaptive
> resolution; the plain thing every shipping tool does (Flow, EmberGen, Houdini sparse pyro, GVDB): 8³-cell BRICKS of today's voxels on ONE level-wide lattice per voxel size, drawn
> from one fixed pool (4096 bricks = the cells the eight boxes hold), a flat page table, everything allocated and freed on the GPU. Built behind `?sparsesmoke` (read once at boot; off =
> today's solver, shader text, layouts and bind groups untouched): same step equation for equation, every reader ported (view march, shadow rays, froxels, the sight-line probe), doors /
> glass / statics / wind in. 17 + 2 × pairs dispatches a step whatever the plume count (boxes: 11 + 2 × pairs EACH). 133.5 MiB against 112 (124 as first benched). Boots 112 / 112 pipelines in headless Chromium on
> SwiftShader with no validation error. **The finding: the box faces were a SINK and the sink was the budget.** One can on the open floor: same plume as the box's for 2 s, then 9.5 m wide at
> 12 s where the box pins it at 3.46, a third more mass in the air, 1825 bricks (3.6 boxes' worth), still growing slowly. The limit becomes total VOLUME and the policy at the ceiling, and
> a can's plume bounds six times the floor: a look AND a gameplay change. **GPU time, the maintainer's Mac, 10-10 (§5, one run a solver, high 734 × 770):** solver ≈ 0.37 ms + 0.45 µs a brick; pool full 2.16 ms and +3.00 ms of union against the eight boxes' 2.83 and +3.68; one can
> left to burn out in the open peaks at 2029 bricks (34 s), 1.31 ms against the box's 0.46, ≈ +1.5 ms of union over the boxes from 26 s on. Under the low end of what was inferred. The LOOK on a GPU is still nobody's verdict.
> **Round two (§9, after his "Finish it", 10-10):** six rules behind the same switch, each a knob, each off = the pool as he benched it. **Timed on his Mac 10-10 16:22Z (§9.7): solver 0.43 ms + 0.39 µs per brick that STEPS; twelve cans 1.66–1.70 ms of solver and +2.2 to +2.6 of union (round one 2.16 / +3.00, the boxes 2.84 / +3.58 with four cans refused); a can late in its burn 0.98–1.05 (1.25–1.31); the hop over clear air bought nothing and now ships OFF; the pool stays 4096.** Counted on SwiftShader before that: calm bricks wait (the same plume to a cell for 46 % fewer brick-steps at 7 s; 25 m from the look-at 67 % fewer for a fifth more
> smoke left hanging; `farCells` ships at 1 after 2 measured +91 %), readers hop clear air (page loads −44 to −53 % where plumes share a bound, every answer identical), fresh smoke first at a dry pool (a can thrown among four burning ones in a full pool: nothing at all first come, 42–50 % of a lone can's smoke at a lone can's peak with the rule),
> can / dust / gun gas known per cell (the two density rows act on smoke in the air, the guards' probe reads the same number), 11 of the 24 box-only rules gone, and gun gas lets go of its bricks (§9.8, found by playing a room clear's opening in the page: 1.7 s on AUTO held two thirds of the pool; a magazine now levels off at 1,457 bricks where it had 2,924 and climbing, and is gone 3 s after the last round). The branch carries the build to play @ fb9ea2a merged under it (9e4c182e, 10-10 16:45Z: the hidden flashlight fix, `?noleakfix`, and its sweep row; HE BENCHED ROUND TWO ONE BUILD EARLIER, on 1756c96, 568a85d8; 665e7c7 before that, cf29126; ff7c827 first, bc588f6). Waiting on him: the look list on the page (four cans at once is the case: the soft ceiling already holds them at ~3,150 bricks where 8192 lets them pass 5,300).
> Page: `docs/review/sparse-smoke.html` (= `rebuild/smoke-grids/smoke-without-boxes.html` in the project folder; history, nine options costed, pictures, the recommendation).

Every number below is SwiftShader (4 cloud cores, headless Chromium, medium = 3 pressure pairs, dt 1/30, densityScale 1, calmCells 0, no wind records) unless it says otherwise. Counts and shapes
carry over to a GPU; milliseconds do not.

## 1. Where things live

| file | what |
| --- | --- |
| `src/smoke/smokeGrid.ts` | the geometry: levels (0 = 0.055 m, 91 × 19 × 64 bricks · 1 = 0.022 m, 228 × 24 × 160), pool cap, atlas / page texture sizes, the WGSL consts; `smokeGridConfig {cap}` (`?smokepool=N`) |
| `src/smoke/smoke.wgsl` | the solver: pool (free list, page table by CAS + LOCK, stamps), mark / alloc / free / link, the step's kernels over the live list, publish / compose / boxes (= the readers' bounds) |
| `src/smoke/smoke.ts` | `SmokeSystem` (emit, push, spawnCanister, clearAll, setWind, obstaclesChanged, stats, binding), packing, the read-back, `measure()` / `profileStep()` for tools; knobs `__smoke.sparse` |
| `src/render/shaders/smoke_read.wgsl` | how every reader reads the smoke, appended to the scene prelude by `frame.ts` (page texture at scene binding 14 + the atlas at 8): `smokeSample`, `smokeOpticalDepth` (a DDA over coarse bricks), `smokeSegment` |
| `src/render/shaders/dust_look.wgsl` | the dust twin's look (§9.4) |
| `tools/qa/sparse-lab.js` | the bench (`__spl.run()`); round two's levers and dry pool (`__spl.round2()`) |
| `tools/qa/sparse-reads.js` | what the readers pay per ray, hopping or not (`__spr.run()`); what a reader is handed at a point (`__spr.at`) |

## 2. The design in ten lines

* A brick exists while smoke is in it or within `ring` CELLS of it (default 4; 8 = all 26 neighbours). Emitters and bricks holding scalar stamp themselves + the neighbours their smoke's bbox (K_BOX) reaches;
  a brick nothing stamped for `keep` (20) steps goes back on the free list. No CPU in the loop; the read-back (three-buffer ring) feeds stats, `inSmokeDomain`, shoves, wind culling only.
* Each live brick carries a 27-neighbour table, so stencils and backtraces cross borders by one indirection and the in-place red / black SOR needs no halo copies (GVDB's 102 vs 9.1 ms trap).
* F_ACT gates the two scalar kernels to bricks the smoke can reach this step. Velocity + pressure run on every live brick (≈ two thirds of a step: §4).
* A missing neighbour is open air: p = 0, velocity 0. The boxes' 6-cell dissipation band exists only at a face whose brick was REFUSED (pool dry) or lies off the lattice (K_OPEN).
* Soft ceiling: from 60 % to 95 % of the pool the flush threshold rises 0.002 → 0.03 and thin smoke decays up to 1.5 /s faster.
* The ceiling BY VIEW (the maintainer, 10-10: "i'd be willing to let quality degrade, especially if we can do it based on where we're looking" · "it'd be nice to not have to worry about this too much"):
  `farOf(level, brick)` = 0 within `viewR` (10 m) of `engine.viewFocus` on the floor plan, 1 from twice that, × `viewBias` (1). A far brick's ceiling starts at half the fill, bites up to 3 × as hard, calls up to 4 × the
  density thin, and `ensureBrick` refuses it the last `VIEW_RESERVE` (¼) of the pool. Bias 0 = one ceiling everywhere, first come first served. The field really is thinner there, for the guards' probe too (one model).
* Fields are f16 pairs in storage buffers (no 3D-texture filtering in the solver's own backtraces: manual trilinear). Readers get an rgba16float ATLAS of 10³ blocks (one-cell apron) + an r32uint page
  texture: one integer load, then the same hardware trilinear fetch. ONE new texture binding per scene shader, no new storage buffer (ReSTIR and the probe already sit at 10 of 10).
* The view marches still want boxes: `boxes` makes ≤ 4 bounds per level on the GPU (tiles of bricks merged). Shadow rays and the probe walk the page texture brick by brick.
* Memory at cap 4096: fields 85,983,232 B · tables 5,092,032 · atlas 32,768,000 · page texture 6,274,560 = 130,117,824 B. `?sparsesmoke=N` sets the cap (256 ‥ 8192).

## 3. One can on the open floor, (20, 0, 14), both solvers

| t s | boxes mass (two runs) | sparse mass | boxes width m | sparse width m | pool | act | with smoke |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2853 · 2973 | 2848 | 1.3 · 1.2 | 1.3 | 106 | 54 | 33 |
| 2 | 6310 · 6962 | 6787 | 2.4 · 1.9 | 2.6 | 246 | 163 | 94 |
| 3 | 8403 · 9875 | 9493 | 3.46 · 2.8 | 4.0 | 402 | 292 | 197 |
| 4 | 9978 · 11328 | 11860 | 3.46 | 5.0 | 614 | 449 | 320 |
| 6 | 12703 · 13301 | 15814 | 3.46 | 7.2 | 1072 | 804 | 591 |
| 8 | 14869 · 15133 | 19170 | 3.46 | 8.6 | 1401 | 1118 | 816 |
| 10 | 16127 · 15985 | 21154 | 3.46 | 9.3 | 1651 | 1310 | 984 |
| 12 | 17268 · 16614 | 22586 | 3.46 | 9.5 | 1825 | 1499 | 1108 |

Mass = Σ density × litres. Plume top at 8 s: 2.61 m against 2.61 / 2.83. The emitter's jet is jittered off the SYSTEM die, so no two runs match; two box runs sit 10 % apart at 2 s, 17 % at 3 s, 2–4 % from 8 s on. ONE sparse run.
**The can is 12 s into a 32 s burn** (`canisterDuration`): its peak was never run here (≈ 1.5 h on SwiftShader); my guess was 2300–3000 bricks. MEASURED on the maintainer's Mac (§5, the bench's `life` row, the game as it ships: vents on,
densityScale 1.3, dt 1/60, 4 pairs): 1090 bricks at 8 s, 1404 at 12 s, 1930 at 24 s, peak 2029 at 34 s, 1883 at 40 s; 1277 of them hold smoke at 32 s against 431 in the box. Under this section's still-air curve all the way (the spot is under vent_aisle).
(Steps 241–249 of the sparse run had the vents' records on by accident, see §6; cleared at 249.)

Histogram at 12 s (1825 bricks): 717 clear air (39 %) · peak density < 0.05: 180 bricks, 0.1 % of the mass · 0.05–0.25: 384, 3.8 % · 0.25–1: 357, 21.8 % · > 1: 187, 74.3 %. Cell fill of the smoke
bricks 0.61. "Thin" is relative: extinction is 6 × density per metre, so 0.25 across one 0.44 m brick already passes only ≈ 0.52.

`ring` 4 against the full ring (8): 9–21 % fewer bricks over the first 5 s (127 / 295 / 509 / 767 / 952 before).

**Thin smoke fades faster, always** (`thinDecay` 1.0, `thinBelow` 0.25, same can): 1057 bricks at 8 s (1401), 26 % fewer at 12 s for 13 % less mass; width 7.5 m at 8 s (8.6). A look call as much as a cost one.

### 3b. Twelve cans in one instant, cap 4096 (the boxes: 8 live, 4 refused)

Spots: (19.75, 17.75) (24.75, 17.75) (14.75, 17.75) (23.75, 8.25) (27.25, 8.25) (29.75, 14.75) (10.25, 18.75) (19.75, 2.25) (23.25, 2.25) (31.75, 17.25) (16.25, 2.25) (29.75, 21.75). A = the build before the view bias, which is what `viewBias` 0 selects (first
come first served), B = `viewBias` 1, `viewR` 6, `viewFocus` on the first can. All twelve live in both, no validation error.

| t s | A mass | A pool / act / smoke | A refusals (cum.) | B mass | B pool / act / smoke | B refusals (cum.) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 35260 | 1156 / 724 / 409 | 0 | 35202 | 1162 / 710 / 397 | 0 |
| 2 | 82683 | 2627 / 1801 / 1082 | 0 | 81358 | 2436 / 1628 / 982 | 0 |
| 2.5 | 101698 | 3339 / 2475 / 1497 | 0 | 96723 | 3178 / 2353 / 1410 | 154 |
| 3 | 117886 | 4096 / 3060 / 1965 | 300 | 108395 | 3527 / 2837 / 1841 | 9988 |
| 3.5 | 130360 | 4095 / 3570 / 2471 | 17844 | 114246 | 3819 / 3120 / 2165 | 41392 |
| 4 | 139277 | 4096 / 3789 / 2869 | 69007 | 117378 | 4059 / 3362 / 2400 | 88122 |

Per can at 4 s (each coarse brick counted to the nearest can on the plan; a LONE can at 4 s = 614 bricks, mass 11860):

| cans | A bricks · mass | B bricks · mass |
| --- | --- | --- |
| 3 within 6 m of the focus | 355 · 11621 | **534 · 11923** |
| 5 at 9–12 m | 333 · 11624 | 291 · 9489 |
| 4 past 12 m | 341 · 11573 | 251 · 8541 |

So first come squeezes every plume alike (a bit over half a lone can's bricks: the air ring and the outskirts go first, mass hardly yet), and the view bias moves the squeeze out of sight: the near three
keep 87 % of a lone can's bricks and all of its mass, the far four lose a quarter of theirs. Not shown by this run: what a camera cut TO a starved plume looks like (it regrows from what is left, nothing pops in).

### 3c. The start of a real room clear (the emit stream of a headless `room-clear-four:1`, 84 emits in 20 s; the first 10 s played back: one stun burst at 19.83, one shot at 23.4)

| mission t | 20 | 21 | 22 | 23 | 23.5 | 24 | 25 | 26 | 27.5 | 29 | 30 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pool | 268 | 433 | 592 | 689 | 941 | 1119 | 1145 | 1239 | 1299 | 1256 | 1232 |
| of it fine-lattice | 0 | 0 | 0 | 0 | 67 | 186 | 249 | 312 | 383 | 406 | 380 |
| with smoke | 108 | 178 | 251 | 285 | 325 | 411 | 466 | 510 | 538 | 519 | 488 |

No refusal. The boxes would hold one coarse + one fine domain for the same two events = 1024 bricks' worth: firefight smoke is roughly EVEN, not the saving I expected (an 18 cm fine brick + its ring of air is a poor fit for a
metre of thin gas). Tracked emitters (the burst's spark trails) were replayed standing still. Stopped at 10 s for wall time.

### 3d. Walls, a door, a vent (one run each, final code)

Can at (32.6, 0, 8.6) in the shut storage room (x 30‥36, z 4‥10, its door in the z = 10 wall): extent max z 9.60 at 1.5 s, then 9.87 at 2 / 2.5 / 3 / 3.5 / 4 s (7 sealers); min x pinned at 30.17 from 3.5 s, top 2.89 later. Leaf set to
−1.4 rad + `place()` at 4 s (6 sealers): max z 10.15 / 10.37 / 10.48 / 10.75 / 11.14 / 11.47 at +0.5 ‥ +3 s. Can at (20, 0, 14) with the vents' records on (3–4 sources reach the solver): top 1.51 / 1.62 m at 2 / 3 s
against 1.68 / 1.95 in still air, width 2.97 against 3.96 m, 284 bricks against 402. Glass not exercised on its own (baked by the same `solidAt`).

## 4. Where a step's time goes (SwiftShader wall per kernel, 73 bricks, `profileStep`)

advectVel 21.7 · curl 14.7 · forces 30.5 · divergence 17.4 · rbgs 13 × 6 · project 22.8 · advectScalars 54.6 · injectDecay 16.3 · publish 16.4 · compose 2.7 · boxes 3.4 ms. ≈ 3 ms per brick-step uncontended.
Only the SHARES mean anything: velocity + pressure ≈ two thirds, which is what half-resolution velocity (Flow 2) would cut.

## 5. Cost on the maintainer's Mac: MEASURED 10-10 (`docs/perf/sparse-lab-{boxes,sparse}-high-mac-1010.json`)

`tools/qa/sparse-lab.js` @ 57b1efb, one fresh boot a solver, 06:52 / 06:53Z: apple metal-3, high, internal 734 × 770 (window 953 × 1000), serialized frames, dt 1/60, the wide view (20 m back over the open plan), nobody on the floor,
cans 3.2 m apart nearest the view's middle, each solver as it stands (boxes: calm / far schedule on; pool: every live brick every frame). `failed` [] and `gpuErrors` [] on both, a solver stamp on 90 / 90 frames of every row. ONE run each.
Timestamps step 0.066 ms. Means of the last 90 frames of 8 s; ∪ = `unionMs`; + = over the same page's no-smoke frame (7.06 boxes, 7.22 pool: a 0.16 gap with nothing in the air, two ticks, unexplained).

| cans | boxes solver | pool solver | boxes ∪ (+) | pool ∪ (+) | pool − boxes ∪ | live |
|---|---|---|---|---|---|---|
| 1 | 0.46 | 0.87 | 8.12 (+1.06) | 8.63 (+1.41) | +0.51 | 1 box · 1058 bricks |
| 4 | 1.68 | 1.73 | 9.65 (+2.59) | 10.03 (+2.81) | +0.38 | 4 · 3139 (past softLo; plumes also share bricks) |
| 8 | 2.83 | 2.05 | 10.74 (+3.68) | 10.13 (+2.91) | −0.61 | 8 · 3886, 53 498 brick requests refused |
| 12 | 2.84 | 2.16 | 10.64 (+3.58) | 10.22 (+3.00) | −0.42 | 8 + 4 CANS REFUSED · 3979, 503 108 refused, all 12 standing |

ONE CAN, 40 s (medians of each 2 s): box solver 0.46 flat, ∪ 7.73 → 8.3–8.5 from 8 s (8.98 at 40). Pool solver 0.33 (2 s) · 0.85 (8) · 0.98 (12) · 1.18 (20) · 1.25 (24–32) · 1.31 (34–38); ∪ 7.47 · 8.72 · 9.24 · 9.57 · 9.76–9.90 · 9.90–10.22, 10.49 at 40.
Pool − box ∪: −0.26 at 2 s, 0 at 4–6, +0.4 at 8, +0.9 at 12, +1.1 at 16–22, +1.4‥1.7 from 26. At 32 s the +1.45 is 0.79 solver + ≈ 0.5 readers + the 0.13 no-smoke gap. No brick refused. Both ∪ creep up after the can stops (unexplained, both solvers).
FIT over the 4 rows + 20 life samples (a life sample's bricks taken mid-window): **0.37 ms + 0.45 µs × bricks**, worst miss 0.09; it overshoots the small end (0.33 at ≈ 110–220 bricks), so the fixed part is nearer 0.3. All in 0.54 µs a brick at a full pool
against the boxes' 0.9 (one) / ≈ 0.8 (eight, 7 box-steps a frame). PARTS (`split`, 4 cans, 3125 bricks, 1.77 ms): alloc 0.13 · velocity 0.46 · pressure 0.66 · scalars 0.39 · publish 0.13 → velocity + pressure 63 %, bookkeeping 15 %.
DIRECT dispatch (`indirect` false, 4 cans, 3137 bricks): solver 1.59 against 1.73, ∪ 9.75 against 10.03; only measured at a pool ¾ full (few bricks: the whole pool's workgroups launch idle — switch by fill).
READERS by subtraction (+∪ − solver; passes overlap, rough): boxes 0.60 / 0.91 / 0.85 / 0.74 at 1 / 4 / 8 / 12 cans, pool 0.54 / 1.08 / 0.86 / 0.84; one can at 16 s 0.85 against 1.12, at 32 s 0.91 against 1.44. Same price at the same age; dearer only
once the plume is well past a box. PER-PASS medians are not to be read closely: direct +0.5–0.6 on the pool with smoke up, gather −0.2‥−0.6, but 'rc c2' reads 2.5 on one page and 0.39 on the other for the same work (overlap; the performance goal saw it in his F9 takes).
CROSS-CHECK: the boxes' 0.46 / 1.68 / 2.83 here = smoke-perf.md §5a's 0.46 / 1.57 / 2.88 (M4 Max, Aug, high, 8 s in); its readers at 1368 × 770 were 0.72 / 1.18 (1 / 8 cans) against 0.60 / 0.85 here at 0.54 × the pixels: the reading half grows mildly with the window.
NOT COVERED: a second take, a wide window, ultra, a camera inside a plume, a walled room, a pool other than 4096 (8192 by the fit ≈ 4 ms full, ≈ 250 MB), any lever, and the look.

### 5b. What had been inferred before the bench (kept for the record: every line came in high)

Boxes, his F9 take of 10-10, high 1284 × 770: solver 0.61 ms one cloud, 2.89 ms eight (two of them on alternate frames) → 0.7–0.8 µs per brick-step, with calm stepping on and boxes not full; smoke-perf.md §1b's
mature plume is 0.50 ms per box step = 0.98 (M4 Max, Aug) and the pool's bricks are the full kind, so 0.7–1.0. × 1.0–1.7 for sparse addressing (DCGrid's worst case 1.71: a yardstick, not a bound, their structure is not ours).
+ 0.25–0.45 ms fixed for 25 serial dispatches and Dawn's 18 validation dispatches (18 of the 25 are indirect at 4 pairs). → 246 bricks 0.4–0.9 ms · 1401: 1.2–2.8 · 1825: 1.5–3.6 · 4096: 3.1–7.4. (Both per-brick figures carry
the boxes' own dispatch overhead inside them, so the low end may be a touch high.) The READERS cannot be scaled from here: smoke-perf.md §5a's staged A/B, 'exact' column (what shipped; the solver's own time from the 'before' column, the trim does not touch it), has them at 0.72 of the 1.18 ms one cloud adds and 1.18 of the 4.06 eight add;
his Mac's clouds table is different moments and views ("an observation, not an A/B"), so no split is read out of it (an earlier draft did: wrong). The free plume's bounding box covers ≈ 6 × the floor.
Levers, in the order I would try them: calm stepping per region (−37 % on hanging plumes at the shipped calmCells 0.5, smoke-perf.md §3.1, M4 Max; nothing while a source runs) · brick skipping in the view march, per-bound intervals for
shadow rays · half-res velocity + pressure (≈ 0.45 × by the measured 63 % share, a LOOK risk) · direct dispatch when the pool is busy (−0.14 ms measured) · `thinDecay` · an 11 cm level for old thin smoke · retuning the can, whose output was tuned against walls that ate the excess.

## 6. Mistakes worth not repeating

* **"The boxes invent mass through residual divergence"** was my first reading of a 25 % mass gap at 1 s. Wrong: the boxes at 16 pressure pairs gave the same mass. The boxes clamp a sample point to half a cell
  above their floor (`atlasUVW`); the pool read zero under the lattice. `aboveFloor` in both samplers (+ the atlas apron) closed it to ~1 %.
* **A page that has rendered one frame has WIND.** `?paused` + `stepAlone` loops never run `Wind.update`, so a fresh page steps still air; after any `__runFrames` (a still) the last records stay set, and (20, 0, 14) is
  right under `vent_aisle`. A box run after a still came out a third lighter and half as tall and I first took it for run-to-run spread. `smoke.setWind([], 3)` before a solver-only run.
* `GpuTimer` drops any pass over 1000 ms, so 'smoke', direct and gather are missing from `lastFrame` on SwiftShader. Not a bug of the bench.

## 7. Reviews (two, independent, read-only) and what is left

(The by-view ceiling went in AFTER both: it has run, §3b, but nobody else has read it. A third reader went over the page's claims against the runs and this file; its corrections are in §3 and §5.)

Kernels, readers, layouts and the off path were traced and found right (no race, no out-of-bounds, no lost smoke). Fixed from them: the pool judged empty by the ABSENCE of read-backs (smoke vanished 12 steps after
the last emitter inside a synchronous `__runFrames(n)`); wind sources packed first-come instead of nearest the smoke; a read-back from before `clearAll` believed; a shove doubled by overlapping bounds; the atlas
apron zero under the floor; the cap clamped to 8192 (the velocity buffer against `maxStorageBufferBindingSize`); `stats.live` in boxes' worth of pool so destruction's six-domain dust rule still bites; the sealers'
block re-uploaded on a reset; the storm's bit kept off bricks wholly indoors; the bench's solver test surviving a minified build.

LEFT, by design or for later (AS OF ROUND ONE: §9 has since done the first, the second's waste, the third and most of the fourth):
* **No priority at a dry pool**: bricks go first come, first served, so a can thrown into a firefight's dust may be refused where the boxes would evict a lower-priority domain. Wants a reserve for prio 2.
* **The view march walks bounds**, ≤ 4 per level: merged bounds over ~9 m under-sample (112 steps a stretch, 160 a ray) and shortlist lights for the whole stretch; the probe and shadow rays integrate exactly, so under
  scattered smoke the picture and the AI can disagree. Shadow rays walk the HULL of all bounds (up to ~170 page loads through clear air between far-apart plumes).
* `densityScale` / `fxDensityScale` are laid in at EMISSION: the solver sees 1.3 × density and the Tab rows no longer act on smoke in the air.
* Dust look off (`binding.dusty` never set, tint per domain has no home); `calmCells`, `fullRateDomains`, `pressureHalf`, `brickSkip`, the voxel sliders are ignored; `flushEps` floored at 0.002.
* A tracked wisp lays smoke along its whole path (the boxes dropped it at the face). Shoves are tested against loose bounds and capped at 20.
* Pool pressure makes the winner of the last slots a matter of GPU scheduling: two boots stop being bit-identical there.
* The packing / envelope / sealer code is COPIED from smoke.ts, `solidAt` from bakeObstacles, `windForceM` from windForce: a tuning fix lands in one solver only. The reader swap slices common.wgsl between two comment
  headings. `as unknown as SmokeSystem` in main.ts. All fine for a prototype, all to be undone if it is taken forward.
* Every identity gate that hashes the boxes' output is red by construction with the switch on.

## 8. Driving it

No flag: every page runs it (`?smokepool=N` or the old `?sparsesmoke=N` sizes the pool, 256‥8192). `__smoke.stats` (pool, stepped, work, thin, act, bricksScalar, bricksRender, free, failedTotal, peak, boxes, fine, eps), `__smoke.sparse` {keep, ring, flushEps, thinDecay, thinBelow, softLo, softHi, softEps,
softDecay, viewBias, viewR, indirect (false = dispatch the whole pool: A/B of Dawn's validation dispatch per indirect call), split (the step's five parts timed apart), and round two's calmMax, farCells, directAt, readSkip, fresh: §9}, `await __smoke.measure()` (mass / centroid / extent per level),
`await __smoke.profileStep(dt)`. Bench: a fresh boot of `/?paused&quality=high&mute`, `await import('/qa/sparse-lab.js'); await __spl.run()` → 1 / 4 / 8 / 12 cans, 8 s each, the last 90 serialized
frames timed: solver, union, every pass, bricks, refusals; then `life`: one can for 40 s, a sample every 2 s; two more rows of 4 cans (`split` = the step's five parts timed apart, `indirect` false); a JSON file downloads. A part that throws is named under `failed` and the file still carries the rest; `gpuErrors` = the device's uncaptured errors.

## 9. Round two (10-10, after "Finish it"): six rules, each a knob, each off = the pool as §5 benched it (3781d45)

`__smoke.sparse` {calmMax 4, farCells 1, directAt 0.5, readSkip false (true until his Mac's take: §9.7), fresh 0.15, fineDecay 3, fineShare 0.25} + Tab ▸ Volumetrics ▸ Sparse smoke; `__spl.asBenched()` = {1, 0, 2, false, 0, 0, 1}. They ship ON inside the prototype (all but the hop): he asked for it finished and
will judge it as it stands. GPU time: §9.7, his Mac. The numbers in §9.1–9.6 and 9.8: SwiftShader, solver-only loops, still air, seeded jitter.

### 9.1 Who steps (`calmMax`, `params.calmCells`, `farCells`, `dtCap`, `directAt`)
The boxes' two schedules (a calm domain every p-th frame, far domains on alternate frames) per BRICK, so a plume's slow skirts wait while its jet steps. `buildList`: a brick's wish p ∈ {1, 2, 4} = the longest wait in which its fastest
air (K_VMAX) crosses ≤ `calmCells` cells (mixed toward `farCells` by `farOf`, the by-view ceiling's own measure) and p × dt ≤ `dtCap` (1/12 s); it takes the SHORTEST wish of its 27 neighbours; columns step together and 4 × 4-brick
plan tiles take turns, so a frame's work is level. A stepping brick integrates what it sat out (K_DT). A source wakes every brick it reaches each frame of its life, and a woken brick steps one frame (what it was owed is let go). Pressure
is stored per unit time; a stepping brick reads a waiting neighbour's velocity where that one left it (`ldVadv`). A waiting brick's fields, flags, neighbour table and atlas block stand. All step kernels run over M_STEP (its count in
the second indirect record); `markNbr` and `freeIdle` still see every live brick. `keep` is floored at 8 steps while bricks may wait. `directAt`: from that share of the pool STEPPING the whole pool is dispatched directly (§5: −0.14 ms at 3,100 bricks).

On the fixed code (efbc4d7; one can burning 2 s at (20, 0, 14), seed 1, dt 1/60, verylow, look-at on the can; A = calmMax 1, B = calmMax 4 (`farOf` is 0 within `viewR` 10 m of the look-at, so `farCells` plays no part in B); no GPU error, nothing refused either way; `drv/calm.js`-style loop: `update` + `stepAlone`, `measure()` every half second):

| t s | mass A / B | peak density A / B | bricks A / B | B stepping | brick-steps per half second A → B |
| --- | --- | --- | --- | --- | --- |
| 2 | 4846 / 4846 | 41.50 / 41.53 | 229 / 229 | 221 | 5,712 → 5,533 (−3 %) |
| 3 | 3050 / 3050 | 3.86 / 3.86 | 413 / 413 | 395 | 10,476 → 10,265 (−2 %) |
| 4 | 2112 / 2113 | 1.44 / 1.44 | 540 / 540 | 476 | 15,809 → 14,447 (−9 %) |
| 5 | 1522 / 1526 | 0.52 / 0.51 | 624 / 632 | 480 | 18,301 → 15,004 (−18 %) |
| 6 | 1121 / 1137 | 0.28 / 0.29 | 682 / 685 | 440 | 20,408 → 13,628 (−33 %) |
| 7 | 843 / 876 | 0.20 / 0.20 | 717 / 730 | 367 | 21,084 → 11,455 (−46 %) |

Extent agrees to a cell at every sample (7 s: x 16.91‥24.01, y 0.03‥1.73, z 11.52‥16.86 against ‥16.91), centroid to 1 cm. It is a rule for smoke that HANGS: while the can burns and for two seconds after it saves 1–9 %. MASS DRIFTS UP: +0.3 % at 5 s, +1.4 % at 6, +3.9 % at 7, and growing. Time is
not being lost (K_ACC carries what a brick sat out, the decay is an exponential of K_DT, and 4 frames at 1/60 is under dtCap). Read, not proven: the step itself loses mass (semi-Lagrangian carry smears thin smoke under `flushEps`, which zeroes it), so a brick that steps half as often loses less. The excess is all in the thin skirts (the peak
is the same). HOW BIG THAT IS: the same can thrown on another roll of the emitter's noise (A2: calmMax 1, the solver's clock 7 s on, nothing else changed) ends at 7 s with mass 981 (+16 % on A), 4.95 × 4.34 m against 7.10 × 5.34, top 2.67 m against 1.73, 656 bricks against 717. So B is far nearer to A than two throws are to each other. The rates say the same thing about the cause: authored `densDecay` is 0.14 /s; measured 5 → 7 s, A loses 0.295 /s, B 0.278, C1 0.240, C2 0.195, so about half of A's loss is the step's own and it scales with how often a brick steps. A side effect worth knowing, inferred from that and true of the boxes as well: how long thin smoke hangs depends on the frame rate.

**Far from the look-at** (same can, same roll: `s.time` put back to 0 so the emitter's noise is A's; look-at 25 m off at (45, 0, 14); C1 = `farCells` 1, C2 = `farCells` 2; all four runs identical to 0.1 % while the can burns):

| t s | mass A / C1 / C2 | peak A / C1 / C2 | bricks A / C1 / C2 | brick-steps per half second A → C1 → C2 |
| --- | --- | --- | --- | --- |
| 2 | 4846 / 4846 / 4843 | 41.50 / 41.63 / 41.53 | 229 / 229 / 232 | 5,712 → 4,783 (−16 %) → 3,714 (−35 %) |
| 3 | 3050 / 3051 / 3642 | 3.86 / 3.87 / 5.53 | 413 / 413 / 392 | 10,476 → 8,702 (−17 %) → 4,465 (−57 %) |
| 4 | 2112 / 2188 / 2870 | 1.44 / 1.42 / 1.65 | 540 / 546 / 558 | 15,809 → 9,002 (−43 %) → 5,228 (−67 %) |
| 5 | 1522 / 1663 / 2376 | 0.52 / 0.58 / 0.80 | 624 / 645 / 692 | 18,301 → 7,945 (−57 %) → 5,128 (−72 %) |
| 6 | 1121 / 1295 / 1962 | 0.28 / 0.31 / 0.44 | 682 / 718 / 756 | 20,408 → 7,518 (−63 %) → 5,600 (−73 %) |
| 7 | 843 / 1030 / 1609 | 0.20 / 0.21 / 0.31 | 717 / 798 / 841 | 21,084 → 7,042 (−67 %) → 6,240 (−70 %) |

Over the seven seconds: A 178,038 brick-steps, B 139,310 (−22 %), C1 91,133 (−49 %), C2 62,067 (−65 %). Footprint at 7 s: A 7.10 × 5.34 m, top 1.73; C1 7.09 × 5.61, 1.73; C2 7.48 × 5.44, 1.95. **`farCells` SHIPS AT 1, not the 2 it was built with:** at 2 the far cloud keeps its shape but hangs nearly twice as thick at 7 s (+91 % mass, +55 % peak) and holds 17 % more
bricks, which is pool, and it is the field far guards see through; at 1 it is +22 % mass (about one roll of the dice), the same peak, +11 % bricks, and from 5 s on it has four fifths or more of 2's saving. What 2 buys over 1 is the two seconds after the burn, when the air is fast. The row goes to 4 for whoever wants it. (The default moved after efbc4d7's review;
C1 is that value through the same uniform. An earlier far run, r2-C, was on another roll and is not used.)

### 9.2 Reads hop over clear air (`readSkip`)
`compose` also writes one word per MACRO cell (4 × 2 × 4 coarse bricks: a bit per brick with something to fetch, coarse or fine) into the page texture's last rows. Shadow rays and the probe (`smokeOpticalDepth`'s DDA) leave an empty macro cell
in one hop and skip the empty bricks of a part-filled one off its word; the two lit marches (frame.ts `sparseMarchText`) ask `smokeClearRun` only after a sample that read 0 WITH no page entry (`spgHole`) and drop the steps that fall in
clear air (same lattice of samples: the ones kept are the ones that would have been taken); the froxel inject asks `smokeAnyIn` for its cell before sampling. Same samples, so same answers: the tool holds the difference at exactly 0.

`tools/qa/sparse-reads.js` (`__spr.run()`: the page's own reader text with a counter on every page load and atlas fetch, the same rays walked both ways). On the fixed code (efbc4d7), [asking everywhere → hopping], per ray that met the bounds:

| scene | rays | page loads | atlas fetches | march turns | worst difference |
| --- | --- | --- | --- | --- | --- |
| two cans 6.7 m apart, 976 bricks in ONE bound 11 × 2.2 × 8.4 m (pool 8192) | shadow: 5,909, 2,157 met the bounds, 333 met smoke | 11.73 → 5.57 (−53 %) | 2.98 → 2.98 | | 0 |
| | view: 3,721, 1,384 met the bounds, 297 met smoke | 25.30 → 14.11 (−44 %) | 7.29 → 7.29 | 25.47 → 10.87 (−57 %) | 0 |
| one tight cloud (pool 1024, §9.4's staging) | shadow: 5,977, 484 met the bounds, 127 met smoke | 6.25 → 6.34 (+1 %) | 4.85 → 4.85 | | 0 |
| | view: 3,721, 522 met the bounds, 185 met smoke | 21.32 → 19.22 (−10 %) | 14.26 → 14.26 | 19.81 → 15.83 (−20 %) | 0 |

So it pays where a bound holds air (plumes apart sharing a bound, a plume's ragged edge) and is a wash on one cloud that fills its bound. The fetches that cost most (the atlas) do not move: they were already only taken where there is smoke. The take before the fixes read 11.31 → 6.29 and 25.05 → 19.05 / 25.23 → 10.99 on the same two cans: the `spgHole` hint is the view march's extra five loads.
**VERDICT ON A GPU (§9.7): no time saved; ships off.** Fewer page loads is not less time where the page texture sits in cache, and the hop's own tests are paid on every ray.

THE DRAWN FRAME (efbc4d7, verylow 640 × 360, the two cans at 3.3 s = 838 bricks in one bound, field frozen, the hop flipped straight in the readers' uniform between consecutive rendered frames; mean absolute difference of 8-bit channels / worst channel / channels over 8): four pairs with the switch NOT moved 1.645–1.665 / 19–41 / 27–528; three pairs across a flip 1.648–1.652 / 20–36 / 83–114. A flip is inside the frame-to-frame noise floor on all three; no GPU error. (The take before the fixes read 1.67–1.89 both ways.)

### 9.3 Who gives way at a dry pool (`fresh`)
Stateless, on the pool's fill alone (sparse.wgsl "WHO GIVES WAY"): `tight` goes 0 → 1 over the last 2 × fresh of the pool. With it (1) what counts as thin rises from `thinBelow` to 16 × it, so the soft ceiling's decay reaches further into old
plumes; (2) a brick asked for by smoke under that bar is refused while fewer than fresh × CAP slots are free (`standing(dmax)`: sources and dense smoke stand at 1); (3) thin smoke keeps less air (`ringOf`, down to one cell) and an idle brick
is held less long. Nothing is evicted, nothing has a priority number, game code counts nothing. Density stands in for age: smoke only thins as it spreads.

On the fixed code (efbc4d7; pool 1024, dt 1/30, four cans 3.2 m apart round the look-at and STILL BURNING, a fifth thrown between them at 6 s; `drv/dry.js`; "in" = within 1.6 m of the new can; the lone can is the same can in a clean pool; no GPU error in any run):

| s after the throw | smoke in: lone | `fresh` 0.15 | `fresh` 0 | bricks in: lone / 0.15 / 0 | all smoke in the pool: 0.15 / 0 |
| --- | --- | --- | --- | --- | --- |
| 1 | 2,478 | 1,750 (71 %) | 0 | / 32 / 1 | 30,324 / 49,630 |
| 2 | 6,526 | 3,231 (50 %) | 0 | / 47 / 1 | 32,463 / 50,732 |
| 3 | 9,477 | 4,280 (45 %) | 0 | / 70 / 1 | 33,406 / 51,017 |
| 4 | 11,611 | 4,891 (42 %) | 0 | 245 / 86 / 1 | 33,655 / 49,983 |

First come, the fifth can gets ONE brick and no smoke at all in four seconds: it does not exist. With the rule it stands up at a lone can's peak density (52.8 against 50.5 at 4 s) in a third of the bricks and holds 42–50 % of a lone can's smoke from 1.5 s on; the pool sits at 1020–1023 of 1024 with 0–3 free throughout, so every brick it gets is one the old
plumes' skirts gave back. What pays: the four old plumes together carry a third less (≈ 33,000 against ≈ 50,000), the rule already leaning on them before the throw (28,575 against 48,669 at 6 s). This is the stiff case on purpose: a pool a quarter of the shipped size and four rivals that are dense, live sources, not haze.

**Against haze** (the merged tree with `farCells` 1; the same staging but the four old cans burn 5 s and the fifth is thrown at 8 s, so what fills the pool has been hanging for three; no GPU error):

| s after the throw | smoke in: lone | `fresh` 0.15 | `fresh` 0 | bricks in: lone / 0.15 / 0 | pool, free: 0.15 / 0 |
| --- | --- | --- | --- | --- | --- |
| 1 | 2,478 | 2,857 (115 %) | 11 (0 %) | 80 / 100 / 4 | 632, 392 / 1023, 1 |
| 2 | 6,526 | 6,691 (103 %) | 979 (15 %) | 188 / 189 / 16 | 647, 377 / 1023, 1 |
| 3 | 9,477 | 9,504 (100 %) | 2,436 (26 %) | 229 / 240 / 48 | 658, 366 / 1012, 12 |
| 4 | 11,611 | 11,564 (100 %) | 6,415 (55 %) | 245 / 283 / 176 | 731, 293 / 556, 468 |

With the rule the new can is a lone can (the lone run's samples are a tenth of a second younger, which is the 115 %). First come it has nothing for a second and a quarter of its smoke at three. THE PRICE, and it is not small: with the pool full the old smoke goes FAST once its cans stop. All smoke in the pool, every half second from 4.5 s: 28,486 · 22,482 (the cans stop) · 14,220 · 7,262 · 2,824 · 935 · 267 · 49 with the rule, against 45,325 · 41,220 · 33,140 · 25,761 · 19,948 ·
15,403 · 11,602 · 8,609 first come (the soft ceiling alone). No step in either series, so nothing pops by this measure, but four cans' smoke is gone three seconds after they stop where first come leaves a fifth. It also overshoots: the bar follows the pool's fill, bricks come back only once they are empty and `keep` has run, so by the throw 209 slots are free and only 197 of 815 bricks
hold smoke. That is a pool overloaded four times over (four cans in 1024 = sixteen in the shipped 4096); under the last 30 % of the pool the rule does nothing. `fresh` scales it (0.15 → 0.08 halves the band it acts in); whether the fade reads as smoke clearing or as smoke being taken away is his to see (look list, third row).

### 9.4 What is in a cell (`densityScale`, `fxDensityScale`, dust)
One K word per coarse cell (8 MiB at 4096): share of the density that is not canister smoke, and 1 − tint averaged over all of it. Carried along the density's own backtrace weighted by density, mixed with what a source deposits, never decayed; a brick
with only canister smoke in and round it does none of it (F_KINDS). The solver now holds RAW density (the thresholds see what the boxes' did); `publish` writes the atlas texel (raw × mix(can row, fx row, share), that × (1 − tint) rgb), so every reader,
the guards' probe among them, takes the same `.x`, and the two Tab rows act on smoke in the air (`refreshDomains` → `publishAll`, on a frozen field too). The volumetric dust twin compiles `dust_look_sparse.wgsl`: dust_look.wgsl's veil × soft × billow
shaping with no box rim, weighted by how much of the cell is tinted (`DUST_FULL_AT`), tint off the texel. `binding.dusty` = any brick tinted (C_TINT). The fine lattice holds neither cans nor dust: no words.

On the fixed code (pool 1024, medium; a can, drywall dust, wood dust and gun gas drifting into each other; `__spr.at` = what a reader is handed; the take before the fixes read the same to the digit): 4,472 sampled cells with smoke: 1,806 plain, 596 at the drywall tint, 632 at the wood tint, 1,438 in between. Along the can → drywall line the
tint goes (1, 1, 1) in the can's core → (0.902, 0.871, 0.812) in the dust (authored 0.9, 0.87, 0.81); can → wood ends at (0.78, 0.678, 0.541) (authored 0.78, 0.68, 0.54). Rows on smoke in the air, drawn density after ÷ before, median: can row × 2 = 1.993 on plain cells, 1.001 on dust;
fx row × 2 = 0.998 and 1.988; both back = 0.992 and 0.997 (the field was stepping between the reads). On a FROZEN field (`params.frozen`, `refreshDomains`, one frame), 1,613 plain and 1,181 dusty cells, median: can row × 2 = 2 and 1, fx row × 2 = 1 and 2, both back = exactly 1 in every cell. 118 bricks tinted of 578, `binding.dusty` true, no GPU error. THE GUARDS' PROBE, asked through `Game.sensors.askSegment` on a frozen can (ten lines at different offsets, `drv/probe.js`): the three lines with a readable depth (τ 0.63, 2.73, 2.99 at the shipped 1.3) read exactly 2 × τ with the can row doubled and exactly τ again with it back; every other line squares its transmittance the same way; a line 8 m off reads 1. The look itself (grit, how pale) cannot be judged on this rig: the stills are 640 × 360 and noisy.

### 9.5 Box-only rules (consumers.md §3.4's 24)
`SmokeSystemLike.unbounded` (types.ts) is the one fact game code asks. Off under it: destruction's six-domain dust gate (1, 2). Ignored by the pool: anchors (3), `fullRateDomains` (24: §9.1 takes its place), reader rules 20–23. Done by §9.4: 17, 18. Prewarm's can moved
onto the lattice (19). LEFT as they are, on purpose: the emitter caps (4) and effects.ts's fit-one-box numbers (6–11) are authored data, his to retune by eye; the bullet wake's `inSmokeDomain` (5) is still a useful cull; 12–16 are comments or his earlier calls.
`stats.live` (pool ÷ 512) now feeds the F9 recorder's column and nothing else. HUD row and Tab section say bricks. Seen in the page (SwiftShader, pool 1024): `unbounded` true; HUD row `smoke      587/1024 bricks · 520 stepped · 0 em · 22 disp`; Tab search 'sparse' → 'Volumetrics ▸ Sparse smoke', its summary and text row in bricks, a note naming the box rows that do nothing, ten knob rows. HEADLESS, SWITCH OFF (there is no smoke solver headless: this holds the one clause in destruction.ts and the panel): on efbc4d7 `gate.sh destruction weapons` = destruction ALL PASS (10 probes, 25 checks), weapons 30 probes, 85 PASS / 1 FAIL = `teams-identity`, an EXPECTED RED from before this branch, 0 NEW RED; on the merged tree with `farCells` 1: `probes.ts destruction` (10), `squadsmoke` (4), `weather-smoke`, `fog-smoke`, `panel-inventory`, `frame-layout` and `dice-check.ts` ALL PASS, `tsc` clean. IN THE PAGE, merged tree: `?sparsesmoke` boots 112 / 112, the switch off 107 / 107 with `SmokeSystem`, no error either way. AGAIN ON THE SECOND MERGE (cf29126 = the branch + the build to play @ 665e7c7; three files auto-merged, no conflict): `tsc` clean, the four sparse text swaps still find their sites, the same seven headless checks ALL PASS, the page boots 112 / 112 with the switch and 107 / 107 without, and with the switch a can thrown at Sam's feet and 24 frames drawn: `SparseSmokeSystem`, 48 bricks stepping, no GPU error. AND ON THE THIRD (568a85d8 = the branch + the build to play @ 1756c96: two quiet pair levels, Training's seven lessons, the 2010s look, Sam's suit; 93 files, no conflict; of the files this branch also touches only CLAUDE.md, src/main.ts and src/ui/bindings.ts moved, all auto-merged): the same list again with the same answers — `tsc` clean, the four text swaps land, the seven headless checks ALL PASS, 112 / 112 and 107 / 107, a can thrown and 24 frames drawn with the switch: `SparseSmokeSystem`, 48 bricks stepping, no GPU error; the same can without it: `SmokeSystem`, one domain live, no GPU error. The Tab section has twelve knob rows since §9.8. THE OPENING OF A ROOM CLEAR WITH FOUR, PLAYED IN THE PAGE (`?sparsesmoke&roomclear&squad4`, bc588f6, SwiftShader, verylow 192 × 108, 221 drawn frames at 1/30: Sam throws a can, gives the squad an order, draws the rifle, goes to AUTO and holds the trigger 1.7 s into a wall = 17 rounds, then 3 s more): no GPU error, no console error, the scenario live to the end, 14 dust puffs raised and 3 held back by the per-second cap. AND IT FOUND SOMETHING: the pool went 91 → 1,363 → 2,661 → 3,449 bricks over those 1.7 s, peaked at 3,555 of 4,096, refused 39,411 brick requests, and 3 s after the last round still held 3,280. Nearly all of that is gun gas: §9.8.

**The camera and the game's seat.** `farOf` (sparse.wgsl) is the ONE place "where he is looking" enters: distance on the plan from `engine.viewFocus`, which `engine.render` writes from the HOST's camera each drawn frame. Three rules read it: the by-view ceiling (`viewBias`, round
one), `farCells` and the far side of `fresh`. None of it is inside a tick: the solver steps per drawn frame on the host's side, as the boxes do, and the boxes' own `fullRateDomains` ranks by the same `viewFocus` (smoke.ts). No game code reads a knob of the pool (only `unbounded`), and the
guards still take smoke through `Game.sensors`, so an F10 recording carries what they read and headless nothing changes (no smoke there). WHAT IS NEW: the boxes' far rule only made far smoke a frame older; these rules change what far smoke IS (§9.1: a far can's cloud holds a fifth more smoke at 7 s), and the
men read that field. So where the host's camera looks now leans on what a far guard sees through. One player, one camera: the picture and the AI still share one field, by design. For two seats `farOf` wants the nearest of N foci, and a server with no picture wants none (`viewBias` 0, `farCells` 0 = every
rule by fill alone): one function and one uniform row to change, nothing in src/game.

**Files of other owners this branch touches** (whole branch against its base; for a FINAL, if there ever is one). Owners as the lead's notes have them; blank = none listed.

| file | what | owner |
| --- | --- | --- |
| src/game/destruction.ts | one clause: `!g.smoke.unbounded &&` in front of the six-domain dust gate | destruction |
| src/smoke/types.ts | `unbounded?: boolean` on SmokeSystemLike | |
| src/ui/bindings.ts | the Sparse smoke section (only built under the switch) | shared, no owner |
| src/main.ts | the switch read at boot, the solver picked, the HUD row | |
| src/engine.ts | the scene group's binding 14 under the switch | |
| src/render/frame.ts | the five `sparse*Text` swaps, the layout's binding 14 | |
| src/render/passes.ts, froxels.ts, probe.ts | each reader's text through its swap | passes.ts shared |
| CLAUDE.md | one bullet | shared |

Everything else is new files (src/smoke/sparse*, two shaders, two tools, docs).

### 9.6 The review of round two (one pass, 15 findings; all but the last two fixed in efbc4d7, which every number above is from unless it says otherwise)
A haze request could hold a page entry's LOCK, refuse itself and lose a dense request's brick for that step (asked before the lock now) · a woken brick integrated up to four owed frames of a source's jet · `curl` read a waiting neighbour's stale advected
velocity · p × dt could pass `dtCap` and the excess was dropped (dt 1/30, p 4: 38 % of the time owed; it showed as +3 % mass at 10 s in the first A/B) · `refreshDomains` was a no-op, so rows did nothing on a frozen field · softLo could pass softHi · a lost text-patch site threw at
boot (now one console error, that reader unpatched) · panel rows showing values the solver floors · the hop asking the page after every zero sample · three copies of the page / atlas lookup. Accepted: the levers default on; a small window remains at the refusal bar (two requests inside one dispatch).

### 9.7 The round-two bench and pool size
`/?paused&quality=high&mute&sparsesmoke` → `await import('/qa/sparse-lab.js'); await __spl.round2()`: five standing scenes (a hanging plume · four burning · twelve = the pool full · four cans 25 m from the look-at · the camera 5 m off), on each the levers that bear on it flipped IN PLACE,
3 rounds × 30 serialized frames a side, interleaved, + 'all three' (calm + far, reads, dispatch together); then the dry pool (a thirteenth can into twelve, with `fresh`, without, and alone). File `twopointsix-sparse-lab2-<pool>-<preset>.json`. Same again at `&sparsesmoke=8192`, and `run()` there, says what a bigger pool costs. DRY RUN of the tool itself (SwiftShader, pool 8192, verylow, `round2({ k: 0.005, rounds: 1, n: 1, settle: 1, scenes: [0, 3] })`: two of the five scenes, every lead cut to half a percent, one frame a side, all three dry-pool parts; 44 minutes of wall): 'round two done, nothing failed', no GPU error, every lever row and all 3 × 5 dry rows filled. It proves the script runs end to end, nothing about cost. It turned up one thing: `measure()` on a pool just cleared with nothing emitting read the OLD brick list (the GPU-side reset waits for the next step), so the 'alone' part's `before.mass` was stale; `measure()` now answers empty there.
Memory: 23,040 B of fields + 8,000 B of atlas a brick; `memory()` at 4096 says 133.5 MiB (fields 90, atlas 31.25, page texture 7.4, tables 4.9; 124 as first benched, before the K words' 8 and the step lists); `?sparsesmoke=8192` boots 112 / 112 on SwiftShader with no validation error and `memory()` there says 255.5 MiB (fields 180, atlas 62.5, page texture 7.4, tables 5.6). By §5's fit a full 8192 is ≈ 4 ms of solver before §9.1 (inferred). `run()` ITSELF, DRY, ON THE SECOND MERGE (acdb2c6, SwiftShader, verylow, two cans, two frames a take, a four-frame life): `?sparsesmoke=8192` and the switch off (today's boxes) both 'nothing failed', no GPU error, every row filled, the two extras on the pool. LEAN (before the bench): stay at 4096: its worst case is under the boxes', and §9.3 is what makes a full pool bearable.

**ON HIS MAC (10-10 16:22–16:26Z; apple metal-3, high; files `docs/perf/sparse-lab2-4096-high-mac-1010.json`, `sparse-lab2-8192-high-mac-1010.json`, `sparse-lab-sparse8192-high-mac-1010.json`; branch @ 7d000832).** No part failed, no GPU error. THE WINDOWS DIFFER: the 4096 page ran 734 × 770 internal (round one's), both 8192 runs 789 × 770, so on against off is read inside one page and anything across pages says so. A pair = 3 rounds × 30 frames a side on the same smoke; under ~0.1 ms is scatter. [4096 page / 8192 page], solver off → on, then union saved:

| rule | scene | solver, ms | union saved, ms |
| --- | --- | --- | --- |
| `calmMax` 4 against 1 | one can burnt out, hanging | 0.92 → 0.54 / 0.92 → 0.54 | 0.30 / 0.19 |
| | four cans 25 m from the look-at | 1.25 → 1.08 / 1.81 → 1.38 | 0.14 / 0.44 |
| | one can burning, camera 5 m off | 1.00 → 0.89 / 1.06 → 0.91 | 0.15 / 0.18 |
| | four burning | 1.57 → 1.49 / 2.07 → 1.86 | 0.11 / 0.31 |
| | twelve burning | 1.70 → 1.69 / 2.87 → 2.72 | 0.02 / 0.09 |
| `farCells` 1 against 0 | four cans 25 m off | 1.19 → 1.05 / 1.66 → 1.35 | 0.17 / −0.06 (a noisy take: its median says 0.27) |
| `directAt` 0.5 against 2 | four burning | 1.65 → 1.49 / 2.22 → 2.19 (never switches at 8192: a null test) | 0.34 / 0.00 |
| | twelve burning | 1.88 → 1.70 / 3.10 → 2.71 | 0.10 / 0.33 |
| `readSkip` on against off | hanging · four · twelve · close | no change (≤ 0.04) | −0.06 −0.24 +0.13 +0.17 / −0.12 −0.25 −0.09 +0.11 |

- **`readSkip` ships OFF from here.** Eight pairs, mean −0.04 ms (worse); the view march alone 0.08 dearer on average, the direct pass −0.03 (nothing). It helps a little with the camera close and hurts with four plumes across the view, the same way on both pages. With it in, 'all three' on the hanging plume saved −0.06 / 0.01 of union where `calmMax` alone saves 0.30 / 0.19, the volumetric pass 0.1–0.2 dearer on the hopping side. Reading (inferred): the page texture is small enough to sit in cache, so the loads saved were nearly free and the hop's bookkeeping was not. Same samples either way: nothing he has looked at changes.
- **The fit.** Rules on: 0.43 ms + 0.39 µs per brick STEPPED (worst miss 0.10 over 19 takes at 4096; 0.47 + 0.40, worst 0.19, at 8192). All off: 0.44 + 0.42 / 0.40 + 0.45 per live brick, i.e. round one's 0.37 + 0.45 again. The win is in how many step.
- **Against round one, same window** (added to the frame = against 7.21 ms, the clear frame on the same page once the magazine's gas had gone; round one's was 7.22; Sam stands mid-view in the new one and the build under the branch is newer: good to ~0.1): four cans at 8 s solver boxes 1.68 · round one 1.73 · now 1.48–1.52, union +2.59 · +2.81 · +2.62 to +2.73 (+2.49 with the hop off); twelve cans solver 2.84 (four refused) · 2.16 · 1.66–1.70, union +3.58 · +3.00 · +2.18 to +2.57 (part of that is less smoke: `fresh` holds the pool near 3,400 bricks where round one filled it to 3,979); one can 26–36 s into its life, solver 0.46 · 1.25–1.31 · 0.98–1.05 (8192 page); one can at 8 s 0.83 against 0.87, still ~0.37 over its box.
- **The dry pool, 4096** (a thirteenth can into twelve at 10 s; share of a lone can's smoke within 1.6 m at 1 / 2 / 3 / 4 / 6 s): `fresh` 95 / 92 / 89 / 80 / 66 % in 146 smoky bricks (alone: 189), 57,848 requests refused, ~600 bricks kept free, the thin bar 2.46 → 2.87; first come 74 / 66 / 54 / 44 / 47 % in 77 bricks, 1,159,672 refused, 0 free. Gentler than §9.3's staging (a pool overloaded four times; this one well under twice: given room the twelve take 6,917). **What pays: the twelve old cans hold 79,901 of mass with the rule, 127,601 first come, −37 %.** At 8192 the pool never dries (1,275 free even first come), the rule barely acts (−8 %) and the sides are level (82 / 87 % at 6 s).
- **The magazine** (30 rounds in 3 s, no impact dust, 4096): rule on, peak 1,545 bricks at 4 s, 0 by 7.5 s, solver peak 1.07, union +2.93 to +3.87 while firing (≈ 2.5 of it gone the half second the firing stops: the flash lights and sparks, not the gas; inferred), then +1.41 falling to +0.53; off, peak 3,177, 1,736 left at 8 s, +2.16 to +2.48 after the last round. At 8192 off: 4,771 at 8 s and climbing, solver 2.06. Nothing refused, `fineHeld` 0. §9.8's counts (1,457 against 2,924) carried over. The boxes were not benched on it.
- **POOL SIZE: 4096 STAYS.** Twelve cans at 8192: 6,399–6,461 bricks, solver 2.68–2.72, union +3.85 to +4.02 against that page's own clear frame (7.76–7.78), 255.5 MiB against 133.5, 81 % more smoke in the air (144,245 against 79,901). That is a little over the eight boxes' worst (+3.68) where 4096 is a millisecond or more under it. **The case for his eye is FOUR cans, not twelve:** the soft ceiling starts at 2,458 bricks and four cans in the open sit at 3,141–3,154 where 8192 lets them go 3,802 → 5,368 and growing (solver 1.48–1.52 against 1.86–2.23). Four is the issued kit thrown inside one can's 32 s. If four plumes look thin or short-lived at the edges, that is the ceiling and pool size is the fix.
- **Not taken:** `calmCells` 1 against 0.5 = another 0.21 / 0.45 off the solver with the pool full, nothing on a hanging plume; it makes smoke hang longer, so it is a look call.
- **NOT QUOTED: the 8192 `run()` file's added-to-frame.** Its no-smoke row reads 7.00, under round one's 7.22 in a WIDER window, its own 2 s life row is 0.33 above round one's at the same brick count, the next page in that window reads 7.76 clear, and its one-can row has bloom / taau / compS up a quarter: something moved during the run (the window, the GPU's clock). Its solver times and brick counts are sound and are what is used above.

### 9.8 Gun gas lets go (`fineDecay`, `fineShare`; `fineEps`, `fineHeat`, `fineRing`): the rule the room clear asked for
**What was wrong.** §9.5's room clear opening: 17 rounds on AUTO took the pool from 91 to 3,449 bricks in 1.7 s. A snapshot at the end of the burst: coarse lattice 795 bricks holding 9,057 of mass (the can, the dust), fine lattice 2,663 bricks (1,099 with any density in them)
holding 280: two thirds of the pool for 3 % of the smoke. A fine brick is 17.6 cm across, a fifteenth of a coarse one's volume; in the boxes a fine domain was a 1.4 m cube (512 bricks' worth) whose faces ate whatever left it, and effects.ts's gun numbers were tuned against that sink
(consumers.md rules 6–9). With no faces the gas wanders, thins, and keeps a brick wherever one cell is over 0.002. §3c's "firefight smoke comes out about even" was one stun and ONE shot: it never saw automatic fire.

**The experiment** (`drv/mag.js`; SwiftShader, nothing drawn: the game ticks, the solver steps alone; dt 1/60, chaos 0 so no impact dust, Sam at (12, 0, 11.1) firing the FN2000 down the corridor, one round per 0.1 s through `__destr.burst(tgt, 1)`, pool 4096, still air; every brick of the fine lattice read back and
sorted by its densest cell: dense > 0.25 · mid > 0.05 · haze > 0 · heat only · air). Each round's wisps go on emitting 2.5 s (`wispLife`), so sources stop 2.5 s after the last round. 'seen' = mass in cells over 0.1.

| t, s | rounds | AS BENCHED: bricks (dense / mid / haze / heat / air) | mass / seen | THE RULE: bricks (dense / mid / haze / heat / air) | mass / seen |
| --- | --- | --- | --- | --- | --- |
| 0.5 | 5 | 655 (88 / 72 / 43 / 35 / 417) | 58 / 48 | 479 (70 / 83 / 19 / 0 / 307) | 44 / 35 |
| 1 | 10 | 1,009 (125 / 156 / 104 / 35 / 589) | 119 / 95 | 702 (109 / 105 / 51 / 0 / 437) | 76 / 60 |
| 1.5 | 15 | 1,353 (186 / 231 / 150 / 51 / 735) | 183 / 145 | 874 (161 / 136 / 59 / 0 / 518) | 106 / 85 |
| 2 | 20 | 1,753 (248 / 367 / 207 / 37 / 894) | 265 / 207 | 1,089 (162 / 255 / 80 / 0 / 592) | 123 / 93 |
| 2.5 | 25 | 2,259 (229 / 591 / 302 / 29 / 1,108) | 341 / 252 | 1,279 (187 / 269 / 134 / 0 / 689) | 134 / 101 |
| 3 | 30 | 2,775 (255 / 795 / 314 / 24 / 1,387) | 412 / 284 | 1,441 (214 / 201 / 164 / 0 / 862) | 140 / 114 |
| 3.25 | 30 | 2,924 (266 / 838 / 364 / 37 / 1,419), stopped here | 409 / 256 | 1,407 | 134 / 105 |
| 4 | | | | 1,397 (52 / 159 / 258 / 0 / 928) | 45 / 29 |
| 4.5 | | | | 934 | 32 / 27 |
| 5 | | | | 440 | 18 / 12 |
| 5.5 | | (sources stop) | | 313 | 5.8 / 2.6 |
| 6 | | | | 161 (0 / 13 / 13 / 0 / 135) | 0.6 / 0.1 |

As benched: about 1,000 bricks per second of fire with no sign of levelling, half of them clear air, and §9.5 shows them still held 3 s after the last round. The rule: peak 1,457, levelling from 2.5 s (what is laid down a second balances what fades), nothing refused (the share stretched to 0.6 of an otherwise empty pool and
was never reached), gone 3 s after the last round. The dense core loses a sixth to a third of its bricks (214 against 255 at 3 s, 162 against 248 at 2 s) and peak density is the same to 3 % up to 1.5 s; most of what goes is the mid and haze that had spread down the corridor. THE PRICE IS SMOKE: at 3 s a third of the mass is left, and 40 % of
'seen'. At σt 6 /m the as-benched haze (mean ≈ 0.05 over ≈ 2 m) is τ ≈ 0.5, a veil nobody has ever seen, since the box deleted everything past 0.7 m from its centre (inferred; no picture of either on a GPU). Whether the game wants that veil is his call: `fineDecay` is the dial. Half a magazine (15 rounds):
peak 1,112, 216 bricks and no density 3 s after the last round.

**How it got here** (15 rounds each, same rig). v1, the fade growing × 4 as a hard 0.25 share filled: −22 % bricks for −71 % mass at 1.5 s, heat-only bricks up to 300 (heat decays at 1.2 /s and holds a brick by itself), 504 of air: a bad trade. v2, heat fades with the gas, floors 0.01 / 0.1, no growth, hard share: 990 at
1.5 s, then pinned at ≈ 1,020 with 27,774 refusals and 800 of 985 bricks air. v3 = what shipped, air ring 4 → 2 cells and the share elastic: 864 at 1.5 s; mass, 'seen', peak density and the cloud's extents within 3 % of v2's, so the smaller ring costs nothing these measures can see. Fade 1.5 against 3: 824 against 806
bricks at 1 s, mass 89 against 75: the bricks are mostly bought by the floors and the ring, the fade decides how long the tail is.

**A can and a burst in a small pool** (pool 1024 = a quarter; a can at (14.5, 0, 11.1) burning throughout, 5 s of lead, then 15 rounds from 2.5 m away, 3 s more; unpaired dice, so ± 5 % between runs is noise: the two leads stood at 689 and 661 bricks at 5 s).

| t, s | rounds | CAN ALONE: bricks / mass | WITH THE RULE: can bricks / mass · gas bricks | AS BENCHED: can bricks / mass · gas bricks (heat only) |
| --- | --- | --- | --- | --- |
| 5 | 0 | 668 / 10,768 | 661 / 10,651 · 0 | 689 / 10,603 · 0 (0) |
| 5.5 | 5 | 786 / 11,367 | 607 / 9,346 · 187 | 636 / 8,788 · 314 (33) |
| 6 | 10 | 822 / 11,438 | 704 / 7,967 · 223 | 585 / 7,434 · 333 (90) |
| 6.5 | 15 | 841 / 10,908 | 616 / 7,385 · 235 | 549 / 7,048 · 326 (63) |
| 7 | 15 | 835 / 10,175 | 608 / 7,842 · 187 | 459 / 6,996 · 426 (77) |
| 7.5 | 15 | 803 / 10,331 | 581 / 8,220 · 229 | 388 / 6,806 · 506 (158) |
| 8 | 15 | 780 / 10,725 | 557 / 8,768 · 218 | 393 / 6,762 · 484 (153) |
| 8.5 | 15 | 778 / 11,140 | 628 / 9,531 · 135 | 411 / 6,969 · 460 (141) |
| 9 | 15 | 770 / 11,603 | 658 / 9,992 · 142 | 436 / 7,127 · 436 (117) |
| 9.5 | 15 | 795 / 11,989 | 705 / 10,319 · 59 | 466 / 7,554 · 351 (117) |

A quarter pool is too small for one can (it wants 1,800 and settles at ≈ 800 under the ceiling), so this is the pool at its tightest. As benched the gas takes 506 bricks, the can falls from 689 to 388 (half a lone can's) and 6,800 of mass (−34 % on the lone can at 7.5 s), 43,218 requests are refused, and at 9.5 s, with NO
density left on the fine lattice, 351 bricks are still held: 117 by heat alone and the air round them. With the rule the gas peaks at 278 (its share is the floor here, 256, + source bricks), the can keeps 557–705 bricks, dips to 7,385 of mass at 6.5 s (−32 %: in a pool this tight any 230 bricks push `fresh`'s thin bar
up, 3.85 at 6 s) and is back to 10,319 at 9.5 s (−14 %) where as benched it stands at 7,554 (−37 %). So the rule does not make a burst free for a can in a full pool: it halves the BRICKS the burst takes (≈ 200 against ≈ 400 of the lone can's 800); the dip in smoke is as deep for a second (−32 % against −35 % at 6.5 s) and then comes back inside 3 s, where as benched it stays down. ('As benched' here = every `fine*` knob off, the other round-two rules on.)

**The room clear's opening again** (8ed65a9, the same page, keys and 221 frames as §9.5: 17 rounds, 14 puffs raised, 3 held by the per-second cap, as before; no GPU error, no console error, the scenario live to the end). Pool / of it gun gas at frame 100 · 120 · 140 · 160 · 180 · 200 · 220: 1,387 / 777 · 2,459 / 1,518 ·
2,596 / 1,286 · 2,505 / 1,039 · 2,488 / 981 · 2,303 / 692 · 2,125 / 464, where §9.5 had 1,363 · 2,661 · 3,449 · 3,461 · 3,523 · 3,369 · 3,280. Peak 2,613 against 3,555. Requests refused for want of a brick: 0 against 39,411; held to the gas's share: 41,965. The gas met its share at frame 120 (coarse 941 bricks = 0.23 of the pool, so the share
stood at 0.37 = 1,515) and gave ground as the can and the dust grew: the coarse lattice ends on 1,661 bricks where it had 795 at frame 140 as benched. More gas here than in the corridor table (1,518 after about 1.2 s of fire against ≈ 800) because this run steps at 1/30: a brick must exist as far as its fastest air can cross in a step,
and the muzzle jet crosses 16 fine cells in 1/30 s. So gun gas costs more bricks at 30 fps than at 60 (inferred from the reach rule; this run also has wind and dust, and the two were not told apart).

**The bench's magazine part, dry run** (SwiftShader, pool 1024, verylow, `round2({ k: 0.005, rounds: 1, n: 1, settle: 1, scenes: [], dry: false })` = two rounds and sixteen drawn frames an arm): nothing failed, no GPU error, both arms' sixteen rows filled, knobs and chaos put back. `solverMs` reads 0 on this rig wherever the solver passed a
second (timer.ts drops a pass over 1,000 ms): not a thing a GPU will see.

**The review** (one pass over the diff, read-only). As-benched identity and level 0's independence hold by reading; struct, packing, counters, kernel order, races checked. Five findings, four fixed in 8ed65a9: the raised floors ran after injection, so a source laying down less than the floor a step never built (the ejection port's
curl: 0.042 of heat a step at 60 Hz against 0.1; at 144 Hz its density too) → a cell a source is feeding keeps the plain floor; requests held to the share were counted as pool refusals → their own count (`stats.fineHeld`, the Tab row, the bench's `heldToShare`); the bench's second arm renamed (only the gun-gas knobs are off in
it) and the first takes the knobs as the page booted them; `fineShare` 0 from the console read as 1. Left, to be judged by eye: when a can shrinks the share under gas that already holds more, every new muzzle's gas is clipped to its source bricks for the second or so the old gas takes to go. THE TABLES ABOVE ARE FROM THE
TREE BEFORE THOSE FIXES (they touch cells under a source and a counter); the room clear replay, the can alone and the bench's dry run are from after. THE HALF MAGAZINE FIRED AGAIN ON 8ed65a9 (15 rounds, 1/60, pool 4096, same script as v3's), fine bricks after / before the fixes: 0.25 s 393 / 348 · 0.5 s 506 / 479 · 1 s 712 / 702 · 1.5 s 888 / 864 · 2 s 1,020 / 991 · 2.5 s 1,137 / 1,092 · 3 s 732 / 683 · 3.5 s 371 / 378 · 4 s 289 / 306 ·
4.5 s 212 / 216; peak on any frame 1,204 / 1,112 (+8 %); mass within 3 % while firing (105.7 / 103.3 at 1.5 s), up to a tenth either way after, 0 / 0.1 at 4.5 s; nothing refused, no GPU error. So the fed cells' plain floor costs about a tenth more bricks at the start and at the peak and nothing at the tail: read the tables' brick counts as about a tenth low (sysRandom's jitter
is unpaired between runs, ±5 % on its own).

**Not built.** Handing thinned gas to the coarse lattice instead of fading it (a firefight's haze for a fifteenth of the bricks; wants atomic float adds into packed f16 pairs, or a gather pass from the coarse side). Worth it only if he wants the veil. The gun's own numbers (`wispLife`, `jetSpeed`, the anchors) are untouched: authored data.


## 10. The boxes come out (10-10, after "As default")

His words, in the thread, 16:45:53Z and 16:46:01Z: "let's just remove the box smoke if this is the way we want to do it" · "we can always revive from git history". One change, two steps, so each could be checked by itself.

**Step 1: names, and the boot-time patches baked in.** `sparse.ts / sparse.wgsl / sparseGrid.ts / smoke_sparse_read.wgsl / dust_look_sparse.wgsl` take the plain names; what `frame.ts`, `froxels.ts`, `probe.ts` and `passes.ts` used to cut out of
and splice into the shared shader texts at boot under the switch is now simply what the files say. Checked by dumping every program's final text before and after (prelude, direct, restir, gathers, reflect, cards, volumetrics + dust twin, composite,
froxels, probe, particles, solver): the same, comments aside.

**Step 2: what only the boxes needed.** Diffing the same dumps, comments stripped, the only code that moved: `FLAG_SMOKE_RSKIP` gone · `SmokeDomain` → `SmokeBound` with its dead fields named `pad*` and `pad1` named `readSkip` · scene binding 11
(`smokeOcc`) gone · the stubs `SMOKE_BRICK`, `SMOKE_EDGE`, `smokeMayHold`, `smokeEdgeFade` gone · `windForceM` folded into `windForce(u, P, mask, dt)` and the block's per-domain `mask` words now `spare` · two writes nobody read. Probe,
volumetrics, the dust twin, froxels and the solver's consts come out byte for byte.

**What went** (src + tools: 1,535 lines in, 4,207 out):
* Files: the box `smoke.ts` + `smoke.wgsl`, `pressure_half.wgsl`, `smoke_lab.wgsl` (main's pre-port transmittance) + `tools/qa/smoke-lab.js` (`__sl`), `tools/native/host/smokecheck.ts`.
* Settings / flags: `settings.smokeRenderSkip` + FrameFlags bit 32768 (free), scene binding 11 (free), `params.fullRateDomains / pressureHalf / brickSkip / flushEps / voxelFine / voxelCoarse`, `Caps.smokeFull` in every preset, the sweep's snapshot of it.
* Game: `CHAOS.puffDomains` and the clause that read it; `SmokeSystemLike.unbounded`. Game code holds no fact about how smoke is stored.
* Tab: seven rows (fixture `panel-inventory-main.json` edited by hand: 7 out, one renamed, titles brought up to date); 'Sparse smoke' → 'Smoke pool'.
* The switch: `?sparsesmoke` alone is a no-op; `?smokepool=N` (or `?sparsesmoke=N`) sizes the pool.
* Kept by name on purpose: `smoke.sparse` / `__smoke.sparse`, `SPG_*` / `spg*`, `sparse-lab.js`, `sparse-reads.js`, this file and the page, `stats.live` (pool ÷ 512, the F9 column), `inSmokeDomain`, `refreshDomains`, the emitter's `anchor` (the native port reads it).

**The native host** kept its own Metal + CPU port of the boxes until it was removed from the repo on 2026-10-11 (git history has it).

**Checked.**
* **Text** (counted): the two dumps above.
* **Headless**: `tsc` clean on all three projects (src, tools/qa, native). `probes.ts` frame-layout · panel-inventory · destruction (10) · squadsmoke (4) · weather-smoke · fog-smoke · particles (4) · journal (6) · shipped · loudchaos (7), `dice-check.ts`, `knobs-check.ts`: all pass.
  `probes.ts wind`: one FAIL, `wind-identity`, which the runner prints as EXPECTED RED (it was before this branch). `bun run build` exits 0. `tour.ts --runs 1` and `soak.ts --seeds 1,2 --minutes 6` pass. `missions-gate.ts` exits 0 (26 squad runs as shipped, six quiet rows × 2 seeds, no FAIL). Paired play-throughs, 1530281c against this tree, `TPS_PROFILE=shipped PT_DIGEST=1 PT_DESTR=1`, room-clear-four and block-squads × seeds 1, 2 ×
  `PT_DUST` 0, 1: **8 of 8 run digests equal**.
* **SwiftShader, boots**: 1530281c `?sparsesmoke`, this tree with no flag, this tree `?roomclear&squad4`, `/workbench#mode=effects`: 112 / 112 pipelines, 'no GPU errors during boot'.
* **SwiftShader, one scene on both trees** (`?paused&quality=medium&seed=7`, 640 × 360, camera pinned, two cans, 12 frames, three FN2000 rounds into the wall at x 30, 12 frames; each tree drawn twice from a fresh boot):

  | | old, 1 | old, 2 | new, 1 | new, 2 |
  |---|---|---|---|---|
  | bricks in the pool | 650 | 659 | 647 | 646 |
  | stepped | 619 | 628 | 616 | 615 |
  | fine | 420 | 429 | 420 | 419 |
  | holding dust | 27 | 27 | 27 | 27 |
  | mass, coarse | 2494.0 | 2497.4 | 2497.5 | 2487.3 |
  | mass, fine | 50.88 | 49.52 | 51.08 | 51.66 |
  | GPU errors | 0 | 0 | 0 | 0 |

  No two frames hash alike, same tree or not: every emitter's direction and speed take `sysRandom()` each step, which the page does not seed. Away from the rounds' dust every pair of frames is within 3‥7 of 255. In the 36 × 26 px where the dust off the three rounds hangs: old against old 7,
  new against new 4, old against new 8‥16, the old the lighter. So that patch got its own look. The GAME's side of it, recorded on both trees (160 × 90): the die's word and count at four points, the three damage decals (place, radius, seed, param), both puffs (place, direction, radius, density, tint), 19 emitters by kind,
  every destruction counter, every particle counter, pool 646 / fine 419 / dust 27: **the same in every field**. Then both trees once more with `Math.random` seeded in the page ahead of the scene (so `sysRandom` is too): **the same frame bit for bit** (fnv 13341050 on both, 0 of 230,400 pixels differ), 658 bricks / 627 stepped / 428 fine / 27 dust on both, mass 2491.2937 and 50.7041 on both to twelve digits. The patch was the dice.
* **SwiftShader, the workbench** (the viewer builds its own `SmokeSystem`): the smoke can 399 bricks after 20 frames, 0 refused; the stun on top 926, 228 of them fine; 0 console or GPU errors.
* **SwiftShader, a room clear played by its keys** (`?roomclear&squad4&seed=7`; `3` + a click, `B`, `2`, `Z`, the trigger held): the can up (88 bricks at frame 80), 0.8 s into the magazine 1,389 bricks, 902 fine, 23 emitters, 8 dust puffs, 0 refused, 0 errors. **Cut at frame 104 of 220** (a minute a frame with the other pages
  running): the magazine's end and the 3 s after it were not replayed. §9.8 has that stretch on 1530281c's text.
* **SwiftShader, off and on** (the review's fix; dust in the air, dt 0): on 646 bricks / 27 dust / dusty / 8 bounds → off: the renderer handed 0 bounds, not dusty, the counts standing → on: as before it.
* **Not checked**: anything on a real GPU. No frame time (the hot kernels' code is what his Mac timed, so I expect his numbers to stand: inferred). The native host was typechecked, not run. No whole mission in the page. `all-quick` as a whole was not run.

**The review** (one pass over the whole diff, 15 candidates). Fixed: switching the solver off zeroed the pool's counts, and with the world standing still nothing read them back, so the F8 sweep's smoke row left `dusty` false and every later row of a
take with dust in the air ran the plain march (the counts now stand while it is off) · the CALM row's title said 0 = off, which is false out of view (`farCells`) · `?smokepool&sparsesmoke=N` parsed NaN · the solver's module was joined without newlines at boot
and with them on a hot swap · CLAUDE.md said 16 sealing leaves (32) · `expected-red.ts`'s count · `page-look.cjs` still passed any console line naming smoke over as noise.
Left, each named in the hand-over:
* **22 more page tools carry that noise filter** (`/smoke…/` on console errors; it was for the boxes' 15 pipelines that SwiftShader could not build). The pool labels everything `smoke*`, so a real error from it is swallowed there. Other goals' files, one line each: a step for after the join.
* `framecost-gpu.ts`'s fake device never answers a read-back, and the pool knows it is empty only from one: after the first emitter smoke stays live to the end of the recorded mission, bricks read 0, and indirect dispatches carry no thread counts. The frame-cost goal's tool, its call.
* No per-tier scaling: pool size, `calmMax`, `farCells` and 133.5 MiB are the same at verylow and ultra; presets scale the pressure pairs only.
* The dust gate went with nothing in its place but `puffsPerFrame / puffsPerSec`, the emitter budget (64 − 12, the boxes' was 32 − 6) and the pool's own ceiling. Not re-measured. Runs over `dust-standin.ts` may raise more puffs than they did.
* A round's wake takes its 20 pushes from the near side of the (loose) bounds: through a 9 m plume the far 3 m get none.
* The fine lattice stops at 4.2 m: gun gas from a parapet above that makes nothing. The coarse one covers the world's height. Both cover the world's rectangle, which every level fits.
* Dead weight in the readers (`smokeDensityIn`'s mask, `SmokeSpan.mask`): left so the hot kernels' text is what his Mac timed.

**The build to play merged under (c8c85159, 10-10 19:00Z).** d546af02 came in clean (hands on bodies and doors, the frame-cost tools on the shipped stand, two test mends). Rerun on the merged tree, headless: the three typechecks, `probes.ts` frame-layout · panel-inventory · destruction · squadsmoke ·
weather-smoke · fog-smoke · particles · journal · shipped · hands, `knobs-check.ts`, `dice-check.ts`, `perf-sweep-selftest.ts`, `bun run build`: all pass. SwiftShader: 112 / 112 pipelines, no GPU errors during boot; the pinned scene above (two cans, three rounds, `Math.random` seeded) comes out **the same frame again** (fnv 13341050, 0 of 230,400 pixels against the removal's own tree), 658 bricks / 627 stepped / 428 fine / 27 dust, mass 2491.2937 and 50.7041, 0 GPU errors.
NOT rerun after the merge: loudchaos, wind, the tour, the soak, the missions gate. (The paired digests were, wider: next block.)

**Paired digests on the merged head (f1895a1a against d546af02, 10-10 19:35Z, headless).** `TPS_PROFILE=shipped PT_DIGEST=1 PT_DESTR=1`, the 13 squad missions x seeds 1, 2 x `PT_DUST` 0, 1 = 52 pairs: **50 equal, 2 differ**, both `warehouse-four` under `PT_DUST=1` (the CPU dust stand-in; with it off all 26 are equal).
The cause is the dust gate that went with the boxes, and only that: the stand-in counts its puffs' 4 m squares as `stats.live`, so on the base 'no new dust past six live boxes' refused 14 and 20 puffs of those two runs (40 and 41 went); on this head 1 and 1 are refused (52 and 53 go), the extra dust dims more sight lines
(frames with a dimmed line 801 -> 1442 and 370 -> 493) and the runs part. CHECKED, not inferred: the old test put back by hand in a scratch copy of f1895a1a (`stats.live >= 6 && !inSmokeDomain(p)`) gives d99efb7d and d50a9468 again, the base's two digests, with the base's puff counts. So this IS a change to play, in the model: in a loud
minute spread over more than six places, wall and blast dust that used to be refused now goes, and men see less through it. One of the two runs ends differently (seed 2: taken -> wiped); two seeds say nothing about who it favours. The 8 of 8 above were the two missions where the gate never bit.

**What the neighbours asked (10-10, their notes, checked against c8c85159).**
* *Performance.* The timer pass is still one pass named `smoke` (`sparse.split` false), so quality.ts's fixed-cost sum holds. `SmokeSystem` is still exported from `src/smoke/smoke.ts`. GONE, not kept as no-ops: `params.fullRateDomains`, `params.pressureHalf`, `ensureHalf()`; `rbIters` stays and still scales the
  pressure pairs per preset. `params.enabled = false` hands the renderer `binding.count` 0 as the boxes did, and every reader is behind `frame.numSmoke` (read; the off / on round trip above is the run). `stats.live` = the pool in units of 512 bricks (one old box's worth), at least 1 while anything is alive: an F9 take's
  smoke column is NOT the count of clouds it was. `tools/qa/perf-sweep.ts` is a library: run by itself it prints nothing and checks nothing.
* *A before for dust, his Mac.* His F8 sweep of 17:28Z ran on 1530281c with no `?sparsesmoke` (`?roomclear&difficulty=hard`, high, 1206 × 770, world frozen): 'dust and smoke not drawn (1 cloud here)' gave back **+1.98 ms** of GPU time (1.92‥2.07 over three rounds) of a 15.80 ms frame, drawing only. The same view on the
  pool is the after; nobody has taken it. (`rebuild/performance/mac-recordings/perf-2026-10-10T17-28-27-698Z.report.txt`, line 134.)
* *The non-physical audit.* Of the dust caps it lists: 'no new dust past six live boxes' is DELETED; two puffs a frame, eight a second and the burst queue dropped after `CHAOS.loud.burstSecs` STAND (they ration emitters, which the pool has too). The blast's soot ring and fireball (blastFeel.ts) are still particles
  with no density in the solver, so the guards' sight lines still pass through them: this change did not touch that file.
* *Dead code.* `smoke_lab.wgsl` went here. `?nodustlook` STAYS: it switches the dust twin, which the pool draws with. `FrameFlags.Particles` is not smoke's and was left. Nothing here calls `Particles.pendingWinds / rainWindow`.
* *Debug tools.* The two tooltips it names were reworded in the removal ('CALM bricks' points at the Smoke pool section's row by name; the fx density row says 'the row below'). Its branch at 48bd54f5 merges onto c8c85159 with no conflict (`git merge-tree`).
* *Dust weather* (`dust-weather-rsddcp` @ 83c7d5ac). The anchors it kept off no longer exist: the boot-time swaps are baked into the files. Trial merge onto c8c85159: ONE conflict, the `./render/frame` import line of src/main.ts (take both: its `weatherVolConfig`, this branch's `smokeGridConfig` line). With that
  taken, `tsc` is clean, `dustLookVol()` still builds the twin, `frame-layout` passes. COMPILED since (10-10 19:50Z, f1895a1a + 83c7d5ac in a scratch worktree, SwiftShader): clear air 112 / 112 pipelines, no GPU errors, and the pinned scene is **the same frame once more** (fnv 13341050, 658 bricks); `?weather=dust&hour=midday` with
  the same two cans and three rounds 112 / 112, no GPU errors, same bricks and mass, a different frame as it should be (fnv 49c6f23c). Headless on the joined tree: frame-layout, airdust (6), weather-smoke, fog-smoke, wxkinds (7) pass. What the dust volume asks of smoke is ONE call, `smokeTransmittance(X, Ld, 6.0)` behind `frame.numSmoke > 0` in
  `wxAirMarch`: same name and arguments here (smoke_read.wgsl), clipped to the bounds first. It packs its step cap in `volCfg.w` bits 24-28; this tree reads bits 0-20. The merge stacked the dust volume first and this branch over it, so that merge is NOT on this branch.
* *Destruction* (its two questions). (1) The six-box test was also dust's COST bound. The bound now is the pool: all smoke shares 4096 bricks; from 60 % full thin smoke fades faster and the floor for nothing rises, sooner and harder past `viewR` 10 m from the camera's focus where the last quarter is refused; over the last 2 x `fresh` = 30 %
  haze gets no new bricks; at full, smoke does not spread into new bricks, nothing is evicted. Priced at that ceiling with CAN smoke on his Mac (1.66-1.70 ms solver, +2.2 to +2.6 frame, high); tinted dust draws through the dust twin and a loud minute with wall blasts has not been timed on any GPU. (2) Of what `dustPuff` passes: `lattice: 'coarse'` is
  read (`levelOf`), `minVoxels: 2` is read (`emit` floors the radius at 11 cm), `anchor` is not (types.ts says so). A puff is born the size destruction.ts asks; how far it drifts after is the pool's, with no box face 1.76 m out to eat it: that look is this goal's to own.
* *Hold 60* (f947acb5, queued): once a build carries it, a take on a LIVE page wants `?aim=asnow`. The lab's benches step frames by script and are said not to be affected (performance's claim, not checked here).
