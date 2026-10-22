---
name: level
description: Everything a level of twopointsix needs, in the order you make one, each need with what was missed when it was learnt and the command that checks it. Use when adding a level or a mission, or changing one (rooms, doors, marks, lights, its row, its kit).
---

# What a level needs

A level here is more than its file. It is a generator, a file, a mission row, a kit, a picture, music, words, a look, and a
write-up, registered in a dozen places that do not know about each other. Every item below is here because it was once missed
on a real level: the line after **seen** says what happened. Work down the list; do not trust memory.

**Start and finish with two commands.** One asks what stands around the file (the tables a level is registered in, its
kit, its words), the other the floor itself:

```bash
bun run tools/qa/level-needs.ts <name>            # a second: a PASS, FAIL or NOTE per need (the name in front of each need below)
bun run tools/qa/level-needs.ts <name> --run      # also runs the level's own checks as they stand, map-check --no-runs among them
TPS_PROFILE=shipped bun run tools/qa/level-needs.ts <name> --run     # and again on the stand the page opens on
bun run tools/qa/map-check.ts <name>              # the floor: file, lint, size, structure, squads, nav from every way in, its card, 48 scripted runs
```

A FAIL is a gap. A NOTE is a thing to look at and say out loud. `--skip <need>` leaves a need out while it is red for a reason
that is not yours. What no tool can ask is marked **by eye** or **by play**: those are yours to do, and to say you did or
did not.

## 0. Before you touch anything

- **A level is a generator, never a hand-edited file.** `tools/levels/<name>.ts` exports `NAME`, `NOTES` and `build()`
  (`{ level, scenarios, groups, surfaces }`); `bun run tools/levels/export.ts <name>` writes `levels/<name>.json`. The office
  alone is `src/scene/officeGen.ts` + `bun run tools/level-export.ts`. Level files are never merged by hand: merge the
  generator and export again. **check** `generator`; `bun run tools/levels/export.ts <name> --check` (stale = exit 1).
- **Grep before renaming.** Row ids, file names, door, room and route names are named by probes, lesson scripts and kit
  pictures. `grep -rn "<name>" tools/qa src docs/agents` first.
- **Know what your change does to saves and tapes.** Adding, moving or removing a box, door, route, light or prop moves the
  level's fingerprint: old checkpoints and recordings of that level are refused. Marks, waits and room order alone do not.
  Say which in the write-up.
- **A level changed on purpose in its own part** puts its commit at the front of `BASE_REVS` in `tools/qa/lived-check.ts`,
  or `lived-check` reads your change as furniture damage.
- **Level data is not a switch.** A new RULE that reads level data is (CLAUDE.md: switch, `FROZEN_HOLDS` row, knob table, a
  check with a `_BREAK` path, both stands). A new field wants its key in `src/scene/levelData.ts`, both directions in
  `levelLoad.ts`, and a line in `docs/level-format.md`.

## 1. The idea (by eye, before any box)

- **One sentence nobody could say of another level**, written at the head of the generator with the hand placement and why.
  **seen** levels that were "a building with men in it" were the ones cut or left unplayed.
- **The five checks of an authored floor**: the problem fits one sentence; the obvious plan is trapped; two good answers,
  none free, that are different fights; one tool it rewards; everything needed can be read before contact (the mains' path,
  the dark opening, which rooms have their own power). **seen** "a hole that kills before a decision is not a problem to
  solve": a start in a gun's line was moved; a level whose answer nobody could read from outside was rebuilt.
- **Harder by smarter, then set-up, then kit, only then more men; never by hit points.** Eleven defenders is the cap
  (`row`), sixteen skinned characters the engine's.
- **Curated, not shuffled.** The first of every list in the generator is what every try gets: each room's first `garrison`
  marks in file order, `starts[0]`, `spots[0]`, `patrols[0]`. Give more marks than men so another deal exists, but place the
  first by hand. **check** `bun run tools/qa/samestart-check.ts <row>`.

## 2. The file

