# P5 — the ultra-only extras: gather resampling, mesh hits in reflections, hit-lighting reuse (2026-08-11, lane `v3/p5-ultra`)

Brief: STATUS "RENDERER V3" Phase 5 — three additions that only the ultra preset switches on, each behind its own setting, every other tier byte for
byte as it was, ultra inside union p95 ≤ 30 ms in the stress minute. Machine / method as the earlier phase notes: M4 Max, Chrome (the Browser pane) /
Metal, dpr 2, this worktree on :5195 (shot sink :5187), `?paused&quality=ultra&mute` (2133×1200 internal = output at ultra), SERIALIZED frames (one
offscreen render → `queue.onSubmittedWorkDone()` → MessageChannel yields → the timer's per-pass stamps + `unionMs`), interleaved A/B (ABAB blocks) read
at the median with the p95 beside it. Instrument: `tools/qa/p5-harness.js` (`__p5.go / costAB / qualityAB / lightsOff / walk / identityHash / validate /
manTiles`, views staged through `__stage`, guards parked with their torches held dead, Sam invisible unless he is the subject, phases zeroed, grain off) on
top of `perf-harness.js`; `__gi` / `__rt.mesh` / `__rt.reuse` / `__hotGather` in main.ts. The GPU was shared with other lanes' pages for stretches of the
night: absolute pass times drifted by up to 10 % between sessions (the plain gather read 9.2 ms in one, 9.8–10.3 in another); every ratio below is from an
interleaved A/B inside one session, and the cost table says which session's absolute it sits on.

## 1. What shipped, where (files)

- **Frame** grows `p5Cfg: vec4u` @656 (x = the gather's resampling mode 0 off · 1 temporal · 2 + spatial | 16 = revalidate; y = fresh rays | confidence cap << 8 |
  spatial taps << 16 | radius << 24; z = the reflection pass's bits 1 = mesh closest-hit, 2 = hit-lighting reuse) and `jitter: vec4f` @672 (this frame's TAAU
  jitter xy, the previous render's zw) → `FRAME_BYTES` 688 (frame.ts byte table, common.wgsl struct, tools/qa/frame-layout.ts writer rows; materials-probes'
  main-bytes assertion follows). All zero = every pass exactly as it was.
- **Settings** (engine.ts): `giResample 'off'|'temporal'|'full'`, `giResampleRays` (2), `giResampleCap` (20), `giResampleTaps` (3), `giResampleRadius` (10),
  `giResampleRevalidate` (true), `rtMeshHits`, `rtHitReuse` — all off in `defaultSettings`; `quality.ts Preset.p5` = ultra `{ gi: 'temporal', giRays: 2, mesh:
  true, reuse: false }` (reuse measured no gain, §4), `P5_OFF` on high / medium / low / verylow (a preset hop off ultra puts all three back); `?nop5` vetoes all
  three for a visit (`quality.ts p5Veto`, main.ts) — ultra's frame as it was before the phase, for A/B and the identity hashes. Tab ▸ Indirect light ▸ 'ULTRA: gather
  resampling' + its five rows; Tab ▸ Materials + reflections ▸ 'ULTRA: characters as their MESH in reflections' / 'ULTRA: 2nd-ray decorrelation + hit-lighting
  reuse'; debug views 16 'gi reservoirs' (r = M ÷ cap, g = temporal history taken, b = spatial taps accepted / ½ = the tile had news) and 17 'rt raw' (the
  reflection texture as composite fetches it); `__gi {mode, knobs(), set({}), summary()}`, `__rt.mesh / .reuse`, `__hotGather(src?)` (both gather entry
  points from disk, gather_common.wgsl with it).
- **(1) The resampling gather** — `fgather.wgsl mainGi`, a second entry point of the same module with its own layout `lFGR` (fgather's nine bindings + last
  frame's reservoir pair read + this frame's written + `gVel`); `main` and `lFG` are untouched text. Reservoirs = two rgba32uint textures per parity at the gather
  grid (`passes.ts giRes`, 4 × 16 B × 1067 × 600 = 41 MB at ultra), pooled, made on the FIRST frame resampling is asked for, re-made zeroed with the gather set
  on a resize / divisor flip, cleared on every off → on edge, let go after 600 frames off (`setGi`). §2 is the estimator.
