# Renderer v3 — measurements + design (2026-08-10)

Published page: (a private page) (self-contained copy: docs/internal/renderer-v3.html).

## Measured (M4 Max, Chrome/Metal dpr 2, main @ 1af5479, serialized-frame protocol, baselines within 0.3 ms)
- Preset × view compute Σ (ms): ultra 21.7–28.8 (2133×1200; a fictional 7.6 ms 'particles' slot removed — fixed c81d775) · high 13.7–18.7 (1777×1000)
  · medium 11.1–16.9 (1600×900). Views: cubicles / corridor / lobby / lot / break room. 37 active lights.
- High cost model (resolution sweep): Σ ≈ 3.4 ms + 8.5 ms/Mpx — direct 0.6+4.4/Mpx, softblur 2.0/Mpx, gather 0.3+1.5/Mpx, vol 0.16+0.4/Mpx, cascades ≈2.0
  fixed, probe 0.3. renderScale 1.0/0.85/0.7 rendered the same 1777×1000 (HiDPI internal-height cap → the top ~45 % of the slider is dead).
- Dynamics (high, cubicles): static 18.1 σ0.22 · ORBIT 19.0 σ1.75 worst 28.9 (rc bursts to 9.5) · pan 18.4 σ0.88 · three torches sweeping 18.65 σ0.77
  (softblur FLAT 3.49, direct +0.4, cards +0.2) · torches dark 17.7 σ0.19 · any settings/scale change → next frame 23–25 ms (+6, invalidate + re-bake).
- Direct vs active lights (groups off cumulatively): 37→7.84 · 35→6.68 · 30→5.32 · 29→5.22 · 27→5.01 · 26→4.61 · 25→5.04 ≈ 0.27 ms/light at 1.78 Mpx.
- CPU main thread (searching men): game.update 4.5 · engine.render encode 2.1 · world.upload 1.05 ≈ 8 ms/frame; headless game logic ≈ 1 ms.
- The 7.5 ms softblur in the maintainer's session coincided with a background pane tab of mine rendering rain on the same GPU — contention, not torches.

## v3 in one paragraph
Keep the analytic grid tracer, rasterised G-buffer, radiance-cascade cache, volumetrics, post. Replace direct's leader/tail heuristic with ReSTIR DI (fixed
rays/pixel regardless of light count), replace the three bespoke denoisers with one SVGF/ReLAX-class core (shadow/diffuse/specular clients), put TAA upscaling
in front of the display, amortize every cache (no bursts), keep histories across resizes/setting flips (no +6 ms frames), one principled BRDF at all hit types.
Budget at high: 14.5 ms compute @ 1600×900 (raster 0.5 · ReSTIR DI 3 · denoise 2 · gather 2.5 · cascades 1.5 amortized · reflections 1.5 · vol 1 · probe 0.3 ·
composite+bloom+AgX+TAAU 1.5 · headroom 0.7). Phases: 0 budget discipline + swing fixes → 1 TAAU → 2 ReSTIR DI (exp/restir-di) → 3 shared denoiser →
4 materials/detail → 5 ultra-only ReSTIR GI. Each A/B-able against today.

## Rev 2 (same day, after four F9 field recordings — ultra / high / medium / verylow, 103–235 s, GPU-bound, no contention)
- Field Σ compute mean · σ · p95 · worst: ultra 31.2 · 7.6 · 46.2 · 74 (1959×1200 ×0.70, 33 fps mean / 22 p5) · high 19.3 · 4.1 · 26.4 · 57 (54 / 40) ·
  medium 16.9 · 3.8 · 25.2 · 38 (67 / 43) · verylow 9.7 · 2.9 · 15.4 · 24 (107 / 69).
- VOLUMETRICS is the field's #1 variance source at every preset (median 2–2.6, p95 6–9, worst 13–34) — my calm synthetic scenes modelled it at
  0.16 + 0.4/Mpx; every worst frame is direct + volumetrics in loud moments (6 lit weapon lights, rain, 8 smoke domains). Direct worst 15–32.
  Cascade sums burst 7–13 in three sessions. Particle bursts 9–11 in single frames. Smoke sim ≈ 2.3 with 8 domains live.
- The ladder announced 63 cuts on ultra and made 0: the afternoon retune's trailing // comment had swallowed the renderScale assignment.
  Fixed 6e8a6bd + quality-plan check (D). Also fixed while measuring: c81d775 (phantom particles timestamp slot on ultra), 68e3453 (dormant passes in the HUD).
- Plan re-weighted: Phase 0 gains a volumetrics stop-gap (k strongest lights per step, transmittance early-out, adaptive steps) + particle birth cap;
  new Phase 2b = froxel volumetrics (capped per-froxel light list, temporal 3D history) beside 2a ReSTIR DI; budgets restated at p95 under the stress
  recording: 15.5 ms @ 1600×900 high (direct 3 · vol 1.2 · denoise 2 · gather 2.5 · cascades 1.5 · reflections 1.5 · smoke+particles 1.5 · probe 0.3 ·
  post/TAAU 1.5 · raster 0.5). Exit test of every phase = repeat the recordings.

