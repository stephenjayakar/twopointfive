# Particle rain — the lane's notebook (exp/particle-rain → MERGE PREP, 08-12 night)

> **WHERE I AM / NEXT (resume block, kept current):** MERGE-READY. main merged in twice (6b7c372, c61c580), the exit-sign fix (1fd587d), defaults ON + `?norain2` / `?rainv1`
> (ec772d7), identity of the OFF path against main served beside CLOSED at high + medium (6f88527), gates green + validate sweep clean + cost recorded (f253df4, docs/perf/prain-merge.json),
> the merge-prep section + the page regenerated (b55feb4). Servers: lane :5208 / sink :5209 up; the :5210 main snapshot stopped; pane tabs closed. Left for the lead: merge
> `exp/particle-rain` at its tip (this commit), restart :5173, re-freeze the panel inventory fixture if wanted (35 added rows), decide the two taste calls in 'Merge prep' below.

Pages: `docs/review/particle-rain.html` (v1, 08-11: what was built, V1–V5 today/hybrid, cost per tier, the burst test, verdict) and
`docs/review/prain.html` (v2, 08-12: the look and the wind, v1-vs-v2 crops, the gust strip, cost). Numbers: `docs/perf/prain-numbers.json` (v1),
`docs/perf/prain-v2.json` (v2). Harness: `tools/qa/prain-harness.js` (`__pr`), builders `tools/qa/prain-page.py` (v1) / `tools/qa/prain2-page.py` (v2).
Boot with `?prain` (or Tab ▸ Weather ▸ 'EXP: particle rain'); `__rain` on the console.

## v1 (08-11) — a near-field layer of real GPU drops over the lattice

The storm's rain on main is a LATTICE of drop columns evaluated analytically along every outdoor view ray (volumetrics.wgsl (c)): flat cost, any
density, but a streak is lit unshadowed, cannot end on the thing under it, and has no parallax of its own. v1 adds, behind `settings.particleRain`
(off; `?prain`):

