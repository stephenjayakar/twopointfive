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
- **A level changed on purpose in its own part** (a box, a door, a mark, a route, a held key of its lesson) moves ITS OWN row
  in `LEVEL_BASE` in `tools/qa/lived-check.ts` to the commit that carries the change (one line a level; a level with no row
  yet gets one), or `lived-check` reads your change as furniture damage. Nothing goes in front of `BASE_REVS` any more: that
  moved every level's bar. A lesson's words and lists (`LESSON_FREE` there: lines, cards, `after`, `allow` / `deny`, the
  frame's `orders` and `rows`) need no row move at all; a step added or dropped, a `done` test or a mark does. A lesson key the
  tool has in neither of its two tables is red until you put it in one.
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
- **A corridor players walk runs up the screen, or is wide.** The camera looks from the south, so a wall hides about two metres of floor behind it: a corridor 2.4 m wide running along the
  screen hides whoever is in it. **seen** the sneak lab's first dark corridor, Sam under the top of its south wall. **By eye.**
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

- **No door has an always-safe spot to command it from.** Plan mode's view stays with the player (6.5 m to either
  side of him, 4.5 m up the screen and 6 m down; `?plannear=0` is the view as it was), so he orders an entry from
  beside the room, and the level decides whether that spot is safe. For each door a stack forms on, look at the ground
  inside that box that sees the door. If one pocket of it is out of every defender's line and off every roamer's
  path on every deal, every entry will be commanded from there. Give the pocket a second line into it (a window, a far
  door, a roamer's turn) or take its view of the door away. Situational, not a ban: some doors may keep one. **seen**
  the maintainer asked that there is not always a safe place to hide and command from. **By eye** per door; no check
  yet (it wants the defenders' lines on each deal). Never played.

## 4. Rooms that are lived in

The maintainer: "the office level is awesome and it has a lot of personality per room, we should makes sure all levels are
like that."

- **Every room, corridors and yards too, has the six things**: a use you can name in two words; signature furniture only
  that room has (0.6 m and over, readable from above); clutter of use; its own light or colour; its own floor decal;
  something to shove or break. **check** `lived` (counts things, names bare rooms); the rest **by eye**
  (`lived-check.ts <name> --sheet` prints what each room got).
- **`ground` · The ground is not one flat sheet.** From above, ground is most of the picture, and one paint over a whole
  court reads as a floor plan, not a place. What the renderer can carry, all of it in the look's kit
  (`src/scene/gwotKit.ts`): FINISHES laid as the place is used (`ground`: dust, dirt, gravel, a slab), so a road, a
  court and a lot meet in lines the eye can follow; WEAR where feet and wheels go (`ruts`, a path trodden between the
  doors, the floor darker either side of a door as the look's skin lays it); STAINS where the use leaves them (`patch`:
  damp at a wall's foot or a tap, oil under an engine, ash round a fire); and things LOW enough to walk over, which take
  light and throw a shadow (`rubble`, a kerb, a step). Put them where the player walks and the camera rests (the start,
  the mission's line, every court), not evenly. `STYLE.md` holds the rules: a patch is darker than its ground, never
  paler and never under a third of it; earth stays darker than the walls on it; a floor carries colour only as marks; a
  place's ground marks are its own family. A mark has to read: a patch of its ground's own paint is no mark (the
  command counts two paints as apart at 0.15 of the larger value, 0.3 of roughness, or a plain step of hue; the look's
  own door wear is 0.84 of its floor). A low thing is 0.19 m or under, what feet step over.
  **seen** "ground looks pretty flat here" on the tutorial's fuel halt: two courts of 126 and 162 m², each one finish
  with a pair of ruts or a stain. **check** `ground`: one NOTE a file when 40 m² or more in one piece has no paint that
  reads against its own and nothing low to walk over within 1.5 m, with the six biggest pieces and a square of each; a
  door's line parts two rooms; ground the player cannot walk to from a start, and the bare margin along the world's
  edge with no start on it, are added up apart.
  It does not hold `STYLE.md`'s rule for a patch. Whether it reads is **by eye**, at the level's own hour (a midday
  sun shows ground a night hid). Never seen on a GPU here.
- **Furniture is additions only**, the tail of the generator's lists, group `lived.<room>`, behind `LIVED.on`.
- **Clear of doors, stacks, marks and lines**: 1.1 m off a door's line and out of its sweep; a 0.9 m lane between a room's
  doors; nothing on or 0.45 m beside an authored point; never across a mark's aim line; never a new wall; nothing in the
  hidden band under a room's north wall. **seen** a crate stack shut the one way round; furnished barracks played harder
  because of one rack. **check** `bun run tools/qa/lived-check.ts <name>`.
- **Measure a loud level after furnishing it**, and say the seeds: under 144 paired seeds a difference is noise.

## 5. Light, hour, weather

**How the light should look.** The maintainer, of a yard under a midday sun: "this tutorial level just looks really
*flat*". The camera looks down, so the ground is most of the picture, and what gives a thing its shape is the shadow it
throws on that ground. The touchstone's rooms are the model: one raking light carries the room and most of the frame
stays dark. These are guidelines, not misses like the rest of this page: each says whether it was seen in a picture
(drawn on the software renderer), read from the code, or is judgement. None of it has been seen on a GPU.

- **Judge the light at the hour the mission plays at.** A mission row's own hour and weather are written over the
  link (`src/game/rowset.ts`; `?rowset=0` is the link as written), so a level's file may be a night nobody plays. Open
  it as its row does, and read which lights are lit: the photocell has every `exterior` lamp out at midday and under
  overcast. **seen** the first account of that flat yard blamed two floodlights at its gates. They were out: the
  row plays at midday.
- **The key comes in low.** A wall's shadow is its height over the tangent of the light's height: two and a half wall
  heights at 22 degrees (dawn and dusk), one and three quarters at 30 (the moon most files have), two thirds at 56
  (midday), and from above most of that sliver is hidden at the wall's foot. Choose the mission's hour and the moon's
  height for long shadows where the mission lets you. A level that has to play at midday gets its shape from paint
  and ground instead (below, and `ground`). **seen** the plan tutorial's yard at its midday is a pale wash, with or
  without materials on its walls; the same frame at dusk has long shadows and walls that hold below white. **read**
  `src/game/hours.ts`. **By eye.**
- **`key` · One key light a court, from one side.** Never two lights of like strength facing each other across the
  same ground: each lights what the other shadows. A second light on that ground is a fill at a quarter of the key or
  less, or it belongs to another court. Judgement, not seen: the plan tutorial's file has two of the kit's floodlights
  at its two gates, 28 m apart, looking at each other, and its night has not been drawn. **check** `key` (a NOTE for
  each pair of spot lights of like strength that face each other, each reaching the middle of the ground between,
  with nothing ceiling-high on the line from one to the other; it says when the mission's hour has both out; it sees
  spots only, and a road lit from both ends may be meant).
- **Lamps make pools, never a wash.** A lamp lights a door, a gate, a table: a few metres (the kit's lantern is 4.5
  over 5.5 m, a room bulb 26 over 7 m). Between two pools there is ground that neither lights. The kit's floodlight
  (210 over 20 m, a 70 degree cone) is the one that washes: aim it at one stretch and let it be the only one there. A
  court that is bright all over is the moon's or the sun's work. Judgement, from the rule above; not tried.
- **Every outside frame keeps a dark part, and nothing big goes white.** Stand the camera where the player starts and
  where he fights: about a third of the ground in shadow. A pale wall (0.4 and over by luminance: a blast wall near
  0.45, light plaster near 0.47, whitewash; bare block sits just under at 0.39) under a key light goes white first.
  Turn the light off it, darken the paint a step, or let the light graze it. **seen** that yard's walls at midday; the
  numbers are judgement. **By eye.**
- **Warm against cool.** The far light is cool (the moon 0.55 0.7 1.0, a floodlight 0.92 0.96 1.0) and what burns is
  warm (a lantern 1.0 0.6 0.28, a bulb, a fire). A night frame wants both in it. **By eye.**
- **Ground, walls and things sit a step apart before any light falls**: a dust yard near 0.2 under mud walls near 0.33
  (luminance again) under dark or strongly coloured things. Pale walls on pale ground with pale drums is flat under
  any light. **seen** that yard at midday. **By eye**; the ground's own steps are `ground`.
- **A light changed for the look changes the play.** Guards and the HUD read the light the picture shows, so a lamp
  moved or put out moves where a man can hide. Run the mission's own check after, and its page check where it says a
  spot is dark ("Starts are dark and unseen" and "The headless light meter has no moon and no bounce", below).
- **Look before you ship, from the play camera.** A still of each court at the camera's own height. Can you tell at a
  glance where the light comes from, and is there a shadow on the ground longer than a man? If not, it is flat.

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
- **`leak` · Bare metal against the wall of a dark room shows the lamp behind that wall.** The picture keeps bounced
  light in probes a metre apart. A traced reflection shades what it hits with the probes round a point a metre along
  that face's normal, and nothing asks whether a wall stands between. A shelf board's top, an upright's side or the
  floor within half a metre of a wall is read partly from the room behind it. Smooth bare metal reflects with its whole
  colour, so a steel unit glows with the next room's lamp; paint, wood and card reflect a few hundredths and do not
  show it. It is the renderer's to mend, not a level's. Until it is mended a level shows it where three things meet: a
  room shipped dark, a thing of bare metal smoother than 0.55 on the shared wall (a metal paint: `metal`, the look
  files' `galv`, `tin` and `iron`; or a box marked `metal` itself), and a bright lamp within a few metres behind it. Where all three meet, look at it
  before you ship and say in the level's notes that you did. Another wall for the unit, a rougher finish or a lamp
  further off is a way round, never a rule. **seen** "some weird light leakage on bookshelf?": the manager's steel
  shelves against the lit store. **check** `leak` (a NOTE where a thing of such metal stands so, with the rooms and
  lamps; every other finish is counted and passes; 29 of 39 levels are noted today, so where to look and never a pass
  mark; it does not see a frame in the wall itself, nor a wooden thing a steel one beside it reflects), then **by
  eye** in a real browser on the ultra preset (high traces no reflection above 0.45, medium above 0.35, low none)
  with the near room dark: the debugger's specular view (the cache irradiance view blends through every wall and
  proves nothing). Never seen on a GPU here.
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
- **A place a line asks the player to click has room round it.** A hand lands a metre or more off the mark, and a move's places are the squad's own (a few
  steps round the click, a wall at the back). So for a metre and a half round the mark: no corner a man can be put behind with no line the way he is told to
  face, and no door within 2.5 m to its south (the door's picture stands over that ground and takes the click). **seen** a click 1.25 m off a post's mark: the
  second man was put behind a building's corner and stood looking at a wall. **check** the level's scripted player clicks off the mark on purpose (the plan
  mode mission's `TUTPLAN_POSTB=x,z`) and says who took the order.
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
