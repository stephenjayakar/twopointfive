# Render defects from the 08-12 playtest — the rim round Sam, banding in a lit plume, indirect light behind shelves (lane `fix/render-defects`)

The maintainer's three notes, playing at HIGH with the stratified gather directions on: *"still seeing some rim effects"* (Sam crouched by the lobby's south
windows at night, the street lamp and the moon coming in over the sill: a bright 1–2 px outline round head, shoulders and arms against the darker floor, and
bright edging where his body meets the floor), *"some weird screen space banding on smoke"* (a canister plume in the cubicles from the follow camera: regular,
roughly horizontal bands fixed to the screen, most visible in the lit part under the ceiling panels), *"gatherStrata is looking great! some weird leakage for
indirect light behind the shelves though"* (the INDIRECT debug view, exposure 2: glow hugging the wall behind and between free-standing shelving).

Machine / method: M4 Max, a private headless Chrome (`--headless=new`, Metal, dpr 2, 1600×900 CSS → high = 1368×770 → 1777×1000) driven over the DevTools
protocol from this worktree on :5230 (shot sink :5231), the previous build (`b613869`) served beside it on :5232 for the identity hashes; every capture
`?paused&quality=high&gatherStrata&mute`, seeded `restartEncounter`, guards parked dark, phases zeroed, grain off, `__stage` pins, serialized frames for every
number (`__runFrames(1)` → `onSubmittedWorkDone` → a MessageChannel yield); interleaved A/B rounds, medians. The maintainer played on the same GPU throughout
and one round in four shows every pass inflating at once (the contamination signature) — those rounds are quoted, not used. Instrument:
`tools/qa/rd-scenes.js` (`__rd`: `stage(rim | rimTorch | smoke | shelf, overrides)`, `run`, `frame(view, {exposure})` = one offscreen render + RGBA readback in a
debug view without stepping the game, `crop(name, fr, x, y, w, h, k)` = ×k nearest tiles to the sink, `profile` / `rimMetric` = line profiles, `views`, `project`).
Crops: docs/shots/rd_*.jpg (×3–×8 nearest; `_v3` = the direct-light view, `_v4` = the indirect view, `_v0` = the final frame).

## 1. The rim round Sam — two mechanisms in the DIRECT term, both fixed (`f908859`)

**Reproduction.** `rim`: Sam crouched at (7.6 → 8.3, 0, 23.0) facing the south windows, 0.9 m inside the sill wall, walking (`KeyA`) under the follow
framing (55°, 21 m) so the resolve is in its motion state; the last in-motion frame read back offscreen. rd_rim_d21_v0.jpg is the frame,
rd_rim_d21_sam_v{0,3,4}.jpg the man ×4 in the final / direct / indirect views, rd_rim_mo2_{headtop,armR,thigh,foot}_x8_v3.jpg his silhouette ×8 in the direct view.

**Attribution.** The indirect view carries nothing at his silhouette (rd_rim_d21_sam_v4: dark and smooth); every bright edge is in the DIRECT view. There the
CPU line test settles what is light and what is not: at (8, y, 23) the moon (elevation 30°, through the pane above the 0.8 m sill wall) is blocked below
0.20 m and clear above 0.25 m (`col.segmentBlocked` toward −moon.dir), and the street lamp likewise comes in over the sill — so the floor at his feet is in
the sill's shadow while everything of him above a hand's height is genuinely top-lit by two lights: the crown, the shoulders, the tops of the arms and thighs
ARE lit, and from 55° above a dark suit that reads as an outline. Line profile across the crown (final frame, display luminance): floor 14 · crown band 26–27
over ~5 px · head interior 6 — identical (±1) with `?norestir`, without sharp direct, at scale 1.0 and in the previous renderer configuration, so no estimator
draws it. What was NOT legitimate, and made the outline hug the WHOLE silhouette:

- **No self-shadowing.** Every shadow ray leaving a man's pixel skipped ALL his own proxies (`common.wgsl skipsOwner`, the owner byte — the proxies are fitted
  ±2–3 cm round the mesh, `__sdfrig.table()`: rms 8–27 mm, so testing them from the surface would print acne). Nothing of him ever stood between a part of him
  and a light: the tops of the boots, the shins under the hunched trunk, the forearm tucked against the chest lit exactly like the crown
  (rd_rim_mo2_foot_x8_v3, rd_rim_mo2_thigh_x8_v3). Under a torch the effect is gross: rd_torchmesh_noself_v3 (a guard's torch on Sam climbing a carton,
  direct view ×3) — the whole back, the inside of the raised arm and the leg stretched behind him uniformly white; rd_torchmesh_self_v3 the same frame with the
  rule below: the trunk shadows the arm's inner face, the calf throws its wedge up his back, the crook of the elbow goes dark.
