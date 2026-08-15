# The level format (LevelData v1)

The office is **data**: `levels/office.json`. This note is for whoever edits it — by hand, or through the in-browser
editor (lane G1b) — and for the lanes that extend it (G2 floors + stairs, G4 cameras / keypads / lasers).

```
levels/office.json ──import──▶ src/scene/level.ts buildLevel() ──▶ levelLoad.ts loadLevel() ──▶ Level ──▶ Game / Engine
        ▲                                                                                        │
        └──── tools/level-export.ts ◀── levelLoad.ts levelToData() ◀── officeGen.ts buildOfficeProcedural()  (LEGACY generator)
```

* **Schema + validator + serializer**: `src/scene/levelData.ts` (`LevelData`, `validateLevelData`, `serializeLevelData`,
  `parseLevelData`, `canonicalLevelData`, `levelDataDigest`, `structuralDiff`, `indexLevelData`, `freshId`, flag name ⇄ bit helpers).
* **Conversions**: `src/scene/levelLoad.ts` (`loadLevel(data) → Level`, `levelToData(level, opts) → LevelData`, `fitPropFootprint`).
* **The game's entry point**: `src/scene/level.ts` `buildLevel()` = `loadLevel(OFFICE_DATA)`; `OFFICE_DATA` is the bundled JSON
  (a plain `import … from '../../levels/office.json'` — Bun inlines it into the JS chunk, so the playable Artifact, the dev server
  and the headless harness all get it with no extra asset and nothing to fetch).
* **Regenerate**: `bun run tools/level-export.ts` (`--check` = write nothing, exit 1 if the file is stale vs the generator).
* **Prove**: `bun run tools/qa/probes.ts level` — `level-identity` (generator vs loaded JSON: 0 structural diffs, one digest, file
  not stale, file canonical), `level-validate` (validator clean + 12 planted faults caught + surface map ≡ `game/floor.ts`),
  `level-roundtrip` (data → level → data exact, serializer a fixed point, key-order independent, no shared state between loads).

## Editing by hand

* One entity per line; top-level keys in a fixed order; every record's keys in schema order. `git grep box_0412 levels/` finds a
  box, a diff is a list of changed entities. Keep it canonical: after hand edits, `bun -e` a `serializeLevelData(parseLevelData(text))`
  pass (the editor lane will add a `tools/level-fmt.ts`; until then `level-identity` FAILs its "canonical form" line if you do not,
  nothing else minds).
* Numbers are full precision on purpose (`12.259999999999998` is a wall centre computed as `(x0 + x1) / 2`); write whatever you
  like for new things, the loader does not care.
* **While the legacy generator still exists, `tools/level-export.ts` OVERWRITES the file from it** and `level-identity` fails on any
  hand edit ("not stale" line). Hand edits become the norm once G1b retires `officeGen.ts`; until then change the generator and re-export,
  or accept that probe line failing and say so.
* Validate: `bun run tools/qa/probes.ts level-validate`, or in code `validateLevelData(d)` → `string[]` (empty = fine). `loadLevel`
  validates at every boot and throws with the list, so a broken file fails loudly at start, not mysteriously mid-game. Unknown keys are
  errors (`boxes[7] 'box_0007': unknown key 'emmisive'`): a typo would otherwise be ignored on load and dropped on the next save. The one
  place extra keys ARE allowed is inside the drill plans (see below). The key registry is `KEYS` in `levelData.ts`.

## The schema, briefly (the types in `levelData.ts` are the reference; every field has a doc comment there)

