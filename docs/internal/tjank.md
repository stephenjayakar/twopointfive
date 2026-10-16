# Temporal jank under flicker, lightning, torches, rain (2026-08-11, lane `v3/temporal-jank`)

The report (the maintainer, playing at high on the merged v3 tree): *"the temporal reuse does look a bit jank with the flickering light in the
cubicle room, the lightning, and the flashlights … that feels like one big regression for image quality"* and *"seeing some boiling due to the
rain near the window in the cubicle room too"*. Reference = the pre-v3 chain (leader / tail direct estimator, dtemporal + softblur, the per-pixel
volumetric march, FXAA), which every v3 system still carries as its OFF path — so 'allOff' below is that chain rendered on this tree.

Method (M4 Max, Chrome / Metal, this worktree on :5211, shot sink :5212, `?paused&quality=high&mute`, the maintainer playing on the same GPU
throughout — no timing was taken from these runs). `tools/qa/tjank-scenes.js` (`__tj`) stages four pinned scenes, guards parked dark, phases
zeroed, grain off, `__resetClock` + a fixed frame-index seed before every scripted sequence so each variant draws the same jitter and dice; every
scripted game step renders OFFSCREEN (one render per game frame, read back as drawn); per tile per frame the mean luma, per pixel over the run
the temporal sd, |Δ|, max − min, the sd WITHIN each drive level (scene A: frames grouped by the tube's factor, transition frames excluded — noise,
not flicker), and the RMSE against the allOff run of the same frames (every variant renders the same 1777×1000 output grid). Variants: `v3` (=
the defaults), `noRestir`, `legacyDn`, `noFroxel`, `noTaau` (scale 1.0), `taauOnly` (the other three off), `allOff` (all four off, scale 1.0), and
`old` = the v3 defaults with this lane's fixes switched back off by their knobs. Numbers: docs/perf/tj-*.json; crops docs/shots/tj_<scene>_<variant>_
<tile>_f<k>.jpg (×3 nearest) + `_boil.jpg`.

