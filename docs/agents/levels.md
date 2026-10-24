# Levels and the look

One of the area files CLAUDE.md indexes. Everything below was moved here word for word from CLAUDE.md on 2026-10-13, in its old order;
"the bullet above / below" in a bullet means its neighbour there (each block says which lines it was), and a bullet named by its bold
title may now live in another file of this folder: `grep -l '<title>' docs/agents/*.md`. New bullets for this area go at the foot of this file.

<!-- was CLAUDE.md lines 620–692 -->
- **The level is data** (`levels/office.json`, schema `scene/levelData.ts` LevelData v1, docs/level-format.md). `buildLevel()` loads it
  (validate → `levelLoad.ts loadLevel`, every vector copied, box ORDER preserved, id refs resolved to indices); the game never sees ids —
  tools / the editor keep the LevelData as the document and use `indexLevelData` for id → index. To CHANGE the level while the legacy
  generator (`scene/officeGen.ts buildOfficeProcedural`) still exists: edit the generator, `bun run tools/level-export.ts`, commit both
  (the export refuses a file that does not reload to the same Level; `probes.ts level` = generator vs JSON 0 diffs + validator + round
  trip, and `tools/level-export.ts --check` says stale/not; `level-identity` runs AS THE EXPORTER RUNS, on the engine's maths on every
  stand — `tools/qa/headless.ts asExporter` — because the exporter raises no stand: under the game's own maths, `math/exact.ts`, the
  generator's sin / cos round one quaternion's last bit another way, which it prints as a note and does not gate). Hand edits to the JSON are legitimate but make `level-identity`'s "not stale"
  line fail until the generator is retired (lane G1b) — say so when you do it. Flags in the file are names (`NoPrimary NoShadow Cutaway
  Gloss`); runtime bits (Emissive / AreaLit / Rot / Dynamic) are never authored. Unknown keys are validation ERRORS (one `KEYS` registry in
  levelData.ts feeds both the validator and the canonical form — adding a field = interface + KEYS + both directions in levelLoad.ts); the drill
  plans (`plans.*`) are the exception: typed by reference to RoomClearPlan / BreachPlan and carried generically, so re-choreographing the breach
  needs no schema change. A lane that edited the OLD level.ts body: apply its hunks to officeGen.ts and re-export (recipe in docs/level-format.md).
  `game/floor.ts` reads a level's footstep map from its file's `surfaces` block (`Level.surfaces`, non-enumerable; a generator's `build()` may return one); a file with
  none gets the office's map, which floor.ts still carries and `level-validate` asserts equal to the office file's block. Nothing in the
  office was random, so the export froze nothing.
- **Scenario data travels with the level** (`src/scene/scenarios.ts` `LevelScenarios`, `Level.scenarios`; docs/level-format.md *Scenarios*; how-to
  rebuild/scenario-levels/contract.md): what the night breach, the room clear (pair or four) and the hostage rescue take from a level — rooms,
  doors, defenders' marks, the team's start, hostages / captor / door man / roamers, the rescue's route — is a `scenarios` block in the LEVEL FILE, read by
  roomclear.ts / nightbreach.ts / rescue.ts / rescueflow.ts and by nothing else. The office's file has none: its tables are `levels/office.scenarios.ts` (pure
  literals — imported at the top of the game's import cycle, so keep it that way), attached non-enumerably by `withOfficeScript` to any `office` / `office-*`
  level; `STRUCTURE` (roomclear.ts) and `SIDE_MARKS` (rescue.ts) remain as the office's data under the names its probes import, and the team-start knobs
  (`NIGHTBREACH.samAt / samYaw`, `RESCUE.samAt / samYaw / opsAt`) are the office's until `start()` on another level writes that level's (once per team-start
  object: a knob moved by hand afterwards stays moved). A level with NO `plans.breach` stages the room clear without the F drill (`NightBreach.noDrill`: the
  structure's `team` gives the start, every teammate is the order menu's). New levels are generators over `officeGen.ts officeKit()`:
  `tools/levels/<name>.ts` → `bun run tools/levels/export.ts <name>` → `levels/<name>.json` (`test-rooms` = the tiny test level), played with
  `?levelFile=<name>.json&roomclear[&squad4]` / `&rescue`, headless `standUp({ level })`. QA: `bun run tools/qa/scenario-level-probes.ts levels/<name>.json`
  (data checks — validate, `checkStructure`, `checkRescue`, the route — then each scenario staged, walked and finished under a plain scripted player) and
  `probes.ts scenario-levels` (that on test-rooms). Still office-only by constant: weather INTERIOR / ANNEX, chronicle ROOMS, QRF_MARKS (only with `RESPONSE` off — on, the team's places are the level's own `scenarios.response`: enemies.md), NEED_SPOTS, CIV_SPOTS,
  the rescue flow's +x corridor.
- **The default look = 2010s GWOT** (`src/scene/look.ts`, `LOOK.on`: ON in the page — `?look=plain` (or `?look=0|off`, `?nolook`) = every level and man as before; OFF in the module and on
  the frozen harness stand, `TPS_LOOK=1`; one of `FROZEN_HOLDS`' rows, in the knob registry; what the game looks like as a whole, as rules to hold new work to: `STYLE.md` at the repo root). LOOK ONLY: headless no run differs by it (on the page the repainted walls bounce other light into the GPU meter, so a sighting can differ between a level's two files). LEVELS: `LOOK_LEVELS` names the levels that have a SECOND FILE
  in the look (fourteen: compound, barracks, warehouse, depot, registry, block, block-squads, records, consulate, defuse, floodlit, mousehole, killhouse, hall → `levels/<name>-gwot.json`; the table is the list, not this line); `lookLevelFile(file)` is what the page (main.ts) and playthrough.ts load, falling back to the plain file if
  the look's is missing. A look file = the plain file box for box (same index, centre, size, yaw, flags, group, markings) in other PAINT + NoShadow decals appended in group `'look'`
  (`tools/levels/gwotSkin.ts skinLevel` over the plain generator: `tools/levels/<name>-gwot.ts`; `bun run tools/levels/export.ts <name>` writes and `--check`s BOTH files together).
  EACH LOOK FILE IS ITS OWN PLACE (the overnight polish, 10-10): one family of ground marks a level and AT MOST one accent hue (the registry has none, on purpose: it is told by its floor), none shared — compound = a farmer's walled
  house (blue doors; the household on the ground: plot, drying sheets, cook fire, chalk game), warehouse = a bonded customs shed (yellow / black; lane lines, hazard
  bands at doors, numbered doors, pallet squares with tallies), barracks = a police battalion's lines (green; a volleyball court, formation marks, a worn diagonal,
  tally bars at the numbered bunk rooms' doors), depot = an old army motor pool (oxide red; lettered doors A B C, an inspection pit, parking bays), registry = a
  provincial records office (no accent; floor tiles, a red line to the registrar and a blue one through the stacks, row numbers), the block (both files, one skin: `block-gwot.ts SKIN`) = a district telephone exchange (pistachio gloss; cable trenches as chains of 1 m cover plates through the rooms, a painted lifting plate every fifth, a rimmed chamber cover where the trunk branches), records = a district land office (surveyors' magenta, on the ground only; a traverse round the building, a triangle station at every pane with its sight line, a bench mark at the locked door, practice plots pegged out in the lot), consulate = a town house consulate (plum carpet bound in brass — the plum a colour of that file's own, decals only; a roped lane's sockets and a star in the lobby, a runner down the corridor, the hall carpeted wall to wall, a brass sill in every opening; cut from the registry's plan, so it paints rooms where the registry paints routes), defuse = a bomb maker's house (the firing wire's copper; a twin lead along the floor from each bench to one battery plate in the hall, a painted 1 and 2 at the workshop doors), floodlit = the fuel post of a bush airstrip (aviation orange; a landing pad's ring and H in the yard, approach chevrons in through the gate, a wind tee), mousehole = a district clinic (teal; the queue: a dashed line down the corridor to a 'wait here' box under the hatch, a standing square at each room's door, a cross on the porch), killhouse = a training shoot house on a forward base (the range's violet marking paint and white engineer tape; a start box at every way in, a numeral and a clear line at each held room's door, a firing line at the targets), hall = a border scouts' company wing (pale sky blue; the range card painted down the hall: a firing line, a distance line every five metres, the two limits of the far guns' arc) — in those five no wall wears the accent: it is a colour of that file's own that only its ground decals wear, the outside door a darker shade of it (`LOOK_DOORS`). The marks are
  `tools/levels/lookMarks.ts lookMarks(T)` (seg / path / dashed / outline / fill / hazard / checker / glyph / word / tally — a 3 × 5 font for 0‥9 A B C N S), every
  one a floor decal through the skin's own `T.flat`. `Skin.rooms` names MORE rooms for the dado and rug rules than the scenarios do (they list held rooms only: a
  dressed room would mark a held one), `Skin.noRug` holds the automatic rug off.
  THE SIMULATION READS PAINT (particleFx.ts `paletteName / surfOf`, furnblast.ts `breakClassOf / steelGrey`, the destruction / wallbreak / furnblast shape indexes, the wet lot), so every GWOT
  paint on a repainted box STANDS FOR the office paint or surface it replaced: `src/scene/gwotPalette.ts gwotAs(mat, sim)` codes the stand-in as a ≤ 0.0024 shift of the albedo and
  `gwotSimOf(albedo)` reads it back — a new classifier of paint in the game must ask `gwotSimOf` first, as those two files do. THE KIT for new levels: `src/scene/gwotKit.ts gwotKit(...)`
  (walls, parapets, gates, HESCO, drums, cots, rugs, lanterns, wash lines … flat colours, boxes only) + `GWOT_MATERIALS`; the showroom `levels/gwot-yard.json` (`tools/levels/gwot-yard.ts`,
  `?levelFile=gwot-yard.json&solo&hour=midday`); the one-page guide is rebuild/play-style-levels/look/read-first.md. QA: `probes.ts look` (tools/qa/look-check.ts, in
  all-quick: the palette has no clashes and no other level carries one of its colours; per pair — both files fresh, boxes equal but paint, repaints classify the same, extras are decals,
  props the same bodies, the three destruction indexes list the same boxes, the wet lot reads the same, every other key equal); whole-run identity = `PT_DIGEST=1 PT_DESTR=1
  tools/qa/playthrough.ts --scn <name>.json` against `--scn <name>-gwot.json`. Not following the switch: the other tools/qa level loaders (they name a file and get that file). Seen only on
  the software adapter. FLAT DECALS THAT CROSS ARE 0.7 MM APART (`tools/levels/flatLayers.ts`, `FLAT_STEP`; the maintainer, 10-11, on the block: "seeing some zorder issues on the floor"): the skins used to tell two crossing floor decals apart by 20 µm, under one step of the depth buffer at the camera's own 21 m (depth32float, near 0.5: about 1.2e-7 × z² m a step — 52 µm at 21 m, 190 µm at 40), so on a GPU every pixel of an overlap went to either paint; `skinLevel` now ends on `layFlats` (two flat decals of DIFFERENT paint that overlap on the plan, or a decal and a thin flat of the level itself, have their tops ≥ 0.7 mm apart, the order the skin wrote kept, nothing moved down, no centre across a centimetre so a checkpoint's level fingerprint is the same), `export.ts` prints how many it raised, and `probes.ts look` holds it per look file (`LOOK_BREAK=1` must fail). A new site that lays a floor decal needs no height of its own beyond the ORDER it wants. EVERY LEVEL'S OWN FLOOR IS SWEPT TOO (the maintainer, 10-11, on Training 3: "more bad zsorting in tutorial level" — the gravel court and the generator slab lay over the yard's dirt with all three tops at 4 mm): `tools/levels/export.ts` runs `flatLayers.ts layFloor` over every level it writes, before the look's skin — everything drawn whose top face is at the floor (ground finishes, mats, floor decals; `isFloorFlat` / `atFloor`), in TIERS (the generator's boxes, then its lived things, then the dressing: a later tier never moves an earlier one, so a level with its furniture or dressing left out is the same level), a SOLID finish raised by growing 0.7 mm thicker with its underside where it was, a decal lifted whole; `isFlat` and the skin's `under` reach 5 cm up now (marks laid on a carpet). `bun run tools/qa/floor-order-check.ts` (`probes.ts floororder`, also under `look`; `FLOOR_BREAK=1` must fail) holds it in EVERY level file, the office's included. A re-export that moves heights wants its commit at the front of `tools/qa/lived-check.ts`'s base revisions (the levels owner's list). The class's real fix is a reversed depth buffer — the renderer's, not done. A SKIN'S DECALS ALL START AT THE FLOOR (rugs, patches, wear at every door, the damp foot + the strip of ground along an outside wall, a painted dado in
  lived-in rooms; `skinLevel` throws and `probes.ts look` is red on one that does not): wallbreak.ts lets a drawn-only static that hangs OFF the floor fall when what it touches breaks
  (debris, a sound — a run would differ), and never asks one that starts at the floor. A decal on a wall's face is hidden with its wall when the wall is holed by `src/scene/lookTidy.ts`
  (called once a frame by main.ts; picture only; whole with the wall's box, on any level that carries one of the look's paints and no other). The same file has the look's two other page-only passes: a GROUND decal goes wet and dry with the
  ground under it (the storm soaks the lot in place and knows nothing of decals: render-only `Box.wetK` + the ground's finish, `albedo` never written), and `lookDoors` (once, after the game stands,
  under the switch) repaints the door LEAVES of a level that wears the look — outside doors in the level's accent paint (its row in `look.ts LOOK_DOORS`, keyed by the level's own file; without a row the accent is counted off its boxes among blue / green / oxide red, army green where none), inside ones weathered wood or the row's `in`; steel doors and the office are left alone. Wear is the ground's own colour darker (`SkinTools.tone(floorAt(x, z), k)`), never paler; THE PALETTE'S GROUND IS DARKER THAN ITS WALLS
  on purpose (midday exposure flattens earth tones: `gwotPalette.ts`'s ground comment), and a repaint of an unnamed non-steel box must not be a plain grey or white (`steelGrey` would
  make it a steel cabinet — the skin's check throws). THE MEN'S DRESS FOLLOWS THE PLACE (the maintainer, 10-10: "middle eastern enemies also don't make sense for the office level"): on the OFFICE family the page boots the FIRST cast file and tables with the look on (`look.ts setLookPlace(placeOfQuery(q))` in main.ts before the cast is fetched; `lookDress()` = what `castFile()` / `charMatsOf` / `charMatsVersion` ask, `lookOffice()` = `cast.ts officeDress`: of the first cast's defenders only the ones dressed for a building — no straw hat, boonie, bandana, bandolier or vest top), the sneaking suit as on any level; not a knob, and everything headless leaves the place true (`probes.ts cast-look` holds both). THE MEN: a second cast file `public/assets/chars/cast-gwot.gltf` (`tools/chars/build_cast.py --look gwot`; `gltf.ts castFile()`
  picks by the switch — helmets and plate carriers, pakol / turban / shalwar kameez) and `charMaterials.ts CHAR_MATS_LOOK` (`charMatsOf(side)`: MultiCam-toned operators with small pair
  markings, defenders in muted local dress); dress only — weapons, goggles and kit are the gear part's (`GEAR.on`). THE SNEAKING SUIT (`LOOK.suit`, on with the look; `?suit=0` / `?nosuit` = the issue dress on every mission; the maintainer: "sam should also be in a black sneaking suit in stealth missions (probs not loud ones)"): `src/game/cast.ts sneakSuit(g, c)` — THE one predicate: Sam, and a quiet mission's partner, on any mission that is NOT a squad's loud one (`scenarioRun.ts activeScenario` null or 'quiet': the quiet missions, the plain solo night, Training 1–4 and 7; a room clear / night breach / rescue = the issue dress) — is drawn without the helmet, the back kit and the mesh goggles (`anim/gltf.ts castSuit(cast, mask)`: parts named `helmet` / `kit_*` dropped — the cast has no free part, so the suit IS the operator's own `op_suit`: uniform, vest, boots; `sdfrig.ts fitRigCast` solves those masks ahead of play with the rest) in a third set of rows, `charMaterials.ts SNEAK_SUIT` (one matt black; `charMatsOf(side, suit)`, a trailing `suit` on `slotAlbedo / writeCharPalette / describePalette`; the per-man cache in charLook.ts keys on it; `__charmat.tables.suit`, `__charmat.get('sam').suit`). Asked every frame; looks only (`probes.ts cast-look` holds the parts, the rows, loud vs quiet, both switches; `charmats-off` holds the suit off to ask about the side's own table). Not followed: `?nocharmats` (parts only, his raw tint), the viewer. THE SUIT'S RIFLE IS BLACK (the maintainer, 10-10: "would expect a blacked out rifle build for stealth loadouts"): `rigProps.ts RigOpts.rifleBlack` ← combat.ts handProps asks `sneakSuit` — the 2010s carbine's dark earth stock, grip, handguard, post and laser box are drawn in the bullpup's black polymer on a man in the suit, in his hands and on his back; a loud mission's rifles keep the tan; colours of five boxes only (`cast-look` holds both, and that not a box moves); the dropped `M4_ITEM` is not followed. Known: the box goggles and their mount arm were placed for a helmet's brow and sit on the hairline of a bare head; a pair in the suit differ only by face and shoulder patch. `probes.ts cast` / `charmats` hold both looks (`TPS_LOOK=1`).
- **Lived-in rooms** (`src/scene/lived.ts`, ONE switch `LIVED.on`: ON in the page — `?lived=0` = every level as it was — OFF in the module and on the frozen harness stand; `TPS_LIVED=1` in
  front of ANY bun tool raises it (the module reads the env itself, so a tool that only parses a level file follows it; headless.ts pins it with the other stand words); a `FROZEN_HOLDS` row, in the
  knob registry, a journal's `env.lived`). The maintainer, 10-10: "the office level is awesome and it has a lot of personality per room, we should makes sure all levels are like that". What furnishes
  a room of another level as the office's rooms are furnished rides in the level FILE and `levelLoad.ts` leaves it out with the switch off: a BOX whose group is `lived` or `lived.<room>`, a PROP,
  LIGHT or SWITCHABLE whose id starts `lived.`. OFF = each level box for box, prop for prop, light for light as before there were any (nothing kept moves index, nothing kept may name a lived box);
  ON is real furniture — cover, things to walk round and to break — so it is NOT the off game by digest. `tools/levels/export.ts` holds the file's rules: lived things are the TAIL of the generator's
  boxes / props / lights / switchables, and the dressing (dress.ts) is dealt as if they were not there, appended after them ([generator, lived, dressing, look decals]). Each level's lived things
  are written in that level's own generator; the yardstick (what the office does per room), where furniture may not go and the budgets: rebuild/play-style-levels/rooms/read-first.md.
  A checkpoint does not cross the switch (the fingerprint counts boxes), as it does not cross the look's. The look's skin repaints the furniture with everything else and deals its DECALS as
  if it were not there (gwotSkin.ts `bare`), so a look file with the switch off is the old look file too; the exporter refuses a kept thing that names a lived box (fixtures, the
  breaker, beacons) and a lived thing standing IN the dressing; the level editor, its lint and its swing deal load the whole file (`lived: true`), as the probes that hold a file against
  its generator do. QA: `bun run tools/qa/lived-check.ts [level … | path.json] [--sheet] [--base <rev>|none]` (none named = every level that carries a lived thing): the file without its
  lived things is the base's (the level's own row in `LEVEL_BASE` in the tool, else `BASE_REVS`) key for key and loads to the same Level; with them every authored point (starts, marks, pods, waypoints, deals) keeps its floor, every mark's aim line
  stays open, nothing solid within 1.1 m of a door's line, no floor cut off from the spawn, no walk between authored points more than 30 % + 1.5 m longer; `--sheet` = what each room got.

<!-- was CLAUDE.md lines 2303–2306 -->
- **A roof over walkable floor is the kit's ceiling** (a LEVEL RULE, no switch): `K.ceiling` (levelKit.ts `ceiling()`: a slab flagged `NoPrimary`, so the camera sees the floor under it) or a slab
  flagged `NoPrimary` by hand — and, if rain should stop at it, inside `weather.ts roofsOf`'s height band: underside at `WORLD.ceilingY` − 0.25 (2.75 m) or over, top no higher than + 0.45, at
  least 0.9 m across both ways (`roofsOf` asks only height and size, never the flag: a DRAWN slab there stops the rain and hides the room). Floodlit's generator shed had the one drawn roof
  in fifty levels (the levels owner's count).
- **A dado stops at the door's jambs** (level data, no switch; the maintainer, 10-13, on the quiet lesson: "weird box in front of door in duo stealth mission"). `train-silent`'s watch house
  had its rust-red paint band (`G.dado`, a 1.1 m NoShadow decal on the wall face) written around a gap centred on the hut door's `at`, but `at` is the opening's LOW end
  (`tools/levels/train-ground.ts` hut doors), so the right-hand piece ran 0.58 m across the 0.86 m doorway and read as a slab standing in it. `tools/levels/train-silent.ts` now paints
  24.7‥26.3 and 27.2‥28.5 (the fitted doorway is 26.3‥27.2); the regenerated json moves two boxes only. Checked headless: export `--check`, level-lint, quiet-check, lesson-check,
  door-size ALL PASS. NOT mended, same class, the levels owner's: `crossing.json box_0069` (a 0.38 m mudDark skirt across door `gate_ne`) and `glasshouse.json box_0059` (the same across
  door `back`); `level-lint` has no decal-over-doorway rule, which would have caught all three. Never seen on a GPU.
- **The depot and the block are authored floors, one problem each** (10-13; `tools/levels/depot.ts`, `block.ts`, `blocksquads.ts` and their look twins; ids, rows and file
  names kept; no switch: it is level data, so saves and F7 / F10 recordings of the old floors are refused by fingerprint). Each generator's head comment has the problem, the hand
  placement and why, and the measured table; the page is `rebuild/authored-levels/depot-and-block.md`. THE HAND PLACEMENT is seed 0 = each room's first `garrison`
  marks in file order (the block's marks ARE its garrison, so it has no dealt floor). DEPOT: "the signals hut and the store's hatch hold the lit yard in a crossfire from the dark,
  and the hut's own door and the mains are at its back"; its check is `probes.ts depot` (45 verdicts a stand, `DEPOT_BREAK=1` fails), which judges the yard by the PLACE's own
  light (`lightEstimateAt(g, P, () => true)`: under the dark rule a slit man burns his lamp across the park when the mains go) and sweeps the unheld rooms. BLOCK: "every held room
  turns a corner, and its men are round it"; four L rooms, two men in each far leg, a lit notch room with the room's other door; block-four is ONE STAY-PUT SQUAD A ROOM
  (`BLOCK_SQUADS_HOLD`, `mayLeave: false`: as one pool on hard most of the eight walked out to the first shots), block-squads keeps three squads and a third man in each near leg;
  the block has no check of its own. MEASURED (the scripted commander, the one floor, 12 seeds, shipped stand, men up of 48, the build with the dark rule): depot standard / hard —
  obvious 4 / 7, round the back with the mains cut 32 / 41, the same with the lights on 23 / 27, the workshop 48 / 40 (FREE on standard), second start obvious 16 / 13; block (hard =
  standard run for run) — hall doors 0, round by the other doors 41, lights out then hall doors 13 (24 before the dark rule), lights out then round 41, second start round 37,
  a wall charge 7, thresholds 8. KNOWN: the block's lights-out answer is weak since the dark rule; the depot's workshop way is cheap. Checks keyed to the OLD block floor are red
  until their owners follow (enemysquads, corridor-check, wallsafe / wallcharge-squad / -standoff, wallreact, words-doors, cues-run, levers-rules wants `squads: true` on
  block-four's row, loudchaos-levels, the scenario-level probes' "it can be won"). Never seen on a GPU, never played; software stills only.
  Since then (10-13): block-four's row says `squads: true`; both floors got paper and a racking bay so `loudchaos-levels` passes (play identical run for run); and
  `tools/qa/scenario-level-probes.ts` has a table of three files, `TRAPPED` (depot, block, block-squads): its commander walks only the obvious plan, so there
  "walked" asks that the team left its marks (where it fell is printed) and "it can be won" is NOT ASKED (the answers are tallied with playthrough.ts routes; the pair
  is not these floors' team). `TRAPPED_BREAK=1` must fail. Every other level's lines are as they were.
  THE MESS TABLE (10-13, later): with the lived rooms on (the page, the shipped stand; `TPS_LIVED=1`) a stack of three or four on `m_s` FROM INSIDE the mess
  was refused 'no room on that door' — the long table stood on the west wall, on the file's marks. It is a shorter table now, in the near leg's far corner
  (z 4.5‥5.7), a nav cell clear of the squads file's third man (11.7, 6.5) and of the coats on the rail; lived things only, the bare level and the frozen
  stand are untouched. The check: `bun run tools/qa/lived-stack-check.ts block-four,block-squads` (was FAIL 2 of 128, now PASS; it is in no gate — run it
  after moving any lived furniture). What moved with it: `m_k+` deals two men (17.27, 8.25) (16.67, 8.85), one hand, where it split the jambs (the glass
  rule: nobody can stand in that corner and shoot through the hatch now). MEASURED old floor → new, same code (9165eaf3), Hard, shipped, seeds 1‥12, won
  of 12 · men up of 48: hall doors 0 · 0 → 0 · 0; heel doors 12 · 34 → 12 · 31; the dark then the hall doors 9 · 14 → 8 · 10; second start, heel doors
  12 · 38 → 12 · 35; block-squads heel doors 12 · 37 → 12 · 32. The falls that differ are in OTHER rooms' notch rooms (the frame room, the jointers'), so
  this is the run parting after the mess, and twelve seeds cannot tell it from noise; the same sign in every arm is said, not explained. (The numbers
  above this line are 3159ad70's: the build since moved the heel doors 41 → 34 before this change.) A STALL TO KNOW (not a red on
  the newest join): on one join with the build (f66c870b) `scenario-level-probes levels/block-squads.json`, shipped stand, failed "finished" — seed 2's
  team lived through the mess, cleared three rooms and ran out the clock, the workshop's last man (Bravo may leave its rooms) standing in the SWITCH ROOM
  at (26.7, 18.5) from 60 s on, where that commander never looks. One build join later (64504143) the same three seeds end and the check is ALL PASS on
  both stands. Not the table (the old floor's seeds are wiped before they get that far): a man of a squad that may leave can park in a room nobody holds.
  Never seen on a GPU, never played; the page booted on the software adapter.
- **'(OLD floor)' after the block's name in these files** (10-13, the docs tidy after the rebuilt block was named, steps 219 / 220) = that figure, hold, door or mark was measured
  or staged on the block as it stood BEFORE the rebuild and has not been taken again: the six-hold lane figures and the standing-team table in enemies.md, the wall charge's marks
  in destruction.md, the door order tallies in door-tools.md (`mb` is gone; `m_s` is another door now), the pairs-by-door figure in team-feel.md. Tagged where the block's owner
  listed a line; an untagged block or depot figure dated before 10-13 is the old floor's all the same (the depot was rebuilt too). Still true of the rebuilt block, checked
  against `tools/levels/block-gwot.ts`: the look bullet's telephone exchange (pistachio, cable trenches as cover plates, a lifting plate every fifth, the chamber cover). TWO
  CHECKS THE TAGGED LINES NAME were red on the rebuilt floor when the tags were written (968d8756: `probes.ts corridor` on shipped, its hold on block-four drawing nobody;
  `probes.ts wallsafe` on frozen, two lines) and their owners have re-staged both since: on the build of 8c2c7cea (10-13) corridor is ALL PASS on both stands — it holds
  `block-squads` now, see enemies.md — and wallsafe is ALL PASS on frozen. The tagged FIGURES are still the old floor's; only the checks moved.
- **The level check plays the level's own marks too** (`tools/qa/scenario-level-probes.ts`, 10-13; tests only, no switch). The room clear parts (`pair`, `four`)
  default to seeds `0, 1, 2, 3` (they were `1, 2, 3`): seed 0 is the hand placement the page deals on every load (`game/samestart.ts`), 1 to 3 are dealt floors
  of the same file. The rescue part keeps `1, 2, 3`; `--seeds`, when given, is taken by both. A seed is the placement AND the run's die, so the page's floor is
  ONE run here and 'it can be won' can still pass on a dealt floor alone; the page's floor over many dice is a tally's job (`PT_SAMEFLOOR=1` playthrough.ts).
  MEASURED on c14cb206, the new default through `pair` and `four` on the twenty level files with a room clear to play, both stands: SEED 0 FAILS NO LINE on
  any of them (staged, walked or left-their-marks, finished); every red is on a dealt seed and all of them stand on seeds 1 to 3 alone. One red goes green:
  the warehouse's pair on shipped (the win moved from dealt seed 1 to seed 0 with the hand placement; taken, 1 of 2 up: one run, thin). REDS LEFT, none the
  hand placements': shipped — the compound's pair (wiped on all four), Mousehole's pair (wiped on all four: the commander's moves into the store and the duty
  room are refused, 'door is locked', 10 of 15 orders; it has no order for a barricaded door), the barracks' four (dealt seed 1 runs to the cap, 3 of 4 up),
  floodlit's four (wiped on all four; its generator says it is checked with `--seeds 3,4,5,6,7,8`); frozen — the compound's pair (dealt seed 1 to the cap, as
  the compound's bullet says) and floodlit's four (dealt seed 2 to the cap). A pair-only exception table for Mousehole was written and taken out again the
  same day: it would have hidden the locked-door gap and dropped a line that passes on the frozen stand. `TRAPPED_BREAK=1` still fails (depot, four).
  `probes.ts scenario-levels` ALL PASS on both stands with the new default.
  MOUSEHOLE IS THE FOURTH `TRAPPED` ROW (later 10-13, on 953cfc71; the barricade owner's reading of the red above): the 'locked' doors are no gap. The ward,
  the exam room and the store have ONE door each, wedged from inside on purpose, and are reached by their walls (charges are issued for it); this commander
  gives door and move orders only, so the plan it walks is the one the floor traps (its owner's tally, as passed on: doors from the yard 0 of 24, walls 22; the walled plan
  is playthrough.ts's own commander, `PT_WALL=1 PT_WALLOUTER=1`, held by `wallissue-check`). So on `mousehole.json` and its `-gwot` twin 'walked' asks only
  that the team left its marks and 'it can be won' is NOT ASKED, as on the depot and the block; the count is still printed. WHAT THE ROW STOPS ASKING THAT
  PASSED: the four took the floor by the doors on seeds 0 and 2 on shipped and on 3 of 4 on frozen, and the pair on 1 of 4 on frozen; those wins are luck
  against a floor built to beat that plan, not a property to hold. Both files, both stands: ALL PASS; `TRAPPED_BREAK=1` exits 1 on both.
- **The level check asks a win only of the floor's own team** (`tools/qa/scenario-level-probes.ts fourManRowsOf`, 10-13; tests only, no switch). A level whose
  room clear rows on the mission list (`src/scene/scenarioList.ts`) are ALL four-man is not asked 'it can be won' of the PAIR: the line prints NOT ASKED with
  the pair's count and the row's id. Staged, walked and finished are still asked of the pair, and the four's lines are untouched. A level with a pair row
  (records) or with no row (the office) keeps the line. Read off the list, not a table of file names. WHY: the compound's pair was red on shipped (wiped on
  seeds 0 to 3; its HAULHOME owner's reading, as passed on: 3 of 16 deals with the rule on, 5 of 16 off, a five-on-eleven floor nobody built for two), and
  picking seeds that win would have held nothing. WHAT IT STOPS ASKING THAT PASSED (measured, pair part, seeds 0 to 3, both stands the same count unless
  said): warehouse 1 of 4, barracks 1 of 4, floodlit 1 of 4, glasshouse 2 of 4, the compound 1 of 4 on frozen; those were never promises. STILL RED: the
  compound's pair on FROZEN, on 'finished' (dealt seed 1 to the 240 s cap, the compound's own known line), which this rule does not touch. CHECK:
  `PAIRTEAM_BREAK=1` asks every pair again and the compound's pair on shipped exits 1. Records and the office: PASS, still asked, both stands for records.
  `probes.ts scenario-levels` ALL PASS on both stands.
- **The level check's rescue player leads the hostages out** (`tools/qa/scenario-level-probes.ts` `Walk.leadOut`, 10-19; tests only, no switch). Its Sam
  walked to the door, pressed F and then only held the room. With the page's ending up (`RESCUEEND`: a held room ends nothing) and the covered lanes stopping
  the man the flush sends short of the room, nothing was left to end the run: on the shipped stand `scenario-levels-rescue` (the test level) stalled at its
  150 s cap on all six seeds, and the frozen stand, where the 15 s hold still ends it, stayed green. Now, 8 s after the room is the team's (`LEAD_AFTER`), he
  walks to the nearest hostage, takes her row and walks them to the way in, asking again every 5 s; with the ending off he holds as before. MEASURED, shipped
  stand: the test level 6 of 6 rescued, both hostages out at 40 s (it was 6 of 6 stalled); the registry (3 seeds, cleared at 26 to 28 s) and the consulate
  (its own two red lines, the staging count and seed 2's walk) are line for line what they were on the build before. Frozen: unchanged (5 rescued, seed 3
  lost). The stall was the check's player, not a man who never comes: he is sent 4 s after the room falls and waits at a corner short of the lane, and this
  player (god mode, kept near unseen, never firing) neither met him nor left. Never seen on a GPU, never played.
- **The pass is the fifth `TRAPPED` row of the level check** (`tools/qa/scenario-level-probes.ts`, 10-14, on build 583bb5a9; tests only, no switch). Its own
  sentence (`missions.md`, 'A level made for snow: the pass') makes the white, lit yard between the lorry and the doors the problem, watched through glass
  from two sides, with the answers round the back (the kitchen's `back` door, way 2) or with the mains cut; this commander walks way 1 across that yard.
  BEFORE THE ROW, seeds 0 to 3: red on both stands, on 'walked' alone on shipped (a DEALT floor wiped in the yard at 9.0 s, pair, seed 1, and at 12.8 s,
  four, seed 3, before anyone reached a door) and on 'walked' plus the four's 'it can be won' on frozen (0 of 4). SEED 0, the hand placement the page
  deals, got a man into the tea room on both stands with both teams. WITH THE ROW: 'left their marks' passes on every seed, both stands, both teams;
  `TRAPPED_BREAK=1` exits 1; `probes.ts scenario-levels` ALL PASS on both stands. WHAT THE ROW STOPS ASKING THAT PASSED: the four took the floor by the
  front on shipped on seeds 0 and 2 (3 of 4 and 4 of 4 up). NOT A CLAIM THAT THE TRAP TRAPS: the level is `untuned`, and its owner's own tally has the
  front way winning most runs on shipped; whether the yard should cost more is the level's tuning, not this check's.
- **A level does not deal the squad's kit; `bun run tools/qa/kit-audit.ts` lists what its mission gets** (2026-10-18). The issued kit and the named
  squad kits are one table for every mission (`src/game/kit.ts`, `docs/agents/menus.md`: the squad's kit is dealt over the men who come). A level's
  file adds to it in two ways only: `scenarios.issue.members` (a block of cards by place on the roster, the fields that differ, written against the
  pair's layout; the Team & kit screen then shows no cards, and a level's issue card is put on as written)
  and `scenarios.roomClear.wallCharges` (wall charges of its own, whatever the cards carry: nobody is issued one). The listing's row for a mission
  says the sizes it offers, whether the cards can be changed there, the level's own kit, its locked and steel doors against the two door charges a
  squad is issued (no hammer or shotgun opens steel, and only a team of three or four as issued is lent a big-slot tool: `KITDEAL.more`, menus.md), whether frags can be ordered at all (never with a hostage,
  the man a snatch came for or a civilian in the blast: `squadthrow.ts`), and whether the Team & kit picture has a place for each way in
  (`scenarios.kitView.ways`). A listing, not a gate: it always exits 0.
- **THE LEVEL SKILL AND ITS ONE COMMAND** (10-18; tools and a list only: no switch, no game code, no level file touched). The maintainer, on a Team & kit
  screen where the blue pair carried a rifle and nothing else: "as issued still has blue team pretty empty" · "i think we should make something like a level
  skill that goes through everything that's needed for a level based on what we've seen" · "seems like we miss a lot". `.claude/skills/level/SKILL.md` is
  that list, in the order a level is made (before you touch anything · the idea · the file · rooms, doors, walls · lived-in rooms · light, hour, weather ·
  the mission in the file · the team and its kit · what the player reads · measure it, then say it), every need with what was SEEN when it was learnt and
  the command that checks it; what no tool can ask is marked by eye or by play. `bun run tools/qa/level-needs.ts [name …] [--run] [--jobs 4] [--skip need,…]
  [--quiet] [--md f] [--json f]` asks the nineteen needs a file can answer about what stands AROUND a level (generator · mission · row · music · picture ·
  kit picture · look · lived · floor · ground · leak · key · lamps · moon · doorway · roof · kit · response · said) of one level or all, in about a second, a look twin with its plain file.
  The floor itself stays `tools/qa/map-check.ts`'s (structure, size, nav, the scripted runs): `--run` runs that with `--no-runs` and the level's other own
  checks as they stand (export `--check`, level-lint, door-size, second-way-check, lived-check, kitview-plan, level-names-check, floor-order-check,
  quiet-check, lesson-check), four at a time: about 13 s for one level, 90 to 120 s for all. Exit 1 on a FAIL; a NOTE never fails. `NEEDS_BREAK=1` plants
  gaps in seventeen needs on one level in memory (the kit's by emptying every card, whatever the issue table gives) and must find each by its own words
  (exit 1; a MISSED one exits 0). THREE NEEDS ARE NEW CHECKS: `doorway` (a wall decal across a door's opening: the dado rule had no check), `roof` (a drawn
  slab in `weather.ts roofsOf`'s band: the floodlit shed's), `kit` (as issued, through the game's own cards and pouches, at every size the row offers, who
  comes with nothing but a gun; the team's size is set before a card is read, so an issue shared out over the men who come is read as shared). AS THE 36
  LEVELS STAND on build 8dbdb23, both stands the same: 464 PASS, 24 FAIL, 65 NOTE, and with `--run` 73 of 74 own checks exit 0. THE FAILS: `kit` on all
  22 rows that take three or four (the issue is one table for five, `game/kit.ts ISSUED`: the squad's stuns, charges and frags ride on the first two
  teammates, so Blue One at three and both blue men at four carry nothing; the long hall's own card and the two levels that issue wall charges do not
  change it; ONE table's mend, the kit's, turns all 22 green and no level should patch it with a block of its own); `doorway` on the crossing (`box_0069`
  across `gate_ne`) and the glasshouse (`box_0062` across `back`); and the one red own check, `map-check snatch --no-runs` (its footstep zone `hut` lies
  outside the building rectangle and is never read). NOTES: 26 rows still `untuned`; no footstep map on block, block-squads, consulate and registry (the
  office's shell) and on the records office (not the office's shell); lamps under open sky and off the photocell on crossing, depot, floodlit, lights-out,
  quiet-relay and train-kit; rooms with fewer than three things in them on six levels; locked and steel doors against two door charges on eight; two
  frags issued where a frag on order is refused on the three rescues and the snatch; a partner kitted as for a loud mission on five quiet rows; four
  level files no mission plays. NOT MENDED HERE: each is its owner's. NOT IN A GATE: it is red today on the kit, so it is in no family and not in
  all-quick; wire it in once it is green (`--skip kit` gives the exit code of the rest meanwhile). NOT ASKED BY IT: anything by eye or by play (the idea,
  the five checks, light per room, sight lines at the starts, whether furniture reads from above, whether a picture looks like play), and `said` holds
  only that a level is NAMED in these files. It stands no game up: nothing here was seen on a GPU or played.
- **The two foot bands that ran across a doorway are mended** (level data, no switch; 10-18; the two the dado bullet above left as "NOT mended", the `doorway`
  need's two reds). `G.skirt` lays one band the length it is given, so a band given a whole wall crosses that wall's doors. Glasshouse: the back wall's foot
  was `G.skirt('x', 8, 10, 30, -1)`, 0.76 m of it across door `back`; it is two calls now, 10 to 13.76 and 14.74 to 30 (the frame's outer faces). Crossing:
  the east wall's foot across `gate_ne`, cut at 6.76 and 7.74 the same way in its own step. EACH FILE HAS ONE BOX MORE, so every unnamed box after the band
  moved up one id: a list that names boxes by typed id moves with it (the crossing's door picture finds its eleven now, counted off the generator's own
  calls, and throws when the count is not eleven; the glasshouse names none). A LEVEL'S FINGERPRINT MOVES WITH ITS BOXES: a tape or a checkpoint taken on
  either level before this refuses to load. `lived-check`'s base moved to each step in turn (`BASE_REVS`, newest first). CHECKED, glasshouse, both stands
  unless said: export `--check`; `level-needs glasshouse` has no `doorway` line; `lived-check`, `level-lint`, `level-identity`, `door-size`, `kitview-plan`,
  `secondway`, the `glasshouse` probes, `scenario-levels`; one boot of the mission on the page with the software adapter (no page error, no band left
  across the doorway, the door there). NEVER SEEN ON A GPU and not played: that the wall's foot reads right either side of the frame is by the numbers.
- **The level command's `kit` need reads the issue AS WORN, and the levels are green** (10-18; a tool and the skill only: no switch, no game code, no
  level file). Since the squad's kit is dealt over the men who come (`game/kit.ts KITDEAL`, the bullet "A level does not deal the squad's kit" above),
  `tools/qa/level-needs.ts` reads the five cards as a staging wears them: the issue, a level's own cards written over it, then `kitWorn(n, cards)` (dealt
  only while the counted things are still the issue's, as the game deals them), and a man is bare with no pouch filled AND nothing in his big slot
  (`kitdeal-check.ts comesBare`'s test). So a level whose own card changes a stun, a charge or a frag is red again at three and four unless it writes a
  card for every man who comes. The needs are asked OF THE PAGE AS IT OPENS on either stand (`host/profile.ts pageSwitches` with no flag and `kitLoad`
  with nothing kept, what the shipped stand boots with), because a rule the frozen stand holds off would call a man bare whom no player sees bare; a
  refused `slots.json` stops the tool with that word. The stand still decides what `--run`'s own checks see. `KITDEAL_BREAK=1` in front is the need's own red path: the
  cards as the table writes them, red on the 22 rows that bring a third man. A level's own cards are worn as written (the long hall's block
  names nobody since the shield left the game: its four come in the plain issue). The skill's kit items say the same, and its kit picture item gains a rule from the kit figure's side: where a
  `kitView` hide list names box ids, whoever shifts the level's box ids builds it again from the generator's box range in the same step. AS THE 36 LEVELS
  STAND on build 1e1f943, both stands the same: 488 PASS, no FAIL, 65 NOTE (the two `doorway` reds and the snatch's footstep zone of the bullet above were
  mended by their owners); `NEEDS_BREAK=1` exits 1 on both. With `--run` every one of the levels' own checks exits 0 on both stands. STILL NOT IN A GATE (its owner's call). NOT ASKED YET, each waiting on
  its own work: a need for a level's response-team block (asked since: the bullet at the foot), and one for a rescue that ends only on extraction or a full clear. Nothing here was seen on a
  GPU or played, and nobody has gone through the 36 levels by eye against the skill's by-eye items.
- **The level skill after the shield left the game** (10-18; the skill's words only). Its kit item said a level's own card that hands out a tool the game
  has switched off is dropped whole; with the ballistic shield cut, a card that still says `shield` is REFUSED as the file loads, in words
  (`src/scene/levelData.ts`: "take the key out (the rest of the card stands)"), and the skill says that. `tools/qa/level-needs.ts` was brought in line by
  the shield's own step (issue cards are read as written). On build ba34118, both stands: 488 PASS, no FAIL, 65 NOTE; `KITDEAL_BREAK=1` 22 FAIL;
  `NEEDS_BREAK=1` exits 1.
- **The level skill says where a Team & kit picture stands** (10-18; the skill's words only). Since every way of a `scenarios.kitView` block must anchor on
  a door that is not steel (`docs/level-format.md`; `kitview-plan.ts` section C fails any other, `kitview-work.cjs` holds the page to it), the skill's kit
  picture item says so, with what to write where a mission's own way in is a gate, a gap or a wall. `--run` already runs `kitview-plan` for a level, so the
  level command is red on such a way with no change to it. On build d2ec4b7, both stands: 488 PASS, no FAIL, 65 NOTE.
- **The level skill says how a check holds a file against its generator** (10-18; the skill's words only). The skill's "a check of its own" item now says
  such a check runs the generator as the exporter does (`tools/qa/headless.ts asExporter`), since under the page's own maths a generator's sin / cos round a
  last bit another way than the file was written with (the `level-identity` probe was red on the shipped stand for that alone), and that staleness is
  `export.ts <name> --check`'s question. `tools/qa/level-needs.ts` needed nothing: it runs no generator in its own process, and `--run`'s export check is a
  fresh process that raises no stand. On build 956661a, both stands: 488 PASS, no FAIL, 65 NOTE.
- **The level skill says a rescue's start is also its way out** (10-18; the skill's words only; the rule is `missions.md`'s "A rescue is won out, or
  cleared"). Its mission section gains one item for whoever lays out a rescue: the team's start mark (`scenarios.rescue.team.sam`) is where the hostages are
  led to, so it wants standing room and a way back a hostage can walk; said as the game is now, since the way out being the way in is an open call. No need
  was added to `tools/qa/level-needs.ts`: `probes.ts rescueend` walks each rescue's hostages out. On build ab96d87, both stands: 488 PASS, no FAIL, 65 NOTE.
- **The level skill asks whether a response team comes (`response`, the sixteenth need of `tools/qa/level-needs.ts`).** The rule and which levels have a
  team are `docs/agents/enemies.md`'s ("The response team is the level's own", "A squad's raid brings a level's team too") and `docs/level-format.md`'s
  (`response`): nothing of them is said again here. The need only asks that a level with a mission row has ANSWERED, from files, standing no floor up.
  WITH a `scenarios.response` block (the office's is `levels/office.scenarios.ts`'s): its `why` is a sentence (over 40 characters, as
  `response-check.ts` asks), and a look twin carries the same block word for word, else FAIL; and a NOTE when no row of the level is one the block
  answers (`qrf.ts live()`: a `raid` block is called only inside a squad's clear that is no rescue, any other only outside every squad mission; the
  office's plain night is no row). WITHOUT one: the level has a line in the tool's own table `NOBODY_COMES` (level, and why nobody comes in a few
  words; the long form stays the two bullets of enemies.md), else a NOTE, never a FAIL: a new level is asked, not stopped. In the table AND carrying
  a block is a FAIL (one is stale); a name in the table that is no level with a row stops the tool. Lessons are not asked. The need first read the
  enemies.md lists as prose and a review showed that passing levels on any word after the list (a level with its block deleted among them): hence a
  table. `block` and `hall` are in neither on purpose, so they are the need's two NOTEs: enemies.md says either would suit a team and has none yet,
  the maintainer's call. Marks, ways and a call played through stay `bun run tools/qa/response-check.ts`'s (about 90 s, so not in `--run`); each
  level of its `WITH` list has a call played by a line of its own (records since its line 21), so a new block wants a new line there. `NEEDS_BREAK=1` plants the unanswered level, then a block with a
  one-word `why` under a name the table holds beside a twin with another block, with rows neither kind of block answers: three FAILs and three NOTEs
  it must find. On build d5382d5, both stands: 513 PASS, no FAIL, 67 NOTE (27 lines of this need: 6 levels with a why, 2 twins, 17 levels in the
  table, 2 NOTEs). Read from files only: no call was played by this need, and nothing here was seen on a GPU.
- **Every door a row called by a bearing has a name of its own** (10-19; level data under `WORDS.doors`, the dialogue file's bullet has the switch and its
  words; no new switch here). `scenarios.doorNames` is written in 25 level files, 96 doors, and `words-probes.ts DOORS_OWED` is empty: a door that turns up
  called by a bearing is red there until its level names it. WHERE A NAME COMES FROM: the level's own generator, by what the level already knows the door
  by. A gate the response block names keeps that name ('customs yard gate', 'impound gate', 'street gate': one name a door); another gate is named by what
  stands outside or just inside it ('lorry park gate', 'tea stall wicket', 'motor pool gate', 'dish gate'); a room's door by the room ('spare room door',
  'corridor-side pantry door', in the made names' own style); a door of several in one wall by the room beside it ('fire door by bunks 3'); a lesson's door
  by what the lesson's line calls it ('red door', 'blue door', 'grain store door'). THE TRAINING GROUND (`train-ground.ts finish`) names its two gates in
  one place, 'track gate' and 'far gate', for every level built on it; a level that writes its own row for a gate keeps it (lights-out, the vault). A look
  twin takes its plain file's names. THE LEVEL WRITER could not write the block: `serializeLevelData` took every scenario block for an object and wrote a
  list as fields keyed '0', '1', which the validator refused on the read back; a block that is a list is written as a list now (no file without one
  changes). Each of the 25 files differs from the build before by its `doorNames` block and nothing else (read back and compared), so no fingerprint
  moves; `lived-check`'s base moved to this step. CHECKED, both stands unless said: `words` (9 probes; `DOORNAMES_BREAK=1` red), `level`, `quiet`,
  `registry`, `picks`, `journal`, `response`, `vault`, `lights-out`, `secondway`, `missions`, `lived-check` 407, `lesson-check` 73, `quiet-check`,
  `kitview-plan`, `level-names-check`, `level-needs` (no FAIL), both typechecks. NOT MINE AND RED ON THE BUILD BEFORE TOO, shipped stand only:
  `scenario-levels-rescue` (the test rooms' rescue stalls on all six seeds), `checkpoint-autosave`, `checkpoint-civilians`. ONE ROW READ ON THE PAGE (the compound's four, the software adapter, no page error): a man's row says 'on
  the side yard gate'. NOT DONE: no other row was read on a page, nothing was seen on a GPU or played; the names are words by the generators' notes, and whether each reads right from above is the maintainer's
  eye. LEFT, the same class but not door names: a quiet level's `exits` and `starts` and some `places` areas are still named by bearings ('the east gate',
  'the west track', 'north strip'), and the debrief's map marks print an exit's name.
- **An exit, an area and a door no longer read by a bearing or by letters** (2026-10-19; level data, no switch: the names are the files' own words, and the
  door names ride the door names key as before). The words check's two owed lists (`PLACES_OWED` 56 names in 20 files, `LETTERS_OWED` 23 doors in 10) are
  EMPTY. A quiet mission's way out is called by its gate's written door name: bazaar the street / alley / lane gate; crossing the customs yard gate, the
  impound yard gate, the lorry park gate, the tea stall wicket, the ditch wicket; police post the impound / motor pool / side yard gate; relay the dish / track /
  back strip gate; quiet yard the foot / road gate; the training ground the track gate and the far gate (`train-ground.ts EXIT_W` / `EXIT_E`), which lights-out
  and the vault take with their own names (the back gate, the generator shed gate; the counting room gate, the kitchen court gate). A START or a civilian's way
  out that names the same gate or track follows it (crossing, quiet yard, police post, bazaar 'outside the alley gate', relay 'the track' and 'the slope',
  lights-out and vault 'the front track' / 'the back track', the lessons 'the track'). AREAS: barracks armoury gallery / wash room gallery; compound side yard,
  alley; depot back yard; lights-out back strip, window side, front track, back track; police post side yard; vault counting room gateway, kitchen court
  gateway, narrow strip, shack side, front yard, back yard, front track, back track; warehouse service corridor, staff corridor. DOORS (`scenarios.doorNames`
  rows): barracks bunks 1 / bunks 2 / bunks 4 / armoury / wash room door and 'bunks 1 to 2 door'; compound 'pantry back door'; crossing 'customs office to
  impound door'; quiet yard 'bunk room to radio room door' (the look yard 'guest room to sleeping room door'); the orders lesson's yellow house / green house
  / armoury / kitchen door; warehouse 'locker room to break room door'. Twins take their plain file's names. Checked: in the 22 level files that moved, every
  changed line is a name; with the key up 23 doors read new words and no other door's name changed (a scratch run over every file, before and after);
  `probes.ts words` 67 PASS on both stands and `DOORNAMES_BREAK=1` red; lived-check 407 on both with this step's commit in front of its base; level-names,
  level-lint, kitview-plan, quiet-check, lesson-check, the debrief, quiet, missions and depot families green. LEFT, still a bearing, not on any owed list: the
  compound's `ways` on the mission list (`scenarioList.ts`), a `needs` place ('the south wall' on the quiet yard, 'the east gate' on the crossing), route ids a
  defender's line may say, and the office's own 'north side' words. Nobody has read a renamed line on a GPU page.
- **The level skill after the van and the wall switches** (10-19; the skill's words only, no need added to `tools/qa/level-needs.ts`). Its mission section
  gains an item for a snatch (`scenarios.snatch`: the man, two exits or more, and `van`, where the mission is now won: `docs/agents/missions.md`, *a snatch
  ends in the van*; checks `snatch-check.ts` and `snatchout-check.ts`). Its light section gains one for the wall switches (`docs/agents/stealth.md`, *Wall
  switches*): no file places a plate, so what a level owes is plain wall beside its doors and lighting groups that are its circuits; check `probes.ts
  lightswitch`. The snatch level's response block came with the van, and its line left the command's table of levels where nobody comes in the same
  step (not by this one). On build 9f632e9, both stands: 513 PASS, no FAIL, 67 NOTE; both red paths red. Nothing of either was seen on a GPU or played here.
- **A pane's glass comes from where the level puts it** (2026-10-21; a rule in `src/game/glassbreak.ts`, `GLASSREAL.place`, on in the page and off on the frozen
  stand: `destruction.md`, *Glass as buildings have it*; no level file touched). Foot under 0.7 m, or a panel of a door = toughened (one round, the sheet drops, the
  opening is walked); from a sill = float (a hole, then daggers); a narrow inside sidelight or a high outside strip = laminated. The level skill's section 3 has
  the rule as a need; `probes.ts glassreal` line 9 holds every level's count of panes by kind, on and off, and a level with new glass adds its row there.
- **The level skill asks that the ground is not one flat sheet (`ground`, the seventeenth need of `tools/qa/level-needs.ts`, 10-22).** The maintainer, on a
  shot of the tutorial's fuel halt (`tut-solo`) at night: "ground looks pretty flat here. we should make this part of our level skill". The skill's
  lived-in section gains the item (finishes, wear, stains, low things to walk over; `STYLE.md`'s rules for a patch). THE MEASURE (`bareGround`, from the
  file's boxes, props and paints, no floor stood up): the world in 0.25 m squares, each with the TOPMOST flat paint drawn over it (a box no higher
  than 6 cm that is a decal, a leaf of 2 cm or less, or the world's own slab; one under half a metre wide is widened by half a square so that a painted
  line is not lost, and a speck under a square long is nothing). Two paints read apart at 0.15 of the larger value, 0.3 of roughness, or 0.08 of any channel's share of the colour (the look's
  lightest door wear is 0.84 of its floor; a patch of its ground's own paint is no mark, and dust beside gravel is one sheet). A BREAK is the open line
  where two paints that read apart meet, a mat under 10 m² with markings on its upper face, and anything standing on the ground no higher than 0.19 m,
  the height feet step over (rubble, a kerb, a loose thing by the game's own footprint for it; a pad wider than 3 m is a floor, and paint). Squares under anything standing (below
  1.9 m), and on a door's line, are not ground the eye sees and nothing passes them: a break dresses the squares within about 1.5 m of it, walked round
  the walls, and two rooms are never added up through their door. What is left is the stretches, each named for the paint most of it wears. A stretch
  is OUTSIDE THE PLACE, and only added up, when the player cannot walk to it from any start mark of the file (`sam`, the solo night's `playerSpawn`;
  doors open), or when four fifths of its squares lie within 4 m of the world's edge and no start mark stands within 3 m of it. 40 m² or more in one piece is a NOTE, never a FAIL: one line a file, the six
  biggest with a square of each; a look twin is asked for itself. THE NUMBERS ARE FIRST NUMBERS (40 m², 1.5 m, 0.15, 0.3, 0.08): nobody tuned them
  against a picture, a step of roughness alone may not show at all, and the measure does not hold `STYLE.md`'s rule for a patch (darker than its
  ground, never under a third). IT NOTES NEARLY EVERYTHING TODAY, which is the state of the ground and also how blunt the measure is: on build
  5d31894, both stands, of 42 levels 38 are noted and 4 pass (office, office-relief, pass, tut-sky); of 14 look twins 9 are noted and 5 pass (block,
  block-squads, consulate, registry, warehouse). Most of it is the ground OUTSIDE the building: the yard levels stand on sheets of dust or asphalt of
  250 to 875 m², and the test maps are noted with the missions. `tut-solo`: 260 m² of dust and gravel (the road, where the mission starts), 101 of
  gravel (the gun court), 57 of slab (the shop), 56 of dirt (the truck court), 323 more outside the place. `NEEDS_BREAK=1` plants one
  sheet over the level's ground, which must be found, and asks the measure sixteen made floors: bare, patches of the ground's own paint, a speck of paint every 2.5 m,
  strips of two paints that do not read apart, a yard with one marking, two rooms with an open gap between them and the start in one, a bare ring at
  the edge with the start on it (each must be noted); a dark patch, a patch of another sheen, rubble, a turned 6 cm line, each every 2.5 m, strips of
  two paints that read apart, the two rooms with a door between them, the two rooms with the start outside their walls, the ring with no start (each
  must pass). Three reviews of the measure found 39 things; left as they are: a step of roughness alone counts, metal does not, a decal on a raised
  pad is not seen, the 3 m round a start is measured through walls, and it is a third reading of "what is drawn flat" beside `tools/levels/flatLayers.ts`
  and the look skin's `floorAt`. What a patch
  does to the picture has NEVER been seen on a GPU here, and no level's ground was changed by this: each noted floor is its owner's to mend or to answer.
- **The furniture check holds each level to its own base** (2026-10-22; `tools/qa/lived-check.ts`: a tool, no switch, no game code, no level file touched; A
  CHANGED BAR in a check). It held every level to ONE base, the first of `BASE_REVS` that HEAD descends from: a level changed on purpose moved every level's
  bar (six times in a day, each a tutorial mission's), and two levels changed side by side left two newest bases that are siblings, so their join was red on
  the level the taken one did not carry until a third base, the join itself, was written in by hand. NOW `LEVEL_BASE` is a row a level (its note, its line,
  an empty line; a new row goes in by the level's name, so two branches that each move a row join without a hand): a level changed on purpose in its own part
  moves ITS row to the commit that carries the change, and no other level's bar moves. Rows today: all six tutorial levels; the plain run walks every
  level with a row, furniture or none. A look twin with no row is held to the plain level's. `BASE_REVS` is CLOSED and is the base
  of every level with no row (it stays a list only so that branches cut before the rows came, which still put a commit in front of it, join without a hand).
  A row's commit must be in the checkout's own history and must carry the level's file, and a level in HEAD that has furniture, no row, and is not in
  `BASE_REVS`' commit is red (it was "a new level, nothing to hold it to", and with the list closed nothing would ever have taken it in); the same level
  not yet in a commit is a warn line that says what it will need once it is. `--base <rev>` still
  holds every level named to one commit. WHAT OF A LESSON NEEDS NO ROW MOVE (`LESSON_FREE`, read from today's file): its WORDS (`title`; a step's `line`,
  `setupLine`, `ringLine`, `blowLine`, `menuLine`, `pageLine`, `flatLine`, `planLine`, `noTap`, its card `explain`, its `after`): furniture cannot touch one, none
  names a place and none is a rule; no check holds the wording, on purpose (the loader takes their shape, `lesson-check` reads the first line on the
  objective row). HELD (`LESSON_HELD`): the steps' number and order, a step's `id`, its `done` test and `hold`, every place (`at`, `atMan`, `toward`,
  `eye`, the frame's `sky`), `cue`, `checkpoint`, `fog`, `onWay`, `respawn`, `lasers`, AND THE LISTS OF WHAT THE FRAME OFFERS (a step's `allow` / `deny`;
  the frame's `allow`, `orders`, `rows`, and `flatRing`, which ring the mission has): they are rules, and a word too many in an `allow` opens a key a step early with nothing else red (a scripted
  player only shows a key that is missing). They were free for one step (897) and are held again; a list changed on purpose is its level's one row move.
  A lesson's key in NEITHER table is a red line: whoever adds a key says which (with no file named this is asked of every level with a lesson,
  furniture or none). GONE: the rule that a lesson with another number of steps was read
  as today's whole (every mark and test of a re-cut lesson went unheld); a re-cut moves the level's own row. THE CHECK'S BREAK PATH (it had none), each on
  today's files in memory: `LIVED_BREAK=1` moves each level's first own box and stands its first lived solid in its first door: red on line 1 and on the
  doors' line of all 39 levels (166 lines); `LIVED_BREAK=lesson` changes every held key of each lesson's first marked step and of its frame: red on the 9
  levels with a lesson and a lived thing (it shows the held keys are held TOGETHER, not each); `LIVED_BREAK=lists` adds one word to every step's `allow` and
  to the frame's three lists and nothing else: red on all 13 levels with a lesson (26 lines); `LIVED_BREAK=words` changes every key of `LESSON_FREE` on
  every step: green, and red as soon as a key is struck from the table (tried: `menuLine`, `noTap`). CHECKED 10-23: 437 lines green on both stands (the
  tool reads files and floors; the stand does not reach it); the six tutorial levels by name green, the ledger's with 21 words and lists off its row's commit.
  NOT DONE: `BASE_REVS` made one commit (after the branches that still write to it have joined); a base per level for the levels that have no row.
- **The level skill names where light can be read through a wall (`leak`, the eighteenth need of `tools/qa/level-needs.ts`, 10-23).** The maintainer, on
  shots of the solo night's manager's office, dark, its shelves warm against the wall of the lit store: "some weird light leakage on bookshelf?", "seems
  like irradiance cache leak through wall? and showing up in specular?", then "we debugged something similar on pass -- i wonder if we should have a static
  check we can do on levels that catches this and put that in the levels skill". The same shelves and wall as 08-12 (`docs/agents/render.md`, the gather's
  bounce read; 10-20 on a man by a wall, `BOUNCE_WALLS`). THE MEASURE (`leakReads`, in plan, from the file alone): the cache's lattice (1 m, `render/rc.ts`),
  walls cut as `tools/qa/bouncewalls-check.ts` cuts them (shadow-casting, floor to ceiling, long and thin; its numbers typed again, a turned wall kept)
  and the line of each door the file does not hold open; lamps as the file burns them (a light not authored off; a flat fixture authored on that
  `game.ts` stands an area light in for, its brightest channel times its face) and the sky where no roof is. A probe is lit by a lamp in range with no
  wall between (a spot too: its bounce fills its room), or by the sky. For every box a ray can land on that is not the building's own, and every loose
  prop: a point every 0.5 m on each side face and the top, the read point one spacing along the normal, its four probes with their shares; a probe
  counts for a light when a wall parts it from the face (a hand's width short of the wall's ends), the light lights it, and the same light does not
  reach the face. A thing is NAMED at a share of 0.25, by the lamp before the sky. It is STRONG when that lamp's figure there (share times strength
  over distance squared, no unit) is 0.5 or more and more than the face has of its own from the lamps that reach it directly, a spot in its cone
  only: a lamp close behind the wall and the room's own lamp looking elsewhere, which is the manager's shelves. The need is a NOTE when a level has a
  strong one (the count, and the four room-and-lamp pairs with most of it), else a PASS that still says how many are named. WHAT IT FOUND, build
  66bed95, both stands the same: over the 56 level files 6,982 things named (10 on `tut-pair` to 296 on `block-gwot`), 1,726 of them strong (117 on
  `bazaar`); of 42 levels 39 are noted and 3 pass (`registry`, `test-rooms`, `train-pairs`); no look twin differs from its plain file. The solo office:
  144 named, 54 strong, 18 of those the manager's unit by `storage_bulb` through the wall at x = 30 (0.12 m thick); the tool lists the break room's
  things by the street lamp before it. So it is NOT A PASS MARK and not something a level dresses away: anything stood within a metre of a wall with
  light behind it is named, which is how rooms are furnished, and a room shipped dark beside a lit one is strong. It says where to look; the mend is
  the renderer's, and this number does not move when the shaders do (it reads no shader: `bouncewalls-check.ts` is the tool held to their text).
  `NEEDS_BREAK=1` plants a shelf, a wall and a bulb, and asks 23 made rooms: named (a bulb behind the wall, a shut door, a spot either way, a panel
  on, a wall's end, open sky behind, a bulb each side, a loose prop), not named (the room's own bulb, three metres off, an open gap, a door held open,
  no light, out of range, authored off, a bulb seen round the wall's end, a roof over both sides, the same sky both sides), strong or not (a dark
  room: strong; its own bulb nearer: not; a weak far bulb: not; its own spot looking away: strong). NOT HELD by the red path: a face shut in a wall.
  NOT IN THE MEASURE: heights (a plan: a wall under the ceiling is no wall), a lamp the game switches on later, gloss, how bright either room is. Two
  reviews found 23 things; left as they are: the wall rule and the footprint test are written a second time, and 0.5 is a first number. The cause of
  the 10-23 shots was with the renderer's owner when this was written, and the rule may narrow to it. Nothing here was seen on a GPU.
  NARROWED TO THE CAUSE the same morning (the renderer's owner, from the code and the level's numbers, with no GPU either): the read is the traced
  reflections' (`reflect.wgsl shadeReflHit`: the cache one spacing along the HIT's normal, trilinear, no wall test), so the face that leaks is one a
  mirror reflects within half a cell of a ceiling-high wall (a board's top, an upright's side, the floor at the wall's foot), and it shows on bare
  metal, whose reflection carries its whole colour, and at a few hundredths on any other finish. So `LeakRead` has `mirror` (the box or its paint is
  `metal`, and its roughness is under the widest `rt.maxRough` of the presets that trace, read from `ui/quality.ts`: 0.55, ultra) and the need
  (`leakLine`) is a NOTE only where a STRONG thing is a MIRROR; every other count is in the PASS line, with the mirrors named by the sky alone (never
  strong: the sky has no figure here) as "look by day". Both stands the same on build 66bed95: 238 strong mirrors over the 56 files (25 on
  `barracks`, the most); 27 plain files are noted and `killhouse` by its look twin only, so 28 of 42 levels, and 14 pass (`defuse`, `kit-yard`,
  `pass`, `quiet-yard`, `registry`, `test-rooms`, five `train-*`, `tut-pair`, `tut-plan`, `tut-solo`); 12 look twins read differently from their
  plain files (the look's `galv`, `tin`, `iron`). The solo office: 10, 6 of them the manager's unit by `storage_bulb`. The red path asks 35 things
  of made rooms now: a smooth steel shelf, one in a metal paint and one just under the cut are mirrors; no finish, rough metal, metal with no
  roughness, smooth and not metal, just over the cut, a box that overrides its metal paint are not; and of the line itself, that a strong shelf
  of no metal raises no note, a strong steel one does, and a steel one with its own bulb nearer does not (with the note put back on `strong` the
  red path goes green, tried). A third review found 8 things; mended: the cut and the matte default are read, not typed; the line is held; the
  skill names the preset to look on and a box marked metal itself. STILL NOT IN IT, and a NOTE-free level can show it: a thing of another finish
  that a mirror beside it reflects (the hit is shaded whatever its finish: the review counted 770 strong things within 2 m of a mirror), mirror
  metal the pass does not measure (the building's own groups, so every `glassFrame` in a wall and a door's frame; a drawn-only box; a steel door
  leaf, for `doors` carry no finish in this tool; a prop), and the weaker share of the same blend in the diffuse gather and on presets with no
  traced reflections, which the named and strong counts are the place to look for. A mend for the reflections was being handed in when this was
  written; this number will not move with it.
- **Round things are round** (`ROUND`, `src/scene/round.ts`, 10-23; the maintainer's pick on the geometry trial: round drums and tyres into the
  game). ON in the page, `?round=0` puts it off; OFF in the module and on the frozen stand, `TPS_ROUND=1`; a `FROZEN_HOLDS` row; in the knob
  registry and the journal. THE SWITCH IS READ ONCE, AS A LEVEL IS STOOD UP (`host/standup.ts populateHost`, before the boxes go to the world and
  before `new Game`): a recording from before the table has it put down before its level stands (`roundTape`, called by `replay/engineplay.ts
  tables()` and `tools/qa/rerun.ts tables()`; `applyKnobs` says the same afterwards; `tools/qa/replay.ts` says the file's word for its one
  stand-up), and the debugger's row 'round things are round (reloads)' reloads the page with the word on the address. The level files are not
  touched. The kit (`gwotKit.ts round`, radius 0.2 m or more: drums, tyres, stoves, the oven, the water tank) and three older generators (round
  table tops and drums in lived-in rooms) write a round thing as FOUR slabs through one centre, 45° apart, their tops stepped 2 or 3 mm;
  `findOctagons` finds them by that shape, and `roundLevel` makes the first slab ONE box with `Box.round` (the cylinder about the box's own y,
  radius `h[0]` = 1.026 × the slabs' half length, the circle with the octagon's area, which is 0.985 of the radius the kit was asked for; half
  height `h[1]`; yaw 0) and the other three specks that carry NoPrimary | NoShadow, so every box keeps its index. What each box was is kept on
  it (`Box.was`), `roundLevel(…, false)` puts every box back, and the level's fingerprint is taken over the boxes as authored (`authoredC /
  authoredH`).
  ONE MODEL: CPU rays and segments (`boxes.ts rayBoxRound` behind `rayBox`, `collision.ts lineBox`, and the two fast paths in `segmentBlocked`
  and the dynamic walk hand a round box to them), MOVEMENT (`collideCircle` pushes a body straight out from the axis, `circleTouches` asks circle
  against circle, so the walk grid is baked round too), GPU rays (`common.wgsl isectRound`, called from `isectBox` behind the scene prelude's
  `const ROUND_BOXES` on a box whose flags word carries `GEO_ROUND`; the side answers the code `ROUND_SIDE` and the closest-hit walks ask
  `roundNormalAt`), and the picture (the g-buffer's cut pass draws a twelve-sided prism standing round the cylinder, shaded with one turning
  normal, its marks run round it, a rolled rim on the lid: `gbuffer_cut.wgsl`, the ROUND block). Round wins over a cut record in every one of
  them; nothing gives a round box one. THE GPU HALF RIDES THE CUT TABLE AND THE CUT PIPELINE BUT NOT THE CUT RULE: `roundConfig.gpu` is set at
  boot (`main.ts`: the switch AND the cut switch); a round box has no `BOX_CUT_BIT`, its prism's eight planes sit in its own rows of the cut
  table with `ROUND_CORE_W` in the core row, it is listed at the cut list's picture-only end, and `BoxWorld.cutTraced` does not count it, so the
  cut swap (`render/cutSwap.ts`, "a calm room pays nothing") is as it was and every ray program holds the round rule from boot. `GEO_ROUND` is
  bit 3 of the GPU flags word, which is the CPU's `Dynamic`: no shader reads that bit, and it is masked out of the word only while the round's
  GPU half is up, so with it down the words are as they were. THE SWITCH IS THE SIMULATION'S: a picture setting may not move it. On a page with
  `?nocutboxes` (or if the cut pipeline fails to compile) a round thing is DRAWN, and traced by the GPU, as the square box round it, while the
  game still meets the cylinder.
  WHAT STILL MEETS THE BOX ROUND IT (a square of side twice the radius, along the world's axes): the trace grid's registration (a superset), a
  shoved prop's, a ragdoll's and a piece of debris's own contact (up to 0.41 of the radius of air at a corner), the smoke solver's obstacle
  bake, the replay's map, and a blast, which takes a round thing as that box (`furnblast.ts`: its footprint for grouping is the square, and what
  flies is cut from it). UNDER FIRE (`wallbreak.ts`): a round thing in a paint the wall engine chews is ONE breakable of ONE cell where the
  octagon was four of one each, so it goes whole on one cell's damage and never stands as pieces of the square (32 of the 343: 30 drums in a
  paint read as wood, and the compound's cardboard drum in its two files, which was four cells a slab). THAT MOVES A TALLY nobody has measured in a fight: such
  a drum is cover for about a quarter as long. Snow caps on a drum's lid and on tyres are still the level's squares. Round things under 0.2 m
  (the kit's two crossed squares) are left alone. CHECKPOINTS ACROSS THE SWITCH: the fingerprint is the same, so a save loads with the switch
  the other way as long as it names no part of a round thing as broken; one that does (a blast took a drum, rounds shot one out) is refused by
  `canLoad` with the static's name, in both directions — also a save from before this rule, loaded on the page as it opens.
  CHECK: `tools/qa/round-check.ts` (`probes.ts round`; `ROUND_BREAK=1` must fail) on BOTH stands: every level file's count against a pinned
  table (282 across 18 files as the files have them, 343 across 28 with lived-in rooms; add a row when a level gains a round thing; a ring of
  four slabs the rule did not take is red), each made one round box and three specks and put back box for box; `rayBox`, `lineBox` and the
  shader's rule put into TypeScript over f32 against a point-in-cylinder reference (4800 seeded rays, the GPU rule within 0.2 mm and on the
  same kind of face); at the pass's brazier 64 lines of sight just inside the radius all stopped and 64 just outside all free (the octagon: 56
  and 48), a pushed body at one distance all the way round (the octagon: 0.578 to 0.601 m), Sam put inside it stood outside at one distance, a
  round stopped on the curve; tut-pair's seven chewable drums one cell each; a save loading with the switch as saved and across it; a lone
  round's walk grid a disc; ten seconds of the pass with the switch down the same run by digest on a level that was rounded and put back;
  fingerprint, stands, an old recording; the box world's words, rows and lists with the GPU half up and down. PAGE: `node
  tools/qa/round-page.cjs --root . --out <dir>` boots the pass twice on the software adapter (`round=0` and as it opens), wants every pipeline
  compiled and no console or GPU error, and writes a still of the brazier from each.
  NOT MEASURED, NOT SEEN: no tour, soak or mission tally was run with the switch up (the office, which those run on, has no round thing; the
  check's ten seconds of the pass meet none); nobody has played it; NEVER SEEN ON A GPU — the stills are the software adapter's at the lowest
  preset, so motion, a round's edge against bright ground, the marks' seams round a drum and what the round branch costs a frame are unknown.
- **The level skill carries lighting guidelines, and the level command names two lights that face each other (`key`, the nineteenth need, 10-23).**
  The maintainer, of the plan tutorial's yard: "this tutorial level just looks really *flat*", then "seems like we should generally (even independent of
  this thread) have some lighting guidlines that we put in our level skill". The graphics work read the cause from the level file and a still drawn on
  the software renderer. Opened by a link with no hour the level is its file's own night: two of the kit's floodlights (`gwotKit floodLight`: 210
  over 20 m, a 70 degree cone) at the yard's two gates look at each other, and pale walls go to white. The mission's own row plays at midday, where
  the photocell has both floods out and the sun stands at 56 degrees, a flat angle for a camera that looks down. Walls, blast walls and ground are
  close in value either way. THE SKILL (section 5, "How the light should look", eight rules, each saying what it rests on; guidelines, not misses,
  and said so there): one key light a court from one side; the key comes in low (a shadow is the wall's height over the tangent: 2.5 heights at 22
  degrees, 1.7 at 30, 0.67 at 56); lamps make pools, never a wash; every outside frame keeps a dark part and nothing big goes white; warm against
  cool; ground, walls and things a value step apart; a light changed for the look changes the play; look from the play camera before shipping. The
  wording is the graphics work's draft, cut down; a dark third and 0.4 for a pale wall (by luminance) are judgement. THE NEED (`facingLights`): two
  spot lights that burn as authored, neither a quarter of the other's strength or less (by the colour's luminance), each heading within 60 degrees
  of the line to the other and the two headings more than 120 apart, each one's pool reaching the middle of the ground between (the pool: its range
  and its cone's far edge from its height), and nothing ceiling-high (the leak's cut, hoisted to `planWalls`) on the line between them: a NOTE with
  the pair, which says when every row of the level plays at an hour that puts both out (`hours.ts`, group `exterior`). On the build of that evening,
  both stands the same: `tut-plan` alone of 39 levels (`flood_gate` and `flood_road`, 28 m; out at its midday). The yard lamps of `barracks` and
  `warehouse` face each other with a building between; `quiet-relay`'s `flood_w` and `lamp_west` face each other and the lamp's pool stops 6.5 m
  out of 18. `NEEDS_BREAK=1` plants a facing pair and asks 18 things of made rooms; each of the rule's six tests was taken out in turn and the red
  path went green each time. TRIED AND PUT DOWN: a measure of the ground the two share (squares both light from opposite sides at like strength,
  and squares in one's wall shadow that the other lights). On `tut-plan` the huts stand between the floods: 119 m² in all, 22 shared and 97 of shadow filled;
  but `barracks` (91), `sneak-lab` (77), `office` (67) and `block` (63) come near it by the same sum, mostly round a building, which is two courts
  with a key each and not a flaw. So one line stands for the ground between: a stub of wall on it hides a pair, a wall beside it does not part one. NOT IN IT: lights that
  are not spots, the moon's or sun's height, a spot's falloff, how pale the walls are, the picture's exposure; those are the skill's by eye. A
  review found 9 things; mended: the hour, the pool, the colour, the red path's hold on each test, a wrong pointer and the pale wall's measure in the
  skill; said and left: the one-line wall test, the plan and lamp list built again per need. On that build the `leak` need notes 29 of 39 levels
  (four training levels have left the tree). Nothing here was seen on a GPU.
  CORRECTED the same evening: the cause above is wrong in one thing, and the skill and the need's words said it too. A mission row's own hour is
  written over the link (`game/rowset.ts rowSettings`; `?rowset=0` is the link as written), so the maintainer's shot of `tut-plan` was MIDDAY and both
  floodlights were out on the photocell: nobody has seen the two floods wash that yard, and its night has not been drawn. What the pictures carry
  (the graphics work's stills on the software renderer, the same frame): at midday, the sun 56 degrees up, a pale wash with or without materials; at
  dusk, 22 degrees, long shadows and walls that hold below white. So in the skill the rule on a low key and the rules on white walls and value steps
  are the seen ones, "one key light a court" is judgement, and a rule is added in front of them: judge a level's light at the hour its row plays at,
  and read which lights are lit. The `key` need's line now says that a link opens at the row's hour too. Its measure is as it was.