| key | what | notes |
|---|---|---|
| `version` | `1` | bumped on breaking changes; the loader refuses others |
| `name`, `meta` | name; `{ grid?, bounds?{min,max}, generator?, notes? }` | `bounds` = the traceable world (`scene/world.ts`) the level must fit |
| `floors[]` | `{ id, name?, y, ceiling }` | v1: one (`f0`, y 0, ceiling 3). G2 adds the mezzanine; boxes / doors / props / volumes name their floor (absent = `floors[0]`) |
| `materials{}` | name → `{ albedo, rough?, metal?, notes? }` | the paint palette (linear rgb) + each paint's FINISH for the one BRDF (renderer v3 phase 4, docs/internal/p4-materials.md): `rough` = GGX roughness 0‥1 (absent = matte: no reflection ray is spent), `metal` = bare conductor (F0 = albedo). Order is the palette's authored order |
| `surfaces?` | `{ building, grassEdge, inside, outside, verge, zones[] }` | footstep materials (carpet / lino / stone / tile / asphalt / grass). **`game/floor.ts` still owns the behaviour**; this mirrors it and `level-validate` asserts they agree — wiring `floor.ts` to read it is a small follow-up |
| `boxes[]` | `{ id, floor?, group?, name?, c, h, yaw?, rot?, material \| albedo, emissive?, rough?, metal?, flags?, cutHeight? }` | static geometry, **in order** (`boxes[i]` is `world.statics[i]`). `flags` by name: `NoPrimary NoShadow Cutaway Gloss` (runtime bits `Emissive AreaLit Rot Dynamic` are never authored — the validator rejects them). `group` is editor grouping only (`lobby`, `walls.interior`, `doorframe.server` …). `name` is a tag the game may look up (`breaker_panel`) |
| `props[]` | `{ id, kind, name?, floor?, x, z, yaw?, mass, parts[{off,h,yaw?,material\|albedo}], half?, height? }` | loose furniture (chairs, cartons, bins, plants). `half`/`height` are FITTED from the parts unless given (10 of 61 pin them: plants author their footprint, a few fits differ in the last bit) |
| `lights[]` | `{ id, kind point\|spot\|dir, pos, dir, color, intensity, range, innerDeg, outerDeg, group, enabled, volumetric, radius?, mains?, broad?, fixture? }` | analytic lights; `id` is the name targets / panels key on; `fixture` = the glow-card box id |
| `switchables[]` | `{ id, boxes[], group, on, baseEmissive, flicker?, mains? }` | emissive fixtures the OCP / panel / blackout switch (panels, screens, signs, rack LEDs, beacon domes). A box belongs to at most one |
| `doors[]` | `{ id, floor?, hinge[x,z], closedDir, width, angle?, exterior?, closer?, minAngle?, maxAngle?, locked?, lock?, keySide? }` | the LEAF; the frame is ordinary boxes in group `doorframe.<id>` |
| `routes[]` | `{ id, name?, points[], wait[], weapon?, keys? }` | one guard per route (game.ts spawns them in order); `wait.length === points.length` |
| `chokepoints[]` | `{ id, name?, floor?, pos, yaw }` | lockdown posts |
| `civilians[]` | `{ id, name, kind cleaner\|worker, floor?, tint, tint2, points[], wait[], tasks[], face[], notes? }` | the civilians on the floor (`game/civilians.ts`) — see *Civilians* below; optional block, absent = nobody but the shift |
| `volumes[]` | `{ id, kind hide\|utility\|trigger, floor?, c, h, yaw?, notes? }` | none yet |
| `devices[]` | camera / keypad / laser union | the level-design devices (`game/devices.ts`) — see *Devices* below |
| `vents[]?` | `{ id, floor?, pos, dir, speed, spread, reach, size?, period?, duty?, phase?, mains?, notes? }` | HVAC supply vents (`game/wind.ts`) — see *Vents* below; optional block, absent = still air indoors |
| `connectors[]` | stair / ladder `{ from{floor,c,h}, to{…}, cost?, mat? }` | **TODO(G2)** — typed stub, empty |
| `mission` | `{ playerSpawn, objectives[] }` | objectives `reach{area,door}` / `drive{rackIndex,front,halfW}` / `exfil{door,x,z}` — v1 wants exactly one of each (the fixed stage machine in `game/mission.ts`) |
| `breaker` | `{ pos, panel, led }` | box ids |
| `beacons[]` | `{ id, pos, box }` | `box` = the dome, which MUST be a switchable's box (game.ts slaves the beam to it) |
| `sky`, `daylight?` | `{ zenith, horizon }`; `{ sun(light), sky, groupsOn, groupsOff, lightsOff, haze, exposure }` | the breach showcase's daytime variant |
| `plans` | `{ roomClear[], breach? }` | `RoomClearPlan` / `BreachPlan` verbatim (see `scene/level.ts`) + `id`; `door` by id |

Ids: `box_NNNN` for anonymous boxes, semantic ones where something points at the box (`fix_desk_lamp`, `sw_vending`,
`sw_rack5_leds_3`, `breaker_panel`, `breaker_led`, `sw_beacon0`); props `chair12`; everything else its old name. New entities:
`freshId('box', data.boxes)` → `box_0889`.

## Devices (lane G4 — `game/devices.ts`)

