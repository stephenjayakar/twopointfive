# Stealth and what you see

One of the area files CLAUDE.md indexes. Everything below was moved here word for word from CLAUDE.md on 2026-10-13, in its old order;
"the bullet above / below" in a bullet means its neighbour there (each block says which lines it was), and a bullet named by its bold
title may now live in another file of this folder: `grep -l '<title>' docs/agents/*.md`. New bullets for this area go at the foot of this file.

<!-- was CLAUDE.md lines 1541–1610 -->
- **Fog of war as a cone, on hard** (`src/game/fogofwar.ts`, 10-10; the maintainer: "fog of war being 360 degrees around the players isn't quite realistic. it really should just be the
  cone they're looking at" — "the status quo is fine for normal difficulty"; page rebuild/fog-cone/read-first.md): `FOG.cone` (off = the fog all round every eye, the base by
  run digest) makes each of the fog's eyes a wedge of `FOG.coneDeg` 120 about his GAZE (`gazeOf(c)`: the head, eased onto the aim with a long gun in the shoulder) plus `coneNearM` 1.5 m all round;
  `inField` is the one CPU test (`seen / drawn / hidden` read it), fogofwar.wgsl's `fowSeen` the picture's (the wedge test before the ray; `coneSoftDeg` / `coneNearSoftM` = a soft edge, picture
  only; FogFrame `softIn / softOut / nearSoft`, the block 192 B). WHO SETS IT: `difficulty.ts setDifficulty` writes `FOG.cone = coneVisit ?? (level === 'hard' && HARD.cone)` — hard only;
  `?fogcone` / `?fogcone=0` and the Tab row hold it for the visit (`setConeVisit`). `FOG.own` (off; Team feel 'fog ▸ only my own eyes (option)', kept per machine, `?fogown`) = only the player's
  eye lifts the fog, on any difficulty. THE CALLS (`FOG.calls`, on; only while cone or own is on; `?fogcalls=0`): `tellCalls` at 10 Hz on its own clock — a teammate with a line (his own eye, his
  cone) to a man the player's eye has not had inside `callKnown` 3 s says 'contact left!' / 'behind us — contact in the hall!' (sides off the PLAYER's shoulders in his room, else the place), a step
  in a teammate's ears (roomfight's `stepBy`) from a man no eye has = 'movement …'; one man per `callSecs` 10, one call per `callGap` 3; through `cues.call(gd, text)` = the cues' own bubble + a
  class-1 strip row (logged as kind `'call'`, never `'heard'`; silent under `?nocues`) — never `Guard.bubble`, no dice, not in checkpoints. The enemy's AI never reads the fog; the team's and Sam's readers of `seen / hidden` (rescueflow `sees`, shutdoor, pairorders,
  he40, close, the reticle, say's bubble-or-log) get the cone's answer on hard: 24 of 26 scripted hard runs digest as the base's, the consulate rescue's two differ with the same end. QA
  `probes.ts fog-cone` (in family `fog`), `node tools/qa/fog-cone-stills.cjs --out DIR` (three stills of one staged frame on the software adapter: team cones / all round / own eyes). The
  warehouse pick has one difficulty (no cone from its card). Never seen on a GPU.
  **A DOOR THE SQUAD WORKS IS SEEN** (`FOG.squadDoors`, `squadDoorsM` 2: ON in the page — `?squaddoors=0` — OFF on the frozen stand, `TPS_SQUADDOORS=1`; a `FROZEN_HOLDS` row, a recording from before the key replays with it off; Tab ▸ 'fog of war ▸ squad's doors are seen'; the maintainer, 10-11: "if teammates open a door to clear a room while you're not looking at it, their movement is visible, but it looks like they're walking through a closed door. we should be able to see actions that our squad takes"): `FOG.doors` brought a leaf up to date only inside the fog's own EYES, so under 'only my own eyes' — and for any teammate past the five eyes or looking elsewhere under hard's cones — the men walked through a leaf still drawn shut (records, own eyes, an ordered 'open and clear' with Sam's back turned: stale up to 37 s, men through the drawn leaf on 7 doors of 8). Now `doorSeen` also takes any living, unblinded teammate within `squadDoorsM` of a leaf point (where it stands or where the picture has it) with a line from his head to it, whichever way he looks. A leaf only: no man and no floor is seen by it. `bun run tools/qa/squaddoors-check.ts [level.json] [--doors N] [--seed N] [--verbose] [--trace]` (`probes.ts squaddoors`, in family `fog`; both stands; `SQUADDOORS_BREAK=1` must fail). The check rolls its OWN dice (`--seed`, 1: it read the same alone and inside the family only by luck before) and counts a stale leaf twice: in all (any frame — which includes the fog rightly remembering a leaf that moves with nobody of the squad in reach) and AT THE DOORWAY (a living man of the order within a metre of the doorway's middle and the leaf drawn more than 0.15 rad from where it stands); the bound is on the second (a fifth of a second) and on nobody walking through a leaf drawn shut; `--trace` names who stood there and whether he had a line.
  **A MAN THE SQUAD IS SHOOTING AT IS IN THE PICTURE** (`FOG.squadFire`, `squadFireSecs` 1: ON in the page — `?squadfire=0` — OFF on the frozen stand, `TPS_SQUADFIRE=1`; a `FROZEN_HOLDS` row, a recording from before the key replays with it off; Tab ▸ 'fog ▸ squad's targets are shown'; the maintainer, 10-11: "in fog of war mode we should still see enemies when your squad is actually shooting at them. otherwise it feels a bit weird to see them shooting at nothing"): `update()` reads each teammate's count of aimed rounds (roomfight.ts `Op.rounds`, read only) and stamps the man he is on (`Op.tgt`) when it rises; `firedOn(gd)` holds for `squadFireSecs` after the last round and is one more term of `drawn(gd)`. He is DRAWN, not SEEN: `seen()` and all that asks it are untouched (no laser, the calls still call him, nobody's AI learns anything); the reticle, the rows and his bubble take him as a man lingering; dropped by those rounds, his body stays. Only that man, only while the rounds go: a gun held on a man without firing shows nobody. WHERE IT MATTERS, measured (hard, the shipped stand, the scripted commander, compound / Mousehole / glasshouse × 4 seeds, `PT_FOGFIRE=1` on playthrough.ts → `fogfire` in the run's JSON, tools/qa/fogfire-watch.ts): under 'only my own eyes' 113 of 123 aimed teammate rounds went at a man out of the picture, 0 with the rule (the runs themselves play the same); on hard's shared cones 0 of 89 either way (the shooter's own eye has him — there the rule adds only a second after his gaze leaves, and covers a plume, a blinded shooter, a man past the fog's five eyes). NOT COUNTED, by choice: rounds into cover a man is behind (coverfire.ts: 21 of the 144 rounds in those runs), blind bursts, a drill's staged exchange, a teammate on the alert AI. `bun run tools/qa/squadfire-check.ts` (`probes.ts squadfire`, in family `fog`; both stands; `SQUADFIRE_BREAK=1` must fail). Never seen on a GPU: he is drawn as dimmed as anything in the fog.
  **NOTHING LIVE IN THE FOG (10-10, the maintainer: "seeing the furniture move in rooms behind fog of war also gives away information" · "curious if there's a better
  systems approach to make it so fog of war doesn't leak information"):** the invariant = a pixel nobody on the team sees is made only of the static level and of things as
  the team last saw them, held where the picture's inputs come in rather than kind by kind. `FOG.things` (ON wherever the fog runs; the frozen harness stand pins it off — `TPS_FOGTHINGS=1`, one of `FROZEN_HOLDS`' rows: the cursor's ray otherwise turned Sam's facing a few degrees in 2 of 26 frozen play-throughs; `?fogthings=0`, Tab ▸ 'fog of war ▸ nothing
  moves in the fog'; off = the list as it was) = `fogOfWar.things(dynBoxes)` at THE ONE SEAM where game.ts hands the frame's dynamic boxes to the renderer: boxes grouped into
  things by `Box.mkey` (a prop = id, an item = serial; `THING_BITS`), a thing handed over live only where `spotSeen` (the picture mask's own test: an eye's field + a level line
  through statics and leaves) has the floor it is on; moved unseen = the copies taken when it was last seen at rest; never seen / last seen in flight / its remembered place
  looked at and empty = not in the picture; unkeyed one-frame boxes (a tracer's streak among them) only where seen; a long thing counts as seen where its middle or either end is (`thingSeen`: it is rigid); what
  men carry, leaves, wall devices and the moths pass (`thingKeyOf` = −1; a broken fixture's body — fixtureBreak.ts's six `hang` boxes — is one thing, each piece that came off it a thing by itself, seen where it lies); the first 30 updates of an encounter
  (or after the switch comes on) take the floor as it stands. IT REWRITES THE LIST IN PLACE (the headless harness re-points `world.dynamics` at `game.dynBoxes` every frame), so
  a reader of `g.dynBoxes` after drawCharacters sees the picture's list (`Game.dynRaw` = the game's own count before the rewrite, which edgeLook.ts budgets by), and so does
  `BoxWorld.raycast`: the cursor's ray lands on the thing as drawn (1 of 26 shipped Standard run digests moves — Sam's yaw for twelve seconds of block-squads:1 — off = the base
  26 of 26), a decal on a remembered thing is hidden while it is remembered, and a tripwire's DRAWN beam ends on a remembered box — its SENSOR does not: while the fog runs the sensor's reach (devices.ts `LaserRt.sense`) is asked of the statics, the leaves where they stand and the props, not of this list (devices sense under the fog only on a quiet mission's rung or a solo `?fow`; never in a team scenario). Not in checkpoints (a load re-primes). `FOG.flat` (0 = off = ships;
  `?fogflat[=0.2]`, Tab ▸ 'fog of war ▸ own light') = the radiance half: fogofwar.wgsl takes the G-buffer albedo (group 1 binding 5) and an unseen pixel is that paint under one
  fixed light (`soft.w`, exposure divided out) instead of the live frame dimmed — no lamp, weapon light, flash, smoke or particle shows in fog; never seen on a GPU. NOT HELD:
  edits to the static level made unseen (decals, a wall or pane coming apart, a fixture's lamp with flat off). QA `probes.ts fog-things` (in family `fog`; its leak watch counts
  box moves in the handed list out of the team's sight: 0 with the rule, thousands without).
- **A quiet mission can be played under the fog of war** (`src/game/quietfog.ts`, `QUIETFOG.on`: ON in the page — `?quietfog=0` = the lever greyed on a quiet row and no rung read, as it was —
  OFF in the module and on the frozen stand, `TPS_QUIETFOG=1`; a `FROZEN_HOLDS` row, in the knob registry and a journal's tables, a recording from before the key replays with it off; no Tab
  row). The maintainer, 10-11: "stealth missions don't have fog of war" · "i think we should make it part of the fog of war difficulty slider" · "will need to playtest a bunch". On a QUIET
  mission's row (not a Training lesson's) the mission sheet's and the loadout's fog lever is live and has one more rung at the bottom, OFF — every guard shown, the game as it was
  by run digest, and where every quiet mission started until 10-13 — under the squad lever's three (all round · cones · own eyes). WHERE A QUIET MISSION STARTS (`QUIETFOG.def`; the maintainer's
  pick, 10-13: "i think it should be fog + teammate (maybe they have some way to see each other's headset camera, like the sticky cams) + we find a way to balance sticky cams"): `'team'` in the
  page = the fog all round the player and, as two, his partner (the partner's eye is one of the fog's own: what he sees, you see), with the mission's sticky cameras on the rifle (the next
  bullet) — `?quietdef=off` = `'off'`, every guard shown on a bare link, as before; `'off'` in the module and on the frozen stand, `TPS_QUIETDEF=team`; a `FROZEN_HOLDS` row, a recording from
  before the key replays with `'off'`. A Training lesson stays `'off'`. A link and the machine's store say only what DIFFERS from the default: a bare quiet link IS the default,
  `quietfog=off` = every guard shown, another rung = that rung; a pick equal to the default is not kept. EVERY SHIPPED-STAND QUIET RUN IS NOW UNDER THE FOG (each `standUp` under
  `TPS_PROFILE=shipped` raises the default again: a check that wants every guard shown pins `QUIETFOG.def = 'off'` after each stand, as quietfog-check and sticky-check's older probes do;
  `probes.ts sticky-default` = the default itself, on every quiet row of the list). IT IS THE QUIET MISSIONS' OWN PICK (`quietFog / setQuietFog`, kept per machine
  under `twopointsix.quietfog`, one pick for every quiet mission): what the machine keeps for the squad lever (`difficulty.ts SET.fog`) is not put on a quiet mission and the quiet pick is not
  put on a squad one. Moved off the default, a quiet row's link carries `quietfog=off|team|cones|own` (`quietFogHref`, called by ui/missions.ts `missionHref` and the loadout's Deploy; `scenarioList.ts
  quitSearch` takes a rung off every other link, as it takes `way` off), `scenarioRun.ts fogOfQuery` is then true (`quietRungOfQuery`) and `startFromQuery` lays the rung on the fog's two
  rows FOR THE VISIT (`quietFogStart`: `FOG.cone` through `difficulty.ts setConeVisit`, `FOG.own` directly; `?fogcone` / `?fogown` on the same URL speak over it), let go of by
  `quietFogEnd` at the quit, a refusal or the next start. The fog's eyes are its own: the player, and the partner of a quiet mission as two (own eyes: the player alone). ui/levers.ts
  `paint(live, structure, quiet)` shows the off button only on a quiet row. THE SQUAD'S LEVER WHILE A RUNG IS HELD (the sheet opened from the pause card of a quiet mission under the fog):
  every read of the squad lever off the fog's rows and every press that writes them goes through `quietFogAside(fn)` (levers.ts paint / press / `leversSig` / `leversOpenOn`, missions.ts
  Standard | Hard, its A / D keys and its links; the loadout's, the short list's and the start page's reads of `difficultyNow / leversMixed / leversLine / difficultyHref / leversHref` — unwrapped, a kept AI lever beside a held rung read as all of Hard and D dropped the kept levers; the aside may nest) — the rung's hand off the rows for `fn`, laid again on what it left — so a squad row lights the squad's lever, a press there never moves the mission being played, and the
  quit puts back what it wrote (a new UI site that reads or writes the difficulty tables wants the same; the debugger's rows are 'moved by hand' and are not wrapped). The quiet row's own pick is the
  NEXT deploy's (the link), like Hour and Weather: the mission being played keeps its rung. `difficulty.ts coneVisitNow()` = the visit's cone pin, read so the quit puts it back. `bun run tools/qa/quietfog-check.ts` (`probes.ts quietfog`, also under `fog` and `quiet`; passes on both stands,
  `QUIETFOG_BREAK=1` must fail): the query rule, the store and the links, the real screens on a fake DOM, a run alone (bazaar) and as two (quiet-yard) at each rung, over a kept squad lever,
  the sheet opened while a rung is held, no rung = the same digest, a checkpoint saved under the fog alone. A TRIPWIRE UNDER THE FOG SENSES THE FLOOR AS IT STANDS (devices sense in a quiet mission; they do not in a squad's): while `g.fogOfWar.active`, devices.ts `updateLaser` takes the sensor's reach (`LaserRt.sense`) off `g.col.raycast` + the props — statics and leaves where they stand — and the DRAWN beam (`cut`) is left as it was (the picture's boxes, and props and men where they stand); no fog = one reach, as it was (not asked there: loose debris and a dropped item). KNOWN, each for the playtest: on a rung a guard out of the fog's eyes who notices the player shows no bubble and no marker (cones and own eyes play much harder than a squad mission's); a checkpoint does not carry the fog's memory (a load re-primes: for a moment the floor is as it stands); wall devices (cameras, tripwire
  emitters) are handed to the picture in the fog as they always were. Never seen on a GPU, never played by anybody.
- **Sticky cameras + the three ways to see in stealth** (`src/game/stickycam.ts`; `STICKY.on` — ON in the page, `?nosticky` = no card row, no load on any rifle, no eye; OFF in the module and
  on the frozen stand, `TPS_STICKY=1`; a `FROZEN_HOLDS` row, in the knob registry and a journal's tables, a recording from before the table replays with it off; with none carried on = off by
  run digest). The maintainer, 10-12: "i think we do really need to figure out if you get omniscience in stealth levels or not … maybe a limited number of sticky cameras or something like
  that would work". THE THREE WAYS, each a link of the same quiet mission (since 10-13, his pick — the bullet above): the fog and cameras (NO KEY: the default, `STICKY.issue` 2 on the rifle) ·
  the fog alone (`cams=0`) · all guards shown (`quietfog=off`; no camera). Under `?quietdef=off` they are as first built: all shown with no key, `quietfog=<rung>`, `quietfog=<rung>&cams=N`. On the mission sheet and the start page's rail a quiet row has a `Sticky cameras` lever row under the fog's (ui/levers.ts: `None` | `2`, `data-lever="cams"`,
  not one of the three difficulty levers; shown only on a quiet row; `quietfog.ts setQuietCams / quietCams / quietCamsOfQuery`, kept under `twopointsix.quietcams`): pressing `2` from all
  shown raises the fog to the squad's rung with it, the fog put back to off lets the cameras go (a camera shows nothing without a fog: the row reads `None` there; with the cameras the default they come back with the fog unless `None` was the pick, which is kept), `quitSearch` takes `cams` off. `cams=N` is the
  MISSION's issue (`stickyVisit(g)`, per Game, written by scenarioRun.ts): the player is handed at least N whatever his card carries, free; a card's own cameras (`MemberKit.cams` 0‥3, the
  kit card's 'Sticky cameras' row, any mission) cost a pouch each (slots.json `stickyCam`). THE CAMERA is the rifle launcher's THIRD load (`RifleAttachment 'cam'`, only on a rifle handed
  any: 2 again with the rifle up steps ring → 40 mm → camera; RMB held previews, letting go sends it — `fireCam`; count `Rifle.cams`, HUD tag `CAM ×n`): it flies flat at `aimY` over the
  cursor's spot and STICKS to the first static it meets (a wall, a pane, built-in furniture); off a leaf, a prop or a man it drops to the floor under where it struck; a camera whose wall
  goes (a blast, a pane broken) drops too (asked once a second by a short ray). Stuck, it is ONE MORE EYE OF THE FOG (`stickyEyes` → fogofwar.ts's eye list, ids 200 +; on a wall a wedge
  of `fovDeg` 110 about the normal (160 until 10-13), the fog's own cone width while `FOG.cone` is on; lying flat all round; the newest served first inside `FOG_EYES` 5; `max` 3 on the walls at once, one more
  retires the oldest). ONE LIVE FEED (`STICKY.live` 1 — the balance his pick asked for; Tab 'cam ▸ live feeds' 1‥3; `live` = `max` and `fovDeg` 160 = the cameras as they first shipped, and a recording from before the key replays so): only the newest `live` stuck cameras SEND (`stickyLive(pl)` → `stickyEyes`); the others stay on their walls, dark — a second camera is a second LOOK, not a second eye, so two cameras are no longer a floor's worth of coverage left behind — and a sending camera's lens is drawn dull red (`LENS_LIVE`), a dark one's black. The sheet's row says it in one line (levers.ts `CAM_WORDS`, a tooltip). MEASURED on the maintainer's 253 s police-post tape (`sticky-cover.ts --tape`; of the moments a guard stood within 12 m with no line to him, the share the cameras gave back, as first built → now): two cameras placed as well as possible 19.8 % → 15.0 %, two at the nearest walls 15.3 % → 7.5 %, three placed well 25.6 % → 17.2 %. Nobody on the floor notices one and nobody picks one up (open calls); its only cost in play is the launcher's small noise and a tick where it sticks ('prop' events).
  Per-player state on the Player (`Player.cams`, `camSeq`), no dice, a checkpoint slice (`stickySnapshot / stickyRestore`; one in flight refuses a plain save, a forced one files it back on
  the rifle; the slice carries `camSeq`, the run's count of camera ids, so an id is never handed out twice). KNOWN: a card with no rifle gets no camera, the mission's `cams=N` included (the camera is the
  rifle launcher's load: the row still reads 2); a squad of four under the team's fog fills the fog's five eyes, so a camera there lifts nothing (`STICKY_STATS.blind` counts those frames). A camera's lens is drawn red only while the fog took it as an eye THAT frame (`stickyBoxes` reads `fogOfWar.eyes`: black with no fog up and past the five). The mission's cameras are handed only where the fog is up (`?quiet&nofow` = none) and are let go of BEFORE a quit's stop (its restart kits the fresh player); a kept 'None' survives all shown under `?quietdef=off` too. KNOWN, left: an old kept rung or `quietfog=team` link with no `cams` key now gets the cameras (they come with the fog); 'newest' is firing order, not sticking order. The debrief says 'placed a sticky camera' (a 'thrown' row of kind `cam`; the thrown count and the par clock are untouched). Tab ▸ Player & weapons ▸ Sticky cameras.
  QA: `bun run tools/qa/sticky-check.ts [kit|fly|fog|save|ways|default|off]` (`probes.ts sticky`, in all-quick; both stands; `STICKY_BREAK=1` must fail), `PORT=<dev server> node
  tools/qa/sticky-page.cjs` (the real start page, no GPU: the Sticky cameras rail row, its links, none on a squad row, none under `?nosticky`), `bun run tools/qa/sticky-cover.ts --tape <F7
  replay> | --ghost <level> --seeds 1-3 [--live N|all] [--fov deg]` (how much of the guards each way shows over a recorded or scripted run; `--live all --fov 160` = the cameras as first shipped). Page rebuild/stealth-sight/read-first.md. Never
  seen on a GPU, never played by anybody: the wedge, the count and the flight are first-pass numbers.

<!-- was CLAUDE.md lines 1758–1766 -->
- **A stuck camera is taken back and used again** (`STICKY.take`, `stickycam.ts stickyRows / camToTake / takeCam`; 2026-10-16, his "probably being able to
  retrieve and reuse them"). ON in the page (`?camtake=0` = a camera sent is a camera spent, as before), OFF in the module and on the frozen stand
  (`TPS_CAMTAKE=1`); a `FROZEN_HOLDS` row, rides the STICKY table of a journal (a recording from before the key replays with it down), Tab rows 'cam ▸ take
  back' and 'cam ▸ take reach (m)'. THE RULE: your OWN nearest stuck camera (never one in flight) within `takeReach` 1.3 m of your feet on the plan, with a
  clear line from your eyes to its lens (`col.solidBlocked`: not through its own wall), hands free (not hauling, holding a man, sprinting, mid-takedown) and
  a launcher on the gun, is ONE interaction row, 'sticky camera / Space  take it back' (kind `'cam'`, verb `'takeCam'`); from `NEARBY_M` it is a marker that
  says 'step closer' ('hands full' at it with a body, a man or a sprint). The panel draws one row more when a camera's row is listed (overlay.ts `cap`). The row is listed PAST the `MAX_NEAR` rows Space had before it (player.ts `isOwn`, like a door charge by hand): it takes no row from a
  door or a man and is the bare tap's row only when alone. A tap is instant (game.ts, by the breaker's): the camera leaves `Player.cams`, `stickyIssue` puts
  one more on the rifle (the 'cam' load is listed again if the last was sent; never past `STICKY.carry`), a 'prop' tick at his feet (`takeNoise` 0.1, under
  the landing's 0.12 and over the 0.08 a calm man hears from: one within about 2 m turns to it), `STICKY_STATS.taken`. Its eye goes with it, so with one live feed the camera sent before it sends again. No height limit (a 2.5D
  floor: the plan decides). No new state: a checkpoint already carries the cameras out and the count. NOT DONE: no hand animation (handwork.ts), no debrief
  row, teammates take none. CHECK `sticky-take` (families `sticky`, `selector`; `STICKY_BREAK=1` must fail; both stands): far = nothing, the far side of its
  wall = nothing, in sight past the reach = marker only, at it = the row, switch down = no row and the same 300-step digest, the tap, the reuse (a new id,
  the guard shown again), a dry load loaded again, sprinting takes nothing, the stands' row and an old recording. Never seen on a GPU, never played.
- **The mission's own wand + the fog fairness measure** (`QUIETFOG.wand`, `quietfog.ts quietWand(g)`, read by `kit.ts kitPlayer`; 2026-10-16, his "we do
  need to balance the stealth missions for fog of war ... lean on sticky cameras" and "same goes for optical wand"). ON in the page (`?quietwand=0`), OFF in
  the module and on the frozen stand (`TPS_QUIETWAND=1`); a `FROZEN_HOLDS` row, rides the QUIETFOG table of a journal (an older recording replays with it
  down), Tab row 'cam ▸ mission wand'. THE RULE: a quiet mission that hands out its cameras (`stickyVisit(g) > 0`: started under the fog, not the fog alone
  `cams=0`, not a lesson) puts an optical wand on Sam whatever his card carries, with the wand's own switch up. NO STATE OF ITS OWN: the cameras' visit is the
  mission's, so every place that lets go of the cameras lets go of the wand (`?nosticky` takes both). A card whose gun has no launcher gets the wand without
  the cameras. A CHECKPOINT does not speak for a lent wand (`savestate.ts`: the `wand` field is not written while `quietWand`, and a file that says none
  never takes the mission's off him). The fog lever's cameras row says the wand comes with them (`levers.ts camWords`). NOT DONE, sent to their owners as
  claims: the Team & kit card and the kit figure read the CARD only (a lent wand shows nowhere there, and a card wand on a quiet row still costs a pouch).
  ON THE FROZEN STAND the word alone does nothing: it needs `TPS_QUIETFOG=1 TPS_QUIETDEF=team TPS_STICKY=1 TPS_WAND=1` beside it, and a solo quiet mission
  there is kitted only where the card is worn (`kitSoloIf`). CHECK `sticky-wand` (families `sticky`, `quietfog`;
  `STICKY_BREAK=1` must fail; both stands). THE MEASURE: `bun run tools/qa/sticky-cover.ts --all-quiet --listed | --seeds 1-9 [--meetings] [--loud] [--fov deg]
  [--carry n] [--live n] [--md file]` walks a ghost (invisible, upright, shortest way, ALONE; he PICKS AND KICKS doors and the shift hears it) through every
  quiet mission on the shipped stand and scores each aid off the same walk: MEETING = a CALM guard's first sample within 8 m with a line (a man roused in
  the 4 s before is dropped and counted apart; `--loud` = the old count); SURPRISE = no eye showed him 0.5 s in the 4 s before, which is 'FIRST SEEN CLOSE',
  NOT 'UNFAIR' (it counts a man Sam's own eye picks up at 6-8 m). `--listed` = the mission as the list deals it (no pin + the same-start rule = always
  start / spot / patrol 0); `--seeds` are PINNED variants a player reaches only by URL. Cameras and the wand are MODELLED (never fired, no time cost:
  take-back is an upper bound); placements BEST (knows the patrols), AHEAD (knows his own way: the realistic one), NAIVE. `--meetings` prints every meeting,
  the ghost's door verbs and the guards' state changes. LISTED, 7 levels, 10 meetings (6 more dropped as roused): first seen close under fog alone 8 ·
  cameras AHEAD 8 · the wand 4 (panned 3). NINE PINNED DEALS, calm, of 107: fog 71 · cameras taken back AHEAD 61 (BEST 43) · wand 46 (panned 32) · both
  AHEAD 40 (BEST 22). CAMERA NUMBERS LEFT AS THEY WERE because none moves it (measured on the first, loud count of 121: as shipped 71, a 160° lens 69,
  three carried 71, three wide all sending 67; with the wand 44 / 42 / 44 / 40). Tables: `rebuild/stealth-sight/fog-fairness-2026-10-16-v2-*.md`
  (the first loud tables beside them, no `-v2`). Lights-out's two listed meetings are a sentry at 8.0 m and a walker through a window at 6.6 m (the level's
  own warning, the missions thread's read); the bazaar's one is the alley trap at 4.6 m; the police post's four dropped are the shift running to the keypad
  door the ghost kicks. Not measured: a second man's eye, crouching, waiting; nothing seen on a GPU or played.
- **The solo night opens under the fog of war** (`QUIETFOG.solo`, `quietfog.ts soloFogRow / soloFogLink`; from the solo night's kit screen, where the cameras
  tile read "2 · no use here" and the wand's "no use here": "for the solo night missions we should have fog of war! then you really need the sticky cams").
  What was there: the fog is raised by a LINK and only a room clear's, a rescue's or a quiet mission's rung did (`scenarioRun.ts fogOfQuery`); the solo
  night's link is `?solo` with no scenario on it, so the plain night always ran with every guard shown, and `ui/loadout.ts` left the solo row out of the
  quiet fog's row by name. The rule: the solo night's own link (`solo`, and none of quiet / roomclear / nightbreach / rescue / squad4 / demo / breach beside
  it, never a lesson's level) is read as a quiet row's — the same rungs, the SAME pick this machine keeps for its quiet missions, the same default
  (`QUIETFOG.def`: all round, with the mission's 2 cameras and its wand), `quietfog=off` on the link = every guard shown, `cams=0` = the fog with none.
  The screens: the solo row has the fog's lever and the Sticky cameras row (the defenders' two levers stay greyed: its shift is the level's own); the kit
  screen's cameras and wand tiles read the mission's instead of 'no use here'; the solo night's no-load start off the start card (`MISSIONS.startSolo`) is
  taken only where the page already stands in the link's fog (`scenarioRun.ts sameFog`) — off a plain page the solo night under the fog is a load of
  `?solo`. NOT touched: a page stood up plain (the floor under the title, a showcase, a harness game with no link staged) has no fog, as before; the
  guards, their eyes, their numbers and the level. Neighbours' files touched, each a line or three: `scenarioRun.ts` (quietLike, sameFog),
  `ui/loadout.ts`, `ui/missions.ts`, `game/loadout.ts` (the note's words). Switch: ON in the page (`?solofog=0`), OFF in the module and on the frozen stand (`TPS_SOLOFOG=1`); rides the
  QUIETFOG table in a recording, one from before the key replays with it off. Checks: `bun run tools/qa/probes.ts solo-fog` (family `solofog`,
  `tools/qa/solofog-check.ts`, `SOLOFOG_BREAK=1` exits 1) and the real page `tools/qa/solofog-page.cjs` (the start page's rail and the
  kit tiles; then `?solo` in play on the software adapter). 13 verdicts now, a restart among them. On the frozen stand `TPS_SOLOFOG=1` alone raises
  nothing: it reads the quiet fog's own rows, so a frozen run of the solo night under the fog is `TPS_QUIETFOG=1 TPS_QUIETDEF=team TPS_STICKY=1
  TPS_QUIETWAND=1 TPS_SOLOFOG=1` (and the wand's own word) with `?solo` staged. Older checks that state the solo night as it was hold the switch
  down for that row or follow it (`missions-probes`, `loadout-probes`, `kitlent-check`, `quietfog-check`; `levers-probes` follows it). KNOWN, LEFT:
  (1) the old start card's own Start (`?cards`, `ui/menu.ts`) closes the card over the plain page: a solo night with no fog, as it was; the starting
  page's solo row is the fogged one. (2) `?solo&levelFile=<level>` is read as a solo night too and gets the fog, though the mission list has no such
  row. (3) Alone, the rung 'own eyes' plays as 'cones' does. (4) `tools/qa/solo-night.ts`, the tour and the soak play a game stood up PLAIN: their
  tallies, on either stand, are of the solo night with every guard shown, not of the page's fogged one. (5) The kit note reads 'Alone on the office
  floor.' under the fog (`game/loadout.ts noteOf`), its old second half where it is off. Measured on the bundled office, one seed, both stands. Never
  seen on a GPU and never played: whether the office night is fair under the fog with two cameras and a wand is unmeasured (the quiet missions were
  measured with `tools/qa/sticky-cover.ts`; the solo night was not).
- **Your own stuck cameras show in the fog of war** (`STICKY.mark`, `stickycam.ts stickyBoxes / stickyMarks`, drawn by `ui/overlay.ts` as `.cammark`;
  2026-10-17; the maintainer, from play on the vault, quiet, hard, the fog's cones: "nit, you should be able to see your sticky cameras in fog of war").
  WHAT WAS THERE: a camera's two boxes were unkeyed, so the fog's rule for loose things (fogofwar.ts rule 4d) handed them to the picture only on floor an
  eye of the team sees. The one camera that sends is its own eye and stayed; a DARK one (the older of two, `STICKY.live` 1) on floor nobody watches, or
  behind his back under the cones, was not drawn at all — and a fist-sized dark block under the fog's dim reads as nothing anyway. What a sending camera
  sees already lifted the fog (its wedge is one of the fog's eyes); that part is unchanged.
  THE RULE: up, (1) a camera's boxes, in the air and stuck, carry a wall device's key (`MKEY.device + 0x800000 + id × 2 + part`; fogofwar.ts `THING_PASS`
  lets that class through wherever it is — his own, it gives nobody away), so it is always in the picture, fired into the fog included. KNOWN, LEFT: a
  camera on a wall that is blown out where nobody looks is seen to drop live in the fog (it is heard to, and it is his); (2) while the fog
  is live the HUD puts a small lens on each stuck camera of his (`stickyMarks(g)` → `{ at: the lens, sends }`; a ring, brighter with a red pupil on the one
  that sends), so he finds them to take back and reads which one is the feed. No mark with no fog up, none on one in flight, none off screen (no edge
  clamp), none on a viewer's picture with the fog lifted; the use key's own dot is not drawn inside a marked camera's lens. Picture only: no step reads it, the run digests the same down and up.
  THE SWITCH: ON in the page (`?cammark=0`), OFF in the module and on the frozen stand (`TPS_CAMMARK=1`; `FROZEN_HOLDS['STICKY.mark']`); in the knob
  registry with `STICKY`; a recording from before the key replays with it down (journal.ts); Tab ▸ Sticky cameras ▸ `cam ▸ shown in the fog`.
  THE CHECK: `bun run tools/qa/probes.ts sticky-mark` (family sticky; `tools/qa/sticky-check.ts mark`), 10 verdicts on both stands, on the vault
  under the cones: the dark camera on unseen floor has 2 keyed boxes in `Game.dynBoxes` with the switch up and 0 down; the marks at each lens with the
  sender told apart; none in the air, none with no fog; the same digest; the stands' row and the journal. `STICKY_BREAK=1` exits 1 on both stands.
  `tools/qa/sticky-page.cjs` counts the `.cammark` elements on the real page (software adapter). NOBODY HAS SEEN IT ON A GPU OR PLAYED IT: the size and
  colour of the lens mark are a first guess, and whether the camera's own block reads under the fog's dim without the mark is not known.
- **A peek round the end of a wall lifts the fog of war** (`PEEKSIGHT`, `src/game/peeksight.ts peekEye`, one line in `fogofwar.ts update` where the player's
  eye is listed: `wandEye ?? peekEye ?? own`). From play (the police post, quiet, hard, the fog's cones): "peeking around a door … should let you see down the
  hallway". What was there: the wall hold's peek (`player.ts moveOnWall`, `Player.wall.peek`) moves the camera's look-at and cranes the neck, the man stays on
  the wall, and the fog's eye for him stayed over his feet looking off the wall into his own room, so the camera showed a hallway under the fog. The rule:
  while the peek is in, his eye for the fog stands where a head leaned round that end would be (`out` 0.3 m past the end of the face, `off` 0.1 m off the
  wall's plane on HIS side of it, never through it; his own eye height, crouched too), looking `turnDeg` 90° round from along-the-wall, square into the
  opening (the look turns by angle, by way of along-the-wall); it rides the peek's own ease in and out; it REPLACES his own eye for that time (one head, no
  eye slot taken from a camera: under the cones the room behind his shoulder goes back under the fog but for the near field); a solid in the lean's way (a
  leaf across the end, a pane) stops it short. The place is measured from where he actually stands, so on the rifle stack (`WALLSNAP`, he really steps out)
  the step-out is not counted twice, and there the look stays the rifle's. What it sees through a doorway: square through and a wide wedge either side; back
  along a hallway BEHIND his own wall only as far as the wall's thickness lets a head by the frame see (about as far back as the hallway is deep), no more.
  **Not changed: what anybody else sees.** Guards' eyes go by his real head and chest, which stay on the wall (on the stack they really are out, and seen), so
  a back-to-the-wall peek exposes him no more than it did; a head that is out being a head that can be seen is a change to what guards see and is the
  maintainer's call, not built. Nothing in `player.ts` or the wall hold's files is changed. Known, not mended: the hold let go at full peek (stepping out
  round the end, Q) puts the eye back over his feet in one frame, and on a face barely longer than he is wide the peek can change ends while still in: the
  mask jumps, as the camera's look-at does. With a partner, the team's calls are told from this eye too (`tellCalls` reads `eyes[0]`). Switch `PEEKSIGHT.on`:
  ON in the page (`?peeksight=0`), OFF in the module and on the frozen stand (`TPS_PEEKSIGHT=1`), registered in `knobs.ts`, in `JOURNAL_KNOBS` (a recording
  from before the table replays with it off); Tab rows under Fog of war: 'a peek lifts it', 'peek ▸ head out (m)', 'peek ▸ off the wall (m)', 'peek ▸ look
  round (°)'. Check: `bun run tools/qa/probes.ts peek-sight` (family `peeksight`; `tools/qa/peeksight-check.ts`), 12 verdicts on the police post with the
  real keys (Q, then pushed into the end beside the open front door): the eye's place and height, its look, the floor and a guard 2.5 m through the doorway
  seen up and not down, open floor hard behind his wall seen neither way, his head still on the wall, crouched, let go = his own eye, four seconds of the
  held peek with guards live digesting the same down and up (solo), the rifle stack (place asked of a man stepped 0.6 m out; the look his rifle's), the
  stands' row and an old recording; `PEEKSIGHT_BREAK=1` exits 1. Measured on one level, one doorway, one seed, both stands. Not asserted: an outside corner,
  a leaf across the end, the cones off, the ease mid-way. Never seen on a GPU and never played: `out`, `off` and `turnDeg` are first guesses, and how the
  mask's sweep reads as the peek eases is unjudged.
- **Interaction = rows + one Space grammar** (`player.ts buildInteractables` → `Game.nearby` / `hover`; `interact.ts`): every verb is
  its own row (`Interactable.verb`: a shut door = `push` + `ease`, a lock = `pick` (+ `rattle` crouched) + `kick`, keyed = `unlock` +
  `ease`, guard behind = `grab`, held arm = `question` + `choke`, held gun = `whip`, body `drag`/`drop`, rack `drive`, breaker), top
  `MAX_NEAR` (3) by `interactOrder`; TAP Space = the highlighted row, HOLD ≥ `TAP_SECS` opens the list (`Player.sel.open`, a `cancel`
  row, feet frozen, wheel / ↑↓ move `nearSel`), RELEASE performs it, Esc backs out (`Game.escape()` before the pause menu). The
  performed row is `Game.act` for that frame, read by updateHold / updateDoors / updateMission where the key used to be read. Sustained
  verbs (`Player.easing`, `picking`, `Hold.windT`→choke/whip, `mission.driveT`) run on their own; `interact.ts cancelSustained` on a
  fresh Space press / Esc / a movement key pressed INTO them (`sel.moveLatch`). Scripts: `game.selectVerb(kind, verb)` then a one-frame
  Space (`input.pressed.add`). Probes: `probes.ts selector` (rows / input / sustained / noise, frozen against the old held-key build).

<!-- was CLAUDE.md lines 1886–1928 -->
- **Devices** (`src/game/devices.ts`, `Game.devices`, LevelData `devices[]` — docs/level-format.md *Devices*): wall CAMERAS see Sam through the guards' own
  eye test (`guards.ts eyeContact` — canSeeChar's body factored out; `GUARD_EYE` = the man's numbers, a lens adds `vHalfDeg`) and HIS light meter (`lensGain`:
  sightGain's light × distance × crouch × smoke, no motion / keen / hunt terms); an integrator of lit-seconds → control's radio + the nearest calm man sent
  (`sendToLook`: `GuardTask 'device'`) at `tune.cameraSuspicionSecs`, the floor up a step (`raiseEscalation` cause `'device'`, fix broadcast) at
  `tune.cameraAlarmSecs`. KEYPAD doors: `Door.lockId` = the pad's name is the link; `Player.codes` (learned: dialogue intel `'code'` → `learnCode`, or the
  ambient `'pin'` pair overheard through `col.sound` → `overhear`); rows `code` (sustained, `Player.coding`, `CODE_SECS`) / `nocode` + kick, `padState` is the
  one test. LASER tripwires: `bodyBreaks` (capsules vs the beam) for Sam / the hauled body, item flight segments; staff never trip. Cameras + emitters are
  `LightTarget` kind `'device'` (OCP / a round / the mains via lighting.ts `factor`; `alive()`); everything drawn as dynamic boxes (`deviceBoxes`, the beam via
  combat.ts `beamBoxes`). Live play only (`sensing`: aiEnabled, !quietUtility, tune.devices) — under the tour they pan and glow, silent. Knobs `tune.devices /
  lasers / cameraSuspicionSecs / cameraAlarmSecs / deviceCones` (Tab ▸ Sandbox, persisted `twopointsix.devices`). The office: three cameras, `pad_side` on the
  server room's SIDE door (the front door keeps key / pick / kick — guard-key, dialogue and debrief probes are frozen on it), a shin beam across the corridor at
  x 14.5, a chest beam across the storage doorway (corridor face — a beam ENDS at the first solid thing in it, leaves included, for the picture and the sensor alike). QA: `probes.ts devices` (camera / keypad / laser / editor / vision — the last a frozen digest of the guards' own canSee
  off main), the soak's device invariants; editor tools C / K / J + `__ed.device`.
- **The wall hold's feel pass + the rifle stack** (`src/game/wallsnap.ts` = the table `WALLSNAP` and its arithmetic, nothing of the game imported; the hold itself is player.ts
  `findWall / wallSnap / moveOnWall / releaseWall`, the pose character.ts `wallBody / stanceBody`; `WALLSNAP.on` ON in the page — `?nowallsnap`, Tab ▸ Sandbox 'wall snap: feel
  pass + rifle stack' and 'wall snap: the rifle stacks', `__wallsnap` = the live table — OFF in the frozen harness, `TPS_WALLSNAP=1`; off = the hold as it was: no feel-pass field
  on `Player.wall`, the animator's channels at rest). QUIET (hands empty / the pistol): the take runs one clock sized to the job (`wsTakeSecs`: 0.12‥0.30 s by glide and turn),
  eased OUT, the turn ahead of the glide, the soles anchored in the world and stepped one after the other (`anim.wallTake / wallTakeFeet`), a settle as the back lands
  (`anim.wallHit`: pelvis dip + head back) with one soft scuff for the player's ears only (no event filed); a wall he WALKS AT is in reach from `reachMoving` and outranks a nearer
  one he is passing; Q pressed `buffer` early still takes it (`wallSnapLater / wallSnapPending`; dropped, with its words, the moment a frame goes to something else — a takedown, a man in his arm, a kick, a lock: the buffer's clock is the game's, so no stale key is honoured when that beat ends); the way off is `wallStepOff` (Q with a direction held walks on that frame, the stick held away needs `awaySecs`, Q alone = a hand off the plaster; the pose leaves at `outRate`). THE STICK IS THE CAMERA'S (`alongDeg` 55; the maintainer, 10-10: "i'm getting snapped off Q when trying to move around"): a stick within 55° of the wall's own line SIDLES him and is never 'held away', however the camera is turned — only one nearer square-out lets go, and only while it CAN sidle him: at the end of the run or against a man an outward diagonal is 'away' again, the way off round the corner; 0 = the rule before it (along only when that share beat the square share, away from half a stick outward: under a camera 35° to the wall the key that mostly ran along it threw him off in 0.18 s, `awayDiag`). LOUD (`WALLSNAP.stack`, the rifle in his hands when Q goes down):
  `WallHold.kind 'stack'` — the rifle stays in his hands, stance 'stack' (shoulder to the wall, facing along it), `lowLong`; `stackUp` = a click raises it for `upSecs`; the click is HELD through
  the `upRise` it takes to come up (through `pl.equipT`, then handed back to the fire sites as `input.clicked`: no round leaves level from the thigh) and once up every click fires
  that frame; nothing where `bore` metres of the line are in the wall (no round, one line); `stackLean` = parked at an OPEN end, the cursor's
  point further round the corner than he already sees (`wsCornerAngle` vs `wsSeenDeg` + `leanOnDeg`, hysteresis `leanOffDeg`, dwell clocks, `minOut`, `afterShot`) steps him out
  `leanAlong` past the end with the rifle in the shoulder, and back when it returns; a point landing above `leanOverY` (a wall's top, a lintel — what the camera sees from his
  side) is read where the cursor's ray comes down to chest height; never where the first `leanClearM` from where he would stand is shut (a shut door); a reload brings him in; E
  on the stack slings it and the hold becomes the back hold. THE RIFLE IN HIS HANDS ON THE WALL IS THE STACK HOWEVER IT GOT THERE (`WALLSNAP.stackDraw`, player.ts `wallStacks`): 2, or E with it selected, on the back hold brings it up and he stacks where he stands (it used to say 'in hand once off the wall'); any other item chosen on the stack slings it, he is back on the plaster and that item waits for the step off (a hold that was the stack keeps its step-out through the change: 1 then 2 while out round a corner stays on the wall); with `stackDraw` (or `stack`) off 2 on the wall is the older answer; a recording from before either key replays with `alongDeg` 0 and `stackDraw` off (journal.ts). THE CAMERA HOLDS STILL THROUGH A STEP-OUT (`wallSnapCam` gives back the share of the step HE REALLY TOOK — `WallHold.leanOff`, which a man or a wall past the corner cuts short — that the look-at would follow):
  `stackLean` reads `g.aimPoint`, which hangs on the camera, and a camera that followed him fed the test its own output — with the mouse held still he stepped out and back for
  ever (`wallsnap-cover` holds it with the cursor fixed on the SCREEN, also with a man stood where he cuts the step short; a probe that re-projects a world point every frame cannot see it). Once out, the far limits give (`leanKeepDeg` / `leanKeepDist`). THE OLDER `wall-snap` FAMILY passes on either stand: `wall-snap-release` asks its three lines about the OLD way off (Q alone, the stick held away, a short tap away) with the switch pinned off for those lines — with it on Q alone leaves a push, the stick away lets go at 0.1 s and a 0.17 s tap away lets go, which `wallsnap-off` holds. Nothing is held down. QA `probes.ts wallsnap` (camera — 24 camera yaws × 8 key combinations, `WALLSNAP_BREAK=1` must fail — / kit / take / landing / reach / off / stack / cover / off-same / duo — the
  last with the two-person-stealth partner following, pairup-probes.ts's rig), `bun run tools/qa/wallsnap-strip.ts [--out dir]` = stick-figure strips of the take, the stack and
  the step-out, `tools/qa/wallsnap-trace.ts` = a take frame by frame. Never seen or heard on a GPU: the camera offset, the scuff and every pose are numbers only. THE HOLD'S POSES MENDED (`WALLSNAP.pose`, on; acts only with `WALLSNAP.on`; a key of its own so that a recording from before it replays with the poses it was made with: journal.ts; no URL flag, no Tab row, no stand row of its own; the maintainer, 10-12: "snapped to wall animations could also use some work, looks weird when crouched in particular"; numbers `character.ts WALL_POSE.mend / .gait`, each a [standing, crouched] pair): (1) THE ARMS hang beside the hips — `wallArms` took its hand marks so far along the wall that a CROUCHED man's upper arms stood 48° / 52° out from his sides with the elbows bent 75‥79° and 0.81 m apart (a man carrying two buckets); now 19° / 26°, 27‥29°, 0.53 m; standing the elbows come in 0.62 → 0.55 m and bend 41° / 38° → 35° / 29°. AND THE HANDS (the maintainer, 10-12, on a still of the standing hold from above: "the hands on walls do look kinda weird"): every finger was fanned (fingertips 1.31 × as far apart as the knuckles) with the elbows cocked out into the room — a splayed glove held off each hip; now the fingers lie side by side (0.99) with a resting curl, index least and little finger most, the thumb turned up beside the index and out of the plaster (its tip was 2.3 cm IN the wall's plane, now 1.8 cm clear: `WALL_POSE.mend.fan / curl / thumb / thumbIn`), the marks no higher than the hip joint (`mend.up`: the arms hang nearly straight — lower still and the standing arm is out of reach and locks dead straight) and the elbows back toward the plaster (`mend.elbow.room` < 0); the check prints the fan and the deepest fingertip's or thumb tip's distance off the wall's plane and holds both. (2) THE SIDLE IS A SIDE STEP OF ITS OWN, STANDING AND CROUCHED (`WALL_POSE.gait`, `share [1, 1]`; a share of 0 = that posture's legs are the clip's again): the hold used to play the walk cycle turned 55° to the wall — standing, a cross-over walk (one ankle passing 41‥44 cm beyond the other along the wall every stride); crouched, a lunge along a wall he has his back on, the rear knee 12 cm off the floor every step, the pelvis bobbing 5 cm. Now each foot keeps a track of its own along the wall (standing 0.17 and 0.30 m off the plaster, crouched 0.20 and 0.36), the lead foot reaches and plants, the other closes up to it and NEVER CROSSES (closest 6 cm standing, 10 cm crouched), a planted foot travels at the ground's speed (1‥3 cm over the run, ≤ 1.2 mm a frame), heel off about the ball, the knees a little toward the room, the pelvis level (bob 2 cm standing, 1 cm crouched) and the head no higher than it was; its clock is the animator's own `wallGait` (signed by the way he goes, eased to a rest phase `WALL_GAIT_REST` when he stops), so setting off, stopping and turning round mid-stride do not pop: worst foot pop (a second difference of its place per frame) 3.5 cm against the old path's 36‥48 cm, worst hips / head / hand jump 3.1 cm against 5‥6. Crouching or standing up while sidling blends the two by the crouch shown. THE CADENCE IS THE HOLD'S PACE OVER THE STEP (1.4 m/s standing, 1.3 crouched — player.ts's, untouched — over `gait.step` 0.36 / 0.34 m = about 3.8 footfalls a second: a quick shuffle; a calmer one is the hold's pace, the hold owner's call). `probes.ts wall-pose-mend` (tools/qa/wall-pose-probes.ts `wallPoseMend`, also under `wall-snap`, `wall-pose` and `player`; passes on both stands — it raises `WALLSNAP.on` itself; `WALLPOSE_BREAK=1` must fail); mesh sheets `bun run tools/qa/pose-mesh.ts operator_1 wall | wall-crouch | wall-sidle | wall-crouch-sidle | wall-crouch-sidle-l | wall-crouch-creep --at <secs> [--set '{"WALLSNAP":{"pose":false}}']`. Not touched: where he stands, the pace, the take, the rifle stack's stance. Judged from the maintainer's recording, offline mesh renders and numbers only — never seen moving on a GPU; notes rebuild/cast-faces-and-moves/wall-hold/notes.md.
- **Whistle** (`whistle.ts`, V — player.ts calls `whistleKey` right after the meter's decay, so it works anywhere but down): `tryWhistle` pushes
  GameEvent `'whistle'` (level `WHISTLE.level` 0.35, at Sam's feet, `who` PLAYER_ID) once per `cooldown` (2 s), ticks `player.noise`, plays sfx
  `'whistle'` (two notes 1.1 → 0.9 kHz, 0.36 s) at his head; no HUD line. guards.ts `hearingCheck` hands the kind to `hearWhistle` inside `WHISTLE.horizon`
  (12 m straight): resolved ONCE per event against every living man (`resolve`, WeakMap on the event) — heard iff `propagate(mouth, his head).pathLen <
  reachK (8) × carry × keen` (8 m direct, 5.76 routed-open, 2.56 through a shut leaf); the NEAREST hearer that `canAnswer` (patrol/suspicious, not held /
  scripted / on a `task`, hostile to Sam) ANSWERS: suspicious, awareness ≥ 0.45, `lastKnown` = the heard-at point (`prop.via`), reactT 0.5, a `LOOK_LINES`
  bark, no radio, and the torch STAYS in his hand (`whistleSoft` → `handCarry` 'torch' in 'suspicious', upper `WHISTLE_SOFT_UPPER`) until a step / glimpse /
  slam lifts his awareness past 0.47 or he alerts; other calm hearers glance (`whistlePatrolTick` cranes `lookYawExtra` 1.5 s); alert / search men take it as
  a fix (lastKnown, no bark). The same man answering again within `twiceWindow` (60 s) → `'search'` round the point (`TWICE_LINES`). Per-man memory in a
  WeakMap (`whistleMem(gd)`), `WHISTLE_STATS` / `WHISTLE_LOG` for QA, `whistleSummary` on the panel; knobs level / reachK / cooldown / twiceWindow in Tab ▸
  Sandbox, kept per machine (`saveWhistle`, localStorage `twopointsix.whistle`). QA: `probes.ts whistle` (reach open / far / shut vs open door with the
  propagation's numbers, nearest-only, twice, cooldown, alert cue, meter, torch kept, invisible), soak stimulus `whistle` (`--whistle-per-min`, 0 = the old schedule).

<!-- was CLAUDE.md lines 2486–2549 -->
- **A guard has one attention, and it can be taken** (`src/game/attention.ts`, table `ATTENTION`; `ATTENTION.on` — ON in the page, `?noattention` = the
  build as it was; OFF in the module and on the frozen stand, `TPS_ATTENTION=1`; a `FROZEN_HOLDS` row, in `JOURNAL_KNOBS`, `applyKnobs` puts it off for a
  recording from before the key; the maintainer, 10-13: "we can try to play with some mechanics where guards' attention could be redirected elsewhere (e.g.
  apollo robbins psychology stuff) but we should make sure it's legible and fun"). WHAT TAKES IT: a small thing that makes a CALM man look (`able`: patrol or
  suspicious under `calmAw` 0.6, no body duty / task, nothing choreographed; and no squad on the floor — `!fightLive(g)` — or a QUIET mission, `g.quiet.active`,
  which is how it acts on quiet as two: on a loud squad map the rule stands off and those runs are what they were) — a whistle he answers, a door, a carton shot off a shelf, a light gone
  out in his view, and a LURE: `GameEvent.lure` (set on the ring airfoil's clack, launcher.ts `clack`) lifts a calm hearer to `drawAw` 0.34, over the 'huh?'
  line — without the switch the clack (level 0.3) peaks at 0.17 and moves nobody. A faint knock nobody made to be looked at (who 0, no flag: a chair a door
  swept) is NOT a lure. guards.ts `hearingCheck`'s `small` hands every small thing to `attentionHeard`; `attentionTick` (once a frame, after his state has
  answered) makes the taking when the thing became his fix. FOR HOW LONG: whole while he walks to it (`walkCap` 15 s), then `whistleSecs` 4 / `noiseSecs` 5 /
  `doorSecs` 4 / `lightSecs` 5 AT it, looking at IT (`dwellSweep` 0.3 rad, not the old 1.1 rad look round the room); `tellSecs` 0.8 before the end he says he
  is done ('must have been nothing' moves here from the walk back, under guards.ts's own rules for that line: never by a known body, on top of his radio
  line, with Sam down). WHAT IT COSTS HIM: outside `focusDeg` 25° of the line from his eye to the thing a man's sight rate is × `sideK` 0.3 (`sightGain` /
  `sightGainOn`, before the point-blank floor: arm's length is never dulled) and writes NO fix; a footfall at his ear × `earK` 0.5. IT BREAKS on `breakGain`
  0.2 of awareness glimpsed at the edge in sum ('—wait.' / 'what—', the glimpse is then his fix), on a footfall that does reach him, on anything that takes
  him over `calmAw` (a slam, glass, a body: 'roused', no line of this file's). A man still at his own business under a hold (a lent one, a head a light
  turned: state 'patrol') has no sum: the hold breaks when his awareness itself is at `breakGain`, with no line. NOT A FOOL: each taking inside `memorySecs`
  60 of the last is × `wearK` 0.6 as long and he says so ('again?' in place of the 'huh?': guards.ts asks `attentionAgain`), the `spent`-th (3rd) is a
  search of the place; things inside `sameSecs` 2.5 of each other are ONE happening (a canister's bounces, a dragged body's scrape) and get one taking however
  long they go on; a whistle keeps whistle.ts's own 'twice'. SHOWN (`attentionMarks` → `src/ui/attentionviz.ts`, the overlay's `#traj`): a dotted amber
  thread from the man to the place and a ring there that runs down like a clock once he is at it, part-spent from the start when worn, flickering for the
  last beat; nothing of a man the fog of war hides; no word, no number. FOR OTHER FILES: `attentionLend(g, gd, at, { ears?, noises? })` called every frame a
  standing claim holds (a man at a lit screen, headphones = the lender's two numbers): the same narrowing and mark, a real thing takes it over, and a man a
  glimpse or a step took off it stays off `lentBackSecs` 6 — its caller is doze.ts's man at his screen (the guards-in-the-dark goal's), who lends 1 and 1
  and keeps his headphones in his own ear numbers. A lend counts only if renewed since the man's last tick (there is no call to take one back: stop
  calling, and it is over inside two frames). Per-man state in a WeakMap, in the checkpoint (`savestate.ts` `attention`: a lent hold and the lend under it
  too, so a loaded man at his screen has no frame of a whole eye); the lines (12, placeholders for the writing pass) through `simRandom`. Debugger: section 'Attention (a guard has
  one)' — the switch, the marks, seconds at a noise, eye to the side. CHECK `bun run tools/qa/probes.ts attention` (tools/qa/attention-check.ts, 28 lines,
  green on BOTH stands; `ATTENTION_BREAK=1` must fail — line (l): with the switch off and every number scribbled, a lender claiming him, a lure, a footfall
  and a lit man at his side, the run digests as the untouched table's). MEASURED (office, Kowalski, one seed a line, headless): a clack 5 m ahead → walks
  3.9 s, at it 5.00 s, told 0.78 s before the end, the mark up 534 of 534 frames; a man lit 0.45 standing 3.1 m off at the edge of his eye: no fix for
  2.67 s and CONTACT at 3.70 s, against 0.02 s and 0.95 s with the switch off; a walking step 3 m behind him unheard (heard with it off), a running one
  breaks the hold; second clack 3.0 s with the ring from 0.60; third = search. A spot to try it + a scripted run: `tools/qa/attention-spot.ts` (quiet-yard.json, the gate Sam
  comes in by, Sam on his own feet with W A S D, 3 seeds, alone and as two: with the rule on he crosses five metres in the held man's view unfound on 3 of 3;
  a knock that moves the base build's man too finds Sam on 2 of 3 with it off; meter pinned at 0.35 the hold breaks at 3.9 s of 5). UNDER THE FOG OF WAR
  (shipped stand) the marks are up only while somebody on the team sees the man: alone at that spot 289 of 494 hold frames, as two 494 of 494. NOBODY HAS
  PLAYED IT and the marks have NEVER BEEN SEEN ON A GPU (the page was driven on the software adapter only): every number is a first guess, the amber and
  the line weights are guesses, the lines are placeholders. Not built: a pocket noisemaker without the rifle, a partner's whistle on order, needs trips
  (coffee, a smoke) as holds — page `rebuild/guards-attention/read-first.md`.
- **Closer than ever = the close-in mode near a man** (`src/game/close.ts`, `Game`-keyed state in a WeakMap, `__close`; `CLOSE.on` — ON in the page (`?noclose`), OFF in
  the module and on the frozen harness stand (`TPS_CLOSE=1`; one of `FROZEN_HOLDS`' rows, in the knob registry and a journal's tables; off = the build as it was by run digest, and
  nothing of it runs under a show: `closeLive(g)` = on ∧ !touring). The maintainer's spec (10-09): the animation changes on entering the mode, the character changes again in melee
  reach (he REACHES for his knife — never draws it), melee from all angles, the grab only from behind, and the sneak holds its pose when movement stops. THE MODE (`closeMode`,
  `modeNow`): within `modeM` 3.0 m of a living man or civilian with nothing solid between (kept to `modeOutM` 3.6; never with the rifle up, sprinting, on the wall hold, holding /
  dragging, kicking, picking, down) → `anim.creep` / `creepAt`: character.ts `creepLayer` (the changed carriage) + `creepGait` (the HELD gait: stopping leaves him in the stride he
  was in, a tap advances it, the idle's weight shift and foot lock stand down while `crT` > 0). THE TELL (`closeReady` → `anim.ready` 'strike' | 'grab' | 'seat' | 'grabGun'): in
  reach, from any side, the right hand goes to the SHEATHED knife on his chest (`anim.reachShown`; rigProps `RIG.sheath`, `sheathBoxes`, `RigOpts.sheath`), behind him the free arm
  reaches too; the knife (`anim.knifeShown`, `KNIFE_TAG` boxes) is out only inside a lethal blow. THE BLOW IS A CHOICE (`CLOSE.lethal`, `closeLethal`): hands empty in reach, LMB =
  the knife (`strike(kind, true)`; `killGuard(…, 'shot', 'player', 'knife — dead')` = a kill on the card worded 'killed — the knife'; a witness saw him DROPPED, not shot), RMB =
  the knockout ('struck'); a civilian is never knifed. THE WINDOWS (`closeWindows` / `closeAt` = the ONE test the rows, the click, the pose and the optional floor marks share):
  behind (the build's rear arc cos < −0.25, reach 1.05) = grab on Space + blow; sides (0.95) and front (0.85) = blow only (`CLOSE.side / front`; from the front he gets a sound out:
  `CLOSE.noise`), a seated man's longer rear reach (`closeSeat` stages one; panel buttons); an alert man can be struck (`alertStrike`), never grabbed. A strike-only man's line has
  no verb: it sits UNDER the rows Space can do (player.ts buildInteractables) and never takes the default highlight. THE DARK (`closeNearK`, the one hook in guards.ts `sightGain`):
  the build's near-sight floor (a shape inside 1.8 m in his view is seen whatever the light, rate ≥ 3.5) is scaled by the light on SAM — none under `darkAt` of his meter, whole
  from `litAt`, whole for a man alert / searching and inside `touchM` 0.55; Sam only (the pair's partner keeps sneak.ts's own rule and waits short). `player.visibility` is the GPU
  meter: headless feed it (close-probes do); in the page a room lit only by the men's own torches reads 0.17–0.45 on Sam between them (bounce), 0.85+ in a beam. Floor marks
  (`CLOSE.marks`, overlay `.closewin`) ship off. Tab ▸ 'Closer than ever' section. NOT saved in checkpoints (the mode's hysteresis and the held gait's clock restart on a load). QA:
  `probes.ts close` (14 probes incl. close-off = the switch off is the build, close-duo = beside a partner under `PAIRUP`; rides all-quick), `bun run tools/qa/ready-pose-probes.ts
  poses | ease | identity | knife | creep | gait | strips --out DIR` (the animator alone: identity hash = the base's with nothing asked).
- **Close-up takedowns as moves** (`src/game/takedown.ts` = the game's half, `character.ts` `BLOW` / `TAKEN` / `KNIFE_SLASH` + `blow() / taken() / takePre / blowTrunk / blowArms /
  takenLayer` = the poses, `Character.fallAs / breathe` + `guideStep / breathFrame` = the fall and the breath; `TAKEDOWN.on` — ON in the page, `?notakedown` = every takedown as it
  was; OFF in the module and on the frozen stand, `TPS_TAKEDOWN=1`; a `FROZEN_HOLDS` row, in the knob registry and a journal's tables, a recording from before the table replays
  with it off; halves `blow / victim / fall / partner / breathe / lower`; Tab ▸ Player & weapons ▸ 'Takedowns (the blow, the fall, out cold)'). The maintainer, 10-12, with three clips of
  Splinter Cell: Chaos Theory: "we can probably polish the animations more". The clips cut into beats: rebuild/takedowns-like-chaos-theory/clips/moves.md (stills
  stay in the project folder, never in the repo). NO RULE MOVES: no key, reach or clock; the blow lands and the man is out on the frame he always was, the die is drawn as often
  (`bun run tools/qa/takedown-check.ts` holds it move by move, off against on). WHAT IT IS: THE BLOW (`takeBegin`, player.ts right after the strike it asked for; `BlowStyle` by
  the side and the hand: `chop` = the knockout from behind — free hand on his back, fist cocked high, chopped down on the base of the skull; `palm` = the knockout from a side or
  the front — heel of the hand up under the chin, the other arm thrown back; `mouth` = the knife from behind — the free hand over his mouth, head hauled back; `sweep` / `slash` =
  the knife from a side / the front, across the throat; every one opens with a rise out of the crouch) · THE MAN IT IS DONE TO (`anim.taken`: `arch` back onto the knife man's
  shoulder; under the PARTNER's hands `hunch` / `snap` from the frame the partner's blow lands, `TAKEDOWN.partnerHit` 0.3 s into the takedown's own 0.6 s — he used to stand frozen
  until he dropped) · THE FALL (`takeFall` / `partnerFall` set `Character.fallAs`, read ONCE by `ragdollize`: `fold` forward knees then face (hit from behind, the pistol whip) ·
  `topple` stiff backward (the palm) · `cut` stands a beat, knees, sits, rolls (the throat) · `sink` down where he stood, on his side (the knife from behind, the choke's end); `cut`
  and `sink` are LED by a pin on the neck for under a second — `FallGuide`, let go the moment a haul's pins take the body; the quiet takedown used to be one fall, a plank pitched
  over) · OUT COLD HE BREATHES (`takedownTick` in game.ts: every ragdolled man or civilian down 'struck' / 'choked' gets `Character.breathe`; `breathFrame` lifts the chest joint
  of the PICTURE's skeleton on a slow sine once the body sleeps — never `bones`, the capsules, the particles or a checkpoint; a dead man never breathes). · THE CHOKE LOWERS HIM (`lower`, Tab row 'the choke lowers him'; `takeLower(g)` → `HoldPose.low / HeldPose.low` from player.ts `holdTail`; numbers `character.ts HOLD.lower`, fitted to the skeleton): over the last 40 % of the choke's own clock (`from` 0.6) the man goes down onto his heels, trunk folded, arms hanging (pelvis −40 cm), and Sam sinks with him, bowed over him (pelvis −30 cm, head −39 cm), the hand within a centimetre of where it sat on his neck standing; the choke's 2.6 s and the frame he is out on are untouched (268 either way in the check's run). Eased off (a tap), both come back up on a spring of their own (`up` 7 /s, the pelvis ≤ 1.5 cm a frame) and the man's hands come back with him, by the same way round they went (`heHr`: the hang and the hold's hand rotations are all but opposite, and the shorter way flipped mid-blend); with the lowering on Sam's own trunk and arm come back out of the choke on the eased clock too (`ckE` in `holdLayer`: the choke's own clock lets go in a frame, and his head went 8 cm with it — now ≤ 1.4 cm, no joint of his over 2.5 cm a frame; the lowering off = that pop as it was). POSES FEED THE GAME here too: both heads are lower for the choke's last second. A recording from before the key replays with it off (journal.ts). Once he is out Sam's pose is the hold's fade — he is back up in about a third of a second, where the clip leaves him crouched over the body; the lowering runs on clocks of its own (`heLk` the man's, `hdCk` Sam's, started over as a hold begins — a re-grab never opens squatting; what shows is the spring × the layer's weight while the layer fades and the spring alone while a hold is up, the weight folded into the spring at the grab and back out when it lets go, so a second grab a few frames after a choke neither pops nor squats again; what is still shown comes up on its spring) and Sam's share is × the arm hold's, so a gun drawn mid-rise stands both up together; `probes.ts takedown-lower`, under `takedown`. WITH IT ON THE SIMULATION
  DOES DIFFER (why the frozen stand holds it off): poses feed the game — the attacker stands taller for the half second of the blow, the victim's head moves in the beat before he
  drops — and a body falls another way, so it lies somewhere else. No state of its own (the animator's clocks are not in a checkpoint; a save waits for a falling body as ever);
  nothing under a show (`g.touring`; `takedownTick` returns on its first line there and with the switch off). THE EDGES (after the poses were held against the clips): no
  rise out of the crouch where Sam has no headroom (`mayRise` → player.ts `canStand`); a SEATED man takes the rear blow whichever side Sam is on and slumps where he sits
  (`slump`); the hands' marks follow the man until contact (`live`); a fall whose way is shut by a wall or furniture within a metre is taken where he stood (`fallTight`; a
  topple becomes a sink); `fold` and `sink` lay him on his front, a topple from the side turns him onto his back; the partner's move ends inside the takedown's own 0.6 s
  (`partnerEnd` 0.58) and is let go when the takedown is called off (`partnerCancel` from spotted.ts / pairorders.ts). Strips, stick figures drawn headless: `bun run tools/qa/takedown-strip.ts [--out dir] [--tag name] [--move a,b] [--list]` (the shipped stand;
  `TPS_TAKEDOWN=0` in front = the moves as they were). `probes.ts takedown` (`TAKEDOWN_BREAK=1` must fail; both stands). NOT in any clip, so posed by judgement: the pistol whip,
  the partner's move. Clip contacts take 0.4–1.0 s against the game's 0.28: the wind-ups are compressed, not the rule changed. Never seen on a GPU; page
  rebuild/takedowns-like-chaos-theory/read-first.md. THE HOLD'S TWO HALVES (pose only, no rule; on with the takedowns, so off on
  the frozen stand because `TAKEDOWN.on` is; a recording without the keys replays them off — journal.ts `applyKnobs`; Tab → Takedowns 'the kill from the hold' / 'the choke's
  beats'). `TAKEDOWN.kill` = hold phase `'kill'` as a move (`HOLD.kill`, arm variant only; the gun hold and the half off draw it as 'held', and off `takeFall(…, 'kill')` is the
  knife from behind's sink): hand over his mouth and his head hauled back, his arms flung FORWARD (a startle — in at his neck it read as the choke from above), the blade set past
  his neck, across at `hit`, out wide with the chest turning after it; he stands cut a beat, then folds forward and Sam goes down WITH him, a hand on his shoulder; the fall is
  the fold. `TAKEDOWN.chokeBeats` = `HOLD.beats`: both hands clamp the forearm by 0.35 s, come off and hang by 60 % BEFORE he is lowered, head to the side then forward, and
  the lowering read from `HOLD.beats.lower` (down by 85 %, the last third of a second held at the bottom, deeper) — `HOLD.lower` itself is what the half off and every older
  digest keep. After either, Sam's hold layer lets go slowly while he stands IDLE (`holdOutRate`: `kill.after` 7 /s, `beats.after` 2.6 /s) and at the old 16 /s the moment he
  moves or is told anything else (`holdBusy`, animator-side, latched: a gun drawn or raised, a round, reload, throw, crouch, kit, lock, body, door, the ready — any change from
  what the hold had him carry; a kit that hands a gun straight back gets no slow way up); the gun hold never. The layers take the halves from the pose (`HoldPose / HeldPose .kill / .beats`, fed by `takeKill(g)` / `takeBeats(g)` once player.ts `holdTail`
  passes them) and fall back on `HOLD_SHOW`, which `takedownTick` writes a frame late for every Game. THE RULE IS NOT HERE: left click in the arm hold is the close-in work's
  switch `CLOSE.heldClicks` (player.ts `setPhase('kill')`, a commit, ended at `HOLD.secs.kill` by `takeFall(…, 'kill')` + `killGuard`); until that lands tools/qa stages the
  phase (`setHoldPhase` / `killEnd` in takedown-check.ts, shared with the strip) and steps aside for a build that ends it itself. Checks: `takedown-check.ts kill`, `beats`
  (probes `takedown-kill`, `takedown-beats`; `TAKEDOWN_BREAK=1` fails both; both stands) — the fall's style is caught as `takeFall` writes it, whoever calls it. Measured, one
  seed, both stands: kill 1.3 s, the cut at 0.39 s on its frame, the fist 45 cm off his neck 7 frames later and 64 at its widest, his pelvis 32 cm and head 40 cm forward by the end, Sam's pelvis 22 cm
  and head 28 cm down with the hand 8 cm off his shoulder, fastest joint 4.9 cm a frame (the knife knuckle 9.1), dead on the clock's frame, asleep 1.7 s; the kill begun 10
  frames after a choke eased off 40 / 80 %: 6.0 cm at most; choke bottom 0.8 cm of pelvis travel over the last 0.33 s (13 off), Sam's hand within 1.4 cm of its place on his neck,
  4.5 cm a frame; a man re-grabbed after a choke broken off at 62 % starts with his wrists 0.5 cm from a fresh hold's (28 cm before: the beats rode `heCk`, never reset);
  Sam still 54 % down 0.2 s after a kill, 68 % 0.4 s after a choke, up in 0.9 / 1.8 s, 21 % / none walking; both halves off = commit efccd497 bone for bone (0 over 267, 300
  and 568 frames, both stands). NO CLIP shows a kill from a hold: the pose is our own, off the knife from behind. Seen only as stick-figure strips on the software path
  (`--move grab-kill,choke-beats,grab-choke`), never on a GPU, never played; the viewer's hold page has the phase (`kill`) with both halves shown.
- **Stealth poses = the crouch, the creep and the look under a door posed against the reference** (`src/game/stealthpose.ts` = the table `STEALTHPOSE`, a LEAF nothing of the
  game is imported into; `src/game/stealthfeed.ts stealthFeed(g)` = the feed, called from player.ts; `character.ts stealthLayer / stealthPicture`, numbers `STEALTH`;
  `STEALTHPOSE.on` — ON in the page, `?nostealthpose` = every pose as it was; OFF in the module and on the frozen stand, `TPS_STEALTHPOSE=1`; a `FROZEN_HOLDS` row, in the knob
  registry and a journal's tables, a recording from before the table replays with it off; halves `idle / walk / rise / creep / cable` + `nod` (below); Tab ▸ Player & weapons ▸ 'Stealth poses
  (crouch, creep, the look under a door)'). The maintainer, 10-12, on a fourth clip of Chaos Theory: "we should use all these videos as references for our stealthy animations"
  (the clips cut into beats: rebuild/takedowns-like-chaos-theory/clips/stealth-moves.md). SAM ONLY, HANDS EMPTY (`anim.stealth: { free, cable } | null`:
  `free` = nothing in his hands and nothing else has his arms — a hold, a haul, a wall, a lock, a throw, a sprint, hands at work all stand it down; null under a show, a puppet,
  down): crouch IDLE = both forearms hang forward of the knees with a slow sway (`swaySecs`, the hips `swayM` 1.2 cm — the only thing but the arms that moves) · crouch WALK = the
  opposite hand leads low · RISE = standing up and crouching down the arms follow the trunk over `riseSecs`, not with it · CREEP (the close-in mode) = the free left hand leads
  its foot · CABLE = the optical wand's look is a squat at the foot of the leaf, trunk folded, head bowed, a hand low at the gap — AND IT IS THE POSE ITSELF (one model for
  the picture and the game: written into the pose before the bones are read, so `bones`, the capsules, his gaze and the meter go down with what is drawn — his head is more
  than 10 cm under the lock work's kneel while he looks; `cable` off = that kneel; wand.ts and `anim.lockpick` are untouched and `probes.ts wand` runs `stealthpose-cable`
  with its own probes). ARMS ONLY OTHERWISE (the arms' weight a straight ramp, `STEALTH.inSecs` / `outSecs`, shown through a smoothstep; a stagger's clutch, bound hands, a
  shield and the second pass's own arm work stand the layer down): no pelvis sink, the head and chest bones within 1.2 cm of the switch-off run and the head never higher, `pos` the
  same every frame; no rule, key, reach or clock moves, no dice, no state of its own. `bun run tools/qa/stealthpose-check.ts` (`probes.ts stealthpose`, 8 probes, both stands;
  `STEALTHPOSE_BREAK=1` must fail); strips, stick figures drawn headless: `bun run tools/qa/stealth-strip.ts [--out dir] [--move crouch-idle,crouch-walk,rise,creep,cable]`
  (`TPS_STEALTHPOSE=0` in front = the poses as they were). A GOGGLE NOD INSIDE THE LOOK IS SEEN (`STEALTHPOSE.nod`, on; no URL flag, no Tab row; a recording from before the key replays with it off: journal.ts): the look's own look-at measured the head with the night-vision nod already on it and took it back out, so the goggles swung on a still head; now the look poses the nod itself (`nvTip`, the one site that tips the head; `nvA` = the pitch really posed, what the gaze stabiliser reads) — bowed 79° over the gap a chin-down nod would roll the head over, so a nod that starts in the look is a LIFT of the head off the gap and back (`nodLift`, 17° / 13° at most, `bones.head` unmoved, never steeper than the look), and one the look comes in over stays the chin-down nod, kept short of straight down (`STEALTH.cable.nodMax` 82); which is settled once a nod. N is read during a look by the wand's own rule (`WAND.nv`, wand.ts; kit handling makes it a nod, his hands being on the cable — so with kit handling off, the frozen stand, there is no nod to show), and the check presses the key itself, raising both for those lines. NOT built (new moves, the maintainer's word first): the crouch run, a strike out of a run. KNOWN: a night-vision flip by hand stands both arms down though it uses the left alone. Judged from the clips,
  stick-figure strips and numbers only — never seen on the mesh or a GPU.

<!-- was CLAUDE.md lines 2611–2635 -->
- **The optical wand = a look under a shut door, as a piece of YOUR kit** (`src/game/wand.ts`; `WAND.on` — ON in the page, `?nowand` = no row on the card and no door offers the look;
  OFF in the module and on the frozen stand, `TPS_WAND=1`; a `FROZEN_HOLDS` row, in the knob registry and a journal's tables — a recording from before the table replays with it off; with
  nobody carrying one, on = off by run digest). The maintainer, 10-11: "maybe we can add the optical wand/cable as prep? what's actually realistic here?" · "yeah let's add it to kit".
  KIT: `MemberKit.wand` (your card only: a row 'Optical wand' after the 40 mm row, kit.ts `wandRow()`; slots.json tool `wand`, ONE pouch, max 1 — the issued card is exactly full, so
  it replaces a can, a frag or the 40 mm round; with the switch off it stays on the stored card INERT — no row, no pouch, no word, nothing on him — so a `?nowand` visit that changes a row
  does not write it out of the store) → `Player.wand` at every staging (`kitPlayer`); a checkpoint's player slice says `wand` true / false only while the switch is on, and a load
  takes a file's word only when it has one (a file from before keeps what the staging gave him; nothing is handed out with the switch off).
  PLAY: the row `wand` ('look under it — the wand, quiet') on a door's rows only where `wandOffered` (switch ∧ carried ∧ `g.fogOfWar.active` ∧ `wandFits`: shut HOME — inside `shutRad` 0.05, so a leaf
  ajar has no row and one that starts to open ends the look —, on its hinges, not steel) — the squad missions, `?fow`, a quiet mission on a fog rung; with no fog the picture already shows every room and there is no row. On a locked door it takes `rattle`'s place
  when three rows are up, and IT IS THE ROW THAT GIVES WAY: listed after every other thing's rows, so it never takes one of the three from a man to grab, a body, a wall charge or a
  second door. A SUSTAINED verb like the lock pick (player.ts `startWand / updateWanding / stopWand`, `Player.wanding: Wanding`; interact.ts `runningVerb` `wand:<door>`,
  stopped by a step, Space, Esc, the leaf moving, a shove off his spot once the lens is through, `giveUpSecs` 2.5 kept off the spot before it is, a blast that folds him, a round or
  fragments into him, the door blown off its hinges, going down, a kick, the lock pick taken up — `wandDrop` in combat.ts / frag.ts / doorblast.ts / player.ts; never started with
  his hands on a pad, a lever, the drive or a door): he kneels at the middle of the leaf with the lock pick's
  pose, gun away, and after `feedSecs` 1.5 the lens is LIVE. THE LENS IS HIS EYE (`wandEye` in the player's place among fogofwar.ts's eyes — no sixth eye, the shader untouched: `FogEye`
  carries optional `fov / near`, written per eye into the `looks` row the shader already reads): `pastM` 0.22 beyond the leaf, `eyeY` 0.1 m off the floor, a wedge of `fovDeg` 90
  (under `FOG.cone` the cone's own, since the picture's soft edge is one number for all eyes) turned by the AIM POINT at `panRate`, never nearer than `blindDeg` 10 to the door's own
  wall; its smoke line to a man is asked under its own probe key (`fowW_<id>`), not Sam's. So while he looks his own surroundings are fog unless a teammate sees them. No rule for the dark (the fog never asks for light), nobody notices the lens, it files no sound. N IS HIS WHILE HE LOOKS (`WAND.nv`, on; false = the key did nothing on his knee at the door, as it was, and a recording from before the key replays so; the maintainer, 10-12: "should be able to use night vision with wand"): player.ts reads N ahead of the look's early return, the goggles go down / up by kitanim.ts's nod (his hands are on the cable) and the picture is the tube's as anywhere else — the lens, its wedge, the fog and the look's clocks are untouched, and nothing is seen that the goggles do not show elsewhere; his head stays within 1.5 cm through the flip on both stands (`wand-look` holds 3). KNOWN, read off the code and not seen: on the page the stealth poses' squat at the door (`stealthPicture`) re-aims his head every frame, so the goggles swing but the nod itself is mostly levelled out.
  WHAT HE KEEPS: a hostile last seen through the lens gets the fog's own fading '(?)' for `markSecs` 15 whatever `FOG.lastSeen` says (`Rec.wandT`; `lastSeen()` returns a per-mark
  `life` both overlays fade by; HUD only). Out again, no round until the gun is back up: with kit handling on that is the by-hand draw's own time, else `stowSecs` 0.6. A look under
  way refuses a plain save (`playerBusy` 'looking under a door'). Tab ▸ Player & weapons ▸ 'Optical wand' (the switch, 'on me now', seven numbers). A TEAMMATE'S IS THE NEXT BULLET. NOT built: a cable prop, a pose of its own, hostages marked, an IR / dark rule. QA: `bun run tools/qa/wand-check.ts [kit|tile|look|costs|doors|mate|off]` (`probes.ts wand`,
  in all-quick; `wand-kit` and `wand-tile` (the real loadout screen on a fake DOM: the 'no use here' tile on the solo night, the plain one on a squad mission, the quiet mission's following its fog lever) also under `kit`, `wand-look` under `fog`; both stands; `WAND_BREAK=1` must fail; `wand-doors` = the lens beyond the leaf and in the open on every door face
  of every squad and quiet level), `PORT=<dev server> node tools/qa/wand-page.cjs [outDir]` (the real page on the software adapter: the card's row, the door's row, the look, `?nowand`). Page:
  rebuild/optical-wand/read-first.md. Never seen on a GPU.
- **A teammate looks under a shut door with the wand, ON YOUR ORDER** (`src/game/wandorder.ts`; `WAND.mate`, a key of the wand's own table — ON in the page, `?nowandmate` = only you
  carry one, as it was; OFF in the module and on the frozen stand, `TPS_WANDMATE=1`; a `FROZEN_HOLDS` row, the word in `STAND_ENV`, and a recording from before the key replays with it
  off: journal.ts; needs `WAND.on`; with no teammate carrying one, on = off by run digest — the check holds it). The maintainer, 10-16, asked whether a teammate may carry the wand and
  look first: "a, but yeah you have to order it". SO IT IS ONE ORDER AND NOTHING ELSE: no teammate ever decides to use a wand, no door tool has him look first, no drill asks for it.
  KIT: a teammate's kit card has the 'Optical wand' row too (kit.ts `wandRow(i)`; slots.json tool `wand` `who: you + mate`, one pouch, one a man): his issued card is full, so it takes
  the place of a can, a frag or a charge. THE ORDER (id `wandLook`, 'look under it · wand'): the orders menu opened on a door lists it ON A KEY OF ITS OWN, V (`WAND.orderKey`; every
  digit of a door's menu is taken and nothing is ever on a digit above 5; V is the whistle's key and is eaten only while a menu that lists the row is up) — X on the door, then V; the
  row is on the menus only while a living squad man carries a wand and there is a fog of war to look into. ONE man's order (`only`): the nearest of the addressed men who carries one
  and can walk to the door's face the men are on; everybody else is left exactly as he was. Greyed with the reason where it cannot be done: 'no wand on them.', 'steel: no gap under
  it.', 'it is not shut.', 'no door left.', "can't get to it.". THE MAN walks to the middle of the leaf (the player's own kneeling spot, `Doors.workSpot`), kneels with the lock work's
  pose and `WAND.feedSecs` later says "wand's in." — the squad block reads 'feeding the wand · <door>', then 'looking under · <door>'. He stays until he is told something else; the
  leaf moving ends it ("door's moving. wand's out.": he steps off beside the latch jamb with his gun on the doorway); the fight taking him — the alert AI's lease, or the room fight's
  aim on his script (`GuardScript.over`, a look at a cue included) —, a blast that blinds or folds him = the lens out and he is off his knee, fed again from the start when he is back
  on it. Ordered to ANOTHER door from his knees he is up on that frame and kneels again only there; the fog or the switch going off under him = a plain hold where he is. HIS LENS IS HIS EYE among the fog's (`mateWandEye`, asked by fogofwar.ts in place of his own eye: no sixth eye, the shader
  untouched): the player's lens by every number (`wandLens / wandFov / wandPanMax`), SWEPT from one end of its arc to the other and back over `WAND.sweepSecs` 5 on the game's clock,
  since nobody aims it for him — so while he looks, what is round HIM is fog unless another eye has it, the price the player pays. A hostile it shows keeps the wand's '(?)' mark; its
  smoke line is asked under its own probe key. Under 'only my own eyes' a teammate's lens is a device feed (as a sticky camera's) and still lifts the fog. Nobody notices a lens, it
  files no sound, no dice, nothing reads the camera; no state in a checkpoint (an order is not saved: after a load he is not looking). Tab ▸ Player & weapons ▸ Optical wand ▸ 'wand ▸
  a teammate, on order'. A teammate's stored wand on a visit with his row off (`?nowandmate`, `?nowand`) is not on his card — no pouch, no row — and stays in the store whatever else is changed
  (kit.ts `keptWand`, the pattern your charges' counts use). KNOWN: the Tab row thrown OFF mid-visit leaves a wand already on his card, and its pouch, until a reload; V with a door's
  TOOLS page up is still the whistle (the row is on the door's first page); the fog's contact calls are asked of the kneeling man's own eye, not his lens; a squad of four under the team's fog has five eyes, all taken, so his lens REPLACES his own eye; with the squad's eyes already on a room
  the lens adds nothing (it is for a shut room). MEASURED on the frozen stand (the office room clear, the four, the server room's door, one defender behind it, AI off): lens live
  8.9 s after the order (his walk + the feed); the man behind the door in the picture 106 of the next 360 frames under the team's fog and 131 of 360 under 'only my own eyes' (the
  sweep passes him), hidden before the order in both; the run's digest equal with the switch off and on while nobody carries one. QA: `bun run tools/qa/wand-check.ts mate`
  (`probes.ts wand-mate`, in families `wand`, `kit` and `squadorders`; both stands; `WAND_BREAK=1` must fail): the card's row and pouches, nobody looks unordered over a played
  stretch, the door's menu lists the row on V with no digit over 5, V sends the one carrier and leaves the others' orders alone, he kneels, the lens is a fog eye and shows the man,
  the leaf moved ends it, a man with no wand is refused in words, `WAND.mate` off = no row on the card or the menu. On the real page: `PORT=<dev server> ONLY=mate node
  tools/qa/wand-page.cjs [outDir]` and `ONLY=nowandmate` (his card's tile from the roster chip; the room clear staged from that kit; the menu, V, the kneel, the fog eye). Never seen
  on a GPU and never played by anybody: the sweep's five seconds, the key and the words are first-pass.
- **In a hold: left click the knife, right click the choke** (`CLOSE.heldClicks`, a key of `src/game/close.ts`'s table beside `lethal` and its OWN switch — it does not wait on
  `CLOSE.on`; ON in the page, `?noheldclicks` = neither click does anything in the arm hold, as it was; OFF in the module and on the frozen stand, `TPS_HELDCLICKS=1` raises it
  there, `TPS_PROFILE=shipped TPS_HELDCLICKS=0` holds it off on the shipped one; a `FROZEN_HOLDS` row, the word in `STAND_ENV`, a Tab toggle under 'Closer than ever', and
  `journal.ts applyKnobs` replays a recording whose CLOSE row has no such key with it off). Where: `player.ts updateHold`, the ARM hold only (the knife at his throat), phase
  'held', not while the hand is between tools (E) or a choke is already chosen, never a civilian, never under a show. LEFT click → `startKill`: phase 'kill', the standing
  knife's own `bodyHit`; a COMMIT — it is the running verb (`interact.ts runningVerb`) and `cancelSustained` leaves it alone, so no Space tap, step, Esc or E touches it, Sam is
  rooted, and the one row is the status line 'the knife…' — and at its clock `killOut`: `takeFall`, `killGuard(…, 'shot', 'player', 'knife — dead')` with `startTakedown`'s
  witness rewrite (seen DROPPED, not shot), then the choke's own tail (`chokeLimp`, the `FOLD_NOISE` event, the hold nulled, `holdTail`). RIGHT click → the choke chosen exactly
  as its Space row chooses it (`H.windT = 0`: same frames, same sounds, still eased off by a tap or a step). BOTH buttons in one frame choose nothing (the knife cannot be taken back). A click an order menu was up for never gets
  there: `orders.input` runs first in `Game.step`, takes the right click's bit out always and, with a man in the arm and this switch on, the left click's too — the click that
  shuts the menu is never the knife (the click that gives the page its focus back is not guarded, as a shot is not). Sam shot down or folded mid-kill (`freeHeld('shot')`): before the cut (`HOLD.kill.hit` × the clock) the man
  is loose as ever, past it he dies by the knife (`killOut`, `holdPose` nulled); a cancel (teleport, the tour, a despawn) hands him back whenever it comes. The gun hold (a
  round past him, the OCP), a held civilian and the Space rows (question / choke) are untouched; the choke row's hint gains 'LMB  knife — lethal  ·  RMB  choke him out' ahead
  of E. A hold is never in a save (`savestate.ts playerBusy`), so the phase has nothing to round-trip. THE MOVE IS THE TAKEDOWNS' (character.ts phase 'kill' on both bodies, `HOLD.secs.kill` the clock, `HOLD.kill.hit` the cut's share of it, takedown.ts `takeFall(…, 'kill')`
  the fall; `holdTail` feeds both poses `kill: takeKill(g), beats: takeBeats(g)` beside `low`): this rule only starts the phase, ends it and decides who dies. Check: `bun run tools/qa/probes.ts heldclicks` (`tools/qa/heldclicks-check.ts`, also in
  family `close` and all-quick; writes the switch itself; `HELDCLICKS_BREAK=1` must fail) — 18 PASS on both stands, BREAK 10 FAIL / exit 1 on both (a sighted man's record of the kill is 'struck'; both buttons; the menu's click). Run 2026-10-13: both
  typechecks, knobs-check, dice-check, build green; `gate.sh close grab takedown hold-pose gunhold selector kitanim hands stealthpose checkpoints journal registry shipped` on the
  frozen stand 566 PASS / 0 FAIL, and with `TPS_HELDCLICKS=1` in front the same once two older probes were taught the switch: `gunhold-variant` (b) and `selector-rows` 'held' pinned the arm row's old
  words, and `gunhold-variant` made a left click in the arm to see it fire nothing — both now follow `CLOSE.heldClicks` (`selector-rows` keeps two older reds of its own on the
  shipped stand). `squadorders` 160 PASS on and off. JOINED with the takedowns' look (its fb47a73b) on build 8c30895a: the kill ends in `updateHold` as `holdTail` THEN `killOut` THEN the pose nulled — Sam draws
  the clock's last knife frame before he lets go, which is the frame its `takedown-kill` counts his rise from (ended a frame early its two rise lines went red); there the
  clock is 1.3 s and the cut 0.39 s in. On that join: heldclicks 18 lines on both stands; close 127, takedown 116, gunhold 21, selector 14, squadorders 161, grab 54 PASS /
  0 FAIL on the frozen stand and again with `TPS_HELDCLICKS=1 TPS_TAKEDOWN=1`; journal 11, registry 20, shipped 4; the real page boots (software adapter) on the shipped
  stand's switches, 134 tables, `CLOSE.heldClicks` true. No tour, no soak. Never seen on a GPU,
  never played; the look of both moves is the takedowns thread's.
- **The fog's own light is ON in the page (`FOG.flat`, 10-13; the maintainer: "you can see enemies flashlights in fog of war").** The cause: the fog pass
  drew a pixel nobody on the team sees as the LIVE frame dimmed and greyed, so a guard's torch in a room nobody watches lit that room's floor in the fog (his
  shot: the mouse hole on hard, two cones in the black store, no man drawn at either: where each stood and which way he faced). `FOG.flat` (rule 4e, built
  earlier and left at 0) draws such a pixel as the surface's paint under one fixed light, nothing of the live frame in it; it is now `FOG_FLAT_ON` = 0.12 in the
  module and the page, `?fogflat=0` = the fog as it was (`?fogflat=level` another; Tab 'fog of war ▸ own light'). Frozen stand: 0, `TPS_FOGFLAT=1` raises it
  (`FROZEN_HOLDS['FOG.flat']`, `STAND_ENV`); shipped: 0.12, `TPS_FOGFLAT=0` holds it. Picture only: no digest moves; a recording from before the key replays
  with 0 (`journal.ts applyKnobs`). Light on floor the team DOES see is untouched (a torch's spill through a door onto seen floor still shows). Check:
  `probes.ts fog-flat` (family `fog`; 5 lines; `FOGFLAT_BREAK=1` red) on both stands: the renderer's block carries the level, the shader's branch reads the paint
  and not the live colour, the address, the journal, the stands. MEASURED on software-adapter stills only (verylow, one page of the mouse hole, three guards'
  lights forced on, `rebuild/play-flaws-1010/fog/`): at 0 a torch pool reads 129–155 of 255 against 1–61 round it; at 0.12 / 0.2 / 0.3 pool
  = surround to 0.5; a lamp-lit room nobody sees is 61 at 0 and 54–65 at 0.12 (0.2: 73–86), which is why 0.12. THE COST, his to judge: a DARK room nobody
  sees is that same grey (it was black, 1–8), its furniture readable, so on a night map the fog is brighter than the ground the team stands on (24), and the
  fog no longer says which rooms have their lamps on. A fog lit by the level's fixed lamps alone (dark rooms stay dark) would be a bigger job and is not
  built. Not tested: a sight edge inside a lit room, smoke, a muzzle flash, anything moving. On the shipped stand the `fog` family has 16 red lines
  (fog-sight, fog-smoke, fog-rules, fog-cone, squadfire) at the build head 28532d5e with or without this. Never seen on a GPU, never played.
- **The fog is lit as the team last knew it (`FOG.lit`, 10-14; the maintainer: "fog of war looks very flat" · "would be nice for it to have some RT lighting,
  maybe just based on last known state or something").** Rule 4f of `src/game/fogofwar.ts`, over the bullet above: with the fog's own light on (`FOG.flat` > 0)
  an unseen pixel is still the G-buffer paint alone, but the light on it is TRACED IN THE FOG PASS (`shaders/fogofwar.wgsl fowLit`) from a list the fog itself
  makes (`litBlock` → `FogFrame.lights`, a 3 KB uniform of ≤ `FOG_LIGHTS` 48 records in the scene's own Light layout — `render/lights.ts packLight`, now the one
  packer for `upload()` too; the pass never reads the live `lights`): every fixture of the level that carries light (`g.targets` with `light` / `areaLights`: a
  lamp, a ceiling panel, a monitor, a lit sign) ON OR OFF AS THE TEAM LAST SAW IT, at full strength (no flicker, no restrike ramp), + the sun or moon. First
  met = as the building stands. A fixture shot out, switched or knocked out by the OCP where the team has no look at it STAYS AS REMEMBERED until `lampSeen(t)`:
  an eye has the floor under it (`spotSeen`), or a line to the fixture itself inside its field, or the team sees floor within 2 m of it that it lights. The
  MAINS are as they are (the trip and the reset are told to the whole floor by message and sound). Shadows: `fowLitHit` = common.wgsl `occludedTBoxes` line for
  line, less the capsule cap and passing EVERY box with an owner — so they fall from the statics, the leaves (4b) and the loose things where the team last saw
  them (4d), never from a man or his kit. The fixed light stays as a FILL (`flat` × `litFill` 0.5 = 0.06 displayed) that six fixed short rays shut out in
  corners, at the foot of a wall and under a table (`litAo` 0.75, `litAoM` 1.5 m; a spot inside a box — a wall's top under the ceiling slab — keeps it whole),
  and a lit panel's own face glows (the area lamp 7 cm proud of it). Lamps × `lit` × `dim`; one that would add under `litCut` 0.006 displayed is not traced.
  NOT IN THE LIST, by construction: torches, weapon lights, muzzle flashes, tracers, beacons, lightning. More than 48 lit lamps: the ones whose reach is nearest
  the player (the office has 31). SWITCH: `FOG.lit` 1 in the module and the page — `?foglit=0` = the one fixed light as it was (`?foglit=gain` another; Tab
  'lit as last known' + three 'lit:' rows, short so that a slider's label shows them whole); `?fogflat=0` is still the live frame dimmed, whatever `lit` says. Frozen stand: 0, `TPS_FOGLIT=1`
  raises it and wants `TPS_FOGFLAT=1` with it (`FROZEN_HOLDS['FOG.lit']`, `STAND_ENV`); shipped: 1, `TPS_FOGLIT=0` holds it. Picture only: no digest moves,
  nothing in a checkpoint or a tape (the memory is re-primed at `reset()`, as the things' is); a recording from before the key replays with 0
  (`journal.ts applyKnobs`). CHECK: `probes.ts fog-lit` (family `fog`; 9 lines; `FOGLIT_BREAK=1` red) on both stands — the block, only fixtures and the sun in
  the list with every carried light and a flash forced on, last known (off unseen stays lit, on unseen stays dark, a seen one follows), the mains, the shader's
  branch reads nothing live, the walk against `occludedTBoxes`, the address, the journal, the stands. MEASURED on software-adapter stills only
  (`node tools/qa/fog-lit-stills.cjs --look 14,13 --dist 30 --w 800 --h 500 --torches`: the mouse hole, hard, squad of four, seed 1, low, one staged frame,
  88 % of it fog; stills in `rebuild/fog-lit/`), of 255: a dark room nobody sees 32 (flat 52, the live fog 1), the lit exam room 79 (65 / 65),
  the corridor 80 (53 / 74), the street lamp's pool 80 (34 / 75). THE LEAK WATCH, nine enemy torches forced on: 0 fog px moved in 5 × 5 patches under the lit
  fog (5,895 px moved in one-pixel lines along edges: the resolve's jitter) against 28,563 under the live fog; the tool exits 1 on any. COST on the software
  adapter: a frame 9.5 s lit against 8.8 s flat and 8.6 s live-dimmed (one run, ± a few tenths) — the fog pass was about a tenth of that before. NEVER TIMED
  OR SEEN ON A GPU, never played: the levels (fill, gain), moving through it, a sight edge inside a lit room, and what a never-seen room should look like are
  the maintainer's. NOT HELD (as before): decals and wall damage made unseen; a fixture's emissive glow card other than an area panel's face is dark in the fog.
- **The fog gets the full picture, less what the team should not see (`FOG.full`, 10-14; the maintainer after looking at the lit fog on the pass at night:
  "fog of war still looks really bad. we should find a way to have it get the full visual pass but just hide things (like flashlights) that shouldn't be
  visible to the player").** Rule 4g of `src/game/fogofwar.ts`, IN FRONT OF the two bullets above (they are now what `?fogfull=0` draws, and what is drawn
  until the sight table below is live). An unseen pixel is the LIVE FRAME dimmed (`dim` 0.4; greyed too until 10-15, `desat` 0.75 — now 0, the bullet after this one: every pass, its bounce, soft
  shadows, air) and what must not show there is cut WHERE IT IS MADE: (1) THE SIGHT TABLE — `render/fogofwar.ts FogSight`, `shaders/fogsight.wgsl`: at the
  head of the frame one 32 × 5-group compute pass writes, for each eye, how far its level ray goes along each of 2048 bearings (`occludedTBoxes`, the fog
  pass's own eye ray) into a 41 KB buffer that is the scene group's binding 11 in every pass (a UNIFORM — the fragment stage has no sampled texture left;
  the pass itself binds a zero stand-in there, `Engine.sceneBGPlain`); `common.wgsl fogSeenAt(P, N)` = the fog pass's `fowSeen` rule answered from it — the two
  table rays beside the spot's bearing, and the exact ray walked only where they disagree (a sight edge, a wall seen along its length), cached per spot;
  `fogSeenBins` = the table alone, for the vertex stage (which does not see the grid). (2) LIGHT CLASSES in the light record's kind word (bits 25 / 26,
  `lights.ts LIGHT_FOG_SEEN / _UNSEEN`), asked by `evalLight` (→ `evalLightRaw` × `lightFogK`) and by the four places that work a light out themselves
  (`reflect.wgsl` ≡ `reflect_p5.wgsl` glints, `cards.wgsl` — a torch's bounce card, where its footprint falls — `froxel.wgsl`, + the volumetric march's
  K-beam pick): class 1 = lights only what the team sees — every carried light not the team's and every flash / timed light not a teammate's own, DECIDED AT
  THE UPLOAD (`LightSet.fogClass` from `fogTeam`, which `fullBlock` keeps: a tracer's ember or a blast's afterglow born after the fog's turn is classed on its
  first frame); class 2 = lights only what it does not — a lamp OUT that the team last saw lit (`RtLight.fogGhost`: uploaded at its base strength, glass mask
  kept), by the lit fog's own memory (`lampKnown` / `lampSeen`); a lamp LIT but remembered out is class 1; the mains follow at once; the sky, the level's lamps
  as they stand and the team's own lights: none. (3) NOT LIGHT: the picture's smoke march takes no density over unseen floor (`fogSmoke` in `volumetrics.wgsl`
  and its dust twin — `dustLookVol.ts SWAPS` re-pointed) and `particles_draw.wgsl` draws no spark, puff, chip, case, sheet or shard there (the weather's drops
  stay). THE GAME'S OWN READINGS take lights as they are: `probe.wgsl` → `evalLightTrue` (class 2 skipped). **NOT PICTURE ONLY ON A GPU**: the BOUNCE the light
  meter adds (`diceIrradiance`) is read from the picture's cascades, which hold class 1 as the picture has it, so in the page the guards' eyes are not
  independent of this switch — an enemy's torch on a wall nobody on the team sees (with the cone on that includes the wall behind Sam, past his near
  field) bounces nothing onto him in their reading: he reads a little DARKER than he is. Never brighter: a remembered lamp (class 2) is kept out of the
  cascades (`directIrradiance` skips `LIGHT_FOG_UNSEEN`; the room it lights in the fog keeps its first bounce and loses the far one). The size was never
  measured (no GPU here; headless has no cascades, so no digest or probe sees it); `?fogfull=0` is the build with the meter as it was. FALLBACK: `FogFrame.sight` (the engine's word, = `FogSight.live`) —
  while false the fog pass draws the lit fog from the rows the game still fills, so nothing live shows while the table's program compiles or if it fails.
  `FOG.fullFill` (0) adds the fixed light, corner-shaped, on top (`fogofwar.wgsl`: `unseen + own` under `lit2.z`). SWITCH: `FOG.full` true in the module and
  the page — `?fogfull=0` = the lit fog (Tab 'full picture' + 'full: fill share'); frozen stand: off, `TPS_FOGFULL=1` raises it (`FROZEN_HOLDS['FOG.full']`,
  `STAND_ENV`). Picture only: no digest moves, nothing in a checkpoint or a tape; a recording from before the key replays with it off (`journal.ts
  applyKnobs`). CHECK: `probes.ts fog-full` (family `fog`; 8 lines; `FOGFULL_BREAK=1` red, 4 lines) on both stands — the block and the fallback pick, the
  classes as uploaded with flashes born after the fog's turn, last known (ghost, gone when seen, class 1 when relit unseen), the mains, every shader site,
  the address, the journal, the stands; `fog-flat` / `fog-lit` now pin `FOG.full` off, as do `fog-cone-stills.cjs` and `fog-pass-check.cjs` (`fogfull=0`).
  MEASURED on software-adapter stills only (`node tools/qa/fog-lit-stills.cjs --torches`, hard, squad of four, seed 1, low, one staged frame each: the
  mouse hole `--look 14,13 --dist 30 --w 800 --h 500`, 88 % fog, and the pass at night `--level pass.json --dist 34`, 46 % fog; stills in
  `rebuild/fog-lit/`): THE LEAK WATCH — the full picture drawn twice with nothing changed moves 0 fog px in 5 × 5 patches on either
  (3.5–5.7 k single px: the renderer's own noise); with nine / eight enemy torches forced on, 1 / 0 (against 29,632 / 15,154 under the oldest fog and 0 / 0
  under the lit fog); the tool exits 1 over max(40, 3 × the still pair's own) and on a full still drawn without a live table. THE LIT FOG too is drawn twice with nothing changed and the torches' count read against 3 × that (0 on a settled picture: the old rule, any patch at
  all is a leak). A PICTURE THAT HAS NOT SETTLED makes the watch loose, and that — not the snow — is what a first reading of the snow level showed (10-14/15):
  `--level pass.json --torches --frames 12 --w 640 --h 400` reads 1236 full / 3160 lit fog px in patches with nothing changed and 966 / 4086 with eight torches on
  (the oldest fog 11,276), the same numbers on the snow goal's head a9cd1e96 and on the build head b4b5902b, and the same with the particles' splats not drawn;
  at the default 45 staging frames (the lit fog goal's own run on bb77bed1, and the merge thread's on 57c30380) it reads 0 / 0 unchanged and 0 / 0 with the torches on, the oldest fog 5278. So the
  watch is as strict on the snow level as anywhere, the lit rung's + 925 at 12 frames was the unsettled picture drifting, and the tool now prints NOT SETTLED when
  its unchanged pairs move. 106 programs, 0 failed, no error on every run. 105 programs, 0 failed; no
  console, page or GPU error. COST: not separable here — two pages and the probes shared four cores (a frame 20–25 s under the full picture, 22–23 s lit,
  21 s live-dimmed on the pass). On a GPU the table is 10,240 short rays a frame, and a classed light costs two table reads an eye per spot (a walk only at
  sight edges); the table is a uniform ARRAY indexed per pixel, which the reach rows measured slower than storage on Apple GPUs (`frame.ts reachBinding`) —
  NEVER TIMED OR SEEN ON A GPU, never played: moving through it, a sight edge sweeping over a torch's pool, the ghost lamp, smoke at a sight edge, and
  whether `dim` / `desat` suit a night level are the maintainer's.
  WITH THE CONE ON, 'nobody watches' is also the floor behind Sam past his near field: a torch coming up behind him shows no pool there (the maintainer's to
  feel in play). NOT HELD: a fixture's glowing face follows the lamp as it is — a tell both ways (shot out unseen: room lit, panel dark; switched on unseen:
  room dark, panel glowing; a later mend through `RtLight.markRef`); decals and wall damage made unseen; a
  seen wall an enemy's torch lights bounces into the fog beside it; history (reservoirs, the denoiser, the resolve) carries a glow for some frames after a
  spot stops being seen.
- **The fog comes in over a soft band and keeps its colour (`FOG.edge` 0.5 m, `FOG.desat` 0; 10-15; the maintainer, of a shot of the pass: "fog of war
  edges shouldn't be so sharp", and of two shots of a replay of the mouse hole: "given how pretty the game is, i think having fog of war mute the colors is
  unfortunate").** PICTURE ONLY, both: what the fog hides, the cone rule, the lights' fog class and every reading the game takes are as they were.
  (1) COLOUR: the unseen frame is no longer greyed (`desat` 0.75 → 0; still dimmed by `dim` 0.4). `?fogdesat` puts the greying back, `?fogdesat=share`
  another; Tab 'desat'. (2) THE EDGE: the fog pass alone (`shaders/fogofwar.wgsl fowEdge`, called from `fowSeen` in both of its programs) lays a band ACROSS
  each sight edge, half on each side: an eye gives a spot it sees 1, less within half a band of its sight edge; a spot it does not see 0, more within half a
  band; 0.5 on the line; the team's answer is the most any eye gives, as it always was (a stack of men has one man's line; the cone's soft edge is
  untouched; a first cut that took the eyes together crept the line 15 cm into the fog for five men stacked — a review's find). With the band 0, or no sight table written, every spot answers as it did. The edge is FOUND IN THE SIGHT TABLE (`FogSightT`, binding
  11; `cfg.w` carries the band in metres, written by `render/fogofwar.ts FogSight.encode` from `FogFrame.edge`): from the spot's own bearing the scan goes
  both ways, at most `FOW_EDGE_BINS` 64 bearings, a row of four at a time where the row cannot hold the edge, for the first bearing where A NEARER THING
  STARTS — 1/range steps up against its neighbours' run (`fowRel`, as a share of 1/range, soft between `FOW_EDGE_JLO` 0.06 and `JHI` 0.18; each side's run
  held to `FOW_EDGE_RUN` 0.03 a bearing, what a face 84° off square gives, so a far thing one bearing wide cannot explain the step away), so a wall that
  runs through the spot's range is passed over and its foot, a room's corner and the floor behind it keep their line; and where a pillar's line meets a
  partition nothing BEHIND the partition is brightened (the bearing that 'reaches' is carried back along its own run: a wall in front of the spot is no edge). The band at an edge is the knob ×
  that step's weight × how far behind the caster the spot is (0 at the caster, whole a band-width behind it; never wider than the bearings searched, which close to the eye is under half a band; and not drawn at
  all while it is under a third of `FOW_EDGE_THIN` 4 bearings wide, whole from 4 — right behind the caster it is narrower than the table can place it, and
  it beaded along a door leaf's end in the stills): no line pops in, and a door jamb or a
  wall's end is still crisp where it stands. PAST THE LINE THE BAND SHOWS NOTHING HIDDEN: it only mixes toward the fog's own picture a little early or a
  little late, and that picture is the one rule 4g already stripped (a torch's pool is cut on the true line in `common.wgsl lightFogK`, which this does NOT
  touch; unseen men are not drawn). A first cut that softened the lights' class too was dropped: it was not picture-only, and it lost the device on the
  software adapter. ALSO: `shaders/fogsight.wgsl` now asks each bearing's ray again short of its answer until nothing stands nearer — the grid walk answers
  with the nearest box of the first CELL with a hit, and a long wall registered there could win over a pillar a cell on (a review's find; the light classes
  read the same table, so their line is truer by it too). THE ENGINE REPLAY SHOWS A TAPE UNDER THE PAGE'S OWN FOG LOOK (`FOG_PAGE` and
  `FogOfWar.pageLook()` in `game/fogofwar.ts`: `desat` and `edge` alone, put over the tape's tables for three fog frames each time `replay/engineplay.ts`
  asks — as it takes the frame, after its first tables, and after any FOG table row of the tape's; the Tab rows are the viewer's after that. A LEAN, said
  first on the page: his shots were of a replay, and a tape from before would otherwise keep the grey and the hard line for ever. Nobody else calls it:
  play, the kit page's viewer and the harness keep what the knobs say, and a tape replays in the harness as recorded. A tape from before `FOG.full` has no
  sight table, so it takes the colour and keeps its hard line. A visit's own `?fogedge` / `?fogdesat` ride a replay's address: `ui/replaykey.ts
  VISIT_FLAGS` — the replays goal's list, two words added).
  SWITCHES: both ON in the module and the page; `?fogedge=0` = the hard line (`?fogedge=metres` another, to 1.5), `?fogdesat` = the greying; Tab 'full:
  soft edge m' and 'desat'; frozen stand: the hard line and the greying, `TPS_FOGEDGE=1` / `TPS_FOGCOLOUR=1` raise them (`FROZEN_HOLDS['FOG.edge']`,
  `['FOG.desat']`, `host/standup.ts`); `FOG` is a registered table and rides the journal — a recording without the `edge` key replays with the hard line
  (`journal.ts applyKnobs`), and `desat` is whatever the tape says. Not game state: no checkpoint or tape carries anything new. CHECK: `probes.ts fog-edge`
  (family `fog`, 17 probes; 6 lines; `FOGEDGE_BREAK=1` red on 2 of them) on both stands — the block, the wiring as written (and a hash of the shader's
  text from the constants to the end of `fowSeen`: `EDGE_TEXT_HASH` in `tools/qa/fog-probes.ts`, to be changed WITH the replica), THE RULES on a plan replica
  of the shader statement for statement (`edgeReplica`: open floor crossed smoothly with 0.5 on the line; a pocket's middle dark; a wall's foot, a room's
  corner and behind them untouched; the line up a far wall fading on both edges; a man 5 / 15 / 25 cm round a corner at 7 m 0.62 / 0.87 / 1.00; five men
  stacked = one man's line; the sliver two men leave behind a pillar 0.42 where the hard line is 0; behind a partition 0.00; no pop beside a leaf's end a
  quarter metre from the eye; a door ajar 10 cm 0.76 at its middle; 14 pairs of spots 2 cm apart stepping by over a quarter, where the hard line has 1644,
  over five scenes), the address, the journal and the replay's asking, the stands. `fog-full`'s wiring line follows the table's new ray.
  MEASURED, a real page on the software adapter (`fog-lit-stills.cjs --edge`: the hard line twice, then the band; 800 × 500, low, the default 45 staging
  frames; 112 programs, 0 failed, no console, page or GPU error on every run): THE PASS at the squad's start — 304 px dimmer and 646 brighter in patches with
  the band, 52 and 201 with nothing changed (these dark low-quality pictures move by themselves: the tool prints NOT SETTLED), and the wedge the gate's wall end casts
  across the snow reads soft in the still; THE GATE CLOSE IN (`--look 22,20 --dist 14`, the staging to use: a line across open snow fills the frame) —
  2081 px dimmer and 2605 brighter in patches with the band, 55 and 85 with nothing changed; the same level from far out (`--look 20,15 --dist 52`) has the band a few pixels wide and the tool cannot tell
  it from the pictures' own movement (297 / 308 against 245 / 203: NO BAND, exit 1 — the measure wants a staging with a line across open floor); THE MOUSE HOLE
  (`--look 14,13 --dist 30`) has no sight edge over open floor in view — the squad stands outside and every line there is a wall's, which keeps it — and the
  tool says NO BAND (97 / 55 against 98 / 81 unchanged): a staging's answer, not the shader's. THE LEAK WATCH with the band on (`--torches`, the pass, 640 ×
  400, 8 enemy torches forced on): 0 fog px moved in patches under the full picture, 0 unchanged (the oldest fog: 5403).
  A SECOND REVIEW'S MEASURES, on the plan replica (random 20 × 14 m rooms, 233k spots, an eye walking 2.5 cm a frame): 98.6 % of the hard line's crossings
  on open floor are left with a step under 0.2; 1 seen spot in 233k dimmed with no unseen spot within 0.3 m. KNOWN, NOT MENDED: (a) ONE-FRAME BLINKS as an
  eye moves — a spot's answer jumping by over 0.15 for one frame, 190 of 127k in-band spot-frames (410 before the run was held), where a caster's side
  face takes one bearing between the clear ones and its front; the fog pass runs before the resolve, which should swallow most of it — never seen; (b) the
  band's place moves a whole bearing at a time (a sawtooth of about 0.05 at 6 m, 0.11 at 12 m as an eye creeps); (c) a caster or a slit a few centimetres
  wide is spread to the band's width (a 2 cm post at 5 m: a 4 cm shadow becomes a half-metre trough 0.41 deep), and one under a bearing wide (3.8 cm at
  12 m) can flicker as it closes; (d) on the line itself a step of 0.02 at 8 m, 0.05 at 20 m, 0.10 at 40 m is left.
  THE STILLS, LOOKED AT (a second reviewer, of the pass, the mouse hole and the pass from far out): the soft line off the gate's leaf reads as a penumbra
  (a 2–4 px step becomes about 10 px), no halo, no stripes from the squad, no blotch at the men, nothing shown that the hard picture hid; the widest fog
  edges in those stills are the CONE's feather, which this does not touch; a cast line crossing a wall's face at a graze becomes a long gradient (the band
  across the line, seen along it). AND OF THE COLOUR: with the grey gone THE FOG NO LONGER READS AS 'NOT SEEN' WHEREVER IT HAS ITS OWN LIGHT — measured on
  the stills, unseen ground is as bright as seen ground or brighter and more colourful (lamp-lit rooms, the brazier yard, a sodium pool are all fog); under
  a lamp the 40 % dim is lost in the tone map's shoulder. That is his ask taken literally and his call: `dim` lower, or `?fogdesat=0.25`, are the two knobs.
  COST: unknown — never timed. On the replica a seen pixel reads the table 14 times an eye on average and an unseen one 11 (most: about 200 beside an eye
  along a slanted wall; bounded by the code at 65 steps × 2 sides × 5 eyes); only pixels within half a band of a sight edge pay more than the row skips.
  The table is a 41 KB uniform read at a per-pixel index, which some GPUs serialise (a read-only storage view is the mend if it shows). `?fogedge=0` is the
  way out. NEVER SEEN ON A GPU, never played: how the band reads in motion (a sight line sweeping as a man turns), whether 0.5 m is the right width, and
  whether the fog still reads as fog now that it has its colour (`dim` is the knob).
- **A held man drops his gun** (`HOLD.dropGun`, the table in `src/game/character.ts`; the rule is `player.ts startGrab`; ON in the page, `?nogundrop` puts it
  off; OFF in the module and on the frozen stand, `TPS_HOLDDROP=1`; a `FROZEN_HOLDS` row; a recording from before the key replays with it off). The maintainer,
  10-15, of a rifleman in his arm with the rifle up in his fist: "held enemies should drop their gun". As the arm goes round, the weapon in his hand (rifle or
  drawn pistol) is knocked out of it by the dying hand's own road (`combat.ts dropFromHand`, quietly) and lies on the floor like any dropped gun; `Guard.gunLostAt`
  is when (saved in a checkpoint), `inHand` answers null for as long as it stands, the weapon light goes down with the gun and sputters out there, a pistol man's
  holster is drawn empty and a rifleman keeps the sidearm on his thigh. A calm man with the torch in his hand loses the torch, as he always did, and his pistol
  stays holstered. Choked, cut or struck, nothing more falls from him. SETTLED THE PLAIN WAY: the one end that leaves him on his feet (`handBack`: Sam put down
  with him in the arm, or a cancel) has him take it up again at once — the floor gun is removed, it is in his hand, and his stagger is `HOLD.regrab` 0.9 s
  longer; nobody else picks a dropped gun up (nobody ever did). The hold itself is not filed in a checkpoint, so a forced save taken in one loads him on his
  own feet: `guards.ts gunBack` gives him the gun on his first update there too (a second reader's find: he loaded empty-handed and fired 14 rounds from
  nothing). A torch lost at an earlier grab stays lost through a later gun drop. Check: `probes.ts holddrop` (family `grab`; `HOLDDROP_BREAK=1` fails), green
  on both stands. NOT SEEN on a GPU; there is no stooping move for taking the gun back, and it comes back from wherever it lay, however far Sam walked him.
- **A held man keeps the hold's facing** (`HOLD.oneFacing`; the rule is one clause in `nightbreach.ts`; ON in the page, `?holdyaw=0` puts it off; OFF in the
  module and on the frozen stand, `TPS_HOLDYAW=1`; a `FROZEN_HOLDS` row; journaled like the key above). The maintainer, 10-15: "weird pose after rotating after
  grabbing someone". Measured on the pass as he opened it: with the room fight owning the defenders the pair is rigid through any turn (0.27 m ahead, chest on
  Sam's facing to the degree) — what read as weird there was the rifle held at the ceiling in the raised fist, which the key above takes away. Where the room
  fight does NOT own them (its switch off, the sandbox's AI off, a director run) the night mission turned every calm defender to his mark each frame, the man
  in the arm too: his chest stayed on the mark while Sam turned, up to 171 degrees off. On = a held man is skipped there. Check: `probes.ts holdturn` (family
  `grab`; `HOLDTURN_BREAK=1` fails): a half circle each way and a flick, rule off 171.6 degrees off, rule on 0.0. NOT SEEN on a GPU.
