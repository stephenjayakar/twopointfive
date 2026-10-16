# P4 — materials and detail everywhere: one BRDF, ray-traced reflections on the shared denoiser, the detail layer (2026-08-10/11, lane `v3/p4-materials`)

Brief: docs/internal/renderer-v3.md / STATUS "RENDERER V3" Phase 4 — port `exp/rtreflect` (398e7c4, never merged: docs/internal/exp-rtreflect.md on that
branch) onto main properly, plug its reflections into P3's SPECULAR client instead of its own two denoise shaders, make its GGX + Smith + Schlick the one
BRDF used wherever it is affordable, and add a DETAIL layer under the maintainer's art rule (STATUS.md: keep the blocky flat-shaded look; high-frequency
content only from physical systems — light, shadow, smoke, particles, rain, wetness, wear you can explain — never painted texture detail). Tiers for the
reflections; the BRDF, the finish table and the detail layer at every tier. Machine / method as the earlier phase notes: M4 Max, Chrome (the Browser
pane) / Metal, dpr 2, this worktree on :5185 (shot sink :5186; a scratch worktree of main on :5193 for the identity hashes), `?paused&quality=…&mute`,
SERIALIZED frames (one offscreen render → `queue.onSubmittedWorkDone()` → MessageChannel yields → the timer's per-frame stamps + `unionMs`), interleaved
A/B (ABAB blocks) read at the median with the p95 beside it, crops = 300-px tiles of the OUTPUT frame ×3 nearest unless stated. Instrument:
tools/qa/p4-harness.js (`__p4.go / gradeSet / costAB / sd / identityHash / validate`, views staged through `__stage`, guards parked dark, Sam invisible,
phases zeroed, grain off). ReSTIR (P2a) merged into this branch at 72bd2ed before the final tables; every number below is on the merged tree.

## 1. What was ported, what replaced what (files)

- **The finish** (`src/scene/boxes.ts` Box.rough / metal / aniso → ONE f32 in boxMat row 1's `.w` — `matWord`, decoded by `common.wgsl boxFinish`; the word used
  to carry the owner, which no shader read from there): from the branch as it was. `levelData.ts` MaterialData / BoxData gain optional `rough` / `metal` (KEYS,
  validator, `loadLevel` box over material, `levelToData` writes only what the paint does not already say — a palette finish is one line in `materials`), the
  office's finish table `officeGen.ts OFFICE_FINISH` (stone 0.15 · lino 0.22 · metal 0.28 metal · glassFrame 0.4 metal · screenOff 0.08 · white 0.5 · wood 0.55
  / 0.6 · red 0.45 · walls / carpets / concrete ≥ 0.85 …, the racks 0.3 and the server floor 0.35 on the call), `levels/office.json` re-exported (`probes.ts level`:
  0 diffs, not stale, canonical), door leaves 0.55 / steel 0.3 metal + handles 0.25 metal (`doors.ts`), the storm's wet lot 0.22 + anisotropic (`weather.ts`, put
  back with the albedo it already restores).