- **A** — the tan cluster under `panel_cubicles_11`, the flickering tube (its area light + emissive box DRIVEN through offscreen renders by the
  game's own dropout pattern: `sin(90 t) > 0 → 15 %` = about two frames either way at 60 Hz; 'sq4' = 4 / 4 for the analysis). Tiles: the NW desk
  under it, the spine partition's shadow on the rug north of it (rugN), the NE chair and its shadow (chairN), the floor south, the aisle east.
- **B** — a lightning stroke of fixed bearing (south) / elevation 38° / peak 20 through the south windows onto the cubicle floor by the glass:
  frames −4 … +17 as game steps (the flash's own two-return-stroke envelope; the second stroke lands at +6). Tiles: the lamp-lit floor patch by the
  window, the desks / rug, the aisle, the window (the lot through the glass).
- **C** — a torch-like spot (the guards' hand-torch numbers) swept ±40° and slid 1 m over 60 frames across the tan cluster and the aisle carpet, in
  the level's haze. Tiles: the beam's floor, the cluster, a patch of air the beam crosses (haze), the carton and its shadow (box).
- **D / D2 / D3** — the rain: the interior view of the floor patch by the south-west window band + the window (D), the same from outside (D2), the
  wet lot under the south street lamp (D3, the F9 recordings' framing). Still scenes, 60 frames.

## The attribution (before any fix; composite = final LDR frames at high 1368×770 → 1777×1000)

| scene / tile / metric | allOff (ref) | v3 | noRestir | legacyDn | noFroxel | noTaau | taauOnly | owner |
|---|---|---|---|---|---|---|---|---|
| **A** rugN: lit-phase / dim-phase mean luma (sq4) | 43.9 / 14.9 | **38.7 / 21.5** | 41.8 / 16.4 | 39.4 / 20.1 | 38.7 / 21.5 | 40.3 / 19.9 | 42.6 / 15.5 | ReSTIR (+ the shadow denoiser under it) |
| A rugN: noise within a level, 8-bit sd, lit / dim | 0.92 / 0.31 | **2.30 / 1.76** | 1.35 / 0.40 | 2.19 / 2.01 | 2.18 / 1.72 | 1.89 / 1.70 | 1.25 / 0.34 | ReSTIR |
| A rugN / desk: RMSE vs ref per frame | — | 9.2 / 16.2 | 2.8 / 7.8 | 8.6 / 17.1 | 9.2 / 16.3 | 7.3 / 12.0 | 2.0 / 7.4 | ReSTIR |
| A, DIRECT-only view (debug 3), rugN lit / dim, dim-phase sd | 101.4 / 50.4, 0.59 | 95.8 / 59.9, 4.3 (raw ratio) | 100.4 / 51.8, 0.71 | | | | | ReSTIR's M cut + the ratio filter's variance |
| **B** floor by the glass: flash frame / +1 / 2nd stroke (ref +21.3 / +12.6 / +14.3 over 101) | 122.4 / 113.7 / 115.2 | **115.0 / 112.1 / 111.5** | 117.4 / 112.5 / 112.9 | 113.4 / 111.4 / 111.1 | 117.9 / 114.4 / 113.6 | 117.3 / 111.1 / 111.6 | 119.7 / 114.6 / 114.8 | ReSTIR 2.4 · froxels 2.9 · TAAU 2.7 · denoiser ~1 of the 7.4 missing on the flash frame |
| B desks: flash frame (ref 102.6 over 92.5) | 102.6 | **97.1** | 101.3 | 95.8 | 97.7 | 99.3 | 100.9 | ReSTIR + the v3 shadow client (the flash's floor came a frame LATE: 97.1 → 98.1) |
| **C** haze the beam crosses, mid-sweep frames 24…34 | 35 44 55 63 69 70 | **32 37 48 55 60 64** | 31 36 46 54 60 63 | 31 36 46 53 59 63 | 35 42 52 60 66 67 | 31 37 46 54 60 63 | 34 42 52 60 66 67 | FROXELS (1–2 frames behind, body −8 %) |
| C carton + floor as the beam arrives, frames 2…10 | 53 64 76 83 87 | 48 57 68 76 81 | 49 58 69 76 80 | | 52 63 74 82 85 | 49 59 70 78 82 | 52 63 74 82 85 | froxels (the haze over the floor) |
| C beam floor, RMSE vs ref | — | 3.0 | 2.2 | 3.1 | 2.4 | 2.2 | 1.5 | TAAU ≈ half a frame, denoiser the rest — small |
| **D** floor by the glass, still: temporal sd / |Δ| per frame | 0.22 / 0.14 | **0.60 / 0.085** | 0.085 / 0.02 | | 0.60 | 0.85 / 0.19 | 0.11 / 0.03 | ReSTIR — a slow crawl (rain off: 0.58, identical) |
| D window (the rain through the glass): sd | 2.28 | 1.80 | 1.79 | | | 2.34 | 1.80 | the rain itself (legit); TAAU calms it |
| D3 lot under the lamp: pool / edge / asphalt sd (rain 0: 0.18 / 0.005 / 0.014) | 9.0 / 2.4 / 1.5 | 8.5 / 2.0 / 1.2 | 8.4 / 2.0 / 1.2 | | | 9.1 / 2.4 / 1.5 | 8.4 / 2.0 / 1.2 | the rain streaks / splash rings — v3 = ref |

## Root causes, with the evidence

**A — the tube (the big one).** Three things stacked:
1. *ReSTIR's temporal confidence cut keyed on the raw target ratio* (`restir.wgsl`, `Mt = M × min(r, 1/r)`, r = the sample's light now ÷ its previous
   record at this point). The tube's dropout is a 15 % ↔ 100 % square wave with a two-frame half period: r = 0.15 or 6.7 at every edge, so every
   reservoir holding the tube dropped from M 20 to 3 twice a period — the whole pool ran on one to three samples throughout a burst. Its penumbrae
   (every partition, chair, monitor under it) became 1–3-spp Bernoulli noise, and the direct term itself LAGGED: direct-only view, rug tile lit / dim
   95.8 / 59.9 against the reference's 101.4 / 50.4 (`dv3_old`), i.e. the dim strokes 19 % too bright. The sample's VISIBILITY is exactly as valid after an
   intensity change as before, and the MIS already weighs last frame's target against this frame's — the cut bought nothing but the noise.
2. *The v3 shadow client booked the level step as variance.* Its light-motion cue shortens the class's history to 3 frames when the unshadowed
   luminance changes (correct), but West's moment update then measures the incoming ratio's variance about a mean that lags the new level, (l − m₁)²
   for 1/α frames: σ explodes after every stroke, the à-trous — guided by that σ — opens its luminance edge-stop, and every shadow the tube casts is
   blurred into its lit surround for a dozen frames, then sharpens, then the next stroke. Measured with the raw estimator's own tile means as truth
   (SoftShadow flag down): denoised 'settled' frames 2–4 after an edge read 0.335 vs raw 0.358 in the lit phase (−6.5 %) and 0.081 vs 0.069 in the dim
   one (+17 %) under the LEADER path too — this half is estimator-independent — and 0.318 / 0.093 under ReSTIR (its noisier input widens it). That is
   the pumping. My first two attempts at it (dropping the value history on a jump; skipping the young-history spatial-variance fallback) changed
   nothing to three decimals, which is what pointed at the variance rather than the value.
3. *The cue never saw the tube.* Both cues key on the class's unshadowed luminance U — and on that floor U is one part tube to three parts
   `street_lamp_s` (260 W/sr through the windows' reach mask, dark by every ray): the tube's 85 % stroke is a 21–25 % change of U at the desk right
   under it (measured: U₁ 3.16 → 2.42 at the desk, 1.52 → 1.20 at the chair). A jump threshold that a torch sweep does not trip (0.5) never fired.
   Then TAAU on top: fed a noisy, contrasty 3×3, its anti-flicker term quarters α and its clip box widens, so the composite held the other phase
   longer than either input alone (composite v3 40.2 / 17.8 after fix 1 alone, noTaau 41.8 / 16.5).

**B — the lightning.** The stroke is a transient kind-2 light. Through the reservoirs: on the flash frame it is NEW (enters MIS at full weight) —
but only for the pixels whose ONE fresh draw picked it; the ~10 % that drew the moon or a lamp instead show no flash that frame (−10 % of the tile,
dark specks the jump path then box-smooths). Its second return stroke six frames later is a 13× jump of a light the reservoirs now hold with M 20
of confidence in its decayed record: MIS hands the fresh sample 0.4 and the floor came up at 40 % of the reference's step, peaking a frame late
(110.7 → 111.5 vs 115.2). The rest of the flash-frame deficit is the froxel volume's transient path (window shafts injected un-jittered at half the
froxel grid's resolution with one shadow ray per texel: −2.9 on the floor tile against the march) and TAAU's clip at mullion-shadow edges (−2.7 —
where the 3×3 straddles both sides the old floor is inside the box).

**C — the torch.** The direct term keeps up (ReSTIR re-traces its samples every frame; U is exact) — beam-floor RMSE 3.0 vs the resolve alone 1.5.
What trails is the FROXEL haze: the accumulated volume (history 0.93, clamped to the four across-neighbours' box, half weight where clamped) builds a
beam's new position from ≤ 2 frames of samples and never lets a bright core froxel's history sit above this frame's own (noisy) sample, so the swept
beam reads 1–2 frames behind the march and its body 8 % under it (p2b §3.3–3.4 had both as known costs).

**D — 'the rain'.** Not the rain. On the lot every variant equals the reference to the second decimal once the rain's own motion is what the sd
measures (rain 0 → 0.18 both); TAAU's reactive input costs nothing there. The floor patch by the glass, though, crawls under ReSTIR alone (sd 0.60
vs 0.085 without it, |Δ| per frame only 0.085 — a slow drift, not frame noise), rain or no rain: the per-tile temporal GRADIENT (fresh-vs-temporal
paired z, threshold 3.5) misfires on 1–2 % of that floor's tiles every frame (debug view 11 read back over the tile) — one rarely-visible light (the
lamp through the mullions) dominating the tile's unshadowed weight makes the one-sample fresh estimates too skewed for the z to be normal — and each
misfire resets an 8×8 tile to one sample: patches that come and go. `restirGradK 5` → sd 0.35 (= gradient off 0.35; M cap 8 / 30, spatial reuse
everywhere, 5 rays: no change).

## The fixes (commit 8eb32ff + follow-ups; every one behind a knob, Tab rows)

| # | file · knob (default) | what |
|---|---|---|
| i | `restir.wgsl` phase 1 · `restirRatioRaw` (false = new) | the confidence cut's ratio is GEOMETRIC: each target ÷ its light's power then / now (luminance of the uploaded colour). Intensity / hue changes keep the history; a swept cone or a moved lamp still lets go (dropping the cut entirely measured no better on the torch: C 'ratioOff'). |
| i′ | `restir.wgsl` scoring + trace + shade (no knob: transients simply are not candidates) | TRANSIENT lights are their own history-free stratum: one dedicated shadow ray per pixel per class (one transient picked ∝ weight if several), E × V added to S in its own hue through its own panes, never a candidate / belief / reservoir; U counts them, the denoiser's cue counts them, the believed-visible hue does not. |
| ii | `restir.wgsl` U.a + `denoise.wgsl` shPack / shTemporal · `dnShadowJump` (0.5; 0 = off; rides in DnParams.flags.w ‰), flags bit 32 set while ReSTIR is on | U.a = the luminance the pixel BELIEVES visible (live, not tile-dark, not its darkSlot, + transients); the shadow client's light cues key on it (CUR.a → HV.a; the hints always travelled in SHARED). A cue change past the jump threshold within one frame: value from this frame alone with bright outliers capped at the 5×5 mean + 1σ and leant onto that mean (sharp class 0.25, broad 0.75 — measured 0 / 0.5 / 0.75), the sample VARIANCE carried across and its mean snapped, no young-history fallback that frame. Under `?norestir` U.a is 1.0 and the cues fall back to U (that path unchanged). |
| iii | `taau.wgsl` · `taauLightJump` (**1 = off**) | a lighting-change boost (3×3 mean vs history, linear luminance ratio) — built, measured to change nothing on A or B (the resolve's share is small and its clip already follows a level within 3 %), left OFF as an A/B row. |
| iv | `froxel.wgsl temporal` (consts `FX_CLAMP_UP` 0.15, `FX_MOVED_K` 0.8) | 15 % head-room above the neighbourhood box (a bright core froxel's history may sit above this frame's dip) and a clamped history hands 0.8 (was 0.5) of the froxel to this frame. |
| v | `engine.ts` · `restirGradK` 3.5 → 5 | the tile gradient's threshold; a real change (a door, a walking shadow) moves z by dozens. |

## After (same scenes, same frames — 'main' = 1097de3 served beside this tree, 'NEW' = this branch's defaults; docs/perf/tj-final-{old,new}.json)

**A, composite, high** (crops tj_AGgame{old,new}_{allOff,old,new,noRestir}_*_f2{0..3}.jpg): lit / dim tile mean · noise within a level (8-bit sd) lit / dim · RMSE vs the ref's frames

| tile | ref allOff | main | **NEW** | noRestir (leader path + the v3 chain, this tree) |
|---|---|---|---|---|
| rugN (sq4) | 43.9 / 14.9 · 0.91 / 0.31 | 38.7 / 21.5 · 2.30 / 1.76 · 9.2 | **43.1 / 14.7 · 0.83 / 0.64 · 2.9** | 41.8 / 16.4 · 1.37 / 0.40 · 2.8 |
| chairN | 31.9 / 13.4 · 0.51 / 0.22 | 28.7 / 20.3 · 1.71 / 1.25 · 8.4 | **31.7 / 14.0 · 0.85 / 0.79 · 2.4** | 30.8 / 14.4 · 0.80 / 0.29 · 2.2 |
| desk | 117.6 / 79.0 · 0.58 / 0.32 | 111.0 / 91.9 · 2.73 / 1.81 · 16.2 | **114.3 / 78.9 · 1.74 / 1.91 · 8.2** | 114.5 / 81.0 · 1.24 / 0.46 · 7.8 |
| aisle | 52.8 / 23.9 · 0.90 / 0.42 | 48.2 / 29.3 · 2.19 / 2.07 · 9.9 | **51.3 / 24.5 · 1.27 / 0.85 · 5.0** | 50.7 / 26.3 · 1.48 / 0.64 · 4.3 |
| floorS | 110.6 / 90.4 · 0.52 / 0.46 | 105.3 / 94.9 · 2.56 / 1.14 · 9.5 | **107.7 / 91.4 · 1.77 / 1.04 · 5.9** | 108.2 / 93.1 · 1.07 / 0.67 · 5.3 |
| rugN, the game's own 2-frame pattern | 43.0 / 14.9 · 0.62 / 0.33 | 37.3 / 22.5 · 1.64 / 2.57 · 11.3 | **42.4 / 14.4 · 0.78 / 0.71 · 3.3** | 40.5 / 16.1 · 0.84 / 0.45 · 2.8 |
| desk, game pattern | 117.1 / 79.0 · 0.34 / 0.38 | 110.0 / 92.6 · 2.49 / 4.20 · 18.5 | **113.4 / 78.5 · 1.45 / 2.10 · 8.4** | 113.5 / 80.5 · 0.65 / 0.59 · 8.0 |

The levels now track the reference within a luma step or two in both phases (the pumping is gone; the direct-only view read 101.5 ± 0.1 / 45.1 mid-lane
where the tube's own steady dim level under ReSTIR is 47.1 and the reference 50.4 — what is left there is the estimator's static level in a dim
multi-light umbra, not lag) and the per-level noise is 1–3× the reference instead of 3–8×; the RMSE against the reference's own frames is a third of
main's and at or under the leader path's on the same tree. What remains visible in a ×3 crop of the dim phase: ReSTIR's dim-regime grain (desk 1.9 vs
0.3) — with a two-frame strobe every other frame IS a jump frame, no ratio history survives that, and the reservoirs' visibility memory (kept by fix i)
is what keeps those frames from being raw. Direct-only crops from mid-lane: tj_Adv3c_{dv3_allOff,dv3_new(=fix i alone),j_c1_l075,dv3_old}_rugN_f2{0..3}.jpg.

**B** (crops tj_BG{old,new}_{allOff,old,new}_{floorGlass,desks,window}_f0{4,5,6,9}): floor by the glass, frames 3…12 (strike at 4, second stroke at
10): ref 101 **122.4** 113.7 108.0 104.7 103.0 **117.5** 115.1 112.1 109.5 · main 100 **113.9** 111.1 107.6 105.2 103.7 **110.8** 111.2 110.1 108.6 ·
NEW 101 **116.9** 112.3 108.2 105.6 104.2 **113.0** 112.8 110.9 109.2 = the leader path's own numbers on this tree (117.2 / 113.2); desks ref 92.6 →
**102.6** / main **97.1** (and 97.3 the frame after: it arrived a frame late) / NEW **100.9**. The 5.5 still missing on the flash frame is the froxel
shafts (mid-lane: NEW without froxels 119.6) and the resolve (NEW without TAAU 119.1) — one frame at ~75 % of a 21-unit step instead of 100 %, gone by
the next; the desks crop shows the flash's mullion-lit floor at full strength on frame 0 where main shows a grey smear that lands on frame 1.

**C**: haze mid-sweep main 46.6 / 53.5 / 59.5 / 64.1 → NEW 47.4 / 54.4 / 60.5 / 65.0 (march 52.6 / 60.0 / 67.0 / 68.6): a third of a frame nearer
and +1 at the plateau — less than the isolated hot-reload take promised (47.1 → 65.9); the still beam (torch frozen, 40 frames) sd 0.11 / 0.07 / 0.07
→ 0.10 / 0.02 / 0.05, means +1 % / +0.1 %. Honest read: the froxel beam still trails the march by a frame and reads ~6 % under it while sweeping;
what is left is the two-frame sample budget of a beam's new position (p2b §6 'sweep mottling': more sub-rays while `moved` is high), not started here.

**D**: floor by the glass sd main 0.535 → **NEW 0.391** (|Δ| 0.064 → 0.058) with `restirGradK 5`; noRestir 0.086, allOff 0.223. Still 4× the leader
path's residual there — the same static regime as the vending lino (p2a §5): a broad light through mullions = a patch that is all penumbra.

**A note on the mid-lane numbers** (docs/perf/tj-A-composite-*.json, tj-B2, tj-C, tj-reg, tj-tiers): from the cue's introduction until the identity
work at the end, an appended `//` on the uniform-packing line had swallowed the two statements after it, so those takes ran the shadow client with its
MOVING history length at 0 (the light-motion cue off) and, at low / verylow where no reflection chain rewrites it, the gather-grid divisor at 0. The
tables above are the re-take with the line restored (main from its own tree, so nothing emulated); the mid-lane composite numbers happened to agree to
within a step because under the strobe every frame is a jump frame either way. The tier sweep below predates the fix; its low / verylow rows were re-taken after it and agree.

## Static quality, tiers, cost, identities, gates

- **Static tiles** (composite, 40 frames after 80, high; two takes each; main → NEW): P3's cubicles still — desk 0.058 / 0.045 → 0.072 / 0.062 ·
  chairs 0.085 / 0.079 → 0.073 / 0.069 · mid-floor 0.058 / 0.046 → 0.064 / 0.054; desk-lamp pool 0.050 / 0.043 → 0.059 / 0.053, under-desk 0.028 = 0.028;
  corridor lino 0.021 / 0.016 → 0.022 / 0.017, wall 0.022 / 0.015 → 0.021 / 0.015; vending lino / contact 0.012 / 0.011 → 0.012 / 0.011, 0.013 →
  0.013 — hundredths of an 8-bit step, inside or a hair over the take-to-take spread (the cue keyed on the believed-visible light is a little more
  sensitive: a light entering / leaving a tile's dark set is now a change it sees). Every tile mean identical to 0.5 %; spatial high-pass identical.
- **Tiers** (scene A game pattern + B, all five presets, this tree with the knobs back = 'old'; docs/perf/tj-tiers.json; taken mid-lane — see the
  note above; low / verylow re-taken after the fix read the same to a decimal: A rugN low 41.95 / 14.99 · 1.18 / 0.87, verylow 41.5 / 15.6 · 1.35 / 0.98, B 121.5 / 122.3): A rugN lit / dim (ref · old · **new**), noise lit / dim old → new — ultra
  43.3 / 14.8 · 36.7 / 23.6 · **42.6 / 14.2**, 1.58 / 2.55 → 0.62 / 0.60 · high 43.0 / 14.9 · 35.9 / 24.0 · **42.4 / 14.5**, 1.73 / 2.73 → 0.77 / 0.73 ·
  medium 44.0 / 14.7 · 35.3 / 24.2 · **42.3 / 14.7**, 1.84 / 2.84 → 0.85 / 0.79 · low 44.3 / 14.7 · 33.6 / 23.8 · **42.0 / 15.1**, 3.38 / 3.57 → 1.16 /
  0.90 · verylow 43.5 / 15.2 · 31.2 / 23.9 · **41.7 / 15.7**, 2.96 / 3.01 → 1.34 / 0.98. B flash frame (ref · old · **new**): ultra 122.2 · 121.2 ·
  **122.3** · high 122.0 · 115.7 · **117.3** · medium 122.3 · 115.4 · **117.2** · low 122.3 · 119.3 · **121.8** · verylow 122.4 · 119.5 · **123.0**. Zero
  validation errors at any preset through the sweep (error scope + the uncaptured list), 0 after every batch since.
- **Cost** (cubicles still, high 1368×770, serialized, `__p3.abMed` 4 rounds × 24 interleaved, knobs old vs new — the maintainer on the GPU, so
  read the deltas): direct 2.56 → 2.56 · softblur (= the v3 shadow chain) 1.18 → 1.18 · temporal 0.26 → 0.26 · gather 1.97 → 1.97 · volFroxel 0.52 →
  0.52 · taau 0.26 → 0.26 · union 8.13 → 8.13 ms (Δ 0.00 everywhere). The transient stratum's ray exists only while a transient reaches the pixel: the
  direct pass read 3.4–3.8 ms on the four frames before a stroke and 3.5–3.6 on its flash frames (scene B's view; inside the take's noise).
- **OFF identities**: direct.wgsl / direct_common.wgsl, dtemporal / softblur, volumetrics' march and the FXAA blit are untouched by the diff, and
  `?norestir&legacydenoise&nofroxel&notaau` at high hashes **9aff1af2** on this branch, on the base commit served from a scratch worktree (:5213) and on
  main (:5180) — `__p3.identityHash(40)`, first call after boot; and only the first: the sequence is not idempotent, and two boots of one tree
  differ by max 9 / mean 0.07 in the readback, so pixels, not hashes, were the criterion until the culprit was found. That culprit is worth a line for
  whoever touches denoise.ts next: with the jump threshold parked in `DnParams.gi2.w` (documented spare) the all-off frame at high differed from
  main's by max 13 / mean 0.47 EVEN WITH the base's denoise.wgsl hot-swapped in — i.e. `gi2.w ≠ 0` reaches the REFLECTION chain's frame under
  `?legacydenoise` although every read of `prm2.w` there sits behind `SPEC` (pipeline constant, set on those pipelines). Moved to `flags.w` (‰) it
  vanishes; not chased further. `?norestir` ALONE is not byte-identical to main by construction — the shadow client's jump path is estimator-
  independent (`dnShadowJump 0` + `restirGradK 3.5` give the old numbers back).
- **Gates** (63d… = the follow-up commit): typecheck clean · `tools/qa/gate.sh perf frame-layout player breach glass weather` exit 0 (24 · 9 · 166 · 13 ·
  39 · 12 PASS lines, 0 FAIL) · `tour.ts --runs 1` PASS (0 warnings) · `soak.ts --seeds 2 --minutes 4` 0 exceptions, no violation kinds · `bun run build` OK.


## (vi) Motion sharpness of the TAAU resolve (added to the brief by the sharp-direct lane's finding)

Their measurement: ~70 % of the sharpness lost IN MOTION between the old renderer and v3 is the temporal RESOLVE at any scale (edge-spread on lit box
edges, still / motion: old 1.60 / 1.76 → v3 at scale 1.0 1.82 / 2.44 → shipping high 1.91 / 2.69 px). Instrument: their `tools/qa/sharp-harness.js` +
`sharp-metrics.py` taken over as files (port check relaxed, sink :5212), views V1 (manager's desk) and V3 (cubicle desks), `capStatic` (40 settled
renders) and `capMotion` (a 20-frame 0.3°/frame orbit ending on the view's yaw — the last MOVING frame), graded offline: 10–90 % rise across the named
edges in output px, high-pass RMS in the named tiles. Tags tj0* = this tree before, tj2* = after; h / m / l = high / medium / low.

What was wrong with the first cut: I keyed the terms to ≥ 2 output px / frame of reprojection as suggested and NOTHING moved (tj1*: every edge within
±0.05 px) — a 0.3°/frame orbit round the look-at moves most of the picture well under a pixel a frame, and the softening is there regardless: the
history is resampled (5-tap Catmull-Rom) at ANY fractional offset, every frame, and at α 0.1 the picture is ~90 % that resample. So the terms engage
from ⅛ px / frame and are fully in by ½ px / frame (`taau.wgsl MOTION_PX`):
- `taauMotionAlpha` (0.4): the new-frame weight a moving pixel is raised to (× prox: where this frame's jitter has a sample near the output pixel) —
  THE term: alone it takes V3's keyboard edge from 2.40 to 1.79 px in motion.
- `taauSharpenMotion` (0.3): the final blit's RCAS gains this while the CAMERA moves (engine.ts: the largest screen displacement of the look-at and four
  points 3 m round it between the two unjittered view-projections, same ramp) — a small extra (2.32 → 2.06 on V1's keyboard alone).
- `taauMotionClip` (A/B, default 0): narrowing the clip box under motion measured nothing on top (1.75 with, 1.79 without) and slightly widened the
  contact shadow's profile; left as a row.
The still picture is untouched by construction (camStill → vel 0 → both terms 0; every static number identical to the digit).

| high (1368×770 → 1777×1000) | still before → after | motion before → **after** | (lead's numbers: old renderer / v3 ×1.0 / high) |
|---|---|---|---|
| V3 kbFar (box) | 1.46 → 1.46 | 2.40 → **1.75** | |
| V3 partTop (box) | 1.94 → 1.94 | 3.77 → **3.43** | |
| V3 deskEdge (box, against the dark floor) | 4.30 → 4.30 | 4.25 → 4.43 | |
| V1 kbTop (box) | 1.72 → 1.72 | 2.32 → **1.94** | |
| V1 paper (box) | 1.54 → 1.54 | 2.13 → **1.56** | |
| median of the five box edges | 1.72 → 1.72 | 2.40 → **1.94** | 1.60 · 1.82 · 1.91 still / 1.76 · 2.44 · 2.69 motion |
| V3 desk tile contrast (hp RMS), still / motion | 4.23 / 3.09 (−27 %) | 4.23 / **3.63 (−14 %)** | −25…−34 % in motion before |
| V1 lit-desk tile, still / motion | 2.61 / 2.05 | 2.61 / **2.41** | |
| V3 penumbra tile (a soft shadow: noise, not detail), motion | 0.49 | 0.59 | the price: less history = more of the frame's own noise |
| V1 kbShadow (contact) / footShadow (penumbra), motion | 5.15 / 10.07 | 5.44 / 10.39 | (soft edges read a little wider through that noise) |

Medium: box-edge median in motion 2.87 → **2.37** (still 2.55 → 2.51); V3 desk contrast motion / still 2.50 / 2.81 → 2.94 / 2.79. Low: 2.99 → **2.42**
(still 3.08 → 3.07); desk 2.08 / 2.27 → 2.55 / 2.27; V3's partition-top edge reads WORSE at low in motion (3.42 → 4.58: at 768×432 the 3-px strip is
under two internal pixels and the frame's own estimate of it aliases — the one regression in the table; the α term could be scaled by the tier's
render scale if it shows in play). Crops ×3: docs/shots/sh/{tj0h,tj2h,tj2Ah}_{v1,v3}_{static,motion}_*.jpg.

**Do the dynamic-light scenes get noisier than the pre-v3 reference in motion?** Scene A under the same 0.3°/frame orbit (docs/perf/tj-orbit.json;
`__tj.run(…, {orbitDeg})`), spatial high-pass RMS per tile (detail + noise — the metric cannot tell them apart) with the tube strobing: allOff (the old
chain) rugN 1.14 · chairN 0.74 · desk 3.68 · aisle 1.40 · floorS 2.66; NEW with the motion terms 1.02 · 0.96 · 2.81 · 1.53 · 1.99; NEW without them 0.77 ·
0.65 · 1.89 · 1.02 · 1.49 — i.e. the terms bring the moving picture's fine content back UP to just under the old renderer's (over it on the chair tile,
+30 %, and the aisle, +9 %). With the tube steady, frame-to-frame |Δ| per tile NEW 1.06 · 0.89 · 3.30 · 1.57 · 2.11 vs allOff 1.07 · 0.84 · 3.27 · 1.42 ·
1.94 (crawl in motion at the reference's level, ≤ +10 %); RMSE against the reference's own frames under the strobe unchanged by the terms (3.36 / 2.67 /
8.16 vs 3.36 / 2.53 / 7.86). Cost: ALU only in the resolve; the blit's sharpen constant is rewritten while the camera moves.

## Left honest

- ReSTIR in dim multi-light penumbrae is 2–4× the leader path's temporal noise as a slow crawl (the tube's dim phase, the lamp's patch through the
  mullions, the vending lino): one reservoir per class, a W that random-walks with a ~M-frame memory. This lane removed what AMPLIFIED it (the M cut,
  the gradient misfires, the variance step) — the base rate is the estimator's, and the ratio filter cannot average a 20-frame-correlated error. The
  lever is more fresh visibility information where the class's live weight is spread over several partially-visible lights (a second fresh candidate
  there only, or shorter M where W's variance is high) — a P2a follow-up, measured against these scenes.
- The tube strobes at 14 Hz — every other frame. Any history-based chain shows a two-frame square wave as some pumping; the reference chain had none
  only because it had (almost) no history. If the LOOK allows, dropouts that hold ≥ 5 frames (real failing tubes flicker at mains frequency, invisibly,
  and drop out for tenths of a second) would read as flicker rather than strobe under any renderer — an authored-effect call, parked for the maintainer.
- The froxel beam under a fast sweep (above); the flash frame's shafts at half froxel resolution (−3 % of the floor tile for one frame).
- `taauLightJump` exists and is off; `restirRatioRaw`, `dnShadowJump 0`, `restirGradK 3.5` give the 08-11 behaviour back per system for A/B.
