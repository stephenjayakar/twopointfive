# EXPERIMENT E10 — weather: rain, lightning + thunder, mist, the wet lot (`exp/weather`)

> **Merged 2026-08-09 without the mist.** The maintainer's call at the merge: the rain, the strokes, the thunder and the wet lot ship; the fire-exit ground
> mist (a live smoke domain — +11–18 ms in its worst view, and the one place the storm touched the solver and the guards' sight lines) is cut entirely —
> emitter, keep-alive gate, `Weather.mist`, the panel row, the `weather-mist` probe (replaced by `weather-smoke`, which holds the cut). Wet / glossy
> characters come in a later lane. The text below is the branch's record as it was played, mist sections included.

Branch off `c5996b1`. Not merged: play it from its own page and decide. Everything is ON by default here; `?noweather` boots the plain
night byte for byte; Tab ▸ **Weather** has every knob and a *strike now* button; `window.__weather` is the object (`.strike({bearing,
elevDeg, distKm, peak})`, `.storm`, `.rainRate`, `.wind`, `.mist`, `.wetGloss`, `.setEnabled()`, `.summary()`, `.stats`).

## What to look at first

1. **Stand in the cubicles facing the south windows and wait** (first stroke 6–12 s after Start, then every ~8–25 s at storm 0.7): the
   window frames and mullions print across the floor and the desks for a fifth of a second, the haze under the roof flashes with them,
   the lot outside goes white-blue, and the thunder arrives 1–12 s later depending on how far off it was (near ones crack, far ones only
   roll). Tab ▸ Weather ▸ *from the south* fires one on demand.
2. **The car park under either sodium lamp** (walk out of the break-room door or the fire exit, or just pan there): streaks glinting in
   the cone, splash rings on the asphalt, the lot dark and wet with the bollards, cars and lamp posts mirrored in it.
3. **Open the fire exit and stand in the break room's east end**: a thin ground mist drifts in through the doorway, the east lamp's light
   comes through the door as a warm shaft in it, and the break-room patrol's torch cuts a cone through it when he comes round
   (`docs/shots/exp_weather_mist_torch.jpg`).

## Design as built

| piece | how |
|---|---|
| **rain** | Not simulated — *drawn*, in the volumetric pass (`volumetrics.wgsl` block (c), `rainAlong`): a lattice of falling drop columns (0.45 m cells, two columns each, ranked so the rate thins them) leaning with the wind, drops every 2.2 m falling at 9 m/s drawn 0.3 m long. Each view ray that **ends outdoors** (or in the sky) is sheared into the frame where the columns stand vertical, walks the cells under its outdoor stretch with a 2D DDA (≤ 72 steps), takes its closest approach to each column, and where that is within a texel of a lit stretch of streak adds `E_unshadowed(X) × 0.055 × shape`, spread over the texel so near and far streaks carry the same energy. `E` = every light whose reach mask includes the point (the sodium heads, the moon, a stroke; the office panels only through their own windows) evaluated without shadow rays. Never inside the interior footprint's column (`weatherC` = the same box audio.ts calls indoors), never above 7 m, never past the world's rim. Plus splash rings on outdoor ground (`splashAt`: 9 cm cells, a 60 ms ring per landing) and a lit-sky term along the outdoor stretch during a stroke. Deterministic per frame — nothing for any history to hold. |
| **lightning** | `weather.ts strike()`: ONE `RtLight` of kind 2 added to the LightSet — the daylight sun's path made transient. New `RtLight.transient` sets the kind word's 256 bit without the ttl envelope, so it is out of the cascades / gather history exactly like a muzzle flash and lit through the history-free direct pass, whose `shadowSample` already handles kind 2 (angular radius 0.006 rad → frames print hard). Intensity = peak (≈ 18, the sun is 8) × a two-return-stroke envelope (instant rise, τ 22 ms; +85 ms a second at 0.35–0.8×, τ 50 ms; sometimes a third flicker) **integrated over each frame's [t, t+dt]** so a 20 ms pulse delivers the same energy at 20 fps as at 60 (probe: 0.787 vs 0.786 both ways). Bearing random, elevation 24–54°, distance 0.3–4 km (closer in a heavier storm). `volumetric 1.3` → marched under the roof like the sun (window shafts flash); outdoors the analytic sky term. Own seeded RNG (`mulberry32`), never `Math.random`. |
| **thunder** | Queued at the stroke for `distKm × 1000 / 343` s later. `sfx.ts thunderNear` (tearing crackle → clap → a second clap → 4 s of rolled brown noise kneaded by three slow beats) under 1.3 km, `thunderFar` (a dull thump → a slower, longer roll) beyond; `audio.ts play()` grew `opts.lowpass / pan / wet` for non-positional voices: low-passed 9 kHz → 500 Hz with distance, slowed to 0.78×, leaned toward the bearing against the camera's yaw, more room when far. A rain bed (`audio.rain(level)`: band-passed hiss + a low drum layer on the ambience bus) follows the rate, a third of it indoors. |
| **remarks** | One bark site (`playThunder`): a thunder with `loud > 0.45`, 35 % chance, ≥ 45 s since the last, a calm free staff man whose head is **on screen** → a bubble (never the log): 'lovely night for it.' / 'that one was close.' / … |
| **mist** | `keepMist`: every 1.2 s while the player or the camera's look-at is within 10 m of the fire exit, one emitter into the smoke field — `kind 'cloud'`, coarse lattice, density **0.1 /s** (a canister is 95), radius 0.7, 0.28 m/s, temperature −0.3 (sinks and spreads), ttl 3 s — just outside the door aimed in through the doorway while the leaf stands open (> 20°), along the wall southward while it is shut (the solver's obstacle bake knows the wall's gap but not the leaf, so it is not aimed at a shut door). One coarse domain anchored at x 33.9‥37.4. Lit by the existing volumetric march: the east lamp's cone outside, torches inside. |
| **wet lot** | While `rainRate > 0` wetness eases to 1 over 20 s (starts wet); past 0.02 the asphalt slab (found by shape, not index) gets albedo × 0.5 and `BoxFlag.Gloss`, and — `wetGloss`, default on — `settings.gloss` is switched on for the duration (put back after). `fgather.wgsl glossReflection` multiplies the coat by `1 + 2.5 × wet` **outdoors only** (interiors and `wet = 0` multiply by exactly 1). |
| **frame plumbing** | `Frame` grew `weatherA/B/C` (rain rate, shear, wet · flash rgb, rain top · interior footprint); `FRAME_BYTES` 416 → 464; `engine.weather: WeatherFrame` written by `Weather.update` (the QA harness's engine stand-in gets one lazily). |

**The flash light path** (file:line): `src/game/weather.ts:124` `strike()` builds the `RtLight` (kind 2, `transient: true`, ttl −1) and
`engine.lights.add`s it → `weather.ts:171` (`update()`, via `applyFlash` :195) draws `strokeMean` over `[t, t+dt]` into `light.intensity`
each frame and `endFlash` (:198) removes it at `FLASH_SECS` → `src/render/lights.ts:104` uploads it with the transient bit
(`l.ttl >= 0 || l.transient`; `engine.ts:223` counts it in `numTransient`) → `direct.wgsl:92` `shadowSample` kind 2 (80 m shadow rays
inside the angular radius; `:49` kind 2 is never tile-culled) → `dtemporal.wgsl` variance clip follows the jump both ways →
`fgather.wgsl:51` subtracts the transient's shadow-tested share from the on-screen direct term before it feeds GI history;
`lighting_common.wgsl:57` keeps it out of the cascades; `volumetrics.wgsl:237` marches it under the roof; `probe.wgsl:38` (the light
meter) **includes** it, shadow-rayed — so the AI sees by it.

## Cost (M4 Max, Chrome/Metal, `?quality=high` 1600×1000, serialized per-pass GPU timings, interleaved A/B, ms)

| view / condition | volumetrics | direct | gather | temporal | smoke | total |
|---|---|---|---|---|---|---|
| cubicles (interior play view), weather **off** | 0.56 | 6.92 | 2.65 | 0.16 | – | 16.1–16.6 |
| cubicles, storm on (rain 0.55, wet gloss on), between strokes | 0.57–0.58 (+0.02) | 6.90 | 2.64 | 0.21 (+0.05) | – | 15.9–16.3 (noise) |
| cubicles, **during a stroke** (I ≈ 12.6 held) | 1.34 (+0.76) | 7.73 (+0.8) | 2.80 (+0.15) | 0.22 | – | +1.5 for the ~25 frames a stroke lasts |
| south lot (whole frame outdoors), off | 0.99 | 4.56 | 1.27 | 0.13 | – | 10.95 |
| south lot, rain 0.55, gloss off | 1.07 (+0.08) | 4.60 | 1.27 | 0.13 | – | 11.27 |
| south lot, rain 1.0 | 1.08 (+0.09) | 4.61 | 1.28 | 0.13 | – | 11.31 |
| south lot, rain 0.55 + wet gloss | 1.07–1.09 | 4.59–4.68 | 1.31–1.35 (+0.06) | 0.16–0.24 (+0.07) | – | 11.25–12.5 |
| fire exit view, mist off | 1.45 | 5.2–5.4 | 1.6–1.7 | – | – | 12.9–13.3 |
| fire exit view, **mist domain filling the frame** | 3.3–4.6 (+2.5) | 5.7–5.9 (+0.5) | 3.5–4.0 (+2) | – | 1.3–2.1 | 24–31 (**+11–18**) |

So: rain + wet lot ≈ **0.1–0.3 ms** anywhere (target was ≤ 1); a stroke ≈ +1.5 ms while it burns; the mist is a live smoke domain and
costs what a canister costs while it is on screen (+11 ms in the worst view) — hence the 10 m keep-alive gate: away from the fire exit
the domain retires and costs nothing. If that is still too dear the mist toggle is its own row.

## AI interaction (one model)

* **Thunder is ambience**: no `GameEvent`, nothing in the hearing model; probe `weather-thunder` holds three strokes' worth against planted
  calm men (awareness stays 0.000, no event of any kind).
* **A stroke really lights Sam.** The light meter's probe includes transient lights with shadow rays, so a man looking Sam's way past a
  window can glimpse him in a flash. Measured in the browser (Sam standing still in the dark at (17, 19.5), E 0.036 / vis 0.04, a calm
  guard 6 m north facing him, torch dead, a 12° stroke from the south so his chest sees the sky under the window head): visibility peaks
  **0.55–0.62** for a few frames (probe latency + the meter's damp 6), the guard's `sawPlayerThisFrame` is true for 9–13 frames and his
  fix moves onto Sam, awareness peaks **0.06–0.10** and decays back to 0 within a second (patrol decay 0.1/s) — a *glimpse*, well under the
  0.3 that makes a man say 'huh?'. Three strokes inside ten seconds, or Sam walking across the view (motion factor ×~3), can add up to a
  'huh?'; nothing gets near the 0.85 alert line from lightning alone. The mission's *spotted* count only counts alert men, so a glimpse
  is not a spotting. With the scheduler's 24–54° elevations a standing man is only lit within ~2.5 m of a window (chest under the 2.4 m
  head), which is lamp-lit floor anyway; the deep-room case above needs a low stroke.
* **Mist and sight**: `smokeTrans` along a guard's eye line straight through the doorway plume (3.7 m, the emitter blowing in, sampled
  every 2.6 s over 25 s of build-up) at the shipped **density 0.1 / radius 0.7**: **0.73, 0.59, 0.55, 0.58, 0.62, 0.67** → the sight-gain
  factor `clamp((T−0.3)/0.5)` ≈ 0.5–0.85: a man looking THROUGH the doorway mist picks Sam up a third to a half slower, never blind. The
  look pass had briefly shipped 0.16 / 0.75 — that measured 0.21–0.46, i.e. under the 0.3 at which sightGain reads *blind*, which is the
  absurd case; density × splat volume is the number that matters and the constant carries the warning. Anywhere but that doorway there is
  no mist.
* Day (the breach) suspends the storm entirely; the daylight round trip is bit for bit with the weather on (probe `weather-daylight`).

## Level / runtime geometry

No `level.ts` edits at all. At runtime the weather mutates ONE static box (the asphalt slab: albedo, `Gloss` flag — restored on off) and
flips `settings.gloss`; it adds no boxes. The interior footprint `[4, 4, 36, 24]` is a constant in weather.ts mirroring audio.ts's outdoor
test — a level-format lane will want both to come from the level data.

## Verified how

* Browser (Chrome/Metal, this machine): boots clean, no console / GPU errors through ~40 s of stepped play with strokes and thunder;
  captures below; the **residue test**: pixel diff of the interior 5 / 20 / 45 / 90 / 275 frames after a stroke against a no-stroke
  baseline of the same lags — identical to the noise floor from +5 frames on (mean 1.63 vs 1.63, >16 counts 0–9 vs 0–21 of 4 M): the
  transient path leaves nothing in any history. (First attempt showed a persistent difference — it was Sam's idle weight-shift in shot,
  not the flash; and a "flash" in one baseline was the flickering cubicle tube dropping out.)
* `bun run tools/qa/probes.ts weather` — 6 probes, ALL PASS (scheduler determinism + band + off Math.random; one transient light per
  stroke, energy frame-rate independent, set restored; thunder delay/shape/no events; mist bounds; off = untouched; daylight).
* Gates: `probes.ts player` — all PASS **except `controls-behind (d)`**, `probes.ts breach` — all PASS **except `breach-run`'s 'down'
  beats**; both fail identically with `Weather.prototype.update` stubbed out (scratch script), i.e. they are the base commit's (the quiet
  pistol / the breach lane's staged exchange), not this branch's. `tour.ts --runs 2` PASS ×2. `soak.ts --seeds 1,2 --minutes 6` clean.
  `audio-render.ts --all` PASS (thunderNear 6.2 s peak 0.92 centroid 155 Hz; thunderFar 7.5 s centroid 69 Hz; WAVs render for audition
  with `--wav <dir>`).
* Typecheck clean at every commit.

## Captures (`docs/shots/exp_weather_*`, crops ×3 nearest) — and what is wrong with them

* `exp_weather_rain_lamp.jpg` (+ `_crop_streaks`, `_crop_ground`): the south lot looking east under the sodium head. Reads as heavy rain;
  the wet asphalt mirrors the bollards and the grey car's tail. **Uglies:** streaks are 2–3 px soft ribbons, not hairlines — the pass is
  half-res and its texels march interleaved pixels, so anything thinner ladders (it did, twice, before the flat profile); all streaks
  share one length and speed (no small slow drops); splash rings are pale 'o's a few px across that only read up close; the void past
  the lot's rim shows moonlit streaks against pure black (physically fine, looks like a matte line).
* `exp_weather_flash.jpg` / `_frame5` / `_after` (+ `_crop_patch`, `_crop_sam`): the stroke frame across the cubicles (peak, I 12.6),
  four frames on (I 1.3), half a second on (gone, sodium light back in the windows). **Uglies:** the patch edges are softer than a real
  stroke's (the penumbra filter dilates the 3.5 cm hint); rooms flash ONLY where the sky sees the floor — no bounce from a stroke by
  design (transient = out of the cascades), so the far side of the office stays dark where a real room would lift for a frame; the rain
  seen through the windows is drawn against the lit lot but not in front of the glass line itself (rays ending indoors draw none).
* `exp_weather_flash_lobby.jpg` (+ `_crop_glazing`): the player's own follow-camera view — Sam crouched in the lobby, a 0.6 km stroke from
  the west through the two runs of glazing: the panes print across the stone and the couch, the fence posts and the dark west lamp lay long
  shadows over the flash-lit grass, the rain over the lot lights up blue-white. **Uglies:** at radius 0.012 the mullion bars by the couch
  were nearly washed out by their own penumbra plus the filter (this capture; since halved to 0.006); the stone whites out entirely for
  the peak frame (I 12.6 at exposure 2 — arguably right for lightning, but it is a flat white field with no texture to hold).
* `exp_weather_mist_torch.jpg` (+ `_crop_door`): fire exit open from inside at the shipped density, the lamp shaft in the doorway mist,
  the patrol's torch cone lit up in it, Sam crouched by the machines. **Uglies:** the torch cone goes milky-white near the lens (in-scatter
  × 70 cd, no multiple scattering, so it reads denser than the mist is) while the mist itself is subtle away from a beam — thin enough to
  keep the guards' eyes honest is thinner than the showpiece wants; before the anchor move the domain's west face clipped the plume into a
  straight edge 1.7 m inside the door in torchlight (now 2.2 m in and thinner there — watch for it); the mist takes ~8 s to establish after
  you arrive (keep-alive gate) and pours through a SHUT leaf's gap a little because the obstacle bake ignores dynamic boxes (aimed along
  the wall then, so it is slight).
