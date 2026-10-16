# Direct-light quality — the torch, the flash, the slivers, the fringes (2026-08-12, lane `v3/direct-quality`)

The maintainer's notes, playing at HIGH on main (verbatim, in the order they arrived): *"there's some odd glowing at contact points for some things. also the light
from muzzle flashes looks pretty noisy and i'm still seeing quite a bit of temporal artifacts. it's not SO bad but still not quite the presentation i'd want. weird
light leaking in door frame too. weird red wall leaking on sam too. looks to be from direct light? … still seeing noise in flashing light in cubicle … indirect
light pass is looking very good"* — then, mid-lane: *"playing around with the guards, the flashlight direct lighting seems like a huge regression now. very noisy
and lots of rims"*, and by their own A/B: `?norestir&nosharp` *"looks great"* for the guards' torches; main (ReSTIR + sharp direct) *"a huge regression"*.

Machine / method as the earlier phase notes: M4 Max, Chrome (the Browser pane) / Metal, dpr 2, this worktree on :5202 (shot sink :5203), the base commit (main @
0f33b7f) served beside it on :5216 for the identity hashes, `?paused&quality=<tier>&mute`, the canvas box pinned to 1280×720 CSS at dpr 2 (high = 1368×770 →
1777×1000), guards parked dark, phases zeroed, grain off, the storm off, the flickering tube held steady unless a scene drives it, dice seeded, every scripted step
rendered offscreen exactly once. The maintainer played on the same GPU throughout and other lanes' pages shared the pane: cost numbers are interleaved medians and
say when a take was contended. Instrument: `tools/qa/dq-scenes.js` (`__dq`) — the scenes, the sharp path's SLIVER CENSUS (`__sharp.census()`: sharp_direct.wgsl
writes its fallback code per output pixel into sharpE's alpha), the direct term read back under the sharp path (`dirTerm`), the flash-frame protocol
(`flashFrames`), the deterministic torch sweep (`sweep` / `sweepCompare`), the hybrid's cost rig (`costHeld`), the per-tier battery (`tierRun`), S3's two lights
(`s3Lights`). Numbers: docs/perf/dq-high.json, dq-tier-<tier>.json, dq-stress-high.json, dq-final.json, dq-identity.json. Page: docs/review/direct-quality.html
(`python3 tools/qa/dq-page.py`).

## 1. What each artefact actually was

**The torch (S6) — the headline.** A carried spot light MOVES every frame. Through the reservoirs that costs three things at once: (i) the temporal
reservoir's weight W carries last frame's estimate of the class total at the texel it came from, re-weighted only by ITS light's change at this point —
under a sweeping cone every pixel's history came from a texel where the cone stood somewhere else, so even the fully-lit interior of the pool (every ray
clear) reads a spatially varying, crawling estimate: the MOTTLE across the disc (docs/shots/dq/dq_{old,main,ship,held8}_S6_poolAll_f20 ×3 — main mottled, the
old renderer smooth); (ii) the confidence cut (target now ÷ target then) lets the history go wherever the cone's falloff crosses the pixel, so the edge band
is one or two fresh rays a pixel; (iii) the shadow client's light-motion cue drops the ratio history there too (correctly — it is invalid), so nothing
smooths what is left. The old leader path traced 8 stratified rays to the top light from the pixel's own point every frame and had no history to be wrong.
Two-seed noise (below): the pool's lit interior main 0.207 vs old 0.113 vs the hybrid 0.111; at low main reads 5.3 (!) against the hybrid's 0.75.

**The muzzle flash (S4).** Confirmed as briefed: a transient never enters a reservoir; the transient stratum gave it ONE shadow ray per pixel per class, so
every penumbra the flash casts — chair legs, the carton, Sam's own legs — was a per-pixel coin flip on the only frames the light exists, and the shadow
client (which jumps to the frame's own value when the believed-visible light changes) had nothing to lean on. Sam's shadow on the flash frame: sd 3.13
levels with one ray vs the old renderer's 0.51; 4 stratified 1.19, 8 stratified 0.80. The one-ray frame is also 4 % DARK (tile mean 86.4 vs 90.1 at 8
rays vs old 90.6): the jump path's outlier cap clips the bright speckle. A NEW persistent light's first frame through the reservoirs is worse (3.60).

