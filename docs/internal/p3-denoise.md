# P3 — one denoiser core, three clients (2026-08-10/11, lane `v3/p3-denoise`)

Brief: docs/internal/renderer-v3.md / STATUS "RENDERER V3" Phase 3 — replace the three bespoke denoisers (dtemporal + softblur on the direct light,
temporal + giblur on the gather's irradiance, the gloss chain on its specular field) with ONE SVGF/ReLAX-class core behind three clients, tiered like
the rest of v3, ≤ 2.0 ms p95 at high for all denoising, `settings.denoiser = 'v3' | 'legacy'` with legacy = today's paths bit for bit (`?legacydenoise`).
Machine / method as the earlier phase notes: M4 Max, Chrome (the Browser pane) / Metal, dpr 2, this worktree on :5191 (shot sink :5192; :5189 was
held by another lane's server all night), `?paused&quality=…&mute`, the cubicles still of tools/qa/perf-frames.js `stageStill` unless stated, SERIALIZED
frames, crops = 300-px tiles ×3 nearest. The P2a / P2b lanes rendered on the same GPU throughout: every cost number below is an interleaved A/B
(ABBA blocks) read at the MEDIAN with the p25 beside it — another client inflates frames, never deflates them. Instruments: tools/qa/p3-harness.js
(`__p3.costAB / abTiles / sdAB / directRef / indirectRef / lightsOff / strafe / doorSpill / muzzle / blackout`).

## 1. The core as built (`src/render/shaders/denoise.wgsl` — one module, five entry points; `src/render/denoise.ts` — pipelines, layouts, the 112-byte
parameter uniform, a bind-group cache; passes.ts owns every texture so they ride its pool / resample-on-resize machinery)

**Reprojection.** The pixel's surface point through `frame.prevViewProj` (last render's jittered matrix — right for an internal-res history) PLUS the
g-buffer's per-pixel object motion `gVel` (TAAU's velocity target: written on the FXAA path too, so `?notaau` keeps it). The 2×2 history footprint round
that point is fetched with ONE `textureGather` of the packed geometry texel (shadow) / of the history's depth-in-alpha (radiance) and each tap validated
on its own: stored view depth within 0.8 % of the depth this point had last frame (2.5 % where the surface itself moved), and — shadow client — a
stored 3+3-bit octahedral normal within ~53° of ours (box corners: depth continuous, another face). Valid taps renormalise (= 'fallback to the closest
valid'); the whole footprint valid → one bilinear sample per history texture; none → disocclusion, history length 0.

**Accumulation, moments, variance.** Per pixel a history LENGTH n (per emitter class for the shadow client, 5 bits each; in the moments texture for the
radiance clients), α = 1/min(n+1, cap); the exponentially-weighted mean and VARIANCE of the incoming sample's luminance (West's incremental form, every client — no raw second moment to overflow f16 under HDR radiance) →
the temporal variance of the SAMPLES (high for ever inside a penumbra or under a 4-ray bounce, zero where every ray agrees every frame); under 4 frames
of history the 5×5 spatial variance of the current frame stands in (SVGF). The 5×5 statistics (mean / σ per channel + luminance) come from a 12×12
workgroup-memory apron loaded once per 8×8 tile.

**Clamp (the transient rule).** The reprojected history is clamped into mean ± k·σ of THIS frame's 5×5 before blending — what this frame cannot see in
its own neighbourhood leaves the history now: dtemporal's property (a switched-off panel, a swept torch, a muzzle flash's visibility never linger),
generalised. The diffuse client also keeps a FAST history (short EMA, `dnGiFast` frames) and centres the box on it (ReLAX): the long history cannot sit
outside fast ± k·σ, which kills its lag without clamping to one raw frame's mean. The shadow client adds a LIGHT-MOTION CUE: the value history's alpha
carries each class's exact unshadowed luminance lumU; a relative change beyond `dnShadowMoveThresh` since last frame (a torch sweeping, a switch, a
flicker — the only way a still receiver's shadows of that class can have moved) drops that class to the short 'moving' history (`dnShadowMoveCap`
frames = dtemporal's regime), everything under still light keeps the long one; and a TEMPORAL-GRADIENT CUE for occluders moving under still light (a
man walking under the panels, a swinging leaf): the reprojected history against this frame's 5×5 mean in units of the frame's own σ (a converged
history under a still shadow reads ≪ 1 — the mean of 25 samples wanders by ~σ/5 — a shadow that walked a texel reads > 1) drops the class the same
way. Neither cue costs a fetch. Debug view 13 shows the state (σ per class, history length): fresh / moving = dark, long still = bright (docs/shots/p3/dbg13_still, sdbg_v3b_state).