## Phase 0 · P0-C results (2026-08-10 night, branch v3/p0c) — volumetric / particle / smoke worst-case caps
Instrument: `tools/qa/stress-scene.js` (`__stress.setup({fight})` stages QRF deployed (ETA 15 s) + weapon lights + rain 0.55 + two canisters at (24, 16) + a 0.6°/frame
orbit at dist 20; `fight=true` = TORTURE: the shift alerted onto a god-mode Sam so all seven men converge and shoot for the whole take — ~3× the field's load,
8 smoke domains continuously; `fight=false` = the GATE take as specified, Sam invisible), `__stress.ab(capsOff, capsOn, 6 blocks × 100 serialized frames,
ABBA order)`, `tools/qa/stress-report.ts` (drops frames a fixed-cost pass proves another GPU client shared). Dumps: docs/perf/p0c-ab-<preset>-<take>.json.
Where volumetrics' time went (high, torture, hot-swapped shader variants, same frozen frame): with 8 domains + 7 torches the OLD pass was 28 ms = smoke
march ~20 (per lit step it scored EVERY light — the 16-entry shortlist overflowed into 'all 44' — and marched the hull of all domains at the finest voxel any
had: 3.3 cm through canister smoke whenever a gun-smoke domain was crossed) + beams ~8 (of which shadow rays 4.3, smoke transmittance 1.4, evalLight/hazeAt
the rest; steps 20 → 10 only −1.7) + rain ≈ 0. In the capped path at K 4: march 6.3 (evals 1.1, K shadow rays 1.8 → 0.9 with alternate-step reuse, self-
shadow 0.8 → 0.3 masked, ambient ray 1.2 → 0.85 cached), beams ~5.5, base (density stepping, intervals) ~1.
Shipped (all under settings.volLightCap = K > 0; K = 0 is the old pass bit for bit — 200-frame deterministic capture of the corridor+torch scene: old / new K0 /
new K4 final frames md5-identical): per-domain ray stretches front to back at each domain's own step (never finer than 3 texels across at that distance,
≤ 160 steps a ray), per-stretch shortlist with exact culls (range · 0.03 floor · cone · panel facing) sorted by unshadowed bound, first K reaching the step get
shadow ray + self-shadow (refreshed every volShadowEvery = 2 steps), exact masked density / transmittance / self-shadow samplers, ambient wall test cached per
dice cell, T < 0.03 ends the ray and skips beams / rain behind it; beams: the K largest unshadowed in-scatter per ray, sharing 1.5 × volSteps by score, smoke
transmittance only when a live domain is near the light∪stretch box. Particles: births/frame capped (512/384/256/192/128) with a carrying queue (long-lived
kinds first once anything waits, oversize records born alone, starved spark records rescued after 2 frames, stale ones shed after 6). Smoke: fullRateDomains
(8/6/4/3/2) nearest the look-at step every frame, the rest alternate (staggered, catch-up dt from a second SimParams copy, pushes held for the step).
Measured, caps OFF → ON, mean / p95 / max ms (M4 Max, serialized frames):
- volumetrics TORTURE: ultra 25.8/46.4/58.1 → 21.6/35.1/50.3 · high 26.4/42.7/60.0 → 11.9/19.0/22.3 · medium 20.4/34.1/47.9 → 6.1/9.7/13.8 ·
  low 19.5/33.0/48.5 → 4.9/7.5/9.3 · verylow 18.8/29.2/43.7 → 4.5/7.2/9.2. GATE: ultra 5.6/7.6/8.4 → 5.0/6.2/7.7 · high 4.5/5.8/7.3 → 3.0/4.0/4.9 ·
  medium 3.0/4.1/5.1 → 1.35/1.8/2.0 · low 3.0/4.1/4.7 → 0.9/1.1/1.3 · verylow 3.1/4.3/4.7 → 0.85/1.05/1.6.
- Σ compute p95 TORTURE: ultra −6 % · high −24 % · medium −40 % · low −46 % · verylow −50 %; GATE: 0 / −9 / −8 / −15 / −23 % (direct + gather own the rest).
- smoke sim TORTURE mean: high 2.9 → 2.7 (6 of 8 full) · medium 3.2 → 2.4 · low 2.8 → 2.1 · verylow 2.8 → 1.9. Particles never over 0.7 ms serialized, even
  six stun charges in one frame (1260 births) = 0.13 ms: the field's single-frame 6–9 ms 'particles' were the unserialized timer absorbing an idle bubble
  (tiny alive counts, post/fxaa shrinking by the same amount on those frames) — the birth cap is insurance + spreading, not a fix of real work.
- Targets at high in the GATE take: vol p95 ≤ 2× median OK (4.0 vs 5.8), vol worst ≤ 6 OK (4.85), particles worst ≤ 3 OK; Σ p95 −30 % NOT met (−9 %:
  volumetrics is 3 of 24 ms there). In the TORTURE take high's vol worst is 22 (was 60).
Look: calm scenes bit-identical (above); high K 4 vs old in the torture frame within the render-to-render noise elsewhere and slightly streakier inside a torch-
lit plume (docs/shots/p0c/); verylow/low (K 2, step 2.0) visibly dimmer smoke where 3+ torches light it, and step ≥ 2.0 combs a plume's shadow edge (kept to
low/verylow). Caveats: per-pass MAX of the frame's first passes (smoke, direct) carries a clock-ramp confound on light frames (identical dispatch counts at 4× the
time); other lanes' tabs share the GPU — the report tool drops the frames it can prove. Left for 2b (froxels): beams are still pixels × beams × steps × shadow
rays (5–6 ms of high's 12 in torture; halving beam shadow rays = −2 ms at the price of softer cuts), the march is still per pixel-ray; a froxel grid with per-
froxel light lists + temporal reprojection replaces both, and its tiers are grid res / lights per froxel / history.
