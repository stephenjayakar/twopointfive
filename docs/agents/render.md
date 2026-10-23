# Renderer

One of the area files CLAUDE.md indexes. Everything below was moved here word for word from CLAUDE.md on 2026-10-13, in its old order;
"the bullet above / below" in a bullet means its neighbour there (each block says which lines it was), and a bullet named by its bold
title may now live in another file of this folder: `grep -l '<title>' docs/agents/*.md`. New bullets for this area go at the foot of this file.

<!-- was CLAUDE.md lines 470–505 -->
## Judging renderer output

Whole-frame captures downscaled into a chat hide exactly the defects that matter (penumbra stipple, ragged
iso-contours at a spot edge, probe-sized blotches, sparkle near small emitters, discs around dim lights). Crop
200–400 px tiles around shadow edges / light-pool boundaries / emitters, upscale 3–4×, compare before/after tiles,
and look at the debug views (`engine.settings.debugView`: direct-only, indirect-only) as well as the composite.
`sips -c H W --cropOffset Y X` + `sips -Z` does it on macOS. For "lossless" claims use the pixel A/B harness:
`?paused` boot, identical stepping, `__png` both variants, diff (max/mean/>2/>8 counts) against a same-variant
noise floor captured the same way; when A/B-ing smoke shading freeze the field with `smoke.params.frozen = true` (holds
the field AND still renders it — `enabled=false` renders no smoke at all, so any smoke A/B passes vacuously).
Determinism checklist for captures (learned the hard way): zero every character's `anim.phase` (it is seeded with
`Math.random()`; the idle / breathing / weight-shift clocks are desynced from the character id — deterministic, leave them), park the guards AND their torches somewhere they light nothing (or disable the torches), seed
`Math.random` if emitters are involved, never let the rAF loop run between boot and capture (`?paused` + a
screenshot to give the pane a size, then only `__runFrames`), and for views with MEN ON SCREEN call `game.restartEncounter()` right
after seeding `Math.random` and before staging (the guards' construction-time dice — glance clocks, waits — were drawn unseeded at boot,
and a staged man's head otherwise sits differently boot to boot). With that, two boots are bit-identical in every view;
`tools/qa/rig-identity.js` (`__idrun`) is the recipe end to end (corridor / lobby / cubicles stills with 2–4 men, hashable across boots at every preset).
**ONE CONFIG PER FRESH BOOT** for every identity pass and every look A/B (learned again on the smoke lab): two stagings inside one page never compare — the cubicles'
flickering fixtures, the haze clock, the TAAU phase, the storm and the wind all key on the game / render clocks and the frame index, which the first run has advanced by
the time the second starts — so navigate afresh (`?paused`), run the SAME call sequence from boot for each build / setting (cross-build claims: main served BESIDE the lane on
its own port, both driven identically) and compare the hashes / PNGs left on the sink by name (`__rf.identity / pngs`, `__idrun` are that shape).
Numbers and hashes recorded before 08-12 reproduce only with that day's new defaults off (`?nogatherstrata&nomotioncalm`, and `?noiq` for anything from before the image-quality
program); harnesses that hash against main served beside stay valid, since both sides boot the same defaults.

## GPU timing — known traps

`engine.timer` timestamps are per pass. **Render-pass** timestamps (gbuffer/composite/post/fxaa) on Metal span the
wait for the drawable and read ≈ one frame — ignore them (the HUD lists compute passes only). Scripted
`__runFrames` stepping returns stale timer values UNLESS each frame is followed by `await device.queue.onSubmittedWorkDone()`
+ a MessageChannel yield: that serializes frames (no cross-frame overlap inflating passes) and lets the readbacks resolve
even with the pane hidden — two 30-frame baselines then agree to ~0.02 ms and match the live HUD (this is how the trade-off
options were timed). Without it, hidden-pane numbers are garbage. Interleave A/B/A/B either way. Reference numbers (M4 Max, high, calm office, renderer v3): ≈ 10–11 ms union at 1368×770 with the
08-12 defaults (sharp direct + GBAA, motion-calm, gatherStrata, near mesh shadows at high — docs/internal/trace-perf.md §0 / render-defects-0812.md carry those takes; ≈ 8–10 ms before them) — see docs/perf/v3-gate-phase4.json and
docs/internal/p2a-restir.md for per-pass tables (the pre-v3 frame was ~20 ms: direct ≈7, softblur ≈3, gather ≈6, cascades ≈2, volumetrics ≈1). **The GPU is SHARED with every other lane's page** (and the
maintainer's own tab): a take that overlaps someone else's measurement is worthless — `sh tools/qa/gpu-quiet.sh` waits for `ioreg` Device Utilization to sit under 8 % before a take, rounds are
interleaved and filtered to their quiet minimum, and a row whose p75 sits far above its median is quoted as contended, never as a result.