**"Yellow / blue fringes along shadow boundaries" (grey view) — real, ReSTIR's shade, fixed.** Coloured penumbrae ARE physical (a warm and a cool light put
one shadow in two places; the old renderer draws the same tan / blue bands, S3), but on top of them ReSTIR painted false colour: its belief-hue shading colours
the class's estimated visible LUMINANCE with the hue of the light mix the pixel BELIEVES visible, and deep inside one light's shadow the believed set can be a
far dim light of another colour that still has reach there (the green exit signs, in S3's manager office) — the blocked light's penumbra luminance came out
GREEN. Attribution by A/B in the direct-only view, strongly-green pixel count in the shadow tile: restir on / v3 denoiser 6 663 · restir on / legacy denoiser
4 713 · restir OFF (either denoiser) 0 · restir with the per-sample hue A/B 0 · the old renderer 0. The fix (HUE SPLIT, §2): 0.

**The slivers (S1/S2, the lead's hypothesis (a) for the leaks / rims / fringes) — refuted as THE cause, kept as hygiene.** The census over a 77-view survey of
the whole floor at the follow camera's framing (55°, 21 m, fov 28°, high): sliver pixels (no internal tap of the 4×4 on the output pixel's surface) are
0.008–0.015 % of the frame (150–275 px), and the ones where an output-resolution shadow ray finds DARK what the old rule borrowed lit — the bright leak by
construction — 47–70 px a frame (0.003 %). Round Sam and the door frame in the torch sweep: 14–21 and 52–54 sliver px, 12–13 / 17–23 of them leaks. Real,
fixed (rule 1, §2), invisible at that count. Both classes' ratios always came off the same texels with the same weights (there never was a per-class
texel choice to fringe).

**"Glowing at contact points".** The boots. In the direct-only view (docs/shots/dq/dq_view3_S2b_frame, ×5 on the feet): a man's boots read fully lit INSIDE the
shadow his own legs cast round them — every shadow ray leaving a character's pixel skips that character's own proxies (the owner byte: no self-shadowing by
design, capsules or mesh alike), so the parts of him his body shades from the panel above shine at their unshadowed value against a correctly shadowed
floor. Estimator-independent (the leader path does the same); it is CHARACTER VISIBILITY — the exp/sdf-characters lane's term. Not touched here.

**"Light leaking in door frame".** Not reproduced as a LEAK in any corridor framing (storage / manager / break-room doors at 21 m and 9 m, corridor lit and
dark, the leaf widened to shut its 3-cm slots: docs/shots/dq/dq_darkC*): with the corridor group off the frame is black. What IS on every door under a torch or a
panel: the 3-cm slot between leaf and jamb and the 4-cm reveal render DASHED at 1777 px — in the old renderer too (docs/shots/dq/dq_j{old,soff,main,ship}_S6_door ×9):
sub-pixel geometry on an unjittered raster, the C3j residual docs/internal/image-quality.md §7 already names; the TAAU-only path blurs it into a line. Under a
moving torch through the reservoirs those thin faces ALSO shaded wrong (the reservoir domain's unjittered centre lies on the next surface for a face thinner
than a pixel + jitter) — the hybrid traces carried lights from the raster's own point (§2), as the leader path did.

