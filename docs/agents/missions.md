# Missions

One of the area files CLAUDE.md indexes. Everything below was moved here word for word from CLAUDE.md on 2026-10-13, in its old order;
"the bullet above / below" in a bullet means its neighbour there (each block says which lines it was), and a bullet named by its bold
title may now live in another file of this folder: `grep -l '<title>' docs/agents/*.md`. New bullets for this area go at the foot of this file.

<!-- was CLAUDE.md lines 37–236 -->
- **Scenario kinds** (`src/scene/scenarioList.ts SCENARIOS`, type in `src/scene/scenarios.ts`): `nightbreach` · `roomclear` · `rescue` · `quiet` (below) — 14 squad rows: the office's four (night breach,
  room clear pair / four, hostage rescue) + a level each for records, depot, block, block-squads, warehouse, compound, barracks (room clears) and registry (rescue).
  `src/game/scenarioRun.ts startFromQuery` is the one path from the URL to a staged scenario; the staging is `nightbreach.ts` (also the room clear's: `roomclear.ts`) and `rescue.ts` (+ `rescueflow.ts`).
- **A room clear deals a fresh placement every visit** (`roomclear.ts ROOMCLEAR.fresh`; ON in the page — `?freshstart=0`, Tab ▸ Room clear ▸ 'fresh deal every visit' —
  off in the module and on the frozen stand, a `FROZEN_HOLDS` row): a start that names no seed, with `ROOMCLEAR.seed` at 0, on a Game that owns a die deals the
  placement of `freshSeedOf(g.dice.seed)` instead of the authored one (seed 0, attempt 1) — a pick or a Missions row carries no seed, so every page load used to
  stand the same men on the same marks. The die is read, never drawn (`?seed=N` reproduces a visit); a start that names its seed (`?roomclear=3`, 0 included, every
  Training row) and a Game with no die of its own (every harness tool unless `TPS_SEED` / `standUp({seed})`) are untouched; the switch is asked at every staging, the
  seed dealt is in `roomClear.summary()` ('placement seed/attempt'), and `ROOMCLEAR.seed` is never written by it. A PAGE CAPTURE that must stand a room clear's men
  on the same marks boot to boot adds `&freshstart=0` (or `&seed=N`): seeding Math.random does not pin them (tools/qa/draw-equal.cjs's squad view does).
  `probes.ts fresh-start` (tools/qa/fresh-start-check.ts, in family `roomclear`; `FRESH_BREAK=1` must fail). THE WAY IN IS THE PLAYER'S PICK: a level's
  `scenarios.roomClear.starts[]` (scenarios.ts `StructureData.starts`, each a `TeamStart` like `team`; docs/level-format.md *Scenarios*) = other places the team
  may start from, and `ROOMCLEAR.way` picks — 0 (the default on both stands) and 1 = the structure's own `team`, k = `starts[k − 2]`, clamped; −1 = DEALT: on a
  fresh visit (the rule above) the way of `freshWayOf(g.dice.seed, n)`. The mission sheet's 'Way in' row (ui/missions.ts: one button per way the row's entry
  NAMES — `ScenarioEntry.ways`, display only, scenarioList.ts; fresh-start-check holds the count against the level file — plus 'Dealt'; key K) puts `way=N` /
  `way=any` on that mission's link and nowhere else (`quitSearch` takes the key off, so Quit, a pick of another mission and the pause card's Next never carry
  it; the start page's `asPick` hands a row with a way picked its own link, not the short list's; a mission with one way in shows no row); `?way=N` / `?way=any`, Tab row 'room clear ▸ way in'. No visit is dealt a way unasked: over 24 scripted
  seeds a level a second way cost the scripted commander 16‥21 teammates of 96 (another problem, not the same one from another side). ASKED AT EVERY STAGING, as the seed
  is (`wayNow()`; `RoomClearScenario.way` = the last staging's, 0-based; `summary()` says 'way in k of n'): a dealt way holds through its restarts, and a
  seed named or the fresh switch thrown off mid-run takes the next staging back to the structure's own. A start that names its seed gets the structure's own unless the
  knob pins one, so every scripted tally plays way 1 (`playthrough.ts --set '{"ROOMCLEAR":{"way":2}}'` plays the second; no gate plays one — fresh-start-check
  STAGES every level's). `checkStructure` asks every start the questions it asks `team`. nightbreach.ts `applyTeam` writes Sam's start knobs at every staging
  (the teammates read `layout.team`; the two used to part when another Game's start had written the knobs since). On a second way in the objective marker stands
  on the held room NEAREST that start (`firstOpen`; the level's own order was written from its own start), and the debrief's insertion pin is
  `roomClear.startAt`. A PAGE CAPTURE of one of these levels stands the team on the structure's own start unless its query asks otherwise (`&way=2`, `&way=any`). A line of a level's blurb or pick that says where the team stands must hold for
  every way in. The second starts: compound = the back gate (the list's word since 10-19, as the level names it: `gate_n` 'back gate'; the first is `gate_w` 'side yard gate') · barracks = the galley's back door · warehouse = the dark off the south-east corner, up the lit
  loading apron at both dock doors · depot = outside the east gate (the list's back gate), an arm's length from the store's hatch · the block (both files) = the loading hall's south end, on the tool crib's
  door · records = the dark west side, on the records room's own outside door.
- **Training lessons** (`src/game/lesson.ts`, `Game.lesson`, `__lesson`; rows in `scenarioList.ts TRAINING_MISSIONS` — a third table beside `SCENARIOS` / `QUIET_MISSIONS`, `group: 'training'`; block
  `scenarios.lesson`, docs/level-format.md *Scenarios*): a level file's STEPS — a line for the objective row naming the key, a DONE-TEST record read off the game (`LESSON_TESTS`: in / near / flag / slot /
  pace / meter / stage / door / target / men / all / any, deeds counted since the step came up: `did act:|event:|chron:|order:` (+ `on: '<door>'` for an order), and rows by family — hands `downed` `body`,
  kit `reload` `launcher` `burst` `threw`, squad `orderTo` `stackOn` `pairsOn` `word` `taken` `following`, the quiet partner `mate` `pair`) — run over a REAL mission of the level's kind (quiet alone, quiet as two, a
  room clear with the pair or the four). The lesson READS ONLY: it moves nobody and writes nothing the simulation reads, so the same keys play the same run with `LESSON.on` false (`?nolesson`); a level
  without the block returns on the first line of every entry point. Seams: `game.ts` (`lesson.tick(dt)` right after `updateMission`: this frame's `act`, events, chronicle rows and orders are in),
  `mission.ts objectiveText / objectivePos` (the step's line and marker stand over the scenario's own until the last step is done), `savestate.ts` (the step that is up rides in a checkpoint), `knobs.ts`.
  A fresh `g.mission` (restartEncounter) starts the lesson over; once the run is over (failed, done, Sam down, a room clear ended) the row is the scenario's own again. THE SEVEN (`tools/levels/train-*.ts` on the
  shared compound `train-ground.ts` — GWOT kit; `hut`, `lamp`, `finish`; seven corners of ONE compound, each lesson's far gate the next one's near gate, the neighbours' landmarks standing outside the walls: motor pool · kitchen court · generator yard · range · quarters · white house · well court; each ends on a small set piece done with what it taught): 1 `train-move` moving unseen · 2 `train-hands` hands · 3 `train-lights` lights, locks and devices · 4 `train-kit` guns and the kit
  (quiet, alone) · 5 `train-orders` orders and door tools (room clear, the pair) · 6 `train-pairs` two pairs, two doors, one word (the four) · 7 `train-silent` quiet, as two. A Training row deploys at its own
  size only (`loadout.ts squadChoices`). What is taught where, the keys, and what is NOT taught: rebuild/play-style-levels/tutorial/read-first.md. A step that could become impossible
  (a can spent, a door open another way) carries an `any` with the honest alternative. A lesson whose lines lean on men standing their posts sets `scenarios.quiet.radioCheck: false` (scenarios.ts QuietData; guards.ts `updateRollcall` stands down on that level — lessons 2 and 7; absent everywhere else = the game's check). Lines carry no compass words (the HUD has none) and promise no instant door; a scripted player waits on state (a door's open test, the drag / hold flag), never on frames. QA: `tools/qa/lesson-check.ts`
  (file / floor / list / start / off / checkpoint / restart), `lesson-run.ts <name>` (a scripted player, input only, per-level script `tools/qa/lessons/<name>.ts`: half a second idle before each step must NOT
  move it on, then the step's deed must), `lesson-gate.ts [name …]` (every Training level: file fresh + level-lint + check + run + on / off digest words equal + ONE RUN AS A PERSON WOULD PLAY IT: `TPS_PROFILE=shipped lesson-run <name> --pace 6` = the page's stand with six seconds of reading before each step — the scripted player's half second on the frozen stand never met a door with no closer, a guard's next lap or the net's radio check; ~1.5 min a level), `light-map.ts <name>`, and on the real page (software adapter, a dev server on PORT) `node tools/qa/lesson-page.cjs [name … | list]` (the list's Training heading and rows; a row's own link boots its lesson and the objective row reads step 1; `&nolesson` = the mission's own; every page is loaded with a CHANGED KIT planted in the store — no rifle — and the lesson must wear the issue kit and leave the store alone). A test record that throws or names no kind never passes and never throws into the frame (`passes()`); deeds count from the frame the step came up; a checkpoint made with the lesson off loads with the lesson stood down. The step that is up is THIS mission's: until `tick` has met a fresh Mission (a restart between frames) the row and a checkpoint read step 1, never the last run's step (`Lesson.at`). A Training level is played with the KIT AS ISSUED whatever the machine keeps (`loadout.ts kitAsIssued`; `kit.ts kitIssuedPage`, raised by main.ts on a Training level's load: every STAGING on that page — kitStage, kitPlayer — puts the issue cards on the men, while the table and its store stay the machine's, so the lesson neither wears nor writes the kept cards and the loadout screen opened from a lesson's page for ANOTHER mission still shows and keeps them; a Training row's own loadout screen shows no card and says so) — a kept card with no rifle left 'press 2' a step that could never pass. Lines never name a gun by model (the issue-kit names live in gear.ts on another branch).
  RULES A LESSON LEVEL KEEPS (from his tapes of 10-13): (1) OPEN MOONLIGHT READS ABOUT 57 % on the page's meter, and the headless stand-in (`guards.ts
  lightEstimateAt`) has no moon in it: outdoors it reads 0 anywhere outside a lamp pool, so a `meter light below 0.3` step passes headless where the page
  never will. A hide / wait / wall mark outdoors stands in a MOON SHADOW (north-east of something tall: the moon's `dir` is in the level's lights; test
  `g.col.segmentBlocked(P, P - dir * 40)` at chest 1.2 m AND head 1.6 m) and off every line of the man who walks: the lesson's script counts frames of
  `canSee(g, gd).visible` while hidden and fails on one (`tools/qa/lessons/train-move.ts go`). `lesson-run --moon` (a script's `export const mode = { moon:
  true }`; lessons 1 and 2 carry it, so the gate plays them under it) puts the moon on the CPU's meter (0.54 open, the page 0.56); `--hard` / `--floor N` beside it. (2) A line that names a prompt comes up only where the
  prompt shows: the step before it ends inside the thing's reach (`Doors.USE_REACH` 1.35 m of a leaf's centre), not in a wide area short of it.
  (3) EVERY STEP DONE ASKS FOR A CHECKPOINT (`lesson.ts advance` -> `g.saves.request(g, 'lesson', 'training N/M')`; the autosave's gates still decide), so
  a down costs a step or two, never the lesson: the floor's own triggers can stay silent for minutes on a one-yard level. (3b) NO LINE BEFORE IT IS TRUE: 'he
  has given up' waits on its own step, done by the lesson test `{ is: 'calm', route? }` (every hostile man on his feet, or the one of that route, in 'patrol'). (4) a lesson level's new door
  keeps lived things 1.1 m off its line (`lived-check` holds it), and a level changed on purpose adds its commit to `lived-check.ts BASE_REVS`.
  (5) THE TWO SQUAD LESSONS (train-orders, train-pairs) set `scenarios.roomClear.digIn: false` (roomfight.ts tickDef): read at six seconds a line, their men
  always had the minute to set on the door. And at a door the lesson HOLDS (threshold hold, then the word), the garrison's marks stand in the middle of the
  back wall, in the band neither jamb man's diagonal reaches (the two stand a metre out and half a metre wide of the jambs): a defender on either diagonal,
  awake and aimed, meets one of them alone and wins — the shover crossing (west back, the tape), or the hinge-jamb man once HANDLE.toolNear took the shover
  out of the opening (east back, 7 of 8 dice). In the middle they set, the can goes in and they meet him in its flash. Re-run eight shipped dice (four
  `--hard`) and count `Blue …: → dead` / `Red …: → dead` lines after ANY change to the door tools or these marks: the lesson passes with a man lost. Where the pairs go straight in
  on the word with no can (train-pairs' white house), no defender sees OUT of a door: a man in a far corner with his gun down the room shot the first of each
  pair as he crossed his opening (1 to 3 men on most paced dice). Each stands in the pocket behind the open leaf of the door he watches.
  (6) a held man: 'Right button chokes him out' (close.ts `CLOSE.heldClicks`, on in the page); the step counts the deed (`downed how: 'choke'`), not the row.
- **The tutorial's solo loud mission, `tut-solo` 'The fuel halt, alone'** (2026-10-22; row `tut-solo` in `TUTORIAL_MISSIONS`, played on the tutorial's frame, `game/rails.ts`: the bullet below; `tools/levels/tut-solo.ts` → `levels/tut-solo.json`, a quiet-kind mission alone with a
  `scenarios.lesson` of 25 steps on rails and its own `scenarios.issue` card; the fights are `levels/tut-solo.script.ts`, one PLAY program `tutorial` whose beats start on the cue each step sends,
  `lesson:<cue>`; the scripted player is `tools/qa/lessons/tut-solo.ts`). ONE LINE through a walled halt on a road, every doorway centred on it (`AXIS` 14.25: a door's middle sits on a
  walk-grid cell): the road and a shot-up van (move, sprint), the yard wall beside the gate (rifle up, take the wall, shoot the sentry, reload), the arch (crouch), the sandbags in the gun's
  court (stay low), the gap (smoke, cross), the nest (frag), the shop's locked door (pistol, the held key's ring for the charge, stand clear, the word), the man behind it, the store (stun
  can, go in), the code book, and the way back (rifle, load the grenade, back to the arch, the launcher's grenade on two men who come out into the shop's doorway BEHIND him, out by the gate). Seven men: the roster's five are held on their marks from the first frame (a man a beat has ordered is the program's until it lets him go, fails or stops) and two are spawned for the last fight (the floor holds eight characters, the dead included). RULES IT KEEPS: one hit downs the
  player, so no scripted round is aimed at him or at a place a line asks him to stand in (the sentry shoots the van and stops when the wall's line comes up; the gun shoots the parked
  truck, then TRAVERSES the sandbags' top a hand over a crouched head, then hoses the gap, then fires blind at where he was once a smoke can has gone off between him and the gap (the `threw` test's `area`: a can thrown the wrong way does not pass); nobody is let go on a clock (a slow
  reader was shot beside the door with the line still up): the shop man and the store pair go to the AI when the player stands in a trigger volume of the level (`shop_line`, `shop_in`,
  `store_in`: all a play program may ask of the player) plus a breath, or when one is hit; the last two shoot the top of the arch's wall over him until one of them is hit. THE LAST FIGHT FACES EAST ON PURPOSE: the launcher's grenade arms 8 m out and 8 m is the edge
  of the page's view in every direction but up the line to the east (10 m, and clear of the kit panel): played on the page with the two in the truck court they were 14 m off the
  left edge. Its line passes when a grenade has gone AND one of the two is down (a dud from inside 8 m leaves the line up and lets nobody go). THE FRAME'S KEYS are the generator's `FRAME` table, a step each: he can walk and turn the view from the first line and every other action comes on with the line that teaches it (sprint, the rifle, the wall, fire, reload, crouch, smoke, frag, the pistol, the held key, the word, the stun can, the right button); ten cues start the script's beats; FOUR CHECKPOINTS, each where a fight has just ended: the gate (the sentry is down), the gun (the nest is out), the shop (its man is down), the store (the building is his). A checkpoint stops the program, which lets every held man go for a tick: the script's `hold` beat (on the program's start) takes the living roster back, no flag is kept across one, and the last two are found by name before they are spawned. What the gate cannot lock: walking into a wall takes it from the first step (no key), and once the held key is his the ring's last wedge is the whistle (`handring.ts`: no key to drop) and a door's ring also offers pick and kick. THE HELD KEY ON THE PAGE is E and its choices are a ring at the cursor (`HANDRING`): the charge's line is written `[Space]`, the game's code, and reads E. THE CODE BOOK'S LINE ASKS FOR A TAP, and a tap does the top row: a body in arm's reach outranks an objective (`INTERACT_PRIORITY`), so the store's first man stands in the near corner, 3 m from where a man stands at the trunk (played on the page with him beside it, the tap dragged him), and the scripted player fails the step if the top row at the trunk is not the book's. Where the gun's key again opens its setup (`SLOTSETUP`) the grenade's line is its `setupLine` ('[2], then [2]'). His card carries ONE DOOR CHARGE
  (`issue.members.0.charges`: the validator lets a level issue the player his own, read only where his own charges are on, OWNCHARGE, which is the page): on the frozen stand the
  scripted player kicks the door and the lines still pass. A LESSON'S PAGE WEARS A LEVEL'S OWN CARD NOW (`kit.ts`: `kitIssue` speaks before `kitIssuedPage`; before, a lesson's page played the plain issue with a Player's built counts and left the block unread, so this mission's page had four smoke and no door charge): this level is the only lesson that carries the block, and the check's last line asks its page's kit (2 smoke, 2 stun, 2 frags, 3 rounds; one door charge on the page's stand). Checks: `lesson-run.ts tut-solo` on both stands, and `tools/qa/tut-solo-check.ts` (it raises the frame itself on the frozen stand; a plain `lesson-run.ts tut-solo` there wants `TPS_RAILS=1`; the two lessons about not being shot must
  be failable: the sandbags walked standing and the gap crossed with no smoke must each end with the player down; two mistakes must cost nothing: four seconds at each pier of the arch
  under the last two's fire, and a first grenade fired from too close; and THE CHECKPOINTS: down at the sandbags and again at the gap, Enter puts him back at the gate each time, the other three are put back by the harness a step after each is kept, and every beat is played again from its first line with the last two spawned once; `TUT_SOLO_BREAK=1` plays the standing arm crouched and must be red; green and its break red on both stands). Measured 10-22: 8 of 8 runs through (four seeds, both stands, a reader's pause of 0 to 12 s a step). The look it
  was built for is `?hour=dusk&weather=dust`; a row cannot carry its hour or weather, so picked from the list it opens at the visit's hour (night) and dry. Never seen on a GPU, never played by a hand; the pace wheel is not taught. Lines for other levels: `lesson.ts` `door` test state
  `charged` (a charge hangs on the door) and `threw`'s `area`; `director.ts` `c.stimulus.burst` now fires a roster man a beat holds (and at one), not only a spawned one; `rails.ts` the big line is the step's line AS THE KEYS STAND (`setupLine` where a gun's key again opens its setup); `lesson-run.ts`
  runs an `idleOk` step's script even when the step had already gone by, so its two arms press the same keys. `lesson-gate.ts` raises the frame for a frame level's frozen run and does not ask it 'the lesson off plays the same run' (a cue starts a beat of the level's script and a lock drops keys: another run by design; a NOTE line says so).
- **A tutorial mission is a lesson on rails** (`src/game/rails.ts`, `Game.rails`; rows in `scenarioList.ts TUTORIAL_MISSIONS`, `group: 'tutorial'`, first in
  the list; `lessonGroup(group)` in `scene/scenarios.ts` is what the kit-as-issued, no-Loadout and verdict rules ask now, so both groups get them). SWITCH:
  `RAILS.on`, on in the page (`?rails=0` = the level is its mission alone: a level whose lesson carries a `rails` record has NO lesson with the switch off), off in the module and on the frozen stand (`TPS_RAILS=1` raises it; a `FROZEN_HOLDS`
  row, in the knob registry and the journal). The seven Training levels carry no `rails` record and are untouched. WHAT IT ADDS to a level's `scenarios.lesson`:
  a `rails` record (`allow` = the actions that work from the first step, `respawn` seconds for a teammate who went down, `fog`, `sky` = nobody on the floor is
  the player: he is parked unseen, the view rides the squad's middle, the walk keys shift it) and step keys `allow` / `deny` / `cue` / `checkpoint` / `fog`;
  tests `cue`, `squad` (the living teammates inside an area), `view` (turned / zoomed / shifted by a hand), `stackOn.set`. LOCKED UNTIL TAUGHT: the gate
  (`Rails.gate`, ahead of everything that reads the seat's Input) drops every key code and button of an action no step has turned on yet (`ACTS`; pause, back and
  text size always pass); the host's Ctrl-turn and Ctrl-zoom ask `rails.locks()`. ONE BIG LINE: `Rails.prompt()` is the step's line, drawn low in the middle by
  `ui/overlay.ts` (`#railprompt`), `[B]` in a line drawn as a key cap with the player's own key (`keyCap`; `[Ctrl]` is the camera's key, whichever the board gives it: `camCap`, the Space bar on the page today), a pip per step; the small objective row is empty,
  and in the sky seat the kit and meter rows are hidden. THE LEVEL'S SCRIPT: `levels/<name>.script.ts` (a `LevelScriptFn`), registered by level name in
  `scene/levelScripts.ts` and attached by `levelLoad.ts`; one play program `tutorial`, started with the mission; a step's `cue` reaches it as the signal
  `lesson:<cue>`, each order the player gives as `order:<id>`, and it answers `done:<name>` for the `cue` test. A running play program does not switch the
  room fight off on a rails level, and the Director's spawn budget is 16 there (`liftedBudget`). THE SKY SEAT'S SQUAD holds where the mission stood it until its first order (an unordered man would fall in on the parked player), and the squad panel shows no key no step has taught (`Rails.locks` in `orders.ts`). THE MISSION AGAIN opens on the view the first run opened on (`Rails.hostView`, between ticks on the host's camera; `Rails.fresh` keeps that from counting as the hand's turn). CHECKPOINTS ARE AUTHORED: on a rails level the
  every-step save and the floor's own triggers are off; a step's `checkpoint` writes an in-memory save the tick it comes up (the program is stopped for the
  snapshot and started again next tick with the step's cue; a load does the same), so a beat must start fresh from its cue. A room clear on rails ends with the
  last step, not with the rooms. CHECK: `bun run tools/qa/rails-check.ts` (probe `rails`, family `missions`; ten lines: the block whole, switch off = the mission alone with
  no lesson, the first step parked and locked, one action a step, done by the deed, nobody lost, the room fight beside the program and no early end, a checkpoint
  put back, the journal, the mission again) passes on both stands and `RAILS_BREAK=1` (the gate passes everything) fails on both. THE FIRST MISSION `tut-sky` ('The halt, from
  above', `tools/levels/tut-sky.ts` on the pass's own geometry under snow — `tools/levels/pass.ts build(extra)` — with a roadblock and a gun truck with lit
  lamps on the road, shutters on the windows; `levels/tut-sky.script.ts`): the squad pinned behind its trucks, the view turned, zoomed and shifted; the first
  order under the squad's own smoke; a fight for the gate; stack and the word on two doors. Checkpoints: the road, the yard, the tea room. MEASURED: the
  scripted player (`TPS_RAILS=1 bun run tools/qa/lesson-run.ts tut-sky --seed N`) ends it on 8 seeds of 8 on the frozen stand and 4 of 4 on the shipped stand,
  55 to 70 s of play; `PORT=<port> node tools/qa/tut-page.cjs` plays it on the real page with real key and mouse events (software adapter: it steps with `__runFrames(n, dt, keys, 'none')`, which draws nothing, and takes a picture by reading one drawn frame back; on that adapter the first four steps were played so, the squad moving on the hand's own order under fire). NOBODY HAS: seen it
  on a GPU, felt it with a hand, or seen what the smoke does to the road fight (the harness has no smoke sight lines). FOUND: a teammate who has seen an enemy
  through glass he cannot shoot through stays rooted in 'alert' under an order (hence the shutters); a man a script holds runs no AI.
- **A par clock on a room clear** (`src/game/par.ts`, `Game.par`; block `scenarios.par { gold, silver, bronze, lossSecs }`, docs/level-format.md *Scenarios*;
  today `levels/killhouse.json` alone, row `killhouse-four` 'The kill house' in the list's 'On the clock' group, `untuned`): while that level's room clear is up the run
  is timed from the first order, Sam's first stride off his start mark (`PAR_START_M` 1 m) or his first round or throw, to roomclear's 'taken'; every teammate
  down at the end adds `lossSecs`; the total in WHOLE SECONDS AS SHOWN earns gold / silver / bronze / none (`medalOf`, `parResult` — pure). The clock leads the
  objective row (`mission.ts objectiveText` → `par.objective`), the result is said once on the HUD log and is `g.par.result()`. THE MODULE READS ONLY: `PAR.on`
  (knob registry; `?nopar`) off = the same run by digest, and a level without the block returns on every entry point's first line. One tick line in game.ts
  after `updateMission`; a `par` slice in savestate (unreached today: no checkpoint with a squad on the floor). THE BEST TIME IS THE PAGE'S: main.ts files it
  the frame the result first appears (`ui/parBest.ts`, localStorage, key = level file + way in + squad size + difficulty; never under god mode / no AI /
  unlimited ammo) and hands its words to `par.best()`, which only rewords the line already said; the debrief has one 'par' cell. Bars are set from 24 shipped
  seeds a way of play (`playthrough.ts` JSON: each run's `par`). `bun run tools/qa/par-check.ts` (`probes.ts par`; `PAR_BREAK=1` must fail). Numbers and the
  calls left: rebuild/missions/new/killhouse.md. Never seen in a browser. ITS DOORS ARE NAMED FOR THEIR ROOMS
  (`tyres` `bunks` `radio` `store` `mess`, + `front`, `back` and `hall` = the door that cuts the corridor; they were n1 n2 n3 s4 s5 mid): an id is SAID and shown
  (orders.ts `doorIdWords`: 'holding · store door'), and the HUD has no compass. The rule for every level: a door is named for its room, no compass word in a name.
- **One man to take alive on a room clear** (`src/game/snatch.ts`, `Game.snatch`, `__snatch`; block `scenarios.snatch { man, exits }`, docs/level-format.md
  *Scenarios*; today `levels/snatch.json` alone — `tools/levels/snatch.ts`, built on the look's kit, no second look file — row `snatch-four` 'The snatch' in the
  list's 'On the clock' group, `untuned`): an overlay on that level's room clear. The man is a CIVILIAN of the usual make (civilians.ts `spawnTarget`), put on the floor
  at every staging; gunfire or a teammate he sees sends him running for the nearest of the block's ways out; he gives up (hands on his head) to one of the team
  within `giveUpM` 3.5 m with a line to him, or to one standing between him and the way out he runs at within `haltM`; hands up with a man within `cuffM` for
  `cuffSecs` 3 = tied for good, hands up with nobody in sight for `boltSecs` 6 = he runs again. WON = the room clear's own 'taken' with him alive and in hand;
  LOST = he reached a way out or a round killed him (anybody's). The defenders do not know he exists and no teammate holds fire for him. HIS WORDS ARE HIS OWN (dialogue.ts `SNATCH_LINES`, picked by `snatch.voice` inside civilians.ts `civSay` / `civilianAnswer`: calm he says nothing, never the office worker's lines). `SNATCH.on` (knob
  registry; `?nosnatch`) off = the room clear alone; a level without the block returns on every entry point's first line. One tick line in game.ts after
  `updateMission`; his line stands over the room clear's on the objective row while he is loose; a `snatch` slice in savestate (unreached today: no checkpoint
  with a squad on the floor). `bun run tools/qa/snatch-check.ts` (`probes.ts snatch`; `SNATCH_BREAK=1` must fail); playthrough.ts `PT_SNATCH=cover|front`
  (the commander posts a pair at the back gate first / goes straight in). Numbers and the calls left: rebuild/missions/new/snatch.md. Seen
  only on the software adapter. Names a player reads carry no compass word: doors `front` `back` `side` `his` `hut` `back_room` `kitchen` (the last two were mb / mk),
  places 'the back alley' · 'the side yard' · 'the wash yard' · 'the courtyard'. His LIVE objective rows lead with 'objective ▸ ' like every other mission's (the two end
  rows do not; roomclear.ts's 'structure taken … not over:' line takes the prefix off).
- **A snatch ends in the van** (2026-10-19; `src/game/snatchout.ts`, `Game.snatch.out`, `__snatch.out` / `.exfil`). The maintainer, playing the snatch: "i was
  expecting to have to grab him and exfil him though (while my squad handles holding off the response force), not needing to clear the structure" · "like
  maybe we need to get him to a van near our infil". SWITCH `SNATCHOUT.on`: on in the page (`?nosnatchout` off), off in the module and on the frozen stand
  (`TPS_SNATCHOUT=1`), `FROZEN_HOLDS` row, knob registry, journal (`applyKnobs`: a recording from before the key replays with it off), debugger panel rows
  'a snatch ends in the van' and 'the squad covers the walk out'. It needs the level's word too: `scenarios.snatch.van { name, pos }` (docs/level-format.md;
  `checkSnatch`: floor, with a walk from his room) — a snatch level without it ends as it did. Off, or no van = the build as it was.
  THE END: tied (or out cold, or in Sam's arm) is no longer the end and the house does not have to fall — `roomclear.ts finish` says 'not over' while
  `snatch.owes`, and the win is the man IN THE VAN (`into`: he is off the floor, `civilianOff`; the debrief's line is 'Daoud is in the van'). The losses are
  the old two (through a way out · a round kills him), all the way to the van. HOW HE GETS THERE: a row on the tied man, 'on your feet — with me' (the rescue's
  own follow, `civilians.ts hostageLead`: he walks `gapM` behind whoever gave the word, wrists behind him) and 'stay here' to put him down; with the leader
  within `sendM` 3.5 of the van's doors and him within `sendHimM` 8 he walks the last steps himself (`civilianLedTo`) and is in it at `inM`. A man out cold
  or in an arm follows nobody and is in it when Sam has him within `carryM` of the doors (read, never run by a check). Nothing is won behind a leader who is
  down. His row is never the hands-empty click's takedown (game.ts, beside the rescue's hostages). Only the player gives the word today (`word(by)` takes a
  Character: which player, not the player). The objective row: 'objective ▸ get Daoud to the van', its mark on him until he is moving, then on the van.
  THE VAN is level data: `gwotKit.ts van()` (4.9 × 1.8 × 1.95 m, back doors open) parked outside the front gate about 6 m from where the team starts
  (`tools/levels/snatch.ts`). It is LEVEL DATA, not the switch's: it stands there with `SNATCHOUT.on` off too, and the level's digest moved, so a checkpoint
  or recording of the snatch from before is refused as from another floor.
  THE RESPONSE: the level now carries `scenarios.response` (the village guard, 2 men, by the back gate or round the wall to the front gate, 20–40 s after a
  man of the house lives `RESPONSE.callSecs` to report gunfire — docs/agents/enemies.md, the response team), raided ONLY under this switch (`qrf.ts raid`), and
  not called off when the house falls: only the snatch's own end does (`raidOver`). Two is what the sixteen-figure budget leaves (eight defenders, the four,
  the man): a bigger party means fewer men in the house, and that is the maintainer's call. `civilians.ts evacuationCheck` no longer walks the man a snatch
  came for off the floor when a team is called (it lost the mission on the spot).
  THE SQUAD (`SNATCHOUT.hold`, `?nosnatchhold`; no order of anybody else's is touched — a man whose order is another object than the one this module last
  saw, the player's or a drill's, planted or walking, is theirs until the man is next moved off): while he is being moved (led, or in Sam's arm or hands), of
  the men under 'fall in', one pair PLANTS (a silent 'hold' facing the way orders.ts `holdArcs` gives men left holding together, with nothing named to watch:
  cover.ts deals each man one of the room's doors or gaps, no two the same) and the other walks out with the leader; a planted pair left `trailM` 12 behind
  comes up at a walk ('moving.') and the pair with the leader plants in its place — one pair moving at a time, nobody called off a fight. A planted man is
  never put in a doorway or a gap, on the leader's way out (`laneM`), or on a mate (`spot`: the nearest free floor within `spotM`, or the pair stays in the
  file and is asked again half a second on); while one of them fights, or one has just gone down, the other's gun goes to where that is for `turnSecs`. At
  either end (won, lost) and at 'stay here' every planted man is back in the file. Nobody sprints (the orders' own pace cap; the check reads every
  teammate's speed on the walk out). One line said, once: 'holding here — get him out.' The panel's switch thrown mid-run stands the rule down (nobody led,
  nobody planted).
  CHECK `bun run tools/qa/snatchout-check.ts` (`probes.ts snatchout`, family `missions`; 30 lines; `SNATCHOUT_BREAK=1` fails 19 of them, `=hold` the
  squad's 7), ALL PASS on both stands; `snatch-check.ts` now asks for the old end by name (`SNATCHOUT.on = false`) and is 20 lines green on both;
  `PORT=<dev server> node tools/qa/snatchout-page.cjs [outDir]` plays it on the real page (software adapter). MEASURED (the scripted commander, who cannot be
  hurt and gives the squad no order on the walk out; `PT_SNATCH=cover`, shipped stand, standard, seeds 1–8): won 7 of 8 with 18 of 32 teammates up, the same
  with `SNATCHOUT.hold` off (7 of 8, 18 of 32) — the hold changes who stands where, not the tally: every teammate lost but one went down in the house fight
  before the word, and no planted man was lost at his post. The team was called in all 16 runs and arrived as the walk out began (tied at 20–34 s, in the van
  at 70–89 s). The hold run had 19 smells to 22 (no man left standing in a doorway). THE OLD RULE WITH THE VAN ON THE MAP (frozen stand, the rule off, the
  same plan and seeds): won 5 of 8 with 8 of 32 up, against 5 of 8 with 9 of 32 on the level as it was — the van costs the old snatch nothing that eight
  seeds show. NOBODY HAS PLAYED IT; never seen on a GPU; not measured on hard; the out-cold and in-arm ways into the van are read, not run.
- **Timed charges over a room clear** (`src/game/defuse.ts`, `Game.defuse`, table `DEFUSE` in the knob registry — no Tab row; block `scenarios.defuse`, docs/level-format.md
  *Scenarios*; level `levels/defuse.json` + its look file ← `tools/levels/defuse.ts` / `defuse-gwot.ts`; row `defuse-four` 'The two charges', group `clock`, untuned,
  `?levelFile=defuse.json&roomclear&squad4`): ONE clock (`secs` 75 from the team's first move or order, in the objective row; its last ten seconds tick wherever the player is)
  over two charges a wing apart — 'charge 1' / 'charge 2' in the end rooms 'workshop 1' / 'workshop 2', each workshop with a door from its wing (`shop_N`) and a back door
  from outside (`back_N`); no compass word in a name (the check holds it). Two pairs at once is the plan the clock rewards; all four one wing then the other is a real but
  worse one (numbers below). THE ROW DEPLOYS AT FOUR ONLY (`ScenarioEntry.only`, scenarios.ts → `loadout.ts squadChoices` greys the other sizes with the row's own line, as a
  Training row at its own size: a design rule, NOT `CANNOT` — the level still stages a pair from a URL or a harness tool, and `loadout-stage` knows the two apart). A charge is
  made safe by `workSecs` 6 s at it: Sam's Space row 'make it safe' (a sustained verb; with HANDWORK on he is planted by `handwork.ts samWork` kind `'defuse'`, LMB lets go) or
  a teammate through the squad's work order (`workthings.ts` thing kind `'device'`, verb `'defuse'`: X on it, 1 — needs `WORK.on`, so the frozen stand has only Sam's row;
  `work.onDevice(i)` = the man with his hands on it, else the one walking to it). The objective row names who is on a charge ('· Red One on it') and the marker stands on
  the charge nobody is working. The clock at zero = `frag.ts blast()` at every live charge and the row reads FAILED — and STAYS failed: the room fight plays on, but a
  'structure taken' after it is not a win (roomclear.ts `finish`). Won = both safe AND the room clear 'taken'. The clock stops (end `'over'`, no blast behind the card) only
  when Sam goes down or the room clear itself ends 'wiped'; the four down with Sam still up, it runs on. State is keyed to `g.mission` (a restart starts it over); the
  optional checkpoint slice `defuse` (`ran, st, by, end, sam`) is UNREACHABLE IN PLAY today — no checkpoint is written with a squad on the floor — so the check's 'save' lines
  ask `snapshot / restore` directly (a file that lies about `end` is read off its charges). A level without the block, or `DEFUSE.on` false, is the room clear alone by
  digest (a paired run on the defuse level itself). QA: `bun run tools/qa/defuse-check.ts` (`probes.ts defuse`, in family `missions`; passes on both stands;
  `DEFUSE_BREAK=1` must fail), `TPS_PROFILE=shipped bun run tools/qa/defuse-run.ts [--arm split|whole|split-back|whole-back|sam|both|backs|all] [--seeds 1-12] [--jobs 2]
  [--secs 100 --clocks 60,75,90] [--trace arm:seed]` (a scripted commander; `--clocks` reads one long-clock run as every shorter clock; a last defender who has walked out
  of the house is hunted by a 'move' to where he stands). 12 seeds as shipped at 75 s ON THE LEVEL'S OWN FOOTSTEP MAP (below), won · teammates up of 48 before any blast: two pairs through the wings 12 · 29, all
  four one wing then the other 5 · 25 (a charge went off 5), pairs by the back doors 9 · 24, all four by the backs 10 · 40 (the grass behind the house is quiet: on the office's map it was 6 · 25; its last charge is safe at 69 s of the 75, so a slower hand than the script's does not make it), the player on one charge himself and the four on
  the other 11 · 32; at 65 s both 'together' plans won 0 of 12 and the split ones the same 12 / 9 / 11, at 70 s together 2 and 8, at 90 s 10 and 11. Page rebuild/missions/new/defuse.md. Never seen on a GPU. THE LEVEL CARRIES ITS OWN FOOTSTEP MAP (`surfaces`, written off the generator's slabs: grass behind the house, lino hall, stone workshops, carpet wings, asphalt lot; it used to get the office's rectangles): playthrough.ts's commander as shipped, 24 seeds, taken · teammates up of 96: 23 · 67 with the office's map → 21 · 64 with its own (8 of 24 runs the same; chaotic per seed, not read as a difference).
- **A room clear issues its own wall charges** (`src/game/issue.ts issueStage`, one line in nightbreach.ts after the kit's staging; field `scenarios.roomClear.wallCharges: N`
  (1‥9), docs/level-format.md *Scenarios*): the squad carries AT LEAST N wall charges for the run whatever the kit cards say (`WallCharge.raiseCarried`: raises, never lowers;
  the kit's store is neither read nor written; a level without the field returns on the first line). No switch. Today `levels/mousehole.json` alone (+ its look file ←
  `tools/levels/mousehole.ts` / `mousehole-gwot.ts`): row `mousehole-four` 'Mousehole', group `strongholds`, `?levelFile=mousehole.json&roomclear&squad4` — a clinic of three rooms
  and a duty room off ONE lit corridor the duty room's hatch gun looks down (a mark at (29.8, 16.0) has a LINE to all three room doors on every deal: `checkStructure` does not hold
  that, so re-ask it after moving the duty room's furniture. A LINE IS NOT HIS EYE (as measured BEFORE `GUARD_EYE.far` — enemies.md, *A lit man is seen from past 16 m*: on the page a man standing in light is now seen out to 26 m, so re-measure these doors lit): guards.ts `GUARD_EYE.range` cuts every eye off at 16 m whatever the light, so, measured with a lit player
  stood in the corridor four seconds, he is alert at the exam door in 3.1 s (11.8 m) and at 8.8 m in 2.1 s, reads 0.05 at 13.8 m, and never notices a man at the ward door (17.8 m) or the
  front door (20.7 m): no mark in the duty room is inside 16 m of either), nine defenders in four squads that stay home (`mayLeave: false`, each room's own door its `barricade`), five
  charges, the route yard → ward → exam → store → duty room through blank wall and partitions. TWO WAYS IN (`starts[]`, the sheet's 'Way in' row): the dark north yard
  (the walls) and the dark east side on the fire exit — steel, its lock on the inside face, so from outside it opens to a hand (a door charge is refused on steel) and the
  squad comes in behind the hatch gun. TWO THINGS IN THE LEVEL ARE THERE FOR THE STAND-OFF RULE (`wallcharge.ts safePosts`) and must stay: the chest-high steel cupboard in the
  store (somewhere out of the fourth charge's line inside the store) and the FRONT DOOR on the corridor's west end (with an open arch the corridor flooded out to the lot, was
  'open floor' to cleared.ts, and the squad was sent to stand off in it under the hatch: 41 of 96 teammates up against 69). `bun run tools/qa/wallissue-check.ts` (`probes.ts
  wallissue`, in family `missions`; both stands; `WALLISSUE_BREAK=1` must fail); the scripted wall commander `PT_WALL=1 PT_WALLOUTER=1` (`PT_WALLDBG=1` = why a site was refused),
  the second way `--set '{"ROOMCLEAR":{"way":2}}'`. As shipped, 24 seeds, won · teammates up of 96: walls from the yard 22 · 69, doors from the yard 0 · 0, doors from the
  east side 19 · 49, WALLS from the east side 24 · 96 (the soft side: the duty room falls first, from behind, and nobody is lost — the maintainer's call whether that way in stays); with a player who can be hurt (`PT_MORTAL=1`) 11 · 0 · 20 won (the scripted player stands in line with the third hole). Page
  rebuild/missions/new/walls.md. Never seen on a GPU. The level carries its own footstep map (`surfaces`: grass yard and east side, lino corridor and rooms, carpet duty room, stone store, asphalt lot) — walls from the yard, 24 seeds, is 22 · 69 with it as without, run for run. `levels/floodlit.json` ('The floodlit yard') has one too (lino hall on a stone slab, asphalt yard: 21 · 36 → 20 · 35 of 96, one run of 24 moved), and its doors and rooms are named for the rooms (`guard_room` `radio_room` `store` `foot_gate`, rooms 'guard room' / 'radio room'; they were hw he es gate_w, 'west room' / 'east room').
- **The floodlit yard's idea has flipped** (`levels/floodlit.json` ← `tools/levels/floodlit.ts`, row `floodlit-four`; found 10-15, NOTHING CHANGED IN THE LEVEL). As shipped
  on the build of that day (385850ee, `bun run tools/qa/ships.ts --scn floodlit-four --seeds 1-24`, standard, scripted commander; won of 24 · teammates up of 96): lights
  left on 22 · 72, the mains cut first (`PT_BREAKER=order PT_NV=1`) 17 · 47 — on 10-11 they were 20 · 35 and 23 · 64. WHY, one table off at a time on the same seeds:
  the dark with the defenders' grenades off (`--set '{"FRAG":{"defenders":false}}'`) 23 · 79, with the alerted men's gun lamps off (`DARKFOE.on`) 20 · 66, with the longer
  eye off (`GUARD_EYE.far`) 17 · 47; the light with those two off 74 and 75, with the door lead's stand off (`HANDLE.toolNear`) 21 · 61. In the dark 32 of the 49 lost
  fall to grenades thrown into the hall (the run's `fragTheirs.teamKilled`; 12 bursts, 5 and nobody with the lights on): `frag.ts dealCarriers` hands the floor's three
  to the last three men dealt (a hash of ids, promised by nothing), here both radio-room men and the store man, whom a lit entry shoots through their window from the
  gate and a dark entry from the shed leaves alive beside the hall. The lit entry's 35 → 72 is the squad's door sense over several steps (48 → 66 at 917eb73a alone).
  TRIED ON THE LEVEL, measured, not landed: the foot gate moved, dark window rooms, both men at each window, weaker lanterns, a narrower and a wider gate, no gun lamps
  issued — none holds on fresh seeds; THE GUARD ROOM LISTED LAST in `roomClear.rooms` (the grenades go to the store man and the guard-room pair) gives lit 21 · 62 and
  dark 23 · 81 on seeds 1-24, 21 · 58 and 23 · 72 on 25-48 (paired over 48: the dark better by 33 of 192, 95 % 7 to 59), and floodlit, secondway, doormenu,
  ordereddoor, rearread, threshold (but its expected red on the registry) and toolnear-check pass on it on both stands; lived-check wants the landing commit in
  `BASE_REVS`. A SECOND ONE, LANDED 10-16 on the maintainer's pick ("Hall lockers" of room order / hall lockers / neither): a bank of lockers end on to the hall's back wall (one lived piece, `P.counter(17.35, 7.05, 0.45, 1.7, 0, 1.8, …)` in the hall's lived
  list: gone with `?lived=0`, the level with the switch off unchanged, lived-check green with no new base) takes the flip away without bringing the idea back: lit
  23 · 73 and dark 23 · 76 on seeds 1-24, 24 · 75 and 22 · 68 on 25-48 (bursts into the dark hall 12 → 3, killed by them 32 → 5); both together 21 · 65 and 20 · 67.
  As landed (`P.counter(17.35, 7.0, …)`, flush to the back wall; the hall's fire buckets moved half a metre along the wall, clear of them), with the lamps outside
  the wall (below), build 2875859e, seeds 1-24: lit 22 · 77, dark 23 · 78 (bursts 2, killed by them 4; without the lockers, the lamps' own runs: 22 · 75 and
  17 · 47). The two plans are level: cutting the mains is no longer the worse plan and is not the better one either. WHAT THE LOCKERS DO IS SHADE THE HALL'S
  LANTERN, NOT GIVE COVER (found by review after the pick, then measured): the lantern stands on the floor in the corner west of them, so with the mains out the
  guard room's side and a wedge towards the front door stay lit (0.5 by the guard room's door) and the back wall mark, the far corner mark and the radio room's
  door go from 0.55 / 0.24 / 0.15 to 0.00 on the headless meter, a tube reading nothing there either; with a second battery lantern stood east of the lockers
  (the lockers unmoved) the dark entry is 15 · 48 with 11 bursts and 28 killed by them, where it was without lockers. So this is the "weaker lanterns" lever
  made local to the hall, held on seeds 1-48 as first tried and again on 1-24 as landed; floodlit-check reads both sides of it on the shipped stand (the lantern's side for line 3, the shaded marks under
  0.2) and the lantern reaching the back wall on the frozen one; move the lockers or the lantern and the tallies move. The page's meter counts bounce the
  headless one does not: the far side will read above 0 there, by how much nobody has measured. Lockers on the east wall instead do not export (a hall mark
  stands there). THE SAME HOUR THE GOGGLES' INFRARED LIGHT LANDED IN THE BUILD (`IRLIGHT`, team-feel.md) AND MOVED ALL OF IT: on the join with it
  (build 8c81bf8e, seeds 1-24) the lockers are worth nothing that 24 seeds can show: lit 23 · 79, dark 20 · 60 with them (bursts 9, killed by them 18) and dark
  20 · 56 without (7, 19); the step before the infrared light's is the 23 · 78 above, the step with it 20 · 60. On that join the room order gives lit 20 · 61 and
  dark 22 · 76, the room order and the lockers lit 20 · 64 and dark 23 · 81: the room order is again the only thing measured that makes the dark entry the
  better one. The lockers stay in as the maintainer picked; the room order stays
  not landed, put to him again with these numbers (run files rebuild/missions/new/audit/floodlit-lockers-2026-10-16/). Either stops his two live tapes of the level re-running on the current build (the recordings goal ran it: with the room order a re-run
  is not refused and parts at the first step, `savestate.ts levelFingerprint` does not read the rooms' order), and the room order leans on that accident of the deal. The proper fixes are other
  goals' (a level field for who carries a grenade; a squad caught by a grenade in a closed room leaving by the door beside it). Patch
  rebuild/missions/floodlit-room-order-2026-10-15.patch and floodlit-hall-lockers-2026-10-15.patch beside it; page rebuild/missions/new/floodlit.md. Nobody has played the lockers or seen them on a GPU.
- **The floodlit yard has lamps outside its wall** (10-15, the maintainer at the start with the mains on: "lighting looks very flat here for some reason, not
  like the other night rainy levels"; `tools/levels/floodlit.ts`, the LIVED block: on in the page, `?lived=0` puts them out with the rest of the lived things;
  off on the frozen stand, `TPS_LIVED=1`). THE REASON: a thin moon AND no lamp out there. Its moon is 0.04 (`K.moon(k, undefined, 0.04)`; the office and most
  kit levels have 0.9; the depot 0.05, the pass 0.06 and the glasshouse 0.15 are thin too, and each has lamps outside), kept thin on purpose — the moon
  counts on the page's meter, and at 0.9 the yard with the mains out reads 0.61 by `nvg.ts nvgPlaceLight` where the lit yard reads 1.00 (0.3 → 0.40,
  0.1 → 0.21, 0.04 → 0.07‥0.13). So outside the wall there was the sky's even fill and nothing else: no pool, no shadow, wall, ground and men one grey.
  THE MEND keeps the moon and adds light that DIES WITH THE MAINS: a bulkhead lamp on the outer face of each gate post (`lived.yard.gate_lamp_w` / `_e`,
  a spot at 17 thrown out and along the wall away from the gate) and one over the shed's door (`lived.shed.door_lamp`, 30), group 'exterior' like the
  floodlights, each with a lived fixture box that can be shot out. The first lived LIGHTS in any level (`scene/lived.ts` has always taken them): no new
  base in `lived-check` (ALL PASS as it stands), the frozen stand's level is the file it was. THE GATE LAMPS ARE HELD UNDER THE GOGGLES' LINE: at 50 the
  five start marks read 0.29‥0.62 across `NVG.darkAt` 0.5 and the team stood up half goggled; at 17 they read 0.07‥0.40 (0.17‥0.42 with the moon), Sam's
  0.25, and all four stand up goggled as before. Lit by them too, not only the start: the outside of both gate jambs, the walk along the wall, and (the shed's
  lamp) the outside of the west foot gate, about 0.95 — a mains-on entry by the foot gate was not measured. `floodlit-check` line 1 is by the stand now
  (lived in: every start mark under 0.45, Sam's over 0.15, the shed door bright; lived out: the start and the shed door dark, the old line), and a new
  line on both: no defender has a line to a start mark or to the shed's door (`FLOODLIT_BREAK=1` still fails its two lines on both stands). MEASURED, 24
  shipped seeds a plan on the build of e0afe046 (won of 24 · teammates up of 96), the lamps against the same build without them: lights on 22 · 75
  against 22 · 71 (paired +4, se 7; 6 of 24 runs the same run); mains cut 17 · 47 both, all 24 runs the same run to the second. SEEN ONLY ON THE SOFTWARE
  ADAPTER (a scratch copy of `page-look.cjs`, quality low, 960×540: the start, the gate from outside, the shed's door; the same view at moon 0.04 / 0.3 /
  0.9 and Mousehole's start for the comparison): never on a GPU. At the start the two pools frame the men and the men are still mostly shapes against
  them — that is the price of the goggles' line. TRIED AND LEFT OUT: a third lamp at the wall's south-west corner (it takes the near man over the line
  before it lifts Sam's reading). NOT DONE: the back strip and the east strip are as dark and as flat as they were (a lamp over the store's back door
  would light the men stacked on the second way in); the moon itself (the debugger's 'moonlight' row moves it live). The level's recordings made before
  this do not re-run on the page (the fingerprint moved), as with either trial above.
- **A kit issued by the level** (`src/game/kit.ts kitIssue`, table `ISSUE {on}` in the knob registry; block `scenarios.issue { members: { '<place>': {…card
  fields} } }`, scene/scenarios.ts `IssueData`, docs/level-format.md *Scenarios*; today `levels/hall.json` alone, row `hall-four` 'The long hall' in the
  list's 'Raids' group, `untuned`): on a level that carries the block every staging (`kitPlayer`, `kitStage`) runs under the ISSUE cards with the block's
  fields written over them — `asIssued`, the Training pages' own road, so the table and its store stay the machine's: nothing kept is worn or written — and
  no visit to the loadout screen is needed (its loadout screen shows no cards and says so, with who is handed what: `ui/loadout.ts` over `ui/missions.ts issuedKit`, `loadout.ts issueNote`). A Training level's page speaks first (a lesson's level with the block = the block
  unread); your own counts are written as any card's. `?noissue` (`ISSUE.on` false, a journal's table) or a level without the block = the staging as it was. The long hall handed the first teammate (place
  '1': Red One of the four, the one size its row deploys at — `ScenarioEntry.only`) the ballistic shield and two stun canisters UNTIL THE SHIELD LEFT THE GAME (10-18): its block is empty now (`members: {}`) and every man stages on the plain issue. THE LEVEL: four rooms off one bare hall 23 m long whose two men stand in its dim far end, guns on the one door in;
  the HALL IS ITSELF A STRUCTURE ROOM (door 'front') because a room clear's staging shuts every door a structure room lists — a gun authored behind an open
  door is staged behind a shut one. Doors are named for their rooms (`bunks`, `kit_room`, `store`, `ready_room`: an id is SAID, orders.ts `doorIdWords`). MEASURED WHILE IT HAD THE SHIELD (history), 24 seeds as shipped, teammates up of 96 · the far guns' kills: no issue 43 · 16, the shield and the usual entry 60 · 12, the shield walked down the hall first with the others told onto the line behind him 81 · 1 (playthrough.ts `PT_HALL=file`, tool only: one man addressed, 'move there', 'cover'; `low` = crouched, nothing gained; `bare` = the same walk led by a rifleman with no issue, 55 · 2 — in the hall it is the FILE that beats the far guns, the plate pays at the rooms' doors after). A clear plan for 'front' with both points on the door's line was tried and is not in the level (40 · 38). WITH THE ROOMS FURNISHED (the level's lived-in things, on the shipped stand: bunks, a kit room, a store, a ready room — the hall itself stays bare; its look file `levels/hall-gwot.json` ← `tools/levels/hall-gwot.ts`: a border scouts' wing, a range card painted down the hall in pale sky blue), 24 seeds, won · teammates up of 96: the usual entry 22 · 56, the file 23 · 79 — the numbers before them are the bare rooms'. `bun run tools/qa/issue-check.ts` (`probes.ts issue`, in family `kit`; `ISSUE_BREAK=1` must fail). Numbers, what was tried and the calls left: rebuild/missions/new/hall.md. Never seen in
  a browser. WITHOUT THE SHIELD (out of the page 10-15, gone from the game 10-18: docs/agents/player.md; Red One carries the plain issue, rifle,
  charge and frag included: the squad counts 3 stun 2 charges 2 frags, not 3 · 1 · 1; level and row untouched but for the card's words). MEASURED on the build of that day (050a8a3f, `bun run tools/qa/ships.ts --scn hall-four --seeds 1-24`,
  the shipped stand, standard, scripted commander), won of 24 · teammates up of 96 (± one standard error): as the page is, the usual entry 10 · 12 (± 3; 14 runs
  wiped, 44 of the 84 deaths one far gun's) · as the page is, the file walked down the hall first and the others told onto the line behind (`PT_HALL=bare`) 20 · 66
  (± 5) — and with the shield put back for the comparison (a `--set` of its table, which no build has now): the usual entry 13 · 28 (± 4), the file led by the plate
  24 · 84 (± 3). WHAT THAT SHOWS AND NO MORE: taking the card away (the plate and a pistol for his rifle, a charge and a frag) costs each plan 16 to 18 teammates of 96
  (three standard errors each, unpaired arms); the hall still has its answer without it (the file: 20 of 24), and the obvious entry is now lost more often than won. The usual entry had ALREADY fallen
  from 22 · 56 to 13 · 28 with the shield still on, and ONE RULE did that: a lit man seen from past 16 m (`GUARD_EYE.far`, docs/agents/enemies.md 'THE LONG HALL IS
  WHERE IT BITES'; the hall is 23 m and its far pair now see the men at the lit door). Found by playing the same 24 seeds down the build's history (shield on, the
  usual entry): the build of 10-11 22 · 56, the windows and outward doors of the second way in 20 · 50, the step before the rule 20 · 49, the step that brought it
  10 · 18 (paired by seed −1.3 teammates a run, standard error 0.3); and on the build of 10-15 with the rule alone put off (`--set '{"GUARD_EYE":{"far":false}}'`)
  21 · 58 with the shield, 18 · 42 without it. The level's own changes are not it (10-15's build on the floor of 10-11: 15 · 31). Nothing was retuned. Whether the
  mission keeps its place on the list without the kit it was built round is the maintainer's call (the kit slots goal put it to him). Nobody has played either plan by hand.
  - **Since** (10-18): the ballistic shield is GONE FROM THE GAME, not switched off (player.md, 'The ballistic shield is gone from the game'). The hall's issue block is
    empty (`levels/hall.json`, `hall-gwot.json`, `tools/levels/hall.ts ISSUE`), the four carry the plain issue on EVERY stand, and its row on the mission list says nothing of
    one. This bullet's first numbers are the hall as staged with one (history); the ones under WITHOUT THE SHIELD are the game as it is. `PT_HALL=bare` still walks
    the first teammate down the hall; `PT_HALL=file` and `low`, the same walk led by the plate, are refused in words. The frozen stand staged the shield here until the cut, so its hall-four digests moved to the shipped stand's of the day before;
    no other mission's did (playthrough.ts, the 21 loud missions × seeds 1-3 on each stand, digests against the build before the cut).
- **A strongroom reached past cameras and beams** (`levels/vault.json` ← `tools/levels/vault.ts`, built on the look's kit, no second look file; row `vault-quiet`
  'The counting house' in `QUIET_MISSIONS`, group 'quiet-alone', `untuned`; `?levelFile=vault.json&quiet`, alone; level data only, no game code): a walled money house at
  night, the ledger in a safe. Two gates, each lit and under a lens (`cam_yard`, `cam_east`, mains); each dark way crosses a beam (`beam_strip` chest high, battery,
  suspicion; `beam_court` at the shin, mains, alarm); the strongroom has a keypad door (`strongroom`, pad `pad_strongroom`, under `cam_room`) and a back door that
  picks. Four deals. `TPS_PROFILE=shipped bun run tools/qa/vault-run.ts [--plan round|code|pan|short|mains|shoot|all|each] [--seeds 1-24] [--moon]` = a scripted
  player (an unknown flag exits 2). 24 seeds, moon counted, clean = out, no device, nobody roused, no wait given up: devices answered 24 · the clerk's code 19 (24
  out) · waiting on the lenses' pan 13 (24 out) · the same walk with the devices ignored 0 (13 out, 11 down) · the breaker first 0 (down 24; thrown 7, mains back in
  2 s). THE SAFE IS NOT WIRED (game/takecheck.ts: nobody is sent to it after the take; those are the numbers as shipped, re-played 10-12. With the old rule,
  `TPS_TAKECHECK=0` in front, the man sent to the safe left his beat: pan 20, devices ignored 9 out and 15 down, the other three the same). `probes.ts vault` (family `missions`; `VAULT_BREAK=1` must fail). Page rebuild/missions/new/vault.md. Never seen on a GPU.
- **Quiet missions on any level** (rows in `scenarioList.ts QUIET_MISSIONS` — NOT in `SCENARIOS`, which stays the squad's table for every tool that walks it; the list reads `ALL_MISSIONS`) (`src/game/quiet.ts`, `Game.quiet`, `__quiet`; author's page rebuild/play-style-levels/quiet-missions/contract.md; block
  `scenarios.quiet`, docs/level-format.md *Scenarios*): kind `quiet`, squad 0 (alone) or 1 (one partner: pair rules + silent held on for the run, staff hostile to
  him — `teams.ts staffVsOperatives`, put back by `release()` — each switch only while it still stands as the run wrote it, so a row moved by hand mid-run stays; the switches FOLLOW THE GAME THAT IS RUNNING: `quiet.current()` in the constructor, `update`, `step` and `restartEncounter` hands another Game's run's back and takes this one's, so a dropped Game leaks nothing and two Games in a process each get their own frames; the three pair parts go on through `pairUpApply`, so `SNEAK=off` / `?sneak=0` still holds one off). `?levelFile=<f>&quiet[=pin][&squad=1]`:
  the seed deals a start, a spot and a patrol set (benched routes leave `g.guards`; `beforeRestart` writes `level.mission` / `playerSpawn` for the encounter,
  `stop()` puts the authored ones back); mission.ts reads the dealt spot, every exit (`outThrough`), and the level's own words. `quiet.ts holderStand(g, front, area)` is THE floor at a holder's face (free, in the room, nothing solid between it and the face): `checkQuiet` validates that cell and the guard sent to look walks to it. A staff man who drops the partner is back on Sam, his hunt standing (guards.ts `acquireFoe`). The cards offer a checkpoint through `saves.offer(g)` (an earlier run's slot only if `canLoad` takes it); autosave labels and room triggers are the level's own words while a quiet mission is up. `quiet` beside a stale `squad4` is the quiet mission; the night breach and the rescue refuse to start over one. EVERY new branch keys on
  `g.quiet.active`, on the level carrying the block, or on `HOSTILE.guard.operative` — a level without the block is base by digest. Checkpoints alone carry the deal
  (`SaveState.quiet`). WHO IS TOLD WHEN THE THING IS TAKEN (`src/game/takecheck.ts TAKE.wired`: ON in the page — `?takecheck` = a man sent after every take, as it was — OFF in the module and on the
  frozen stand, `TPS_TAKECHECK=1`; a `FROZEN_HOLDS` row, in the knob registry and a journal's tables, a recording from before the key replays with it off; no Tab row; the maintainer, 10-12:
  "predictably getting a guard to come by when you pull the objective is a bit contrived. makes sense for the server rack in the office but not the officer files"): mission.ts `drivePulled`
  arms the seven-second errand (`sweepAt` → `sendRackCheck`) only where `takeTold(g)`: always on the plain night (the office's rack drops off the network), and on a quiet mission only at a
  spot the level marks `wired: true` (scenarios.ts `QuietSpot.wired`, docs/level-format.md *Scenarios*: the holder is on a network or an alarm — today `quiet-relay`'s middle rack, and Training 1's trunk, whose last step is the man who comes to look). The
  take's own clunk is still in the hearing model, so a man near enough to hear it still comes; a man questioned says 'somebody's been sent to look' only where somebody was. The solo-night quiet tallies in this file were played with the errand on every take (the vault's are the rule's own since a re-play on 10-12; lights-out's 240
  runs are the same run for run either way: its pair is out of the gate 6.5 s after the take). `bun run tools/qa/takecheck-check.ts` (`probes.ts takecheck`, in families `quiet` and `missions`; both
  stands; `TAKECHECK_BREAK=1` must fail). The Missions list draws GROUPS (`scenarios.ts MISSION_GROUPS`, `ui/missions.ts groupOf / groupHeads`: training · raids · strongholds · on the clock · quiet alone ·
  quiet as two — every mission under exactly one, eight at most; a row that names none: quiet by its team, a rescue 'clock', else 'raids'; `?nogroups` = `GROUPS_UI.on` false = the list drawn as it was, in its table's order, the start page's under 'Every other mission'). Levels built for it: `bazaar.json`, `police-post.json` (alone; rows `bazaar-quiet`, `police-post-quiet`), `quiet-yard.json` (the test yard, alone and as two). QA: `probes.ts quiet` (seven; `quiet-fixes` = the review of the join), `tools/qa/quiet-check.ts` (also red on two men under one name: `CALLSIGNS` holds seven), `solo-night.ts --level <f> --quiet [pin] [--squad 1] [--exit <way out's name>] [--ghost]`; the missions gate plays quiet rows
  with solo-night (`missions-gate.ts`: eight seeds a row run by name, two inside `probes.ts missions-shipped` so a family stays under gate.sh's cap — `MISSIONS_QUIET_SEEDS=1-8` there plays the eight —, `--quiet-seeds`, each line saying how many of the level's deals they were; the ghost goes round a man standing in its way where the floor has another way, else stands off up to a minute for him to walk on).
- **A quiet level built for two** (`levels/lights-out.json` ← `tools/levels/lights-out.ts`, on the shared walled yard `train-ground.ts`, one file; row `lights-out-two`
  'Lights out, as two' in `QUIET_MISSIONS`, group 'quiet-two', `untuned`, squad 1; `?levelFile=lights-out.json&quiet&squad=1`; level data only, no game code, no switch): a
  radio house in a walled compound at night, a codebook in a strongbox. The front door is under a lamp and a lens (`cam_door`); behind it the hall is crossed by FOUR
  beams 0.3 m apart (`beam_hall1‥4`: more than the OCP holds dark at once) under `cam_hall`; all of it on the mains. The breaker is in a generator shed across an
  inner wall. The hall has a WINDOW and a lantern on its own fuel, and the north side's man stands at the window looking in — and he is the man the game sends to
  the panel (the nearest by the straight line lighting.ts measures). So a breaker THROWN takes the grille and the watcher off the hall for 16.7 s (his walk + the
  reset), shorter than one man's way from the panel to the door, which also meets him; a panel SHOT dead (permanent, lighting.ts) gives the watcher back to a lit
  hall. THE BACK ROOM'S DOOR (`inner`) IS LOCKED on its hall face, no key on any belt: 4.2 s on a knee at the keyway, under the lantern, in the window's view (the
  window is 1.2 m wide, the lantern at mid-hall, for that). Played as built: the partner waits in the fuel cage ('hold in the dark'), Sam at the wood store by the
  door; X on the panel, 1 = 'throw the breaker'; X on the cage, 1 again once it is dark (the man coming to the panel must not find him); Sam is past the grille 6.5 s
  into the dark and has the lock picked at 10.9 s of its 16.7. Two deals (one start, two patrol sets). `TPS_PROFILE=shipped bun run tools/qa/lights-out-run.ts
  [--plan pair|stay|alone|dash|shot|rush|kick|choke|left|tail|all|every] [--seeds 1-24] [--delay s,…] [--moon] [--trace]` = a scripted player, input only but for
  `g.selectVerb` to pick a row (orders by X and a digit; an unknown flag exits 2); it times every plan off the guards' own state (where each is, how long he will
  stand, his errand). 24 seeds ARE THE LEVEL'S TWO DEALS (15 runs of one, 9 of the other; the pair's 24 are two distinct runs), moon counted, out / clean of 24
  (clean = out, no device, nobody roused or put out cold, floor never raised, never seen, no round fired — so a plan that shoots the panel is never clean BY
  DEFINITION: read its 'out'): the pair 24 / 24 (GHOST 24, mean 89 s; 24 of 24 over start delays 0‥75 s) · the same route alone,
  the breaker thrown by his own hand 0 / 0 · that at a sprint 0 / 0 · the partner brought and left in the cage 0 / 0 · a round through the panel, then low under the
  window as the sentry turns 0 / 0 · the same at a sprint (`rush`: out 2 of 2 with GHOST 100 BEFORE the lock, shot at the keyway since) 0 / 0 · that with the lock
  booted, not picked (`kick`: in the back room a second sooner, shot there 4‥6 s later) 0 / 0 · the pair without its second order 15 / 0 · the partner trailing
  Sam, never spoken to 8 / 0 (seen on all 8). ONE LONE WAY GETS OUT, and the level does not stop it (`choke`): the panel shot, the floor left to settle, the
  window's sentry choked out from behind, then in with nobody watching — AT LEAST 12 of 24 out (10 of 15 on one deal, 2 of 9 on the other; 8 of them GHOST 99 on the card: a knockout
  costs a point and a panel shot nothing; of the 12 lost, 8 are shot on the stalk and 4 after his body is found), mean 2 min 27 s out against the pair's 1 min 29 s.
  A FLOOR, NOT THE ROUTE'S WORTH: the script waits for him in the moon's light and never moves the body. So what the pair buys is the one way found that touches
  nobody and fires nothing, and the quick one — not the only way out. Not scripted: the choke followed by the breaker thrown by hand, a round at the lantern. `probes.ts lights-out` (family `missions`; `LIGHTSOUT_BREAK=1`
  must fail). Devices and the exit ask only the player: the partner is left in the cage at the end. Page rebuild/missions/new/duo.md. Never
  seen on a GPU.
- **Glass is not cover: the glasshouse** (`levels/glasshouse.json` ← `tools/levels/glasshouse.ts`, built on the look's kit, no second look file; row `glasshouse-four`
  'The glasshouse' in `SCENARIOS`, `untuned`, filed under 'Raids' (the list's own cap is eight rows a group: `probes.ts missions-list`); `?levelFile=glasshouse.json&roomclear&squad4`, `&way=2`; level data only, no game code, no switch): a district seed station at night, seven men in four rooms.
  The whole front is glazed (the room called the glasshouse: six panes from 0.3 m off the ground to 2.4 either side of 1.8 m of block round the `front` door) and the
  walls between the glasshouse, the lab and the office are glass from 0.5 m to 2.4 (four panes: ten in all). The forecourt is floodlit off the eaves and THE GLAZED ROOMS
  ARE DARK, so men on the forecourt are seen from three rooms by men they cannot see, and the rounds come through the panes (glasspen.ts). The store is the one room
  with no glass: its own `back` door on the dark back lot, a bulb, and a row of SEED RACKS (kept boxes, group `store.racks`, floor to beams) down the room 1.9 m inside
  its `store` door to the lab, from the back wall to 1.44 m short of the wall the glasshouse is behind: the door is at the racks' closed end, in the back-wall corner
  (hinged on the corner side, `maxAngle` 1.5: open, the leaf lies along the back wall, its stop short of it), and the way round them at the other end, by the glasshouse's
  wall — so with every door leaf out no mark outside the store and no floor point of
  the lab, the office or the glasshouse sees the store's own side of the racks (the check asks it; keep the way round clear: a crate stack in it shut it once,
  `lived-check` found it). THE STORE'S INSIDE WAS MIRRORED 10-13 (door and way round traded ends): at the glasshouse end the `store` door stood 0.3‥1.5 m behind the
  full-height wall across the camera's view and was drawn from no spot, so no cursor found it (`probes.ts doormenu-drawn` / `doormenu-open`, red on this level until
  then) — A DOOR WITHIN ABOUT 1.9 M BEHIND A 3 M WALL ON THE CAMERA'S SIDE IS NEVER DRAWN: hang it further back. TWO WAYS IN (`starts[]`), BOTH DARK AND OUT OF EVERY MARK'S SIGHT: the side yard beside the building, round the corner
  from the glass (a 16 m walk to the front door along the lit panes, or 26 m round the dark back to the back door: stepping into the glass's view is the player's
  decision) · the back lot on the back door. Doors `front back lab store office`; rooms 'glasshouse', 'lab', 'office', 'store'; places 'the forecourt', 'the back lot',
  'the side yard'. MEASURED as shipped (`tools/qa/ships.ts --scn glasshouse-four`, 24 seeds, scripted commander), won · teammates up of 96 (± one standard error) · mean s:
  way 1, the commander's own choice = the short way along the lit glass to the front door 6 · 11 (± 4) · 74 (the file is shot through the panes 12–17 s in, lights
  off, by men it has not seen) — way 1 with his doors pinned back-first (`PT_ROUTE=back,store,office,lab`: round the dark side) 21 · 56 (± 7) · 105 — way 2
  (`--set '{"ROOMCLEAR":{"way":2}}'`) 23 · 69 (± 6) · 69 — THOSE THREE RE-MEASURED 10-13 on the mirrored store (before it: 10 · 14 · 71, 21 · 58 · 111, 20 · 57 · 80: none
  moved by two standard errors); THE NEXT TWO ARMS AND 'WHAT WAS TRIED' ARE FROM BEFORE THE MIRROR, not re-run — way 1 along the glass with defenders not shooting
  through standing glass (`{"GLASSPEN":{"foesThrough":false}}`)
  16 · 44 (± 8) · 94, one run at the 300 s cap — way 1 along the glass with `GLASSFX=off` in front (glass a wall to every round) 8 · 22 (± 7) · 56. WHAT THAT SHOWS AND
  NO MORE: the walk along the lit glass costs most of the squad against either way through the back (45 and 58 teammates today, over five standard errors; unpaired
  arms); the two back ways are not shown to differ (13 teammates, 1.5 standard errors); taking the defenders' fire through standing panes away gave 30 back (3.5 standard errors, the old store), and that arm is not a clean 'glass as cover'
  arm — the front's toughened panes dice whole on the squad's first round and the defenders then fire through the hole; glass as a wall to everybody is not shown to
  differ from the level as shipped (8 teammates, one standard error). WHAT WAS TRIED: a bulb in every room (six seeds: the squad in the dark dropped four lit men through
  the panes inside two seconds: a lit glass house favours whoever stands in the dark) · the rooms dark, no racks (eight seeds: the store taken, then raked through its
  lab door from behind the lab's glass) · way 1's start on the road in front of the glass, at the lamps' edge and in six marks' sight (21 · 35; moved after review). The
  frozen stand's plain commander wins from way 1 on three seeds of three, pair and four (`scenario-level-probes`, whose seeds were 1,2,3 then; today's figures are in the newer bullet below). `bun run tools/qa/glasshouse-check.ts` (`probes.ts
  glasshouse`, in family `missions`; both stands; `GLASSHOUSE_BREAK=1` = way 1 stood back on the road in front of the glass: must fail): the file fresh, 10 panes, no
  compass word in a name, both ways stage, marks of three different rooms have a line to the forecourt open with glass see-through and shut with glass solid and a
  rifle's fire open along it (shut with the rule off), no mark sees either start (doors shut or every leaf out), the store blind with every leaf out, the forecourt over
  0.4 on the headless meter and every glazed room's mark and both starts under 0.1. KNOWN: the dark rooms read 0.00 on the headless meter (no bounce) — on the page the
  lamps' bounce through the panes will light them some, which favours the squad's tubes; the stack on the `lab` door's '-' face is refused while that leaf
  stands open (`stack-marks-check`'s notes); in the no-fire-through-glass arm one run ended at the time cap with one defender up, the scripted commander's hunt order
  refused ("'move' does not fit a none target": the tool's, not looked into). Page rebuild/missions/new/glasshouse.md. Never seen on a GPU.

<!-- was CLAUDE.md lines 1724–1734 -->
- **The solo night's opening, the silent net, the P key** (the missions goal's solo-night faults; record rebuild/missions/fixes/solo-night.md): (1) `src/game/opening.ts`
  `OPENING {on, clearM 10, stepM}` — on a fresh encounter that is the PLAYER's (never a show's: `quietUtility`, or `touring` not `director.handedOver`) a staff man whose first waypoint is
  within `clearM` by walking of the spawn starts down his own beat, facing the way he walks (the office: only Kowalski, (6, 11.1) at the lobby arch → (14, 11.1) walking east, wp 1); called
  from the Game constructor, `resetGuards`, director.ts `exitShow`, attract.ts `stop`, and once a frame from `Game.update` (a man is fresh for 0.25 s after his Guard object is first met);
  the page ships ON (`?fairstart=0`), THE HARNESS STANDS UP WITH IT OFF (`TPS_OPENING=1`; standup.ts) so every frozen digest holds; journaled with the knob tables. (2) qrf.ts `silentNet`
  behind `tune.qrfSilent` (Tab ▸ Sandbox ▸ QRF row, kept with the QRF knobs; page ON, harness OFF, `TPS_QRFSILENT=1`): Sam's gunfire heard on the net (`loudT`) and then EVERY staff man
  off it (dead, out cold, held) → control's radio check at +6 s, the team requested at +14 s (`QrfReason 'silent'`, no escalation raised; a man back on the net cancels; savestate refuses a
  checkpoint inside the fourteen seconds); with three men down the perimeter tier is called as the door goes, as its own rule always said. (3) THE P KEY starts nothing: main.ts's handler only ends a running tour (or level-script program) to the start card. (It once started the night showcase over a live run; `src/game/showkey.ts` then ruled it, and went with the two showcases, 2026-10-17, as did `show-key-check.ts`.) Checks (standalone, exit 0 / 1, each fails on the fault): `bun run tools/qa/opening-check.ts [--off]`, `qrf-silent-check.ts
  [--off]`, `death-summary-check.ts`; on the real page (software adapter, a dev server on PORT): `node tools/qa/opening-page.cjs`, `node tools/qa/ways-in-look.cjs <out> solo=solo`.
  `tools/qa/solo-night.ts` (plans walk | sneak | careful | rush | loud, `--god --linger`, `--trace seed`) stands the game as the page ships, both knobs on.
- **A level can tell its men not to dig in, and a lesson is taught on standard (10-13).** `scenarios.roomClear.digIn: false` (`scene/scenarios.ts
  StructureData`, `docs/level-format.md`): no man of that floor braces a door, moves to cover or sets on the door he expects, at any difficulty, squads or
  not (reader: `roomfight.ts tickDef`, in front of `digInTick`). Absent = the game as it is. Built for Training 5 and 6, whose squads dug in while a line
  was being read (a gun set on hut d's door 58 s before the order opened it; both hut men on one door in lesson 6): the field is SET by the lessons' owner
  in the level files, not here. And `initDifficulty(q, plain)` no longer takes a machine's kept 'hard' on a `plain` page (a Training lesson): it is taught
  on standard, as its kept levers were already held off; `?lessonhard` = as it was, `?hard` still sets it for a visit.
- **Every mission starts the same way on every try** (`src/game/samestart.ts SAMESTART.on`: ON in the page — `?samestart=0` = every staging dealt as the bullets below
  describe — OFF in the module and on the frozen stand, `TPS_SAMESTART=1`; a `FROZEN_HOLDS` row, in the knob registry and a journal's tables, a recording from before the
  key replays with it off; Tab ▸ Room fight staging ▸ 'every mission starts the same'; the rows it overrides — fresh deal, re-deal on restart, the dealt way, the rescue's spread and roamer draw — say so in their titles). The maintainer, 10-11: "i'd also prefer we make the puzzles more curated
  and interesting rather than relying too much on randomness" · "i'd rather we have a lot of interesting levels … rather than trying to randomly shuffle them around".
  With it on a staging takes the level file's own FIRST answer where it used to draw: a room clear = `placeDefenders(seed 0, attempt 1)` = each room's first `garrison`
  marks IN FILE ORDER on every load and every restart (no `ROOMCLEAR.fresh` seed off the visit's die, no next attempt under `ROOMCLEAR.reroll`), and `way=any` is the
  level's own way in (the mission sheet shows no 'Dealt' button); a rescue = its first roamer marks as written and the captor's clock `RESCUE.resolveSecs` to the second;
  a quiet mission with no pin = start 0 / spot 0 / patrol 0 of its lists (`quiet.ts dealOne`). SO A LEVEL IS HAND-PLACED BY THE ORDER OF ITS MARKS, STARTS, SPOTS AND
  PATROLS IN ITS GENERATOR (`tools/levels/<name>.ts`, then `bun run tools/levels/export.ts <name>`): no format field. What a start NAMES is its own either way
  (`?roomclear=3`, the Tab seed, a Training row's seed — whose restart no longer re-deals —, `?quiet=N`, `?way=2`), and dice rolled once play begins (stride phases,
  glance clocks, aim, barks; `?seed=N`) are untouched. Every bullet below that says a visit or a restart is dealt (the fresh placement, the dealt way, the quiet deal,
  `seedRoamers`) describes the switch OFF. `bun run tools/qa/samestart-check.ts [id …] [--verbose]` (`probes.ts samestart`, in family `missions`;
  every row of the list + the solo night on two dice and through restarts, the old deals back with it off, named seeds / pins / ways, a rescue's clock stopped by a
  restart; `SAMESTART_BREAK=1` must fail; passes on both stands); `fresh-start-check.ts` now holds the deal BEHIND the switch (it stands every Game with it off), and a
  tool that WALKS a level's deals by seed turns the switch off for its unpinned starts (`vault-run.ts`, `lights-out-run.ts`: their `--seeds` tallies are still the
  level's deals; `--deal N` = one deal as the page has it), as the probes that need a restart to re-deal do for those lines (quiet-probes.ts, roomclear-probes.ts,
  rescue-probes.ts). The missions gate's quiet seeds now all play deal 0 — what the list ships. Page: rebuild/authored-levels/read-first.md.
- THE QUIET LEVELS' MISSIONS ARE HAND-SET (2026-10-13; `tools/levels/<name>.ts`, authored data: no switch, the same file on both stands). The mission of a quiet level is THE FIRST OF EACH LIST of its `scenarios.quiet` block (`starts[0]`, `spots[0]`, `patrols[0]`); the other deals stay in the file and are reached by `?quiet=N`. With `SAMESTART.on` (the page; the bullet above) an unpinned start IS that deal; with the switch off (the frozen stand, a tool that walks deals by seed) the mission is stood by its pin: `bun run tools/qa/quiet-pin.ts <name> [start/spot/set] | --all` prints the smallest `quiet=N` of a deal (a COPY of `dealOne`'s three draws: change them together). Pins of 0/0/0: bazaar 32 · police-post 32 · vault 7 · crossing 32 · quiet-relay 32 · lights-out 3 · quiet-yard 71. `probes.ts vault` and `probes.ts lights-out` stand each of their level's deals BY PIN (`VAULT_PINS`, `LIGHTS_PINS`; their first line fails when a list grows and the pins name other deals) and print every pin's last lines when red. `solo-night.ts`'s own "as shipped" stand is NOT `TPS_PROFILE=shipped` (it is the frozen profile with destruction raised): on the shipped stand staff pull outside doors to, the pair talks (`dialogue.ts` AMBIENT, each heard once a run, both men held 13‥16 s) and the needs breaks fall into the timetable — a quiet level's laps are measured with `TPS_PROFILE=shipped` in front. `lived-check` holds a level file to a base revision: its `BASE_REVS` names bc1fe6bb8, the build step that carries these files (a later on-purpose change to a level's own part wants its own step's commit named there). Police post, the border crossing and lights out are the mission as their files already stood (no level change; the crossing a comment). Every tally below is a scripted player, headless: never seen on a GPU, never played by anybody. The page for the maintainer: `rebuild/authored-levels/quiet-levels.md` in the project's shared folder.
- THE QUIET LEVELS' MISSIONS ARE HAND-SET (2026-10-13; `tools/levels/<name>.ts`, authored data: no switch, the same file on both stands). The mission of a quiet level is THE FIRST OF EACH LIST of its `scenarios.quiet` block (`starts[0]`, `spots[0]`, `patrols[0]`); the other deals stay in the file and are reached by `?quiet=N`. With `SAMESTART.on` (the page; the bullet above) an unpinned start IS that deal; with the switch off (the frozen stand, a tool that walks deals by seed) the mission is stood by its pin: `bun run tools/qa/quiet-pin.ts <name> [start/spot/set] | --all` prints the smallest `quiet=N` of a deal (a COPY of `dealOne`'s three draws: change them together). Pins of 0/0/0: bazaar 32 · police-post 32 · vault 7 · crossing 32 · quiet-relay 32 · lights-out 3 · quiet-yard 71. `probes.ts vault` and `probes.ts lights-out` stand each of their level's deals BY PIN (`VAULT_PINS`, `LIGHTS_PINS`; their first line fails when a list grows and the pins name other deals) and print every pin's last lines when red. `solo-night.ts`'s own "as shipped" stand is NOT `TPS_PROFILE=shipped` (it is the frozen profile with destruction raised): on the shipped stand staff pull outside doors to, the pair talks (`dialogue.ts` AMBIENT, each heard once a run, both men held 13‥16 s) and the needs breaks fall into the timetable — a quiet level's laps are measured with `TPS_PROFILE=shipped` in front. `lived-check` holds a level file to a base revision, so bazaar, vault and quiet-relay are red on its first line until `BASE_REVS` carries a build with these files (green with `--base none`). Police post, the border crossing and lights out are the mission as their files already stood (no level change; the crossing a comment). Every tally below is a scripted player, headless: never seen on a GPU, never played by anybody. The page for the maintainer: `rebuild/authored-levels/quiet-levels.md` in the project's shared folder.
- THE BAZAAR ROW, HAND-SET (`tools/levels/bazaar.ts`; waits and the start mark only, no route point moved, the fingerprint unchanged: checkpoints load, a tape from before parts from its trace). START 0 moved from (3.0, 10.0) — on the west round's own line, walked over 36 s in — to (6.2, 2.6), 'behind the north wall, at its west end': outside the mud wall, dark, off every walked line (150 s upright, 150 s and 450 s crouched: awareness 0.00). WAITS: `roundW` stands 9 / 9 / 7 / 8 s (were 5 / 5 / 5 / 4); `roundE` last stand 1 s (was 4); `teahouse` `[0, 14, 0, 10, 0, 0, 6, 0, 26.3]` (were `[0, 6, 0, 12, 0, 0, 9, 0, 0]`); `lorry` `[17, 0, 10.75]` (were `[10, 0, 18]`). WHY: the two torches' laps were 72 and 86 s and drifted (a man waiting at the oven for the east torch was shot by the west one at 125 s); the shops route was a second answer only from a prompt start. Laps on the shipped stand, seed 1, 450 s: west torch 85.6 / 85.7; east torch 84.7 / 87.8 / 85.6 while a talk with the driver holds it at the passage's south mouth, then 71.7 free; the tea house man 85.7 ×4 (his smoke ends 4.1 s before the west torch reaches the gable's north end, every lap); the driver 35.9 free (half the east torch's free lap), 48.9‥51.9 with a talk; the counter man 50.9, in step with nobody. THE LEVEL'S THREE PAIR TALKS ARE LOAD-BEARING: they hold the east round to the west's lap for the first three laps; from about 200 s the needs breaks (each said on the radio) take the torches out of step. DO NOT lengthen the driver's stand at the lorry (both rounds slip 15 s) and do not stand him at his middle point (he then holds the floor inside the south gate in his eye about 20 s a lap; it is 2.5 s now, 2.4 before). Pin 32, shipped stand, scripted: upright walk 0 of 8 (shot at 18‥21 s); the alley keyed to the torches 5 of 5 out, GHOST 100 (seed 1 start delays 0 / 60 / 120, seed 2 delays 0 / 120; 172 s, 307 s from the 120 s start); the shops route keyed 6 of 6, GHOST 100 (seeds 1‥2 × delays 0 / 60 / 120; 264 s, 308 s); plain `careful --out short` at t = 0 out 2 of 8 (GHOST 100 at 64.5 s), 6 shot at the north gate. Both keyed routes wait inside the back door until no torch is in the alley. No careful way out by the south gate from the office was found (it is a way in from its own starts). `quiet-check`, `export --check`, `level-lint`, `quiet-light` green.
- THE COUNTING HOUSE'S CLERK'S WAITS ARE HAND-SET (`tools/levels/vault.ts`, route `counting`, `wait: [31, 20]`; it was `[22, 26]`): the west yard is open while he sits at his desk AND the yard's walker is off the gate side, and the walker's first three laps run 78‥81 s (he stops to talk with the shack's man; 64.7 s after), so at 22 s the two slid together and the windows were 12 s, then 5 s and 1 s — a man who watched twenty seconds first got in at 2:16. Now the longest window of each lap is 21 · 14 · 13 · 22 · 17 · 11 · 11 · 17 · 22 s over ten minutes (pin 7, idle, shipped stand, moon). TWICE THE DESK PLUS THE SMOKE STAYS AT OR UNDER 82 s: at 83 (`[31, 26]`, tried) the clerk reached his corner too late for the first radio check on 5 of 15 dealt set-A seeds and the code answer took 258 s for 181. Pin 7, scripted: devices answered 93 s from start delays 0‥20 s and 158 s from 30‥80 (it was 93 / 223), the clerk's code 175 s on every delay and on all 15 set-A seeds of 24 (it was 164). 24 dealt seeds, shipped stand, moon, the counts above unchanged: devices 24 clean · code 19 (24 out) · pan 13 (24 out) · devices ignored 0 (13 out, 11 down) · breaker 0 (24 down). Set B's clerk (`counting_b`) is untouched. `probes.ts vault` plays only the devices plan and the careless walk, each of the four deals stood by its pin (`quiet-pin.ts vault --all`), on seed 1: the code answer's time is held by no gate — re-run `vault-run.ts --plan code --seeds 1-24 --moon` after touching either wait. The fingerprint is unchanged (checkpoints load); a replay or recording of the level from before parts at 22 s. The margin under 82 s was not measured. Never seen on a GPU, never played by anybody.
- THE RELAY STATION AS TWO, HAND-SET (`tools/levels/quiet-relay.ts`; no geometry, the fingerprint unchanged). STARTS REORDERED: the west track is first (it was third; the north slope was first), so a pin or a saved deal index from before names another start (0/0/0 is still `quiet=32`). From the north slope the first man met is the walker and a following partner was the one first noticed on 4 of 6; from the west the problem is the lit, locked, camera'd comms door in the picket's eye. THE PICKET'S LAP STARTS ON HIS LEAD-IN (same three points, rotated; `wait: [0, 110, 4]`): he is on his stand from the second second — before, a partner ordered to his back in the first ten seconds was sent across his front (`pairorders.ts` goes for the back of the way a man mostly faces; the general mend is there, and the crossing's two lane men keep the old shape). Pin 32, `--squad 1`, shipped stand, a scratch runner: upright walk 0 of 8; THE PARTNER ON THE PICKET ordered at 12 s 5 of 6 out, all GHOST 100 (4 clean at 67‥68 s; one never 'set': the stalk flips between two near-equal ways), at 25 s 3 of 3 clean (80‥86 s), at 45 s 3 of 3 clean on a second order (157‥167 s); THE BREAKER by Sam's hands 18 of 18 clean at start delays 0 / 30 / 60 (46 / 76 / 106 s; 3 of 6 at delay 45), by the partner at the panel with a 4 s wait at the corner 12 of 12 (7 of 9 without it); it wants three OCPs (lamp_west, the door camera, the inside camera). Not readable before contact: the picket (dark, no torch). The breaker is reset through the compound wall (`lighting.ts` errand stand and its 1.3 m reset radius: a claim, not mended). The mission's key art still stages the pair at the north gate (`tools/menu-art.ts`, `tools/menu-shots/recipes.cjs`). `quiet-check`, `export --check`, `level-lint`, `quiet-light`, `takecheck-check` green.
- **The compound's defenders are placed by hand** (`tools/levels/compound.ts`, head 'PLACED BY HAND'; `GARRISON`; no switch: it is the level's data, and the page
  opens on it because `SAMESTART` is on — the plain `?levelFile=compound.json&roomclear&squad4` link, no `freshstart=0` needed). Placed: the shed 4 men (one more
  mark on its back-strip door), the garage 1 (bait), the sala 1, the hut a squad of its own that stays (`mayLeave: false`), the Keep's three rooms stay lit when the
  mains go, and the room list is house first so the objective marker does not point at the answer. Eleven men as before. THE SENTENCE: two lit outbuildings face
  each other across the dark yard you must cross; the near one is bait, the far one is the guard room, and whichever door you stack on has the other at your back.
  TALLIES (`tools/qa/plan-fights.ts --scn compound-four`, shipped stand, hard, 24 seeds, runs taken · teammates up of 96): the obvious plan (garage first)
  11 · 19; A (west gate, `PT_ROUTE=shed_e,g_n,hut_w,s_w,k_s,o_n,a_s,b_s`) 21 · 62; B (`way` 2, `PT_BREAKER=order PT_NV=1 PT_ROUTE=k_s,s_n,o_n,a_s,b_s`) 23 · 68.
  On the tree with the build merged (10-13) A's seeds 1-12 gave 11 · 24/48 against 10 · 27/48 before the merge: the same answer, not the same runs. A scripted
  commander, the one floor (placement 0, the seed moves only the dice), never seen on a GPU, never played by a person. RED AND KNOWN: `scenario-level-probes
  levels/compound.json` pair part, seed 1 — the PAIR's last man never takes the shed's last defender and the run stops at the cap (240 s, and at 480 s the same);
  on the build's file that seed was a wipe at 74 s. The four's part is green. The file's checkpoint fingerprint did NOT move (boxes, doors, routes, lights and
  props are as they were): an old checkpoint loads, an old tape's re-run will not match (the marks moved). Page: rebuild/authored-levels/loud-levels.md.
- **Mousehole's defenders are placed by hand** (`tools/levels/mousehole.ts`, the `post` room's marks carry the comment; no switch: the level's data, and the
  page opens on it under `SAMESTART`). Placed: ward 1, exam 3, store 2, with the three marks by the blank north wall moved to 2.7 m off it (a wall charge knocks
  down inside 2 m: a north hole used to take the man with it); the duty room's three in file order = the HATCH GUN behind the desk, the DEEP MAN in the dark
  south end 8.8 m from the fire exit (a can or a charge there reaches 8 m), the MAN UNDER THE LAMP across from the fire exit (the north ceiling panel is on).
  FOUR MARKS FOR THREE MEN, TWO OF THEM HATCH GUNS: any deal has a gun on the corridor (a fifth mark that broke the rule is gone). All four squads stay home.
  THE SENTENCE: a gun behind a hatch owns the lit corridor every door opens on, and the room he sits in is deeper than a flash reaches. TALLIES
  (`plan-fights.ts --scn mousehole-four`, shipped stand, hard, runs taken · teammates up): doors from the front 0 · 0/48 (12 seeds); A walls from the yard
  (`PT_WALL=1 PT_WALLOUTER=1 PT_ROUTE=ward,exam,store,post`) 23 · 61/96 (24 seeds; it was a free 12 · 48/48 before); B the fire exit with a can from the second
  start 24 · 80/96. On the tree with the build merged (10-13) A's seeds 1-12: 12 · 31/48 against 11 · 30/48. A scripted commander, the one floor (placement 0),
  never seen on a GPU, never played by a person; "all four holes north" never played (the wall commander takes the nearest wall). The checkpoint fingerprint did
  NOT move (marks and one lamp's switch): old checkpoints load, an old tape's re-run will not match. Page: rebuild/authored-levels/loud-levels.md.
- **The warehouse's defenders are placed by hand** (`tools/levels/warehouse.ts`, `WAREHOUSE_SQUADS` and each room's 'placed' marks; no switch: the level's data,
  and the page opens on it under `SAMESTART`). Placed: front office 2 (one a door, the second half turned to the west window), manager's 1, HALL 3 (was 4: a pair
  on `h_sw`, one on `h_n` under the lit panel), DOCK 3 (was 2: a man a yard door where the doorway shows him, one on `d_n`), shipping office 1, tool cage 1. A
  squad sends a pair only with two men to spare beyond one a room, so Floor {hall} and Dock {dock} can now BOTH walk the ring; Stores stay (`mayLeave: false`). The
  north yard lamp moved to the west face (the verge under the offices' windows is lit, the start and the plant room's door are not); `plant_ext` stands ajar.
  THE SENTENCE: the building is a ring: whichever door you fight at, someone can walk round to your back. TALLIES (`plan-fights.ts --scn warehouse-four`, shipped
  stand, hard, 24 seeds, runs taken · teammates up of 96, capped runs counted): the obvious plan (`PT_ROUTE=fo_e,off,h_sw,hd_s,o_s,c_s`) 14 · 22, both squads out
  in every run; A the hall first (`PT_ROUTE=h_n,hd_n,c_s,o_s,mgr_e,off`) 18 · 49; B the dock from way 2 (`PT_ROUTE=dock_s,hd_s,o_s,c_s,h_sw,fo_e,off`) 20 · 50;
  the breaker with tubes on A 9 · 17, the worst thing tried. On the tree with the build merged (10-13) A gave 18 · 55 (the dozens 7 · 19 and 11 · 36 against
  10 · 25 and 8 · 24: a dozen seeds scatter that much). At the landing two SPARE marks moved (the dock's off the corner mark it stood 0.5 m from, the front
  office's out of the placed man's line of aim); placement 0 is as tallied. A scripted commander who never fires, the one floor, never seen on a GPU, never played
  by a person. The checkpoint fingerprint MOVED (the lamp's boxes): old checkpoints and recordings of the warehouse are refused. Page:
  rebuild/authored-levels/loud-levels.md.
- **The barracks' defenders are placed by hand** (`tools/levels/barracks.ts`: the hand placement merged over the build's four out-hung doors, both files the
  generator's; no switch: the level's data, and the page opens on it under `SAMESTART`). Placed: a GALLERY POST of two in the north gallery's east bay (`ngal_e`,
  a room in the data, no new geometry) — the arch man (31.0, 8.9) and the door man (32.6, 9.4), BOTH IN THE EAST OPENING — dark, looking across the yard at the lit south gallery; day room
  2, bunks 5 2 (off the south window's line), bunks 3 2 (the counter-attack, about 24 s after contact), mess hall 2, galley 1; BUNKS 2 EMPTY AND DARK (its panel
  off, its floor back in `places` by name). Eleven as before. THE SENTENCE: two men on a dark post at the east end of the north gallery look across the yard at
  the lit south gallery, so the nearest door in, the one the marker points at, is walked under guns you cannot reach from there. TALLIES (`plan-fights.ts --scn
  barracks-four --cap 420`, shipped stand, hard, the level's night, way 1, 24 seeds, runs taken · teammates up of 96) AS DESIGNED: obvious
  (`PT_ROUTE=s3,s34,s1,o_s1,h_s,k_hall,n4a,n4b,n_end,ng_e`) 15 · 32; B the post's own door with a can (`n_end,n4b,n4a,s3,s34,s1,o_s1,h_s,k_hall`) 21 · 57; C
  through the wash room (`s34,s3,s1,o_s1,h_s,k_hall,n4a,n4b,n_end,ng_e`) 21 · 48. ON THE LANDED TREE (10-13: the build merged, the doors re-hung, bunks 2's
  lamp off) those same door orders gave obvious 17 · 34, B 18 · 49, C 14 · 32. THE CAUSE IS THE OUT-HUNG `s34`, through the scripted commander's clock, not the
  lamp, the placement or `DARKFOE`: he is through the wash room door 11 s sooner and names his next door (30 s) before bunks 3's pair, who have come out, fall
  in the gallery (34-41 s); the old order then spends a can and about 25 s on an emptied bunks 3, and on half the seeds he stands on the fourth of the only four
  stack places in `h_s`'s bay, so the mess hall's door is refused (a scratch copy with `s34` hung inward, seed 2: he names `h_s` at 42 s, after both fell).
  NO LEVEL CHANGE: the plans' door order takes THE MESS HALL BEFORE BUNKS 3 (what a player does when bunks 3's pair has died in the gallery). FINAL, 24 seeds:
  obvious (`s3,s34,h_s,k_hall,s1,o_s1,n4a,n4b,n_end,ng_e`) 15 · 32; B (unchanged) 18 · 49; C (`s34,s3,h_s,k_hall,s1,o_s1,n4a,n4b,n_end,ng_e`) 18 · 43 (halves
  9 · 22, 9 · 21). THAT SECOND ANSWER DID NOT HOLD: on the next build (fe28eadc), 72 seeds, the door man still at (27.0, 9.5): obvious 47 won · 111 of 288 up,
  C 41 · 95, B (48 seeds) 42 · 106 of 192 — C under the obvious plan. WHY: a team that had taken bunks 5 by `s3` shot the door man through that open door
  (down at +9 s in 36 of 72) and the arch man after him, so the marker's door killed the post for nothing; the wash room's door saw only the arch man, and the door
  man lived to hold the north wing (52 teammates in 72 runs). THE MEND (one placement step): the door man into the arch man's opening, so both stand in the
  line of the wash room's gallery door `s4` — in C both fall through it in 2 s (the door man in 55 of 72 runs, the arch man in 45). SETTLED, head 586b69e4 (the build a8cfffdc merged), shipped, hard, night,
  way 1, the door orders above: obvious 36 won · 88 of 288 up (31 %, ± 13); C 51 · 131 of 288 (45 %, ± 12), seeds 1-72; B 34 · 96 of 192 (50 %, ± 11), seeds
  1-48. C over obvious +0.60 a run = 2.5 standard errors (on seeds 25-72 alone, never used to choose the step: +0.50 = 1.6); B over obvious 2.7; neither is
  free. `--diff` B vs C (48 seeds): 2.4 standing, 2.4 theirs fallen, 0.6 team fallen somewhere else per run. A MARGIN THIS THIN IS ONE BUILD MERGE FROM GONE:
  re-read both on 72 seeds after any change to the room fight. Tried and dropped (24 seeds, no level change): the post's own door after the wash room
  (`s34,s3,n_end,…`) 17 · 47 against the obvious plan with that tail 20 · 43. TWO OTHER MENDS, same round: (1) the day room's east shelf slid into the north-east
  corner (z 4.15‥6.15): it took the floor east of `n4b`, `barracks-check` B2 line 1 now passes; line 2 (the `n_end` entry puts a point in the `n4b` doorway)
  stays red, a claim on the entry points, not the level. (2) `n3` (the armoury's) came OFF the gallery post's door list: A DOOR A HELD ROOM LISTS IS HUNG TO
  OPEN INTO THAT ROOM, and n3's leaf stop at 1.3 left no way through from its pull face once it opened into the gallery (`probes.ts oneway-men`, red since the
  hand placement 9c346772, green on both stands now). A scripted commander, the one floor, never seen on a GPU, never played by a person. THE CHECKPOINT
  FINGERPRINT MOVED (899 boxes from 904, the shelf's geometry): old barracks checkpoints are refused, an old tape's re-run will not match. Page:
  rebuild/authored-levels/loud-levels.md.
- **`DARKFOE` and the loud levels' dark plans** (10-13, seeds 1-12, hard, the merged tree, on / held off with `TPS_DARKFOE=0` / the designer's same seeds before
  the rule): the compound's B (way 2, `PT_BREAKER=order PT_NV=1`) 12 · 39/48 / 12 · 33 / 11 · 33 — still the best answer; the warehouse's hall first in the dark
  5 · 11/48 / 4 · 8 / 6 · 11 — still the worst thing tried. `plan-fights.ts` reads no light anywhere (no `lightEstimateAt`, no `visibilityOf`).
- **Glass is not cover: the glasshouse, AS OF THE MIRRORED STORE (10-13; this bullet replaces the older one above, kept for its history)** (`levels/glasshouse.json` ← `tools/levels/glasshouse.ts`, built on the look's kit, no second look file; row `glasshouse-four`
  'The glasshouse' in `SCENARIOS`, `untuned`, filed under 'Raids' (the list's own cap is eight rows a group: `probes.ts missions-list`); `?levelFile=glasshouse.json&roomclear&squad4`, `&way=2`; level data only, no game code, no switch): a district seed station at night, seven men in four rooms.
  The whole front is glazed (the room called the glasshouse: six panes from 0.3 m off the ground to 2.4 either side of 1.8 m of block round the `front` door) and the
  walls between the glasshouse, the lab and the office are glass from 0.5 m to 2.4 (four panes: ten in all). The forecourt is floodlit off the eaves and THE GLAZED ROOMS
  ARE DARK, so men on the forecourt are seen from three rooms by men they cannot see, and the rounds come through the panes (glasspen.ts). The store is the one room
  with no glass: its own `back` door on the dark back lot, a bulb, and a row of SEED RACKS (kept boxes, group `store.racks`, floor to beams) down the room 1.9 m inside
  its `store` door to the lab, from the back wall to 1.44 m short of the wall the glasshouse is behind: the door is at the racks' closed end, in the back-wall corner
  (hinged on the corner side, `maxAngle` 1.5: open, the leaf lies along the back wall, its stop short of it), and the way round them at the other end, by the glasshouse's
  wall — so with every door leaf out no mark outside the store and no floor point of
  the lab, the office or the glasshouse sees the store's own side of the racks (the check asks it; keep the way round clear: a crate stack in it shut it once,
  `lived-check` found it). THE STORE'S INSIDE WAS MIRRORED 10-13 (door and way round traded ends): at the glasshouse end the `store` door stood 0.3‥1.5 m behind the
  full-height wall across the camera's view and was drawn from no spot, so no cursor found it (`probes.ts doormenu-drawn` / `doormenu-open`, red on this level until
  then) — A DOOR WITHIN ABOUT 1.9 M BEHIND A 3 M WALL ON THE CAMERA'S SIDE IS NEVER DRAWN: hang it further back. TWO WAYS IN (`starts[]`), BOTH DARK AND OUT OF EVERY MARK'S SIGHT: the side yard beside the building, round the corner
  from the glass (a 16 m walk to the front door along the lit panes, or 26 m round the dark back to the back door: stepping into the glass's view is the player's
  decision) · the back lot on the back door. Doors `front back lab store office`; rooms 'glasshouse', 'lab', 'office', 'store'; places 'the forecourt', 'the back lot',
  'the side yard'. MEASURED as shipped (`tools/qa/ships.ts --scn glasshouse-four`, 24 seeds, scripted commander), won · teammates up of 96 (± one standard error) · mean s:
  way 1, the commander's own choice = the short way along the lit glass to the front door 6 · 11 (± 4) · 74 (the file is shot through the panes 12–17 s in, lights
  off, by men it has not seen) — way 1 with his doors pinned back-first (`PT_ROUTE=back,store,office,lab`: round the dark side) 21 · 56 (± 7) · 105 — way 2
  (`--set '{"ROOMCLEAR":{"way":2}}'`) 23 · 69 (± 6) · 69 — THOSE THREE RE-MEASURED 10-13 on the mirrored store (before it: 10 · 14 · 71, 21 · 58 · 111, 20 · 57 · 80: none
  moved by two standard errors); THE NEXT TWO ARMS AND 'WHAT WAS TRIED' ARE FROM BEFORE THE MIRROR, not re-run — way 1 along the glass with defenders not shooting
  through standing glass (`{"GLASSPEN":{"foesThrough":false}}`)
  16 · 44 (± 8) · 94, one run at the 300 s cap — way 1 along the glass with `GLASSFX=off` in front (glass a wall to every round) 8 · 22 (± 7) · 56. WHAT THAT SHOWS AND
  NO MORE: the walk along the lit glass costs most of the squad against either way through the back (45 and 58 teammates today, over five standard errors; unpaired
  arms); the two back ways are not shown to differ (13 teammates, 1.5 standard errors); taking the defenders' fire through standing panes away gave 30 back (3.5 standard errors, the old store), and that arm is not a clean 'glass as cover'
  arm — the front's toughened panes dice whole on the squad's first round and the defenders then fire through the hole; glass as a wall to everybody is not shown to
  differ from the level as shipped (8 teammates, one standard error). WHAT WAS TRIED: a bulb in every room (six seeds: the squad in the dark dropped four lit men through
  the panes inside two seconds: a lit glass house favours whoever stands in the dark) · the rooms dark, no racks (eight seeds: the store taken, then raked through its
  lab door from behind the lab's glass) · way 1's start on the road in front of the glass, at the lamps' edge and in six marks' sight (21 · 35; moved after review). The
  frozen stand's plain commander won from way 1 on three seeds of three, pair and four, when this was written (`scenario-level-probes`, whose seeds were 1,2,3 then).
  ON THE BUILD OF 3752969b (10-14, frozen stand) the probe's default is seeds 0,1,2,3 (0 = the level's own marks, what the page deals) and each team takes the floor on
  two of four: the four on 0 and 2 (wiped on 1 and 3), the pair on 2 and 3 (wiped inside 13 s on 0 and 1). The probe is ALL PASS all the same: it asks one win of the
  four and none of the pair (the mission list plays this floor with the four). The older figure predates the hand placement in the next bullet (the
  men now watch the lit forecourt through the glass, and the front is the way this commander walks): the loud-levels part calls the wipes as built, no fault. Nobody has
  traced them seed by seed. `bun run tools/qa/glasshouse-check.ts` (`probes.ts
  glasshouse`, in family `missions`; both stands; `GLASSHOUSE_BREAK=1` = way 1 stood back on the road in front of the glass: must fail): the file fresh, 10 panes, no
  compass word in a name, both ways stage, marks of three different rooms have a line to the forecourt open with glass see-through and shut with glass solid and a
  rifle's fire open along it (shut with the rule off), no mark sees either start (doors shut or every leaf out), the store blind with every leaf out, the forecourt over
  0.4 on the headless meter and every glazed room's mark and both starts under 0.1. KNOWN: the dark rooms read 0.00 on the headless meter (no bounce) — on the page the
  lamps' bounce through the panes will light them some, which favours the squad's tubes; the stack on the `lab` door's '-' face is refused while that leaf
  stands open (`stack-marks-check`'s notes); in the no-fire-through-glass arm one run ended at the time cap with one defender up, the scripted commander's hunt order
  refused ("'move' does not fit a none target": the tool's, not looked into). Page rebuild/missions/new/glasshouse.md. Never seen on a GPU.
- **The glasshouse's defenders are placed by hand** (`tools/levels/glasshouse.ts`, 10-13; level data only, no game code, no switch; THIS BULLET REPLACES, in the two
  glasshouse bullets above, 'no squads', the marks, the tallies and 'the squad carries no wall charge'). The problem: men in the dark watch a floodlit forecourt
  through glass that stops no round. PLACED (seed 0 / attempt 1 = each room's first `garrison` marks in file order; the page deals it every try): glasshouse
  (27.0, 14.3) and (12.0, 14.3) on the two pane banks, (20.5, 14.5) looking BACK through the lab's pane at the `store` door; lab (20.6, 12.2) on the forecourt
  through two panes, (22.6, 9.8) across the lab on the `store` door (a second line, off the glasshouse man's); office (26.4, 12.2) on the forecourt; store
  (12.0, 11.8) under its bulb on `back`. SQUADS (there were none: one pool, and any contact in the store drew all seven through the `store` door into the racks —
  every plan from the back door was one fight, 46 of 48 up from way 1): `front` 'Front' {glasshouse} `mayLeave: false`, barricade [`front`] · `back` 'Back' {lab,
  office, store}, free. `wallCharges: 1` (the kit's cards carry none as shipped). ADDED BOXES (group `mains`, 7; the level fingerprint moved: old checkpoints
  and tapes of the glasshouse are refused): a galvanised conduit from both lamps along the front under the eaves, the end wall and the back wall, down into a
  `meter_box` on the OUTSIDE of the back wall at x 11.4 — the breaker is behind it, inside; and an open slit vent in the back wall, x 11.9‥12.9, y 2.25‥2.45,
  above every eye line (the bulb's rays pass over the back lot: the headless meter still reads 0.00 at way 2's start; the lit slit is for the picture).
  MEASURED on the landed tree (`TPS_PROFILE=shipped … tools/qa/plan-fights.ts --scn glasshouse-four --seeds 1-24 --set '{"DIFFICULTY":{"level":"hard"}}'`,
  placement 0, scripted commander), taken of 24 · teammates up of 96: OBVIOUS, way 1, no lever (the lit glass to `front`) 11 · 17 — A, their back in the dark
  (`PT_BREAKER=order PT_NV=1`): way 1 with `PT_ROUTE=back,store,office,lab` 23 · 66, way 2 (`"ROOMCLEAR":{"way":2}`) 23 · 66 — A with the light left on: 19 · 38
  and 22 · 52 — B, the end wall by the issued charge (`PT_WALL=1 PT_WALLOUTER=1`, way 1) 22 · 53. `--diff` A against B: men per run somewhere else, standing at
  +30 s 2.5 · theirs fallen 2.2‥3.1 · ours fallen 0.8‥0.9 (A: Front whole in the glasshouse, theirs fall in the store; B: the glasshouse emptied, Back out in
  the lab, the back lot and the side yard). 12 SEEDS, SCRATCH FILES: both forecourt lamps off, the obvious walk 12 · 28 of 48 (a third answer; the shots that
  put them out were not played) · `bulb_store` off with the mains on, A: 12 · 32 (way 1) and 10 · 23 (way 2) against 12 · 35 and 11 · 31 with the breaker and
  11 · 22 and 12 · 23 plain: the tool is 'put the light out', the breaker the surer way; no defender went to the breaker after a cut in 48 runs. In B the man
  nearest the hole is shot a median 3.8 s after the charge in 24 of 24 and hits nobody. TRIED: the store a squad of one that stays (its dug-in man shot 13 of
  48 as the last room; wall 9 of 48) · stun cans buy nothing in A (33 against 21 without them, 12 seeds). CHECKS, green: export --check, level-lint,
  scenario-level-probes (data, pair, four), lived-check on its own base, look-check, stack-marks-check, map-check (24 seeds), second-way-check,
  fresh-start-check, `glasshouse-check` on both stands, `probes.ts doormenu-drawn` / `doormenu-open`; the page boots to ready on the mission's link (software
  adapter, 112 pipelines, no page error, the seven on these marks, one wall charge carried). NOT SCRIPTABLE: 'take the store, then cut' (PT_BREAKER cuts before
  the first room), the front in the dark after the cut, lamps shot out by hand, a squad split across A and B. Page
  rebuild/authored-levels/loud-levels.md. Never seen on a GPU, never played: whether the conduit, the meter box and the vent READ is unknown
  (what hangs on the back wall's outside may not be drawn by the default camera). THE ROW AFTER IT (10-13, `scenarioList.ts`): `squads: true` (`probes.ts levers-rules`
  is red on a room clear whose level names squads and whose row does not), the blurb ends 'One wall charge.', and the list deals way 1 (beside the building) as it
  always did: way 2, the back lot that hands over answer A, is the player's own pick on the sheet's 'Way in' row. No tally retaken for the words.
- **The police post has a terminal in the bunk room (10-13, the dozing goal's)**: one monitor, BUILT OFF, on the footlocker between the cots
  (`tools/levels/police-post.ts`, the last five boxes of the base layer; switchable `monitor16`, group `monitors`, on the mains). A man with a short dark
  wait in that room pulls the lived-in chair up to it, switches it on and sits to it; he switches it off as he leaves (`docs/agents/enemies.md`, 'sits to
  a screen'). With `DOZE` off it is never on and the level's light is as it was. No route point, wait or other furniture moved. The level's fingerprint
  moved: older tapes and saves of the police post do not load. `lived-check`'s base revision list starts with this commit.
- THE RELAY STATION'S PICKET STANDS FACING NORTH (`tools/levels/quiet-relay.ts` route `picket`, lead-in point `[26.8, 0, 22.66]`, was `[27.6, 0, 22.4]`; no
  switch: authored data, the way back is the old point). A standing man keeps the yaw of the leg he walked in by, and the partner's sweep rule (`PAIR.sweep`)
  calls floor inside 2.4 m of him watched all but 25° either side of dead astern: facing 36° to 51° west of north, the strip behind the blast wall came out 45°
  off his stern and an early order onto him never set (first order 0 of 6 at 12 s on build 2f9103b1). From due south the first order sets 6 of 6 (21 to 25 s
  after it), out clean GHOST 100 at 61 to 65 s; ordered at 25 s 3 of 3 clean, at 45 s 3 of 3 out, 2 clean. Sam alone at the breaker 18 of 18 clean (delays
  0 / 30 / 60), 1 of 6 at 45; the breaker as two (lamp_west out first, X on the panel, fall in as the mains go) 6 of 6 clean; the walk 0 of 8, careful 0 of 16.
  Price, measured with the door camera put out: he is slower onto a man on the lit door, 2.1 s to suspicious (was 0.9; worst 4.6, was 2.1) and 3.2 s to alert
  (was 2.0; worst 5.7). A smaller turn (17° to 23°) kept more of his eye (1.4 / 2.5 s) but set 10 s later, and a run ordered at 45 s was then caught by the
  check-on (0 of 3 clean). On the SAME build with the old point the rows were: first order 0 of 3, ordered at 25 s 2 of 3 clean (163 to 166 s), at 45 s 3 of 3 clean; alone at the
  breaker 17 of 18 and 1 of 6 at 45; as two 6 of 6: so the one row this turn made worse is a run ordered at 45 s (the ops man's check-on fires with the picket
  already down), and the older note above (3 of 6 at delay 45, 12 of 12 with the partner left at the panel) was a build before far sight and the panel's own
  face. All `TPS_PROFILE=shipped`, pin 32, squad 1, headless on build 1996590e, a scratch runner (not in the repo; the frozen stand was not run: the level file
  is the same on both); nobody has played it or seen it on a GPU. What the repo holds: the generator throws at export if the lead-in is not due south of the
  stand, and `quiet-check`, `level-lint`, `quiet-light`, `takecheck-check` and `probes.ts quiet` are green on it; no repo check holds 'the first order sets'.
  The fingerprint does not move; an older tape of this level parts from its trace. `lived-check` holds the file to a base revision: this step's own commit
  (0132b76e3) is first in `BASE_REVS`, so it is green here and on any tree that carries the step.
- **A level made for snow: the pass** (`levels/pass.json` ← `tools/levels/pass.ts`, built on the look's kit, no second look file; row `pass-four` 'The pass' in
  `SCENARIOS`, `untuned`, group 'strongholds'; `?levelFile=pass.json&roomclear&squad4`, `&way=2`; level data, a paint table and a check: no game code, no switch.
  The maintainer, 10-14: "i think we should probably curate snow levels and have the art be custom. seems like a lot to have it just be slapped on"). A walled
  teahouse and truck halt on a high pass road, at night, in winter. One range along the back wall (tea room 10 × 6, kitchen, store), the bunk room turned down
  the side from the store, an open garage bay and a generator lean-to across the yard, one gate onto the road, a lorry snowed in half through its turn inside it. The four
  rooms are a ring with the yard: yard → tea room → kitchen → store → bunk room → yard. FOUR ROOFS, no more (`weather.ts roofsOf` takes four): the range, the
  bunk room, the bay, the lean-to; 52 % of the ground inside the wall is open sky. Eight men, two squads: House (tea room 3, kitchen 2; may wedge `tea`) and
  Lines (store 1, bunk room 2; may wedge `bunk`). THE SENTENCE: the yard between the lorry and the doors is white, lit (two lit
  windows, a brazier in front of them, a lantern at the door) and watched through glass from two sides (tea 1 and 2 at the lit tea room's two windows, on the
  yard east and west of the lorry; bunk 1 at the dark bunk room's, on the gateway from the side). The gate is the one hole in the wall and a lamp hangs over
  it, but THE LORRY stands 2.6 m inside it, between it and the tea room's windows: the team comes in behind the lorry and chooses from there. (It stood up the
  yard at first, with the tea room's two windows on the gateway: the plain scripted team of `scenario-level-probes` was down inside 8 to 14 s of the gate on
  one seed in three, on one stand or the other. A hole that kills before a decision is not a problem to solve, so the lorry was moved.) Answer A: way 2, the kitchen's `back` door, outside the wall (it opens out; `pass` and `store` open into the
  kitchen, `inner` into the store, so the walk back → kitchen → tea room / store → bunk room is by hand whatever is wedged: `second-way-check` green with and
  without the lists). Answer B: the mains (generator and breaker in the lean-to, reached down the lorry's west side and the bay; the lamp and the bulbs go, the brazier, two stoves, the oven and the lanterns
  do not). Doors `tea kitchen back pass store inner bunk`; places 'the yard', 'the bay', 'the lean-to', 'the road', 'the back'.
  THE SNOW IS IN THE FILE, laid by hand (groups `snow.*`, 182 boxes; what FALLS is the weather's, keyed on the level's name in `weatherKinds.ts`, so the row's
  link carries no `weather=`): the base slab in snow paint; the road a packed band; 6 patches cleared to earth inside a ring of slush (gateway, tea room's door,
  generator, brazier, kitchen's door, back door); trodden paths gate → round the lorry's tail and up its east side → tea room, → kitchen and the bunk room's door, tea room →
  generator, gate → bay, back door → the refuse heap; ruts along the road from the east, in through the gate and round to the left to the lorry's back wheels; slush tracked in inside each
  outside door; caps on the yard wall's coping, piers, gate posts, the lorry (tilt, cab, bonnet), wood, crates, drum, sandbags, cart, tyres, barriers, field
  stones; banks INSIDE the yard on the windward (north-west) side of the walls, in the corners, on the lorry's nose and down its wheels (none at the OUTSIDE foot of a yard wall since 10-15: a charge is set from there, `weather.md`); low drifts under the windows and round what stands in
  the open; sastrugi on one bearing. WHAT EACH IS TO A MAN: ground, road and cleared earth are thin solid slabs; paths, ruts, slush and CAPS are decals
  (`NoShadow`: no ray, no collision; a round goes through a cap to the thing under it; a cap on cover that breaks is to `wallbreak.ts` one of its `ghosts`, as any decal on a broken piece is: read, not run); a DRIFT
  is solid and 0.19 m or under (men wade it; the tallest is 0.18); a BANK stands over 0.2 m and stops feet: only against a wall or the lorry, the nearest
  2.95 m from a door's leaf. Nothing in the fresh-snow paint is under a roof.
  THE PAINTS (`src/scene/gwotPalette.ts SNOW_PALETTE`: `snow` 0.66 0.71 0.78, `snowPacked` 0.43 0.47 0.53, `snowOld` 0.27 0.30 0.34; each step over a third of
  the one it lies on, earth on `snowOld` the same) are A TABLE OF THEIR OWN, not rows of `GWOT_PALETTE`: that table is written whole into the `materials` of
  every level built on the kit (30 files), and a new row there makes every one stale. `gwotSimOf` knows them last and only on free keys: all three stand for
  'asphalt' (`paletteName` asphalt → `surfOf` concrete, `breakClassOf` hard, not `steelGrey`: the ground, as dust and dirt are); the 2 340 colours the palette
  knew before (paints, stand-ins, wet) read as they did (a scratch compare against HEAD's file, 0 differ), `GWOT_MATERIALS` is the 60 rows it was, no other
  level file carries the three colours. UNDERFOOT (the level's `surfaces`): fresh snow is 'grass' (the soft quiet one of the six), the road, the paths (squares
  laid along them), cleared earth and the bay 'asphalt', rooms 'stone', rugs 'carpet'. KNOWN: the HUD's sound label then reads GRASS on snow (a seventh
  floor material is game code, not done here); the snow paints have no stand-ins (`gwotAs`) and no wet colour.
  `bun run tools/qa/pass-check.ts` (`probes.ts pass`, family `missions`; both stands; `PASS_BREAK=1` = way 1 stood in the gateway under its lamp: lines 9 and 11
  fail): the file fresh, four roofs, nothing white under one, open sky, the paints, feet (drifts, banks and doors, every path square and team mark standable),
  no compass word, both ways stage, both starts unseen by every mark (leaves out too; way 2 stands before the back door, so there the kitchen's own marks are
  held off by its leaf), the lorry between the gateway's west two thirds and every mark of the tea room with the bunk room's window on the gateway and the
  tea room's on the yard both sides of the lorry through glass, the gateway lit (1.00) and both starts dark by BOTH meters (0.00 by the headless estimate, 0.06 with the moon counted as the page's GPU meter counts it — `nvg.ts nvgPlaceLight`). THE YARD DOORS (tea, kitchen, bunk) author no swing: the room rule deals each into its own room (a defender can wedge it; the kitchen's back door, authored outward, is the way round), and the outward rule for outside doors (`DOORWAY.exitsOut`, off as shipped) turns them like any level's — authored inward they were red on `probes.ts oneway-deal`; unauthored, the played digests on both stands are the ones before (seeds 1 and 2). THE MOON is 0.06, two fifths of another level's 0.15: snow is the brightest ground paint in the game, and at 0.15 a man on it read 0.24 on the page, over twice what 'dark' is on every other floor (0.11 at 0.08). The tallies above were played headless, where the moon is not in the meter: they did not move.
  MEASURED (`tools/qa/ships.ts --scn pass-four --seeds 1-12`, the scripted commander, 12 seeds each, won · teammates up of 48 · mean s; the tree had another
  thread's unfinished snow-fall code in it while they ran, so the counts are of that day's tree): AS THE FILE IS, way 1: shipped stand 11 · 38 · 92 (seed 11
  wiped), frozen stand (`--base`) 7 · 24 · 89 (seeds 3 4 5 9 12 wiped). NOT RUN AGAIN AFTER THE LORRY MOVED (the numbers are of the first layout, lorry up
  the yard; the kitchen and its back door did not change): way 2 (`--set '{"ROOMCLEAR":{"way":2}}'`) shipped 12 · 36 · 50, frozen 11 · 28 · 44; way 1 on hard
  10 · 27 · 83. The first layout's way 1, for the comparison: shipped 10 · 26 · 86, frozen 7 · 18 · 80. No run stalled or hit the cap.
  RED AND KNOWN: `bun run tools/qa/scenario-level-probes.ts levels/pass.json` (the PLAIN commander: one order, the tea room's door first, straight across the
  lit yard) fails 'walked' and, on the frozen stand, 'it can be won': frozen, the pair wiped on 3 seeds of 3 (13 to 16 s) and the four on 3 of 3 (18 s);
  shipped, the four takes it on 1 of 3 (seed 2, four up). So that plan is the trap here, as the depot's lit yard is; the level is NOT in that tool's
  `TRAPPED` table (another owner's file) and whether it should be, or the yard should be eased (one man fewer at the glass, the brazier out), is open. On
  the first layout the same probe was green on both stands once and red on one stand in later runs as the tree moved. SMELLS not looked into (first
  layout): Red One's aim swings at 3.9 s on every way-1 run (standing at the start, gun free); 'block' at the `pass` door in 3 runs of 12. Also green on the
  file as it is: `door-size`, `stack-marks-check`, `lived-check pass.json`, `level-names-check`, `second-way-check`, `probes.ts look cast-look floororder
  level secondway missions-list doormenu-drawn`; `sh tools/qa/gate.sh missions` was not run on the final file.
  NOBODY HAS SEEN IT: never on a GPU, never played by a person. Not judged at all: how white the yard reads under the moon and what the exposure does with
  it, the warm light on the snow from the windows, the lamp and the brazier, whether caps and drifts read as snow from the play camera, the lorry as a lorry.
  Its mission picture (`public/assets/menu/pass-four.jpg`, recipe `pass-four` in `tools/menu-shots/recipes.cjs`, 10-14): way 1 played live, the bang entry on `tea` at the instant the can goes off, from the yard past the lorry's cab; two of the four fall crossing the lit yard in that play and lie outside the frame. Software adapter only, never seen on a GPU. `tools/menu-art.ts` has no row for it (the composed fallback's default draws the team on the road).
  HOW ITS SNOW IS DRAWN changed 10-14 (the maintainer's GPU look: "the rectangles don't seem to work"): the placed snow below is still the file's and still what a boot, a round and a ray meet, but with `SNOW_LOOK.on` the page bakes it into one field and draws THAT (`docs/agents/weather.md`, the snow bullet's "one surface" part; `?snowlook=0` = the boxes as painted). A new snow piece is authored as before — a strip in `snowPacked` / `snowOld`, a solid `snow` box, a NoShadow cap — and the bake picks it up by its paint and shape; non-snow thin strips in the open read as cleared ground.
- **The missions screen check reads the same-start rule for its Way in line** (2026-10-15; tests only, no switch): `tools/qa/missions-probes.ts`
  asked for the Way in row's third button 'Dealt' and for K to reach `way=any` on every stand, so `probes.ts missions-screen` was 1 FAIL on
  the SHIPPED stand from the day `SAMESTART.on` hid that button (the screen was right, the line was stale). It now asks, with the rule on, for
  two buttons and K stepping way 2 then back to the level's own (Shift+K the same two), and with it off for the row as it was. `WAYROW_BREAK=1`
  asks for the other stand's row and must fail. Run: 20 PASS on both stands and on frozen with `TPS_SAMESTART=1`; the break word fails on both.
  Headless DOM stand-in only: the row was not looked at in a browser in this step.
- **The registry's stage check reads the same-start rule for its roamer line** (2026-10-16; tests only, no switch): `tools/qa/registry-probes.ts
  registryStage` asked on every stand for the rescue's one roamer to be seen in BOTH rooms over eight seeds (the scenario's coin), so
  `probes.ts registry-stage` was 1 FAIL on the SHIPPED stand from the day `SAMESTART.on` stopped the coin (copy room 8 of 8: the stage was right,
  the line was stale; frozen with `TPS_SAMESTART=1` was red the same way, which is what pins it on the rule). It now asks, with the rule on, for
  the roamer in the same room on every seed, and with it off for the coin as before. `ROAMER_BREAK=1` asks for the other stand's stage and must
  fail. Run: 3 PASS on frozen, on shipped and on frozen with `TPS_SAMESTART=1`; the break word fails on both stands. The registry's full plays
  (`registry-probes.ts` tallies, the 'BY WHERE THE ROAMER STOOD' table) were not re-run in this step.
- **The registry's level check compares the file with the generator before the wrecking dressing** (2026-10-17; tests only): `tools/qa/registry-probes.ts
  registryLevel` loaded the file with `{ lived: true }` alone, so on the SHIPPED stand (where the dressing switch is on) the loader's added dressing boxes made
  `probes.ts registry-level` 1 FAIL (569 boxes against 664). It now loads with `{ lived: true, dressing: false }`: the generator's level against the file as
  written, on every stand. Run: 6 PASS on frozen and on shipped. `registry-walk` was red on shipped that day (four followers: one man never
  entered the copy room); the doors' own mend of the doorway turned it green the same day, the check unchanged.
- **The snatch's gate hut sounds as its own floor** (2026-10-18; level data, no switch). `tools/levels/snatch.ts` `surfaces.building` was the house's rectangle, and a
  footstep zone is read only inside it, so the hut's zone out in the side yard was never read: the hut sounded as the yard ('asphalt', loud 0.9), not the 'stone'
  (1.1) it is drawn as. `building` is now the whole world, as on the floodlit yard, so the plan is all zones; nothing else underfoot changes. Check: `bun run
  tools/qa/map-check.ts snatch --no-runs` (was 1 FAIL, 'never read: hut'; now ALL PASS, 'gate hut stone'); `probes.ts snatch` 20 and `floors` 6 pass on both stands.
  Played as shipped, before against after: straight in, 12 seeds, the same 12 runs (lost at about 25 s, by design); the back gate covered first (`PT_SNATCH=cover`),
  24 seeds, won 24 and 66 of 96 men up both ways, two seeds a different length (0.1 s and 13 s). The level's own part moved, so `lived-check`'s base list names
  this step. Headless only: nobody has heard it.
- **A rescue is won out, or cleared** (2026-10-18; `src/game/rescueend.ts`, `RESCUEEND.on` — ON in the page, `?norescueend`; OFF in the module and on the frozen
  stand, `TPS_RESCUEEND=1`; the Hostage rescue rows' toggle in the debugger). The maintainer: "the hostage rescue missions should have you safely extract the
  hostage or fully clear the map." WHAT WAS THERE: the hostage room taken and held `RESCUE.holdSecs` (15 s) ended the run a win, with men of theirs alive
  elsewhere and nowhere to go. THE RULE, on all three rescues (office, registry, consulate; no level data changed): the run is WON two ways and by nothing else.
  OUT: every hostage still alive stands inside `outM` of the WAY OUT, having been led there. The way out is the team's own way in (`scenarios.rescue.team.sam`,
  the mark Sam is staged on). A hostage is led by a row on her once nobody of theirs has her: Space, 'on your feet — with me' — every living hostage gets up
  and follows whoever said it (civilians.ts `hostageLead` / `follow`: her own legs and the nav grid, a walk that becomes a run when she has fallen behind,
  `gapM` + `gapStepM` a head behind); the same row then reads 'stay here' and puts them down where they stand. While one of theirs has them the row is there and dead ('one of them has a gun on
  her'). A click with the hands empty beside a hostage is no blow (game.ts: her row is a guard's row, the takedown's pick skips a hostage). CLEARED: nobody of theirs is left (every man of the
  cast down, or run off with his gun dropped) for `clearSecs`; a man in Sam's arm is still a man. LOST is as it was (every hostage dead, one hit by the team's
  own round, the player down). The room taken is still said and logged ('secured'); its line reads 'hostage room secured — bring them out, or clear the
  building', the objective row points at the nearest hostage and then, once they are on their feet, at the way out ('bring them out the way you came in'); the
  end's why is '2 of 2 hostages out' or '2 of 2 hostages alive · building cleared'. SEAMS: rescue.ts `outcome()` (asks `ending.won()`; the 15 s hold only
  with the switch off), `objective()`, `tick()`, `end()`; rescue.ts `captor()` / `clock()` count only hostages still IN the room for the man standing in
  it (a hostage walked out is had by line and reach alone: the flush's bullet in `enemies.md`); a hostage on her feet killed by a grenade of THEIRS is theirs
  ('killed', frag.ts's `killerId`), not the team's own fire; the objective keeps the clock's step while a man has one of them again; player.ts `buildInteractables` (`rescueEndRows`); game.ts
  `Verb` 'lead' | 'stay'; civilians.ts `Civ.lead / leadGap`. The scripted commander (`tools/qa/playthrough.ts playRescue`) waits for a clear and else leads
  them out. OFF = THE BUILD AS IT WAS: nothing asked, no row, the hold ends it (the check's (g); the frozen stand's rescue probes unchanged). CHECK:
  `bun run tools/qa/probes.ts rescueend` (`RESCUEEND_SEEDS=1,2,3`), per mission: not before · the row and the word · no blow on a click · out · stay · cleared ·
  the state's pair · off; `RESCUEEND_BREAK=1` fails every line. Page: `PORT=<p> node tools/qa/rescueend-page.cjs`. MEASURED: `rescueend` 24 of 24 lines on the frozen stand (the check raises the rule) and on the shipped one, 72 of 72 on seeds
  1,2,3; `RESCUEEND_BREAK=1` 24 of 24 FAIL on both. The old `rescue` family, 13 probes, passes on both stands (rescue-clock, rescue-orders and
  rescue-flow-twodoor name the rule among those their scenes were staged without: `rescue-probes.ts`). PLAYED as shipped (`ships.ts`, `PT_HUNT=first`,
  seeds 1–4, against the build before it): office 4 of 4 rescued both ways (38 s → 64 s: the walk out), registry 4 of 4 (42 s → 29 s: its three men
  down is a clear), consulate 2 rescued and 2 lost both ways (the same two seeds, lost at 55 s with the rule absent too); no run stalled. Per-player state: the leader
  is kept as a character, never read off `Game.player` after the press. UNTUNED: `outM` 3.5, `clearSecs` 1.5 are first numbers. Headless only: nobody has
  played it, nothing of it has been seen on a GPU (the row's marker, the hostages on their feet behind Sam, the objective's arrow).
- **The level check's rescue part counts the level's own cast, and says a man in the player's way as a note** (2026-10-19; tests only, no switch:
  `tools/qa/scenario-level-probes.ts`). Two lines were red on `bun run tools/qa/scenario-level-probes.ts levels/consulate.json --only rescue`, neither the
  level's. (1) STAGED asked for the captor, the door man and the game's one roamer (3); the consulate mans its own cast (`rescue.cast.roamers` 3 of five marks,
  one `rescue.guards` man: 6, as `consulate-stage` has always asked). The line now counts by role off `Rescue.cast()`: the level's room guards on their marks in
  the room, so many roamers as its cast mans (or the game's one), each on a roamer mark. (2) WALKED, shipped stand, seeds 2, 6, 14 and 17 of the
  first nineteen: the door man comes down the corridor and stands 0.6 m in front of the scripted player, who is never seen and never fires; his body keeps his
  team's guns off the man (the friend in the line; six seconds on seed 2, the one traced), the walk gives up 4 to 6 m short of the post, F is pressed from there. That is not the level's floor:
  `Walk.inWay` names a living man of theirs within a metre on the side he walks to, and WALKED prints the meeting as a NOTE on its line and fails only on a stop
  with nobody there. NOTHING the player does changed (a first try that had him step aside moved how runs ended and was dropped): the runs' seconds are the
  same before and after on both stands. Run: consulate 5 PASS on both stands (gwot twin on shipped), registry 5 PASS on both, `probes.ts scenario-levels`
  ALL PASS on both (20); `STAGECAST_BREAK=1` fails STAGED on both stands, `WALKMET_BREAK=1` fails WALKED on shipped (on frozen nobody meets him, so that word
  changes nothing there). No family runs the consulate through this file: it is the level's own task line, typed. NOT from this: the test level's stall on shipped in the
  rescue part ended with the rescue ending's own step (the scripted player leads the hostages out), joined under this one. What the six seconds say about a teammate
  behind a friend in a corridor is the squad's to read, under a player who would have fired or been shot.
- **The snatch's card names the van** (2026-10-19; words only, no switch). The row's blurb said 'One unarmed man to take alive.'; since the snatch ends with him
  in the team's van (`snatchout.ts`, above) it says 'to take alive and walk out to your van', so the sheet sets up the walk out the maintainer expected when he
  played it. 152 characters (the list's rule is 160). With `?nosnatchout` the old end is back and the card still names the van: it stands at the gate either
  way. Checked: `probes.ts missions-list` and `missions-screen` on both stands, the src typecheck. Nobody has read it on a page.