- **The proxy silhouette is slimmer than the mesh.** Below ultra his shadow was cast by the fitted round cones; the fit is least-squares (about half the vertices
  inside), and the soles are pinned at 3.4 cm against a solved 5.0 / 4.5 so the shoe stays out of the floor — so the rasterised limb is systematically wider
  than the shadow it casts, and where the shadow should start AT the silhouette (light from above and behind) a lit seam of 1–3 cm = 1–3 px at 21 m runs
  between the dark leg and its dark shadow, brightest where the boots meet the floor (rd_gap_base_foot_v3 vs rd_gap_mesh_foot_v3: proxies vs the skinned
  mesh, nothing else changed — the seam closes and the boot's shadow attaches).

**Fix.** (a) `common.wgsl selfShadowT(P, N, rd, tmax, owner)`: the receiver's OWN records — his mesh while mesh shadows refit it — traced from the point lifted
`SELF_N` 3.5 cm along the shading normal and `SELF_T` 5 cm along the ray, counting only what the ray ENTERS beyond that; a round cone the lifted origin still
lies inside is the record the pixel sits on or its neighbour across a joint and is skipped, and the records are convex, so the limb a pixel belongs to can
never shadow it — no acne by construction (none found ×3 on the back / buttocks / thighs at 4.5 m, rd_torch_self_v3). `direct_common.wgsl shadowSample` asks
it first for character pixels (fifteen records or one tree; the nearest blocker there is, so the PCSS hint stays right), never for the man holding the light
(a torch inside a fist). `settings.charSelfShadow`, `frame.rigCfg` bit 64, default ON at every tier, `?noselfshadow` / Tab ▸ Renderer — SDF character rig ▸
'character self-shadow' / `__sdfrig.self`. (b) `meshShadowT` gets a NEAR-ONLY form (`rigCfg` bit 128, `settings.meshShadowsNear`, `MESH_NEAR_M` 0.6): a ray
walks a man's tree only when it starts within 0.6 m of his cull sphere and takes his cones from farther off — the mesh matters where the seam is (the floor at
his boots, the desk under his hand, the man beside him, his own pixels), a torch throwing him on a wall 3 m off reads alike off either. The HIGH preset now
carries mesh shadows in that form (`quality.ts Preset.mesh: 'near'`, `apply()` writes both settings; the 'mesh' pass counts as fixed cost in the calibration
sum and the cost model's `REF.mesh` / `meshNearDirect`); ultra keeps every ray, medium and below keep the cones (their seam remains — mesh at medium would be
the same +0.13 ms pass + a share of the direct rays; not placed).