**"Red wall leaking on Sam".** Not the direct term (the sharp path's ratio is irradiance ÷ irradiance — no albedo enters it): the composite's joint-bilateral
INDIRECT upsample falls back to the nearest gather texel raw when no tap passes its depth / normal weights, and on a limb thinner than a gather texel (3
internal px at high's third-res gather) that texel is the red partition's bounce. Present in the internal path too. The gi lane's diffuse client owns that
upsample; noted, not built here.

**"Noise in the flashing light" (S5, the tube).** The strobing tube is a STATIC light (owner 0) whose power jumps; the hybrid does not touch it. A jump-frame
stratum for it (N stratified rays for a persistent light on the frame its power jumped, its reservoirs carried over frozen) was built and measured WRONG in
level: on the jump frame the reservoirs holding OTHER lights still carry the tube's old contribution in W (the class total lives in the reservoir's weight,
not per light), so adding the tube's own N-ray term counted it twice — +53 % on the raw jump frame (rug 0.537 vs 0.350 linear), +21 % after excluding it
from spatial reuse. Not fixable without per-light weights; dropped (the code is gone); tjank's numbers stand.

## 2. What was built

- **THE HYBRID ESTIMATOR** (`restir.wgsl` HELD, `settings.heldRays` = K, `Preset.restir.held` ultra 8 · high 6 · medium 4 · low 3 · verylow 2; Tab ▸ Direct
  light; 0 = the transient stratum exactly as it was): every light with an OWNER byte (a character carries it — the guards' torches, Sam's rail / gun light,
  muzzle flashes, tracer heads; the harness's synthetic torch carries owner 250) bypasses the reservoirs at the pixels it reaches: the two strongest at the
  pixel by unshadowed weight take K STRATIFIED emitter samples each (shadowSample's golden-ratio disk sequence off a per-pixel lattice offset) from the
  raster's OWN point (P + N·1.5 cm, `PoJ` — not the reservoir domain's unjittered centre) and are shaded exactly, E × mean visibility, through their own
  panes; any further carried lights are a per-class importance-picked tail with one ray (W_tail × V — the old tail ray); never a candidate, a belief or a
  reservoir; U counts them, the denoiser's cue luminance U.a counts them (a torch sweeping onto a pixel IS a light change there — the shadow client lets the
  ratio history go, as it should, and shows the K-ray estimate through its 3-frame moving history), the believed-visible hue does not. Static lights keep
  ReSTIR statement for statement. Bounded by construction: ≤ 2K + 2 extra rays, only at pixels a carried light reaches. ONE tracer call site as before
  (queue positions 8‥ = the leaders' strata, leader-interleaved). The measured K brackets: S6 pool interior identical from K 2 up (every stratum agrees in a
  lit pool); penumbrae (S4) go 3.1 → 2.2 → 1.2 → 0.8 for 1 / 2 / 4 / 8; an adaptive stop (end a stratum once its first two strata agree) measured WORSE per
  ray (8 adaptive 1.64 vs a plain 4's 1.19) and is not shipped.
- **HUE SPLIT** (`restir.wgsl` phase 2, `settings.restirHueSplit`, ru.cfg.w & 128; false = as it was): the believed-visible mix colours only the luminance
  its own lights carried; the part of Σw carried by samples whose light this pixel does not believe visible (tile-dark here, or its own darkSlot) — a
  history sample kept at m_T = 1, a darkSlot fresh sample, an accepted neighbour's — keeps the samples' own hue (`wOut / colOut` beside `wsum / col`, riding
  through the pairwise MIS scaling). Where everything is believed (the vending floor it was built for) nothing changes.
- **The sliver rule** (`sharp_direct.wgsl` SLIVERS, `settings.sharpSliver` 1 / `sharpSliverCap` 24 / `sharpDiag`; 0 = the fallback as it was): an output
  pixel with no internal tap on its surface borrows nothing across surfaces — per class ONE deterministic ray from the output pixel to the strongest live
  emitter's centre decides that light, the class's remainder rides on the neighbours' LUMINANCE ratio (≤ 1; ½ or the ray's own verdict where the neighbours
  hold none of the class), both classes off the same texels; at most 24 sliver pixels per 8×8 tile trace (ranked in lane order — deterministic). The kernel
  is compiled twice as before (tracer-free / traced); the traced variant is a boot pipeline now (99 at boot) and runs while the sliver rule or the edge-ray
  experiment wants rays. The fallback code rides in sharpE's alpha (0 taps on surface · 1 outer ring · 2 sliver · +4 traced · +8 unshadowed default · +16 / +32
  the ray overturned dark / lit) → `__sharp.census()`, and `sharpDiag` paints it.
- **GBAA's same-surface clamp** (`gbaa.wgsl`, `settings.gbaaClamp`, frame.sharpCfgC.w; off = the blend as it was): an edge pixel blends toward the neighbour
  across its edge only if that neighbour is at or behind it — a nearer third surface over the edge lends nothing.