- **Inside the world**: 40 by 28 m, the building inside x 4..36, z 4..24 ("denser, not larger"); the box table; a frame
  draws 64 lights and a staged four already stands near that with torches and flashes, so a new emitter is weighed.
  **check** `map-check` (its size section counts prop parts, fixture lights and camera cones too);
  `bun run tools/qa/level-lint.ts levels/<name>.json` (leave the `.lint.json` sidecar out of a glob).
- **A height a foot can read**: no solid between 0.20 and 0.25 m on free floor (0.19 and under is stepped over, 0.26 and
  over is seen by the walk grid). Walls only in the two thicknesses door frames know (0.24 shell, 0.12 partition).
- **Paint says what a thing is** to a round, a charge and a blast: use the palette's paints; a look's paint stands for the
  office paint it replaced (`gwotAs`). **seen** a plain grey repaint became a steel cabinet to the simulation.
- **Its own footstep map** (`surfaces`, returned by `build()`). Without one a level is walked on the office's rectangles,
  wherever its own rooms are. **check** `floor`; `map-check` says which room gets which floor.
- **A breaker, a beacon, the placeholder `mission` block**, a world ground slab.

## 3. Rooms, doors, walls

- **Every door is real size** (0.9 by 2.05 m doorway, leaf 0.86), its middle on a walk-grid cell; a window's head stays
  under 1.9 m or it reads as a doorway. **check** `bun run tools/qa/door-size.ts <name>`.