**After.** rd_gap_old_body / rd_gap_high_body (final ×4, in motion, old high vs new high); rd_gap_{old,high}_{foot,thigh}_v3 (direct ×8): the boot's shadow
starts at the boot, the slivers between the legs and their shadows are gone, the shin under the trunk and the arm's inner face darken; the crown and the
shoulder tops keep their light (they should). Line across the shin's shadow edge (direct view): before `…78, 61, 36, 18, 20, 20, 18, 20, 30, 47, 65, 81, 91,
101, 112` (lit floor resuming past a detached shadow) → after `…77, 60, 35, 17, 18, 19, 18, 20, 30, 47, 63, 78, 87, 91, 37` (attached).

**Cost** (union of compute passes, medians of 4–5 interleaved rounds): the lobby scene old 10.21 → mesh 10.46 ms; the four-man torch corridor (rd_corr3)
old 13.74 → new high 13.96 (+0.22: the mesh pass 0.13, direct 5.43 → 5.41, reflect +0.03); two torches point-blank on a crouched Sam with the men filling a
third of the frame (rd_blast) direct 5.26 → 5.98 (+0.7 ms — the case the near-only rule cannot spare, since everything lit IS near a man; the every-ray walk
had cost that much in the corridor alone in one staging: direct 5.41 → 6.15). Self-shadow alone: +0.12 ms direct with cones, +0.06 with the mesh (corridor).
**Identity:** with `charSelfShadow` off and mesh shadows off the frame hashes IDENTICAL to `b613869` in the final, direct and indirect views with Sam on
screen (`91d79a6b / e5795577 / e1acc6aa` both trees); with the new defaults `2f023417 / a4bd96fc / e9001373`.

**Examined, not changed.** GBAA, the resolve's history de-blur, `?nosharp`, `?norestir`, scale 1.0 — none moves the crown profile (all within ±1 level).
The wet coat's Fresnel sheen (a soaked Sam) makes no rim either (rd captures dry vs `__wet.set('sam', 1, 0.6, 0)`: darker, glints, no outline). The
composite's INDIRECT upsample (`upsampleIndirect`): its depth guide is view distance with a 2 %·z tolerance = 42 cm at 21 m, so a crouched limb's pixels and
the floor's gather texels are not separated by depth at the follow distance (only by the normal power) and a limb with no texel of its own takes its
neighbourhood's bounce; harmless in these scenes (the indirect at his silhouette is dark and smooth) and it is the parked "red wall on Sam" item — the better
guide is the sharp path's PLANE distance `dot(Pt − P, N)` with 1 %·z, and a wider ring search for an on-surface texel before any fallback; not built here.

## 2. Banding in a lit smoke plume — the reported bands did NOT reproduce; three continuity fixes in the march (`41d8d7f`)

**Reproduction attempts** (all `?paused&quality=high&gatherStrata`, TAAU on): a tall column under cubicle panel 10 at 14 m and 21 m (rd_smoke_base_plume_v5,
rd_smoke3_base_plume), a corridor plume under panel 17, a large plume on the lobby stone with the lobby panels switched on at 12 m (rd_smoke5_base_full) —
each developed 2.5–5 s then FROZEN (`smoke.params.frozen`) so every A/B saw one field; TAAU-converged stills, 40-frame pans read back mid-motion
(rd_span_base), a live (unfrozen) plume in motion, and `volQuarter` forced on. Judged on ×2–×3 crops contrast-stretched to the plume's own range and their
row derivatives, and — once it was clear an 8-bit readback of a dithered gradient draws its own contour lines under a ×14 derivative — on the rgba16f
volumetric target itself (`__perf.readTexture(passes.vol)`). None shows regular bands: the target's texel-to-texel residual over the plume is 1.1–1.5 % of
the local value and it is plume STRUCTURE (its autocorrelation decays smoothly; correlation with the start-offset dither 0.04), row means carry no period, and
in uniform fog (density forced to a constant across the domain — a variant of the pass hot-swapped in) the target is smooth to 0.2–0.3 %.

**What the march does have** (`volumetrics.wgsl smokeMarchJ`, the froxel-lit per-pixel density march), and what changed:
- `dt = span / steps` with `steps = ⌊span / dtStep⌋ + 1`: every sample on the ray re-spaced itself whenever the stretch length crossed a multiple of the step,
  and the stretch mostly ends on the surface behind the plume — a discontinuity along iso-contours of that surface's depth (~8 cm of depth apart: at 21 m and
  55° that is every ~11 output rows — the one mechanism found that draws regular horizontal screen-fixed contours across a plume at all). Now dt is FIXED
  for the stretch (`max(min(dtStep, span/4), span/112)`, both regimes continuous in span) and the last step is PARTIAL — covering and sampled inside only what
  is left, so a step born at the far end is born empty. Uniform fog, dither held at ½: median |second difference| down the target 0.32 % → 0.21 %.
- the per-texel start offset (`ign(gid.xy)`) never changed between frames, so its share of the error was a still grain the resolve could not average and
  that slid over the plume with the camera; the smoke march now takes `fract(ign + frame × 0.618…)` (the rain and the flag-off haze march keep the old value).
- the 3 % transmittance early-out was one threshold for every pixel (another contour); it is dithered 2–4 % with the same offset.
Look-neutral: mean in-scatter over the lobby plume 0.0780 → 0.0781, mean transmittance 0.1682 → 0.1684; the pass 0.082 → 0.087 ms with that plume filling
a fifth of the frame. `?nofroxel`'s march is untouched (still byte for byte).

**Examined, innocent here:** the J fetch's linear reconstruction across froxel slices (J falls ~30 % a slice down into a lit plume — a cubic B-spline along
the slice axis changed no metric and doubles the fetches; not kept), the half-slice-nearer shift (it is a +16 % brightness bias the plume's tuning now
assumes — removing it darkens the core 15 %; left), the under-slab texel clamp (no measurable effect once the shift is there), IGN's row structure (row means
carry no period: adjacent columns are in anti-phase), quarter-res beams, gatherStrata (does not touch the pass).

**Still open — what to capture next time it shows:** the exact state. `__save.export()` (or Tab ▸ Checkpoints ▸ export) at the moment the bands are on
screen fixes the plume's place, the lights and the camera; the F9 recorder fixes the preset / scale / ladder rungs / lossy rows actually live (a climbed or
trimmed ladder changes `gatherThird` / `volQuarter` / the render scale under a session that was not pinned by `?quality=`). With that file `__rd` restages it
frozen and the target readback above tells texel structure from banding in one call.

## 3. Indirect light behind the shelves — the bounce read at a gather hit crossed the wall (`367dedc`)

**A/B first:** the storage room in the indirect view with `settings.gatherStrata` on and off (rd_shelf_strata_v4 / rd_shelf_iid_v4): mean |Δ| 0.34 display
levels, no structure — the stratified directions are innocent; the field is the same.

**Reproduction.** Not the storage room's own shelves (lit by its bulb the whole room is bright and the wall between the boards reads as it should) but the
manager's office next door: `shelf(29.6, 6.5, …)` stands 12.5 cm off the office's east wall (x = 30), and that wall is the partition to the LIT storage room.
Indirect view ×4, office lit only by its desk lamp (rd_mshelf_v4): the wall behind the unit glows orange between the cartons — 26–50 display levels against
4–5 for the rest of that wall — with a saturated patch where a red binder sits.

**Mechanism.** `fgather.wgsl` shades a hit as albedo × (direct at the hit + `diceIrradiance(Ph + hit.n × c0Spacing(), hit.n)`) — every dice read samples a
full probe spacing (1 m) off the surface along its normal so the trilinear footprint cannot straddle the wall it is on ("sampling closer pulls light through
off-lattice walls"). The gather rays leaving the office wall behind the unit hit the BACKS of the cartons and boards 10–15 cm away; those faces' normals point
at the wall (+x), so the read point Ph + 1 m·x̂ lies INSIDE the storage room, and its +x ambient-cube slab is that room's light: every carton's back face
"bounced" storage light onto the office wall. The same read from floor / ceiling hits within half a cell of the partition pulled a share across too (the
office wall right of the unit read 9.7 against 4–5). The shelves have no back panel and the level's walls sit on the metre lattice; nothing about the cache
itself is wrong at its resolution — the read point was.

**Fix.** `lighting_common.wgsl diceIrradianceFrom(Ph, n, P0, N0)` for a hit reached from the surface (P0, N0): (1) if the hit face looks back at that surface
(`dot(n, N0) < −0.2`) the offset stops 5 cm short of the origin surface's PLANE — that plane is a wall (or the floor) between Ph and everything behind it;
(2) within 0.6 of a cell of the plane, any lattice neighbour of the read point whose cell centre lies behind the plane collapses onto the read point's own
cell centre on that axis (and if that centre is itself behind an off-lattice wall the read steps one cell to P0's side). No rays. The gather's main loop, the
young-history extra rays and the resampling variant's fresh rays (`giTraceShade`, now handed the receiver normal) use it; the stored-sample re-shade
(`giBounceAt`, ultra), the gloss and glass mirror hits and `reflect*.wgsl` keep the plain read (a mirror ray rarely ends a hand off the surface it left;
listed for a follow-up if a case shows).

**After** (rd_mshelf_after_v4, and rd_shelfab_mshelf_{oldFg,newFg}_v0 the final frames): the wall behind the unit 26–50 → 5.0, the office wall right of it
9.7 → 4.0, the floor in front 6.1 → 6.2 (unchanged). Elsewhere (indirect view ×2–×3, whole-frame means old → new): storage 111.7 → 112.1, lobby 22.6 → 22.4,
corridor 11.2 → 11.2, cubicles 19.6 → 19.6, mean |Δ| 0.2–0.6 levels — no broad look change. Gather 1.714 → 1.722 ms at high (ALU on the hit path only).

## Gates

`bun run typecheck` clean; `sh tools/qa/gate.sh perf frame-layout materials sdfrig` green (frame-layout untouched: no Frame field moved — the two new bits
ride in `rigCfg.x`); `bun run build` builds; a fresh boot compiles 101/101 pipelines with no GPU validation errors; the identity hashes above.
