# P0-A — cascade upkeep: what the "7–13 ms rotation bursts" actually are (2026-08-10, lane `v3/p0a`)

Brief: docs/internal/renderer-v3.md §2 / STATUS "RENDERER V3": *at a fixed camera the cascades cost a flat ~1.7–2.2 ms, but rotating the
camera bursts them to 7–13 ms in single frames (each `rc cN` pass max 7–13 vs medians < 1) — newly covered probe regions are baked all at
once; and any settings/scale change re-bakes everything.* Job (1) was to decompose the spike before building the amortizing scheduler.

**Result of (1): there is no re-bake and no burst of cascade WORK. The cascade volume is world-anchored over the whole level
(`WORLD.rcSize`, 40×4×28 c0 probes, rc.ts / rc.wgsl) and every probe of every level is re-traced every frame whatever the camera does —
nothing in the trace reads the camera, nothing is invalidated by rotation, and no settings flip other than a probe-GRID change
(`engine.rebuildRc`, only medium↔low) touches the cache. The 7–13 ms figures are a timestamp-accounting artifact: Metal runs the `direct`
compute pass CONCURRENTLY with the cascade chain whenever the queue is saturated (they share no resources: direct reads the G-buffer, the
cascades read the scene), each pass's timestamp pair then spans wall time in which the GPU was mostly executing the other pass, and every
per-pass SUM (HUD `gpu ms`, the F9 recorder's `gpuSum`, auto-quality's calibration total) double-counts the overlapped span. The frame's
real GPU time does not move.** Measured three independent ways below. A second, smaller instrument bug fell out of it: the "resting"
passes `rc.ts` opens on half-rate frames never get their timestamps written, so `rcHalfRate` reads at ~full cost (§4).