* `exp_weather_exit_outside.jpg` (+ `_crop_sam`): the same door from the lot — Sam standing in the rain under the east sodium head, the
  guard's torch coming out through the doorway as a cone in the mist, the ground round the threshold hazed, splash rings across the wet
  asphalt. **Uglies:** the streaks in front of the lit wall read paler than the ones against the dark (additive on a bright field); Sam's
  own materials do not get wet.
* `exp_weather_scratch/`: the working captures (the dry lot before, first light, the dense-mist mistake, an earlier outside-the-fire-exit frame, the specular debug view of the wet lot, the ×8 diff images of the residue test).

## Review pass (two read-only reviewers on the diff) — fixed

Rain bed now silenced when day suspends the storm; `enabled` is a property routed through `setEnabled` (console `__weather.enabled =
false` tears down); the mist keep-alive takes the camera's look-at (`cam.target`) as well as the followed man (it was testing Sam's feet
twice); bark dice thrown on every thunder so the stroke schedule never depends on framing; `settings.gloss` only restored if it is still
what the storm set; the asphalt predicate can no longer match the interior carpet base; `FLASH_SECS` 0.42 → 0.5 (no pop with a third
flicker); shader: drop columns kept 9 cm inside their lattice cell and splash rings inside theirs (edge columns were invisible from the
far side of a cell line — 1–7 % of streak samples clipped), `rate ≤ 0` early-out, signed infinities in the DDA, the walk cap 40 → 72 cells
(a 24° spectate pitch needs ~50), splash ring lines a full texel wide, and the wet-lot Fresnel boost capped at a full mirror. Frame layout
(464 B), the interval arithmetic, NaN guards and off == old were confirmed independently.

