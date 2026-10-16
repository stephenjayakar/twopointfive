# Sharp direct — where the direct light's sharpness went, and a decoupled-resolution prototype (2026-08-10, lane `v3/sharp-direct`)

The maintainer, verbatim: *"one overall theme is that I really liked the previous renderer's sharpness for direct lighting, and the temporal stuff has kinda
compromised that … perhaps high resolution textures (e.g. real text on paper) when it doesn't imply geometry would help with that. but i'm not sure."*
The lead's hypothesis to TEST: the loss is (1) mostly RESOLUTION (high renders 1368×770 → 1777×1000 under TAAU where it used to render 1777×1000),
(2) partly the TAAU RESOLVE's resampling, especially in motion, (3) barely the shadow filtering; and the proposed fix: decouple resolutions — direct light
= U × visibility with U exact per pixel, so rasterise the g-buffer, evaluate U + albedo + composite at the OUTPUT size, keep the stochastic terms
(shadow ratio, GI, specular, volumetrics) internal and joint-bilateral upsample them, TAA at the output size.

Machine / method as every phase note: M4 Max, Chrome (the Browser pane) / Metal, dpr 2, this worktree on :5231 (shot sink :5232), `?paused&quality=high&mute`
(1280×720 CSS at dpr 2 → high's cap = 1777×1000 output; the internal 1368×770 at ×0.77), guards parked dark, Sam invisible, phases / grain / life layer
off, the storm off, dice seeded. The maintainer was playing on the same GPU throughout (their :5173) and other lanes' tabs share the pane — irrelevant to
§1 (deterministic stills), noted where a cost number is read. Instruments: `tools/qa/sharp-harness.js` (`__sh`: the three pinned views, static + motion
captures as lossless PNGs of the OUTPUT frame → docs/shots/ab/, serialized cost / A/B, sd, identity hash; it pins the canvas box so a background tab
renders at the reference size) and `tools/qa/sharp-metrics.py` (grades the PNGs offline: edge-spread + local contrast, ×3 crops → docs/shots/sh/,
numbers → docs/perf/sharp-metrics.json).

## 1. The loss, measured by component

**Views** (camera pinned verbatim; the motion capture is the LAST frame of a 20-frame 0.3°/frame orbit that ends on the static yaw, so one set of edge
definitions serves both): **V1** the manager's desk under the desk lamp (hard contact shadows — the keyboard's, the monitor foot's — lit box edges, the
lamp's pool); **V2** a torch cone up the corridor's north wall and across its lino, seen along the corridor (a FIXED spot with the guards' torch numbers,
7° / 19° / radius 0.07 / intensity 70, held at hand height at the cubicle opening and dipped — a staged man's idle sway moved a held beam a few px between
captures and the cone edge is the thing measured); **V3** four cubicle desks under the ceiling panels (box edges lit vs shadowed, keyboards, partition
tops, chair shadows). **Variants**, each a fresh boot: (a) OLD RENDERER = `?notaau&norestir&legacydenoise&nofroxel&nortreflect&detail=0` at scale 1.0,
native 1777×1000, FXAA; (b) v3 all-on at scale 1.0 (TAA, no upscale); (c) v3 all-on at 0.77 = SHIPPING high; (d) v3 at 0.77 with `?notaau` (the browser's
bilinear + FXAA — captured 1368×770, graded after a bilinear resize to 1777×1000, which is what presenting that canvas in the same box does); (e0 / e2) =
(c) with `taauSharpen` 0 / 0.5 (2× the default 0.25). 40 settled renders per still.

**Metrics.** EDGE-SPREAD = the 10–90 % rise distance of the luma profile across an edge in OUTPUT px, sub-pixel by linear interpolation, the median over
13–41 profiles spread along the edge (plateaus = the profile's two ends). Kinds: *contact* = a hard contact shadow's outer edge, *pool* = a light's own cone
boundary, *box* = a lit geometry / albedo edge, *penumbra* = a physically soft shadow edge (reported for completeness). CONTRAST = RMS of a high-pass (luma −
Gaussian σ 1.5 px) in a 100–340 px tile. A perfectly antialiased step edge reads ≈ 0.9–1.3 px in this metric; an aliased one (a staircase) ≈ 1.0–1.1 — the
metric rewards aliasing, which is part of what 'crisp' meant in the old renderer (the crops show the staircases: docs/shots/sh/a_*_boardEdge / _kbFar).

| edge (view · kind) | a static | b | c | d | e0 | e2 | a MOTION | b | c | d | e0 | e2 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| V1 keyboard contact shadow (contact) | 7.17 | 3.90 | 4.73 | 2.67 | 4.89 | 4.65 | 7.04 | 4.48 | 5.59 | 6.27 | 5.41 | 5.29 |
| V1 keyboard far edge (box) | 1.56 | 1.68 | 1.72 | 2.27 | 1.88 | 1.55 | 1.54 | 2.12 | 2.31 | 2.20 | 2.44 | 2.08 |
| V1 paper edge (box) | 1.21 | 1.35 | 1.53 | 2.05 | 1.61 | 1.27 | 1.24 | 1.99 | 2.17 | 2.07 | 2.22 | 1.99 |
| V1 monitor-foot shadow (penumbra) | 11.56 | 10.66 | 10.92 | 10.18 | 10.86 | 10.81 | 11.59 | 10.51 | 10.84 | 10.47 | 10.94 | 10.84 |
| V2 torch disc edge on the wall (pool) | 25.57 | 25.54 | 25.58 | 26.38 | 25.55 | 25.52 | 25.64 | 25.51 | 25.46 | 26.38 | 25.50 | 25.36 |
| V2 wall/floor junction inside the lobe (box) | 2.62 | 2.71 | 2.87 | 3.29 | 2.94 | 2.76 | 3.28 | 3.07 | 3.18 | 3.38 | 3.14 | 2.84 |
| V2 notice-board edge, bounce-lit (box) | 1.13 | 1.86 | 1.73 | 1.95 | 2.13 | 1.80 | 1.13 | 2.45 | 2.54 | 1.95 | 2.65 | 2.33 |
| V3 keyboard far edge (box) | 1.09 | 1.27 | 1.49 | 1.81 | 1.55 | 1.25 | 1.09 | 2.06 | 2.34 | 1.81 | 2.41 | 2.24 |
| V3 desk edge over its own floor shadow (box)¹ | 4.51 | 4.37 | 4.42 | 4.45 | 4.23 | 4.27 | 4.50 | 4.07 | 4.01 | 4.44 | 4.03 | 3.89 |
| V3 partition-top strip edge (box) | 1.98 | 2.03 | 2.10 | 2.56 | 2.17 | 1.88 | 2.28 | 2.94 | 3.60 | 3.33 | 3.64 | 3.40 |
| **contrast** V1 penumbra tile | 2.01 | 1.92 | 1.83 | 1.86 | 1.81 | 1.96 | 1.93 | 1.59 | 1.46 | 1.59 | 1.43 | 1.58 |
| contrast V1 lit desk (keyboard + papers) | 2.70 | 2.65 | 2.52 | 2.59 | 2.39 | 2.71 | 2.56 | 2.12 | 1.91 | 2.04 | 1.85 | 2.01 |
| contrast V2 cone tile / lobe tile | 0.84 / 1.01 | 0.79 / 0.86 | 0.80 / 0.83 | 0.64 / 0.70 | 0.73 / 0.80 | 0.87 / 0.94 | 0.82 / 0.97 | 0.74 / 0.71 | 0.71 / 0.71 | 0.61 / 0.69 | 0.70 / 0.70 | 0.82 / 0.80 |
| contrast V3 broad chair penumbra / desk tile | 0.45 / 5.04 | 0.48 / 4.61 | 0.48 / 4.35 | 0.53 / 3.81 | 0.48 / 4.18 | 0.52 / 4.58 | 0.45 / 4.82 | 0.48 / 3.46 | 0.47 / 3.17 | 0.42 / 3.62 | 0.48 / 3.04 | 0.51 / 3.33 |

¹ the low plateau is the desk's own soft floor shadow, a gradient — the number is that gradient's, not the silhouette's; kept for honesty, not read. V3 sits under the cubicles' FLICKERING tube: its rows carry ±0.15 px / ±7 % contrast between sessions (the flicker's phase follows the page's clock), V1 / V2 repeat to the hundredth.
Crops ×3 (300 px): docs/shots/sh/<a|b|c|d>_<v1|v2|v3>_<static|motion>_<edge>.jpg beside each other.

**Attribution** (the six clean box edges — V1 keyboard / paper, V2 junction / board, V3 keyboard / partition — mean Δ in output px):
- STATIC: a → c **+0.31 px**, of which a → b (the whole temporal stack — TAA + ReSTIR + v3 denoiser + froxels + reflections — at EQUAL resolution) **+0.22**
  and b → c (0.59× the pixels + the resolve's upscale) **+0.09**. c vs d (the resolve against a bilinear upscale + FXAA of the same 1368×770): the resolve
  is 0.41 px SHARPER than bilinear when still. Sharpen: e2 (0.5) −0.16 vs c, e0 (0) +0.14. Static, everything is inside half a pixel of the old renderer,
  and part of that half pixel is anti-aliasing the old renderer simply did not do (the board edge: 1.13 aliased staircase → 1.86 clean under TAA at 1.0).
- MOTION (0.3°/frame — slower than the follow camera in play): a → c **+0.93 px**, of which a → b **+0.68** and b → c **+0.25**; c vs d: bilinear-of-0.77
  is 0.23 px sharper than the resolve in motion (and crawls). Sharpen e2 −0.21, e0 +0.06. Local contrast on the lit desk tiles: static −7 % / −14 %
  (a → c, V1 / V3), motion **−25 % / −34 %**, and b already carries −17 % / −28 % of it.
- CONTACT SHADOW (V1 keyboard): the OLD renderer is the softest by far — 7.2 px (legacy softblur's inherited hint blurs the umbra; P3 §3 said as much) vs
  3.9 (b) / 4.7 (c) / 2.7 (d: no jitter, no resolve — and no AA); in motion 7.0 / 4.5 / 5.6 / 6.3. The temporal stack did not cost contact sharpness; it
  bought some. The resolve adds ~0.8 px to it at 0.77 (c − b), the resolution ~0 (b ≈ d + AA).
- POOL / CONE EDGE (V2 disc): 25.5 px in every variant — the torch's inner 7° → outer 19° falloff is analytic and an order wider than any pixel; resolution,
  resolve and filters cannot touch it. The lamp's pool in V1 (30° → 62°) likewise. 'Light pools go native-sharp' is true only of pools with a hard cutoff,
  which this level's lights do not have.
- PENUMBRAE (V1 monitor foot 10.5–11.6, V3 chair 0.45–0.53 contrast): physical, equal everywhere, as the lead expected.

**Conclusion of §1.** The hypothesis holds in its parts (3) — the shadow filtering cost nothing, v3's contact shadows are crisper than the old softblur's —
and (2) — the resolve softens in motion — but NOT in its main part (1): resolution is the SMALLER share. Of the sharpness the old renderer had on lit box
edges, ~70 % of what is gone in motion (and ~2/3 of the little that is gone when still) went to the temporal resolve AT ANY RESOLUTION (a → b: TAA's
per-frame reconstruction + history resampling under camera motion, plus honest anti-aliasing of edges the old chain left as staircases), ~30 % to the
0.77 render scale + upscale (b → c). So a decoupled-resolution path can at best land on (b) — recover the b → c quarter-pixel and the −6…−9 % of tile
contrast between b and c — unless the TAA itself treats motion differently; the resolve's motion softness is the bigger lever and it lives in taau.wgsl
(the temporal-jank lane's). §2 builds the prototype anyway (it is also what makes real print / decals / markings native under TAAU, which no TAA tuning
gives), measures it as row (f), and tries the TAA's own exposed knobs on top of it as rows (g).

## 2. The prototype: decoupled resolution behind `settings.sharpDirect`

**As built** (`sharpDirect` default ON on this branch; `?nosharp`; Tab ▸ Frame; live only under TAAU below scale 1.0 with no debug view — `engine.resize`
decides `sharpOn` per frame):
1. `frame.ts` / `common.wgsl`: the Frame block gains `sharpCfg` @688 (internal size xy, OUTPUT size zw — z 0 = off) and `sharpCfgB` @704 (the knobs) →
   FRAME_BYTES 720; `writeFrameOut` makes an OUTPUT-screen twin of the block (screen / invScreen = the output size), `engine.ts` keeps it in `frameBufOut`
   with its own scene group `sceneBGOut` — group 0 of every pass that runs at the output size, so `frame.screen`, `worldFromDepth` and every pixel-
   footprint term mean THEIR pixel there with no shader knowing. Jitter = ±½ OUTPUT px (expressed in internal px downstream, the same NDC translation).
2. `gbuffer.ts`: the boxes + men are rasterised at the OUTPUT size into an O set (albedoO … matO, pooled); `encodeDown` (`gdown.wgsl`, one fullscreen
   triangle, un-timestamped) fills the internal-size targets everyone else binds — one texel each, the output texel holding the internal pixel's centre,
   depth through frag_depth, nothing averaged (a mean depth names no surface). So restir / direct, the denoisers, the gather, the reflections, the
   volumetric march, the froxels and the particles' update are UNTOUCHED and read a strict subsample of the output raster.
3. `sharp_direct.wgsl` (compute pass 'sharpU', 8×8 per OUTPUT pixel, group 0 = the output block): stage + tile-cull the light list exactly as
   direct.wgsl does, `evalLight` every survivor → U per emitter class at the output pixel (the same statements: walled-off lights in U, known dark);
   then r̂ per class = Σw·S ∕ Σw·U over the 2×2 internal texels round the pixel (w = bilinear × same-plane e^(−|Δ·N| ∕ 0.01 z) × (n·N)⁸; the outer
   ring of the 4×4 if none of the 2×2 lies on this surface; the nearest texel's ratio if none of those does either), clamped like the denoiser's ratio
   (≤ 1, ≤ 4 under ReSTIR's hues), the thin-channel case falling back to the luminance ratio → E_c = U_c ⊙ r̂_c into `sharpE[c]` (2 × rgba16f, output size).
4. `composite.wgsl` compiled twice behind a prepended `const SHARP: bool` — false: the fragment composite at the internal size, statement for statement
   as it was; true: the same arithmetic as a compute kernel `cs` per output pixel ('compS') with the output-size g-buffer, `sharpE` as directTex /
   softTex, and the internal-grid terms (the gather's irradiance + specular, the volumetric march, the reflections) fetched through the internal size
   with their depth / normal / id guides read at the output texel that HOLDS the internal sample pixel (`gpx` — the same expression gdown.wgsl copies
   by, so the same texel); the froxel fetch is uv-based and needs nothing. hdr / the particles' reactive mask live at the output size (the splat lands there
   against the output depth).
5. `taau.wgsl` compiled twice the same way: SHARP = true is the 1 : 1 resolve of the output-size composite (P.inSize = the output, the jitter handed
   over in output px, the output-size depth / motion bound); one statement changed (the volReact texel under SHARP). Bloom / post / the sharpen blit as ever.
6. `particles_draw.wgsl`: one statement (its volumetric texel under sharp).
Files other lanes own that were touched: **taau.wgsl** lines 179–181 (the `qv` mapping, `const SHARP` prepended by passes.ts) — temporal-jank lane;
**particles_draw.wgsl** lines 107–108 (`pv`); **gbuffer.wgsl not touched** (the raster reads the output block instead). composite.wgsl: the upsample*
functions gained a `pin` parameter + `gpx / ipos / inHi`, `fs` became `compositePixel` + the `cs` entry point.

**OFF identity.** `?nosharp` on this branch = main @ 91cd005 served beside it (:5233), the deterministic still (`__sh.identityHash`: seeded dice, parked
guards, zeroed phases, `__resetClock`, 40 frames + one offscreen render): high v3 **ec89a30a** / v1 **8a49962c** on both, medium **17c9dd19** / **ab6a40b8**
on both — the twice-compiled composite / taau, the function extraction and the grown Frame block reach no pixel. (Re-checked after the follow-up commit.)

**Row (f) — what it recovers** (§1's table with the prototype; f = f2, re-captured after the review fixes; docs/perf/sharp-metrics.json):

| edge / tile | a still | b | c | **f** | a MOTION | b | c | **f** |
|---|---|---|---|---|---|---|---|---|
| V1 keyboard contact shadow (contact) | 7.17 | 3.90 | 4.73 | 4.95 | 7.04 | 4.48 | 5.59 | 6.02 |
| V1 keyboard far edge (box) | 1.56 | 1.68 | 1.72 | **1.64** | 1.54 | 2.12 | 2.31 | **2.15** |
| V1 paper edge (box) | 1.21 | 1.35 | 1.53 | **1.32** | 1.24 | 1.99 | 2.17 | **2.01** |
| V2 wall/floor junction (box) | 2.62 | 2.71 | 2.87 | **2.64** | 3.28 | 3.07 | 3.18 | 3.17 |
| V2 board edge, bounce-lit (box) | 1.13 | 1.86 | 1.73 | 1.73 | 1.13 | 2.45 | 2.54 | **2.34** |
| V3 keyboard far edge (box) | 1.09 | 1.27 | 1.49 | **1.20** | 1.09 | 2.06 | 2.34 | **2.12** |
| V3 partition tops (box) | 1.98 | 2.03 | 2.10 | **2.00** | 2.28 | 2.94 | 3.60 | **3.18** |
| contrast V1 lit desk / V3 desk | 2.70 / 5.04 | 2.65 / 4.61 | 2.52 / 4.35 | 2.51 / **4.63** | 2.56 / 4.82 | 2.12 / 3.46 | 1.91 / 3.17 | 1.96 / **3.36** |
| V2 disc edge (pool) · V1 foot (penumbra) | 25.57 · 11.56 | 25.54 · 10.66 | 25.58 · 10.92 | 25.61 · 10.94 | 25.64 · 11.59 | 25.51 · 10.51 | 25.46 · 10.84 | 25.54 · 10.81 |

The claim to prove was 'pool / cone / box edges ≈ the old renderer's while keeping v3's noise level and staying inside budget': on the six box edges (f) reads
1.75 px still / 2.50 motion against (a) 1.60 / 1.76, (b) 1.82 / 2.44, (c) 1.91 / 2.69 — i.e. **(f) = (b)**: it takes back exactly the resolution + upscale
share (b → c) and lands 0.15 px off the old renderer when still, of which most is anti-aliasing (a)'s staircases never had; in motion it inherits the
resolve's softness like (b) does. Pool / cone edges were never lost (analytic, 25.5 px everywhere). Contact shadows stay at the internal visibility's width
(4.95; the honest loss — (E) below). Crops ×3: docs/shots/sh/{a,c,f2}_*; side by side on the page.

**Cost** (docs/perf/sharp-cost.json; serialized, OFF vs ON interleaved ABBA, GPU shared with the maintainer's game and other lanes' tabs — medians):
calm cubicles still, union of compute passes med (p95): **high 7.54 (7.80) → 9.44 (9.77) = +1.90 ms** (sharpU 1.05 + compS 0.79; wall/frame 15.2 → 16.8);
medium 6.29 → 6.68 = +0.39 (sharpU 0.85 + compS 0.66; wall −0.1); low 6.16 → 6.88 = +0.72 (wall +0.3); verylow 4.33 → 6.29 = +1.96 (wall +0.5) — the two
output-size kernels are per OUTPUT pixel and do not shrink with the tier (0.92 + 0.66 ms even at 1066×600), and at 4–6 ms of real work the serialized
GPU clocks down between small dispatches, so the low tiers' union deltas over-read (P1's note saw the same; the wall column bounds them: ≤ +0.5);
ultra 19.27 → 19.27 (scale 1.0: idle by construction). **The stress minute at high** (`__stress.setup({fight:false})`: QRF weapon lights, rain, two
canisters, orbit, 41 lights; `__sh.stressAB` 4 × 80 frames per side): union mean · p50 · p95 · max OFF 10.57 · 10.49 · 10.88 · 21.17 → ON 12.55 · 12.65 ·
**13.04** · 13.17 — the bar (high stress union p95 ≤ 14) holds; direct 3.22 → 3.34, shadow denoiser 1.08 → 1.13, gather 2.05 → 2.02, froxels 0.72 → 0.70,
sharpU 1.02, compS 0.82, taau 0.24 → 0.25. NOT in either side's union: the output-size raster (+0.7 Mpx of boxes + men) and gdown, both render passes —
the wall deltas bound them with everything else. The lower-tier bar (≤ +1 ms) holds at medium / low by union and at all three by wall; verylow's union
says +1.96. **Memory**: high +78 MB (output raster 39 · direct pair 28 · hdr / react growth 7 · mask 4), medium +65, low +42, verylow +29, ultra 0.

**Noise** (docs/perf/sharp-noise.json; mean per-pixel sd of 8-bit luma over 30 still frames, two takes each, high): V3 chair penumbra OFF 0.052 / 0.046 →
ON 0.060 / 0.056; V3 desk 0.060 / 0.056 → 0.061 / 0.054; V3 carpet 0.079 / 0.079 → 0.085 / 0.080; V1 foot penumbra 0.167 / 0.122 → 0.160 / 0.163; V1 lit
desk 0.073 / 0.064 → 0.078 / 0.083; V1 contact band 0.086 / 0.072 → 0.089 / 0.081 — at parity within ~0.01 of a level (the ON side a hair higher where the
1 : 1 resolve no longer smooths the internal noise across 1.3 output px; p99s equal or lower). The stochastic terms themselves are untouched by construction.

**(E) hard-edge mitigation — built, measured, left OFF** (`settings.sharpEdgeRays`; `sharp_edge.wgsl` + the edge-ray branch of `sharp_direct.wgsl`): a
mask over the denoised pair flags, per class, pixels with a hard shadow edge within ±2 internal px (ratio range > 0.3 there, hardness read off the SHADOWED
pixels' own blocker-distance hints — a lit pixel's hint is the denoiser's dilated 10-px prior and says nothing); a flagged output pixel spends ONE
deterministic ray to the class's strongest emitter's centre and keeps only the live remainder on the ratio (walled-off share at its true 0 — the first cut
multiplied the moon's reach-masked share by the ratio and drew a step). Permissive veto (row g): the keyboard's contact shadow **4.95 → 1.60 px** still,
2.17 motion — crisper than any variant incl. the old renderer — but the monitor foot's hard shadow overlapping its panel's soft one gets the soft one
hardened (V1 penumbra-tile contrast 1.84 → 4.53) and the fired region's rim shows the estimator's own 1–2 % bias as a faint line; strict veto (row h, any
wide dark pixel near wins): the overlap stays soft, the contact shadow half-fires (4.40). Final form (row ie, after the second review: the ray replaces ONLY
the strongest emitter's share — Ec = topE·V + clamp(E − topE·V, 0, rest), exact wherever ray and taps agree, so no rim line and no rescaled fill — hardness
read off the hints' SIGN (own = negative) rather than a ratio gate, strict veto, a lit ray through a pane tinted like the estimators' leaders): keyboard
contact **4.95 → 3.84 px** still / 6.02 → 4.73 motion (b: 3.90 / 4.48), the foot / panel overlap left soft (V1 penumbra-tile contrast 1.84 → 1.87), no
artefact in the crops — clean, but only half the way to (g)'s 1.6, because the strict veto disarms most of a contact edge whose deeper umbra reads wide.
Getting the rest needs per-light S from the estimator (or a second ray class) so a soft occluder's share can stay on the ratio while the hard one takes
the ray — a denoiser-interface question; parked, the switch left OFF by default. Cost either way: not measurable at rest (the default pipeline is compiled
without the tracer; the edge-ray one + its 0.1 ms mask kernel 'sharpEdge' run only while the setting is on).

**(g) the TAA's own knobs on top of (f)** (settings only): α 0.2 (g1) motion box edges −0.1…−0.2 px, still +0.05; kernel 12 (g2) still −0.05…−0.1, motion
0; α 0.2 + sharpen 0.4 (g3) motion −0.15…−0.35, still ±0.05. None closes the motion gap to (a) (2.5 vs 1.76): that is history resampling under camera motion
inside taau.wgsl — the temporal-jank lane's lever, and the one §1 says matters most.

**Gates**: typecheck clean at every commit · `tools/qa/gate.sh perf frame-layout player breach glass` 24 · 9 · 166 · 13 · 39 PASS, 0 FAIL (re-run after the
Frame block grew again: perf + frame-layout PASS) · `quality-plan.ts` exit 0 (the model files sharpU / compS as fixed per output pixel) · `tour.ts --runs 1`
PASS · `soak.ts --seeds 2 --minutes 4` no violations · `bun run build` OK · GPU validation (error scope + uncaptured) clean at high through debug views 1 / 3 /
9 / 11 / 13, render scale 0.6 → 1.0 → 0.77, sharp off / on, TAAU off / on, legacy ↔ v3, restir off / on, froxel off / on, gather ⅓ / vol ¼ flips, rt ↔ gloss,
night vision, keepHistories off / on, decals + a particle burst, the edge rays on / off; every preset visited by the cost run under sharp on / off with no error.

**Recommendation.** Ship at high and medium if +1.9 / +0.4 ms of union is worth a quarter pixel of box-edge width, 6–9 % of desk-tile contrast and — the part
no TAA tuning gives — native-resolution albedo under TAAU (decals, the coming markings / print, glass edges, emissive panels composited at 1777×1000 instead of
1368×770); default it off at low / verylow (a fixed ~1.6 ms against 4–6 ms frames; one line per preset in quality.ts). Do not expect it to answer the note by
itself: the resolve's motion softness (a → b) is the larger share and lives in taau.wgsl. Page: docs/review/sharp-direct.html (tools/qa/sharp-page.py).