- **The g-buffer's MATERIAL target** (new): `gbuffer.ts / gbuffer.wgsl` write a 5th colour target `mat` (rg8unorm: r = GGX roughness, g = metalness) per pixel — the
  box's finish after the detail layer; characters and section caps write (1, 0), the clear is (1, 0). 18 B per sample of the 32 the default limits allow. Every
  consumer of roughness reads THIS (reflect.wgsl, the denoiser's specular client, composite), so the detail layer's wear reaches the reflections and their
  highlights for free and no consumer decodes the box word per pixel.
- **The reflection pass** `render/shaders/reflect.wgsl` (adapted): one thread per texel of the reflection target (internal ÷ `frame.rtCfg.w`); per pixel under
  `rtMaxRough` — GGX-VNDF half vector (Heitz 2018) at the pixel's roughness (anisotropic on the wet lot: αx = α(1 − 0.6a), αy = α(1 + 5a) along the view's
  projection), white-over-the-screen Cranley-Patterson offsets stepped by R2 per frame, `traceClosest`, hits shaded like gather hits (`gather_common.wgsl` — the
  light / card staging + `directAtPoint`, split out of fgather.wgsl textually, both include it) with emissive fixtures returning radiance (area panels split
  traced-on-polish / analytic-on-rough by `emitTraceK`), glass panes on the segment tinting + mirroring, weight F · G2/G1, `rtRays` of them (0‥4); plus `rtGlints`
  = the analytic GGX image of every steady point / spot lens and (× 1 − emitTraceK) each panel's kind-3 light, four strongest shadow-rayed + smoke, the rest at
  half — **the primary-hit specular response of the finish to the level's lights** (direct.wgsl / restir.wgsl untouched: it lives here). Out: radiance + ray 0's
  hit distance (48 on a miss, the strongest highlight's distance with 0 rays, −1 = no term). Reads the g-buffer's albedo (F0 of a metal, brighter on a worn edge)
  and material targets. `frame.rtCfg` = (maxRough, rays, aniso, divisor — 0 = OFF this frame), `frame.matCfg` = (highlight gain, strength, ray luminance bound,
  detail); Frame 624 → 656 B, no flag bit (the last one went to ReSTIR the same night; tools/qa/frame-layout.ts rows added).
- **reflect_temporal.wgsl + reflect_atrous.wgsl are gone.** The reflections ride the P3 SPECULAR client (`denoise.wgsl radTemporalCore / specTemporal / radAtrous`,
  `denoise.ts encodeRadiance(…, spec = true, refl = true)`) in a new **per-pixel mode** on a second parameter block (`paramsRefl`: the reflection grid's own divisor
  in flags.y, `sp2.w` = the roughness cutoff > 0 switches the mode; the gather-res chain the glass panes / legacy gloss ride keeps `sp2.w = 0` and its statements
  verbatim — `?nortreflect` hashes prove it, §5): roughness per texel from the material target instead of the `dnSpecRough` stand-in; texels with no term (rougher
  than the cutoff, a man, a cap, hitT < 0) never enter the 5×5 statistics (the apron's no-term slots are filled with the tile's mean term texel), never count as an
  à-trous tap, keep history length 0 — and hold their tile's mean reflection as their VALUE so composite can sample bilinearly without a dark seam; the mirror image
  reprojected through `frame.prevCam` (P2b's, already in the block) and validated on the pixel's own plane (last frame's eye ray to P + V·hitT cut by the plane —
  rtreflect's test, exact for a planar reflector, replacing P3's 5 % surface-depth tolerance), with the SMOOTHED hit distance riding in the client's fast-history
  slot (specFast / reflFast pairs — the gather-res chain gained a real fast pair too, unread there); the history cap scaled by roughness (a polish ~6 frames, lino
  ¾ of `rtHistory` 32) and shortened by how far the clamp had to move it; the à-trous reach = the lobe's footprint (1.4·α·hitT / (z + hitT) × focal, 0.7 of it
  settled, 2.2× + 1.5 px young; taps stop at a roughness step and at no-term texels) — contact hardening. `passes.ts`: refl / reflScratch / reflHist[2] / reflMom[2]
  / reflFast[2] at the reflection grid, pooled and resampled across a resize or divisor change like the gather's (`setRt`, `reallocRefl`), 'reflect' + 'rdenoise'
  compute passes after 'temporal', composite bindings 12 (refl, filterable) + 13 (the material target).
- **Composite** (`composite.wgsl`): `reflK` = (1 − smoothstep(maxR − 0.12, maxR, rough)) × strength off the pixel's own material; `refl` = ONE bilinear fetch of the
  reflection texture at the pixel's position on its grid (the branch's 3×3 joint-bilateral over depth / normal / material cost 36 loads a pixel and ~0.5 ms of
  wall-clock at high on a screen of lino for the same picture under TAAU — measured, §2) × reflK × the decals' gloss-keep, through the pane's transmission; a
  metal's diffuse × (1 − 0.7·metalness) only while rays are traced; debug view 10 = every specular term, 14 = the traced term, 15 = the material target.