- a `'rain'` particle kind (render/particles.ts; id 6 since the merge with main's motes — it was 5) in a THIRD ring of 16 384 slots past the two
  gameplay rings, its Window in the emit block's tail (EmitBlock.rainWin) so the header / records / gameplay windows keep their layout; its own
  12-record queue, head / tail / FIFO and 640-births-a-frame budget; prepare() deals rain strictly AFTER the gameplay records, never queues it, and
  reports it apart (`rainStats`) — a downpour can neither delay a chip nor be delayed by one (the page's burst test: a 2-s FN2000 burst born frame
  for frame as without it);
- the RECYCLER (game/rainFx.ts, once a frame after the weather — and, since v2, after the wind): target = the lattice's own drops-per-m² at the
  current rate × the OUTDOOR ground inside a disc of R = 0.6 × the camera distance round the look-at point (capped per tier:
  `settings.particleRainCount` 6000 / 4000 / 2500 / 1500 / 800), one 'rainDisc' record a frame (the GPU rejects the interior / annex footprints per
  drop), DRIPS off roof / car / housing edges found once from the level's boxes, and `frame.weatherE` = the disc + the share of the lattice it replaces
  (volumetrics.wgsl `rainNearKeep`) so nothing doubles up and the far field stays the lattice's;
- the drop's step (particles.wgsl `rainStep`): fall + drag, the swept segment through the trace grid AND the character capsules, a hit on anything
  visible and up-facing = the drop becomes its splash crown in place, the invisible roof / a wall at a graze / the dry column = gone unseen; lit by
  the three strongest SHADOW-TESTED lights (the cone glows, the building's shadow cuts the rain — which the lattice cannot do); the splat
  (particles_draw.wgsl `rainVertex` / `rainFragment`): a velocity-aligned 1.5-px AA capsule, additive, reactive for the TAA, discarded over indoor
  surfaces; the crown = one surface-aligned quad drawn procedurally.
- OFF is main to the last bit (proven against the base commit, storm on, gameplay particles alive).

Cost (v1's page): the particles compute pass 0.14–0.18 ms for ~1 750 drops at rain 0.55 at every tier; union +0.17 ms at high in the one clean
interleaved take; +1.25 MB of pool. Verdict then: ship the hybrid (particles own the disc, the lattice the far field), decide the streak's look.

## v2 (08-12) — 'looks good but kinda flat … Arkham City's rain reacts to lighting, specular / refracting … and could it answer some wind outside'

### What the reference does, and what a drop actually is

The polycount / UE technique the maintainer linked lights each rain-streak SPRITE per pixel through a NORMAL MAP of a refracting drop: the
scene colour behind is fetched offset by the normal (refraction), and the scene's lights put SPECULAR kernels on the sprite where the normal
lines up — so streaks near a lamp flare and streaks over the dark all but vanish; the streak reads as glass, not chalk. Physically a streak is
one ~2 mm water sphere smeared over the shutter: it (a) REFRACTS what is behind it — a wide, minified, side-swapped view, i.e. mostly the
average of a broad cone behind — (b) scatters each light toward the eye by a PHASE FUNCTION that is anything but grey: the transmitted (p = 1)
fan is strongly FORWARD (a drop between the eye and a lamp flares; one lit from behind the eye is dim), the external reflection is weak (F₀ 0.02)
except at grazing, and (c) a big drop OSCILLATES at a hundred-odd Hz, so its streak photographs BEADED. v1 had (b) as an isotropic constant
(0.045 × E) and neither (a) nor (c): every streak in the lamp's pool was the same cream bar — that is the 'flat'.

### What v2 builds (all under the same switch; `PRAIN` in game/rainFx.ts = every number, Tab ▸ Weather ▸ p-rain rows, kept per machine)

1. **The drop's phase, per light, after its shadow ray** — particles.wgsl `rainShadeV` / `rainPhase`: particleLight's loop (reach masks, the three
   strongest by luminance shadow-rayed, the rest at the untraced credit) with each kept light weighted by `iso + fwdK · HG(μ; fwdG)`
   (μ = cos of the scattering angle: 1 = the eye looks into the light through the drop; the lobe is 4π-normalised so iso + fwdK = 1 keeps v1's
   all-angle calibration) **+ the strand glint** of the water cylinder along the streak's axis T: a normalised 1-D lobe in T·H of width
   `glintRough` + the emitter's angular half-size (Karis' area widening — which is also the energy bound: a mirror shows a lamp at the lamp's own
   radiance, never more) × Schlick for water, capped per light at `glintCap`. Defaults iso 0.25 · fwdK 0.75 · fwdG 0.55 · gain 1.9: the follow
   camera (drops lit from its own side, under the lobe) reads ~0.8 of v1, side-lit 1.1×, 55° off a light 2.3×, straight into it 11×. The LATTICE
   takes the same phase through `frame.weatherF` (volumetrics.wgsl `rainLight(X, V)`; w 0 = its isotropic sum exactly as it was), so near and far
   flare and dim alike. Honest note: in this game's geometry (lights over the drops, the camera over the drops) the strand glint's condition
   (H square to a near-vertical streak) is rarely met — measured ≈ nothing at the torch view; it lives for street-level views and costs nothing.
2. **The tail keeps last frame's shade** — `rainStep` stores the previous head shade (f16 × 3 in omg / omgZ, which a rain drop has no use for) and
   the vertex hands it to the tail corners: the point a frame's fall up today's streak lit exactly as it was then, so a streak entering a beam
   brightens along its length. Free; measured small (few streaks straddle a hard light edge at any instant).
3. **Refraction of the scene behind, through the SHARED module** — `src/render/shaders/refract_common.wgsl` = the solid-glass lane's
   (feat/solid-glass-refraction) binding-free module COPIED VERBATIM (`fresnelSchlick` / `fresnelF0`, `refractDir` → (dir, 1) or (mirrored, 0) past
   the critical angle, `slabExit` for boxes, `beerLambert`, `refractProbeDist`, `screenRefractPx`, `clampRefractOffset`; a first cut of this branch
   carried a stand-in with the announced names until their text arrived — replaced), prepended to the splat. particles_draw.wgsl `rainRefractTap`: the streak is a thin water cylinder along its world axis (octahedral in the vertex's spare
   varying); per tap across the width x ∈ {−0.7, 0, +0.7} the eye ray refracts in through the visible normal N = A·x + Vp·√(1−x²) (eta 1/1.333),
   crosses the circular section, refracts out where the section's outward normal is N mirrored about the internal ray's cross-section
   direction, and the exit ray is followed to the SCENE'S DEPTH behind the drop (the g-buffer depth at the pixel less the drop's own, capped at
   `refractReachM` 6 m — the module's plane probe `refractProbeDist` wants the g-buffer normal, which the splat does not bind) and projected onto
   the splat's own raster with that raster's matrix (`screenRefractPx(E, d, dist, frame.viewProj, dims)`: the internal block's jittered matrix, or
   under sharp direct — where the splat runs at the OUTPUT size against the output depth with the output frame block — the unjittered one; either
   way what `worldFromDepth` inverts there), the offset through the module's screen guards (`clampRefractOffset`, capped at 0.12 × the frame's
   height as the glass does); × the two Fresnel transmissions (F0 0.02, both interfaces — the glass keeps its single-interface split for its legacy
   hash, water has none to hold; a millimetre of clear water absorbs nothing, so no Beer–Lambert term); the module's two refusals stay the caller's
   as it asks: a read landing on something NEARER the eye than the drop by `refractDepth`, or on the sky, keeps the pixel's own read; each fetch's
   display luminance held under `refractClamp` × white. Laid 'OVER' the background by the streak's coverage (the blend is one /
   one-minus-src-alpha; the scatter stays additive on top): over an even field a streak vanishes into it, beside the pool's edge it carries the
   pool out over the dark asphalt, over the red car it goes pink. WHAT IT SAMPLES: `passes.hdrCopy` — with GBAA on (every preset) that copy is
   refreshed AFTER the overlay, so at splat time it holds LAST frame's composite (post-splat, pre-GBAA): a frame stale (invisible for a blurred
   wide-cone fetch; drops move 10+ px a frame so self-feedback is a geometric series with ratio ~1 %) and FREE; with GBAA off (`?nosharp` /
   `?noiq`) `passes.setSceneCopy` keeps an hdrCopy of the same shape, hdr gets COPY_SRC, and the particles copy hdr → hdrCopy right before their
   splat (measured inside the noise at high). No copy texture (particle rain off) = a 1×1 stand-in bound and rainCfgC.x zeroed. TAAU: the splat's
   reactivity is now what actually changed on screen (the scatter's display luminance + the refracted share's difference from what was there),
   so an invisible streak asks nothing of the resolve.