**À-trous.** N iterations of the 3×3 B-spline wavelet at strides 1, 2, 4, 8, 16; weight = tap × exp(−plane distance / (z·k)) × (n·n₀)^p × exp(−|Δl| /
(σ_l·σ + ε)) with σ = the pixel's own √variance (SVGF's luminance edge-stop: differences its noise explains are averaged, larger ones are edges — a
crisp contact shadow beside a wide penumbra stays crisp), the variance filtered along as Σw²var/(Σw)². One accumulation walk over the taps, no per-tap
arrays (the pass is register-bound: the two-loop form with a prefiltered variance cost 1.7× per iteration).

**Clients = parameterisations of that:**
- SHADOW (full res, both emitter classes per dispatch, in RATIO space r = S/U per channel — U, exact, never enters a history or a tap, so a light
  switching or moving is exact and immediate and only visibility is smoothed): `shPack` (S,U → ratio + signed hint, (hints, lumU) → SHARED, the per-tile
  hint flag softtile's `tileDistances` turns into the chain's pass-through mask) → `shTemporal` → `shAtrous` ×N with softblur's two extra terms kept —
  taps weighed LIT ALIKE (min U / max U: never mix ratios across a cone edge or between light footprints) and the PCSS HINT PRIOR as the kernel's reach
  (an iteration takes a pixel only as far as its own / inherited blocker-distance width asks, hints dilated stride by stride through SHARED; whole tiles
  out of every hint's reach copied through — exact, softblur's argument carries) — the last iteration writing S = U × r̂ + the signed hint back into dS
  where composite / fgather / debug view 9 read it. Value history in dH[c][p] (ratio + lumU), moments in `dnHm[p]`, geometry in `dnHg[p]` (r32uint:
  f16 depth | len0 | len1 | normal), all pooled and resampled on a resize like the legacy pair (`nearest32u` added for the packed texel).
