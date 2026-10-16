# SDF character rig — round cones fitted to the mannequin, three uses (branch `exp/sdf-characters`, 2026-08-10)

> **2026-08-11 — the capsule paths are gone (§11).** After the merge the maintainer asked to "clean up all the capsule stuff now": the GPU capsule
> test, its `if (rigOn())` forks, `settings.sdfRig` / `sdfRigTight`, `?sdfrig` / `?nosdfrig`, the preset field and the OFF-path restore are deleted;
> the fitted round cones are every ray's character test with no switch. §1–§10 below are the branch's record as measured AGAINST the capsules and
> keep their wording ("bit 1", "OFF = the capsule statements") — read them as history; §11 says what the tree carries now.

The maintainer's framing: *"for 3D SDFs, how are we thinking about replacing capsules with that? sounds like a good thing, even if we only use them
very sparingly (like just for characters)"*. The earlier SDF-props branch (`exp/sdf`) taught the constraint: a sphere march compiled INTO the three ray
queries every pass inlines costs ≈0.35 ms of every high frame in registers alone, drawn or not. So this branch replaces arithmetic INSIDE the existing
per-character capsule branch — the one only rays that pass a man's cull sphere ever reach — and adds new code paths only where one pass calls them.
Review page: `docs/review/sdf-characters.html` → (a private page) (favicon 🫧). Pane harness: `tools/qa/sdfrig-harness.js` (`__sr`). Numbers: `docs/perf/sr-*.json`.

## 1. The rig and its fit (`src/render/sdfrig.ts`, `tools/qa/sdfrig-fit.ts`)

Every mannequin already carries 15 shadow proxies rebuilt off the skeleton each frame (`Character.capsules()`: lower torso, chest, shoulder line, pelvis
line, neck + head, upper arms, forearms + hand, thighs, shins, soles). The rig keeps those 15 SEGMENTS (so `CAPS_PER_CHAR`, the capsule buffer, the owner
byte, the cull sphere, every loop bound stay what they were) and makes each a ROUND CONE — radius r0 at end a, r1 at end b, iq's tangent-sphere solid —
with the radii least-squares fitted ONCE at load to the glTF mesh:

* joints' bind positions from the inverse bind matrices; each slot's segment rebuilt in bind pose by the same construction rules `capsules()` uses
  (shoulder mid-point, head + 13 cm, forearm extended 9 cm past the wrist, the sole's heel / tip);
* the vertices a slot fits = those whose DOMINANT skin joint is in its joint set (fingers excluded from the forearm: 3 000 of the mesh's 8 500 vertices
  are fingers, splayed in the T-pose); each is projected onto the segment, `ρ ≈ r0·(1 − u) + r1·u` solved in the normal equations (a vertex past an end
  fits that end's cap radius); the two CROSS lines (shoulders, pelvis) are fitted only to what the trunk cones fitted before them leave outside — a torso
  is wider than deep, one cone up the spine fits its depth and the cross lines carry the width;
* `RIG_OVERRIDES` pins any slot by hand — the two SOLES are (below); `rigTable()` prints the residuals; `bun run tools/qa/sdfrig-fit.ts` runs it offline.

The fit (mannequin, 8 547 vertices, 3 067 used, 4 ms):

| slot | hand capsule r | fitted r0 → r1 | n | rms | max | inside |
|---|---|---|---|---|---|---|
| lowerTorso | 0.150 | 0.115 → 0.112 | 397 | 26.6 mm | 96 | 43 % |
| chest | 0.160 | 0.122 → 0.158 | 399 | 26.0 | 63 | 46 % |
| shoulders (cross line, after chest) | 0.070 | 0.084 | 104 | 21.9 | 52 | 65 % |
| pelvis (cross line, after lower torso) | 0.110 | 0.100 | 210 | 21.6 | 46 | 57 % |
| neckHead | 0.105 | 0.054 → 0.113 | 265 | 18.9 | 83 | 56 % |
| upperArm ×2 | 0.052 | 0.071 → 0.048 | 154 | 8.2 | 22 | 49 % |
| forearm + hand ×2 | 0.042 | 0.050 → 0.037 | 214 | 10.9 | 28 | 48 % |
| thigh ×2 | 0.075 | 0.085 → 0.053 | 156 | 11.4 | 33 | 54 % |
| shin ×2 | 0.058 | 0.054 → 0.039 | 161 | 16.5 | 56 | 62 % |
| sole ×2 | 0.033 | 0.050 → 0.045 solved, **pinned 0.034** | 105 | 20.1 (pinned) | 42 | 18 % |

"inside" ≈ 50 % everywhere is what an unbiased mean fit gives (half the surface pokes out of the cone, half is in). The trunk residuals (26 mm) are the
elliptical cross-section a round solid cannot have; the limbs sit at 8–16 mm. The hand radii were tuned by eye for shadow WIDTH from above (0.15 / 0.16
trunk); the fit is a third slimmer up the spine and takes the width from the two cross lines instead. The soles are pinned a millimetre proud of the height
`Character.capsules()` runs their axis at (3.3 cm): the solved 5 cm shoe on that line sat 1.7 cm INTO the floor, and every floor receiver within
~3.7 cm of it was then inside a proxy — occluded from t = 0 for every light (a black rim round each shoe whichever way the light came) and a
reflection ray that starts inside the union (the review caught it).

**Upload.** Nothing of the fit touches the game: `BoxWorld.upload()` applies it to the frame's capsule list when `engine.settings.sdfRig` is on and a fit is
attached (`Engine.setRigFit`, game.ts / the viewer beside `setMeshShadows`) — the fitted r0 over the hand radius, r1 quantised to the millimetre in the
top byte of the record's `misc` word (owner byte and rgb565 albedo untouched; 0 there = "same as r0", i.e. what a record nobody fitted decodes to), and
the character's cull sphere fitted to his cones' ends + radii (+ the smooth union's bulge k/4 + 1 cm) about the middle of their box — 0.98 m standing
where the capsule path carries a fixed 1.5 m (`sdfRigTight` off = 1.5 m, for A/B). The words it overwrites are kept (`rigPristine`) and RESTORED when
the rig is off or re-applied, so a render with no game step after a switch — every harness A/B does exactly that — traces what the game uploaded.

## 2. GPU side (`src/render/shaders/sdfrig.wgsl`, appended to the scene prelude after common.wgsl with the fold generated from the TS table)

`frame.rigCfg` / `rigCfgB` (Frame @752 / @768 → `FRAME_BYTES` 784; frame-layout PASS): x = bits **1** round cones in every capsule loop (i) · **2** the
smooth-union closest hit in the reflection tracer (ii) · **4** the soft character visibility in the direct estimators (iii) · **8** its analytic form ·
**16** smooth union inside the soft march · **32** the soft query for broad-class lights too; y/z/w = soft march steps, × light angular radius, min
tan(half-angle); B = × the joint blend radii, closest-hit steps, its epsilon, the soft march's floor step. **All zero = every capsule statement as it
was**; the new functions are then unreachable and dropped per entry point.

Edits in shared shaders (every line):

| file | what |
|---|---|
| `common.wgsl` struct Frame | + `rigCfg`, `rigCfgB` |
| `common.wgsl` `traceCapsules` / `occludedCapsules` | an `if (rigOn()) { … }` copy of each loop calling `isectRoundCone(ro, rd, a, b, r, coneRb(cp))`; the capsule loops below it verbatim |
| `common.wgsl` `proxyNormal(p, cp)` (new, 3 lines) | round-cone normal under the rig, `capsuleNormal` otherwise; `traceClosest`'s and `traceClosestMesh`'s capsule tails call it |
| `common.wgsl` `traceClosestMesh` tail | `else if (rigSmoothOn()) { rigClosest … rigNormal … }` between the mesh branch and the capsule branch |
| `common.wgsl` `occludedT` | its box walk moved verbatim into `occludedTBoxes(ro, rd, tmaxIn, skip, tCap)`; `occludedT` = the character part + that call |
| `direct_common.wgsl` `shadowSample` | `skip` hoisted into a let; `if (charSoftFor(li)) { occludedTBoxes(…, −1); charSoftVis(…) × smoke }` before the untouched `occludedT` path |
| `reflect_p5.wgsl` | the tracer choice: `if ((p5Cfg.z & 1) != 0 ‖ rigSmoothOn()) traceClosestMesh else traceClosest` |
| `restir.wgsl` / `direct.wgsl` | (iii)'s flag only: `softC[c]` set off `vs.y == SOFT_CLEAR_Y` (restir: real rays only — not the audit / transient slots), `aOut = −SOFT_HINT_FLAG` when the class measured no box hint (3 + 5 lines) |
| `denoise.wgsl` | `SOFT_HINT_BAND`; `shTemporal` reads SHARED at the pixel and, for a flagged class, moving cap 1 + the variance-gated change rule; `shAtrous` treats the band as no own hint (§2 iii) |
| `reflect.wgsl`, `fgather.wgsl`, `sharp_*`, `probe`, `rc` … | nothing (their programs still carry the prelude — §3) |

CPU: `engine.ts` (settings + defaults, `rigFit` / `setRigFit` / `sdfRigOn`, `world.rig` before upload, `frame.rigCfg/B`, the reflect_p5 dispatch also
under bit 2), `frame.ts` (members, writer, prelude), `boxes.ts` (`rig`, `applyRig`, `rigPristine` / `restoreRig`), `quality.ts` (`RigTier`, `RIG_OFF`, `rigForce`, `apply`), `main.ts`
(`?sdfrig / ?sdfsmooth / ?charsoft / ?charsoftmarch / ?nosdfrig`, `__sdfrig`, `__rigTrace`), `bindings.ts` (Tab ▸ Renderer — SDF character rig),
`game.ts` + `viewer/runtime.ts` (one line each: `setRigFit(fitRig(ch))`), `render/rigDebug.ts` (the debug kernel), `tools/qa/frame-layout.ts` (two rows).

### (i) any-hit: `isectRoundCone`
iq's `iRoundedCone` (one quadratic for the flank + the two cap spheres), plus the origin-inside answer `isectCapsule` gives (a receiver inside a proxy is
occluded from t = 0 — the contact darkness under a prone body) and the ray re-centred to just before the cone (`tc = dot(a − ro, rd) − reach`) so the
quadratic's dot products span a metre instead of the sixty a moonlit shadow ray does (the capsule form has the same cancellation; it just never bit).
`roundConeNormal` = the SDF's gradient by region (cap a / cap b / flank: perp·cos + axis·sin of the taper). Used by every capsule loop, so shadow /
occlusion rays at every tier, the gather's, the cascades', the probe's and the reflections' closest hits all see the taper. CPU twin + brute-force
check: `__rigTrace` (render/rigDebug.ts) vs the harness's JS port — the disputed rays of §4 agree to the millimetre.

### (ii) closest hit on the smooth union: `rigClosest`
Per character (cull sphere, owner skip): the nearest entry over his 15 cones INFLATED by the blend's bulge (closed form; a miss on all of them is a miss on
the union inside them), then a sphere trace of `charSdf` (the generated fold: `sminP` per slot in `FOLD_ORDER` — trunk, legs, then the arms against
everything at 2 cm so an arm at the side does not web to the ribs) from just before that entry, Lipschitz-safe (polynomial smin of exact distances
never overstates), ≤ `rigCfgB.y` steps (24; converges in 3–6), out-of-steps within 8ε = the silhouette grazer = a hit; normal = tetrahedron gradient
(4 field evaluations). Reached only from `traceClosestMesh`, i.e. the reflection pass's phase-5 variant (`passes.rtP5` is raised by bit 2 too), so
`reflect.wgsl` stays main's text and program and no other pass carries the march's registers. Ultra's mesh hits win when both are on.

### (iii) soft character shadows: `charSoftVis`
In `shadowSample` (both estimators), for a light that takes it (`charSoftFor`: the SHARP emitter class; broad panels only with bit 32): the sample's ray
tests BOXES only (`occludedTBoxes`, tCap −1 — a box blocker still hands its PCSS width on), and the characters' factor is a deterministic query toward
the emitter's CENTRE with its angular radius (`li.radius ∕ distance`, × `charSoftK`, floored at `charSoftMinDeg`) as the cone; a man's penumbra then
carries no sampling noise for the ratio denoiser / the reservoirs to average, and reports no blur hint (it is drawn, not measured). Two forms:

* **analytic (bit 8, the default):** per cone the closest approach between the shadow segment and the cone's axis (Ericson's segment–segment), the limb
  as a STRIP across the light's disc as the receiver sees it — centre offset dAxis ∕ w, half-width r ∕ w, w = tanθ·t at that approach — and the strip's
  exact area share of the disc (`discCum`, two circular-segment areas) is what it blocks; per character the largest strip stands for him, characters
  multiply. Exact for one straight limb of any thickness against a disc: a limb thicker than the disc slides an edge across it, one thinner than the
  disc (a shin two metres from a desk lamp, anything under a ceiling panel) blocks its width's worth even dead centre.
