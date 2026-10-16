# Render fixes — the review ledger's PARKED render items (lane fix/render-parked)

## WHERE I AM / NEXT (resume block — keep current)
- worktree `.worktrees/rfix`, branch `fix/render-parked` from main @ efbe557; dev server :5246 (own), shot sink :5247, headless Chrome over CDP (`tools/qa/cdp.ts`).
- ORDER: R10.1 (rc prewarm / parked invalidation) → R1.1 (rt targets idle-release) → R1.3 (texpool keys) → R1.4 (per-frame allocs) → R2.1+R10.3
  (decals buffer vec4u) → R2.7 (resetClocks parity) → R2.8 (froxel history on camera cut) → R2.9 (denoise sky early-out) → R2.2 (transient tail range).
- DONE: R10.1 5ee2ca3 · R1.3 84f5893 · R1.1 17bda70 · R1.4 92d2177 · R2.1+R10.3 f3590a4 · R2.7 03ddb59 · R2.2 69eebcf · R2.8 64461db · R2.9 left (verdict below)
- Identity (`rfix-proofs.ts identity`, main @73104ea served beside on :5248, ONE FRESH BOOT PER VIEW, 40 serialized frames, FNV of the offscreen readback): marks (corridor: 23 wall marks +
  3 scorches + 60 seeded marks + 3 crack stars) 150deecb = 150deecb · lot e4e463fa = e4e463fa · lobby/corridor lino 660543f1 = 660543f1 · strike (a lightning stroke ALIVE at hash
  time, transient 1, firstT 37/38) a53f09ce = a53f09ce · strikeIn 99756d9d = 99756d9d — main = lane with R1.4 + R2.1 + R2.7 + R2.2 in. marksLow DIFFERS (5b249684 vs 9a8a568e)
  and is EXPECTED to: low's cascade grid is rebuilt at boot (rebuildRc → invalidateWorld) and R10.1's in-frame boost changes that grid's first bakes; the DIRECT-only view of the
  same still hashes identical at low (ac0f7c4e = ac0f7c4e), so the difference is the bounce alone.
- VALIDATE (`rfix-proofs.ts validate`, all five presets, uncapturederror + validation / OOM scopes over 124 frames incl. a hop across grids and back, a resize, a daylight round trip, a
  stroke, a __resetClock, a 13 m cut and debug views 3/4/9/13): verylow / low / medium / high / ultra ALL PASS, 0 GPU / page errors. gate.sh perf 29 PASS / 0 FAIL; journal-fixtures
  identical; materials-frame PASS; bun run build clean.
- GHOST (R2.8, `rfix-proofs.ts ghost`): a 13 m cut lot → corridor gives IDENTICAL frame statistics on both builds (f1 mean |Δ| 2.738 … f8 1.824 vs f30) — reprojection already
  rejected all of the old frustum; the restart only bites on overlapping cuts (a turn in place), left unmeasured tonight.
- DONE / STOPPED: servers :5246 :5248 and the headless Chromes stopped at hand-back; branch fix/render-parked ready to merge.

## Method
- Every item = one commit with its own proof line here; typecheck before each; frame-layout when frame.ts / common.wgsl are touched.
- GPU-side proofs run in a PRIVATE headless Chrome (`--headless=new`, Metal) driven over CDP by `tools/qa/cdp.ts` against this worktree's server on :5246 —
  never the shared Browser pane. Identity = `__png` hash of the same call sequence from a fresh `?paused` boot per side (ONE CONFIG PER FRESH BOOT).

## Items