4. **The population's spread and the streak's width** — per-drop length × (1 ± `lenJit` 0.45) and brightness (0.5 + 1.5 h², `brightJit` 0.7 —
   the lattice's own `big`), BEADS (`beadAmp` 0.4: 3–6 beats along the streak off the drop's hash), a half-width CEILING (`maxPx` 1.1 px: a drop
   two metres off the lens is a thin bright line, not an 8-px bar — narrowed and brightened by as much up to `boostCap` 2.5), a longer near fade
   (`nearFadeM` 2.6: no depth of field, so the drops under the camera's nose go).
5. **WIND** — the drops ride main's wind field: `WIND_KINDS_DEFAULT` includes the rain kind, the emit kernel adds `windAir(pos)` at birth (a drop
   enters the slab already carried: the storm's vector, its gust, its lee 1.5 m off the facade), `rainStep` drags toward the air (`v = vAir +
   (v − vAir)·e^(−k dt)`, k = g / 9 m/s: a drop answers a gust over ~0.9 s, as a real one does) — so the streaks SLANT with the storm and swing
   with its gusts; × `windK`. The LATTICE far field is handed the same air: rainFx.ts writes `frame.shearX/Z = −air × latticeLean (0.92 = the mean
   of the height profile a drop falls through) ÷ 9`, low-passed by the drops' own drag constant — of the OPPOSITE sign to weather.ts's raw shear:
   the lattice's columns lean toward +shear at the top and its drops slide toward −shear, so on main the lattice rain drifts AGAINST the wind
   field's storm (the smoke, the paper and the motes go the other way) — verified in the page's wind-proof pair (particles + lattice under v2 lean
   one diagonal; the lattice alone with main's sign leans the other). One-line candidate for main: `weather.ts` frame.shearX/Z = −wind ÷ RAIN_V.
   SHEETS: births are thinned on the GPU by `(1 + amp·n) ÷ (1 + amp)` on a smooth value noise of (position − ∫air dt) ÷ `sheetLen` 7 m (`sheetAmp`
   0.5, `sheetDrift` × the air), the CPU filing (1 + amp) × as many; over the 4-m strips of lot round the office the noise is a handful of values,
   so the population under the disc swings ±30 % as sheets pass (by design: curtains) and its long mean is the target. Door gusts: main's door
   source is a jet INWARD from an open exterior door — where there is no rain — so the rain's visible wind is the storm's slant / lee / gusts.
6. Panel / hooks / harness: 28 `PRAIN` rows + 'v1 look' / 'v2 defaults' buttons; `__rain.look / setLook({}) / resetLook() / wind / sceneCopy`,
   `__hotRain()` rebuilds all three particle pipelines from disk (particles_common / particles / particles_draw / refract_common);
   `prain-harness.js`: views `torch` (a fixed hand-torch light down the east strip, from low) and `lamplow`, `look('v1'|'v2')`, `abLook`,
   `costLook`, and stage() switches the wind's gusting OFF unless asked (it is a noise of the game clock, which a stage does not rewind — with it on
   two stills disagree; the FIRST stage after a boot also differs from every later one, so warm one up before an identity pair).

### Numbers (M4 Max, Chrome / Metal, `?paused&quality=high&mute&prain`, 1368×770 → 1777×1000, the lot view, storm forced, serialized frames)

See `docs/perf/prain-v2.json` and the page for the final table. The interleaved take before the physical refraction landed read: today (rain
off) union 10.13 ms · v1 look 10.41 (particles pass 0.188 ms, ~1 880 alive) · v2 look 10.29 (0.190 ms, ~2 430 alive — the sheets had a dense
curtain over the disc) — v2 within the noise of v1, both ~+0.2 ms over today; the explicit hdr copy (GBAA off) inside the noise (10.255 vs
10.266). The final take (3 refraction taps through the module, beads) is on the page.

### Caveats

- The refraction samples LAST frame's composite when GBAA is on (free) — a frame stale; under a fast pan the fetched background lags a frame
  behind the streak (never noticed at 22-px-class offsets, but it is there); the first frame after a resize fetches an uncleared copy (one dark
  flicker on the streaks). GBAA off pays a copy instead and is current.
- The strand glint and the tail term are physically placed but measure ≈ 0 in the follow / torch views (geometry); the visible v2 is the phase
  (forward flare from low angles), the refraction, the spread / beads / thin lines, and the wind.
- Sheets make the alive count swing ±30 % round the target as they pass; cost tables must quote alive counts (they do).
- `refract_common.wgsl` is the glass lane's file byte for byte (copied from its worktree before either branch merged; the lead reconciles the two
  copies at merge — they should be identical). The glass itself does NOT read hdrCopy (it re-shades the G-buffer at the displaced pixel inside the
  composite); a splat drawn after the composite reads the composite's copy, which is why the rain owns `passes.setSceneCopy`.
- Harness determinism, refined: the first TWO stages after a boot differ from every later one (warm two up); from the third on, repeated stages match
  to the TAA floor.
- Determinism: gusts off + one warm-up stage for identity pairs (above).
- Not done: door gusts do not touch rain (inward jets); no rainbow / glory lobes; the far lattice's blockiness at grazing distance is pre-existing.

## Merge prep (08-12 night) — what changed at the merge, the exit-sign fix, identity, gates, cost

**The merge.** `main` (85bba7a) merged into the branch: the motes are gone on main, so rain is particle KIND 5 of six (`P_KINDS` = spark debris dust casing sheet rain,
`P_RAIN` 5u, `KIND_RING.rain` 2, `WIND_KINDS_DEFAULT` + rain, `KINDS_DEFAULT` without it, `IMP_RESPONSE.rain` inert in game/sheetModel.ts so the table stays the one source);
the emit block's header is main's derived `48 + 48·kinds` (`KP_FLOAT` / `KI_FLOAT`), EmitBlock `kp: array<vec4f, 12>` / `ki: array<vec4f, 6>`, and the rain TAIL (rainWin + the six
rainCfg rows at `BLOCK_TAIL_AT`) stays behind imps — `tools/qa/destruction-probes.ts`'s 'imps end the struct' line (red on this branch since the tail existed) now accepts exactly
that tail and checks its offsets against particles.ts. `refract_common.wgsl` was already main's byte for byte (no union needed). Frame: main's tail ends giCfg @784, so weatherE /
weatherF sit at 800 / 816 → `FRAME_BYTES` 832 in frame.ts (byte table + writer) and common.wgsl (struct order); `frame-layout` green. The p-rain rows became their own SECTION
'Rain — particles' under the two-level panel's Weather & wind system (35 rows: the switch, cap / radius / density / brightness / lattice share / reactivity / drips, the 27
PRAIN look + wind rows, 'v1 look' / 'v2 defaults'); the per-kind physics rows under Renderer fx ▸ particles skip the rain kind (its slots are the recycler's).

**The exit-sign bug** (the maintainer, with a screenshot: 'some droplets by the exit sign are lit up even though the sign is only indoors — screen space stuff?'). Yes: the
streak's refraction reads the composite's copy in SCREEN space, and the top-down camera looks straight through the NoPrimary roof, so the green-lit corridor floor under the
east exit sign sits a few pixels beside the drops falling OUTSIDE that wall — a tap up to 0.12 × H px across the streak landed on it and the streak came up green (reproduced:
docs/shots/prain_signfix-sign-before-x3.png, wind set toward the wall so drops fall beside it; with `refract 0` the green is gone, so it is the taps, not the lighting — the
sign's area light has reach level 0 in every cell east of the wall). THE FIX (1fd587d): `particles_common.wgsl rainRoofed(P)` = inside the interior / annex footprint AND
below the ceiling slab; `particles_draw.wgsl rainRefractTap` refuses a read whose reconstructed world point is roofed exactly like one nearer than the drop or on the sky (the
pixel keeps its own read) — rain only exists outdoors, so nothing under a roof is ever behind a drop; a wall top or a rooftop unit (above the slab) still shows. After:
docs/shots/prain_signfix-sign-after-x3.png (same boot, same staging, same drops: 105 → 0 green pixels in the ×3 crop; the streaks elsewhere pixel-identical). Second spot, the
lobby frontage from above with the west lamp on (lit floor behind glass beside the drops outside): prain_signfix-lobby-before/after-x3.png — no visible change (the mullions
keep the taps short of the floor there), i.e. no collateral. AND the direct term: a drop's lighting was already 'three strongest shadow-rayed', but every FURTHER light was
credited untraced at 35 % wherever its CPU reach mask allows — and the carried / transient lights (torches, muzzle flashes, device cones, tracer heads) carry REACH_ALL. Now
(`particles.wgsl rainShadeV`) a light whose SOURCE is roofed never takes the untraced credit on rain (it reaches a drop through an opening or not at all; if it matters it is
one of the three and gets its ray); the lot's own lights are in the open and count exactly as before (the lot view is unchanged: prain_signfix-lot-after.jpg). The lattice
far field (volumetrics.wgsl rainLight, unshadowed by reach mask — main's rule) is untouched: pre-existing, out of the disc, noted.

**Defaults.** `settings.particleRain` TRUE in `defaultSettings` (v2 look = PRAIN's defaults; caps per tier `Caps.rain` 6000 / 4000 / 2500 / 1500 / 800 applied by every preset).
`?norain2` boots the lattice rain alone (the OFF path); `?rainv1` boots the layer with the v1 look for the visit (nothing saved); `?prain` still forces on. Live: Tab ▸ Weather &
wind ▸ Rain — particles ▸ 'particle rain (near field)' (off = lattice only) and the 'v1 look' / 'v2 defaults' buttons (PRAIN_V1_LOOK, kept per machine like every PRAIN row).

**Identity (the OFF path = main hash for hash).** `tools/qa/prain-harness.js __pr.identity()`: ONE CONFIG PER FRESH BOOT, main = a `git archive` of main 85bba7a served on
:5210 (the main checkout carried another lane's uncommitted edits tonight), lane = ec772d7 `?norain2` on :5208, same pane; seeded restart, per view the storm forced (no
strokes, gusts off), a debris burst beside the look-at so the gameplay rings are live in the frame, 6 + 60 frames, render at frame.time 100, FNV of the readback. high 1777×1000:
lot 1c59de44 · exit 020f6036 · glass 92bb22e6 on BOTH; medium 1600×900: lot cc0040f2 · exit 7d91f80e · glass 0613b71e on BOTH (docs/perf/prain-merge.json).

**Gates** (f253df4): typecheck clean; `bun run build` ok; `sh tools/qa/gate.sh particles weather wind perf destruction` all green; `probes.ts journal-fixtures` 2/2 identical WITH
rain on by default (it is presentation-only: rainFx reads the wind / weather / camera and writes only the particles and the WeatherFrame); pane: 103/103 pipelines, 0 failed,
no validation-scope / uncaptured / console errors across ultra → verylow with the storm on, a stroke, debug views, the glass view; panel-inventory 0 missing (35 added).

**Cost** (high, serialized, interleaved ×3, GPU shared tonight — lightly contended, blocks within 0.4 ms): lot view lattice-only 10.67 ms union → v2 10.96 (+0.30; the particles
pass 0.17 ms for ~2500 drops alive, volumetrics unchanged 0.15); playing INDOORS while it storms 12.50 → 12.60 (+0.10, ~370 drops alive off screen). +1.25 MB pool; the scene
copy is GBAA's own at every preset (no texture added).

**For the lead to decide (taste, one-liners):** (1) `PRAIN.refractClamp` 6 × white — how bright an emitter seen through a streak may get; (2) whether the far LATTICE should
also lose indoor lights' unshadowed credit (main's rule today; only visible past the disc's rim). Neither blocks the merge.