- **The detail layer** (`shaders/detail.wgsl detailSurface`, called by fsBox while `frame.matCfg.w > 0`; `render/wear.ts` builds the traffic map the floor terms
  read, bound at the g-buffer's group 1 binding 6; `game.ts` builds it from the level + nav grid at boot; the viewer / editor keep a 1×1 zero) — §4.
- **Plumbing**: `engine.ts` settings `rtReflect / rtReflectDiv / rtRays / rtMaxRough / rtAniso / rtStrength / rtGlints / rtAtrous / rtHistory / detail`, Gloss held
  DOWN while the reflections are up (rtReflect ⊃ gloss); `quality.ts Preset.rt` per tier + `rtVeto` + `REF.reflect` in the cost model; Tab ▸ Materials +
  reflections (every knob + the detail slider), the pause card's row, `?nortreflect` (off + vetoed for the presets), `?detail=`, `__rt`, `__hotReflect`, HUD
  'reflect' / 'rdenoise'; `tools/qa/materials-probes.ts` (`probes.ts materials`, alias `rtreflect`: finish through the level format, presets + veto, rtCfg / matCfg
  / Gloss off a fake-device Engine + main's Frame bytes, the VNDF sampler, the analytic panel vs a quadrature, the traffic map).

## 2. Cost (five tiers; A = reflections off + detail 0, B = the tier as shipped: reflections per its row + detail 0.35; union of compute passes, serialized)

Calm views (`__p4.costAB`, 4 ABAB rounds × 24 frames): 'vending' = the break room's NW corner, a screen of lino under two glowing vending fronts (the worst
indoor case); 'corridor' looking west from x 20; 'lot' = the east lot in the rain under the sodium lamp; 'cubicles' = the P0–P3 still (mostly carpet).
Two takes an hour apart at high; ms, union median (p95):

| tier (internal → output; refl grid) | vending A → B | corridor | lot | cubicles | reflect + rdenoise (vending) |
|---|---|---|---|---|---|
| ultra 2133×1200; 1067×600 · 2 rays · ≤ 0.55 · 4 it | 19.20 → 21.43 **+2.23** (2.29) | +1.97 (1.97) | +2.03 (1.90) | +1.24 (1.24) | 2.10 + 0.72 |
| high 1368×770 → 1777×1000; 684×385 · 1 · ≤ 0.45 · 3 | 7.41 → 8.19 **+0.78** (0.72) / 2nd take +1.05 (0.78) | +0.46 (0.46) / +0.92 (0.40) | +0.45 (0.07) / +0.53 (−0.14) | +0.19 (0.27) / +0.72 (0.79) | 0.52–0.66 + 0.26 |
| medium 1072×603 → 1600×900; 358×201 · 1 · ≤ 0.35 · 3 | +0.33 (0.19) | −0.72 (−0.65) ¹ | +0.07 (−0.06) | 0.00 (−0.59) | 0.26–0.33 + 0.13 |
| low 768×432 (reflections off: B = detail only) | +0.13 (0.53) ¹ | +0.14 | +0.13 | +0.53 ¹ | — |
| verylow 533×300 (likewise) | −0.46 ¹ | +0.26 | +0.53 ¹ | +0.65 ¹ | — |

¹ noise: at 6 ms of work the serialized GPU clocks up and down between blocks (the P1 / P3 notes have the same footnote) — low / verylow's B changes NOTHING in
any compute pass (the detail layer lives in the g-buffer's fragment stage), and their gather / direct rows wander by the same ±0.5 between blocks; medium's
corridor A drew the heavier blocks. What the reflections cost gross is stable to the timer's 65 µs quantum: **high 0.5–0.9 ms** on lino-heavy views (0.2 on the
cubicles), **ultra 2.1–2.8**, **medium 0.3–0.45**; net of the gloss ray the gather no longer traces (−0.1 – −0.2 in 'gather') the union moves by the bold numbers.
Targets: high ≤ +1.2 p95 ✓ (worst view +0.78 / +1.05 by take), ultra ≤ +2.5 ✓ (+2.23; the first take at 3 à-trous read +2.63 with an A of 22.5 — the union's
level shifts between takes, the delta held), medium ≤ +0.6 ✓ (kept ON at ÷3), low / verylow ≤ +0.2 ✓ (nothing measurable — below).
**The g-buffer** (a render pass; offscreen its stamp is honest and reads 0.131 ms at low / verylow, 0.197 at high) is the SAME at detail 0, 0.35 and 1.0 at
all three: the detail layer and the material target are under the timer's quantum. **Composite** cannot be stamped (Metal); wall-clock per serialized frame at
high on the vending view: A 14.5 → B 15.3 (+0.8) against a union delta of +0.79 — i.e. the resolve adds nothing measurable now (the 3×3 version read +1.2 wall
for +0.72 union). **Stress** — the QRF + rain + two-canister minute of tools/qa/stress-scene.js at high (`fight: false`, 39 lights, orbit 0.6°/frame over the
cubicles), `__stress.ab(A, B, 4 × 75)`: Σ compute mean / p50 / p95 / max A 10.16 / 10.16 / 10.55 / 10.81 → B 10.60 / 10.62 / 11.21 / 19.40 (+0.44 mean, +0.66
p95; the one 19.4 frame is smoke 3.1 + direct 5.2 in a single frame — a hitch in passes this lane never touches); reflect 0.26 / 0.26 / 0.46 / 0.59, rdenoise
0.13 / 0.13 / 0.20 / 0.20. Auto quality: `REF.reflect 1.3` (per REF.mpx internal at ÷2 · 1 ray; ×(1 + 0.58 (rays − 1)), × (2/div)²) in `presetCost`; quality-plan
exit 0 (18 PASS).

## 3. The look, per tier, graded from ×3 crops (docs/shots/p4/)

- **Vending fronts in the lino** (p4t_{ultra,high,medium}_vending_{contact,lobe}, main_hi_vending = today's gloss for reference): soft-edged rectangles that start
  dark under the machines' black plinths (the glowing glass begins 0.4 m up — the gap is the plinth's own image), sharpest at the top and widening toward the
  camera; ultra's edge is a little firmer (2 rays, full-res internal), medium's a little softer (÷3) but the same shape. In the composite all three are smooth.
  What the RAW term looked like before tuning (debug view 14, no TAAU): at the branch's 2 à-trous / cap 16 the lobe's fading tail was visibly mottled (p4_v14_a2c16
  ×2); the raw term's temporal sd on that tile 0.50 → 0.31 (3 it) → **0.20 (3 it, cap 32 — shipped high / medium)** → 0.14 (4 / 32 — ultra); a2 / c32 alone 0.32
  (p4_v14_a3c32, _a4c32). In the final picture (TAAU on) the reflections add no measurable noise: vending lobe sd 0.255 off → 0.275 on, contact 0.134 → 0.131
  (8-bit luma, 30 frames); TAAU off 0.40 → 0.50.
- **The wet lot** (p4t_*_lot_streak, p4t_high_lot vs main_hi_lot): the maintainer's case. Main's gloss draws a fuzzy MIRROR of the facade with the van's box crisp
  in the tarmac; here the sodium lamp is a long warm streak running to the camera and the facade smears vertically as wet asphalt does it, at every tier (medium's
  ÷3 grid softens the streak's core, still a streak). Not done: rain ripples in the streak (the splash rings are the volumetric pass's; a normal perturbation under
  them would be the physical version — left for later, it needs the g-buffer to know the ring lattice).
- **Metal** (p4t_high_storage_{shelf,upright}): the storage shelving reads as brushed steel holding a broad warm image of the bulb-lit room, and — the detail
  layer — a hair-line of brighter bare metal along each arris (p4d_upright_edge_d0 / d100). Whether bronze-looking shelves are wanted is the branch's open taste
  question still (metal → false on the material puts them back to paint).
- **Lobby stone / server floor / corridor**: physically quiet at night — Fresnel from this camera height is 4–5 %, the lobby's only bright thing is the moonlit
  frontage (its image sits under the glazing, p4t_high_lobby), the server floor 0.35 is at medium's cutoff and shows the cold panel as a soft pool, the corridor at
  night has two lit panels and a carpet runner down its middle: little to mirror (the branch said the same). The extinguisher's enamel (0.45) mirrors softly at high.
- **A torch on the lino** (p4_torch_still / _v14): the lit wall base mirrors as a warm smear at the contact, the guard's legs matte (no term — his wet coat is
  composite's), the analytic highlight glides with a swept torch (24 frames of 2.5°/frame: no trail in the crop). Under the freshly merged ReSTIR the DIRECT-only
  view of that floor is speckled (p4_tlit_v3dir — the estimator's own noise under two panels + a torch, main's business, noted for the lead); the reflection term
  over it is smooth (p4_tlit_v14 crop in the shots dir).
- **Motion**: a 28° camera turn at 0.8°/frame — the frame at the stop vs 30 frames settled differ by mean 0.98 8-bit levels with the reflections on, 0.77 off (0.6 %
  of the tile over 8 levels vs 0.04 %): a frame or two of lag in the mirror image, no ghost (p4_turn2_on_f0 / _settled). Sam walking through the vending
  reflection (p4_walk_mid, _v14): his dark capsule image rides under his planted foot, nothing trails where he passed (end vs settled crops identical by eye).
- **Glass panes** are left on their own path (fgather `glassShade`: one exact mirror ray + glints + dust → the gather-res specular chain): a pane is the α → 0,
  F = the exact dielectric Fresnel end of the same BRDF, so nothing disagrees; folding it into reflect.wgsl would only move its ray to another pass. Smudges near
  handles (roughness on glass) not done — the pane is not in the g-buffer to carry a roughness.
- **Wet man on lino** (p4_wetsam_crop / _v10): the coat's lobe (composite `wetCoatSpec`, off id bits 28 + 30) and the floor's term never meet on one pixel —
  reflect.wgsl writes no term for a character pixel and composite's reflK is 0 there; view 10 shows both, view 14 only the floor's.
- Honest misses: (a) at ultra the vending reflection's top edge is firmer than high's but not the "hard rectangle" a full-res trace gives (÷1 = 8–12 ms, the Tab
  row); (b) 1 ray + a clamp means a light switched INTO a rough mirror converges over ~10 frames (the history shortening helps; 2 rays or a ReSTIR-style resample of
  the hit's light is the P5 line); (c) characters mirror as their capsules' albedo (mesh closest-hit = P5); (d) beams / smoke / particles are not in reflections.

## 4. The BRDF at each kind of hit, and the detail layer

**One BRDF** — base colour (the box albedo, per pixel after the detail layer), GGX roughness, metalness; D = anisotropic GGX, G = height-correlated Smith, F =
Schlick on F0 = mix(0.04, base, metal); sampled by its distribution of visible normals:
- reflection-ray hits (reflect.wgsl `shadeReflHit`) and final-gather hits (fgather.wgsl): the DIFFUSE lobe only — albedo/π × (direct at the hit + the cache's
  bounce) + emission. Kept diffuse-only at secondary vertices by decision: the specular lobe's transport at a second vertex is one more narrow lobe that one ray
  has to find (a caustic-like brightening under the vending machines worth ≤ the coat's hemispherical reflectance — Schlick's cosine-weighted average F0 +
  (1 − F0)/21 = **8.6 %** of the panel light reaching that lino, against its 36 % albedo — spread by a 1 m radiance cache that cannot hold it), i.e. variance for
  an invisible term; a metal bounces its F0 AS its albedo, which is what the level authors as its paint, so its energy is already right. The indirect-only view
  of the vending corner is therefore unchanged by construction (no crop can differ).
- the primary hit's response to the ANALYTIC lights: `rtGlints` in reflect.wgsl (above) — elongated GGX highlights of torch / lamp lenses and rough-receiver panels
  on every finish under the cutoff, four shadow rays; direct.wgsl / restir.wgsl untouched.
- the primary hit's response to everything else: the traced rays.
- wet characters keep their own coat lobe (composite), never stacked with the floor's (§3).

**The detail layer** (`detail.wgsl`, amount k = settings.detail: 0 = fsBox exactly as it was, 0.35 default, 1 = as far as it goes) — every term is wear you can
explain, evaluated at the primary hit into albedo / roughness / metalness so direct light, the bounce at the pixel, the reflections and their highlights answer
to it alike; no image textures, no albedo noise on walls; the only noise is a value noise at 0.7 m cells (0.65‥1.35×) making wear patchy at arm's length:
- WORN PATHS on finishes under 0.6 rough (the polished floors): roughness + 0.42·k·traffic, albedo toward 0.86× its own grey by 0.35·k·traffic. Traffic =
  `render/wear.ts`: every patrol route's legs traced over the NAV GRID (the paths the men actually walk, waypoint to waypoint and round), stamped with a lane's
  Gaussian (σ 0.34 m), a worn patch at each waypoint by its wait, every door's threshold (σ 0.55 m), saturating 1 − e^(−1.1·passes); 320×224 rg8 over the world's
  40×28 m at 8/m (docs/shots/p4/wearmap.png: orange). Reads in the material view as a broad rougher band across the lobby stone toward the corridor and
  round the thresholds (p4d2_lobby_{d0,d35,d100}_mat); in the final picture as a duller stretch of mirror — invisible under the moon patches, visible where the
  floor reflects something (by design: roughness, not paint).
- GRIME where the mop does not reach: the map's g channel = proximity to any static standing on the floor (16 cm reach, squared): roughness + 0.3·k, albedo ×
  (1 − 0.28·k) — the soft dark halo round the sofa's foot and along every wall foot (p4d_lobby_alb_{0,35,100}). At 1.0 it reads like contact dirt / AO; at 0.35 it
  is a hint.
- SKIRTING: the bottom 13 cm of vertical faces standing on the floor: albedo × (1 − 0.3·k·band), rougher.
- DUST on the box's own top face above 1.6 m: roughness → 1 by 0.85·k, albedo toward a 0.33 grey by 0.3·k, metalness down, thinner within 7 cm of the edges. A
  black appliance top goes grey under a torch; from the follow camera the tops of the vending machines, racks and shelving are what shows.
- EDGE WEAR on metal: within ~2 cm of an edge (exact in a box world: the second face pair's inward distance) albedo toward bare steel (0.74) by 0.7·k, roughness
  toward 0.16 — the shelving's arrises, the steel door's, the handles'.
Read against the rule: 0.35 is 'lived-in' — nothing anywhere reads as a texture (there is no frequency above the 0.7 m unevenness; the map is 12.5 cm/texel and
Gaussian-soft); 1.0 makes the grime halos and skirting plainly visible and the lanes matte, still not 'textured' but heavier than the flat look wants — a slider
stop for judging, not a default. Light meter: E at Sam's chest / head at six spots (corridor panel, lobby stone, break room, server floor, storage bulb, the lot)
off / 0.35 / 1.0: 1.411 / 1.411 / 1.426 · 0.052 / 0.050 / 0.052 · 0.0097 / 0.0106 / 0.0099 · 2.35 / 2.36 / 2.33 · 36.3 / 35.6 / 35.7 · 12.3 / 12.2 / 12.3 — within
the probe's own frame-to-frame wander and non-monotonic in k: the probe traces the box scene, never the g-buffer, so wear cannot reach it (a darker worn lane
under Sam is in the PICTURE only; the meter and the guards' eyes read the light arriving, as before).

## 5. OFF identity, level identity, validation, gates

- `?nortreflect&detail=0` = main byte for byte: the deterministic still (`__p4.identityHash`: seeded dice, parked guards, zeroed phases, `__resetClock`, 40 frames +
  one offscreen render) hashed **63e04c76** (cubicles) and **99f1bd68** (the wet lot — the gather-res specular chain LIVE through the storm's gloss) on main @ 1035614
  and on this branch before the ReSTIR merge; after it (and after the review follow-ups, 442ccd0), **9e3666df** / **89136cb8** on main @ 220487b AND on the merged
  branch at high with TAAU on, **d7671c6e** / **d936a34f** on both at medium with `?notaau` (1600×900 internal, FXAA). What the branch changes on that path: the
  material target is written and bound, matWord replaces the owner word no shader read, gather_common.wgsl is the same text in another file, the reflection set is a
  1×1 stand-in never read — none reaches a pixel (the gather-res specular chain no longer even fetches / stores a fast pair in its stand-in mode).
- Level: `probes.ts level` — generator ≡ office.json (0 diffs), digest 7168ed9858f17, not stale, canonical, validator + planted faults + round trip all PASS.
- GPU validation (`__p4.validate`: an error scope + the uncaptured list across views 1–4 / 10 / 13 / 14 / 15, rt off / on, ÷1 / ÷3 / ÷2, rays 0 / 2 / 1, gloss legacy
  path, detail 0 / 1 / 0.35, denoiser legacy ↔ v3, TAAU off / on, scale 0.6 → 1.0, night vision) at all five presets: 0 errors; the viewer and the editor boot clean
  (they draw the material target and the detail terms off a 1×1 traffic map); breach daylight and the wet lot by eye during the runs.
- `tsc` clean at every commit · `tools/qa/gate.sh perf frame-layout level materials player breach glass weather wet` on the merged tree: every family ALL PASS
  (perf 24 · frame-layout 9 · level · materials 38 · player 166 · breach 13 · glass 39 · weather 12 · wet 18 check lines, 0 FAIL) · `quality-plan.ts` exit 0 (18 PASS;
  M4 Max → high ×1.0 with the reflect row in the cost table) · `tour.ts --runs 2`: 2/2 PASS, 0 warnings · `soak.ts --seeds 1,2 --minutes 6`: 0 violations, 0
  exceptions both seeds · `bun run build` clean.
- Seen while grading and NOT this branch's: at high with ReSTIR on, the lino under the two vending panels carries a sparse dark per-pixel speckle (tile sd 0.16 with
  `settings.restir` on vs 0.009 off, reflections off and detail 0 in both — i.e. main @ 220487b's estimator under two touching area lights; debug view 3 shows it
  raw; crops `docs/shots/p4/p4_grain_d0_rt0.jpg` = restir on vs `p4_grain_d0_rt0_rs0.jpg` = off, same tile ×3). Reported to the lead; the reflection term over
  it (view 14) is smooth.

## 6. Left for P5 / caveats

- P5's line as briefed: 2 rays (or a ReSTIR-style temporal resample of the hit's direct light) for the moving-light convergence; mesh closest-hit so characters
  mirror as their skinned mesh on ultra; ÷1 at ultra wants a full-res RESOLVE over the half-res signal rather than a full-res trace (8–12 ms).
- Rain ripples in the wet streak; smudged glass; LTC for strip emitters (the analytic image is a widened disc); reflections of beams / smoke / particles.
- The dust and skirting terms judge 'stands on the floor' / 'top face' from the box alone: a wall-mounted cabinet whose box happens to start at y ≈ 0 gets a
  skirting band (none in this level), a stack of boxes gets dust only on the one whose top passes 1.6 m (right by accident).
- The traffic map is built from `level.routes` at boot: the breach's scratch routes and the QRF's marks never wear anything (right), a level edited live in the
  editor keeps the boot's map until reload (acceptable: the editor builds none anyway).
- `rtRays 0` (highlights only, nothing traced) works and is what low / verylow could afford (~0.15 ms at their grids); left OFF there pending an eyeball — a lens
  highlight without the environment under it can read as a floating glint on a dark floor.
- The 8-bit albedo target quantises the worn lane's 4–5 % darkening into ~5 steps across a metre; invisible under TAAU's jitter in every crop taken, but it is
  there if someone goes looking with the albedo view at 1.0.