### R10.1 — parked / prewarmed cascade grids started 30 % blended and missed world invalidations (AI-visible: the light meter) — DONE
Fix (engine.ts prewarmRc / invalidateWorldCache, rc.ts encode → bake + BOOST_BAKES, lighting.ts setDaylight): a prewarmed grid is re-primed at construction (its zeros are no
history), `invalidateWorldCache()` re-primes the parked grids too, the daylight swap CALLS it (the one wholesale light-rig change in the game), and a re-primed cache under
`amortize` runs BOOST_BAKES 4 extra whole history-free bakes inside the invalidation frame — the cascades' hits read the previous bake's dice for the bounce, so a cache with
no history gains one bounce order per bake; one history-free bake alone left the field ~25 % short and the 0.3 EMA crawled the rest in over ~8 frames. Boot renders are
untouched (a CONSTRUCTED cache is not re-primed), so every identity hash at boot holds; only hop / rebuild / daylight frames change. Cost ≈ 4 × the cascades once per event.
Proof (`bun run tools/qa/rfix-proofs.ts r101|r101b <base>`, headless Chrome, high, Sam at (9, 0, 17) in the lobby + a fixed probe point (9.6, 1, 17.6), serialized frames,
meter read every frame; 'dip' = worst of frames 2–11 after the event vs the phase's steady median):
- first hop high → low onto the PREWARMED grid: main chest −17.1 % / point −26.0 % → lane −2.5 % / −6.0 % (inside the steady phases' own ±3–7 % jitter band).
- daylight swapped in while high's grid is parked (r101b): live grid night → day main −35 % / −26 % for 6+ frames → lane 3.2 % / 1.3 %; the PARKED grid swapped back
  in by day: main −24 % / −22 % → lane 8.4 % / 7.6 %; day → night on the live grid: main reads +247 % / +290 % (3.5× too bright, still +35 % sixteen frames on)
  → lane 2.9 % / 6.3 %.


### R1.1 — RT reflection targets never released once on — DONE 17bda70
`passes.setRt` mirrors `setGi`: RT_IDLE_FRAMES 600 with the pass off → rtEverOn / hitEverOn cleared, `reallocRefl` puts the 1×1 stand-ins back and the real set (refl + scratch +
hist / mom / fast pairs + the hit records) goes to the pool; the next `true` is a firstOn again (re-made zeroed). Proof (`rfix-proofs.ts pool`, 1600×900 css × dpr 2, boot high →
pin low → 630 frames → resize → pin high; `passes` / `pool` read live):
- high +10: refl 814×385, 2 histories · low +10: rt OFF but the set kept at low's grid 457×216 and the hop's resize resampled it ('… specular / reflections / taau') — the finding.
- low +630: `reflection targets let go: 2 pooled 1 new` → refl 1×1, 0 histories · a resize after that (×0.8) resamples 'direct / indirect / specular' only — no reflection set made or
  carried · pin high again: firstOn → 814×385 with 2 histories, 66 pooled 0 new. No page / GPU errors.

### R1.3 — texpool free-list keys accumulated — DONE 84f5893
`acquire` deletes a size key when it pops its last texture, `destroyHead` when it splices the last; `keyCount` / `parkedCount` exposed (and in `summary`). `probes.ts perf-texpool`
(family perf): a 24-size × 3-kind ladder walk over a fake device — 144 hits / 72 misses, keys ≡ non-empty lists after every acquire / release, through budget eviction (13 keys / 13
parked under a shrunk budget), ageing (0 / 0 / 0 B) and evict-all (0 keys, all 72 destroyed).

### R1.4 — per-frame allocations in the render loop — DONE 92d2177 (pure refactor; identity below)
Hoisted: `engine.ts glassLightMasks`' two array literals per light × pane (module consts `GLASS_STATIONS / GLASS_SIDES`), `frame.ts writeFrame / writeFrameOut`'s typed views (a
WeakMap per ArrayBuffer), `lights.ts upload`'s `new Uint8Array(data, 0, n·64)` (a standing Uint32 view, copied word for word — the same prevCount × 64 bytes as before), `passes.ts`
fxaa / post param arrays and the restir uniform's three views, `probe.ts`' count uniform. Left alone (not per frame, or not trivial): the realloc paths' `.map`s, `perLightHint`.

### R2.1 + R10.3 — the decal buffer typed `array<vec4f>` with integer words bitcast out of it — DONE f3590a4
`decalWgslConsts` declares `array<vec4u>`; decals.wgsl reads the cell / list words and each record's bits word as u32 directly and `bitcast<vec4f>` / `bitcast<vec3f>` the float
rows (pos+R, n+param, tangent). One declaration serves the g-buffer (group 1 binding 3) and the composite's glass path (binding 10). CPU writer untouched (bytes are bytes).

### R2.7 — resetClocks zeroed the ping-pong parities — DONE 03ddb59
Every parity in passes.ts is a symmetric flip-then-index pair (this frame reads [1 − p], writes [p]; verified for dParity / parity / taaParity / rParity / rtParity / giParity /
hitParity) whose value never reaches a shader, so zeroing bought no determinism (same call sequence ⇒ same parities) and cost the frame after a mid-run `__resetClock` its
histories (each client read the two-frames-old slot; the gather read last frame's moments from the wrong slot). `resetClocks()` now resets the grain seed only. At a `?paused`
boot no frame has rendered (frameIdx 0, every parity 0, checked over CDP), so every identity recipe that resets at boot is unaffected either way.

### R2.9 — denoise.wgsl sky pixels compute the 5×5 stats before their early-out — LEFT (documented)
Not a barrier hazard: `shTemporal` / `giTemporal`'s only `workgroupBarrier()` follows the cooperative 12×12 apron load and precedes every return, so an earlier sky return would be
legal. But the early-out branch (`depth ≥ 1 ∨ cap < 1 ∨ temporal off`) STORES the neighbourhood variance (`sA.lsig²`, `sB.lsig²`) and the packed depth | normal for the texel: under
'temporal off' / cap < 1 those are real surfaces whose à-trous needs that variance, and for true sky texels the stored moments / geometry are still read by neighbours' à-trous taps
and reprojection footprints along silhouettes — writing cheaper stand-ins there is not provably lossless without a capture study, and the saving (25 workgroup-memory taps × 2
classes for the sky's share of pixels, indoors ≈ none) did not justify one tonight.

### R2.2 — the gather's per-hit transient walk visited every light — DONE 69eebcf (exact)
`lights.upload` records `firstTransientSlot` (transients are appended as they are born, so they sit at the tail); engine writes it into the spare `frame.p5Cfg.w` (0 while
none is alive — a still's frame block byte for byte as before; `materials-frame` / `frame-layout` pass); `gather_common directAtPoint / directOnScreen` loop from
`min(p5Cfg.w, nL)` and still test `lightTransient` on every slot they visit → the same lights subtracted in the same order. Proof: the strike / strikeIn identity views hash a
frame 3 frames into a lightning stroke (transient 1, firstT 37 of 38 slots — the walk skips 37 loads per on-screen hit) IDENTICAL to main (a53f09ce, 99756d9d), and the stills match.
The froxels' transient loop already walks a culled bitmask; not touched.

### R2.8 — camera cut never restarted the froxel history — DONE 64461db
engine.render's cut rule (eye > 2.5 m or > 30° between renders — the one that drops the TAA history) now also calls `froxels.restartHistory()` (guarded off for the boot's own
first-frame cut, which has no history: boot captures untouched — the identity set above was re-run with it in… see the ghost numbers below).