**Known, left as is:** strokes keep firing during the showcase tour and attract mode (a window-side guard can take a ≤ 0.1 glimpse during a
scripted beat — the headless tour cannot see light; not observed to matter, not proven not to); the two thunder buffers add ~14 s of
offline synthesis to `buildSfx` at the first gesture (+~50 % of that one-off hitch, even under `?noweather` — render lazily if kept); the
mist's live smoke domain makes the real solver draw `Math.random` for emitter jitter (as any canister does — the "storm is off the game's
dice" probe holds for the scheduler, in the harness); the rain bed's indoor/outdoor level follows Sam while the thunder's pan follows the
camera; the mist toggle no longer clears the field (the plume decays in seconds; Smoke ▸ clear does it at once).

## Not done / next

* (4) window-pane streaks: skipped — no Glass flag on this base (E3); the hook would be a wet-normal shimmer at the primary hit for
  boxes tagged glass.
* Rain in front of window glass for rays that END indoors (see above): needs the segment test without the endpoint rule for rays that
  cross a window opening — a per-ray "passed through an exterior opening" bit the trace does not have cheaply.
* Puddle decals (pairs with E1), drips off the door head, Sam getting wet.
* Thunder that shakes: a 2 px camera kick + bloom pulse on near strokes; guards flinching on a < 0.5 km crack (still not a noise event).
* The tour could fire a stroke at its window stop (`__weather.strike` is deterministic given a seed).

## Merge-risk notes

* `Frame` uniform layout changed (three vec4s appended, `FRAME_BYTES` 464) — anything else appending to `Frame` conflicts trivially.
* `RtLight.transient` (lights.ts) + `numTransient` count (engine.ts) — small, additive.
* `audio.ts play()` non-positional branch now honours `opts.lowpass/pan/wet`; `GameAudioLike.rain?` optional; `SfxName` + two voices.
* `fgather.wgsl glossReflection` return line multiplies by the outdoor-wet factor (exactly 1 when weather is off).
* `game.ts`: `weather` field, constructed after `tracers`, `weather.update(dt, cam.yaw, cam.target)` after `updateTargets`.
* Weather.ts draws nothing from `Math.random` (probe; the live mist domain's solver jitter does, in the browser, like a canister), so seeded QA runs are unchanged with it on; it does add up to one light and mutate
  the asphalt box while enabled — `?noweather` / `setEnabled(false)` is the exact old world (probe `weather-off`).
* The level-format lane: weather finds the asphalt by shape and hard-codes the interior footprint and the fire-exit door name/coords.