Machine / method: M4 Max, Chrome (the Browser pane) / Metal, dpr 2 → internal 1777×1000 `high`, 2133×1200 `ultra`, 1600×900 `medium`;
this worktree served on :5183, `?paused&quality=…&mute`, cubicles view (look 23, 0, 19.4 · pitch 55° · dist 18), guards on patrol, no
weather stimulus. SERIALIZED = CLAUDE.md's protocol (one `__runFrames(1)`, `await queue.onSubmittedWorkDone()`, MessageChannel yield,
per-frame UNSMOOTHED timestamps); ORBIT = `__stage` re-pinned every frame with yaw += 0.0105 (0.6°/frame), 120 frames after 12 warm;
CADENCE = frames submitted back to back with no drain between them (what a GPU-bound rAF loop does in the field), collecting every timer
readback that resolves. The GpuTimer was patched in-page to keep the raw begin/end tick of every pass, so pass INTERVALS could be laid on
one timeline and their union taken. A second WebGPU client (the maintainer's own tab on :5173, attract mode) shares this GPU at night;
runs were gated on `ioreg` AGX "Device Utilization" reading idle and rejected when the light-independent canary (softblur) moved — the
numbers below are from runs whose softblur σ ≤ 0.1 ms.

## 1. Serialized frames: the cascades are flat, orbiting or not

| preset · run | rc c3 | rc c2 | rc c1 | rc c0 | dice | **rc Σ mean · σ · p95 · max** | direct | softblur | gather | compute Σ | frames with any rc∥direct overlap |
|---|---|---|---|---|---|---|---|---|---|---|---|
| high · static | 0.76 | 0.54 | 0.24 | 0.17 | 0.01 | **1.72 · 0.06 · 1.83 · 2.03** | 7.69 | 3.34 | 2.84 | 16.98 σ 0.26 | 0 / 120 |
| high · ORBIT | 0.77 | 0.53 | 0.25 | 0.16 | 0.01 | **1.69 · 0.04 · 1.77 · 1.77** | 7.44 | 3.13 | 2.8 | 16.57 σ 0.66 | 0 / 120 |
| ultra · ORBIT | 0.74 | 0.54 | 0.24 | 0.15 | 0.01 | **1.69 · 0.05 · 1.77 · 1.83** | 9.97 | 4.39 | 7.91 | 26.05 σ 0.39 | 0 / 120 |
| medium · ORBIT ¹ | 0.77 | 0.56 | 0.24 | 0.17 | 0.01 | **1.74 · 0.05 · 1.83 · 1.84** | 5.75 | 2.50 | 2.16 | 12.94 σ 0.23 | 0 / 120 |

¹ medium runs `rcHalfRate`; its rc rows read as if full rate — that is the §4 bug, not the cache's cost (the true half-rate cost alternates ≈1.55 / 0.2).

Per level the interval count is the same (~72–82 k rays: c3 = 80 probes × 1024 dirs over [12.6, 51] m, c2 = 280 × 256 over [3, 12.6],
c1 = 1120 × 64 over [0.6, 3], c0 = 4480 × 16 over [0, 0.6]); c3's long rays are why it is half the cost. Nothing here depends on the
view: 120 frames of a 72° orbit at three presets never moved a level by more than its timestamp quantum (0.065 ms).

## 2. Where the "bursts" come from: two frames of the same orbit on one GPU timeline (high, serialized, ms from the frame's first stamp)

```
calm frame  (rc Σ 1.70, wall 25.0):  gbuffer [0.00–0.07]  rc c3 [0.07–0.85]  c2 [0.85–1.38]  c1 [1.38–1.64]  c0 [1.64–1.77]  dice [1.77–1.77]
                                     direct [1.77–9.04]  softblur [9.04–12.32]  gather [12.32–15.20]  temporal … volumetrics … probe [16.25–16.45]
"burst" frame (rc Σ 8.39, wall 25.3): gbuffer [0.00–0.07]  rc c3 [0.00–1.18]  direct [0.13–8.59] ← starts WITH the cascades
                                     rc c2 [1.18–7.86] = 6.68 "ms"   c1 [8.65–8.91]  c0 [8.91–9.18]  softblur [8.65–12.32]  dice [12.39]  gather [12.39–15.27] …
```
The c2 dispatch did the same ~0.5 ms of work; its encoder simply stayed open across the 7 ms in which `direct` owned the GPU. Which level
"bursts" is whichever encoder happened to straddle direct (the recordings show c3, c2, c1, c0 and even the 4480-thread dice bake at 5–7 ms —
a kernel that cannot cost that). Over every run: burst frames' wall time = calm frames' wall time (high static under load 58.55 vs 58.82 ms;
high orbit 42.1 vs 40.3; medium 18.6 vs 18.75), Pearson(rc Σ, wall) = 0.03–0.05.

## 3. Field cadence: the overlap is the NORMAL state of a saturated queue, and Σ-of-passes overstates the frame by 35–55 %

| preset · CADENCE (200 frames, readbacks that resolved) | rc Σ mean · p50 · max | frames with rc∥direct overlap | **Σ compute passes** | **UNION of pass intervals** | Σ − union |
|---|---|---|---|---|---|
| high (71) | 9.18 · 10.09 · 10.75 | 62 / 71 | 24.80 | **15.86** σ 0.45 | 8.9 |
| medium (91) | 7.35 · 8.26 · 13.24 | 79 / 91 | 21.44 | **15.70** σ 2.1 | 5.7 |
| ultra (45) | 1.70 · 1.70 · 1.83 | 0 / 45 | 25.72 | 25.72 | 0 |
| high, serialized, for reference | 1.72 | 0 / 120 | 16.98 | 16.98 | 0 |

At play cadence on high the direct pass starts 0.13 ms into EVERY frame, beside c3; the union (15.9) is even a little UNDER the serialized
Σ (17.0) — the concurrency is the driver being efficient, filling direct's gaps with the cascade chain's small dispatches. The recorder's
`gpuSum` for the same frames says 24.8. This is what the four F9 recordings' "cascade sums burst 7–13 in three sessions" are, and it also
inflates their Σ means / p95s at high and medium (ultra did not overlap in this sample, but the ultra recording's c1 = 12.2 beside direct
12.6 is the same signature). Consequences outside this lane, flagged for the lead: (a) the phase gates are written on Σgpu p95 — they need
the union (added to the timer + recorder in this lane, §5); (b) auto-quality calibrates on `timer.total()` = Σ of smoothed passes behind the
start card — on a GPU that is saturated there it will read high and pick a rung too low; (c) design-doc rev 2's field Σ table is overstated
at high/medium by roughly the rc rows.

## 4. The half-rate cache's phantom cost (second instrument bug)

`rc.ts encode()` opens an EMPTY timed compute pass for each level that rests on a half-rate frame "so the HUD averages the cache at the
rate it really runs at". Raw ticks of eight consecutive medium frames: the resting slots come back with STALE ticks from an earlier frame
(e.g. `c3 [18.68–19.40]` on a frame whose real work ended at 1.6 ms) — an empty pass never writes its pair, exactly the unwritten-slot trap
the particles pass hit (c81d775). The difference of two stale ticks still looks like a plausible 0.7 ms, so `rcHalfRate` has been reading
at ~93 % of full cost since it was added — which is precisely the anomaly quality.ts flags at FACTOR.halfRate ("3.0 → 2.8 averaged on the
M4 (×0.93 — suspect: structurally it is ½ … RE-MEASURE)"). Fixed here by giving the timer an explicit zero-cost mark (`timer.idle(name)`)
instead of an empty pass; the true half-rate numbers are in the results section.

## 5. What P0-A therefore does

1. Instrument, so nobody chases this again: GpuTimer keeps the raw intervals of the last resolved frame (`lastRaw`), `unionMs()` /
   `sumMs()`, `idle(name)`, and drops pairs older than the previous frame's first stamp (or never written); the F9 recorder stores
   `gpuUnion` per frame, tools/qa/perf-report.ts prints union beside Σ (+ Σ−union), the HUD gained a `gpu ∪ ms` line under `gpu ms`.
   Calibration still sums smoothed passes (`timer.total`) — the lead's call (one line: quality.ts calibrateTick could push `unionMs`).
2. The scheduler the brief asks for, re-aimed at what is real: not bursts (there are none) but the flat 1.7 ms itself and its evenness.
   `settings.rcAmortize` (default on) + per-preset `rcPeriods` = how many frames each UPPER level takes to refresh all its probes, traced
   round-robin over an interleaved probe subset per frame (constant work every frame — unlike `rcHalfRate` / `staggerUpper`, which alternate
   whole levels and make frame cost saw-tooth), c0 + the dice bake always full rate so the near field (< 0.6 m) and everything downstream is
   this-frame fresh; far-field light (> 3 m from a probe) lands over 2–4 frames, under the dice EMA's own ~7-frame settling. Never-baked
   probes are never sampled: a (re)built cache force-bakes whole levels for its first frames and takes its first dice bake without history
   (today a rebuilt cache crawls up from black through the 0.3 EMA — a visible dark dip on a medium↔low ladder step).
3. World-vs-screen invalidation made explicit: `rc.invalidateWorld()` (re-prime: full bakes + history-free dice once) for callers that
   change the WORLD; `passes.invalidate()` / resize stay screen-only and never touch the cache (they already did not). OFF = today's
   dispatches bit for bit.

## 6. Results (this worktree @ the commits below; same machine / view / protocol as §1; "clean" = softblur canary flat)

### 6.1 The lossless part: chunked upper-cascade dispatch (`settings.rcChunks`, default [1,1,2,8], every preset)

c3 was one workgroup of 64 per probe × 80 probes = 5120 threads each looping 16× over (texel, sub-direction) items — about one thread per
lane of this GPU, so the pass was latency-bound, and dispatching a quarter of the probes cost exactly as much as all of them (measured: c3
0.785 ms at 1/4 of the probes vs 0.76 whole — the first thing the schedule ran into). Splitting each probe's items over several workgroups
(each redoes the 4-ray parent set-up; the per-texel 4-lane reduction stays inside one workgroup iteration) is the same arithmetic in the
same order, so the output is the same bits — verified: 60 deterministic frames from a `?paused` boot (parked guards, seeded Math.random,
zeroed phases, `__resetClock`) hash `52a9ba3b` on main @ 58eeace, on this branch with the schedule OFF, and on this branch with the schedule
ON + chunks 1/1/2/8 (all 1777×1000 high; also chunks switched half-way = the same hash). Sweep (high, static, serialized, p50 ms):

| chunks [–,c1,c2,c3] | c3 | c2 | c1 | c0 | rc Σ |
|---|---|---|---|---|---|
| 1/1/1/1 (before) | 0.786 | 0.525 | 0.262 | 0.131 | **1.77** |
| 1/1/1/4 | 0.393 | 0.525 | 0.262 | 0.131 | 1.38 |
| 1/1/1/8 | 0.262 | 0.524 | 0.263 | 0.131 | 1.25 |
| 1/1/1/16 | 0.262 | 0.524 | 0.262 | 0.131 | 1.25 |
| **1/1/2/8 (shipped)** | 0.262 | 0.393 | 0.263 | 0.131 | **1.05–1.11** |
| 1/1/4/8, 1/2/2/8 | 0.262 | 0.393 | 0.263 | 0.13–0.2 | 1.05–1.11 (no better: c2 floors at 4 items/thread, c1 is already 1) |

The remaining floors (c0 0.13, c1 0.26, c2 0.33–0.39, c3 0.20–0.26) are one long trace + the pass's fixed cost; thinning the probe set
further does not move them on this GPU (§6.2), fewer passes would (merging c3‥c1 into one compute pass is legal — WebGPU orders the
dependent dispatches — but loses the per-level timings; not done).

### 6.2 The schedule (`settings.rcAmortize` default on, `settings.rcPeriods` per preset; Tab ▸ Indirect cache rows)

Design as built: rc.wgsl `rcUpper` takes `sched = (phase, period, dice-blend bits, chunks)` per level per frame (16 bytes written into the
level's uniform slot); with period k the level dispatches ceil(numProbes / k) × chunks workgroups and traces the probes whose linear index ≡
phase (mod k) — an interleaved 1/k of the level, phase = the level's own frame clock mod k (a pure function of frameIdx, so `__resetClock`
captures repeat; under `rcHalfRate` / `staggerUpper` the clock counts the frames the level actually runs). c0 and the dice bake are always
whole (the near field and everything downstream read them this frame; ~10 % of the cost). Un-traced probes are never READ: a fresh cache
primes with PRIME_FRAMES = 4 whole-level frames (one already leaves every level valid — coarse → fine within the frame), and
`rc.invalidateWorld()` re-primes + makes the next dice bake history-free under the schedule (a rebuilt cache used to crawl up from black
through the 0.3 EMA: the medium ↔ low ladder step's dark dip); `engine.rebuildRc` calls it, `engine.invalidateWorldCache()` exposes it.
The brief's priority queue degenerates to this round-robin by construction: every probe of the world cache is always "visible" (the gather's
hit points land anywhere light bounces from, on screen or not), rotation invalidates nothing, and "never baked" only exists while priming,
when whole levels are forced. What the periods buy on THIS GPU is small, because of the floors above (high, chunks 1/1/2/8, p50):

| periods [c0,c1,c2,c3] | c3 | c2 | c1 | rc Σ | note |
|---|---|---|---|---|---|
| 1/1/1/1 | 0.262 | 0.393 | 0.263 | 1.05–1.11 | ultra, high (whole every frame) |
| 1/1/2/4 | 0.197 | 0.327 | 0.262 | 0.98 | medium |
| 1/2/2/4 | 0.262 | 0.327 | 0.197 | 0.92 | |
| 1/1/3/6 · 1/2/3/6 | 0.197 | 0.327 | 0.26 / 0.20 | 0.98 / ~0.9 | low = 1/2/3/6 |
| 1/2/4/8 | 0.197 | 0.327 | 0.196 | 0.85 | verylow |

On a throughput-bound GPU (the M1-class machines the ladder presets exist for) the same periods divide real work: quality.ts
`rcPeriodsFactor` = Σ level share ÷ period with the unchunked work split (c0+dice 0.10, c1 0.15, c2 0.30, c3 0.45) → medium 0.51 ×,
low 0.36 ×, verylow 0.31 × of the whole cache, flat every frame — where `rcHalfRate` was 0.5 × as a whole-levels-on/off saw-tooth with a
frame of latency on everything. Not measurable here; stated as the model. The ladder presets therefore switch rcHalfRate OFF and carry
periods instead (ultra/high [1,1,1,1] · medium [1,1,2,4] · low [1,2,3,6] · verylow [1,2,4,8]); the half-rate option itself is intact.

Honest half rate, now that resting levels report 0 (high grid, chunks 1): even frames c3+c2+c1 = 1.50, odd frames c0+dice = 0.13–0.20 →
0.84 ms average as a 1.5 / 0.17 saw-tooth (the timers used to say ~1.7 flat). FACTOR.halfRate's true value on the M4 is ×0.49, not ×0.93;
left at the model's ×0.6 with a comment.

### 6.3 Before / after per preset (ORBIT 0.6°/frame, 100 serialized frames each; before = the old preset behaviour timed honestly:
schedule off, one workgroup per probe, half rate where the preset had it; after = as shipped). rc Σ mean · p50 · p95 · max, ms

| preset (internal res) | before | after | union of compute passes p50 before → after |
|---|---|---|---|
| ultra 2133×1200 | 1.63 · 1.64 · 1.70 · 1.70 | **1.00 · 0.98 · 1.05 · 1.05** | 26.0 → 25.4 |
| high 1777×1000 | 1.72 · 1.70 · 1.83 · 2.03 | **1.02 · 0.98 · 1.11 · 1.11** | 16.1 → 15.5 |
| medium 1600×900 (was half rate) | 0.84 avg as 1.50 / 0.17 alternating | **0.90 · 0.92 · 0.98 · 0.98** flat | 12.8 → 12.3 |
| low 1280×720, grid 32×3×22 (was half rate) | 0.76 avg as 1.44 / 0.20 (p95 1.44) | **0.79 p50 · 0.92 p95** flat ¹ | 8.26 → 8.13 |
| verylow 1066×600 (was half rate) | 0.93 avg as 2.03 / 0.26 (p95 2.03) | **0.98 · 0.98 · 1.11 · 1.38** flat | 6.49 → 6.82 |

¹ one frame of that run caught the other tab (max 24 ms in every pass at once); p50 / p95 quoted. Worst ≤ 1.13 × median everywhere
(target was ≤ 2 ×); no frame's rc > 1.4 ms at any preset (target < 3 at high). On low / verylow the average is a wash against the old
half rate on this GPU (the fixed floors again) but the saw-tooth is gone; the model's weak-GPU saving is unverified here. GPU validation:
an error scope round each preset's 100-frame orbit + an `uncapturederror` listener across all five: nothing. medium → low rebuilt the grid
and re-primed (`schedule ▸ … · priming` for 3 frames, then the periods engaged).

### 6.4 (a) static camera, (c) settings flips, (d) teleport

(a) Static high: rc Σ 1.72 σ 0.06 before → 1.05 σ 0.04 after; the converged image is not just visually but bit-identical (§6.1) for
ultra / high. For the schedule (medium's [1,1,2,4], verylow's [1,2,4,8]) vs whole-every-frame at a mid-orbit frame (frame 60 of the
0.6°/frame orbit, medium 1600×900): whole-frame diff max 137 / mean 0.75 / >2: 52 k / >8: 6.9 k px ([1,1,2,4]) and 149 / 0.82 / 64 k /
10.5 k ([1,2,4,8]) against a same-settings noise floor of 154 / 0.78 / 59 k / 10.1 k (jitter phase + Sam breathing) — i.e. AT the floor;
300×300 tiles ×3 (docs/shots/p0a_orbit60_{off1,on1248}_{wallfloor,sam,window}.jpg are committed — whole-every-frame vs the most
aggressive schedule; the off2 / on1124 sets were pixel-for-pixel the same story; the whole frame is p0a_midorbit_full_medium.jpg):
wall+floor tile mean 0.60 / 0.59 / 0.64, max 8 / 9 / 7. No dark flashes, no lagging light — expected, since nothing in the cache depends on the camera. The schedule's real
cost is TEMPORAL, so it was measured as that: every switchable light group killed at once (a wholesale change no play produces) and the
filtered indirect's tile mean followed per frame — whole-every-frame decays to 50 % by frame 4–5 and to 10 % by ~frame 20 (the gather's
history + the dice EMA + multi-bounce feedback, as today); [1,1,2,4] runs 4–6 % above that curve (≈ ½–1 frame behind, inside the
run-to-run spread of the whole-rate curve itself: 3–5 %); [1,2,4,8] runs 15–25 % above it (≈ 1.5–2.5 frames behind) for the first dozen
frames. A torch sweeping a wall is near field (c0/c1: whole every frame at medium, c1 over 2 frames at low/verylow).
(c) Flips at high, shipped config, frame 25 of 50: `checkerDirect` on→off — rc 0.98–1.11 throughout, union 15.99 → 15.93 → 15.99 (no
slow frame anywhere); `gatherThird` on→off (gather targets recreated) — rc 0.98–1.11 throughout, union 16.1 → 19.4 = the half-res
gather's steady cost from the first frame (wall 35.9 ms on the flip frame itself = CPU-side texture creation, P0-B's), no rc component.
(d) `teleportPlayer` lobby → break room with the follow camera live: rc median 0.98 before, mean 1.01 / max 1.05 over the 20 frames
after; the camera pans ~0.9 m/frame for ~30 frames and the cache, being world-space, has nothing to converge — what settles on screen is
the gather's reprojection (screen-side, untouched here).

