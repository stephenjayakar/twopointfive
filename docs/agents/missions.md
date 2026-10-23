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
- **Training lessons — TAKEN OUT 2026-10-23** (the bullet 'The seven Training lessons are out' at the end of this file says what went and what stayed;
  what follows is the group as it was, kept for the lesson engine it describes, which the tutorial's missions run on)
  (`src/game/lesson.ts`, `Game.lesson`, `__lesson`; rows in `scenarioList.ts TRAINING_MISSIONS` — a third table beside `SCENARIOS` / `QUIET_MISSIONS`, `group: 'training'`; block
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
  keeps lived things 1.1 m off its line (`lived-check` holds it), and a level changed on purpose moves its own row in `lived-check.ts LEVEL_BASE` (`levels.md`, *The furniture check holds each level to its own base*).
  (5) THE TWO SQUAD LESSONS (train-orders, train-pairs) set `scenarios.roomClear.digIn: false` (roomfight.ts tickDef): read at six seconds a line, their men
  always had the minute to set on the door. And at a door the lesson HOLDS (threshold hold, then the word), the garrison's marks stand in the middle of the
  back wall, in the band neither jamb man's diagonal reaches (the two stand a metre out and half a metre wide of the jambs): a defender on either diagonal,
  awake and aimed, meets one of them alone and wins — the shover crossing (west back, the tape), or the hinge-jamb man once HANDLE.toolNear took the shover
  out of the opening (east back, 7 of 8 dice). In the middle they set, the can goes in and they meet him in its flash. THE CAN IS THE LESSON'S OWN ORDER SINCE THE WORD SPENDS NONE
  (`DOORTOOLS.wordNoCan`, on in the page): train-orders' kitchen step asks for 'bang and clear' given to the men holding the door (X, 5, 2: one can, then
  in), not for F. With the old line (F at the held door) the pair stepped in dry on that awake man and BOTH died on 10 of 16 shipped dice (seeds 1 to 8,
  read at six seconds a line and at the script's pace), which was lesson-gate's shipped red (seen on every build looked at, back some hundred steps); with `TPS_WORDNOCAN=0` the
  same sixteen passed with nobody lost, and so do the sixteen on the new line (one can each). F still ends the step. The scripted player gives the can
  where the hold is the one order (`outsidePlain`) and F where it is the old page (the frozen stand), and opens every menu the page's way where the ring
  stays (`CMDRING.stay`: the squad's key kept down, then the digits), so the ring is driven on a door the pair already holds. The line says "X on it",
  never "Press X": `keymap.ts keyText` draws the orders key as "hold Q" and folds the word only after "hold" or "with" ("Press hold Q" was printed). Headless only: never seen on a GPU, never played
  by a person. Re-run eight shipped dice (four
  `--hard`) and count `Blue …: → dead` / `Red …: → dead` lines after ANY change to the door tools or these marks: the lesson passes with a man lost. Where the pairs go straight in
  on the word with no can (train-pairs' white house), no defender sees OUT of a door: a man in a far corner with his gun down the room shot the first of each
  pair as he crossed his opening (1 to 3 men on most paced dice). Each stands in the pocket behind the open leaf of the door he watches.
  (6) a held man: 'Right button chokes him out' (close.ts `CLOSE.heldClicks`, on in the page); the step counts the deed (`downed how: 'choke'`), not the row.
- **The tutorial's solo loud mission, `tut-solo` 'The fuel stop, alone' (its title until the writing guide: 'The fuel halt, alone')** (2026-10-22; row `tut-solo` in `TUTORIAL_MISSIONS`, played on the tutorial's frame, `game/rails.ts`: the bullet below; `tools/levels/tut-solo.ts` → `levels/tut-solo.json`, a quiet-kind mission alone with a
  `scenarios.lesson` of 25 steps on rails (32 since the evening's reworks) and its own `scenarios.issue` card; the fights are `levels/tut-solo.script.ts`, one PLAY program `tutorial` whose beats start on the cue each step sends,
  `lesson:<cue>`; the scripted player is `tools/qa/lessons/tut-solo.ts`). ONE LINE through a walled halt on a road, every doorway centred on it (`AXIS` 14.25: a door's middle sits on a
  walk-grid cell): the road and a shot-up van (move, sprint), the yard wall beside the gate (rifle up, take the wall, shoot the sentry, reload), the arch (crouch), the sandbags in the gun's
  court (stay low), the gap (smoke, cross), the nest (frag), the shop's locked door (pistol, the held key's ring for the charge, stand clear, the word), the man behind it, the store (stun
  can, go in), the code book, and the way back (rifle, load the grenade, back to the arch, the launcher's grenade on two men who come out into the shop's doorway BEHIND him, out by the gate). Seven men: the roster's five are held on their marks from the first frame (a man a beat has ordered is the program's until it lets him go, fails or stops) and two are spawned for the last fight (the floor holds eight characters, the dead included). RULES IT KEEPS: one hit downs the
  player, so no scripted round is aimed at him or at a place a line asks him to stand in (the sentry shoots the van and stops when the wall's line comes up; the gun shoots the parked
  truck, then TRAVERSES the sandbags' top a hand over a crouched head, then hoses the gap, then fires blind at where he was once a smoke can has gone off between him and the gap (the `threw` test's `area`: a can thrown the wrong way does not pass); nobody is let go on a clock (a slow
  reader was shot beside the door with the line still up): the shop man and the store pair go to the AI when the player stands in a trigger volume of the level (`shop_line`, `shop_in`,
  `store_in`: all a play program may ask of the player) plus a breath, or when one is hit; the last two shoot the top of the arch's wall over him until one of them is hit. THE LAST FIGHT FACES EAST ON PURPOSE: the launcher's grenade arms 8 m out and 8 m is the edge
  of the page's view in every direction but up the line to the east (10 m, and clear of the kit panel): played on the page with the two in the truck court they were 14 m off the
  left edge. Its line passes when a grenade has gone AND one of the two is down (a dud from inside 8 m leaves the line up and lets nobody go). THE FRAME'S KEYS are the generator's `FRAME` table, a step each: he can walk and turn the view from the first line and every other action comes on with the line that teaches it (sprint, the rifle, the wall, fire, reload, crouch, smoke, frag, the pistol, the held key, the word, the stun can, the right button); ten cues start the script's beats; FOUR CHECKPOINTS, each where a fight has just ended: the gate (the sentry is down), the gun (the nest is out), the shop (its man is down), the store (the building is his). A checkpoint stops the program, which lets every held man go for a tick: the script's `hold` beat (on the program's start) takes the living roster back, no flag is kept across one, and the last two are found by name before they are spawned. THE INTERACTION KEY'S ROWS ARE THE TWO ITS LINES TEACH (`rails.rows: ['charge', 'drive']`, the frame's list of verbs the key may offer in a mission): the shop's locked door offers the charge and nothing else (no pick, no boot: played on the page before the list its ring showed all three), the code book's row is the trunk's, and no dead man can be dragged. The scripted player fails the door's step if the door's rows are anything but the charge alone, and the wall's step if he is on a wall before its line (the frame's own rule gives a wall to a walk only once `wall` is allowed; the whistle's wedge is the frame's to keep off while it is locked). THE HELD KEY ON THE PAGE is E and its choices are a ring at the cursor (`HANDRING`): the charge's line is written `[Space]`, the game's code, and reads E. THE CODE BOOK'S LINE ASKS FOR A TAP, and a tap does the top row: a body in arm's reach outranks an objective (`INTERACT_PRIORITY`), so the store's first man stands in the near corner, 3 m from where a man stands at the trunk (played on the page with him beside it, the tap dragged him), and the scripted player fails the step if the top row at the trunk is not the book's. Where the gun's key again opens its setup (`SLOTSETUP`) the grenade's line is its `setupLine` ('[2], then [2]'). His card carries ONE DOOR CHARGE
  (`issue.members.0.charges`: the validator lets a level issue the player his own, read only where his own charges are on, OWNCHARGE, which is the page): the frozen stand
  holds them off, so with the row list the door has no row there and the lesson cannot be done; the scripted player's file raises `TPS_OWNCHARGE` for a run off the page's stand, as such a run raises the frame (`TPS_OWNCHARGE=0` in front shows the door with nothing to offer). A LESSON'S PAGE WEARS A LEVEL'S OWN CARD NOW (`kit.ts`: `kitIssue` speaks before `kitIssuedPage`; before, a lesson's page played the plain issue with a Player's built counts and left the block unread, so this mission's page had four smoke and no door charge): this level is the only lesson that carries the block, and the check's last line asks its page's kit (2 smoke, 2 stun, 2 frags, 3 rounds; one door charge on the page's stand). Checks: `lesson-run.ts tut-solo` on both stands, and `tools/qa/tut-solo-check.ts` (it raises the frame and his own charges itself on the frozen stand; a plain `lesson-run.ts tut-solo` there wants `TPS_RAILS=1`; the two lessons about not being shot must
  be failable: the sandbags walked standing and the gap crossed with no smoke must each end with the player down; two mistakes must cost nothing: four seconds at each pier of the arch
  under the last two's fire, and a first grenade fired from too close; and THE CHECKPOINTS: down at the sandbags and again at the gap, Enter puts him back at the gate each time, the other three are put back by the harness a step after each is kept, and every beat is played again from its first line with the last two spawned once; `TUT_SOLO_BREAK=1` plays the standing arm crouched and must be red; green and its break red on both stands). Measured 10-22 on the frame: 16 of 16 runs through (four seeds, both stands, a reader's pause of 0 and of 6 s a step; about 105 s and 255 s of play) and one on hard; played on the real page six times (the last with the row list: the door's ring one wedge, 'set a charge') by real key and mouse events on the physical keys (software adapter, 1280 by 720, night and dry), the four checkpoints put back each time, every key locked before its line, the ring up at the door, a tap taking the book, no page error. The look it
  was built for is `?hour=dusk&weather=dust`; a row cannot carry its hour or weather, so picked from the list it opens at the visit's hour (night) and dry. Never seen on a GPU, never played by a hand; the pace wheel is not taught. Lines for other levels: `lesson.ts` `door` test state
  `charged` (a charge hangs on the door) and `threw`'s `area`; `director.ts` `c.stimulus.burst` now fires a roster man a beat holds (and at one), not only a spawned one; `rails.ts` the big line is the step's line AS THE KEYS STAND (`setupLine` where a gun's key again opens its setup); `lesson-run.ts`
  runs an `idleOk` step's script even when the step had already gone by, so its two arms press the same keys.
- **`tut-solo` after the maintainer's first play (2026-10-22, the same day; it changes the bullet above where the two differ).** Twelve notes, played on
  hard by link. WHAT THE MISSION CHANGED, 29 steps now: (1) THE FIRST PICTURE: he starts on the road at the van's open back doors (x 4.35, not 1.3: the world ends at
  x 0 and half the first frame was the dark past it; and the first walk is up the screen, a mark toward the camera from him sits under the big line),
  the moon is thin (0.22, was 0.9: an even moon was the flat look) under a darker sky, and the van is as its driver left it, everything on: two head
  lamps (beams across the forecourt), the tail lamps and the lamp in its load bay, which is the light he starts in (each a glowing sliver a hair off the
  van's own lens and a little wider, with a light of its own, so a round at a lamp meets the sliver and puts it out; the lens behind stays the dead
  glass `carlamps-check` finds, and the generator finds the lenses with `carlamps.ts findCarLamps`, so the kit's sizes are named in one place); a
  lantern at the foot of the wall he takes. THE FIRST SECONDS KILL NOBODY: the sentry's rounds cross the road east of the van, and nothing there tells
  a new player to keep off it, so the script holds his fire while the player is in either of two volumes (`road_east`, `road_nose`: that road and the
  way round the van's nose to it), and his bursts are three rounds, over before a running man is across the margin. (2) A HELD MAN FACES WHAT HE AIMS AT: an order's `aimAt` alone is his arms and eyes (the sentry shot over his shoulder), so
  the script's `aim()` gives every such order a `face` too. (3, 4, 5) THE WALL IS TAKEN ON THE SIDE A RIFLE SHOOTS FROM, AND THE LEAN IS A LINE OF ITS
  OWN. A rifle is carried on the right: facing in through the gate from the jamb on his right the gun is behind the frame and `GUNWALL` holds it at the
  low ready, no round leaves and nothing says why (measured: body within 0.4 m of that jamb, three clicks, no round; the other side one round and the
  sentry is down). The first build sent him to that side. Now the wall he sprints to is the other side of the gate, the gate's leaf is hung on the far
  jamb, the van is a little down the road so the run goes past its nose and never into the gate's line, and the order is: behind the van, rifle up,
  sprint to the wall, 'Walk into the wall: snap to it for cover', 'Slide along to the gate. Aim past the corner: you lean out' (the trigger is still
  locked on this line, so the lean is its only way on; lesson flag `lean`, new
  in `lesson.ts` FLAGS: out round a wall's open end by either hold; `peek` alone is also true for a moment of a rifleman who has only slid to the end,
  and the scripted player fails the step if it goes by on the slide), then 'shoot the sentry'. The sentry's fire through the gate is what makes the wall
  worth taking; it stops when the wall's line comes up. (6) THE BLUE GATE'S LEAF STOOD INSIDE THE SANDBAGS: the sandbags are a hand further from the
  arch's line. (7) THE CROUCH IS ASKED FOR UNDER THE FIRE IT IS FOR: 'Move up beside the blue gate' (the gun opens on the truck; the step holds a second, so the
  truck is shot at before the next line whenever he came), then '[C]: crouch.
  The fire goes over you' as the gun starts along the sandbags' top. (8) THE SMOKE'S RING IS ON FLOOR HE CAN SEE (the gap itself, not behind the
  sandbags) and the two throw lines say 'click the ring'. THE GAP IS CERTAIN NOW: eight lanes a hand apart, two rounds a lane at the gun's own beat
  (six-round bursts at six points left a crouched man across unhit once the step times moved: the no-smoke arm of the check found it). (9) THE PISTOL HAS A
  JOB: '[1]: the pistol. Its shot is quiet', then 'Shoot out the lamp: the dark is cover too' (test `target lamp_shop` dark), the lamp over where the
  charge's line stands him; its pole is on the far side of its head. THE LINE IS TRUE BY THE METER: the ground beside the door is lit by that lamp
  alone (70 with it, 0 without, by the CPU's estimate, which has no moon). For that the truck court's flood stands in the corner by the arch's wall
  and throws back across its own court (from the far corner it went over the wall and lit the gun court's south half), and the gun court has a mast
  lamp of its own, its head between the nest and the gap. (10) THE GUN'S SETUP IS MET EARLY: after the first reload, '[2], then [1]: full
  auto' ('[Z]: full auto' where the setup is off), and the grenade's '[2], then [2]' is asked at the arch, a line before it is used. FOR THAT THE
  FRAME'S GATE LETS A SETUP ROW'S DIGIT THROUGH BY WHAT THE ROW DOES (`rails.ts gate`, with `slotsetup.ts setupRows` and `slotSetupLeft`): before, a
  row's digit was dropped while that digit's slot was still locked (1 before the pistol's line). The selector's row passes with `mode`, the lamp's
  with `light`, the load's with the gun's own slot (its digit pressed again was the load's key before there was a setup); never on the setup's last
  ticks, where a digit let through as a row would be the locked slot's key after all. No switch of its own: it acts only where the frame and the
  setup are both on (the page), and either one off is the build without it. One tick is left open: a row's digit pressed the same tick as a click or
  a reload that shuts the setup. NOT THE MISSION'S, handed to their owners: the rifle that will not fire beside a jamb on
  its right (`gunwall.ts`); a mark where a thrown can will land (the throw preview is an arc to the cursor); a blast skips a man a sponge round put out
  (`frag.ts blast`: `state === 'dead'`); sponge rounds lent to this mission because its row is kind `quiet` (`kit.ts kitPlayer`); the stealth score on
  its end card for the same reason (`ui/debrief.ts`); an arrow on the ground for the wall's line (the frame's step key `toward`, not in this build);
  the setup box's own clock. Checks: `tut-solo-check.ts` plays it seven ways a seed (the new one stands six seconds east of the van in the sentry's
  line: nobody is hit), reads the shop's lamp by the meter, and is green on both stands with all 29 lines on two seeds, its break red on both. The run
  as the lines say stays on full auto from its line on, as a player is left. A SCRIPTED PLAYER ON THE PAGE IS ITS OWN BUNDLE: it reads a switch from
  the page's `__knobs`, never from its own copy of the module (the page play stopped at the selector's line until it did). Never seen on a
  GPU; the new opening was judged from the software adapter's pictures only.
- **`tut-solo`, the maintainer's notes from a second look the same evening (2026-10-22; level data and its script, no switch).** (1) "weird that
  we're standing here right in front of the window here he can shoot us": the shop's front wall keeps ONE window (north of its door: "the top window
  getting blown out and glass flying everywhere was sick" is that one and stays); the wall south of the door is blank and the stand-clear mark is
  against it (`BACK`, 1.8 m from the door: outside `DOORTOOLS.backblastM`), its line 'Stand clear: your back to the wall beside the door'. A
  STAND-CLEAR MARK IS AGAINST BLANK WALL, never a window the man inside can see through. (2) "weird that we're told to load the grenade long before
  being told to do anything about it": the cue that brings the last two (`trucks`) is on the load's own step, so the line is 'Two behind you. …
  load the grenade' with them coming, and the next line fires it. (3) "it doesn't make sense that the enemies spawn there though. maybe we have
  another door on the far room and show them coming from outside of the map and then running at you": the store has a BACK DOOR on the mission's
  line (door `store`, said 'back door'; steel, locked from the store's side, opening in), a lane behind it that runs off the map's edge between two
  walls (so nobody walks round the halt by it), and the last two are put on the floor in that lane (`LAST_IN`), the script throws the door open and
  they run the length of the building to the shop's doorway. The scripted player fails if that door is open or unlocked before its line, or shut
  when they stand in the doorway. The first line no longer breaks at its colon ('[W] [A] [S] [D] to move. Get behind the van': a key cap followed
  by a colon may wrap between the two). His fourth note, "F should be reserved for squad", waits on the controls' own-action row for a set charge:
  the 'blow' step still names the squad's word key until then. Both stands play all 29 lines on seed 1; from the arch the back door is off the
  page's picture, so what he sees is the two running in through the shop: never seen on a GPU, and nobody has played it.
- **`tut-solo` on the frame's cards and arrow and the setup as a mode (2026-10-22, after build step 844; 31 steps).** After the reload: 'setup'
  ('[2] again: the rifle's setup', lesson flag `setup`: the setup of the gun in his hands is up; where the switch is off the flag is true and the line
  goes by) and 'tab' ('[Tab]: close it. [Tab] closes every menu', flag `setupShut`), then the selector as before. The maintainer: "the timer is bad. we
  should just have it switch a mode. and we should teach earlier that tab exits out of menus". THE FRAME'S GATE, WITH THE SETUP UP, GIVES A ROW'S DIGIT
  TO THE ROW ALONE (`rails.ts gate`): the selector's row opens with `mode`, the lamp's with `light`, the load's with `alt` (so on the two lines that
  only open and shut the setup no row can be picked, the rifle's own digit included, and Tab is the way out); `alt` is unlocked on the load's step. The
  wall's mark is the frame's arrow (`at` a pace short of the wall, `toward` the wall); two cards: 'Walls' on the wall's step, 'A gun's setup' on the
  setup's. The row's third `teaches` line is 'Rifle and pistol, and a gun's setup'. The scripted player presses both row digits on the Tab line and
  fails if either is taken; it fails on the selector's line if the two lines went by on a stand that has the setup.
  THE LAST TWO COME ON A LINE THAT ONLY HAS HIM LOOK (32 steps; the same evening, after the build that deals the player's own card whole). His card on
  the page comes with the grenade on the launcher and no sponge rounds, so the load's line is true as it comes up and goes by unread, and the rifle's
  setup has no load row for him. Step 'behind' ('Two men behind you', cue `trucks`, done `{ is: 'cue', name: 'trucks' }`: the frame draws it as a
  watch line) is up while the back door is thrown open and the two run in; the script raises `done:trucks` once they stand in the shop's doorway, and
  only then is the shot asked for ('Hold right button, aim at their doorway, let go'). The load's line stays between the two for a kit that deals the
  ring first (the frozen stand, `?issuelend`); `alt` is unlocked on it. ON THE TAB LINE THE RIFLE'S OWN KEY IS TAKEN BACK (`tab: deny slot:rifle`,
  given again on the selector's line): with no load row that key is no row and would put the setup away as it opened it, and the line would pass with
  Tab never pressed. The stand-clear mark is 0.5 m further from the door (16.5, r 0.6): the whole mark is outside the charge's 1.6 m backblast, and
  the scripted player fails at 'blow' if the row would say "too close: you". The two store posts are routes `sacks` and `crates` (a route's name is
  said: `probes.ts words-routes` was red on `store_a`). CHECK: the scripted player now wears what the page deals (`pageKit` in its file, read by
  `lesson-run.ts`: `kitIssuedPage` and the solo card as `main.ts` deals it), so on the page's stand all seven ways of `tut-solo-check` are played
  with the grenade up and no load row, and on the frozen stand with the ring first and the load's line asked. Played: 2 seeds x 7 ways on each stand,
  and twice on the page on the software adapter. Never seen on a GPU; nobody has played it by hand since the rework.
  THE LAUNCHER HAS A CARD (the maintainer: "for 2 we probably need to explain secondary attachments for the rifle in a modal" "and where to see it in
  the UI, swap between secondaries, etc."): 'The rifle's launcher' on step 'leave', with the rifle back in his hands: the loads are the tags on the kit
  strip beside the rifle, the lit one is on the right button, HE arms 8 m out, the gun's key again and then its row's swaps the load. THE SWAP IS DONE
  on the load's line only where his kit carries two loads: a level's card (`IssueCard`) had no key for sponge rounds then (it has `rings` now and this level names two: the bullet on its ground and its two loads), so on the page he carried the
  grenade alone and the swap is said, not done (asked of the kit's owner). The card itself has not been looked at on a page.
  EVERY LINE, CARD AND LIST ROW REWRITTEN TO THE WRITING GUIDE (`docs/agents/writing.md`; the same night): each big line opens on a verb or on Press /
  Hold and the key and is one sentence ("Press [R] to reload", "Press [Tab] to close it, like any other menu", "Shoot out the light so you can hide in
  the dark"); the three cards are 'Taking cover on a wall', 'Setting up your gun', 'Using the rifle's launcher'; the row is 'The fuel stop, alone'. A
  second reader who did not write them read all 45 and flagged 13, all taken. ONE OF THEM WAS A TRAP IN THE BUILD: the stun grenade's ring stood in
  the storeroom's doorway, and a can thrown AT it catches the partition and stays in the shop, so the line never passed for a player who clicked the
  ring (the scripted player had thrown past it). The ring is now the middle of the storeroom (`STUN_AT`), the line says to click it, and the scripted
  player throws at the ring, as it does for the smoke and the frag.
- **`tut-solo` dressed (2026-10-22, level data only; groups `dress.*` in the generator).** The maintainer, of every tutorial level: "just as much
  (if not more! since it's first impression) polish and have it really feel great and organic". ADDITIONS ONLY, off the mission's line, each man's
  mark and every door's sweep: a melon stall and scrub on the roadside; a rope bed and a low table in the truck court's north corner; in the
  shop a rug under the table, a floor mattress with tea, a stove, a wall hanging; sacks and a mat in the store; the two walled back lots nobody walks
  into made a cook's yard (tandoor, rope bed, wood, a dish, a lantern) and a wash yard (a line, a motorbike, a lantern). 113 boxes, 10 props and two
  lanterns more (16 lights). It is the level's own furniture on both stands (groups `dress.*`), not the lived-in pass: `?lived=0` leaves it. The level's
  fingerprint moved: checkpoints and recordings of `tut-solo` from before it are refused. No fight moved: the scripted player's seven ways, 2 seeds on
  each stand (no tally over more seeds was taken: every man in it is the script's). Two free cells inside the floor mattress's footprint are cut off
  (under the lived check's three). Judged from the software adapter's pictures only; never seen on a GPU.
- **`tut-solo`'s ground and its two loads (2026-10-22 late, level data; one name more in the frame's action table, no switch; 32 steps).** THE
  GROUND: the maintainer, of the gun court at night: "ground looks pretty flat here". Each court was one finish with a pair of ruts in its own paint
  (no mark at all). Now the yard is the plain's dust inside its walls. A gravel drive a truck wide (`DRIVE`) comes in by THE TRUCKS' OWN GATE, new, in
  the truck court's south wall (`TRUCK_GATE_X`; group `walls.truckgate`: two shut steel leaves on each face of the wall, which stands whole behind
  them, so nobody walks, sees or shoots through), turns the corner, goes through the arch and opens into a turning apron before the shop (`APRON`,
  which reaches past the mark for the shop's door, so the ground he hides on is no paler than it was). The gate on the road is a man's width: the
  wheel tracks turn off the road before it, pass the start and go round the corner to the trucks' gate; a foot path comes in from the man's gate.
  Group `ground.marks` lays those tracks (damp on gravel, dirt on dust, broken where a thing stands on them), worn earth under the stores, the nest,
  the wood and the van's verge, oil where a truck stands at the shop's door, a fire's ring, rubble, eight dry bushes, and flat whitewashed stones
  along the drive's edges (the place's own ground mark; no painted line). Three flat layers a millimetre and more apart; every low thing is under
  0.19 m. 155 boxes and 8 props more (671 and 25). `level-needs tut-solo`: `ground` passes (the largest bare piece 36 m², outside the walls). The
  fingerprint moved again. Judged from CPU stills (`tools/menu-art.ts`, a picture's light, not the game's) and the software adapter's page; never
  seen on a GPU, and whether the tracks read as tracks at the game's own exposure is by eye there. The row's menu picture is made again.
  THE LOADS: the maintainer: "for 2 we probably need to explain secondary attachments for the rifle in a modal" "and where to see it in the UI, swap
  between secondaries, etc." The card names `rings: 2` (the kit's key for a mission's own card), so on the page the launcher comes up on a sponge
  round and the step `load` ('Press [2] twice to load the grenade') is a swap he does. The card 'Using the rifle's launcher' (on the step `leave`)
  says what the two loads do, where the loaded one shows, how to swap and how to fire; THE LOAD'S ROW IS HIS FROM THAT CARD ON (`leave: allow load`),
  so the swap works the moment he has read how, and the line `load` goes by for a man who left the grenade up. THE RIGHT BUTTON STAYS SHUT UNTIL THE
  LINE THAT FIRES (`launch: allow alt`; his first play: "i first accidentally sponged the guys"; a round at the two in the doorway lets them go, and
  a wait after it had the scripted player shot): the frame's gate gave the load's row and the right button one action (`alt`), so `rails.ts ACTS`
  has a name for the row alone, `load` (no key, no button: `gate` passes the load row's digit on `alt` or `load`). No other level names it. ON THE
  TAB LINE the trigger and the reload are taken back with the rifle's key (`tab: deny slot:rifle, fire, reload`, given back on `auto`): each puts the
  setup away, and the line went by with Tab never pressed. Checks: `tut-solo-check` plays an eighth way, `sponge` (the right button held on the two
  before the swap must fire nothing; it fails where the launcher comes up on the grenade), its Tab step clicks and reloads and fails if the setup
  is put away, and its kit line holds the page's card to the generator's own (`ISSUE`: two sponge rounds, the launcher on them). ON THE FROZEN STAND
  and with `?issuelend` he carries the lent five sponge rounds over the card and the launcher is on them too: the swap is asked on both stands.
  `issuewhole-check`'s two lines on this level follow the card's own `rings`. KNOWN: the card has one text, written for the setup as the page has
  it; with `?slotsetup=0` the rifle's key steps the load at once and "twice" is one press too many (the step's own line has both wordings). Five
  short sentences on that card, against the three a card is meant to be: his note asks for five things.
  THE MOON STANDS BEHIND THE SHOP (10-23, level data; the level's row in `lived-check`'s `LEVEL_BASE` moved to it). The line 'Shoot out the light so
  you can hide in the dark' stood him against the shop's front in the moon: with the lamp out the runner's meter, the moon and the night sky's own
  light on it (`lesson-run --sky`), read 31 beside the door, over the scripted player's own bar of 25, and the page read 28 (42 on a build before the one light-cache grid at every preset). The moon's direction is
  turned about the road's line (`[-0.62, -0.5, -0.6]`, from over the back lots), so the shop's front, the door he blows and the wall he waits
  against, is in the shop's own shadow and the lamp over the door is the one light on him there. Measured: the runner 10 (the bar held with no
  `mode.glow: false` in the script); the page on the software adapter, lamp out, 24 as he arrives and 14 settled, against 28 settled with the moon turned back on the same page. Every shadow in the yard falls the
  other way; no line, mark or fight moved, and `tut-solo-check` is green on both stands, two seeds, all eight ways. The menu picture is its own
  light and did not change. Never seen on a GPU: how the yard reads with the shadows turned is by eye there.
  HIS OWN STUN GRENADE (10-23, a lesson's prose and its scripted player; no rule changed). The maintainer: "do flashbangs take line of sight into
  account? i flashed myself in the solo loud tutorial level even though it went into the other room". THE RULE, as `combat.ts detonateStun` has it
  in the night game (this mission is one): a head within `bang.dazzleRadius` (8 m) of the burst with a clear line from it (`col.segmentBlocked`, from
  0.3 m over the burst) is blinded, 6 s close in to 2 s at the edge; walls and shut leaves block, an open doorway does not; facing counts for
  nothing, nothing goes round a corner, and the player gets it by `samstun.ts` (on in the page) as a guard does. A room fight adds the bang with no
  line (the same air within `FLASH.concussM`, half) and spares the thrower's side unless on top of it. HERE the store's doorway has no leaf and
  stands in line with the shop's door, so a man who throws from inside the shop looks down that line: traced with the scripted player, thrown from
  x 28.5 on the axis the can rolls to x 35.6 and blinds him 2.4 s (7.2 m), from 29.8 3.0 s; the scripted player stood at 26.8, 8.8 m off, and
  never caught it. THE MEND is the lesson's: a card on the step `stun` ('Throwing a stun grenade': who it blinds, what blocks it, throw and move
  to the side) and the line ends 'and get behind the wall'. The scripted player throws and steps aside and fails if his own can blinds him;
  `tut-solo-check` plays a ninth way, `flash` (thrown from nearer, the line not left: the can must blind him where SAMSTUN is on, and every step
  still goes by). The level's own base row did not move (prose). Nobody has thrown it by hand since.
- **A tutorial mission is a lesson on rails** (`src/game/rails.ts`, `Game.rails`; rows in `scenarioList.ts TUTORIAL_MISSIONS`, `group: 'tutorial'`, first in
  the list; `lessonGroup(group)` in `scene/scenarios.ts` is what the kit-as-issued, no-Loadout and verdict rules ask now, so both groups get them). SWITCH:
  `RAILS.on`, on in the page (`?rails=0` = the level is its mission alone: a level whose lesson carries a `rails` record has NO lesson with the switch off), off in the module and on the frozen stand (`TPS_RAILS=1` raises it; a `FROZEN_HOLDS`
  row, in the knob registry and the journal). The seven Training levels carry no `rails` record and are untouched. WHAT IT ADDS to a level's `scenarios.lesson`:
  a `rails` record (`allow` = the actions that work from the first step, `respawn` seconds for a teammate who went down, `fog`, `sky` = nobody on the floor is
  the player: he is parked unseen, the view rides the squad's middle, the walk keys shift it; `sky.eye { at, yaw, fov? }` = a lookout, one more eye for the fog of war that sees with no man standing there, so a mission can run in the fog from its first step and still show what the squad faces) and step keys `allow` / `deny` / `cue` / `checkpoint` / `fog`;
  tests `cue`, `squad` (the living teammates inside an area), `view` (turned / zoomed / shifted by a hand), `stackOn.set`; flags `dark` (the lights are out), `chargeSet`, `chargeClear` and `wallBlown` (a wall charge is on a wall / is on the wall the step's mark is on with the squad stood off out of its reach / one has made its hole). THE RING IS THE PLACE: an order asked with the cursor within `RAILS.snapPx` (40) of the step's ring on the screen is asked on the step's `at` itself (`Rails.markUnder`, first in `orders.targetUnder`), so a turned view or a wall in the cursor's line cannot send it elsewhere. THE MARK STAYS IN THE PICTURE in the sky seat: with no walk key held, a view shifted so that the step's mark is outside a kept oval is eased back until it is not (`Rails.keep`, never past the walk keys' own reach). The oval is ground by the camera's own axes: `RAILS.keep` (0.21) of the camera's distance to either side, `keepDeep` (0.79) of that up and down the screen, its middle `keepUp` (0.39) of it up the screen from the view's own. The numbers are from the page: a round of 0.33 had left the last room's ring behind the step's own line and the way-out ring under the squad's panel, at 1280 by 720, the smallest view played. rails-check's line 12 reads the mark's place on the screen each way the view can be shifted. A recording from before the oval replays the round (`journal.ts`). THE WALL WAITS FOR ITS LINE: a move key held into a wall takes it with no key (`player.ts wallPress`), so the gate cannot drop it; in a mission where some step allows `wall`, the walk takes a wall only once `wall` is allowed (`Rails.locksWall()`), and a mission that never names the wall plays as the page has it (rails-check, the wall's line, played on the quiet mission's house wall). THE LAST LINE STAYS UP: with every step done and the mission not yet over (the last metre to an exit, a fight's last man) `Rails.prompt()` still gives the last step's line, and none once the mission is over (`Lesson.over()`); the small objective row is never a tutorial mission's. The defenders' radio rows (`#log`) sit lower under a tutorial mission's line, one line each (`body.onrails`), and the line's own bottom is never under 112 px: on the stealth mission's page three rows had stacked up over the line. THE MENU LISTS WHAT THE MISSION NAMES: `rails.orders` (order ids) is what `orders.rowsFor` lists on the level, on the ring and under the quick key (`Rails.orderRows`); absent, every row. With the squad's only keys the menu is the command key held, so a line's `[X]` is drawn 'Hold' and the command key's cap (`ui/overlay.ts`), and the step that teaches it allows `menu` and `ring`. A recording of a tutorial run from before `snapPx` / `keep` were in the table replays with both at 0 (`journal.ts applyKnobs`). NOT NAMED UNTIL TAUGHT, three more: the hand ring has no whistle wedge while `whistle` is locked (`interact.ts whistleWedge`), the kit rows do not print the night-vision key while `nvg` is locked, and a long line breaks in two beside the kit panel instead of running under it (`index.html #railprompt`). The checkpoint's own restart of the program is `Rails.resume` (`cleanrestart` line 7 reads savestate.ts for the word restart). LOCKED UNTIL TAUGHT: the gate
  (`Rails.gate`, ahead of everything that reads the seat's Input) drops every key code and button of an action no step has turned on yet (`ACTS`; pause, back and
  text size always pass); the host's Ctrl-turn and Ctrl-zoom ask `rails.locks()`. ONE BIG LINE: `Rails.prompt()` is the step's line, drawn low in the middle by
  `ui/overlay.ts` (`#railprompt`), `[B]` in a line drawn as a key cap with the player's own key (`keyCap`; `[Ctrl]` is the camera's key, whichever the board gives it: `camCap`, the Space bar on the page today), a pip per step; the small objective row is empty,
  and in the sky seat the kit and meter rows are hidden. THE LEVEL'S SCRIPT: `levels/<name>.script.ts` (a `LevelScriptFn`), registered by level name in
  `scene/levelScripts.ts` and attached by `levelLoad.ts`; one play program `tutorial`, started with the mission; a step's `cue` reaches it as the signal
  `lesson:<cue>`, each order the player gives as `order:<id>`, and it answers `done:<name>` for the `cue` test. A running play program does not switch the
  room fight off on a rails level, and the Director's spawn budget is 16 there (`liftedBudget`). THE SKY SEAT'S SQUAD holds where the mission stood it until its first order (an unordered man would fall in on the parked player), and the squad panel shows no key no step has taught (`Rails.locks` in `orders.ts`). THE MISSION AGAIN opens on the view the first run opened on (`Rails.hostView`, between ticks on the host's camera; `Rails.fresh` keeps that from counting as the hand's turn). CHECKPOINTS ARE AUTHORED: on a rails level the
  every-step save and the floor's own triggers are off; a step's `checkpoint` writes an in-memory save the tick it comes up (the program is stopped for the
  snapshot and started again next tick with the step's cue; a load does the same), so a beat must start fresh from its cue. A room clear on rails ends with the
  last step, not with the rooms. CHECK: `bun run tools/qa/rails-check.ts` (probe `rails`, family `missions`; thirteen lines: the block whole, switch off = the mission alone with
  no lesson, the first step parked and locked, one action a step, done by the deed, nobody lost, the room fight beside the program and no early end, a checkpoint
  put back, the journal, the mission again, the ring is the place and the lookout sees the road and no room, the mark stays in the picture, the menu lists only the mission's orders) passes on both stands and `RAILS_BREAK=1` (the gate passes everything, the ring is no place, nothing keeps it in the picture, the menu lists every order) fails seven lines on both. THE FIRST MISSION `tut-sky` ('The tunnel, from
  above', `tools/levels/tut-sky.ts`: a floor of its own since 10-22, the bullet below; before that the pass's own geometry under snow, as 'The halt, from above'; a roadblock and a gun truck with lit
  lamps on the road, shutters on the windows; `levels/tut-sky.script.ts`): the squad pinned behind its trucks, the view turned, zoomed and shifted; the first
  order under the squad's own smoke; a fight for the gate; stack and the word on two doors; the kitchen by the door between the two rooms; the store's door is locked, so a charge goes on its wall from the squad's ring (the command key held, wall tools, the charge: three charges carried, a wrong wall costs one and the line stays up) and the word blows it once the squad has stood off; the command key on the mains box on the yard wall puts the lights out, night vision comes on, the last room is taken in the dark by the store's inner door and the squad is sent back to its trucks. A room taken is its step done however the squad went in (a second tap of the command key at a stacked door sends them in with no word). A teammate says what the squad has found as the wall, the mains, the dark and the way out come up (the script's beats `wall`, `dark`, `nv`, `out`). Fourteen steps then (fifteen with the tunnel station's `torches`), the fog of war from the first (a lookout on the first truck's cab shows the roadblock and nobody in a room) until the tunnel station put it off for the whole mission (the bullet below). Checkpoints: the road, the yard, the tea room, the kitchen, the store. A TUTORIAL MISSION IS THE PAGE'S: `lesson-run.ts <name>` stands one up on the shipped stand whatever stand it was asked on (the frozen stand holds the frame and the newer orders off, where it has no lesson to play). MEASURED: the
  scripted player (`bun run tools/qa/lesson-run.ts tut-sky --seed N`) ends all fourteen steps on seeds 1, 2, 3, 4, 7, 9 and 10 in 130 to 144 s of play on the page's stand; `PORT=<port> node tools/qa/tut-page.cjs` plays it on the real page with real key and mouse events (software adapter: it steps with `__runFrames(n, dt, keys, 'none')`, which draws nothing, and takes a picture by reading one drawn frame back; on that adapter a hand's own keys played all fourteen steps to the mission's end on the tree with the squad's keys on Q and F alone, the ring for the wall charge among them: sixteen lines, none red, the squad back at its trucks at 140 s). NOBODY HAS: seen it
  on a GPU, felt it with a hand, or seen what the smoke does to the road fight (the harness has no smoke sight lines). FOUND: a teammate who has seen an enemy
  through glass he cannot shoot through stays rooted in 'alert' under an order (hence the shutters); a man a script holds runs no AI.
  - **Mission 1 has a level of its own: the tunnel station** (10-22; the maintainer: "mission 1 was feeling a little cramped. and honestly each tutorial level
    should have its own awesome level, not reusing ones like the pass"; "another sick moment is when you throw out lights in the block and have the spinning red
    lights. maybe we need to have a moment where we teach about light and how enemies react differently to it"). LEVEL DATA AND A SCRIPT, NO SWITCH: nothing
    here is a rule. `tools/levels/tut-sky.ts` imports no other level's generator (the kits and the snow paints are everybody's). ONE SENTENCE: a road-keepers'
    station cut into the rock at a tunnel's mouth, under snow — a long ploughed road into the bore, one gateway off it, a yard with a plough lorry in it, a
    range of three rooms under the rock (tea room, kitchen, store) and a bunkhouse standing by itself across the yard. It fills the engine's whole 40 × 28 m
    world (the maintainer, the same day: "cramped for mission 1 meaning we should have a bigger map!" — a map bigger than the world is the engine's to give,
    and was asked of him as a choice). ROOM: the road from the squad's marks
    to the gun truck's nose is 19 m (the pass gave about half that), the gateway 3 m, the yard 25 × 8 m, the rooms 9.8 × 7.3, 7.9 × 7.3, 6.8 × 7.3 and
    6.8 × 6.3 m, no two doors inside 2 m of each other on a wall. SEVEN DEFENDERS (two, one, one, three; `maxMen: 7`) and the roadblock's three, who are
    Tango 8, 9 and 10 now (rooms' men are named first). The wall between tea room and kitchen is masonry and the store's man stands off every line a round
    for the kitchen's man can take through the thin wall: FOUND on one seed in five before that, a stray round through the partition took the store's man
    during the kitchen's fight, the store was "taken" with nobody in it and the wall charge's two steps went by unplayed. The bunkhouse door is hung to open
    OUT (nobody wedges it; the men who come out of it walk straight out). THE LIGHT BEAT: five emergency beacons (`beacons[]`, domes of group 'emergency'
    off the mains: over the mains box, on the bunkhouse, at the gate, in the tea room, on the tunnel's face) turn red when the mains go; the mains' step
    carries the card 'Light' ("Men fight by what they can see. In the dark they are slow, and they come with torches. / Your squad has night vision. Put the
    lights out, and the dark is yours."); a new step `torches` after `nv` (fifteen steps now; its line has no key in it, so it reads as one to watch: "They come with torches: the light gives them away") is the script's:
    the bunkhouse says on the radio that two are going to the mains box, its door opens and two men come out behind their weapon lights at a walk, a second
    apart. THE PLOUGH LORRY STANDS BETWEEN THE YARD AND THE BUNKHOUSE'S DOOR, on purpose: from the mains box and from most of the yard the first thing seen
    of them is their light on the snow round its tail, then the men. Nobody's eyes or trigger are touched (FOUND: a teammate under a lesson's script still
    fires through the room fight, `roomfight.ts tickOp` — only a defender is left to the script — so "the squad holds its fire for a breath" cannot be
    scripted from a level; and with the lorry along the road wall instead, both were shot on their own threshold half a second after the door opened, seven
    seeds of seven). They are the game's own men the moment one is hit or they are where they were going, the door is shut again behind them, and the step
    is done when both are down or seven seconds after. A squad already at the bunkhouse's door has made that room a fight: nothing is staged then and the
    step goes by. FOR THAT the script holds the bunkhouse's three on their marks beside their own door from the start (beat `hold`, run again after every
    checkpoint; only a man still inside the room is held, so one let go into the yard stays his own) until a squad man is within 3.6 m of that door:
    without it they crossed the yard into the range's fight and there was nobody left to come out. The game's own rule for a blackout (`POWEROUT`) keeps
    men on their doors once the house knows it is under attack, which is why this is a beat and not the rule. CHECKS: `bun run tools/qa/tut-sky-check.ts` (the level's own; nine lines: its own generator, the sizes above, the card and the
    step, the beacons in the file, and live — no beacon lit with the mains in, all five lit a second and a half after they go, fifteen mains fixtures dark,
    ten lamps that are not the mains' still burning, and no free cell of the walk grid cut off from the yard) passes on both stands and `TUT_SKY_BREAK=1`
    (the mains never go) fails; `level-needs.ts tut-sky --run` no FAIL on both stands (one NOTE: the store's locked door is the wall charge's reason, and
    two door charges are carried as well); `map-check`, `level-lint`, `door-size`, `lived-check`, `second-way-check`, `floor-order-check`,
    `level-names-check`, `wallfurn-check`, `probes.ts glassreal lightswitch oneway-men oneway-deal`, `carlamps-check` green; `rails-check` green on both
    stands with its break red (fourteen lines); `lesson-gate.ts tut-sky`: the page's arm at a reader's pace (six seconds a line) goes through all fifteen steps, and its frozen arm with the
    frame raised stops at the charge's step exactly as it did on the old floor (not this level's). FOUND AT A READER'S PACE and mended: furniture along the
    road wall left single free cells of floor nobody could walk off; the move-in order posted the fourth man on one and every order after it was refused.
    THE SECOND PLAY'S NOTES ARE ON THIS FLOOR (the bullet "The second play's notes" below was measured on the old one): `ZONES` are the same seven boxes
    moved to the new road, each post's clear line into each measured again (fifteen points a box from the post's eye) and `by` set from that; the `push`
    beat is the same with its marks at the new gate. `rails-check`'s two lines on them, on this floor: 83 marks in 14 s over 16 metres, the busiest 17 %,
    the nearest to a man 1.9 m; the gate's line stands 5.1 s on the page's stand and 5.9 s on the frozen one (bar: eight), all four up, the road from the
    roadblock to the gate 17.8 m (the old floor's was about ten: more road is what was asked for). ITS CONTROL CHANGED, and why: on the old floor the
    script's `direct` walk taken off its men sent them round the whole halt (27.5 s); here the road is the one way from the roadblock to the gate, so with
    `direct` off they walk the same road (5.6 s) and that run now has the same eight-second bar. The run that must be long is a third, the roadblock's
    men kept where they stand: 99 s on both stands. So nothing on this floor fails when `direct` stops meaning anything: that is a gap this level opened.
    ON THE JOIN: the scripted player ends all fifteen steps on seeds 1 to 7 on the page's stand, and on seeds 1 to 5 again on the build that carries
    the flinch at close fire (130 to 137 s of play). The real page was played on this floor twice on the software adapter before the join (all fifteen
    steps by a hand's keys, no red line, no page error). NOBODY HAS seen it on a GPU; the red of the beacons is seen from the lights going out until the
    goggles come on, and again on the walk back, where the frame lifts the goggles. ITS ROW NAMES THE NIGHT (`hour: 'night'`, the `ROWSET` rule, `?rowset=0` off): the
    mission's last third is the mains going out, so a visitor's standing pick of another hour no longer opens it by day; no weather is named (a snow
    level's own stands). `rowset-check` green on both stands with its break red, two seeds of the scripted player after it. NO FOG OF WAR
    ON THIS MISSION (`rails.fog: false`, level data; the maintainer after a third play with the squad's own wall charge going off unseen: "still can't see
    the wall shot detonate here. maybe we just remove fog of war entirely from this mission?"). WHY IT WAS UNSEEN, measured: the fog takes five eyes
    (`FOG_EYES`), the four men and the seat's road lookout fill them, and the eye the wall steps name (`eye`, `rails.ts stepEye`) is pushed last, so with
    four men up it never got one: at the blow's step the fog had eyes 20 21 22 23 199 and the wall's face was not seen. That is the frame's to mend for a
    mission that keeps its fog; this one shows the whole floor. `rails-check`'s line on the ring now holds that every man on the road and in the rooms is
    drawn (it held the lookout's road and nobody in a room); `tut-sky-check` has a tenth line, the wall's face in the live picture on the blow's step,
    red with the fog put back (`TUT_SKY_BREAK=1`: "fog of war on, 5 eyes · the wall's face HIDDEN"). Nobody has seen the blast on a GPU since.
    MEASURED: the scripted player ends all fifteen steps on the page's stand on seeds 1 to 7 in 129 to 140 s of play; the first man with a
    torch is hit two to three and a half seconds after the bunkhouse says it is coming, by the lorry's tail; the second often stays behind the lorry and is
    the last room's fight. `PORT=<port> node tools/qa/tut-page.cjs` (software adapter, a hand's own keys and mouse) played all fifteen steps to the
    mission's end, twenty-three lines and none red, on the floor as it was before the lorry was moved and the pockets closed; the lines above this bullet
    that speak of fourteen steps and their seeds are the old floor's. MOVED: the level's fingerprint (every box): checkpoints and recordings of the old `tut-sky` are refused. The menu's picture
    is drawn again from the new file (`tools/menu-art.ts tut-sky`). NOBODY HAS: seen any of it on a GPU (the red light turning on snow, the torches in the
    dark yard, the tunnel's mouth, the first frame); played it with a hand; seen whether light round the lorry's tail reads as torches coming, or what the beacons' red does under the goggles' picture (the night vision is one colour: the red is the walk back to the trucks, with the goggles off).
  - **The first play's notes on 'The halt, from above'** (10-22; the maintainer played it on a GPU, the first sighting of it there, and sent ten notes; two of them,
    the word's cap on a door and the ring staying on its point, are the orders code's own switches). No new switch: all of it is the frame's, under `RAILS.on`
    (`?rails=0`, `TPS_RAILS=1`), and data in the level. WHAT CHANGED: (1) THE ROAD READS AS DANGER. `rails.sky.low: true` puts the parked squad on a knee behind its
    trucks (the hold the seat gives carries `crouch`; a Director order's crouch on a TEAMMATE is overwritten every tick by the orders' own hold, so it has to be
    the hold's) until an order has moved it this run; the roadblock's rounds are aimed two times in three at the snow beside the files and the air over the
    trucks' tails (`AT_NEAR`), in longer strings with shorter gaps, so the men flinch (twelve flinches in 25 s on seed 1, nobody hit), and one of them shouts
    every six seconds or so. (2) SMOKE BEFORE ANYONE MOVES: the smoke's cue is on the step BEFORE the first order (`pan`), two cans from two men's hands, thrown
    again every 27 s (a can burns about 32) until the order is given; the roadblock then fires blind at the smoke until the squad is through the gate. (3) 'WATCH
    IT' IS GONE: the gate's line is 'No order needed: they hold the gate', and Red One says so on the radio. (4) NO TEAMMATE'S LASER: `rails.lasers: false`
    (`Rails.noLasers`, one clause in `irlaser.ts laserOn`); the lasers anywhere else are untouched. (5) THE HOLD IS ITS OWN LINE. Step keys `noTap` (a tap of the
    command key gives no order while the step is up and these words come up under the line for 2.6 s, the line shaken once; only on a stand where the hold puts
    a ring up; the ring's first wedge still gives its order; the squad panel's row for the tap is not offered), `menuLine` (the line while the squad's ring is up
    on the step's mark) and `pageLine` (… and a page under its first is showing): 'Hold Q on the wall', then '5, then 3: a charge', then '3: a charge'. The hook
    is `orders.ts tapGive`, at the tap's three call sites. (6) THE WALL IS SEEN GOING: the men stand off with their backs to their own charge
    (`wallcharge.ts standOff`, `brace`), so the fog hid the blast; step key `eye` is a lookout for the fog while the step is up (`Rails.stepEye`, pushed beside
    the seat's own in `fogofwar.ts`), on the charge's and the word's steps. (7) THE WAY OUT: step key `onWay` (`{ nv: false }`): once a man is under an order to
    within `RAILS.wayM` (6 m; absent in an old recording = never) of the step's mark the view eases back to the squad and the night vision is put up, once (the
    key is the player's again). CHECK: `rails-check.ts`, the line 'the first play's notes hold', seventeen lines green on both stands and `RAILS_BREAK=1` red on
    eleven on both; the scripted player ends all fourteen steps on seeds 1 to 4 on the page's stand. `tut-page.cjs` taps, holds and reads the lines on the real
    page (software adapter). NOBODY HAS seen any of this on a GPU or felt it with a hand: whether the road now feels dangerous is a thing only a play can say.
  - **A step's card, its arrow, and the opening card** (10-22; the maintainer playing the squad mission: "i think this needs more explanation for the systems.
    maybe even a modal that pauses the game and explains it … and then the player can try it out", and of every tutorial mission: "the mission card at the
    beginning should also explain everything we're teaching and the general context / some light scenario setting"; of the solo mission's wall: "instead of a
    circle pointer, maybe we need an arrow on the ground"). They are the frame's (`RAILS.on`: `?rails=0` = no lesson, so none of them) and page-only: the
    game says what a step's card and arrow ARE (its data), and nothing under `src/game` knows whether a card is up or was read, so no run, snapshot or digest
    moves. (1) THE CARD: step key `explain: { title?, text }` (a heading of at most 40 characters, at most 260 of text, a new line a new paragraph, a key in
    brackets drawn as a key; longer is a fault `checkLesson` names). `Rails.card()` is the card of the step that is up; `ui/railcard.ts` draws it in the
    middle (`#railcard`, rules in `index.html`, over the speech bubbles) and `main.ts` holds the world still under it (one term of the loop's `frozen`,
    `overlay.cardUp`; the quality ladder does not sample those frames), so the step's own beat plays out only after it is closed. Enter, Space or a click on
    its block closes it, but a key only once it has been up 0.4 s (the tap that ended the last step does not put it away unread); those keys are asked of the
    card by the game's `Input` first (`keyVeto`), so the press that closes it is no game key; every other key is the game's, and Esc is the pause card's.
    ONCE A PAGE: a card that was closed is not shown again on that page, not after a checkpoint put back and not when the mission is started again (which
    cards were read is kept in `railcard.ts`, outside the Game, because the checkpoint a step asks for is taken the tick its card comes up). `?cards=0`
    leaves the cards out. NOT HELD: a headless run (it never makes one), a page a script steps (`__runFrames`: the card is drawn, and goes with Enter or its
    step), a replay's tape (none drawn). KNOWN: a step that comes up and is done inside one drawn frame never shows its card. Mission 1 carries two ('Doors'
    on the first stack, 'Walls' on the charge); the other missions' are their own to write. (2) THE ARROW: step key `toward: Vec3` beside `at`: the HUD's
    ring is three chevrons from the place toward that point, turned as the view has the two (`Rails.arrow()`, `.objmark.arrow`); at the picture's edge it is
    the ring. Drawn flat on the screen, not laid on the ground in perspective; no shipped step carries one yet (the solo mission's wall is its first use).
    (3) THE OPENING CARD: a tutorial row's `scene` (where we are and why, a sentence or two) and `teaches` (three to five short lines, things and not keys)
    in `scenarioList.ts TUTORIAL_MISSIONS`, drawn by the load brief (`ui/loadbrief.ts`: `.bscene` and a 'You will learn' list IN PLACE OF the job's line and
    the three cells, so the column fits a 1280 by 720 window: measured, no overflow on any of the four; in the one-column layout under 820 px the scene runs the column's
    whole width and the list is two abreast: at 820 by 600 Start, Controls and Back are all in the window, measured on two of the four; at 800 by 560 it
    scrolls 16 px, less than a plain mission's card there; the opening card's line has no break word of its own); the four scenes are one light thread (a convoy gone
    quiet, its code book, the post it names, the house that paid it). CHECK: `rails-check.ts`, two lines (the card and the arrow, with the card's page half
    on a made-up element and clock; the opening card's data), nineteen green on both stands; `PORT=… node tools/qa/railcard-page.cjs` on the real page
    (software adapter): the card up, the page's own loop let run under it, Enter, the checkpoint put back, the mission again, the arrow; `tut-page.cjs`
    closes each card it meets the same way. NOBODY HAS seen a card, the arrow or the opening card on a GPU, or read them as a first-time player.
  - **The second play's notes on 'The halt, from above'** (10-22; the maintainer on a GPU again: "would be nice if the fire wasn't at a single point, was
    spread around", "Q doesn't do anything here" (the stack's step), "this beat is too long, unclear what to do" (the gate), "after completing the command we
    shouldn't tell the user to do it again"). All under `RAILS.on`, data in the level, and three knobs the journal carries (`journal.ts applyKnobs`: a
    recording from before them replays with `afterSecs` 0 and `shiftTap` false). (1) THE FIRE IS WALKED: `levels/tut-sky.script.ts ZONES` are seven boxes to
    aim into (both trucks' noses and screens, the road in front, the wall beside one file and the lane past the other, the air over the tails), each with
    the posts that have a clear line into it, and `rake` fires a burst two or three rounds to a place, then another place in the box. Before: 84 of 145 marks
    in one metre (most of the old fifteen points lay behind one bonnet from where the round came). After: about 170 marks in 30 s over 25 to 27 metres, the
    busiest 14%, nearest mark to a man 2.6 m (seeds 1 to 3). (2) A LINE STOPS ASKING: a step's `after { line?, on?, word? }` (`scenarios.ts LessonStep`,
    `rails.ts noteGiven / prompt`) replaces the step's line once an order of the squad's is out (`on` narrows which; `word` is the line once the go word is
    out) and stays while a man is still on his way and `RAILS.afterSecs` (8) after; the ask comes back when that has stood `RAILS.afterMax` (45) seconds with
    the step not done. (3) A LINE TO WATCH: an after line, or the line of a step whose `done` is a cue (it only waits for the level's script), when it has
    no key in it, is drawn smaller with a pulsing dot and no mark on the floor (`prompt().watch`, `ui/overlay.ts`, `index.html .line.watch`). NEVER a step's own
    line that merely names no key ('Get out of the light' is an ask and its mark is where to go: the first rule read the text alone and would have hidden
    ten marks of the squad mission, eleven of the solo one, nine of the quiet one; caught in review before it was handed in). The after line needs the order
    POINTED AT THE STEP'S PLACE (a man's order post within `RAILS.wayM` of the step's `at`), holds after the word too while men are on their way, and a word
    that sends nobody (the wall charge goes at once, no order is logged) counts where the step's `after` has only a `word`. (4) SHIFT WITH THE COMMAND KEY: while the step does not allow `plan`, Shift down with the command key was a
    press thrown away (six taps, no order, `give` never called): the one way found to make the stack's step do nothing. `RAILS.shiftTap` takes the Shift off
    and passes the tap. Whether his Shift was down is a GUESS (a screenshot shortcut's key-up never reaches a page); so the page's input also lets go of a
    modifier the next key or mouse event says is up, and takes a key that goes down again unrepeated as a fresh press (`game/input.ts modsUp`). (5) THE GATE'S
    BEAT IS SHORT: the roadblock's two sandbag walls overlapped, and the road is a lane their side knows the squad covers (`lanes.ts lanePenalty`), so its men
    went round the whole halt: 11 to 13 s of a line that asks for nothing in a scripted run, more in play. The walls now leave a gap a man walks through, a
    scripted order's `direct: true` (`GuardScript.direct`, `director.ts OrderPatch`) sends a man the short way with no lane price, and the `push` beat waits
    for three of the squad to be in the yard: the line stands 1.9 to 3.3 s on six seeds on hard, nobody of the squad down. CHECKS: `rails-check` lines "the
    second play's notes hold" and "the gate's beat is short" (3.4 s on the frozen stand, 3.8 s on the page's, 27.5 s there with `direct` taken off), both
    stands, `RAILS_BREAK=1` red; the scripted player all fourteen steps on seeds 1 to 6 on hard. TRIED AND TAKEN BACK: fire kept up south of the squad's lane while it runs (one seed in six a man of the
    squad went on a knee and the squad never set in the yard) and bursts at the gate's wall as the roadblock walks (a man who fires is engaged at once: they
    died at their own sandbags). A scripted man fires only what the script fires, and scripted rounds are real rounds. A sprint's Shift is left alone (a walk key
    down on a step that allows `sprint`). A step's arrow (`toward`) no longer fades near the player (the solo mission's claim). NOBODY HAS seen any of it on a GPU or pressed it on a Mac; the
    fight at the gate has never been watched through real smoke.
- **The tutorial's squad mission, 'A harder fight'** (row `tut-squad`, `scenarioList.ts TUTORIAL_MISSIONS`, group `tutorial`; `tools/levels/tut-squad.ts` → `levels/tut-squad.json`, its staged
  moments `levels/tut-squad.script.ts`, its scripted player `tools/qa/lessons/tut-squad.ts`, its page run `tools/qa/tut-squad-page.cjs`). A PROTOTYPE: one street through a walled post, the four,
  eleven defenders in six rooms each its own squad (`mayLeave: false`, nobody digs in), twenty-three steps. Two easy rooms on the squad's key, then four staged fights that each show ONE thing the
  other side does: the workshop's man holds his open doorway from the far end of the room, in the picture through the fog, his rounds on the guard hut's wall (the answer is the side door, at his back), a gun behind chest-high bags covers the street (shoot back, move to the
  blocks, a frag over the bags), two men wait in the dead ground either side of the hall's locked door (shot through the sill window, then the walk round to the door and the boot), and a picket of three comes by
  two gates (one shows in the road gate while two walk round to the back gate, down the alley and out into the street in front of the rifles the cover order turned; the last line is
  'Finish the last of them' (it was 'Finish the picket': "what's a picket", the maintainer; no line, card, squad name or blurb of the mission says the word now, and the squad is 'Roadblock'), and the picket's last man drops his rifle and runs: the sub-bullet on the two harsh places below). What is SCRIPTED is only what must be seen at a known moment (the bursts out of the doorway, the gun's first burst on the wall, the
  picket's walk) and what keeps a line from putting the player down (the store's two, the nest, the hall's two: the sub-bullets below); every man is the room clear's own and is released to the game's AI the moment his show is over.
  - **It is played on the tutorial's frame** (`game/rails.ts`, the bullet above: `RAILS.on`, `TPS_RAILS=1` on the frozen stand; with the switch off the level is its mission alone). Its
    `rails.allow` is what the three missions before it taught (his feet, hands and rifle, the view, the squad's key and the word); the orders menu comes on with the step that asks for it
    ('follow', `allow: ['menu', 'ring']`, `noTap`: a tap of the squad's key gives nothing while it or 'back' is up; its two menu lines name `[X]`, which the frame draws as "Hold" and the squad's key while that key kept down is the only way to the menu, and
    without `ring` the frame cuts a held command key to a tap; the scripted player opens the menu that way when the ring is on and stays, by X when not) and the frag with its step (`allow: ['slot:frag']`); `respawn: 5`. Its cues are `shop`, `gun`, `ducks` (on the step after 'gun': he has shot back), `atblocks` (on the frag's step: he is at the blocks, and the gun stays down from then), `fragged` (on 'nest', the step after the frag's), `picket` and `covered` (on the last step: the cover order is given); a beat that was busy when a cue came asks `q.signalled('lesson:<cue>')`; its checkpoints 'the street', 'the wall', 'the hall'
    and 'the bags' each sit at the start of a staged fight, before the cue of the beat that follows, and every beat starts clean from its cue (the picket's beat starts with the program, holds
    the three in their camp and the yard's gates shut, and waits for its cue: so a checkpoint put back finds them held again).
  - **A man the mission's script has in hand stays the room fight's man** (`roomfight.ts tickDef`, `Def.staged`; `Director.lessonRuns`): on a floor whose defenders are the room clear's own
    roster, the fight ended "somebody else's script" on a roster man the frame after the order (so nothing the script staged was ever held: only its bursts fired) and then dropped him from
    its roster for good. Now it leaves him alone while the script holds him; let go ON his post he holds it again, let go somewhere else he is taken up as a man holding THAT place (the
    roster's own `adopt`). The covered-lane rule (`lanes.ts laneGate`) leaves a staged walker to the script too: it stopped the picket's two in the alley ("I'm not walking into that!") the
    moment they were truly held. (The first tutorial mission spawns its men by the script, so it never met this.)
  - **Director facts learnt the hard way**: a beat that ENDS hands back every roster man it touched, so a beat that holds men must stay alive (it waits on its cue); `tickBursts` could not find a
    roster man it had not spawned (mended: it looks him up among the guards); a scripted round is a real round (a burst laid on a line that ran on through a gap killed the player: lay it on a wall);
    a new script switch `D.systems.theirFrags(false)` holds the defenders' own grenades for the level (`frag.ts fragThrowTick` and `free`, `Director.theirFragsOff`): this level's three
    carriers are the nest's second man and both of the hall's, and a grenade nobody has been shown killed the player 1.3 s after his own.
  - **Level facts**: a doorway's middle is 0.85 m past the door's `at`; `locked` with `keySide` locks one face only (the hall's outside is `keySide: -1`); the game's own "they force a locked door
    near the squad" rule opened the hall by itself until its men were moved to the door wall's corners and the door to the far face; the response team proper (`scenarios.response`) is timed from
    the first shot and cannot wait for a cue, so the picket is roster men the script walks; the street wall runs a metre past where followers wait or the gun shoots them there.
  - **The hall's door is kicked, not shot** (since the play notes below; what a leaf costs to shoot out is the doors goal's rule and no line of this mission asks for it now). Measured
    before that, for whoever stages the later lesson: a wooden leaf opened after 6 rifle rounds squarely at the page's destruction (0.5), 19 to 23 from 1.5 m to one side and on one run
    not in 40 (rounds on the jamb do not count), never at destruction 0.
  - **Checks**: `bun run tools/qa/lesson-gate.ts tut-squad` (a tutorial mission is gated by name; the gate gives its frozen runs `TPS_RAILS=1`): the scripted player does all twenty-two
    steps and the run ends 'taken' on the frozen stand, and on the page's stand on four dice, two at six seconds a line. For a level WITH a script the gate's "lesson off = the same run"
    line is a NOTE, not a bar, and that run is not made: the script makes it another mission. `lesson-run` reads a script's `fightOk` (steps a fight may finish by itself: here the steps
    inside the workshop's, the nest's, the hall's and the picket's fights), so the scripted player holds the staged moments to account itself: `done:shop` raised (a round of his is out), the workshop's man still in the
    script's hand, standing in the level's `shop_line` volume, his lane door open and he drawn where the fog runs, `done:gun` raised, the four checkpoints kept, and the checkpoint 'the bags' PUT BACK mid-run with the same step up, the program running again, the picket in hand and the
    road gate shut. It plays under the locks: the menu and the frag are pressed only at their steps. `PORT=<port> node tools/qa/tut-squad-page.cjs`: the row on the real page (software
    adapter), the big line with Q on a key cap, the frag and a tool locked at the first step, its first eight steps by real keys and the cards on the way (out to the street in front of the workshop; there its man held, his door open, drawn under the fog, and he and the side door's ring both ON THE SCREEN; the squad's key on the step's ring; the walk round; the key again), the checkpoint 'the street' put back, and its two menu
    steps put up by hand (`lesson.i` set from the check, nothing walked to them): each line's caps, the menu's own key giving nothing, the squad's key kept down as a ring on no man, the
    digit that gives the order, and the same key kept down at step 1 putting no ring up.
  - **Re-staged on five play notes** (2026-10-22, the maintainer playing it on hard: "weird that we can get little peeks of the guy shooting. can be distracting" · "we should
    motivate going into this room that he's shooting. maybe we have the guy notice us after we finish the second room, get rid of one of the dividers so we can see his bullets (and him,
    maybe clear FoW for him once we enable him), and then motivate going through the other door" · "weird that we signal going around the nest but then tell player to suppress" ·
    "awkward here in that player will try to shoot the door through the window but can't hit it" · "weird to teach shooting doors before kicking them"). No switch: the level's files,
    one Director verb, one Director read, one method of the fog's. THE WORKSHOP: its door on the street is gone; the door it has instead faces the guard hut across the lane between the
    two buildings and the script stands it open from the first tick (`c.doors.open` at an angle with the dealt swing's sign: a level's `angle` did not survive the staging, and a velocity
    the wrong way of a one-way leaf is clamped shut). Its man is the script's from the first tick on the mark at the far end of the room (an open doorway and the game's own man would
    have him at it on the first shot of the first room). Step 5 'Shots outside. Out to the street' comes up with the store taken and the player in it: its cue PUTS HIM IN THE
    PICTURE (`c.show`, below) and he lays three rounds every two seconds or so through the doorway onto the hut's block wall, a round at a time and none while
    `q.inside(shop_lane, 'team')`; its ring is on the street in front of the workshop, the room's own wall between the player and the man, and the step is passed there. While
    steps 5 to 7 are up the fog has a lookout behind the man looking down his line (the frame's step key `eye`): his room, the open doorway, the strip of lane and the hut's wall
    his rounds land on are seen, not a man drawn on the dark. (WHAT THE REAL PAGE SAID OF TWO EARLIER CUTS: with no such step and the cue on the side door's line, the workshop was
    OFF THE SCREEN from inside the store and the squad's key pointed at the far ring gave a move on the floor; with the ring at the mouth of the lane the man stood at the screen's
    top edge and the side door was off it. The camera here is the game's own: the frame keeps a ring on the screen only in mission 1's seat. From the street in front of the
    workshop both doors are on the screen.) Step 6 'He has that doorway. [B] on the side door' is passed by the order itself (`did order:stack on workshop_side`: the
    ring is the door, and the frame makes an order pointed at the ring an order on it), 7 'Go round with them' by the player in the alley, 8 '[B] on the door again: in behind him' by the room.
    The way round is the street and the gap at the workshop's corner: no part of it is in his line, and in the runs below all four and the player took it. He is the game's own when
    the side door opens (2 s late, as before), when anybody is in his room (the volume `shop_in`, the room's own floor) or when the player has stood 1.5 s in the narrow line
    (`shop_line`). `done:shop` is raised by his first round, not by a clock; a round he could not put in half a second is not put later (`c.stimulus.cease`). TRIED FIRST AND
    DROPPED: the street door standing open with his line on the truck by the store. Every way east crosses that line, the teammate who took the street shot him through the doorway
    as he went by (one run of one), and shutting the gap at the corner to send everybody round the back sent the player out of the alley on the nest's side of the wall, where he
    was shot. THE NEST: 'A gun. Shoot back: it ducks' carries no ring (a ring is where to go, and it stood on the nest); the gunner is shown through the fog while he is the
    script's. THE HALL: 'The door is locked. Go round to it' (passed within 1.7 m of the passage mark, square on to the leaf) and then 'Hold [Space] on the door: kick it in'; the
    scripted player kicks (one boot in every run so far). Shooting a door out is NOT taught here any more: his later ask is another place for it, men barricaded in a far room, with
    rounds through cover, once the doors goal has said what a leaf costs. `Director` (`director.ts`): `c.show(unit, on?)` → `fogofwar.ts show(gd, on)`, a set of men drawn as the
    squad's targets are (`drawn`, never `seen`: no AI learns anything); a man is shown only while a script holds him (the Director takes him out of the picture the frame his script
    ends, whoever ended it, and when the program stops), and the fog empties its set with its own reset. `c.stimulus.cease(unit)`: rounds of his a burst has not put yet are not
    put. `q.inside(volume, 'team')` = the player or any living teammate. NO SWITCH AND NO BREAK WORD: the row is new this week and its level, script and scripted player change
    together; the verbs do nothing until a script calls them (no other script does). The level file's fingerprint moved (a door, a table, three volumes): checkpoints and recordings
    of the row from before are refused. THE HALL'S TWO MEN are the script's from the first tick (beat `hall`: KNEELING on their marks until 10-23, when both stand: 'The hall's window is seen from one strip of ground' below, rifles on their doorway; standing, the one by the street window was shot through it from the alley, twelve metres off, in both of two slow
    readers' runs, before the player had come near) until their door gives or
    the player is in the room; one of them hit, the other turns his rifle to the window and stays on his mark, still the script's (let go, he went to the far corner out of the
    window's sight and the window's line had nobody to shoot: a slow reader's run, twice, the first man shot through the glass from far off): they were the game's own from the first shot of the first room, one stands a step from the
    street window, the walk round to the nest's open side passes that window a metre off, and an unprotected scripted player was shot through it on one die of eight and tied
    up in a duel there on another. FALL IN IS ITS OWN STEP ('follow': '[X], [3]: they follow', then 'wall': 'To the wall's end'), and it and 'back' carry the frame's `noTap`
    (the maintainer, having tapped the key at the old one line and sent the four to the ring: "we should block quick Q here when we want to teach something else"). SEVEN CARDS
    (the frame's `explain`; `CARDS` in the generator; his: "i think this needs more explanation for the systems. maybe even a modal that pauses the game and explains it"): the
    two ways in on 'go-hut' (his, paused on that line with a bang thrown: "we should say that hitting Q (vs F) on a stacked squad has them more aggressively take a room or something. or should
    it always be throwing a bang? what if they don't have any more bangs?"; the card says what the code does today, as the squad's own thread read it in `autopilot.ts autoEntries` and
    `doortools.ts fromStack`: the squad's key again lets them choose, a bang first when the room is held or unknown and one is to spare; the word's key is straight in and never a bang;
    the line is now '[B] on the door again: they choose how, and go in'; whether those rules stay is his open call, so expect a re-word. THE THREE 'AGAIN' LINES NAME THE DOOR, his, playing the store's step with his cursor in the guard hut and the squad panel reading 'move there · that wall': "was confused that it's really 'Q again on the door' not elsewhere". The key again anywhere else is a move order and takes the four off their stack; the frame has no step key that drops such a tap, asked of the frame's owner), the
    held doorway on 'side', the ring on 'follow', suppression on 'gun', grenades on 'frag', the window on 'window' (his own sentence), the flank on 'back'. A card is for a
    system, never a key. The row's opening card (`scenarioList.ts teaches`) says 'A doorway a man holds: go round'. MEASURED on the page's stand, the unprotected scripted player (`lesson-run --plain`): dice 1 to 8 all finish; reading each line for 6 s (`--pace 6`), dice 2, 3, 5 and 7 all finish; the gate passes (the frozen stand with `TPS_RAILS=1`, and four dice of the page's). Before the hall's men knelt,
    the same slow reader failed on two dice of two ('the hall was not cleared'), and with both kneeling the frozen stand's run failed the same way: measure both stands and a slow reader after any change there.
    The real page (`tools/qa/tut-squad-page.cjs`, software adapter): 32 checks pass, to the workshop taken by hand, with steps 9 and 21 put up by hand; it does not reach the hall. Never seen on a GPU: the page check's picture
    is the software adapter's; how a shown man reads in the fog's own light on a real card, and how his rounds across the lane look, nobody has seen. Nobody has played it.
  - **The post is lived in, and its gates are lit** (2026-10-22 evening; the generator's last block, all of it lived things: `?lived=0` on the page, `TPS_LIVED=1` on a frozen run,
    so the frozen stand's level is box for box the one it was; the maintainer, of every tutorial mission: "each tutorial level should have its own awesome level ... just as much
    (if not more! since it's first impression) polish and have it really feel great and organic"). EVERY ROOM IS FOR SOMETHING: the guard hut a felt, a stove and the radio on the
    guard's table; the store gas and oil; the workshop a bench with its tools, welding gas, crates, oil on the slab; the hall a low table on its rug, cushions under the window
    wall, a stove; the two west corners of the yard the water tank and a bed, the bread oven with its wood and the washing; the motor yard a bed and a motorbike. FOUR LAMPS ON
    THE YARD'S OWN SUPPLY (group `exterior`, each on an arm off its wall's top; the picket's lantern on the road is on the same group, so the photocell puts all five out at midday): one over the water in the yard's corner, one inside the back gate, one on the road's blast wall outside the road gate, and a work
    light on the south wall over the motor yard. LIGHT IS BALANCE, so each is where it shows the other side or nobody: the picket walks in under both gate lamps, the workshop's
    man cannot see the street the work light falls on, and the street between the two easy rooms, the wall's end, the blocks and the bags, where a line asks the player to stand,
    get none (the scripted player's log prints `lit` beside each event: 0.00 at every one but the workshop's side door, 0.60 under the back gate's lamp, where the squad is in
    first). TWO LAMPS TRIED AND MOVED: a lamp over the guard hut's door lit the player in the street (lit 0.65) and the store's men shot him through their opening door on one
    die of six; the kit's floodlight (a 70° half cone) on the south wall still reached him there (0.33, the same die lost): the work light is a 32° cone of its own. KEPT CLEAR: 1.1 m of every
    doorway and the wall a pair stacks on, every mark and its aim line, the lane the workshop's rounds cross and the floor between its doors, the hall window's line to both
    corners, the alley from the back gate to its mouth, the way round the wall's end; what lies on a route is a decal. NOT DONE, and waiting on a play of the re-staged
    mission: the lane beside the workshop is a metre wide and the street is short (widening either moves every staged fight). ITS OWN HOUR AND SKY (the row's `hour: 'night', weather: 'clear'`, the rule ROWSET: `?rowset=0` on the page,
    `TPS_ROWSET=1` on a frozen run): the post was lit for the night and every run above was at its own night, dry and still, so the row now opens there whatever hour the
    visitor last picked (by day the photocell puts the gate lamps out and the street the player stands in is in plain sun, which nobody measured). Clear is that night
    with a breath of wind; dust, which would make the lamps' beams stand in the air, also cuts far sight and is a call for whoever has seen it on a GPU. A checkpoint of
    the row from before it named a weather is refused ("made in other weather"). FOUND WHILE MEASURING IT, AND NOT THE FURNITURE'S: the nest's two men are now the script's from the first tick, down behind their bags (beat `gun` starts with the mission and waits for its cue), where they were the game's own until the gun's step: the way from the workshop's side door to the wall's end passes the wall's NORTH end a step away, a man who comes round that end is in the nest's sight, and a slow reader's scripted player, jostled by the four in the 1.4 m gap, was shot there before any line had said there was a gun. CHECKS: `lived-check tut-squad` (9 lines: marks, aim lines, doors,
    walks, heights), `level-lint`, `door-size`, `second-way-check`, `floor-order-check`, `lesson-check`. MEASURED, the page's stand with the lived things in, the unprotected scripted player: dice 1 to 8 all finish, `--pace 6` dice 2, 3, 5 and 7 all finish, the gate passes (its frozen run has none of this in it). AGAIN AFTER THE REVIEW'S MENDS (the lamps' arms, the nest's way out, the 23rd step, the after lines' `on`): the same twelve runs all finish, the gate passes, and the real page's check passes 34 of 34 (two new lines: the order given, the line reads "They stack up on the door" and then "They go in", with no key on it). `lived-check` now holds the level to its own commit (`BASE_REVS`), every level's 429 lines green. A LINE STOPS ASKING ONCE ITS ORDER IS GIVEN (the frame's step key `after`, on the five steps whose order takes the men some seconds: the two stacks say "They stack up on the door" / "... on the store" (`on: ['stack']`), the two easy rooms "They go in" ("They go straight in" for the word) and the workshop "They go in behind him" (`on` the three orders that send a stacked squad in, so the key pressed again before they are set, which is a second stack, keeps the ask); the other order steps pass the moment the order is given. 'Follow them in' is A STEP OF ITS OWN after the store's, 23 in all: an after line with no key in it is drawn as something to watch, with no ring, and that one is an ask with a place). THE NEST'S HOLD HAS A WAY OUT: before the gun's step, the player inside the nest's own bounds, or one of its two men shot, and both are the game's own again and fight (held with no way out they could be walked up to and shot without a move, found in review with a player sent there on step 2). SAVES AND TAPES: with the lived things on, the page's level has new boxes and lights, so its checkpoints and recordings from before this are refused; the frozen stand's level is the one it was. THE STREET IN FRONT OF THE WORKSHOP lies in the edge of the work light's cone and no logged event of the scripted player is there: on the real page (software adapter) the HUD's light reads 56 at that spot with the lamps and read 56 without them, the store's own light through its door. Never seen on a GPU; the stills taken of it are the software adapter's.
  - **The first play on the page, six notes** (2026-10-22, the maintainer on the page's own build, hard, his words in quotes; level data, its script and its scripted player: no switch,
    no rule of the game's). WHAT MY RUNS HAD MISSED, AND WHY: THE MOON. The post is played at night under a clear sky and its street is open to it: the page's meter reads about 55 of 100
    on anybody standing in it. Headless, `guards.ts lightEstimateAt` leaves every directional light out, for the player AND for every man an AI eye looks at, so every fight in the
    open had been measured in the dark (the scripted player's log said `lit 0.00` at the blocks, the window and the bags; his HUD said 55 to 59 there). The scripted player now puts the
    moon on every meter: `mode.moon` for the player's own (the runner's `--moon`) and, for everybody else, `tools/qa/hour-lib.ts installSkyMeter` (the game's light hooks answered as the
    page's meter would for direct light; `tools/qa/lessons/tut-squad.ts sky()`, `TUT_SQUAD_SKY=0` = as it was). It has no
    bounce and no bodies' shadows, and it did NOT by itself reproduce his notes 2, 5 and 6 below: those mends are from reading the code and are measured not to break the run, no more.
    - *"was confused that it's really 'Q again on the door' not elsewhere".* The three lines are 'Press [B] on the door again to send them in' (twice) and '… to go in behind him', and
      the card 'Two ways in' says "that door" (all four in the voice of `docs/agents/writing.md`). The key anywhere else is still a move order, the game's own rule; a step key that drops
      a tap of the squad's key off the step's mark is the frame's to add, and asked of its owner.
    - *"my guys got him before i could throw a frag".* Answered, the gun came up every five seconds for a burst; with the four at the blocks beside him that is a man standing up in front of
      four rifles while a card is read. FROM THE FRAG'S STEP COMING UP (its cue `atblocks`) THE GUN STAYS DOWN behind its bags, where nobody at the blocks can hit it. The scripted player
      holds it to account: 'frag' is off its `fightOk`, and the throw fails the run if a round that was not the player's has dropped either man of the nest (`TUT_SQUAD_FRAG_WAIT=<s>` =
      seconds stood at the blocks first).
    - *"we can showcase glass fracturing here".* The hall's street window is a pane (`glass: 'whole'` on the hut's window; its foot is a metre up, so it is FLOAT glass by where it
      stands: a round holes it and a few run it to daggers, which is what 'Shoot through the window' asks for). `glassreal-check.ts CENSUS` has the level's row (0/1/0). The frozen stand
      stands the glass's parts at off (a pane is a wall to a round), so the scripted player `raises` `GLASSPARTS=on` for its frozen run (not `GLASSFX`: `game/glass.ts` reads that
      word as the module loads, before a runner can raise it). A box more: the level's fingerprint moved, so a checkpoint or a tape of the row from before is refused.
    - *"what's a picket".* No line, card, squad name or blurb of the mission says it: 'Finish off the rest of them', the squad 'Roadblock', the row's blurb "more enemies coming in
      through two gates". (The pair mission's blurb in `scenarioList.ts` still says "a picket": its owner's.)
    - *"guards aren't coming by, just waiting around" and "bad guys are stuck here near the level start".* The last three were sent on walks planned at the covered-lane rule's price
      (`lanes.ts lanePenalty`: once one of theirs is shot at, their side knows which floor the squad's rifles cover, and a walk planned after that goes round it). Round, on this level,
      is the west gate at the far end of the yard, so two men ordered to the street behind the bags were met by the guard hut, and the beat's last wait (`yield one()`) left them there.
      EVERY LEG OF THEIRS IS NOW `direct` (the Director's short way), and the beat's tail is a loop: while two are up they are brought out into the open by the short way, kept there
      `OPEN_SECS`, let go, and brought out again twelve seconds on; one left drops it and runs, as before. Not the lived-in things (nothing of theirs is on that way).
    - *Found with the moon on, his note or not: the store's door.* Its two heard the guard hut go and stood with their rifles on their own door; when the squad opened it the first man the
      doorway showed them was the player, in the moon's light in the street where the line had him give the order. The unprotected scripted player went down there on three dice of three.
      THE STORE'S TWO ARE THE SCRIPT'S (beat `store`, from the first tick) until `STORE_SECS` (2.5) after their door gives, one of them is hit or the player is in the room.
    - *The ground round the nest* (asked with these: the biggest bare sheet of dirt on the level, by a new ground reading not yet in the build): seven decals and a scatter of field
      stones in the group `lived.nest` (sand run out of the bags, oil under the can, the wet where the pot is emptied, gravel under the hall wall's drip line, a drift by the gate wall,
      the trodden way round the bags' end).
    - MEASURED (2026-10-22, the moon on every meter, the unprotected scripted player `--plain` on the page's stand unless said). Before the ground and the last wording: dice 1 to 8
      finish, and `--hard` with 30 s stood at the blocks (`TUT_SQUAD_FRAG_WAIT=30`) dice 1 to 3. On the level as it went in: dice 2 to 5, `--pace 6` dice 2, 3 and 5, `--hard`
      with the 30 s dice 1 and 3, `--hard --pace 6` die 1. On the join with the build's head: die 6, `--hard --pace 6` with the 30 s die 4, and `lesson-gate tut-squad` (the
      frozen run with `TPS_RAILS=1` and the glass's parts raised, 117.3 s; the page's four dice, two slow). WITHOUT THE STORE'S HOLD the same player, with the moon on his own meter
      alone, went down at the store's door on three dice of three. The real page (`tools/qa/tut-squad-page.cjs`, software adapter): 33 checks pass, to the workshop taken. Statics:
      export `--check`, `level-lint`, `door-size`, `second-way-check`, `floor-order-check`, `level-names-check`, `lesson-check`, `probes.ts glassreal` and `rowset-check` on both
      stands, `level-needs` (its ground reading: no bare sheet of 40 m2 is left, the largest 35 m2 by the guard hut), `lived-check` over every level against the new base (the join:
      `BASE_REVS`). Not run: `map-check`'s 48 runs, `missions-gate`, the tour and the soak.
    - NOT DONE / NOBODY HAS SEEN: none of it on a GPU (the pane's fracture, the decals, the gun staying down, the two held in the store); notes 2, 5 and 6 were never reproduced headless,
      so whether his page now plays as written is his next play to say; the page run reaches the workshop only.
  - **The hall's window is seen from one strip of ground** (2026-10-23; level data, its script and its scripted player: no switch, no rule of the game's. The level file's
    fingerprint moved: a window, a wall of bags, a can: checkpoints and recordings of the row from before are refused). WHY: `showwhy.ts` (in the build that week) has a teammate
    whose round the fire gate holds for the player wave him aside and say "you're in my line.". Read off `showWhyLog` at the end of 16 unprotected runs on the page's stand
    (`lesson-run --plain`: dice 1 to 6, dice 3 to 5 reading each line for 6 s, hard 1 to 3, hard 1 to 3 with 30 s at the blocks, hard 1 at 6 s), it showed on 9: on 8 as the step
    'window' came up, from a teammate up the street with his rifle on the hall's corner man THROUGH the window, the player on his way to the glass as the line asks; on 1 on 'nest'
    (hard, the frag's survivor on his feet and the player walking in on him). The frame's owner would not hush a true line on a taught spot: the staging is mended. The same log
    said what the lesson had been: the squad shot both men through that window from the street before the player had fired (his magazine was full at their deaths). WHAT CHANGED:
    (1) the WINDOW (`WIN` in the generator: the hole and the step's ring read it) is 0.75 m wide at x 31.4, on the line both corner men stand on, a metre nearer the door end's
    corner; (2) the nest's BACK WALL of bags, between the gun and the hall, is nine courses (over a man's head) and 3.05 m long, where it was six and 1.8: by `game.col`, the ground
    from which a standing eye has a line to either man is 2.2 m2, all of it the strip between those bags and the hall's wall in front of the glass; it was 54 m2 (the street from
    the blocks to the bags, the whole nest, the alley by the back gate). Eight courses were looked through: a wall of bags longer than 1.6 m has a seam in its top course. The can
    and its oil moved inside the nest; (3) BOTH HALL MEN STAND (the one by the window knelt against the shot from the alley, which no longer exists; on a knee under a sill a
    metre high he showed the glass a head and no more, and the scripted player at the old mark, his gun held low by the wall, never fired at him); (4) the scripted player stands
    0.8 m off the glass (nearer, `gunwall` holds his rifle down), puts the cursor on a man's chest BONE (a man the frag has left hurt and on a knee has his head under a standing
    man's chest), takes the nest from a list of spots that ends in its open side, says whose rounds took the hall's two, and FAILS when a teammate took one from north of the back
    wall (`TUT_SQUAD_HALL=any` lifts it). MEASURED, the same 16 runs on this tree: all finish; nothing shown at the window or on 'nest' on any; both hall men are the player's on
    14; on die 2 (plain and hard: the frag leaves the gunner hurt and on a knee, the player walks the strip to the nest's open side) the teammate behind him stops in front of
    the glass and takes them, and on the plain one the last man gives up and opens his own locked door, so 'window', 'door' and 'lock' go by with the fight. STILL SHOWN, AND NOT
    MENDED: on 3 of the 4 slow readers' runs "you're in my line." comes once on 'gun', as the player steps out past the wall's end to shoot back with a teammate on the corner
    behind him (it was on none of the 4 before: the runs part company long before the nest, so this is the dice, not the window). It is true there too; tucking the mark at the
    wall's end farther behind the wall would take the corner man's eyes off the gun, and nobody has asked. FOUND ON THE WAY: the frag's survivor, hurt, stays on a knee under the
    bags and no rifle outside them finds him (71 s on one die before the scripted player learnt the open side); the level's script still holds him 40 s as a man on his feet.
    ON THE JOIN with the build of that morning the same 16 finish and read the same. ONE STILL of the real page each way (software adapter, the lowest preset, the player
    stood at the scripted spot with the step up): the window is drawn, the man by it stands with the cursor on him, the far man shows; and in BOTH the player himself cannot be
    made out, in the black between the bags and the hall's wall (his light meter reads 0 there): the taller bags did not make that, and nobody has said whether it is wanted.
    NOT RUN: map-check's 48 runs, tour, soak. NOBODY HAS SEEN the line or the wave on a page, the shot through the glass from 0.8 m, or any of it moving. Never on a GPU.
  - **The harsh places, re-staged** (2026-10-22: the script, one Director verb, two Director reads, and one line in the defenders' squads; no hit point, no number of the fight's, one hit
    still downs the player). A player who does what a line says is not put down for it; a wrong move still costs the checkpoint. THE DEVICE, three times: a man the script holds does
    not fight, so he is kept in its hand until the player has done what the line asks, and brought where the squad's rifles or the player's have him first.
    - *The nest ('gun', 'blocks', 'frag', 'nest').* The gun is the SCRIPT's until the frag has been thrown. Every burst is laid on the wall's face in the lane (a real round on a line,
      never aimed at him): one every 1.3 s while nobody answers; shot back at (the step passing raises `ducks`) the gunner goes down behind his bags, and from then he comes up every
      `DOWN_SECS` (5 s) for one burst down the same lane and goes down again, so there is a gap to run in and the middle of the street stays a place to be shot in. Both men are let
      go `FRAG_SECS` (3.5 s) after the frag leaves the hand (`fragged`). A man the frag leaves ALONE (a man's legs take him off a grenade he knows of whoever holds him, and on the
      fast dice the gunner lives through it) gets up DAZED, rifle down, still the script's for `SHOCK_SECS` (40 s): he cannot be hit from the blocks, he is taken from the nest's
      open side. Before: the gunner was the game's own from his first burst and shot the man who stepped past the wall's end to answer him; a first mend let the nest go a second
      after the player reached the blocks and it shot a slow reader there on one die of two.
    - *The last fight ('front', 'back', 'hold').* The two who go round WAIT outside the wall, unseen, until the cover order the line asks for is given (`covered`; `COVER_SECS` 40 s at
      the longest), then stay the script's down the alley and OUT into the street (marks `picket.out0/1`, in plain sight of the bags): the squad's cover men have them first, for
      `STREET_SECS` (4 s) before they are the game's own. Men still up twelve seconds later are walked out again, kept `OPEN_SECS` (6 s) and let go in the open. THE LAST MAN OF THE
      PICKET DROPS HIS RIFLE AND RUNS (`lastMan` in the script: `c.rout(unit)` starts `runner.ts`'s own sequence on him the moment two of the three are down, whoever's hands he is
      in); a man who has dropped it is nobody left to take (roomclear counts him out), so the mission ends without anyone walking up on a rifle. Where that rule will not take him
      (the frozen stand, `?norunner`, a man in the player's arm) the beat goes on as it was written before the rule: the last man is staged and let go like any other.
      THE NEST'S LAST MAN IS NOT ROUTED: tried, he ran to his mates in the hall and opened its locked door on the way, and the door's lesson went by.
    - *The Director's additions* (`director.ts`, a claim in the showcases' file; none has a switch of its own): `c.rout(u)` asks `runnerBreak` while the man is still in the beat's hand
      and only then lets him go: true = that rule has him (also when it had him already); false = nothing done to him (its switch or morale's off, a man in Sam's arm, the response
      team's, a show on the floor, or a man the program SPAWNED, whose way out of the level would leave the program's record of him behind). `q.routed(u)`: runner.ts has him.
      `q.signalled(name)`: the run has been sent that signal.
    - *Things that broke the staging and are mended*: the back gate's leaf swung into a held man took him out of the script's hand (doorthrow.ts ends a script on a man a door is
      opened into: the gate now stands open before they are near it, and their first marks are clear of the leaf); the follower could not pass the leader in a lane a metre wide and
      went back round by the road gate (the man nearer the corner leads and takes the farther mark); and THE DEFENDERS' RADIO CHECK SENT A HELD MAN TO LOOK when the front man went
      quiet (`enemysquads.ts home()`: a man with a script on a floor where `Director.lessonRuns` is not at home, the same test roomfight.ts and lanes.ts make; only a tutorial's
      script reaches it).
    - *What the gate holds of it*: the scripted player fails the run if either of the two who went round is inside the back gate before the cover order is given. Nothing asserts the
      duck, the pop-up bursts, the dazed man or the rout: they are read from the runs' logs. No break word.
  - **How forgiving** (2026-10-22, the page's stand, the scripted player with NO protection): `--plain --seed 1..12` finishes TWELVE of twelve, and `--plain --pace 6 --seed 1..4` (six
    seconds reading each line) FOUR of four. Before the re-staging: five of eight fast (down once at 'gun', twice in the last step), and a slow reader was never measured unprotected.
    On all sixteen the last fight ends with two of the picket shot (the second at the alley's mouth) and the third run off, the player still at the bags. On the twelve fast dice
    the frag kills one of the nest and the dazed gunner is shot from the open side about thirteen seconds later; on the four slow ones the frag kills both. ON ONE FAST DIE the
    hall's last man, his mate shot through the window, dropped his rifle and ran by the game's own rule and opened his own locked door: 'Locked. Shoot the door down' went by with
    nobody shooting it (the scripted player lets that step go by with a fight for this reason: `fightOk` has 'lock', a bar loosened by one step). The scripted player stands where
    the lines send him and does nothing clever; nobody has played it. On the frozen stand (no runner rule) the gate's protected run passes and two unprotected runs of die 1 finished (one fast,
    one slow reader), the picket's three all shot; its forgiveness there is not measured further.
  - **Not done / not seen**: its menu picture is a stand-in (the first tutorial mission's own stand-in, copied: none can be made without a GPU); the alley and the road are bare (`lived`
    NOTE); the one locked door is meant to be shot down or kicked, the two door charges are spare; the hour and weather it wants (a low late sun with dust) are URL keys only, a row cannot
    carry them. Never seen on a GPU, never played by a hand. Nobody has seen the gunner go down behind his bags when he is shot at and come up again, a dazed man on his feet in the nest, or the last man throw his rifle down and run: all are read from the runs' logs. A call for the maintainer: whether the hall's last man may run and open the locked door (the door's lesson skipped), and whether a dazed man standing up to forty seconds reads right.
- **The tutorial's plan mode mission, 'On the radio'** (2026-10-22; row `tut-plan`, `scenarioList.ts TUTORIAL_MISSIONS` after `tut-sky`, group `tutorial`; `tools/levels/tut-plan.ts` →
  `levels/tut-plan.json`, its staged moments `levels/tut-plan.script.ts`, its scripted player `tools/qa/lessons/tut-plan.ts`, its page run `tools/qa/tut-plan-page.cjs`, its own check
  `tools/qa/tutplan-check.ts`, probe `tutplan`). A PROTOTYPE of the second of the six: plan mode as the build has it, taught as the way to win three things one stack cannot. Its own
  level, a walled relay post at night (yard x 5..35, z 5..23): he kneels behind blocks at the track gate and never leaves them (until 10-23: he now walks to three spots between the plans, the sub-bullet "He walks to
  three spots" below), the four are his hands, eight defenders in four rooms each its
  own squad (`mayLeave: false`, nobody digs in). Nineteen steps (22 with the three walks), three plans:
  - *The guardroom* (two doors on two walls, two men): the mode up (Shift + the command key), the view moved with the walk keys, a right click sends all four to its blank wall, a box
    picks two and a right click stacks them on a door, the other two on the other door, a click on bare ground is everyone again, ONE word sends both.
  - *The hall* (a gun behind chest-high bags at the far end, laid on the front door; the back door at the gunner's shoulder): a pair on each door and the word. The step that makes
    everyone his again carries the cue `breach` (a stack stands on EACH door), but the gun goes by what the DOORS do: the back door opened first, or within `BACK_SECS` (1.5 s) of a
    front door that moved after the cue, is the plan — a burst into the wall beside the front doorway, the gun held on it `LATE_SECS` (2.4 s), and the pair at his shoulder has him. A
    front door the back one does not follow, cue or not, is "one stack, alone": up to `ALONE_BURSTS` (5) six-round bursts laid on the doorway itself while the back door stays shut, and
    the man beside the gun up with his rifle on it. A teammate it would put down is on a knee for five seconds (`rails.respawn`), so the wrong plan costs MEN ON A KNEE, never the
    mission — and not time: by the clock it is the quicker of the two (the numbers are below), which is the maintainer's to weigh.
  - *The two gates* (two men up the road, two in the lane behind the back gate, each pair behind a blast wall, the script's and unseen until the cue `gates`): a right click DRAGGED puts
    a pair behind chest-high bags facing the road gate and a pair behind the barrier facing the back gate; then both gates open at once, each pair of theirs walks in with rifles up and stands
    `GATE_SECS` (4 s) in its gate before it is the game's own, and the last man of the four drops it and runs. A last right click on himself brings the squad back.
  - **The frame's `plan` action** (`game/rails.ts gate`): on a level whose steps allow `plan`, Shift held over the command key reaches the game though neither sprint nor an order is
    allowed (the command key alone stays locked: a tap of it would undo a plan), and with the mode up its own Shift, the walk keys (they move the view, his feet stay locked) and both
    mouse buttons. Only where the page HAS the mode: the gate reads `CMDRING.plan` (and `planRts` for the walk keys), so with `?qplan=0` or on the frozen stand the key with Shift is the
    key's own order and stays locked — THE MISSION CANNOT BE PLAYED WITH PLAN MODE SWITCHED OFF, and no line says so on the page. A walk key held down is a sprint's only where his feet
    are his: on a step with no `move` it does not stand between Shift and the key. No other level allows `plan`, so nothing else changed. A step done IN the mode carries `planLine`
    (a new step key: `scene/scenarios.ts`, `levelData.ts`, `rails.ts prompt`), the line while the mode is DOWN — a checkpoint put back puts the mode down, and so can a hand: 'Hold
    [Shift], tap [B]: plan mode again'. New lesson tests (`lesson.ts LESSON_TESTS`): `planView {at, r}` (the mode up and its view's point within r of a place), `picked {n, free}` (the
    men an order would go to), `stacks {doors, set, n}` (men on a 'stack up' on each named door; `set`: standing on their marks AND their plan chain waiting for the word). The gate
    repeats, in its own words, which of the mode's keys are whose; asking plan mode itself what it would read this tick is the sounder shape and is its owner's.
  - **A line that stops asking** (the frame's `after`, from the first mission's rework): each step that gives an order carries the line for while the men do it ('All four are on their way',
    'They stack. Nobody goes in until your word'; seen in a scripted run on six steps, drawn as lines to watch — a step that is done the moment its order is given never shows its own), and the two word steps carry only `after.word` ('Both doors, together'; 'The gun is on the front door. They come in
    behind it'). `planLine` comes before it: with the mode down the line is what puts the mode up.
  - **The word's lock holds INSIDE the mode** (`planmode.ts wordLocked`, `stackedLocked`; nothing changes where no frame runs or `word` is allowed): until a step allows `word`, men
    stacked on a door wait there whether or not a wait was put on its threshold; a second right click on that door is no entry (before this it was `bangClear`, found by the check's
    line 8); a left click on a stop does not cycle its waits; and the right button held gives no ring while `ring` and `menu` are locked.
  - **Two things the real page found** (both would have read as a broken key). The word's key sends the stacks of the men who are PICKED (`planmode.ts chainsOf`): after the second box
    the picked men are one pair, and 'one word, both doors' sent one door — hence the steps 'all' and 'all2' (a left click on bare ground) before each word, and the scripted player
    and the page run both fail unless ONE press empties every waiting chain. And a press while a chain is still walking to its door is eaten (`CMDRING.planWaits`): the men "arrive" about
    1.7 s before their chain waits, so `stacks.set` now asks for the wait too and the line never asks for a key that does nothing.
  - **Script facts**: a man handed back crouched behind the bags saw nobody and was seen by nobody (one die of four: the room never fell) — the low man is stood up, rifle on the
    doorway, a moment before he is let go; a beat asks `q.signalled('lesson:breach')` to know whether the plan was laid when a door moved; a scripted burst is real rounds (laid on a wall's
    inside face a metre from the doorway while the plan is working); `D.systems.theirFrags(false)` and `qrf(false)` for the level; the three yard gates are locked until the gates' beat.
  - **Checkpoints** 'the gate' (step 1), 'the hall' (step 10), 'the gates' (step 15), each before the cue of the fight that follows; both beats start with the program and find their men
    by callsign, so a checkpoint put back stages what is left.
  - **Level facts**: built on the look's kit (one file, no look twin), no glass, one pickup (`carlamps-check` row), no response block; the outside camps' groups are `checkpoint.east` /
    `checkpoint.back` (`road` is a structure word to the lived count); a NEW level, so no save or tape is refused. Furnished for what the post is: the relay's dish and generator behind the
    hall, a cooking corner, washing, a bed carried out, the runner's motorbike. The ROW names its own hour and sky, `hour: 'midday', weather: 'clear'` (the `ROWSET` rule: `?rowset=0` opens it at the level's own night, as do the frozen stand's runs): a plan is laid by day, every yard and door in plain sight from above — the level's lamps and moon are still authored for the night it was built as, and which daylight (midday, a low dawn) is the maintainer's to pick by eye. The menu picture is `tools/menu-art.ts`'s, which draws no gun laser for a level whose frame says `rails.lasers: false`. That tool knows no hour: the picture is still the level's night.
  - **Checks, and what was measured** (2026-10-22, on the build head of that evening merged in; no new switch: the mission rides the frame's `RAILS.on`, `?rails=0`, and plan
    mode's `CMDRING.plan`, `?qplan=0`; frozen words for a headless run: `TPS_RAILS=1 TPS_QRING=1 TPS_QPLAN=1 TPS_PLANLOOK=1 TPS_PLANWAITS=1 TPS_PLANKNEE=1`, which `lesson-gate` gives a
    level whose steps allow `plan`). `bun run tools/qa/tutplan-check.ts` (probe `tutplan`, family `missions`): 8 lines, ALL PASS on both stands; `TUTPLAN_BREAK=1` (no step allows
    `plan`) fails 5 on both (the mode's own action, its hands, the hall, a walk key held, the word's lock) — the hall line's break is its own (the cue is not sent) and line 5 is excused
    the mode's state under the break. The scripted player (`lesson-run tut-plan`, always the shipped stand): 19/19 steps on seeds 1 to 8, 108.9 to 110.1 s; reading every line for six
    seconds 216.9 s (seeds 3, 5); it fails unless ONE press of the word empties every waiting chain, and it loads the checkpoint 'the gates' in the middle of every run and asks that
    all of it came back. THE WRONG PLAN (`TUTPLAN_ALONE=1`: all four on the hall's front door) on seeds 1 to 4: the run still ends, in 93.4 to 108.8 s, with 2, 0, 5 and 3 teammates
    put on a knee at the hall against 0 on every run of the plan — fewer seeds than would make that a rate, and one of the four cost nobody. `lesson-gate tut-plan` ALL PASS (6:
    file, lint, lesson-check, the frozen run, four dice as the page ships, two of them at a reader's pace). `level-needs tut-plan --run` no FAIL on both stands. `rails-check` ALL PASS on both
    stands (21 lines; `RAILS_BREAK=1` fails 14). The `planmode`
    probe (plan mode's own file changed): frozen ALL PASS (30); on the shipped stand one line is red ("W held five seconds: the view stops at its reach", 24.93 m against 25) and is
    red the same way on the build head without this change. `planplus` ALL PASS on both stands (18). `dice-check`, `rollback-check --static`, `knobs-check`, `lesson-check`,
    `carlamps-check` and both typechecks pass.
    ON THE PAGE (`PORT=… node tools/qa/tut-plan-page.cjs`, headless Chromium, the software adapter, real keyboard and mouse events): every step of the mission to its end card (38 lines), with one
    press of the word sending both stacks, the `planLine` up with the mode down, each mark inside the picture when its line is up, and no page or console error. A page that has DRAWN a
    frame plays on live GPU senses, and a scripted page that then steps without drawing to completion plays on stale ones (men a metre apart who do not fire): the script's fights draw
    every frame to the end once a picture was taken, and a run for the verdict takes none (`SHOTS=0`).
    NOT EXERCISED BY ANY RUN: the gates' beat past its first release (the walk on into the yard after `ON_SECS`, the last man's rout) — in every run the men faced to the gates had all
    four first; the hall with the back door opened FIRST; a checkpoint other than 'the gates' put back mid-run; the mission with `?qplan=0`.
  - **At midday** (the row's own hour, measured 2026-10-22 on the page's stand, where `ROWSET` is on; the frozen stand's runs are the level's night as before): the scripted player
    19/19 on seeds 1 to 8 (108.7 to 109.7 s), six seconds a line on seed 3 (216.8 s); the wrong plan on seeds 1 to 4 ends in 93 to 104 s with 5, 3, 0 and 3 teammates on a knee;
    `tutplan-check`, `rails-check`, `rowset-check` (`ROWSET_BREAK=1` fails 7), `lesson-gate` and `level-needs --run` green on both stands; the real page with real keys to its end
    card, 38 lines, its fights drawn frame by frame (software adapter). In those pictures the hall reads dark inside: its light is a ceiling tube, an emissive box the lowest
    quality barely gathers — how the hall reads by day on a GPU is not known.
  - **Two stacks on one word, and the two posts, from a player's tape** (2026-10-22: two replays of the mission on hard, the maintainer's notes "simultaneous breach on mission 2
    didn't really work. and the second team threw a flashbang when our guys were already on the inside" and "blue one doesn't watch his angle even though red team has it covered").
    WHAT THE TAPE SHOWED. At the guardroom one press of the word gave each pair its OWN `bangClear` (planmode.ts `word` → `enter` → `quickFor`, a chain at a time: no `DoorGate`
    between them). Blue was through the side door at 2.6 s and the room was clear at 3.7 s; red first re-formed for the throw (its second man walked 3.5 m across the doorway from
    his stack mark to a place further along the wall), its can went off at 4.3 s on both blue men standing in the room, and red came in at 5 s. At the hall both pairs were given
    `openClear` (no can left over `AUTOPILOT.keepBangs`) and went in 0.1 s apart. At the gates a man told to face the back gate swung 85° to the road gate three times for men the
    other pair's two rifles had, and his partner never took the way to face at all: the move had put him in the corner south of the guardroom (`roomfit.ts`: a few steps round the
    click, a wall at his back), `cover` had no line for him there and he stood looking at a wall. The scripted player did the first two on every seed and said nothing: its check
    asked only that one press empties every waiting chain.
    NOT THE LEVEL'S, claimed to their owners and NOT changed here: one word is one signal for every stack it frees; no can goes into a room friends hold; a man covering a way keeps
    it while another pair has the contact. The first was TRIED and taken out again (the entries the word frees share a gate, `doorTools.together()`): first men in 0.1 s apart and
    nobody dazzled on seeds 1 to 3, hard.
    THE LEVEL'S, changed (boxes moved: the fingerprint is new, so a checkpoint or a tape of the level from before is refused): post B and its barrier stand at (24.0, 10.3) and
    (24.0, 9.3), were (23.25, 10.75) and (23.25, 9.6); two drums fill the corner south of the guardroom (20.7, 11.65); a post's area in the two facing steps is 2.6 m, was 1.8. A
    hand does not land on the mark (his fell 1.25 m west of it), so the post is where a click a metre and a half off still gets two men who see the gate. SWEPT with the scripted
    player (`TUTPLAN_POSTB=x,z` clicks the barrier's order there; hard, one seed a click): before the drums 10 of 13 clicks gave two men facing the gate — (22.2, 11.0) put one in
    that corner, (25.3, 11.3) and (25.9, 10.4) were taken by the picture of the hall's front door, which stands over the ground north of it (the right click became a stack on that
    door: STILL SO, a level rule for the next post: nothing to click within 2.5 m north of a door); with the drums (22.4, 11.6), (25.3, 10.3), (22.2, 11.0), (24.0, 11.6),
    (22.6, 9.6) and (25.2, 9.7) all give two. The drums also took the re-form away (the place along the wall is gone and the stack throws from its marks): first men in at 2.8 and
    3.4 s, 0.6 s apart — and the second can still dazzles the first pair, two teammates on every run, until the squad's rule is in the build.
    WHAT THE SCRIPTED PLAYER NOW SAYS AND ASKS (`tools/qa/lessons/tut-plan.ts`): after each word, when the first man of each stack was inside the room, how far apart, and the
    teammates the team's own can dazzled ("the word at guardroom: …"); after each facing order, where each man of the pair stands and whether he took it ("the barrier: …") — on the
    mark a man who did not FAILS the run. Stacks more than a second apart, or any teammate dazzled, were first asked only under a word of the run's (red on every seed until the
    squad's rule was in the build, green with the tried gate on seeds 1 to 3); the bar is the run's own now: the bullet after the next.
    MEASURED (the page's stand, midday): 19/19 on seeds 1 to 8 (114.3 to 115.1 s) and on hard, seeds 1 to 4; six seconds a line on seeds 3 and 5 (221.3, 222.2 s); the wrong plan on
    seeds 1 to 4 ends in 102.6 to 118.5 s with 4, 3, 6 and 3 teammates on a knee at the hall. On the join with the build head: `tutplan-check`, `level-needs --run` and
    `rails-check` green on both stands, `lesson-gate`, `rowset-check` and `lived-check` green, and the real page with real keys to its end card (38 lines, the software adapter,
    no picture taken). Nobody has played the changed post; nothing of it has been seen on a GPU.
  - **The hall's word step went without its lookout for a few builds** (PUT BACK since: the next bullet. 2026-10-22, found by the merge run's reading of the scripted player's own line, "hall nobody in"). The hall's steps put a
    lookout eye inside the room so the player sees the gun. Until `RAILS.eyeFirst` a step's eye was the one the fog had no place for with four men up, so nobody saw through it; with
    it the fog shows the gunner, and the squad's entry pick reads the fog (`autopilot.ts contactBehind`): at the word the stack asked first took the last can — a bang and clear with
    its three seconds of re-forming beside an open and clear — the back pair went in alone at 0.2 s and the front stack was still outside when the room fell. A LOOKOUT IS THE
    PLAYER'S VIEW, NOT THE SQUAD'S KNOWLEDGE: that is claimed to the frame's and the entry pick's owners, and any tutorial level with a step eye in a room the squad then enters is
    open to it. Here the eye is off the word's own step (`word2`; it stays on the card and the stacking steps): both stacks open and clear again, first men in at 1.1 and 1.2 s
    (seeds 1 to 4, hard on one, a reader's pace on one), and he sees the gun through his men as the doors give. The lesson block alone changed: the level's fingerprint is the same.
    THE SCRIPTED PLAYER: a stack that never goes in has no time, so nothing is said of how far apart they were ("not together: a stack never went in") and the PLAIN run fails on
    it, no strict word asked; on a join, read the "word at" line of EVERY room.
  - **Its words, its yard's ground, the lookout back, and the bar on two doors** (2026-10-23). No new switch: text, level data and the scripted player.
    THE TEXT: every line, card, after line and the menu row (`blurb`, `scene`, `teaches`, `place`) is written to `docs/agents/writing.md`, and a second reader who did not
    write it read every string aloud against the guide, as its Review asks; the notes taken: the first card says "each teammate" (pairs are met a card later); the pick card
    is "Hit two doors at once" and says what the set-up is for; the hall's card ends on what to do about the gunner; the gates' card speaks of enemies who WILL come; and
    step `all` has a NEW card, "Pick everyone again" (the go sends only the teammates who are picked — the one thing here a player would carry wrong into a real mission).
    That card names no key: the word is locked until the next step, and a card that said "press [F]" on a step where [F] is dead was a review's find. KNOWN: `faceA` is 14
    words and `faceB` 14 (the guide: about twelve), each two deeds in one line (pick two, drag an order); cutting each into two steps wants a lesson test that does not
    exist (two picked and neither on an order: `picked`'s `free` asks about stacks only), the frame's to add. A click is written "right-click" and the squad's word is "say go", as the guide's owner has the rest of the game
    (three wording notes of its read, taken the same night; `faceB` got its comma back from that read).
    THE LOOKOUT is back on `word2` (`HALL_EYE`, one const for the hall's five steps): a frame's eye is the picture's alone since `RAILS.eyeView`, so the squad picks its
    entry by what its own men saw. IT LEANS ON THAT RULE: with `?eyeview=0` the gunner is seen through the eye, the squad takes a can and the first men are in at 5.9 and
    6.1 s, not 1.2 (a review's run, two seeds); no check plays the mission with it off. With four men up the step's eye is the picture's fifth and last place.
    THE GROUND (the `ground` need of `level-needs`: was a NOTE, 159 m² and 53 m² of bare dirt; now PASS, the largest bare piece 13 m²): the track runs on through its gate
    to the worn middle; a walked way of gravel from the road gate (the post has since laid its bags across it) and another down from the back gate meet at the guardroom's
    corner and run into the middle; the dish and the generator stand on a poured pad; oil on the pad, the motorbike's stain in the dirt (the dark of damp: `oil`'s paint
    is no darker than `dirt`), water thrown out of the hall's back door and off the cooking corner, drips under the washing, a burn pit behind the hall, and five scatters
    of field stones along the yard wall's foot, clear of its face. 49 boxes more (434), all decals, thin finishes or stones under 0.19 m. THE LEVEL'S FINGERPRINT MOVED:
    checkpoints and recordings of this level from before are refused. `lived-check`'s own row for the level (`LEVEL_BASE`) is at the commit that carries it.
    THE BAR: two stacks on one word more than a second apart, or a teammate dazzled as they went in, FAIL the scripted run wherever both of the squad's rules are on
    (`CMDRING.planOne`, `DOORTOOLS.tossMate`: the page; a frozen run without `TPS_PLANONE=1 TPS_TOSSMATE=1` only says the line, as does `TUTPLAN_LOOSE=1` anywhere). A room
    that fell before the word fails too (a stack that did not wait: nothing could be measured). With `TPS_PLANONE=0` on the page's stand the line reads as his tape did:
    2.8 and 3.4 s, two teammates dazzled.
    MEASURED on the join with the build head (the page's stand, midday, the sky's light on every meter): 19/19 on seeds 1 to 8 (114.4 to 114.7 s) and on hard, seeds 1 to
    4, every one with the guardroom's first men in at 3.8 and 3.7 s and the hall's at 1.2 and 1.2 s, nobody dazzled; six seconds a line on seeds 3 and 5 (222.6, 222.5 s);
    the wrong plan on seeds 1 to 4 ends in 102.7 to 102.8 s. `tutplan-check`, `level-needs --run` and `rails-check` green on both stands (`TUTPLAN_BREAK=1` red, as it
    must be), `lesson-gate`, `lesson-check`, `rowset-check`, `lived-check`, `door-size`, `second-way-check`, `floor-order-check`, `wallfurn-check`, `level-names-check`,
    `level-lint`, `export --check`, both typechecks.
    THE REAL PAGE with real keys and a real mouse (`tools/qa/tut-plan-page.cjs`, the software adapter, no picture taken): 38 lines pass, to its end card, no page or
    console error.
    Nobody has played the reworded mission. Whether the ground reads is by eye and nobody has seen it on a GPU: the paints' values are held to STYLE.md's rule by
    arithmetic only, and the oil on the pad is 0.34 of its ground, a hair over the third the rule allows.
  - **He walks to three spots, and each plan is laid from its spot** (2026-10-23; the maintainer's pick on a card, "You walk to each spot, then plan"). WHY: plan
    mode's view now stays near him (`CMDRING.planNear`, the squad's rule: `?plannear=0`; `TPS_PLANNEAR=1` on a frozen run, needs `TPS_QPLAN=1`), a room's worth, and it
    holds only where a frame leaves him his feet. This mission held them, so it taught a 19 m reach the game no longer has. No switch of the mission's own: it is lesson
    data. THE STEPS (22): the first plan as before, from the gate with his feet held (mode, view, send: the rule does not hold on those three); then `up1` gives `move`
    (the step's `allow`, NOT the frame's: with his feet from the first tick he could walk into the guardroom before the mode was ever up, the four following him, and
    their walk after him did 'send' for him) and walks him behind his squad at the guardroom's blind wall (12.3, 11.1); `up2` beside the hall's blind wall (23.5, 15.3),
    between it and the charpoy; `up3` inside the hall once it is theirs, behind the gunner's own bags (31.0, 15.9). Each is a ring 0.9 m either way. The mode is put
    away to walk (in it the walk keys are the view's): the first walk's line names Tab and a card says the same keys walk him once the mode is closed; after a walk the
    line is the old "open plan mode again". The gates' view point moved to (27.5, 11.5), inside the view's reach from the hall; the last step lost its mark and its
    after line (with no mark any order but the right one put the line up). The menu row's blurb and scene no longer say he stays at the gate. Seven lines and two
    cards were read by a second reader against `docs/agents/writing.md` (nine notes, all taken). `lived-check`'s row for the level is at the commit that carries the lists.
    NO BOX MOVED: the fingerprint is the level's as it was, except its lesson block and its notes.
    THE CHECKS: `tutplan-check` line 9 (new; 9 lines, both stands): the frame gives no `move` and the first step that does is a walk step after the squad is sent; he is
    stood by `Game.teleportPlayer` on the gate's mark and on each walk's spot, the lesson on the step asked, and the walk keys take the view toward every mark, drag end
    and view point of the steps up to the next walk: 20 places from 4 spots, each on the picture (the tightest 337 px inside), each view test passed, the rule held on
    17 of 17 asked after the first walk and the view never more than 7.9 m from him (the box's far corner is 8.8 m). `TUTPLAN_BREAK=spots` (every plan tried from the
    gate) fails that line, `TUTPLAN_BREAK=1` fails lines 3, 4, 6, 7, 8 and 9. THE SCRIPTED PLAYER closes the mode with the back key and walks with the walk keys along
    the game's own path, reads the spots and view points from the level, fails a run where a place cannot be brought onto the picture from where he stands, where the
    view leaves its box with the rule on, or where he is down after a walk, before the checkpoint 'the gates' is put back, or at the end; on the gate's frozen arm it
    raises `TPS_TABBACK=1 TPS_PLANNEAR=1` (the lines name Tab; the frozen stand has no back key on Tab).
    MEASURED (the page's stand, midday, the sky's light on every meter): 22/22 on seeds 1 to 8 (139.0 to 139.7 s) and on hard, seeds 1 to 4; the guardroom's first men in
    at 3.8 and 3.7 s, the hall's at 1.2 and 1.2 s, nobody dazzled, on every one; the walks 4.7, 12.1 and 7.7 m in 3.3, 8.0 and 8.4 s; he was never put down; the view
    never more than 7.0 m from him, the same with `TPS_PLANNEAR=0` (seeds 1, 2: the mission plays alike with the rule off). Six seconds a line on seeds 3 and 5 (265.0,
    265.5 s). The wrong plan (`TUTPLAN_ALONE=1`) on seeds 1 to 4 ends in 122.4 to 128.2 s with him beside the hall while the gun is laid on its doorway, and he is not
    hit. `lesson-gate tut-plan` (6), `level-needs --run` and `rails-check` on both stands, `rowset-check`, `lived-check`, `lesson-check` (129), `writing-check`
    (`WRITING_BREAK=1` red), `picker-list`, `knobs-check`, `dice-check`, `rollback-check --static`, `export --check`, both typechecks green.
    THE REAL PAGE with real keys and a real mouse (`tools/qa/tut-plan-page.cjs`, the software adapter, no picture): 51 lines pass to the end card, no page or console
    error: Tab puts the mode away and he stands, the walk keys walk him to each spot, the line after a walk is the one that puts the mode up again, and with the mode
    closed each next ring is on the picture (the first and third) or its mark is pinned to the picture's edge with the metres to it (the second, 12 m off: the
    objective mark's own rule, `ui/overlay.ts`).
    KNOWN: (1) Shift with the command key did nothing while a walk key was held (`rails.ts` gate and `planShift`: out of a walk it is the sprint's side),
    and here sprint and the key's own order are both locked, so a hand that arrived in a ring still holding a walk key and pressed for the mode got nothing until it
    let go. MENDED the same day by the frame's own rule (`RAILS.planWalk`, `?planwalk=0&plandown=0` = as it was; its bullet "Plan mode opens on the move" below), and the page
    run asks it at step 'pick'. NOT MENDED: (2) The box shrinks as the camera comes in and turns with it; the hall's and the gates' view
    tests were tried turned and zoomed by a reviewer and held, but a player zoomed far in has to zoom out or walk nearer, and no line says so. (3) With `?tabback=0` the
    back key is Esc and the walk lines still say Tab (as the solo mission's does); Shift with the command key closes the mode too. (4) He can walk into a room nobody
    has taken and be shot there: he has no trigger, and nothing but the lines keeps him on his spots. (5) A ring is 0.9 m either way and its mark fades inside 1.6 m, as
    other lessons' rings do. (6) His three spots are safe on purpose (no trigger); the level skill now asks that a door not always have a safe spot to
    command it from, which a mission with a trigger should heed and this one does not. ON THE JOIN with the build head after it (the two gears, mission 1's
    changes to `rails.ts` and `planmode.ts`): seeds 1 to 4, hard and the wrong plan on seed 1, `tutplan-check` on both stands and both breaks, `lesson-gate`,
    `level-needs --run` and `rails-check` on both stands, `lived-check`, `writing-check`, `picker-list`, `rowset-check`, `lesson-check`, both typechecks, and the real
    page again (51 lines): the same numbers. Nobody has played it, and nothing of it has been seen on a GPU.
  - **A walk line stops naming Tab once the mode is down** (2026-10-23, after Tab's objectives card came in, `ui/tabkey.ts`): with nothing to back out
    of, Tab on a played page holds the game on that card, and the three walk lines said "Press [Tab] to close plan mode, then walk…" for as long as
    the step lasted. Each walk step now carries a `planLine` (the frame shows it while the mode is down): "Use [W] [A] [S] [D] to walk to the marked
    spot by your squad", "Walk to the marked spot beside the hall", "Walk into the hall to the marked spot". Lesson prose only: no switch, no list
    and no box changed, the level's lived row stands. `tutplan-check`'s walk-step test no longer reads `planLine`. The real page
    (`tools/qa/tut-plan-page.cjs`, 54 lines now; `URL_ADD='&tab=brief'` in front gives the page Tab's card as a played page has it, a driven page has
    none) asks at each walk that the press which closed the mode did not open the card and that the line then names neither Tab nor plan mode:
    green both ways on the software adapter. Not shown: the card opening on a second press there. Never seen on a GPU, nobody has played it.
  - **NOT taught, on purpose** (a first prototype): waits on the word added to and taken off a stop (no place where they earn their keep was found), Shift + right click to chain stops,
    the ring by the right button kept down. **Nobody has played it and nothing of it has been seen on a GPU**: the software adapter draws the level and the mode's marks; how the night
    reads, how the plan's lines look over it, and whether nineteen lines feel like a mission or a list are a person's to say.
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
- **A mission's own card for you is the whole kit** (`src/game/kit.ts ISSUE.whole`, 10-22; from the maintainer's play of the tutorial's solo mission:
  "i first accidentally sponged the guys"). `tut-solo` is a LOUD mission of the QUIET kind (a lone man, the quiet scenario's frame) whose
  `scenarios.issue` names his card, and `kitPlayer` asks only `stealthRun` (a quiet scenario up, or the night alone), so the mission's five sponge rounds
  were handed over that card and the launcher came up on them, ahead of the grenades its lines teach. THE RULE: where the level's block names YOUR card
  (place '0') and the staging runs under it (`issuing === 'own'`), nothing is handed over it: no sponge rounds for a quiet kind, no cameras or wand for a
  fog (`lent` in `kitPlayer`; `kitIssueWhole(members)` is the one test, asked by `ui/loadout.ts lentNow` too so the Team & kit figure draws no camera or
  wand the run will not have). With no sponge round the right button is on the first load he does carry (the grenade). NOT TOUCHED: a block that names
  no card for you (the long hall's two levels, `members: {}`: a night alone there is handed what it was), a mission with no block (the stealth card, or
  the hand-overs with that card off), a lesson's page with no block (the hand-overs over the plain issue), the teammates, the row's `lean` (still a word
  on the mission sheet only; a loud mission of the quiet kind WITHOUT a card of its own would still be dealt as a stealth run: none exists), and a
  checkpoint load's own wand hand-over (`savestate.ts`, `P.wand || quietWand(g)`: no level with a card for you is under a fog today). THE TREE: the
  sponge rounds are a row of the card as a tree; with it off the rifle's are what it is built with on every mission and the rule has none to take (the
  hold's word says so). A CARD MAY NAME SPONGE ROUNDS: `rings` on your own card (0‥5, a card with the rifle; the validator refuses it elsewhere), asked by the solo
  mission's owner for the maintainer's 10-22 "explain secondary attachments for the rifle ... swap between secondaries": with any on the card the
  launcher comes up on them and the grenades are its next load, so the swap has something to teach. Worn as written by `kitPlayer` (a man alone: no
  trim, like the card's other counts); through `kitStage` the pouches rule trims a card that does not fit, sponge rounds included, as it trims any card.
  With the rule off the mission's five land over the count as before. Cameras and the wand still cannot be named on a card (none asks). SWITCH: `ISSUE.whole`, a key of the registered, journaled table (a recording from before the key replays with it
  off), OFF in the module and on the frozen stand (`FROZEN_HOLDS` row, `TPS_ISSUEWHOLE=1`), ON in the page (`?issuelend` puts it off; debugger box "a
  mission's own card for you is the whole kit"). CHECK: `probes.ts issuewhole` (`tools/qa/issuewhole-check.ts`, family `kit`; `ISSUEWHOLE_BREAK=1` must
  fail) on BOTH stands: the solo tutorial stood up as its page stands it (off: 5 sponge rounds, the tube on them; on: none, the tube on the grenade,
  2/2/2/3 as its card), a rig's quiet run alone under a fog with a card (off 5 / 2 cameras / wand; on none), a card that names `rings` and the
  validator's lines for it, an empty block, the tree off, a mission
  with no block and a lesson's page with none (each the same on and off), the journal. MEASURED: one staging each, no seeds (nothing here is drawn).
  FOR THE SOLO MISSION'S OWNER: its step `load` ("[2] again: load the grenade") is already true when it comes up under this rule and goes by unread, and
  its scripted walk never wears the page's kit (`lesson-run.ts` stages no card on a man alone), so `tut-solo-check` plays the sponge rounds either way.
  NOBODY HAS played the mission with it, on a GPU or off; no page was opened for it.
- **A lesson the player packs for** (`src/game/kit.ts ISSUE.picked`, `kitPacks`, `kitLessonPage`, 2026-10-23; the maintainer, of the kit step's
  walkthrough: "we should attach it to a tutorial mission (and make it bespoke and explain how to plan)"). A tutorial row that carries `packs`
  (`scene/scenarios.ts ScenarioEntry`; today the squad mission, `tut-squad`, alone) is NOT played with the kit as issued: `game/loadout.ts kitAsIssued`
  is false of it, so its Team & kit step shows the cards (where `ui/kitPlan.ts` teaches planning its kit, `docs/agents/menus.md`) and its page stages
  what this machine keeps, as any mission's does. `packs.frags` is THE LEAST HE CARRIES THERE: the street's 'frag over the bags' step holds the two men
  behind the sandbags down until his frag lands, so a card packed with none would leave a line asking for what he cannot do — on that mission's page
  (`main.ts` names the lesson's row with `kitLessonPage(row)`, and the rule is read at each staging, so a recording's own knobs decide it;
  `tools/qa/rerun.ts` names the row again for a page's recording) `kitPlayer` writes his frags up to that floor, never down, and his card on the kit
  step shows the handed frag as the mission's. Every other lesson is as it was, and that page's difficulty levers stay off like every lesson's. WHAT MOVES ON
  THAT PAGE: with the kept cards as issued he carries the pouches rule's one of each (1 smoke, 1 stun, 1 frag) where the issued page left him what a
  Player is built with (4 / 2 / 2), and the four carry their kept cards. His smoke and stun are no use there today: the mission's frame allows his
  rifle, his pistol, and the frag at its one step. SWITCH: on in the page, `?kitpack=0` off; off in the module and on the frozen stand
  (`FROZEN_HOLDS['ISSUE.picked']`, `TPS_KITPACK=1` raises it); the table is the journal's `ISSUE`, and a recording from before the key replays with it
  off. No headless lesson run raises the issued page, so no frozen or shipped digest or tally moves: the rule is the page's and a recording's. Off =
  the build before (that row as issued, no card on its step). CHECK: `probes.ts kitpack` (`tools/qa/kitpack-check.ts`, family `kit`), both stands, and
  `KITPACK_BREAK=1` FAILS on both (4 lines): the row and its plan, the rule on and off, the journal, the loadout screen with and without cards, the
  staging as its page stages it under four kits (Stun heavy: he and the four carry it, and the one frag is on him though his card has none; a pistol
  and empty pouches: still the frag), the plan's map marks inside the level's rooms of those names, what its cards say of the kits (as issued the squad
  carries three stun grenades for the three rooms the lesson's door lines send it into; Stun heavy six, and takes your frag); and ON THE PAGE'S STAND THE MISSION PLAYED THROUGH by its scripted
  player under five kits side by side (as issued · Stun heavy · Stun heavy with a smoke traded for a frag · Frag heavy, no door charge on anybody · a
  pistol and empty pouches): 23 of 23 steps each, seed 1, god mode as that script always runs (`KITPACK_PLAY=0` leaves the plays out). MEASURED: those
  five runs, one seed; nothing else was measured (no tour, no soak: no rule of a fight changed). NOT SEEN: the mission played by a person on any kit
  but the issue; anything on a GPU; whether the squad, carrying a door charge under Stun heavy, blows the locked hall on B twice before the window step
  on the real page (the scripted player's run under it passes).
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
- **The tutorial's quiet mission, the ledger (`tut-quiet`)** (2026-10-22; row `tut-quiet` in `TUTORIAL_MISSIONS`, `kind: 'quiet'`, alone; no switch of its
  own: it is on rails, so `RAILS.on` is its switch, `?rails=0` in the page = the house as a plain quiet mission with no lesson, `TPS_RAILS=1` in front of a
  frozen run). `tools/levels/tut-quiet.ts` writes `levels/tut-quiet.json`, since the night of 10-22 a level of its own and no longer the training yard (ITS OWN LEVEL, below): a money changer's shop off a bazaar street on a snowing night, one way through, three men
  with one beat each, a lesson of 19 steps (`tools/qa/lessons/tut-quiet.ts` plays it by input alone; the generator's header says what each beat is and why
  it is built so); `levels/tut-quiet.script.ts` is three exchanges of a few words on the cues `lane` and `store` (nobody is held, moved or spawned). THE
  BEATS: out of the porch lamp and along the trodden path in the lane; a whistle at a mark, then behind a head-high wall: the back court's man comes the long way round to
  where the sound was and is grabbed from behind, asked twice for the strongroom's code, then put out or knifed; the back door picked; from the dark store
  the hall's man stands a stride inside the lit doorway with his back turned (the knife, on a knee); a chest beam passed on a knee; night vision; the mains
  box, then into a niche: the clerk has the longest walk, round a counter the length of the room, and is taken at the box; the code, the safe, out by the front door and the gate (the last line stays up to the mission's own end: with the lesson done in the forecourt the page fell back to the small objective row at the top). THE FRAME'S
  KEYS HERE: from the first step the walk, the view and the aim; `crouch`, `whistle` + `use`, `fire` + `alt`, `nvg` each come on with the step that teaches
  them; checkpoints `the lane` (the whistle's line), `the back court`, `the store`, `the hall`, `the counting room`, one before each timed beat and none inside
  one. TWO THINGS THE FRAME GAINED FOR IT: (1) `lesson.rails.rows`, a list of verbs: with it Space offers only rows of those verbs (`Rails.offers`, asked
  once in `player.ts buildInteractables`; absent = every row, so `tut-sky` is as it was). The locks are by key and Space is one key: on the page a tap beside
  the mains box set a wall charge and a tap beside the keypad worked a light plate. On a level that names its rows there is no row at all while `use`
  is still locked (the page drew "E pull it open" for the yard gate beside the start, a prompt for a key that did nothing). (2) his own actions' ring
  (`handring.ts`) is worked with its own keys through the gate: while it or the list is up and `use` is open, the digits 1 to 5 and both buttons pass
  (the frame's own line now). A DIGIT INSIDE THE HOLD (the maintainer's first play of it, on a GPU: "e doesn't do anything", on the whistle's line): `handring.ts early` makes a digit pressed with the interaction key down and the ring not yet up the ring's wedge at once, and the gate was dropping that digit as a locked weapon slot's, so "Hold E, then 5" done as a hand does it (the 5 inside the first 0.3 s, both let go) was a tap of E with nothing in reach: nothing at all. The gate now passes the wedge digits while `use` is open and the interaction key is down on an armed press with something to choose (`rails.ts gate`, `handKey`; `rails-check` line 14 presses the digit 0.07 s into the hold: the whistle sounds, nothing is drawn; without the mend that line is red). THREE LINES OF THAT PLAY THAT DID NOT READ (the same evening; the mends use the frame's pausing card, a step's `explain`): "Hide. When he stops: round the wall, [Space]" ("not sure what this means": he had hidden, and could not tell when "stops" is or what the key would do) is now the card 'A whistle brings one man' the moment the whistle has gone (he is coming; stay behind the wall; where the sound was he stops, his back to you; round the wall, up behind him, the key takes hold), the line 'When he stops: up behind him. [Space] grabs him', and a mark that rides ON THE MAN (`LessonStep.atMan`, a patrol route's name: `lesson.ts objective()` gives the HUD his place while he is on his feet; `levelData.ts` knows the key; drawing only, no state). Tried and taken out: a second line that came up when he stopped — he looks for `ATTENTION.whistleSecs` = 4 s, and a reader six seconds on a fresh line found him back at his work (`lesson-gate`, red on two dice); the card is read with the world held. "[Space] at the lock. Then keep still" ("'E at the lock' isn't sufficient. we need to introduce the lock picking system (like via the modal), tell the user they're going to do it, and then show them the controls for doing so") and the safe's "Keep still" ("weird to say 'keep still' -- we should just have a modal explaining interactions and cancelling them when we first introduce them") are now a step `door` ('To the back door') and, AT the door, the card 'Picking a lock' (the key at the lock picks it; work like this takes a few seconds, a lock, a keypad, a safe; move or the key again and you stop; it clicks and a man close by hears) with the line '[Space] at the lock: pick it'; the safe's line is '[Space] at the safe: take the ledger'; no line says keep still. Checked headless on both stands (19 of 19, and a reader six seconds a line on the page's stand); the cards over this mission and the mark on a man have never been seen on a GPU. OPEN: the four seconds he looks are short for a first grab (the scripted player has him 15.0 s after the whistle and he turns away near 16); the two lines at the mains box are of the old shape. THE ONE LOCK THAT PICKS is the back door's: the front door and the far gate are `steel` (once Space was open the front door
  offered its pick from the forecourt, a short way into the counting room past every beat; from inside it opens with a push, the way out). A STEP'S `ringLine` (`LessonStep`, `lesson.ts lineOf`; the
  sibling of `setupLine`) is its line while `HANDRING.on`: the whistle has no key on the page, so that step reads 'Hold [Space], then [5]: whistle. Then
  hide' there and '[V]: whistle here. Then hide behind the wall' where V still whistles; `Rails.prompt()` now gives `lesson.ts stepLine(T)` (the line as the
  keys stand), not the raw line. LEVEL DATA: `breaker.fumble` (seconds a man sent to the tripped panel works at it before the mains come back; absent = 2.2
  as on every level before it; 7 at most, since a room fight's lever party gives a panel up at 8; `lighting.ts updateTargets`, both directions in
  `levelLoad.ts`, `docs/level-format.md`; `breakerAt(x, z, out, fumble?)` in `train-ground.ts` writes it, the Training files export unchanged). This box
  takes 7. WHAT THE RUNS TAUGHT, each from a failed run or a picture: a man answering a whistle carries a torch on the place and a glimpse moves his goal, so
  the hide is behind a wall, never beside his path; a beat with a clock has its whole instruction in the line that is up before the clock starts, and the
  mark on the place that line means NOW (his own feet for the whistle; the hide the moment it sounds: a mark on the hide first sends a new player there to
  whistle); a scripted player that picks a row by name hides what a tap does, so this one taps and fails when the lit row is not the line's (`tap()`); ON
  THE PAGE a man who comes with a light finds a body, and a player, that the headless run leaves dark, and inside 3.5 m he sees 100 degrees to either side:
  the hall has a screen wall (hides its back half, the body, from the doorway and the box) and a niche by the doorway (the clerk walks past its end and
  stops with his back to it); no line asks for C while he is already low. ITS OWN LEVEL (10-22, night; the maintainer: "each tutorial level should have its own awesome level, not reusing ones like the pass. the assets and weather can be similar of course. but we should have just as much (if not more! since it's first impression) polish and have it really feel great and organic but still achieve the goals of the tutorial"). The generator no longer stands on `train-ground.ts`: it builds its own ground, walls, lamps, breaker and beacon (the Training files are untouched). KEPT TO THE CENTIMETRE: the shop's walls and doors, the low walls, both lamps, the beams, the box, the pad, the safe, the three men's posts and every mark the lesson and its scripted player name (`TQ`) but the whistle's (below), so the 19 lines, the cards and the script are as they were. NEW: the place. A street down the west of the map (shuttered fronts, three stalls, a parked pickup, ruts) with the yard's gate in its wall; the neighbours' houses stood against the back wall and beyond the far one, two upper windows lit; an alley behind the lane's wall with two stalls and a cart; the forecourt, the lane and the court under snow with ONE TRODDEN PATH from the gate to the front door and round the corner along the shop to the walk (the snow shows the way the mission goes), drifts at the feet of walls off that path, the court swept to its slab with a fire in a drum where its man stands; the store built as the shop's old mud-brick wing; and the rooms furnished as places (the counter's scales, notes, day book and cash box, a rate board and a clock on the strongroom's wall, a stove in the clients' corner, the clerk's ledgers and a case of them, cash tins and money bags in the strongroom, a rope bed, tea, a cooking corner and a radio with a green lamp in the hall, rolled carpets and tins in the store), every piece off the marks and the scripted lines, none in a `lived.*` group (the level is the same on both stands). SNOW: `tut-quiet` is in `weatherKinds.ts SNOW_LEVELS` (the weather owner's list: a claim), so on the page it is born in snow (`?snow=0` = the same boxes under no weather; the frozen stand holds `SNOW` off) and plays as under Overcast; `MATERIALS` carries the snow paints. The moon is the pass's thin one (0.06) from behind the shop. WHAT BURNS: the two lamps and the four bulbs on the mains as before; a fire in the court's drum and two lanterns on stall counters on their own fuel (ten lights in all). Every wall between a flame and the player's line is higher than the flame: by the file's own arithmetic nothing under 3.5 m is lit by the fire at the back door and nothing under 2.3 m at the hide. UNDERFOOT (`surfaces`): the rooms 'stone' and the path, the court, the street and the alley 'asphalt', as the whole yard was; fresh snow off the path is 'grass' (the quiet one), which is new, and the scripted player steps onto it only for the hide. TWO THINGS THE BUILD TAUGHT: (1) a slab between 2.75 and 3.45 m with half-extents over 0.45 is a ROOF to the weather and to the `roof` need (`weather.ts roofsOf`), snow caps on a neighbour's roof included, so every neighbour stands over 3.5 m; (2) a snow bank in the gap at the long wall's far end shut the court's man in his court: he heard the whistle, went suspicious and never came (`lesson-run` red at the grab). Nothing stands in that gap. TWO THINGS THE PAGE TAUGHT, on the software adapter: (1) snow throws the porch lamp's light back, and the light meter at the first dark stood at 0.28 to 0.32 against that step's line of 0.3, so `dark` passes under 0.45 on this level (a step that reads the meter is set against the floor it stands on); with the last grey patch out of the forecourt the corner itself read 0.41, too near that line for a renderer nobody has measured, so the mark `TQ.dark` stands three strides down the lane (15.2, 17.6) and the step also passes for a player well down the lane whatever the meter reads (a step never becomes impossible); (2) THE WHISTLE'S MAN LOOKS THE WAY HE CAME (`guards.ts`, the suspicious branch: arrived, his gaze is his body's heading with a sweep over it, 0.3 rad while his attention dwells, 1.1 without): whistled from against the shop's wall his last step was at the wall and his light a small spot on it a step away (seen in the maintainer's own picture of the level before this one). So the mark `TQ.whistle` is on the line he walks in by (z 17.8, the middle of the walk), the trodden path runs through it, the step `creep` ends within 0.7 m of it, and a bench with split wood under it keeps feet off that length of wall. Headless he stops facing down the lane (heading -1.59, his light between -2.2 and -1.3 over the sweep) on both stands. THE LEVEL'S FINGERPRINT MOVED: checkpoints and recordings of `tut-quiet` made before this are refused. ITS WORDS ARE IN SPOKEN ORDER (10-22, late; the maintainer on the card 'A whistle brings one man': "sentence structure is very odd here \"Where the sound was he stops, his back to you.\" this should read \"He'll check out the sound and then stop, with his back to you.\" why is the writing like this?"). The lines had been written as clipped key prompts ('[Space]: ask him the code', 'In. Stay in the dark', 'Stay low: he hears a step. Left button') and the cards carried the habit into whole sentences. Every line, both cards and the row's `place`, `blurb` and `scene` are now what a person would say ('Press [Space] to ask him for the code', 'Go inside and stay in the dark', "Stay low so he doesn't hear you, then left click to knife him"); the lines quoted earlier in this bullet are the old wording, kept as the record of what was played. A line stays under about 75 characters: the big type wraps near 40. WHAT SPACE OFFERS BESIDE THE LESSON (`rails.rows`; the same play: "nothing in reach to close the door?" at the back door he had just picked): the rows now include `pull` (shut a door), `ease` (ease one open), `drag` and `drop` (a body): plain quiet acts a player tries unasked. Still off: `kick`, `hammer`, `rattle`, `breach`, `breakerOn`. ITS ROW NAMES ITS HOUR (`hour: 'night'` in `scenarioList.ts`, the rule `ROWSET`): its light is the lesson, and a midday left on the link by the visitor's last pick put the lamps out and the lane in sun; it names no weather (the snow is the level's own). THE LIVED CHECK'S BASE (`tools/qa/lived-check.ts BASE_REVS`) has the join that first carried this level at its front: against the older base the whole rebuilt file read as furniture damage (red on the build from the step that took the rebuild until this). MEASURED on the new file, headless: `lesson-gate tut-quiet` ALL PASS (the scripted player on the frozen stand, 132 s; four dice as the page ships, two of them reading every line for 6 s); `level-needs tut-quiet --run` no FAIL and no NOTE on both stands; `level-lint` 0 warnings; `rails-check` as before on both stands; `quiet-light` red on the same three lines by design. Never seen on a GPU: the snow, the fire and the windows have been looked at only in the picture tool's CPU stills and on the software adapter. CHECKS: `bun run tools/qa/rails-check.ts` line 11 (the rows, no row under a locked key, and the ring's digit;
  both stands; `RAILS_BREAK=1` fails it on both), `lesson-run tut-quiet` (`TPS_RAILS=1` in front on the frozen stand), `lesson-check`, `level-lint`,
  `door-size`, `quiet-check`, `second-way-check`, `floor-order-check`, `level-names-check`, `carlamps-check` (its row), both typechecks. MEASURED, headless,
  after the last change: the scripted player waits a person's beat before each timed move; with that beat at 0, 0.6, 1.5 and 2.5 s it finishes on both
  stands (seed 1); seeds 3 and 4 finish on both; with every line read for 6 s it finishes on the shipped stand on seeds 1 and 2 and on the frozen one on
  seed 1; at a 4 s beat the clerk has the mains back in before he is down. ON THE REAL PAGE (headless Chromium, the software adapter,
  real key and mouse events, the page's own meter, 640 by 360 at the lowest quality): see the notes for what was played and what the pictures showed.
  RED BY DESIGN: `quiet-light` on three lines (three men where a free-roam night wants four to six; the start beside the way out; no dark way with the
  lamps on, the lit hall being the point). A SKETCH: the script's few words, the store (four strides of dark), a composed menu picture
  (`tools/menu-art.ts` PIN). KNOWN: a man put out through the list before he is asked leaves no way to learn the code (the pad then says so). Never seen on
  a GPU, never played by a hand: the timings are a script's, and whether the dark lane reads on a real screen with the outline off is the maintainer's call.
- **The ledger's whistled man looks from the gap, then turns away to smoke** (2026-10-22; `levels/tut-quiet.script.ts` beat `night`, the marks `TQ.look` /
  `TQ.smoke` and the volumes `tq_walk` / `tq_beam` / `tq_past` in `tools/levels/tut-quiet.ts`; level data and a level script, no switch of its own). The
  maintainer, playing the ledger on a GPU, of the man who had walked to the whistle's own mark: "guard seems kinda dumb that he doesn't notice the
  footprints. maybe we should make him stop a bit further away and then turn around for a cigarette break. may need to rework the map for that", and "he
  can stop further off so long as he's covered the spot with his flashlight, but maybe isn't close enough to notice the footprints". (Guards do NOT read
  prints: the snow's tracks are the picture's alone, and nothing here changes that.) WHAT HE DOES: the game's own whistle rule starts him (the nearest
  calm man who hears it goes suspicious); 0.9 s later the script takes him. He comes round the long wall's far end as before, stops in the back strip a
  stride short of the gap in the cross wall (26.4, 17.75), puts his torch through the gap and over where the whistle was (5.2 m off in the scripted run,
  his beam within 6 degrees of the mark) for 3.6 s, says "nothing. wind", walks back up the strip past the back door to his chair at its far end
  (30.6, 17.7; it was 30.3 until the grab hauled a man a step back, `docs/agents/stealth.md` the stalk after its review), brings the torch down to his side (the smoke order is `upper: 'none'`: a whistled man keeps his torch in the hand, `guards.ts handCarry`, and with no upper layer it hangs as a calm man carries it), and smokes there for 50 s with his back to the gap; then the script lets him go and he walks back to his fire, the game's own man. The
  player comes round the long wall's near end, up the walk, through the gap and along the strip to his back: seven metres with the man's back to him.
  A MAN A SCRIPT WALKS IS BLIND AND DEAF (`squad.ts runGuardScript`), so the script is his eyes and ears while it has him, and each of these hands him
  back to the game `alert`: the player on the walk or in the strip while he comes down it; the player there or in the lane (`tq_beam`: all of it but the
  pocket behind the long wall) while his light is through the gap; the player past him the way he faces; a step behind him that is not a crouched one
  (a run inside 6 m, an upright walk inside 2.4 m: an event's `level` is the gait's times the floor's). A second whistle while he smokes sends him to
  look again, at where that one was. A grab, or the man down, ends it (the `ask` step's cue `held`). THE STEP AFTER: he is taken 2.5 m past the back
  door's lock on purpose. A body within 1.3 m of a hand has the row before a door's (`player.ts INTERACT_PRIORITY`), so a man put down nearer made
  Space at the lock DRAG him; the `door` step's reach is 0.8 m so it does not pass from where he was taken. WORDS: the grab line is "When he lights a
  smoke, sneak up behind him and press [Space] to grab him"; the card keeps the maintainer's sentence ("He'll check out the sound and then stop for a
  smoke, with his back to you."). CHECKS: `lesson-run tut-quiet` on both stands (`TPS_RAILS=1` in front on the frozen one; `--pace 6` on the shipped)
  finishes 19 of 19 and prints where he looked from and how far his light was off the mark (it fails under 4 m or past 16 degrees), and that his torch is still in his hand, lit, and under his shoulder at his smoke (0.48 m under; it fails above 0.2); its BREAK PATHS,
  each of which must fail the run: `TQSMOKE_BREAK=front` (the player stands on the walk), `=beam` (he stays on the whistle's mark), `=upright` (he
  walks up behind the smoking man on his feet). All three fail on the frozen stand, seed 1. `lesson-gate`, `level-needs --run` on both stands,
  `rails-check` on both, `second-way-check`, `ownroofs-check`, `rowset-check`: green. `quiet-light`: its three red lines by design, no fourth.
  THE LEVEL'S FINGERPRINT MOVED (three volumes, a chair and a gas bottle moved, a tin added): checkpoints and recordings of this level from before are
  refused. `lived-check` wants a base that carries this change; none is added here (the per-level base is the tutorial goal's). ON THE REAL PAGE (headless Chromium, the software adapter, real keys; with the torch still held up, before it was lowered): he came, looked from
  (26.7, 17.8) 10.4 s after the whistle, was at his smoke at 17.7 s, and the grab took with a tap of Space at 30.4 s; no page error from the game.
  The pictures are too small and dark to judge him by. The lowered torch: headless and on the pose sheet only. NEVER SEEN ON A GPU, never played by a hand: how long 50 s feels, whether a man in a
  dark strip reads from the gap, and whether the look through the gap is long enough to be noticed are the maintainer's.
  A SMALL FLAW IT TURNED UP, not this change's and not mended: creeping up behind the hall's man the scripted player's footfall was filed on seven
  frames running (0.1 s) at 1.1 m, and seven crouched steps on stone at that range take a calm man to suspicious; the same approach six seconds
  earlier in the same run files one. It looks like the walk cycle's phase crossing its half back and forth (`player.ts`, the footstep's edge test).
- **A man told to have a smoke lights one** (2026-10-22; `src/game/smokebreak.ts SMOKEBREAK` / `updateSmokeBreak`, called from `game.ts` beside the
  breath in the cold; the order is `director.ts OrderPatch.smoke` → `GuardScript.smoke`; the arm is `character.ts smokeLayer`, its numbers `SMOKEARM`
  in that file). The maintainer: "cigarette break animation (with real smoke!) would be sick". THE SWITCH: `SMOKEBREAK.on`, ON in the page
  (`?smokebreak=0` puts it off), OFF in the module and on the frozen stand (`FROZEN_HOLDS`; `TPS_SMOKEBREAK=1` raises it there); registered in
  `knobs.ts`, and a recording from before the key replays with it off (`journal.ts applyKnobs`). Off, a man told to smoke stands where he was sent with
  his hands as they were: the same game digest as a man never told (the check's `off` line). WHO: a living man on his feet whose script says `smoke`,
  once he stands where it sent him; not a man in an arm; the frame his script ends the hand is given back. One man in the game today: the ledger's.
  WHAT: his LEFT hand goes up to his mouth to light it (0.5 to 2.6 s; the torch and the gun are the right hand's) and again for 2.1 s of every 7.5 s;
  a lighter's flame at his mouth (one `LightSet.flash`, 0.9 s, range 3.2 m) and the lit end (a flash re-filed every 0.4 s at the left hand, intensity
  0.1 and 0.7 at a draw, range 1.3 m): the engine's own short lights, so the light meter has them as the picture does. THE SMOKE IS THE SOLVER'S: a
  thread off the end that rides his hand (one long source) and what he breathes out 0.7 s after each draw, off his mouth for 1.3 s, both `look`
  sources on the fine lattice with a blue grey `tint` (`smoke/types.ts`: the game's own smoke, the one sight lines are cut by, is never told). With no
  solver drawing, what he breathes out is the particle system's dust puffs with a steam share, as a breath in the cold is, and the thread is not shown.
  Nothing live shows in the fog of war: a hidden man's smoke is not filed (his lights are the meter's and stay). THE IMPORT TRAP: `character.ts` must
  not import `smokebreak.ts` (it did at first, for the arm's numbers: in the page's bundle that module, and through it `particleFx.ts`, was evaluated
  in the middle of `character.ts`, and `wounds.ts` then ran its top level before `FOLD_WITH` existed: the page died at boot with every headless check
  green). CHECK: `bun run tools/qa/smokebreak-check.ts` (probe `smokebreak`, also under `missions`): lights, hand (the left wrist from 0.57 / 0.73 m
  off the head joint on the frozen / shipped stand to 0.21 m, the right moving under 0.1 m), smoke (one thread, a breath a draw, every source
  look-only, fine, confined; the thread dropped the frame he is let go), puffs, who, off, old: 8 of 8 on both stands; `SMOKEBREAK_BREAK=1` fails six.
  NOT DONE: no cigarette is drawn in the hand (at the game's zoom it is two pixels: the light is what shows), no sound of the lighter, no ash, and the
  arm's numbers are first-pass. Its lights add to the frame's 64 while he smokes (one, two for the 0.9 s of the flame). THE POSE WITH NO GPU: `bun run tools/qa/pose-mesh.ts defender_1 smoke-up --inhand --gunhand` (and `smoke-rest`), then
  `python3 -I tools/qa/pose-mesh-raster.py <the PLYs> --out sheet.png`: the hand is at his mouth with the elbow down, the torch low in the other.
  ON THE REAL PAGE (the software adapter, the ledger played with real keys): he lit up and took a draw before he was grabbed, with no page error from the game; at
  640 by 360 the orange light on him at a draw is what shows, and neither the arm nor the smoke can be judged from those pictures. NEVER SEEN ON A GPU.
- **A mission row can name its own hour and weather** (2026-10-22; `src/game/rowset.ts`, `ROWSET.on` — ON in the page, `?rowset=0` = the link's hour and
  weather as ever; OFF in the module and on the frozen stand, `TPS_ROWSET=1`; a `FROZEN_HOLDS` row, in the knob registry and a journal's tables. NO ROW
  NAMES ONE YET, so on or off is the build as it was). A tutorial mission's level is built for one hour and one sky, and its row used to open at the
  level's own night, or at whatever hour and weather the visitor's last pick had left on the link. `hour: 'dusk', weather: 'dust'` on the row
  (`ScenarioEntry` in `src/scene/scenarios.ts`; rows in `TUTORIAL_MISSIONS`) and a visit to it is ALWAYS started in them: THE ROW'S OWN WINS over
  `hour=` / `weather=` on the link, because every link the page builds (the sheet, the next mission, the loadout, a quit) carries the visitor's standing
  picks; those pass through such a row untouched and are his again after it. THE HOUR IS THE LEVEL'S: any mission booted on that level file gets it (a
  tool's other seed or team size too), so only a row with a level file of its own may name one, every row of one level file names the same, and only a
  Tutorial row may (the check is red otherwise). A level built for snow names no weather; a weather is one a level can be started in. WHERE: `main.ts`
  writes the row's keys over its copy of the query (never the address) after the page's switches and the tape's tables and before the weather, the snow
  and the hour are read, so a bare link and a restart are the row's; `scenarioRun.ts startFromQuery` does the same on its own copy for a headless tool
  (on the page's stand a tool's own `PT_HOUR` or `--set WEATHER.kind` loses to the row; what a start laid on stays on that game after the quit, as an
  asked `hour=` always has). THE SHEET: `docs/agents/menus.md`. A RECORDING from before the key replays with the switch off (`applyKnobs`; on the page's
  tape player `rowsetTape`, read at boot). KNOWN: a CHECKPOINT made on a row before it named a weather is refused once it does ("made in other weather":
  the page is compiled for one), and `?rowset=0` opens the row as it was to load it; `sun=` on a link still applies to the row's hour; the older start
  card's short list and `?pick=` go by `picks.ts`'s own `hour` / `weather`. CHECK `bun run tools/qa/rowset-check.ts` (`probes.ts rowset`, family
  `missions`): 17 lines on both stands and with `TPS_ROWSET=1`; `ROWSET_BREAK=1` fails 7 of them on both; run before `missions-screen` in one process it
  leaves that probe green. ON THE REAL PAGE (headless Chromium, the software adapter, lowest quality, a scratch copy of the tree whose `tut-solo` row was
  given dusk and dust; three loads, the page's own `__hour.id` and `__weather.kind` read after the boot): the bare link stood at dusk in dust; with
  `&hour=dawn&weather=rain` on it, dusk in dust and the address untouched; with `&rowset=0&hour=dawn`, dawn in the level's own weather. No console error
  but the favicon's 404. Never seen on a GPU: what dusk in dust looks like on that level is for whoever sets the row, and no shipped row has opened
  through it.
- **The tutorial's big line stays clear of your own men** (2026-10-22; `src/ui/railclear.ts`, `RAILS.lineClear` — a picture-only knob of the frame's
  table, on with it, off on a recording from before the key; `rails.ts lineMen`; drawn in `ui/overlay.ts`, `index.html` `--railman` and `--raillog`).
  The pair mission's pictures showed it: with the view led up the screen (the aim on a man ahead), or in a short window, the player and his partner stand
  low in the middle, under the line's plate. The line now has TWO places and no more: where it lies, and the bottom edge of the picture just under that.
  While the player (on the floor) or a living teammate is under where it lies and the bottom edge is clear of them all, it is at the bottom edge, and the
  radio's rows, which live there, stand just above it; it comes home once nobody is within 36 px of where it lies, or when a man walks under the edge.
  With both places taken it lies where it lies. It never follows a man and never goes up into the picture, where the step's mark and the aim are (a
  first cut stepped up over the men in 40 px steps: it landed mid-picture and climbed ahead of a walking man). With a ring up (`ui/cmdring.ts ringUp`)
  it is at home and the ring's own step of it (`--railshift`) is the only one. A man's box is his feet to the top of his head bone. ALSO, from the same
  thread: a deed can name the man or the thing an order was given on (`done: { is: 'did', what: 'order:<id>@foe:<callsign>' }` or
  `@thing:breaker|objective|device`; `lesson.ts` counted these already and its validator refused the `@`; it now refuses a callsign nobody on the floor
  has, and a door after the `@`: a door is `on`), and `docs/level-format.md` says that `allow` and `deny` add up down the steps. CHECK `rails-check`,
  the line "the big line stays clear of your own men" (the pure rule on made-up boxes: nobody, men elsewhere, a man under it, 240 frames of drift with
  no move, the hold, both places taken, no room under it, a man walking the whole picture down and up: two moves each way and never above where it
  lies; the frame's list in the sky seat and on the floor, and with the knob off; the deed's shapes, and a step that counts the order on the named man
  only): 22 lines pass on both stands, `RAILS_BREAK=1` fails 14 on both, this one among them (through the list alone: the rule on boxes and the deed
  have no break). ON THE REAL PAGE (headless Chromium, the software adapter, real mouse moves): `tut-solo` at 1280 by 560, the aim at the top of the
  screen: the line at the bottom edge, 104 px down, clear of the player through 40 wandering mouse moves with no second move; `tut-pair` at 1280 by 720
  as it opens with the aim up the screen: the partner stands under where the line lies and the line is at the edge, clear of both; the partner then put
  at the bottom edge by hand: the line home, between the two men, and at the edge again four seconds later when he had walked back. NOT PLAYED: the
  radio's rows over the line at the edge (none were up in either play), a ring up at the same time, four men. KNOWN: an order to a neighbouring door
  within `RAILS.wayM` of the step's mark still brings the step's `after` line (the squad mission's reading). Never seen on a GPU.
- **The script's `direct` walk has its own guard** (2026-10-22; `tools/qa/rails-check.ts`, the gate's line). Mission 1's new floor has one road from
  the roadblock to the gate, so the beat is as short with the word taken off and no longer proves it. The line now also asks `lanes.ts lanePenalty` of
  each roadblock man the script sent, with the word and without: never a price with it; without it, on a stand with covered lanes, the lanes' price
  (670 man-frames on the page's stand; the frozen stand has no covered lanes and only shows the word reached 3 men).
- **A step's own eye always has a place among the fog's** (2026-10-22; `RAILS.eyeFirst`, a knob of the frame's table, on with it, off on a recording
  from before the key; `src/game/fogofwar.ts update`). The fog of war takes five eyes. In the sky seat with four men up and the seat's lookout in, the
  list was full and the step's own eye (`eye { at, yaw, fov? }`, pushed last) was the one dropped: on mission 1 the squad's own wall charge went off in
  the fog, twice, in the maintainer's play. Now the step's eye goes in ahead of the lookout and, with the places full, takes the last one (the lookout
  gives way for that step; on a floor mission with the player and four men, the last man's eye does). Mission 1 itself has its fog off since (the
  level's word); tut-squad, tut-plan and any mission that keeps its fog are what this is for. CHECK `rails-check`, the line "a step's own eye has a
  place among the fog's five" (the rig puts the fog on itself: on a step with no eye the lookout is one of the fog's and its ground is seen; on the
  wall's step with four men up the step's eye is one of the five and where it looks is seen; with the rule off it is dropped and the place is in the
  fog): 23 lines pass on both stands, `RAILS_BREAK=1` fails 15 on both, this one among them. Headless only: the page's fog is the GPU's picture of the
  same five eyes, and nobody has looked at it since. Never seen on a GPU.
- **A rows list that withholds the act that puts a taught one back** (2026-10-22; `rails.ts rowsWithheld`, printed by `tools/qa/lesson-check.ts` as
  `NOTE` lines, never a verdict). The maintainer on the stealth mission: "nothing in reach to close the door?" — its `rails.rows` named `push` and not
  `pull`, so the door he opened had no row. The pairs read: push or ease with pull, drag with drop, lightsOff with lightsOn, breakerOff with breakerOn.
  A note and not a fault, and no base set forced into every list: a mission may mean it, and a row added beside a taught one can take the tap from
  it, so the list is its author's to mend with its own scripted run. At the time of writing: tut-pair (push, no pull) and tut-quiet (push, no pull;
  breakerOff, no breakerOn) are noted; tut-solo's list is clean; the other three have no list.
- **Mission 1's scripted player off the page's stand** (2026-10-22; `tools/qa/lessons/tut-sky.ts raises`, `tools/qa/lesson-run.ts`). `lesson-gate
  tut-sky` was red on its frozen arm at the wall's step since before the level was rebuilt: that stand has no destruction (no wall charge to give), no
  ring that stays up for its digits, and no teammate working a thing (the breaker's step). The player's file now raises those for its own run
  (`PT_DESTR`, `TPS_QRING`, `TPS_QSTAY`, `TPS_WORKTHINGS`), and `lesson-run` honours `PT_DESTR` in a `raises` (the switch before the level loads, the
  page's chaos 0.5 once the game stands, both put back): no stand word reaches the destruction's switch.
- **The tutorial's pair mission, the truck park (`tut-pair`)** (2026-10-22; row `tut-pair` in `TUTORIAL_MISSIONS`, `kind: 'quiet'`, `squad: 1`; no switch
  of its own: it is on rails, so `RAILS.on` is its switch, `?rails=0` in the page = the yard as a plain quiet mission for two with no lesson, `TPS_RAILS=1`
  in front of a frozen run). The old Training lesson for the quiet pair, rebuilt on the frame: no new rule, the pair's own (`pairorders.ts`, `workthings.ts`,
  `sneak.ts`). `tools/levels/tut-pair.ts` writes `levels/tut-pair.json` on ITS OWN GROUND (it shares the kit's pieces with other levels and nothing else: a
  tutorial mission is not built on the training yard or on another mission's floor): a haulier's yard at night, 33 by 23 m, which is what the 40 by 28 m
  world leaves with a road either side; a truck gate chained shut, a fallen stretch of wall the two come in by from the road where their own pickup stands,
  two shipping containers end to end across the yard with a gap between them and a third stood across the gap's mouth, the watch's camp round a lantern
  with a wall along its south side, an office court with a fuel point. Four
  men on posts, a lesson of 18 steps (`tools/qa/lessons/tut-pair.ts` plays it by input alone; the generator's header has the map and why each piece stands
  where it does); `levels/tut-pair.script.ts` is a few words between the men on the cues `gate`, `park` and `yard` (nobody is held, moved or spawned). THE
  BEATS: get low and lead the partner round the end of a low wall; the squad's key on the man at the pickup, the partner creeps to his back and says "set",
  the word (F) drops him and the partner falls in again by himself (`pairup.ts rejoin`: no line asks for it); in the gap between the containers, two men who watch each other: the
  squad's key on the far one, the player to the near one's back, and the player's own grab is the partner's signal (both down on one beat), then the right
  button; round the court wall to the man who watches the far gate: held and asked, he gives the office door's code; with him still in the arm, the squad's
  key on the fuse box: the partner throws the mains, every lamp in the yard and the office camera die, five beacons turn red; night vision, the pad, the
  manifest from the office trunk, then the squad's key on the ground calls the partner from the box (there he does hold where his work ended) and the two
  go out by the far gate. THE ORDER STEPS CARRY AN `after` LINE ('He works round to the man's back', 'He goes for the fuse box. Watch the lamps'): once
  the order is out the line is what the partner is doing, drawn as a thing to watch, and the step is done by what the order was for ("set", the dark). THE FRAME'S KEYS HERE: from the first step the walk, the view and the aim; `crouch`,
  `order`, `word`, `use`, `alt`, `nvg` each come on with the step that teaches them; `rails.orders` is `pairMark`, `work`, `fallIn` (a tap of the squad's
  key on a man, on the fuse box, anywhere else) and `rails.rows` has no row for the fuse box, so the box is the partner's work. KEYS SHUT AGAIN WHERE A TAUGHT KEY
  WOULD END THE MISSION (a review's finds, none met in a run): the interaction key while the line is the right button on the near man (a tap of it in the
  hold is a question, any held man gives the office code, and the last man would then have nothing to say); the right button, the squad's key and the
  word from the walk to the last man until he has been asked (the squad's key on him and the word would put him out through the partner); the squad's key
  again from the dark until the manifest is taken (a second order on the fuse box puts the mains back on). Three steps open on a card (the partner, the double, a
  thing he works). Checkpoints `the gate yard`, `the truck park`, `the dark`. WHAT THE RUNS TAUGHT, each from a failed run: (1) `opening.ts` moves on any
  man whose post is inside ten metres of the spawn by walking, and a man moved on walks back to his post and stands facing the way he came: the near man of
  the double then faced the player and the far one turned to talk to him. The start is further than that from every man. (2) Two calm men inside 4.5 m of
  each other turn and talk (`dialogue.ts AMBIENT.pairM`): the double's two stand 4.6 m apart. (3) A man's post on the edge of a nav cell turns him as he
  steps onto the cell: posts whose facing matters are on a cell's middle (x and z ending .25 or .75). (4) THE PARTNER WILL NOT STAND WHERE IT IS LIT AND A
  MAN HAS A LINE TO IT, and open ground under a moon reads lit (the rule's line is 0.1; the meter in the open reads 0.45 under this moon of 0.5, and 0.29
  under the training yard's 0.22): with the first marks in the open he stopped five metres short and the step that wants him close never passed. Every
  mark the player is led to is in a moon shadow (the low wall's, the containers', the south wall's). (5) ON THE PAGE THE PARTNER ALSO READS THE LIGHT ON
  HIMSELF (`SNEAK.stalkAmbient`, on in the page): sent to a man's back from a place in the moon he takes the whole way for lit, says who is looking across
  it, and gives up. The headless partner has no moon on him, so only the page showed it: the first page run stopped at the double with every headless seed
  green. The moon is low in the south-west so that shadows fall across the yard, and every mark the player is led to is in one. With it the page (software
  adapter) played the double. That was not enough on a GPU: see (8). (6) The way to a man's back must have room
  to pass the men who are not his, and a vehicle moved to throw a shadow can close the nav between two parts of the yard (the scripted player then walked
  round outside the wall): look at the path after moving one. (7) A look-at point inside a parked truck is a lint warning; a mark for the pad is 0.75 m
  off the door, not a metre. (8) NO SHADOW IN AN OPEN YARD IS DARK ON A REAL GPU, AND THE PARTNER'S RULE IS LIT + A LINE. The maintainer's first play
  (10-22, Chrome on his GPU, hard): "not following me here" at the gap, the partner 'with you · waiting on the light' by the van; his light meter read
  14 in the gap and 27 behind the low wall, where the software adapter had read 0 to 3 (the moon's bounce: neither the CPU's estimate nor the software
  page has it). To the partner 10 is lit; both lantern men looked straight down the gap, so their LINE ran the length of the gate yard, and he will not
  walk a lit stretch a man has a line to nor stand in one: he was never going to come, and the step waited on him (`mate`). Reproduced headless with
  `lesson-run tut-pair --floor 0.2` once the floor reached the partner's own meter (below); with it the NEXT step failed as well (his way to the far man
  went through the gap and down the container's side, a stride behind the near man, whose head swings: 'waiting · Novak is looking across the way',
  then he gave up). THE MEND IS GEOMETRY, NOT DARK: a third container across the gap's mouth (nothing west of it is in either lantern man's line; the two
  come round its end and he stops in the alley three metres short of the player); the strip round the south container's end opened (that container
  ends 0.8 m short) and a wall along the south of the camp from that container to the stub (his way to the far man is down the alley, round the
  container's end, along the yard wall and up the far side of the stub: no line from the near man to any step of it). And NO 'LEAD HIM' STEP BUT THE
  FIRST WAITS ON WHERE THE PARTNER IS (`gap` and `past` are done by the player's feet): a step that waits on the partner's own judgement of the light is
  a dead end the day he judges it lit; the scripted player still fails a run where he does not come. THE SCRIPTED RUN PLAYS AT THAT LIGHT
  (`tools/qa/lessons/tut-pair.ts` `mode.floor` 0.2; `--floor 0` = the dark it was built in). `lesson-run --floor N` now floors EVERY UNIT'S meter, not
  only the player's (it stands in for the probe's answer under the `unit` keys: the CPU's estimate where he was asked about, the moon, never under N),
  and a script can ask for it (`mode.floor`): use it on any quiet level that will be played on a GPU, with what a GPU showed. Measured at floors 0,
  0.15, 0.3 and 0.45 on seeds 1 to 4 (16 of 16), at 0.2 and 0.3 on hard, and at 0.2 with every line read for 6 s: all 18 steps; "set" behind the far man
  comes 25 to 32 s after the order with a floor (17 to 23 s in the dark), which is a long watch. ALSO FROM THAT PLAY, "what is F here": the key by the
  partner was the floor plan's mark for a man who waits on the word; see `squad.md`, the key's cap. `rails.rows` gained `pull` (a door he opens can be
  shut: the tutorial frame's note from the stealth mission). THE PAGE PLAY, `tools/qa/tut-pair-page.cjs` (Playwright on the software adapter against a dev server; `PORT`, `OUT`, `PICS`,
  `STEPS`, `SETTLE`): it boots the row, checks the frame is up and the untaught keys do nothing, then does every step with real keys and the mouse, a
  picture where asked. Two things it had to learn: a hand walks by the game's own path finder, not in straight lines (a real-size door leaves a hand's
  width either side of a man); and stepped frames are never drawn there, so THE PAGE'S LIGHT METER DOES NOT MOVE unless a frame is drawn: it draws a few
  before each order (`settle`), or the partner reads the light of wherever the last picture was taken. THE GRAB there is whatever the line asks for: the key on
  its cap, or, where the line names no key (the held click is the only way to a man, `stalk.ts`), the left button pressed on him and kept down. CHECKS: `lesson-gate tut-pair` (the file is its
  generator's, `level-lint`, `lesson-check`, the scripted player on the frozen stand with the frame raised, and on the shipped stand on four dice, two of
  them reading every line for 6 s), `quiet-check`, `carlamps-check` (its row), `level-needs tut-pair --run`, `rails-check` (the frame's own), both
  typechecks, the page play. MEASURED, headless: the scripted player finishes all 18 steps on the shipped stand on seeds 1 to 4; "set" comes 5 to 12 s
  after the first order (the second: see (8)), the mains go 3 to 7 s after the order on the box. THE DOUBLE'S ORDER NAMES ITS MAN (`did` `order:pairMark@foe:<callsign>`): the squad's key on the near man of the two leaves the ask up
  (`TUTPAIR_NEAR=1` in front of `lesson-run tut-pair` gives the near man first and fails if the step passes). KNOWN: the last man is 14 m
  from the office door, so the dark is walked, not stood in; the two at the start
  are dark figures on a dark road. A SKETCH: the script's few words, the office (one room), no lived-in rooms, a composed menu picture
  (`tools/menu-art.ts` PIN). Played once by the maintainer on a GPU as far as the gap (10-22), which is where (8) comes from. THE LEVEL AS MENDED IN (8)
  HAS NEVER BEEN SEEN ON A GPU and not on the page at all (headless runs only): the third container, the camp's wall, how the alley reads, whether a
  floor of 0.2 is what his GPU shows past the gap, the red of the beacons over the whole yard and whether the lamps going out reads as the moment it is
  meant to be are his to judge.
- **The frame's eyes are the player's view, not the squad's knowledge** (2026-10-22; `RAILS.eyeView`, a knob of the frame's table: on with the frame, off for
  a recording from before the key, `journal.ts applyKnobs`; `?eyeview=0` puts it off in the page, as `?eyefirst=0` and `?lineclear=0` do the frame's two
  other late rules; on the frozen stand the frame itself is off and `TPS_RAILS=1` raises all of it; `RAILS_BREAK=1` is its break path). A MEND OF THE STEP BEFORE IT (`eyeFirst`):
  the seat's lookout (`rails.sky.eye`) and a step's `eye` were one more of the TEAM's eyes, so a man in one was in the fog's `seen()`, which the squad's own
  choices read. On the plan mission a step's lookout stood inside the hall; once `eyeFirst` gave it a place with the list full, the hall's gunner was "the
  team's contact", and the stack at the front door (`autopilot.ts contactBehind`) threw its last can and re-formed three seconds while the pair at the back
  went in alone. NOW (`fogofwar.ts update`): the picture's list (`pic`: the mask, the doors, the loose things, `spotSeen`) carries the frame's eyes; the team's
  own list, which every man's `seen()` and `sighting()` are answered from, does not, and is the list a level with no frame would have — the teammate a step's
  eye takes the picture's last place from still answers for the team. A man only a frame's eye has a line to is DRAWN, NOT SEEN (`Rec.framed`), as a man the
  squad is shooting at is (`FOG.squadFire`): in the picture, under the cursor, with his markers; no last-seen mark, no linger when the eye leaves him; a body
  seen through one stays in the picture. His line is walls and leaves only: no plume is asked along a frame eye's line. WHAT STILL READS HIM, by `hidden()` /
  `drawn()` as for any man in the picture: the cursor and rings, the 40 mm's list of who is near a round, a pair order on a man pointed at, the shut-door rule.
  THIS CHANGES RUNS of every tutorial mission played with the fog on and a lookout or a step's eye that had a place before (the squad mission, the pair): a
  man the lookout alone has is no longer the squad's contact. CHECKED, both stands: `rails-check` 24 lines (the new one: on mission 1's wall step, fog put on
  by the rig, a man of the other side stood 1.5 m down the step's eye in room 3 is on lit floor, drawn, not hidden, not seen, with no sighting, and the entry
  on his room's door with one can left is open and clear; with the knob off he is seen and the entry is bang and clear, "contact": the regression as it was);
  `RAILS_BREAK=1` 16 red on both. NOT CHECKED: a teammate's eye displaced from the picture by a step's eye still answering `seen()` (mission 1 in the sky
  seat has four eyes and room for the step's); smoke between a frame's eye and a man (he is drawn through it: a guard that borrowed the team's own smoke verdict was tried and taken out — it went
  stale when the team lost its line and let one teammate's smoked line hide a man the lookout saw clear, and nothing headless can reach smoke; the mend is
  the probe asked along the frame eye's own line, with a switch); anything on a GPU. THE THREE LATE RULES ARE KNOBS OF THE FRAME'S TABLE, not switches of
  their own: on in the module, inert with the frame off (the frozen stand), carried by the journal, each with a page word; no `FROZEN_HOLDS` row.
  OTHER OWNERS' READERS that still ask `seen()` for a thing of the picture's, and so treat a man only the lookout has as unseen: a laser's dot on him
  (`combat.ts`), the floor plan's sight line to him (`floorplan.ts`), the calls about him (`tellCalls`). Theirs to move to `drawn()` if it shows.
- **A key is named on the floor only once its lesson has opened it** (2026-10-22; `floorplan.ts waitsOnKey`, `rails.ts hushes`; on rails only: `?rails=0`
  is the build as it was). The floor plan put the squad's key on every door that waits on it, dark until the men stand there. On mission 1 the stack's
  step comes before the word is taught, and on the pair's mission the player asked what the key over his partner was. While the step that is up holds the
  word shut the press does nothing (`rails.ts gate`: the squad's key goes by under `word` and nothing else, a set charge's blow included), so no door
  carries the cap: the bar across the doorway stays (the men are waiting), the key goes. `Rails.hushes(action)` is the one question a reader that draws a
  key asks. The quiet pair's own mark is the pair mission's rule in the same file. NOT MOVED TO IT: a laid plan's cap and the squad panel's "F go" note
  (they are shut by `menu`, and no level has a step with the menu open and the word shut). CHECKED, both stands: `rails-check` (at the stack's step the
  door reads `stack` with no key; at the first later step that opens the word, the key; `RAILS_BREAK=1` red on that line on both). Never seen on a GPU.
- **The scripted players play in the page's own direct light, and the plain lesson check walks the tutorial too** (2026-10-22; tools only: `lesson-run.ts`,
  `lesson-gate.ts`, `lesson-check.ts`; A CHANGED BAR for all six tutorial missions). THREE GAPS between a scripted run and the page. (1) The CPU's light
  estimate has an authored hour's sun and sky (`hours.ts hourLight`) and nothing of the NIGHT's moon (`guards.ts lightEstimateAt` skips directional
  lights), and the page's meter has both: `--moon` put it on the player's own meter alone, and only where a script asked. So by night the squad mission's
  men "never saw what the page's shot", and the pair's partner followed down a lane in runs that the page's meter called lit. NOW `lesson-run --sky` is ON
  BY DEFAULT FOR A TUTORIAL MISSION (`--nosky`, or the script's `mode.sky: false` with why, puts it off; a Training row asks for it): `--moon` for the
  player, and ONE hook on `g.lightQuery` / `g.lightAt` / `g.lightForget` that answers every other man's meter (a unit's own, a body's, a held man's, a
  civilian's) by the SAME SUM as the player's: the estimate where he is, plus the moon where nothing solid is up its direction (an hour's own sun is
  never added again: at midday that lit a man twice). `--floor N` (the pair mission's, `mode.floor`) is the same hook's lower bound: the bounce neither
  has; with `--nosky` it is the floor alone. Two models of one floor would let a man be lit to the squad and dark to himself. This is also what every
  caller of `runLesson` gets (`tut-solo-check`'s arms). AND THE NIGHT SKY'S OWN LIGHT (10-23, `glowAt`; `--noglow` = the moon alone): the page's meter
  has it through the bounce cache, so open moon shadow reads LIGHT 8 to 16 at the presets a player uses (measured by the stealth sight work on the pair's
  level, software adapter, preset high) and read 0 here. By the sky's own numbers (`skyRadiance`: the zenith's colour, read live): pi times its luminance
  times how much sky the point has, five rays (the zenith's cap a quarter, four at 60 degrees three sixteenths each). On the pair's level, against the
  page at high: the lane's gap 0.034 here and 0.036 to 0.050 there; its east end 0.048 and 0.040 to 0.053; the low wall's mark LIGHT 50 and 47. Nothing
  by day (an authored hour's sky is in the estimate). The pair's two start points on the road agree too (moonlit, LIGHT 45 to 50 here and 46 to 47 on the page with the men's own bodies skipped: a first
  page reading there, 2 to 8, was taken inside the men standing on those spots and is struck). MEASURED with it (lesson-gate, build 897's head): mission 1, the plan, the
  squad, the ledger and the pair pass on both arms; THE SOLO MISSION DOES NOT: its `back` beat ("the dark is cover too", beside the shop's door with the
  lamp shot out) reads 31 over its own bar of 25 (the moon alone: 23). Its script holds the sky's light off (`mode.glow: false`, a HELD BAR with the
  reason over it) until its owner moves the spot or the claim. STILL NOT THE PAGE'S: the moon's bounce into a shadow beside lit
  ground (the page's low wall at knee height, 0.1: `--floor`), THE PRESET (the page's own meter reads tight shadow two to three times darker at low and
  lowest, a coarser cache grid, and every page lane in the cloud runs lowest: a lane that reads the meter, or a man who sees by it, wants
  `QUALITY=high`), no bounce but that floor,
  no bodies' shadows, no smoke between a light and a man, no flicker. (2) `lesson-gate`'s frozen arm of a tutorial mission was given the frame's word and
  not the row's own hour and weather (`TPS_ROWSET=1`): a mission laid by day was played there at night. It is given both now. (3) `lesson-check` with no
  name walked Training's seven levels: every "ALL PASS (73)" had covered no tutorial level, and a rows note (`rowsWithheld`) never printed. It walks
  `LESSON_MISSIONS` now: 13 levels, 129 checks, green on both stands. `lesson-gate` with no name is still Training's (a tutorial mission is gated by name). Also: a
  `PT_DESTR=1` set by hand in front of `lesson-run` is honoured as the script's own `raises` is (it was read only when the script had raised it).

<!-- added 2026-10-22 -->
- **The tutorial's words were rewritten on 2026-10-22** (the writing guide: `docs/agents/writing.md`). A line, a card or a list row quoted in a bullet above
  is the text as it was when that bullet was written; the level files and `scenarioList.ts` hold today's. Only words moved: no step id, deed, mark, key,
  `allow` / `deny` or order of steps. Tools that matched the old words were moved with them: `rails-check` (the stack's after line, the gate's line),
  `tut-sky-check` (the light card says flashlights), `tut-squad-page.cjs` (the after lines and the side door card's heading, now "An enemy watching a doorway").
  A level file's fingerprint moves with its words, so a checkpoint saved on an older build of a tutorial mission is refused. `tools/qa/writing-check.ts`
  (`probes.ts writing`) holds every lesson's text and every mission row to the guide's patterns; `WRITING_BREAK=1` must fail. Read on the page by nobody
  yet; never seen on a GPU.
- **Mission 1, three play notes (2026-10-23)** (`levels/tut-sky.json`, `rails.ts`, `teampace.ts`, `planmode.ts`). (1) THE SKY SEAT IS DRAWN AS PLAN MODE IS
  ("first tutorial level should have the plan mode overlay"): `RAILS.skyPlan` (a knob of the frame's table, on with the frame; `?skyplan=0`; picture
  only; off for a recording from before the key) → `Rails.planDrawn` → `planmode.ts planView` gives its picture with `frame` true and `up` false (the
  mode itself is down): the frame round the view with its word, each man's ring in his pair's colour, the men the next order goes to drawn full; no
  mark for the parked player, no pick box, nothing of plan mode taught (that is mission 2's). Needs plan mode on in the page (`?qplan=0` takes it away
  with the rest). THE READING TAKEN: plan mode's own picture, not the floor plan's ways shown all the time (those still come with an order and with
  the menu, as in plan mode). (2) THE BREAKER BOX LINE says "A buddy team is going for the breaker box": the order always sent a pair (`workthings.ts`: the
  nearest man works it, the other of his pair covers from behind him — when a cover mark can be reached); the line said one. The scripted player fails the step if the worker has no partner covering. (3) THE SQUAD RUNS
  BACK TO THE TRUCKS ("the guys should sprint back to exfil when they're done"): a step's `onWay: { run: true }` (held by lived-check: tut-sky's row
  moved) → once the step's order is out (`Rails.running`, said once a tick: a man of the squad is under an order to the step's mark) `Rails.runs(gd)`
  is true of EVERY man of the squad an order has sent somewhere, whichever mark the order dealt him → `teampace.ts teamTold`, one more reason to run
  (`'told'`, counted in `TEAMPACE_STATS.told`) under the same leave as the others: a hurt man and a quiet one still walk, A MAN WITH SOMEBODY IN HIS
  SIGHTS DOES NOT RUN (`fight.engaged`, as a run to cover: a runner's gun is low and fires nothing), the last `ORDERS.briskIn` metres are walked in as
  on any leg, and with `TEAMPACE` off nothing changes. `RAILS.wayRun` (on with the frame; `?wayrun=0`; `journal.ts applyKnobs` puts it off for a
  recording from before the key). The line after the order is as it was ("They're falling back to the trucks": true with the switch off too). MEASURED
  headless, seed 1, the page's stand: the leg takes 6.4 s, top 4.7 m/s, 5 runs told. CHECK: `rails-check` lines 'the sky seat is drawn as plan mode
  is' and 'the job done, the squad runs back' (27 lines green on both stands, `RAILS_BREAK=1` fails 19 on both), `lesson-run tut-sky` (the two asserts
  above). NOT DONE: no fight or stealth tally was run for the new reason (it is reached only from a tutorial step). The picture was looked at on the
  software adapter only (the first step: frame, word and four rings, the word clear of the big line): never seen on a GPU, never played by a person.
- **The seven Training lessons are out (2026-10-23, the maintainer: "let's also remove the old tutorials").** The tutorial's six missions (`tut-sky`, `tut-plan`,
  `tut-solo`, `tut-squad`, `tut-quiet`, `tut-pair`) are the only lessons. No switch: a row that is not on the list cannot be switched back, and no rule of
  play changed. GONE: the mission list's Training group (`MissionGroup 'training'`, its heading) and its seven rows (`TRAINING_MISSIONS`;
  `LESSON_MISSIONS` is the tutorial's table now, `lessonGroup` is `'tutorial'` alone); every `scenarios.lesson` block of a `train-*` level (all seven); the levels and
  generators of `train-hands`, `train-lights`, `train-kit`, `train-pairs`; the seven scripted players (`tools/qa/lessons/train-*.ts`); `lesson-page.cjs`;
  their music rows, menu pictures, menu-art pins and menu-shot recipes; the eight recorded sound replays that were a lesson played (the seven, and `whip`,
  which was recorded on the hands lesson's yard), with `tools/qa/tapes/whip.ts`. `lesson-check` and `lesson-gate` with no name now walk the six tutorial
  missions; `verdict-lessons` too, on the page's stand only (a tutorial mission's scripted player is not run frozen; it exits 2 without the word). KEPT, AS
  STAGES FOR CHECKS: `levels/train-move.json`, `train-orders.json`, `train-silent.json` and their generators,
  with no lesson, no row and nothing on a menu that loads them, because checks owned elsewhere are staged on their floors (the hands probes,
  `thrpie-check`, `wordcuts-check`, `teamtally-check`, `takecheck-check`, `savetimeline-check`, `carlamps-check`, `keybinds-check`'s wall line, four page
  looks). A check that started one by its list row finds the row in `tools/qa/yards.ts`. They are bare yards:
  `?levelFile=train-move.json&quiet` still starts a quiet mission on one, AS ANY QUIET MISSION NOW (the fog lever at its default, cameras lent, the kept
  kit card, the levers live): `torch-leak-stills.cjs` and `hands-look.cjs` ask for `quietfog=off` in their links to keep the picture they were written for;
  `shaderwait-page.cjs` and `savetimeline-page.cjs` load the yards as they now open, and none of the four was run on a page since. `tools/levels/train-ground.ts` and `lived-train.ts` stay for them and for
  `lights-out` and `vault`. A YARD WITHOUT ITS LESSON IS READ DIFFERENTLY BY FIVE RULES that ask `level.scenarios.lesson`: the squads' stay-and-ask roll call
  (`stayask.ts`), dozing guards (`doze.ts`), the squad deal (`roomclear.ts` → `squadDeal`), door names (`doornames.ts`) and the solo stand's kit
  (`kit.ts kitSoloStand`); and by the three that ask `LESSON_MISSIONS` for the level (the kit as issued and the levers held off on the page, no fog lever).
  THE SOUND PAGE LOST EIGHT OF ITS THIRTEEN REPLAYS: the thirteen played 66 different sounds between them, the five left play 56, so ten have no
  "in play" replay now (lightOff, grabScuffle, murmur, chokeStrain, chokeLimp, ocp, padBeep, padOpen, launcher, whipThud; `sounds-page.cjs` asks for five); recording the tutorial's missions would bring most back and needs the page bot taught their scripts.
  TAUGHT ONLY BY TRAINING, so taught nowhere now: the squad's 'clear from outside' and the word at a held door; the hold order; bang and clear and frag and
  clear as orders the player gives; go silent / go loud; the empty-hands wall hold and its lean; the sound meter by name; the pace wheel; the launcher's ring
  airfoil; the weapon light; the light jammer (OCP) on a camera and a beam; cameras; dragging and hiding a body; a key taken from a man; parking a partner
  and 'watch him'. CHECKS MOVED TO A TUTORIAL LEVEL OR ROW: `stayask` (d) → `tut-plan`; `solo-fog`'s lesson line, `quietfog`'s lesson cases, `verdict`'s
  row and `pouch-wall`'s lesson level → `tut-quiet`; `sticky-ways`' lesson line → the first quiet tutorial row played alone (`tut-solo`); `lesson-check`'s
  kit lines → `tut-quiet` and `tut-plan` (two that issue no kit of their own and are played as issued); `quickthrow` (5) reads the steps of every tutorial row's level; `levers` and
  `loadbrief` count tutorial rows. DROPPED WITH THEIR SUBJECT: `fresh-start`'s "every Training room clear names its seed", `writing-check`'s held count
  for the Training lines, `keybinds-check`'s two lesson lines (the wall line is kept on the yard), `aimcost`'s `train-lights` leg, `carlamps`'
  `train-hands` row, and the Training rows of `second-way`, `wallfurn` and `kitview-plan`. MEASURED on the build of 2026-10-23 with the corner panel in it, FROZEN and SHIPPED alike unless said (one seed, each check's own): both
  typechecks; `lesson-check` ALL PASS (62); `lived-check` ALL PASS (393); `rails-check`, `writing-check`, `knobs-check`, `dice-check`, `rollback-check
  --static`; `lesson-gate` for the six missions ALL PASS (36: each scripted run, and four dice as the page ships); `verdict-lessons` all six (shipped);
  the 26 probe families the change touched, green but for three lines that were red before it on the build it started from: `missions-list` "every
  mission has a place…" (three blurbs over their cap, both stands), `pouch-wall` "staged: the wall charge…" and `takecheck` "with the rule off…" (shipped).
  `sounds-page.cjs` ALL PASS in a headless browser (one build earlier). NOT DONE:
  nothing here was seen on a GPU or played; of the other page looks only `loadbrief-page.cjs`'s tutorial job was tried (it drew the brief the mended line
  reads, then did not finish in nine minutes on a loaded machine) (`verdict-look.cjs lesson` now puts the mission's frame off, `rails=0`, because the frame
  holds a tutorial mission's end while a step is up; `loadbrief-page.cjs`'s tutorial job reads the scene and what it teaches, which a tutorial row draws in
  place of the job's line and the three cells); the comments across `src/` that say "a Training lesson" for what is now any lesson level were left (about
  thirty).
- **A lesson's words are checked as the page says them (2026-10-23; `tools/qa/lesson-check.ts`).** `lesson.ts lessonLine` turns a level's words by
  pattern where a rule changes a key ('press [Space] … to grab him' is the held left click under `STALK.only`; the knife's lines are the knockout's under
  `CLOSE.noKnife`; `docs/agents/stealth.md`). A line reworded in a level could keep naming the old key and nothing would say so. So `lesson-check` reads
  every line, card, `noTap` and after-line of a level through `lessonLine` with both rules on and fails on one that still names the knife or a key to grab.
  The reading (`namesOld`) is a net that errs toward catching, not a reader of English: the knife by its names (knife, knives, blade, stab, not
  'stable'), and a word for the grab (grab, take or get hold, choke and chokehold but not 'choke point', seize) with `[Space]`, `[E]`, the word space or spacebar in any case, or a
  capital E alone, in the same sentence or the one beside it, the key before the word or after it. A card's title is read alone and together with its
  words (one screen). A wrong catch costs a look and a row in
  the check's `HONEST` list (the line word for word, as the page says it, one row for each stand's wording where they differ; none today); a miss is a dead key on the player's screen. A line of its own at
  the top of the check holds the net to twenty-two lines it must catch and eight it must leave alone, each one a miss or a false catch somebody found, and
  shows the list working: a new one goes there first. The cuts before it, each let through by a review: 'knife' and '[Space] … to grab' only; one
  sentence at a time (missed 'Press [Space]! Grab him.'); the key within four words or the same clause (missed 'Press [Space] behind the far guard to
  grab him' and 'To grab him, press [Space]'). THE REAL MEND CAME THE SAME DAY (the sneak hold thread's half in `lesson.ts`, this file's
  half here): A LINE NAMES THE MOVE BY A TOKEN, `{grab him}`, `{grab him from behind}`, `{knock him out}`, `{take him out}` (the man may be other words;
  a capital begins a sentence; the words each writes are in `stealth.md`, "A lesson line names the move, not its key"), and `lessonLine` writes it out
  for the keys the build has. `tut-quiet`'s grab line, its card, 'drop' and 'strike' are tokens now, and what the page says is word for word what it
  said, on all four of stalk and knife. `tut-pair`'s 'hands', 'hold', 'sleep' and 'drop' moved the same evening (its thread's change), so the
  check's `OWES_TOKENS`, the list of steps let off by name while a level's owner still owed the change, is empty and every tutorial level is held.
  KNOWN AND LEFT: under `?noknife=0` `{Knock him out}` adds "or left click to use the knife", and `tut-pair`'s 'sleep' and 'drop' open only the right
  button, so on that off-switch those two rows name a click the step keeps shut (the page as it opens is right). A token does not read a step's
  allow list; the mend, if wanted, is the plain "Right-click to knock him out" back on those two steps with a row in the check's `HONEST` list.
  THREE THINGS HOLD A TOKEN: (1) `rails.ts
  railsFaults` (so `checkLesson`, on any stand) runs `lessonTokenFaults` over a card's text (to the card's 260), a `noTap`, `menuLine`, `pageLine`,
  `planLine` and both `after` lines as `checkLesson` does over a step's four lines, and refuses a brace in a card's TITLE, which `rails.ts card()` shows
  as written; (2) `lesson-check` fails a brace left in anything the page says; (3) `lesson-check` reads the level's own words with every token taken
  out (`namesByKey`) and fails the knife, a grab beside ANY input (a key in brackets, a click, a mouse button, space, a press, a hold or a tap, a
  capital letter alone), or the blow with an input in its own sentence: 'Hold left click on him to grab him' is true today and false with `?stalk=0`,
  'Right-click to knock him out' leaves the knife out under `?noknife=0`, and only a token says both. A card's title and words are read as one
  screen, the title as written. `HONEST` frees a line word for word (none today). A line at the top plants a bad token in each place `railsFaults`
  holds and wants each back. The net above stays as the backstop for what the page says. ON THE PAGE
  (`tut-quiet`, the software adapter): at 'grab', 'drop' and 'strike' the row and the card read "…sneak up behind him and hold left click on him to
  grab him", "Right click to knock him out", "…then right click to knock him out", no brace anywhere, no page error but the icon's 404.
  No switch (a check, no rule of play). `LESSON_BREAK=words` leaves the two rules off and must fail on a level that teaches the grab: it fails on
  `tut-quiet` and `tut-pair` and passes `tut-solo`, which teaches none. Measured: `lesson-check` ALL PASS on FROZEN and on SHIPPED (69 checks then; 77 with the token lines below). A new
  pattern in `lessonLine` wants its own words added to that line. STILL OPEN, the rails gate's (mine): with empty hands the left button is let through
  wherever `use` is allowed and a grab row is offered, also with a man in the arm; under `?noknife=0` that is a knife before the step that teaches it.
  The page as it opens has no knife, so default play is not touched. Shutting it is a rule on the rails and wants its own switch and `rails-check` line.
- **Plan mode opens on the move (2026-10-23; `RAILS.planWalk`, `rails.ts gate`; mission 2).** The frame's gate held Shift with the command key back
  while a walk key was down wherever a step gave the player his feet (a walk key with Shift is a sprint's, and `CMDRING.planRun` makes the pair the key's
  own order there). Mission 2 gives him his feet and the mode and never his sprint, and from its step `up1` every plan is made at the end of a walk: a
  hand that pressed the pair before it let go of the walk key got nothing at all, with a line on screen asking for exactly that pair. THE RULE: where
  `move` and `plan` are allowed and `sprint` is not, Shift with the command key PRESSED passes with a walk key down too, and the walk keys are taken out
  of that one tick. So the mode goes up (he takes his knee where he is) and the Shift that passes never meets a walk key to run with; Shift with a walk
  key and no press of the command key is dropped as before, and the key kept down holds nobody's feet. The same tick the other way was an old flaw of the
  gate: the pair or the back key that took the mode DOWN let Shift through (the mode was up when the tick began), and with a walk key held that tick was
  a run on a mission that locks the sprint. THE TICK THE MODE COMES DOWN IS ITS OWN RULE NOW, `RAILS.planDown` (`?plandown=0`; same standing as
  `planWalk`; `rails.afterOrders`, called from `Game.step` right after `orders.input`): the gate notes what it let through only because the mode was up
  (the buttons, Shift, the walk keys, each as he may have them without the mode), and if the mode is down once the orders have read the tick, by the
  pair, the back key or any road no key is on (the squad no longer his to order, nobody left to order, a save loaded), those go out of the tick before his feet, his sprint or his trigger read
  them. On mission 2's first step, which locks his feet, that tick was 3.5 cm with a walk key and Shift (1.2 cm with the walk key alone) and a held
  button was his. The first cut guessed that tick in the gate from the keys (the pair's and the back key's only, and only where his feet were his):
  that guess is kept behind `planDown` off, so a recording made on steps 960 to 967 replays as it ran. The pair that puts the mode UP is still read in
  the gate, and only on a press `planInput` would take (no ring up, nothing nearer for the key to back out of). A step that allows `sprint` is untouched (the pair is the key's own
  order at a run, as in any mission). Only `tut-plan` allows `plan` today. The gate takes the walk keys out because `planmode.ts planShift` reads a walk
  key as a run: if that test moves, this rule moves with it. SWITCH: a knob of the frame's table, on in the module as the frame's other rules are and on
  with the frame; `?planwalk=0` = the pair does nothing while he walks (with `planDown` still on the tick the mode comes down is cleaned all the same: `?planwalk=0&plandown=0` = as it was before either); no `FROZEN_HOLDS` row (the frame is off on the frozen stand, `TPS_RAILS=1` raises it and this with it: a
  review asked for a row, and it has none because no frozen digest, tally or fixture is recorded with the frame up, `lesson-run` refuses a rails mission
  on that stand, and the frame's other rules stand the same way; a frozen recording with the frame would want a word for each of the seven);
  `journal.ts applyKnobs` puts it off for a recording from before the key. CHECK: `rails-check`, the line 'the plan on the move' (`tut-plan`, seed 1,
  its first step given `move` as well; the line also reads the level as authored: plan and move given, sprint never). `RAILS_BREAK=1` must fail it.
  MEASURED, seed 1, FROZEN and SHIPPED alike (feet locked, the mode taken down with a walk key held: 0.00 cm by the pair, by the back key and by
  another road, which in the check is the mode put down as a loaded save puts it, `planLoaded`, before the orders read the tick, and a held button not his; both rules off: 3.54, 1.17 and 3.54 cm and the button his; `planWalk` alone, as the first cut: 1.17 cm by
  the back key): 0.75 m walked in half a second, the same with Shift down and with the key kept down as well; the pair
  with the walk key down puts the mode up, on a knee, the step done, 0.07 m of slide after it; the pair again and the back key take it down, no tick at
  a run. Both rules off: the mode stays down and the press is dropped, and the back key's tick is a run. `planWalk` off alone: the pair is dropped the same and no tick is a run. `planWalk` alone with his feet his (the first cut, a recording's): as with both on. The word and the old recording read as said. The
  break fails the line on both stands. ON THE PAGE (`tools/qa/tut-plan-page.cjs`, real keys, the software adapter, `STEPS=5`): at the end of the first
  walk the pair with a walk key still down puts the mode up and him on his knee, 20 lines pass and the page has no error; with `URL_ADD='&planwalk=0'`
  that one line fails. NOT DONE: nobody has played it or seen it on a GPU; the scripted player of mission 2 stands still for the pair, so its runs do
  not pass through this rule.
- **The cigarette's book is the host's (2026-10-23; `smokebreak.ts SmokeShown`, `engine.hostBooks.smokeBreak`).** A man's row in the smoke break's table kept
  `thread` (his thread's source is on the smoke solver) and `left` / `gap` (puffs still to file), and the counts `threads` and `records`: all of it written by
  `g.smoke.drawing()` and by whether the host has a particle pool. So the solver's word was in the game's state: two games that differed only in their
  picture differed in the table, and a save put back (`host/putback.ts` empties the solver) came back saying the thread was still on it, so the thread
  was never filed again. The open fire had the same and moved its book to the host; this is that mend for the cigarette. NOW: those five live on
  `engine.hostBooks.smokeBreak` (a man by his character's id; first a member of its own, `engine.smokeShown`, moved into the one bag of host books that
  `host/putback.ts` drops whole, and `game.ts restartEncounter` now drops the whole bag too: the rows are by id, and a fresh man with the old id took
  the old man's puffs still owed), which no snapshot carries. THE THREAD ALSO LETS GO IN THE FOG (no switch: the picture's only, no state row or digest
  moves): filed in view, it rode his hand on after he was hidden, against 'nothing live shows in the fog'; its track now answers 'gone' while
  `fogOfWar.hidden` has him and one is filed again when he is seen. The smoke already in the air stays the solver's. Checked by the same line
  (`smokebreak-check`, the host's real put-back, the restart, hidden and seen again); never seen on a GPU. AND THE BOOK IS NOT TAKEN AT ITS WORD, which a list of places that drop it
  would be (the first cut of this mend listed three and a review found four more: an encounter restarted, a file loaded, a script's clear, the panel's;
  and the solver drops a source whose `ttl` ran out, or the first look-only one off a full list, with no word to anybody). The solver asks every source
  it holds where it is, every step, so the thread's own track stamps the book, and a thread nobody has asked after for `SMOKEBREAK.threadGone` frames (30)
  with a solver drawing is filed again; each filing has a number and an older one answers 'gone', so there is never more than one. `putback.ts` still
  drops the book (the puffs owed were the abandoned moment's, and the thread is back at once), as does the switch going off. The game's side keeps the
  clock, the lights (the meter reads those) and the counts that hang on nothing of the host's; `smokeBreakStats` no longer makes a row by being read, and
  `resetSmokeBreak`, which nothing called, is gone. No switch: no rule of play changes and nothing reads the book back. CHECK: `smokebreak-check`, whose
  stand-in solver now asks its sources every step as the real one does, two new lines: the game that smoked on a solver for twenty seconds and the one
  nothing drew differ in no line of the table's (read by `rollback.ts stateAlike` since the lighter compare: the check's peak fell from 1.1 GB to
  0.36 GB; that the man's row and the counts ARE read is shown by changing a number in each by hand, which must give a line); and one thread rides his hand again, never two, after the solver
  is cleared, after the source is dropped without a word, after the book is dropped, and after `restartEncounter` with the order given again. Before the
  mend the first failed on `stats.threads`. MEASURED, seed 7: 10 of 10 on FROZEN and on SHIPPED, `SMOKEBREAK_BREAK=1` fails 8 on both; `rollback-check`
  on SHIPPED and its static pass, `lived-check` 393, `lesson-gate tut-quiet` on SHIPPED all pass. ON THE PAGE (`tut-quiet`, the software adapter, the
  real solver, the court's man told to smoke where he stands): one thread filed in eight seconds and one on the solver, its stamp the current frame;
  the solver cleared, none two frames on, and sixty frames later a second filing and one on the solver; no page error. SEEN ELSEWHERE: `snowBreath.ts` kept the same word in its table (`stats.why`, `steam`, `steaming`, a man's `steam`; its owner
  moved that book to the host the same day, today `engine.hostBooks.breath`), which is why the check first read this file's rows out one by one: the
  whole-state diff stopped at that table. NEVER SEEN ON A GPU: the thread itself has not been looked at by anybody, before or after.
- **The step before a card settles (2026-10-23; `RAILS.cardBeat`, `rails.ts settles`, `lesson.ts tick` / `settling`; every tutorial mission).** The
  maintainer, off mission 1's Doors card over the fight at the gate: "we show the modals too quickly. like it should happen a beat after something happens
  on screen. in this case my squad covered the gate but then seeing them shoot the bad guys got interrupted by the modal. i've noticed this as a consistent
  theme". A card pauses the world the tick its step comes up, and a step came up the tick the deed before it was done: the middle of whatever that deed
  set off. Now a step whose NEXT step opens on a card stays up after its deed is done (`StepSeen.doneT`: the deed is done once and never asked for
  again) for `cardBeatSecs` (1.2 s). Then the next step comes up exactly as it always did: its card, keys, cue, checkpoint and mark on one tick, nothing
  of it ahead of its card. Meanwhile the done step's big line is something to watch (`prompt()`): its own line where the step only waited for the
  level's script (mission 1's "They're holding the gate"), else what its men are doing (its `after` line, where its order went out and the line asks
  for no key), else no line at all (`index.html #railprompt .line:empty`), and its mark is not drawn. What he does in the beat is the done step's:
  the next step counts from the tick it comes up, as every step always has (an afternoon's cut carried those deeds forward, and a step could then be
  done before its card was read, its cue a tick after the last one's). A step moved by hand (`Lesson.i` set by a tool) drops a latch, and a held
  time, that were another step's (`doneI`).
  TWO WORDS ARE THE CARD'S OWN, in the level (`scenarios.ts explain`, `levelData.ts`, `docs/level-format.md`):
  `explain.quiet: true` — the deed before this card sets off a fight he is there to WATCH, so the card also waits while that fight is on: a round of
  his own or his squad's, a blast, a door kicked in or a man going down in the last `cardQuiet` 2 s, never past `cardMax` (9 s) from the deed. Rounds
  of the other side alone hold nothing (a level's staged fire never stops: mission 1's opening files five a second). Mission 1 marks all three of its
  cards after the first (Doors after the gate's fight, Walls after the kitchen, Light after the wall is blown): there he is in the sky and the fight is
  the squad's. `explain.now: true` — no beat at all: the squad mission's 'back' ("They're behind you!"), whose news is the fight, and its 'frag',
  whose cue keeps the gunner down from the tick he reaches the blocks. A card with both words is a fault of the level (`levelData.ts`).
  WHY THE FIGHT'S WAIT IS ASKED FOR AND NOT THE RULE (it was the rule for an afternoon, and a review took it apart): where he is the one shooting and
  the next step is his next move in that fight (the squad mission's blocks, then the frag), a card held for his own rounds held its keys and its cue
  with it for up to nine seconds with no line on screen. The first cut of all held only the card's picture (the step up, its card, line and mark
  withheld): a step finished inside the wait lost its card for the run, and the step's cue ran ahead of its card.
  THIS MOVES TICKS: on a tutorial mission a step that opens on a card, and with it the level script's cue and the step's checkpoint, comes 1.2 s after
  the deed (a `quiet` card: up to 9 s). A script that needs its cue on the deed's tick marks the card `now` or puts the cue on the step before. The
  beat is the step's whether or not the page then shows the card (one read already on this page, `?cards=0`, a run with no page): a second pass meets
  the same pause with no card after it. He can go down inside the beat: the deed is then not kept by a checkpoint and is done again.
  SWITCH: `RAILS.cardBeat`, OFF in the module and on the frozen stand (`FROZEN_HOLDS` 'RAILS.cardBeat': `TPS_CARDBEAT=1` raises it there, and it acts
  only with the frame up, `TPS_RAILS=1`: a frozen run that raises the frame alone plays every step the tick the deed is done, as its fixtures were
  recorded), ON in the page and on the shipped stand; `?cardbeat=0` (headless: `TPS_CARDBEAT=0`) = the next step the tick the deed is done;
  `journal.ts applyKnobs` puts it off for a recording from before the key.
  CHECK: `rails-check`, the line "the step before a card settles", which raises the rule itself (a plain card on a quiet floor and under his squad's
  fire, a deed of his in the beat not carried on, the script's own line kept, a step moved by hand; a quiet card on a quiet floor, his squad firing,
  the other side alone, his fight begun after the deed, the cap, a man down; `now`, a step with no card after it, the switch, how each stand comes
  up, the word, an older recording); `RAILS_BREAK=1` fails it on both stands. `lesson-run` (and the tapes' copy of its loop) waits a settling step
  out after the script's own half second, and its "went by with nothing done" guard also stops on a step found settling; `rails-check` line 14 reads
  the step after the whistle a beat later.
  MEASURED: MEASURED_HERE
  NOT DONE: Tab's objectives card and the small objective row still read the done step's ask while it settles; an order given in the beat still snaps
  to the done step's mark. The other missions' cards are plain (the beat): which of them follow a fight he only watches is their parts' to mark.
  Never seen on a GPU; nobody has played it.
