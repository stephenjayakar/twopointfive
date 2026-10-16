# Smoke cost — the lab notebook (perf/smoke-scale)

> **08-12 note (after the port merged):** every density read now carries the domain EDGE FADE (`common.wgsl smokeEdgeFade`, commit 2cf2cfb — the plume eases to nothing over the outer 11 % of its box toward the open faces) and the render density defaults to 1.6×. The lab's reference `smokeDensityAtRef` takes the same fade, so `__sl.exact()` still isolates the masking (0 mismatches expected); frame HASHES recorded before 08-12 no longer reproduce (the fade and the density scale change the picture by design).


> **PORT NOTE (main, perf/smoke-port).** This notebook was written on `perf/smoke-scale`, a branch off the FIRE prototype (`exp/fire`); the fire never came to main and
> neither did the lab's `TRACE_VARIANT` instruments (the `SMK_*` counters / stub / 'before' bit in common.wgsl, restir's counter lines), the prefiltered mips
> (`smokeShadowLod`) or the `nop` dispatch probe. What main carries: **T1** (§2.1, exact, always on — `common.wgsl smokeSegment / smokeSubWord / smokeDensityIn /
> smokeTransmittanceN`, the solver's box word in `renderOccPack`, the 544-B occupancy block), **D2** (§3.1, `smoke.params.calmCells`, DEFAULT ½ on main — the
> maintainer takes the bounded trade for the frame time; 0 = the old schedule), `settings.smokeShadowSteps` (§4, default 8 = unchanged look; `frame.volCfg.w`
> carries the count directly, no lod bits), the two Tab ▸ Smoke rows, and the lab minus the fire: `tools/qa/smoke-lab.js` (canister scenes only; `__sl.before()` /
> `after()` rebuild main's pre-port transmittance through `__hotCommon` from the REF block of `src/render/shaders/smoke_lab.wgsl` in place of TRACE_VARIANT 256;
> `__sl.exact()` = the same kernel; `__sl.boxWords()` checks the solver's box words against its own bits; `__sl.d2pass()` / `identityPass()` = D2's look and the cross-build hashes, one config per fresh boot), `tools/qa/smoke-page.py`,
> the JSONs and stills below as the branch measured them (S2 / S3 / S6 / S8 rows are FIRE scenes: branch-only). The port's own proofs are in §8.

> **SUMMARY (10 lines).** (1) Render-side a plume costs the DIRECT PASS's shadow-ray transmittance and little else: 0.6 ms for one canister → 1.9 for eight (of a
> 5.8 ms pass at high); froxel J 0.13–0.2 and the march 0.2 are flat; gather / cascades / reflections pay 0. Nine in ten lit shadow rays in the room cross a
> plume's 3.5 m BOX and take 8 samples (10–14 M atlas fetches a frame), and with 8 boxes live every sample tested all 8. Solver-side: 0.50 ms per busy domain step.
> (2) WIN, exact, on: shadow rays visit only the domains whose OCCUPIED-brick box the segment meets (the solver writes that box behind its occupancy words):
> bit-exact vs main over 50 M random segments; direct −1.2 ms at 8 domains (−20 %), −0.7 at 3, 0 at 1 — the pass is now flat in N. (3) WIN, bounded, knob
> `smoke.params.calmCells` (default 0, recommend 0.5): a domain nothing emits into steps every p-th frame by its VISIBLE smoke's speed (≤ ½ voxel per visible
> step): the sim pass of 3 hanging plumes 1.25 → 0.79 ms (0.46 at 1.0). (4) Negatives measured: restir per-tile gate (+0.1), prefiltered mips (±0.06), a
> branch-free sample loop (+0.2, inexact), froxel gate (nil), kernel fusion (a dispatch is 1 µs), fewer pressure pairs (not pursued); fewer samples −0.3‥0.5 ms
> but blotch the plume's shadow (8 stays, `settings.smokeShadowSteps` exists). (5) Curves, high 1368×770 wide framing: 8 active canisters 17.0 → 15.8 ms union,
> 8 hanging plumes 17.0 → 14.8; at the 14 ms bar 3 active fit where 2 did, 3–4 hanging (6 at 14.2) where 1 did; medium is under 11 ms at 8 either way. §7 = the port list.

Branch `perf/smoke-scale` off the fire prototype `exp/fire` (main @ e63a08d + `?pfire`). One job, in the maintainer's words: *"how to make smoke
cheaper while still preserving the current fidelity … see how far it can scale."* Method = the ray-traversal lab's (docs/internal/trace-perf.md §0–§2):
instruments first, a profile that says where the time goes, hypotheses ranked by the profile, each variant measured with serialized-union interleaved
A/Bs, exactness proven where claimed, negative results written up as such. Every attempt is logged here, failures included.

Machine: M4 Max, Chrome / Metal 3. **This GPU was shared** with other lanes' pages for the whole session (ioreg 'Device Utilization' 25–90 % while this
page idled), so every A/B below is INTERLEAVED with a rotating start and passed through a post-hoc contention filter (§0): a round is kept only when every
variant sits within 5 % of its own quietest round, and the per-variant MINIMUM of the round medians is quoted beside the pooled median. Preset pinned by
URL (`?quality=high`: 1368×770 internal → 1777×1000). "union" = `timer.unionMs()` over the compute passes; per-pass numbers snap to the timer's ~0.065 ms quantum.

