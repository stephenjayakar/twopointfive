# Glass refraction (2026-08-12, branch `feat/solid-glass-refraction`)

The ask: *"is it possible for the water cooler to be more refractive without it making everything more expensive?"* — then, mid-lane:
*"let's only do refraction if there's a nice way to do it for all glass too. otherwise putting it back to just regular diffuse is fine."*
Outcome **(A)**: one refraction law for every `Glass` box — the 22 panes and the water-cooler bottle through the same code — inside
composite, default ON, OFF hash-identical to main, ≤ one timer quantum with the glazing filling the view.

## The model (composite.wgsl `glassRefractPath` / `refractedRead` over `refract_common.wgsl`)

For a pixel whose view ray meets a glass box (glassTrace's nearest pane, as before):

1. **In** — Snell at the entered face (`refractDir(V, n, 1/ior)`; never total going in).
2. **Across** — the analytic exit of THAT box from inside (`slabExit` in the box's yawed frame): the face it leaves by and the length crossed.
   A face met past the critical angle mirrors the ray back in (total internal reflection) and it crosses once more; three legs at most.
3. **Out** — Snell again (n → 1). For a pane the exit ray is the entry ray shifted a few millimetres; for the bottle's faces at right angles it is deviated.
4. **Absorption** — `glassT = trans^(glassTintDepth · len ∕ unit) · (1 − F)`, `unit` = twice the box's thinnest half-extent. The authored albedo of a Glass box is
   READ AS its transmittance square through its own thickness, so a pane square-on keeps exactly the tint it always had (exponent 1); a graze gets 1∕cosθt (≤ 1.34 at
   n 1.5) where the old rule gave 1∕max(cosI, 0.35) (≤ 2.86 — thin glass does not triple its density edge-on; the Fresnel loss both keep is what darkens a graze); the
   bottle's diagonal and mirrored legs come out deeper. Same law, no thickness switch. (Kept the single (1 − F) energy split of the panes — not (1 − F)² — so square-on
   panes hash as before.)
5. **The read** — screen space, nothing traced: the exit ray is followed to the plane of what the pixel already shows (`refractProbeDist`, exact for a floor / wall /
   desk behind; ≤ `REFR_MAX_M` 1.5 m), that point projected with THIS raster's own matrices (`screenRefractPx`: `frame.viewProj` — the internal raster's jittered one, or
   the sharp output raster's unjittered one), the offset capped at `REFR_MAX_PX` 0.12 × height and shrunk continuously to stay on screen (`clampRefractOffset`), and the
   read REFUSED (the pixel keeps its own) where the sky shows there or the surface there is nearer than the exit point (a mullion, a sill, a man in front of the neighbouring
   stretch: nothing in front of the glass can be seen through it). Under half a pixel — every pane anywhere near square-on — nothing moves.
6. **What is re-read at `sPix`**: albedo, normal, id, depth → point, denoised direct, upsampled indirect, emissive + markings, RT reflections, wet coat, cap. **What stays
   on the pixel**: the pane's own reflection field (fgather's glassShade through the specular chain, guided by the pixel's `zg` / `Ng`), the crack stars, the fog.

Why inside composite and not a post pass over an HDR copy: composite is where the transmission tint is applied and it cannot read its own output; a post pass would have
had to un-tint or have composite skip glass, copy 14 MB of HDR when GBAA is off, and reproduce the pane's reflection / fog terms. Re-shading the G-buffer at the displaced
pixel costs a glass pixel the loads it already made (moved a few texels), costs a non-glass pixel nothing, and is right on both rasters by construction.

## Identity, cost, validation (M4 Max, high, 1368×770 → 1777×1000, sharp + GBAA live)

- `passes.ts` compiles composite and its sharp twin a second time behind `const GLASS_REFRACT: bool = true` (`pCompR` / `pCompSR`); false = the module as it was.
  OFF vs main, `__rf.identity()` on a fresh `?paused` boot (cubicles · confGraze · lobby · bottle · confFill): `07f30383 · b6fcb7c3 · e60a6c12 · 25ae7f3f · 3d8500c7`
  on main and on the branch with refraction off = **hash-identical, 5 / 5** (and again 3 / 3 on a later boot for the views whose staging the harness kept). A single-module
  runtime branch was tried first: 55 scattered ±1 LSB pixels even with no glass on screen — Metal's codegen moves when live code is added — hence the const twin.
- Cost, interleaved off/on ×4 rounds, serialized medians (`__rf.cost`): conference glazing filling the view **compS 0.983 → 1.049 (+0.066 = one timer quantum), union +0.066**
  (a second boot: +0.066 / +0.065); the same glazing at a graze +0.065 / +0.066; the lobby frontage filling the view +0.066 / +0.066; the bottle close up ±0.00 compS;
  cubicles (no glass on screen) 0.000 everywhere. One quantum wherever glass covers the frame, nothing elsewhere.
- `__rf.validate()`: 45 steps — five presets × refraction on/off, sharp × GBAA × refraction, debug views 1‥17, glass off/on, ior 1.0‥2.0, TAAU off/on, scale — no
  validation errors, nothing uncaptured. The fragment composite (sharp off) and `?notaau` render the same refraction (docs/shots/refract_bottle_on_nosharp_bottle.jpg / `_notaau_`).
- Gates: typecheck, frame-layout, `gate.sh perf glass materials` (24 / 42 / 47 PASS), build.

## Crops (docs/shots, ×4 tiles; `refract_<view>_{off,on}[_<tile>].jpg`, lossless pairs in docs/shots/ab/ — gitignored; `refract_bottle_hero.jpg` = the whole frame under the torch)

- `refract_bottle_*_bottle`, `refract_bottleTop_*_bottle` — the bottle under Kowalski's torch: OFF a pale hollow cube you see straight through; ON a solid block — the wall corner and
  the cabinet edge displaced per face, mirrored legs, denser rims.
- `refract_confGraze_*_paneEdge` / `_farPane` — the conference glazing at ≈ 70° incidence: the door leaf and chair feet through the pane sit ~4 output px along the corridor
  (the slab's lateral shift), no smear at the mullion, the far panes pixel-alike; the room reads a touch lighter through the graze (the 1∕cosθt law).
- `refract_confFill_*` / `refract_lobbyFill_*` / `refract_lobby_*` — square-on glazing: alike to the eye (nothing moves under half a pixel).

## Knobs / hooks

`settings.glassRefract` (ON) / `glassIor` (1.5; 1.33 water, 1.0 = no bending), `?norefract`, Tab ▸ Renderer — glass ▸ refraction + index of refraction, `__glass.refract /
.ior`; `frame.glassCfg.w` = the index while on (0 = off). `glassTintDepth` still scales the exponent. Harness `tools/qa/refract-harness.js` → `__rf`.

## Limits (documented, not fixed)

- Screen space: what a bent ray sees must already be on screen behind the glass; off screen / behind the eye / nearer than the exit → the un-displaced read (seamless by
  the continuous shrink, but it is a fallback).
- The read is the nearest G-buffer texel (TAAU's jitter dithers it smooth over frames; a `?notaau` still shows internal-pixel steps inside the bottle).
- TAA reprojects the bottle's interior with the motion of the surface BEHIND it: mild ghosting inside the bottle under a fast camera.
- One index for every box (no per-box ior in the pane record); the entry Fresnel only.
- Light THROUGH glass is not bent (no caustics): direct.wgsl's `glassTransmit` tint is untouched, as are fgather's mirror ray and the CPU sight / sound / shot rules.

## Shared with the rain lane

`src/render/shaders/refract_common.wgsl` is binding-free on purpose: the particle rain's water streaks (exp/prain) prepend it for `refractDir` / `beerLambert` /
`screenRefractPx` / `clampRefractOffset` / `fresnelSchlick`; they sample `passes.hdrCopy` (their splat runs after composite), the glass re-shades the G-buffer.