### 6.5 Files / lines touched outside rc.ts + rc.wgsl (for the merge with P0-B / P0-C)

- `src/engine.ts`: RenderSettings + defaultSettings gain `rcAmortize / rcPeriods / rcChunks` (3 + 2 lines); render() mirrors them into
  the rc (1 line after `this.rc.halfRate = …`); `rebuildRc` calls `this.rc.invalidateWorld()` and gained a doc comment; new one-line
  `invalidateWorldCache()`. passes.ts: NOT touched (its invalidate()/resize() were already screen-only and stay so).
- `src/gpu/timer.ts` (lastRaw / unionMs / sumMs / idle / stale-pair fence), `src/ui/perfrec.ts` (+gpuUnion), `tools/qa/perf-report.ts`
  (union columns), `src/main.ts` (2 lines: `unionSm` + the `gpu ∪ ms` HUD row), `src/ui/quality.ts` (Lossy.rcPeriods, presets, apply
  writes S.rcPeriods, `rcPeriodsFactor` in the cost model, FACTOR comment), `src/ui/bindings.ts` (three rows + a status line in
  'Indirect cache'), `tools/qa/perf-harness.js` (frame1 / orbit / cadence / decomp / brief / timeline; setTimeout waits removed).

### 6.6 Gates run on this branch

