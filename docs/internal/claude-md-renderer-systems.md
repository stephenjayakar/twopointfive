# Renderer systems — bullets moved out of CLAUDE.md

Each section below is one bullet of `CLAUDE.md`'s "Systems worth knowing before touching them", moved here WORD FOR WORD on 2026-10-09 (the bullet's own lines,
unedited, under a heading added here). They are the dated renderer write-ups: method, numbers, knobs, harness names. `CLAUDE.md` keeps one pointer line per bullet.
Paths such as "Tab ▸ X" and numbers are as of the date each bullet was written (mostly 2026-08); check the code before quoting one.

## Markings = object legibility

- **Markings = object legibility** (exp/legibility, docs/review/legibility.html is the record; `settings.markings` default ON, `?nomarkings` = nothing evaluated and
  no marking lights — with `?level=relief` the frame is main's hash for hash). A MARKING is a palette-indexed 2-bit BITMAP on one face of a box: `scene/markings.ts`
  `MarkingDef { face ±x/±y/±z, res 'fine'|'base'|'coarse' (= 1.25 / 2.5 / 5 cm cells: `MARKING_TEXEL` × ½ / 1 / 2, nesting), at [U0,V0] (integer lattice coords of the
  bottom-left cell from the FACE CENTRE along `FACE_AXES`: u right / v up seen from outside, +y: u = +x v = −z), size [W,H] ≤ 32×32, pal ≤ 3 MATERIAL entries { albedo |
  mul, rough?, emit? }, cells: H strings top-first of '.abc' }`, ≤ `MAX_MARKS_PER_BOX` 4 per box on `Box.marks` / `PropPart.marks`; in the level file as `BoxData.markings` /
  `PropPartData.markings` (KEYS marking / markpal, `markingErrors` = the validator incl. 'inside the face' at the file's `meta.markTexel`, `canonMarking`, both load
  directions; the identity probe compares them). ART RULES (the maintainer's): flat colour per cell, ≤ 3 entries, NO gradients, NO baked lighting (entries are materials —
  impossible by construction), everything on the ONE world lattice, AA only at cell edges; never demote a free-standing object (papers keep their boxes and get bars ON
  them) — only face relief (pull strips, LED nubs, screen sheets, gap strips) becomes markings. Authoring = GENERATORS (`GEN.grid / seams / lines / scribble / dots / window /
  glyph` on a `CellCanvas`, `markFromRect` snaps a metric rect INWARD onto the lattice, `markFromArt` takes ASCII rows) in `scene/markingDefaults.ts` (per-KIND recipes:
  keyboardMarks, cartonMarks (+ `ART_UP_FRAGILE` / `ART_LABEL`), cabinetMarks, cupboardMarks (tiles > 32 cells into several bitmaps), paperMarks / sheetMarks /
  whiteboardMarks, vendingRedMarks / vendingBlueMarks (full-front COARSE backlit fields — ribbon + blocks / roundel + blocks — ONE CHROMA per emitting bitmap
  (its one light's colour = its mean; a second hue is albedo only) and FLUX by construction (the light is derived from the pattern; the box's own emissive is 0);
  `controlColumn` / `dispenserMarks` non-emissive; radiance scale k, officeGen `VENDING_FLUX_K`), rackMarks (vents + fine LED bitmaps), doorLeafMarks (doors.ts calls
  it), clock / sign / placard / plate / led / display helpers …) called from `officeGen.ts` (`GeneratorOpts { markings, demote, texel }`; `tools/level-export.ts --relief`
  / `--texel N`). GPU: NO texture, no binding — the table lives in the TAIL of `boxMat` (`MAT_STRIDE` 16: the 4th mat row = the SECONDARY albedo with the markings'
  area average folded in on the CPU (`secondaryAlbedo`) + `Box.markGain`; `MARK_BASE = MAX_BOXES·4` rows in, ≤ `MARK_TABLE_ROWS` 6144 vec4 rows: per record 8 header rows
  + ⌈W·H/48⌉ cell rows, 12 cells per float as an exact integer — `packMarking`), a box's first record ROW rides in flags bits 18‥31 (`MARK_SLOT_SHIFT`; the glass probe
  asserts it), lists deduped by content (`boxes.ts markByKey`, `repackMarkings(texel)`, `markRecordsOf(b)`); `frame.markCfg` @688 = (base texel — 0 = OFF everywhere,
  contrast, emissive ×, evaluate at reflection hits) (→ 752 with the sharp/iq fields, 784 with the rig fields today). `render/shaders/markings.wgsl` (prepended to the g-buffer, composite and both reflection
  modules; no derivative built-ins inside): `markSurfaceGB` in fsBox AFTER the detail layer (cell = face uv ÷ texel; the two nearest cells per axis blended by the pixel
  footprint's analytic coverage of their boundary from dpdx/dpdy(wp) taken in uniform control flow; MINIFICATION past 0.75 cells/px → the local ≤ 4×4 box mean, past ~3 →
  the record's global fractions × coverage) writes albedo + roughness; composite adds `markEmissiveAt` (× `boxMarkGain` = the switchable's supply, lighting.ts) at the
  primary hit; reflect.wgsl / reflect_p5.wgsl `markReflHit` at TRACED reflection hits band-limited by the pixel's ray cone `mkConeFp0 + t·(mkConePix + mkConeK)`
  (mkConeK = `settings.markingReflCone` 0.25 × α — NOT the whole lobe: the rays + the specular denoiser realise that) and, for a marking's registered light
  (`RtLight.markRef` = box << 2 | ordinal in the kind word, `lightMarkRef`), rtGlints' ANALYTIC highlight × `markPatternAtMirror` (the emission at the mirror
  point ÷ its mean, prefiltered by the whole lobe, flux-neutral; A/B `settings.markingReflPattern` = the sign of markCfg.w); gather / cascade / probe / card
  hits read `boxAlbedoSec` only. On 0.22 lino the lobe itself blurs anything under ~15 cm past half a metre of mirror path (docs/review/legibility.html §10b). EMISSIVE MARKINGS ARE LIGHTS: game.ts (after the fixture area lights) registers a kind-3 rect emitter per emissive marking on a
  switchable's box when radiance × area ≥ `MARK_LIGHT_MIN_I0` 0.05 (the office: exactly the two vending windows, calibrated in officeGen on LUMINOUS intensity to the old
  slabs — the light meter in front reads within ~1 %), flags it `AREA_LIT_MARKS` (reflection rays take `emitTraceK` of it) and repacks. Cost ≤ one 65 µs timer quantum at
  every tier. Knobs `settings.markings / markingTexel / markingContrast / markingEmissive / markingReflect` (Tab ▸ Renderer — markings), `__mark` {summary(), set({}),
  list(i) / art(i) (no arg = the box under the cursor), marked(), lights, stats}; pane harness `tools/qa/legibility-harness.js` (`__lg.go(view,'follow'|'close')`, tiles,
  costAB, frame1). Text / logos are NOT drawn (an SDF-glyph atlas addressed from the same table is the follow-up).