<!-- was CLAUDE.md lines 2403–2406 -->
- **Markings = object legibility** — palette-indexed bitmaps on box faces, packed in the tail of `boxMat` (no texture); `settings.markings` default ON, `?nomarkings` (+ `?level=relief` = main's frame), `__mark`; emissive markings are LIGHTS; the art rules (flat colour per cell, ≤ 3 entries, no gradients, no baked lighting) — the full bullet moved word for word to `docs/internal/claude-md-renderer-systems.md`.
- **Materials, RT reflections, the detail layer** (renderer v3 phase 4) — every box carries a finish (`Box.rough / metal / aniso`), `reflect.wgsl` traces under `settings.rtReflect` (`?nortreflect`, `frame.rtCfg.w` 0 = off), the detail layer under `settings.detail` (`?detail=0‥1`; art rule: variation from geometry, never a painted texture); `__rt`, `__hotReflect` — the full bullet moved word for word to `docs/internal/claude-md-renderer-systems.md`.
- **The ultra-only extras** (renderer v3 phase 5) — `settings.giResample` / `rtMeshHits` / `rtHitReuse`, only the ultra preset raises them, `?nop5` vetoes; `__gi`, `__hotGather`; TRAP kept here: `reflect_p5.wgsl` is a separate program from `reflect.wgsl` on purpose (main's text) — keep the two files in step — the full bullet moved word for word to `docs/internal/claude-md-renderer-systems.md`.
- **Character proxies = the SDF character rig** — every mannequin's 15 shadow / reflection proxies are round cones fitted at load (`render/sdfrig.ts`, `shaders/sdfrig.wgsl`), no switch; extras in `frame.rigCfg` (`settings.charSelfShadow` default ON, `?noselfshadow`; `?sdfsmooth` / `?charsoft` / `?charsoftmarch` experiments); `__sdfrig`, `__rigTrace` — the full bullet moved word for word to `docs/internal/claude-md-renderer-systems.md`.

<!-- was CLAUDE.md lines 2658–2728 -->
- **Effects numbers** are tuned by the user in the viewer and pasted back; treat `effects.ts` / `RIG` values as
  authored data — change them only from viewer readouts or explicit notes. (`effects.ts tracerFx` — tracer speed / shutter /
  thickness / emissive / head-light intensity + range / ember / pool caps — ships UNTUNED: viewer Guard ▸ carbine: tracers (K),
  or Tab ▸ Effects ▸ tracer rows in the corridor at night, then paste back.)
- **No dollhouse wall cutaway** in the game — it was removed by user decision (they rotate the camera instead — Ctrl + mouse orbits and Ctrl + wheel zooms now, host/loop.ts; Q / E are the wall hold and the holster);
  don't bring it back. The `Cutaway` box flag + `cutHeight` primitive survives only for the viewer stage's back wall.
  Debug/sandbox actions are debugger (tweak panel) buttons, not hotkeys.
- **Quality**: `ui/quality.ts` presets (ultra / high / medium / low / verylow) set resolution scale + internal-height cap, beam steps,
  cache grid, smoke iterations, the direct-light ray budget (8/4/3 · 8/4/3 · 6/3/3 · 4/2/2 · 1/1/2), `directHistory` (0.5; high and verylow 0.7)
  AND the lossy trade-offs below (ultra none · high checker + third-res gather + dimRays · medium/low/verylow those + quarter-res beams, with
  staggered cascade refresh `rcPeriods` in place of `rcHalfRate`; low/verylow with `dimRaysBelow` 0.02) AND the final gather's relative firefly bound `settings.giFireflyK` (4 on high‥verylow; 0 = off on ultra:
  the bound is a one-sided clamp — it cut the boil round a torch on a wall by ~40 % but costs up to a quarter of the bounce within ~0.6 m
  of an intense hotspot — so the reference preset runs without it; Tab ▸ Indirect light slider for A/B) — applying a preset writes those
  settings exactly as the menu rows do; a row flipped by hand sticks until the next preset change. `auto` first CALIBRATES behind the start card (a couple of seconds of GPU compute-pass timings → a per-pass
  cost model, `COST`/`REF`/`FACTOR` in quality.ts: per-pixel and fixed factors per preset → preset AND scale in one step, remembered
  per machine; ladder verylow‥high, never ultra; 'auto' picked later on the pause card / Tab runs the SAME path — `Quality.startAuto`:
  from this machine's remembered pick + scale, re-measured behind that card, the card's note refreshed when it settles), then a runtime ladder trims (proportional scale steps toward LADDER.aimFps 50, cut below 45 / restore above 58, ≥ 2 s apart on a 0.05 grid, preset drop
  once a real cut is off, floor SCALE_FLOOR 0.5). THOSE ARE THE 'AS NOW' BANDS: since 10-10 the ladder's default is HOLD 60 (`settings.ladderAim` 60, the maintainer's pick; `?aim=asnow` or `?aim=0` = the bands above for the visit, `?aim=90|120|display` other targets, Tab ▸ Frame ▸ 'ladder: frame rate to hold'; `ui/quality.ts HOLD / ladderBands`): the same climb, but two 1-s windows under ~58 fps with the GPU the limit cut the scale straight to what the cost model says holds 60 (to the floor, then the preset under auto), and pixels come back on measured GPU room; a page something else paces is left alone (as now: `settings.ladderPaced`, `?ladderpaced=0`; under an aim, since 10-14: `settings.ladderHeld`, default on, `?ladderheld=0` or Tab ▸ Frame ▸ 'ladder: an aim leaves a held page alone' = an aim as it was. The maintainer's Mac on a low battery, 10-14: the browser held the page at 30 fps, the GPU clocked down and read ~1.5× longer, and hold 60 stepped High from 770 to 600 rows for a rate that stayed 30. What cut it (read off the code and the replay, not the budget rule first blamed): the union at High's start read 13.9 ms on the slow clock, over the 13.33 ms back-off band, so the `hot` rule took a step every two windows, and the strict restore (the next step priced under 12.0 ms) never gave one back. On, the as-now paced check runs under an aim too: (a) a slow window is PROVEN paced when the union fits the aim's frame less HOLD.pacedMs (10.67 ms at 60) and the frame is more than those 6 ms over it; (b) slow, not GPU-bound, not proven, no pace known: over the back-off band the band's own step goes first as ever (and is judged like any cut); inside it, a judged cut to the highest scale the cost model prices under that floor (none where the scale floor cannot reach it: a small window, a union far over; a step further if it lands short). Proven there, the frame decides: no shorter = the pixels straight back to where the chain began, the failed-rung marks it left restored, that rate remembered as the page's pace; shorter by PACED.probeGain (15 %: a missed vsync bought back is a whole refresh, less is the rate's own wobble) = the cut stays and the level it left is a failed rung; no step up while a cut waits for its verdict; (c) a cut that proves nothing by the end of its 12 s trial goes back to where it started with no pace learnt, the next held off 60 s, doubling; after a judged take-back the next cut comes no sooner than the re-test would; (d) at the pace: no cut for the union's size, no `hot` step, no preset starved, and a scale under the tier's start comes back a grid step at a time on the frame's own room, each step judged (the frame grew = the step off and the pace forgotten); (e) the pace is dropped for a re-test after PACED.recheckSecs (120 s, doubling), which is those same judged cuts again (about 10 s under the tier's start). Check: `ladder-replay.ts --selftest`, the 'page something else holds' block (sixteen cases: held five minutes, the hold lifting, arriving cut, a fight on a held page, a fixed 60 Hz display missing vsync under and over the band, real load, the re-test, the marks, four never-held machines with other overheads, auto, a cut that tells nothing, a machine the cost model is wrong about, the failed rung after a cut that helped, a CPU-bound frame that wobbles, nothing holding); `LADDERHELD_BREAK=1` in front must FAIL eight of its lines (exit 1). Measured 10-14, headless only, after two reviews (the second found a never-held fixed 60 Hz machine left 25 % short of pixels, a cut / step up / cut loop where the model is wrong, a sawtooth after a cut that helped, and cuts repeating on a wobbling rate: all four mended and now cases above): off = the tree before it move for move (600 fuzz machines, as now either way and an aim with it off, four sets: no outside holds / real ones × overhead inside 6 ms / up to 9); on, machines nothing ever held spend the same seconds under 58 fps with overhead inside 6 ms (within 0.1 s of 400) and fewer past it (a fixed display: 116 → 105 of 400, the judged cut finds a missed vsync the old rule let be); with holds coming and going, about 0.5 s more per machine under 58 fps outside the held spells, fixed 60 Hz +4.6 s of 197 (the limit below). 84 steadily held machines whose GPU time follows the pixels more or less than the model says: 26 keep more pixels, 50 the same, 8 lose under 0.015 of mean scale (the trial dips). His take 5 replayed (`--aim 60 --sweeps`, a sweep take, so read the rows only): mean 573 rows off, 730 on. His two F9 takes: identical moves off and on. The real page on the software adapter at his window size, fed held windows through its own ladder (`Quality.simulate`): ×0.75 at 3 s, ×0.70 at 6 s, ×0.55 at 9 s, ×0.77 again at 12 s and for the rest of two minutes; `?ladderheld=0` ends ×0.70. KNOWN LIMITS: a fight that starts on a held page before its pace is known, or a re-test inside one, is cut as before until it is over (the floor cannot bring 23 ms under 10.7); where the model says the scale floor cannot reach the proof's floor, nothing changes; a hold lifting mid-fight on a fixed 60 Hz display, with no fast second between, waits for the re-test; a hold that lifts and comes back inside the hold-off sits at ×0.70 as before until the next judged cut; a frame rate that wobbles 15 % a second by itself can read as a cut that helped (one step under the tier's start then stays held off); everything rests on HOLD.pacedMs = 6 as the frame's overhead past the union. The replay tool's own held-frame test (`heldOut`) stays apart from `holdProof` on purpose: it re-prices a RECORDED frame and knows the take's display rate, which the ladder does not. Never seen on a GPU or a held browser). `bun run tools/qa/ladder-replay.ts --selftest | <F9 take> --check | --aim 60` = the ladder replayed headless over a recording; quality-plan.ts's ladder checks pin as-now. Since 08-12 the ladder also CLIMBS on measured headroom (`settings.ladderClimb`, default on; `capClimb` off): union-driven,
  0.05 a rung up to ×0.95 (1.0 would drop sharp direct), then gather ⅓ → ½ and beams ¼ → ½, backing off newest-first with doubling holds; 'cruising' is judged from
  the GPU union priced at the next preset by the cost model (`Quality.hopRatio`), no longer from an fps threshold a 60 Hz display could never reach; `?quality=` holds
  the climb off. `?nomotioncalm` puts off what is now (08-12, the maintainer's call) the DEFAULT: Tab ▸ Frame / `__gimo.calm()` = the gi-motion lane's bundle (restirSpatialAll + restirPenRays + taauMotionAlpha 0.25 +
  taauSharpenMotion 0.15) that calms the DIRECT chain under camera motion at the price of contact-shadow softness — the maintainer's call (docs/internal/gi-motion.md). Since 08-11 `renderScale` is RELATIVE TO THE CAP: internal h = min(maxInternalHeight, cssH·dpr) × renderScale, so 1.0 =
  the preset's rows on any window tall enough and every step below it is real (`capScale`, `effectiveScale` = the true internal/css·dpr ratio for the cost model); render
  targets are pooled and temporal histories RESAMPLED across size changes (render/texpool.ts, `settings.keepHistories`), cascade instances parked per grid (`engine.rebuildRc` /
  `prewarmRc`). GPU cost: read the timer's UNION (`engine.timer.unionMs()`, HUD 'gpu ∪', recorder `gpuUnion`) — per-pass sums over-state a saturated frame by 35–55 %
  because independent compute passes overlap (docs/internal/p0a-cascades.md). `plan(gpuMs, fixedMs, preset, eff, cssH, dpr)` is the pure decision (exported; also
  `__quality.plan`); `bun run tools/qa/quality-plan.ts` prints the cost table and plan()'s picks for synthetic machines (M4 Max →
  high ×1.0, M1-class HiDPI → verylow, …) — re-run it after correcting REF/FACTOR from measured pass timings. Under automation set
  `window.__testVisible = true` or calibration/sampling wait forever on the hidden pane.