`node vendor/typescript/bin/tsc --noEmit` clean at every commit · `tools/qa/gate.sh perf frame-layout player breach`: all families ALL PASS
(perf 24 · frame-layout 9 · player 166 · breach 13 check lines, 0 FAIL) · `tour.ts --runs 2 --quiet`: 2/2 PASS, 0 warnings ·
`soak.ts --seeds 1,2 --minutes 6 --quiet`: no violations, 0 exceptions · `bun run build`: ok · `tools/qa/quality-plan.ts`: exit 0 (its
apply table now shows rcHalfRate off on every rung; the schedule column is not in that table) · page: clean `?paused` boots at all five
presets with a validation error scope + `uncapturederror` listener over 100 orbit frames each — nothing; the Tab ▸ Indirect cache rows and
the `schedule ▸` status line render; `/viewer` boots and renders (Engine defaults: schedule on, periods 1, chunks 1/1/2/8).

### 6.7 What is NOT done / caveats

- No burst-removal scheduler with a priority queue was built, because there are no bursts to remove (§1–3); the schedule that was built is a
  budget lever, and on THIS GPU it buys 0.1–0.25 ms beyond the lossless chunking — its case is weak GPUs, unmeasured here.
- The lossy schedule is placed on medium / low / verylow in place of `rcHalfRate` (a preset decision the lead / maintainer may want to
  revert to half rate, or to both: `rcHalfRate` + periods is the cheapest average on the M4 (≈0.5 ms) at the price of the saw-tooth).
- Auto quality still calibrates on the Σ of smoothed passes; the F9 dumps recorded before today have no `gpuUnion` (perf-report says so).
- Nothing was pushed. The stray docs/shots/p0b_keep_*.jpg in this worktree were posted by another lane to this lane's shot server (:5184) and are left untracked.
