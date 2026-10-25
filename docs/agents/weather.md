# Hour, weather, wind, wet

One of the area files CLAUDE.md indexes. Everything below was moved here word for word from CLAUDE.md on 2026-10-13, in its old order;
"the bullet above / below" in a bullet means its neighbour there (each block says which lines it was), and a bullet named by its bold
title may now live in another file of this folder: `grep -l '<title>' docs/agents/*.md`. New bullets for this area go at the foot of this file.

<!-- was CLAUDE.md lines 2228–2302 -->
- **The hour** (`src/game/hours.ts`; `?hour=dawn|midday|overcast|dusk` (+ `?sun=0‥1`), the mission sheet's Hour row / H key (ui/missions.ts — this visit's pick only, on the link it loads),
  Tab ▸ Frame ▸ Hour, `__hour` {set(id), sun(k), at(p), summary(), changed()}, harness `PT_HOUR` / `PT_SUN` on playthrough.ts, or `hour=` / `sun=` on the query handed to `scenarioRun.ts startFromQuery` — `hourFromQuery`, the same run as a boot at that hour by digest; ids stay dawn / midday / overcast / dusk, the sheet words `overcast` 'Grey day' so it is not taken for a weather): a level started at another time of day than the night it was
  authored for, with NO level-file change. `night` is no record at all — the game byte for byte (`probes.ts hours-night`; default-equals-base by run digest). `applyHour(g, id)` (standGame
  calls it for the visit's `HOUR.id`; live both ways, reversible bit for bit): the level's moon disabled and a kind-2 SUN spliced in AT THE MOON'S INDEX (never last: 64 lights a frame),
  `buildDirReach`, sky / haze / exposure written to engine.settings, the OUTSIDE lamps (group 'exterior') on a photocell — as authored at dawn / dusk, out at midday / overcast, re-made after
  every `resetLevelState` (`hourAfterReset`) — interiors as authored at every hour, and the night's storm held off (`HOUR.dry`; a picked weather kind is not the night's storm — next bullet). ONE MODEL: the page's probe meter
  already sees the sun (a light) and the sky (the bounce); the CPU stand-in `guards.ts lightEstimateAt` — headless always, and what the team's light / goggle rules read on every host — calls
  `hourLight(g, P, acc)`: the sun through one segment test (statics + door leaves) and the sky + one ground bounce through 23 rays per half-metre cell (cached per cell against the STATICS,
  door leaves asked every call; no time in the cache, so checkpoint identity holds). `nvgPlaceLight` skips the hour's sun (already in the estimate). `HOUR.sun` / `setSunStrength(g, k)` =
  THE ONE NUMBER a weather dims under cloud (picture and stand-in read the same RtLight); the stand-in reads the LIVE `settings.skyZenith / skyHorizon`. `hourWorldChanged(g)` when statics
  change under a running game (a wall gone). Checkpoints carry `hour {id, sun}` only when not night (so the F10 journal does); `setDaylight` (the breach showcase) takes an hour out first and
  puts it back. `isDaylight(g)` stays FALSE under an hour (QRF, needs, civilians, weather gates unchanged). QA: `probes.ts hours` (night / light / restart / team / sheet).
- **Weather** (E10, `game/weather.ts`, docs/internal/exp-weather.md — merged WITHOUT the fire-exit mist; the storm never touches the smoke solver, probe
  `weather-smoke` holds it): RAIN is drawn, not simulated — volumetrics.wgsl (c) walks a lattice of falling drop columns along every view ray that ENDS
  outdoors (outside `INTERIOR` [4,4,36,24] = frame.weatherC AND outside the stair tower `ANNEX` = weatherD), lit unshadowed by every light whose reach mask
  includes the point, + splash rings on outdoor ground + the lit-sky term of a stroke; LIGHTNING = `strike()`: ONE kind-2 `RtLight` with `transient: true`
  (lights.ts: the transient bit without a ttl — out of cascades / gather history, lit through the direct pass; the light meter DOES include it, so a man can
  glimpse Sam in a flash), intensity = a two-return-stroke envelope integrated over each frame, gone at `FLASH_SECS`; THUNDER queued for distKm × 1000/343 s
  (`sfx thunderNear/thunderFar`, `audio.play` opts lowpass / pan / wet) — ambience, no GameEvent; the WET LOT darkens the asphalt slab (found by shape) and
  flags it Gloss, switching `settings.gloss` on for the duration (`wetGloss`); its own `mulberry32` dice (`seed(n)`), never Math.random; day (the breach)
  suspends it. `engine.weather: WeatherFrame` written by `Weather.update(dt, camYaw)` from game.ts after updateDevices. Tab ▸ Weather (storm, intensity,
  rain rate, wind, wet-gloss, strike buttons), `?noweather`, `__weather` (.strike({bearing, elevDeg, distKm, peak}), .storm, .rainRate, .wind, .setEnabled,
  .summary()). QA: `probes.ts weather` (scheduler / flash / thunder / smoke / off / daylight). **RAIN IS NOT LIT THROUGH A
  SHUT DOOR OR A WALL** (the maintainer, 10-11, the glasshouse: "looks like some light leakage for the low res rain"): the reach masks count every door as open and carried
  lights and flashes have no mask, so the store's bulb lit a wedge of rain behind its shut back door (`bun run tools/qa/rain-reach.ts [--map] [level.json]` counts such cells:
  38 for that bulb) and a weapon light indoors lit rain beyond the wall it pointed at. `volumetrics.wgsl rainLight` now asks ONE shadow ray per streak and light where the mask
  is not sure — a reach level under 3, a carried light (owner byte set), a transient light; a fixed lamp's level-3 cells, the moon and lightning stay unshadowed — behind the
  scene prelude's `const RAIN_SHADOW` (`frame.ts rainShadowConfig`, on; `?norainshadow` at boot = lit by the masks alone, as it was). Picture only. Seen only on the software
  adapter (old against new stills at that door: the lit wedge gone, nothing brighter; no GPU time measured — the rays are in the volumetric pass, the performance owner's).
  Left: rain above a roofed lamp seen through glass (a level-3 cell) is still unshadowed; a fixed lamp's level 1 / 2 cells are now also shadowed by cars, men and slabs while
  the level-3 cells beside them are not (a step along a 1 m cell edge is possible, not seen in the stills); a muzzle flash casts a ray for every streak in its range, untimed.
  With the door held open in the same view the rain past it is lit again. **THE DRAWN RAIN TAKES NO PICTURE OF
  WHAT IS BESIDE IT** (the maintainer, 10-12, The block's striped jointers' tent: "weird effect of red and white stripes on rain"): the particle rain (`settings.particleRain`, on;
  `particles_draw.wgsl rainFragment`) puts under each streak the mean of `refractTaps` reads of the scene bent through the drop, and a side read was ONE fixed offset per streak
  — so a streak whose side read landed on a red stripe was red end to end and the next one cream, loudest over dark floor far behind (the probe at `refractReachM`, the offset on
  its 12 %-of-the-height cap: one large offset for every streak there). `PRAIN.refractPaint` (rainFx.ts; 0 as shipped, 1 = the frame as it was, kept with the other p-rain knobs;
  Tab ▸ Weather ▸ 'p-rain: refraction: paint from beside'; packed into `rainCfgC.x` as share + 2 × round(100 × paint)) × three things in `rainRefractTap`: the offset's LENGTH
  scattered per pixel and frame, a read more than a few thousandths of the frame's height off the streak handed over as LUMINANCE in the colour of what is straight behind the
  streak (else of the light on the drop), and that luminance pulled half way to the pixel's own; a read that lands on the pixel itself is untouched. Picture only, the same number
  of reads. Seen only on the software adapter, in stills (his view restaged: the red streaks up-left of the tent with paint 1, none with 0); a still shows a streak dotted where
  the scatter lands on something bright — in motion under the temporal resolve that should average out, which nobody has seen.
- **The weather over the hour** (`hours.ts underWeather`; `?hour=midday&weather=rain`, both rows of the mission sheet — Hour, then Weather — each key once on every link): three rules. THE
  STORM: a picked weather (`Weather.kind`) always runs — rain at midday rains; with none picked an hour holds the level's own night storm off (`HOUR.dry`, the snapshot kept in `HourState.storm`
  through a kind coming and going, `wasOff` = it was off when the hour came and stays off). CLOUD → THE LIGHT: `Weather.cloud` c takes light off the ground and moves the rest from the sun to the
  sky — Kasten & Czeplak's two fits: all of it on level open ground × `cloudSun(c)` = 1 − 0.75 c^3.4 (clear 1.00 · dust 0.99 · fog 0.78 · overcast 0.48 · rain 0.37 · downpour 0.25), the sky's
  share of it d0 + (1 − d0) c² (d0 = the hour's own share off its own numbers, `skyShare`). `cloudLight(def, c)` → [sun, sky] factors: the sun's goes through THE ONE NUMBER
  (`HourState.sunK` → the sun's RtLight: midday 0.93 dust · 0.40 fog · 0.09 overcast · 0.04 rain · 0 downpour), the sky's scales `settings.skyZenith / skyHorizon` (it BRIGHTENS as the deck closes) —
  the lights the picture draws and the ones `hourLight` (the meter's stand-in) reads, so they move together. An hour that is itself a weather carries `HourDef.cloud` (the grey day 0.9): a pick
  counts only past it. A strength set by hand (`?sun=`, the slider, `setSunStrength(g, k)` → `given`) stands against the cloud — the sky still follows — until `sunToCloud(g)` (Tab ▸ Hour ▸ 'back to
  the weather's cloud', `__hour.cloud()`); checkpoints carry `hour.given`. CLOUD → DISC AND COLOUR: past half cover (`cloudSoft`) the disc spreads to the grey day's 0.25 rad (`sunReach` re-asked),
  the shafts leave the dust, sun and sky drain toward a deck's grey. NOT touched: the night (the moon is the level's whatever the cloud — an open call), the exposure, the photocell. `weather.ts
  setKind` calls `hourWeatherChanged(g)` last. The sheet's two lines of words follow the pair (`missions.ts hourNote / weatherNote`); both picks are remembered while the page lives (`hourPick`,
  `wxPick`). UNDER A PICKED WEATHER ONLY, two things the join changed in the weather itself: a loud sound (gunfire, a charge, a kicked door) is placed — and a calm man's first beat on it timed — off the path
  as it is in the air (`weather.ts loudLen`, `WX_SIM.loudDry`; rain still drowns small sounds through `hearPath`), and a stroke of lightning is in the light meter's CPU stand-in (`strokeLight` from
  `guards.ts lightEstimateAt`: the renderer's meter always read it, headless nobody did) — so rain / downpour runs no longer digest as the weather build's; the dry kinds do. QA: `probes.ts hourwx` (cloud / storm / save / query / air / sheet). Limits: the stand-in tests the sun with ONE hard ray (the widened disc's penumbra is the picture's alone — small once the
  sun is at 9 % under the cloud that widens it); the breach showcase's own day (`setDaylight`) ignores the cloud; the renderer's half of a weather is compiled at boot (a page is in its URL's weather).
- **The level's own storm rains by the level's own roofs** (`weatherKinds.ts WX_OWN.roofs`, `weather.ts syncRoofs / ownStorm`: ON in the page — `?ownroofs=0` = as it was — OFF in the
  module and on the frozen stand, `TPS_OWNROOFS=1`; a `FROZEN_HOLDS` row, in the knob registry and a journal's tables, a recording from before the key replays with it off; no Tab row).
  The maintainer, 10-11: "rain is busted on records office". With NO weather picked, the night storm of the bullet above was cut by the OFFICE's two rectangles on every level: on the
  records office the whole car park lies inside `INTERIOR`, so no rain was drawn on it, nobody there got wet, no storm wind blew, and rain showed only on the strip of ground outside the
  office's footprint. Now a level whose `roofsOf` is not the office's two (`officeFit`: two roofs, each within 0.3 m of `INTERIOR` / `ANNEX` — the office, the block's two files, the
  depot: those keep the constants to the bit) has `Weather.roofs` = its own ceiling slabs while no kind is picked, as a picked weather's always were: the frame's two rectangles + the
  packed third and fourth (`roofC` never 0 then; fog stays 0), `underRoof` (wet men, the rain bed, prints), the wet ground (every open ground slab, not the office's lot found by shape),
  wind.ts's storm record and door gusts (`reroof(roofs, own)`: an outside door the office's stair-tower rule left without a gust — the warehouse's fire exit — gets one while the rule
  is in force), rainFx.ts's roofs. `Weather.levelRoofs` (a kind picked, or this rule in force) is THE one question 'are `roofs` the level's own'. `simLive` is NOT raised: hearing and
  sight through the air are as with no kind. A picked kind takes over and hands back (`setKind`); the switch is asked every frame and by `underRoof` / `restore` (a replay's knobs land
  after the Weather is made). main.ts raises the prelude's `WX_KINDS` on a page that is not the office family's (`look.ts placeOfQuery`: a `levelFile` of another name, `?level=local`
  on another level) when the switch is on — the shaders read the third and fourth roof only under it, and the pipelines start compiling before the level is loaded, so the URL decides —
  and says so in `WEATHER_BOOT.packed`: where it is false (the office family, `?ownroofs=0`) the rule stands down whatever the switch says later. A QUIET level's night is still DRY AND
  STILL (the quiet goal's `ownNight`, untouched). LIMITS, each also a picked weather's: three or four roofs = the storm WIND's record is their bounding box UNLESS `WX_OWN.wind` is on — the 'One wind field outdoors' bullet below (rain in the compound's and
  the barracks' yards, no storm wind there); a roof is a slab at ceiling height (the kit yard's 2.1 m covers are rained through in the picture); audio.ts's reverb, destruction.ts's
  ceiling tiles and glassbreak.ts still test the office's rectangle. `bun run tools/qa/ownroofs-check.ts` (`probes.ts ownroofs`, also under `weather`; passes on both stands;
  `OWNROOFS_BREAK=1` must fail): open-sky lattice points kept dry 0 with the rule (records 400 of 742 without, compound 288 of 632, barracks 138 of 479), the frame, a man on the car
  park soaked / dry without, the wind's record, the warehouse fire exit's gust, the office / block / depot the same, bazaar dry, a kind picked and unpicked, the switch thrown live.
  Seen only on the software adapter.

<!-- was CLAUDE.md lines 2307–2402 -->
- **Weather kinds** (`src/game/weatherKinds.ts` + `weather.ts`; `?weather=clear|overcast|rain|downpour|fog|dust`, the mission list's Weather row; `Weather.kind` null = the
  bullet above exactly, the simulation untouched — 18 scripted run digests and the software-rendered default frame equal the base): a kind is one row of `WEATHER_PRESETS`
  (storm, rain, wind, `cloud` 0‥1, fog σ0 / H / leak / tint / gain). With a kind: the no-rain footprints are the LEVEL's ceiling slabs (`roofsOf`, ≤ 4; roofs 0 / 1 in
  weatherC / D, roofs 2 / 3 packed 8 bits × 0.2 m outward in `frame.cardCfg.y/.z` — `.y` is never 0 under a kind, 1 = none — and the fog in `cardCfg.w`: the Frame keeps its
  size); FOG is ONE field for picture and simulation (common.wgsl `wxFogTau / wxFogApply / wxHazeK` ≡ `fogTau`; `airTrans(g, a, b)` is multiplied into the smoke
  transmittance wherever an eye is tested — guards, pairs, bodies, civilians, cameras — NOT into fogofwar.ts); rain is NOISE at the listener (`hearPath(g, src, ear)` =
  propagate with pathLen × `Weather.hearMask(ear)` = 1 + `WX_SIM.rainK` × the mixer's own rain bed there, + `thunderK` for `thunderSecs` after a near clap — every
  hearing consumer calls hearPath); `Weather.cloud` is READ-ONLY for whoever owns sun / moon (test `kind` first: null = leave the lights alone); a kind is not suspended
  by daylight and cannot be switched off. The renderer's half sits behind the scene prelude's `const WX_KINDS` (`frame.ts weatherKindConfig`, raised at boot by
  `?weather=`: off = dead code), so in the PAGE the weather is the URL's for its whole life (`WEATHER_BOOT.locked`: setKind refuses another, canLoad refuses a
  checkpoint made in another with the reason); headless a checkpoint / a journal's frame 0 carries its kind in (`WeatherSnap.kind`). Limits: wind.ts's storm record holds
  two rectangles (3–4 roofs = their bounding box: no storm wind in a yard — until `WX_OWN.wind`, the 'One wind field outdoors' bullet below), the native engine is not ported, audio.ts's reverb / destruction.ts / glassbreak.ts still test
  the office's rectangle. QA: `probes.ts wxkinds`, `playthrough.ts --set '{"WEATHER":{"kind":"fog"}}'` (or `weather=fog` in a query handed to scenarioRun.ts `startFromQuery`, which reads it headless too), `tools/qa/weather-look.cjs` (stills per level × weather × view).
