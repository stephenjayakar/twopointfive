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
  trip, and `tools/level-export.ts --check` says stale/not). Hand edits to the JSON are legitimate but make `level-identity`'s "not stale"
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
  `probes.ts scenario-levels` (that on test-rooms). Still office-only by constant: weather INTERIOR / ANNEX, chronicle ROOMS, QRF_MARKS, NEED_SPOTS, CIV_SPOTS,
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
  lived things is the base's (`BASE_REVS` in the tool) key for key and loads to the same Level; with them every authored point (starts, marks, pods, waypoints, deals) keeps its floor, every mark's aim line
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
  pair's layout; the Team & kit screen then shows no cards, and a card that hands out the shield is dropped whole while the shield is out of the game)
  and `scenarios.roomClear.wallCharges` (wall charges of its own, whatever the cards carry: nobody is issued one). The listing's row for a mission
  says the sizes it offers, whether the cards can be changed there, the level's own kit, its locked and steel doors against the two door charges a
  squad is issued (no hammer or shotgun opens steel, and nobody is issued a big-slot tool), whether frags can be ordered at all (never with a hostage,
  the man a snatch came for or a civilian in the blast: `squadthrow.ts`), and whether the Team & kit picture has a place for each way in
  (`scenarios.kitView.ways`). A listing, not a gate: it always exits 0.
- **THE LEVEL SKILL AND ITS ONE COMMAND** (10-18; tools and a list only: no switch, no game code, no level file touched). The maintainer, on a Team & kit
  screen where the blue pair carried a rifle and nothing else: "as issued still has blue team pretty empty" · "i think we should make something like a level
  skill that goes through everything that's needed for a level based on what we've seen" · "seems like we miss a lot". `.claude/skills/level/SKILL.md` is
  that list, in the order a level is made (before you touch anything · the idea · the file · rooms, doors, walls · lived-in rooms · light, hour, weather ·
  the mission in the file · the team and its kit · what the player reads · measure it, then say it), every need with what was SEEN when it was learnt and
  the command that checks it; what no tool can ask is marked by eye or by play. `bun run tools/qa/level-needs.ts [name …] [--run] [--jobs 4] [--skip need,…]
  [--quiet] [--md f] [--json f]` asks the fifteen needs a file can answer about what stands AROUND a level (generator · mission · row · music · picture ·
  kit picture · look · lived · floor · lamps · moon · doorway · roof · kit · said) of one level or all, in about a second, a look twin with its plain file.
  The floor itself stays `tools/qa/map-check.ts`'s (structure, size, nav, the scripted runs): `--run` runs that with `--no-runs` and the level's other own
  checks as they stand (export `--check`, level-lint, door-size, second-way-check, lived-check, kitview-plan, level-names-check, floor-order-check,
  quiet-check, lesson-check), four at a time: about 13 s for one level, 90 to 120 s for all. Exit 1 on a FAIL; a NOTE never fails. `NEEDS_BREAK=1` plants
  gaps in thirteen needs on one level in memory (the kit's by emptying every card, whatever the issue table gives) and must find each by its own words
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
  cards as the table writes them, red on the 22 rows that bring a third man. A level's own cards that are not worn while the shield is out of the game are
  counted on its line (the long hall's one). The skill's kit items say the same, and its kit picture item gains a rule from the kit figure's side: where a
  `kitView` hide list names box ids, whoever shifts the level's box ids builds it again from the generator's box range in the same step. AS THE 36 LEVELS
  STAND on build 1e1f943, both stands the same: 488 PASS, no FAIL, 65 NOTE (the two `doorway` reds and the snatch's footstep zone of the bullet above were
  mended by their owners); `NEEDS_BREAK=1` exits 1 on both. With `--run` every one of the levels' own checks exits 0 on both stands. STILL NOT IN A GATE (its owner's call). NOT ASKED YET, each waiting on
  its own work: a need for a level's response-team block, and one for a rescue that ends only on extraction or a full clear. Nothing here was seen on a
  GPU or played, and nobody has gone through the 36 levels by eye against the skill's by-eye items.
