# Image quality — sharpness, the TAA resolve, ReSTIR grain, fast physics, at all five tiers (2026-08-11/12, lane `v3/image-quality`)

The maintainer's theme, verbatim: *"I really liked the previous renderer's sharpness for direct lighting, and the temporal stuff has kinda compromised that"* ·
*"reopen the sharpness work but also holistically looking at TAA resolve too"* · *"one thing that was an issue with twopointfive's physics engine is that
really fast movement from physics was really noisy for direct lighting. how much do we have that problem here? … stress test how much chaos we could do
(Control is a great example of this feeling amazing!)"*. And the decision rule that arrived mid-lane (verbatim): *"if we don't have great results for sharpness
even with lots of dynamic objects, I think it's fine to just make low velocity part of our design principles to get great image quality and performance while
only using webgpu … I'd rather do the slow, methodical stuff great and optimize for the stealth gameplay rather than compromise that for making the chaos work
at all."* — applied as: rank every variant on the CALM cases first (still + 0.3°/frame orbit sharpness, crawl, static noise, the desk-dim ReSTIR grain, the
dynamic-LIGHT scenes, a walking man's shadow); the fast-physics scenes produce a BUDGET; a fix aimed at fast occluders ships only if it costs nothing measurable
in the calm cases; E1 (motion identity) is a correctness fix and stays regardless.

Machine / method as every phase note: M4 Max, Chrome (the Browser pane) / Metal, dpr 2, this worktree on :5186 (shot sink :5187), a reference tree (main @
6551c66) on :5188 for the identity hashes, `?paused&quality=<tier>&mute`, the canvas box pinned to 1280×720 CSS at dpr 2 (`__sh.pinViewport`: high = 1368×770 →
1777×1000), guards parked dark, Sam invisible, phases / grain / life layer off, the storm off, dice seeded, `document.hidden` pinned true so every scripted game
step renders offscreen exactly once. The maintainer may have been playing on the same GPU: every cost number is a serialized-frame median with its p95 beside
it, and a take whose fixed-cost passes inflate together is called contended where it happened. Page: docs/review/image-quality.html (tools/qa/iq-page.py).

## 0. The port (STEP 0)