- No Frame growth (sharpCfgC.zw were spare; the hybrid's K and the hue bit ride in the ReSTIR uniform): frame-layout untouched and PASS.
- Harness: `tools/qa/dq-scenes.js`, `tools/qa/dq-page.py`, `__hotSharp` / `__hotGbaa`, `__sharp.census / knobs / set`.

**Lines other lanes care about (the SDF-characters merge):** `restir.wgsl` — the header's HELD paragraph; `wgHeld` (workgroup); the `heldK / hybrid` decode
after `raysCfg`; the `hS hW hV hE0 hE1` declarations; `PoJ` beside Po / PoT (+ its assignment); the two `stratumLight()` calls in the curT adoption rule; the
stratum branch at the top of the scoring loop (the `if (stratumLight(li, hybrid)) {…}` block replacing the one-line transient test); `hUv` + the `wgHeld` park
after the transient queue line; the trace loop (re-shaped: `nq`, the `q < 8` / else decode, `select(PoT, PoJ, …)` in the traceSample call, kind 4); the
`hE0 / hE1` restore after the barrier; phase 2's `wOut / colOut` (declaration, the temporal line, the fresh loop line, `nOut / ncolOut` in the spatial pass,
the `sLum = wsel` line, the shade branch); the HELD shading loop after the transient tail; `fn stratumLight` at the end. The `traceSample` / `shadowSample`
signatures are untouched; a soft-shadow factor for character proxies inside occludedT / shadowSample reaches every ray here unchanged. `denoise.wgsl`,
`direct.wgsl`, `direct_common.wgsl`, `common.wgsl` untouched.

## 3. Numbers