- **Glass is typed by where you put it, so place it as a glazier would.** Nothing in the file names a kind
  (`glassbreak.ts typeOf`, `GLASSREAL.place`): the pane's foot decides. Foot under 0.7 m (it reaches the floor: a
  partition, a shopfront, frontage on a kick wall), or a panel of a door (within 0.3 m of the opening, foot under 1.5 m):
  TOUGHENED, one round and the whole sheet goes white and drops, and the opening can be walked. A window that starts
  at a sill (0.8 m and up): plain FLOAT glass, a round holes it and about three run it to daggers. A narrow inside
  sidelight (under 0.7 m wide) or a high outside strip (under 0.8 m tall): laminated, it webs and never opens. So choose
  the foot on purpose: glass to the floor is a second door for the price of a round, a sill window is a slit that opens
  slowly. **seen** "it seems like there are two types of glass breaking ... what's the situation?": every outside
  window was toughened and every partition float, whatever its height. **check** `probes.ts glassreal` (line 9 counts
  every level's panes by kind against a table: a new level with glass adds its row; `--verbose` prints them).
- **Every room they can shut has another way in.** The maintainer: "maybe we just need to design levels so there's always
  another route in?" A door hung to open OUT (`swing`), a walk-through window, or issued wall charges. **seen** barricaded
  rooms that could only be opened with a charge or a 40 mm. **check** `bun run tools/qa/second-way-check.ts <name>.json`
  (export runs it too; a changed swing moves that level's tallies and par times).
- **A door a held room lists opens into that room**, and can be walked from both faces. **check** `probes.ts oneway-men`,
  `oneway-deal`.
- **Every door face has floor for a stack**: a man on each jamb, 2 m of wall clear, nothing on the marks. **seen** a carton on
  a stack place; a table on the wall refused the order "no room on that door". **check**
  `bun run tools/qa/stack-marks-check.ts <row>`; `lived-stack-check.ts <row>` after moving furniture.
- **No door close under a tall wall to its south** (the camera looks from the south: the door is never drawn, never under
  the cursor). Hang it 1.9 m or more back. **check** `probes.ts doormenu-drawn doormenu-open`.
- **A painted band stops at the jambs.** A door's `at` is the opening's low end, not its middle. **seen** "weird box in
  front of door in duo stealth mission": a dado ran across the doorway; two more levels had the same. **check** `doorway`.
- **Flat decals are ordered, and start at the floor.** Crossing decals lie 0.7 mm apart by the exporter's order; a
  drawn-only decal hung off the floor falls when the wall breaks. **seen** "zorder issues on the floor", twice. **check**
  `bun run tools/qa/floor-order-check.ts <name>.json`.
- **A roof is the kit's ceiling** (`K.ceiling`: flagged `NoPrimary`, so the camera sees the room), at ceiling height if rain
  should stop at it, and no more than four. **seen** "weird to have shed that you can't see through the ceiling"; "rain is
  busted on records office". **check** `roof`; `bun run tools/qa/ownroofs-check.ts`; `rain-reach.ts --map <name>.json`.
- **A wall a charge may hole has floor behind it and marks 2.7 m off it.** **seen** "can't walk through hole i blew in wall
  with 40mm"; "weird that it doesn't let me use a wall charge here". **check** `bun run tools/qa/wallfurn-check.ts`,
  `probes.ts blasthole`.

## 4. Rooms that are lived in

The maintainer: "the office level is awesome and it has a lot of personality per room, we should makes sure all levels are
like that."

- **Every room, corridors and yards too, has the six things**: a use you can name in two words; signature furniture only
  that room has (0.6 m and over, readable from above); clutter of use; its own light or colour; its own floor decal;
  something to shove or break. **check** `lived` (counts things, names bare rooms); the rest **by eye**
  (`lived-check.ts <name> --sheet` prints what each room got).
- **Furniture is additions only**, the tail of the generator's lists, group `lived.<room>`, behind `LIVED.on`.
- **Clear of doors, stacks, marks and lines**: 1.1 m off a door's line and out of its sweep; a 0.9 m lane between a room's
  doors; nothing on or 0.45 m beside an authored point; never across a mark's aim line; never a new wall; nothing in the
  hidden band under a room's north wall. **seen** a crate stack shut the one way round; furnished barracks played harder
  because of one rack. **check** `bun run tools/qa/lived-check.ts <name>`.
- **Measure a loud level after furnishing it**, and say the seeds: under 144 paired seeds a difference is noise.

## 5. Light, hour, weather

- **Authored as a night**: one moon (a directional light in group `exterior`: the hour's sun goes in at its place), lamps
  outside in group `exterior` (the photocell puts them out at midday). A lamp the mission switches itself is the exception:
  say so. **check** `moon`, `lamps`.
- **A thin moon wants lamps outside.** **seen** "lighting looks very flat here for some reason, not like the other night
  rainy levels": a thin moon and no lamp. Lamps at the start marks stay under the goggles' line.
- **Light is balance, said per room**: which rooms ship lit, which lamp is the decision; a dark held room punishes the squad.
- **A room's mains lights have a switch on the wall, and no file places it.** The plate is found from the level as it
  stands: on the room's own wall beside each door, the latch side first, 0.85 m past the jamb and 1.2 m up, never on
  glass, in a leaf's sweep or behind anything lower than a door's head. So leave that strip of wall plain where you can.
  It works the lights that hang overhead and the lamps (not screens, signs or lamps outside), split by the level's own
  lighting groups, so a big room on two circuits wants two groups. A room you ship dark can be struck on by the player
  and is left dark by its defenders. **seen** "we should have light switches for rooms!"; two rooms of 176 keep a
  circuit no plate was found for. **check** `bun run tools/qa/probes.ts lightswitch` (every level file: each plate on
  plain wall with floor in a hand's reach). Never seen on a GPU.
- **Starts are dark and unseen**: nobody sees the team on its start marks, through a pane either; the first stack is in no
  roamer's line. **seen** a start on the road in front of the glass, in six marks' sight.
- **The headless light meter has no moon and no bounce.** A mark "dark" headless can be 57 % lit on the page. Hide marks
  stand in a moon shadow; measure with `--moon` where a tool has it, and say "never seen on a GPU".
- **Snow is a level's own weather**, by name in `src/game/weatherKinds.ts SNOW_LEVELS`, its snow in the file; banks stay off
  doors. The maintainer: "curate snow levels and have the art be custom".

## 6. The mission in the file

- **The `scenarios` block is in the level file** (`docs/level-format.md`): rooms with bounds, doors, garrison and marks;
  `team`; `starts[]` for a second way in; `squads[]` with every room in exactly one. Marks stand on free floor, 0.45 m off
  furniture. Room order is the order the commander works them and where the marker points. **check**
  `bun run tools/qa/scenario-level-probes.ts levels/<name>.json` (staged, walked, finished, can be won).
- **It names its own rooms and places** (`places`, room names without the article): radio lines, debrief and autosaves
  speak them. **seen** levels off the office that spoke the office's room names. **check**
  `bun run tools/qa/level-names-check.ts --levels <name>`.
- **A door is named for its room, never by compass**: an id is said and shown. **seen** `n1 s4 mid` became
  `tyres bunks radio`. Same check.
- **It ends.** **seen** "the two loud tutorial missions don't have termination conditions". **check**
  `bun run tools/qa/missions-gate.ts` (every row, two seeds, ends as shipped).
- **On a rescue the way in is the way out, as the game is now**: a rescue is won when every living hostage has been led
  to within 3.5 m of the mark the team starts on (`scenarios.rescue.team.sam`), or when the floor is cleared; holding the
  hostage room no longer ends it. So the start wants room for the team and the hostages to stand, and a way back from
  the hostage room that a hostage can walk. First numbers, and whether the way out stays the way in is the maintainer's
  open call. **seen** "the hostage rescue missions should have you safely extract the hostage or fully clear the map."
  **check** `bun run tools/qa/probes.ts rescueend` (the mission's `out` line walks them there).
- **`response` · Who comes when it goes loud is this level's own answer.** A response team comes only where the file
  carries `scenarios.response` (`docs/level-format.md`): who, by which ways, how many and how soon as ranges, the
  radio's words, and a `why` that says in a sentence who would plausibly come here. A block with a `raid` key answers a
  squad's room clear and nothing else; one without answers a quiet night gone loud and no squad mission, so give the
  level a row its block answers. A level whose idea is that nobody comes carries no block and says so: a line in
  `NOBODY_COMES` (`tools/qa/level-needs.ts`: the level, and why in a few words), and its name with the reason in the
  response team's write-up (`docs/agents/enemies.md`). A look twin carries its plain file's block. **seen** the office's
  stairwell team by constant on every floor; the maintainer: "let's make it part of the level design and always make
  sense (ideally w.r.t. the concept/design of the level) and not all levels should have it". **check** the need (a block
  has its `why`, a twin the same block, a row it answers; no block and no line in the table is a NOTE; both is a FAIL);
  `bun run tools/qa/response-check.ts` (about 90 s: every block against its built floor once the level is in that file's
  `WITH` list; a call is played through only on the levels its lines name, so a new block's first call is yours to play
  or to add a line for).
- **A quiet level**: the `quiet` block (starts, spots, exits, patrols), `mission` equal to `spots[0]` / `exits[0]`; every
  guard a man with a job; `wired: true` only where the holder really is on an alarm (**seen** "predictably getting a guard
  to come by when you pull the objective is a bit contrived"); a dark way exists and the short way crosses light; no deal
  is a walk and none is shut, over all deals; a long stand faces the right way on lap one. For a pair, the second man has
  a job the numbers show. **check** `bun run tools/qa/quiet-check.ts <name>.json`, `quiet-light.ts <name>`, `takecheck-check.ts`,
  `TPS_PROFILE=shipped bun run tools/qa/solo-night.ts --level <name>.json --quiet`.
- **A snatch**: the `snatch` block over the level's room clear (`docs/level-format.md`): the man and the marks he keeps
  to; at least two `exits` he runs for once it is loud, his nearest by walking first, so one can be covered while the
  team goes in by another; and `van`, the team's own vehicle by its way in, `pos` the spot at its open doors. As the
  game is now the mission is won when the tied man is in the van, the house taken or not, so the van wants a way back
  from wherever he can be caught that a led man can walk, and room at its doors. The van itself is the look kit's piece
  (`van` in `src/scene/gwotKit.ts`). **seen** the maintainer, playing it: "like maybe we need to get him to a van near
  our infil". **check** `bun run tools/qa/snatch-check.ts`, `bun run tools/qa/snatchout-check.ts`.
- **A lesson**: a line is one short sentence that names the key and what to do, written by the guide in CLAUDE.md ("Writing for
  the player": the way you'd say it aloud), in 96 characters, no compass word; a step never passes by itself and
  never becomes impossible; a line arrives with its prompt, inside reach; checked at a reader's pace on the shipped stand.
  **check** `bun run tools/qa/lesson-gate.ts <name>`.
- **A level whose idea leans on geometry gets a check of its own** (`tools/qa/<name>-check.ts`, a `_BREAK` path, both
  stands): the pattern of the glasshouse, the pass, the depot. A check that holds the file against the generator that
  wrote it runs the generator as the exporter does (`asExporter` in `tools/qa/headless.ts`): the page's own sin and cos
  round a last bit another way than the file was written with. **seen** the `level-identity` probe red on the shipped stand
  for that and nothing else. Whether a file is stale is `export.ts <name> --check`'s question, not such a check's.

## 7. The team and its kit

- **A level does not deal the squad's kit.** There is one issue for the whole game (`src/game/kit.ts`, a card a man by his
  place in the team). A level changes it in two places only: `scenarios.issue.members` and `roomClear.wallCharges`. So what
  your team carries is that table plus those two fields, at EVERY size the row offers. **seen** "as issued still has blue
  team pretty empty": the squad's stuns, charges and frags rode on the first two teammates, so at three and four the blue
  pair came with a rifle and nothing else, on every squad mission; the issue is now worn shared out over the men who come.
  **check** `kit` asks the issue as the page deals it, on either stand (were the table to leave a man bare it is red on every
  row that brings him: the mend is the table's, never a block per level; `KITDEAL_BREAK=1` in front shows the cards before
  the deal). `bun run tools/qa/kit-audit.ts` lists who carries what on every mission: read your level's row.
- **A level's own cards are for a mission built round a kit**, not a patch: with `scenarios.issue` every staging wears the
  issue and the player's kept cards are not worn or shown. The ballistic shield is out of the game: a card that
  still says `shield` is refused as the file loads, in words (take the key out; the rest of the card stands). Cards of
  your own that change a counted thing (stun, charges, frags, smoke) are no longer the issue, so the game does not share
  them out over a bigger team: write a card for every man who comes. Check it is worn, at each size, and what Team & kit
  shows. **check** `kit` (reads the cards as a staging wears them); `bun run tools/qa/issue-check.ts`.
- **Count the doors against what the squad brings**: locked doors, steel doors (no charge, hammer or shotgun opens steel)
  against the door charges issued; say how each is meant to be opened. **check** `kit` notes them.
- **An order needs kit somebody is issued.** A frag on order is refused near a hostage, a man to take or a civilian, so on a
  rescue or a snatch say what the squad throws instead; "smoke there" needs a teammate with smoke. A quiet mission's partner
  comes kitted as issued for a loud one unless the level says otherwise. **check** `kit` notes the first and the last.
- **The kit fits the idea**: a level that wants walls opened issues wall charges, the walls they are for exist, and the row
  says so. **check** `bun run tools/qa/wallissue-check.ts`.
- **The sizes it offers are sizes it was laid out for**: a row built for one size says `only`. Who carries the floor's
  grenades follows room order.
- **The Team & kit picture** is the level's own `scenarios.kitView` block, the same to the byte in a look twin; name boxes
  by group, not by a generated `box_NNNN` id. Where a `hide` list does name box ids, whoever shifts the level's box ids
  builds that list again from the generator's box range in the same step (other typed lists are left): a generated id names
  whatever box now holds that number. Every way's picture stands at a door the squad's tools can work: a door with a
  leaf, not steel. Where the mission's own way in is a gate, a gap or a wall, write the first door behind it (`ref` says
  which side the picture is taken from), or a set with a door in the wall the stack stands on. **seen** "some demos still
  don't really do anything": a hammer, a shotgun, a charge or the wand picked on a span or a steel door played the gun's
  row, and the picture stood still. **check** `kit picture`; `bun run tools/qa/kitview-plan.ts <name>` (fails a way that
  anchors anywhere else); the page by `PORT=<dev server> LEVEL=<name> node tools/qa/kitview-levels.cjs`, and every pick
  doing its work by `PORT=<dev server> LEVEL=<name> node tools/qa/kitview-work.cjs`.

## 8. What the player reads

- **Show, not tell.** No "play this first", no wordy options. No digit above 5 on a menu.
- **Every word on the row is true to the file**, from every way in: title, `place` (6..64), `blurb` (the premise, never
  the answer; 20..140 on a squad row, 160 elsewhere), `lean`, `defenders`, `ways` (one name per start), `squads` when the
  file names squads, a group of eight rows at most, `untuned: true` until somebody has played it. **check** `row`;
  `probes.ts missions-list missions-screen levers-rules picker-list`.
- **Its music**: two pieces in `src/audio/setlist.ts`. The maintainer: "we should curate the music for each level, not do
  it randomly". **check** `music`; `probes.ts music`.
- **Its picture**: `public/assets/menu/<row>.jpg` and `stills.json`, from a recipe in `tools/menu-shots/recipes.cjs` (a
  frame of real play; no two in a group share a moment, an hour and a camera) or `tools/menu-art.ts`. **check** `picture`
  (that it is there; whether it looks like play is **by eye**).
- **Its look**: built on the look's kit, or a twin `levels/<name>-gwot.json` (box for box, other paint) with its rows in
  `src/scene/look.ts LOOK_LEVELS` and `LOOK_DOORS`; one accent and one family of ground marks no other level has. **check**
  `look`; `probes.ts look`.
- **Hard, the short list, the par clock** where the level has them: `HARD_AT` / `SQUAD_HARD`, `src/scene/picks.ts`,
  `scenarios.par` set from 24 measured seeds.
- **A new KIND of file the page fetches** goes into the pack in `tools/build-one.ts` in the same change (level files and
  mission pictures are packed by folder). **check** `bun run build:one && node tools/qa/onefile-page.cjs`.

## 9. Measure it, then say it

- **Seeds mean what they mean**: 3 says a row reaches an end, 24 that it runs and ends, 48 is a first look, 144 paired is
  a count. A dozen scatters by a third. The scripted commander never fires and cannot be hurt.
- **A mission works only if measured**: it ends on 24 seeds as shipped; the idea matters (the same seeds using it and
  ignoring it); fair at Standard; off = the build as it was. **check** `bun run tools/qa/map-check.ts <name>` (48 runs);
  `TPS_PROFILE=shipped bun run tools/qa/ships.ts --scn <row> --seeds 1-24`; `plan-fights.ts --scn <row>`.
- **Some checks name their levels by hand** (a list inside the tool: the hour and weather probes, the blast and door
  probes, the squad deal). A new level is in none of them until added: `grep -ln "depot" tools/qa/*.ts` shows which.
- **Both stands, every check.** Frozen is the harness default; shipped is the page. A tool's own "as shipped" is not the
  shipped stand.
- **Boot the real page once** on the mission's link (`.claude/skills/verify`), no console errors. No GPU in the cloud: say
  "never seen on a GPU" of what was not, and name what nobody has played.
- **Write it up** at the foot of `docs/agents/missions.md` or `levels.md`: the sentence, the hand placement, the checks and
  their `_BREAK` words, what was measured on how many seeds on which stand, whether the fingerprint moved, what is the
  maintainer's call. **check** `said`.

## When this list is wrong

A miss this list did not catch is a new line here, with what was seen, in the same change that mends the level; and a need
in `tools/qa/level-needs.ts` if a file can answer it (its red path, `NEEDS_BREAK=1`, must find the planted gap).