Branch `v3/sharp-direct` (7 commits on 91cd005) squash-ported onto main-with-markings as 9683e1f: the Frame block re-laid AFTER the markings' `markCfg` —
`sharpCfg` @704, `sharpCfgB` @720, `FRAME_BYTES` 736 (frame-layout PASS, materials-frame PASS: bytes [0, 704) identical to main's for the same params);
composite.wgsl's compute twin composites the markings' `markEmissiveAt` at the OUTPUT resolution (P / N from the output g-buffer, footprint = an output pixel —
the same footprint fsBox band-limited `markSurfaceGB` at); the resolve's 1 : 1 twin keeps the temporal-jank lane's motion terms (MOTION_PX / motionA /
motionClip / lightJump all in output-px or luminance units — identical semantics at ratio 1). `settings.sharpDirect` now defaults OFF and the presets place it
(`Preset.sharp`, `sharpForce` for `?sharp` / `?nosharp`); its five pipelines compile on first use (review follow-up ae3ee58). **Identity**: sharp direct off
hashes as main @ 6551c66 — high v3 `c8f100ac` / v1 `57606578`, medium `a43a8d44` / `7f73ac88` (`__sh.identityHash`, both trees, first call after boot) — and
still does after E1 + the GBAA target + C2 landed with `motionIds` ON (high `c8f100ac` / `57606578`).

## 1. Instruments (tools/qa/iq-harness.js `__iq`, tools/qa/chaos-scenes.js `__chaos`, tools/qa/iq-report.py, committed 6e1cd8c)

- **Sharpness + CRAWL** (`__iq.crawl(view)`): the sharp lane's orbit (20 game frames at 0.3°/frame ending on the view's own yaw, V3 cubicle desks / V1 the
  manager's desk) read back EVERY frame; edges are defined in WORLD space (the blue spine partition's top strip: its far edge against the dark floor
  `partTop` and its near crease `partTopN`; desk A's keyboard far edge `kbFar`; the manager's keyboard `kbTop`; his desk's front edge `deskFront` — found by
  projecting the level's boxes onto the sharp lane's hand-placed pixel edges) and projected SUB-PIXEL through the frame's own unjittered view-projection, so
  the geometric edge is known exactly in every moving frame; N ≈ length ∕ 3 profiles across it per frame → per profile the 10–90 % width and t50 (the luma
  edge's offset from the geometric one). WIDTH motion = mean over frames of the per-frame median (the sharp lane's number, now over 20 frames instead of the
  last); CRAWL = the temporal sd of t50 per profile, mean over profiles (how much the picture's edge wanders about the geometry: an aliased edge crossing pixel
  centres reads ~0.3 px, a stable one ~0.1, a still TAA'd one 0.01–0.03 = its jitter flicker); band sd = the sd of the plateau-normalised luma at −1 / 0 / +1 px
  from the geometric edge; tile hp = high-pass RMS of the sharp lane's desk / penumbra tiles per frame (detail + noise in motion). `still: true` = the same
  20 frames without turning. Rounding the projection to whole pixels (what `__perf.projectOut` does) put a 0.5-px sawtooth into every series — the first cut's
  numbers were that; fixed before any table here.
- **NOISE** (`__iq.noise()`): per-pixel temporal sd of 8-bit luma over 30 still renders in world- / pixel-anchored tiles on five pinned views (V1 monitor-foot
  penumbra / lit desk / keyboard contact; V3 desk / chair penumbra / carpet; the P3 cubicles still's lit desk / chair penumbra / worn lane / carton top; the
  corridor's lino + the cabinets' hard shadow; the break room's vending lino / far lino / the pixel-art fronts) + the two ReSTIR residuals of the tjank note:
  scene A under a 4 / 4 square strobe → the desk's and the rug's sd WITHIN the lit and the dim level (the 'desk dim grain 1.9 vs leader 0.3' case), scene D →
  the lamp-lit floor by the window (the crawl case, main 0.39 vs restir off 0.09 in that note). tjank's own harness runs those two, under the tj variant whose
  four switches match the current settings (a variant of ours with ReSTIR off is measured with it off).
- **DYNAMIC LIGHTS** (`__iq.dyn()`): tjank A (the game's flicker pattern: rug lit / dim means + noise), B (the flash frame / second stroke on the floor by the
  glass, the desks), C (the swept torch's haze frames 24‥34) — the regression check for the tjank fixes under each candidate.
- **COST**: calm = the cubicles still, 30 serialized offscreen renders after 10 → union of compute passes med / p95, Σ, wall, per-pass medians (`__sh.cost`);
  stress = the QRF + rain + two-canister minute (`__stress.setup({fight:false})`, `__sh.stressAB` A/B blocks).
- **FAST PHYSICS** (`__chaos`, six scenes, deterministic under `?paused`, seeded — §5).

## 2. What was built (renderer side)

- **E1 · motion identity** (ae3ee58 + 7a97581, `settings.motionIds` default ON, `?nomv`, Tab ▸ Frame): `Box.mkey` + `MKEY` ranges (scene/boxes.ts) name a
  part of an object across frames — doors (leaf + handles), props (per part), items (a serial per spawn × part), rig props (owner + ordinal per man; the
  owner-0 weapon lasers stay unkeyed), devices (ordinal). `BoxWorld.upload` packs `visible[nv] = index | pslot << 16` (0 = the index rule as before,
  0xFFFF = keyed but new this frame, else 1 + the index the key had LAST frame); gbuffer.wgsl `vsBox` reprojects a keyed box through `prevBoxes[pslot − 1]`
  after checking the part still has the same shape (a re-cut tripwire beam, a magazine that just settled flat: 'did not move', as the index rule said),
  else the old size + owner test at its own index. gVel feeds the TAA, ReSTIR's temporal reservoir and the v3 denoiser alike, so all three follow a flying
  can through a spawn / despawn under it. Off = the bare index and the old branch verbatim; ON hashes as main on the still identity scenes (nothing reorders).
- **C3 · GBAA** (ae3ee58 + 7a97581, `settings.gbaa` default off, `?gbaa` (forced through the presets with jitter off), Tab ▸ Frame): the g-buffer's box
  raster writes a 6th target `edge` (rg8unorm, 2 B/px, cleared to none; +2 flat varyings): the signed distance in pixels from the pixel centre to the
  nearest of the shown face's four edges along the screen axis that edge leans across, from the box-local position and its screen derivatives
  (`boxEdgeOffset`, analytic; caps / cut walls / skinned men write none); `gbaa.wgsl` (compute, after the composite + the particles' splat, before the
  resolve, in place on hdr via a copy) blends each crossed pixel with its neighbour across the edge by the far side's exact coverage in the resolve's
  tonemapped space, and a pixel with no edge of its own takes up a neighbour's edge that extends into it only if it is not in FRONT of that neighbour
  (depth). Persson's GBAA, on boxes: silhouettes and creases get single-frame analytic AA; characters, panes and intersection lines stay the resolve's.
  It needs a 1 : 1 resolve to make sense (jitter off + an upscaling resolve leaves output pixels no sample refreshes — measured, §3), i.e. sharp direct
  below scale 1 or scale 1.0 itself. Cost ≈ a copy + 2–6 loads per output pixel (§4).
- **C2 · history de-blur** (`settings.taauHistSharp`, default 0 = main's fetch, Tab ▸ Frame): while a pixel is being resampled (tjank's motion ramp) the
  Catmull-Rom history fetch gains k × (itself − a bilinear fetch at the same spot) — the band each resample removes — in tonemapped space, before the clip.
  One extra bilinear tap. TaauParams grew to 144 B.
- **D · ReSTIR knobs for the dim-penumbra grain** (ba47c04): `restirPenCap` (an M cap that applies only in pixels whose inherited texel carries a blocker
  hint), `restirPenRays` (a second fresh candidate + ray there whatever the tier's ray count), `restirPermute` (RTXDI-style permutation of the temporal
  texel — measured much worse, kept as an A/B row); `restirSpatialAll` existed. All packed into ru.cfg.z / .w bits (no uniform growth).
- Sharp direct's five pipelines compile on first use (review follow-up); the harnesses of §1.

## 3. The study at HIGH (1368×770 → 1777×1000 unless a row says otherwise; tags `h_*`, docs/perf/iq-h_*.json; `python3 tools/qa/iq-report.py` prints every table)

**Reading the sharpness rows.** width = 10–90 % rise across a lit box edge in OUTPUT px, median of the five edges, still / in motion (the 20-frame orbit);
crawl = temporal sd of the luma edge's position about the geometric edge, px (still in brackets — a TAA'd still edge flickers ±0.02 with the jitter, an
un-jittered one 0.002); hp = high-pass RMS of the V3 desk tile still → motion (detail AND noise; the sharp lane's contrast number). The OLD renderer's
'width still' includes NO anti-aliasing (a staircase reads 1.1–1.4 px in this metric; a clean coverage ramp 1.4–1.7).

| variant | width still | width MOTION | crawl (still) | desk hp still → motion | lit-desk hp | notes |
|---|---|---|---|---|---|---|
| OLD renderer (pre-v3 chain, 1777×1000, FXAA) | 1.51 | 1.63 | 0.216 (0.004) | 3.93 → 3.69 | 2.51 → 2.29 | aliased still, crawls in motion |
| main (tjank motion terms) | 1.84 | 1.87 | 0.158 (0.016) | 2.92 → 2.68 | 2.10 → 2.00 | |
| main minus the motion terms (P1's resolve) | 1.83 | 2.33 | 0.098 (0.016) | 2.92 → 1.87 | 2.10 → 1.41 | the blur the tjank lane fixed |
| A · scale 0.85 / 0.90 / 1.0 | 1.80 / 1.82 / 1.81 | 1.82 / 1.79 / 1.75 | .162 / .169 / .156 | 2.96→2.75 / 2.97→2.79 / 2.95→2.88 | | ∪ 9.2 / 10.0 / 12.1 ms vs 7.9 |
| B · sharp direct 0.77 / 0.85 | 1.80 / 1.72 | 1.79 / 1.76 | .156 / .157 | 2.98→2.89 / 3.24→2.88 | 2.24→2.17 | ∪ +1.9 (0.85: 11.3) |
| C2 · history de-blur 0.5 / 1.0 (linear-space cut) | 1.81 / 1.80 | **1.73 / 1.59** | .168 / .171 | 2.96→2.98 / 2.96→3.28 | 2.08→2.30 / 2.07→2.62 | free; 1.0 = sharper in motion than the OLD renderer at ¾ of its crawl |
| C2 · motion clip 0.5 alone / with de-blur 1.0 | 1.84 / 1.82 | 2.16 / 2.07 | .186 / .191 | →2.37 / →2.58 | | the clip narrows the wrong way: worse |

**D — the ReSTIR residuals, re-measured with the tube held STEADY** (noise battery, high; sd = per-pixel temporal sd of 8-bit luma over the frames; 'st'
= scene A's tube steady at 15 % / 100 % instead of strobing; floorGlass = scene D's lamp-lit floor by the window; Δ = mean |Δ| frame to frame — ≈ 1.13 sd
for white noise, ≪ sd for crawl; the still tiles' low-frequency part = sd of an 8-frame running mean):

| variant | desk grain lit / dim (steady) | rug dim | floorGlass sd · Δ | cub floor sd (low) | cub chair | far lino | cor shadow | V1 foot pen | direct ms | ∪ ms |
|---|---|---|---|---|---|---|---|---|---|---|
| main (ReSTIR, high's 4 rays / 3 taps / M 20) | 0.23 / 0.42 | 0.17 | 0.385 · 0.057 | 0.093 (0.061) | 0.085 | 0.055 | 0.056 | 0.174 | 2.56 | 7.93 |
| **ReSTIR OFF (leader / tail path)** | 0.16 / **0.47** | 0.28 | **0.084** · 0.022 | 0.012 (0.007) | 0.035 | 0.008 | 0.026 | 0.116 | 4.39 | 10.55 |
| D2 · spatial reuse everywhere (`restirSpatialAll`) | 0.22 / 0.49 | 0.24 | **0.244** · 0.047 | 0.064 (0.041) | 0.066 | 0.046 | 0.041 | 0.148 | 3.02 | 8.39 |
| D5 · M cap 4 / 8 inside penumbrae | 0.23 / 0.45 · 0.24 / 0.43 | 0.21 · 0.20 | 0.356 · 0.519 | 0.086 · 0.097 | 0.085 · 0.098 | 0.057 · 0.058 | 0.051 · 0.068 | 0.248 · 0.255 | 2.56 | 7.9 |
| D1 · second fresh ray inside penumbrae | 0.24 / 0.42 | 0.19 | 0.400 · 0.064 | 0.095 (0.063) | 0.126 | 0.133 | 0.074 | 0.190 | 3.02 | 8.39 |
| D1 + D5 (cap 6) · D1 + D2 | 0.23 / 0.44 · 0.23 / 0.50 | 0.20 · 0.25 | 0.327 · 0.252 | 0.083 · 0.072 | 0.122 · 0.098 | 0.148 · 0.110 | 0.079 · 0.061 | 0.215 · 0.149 | 3.21 · 3.34 | 8.7 · 8.9 |
| D4 · permutation sampling (± M 8) | 0.24 / 0.43 (sq4 1.96 / 2.03) | | 0.744 · 0.697 | 0.118 | 0.130 | 0.035 | 0.104 | **0.606** | 2.56 | 7.9 |
| rays 5 · rays 6 · M 8 everywhere (sq4 rows) | | | 0.348 · 0.388 · 0.526 | 0.072 · 0.125 · 0.103 | 0.084 · 0.224 · 0.107 | 0.046 · 0.062 · 0.032 | | 0.242 · 0.249 · 0.257 | | |
| known-dark off · audit 1.0 · gradient off (sq4 rows) | | | 0.474 · 0.411 · 0.401 | 0.398 · 0.100 · 0.092 | 0.302 · 0.090 · 0.084 | 0.260 · 0.057 · 0.049 | | | | |

Two findings. (1) The 'desk dim grain 1.9 vs leader 0.3' residual of the tjank note is NOT grain: with the tube held steady at its dim level the desk under
it reads 0.42 under ReSTIR and 0.47 under the leader path (the rug 0.17 vs 0.28 — ReSTIR is the quieter estimator there). What the strobe measured was
every-other-frame JUMP dynamics (the shadow client's jump path + reservoirs meeting a 14 Hz square wave), which no history-based chain renders as anything
but pumping — the authored strobe pattern is the lever (tjank's parked call: dropouts that hold ≥ 5 frames), not the estimator. (2) The real ReSTIR residual
is the slow CRAWL on broad-lit floors: the lamp-lit floor by the window 0.385 vs 0.084 (4.6×, Δ per frame a seventh of the sd: red noise), the worn lane
under the cubicle panels 0.093 vs 0.012, the break room's far lino 0.055 vs 0.008 — hundredths to tenths of a level, i.e. visible only as a faint drift in
large flat mid-tones, but it is what 'boiling near the window' was. Of the levers: spatial reuse everywhere (D2) cuts it by 37 % (and every static tile
by 20–35 %) for +0.46 ms of direct at high, at the documented price — a neighbour's visibility standing in for ours softens hard CONTACT shadows by up to
the 16-px radius where history is old (p2a §design; the contact-edge width check is in §3's edge table: kbShadow) and slightly slower flicker tracking
(scene A rug lit / dim 40.4 / 15.4 vs 42.4 / 14.4, ref 43.9 / 14.9); shortening the memory (D5, M 8) or adding a second fresh ray where the hint says
penumbra (D1) makes every tile NOISIER (the estimate's variance is per-frame there, and the crawl is not the reservoir's random walk but the belief /
tile-level structure p2a §5 describes — known-dark off is 4× worse again); permutation sampling (D4) is a disaster in this estimator (its re-trace drops
the swapped-in neighbour's sample as 'visible then occluded' across every penumbra: histories reset, 0.6 sd on the foot penumbra). D3 (a deterministic
leader ray for the top light + ReSTIR for the tail) was not built: under the steady tube the top light is fully visible where the grain was reported (a
ray on it buys nothing) and the floor crawl lives where NO light dominates. Recommendation in §7: D2 as an opt-in per tier where the 0.5 ms exists
(ultra), the knobs left as rows; the honest lever for the floor crawl remains p2a's 'more fresh visibility where the live weight is spread over several
partially-visible lights', i.e. a targeted candidate count, which D1's blunt version shows must be gated better than 'hint > 0'.

**C — the resolve rethought** (high; every C row keeps main's cost except the C3 rows = sharp direct + GBAA ≈ +1.9 ms union):

| variant | width still | width MOTION | crawl (still) | desk hp still → motion | per-edge crawl partTop · partTopN · kbFar · kbTop · deskFront | noise: V1 foot / cub chair / cub floor / far lino / floorGlass | ∪ ms |
|---|---|---|---|---|---|---|---|
| main (C1) | 1.84 | 1.87 | 0.158 (0.016) | 2.92 → 2.68 | .23 · .17 · .16 · .11 · .12 | .174 / .085 / .093 / .055 / .385 | 7.93 |
| C2 de-blur 0.5 | 1.84 | 1.73 | 0.166 (0.018) | 2.88 → 2.98 | | ≈ main | 7.93 |
| C3 = sharp + GBAA + jitter OFF, α .06 (c3n) | 1.70 | 1.84 | 0.133 (0.002) | 3.30 → 2.82 | .21 · .27 · .08 · .05 · .05 | .187 / .101 / .116 / .052 / .482 | 9.96 |
| C3 + de-blur 0.5 (c3h) | 1.71 | 1.74 | 0.130 (0.002) | 3.29 → 3.01 | | .180 / .103 / .117 / .048 / .482 | 10.03 |
| **C3j = sharp + GBAA + DECOUPLED jitter** (c3j) | 1.79 | 1.76 | **0.109** (0.002) | 3.25 → 2.80 | .20 · .17 · .08 · .04 · .05 | | 9.83 |
| **C3j + de-blur 0.5 (c3jh)** | 1.78 | **1.67** | **0.109** (0.002) | 3.23 → 3.02 | .20 · .17 · .08 · .04 · .05 | .185 / .076 / **.070** / **.024** / .423 | 9.83 |
| C4s = sharp + GBAA + jitter ON (both rasters) | 1.88 | 1.83 | 0.133 (0.017) | 2.60 → 2.45 | .23 · .21 · .10 · .06 · .06 | | ~10 |
| C4s + de-blur 0.5 | 1.89 | 1.76 | 0.132 (0.016) | 2.59 → 2.67 | | .176 / .078 / .068 / .028 / .419 | ~10 |
| C4 = GBAA under plain TAAU (0.77, jitter on) + de-blur | 2.05 | 1.85 | 0.125 (0.018) | 2.20 → 2.49 | | | 8.1 |
| sharp + jitter off, no GBAA | 1.52 | 1.70 | 0.188 (0.002) | 4.50 → 3.38 | | | 9.8 |
| OLD renderer | 1.51 | 1.63 | 0.216 (0.004) | 3.93 → 3.69 | .31 · .26 · .19 · .17 · .16 | .456 / .169 / .043 / .028 / .354 | 17.4 |

What the C rows say. **C2** (one extra bilinear tap in the resolve) buys back the motion sharpness for nothing: width in motion 1.87 → 1.73 at k 0.5
(1.59 at k 1.0 — past the OLD renderer's 1.63 — at +8 % crawl); stills untouched. **C3** as first specified (jitter simply OFF under sharp direct) is the
crispest still (1.70, desk detail 3.30 vs 2.92) with a third less crawl than main on the box edges GBAA owns (kbFar .16 → .08, deskFront .12 → .05) — but two
defects the numbers under-sell and the crops show (§5): (a) every HARD SHADOW EDGE computed at internal resolution now lands on the output raster as a
stair-step (the monitor stand's contact shadow, iqp_h_c3h_kb_s): the jitter had been supersampling the stochastic terms' edges too, not just geometry;
(b) 20–35 % more temporal noise in penumbra tiles (nothing decorrelates successive frames' internal samples any more, and the 1 : 1 EMA at α .06 holds
less than the jittered resolve's effective accumulation). **C3j — decoupled jitter** (14b9927) fixes both: the OUTPUT raster (geometry, exact U, composite,
GBAA, the 1 : 1 resolve) runs on the camera's unjittered matrices while the INTERNAL raster keeps the full ±½-internal-px Halton jitter (every internal ↔
output texel map adds the difference, `frame.sharpCfgC`); hard shadow edges settle smooth in the resolve's history again, geometry is rock-still for GBAA,
and the crawl drops to **0.109** — half the old renderer's, 30 % under main, the partition crease back to main's .17 — with LESS noise than main on the broad
floor tiles (cub floor .070 vs .093, far lino .024 vs .055; the internal jitter decorrelates what the still output raster then integrates). With C2 on top
(c3jh) the motion width is 1.67 (old 1.63) and still detail 3.23 (main 2.92; old's 3.93 includes its aliasing energy). What C3j does NOT do: SUB-PIXEL box
faces (a keyboard's 2 cm side at 9 m, a sheet of paper's edge) have no pixel centre to land on part of the time and render DASHED / aliased where a jittered
raster integrates them into a faint continuous line — GBAA cannot antialias what the raster did not draw (Persson's stated limit); the crops show it on the
V3 keyboard (iq_c3j_kb_s150 vs iqp_h_main_kb_s). It is exactly the old renderer's rendering of the same faces (which had no AA at all), so relative to the
renderer the maintainer liked it is a wash, relative to main it is the one visible price. **C4** (GBAA under a jittered raster): with sharp direct (C4s) it
keeps the slivers integrated and takes two thirds of C3's crawl reduction, but pre-blended edges fed to a jittered resolve are blended twice — stills come
out SOFTER than main (1.88, detail 2.60); under plain TAAU at 0.77 (C4) GBAA at internal resolution then upscaled is softer still (2.05). GBAA wants a 1 : 1
unjittered raster; C4 is not recommended at any tier.

## 4. Fast physics — how much of twopointfive's problem is here (high, docs/perf/chaos-high*.json; `__chaos`)

Method (tools/qa/chaos-scenes.js): each scene is a deterministic game-frame sequence captured under a variant AND under a history-free reference (the pre-v3
chain at scale 1.0, direct history 0, the gather's Temporal flag down: every frame stands alone — used only to say WHEN each receiver pixel's true value
last changed); receivers = static-geometry pixels in every frame of both (the g-buffer's id read back, movers dilated 2 px and excluded). Per swept pixel
(reference range ≥ 16 levels over the take): lag = frames from the truth settling to the run reaching its OWN final value ± 8; residue +N = |run − its own
final| N frames after the truth settled (8-bit levels); boil = temporal sd of never-swept receivers; onObj = mean |run − ref| on the mover's own pixels.

| scene (speed) | variant | lag mean / p90 / max (frames) | trail = lag × px/frame | residue +1 / +2 / +4 / +8 (levels) | boil static (ref) |
|---|---|---|---|---|---|
| **P0 a man WALKING through a torch beam (1.4 m/s, 8.5 px/f)** — wall | main | 1.12 / 5 / 28 | 9.5 px | **10.9 / 11.4 / 7.6 / 1.3** | 1.00 (1.49) |
| | C3jh | 0.71 / 3 / 28 | 6.1 px | 5.1 / 4.9 / 5.1 / 1.4 | 0.77 |
| P0 — the lit lino under the beam (haze shafts move too: boil is not comparable) | main · C3jh | 1.29 · 1.18 | 11 · 10 px | 6.1 / 5.9 / 5.3 / 7.3 · 4.8 / 4.8 / 5.3 / 7.6 | — |
| **P0p the same walk under the corridor PANELS only** | any | — | — | no lino pixel changes by ≥ 8 levels: a walking man's shadow under the broad panels is too soft to trail | 0.10 (0.38) |
| P1 storage door KICKED in, corridor light wedge on the dark floor (leaf tip 8.3 m/s; exposure ×2.5 for the take) — floor | main | 0.39 / 1 / 16 | 14 px (2.2 px per m/s) | 1.7 / 1.1 / 1.0 / 0.8 | 1.63 (0.74) |
| | C3h | 0.35 / 1 / 17 | 12.5 px | 1.3 / 1.0 / 0.9 / 0.8 | 1.63 |
| P1 — round the leaf itself (disocclusion) | main · C3h | 1.44 · 1.07 | 67 · 49 px | 9.2 / 1.7 / 0.8 / 0.7 · 5.4 / 1.7 / 0.8 / 0.6 | |
| P2 stun can UNDER the desk lamp, 10 cm over the desk (4.0 m/s = 40 px/f) — desk | main | 0.50 / 1 / 17 | 20 px (4.9 px per m/s) | 1.7 / 1.2 / 0.85 / 0.5 | 0.30 (0.13) |
| | C3jh · E1 off | 0.54 · 0.50 | 21 · 20 px | 1.8 / 1.5 / 1.1 / 0.7 · = main to the third decimal | |
| P2b the can through the torch beam in haze (4.7 m/s) | main · C3jh | 0.01 · 0.00 | < 1 px | 0.4 / 0.2 / 0.1 / 0.0 · 0.5 / 0.3 / 0.1 / 0.0 | 0.15 (0.61) |
| P3 a man SHOT in the beam, folding through it | main | 0 | — | 0.10 / 0.10 / 0.08 / 0.06 (a body folds at 1–2 m/s: nothing lags) | — |
| P4 desk chair SHOVED through the panels' light (2.0 m/s, 8.4 px/f) — lane | main | **1.60 / 3 / 14** | 13 px (6.7 px per m/s) | **11.2 / 5.3 / 2.6 / 1.5** | 1.12 (1.16) |
| | C3h | 1.71 / 3 / 15 | 14 px | 12.5 / 6.4 / 3.6 / 2.0 | 1.06 |
| P5 P2's throw while 6 mags + 4 cans spawn and go under it (list churn) | main · E1 off | 0.50 · 0.50 | 20 px | identical to the third decimal — at 40 px/frame the can is wholly disoccluded every frame, so its own vector is moot; receivers never depended on it | |
| P6 32 debris boxes tumbling in the cubicle aisle (≤ 3.4 m/s) | main | 0.12 / 1 / 10 | 1.8 px | 1.4 / 1.1 / 0.7 / 0.5 | 0.27 (0.48) |
| | C3jh · (C3h, jitter off) | 0.12 · 0.09 | 1.9 · 1.3 px | 1.5 / 1.2 / 0.9 / 0.6 · 0.4 / 0.8 / 0.9 / 0 | 0.38 · **4.19** |

P6 cost vs N (high, cost-only takes, union mean / p95 ms; calm cubicles still = 7.93): N 8 → 8.51 / 8.65 · 16 → 8.76 / 9.44 · 32 → 8.99 / 9.44 · 64 → 9.92 / 10.55
(direct 2.71 → 3.43, g-buffer 0.20 flat, taau 0.25 flat): ≈ +0.03 ms per tumbling shadow-casting box — 64 of them cost less than the rifle's weapon light.
Under C3jh the same curve sits +2.0 higher (10.5 → 11.9).

## 8. Legacy paths the recommendation would let us delete (inventory only — the maintainer signs off before anything goes)

Every v3 "off" switch below is today (a) an identity A/B against pre-v3 main and (b) one leg of the OLD-renderer reference the instruments of this program use
(`__iq` 'old', tjank's `allOff`, `__chaos` REF). Deleting any of A–D ends the ability to reproduce pre-v3 main in-tree; before D or A go, `chaos-scenes.js REF`
must be re-defined on v3 (restirHistory 1, dnShadowCap 0 / directHistory 0, Temporal flag off, froxelHistory 0, TAA reset per frame). Line numbers as of ba47c04.

| item | whole files | other src (≈ lines) | flag bits freed | QA / tools affected | identity A/B lost |
|---|---|---|---|---|---|
| **A `?legacydenoise`** (`settings.denoiser 'legacy'`) | dtemporal.wgsl 59, softblur.wgsl 117, temporal.wgsl 67, giblur.wgsl 41 (= 284; NOT softtile.wgsl — the v3 shadow client runs its `tileDistances`; only `markTiles` + bindings 0–2 ≈ 20 lines are legacy) | passes.ts ≈ 150 (STRIDES / buildChain / chainSkipT, lSoft / lTileFlags / lDTemp / lTemp / lGiBlur, 13 pipelines, their bind groups, the legacy shadow branch + gather-grid branch in encode, dnMode / dnSwitch, `dDepthHist[2]` r32f ≈ 14 MB at high + `nearest32f` in texpool / resample.wgsl), engine.ts ≈ 10 (`denoiser`, `directPasses`, the `dnMode === 'v3'` guard), main.ts / bindings.ts ≈ 6 (the toggle, 'spatial passes' row — already inert by default, HUD 'dtemporal' entry — never timed) | GiAdaptiveHist (read only by temporal.wgsl — already inert under v3) | p3-harness.js (315) is a legacy-vs-v3 instrument → retire or re-default; `ALL_SKIP_T` re-derived from `dnTravel`; `softTileStats.steps` | "dtemporal + softblur, temporal + giblur and the gloss chain byte for byte" |
| **B `?notaau`** (`settings.taau false`) | none (fxaa.wgsl keeps the final blit; its FXAA body ≈ 55 of 107 lines goes → mode 2 only) | passes.ts ≈ 25 (taauOn wrappers, lone-hdr bloom/post groups, blit mode, fxaaEnabled), engine.ts ≈ 15 (the `taauOn ?` ternaries, taauWas, `dropRestirBeliefs` else-arm), camera.ts 2 (`FollowCamera.prevViewProj`), quality.ts ≈ 5 (`startScale(p, taauOn)`, plan's taauOn), menu / bindings / main ≈ 6 | — | sharp-page variant (d), p3/p4/p5 validate 'taau off' steps, restir-bench :195 | "the old chain byte for byte, `__png`-identical to main"; the pause card's 'fair A/B at 1.0 without TAAU'; NO temporal-free presentation path remains (maintainer's call whether FXAA-as-option matters for `__png` A/Bs) |
| **C `?norestir`** (`settings.restir false`) | direct.wgsl 309 (KEEP direct_common.wgsl — restir + sharp_direct prepend it; KEEP `lDirect` — it is restir's group 1 too) | passes.ts ≈ 10 (pDirect, restirOn branch, hotSwapDirect 'direct' arm), engine.ts ≈ 15 (`restir`, dirMasks always, `ratioHi` constant 4, `cueUv` true, dead settings directSamplesTop/Other/AdaptiveMin/checkerDirect/dimRays/dimRaysBelow/directSeedHold + their frame writes), frame.ts / common.wgsl 8, quality.ts ≈ 15 (`Preset.ds`, Lossy checker / dim, FACTOR checker/dim/rays, the leader/tail cost arm), bindings / menu ≈ 19 (ReSTIR toggle, LOSSY checkerboard, dimRays + threshold, rays strongest/other, seed hold, adaptive min, tail chroma, the 'Shadow rays per pixel' BUDGETS select), main.ts 3 | CheckerDirect, DirectSeedHold, TailChroma, Restir (4) | restir-bench meter / identityCapture / stressAll off-arms ≈ 80, `__iq d_leader`, quality-plan ds/checker/dim columns, perf / materials probe fixtures | "direct.wgsl's leader / tail estimator bit for bit"; the ReSTIR-vs-leader cost table; the light-meter-independence check's OFF arm; REF.direct wants re-baselining (FACTOR.restir is a ratio to it) |
| **D `?nofroxel`** (`settings.froxelVol false`) | none in src (KEEP froxels.ts / froxel.wgsl); volumetrics.wgsl loses ≈ 275 of 514 lines (smokeSelfShadow, VOL_KMAX, the whole non-froxel smoke march in both K variants, the whole haze-beam block incl. the kind-2 sun march), vol_common.wgsl `smokeTransIn` 18; QA froxel-ab.js 102 retires | composite.wgsl 8 (the two `else upsampleVol` arms), particles_draw 1, engine.ts ≈ 10 (`froxelVol`, dead `volSteps` / `volLightCap` / `volShadowEvery` — `volStepVoxels` stays for smokeMarchJ), quality.ts ≈ 5 (`Preset.volSteps`, `Caps.volK / volEvery`, `REF.vol20`), bindings ≈ 4 (froxel toggle, beam steps, two CAP rows), main.ts 3 | FroxelVol (with care: today it also means 'grid allocated'; keep it or make composite / particles always take `froxelVol()` against the 1×1×1 clear-air dummy) | froxel-scenes `-march` arms ≈ 12, stress-scene `caps(false)` volLightCap 0 becomes meaningless, perf / materials probe fixtures, quality-plan volSteps | "the per-pixel volumetric march byte for byte"; `__froxab` cost tables; the p2b look rigs' march arms |
| **E sharp direct's `sharp_edge.wgsl` experiment** (`settings.sharpEdgeRays`, default off, measured a wash) | sharp_edge.wgsl 46 | passes.ts ≈ 28 (edgeRays, sharpMask r32uint target, pSharpUE / lEdge / pEdge / bgEdge, lSharpU bindings 10–11, the sharpEdge pass), sharp_direct.wgsl ≈ 31 (EDGE_RAYS arms; it then no longer needs shadowSample / glassVis), engine.ts 5 (sharpEdgeRays / Spread / HintPx, sharpCfgB.xyz → spare), bindings 3, main.ts 3 | — | — | none (default off) — sharpU then compiles once |
| **F dead-regardless A/B knobs** (maintainer's call) | — | ≈ 70: `taauLightJump` (measured useless), `taauMotionClip` (adds nothing), `restirRatioRaw` (superseded rule), `restirSampleHue` (the first-cut mosaic), `restirCoherent` (off everywhere), `restirSpatialAll`\* / `restirGradient` off-arm / `restirKnownDark` off-arm (A/Bs of shipped behaviour), `DirectSeedHold` + `GiAdaptiveHist` + `TailChroma` estimator arms (inert on the default path already), `directPasses` row, HUD 'dtemporal'; NEW this program and also A/B-only: `restirPermute` (D4, measured much worse), `restirPenCap` / `restirPenRays` (D5 / D1, measured worse) | (3, counted in C) | — | — |

\* keep `restirSpatialAll` if the ultra recommendation adopts D2.

Totals if all of A–F went: ≈ 640 lines of whole files + ≈ 830 other src lines ≈ 1 470, up to 6 flag bits (the table has none free today), 14 boot pipelines, ~14 MB of
targets at high, ≈ 500 QA lines retired / adjusted. What the sharp path costs to KEEP (not legacy — the recommendation depends on it): composite.wgsl and taau.wgsl each
compiled twice behind `const SHARP` (20 + 1 sites), sharp_direct.wgsl = a third copy of the unshadowed-U scoring loop (beside restir.wgsl and direct.wgsl — two once C
goes) that must track evalLight / tile-cull / glass changes, gdown.wgsl + the g-buffer's O set, ≈ 120 lines in engine / passes; ≈ 500 live lines in two variants.

## 5. The other tiers (same instruments; widths / crawl in each tier's OUTPUT px — ultra 2133×1200, medium 1600×900, low 1280×720, verylow its 600-row cap)

| tier | variant | width still | width MOTION | crawl (still) | desk hp still → motion | noise cub floor / far lino / floorGlass / V1 foot | calm ∪ ms | stress ∪ mean / p95 |
|---|---|---|---|---|---|---|---|---|
| **ultra** | main (TAA at 1.0) | 2.07 | 1.89 | 0.161 (0.011) | 2.91 → 2.68 | .073 / .035 / .275 / .160 | 20.84 | 25.6 / 27.0 |
| | C2 de-blur | 2.02 | 1.78 | 0.165 | 2.85 → 2.85 | ≈ main | 20.84 | 25.7 / 27.3 |
| | C3 at 1.0 = GBAA + jitter off (c3u) | 1.91 | 1.76 | 0.122 (0.002) | 3.00 → 2.83 | .112 / .057 / .316 / .182 — noisier, stair-stepped shadows | 20.64 | |
| | **C3j at 0.9** (sharp + GBAA + decoupled + de-blur) | 1.99 | 1.80 | **0.105** (0.002) | 2.94 → 2.83 | **.057 / .025** / .296 / .170 | **20.58** | **24.6 / 26.1** |
| | D2 spatial reuse everywhere | = main | | | | .039 / .040 / **.163** / .124 | 22.68 | |
| | OLD renderer | 1.69 | 1.85 | 0.208 | 3.61 → 3.43 | | 24.18 | |
| **medium** | main (0.67) | 2.15 | 1.90 | 0.151 (0.030) | 2.16 → 2.75 | .130 / .103 / .473 / .185 | 5.44 | 7.6 / 8.2 |
| | C2 | 2.17 | 1.69 | 0.152 | 2.13 → 3.20 | | 5.44 | 8.3 / 8.9 (= main; the pair's A read 8.4) |
| | **C3j** (c3jh) | **1.59** | **1.53** | **0.088** (0.003) | **3.58** → 3.40 | **.080 / .024** / .589 / .222 | 6.88 | 9.3 / 9.8 |
| | A scale 0.77 | 1.65 | 1.72 | 0.152 | 3.29 → 3.04 | | 6.36 | |
| | C4 GBAA under the upscale + de-blur | 2.64 | 1.92 | 0.101 | 1.66 → 2.65 | | | |
| | OLD | 1.44 | 1.51 | 0.208 | 4.13 → 3.94 | | | |
| **low** | main (0.6) | 2.18 | 1.85 | 0.152 (0.022) | 2.21 → 3.01 | .179 / .127 / .663 / .218 | ≈ 4.9 (takes contended; stress →) | 5.6 / 8.2 |
| | C2 | 2.14 | 1.57 | 0.148 | 2.21 → 3.48 | | | 5.8 / 7.5 |
| | **C3j** (c3jh) | **1.46** | **1.31** | **0.083** (0.003) | **4.18** → 3.99 | **.125 / .052** / .733 / .249 | 4.13 | 6.2 / 7.3 |
| | C3j at 0.5 (iso-cost) | 1.45 | 1.42 | 0.104 | 4.21 → 4.02 | | 3.60 | |
| | A scale 0.7 | 1.50 | 1.62 | 0.148 | 3.92 → 3.39 | | 3.74 | |
| | OLD | 1.17 | 1.29 | 0.191 | 4.63 → 4.41 | | 8.13 | |
| **verylow** | main (0.5) | 2.42 | 1.94 | 0.162 (0.023) | 2.22 → 2.92 | .180 / .141 / .809 / .280 | 2.88 | 5.3 / 9.2 (takes contended at this load) |
| | C2 | 2.49 | 1.77 | 0.159 | 2.23 → 3.44 | | | 6.0 / 9.0 |
| | **C3j** (c3jh) | **1.39** | **1.44** | **0.083** (0.004) | **4.60** → 4.36 | **.142 / .062** / .823 / .303 | 2.88 | 5.8 / 8.7 |
| | A scale 0.6 | 2.11 | 1.84 | 0.153 | 2.44 → 3.12 | | | |
| | OLD | 1.25 | 1.17 | 0.196 | 5.08 → 4.70 | | 5.24 | |

The pattern down the tiers: the deeper the upscale, the more C3j buys — still width 2.07 → 1.99 at ultra, 1.84 → 1.78 high, 2.15 → 1.59 medium, 2.18 → 1.46 low, 2.42 → 1.39
verylow; desk detail +1 % / +11 % / +66 % / +89 % / +107 %; crawl roughly halved everywhere (0.105 / 0.109 / 0.088 / 0.083 / 0.083 vs 0.15–0.16). Its cost is per OUTPUT
pixel (sharpU + compS + gbaa ≈ 2.6 ms at ultra's 2133×1200, 1.9 at high, 1.5 medium, 0.9 low, 0.7 verylow, M4 Max) while everything it makes look better is the cheap internal
raster — so at medium and below the iso-cost move is C3j at ONE NOTCH LESS internal scale (low: C3j at 0.5 = 1.45 / 1.42 / 0.104 for 3.6 ms vs main's 2.18 / 1.85 / 0.152;
the auto ladder does exactly this by itself since the cost model carries the two kernels as fixed output-size work). Noise: C3j is quieter than main on every broad-floor
tile at every tier (the internal jitter decorrelates what the still output raster integrates) and 10–30 % noisier on the V1 close-up penumbra / keyboard tiles at low and
verylow (fewer internal samples per output pixel and no jitter blur to hide them); the lamp-floor crawl (floorGlass) is +10–25 % under sharp direct at every tier (the
1 : 1 EMA smooths less across pixels than the jittered resolve did) — the D2 knob addresses that one where wanted.

## 6. Recommendation — one configuration per tier (quality.ts `Preset.iq`, 3f7d5b7)

The rule first (the maintainer's, verbatim in §0): rank on the calm cases, choose per tier on those, let the physics scenes produce a budget, and take no fast-occluder fix
that costs anything calm. On the calm cases ONE configuration wins every sharpness / stability column at every tier and is at or under main's noise on the broad surfaces:

    IQ_C3J = { sharp: true, decouple: true, gbaa: true, histSharp: 0.5 }     — sharp direct + DECOUPLED jitter + GBAA + the history de-blur
    ultra    iq: IQ_C3J, scale 1.0 → 0.9   (sharp direct needs an internal / output split; 0.9 + C3j beats 1.0 + TAA on every column for the SAME calm cost — 20.9 vs 20.8 — and 1.0 ms less in the stress minute)
    high     iq: IQ_C3J                     (+1.9 ms calm 7.9 → 9.8; stress minute → below)
    medium   iq: IQ_C3J                     (+1.4 calm 5.4 → 6.9; stress 7.6 → 9.3 mean, 8.2 → 9.8 p95)
    low      iq: IQ_C3J                     (+0.6 stress mean 5.6 → 6.2; iso-cost = one notch of internal scale, which auto takes by itself)
    verylow  iq: IQ_C3J                     (+0.5 stress mean 5.3 → 5.8)
    IQ_OFF / ?noiq = the resolve as it was — main's frame hash for hash at every tier (high c8f100ac / 57606578, medium a43a8d44 / 7f73ac88 on the final build).

The preset diff is exactly: `Preset.sharp: boolean` → `Preset.iq: IqTier`; the five rows `iq: IQ_C3J`; ultra `scale: 1.0 → 0.9`; `apply()` writes sharpDirect / sharpDecouple /
gbaa / taauHistSharp from it (`?nosharp` drops sharp + its two riders, `?sharp` / `?gbaa` force on, `?noiq` all off); `presetCost` adds REF.gbaa 0.15 to the sharp term;
the calibration counts 'gbaa' as fixed output-size work. quality-plan: M4 Max → high ×0.77 (14.7 ms model, fits), M1-class HiDPI → low ×0.5 / verylow as before, 0 FAIL.
What the maintainer should look at before merging (taste, not numbers): the sub-pixel sliver rendering (§3 / the page's keyboard crops) — the one place C3j looks like the
OLD renderer rather than like main.

Not recommended: C4 at any tier (softer than main); D2 as a default (contact-shadow bias; kept as the row `restirSpatialAll` — worth it at ultra for whoever minds the
window-floor crawl more than contact crispness); D1 / D4 / D5 (measured worse); resolution alone (A: +50 % cost for a few hundredths of a pixel under TAAU).

## 7. Residuals, and what was deliberately not done

- **Sub-pixel slivers under C3j** render dashed / aliased (a keyboard's 2-cm side at 9 m, a paper's edge) where main's jitter integrates them — GBAA cannot antialias what
  the raster did not draw (Persson's stated limit); exactly the pre-v3 renderer's rendering of the same faces. Thin EMISSIVE lines (tripwires, weapon lasers, tracers)
  already widen to a pixel and dim by the same factor; under the decoupled raster game.ts `mPerPx` now takes an OUTPUT pixel at 1.6× the look-at depth so beams stay
  continuous (`sharpOn && sharpDecouple` only — the sharp-off path is untouched). Static slivers: widen in the level or a conservative edge in fsBox; not built.
- **Hard moving shadows trail 1–2 frames** (§4). E2 not built; its global proxies (dnShadowCap 12 → 6, ReSTIR M 20 → 8) made P0's residue WORSE (18.4 / 11.5 and 20.5 /
  15.8 at +1 / +8 vs 12.3 / 1.9) and P4's no better, at +10–45 % calm penumbra noise: shorter histories are noisier, the variance clamp widens with the noise, the stale
  edge stays longer. The lever is a motion-aware clamp TIGHTENING in the shadow client local to receivers near a mover (a velocity-dilation pass) — not free by construction,
  so by rule (3) parked, nothing on.
- **P4 / P0 under C3j** read worse / better than main by the residue metric while the mover is still moving at the take's end; a crisper edge changes each pixel more per
  frame and the metric books that as residue. Reported both, moved nothing.
- **The lamp-lit floor crawl** (ReSTIR): D2 −37‥41 % for +0.5 / +1.8 ms with contact-shadow bias — a row; the real fix is a better-gated extra candidate (p2a's note); D1's
  blunt gate made everything noisier. **The strobe's desk 'grain'** is jump dynamics (steady tube: 0.42 vs leader 0.47) — the authored pattern is the lever.
- **F froxel apex / trail / lightning**: tjank's numbers stand (dyn C rows here reproduce them: haze f24‥f34 31.7 → 64.6 under every variant); no attempt made in this program.
- **G contact shadows at internal width** under sharp direct: parked since the sharp lane (needs per-light S).
- **The contact-shadow edge in the crawl instrument** (EDGES v1 kbShadow) returned no profiles — the line is misplaced; D2's contact bias is asserted from p2a's design note,
  not re-measured here.
- Cost takes at low / verylow load are contended on this GPU (fat p95 on the calm stills); the stress pairs are the clean numbers there. The pane was shared with other
  lanes and reset twice mid-run; every number on the page comes from a completed, saved take.
- Not touched: the maintainer's :5173, dist/, any push. The `legacy` inventory (§8) deletes nothing.

## 9. Identity, validation, gates (final build 0208a59)

- OFF = main byte for byte: `__sh.identityHash` with `?noiq` (every IqTier member off; motionIds ON) on this build vs main @ 6551c66 served beside it at the port
  stage — high v3 `c8f100ac` / v1 `57606578`, medium `a43a8d44` / `7f73ac88`, identical; re-taken after every commit of the program (last on 0208a59's parent with the
  presets already switched: `?noiq` gives the same two pairs). Low `9be3a4b1`, ultra `109ff2c8`, verylow `5456b891` recorded for the branch.
- GPU validation: error scopes clean across ultra / high / medium / low / verylow × debug views 0 3 4 9 11 12 13 14 15 16 × render scale 1.0 / 0.85 / 0.6 / 0.77 × toggling
  sharpDecouple / gbaa / sharpDirect / taauHistSharp 0‥1 / motionIds / restirPenCap / PenRays / Permute / SpatialAll / taau off-on / sharpEdgeRays × preset hops
  ultra → verylow → high; no page errors; 180 live frames of play at high clean.
- Gates: typecheck clean; `tools/qa/gate.sh perf frame-layout level materials player breach glass weather` all PASS (exit 0); `quality-plan` 0 FAIL (M4 Max → high
  ×0.77, M1-class → low ×0.5 / verylow); `tour --runs 2` 2/2 PASS; `soak --seeds 1,2 --minutes 6` and `--loud-at 1` no violations; `bun run build` OK;
  `probes.ts materials` (Frame 704 → 752, nothing moved) PASS.

### Re-measured on the fixed build (6d843ef: GBAA's far-edge encode fix + the other three review fixes) — the finalists, all five tiers

The review of the program found that 7a97581's encode clamp put every interior pixel with a far edge on its −x / −y side inside its neighbour's take-up window (a 49 %
two-tap blend); every C3 row above dated after 7a97581 carried it. Re-measured with the fix, the finalists move by ≤ 0.05 in any column and no conclusion changes
(the C3 / C4 rows NOT re-measured were dropped from docs/perf; the tables the page builds read only what is there):

| tier | variant | width still | width MOTION | crawl (still) | desk hp still → motion | noise cub floor / far lino / floorGlass / V1 foot |
|---|---|---|---|---|---|---|
| ultra | C3j at 0.9 | 2.00 | 1.78 | 0.104 (0.002) | 2.92 → 2.87 | .066 / .030 / .299 / .159 (main .073 / .035 / .275 / .160); calm ∪ 20.9 (main 20.8) |
| ultra | GBAA + jitter off at 1.0 (c3u) | 1.91 | 1.75 | 0.119 (0.002) | 2.97 → 2.85 | .126 / .057 / .340 / .190 |
| high | **C3j (c3jh)** | 1.76 | 1.69 | 0.108 (0.002) | 3.22 → 3.09 | .070 / .026 / .426 / .194 (main .093 / .055 / .385 / .174) |
| high | C3j without de-blur (c3j) | 1.79 | 1.77 | 0.108 | 3.24 → 2.88 | |
| high | C3 jitter off (c3h) | 1.71 | 1.72 | 0.130 | 3.28 → 3.06 | |
| medium | C3j | 1.59 | 1.54 | 0.095 (0.003) | 3.57 → 3.49 | .084 / .025 / .600 / .226 (main .130 / .103 / .473 / .185) |
| low | C3j | 1.50 | 1.31 | 0.084 (0.004) | 4.12 → 4.03 | .113 / .051 / .743 / .246 (main .179 / .127 / .663 / .218) |
| low | C3j at 0.5 (iso-cost) | 1.46 | 1.39 | 0.099 | 4.18 → 4.03 | |
| verylow | C3j | 1.43 | 1.43 | 0.081 (0.003) | 4.54 → 4.39 | .151 / .069 / .826 / .304 (main .180 / .141 / .809 / .280) |

P0 / P6 at high on the fixed build (chaos-high4): P0 wall residue main 6.6 / 5.0 / 3.0 / 2.0 vs C3j 4.6 / 2.7 / 1.7 / 1.5 (the walking-man take varies run to run:
main read 10.9 / 11.4 / 7.6 and 12.3 / 10.3 / 4.7 in the two earlier takes — quote it as 'a frame or two of 5–12 levels'); P6 32 debris boil main 0.38 · C3j 0.28 · ref 0.48.