- **A weather's dust / fog is a VOLUME in the air** (`src/game/airDust.ts` + `common.wgsl wxAir` + `volumetrics.wgsl wxAirMarch`; the maintainer: 'could we just model this with
  volumetrics properly?'; **`?flatfog` = the flat veil composite laid before it, picture and simulation, exactly**). ONE field for the picture and the men's eyes:
  `wxAir(X)` = σ0·e^(−y/H) × (in the open: 1, easing to nothing over `WX_TOP` 3 m above the ceiling line; under a roof: the AIR GRID's share below `CEIL_Y`, nothing in
  the slab). THE AIR GRID (`scene/airGrid.ts`: 0.5 m cells over the world's plan, 80 × 56 floats) lives in the tail of `boxMat` after the markings and the
  glass-break table and BEFORE the cut table (its place and the prelude's text do not move with the cut switch: `probes.ts cutboxes` holds both — `frame.ts weatherVolWgsl` writes `WX_VOL / WXD_BASE / WXD_W / WXD_H / WXD_CELL` into the scene prelude; `BoxWorld.setAirGrid`) and is
  SIMULATED on the CPU by `Game.airDust: AirDust`: every cell in the open is pinned at 1, a cell under a roof relaxes to the kind's `leak` (a shut room keeps exactly what
  it kept) and DIFFUSES with its open neighbours (`AIRDUST.diffuse` 1.5 m²/s, `settle` 0.12 /s, a fixed 1/30 s step off an accumulator) — an edge between two cells is open
  when `col.solidBlocked` is clear both ways at three heights with the door leaves taken out AND no leaf's plan rectangle crosses it (re-read when a leaf moves; every shut
  edge re-asked on a rolling `recheckSecs` 3 s window, which is how a blown wall or a shot-out pane lets the dust in with no hook in destruction's files). So an open door
  breathes dust a few metres into the room and shutting it lets the room settle back; no dice, no GPU read; `snapshot/restore` rides in the checkpoint (`SaveState.air`).
  `weather.ts airTrans` reads the same cells (`shareAt`) while it is live. THE PICTURE (`wxAirMarch`, the per-pixel volumetric pass at every tier, only while a kind's fog is
  in — clear air runs the pass as it was): ≤ `wxMaxSteps()` jittered steps a ray (half the tier's beam steps: ultra 12 … verylow 4; `settings.wxAirSteps` overrides — the F8
  sweep's row `wxAir` prices it), each = extinction + the dice's mean radiance as the ambient + every kind-2 light (sun, moon, a stroke) through a SHADOW ray and the smoke, so
  walls and roofs cut shafts through the dust and a dark room's dust stays dark; the classic haze branch and the froxel kernel hand kind-2 lights to this march while a kind
  is in (one owner; the dusk wall fix's `?nowallfog` acts only together with `?flatfog` now), lamps keep their own beam march through `hazeAt → wxHazeK` (which now reads `wxAir`). Output: the volumetric target's rgb gains the in-scatter, its
  alpha is smoke × air transmittance (composite dims the surface by it — the flat `wxFogApply` veil and its glow are skipped under `WX_VOL`), `volReact.g` stays smoke-only.
  Two switches, one URL flag: the picture's `weatherVolConfig.on` (prelude const, boot) and the game's `AIRDUST.on` (module default OFF = the frozen stand, where airTrans is
  the old roof-leak rule exactly; `pageSwitches` raises it, `TPS_AIRDUST=1` on the frozen stand, a knob table in the journal). QA: `probes.ts airdust` (shut / door /
  breach / eyes / save / off); stills only on a software renderer (`tools/qa/weather-look.cjs`), never timed on a GPU from the cloud — page
  rebuild/dust-volume/read-first.md. Limits: the grid is a PLAN (one share per column: an upstairs has none here), the indoor dust has no wind drift,
  the native engine is not ported.
- **Wet characters** (`src/game/wet.ts`, the weather's other half; `settings.wetChars` default ON — off, or nobody wet, = every character shades bit for bit as
  before: proven `__png`-identical to main with the weather off). Every `Character` carries `wet` (the coat 0‥1), `beads` (0‥1) and `wetRain`; `updateWetness(g, dt)`
  (game.ts, right after `weather.update`) soaks whoever is OUTDOORS = outside weather.ts `INTERIOR`/`ANNEX` AND `openSky` (five upward `col.solidBlocked` rays, head →
  9 m, roofed only if ≥ 3 blocked — a canopy yes, a lamp head no; cached 0.25 s per man in a WeakMap) while `rainNow(g)` = `engine.weather.rain` > 0 (so day / off /
  rate 0 = nothing): coat +`WET.soakPerSec`×(0.4+0.6·rate)/s (~6 s), beads 3× that toward 0.35+0.65·rate; else coat −`dryPerSec` (~25 s), beads gone in `beadRunoffSecs`
  (3 s). Sam only, player's eyes only (nobody reacts — follow-up): drips indoors for `dripSecs` (particleFx 'debris', rate ∝ beads; none headless) and `wetFootfall`
  (player.ts step site) lays a `'wetprint'` decal (decals.ts kind 6, `Decals.remove/touch`; decals.wgsl `wetPrintMark`: a boot's heel slab + forefoot slab (superellipses), albedo^(1+0.6k)×(1−0.3k))
  per step for `WET.prints` steps after coming in soaked, `agePrints` lowers `param` at 4 Hz and retires them by `printFadeSecs`. RENDERER: game.ts hands each skin
  instance `wetInstance` + `wetKnobs` + `wetLineRow` (anim/characters.ts `CHAR_INST_BYTES` 96: CharInst.wet = coat/beads/rain/phase, wetK/wetK2 = the 8 look knobs, wetK3 = (WATERLINE, wicking
  band, 0, 0) — no uniform, no Frame change; zeros when off or dry). **The WATERLINE (08-12, the maintainer at pflood: 'wet rain simulates droplets which don't make sense when wet indoors.
  also only models being completely wet'):** `Character.wetLine` = how far UP him the coat reaches in bind-pose metres above the sole (Infinity = all of him — the rain sets that; a wading
  depth = whoever wades him: `soak(g, c, wet, 0, 0, line)`, `__wet.set(i, 1, 0, 0, 0.55)` = to the knee, Tab ▸ Weather ▸ wet buttons; reset to Infinity once he is dry); fsSkin masks the
  coat AND the drops by `1 − smoothstep(line, line + WET.lineBand, mp.y)` and never enters the wet block above it (those pixels stored exactly as dry) — immersion = dark cloth below
  the line with the film, NO beads (beads are the rain's: an immersion caller passes beads 0), the rest of him dry; verified on the albedo view (docs/shots/wetline4_albedo_*). gbuffer.wgsl `fsSkin`: albedo × lum^(darken·coat) × (1−darkenMul·coat), +25 % saturation about that grey at full coat; `wetSurface` maps the BIND-POSE position to (u round, v
  along) per tube (legs / trunk / neck+head vertical, arms along x); `wetFilm` = streaky value noise creeping down (coverage ~½ at full soak, sparing undersides) whose
  rivulet shoulders and a sliding fine `WET_FACET` wobble tilt the normal (the glints — deliberately not AA'd away); `wetDrops` = one drop per live lattice cell (colW
  3.2 cm × cellL): forms, sits, runs `trailLen` with a trail, spent, period ÷(0.4+rain); output = roughness (film `roughWet` 0.12 / damp cloth / bead 0.05, +
  Tokuyoshi kernel from `dpdx(n)` and the bead's fan) + gain + tilt packed by `packWet` into the id's LOW 20 BITS (rough5|gain5|tiltT5|tiltB5, masked) with **bit 30**
  raised (a dry pixel keeps 0xFFFFF and bit 30 clear; every other id reader keys on bit 28 / the owner byte). composite.wgsl `wetCoatSpec` (only when bits 28+30):
  per reaching light a GGX lobe (F0 0.02, widened by the emitter's angular size, Smith vis) on the tilted normal × `vis` = lum(Ed)/lum(Σ unshadowed E·N·L) (the direct
  pass's own shadowing, no extra rays), capped `WET_SPEC_MAX` 30, + sheen = `diceIrradiance(P, reflect(−V,N))`/π × Schlick(N·V) × 0.6 at half chroma; added like the gloss spec
  (never × albedo; also in debug view 10). Cost (M4 Max, high 1777×1000, 4 men on screen): g-buffer +0.05–0.07 ms, whole frame within noise (< 0.2 ms) even at 30 %
  coverage. Knobs `WET` (persisted `twopointsix.wet`, clamped to `WET_RANGE`; Tab ▸ Weather ▸ wet rows + soak Sam / soak everyone / dry all), `__wet` {on, get(i|'sam'),
  set(i, wet, beads, rain), soakAll, dry, knobs, save, reset, stats, prints(), summary()}; `clearWetPrints` runs in resetLevelState. QA: `probes.ts wet` (soak / roof / off / reset / cast / prints / shading).
- **Wind** (`src/game/wind.ts`, `Game.wind`, docs/internal/wind.md; the maintainer: "for hvac vents, that should model wind which then also influences the smoke solver";
  `tune.wind` 0‥1 default 1 — **0 = still air: both consumers handed empty lists, nothing evaluated; `probes.ts wind-identity` holds the CPU game byte for byte against a
  digest frozen on main**). ONE analytic field, three kinds of source summed: the level's HVAC VENTS (LevelData `vents[]` → `Level.vents: VentDef {name, pos (face
  centre), dir, speed (m/s at the face), spread (cone half-angle °), reach (where it has halved), size?, period?/duty?/phase? cycling, mains?}`; the office authors six
  ceiling diffusers blowing DOWN — `vent_cub_nw` / `vent_cub_se` over papered desks, `vent_aisle` (19.8, 14.6), `vent_corridor` (cycles 45 s / 0.75 / phase 20),
  `vent_break` (50 / 0.6), `vent_server` — each with a NoPrimary grille box appended LAST in the box list; docs/level-format.md *Vents*) = a cone JET (straight
  streamlines out of the virtual apex, speed × 1/(1 + (d/reach)²) × e^(−(r/σ)²), σ = 0.4·size + d·tanSpread, gone past 2.5 × reach / 2.6 σ / behind the face — a
  BOUNDED support — and a down-jet turns to run OUT along its floor below `WIND_FIELD.deflectH` 0.55 m: the wall jet), the STORM outdoors (weather.ts's `wind` vector,
  READ — never its dice; nothing inside INTERIOR / ANNEX — or, `WX_OWN.wind` on a level of three or four roofs of its own, under any of them: `windStormRoofs` / `stormVelRoofs`, the bullet below — easing in 1.5 m off the facade), a GUST through every OPEN EXTERIOR DOOR (a jet along the inward normal ∝
  open fraction × how square the wind stands to it). **`render/shaders/wind_field.wgsl` is THE field text both GPU consumers compile** (`windJet` / `windStorm`;
  `jetVel` / `stormVel` in wind.ts repeat it on the CPU — `windAt(g, p)`, the moths, `__wind.at`). `Wind.update(dt)` (game.ts after weather + wet) folds each source's
  state into ONE speed a frame — vent = authored × `WIND.ventK` × spin `on` (its cycle; the MAINS: `g.blackout.active` spins every mains vent down over `rampDown` 4 s,
  the restrike back over `rampUp` 3) × gust (1 ± `gustAmp` 0.25 on a value noise of the game clock keyed by the name's hash) × tune.wind — and hands the SAME records
  to (1) the particles: `Particles.setWind(≤ WIND_GPU_MAX 8 nearest the view + the storm, knobs)` (that list, `wind.forParticles`, is the HOST'S, a `math/side.ts HostOwned` holder since 10-23: it is filled only where a particle pool is, by distance from the view's focus, and rebuilt every frame, so no snapshot or state hash holds it — `probes.ts breathsteam`'s `pool` line, red with the holder made a plain object; and the working vectors of `Wind.at` / `stormShare` are module scratch, where as fields of the Wind whoever asked last — the pool's path, the panel's probe at the cursor — left his numbers in the state: the same line asks one game alone for the air and is red on the fields; never seen on a GPU, nothing drawn changes) → packed as ImpulseRec read another way BEHIND the frame's
  impulses in the same 16 slots (impulses first — a bang is never short; `flags` bits 16‥20 = numWinds; a jet = pos+reach · axis+speed · (tanSpread, r0, dMax) ·
  floorY · kinds · iflags 2, the storm = interior rect / annex rect / wind, iflags 6; the four knobs as f16 pairs in seed / spare); `particles.wgsl windAir` sums the
  air at the particle (a RESTING one hands its own surface as the floor, so the desk turns the jet too) and the update takes drag AGAINST THE MOVING AIR — dust /
  puffs `v = vAir + (v − vAir)·e^(−k dt)`, chips toward `debrisK` 0.15 of it, brass / sparks none, a SHEET's whole `sheetAir` on the relative wind (the impulse
  gust's co-moving air generalised; vAir 0 = term for term as it was); a resting leaf TREMBLES in yaw ∝ the air over it and once a `WIND_WAKE_WINDOW` 0.75 s a hashed
  share of the leaves the air moves faster than `sheetWake` 0.35 m/s over is picked up (kick `sheetKick` 2 × the speed, 0.45 lift, the impulses' own
  `sheetKickShape` tilt / tumble) — under a shipped diffuser the desk sees ~0.3 m/s, so it is the gust peaks that do it: paper trembles and now and then slides;
  `stats.windWoken` = pool hdr[5]; and (2) the smoke solver: `smoke.setWind(all active, WIND.smokeRelax 3)` → `smoke.ts windNear` keeps the sources within a metre of smoke (past eight, the nearest the view; the storm always) in ONE 560-B uniform (`smoke/wind_force.wgsl WindBlock`:
  count · relax · 8 spare words · 8 WindSrc); the solver masks them per BRICK (a sphere round each support vs the brick) and `smoke.wgsl forces` calls `windForce(u, Pw, mask, dt)`
  after the emitters: mask 0 = one branch, else `v = mix(v, v_air, clamp(w · relax · dt))`, w = |v_air| ÷ the face speed (a plume BESIDE a vent keeps its
  motion), and the projection spreads a down-jet along the floor by itself — a can under a vent is held to the floor and driven along it, one by an open door in the
  storm leans in, and the guards' sight-line probe marches THAT density (`__ws.sight`: the vent-bent plume stays under Novak's eye line six seconds where the column
  blinds him in two — nothing added on the AI side). **Wind never makes / keeps / gives back a brick and allocates nothing.** Cost: idle Δ 0, the forcing +0.02‥0.05 ms
  on the smoke pass, no memory but the block. **The dust MOTES are GONE (08-11, the maintainer: 'they look weird … it's obvious that they spawn when your flashlight shows up somewhere'):
  the `P_MOTE` particle kind, `game/motes.ts`'s recycler, `settings.moteCap` / `Caps.motes`, `WIND.motePx / moteMeander` and their rows all deleted — the particle kinds are 5 again
  (`P_KINDS`; particles.ts derives `BLOCK_HDR_BYTES` 48 + 48·kinds and `KI_FLOAT` from it), do not bring them back as a torch-cone spawner.** MOTHS (`game/moths.ts Moths`, `Game.moths`, `tune.moths`): ≤ 12 `Dynamic|NoShadow` 3 cm boxes (`MKEY.test + 0x4000 + i`) on analytic noisy orbits under
  the exterior spot heads over 3.5 m (the sodium lamps) — pull = lit × night × calm (`windAt` at the head under 3‥6 m/s) × not a downpour, eased; each lamp's quota = its share of
  the 12 by pull (≤ 7), the surplus scattering / migrating unseen (a lamp lit later gathers its own); no gust source for a door onto the roofed ANNEX; a 9 Hz roll = the flutter; `moths.boxes(dynBoxes)`. FIXTURE DEATHS (particleFx.ts, counts in `PFX`): `fixtureShatterFx` ←
  combat.ts's fixture-shot rule (glass + phosphor shower, sinking powder, ballast sparks), `breakerSparkFx` ← the breaker shot (arc-over + soot), `lockSplinterFx`
  ← game.ts onDoorEvent 'kick' when `lockBroken` (the keep's splinters in with the leaf). Knobs `WIND` persisted `twopointsix.wind` with tune.wind / moths
  (Tab ▸ Weather ▸ wind + moths rows; 'put me under a vent ▸' teleports Sam beside each of the level's vents in turn — the grille is the dark square in the ceiling, pop a can
  there), `__wind` {on, at(p), sources(), active(), describe(), knobs, field, stats, set({}), save, defaults, summary(),
  jet, storm, moths, setMoths}. QA: `probes.ts wind` (field / sources / caps / level / identity), `tools/qa/wind-scenes.js` (`__ws.plume / paper / door / moths /
  tube / lock / breaker / sight / cost / validate` → docs/shots/wind_*.jpg, strips docs/shots/wind-strip-*.jpg).
- **One wind field outdoors, roof by roof** (10-14; `weatherKinds.ts WX_OWN.wind`, `wind.ts syncField / stormVelRoofs / stormShare`, `wind_field.wgsl windRoofOut /
  windStormRoofs`; the maintainer, of the pass: "ideally the snow particles and wisps all share a wind field too. and that could also integrate with the smoke system
  too?"). There was one wind model already and flakes and smoke both read it; what kept them apart was the storm record's TWO rectangles — three or four roofs = their
  bounding box, and on the pass (four houses round a yard) that box is the yard: flakes fell plumb there, smoke there stood upright, and the wisps were put on the
  storm's raw vector to have any wind at all. CORRECTS the 'bounding box' limits above and the wisps bullet's "not on `windAir`" below, with the switch on.
  - **Switch**: `WX_OWN.wind` — ON in the page (`?wxwind=0` = as it was), OFF in the module and on the frozen stand (`TPS_WXWIND=1` raises it; it acts only where a
    level's own three or four roofs are in force: a picked weather, a snow level under `TPS_SNOW=1`, or `TPS_OWNROOFS=1`). A `FROZEN_HOLDS` row, `STAND_ENV`, the
    stand-up's line, a second key of the registered `WX_OWN` table, in a journal's tables: a recording whose `WX_OWN` row has no `wind` key replays with it off
    (`journal.ts applyKnobs`). Read every frame (`Wind.update` → `syncField`): it flips on a running game. Not in the frozen-digest pin lists: off in the module.
  - **How**: with it on, on a level of three or four roofs of its own, the storm source carries `roofs` (the weather's list: roofs 0 / 1 exact, 2 / 3 as the Frame
    packs them) beside its `interior` / `annex`, which stay the bounding box. Every reader then keeps the storm out from under EACH roof and nowhere else, easing in
    over `stormLee` off the NEAREST roof (the two-rectangle rule eases in off its first rectangle only): `Wind.at` → `stormVelRoofs`; the PARTICLES' record = roofs
    0 / 1 in the two rectangle slots + `iflags` bit 5, and `particles.wgsl windStormOf` takes roofs 2 / 3 off `frame.cardCfg.y / .z` — the words `rainOutdoors`
    already reads, so no new block and the emit block is the size it was; the SMOKE's record = roofs 0 / 1 (so the link kernel's 'brick wholly indoors' skip still
    holds) + `spare0` = 1, roofs 2 / 3 as two vec4f in the wind block's eight spare words (`wind_force.wgsl windSrcVel` reads them by `bitcast`; the block is still
    560 B). ONE OR TWO ROOFS (the office, the records office, a hall): no `roofs`, no bit — the record, the wind and the uploads are what they were, by value.
    THE WISPS: `iflags` bit 4 (`field`, the switch itself) → `particles.wgsl wispShare(q)` = the field's share 0‥1 of the open wind at ground point q (1 without the
    bit); `wispAir` × it (a wisp slows as it runs into a lee), `wispGust` × it (fewer are born there), and under `WISP_LEE_DIE` 0.25 a wisp's fade-out starts;
    on the CPU `snowFx.ts` weighs the open ground by `Wind.stormShare` (`blown`) for the wisps' target — the flakes' own area and records are not touched.
  - **What changes in play**: on a level of three or four roofs smoke in open ground between them now leans and drifts with the storm (the compound's and the
    barracks' yards under their own night storm, 0.9‥1.4 m/s as measured over a few hundred frames; the pass's yard under the snow's 0.6‥1.0 m/s), and smoke is what every eye and every guard looks
    through — a can thrown in a yard will clear downwind faster and screen less upwind than it did. Rain there leans too (its drops ride `windAir`).
  - **Check**: `bun run tools/qa/wxwind-check.ts` (`probes.ts wxwind`, also under `wind` and `weather`), 8 lines, both stands, `WXWIND_BREAK=1` must fail (7 of 8
    red): the shader's roof-by-roof text is the CPU's and with one roof equals the old rule on 13 680 points; the pass's yard has the storm's own wind on and none
    off, still under each of the four roofs; the lee off an eave (0 / 0.156 / 0.5 / 1 / 1 at 0 / 0.375 / 0.75 / 1.5 / 2.5 m); what the particles and the solver are
    handed (through `particles.ts` and `smoke.ts` on a fake device) and the shader text that reads it; the office, records and the hall the same by value on a 1026-point
    lattice; the wisps' target = 302 m² blown of 367 m² open; one stepped digest on and off on the pass, the compound and the office; a recording from before the key.
  - **Measured** (headless, both stands): 600 stepped frames of the pass, compound, depot, barracks, office and records, seed 7 — every digest equal to the tree before
    this change with the rule off AND on. One played run, the pass's room clear, seed 1, shipped stand: digest a20dd9e1 off and on, taken at 90.4 s with 4 of 4 up
    both ways, no smoke thrown. NONE OF THIS MEASURES THE RULE'S EFFECT ON PLAY: the CPU game reads no storm field, the smoke solver is on the GPU and the harness
    has a null one — the on / off digests are equal because nothing headless can show smoke bending. No tally moved; no fixture or frozen digest changed.
    `probes.ts wind`'s `wind-identity` frozen-digest line is red on the tree before this change too (cf857c1e against 354b99f6): not this rule's.
  - **Seen** (software adapter only, `quality=low`, 800×450, three stills of the pass's yard from 14 m at 45°, the page paused and stepped 0.4 s a frame; the
    flakes' shutter raised to 0.2 s for two of them so a flake draws its own motion): the page boots with the rule on and with `?wxwind=0` — 113 pipelines, no
    console or GPU error either way. On, every flake's streak in the yard leans the same way down the wind; off, the streaks there stand near plumb. Wisps lie over
    the yard in both. **Never on a GPU, never moving, and NO SMOKE WAS THROWN**: smoke bending in a yard, a wisp slowing and fading in a lee, the lee's 1.5 m width
    against a real eave, rain leaning in the compound's yard, and what any of it does to a fight are all unseen and unplayed. The solver's shader with the new
    branch compiled on the software adapter; its forces kernel was not run with a storm record.
  - **The smoke owner's run of it** (its claims, 10-14; SwiftShader, the solver alone on a booted compound page, dust weather, one can 4.5 m from every roof, 120 steps,
    the game's own storm record of 4 roofs at 2.56 m/s against the same with the roofs taken off; one run each, NO DRAWN FRAME): roof by roof the plume's centroid drifts
    0.86 m and 0.32 m by 2 s, the wind's own ratio; as a bounding box 0.03 and 0.10 m. A can in the middle of roof 2 (one of the two in the spare words) does not drift.
    No extra pool use (211 bricks against 232). THE PLUME ALSO SITS LOWER in wind: centroid 0.57 m up at 2 s in dust against 0.95 m with none (0.80 m at snow's
    0.85 m/s, 0.83 m at clear's 0.38), because `windForce` pulls the whole velocity toward a level wind — the old rule, as in the office's lot, now reaching yards. If yard
    plumes read squat, the mend is to pull only the level part for a storm record: its own switch (it changes the office's lot too). Not built. Cost, inferred: moving
    air is never calm, so yard smoke in strong wind steps every frame.
- **The air is one simulated field** (10-14; `src/game/airSim.ts AIR_SIM` / `updateAirSim` / `airMask`, `src/render/airField.ts` + `shaders/air_field.wgsl`,
  `engine.ts` the `air` pass; the maintainer: "can we make the wind sim be a general system we always run? we already have wind hooked up to the other systems, this
  would just be an improvement on it", and before it "integrating with the fluid system … the wind hits a wall", "vortices past the edge of the door").
  A 2D fluid simulation of the air over the WHOLE level floor (WORLD's 40 × 28 m at 5 cells a metre: 200 × 140), on every level. THE MAP is drawn by the game
  on the CPU, one byte a cell, only when a box, a pane or a leaf has changed: SOLID where a static box reaches from under 0.45 m to over 0.5 m (walls,
  furniture; glass until more than half the pane is out; whatever destruction has hidden left out; placed snow never), and every door leaf where it hangs now
  (one off its hinges is no wall); elsewhere the share of the ambient forced there (all of it under the sky, none under one of the level's own ceiling slabs,
  `weather.ts roofsOf`). THE WIND is `wind.ts`'s own sources as they blow that frame: the storm at its ground share as the ambient, each vent and each gust
  through an open outside door or a shot-out pane as a local source (≤ 16; a ceiling diffuser = air spreading across the floor under it: the field is a floor
  plan). The solver (staggered grid, advection, a red-black pressure solve, vorticity put back, a boiling curl noise, a lift channel off the pressure) runs in
  ONE compute pass timed as `air`, on ITS OWN 60 Hz CLOCK (a 120 Hz page steps it every other frame; a frame between two steps is declared idle to the
  timer). THE SAME AIR AT EVERY WIND (`AIR.refSpeed` 1.5 m/s, `scaleMin`, `scaleTime`): the solver's pulls are rates in real seconds, judged at 2.5 m/s; left
  alone, snow's third of a m/s at the ground was all pull and no flow (a wall sheltered one metre, nothing shed, the boil was the picture: seen in the pass's
  own read-back). Air driven slower than `refSpeed` is solved AS that speed's air (the wind and sources ÷ k in, the step and the vent × k, the solver's own
  clock) and handed out × k: the same jets, lees and wakes in the same places, turning over as much slower as the wind is; at 1.5 m/s and over nothing
  changes (the yard scene at 2.5 m/s reads back the same numbers with the rule and without). The price: from a restart a light wind's wakes take about half a
  minute to form (the field starts at the ambient everywhere, so nothing waits on them). CONFINEMENT ONLY WHERE THE AIR MOVES (`air_field.wgsl
  confineGate`): in the slack air of a walled yard it fed the grid's own grain until every cell pointed its own way (seen in the pass's compound read back
  from the page; the page test's COURT scene measures it: a cell 40 % of the mean speed off its neighbours' mean before, 14 % after at 2.5 m/s, 25 % at
  snow's wind, where it was 68 %). IT IS STEPPED ONLY WHILE SOMETHING READS IT: a reader calls `airWant(g)` each frame it wants the air (the grains do, on a level in snow); a frame
  nobody asked for draws no map and encodes nothing, so a level whose air nothing rides yet pays nothing. It is not stepped either once every source has
  been at zero for 6 s, or with the engine setting `airSim` off (`airLive` is then false and every reader falls back on the formula). Its six kernels
  compile asynchronously like every other module's; a device that reports an error building it leaves the engine without one. `wind.ts`'s analytic field is unchanged and is still what the smoke solver, the loose particles, the moths and the debugger's arrows read:
  the simulation is a GPU texture, game code reads no GPU value, and TODAY ONLY THE BLOWN SNOW RIDES IT (the bullet below) — a picture only.
  SWITCHES: `AIR_SIM.on`, ON in the page (`?air=0` = no field is built, the build as it was), OFF in the module and on the frozen stand (`TPS_AIR=1`;
  `FROZEN_HOLDS`, the knob registry, the journal: a recording from before the table replays with it off). Live, for a perf sweep: engine setting `airSim`
  (and `airEvery`, sixtieths between steps). Console: `__air` (`sim`, `stats`, `solver`, `mask()`, `readBack()`).
  CHECK: `bun run tools/qa/probes.ts airsim` (17 lines: the stands, the map on the pass, the compound and the office — walls solid, no wall leaks, roofs,
  snow banks and low boxes open, a door shut then swung then off its hinges, a hidden box, what is handed to a stand-in field, still air not stepped,
  no reader or the setting off = nothing drawn and nothing stepped, one digest on and off over
  300 frames, the constants the three files share), green on BOTH stands; `AIRSIM_BREAK=1` fails. The solver alone has a page test on the software adapter
  (`node tools/qa/air-field-page.cjs`: stable, a jet through a gate, a lee, eddies shed at a door leaf, a walled yard that is a flow and not grain,
  decay to rest; `--wind 0.34 --only yard|court` is a look at snow's wind, whose pass marks are the 2.5 m/s ones).
  NEXT, each its own switch and its owner's word first: the loose particles and the near rain reading the texture; the smoke solver's level pull. NOBODY HAS SEEN IT ON A GPU, and its cost is untimed: the budget is under about 0.3 ms at
  High on the maintainer's Mac, read off the F8 sweep's 'wind sim off' row.
- **The depot has roofs of its own now** (10-13; corrects "the office / block / depot the same" above). The authored-levels goal rebuilt the depot's floor, so it is no longer in the office's
  shell: with no weather picked, `Weather.ownStorm` is true there and the storm is cut by the depot's own three roofs (measured headless: 0 of 673 open points kept dry, 0 of 237 roofed
  points rained on). `tools/qa/ownroofs-check.ts` moved `depot.json` from its 'same' list (now the office and the block) to its own-shape list (records, compound, barracks, depot: open /
  frame / wind lines each); 19 checks. No game code moved: the rule reads the level's roofs, only the check's list and two comments named the depot.
- **Snow is a LEVEL's weather, not a kind to pick** (10-14; `weatherKinds.ts SNOW / SNOW_LEVELS / snowLevel`, `weather.ts levelKind`, `game/snowFx.ts`; the maintainer: "can we also have
  snow levels? the rain already looks incredible", then "i think we should probably curate snow levels and have the art be custom. seems like a lot to have it just be slapped on"). So
  there is NO `?weather=snow` and no seventh word on the Weather row: `'snow'` is a `WeatherKind` outside `WEATHER_KINDS`, and a level is in it because its NAME is on `SNOW_LEVELS` (today
  `pass`: `levels/pass.json`, `tools/levels/pass.ts` — `docs/agents/missions.md`, its last bullet). The snow that LIES is that level's own boxes and paint (`gwotPalette.ts SNOW_PALETTE`): no shader lays snow
  on anything. Switch `SNOW.on`: ON in the page (`?snow=0` = the pass under the weather any level has), OFF in the module and on the frozen stand (`TPS_SNOW=1`); a `FROZEN_HOLDS` row, a
  registry table, in the journal (`applyKnobs`: a file without the key replays with it off).
  - **Born in it.** `Weather`'s constructor asks `levelKind()` (the level's name: `levelLoad.ts levelNameOf`, a WeakMap filled by `loadLevel` — `Level` has no name field) before
    `WEATHER_BOOT.kind`, and `setKind` REFUSES any other kind on such a level: no pick for the visit, `?weather=` word handed to a headless tool (`scenarioRun.ts`) or restored file takes
    the pass out of snow. `ui/missions.ts` hides the Weather row on a snow level's card and leaves `weather=` off its link. `main.ts`: a query whose `levelFile` is a snow level sets
    `WEATHER_BOOT.kind = 'snow'`, `weatherKindConfig.on` and `snowConfig.on` (the prelude's `const WX_SNOW`) before the shaders are built. The word `'snow'` on the boot alone makes no
    snow (the level file failed to load and the office stands in: its own storm, and its rain is drawn as rain — a flake is `WX_SNOW` AND a frame with rain 0,
    `particles_common.wgsl snowNow()`), and on a PAGE (the kind locked) a level named `pass` loaded into a page opened on another level is not in
    snow either: no flake is in its shaders. The stand's word is read BEFORE the Game is built (`standup.ts`, beside `TPS_AIRDUST`): the Weather picks its kind in its constructor.
  - **The lying snow is ONE SURFACE, and its look is a switch of its own** (10-14, after the maintainer's first GPU look at the pass: "it does need to feel more organic. maybe we could do it
    with a height map or something like that? the rectangles don't seem to work. and i think we can make the material seem much cooler / feel like freshly fallen snow"; this
    CORRECTS "no shader lays snow on anything" above). `weatherKinds.ts SNOW_LOOK = { on, wisps }`: ON in the page (`?snowlook=0`, `?snowwisps=0`), OFF in the module and on the frozen
    stand (`TPS_SNOWLOOK=1`, `TPS_SNOWWISPS=1`; both show only with `TPS_SNOW=1`), two `FROZEN_HOLDS` rows, one registry table, in the journal. PICTURE ONLY, both words: the level's
    boxes are untouched (count, places, flags, paint: `snowlook-check untouched`), no ray, bounce or meter reads any of it, and a played run's digest is the same on and off.
    `render/snowField.ts buildSnowField(level)` (built by `game.ts` beside the traffic map, only on a snow level with `on`; `Game.snowField`) reads the level's placed snow by its PAINT
    (`snowPaintOf`: a runtime box has no group) and bakes four numbers a texel over the plan, 10 texels a metre, rgba16float: r MOUND = metres of snow standing — every SOLID snow box
    (drift, bank, ridge) under one smooth hill at least 2 cm over it on its footprint + a texel, running out over a reach that grows with its height; g COVER = snow lies here (not
    under anything of size with air under it, a little blown in under an edge; not on cleared earth, into which it creeps); b PACKED / a OLD = the thin strips in those paints; cleared
    earth is laid LAST and wins (a path's or a rut's strip is not drawn across it: `snowBox` discards a trodden / old strip where the field holds none). Every edge is soft, wanders
    (position-seeded value noise) and BENDS (a slow domain warp of 0.2 m: a straight side of the file comes out as a line that is not). A hill is FLOODED out from its own box over
    ground a man could walk from it: it goes three texels into a wall and never out of its far face (a bank against a house does not come up through the floor behind), nothing
    stands deep under a roof, and its skirt is hollow (most of the height gone in the first third of the reach). `shaders/snow.wgsl` (in the g-buffer's module; `const SNOW_SURF` in the prelude from
    `frame.ts snowLookConfig.surface`, raised by `main.ts` at boot beside `snowConfig` — false = dead code; `gbuffer.ts` group 1 bindings 8 the field, 9 its uniform block, a 1×1 zero
    and a zero block on every other page): `fsBox → snowBox` shades every upward face at floor level of a FILE box off the field (so a strip's own outline shows nowhere; a strip's
    side under snow is discarded), and a snow-painted box above the ground as a CAP (rounded toward a wandering edge, a thin NoShadow one's sides not drawn); `vsSnow / fsSnow` draw
    the hills as a mesh of the lattice quads with snow standing (their pixels carry the ground slab's id; the swallowed boxes are still rasterised and traced, under it). One finish
    for all (`snowShade`): slopes of the field + a slow swell + wind ridges + boot dimples tilt the normal; hollows bluer; glints = a share of pixel-sized grains with a tight lobe and
    almost no lean (a leant grain is a dark speck under a low lamp: seen, then cut). A CAP up on a wall or a lorry takes the fine relief alone (not the slopes of the ground
    field under it). The hills are drawn BEFORE the boxes (what they cover fails the depth test instead of being shaded twice). `Game.syncSnowLook` follows the switch every
    frame: a recording's knobs applied to a game already built take the field back (or bake it). The picture's albedo (`SNOW_SURF.fresh` 0.76 0.83 0.95) is NOT the paint (0.66 0.71 0.78), which
    bounce, rounds and the meter still read. Numbers: `SNOW_SURF`, live as `__snow.look` + `__snow.relook()`. NOT done: the cut pipeline's `fsBoxCut` has no snow (no snow box is
    ever cut today), encounter decals are not drawn on the hills' mesh, dynamic boxes never take snow. THE HILLS HIDE WHAT LIES AT A DRIFT'S FOOT, and the simulation does not know: on the pass 61 m² of ground the
    simulation calls clear lies under more than 10 cm of the picture's snow, 15 m² under more than 20 cm, 3 m² under more than 30 cm (of 366 m² open; most of it the 16 cm
    ring the mesh needs round each box) — a grenade or a dropped thing there is not seen, a body is half seen, and a guard sees them as ever. The maintainer's call. QA
    `tools/qa/snowlook-check.ts` (`probes.ts snowlook`, family `weather`; `SNOWLOOK_BREAK=1` bakes the hills under their boxes; both stands). Seen on software-rendered stills only:
    never on a GPU, never moving.
  - **Plays as Overcast, to the digest.** The preset's simulation numbers are Overcast's to the digit (storm 0, rain 0, the same wind and cloud, no fog) plus `snow: 0.6`, which only
    `Weather.snowRate` → the CPU-only `WeatherFrame.snow` carries. `frame.rain` is 0 under snow: nothing is wet, the lattice rain draws nothing, no rain bed, hearing mask and air
    transmittance exactly 1. Footprints, slower feet, muffled sound and tracks a guard can follow are NOT built: they are the maintainer's calls (the goal's page).
  - **The flakes** are the particle rain's ring in another dress (`rainFx.ts updateRainFx` hands the frame to `snowFx.ts updateSnowFx` when `snowing(g)`): the same emit record
    (`rainDisc`), light test and wind field; a flake falls at 1.25 m/s (drag = gravity ÷ fall; integrated exactly toward its terminal velocity, so the fall is the same at 20 fps and at 144), enters at the top of the slab at target ÷ fall-time a second (the trickle), while whatever is MISSING of the population — the first frame, a restart, a cut to open
    ground — is laid through the slab's whole height at once (the make-up fill: a fresh disc is full now), births counted when the RING has taken them
    (`rainStats.emitted`), so an undrawn frame leaves no phantom flakes, sways on its
    own flutter, wraps round the disc's square (`frame.weatherE` carries the disc; the wrap lands under a roof = gone), lands without a splash, and is drawn as a soft round dot with a
    broad phase, no glint, nothing refracted, lit by the lamps that reach it AND by the sky's dome (a white scatterer shows against a dark yard; a drop of water does not) (`particles.wgsl rainStep`, `particles_draw.wgsl rainFragment`, all under `snowNow()`: dead code on every other page). `SNOWFX` holds the
    numbers (`__snow.fx` live on the console; `__snow.stats / .ring / .summary()`). No moths fly in it. `?norain2` / the panel's particle-rain box put
    the flakes off with the ring they ride. One make-up fill waits on the ring at a time (an undrawn tick, two ticks to a frame under `?fixedstep`), never more than the ring has room for.
  - **Whose the recycler's table is** (10-23; no switch: it changes what a snapshot holds, nothing a player sees but the frame after a save is put back): the
    HOST's, `engine.hostBooks.snow` (`snowFx.ts SnowShown`, in `host/api.ts HostBooks` beside the fires' and the smoke break's). It was `snowFx.states`, a table in
    the game's state, and every field of it follows the particle pool (what the ring took, whether there is one), the view the update is handed and the
    render settings. MEASURED before the move: twins on the pass, seed 7, 300 frames, one with a stand-in pool and one with none, parted at 22 rows of it
    and nowhere else of the snow's (`stateDiff` with `own`). NO RULE READS IT: its readers are the module, the panel's layers (`ui/sceneLayers.ts`,
    `ui/sweepSnow.ts`), the page's `__snow` hook and the checks. THE BOOK IS DROPPED, with the ring emptied in the same call, by a save in memory put back
    (`host/putback.ts`) and by a restart or a load (`game.ts restartEncounter`): the next frame begins a fresh book over an empty ring and fills the air through
    the slab's whole height at once, as on a level's first frame; the curtains' drift starts from nothing, the record seeds from their first, and a seed set
    by `__snow.seed(n)` is gone with the book. Flakes in the air are never wound back (nothing on the GPU is). THE KICKS went the same way: the pool's path
    sorted and cut the game's own list (`SnowTracks.kicks`), so a game over a pool and the same game without parted at it on every frame a boot met snow
    (found on the shipped stand by the new line: two kicks listed after two frames of the stood game). The list is only read now: each kick carries its number
    (`n`, `SnowTracks.kicked`, never wound back by a restart), the book keeps the last it saw and those waiting (`kickSeen`, `kickQ`), and only time, a
    restart and the cap empty the list. The cap went 64 to 256 with it (`snowTracks.ts KICKS_MOST`): the list is now a quarter second's kicks, filed or not,
    where it was one frame's backlog. Where the game's count stands behind the book's (the harness's put-back, which tells no host) the book files none of the
    listed kicks. CHECKS, both stands: `snow-check` line `book` (the game's state hash before any snow frame, after sixty over a pool, after a snapshot of
    frame thirty put back, and sixty frames on: one word each side of the host's put-back; the book dropped, the ring emptied, one make-up fill on the next
    frame) and `snowmarks-check` line `kickbook` (nine marks: owed 9, 6, 3, 0 over the frames, nine records at nine places, the game's list and state hash
    as they were). `SNOWBOOK_BREAK=1` fails each (the book hung on the game; the list cut as the pool's path once did). NOT YET THE WHOLE OF THE SNOW: with
    an air field the same update's pool path still writes the air's row (`airSim.states`: it exists only where a field does, `want`, `stats.why`, `puffs`),
    measured 10-23 on the shipped stand; a blast's owed snow and the rain's own recycler went to the host after it (the next bullet), and the wind's two
    scratch vectors left the state the same day (`wind.ts`). `book` passes because it has no air field. ALSO MEASURED, the snapshot's own: the host's put-back moves the game's state hash by itself, because the books of what was last sent to the GPU
    are in the state (`world.visibleSent` 7711 values and `gbSent` 4608, `game.chars.instSent` 744, the epochs, `game.snowLookWas`): a hash taken after
    `hostAfterPutBack` is not the saved moment's (`docs/agents/replays.md`, the rollback snapshot's KNOWN LIMITS). ON A PAGE (headless Chromium, the software
    adapter, very low quality, the pass's room clear with four, 40 frames): 119 pipelines, none failed; snowing with 800 of 800 flakes reckoned in the air after
    ten frames; a save kept in memory loaded — a fresh book on the next frame, 640 flakes laid at once, 800 of 800 eight frames on, and the kicks the game
    still listed thrown up again (14 to 33 filed across the load); a restart the same; no console, page or GPU error. Never seen on a real GPU, and
    nobody has looked at the frame after a load on a snow level.
  - **Whose the rain's table and a blast's owed snow are** (10-23, no switch: the picture's own books moved, nothing a rule reads). Two more tables of the
    kind the bullet above names were in the game's state. `rainFx.states`, the particle rain's whole recycler (the births and their dice, the drops under
    the disc, the drip lines and the walk that finds them, the lattice's lean, the read-outs), is `engine.hostBooks.rain` (`rainFx.ts RainShown`).
    MEASURED on the office's storm, seed 7, 300 frames, the particle rain's switch on in two games and a stand-in pool under one: seven values of the table
    apart (`seed`, `serial` 560 against 1, `birthAcc`, `dripAcc`, `pop` 1394 against 0, `popLog`, `wasActive`) AND 649 of the collision world's query stamps
    (`game.col.stamp` 235, `cellStamp` 414): the drip walk's rays and gathers ran whole on the host with a pool and in shares on the one without. The walk
    asks the collision world aside now (`scene/collision.ts aside`, its own stamps kept in the book), so a host that looks for drip lines and one that does
    not hold one state too. After: 0 values apart, one state word. What a blast in the snow owes the pool (`puffLeft`, `flakeLeft`), whose turn the grains'
    throw is and the three records' counts (`puffs`, `thrown`, `throwFrames`) are `engine.hostBooks.snowBlast` (`snowBlast.ts SnowBlastShown`); MEASURED on
    the pass, shipped stand, one blast: `puffs` 28 over a pool, 0 over none, and the game's state of the blast the same in both. What changed in the GAME's
    table to make that so: a blast is kept half a second on any host (`LIVE_S`, or its throw's time where tuned longer; it was let go at 0.14 s once a pool
    had taken everything, at 0.5 s where none had), and `snowBlastStats` is a copy that makes no row (asking the read-out of a game nobody had blasted used
    to add a row to its state: the Scene panel's Blast line did it on the page). WHAT A PUT-BACK DOES, both books dropped whole with the bag in the call that
    empties the ring (a save loaded, a restart): the rain's dice, drift and lean start over and the lattice stands in under the disc while drops fall in again
    (as a restart always did); the drip lines are found again, at once where rain is drawn (the office's 973 points: 7 ms the median of fifteen walks under
    bun, 20 ms the worst), where a restart used to keep them; a blast still live is owed whole again (a blast under half a second old at a load throws its
    puff into the emptied ring once more). The game put back with the host NOT told (a check's own restore, a tick played again) files nothing twice: a
    live blast whose serial the book has met and has no row for is owed nothing, as the kicks are. CHECKS, both stands: `bun run tools/qa/rainbook-check.ts`
    (`probes.ts rainbook`, in `weather`), 4 lines — twins (240 frames, one state word, 0 values apart, 447 records taken) / aside (the whole walk leaves the
    state word alone) / putback (the host's own put-back: the book gone, the ring empty, the same drip lines found on the next frame, the air full 120
    frames on, the twins one state) / restart; `RAINBOOK_BREAK=1` (the book hung on the game) fails 3 of 4. `snowblast-check` line `owed` (pool against
    none, the read-out asked of a fresh game, two restores with the host not told, the host's put-back with a blast live); `SNOWBLASTBOOK_BREAK=1` fails
    it. NOT DONE, and whose: the drip lines are found again only when the COUNT of statics changes (furniture blown away in its own slot keeps its drip
    points: an older rule of the rain's, the reviewer measured nine such points in the office), and each book tells a put-back it was not told of by its
    own sign (the kicks and the blasts by a count gone back, the rain by the ring's count) where one signal from the snapshot would serve all. ON A PAGE
    (headless Chromium, the software adapter, very low quality): the office's storm, 118 pipelines, none failed — raining with 973 drip lines; a save kept
    in memory loaded: a fresh book on the next frame with the same 973 lines, the ring begun again from 55 drops; a restart the same. The pass, 119
    pipelines: one blast marked, 28 wisps and 180 flakes filed on its frame; the save taken then and loaded: a fresh book filed the 28 and the 180 again,
    and the blast was let go by the game's own clock (no row left twenty frames on). No console, page or GPU error. Never seen on a real GPU: nobody has
    looked at rain, or at a blast's powder, on the frame after a load.
  - **The rain is as it was**: no rain number, shader path or still changes on a page that is not a snow level (the `WX_SNOW` branches are compile-time false there).
  - **Check**: `bun run tools/qa/snow-check.ts` (`probes.ts snow`, in `weather`), 12 lines — born / off / others / row / senses / same / flakes ×2 / book / walls / save / old; 12 of 12 on BOTH stands
    (10-23), `SNOW_BREAK=1` (the switch never raised) fails 9 of 12 on both. `same` is five PLAYED runs of the pass's room clear (`playthrough.ts --one pass-four:<seed>`, `PT_DIGEST=1`, a process
    each): seeds 1 and 2, one digest every half second in snow and under Overcast with the switch off (frozen, the level as committed: 124 s and 127 s, both taken; shipped: 90 s and 105 s, both taken), and a different
    one for seed 1 in fog (the control — a 40 s run with nobody ordered anywhere, the first cut of this line, had one digest under EVERY weather and proved nothing).
  - **A file made in other weather** is refused on a snow level (`Weather.refuses`), and `restore` takes none of its rain, wind or wet: a checkpoint made on the pass with the switch
    off (the storm any level has) does not rain on the snow when loaded with it on. With the switch OFF the pass stands under that storm and its ground slab is wetted like any lot
    (`gwotSimOf` knows the soaked snow paints as it knows every wet lot): the frozen stand's tallies of this level are of rain on wet snow, the page's of dry snow under Overcast's sky.
  - **Known, left**: the debugger panel's particle-rain rows and weather buttons do nothing on a snow level (the recycler writes the look every frame; the level refuses the kind);
    `snowFx.ts` keeps its own copies of the rain recycler's small helpers (the rain's file is not this goal's).
  - **Seen** on the software adapter only, low quality (1500 flakes at most), stills of a paused page: the shaders build (112 pipelines, no console or GPU error); flakes read as soft
    pale dots over the road at the gate and over the yard, warm inside a lamp's or the brazier's reach. THE FOG OF WAR hides flakes, glows and smoke over ground nobody on the squad
    sees: a still of the whole yard from the start is black without `&nofow`, and that is the fog, not the snow. `SNOWFX.skyK` (the sky's light on a flake) is 1.5: 1 read well in
    the yard's stills under the old 0.15 moon, 3 was not looked at. **Never seen on a GPU, never seen moving**: the flutter, the wrap as the camera walks, the fill at a cut, the
    flakes' size and brightness in play are numbers judged on a handful of stills (`SNOWFX`).
- **Boots press the snow** (`src/game/snowTracks.ts`; `snow.wgsl snowPrint` and the `SNOW_TRACKS` block of `snowShade`; g-buffer group 1 binding 10; the
  maintainer, 10-14: "ideally it looks natural, deforms with character movement", and his reference the same day, a Red Dead Redemption 2 clip: deep prints with
  crumbly raised rims, a dragged load's trench with a bank either side). PICTURE ONLY: nothing in the simulation reads a print, no guard follows a trail (his call,
  not built), no step is slower or louder.
  - **Switch**: `SNOW_LOOK.tracks` (weatherKinds.ts) — ON in the page (`?snowtracks=0` off), OFF in the module and on the frozen stand (`TPS_SNOWTRACKS=1` raises it;
    shows only with `TPS_SNOW=1` and `TPS_SNOWLOOK=1` on a snow level: the prints are a dent in the height-field surface and there is nothing to dent without it).
    Shader half behind the prelude's `const SNOW_TRACKS` (frame.ts `snowLookConfig.tracks`).
  - **How**: one more texture over the world's plan, `TRACK_RES` 32 texels a metre (1280 × 899, r8: 896 rows of plan and `TRACK_PAD` 3 past it), kept on the CPU and handed to the g-buffer a changed rectangle a
    frame (`Game.stepSnowTracks`, after everybody is posed and the fog of war has said who is hidden). A foot is DOWN when its ankle bone is under `ankle` over where
    he stands and it is travelling slower than `still`, or than `stillK` of his own pace if that is more (the stance foot does not move, the swinging one goes at twice
    his pace: an absolute speed alone read a slow crouch's swinging foot as down and its trail was a smear); it presses a sole (a capsule heel → toe, the heel `heel`
    of the ball's width) where the field holds snow (`cover` ≥ 0.5: none under a roof, none on swept earth), once every `apart`. A man who is down (dead, or his hips
    under `bodyLow` over where he stands) presses the hollow of his trunk and legs once he has lain `rest` s with his hips slower than `restV` — where he comes to
    rest, not where he fell through. A guard or a civilian the fog of war hides puts nothing on the map while hidden (nothing live shows in the fog): with `FOG.tracks` his
    marks are kept off it and laid whole when the team next sees that snow after having had it out of sight (`docs/agents/stealth.md`), with it off he presses nothing; civilians not on the
    floor press nothing. The byte is a signed distance about the outline (255 inside, 128 on it, 0 half a `skirt` out): the shader reads its inner half as the
    print's wall and its outer half as the rim of pushed-up snow, slopes the lying snow's normal by it, breaks the pressed floor and the rim into clods (rough, no
    glints), and paints the floor darker and bluer. Deeper where a drift's skirt stands, shallower on trodden and old snow.
    A restart unmarks the snow and forgets every man's last footfall (`resetLevelState` → `clearSnowTracks`); a checkpoint does not carry prints.
  - **Untidy prints** (`SNOWTRACKS.mess` 0‥1, default 1; the maintainer, 10-14, over a photograph of a trail in fresh snow under a low sun: "footprints can also
    be a bit messier"). No switch of its own: authored look data under `SNOW_LOOK.tracks`. ONE number scales all of it; **0 = the clean sole, byte for byte as
    before the number** (the old `press` call, untouched). Above 0 a footfall goes through `pressMessy`, everything off `hash3` of the print's texel and its
    number (`T.prints`) and off `planNoise` (value noise anchored to the world) — never `simRandom`, never a clock: the same walk presses the same bytes, and a
    run's digest does not know prints exist. What it does, in the same byte with the same meaning: (1) the LIP is broken — the outline wanders `crumble` m in
    lumps `lump` m long, and the bank's reach runs (1 ∓ `reach`) of the clean one's along its length, up to `kick` further ahead of the toe and on the outer side;
    (2) CLODS — up to `clods` a print, radius `clodMin`‥`clodR`, thrown up to `clodFar` past the toe (leaning outward) or beside the outer edge, each a mound in
    the bank's half of the byte (0.25 = the bank's full height), so the shader needs no new meaning for "raised lump"; (3) SCUFFS — the heel cuts a shallow
    tapering groove up to `drag` m back toward this foot's last print (straight behind if that is not a stride away), the toe one `toeDrag` of that forward,
    `dragDeep` of the way to the floor at the boot's end, run out to nothing; (4) EVERY PRINT ITS OWN — turned ± `yaw`, ± `size` in length and width, its own
    depth (`shallow`), its own share of thrown snow; (5) the FLOOR — crumbs `crumb` m across stand up to `crumbs` short of the floor. The outer side is the
    side of the man's middle the foot is on. A fallen man's hollow is still the clean capsule.
    A RUN TEARS IT UP (10-15; the maintainer: "sprinting should leave messier trails"): `pressOf` hands `pressMessy` how fast the MAN is going as the foot lands —
    `run` = a smoothstep of his speed from `runLo` 2.4 to `runHi` 4.4 m/s (a walk tops out near 2: 0, and then not one byte nor one hash draw differs; a jog's
    3.3 is about two fifths; a sprint's 4.7 is 1), × `runMess` (0‥1, the run's master: 0 = a sprinter's print is a walker's). With it: the print itself up to
    `runLen` longer (the boot slides), the heel's scuff (1 + `runDrag`) × and the toe's (1 + `runToe`) × as long and `runDeep` deeper, the bank's throw
    (1 + `runKick`) ×, the lip's break (1 + `runCrumble`) ×, (1 + `runClods`) × the clods landing (1 + `runFar`) × as far, and a SPRAY of up to `spray` more
    thrown out BEHIND the print, the way the foot came from, up to `sprayFar` m in a fan `sprayFan` rad either side. It shows in the
    player's trail, a defender's who runs and a teammate's where he runs (team-feel.md, `TEAMPACE`). `probes.ts snowtracks` line `sprint` (the fixed footfalls at 1.4, 3.3 and 4.7 m/s: 1,602 / 2,127 / 2,759 texels
    marked; the sprint twice the same bytes; runMess 0 = the walk's bytes), both stands; under `SNOWTRACKS_BREAK=1` the sprinter is handed over as a walker and
    the line fails. Never seen on a GPU.
    THE SHADER'S SHARE (`snowPrint`, `snowShade`): where the byte is above 0, world-anchored `detailNoise` (6 cm, and 2.7 cm while a pixel can hold it) makes
    what stands above the snow 0.6 × to 4 × the bank's height and back-fills the wall and floor by up to a third; the four taps already taken for the slope
    give a curvature, which paints a lump's foot and a crack 16 % darker and its top 10 % brighter (no ray is cast for a lump the size of a fist: its shade is
    painted). All of it × mess: at 0 the shader's arithmetic is what it was. HOW THE NUMBER REACHES THE SHADER: in the map — `messAt`, the first texel of the
    middle row of the three past the plan, mess × 100 (`tellMess`, each update: a console change of `__snow.tracks.mess` reaches the shader on the next frame
    and the stamps on the next print); `snowPrintMess()` loads it. The uniform block's eleven rows are full and are another file's; the rows either side of
    the texel are blank so no sample of the plan ever blends with it, and nothing writes plan bytes there (`planH`).
  - **Numbers**: `SNOWTRACKS` (the stamps; `__snow.tracks`, `__snow.trackStats`) and `SNOW_SURF.trackDeep` 0.08 / `trackRim` 0.012 (the look; `__snow.look`, then
    `relook()`).
  - **Check**: `bun run tools/qa/snowtracks-check.ts` (`probes.ts snowtracks`, also under `snow` / `weather`), both stands, `SNOWTRACKS_BREAK=1` must fail (the check
    hands the prints a field that says snow lies everywhere). Thirteen lines, nine of them the prints as first built: prints along a walk over open snow and handed over (11 in 2.9 m at a walk); a slow crouch
    leaves a print a footfall (7 in 1.3 m at pace 0.35; it was one every 0.12 m, the `apart` floor, before `stillK`); nothing pressed under a roof; a man lying in
    view leaves one hollow after he has rested and a man in the fog none (stand-ins' bones); a restart unmarks it; nothing held with either switch off or on another
    level; A REAL FALL (the scenario's squad, one man put down, his ragdoll run six seconds): one hollow, pressed 82 frames after the shot, his hips 0.00 m from
    there at the end, 11 of 11 points along his trunk on pressed snow; a played room clear's digest the same on and off on two seeds (frozen 6fa3cf25 / c34aa82b,
    shipped a20dd9e1 / 483a0bb6); a recording from before the key replays with it off. FOUR MORE for the untidy prints (the stamps alone on a map of their
    own, stand-ins' bones, no game): `clean` — a fixed walk of 14 footfalls at mess 0 is, byte for byte, the old stamp kept word for word in the check (0 of
    1 146 880 plan bytes differ) and has the digest recorded on the module before the change (27b624ef; 1077 texels marked, 434 pressed; a retuned SOLE moves
    it and is re-pinned); `untidy` — at mess 1 1663 bytes differ, 599 texels are marked that the clean prints leave alone, 438 pressed against 434 (still a
    boot's worth a print), the map's mess byte reads 100; `twice` — the same walk on two fresh maps gives every byte the same; `each` — one foot set down 8
    times a metre apart on the same texel phase: eight identical 32 × 32 windows at mess 0, any two 124 to 186 bytes apart at mess 1, deepest bytes 190‥255,
    26‥65 texels thrown outside the clean print. The played digests above are unchanged with mess 1 (prints on = prints off, both stands).
  - **Seen** (software adapter, low quality, three stills; the footfalls walked in the harness and loaded into the page, because 400 stepped frames on that adapter
    did not finish in 45 minutes): trails read as footprints from the play camera, lamp-modelled, and the squad's own prints pressed live in the page while it was
    stepped. **Never seen on a GPU, never seen moving.** The untidy prints: tuned on a CPU picture of the height the shader reads (a scratch script, one
    low lamp), then judged on software-adapter stills at low quality, 800 × 450, 4 frames — the same harness-walked trail by the pass's brazier laid at mess 0
    and at mess 1, one view 3 m off and one from the play camera. Against the photograph: the lip is broken and uneven, prints differ in depth, turn and
    size, a few clods lie about them and a scuff tails off some heels and toes, and from the play camera a trail is still a row of boot prints. Short of it:
    the bank and the clods are centimetres high where the photograph's are a hand high, a clod is a soft mound two or three texels across, not a sharp lump
    with a cast shadow (its shade is painted, no ray sees it), and nothing joins print to print as a trough does in knee-deep snow. **Never seen on a GPU,
    never seen moving, never seen at a quality above low.**
  - **Known, left**: the dent is SHADING on the lying snow (a normal and a tint), not moved geometry: nothing parts at the knee, and a print on a drift's hill is
    shaded on the hill's mesh the same way. Prints never fill in while a level runs, however hard it snows. LOAD A CHECKPOINT and the snow keeps the marks of the
    run left behind. Dragged bodies and rolling chairs leave no furrow (a body presses again each 0.3 m it is moved and rests, so a carry leaves hollows where it
    is put down). Cost on a GPU unmeasured (five more taps of one r8 texture and three of the detail noise per lying-snow pixel; with mess above 0 one
    texel load more a pixel, and ten more noise taps on a pixel that lies on a print). The map's size changed with the mess rows (899 rows, not 896): a
    scratch tool that carries a map's bytes by index is unharmed, one that checks the size is not.
- **Wisps of blowing snow** (`src/game/snowFx.ts SNOWWISPS` / `updateWisps`; `particles.wgsl wispStep` / `wispAir` / `wispGust`, `particles_draw.wgsl wispVertex`
  and the `mode > 2.2` branch of `fs`; the maintainer, 10-14: "it does need to feel more organic … maybe we can even use the smoke sim for wisps of blowing snow?").
  NOT the smoke (one fluid for the picture and every eye): spindrift rides the FLAKES' ring of GPU particles as one more record a frame, picture only.
  - **Switch**: `SNOW_LOOK.wisps` (weatherKinds.ts) — ON in the page (`?snowwisps=0` off), OFF in the module and on the frozen stand (`TPS_SNOWWISPS=1` raises it; shows only
    with `TPS_SNOW=1` on a snow level). Shader half behind the prelude's `const SNOW_WISPS` (frame.ts `snowLookConfig.wisps`, raised at boot on a snow level's page).
  - **How**: a wisp is a rain-kind particle filed with ASPECT 2 (`particles_common.wgsl wispIs`; drops and flakes are 1) — no new kind, no new slot in the emit block
    (the destruction probes pin that layout). Born by the flakes' own disc shape in the bottom half metre over open ground, each try also having to land in a GUST PATCH
    (a noise stretched along the wind, carried down it), so slots are not spent on wisps that are not born. WITH `WX_OWN.wind` OFF (as this bullet was written; ON, the
    wisps read the wind FIELD where they are — the 'One wind field outdoors' bullet) it runs on the STORM RECORD'S OWN VECTOR × `speedK`, not on
    `windAir`: the wind field keeps the storm out of the bounding box of a level's roofs, and on the pass that box holds the whole yard (the flakes there fall plumb);
    a wisp keeps to open ground by `rainOutdoors` instead (born and alive only with no roof over it) and walls stop it by the trace: what faces up it slides over, what
    stands in its way starts its fade-out (`WISP_FADE_OUT`, 0.9 s: the envelope is continuous, nothing pops). Nothing is filed on a page whose shaders were built without
    `SNOW_WISPS` (`snowLookConfig.wisps`: a wisp those shaders do not know would be drawn as a flake a foot across) or with the wind's master at 0. Lit by the flake's `rainShadeV` (three shadow-tested lights + the sky) × `gain`; drawn as a soft streak along
    its velocity × `stretch`, combed into strands, nearly all added light (`WISP_COVER` of its weight hides what is behind it).
  - **Numbers**: `SNOWWISPS` (authored data; `__snow.wisps` on the console, `__snow.wispStats`). `speedK` / `opacity` / `gain` are live at once — they ride in the rain
    look's `refractReachM` / `refractClamp` / `refractDepth`, which a snow level never reads (refraction is off there) — the rest reach the next births (stretch, meander
    and patch size ride in the record's colour word). Births × (the storm's gust)^`gustPow`. THE RING IS THE FLAKES' FIRST: wisps are filed after them, take what is left
    of the frame's 640 births, and `max` ÷ `life` is sized so the flakes keep their own cap of 4000 (`snowFx.ts` `wispSlots`); raise `max` past that and the flakes' cap
    comes down.
  - **Check**: `bun run tools/qa/snowwisps-check.ts` (`probes.ts snowwisps`, also under `snow` / `weather`), both stands, `SNOWWISPS_BREAK=1` must fail: records filed
    on the pass with the switch on (disc, height, aspect, own seeds, rate), more in a gust and none in still air, none with the view under a roof, none with the switch
    off, the flakes' records the same record for record on and off, one game digest with the recycler filing on and off (a played run was dropped from this check: `playthrough.ts` has no particle pool, so no wisp code ran in it),
    every wisp statement in the shaders behind `SNOW_WISPS`. The harness has no GPU: where a wisp is thrown, how it moves and what it looks like are NOT checked there.
  - **Known, left**: blasts do not push wisps (impulse records name kinds; the rain kind is not one of them). Nothing peels off wall tops (no emitter there); a wisp
    does leave a drift's crest, by sliding over what faces up. The flakes still fall plumb in the pass's yard while wisps run across it (the wind field's roof box) — with `WX_OWN.wind` off; on, both ride one field there.
    The lying-snow height field is not in the trace grid as far as this code knows: a wisp hugs the BOXES' ground, and the splat's soft depth fade is what hides it
    in a raised drift.
  - **Seen** on the software adapter only (SwiftShader, low quality, 800×450, stills of a paused page stepped 10 to 16 frames of 0.3 to 0.4 s, the flakes thinned to
    2 /m² for speed): the shaders build (112 pipelines, no console or GPU error); at the gate from 11 m and over the yard from the play camera (21 m, 55°) the wisps
    read as low soft streamers along the wind, warm inside the gate lamp's and the brazier's reach, blue-grey outside it, dark in a wall's shadow, cut at the lorry,
    none under a roof. Three rounds on the look: 0.2 weight / 0.34 m was all but invisible; 0.45 m wide read as broad brush strokes and 0.8 weight as white blotches
    in the lamp's pool; 0.26 m × 0.85 s read as ruled scratches from the play camera; 0.34 m × 0.7 s at weight 0.6, light × 2.5 still read as speed lines over the
    yard; 0.6 m × 0.3 s at weight 0.3, light × 2 (a low pale veil, seen over the lying-snow surface from 11 m) is what stands. **Never seen on a
    GPU, never seen moving**: the gusts coming and going, the meander, the patches crossing the yard, the fade at a wall, TAA on them, their cost at 1000 wisps of
    overdraw, and how they sit on the lying-snow height field are all unjudged.
  - **Since** (10-14/15): 'never seen on a GPU' above is how this bullet was written. The maintainer has since looked at the wisps on a GPU ("a little hokey …
    overall this should be subtle": his words are in the bullet 'Fine grains of blown snow ride the simulated air' below), and with `SNOW_LOOK.grains` on and the
    air field running the wisps ride the simulated air instead of the formula, their cap × 0.6; `?air=0` or `?snowgrains=0` = the wisps as this bullet has
    them. They stood back from the view's middle as first shipped; since 10-15 they are born over the whole disc again (`SNOWGRAINS.wispsBack` 0) after his
    second look ("i actually like the far wisps"): that bullet's own 'Since' lines have both.
    AND SINCE the bullet 'One snow in one air' (10-15, `SNOW_LOOK.oneAir`, on in the page) no grain is filed and a wisp is lifted snow, born only where the
    air is fast enough: everything this line says of grains and wisps is then the page under `?snowair=0`.
    AND SINCE the bullet 'The pass, played 10-15' (at the foot of this file) a wisp is DRAWN as a puff of pinpoint grains, not the combed streak this bullet
    describes (`SNOWWISPS.motes`; 0 = the streak again): its sub-bullet 'A WISP IS A PUFF OF FINE SNOW' has the draw and what nobody has seen of it.
- **Fine grains of blown snow ride the simulated air** (10-14; `weatherKinds.ts SNOW_LOOK.grains`, `snowFx.ts SNOWGRAINS` / `updateGrains`,
  `particles.wgsl grainStep` / `airAt`, `particles_draw.wgsl grainVertex`, `particles_common.wgsl grainIs`; the maintainer on his first GPU look at the wisps: "a
  little hokey. it should really feel like snow blowing around, which I think is much smaller/high frequency … chaotic fluid dynamics, not just a single
  static pattern that lines up with the wind … fancier snow close to the character and less fancy (like the current state) outside a radius", "overall this
  should be subtle"). A third kind in the flakes' ring (a record of aspect 3; 2,600 slots within 9 m of the view's middle). Each slot is a grain that LIES
  until the air over it is fast enough to pick it up, then FLIES for a second or so on the air field's velocity there (× `speedK`, with two octaves of small
  eddies on top and the field's lift up a wall's face), skips off the ground while the air stays fast, is turned by a wall and sometimes taken by it, and fades
  in dead air — so they stream through a gate, curl in a lee and bank against a wall because the air does. A flight always ends faded before the ring takes
  its slot back (none is picked up in a slot's last moments). Drawn as a one-to-two pixel streak with the flakes' own lighting. While the grains are in the
  air THE WISPS STAND BACK from the view's middle (their births thin inside the grains' radius, their cap × 0.6), ride the same air instead of the formula
  (× the wisps' own `speedK`), and none is thrown into air the field holds dead. In a wind too light to lift a grain the wisps are as they were. The grains
  are the air's READER: `updateGrains` calls `airWant` every frame they are on, which is what has the field stepped. THE RING IS SHARED: with the grains on
  the flakes' cap falls from 4,000 to 3,384, and for one slot's life after a first set is filed (about nine seconds: the first set's slots wait out their
  life behind the refills) to about 2,540; on the pass the flakes' target is 2,637, so a few in a hundred fewer fall for those seconds and none after.
  SWITCH: `SNOW_LOOK.grains`, ON in the page (`?snowgrains=0`), OFF in the module and on the frozen stand (`TPS_SNOWGRAINS=1` with `TPS_SNOW=1`; they are
  filed only where the air field runs, so `?air=0` takes them out too and the wisps are then as they were). Shader text: `const SNOW_GRAINS`.
  CHECK: `bun run tools/qa/probes.ts snowgrains` (9 lines: stands, the first set and the steady trickle, nothing in still air, nothing with no field, off,
  the ring's budget, other levels, one digest on and off, every grain statement behind the constant), both stands; `SNOWGRAINS_BREAK=1` fails.
  SEEN: the page boots on the software adapter with every pipeline built. NEVER SEEN MOVING, never on a GPU: how many fly at once, whether they read as
  subtle, and their light's cost are the maintainer's to judge. `__snow.grains` holds the numbers, live.
  - **Since (10-15): the grain's dash is short and live.** the maintainer on his GPU, of the grains: "the long wisps do look like a stretched particle, maybe need to
    be reworked a bit". Each was a hard capsule along 1∕45 s of its flight (10‥20 cm, all one way). Now `SNOWGRAINS.shutter` (0.008 s of its motion),
    `dash` (never longer than 3 of its own widths) and `tail` (the tail end fades 80 %) — all LIVE on the grains in the air: `updateGrains` writes them
    to `grainCfg[16‥18]` (`particles.wgsl grain.e`), the grain's step packs them into the grain (`p.color`), `grainVertex` cuts the dash from its tail
    end and hands the fade to `rainFragment` (`prm2.z` over 1.5 = a grain). No `GRAIN_SHUTTER` is compiled in any more. The emitter block did NOT grow
    (`BLOCK_TAIL_BYTES` is pinned by a destruction probe); the grains' own uniform did (32 → 80 bytes). Asserted by `probes.ts snowblast`'s `dash` and
    `text` lines. Never seen on a GPU: the three numbers are first guesses.
  - **Since (10-15): wisps everywhere, with the grains.** the maintainer: "i actually like the far wisps and think they might be able to be made work. maybe we
    could have both the near and far ones everywhere? could we afford that?" The stand-back is now a live share, `SNOWGRAINS.wispsBack` (→ `grainCfg[19]`
    = `grain.e.w`; 1 = thinned to nothing inside the grains' radius as first shipped), DEFAULT 0: wisps are born over the whole disc while the grains run.
    Cost-neutral as shipped: the wisps' cap stays × `wispsKeep` 0.6 (600), the same sprites spread over the whole disc. NOT DONE, and why: `wispsKeep` 1
    (1,000 wisps) takes about a fifth of the flakes' cap, and grains out to the screen's edge (`radius` 9 → 13, 5,400 slots) about two fifths, because the
    ring is shared (`RAIN_CAP` 16,384) — both want the ring doubled, which is the rain's and the performance thread's to price on a GPU.
- **One snow in one air** (10-15; switch `SNOW_LOOK.oneAir`: ON in the page, `?snowair=0`; OFF in the module and frozen, `TPS_SNOWAIR=1`; `snowFx.ts oneAirOn /
  oneAirCfg`, `particles.wgsl snowOneAir / snowAir`, `snowBlast.ts snowBlastThrow`). the maintainer after tuning the pass on his GPU: "i think the blown grains don't
  look great since they look like the flakes but seem to behave differently. we should probably just unify those systems. our wind field is only 2d, right? so
  it feels a bit weird with the flakes falling down and then the blown grains near the ground behaving so differently in a way that makes the air not feel
  physical as a fluid. the wisps, then, are something else that we should think of physically. they're the wind blowing small wind particles that are near the
  surface, and then when the wind isn't strong enough, they fall back to the ground. so, they should show up when the wind is sufficiently strong."
  - WHAT WAS TRUE: the field IS 2D (one layer over the floor plan, 20 cm cells). Only the grains (and the wisps while grains ran) read it; the flakes rode the
    plain storm vector at × 1 while grains and wisps ran at × 5 of their air. Two airs, two speeds.
  - NOW, with the switch on and a field to read (`airLive`): (1) NO GRAIN KIND: `grainsOn` is false, none is filed, the flakes keep their whole cap (4,000 at
    the tier's count; the grains' slots took it to about 2,600). (2) THE FLAKE'S AIR is `snowAir(p, free)`: under `SNOWFX.airLow` (2 m) the field's velocity at
    that floor point × the storm's own height profile (0.55 at the ground → 1 at 2.5 m, so in the open far from walls it IS the open wind) + the field's lift ×
    `airLift`; over `airHigh` (3.4 m) the open wind as before; blended between. (3) A WISP IS LIFTED SNOW: a wisp record's point is asked ONCE for its ground's
    air — born with chance smoothstep(`SNOWWISPS.liftLo` 0.42, `liftHi` 0.7 m/s) of the field's speed there, none over a solid cell — it rides `snowAir` at the
    flakes' own × (`windK`; `speedK`, `gustLen`, `gustPow` are not read), and where its air falls under `dropK` × liftLo it sinks and fades. The CPU files the
    full count while any ground could reach liftLo (the field's speed × 1.5), else "the air is too slow to lift snow". On the pass (ground air 0.47 m/s, 0.3 ‥
    0.63 through a gust) that is: a few in the steady blow, many in a gust and where walls squeeze the air, none in a lee. (4) A FLAKE LANDING in air that
    would lift snow skips on along the ground with chance `SNOWFX.skid` × the same smoothstep, else lies as before. (5) A BLAST'S THROW is `SNOWBLAST.flakes`
    (180) flakes going up from its disc (`flakeUp`, `flakeLife`); the air shove carries them out. The grains' throw numbers are unread then.
  - With no field (`?air=0`, a device that built none): flakes and wisps as before the grains (gust patches, × 5), no grains. Off (`?snowair=0`): the build as
    it was, grains and all. `snowLookConfig.grains` (the shader's `SNOW_GRAINS`, compiled at boot) is now `(grains || oneAir) && AIR_SIM.on`.
  - HIS FLAKE NUMBERS ARE THE DEFAULTS (same day): `WEATHER_PRESETS.snow.snow` 1.48 (was 0.6), `SNOWFX.perM2` 34.6 (12), `size` 0.028 (0.05), `flutter` 0.41
    (0.3), `iso` 0.26 (0.75). 1.48 × 34.6 asks ~51 flakes a square metre, about 18,700 over the yard: the look he passed is THE CAP's worth (the tier's
    `particleRainCount`, 4,000), so density in view follows the camera's distance and the tier, not those two numbers, until one is brought under the cap.
  - Check: `snowair` probe (stands, numbers, one, wisps, throw, off, noair, digest 2a5d27e8 on = off, text), both stands, `SNOWAIR_BREAK=1` fails. The grains',
    wisps' and blast's own checks pin the switch off (they test those layers as they are without it).
  - NEVER SEEN ON A GPU, never seen moving. Everything a flake or wisp does in the field is WGSL no headless run executes; a software page boot proves it
    compiles and gives one still. Every number above is a first guess for his eye. NOT DONE: the field is still 2D (height is a profile, not a simulation);
    the grains' code and switch remain for `?snowair=0`.
- **Snow shows in front of a wall as in front of a man** (10-15; `particles_common.wgsl flakeHidden` / `FLAKE_WALL_IN` 0.2 m, read by `particles_draw.wgsl
  rainFragment` under `snowNow()`; its CPU twin `snowFx.ts flakeHidden`). the maintainer playing the pass: "weird anomaly where the snow renders on top of the
  character but not on top of the wall". Cause: the rain's readability rule drops a splat from every pixel whose SURFACE is not `rainOutdoors`, and a roof's
  rectangle is its building's outer walls grown by 4 cm (the packed third / fourth roofs to 0.2 m) — so every roofed building's outer wall face, the doors in
  it and its top counted as indoors, while a man at its foot is outdoors. Flakes, wisps and grains (all rain-kind splats) now ask whether the surface is UNDER
  a roof: inside a rectangle drawn in by 0.2 m (past the outer face and a door in the wall, short of the inner face) and below `CEIL_Y`. Rooms stay dry to the
  eye; RAIN keeps its own rule to the letter (`else if (!rainOutdoors(…))`). No switch (a mend of the snow's own picture; no game code reads it; digests cannot
  see it). Check: `snow` probe, line `walls` (the pass's 19 outer walls: outer face and top open, inner face and each roof's middle hidden, the bare rectangle
  hid all 19; the shader carries the twin's number), both stands, `SNOW_BREAK=1` fails it. NOT handled: where a flake itself may live is unchanged (none is
  born or lives over a roof's rectangle, so the air over a cut-away room is empty and a sight line down onto a wall's top crosses little snow).
- **A blast craters the snow and throws it** (10-15; `src/game/snowBlast.ts SNOWBLAST` / `snowBlastAt`, `snowTracks.ts pressCrater`, `airSim.ts airPuff`,
  `particles.wgsl grainStep`'s blast branch and `puffRec`; the maintainer playing the pass: "grenades/he don't seem to really affect snow"; his standing notes: "the
  control approach", "should really feel explosive and bang things around. both the explosion and shock wave"). One blast over lying snow, low enough
  (`high` 1.6 m; a pan's radius = the blast's destruction radius × 0.26, 0.3‥1.4 m: a frag's 0.65 m), does four things, each in a layer the level had:
  THE CRATER into the prints' map (a ragged pan pressed to the floor, a bank about its lip 2.2 × a print's, 13 scoured rays, 46 clods out to 3.2 radii;
  hashed off its place and its serial, so the same blast leaves the same bytes); THE THROW (for `throwS` 0.14 s half of all lying GRAINS are put down in
  its disc and thrown out at up to 7 m/s and up at 3.2: `snowBlastFeed` → `grainCfg[8‥15]` = `grain.c / .d`); THE PUFF (28 wisp records with no gust
  length, which the GPU lets past the gust thinning and the stand-back and bears running outward); THE SHOVE (a radial source in the air sim for 0.3 s:
  the snow in the air is driven off the blast and curls round what it meets). WHO: every blast the destruction engine tells (`g.destr.onBlast`: a frag,
  an HE round, a charge) — `snowBlast.ts` asks nothing about what threw it and touches no gear file. NOT TOLD: with `?nodestruction` or chaos 0 the
  engine tells nobody (the frozen harness stands at chaos 0: the check raises it); the stun charge does not go through that feed. The throw needs the
  grains up (wind enough to have any lying) and the puff the wisps; the crater needs the prints (`SNOW_LOOK.tracks`). Picture only: no die of the game's,
  no sense, no path, no sound.
  SWITCH: `SNOW_LOOK.blast`, ON in the page (`?snowblast=0`), OFF in the module and on the frozen stand (`TPS_SNOWBLAST=1` with `TPS_SNOW=1`,
  `TPS_SNOWLOOK=1`, and `TPS_SNOWTRACKS=1` / `TPS_SNOWGRAINS=1` / `TPS_SNOWWISPS=1` for its parts); the `FROZEN_HOLDS` row; `journal.ts applyKnobs`
  puts it off for a recording with no `blast` key.
  CHECK: `bun run tools/qa/probes.ts snowblast` (12 lines: stands, crater, same bytes twice, where not, the engine's feed, throw, dash, puff, air, off,
  one digest over 300 frames with three blasts on and off, the shader text), both stands; `SNOWBLAST_BREAK=1` fails 9 of 12 on both.
  CONSOLE: `__snow.blast` (the numbers, live), `__snow.blastStats`, `__snow.blastAt(x, z)` marks the snow with no blast.
  NEVER SEEN ON A GPU, never seen moving: the crater's size and depth, how dense the throw reads, whether the puff is too much are the maintainer's.
- **A blast digs the snow's hill out** (10-15; `src/render/snowField.ts digSnowField` / `restoreSnowField`, `snowBlast.ts SNOWBLAST.dig` / `digS` /
  `stepSnowDigs`, `gbuffer.ts setSnowFieldRect`; the small-flaws thread's page look at a wall charge on the pass: the bank at the wall's foot goes with
  the blast — `furnblast.ts FURN.mouth.snow` — and "the smooth snow hill is still drawn across the sill": the hills were baked once). Part of the blast's
  switch (`SNOW_LOOK.blast`; off = hills never change): a blast that marks the snow also digs the baked hill out IN PLACE round it — to nothing within
  about `dig` 1.5 × the pan's radius, itself again half as far on, on a ragged outline, always reckoned from the hill as baked (asked twice, nothing
  more goes) — but never under a snow box that still stands solid there: each keeps a hill of the bake's own shape (a finger over its top, a hollow
  skirt on a wandering line — a flat step with a cliff at the box's edge read as the box drawn again in the first software still), never higher than
  the hill as baked. So a frag on a bank changes almost nothing but the prints; a charge whose hole takes a bank's tall tiers leaves the low foot's
  own 0.18 m of smooth snow across the sill (the mouth rule leaves the 0.16 m foot: it stops nobody); everything taken, the hill goes to the ground. Asked again each frame for `digS`
  1.5 s (the mouth may take the box a frame after the blast; the field's texels are WALKED only on the dig's first frame and when what stands solid in its
  reach changed, `digSnowField`'s `keep` and the field's own notes, `field.walks`: asked again with the same boxes standing a dig cannot lower a texel, so
  the field is the same to the byte, held by `snowblast-check`'s `kept` line against a twin walked every frame: two digs that overlap, a bank cut short, a
  bank taken, a restart, a field built anew. Walking every frame cost 0.2 to 1.2 ms a frame for a frag's pan on the pass and 2 to
  11 ms for the widest pan, headless on a cloud core, and grew with the square of `dig`), it re-sends one rect of the field's texture (no rebake: a full bake is 230‥280 ms; the
  mesh is left, a corner with nothing on it dives under the ground), and a restart stands every hill again. Check: `snowblast-check`'s `dig` line,
  red under `SNOWBLAST_BREAK=1`, both stands. A checkpoint does not carry a dig (picture only). TRIED AND TAKEN BACK (10-15): making every snow tier
  over 0.19 m a ghost box so that no lying snow stops feet — the baked field stayed byte for byte, but both played seeds of the pass's room clear went
  from the level taken in about 125 s to the team wiped inside 40 s (the banks shape the routes); banks still stop feet, as authored. NEVER SEEN ON A
  GPU: the dug hill's edge.
- **Breath steams in the cold** (`src/game/snowBreath.ts SNOWBREATH` / `updateSnowBreath`, called from `game.ts` after the fog of war's update, beside the prints' step; the maintainer,
  10-14: "we should have steam from breaths in the cold levels too"). PICTURE ONLY.
  - **Switch**: `SNOW_LOOK.breath` (weatherKinds.ts) — ON in the page (`?snowbreath=0` off), OFF in the module and on the frozen stand (`TPS_SNOWBREATH=1` raises it;
    shows only with `TPS_SNOW=1` on a snow level — it does NOT need `TPS_SNOWLOOK`: no surface is read). A `FROZEN_HOLDS` row, a `pinned` line in `standup.ts`, the
    word in `standEnv.ts`, the key-level rule in `journal.ts applyKnobs` (a recording without the key replays with it off). No compile-time const: nothing in a
    shader is switched (see How).
  - **Who**: every living man whose head is `minHead` (0.75 m) or more over his feet and has no roof over it (`g.weather.underRoof` at the head — the weather's
    roof footprints, the test the flakes and the wet use; NOT `snowField.cover`, which exists only with the lying-snow surface on): Sam, the team, the defenders,
    the shown civilians. Not the dead, not a man lying down, never a man the fog of war hides (`fogOfWar.hidden`).
  - **Rhythm**: per man off a hash of his `Character.id` (phase, pace ± `everyJit`, ± a tenth breath to breath): one breath every `every` 3.6 s at rest. EFFORT is
    his ground speed and nothing else (`Character.vel`: 0 under `runLo` 1.9 m/s, 1 at `runHi` 4 — so Sam sprinting is blown in `effortUp` 4 s, a defender at the
    chase's 2.7 m/s is a third of the way, a teammate never is; back down over `effortDown` 12 s): breaths every `everyHard` 1.3 s, size and opacity × `hardK`.
    No stamina exists and none was made. The rhythm runs for a man out of sight too (he steps out from under a roof in mid breath).
  - **How**: NO new particle kind, pass or pipeline. A breath is `puffs` 3 records of `count` 5 DUST puffs filed across `out` 0.5 s — the dust kind's soft round
    growing sprite, lit by `particleLight` + the radiance cache and carried by the wind field exactly as a dust puff is — thrown as a cone from the mouth (the head
    bone + `mouthAhead` along the skull's heading − `mouthDown`) along where the head faces (its pitch held inside `pitch`), with `carry` of his own velocity, his
    id as `owner` (its light rays skip his own body). The kind's drag (6 /s) stops it inside ~12 cm. ONE byte tells it from dust: `render/particles.ts
    EmitOpts.steam` (0‥1) rides the record's colour word's top byte (× 254; 255 on every other record, as `rgba8` always wrote), and the shaders read it in two
    statements — `particles_common.wgsl steamIs` / `steamOf`; `particles_draw.wgsl`: the dust branch's `opacity *= steamOf(p.color)` (× 1 for 255);
    `particles.wgsl update`: `if (kind == P_DUST && steamIs(p.color)) { p.vel.y += 2.0 * k0.x * dt; }` (it rises at the rate dust settles, ~6 cm/s). Growth
    (× 1.6 over its life), the (1 − u)² fade, the fade-in and the softness are the dust kind's own (`particleFx.ts DUST_LOOK`): moving those moves the breath too.
    Seeds are the module's own, per man × breath × puff (`recSeed`): the pool's serial is never advanced, and one man's breaths do not change with who else is out.
  - **Numbers**: `SNOWBREATH` (authored data; `__snow.breath` on the console, live with the next breath; `__snow.breathStats`, `__snow.breathSummary()`). Like
    `SNOWFX` / `SNOWWISPS` it is NOT in the knob registry (no `on` key; `knobs-check` asks only that of switch tables) — the switch rides in `SNOW_LOOK`.
  - **Check**: `bun run tools/qa/snowbreath-check.ts [--fast]` (`probes.ts snowbreath`, also under `snow` / `weather`), both stands, `SNOWBREATH_BREAK=1` must fail
    (3/10 then). On the pass's room clear with a squad of four, 600 frames against a recording stand-in for the pool: 40 records / 200 puffs off the 5 men at the gate
    (2 to 4 breaths each in ten seconds, first breaths on five different frames 2.9 s apart), every record a dust cone inside 0.2 m of its owner's head bone; a man
    held at 4.5 m/s breathes 7 times against 3 and his steam share goes 0.66 → 0.99 (size 0.085 → 0.128 m) with the others' records unchanged; none off a dead man, a man with his head at
    the ground, a fog-hidden man, or the 8 defenders under their roof with the fog bared; the same seed twice = the same records one for one; 0 records with the
    switch off and on compound.json; one game digest over 300 stepped frames with the emitter filing and not; two PLAYED runs (seeds 1, 2) one run digest each on
    and off, on each stand; the journal key rule; the byte's writer and two readers by text. 11/11 on both stands (10-14).
  - **Not checked there**: the harness has no GPU and no particle pool — in a played run the emitter walks its men and files nothing, so the played-run line proves
    the reads are harmless, not the emit. The packed byte is checked as text, never read back from a buffer.
  - **Seen: next to nothing.** Software adapter (SwiftShader, low quality, `levelFile=pass.json&roomclear&squad4&nofow`), 113 pipelines, 0 failed, the driver's
    log clean. One still of a man in lamplight, a second of breath run in the page at `every` 0.9, at the first numbers (size 0.07, `count` 3): a faint pale haze
    between his face and his hands at four times enlargement, nothing at the play camera's scale. `size` 0.085, `count` 5 and `opacity` 0.66 (× `hardK` 1.5 = 0.99,
    the byte's clamp at 1: raise either and a blown man's steam stops reading denser) came after that and have NOT been looked at. White steam over lit snow has
    nothing to show against, and in the dark nothing lights it: expect it to read only against dark ground or a dark coat with a lamp on it. **Never seen on a
    GPU, never seen moving**: the plume's shape, its rise and drift on the wind, TAA on it. The numbers are the maintainer's to move.
- **Lamp light glows through the lying snow** (`src/render/shaders/composite.wgsl snowGlow` / `snowGlowAmt` and the `if (SNOW_GLOW)` block after `dif`; the maintainer, 10-14, of
  the pass: "ideally it looks natural, deforms with character movement, and maybe even has some subsurface scattering to look great?"). An APPROXIMATION of the look, not
  scattering: no ray, no pass, no texture of its own.
  - **Switch**: `SNOW_LOOK.glow` (weatherKinds.ts) — ON in the page (`?snowglow=0` off), OFF in the module and on the frozen stand (`TPS_SNOWGLOW=1` raises it; shows only
    with `TPS_SNOW=1 TPS_SNOWLOOK=1` on a snow level), a `FROZEN_HOLDS` row, in the journal (a recording from before the key replays with it off). The shader half is the
    prelude's `const SNOW_GLOW` (frame.ts `snowLookConfig.glow`, raised by main.ts at boot only with the surface): false = dead code, the page's picture as it was. It is
    a BOOT word: knobs applied to a page already built do not take the glow out of its shaders (picture only, so no replay's digest cares).
  - **A snow pixel is marked** in the normal target's two spare bits (rgb10a2's alpha; every writer stored 1 and nobody read it): `gbuffer.wgsl fsBox` after `snowBox`
    stores 1 − ⅔ × the snow's amount, `snow.wgsl fsSnow` ⅓, both only behind `SNOW_GLOW`; `gdown.wgsl` copies the texel whole; `composite.wgsl snowGlowAmt` is the one reader
    (1 → 0, ⅔ → ½, ⅓ → 1). Nothing drawn clears to alpha 0 at depth 1 and is never shaded. A fourth writer of that target must store 1.
  - **The term**, in the composite (the one place every preset's primary hit gets its colour: ReSTIR or not, sharp direct or not): per light that reaches the cell, scored
    square-on as the wet coat scores it, with c = N·L: `GAIN · ((c + WRAP) ∕ WRAP)²` past the terminator down to c = −WRAP, `GAIN · (1 − c)⁴` on the lit side (nothing
    square under a lamp, 1.9 % of the plain light at 60°); its colour the lamp's, `WHITEN` of the way to grey, × `TINT` from the terminator on. It is × the direct pass's own
    shadowing per emitter class, taken over a five-point stencil (the pixel and four neighbours `REACH` metres off on the screen, same surface by depth) as Σ shadowed ∕
    Σ unshadowed with each point's own normal: a lamp hidden from that hand's width of snow adds nothing, a shadow's edge bleeds `REACH` into the dark, and snow turned
    away from the lamp over more than `REACH` gets none (`CONF`). And the bounce / sky light on snow in shade is × `SHADE` by its share of the pixel's light (luminance kept).
  - **Picture only, by where it stands**: composite.wgsl's output goes to the fog pass, GBAA, TAAU, bloom and post, never back into lighting. The meter and the probes are
    `probe.wgsl` (prelude + lighting_common.wgsl), the bounce is `hitRadiance → directIrradiance → evalLight`: none names the term, and `evalLight` is untouched. THE FOG OF WAR
    is a pass over the composite's output after it (passes.ts): an unseen pixel is the paint under the fog's own lights (`fowLit`), or the live frame dimmed with
    `?fogflat=0`, so the term shows nothing the plain light did not (there is no `FOG.full` light scale in this build).
  - **Numbers**: WGSL consts beside the term (NOT in `SNOW_SURF`, not live on the console): `SNOW_GLOW_WRAP` 0.4, `_GAIN` 0.15, `_TINT` 0.45 0.74 1.0, `_WHITEN` 0.6,
    `_REACH` 0.12 m (1 to 14 px), `_CONF` 0.03, `_SHADE` 0.93 1.0 1.11. Cost a snow pixel: 4 depth + 4 normal + 8 direct loads, then one `evalLight` and five dots a light.
  - **Check**: `bun run tools/qa/snowglow-check.ts` (`probes.ts snowglow`, family `weather`), 8 lines — stands / mark / dead / meter / fog / energy / digest / old; 8 of 8
    on BOTH stands; `SNOWGLOW_BREAK=1` (the switch never raised, the shader text read with its guards cut out and the term called from `evalLight`) fails 5 of 8 on both.
    `digest` = 300 stepped frames of the pass, one game digest on and off. No GPU there: not one pixel of the glow is checked, only where the term stands.
  - **Known, left**: where two lamps of one class light a spot the shadow ratio is the brighter one's (a lamp's wrap can show faintly inside its own cast shadow where
    another lamp of its class lights the snow); the stencil is on the screen, so its reach in metres shrinks on a steep view of a slope; the mark has two bits, so the term
    steps once (at half) across a dusting's edge; the reach masks (full-height walls only) are the only cull by place. Two skips that leave the picture as it is
    (the cost owner's a and b, 10-14): no light is scored where the stencil's unshadowed sums are zero for both classes, and a light is passed over when its own class's
    sum is zero. Still untimed on a GPU.
  - **The fog's leak watch on the pass** (`node tools/qa/fog-lit-stills.cjs --level pass.json --torches --frames 12 --w 640 --h 400`, SwiftShader, low, once with the term
    and once with `--q 'snowglow=0'`): 106 pipelines, none failed, no GPU error either way. The full picture: 399 fog px moved in patches with the enemy's torches forced
    on against 1236 with nothing changed (422 / 1248 without the term): under the noise. The lit rung: 3720 with the term, 3736 without, and the tool's own rule (any
    patch at all) calls that a leak and exits 1 BOTH ways: the term adds nothing to it. Flakes fall between the two frames it compares (inferred, not run on clear weather).
  - **Seen** on the software adapter only (SwiftShader, low quality, 800×450, a paused page stepped 6 frames of 0.2 s, `&nofow&snowwisps=0`; two views of the pass, the yard
    from 11 m and the gate from 9 m, each with the switch on and with `&snowglow=0`, differenced): the page boots with no console or GPU error either way (113 pipelines).
    Off the snow nothing moves (the lorry's sides, the brazier's bare earth, the gate, the hut: within 1 of 255, bloom's spill); snow square under the gate lamp is the
    same to the digit; nothing saturates that did not. On snow the shade side of a drift goes from a flat grey-brown to a paler blue (the gate's drift: 109 93 73 → 118
    112 105 against 143 129 114 lit beside it), its steep foot staying a dark blue line (past `WRAP`), and warm grazing-lit slopes far from a lamp lose some of their
    warmth (155 133 111 → 165 153 143). Two rounds: `GAIN` 0.22 filled the shade until the drifts read flat; 0.15 stands. HIS TO JUDGE: the shade's middle is lifted more
    than its rim (the hills are steepest at the foot), so a drift's relief is weaker with it on; and a lamp's warm pool is cooler at its grazing edge. **Never seen on
    a GPU, never seen moving**: a carried torch or a muzzle flash sweeping snow, the stencil under TAAU or sharp direct (every still was low quality), the step at a
    dusting's edge, its cost, and any other quality preset.
- **Fresh snow sparkles under a lamp** (`src/render/shaders/composite.wgsl snowSparkleFacet` / `snowSparkleLobe` / `snowSparkleFresh`, scored inside `snowGlow`'s light loop;
  the maintainer, 10-14, with a still of Red Dead Redemption 2's snow by day: 'rdr2 has some nice "sparkle" on the snow on the ground', and of the whole look "overall this
  should be subtle"). Ice facets as tiny mirrors: a sparse, world-anchored set of grains, each with a normal of its own, flashes while that normal is the half vector
  between a lamp and the eye. The OLD glints (`snow.wgsl snowShade`: 8 % of grains leant and set to roughness 0.28, `SNOW_SURF.sparkle*`) are left exactly as they were:
  they lean on the lighting passes' ordinary specular, which never showed as points on his GPU; they change nothing with this switch off, and with it on those grains are
  outside the fresh band below (no double flash).
  - **Switch**: `SNOW_LOOK.sparkle` (weatherKinds.ts) — ON in the page (`?snowsparkle=0` off), OFF in the module and on the frozen stand (`TPS_SNOWSPARKLE=1` raises it; shows
    only with `TPS_SNOW=1 TPS_SNOWLOOK=1` on a snow level), a `FROZEN_HOLDS` row, in the journal (a recording from before the key replays with it off). The shader half is
    the prelude's `const SNOW_SPARKLE` (frame.ts `snowLookConfig.sparkle`, raised by main.ts at boot only with the surface): false = dead code. A BOOT word, like the glow's.
  - **The mark is shared with the glow**: fsBox and fsSnow now write the normal target's alpha under 1 behind `SNOW_GLOW || SNOW_SPARKLE` (both off: every writer stores 1,
    as before), and the composite's one reader line stands in an `if (SNOW_GLOW || SNOW_SPARKLE)` block. `snowglow-check`'s mark line was moved to that text (three
    regexes); its other seven lines are untouched. The glow's own maths is behind `if (SNOW_GLOW)` at the call and `if (!SNOW_GLOW) { continue; }` in the loop, so
    `?snowglow=0` with the sparkle on walks the lights for the sparkle alone and adds none of the glow.
  - **The grains**: the snow's plan (world x, z) cut into cells `GRAIN` wide, doubled until a cell is no finer than `PX` pixels (octaves of distance, as snow.wgsl's glints:
    the same grain until the view has doubled its distance). `SHARE` of the cells hold a facet: a point somewhere in the cell, a normal leant off the surface's by up to
    atan(`SPREAD`) any way round, a brightness of its own (¼ to 1, most dim). The point is drawn a PIXEL wide whatever the cell (full within `CORE` px, gone one pixel
    further; a pixel asks the nine cells round it). THAT SIZE IS LOAD-BEARING: the first build drew a dot finer than the raster, the specular-only debug view (10, which
    bypasses TAAU) showed 114 points in the yard and the full picture kept 11 of them: TAAU's jitter missed the dot on most frames and its clip took the rest for
    fireflies. A pixel-wide point is taken by the nearest sample at 0.54 or more wherever the jitter falls.
  - **The flash**, per light that reaches the cell (the glow's loop: `lightReaches` + `evalLight` as they stand, so the fog of war's light classes hold; the moon is one of
    the lights), on the lit side only (N·L > 0, eased in over `EDGE`): the lamp's square-on light, `WHITEN` of the way to its grey, × the facet's cosine to the lamp × a lobe
    that is 1 within acos(`COS1`) of the half vector and 0 past acos(`COS0`), × `GAIN`; a broad emitter's is × `BROAD`. × the glow's stencil shadow ratio per emitter class
    (no ray: nothing in the direct pass's shade), × the snow mark (thin snow takes less; never a man's pixel or a cap's), × a band round fresh snow's roughness in the
    material target (`ROUGH`: fresh is 0.92; a boot print or a fallen man's dent is matt, → 1, a trodden path is 0.78: both outside, so neither sparkles), × a fade over
    `FAR`. Added to the pixel as light (never × the albedo) into `spec`, so debug view 10 shows the points alone.
  - **Picture only, by where it stands**: as the glow. composite.wgsl's output goes to the fog pass, GBAA, TAAU, bloom and post, never back into lighting; the meter's, the
    probes' and the bounce's programs do not name the term; `evalLight` and the direct pass are untouched; no game module reads the switch.
  - **Numbers**: WGSL consts beside the term: `SNOW_SPARKLE_GRAIN` 0.006 m, `_PX` 1.5, `_SHARE` 0.5, `_CORE` 0.25 px, `_SPREAD` 1.0 (45°), `_COS0` cos 4.5°, `_COS1` cos 2°,
    `_GAIN` 2.0, `_WHITEN` 0.5, `_BROAD` 0.5, `_EDGE` 0.15, `_FAR` 22‥40 m, `_ROUGH` 0.80 0.88 0.94 0.99. By those numbers (the check's mirror: 6 m of flat fresh snow, a lamp
    3 m up, the eye 9 m off, 1080 lines): 0.39 % of the cells flash, their points weigh 0.15 % of the snow's pixels, one lamp's brightest possible point is 7.6 × fresh snow
    square under it, and the term's mean is 0.58 % of the snow's own light; the eye moved 0.5 m keeps 73 % of the lit set, moved 3 m 1 %. Cost a snow pixel (expected, never
    timed): 9 integer hashes, about 9 more and 4 lengths for the cells that hold a facet, one material load; then for the pixels within a point's reach (roughly a quarter
    to two thirds of the snow, by octave) one normalize, two dots and two smoothsteps a light, in a loop the glow already pays for. With the glow off, a pixel no point
    reaches leaves before the stencil; the rest pay the glow's stencil and loop.
  - **Check**: `bun run tools/qa/snowsparkle-check.ts` (`probes.ts snowsparkle`, family `weather`), 9 lines — stands / mark / dead / meter / fog / energy / view / digest /
    old; 9 of 9 on BOTH stands; `SNOWSPARKLE_BREAK=1` (the switch never raised, the shader text read with its `if (SNOW_SPARKLE)` guards cut out and the term called from
    `evalLight`) fails 6 of 9 on both. `view` mirrors the shader's hash, grains and lobe in the tool (the formulas asserted as text first). `digest` = 300 stepped frames of
    the pass, one game digest on and off. `snowglow` (8 of 8, its break word 5 of 8), `snowlook`, `snow`, `knobs-check`, both typechecks and the build pass on both stands.
    `dice-check` on the shipped stand fails its `checkpoint` line (`player.yaw`) with and without this change (the untouched tree fails the same line).
  - **Seen** on the software adapter only (SwiftShader, low quality, 640×360, a paused page, `&nofow&snowwisps=0&snowbreath=0`; the pass's yard by the brazier from 11 m and
    the snow by the gate lamp from 9 m; every boot 113 pipelines, none failed, no console or GPU error, with the switch on, with `&snowsparkle=0`, and with `&snowglow=0`).
    The full picture, on against off at the same frame (the flakes fall in the same places, so the difference is the term): the yard 190 points, 186 of them 1 to 4 px,
    0.23 % of the picture's pixels moved, a point's peak × 1.32 the snow under it at the median, × 1.68 for the top tenth, × 2.25 the best (167 on 74 of 255), none
    saturated, the picture's mean up 0.05 of 255; the lamp view 92 points, the same ratios. Warm-white beside the brazier, blue-white under the moon; none on the
    brazier's bare earth or the lorry's sides (no snow there), and in the lamp view none on the wall or across the dark snow behind it (the band between the lamp's
    pool and the moonlit snow is empty). No man stood in either view: that a man's pixel takes none is by the shader's text, not seen. The camera moved 0.5 m (specular-only stills registered by the scene): 39 of
    87 points still lit, the second still's other 43 new. In a still at full size it reads as snow with a few fine points near the fire, not glitter. HIS TO JUDGE: whether
    that is enough (GAIN is the one number: 1.0 with the first build's dots read as nothing).
    STEADY under a still camera: the yard's 137 clearest points (peak over 12 of 255 in the on − off difference) each stand over the snow 3 px round them in three
    stills of one boot two frames apart, in a still of another boot, and in the page with `&snowglow=0` (the sparkle walking the loop alone: 113 pipelines, clean) —
    137 of 137 every time, 13 of 137 by chance with the switch off; a point's contrast is 24 to 27 of 255 at the median and moves 1.1 between stills.
    **Never seen on a GPU, never seen moving**: the twinkle as the player walks or a torch sweeps (a point fades over about a metre of travel by the numbers, not by
    eye), TAAU at his quality and upscale ratio (the points were sized against it on `low` alone), bloom on the best points, an octave's seam across a long view (every
    grain changes at once where the cell size doubles), the sun by day, sharp direct, and the cost.
- **The pass, played 10-15 (five asks from his run of `pass.json&roomclear&squad4&difficulty=hard`, then two more that evening)** — what each is, its switch, its check, and what nobody has seen.
  - **THE SNOW ENDS AT THE MAP'S EDGE; PAST IT IS THE DARK** (his 22:05Z 10-15, of the apron built that afternoon: "we should just have black outside the edges of
    the map, not extend. i think it was fine before"). The apron (four flat quads carrying the lying snow 60 m past the bounds, built on a misreading of his "snow
    missing on left strip of level") is TAKEN OUT: `SNOW_SURF.apron`, `SNOW_APRON_BIT` and `snow.wgsl`'s `past` branch are gone, the mesh is lattice quads only.
    Do not draw ground past a level's bounds again. What shows there on a weather level is the sky's under-horizon with the weather's veil over it
    (`composite.wgsl`, "over the void past the lot as over the ground beside it": navy at night, not pitch black; the weather's line, not this goal's). Check:
    `snowlook-check`'s `edge` line (every mesh quad on the field's lattice, 272 points along the bounds covered, the shader places nothing past them).
  - **NO BANK AT THE OUTSIDE FOOT OF A YARD WALL** (his 22:06Z 10-15, stood outside the back wall behind the tea room: "still seeing no room on this wall
    here"). The pass's two windward banks outside (the whole west wall, the back wall) stopped feet, so `wallcharge.ts setSpot` found no floor 0.5 m off either
    face and the order said 'no room at that wall.' along nearly all of both (the front and lee walls were fine). They are drifts now (0.18 / 0.17 m:
    `tools/levels/pass.ts`), wadeable. A headless ask of the order every half metre from outside (`wallAt` → `settle` → `valid`, the squad stood up, charges
    carried): the back and west walls take a charge everywhere but the short stubs; what is still refused from outside is 'no floor behind it.' where furniture
    stands against the far face (the front wall at x about 13 to 13.6: the cart and tyres). `pass-check`'s `feet` line holds the rule (`PASS_BREAK=1` stands a
    bank back at the back wall's foot: it fails). STILL REFUSED, KNOWN, LEFT: five faces INSIDE the yard where a bank lies in a corner (the bay's two long
    walls from the yard, the front wall from inside at both ends, the lee wall from inside by its corner): 23 snow boxes over 0.2 m remain, all inside the yard
    or across the road; making every bank walkable was tried on 10-15 and taken back (played seeds went from a win to a wipe). The furniture blast's own check
    (`holesnow`) picked its sites by the biggest banks: the two that went were its longest, its sites are five others now and it passes on both stands.
    PLAY: the strip at those two walls' feet is walkable now. Not played through on a GPU; a charge from outside those walls not blown in a run here.
  - **THINGS MARK THE SNOW, A MARK FORMS AND KICKS SNOW UP, BY FORCE** (`SNOW_LOOK.marks`; `?snowmarks=0`, frozen `TPS_SNOWMARKS=1`; picture only). His "pushed
    objects (like the chair) should impact the snow", "all physics objects", "it does look like a decal just getting splatted on ... animated a bit? or some GPU
    particles", "dependent on force". `game/snowMarks.ts`: a pushed prop's floor parts plough furrows (a chair's legs four grooves to the floor, a broad foot a
    trough only a heavy thing presses deep), a thrown thing dents where it lands and lies in a pit where it stops, a debris chunk dents where it comes down.
    `game/snowTracks.ts stampMark(T, force, fn, kick)`: EVERY mark (a boot's, a fallen man's, a crater, a thing's) is pressed into blank sheets and comes into the
    map over a moment (`formSnowTracks`: the floor sinks from the snow's level, the bank widens with it, what it threw lands `throwLag` later and swells) and
    queues a kick the flakes' recycler files as flake records at the mark (`snowFx.ts markKicks`). `force`: a walker's boot 0.45, a sprinter's 1.2, a fallen man
    1.3, a blast 2; a prop's by weight and speed; a landing's by how fast it came down. With the switch off `stampMark` writes the map at once: byte for byte the
    build before it. Numbers: `SNOWMARKS` (the things'), `SNOWTRACKS.form / throwLag / throwPop / puff*`. The map is handed to the GPU piece by piece now
    (`SnowTracks.rects`), not as one rect round every mark forming. A thrown thing's LANDING is "it was coming down and no longer is" (the pool's bounce count
    ticks every half step of a roll: it cannot be asked); rolling on, it lays a shallow groove a stroke (`roll` 0.15 m) at a time. NOTHING LIVE SHOWS IN THE FOG
    (fogofwar.ts 4d, as a hidden man's boots): a thing on floor the team does not see (`fog.spotSeen`) marks nothing while it is there, and is not caught up.
    Kicks: the hardest `puffRecs` (3) a frame are filed, each a particle record of the frame's twelve; one outside 0.7 of the view's disc is dropped (the flakes'
    wrap would raise its puff from bare floor); one still unfiled `puffKeep` (0.25 s) after it was queued is dropped (`formSnowTracks` ages them: with the
    flakes off it is never thrown up late at an old place). The list is the game's and the pool only reads it (10-23: which kicks were taken is the host's
    book, see "Whose the recycler's table is" above). Check `snowmarks` (14 lines with `kickbook`; `SNOWMARKS_BREAK=1` fails 9) on both stands; the game's digest is
    one with it on and off over 242 frames with a chair shoved across the yard. **Never seen on a GPU, never seen moving**: the forming's timing, the kick's size
    and whether three or four flakes off a walker's boot read at all, a furrow under a real push (the pass's chairs stand indoors: he pushed one out).
  - **THROWN THINGS BOG DOWN IN LYING SNOW — PLAY, NOT PICTURE** (`SNOWBOG.on`, `game/snowBog.ts`; `?snowbog=0`, frozen `TPS_SNOWBOG=1`; in the knob registry and
    a recording's names; a file with no SNOWBOG table replays off). His "grenades shouldn't roll around as much in the snow". Where an item touches down on lying
    snow (a snow level, under the open sky by `weather.underRoof`, at the ground, not on a thin lay of other paint) it keeps `1 − dead` of its bounce and
    `1 − grip` of its slide and stops dead under 0.35 + `stick` m/s; trodden snow (the road, the yard's paths) × `packed`. Off the GROUND (`top` 6 cm up: the ground's collision is flat at 0 under the drawn hills, so a kerb, a
    pallet or a desk is not it; it was 0.45 and a low kerb bogged as deep snow, a review claim mended after the first build) only
    snow that stands or lies there bogs: a bank, the cap the level lays on a roof or a truck's bed (a snow-painted box whose top is within `bankM` of the
    landing). The thin lays are read by the bake's own rule (`render/snowField.ts snowThinLay / snowLayBare`). THE POOL'S STEP HAS FOUR READERS AND ALL FOUR
    CARRY IT: `throwables.ts update` (the Game sets `items.bog`; the lines are what they were where it returns 0), `frag.ts rollOn` (the men's forecast of
    where a grenade rests), `throwplan.ts throwFlight` (the throw a man works out beforehand) and `squadsmoke.ts squadArcTo` (the solver's closed-form run-on ×
    `bogRun` = (1 − bog)^`run`: none in deep snow, a third of a floor's on the road) — `bogSlide / bogBounce / bogStick / bogRun`; a fifth copy must take them
    too (the player's aim arc, `items.solve`, stops at first impact: nothing to take). The office floor's parity of forecast and rest is `frag-mates`'; the
    SNOW's is pinned only by `snowbog`'s guess, flight and squad lines — so a change to `rollOn` or the pool's step runs `snowbog` as well as `frag` and
    `squadthrow-lob`. Measured (check `snowbog`, 8 lines, both stands, `SNOWBOG_BREAK=1` fails 7): a frag lobbed at 6 m/s stops where it lands in deep snow (0.00 m on, 1
    bounce) against 1.06 m and 5 bounces with it off; 0.39 m on trodden snow; the forecast and the worked-out flight end on the rest point on both snows (flown
    as over a floor they are 0.68 m off on the road); a teammate's ORDERED frag or can at 5 and 6 m rests within 0.12 m of the spot on both snows (aimed as for
    a floor it stops up to 2.41 m short: what the first cut of this did, caught in review); indoors, 0.9 m up over the yard and on the compound the throw is
    the same to the bit. Off the snow nothing moves: `soak --seeds 1,2,3 --minutes 12` and `tour --runs 3` give the build head's own results on both stands
    (frozen soak: the same 12 violations, held-scripted and checkon-stale, as the untouched head; shipped soak passes; frozen tour 3/3; shipped tour 0/3 on its
    door and canister stops, as the untouched head). **Not measured**: a FIGHT on the pass with it on against off — no played tally stands on a snow level, so
    what it does to who wins there is unknown; the 40 mm and the ring (they hand over to the pool after their own first bounce). Never played.
  - **A WISP IS A PUFF OF FINE SNOW, NOT A COMBED STREAK** (his "they just look like stretched out particle billboards"; then, with a clip of a ground blizzard,
    "at the wind speeds we have, we want the gentle, shimmering puffs of very small, a little sparkly particles"). Same records, same step, same switch
    (`SNOW_LOOK.wisps`): only the draw. `particles_draw.wgsl wispMotes`: the wisp's quad is a puff of pinpoint GRAINS, equally bright and FEWER toward its
    rim (the soft falloff thins them by count, × a clumping that travels through the puff; only the haze under them, `WISP_HAZE`, takes it as weight). Three
    sheets of cells (`WISP_MOTE_CELL` 9 cm and coarser, the second and third turned +27° and −38°), one mote a cell (`WISP_MOTE_M` 12 mm, never under a pixel
    and a half, dimmed no lower than `WISP_MOTE_DIM`); in each sheet the ROWS run at their own speeds (`WISP_MOTE_SHEAR`) so grains stream past one another
    and no lattice holds; each mote's light breathes to nothing and back on its own clock and now and then glints (soft: exponent 12, `WISP_GLINT` 3). A
    sheet whose cells are down to a few pixels fades into the haze. A wisp with motes answers the TAA at × 3 of its weight (a pixel-wide grain moving three
    pixels a frame must not be held by history); its cover stops at 1. `SNOWWISPS.motes` (0 = the combed streak again, with `stretch` 0.3) and `.sparkle`
    ride the record's colour word's top byte (`EmitOpts.top`), so they reach the wisps filed next; `stretch` is 0.12 (a puff only leans). The first cut (a
    dotted card: a rigid dot texture dimmed by a window, one sheet all but pinned to the quad) was read against his clip in review before anyone
    saw it; this is the second. The word for the glint must stay out of the particle shaders (`snowsparkle-check`'s 'dead' line greps them). **Never seen on
    a GPU, never seen moving**: the shimmer is all motion. AND A SOFTWARE STILL DOES NOT SHOW A WISP AT ALL: two close stills of the lit yard with `WISP_HAZE`
    at 0.16 and at 0.05 are the same picture to within a grey level (mean difference under 1 of 765) — the soft pale banks in such a still are the snow
    SURFACE under the lamps and its own glints, not blown snow (misread once as a fog of wisps, retuned on it, taken back). Judge the wisps only on a GPU.
- **The snow goes on falling past the level's rim** (10-17; switch `SNOW_LOOK.past`: ON in the page, `?snowpast=0`; OFF in the module and frozen,
  `TPS_SNOWPAST=1`, shows only with `TPS_SNOW=1`; picture only). The maintainer, of a view by the pass's edge: "snowfall missing from bottom left of image".
  A flake was born, kept and drawn only inside the world's rectangle (`rainOutdoors`, the step's `any(p.pos < WORLD_MIN)` end, `flakeHidden`'s rim line). A
  flake high in the air is drawn well off its own ground, toward the camera's foot, so with the rim on the camera's side (the pass's road, where every
  mission there starts; any corner) the flakes that would show over the near part of the picture are in the air PAST the rim, and none was ever there; and the
  splat hid a flake from every pixel whose surface was not inside the rim.
  - WHAT IT IS. `SNOWFX.past` (12 m, live, a row under Falling flakes, dimmed with the switch off; 0 = none) rides the frame's disc slot NEGATIVE
    (`frame.weatherE.w = −past`; the lattice rain's readers ask `> 0.0`, a snow level's share was 0 already, and `rainFx.ts` stands down on a snow level before
    it reads the slot). `particles_common.wgsl snowPast / flakeOpen / pastWorld`: the SKY's record (`skyRec`: its disc is the view's) asks `flakeOpen` at birth
    and every flake's step ends by it: the world's rim grown by the metres, with `rainOutdoors`' own roofs asked of the rim beside a point past it. A step
    wholly past the rim casts no ray (nothing to meet; one that comes in over the rim is traced, the trace starts at the world's face); a flake out there is lit
    where it is (the shadow rays clip to the world themselves); the wind over it is the open storm (`pastRimAir`); the splat's rim test stands down, which also
    hid every flake drawn over ground past the rim. A WISP, a grain, a kick, a blast's throw are born by `rainOutdoors` as before: nothing lies out there
    (`snowFx.ts` files the wisps by `inside`, the flakes by `area`).
  - THE FALL STAYS AS THICK. The ring's flakes are one fixed number (the count setting, and the ring is full at about 4,000 with the wisps in it) spread over all
    the open air in the disc, so every flake past the rim is one fewer in the level. Past the rim the births thin sooner toward the disc's edge
    (`PAST_RIM_IN / PAST_RIM_OUT` 0.5‥0.8 of the radius; `snowFx.ts PAST_TAPER` is the CPU's copy): those flakes show only over the near part of the picture.
    Measured on the CPU twin, of the ring's flakes on screen: the yard 37%, the road 32%, the corner 37 to 39%; with the level's own 0.7‥1 taper out there it
    was 26 to 28%, a quarter thinner than the yard. In the middle of the yard nothing moves.
  - CHECK `tools/qa/snowpast-check.ts` (probe `snowpast`, families snow / weather): stands, rim, frame, fills (the screen in twelve parts through the play camera:
    off, two or three parts by the rim are bare; on, none, the least 0.71 of an even share), thick, yard, off (switch off, or the metres at 0: the same records
    byte for byte), digest (one game digest on and off), text. `SNOWPAST_BREAK=1` fails on both stands.
  - NOT THIS: a view from outside the BACK wall with the camera over the buildings shows no flakes over the rooms' insides. That is the roofs' rule (rooms stay
    dry to the eye), not the rim.
  - **Never seen on a GPU.** The flakes' birth, step and splat are WGSL the harness cannot run: the page was booted on the software adapter (it compiles, no
    validation errors) and stills taken there. Nobody has seen flakes past the rim moving, or how the fall reads against the black outside the level.
- **No snow shows under the roofs, whichever slab** (10-19; switch `SNOW_LOOK.under`: ON in the page, `?snowunder=0`; OFF in the module and frozen,
  `TPS_SNOWUNDER=1`, shows only with `TPS_SNOW=1`; picture only). Two finds of a review of `flakeHidden` (the splat's test: is the surface behind a flake's
  pixel one that shows no snow in front of it):
  - THE SEAM. The old rule drew each roof's rectangle in by 0.2 m (`FLAKE_WALL_IN`, about a wall's thickness) BY ITSELF, so where two slabs of one building
    meet the strip between the two drawn-in rectangles was open: on the pass 1.43 m² along the wall between the back building and the east one, 0.69 m² of
    it bare floor along that wall's foot and 0.10 m² the floor of the doorway in it (the rest is the wall's own top and faces). Now `flakeUnder(p, d)` asks
    the roofs as ONE (`common.wgsl wxRoofed`): the point and its four corners at `d` all roofed, as the rain's `wxUnderRoof` does. For one rectangle that is
    the old drawing-in to the centimetre.
  - THE TOPS. Every top at the ceiling was open, so a partition deep inside a building took the snow like an outer wall: 1.96 m² of top half a metre or more
    inside the pass's roofs. Now a top is open only within `FLAKE_TOP_IN` (0.5 m, a build row under Falling flakes, dimmed with the switch off; `snowFx.ts`
    has the same number) of the roofs' edge. WHY HALF A METRE: the outer walls' tops must stay. Dry top on the pass against the number: 0.2 m 11.3 m² (9.1 of
    it outer walls'), 0.3 m 2.7 (0.6), 0.4 m 2.05 (none), 0.5 m 1.96 (none): from 0.4 m up it is the partitions alone, and 0.5 leaves a level with a
    thicker wall 10 cm. What stands ABOVE the ceiling's plane is in the open, as it was.
  - NOTHING ELSE MOVES. Over the pass's whole plan at the floor, 4 cm apart (700,000 points), the two rules differ at 894, all of them on the seam, none
    newly open. `snowFx.ts flakeUnder / flakeHiddenUnder` are the CPU's copy; nothing in the game reads them (the checks do).
  - LIMITS. The rule asks FIVE points, not the whole square: a gap in the roofs narrower than twice the inset that falls between the corners is not seen
    (a slot under a metre wide between two slabs of one building would dry a top at its mouth). None on a level today: the check asks the rule against
    every point of the square and finds no difference on the pass. `SNOW_UNDER` is a prelude const the page compiles in, like the glow and the sparkle: it
    does not flip live, and a recording replayed in a page opened the other way keeps that page's picture (the table follows the recording, the shaders do not).
  - CHECK `tools/qa/snowunder-check.ts` (probe `snowunder`, families snow / weather): stands (with the page's own word), prelude, seam, same, tops (the whole
    top of each of the 29 walls with open sky beside them stays open, and would with the number 5 cm less), text (the old rule's lines held whole after the new
    branch). `SNOWUNDER_BREAK=1` fails four lines on both stands. `snow-check`'s walls line asks its three of both rules.
  - **Never seen on a GPU.** The splat is WGSL the harness cannot run; the lines ask the CPU's copy and hold the shader to it by its text, and the page was
    booted on the software adapter. Nobody has looked at that wall's foot and doorway, or at a partition's top from above, in falling snow.
- **A splash is the same splash at every zoom** (the scene prelude's `const RAIN_SCALE`, `src/render/frame.ts rainScaleConfig`; the maintainer, 10-19, three
  zooms of one yard: "the low res rain isn't scale invariant"). WHAT IT WAS: the ring a landing drop throws up (`volumetrics.wgsl splashAt`: a 2 cm ring on
  outdoor ground, 60 ms long) is drawn in the volumetric pass, its line never thinner than that pass's texel AT THE GROUND (28° lens, divisor 2 or 4: about
  2 cm at the follow distance, 4 to 8 cm pulled back) — and at full brightness however wide that made it. Pulled back every ring was a soft square blob a
  texel or two across as bright as a ring, the lit ground carried up to 17 times the splash light it does close in, and the blobs grew in the world as
  the camera rose. THE RULE: drawn wider than its own 6 mm line (`SPLASH_W`) a ring keeps its LIGHT, not its brightness — dimmer by the footprint it gained,
  down to the floor where it fills its own 9 cm cell (`SPLASH_FILL` 0.056: only the pixel's own cell is asked). What the lattice's streaks always did
  (`RAIN_W / halfW`); they are untouched, and so is the particle rain (drawn at the page's own resolution, fixed in the world already). HELD WHICH WAY: in
  the WORLD — a splash is a few centimetres of light at any zoom; pulled back the rings read as a faint shimmer on lit ground, not as blobs. Close in (the
  texel under 6 mm) nothing changes. SWITCH: on by default, `?norainscale` at boot = the rings as they were; picture only (no game table, nothing in a
  recording, the same on both stands). Check: `rainscale` (family `weather`; it lifts the scalar lines of `splashAt` out of the shader's text and runs them
  over a floor of rings as the texel grows: close in identical, 0.9 to 40 cm within a fifth of the close-in light where it grew past tenfold, the floor
  constant, the boot flag; `RAINSCALE_BREAK=1`). No shader runs in that check. LEFT AS IT IS: a far streak is still at least two texels wide (its light
  is right, its width is the pass's). SEEN, ONE STILL EACH WAY (`tools/qa/weather-look.cjs`, software adapter, low quality, the snatch level's room
  clear in a downpour, the camera pulled back to 42 m, the eighth frame): with `?norainscale` the yard's lit ground is strewn with square blobs a pass
  texel wide; without it the same ground is smooth and wet, no blobs. The page booted with 118 pipelines, none failed, both ways. A second pair at
  12 m over the east yard: both ways the rings are still soft squares 15 to 25 pixels wide (the pass's texel at low quality on a 960-wide page), fewer and
  dimmer with the rule on (6% of the picture's pixels 8 levels or more brighter without it, one pixel the other way) — the rule dims a ring by the
  footprint it gained, it does not make the pass finer. NOT SEEN: moving, on a GPU, at a higher quality's two-pixel texel, or how much of the rain's read
  at a distance the blobs had been carrying — if pulled back it now reads too dry, the streaks are the place to add, not the rings.
- **Rain shows in front of a wall's outer face** (the maintainer, 10-19, a depot's yard in the rain: "rain isn't showing up on top of walls properly").
  CAUSE: the rain's readability rule hides it from every pixel whose SURFACE is indoors, and indoors was the roofs' bare rectangles
  (`volumetrics.wgsl outdoorsXZ` for the lattice rain, `particles_common.wgsl rainOutdoors` for the particle rain's splat) — a level's own roof is its
  ceiling slab grown by 6 cm (`weather.ts ROOF_PAD`), over the walls — so every outer wall's face, the door in it and the wall's top showed no rain and
  the streaks over the yard stopped dead at the wall behind them. The snow had the same flaw (10-15, `flakeHidden`); it was mended for snow only. THE
  RULE: is the point UNDER the roofs — `common.wgsl wxUnderRoof(p)`: inside them, and so are the four corners of a square `WX_WALL_IN` 0.2 m about it
  (so the seam where two slabs of one building meet is under the roof, which the snow's rectangle-by-rectangle rule gets wrong: a claim for its
  owner). `volumetrics.wgsl` (c) and `particles_draw.wgsl rainFragment` (`rainOverWall`: that, inside the world's rim) ask it beside the old test.
  Asked of the level's OWN roofs only (`WX_KINDS` and the packed words not 0): the office family's two rectangles lie on its walls' centre lines, its
  outer faces were never hidden, and the rule stands down there. Rooms stay dry to the eye; a partition's top inside stays dry (unlike the snow's
  rule); an outer wall's top shows rain over its outer 0.2 m. Splash rings are drawn on open ground only, by the OLD test (`if (depth < 1.0 &&
  outdoorsXZ(Pend.xz))`): none on a doorway's floor, none on a wall. **Switch**: picture only, no game table — the scene prelude's `const RAIN_WALLS`
  (`render/frame.ts rainWallsConfig`, on), `?norainwalls` at boot = as it was; nothing for a recording to carry, both stands alike. **Check**: `bun run
  tools/qa/probes.ts rainwalls` (family `weather`), 4 lines; the rule written again in the check and the shader's function held to it by its text;
  asked over every level's roofs as the renderer has them. The depot: 19 outer walls, every outer face shown, every inner face and the floor 10 cm
  inside dry. All 50 levels: 663 outer walls (the bare rectangles hid every face), 657 faces shown, 663 inner faces dry; ground newly in front of
  the rain with nothing standing on it 13.7 m² in all, most on quiet-relay 3.1 m². `RAINWALLS_BREAK=1` fails 2 on both stands. KNOWN LEFT: a third or
  fourth roof is packed to 0.2 m rounded outward, so some of its walls' faces stay hidden (the barracks: 3 of 33) and a strip of yard up to 0.2 m at
  such a wall's foot is as it was; the rim of a roof that stands on no wall (quiet-relay's shelter) shows streaks 0.2 m in; a ray that ends on a far
  wall's top over the building shows only the rain it met before the roofs' columns; `snow-check walls` still reads the rain's old line in
  `rainFragment` (kept, one line below the new one). SEEN, TWO VIEWS EACH WAY (`tools/qa/weather-look.cjs`, software adapter, low quality, 960 wide, the depot's
  room clear in a downpour, the north hut's south wall from the lit yard at 14 m, the eighth frame): with `?norainwalls` the rain's haze and streaks
  end in a hard line at the wall's foot and the wall is clean; without it streaks and haze carry on over the wall's face and the door in it and over
  the wall's top. New against old, by pixels: the yard 0 differ; the wall's face 1,948 and 4,152 brighter; the wall's top about a third differ; the
  partitions' tops inside 0 of 3,981; the room's floor 0 of 35,869. Both pages built 118 pipelines, none failed, no console error. NOT SEEN: a splash
  ring at this size (so "rings on open ground only" rests on the check's reading of the text), an open doorway, moving, close in, the particle
  rain's drops at a wall, a third or fourth roof's wall, any other level; never on a GPU.
- **A man who has been sprinting breathes hard** (the maintainer, 10-19: "characters should breathe more forcefully when sprinting (e.g. on snow
  levels)"). The game has TWO breaths and no third: the steam on a snow level (`snowBreath.ts`) and the chest (`character.ts lifeLayer`); there is NO
  breath sound and none was added. Both already rose a little with effort; `character.ts HARDBREATH` makes it read. **Steam** (snow levels, every man in
  the open): effort rises in `up` 2.5 s of running (was 4) and falls over `down` 14 s (12); blown, a breath comes every `every` 0.95 s (1.3), is `puffs`
  4 records long (3) of `count` 9 puffs (5), thrown at `jet` 3.2 × the calm speed (1.3 ×), `size` 2.0 × as big (1.5 ×), and carries `carry` 0.85 of the
  runner's own speed (0.6) so it trails behind him. **Chest** (anywhere): `chestAmp` 4.2 (2.6) at `chestRate` 0.9 Hz (0.62), up in `chestUp` 2.5 s (4),
  down over `chestDown` 12 s (8). At rest or at a walk, nothing changes. This is the player and whoever runs (a teammate where team-feel.md's `TEAMPACE` has him run, a defender
  running to a post steams the same); a teammate at his fastest walk (2.2 m/s) is a seventh of the way to blown in steam, his chest at rest. **Switch**: `HARDBREATH.on` — ON in the page (`?hardbreath=0`), OFF in the module and on the frozen stand
  (`TPS_HARDBREATH=1`; shipped pins it off with `TPS_HARDBREATH=0`); registry + `JOURNAL_KNOBS`, a recording from before the key replays with it off.
  The chest moves bones, so it is a sim change behind the switch; the steam is picture only. **Check**: `bun run tools/qa/probes.ts hardbreath`
  (families `snow`, `weather`), 7 lines on both stands; `HARDBREATH_BREAK=1` fails 4 on both. MEASURED, one stand (the pass, seed 7), rule on / off: a
  10 s sprint at 4.7 m/s — breaths 9 / 6, records a breath 4 / 3, puffs a record 9 / 5, thrown 2.24 / 0.91 m/s, size 0.170 / 0.128 m, carried 4.00 /
  2.82 m/s; blown after 2.9 / 3.9 s; 3 to 9 s after a 6 s sprint, records 11 / 6; the chest's own share of neck over hips 15.5 / 9.4 mm; one run
  digest with nobody running. WHAT IT DOES NOT DO: the chest's breath is gated out under a stance or a hold as before (a man with his gun up shows
  little of it), and 15 mm is small from the game's camera — the steam is what reads. With the rule on, four rows of the scene panel's SNOWBREATH table (`everyHard`, `hardK`, `effortUp`, `effortDown`) and the workbench's two winded
  sliders (`LIFE.breathRateRun` / `breathAmpRun`) are read by nothing (the panel dims its four while the rule is on and lists the rule's eight steam numbers in their place: `probes.ts scenetweak`, verdict `breath`); HARDBREATH's switch has no panel row, and the workbench does not raise the switch (it
  shows the old chest). NOT SEEN: anything of it in a picture, here or on a GPU; no tally over seeds (a tour or soak was not run).
- **A man's breath is real steam** (the maintainer, 10-20: "the smoke from the gun muzzle is fine so maybe breath should just work like that"). On a snow
  level each breath of a man in the open is ONE source in the smoke solver, on the fine lattice the gun's gas is on (`snowBreath.ts BREATHSTEAM`, a
  `SmokeEmitter` of kind `breath`). It rides his mouth for as long as he breathes out (`track`), leaves at his head's facing and pitch plus a share of
  his own walk (`trackVel`: track()'s `dir` is the gas's velocity in m/s, not a heading), and from there it is the solver's: it shadows itself and
  takes a lamp's shafts as any smoke does (the volumetric pass draws it; no shader changed), and a man walking through it parts it (`Game.smokeWake`
  at hips and chest as for any smoke, plus a shove at the head of a moving man near the view — `wake`, `SmokePush.lattice: 'fine'`, so it never
  moves a smoke screen). Who breathes, the rhythm, the mouth and the sprint rule are the puffs' own code path, shared line for line: a blown man
  (`character.ts HARDBREATH`) breathes sooner, through a wider mouth (× √size), denser and warmer (× size), thrown harder (× jet). Only what a breath
  is MADE OF changed. **Falls back to the puffs**, breath by breath: no solver drawing (smoke off or frozen, a preset without the smoke frame flag:
  `SmokeSystem.drawing()`), `density` 0, or a man past `reach` (12 m) from where the view looks (the frame's far corners are 11 m from it at the game's own zoom). A man who steps out from under a roof mid-breath
  steams for what is left of it. **Look only**: the source carries `look` — `sense.ts CpuSmoke` takes nothing of it, `budget()` does not count it,
  and a step with more sources than the solver holds cuts a look source first (before prio 0), so a shot or a grenade never loses its place to a
  breath. **Switch**: `SNOW_LOOK.steam` — ON in the page (`?breathsteam=0` = the puffs as they were), OFF in the module and on the frozen stand
  (`TPS_BREATHSTEAM=1`); a `FROZEN_HOLDS` row; the journal carries `SNOW_LOOK`, and a recording from before the key replays with it off. The numbers
  are `BREATHSTEAM` (authored data like `SNOWBREATH`, not player switches: `__snow.steam` on the console, twelve rows on the debugger's Breath layer).
  **Check**: `bun run tools/qa/probes.ts breathsteam` (families `snow`, `weather`), 11 lines on both stands; `BREATHSTEAM_BREAK=1` (the switch never
  raised) fails 8 on both. Its `digest` line: 300 frames of the pass's room clear stepped by the game with the sources handed over and with none,
  one run digest, and the same with the senses on the CPU. **MEASURED in the page on the software adapter**
  (`node tools/qa/breathsteam-page.cjs`: the pass's room clear, verylow, 640 wide, the player in the gateway under `lamp_gate`, five men steaming,
  breaths made five times as frequent as in play for the stills; `REST=90` then runs the game's own rhythm): 119 of 119 pipelines, none failed, no
  console error; the solver took every breath (27, 150, 372, 579 fine-lattice bricks at steps 8 to 32, none refused, none held back) and no puff was
  filed. SIGHT LINES, asked of the game's own sensors through his breath (the probe the guards' lines go through; its stride is 0.11 m, about a
  breath's width, so many lines never sample one), the least light kept over four runs: across it a hand from his lips 0.848, a forearm out 1.0, down
  through it 1.0, his eye to a chest three metres ahead 0.984, down its own length from his lips 0.715 (two of the frequent breaths in one line).
  Nothing in the game reads smoke until a line keeps under 0.8, so a calm breath is read by nothing; a line down the length of two breaths, or through
  a blown man's (twice the gas, not measured), dips under it for an instant (0.715 is a tenth off that one sight point). `density` 9 is set AT that
  edge: more shows better and costs sight, like any smoke — the maintainer's call. AT THE GAME'S RHYTHM, five men: 744, 464, 171 fine-lattice
  bricks one, two and three seconds after the frequent breaths stopped — about 170 of the pool's 4,096 held by five men at rest. The fine lattice's
  share of the pool is the gun gas's too; past 0.7 of it the solver refuses the thinnest gas first, and that is the breath. SEEN (the same tool's
  stills): in the volumetric pass alone (debug view 5) each breath is a lit puff the size of his face at his lips with the one before it a forearm
  out; in the full picture, against the lit lorry and snow behind him, it is a faint pale haze close in (in blocks at verylow's volumetric
  resolution) and not to be picked out from 8 m, where the PUFFS from the same page (the switch put off live) read plainly as white clouds. Lit gas
  this thin is far dimmer than a lit surface or a sprite drawn as one: it wants a dark background and a lamp, which that staging is not.
  TRIED AND PUT BACK: a wide thin cloud the puffs' own size and no thicker along a sight line (`radius` 0.09, `density` 1.4, `temp` 2.5; lines kept
  0.866 or more): one lit cloud a little larger than his head in the volumetric pass, no plainer in the full picture, and it held the pool 613 then
  963 bricks for the same five men at the game's rhythm, still rising — three to five times the wisp, on every frame of a snow level. The numbers
  are rows on the Breath layer for whoever wants it on a GPU. **WHAT IT COSTS**: with the puffs the solver slept on a snow level until a shot or a grenade; with the steam it holds bricks whenever a man
  in view breathes, so the solver's step and the smoke march run on nearly every frame of a snow level. NEVER TIMED (no GPU here); `?breathsteam=0`
  is the way back, `reach` the lever (and `radius`: bricks go with the cloud's size). NOT SEEN: on a GPU, against a dark background, moving, a man walking through another's breath (the head's shove is checked by what it
  asks of the solver, not by a picture), a blown man's breath, a quality above verylow, a level other than the pass. No tally over seeds: the game
  cannot tell by digest, so none was run.
  **WHOSE** (the step after the fire's host book, same pattern): the run digest could not tell, but the STATE could — `snowBreath.states` kept, per
  man, whether this breath was steam and which source rode his mouth, and its counts and its `why` followed the solver's word, the view's focus and
  the particle pool. A snapshot or a state hash is the game's alone, and those three are the host's. Now the game's table keeps what the game decides
  (the rhythm, who shows, breaths begun: `BreathCount`) and the rest is `engine.hostBooks.breath` (`snowBreath.ts BreathShown`, a member of the one bag of host books declared in
  `host/api.ts`): how the breath is shown this frame, per man the breath that was asked and its live source, the sources and puff records filed.
  THE BOOK IS DROPPED when a save is put back (with the whole bag: `host/putback.ts`'s one line), by `seedBreath`, with the breath switched off or off a snow level, and by itself
  where the game's frame count is not the one after the book's last (a snapshot put back by a road that does not tell the host: the harness's). A
  RESTART drops the whole bag too (`game.ts restartEncounter`, since the smoke break's step). A restart or a file's load also keeps the frame count
  and builds the men anew under their old ids, so, whoever drops what, a row is bound to the Character it was written for
  (`who`): a fresh man starts a fresh row (found in review: without it a restart a moment after a man's first breath took his next breath 1 for
  filed, and it went out with no steam). Behind a drop a breath in the air is asked for afresh on its next record, so a man in mid breath can file a
  second source at his mouth for what is left of it (look only). NOT COVERED: a solver emptied under the same men with the book kept (a script's or
  the panel's clear) costs the rest of the one breath in the air; a breath's source lives half a second, so it is not asked after each step as the
  cigarette's ten-minute thread is. `breathStats(g)` still answers every reader with one merged row, a copy; the host's counts (`records`, `births`,
  `steam`, `by`) run from the book's opening, so behind a drop they start again while `breaths` goes on (the panel's line can read more breaths than
  records). The check's `whose` line, on both stands: the pass stood plainly twice; stepped 900 frames by the game's own step with a drawing solver
  and the view on the player, and with a solver that draws nothing and the view 400 m off, the two are ONE STATE HASH (`rollback.ts stateHash`);
  the same with a particle pool that takes the breath's puffs and one that takes none of them; the second dealt off another seed, the hash parts.
  Run against the module as it was, the line is red and names the old rows (`stats.why`, `stats.steam`, `stats.steaming`, a man's `steam`; with
  the pool `stats.records`, `births`, `by`). The compares pass `own` (two games stood in one process, without what the modules share), and a red
  run asks `stateDiff` for the rows (light since the walk was rebuilt; the line first held 6.4 GB on the shipped stand through the old walk). Its
  `pool` line: a game with a particle pool against one with NONE, ten seconds: no row of the breath's parts them and none of the wind's (below);
  what else parts them is printed and not judged (the falling snow's `why` words, with its owner). By the game's own
  roads: a snapshot of the filing frame put back at once with the host's real hook run files the breath's source again (red with the hook's line
  taken out), a snapshot from before the breath put back with no hook plays the breath again WITH its source (red with the frame-count test taken
  out), and a real restart a third of a second after a man's first source leaves 3 sources for the 3 breaths of the next ten seconds (2 with the
  row's binding taken out), and the book keeps no row for a man who is gone: a row whose man was not asked about this frame is struck, so the men of
  the game before a restart are let go on its first frame (1 row held there before this was added). `breathStats` read on a game nobody has
  breathed in makes no state row (it did; by reading, no check). The put-back road runs through `tools/qa/putback-host.ts`. The line also found the check's own old red on the shipped stand (the `digest` line, red there since the open fire
  landed): its solver stand-in counted the fire's plume, one source a second, as breaths; it counts `kind: 'breath'` alone now. No rule read any of
  this and no digest moved: nothing a player sees changes but a breath refiled behind a put back. IN THE PAGE on the software adapter after the move
  (`breathsteam-page.cjs`, 16 steps): 119 of 119 pipelines, no console error, five breaths all steam, no puff record, the panel's row read as before.
  NOT SEEN: on a GPU; a save put back or a restart
  in the page with men breathing (the roads are the game's own, run headless over a recording stand-in for the solver); a file's load (by reading:
  it builds the men anew like a restart).
