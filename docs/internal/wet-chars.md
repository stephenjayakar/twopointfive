# Wet characters — the weather's other half (`wet-chars`)

Branch off `fb09d9a` (main with the weather merged). The ask: *"the rain looks sick but I think we need to have characters that get wet and become
glossy if they're out in the rain … make it look cool (like a shader that simulates raindrops rolling down)"*. `settings.wetChars` (default ON);
off — or nobody wet — is the character shading bit for bit as it was (proven below). Tab ▸ Weather ▸ **wet** rows + *soak Sam now / soak everyone /
dry all*; `window.__wet` {on, get(i|'sam'), set(i, wet, beads, rain), soakAll, dry, knobs, save, reset, stats, prints(), summary()};
`probes.ts wet`.

## What to look at first

1. **Walk out of the break-room door into the lot and stand under the sodium lamp** (rain rate 1 on the Weather panel makes it quick): over
   six seconds Sam's suit goes from matte to a dark glossy film that streams down him in streaks, drops bead on his shoulders and run, the lamp
   glints hard in the wet. `docs/shots/wet_lamp.jpg` / `wet_lamp_crop_head.jpg` (dry reference `wet_lamp_dry*.jpg`).
2. **Wait for a lightning stroke out there** (or Tab ▸ Weather ▸ *strike now*): the whole figure sparkles white for the flash.
   `wet_flash.jpg` (three frames into the decay — the best read), `wet_flash_peak.jpg` (the whited-out first frame), `*_crop.jpg`.
3. **Come back inside soaked and walk under a guard's torch / any lamp**: the beads run off in ~3 s, drops fall from his hands and hem, he
   leaves a trail of wet boot prints for ten steps that dry out over half a minute, and the coat itself dries over ~25 s.
   `wet_torch.jpg` + `wet_torch_crop_head/chest/legs.jpg` (the money shot: a torch on a soaked Sam), `wet_drying_sheet.jpg`
   (0 / 8 / 16 / 24 s), `wet_prints.jpg` + `wet_prints_crop.jpg`.
