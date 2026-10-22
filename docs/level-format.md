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
| `surfaces?` | `{ building, grassEdge, inside, outside, verge, zones[] }` | footstep materials (carpet / lino / stone / tile / asphalt / grass). **`game/floor.ts` reads it** (`Level.surfaces`, attached non-enumerably by `loadLevel`): outside `building` the ground (`verge` where x or z < `grassEdge`, else `outside`), inside it the first zone holding the point, else `inside`. A file with none gets the office's map, which floor.ts still carries (`level-validate` asserts it equals the office file's block). A generator returns `surfaces` from `build()` (tools/levels/kit-yard.ts) |
| `boxes[]` | `{ id, floor?, group?, name?, c, h, yaw?, rot?, material \| albedo, emissive?, rough?, metal?, flags?, cutHeight? }` | static geometry, **in order** (`boxes[i]` is `world.statics[i]`). `flags` by name: `NoPrimary NoShadow Cutaway Gloss` (runtime bits `Emissive AreaLit Rot Dynamic` are never authored — the validator rejects them). `group` is editor grouping only (`lobby`, `walls.interior`, `doorframe.server` …). `name` is a tag the game may look up (`breaker_panel`) |
| `props[]` | `{ id, kind, name?, floor?, x, z, yaw?, mass, parts[{off,h,yaw?,material\|albedo}], half?, height? }` | loose furniture (chairs, cartons, bins, plants). `half`/`height` are FITTED from the parts unless given (10 of 61 pin them: plants author their footprint, a few fits differ in the last bit) |
| `lights[]` | `{ id, kind point\|spot\|dir, pos, dir, color, intensity, range, innerDeg, outerDeg, group, enabled, volumetric, radius?, mains?, broad?, fixture? }` | analytic lights; `id` is the name targets / panels key on; `fixture` = the glow-card box id |
| `switchables[]` | `{ id, boxes[], group, on, baseEmissive, flicker?, mains? }` | emissive fixtures the OCP / panel / blackout switch (panels, screens, signs, rack LEDs, beacon domes). A box belongs to at most one |
| `doors[]` | `{ id, floor?, hinge[x,z], closedDir, width, angle?, exterior?, closer?, minAngle?, maxAngle?, locked?, lock?, keySide?, swing? }` | the LEAF (`swing` ±1 = the side it opens into, +1 the CCW side of the closed leaf; absent = dealt at load: into the room it serves, an `exterior` door with a roof over one face only OUTWARD, toward the open air — game/doorswing.ts; a `swing` here overrules both — and it is how a room keeps a door no wedge holds: the men at home in a room wedge the doors that open INTO it, so every room a mission posts men in needs a way in that no wedge shuts — a door authored to open OUT of it onto floor the squad reaches (a wedge shuts a door one way: the neighbours' wedge on that door stops only the walk into THEIR room), or a window a man steps through; `bun run tools/qa/second-way-check.ts` is red on a level where some choice of wedges leaves such a room with no walk in from the team's start); the frame is ordinary boxes in group `doorframe.<id>` |
| `routes[]` | `{ id, name?, points[], wait[], weapon?, keys? }` | one guard per route (game.ts spawns them in order); `wait.length === points.length` |
| `chokepoints[]` | `{ id, name?, floor?, pos, yaw }` | lockdown posts |
| `civilians[]` | `{ id, name, kind cleaner\|worker, floor?, tint, tint2, points[], wait[], tasks[], face[], notes? }` | the civilians on the floor (`game/civilians.ts`) — see *Civilians* below; optional block, absent = nobody but the shift |
| `volumes[]` | `{ id, kind hide\|utility\|trigger, floor?, c, h, yaw?, notes? }` | none yet |
| `devices[]` | camera / keypad / laser union | the level-design devices (`game/devices.ts`) — see *Devices* below |
| `vents[]?` | `{ id, floor?, pos, dir, speed, spread, reach, size?, period?, duty?, phase?, mains?, notes? }` | HVAC supply vents (`game/wind.ts`) — see *Vents* below; optional block, absent = still air indoors |
| `scenarios?` | `{ nightBreach?, roomClear?, rescue?, places?, quiet?, lesson?, par?, issue?, kitView?, response?, doorNames? }` | what the playtest scenarios take from THIS level (`scene/scenarios.ts`) — see *Scenarios* below; optional block, absent = no scenario runs here (the office's own is `levels/office.scenarios.ts`, attached at load) |
| `connectors[]` | stair / ladder `{ from{floor,c,h}, to{…}, cost?, mat? }` | **TODO(G2)** — typed stub, empty |
| `mission` | `{ playerSpawn, objectives[] }` | objectives `reach{area,door}` / `drive{rackIndex,front,halfW}` / `exfil{door,x,z}` — v1 wants exactly one of each (the fixed stage machine in `game/mission.ts`) |
| `breaker` | `{ pos, panel, led }` | box ids |
| `beacons[]` | `{ id, pos, box }` | `box` = the dome, which MUST be a switchable's box (game.ts slaves the beam to it) |
| `sky`, `daylight?` | `{ zenith, horizon }`; `{ sun(light), sky, groupsOn, groupsOff, lightsOff, haze, exposure }` | the level's daytime variant (`lighting.ts setDaylight`, `__daylight`; the editor's 'day' view) |
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
in on your knees; the breaker is through that door). Knobs: `Game.tune.devices / lasers / cameraSuspicionSecs / cameraAlarmSecs / deviceCones` (debugger ▸ Sandbox — the game page's tweak panel, on the backtick key —, persisted
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
+ `WIND` (debugger ▸ Weather ▸ wind rows, persisted `twopointsix.wind`); `__wind.at(p) / sources() / summary()`; `probes.ts wind`.

## Scenarios (`scene/scenarios.ts` — `Level.scenarios`)

What the three playtest scenarios need from the level they are played on is DATA that travels with the level: a top-level `scenarios` block (types and field
comments in `src/scene/scenarios.ts`). `game/roomclear.ts`, `nightbreach.ts`, `rescue.ts` and `rescueflow.ts` read `level.scenarios` and nothing else, so a level
that carries a block is a level they run on. The OFFICE's file has no block: its data is `levels/office.scenarios.ts` (the tables that used to live in the game
code, number for number), attached non-enumerably by `withOfficeScript` to any level whose `name` is `office` / `office-*` (`isOfficeFamily`) — so `office.json`,
its digest and every data walk are unchanged.

