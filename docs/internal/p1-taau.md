# P1 — TAAU: temporal anti-aliasing + upsampling in front of the display (2026-08-10, lane `v3/p1-taau`)

Brief: docs/internal/renderer-v3.md / STATUS "RENDERER V3" Phase 1 — replace FXAA + the browser's raw bilinear scale with a temporal resolve that
antialiases AND upsamples, so every tier renders fewer pixels for the same canvas: ultra 1.0 (TAA only) · high 0.77 · medium 0.67 · low 0.6 ·
verylow 0.5 of the cap. Machine / method as the Phase-0 notes: M4 Max, Chrome (the Browser pane) / Metal, dpr 2, this worktree on :5185 (shot sink
:5186), `?paused&quality=…&mute`, the cubicles still (look 23, 0, 19.4 · yaw −0.42 · pitch 0.96 · dist 18, guards parked, phases zeroed), SERIALIZED
frames (one `__runFrames(1)` → `queue.onSubmittedWorkDone()` → MessageChannel yields → the timer's per-frame stamps + `unionMs`), crops = 300-px tiles of
the OUTPUT frame ×3 nearest. The P2a / P2b lanes were rendering on the same GPU all night: tails (p95 / max) of every long take carry their frames
(the signature is every pass inflating at once, bloom included); means / p50 and interleaved A/B blocks are what to read.

## 1. The design as built

**Sizes.** `engine.width/height` stay the INTERNAL size (= min(maxInternalHeight, CSS h × dpr) × renderScale, P0-B's rule). New `engine.outWidth/outHeight`
= the OUTPUT size = the cap's rows at scale 1.0 (min(maxInternalHeight, CSS h × dpr)) — the canvas backing store; the browser scales that to the window as
it always did. So the resolve's cost is bounded by the preset (2133×1200 … 1066×600), 'TAAU high at 0.77' presents exactly the canvas 'high at 1.0' does,
and a render-scale step never touches the output-size targets. (A separate output cap above the preset's rows — resolving to 1440 rows on a HiDPI pane —
is a one-line follow-up in `engine.resize`; not done: it would make the tiers' cost depend on the window again.) TAAU off: output = internal, as before.

**Where the jitter enters.** `engine.render`: Halton(2,3) index `frameIdx % taauPhases + 1` → j ∈ [−0.5, 0.5)² internal px (0 with TAAU off, under a
debug view, or phases 0). `vpJ = T(2jx/W, −2jy/H) · cam.viewProj` (a clip-space translation: content at unjittered pixel s lands at s + j), `invVpJ` its
inverse. The frame uniform's `viewProj / invViewProj / prevViewProj` ARE `vpJ / invVpJ /` the previous RENDER's `vpJ` (TAAU off: the camera's own three,
untouched — the identity below rests on it). Audit of every consumer: the g-buffer rasterises with `frame.viewProj` (boxes + skin) ✓; every screen pass
rebuilds its ray / world point through `worldFromDepth` = `frame.invViewProj` — direct.wgsl (P per pixel), fgather (the texel's full-res pixel), temporal /
dtemporal / giblur / softblur (P + reprojection with `frame.prevViewProj` = last render's JITTERED matrix, which is exactly right for an internal-res
history: the texel it wrote last frame sat at last frame's jitter), volumetrics (Pfar per texel), composite (P, Pfar, the glass ray from camPos to P),
particles_draw (projects with `frame.viewProj` and tests the jittered depth — consistent) ✓; the cascades / probe / smoke / mesh shadows are world-space ✓;
the HUD / overlay / cursor project on the CPU with `cam.viewProj` (unjittered, stable) ✓. Nothing builds a GPU screen ray from `cam.*`. The only unjittered
matrix on the GPU is the resolve's own `prevViewProjU` (its uniform, `passes.setTaauFrame`).

**Motion.** The g-buffer gained a 4th target `gVel` (rg16float): `ndc(prevViewProj·P_prev) − ndc(prevViewProj·P_now)` per fragment — the OBJECT's motion
only, both ends through the same matrix so the camera's share (which the resolve rebuilds exactly from depth) and the jitter cancel. Boxes read their
previous transform from `gbuffer.prevBoxes` (BoxWorld's geo + mat rows copied at the tail of every frame's command buffer, `snapshotPrev`; matched by
INDEX and accepted only if that slot held a box of the same half-extents and owner byte a frame ago — statics always, a leaf / limb / gun in a hand until
the dynamic list shifts), skinned men from `prevJoints` (last frame's palette, same copy). Verified by readback: a sprinting man's pixels carry ≈ −0.02
NDC/frame in x, a still scene ≤ 0.001.

**The resolve** (`render/shaders/taau.wgsl`, compute, 8×8, one thread per OUTPUT pixel; encoded straight after the composite + the particles' splat):
1. its centre in this frame's jittered internal raster → the 3×3 internal texels round it, in a reversible tonemapped space (c / (1 + L·exposure)) and
   YCoCg: a SHARP current estimate (Gaussian on each texel's true sample position in OUTPUT px, k 6 ≈ nearest sample), a wide one (σ 0.67 internal px)
   for pixels with no history, the moments for the clip, the CLOSEST depth of the nine;
2. reprojection of that closest sample through `prevViewProjU` + `gVel` there → 5-tap Catmull-Rom of the output history (`taaHist[1−p]`, rgba16f,
   linear); a still camera skips the matrix round trip (rigid pixels map to themselves bit for bit — a converged still is a fixed point);
3. DISOCCLUSION: the history's alpha holds the view depth of what it shows; any of the 2×2 texels round the fetch must match the depth this point had
   under last frame's camera within ~1 % or the pixel starts over from this frame (the colour clip alone could not tell Sam's dark suit from the dark
   carpet and left his outline behind him — §3);
4. variance clip toward the mean, box = mean ± γσ padded by 3 % / 1.5 % of the local luma (RELATIVE — an absolute pad wide enough for a lit wall held a
   shadow's lag for seconds in this game's near-black floors);
5. blend: new-frame weight = α (0.1) × the nearest sample's ACCEPTANCE (a trapezoid on the output pixel's footprint: full within proxR/3, nothing past
   proxR = 0.75 output px, tightening to 0.55 for the deep upscales) — an output pixel this frame's jitter did not sample closely keeps its history, which
   is the upsampling; × ¼ where the 3×3 is contrasty relative to its own level (anti-flicker on emissive edges, §3); raised where the history sat far
   outside the box, where the surface moved fast (`taauVelK`), and by the REACTIVE inputs: the particles' r8 `react` target (their splat's second colour
   attachment, max-blended: a spark's luminance / a chip's coverage; read only on frames the splat ran) dilated 3×3, and the volumetric pass's `volReact`
   (r32float: the rain / splash / sky-flash radiance it added, as a share of the pixel's light). No history (cut / off screen / first frame /
   disoccluded) = the sharp estimate at ratios ≥ 0.7, the wide one below;
6. → linear radiance + depth into `taaHist[p]`, which bloom (its first downsample), post (AgX at the OUTPUT size; `post.invOut` replaces
   `frame.invScreen` there — same bits with TAAU off) and the final blit read. The blit's FXAA became a mode: 1 = FXAA (TAAU off), 2 = an RCAS-style
   contrast-adaptive sharpen (`taauSharpen`, no halo by construction, noise-attenuated) — grain after either.
Colour space: accumulation in the Karis-weighted space, clip in YCoCg of it, output linear scene-referred so bloom / AgX are untouched. Bloom is built
from the RESOLVED picture at output fractions (stable — no fireflies from a jittered noisy frame — and 0.07–0.13 ms either way).

**Cuts.** `engine.resetTaa(why)`: the eye moved > 2.5 m or turned > 30° between two renders (the follow camera is damped; the tour's / breach's / attract's
cuts and `__stage` jumps all trip it, a 0.6°/frame orbit never does), TAAU or a debug view switched, the first frame; `__taa.resets / lastReset` count
them. Debug views bypass the resolve (plain bilinear upscale, jitter held at 0). An OUTPUT resize (preset cap, window) resamples the pair like P0-B's other
histories; a render-scale step re-makes only the internal targets (26 of 38) and the resolve carries straight on (§4). `passes.setTaau` (mirrored from
the setting each frame) makes / drops the output-size pair; `keepHistories off` = create fresh + reset, the old path.

**Settings / UI.** `taau` (default ON; `?notaau`), `taauAlpha 0.1 · ClipGamma · Phases · Sharpen · Reactive 0.8 · Kernel 6 · VelK 1`; presets carry
`{ scale, taau: { phases, clipGamma, sharpen } }` = ultra 1.0/8/1.0/0.2 · high 0.77/8/1.0/0.25 · medium 0.67/16/1.1/0.4 · low 0.6/16/1.2/0.5 · verylow
0.5/16/1.25/0.5 (`startScale(p, taauOn)`: 1.0 everywhere with TAAU off, so `?notaau&quality=x` is today's x). Tab ▸ Frame rows for every knob + a status
line + 'drop history'; the pause card's trade-offs row; `__taa {on, jitter, resets, lastReset, stats, knobs(), set({…}), reset(), summary()}`; HUD `res`
row '1368×770 ×0.77 of 1000p → 1777×1000 taau'. Cost model: `REF.taau 0.25` filed under FIXED (it scales with the preset's output pixels, not the render
scale; calibration's fixed regex includes it); `plan()` starts each preset at its TAAU scale.

## 2. Cost

Calm cubicles still, serialized, 3 interleaved rounds × 40 frames per variant; A = the preset as it was (TAAU off, scale 1.0), B = TAAU at the tier's scale.
Union of compute passes (= Σ here: serialized frames do not overlap), ms:

| preset | A internal | A union p50 · p95 | B internal → output | B union p50 · p95 | resolve | direct A→B | softblur | gather | vol | Δ p50 |
|---|---|---|---|---|---|---|---|---|---|---|
| ultra | 2133×1200 | 25.63 · 25.73 | 2133×1200 (1.0) | 25.89 · 26.00 | 0.34 | 9.92→9.89 | 4.51→4.54 | 7.92→7.91 | 1.22 | +1 % (the resolve) |
| high | 1777×1000 | 15.69 · 16.30 | 1368×770 → 1777×1000 | **10.31 · 10.73** | 0.24 | 7.26→4.46 | 3.19→1.87 | 2.67→1.70 | 0.99→0.63 | **−34 %** |
| medium | 1600×900 | 12.34 · 12.47 | 1072×603 → 1600×900 | **6.82 · 6.95** | 0.20 | 5.85→2.94 | 2.57→1.07 | 2.21→1.13 | 0.30→0.22 | **−45 %** |
| low | 1280×720 | 8.21 · 8.28 | 768×432 → 1280×720 | **4.92 · 6.47** | 0.15 | 3.60→1.87 | 1.59→0.66 | 1.50→0.88 | 0.24 | −40 % (B runs 5.8 / 4.7 / 4.3: the GPU clocking down between tiny dispatches) |
| verylow | 1066×600 | 5.66 · 7.54 | 533×300 → 1066×600 | 6.42 · 8.43 | 0.21 | 2.11→1.42 | 1.14→0.67 | 1.25→1.01 | 0.24→0.57 | not measurable this way: at ~4 ms of real work the serialized GPU idles and EVERY pass reads slower in B (vol, rc, probe, bloom all up) — needs a presented-fps take on a visible pane |

The resolve itself: 0.34 ms at 2.56 Mpx output · 0.24 at 1.78 · 0.20 at 1.44 · 0.15 at 0.92 (target was ≤ 0.6 at high). The g-buffer's extra target +
two varyings and the frame-tail copies (≈ 330 KB) are inside the render-pass stamp's noise; `?notaau` still pays them (pixels identical, §5).

STRESS — the QRF + rain + two-canister minute of tools/qa/stress-scene.js at high (`fight: false`, 41 lights, 7 lit carried, orbit 0.6°/frame),
docs/perf/p1-stress-high.json:
- the gate take as the lead runs it (`__v3gate.serialized(300)`, TAAU on = the new default): union mean **16.06** · p50 **15.01** · p95 21.43 · max 35.3
  — against the provisional Phase-0 table's high 21.7 · 21.6 · 23.5 · 32.4 (mean −26 %, p50 −30 %; the max / p95 frames are the shared-GPU signature:
  softblur 12, gather 10.7, temporal 8.1, smoke 10, bloom 7.7 ms in single frames);
- interleaved A/B over the same evolving minute (4 blocks × 75): A (off, 1777×1000) Σ mean 22.71 · p50 22.35 · p95 25.95 · max 27.5 → B (TAAU 0.77)
  **16.90 · 16.19** · 23.2 · 37.0; direct 9.87 → 6.63, volumetrics 2.91 → 2.23, gather 3.49 → 2.27, softblur 3.24 → 2.20, taau 0.26.
The program bar (high union p95 ≤ 14) is not met by the pixel cut alone — direct is still 6–6.6 ms at 1368×770 in that minute; that is P2a's line.
(tools/qa/v3-gate.js listed 'taau' among the RENDER passes to exclude — it is a compute pass with honest stamps; fixed to count it.)

## 3. Quality — the crops (docs/shots/p1/, all ×3 tiles of the output frame; 'today' = the preset as it was)

- **Static, converged, high** (static-high-desk / -chairs): TAA at 1.0 is the same picture with clean edges (the desk edge's and the monitor's staircases
  gone, book spines as crisp); TAAU 0.77 → 1777×1000 keeps the clean edges and is a touch softer in the finest detail (spines, the paper's corner) — the
  first build was a 3×3 tent smeared into every frame (a k-2 Gaussian; visibly blurrier than FXAA even at 1.0), fixed by separating a sharp reconstruction
  from a box acceptance (8dd92aa).
- **Slow orbit 0.6°/frame, frame 60** (orbit-high-*): edges stay antialiased in motion, no trailing on static geometry (camera motion reprojects exactly);
  0.77 mid-orbit is slightly softer than its still (Catmull-Rom resample per frame + fewer settled samples) — still cleaner than FXAA's crawl.
- **A man moving** (jog-*): two REAL ghosts found and fixed. (a) jog-dark-before-fixes: Sam sprinting left a wire-frame trail of his own outlines on the
  carpet — silhouette-adjacent floor pixels take his (dilated) motion, fetch his old body, and their 3×3 spans both so the clip accepts it; the floor then
  keeps it. Fixed by the depth-in-alpha disocclusion test. (b) jog-lit-outline-ghost-before: fainter arcs + his shadow's lag surviving in a dim room — the
  clip's absolute padding; fixed by relative padding. After (jog-lit-after, jog-bright-after: a 60 W bulb over the floor, Sam crossing at a sprint): the
  floor behind him is clean at 1.0 / 0.77 / 0.5 within the frame; his gun's moving shadow at 0.5 shows the internal rows (current-frame dominated, as
  designed). torch-sweep-spot: a torch swept 3°/frame across a partition — the spot is where FXAA has it, nothing smeared behind; torch-head: the ')' by
  the bezel is in the FXAA frame too (the beam's origin, not a ghost) — feeding carried beams into the reactive channel was tried and reverted (it handed
  the resolve the raw internal-res march: 3995a3a).
- **Particles / rain** (sparks-reactive, rain): with the reactive mask a spark burst and the embers of the previous one read as under FXAA; with
  `taauReactive 0` the embers all but vanish (history wins) — the mask is doing its job. Rain streaks survive with or without it (bright against the wall);
  splashes fine. Emissive edges: the monitor tile's worst per-pixel temporal sd was 35.8 levels at 0.77 before the anti-flicker term, 2.2 after (e4ebe7f).
- **Tiers** (tiers-desk, deep-upscale-tuning): ultra = better than today outright; high 0.77 = cleaner edges, marginally softer detail — a win; medium
  0.67 = clean but visibly softer than 1600×900 native; **low 0.6 and verylow 0.5 are where TAAU is honestly worse in one respect**: sharpness. 768×432 and
  533×300 internal cannot hold the two overlapping papers or the keyboard's edge — they settle to soft blobs where today's native rows are crisp (and
  aliased, and noisier). The tighter acceptance + sharpen 0.5 (1767be0, right column of deep-upscale-tuning) buys some of it back; the rest is the price of
  0.36× / 0.25× the pixels on flat-shaded boxes with hard edges. Thin dark seams at 0.5 come out dashed (sub-internal-pixel lines only some phases hit).
  Not evaluated: wet-suit glints (deliberately sub-pixel sparkle — TAA will calm them), text-like detail (there is none yet; Phase 4's screens will need the
  reactive or a sharper path).

Temporal stability, static camera, mean per-pixel luma sd (8-bit levels) over 20–30 frames in 200–300 px tiles: high desk 0.226 → 0.090 (0.77) / 0.117
(1.0), partition 0.212 → 0.059 / 0.102, mid-floor 0.088 → 0.031 / 0.036; converged 100 frames after the anti-flicker: desk 0.218 → 0.118 / 0.109 (p99
1.33 → 0.90 / 0.86), partition 0.115 → 0.041 / 0.038; per tier (200 px tile) ultra 0.085 → 0.034 · high 0.119 → 0.025 · medium 0.150 → 0.031. Tails: a
handful of single pixels (≤ 0.02 % over sd 3, FXAA 0.01 %) twinkle at silhouette corners where the 2×2 depth vouching flips with the jitter.

## 4. The ladder under TAAU (ladder-step-1.0-0.6-1.0)

renderScale 1.0 → 0.6 → 1.0 at high with the still camera, offscreen renders around each step: the step frame differs from the frame before it by mean
|Δ| 0.60 levels (p99 7) — LESS than the settled 0.6 picture differs from 1.0 (1.13): no pop, the picture eases from one to the other over ~20 frames as
the coarser samples replace the finer ones in the history. Only the 26 internal targets are re-made ('0 pooled 26 new' the first visit of a size, 30 ms
wall once; '26 pooled 0 new' on return); the output pair, ldr and the bloom pyramid stay. Sub-rect rendering in fixed-size targets (to make even the first
visit free) NOT done — with the pool it is a first-visit-only cost and the ladder lives on a handful of sizes.

## 5. OFF identity, validation, gates

`?notaau` = the old chain byte for byte: the deterministic still (seeded Math.random, parked guards, zeroed phases, `__resetClock`, 40 frames) hashes
**15fc88bb** on main @ f0c25a0 (:5190) and on this branch with `?notaau` at high, **d704c1cf** on both at medium with the rain on — `__png` pixel diff max 0.
(What the branch changes on that path: two varyings + the velocity target in the g-buffer, one extra store in volumetrics, the particles' second target,
`post.invOut` ≡ `frame.invScreen` bits — none reaches a presented pixel.) GPU validation: an error scope + `uncapturederror` across all five presets through
debug views 1–10, scale steps, TAAU off/on, gather/vol divisor flips, `keepHistories` off, cuts, particles + a stun bang: nothing; /viewer (TAAU 0.77) and
/editor (0.67) boot clean. `tsc` clean at every commit · `tools/qa/gate.sh perf frame-layout player breach`: perf 24 · frame-layout 9 · player 166 · breach 13,
0 FAIL · `quality-plan.ts` exit 0 (updated knowingly: a preset's own starting scale is not an off-grid miss; the fast machine now settles at high ×0.77 —
0.59× the pixels puts the M4 back under the 15 ms budget at high — and the 'auto chosen later' checks follow that instead of hard-coding medium) ·
`tour.ts --runs 2`: 2/2 PASS (1 pre-existing standoff-orbit warning) · `soak.ts --seeds 1,2 --minutes 6`: no violations · `bun run build` ok.

## 6. Left / caveats

- verylow's cost and every tier's presented fps want a visible-pane take (`__v3gate.live`); the serialized protocol under-clocks the GPU at 4 ms frames.
- Box motion vectors match by index: the frame something spawns or dies EARLIER in the dynamic list, boxes after it get a zero (or, for two same-sized
  same-owner boxes, a wrong) vector for that frame — the disocclusion test then mostly takes the current frame there. A CPU-side stable id per box
  (rig props are rebuilt every frame but carry owner + name) would make it exact.
- Radiance in the air (beams, smoke) has no motion of its own: a swung torch beam converges through the clip a frame or two behind. Marking carried
  beams reactive was worse (noisy march); the froxel volumetrics of P2b get a history of their own.
- After a hard cut at medium / low / verylow the first frame is the wide estimate (soft) and sharpens over ~8–16 frames; at high / ultra it is the sharp one.
- The editor / viewer inherit the tier scales (edit view at 0.67 on medium) — arguably an editor wants scale 1.0 + TAA; a one-liner in editor/main.ts if so.
- Review follow-ups applied (texpool counts r8unorm at 1 B/px; a TAAU switch rebuilds the output set once via `passes.outStale` instead of twice; the g-buffer's
  previous-transform buffer is sized from `world.maxBoxes`; the pause card's TAAU row re-applies the preset so OFF is the old preset at 1.0). Left as found, for the lead:
  `game.ts:933` / `viewer/runtime.ts:395` size 'one internal pixel' for thin-prop widening as `canvas.height × effectiveScale`, which was never the internal row count
  (≈ ×capScale off) and now reads the OUTPUT rows under TAAU — `engine.height` is the honest term, but changing it moves prop widths on the `?notaau` path too, so it
  is a separate one-liner, not folded into an identity-preserving branch. Scripted cuts inside 2.5 m / 30° (adjacent breach shots) are deliberately NOT resets:
  a metre's hop reprojects like fast motion and the disocclusion test covers what it reveals.
- Merged main (P0-C) at b56622a; nothing pushed. My shot sink sat on :5186 (P2a took :5188/:5189).