- **(2) Mesh closest-hit** — `common.wgsl meshTriN / meshClosestChar / meshClosest` (the mesh-shadow trees walked to the NEAREST triangle: a hit leaf shrinks the
  search distance so later node tests prune; face normal turned toward the ray) and `traceClosestMesh` = `traceClosest` statement for statement whose tail takes
  the mesh hit (t, normal, the character's albedo off his first capsule) while `frame.p5Cfg.z & 1` AND `FLAG_MESH_SHADOWS` are up, the capsules otherwise —
  reflect.wgsl's tracer. engine.ts raises the bit only while `meshShadowsOn` (setting ∧ available ∧ attached): mesh shadows off at ultra = capsules, cleanly.
- **(3) Hit-lighting reuse + the antithetic second ray** — `reflect_p5.wgsl` (the phase's variant of the reflection pass; `reflect.wgsl` stays MAIN'S TEXT and is
  the program dispatched whenever `frame.p5Cfg.z` is 0 — see §5 for why two programs and not one with a branch): `shadeReflHit` also in two halves `reflHitParts`
  (emission, albedo, IRRADIANCE at the hit, segment length, whether the on-screen textures lit it — it asks `directOnScreen` first) + `reflHitFinish` (compose,
  glass on the segment, the luminance bound); under `p5Cfg.z & 2` the second VNDF sample takes the first's azimuth + ½ (same radius: the pair straddles the lobe),
  and each STATIC off-screen hit's irradiance is blended 1/(n+1) (n ≤ 6) with last frame's HIT RECORD at the reflecting point's reprojected texel when the record's
  point lies within the lobe's footprint of the hit (0.05 + 1.5·α·t, ≤ 1.5 m), on the same face (n·n > 0.8) of the same box (12 bits of the index); ray 0 writes
  the record {point 16+16+16, normal oct 8+8, irradiance f16 ×3 (bounded 2·10⁴ before the pack, refused if not finite on load), count 4, box 12}. `passes.ts
  reflHit` = an rgba32uint pair at the reflection grid on its own parity (`bgReflP5[p]`), 1×1 stand-ins until first use, zeroed with the reflection set, cleared on
  off → on, let go after 600 frames off; `passes.rtP5` (engine mirrors `p5Cfg.z ≠ 0`) picks `pReflP5` / `lReflP5` (main's nine bindings + the pair) or `pRefl` /
  `lRefl` (main's). `traceClosestMesh` (2) is this variant's tracer while bit 1 is up, `traceClosest` otherwise. `gather_common.wgsl` gains `directOnScreen`
  (directAtPoint's on-screen half alone — the gather's cheap revalidation and the reuse's on-screen test; `directAtPoint` itself is main's body verbatim) and the
  16/16/16-bit point / oct-normal / 5-6-5 albedo packers both passes use.

## 2. The estimator (what 'temporal' and 'full' compute)

The plain gather estimates E(x, n) = ∫ L cosθ dω at each gather texel's primary hit with K = 4 cosine rays: E ≈ π/K Σ L(yₖ), L = the hit's outgoing radiance
toward x = emission (non-area-lit only) + albedo/π × (direct at the hit — the denoised on-screen textures if the hit is visible, else every steady light scored
+ ONE importance-picked shadow ray — + the cascade cache's bounce), the sky on a miss, bounded per ray (24, or the cache-relative firefly bound). `mainGi` keeps
that integrand and traces `giResampleRays` = 2 of those rays, and adds a RESERVOIR per texel (Ouyang et al. 2021, ReSTIR GI, reduced to this renderer's needs):

- **Sample** y = {x_s (16 bits an axis over the world box: 0.6 / 0.13 / 0.43 mm), n_s (oct 8+8; a SKY sample keeps its direction there), L_oD = emission +
  direct part of its outgoing radiance (f16 ×3), albedo (5-6-5), W (f16, ≤ 3·10⁴), M (8 bits), flags valid / sky / capsule / news, box index (20 bits), and the
  RECEIVER's keys: view depth (f16), normal (oct 8+8), plus d = |x − x_s| and cosφ_s (f16 ×2) for the Jacobian and p̂ at store time (f16)} — two texels.
- **Target** p̂(y | x, n) = lum(L_o) · cos⁺θ. Source pdf of a fresh ray p = cosθ/π, so its RIS weight is w = p̂/p = π·lum(L) — the cos cancels, nothing divides
  by a grazing cosine.
- **Temporal reuse.** The texel's own reservoir of last frame at `floor((proj_prev(P) + gVel − j_prev + j_now) / gdiv)` (both TAAU jitters out: a still pixel
  inherits itself, as restir.wgsl learned), valid if the stored receiver depth is within 1 % + 2 cm of the depth P has in last frame's view and the stored normal
  within 25°; the sample must still face the receiver. Its outgoing radiance NOW: the cache's bounce at x_s is re-added EVERY frame from the live dice (albedo ×
  dice(x_s)/π — the multi-bounce field settles over frames after any change and a value frozen with the sample trailed it by a visible margin, §4), the direct
  part RE-SHADED ('revalidate'): a point visible this frame off the denoised direct textures every frame (`directOnScreen`, cheap), an off-screen point (the ceiling
  most floor texels' rays end on) through the light loop + shadow ray on its 8×8 tile's every-4th-frame turn or when the record carries the NEWS bit (below) —
  turns dealt per tile, never per texel (a per-texel quarter measured as dear as every texel: a SIMD group pays for its slowest lane). Combination = confidence
  weights with the history's confidence DISCOUNTED by how far the target at its own point moved since it was stored: r = p̂_new/p̂_old (p̂_old rides in the
  record; p̂_new from the re-shade / re-aim / live bounce), M_eff = M·min(r, 1/r) — restir.wgsl's symmetric target-ratio cut — then m_t = M_eff/(M_eff + K),
  m_fresh = 1/(M_eff + K); past ×64 either way the history is dropped. Still light: ten frames of evidence against two rays. Light arriving at the point OR leaving
  it (a man's shadow, a spot's skirt, a door's wedge crossing it, the mains going): the fresh rays speak, no stale W is multiplied in, no 91 % weight on a sample
  that just went dark. The STORED M is M_eff + K (a reservoir rebuilt from two rays after a switch says two rays, so the next frames average rather than trust
  it), capped at `giResampleCap` (20); a ZERO-WEIGHT reservoir (every candidate dark: 'looked, found nothing') is kept with its point but read back with M ≤ K and
  dropped outright the frame its point turns out lit; a man's sample (capsule: never re-shaded, and he walks) also stores M = K. The fresh-ray luminance bound
  applies to the history on every path.
- **News.** At the end of the frame the tile compares Σ over its lanes of the fresh rays' estimate (π/K Σ lum L) with Σ of what the histories believed (lum L_o ·
  cosθ · W, before any re-shade), fixed point through three workgroup atomics + one barrier (mainGi has no early return before it: lanes with nothing to shade
  ride along with live = false); more than ×2 apart with ≥ 8 histories present = news → the bit goes into every record the tile stores → next frame all of them
  take the full re-shade. A door thrown open on a dark room, the mains restrike, a torch coming round the corner reach the reused samples one frame after the
  fresh rays; steady light never trips it.
- **Shading = shade-all.** E = Σ_j f(y_j)·w_j/p̂(y_j) over the history sample AND every fresh ray = m_t · L_t cosθ_t W_t + Σ_k m_fresh · π L_k — the same
  expectation as the survivor's f(y)·W, the fresh rays' chroma kept, no division by a small p̂ (f/p̂ = L/lum L). The survivor (chosen ∝ w) is stored with W =
  Σw / p̂(y) for next frame; what is stored is the TEMPORAL stage's reservoir ('full' does not inflate M through space).
- **'full'** adds one spatial pass: k = `giResampleTaps` neighbours on a golden-angle disc of `giResampleRadius` gather texels whose receiver lies on this texel's
  plane (|Δ·n| < 5 cm + 0.4 %·z) with a like normal (> 0.9) lend LAST frame's temporal reservoirs, each re-targeted here with the reconnection Jacobian |J| =
  cosφ_here·d_there² / (cosφ_there·d_here²) (1 for a sky sample; rejected outside [1/6, 6]) and combined with pairwise MIS against the canonical (defensive
  form, a rejected pair's share returned; a valid zero-weight neighbour is dark evidence and takes its share) — with NO extra visibility ray. Its estimate is
  E·m_c + Σ_i L_i cosθ_i |J_i| W_i m_i.
- **Bias stance.** 'temporal' is consistent up to the usual M-capped-reuse assumptions (a still integrand between store and reuse — which the re-shade, the live
  bounce and the news bit work to make true — and no visibility change between x and x_s across one frame: a man stepping between a floor texel and its stored
  wall point leaks that point's light into the texel for ≤ M/K frames). 'full' is the biased-but-bounded variant on two counts, both documented in the shader:
  no visibility ray on a neighbour's sample (bounded by the plane / normal / radius tests to the like-lit patch it came from), and the canonical's pairwise
  weight m_c(y_c) multiplying the shade-all sum rather than each term's own m_c(y_j). Ultra ships 'temporal'; 'full' is the Tab row (§4 has its numbers).

## 3. Cost (ultra 2133×1200, serialized, gather pass median; ratios from interleaved A/B in one session)

| view (session absolute of the plain gather) | plain gather | 'temporal' K 2, cap 20, revalidate | ratio | union Δ |
|---|---|---|---|---|
| cubicles, calm (9.24 boot-compiled · 9.8–10.3 later sessions) | 9.24 | ≈ 6.2–6.4 | 0.65–0.69 across the estimator's revisions (final 0.688) | −2.4 … −3.5 |
| … 'full' (+ 3 taps r 10) | — | +0.35 over 'temporal' | 0.707 | |
| … K 1 + revalidate / K 2 no revalidate / K 1 no revalidate (first estimator, for the shape of the cost) | 9.24 | 4.39 / 5.24 / 2.75 | | |
| lobby, the two ceiling panels lit, four men on the stone (heavy calm) | 12.06 | 8.59 | 0.71 | 32.44 → 29.03 |
| **STRESS MINUTE** (fight:false, QRF deployed, 41 lights, 7 lit carried, 2–3 smoke domains, rain; 6 × 100-frame interleaved blocks) mean / p50 / p95 / max | 10.05 / 10.03 / 10.68 / 11.14 | 7.48 / 7.47 / 7.80 / 8.13 | 0.744 | below |

Where the resampled gather's time goes (cubicles, hot-swapped variants, first estimator): a fresh ray ≈ 2.4 ms at ultra, the reservoir I/O + staging ≈ 0.3, the
revalidation ≈ 0.35–0.5 once dealt per TILE (per texel it measured 1.4–1.6: a SIMD group pays for its slowest lane, so a per-texel quarter costs what every texel
costs), the live bounce re-add + the news atomics inside the noise. The target the brief set — ultra gather ≤ 6 ms — is met calm on the boot-compiled scale and
missed in the stress minute (7.5): the loud minute's 41 lights make the off-screen re-shade's light loop dearer and its sky / smoke content defeats more histories.
K = 1 would meet it everywhere (≈ 4.4 calm) at the price of one fresh ray of chroma per texel; left on the Tab slider.

**The other two:** mesh closest-hit costs nothing the timer can see (lobby with four men on the polish: reflect 2.49 → 2.49 ms; the close two-man view 3.80 → 3.80;
cubicles with nobody 0.92 → 0.98; stress reflect 1.58 → 1.40 = noise) — few reflection rays pass a man's bounding sphere and the pruned walk is short. Hit reuse:
reflect +0.05–0.07 ms in the calm views (vending 2.75 → 2.82, lot 1.77 → 1.84), +0.1 in the stress minute, 20 MB.

**Stress minute, ultra 2133×1200, union of the compute passes (serialized; the bar is p95 ≤ 30):**

| | union mean | p50 | p95 | max | gather mean / p95 | reflect | direct |
|---|---|---|---|---|---|---|---|
| P5 all off (= main's ultra, this session) | 29.72 | 29.56 | **32.18** | 47.6 | 10.05 / 10.68 | 1.49 | 7.74 |
| P5 as ultra ships it (+ reuse on for the take) | 26.79 | 26.74 | **27.98** | 39.4 | 7.48 / 7.80 | 1.44 | 7.53 |
| gi only (3 × 80) | 29.42 → 27.07 | 28.84 → 27.07 | 31.46 → 27.85 | | 9.66 → 6.95 | | |
| mesh only (3 × 80) | 29.91 → 29.81 | | 31.06 → 30.74 | | | 1.58 → 1.40 | |
| reuse only (3 × 80) | 30.08 → 30.07 | | 31.26 → 31.78 | | | 1.41 → 1.53 | |

Ultra with the phase on holds the bar (p95 27.98); main's ultra in the same session did not (32.18 — the lead's gate had it at 28.0 in a quieter one). Memory at
ultra: reservoirs 41 MB (+ 20 MB hit records only while reuse is on); every other tier 0 (1×1 stand-ins, 32 B) — checked on all five presets after an ultra visit.

## 4. Quality (ultra; sd = temporal standard deviation of a 300-px tile over 20 settled frames — of the final 8-bit frame (LDR levels) and of the linear indirect (% of the tile mean); tile means vs the plain gather)

**Bias / energy.** Linear tile means, resampled vs plain: cubicles wall −1.2 %, floor −0.2, desk +0.4; storage corners +0.3 / +0.7, shelf +1.7; torch view floor
−0.1 … −1.4, wall +0.5 … +2.6; 'full' −2.7 … +0.5. All inside the ±3 % asked; no systematic sign.

**Noise.** LDR sd resampled ÷ plain, same tiles: cubicles wall 0.81×, floor 1.07×, desk 1.01×; storage 0.98× / (3.4× of 0.001 — both zero) / 1.37×; torch floor
0.61–1.03×, wall 0.98–1.67× — where the PLAIN path's own sd varies ±40 % between takes (0.020 ↔ 0.028 on the torch wall): every tile's sd is a few hundredths of one
8-bit level after the diffuse denoiser + TAAU either way, and the ratios sit inside that measurement noise. Honest reading: parity, not an improvement — the denoiser
was already holding the plain gather's noise under a level; what the phase buys at ultra is the 2.6–3.5 ms. 'full' reads 0.89–0.97× on the cubicles tiles for +0.35 ms.
Cap 40 instead of 20: 1.03× / 1.03× (nothing); K 3: 1.00× / 0.98× for +2.4 ms.

**A switched light** (cubicles floor tile, indirect-only view, every group off → on and on → off, frames to 50 / 90 % of the settled level):

| | raw gather output (passes.indirect) on / off | after the diffuse denoiser (gi[0]) on / off |
|---|---|---|
| plain 4-ray gather | 1–3 / 7–12 · 3 / 9 | 6 / 19 · 5 / 13 |
| resampled, final estimator | 2 / 9 · 3 / 9 | 8 / 20 · 5 / 14 |
| resampled, stored radiance reused as found (no revalidate) | | 17 / 33 (off) |
| resampled, revalidate but the plain M/(M+K) split, bounce frozen with the sample | 5–7 / 15–23 (on) | 12–13 / 22–27 (on) |

So: within two frames of the plain gather after the denoiser on a full switch-on, parity on a switch-off; the raw output is at parity. The rows in between are why
the estimator has the pieces it has (§2): re-shading fixed lights-off, the target-ratio MIS + the live bounce + the news bit fixed lights-on.

**Mesh hits — the honest crop verdict.** With the lobby's ceiling panels lit and torches off, the men's mirror images on the stone (view 14 at exposure ×6, ×3 crops
`docs/shots/p5_lc_{capsule,mesh}_g*_v14.jpg`, `p5_l4d_*`) differ where the reflection is SHARP — within ~half a metre of the contact: shins taper to ankles and
feet read as shoes under the mesh, tubes with round ends under the capsules; a torso two metres up the mirror ray is lobe- and filter-blurred to where the two read
alike (the ÷2 reflection grid + 4 à-trous at hit distances of 2–4 m). In the composite at night the images are a 4–5 % Fresnel term under lit floors: visible as
shape only against a bright reflected background (the frontage, a lit wall) or on torch-lit legs. No crawl or added aliasing seen stepping frames under TAAU; a
walking man's image trails like the capsule one did (the specular history is keyed on the floor pixel, ~6 frames on polish) — unchanged by this phase. Worth
having at zero cost; not a headline.

**Hit reuse — measured no gain.** Final-frame sd fresh vs reuse: vending contact 1.01×, lobe 1.05×; lot streak 1.03×, pole 0.87×; metal shelf (lin) 0.99×, upright
1.00×; corridor lino 0.90×, wall 0.98× — and the RAW reflection texture's linear sd moves as little (0.19 → 0.20 %, 0.30 → 0.27 %). Most reflection hits in these
views are on screen (exact direct off the denoised textures — the reuse leaves those alone by design), and the specular denoiser's history already averages the
off-screen pick's flicker; P4's finding that the residual is history-clamp / TAA interaction stands. Shipped as a row, off in the preset.

## 5. Identity, validation, gates

- **The OFF path is main's frame, byte for byte, at every tier** — fresh `?paused` boots, `__p5.identityHash` (40 settled frames of a staged view, FNV of the
  readback), sequence cubicles → vending, harness `legacyStage` (torches left to the carry rule, as the baselines were taken), against a scratch worktree of main
  @ 90778f9 served beside this one: **high 56247efe / e4e919fe = main · medium 8109c591 / 290932a4 = main · ultra `?nop5` 86c151eb / 2b795d0b = main** (before the
  ReSTIR-speckle merge the same held against eec7cfc: fea21bc0 / 645a3168, 69f6e683 / dc3a242e, 9789bc78 / e54278bc). Getting ultra there took one finding worth
  keeping: with main's reflection statements compiled inside a kernel that also carried the dormant phase-5 code (one module, a uniform branch), the reflection
  texture differed from main's in the last bits of a few texels (equal sums to seven digits; one 133-px output cell of 144 crossed an 8-bit boundary in one view) —
  the Metal compiler schedules / fuses the light loop differently in a bigger program and one importance pick flips. Hence `reflect.wgsl` = main's text as its own
  pipeline and `reflect_p5.wgsl` = the variant, chosen per frame; likewise `directAtPoint` lost the private flag it had briefly grown. `fgather.wgsl main` never
  changed (mainGi is a second entry point: Tint compiles each entry point alone, so `main`'s program is main's).
- **GPU validation** (`__p5.validate`: the three switches × debug views 0/1/4/10/14/16/17 × rt on/off · divisor 3 · gatherThird · legacy denoiser · TAAU off ·
  scale 0.6 · direct/indirect off · night vision — 43 steps, error scopes + uncapturederror): clean. Plus by hand at ultra: preset hops ultra → high → ultra →
  verylow → ultra, mesh shadows off (the bit drops, capsules) and back, render scale 0.7 ↔ 1.0, gi off → temporal (the clear edge) and 'full', reuse on with the
  reflections switched off under it and back, the breach's daylight start / stop, `keepHistories` off across a resize: all clean. All five presets boot clean;
  P5 memory 0 B on the four lower tiers after an ultra visit.
- **Gates:** typecheck clean; `tools/qa/gate.sh perf frame-layout player breach glass materials wet` green (perf 24/0 after its Frame base gained the two members,
  frame-layout 9/0, player 166/0, breach 13/0, glass 39/0, materials 45/0 with the new Preset.p5 + Frame-tail lines, wet 18/0); `quality-plan` PASS (auto never
  picks ultra, so its table is untouched by the preset change); `tour --runs 2` PASS; `soak --seeds 1,2 --minutes 6` clean; `bun run build` fine.

## 6. Follow-ups

- **Gather ≤ 6 ms in the loud minute** is one knob away (K = 1: ≈ 4.4 ms calm) if the chroma of a single fresh ray per texel grades acceptably by eye — or a
  cheaper off-screen re-shade (the light loop is the cost: a per-tile light shortlist shared by the 64 stored points would cut it).
- **'full' as the ultra default?** −10 % sd on flat tiles for +0.35 ms and a documented bias; left as the row until someone looks at a corner where a neighbour
  sees round it.
- **Visibility on reuse.** The one unbounded bias of 'temporal' is a man stepping between a texel and its stored point (≤ M/K frames of leaked light in his
  contact shadow's bounce). A single any-hit ray per texel every 4th frame (the tile's turn) would bound it; not measured.
- **Mesh hits at ÷1.** The mesh's silhouette survives only where the reflection is sharp; a full-resolution reflection grid on polish (P4's own follow-up) is
  what would make it a headline. The closest-hit walk is ready for it and free.
- **Hit reuse** could matter for a rough metal facing an off-screen lit wall with the specular history SHORT (fast camera): not a case this level has much of.
  The code path is small and off; delete it if it never earns a preset.
- The reservoirs' 41 MB could halve (one parity + in-place update with a staging copy) if ultra's memory ever matters.