4. **A guard in the rain**: `wet_guard.jpg` / `wet_guard_crop.jpg` against `wet_guard_dry_crop.jpg` — khaki gone dark and glossy on the
   shoulders. `wet_ultra_lot.jpg` is the live game at ultra (the guard's own torch on Sam under the lamp).

## Where the wetness lives

**CPU, one model** (`src/game/wet.ts`). Every `Character` carries `wet` (the coat 0‥1), `beads` (0‥1) and `wetRain` (the rate the beads
were fed at). `updateWetness(g, dt)` runs once a frame from `Game.update` right after `weather.update`:

- OUTDOORS = outside weather.ts `INTERIOR` [4,4,36,24] and `ANNEX` (the very rectangles the rain is drawn by) AND `openSky`: five upward
  `col.solidBlocked` rays (over the head and 0.35 m out each way, head + 0.15 → 9 m) through the level's own collision boxes; roofed only if
  ≥ 3 are blocked — a canopy or a landing shelters, the cobra head of the street lamp he stands under does not (the probes caught that one).
  Cached 0.25 s per man (WeakMap): ~4 ray fans a second per outdoor man.
- IN RAIN = outdoors while `rainNow(g)` = `engine.weather.rain` > 0 — what the frame actually draws, so the storm off, held by day (the
  breach) or a dry storm all mean nobody soaks.
- coat += `WET.soakPerSec` × (0.4 + 0.6·rate) /s (1/6: soaked in 6 s of downpour); beads rise 3× that toward 0.35 + 0.65·rate; out of the rain
  coat −= `dryPerSec` (1/25), beads gone in `beadRunoffSecs` (3). Everybody: Sam, the shift, QRF units, the breach cast, a body in the lot.
- Sam only, the player's eyes only: **drips** for `dripSecs` after coming in (particleFx `'debris'`, rate ∝ beads — none headless) and **wet
  boot prints** (`wetFootfall` at player.ts's step site → a `'wetprint'` decal, kind 6, per step for `WET.prints` steps, strength = budget
  left × how wet; `agePrints` lowers `Decal.param` at 4 Hz via the new `Decals.touch()` and retires them with `Decals.remove()` inside
  `printFadeSecs`; `clearWetPrints` in resetLevelState). Nobody reacts to prints — see follow-ups.

**How it reaches the shader: per-character INSTANCE data, no uniform, no Frame-layout change.** `CharInst` (anim/characters.ts,
gbuffer.wgsl) grew 32 → 80 bytes: `wet` = (coat, beads, rain, per-man phase), `wetK` = (bead density, bead radius, trail length, film
roughness), `wetK2` = (damp-cloth roughness, darken exponent, darken multiplier, specular gain). game.ts writes them through
`wetInstance` + `wetKnobs` only while `settings.wetChars` AND (wet > 0 or beads > 0); otherwise the rows are zeros and `fsSkin` never
enters the wet branch. `frame-layout.ts` untouched and green.

## The shading model as built

**g-buffer, `fsSkin`** (character pixels only, only when the instance's wet row is non-zero):

- *Darkening*: `kd = lum(albedo)^(darken·coat) × (1 − darkenMul·coat)` (defaults 1.0 / 0.35: soaked khaki drops to about a quarter, and
  because it is the cloth's own luminance to that power, dark cloth drops hardest); `albedo' = mix(grey, albedo·kd, 1 + 0.25·coat)` (a touch
  more saturated) — with the chroma faded out below a luminance of ~0.03, because **the albedo target is 8 bits a channel** and a blue-black
  suit taken to 0.002 stores as (0,1,1)/255: teal Sam, found the hard way. Undersides (`n.y < 0`) take 70 % of the coat.
- *Surface parametrisation* (`wetSurface`): the BIND-POSE position (a T-pose: +y up, +x his left) read as tubes — legs about (±0.086, ·, −0.016),
  the trunk and neck + head about the vertical axis, the arms about the shoulder line (y 1.427, z −0.06) with v = 1.25 − |x| so water runs OUT
  toward the hands. u = arc (m), v = metres decreasing downstream, salt = which tube. Drops stick to the cloth whatever the pose does; the seams
  (hips, shoulders, the atan2 wrap on his right flank) cut the odd streak.
- *Film* (`wetFilm`): value noise on (u / 1.4 cm, (v + creep) / 16 cm) — vertical streaks creeping down 1–3 cm/s — thresholded so ~half of
  him carries film at full soak (soft shoulder), nothing dry. Its normal TILT is what makes it read as water rather than a glossy mannequin: the
  rivulet's shoulders lean across the streak (`band` × slope), and a fine isotropic wobble (`WET_FACET` 6 mm patches, never under 2.2 px,
  sliding down at 2.5× the creep, ±`WET_FACET_TILT` 0.42) leans every patch its own way — from up here a low lamp can only mirror in a surface
  that leans toward the half vector, so a scatter of patches GLINT white and the glints wink and drift down him. Deliberately not anti-aliased
  away (a sub-pixel glint is still a white pixel to a camera).
- *Drops* (`wetDrops`): columns `WET_COL_W` 3.2 cm × cells (run + 2r + 3 cm) over (u, v); one drop per live cell (hash < density × beads: they
  empty one by one as the beads run off); radius `beadSize` × 0.75‥1.25; forms (fades in) at a hashed spot, sits for half its period
  (`mix(2.5, 7 s)` ÷ (0.4 + rain)), lets go and runs `trailLen` × 0.7‥1.3 with `smoothstep` acceleration drawing a trail that narrows behind it,
  spent (fades out); the run ends inside its cell so no neighbour is evaluated. A bead = coverage (faded by coverage under a pixel across) +
  an outward tilt (−d.u, d.v) — a flattened cap.
- *Output*: roughness (damp cloth `roughDry` 0.55 → soaked-cloth mix; film / trail `roughWet` 0.12; standing water 0.05; + Tokuyoshi–Kaplanyan
  kernel `alpha² += ½·Var(n)` from `dpdx/dpdy(v.normal)` and the bead's cap fan, so a limb's highlight is a line and a bead answers whole),
  gain (`specGain` × max(0.15·coat, film·(0.35 + 0.65·coat), 1.8·bead)) and the tilt, packed by `packWet` into the **id's low 20 bits**
  (rough5 | gain5 | tiltT5 | tiltB5, masked) with **bit 30** raised. A dry pixel keeps 0xFFFFF and bit 30 clear; every other id reader keys on
  bit 28 / the owner byte (checked: direct, fgather, composite's upsampleSpecular). Albedo alpha and the normal are untouched (the normal feeds
  the denoisers' guides).

**composite, `wetCoatSpec`** (only when `(id & 0x50000000) == 0x50000000`): tangent frame off N (`T = up × N`, `B = N × T`; the g-buffer's
tilt convention matches: +u ↔ −T, +v ↔ +B), `Ns = normalize(N + 0.9·(tT·T + tB·B))`; per light that `lightReaches` this cell:
`evalLight(li, P, 0)` square-on, skip N·L ≤ 0, GGX `D` at `a = rough²` widened by the emitter's angular half-size (`radius / 2d`; the moon's
radius is angular) × (a/a')², height-correlated Smith `Vis`, Schlick F (F0 0.02, bases clamped — the first review's NaN catch), summed as
`E × D × Vis × F × NsL`; × `vis = lum(Ed) / lum(Σ E·N·L)` — the direct pass's own shadowing at this pixel (denoised, smoke and history
included) instead of any new ray, exact where one light dominates; capped at `WET_SPEC_MAX` 30. Plus the sheen: `diceIrradiance(P,
reflect(−V, Ns))`/π at half chroma × Schlick(N·V) × 0.6 (the mirror direction's hemisphere off the radiance cache: the lit floor below a
camera-facing flank, the sky outdoors; the bright rim at grazing angles). Added like the gloss spec — radiance, never × albedo — and shown in
debug view 10. NV: no blow-out (`wet_ultra_nv.jpg`; the cap keeps the tube from more than white dots).

## Look iteration (what changed after each crop round, and why)

1. First pass = darkening + a smooth coat + beads with mirror-tight lobes: **"shinier plastic"** exactly as warned, and only 2–3 beads lit
   (a bead's glint covered a fraction of a pixel: the lottery).
2. Film streaks + rivulet-shoulder tilt: texture appeared on the head, but the debug view showed the direct lobes ≈ 0 almost everywhere —
   `rough 0.1²` is a mirror, the highlight on a 5 cm limb was under a pixel wide. → geometric specular AA (normal variance per pixel).
3. With AA the lobes conserved energy into broad dim sheens: grey rubber with embossed streaks (the streak relief was the film's ALBEDO
   darkening, 12 %, hard-edged — later softened to 7 % with a soft shoulder). Realised the top-down geometry: a low lamp mirrors only in
   surfaces leaning toward the half vector, so vertical cloth can never glint smoothly.
4. Running waves along the streaks (v-noise) — the AA widened them away again (per-pixel tilt change ±10°).
5. **The fix that made it read wet:** a fine sliding facet wobble left deliberately un-anti-aliased → hard white sparkles that twinkle and drift
   down (torch and lightning crops), beads widened by their own cap fan so each answers whole.
6. Sheen off the radiance cache in the mirror direction instead of the pixel's Ei; then half its chroma and 0.8 → 0.6 after a green cabinet a
   metre off glazed the black suit.
7. Darkening 0.6/0.25 → per-channel 1.0/0.35 turned Sam **teal**: 8-bit albedo quantisation of (0.0018, 0.0023, 0.0028). → luminance-power
   darkening with the chroma faded out under 0.03 (khaki still drops to a quarter and keeps its hue; a black suit goes neutral near-black).
8. Prints: circles → heel + ball + toes (read as three coins) → a boot's heel slab + forefoot slab (superellipses), which reads.

**Honest critique of the final crops.** It reads as wet black gear under a torch or a stroke and as soaked khaki on the guards, and the
drying progression is legible — but: (a) on the smooth mannequin the film still leans "glossy vinyl" more than "soaked cloth" where no light
leans into the half vector (mid-torso under a frontal torch is dark and quiet; the sparkle lives on the head, shoulders, bead caps and rims);
(b) the drops are bumps with highlights more than lenses — no refraction / caustic, and their trails are subtle at gameplay zoom; (c) the
sparkle twinkles frame to frame by design — pleasant in the stills' A/B pairs, unjudged live at 60 fps (the pane cannot present), so
`WET_FACET` / `WET_FACET_TILT` may want a nudge by eye; (d) the arm seams and the flank's atan2 wrap cut the odd streak; (e) prints are
albedo-only (a wet print on the polished stone should really be glossier, but the gloss-keep channel cannot exceed 1); (f) at the default
21 m zoom the whole effect is "darker and shinier with the odd glint" — the detail is for closer cameras and the showcase.

## Cost (M4 Max, high, 1777×1000, four men on screen; serialized frames, interleaved A/B/C × 5, medians)

| | A soaked, on | B dry, on | C soaked, **off** |
|---|---|---|---|
| gameplay framing (dist 8): g-buffer pass | 0.122 ms | 0.074 | 0.066 |
| gameplay framing: whole frame (submit → workDone wall) | 28.36 ms | 28.62 | 28.48 |
| close (dist 3.2, ~30 % of the pixels are character): g-buffer | 0.138 | 0.065 | 0.068 |
| close: whole frame | 32.72 | 32.74 | 32.92 |

The g-buffer's timestamp is the one render-pass number that behaves offscreen: **+0.05–0.07 ms**. Composite cannot be timestamped on Metal
(reads ≈ the frame), so the whole frame was timed instead: soaked vs dry vs off are inside the ±0.2 ms noise both at gameplay framing and with
a third of the screen covered — under the +0.3 ms target with nothing to spare for. (Compute passes — direct, gather — do not move.)

## OFF identity

`?paused&quality=high&mute&noweather`, Math.random seeded in-page, `__stage` (guards parked, Sam close up filling the view, pistol drawn),
phases zeroed, `__resetClock`, grain 0, 24 frames, `__png` — this build (wetChars ON, everyone dry) vs a worktree of `fb09d9a` served beside
it: **max 0, 0 pixels differ** over 1777×1000 (base vs base also 0). The same in the RAIN with the switch off (Sam soaking on the CPU, the wet
lot's gloss path live): 4 pixels differ by 1 LSB, none on Sam; with the composite call compiled out, 1 pixel — i.e. shader-codegen ULP noise
from recompiled modules, not a logic path (base vs base 0 there too). GPU validation scopes clean at high and ultra with rain + soaked men +
NV on/off + a stroke; console clean.

## Probes (`tools/qa/wet-probes.ts`, family `wet`, in `all`) — all PASS

soak (0 → 1 in 6.0 s at rate 1, beads first; dries in 25 s, beads gone in 3; rate 0.3 slower; a man 0.6 m inside the facade dry while one
0.9 m outside soaks) · roof (a canopy box in the collision layer keeps him bone dry while his neighbour soaks, ~46 ray fans in 6 s for two men,
out from under it he soaks within the cache interval; the lamp head is no umbrella; the stair landing is dry) · off (setEnabled(false) / day /
rate 0: everybody 0) · reset (restartEncounter drops the print records that call and hands back dry men; a body in the lot soaks) · cast
(spawned units carry the field) · prints (≤ `WET.prints`, each laid fainter, params 0‥1, all retired by `printFadeSecs`; none in the rain,
none dry, nothing with decals off) · shading (instance rows zero unless on AND wet; knobs ride along; a wet guard fills his row, not Sam's).
Gate `wet weather frame-layout player breach` green; `tour --runs 2` PASS; `soak --seeds 1,2 --minutes 6` clean; `bun run build` OK.

## Follow-ups

- **Guards noticing wet prints** (the one-model debt this lane leaves): a searcher whose torch crosses a fresh print gets a fix on its
  direction — the prints already carry position, tangent and how fresh they are.
- Puddle splashes under running feet outdoors (particleFx ring, the weather's own splash look), and drips lit as glints rather than grey chips.
- Refraction / a caustic fleck under each bead; anisotropic (along-flow) roughness for the film; a wet-hair look for bare heads.
- Prints on gloss floors as extra gloss (needs a signed gloss-keep or a second channel).
- Live-eye the sparkle rate (`WET_FACET`, `WET_FACET_TILT`, creep speed) at 60 fps; consider a `sparkle` knob if it reads busy.
- The viewer could get a *wet* toggle (setInstance already takes the rows) for tuning the look off the game clock.