- **One cache grid at every preset** (10-23; `settings.oneCacheGrid`, on in the page and the workbench, `?onegrid=0` puts it off; no Tab row). WHY: the light meter the
  guards and teammates see by (`probe.wgsl`) is the shadowed direct light plus the cache's dice read trilinearly at the asked point, so the probe lattice is part of the
  reading. low and verylow ran a coarser lattice (32 × 3 × 22 against 40 × 4 × 28) and read tight night shadow two to three times darker: sneaking was easier on the low
  presets, and the auto ladder moved the rule under a mission whenever it stepped between medium and low. WHAT: every preset's `rc` row is the one grid; low and verylow
  keep the old one as `rcCoarse`, and `rcGridOf(preset, one)` is the only reader (the preset put on, the grids parked at boot, the cost model: `presetCost(p, oneGrid)`,
  `costTable`, `plan(…, oneGrid)`), so off = the grids AND the ladder's prices as they were. With it on no preset step rebuilds or swaps the cache, and nothing is parked
  at boot. No `FROZEN_HOLDS` row and no journal line: nothing in a step reads it (the meter reaches the game through `Game.sensors`, and the headless stand-in has no cache).
  MEASURED on the software adapter (the pair mission at night, the meter asked at 11 fixed points at 0.8 m and 1.5 m, ten drawn frames, one run each; E, then the HUD's
  LIGHT): in the gap between the containers verylow 0.015 / 0.018 (LIGHT 0) on the coarse grid, 0.046 / 0.057 (13) on the one grid, high 0.049 / 0.063 (15); behind the
  low wall at 0.8 m 0.045 → 0.103 against high's 0.113; the road in shadow LIGHT 0 → 9 (high 9); the partner's start 0 → 6 (high 7); points in the moon 46 to 48 on all
  three. What is left between verylow and high is under 10 % at nine of the eleven points and 14 % at a tenth (0.017 against 0.020), verylow mostly the lower: its far
  field refreshes over more frames and ten had not settled it (inferred). The eleventh sits beside a standing man at 0.8 m: 0.117 on both verylow grids, 0.052 on high. Not the cache: `occluded()` tests a character's skinned mesh where the preset has mesh shadows (ultra, high near) and his
  capsules elsewhere, so the meter's direct light in a man's own shadow is still the preset's (read in the code, one point; the meter's owner's, not mended).
  NOT MENDED: the read itself. One lattice makes the presets agree; it does not make the meter right — it still blends the cells around the asked point, some of them
  inside the wall or the container beside it (the bullet on BOUNCE WALLS says the same of a lit room's wall). A read of the meter's own (its own short fan of rays from the
  asked point, the cache only at their hits) would take the lattice out of the reading at every preset and cost a few thousand rays a frame, but it moves every LIGHT
  number the levels were tuned on. PRICE: low and verylow trace 2.1 × the probes at their own refresh periods; in the cost model their fixed part goes 1.9 → 2.4 and
  1.4 → 1.9 model-ms (`quality-plan.ts`: an M1 / M2-base-class machine, 4.5 × the reference, boots at verylow ×0.50 where it had low ×0.50; a 5.5 × one no longer fits
  the budget at the floor), about +0.2 ms a frame on the reference machine by the cache's measured 1.05 ms at high and the level shares. NEVER TIMED ON A GPU, and never
  seen on one: what low and verylow look like on the finer cache is not known. CHECK: `bun run tools/qa/probes.ts ladder` (family `perf`; the ladder's self-test, which
  now runs the page's grid, with five lines of this rule; `ONEGRID_BREAK=1` fails four; both stands). `rfix-proofs.ts r101` (the parked-grid hop) boots with `&onegrid=0`
  so it still crosses grids; that edit was not run. Page tools that pin `?quality=verylow` on the software adapter now trace the finer cache too.
- **One smoke pressure solve at every preset** (10-23; `settings.oneSmokeSolve`, on in the page and the workbench, `?onesolve=0` = each preset's own `rbIters` as it was:
  ultra 5, high 4, medium, low and verylow 3; no Tab row beside the solver's own 'pressure: rb pairs' slider; render-side, so no game table, no journal line, no
  `FROZEN_HOLDS` row: the headless stands solve no smoke on a GPU). WHY: a sight line through smoke (`game/sensors.ts` → `probe.wgsl` kind 1) is the optical depth of the
  SOLVER's density, and the pressure pairs decide how a plume rolls and spreads. With the pairs a preset row, the cloud that hides a man had another shape at medium than at
  high, and the auto ladder changed it under a fight each time it stepped: a game rule reading the graphics setting, as the meter's cache grid was. Every preset now runs high's
  4 (`rbItersOf(preset, one)` in ui/quality.ts, asked where a preset is applied). PRICE, by reading only: one pair more (two dispatches over the live bricks) a solver step
  on medium, low and verylow, one fewer on ultra; the cost model does not price the solver, so the ladder's price for a step down no longer includes a cheaper solve. The one figure on record is the old
  box solver's on the maintainer's own machine: 0.044 ms a pair a domain (`docs/internal/smoke-perf.md` §1b). NOT MEASURED: how far a plume's shape moved between 3, 4 and 5 pairs, so how much
  sight ever differed; and the cost. NOT MADE ONE by this: the density a sight line reads is still the page's solver, and the headless stand-in is another model
  (`docs/agents/replays.md`). CHECK: `bun run tools/qa/probes.ts ladder`, three lines (`ONESOLVE_BREAK=1` fails one), both stands. PAGE (the software adapter, the final code, `?paused&quality=medium&mute`):
  booted with 4 pairs at medium; low, verylow and medium applied in turn each left 4; with the setting put off and the same three applied, 3 each; back on, 4; a canister solved
  six frames at `stats.rbPairs` 4 with no GPU or page error. The `?onesolve=0` word itself was not opened on a page (one line beside `?onegrid=0`, read before the first
  preset). Never timed or seen on a GPU.
- **The smoke keeps high's look down the ladder** (10-23; `settings.smokeKeep` 0 | 1 | 2, 1 in the page and the workbench, `?smokekeep=0|1|2`, Tab ▸ Frame 'smoke under
  high'). The maintainer, with auto on medium: "a ton of the smoke became very blocky … the smoke looks so sick in our game that i'd rather we keep it closer to high but
  then tradeoff other things in the frame budget". WHAT WAS BLOCKY: under high the march ran at quarter size (`lossy.volQuarter`: one march texel under 4 × 4 internal
  pixels; high's half-size march has 2 × 2), lit by fewer lights a step (medium 3 / 2, low and verylow 2 / 0 = `caps.volK` / `caps.marchLights`, high 4 / 3) and on low and
  verylow with a 2.0 step that combs a plume's shadow edges. WHAT 1 DOES: on medium and low the smoke's rows are the better of the rung's own and high's (`withSmoke(preset, keep)`
  in quality.ts: the march at half size, high's lights a step, shadow refresh and step length), on the preset's OWN path — the froxel haze stays, beams are not the smoke —
  and everything else the rung sheds is still shed (rays, reflections, mesh shadows, bounce cards, denoiser passes, the cache's refresh, the pixel count). The ladder pays
  the difference where it always does first: in render scale. 2 = high's whole volumetric path as well (`caps.vol` 'classic': the per-pixel march for haze AND smoke,
  high's 20 beam steps): the smoke exactly as high draws it at the rung's pixel count, there so the two can be compared by eye. 0 = every preset's own rows, as it was.
  verylow keeps its own smoke at every value (`smokeOwn` on its row): it is the floor, with no rung beneath it to pay, so the smoke is the LAST thing the ladder sheds.
  The solver's iterations (`rbIters`) are not a look row and this switch does not move them: ONE SMOKE SOLVE, the bullet above. high and ultra are the same rows at 0, 1 and 2. With 1 or 2 on, the climb's
  'volumetrics ¼ → ½' rung has nothing to do above verylow, and the caps bullet's medium and low rows below are what 0 runs. `withSmoke` is the only
  reader (the rows put on, the live preset, `costTable(oneGrid, smokeKeep)`, `plan`), so 0 is the ladder as it was, prices included; `Quality.resmoke()` is the Tab row's
  by-hand step. No `FROZEN_HOLDS` row and no journal line: nothing in a step reads it (smoke SIGHT lines are the solver's density, not the march).
  WHAT IT COSTS — on the maintainer's Mac at high in a fight with one dust cloud live (the F8 sweep of 10-10, three rounds; that take's pass was beams and smoke on the
  classic path): the march at quarter size gave back 0.5 to 0.9 ms (0.4 in a calm view with no cloud), 2 lights a step where there were 4 gave 1.5 to 1.65, the froxel path
  1.5 to 1.85 — against 2.3 ms for render scale ×0.77 → ×0.60 and about 7.6 ms for all of medium. So at 1 a rung under high is dearer by roughly a millisecond at high's
  pixel count in a smoky fight (less at its own, about one 0.05 step of render scale on that Mac — INFERRED from those rows, not timed), and at 2 by about 1.5 more. The
  cost model only knows the calm still (medium's per-pixel part 13.3 → 13.5 → 14.0 model-ms at 0 · 1 · 2; no synthetic machine of `quality-plan.ts` changes its pick).
  OTHER THINGS A RUNG COULD GIVE UP INSTEAD, with that Mac's rows at high: the cache at half rate 0.9 ms, mesh shadows 0.8 (medium has none already), audit rays 0.5,
  direct light at 3 rays 0.26, held-light rays at 2 0.25 to 0.38; the reflections' passes read 3.2 ms but the frame moved 0.14. None is taken: by eye, the maintainer's.
  At 2 the model prices medium a shade UNDER 1 (it drops the froxel term and knows no fight): a setting for the eye, not for auto's arithmetic.
  NEVER TIMED OR SEEN ON A GPU. CHECK: `bun run tools/qa/probes.ts ladder` (family `perf`; nine lines of this rule in the ladder's self-test; `SMOKEKEEP_BREAK=1` fails
  two; both stands).
- **Worst-case caps (renderer v3 Phase 0)** — the loud minute (QRF weapon lights + rain + a floor full of smoke + a firefight's particles) bounded with no look change
  at rest; every tier runs the same capped paths, scaled by `PRESETS[*].caps` in quality.ts (ultra 6/2/1.5 · 512, high 4/2/1.5 · 384 — both on the CLASSIC per-pixel path since 08-12, `Caps.vol` —, medium 3/2/1.5 · 256,
  low 2/2/2.0 · 192, verylow 2/2/2.0 · 128 = volK/volEvery/volStep · births): (1) `settings.volLightCap` K (`frame.volCfg.x`; **0 = the volumetric
  pass bit for bit as it was**, proven on the vol texture) — volumetrics.wgsl marches each of the smoke's BOUNDS' own stretch of the ray front to back at that lattice's step (its comments still say 'domain')
  (merged where they overlap) instead of the hull of all of them at the finest voxel, builds a per-stretch shortlist (exact culls: range, the 0.03 floor, cone, panel
  facing; ≤ 16 sorted by unshadowed bound — never 'every light'), gives a shadow ray + self-shadow to the first K lights that reach each step (refreshed every
  `volShadowEvery` steps = `volCfg.y`, reused between; march step `volStepVoxels` = `volCfg.z` tenths — 2.0+ combs shadow edges in a plume, low/verylow only), caches the
  ambient's wall test per dice cell; haze beams keep the K strongest per ray by unshadowed in-scatter (64-bit mask; kind-2 always). Tab ▸ Direct light ▸ CAP rows.
  (2) `settings.particleBirths` → `Particles.prepare(dt, on, cap)`: births a frame; records that do not fit WAIT in the queue (long-lived kinds first once anything
  waits, arrival order untouched otherwise; an oversize record is born alone; a spark record shed after `SPARK_MAX_WAIT` 6 frames; queue ≤ `MAX_QUEUE` 512) —
  `probes.ts particles-queue` holds the defer contract. (3) the smoke solver's cap is no longer a preset's: which bricks step is the pool's own rule on every tier (calm and far bricks wait: the smoke bullet); `Caps.smokeFull` /
  `fullRateDomains` went with the boxes. Measure with `tools/qa/stress-scene.js` (`await import('/qa/stress-scene.js')`
  → `__stress.setup()` / `.record(n)` / `.ab(applyA, applyB)` / `.caps(on)` / `.table(r)`, serialized frames, orbiting camera) and `__hotVol(src?)` (recompile
  volumetrics.wgsl from disk — the dev server serves src/render/shaders under /qa/shader/ — and swap the pipeline in without rebooting a staged scene).
- **Froxel volumetrics** (renderer v3 Phase 2b) — `settings.froxelVol` per tier (`quality.ts Caps.vol`: ultra / high 'classic', medium and below 'froxel'), `?nofroxel` / `?froxel` force either; `settings.smokeMarchLights`; `__froxel`, `__hotFroxel` — the full bullet moved word for word to `docs/internal/claude-md-renderer-systems.md`.
- **Lossy options** (engine settings, default OFF in `defaultSettings`, switched ON by the presets as above; pause menu *Graphics —
  trade-offs* + `LOSSY:` rows in the Tab panel for A/B): `settings.checkerDirect` (frame flag 65536: shadow rays on a checkerboard
  half per frame, direct.wgsl), `gatherThird` / `volQuarter` (gather at 1/3, volumetrics at 1/4 res: `passes.setDivisors`, divisors
  in `frame.lossyCfg.xy`), `rcHalfRate` (`rc.halfRate`: uppers even frames, c0 + bake odd), `dimRays` + `dimRaysBelow`
  (`frame.lossyCfg.z`: one emitter sample per leader under that unshadowed luminance). `engine.render` mirrors the booleans every
  frame, so they are the single source of truth. Off must stay the untouched path — A/B them one at a time (pin `?quality=ultra` AND set `settings.volLightCap = 0`
  — every preset, ultra included, carries the Phase 0 volumetric cap; `__stress.caps(false)` puts both caps back to the untouched paths).
- **ReSTIR DI = the direct-light estimator** (renderer v3 phase 2a) — `settings.restir` default ON, `?norestir` = direct.wgsl's leader / tail path; the hybrid held-light path `settings.heldRays`; the motion twin `settings.restirMotion`, `?norestirmotion`; `__hotRestir` / `__hotDirect`, debug views 11 / 12 — the full bullet moved word for word to `docs/internal/claude-md-renderer-systems.md`.
- **TAAU** (renderer v3 phase 1) — `settings.taau` default ON, `?notaau` = the old chain; `__taa`; RULE kept here: `frame.viewProj / invViewProj / prevViewProj` ARE the jittered matrices — never build a screen ray from `cam.*` on the GPU side — the full bullet moved word for word to `docs/internal/claude-md-renderer-systems.md`.
- **Sharp direct** (decoupled resolution) — `settings.sharpDirect`, switched on per tier by `quality.ts Preset.iq`, `?sharp` / `?nosharp` force it; live only under TAAU below scale 1.0; `__sharp` — the full bullet moved word for word to `docs/internal/claude-md-renderer-systems.md`.
- **The resolve configuration per tier** (image-quality program) — `quality.ts IqTier` on `Preset.iq` (sharp direct + decoupled jitter + GBAA + history de-blur), `?noiq` = the resolve as it was, `?gbaa`, `?nomv` (`settings.motionIds`); harness `__iq` — the full bullet moved word for word to `docs/internal/claude-md-renderer-systems.md`.
- **Stratified gather directions + the trace lab** (ported from exp/trace-perf; the notebook is docs/internal/trace-perf.md, the page docs/review/trace-perf.html): `settings.gatherStrata`
  (default ON since 08-12 — the maintainer liked it; `?nogatherstrata` = the iid gather, `__gs {on, summary()}`, Tab ▸ Indirect light ▸ 'EXP: stratified gather directions') draws the final gather's k-th ray of four from
  STRATUM (k + frame) mod 4 of the cosine hemisphere (fgather.wgsl `cosineDirK`: azimuth half × cos²θ half; mainGi's two fresh rays a Latin square over the same cells; the young-history
  extras a complete stratified set of their own) instead of iid — UNBIASED (tile means within ±0.5 %, temporal sd equal or lower) but a whole 8×8 tile's k-th rays share a quarter of direction
  space and walk the grid coherently: gather 2.03 → 1.70 ms at high 1368×770 (−16 %), −0.8 ms at ultra. passes.ts compiles the gather module TWICE behind a prepended `const GATHER_STRATA`
  (`pFG/pFGR` false = the module exactly as it was, `__png`-hash-identical to main; `pFGs/pFGRs` true) and the encode picks the pair each frame, so it flips live; NOT hash-identical when on
  (a different sample pattern). THE TRACE LAB (`tools/qa/trace-lab.js` → `__tl`, kernels `src/render/shaders/trace_lab.wgsl` served from disk, `tools/qa/gpu-quiet.sh`):
  `?trace=N` → `render/frame.ts traceConfig` → `const TRACE_VARIANT` at the head of the scene prelude (only 0 = today's walk exists on main — the branch's V1‥V8 / H1 traversal variants were
  negative results and were not merged; a new experiment adds `…V<N>` copies of occluded / occludedT / traceClosest + three thin `switch (TRACE_VARIANT)` dispatchers and the lab finds them);
  `__hotCommon` / `__scenePrelude` / `__traceConfig` / `__commonSource` / `__daylight` in main.ts, `rc.hotSwap`, `particles.hotSwapSim`; `__tl.scene('B1'‥'B5') / points / bench / exact /
  profile / ab / aa / idHash / matrix` = Mrays/s of one ray class through one query per variant, bit-exactness counters, the reference walk's per-ray counters, interleaved frame A/Bs.
  THE GATHER'S BOUNCE READ IS BOUNDED (08-12, docs/internal/render-defects-0812.md §3, rig `tools/qa/rd-scenes.js`): every secondary-hit cache read in fgather.wgsl goes through
  `lighting_common diceIrradianceFrom(Ph, n, P0, N0)` — one probe spacing off the hit face like any dice read, but never past the plane of the surface the ray LEFT (P0, N0), and no trilinear
  neighbour from behind that plane (they collapse to the home cell) — the fix for indirect light 'leaking' behind the manager's shelves (the cartons' backs 12 cm off the wall read the lit
  storage room next door: 26–50 → 5); a new bounce read at a hit takes the receiver's plane the same way, never the bare `diceIrradiance(Ph + n·1 m)`.
- **The denoiser** (renderer v3 phase 3) — `settings.denoiser` `'v3'` default | `'legacy'`, `?legacydenoise`; one core (`render/shaders/denoise.wgsl`), three clients (shadow / diffuse / specular); `__dn`, `__hotDenoise`, debug view 13 — the full bullet moved word for word to `docs/internal/claude-md-renderer-systems.md`.

<!-- was CLAUDE.md lines 2979–3015 -->
- **Smoke = one pool of bricks** (THE smoke solver since 2026-10-10, no switch; the maintainer on the eight 64³ boxes it replaced: "let's just remove the box smoke if this is the way we want to do it" · "we can always revive from
  git history" — the last commit with both solvers is 1530281c, the pool there behind `?sparsesmoke`; notebook docs/internal/sparse-smoke.md, page docs/review/sparse-smoke.html; the names `smoke.sparse`, `SPG_* / spg*`, sparse-lab.js are the prototype's, kept):
  `src/smoke/smoke.ts SmokeSystem` + `smoke.wgsl` + `smokeGrid.ts`: the boxes' solver step on ONE level-wide lattice per voxel size (fine 2.2 cm gun gas, coarse 5.5 cm cans and dust) cut into 8³-cell
  BRICKS that exist only where smoke is (+ `ring` cells of air), one pool of 4096 (`?smokepool=N`, 256‥8192, read once at boot; `?sparsesmoke=N` still reads as that, bare it does nothing), page table / free list / live list / 27-neighbour tables all made on the GPU, 17 + 2 × pairs dispatches a step whatever the
  plume count; every reader goes through `shaders/smoke_read.wgsl`, appended to the scene prelude (r32uint page texture at scene binding 14 + an rgba16float atlas of 10³ blocks at 8; binding 7 = `array<SmokeBound, 8>`, GPU-made; binding 11 is free; shadow rays + the probe walk bricks, the view
  marches walk ≤ 4 bounds per level). No domain count, no faces, no edge fade, nothing for game code to count (`stats.live` = the pool in 512-brick units for the recorder's column; no rule reads it); the limit is total VOLUME (soft ceiling from 60 % of the pool, sooner and harder far from the camera's focus: `viewBias` / `viewR` round `engine.viewFocus`).
  WHAT WENT WITH THE BOXES: `pressure_half.wgsl`, `smoke_lab.wgsl` + tools/qa/smoke-lab.js (`__sl`), `dust_look_sparse.wgsl` (dust_look.wgsl is that text now), FrameFlags `SmokeRenderSkip` + `settings.smokeRenderSkip`, `Caps.smokeFull` / `fullRateDomains`, `CHAOS.puffDomains`, `SmokeSystemLike.unbounded`,
  seven Tab rows (CAP domains, both skip-empty-bricks, flush ε, pressure at half res, fine / coarse voxel).
  ROUND TWO (10-10, each a knob of `__smoke.sparse` and a row of
  Tab ▸ Volumetrics ▸ Smoke pool, each off = the pool as first benched at 3781d45; `__spl.asBenched()` = all off; notebook §9): WHO STEPS = per BRICK, a brick whose fastest air crosses ≤ `params.calmCells` cells (`farCells` 1 out of sight; 2 left nearly twice the smoke hanging at 7 s: a brick that steps less often loses less, notebook §9.1)
  waits 1 / 2 / 4 frames (`calmMax`; 1 = off) and then integrates what it sat out, never past `dtCap` 1/12 s, the shortest wait of its 27 neighbours, a source wakes what it reaches; the whole pool is dispatched directly from `directAt` of it
  stepping. READS HOP (`readSkip`, SHIPS OFF since the Mac's take: eight pairs, no time saved): shadow rays, the lit marches and the froxels skip stretches the page says are clear (`smokeClearRun` / `smokeAnyIn` over a macro map) — same samples, same answers. WHO GIVES WAY (`fresh` 0.15; 0 = first
  come): as the last 2 × fresh of the pool fills, what counts as thin rises, haze is refused the last slots, keeps less air and is let go sooner; nothing evicted, nothing for game code to count. WHAT IS IN A CELL: one word per
  coarse cell (share not canister smoke, 1 − tint) carried along the density's backtrace; `publish` lays `densityScale` / `fxDensityScale` and the tint into the atlas texel, so the two Tab rows act on smoke in the air (frozen too:
  `refreshDomains` → `publishAll`), every reader incl. the guards' probe takes the same `.x`, and the dust twin reads `shaders/dust_look.wgsl`. GUN GAS LETS GO (`fineDecay` 3 /s, `fineShare` 0.25; 0 and 1 = as benched; §9.8): a fine brick is a fifteenth of a coarse one's volume and nothing eats gun gas any more, so 1.7 s on AUTO
  held two thirds of the pool; now thin gas on the fine lattice and the heat in it fade faster, its floors are higher and its air ring smaller (`fineEps / fineHeat / fineRing`, live only while `fineDecay` > 0), and that lattice has a share of the pool that
  stretches to what the coarse one leaves under `softLo` (haze refused from 0.7 of it, all but sources at all of it; counted apart from a dry pool's refusals: `stats.fineHeld`). `tools/qa/sparse-reads.js` (`__spr.run()` = page loads / atlas fetches / march turns per ray hopping or not, `__spr.at(points)` = what a reader is handed). GPU time (the maintainer's Mac, 10-10, high 734 × 770, one run a solver; notebook §5, docs/perf/sparse-lab-*-mac-1010.json): solver ≈ 0.37 ms + 0.45 µs a brick, pool full 2.16 ms / +3.00 union against eight boxes' 2.83 / +3.68, one can in the open peaks at 2029 bricks = 1.31 ms, ≈ +1.5 ms of union over its box; the look: 'big plumes of smoke are sick' (the maintainer, the compound on hard, four cans). `tools/qa/sparse-lab.js` (`__spl.run()`, a fresh boot a run: 1 / 4 / 8 / 12 cans, then one can through its 32 s burn) is the bench; `__spl.round2()` flips each round-two lever in place on five standing scenes, then stages the dry pool, then a magazine on AUTO with the gun-gas rule and without. `__smoke.sparse` = its knobs. Round two on his Mac (10-10, notebook §9.7, docs/perf/sparse-lab2-*-mac-1010.json): solver 0.43 ms + 0.39 µs a brick that STEPS, twelve cans 1.66–1.70 ms / +2.2 to +2.6 union (round one 2.16 / +3.00), a can late in its burn 0.98–1.05 (1.25–1.31); 8192 = 81 % more smoke for +3.85 to +4.02 and 255.5 MiB, so the pool stays 4096; four cans at once already sit on the soft ceiling (~3,150 bricks). A solver-only run on a page that
  has rendered a frame still carries that frame's WIND records (`smoke.setWind([], 3)` first).
- **Prototype branches — NOT merged** (as of August, except the particle rain: `game/rainFx.ts`, `?prain`, `settings.particleRain` default off and the Frame's 832 B ARE in the build now; fire and water are still not in `src/`; each in its worktree with its own dev server; flag absent = main hash for hash, proven in its notebook; review page published as an Artifact):
  `exp/fire` (.worktrees/fire, :5216 `?pfire`; `game/fire.ts` nodes → a `'fire'` emitter kind through the solver's OWN temperature + buoyancy + an up-jet in the wind field, flames = blackbody
  emission inside `smokeMarchJ` behind prelude const `FIRE_ON`, two flickering 0.25 m sphere lights per fire, capped 3 live / 4 spreads, `hash01(serial)`; `FIRE` knobs Tab ▸ Sandbox ▸ fire,
  `__fire`, `tools/qa/fire-scenes.js` `__fs`, docs/internal/pfire.md, docs/review/pfire.html ← pfire-page.py; the maintainer: 'looks good', plume density 6 (c03b6f8); +3.8 ms union per fire at
  high is its LIGHTS + soot on shadow rays, not the flames; men do not fear fire; flammables keyed off cardboard albedo — wants a level flag) · `exp/water` (.worktrees/water, :5218 `?pwater` =
  the break room flooded / `?pflood` = the whole floor with sets through the frontage, rafts, drifting chairs; `game/water.ts` + `render/water.ts` + `shaders/water*.wgsl`, CPU-only
  `BoxFlag.Water`, shared-shader hunks inside `if (WATER)` blocks — identity rests on const-folding, re-hash after edits inside them; v2 @ baa2a84 per the maintainer's review: REST IS A STILL
  MIRROR, ONE dispersive (η, φ) field drives normal / displaced waterline / caustic (∇²η only), wind stress off `wind.at()` the only ambient source, characters lit in the reflection, a `drop`
  particle kind re-poking the field + spray + foam channel, throwables and the stun blast disturb it, wet particles damp and sleep, rounds die in water; `WATER` knobs Tab ▸ Sandbox ▸ water,
  `__water`, `__hotWater`, `tools/qa/water2-harness.js` `__w2`, docs/internal/pwater.md §v2, docs/review/pwater.html) · `exp/particle-rain` (.worktrees/prain, :5208 `?prain`; `game/rainFx.ts`,
  rain = particle kind 6 there in a THIRD ring over the kept lattice; v2 = drops lit as water (phase function + strand glint) refracting through the SAME refract_common.wgsl, wind-driven
  slant / gust sheets; `PRAIN` rows Tab ▸ Weather ▸ p-rain (+ 'v1 look'), `__rain`, `__hotRain`, prain-harness.js, docs/internal/prain.md, docs/review/prain.html; its Frame grows to 832 B
  there; verdict pending) · `exp/gunsmoke-particles` (.worktrees/gunsmoke, :5206 `?gunsmokep`) SHELVED — 'gun smoke as particles looks lame' · `exp/trace-perf` (.worktrees/trace, :5212) =
  the traversal variants V1‥V8 / H1, all negative (the lab + gatherStrata are on main) · `exp/kimodo`, `exp/sdf`, `exp/textures`, `design/second-space` = parked, awaiting the maintainer.
  Design docs on main awaiting one-line decisions: docs/design/level-scripting.md (levels as FOLDERS with a `script.ts` per level against a typed Director API — generator beats, name-bound
  marks / volumes with define-time lint, stimulus verbs that hand destruction a CAUSE never a result, showcase-only camera / puppet verbs — a workbench Director mode, M1 = the breach as a
  script) and docs/research/destruction-survey.md (glass that GIVES from a per-pane impact Voronoi, a fixture swinging on its cable, jointed furniture; beats scripted Seoul-style, breakage
  only from real rounds). NEXT per the maintainer ('later'): fire propagation + extinction by water / rain AS PHYSICS — species + Arrhenius heat release + droplet evaporation inside the
  existing solver domains (Fire-X, TOG 2025, itself wgpu / WGSL); water bodies stay heightfields, airborne water = particles / SPH-lite with a conservative hand-off (Chentanez & Müller 2010).

<!-- added 2026-10-13, after the cut -->
- **Wet ground breaks up into pools and damp aggregate** (`settings.wetBreakup` 0‥1, default 1; `?nowetbreak` = 0 = the frame as it was; Tab ▸ Materials ▸ '· wet ground break-up'; the small flaws
  goal, commit 2a41e5b5; PICTURE ONLY): under the storm every open ground slab took one finish (roughness 0.22, stretched), which the reflection pass drew as a near mirror across the view. The
  g-buffer now varies that roughness over the ground in world space (`detail.wgsl wetGround`, read in gbuffer.wgsl whatever the detail layer's amount): about +0.04 in the low spots, +0.15 on the
  stone between them. Dry gloss floors are untouched. The amount rides `frame.rtCfg.z` as the anisotropy + 2 × tenths (reflect.wgsl / reflect_p5.wgsl take the anisotropy back out: keep the two
  in step). The sender's claim, not re-checked here: seen only on the software adapter.
- **Lasers and tracers show in the ray-traced reflections** (`settings.beamReflect`, default on, acts only with `rtReflect`; `?nobeamreflect` = no segment handed over, the pass's frame as it
  was; Tab ▸ Materials ▸ '· lasers & tracers in reflections'; the small flaws goal, commit 29dd44b8; PICTURE ONLY): a beam is a NoShadow box no ray can meet, so the reflection pass never saw
  one. `engine.ts` hands `passes.setBeams(world.dynamics, thinIs, viewFocus)` the frame's thin lines (the boxes `game/thinline.ts thinNote` noted: combat.ts `beamBoxes`, tracers.ts) as line
  segments — up to eight, nearest the view — in a small UNIFORM at the reflection pass's binding 11 (not a storage buffer: the scene group's budget is untouched), and reflect.wgsl /
  reflect_p5.wgsl add each one's image where the mirror ray passes it, behind one occlusion ray. No beam on the frame = a zero count = nothing added. A beam is still never a light and still
  in nobody's eye or meter (the one-model rule of the IR lasers bullet stands).
- **Squad lasers are light in the air** (`settings.beamAir`, PICTURE ONLY, default ON; `?nobeamair` / Tab '· squad lasers as light in the air' = the glowing boxes exactly as before; debug views show the
  boxes; the maintainer, 10-13, floodlit at night in rain under the tube: "the lasers do feel a bit nonphysical", then "it's a bit bright given the brightness of the IR beam"). Cause: a laser was an
  emissive BOX floored at a pixel wide, which the tube's log curve clips to white: every beam one flat 4 px white bar end to end, its 2 cm bead lost in it, blind to rain and smoke. The game's boxes
  are untouched (`thinline.ts thinAir` marks a weapon laser's line and its bead; `passes.ts setBeams` hides them from the primary view through `BoxWorld.hidePrimary` and hands ≤ 8 segments to
  composite group 1 binding 15); `composite.wgsl beamAir` adds a Gaussian line (σ = max(2.2 mm, 0.55 px)) of the beam's light × an AIR SHARE, a dot where it lands (gain 3.5, r 9 mm, halo 0.07,
  not scaled by the air) and a glint at the emitter. Air share = `beamAirK` × (0.03 + 0.09 × haze/0.035, haze capped at 2×) = 0.12 by default, + 0.25 × rain and a sparkle on drops outdoors, + up
  to 3 in smoke (read per pixel). A line whose far end is under the ground is cut AT the ground and given its dot (the game's `laserReach` does not meet the yard's floor: such a beam had no dot
  in either look; the IR laser's owner's, not mended in the game). No `FROZEN_HOLDS` row and no journal line: nothing in a step reads it. MEASURED on the software adapter (SwiftShader, verylow,
  floodlit's storm, tube on, 5 lasers, live flips on one page): boxes = core 255, +79 over the wet ground, 94 % of the line ≥ 250; air share 0.565 (the first cut) = the same level, 69 % ≥ 250; air
  share 0.265 (about what ships in that rain) = peak 226, +54, 9 % ≥ 250 (the sparkle beads), dot 10–12 px at half height against a 2 px line. Pipelines 112/112, 0 GPU errors at verylow and high.
  NOT measured: clear air (estimate +25–40), the red visible beam, a beam across a depth edge, ultra / medium, motion (the sparkle's flicker). Never seen on a GPU: the maintainer's to judge.
- **Wet ground mirrors alike at every tier; a laser's mirror image follows the beam** (`settings.wetMirror`, PICTURE ONLY, default ON; `?nowetmirror` / Tab '· wet ground mirrors the men'; the
  maintainer, same shot: "we don't really see reflections of the characters"). Men ARE in the traced reflections (round-cone proxies in `traceClosest`, shaded with direct light and a shadow ray,
  the first 8 men only: `BoxWorld.addCharacterCapsules`), but `reflect.wgsl` gave the wet lot a dry finish's Fresnel (4 % from this camera) where the gloss path of low / verylow multiplies it by
  (1 + 2.5 × wetness) × 0.85, and the laser's image had a floor of its own (35 % × 1.5): a bright beam image beside men too faint to read. Now traced hits on `aniso` (wet) ground take
  min(F × (1 + 2 × wetness), 1) (the lamps' analytic glints are as they were), `beams.k.y` carries the 2 (0 = off: the arithmetic as it was), and an air-look laser mirrors at
  max(that, `BEAM_REFL_AIR` 0.25) × its air share, gain 1. KEEP IN STEP: reflect.wgsl ≡ reflect_p5.wgsl. MEASURED (SwiftShader, high, 6–12 frames of history only, 115–140 s a frame): the old
  beam image +11 over ground, the new one at the ground's own noise; NO man-shaped image readable with the switch on or off. So the men are 3× stronger than they were and still faint under
  the tube: dark wet kit (albedo 0.12) × 12 % against lit ground, then the log curve. Making them READ needs a drawn floor like the laser's had (a taste call, put to the maintainer), not
  more physics. Defenders past the 8-proxy table have no image and no shadow at all (a separate, bigger job). Never seen on a GPU.
- **The scene group's binding 11 is the fog of war's sight table, and `evalLight` asks it (10-14, `FOG.full` — `stealth.md`).** `common.wgsl`: `evalLight` =
  `evalLightRaw` (the old body) × `lightFogK` for a light whose kind word carries bit 25 / 26 (none while the rule or the fog is off: one `and` a light);
  `evalLightTrue` = the light as it is, for the game's readings (`probe.wgsl` alone). A NEW PLACE THAT WORKS A LIGHT OUT WITHOUT `evalLight` MUST MULTIPLY BY
  `lightFogK` (today: the glints in `reflect.wgsl` ≡ `reflect_p5.wgsl`, `cards.wgsl`, `froxel.wgsl`, the march's K-beam pick) — `probes.ts fog-full` reads the
  text for these and fails on any other file calling `evalLightRaw`. `fogSeenAt` walks the grid, so the VERTEX stage uses `fogSeenBins`. The table is a 41 KB
  uniform (the 5th of 12 a stage may bind with the composite group's) written as storage by `fogsight.wgsl` at the head of the frame, bound through a second
  scene group (`sceneBGPlain`, a zero stand-in at 11). Sampled textures: the composite stage is at 15 of 16 (13 + the smoke atlas + the smoke page — the note
  at `passes.ts lComp` still says 14). Compiles on the software adapter (105 programs, 0 failed); never run on a GPU.

- **A shader module's text is cut to what it uses (2026-10-19, a play test: fifteen seconds and more of shader compiles on a fast Windows machine, "compiling the same shaders over
  and over", hitches while it does).** `src/gpu/wgslTrim.ts SHADER_TRIM` (ON; `?shadertrim=0` = every module whole, as it was — a switch of the page, not a rule of the game: no knob,
  no `FROZEN_HOLDS` row, both stands boot the same Engine). Every scene module is compiled behind `render/frame.ts scenePrelude()` — some 150 KB and 350 declarations in front of a
  kernel that may read a twentieth of it — and the head of that prelude holds the level's compile-time switches (the weather kinds, snow, the glass, the cut boxes), so a level of
  another family changed the TEXT of every module though most kernels never read the switch. `gpu/device.ts makeShader` (and the one boot module `passes.ts` makes itself, the dust
  volume's) now hands the browser `shaderText(code)`: the module-scope declarations an entry point reaches by name, in their order and character for character (comments aside);
  every entry point, `override`, directive and `const_assert` always stays, and text with no entry point comes back whole. Hot-swap and viewer modules are left whole.
  **Counted** (`tools/qa/shader-count-page.cjs`, the real page on the software adapter at medium, a walk of five pages: the title, the compound's kit picture, the compound, the
  block, the pass): the title is 66 modules, 12.1 MB of WGSL before and 3.3 MB after (73 % less); the same 150 pipelines either way (130 asynchronous + the three radiance-cascade
  ones before ready, 17 after), 118 of 118 counted in by the card, none failed, no GPU error on the console of any page. Module texts NEW to the browser on each page of the walk
  (not made, character for character, by an earlier page), before → after: the title 64 → 63 · the kit picture of a first mission 57 of 64 → 26 of 63 · that mission 2 → 2 · a
  second level of its family 0 → 0 · a snow level 58 of 66 → 13 of 65. Pipelines whose every stage an earlier page had made: 39 of 142 → 104 of 142 for the first mission, 41 of
  146 → 129 of 146 for the snow level. What still differs is what really reads a switch: thirteen modules read `WX_KINDS` (the title's office is the one family with it off), six
  to thirteen the snow's, one carries the level's own mesh-tree sizes. A quality change (medium → high on the title) made no module and no pipeline in the six seconds watched.
  `tools/qa/shadertrim-check.ts` (the Engine booted on a recording stand-in, whole and cut: same modules, order kept, every root kept, nothing left that mentions a dropped name,
  cutting twice changes nothing; a level whose weather switch differs is 10 new texts of 35 where it was 30; `SHADERTRIM_BREAK=1` must fail) — one Engine, so one stand's worth; it
  passes under `TPS_PROFILE=shipped` the same. `window.__boot.shaderText {modules, before, after, ms}` and `.slowest` (the six boot pipelines that came back last) are on the boot
  line; the benchmark's text carries them under `load`, with a `loads` row of every scene's own load (the first compiles cold, the later ones show what the browser kept).
  **The picture, cut against whole** (`tools/qa/draw-equal.cjs` on one build, the switch passed through its quality word: `--quality 'medium&shadertrim=0'`; 320×180, medium, the
  software adapter): the rain view and the squad view are EQUAL pixel for pixel at both checkpoints. One trap in reading it: the fog-of-war pass makes its pipeline on first use,
  so on the squad view the second drawn frame has that pass or not by how fast the compile came back (one cut run had it, a second cut run and the whole run did not: those two
  are equal); `&nofow` on both sides takes the race out, and is equal at both checkpoints.
  **Never seen on a GPU.** That a driver's compile gets shorter, that the browser's shader cache now answers a second level's modules, and that the hitches go with the text are INFERENCES — the next
  benchmark text from the Windows machine is the measure (`load`, `loads`, `longest freeze`).
- **What is left of the shader wait, and needs a GPU to do (2026-10-19).** (1) Compile first what the opened quality draws: the boot waits for all ~133 pipelines though a tier
  takes a part of them (the legacy and v3 denoiser chains, every à-trous variant, both composite kinds are all made). The count tool prints which boot pipelines a pass took in the
  seconds after ready, but on the software adapter a frame is half a minute, so its list is a floor, not the set — the split needs a machine that draws, and every pipeline left
  for later needs its pass to stand down until it is in. (2) Module creation is one burst: sixty `createShaderModule` calls in one task, parsed back to back on the browser's GPU
  thread (the likely "longest freeze" of the benchmark's load row; the cut makes that burst a quarter of the text); spreading them over frames means an `await` between passes in
  `Engine.init`. (3) `render/rc.ts rebuildRc` makes its three pipelines synchronously at boot and at every quality change (identical text: the implementation's cache answers a
  repeat). (4) The Game's own build is one block of the page's thread (0.9 s here in the browser): the mesh shadows' BVH and the reach derivation are most of it
  (`render/meshShadows.ts`, `game/reach.ts`), with `math/hyp.ts`'s trial at module load beside them; the benchmark's `game built in` says what it is on a real machine.
- **The outline in the dark** (`render/outline.ts`, `shaders/outline.wgsl`; 2026-10-20): one scissored, blended triangle onto the composite after the fog of
  war and before the resolve, reading the G-buffer's id and depth targets, made only while the player's Options row is on. What it is for, what it costs
  and what nobody has seen: `docs/agents/menus.md`, "Finding your own man". A pass that wants whose-pixel-is-this can take it as its model: the owner byte
  is bits 20 to 27 of the id target on a character's mesh and on every box emitted for him.
- **The bounce is never read through a wall off a man (`BOUNCE_WALLS`, the scene prelude's const — `render/frame.ts bounceWallsConfig`, ON; `?nobouncewalls` at boot = every
  read as it was; no game table, nothing for a recording to carry, the same on both stands).** The maintainer, 10-20, the pass at night, the squad in the snow against
  the tea room's outer wall, the debugger's direct / specular / indirect views: "i think there's some leak on direct and specular and indirect with the wall here", and
  "also happens on this side too". WHAT IT WAS: the radiance cache (`diceIrradiance`, a 1 m lattice) is read a probe spacing along a face's normal — sound for a wall,
  and for a man stood by a wall the room behind it. (1) Indirect: a gather ray that HIT a man read the room off his side that faces the wall; a ray that LEFT a man (or
  the lip of a boot print: a shading normal well off a box face's own) for the wall was bounded by `diceIrradianceFrom` as if the plane it left were a wall, and
  "the cell centre is behind it: step to the cell on its side" stepped the read into the room. (2) Specular: a coat's sheen (`composite.wgsl wetCoatSpec`) mirrored
  the cache a spacing along the man's normal: the room's lamps on his rims. (3) Direct: nothing found — the reach masks drop the room's lights from the cells outside
  (dumped for the pass: level 0 in every cell beyond the walls), what his direct view shows is the moon; the few warm specks on the men's rims there are NOT explained.
  THE RULE: `lighting_common.wgsl diceWalledPoint(Ph, n, skip)` — the read point a spacing along n, stopped 5 cm short of the NEAREST box on that line (`occludedTBoxes`
  answers the first box it meets, the ground before a wall: it is asked again short of each answer; men's proxies are not asked, and `skip` names up to two men whose
  carried boxes are not either — his own gun must not hide the air from him), then a box ray to the centre of each of its four plan cells: the read keeps all four,
  else the one column / row / cell it sees, and where it sees none there is NO read (dark, never the room). Asked where the hit is a man or a box he carries
  (`bounceHitMan`: the gather's rays, the ray-traced reflections' hit shading, the cache's own probes in `hitRadiance`; NOT the gather program's own gloss and pane
  rays, which keep the old read: below), where the surface a gather ray
  left is no wall (`bounceLeftNoWall`: a man's pixel; within 2 m, a normal more than a dozen degrees off every axis), and for the sheen. Everything else reads as before (since 10-23 a metal's reflection rays ask it too: REFL WALLS, the next bullet).
  THE SOFTWARE ADAPTER'S ROOM (10-20, the same day: the build with the rule lost its GPU device — "A valid external Instance reference no longer exists", the GPU
  process dead of a segfault — on the first frame a CUT piece was alive: a wall charge in `soundlanes-page.cjs`'s walk, a bang entry that broke cover). The software
  adapter builds a copy of a function for every place it is written, the read wrote `occludedTBoxes` in three places and the gather asked the read in five: fifteen
  more box walks in the gather's program, each with the cut test inside in the cut twin (`render/cutSwap.ts`), and that twin no longer ran. Bisected on the blown-wall
  still (`node tools/qa/cut-stills.cjs --root . --out <dir> --tag after --cut --scene wall --cam near --quality verylow --w 320 --h 180 --settle 3 --physics 30`, ten
  minutes a run, one run each): rule in the probes alone clean, probes + sheen clean, gather + reflections dead; the walk written ONCE (five more walks in the gather)
  clean at verylow and high; a second written walk (ten) dead. So the read's loop asks ONE written walk up to eight times, and the gather's gloss and pane rays (a man
  mirrored in a floor or a pane) went back to the old read: three more walks. THE RULE FOR WHOEVER EDITS `fgather.wgsl` NEXT: its cut twin is within a handful of
  written box walks of what the software adapter runs; after adding a trace, draw that still. Nobody knows whether any real GPU has such a limit (none was reported).
  `?nobouncewalls` rides a replay page's address (`ui/replaykey.ts VISIT_FLAGS`).
  NOT MENDED: the light meter (`probe.wgsl`) reads the cache AT the man, blended over the cells around him — by a lit room's wall some are the room's (the meter's
  owner's; untouched here). The firefly cap of the reflections (`Eref`) still reads the old point. COST: five to eight short box rays per asked read — every pixel of a
  man for the sheen, his gather rays, and near rays off steep snow or yawed boxes; never timed on a GPU.
  CHECK: `bun run tools/qa/probes.ts bouncewalls` (family `render`; `BOUNCEWALLS_BREAK=1` fails 3 of its first 5 lines; its last 3 are REFL WALLS'; both stands): the shader's rule and every site held by
  their text, and a TypeScript copy (its ray is the nearest box, as the shader's ask-again loop) weighed for men stood 0.33 to 0.9 m off every ceiling-high wall of all
  50 levels, a shin's down-turned skin among the points — reads that blend a cell beyond a wall 42.8 % → 14 of 1.46 M (the pass's tea room: 44.5 % of skin points and
  40.5 % of rays to the wall → 0; a print's lip at the wall's foot 165 of 500 → 0, the 100 that lean 0.15 clean either way and not asked). No shader runs there.
  PAGE: the final text compiled on the software adapter (the pass, squad of four, hard, medium and high quality: 119 of 119 pipelines, no GPU error on the console). STILLS there (one seed, 783×500 at half scale,
  five men stood at the tea room's west wall, the lean-to's bulb put out so the yard has the moon alone, `?nobouncewalls` against the page as it opens, the same
  frames each): the indirect view's men had orange flanks on the side that faces the wall and the snow at the wall's foot an orange streak — pixels redder than blue
  by 6 of 255 on the men's wall side 1623 → 1, on the strip of snow 592 → 1; the spec view's orange rims 1261 → 15; the men stay moon-blue, not black. Eight frames,
  not converged. Never seen on a GPU: the picture in motion, the cost, and whether a man's dark side reads too dark where the walled point sees one cell.
- **A metal never mirrors the room behind a wall (`REFL_WALLS`, the scene prelude's const — `render/frame.ts reflWallsConfig`, ON; `?noreflwalls` at boot = the rule
  off; no game table, no journal line, no `FROZEN_HOLDS` row: nothing in the update reads it and the headless stands draw nothing)** (10-23). The maintainer, the solo
  night's manager's office at high, one desk lamp lit: "some weird light leakage on bookshelf? seems like irradiance cache leak through wall? and showing up in
  specular?" — the steel shelving on the partition to the lit storage room glowed a dull orange, and only debug view 10 (specular) showed it. CAUSE: a ray-traced
  reflection shades its hit with `diceIrradiance(Ph + hit.n × c0Spacing(), hit.n)`. For a hit on a wall the spacing leads into the room. For a hit whose normal runs
  ALONG a partition within half a cell of it (a shelf board, the floor at the wall's foot, the ceiling over it, an upright's side) the read stays by the wall and its
  four plan cells straddle it: with the wall on the metre lattice the share of the cells beyond is 0.5 less the distance to the wall's line, 0.1 to 0.27 on that unit's
  boards and 0.44 at the wall's foot. A dielectric shows a few per cent of its mirror at this camera; a metal shows all of it (F0 = its paint, and composite steps a
  metal's diffuse back 70 %), so the steel glowed and the cartons on it did not. The 08-12 mend (`diceIrradianceFrom`) is the gather's and bounds a read by the plane
  the ray LEFT; it was never asked by the reflections ("listed for a follow-up if a case shows") and would not have held this one: the wall is neither plane.
  THE RULE: a metal pixel's reflection rays (`metalness > 0.25` in `reflect.wgsl` / `reflect_p5.wgsl` main) shade every hit with the walled read
  (`diceWalledPoint`: stopped short of the nearest box along the normal, the footprint held to the cells the point can see, no read where it sees none), the reflecting
  pixel's owner in the skip word; every other pixel's rays keep the read they had. The box walk is written no more often than before (the sites that asked it for a
  hit on a man now also take the metal's word), so the software adapter's program is no bigger. `?nobouncewalls` alone no longer gives the picture from before both
  rules where a man is mirrored in steel: that takes both words. `?noreflwalls` rides a replay page's address (`VISIT_FLAGS`).
  NOT MENDED: the same blend in the DIFFUSE gather's hits for rays that did not leave that wall (× the look's indirect scale 0.35, and not seen in his indirect view);
  the gather's gloss and pane mirror reads (low and verylow trace no reflections; that program has no room for a fourth walled site); a pane's mirror
  (`diceMeanRadiance(Pg + Rg × 0.6)`); the light meter (`probe.wgsl` reads the cache at the man: no LIGHT number moves with this switch, the reflections are picture
  only); phase 5's hit-lighting reuse (`rtHitReuse`, off on every preset) keys its record by box and place, not by which read made it. THE GENERAL MEND, proposed and
  not built: the cache writes, per cell, which of its plan neighbours its centre can see (a few short box rays where it already traces hundreds, so doors and blown
  walls follow), and `diceIrradiance` itself holds its footprint to those — every reader mended with no rays at the read, this rule and BOUNCE WALLS' rays retired.
  COST: five to eight short box rays more for each ray of a metal pixel (steel shelving, lockers, door leaves, the GWOT kit's sheet metal; two rays a pixel on ultra);
  never timed on a GPU. RISK, from the review's count on the check's own model: away from walls the walled read also moves 15 % of floor reads that never leaked
  (stopped short of furniture, or one line to a cell blocked by a desk leg) and 3 % of wall-face reads see no cell and go dark, so a steel face may show a step or a
  dark patch in its mirror of clutter. Never seen on a GPU.
  CHECK: `bun run tools/qa/probes.ts bouncewalls` (family `render`), its last three lines; `REFLWALLS_BREAK=1` fails two of them; both stands. The text of the rule in
  both passes, the prelude and the flag; and the same TypeScript copy of the read weighed for faces that look up (the floor, a board's height) or down (the ceiling)
  6 to 40 cm off every ceiling-high wall of all 56 levels, the boxes turned a quarter put back so the shelving's own boards stop the walk: reads that blend a cell
  beyond a wall 195,120 of 292,051 (66.8 %) → 0, with 1.0 % seeing no cell (dark); at the office's partition 397 of 508 → 0, 24 dark. No shader runs there.
  PAGE (the software adapter, one seed, 640×360 with 492×277 inside at high, `?solo&paused&quality=high&mute`, the camera pinned on the unit from the office side, 24
  frames, `?noreflwalls` against the page as it opens): the final text compiled and drew with no GPU or page error. The specular view at exposure × 4, in display
  levels of 255: the uprights' inner faces 19.4 → 0.7 (their brightest point 53 → 2), the lowest board's top 6.3 → 1.0, the next 1.6 → 0.7, the top board 4.7 → 3.4,
  the unit's whole rectangle on screen 4.08 → 1.70 in the mean and 11.7 → 2.4 at its ninetieth percentile; in the final frame the uprights 3.1 → 0.3 and the lowest
  board 1.4 → 0.3; the indirect view is the same to the digit at every point (the diffuse is not touched). What stays, the same with the switch either way, is a warm
  streak on the front edges of the top two boards: read as the desk lamp's own highlight (inferred, not traced). No step or dark patch showed in that one view. Never
  seen on a GPU: the picture in motion, the cost, and steel anywhere but this unit.
- **An open fire burns (`src/game/fire.ts FIRE`, `render/shaders/fire.wgsl`; 2026-10-23, the maintainer: "we gotta improve our fire! we have barrels with fire on them …
  great fire with smoke and crackles and dynamic lighting would look sick").** Until now such a drum was a glowing lid and a steady lamp. A level light whose id starts
  with `brazier` is a fire (`pass.json` and `tut-sky.json` have one each; `docs/level-format.md`, the lights row). SWITCH: `FIRE.on`, ON in the page (`?fire=0` = the
  lid and the steady lamp), OFF in the module and on the frozen stand (`TPS_FIRE=1`); its table rides the journal and a recording from before the key replays with it off.
  THE FLUID SOLVER IS USED FOR THE SMOKE AND NOT FOR THE FLAME: a flame is 40 cm across and changes shape in a tenth of a second, the solver's cells are 5.5 cm and it
  publishes density, not heat, to the picture — a flame made of it would be seven cells wide, cost bricks at every preset and still need a shader to colour it; smoke is
  what the solver is for (it climbs, leans in the wind, pools under a roof, is lit by every lamp and shadowed).
  THE LIGHT is the level's own lamp, no new light: its strength × `fireFlicker` (smooth noise at five rates 0.43‥8.3 Hz + a kick with each crack of the wood: 0.69 to
  1.37 of the authored 9 over twenty seconds, mean 0.985, RMS about 0.15, never under `least` 0.6 or over `most` 1.6), its place lifted `lift` 0.2 m into the flame (the
  level hangs it 16 cm over a lid 58 cm wide: from there the lid is lit white and a flame is lost on it) and wandering 6 cm. WHO READS IT: the light meter of a man
  beside it, and nothing else — `lightEstimateAt(…, steadyOnly)` (the calm torch, the dark-floor and dark-door rules) is handed the AUTHORED lamp where the level hung
  it through `RtLight.steady` (one line of guards.ts), the same number every frame as with the switch off (the check's `steady` line, bit for bit).
  THE FLAME, THE BED OF COALS AND THE EMBERS are drawn by the composite (`fireOver`, beside the lasers' light in the air; records in the beams uniform, `passes.ts
  setFires`, four fires at most, the nearest the view): a marched volume 18 steps deep, thin (`FIRE_SIGMA` 8 /m) so its heart is bright and yellow and its rim red; a
  disc of char and glowing gaps over the lid; ten embers climbing and six thrown by each crack, closed forms of the game's clock (nothing kept between frames: a replay
  draws the same fire). PICTURE ONLY; hidden over ground the fog of war hides (and the fog's remembered lamp is the authored one, where the level hung it: fogofwar.ts `litBlock`); not in the ray-traced reflections; the level's glowing lid under it is dimmed to
  `coals` 0.42 of its authored glow (its bounce is that much less).
  THE SMOKE is a `look` source on the coarse lattice (`FIRE.smoke`), filed every second while the solver draws and the fire is within `viewR` 18 m of the view.
  LEARNT IN THE PAGE: a source two cells wide does NOT climb whatever its heat (temp 2.6 to 30: it hung within 0.3 to 0.6 m of where it was filed, an invisible haze
  at head height that cut a line along the wind at 1.6 m to 0.26); one five cells wide (radius 0.26, temp 30) climbs — so it is as wide as the drum and its FOOT is
  over a standing man's head (2.05 m; the check holds 1.9). MEASURED IN THE PAGE (`fire-page.cjs`, the pass, the software adapter at Low, the yard's 0.5 to 0.8 m/s of
  wind at the drum, a plume fifteen seconds old; the light each line keeps, a line starts to count smoke under 0.8): across the plume at 1.3, 1.5 and 1.7 m, over
  the drum and 0.8 and 2 m downwind, 1.00 every one; at 1.9 m 0.94 over the drum, 1.00 downwind; ALONG the wind (2 m upwind to 6 m down) 0.98 at 1.3 m, 1.00 at
  1.6 m, 0.92 at 1.9 m; overhead 0.55 at 2.6 m and 0.23 at 3.4 m (the smoke is there); with `?fire=0` every one of them 1.00. ONE wind, one level, open sky: a fire
  under a low roof or in still air may pool lower, and nobody measured that. `?firesmoke=0` (`FIRE.smoke.on`) is the fire with no smoke.
  THE SOUND: `fireBed` (a 7 s loop held as a follow voice, handed on every 12 s, asked again when a fire is lit again) and `fireCrack` with each pop — the mixer's
  alone, no event: nobody in the game hears a fire.
  WHAT IT COSTS, by the model and timed on no GPU: no light is added. The flame, coals and embers run in the composite, which every preset draws as its compute twin
  at OUTPUT size (timer row `compS`; the ladder counts it fixed, so the render scale cannot pay for it, only a preset hop): against High's 1000 rows Ultra × 1.44,
  Medium × 0.81, Low × 0.52, Very low × 0.36. Only pixels inside a fire's bound pay (a cylinder 1.3 m round it: with the game's 28° camera at 55° of pitch 5.5 % of a
  16:9 screen at the 21 m the game opens at, 14 % at 13 m, 68 % at the closest zoom, 6 m): about 2,300 operations a pixel there (ten ember tests, up to 24 more for
  1.5 s after a crack), and about 15,500 where the ray crosses the flame's marched cylinder (18 samples of six noise reads; 1.3 %, 3.3 % and 15.5 % of the screen —
  the cylinder is 1.9 mouth radii wide, the flame itself lives inside 1.1). Set against the resolve's row (0.25 ms at High for work of that order: a count, good to about
  three times either way) that was 0.20 ms at High at 21 m, 0.53 at 13 m and 2.5 at 6 m; since `fireFlame` returns before any read for a point the wobble cannot bring
  inside the rim, and right behind its two wobble reads for one that ends outside it (exact: the flame came out 0 there anyway, and `fire-lab.cjs`'s 24 frames are
  byte for byte the same, in still air and in wind), about 0.13, 0.35 and 1.6. The ember tests are most of the
  closest zoom's price and are as they were. THE SMOKE IS THE REAL COST and the same at every preset: the solver stays awake while a
  fire is within 18 m of the view — the plume alone holds about 1,100 bricks after twenty seconds when the solver is only
  stepped (497, 942, 1,119, 1,216 at 5, 10, 15 and 20 s, against 110 to 140 with the fire off) and the DRAWN page's pool read 2,242 fifteen seconds in against 901 with
  the fire off (the pass's own cold-weather smoke), so about 1,300 bricks: by the solver's own figures on the maintainer's Mac (0.39 µs a stepping brick, and 0.43
  ms for being awake at all on a level where nothing else smokes) 0.5 ms on the pass and about 0.95 ms where the fire is the only smoke. The plume was still
  growing slowly at twenty seconds. `?firesmoke=0` is the same fire without it, to weigh that on a GPU. BY PRESET, and the
  one rung that draws the fire without its smoke: FIRE SMOKE SHED, the next bullet.
  CHECK: `bun run tools/qa/probes.ts fire` (`tools/qa/fire-check.ts`, families `render`, `all`; fifteen lines, both stands; `FIRE_BREAK=1` fails thirteen): the lamp's swing
  and place, a second game the same frame for frame, the bed and the cracks, out and lit again, a checkpoint load (and the bed asked for again behind it), the smoke's sources (look-only, coarse, foot over
  heads; none without a solver, on a preset that sheds it, or with the smoke put off; the game that smoked for twelve seconds and the one nothing drew differ in
  nothing of the fire's state), the steady readers, the CPU estimate (1.25 m off: steady 3.350, burning 2.06 to 4.37, mean −6.9 %; 3 m: 0.533 against 0.35 to 0.72,
  mean −2.6 %), off = the build as it was, an old recording. THE SHADER ALONE: `node tools/qa/fire-lab.cjs` (seconds; where the look was set). THE REAL PAGE:
  `node tools/qa/fire-page.cjs` (software adapter, minutes): it boots with the switch either way (119 of 119 pipelines, no page error) and
  the stills are on the fire's page (rebuild/fire/): a flame on a bed of coals with the man beside it, the wall and the snow lit warm, a pale plume leaning downwind — against
  a white lid. THE GPU METER there, the same sixteen frames of the same game with the fire and without (the player's `visibility`): at 1.25 m 0.941 to 0.949
  burning against 0.952 to 0.955 steady; 3 m 0.635 to 0.717 against 0.605 to 0.631; 5 m 0.375 to 0.674 against 0.398 to 0.608 (the storm's lightning is in both). Half
  a second a stand: enough to say the flicker moves the meter by hundredths, not to give its swing.
  NOT DONE, KNOWN: the flame's clock wraps
  every 68 minutes (one frame's jump in its shape); `brazier*` is a name rule, not a level key; a brazier can still be shot out or jammed and the flame dies with
  its lamp. NEVER SEEN ON A GPU OR HEARD: the flame in motion through the temporal resolve (its 18-step dither, one-pixel embers under the clip), the flicker's
  feel on the yard, the plume, the sound, and every cost above.
- **The floor rung draws an open fire without its smoke (FIRE SMOKE SHED: `settings.fireSmokeShed`, `ui/quality.ts fireSmokeOf`; 2026-10-23).** Asked when the fire
  was merged: price it by preset, and say whether a preset should drop its smoke. The maintainer's rule stands (the smoke stays near High and other things pay the frame
  budget first), so this is the one rung with nothing left to pay. THE PRICE, by the cost model and timed on no GPU: the fire's smoke is the solver's fixed 0.5 ms (other
  smoke already keeps the solver awake, as the men's breath does on the pass) to 0.95 ms (the fire is the only smoke) at EVERY preset — 1,300 bricks at 0.39 µs a
  stepping brick, + 0.43 ms awake; every preset solves with high's four pairs since ONE SMOKE SOLVE, which is what that figure was measured at. Against each rung's
  modelled compute at its own scale on the maintainer's Mac, and what the ladder's render scale gives up on a machine that only just holds the rung at its 15 ms:
  ultra 31.3 ms, 2 to 3 %, 1 to 2 % of its rows; high 14.5, 3.5 to 6.5 %, 3 to 5 %; medium 8.7, 6 to 11 %, 5 to 10 %; low 4.6, 11 to 20 %, 12 to 24 % (past the
  0.5 scale floor where the fire is the only smoke: that machine hops to verylow beside a fire); verylow 2.9, 17 to 32 %, and it cannot be paid — its whole per-pixel
  part is 1.0 model-ms on the scale floor, 15 ms becomes 17.6 to 19.8. The flame's own price is the bullet above. THE RULE: a preset with `smokeOwn` (verylow: the rung that
  already keeps its own cheap smoke under SMOKE KEEP, for the same reason) draws the fire with its flame, embers, light and sound and files no smoke source; every
  rung above keeps the smoke and the scale pays. UP FROM THE FLOOR THE SHED STANDS ONE RUNG (`fireSmokeFor`): auto prices the hop verylow → low off a frame measured
  with no fire smoke, so a low that put the smoke back would be 0.5 to 0.95 ms short beside a fire, fall to the floor, find room and hop again, the plume coming and
  going each time. While AUTO moves the preset, low reached from verylow keeps the shed; the smoke is back at medium (where the scale has the room: the hop low →
  medium is priced without it too, and medium's scale has 6 to 11 % to give) or when a preset is put on by hand; a machine that came DOWN to low keeps its smoke. HOW: `Quality.apply` writes `settings.fireSmoke` (render-side, never `FIRE.smoke.on`: that table rides the journal
  and a graphics preset must not write it), `game/fire.ts updateFire` reads it beside the solver's `drawing`; a fire that gets its smoke back (a hop up the ladder)
  smokes the same frame, and one that loses it just stops filing: the plume there thins out by itself and the solver sleeps when its bricks are let go. SWITCH:
  `settings.fireSmokeShed`, default on, `?fireshed=0` = every preset keeps the fire's smoke, as it was (render-side like ONE SMOKE SOLVE: no `FROZEN_HOLDS` row, no
  journal line; `?firesmoke=0` still puts the smoke off at every preset). WHAT IT IS NOT: a game rule on any stand (the source is look-only, and no headless stand
  has a solver that draws) — but in the PAGE a sight line reads the solver, so beside a fire a line over a standing man's head (the fire's notes: 0.92 to 0.94 kept
  at 1.9 m, 0.55 at 2.6 m, all of it at 1.7 m and under) reads the plume on low and up and none on verylow. Nobody in the game looks along such a line today.
  ALSO RENDER-SIDE BY WAIVER, to be confirmed: the key is read inside the game's update (beside `drawing`, itself a render setting). What it
  decides is kept out of the game's state: the fire's book of which smoke it filed and which bed voices it asked for is on the HOST, beside the list the
  renderer is handed (`engine.fireShown`, `fire.ts FireShown`; `Game.engine` is in no snapshot), and `fire.states` holds only what the clock alone decides — so a
  preset or a solver moves no state hash through the fire (the fire check's line 'the host's, not the game's': the game that smoked for twelve seconds and the
  one nothing drew differ in no row of the fire's, and the lamp and the coals are the same to the bit). The book is dropped when a save is put back
  (`host/putback.ts`, and a load's or a restart's own paint): the smoke is filed and the bed asked for on the next frame, where before a load into an earlier
  twelve seconds left a burning fire silent until the next mark (the check's second load line, which runs the host's own `hostAfterPutBack`; red with the paint's drop taken out, and `FIREBOOK_BREAK=1` undoes the put-back's line and fails it). A page replay under another preset
  still files other look sources, and the men's breath still writes its own word for the solver into the game's state (`snowBreath.states … why`: not this file's). NOT DONE: the
  other look sources (the men's breath, the cigarette) still wake the solver on verylow, so on a level with them the shed saves the plume's bricks (0.5 ms) and not
  the 0.43 ms of being awake; `settings.fireSmoke` is written when a preset is put on, so the switch moved by hand on a running page waits for the next preset.
  CHECK: `bun run tools/qa/probes.ts ladder` (four lines: by hand, under auto up from the floor, the switch off, a bare mock; `FIRESHED_BREAK=1` fails two) and
  `probes.ts fire`'s line 'on the graphics preset that sheds it', the real `Quality` over the game's own settings (verylow put on: no source in four seconds; low put
  on: a source that frame; both stands; `FIRESHED_BREAK=1` fails it). THE REAL PAGE (the software adapter, the pass, 640 × 360, the player beside the brazier, the camera at 13 m; a
  frame is twenty seconds and more there, so this is half a second of the game): verylow pinned, on this text, boots 119 of 119 pipelines with no page error, `fireSmoke`
  false, the flame drawn over the drum (the shader's two early returns compiled into the composite), and in sixteen frames no source filed and no brick in the solver's
  pool; low put on in that page: a source that same frame, 64 bricks, then 151 fifteen frames on. With `?fireshed=0` (a page from before the auto rule and the
  shader's first bound were written; stopped early, so its error list was never read): verylow boots 119 of 119, `fireSmoke` true, a source filed within the first
  eight frames, 125 bricks. NEVER SEEN ON A GPU, and nobody has watched the ladder move beside a fire: the auto rule is the self-test's alone. A take that would settle the prices: the pass and mission 1's level by the fire, F8 at high and low, the page / `?firesmoke=0` / `?fire=0`, at the zoom the
  game opens at and at the closest; and a fire under a roof, where the plume pools (never measured).