- DIFFUSE (gather grid, guides at each texel's full-res sample pixel): `giTemporal` (+ fast history, optional temporal firefly bound `dnGiFirefly`; the
  gather's own per-ray bound `giFireflyK` untouched) → `radAtrous` ×N ending in gi[0] (iteration i writes gi[(N−i)%2]). History indHist[p] (rgb + view
  depth — today's layout), moments+len+var in `giMom[p]`, fast in `giFast[p]`.
- SPECULAR (gather grid, under Gloss | Glass): `specTemporal` — reprojection blended from the surface's toward the VIRTUAL hit point P + V·hitT (fgather
  now writes the reflection ray's hit distance into the specular alpha; exact for a planar reflector) by mirror-likeness, clamp k and à-trous reach
  scaled by a roughness STAND-IN (`dnSpecRough`, one number until phase 4 has per-pixel roughness) → `radAtrous` ×N (SPEC) ending in `spec`, gi[1] as
  scratch. History specHist[p], moments `specMom[p]`. This is the interface rtreflect's half-res radiance + hitT plugs into: its texture as `cur`, its
  roughness replacing the stand-in inside `radTemporalCore` / `radAtrous` (both read `dn.sp.w` in one place each).

**Tiers** (ui/quality.ts `Preset.dn`, Tab ▸ Denoiser rows for every knob): shadow iterations / cap · gi iterations / cap · spec iterations = ultra 4/16 ·
5/32 · 2, high 3/12 · 4/24 · 1, medium 3/10 · 3/16 · 1, low 2/8 · 3/12 · 1, verylow 2/8 · 2/8 · 1; the clamp k (shadow 1.25 / gi 1.0 / spec 1.0), σ_l 4,
the gi fast history 3, the shadow moving cap 3 / threshold 0.04 are engine defaults shared by all tiers. Under v3 `directHistory > 0` is the shadow client's temporal switch and `directBlurCap` its width cap;
`directPasses` is legacy-only.

**What the ReSTIR merge touches here:** (1) engine.ts `K.ratioHi = (flags & (TailChroma | Restir)) ? 4 : 1` — its per-light hues top U per channel like
the chroma-exact tail; (2) passes.ts: the shadow chain's `if` gains P2a's `debugView !== 11 && !== 12` (their diagnostics ride raw in dS0). Nothing in
the WGSL: the client consumes S + hint + U per class, which restir.wgsl writes exactly as direct.wgsl does.

## 2. Cost (all denoising = the 'softblur' + 'temporal' compute passes: either core files its work under those two names)

Calm cubicles still, serialized, `__p3.costAB` 4 interleaved rounds × 20 frames per variant, medians (this take was quiet: p25 ≈ med ≈ p95 at
high; union ≡ Σ under serialization). ms:

| preset (internal → output) | legacy softblur + temporal = denoise | v3 shadow + gather-grid = denoise | Δ | v3 whole-frame union |
|---|---|---|---|---|
| ultra 2133×1200 | 4.92 + 0.46 = **5.37** | 5.37 + 1.05 = **6.42** | +1.05 | 28.84 → 29.95 |
| high 1368×770 → 1777×1000 | 1.97 + 0.13 = **2.10** | 1.77 + 0.26 = **2.03** (p95 2.03) | −0.06 | 11.60 → 11.47 |
| medium 1072×603 → 1600×900 | 1.11 + 0.13 = **1.25** | 1.05 + 0.13 = **1.18** | −0.07 | 7.60 → 7.54 |
| low 768×432 → 1280×720 | 0.59 + 0.07 = **0.66** | 0.46 + 0.13 = **0.59** | −0.07 | 4.92 → 6.09 ¹ |
| verylow 533×300 → 1066×600 | 0.33 + 0.07 = **0.39** | 0.26 + 0.07 = **0.33** | −0.07 | 3.41 → 3.74 ¹ |

¹ low / verylow union deltas are direct / gather noise between rounds (±0.3 ms swings on 5-ms frames), not the denoiser (its own rows are −0.07).
The target — ≤ 2.0 ms p95 at high for ALL denoising — lands at 2.03; the tiers scale 6.4 / 2.0 / 1.2 / 0.6 / 0.33 (per-tier penumbra crops docs/shots/p3/tier_*_box). The shadow client is CHEAPER than
softblur at 3 iterations and below (pack + tile distances + temporal + 3 à-trous ≈ 0.85 + 0.30 × iterations ms per internal Mpx after the one-loop
rewrite — the first two-loop build with per-tap arrays and a prefiltered variance cost 0.6–0.7 ms an iteration at high, 1.7× this); ultra's 4th
iteration (+16 px of reach for its wider cap) is what puts it over. The gather-grid clients cost 2× the legacy pair (5 dispatches of a heavier
temporal + 4 à-trous vs 4; the spec chain 2 vs 2) — 0.13 ms at high, 0.6 at ultra's half-res grid. quality.ts's cost model carries both as
`dnShadowFactor(iters)` / `dnGiFactor(iters)` on the softblur / temporal terms (quality-plan exit 0).

STRESS — the QRF + rain + two-canister minute of tools/qa/stress-scene.js at high (`fight: false`: 42 lights, 7 lit carried, 2 smoke domains live by
the take, orbit 0.6°/frame), `__stress.ab(legacy, v3, 4 blocks × 75)`, a clean take (max ≈ p95 in every row): denoise per frame mean / p50 / p95 / max
legacy 2.04 / 2.03 / 2.16 / 2.23 → v3 **1.85 / 1.83 / 1.97 / 1.97** (softblur 1.88 / 1.90 / 1.97 → 1.61 / 1.64 / 1.70; temporal 0.16 / 0.13 / 0.20 →
0.24 / 0.26 / 0.26); Σ compute 14.93 / 14.88 / 15.86 → 15.23 / 15.14 / 16.52 (the ±0.3 between blocks is direct + gather following the evolving minute,
not the denoiser). An earlier take the P2 lanes shared read v3's temporal p95 at 1.70 with softblur 7.7 and gather 5.7 in the same frames — the
every-pass-at-once signature of another GPU client — which is why the take was repeated.

## 3. Quality per client

**SHADOW — static noise** (temporal sd of 8-bit luma over 30 still frames per tile, `__p3.sdAB`; high):

| tile | TAAU off (1777×1000, FXAA) legacy → v3 | TAAU on (0.77 → 1777×1000) legacy → v3 |
|---|---|---|
| box penumbra (broad panels) | 0.064 → **0.022** (0.34×) | 0.038 → 0.017 (0.45×) |
| chair penumbra | 0.164 → **0.078** (0.48×) | 0.012 → 0.007 (0.58×) |
| monitor contact shadow on the desk | 0.144 → 0.102 (0.71×) | 0.040 → 0.022 (0.55×) |
| lit floor (checkerboard + dim rays) | 0.305 → 0.150 (0.49×) | 0.032 → 0.019 (0.59×) |
| dark corner | 0.100 → 0.040 (0.40×) | 0.039 → 0.022 (0.56×) |
| desk lamp: keyboard contact / desk-edge penumbra / pool | — | 0.036 → 0.025 · 0.042 → 0.026 · 0.022 → 0.016 |

Against a 120-frame average of the RAW estimator (SoftShadow off; linear dS, `__p3.directRef`, high): monitor-contact tile legacy bias +0.02 % /
per-pixel rmse 5.6 % / p95 |err| 11.5 % → v3 −0.32 % / **3.4 %** / 6.1 %; box-penumbra tile +0.37 % / 2.2 % / 4.5 % → −0.19 % / **1.4 %** / 2.7 % — both
unbiased, v3 ~40 % closer to the reference pixel by pixel; large-tile LDR means converged: v3 −0.2 / −0.3 / −0.2 % of legacy (`meanAB`: floor, desk area, left cubicles) —
the 2 % bias bar holds with an order of magnitude to spare. Crops (docs/shots/p3/notaau_{chair,desk}_{legacy,v3}.jpg ×3, TAAU off so the
denoisers are naked): the chair's penumbra is the same width with legacy's stipple gone; the monitor's contact shadow on the desk is DARKER and
better defined under v3 (legacy's inherited wide hint blurs lit ratio into the umbra; the luminance edge-stop keeps it) — the one place the two differ
in kind, and in v3's favour. Under TAAU (docs/shots/p3/taau_desklamp_lampA_*): keyboard / paper contact shadows under the desk lamp pixel-for-pixel
as crisp both ways, no over-smoothing from stacking the two temporal filters — TAAU integrates what is left, and there is simply less left.

**SHADOW — motion.** (a) A man sliding at 3.2 m/s across the open floor under the panels, torch lit (`__p3.strafe`, crops docs/shots/p3/hi_strafe_f8_
{legacy,v3,v3nomv} + the direct-only / state tiles sdbg_{legacy,v3,nomv}_direct, sdbg_v3b_state): no trailing silhouette or torch after-image behind him in any variant; his own body
keeps its history through the motion vectors (v3nomv restarts it every frame — noisier flanks, no ghost either); his shadow on the carpet is smoother
than legacy's stippled one and rides with him — the state view shows the gradient cue resetting exactly the disoccluded floor and the moving shadow's
fringe (dark = fresh) while the rest of the floor keeps its 12 frames. Honest read: inside a broad, moving penumbra the long history still trails by a
frame or two more than legacy's 3-frame EMA (the clamp box is wide where σ is large); the cue bounds it, it does not zero it. (b) The storage door
swung open over 8 frames with the bulb behind it (`doorSpill`, steep from the corridor side; docs/shots/p3/hi_door_f4_*): the spill's tile-mean curve
overlays legacy's frame for frame (55.9 → 77.5 vs 55.8 → 78.3 by frame 9) — immediate, as it must be with U exact — and the leaf's moving shadow edge is
cleaner. (c) Muzzle flash (`muzzle`): tile mean 213 → 33 over 6 frames (legacy 191 → 33): no residue after either; v3 shows the flash at FULL strength
on its first frame where dtemporal's 0.7 history weight showed 70 % of it — the transient rule now costs the flash nothing. (d) All light groups off at
once (`lightsOff`, composite tile): both below 10 % on the first frame (direct is exact both ways), 2 % by frame 9 / 11.

**DIFFUSE GI.** Torch 0.43 m off the storage wall (perf-harness scene s1), 100×80 gather texels round the hotspot: linear temporal sd of gi[0]
legacy 8.1 % of the tile mean → v3 **4.9 %** (0.61×; 4.0 % at the shipped k 1.0 / fast 3); against a 150-frame raw-gather reference legacy bias
+12.3 % / rmse 122 % / p95 |err| 54 % → v3 **−3.4 % / 80 % / 32 %** (legacy's 1σ clip of a heavy-tailed 4-ray estimate skews it; the wider,
fast-centred box does not). Indirect-only crops docs/shots/p3/gi_torch_ind_{legacy,v3}: the crates and wall round the spot hold more, smoother bounce under v3.
Responsiveness (indirect-only view, all groups off): 50 / 10 / 2 % at frames legacy 4 / 14 / 28 → v3 5 / 16 / 37 at the shipped defaults — the sweep
(fast, k) = (5, 1.5) 6/19/39 boil 4.8 % · **(3, 1.0) 5/16/37 boil 4.0 %** · (0, 1.0) = clamp on the raw mean 4/14/35 boil 8.8 % (= legacy both ways) ·
(2, 0.75) 5/15/36 boil 6.0 % — i.e. the fast history buys half the boil for two frames of the 10 % line; the 2 % tail is the dice cache's own EMA plus
the box's relative floor. `dnGiFirefly` (a temporal-side bound) ships at 0: the gather's per-ray `giFireflyK` stays as the presets set it.

**SPECULAR** (gloss on, lobby stone; glass panes ride the same chain by default): linear temporal sd of `spec` legacy 1.41 % → v3 0.54 % (0.38×);
debug-view-10 frames docs/shots/p3/lobby_spec_{legacy,v3}: the mirrored ceiling panel's outline loses its ragged jittered-ray edge, the reflected door frame its
double line. A stub by the brief's own allowance — one roughness number, no per-pixel hitT consumer beyond the reprojection — but live, validated and
exercised; §1 names the two lines phase 4 replaces.

## 4. OFF identity

`?legacydenoise` = main byte for byte: the deterministic still (seeded dice, parked guards, zeroed phases, `__resetClock`, 40 frames + one offscreen
render, `__p3.identityHash`) hashes **128ffe93** on main @ 16aac22 (:5193) and on this branch with `?legacydenoise` at high (TAAU on), and **a982d257**
on both at medium with `?notaau` and `settings.gloss = true` (the spec chain live). What the branch changes on that path: fgather writes the reflection
ray's hit distance into the specular alpha (temporal.wgsl / composite read .rgb; giblur blurs it into a channel nobody reads), the new textures exist,
`nearest32u` is compiled — none reaches a pixel.

## 5. Validation + gates

GPU validation (`__p3.validate`: an error scope + the uncaptured list across plain frames, debug views 1–10 + 13, a render-scale step down and back
— histories pooled + resampled, 'resize …: 12 pooled 0 new' — gloss on/off, night vision, TAAU off/on, legacy ↔ v3, FrameFlags.Temporal off/on,
directHistory 0, iterations 1 and 5, preset re-apply) at all five presets incl. the hops between them: **0 errors**. `tsc` clean at every commit ·
`tools/qa/gate.sh perf frame-layout player breach glass weather`: perf 24 · frame-layout 9 · player 166 · breach 13 · glass 39 · weather 12, 0 FAIL ·
`quality-plan.ts` exit 0 (18 PASS; the model now tiers the denoiser) · `tour.ts --runs 2`: 2/2 PASS, 0 warnings · `soak.ts --seeds 1,2 --minutes 6`: no
violations · `bun run build` ok. Blackout / restrike, breach daylight and `?notaau + v3` covered by the sweep's paths (U exact: nothing denoiser-side
distinguishes them) and by eye during the runs.

## 6. Left for phase 4 / caveats

- Reflections onto the specular client: rtreflect's half-res radiance + hitT texture becomes `cur` of `encodeRadiance(…, spec = true)` (its own
  divisor → its own `RadianceViews.chain`), its per-material roughness replaces `dn.sp.w` in `radTemporalCore` (reprojection mix + clamp k) and
  `radAtrous` (reach); its reflect_temporal / reflect_atrous retire. The virtual-hit reprojection is validated against the SURFACE depth at the fetched
  texel with a 5 % tolerance — right for the planar floors it serves today, to be revisited for curved / rough reflectors.