**S6 — the torch sweep, high** (a synthetic held torch with the guards' numbers slid ½ m at hand height while its aim runs along the corridor's north wall
from Sam across the storage door, 40 offscreen renders; per-pixel NOISE = sd of 8-bit luma between two seeds of the same sweep, frames 12‥39, ÷√2 — detail,
aliasing and the light's own motion cancel, only the dice remain):

| variant | pool INTERIOR (follows the beam) | pool + edge band | door tile | wall tile | lino |
|---|---|---|---|---|---|
| OLD renderer (leader path, all v3 off, 1777 native) | 0.113 | 0.448 | 0.259 | 0.327 | 0.228 |
| main = ReSTIR + sharp | **0.207** | 0.556 | 0.400 | 0.469 | 0.146 |
| hybrid K 4 alone | 0.187 | 0.453 | 0.264 | 0.373 | 0.140 |
| **SHIP** = hybrid + slivers + clamp (K 4 at the time) | **0.111** | 0.498 | 0.239 | 0.297 | 0.117 |
| ship, K 2 · K 8 | 0.112 · 0.110 | 0.382 · 0.409 | 0.234 · 0.236 | 0.290 · 0.298 | 0.117 · 0.114 |
| ship with sharp direct OFF (TAAU only) | 0.978 | 0.976 | 0.812 | 0.810 | 0.137 |

(The TAAU-only row is jitter shimmer: two seeds draw two jitter sequences and a jittered upscale of a hard bright disc differs pixel by pixel — the sharp
path's exact per-output-pixel U has none of it. Sam's tile is not comparable: his breathing clock keys on the run's game time.) The census inside the sweep's
Sam / door / pool rects: 14–21 / 52–54 / 2–27 sliver px, of which the ray overturned 12–13 / 16–24 / 0–23 dark under rule 1.

**All five tiers** (`tierRun`: the sweep main → ship, S4 main (1 ray) → ship (the tier's K), the cost rig; K as measured = 8 / 4 / 3 / 2 / 2 — the shipped
8 / 6 / 4 / 3 / 2 sits at or above every measured point):

| tier · internal → output · K measured | S6 pool interior | S6 pool + edge | S6 door | S4 Sam's shadow | S4 carton edge | direct ms, 3 torches + Sam's light: K 0 → K → K 8 | union K 0 → K |
|---|---|---|---|---|---|---|---|
| ultra 1920×1080 → 2133×1200 · 8 | 0.305 → **0.090** | 1.351 → 0.531 | 0.653 → 0.230 | 3.86 → **0.99** | 1.03 → 0.51 | 5.75 → 7.68 (K 8) | 24.2 → 24.1 (contended) |
| high 1368×770 → 1777×1000 · 4 | 0.207 → **0.111** | 0.556 → 0.498 | 0.400 → 0.239 | 3.13 → **1.19** (8: 0.80) | 1.06 → 0.49 | 3.30 → 3.49 → 3.57 | 16.8 → 18.2 (contended) |
| medium 1072×603 → 1600×900 · 3 | 0.225 → **0.142** | 1.191 → 0.507 | 0.569 → 0.272 | 3.97 → **1.99** | 1.16 → 0.72 | 2.10 → 2.23 → 2.45 | 8.56 → 8.21 |
| low 768×432 → 1280×720 · 2 | **5.32 → 0.75** | 4.35 → 1.35 | 3.86 → 0.96 | 4.26 → 3.35 | 1.28 → 1.09 | 1.40 → 1.65 → 1.99 | 6.93 → 7.37 |
| verylow 533×300 → 1066×600 · 2 | 1.03 → 0.98 | 2.10 → 1.56 | 1.42 → 1.17 | 4.84 → 3.67 | 1.31 → 1.11 | 1.04 → 1.05 → 1.31 | 7.62 → 6.95 |

Low is where the reservoir path breaks worst under a moving torch (rays 3: one class re-traces per frame). Verylow's sweep numbers are floor-bound by
its 2× jittered upscale (16 phases). The cost of the hybrid is bounded by where carried light falls: three torch pools and a pistol light in one corridor
view cost +0.2 (high, K 4) / +0.13 (medium, K 3) / +0.25 (low, K 2) ms of direct pass, +0.27 / +0.35 / +0.59 at K 8; ultra +1.9 at K 8 on 2133×1200.

**The stress minute at high** (`__stress.setup({fight:false})`: the QRF deployed = three carried weapon lights (owner 10 / 11 / 12), rain, two canisters, the
0.6°/frame orbit, 37 lights; `__sh.stressAB` 4 × 60 frames a side, ABBA) — a badly contended take (union ≈ 29 ms mean where the reference minute reads
11–13: tour + soak + build were running on the CPU and the maintainer on the GPU), so read the interleaved DELTAS: direct K 0 4.22 / p50 4.19 / p95 4.65 →
K 4 4.36 / 4.19 / 4.98; K 4 4.45 → K 8 4.40 (inside noise); sharpU 1.36 → 1.33; the union pairs 28.9 / 28.5 and 30.3 / 29.7. The hybrid does not register in
the stress minute's direct pass at the p50 and adds ≈ +0.15 ms at the mean; the bar (union p95 ≤ 14 at high, main 13.6) cannot be READ from this take —
the calm-frame identity below and the +0.14 direct delta are the evidence that it holds; a quiet re-take is the one number this note owes.

**Calm cost of the whole config vs main-equivalent** (cubicles still, high, no carried light in view, `__sh.costAB` 4 rounds, dq-final.json): direct
3.54 → 3.60, sharpU 1.44 → 1.44, softblur 1.51 → 1.57 — inside the noise of a take whose unions swung 17.5 / 19.8 ms (the reference still reads ≈ 10: the GPU
was shared all evening; the sliver A/B in the same battery read sharpU 1.245 both ways and unions 16.9 vs 10.95, i.e. contamination, not the flag). The one
clean number from earlier in the session: the traced sharp kernel costs +0.13 ms of sharpU occupancy at high (1.05 → 1.18) whether or not a ray fires; the
hybrid and the hue split add no work without a carried light in view (the identity hashes are the same frames).

**Identity** — OFF = main byte for byte (`__sh.identityHash`, first call after boot, this branch with heldRays 0 · sharpSliver 0 · gbaaClamp off ·
restirHueSplit off vs main @ 0f33b7f served beside it): high v3 **48b3212e** / v1 **b4bceada** on both; medium v3 **2ce6cb9d** on both (docs/perf/dq-identity.json).

## 4. Gates (final build)

typecheck clean · `tools/qa/gate.sh perf player breach glass materials weapons`: perf 24 · player 166 · breach 13 · glass 39 · materials 45 PASS lines, 0
FAIL; **weapons 60 PASS / 6 FAIL — the six (`weapons-identity`, `teams-identity` frozen digests: '34 in Sam — want 33', digest 4b511c5d ≠ 6934142b) fail
IDENTICALLY on the base commit 0f33b7f** (run there: the same lines, Marta / Owen in the log — the civilians merge moved the frozen forty-five seconds; a red
on main to re-freeze knowingly, not this lane's) · quality-plan 0 FAIL (exit 0) · frame-layout PASS (under perf) · `tour.ts --runs 1` 1/1 PASS · `soak.ts
--seeds 2 --minutes 4` no violations · `bun run build` OK · GPU validation: dq-final.json `val` (error scope + OOM scope + the uncaptured list round the five
presets × heldRays 0 / K / 8 × sliver 0 / 1 / cap 0 / both paints × clamp × hue split × edge rays × debug views 0 3 4 9 11 12 13 × a transient flash):
**null / null / 0 uncaptured at ultra, high, medium, low and verylow** — clean; no page errors through the session's ~40 boots and hot-swaps.

## 5. Residuals
- The stress minute wants a quiet re-take for the p95 bar (above).
- The tube's jump frames (owner 0): as tjank left them; a static light's jump budget needs per-light reservoir weights.
- Device cones (the wall cameras' red lens spots) pan slowly with owner 0 — moving static lights; small and dim, not measured. A `moving` bit from
  devices.ts would put them in the stratum in one line (`stratumLight`).
- Character self-shadow (the boots) and the indirect upsample on thin limbs (the red rim): other lanes' terms, evidence above.
- The dashed slot / reveal on an unjittered 1777-px raster: geometry, shared with the old renderer.
- The door-frame LINE the maintainer saw was not found; with `__sharp.set({diag: 2})` on, one screenshot's framing would say in a frame whether it is a
  sliver leak (painted red), the dashed slot, or something else.


## 08-14 — 'weird direct light shimmer in breakroom … on the civilian, not the floor' (ultra)

The maintainer's screenshots: a cowering civilian in the two vending fronts' light, ultra, and — the first thing found — the page PACED at 30 fps with the GPU
at 8.6 ms while the adaptive ladder had cut ultra to ×0.50 for it (fixed the same hour: ec4aaa2, no cut unless the union says GPU-bound). The shimmer itself,
measured on a parked khaki guard where the civilian stood (temporal sd of tonemapped luminance in a 60×90 tile on his trunk, 24 frames):

| pose | ultra default (mesh shadows every ray + self-shadow) | self-shadow off | mesh off (round cones) | ReSTIR off (?norestir path) | sharp off |
|---|---|---|---|---|---|
| frozen (dt ≈ 0) | 0.077 | 0.051 | 0.040 | 0.041 | 0.050 |
| breathing (dt 1/60) | 0.48 | 0.56 | 0.57 | 0.82 | — |
(the floor beside him at full scale: 0.007–0.014; at the ladder's ×0.5: 0.041)

Reading: a lit body is 5–10× noisier frame to frame than the floor even holding still, and ultra's MESH self-shadowing doubles it (every point on him is in
his own partial shadow with respect to a 0.8 m emitter two metres off; the binary mesh answer per lattice sample is what the ratio denoiser then has to carry on
a small curved surface where its edge-stopping lets it average little). Moving (breathing, cowering) the reservoirs and the shadow history are dropped or
clamped most frames, so he is shaded from one or two fresh rays — the shimmer.

Tried and REVERTED the same night: 'CHAR PIXELS' — a pixel on a character takes the hybrid HELD path for every light (the two strongest by K = 8 stratified
emitter samples, shaded exactly, no reservoir / history). Frozen pose 0.030 → 0.104 (3.5× WORSE: the stratified set rotates per frame by design and nothing
accumulates it), breathing 0.54 → 0.47 (marginal), +0.25 ms direct. Not it.

Candidates for a lane: (1) character pixels through the OLD per-pixel estimator (direct.wgsl's adaptive 8/4 stratified rays + its short direct history — the
?norestir path the maintainer called 'looks great' on the torch; frozen 0.041 here) dispatched only over a character mask; (2) self-shadow from the round cones
even at ultra (mesh kept for shadows cast on the world): −34‥48 % frozen, a look trade on limb contact shadows; (3) more shadow-client history for character
pixels keyed on the skin's own motion vectors (gVel from prevJoints is exact for skinned pixels — the clamp, not the reprojection, is what drops it).