Three kinds, all in `devices[]`, all drawn by the game from the record (bodies, LEDs, plates, the beam — none of it is in `boxes`), all
run in live play only (`g.aiEnabled`, not the tour's `quietUtility`, `tune.devices`): under the tour they pan and glow and report nothing.
Cameras and beam emitters are light TARGETS (`LightTarget` kind `'device'`): the pistol's OCP knocks one out for the OCP's spell, a
round kills it for the encounter (sparks, control radios that it "just went dark" and sends the nearest calm man to it), `mains` (absent =
true) puts it on the breaker — dark in a blackout, back with the restrike — and `group` (absent `security`) is its Lights-panel group.

| kind | fields | behaviour |
|---|---|---|
| `camera` | `pos` (the lens), `yaw` (Character convention: forward = [sin, 0, cos]), `pitch?` (radians, negative = down, default −0.35), `sweep?: [yawA, yawB]` + `sweepPeriod?` (pans there and back; absent = fixed), `fovDeg?` (full cone, default 70), `range?` (m, default 14), `group?`, `mains?` | Sees Sam through the guards' OWN eye test (`guards.ts eyeContact`: cone, reach, the line to chest and head through statics and leaves, the probe's smoke segment lens → chest) with an elevation window (straight under a wall camera is under its picture), and fills an integrator at `lensGain` = sightGain's light^1.5 × distance × crouch × smoke off Sam's light meter — dark to you is dark to it. At `tune.cameraSuspicionSecs` (0.8) lit-seconds control radios "camera N has movement in the …" and the nearest calm man is sent there (a `GuardTask 'device'`, the rack errand's mechanism); at `tune.cameraAlarmSecs` (2.0), still in view, "that's him" — everybody gets the fix and the floor goes up a step (`raiseEscalation` cause `'device'`). Out of view the integrator drains (0.5/s) and it re-arms after 20 s quiet. LED: dim idle, bright while it holds anything, blinking once it has reported; a faint red haze cone down its axis (`tune.deviceCones`, a light slot each). |
| `keypad` | `pos` (the plate), `yaw` (out of the wall), `door` (DoorData id), `code` (four digits) | The door must be `locked` with `lock` = the keypad's id — the lock IS the link (`doors.ts Door.lockId`; the validator holds the two together, one pad per door). From the key side Sam gets `enter the code — 7-3-9-1` if `Player.codes` has the lock id (a sustained verb: four keys over `CODE_SECS` 1.2, then `Doors.use` with the code as his key for that turn — the small clack, the creak — and it springs locked behind him) or a refusing `keypad — no code` row (a deny tone) — plus the boot; no cylinder to pick. Staff walk it (their contacts are keyed). Codes are LEARNED: off a questioned man (dialogue intel kind `'code'`, ranked after the keyed door, so the corridor men hand their key over first and the cubicle man blurts the digits) or overheard — the ambient `'pin'` pair says them aloud and `overhear` teaches Sam iff `col.sound.propagate(mouth, his head)` carries (path ≤ 9 m, carry ≥ 0.5: round the corner yes, through a shut door no). |
| `laser` | `from` (emitter), `to` (receiver), `alarm?: 'suspicion' \| 'alarm'` (default suspicion), `group?`, `mains?` | The beam's height is simply the ends' y: 0.35 = shin (nobody steps over it), ≥ 1.2 = crouch under (the crouch-walk's crown rides at ~1.12, a standing chest at 1.27; lint flags the in-between). Broken by any capsule of Sam, of the body he hauls, or a thrown item's flight segment (segment–segment distance) — never by staff, leaves or furniture; drawn with combat.ts's weapon-laser draw, cut where something stands in it. A break chirps at the emitter and, per `alarm`: control radios "beam broken in the …" and the nearest calm man comes (suspicion), or the floor goes up at once (alarm); 4 s cooldown per beam. |

The office authors (officeGen.ts → office.json): `cam_corridor` (east end over the exit sign, pans across the corridor, mains), `cam_server`
(the server room's SE corner on the aisle and the door, mains), `cam_lobby` (behind reception over the logo, pans, UPS — the spawn corner is
outside its sweep), `pad_side` on `server_manager` (the QUIET way into the server room; the front door keeps its key / pick / kick),
`laser_corridor` (shin height across the corridor at x 14.5 — the straight walk from the lobby arch to the server door breaks it; round
through the cubicles, the OCP, or the breaker), `laser_storage` (chest height across the storage DOORWAY on its corridor face, battery —
in on your knees; the breaker is through that door). Knobs: `Game.tune.devices / lasers / cameraSuspicionSecs / cameraAlarmSecs / deviceCones` (Tab ▸ Sandbox, persisted
`twopointsix.devices`; 'all codes' / 'forget codes' buttons); `game.devices.summary()` / `.log` for the panel and QA; `probes.ts devices`.

## Civilians (`game/civilians.ts`)

`civilians[]` is optional (a level from before them loads with none). One record = one person on a LOOP: `points[i]` is a mark she walks to
(x, 0, z — the nav grid's 0.5 m cells decide the way; author marks ≥ 0.6 m off any patrol leg and off the furniture: a calm civilian is no
contact for props and yields to a guard, so a mark ON a leg makes her shuffle aside every lap), `wait[i]` the seconds she works there,
`tasks[i]` what she does (`wipe` = standing, hands on the surface ahead — face her AT it; `bin` = kneels (Fixing_Kneeling); `sit` = the
mark is authored ON THE CHAIR — the seated clip's hips sit 0.33 m behind its root, so the game eases the root `SIT_ADVANCE` forward while
seated and skips her collision / prop contact there; `cooler` / `printer` = standing fiddle; `shelf` = reach up; `stand` = idle, looking
about), `face[i]` the yaw she works at (Character convention, forward = [sin, 0, cos]); the four arrays have the same length ≥ 2. `kind`
picks the voice / lines / label ('the cleaner' / 'the late worker') and the intel she gives when questioned; `tint` / `tint2` are the
mannequin's primary (hi-vis vest / shirt) and secondary (trousers) albedo. Ids from 40 (`CIV_ID0`) in file order. Loops open no doors
(author them inside one connected space; a frightened civilian runs through doors like anybody). The office authors two: `marta`
(cleaner, an eight-mark night round of the cubicle floor and the corridor: cabinet fronts wiped, bins knelt at) and `owen` (late worker:
seventy seconds at his desk in the NW cluster, the printer, a stretch by the window). NOT in the file yet (constants in civilians.ts with
a headless reachability check, `checkCivSpots` / `probes.ts civilians-spots`, TODO(LevelData)): `CIV_SPOTS.phones` (reception desk
(8.9, 13.8), break-room wall (34.6, 16.2)) and `CIV_SPOTS.exits` (fire exit (38.2, 23.2), the lot door (34.0, 25.0)).

## Vents (`game/wind.ts`)

`vents[]` is optional (a level from before them loads with none and its indoor air is still). One record = one HVAC supply diffuser:
`pos` = the FACE centre (a ceiling one sits a few centimetres under the slab), `dir` = which way it blows (any non-zero vector; a
ceiling diffuser is `[0, -1, 0]`), `speed` = m/s at the face (0‥12; an office diffuser is 2–3), `spread` = the cone's half-angle in
DEGREES (0‥89; 20–30 reads as a diffuser, 5 as a nozzle), `reach` = metres down the axis at which the air has slowed to half
(∝ 1/(1 + (d/reach)²)) — the jet is gone by 2.5 × reach, so a ceiling vent with reach 1.2 still stirs the floor 2.6 m under it at about a
fifth of its face speed; a jet aimed DOWN turns to run out along the floor over its last half metre (the wall jet: what slides a leaf lying
under it rather than pinning it). `size?` (m, default 0.6) = the face's width: the grille box the generator lays and the jet's core radius
(0.4 × size). `period?` / `duty?` / `phase?` = slow cycling — on for `duty` (0‥1, default 1 = steady) of every `period` seconds from
`phase`, with 3 s ramps either way (a VAV box hunting); `mains?` (default true) puts the air handler on the breaker: a blackout spins every
mains vent down over a few seconds and the restrike brings them back. On top of that every vent GUSTS: × 0.75‥1.25 on a slow value noise
of its own (deterministic — a hash of the game clock, nobody's dice). The field is analytic and summed with the storm outdoors and the gust
through any open exterior door (`windAt(g, p)`); the SAME source records go to the GPU particles (paper, dust, chips, the motes) as a drag
toward the moving air and to the smoke solver's forces step as a relaxation of the simulated air toward it inside each jet's support — so a
plume under a vent bends on screen and in the guards' smoke sight lines alike, and no vent ever costs the solver a domain. The GRILLE is an
ordinary box (group `ceiling.vents`, `NoPrimary` like every ceiling fixture, its louvre a coarse marking) the way a door's frame is ordinary
boxes: move a vent in the editor and move its grille with it. The office authors six (officeGen.ts → office.json): `vent_cub_nw` /
`vent_cub_se` over papered cubicle desks, `vent_aisle` over the middle aisle's north end, `vent_corridor` outside the server door (cycles
45 s / 0.75), `vent_break` inside the break room's corridor door (50 s / 0.6), `vent_server` over the server room's front aisle (the
strongest, 2.8 m/s) — all mains, all ≥ 1.7 m off any panel or beacon and on their own ceiling square. Knobs: `tune.wind` (the master, 0‥1)
+ `WIND` (Tab ▸ Weather ▸ wind rows, persisted `twopointsix.wind`); `__wind.at(p) / sources() / summary()`; `probes.ts wind`.

## For the editor lane (G1b) — the API to build on

```ts
import { OFFICE_DATA, buildLevel } from './scene/level';                       // the bundled data (read-only) / a fresh runtime Level
import { loadLevel, levelToData, fitPropFootprint } from './scene/levelLoad';  // LevelData → Level (validates, copies everything) / Level → LevelData
import { validateLevelData, serializeLevelData, parseLevelData, canonicalLevelData, levelDataDigest, structuralDiff,
         indexLevelData, freshId, flagsToBits, bitsToFlags, AUTHORED_FLAGS, LEVEL_DATA_VERSION } from './scene/levelData';
```

* Edit a `LevelData` (deep-copy `OFFICE_DATA` first — it is the module's one bundled object), `validateLevelData` on every op,
  `loadLevel(data)` to get a `Level` for "play from here" (hand it to `new Game(engine, level, …)` exactly as main.ts does),
  `serializeLevelData` to save (download / localStorage / POST to the dev server), `levelDataDigest` for dirty-tracking.
* `loadLevel` output carries no ids; keep the `LevelData` as the document and use `indexLevelData(d)` for id → index when talking
  to the running `Game` (its `world.statics[i]`, `targets`, `doors.byName(id)`).
* Nothing in `Level` is derived from anything else EXCEPT at Game construction (area lights off emissive switchables, AreaLit flags,
  reach masks, nav / wall rasters) — so an edit means: mutate data → `loadLevel` → rebuild the Game (cheap: ~100 ms headless).

## Editor (lane G1b) — the WORKBENCH's Level / Materials modes: `/workbench` in dev, `workbench.html` in the build (`/editor` forwards)

The editor is an APP (`src/editor/app.ts createEditorApp`: document → scene → view → tools → overlay → chrome → `window.__ed`, the frame in pieces)
that a page hosts on an Engine it made. One page does now (the thin standalone `src/editor/main.ts` is deleted — nothing served it): the
**workbench** (`workbench.html` → `src/workbench.ts` → `src/workbench/main.ts`), which houses it beside the character / prop viewer as ONE shell:
a left RAIL of modes — **Level** (this editor) · **Materials** (the same, its paint / marking tabs up) · **Characters** · **Effects** (the viewer,
VIEWER.md) · **Motion** (a stub) — over one Engine, one Input, one orbit camera (this editor's `View`: RMB orbit · MMB / Space+LMB pan · wheel zoom to
the cursor · T plan · F frame, in every mode), one inspector column, one capture story. Keys `Ctrl+1‥5` switch modes anywhere, plain `1‥5` in the
level modes. Under the rail: the level OUTLINER, then a **scenes ▸ variants** tree — the viewer's studio scenes (picking one goes to Characters /
Effects) and the STAGING scenes that stand a figure IN THE LEVEL in any mode (a guard walking the two vending fronts, one stood by them, Sam
crouched under the manager's desk lamp, a guard on the lobby stone): the level keeps rendering round him and its lights light him, so a paint's
roughness is tuned while a man walks through the reflection; the tree's top row stands the level alone again. Two WORLDS share the engine — the
level (this editor's Scene owns statics + lights) and the viewer's studio — each with its own sky / exposure / haze slot; a switch clears the skin
and the capsules, nothing leaks. URL: `/workbench#mode=level&file=<name>` · `#mode=materials&paint=lino` · `#mode=chars&scene=guard/carbine-shoulder&sel=rig:carbine`
· `#mode=fx&scene=fx/muzzle` (deep links restore mode + document + scene + selection; the hash follows switches); `/editor#file=x` / `#autosave` /
`#blank` and `/viewer#scene/variant`, `/gait` forward in with the old hash translated. Hooks: everything below plus the viewer's (`__viewer __char
__step __gizmo __rig …`), `__shot(name)` = the composite frame for both, `__ui` = this editor's chrome, `__vui` = the viewer's, and `__wb` {mode,
setMode(m), scene(id | null, variant), world, staged, actor, frameFigure(), hash()}. The idle throttle is the editor's (3 s → ~5 fps), 20 s while a
figure is up. Boots on the bundled office; `file=<name>` loads `levels/<name>.json` from the dev server, `autosave` the localStorage slot, `blank`
an empty level; `?quality=` as the game. Layout: top bar (file · undo/redo · tools · gizmo modes · floor · view
toggles · quality · validate / lint / play · status), left PALETTE (box presets, light presets, volume kinds, the three devices, materials — click a
swatch to paint the selection; stair greyed until G2), the view (WebGPU + a 2D overlay: grid, outlines, routes, icons, marks),
right INSPECTOR (outliner over a property sheet for the selection — or the LEVEL: name, snap, sky, floors, materials).

```
src/editor/doc.ts      the undoable document: ops { set | ins | del } by path, begin/commit + transact(label, fn) (rollback on throw: THE form for multi-op verbs), coalescing per gesture, ≥ 100 deep (200)
src/editor/editor.ts   the verbs (add/move/resize/rotate/duplicate/delete/rename … with reference clean-up), selection by REF strings
src/editor/scene.ts    LevelData → engine: statics ≡ data.boxes (+ prop parts, volume outlines), door leaves, lights + the area lights game.ts derives, day/night
src/editor/tools.ts    mouse/keys · view.ts orbit/plan camera · overlay.ts the 2D canvas · ui.ts + sheet.ts + paintui.ts the chrome · api.ts window.__ed · persist.ts saves
src/editor/app.ts      the hostable app (createEditorApp) · src/workbench/main.ts the shell that houses it (the old standalone editor page is gone)
src/editor/lint.ts     level lint (also `bun run tools/qa/level-lint.ts levels/office.json`, exit 1 on errors; `levels/<name>.lint.json` = allowances)
src/editor/geom.ts     box maths, presets, doorFrameBoxes (the generator's frame verbatim), cutOpeningPlan (wallX/wallZ's opening split)
tools/levels-api.ts    the dev server's GET /levels/ · GET /levels/<name>.json · POST /levels/<name>.json (validated, canonical; the server binds 127.0.0.1; loopback Host + same-origin + application/json + `X-Level-Editor: 1` only)
```

**Refs**: `box:<id>` `prop:<id>` `light:<id>` `sw:<id>` `door:<id>` `route:<id>` `route:<id>#<i>` (a waypoint) `volume:<id>` `chokepoint:<id>`
`floor:<id>` `mark:spawn` `mark:<objective id>` (bare ids are boxes). **Mouse**: click selects (shift toggles; double-click = the box's switchable /
group) · press-drag ON THE SELECTION moves it on the floor (Alt = vertical), press-drag anywhere else = marquee (the floor is always under the cursor:
click first, then drag) · RMB orbit · MMB or Space+LMB pan · wheel zooms about the cursor. **Keys**: `G` move · `S` resize (six face handles on the
selected box) · `R` rotate (a yaw ring; Ctrl = 15° steps) · `B` box footprint (preset from the palette; walls run along the longer drag side at
their fixed thickness; a click drops the default size) · `V` volume footprint · `L` light at the cursor (preset height) then drag its **aim** dot ·
`D` door: press at the hinge, drag along the shut leaf (snaps to 90°, Alt free) — with *cut+frame* on, the wall it lands in is split into runs +
lintel and the frame (jambs, head, stops) is built · `P` route: click waypoints, Enter / double-click finishes, Backspace drops the last · `T` plan ·
`F` frame · `X` snap · `O` grid · `H` hidden (NoPrimary) boxes · `N` day/night (data.daylight) · arrows nudge by the snap (Shift fine, Alt / PgUp /
PgDn vertical) · `Del` delete · `⌘/Ctrl Z` `⇧Z`/`Y` `D` (duplicate) `S` (save to server) `A` (all boxes on the floor) · `` ` `` debug views · `[ ]`
exposure · `M` the Materials tab · `K` (a box selected) its Markings tab · `Esc` cancels the tool / clears. Deleting refuses what is still referenced (a door an objective / plan uses, the breaker's boxes, a
floor with things on it — boxes, props, doors, volumes, chokepoints, devices, civilians or a connector end, one `FLOOR_USERS` table in levelData.ts for delete / rename / lint —
the mission marks); a box's switchable forgets it (and goes when emptied), a light's fixture pointing at it is cleared; renaming a keypad takes its door's `lock` with it.
Every multi-op verb runs in `doc.transact`: an exception half-way rolls the whole verb back (nothing half-done in the document, nothing on the undo stack). Resizing a
MARKED box (any write to its `h`: the S handles, the sheet's size row, `__ed.box.resize / size / update`) re-fits its markings into the smaller / larger faces in the same
command (bitmaps cropped top-left when they must shrink) and drops — with a line in the problems panel — only a marking whose face no longer takes one cell.

**Save / load**: *save ▾* download `<name>.json` · POST to the dev server (`levels/<name>.json` — the repo file changes; ⌘/Ctrl S) · autosave
(localStorage `twopointsix.editor.autosave`, every 30 s while dirty + on unload); *load ▾* file picker · drop a `.json` on the view · the
autosave slot · a blank level · the bundled office · the server's `levels/`. The RESTORE paths (`#autosave` at boot, *load ▾ autosave*,
`__ed.save.restoreAutosave()`, `__ed.load(text, {lenient: true})`) open a document that PARSES but does not VALIDATE — its problems listed in the problems
panel, `ed.loadErrors` — instead of refusing it; a `#autosave` boot whose slot is not a level at all keeps the office up as a stand-in and HOLDS the timer's
and the unload's writes until the first edit (`persist.ts AutosaveSession`), so a session is never silently replaced and then overwritten. **Play from here**
writes the document to localStorage `twopointsix.editorLevel` and opens the game with `?level=local` (`/?level=local` from the dev server's `/workbench`,
`index.html?level=local` from a built page — the dev server forwards `/index.html` to `/`); the game's side of it in `src/scene/level.ts`:

```ts
import { parseLevelData } from './levelData';
export function buildLevel(): Level {
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('level') === 'local') {
    try { const t = localStorage.getItem('twopointsix.editorLevel'); if (t) return loadLevel(parseLevelData(t)); }
    catch (e) { console.error('?level=local: falling back to the bundled office —', e); }
  }
  return loadLevel(OFFICE_DATA);
}
```

**`window.__ed`** (api.ts) — every mutator is one undoable command; getters return copies:

| | |
|---|---|
| document | `digest()` `rev()` `dirty` `serialize()` `load(text\|data, {lenient?})` (→ `errors`) `blank(name?)` `snapshot()` `validate()` `lint()` (→ findings + `summary`) `roundTrip()` `undo()` `redo()` `history()` `check(d)` `digestOf(d)` |
| selection / verbs | `select(refs\|null, mode?)` `selection()` `exists(ref)` `posOf(ref)` `move(refs, [dx,dy,dz])` `rotate(refs, dyaw, {snapDeg,pivot})` `duplicate(refs, off?)` `delete(refs)` `rename(ref, id)` `nudge(refs, dx, dz, dy?)` |
| `box` | `presets()` `add({preset,c,h\|size,yaw,material\|albedo,emissive,flags,group,name,switchable})` `draw(preset,a,b)` `get` `update` `move` `resize(id, '+x'…, Δ)` `size(id,[x,y,z])` `rotate` `duplicate` `delete` `flags(ids, flag, on)` `paint(ids, material\|rgb)` `byGroup(g)` `count()` |
| `light` / `switchable` | `light.presets()` `add({preset,pos,…})` `get` `update` `aim(id, target)` `move` `delete` `list()` · `switchable.make(boxIds,{group,on,baseEmissive})` `get` `update` `of(boxId)` `delete` `list()` |
| `door` | `add({hinge,closedDir,width,locked,…}, {cut,frame})` `get` `update` `makeFrame(id)` `cutOpening(id)` (→ removed/added/obstructions) `obstructions(id)` `framePlan(id)` `frameBoxes(id)` `delete` `list()` |
| `route` | `add({points,wait,name,weapon,keys})` `draw(points)` (the P tool) `get` `update` `movePoint(id,i,pos)` `insertPoint(id,i,pos,wait?)` `removePoint(id,i)` `setWait(id,i,s)` `reverse(id)` `delete` `list()` |
| `device` | `add({kind:'camera', pos, yaw, pitch, fovDeg, range, sweep, sweepPeriod, mains, group})` (a floor point is hung 2.6 m up) · `add({kind:'keypad', door \| pos, code})` (LOCKS that door on the pad's own lock; re-linking `update(id,{door})` moves the lock, `delete` takes the door off it) · `add({kind:'laser', from, to, alarm, mains})` (floor points run at 0.35) · `get` `update` `move` `rotate` (a beam turns about its middle) `aim(camId, target)` `end(laserId, 0\|1, pos)` `duplicate` (never a keypad) `delete` `list(kind?)` `ofDoor(doorId)`. Tools: **C** camera (click under where it hangs; it looks the way the view looks; drag its aim dot), **K** keypad (click beside a door on the face that carries the pad — the default spot is 1.5 cm proud of the wall's face, pushed out of any solid), **J** laser (press at the emitter, drag to the receiver; end handles after). Lint: `camera-in-solid`, `laser-in-solid`, `laser-blocked`, `laser-height`, `keypad-in-solid`, `keypad-far`, `keypad-side`, `keypad-orphan` (no patrol point's nearest pad — nobody could give its code up), cones counted in `light-slots`; `switchable-dark` counts a box's EMISSIVE MARKINGS as light |
| others | `volume.add({kind,c,h,yaw})/get/update/delete/list` · `prop.get/move(id,x,z,yaw?)/update/delete/list` · `chokepoint.add/update/delete/list` · `mark.spawn(pos?)/objective(id,patch?)/move(ref,d)/list()` · `floor(id?)` `floors.list/add/update/delete` · `material` / `marking` (below) · `level.name(n?)/meta(patch?)/sky(which,rgb)/counts()` · `connector` stub |
| view / tools | `camera({look,yaw,pitch,dist}?)` `pin(state\|null)` (FollowCamera.pin, verbatim for captures) `plan(on?)` `frame()` `tool(name?)` `mode(name?)` `preset(kind,key)` `grid(on?,step?)` `snap(on?,step?)` `day(on?)` `hidden(on?)` `settings()` `quality(name?)` `step(n)` `shot(name)` (JPEG to the shot server, overlay off; `__edshot` with it) `scene()` `pick(mx,my)` |
| persistence | `save.download()` `save.server(name?)` `save.serverList()` `save.serverLoad(name)` `save.autosave()` `save.readAutosave()` `save.restoreAutosave()` (lenient, → `errors`) `save.local()` (the play stash) `play()` `save.keys` `save.session` (page only: the AutosaveSession — `held`, `tick()`, `bootError`) |

**Materials + Markings — the inspector's tabs** (`src/editor/paint.ts` = the document operations, `paintui.ts` = the chrome; the PROPERTIES header is
now `properties | materials M | markings K`). Everything below is LIVE — the view is the game's renderer, and a paint / marking edit reaches it through the
same document → `Scene.sync` → `loadLevel` → BoxWorld upload path as any other edit (~4–5 ms of CPU for the office per change; the marking table in the
tail of boxMat is append-only, so the scene compacts it once a painting session has taken two-thirds of its 6144 rows) — and every control is ONE undo step
(a slider drag or a brush stroke coalesces under its own key and is sealed at release):

* **Materials** (`M`): the palette list (a swatch per paint — its sRGB albedo under a highlight streak that narrows / brightens with polish and takes the albedo's
  hue for metal: a CSS approximation; usage counts; the finish) · per paint: albedo as a native colour picker + hex (sRGB) AND three linear fields, roughness 0.02‥1
  with ticks at the finish presets + a *matte (no finish)* box (absent `rough` = `ROUGH_DEFAULT` 1: no ray on any tier) + the *traced on ultra · high · medium* hint
  (`RtTier.maxRough` 0.55 / 0.45 / 0.35) and what THIS view does, metal (yes / no — the format has no fraction), notes, the FINISH PRESETS (stone 0.15 · lino 0.22 ·
  brushed metal 0.28 + metal · dark screen 0.08 · laminate 0.5 · wood 0.55 · matte wall 0.85 · unset) · new / duplicate / rename (references rewritten) / delete
  (refused while used) / *from selection* (a paint from the first selected box's resolved look, the selection painted with it) / *users → sel.* / *paint sel.* ·
  **per-box overrides** for the selection: material dropdown (or *(inline albedo)* = detach keeping the look), inline albedo, *override roughness* / *override
  metal* toggles + their controls, finish presets ON THE BOXES, *clear overrides*, the resolved look. `aniso` is runtime-only (the wet lot) — not in LevelData v1.
  Every material write replaces the whole `materials` record, so a rename or a delete undoes back to the same palette ORDER.
* **Markings** (`K` with a box selected — with nothing selected K is still the keypad tool): the box's faces (buttons, or click the face IN THE VIEW; the overlay
  outlines it with its painter axes u → / v ↑ and the selected bitmap's rectangle) with each res's cell size and the largest bitmap the face takes · the marking list
  (face, res, W×H, at, palette chips, lit cells, ⚠ on a validator error) · add on the face / duplicate / remove / copy / *paste → sel.* (same face, clamped onto each
  target's face, too-small faces skipped and named) / *apply to pattern* (a regular expression over id / name / group, + *same size*: how a per-kind default is authored
  by hand) / the KIND RECIPES of `scene/markingDefaults.ts` sized to the box (keyboard, carton, cabinet, cupboard, book run, papers, whiteboard, keypad, rack, door
  leaf, clock, the vending fronts …; replaces the box's set) · frame: res / face / size / at (all clamped INTO the face) + anchors + nudges · the **PAINTER**: a canvas
  of the cells (transparent = the box's own albedo), LMB paints the active entry, RMB erases, shift-drag fills a rectangle; with the painter focused `[` `]` cycle the
  entry, `1 2 3 0` pick it, arrows move the bitmap on the face, ⇧arrows shift the cells (wrapping), `H` `V` mirror, `Del` is swallowed, `Esc` hands the keys back ·
  **palette entries** as MATERIALS: mode *× box albedo (mul 0.4‥1.6)* | *absolute albedo* | *leave the albedo*, optional roughness, optional emission as a LEVEL under
  ONE SHARED CHROMA for the whole marking (game.ts registers one light per marking; a marking loaded with two hues shows a warning + *unify*), ≤ 3 entries (the cells
  are 2 bits), the 'no gradients / no baked lighting' rule holds by construction · **generators** run INTO the bitmap (fill · grid = key caps + space bar · seams + pulls
  · lines = text bars · scribble · dots = LEDs · window = the vending cans · glyph = the 5 × 7 pictograms · tape = a band whose entry becomes the packing-tape material;
  entries a recipe names beyond the palette are added) · **ASCII**: the '.abc' rows in a textarea, *apply text* (resizes to the art, refused if it will not fit the face
  at that res), *copy as literal* (a `markingDefaults.ts`-style `const ART_… = [ … ];`), paste tolerates literals / bare rows / comments.

| `material` | `list()` (name → record, palette order) `table()` (+ usage) `get(name)` (+ users + trace hint) `set(name, {albedo?, rough? (null = unset), metal?, notes?})` (or the old `set(name, rgb, notes?)`, which also creates) `create(name, init?, {after?})` `duplicate(name, newName?)` `rename(old, new)` `remove(name, {repaintTo?})` `users(name)` `preset(name, key)` `presets()` `fromSelection(ids?, name?)` `selectUsers(name)` `traceHint(rough)` |
|---|---|
| `box` (added) | `override(ids, {albedo?, rough?\|null, metal?\|null} \| null)` `finish(ids, presetKey)` `look(id)` (the resolved albedo / rough / metal) `matching(regex, {sameSizeAs?})` |
| `marking` | `list(boxId)` (+ lit / emits / errors) `get(boxId,i)` `face(boxId, face, res?)` (the lattice) `add(boxId, {face,res,size,at\|anchor,pal,cells})` `update(boxId,i,patch)` `remove` `duplicate` `setAll(boxId, list)` `paintCell(boxId,i,x,y,e)` (x = column, y = row from the TOP) `paintCells` `fill(boxId,i,[x0,y0,x1,y1],e)` `clear` `mirror(…,'h'\|'v')` `shift(…,dx,dy)` `nudge(…,du,dv)` `generate(boxId,i,kind,params)` `generators()` `recipes()` `recipe(boxId,key,face?)` `ascii(boxId,i)` `literal(boxId,i,name?)` `fromAscii(boxId,i,rows\|text)` `parseAscii(text)` `pal(boxId,i,k,{mode,mul,albedo,rough,emitLevel,emitChroma})` `addPal` `removePal` `unifyChroma` `emitModel` `copy` `paste(ids)` `clipboard()` `applyToPattern(boxId,i,regex,{sameSize})` `summary(boxId,i)` (coverage, mean radiance, the light's intensity) `marked()` |
| `ui` (page only) | `tab('props'\|'materials'\|'markings')` `paint(name?)` `marking(boxId?, i?, face?)` `entry(e?)` — plus `__uishot(name)` = the view + overlay with the inspector column rasterised beside it (`domshot.ts`: DOM → SVG foreignObject → canvas), and the page renders at ~5 fps once idle for 3 s (`__idle`) |

QA: `bun run tools/qa/probes.ts editor` (editor-doc: every verb + undo/redo digests + scene sync + the tools through a synthetic pointer;
editor-ui: the chrome on a fake DOM; editor-save: the /levels/ handler's contract + autosave; editor-materials: the paint / override / marking operations,
a 30-step drag = 1 undo, serialize() ≡ levels/office.json after edit + undo, the two panes clicked through on the fake DOM; editor-restore: a resized marked box stays
valid, the lenient restore + the autosave hold, transact rollback, keypad rename → lock, floor users, prop-part markings in the scene, lint's `mark-rows`) and `probes.ts level-lint`
(clean office, planted faults incl. a switchable lit only through emissive markings and a keypad buried in its wall, the CLI). What the editor's lighting is NOT: the game's per-light reach masks (render/reach.ts) are not built, so a light walled off from a
room may still rank there — lossless-by-design culling, invisible except in leader-slot starvation cases; and props are static stand-ins.

## Merging a lane that edited the OLD `src/scene/level.ts`

Lanes started before this landed edit the level where it used to live. Their INTERFACE hunks (top of `level.ts`) merge normally — the
types are still there. Their hunks in the old `buildLevel()` BODY conflict (that code is `src/scene/officeGen.ts` now, verbatim, ~120
lines higher up). Resolve by keeping this side's `level.ts`, then:

```bash
git diff <merge-base> <lane> -- src/scene/level.ts > /tmp/lane-level.diff      # their level.ts changes
# apply the BODY hunks to the generator (same context lines, only offsets differ; --recount/-C1 if a hunk is stubborn, or by hand):
sed 's#src/scene/level.ts#src/scene/officeGen.ts#g' /tmp/lane-level.diff | git apply --include=src/scene/officeGen.ts --reject -
bun run tools/level-export.ts                 # regenerate levels/office.json from the merged generator
bun run tools/qa/probes.ts level              # identity 0 diffs / validator / round trip — all PASS
git add src/scene/officeGen.ts levels/office.json
```

The drill plans (`plans.roomClear[]`, `plans.breach`) are typed BY REFERENCE to `RoomClearPlan` / `BreachPlan` and handled generically
(canonical order = known keys first, new ones after alphabetically; validation = the RoomClearPlan fields + "every leaf finite"), so a lane
that grows `BreachPlan` (the breach re-choreography does: `retreat`, `flow`, record `targets`, `next`, more `breachLines`) needs NO change
in `levelData.ts` — `level-roundtrip` carries exactly such a grown plan through validate → serialize → parse → load to prove it. A lane that
changes `RoomClearPlan`'s own fields, `LightDef`, `LevelDoorDef`, `PropDef` or `Level` itself does need the matching field in
`levelData.ts` (type, validator, canonical key list) and `levelLoad.ts` (both directions) — `level-identity` fails until it has it.

## What was procedural, and what is still generated

Nothing in the office was random — every "jitter" (chair angles, which rack slots carry LEDs, which shelf gets a carton) was
arithmetic on indices — so the export froze nothing and the level is exactly the one that shipped. What the generator COMPUTED
and the file now simply CONTAINS: wall runs split around openings (with sills, lintels, mullions), door frames (jambs, head, the two
stops per leaf), desk / monitor / cabinet / shelf / car assemblies, the rack LED grids and their invisible glow strips, prop
footprints. The editor will want helpers for the first two (a "wall with openings" tool, "frame this door") — port `wallX` / `wallZ`
and the frame loop from `officeGen.ts` when it does.