## 0. Instruments (how every number below was made)

* `tools/qa/smoke-lab.js` → `__sl` (boot `?paused&quality=high&mute&pfire`, `await import('/qa/smoke-lab.js'); await __slReady; await __sl.boot()`):
  * `__sl.scene(name, {dev, live})` — seeded dice, `restartEncounter`, the shift parked with torches out, Sam parked invisible, AI off, the camera pinned on
    the desk pod (fire-scenes 'dtop' = the game's framing) or a wider framing; canisters / fires lit at fixed spots ≥ 4 m apart so each takes its own coarse
    3.5 m domain; `dev` seconds of game steps grow the plumes; then `smoke.params.frozen = true` (the solver holds AND still renders — render-side A/Bs
    compare the same voxels) unless `live`. Scenes: **S0** nothing · **S1** one canister · **S2** one fire · **S3** three fires · **K3** three canisters ·
    **S6** 3 fires + 3 canisters (wide) · **K8** eight canisters (wide) · **S8** 3 fires + 5 canisters · **S1off / S3off** the same plumes with the camera on the lobby.
  * `__sl.frames / take / ab / aa` — serialized still renders (engine.render + onSubmittedWorkDone + a MessageChannel yield) or game steps; `ab(apply, variants)`
    interleaves K variants round-robin and applies the contention filter above; `refUnion` pins a known-quiet floor for the reference.
  * `__sl.profile()` — the pass table under: as is · smoke shadows off (frame flag 64) · smoke render off (flag 8) · both · `numSmoke` forced 0 (domains live,
    the renderer told there are none) → per pass what the SHADOW-RAY TRANSMITTANCE costs (ref − noShadow), the MARCH + froxel J (ref − noRender), the plumes'
    mere PRESENCE (both − noSmoke: every consumer's per-ray domain loop with nothing to sample).
  * `__sl.counters()` — the direct pass's smoke counters (a `TRACE_VARIANT & 32` build of common.wgsl: per invocation smokeTransmittance calls / calls that
    marched / density evaluations / atlas fetches, written raw into S0 under debug view 12 and read back from the rgba16f texture) + a heat PNG.
  * `__sl.exact()` — `src/render/shaders/smoke_lab.wgsl`: N random shadow segments in and around the live domains through main's `smokeTransmittance`
    (a verbatim copy in the kernel) and through the function now compiled → bitwise mismatch counters + the first offenders. `__sl.lodError(lod, steps)` = the
    same kernel comparing the prefiltered / fewer-sample estimator against the reference → mean / max |ΔT|, bias.
  * `__sl.subBoxes()` (lab stand-in for the solver's box words), `__sl.use(v)` = `__hotCommon(disk common, TRACE_VARIANT v)`, `__sl.png / crop / save`.
* Views: `top` { look (22.3, 0.5, 14.1), yaw 60°, pitch 52°, dist 8.5 } · `wide` { (22.5, 0.5, 14.5), 60°, 55°, 12.5 } · `lobby`.

## 1. Profile — where does a plume's time go?

### 1a. By switch (frozen field = no solver; high 1368×770; MIN of round medians, 6 × 20 frames interleaved; docs/perf/smoke-profile-*.json)

| scene | domains | union ref → no smoke | **direct: shadow-ray T** | froxel J | march | presence (AABB loops, nothing sampled) |
|---|---|---|---|---|---|---|
| S1 one canister | 1 | 12.12 → 11.21 (0.92) | **0.59** (4.46 → 3.87) | 0.13 | 0.20 | 0.00 |
| K3 three canisters | 3 | 12.39 → 11.14 (1.25) | **0.85** (4.72 → 3.87) | 0.13 | 0.20 | 0.07 |
| S3 three fires (+6 lights) | 3 | 16.71 → 14.55 (2.16) | **1.70** (7.67 → 5.96) | 0.20 | 0.20 | 0.00 |
| K8 eight canisters (wide) | 8 | 13.50 → 11.27 (2.23) | **1.90** (5.83 → 3.93) | 0.13 | 0.20 | 0.00 |

Gather, cascades, reflections, particles: 0.00 in every scene — gather rays do not attenuate through smoke (only the bounce-card subtraction and the glints do),
the cascades never read it. The froxel J and the march are flat and small. **The render-side cost of smoke is the direct pass's shadow-ray transmittance**,
0.6 ms for one plume → 1.9 ms for eight, and (S3) it doubles when the plume comes with lights of its own: the fire's two point lights sit INSIDE its box, so
every one of their rays crosses it, and they double the pod's ray count (4.2 rays/px vs 2.2 — both emitter classes go live). The fires' own +2.1 ms of direct
(5.96 vs 3.87 with smoke shadows off) is the LIGHTS' (fresh candidates walking cluttered pods to two strong low emitters), not the smoke's — noted, not this lane's.

### 1b. The solver (live field; K3, three coarse domains all at full rate, a mature plume: 97 % of bricks active — brick-skip idle)

* smoke pass 1.51 ms / 3 = **0.50 ms per domain step** at high (`fullRateDomains` 6 → up to 3 ms a frame with six busy plumes + the seventh / eighth at half rate).
* pressure pairs sweep (rbIters 1 / 2 / 4 / 8 → smoke 1.11 / 1.18 / 1.44 / 2.03): **0.044 ms per red/black pair per domain**; the 4 shipped pairs = 0.18 ms =
  35 % of the step; everything else (advection ×2 incl. MacCormack, curl, forces, divergence, project, occupancy ×2, render occupancy ×2, inject) = 0.33 ms.
* brickSkip on/off: 0.00 here (a mature canister fills its box; the skip pays on young / small plumes only, as designed).

### 1c. Per ray (the counters, S1 / K3 / S3 / K8; 1368×770)

| scene | rays/px | T calls per ray | **calls that MARCH** | pixels with a marched call | density evals per marched call | atlas fetches per eval |
|---|---|---|---|---|---|---|
| S1 | 2.24 | 0.80 | **87.9 %** | 78 % | 8.0 | 0.75 |
| K3 | 2.24 | 0.80 | 90.6 % | 80 % | 7.9 | 0.76 |
| S3 | 4.22 | 0.83 | 98.1 % | 88 % | 7.9 | 0.48 |
| K8 | 2.32 | 0.79 | 95.8 % | 84 % | 7.4 (of 8 × up to 8 boxes tested) | 0.62 |

Reading: 80 % of shadow rays come back lit and ask for the transmittance; **nine in ten of those cross a domain BOX** — a coarse domain is a 3.5 m cube
standing floor to ceiling in the middle of the pod, between most receivers and the ceiling panels — so nearly every lit ray in the room marches 8 samples,
10 M trilinear rgba16f fetches a frame for ONE canister (heat map docs/shots/ab/sl_S1_heat.png: the whole pod is 'marched'). The occupancy brick-skip
spares only 25–50 % of the fetches (a grown plume occupies half its box and the shell rule is generous). With eight boxes live, every sample also tests all
eight boxes (7.4 evals but 64 box tests per marched call): the per-sample domain loop, not the fetch, is what K8 pays over K3.

**So, ranked by the profile:** (1) the direct pass's transmittance — first the per-sample all-domains loop (exact fix), then the fetches themselves
(10–14 M/frame: fewer, or cheaper); (2) the solver's 0.5 ms per busy domain (rate, pressure pairs, dispatch count); (3) froxel J / the march — small, last.
The tile-level 'presence' gate the brief proposed (T2) has nothing to win: presence costs 0.00–0.07.

## 2. Hypotheses, in the order the profile put them

(each: hypothesis · change · numbers · exact? · verdict)

### 2.1 T1 — visit only the domains the segment can take density from · **EXACT** · **THE exact win**
`smokeSegment()` (common.wgsl): the hull [tEnter, tExit] over the full boxes exactly as before (the eight-sample lattice must not move), plus a per-ray
MASK of the domains whose OCCUPIED-brick box the segment meets (T1a = crossed boxes; T1b = the solver's `renderOccPack` now also writes, behind the 16
occupancy words of each domain and in the same dispatch, the box of its set bricks — `smokeSubWord`, flat words 128‥135 of the occ buffer, 512 → 544 B);
`smokeDensityLod(p, mask, 0)` walks the mask instead of `for i < numSmoke`. A domain left out contributes exactly +0 at every sample (smokeMayHold's own
argument), and +0 added to a non-negative sum is the identity, so the result is the old one to the bit.
* Exactness: `__sl.exact()` — **12.6 M random segments (S1, 30.6 % through smoke): 0 bitwise mismatches**; K3 / K8 (multi-domain, where the mask
  actually drops boxes): see §2.1b below.
* Cost (variants A, docs/perf/smoke-variantsA-*.json; direct pass, min of 5 × 20 interleaved rounds; TRACE_VARIANT 1 = mask, 3 = + sub-box):
  **K8 5.83 → 4.65 ms (−1.18, −20 % of the pass, union −8.2 %)** · S3 7.67 → 6.95 (−0.72) · S1 4.46 → 4.5 (0: one box, nothing to drop). The sub-box on top:
  ±0.06 (a grown canister's set bricks span 66–88 % of its box; it pays on young plumes, puffs and the fire's narrower column — kept: exact and free).
* What is left after it (vs the stub that returns 1): K8 0.8 ms, S3 1.1 ms, S1 0.3–0.4 ms = the samples themselves → §2.3.

### 2.2 T2 — restir's per-tile × per-light 'no segment of this tile can meet smoke' gate · exact by construction · **NEGATIVE**
Lane lidx of the tile-cull block ORs a smoky bit for light lidx when the box (tile receivers ∪ emitter disk) overlaps a live occupied box; each queued ray
sets `smkGate` from it. K8 4.72 → 4.78 (+0.06), S3 6.95 → 7.08 (+0.13), S1 0. The presence cost it removes is 0.00–0.07 (§1a) and in these views 84–88 %
of pixels have a smoky light anyway; the per-tile box tests and the extra live register cost more than they save. Not kept (the lab's TRACE_VARIANT & 4 remains
in restir.wgsl as the record until the port).

### 2.1b Exactness of T1 across domain counts (`__sl.exact`, the solver's own box words, frozen fields)
S1 (1 domain) 12.6 M segments, 49.5 % through smoke: **0 mismatches** · S3 (3) 12.6 M, 38.0 %: **0** · K8 (8) 12.6 M, 62.2 %: **0**. 50 M segments, bit-exact —
which also proves the GPU-side box words right (a box drawn too small would drop density some segment sees).

### 2.3 A3 — the PREFILTERED occluder: shadow rays read a mip of the field · bounded · **NEGATIVE for cost** (kept as a knob: it is the accurate way to take fewer samples)
Hypothesis: eight point samples ~40 cm apart of a field made at 5.5 cm alias it; the same eight of its 2- / 4-cell box means integrate it, from a slab that lives
in cache (16³ × 8 domains × 8 B = 256 KB at mip 2) where the 64³ one streams (32 MB). densA now carries mips 1 and 2 (`mipDown`, two tiny dispatches after
injectDecay ≈ +0.02 ms a domain step); `settings.smokeShadowLod` 0 / 1 / 2 (frame.volCfg.w) picks what SHADOW rays read — the direct pass, gather / reflection
/ card / probe-meter hits, the froxel haze's dimming beyond a plume; the plume you look at (the march), the froxel J's self-shadow taps and the guards' sight-line
probe stay on the field itself; `smokeShadowSteps` (8) is the sample count.
* Cost (docs/perf/smoke-lod-*.json; direct, min of 5 × 20 interleaved rounds, T1 on): **K8 L0/8 4.65 · L1/8 4.59 · L2/8 4.59** · L1/6 4.52 · L2/6 4.46 · L2/4 4.33;
  S3 7.01 · 6.95 · 6.95 · 6.75 · 6.75 · 6.49; S1 4.33 · 4.26 · 4.26 · 4.13 · 4.13 · 4.06. **The mip buys nothing (±0.06): the fetch was never the cost** — a tile's
  rays are coherent and the texture cache holds their footprint; what a marched call pays is eight dependent branch chains a lane (bounds test → brick word → fetch).
  Only FEWER samples pay: −0.2 (6) / −0.3‥0.5 ms (4). Corroboration: the lossless brick skip switched OFF (every sample fetches) is 0.13 ms FASTER on the direct
  pass in K8 (docs/perf/smoke-rskip-K8.json) — the test costs more than the fetch it saves, for shadow rays.
* Error (`__sl.lodError`, 3.5–5.2 M smoky segments toward the lights / into the boxes, vs lod 0 / 8 samples): mean |ΔT| 0.001–0.005 everywhere, but a BIAS:
  lod 1 −0.009‥−0.015, lod 2 −0.027‥−0.043 (darker: a box mean spreads density into the empty cells beside the plume skin, and e^−τ is convex); 4 samples at lod 0
  +0.06‥+0.09 (BRIGHTER: a noisier τ̂ under a convex e^−τ̂); **4 samples at lod 2: −0.002 (K8) / +0.034 (S3) / −0.025 (S1)** — the two biases roughly cancel, so
  if fewer samples are ever wanted, lod 2 is the honest way to take them. Verdict: no cost case for the mips on this GPU; `smokeShadowLod` / `Steps` stay as
  A/B knobs at 0 / 8 (the two mip dispatches cost a fiftieth of a domain step; drop them on port if the knob goes).

### 2.6 T4 — the single-domain BRANCH-FREE sample loop · meant exact · **NEGATIVE (slower, and last-bit different)**
Hypothesis after §2.3: the marched call pays for control flow, so when the mask holds one domain read its record once and take the eight samples with no branch (a
sample outside the box weighted 0 instead of skipped, no brick test), eight independent fetches in flight per lane. Measured (docs/perf/smoke-fast-*.json, min of
5 × 20): **K8 direct 4.78 → 4.92 (+0.14), S3 6.95 → 7.14 (+0.2), S1 4.39 = 4.39** — SLOWER: without the brick test the fetch count rises from 0.62 to 0.95 per
evaluation (12.9 M vs 8.5 M in K8) and those fetches are not free after all; §2.3's 'the fetch costs nothing' only held for the same fetches from a smaller texture.
(So the honest reading of §2.3 + §2.6: the loop is LATENCY-bound on its dependent chain, and both the brick word and the fetch sit on it.) And not bit-exact: 12–83 k
of 12.6 M segments differ, max |ΔT| 4.6–9.6e-3 — the same eight points, but the Metal compiler treats the divisor differently in the branch-free loop (the loop-
invariant box extent becomes a reciprocal multiply, the coordinate moves an ulp, and at a plume's skin an ulp of coordinate is 1e-3 of density); putting the brick test
back as a weight changed nothing (variant 512), so it is arithmetic, not skipped fetches. Reverted; the masked loop of §2.1 stays.

### 2.4 F1 — the froxel cull's per-cluster × per-light smoke gate · exact · **NIL** (volFroxel 0.59–0.66 either way; the haze's transmittance calls are not where its 0.13 goes — injectJ is)

### 2.5 four samples instead of eight (TRACE_VARIANT & 8) · bounded · K8 −0.26 on top of T1, S3 −0.33, S1 −0.2 — folded into `smokeShadowSteps` and measured with the lod in §3

## 3. The solver's variants (live fields, game steps; K3 = three coarse domains)

### 3.1 D2 — CALM domains step less often · bounded (sub-voxel by construction) · **THE solver win for the aftermath**
`params.calmCells` (smoke.ts): every live domain now has a PERIOD p — near domains 1, far ones 2 exactly as the Phase 0 cap had it, and a domain nothing is emitting or
pushing into gets p = clamp(⌊calmCells ÷ (cells its fastest VISIBLE parcel crosses a frame)⌋, 1, 4), stepping on its own phase of p (staggered by rank) with the dt it sat
out added on (one SimParams copy per distinct step dt; emitters aged by their own domain's dt as before). 'Visible': `dilate` now also reduces vmax over the bricks
that HOLD density (brick stats word 5 → `bricks.vmaxS`) — the first cut used the domain-wide vmax and never calmed: vorticity confinement stirs the emptying box to
1.5–7 m/s where there is nothing left to see, and a supply vent's jet keeps the air under it at its face speed. With calmCells 0 the schedule is the old one
statement for statement (p ∈ {1, 2}: step unless far, stepped last frame, odd phase).
* What it does (K3, canisters of 6 s, calmCells 0.5): t 8–12 s (plumes still climbing at 1–2.5 m/s) p 1 everywhere; from t ≈ 17 s p 2–4 with 2 of 3 domains sitting
  out most frames; the odd frame a domain reads p 1 again when its skin surges (vS 1.5–5 for a step). By construction the smoke you see never moves more than
  calmCells voxels between two steps you see (½ × 5.5 cm), whatever p.
* Cost (docs/perf/smoke-solver-2.json, hanging plumes t 20–58 s, min of 4 × 20 interleaved): **smoke pass 1.25 → 0.79 ms (calmCells 0.5, −37 %) → 0.46 (1.0, −63 %)**;
  union 13.70 → 13.04 / 13.11. Nothing while the sources run (p 1) — the ACTIVE canister / fire keeps its full price; the aftermath (a plume hangs ~40 s after its
  canister's 32 s) and hanging dust are what get cheaper. Default 0 per the brief (bounded); recommended 0.5.

### 3.2 D10 — dispatch count / kernel fusion / batching all domains into one dispatch per kernel · **NEGATIVE (no overhead to remove)**
The probe that seemed to say otherwise: 16 / 32 extra `dilate` dispatches a step cost 17.7 µs each — but an EMPTY kernel (`nop`, params.extraDispatches) costs
**1.0 µs a dispatch** (docs/perf/smoke-solver-nop.json: +64 × 3 dispatches = +0.20 ms). So a step's 19 dispatches carry ~20 µs of fixed cost in 500; `dilate` and
`renderOccPack` are simply single-workgroup kernels paying their own latency (~17 µs each, 7 % of the step between them). Batching the domains or fusing kernels
would save nothing worth their risk. Not built.

### 3.3 D3 — fewer pressure pairs · bounded · not pursued
0.044 ms a pair a domain (§1b): 4 → 2 would take 18 % off a busy domain's step, but the solver's own notes (smoke.ts `pressureHalfSmooth`) record what under-projection
does to this plume — grid-scale divergence piling up, +40 % mass in a 90 s soak — and a busy domain is exactly where it shows. Left at 4; a calm domain already steps a
quarter as often.

## 4. Fidelity of the one bounded render knob left: the shadow rays' sample count (`settings.smokeShadowSteps`, default 8)

S1 frozen, 48 still renders per setting (histories converged), the whole 1777×1000 LDR frame against the 8-sample frame; a second and third 8-sample capture
taken the same way are the noise floor (docs/perf/smoke-steps-fidelity-S1.json; stills docs/shots/ab/sp_S1_L0S{8,8b,8c,6,4}.png; crops ×3 docs/shots/sp_S1_{deskL,floorR,floorS}_*.jpg):

| vs 8 samples | mean abs diff (255) | px > 2 | px > 8 | deskL tile mean (ref 119.3) / max abs | floorR (61.8) | floorS (63.6) |
|---|---|---|---|---|---|---|
| 8 again (floor) | 0.22 / 0.26 | 2.4–2.8 k | 56–67 | −0.03 / 8 | +0.01 / 4 | −0.03 / 3 |
| **6 samples** (−0.13‥0.26 ms) | 0.67 | 100 k | 9.3 k | −1.5 (−1.3 %) / 10 | +0.6 / 15 | −0.1 / 6 |
| **4 samples** (−0.3‥0.5 ms) | 1.17 | 201 k | 47.7 k | −4.0 (−3.4 %) / **34** | +2.2 / 29 | −3.6 (−5.7 %) / 20 |

Four samples put BLOTCHES in the plume's shadow on the desk and floor (the shadow's structure resolved at half the rate along the ray: dark patches a hand
across where eight samples grade smoothly — deskL crop, fourth panel) and shift tile means 3–6 %: not fidelity-preserving. Six is a third of that and hard to find
in the crops, for a tenth of a millisecond. **Verdict: 8 stays; the knob is there for a tier that wants the 0.3 ms more than the plume's shadow.** (The lab kernel
had predicted the sign: fewer point samples of an aliased field bias e^−τ̂ BRIGHT by +0.06–0.09 in mean transmittance; the prefiltered mip that would have
cancelled it bought no time, §2.3.)

## 5. The scaling curve (LIVE: game steps, the solver counts; `__sl.curve`, docs/perf/smoke-curve-*.json; the page draws them)

Configs: **before** = main's transmittance verbatim (TRACE_VARIANT 256) + the schedule as it was · **exact** = T1 alone (what ships on) · **after** = T1 + calmCells 0.5.
Canisters at fixed spots ≥ 4 m apart from the WIDE framing for every N (each its own coarse domain; high steps 6 at full rate, the 7th / 8th at half); union = min over 3
interleaved rounds of the round medians (before ↔ exact is a hot swap of every tracing pipeline per block).

### 5a. high 1368×770 — N canisters ACTIVE (8 s in, every source running: the calm rule has nothing to do)

| N | before ∪ / direct / smoke | exact | after |
|---|---|---|---|
| 0 | 11.73 / 4.00 / 0 | 11.73 / 3.93 | 11.80 / 3.93 |
| 1 | 12.98 / 4.52 / 0.46 | 12.91 / 4.39 | 12.78 / 4.46 |
| 2 | 13.63 / 4.72 / 0.85 | 13.30 / 4.52 | 13.30 / 4.46 |
| 3 | 14.16 / 4.85 / 1.18 | 13.76 / 4.46 | 13.63 / 4.46 |
| 4 | 14.94 / 5.11 / 1.57 | 14.42 / 4.65 | 14.35 / 4.59 |
| 6 | 16.19 / 5.57 / 2.36 | 15.34 / 4.78 | 15.34 / 4.78 |
| 8 | 17.04 / 5.90 / 2.88 | **15.79 / 4.78** | 15.79 / 4.78 |

Reading: before, a busy canister costs +0.66 ms of union; after, +0.51 — and **the direct pass is now FLAT in N** (4.39 → 4.78 from one domain to eight, was 4.52 → 5.90):
T1 made the transmittance O(rays that cross smoke) instead of O(rays × live boxes). What still grows per domain is the solver (0.36 a busy domain a frame at high's 6-full-
rate cap), the march and the froxel J. **At the 14 ms bar in this view: 3 active canisters fit (13.63–13.76) where 2 did (3 was 14.16); eight cost 15.8 instead of 17.0.**

### 5b. high — N plumes HANGING (canisters of 10 s, measured 12–30 s after they end: the aftermath, where D2 works)

| N | before | exact | after (calm 0.5) |
|---|---|---|---|
| 1 | 13.63 / 4.85 / 0.46 | 13.37 / 4.72 / 0.46 | 13.44 / 4.72 / 0.46 |
| 2 | 14.22 / 5.05 / 0.85 | 13.89 / 4.72 / 0.85 | 13.83 / 4.78 / 0.85 |
| 3 | 15.01 / 5.24 / 1.25 | 14.48 / 4.85 / 1.18 | **13.89** / 4.85 / 0.52 |
| 4 | 15.27 / 5.31 / 1.57 | 14.88 / 4.85 / 1.57 | 14.22 / 4.85 / 0.85 |
| 6 | 16.12 / 5.57 / 2.23 | 15.47 / 4.85 / 2.23 | **14.22** / 4.85 / 1.18 |
| 8 | 16.97 / 5.96 / 2.62 | 15.99 / 4.85 / 2.69 | **14.81** / 4.92 / 1.57 |

A hanging plume is DEARER than a busy one on the render side (+0.8 direct for one domain vs +0.5: spread wide, it fills its box and every sample fetches) — the aftermath is
the expensive state, and it lasts ~40 s a canister. **Before: 1 hanging plume fits 14 ms (2 = 14.2); after: 3–4 (13.9 / 14.2), and six cost 14.2 where they cost 16.1;
eight 14.8 vs 17.0 (−2.2 ms).** The two spots that never calm at N = 1–2 (K1, K2) stand in the aisle diffuser's wall jet: smoke that a vent keeps moving keeps its rate,
which is the rule working, not failing.

### 5c. high — N FIRES active (then + canisters; every fire = a domain + 2 flickering point lights)

| N | domains | before | exact | after |
|---|---|---|---|---|
| 1 fire | 1 | 15.47 / 6.23 / 0.46 | 15.20 / 6.03 | 15.34 / 6.09 |
| 2 fires | 2 | 18.29 / 7.80 / 0.85 | 17.43 / 7.14 | 17.56 / 7.27 |
| 3 fires | 3 | 19.14 / 8.19 / 1.18 | 18.48 / 7.54 | 18.35 / 7.54 |
| 3 + 1 can | 4 | 20.12 / 8.65 / 1.57 | 19.07 / 7.73 | 19.07 / 7.60 |
| 3 + 2 cans | 5 | 21.17 / 9.18 / 2.03 | 19.33 / 7.60 | 19.66 / 7.67 |

−0.3 (one fire) to −1.8 ms (five domains); but a fire is +3.5 ms of union in this framing and ~2 of it is its LIGHTS (direct 6.0 with one fire vs 4.4 with one canister):
no fire count fits 14 ms at high from the game's framing, before or after. That is the fire lane's light budget (one light per fire, a tighter range / reach), not smoke.

### 5d. medium 1072×603 (fullRateDomains 4) — N canisters ACTIVE / HANGING

| N | active: before | exact | after | hanging: before | exact | after |
|---|---|---|---|---|---|---|
| 0 | 8.00 / 2.42 / 0 | 8.00 / 2.36 | 7.93 | 8.06 | 8.00 | 8.00 |
| 1 | 8.85 / 2.75 / 0.39 | 8.78 / 2.69 | 8.78 | 8.98 / 2.75 / 0.39 | 8.91 | 8.91 |
| 2 | 9.37 / 2.88 / 0.72 | 9.24 / 2.69 | 9.18 | | | |
| 3 | 9.83 / 2.95 / 1.05 | 9.57 / 2.75 | 9.57 | 9.83 / 3.02 / 1.05 | 9.63 | 9.24 (smoke 0.72) |
| 4 | 10.36 / 3.15 / 1.38 | 9.96 / 2.82 | 10.09 | | | |
| 6 | 11.14 / 3.41 / 1.77 | 10.62 / 2.88 | 10.55 | 11.08 / 3.41 / 1.70 | 10.62 | 10.42 |
| 8 | 11.60 / 3.60 / 2.16 | **10.88 / 2.88** | 10.88 | 11.60 / 3.60 / 1.97 | 10.88 | **10.68** (smoke 1.70) |

The same shape a tier down: direct 3.60 → 2.88 at eight (−20 %), flat from N = 2; the calm rule buys less here because medium already steps only 4 domains at full rate and
the plumes at t 22–30 s under the vents had not all calmed. Everything at medium sits under 11 ms with eight plumes either way — the 14 ms question is a high-tier one.

## 6. Conclusions

1. **The direct pass's transmittance was O(lit rays × live boxes); it is now O(lit rays that cross smoke)** (T1, exact, on). What is left of it — 0.3 ms a plume the
   rays actually cross, ~0.8 with eight — is the eight samples themselves, and both attempts to make a sample cheaper (mips, branch-free) failed on this GPU: only
   fewer samples pay, and fewer samples show. The next exact step there is not in the sampler but in the ray budget (a plume-shadowed pixel converges like any other
   soft shadow; nothing smoke-specific).
2. **The solver is the per-domain cost that remains** (0.36–0.5 ms a busy domain a frame): the calm rule takes the aftermath (the longer, and render-side dearer,
   state) down to a quarter; a BUSY canister keeps its price, and the honest levers left there are the tier caps that exist (fullRateDomains) and the pressure pairs
   the solver's soak advises against.
3. **Fires** are a light-budget problem, not a smoke one: −0.3‥1.8 ms from this lane, +2 ms of lights per fire untouched.

## 7. Port list for main (main has no fire prototype; none of this touches it) — hunks

* **T1 (exact) — `src/render/shaders/common.wgsl`**: binding 11 `smokeOcc: array<vec4u, 34>` (+ comment); after `SMOKE_BRICK`: `smokeSubWord / smokeSubLo / smokeSubHi`,
  `struct SmokeSpan` + `smokeSegment`, `smokeDensityLod` (lod may be dropped to a constant 0), `smokeShadowLod / smokeShadowSteps`, `smokeTransmittanceLod`, and
  `smokeTransmittance` as the one-liner over it (drop the `SMK_*` consts, the four `smk*` counters, `smokeDensityAtRef / smokeTransmittanceRef` unless the lab comes too;
  `smokeDensityAt` stays as it is for the march / self-shadow / probe). **`vol_common.wgsl`**: `smokeTransIn` / `smokeTransCoarse` → one-liners over `smokeTransmittanceLod`
  (lod 0 · 8 samples / the frame's lod · 5). **`src/smoke/smoke.wgsl`**: `renderOccPack`'s `wgOccLo / wgOccHi` reduction + the box word write at `renderOcc[OCC_WORDS*8 + dom.index]`.
  **`src/smoke/smoke.ts`**: `OCC_BUFFER_BYTES` (544) for `occBuf`. **`src/engine.ts`**: the no-smoke stand-in occ buffer 544 B; `smokeShadowSteps` setting + `volCfg.w = steps << 2`.
  **`src/render/frame.ts`**: nothing (volCfg.w was spare). Run `tools/qa/frame-layout.ts` (no offsets moved).
* **D2 (bounded knob) — `src/smoke/smoke.ts`**: `SmokeParams.calmCells` (+ `extraDispatches` only if the probe is wanted) and defaults; `DT_CAP / MAX_PERIOD`; `Domain.since /
  owed / period` + `bricks.vmaxS` (+ both initialisers); `writeSimParams(dt, stepDt) → offsets` (simParamBuf `× (MAX_DOMAINS + 1)`); the period scheduler block in `encode()`
  (replaces the `sitting` set; calmCells 0 ≡ the old schedule) + the `stepDt` uses below it; the `vmaxS` readback in `afterSubmit`. **`smoke.wgsl`**: `dilate`'s `wgDilSpeedS` +
  `brickStats[s + 5]`; the `nop` kernel only with the probe. **`src/ui/bindings.ts`**: the two Smoke rows + the status line. A soak invariant worth adding on port: no live
  domain goes more than 4 frames unstepped; and `probes.ts perf`'s smoke lines should read `period` where they read `skipped`.
* **The lab** — `tools/qa/smoke-lab.js`, `src/render/shaders/smoke_lab.wgsl`, `tools/qa/smoke-page.py`, this notebook, docs/perf/smoke-*.json, docs/review/smoke-perf.html,
  docs/shots/sp_* + docs/shots/ab/sl_*_heat.png; restir.wgsl's two `SMK_COUNT` lines and common's `SMK_COUNT / SMK_STUB / SMK_REF` block if the counters / 'before' are to keep working.
* **Not to port**: froxel.wgsl (F1 reverted — the file is main's), the mips (`mipDown`, `densMip`, `smokeShadowLod`), restir's tile gate.

## 8. The port's own proofs (main @ 2005ebf + the two port commits d1ec81e / 0cb0e9f; M4 Max, Chrome/Metal, high 1368×770; the GPU shared with other lanes' pages throughout — every A/B interleaved, min of round medians)

* **T1 is bit-exact on the port.** `__sl.exact()` (the lab kernel: main's pre-port `smokeTransmittance` verbatim vs `smokeTransmittanceN` at 8 samples, random segments between
  points of the grown hull / toward the frame's lights / into the domain boxes, frozen fields): **S1 12.6 M segments (43.5 % through smoke), K3 18.9 M (53.8 %), K8 18.9 M (60.0 %) →
  0 bitwise mismatches** — 50.4 M in all. `__sl.boxWords()`: every live domain's GPU box word agrees with the box its own occupancy bits imply (a grown canister's set bricks span
  75–88 % of its box; a young one 27 %). AND END TO END: the same seeded S1 / K3 stagings booted on the pre-port build (a detached worktree of 2005ebf served beside) and on the port
  with `calmCells 0` render **hash-identical frames** — final composite, direct-only, indirect-only, volumetrics, specular, RT, dice and albedo views, 22 paired captures over
  frames 640‥1480 (the very first capture after staging differed by 1 LSB in 2 pixels of 1.78 M on both scenes' first try and never again: an unconverged-history last bit, not the walk —
  the direct-only view was identical from the first capture).
* **T1's cost, before ↔ after on the port** (`__sl.abPort()`: `before` = the pre-port transmittance rebuilt into every tracing pipeline through `__hotCommon` from the lab kernel's REF
  block, `exact` = the port at calmCells 0; frozen plumes, still renders, 8 rounds × 20 frames; docs/perf/smoke-port-cost-{S1,K3,K8}.json):

  | scene | direct before → after | union before → after | rounds kept |
  |---|---|---|---|
  | S1 one canister | 4.33 → 4.26 (−0.07) | 11.73 → 11.73 (0) | 8/8 |
  | K3 three canisters | 4.65 → 4.33 (−0.33) | 12.26 → 11.86 (−0.39) | 5/8 |
  | K8 eight canisters, wide | 5.70 → 4.65 (**−1.05**) | 13.30 → 12.26 (**−1.05, −8 %**) | 8/8 |

  — the branch's shape (§2.1: K8 −1.18, one box 0; its "3" was three FIRES with lights inside the boxes, −0.72; three canisters read −0.39 on its curve too). Every other pass 0.00.
* **D2 on the port** (docs/perf/smoke-port-d2-K3.json; K3 = three 10-s canisters, staged 2 s after they end, LIVE game steps; each pair = two fresh boots differing only in
  `calmCells`, so both start from the same field — the frames are hash-identical at T = 2 s, before the schedule first diverges): from T ≈ 4 s one or two of the three domains sit
  at p 2 most frames (3–4 later; the domain standing in the aisle diffuser's wall jet reads vmaxS 5–11 m/s and keeps p 1 — the rule working), **the sim pass 1.18–1.25 → 0.79–0.85 ms
  (−33 %), union ≈ −0.5 ms**. LOOK: whole-frame diff calm ½ vs 0 at the same game frame — T 4 / 6 / 8 / 10 s: mean 0.03 / 0.19 / 0.39 / 0.50 of 255, max 2 / 4 / 5 / 7, **0 pixels
  > 8**, tile means within ±0.4 (crops ×3, calm 0 left / ½ right: docs/shots/sp_port_d2_{edge,core,aisle}_t{2,6,10,14,20}.jpg) — invisible for the first ~8 s of divergent
  stepping. By T 14 (16 s hanging) the two plumes have decorrelated the way two seeds would: mean 3.9, max 46, the thin veil over the back desk hangs elsewhere (edge tile 99 → 85,
  core 50 → 38, aisle / desk +3) — but it is a different realisation, not a degraded one: per-domain MASS agrees within ±5 % to T 14 (628/420/704 vs 645/451/726) and drifts both
  ways after (T 20: 140/108/174 vs 105/128/202), the bricks holding density match to a few (382/334/373 vs 373/336/374). What a still cannot show is motion: the bound is ≤ ½ voxel
  (2.75 cm ≈ 6 px at this framing) per visible step of an edge tens of pixels soft — the thing to eyeball on the live page, Tab ▸ Smoke ▸ CALM 0 ↔ ½.
* **Validation:** ultra / high / medium / low / verylow cycled with three live plumes, `smokeShadowSteps` 8 / 4 / 12 and `calmCells` 0 / 1 / ½ under each: 0 uncaptured GPU errors,
  0 console errors; 103 / 103 boot pipelines. The guards' smoke SIGHT is untouched by construction — the probe's segment query is `probe.wgsl`'s own 24-tap march through
  `smokeDensityAt`, which the port does not edit; their light METER's per-light transmittance is `smokeTransmittance` = the exact function above (headless probes have no GPU
  smoke: `gate.sh perf destruction particles wind glass` green, `probes.ts glass player`, tour 3/3).