- `roomClear` — `{ name, team?, rooms[] }`: each room `{ id, name, bounds, doors[{ id, from }], garrison, marks[{ pos, watch, aimAt }] }` (`doors[].id` and
  `marks[].watch` are door ids of this file; give more marks than `garrison` so a reseed deals another placement; ≤ 5 defenders in all — or up to `maxMen` (≤ 11: Sam, the four and eleven fill the sixteen skinned characters) where the block gives it; `squads[]` (scene/scenarios.ts SquadData: id, name, rooms, rally, barricade, mayLeave, training ('green' | 'mixed' | 'trained': how its men take a fright — every man green, its first man a steady leader over green men, every man steady; absent = the difficulty's mix, game/morale.ts trainingOf), arrive {door, spawn, men}) groups the garrisons into defender squads — every room in exactly one, refs checked by the validator and against the floor by checkStructure; absent = one pool, as before: the staging then lifts the character budget to fit, `levels/block.json` is the one that does). `wayOut: true` (optional; `levels/records.json`) = under Hard the men a lost room draws hold one door of it from back off it instead of walking in (`game/pressure.ts PRESSURE.wayOut`; nothing at Standard). `team { sam, samYaw,
  ops[], opsYaw? }` is where the team starts — REQUIRED (with ≥ 2 `ops`) on a level with no `plans.breach`, where the room clear has no F drill: every teammate
  is the order menu's from the first frame. With four marks the four-man squad stands on them; with two, the second pair is stood a stride behind.
  `starts[]` (optional, only beside a `team`; each `{ sam, samYaw, ops[≥ 2], opsYaw? }`) = OTHER WAYS IN, the player's pick on the mission sheet's Way in
  row (`ROOMCLEAR.way` / `?way=N`: 1 = `team`, 2 = `starts[0]` …; `?way=any` = a visit that names no placement seed is dealt one off its die); a plain link, a
  named seed and every headless tally get `team`. A level that gives one names its ways on its mission row (`ways` in src/scene/scenarioList.ts, `team`'s first). Each is
  held to the same floor checks as `team` (free floor, a way on foot to every teammate's mark and into every room).
  `wallCharges` (optional, a count) = wall charges the squad is ISSUED for a room clear of this level whatever its kit cards carry (src/game/issue.ts, asked at
  every staging right after the kit: the bag is raised to the count, never lowered, nothing kept per machine) — for a level whose route is through its walls
  (`levels/mousehole.json`: five, four walls on the route and a spare). Absent = the kit's own count, as on every other level.
  `digIn: false` (optional) = this floor's men never dig in (`game/digin.ts`: no door braced, no move to cover, no gun set on the expected door), at any
  difficulty and whatever its squads decide — for a level whose words lean on men standing where they were dealt (Training 5 and 6). Absent = the game's rule.
- `rescue` — `{ team, room { name, where?, door, bounds?, lights?, doorAim, outside?, hold? }, side? { door, hold, from? { door, bounds? }, stack?, standoff? },
  hostages[{ pos, face }], captor, doorMan { inside, outside }, roamers[], flow? }`. `room.bounds` or a `plans.roomClear` entry for `room.door` must exist.
  `flow { corridor, regions[{ id, door, rect }], route[], hold }` is the unasked-cover route (`rescueflow.ts`); AS BUILT it reads a corridor along +x walked
  west → east — a level whose route is another shape leaves `flow` out.
- `nightBreach` — `{ team, room?, lights? }`: only beside an authored `plans.breach`.
- `places` — `{ areas[{ name, bounds }] }`: the level's own NAMES for floor nobody holds (a hall, a corridor, a yard — `name` without its article; one name
  may be several rectangles). WORDS ONLY: nothing in the simulation reads it. It is what a line on their net, a cue and the debrief call a spot that is in no
  room of `roomClear` (`game/dialogue.ts levelRects`: the structure's rooms first, then these; a spot in none of them is 'outside' the nearest), and what a
  level WITHOUT a structure (the registry) names its rooms by. A level that carries neither says no place at all — never a room of the office's.
  `bun run tools/qa/level-names-check.ts` holds it.

The validator checks the block's keys, every door reference, the team marks and the region ids against the same file. Against the FLOOR (marks standable, inside
their rooms, clear of furniture, with a line to what they cover; the team start joined on foot to every room) the checks are the game's, headless:
`roomclear.ts checkStructure`, `rescue.ts checkRescue`, `RescueFlow.check`. `bun run tools/qa/scenario-level-probes.ts levels/<name>.json` runs them and then
stages, walks and finishes each scenario the file carries (pair, four, rescue) under a plain scripted player; `probes.ts scenario-levels` is that on
`levels/test-rooms.json`.

- `quiet` — a QUIET MISSION on this level (`game/quiet.ts`; the author's page is rebuild/play-style-levels/quiet-missions/contract.md): the level's own night
  left live (its `routes`, `devices`, `civilians`: nobody posted, nobody benched) with the player alone or with ONE partner under the pair rules, silent from the
  first frame. `{ thing?, starts[{ sam, samYaw, mate?, name? }], spots[{ place, area, door, holder, rackIndex, front, halfW, wired? }], exits[{ name, door, x, z, out,
  halfW? }], patrols?: string[][], needs?, phones?, wayouts?, radioCheck? }` (`radioCheck: false` = this shift keeps no radio check: nobody is sent round a silent man's route; absent = the game's) — a run's seed deals ONE start, ONE spot and ONE patrol set (route names; at most six a set);
  every exit is open on every run and faces any way (`out` = the unit vector pointing out through it). `needs` / `phones` / `wayouts` are the level's own places
  for the shift's errands and a frightened civilian: on a level that carries this block the office's tables (needs.ts NEED_SPOTS, civilians.ts CIV_SPOTS, the
  response team's stairwell, the storm's two roofs, the footstep map) are NOT read — the level's own, or that thing off (the response team: the level's own
  `response` block below, or no team). The file's `mission` stays as the
  validator wants it (equal to `spots[0]` / `exits[0]`, with `exfil.out`): it is what the plain `&solo` boot reads. `?levelFile=<name>.json&quiet[=pin][&squad=1]`.
  Checks: `bun run tools/qa/quiet-check.ts <name>.json` (the block against the built floor, every deal started), `tools/qa/solo-night.ts --level <name>.json
  --quiet [N] [--squad 1]` (the scripted player to the debrief), `probes.ts quiet` on `levels/quiet-yard.json` (generator `tools/levels/quiet-yard.ts` = the
  worked example). A level that carries only this block passes `map:check`'s structure section with a note (the room clear's sections have nothing to hold).

- `lesson` — a TRAINING LESSON over this level's mission (`game/lesson.ts`; rows in `scenarioList.ts TRAINING_MISSIONS`, `group: 'training'`): `{ title,
  steps[{ id, line, setupLine?, done, hold?, at? }] }` (`setupLine`: the line while a gun's key again opens its setup, where the step's keys are others then). A step's `line` is the objective row while it is up ("training 3/11 ▸ <line>": what to do and THE KEY, at most 96
  characters), `at` the marker, and it moves on when `done` — a test record `{ is: '<kind>', … }` read off the game — is true (for `hold` seconds). Never on a
  clock. Kinds (`lesson.ts LESSON_TESTS`; a new kind is one row there with its `ok` and its `check`): STATE `in {area}` · `near {at, r?}` · `flag {flag,
  value?}` (the `FLAGS` table: crouch sprint wall peek nv light holstered gun auto dragging holding picking coding menu silent dark chargeSet chargeClear wallBlown …) · `slot {slot, drawn?}` ·
  `pace {below?, above?}` · `meter {which: 'light'|'noise', below?, above?}` · `stage {stage}` · `door {door, state: open|shut|unlocked|broken}` · `target
  {name, on}` (a light or a device by name) · `men {down}` · `all {of}` / `any {of}`; DEEDS counted from the moment the step came up: `did {what: 'act:<the
  Space row's verb>' | 'event:<hearing event of the player's>' | 'chron:<chronicle kind>' | 'order:<orders.log id>', n?, on?: '<door name>'}` (`on`: that order given on that door). By family — hands: `downed {how: takedown|choke|whip|ring|knife,
  n?}`, `body {area}` (a man down lies there, let go of); kit: `reload`, `launcher {on: ring|he40|none, fired?}`, `burst {n?}`, `threw {kind?:
  smoke|flash|frag|he40, quick?}`; squad: `orderTo {who: all|red|blue}`, `stackOn {who?, door, set?}`, `pairsOn {doors?}`, `word {doors?}`
  (F, over how many doors), `taken {room}` (a room of `roomClear` stands cleared), `following`; the quiet partner: `mate {area?, at?, r?, by?, away?}`, `pair
  {what: mark|now|set|go|go:F|go:hands|down, n?}`. A step must never be able to become impossible while the mission can go on (a can or a charge can run
  out, a door can come open another way): give such a step an `any` with the honest alternative. The lesson only READS the game: the
  level under it is a real mission of its kind (it needs a `quiet` or `roomClear` block) and the same keys play the same run with `?nolesson`. After the last
  step the mission's own objective has the row back and ends the run. Generators stand on `tools/levels/train-ground.ts` (`trainGround()`: the compound, `hut`,
  `lamp`, `finish`); `tools/levels/train-move.ts` is the worked example; the seven are `train-move` · `train-hands` · `train-lights` · `train-kit` (quiet, alone), `train-orders`
  (a room clear with the pair), `train-pairs` (with the four), `train-silent` (quiet as two). A Training row deploys at ITS OWN size only (`loadout.ts
  squadChoices`: the Loadout screen greys the others). Checks: `bun run tools/qa/lesson-check.ts <name>` (the block against the file, the
  floor and the list), `tools/qa/lesson-run.ts <name>` (a scripted player — `tools/qa/lessons/<name>.ts`, input only — through every step to the debrief; a
  step that moves on with nothing done is a FAIL), `tools/qa/lesson-gate.ts [name …]` (per Training level: the file is its generator's, level-lint, lesson-check, the scripted run, and the on / off digests equal),
  `tools/qa/light-map.ts <name>` (how lit a man is across the floor).
- `par` — a PAR CLOCK over this level's room clear (`game/par.ts`; needs a `roomClear` block): `{ gold, silver, bronze, lossSecs }`, seconds, with
  gold < silver < bronze and `lossSecs` ≥ 0. The run is timed from the first order, Sam's first stride off his start mark or his first round or throw to
  the room clear's 'taken'; every teammate down at the end adds `lossSecs`; the total, in whole seconds as shown, earns the medal. The clock leads the
  objective row and the result is said once on the HUD log. It only READS the game: the same keys play the same run with `?nopar` (`PAR.on` false). Set
  the bars from measured runs (`tools/qa/ships.ts --scn <row> --seeds 1-24 --json f`: each run's `par` = secs, lost, total, medal). Today:
  `levels/killhouse.json`. Check: `bun run tools/qa/par-check.ts` (`probes.ts par`).
- `defuse` — TIMED CHARGES on one clock over this level's room clear (`game/defuse.ts`, `Game.defuse`; `levels/defuse.json`, row `defuse-four` 'The two
  charges', `group: 'clock'`): `{ secs, workSecs?, devices: [{ id, name, pos, n }], blast?: { lethalM?, woundM?, radius?, power? } }`. `secs` = the one
  clock, counted from the team's first move or first order and shown in the objective row; a device is a small box on a face — `pos` its centre, `n` the unit
  [x, z] normal out of the face a man works it from, `name` what the row and the order call it ('charge 1': a name the level itself shows, never a compass
  word — the HUD has none). A charge is made safe by `workSecs` seconds (absent: `DEFUSE.workSecs`) at it — Sam's own Space row 'make it safe', or a teammate
  sent through the squad's work order (`game/workthings.ts`, thing kind `'device'`: X on it, 1). The clock at zero sets off every charge still live through
  `frag.ts blast()` with the block's radii (absent: `DEFUSE`'s) — a real blast in that room — and the mission is FAILED, and stays so if the house is taken
  afterwards; won = every charge safe AND the room clear taken. The level needs a `roomClear` block; a level without `defuse` is the room clear alone
  (`DEFUSE.on` false = the same on this level, by digest).
  Checks: `bun run tools/qa/defuse-check.ts` (`probes.ts defuse`; `DEFUSE_BREAK=1` must fail), `TPS_PROFILE=shipped bun run tools/qa/defuse-run.ts
  [--arm split|whole|split-back|whole-back|sam|both|backs|all] [--seeds 1-24] [--secs 100 --clocks 60,75,90]` (a scripted commander: two pairs at once
  against the whole squad to one charge then the other, by the wings or by the workshops' back doors, and the player's own hands on one).
- `issue` — a KIT ISSUED BY THE LEVEL (`game/kit.ts kitIssue`): `{ members: { '<place>': { …card fields } } }`, place `'0'` = the player, `'1'`‥`'4'` the
  teammates in roster order; each entry lists only the fields that differ from the issue card (`weapon` rifle | pistol | shotgun, `suppressed`, `light`,
  `nvg`, and the counts `bangs charges smoke frags walls shells`, whole numbers 0‥9; `charges walls` are a teammate's alone and `shells`
  the player's alone — the validator refuses them elsewhere; with the pouches rule off nothing trims a count; a card that still says `shield` is refused in words — the ballistic shield left the game on 10-18). Every staging on that level wears the issue card with those
  fields over it, whatever kit the machine keeps, and the kept kit is not written; `?noissue` (`ISSUE.on` false) = the kept kit as on any level. Today:
  `levels/hall.json`, whose block is empty since the shield went (`members: {}`: every man on the plain issue, no visit to the loadout screen).
- `response` — THIS LEVEL HAS A RESPONSE TEAM (`game/qrf.ts`, switch `RESPONSE`; `scene/scenarios.ts ResponseData`): who comes when the place goes loud, by
  which ways, and what they are called on the net. A LEVEL DESIGN DECISION, NOT A DEFAULT: a level carries the block only where somebody would plausibly
  come (a post with a radio room and a picket down the road, a street under curfew, a border company's lines) and `why` says so in a sentence — the
  validator refuses a block without it. A level whose idea is that nobody comes (a hilltop relay, a private vault, a range on a clock) carries none, and
  with the switch on a level without the block has no team whatever doors it has. `{ why, site, at, team, tag?, ways[{ name, door?, muster[4], entry[4],
  entryFace[4], coming?, clear?, stairs? }], men?: [fewest, most], eta?: [shortest, longest], posts?[{ name, pos, yaw, sweep[2] }], outside?: Vec3[],
  sweep?[{ name, pos }], raid?: { room? } }`. `site` / `at` / `team` / `tag` are the radio's words ('the post', 'at the post', 'the picket', `PICKET` → PICKET-1); a way is
  where four men are stood up out of sight (`muster`, outside the wall or behind the named `door`), the fan they take inside it (`entry` + the yaw each
  faces), and its two radio phrases; `stairs` = it is a stairwell (boots on the stairs, the door rings). `men` 2‥4 and `eta` 15‥240 s are RANGES: each
  call is dealt one way, one size and one time off the game's own die (`RESPONSE.deal`; a way an enemy stands at the muster of is never dealt). `posts` +
  `outside` are the second lift's places outside the ways out (absent: none); the element and the posts together are never more than `men[1]`. `sweep`
  is where they look with nothing said on the net, on a floor with no room plans (absent: the quiet block's spots and `places`' areas). `raid?: { room? }`
  = the team answers a SQUAD'S ROOM CLEAR on this level and nothing else (`RESPONSE.raid`): it stands with the defenders, is counted inside the eleven,
  has no `posts`, and is asked for by a living defender of `room` (a `roomClear` room id: where the set or the telephone is; absent: any defender) six
  seconds after he first hears gunfire — those men down first, nobody calls. A block without `raid` answers a quiet night gone loud, never a raid. No compass words
  in a way's name. The block is words and marks only: it does not move the level's fingerprint. Checks: `bun run tools/qa/response-check.ts` (which
  levels carry one — its `WITH` list is the written-down answer — every block against its built floor, a call played through on each).
- `doorNames` — WHAT A DOOR IS CALLED where its id cannot say it (`game/doornames.ts`, switch key `WORDS.doors`): `[{ door, name }]`, a row a door. `door`
  is a door id of this level, at most once; `name` is 1 to 40 characters, written as the squad's row reads it ('yard gate', 'records side door': no 'the',
  no bearing — the HUD has no compass). It is for a door whose id carries a bearing or a letter and that the room clear structure does not list, or a
  level with no structure; a door with no row keeps the name it had. Every line that names the door then says this name. Words only: it does not move the
  level's fingerprint. Checks: the validator (the door exists, once, the name's length) and `bun run tools/qa/probes.ts words-doornames` (no bearing, no
  two doors of a level called the same, and the list of doors still owed a name — a door named here comes off `DOORS_OWED` in the same change).
- `kitView` — THE TEAM AT THE DOOR, the start page's Team & kit picture (`src/host/kitView.ts`, `src/ui/kitView.ts`; picture only — no rule of the game reads
  it, and a level without the block shows an empty column there: the menu's standing man is `?oldfigure`'s alone): `{ ways[], sets? }`, indexed as the team starts are (`[0]` = the room clear's own
  `team`, `[k]` = its `starts[k − 1]`; never more ways than starts). A way needs only `door` (a door id): the men's slots, the camera and the lamps are worked
  out from that door's frame and the side the team starts on — teammates along the wall 0.7 m off its face and 0.9 m apart from 0.45 m past the jamb away
  from the hinge, Sam across the door, no nearer its middle than 1.8 m (an authored slot for him should keep that too: a door charge's moment goes off beside him
  and dazzles within 1.6 m), and turned onto it, a fourth teammate behind him; a place that is not free floor is stepped over.
  Optional, each laid over the worked-out value: `side` (1 | −1: which side of the door the stack forms on, −1 = the hinge's) · `pin { yaw, pitch, dist? }`
  (radians / metres; the camera is framed on the way's FIVE places whatever the team's size: one framing per way) · `slots [[x, z, yaw°] …]` (up to five: Sam, then the teammates from the door
  outward; yaw 0 = +z, 90 = +x; a WRITTEN stack place — places 1 to 3 — is taken as it is, and the plan says a problem where it is INSIDE THE OPENING (past the jamb the wrong way: the stack stands beside a door or a gap) or INSIDE THE LEAF'S SWING (on the team's side, nearer the hinge than the leaf is wide, within the leaf's stop ON THAT SIDE — the door's `maxAngle` or `minAngle`, whichever stops the leaf toward the team, else 1.92 rad: a door that cannot open toward the team is not asked; nor one whose written `swing` is away from the team), and PAST THE FAR JAMB where it is further the wrong way than the anchor is wide (on Sam's side of it: move it across, or write `side`); `null` holds a place left to the plan, so one man can be written alone: `[null, null, [x, z, yaw°]]` — and a place the plan had to step over, written alone, is no longer counted in "N places stepped over"; the fifth place, the fourth teammate's, is written BEHIND Sam — further from the anchor along the wall, on his side of it: the card switch walks that man round Sam and never across the anchor, and a place nearer the anchor or on the stack's side is a plan problem. A PLACE LEFT TO THE PLAN STANDS AT A WALL: the three stack places and the fourth man's, where not written, must have wall on the anchor's line where they stand — a box that comes down to a man's shoulder (its underside below 1.5 m: a header beam over an open gateway is none; a window is, by its pane or its sill), or another door of the level — and never a box the picture takes out (`hide`, `hideMore`, what the plan sinks for the camera): else "place N … is … m past the end of the wall", mended by `side` or by writing that place) · `light { … }` (any key of `KIT_VIEW_LIGHT`, a lamp's own keys one by one: `porch { }` the key over the door — at a 'gap' span, where nothing stands over the opening, worked out
  onto the wall or post at the stack's end of it (no box where neither end is 2 m tall) — and
  `fill { }` the soft panel out in the yard — kind 0 | 1 | 3, `offset` / `aim` as [along the wall toward the stack, out from the wall, up] from the door's
  middle, colour, intensity (0 = not hung), range, cone, `radius`, `volumetric`, `broad`; the PORCH alone takes `fixture { at, half, glow }`, its glowing
  box, and `day` — its intensity at an HOUR WHOSE OUTSIDE LAMPS ARE OUT (midday, the grey day: `game/hours.ts` `lamps: false`): not written, 0 — a way under the open sky has no porch lamp and no glowing box in full sun, as the level's own `exterior` lamps are out; a way under a roof (the plan's `indoors`) burns it at every hour; `roomLights`; `moonScale` / `skyScale` on a night; `sam { on, intensity, innerDeg, outerDeg, volumetric, aim }` his weapon light) ·
  `roomLights` (0‥1 on the level's interior lights; 0 switches their groups off) · `hide [ … ]` (box ids, or box groups whole, out of THIS picture — WRITTEN, it wins outright: those boxes and nothing else, `[]` = nothing; NOT written, what the plan finds in the camera's way goes, and one that is not a thing — a wall, a box carrying a door or a lamp — is a plan problem. A thing's LOOSE PROPS go with it: a name here is also a prop's id, or the group a prop is OF — its id is the group's name and a dotted tail, `lived.forecourt.stool0` of `lived.forecourt` — and with no `hide` a prop of a sunk box's group within 0.8 m of that box goes too; the plan's `hiddenProps`. A name of something the stand left out of the file — a `lived.*` group under `?lived=0` — is no problem there: it names nothing) · `hideMore [ … ]` (ONE THING MORE, the plan's own list kept: the names here go AS WELL — with what the plan finds in the camera's way where no `hide` is written, with the written `hide` where one is; a piece of the building named here is your word that it goes, and is no plan problem. Write this, not `hide`, when all you want is the plan's list and one thing) ·
  `hidePaint [ … ]` (box groups of which only the paint on the ground goes: boxes under 1 cm half-height — a look file's floor decals, the painted
  marks). WHICH LEVELS CARRY A BLOCK is never written down here: `grep -l '"kitView"' levels/*.json` (the bundled office's is
  `levels/office.scenarios.ts`), or the first line `bun run tools/qa/kitview-plan.ts --quiet` prints. A block is written TWICE where the level has a look twin
  — `X.json` (the start page reads it) and `X-gwot.json` (the picture's own page loads it), the same block to the byte; that tool FAILS a level whose two
  files disagree. `PORT=<dev server> node tools/qa/kitview-page.cjs` stages every way and holds the slots
  to free floor.
  THE PLAN'S KEYS (`src/host/kitViewPlan.ts`: every value below is MEASURED from the level's own boxes where the way does not write it, and a written one
  is taken as written; the picture is STAGED FROM THE PLAN — `src/host/kitView.ts place()` takes the places, the wall's face and top, the lamps, the
  camera, what is sunk out of the picture and the floor behind the anchor from it, on the game's own nav grid). The ANCHOR is `door`, or `span
  [[x, z], [x, z]]` where there is no door: a stretch of blank wall to breach, or the two posts of an open gate — never both; `kind` ('wall' | 'gap' on a
  span, 'door' on a door; absent = measured: wall between the span's ends or open floor). Overrides: `ref [x, z]` (a point on the team's side; absent =
  Sam's start for the way) · `hand` 'left' | 'right' (the side of the anchor the stack falls on screen) · `slotGap` (m: what authored stack slots were laid
  out at; under 1.1 they are spread to it) · `wall { face?, thickness?, top? }` (m: the wall's face from the anchor's line on the team's side, its
  thickness, its top over the anchor) · `lane` (m out from the file: the card switch's) · `out` / `inside` (m of free floor in front of the face / behind
  the anchor) · `pane { box, stand? [x, z, yaw°] }` | `false` (the Glass box a gun is shown through; false = none; absent = the pane the gun row tries first: glass in the anchor's own wall within 6 m along it, the nearest along the wall — the plan says which and how far along, and one far along is a long walk or off the frame: write `false`, or the box. A WRITTEN box is put through the same tests — glass within 0.5 m of the anchor's line, within 6 m along it, its bottom no higher than 1.5 m and its top no lower than 1.2 m: one that fails them is a plan problem, for the gun row would shoot through the doorway instead. `stand` is where a TEAMMATE is stood for the written pane, tried after his own place and before the row's own posts; Sam shoots from his own place or through the doorway. No level writes a box yet: the written pane and its `stand` have never run on a page) · `show [ … ]` (box ids or groups the
  camera's own occluder test must leave standing; a box that tops out under 0.25 m — a drift, a kerb — is never in the camera's way) · `indoors` (the
  men are under a roof: no rain or snow on them) · `keepLights [ … ]` (light groups left lit with the room lights out; 'exterior' always is) ·
  `dayLights [ … ]` (THE WAY'S OWN LAMPS THAT BURN BY DAY — lamp ids or light groups. A way's own lamps — its set's `lights`, its `add.lamps` — are on the
  level's photocell as the porch lamp is: at an hour whose outside lamps are out (midday, the grey day) a way under the open sky has them OUT, each with
  its `fixture` box's glow — all but a lamp with a ceiling or a roof over it, which is a room's and burns; the ones named here burn at every hour. A way under a roof is on no photocell; a lamp of the group `exterior` is the game's
  own photocell's; a name that is no own lamp of the way is a plan problem) ·
  `litInside` true (THE ROOM BEHIND THE ANCHOR STAYS LIT: on a level's own way every room light goes out, so the wedge the picture shows behind the wall is
  black unless a yard lamp reaches it; with this word the groups of the lamps that stand behind the wall's far face and reach the floor a metre in — within
  their own range and 6 m — are kept as well as `keepLights`, written or measured. Not the default: a staged door with a lit room behind it would change) ·
  `add { boxes?[], lamps?[] }` (A PIECE OR A LAMP MORE on a level's OWN way: this format's own box and light records, in LEVEL coordinates, laid in after
  the level's boxes for the picture only — box i of the level is still box i; the mission never loads them. The plan counts the boxes like any box on the
  floor and the lamps' groups stay lit. AN ADDED PIECE IS SHOWN: it is never taken out of the picture for standing in the camera's line — where it
  hides a man, or stands on the line of places, the plan says a problem that names it (`the added 'x' hides the stack: move it`); the way's `show`
  with its name says it stays in front of him, the way's `hide` with its name takes it. Each record gets this format's whole rule for a box or a
  light (a lamp needs its kind, dir, color, range …; its `fixture` may be a box added beside it). Ids new to the level's own records — two ways may
  add a piece under the SAME id (one way is ever laid in); a box's `material` may be look alternatives `'look|plain'` as a set's; never on a way that
  names a `set`. `add.laid` is the loader's own word, never written in a file: the validator REFUSES a file that writes it, true or false — it takes the
  word only from the object the picture's loader made, `kitViewAddLevel`. An added piece is named as standing on the line of places only where it is
  the thing on the place: a place the level's own box shuts is that box's, whatever is added beside it. `tools/qa/lived-check.ts` does not walk a way's
  `add` for floor points, as it does not walk `sets`).
  NAMES: a `hide` / `show` / `pane.box` should name a box's `group` or its own `name` (a named box's id IS its name) — a generated `box_NNNN` id is the
  box's place in the file and points elsewhere when the box order changes; tools/qa/kitview-plan.ts prints a WARNING for one. ONE NAME, ONE WORD: a
  name written in `show` AND in `hide` / `hideMore` is a plan problem (its boxes would go, hidden by name, and its loose props stay, shown by name).
  THE LEVEL'S DEVICES REPORT NOTHING IN A PICTURE: cameras and tripwires are drawn, pan and glow, and call nobody (src/host/kitView.ts kitViewInert).
  A SPAN HAS NO LEAF: on a 'gap' the gun fires on the opening's middle, the light plays with nothing pushed and what is thrown goes straight in; on a
  'wall' only the wall charge plays (the wall is stood again under the dissolve after it); every row that works a leaf — a door charge, the wand, a
  teammate's bang or frag order, the big tool — plays the GUN's there. Throws and the spot a round is put on are held to the floor measured behind the
  anchor (`inside`). The stack's `hand` mirrors the child's own framing (door / left / right) — a way whose stack falls on the right needs nothing said.
  EVERY WAY ANCHORS ON A DOOR THAT IS NOT STEEL (10-18; tools/qa/kitview-plan.ts section C fails any other way, tools/qa/kitview-work.cjs holds the page
  to it): a pick whose kit works a leaf — the hammer, the breaching shotgun, a door charge, the wand, a bang or a frag on order — played the gun's row on a
  span or a steel door, and on a blank wall the gun only scanned: the picture stood still for that pick. A mission whose own way in is a gate, a gap or a
  wall writes the first door behind it (`ref`: the side the picture is taken from, when that door is another way's too), or a set with a door in the wall
  the stack stands on (mousehole's `ward`: the wall charge still opens the wall beside the door — `KIT_VIEW_LOOP.wallAt` is measured along the stack's wall).
  ANY KIND of mission may carry a block: a way on a set is always staged as a room clear of the set; a level's own way is staged by the mission's own
  kind (room clear, rescue, night breach; a quiet mission and the solo night with their own men: Sam alone, or Sam and his partner). A level
  with no block shows nothing in that column.
  A BESPOKE SET: `sets { <name>: { boxes[], doors?[], lights?[], ref [x, z] } }` in THIS format's own box / door / light records — a small stage of the
  level's own materials (by name: a look file's set wears the look — a set box's `material` may be ALTERNATIVES, `'look|plain'`: the first name the
  file's palette holds, so one block text serves a level's plain file and its look file) that the picture loads INSTEAD of the level's geometry; a set's
  own lamps stay lit (`roomLights` is 1 on a set way unless written; 0 on a level's own way); world metres inside the
  0‥40 × 0‥28 floor, bringing its own ground; `ref` = a point on the team's side of its anchor. A way names one with `set`; its `door` / `span` /
  `slots` / `hide` are then the set's, never the level's (the validator holds a set way's door to the set's doors). Under `?kitview` and nowhere else
  `src/host/kitViewSet.ts kitViewSetLevel` lays the set over the file before `loadLevel`: the set's boxes (index for index), doors and lamps; the level's
  name, materials, surfaces, sky, daylight and directional lights (the `moon`) kept; everything else of the level gone, with stand-ins for what any level
  must have (two sunk breaker boxes, the three objectives, a one-room `roomClear` whose team is the plan's five places). A way with no set is the file
  untouched. `bun run tools/qa/kitview-plan.ts [level …]` checks every block statically (the plan AS THE CHILD MAKES IT — two passes: what stands in the camera's way is sunk before the places are planned — has no problems, five places on free floor, the
  anchor real, the way in walkable on the nav grid's cells, a set loaded as the page loads it passes this validator) and prints the dry run of every
  mission's way in; `KITPLAN_BREAK=1` must fail. ON THE PAGE: `PORT=<dev server> node tools/qa/kitview-levels.cjs` (`LEVEL=a,b`, `WAY=n`) runs the same
  generic rows on every level-way with a block — it knows no level: five men on the plan's places on free floor, every tile's row from pick to everyone
  home and the world whole, throws beyond the anchor's line, a cut mid-row, `pins` 0, a silent console; `KITLEVELS_BREAK=1` must fail.
  SHAPES TO COPY FROM — examples, not the list of levels with a block (that is the grep above): a door with every place written, `records` (below);
  a door INDOORS with its own lamps off and the room's left lit, `block` (the kitchen door off the hall); a SPAN of blank wall on a set, `mousehole`
  way 1 (`ward`: the clinic's street wall), beside the level's own door as way 2; ONE SET FOR BOTH WAYS, `pass` (`gate`: the wicket in the truck gate
  under its lamp).

A NEW LEVEL is a generator, like the office: `tools/levels/<name>.ts` exports `NAME`, `NOTES` and `build() → { level, scenarios, groups }` built with
`officeGen.ts officeKit()` (the office's own walls / doors / furniture / lights / palette), and `bun run tools/levels/export.ts <name>` writes
`levels/<name>.json` (refused unless it validates and reloads to the same Level; `--check` = stale test). `tools/levels/test-rooms.ts` is the worked example.
Play it with `?levelFile=<name>.json&roomclear[=seed][&squad4]` or `&rescue` (the dev server), headless with
`standUp({ level })`.

**`scenarios.snatch`** (`SnatchData`, read by `src/game/snatch.ts` and by nothing else; a level without it is the room clear as it was): one unarmed man the
team has to take alive, laid over the level's room clear. `man {name, pos, face, tint, tint2?, points?, wait?}` = who he is and the marks he keeps to while the
floor is quiet; `exits [{name, pos}]` = the ways off the floor he runs for once it is loud, his NEAREST by walking first (the export's check says so if it is
not) — on one, he is gone and the mission is failed. At least two, so one can be covered while the team goes in by another. `levels/snatch.json` is the level
built for it; `bun run tools/qa/snatch-check.ts` holds the rules. `van? {name, pos}` = the team's own vehicle by its way in, `pos` the spot at its open doors:
while `SNATCHOUT.on` (`src/game/snatchout.ts`) the man, once tied, is led there by the player and the mission is won when he is in it, the house taken or
not (`bun run tools/qa/snatchout-check.ts`). Without the key the snatch ends as it did.

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
`device:<id>` `floor:<id>` `mark:spawn` `mark:<objective id>` (bare ids are boxes). **Mouse**: click selects (shift toggles; double-click = the box's switchable /
group) · press-drag ON THE SELECTION moves it on the floor (Alt = vertical), press-drag anywhere else = marquee (the floor is always under the cursor:
click first, then drag) · RMB orbit · MMB or Space+LMB pan · wheel zooms about the cursor. **Keys**: `G` move · `S` resize (six face handles on the
selected box) · `R` rotate (a yaw ring; Ctrl = 15° steps) · `B` box footprint (preset from the palette; walls run along the longer drag side at
their fixed thickness; a click drops the default size) · `V` volume footprint · `L` light at the cursor (preset height) then drag its **aim** dot ·
`D` door: press at the hinge, drag along the shut leaf (snaps to 90°, Alt free) — with *cut+frame* on, the wall it lands in is split into runs +
lintel and the frame (jambs, head, stops) is built · `P` route: click waypoints, Enter / double-click finishes, Backspace drops the last · `T` plan ·
`F` frame · `X` snap · `O` grid · `H` hidden (NoPrimary) boxes · `N` day/night (data.daylight) · arrows nudge by the snap (Shift fine, Alt / PgUp /
PgDn vertical) · `Del` delete · `⌘/Ctrl Z` `⇧Z`/`Y` `D` (duplicate) `S` (save to server) `A` (all boxes on the floor) · `` ` `` hides / shows the right-hand panel (no key steps the debug views: they are the *view* list in the top bar's second row) · `[ ]`
exposure · `M` the Materials tab · `K` (a box selected) its Markings tab · `Esc` cancels the tool / clears. Deleting refuses what is still referenced (a door an objective / plan uses, the breaker's boxes, a
floor with things on it — boxes, props, doors, volumes, chokepoints, devices, civilians or a connector end, one `FLOOR_USERS` table in levelData.ts for delete / rename / lint —
the mission marks); a box's switchable forgets it (and goes when emptied), a light's fixture pointing at it is cleared; renaming a keypad takes its door's `lock` with it.
Every multi-op verb runs in `doc.transact`: an exception half-way rolls the whole verb back (nothing half-done in the document, nothing on the undo stack). Resizing a
MARKED box (any write to its `h`: the S handles, the sheet's size row, `__ed.box.resize / size / update`) re-fits its markings into the smaller / larger faces in the same
command (bitmaps cropped top-left when they must shrink) and drops — with a line in the problems panel — only a marking whose face no longer takes one cell.

**Save / load**: *save ▾* download `<name>.json` · POST to the dev server (⌘/Ctrl S: the file the document was LOADED FROM — `Editor.file`, shown on the level sheet — or, for a document from nowhere, `levels/<data.name>.json`, asking before it replaces a file that exists; the repo file changes, and on a GENERATED level a re-export overwrites it) · autosave
(localStorage `twopointsix.editor.autosave`, every 30 s while dirty + on unload); *load ▾* file picker · drop a `.json` on the view · the
autosave slot · a blank level · the bundled office · the server's `levels/`. The RESTORE paths (`#autosave` at boot, *load ▾ autosave*,
`__ed.save.restoreAutosave()`, `__ed.load(text, {lenient: true})`) open a document that PARSES but does not VALIDATE — its problems listed in the problems
panel, `ed.loadErrors` — instead of refusing it; a `#autosave` boot whose slot is not a level at all keeps the office up as a stand-in and HOLDS the timer's
and the unload's writes until the first edit (`persist.ts AutosaveSession`), so a session is never silently replaced and then overwritten. **Play from here**
writes the document to localStorage `twopointsix.editorLevel` and opens the game with `?level=local` + the keys of the mission the document carries
(`persist.ts playChoices / playDefault`: the list beside the button holds the plain night and each mission of the document's `scenarios` block — `&roomclear`
(+ `&squad4`), `&rescue`, `&quiet` (+ `&squad=1`), `&nightbreach`; the default is the mission list's first row for the file, and for the office the plain
night). `/?level=local…` from the dev server's `/workbench`, `index.html?level=local…` from a built page (the dev server forwards `/index.html` to `/`). The
game's side of it is `buildLevel()` in `src/scene/level.ts` (read it there: the stash is parsed and validated, a document of the office family gets the
office's script and scenarios, anything that fails falls back to the bundled office with a console error — and `main.ts` falls back again if the Game
cannot be built on it, `bootedLocalLevel`).

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
