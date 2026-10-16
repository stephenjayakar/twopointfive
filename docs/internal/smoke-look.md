# Smoke look — "blockier / pixelated at high" and "banding near the sodium lamps" (lane `fix/smoke-look`)

> **STATE: done, ready to merge (branch `fix/smoke-look`).** Both notes trace to ONE thing — the froxel J volume (P2b, 08-10) lighting the marched plume — and one
> switch answers both: `settings.smokeMarchLights` (Tab ▸ Volumetrics ▸ Smoke ▸ 'plume: lights lit per step'; presets ultra 4 · high 3 · medium 2 · low / verylow 0;
> `frame.volCfg.w` bits 8‥11; **0 = main hash for hash**). Gates green (below). The lane's servers / headless Chrome / comparison worktrees are torn down at hand-off.

> **SUMMARY (10 lines).** (1) The tour's Smoke stop restaged deterministically and captured IN MOTION on main, on b613869 and on b9f2939^: **no build made it blockier**
> (main ≡ b9f2939^ to three decimals; the 08-11 morning build is grainier if anything; the render-defects march, the smoke port, scale 0.5, 25 fps, full-res march,
> volQuarter, volReact, the sharp texel maps all A/B'd: no visible change). What HAS degraded the showcase plume is older: since P2b the marched density is LIT
> from the froxel J volume (15 cm × one 0.6 m slice per texel), so a torch entering the plume lights every billow alike — a flat, 15 % over-bright blob beside the
> per-pixel march (sl2_cmp_t5m_core_x3.jpg). (2) The 'banding' is the same J: a plume top under a lamp head (or a ceiling panel — the 08-12 report) is lit through
> J's slice lattice, FIXED TO THE SCREEN: a world point on the plume swings 8 display levels as the camera dollies 1.5 m (the exact march: 3) — invisible in any
> still (two lanes found nothing), obvious live as the follow camera or the rising plume moves through it. FIX: with `smokeMarchLights` K > 0 injectJ writes only the
> AMBIENT into J and the march lights the K strongest lights on each stretch per step itself (the P0c march's exact culls and inner loop: cone edge, a shadow ray
> every 2 steps, the step's own self-shadow) + three cost rules (minor lights ray-less, weight-gated refresh, 30 m directional rays). Result = the exact march's
> plume (tile means within 1 %, dolly swing 1.65 vs march 1.68 vs J 5.6) for **+0.22 ms union at high in the showcase doorway, +0.44 in the worst lot framing**
> (a 3.5 m plume filling a fifth of the frame under a 65° lamp) — over the +0.3 brief in that one framing, said so below; K 2 at high would be +0.13 / +0.40.

Machine / method: M4 Max; a PRIVATE headless Chrome (`--headless=new`, Metal, `--force-device-scale-factor=2`, 1600×900 CSS → high 1368×770 → 1777×1000) driven over
CDP from this worktree (:5234, sink :5244), main @5e9fb65 served BESIDE it (:5237) plus b613869 (:5235) and f867726 = b9f2939^ (:5236) for the bisect; every capture
`?paused&quality=high&mute(&nocivilians)`, seeded `restartEncounter`, phases zeroed, grain off, ONE CONFIG PER FRESH BOOT; cost = serialized still renders, variants
interleaved round-robin, min of round medians, `tools/qa/gpu-quiet.sh` first (the GPU was shared with three lanes: several takes went to 18–25 ms unions mid-round and
are kept in docs/perf as contended, not quoted). Instrument: `tools/qa/smoke-look.js` → `__sk` (`tour` = the real stop 7 via `__demo.goto(7)`; `door` = the doorway plume
pinned, torches optional; `lot` = a can under street_lamp_s / _e, storm on/off; `motionFrame` = the last-but-one stepped frame read back = rendered IN MOTION with real
history; `orbitFrame`; `frame(view)`; `crop / cropStretch / full / hash / metrics / colProfile / temporal`; `take / costAB`; `validate`).

## 1. "Smoke image quality has suffered — a lot blockier and pixelated in the smoke showcase at high"

**Bisect by build** (docs/perf/smoke-look-tour-{main,old1,old2}.json; crops docs/shots/sl2_tour_<tag>_t{5,8,11,13}m_{core_x3,beam_x3,edge_x4}.jpg, in motion under the
swinging tour camera):

| build | t5 core hf1 / blk | t8 core hf1 / blk | t8 beam hf1 / blk | verdict |
|---|---|---|---|---|
| main 5e9fb65 | 0.616 / 0.985 | 0.452 / 0.504 | 0.498 / 0.662 | — |
| f867726 (= b9f2939^, before the smoke port) | 0.616 / 0.985 | 0.452 / 0.504 | 0.498 / 0.662 | identical: the port's T1 is exact, its calm rule never engages (the can vents all 15 s: period 1), smokeShadowSteps 8 |
| b613869 (08-11 morning: before render-defects, motion-calm, gatherStrata) | 0.722 / 1.067 | 0.649 / 0.667 | 0.648 / 0.729 | GRAINIER (taauMotionAlpha 0.4 then vs 0.25) + the since-removed motes; not blockier |

(hf1 = mean |L − 3×3 mean|, pixel-scale grain; blk = 2×2-block vs 7×7 energy, texel-scale blockiness; display luminance.)
**By switch on main** (same JSON family, tags mainS50 / mainS60 / main25 / mainV1 / mainNF / mainNFK0): render scale 0.5 / 0.6 (what a ladder cut gives): softer, metrics
flat (blk 0.50 → 0.50 / 0.49); 25 fps stepping (a contended GPU: solver at 40 ms, 2.4× fewer resolve frames per game second): no change; vol divisor 1 (the march at full
internal res, `passes.setDivisors` forced): indistinguishable at 15 m (sl2_cmpV1_*); `volQuarter` is off at high and the ladder's climb / cut never touches it there
(only medium− start with it); TAAU's `volReact` carries the rain / sky flash only — no smoke term; the sharp / decoupled internal↔output vol texel maps are right (composite
`upsampleVol` under SHARP, taau `qv`); the raw one-frame-history look (sl2_tour_main2_raw_core_x3.jpg) IS pixelated at internal res — what any TAA history drop shows for
a frame — but nothing in the stop drops it. **The pre-41d8d7f march** hot-swapped in (`__hotVol` with b613869's file): identical metrics in stills and in motion.

**What did degrade, and when: the froxel J volume (P2b).** Beside `?nofroxel` (every step lit exactly) today's plume is a flat, foggy, over-bright blob —
sl2_cmp_t5m_core_x3.jpg / sl2_cmp_t8m_beam_x3.jpg (main | ?nofroxel | b613869): the torch-lit puff, the shadowed underside, the wisps under the beam are gone; core tile
mean 102 vs 87. The density is still marched per pixel at 8 cm, but its LIGHTING is one trilinear fetch of J — 15 cm across, a whole slice (0.6 m at 15 m) deep — so
the cone's edge, the leaf's shadow and above all the plume's OWN shadow along the beam (the modelling that makes billows read as billows) come out as one ramp, and the
self-shadow taken at texel centres outside the dense core under-darkens it. Torches suffer most; that is what the showcase plume is lit by.

**Fix — `settings.smokeMarchLights` K** (`vol_common.wgsl smokeMarchLights()` = `frame.volCfg.w` bits 8‥11, read by BOTH producers so they always agree on who lights
what): K = 0 → `smokeMarchJ` and `injectJ` exactly as they were; K > 0 → `injectJ` writes the ambient alone into J (`nw = 0`: no light loop — volFroxel −0.07‥0.09 ms)
and `smokeMarchJ` builds, per stretch, the shortlist of the K strongest lights by unshadowed bound with the K > 0 march's exact culls (range, the 0.03 floor,
`coneInterval`, the panel's facing; directional kept on colour) and lights each lit step with them — evalLight, a shadow ray + 4-tap `smokeSelfShadowIn` refreshed
every `volShadowEvery` (2) steps on that march's coherent phase, `phaseHG` 0.35 — the K+1-th dropped as that march always dropped it. Three cost rules, each measured
(§3): a MINOR light (unshadowed E under `MARCH_MINOR_K` 4 % of the stronger ones' at the step — the moon under a sodium head) spends no ray and no taps and is credited
with the strongest light's self-shadow (dropped in its shadow); a slot refreshes only at steps whose weight T·(1−e^−σΔ) exceeds `MARCH_REFRESH_W` 0.02 (each traced at
least once a stretch); a directional shadow ray ends at `MARCH_DIR_TMAX` 30 m (from under 3.5 m a ray climbing ≥ 15° has cleared this level's roofs by then).
Result on the tour stop at the high default K 3 — sl2_cmpK3_t{5,8,11}m_{core,beam}_x3.jpg (main | K3 | ?nofroxel): billow for billow the per-pixel march (core mean
85.5 vs 87.2 vs main's 102.3; docs/perf/smoke-look-tour-K3.json).

## 2. "Smoke banding (only near sodium light)" — J's slice lattice, fixed to the screen; only visible in motion

Restage: `__sk.lot({lamp:'s'})` — a can at (16, 0, 25.4) under street_lamp_s (spot 260, 65°, r 0.18, 5.05 m up), pitch 55°, 15 m, dry and in the storm. Stills (converged
TAAU or the raw volumetric view 5) show NO bands at any distance, contrast-stretched or in row-mean autocorrelation, on either build — as the render-defects lane found
indoors. (Two false alarms on the way, recorded so nobody chases them again: hard 'rectangles' in the stretched dark haze beside the plume, sl2_band_s15_hazeR_v5s_x2.jpg,
are 8-bit quantisation contours of a 0–16-level gradient with the post grain switched off for capture — the reach masks and the froxel clusters are innocent, `lightReach`
off changes nothing; and the froxel−march difference image over the plume, sl2_diff_s15_froxMinusMarch_v5_x2.jpg, is smooth: J's error is a bias, not a pattern — in a still.)
**The signature is temporal.** Frozen plume, camera dollied 13.5 → 16.5 m in 5 cm steps, the mean luminance of a WORLD-anchored 7×7 patch on the plume per step
(docs/perf/smoke-look-dolly-lot-s.json view 5; …-final-v0.json through TAAU):

| lighting | plume-top patch: swing (range / sd) | mid-plume patch | frame-to-frame residual sd |
|---|---|---|---|
| J-lit (K 0, main) | **7.9 / 2.3** (final view 5.6 / 1.8), periodic in distance | **8.5 / 2.8** (6.0 / 2.0) | 0.23 |
| exact per-pixel march (`?nofroxel`) | 3.2 / 0.7 (1.7 / 0.35) | 2.5 / 0.6 (1.4 / 0.27) | 0.19 |
| **K 3 (shipped)** | 4.1 / 0.8 (**1.65 / 0.39**) | 2.9 / 0.6 (**0.99 / 0.27**) | 0.19 |

J point-samples the lamp-lit, self-shadowed light field once per SLICE along each pixel's ray; where that field is steep — the top decimetres of a plume 2 m under a
sodium head, or under a ceiling panel (the 08-12 cubicles report) — the plume's brightness at a world point depends on where the slice centres fall in it, and the
slices are fixed in view distance: iso-distance contours = roughly horizontal, screen-fixed bands ±2‥4 % that the plume PULSES THROUGH whenever the follow camera or
the rising smoke moves it relative to the camera. sl2_dollystrip_lot_s_K0_vs_K3_x3.jpg: the same patch at seven distances 30 cm apart — top row J (207.6 → 210.3 →
204.6 → 209.9), bottom row K 3 (195.3–195.9). With the lights out of J there is no lattice left in anything steep (the ambient varies over metres; the grid holds it).

## 3. Cost (high 1368×770, serialized, interleaved, min of round medians; quiet takes only)

| scene | K 0 (main) union / vol / volFroxel | K 2 | K 3 | `?nofroxel` |
|---|---|---|---|---|
| doorway showcase plume, two torches + panels (docs/perf/smoke-look-cost-door-K.json) | 13.41 / 0.14 / 0.61 | 13.54 (+0.13) / 0.32 / 0.53 | **13.64 (+0.22)** / 0.39 / 0.53 | 14.51 (+0.8, the whole march path) |
| lot: 3.5 m plume filling a fifth of the frame under the 65° lamp (…-cost-lot-K.json) | 10.62 / 0.13 / 0.73 | 11.02 (+0.40) / 0.58 / 0.64 | **11.06 (+0.44)** / 0.60 / 0.64 | 11.26 (+0.64) |

Where it goes (lot, K 3, hot-swapped variants, vol pass): as first built 0.88 = rays 0.53 + self-shadow taps 0.24 + the rest; the moon's 1e6 m ray from every lit step
0.18 → the minor-light rule + the 30 m cap; refresh-weight gate 0.02 → −0.03 (0.05 / 0.10 / 0.20 save 0.04 / 0.15 / 0.23 but 0.10 already prints stale-answer contours in the
lower plume, sl2_cmp_lotW_K0_W02_W10_march_x2.jpg — kept at 0.02); **negatives**: rays every 4 steps on a per-PIXEL phase (dithered stale edge) 0.69 — dearer than every 2,
the workgroup's lanes no longer trace together; every 4 on a per-FRAME phase 0.59 and −0.10 volFroxel but a shadow edge flickers ±1 level at a 4-frame period in motion
(final-view dolly residual sd 1.46 vs 0.2) — dropped; every 2 on the K > 0 march's coherent phase is what ships (0.60). No memory. Nothing when no plume is on screen.
**Over the brief's +0.3 ms in the worst framing (+0.44); within it in the showcase (+0.22).** If that is too dear: high at K 2 (+0.13 / +0.40), or ultra-only.

## 4. Identity, gates

K 0 = main: the frozen doorway staging (torches on) booted fresh on both trees — volumetrics-only view hash-IDENTICAL (db2cd855 main = lane), final view within
main's own boot-to-boot floor (max 2 LSB, 0 px > 2; main vs itself the same) — re-checked after merging main @49c7ad9 (particle rain v2) INTO the branch: db2cd855
again both sides, final view max 2 / 0 px > 2; validate re-run in the storm lot (rain + smoke) 360 frames 0 errors; build / gate.sh perf / journal-fixtures green again. `bun run typecheck` clean · `bun run build` builds · `sh tools/qa/gate.sh perf` green (frame-
layout untouched: volCfg.w's spare bits) · `probes.ts journal-fixtures` ALL PASS · `probes.ts panel-inventory` re-frozen with the new row · `__sk.validate()`: ultra‥verylow ×
froxel on/off × K 0/3/6 × frozen/live × views 0/5/3, 360 frames, 0 GPU errors, 0 console errors, 103/103 pipelines.

**By eye, for the maintainer:** the tour's Smoke stop at high (K 3 vs Tab row at 0), a can under the south lot lamp watched from the follow camera while walking round it,
and whether +0.44 ms in that framing is worth it at high (else K 2 there).