- Ultra runs 1 ms over legacy (its 4th shadow iteration + 5 gi iterations at half res); if ultra ever needs it back, `dn: { shIters: 3, giIters: 4 }`
  is −0.9 ms for a hair of penumbra reach.
- The v3 target set (~75 MB at high) is allocated under `denoiser = 'legacy'` too (review #8: could follow the taaHist allocate-by-mode pattern).
- Merged nothing from P2a / P2b yet (not landed at the time of writing): §1 lists the two lines the ReSTIR merge touches.

## 7. 08-12: the sodium-lamp rims (37e04a6 + 1aa1977) and what is left against a raw reference

The maintainer's note ("direct light from the sodium lights outside still weird at rims … lots of boiling by the cubicle window … goes away when I turn off
the v3 denoiser") was the shadow client's two LIGHT CUES keying on ReSTIR's believed-visible luminance (CUR.a): in a sized emitter's wide penumbra the
per-pixel darkSlot / tile beliefs flip frame to frame, each flip read as the light moving or jumping, so the ratio history was cut to movCap or restarted from
the frame's value leant on a 5×5 that straddles the edge — bright rims along every geometric edge in the lamp's patch, boil where the penumbra never
converged. Fix: the cues' MEMORY is the exact unshadowed luminance (HV.a = lumU, SHARED.zw), the JUMP is measured against the believed share with last
frame's share estimated from last frame's U (so ?norestir keeps max(U now, U then)). Method that found it and should be reused: pin the view (`__stage`),
average N frames of (a) v3, (b) legacy, (c) the RAW estimator (frame flag 512 SoftShadow off, 160–200 frames), count pixels > 8 levels off the raw mean per
region, and switch stages / cues off one at a time. Cubicle-window view, bright pixels vs raw: partition edges 969 → 7, silhouettes 1460 → 816 (legacy 749),
sill lines 84 → 0, wall foot 1007 → 817 (legacy 1486); tjank scene A (strobing tube) unchanged.

What is LEFT (03:15, Sam close in the lamp's patch, box 440×620 round him): two independent 160-frame raw means differ by 82 / 78 pixels (> 8 bright /
dark) — the method's floor; v3 (64–96 frames) vs raw = ~1300 bright / ~5 dark, legacy ~3000; sharp direct on or off changes little (1053 vs 800). The
×6 diff image (docs/shots/samres_diffx6.jpg, with samres_ref / samres_v3) puts nearly all of it ALONG THE LAMP'S PENUMBRA EDGE on the carpet (a red line
with a blue line beside it: the edge blurred a few px — energy moved from the lit side to the dark side by the temporal clamp / à-trous), a little on Sam's
head and hands, nothing rim-like. A denoiser's inherent softening of an already-soft edge; no action taken.

BOIL after the fix, same window view, static frame (still camera, `__perf.render` only — no game step between the takes, which had confounded a first attempt):
temporal sd (display levels) inside the noisiest 8 % of pixels by the RAW estimator's sd (its penumbra mask, 64 k px): raw 4.62 · v3 1.378 · legacy 1.388 · v3 with the
moving-light cue off 1.377 · moveCap 12 1.372 · shadowCap 16 / 24 1.363 / 1.352 · iters 4 1.371 · clampK 2 1.370. So v3 and legacy now boil identically there and no
shadow-client knob moves it: what is left in that mask is the frame's own floor (resolve jitter, GI, grain), not the shadow chain. (In-game, with the storm and the
fixtures' flicker stepping, both read ~2.2–2.4.)