* **march (bit 8 off):** iq's soft-shadow loop over the union field (`min h ∕ (t·tanθ)`, floor step 1.2 cm, ≤ `charSoftSteps` 20, negative h marched
  through, Aaltonen's two-sample triangulation of the true closest approach so a 1–2 cm step does not band a 5 mm penumbra), smoothstep remap of
  [−1, 1]. One edge per light: a limb thinner than the disc reads solid at its axis. Optional smooth union inside (bit 16).

**The denoiser hand-off.** A drawn term has no visibility noise, so a history over it is pure lag. `shadowSample` returns `.y = SOFT_CLEAR_Y` (−2:
still "clear of boxes" to every existing `>= 0` test) when the segment missed every box but a man's term darkened it; restir.wgsl / direct.wgsl then
write `−SOFT_HINT_FLAG` (0.01 = 0.32 px, under any real hint's 0.75 px ∕ 32) into the class's hint slot for a pixel with no box penumbra measured or
remembered (3 + 5 lines); denoise.wgsl `shTemporal` reads SHARED at the pixel (one load) and, for a flagged class, (a) makes the occluder cue's moving
cap 1 instead of `dnShadowMoveCap` 3 and (b) takes the frame's value by a 6 → 16 % ramp of the ratio's own change since last frame (a drawn term does
not fluctuate at rest; the 5×5 cue alone, normalised by the neighbourhood's σ, fires only partially at a crisp edge and left most of the stale edge in
place). At rest the pixel accumulates as ever — under ReSTIR the estimate still carries the reservoirs' weight noise, and taking every flagged pixel
from the current frame (the first cut) put a boil of sd 26 levels on a still man's penumbra. The à-trous reads the flag as a ⅓ px hint: no blur there,
and — the one side effect — a flagged pixel does not inherit a neighbouring BOX penumbra's wider hint, so where a man's drawn shadow overlaps a box's
sampled one the box's lit-side blur stops at the overlap.

## 3. OFF identity
`__p5.identityHash` (40 stepped frames from a reset clock, FNV of the LDR frame), this tree with every rig bit down (`?nosdfrig`) vs the base commit 28ca610
served beside on :5187, same pane size: **cubicles at high 36108bf6 = 36108bf6, at medium 8092bc8e = 8092bc8e — identical.** Views WITH a man on screen are
not hashable across boots on EITHER tree (two boots of the base give lobby4 96fcf861 / fa1da997: the staged man's idle pose is not the same twice from
boot — pre-existing, not this branch's), so for them the evidence is a tolerance A/B (`__sr.identityPng`: one man + our own light, every level light dark,
40 frames from a reset clock, lossless): torch view direct-only, base vs base 99.35 % identical pixels / mean |Δ| 0.10 levels, this tree vs base 99.26 % /
0.22 and 99.36 % / 0.24, this tree vs itself 98.96 % / 0.77 — cross-tree differences inside the boot-to-boot floor on every view and channel captured
(docs/shots/ab/ab_id_*.png). Statement level (the review's audit): `occludedT → occludedTBoxes` is a verbatim move, `proxyNormal`'s else branch is the old
call, the `skip` hoist is pure, `softC` never fires with bits 0, `det0/det1` false reduce the denoiser's expressions to the old ones, no re-association
anywhere. What did change for every tracing kernel is the PROGRAM — the prelude carries sdfrig.wgsl and the loops a uniform branch — reflect.wgsl included
(its TEXT is untouched); the cubicles hashes say Metal produced the same bits for it here, which it once did not for a bigger branch (CLAUDE.md, phase 5).
GPU validation sweep (`__sr.validate`): 5 presets × 10 variants × debug views 0/3/4/14 = 200 error-scoped checks, 0 validation errors, 0 uncaptured.

## 4. Is the soft query right? (the disc integral check)
For the lamp scene's disputed rays (floor at x 19.5, z 10.4 → 11.75, the 6 cm lamp 1.55 m up, the man 0.9 m from it) `__rigTrace` integrated the
round-cone ANY-HIT over 64 stratified points of the emitter disc — the converged mean of what the stochastic estimator samples — against the query:

| z | disc-lit (64 rays) | analytic strip | march + remap |
|---|---|---|---|
| 10.45 / 10.50 / 10.55 / 10.60 (the forearm's shadow) | 0.22 / 0.41 / 0.63 / 0.83 | 0.20 / 0.41 / 0.63 / 0.83 | 0.16 / 0.40 / 0.61 / 0.83 |
| 10.65 / 10.70 / 10.75 / 10.80 (into the trunk's) | 0.78 / 0.53 / 0.22 / 0.03 | 0.75 / 0.48 / 0.23 / 0.06 | 0.76 / 0.48 / 0.20 / 0.03 |
| 10.85 … 11.45 (umbra) | 0 | 0 | 0 |
| 11.50 / 11.55 / 11.60 / 11.65 (out the north side) | 0.13 / 0.44 / 0.80 / 1.00 | 0.12 / 0.42 / 0.75 / 0.99 | 0.08 / 0.41 / 0.75 / 0.98 |

Within ±0.05 everywhere on this line, both forms. (Before the strip form the analytic query used the same edge remap as the march; the K → 0 limit of
that — every centre ray through a 4 cm forearm counted fully dark — is what first looked like a bug: a keyhole-shaped hard shadow twice the stochastic
one's width. The stochastic estimate through thin limbs is mostly penumbra; the strip form reproduces that, the edge model cannot.)

## 5. Shape (use i): where the shadow's edge falls, against the mesh

Staging (`__sr.VIEWS`): a 6 cm desk-lamp-like spot 1.55 m up in the corridor with a man 0.9 m west of it (his shadow runs 3 m up the lino: `lamp`
from above-west, `lampW` from the west at his shins), and the chaos torch (7 cm, 0.87 m from a man standing in its beam: `torch`, his shadow on the
south wall and the lino). Variants cap · cone · mesh (ultra's mesh-traced shadows = the SHAPE reference) · softA · softM, all at high 1368×770 → 1777×1000.
Two instruments on the linear S∕U ratio of the sharp emitter class (albedo, the beam's own falloff and the tonemap cancel): (a) `ratioProfile` walks a
floor / wall line from lit into the shadow, mean of 12 settled renders, and reports the 90 → 10 % fall WIDTH and the 50 % crossing; (b) `maskIoU`
thresholds vis < 0.5 over a tile (mean of 8 renders) and compares the shadow MASK with the mesh's.

| edge | cap width · edge at (vs mesh) | cone | mesh | softA | softM |
|---|---|---|---|---|---|
| lamp, 0.25 m behind him (a shin by the shoe) | 3.9 cm · **+3.4** fatter | 4.0 · +0.5 | 4.0 · 0 | 4.0 · +0.4 | 3.9 · +0.4 |
| lamp, 0.5 m (shins) | 14.0 · **+8.7** | 15.3 · −0.8 | 14.4 · 0 | 15.6 · −0.9 | 15.3 · −0.8 |
| lamp, 1.4 m (the trunk's edge) | 14.5 · **+7.9** | 15.7 · +3.7 | 14.1 · 0 | 17.6 · +3.8 | 16.4 · +3.8 |
| lamp, 2.3 m (the head end) | 19.9 · **+10.6** | 26.1 · +3.5 | 27.5 · 0 | 25.7 · +1.6 | 24.3 · +2.3 |
| torch → wall 0.9 m past him, chest height | 8.8 · +1.0 | 9.2 · **−2.0** | 8.1 · 0 | 9.4 · −2.2 | 8.7 · −2.3 |
| torch → wall, knee height | 7.5 · +1.5 | 9.1 · −0.8 | 7.9 · 0 | 9.1 · −0.5 | 8.7 · −0.5 |

(width = 90 → 10 % of the visibility fall in cm on the receiver; "edge at" = how far the 50 % crossing sits from the mesh's, + = the shadow is fatter.
An earlier round of this table had the capsule column tracing FITTED radii — a render with no game step after a rigged variant left the fit in the list;
`BoxWorld` now restores the game's words when the rig is off, and these are the re-run numbers.)

| shadow mask vs the mesh's (vis < ½) | cap IoU · area | cone | softA | softM |
|---|---|---|---|---|
| lampW near — shins, arms, the gap between the legs (74 k texels) | 0.794 · **×1.250** | 0.864 · ×1.120 | 0.869 · ×1.104 | 0.868 · ×1.112 |
| lamp mid — the trunk (56 k) | 0.886 · ×1.127 | 0.931 · **×1.038** | 0.924 · ×1.027 | 0.922 · ×1.025 |
| lamp far — head end (69 k) | 0.983 · ×1.017 | 0.985 · ×0.998 | 0.980 · ×0.988 | 0.978 · ×0.987 |
| torch wall (85 k) | 0.992 · ×0.998 | 0.988 · ×0.990 | 0.985 · ×0.986 | 0.985 · ×0.986 |
| torch lino (66 k) | 0.990 · ×1.001 | 0.989 · ×0.991 | 0.988 · ×0.990 | 0.989 · ×0.990 |

Read: at the LIMBS the capsules shadow a quarter more floor than the mesh does (×1.25, IoU 0.79) and put the shin's edge 3.4–8.7 cm outside the mesh's;
the cones halve the excess (×1.12, IoU 0.86) and land the same edges within a centimetre (+0.5 / −0.8 / −0.8). Up the TRUNK the fat hand radii (15 /
16 cm, tuned by eye for width from above) put the capsule's edge 8 cm out at 1.4 m and 11 cm out at the head end, its mask 13 % too big; the fitted
trunk (a third slimmer, the width carried by the two cross-lines) is 3.5–3.7 cm out and 4 % too big — better by half again, not right: the torso is
elliptical and a round solid plus a cross-line is still round (the residual table's 26 mm said so in advance). On the torch's wall the cone's chest
crossing is 2 cm THIN where the capsule's is 1 cm fat — the one place the capsule's number is better. In crops (page §2): shins and forearms visibly
taper, the gap between the legs opens, wrists and ankles stop being sausages; the pelvis blob stays a blob; the mesh is in another class. Nothing traced
by the cones is worse than the capsules by more than that chest crossing, in any view or debug view looked at, at any tier.

## 6. Penumbra width (use iii) against the stochastic reference

The same lines, the drawn columns against the sampled round cones (same solids — only the estimator differs): contact 4.0 vs 4.0 cm wide, edge
−0.1 cm; 0.5 m 15.6 vs 15.3, −0.1; 1.4 m 17.6 vs 15.7 (+12 % wider), +0.1; 2.3 m 25.7 vs 26.1, edge 1.9 cm THINNER; torch wall 9.4 vs 9.2, −0.2; knee
9.1 vs 9.1, +0.3. So the analytic strip's penumbra is the sampled one's to within an eighth of its width and its edge within 2 cm of it. The marched
form lands in the same places (its one-edge model differs from the strip only inside limbs thinner than the disc, which these lines do not cross).
§4 is the same statement ray by ray.

## 7. Dynamics (use iii): does a drawn penumbra stop trailing?

Three scenes at high, each variant graded against ITS OWN history-free reference (chaos-scenes' `ref`: no TAAU / ReSTIR / temporal reuse, the legacy
filter with no history, scale 1 — rendered under the variant's rig settings; graded against one capsule reference, a thinner shadow's edge crosses a
pixel at another frame and the shape difference books as lag — the first runs did exactly that): **PL** the man slid 1.4 m/s across the corridor under
the lamp, his 3 m shadow sweeping the lino at ~4× that (ROIs: the near floor round his shins, the far floor = trunk / head / arms); **PT** the torch
yawing 25° while he walks through its beam (moving light AND man; ROIs beam floor, wall); **P0** the image-quality program's scene, the man walking
through the fixed beam. Metrics are chaos-scenes': lag = mean frames a swept receiver pixel settles after the reference does, trail = lag × the
motion's px/frame, residue = mean |run − its own final| over swept pixels 1 / 2 / 4 frames after the truth settled (8-bit levels).

| scene · ROI | cap | cone | mesh | softA (drawn, analytic) | softM (drawn, marched) |
|---|---|---|---|---|---|
| PL far (trunk + head sweeping the lino) | 0.16 f · 2.6/2.1/1.5 | 0.46 f · 3.6/3.0/2.7 | 0.01 f · 2.7/2.2/1.8 | **1.51 f** · 10.5/3.5/0.8 | 2.04 f · 10.1/4.9/3.6 |
| PL near (shins) | 0.04 f · 4.7/3.7/2.4 | 0.38 f · 6.9/4.3/2.4 | 0.65 f · 10.9/4.5/2.4 | 0.60 f · 7.4/3.9/2.1 | 2.31 f · 14.8/10.6/9.1 |
| PT beam (moving torch, walking man) | 0.42 f · 6.4/4.4/4.9 | 0.39 f · 6.7/4.8/3.2 | 0.46 f · 7.3/5.1/3.3 | **0.28 f** · 5.5/4.1/2.9 | 0.32 f · 5.9/4.2/2.8 |
| PT wall | 0.45 f · 5.1/3.7/2.9 | 0.44 f · 4.3/3.5/2.6 | 0.59 f · 5.7/4.2/3.0 | 0.35 f · 4.2/3.0/2.5 | 0.38 f · 4.6/3.2/2.4 |
| P0 beam (man through the fixed beam) | 0.48 f · 4.4/3.6/2.8 | 0.37 f · 1.7/3.3/2.3 | 0.63 f · 12.4/6.7/4.6 | 0.71 f · 4.1/5.9/8.1 | 1.78 f · 9.9/8.0/7.9 |
| P0 wall | 0.59 f · 3.4/2.8/2.0 | 0.61 f · 3.8/2.6/1.3 | 0.82 f · 5.7/3.3/2.0 | 0.47 f · 3.9/3.5/3.7 | 0.32 f · 3.9/3.6/3.2 |

(lag · residue +1/+2/+4. The metric's floor on these scenes is 2–4 levels of residue and ~0.3 f of lag: differences inside that are noise; PL's near
ROI keeps only ~15 k receiver pixels once the man's own are masked.)

Read: **no.** After the image-quality program's fixes the sampled character shadows at high already settle within about half a frame of a
history-free render everywhere measured — the multi-frame smear the maintainer's shots showed is not what these scenes produce any more — and the
drawn term does not beat that: level on the torch scenes (0.28–0.47 f against 0.37–0.61: a quarter-frame better where the LIGHT moves, inside the
noise elsewhere) and WORSE on the lamp sweep (1.5 f, a 14 px trail at +1 frame that is gone by +4). The diagnosis runs (PL, softA with one history
off at a time, each against its own reference): shadow-denoiser temporal off → 0.86 f / residue 4.0 (from 1.51 / 10.5); ReSTIR's M-cap 1 → 1.79 f (no
better: the reservoirs are not it); TAAU off → the metric loses its footing (residue never settles under the raw internal-res noise). So two thirds of
the extra lag is the shadow client's history STILL holding flagged pixels back a frame despite the two rules above (the leading edge's newly darkened
pixels are flagged and snap; the band the 5×5 statistics straddle does not fully), and the last third is what TAA does to any crisp edge crossing 9
px a frame that a 25 cm-wide sampled-and-blurred penumbra never presents it with. The lever, if this is picked up again: give the shadow client the
flag as a third input class (α 1 outright wherever the flag is set AND the 5×5 holds no unflagged penumbra pixel — the ReSTIR weight noise at rest is
then the à-trous's to smooth spatially, which it can do at ⅓ px reach only if the flag carries a real width instead: the strip's own w in px), and mark
drawn pixels reactive for the TAAU resolve the way the particles are.

Still-scene noise (8-bit temporal sd over 30 frames, penumbra tiles): lamp near cap 0.29 / cone 0.33 / mesh 0.27 / softA 0.38 / softM 0.29, mid
0.21 / 0.21 / 0.21 / 0.29 / 0.24, far 0.14 / 0.14 / 0.14 / 0.12 / 0.12; torch wall 0.32 / 0.27 / 0.31 / 0.19 / 0.17, lino 0.15 / 0.14 / 0.12 / 0.19 /
0.26. All under half a level: the drawn term is not quieter at rest either (what is left at these levels is the estimator's weight noise and TAA's
jitter, not visibility noise), except on the torch wall where the sampled penumbra's stipple shows (0.32 → 0.19).

What the crops add (page §4): the drawn penumbra is perfectly smooth — and being smooth and crisp it shows the SOLIDS: the pelvis cross-line reads as
a clean half-disc at the foot of the trunk's shadow, the shoulder as a circular bite out of the torch's oval, where the sampled versions' 15–25 cm of
blur hide the primitive under the man. Drawn shadows want a better occluder than 15 round cones before they want anything else.

## 8. Cost

Interleaved A/B, serialized frames, medians of 3 blocks × 30 (calm views) or 4 × 75 (the stress minute); the GPU was shared with another lane the
whole time (absolute levels drifted 18 → 26 ms across the calm session at high — only the paired deltas mean anything, ±0.3 ms).

| A → B: Δ union ms · Δ direct (Δ reflect for ii) | ultra 1920×1080 | high 1368×770 | medium 1072×603 | low 768×432 | verylow 533×300 |
|---|---|---|---|---|---|
| (i) cap → cone, lobby 4 men | −0.13 · **−0.52** | −2.49 · **−0.26** | −0.20 · **−0.20** | 0.00 · 0.00 | +0.07 · −0.07 |
| (i) cap → cone, lamp 1 man | | +1.11 · +0.13 | | | |
| (i) cap → cone, STRESS MINUTE (300 frames a side), two runs | | −0.34 · −0.08 and −0.25 · +0.13 (p95 15.5 → 15.0, 22.1 → 22.4) | | | |
| (i) cap → cone keeping the 1.5 m cull | | +1.18 · +0.26 lobby, +1.77 · +0.26 lamp | | | |
| (iii) cone → + drawn, analytic | +0.53 · +0.46 | +0.20 · +0.13 lobby, −0.72 · +0.13 lamp (softblur −0.53); stress +0.15 · +0.24 | 0.00 · +0.13 | −0.14 · 0.00 | 0.00 · 0.00 |
| (iii) cone → + drawn, marched | | +2.10 · +0.92 lobby, **+2.56 · +3.02** lamp | | | |
| (ii) cone → + smooth closest hit | +0.85 · reflect +0.92 | +0.59 · +0.33 lobby, +0.52 · +0.07 lamp | +0.06 · +0.20 | (rt off) | (rt off) |

The union column is printed for honesty, not precision: this GPU was shared with another lane's stress runs all session — absolute levels drifted 18 → 29
ms across the calm runs at high (a quiet machine gives 14) and paired union deltas swung ±1–2 ms between repeats. The per-pass medians held to ±0.15 ms
and the stress minute to ±0.3; those carry the verdicts. They agree that (i) is inside the noise everywhere (direct −0.5 … +0.2), that keeping the 1.5 m
sphere costs +0.26 direct (the fitted sphere pays for the dearer quadratic), that (iii) analytic is +0.1 … +0.5 direct given mostly back in softblur, that
(iii) marched is 1–3 ms for the same answer, and that (ii) is +0.2 … +0.9 of reflect.

Memory: nothing allocated (the fit is 2 × 15 floats; r1 rides in the existing capsule records; no texture, no buffer, no binding — the scene group
stays at 8 storage buffers, 10 at ultra with the cascades' two).

## 9. Verdicts

* **(i) round cones in every ray — ADOPT at all five tiers** (`PRESETS[*].rig.rig = true`). Free (−0.3 … +0.5 ms at high, inside the contended
  noise; the fitted cull sphere pays for the dearer quadratic), limbs visibly and measurably closer to the mesh (excess shadow at the shins 25 % → 12
  %, shin edges 3.4–8.7 cm out → within 1 cm, the trunk's 8–11 cm out → 3.5), nothing worse than the chest crossing's 2 cm, no artefact found in the direct / indirect / reflection views at any tier, and every
  ray consumer — shadows, occlusion, the gather's and cascades' hits, the light probe the guards see through, reflections below ultra — gets it from
  the two loops. The trunk wants a better solid than round (an elliptic cross-section or two overlapping cones per segment) — the residual table
  says where.
* **(ii) smooth union in the mirror — KEEP THE ROW, ship OFF.** It does what it says (the knee and ankle joints blend, the reflected shin tapers into
  the foot instead of stepping — page §3, ×3 crops of the lobby stone at 11°), for ~0.5 ms at high; at gameplay pitch and floor roughness the
  reflected man is a 15 cm blur in which capsule, cone and smooth union are the same smear, and ultra has the mesh. `sdfRigSmooth` stays on the panel.
* **(iii) drawn character shadows — EXPERIMENT, ship OFF; the analytic form is the one to keep.** The query is right (§4: within ±0.05 of the disc
  integral, penumbra widths within a sixth, edges within 2 cm), costs nothing in its analytic form (the marched one costs 2–3 ms and buys nothing over
  it), and hands the denoiser a noise-free term — but on the metric that motivated it, trailing under small lights, it does not beat the sampled
  estimator as high now stands (§7), and being crisp it exposes the 15-cone occluder the blur was hiding. `charSoftShadow` + its knobs stay on Tab ▸
  Renderer for whoever picks up the two levers named in §7; nothing in the presets raises it.

## 10. Gates
typecheck clean · `tools/qa/gate.sh perf frame-layout player breach glass materials wet` green (perf 24 · frame-layout 9 · player 166 · breach 13 ·
glass 39 · materials 46 · wet 18 PASS; the perf / materials Frame fixtures carry rigCfg + rigCfgB) · `probes.ts sdfrig` (fit / pack incl. the off-with-no-step
restore / presets) ALL PASS · `tour --runs 2` 2/2 PASS · `soak --seeds 1,2 --minutes 6` clean · `quality-plan` 0 FAIL · `bun run build` OK · GPU validation
200 checks / 0 errors (§3).

## 11. The capsule cleanup (branch `chore/capsule-cleanup`, 2026-08-11)

The maintainer, once (i) shipped at every tier: *"for the SDF merge, can we clean up all the capsule stuff now?"* What left the tree:

| where | deleted |
|---|---|
| `common.wgsl` | `isectCapsule` (iq's ray ∕ capsule test, 27 lines) and `capsuleNormal`; the capsule copies of the `traceCapsules` / `occludedCapsules` loops and their `if (rigOn())` forks (each function is now the one round-cone loop); `proxyNormal`'s capsule branch (one line: `roundConeNormal`). 1058 → 999 lines. The BOX loops (`traceClosest` / `traceClosestMesh` / `occluded` / `occludedT` / `occludedTBoxes`) are untouched but for four comment words in their tails |
| `sdfrig.wgsl` | `rigOn()`; the header rewritten as §1 primitive (unconditional) · §2 smooth union (row) · §3 soft query (experiment); bit 1 documented as retired. 215 → 219 |
| `engine.ts` | `settings.sdfRig`, `settings.sdfRigTight` and their defaults; `rigBits` no longer carries bit 1 (= smooth 2 · soft 4 / 8 / 16 / 32 only, no fit gate: the extras work on unfitted records too — `coneRb` reads r); `world.rig` = the attached fit or null; `sdfRigOn` = "a fit is attached" |
| `boxes.ts` | `rigPristine` / `restoreRig` and the `tightBounds` option — `applyRig` is idempotent on its own (ends untouched, r0 / r1 from the fit, the sphere rebuilt from both), and there is no OFF to restore for; `rig = null` (no fit) uploads the game's words as ever |
| `quality.ts` | `RigTier`, `RIG_OFF`, `RIG_CONES`, `rigForce`, `Preset.rig` and apply()'s line — the two extras are rows no preset touches (a hand-set `sdfRigSmooth` / `charSoftShadow` now survives a preset hop, like `gpuParticles`) |
| `main.ts` / `bindings.ts` | `?sdfrig`, `?nosdfrig` (`?sdfsmooth` / `?charsoft` / `?charsoftmarch` remain, plain boot-time setters); `__sdfrig.on` and the `tight` knob; the '(i) round-cone rig' and 'fitted cull sphere' rows; (ii) / (iii) no longer force anything on |
| probes | `sdfrig-pack`'s three OFF-path lines ('rig → null with no game step restores the game's words', 'tightBounds off keeps the 1.5 m sphere', 'tight again = the first application') → replaced by 'the same list written afresh = the first application byte for byte' + 'a shorter list's real records are fitted, its sphere too'; `sdfrig-presets` rewritten: no `sdfRig` / `sdfRigTight` in defaultSettings, no `rig` field on any preset, apply() at every preset leaves the extras as set |
| harness | `sdfrig-harness.js`: `cap` and `coneLoose` are retired aliases of `cone` (kept as keys so the recorded batteries' columns still resolve); BASE drops the two settings |

Kept, deliberately: the per-frame proxy upload (`Character.capsules()` → `addCharacterCapsules` → the `capsules` buffer, `CAPS_PER_CHAR`, struct `Capsule`,
`capsuleOwner` / `capsuleAlbedo`, `CAPSULE_HIT` / `Hit.capAlbedo`, the function names `traceCapsules` / `occludedCapsules` — the records ARE the cones; renaming
them would have touched fgather / reflect / cards / lighting_common, which other lanes hold), mesh shadows and mesh hits at ultra (`meshShadowT`,
`traceClosestMesh`, `meshBinding` / `meshShadowsAvailable`), the smooth-union row (ii) with `sdfRigK` / `sdfRigSteps`, the soft-shadow experiment (iii) with all
its knobs and its denoiser hand-off, `frame.rigCfg` / `rigCfgB` (Frame unchanged, 784 B), `rigDebug.ts` / `__rigTrace`, and every CPU gameplay capsule
(`Character.rayHit` / hit zones, the lasers' `bodyBreaks`, wet, civilians — a different thing with the same word). With no fit attached (a `fitRig` that threw,
an Engine nobody gave one) the game's list goes up as written and each record traces as an untapered cone with its hand radius — the graceful floor that used
to be "the capsule path".

**Identity (cones on before = cones on after, the shipped default).** `tools/qa/rig-identity.js` (`__idrun`): `?paused&quality=<p>&mute`, `#view` forced to
1422×800 CSS px, Math.random seeded (mulberry 4242) and THEN `game.restartEncounter()` — the guards' construction-time dice (glance clocks, waits) are what made
a staged man's pose differ boot to boot in §3; re-dealing them under the seed makes men-on-screen stills hashable — then per view `__stage` (park + the listed
men, torch:false lenses held dead), LIFE / FEET / grain / anim.phase zeroed, 6 game frames, `__resetClock`, 40 frames, one offscreen render, FNV of the RGB
readback. Views: `corr3` (the shift's three men in the corridor lit by their own torches — character shadows from three sharp emitters), `lobby4` (four men on
the stone under the two panels), `cub2` (two men + a torch + Sam crouched among the cubicle desks), `cubicles` (empty, the reference). Base = main @ 6efcc18,
two boots each: **high** 1777×1000 corr3 `081b59a3` · lobby4 `07640ef4` · cub2 `b57cd150` · cubicles `1bdecb57` (boot 2 identical); **medium** 1599×900
`4c32f368` · `d2425604` · `1f1353b1` · `aab80da3` (boot 2 identical); high debug view 3 (direct only) `97c42f07` · `74ca4b6d` · `59fbf627`; **ultra** 2133×1200
(mesh shadows + mesh hits on) `450ef1de` · `f6c63672` · `268d26d6`. This tree: **every one of those hashes identical** — high, medium, high/direct-only, ultra.
(So Metal produced the same bits for every tracing kernel with the dead capsule branch gone from the program, reflect.wgsl included.)

**Validation.** One boot, presets applied live ultra → verylow, the corridor three + Sam staged: per preset debug views 1 / 2 / 9 / 3 / 4 / 14 / 0, the smooth
row on (k 1 and 0) / off, the soft experiment analytic / march / march + smooth + broad (+ view 9) / off, ReSTIR off (+ view 9) / on; at ultra also mesh
shadows off × views 1 / 2 / 9 / 0, rtMeshHits off, both back on — 102 state steps, an error scope per preset: 0 validation errors, 0 uncaptured; `__rigTrace`
compiles and runs on the live scene group (a ray up through guard 0: occluded, cone t 0.778, smooth-union t 0.755). 98 / 98 boot pipelines (all Async), no
console errors on the game page or the workbench.

**Gates.** typecheck clean · `bun run tools/qa/frame-layout.ts` ALL PASS (Frame untouched: rigCfg @752 / rigCfgB @768, 784 B) · `tools/qa/gate.sh perf frame-layout
player breach glass materials wet sdfrig` green: perf 24 · frame-layout 9 · player 166 · breach 13 · glass 39 · materials 46 · wet 18 · sdfrig 20 PASS, 0 FAIL ·
`tour --runs 1` PASS (10 803 frames, 0 failures / warnings) · `bun run build` OK. Line counts: common.wgsl 1058 → 999, sdfrig.wgsl 215 → 219 (the header), TS net −29
(engine 791 → 789, main 595 → 592, boxes 526 → 516, quality 379 → 371, bindings 662 → 660, sdfrig.ts 170 → 169).

**Left for later, named:** `src/game/game.ts:672`'s trailing comment still says the fit is "inert until settings.sdfRig" and its warn text "characters keep their
capsules" (the lane kept out of src/game/**; two words for whoever next touches the line) · the trunk still wants a better solid than round (§9) · `roundConeNormal`
has no zero-length-segment guard (a NaN normal if a real record ever had a == b; nothing produces one — the deleted `capsuleNormal` had the same 0/0).