## Materials, RT reflections, the detail layer

- **Materials, RT reflections, the detail layer** (renderer v3 phase 4, docs/internal/p4-materials.md; branch record of the experiment it ports: exp/rtreflect):
  every box carries a FINISH — `Box.rough` (GGX roughness 0‥1, `ROUGH_DEFAULT` 1 = matte: no ray), `metal`, `aniso` — packed by `boxes.ts matWord` into boxMat
  row 1 `.w` (the old owner word no shader read) and decoded by `common.wgsl boxFinish(i)`; authored per paint in the level file (`materials{}.rough/metal`, per-box
  overrides; officeGen `OFFICE_FINISH` is the table: stone 0.15, lino 0.22, brushed metal 0.28, dark screens 0.08, laminate 0.5, wood 0.55‥0.6, walls / carpet /
  tile matte), doors.ts (leaf 0.55, steel 0.3 metal, handles) and weather.ts (the wet lot: 0.22 + aniso streak) set theirs in code. The g-buffer writes a 5th
  target `mat` rg8unorm = (rough, metal) per pixel AFTER the detail layer; `render/shaders/reflect.wgsl` (compute, at internal-res ÷ `settings.rtReflectDiv`,
  after 'temporal') reads it: pixels under `settings.rtMaxRough` get `settings.rtRays` GGX-VNDF rays (aniso stretch along the wet streak) through `traceClosest`,
  hits shaded albedo/π × (directAtPoint + dice bounce) + emissive card faces × `emitTraceK(rough)` (polish traces the panels' true rectangles, rougher finishes take
  them analytically), sky + weatherB on a miss, glass on the segment; PLUS `rtGlints` = the analytic GGX D·Vis·F image of every point / spot lens (4 strongest
  shadow-rayed) — ONE BRDF (GGX + height-correlated Smith + Schlick, F0 = mix(0.04, albedo, metal)) at primary hits for lights and at reflection hits; secondary
  (gather) hits stay diffuse-only by decision (documented: the hemispherical Schlick average is what the coat costs there). Output (radiance incl. F, hitT) → the P3
  denoiser's SPECULAR client in per-pixel mode (`denoise.ts writeParams({reflDiv})` → a second uniform block `paramsRefl`; denoise.wgsl `perPixelSpec()`: roughness
  from gMat, mirror-image reprojection through `frame.prevCam` validated on the pixel's plane, hitT smoothed in the fast slot, cap `settings.rtHistory` 32 shrunk to ~6
  on polish and by clamp distance, à-trous `settings.rtAtrous` passes with reach = the lobe's footprint (contact hardening), no-term texels filled with the tile mean so
  composite takes ONE bilinear fetch) → composite adds it × `reflK` = (1 − smoothstep(maxR−0.12, maxR, rough)) × `settings.rtStrength` × the decal gloss-keep, and
  steps metal diffuse back × (1 − 0.7·metalK). `frame.rtCfg` = (maxRough, rays, aniso, divisor — **.w 0 = the pass is OFF**: no flag bit was spent on it) and `frame.matCfg` = (highlight gain, strength, ray luminance bound 60, detail amount). ON in ultra (÷2, 2 rays, ≤ 0.55, 4 à-trous) / high (÷2, 1, ≤ 0.45,
  3) / medium (÷3, 1, ≤ 0.35, 3), OFF in low / verylow (`quality.ts RtTier`, `REF.reflect` in auto's cost model); while on it holds `FrameFlags.Gloss` DOWN whatever
  `settings.gloss` says (rtReflect ⊃ gloss; the glass panes keep fgather's glassShade → the gather-res chain). Targets are pooled, made on FIRST use (an off machine
  pays no memory), histories cleared on every off→on edge. The DETAIL LAYER (`render/shaders/detail.wgsl detailSurface`, called by fsBox when `matCfg.w > 0`; ART
  RULE: roughness / value variation from geometry, never a painted texture): worn lanes + wall-foot grime on polished floors from the CPU TRAFFIC MAP (`render/wear.ts
  buildWearMap(level, nav)`: every patrol route traced over the nav grid + door thresholds → r = traffic, g = wall proximity, 320×224 rg8 at 8 texels/m, built once
  in the Game constructor → `gbuffer.setWearMap`; the viewer / editor keep a 1×1 zero), a scuffed skirting band, dust on top faces above 1.6 m, edge wear on
  metal; `settings.detail` 0‥1 (default 0.35; 0 = fsBox byte for byte). Debug views 14 = the RT term alone, 15 = the material target. Knobs `settings.rtReflect /
  rtReflectDiv / rtRays / rtMaxRough / rtAniso / rtStrength / rtGlints / rtAtrous / rtHistory / detail` (Tab ▸ Renderer — materials + reflections; pause card
  toggle); `__rt` {on, detail, knobs(), set({...}), summary()}, `__hotReflect(src)`; `tools/qa/p4-harness.js` (`__p4`: pinned views, ×3 crops, serialized cost
  A/B, temporal sd, identity hash, validation sweep — posts to the shot sink on `__shotPort`). QA: `probes.ts materials` (finish packing / preset tiers / Frame
  bytes vs main / VNDF / area-light split / wear map), `frame-layout`. Cost (M4 Max, serialized): high +0.5‥1.05 ms union (reflect 0.5‥0.66 + rdenoise 0.26),
  ultra +1.2‥2.2, medium ≤ +0.35, low / verylow 0 (detail only, inside noise).

## The ultra-only extras (renderer v3 phase 5)

- **The ultra-only extras (renderer v3 phase 5, docs/internal/p5-ultra.md)** — three switches only the ultra preset raises (`quality.ts Preset.p5`; `P5_OFF` on every
  other tier = their passes byte for byte as they were, hash-proven; defaults off in `defaultSettings`; `frame.p5Cfg` @656 + `frame.jitter` @672, all zero = every pass exactly as it was): (1) `settings.giResample 'off'|'temporal'|'full'` (+ `giResampleRays 2 / Cap 20 / Taps 3 / Radius 10 / Revalidate`) = the final gather's
  RESERVOIR RESAMPLING — `fgather.wgsl mainGi`, a second entry point with its own layout `lFGR` (`main` / `lFG` untouched): per gather texel ONE secondary sample {point, normal,
  emission + direct part of its outgoing radiance, albedo, W, M, receiver depth / normal, d, cosφ, p̂} in two rgba32uint textures per parity (`passes.giRes`, made on first
  use, zeroed with the gather set on a resize, cleared on off → on, let go after 600 frames off), the texel's OWN reservoir reprojected with both TAAU jitters out + `gVel`
  and validated, its bounce re-added from the live dice every frame and its direct part RE-SHADED (visible points every frame off the denoised direct — `gather_common
  directOnScreen`; off-screen points per 8×8 tile on its 4-frame turn or when the record carries the tile's NEWS bit = fresh vs history estimates > ×2 apart last frame,
  three workgroup atomics + ONE barrier — mainGi has no early return before it), K = 2 fresh cosine rays combined by confidence with the history's cut by its own point's target ratio (M_eff = M·min(r, 1/r), dropped past ×64;
  stored M = M_eff + K), shade-all E = Σ f·w/p̂, zero-weight reservoirs kept with M ≤ K; 'full' adds k spatial taps with the
  reconnection Jacobian + pairwise MIS and NO visibility ray (the biased-but-bounded variant — ultra ships 'temporal'). Gather 9.2 → ~6.2 ms at ultra with tile means
  within 3 % and temporal sd at parity; a switched light lands within a few frames of the plain gather. Debug view 16 = r M ÷ cap · g history taken · b taps / news.
  (2) `settings.rtMeshHits` = characters are their skinned MESH at reflection hits: `common.wgsl meshClosest` (the mesh-shadow trees walked to the NEAREST triangle) inside
  `traceClosestMesh` (= traceClosest statement for statement + the tail); the bit rides only while `engine.meshShadowsOn` (mesh shadows off / unavailable = the round-cone proxies);
  costs nothing measurable. (3) `settings.rtHitReuse` = the second VNDF ray antithetic to the first + per-texel HIT RECORDS (`passes.reflHit`, rgba32uint pair on its own
  parity, 1×1 stand-ins until first use) blending a static off-screen hit's irradiance with last frame's when the points match on the same face of the same box — measured
  no gain at the output (the specular denoiser already holds that noise), so ultra leaves it OFF; the row stays for A/B. **(2) and (3) live in `reflect_p5.wgsl`**, a
  variant of the reflection pass with its own pipeline / layout (`passes.pReflP5 / lReflP5 / bgReflP5[parity]`) dispatched while `passes.rtP5` (= `frame.p5Cfg.z ≠ 0`);
  **`reflect.wgsl` is main's TEXT and main's program** — one module with a uniform branch measured last-bit different from main at ultra (the Metal compiler fuses the
  light loop differently in a bigger kernel and an importance pick flips), so the off path is a separate program by construction; keep the two files in step
  (`__hotReflect` swaps whichever is live). Tab ▸ Indirect light ▸ 'ULTRA: gather resampling' + rows, Tab ▸ Materials ▸ the two 'ULTRA:' toggles; `__gi {mode, knobs(), set({}), summary()}`, `__rt.mesh /
  .reuse`, `__hotGather(src?)` (both gather entry points + gather_common.wgsl from disk); `tools/qa/p5-harness.js` (`__p5`: views incl. the four-men lobby, costAB,
  qualityAB, lightsOff, walk, identityHash, validate, manTiles). QA: `probes.ts materials` (Preset.p5 lines, Frame bytes vs main), `frame-layout`.

## Character proxies = the SDF character rig

- **Character proxies = the SDF character rig** (docs/internal/sdf-characters.md, page docs/review/sdf-characters.html; the capsule test it superseded left the tree 08-11,
  §11 there): every mannequin's 15 shadow / reflection proxies are ROUND CONES (radius r0 at end a, r1 at end b) whose radii `render/sdfrig.ts fitRig(ch)` least-squares fits
  ONCE at load to the glTF mesh (bind pose + dominant skin joint per slot; `rigTable` / `bun run tools/qa/sdfrig-fit.ts` print the residuals, `RIG_OVERRIDES` pins a slot —
  the soles are pinned at 3.4 cm so the shoe stays out of the floor); `Engine.setRigFit` (game.ts / the viewer beside setMeshShadows) attaches it and `BoxWorld.upload` packs
  it into every frame's list (`applyRig`, idempotent: r0 over the hand radius, r1 in millimetres in `misc`'s top byte, the cull sphere fitted + the smooth union's pad) — NO
  SWITCH, every tier; with no fit attached (`engine.rigFit` null: a fit that threw, an Engine nobody gave one) the list stays as `Character.capsules()` wrote it and each record
  traces as an untapered cone with the hand radius (`coneRb` reads r again). The records, the buffer, `CAPS_PER_CHAR`, `Hit.capAlbedo` / `CAPSULE_HIT`, `traceCapsules` /
  `occludedCapsules` keep their capsule NAMES; the CPU gameplay capsules (`Character.rayHit`, the lasers' `bodyBreaks`, wet, civilians) are a different thing untouched by
  any of this. GPU: `shaders/sdfrig.wgsl` in the scene prelude after common.wgsl (+ the generated `charSdf` fold): §1 the primitive (`isectRoundCone` = iq's test + the
  origin-inside answer + a re-centred ray, `roundConeNormal`, `sdRoundCone`, `coneRb`) that common.wgsl's proxy loops `traceCapsules` / `occludedCapsules` / `proxyNormal`
  run for every ray consumer (shadows, occlusion, gather / cascade / probe hits, reflections below ultra; ultra's mesh shadows / mesh hits take over where they are on);
  `frame.rigCfg / rigCfgB` @752 / @768 carry the switchable EXTRAS (bit **64** = CHARACTER SELF-SHADOW, `settings.charSelfShadow`, DEFAULT ON at every tier since 08-12, `?noselfshadow`:
  `direct_common shadowSample` asks `common.wgsl selfShadowT` for a man's own pixels — his OWN round cones, or his own mesh while mesh shadows refit it, from an origin lifted 3.5 cm
  along N + 5 cm along the ray, counting only what the ray ENTERS beyond (a record the lifted origin lies inside = the limb the pixel sits on: skipped; never for the holder of the light
  itself) — the owner skip had left every up-facing sliver of him lit under a light his trunk stands in front of; bit **128** = mesh shadows NEAR-ONLY (high); the rest are rows no preset
  touches): bit **2** = (ii) `rigClosest`, the sphere-traced SMOOTH UNION as the
  reflection pass's closest character hit (via `traceClosestMesh` in reflect_p5.wgsl — `passes.rtP5` also rides bit 2; reflect.wgsl untouched), OFF; **4/8/16/32** = (iii)
  the EXPERIMENT `charSoftShadow`: `direct_common shadowSample` tests boxes only (`occludedTBoxes`) for sharp-class lights and multiplies in `charSoftVis` (analytic strip
  coverage of the light's disc per cone, or iq's soft march), returns `.y = SOFT_CLEAR_Y`; restir / direct write `−SOFT_HINT_FLAG` as the hint of a pixel darkened only by
  it and denoise.wgsl `shTemporal` shortens that pixel's history where it moves (`SOFT_HINT_BAND`; the à-trous reads it as no hint) — accurate (within ±0.05 of a 64-ray disc
  integral) but no better than the sampled estimator on the trailing metric, OFF; bit 1 is retired (it switched the cones in over the capsules), **all bits 0 = the plain
  round-cone loops.** Knobs `settings.sdfRigSmooth / sdfRigK / sdfRigSteps / charSoftShadow / charSoftAnalytic / charSoftSteps / charSoftK / charSoftMinDeg / charSoftSmooth /
  charSoftBroad` (Tab ▸ Renderer — SDF character rig; `?sdfsmooth` / `?charsoft` / `?charsoftmarch` from boot), `__sdfrig {smooth, soft, analytic, live, fit(), table(),
  knobs(), set({}), summary()}`, `__rigTrace(rays)` (render/rigDebug.ts: the queries on the live scene group vs a disc integral). QA: `probes.ts sdfrig` (fit / pack /
  presets = no preset switches it), `tools/qa/rig-identity.js` (`__idrun`: seeded-restart stills with men on screen, hashable boot to boot), `tools/qa/sdfrig-harness.js`
  (`__sr`: views, ratio profiles, mask IoU, dynamic scenes on chaos-scenes, cost / stress A/B, validate), `sdfrig-figure.ts`, `sdfrig-page.py`.

## Froxel volumetrics (renderer v3 Phase 2b)

- **Froxel volumetrics (renderer v3 Phase 2b)** — `settings.froxelVol` per TIER since 08-12 (`quality.ts Caps.vol`: ultra / high ship `'classic'` = the PER-PIXEL march for haze
  AND smoke with every kept light shadow-rayed every step — volK 6, volEvery 1 — because the maintainer, shown the pre-v3 build beside main, picked its smoke: 'this looks better …
  let's just get the smoke better and we can ship'; medium and below `'froxel'`; `?nofroxel` / `?froxel` force either for the visit — froxelVeto / froxelForce; Tab ▸ Volumetrics —
  froxels; docs/internal/p2b-froxels.md). `render/froxels.ts` + `shaders/froxel.wgsl`: a camera-frustum grid W × H × D (H / D / k / history per tier in `PRESETS[*].froxel`:
  ultra 180×56 k5 · high 135×64 k4 · medium 108×48 k3 · low 80×32 k2 · verylow 64×24 k2 — every tier's froxel is 7–9 of its own pixels; W follows the WINDOW aspect;
  slices exponential in distance along the pixel ray between near = max(`froxelNear`, camera height − `Engine.FROXEL_CONTENT_TOP` 8 m) and `froxelFar` 56 m — THE
  mapping is `froxelDist / froxelSlice / froxelDir / froxelFetch` in common.wgsl, fed by `frame.froxelA/B/C` + `prevCam`), kernels in ONE 'volFroxel' compute pass
  (a fixed cost per tier — auto quality counts it in `fixed`): `cull` (8×8×4-froxel clusters vs every light — range · 0.002 floor · cone · panel facing · kind 2 under
  the ceiling — and every live smoke domain → 64-bit light mask + smoke masks) → `inject` (HAZE: 4 sub-rays across the froxel, each light's lit chord along them
  ANALYTIC (sphere ∩ cone ∩ half-space, closed-form ∫1/d²), the k strongest by unshadowed in-scatter get a shadow ray from a point inside their chord (the strongest:
  `froxelTopRays` equal-weight depth strata — ultra 3, high / medium 2), × `smokeTransCoarse` toward the light, transient lights EXCLUDED → raw volume) ‖ `injectJ` (on the
  half-res J grid: the SMOKE's source radiance J at texel centres — no jitter, one shadow ray per kept light (the sun: the mean of 4 depth strata), every texel every frame, only texels whose trilinear reach touches a live domain — and the
  TRANSIENT lights' haze, un-jittered, → `froxelTransient`, only while `frame.rcJitter.w` > 0) → `temporal` (reprojection through prevViewProj / prevCam.xyz /
  last frame's near in prevCam.w, clamped to the box of its 4 neighbours across the screen, weight `froxelHistory` 0.93 halved where it had to clamp) → `integrate` (per column,
  Hillaire's energy-conserving step, + the transient volume). Consumers: composite `froxelVol` = ONE `froxelFetch` (cubic B-spline across the screen — `froxelSharp`
  for plain trilinear — linear along the ray, `froxelBias` slices nearer, default 0) laid behind the 2D pass's smoke transmittance; the particles' splat likewise.
  volumetrics.wgsl under the flag keeps ONLY the smoke's per-pixel density march (`smokeMarchJ`: the per-domain stretches, lit by one J fetch per step, read half a
  slice nearer on purpose — the floor-straddling texel is dark under the slab) + the rain + `volReact` — so `volQuarter` now means 'smoke march + rain at quarter res'.
  **Since 08-12 (fix/smoke-look, docs/internal/smoke-look.md, `tools/qa/smoke-look.js` `__sk`) the march LIGHTS the K strongest lights per stretch per step ITSELF (`settings.smokeMarchLights`
  = K, `frame.volCfg.w` bits 8‥11; presets ultra 4 · high 3 · medium 2 · low / verylow 0; K 0 = J-lit exactly as before, hash-identical; Tab ▸ Volumetrics ▸ Smoke) and injectJ keeps
  only the ambient for those texels: J's one sample per 0.6 m slice of a steep self-shadowed light field had flattened the showcase plume (~15 % over-bright, billow modelling gone)
  and made a lamp-lit plume pulse through SCREEN-FIXED bands whenever camera or smoke moved (the maintainer's 'banding only near the sodium light' — temporal, no still shows it).
  K3 = the exact per-pixel march billow for billow; +0.22 ms union at high at the showcase doorway, +0.44 in the worst lot framing.** Memory: 3 haze volumes + J + transient (half-res) + clusters,
  rgba16f — ultra ≈ 86 MB · high 56 · medium 27 · low 10 · verylow 5; re-made (history restarted) on a preset hop / window reshape, let go after 10 s off. QA / measure:
  `tools/qa/froxel-ab.js` (`__froxab.ab(march, froxel)` over the stress minute: vol-total = Σ passes named vol*, union, contended frames dropped; `.runAll()` over the
  tiers), `tools/qa/froxel-scenes.js` (`__fxs`: the fixed-torch look rigs — beams / plume / trail / flash / door / lot / sdFrames), `__froxel` {on, grid, state, set(),
  split(), restart(), summary()}, `__hotFroxel(src?)` (recompile froxel.wgsl from disk into the five pipelines), `passes.froxelSplitTiming` ('volInject' /
  'volTemporal' / 'volInteg'). Guards' smoke sight lines and the light meter are untouched (CPU / probe paths never read the froxels).

## ReSTIR DI = the direct-light estimator

- **ReSTIR DI = the direct-light estimator** (renderer v3 phase 2a, `settings.restir` default ON; `?norestir` = direct.wgsl's leader / tail estimator bit for
  bit — its helpers only moved verbatim to `direct_common.wgsl`, prepended to both; docs/internal/p2a-restir.md has the estimator, the numbers and the crops).
  `render/shaders/restir.wgsl` keeps the exact per-pixel unshadowed scoring (U stays exact — the candidate pdf) and the two-class S/U + hint outputs (dtemporal /
  softblur / composite untouched consumers; softblur only opens its ratio clamp under `FrameFlags.Restir`), but spends a FIXED shadow-ray budget per pixel
  whatever the light count: per class one reservoir per pixel {light slot, 16×16 emitter-lattice point, W, M, V, hint, p̂} in a ping-ponged 8×8-tiled storage
  BUFFER pair (group 2: +2 storage buffers in the compute stage — 10 of 10 at ultra on Metal), a fresh candidate drawn ∝ its unshadowed share and shadow-rayed,
  every ray traced and the history reprojected from the surface point at the UNJITTERED pixel centre (`RestirU.jitter` = this frame's + the previous dispatch's
  TAAU jitter: under a still camera a pixel inherits its OWN reservoir — reprojecting the jittered P handed over the neighbour's every other frame and biased soft
  shadows 4–10 % dark; U stays exact at the jittered point) through prevViewProj + the g-buffer's `gVel`, re-mapped by LIGHT IDENTITY (`lights.ts`: `prevData` = the
  previous upload's records, `slotFwd` / `slotInv` byte maps, `dirMasks`; all in the pass's 4.3 KB uniform) and RE-TRACED (visible-then-occluded = dropped; a pixel
  whose samples all came back dark KEEPS a zero-weight reservoir with its M — dropping those biased soft shadows +5‥35 % bright), MIS-combined against last frame's
  light records (a light new this frame enters at full weight: flashes light instantly), confidence cut by its own symmetric target ratio and by a per-tile paired
  z-test between fresh and temporal estimates (`restirGradient`; its signed z also releases a dark history meeting a lit sample per pixel — a walking man's
  shadow's trailing edge), k spatial taps with pairwise MIS (only where history is young unless rays ≥ 5). SHADED (08-11, docs/internal/p2a-restir.md §5) as
  the luminance estimate Σw × hue(Σ_i E_i·β_i): the exact unshadowed irradiance of every live light the pixel BELIEVES visible — β 0 for the lights the 8×8
  tile's own rays found dark everywhere and lit nowhere in the 5×5 tiles round it (per-tile LIGHT BELIEFS: a DARK + a LIT bit per light slot in one 16-B
  record per tile behind the reservoirs in the same buffer, remapped by identity, rebuilt from the tile's shadow-ray outcomes every frame, zeroed on a
  camera cut) and for the pixel's own 6-bit `darkSlot` (spare texel bits: the light its fresh ray last found dark inside a lit tile = a coloured shadow's
  interior); shading each sample in its OWN light's hue (the first cut, `restirSampleHue` A/B) made a red/blue per-pixel mosaic under the two vending
  fronts. Tile-dark lights also LEAVE THE FRESH DRAW (`restirKnownDark`, default on: known dark like a reach-masked light — no ray, none of the coin-flip
  noise a street lamp behind the wall put on the break-room lino) while whole tiles spend one AUDIT ray a lane on the dark set on `restirAudit` (¼) of their
  frames, votes only; a blocked ray toward a tile-dark light sets no blur hint. (The v3 shadow client's `ratioHi` and softblur's clamp still open to 4× under
  `FrameFlags.Restir` = 1073741824.) Tiers = `restirRays` (2‥6: 2 = re-trace / fresh alternate per class by frame · 3 = both re-traced + one fresh alternating · 4 = both + both ·
  5 = + final ray for spatial picks · 6 = + a second fresh) / `restirSpatial` / `restirHistory` in `PRESETS[*].restir` (ultra 4/5 · high 4/3 · medium 4/2 · low
  3/2 · verylow 2/1, cap 20); Tab ▸ Direct light ▸ restir rows (+ `restirRadius / GradK / Young / SpatialAll / Coherent / SampleHue / KnownDark / Audit` A/B knobs); debug views 11 (history M
  per class, gradient resets) / 12 (rays · taps · neighbour-shaded per pixel) — the filter chain steps aside for both; `__hotRestir(src)` / `__hotDirect(src)`
  hot-swap either estimator against a staged scene; `tools/qa/restir-bench.js` (`__rb`: measure / ab / diag / hot / slope / quality / dyn* / stressAll /
  meter). The moon and the breach's sun carry a DIRECTIONAL reach mask (`reach.ts reachMaskForDirectional`, `game.buildDirReach`: outdoor cells + indoor cells
  with a static path skyward) used only while restir is on. Ignored by this path: CheckerDirect, dimRays, directSamplesTop/Other/AdaptiveMin (the OFF path's
  knobs). **HYBRID (08-12, docs/internal/direct-quality.md): lights carried by characters (owner byte ≠ 0 — torches, Sam's rail / gun light, muzzle flashes,
  tracer heads) BYPASS the reservoirs at the pixels they reach and take `settings.heldRays` (`Preset.restir.held` 8/6/4/3/2) STRATIFIED emitter samples each from
  the raster's own point, shaded exactly; static lights keep ReSTIR statement for statement.** The maintainer's torch A/B (`?norestir&nosharp` 'looks great', main
  'very noisy, lots of rims') is what it answers: pool noise on a moving torch OLD 0.113 · reservoirs 0.207 · hybrid 0.111. `settings.restirHueSplit` fixes a
  believed far light's hue tinting an unrelated penumbra; `sharpSliver` / `gbaaClamp` are the sharp-direct same-surface rules. heldRays 0 = the reservoirs alone. **UNDER A MOVING CAMERA (lane fix/direct-motion, docs/internal/direct-motion.md; `settings.restirMotion` default 6, `?norestirmotion`, `__dmo`, Tab ▸ Direct light ▸ 'restir: motion — …'): restir.wgsl is compiled TWICE behind `const RESTIR_MOTION` and the twin dispatches only on frames the camera moved (`passes.restirMotionLive` ← `engine.camMovedAny`; a still camera runs main's program — the default tree hashes as main in every still): a pixel's reservoir memory is whole under `restirMotionV` 1.1 px a frame @1000 rows of its OWN motion (measured off the raster's point through prevViewProj + gVel) and cut to `Preset.restir.motionMin` × the cap past 1.6× that, with ≥ `motionMin`'s sibling `motionTaps` spatial taps there (ultra .1·6, high .1·0, medium .2·6, low .5·6, verylow 1.0·6) — the walking pan's flow at high −7 / −43 / −27 % (dark floor / light's edge / lit floor), ultra −28 / −51 / −50, main's 1–3.7 % motion darkening gone, +0.2 ms union while panning at high, 0 at rest; the stochastic-bilinear reprojection (bit 1, + `restirMotionDither`) is an A/B row and a negative at slow pans.** A resize / preset hop re-creates the reservoirs zeroed (one frame of fresh candidates re-seeds them). Measured: direct 5.95 → 3.16 ms at high
  1368×770 in the stress minute (9.3 → 5.1 at 1777×1000), 13.2 → 7.1 ultra, 3.96 → 1.98 medium, 2.08 → 0.98 low, 0.87 → 0.45 verylow; nearly flat in the
  light count where the old pass paid ~0.27 ms a light.

## TAAU (renderer v3 phase 1)

- **TAAU** (renderer v3 phase 1, `settings.taau` default ON; `?notaau` = the old chain byte for byte, `__png`-identical to main; docs/internal/p1-taau.md):
  the scene renders at the INTERNAL size under a Halton(2,3) sub-pixel jitter and `render/shaders/taau.wgsl` (compute pass 'taau', ≈0.25 ms at 1777×1000)
  resolves each frame into an OUTPUT-resolution history = the cap's rows (`engine.outWidth/outHeight`, the canvas backing store; `engine.width/height` stay
  the internal size) that bloom → post → the final blit (RCAS-style sharpen `taauSharpen` instead of FXAA, + grain) read. THE RULES: `frame.viewProj /
  invViewProj / prevViewProj` ARE the jittered matrices (this frame's, and the previous RENDER's) — the g-buffer, `worldFromDepth`, every reprojection into an
  internal-res history and the particles' splat all agree; only the resolve's own uniform (`passes.setTaauFrame`: last frame's UNJITTERED view-projection) and
  the CPU (`cam.viewProj`, the HUD) see unjittered ones — never build a screen ray from `cam.*` on the GPU side. The g-buffer writes per-pixel OBJECT motion
  (`gVel` rg16float: previous box transform matched by index + size + owner from `gbuffer.prevBoxes`, previous joint palette `prevJoints`, both snapshotted at
  the tail of each frame — `gbuffer.snapshotPrev`); the history's alpha is view depth (disocclusion test); reactive inputs = the particles' r8 `react` target
  (their splat's second attachment) + the volumetric pass's `volReact` (rain / sky flash). History drops on a cut (eye moved > 2.5 m or turned > 30° between
  renders, `engine.resetTaa(why)`, counted in `__taa`), on TAAU / debug-view switches; an output resize (preset cap, window) resamples it like the other
  histories; a render-scale step touches only the internal targets. Presets start at ultra 0.9 · high 0.77 · medium 0.67 · low 0.6 · verylow 0.5 of the cap
  with per-tier `taauPhases / taauClipGamma / taauSharpen` (`quality.ts startScale`; 1.0 everywhere with TAAU off); knobs `taauAlpha / ClipGamma / Phases /
  Sharpen / Reactive / Kernel / VelK` on Tab ▸ Frame + the pause card's trade-offs row; `__taa` {on, jitter, resets, lastReset, stats, knobs(), set({}),
  reset(), summary()}. Debug views bypass it (plain upscale, jitter held at 0).

## Sharp direct (decoupled resolution)

- **Sharp direct** (decoupled resolution, lane v3/sharp-direct; docs/internal/sharp-direct.md, page docs/review/sharp-direct.html; `settings.sharpDirect` — `defaultSettings` off,
  switched ON at every tier by `quality.ts Preset.iq` since the image-quality program (next bullet); `?nosharp` / `?sharp` force it, Tab ▸ Frame, `__sharp {on, live, edgeRays, knobs(),
  set({}), summary()}`): live only under TAAU below scale 1.0 with no debug view (`engine.sharpOn`, decided in `engine.resize`). The g-buffer is rasterised at the OUTPUT size (`gbuffer.ts` O set + `encodeDown` / `gdown.wgsl`: the internal-size targets everyone binds are
  a one-texel-each SUBSAMPLE — never averaged), `sharp_direct.wgsl` ('sharpU', group 0 = the OUTPUT frame block `engine.frameBufOut` / `sceneBGOut` whose screen =
  the output size) re-scores every light's exact unshadowed U per output pixel with direct.wgsl's statements and multiplies by the ratio S∕U joint-bilateral upsampled
  from the internal denoised pair (`passes.sharpE`, 2 × rgba16f output-size), `composite.wgsl` compiled twice behind a prepended `const SHARP` (false = the fragment
  composite as it was; true = its compute twin `cs` per output pixel, 'compS', guides via `gpx`) and `taau.wgsl` likewise (the 1 : 1 resolve). `frame.sharpCfg` =
  (in W, H, out W, H; z 0 = off), `sharpCfgB` = the edge-ray knobs. OFF is main byte for byte (hash-proven at high + medium). Cost +1.9 ms union at high (stress p95
  13.0), +0.4 medium; memory +78 MB at high. `settings.sharpEdgeRays` (default off) = `sharp_edge.wgsl`'s hard-edge mask + one centre ray per flagged output pixel
  (contact shadows 4.9 → 1.6 px, but it hardens a soft penumbra overlapping a hard one — left as an experiment). QA: `tools/qa/sharp-harness.js` (`__sh`), `sharp-metrics.py`,
  `sharp-page.py`; identity = `__sh.identityHash` vs main served beside.

## The resolve configuration per tier (image-quality program)

- **The resolve configuration per tier (image-quality program, docs/internal/image-quality.md; page docs/review/image-quality.html)** — `quality.ts IqTier` on `Preset.iq` (all five
  tiers ship `IQ_C3J` = sharp direct + DECOUPLED jitter + GBAA + the history de-blur 0.5; ultra starts at scale 0.9 so sharp direct is live there; `IQ_OFF` / `?noiq` = the resolve
  exactly as it was = main's frame hash for hash at every tier; `?nosharp` drops sharp + its two riders, `?sharp` / `?gbaa` force on): (1) `settings.sharpDecouple` — under sharp
  direct the OUTPUT raster (g-buffer, exact U, composite, GBAA, the 1 : 1 resolve) runs on the camera's UNJITTERED matrices (`writeFrameOut(…, mats)` overwrites viewProj /
  invViewProj / prevViewProj in the output frame block, the resolve's jitter is 0) while the INTERNAL raster keeps the ±½-internal-px Halton jitter; `frame.sharpCfgC.xy` @736 =
  that jitter, added by every internal ↔ output texel map (gdown `outTexelOf`, sharp_direct `sIn` / `sharpOutTexel`, composite `gpx` / `ipos` / `pin`, taau + particles_draw vol
  texel) — 0 = one jitter for both rasters, the sharp path as it was; (2) `settings.gbaa` — GBAA (Persson): gbuffer.wgsl `boxEdgeOffset` writes a 6th target `edge` rg8unorm (signed
  px distance to the shown face's nearest edge along its major screen axis, from box-local coords + dpdx/dpdy; caps / cut walls / skinned men = none; a real distance never encodes
  as none), `gbaa.wgsl` (compute 'gbaa' after the composite + particle splat, in place on hdr via `passes.hdrCopy`) blends each crossed pixel with the neighbour across the edge by
  the far side's coverage in tonemapped space and lends an edge to the far-side neighbour only if that neighbour is not in FRONT (depth) — wants a 1 : 1 unjittered raster
  (sharp + decouple, or `?gbaa` = + `taauPhases 0` via `gbaaForce`); sub-pixel slivers stay aliased (documented residual); (3) `settings.taauHistSharp` — taau.wgsl adds k ×
  (Catmull-Rom − bilinear history fetch) in tonemapped space while a pixel is being resampled (motion), 0 = off; TaauParams 144 B; (4) `settings.motionIds` (E1, default ON,
  `?nomv`) — `Box.mkey` + `MKEY` ranges (doors / props / items by serial / rig props by owner+ordinal / devices; owner-0 lasers unkeyed) → `BoxWorld.upload` packs `visible[i] =
  index | pslot << 16` (0 = the index rule, 0xFFFF = keyed-but-new, else 1 + last frame's index) and gbuffer.wgsl `vsBox` reprojects a keyed box through `prevBoxes[pslot − 1]`
  after a shape check — a spawn / despawn under a mover no longer hands it a stranger's transform; ON hashes as main in a still. ReSTIR A/B rows from the program (all default
  off, measured worse or a trade): `restirPenCap`, `restirPenRays`, `restirPermute` (+ the older `restirSpatialAll` = D2: −37‥41 % lamp-floor crawl for +0.5 ms high / +1.8
  ultra, softens contact shadows). Harnesses: `tools/qa/iq-harness.js` (`__iq`: VARIANTS / apply / crawl / noise / dyn / cost / pageCrops / battery / batteries / `tier(tier,
  {batteries, chaos, stress})` fire-and-forget → docs/perf/iq-<tag>.<parts>.json), `tools/qa/chaos-scenes.js` (`__chaos`: P0 walk through the torch beam, P0p under panels, P1
  kicked door, P2 can under the lamp, P2b can through the beam, P3 ragdoll, P4 chair shove, P5 churn, P6 N debris; `run / go / goAll` → docs/perf/chaos-<name>.json + crops),
  `tools/qa/iq-report.py` (tables; `--json docs/perf/iq-summary.json`) → `iq-prose.py` + `iq-page.py` → docs/review/image-quality.html. Boot the harness pages with `?noiq` so
  'main' means main.

## The denoiser (renderer v3 phase 3)

- **The denoiser** (renderer v3 phase 3, `settings.denoiser` `'v3'` default | `'legacy'`; `?legacydenoise` = dtemporal + softblur, temporal + giblur and the **HIDDEN CARRIED LIGHTS (10-10, `settings.dnShadowOccl` default ON, `?noleakfix` = as it was, Tab ▸ Denoiser ▸ 'shadow: hidden lights stay hidden', `__dn.set({shadowOccl})`):** U counts a guard's torch the surface does not see, so the ratio S ∕ U carries the hidden cone's shape and any blend of ratios across its edge (the jittered bilinear history fetch, the à-trous, sharp direct's 2×2) drew that edge on the far side of the wall. The shadow client reads every à-trous tap and the history under two hypotheses (ratio stands / S stands = ratio × U_there ∕ U_here) and takes the point of that segment nearest this pixel's evidence (`denoise.wgsl occlScale`, `fetchFootU`, `meanS5`); sharp_direct.wgsl mixes U_out × ratio with the taps' mean S by the slope of ln S on ln U over the taps (`fitSlope`, `frame.sharpCfgC.z` bit 15). Seen on the software adapter only (`tools/qa/torch-leak-stills.cjs --staging pair`): static leak 7 → 3 of 255 (noise), moving 26 → 8; a faint blob remains under a sweeping torch. The same switch covers the temporal stage's neighbourhood statistics (`stats5Sh`): texels where a class has no light at all (shPack's prior, ratio 1) stand in as the centre's own sample in the 5×5 mean / σ and the history clamp's box always holds the pixel's own sample — counted as measurements they clamped a 1-px unlit face's history of 0 up to ≈ 0.3 and a lamp hidden behind the wall showed there as a thin bright line (the fire exit's head and jamb).
  gloss chain byte for byte, hash-identical to main; docs/internal/p3-denoise.md): ONE core (`render/shaders/denoise.wgsl`, one module / five entry points;
  `render/denoise.ts` = pipelines, layouts, the 112-B `DnParams` uniform, a bind-group cache; passes.ts owns every texture so they ride the pool / resample-on-resize)
  behind THREE clients — SHADOW (full res, both emitter classes per dispatch, in RATIO space r = S/U: `shPack` → softtile's `tileDistances` → `shTemporal` →
  `shAtrous` ×N, the last writing S = U × r̂ + the signed hint back into `dS`, so composite / fgather / debug view 9 read what they always read; U is exact and
  never enters a history, so switches / sweeps / flashes are immediate and only visibility is smoothed), DIFFUSE (`giTemporal` + fast history → `radAtrous` ×N
  ending in `gi[0]`), SPECULAR (`specTemporal` with virtual-hit-point reprojection off the hit distance fgather now writes into the specular alpha, roughness
  STAND-IN `dnSpecRough` until phase 4 → `radAtrous` SPEC ending in `spec`, gi[1] as scratch; runs under Gloss | Glass). Core = reprojection through
  `frame.prevViewProj` + `gVel` (motion vectors on both the TAAU and FXAA paths), 2×2 history taps validated ONE BY ONE by depth (+ a 3+3-bit normal for the
  shadow client) off one `textureGather`, per-pixel history length (5 bits per class) → α = 1/n up to the tier's cap, EW mean / VARIANCE of the incoming
  sample luminance (West's form) with the 5×5 spatial variance standing in under 4 frames, history CLAMPED into the frame's 5×5 mean ± k·σ (a 12×12
  workgroup apron) — the transient rule — plus the shadow client's light-motion cue (lumU rides in the value history's alpha) and temporal-gradient cue
  (`dnShadowMoveCap / MoveThresh`), then the variance-guided edge-stopped à-trous (plane distance × normal power × luminance/σ; the shadow client keeps
  softblur's lit-alike weight, PCSS hint prior = kernel reach, and hint-free tile pass-through). Timings file under 'softblur' (shadow) and 'temporal'
  (gather grid) whichever core runs — 2.03 ms at high for all of it. Textures by role: value history = `dH[c][p]` (ratio + lumU) / `indHist` / `specHist`
  (rgb + view depth), `dnHm / dnHg` (moments; r32uint depth | len0 | len1 | normal — `nearest32u` resamples it), `dnShared` ping-pong, `giMom / giFast /
  specMom`; a legacy ↔ v3 switch zeroes the direct + moment histories. Tiers `Preset.dn` (shadow iters/cap · gi iters/cap · spec iters = ultra 4/16·5/32·2,
  high 3/12·4/24·1, medium 3/10·3/16·1, low 2/8·3/12·1, verylow 2/8·2/8·1); every knob on Tab ▸ Denoiser (under v3 `directHistory > 0` is the shadow
  client's temporal switch and `directBlurCap` its width cap; `directPasses` is legacy-only); debug view 13 = the shadow client's σ per class + history
  length; `__dn` {mode, knobs(), set({shadowIters…}), stats, summary()}, `__hotDenoise(src?)` recompiles the core from disk into the live page; the
  in-page instruments are tools/qa/p3-harness.js (`__p3.costAB / sdAB / directRef / indirectRef / strafe / doorSpill / muzzle / lightsOff / validate /
  identityHash`). A ReSTIR estimator plugs in unchanged (S + hint + U per class); its per-light hues open the ratio clamp like the chroma-exact tail
  (`K.ratioHi` in engine.ts).
