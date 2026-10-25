# Stealth and what you see

One of the area files CLAUDE.md indexes. Everything below was moved here word for word from CLAUDE.md on 2026-10-13, in its old order;
"the bullet above / below" in a bullet means its neighbour there (each block says which lines it was), and a bullet named by its bold
title may now live in another file of this folder: `grep -l '<title>' docs/agents/*.md`. New bullets for this area go at the foot of this file.

<!-- was CLAUDE.md lines 1541–1610 -->
- **THE FOG'S FOUR PRINCIPLES, AND WHERE EACH IS ASKED (agreed by the maintainer 10-23; read this before adding anything the fog touches).** "The
  fog hides other people. It never hides the place, and it never hides your own team." A new effect asks ONE question, whose is it, and takes
  that kind's rule; it does not get a fog exception of its own. (1) THE PLACE is always alive: walls, floors, weather, lying snow, every
  light's glow on the room, and all smoke and dust (`FOG.air`). (2) WHAT YOUR OWN TEAM DOES always shows: its flashes, tracers, rubble and
  particles (`FOG.ours`: a box's `owner` in the team's set, in `FogOfWar.things`); a blast adds no eye and shows nobody hidden. (3) EVERYONE
  ELSE IS WHERE YOUR TEAM LAST SAW THEM, and what they changed stays as last seen until the team looks: men (`hidden` / `seen`, a body kept
  for good), doors (`doorShown`), lamps (`lampSeen`, and the bulb's own face: `FOG.kept`), furniture (`things` / `thingSeen`), one-frame
  boxes such as another man's muzzle flash (`cellSeenAt`: never shown unseen, even a shot at the team), resting litter (`FOG.kept`), marks
  in snow (`FOG.tracks`, `groundLook`), and all of it through a file load (`FOG.filed`). (4) TO SEE MORE, GET MORE EYES ON IT (`FOG.eyes`,
  `fogEyeCount`; a sticky camera, a peek round a wall's end, a thin thing that does not cut the sight: `FOG.thin`). BESIDE THEM: you hear
  everything; the enemy never reads the fog; there is one fog picture; a teammate's own eye passes what the fog's lines pass (`FOG.mates`). KEPT ON PURPOSE: a blown wall or broken glass shows at once (it is
  loud); a living man's last-seen mark fades in seconds. NOT YET UNDER THE PRINCIPLES: a furrow, a dent or a crater in snow made by a thing
  nobody sees (`snowMarks.ts`); broken pieces and items after a file load. THE OLDER LOOKS STAY (`FOG.full` off, `FOG.lit` 0, `FOG.flat`
  off and the rest of the fog's `FROZEN_HOLDS` rows): the frozen stand is every frozen digest's ground, so they are not retired; the page
  runs none of them. Each principle's own bullet, with its switch and check, is below (`FOG.air`, `FOG.ours`, `FOG.thin`, `FOG.eyes`,
  `FOG.kept`, `FOG.filed`, `FOG.tracks`).
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
  26 of 26), a decal on a remembered thing is hidden while it is remembered, and a tripwire's DRAWN beam ends on a remembered box — its SENSOR does not: while the fog runs the sensor's reach (devices.ts `LaserRt.sense`) is asked of the statics, the leaves where they stand and the props, not of this list (devices sense under the fog only on a quiet mission's rung or a solo `?fow`; never in a team scenario). In a checkpoint since 10-24 for furniture (`FOG.filed`, its own bullet below: held and left-out pieces are filed and no opening half second follows a load; items and rubble still re-prime). `FOG.flat` (0 = off = ships;
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
  of `fovDeg` 110 about the normal (160 until 10-13), the fog's own cone width while `FOG.cone` is on; lying flat all round; the newest served first inside the fog's eyes (`FOG.eyes`: 5 until 10-24, 7 in the page since); `max` 3 on the walls at once, one more
  retires the oldest). ONE LIVE FEED (`STICKY.live` 1 — the balance his pick asked for; Tab 'cam ▸ live feeds' 1‥3; `live` = `max` and `fovDeg` 160 = the cameras as they first shipped, and a recording from before the key replays so): only the newest `live` stuck cameras SEND (`stickyLive(pl)` → `stickyEyes`); the others stay on their walls, dark — a second camera is a second LOOK, not a second eye, so two cameras are no longer a floor's worth of coverage left behind — and a sending camera's lens is drawn dull red (`LENS_LIVE`), a dark one's black. The sheet's row says it in one line (levers.ts `CAM_WORDS`, a tooltip). MEASURED on the maintainer's 253 s police-post tape (`sticky-cover.ts --tape`; of the moments a guard stood within 12 m with no line to him, the share the cameras gave back, as first built → now): two cameras placed as well as possible 19.8 % → 15.0 %, two at the nearest walls 15.3 % → 7.5 %, three placed well 25.6 % → 17.2 %. Nobody on the floor notices one and nobody picks one up (open calls); its only cost in play is the launcher's small noise and a tick where it sticks ('prop' events).
  Per-player state on the Player (`Player.cams`, `camSeq`), no dice, a checkpoint slice (`stickySnapshot / stickyRestore`; one in flight refuses a plain save, a forced one files it back on
  the rifle; the slice carries `camSeq`, the run's count of camera ids, so an id is never handed out twice). KNOWN: a card with no rifle gets no camera, the mission's `cams=N` included (the camera is the
  rifle launcher's load: the row still reads 2); a squad of four under the team's fog filled the fog's five eyes, so a camera there lifted nothing — with `FOG.eyes` at 7 (the page since 10-24) it is the sixth eye (`STICKY_STATS.blind` counts those frames). A camera's lens is drawn red only while the fog took it as an eye THAT frame (`stickyBoxes` reads `fogOfWar.eyes`: black with no fog up and past the fog's eyes). The mission's cameras are handed only where the fog is up (`?quiet&nofow` = none) and are let go of BEFORE a quit's stop (its restart kits the fresh player); a kept 'None' survives all shown under `?quietdef=off` too. KNOWN, left: an old kept rung or `quietfog=team` link with no `cams` key now gets the cameras (they come with the fog); 'newest' is firing order, not sticking order. The debrief says 'placed a sticky camera' (a 'thrown' row of kind `cam`; the thrown count and the par clock are untouched). Tab ▸ Player & weapons ▸ Sticky cameras.
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
  QUIETFOG table in a recording, one from before the key replays with it off; Tab row 'cam ▸ solo night fog'. Checks: `bun run tools/qa/probes.ts solo-fog` (family `solofog`,
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
  AFTER THE STEP: a squad mix kept on the machine (the three levers) no longer says its line ("Your own mix, kept on this machine: …") under the lever
  rows of the solo night's or a quiet mission's Team & kit screen: none of it acts there and its fog word read against the quiet fog's row
  (`ui/loadout.ts paintLevers`, the kit card's file; words on a screen only, no switch). `levers-screens` holds it on both stands; red on the tree before.
- **How much you're told is a fourth difficulty lever, and a squad mission's fog can be put off** (`src/game/told.ts` TOLD; 10-23, from the maintainer's
  "how do we communicate friendly and enemy AI state to the player (especially on easier difficulties)"). What was there: every setting only took signs
  away (the fog's cones, own eyes), and the last-seen mark (`fogofwar.ts lastSeen()`, the fading '(?)' `ui/overlay.ts` draws) was built and at 0 s
  (`FOG.lastSeen`). THE LEVER: `You're told`, three rungs from the easiest, GUIDED · STANDARD · BARE, a fourth row under Enemy kit on the mission sheet,
  the Setup rail and the loadout screen (`difficulty.ts leversNow()` = LEVERS plus this one; `ui/levers.ts` draws whatever that list holds). The level
  standard puts it on Standard and hard on Bare; Guided is no level's, it is reached by moving the lever (a mix of your own, kept on the machine with the
  others, `?told=guided|standard|bare` for a visit). Left alone it follows the level the other three stand on (`difficulty.ts levelOfThree`): fog cones +
  AI hard set by hand over standard is still Hard, with this row on Bare, so a machine that kept that mix reads as it did. The row moved by hand off
  its level's rung is a mix (`custom`: records and pars are filed there, `main.ts`). WHAT A RUNG DOES TODAY, one thing: an enemy who goes out of the team's sight keeps his mark for `TOLD.standard` 4 s on Standard, `TOLD.guided`
  10 s on Guided, none on Bare (the debugger's `FOG.lastSeen` row is 0 as shipped; turned up it is the seconds on every rung). The mark is drawn
  only under a fog; the row stays live with the fog's own, its off rung included, because the lever is for more signs than this one. The mark is the HUD's alone: no game code reads it, so a run
  digests the same on every rung and with the lever off. A LATER SIGN ASKS THE LEVER, never the difficulty: `toldAtLeast('standard')` (shown on Standard
  and Guided) or `toldAtLeast('guided')` (Guided alone); with the switch off both answer as Bare. A sign that would show a defender COUNT stays off
  Guided without the maintainer's word (menus.md, the mystery rule). THE FOG OFF (`TOLD.fogOff`): a squad mission's fog lever has the quiet missions'
  bottom rung, off (`difficulty.ts FOG_OFF_RUNG`, `SET.fog 'off'`, `?fog=off` for a visit): `scenarioRun.ts fogOfQuery` then raises no fog on a room
  clear's or a rescue's link (one that asks for the fog by name, `fow`, still gets it). NO FOG IS NO FOG FOR THE SQUAD'S CODE TOO: `fogOfWar.sighting()`
  and `hidden()` answer for every enemy, so `wallcharge.knownFoes`, a pair's foe list and the 40 mm count men nobody saw, and the wand and the sticky
  cameras are not offered. The rung's words say the team knows too; a fight under it is NOT the fogged fight with more drawn, and nothing has measured
  it. It is the cheap test, the floor under Guided, not Guided. `fogOfLink` is the old
  answer ('does this mission have a fog at all'), which is what keeps the lever's row live on the screens while the rung is off. A quiet mission's and
  the solo night's fog is still their own pick (`quietfog.ts`), a Training lesson reads no lever. SWITCHES: both ON in the page (`?told=0`,
  `?fogoff=0`), OFF in the module and on the frozen stand (`TPS_TOLD=1`, `TPS_FOGOFF=1`; FROZEN_HOLDS rows `TOLD.on`, `TOLD.fogOff`); the TOLD table
  rides a recording, and one from before the keys replays with both off (`journal.ts`). Off = three levers, three rungs of fog, `FOG.lastSeen` alone
  deciding the mark. No debugger row yet. CHECKS: `bun run tools/qa/probes.ts told` (`tools/qa/told-check.ts`, 23 verdicts, `TOLD_BREAK=1` exits 1 on
  both stands): the rules with the switches down and up, the URL and the store, a squad link with the fog off hiding nobody, a sighting and a loss on each
  rung (mark at 0.75 s, at 5 s, at 11 s) with the four runs' digests equal, the real sheet and the loadout screen on a fake DOM, the words (no digit above 5, no compass word),
  the two stands and the journal. The real page: `PORT=<port> node tools/qa/told-page.cjs <dir>` (the start page's rail at 1440x900 and 1000x673, then
  a room clear in play on the software adapter under Guided, Bare and `fog=off`; `GAME=0` skips the second half, `TOLD_BREAK=1` must fail). Older checks
  that count three levers hold both switches down for their run (`levers-probes`, `quietfog-check`, `sticky-check` stickyWays, `calls-probes` calls-lastseen: `told-check.ts threeLevers`).
  NEIGHBOURS' FILES, a few lines each: `difficulty.ts`, `fogofwar.ts` (one line in lastSeen), `scenarioRun.ts`, `ui/levers.ts`, `ui/missions.ts`,
  `ui/loadout.ts`, `host/profile.ts`, `standup.ts`, `standEnv.ts`, `knobs.ts`, `journal.ts`. WHAT MOVES IN THE PAGE WITH NO FLAG: a mission on Standard
  shows last-seen marks for 4 s where it showed none (Hard is as it was), and a Training lesson under a fog does too (lessons stand on standard).
  A visit with a switch off keeps the kept rungs it hides (`keptHidden`). KNOWN, LEFT: (1) the fog put off on the sheet in mid-mission acts at the
  next deploy, where the fog's other rungs act at once; (2) the wand's and a camera's own marks (`markSecs`) are untouched; (3) `write()` sets
  `TOLD.rung` with the switch off too (nothing reads it then), and over a harness `--set TOLD.rung`. Measured on one level (the pair's room
  clear), one seed, both stands. Never seen on a GPU and never played: whether 4 s and 10 s read right, and whether the '(?)' is enough of a sign, is
  the maintainer's to say.
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
- **Interaction = rows + one Space grammar** (`player.ts buildInteractables` → `Game.nearby` / `hover`; `interact.ts`; a PROTOTYPE draws the same rows as a
  ring at the cursor with no hold and no cancel row, `CMDRING.hands`, off unless `?cmd` asks: squad.md 'The orders ring on Tab'): every verb is
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
- **The wall taken without the key** (`WALLSNAP.press`, player.ts `wallPress / pressFace`; the maintainer, 10-20: "when you like push against the wall, you
  snap to it … make it a game option … I do want it to feel really great"; if it plays well Q can be freed, which is HIS call after playing: Q does all it
  did). ON in the page with the feel pass (`?wallpress=0` = Q alone; Options ▸ Game ▸ 'Walk into a wall to take it', kept; debugger rows 'wall snap: walk
  into a wall to take it', '▸ walk in: wait (s)', '▸ walk in: taken from (m)'), OFF in the module and on the frozen stand (`TPS_WALLPRESS=1`; a `FROZEN_HOLDS`
  row; the journal carries it and a recording from before the key replays with it off; like any debugger row, flipped in the middle of a recording it is
  not in that recording). THE RULE: a move key held within `pressDeg` 35° of square INTO a face within `pressNear` 0.6 m of his body runs a clock; at
  `pressSecs` 0.18 s, once he is inside `pressFlow` 0.2 m, it is `wallSnap` kept to THAT face (`findWall`'s new `only`), so the same faces, the same
  refusals, the same hold as Q, and nothing said where the wall refuses. A walk straight at a wall therefore has it before he touches it and at the pace he
  was walking; a man stood against one waits the 0.18 s. NEVER: at a run; along a wall (a diagonal); on a door's leaf; with his hands on a body, a leaf or a
  charge, a list or an order menu up, or a mouse button held; with the gun in his hand reloading or still coming out; inside `pressAfterShot` 1 s of a
  round of his own; with a sidearm or a can in hand while an ENEMY is alert (`pressCalm`: the back hold would put it away; the rifle stacks in his hands
  either way; his own side and civilians do not count). A THING TO USE ON THE FACE (a door, a switch, the breaker, the mission's thing, a sticky camera, a
  body, its row in reach and within `pressThingAt` 0.9 m of where he walks into the wall): the wait is `pressThing` 0.5 s and all of it against the face,
  he walked up to use it; a step further along a door's wall is the plain take (where a man stacks). A wall charge's row is NOT such a thing: with charges
  in the bag every partition he looks at has one. THE LATCH: when a hold ends, or the wall refuses a take, the stick as it then stands is remembered with
  that wall. Until the stick rests or turns `pressTurn` 50°, a wall facing as that one does is not taken at all (Q, Shift or a step away is never undone by
  the key still held; a refusal is not asked again every frame) and any other wall not for `pressAgain` 0.6 s (stepping off does not throw him across a
  narrow passage; a walk straight across the office corridor has the far wall as he arrives, 0.8 s after letting go: ONE HELD KEY CROSSES A CORRIDOR FROM
  WALL TO WALL, which is meant, and is the first thing to ask him about). A frame his feet were not his own (a blast, a beat) starts the wait again.
  Letting go is the feel pass's own (the stick held away 0.10 s, Q, Shift). State: `wsPress` (a `SideMap`). IN A CHECKPOINT (10-20, after `probes.ts savetimeline`
  went red on the page's stand: with walls taken by walking a save finds him on one as often as not, and no file had ever held a hold, so a load stood him
  free of the wall, the pistol the hold had put away still away, and the seconds after parted from the save's): `SAVETIMELINE.holds` (savestate.ts; ON in
  the page, `?saveholds=0`; OFF in the module and on the frozen stand, `TPS_SAVEHOLDS=1`; a `FROZEN_HOLDS` row; the journal carries it and a recording from
  before the key replays with it off). With it on a save carries the hold as it stands, however it was taken, and the take's clock and latch
  (`SaveState.wallHold`, player.ts `wallHoldSnapshot / wallHoldRestore`: the table `WH` names every field of `WallHold` and how a load reads it, so a new
  field does not compile until it is named; a slice that is not a hold he could be in where he stands is no hold; the camera the hold eases is handed back
  by the next frame). The same red line had a second cause that the new routes walked into and that is not the wall's: the close-in mode's held gait
  (character.ts `crT / crW / crPace`) was begun again from nothing by a load, which put his first footfalls three frames off; under the same key a save
  made inside the mode carries it and the man the mode is held on (`PlayerSnap.heldGait / closeOn`, `heldGaitSnap / heldGaitBack`, close.ts
  `closeModeSnapshot / closeModeRestore`). NOT in a file still: the animator's wall stance, so for about a fifth of a second after a load on a wall his
  body leans back onto it from a free stand (his feet and the hold are right from the first frame). Its break: `TPS_PROFILE=shipped TPS_SAVEHOLDS=0
  probes.ts savetimeline` is red on line (2). In the real page (the software adapter, one boot, never seen on a GPU): a save made a
  few frames after walking onto the corridor wall holds the slice, its load stands a new player on the same wall at the same place, the same file with the
  slice cut out leaves him free, no console error. The Controls list and the key list do not
  mention it (show, not tell; they would be wrong with the row off). CHECK: `probes.ts wallpress` (`tools/qa/wallpress-check.ts`, families `wallsnap` /
  `wall-snap`) 10 of 10 on both stands, `WALLPRESS_BREAK=1` fails 7 of 10 on both (the tenth line, the checkpoint's, raises `SAVETIMELINE.holds` itself; its latch case walks into its wall, so the break takes it too); its camera line asks 192 key-and-camera combinations stood against the wall
  (40 take it, none wrong). Measured headless on the office corridor, one seed: from 1 m the hold begins at 0.70 s with 0.18 m to go and his back is on the
  wall 0.18 s later, no frame of the take longer than his walking stride. A review of the first cut found, and the check now holds: stepping off flipping
  him to the far wall at once, a Shift tap undoing Q, one latch for every wall (a corner's second wall refused), a pistol reload thrown away, a door's rows
  not counted as a thing, his own side's alert counted as the enemy's. NOBODY HAS PLAYED IT and it has never been seen on a GPU: how often a wall is taken
  that was not wanted in real play is unmeasured, since no recorded human session is in the repo and the tour's man is a puppet the rule leaves alone.
- **Q is free: the wall hold has no key on the page's board** (`KEYMAP.qFree`, `src/host/keymap.ts`; the maintainer, 10-21, from play:
  "snapping feels good, we can remove Q"). Walking into a wall takes it (`WALLSNAP.press`) and a step away or a run lets go, so the hold's own key
  is spare. NO RULE OF THE GAME CHANGED: player.ts still asks `input.hit('KeyQ')` and means the wall hold by it, so every probe, tape and journal
  that holds 'KeyQ' plays as it did and there is no knob, no `FROZEN_HOLDS` row and no journal key (one message lost its '(Q)': 'the wall is in the
  way — step out past its end, or off it'). What changed is the BOARD, at the keyboard (`gameCode`): the wall hold's row is built with no key
  (`FREED` in keymap.ts), Q pressed files nothing, and the code is given only where the player has put the row on a key in Options ▸ Controls (Q
  itself if he wants it back: a rebind like any other, kept, Reset takes it off). ON in the page (`keysBoot`), `?qfree=0` = Q takes the wall as it
  did; OFF in the module, so a tool, the editor and both headless stands never meet it. It does not wait on `KEYMAP.on`: `?keybinds=0` is the build's
  own board, and that has no wall key. ONLY WHILE WALKING IN WORKS (`KEYMAP.freeWhen`, set by main.ts to `WALLSNAP.on && walkInNow()`): with the
  walk-in switched off (Options ▸ Game, a kept choice, `?wallpress=0`) the row is on Q again there and then, so no board is without a way onto a
  wall unless the player took the key off himself; `walkInNow` (ui/options.ts) reads the kept choice before the Menu has put it on the table, so
  the boot card and the keyboard agree with the page that follows. KEPT AS HE SET IT: a freed row's entry in the kept table is never folded into
  'as built' (what is built moves with the two switches): Q put on the row by hand stays through a `?qfree=0` visit or a spell with the walk-in
  off. THE LETTER IS NOT THE ROW'S while it is freed and unbound: `keyText` rewrites no line for it. WHAT FOLLOWS, all through one helper
  (`wallWay()` in ui/options.ts: 'key' | 'walk' | 'none'): the Controls list keeps the row, its cap a dashed — that is not marked as moved, its
  words 'Back to a wall: walk into it' ('none' = he unbound it AND switched the walk-in off: 'no key: click the cap to give it one'); the start
  card's and the boot card's list show a 'Wall' row for the 'Q' one (`controlRows`, ui/menu.ts; no row for 'none'); Options ▸ Game's walk-in row
  says 'Off, Q takes it instead'; two lesson lines no longer name Q (train-move 'Walk into the container and keep walking: your back goes to it',
  train-hands 'Back to the wall in the dark corner beside it'); the README's Play table. WHAT ONLY THE KEY DID, gone from the page's board unless
  he binds one: taking a wall with a pistol out while anyone is alert (`pressCalm` keeps the walk-in from putting his gun away in a fight; the
  rifle's stack is still taken), letting go without moving, Q's longer reach from a walk and Q a moment early, and a wall beside a door or a thing
  to use is slower to take (`pressThing`). KNOWN, NOT MENDED: a player who has the walk-in switched off reads the two lesson lines' 'walk into'
  and has to know Q; the wall's row taking a key another row has leaves that row with none (the rebinding's own 'none to give' rule, now the
  common case for this row); the day a second row takes the cap 'Q' the wall hold's row wants another name for its cap (keymap.ts header). THE
  LESSON BOTS (tools/qa/lessons) and every wall probe still write 'KeyQ' straight in: that is the game's code, not the board's key; a bot that
  walks in instead went down later in train-move for a reason not found, so they were left. CHECK `probes.ts keybinds` (family `player`): four 'no
  wall key' lines (the table and the walk-in off; rebinds, old kept tables and 4,000 moves by a die with the walk-in flipping; the game beside a
  wall, three ways in; both lessons' wall steps done by a held move key where the step asks, the walk-in forced on), 13 of 13 on both stands,
  `QFREE_BREAK=1` (the board as it was, and no walk-in in the lessons) fails those four; `tools/qa/keybinds-page.cjs` runs its older lines under
  `?qfree=0` and three new ones on the page's board (12 of 12 in headless Chromium, no adapter). ONE BROWSER RUN on the software adapter (the
  first cut, before the walk-in rule above): real keys, Q held 40 frames beside a wall files nothing and takes nothing, W held takes the wall in
  17 frames, S lets go in 6, no error but the usual favicon 404; the start card's list was not reached. NOBODY HAS PLAYED IT, never on a GPU. OPEN,
  his: what Q does next is the Commanding goal's (the command key, from Tab); whether a pistol out in a fight should take a wall by walking in.
  SINCE THEN Q IS THE SQUAD'S COMMAND KEY (`KEYMAP.qCmd`, `docs/agents/squad.md`): while it is, the wall hold does not come back to Q with the
  walk-in switched off; it has no key until given one. `?bkey` is this bullet's board by itself.
- **The wall hold, heard and unhurried** (`WALLSNAP.voice`, `WALLSNAP.slow`, wallsnap.ts; the maintainer, 10-21, from his play: "we should have some audio
  feedback for when you snap/unsnap from a wall. the transition animation is also too fast, should probably be 2x slower"). Two switches, each acting only
  with the feel pass (`WALLSNAP.on`), for Q's take and the walk-in take alike, back hold and stack alike. Each ON in the page (`?wallvoice=0`, `?wallslow=0`),
  OFF in the module and on the frozen stand (`TPS_WALLVOICE=1`, `TPS_WALLSLOW=1`), a `FROZEN_HOLDS` row each, in the journal's knobs (a recording from before
  the keys replays with both off). HEARD (player.ts `wallVoice`): sfx `wallOn` as his back lands (the frame the old scuff played on, which it replaces: that
  was a footstep's voice at 0.3, about 5 dB UNDER one of his own steps, and nothing at all on the way off) and `wallOff` for each of his own ways off (Q, the
  stick held away, breaking into a run) and when he is pushed off a wall he was seated on, never off a take let go of before his back landed; a takedown, a kick, a pick, a teleport, going down have their own
  sounds or none. The player's ears only: no event is filed, no noise is raised, nobody in the level hears it. Gains `voiceOn` 0.35, `voiceOff` 0.5 (by the
  offline render's loudest 50 ms: the landing about 2 dB over one of his own footsteps, the step off about level with one; first written at 0.6 and 0.6,
  brought down because a sound well over a footstep that no guard hears parts what is presented from what is sensed. HIS CALL, open: louder, or a wall
  taken beside a guard heard by him). UNHURRIED: `wsTakeSecs` × `slowTake`
  (2: a short step 0.24 s, a long reach and a half turn 0.6 s; the glide, the turn and the feet's steps share that clock), the pose's weight comes on at
  `slowIn` 11 instead of 22, the stack's at 6.5 instead of the stance's 13 (character.ts `anim.stanceIn`, set while he holds a wall, at rest off it) and lets go on his own way off at `slowOut` 12
  instead of `outRate` 24. Off = the take as it was, by the check's frames. A STALL IT SHOWED, mended at its cause under the same switch: with a key held ALONG the
  wall through the take the station runs on ahead of the glide, the body landed a hand short of it, and moveOnWall's firm read-back took that for a man
  holding him back and shut that way for half a second. During the take the body now rides the station's own advance, so the glide closes on a place that
  holds still for it (the sidle through a slow take is then the sidle through a quick one, frame for frame). With the switch off the old arithmetic stands,
  and a 0.30 s take with a key held is close to the same stall (about 1.9 cm a frame against the cap's 2 cm hair): not mended there, the digests being
  what they are. ON THE STACK a click that fell inside the take was always dropped (stackUp holds the trigger while he comes onto the wall); the longer take
  makes that window matter, so under `slow` the click is kept (`w.owed`) and brings the rifle up as he lands: one click, one round. What
  the slowness costs is its own length: the peek and the stack's lean and first round all wait for the landing, 0.1 to 0.3 s later, and the first frame of the take covers 6 to 9 % of the way where it covered 10 % or more (the feel pass's 'moves on the frame of the key'). Debugger rows (the wall snap's group): two toggles, 'sound: onto the wall',
  'sound: off the wall', 'take: times as long'. CHECK: `probes.ts wallfelt` (`tools/qa/wallfelt-check.ts`, families `wallsnap` / `wall-snap`) 9 of 9 on both
  stands, `WALLFELT_BREAK=1` fails 4 of 9 on both; the feel pass's older probes run with whatever the stand has too (10-21, after a build's reader asked: three of them had held both switches off). Three of their lines read the rules: `wallsnap-take`'s clock is within 0.12 to 0.30 s times `slowTake` and the key's frame covers 10 % over `slowTake` of the way, `wallsnap-landing` wants exactly one `wallOn` and no old scuff beside it (one `footSoft` with `voice` off), `wallsnap-off` wants the pose under 0.45 ten frames after Q under `slow` (0.41 measured at `slowOut`; under 0.2 without, 0.09 measured), the pistol's lowered carry having him from frame 14. Every other line of the three is the bar it was; `wallpress`'s walk-in landing bound follows `slowTake`. Measured headless on the office corridor's north wall, one seed: Q a step off with his back to it 9 → 19
  frames (0.16 → 0.33 s), Q nose to it 14 → 28 (0.24 → 0.48 s), the key held into it 11 → 22 (0.18 → 0.37 s), the fastest frame of each about half what
  it was, each ending on the same spot and facing. In the real page (the software adapter, one boot): both switches read on, Q's take ran 26 frames on a
  0.44 s clock, the mixer was asked for `wallOn` once at the landing and `wallOff` once on Q off, no console error. NOBODY HAS HEARD EITHER SOUND (written
  by numbers: there is no audio in the cloud) and nobody has seen the slower take; never on a GPU. Whether twice is the right slowness, and whether the landing reads as a back on plaster, are his to say by ear and eye.
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
- **The whistle's answer, torch up in the hand that holds it** (GUN HAND, `src/game/gunhand.ts` `GUNHAND.on` + key `whistle`; `character.ts` `torchUpLayer`,
  the torch branch of `inHandWord`). THE FAULT: upper `'torch'` plays the library's `Idle_Torch_Loop`, keyed for a torch in the LEFT hand — an empty left fist
  came up ahead of the chest while the torch, and the light placed off its lens, stayed in the hanging right hand. THE RULE: the clip gives the trunk and head
  only (`torsoMask`); the left arm stays the legs' clip's; the right arm is solved to an overhand hold, the wrist 22 cm ahead of and 4 cm above its shoulder
  joint, forearm up, the back of the hand to his right, so the torch lies level through the fist with the lens out of the little-finger side (thumb to the
  lens, a forearm that high points it at the ceiling). Shoulder-relative: it rides the chest twist. Up and down on its own clock (`tuK`, 0.4 s, eased both
  ends: at the carry weight's 9/s the hand turned 20° in a frame). The torch's boxes and the light are placed off the right wrist as ever (`rigTorchPos`), so
  the light is now at the raised lens, about 1.47 m up and 0.35 m ahead of him, not at his thigh: what guards and the meter read off it moves with it. The
  beam's line is unchanged (`torchCarryDir`). IN HAND's torch branch turns the fist's thumb line onto the torch's axis the short way; raised, the short way is
  thumb to the TAIL (`anim.torchUp` > 0.5), and the turn stands down as the arm passes between the two carries. Other users of upper `'torch'`: none in the
  game (calmtorch.ts reads `handCarry`, not the pose); the viewer's upper-body row `torch` shows the same layer. SWITCH: on in the page, `?gunhand=0` off, held off
  on the frozen stand, `TPS_GUNHAND=1` raises it there; `whistle: false` under the switch = this move as it was. Off = the pose bit for bit (check line 8). Not
  look-only: a run with it on is not the run with it off. CHECK: `bun run tools/qa/gunhand-whistle-check.ts` (probe `gunhand-whistle`, family `gunhand`),
  `GUNHAND_BREAK=1` fails lines 3, 4 and 9; both stands the same numbers. MEASURED (bench: 4 sets — standing, walking, looking aside and down, walking and
  looking aside — 360 settled frames; one game run, seed 760, the whistle-torch staging): rule off the left wrist 33.6 cm or more above the legs' clip's and
  the right 47.7 cm or more under its shoulder, the light 68.7 cm from the raised fist; on, the left wrist within 4.9 cm of the legs' clip's (1.5 standing),
  the right 4.0 cm above its shoulder and 16 cm or more ahead, the fist's hollow 1.2 cm from the torch's line with its thumb line 0.1° off it (IN HAND on),
  the light 1.5 cm from the lens box; the hand the game reads turns 11.0° a frame at most, as drawn 14.1°; in the game, left wrist 51.4 cm under the gun
  shoulder, right 4.0 above, his light 1.5 cm from the drawn lens. STILLS: `tools/qa/pose-mesh.ts defender_2 torch-up --inhand [--gunhand]`. Never seen on a
  GPU or in play; nobody has judged the raise in motion, the fist against the jaw of each cast variant, or how the higher light reads in a room. LEFT: a
  man whose torch was knocked out of his hand at a grab (`torchLostAt`) and who then answers a whistle still takes the torch upper (`handCarry` says torch),
  so his empty right fist comes up — it was his empty left before.

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
  with its own probes). ARMS ONLY OTHERWISE (the arms' weight a straight ramp, `STEALTH.inSecs` / `outSecs`, shown through a smoothstep; a stagger's clutch, bound hands
  and the second pass's own arm work stand the layer down): no pelvis sink, the head and chest bones within 1.2 cm of the switch-off run and the head never higher, `pos` the
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
- **The wand is set up in the time its animation takes** (`WAND.quick`, a key of the wand's own table — ON in the page, `?nowandquick` = the 1.5 s feed and its ring, as it
  was; OFF in the module and on the frozen stand, `TPS_WANDQUICK=1`; a `FROZEN_HOLDS` row, the word in `STAND_ENV`, a debugger row and slider, and a recording from before the key
  replays with it off; acts only with `WAND.on`). The maintainer, 2026-10-22: "setting up the optical wand should be faster. pretty much just the time for the animation and none
  of the waiting time with the spinner (which we can probably just remove)". With the key on the lens is through the first step he is PLANTED (at the middle of the leaf, both
  hands on it — the gate the feed always waited behind), DOWN (the animator's crouch past `quickDown` 0.9) and the animation's time has gone since the look began
  (`Wanding.age`; `wand.ts wandThrough` / `wandFeedSecs`: the squat's own `STEALTHPOSE.cableIn` where the squat is drawn, else `quickSecs` 0.4): nothing is counted after the
  animation, and where putting the gun away takes longer, that is the wait. A teammate's FIRST look on an order is through the same way from his mark at the door
  (`wandorder.ts`); fed AGAIN after the fight or a flash took him off his knee (`Job.again`) it is the old `feedSecs` — a lull in a fight is not a set-up, and his "wand's in."
  must not come back every half second. The row of a look under way keeps its words and draws NO ring and NO bar, feeding or looking (`running()` with no `progress`), and the
  log says one line ('the wand is through'), not two. Nothing else moves: the lens, its wedge, what pulls it out, the stow after. Measured headless, one stage each, the same on
  both stands: Space to the lens through 1.63 s → 0.42 s (hands on it at 0.12 s there), a teammate from on his mark 1.52 s → 0.42 s. QA: `bun run tools/qa/wand-check.ts quick`
  (`probes.ts wand-quick`, family `wand`; both stands; `WANDQUICK_BREAK=1` must fail): off = the feed and the ring on every frame of the row, two log lines; on = through inside
  the animation's time, more than a second sooner, the same time to hands-on as before, no ring on any frame, one log line; a teammate's the same; the stands' row and a
  recording's tables both ways. wand-look reads the wait as the keys stand; wand-mate's two fed-again lines still hold the 1.5 s on both stands. The kit picture's page check
  (`tools/qa/kitview-page.cjs`) reads the wait off the page's own table and holds the key off for its one pick-half-way-through-the-feed line. On the real page (software
  adapter) `ONLY=play node tools/qa/wand-page.cjs` times it: the lens through 24 frames after the Space, no ring on the row and no bar in the panel on any of them; `ONLY=slow`
  is the same page under `?nowandquick`, the 1.5 s feed with its ring. Never seen on a GPU and never
  played by anybody: whether the lens coming up as the squat lands reads right is a call for an eye (the two sliders are there for it).
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
  nothing in a tape (the memory is re-primed at `reset()`; in a checkpoint since 10-24, `FOG.filed`: a lamp the team knows another way is filed); a recording from before the key replays with 0
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
  pass's own eye ray) into a 58 KB buffer (41 KB until 10-24: five eyes' rows, now seven's) that is the scene group's binding 11 in every pass (a UNIFORM — the fragment stage has no sampled texture left;
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
  The table is a 58 KB uniform (41 KB until 10-24) read at a per-pixel index, which some GPUs serialise (a read-only storage view is the mend if it shows). `?fogedge=0` is the
  way out. NEVER SEEN ON A GPU, never played: how the band reads in motion (a sight line sweeping as a man turns), whether 0.5 m is the right width, and
  whether the fog still reads as fog now that it has its colour (`dim` is the knob).
- **Smoke is drawn under the fog too (`FOG.air`, 10-23; the maintainer, of a shot of the pass with a lit drum and no flame under the fog: "I think we
  should at least show everything in the environment visible at the start of the level all the time?").** PICTURE ONLY, and only under the full picture
  (`FOG.full`: it rides the sight table). THE FIRST STEP OF SORTING THE FOG BY WHOSE A THING IS, NOT BY WHETHER IT MOVES: the place (the level as it
  starts, its fires, its weather, its air) is always shown; the team's own doings are always shown; everybody else is where the team last saw them.
  Before, the smoke's march took no density over floor nobody on the team saw (`common.wgsl fogSmoke`, rule 4g's "what is not light"), so a fire burned
  under the fog (`FIRE.fog`) with no plume, and the cloud of the team's own grenade stopped on the sight line. Now `fogSmoke` hands the density back
  whole while the sight table's head says so (`fogSight.soft.w`, written by `render/fogofwar.ts FogSight.encode` from `FogFrame.air`; that float is NOT
  what `FowU.soft.w` means in the fog pass), and the fog pass dims the frame afterwards. WHAT STAYS HIDDEN: what a hidden MAN puts into the air is not
  filed with the solver at all — his breath and his cigarette already (`snowBreath.ts`, `smokebreak.ts`), and now the gas of his shot
  (`FogOfWar.airHides`, asked by `combat.ts` of every shooter — and true only under the full picture, since 10-24: with `?fogfull=0` nothing draws smoke
  under the fog, so a hidden man's gas is filed as it always was; the probe holds it; `effects.ts spawnShot`'s `gas: false` files no emitter and gives the same flash; only
  while `FOG.air` is on — off, the solver gets everything as it did). A hidden light still gives a plume nothing (`lightFogK`), so an enemy's flashlight
  draws no cone in smoke the team does not see. The PARTICLES' puffs (a blast's dust ring, a round's chip of plaster: `particles_draw.wgsl`) are cut
  over unseen floor unless the team made them: `FOG.ours`, the next bullet. WHAT IT NOW SHOWS THAT IT DID NOT: ALL the solver's smoke, whoever made it — an enemy
  grenade's cloud in a room nobody watches (it was heard), and smoke drifting through a door opened unseen (a hint that it is open). The stricter rule
  (only the place's smoke) would need the solver to know whose smoke is whose; that is the maintainer's call and is asked. NOT HELD, each a tell or a
  flaw to judge on a GPU: (1) a hidden man walking through a plume still stirs it (`game.ts smokeWake` pushes the solver for every man) — live movement
  in the fog; (2) the fog pass dims a pixel by the SURFACE behind it, so the part of a tall plume that stands over unseen floor but is drawn in front of
  seen ground is not dimmed (before, the cut was a curtain on the sight line); (3) a fire lit or put out where nobody saw: the flame is drawn by the
  fog's memory (`FIRE.fog`) and the plume by the fire as it is, so the two can disagree; (4) the march no longer skips smoke over unseen floor: its
  cost in a smoky room nobody watches is not measured. THE ENGINE REPLAY SHOWS A TAPE UNDER THE PAGE'S OWN LOOK, as it does for `edge` and `desat`
  (`FOG_PAGE.air`, `FogOfWar.pageLook`; `ui/replaykey.ts VISIT_FLAGS` keeps a visit's `?fogair`): a tape from before the key would otherwise show no
  smoke under the fog for ever. SWITCH: ON in the module and the page (the `FOG` table's own way: `full` and `edge` ship the same); `?fogair=0` = no
  smoke over unseen floor, as it was; the debugger's fog page has the row ('full: smoke under the fog'); frozen stand: off, `TPS_FOGAIR=1` raises it
  (`FROZEN_HOLDS['FOG.air']`, `host/standup.ts`, `host/standEnv.ts`); `FOG` rides the journal — a recording without the `air` key replays in the
  harness with it off (`journal.ts applyKnobs`). CHECK: `probes.ts fog-air` (family `fog`; 7 lines; `FOGAIR_BREAK=1` red on the block's line) on both
  stands — the block's row every frame and the head's write; the march's rule as written (all three marches and the dust look's twin lines go through
  `fogSmoke`; no other shader reads the row); a hidden defender's gas left out, a teammate's and the player's never, nobody's with the row off; the
  address; the journal and the replay's look; the stands; and the night breach under the full picture, a hidden defender firing one round through
  `fireWeapon` and the team then ordered in, two seeds, 21 s each, digesting the same with it as without, dice and all, his gas left out only with it.
  NOT CHECKED: the picture itself. **Never seen on a GPU**, and not seen moving; whether a plume dimmed to the fog's 0.4 reads as part of the fog or as
  something seen is the maintainer's to judge.
- **What the team does is always shown under the fog (`FOG.ours`, 10-23; the maintainer, of the tutorial's wall charge: "still can't see the wall
  shot detonate" — the fog was taken off that whole mission for it).** The second step of sorting the fog by whose a thing is; under the full picture
  alone (`FogOfWar.oursOn`: the row, the fog on, `FOG.full`'s block filled). It adds NO EYE: the room a charge opens is the fog's picture of it,
  dimmed — the room as last seen, with nobody hidden drawn and nobody hidden casting a shadow (the men the fog filters out hand over no capsules) — and
  nobody in it is drawn until one of the team has a line. A grenade is not a look through a wall. FOUR THINGS TAKE THEIR DOER'S SIDE
  (`FogOfWar.oursId`, read off the team list the fog fills for the lights, `LightSet.fogTeam.owners`, never off `g.guards`: a blast swaps that list
  out while it works). (1) A FLASH NOBODY CARRIES: `lights.ts RtLight.fogBy` = who made it, read by `LightSet.fogClass` in place of `owner` (which
  stays 0: `owner` is also the shadow rule); set through `FogOfWar.lightBy(light, who)` at a round's strike (`combat.ts`), the stun charge
  (`detonateStun`, `it.who`), the frag (`frag.ts`, `spec.who`), the wall charge's afterglow (`blastLook.ts`, the player's) and a tracer's ember
  (`tracers.ts`, through the `Tracers.fog` hook `game.ts` sets: the class stays Game-free). The team's lights the fog's picture, an enemy's and an
  ownerless one only what the team sees, as before. (2) A TEAMMATE'S TRACER is drawn its whole length (`things()`: an unkeyed box whose `owner` is one
  of the team). (3) THE TEAM'S RUBBLE (`debris.ts Chunk.who`, a kinked panel's `mate` box too) is drawn on its FIRST way down and lies in the picture
  where it fell; once the picture has it at rest it is a thing like any other (woken unseen, it stays where the picture has it), and a piece a boot
  slides is nobody's, so walking through rubble still shows nobody. (4) THE PARTICLES: `FogOfWar.begin(who)` / `done()` (or `doing(who, fn)`) name
  the doer round a cause — `fireWeapon`, `detonateStun`, `frag.ts blast`, `Destruction.blast`, the wall and door charges' `blow`, `blastLookTick`,
  `blastFeelTick` (the wall charge's later stages: the dust ring, the roll, the soot, the crumbs), a tracer's ember — and what is filed inside
  carries `Particles.ours` → the emit record's bit 18 → `PB_OURS` (128) on the particle, which `particles_draw.wgsl` leaves uncut over unseen floor.
  A doing by nobody inside another keeps its cause; an enemy's inside a teammate's is his own; a particle that has lain and is woken (a kick, the
  wind, its support gone) loses the mark in the kernel, so litter the team made does not jump under the fog when somebody unseen disturbs it. A
  ROUND THAT STOPS IN A MAN NOBODY SEES (`combat.ts`: `FogOfWar.hidden(hitGuard)` → `hush()`): nothing filed after it met him is marked and its
  flash is nobody's, so no spray and no flash say where he stands. NOT THE PICTURE ALONE IN ONE WAY: the boxes it hands the renderer (streaks,
  rubble) are what the cursor's ray meets (`world.dynamics`), as with every thing the fog shows or holds — so the row is the tape's, not the replay
  page's look (`FOG_PAGE` does not carry it, no visit word). NOT HELD: (a) a lamp shot out by the team (`combat.ts`, `destruction.ts` lamp flashes)
  and what a team's chunk throws up when it lands or breaks on a later frame (`breakTable.ts`) are not marked and are cut as before; (b) a marked
  particle stays marked while it flies, so a team's spark that bounces on into another unseen room is drawn there; (c) the STREAK of a teammate's
  round that stops in a hidden man still ends at him (as its head light, a carried light, always did); (d) with `FOG.air` a team's flash now lights
  the plume over unseen floor too; (e) the first frame the fog is live has no team list yet: a blast on that frame is not marked. SWITCH: ON in the
  module and the page; `?fogours=0` = as it was; the debugger's fog page has the row; frozen stand: off, `TPS_FOGOURS=1` raises it
  (`FROZEN_HOLDS['FOG.ours']`, `host/standup.ts`, `host/standEnv.ts`); the journal carries it (a recording without the `ours` key replays with it
  off). CHECK: `probes.ts fog-ours` (family `fog`; 8 lines; `FOGOURS_BREAK=1` red on whose, the lights', the boxes' and the particles' lines) on
  both stands — whose a doing is; a made flash's class by its doer and the real stun charge's set off unseen by the player and by a defender; a
  streak and a chunk of rubble over unseen floor by owner, in flight, under a boot and at rest; the mark round a real round fired by a teammate and
  by a defender on a stand-in for the GPU system, a teammate's round put into a hidden man (hushed, no flash given), and the record, kernel and draw
  lines as written; the address; the journal, and that the replay leaves the row alone; the stands; the night breach fought under the full picture,
  two seeds, 21 s each, the same digest and dice with it as without (the harness has no cursor). NOT CHECKED: the picture. **Never seen on a GPU**:
  whether a blast under the fog reads as the team's own doing or as a hole in the fog, and how bright the flash should be there (it is dimmed with
  the frame, `FOG.dim`), are the maintainer's to judge. The tutorial's first mission still has its fog off: whether it wants it back is that
  mission's owner's call.
- **Thin things that stand free do not cut the fog's sight (`FOG.thin`, 10-24; the maintainer, of a taken room on The Pass: "weird vertical striations
  due to fog of war + squad's vision").** Every static stopped the fog's eye, on both sides of the one model: the squad's own lines (`segmentBlocked`)
  and the picture's ray (`occludedTBoxes`). So a stovepipe 10 cm across, a window's bar or a lone post each threw a sliver of "not seen" across the room
  behind it, and with men outside looking in through barred windows the floor, rug and back wall were fans of seen and unseen (on The Pass, 3 to 5
  slivers from one eye by a window of the long room, by the game's own sight test). THE RULE (`src/scene/thin.ts thinLevel`, run by
  `host/standup.ts populateHost` after `roundLevel`, on both stands): a static is marked `BoxFlag.Thin` when it is NARROW (under `THIN_WIDTH` 0.25 m
  across in plan both ways), FREE (no solid box beside it over a quarter of its height, counted over all its neighbours; what it stands on or under,
  a pane of glass and the other slabs of the same round thing are not beside it) and NOT A DOOR'S (nothing within `DOOR_NEAR` 0.3 m of a door's shut
  leaf: a jamb or a stop passed would open every shut door — the first version of this did exactly that, by size alone, and a review caught it). A
  breached partition's bare studs are marked as they are made (`wallbreak.ts`). The mark is inert until read: (a) THE SQUAD'S LINES, every eye's line
  in `game/fogofwar.ts` through `sightBlocked` (to a man, a body, a spot, a door, a lamp), pass marked statics; (b) THE PICTURE's fog eye passes them
  too — which boxes, as a bit a box index in the sight table (`FogFrame.thinBits` → `FogSightT.thin`, written to the table and to the stand-in the
  table's own pass reads) — and passes what a man CARRIES (any owned box: another man's gun, a tracer's streak; the squad's lines never met those).
  One test, `common.wgsl fogThinBox`, asked only of a box a ray has already hit, live only while the private `fogEyeThin` is raised by the fog's own
  rays (`fogSeenAt`, the fog pass's `main` and `pre`, the table's kernel). The lines go by the row alone (`FOG.full` stays a
  switch of the picture only); the picture's half rides the sight table, so it is under the FULL picture alone. NOT the picture alone: who the squad has seen can differ behind a pipe, so a digest can. It is
  the FOG's sight only: a guard's eye, a round, a sound and a shadow meet those boxes as ever (a teammate's own eye passes them too since 10-25:
  `FOG.mates`, its bullet below). SWITCH: ON in the module
  and the page; `?fogthin=0` = every static stops the eye, as it was; the debugger's fog page has the row; frozen stand: off, `TPS_FOGTHIN=1` raises
  it (`FROZEN_HOLDS['FOG.thin']`); the journal carries it (a recording without the key replays with it off); not part of the replay page's look (the
  tape's row decides who was seen). CHECK: `probes.ts fog-thin` (family `fog`; 8 lines; `FOGTHIN_BREAK=1` red on the marks', the lines' and the
  block's) on both stands — the marks on all 53 level files, rounded and as slabs (narrow, free, none at a door; The Pass's are its stovepipes and
  window bars), and through each level's own collision no line across a door's frame goes further with the marks passed; The Pass stood up: slivers
  taken away from four eyes, no line shortened, the fog's test across a stovepipe, a wall, every shut door's frame; the block, its bits and the box list they were read off (a frame drawn after a wall is rebuilt and before the
  next fill passes nothing: `FogSight.encode`);
  the shaders as written; the address; the journal; the stands; the night breach with and without, two seeds (92 marked statics on that level: the
  same digest and dice both ways, on both stands — held: red if the row begins to move that run). The fog, replay and journal gates on both stands. NOT HELD: (a) ANSWERED 10-25 ("teammates should see whatever we see"): a teammate's own eye now passes the marks too (`FOG.mates`, its bullet below); no other side's eye does; (b) loose props at eye height (a shelf, a locker) still stop the PICTURE's eye and
  never stopped the squad's lines, and a carried box too large for the grid's cells (asked in the walk's own first loop) is not passed; (c) a host that stands boxes up another way (the viewer, the editor's stage) makes no marks: the fog there cuts on thin things as before; (d) while the sight table's program compiles (the first frames), if it fails, or under `?fogfull=0`, the picture is an older fog that does not pass
  them while the squad's lines do (a man behind a pipe is drawn on a sliver the picture still fogs); (e) the rule's numbers are code, not knobs: retuning `THIN_WIDTH` changes what an old recording's level marks; (f) the fans a window's own
  frame and wall thickness cast on Hard (each man a cone) are real sight edges and stay. **Never seen on a GPU**: the page boots with it on the
  software adapter (every pipeline, no error); whether the room now reads clean is the maintainer's to judge.
- **More than five eyes lift the fog (`FOG.eyes`, 10-24; the fourth of the fog's principles the maintainer agreed 10-23: "to see more, get more eyes on
  it").** The fog took FIVE eyes (`render/fogofwar.ts FOG_EYES`, a literal in three shaders): Sam and a squad of four filled them, so a sticky camera
  that sent was "drawn, blind" (`STICKY_STATS.blind`), and in the tutorial's sky seat the lookout and a step's own eye fought for the last place. NOW the
  ROOM is seven (`FOG_EYES` 7: the fog pass's block, the sight table — 58 KB of the 64 KB a uniform block may be, so seven is the most at 2048 bearings —
  and `fogofwar.wgsl`, `fogsight.wgsl`, `common.wgsl FogSightT`; the passes walk only the live eyes — the sight table's pass dispatches the live rows,
  not the room) and HOW MANY ARE USED is the row: `FOG.eyes`, read where the list is made (`game/fogofwar.ts update`) through `fogEyeCount`, the one
  clamp the list, the address and the checks share (under five is five, over seven is seven, no number is five). The order is as it was: Sam (or his lens), the
  living teammates in list order, the newest sending camera(s), then the tutorial frame's lookout and step eye (`RAILS.eyeFirst` still puts a step's eye
  in the last place when the places are full). NOT the picture alone: an eye more is a man more the squad may have seen (`seen()`), so a run with a
  camera out can differ; with nobody past the fifth place it is the same run (the probe holds two seeds). SWITCH: 7 in the module and the page;
  `?fogeyes=5` (or `=0`) = five, as it was (`?fogeyes` or `=1` = seven, `=6` = six); the debugger's fog page has the row (5 to 7); frozen stand: five, `TPS_FOGEYES=1` raises it
  (`FROZEN_HOLDS['FOG.eyes']`); the journal carries it (a recording without the key replays with five); not part of the replay page's look. CHECK:
  `probes.ts fog-eyes` (family `fog`; 7 lines; `FOGEYES_BREAK=1` red on the game's line) on both stands — the room as written in the block, the table,
  the shaders and the hint pass's counting twin (its costs go under the seventh row: `fogofwar.wgsl`'s `//#C` line carries the literal too); THE CASE IT
  WAS BUILT FOR, the room clear with a squad of four, three cameras sending and the newest laid by a man nobody sees (at five: 5 eyes, blind counted,
  unseen; at six: the camera is the sixth eye, the block's next row at its lens, seen; at seven: two see, the third blind; asked 99 or no end: seven;
  no number or 0: five; one feed live, as the page has it: 6 eyes, nothing blind; cameras up: unseen again); the same four with no camera, eight
  seconds on their marks at five and at seven: the same game by digest; the address; the journal; the stands; the night breach fought at five and at
  seven, two seeds, the same digest and dice. `sticky-check`'s cap line reads the row through `fogEyeCount`, and `rails-check`'s line for a step's own
  eye asks its rule at five places and then that at seven the lookout and the step's eye both have one. NOT HELD: (a) what a sixth and seventh eye cost a frame on a real GPU (two more rows of the sight
  table's pass and of the fog pass's per-pixel loop while they are live) — unmeasured; and the ROOM is not behind the switch: the sight table bound in
  every pass is 58 KB where it was 41 KB whatever the row says (the note on GPUs that serialise a uniform read at a per-pixel index stands, at the
  larger size); (b) the tutorial's sky seat now has room for the lookout AND a
  step's eye with four men up: nobody has looked at mission 1 with it; (c) three cameras all sending (`STICKY.live` 3) with a squad of four still
  leaves one blind. **Never seen on a GPU.**
- **What others left behind stays as the team last saw it (`FOG.kept`, 10-24; the third of the fog's principles the maintainer agreed 10-23: "everyone
  else is where your team last saw them").** Two gaps of the audit, the picture alone, under the full picture. (1) A LAMP'S FACE: the fog already lit a
  room by a lamp put out unseen (the ghost light, `fullBlock`) while its ceiling panel went dark at once, because the panel's box follows the real lamp.
  Now a lamp the team has in another state than it is in keeps its face that way too: `FogOfWar.lampFace` writes `Box.fogEmit` / `fogMark` (what the box
  glowed with while the team knew it lit — `faceSeen`, the brightest of the last second, since a fire's coals glow at a quarter of the level's emission
  and a tube drops out — and gain 1; or dark and 0), which the upload alone reads in place of `emissive` / `markGain` (`scene/boxes.ts`, the shadow
  compare and the pack); the game's `Box.emissive` stays the real lamp's (destruction, marks, floormess and furnblast read it), so nothing in the game
  moves. ONLY a box no ray reads the emission of gets a face (`AreaLit`, or `NoShadow`): a remembered glow a bounce ray could pick up would reach the
  cascades and the light meter. A blackout is known to all, as the ghost is: no face is kept there. The viewer's picture without the fog
  (`Game.fogLift`, the replay's Fog switch) shows the lamps as they are (`facesLift` / `facesBack`). Emissive things with no light of their own (a
  sign, an LED row, a monitor) have no memory in the fog and are drawn as they are. (2) LITTER AT REST: a case, a chip or a leaf of paper at rest was cut the moment the team
  looked away and came back when they looked again. Now the particles' kernel, in its resting branch (one particle in 16 a frame, with the support
  test), marks a resting particle that lies on floor the team sees with a bit of its own (`PB_KEPT`, bit 16), which the draw passes under the fog only while
  the row is on (the row put off mid-game cuts them again); the three places that wake a particle take it off, so a kicked case is cut again where
  nobody sees. The row rides the sight table's head (`FogFrame.kept` → bit 4 of
  the word `fogSmokeOn` / `fogThinOn` read; `common.wgsl fogKeptOn`). What a man nobody sees drops stays cut until the team has seen it lying.
  NOT IN IT: the floor glint of a hidden torch, which the audit named, was already cut (`reflect.wgsl` asks `lightFogK`, since 10-16); a checkpoint's
  memory of the fog is the next bullet's switch. SWITCH: on in the module and the page; `?fogkept=0` off; the debugger's fog page has the row; frozen stand off,
  `TPS_FOGKEPT=1` (`FROZEN_HOLDS['FOG.kept']`); the journal carries it (a recording without the key replays with it off), and, being the picture alone, it is part of the replay page's
  fog look (`FOG_PAGE`, with the air: the engine replay shows any tape under the page's own; `fogkept` is a visit word). CHECK: `probes.ts fog-kept`
  (family `fog`; 6 lines; `FOGKEPT_BREAK=1` red on three) on both stands — a lit lamp with a face put out unseen (face lit for the picture as it glowed, a
  dimmer record kept as it was, the game's emission dark, ghost light; the fog lifted for a draw: untouched, and back after; a blackout: none; seen:
  as it stands; lit again unseen: face dark; a fresh encounter, the row off, not the full picture, a lamp in sight:
  nothing written; the upload's two reads, no other game module reading them); the litter bit as written (the frame, the head, `fogKeptOn`, the kernel's
  one line in the resting branch, the bit clear of the others, the three wakes, the draw asking the row); the address; the journal; the stands; the night breach fought with a lamp put out unseen,
  two seeds, with the row and without: the same digest and dice, a face kept with the row alone.
  NOT HELD: (a) the litter half is held as text and by
  the page's boot alone — no particle was watched coming to rest and staying, on any adapter; (b) the fog's "seen" for a lamp is one spot under it
  (`lampSeen`), so a panel whose far corner the picture shows as seen can be drawn in its remembered state for the frames until that spot is seen;
  (c) a panel broken unseen keeps its lit face on the broken box. **Never seen on a GPU.**
- **A checkpoint carries what the fog holds (`FOG.filed`, 10-24; the same principle through a load).** A load's restart forgets all the fog knew
  (`FogOfWar.reset`), so the picture after it had every door, lamp and chair as it stands: what a man did unseen, told by a load. Now a save files
  what the picture has ANOTHER WAY THAN THE WORLD STANDS and nothing else (`FogOfWar.snapshot` → `SaveState.fog`, a `FogSnap`; an EMPTY slice with
  the fog up and nothing held, no key with the row off or the fog off): a door by its NAME with the angle shown (poured through `Door.sided`, as
  the doors' own slice is); a lamp by its name (as the targets' slice is poured) as the team
  knows it and, known lit, its boxes' emission as they glowed (`faceRecs`); furniture the picture holds, by its thing key with its parts' poses
  (one a blast took unseen too: `PropSystem.all` keeps its boxes); the keys of furniture the picture leaves OUT (last seen on the move, or the
  team has looked at the place it left); and the dead the team has seen lying (`Rec.body`, which the picture keeps for good: before, a known body
  left the picture at a load), by their place on the roster. `loadState` hands it back after the world is poured (`FogOfWar.restore`): each is a record again at once,
  built there (no pending table), and comes up to date the frame an eye has it like any record the fog made itself. THE FURNITURE'S MEMORY IS
  MADE WHOLE AT THE LOAD: held where the file has it, no record for one left out, and every other piece on the floor at rest where it stands.
  So the opening half second after a restart, which takes everything as it stands (`THING_PRIME`), passes the furniture by after a load
  (`propsLoaded`, down when the half second ends, on a reset, or when the rule's memory is dropped): a chair pushed unseen a moment after the
  load stays where the team knew it, as it would have carried on (primed, it was drawn moving and then dropped); a remembered chair the team
  looks at is dropped and does not come back; one left out is not drawn where it stands. Items, rubble and unkeyed one-frame boxes still get
  the half second. Each kind goes under its own rule's switch at the save and at the load (`FOG.doors`, `FOG.things`); with the fog off at the
  load nothing is made, and found off on the first update after one, the load's records are forgotten (`loaded`). A row of another shape is left out, never a throw. This is a FILE's memory: a save
  made with a team on the floor is a rollback snapshot (`docs/agents/qa.md`), which keeps the fog's records with the rest of the game. NOT filed:
  a living man's last-seen mark (seconds long), rubble and broken pieces (no checkpoint files debris by key), items (their keys are serials). NOT
  THE PICTURE ALONE: the
  remembered leaf and chair are what the cursor's ray meets after the load, as before the save, so the row is its own switch and no row of the
  replay page's fog look (`FOG_PAGE`: an old tape replays with it off, by the journal). SWITCH: on in the module and the page; `?fogfiled=0` off;
  the debugger's fog page has the row; frozen stand off, `TPS_FOGFILED=1` (`FROZEN_HOLDS['FOG.filed']`); the journal carries it (a recording
  without the key replays with it off). CHECK: `probes.ts fog-filed` (families `fog` and `checkpoints`; 9 lines; `FOGFILED_BREAK=1` loads with
  the row off and reds five) on both stands, the solo night on the office with the fog up — a door swung open, a lamp put out and furniture
  shoved unseen: the file has those three alone, as shown; loaded, a save before the first frame says what the file said, the picture two frames
  in and a second later holds the three (the furniture's record with the middle and long side it had), a save then files them the same; an eye
  on each: as it stands, nothing left to file; a look at the remembered place inside the half second: dropped, not back, filed as left out;
  furniture left out and furniture a blast took: 70 frames after the load the first drawn nowhere and the second where it stood; the fog off at
  the load, the fog put off straight after one, the row off, a file from before the slice, a file of another shape (no throw, nothing held,
  nothing filed after); an empty slice and its load (a record for every piece; a chair pushed unseen five frames on remembered at frames 6 to
  105; a row at the live pose; the furniture rule off and on, and a restart, two frames after a load); a body seen lying, named in the file and
  in the picture after its load, a body never seen left out, bad rows; the address, the journal, the page look without it, the stands. NOT HELD: (a) loaded in a page once, on the software adapter (the solo night: a door, a lamp and a box held before the save, in the file and held after the load; no console or GPU error), never on a GPU; headless otherwise, one level, one seed; (b)
  no run was replayed across a load with the slice in its file (the `replay` and `journal` gates pass, and none of their tapes holds a door or a
  chair in the fog at its save); (c) a lamp's name is taken as unique, as the targets' slice takes it; (d) WHAT A LOAD STILL TELLS: the
  pieces of a thing broken unseen (a lamp's glass, rubble) and items get the opening half second after a load, so they are drawn as they stand
  while the lamp they came off is still remembered lit; (e) the slice is handed back only while the fog is up at the load: a lesson's rails that
  raise the fog a tick after a put-back (`rails.ts`, the sky seat's level alone today) get everything as it stands. **Never seen on a GPU.**
- **A man nobody sees leaves his tracks in the snow (`FOG.tracks`, 10-24; principle 3: everyone else is where your team last saw them, and what
  they changed is found when the team looks).** The maintainer: "I won't see tracks forming in fog of war, right? but if an enemy off screen makes
  tracks and then I see snow, I'll see the tracks?" Before, a man the fog hides pressed NOTHING (`snowTracks.ts`: nothing live shows in the fog),
  so a patrol left no trail at all unless watched. Now what he would press is worked out the frame he presses it and KEPT OFF THE MAP, by the
  half-metre square it is in (`SnowTracks.unseen`, a map of squares; the mark's own numbers: a print, a messy print or a lying man's hollow;
  six a square, the oldest going, and 6000 in all, the square next in the look giving up its oldest; both counted in `lost`). Every mark of a
  square is asked for at ONE point, where the square's first mark was made (`UnseenSquare.x/z`: a place a boot stood; the square's middle can
  be inside a wall), so they are seen or not together. A kept mark is laid when the team SEES ITS SQUARE AFTER HAVING HAD IT OUT OF SIGHT (`Unseen.dark`): a print
  made on snow the team is looking at (its man behind smoke, which the ground's question does not ask about, or low behind a crate) stays kept
  for as long as they look, or each step would show as he takes it; they look away and back and the trail is there. A first cut laid it the
  frame it was made: the review caught it, and a played run showed it (a mark "found" mid-fight on the shipped stand). A HOLLOW on watched
  snow waits instead (nothing kept, `pressOf`): kept, it would lie unlaid under the body the fog then shows; it is pressed in the open the
  frame he is shown, or kept once they look away, and never made if he is up again before either (a sight line a tick for each such man,
  beside the look's). THE LOOK, once a TICK (`findUnseen`), from the head of the map, each square asked going to its tail:
  `FogOfWar.groundLook` (`spotSeen`'s own walk, which now runs through it, off the things' tally) says 0 = in no eye's field, out of sight
  for little (with no cone, off Hard, every square is in one), 1 = in a field and not seen, 2 = seen; at most 64 squares a tick cost a sight
  line (3 µs each with five eyes, measured headless) and about 16 marks are laid a tick (a messy print is a tenth of a millisecond to
  press, the same as one made in sight: 128 in one update was 20 ms; a slow page runs up to four ticks a frame). So a long trail found at
  once comes in over a few frames (300 prints in a third of a second), in about the order walked, and with thousands of squares kept a
  square is asked every half second or so. A mark is laid WHOLE: the same bytes as the mark pressed in sight and settled, with no forming
  and no snow kicked up. The FOG off with marks still kept lays them at the same pace (the map is the world's then); the ROW put off with
  marks kept drops them unlaid (off is a hidden man pressing nothing). Hidden marks are counted in `prints`
  / `hollows` when made. PICTURE ONLY: the map is read by the snow's shading alone; nothing in the game reads `unseen`. But NO row of the
  replay page's fog look (`FOG_PAGE`): a tape carries the row by its journal. Kept marks are not in a file checkpoint (the prints texture
  never was) and go at a restart (`clearSnowTracks`). The page's `__snow.trackStats` has `unseen`, `found`, `lost`. SWITCH: on in the module
  and the page; `?fogtracks=0` = a hidden man presses nothing, as it was; the debugger's fog page has the row; frozen stand off,
  `TPS_FOGTRACKS=1` (`FROZEN_HOLDS['FOG.tracks']`); the journal carries it (a recording without the key replays with it off). CHECK:
  `probes.ts fog-tracks` (`tools/qa/fogtracks-check.ts`, families `fog` and `snow`; 6 lines; `FOGTRACKS_BREAK=1` puts the row off where the
  lines ask for it and reds five), both stands, on the pass. Stand-in men with a stub fog: a man down on snow, hidden, with marks forming
  and kicking as on the page (1 kept, 0 texels on the map, no kick; seen: there that frame, 0 forming, 0 kicks, 0 of the map's bytes other
  than the same man's hollow in sight, 872 texels; row off: nothing pressed, nothing kept); WATCHED snow (a standing man's two prints kept,
  not dark, not laid through 90 frames; a frame out of sight then seen: laid; a body: nothing kept, shown: pressed with its kick; or looked
  away from: kept, and found on the look back); 300 men down, a square each (backs turned: 0 lines, 0 laid; in field unseen: 64 lines a
  tick and all 300 squares asked in five; seen: 16 then 32; the fog off: 16 a tick, all 300 in 17; eight men in one place: 6 kept, 2
  lost, and the row put off drops them unlaid; six men in each of 1001 places: 6000 kept, 6 lost). THE GAME'S OWN FOG, the squad staged: ground a stride before Sam in a field and seen, the things' tally left
  alone; a hollow kept on open snow 31 m off stays kept through 30 of the game's own frames; Sam put a stride from it, the game's own frame
  lays it. PLAYED (marks forming, as on the page): the squad of four sent at a man the fog hides, 30 s, seeds 3 and 4, with the row and without:
  the same 60 digests and the same dice on both stands; marks kept with the row (frozen 5 and 7, shipped 0 and 4) and none without. The address, the journal, the page look without it,
  the stands. The older `snowtracks` line `fog` has a stand-in with no fog up: it holds the rule with the row off. NOT COVERED: furrows and
  dents of things nobody sees (`snowMarks.ts`) are never pressed and never caught up, and a blast's crater is pressed at once, as before; a
  kept mark does not age (snow that fell on a trail since is not on it when found); a square is asked at ONE point, its first mark's, so a
  mark shows when that is seen (up to 70 cm from its own middle; a hollow is filed by the point between its hips and head and shows whole); a
  found trail's marks dirty more rectangles than the texture's hand-over takes singly (24), so each tick of a find uploads their bounding
  rectangle, up to the whole map (never timed); at the cap every snapshot walks some 18,000 more nodes (never timed); a
  body's hollow can be laid a moment before the fog shows the body (the body's own rule asks more than the ground's); a print made on
  watched snow has no trail behind the man when he walks out into view, until the team looks away. THE PAGE, driven on the software adapter (the pass, four men, Hard, `?paused&quality=low`; 119 of 119 pipelines, no console or GPU
  error either way): the eight defenders stood on snow no eye has leave 8 marks kept and none on the map; the cone put off and Sam put beside
  one, 6 are found within six ticks (2 still out of sight); with `?fogtracks=0` the same drive keeps none and presses none. NOT SEEN:
  anything on a GPU, so not the found prints as a picture; a found trail in a played run (in the four headless runs no kept mark was FOUND:
  the fight ended before the team looked at that snow again, so finding rests on the stand-in lines, the one staged look and the page
  drive); the cost on the maintainer's machine (the pace's numbers are this box's).
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
- **Wall switches** (`LIGHTSWITCH`, `src/game/lightswitch.ts`; ON in the page, `?lightswitch=0` puts it off; OFF in the module and on the frozen stand,
  `TPS_LIGHTSWITCH=1`; a `FROZEN_HOLDS` row; in the knob registry and the journal — a recording from before the table replays with none; a Tab row,
  'light switches'). The maintainer, 10-19: "we should have light switches for rooms!" · "probably don't want to go TOO ham on this but it should feel good".
  No level file carries one: the plates are found from the level as it stands — on the room's own wall beside each door (the latch side first, 0.85 m past
  the jamb so that standing at it the door is out of reach and the tap is the switch's; 1.2 m up; never on glass, a leaf's sweep, or anything that does not
  stand above a door's head — a breaker panel, a locker), at most two a circuit of a room, and where the door's wall gives no place (a glass front) on the
  room's nearest plain wall. A plate works the room's MAINS lights that hang overhead or are lamps (analytic lights, ceiling panels and tubes; not screens,
  signs, vending machines, exit lights, lamps outside), split by the level's own lighting groups where one flood-filled room carries several.
  **The hand**: a row of Sam's (kind `switch`, verbs `lightsOff` / `lightsOn`, reads 'switch · on' / 'switch · off'), under a door's rows when both are in
  reach; Space, no hold, no sound the hearing model carries; the fixtures change on the frame through `LightTarget.on`, so the light estimate, the meter and
  the picture all follow (`lighting.ts updateTargets`), and a tube put back strikes like one (`strike`). 'On' puts back what the hand put out; in a room no
  hand put out, the room as authored — all of it where the level left the whole room dark. **The men**: each burning fixture put out raises the 'lightOut' a
  shot one does, with `swAt` = the floor before the plate: a defender who SAW it go (a line to the fixture) comes to the switch, and the small-things memory
  files it there. A calm defender at the switch of a room the LEVEL had lit puts it back, `guardSecs` (1.5) after the hand at the soonest, once, and says so;
  never in a fight, asleep, blind, scripted, under a blackout, and never a room the level left dark. **State**: `LightTarget.handOff` (the game time a hand
  put it out; saved as `TargetSnap.hand` only when set); a 'lightOut' event keeps its `swAt` in a save. A plate goes with its wall when the wall is blown and
  is back with it on a load (asked after when the geometry serial moves). `window.__lightswitch` on the page (knobs, stats, the plates, lit).
  Check: `probes.ts lightswitch` (family `player`; `LIGHTSWITCH_BREAK=1` fails), both stands: the office by hand (the row, the tap, the light estimate under
  the manager's lamp 16.26 to 0.00 and back, the authored-dark break room struck on and left alone by a defender when Sam puts it out again, the door keeping
  the tap in the overlap, a defender put 2.5 m off who has the room lit 2.07 s after the tap and flips it once, a checkpoint, a restart, a wall blown from
  behind a plate, the switch off, a 600-frame digest the same on as off) and every level file (50 levels, 490 plates, each on plain wall with floor in a
  hand's reach). One seed; no tally was measured — nobody has played it, and it has NEVER been seen on a GPU: the plate, its rocker, the amber pilot that
  shows a dark room's switch, the hand at the plate, and how a room reads going dark are all unseen. `tools/qa/lightswitch-page.cjs` boots the real page on
  the software adapter, on and with `?lightswitch=0`. Not built: a teammate sent to a switch on an order; a defender on a mark leaving it for the switch; a
  switch for rooms whose only lights no plate found (the office lobby's circuit; two rooms of 176 across the levels keep a circuit with no plate).
- **A parked vehicle's lamps can be shot out** (`CARLAMPS`, `src/game/carlamps.ts`, 10-19; the maintainer, from a play test: "taillights in cars
  should be able to be shot up, and headlights and all that"). ON in the page, `?carlamps=0` puts it off; OFF in the module and on the frozen stand,
  `TPS_CARLAMPS=1`; a `FROZEN_HOLDS` row; in the knob registry and the journal. THE SWITCH IS READ ONCE, WHEN THE GAME IS BUILT: the stand writes
  its word before `new Game` (standup.ts), a recording from before the table has it put down before its level is stood up (`carLampsTape`, called
  by `replay/engineplay.ts tables()` and `tools/qa/rerun.ts tables()`; `applyKnobs` says the same afterwards), and the debugger's row 'car lamps
  break (reloads)' reloads the page with the word on the address. Every level's cars, pickups, van and lorry are plain boxes, and no lamp was in a
  switchable: a round did nothing to one. With the switch up each lamp box becomes a light target of its own (group `vehicle`, kind `emissive`,
  off the mains, stagger 0 so no die is drawn, no stand-in area light, `interactive` so the reticle takes it like a fixture). The level files are
  not touched: a lamp is FOUND by what the generators write (half size, paint or glow, and its twin across the vehicle — `findCarLamps`), so a
  generator that moves or repaints a lamp has to move its row in `sigs()`; the check counts every level file against a pinned table, which
  catches a known file losing a lamp and NOT a new level whose vehicle's lamps the finder misses (add its row to the table when a level gains a
  vehicle). Only the plain car's tail lamps glow (56 of 198 lamps across the level files); every head lamp and every lamp of a pickup, the van
  and the lorry is a dead lens as authored. A glowing lamp dies like any fixture (glow gone, the flash, a `lightEvent` for whoever had a line to
  it). A dead lens is glass all the same (`lampGlass`, asked by the player's round in combat.ts AND by destruction.ts `fixtureLive`, so a blast
  or anybody's round breaks one too): the glass and the sound, no flash and NO light event (`deadLamp`; lighting.ts `lightEvent` says nothing
  for one, destruction counts none against the encounter's cap). The glass is `particleFx.ts lensShatterFx` (the lens's colour, off the body
  toward the shooter and down; a ceiling tube's shower and ballast sparks are not used). The reticle's row for a dead lens reads its name and
  'click shoot' — not '(off)', and the OCP has no affordance on it (`ocpable`); a glowing tail lamp takes the OCP like any light. A broken
  lamp's box is painted dark every frame from the target's `broken` bit (`carLampPaint`, in `updateTargets`' own pass; the level's paint rides
  on the target as `lens`), so a restart, a load or a step back is followed and a save or a snapshot needs nothing new. Under the old
  near-is-a-hit rule (AIMCOST.lamp off, a show on the stage) a lamp takes a round within 0.2 m, not a fixture's 0.45. The level's fingerprint
  (savestate.ts `levelFingerprint`) counts the LEVEL's own light targets and not the lamps, so a checkpoint or a recording from before the
  switch, or from a page with it off, is still this level's (the first build with the rule counted them: a session fixture recorded before it
  was refused on the shipped stand as another level). An old checkpoint loads with every lamp whole; an old recording is played on a floor
  with no lamp a target: the two tape players lay the tables down before the build (above), and a session file's own replay
  (`tools/qa/replay.ts`) says the file's word for its one stand-up, as it does for `EXACT`. Known cost with it on: each vehicle adds four
  dots to what the reticle can take.
  `window.__carlamps` on the page (knobs, stats, list). Check: `probes.ts carlamps` (family `player`; `CARLAMPS_BREAK=1` fails), both stands,
  and the shipped stand with its word down: all 27 level files with a vehicle against the pinned counts (100 head, 98 tail, 56 glowing); the
  office by hand — eight lamps as targets beside the level's 65, unchanged and in order; a real round into a tail lamp (out, dark, one light
  event) and into a head lamp (broken, dark, no event); a round from behind the car's own body breaks nothing; mended, both painted as authored;
  switch off, no target and the same round leaves the box as it was; ten seconds of the office night with the lamps and nobody shooting one is
  the same run by digest as without, but for the four dark head lamps' rows in the digest's list of lights not burning; the stand's word, an
  old recording's tables and the fingerprint with the lamps and without. Measured by hand 10-19: `probes.ts journal-fixtures` green on both
  stands; the kept replay `office-loud` (recorded before the rule, the office's lot in it) re-run headless on the shipped stand to 2:00,
  7201 steps, no man more than 0.01 m from where the page had him, the same as with `TPS_CARLAMPS=0`. `tools/qa/carlamps-page.cjs` boots the real page on the software adapter, on and with `?carlamps=0`, and breaks a
  tail and a head lamp with the page's own cursor and trigger. One seed, one level by hand. NOBODY HAS SEEN IT: no lamp, glass or dark lens on a
  GPU, and nobody has played it. Not measured: a blast or a defender's round breaking a lens (read, not run). Not built: the GWOT vehicles'
  lamps do not glow (authored dead), so shooting one changes paint only; exit signs added in level scripts, lit door plates, the generator's
  running lamp, the mast light and the radio dial are still nothing to a round.
- **Crouched behind a standing man, the grab's reach goes UP for his neck (`CLOSE.reachUp` → `anim.readyUp`, character.ts `READY_UP`).** The maintainer, off
  the stealth tutorial mission with a still of Sam crouched behind a sentry: "the closer than ever animations are still a bit wonky". Drawn on the worn mesh
  (below), the tell's free hand, which `READY.grab` measures off Sam's OWN shoulder, went at the crouch to the small of the man's back (0.87 m up; his neck is
  at 1.44) and Sam's face to his seat. With the key up and the point more than `over` above the left shoulder: the trunk comes up out of the crouch's bow
  (`rise` 38° over spine1‥3, the head let back half of it), the hand may go `dy` over the shoulder (1.18 m up at every gap from 1.0 to 0.7 m, 0.34 ‥ 0.61 m
  short of his spine), the fingers tip up, and the hand's clocks are slowed (`slow`, `rate`) so the longer way is no faster a wrist (9.8 cm a frame at most
  against 8.2 on the frozen stand; 9.3 against 14.4 on the page's). `anim.crouch`, which the men's detect rate and the fog's eye height read, does not move;
  BUT HIS HEAD BONE IS 0.19 m HIGHER (0.72 → 0.91) and his chest 0.04 while the tell is up, and the men's sight lines (`guards.ts eyeContact`, chest then
  head) and the light meter read those: a second man across cover 0.75 ‥ 0.9 m high could now have a line to his head. No tally was run for it. The grab's
  tell only: standing behind him the pose is the same to the bit, with the pistol up (`grabGun`: the gun keeps its aim) the same to the bit, `seat` is
  untouched, `strike` carries the reach's tail for a few frames while crossing over from a grab; a move that takes the arms (the grab itself) fades the tell
  on the clocks it had. Tab ▸ 'Closer than ever' ▸ 'crouched ▸ the reach goes up for his neck'. ON in the page (`?noreachup`); OFF in the module and on the
  frozen stand (`TPS_REACHUP=1`); `FROZEN_HOLDS` row, `STAND_ENV` word, in the journal's `CLOSE` table. Check: `tools/qa/reachup-check.ts` (`probes.ts reachup`,
  families close / player; `REACHUP_BREAK=1` fails `up`), both stands. With the key down the three staged scenes below print the numbers they printed before
  the change. One staging, no seeds. NOT MENDED, the maintainer's eye: stopping in the mode keeps the stride he was in (the held gait, by design), which at
  the crouch is the rear knee on the floor and the rear foot half a metre back, and standing can be a foot held off the floor; and the grab takes him from
  that crouch to upright against the man's back in about 0.12 s. NOBODY HAS SEEN IT ON A GPU OR IN THE PAGE.
- **Crouched in reach behind a man, his hands stay low until the move (`CLOSE.handsLow`, close.ts `closeReady`).** The maintainer, of a still from the
  pair's stealth mission with Sam crouched behind a guard: "the weirdness in this case was his hand". The hand was the grab's tell with `reachUp` above: the
  open left hand 1.18 m up over a head at 0.91 m, 0.3 to 0.6 m short of the man. From the side it reads as a reach for his neck; from the game's camera, above
  and behind, it reads as a kneeling man with a hand put up. With the key up, crouched, the man not seated and his neck more than `handsLowNeckM` (1.15 m) off his own floor (a man on his
  feet: 1.44; one cowering keeps the level reach), `closeReady` answers 'strike' where it answered 'grab': the hand on the knife is the whole tell, as it is from a side, and the grab's own rise brings the arm up when he takes him. Measured at
  gaps of 0.97, 0.80 and 0.64 m: left hand 1.18 → 0.62 m up, head bone 0.91 → 0.73 m (so the 0.19 m of head that `reachUp` put over low cover is gone too).
  The row, the reach, the grab and the hold are untouched; on his feet the tell is the grab's to the bit; the pistol's (`grabGun`) and a seated man's are
  untouched. With this up `reachUp` has nothing to raise, and its check stages with this key down. Switch: ON in the page (`?handslow=0` off; Tab ▸ Closer
  than ever ▸ 'crouched ▸ hands stay low until the move'), OFF in the module and on the frozen stand (`FROZEN_HOLDS` 'CLOSE.handsLow': `TPS_HANDSLOW=1`;
  `TPS_HANDSLOW=0` holds it off on the shipped stand), in the journal's `CLOSE` table, and a recording from before the key replays with it off. CHECK:
  `bun run tools/qa/handslow-check.ts` (probe `handslow`, families handslow / close / player), both stands; `HANDSLOW_BREAK=1` must fail `low`. Lines: low
  (the three gaps above), offer (the grab is still offered and its row is there), stand (standing, and with the pistol up, the pose is the same to the bit),
  harness. One staging, no seeds, and no line stages a low man (the neck bar is read from the code alone). Pictures: `close-stills.ts --scene stops-crouch` with and without `--set '{"CLOSE":{"handsLow":false}}'`. WHAT IT COSTS:
  crouched, nothing on Sam's body now says "the grab is on" before he presses; the row says it. NOT MENDED: the grab still takes him from the crouch to
  upright against the man's back in about 0.12 s. Seen only as CPU mesh stills; never in the page, never on a GPU.
- **The stalk: the last three metres to a man's back are one held click (`STALK`, `src/game/stalk.ts`).** The maintainer's design, 10-23: "when you're close
  enough to an enemy (like entering the closer than ever state) you can click and hold on an enemy and sam will creep toward him · click, let go to stop, and
  click again to continue · the game also controls the trajectory and speed and makes things smooth. it ends with you grabbing him · you get kicked out of the
  mode if he gets too far away, turns around, goes through a door in a way that doesn't make sense", and then "we should get rid of E to grab then. lmb is the
  only way". Hands empty, a living man who is not onto him, inside `CLOSE.modeM` (3.0 m) with nothing solid between, Sam at least 104.5° round from the
  man's nose (`beginCos`): the LEFT button pressed on him (the reticle's man, or the cursor within `cursorM` 1.1 m of his feet) takes him. While it stays down
  `updatePlayer` walks Sam: crouched, toward the point `stationM` (0.55 m) behind the man's back, at the man's own speed plus a closing speed
  (`closeMin` 0.3 m/s at the grab, `closeK` 0.6 more a metre out, never over `pace` 1.6), his speed eased in at `easeUp` 4 /s and out at `easeDown` 9 /s,
  facing the man. Inside `grabM` (0.95 m) with the grab on offer (`closeAt`), `game.ts` calls `startGrab` on that frame. It ENDS, with nothing stalked until
  a fresh press: the button up · past `CLOSE.modeOutM` (3.6 m) · a wall or a leaf between them · he has turned until Sam is less than 93° round (`outCos`)
  · he is dead, held, out of the picture or onto Sam · Sam's hands are busy or no longer empty · a move key of the player's own. The click that begins or
  carries a stalk is no blow (`stalkHas`). `STALK.only` (on with the stalk; `?stalkonly=0` puts the row back): a staff man has NO 'grab him' row in
  `closeRows` — his line says `LMB  hold to grab him`, or `E  holster, then hold LMB to grab him` with a gun out, so the pistol's hold is reached from the arm
  hold's own draw row. A civilian keeps her row, and so does everybody under a show (`closeLive` is false there) and with `CLOSE.on` off. THE RAILS: where a
  mission's rows offer 'grab' and his hands are empty the left button is let through (`rails.ts gate`), and `lesson.ts lessonLine` turns 'press [Space] …
  to grab him' into 'hold left click on him … to grab him' (the level files are untouched). `tools/qa/lesson-run.ts`'s `verb('guard', 'grab')` holds the
  left button on the nearest man when there is no such row. Switch: ON in the page (`?stalk=0` off; Tab ▸ Closer than ever ▸ 'the stalk ▸ …'), OFF in
  the module and on the frozen stand (`FROZEN_HOLDS` 'STALK.on': `TPS_STALK=1`; `TPS_STALK=0` holds it off on the shipped stand), in the journal's tables
  (`JOURNAL_KNOBS`), and a recording from before the table replays with it off. Its state is a `SideMap` per game, reset with the guards and on a load;
  `STALK_STATS` is a tally (rollback-exempt). CHECK: `bun run tools/qa/stalk-check.ts` (probe `stalk`, family stealth), both stands; `STALK_BREAK=1` must
  fail grab, still, steer and let. Measured there, three seeds: 2.6 m behind a man walking away at 1.15 m/s he is in the arm in 4.22 s, top speed 1.60 m/s,
  the largest change of speed in a frame 0.15 m/s; behind a man who stands, 2.48 s; begun 60° off dead astern it ends 42.6° off. Older probes that read the
  grab's row or its key run with the stalk held off (`probes.ts` `GRAB_ROW_AS_IT_WAS`). WHAT IT COSTS: no grab with a gun out in one press; an alert man
  cannot be stalked (nor grabbed before it); the creep makes the crouch's own footfalls and moves under their eyes as any crouched Sam does. NOT DONE: the
  pose does not yet change over the creep (the arm comes up at the grab, as before); nothing at a corner. Driven in the real page on the software adapter
  (`tools/qa/stalk-page.cjs`); never played by a person, never seen on a GPU.
- **No knife (`CLOSE.noKnife`, `src/game/close.ts`).** The maintainer, 10-23: "remove the knife, only rmb for non lethal CQC when nothing equipped … then we
  also remove the knife from interrogation. you can still select nothing equipped or the pistol, but there's only rmb to choke out". With the key up and the
  close-in mode on (never under a show: `closeBare`): empty hands, the LEFT click is no blow (behind a man it is the stalk's) and the RIGHT click is the
  knockout from any side, whatever `CLOSE.lethal` says; with a man in the arm (`CLOSE.heldClicks`) the left click does nothing and the right click chokes;
  nothing draws or names a blade — no sheath on his chest (`combat.ts handProps`), no knife in the fist of an arm hold, the animator's `noKnife` (no hand to
  a hilt in the tell or the close-in carriage, the reaching arm waits on nothing, the hold's right hand clamped on the man's shoulder from the first: the
  choke's own station), no row or status line with the word, none of Sam's 'knife' lines (`dialogue.ts`), and the three lesson lines that teach it say the
  knockout (`lesson.ts lessonLine`; the level files are untouched). Switch: ON in the page (`?noknife=0` off; Tab ▸ Closer than ever ▸ 'no knife ▸ …'), OFF
  in the module and on the frozen stand (`FROZEN_HOLDS` 'CLOSE.noKnife': `TPS_NOKNIFE=1`), in the journal's `CLOSE` table, and a recording from before the
  key replays with it off. CHECK: `bun run tools/qa/noknife-check.ts` (probe `noknife`, families stealth / takedown), both stands; `NOKNIFE_BREAK=1` must
  fail blow, hold, draw and words. One staging each, no seeds. Older probes that read the knife run with the key held off (`probes.ts`
  `KNIFE_AS_IT_WAS`). WHAT IT COSTS: no silent kill with empty hands at all (a body always wakes or is found breathing); `lesson.ts`'s `downed: knife`
  test can no longer come true (no shipped step asks it). NOT MENDED, other owners': a grabbed civilian's 'he had a KNIFE at me' line (`dialogue.ts`), the
  knife as an item of kit (`character.ts KitItem`, `kitanim.ts`: never asked for with the key up), the debrief's 'the knife' wording for old runs. The
  bare-handed tell and hold are seen only as CPU mesh stills; never in the page by a person, never on a GPU.
- **The lab's five scenarios (10-25; `SCENES` in `src/host/sneaklab.ts`, `?sneaklab&scene=N`).** The maintainer: "let's also rework sneaklab a bit to be more like our tutorials.
  no hand holding but just a few curated scenarios we want to tune": a man standing, a man walking, a dark room, a dark corridor, a corner. A button in Right now restarts the
  floor and puts Sam at that scenario's start, hands empty and low, with one line at the top of the page and nothing else; 'start over' and Shift+Enter bring the same one back.
  The dark room and corridor are new floor outside the yard's walls (`tools/levels/sneak-lab.ts`: nothing joins them to it, the button puts Sam in), with three and two men of
  their own, five dim pools and 'they can't notice you' off. The level's fingerprint moved: old recordings of it are refused. THE CHECK is `sneaklab-check.ts` (the five starts,
  the held click closing on the walker, a way through each dark place, nobody seeing him at either start for twelve seconds, the corner man coming past) and `stalk-page.cjs`
  (the five buttons on the real page). THE HARNESS'S METER HAS NO MOON: how dark they are was seen only on the software adapter, never on a GPU, and nobody has played them.
- **The sneak lab (`/sneaklab` on the dev server = `?levelFile=sneak-lab.json&solo&sneaklab`; `src/host/sneaklab.ts`, `tools/levels/sneak-lab.ts`).** The
  maintainer, 10-23: "can you make a debug level / workbench where we can play with this and tweak it? … make it workbench like where we can tweak things
  live". The level is the kit yard's floor, lit, with six men each walking one case (a man who stands · a long straight beat · a loop round a block · through
  the bunkhouse's two doors · down an alley and round a corner · inside the store). The word `sneaklab` gives the panel its own system, open from the first
  frame: every number of `STALK` and the few of `CLOSE` / `TWOGEARS` it leans on as live sliders (the two arcs in degrees), the build's numbers back by the
  section's reset, 'copy them' (one line of JSON on the clipboard and in the panel), 'put everyone back' (`game.restart()`), 'sit one down', 'they can't
  notice you' (`playerInvisible`) and 'nothing hurts you' (god mode), both on to begin with and written every page step, a line that says what the stalk is
  doing and why the last one ended (`STALK_STATS.last`), and the stalk's geometry on the floor (`src/ui/stalkviz.ts`, `STALKVIZ.on`: the two range rings, the
  arc's edges, the station point, the grab's ring, Sam's line). Not a row of the start card, no mission of its own (the plain night on that floor). CHECK:
  `bun run tools/qa/sneaklab-check.ts` (probe `sneaklab`; the file is its generator's, eleven men of whom ten walk and all stay calm over 40 s, the held click
  takes the man who stands in 2.52 s with the real guards running, every number of `STALK` has its row); `SNEAKLAB_BREAK=1` must fail men and creep. The
  page: `tools/qa/stalk-page.cjs`. The panel covered the middle of the page, where Sam stands, so a press on the man landed on a slider: with 'keep Sam
  clear of this panel' (`SNEAKLAB.clear`, on) the view's follow point is shifted (`camera.ts hostShift`, host only, null in a game) so he stands in the
  middle of what the panel leaves. The corner list's lone hint row ('LMB  hold to grab him') was never drawn when it was also the hovered row
  (`ui/overlay.ts deriveInteractions`): a hovered row with no verb is now a hint, not the lead. `map-check.ts sneak-lab` says FAIL for the missing room clear, as it does of `quiet-yard`. Never played by a person; its
  two floods are bare lights and its light has never been seen on a GPU.
- **The way in shows on his body, and ends in one step (`STALK.tell`, `STALK.catchSecs`; `stalk.ts stalkTell`, `close.ts closeTick`, `character.ts
  READY_BARE`).** The maintainer, 10-23: "we want very very smooth transitions from regular crouching to the closer than ever state. then, once you click and
  hold its very smooth to gradually shift the animation until you end on a grab, and you can be interrupted any time". With the stalk on, Sam's pose behind a
  man he could stalk is the DISTANCE's: from `reachFrom` (2.9 m) the reach comes in straight by distance to whole at `grabM`, and from `riseFrom` (2.3 m) he
  comes up out of the crouch, `rise` (0.7) of the way by `riseBy` (1.05 m). Pose only: `anim.readyAmt` and `anim.rise`; the crouch the men see and hear is
  untouched, though his head bone is higher (their sight lines read bones). Let go, the pose stands where it is. With no knife (`noKnife`) the reach is two
  hands for one target (`READY_BARE`: left out ahead of its shoulder at neck height, never more than 0.3 m over it and never nearer than 0.32 m to the neck, right level
  with it, both elbows down), and it is not dropped when the grab begins: it is let go over 0.25 to 0.8 of the grab's reach (`READY_BARE.out`), the right hand's share by 0.3
  when there is a gun to take (the disarm needs that hand at 0.2 s). The grab a stalk ends in closes the last of the gap in one lunge over `catchSecs`
  (0.3 s, `Hold.from`, `player.ts`, `stalk.ts stepEase`: off the mark over three frames, three fifths of the way in a third of the time), his legs given
  the step at up to `catchStride`; 0 = the grab's own snap (a fifth of the gap in the first frame). THE YANK (`STALK.yank` 0.28 m): once the step has
  landed the man is hauled that far straight back, Sam going back with him, over the rest of the grab (less where a ray finds something solid within
  `yankRoom` behind the pair; not a civilian): real positions, so it is the stalk's alone and off wherever the stalk is; the pose's share is
  `HOLD.yank` (the man's chest back 11 degrees more and Sam sat 9 cm into it for a quarter second) and, with no knife, `HOLD.bareArch` (he is hauled
  back onto the arm 11 degrees, elbows down, where upright Sam hid him from the game's camera). `STALK.tell` off = the pose
  in reach alone. CHECK: `stalk-check.ts` lines `tell` and `stepin` (the first frame under 4 cm, never over 7 m/s, the man hauled back; BREAK fails both), both stands. Judged on CPU stills only (`close-stills.ts --scene stalk
  | stalk-rifle | stalk-pause`) and by a reviewer reading them; never seen on a GPU, never played.
- **The stalk after its review (10-23; `stalk.ts`, `player.ts`, `close.ts`, `rails.ts`).** What a reviewer found in the first three passes and what stands
  now. (1) A press made with a move key still down used to be lost: the press ARMS the stalk (`St.armed`) and it begins on the frame his own keys come
  up, the button still down; a button merely still down after a stalk ended takes no man (the `out` line holds that). (2) The step in moves him by the
  step's own delta from where his collision last left him, and eases onto the hold's point once the lunge is over: it used to write the straight line's
  point and could come out the far side of a thin wall behind the man. (3) Inside `grabM` on the man's flank (he turned a little, the grab's rear arc
  not on offer) Sam walks on round to the point behind his back: he used to stand still with the button down. (4) Shift does not sprint him under a
  stalk. (5) The wait at a corner asks what `startGrab` asks before it hands a man over (not folded by a blast, no hand on a breaker, room to stand): it
  used to tally a grab every frame the game refused. (6) In reach of ANOTHER man the tell is that man's, not the stalked man's by distance. (7) With no
  knife the choke's brace follows the choke again (`knE`), the held clicks and the held man's bare pose ask `closeBare` (never under a show), and `haul`
  and `takedown-kill` join `KNIFE_AS_IT_WAS`: both were measured on a man held with the knife, and the bare hold's arch puts the two heads 19 cm apart at
  the height of the lifted choke where `haul` asks 22 (fading the arch under the lift was tried: his neck slid 5 cm along the forearm).
  (8) A tutorial step's CARD runs through `lessonLine` as its line does, and the left button reaches the game on a tutorial only on a step that allows
  `use`. (9) THE STEALTH TUTORIAL'S SMOKE SPOT moved 0.3 m (`TQ.smoke` 30.3 to 30.6, and `SMOKE` in `levels/tut-quiet.script.ts`): the haul back puts
  the man a step nearer the back door, and a body within 1.3 m of a hand at the lock takes the tap from the door's row (the level's own note on that
  spot). `stealthpose-creep` joins `GRAB_ROW_AS_IT_WAS`: the stretch it reads (behind a man, out of reach, the free hand low) is the way in's now.
  Measured: `stalk-check`, `noknife-check`, `sneaklab-check`, `disarm-check` and the lessons on both stands, headless. Never played, never seen on a GPU.
- **The stalk's fourth pass: the way in has a shape (10-23; `character.ts` `READY_BARE.way`, `HOLD.lunge` / `sway` / `apart`, `stalk.ts`
  `stalkWait`, `close.ts`).** No URL word of its own: the stalk's parts ride `STALK.on` (`turnIn`, `cornerShow`, `catchLong`), the pose's ride
  bare hands (`CLOSE.noKnife`) and `HOLD.wayShape`, so `?stalk=0` or `?noknife=0` puts the matching part back; the frozen stand has both off.
  A recording from before it replays as it was (journal.ts: no `STALK.turnIn` = no turn through the step, no longer step, no wait pose; no
  `HOLD.wayShape` = the old way in, no dip, sway or room between the heads, the old arch: the head's bone is where ears and eyes are read).
  (1) Fed a PART of the reach (the tell's `readyAmt` under 1) the pose was the whole reach at part weight: both arms up from two metres off.
  Now the weight is whole by `way.by` of the amount and the pose itself goes by it: the lead hand starts low (`way.low` / `near`) and comes up
  to the neck over `way.lift`, the right hand has no share before `way.right[0]` and sits by his ribs (`READY_BARE.R.at`), fingers nearly
  open. A stalk that is broken off drops the arms at `way.drop` /s. (2) `HOLD.lunge`: his hips dip 6 cm over the first three frames of the
  step in (not by the hold layer's weight, which is a third there). `HOLD.yank.arch` is -5 (was -11). `HOLD.apart` carries Sam's head
  `side` degrees further out the way `N.side` already does and tips the held man's neck `tip` the other way, eased with the gun's share and
  the haul: the head joints are 10.2 cm apart across the pair, 4.9 with it at 0. (3) `HOLD.sway`: in the bare hold both men's weight goes
  from foot to foot every `secs` and he twists against the arm with his agitation; it is let go of at `sway.out` /s when the hold becomes a
  choke or a gun hold. (4) THE WAIT AT A CORNER SHOWS (bare hands): `stalkWait` (the wait's own gate, the button down) has closeTick feed a
  tucked lead hand toward the nearest man he could take (`cornerReach`, growing from `cornerSee` m in) and `anim.coil` (`cornerCoil` of the
  way into the crouch, which is Sam's eye height in fogofwar.ts too); he comes up out of it over `cornerRise` s of the step in. (5) The step
  in off a wall turns him THROUGH the step (`Hold.yaw0`), not in its first four frames; a step longer than `catchM` may take up to `catchLong`
  of `catchSecs` (more and the haul back, which has what is left of the grab, went over 7 m/s). CHECKS: stalk-check has `shape` (the dip and
  the heads against the same run with both at 0) and a line in `corner` for the wait as asked and as shown; both stands, `STALK_BREAK=1`
  fails them. Three seeds for the grab lines as before, one for these. The lab has rows for `catchM`, `catchLong`, `cornerSee`,
  `cornerCoil`, `cornerRise`. Stills: `close-stills.ts --scene stalk-turn` is the broken-off stalk. Judged on CPU stills by a visual
  reviewer over two looks; never seen on a GPU, never played. Not done from the review: a staggered stance at the launch, a flinch when he
  turns round, the elbow under the chin, a slower fall for the gun that is taken, the still pose of a paused creep.
- **The stalk's fifth pass: he shrinks back when the man breaks it off (10-23; `stalk.ts` `STALK.jolt`).** With a stalk on, the man who
  turns off his back (out `turned`) makes Sam duck `jolt` (0.6) of the animator's SOFT duck (`flinchFrom(…, soft)`, the one a near round
  gives: it leaves a hand's errand alone, so a pistol drawn the next instant keeps its draw and its click) and the man who is onto him (out
  `him`) the whole of it; the other ways out give none, nor does the frame a stalk begins. The first try used the start (`startleFrom`):
  it takes the hands for 0.45 s and ate the draw's early click, and is not used. Rides `STALK.on`: `?stalk=0` in the page, `TPS_STALK=1`
  on the frozen stand, where the MOVES pass is down and the soft duck is nothing (not the old hit twitch either). A recording from before
  the key replays with `jolt` 0 (journal.ts). CHECK: stalk-check `out` has the line on both paths of the MOVES pass and `harness` one for
  the journal's clauses of this pass and the fourth; `STALK_BREAK=1` fails both, on both stands; one seed. The lab has a row for `jolt`.
  A quiet man's routine quarter turn got the duck too: the sixth pass, below, mends that. Seen on CPU stills only (`close-stills.ts --scene stalk-turn`), never on a GPU, never played. STILL OPEN from the
  tutorial frame: under `?noknife=0` on a tutorial a left click on a man in reach or in the arm is the knife before the step that teaches
  it (rails.ts lets the button through for the grab); the mend wants its own switch, journal key and rails-check line, so it is not here.
- **The stalk's sixth pass: the duck waits for him to face Sam, and one word puts the polish down (10-23; `stalk.ts` `brokeDuck`,
  `stalkPolish`, `character.ts` `holdPolish`, `profile.ts`).** (1) The fifth pass ducked Sam at ANY turn that ended a stalk, a patrol's
  quarter turn included. Now the out `turned` only remembers the man and where Sam stood (`St.broke`); Sam ducks when that man has come on
  round until that spot is within `STALK.joltFace` (50) degrees of his nose, or is onto him (the whole duck), inside `joltSecs` (0.6 s),
  and only while Sam's hands are still empty and idle, he stalks nobody else, he has not gone a pace from the spot and nothing solid is
  between them; else never. The man who is onto him while the stalk is on (out `him`) still gets the whole duck at once. A recording of the
  fifth pass (a `jolt`, no `joltFace`) replays at any turn, on that frame (by `joltAtOnce` since the seventh pass, below). (2) `?stalkpolish=0` on the page puts the fourth to
  sixth passes' numbers down together, by `stalkPolish(false)`: the same function journal.ts calls for a recording from before them
  (`turnIn`, `cornerShow` off, `catchLong` 1, `jolt` 0, and `holdPolish`: `HOLD.wayShape` off, the dip, the sway and the room between the
  heads at 0, the arch -11). A plain address writes them up again (since the seventh pass, below: `POLISH_UP`'s and `HOLD_POLISH_UP`'s
  numbers, the tables themselves being down; the page's boot also undoes a lab slider on these). They ride the journal's tables: a recording made with the word replays with it. No word for each
  pass alone (say if a pass wants its own); the frozen stand's hold came with the seventh pass, below. CHECK: stalk-check `out` (the turn to face him ducks; a
  quarter turn does not, then does once he comes round or is onto him, not after `joltSecs`, not through a wall) and `harness` (the three
  ages of recording, the word against the first of them over all twelve numbers, a plain address after it), both stands, `STALK_BREAK=1`
  fails both, one seed; `ONLY=polish node tools/qa/stalk-page.cjs` reads the word on the real page. The lab has rows for `joltFace` and
  `joltSecs`. Seen on CPU stills only, never on a GPU, never played.
- **The stalk's seventh pass: the polish is a hold of its own, down is the stalk as it first stood, and the fifth pass's recording ducks
  on its frame (10-23; `stalk.ts`, `character.ts`, `standup.ts`, `profile.ts`).** Mends from two reviews, nothing new to see on the page
  with the polish up. (1) THE HOLD. The fourth to sixth
  passes were up in the modules and only rode `STALK.on`, so a frozen run raised with `TPS_STALK=1` got them and no word held them off.
  Now the twelve numbers are DOWN in the tables (`STALK.turnIn`, `cornerShow` off, `catchLong` 1, `jolt` 0; `HOLD.wayShape` off,
  `lunge.dip`, `lunge.back`, `sway.m`, `sway.twist`, `apart.side`, `apart.tip` 0, `yank.arch` -11) and the page's numbers live in
  `POLISH_UP` (stalk.ts) and `HOLD_POLISH_UP` (character.ts): a tuned number from the lab's 'copy them' line goes THERE. SWITCH:
  `stalkPolish(true)` at the page's boot unless `?stalkpolish=0`. FROZEN: down, twelve `FROZEN_HOLDS` rows with the one word
  `TPS_STALKPOLISH=1` (each acts only under the stalk or, for the hold's pose and the bare reach, bare hands: `TPS_STALK=1`,
  `TPS_NOKNIFE=1`; a frozen run with `TPS_NOKNIFE=1` alone therefore draws the first bare hands again); so `TPS_STALK=1` alone on a
  frozen run is the stalk as it first stood. SHIPPED: up; `TPS_STALKPOLISH=0` puts it down there. A headless
  tool that raises `STALK.on` itself on the frozen stand and means the stalk as the page has it also calls `stalkPolish(true)` after
  every stand-up (stalk-check does); close-stills runs on the shipped stand. (2) THE REPLAY. The sixth pass sent every out `turned`
  through `brokeDuck`, whose wall test the fifth pass never had: a fifth-pass recording (a `jolt`, `joltFace` read as 180) whose man
  turned on the very frame something solid came between them would not duck where it had. journal.ts now raises `STALK.joltAtOnce` for such a recording (a boolean
  nothing else raises; off in the table, and off for a sixth-pass recording, which has `joltFace` and not the key): the duck is given at
  once on the out's frame, with no test, as the fifth pass did. `joltFace` 180 alone, the top of the lab's slider, is still any turn by
  `brokeDuck`'s own tests. CHECK: stalk-check `harness` (the twelve stand down on frozen and
  up on shipped, the rows carry the word, either word has the say) and `out` (with `joltAtOnce` a quarter turn with a wall between ducks on
  that frame, 0.23 against 0.00 with the mend taken out; at `joltFace` 180 alone it does not), both stands, `STALK_BREAK=1` fails both, one seed; shipped-check holds the two
  stands to exactly the listed rows. (3) DOWN IS THE STALK AS IT FIRST STOOD, BONE FOR BONE. It was not, since the fourth pass: the
  spring's clock and the sway's still ran with their numbers at 0 and let the hold's leg solve in (feet pinned, a knee up to 7 cm off
  through the step in, knife or bare), and the fourth pass's retuned bare hands (`READY_BARE.L` / `.R`) were drawn whatever the switch.
  Now a clock enters the leg block only with a number to move (`HOLD.lunge.dip` / `.back`, `HOLD.sway.m` not 0), and `HOLD.wayShape`
  off draws `READY_BARE_WAS`, the two hands as they were. So `?stalkpolish=0`, a frozen run and a recording from before the fourth pass
  all show the first stalk; a recording made between the fourth pass and this one with the polish DOWN (the page's word) replays with
  the legs and hands of this build, which moves no bone the game reads (shins, hands). The down numbers have one home, the tables: `POLISH_DOWN` and
  `HOLD_POLISH_DOWN` read them as the files load. CHECK: stalk-check `legs` (polish down, the grab and 3 s of the bare hold: the shins
  where they are with the two clocks stopped, 0.000 mm; `STALK_BREAK=1`: 62 mm), and `tools/qa/stalk-pose.ts`, new: it writes every
  named bone of both men for one fixed stalk, grab and hold, from whatever tree it is run in, and `--diff` compares two such files.
  Run in a copy of the tree from before the fourth pass and in this one with `--down`: THE SAME, 411 frames, 44 bones, no bone 0.1 mm
  apart, bare hands and with the knife (before these mends: the right hand 36 cm off, a shin 6.5 cm). That comparison is by hand, on
  the shipped stand, one scene; what stands is stalk-check `legs`, which also holds `READY_BARE_WAS`'s eight numbers to the letter and
  that `HOLD.wayShape` off draws them (at the tell's whole reach, where the way in's shape is spent, the right hand is 36.2 cm from
  the fourth pass's on both stands; 0.0 with the choice taken out). (4) A KNEE TWITCH IN THE HOLD, in
  the page since the fourth pass: the leg solve was asked for by the sway's sine itself, so on the one tick in each half swing where
  the sine reads zero (every 0.95 s at 60 Hz) it dropped out and his right knee jumped 3 cm and back. It is asked for by the sway being
  on now (`swOn`). With the polish up, stalk-pose against the build before this pass differs on exactly those ticks (three in four
  seconds of hold) and nowhere else; stalk-check `legs` holds it (three seconds of the settled bare hold: no shin moves 5 mm in a
  frame, 1.5 mm measured, 32 mm with the old gate; the break drops the solve for one tick). STILL THERE, older than the stalk: the leg
  solve is on or off, never eased, so where it starts or stops (the gun swapped in with a man in the arm, the hold ending, the haul's
  end) a knee still moves about 2 cm in one frame, once. sneaklab-check now raises the polish with the stalk, as the rule above asks.
  Nobody has seen or played anything of this pass; nothing of the stalk has been seen on a GPU.
- **The stalk's eighth pass: the catch has a shape (10-23; `STALK.yankWith`, `HOLD.catchShape` and its numbers `HOLD.catch`;
  `player.ts`, `character.ts` `holdLayer` / `heldLayer` / `catchFix`).** Measured first, frame by frame (`tools/qa/stalk-pose.ts`): the
  man was hauled 11 cm INTO Sam (the haul moved him alone), Sam's root jumped 7 cm on the hold's first frame, his legs went from idle
  to a walk mid-stride as the haul began and back as it ended, and his lead hand swung past the man's face at brow height, 21 cm
  ahead of him. With the two keys up: (1) Sam goes back WITH the man (the gap is `HOLD.dist` from the landing on), his own stride
  stops once he has landed and his feet STEP the haul, the rear one first (`catch.samFeet`, `HoldPose.pull`; slid with his root they
  skated 28 cm at one height); the pair's turn to the cursor eases in over 0.45 s from a quarter second after the landing, whatever
  the hold's phase by then. (2) The lead hand starts from where it
  was DRAWN the frame before (the reach's hand, kept by `catchFix`, which also solves that arm last, after the crouch and reach
  layers have moved the shoulder), goes over the man's left shoulder and round his throat with the elbow tucked (`catch.via`, `.over`,
  both carried with the man by `HoldPose.man`, across and ahead, while Sam is still coming in). (3) The man is seen to be hit: both hands fly out, one
  higher than the other, hang a tenth of a second and come onto the arm one after the other (`catch.fling`; a gun hand is the
  disarm's as before), a short jolt of chest and head (`catch.jolt`), and his feet lag the haul and step back one after the other
  (`catch.feet`, `HeldPose.pull`). (4) THE HOLD: he sits back onto Sam, hips down and forward, knees bent, heels out in front
  (`catch.sink`, `.hips`, `.heels`), Sam's rear foot stepped back and out, his hips back and to the side, his head above and beside
  the man's (`catch.brace`, `.seat`). The seat gives way to the lowering, the haul on the head and a gun's share, which have their own
  fitted places: to the gun by `gv`, its eased share (keyed off the variant it dropped whole on the frame of a swap: Sam's hips 10 cm,
  the man's 18). The FEET do not give way: where the seat set Sam's rear foot and the man's heels they stay through the lowering, the
  haul and his going limp (`seatF`, `sitF`; given up with the rest they slid 19 and 12 cm as he was let down, which takedown-lower
  caught). A hold dropped mid-reach lets the arm go with the layer's weight (held whole on its frozen key the hand hung, then
  jumped 70 cm). `catchFix` lets go of the hand over the first 0.4 s of the held that follows the catch (`catch.settle`). The leg
  solve's knee swivel eases in and out under the key. SWITCH: both keys are of the polish: up by
  `stalkPolish(true)` at the page's boot, `?stalkpolish=0` puts them down with the other twelve; `HOLD.catchShape` acts only in a
  bare-handed hold (not with Sam's pistol drawn, not with the knife back by `?noknife=0`), `STALK.yankWith` in any stalk's grab.
  `HOLD.catch`'s numbers are the same on both stands and do nothing with the key down. FROZEN: down, two more `FROZEN_HOLDS` rows with
  `TPS_STALKPOLISH=1` (fourteen now). SHIPPED: up. A recording from before this pass (no `yankWith` in its stalk table) replays with
  both down (`journal.ts`). No new module state (`hdFrom`, `rdHandL`, `hdFix` are the animator's, drawn only). CHECK: stalk-check
  `catch`, four lines, each against the same grab with the two keys down: the gap 0.27 to 0.27 m for 40 frames from the landing (0.16
  with them down), Sam 0.28 m back, a foot 10.6 cm up at its highest and no foot on the floor moving more than 1.8 cm in a frame; the
  lead hand at most 2.6 cm over the man's head bone and 11.5 cm ahead of him (4.6 and 25.0), and with the man taken out of the arm 14
  frames into the reach the hand moves no further in a frame than with the keys down (22.0 cm both, Sam's own step in it); the man's
  hands 78 cm apart for 9 frames on end (0); in the settled hold, the sway up, his feet 15.0 cm ahead of where he stands and his hips
  15.9 cm ahead of his head (-7.0, 1.0), Sam's shins at most 0.7 mm a frame, the same again after a second's walk, and the gun
  swapped in from there moves no hip, head or foot of either man more than 2.3 cm in a frame (0.8 with the keys down). `harness`: the fourteen rows, and a
  seventh-pass recording replays with these two down and the rest up. Both stands, `STALK_BREAK=1` fails all five on both, one seed.
  takedown-lower's '30 cm below standing' now adds the seat's 12 cm to the choke that does not lower him (he no longer ends it
  standing): 40.0 cm by that, both stands green. `legs`' knee-twitch line now runs with `HOLD.catchShape` down (the seat asks for the leg solve too and hid its break). DOWN IS AS
  IT WAS: stalk-pose `--down` in this tree against the build before it, bare hands and with the knife: THE SAME, 411 frames, 44 bones,
  none 0.1 mm apart (by hand, shipped stand, one scene). With the polish up and the KNIFE back, Sam goes back with the man too, his
  feet step it and the turn eases in: `STALK.yankWith`'s share, the changes outside bare hands. `catchFix` mends the LEFT hand only:
  the right hand and every hand after the settle are still solved before the layers that move the trunk. LOOKED AT: close-stills sheets (`stalk`, `stalk-rifle`, `hold`, `choke`) on the shipped stand, three
  passes with a visual reviewer between them; close-stills' `stalk` scene now keeps the cursor at Sam's feet after the grab so the
  pair does not turn under the camera. STILL WRONG, known: the man's long shirt tents into a wedge beside his legs in the hold; the
  rifle hangs for a tenth of a second while the support hand is out, then swings through both bodies on its way to Sam's hand (the
  disarm's own timing, not touched); nothing moves in the settled hold but the sway; the chest-and-head jolt is too small to see from
  the game's camera. Nobody has seen or played this pass; nothing of the stalk has been seen on a GPU.
- **The stalk's ninth pass: the body lands, and he is laid down ahead of Sam (10-23; `HOLD.hitShape` with its numbers `HOLD.hit`, and
  `HOLD.layAhead`).** A visual reviewer's read of the game-camera stills before it: "Sam covers a metre, but the guard's feet, hips and chest stay
  nailed down. Only his arms fling. He then bends smoothly", and at the choke's end "Sam standing on his thighs". (1) THE LANDING. From the
  frame the step lands (the yank's own clock, `HoldPose` / `HeldPose` `.yank`) the man's hips are driven `hit.hips` (15 cm) further ahead of
  his neck than the seat has them, in by 0.04 s, held to 0.07, back in the seat by 0.22; his knees give 3 cm; his head is given back the
  whole of that extra recline (left to ride his trunk it went 4 cm into Sam's). Sam heaves: hips 5 cm in under the man and 6 cm down,
  chest 12° back. The beat leaves with the arm's share of the hold (`1 - gv`) and with the layer's weight, so the gun drawn inside it, or
  the hold ended inside it, does not pop (gated on the variant and on the live pose it dropped 11 and 14 cm in a frame). (2) THE LAY. The
  choke ends in the 'sink' fall (`fallGuide`): his pelvis stayed where it knelt and his legs were drawn out behind it, under Sam's boots.
  With `layAhead` (0.9 m) the pelvis is led that much further along his facing, two fifths of it as he goes to his knees and the rest as
  he is laid flat (0.5 and 0.7 m left a shin within 5 cm of a boot on the seeds whose die tips him the other way). `takedown.ts setFall`
  asks the level for the room first: no static anywhere in a strip as wide as his shoulders (`LAY_HALF` 0.3 m each side), from his shins
  to 1.2 m up, as long as the lay and the whole of him past it (`LAY_REACH` 0.95 m) — the VOLUME, by `circleTouches` every 0.2 m — and
  nothing else solid on three lines down its middle (a leaf, a chair); half the lay where only that much is clear; none otherwise, and
  none in a fall that is already `tight`. This one MOVES WHERE A BODY LIES (a guard who finds it, a carry that starts from it): a change
  to the game, not only to the picture. SWITCH: both are rows of the polish, up by `stalkPolish(true)` at the page's boot and down with
  `?stalkpolish=0` (sixteen rows now); `hitShape` acts only in the grab a stalk ends in, `layAhead` only at a choke's end with the
  takedown's own fall (`TAKEDOWN.on`, `?notakedown` puts it off). FROZEN: both down, two more `FROZEN_HOLDS` rows with
  `TPS_STALKPOLISH=1`. SHIPPED: up. A recording from before this pass (no `hitShape` in its hold table) replays with both down
  (`journal.ts`). No new module state (`Character.fallAhead` is per man, beside `fallTight`). CHECK: stalk-check `lands`, two lines,
  `STALK_BREAK=1` fails both, both stands (29 of 29 on each and on the frozen stand with the three words; 23 FAIL under the break).
  Line one, one seed, against the same grab with `hitShape` down: his hips at most 14.7 cm further ahead of his neck in the first ten
  frames after the landing and 0.0 from frame 25; frame for frame the heads never nearer (16.9 cm at the nearest, 15.4 with the key
  down); Sam's hips 5.9 cm lower; with the gun drawn on the hold's first frame his hips move 2.4 cm in a frame at most (1.5 with the key
  down), with the hold ended three frames after the landing 2.1 (1.0). Line two, three seeds on open floor: his legs at the nearest
  23.0 cm from a boot seen from above (at 0: 6.6), his hips 0.93 m along his facing (at 0: 0.04), never faster than the fall at 0
  (1.98 m/s); then, two seeds, twelve walls stood from 0.95 to 2.3 m ahead of him, each asked which it gets by which side of the lay's
  two edges it stands, a tenth of a metre either side of each (kept where he knelt 4, half the lay 5, the whole 3; the nearest bone
  5.4 cm short of a wall), and sixteen runs with furniture in the strip (a table's top at 0.73 m, a low table, a post a hand off his
  middle on either side, a low crate at three places): never laid further than the floor is clear less `LAY_REACH`, never thrown
  back, never faster. The walls and the furniture are boxes stood ahead of where the same seed's open run ENDED its choke: through a
  choke the pair goes on turning to the cursor, by half a turn on the frozen stand, and a scene measured by his facing at the grab
  measured nothing there. What the room test was before two reviews of it, each measured: one line down his middle let a crate a hand
  off it through (thrown 1.2 m back at 5.7 m/s); 1.2 m asked for a body that reaches 1.36 m let a wall at 1.25 m through; nine lines
  let a table's top, a low table and a 12 cm post between them (13 m/s). OFF IS AS IT WAS: stalk-pose with the two keys down against
  the build before it, bare hands and the knife, THE SAME over 411 frames and 44 bones (by hand, shipped stand, one scene). NOT
  MENDED, the same short margin in the fall that was already there: the old 0.7 m test for a body that reaches 0.86 m, on two lines
  that pass over anything lower than 0.45 m (a 0.3 m crate 0.8 m ahead knocks the body 0.17 m back with the lay at 0 as well).
  LOOKED AT: close-stills `stalk-hit` (new: nine moments from 0.2 to 0.7 s of the grab) and `hold`, two rounds with a visual
  reviewer; its read of the landing after the first: "slightly better, close to the same at game size", "a deeper bend, not a hit"
  (the beat was shortened and the heave raised after it, and nobody has looked since); of the lay at 0.5 m, "clearly better" with
  "Sam's boots still overlap the guard's ankles" (hence 0.9). STILL WRONG, known, from the same review: the disarm parks Sam's arm
  straight out with the carbine gripped by its end; the choke has one visible beat; the settled hold reads as still from the camera;
  the choked man's arms lie in a T; the shirt's wedge; Sam's launch stance. Where the room is only good for half the lay his shins lie
  under Sam's boots as before. `tools/qa/stalk-pose.ts --set '<json>'` writes table keys after the polish, key by key (an unknown key,
  or a value given for a table, is refused). Nobody has seen or played this pass. (The maintainer has played the eighth pass's lab on a
  GPU; the tenth pass below is from that play.)
- **The stalk's tenth pass: the key finishes it, and he goes lower with his hands down (10-23; `STALK.key`, `STALK.low`).** From the
  maintainer's first play of the lab: "i do think having the hands up just doesn't look cool. in chaos theory sam starts regular
  crouch walk, then goes lower to the ground and creeps much more deliberately (and that's where stopping just pauses the animation)
  ... I think you should really have to hit E to finish the grab. it feels weird having it happen automatically. and then in chaos
  theory, sam springs into action for the final grab", and "i think we can make the start radius a bit larger too". Two switches, each
  ON in the page and OFF in the module and on the frozen stand, each a `FROZEN_HOLDS` row with its own word, both under `STALK.on`:
  - **`STALK.key`** (`?stalkkey=0`, `TPS_STALKKEY=1`). The held click only brings him in. Inside `grabM` with the grab on offer he
    eases to a stop `keyM` (0.8 m) behind the man and KEEPS STATION there: the man's own speed, plus or minus the last of the closing
    speed by how far he is from `keyM`, his speed following closely (`StalkMove.keep`: the creep's own ease made him hunt back and
    forth behind a man who walks). The grab is the row's own, `grab him` on the interaction's key (E in the page), back in the list
    whatever `STALK.only` says (`stalkClickOnly`, the one place that asks: on a wall the row stays away, the corner's wait is the
    click's), and it is taken AS the stalk's (`stalkKeyCan` asks, `stalkKeyTook` counts once `startGrab` has him, game.ts: the step
    in from where he stood, the landing, the haul back, one `STALK_STATS.grabs`), whether the click or his own keys walked him in.
    The line over the man reads "hold to sneak up on him". A corner's wait still takes its man by itself. A lesson's grab token reads as with the stalk off ("press [Space] to grab
    him": `lesson.ts tokenLine`), which is true again.
  - **`STALK.low`** (`?stalklow=0`, `TPS_STALKLOW=1`). No arm comes up and he does not rise (`stalkTell` gives reach 0, rise 0 and
    `low`, 0 at `lowFrom` 2.6 m to 1 at `lowBy` 1.1 m, and only out of his crouch: walked up on standing, he is drawn standing).
    The animator (`anim.low`, eased at `CREEP.low`'s rates; the shape is fed as `anim.lowShape`) sinks the pelvis `lowDrop` 6 cm,
    sets it back `lowBack` 3 cm and bows the spine `lowLean` 6 degrees more, straight by the distance, so letting go holds it. The
    creep's carriage gives up its raised hands at ANY distance and for any man the mode is on (`anim.handsDown`, `lowHands`; bare
    hands only: with `?noknife=0` the right hand's hover by the hilt is the carriage's). Each metre beyond the reach adds `lowK`
    0.35 m/s where it added `closeK` 0.6: slower all the way in. Through a stalk's grab he leaves the crouch at `lowSpring` 18 (the
    animator's own is 10), a rate wound up over `lowWind` 0.12 s (`anim.spring`, fed by `closeTick`; not for the corner's grab, which
    comes up out of its own coil): the spring. And a press can begin one from `lowBeginM` 4.2 m, kept out to `lowOutM` 5 m
    (`stalkBeginM`, `stalkOutM`: the lab's rings draw them), where the mode's 3.0 and 3.6 m were the limit: from out there he comes on
    at his plain crouch walk, and the mode's carriage and the sink come in inside it. The line over the man that says what the click
    does is shown out to that start (`closeRows`: past 2.4 m it is the one line, with no row).
  Carried by the journal (a recording from before either key replays with both down: `applyKnobs`); every number has its row in the
  lab, and the lab's two toggles are the switches. THE CHECK is `stalk-check.ts` (`STALK_BREAK=1` reds them): card `key` (seven
  seconds of hold behind a man who stands grab nobody and leave him still 0.81 m behind, the stalk still his and the row offered; the
  key then is the stalk's grab; behind a man walking at 0.9 m/s he settles at 0.79 to 0.80 m within 0.04 m/s of the man's speed; on
  his own keys the key's grab is the same one; off, the hold grabs by itself), card `low` (a press from 3.8 m begins it and with the
  rule off does not; hips 5.2 cm lower in reach than at 2.9 m on the shipped stand and 3.3 on the frozen one, never coming back up;
  neither hand ever within 22 cm of chest height; no reach, no rise; 4.5 s to close against 3.7 with it off; the pose holds when
  let go; out of the wait his hips come up 45 cm in the grab against 20 with it off), card `shipped` (both keys up, as the page
  opens: the man turning on Sam while he keeps station ends it with nobody grabbed; the button let go in reach leaves him still and a
  new press takes it up again; a man suddenly 4.6 m off is still stalked and 5.3 m off is not; the line over the man 3.6 m and 1.8 m
  behind him and none with the rule off or past the start; stood up behind him he is drawn standing with no sink fed), and a harness
  line (rows, both stands, a recording, the page's boot). One seed each: these are poses and distances, not tallies. Every card before
  these three writes both keys DOWN in its world, so the first nine passes are still read as they were; `stalk-pose.ts` does the
  same. `STALK_ONLY=key,low` runs cards alone for a quick look: it says PARTIAL and exits 1, and a name that is no card is refused.
  `writing-check.ts` reads every lesson line with the key up as well. Tools that held the click for the grab now press the key in reach: `lesson-run.ts` (verb),
  `sneaklab-check.ts`, `close-stills.ts`, `stalk-page.cjs` (`ONLY=nokey` drives the page with both off). `lesson-check.ts` and
  `noknife-check.ts` write `STALK.key` down where they read the held click's words. The three tutorial missions play through on the
  shipped stand. NOT DONE: the wait at a corner has no key (its timing is the press); a guard who turns while Sam keeps station is
  the old break-off; the low creep's arms are plain crouch arms, where the game it follows spreads them wide and low. LOOKED AT on
  stills of the worn meshes only. Nobody has played this pass or seen it on a GPU.
- **The right button, tapped or held (10-23; `CLOSE.rmbHold`, `?rmbhold=0`, `TPS_RMBHOLD=1`).** The maintainer: "make it possible to
  just right click to knock him out quickly but it's a bit louder, or holding right click does a choke. we already have this when you
  can pistol whip him if the gun is out". ON in the page, OFF in the module and on the frozen stand, a `FROZEN_HOLDS` row, carried by
  the journal (a recording from before the key replays with it down). With empty hands (`game.ts`, where the click's blow was read;
  `closeRmb` keeps the press's clock in close.ts's state), behind a man the grab is offered on: a press let go inside `rmbTapSecs`
  (0.2 s) is the knockout, begun as the button comes up, the blow as it was and heard `rmbLoud` (0.15) further up the hearing scale
  (0.45 where it was 0.30: about a metre further in open air), its hit played louder to the player too. A press kept down past that
  is the grab (the stalk's own where the key's would be: `stalkKeyCan`) with `Hold.rmbChoke`: `updateHold` closes the arm the frame
  the hold has him (no row, no commit beat, and the "press Space to make him talk" line is not put up over it) and keeps it closed
  while the button is down. Let go, `easeOffHold`: he breathes and is held. In the arm the button is the same: pressed and kept down
  it chokes, let go he breathes, and a TAP there is the whole choke as the arm hold's click always was (the arm closing at once, where
  the click waited the commit beat). Stopped by anything else (a step, a tap, Esc), the button still down does not start it again.
  Where the choke is not his to be given (his side, his front, a civilian, a lesson that does not offer the grab) there is nothing to
  choose between: the press is the knockout on its own frame, as loud as it was. A press made just out of reach waits `rmbWaitSecs`
  (1.2 s) for him to walk into it; a button the page takes away (a blur, the pause card) is no tap. The man's row says "RMB  knock
  him out  ·  RMB  hold to choke him" where the hold is the choke. The lab has the toggle and both numbers; the debugger has the
  toggle beside "no knife". Off = the press itself is the knockout everywhere. THE CHECK is `rmbhold-check.ts` (`probes.ts rmbhold`,
  in the stealth and takedown families; `RMBHOLD_BREAK=1` reds nine of its twelve lines), both stands: a four-frame tap begins the
  blow 0.08 s after the press and he is down at 0.37 s, heard at 0.45; kept down he is in the arm at 0.22 s, the arm closing at
  0.70 s, down choked at 3.32 s, the loudest of it 0.30; let go while the grab is still landing he is held and the arm never closes; let go mid-choke he is held three seconds on; eased off with the button down
  it does not start again; in the arm the button chokes while held and a one-frame click is the whole choke; a press from 1.7 m takes
  him once in reach, and not after the wait; a blur is no tap; from the front the press is the knockout on its frame at 0.50; the
  row's words; with the stalk as the page has it the held button's grab is the stalk's own, counted once; with the click the only way
  and with the knife back the row says it and both halves work; off; the harness line. One seed: these are timings of a fixed beat.
  `stalk-page.cjs` drives both on the real page. The probes that read the build before it (the `close-` family, `heldclicks`, the
  grab's and the knife's: `KNIFE_AS_IT_WAS` in probes.ts) hold the key down as they hold the knife. WHAT IT COSTS: behind a man, a tap's knockout waits for the button to come up (a frame or five later than the
  press). NOT DONE: the choke out of a held button has no pose of its own (it is the grab, then the hold's choke); no sound of its
  own. Nobody has played it or seen it on a GPU.
- **He watches the man who matters, and gives a man room as he passes (10-23; `SAMLOOK` in `samlook.ts`, the poses `WATCH` in
  character.ts; `?samlook=0` / `TPS_SAMLOOK=1`, `?slip=0` / `TPS_SAMSLIP=1`).** The maintainer: "another thing CT did really well is
  having sam look at enemies! curious how that might fit with our control scheme" and "i'm also curious if we can make the experience
  of 'slithering' through guards also feel just as amazing as approaching them for a grab". Both ON in the page, OFF in the module
  and on the frozen stand, two `FROZEN_HOLDS` rows, the tables `SAMLOOK` and `WATCH` in `JOURNAL_KNOBS` (a recording from before them replays with both off).
  HOW IT FITS THE CONTROLS: the cursor still aims and nothing is added to press. It is his HEAD that goes to a man, and the game picks
  the man, so the head is something to read. THE LOOK (`samLookStep`, once a step after `updatePlayer`; the pick is `samLookMan`,
  exported for a camera that wants the same man): the man a held click is creeping up on, else of the men the fog shows inside
  `nearM` 8 m, within `backDeg` 120° of his aim's line, with nothing solid between the heads, the lowest score: distance, less
  `noticeM` 3 for a man who is onto him or has him in view with his notice risen, less `swapM` 0.75 for the man he already has.
  Nobody while he is down, sprinting, holds a man, drags one, is in a takedown, kicks, picks, wands, codes, is on a wall, has a
  hand on a door or a breaker, or has a gun in the aim. He looks at the man's head where it is, so a man on the floor or a crouched one
  is looked down at. The
  animator (`watchLayer`) turns chest, neck and head (0.14 / 0.34 / 0.52) up to 72° off the chest's line, following at 6 /s; the
  close-in carriage's own look (`creepLayer`) gives way by this one's eased weight, so the two never add up or snap. THE SLIP (`samSlipMan`): crouched, empty hands,
  off a wall, the nearest man not onto him inside `slipFrom` 2.6 m at any bearing, whole by `slipBy` 1.2 m: the trunk tips 9° away
  with the head brought level, the pelvis 3.5 cm lower and 3 cm off his side over feet left where they were, and the arm on his side
  out low with an open hand (at 0.7 of the arm; a hand with something in it is left alone). It lets go behind a man's back
  (`backCos`), where the creep's own body has him. BETWEEN TWO MEN (`slipNow`: every man's pull on him summed) he tips into neither:
  the lean, the step aside and the arm go by what is left of the pull, and he sinks `squeeze` 0.6 of the drop further (5.6 cm
  against 3.5). NOT ONLY LOOKS: his head and chest joints move a few centimetres with both, and
  those are what the eyes that look for him read, so a run with them on is not the same run to the digit. THE CHECK is
  `samlook-check.ts` (`probes.ts samlook`, the stealth family; `SAMLOOK_BREAK=1` reds six of its nine lines), both stands: a man
  40° off his aim at 3 m has his head inside a second and a half (28° at 0.67 s, 40° at 1.67 s) with his aim unmoved; of two men the
  nearer is his until the further one notices him, and again when that one has lost him; two men at one distance do not trade him
  (0.4 m nearer does not, 1.3 m does); nobody behind him, past the range, in the fog, or over an aimed gun; the stalked man; the
  slip (chest 4.9 cm further from the man and 3.5 cm lower, the near hand out and under the chest, either side; none standing, for a
  man onto him, from 3 m, or behind a back); between (a man 1.2 m off each side: his chest to neither side, 5.6 cm lower); off; the harness line. One seed: fixed stagings. The sneak lab has both toggles and
  sliders for the range, the notice bonus, the head's turn, the slip's range and its lean, a "lights out" box that puts every
  lamp on the floor off, and a button that stands two of the walkers a gap of 2.4 m apart to slip between; the debugger has both toggles under the close-in rows. `close-stills.ts` has scenes `pass` and
  `pass-back`. NOT DONE: nothing in the look reads the dark; the camera's soft lock (another thread's) picks its own man. Nobody has
  played either or seen them on a GPU: the stills show the low arm clearly and the lean and the head only faintly.
- **A lesson line names the move, not its key (`lesson.ts` `TOKENS`, `LESSON_TOKENS`, `lessonToken`; 10-23).** `{grab him}`,
  `{grab him from behind}`, `{knock him out}`, `{take him out}` in a lesson's text are written out by `lessonLine` in the build's own
  words: the held click with the stalk up (`STALK.on` and `.only`), the grab's key without, the knockout with bare hands, the knife
  with `?noknife=0`. Any words may stand for `him`; a capital first letter begins a sentence; a name in braces that is none of the
  four is left as written. No switch: a line with no token reads as before, and the old exact-sentence patterns still turn the old
  lines. `checkLesson` refuses, in a step's `line`, `setupLine`, `blowLine` and `ringLine`: a name in braces that is no token (a
  digit, a doubled or trailing space, a `from` left in the man's words), a brace left open, and a line that fits the row's 96
  characters as written and not once written out the longest of the four ways (`lessonTokenFaults`). A token in a card's
  text, a `noTap`, a plan, menu or after line is held the same way by `rails.ts railsFaults` since the same day, and a brace in a card's title
  refused (`missions.md`, "A lesson's words are checked as the page says them"). `tut-quiet` and `tut-pair` use tokens, and `lesson-check` holds every tutorial level to them. CHECK: noknife-check, one line, the four ways the two keys stand and seven bad and three good lines, both
  stands, its break by `NOKNIFE_BREAK=1`. Read on the page on `tut-quiet` (the software adapter), the stalk and the knife each way; never on a GPU.
  A click is written with its hyphen since the ninth pass (10-23, the tutorial thread's ask, by the guide's own table): "right-click to knock him
  out", ", or left-click to use the knife", "left-click to knife him", in `TOKENS` and in `bareLine`; the grab keeps "hold left click on him".
  `lessonTokenFaults(w, line, cap, row, always)`: `row` names the caller's own row in the over-cap message (it said "the objective row" of a
  card), and `always` reports a line that is over the cap written out even when it is over as written too; without them it answers as before.
- **The knife's own probe puts the knife back (`tools/qa/hold-pose-probes.ts` `holdKnife`, probe `hold-knife`; 10-23).** It was red on the shipped
  stand from the day the no-knife rule went on there (three lines: no knife in the arm hold, twice no knife boxes), because the probe wants the thing the
  rule takes away. It is the check of `?noknife=0`'s build, so while it runs every stage writes `CLOSE.noKnife` down and gives it back after; its third
  line now wants the drawn man's fist EMPTY a second and a half in when the grab disarms him (`HOLD.disarm` under `HOLD.dropGun`, both on in the page)
  and full when it does not. `HOLDKNIFE_BREAK=1` writes the rule up (with `CLOSE.on`, which it needs) and three lines fail on either stand. Measured:
  4 of 4 on both stands, the `hold-pose` family 7 of 7 on both, the break 3 FAIL on both. A check's change only: no game file, no switch.
- **The wait at a corner (`STALK.corner`, `stalk.ts cornerMan`).** The maintainer, 10-23: "curious if we can make this language work for working corners.
  like when you're at a corner you can either grab or CQC with the right timing". With his back on a wall (the wall hold, not the stack), hands empty, the
  left button HELD lies in wait: the moment a man who is not onto him is inside `cornerM` (1.35 m) with Sam at least `cornerDeg` (110) degrees round from
  his nose (he is most of a pace past; at 75 it fired level with him and Sam swung round him), with nothing solid between, the grab fires (`startGrab` takes him off the wall; the same eased step in). Pressed early it waits; a man who
  comes round facing him is not taken; the right click's knockout in reach is the player's own timing, as off a wall. Before this the button did nothing on a
  wall with empty hands, and with `STALK.only` no row grabbed from a wall at all. Rides `STALK.on` (so off on the frozen stand and in a recording from before
  the stalk); the page: `?stalkcorner=0`; the lab has its toggle and both numbers. CHECK: `stalk-check.ts` line `corner` (a man walking past is taken once
  past, not before; no press or the switch off and he walks by; a man facing him is not taken; `STALK_BREAK=1` fails it), both stands. LIMITS: no pose of
  its own while he waits (the wall stance), no hint on screen until the man is in the grab's own reach, and whether a guard notices him first is the guard's
  sight as ever. One scene, one seed, the AI off; stills `--scene stalk-corner`; never seen on a GPU, never played.
- **The disarm leads the grab (10-23; `HOLD.stripFirst`, `HOLD.first`; `disarm.ts lead`; `?stripfirst=0`, `TPS_STRIPFIRST=1`).** The
  maintainer: "sam springs into action for the final grab ... you really want a disarm and then a grab, right?" In the footage he works
  from, the rifle is the first thing to move, out of the man's hands before the arm is round his neck (which lands 0.22 to 0.33 s in).
  TIMED FIRST (the E grab from the low creep's station on a rifleman, the page's stand): Sam is upright by frame 12, his left hand is
  at the man's neck on frame 16 (0.27 s), the pair go back and down from frame 19, all inside the footage's counts already. What did
  not match was the order: the gun left the man's hand on frame 13, three frames before the arm, with the catch's voice on frame 0. ON
  in the page, OFF in the module and on the frozen stand, a `FROZEN_HOLDS` row, under `HOLD.disarm`; a recording from before the key
  replays with it off (`applyKnobs`). THE RULE: the move's own clock (`Strip.t`) runs ahead of the hold's until the gun is let go, so
  the take falls `first.take` 0.16 s in and the let-go at `first.drop` 0.3 where `strip.take` 0.2 and `strip.drop` 0.42 had them (0.26 and 0.41 since the
  disarm's fourth pass, 10-24, below: the move is over 0.11 s sooner, was 0.12), and the hand comes home at its old pace from there. The gun's knock is 0.70 s from the grab's frame in either order (the timed fall is longer by what the lead lets go sooner). On the page the strip is 0.15 s after that frame and the catch 0.12 s after the strip (a take from outside a step reads 0.17 and 0.10: see the fourth pass). Both figures' poses read that clock, so nothing in
  character.ts changed. The hold's own clock is untouched: he is `held` on the frame he was. The catch's voice (`grabCatch`) is kept
  for the arm's landing, `first.catch` 0.26 s in (`Strip.owed`, played by `disarmTick`), behind the strip's. Only for a grab with a gun
  to take and an empty right hand: a man with his torch has the catch on the grab's frame, and the pistol hold's rap comes with the
  frame as it did. Why not sooner: at 0.12 s Sam's hand is still 23 cm short of the gun (he is rising out of the squat), at 0.16 it is
  13. THE CHECK is `stripfirst-check.ts` (`probes.ts stripfirst`, the grab and stealth families; `STRIPFIRST_BREAK=1` reds three of
  its five lines), both stands: lead (out of his hand at 0.17 s and let go at 0.32, against 0.22 and 0.43 with the key down; held on
  frame 28 either way), voices (the strip at 0.17 s, the catch at 0.27; key down the catch at 0 and the strip at 0.27, 0.22 before the disarm's fourth pass; this check calls `startGrab` from outside a step), arm (the gun
  leaves him on frame 10 and the hand is at his neck on frame 16: six frames between, three with the key down), others, harness.
  `disarm-check.ts` writes the key down in its worlds: it reads the two beats as they were. The lab has the toggle and both moments.
  One seed: a fixed staging. Nobody has seen it on a GPU or heard it.
- **Arms out and low in the creep (10-23, reshaped 10-24; `STALK.wide`, `wideOut` / `wideDown` / `wideFwd` / `wideLead` / `wideBy` / `widePole`;
  `CREEP.wide`; `?stalkwide=0`, `TPS_STALKWIDE=1`).** The maintainer: "having the hands up just doesn't look cool", and the low creep's
  answer (hands down by his knees) read as a man picking something up. The first shape (each hand 0.3 m outside its shoulder, 0.2 m
  under it, elbows out) flung the arms out like wings; on his GPU (10-24): "having sam's arms out so wide looks pretty jank. we should
  really look at the frame by frame from the chaos theory footage". Read off two of the footage's creeps, frame by frame: elbows bent and back, the upper arms hanging a little off his sides, the hands open by his knees, one reaching ahead.
  THE RULE (`close.ts` feeds the animator, `character.ts creepLayer` draws it): under `STALK.low`, bare hands, in his crouch, closing on a
  man from behind, each hand is 0.1 m outside its own shoulder, 0.32 m under it and 0.24 m ahead of it, the left 0.07 m further ahead
  and the right as far back, open, palm to the floor, the elbow pole back and a little out (`widePole` [0.45, 0.15, -0.88]; the
  animator's own `CREEP.wide.pole` keeps the first shape's, for a recording from before it). It comes with the sink
  (all of it once he is `wideBy` 0.35 of the way down, about 2.1 m from the man), in at 5 1/s and out at 14. It is by distance, not by
  the click: it holds while he waits behind the man and goes with the carriage when no man is in front of him. Upright it is nothing.
  The stealth pose layer gives the left arm back to the creep by the share shown (it owned that arm through the creep). ON in the page,
  OFF in the module and on the frozen stand, a `FROZEN_HOLDS` row; a recording from before the key replays with it off, and one from
  before `wideLead` with both hands as far ahead. The lab has the toggle ('arms out') and the five numbers. THE CHECK is
  `stalkwide-check.ts` (`probes.ts stalkwide`, the grab and stealth families; `STALKWIDE_BREAK=1` reds two of its five lines), both
  stands: out (under two metres neither hand more than 0.25 m outside its shoulder, both at least 0.2 m under it, the left ahead, and
  1.6 m out a good way off the key down's hands; the same hands as the key down before he sinks, neither above his neck), waits (still out two
  seconds after the click is let go, 0.5 to 0.7 m off the key down's hands; the plain crouch's half a second after the man is taken
  away), upright, grab (held on frame 29 either way), harness. Judged on CPU stills next to the footage's frames
  (`close-stills.ts` scene `stalk-rifle`, the page's stand). One
  seed: a fixed staging. Nobody has seen the new shape on a GPU.
- **Drag to steer the creep, a prototype (10-23; `STALK.drag`, `dragDead` 14 px, `dragFull` 140 px; `stalk.ts dragged`; lab only:
  `?sneaklab` raises it, `?stalkdrag=1` anywhere, `?stalkdrag=0` in the lab; `TPS_STALKDRAG=1`).** The maintainer: "you click on the guy
  and then you can drag towards him to move in that direction. like a joystick centered on the guy. that would make things feel more
  controlled than right now which feels automatic." THE RULE: the press on a man still begins the creep (the same arc, range and
  cursor test) and the screen point it was made at is the stick's middle. While the button is down the mouse's way from there is the
  way Sam creeps (screen up = the camera's forward, as the move keys have it, so the camera following him does not feed the stick) and
  its length from `dragDead` to `dragFull` is the share of `pace`. Left at the press he holds still in the pose. He faces the man
  throughout; the way into the man is taken off the stick over the last 20 cm before `keyM`, so he stops there and can still go round.
  Everything else is the creep's (the arc ends it, a wall ends it, the key grabs). NOT the switch rule on purpose: it changes how the
  hold plays everywhere (the tutorials teach "hold left click"), so it is down in the plain page and on both stands until the
  maintainer has tried it; there is no `FROZEN_HOLDS` row because the stands agree. The line over the man reads "press and drag to
  sneak up on him" while it is up. THE CHECK is `stalkdrag-check.ts` (`probes.ts stalkdrag`; `STALKDRAG_BREAK=1` reds four of seven),
  both stands: still (2 s, 0 cm moved), toward (the whole drag 1.6 m/s, half of it 0.8), side (across, 2° off the man), stops (0.79 m
  behind him, the key takes him), outside, off, harness. OFF THE VIEW: a press made on the view goes on being the stick with the mouse
  over the panel or the HUD (`input.ts` window `mousemove`), only while `Input.dragOff`, which `Game.update` writes on the host's input
  from `STALK.on && STALK.drag` each frame (the editor imports `Input`, so input.ts does not import stalk.ts). It asks the event's own
  `buttons` (a button let go outside the window sends no mouseup), calls `modsUp` first, keeps tracking through a lock as the view's
  listener does, and follows no press begun off the view (a lab slider). The `outside` line drives it on a window of lists. The page
  drive drags the real mouse in the lab (on the real page the drag goes over the panel: 139 px of 140 read with the listener, 46 without). No hand has held it and nobody has
  seen it on a GPU.
- **Weight in it: his trunk and arms go with his legs (10-25; `STALK.heft`, numbers `heft*` in `stalk.ts`, springs in `character.ts CREEP.heft`; `?stalkheft=0`,
  `TPS_STALKHEFT=1`; acts only under `STALK.wide`).** The maintainer, of the arms in the creep on a GPU: "(1) looks weird, but (2) also just looks like very static. the chaos
  theory animations have some real weight but also smoothness and precision to them". Read frame by frame off the footage (Nos. 24 and 59): the back bows hard, the shoulders
  come round against each step, the arms hang long with a soft elbow and swing against their own foot, the hips go over the standing foot, a stop holds mid step. `creepLayer`
  reads all of it off his own feet, so a stop holds where the step stopped: the stride and the foot's lift feed springs, the trunk a beat behind the feet and the arms a beat
  behind the trunk (measured 0.23 s), which also carries the hands past a stop and settles them. Off leaves the arms of `STALK.wide` as they were; the new hang is `heftOut`,
  `heftDown`, `heftFwd`, `heftLead`, `heftPole`, read in `close.ts`. /sneaklab has the toggle ('weight in the step') and eight numbers. THE CHECK is `stalkheft-check.ts`
  (`probes.ts stalkheft`, the grab and stealth families; `STALKHEFT_BREAK=1` reds step, behind, stop, alive and ahead), both stands (numbers from the first pass): under 1.9 m the shoulders turn over 34° (key
  down 3°, fit to the stride 0.97), the hands swing against the feet (fit 0.93), a stop carries the hands 0.2 m on past the feet and settles, the shoulders rise and fall 1 cm at
  rest, no arm is pulled straight (0.96 of its reach), the feet slip no more than with the key down, the grab lands on the same frame. One run, one seed, the lobby. THE CLIP is
  `close-stills.ts --scene stalk-clip` then `tools/qa/pose-clip.py`, drawn on the CPU. His first look on a GPU (10-25): "it's better but I still think sams arms look weird in motion. it's almost zombie like where he's just holding them out forward", and "the sneaking actually looks better from the camera angle where you're behind sam": the footage only ever shows Sam from behind, and hands hung under a bowed back read from the side as arms held out past his face. So the hands sit back by his hips (`heftFwd` -0.2), the elbow bends, the back bows 4° more, not 16°, and the clip draws him from all four sides at the game's pitch: JUDGE ANY POSE OF HIS FROM ALL OF THEM. `ahead` in the check holds a hand behind his head. NOBODY has seen this second pass on a GPU or played it.
- **Round him: the keys and the stick orbit the man (10-24; `STALK.orbit`, `orbitK` 3, `orbitEdge` 0.05, `orbitSnap` 0.3; `stalk.ts orbited`;
  `?stalkorbit=0`, `TPS_STALKORBIT=1`).** The maintainer: "when you're clicking on an enemy and moving around them, you should really be
  "orbiting" them". THE RULE: with the button held on a man, a move key no longer ends the creep. The way it points is split, as it is
  first asked for (and again when it swings more than 30° off that), into a share toward the man and a share round him, and those shares
  are kept while it is held (a share toward him under `orbitSnap`, about 17° off square, counts as none: the screen's keys are seldom
  square to the man, and on the real page a key 10° off spiralled him 21 cm in over 0.8 s): a key held across him carries Sam round him on the circle he is on, facing him, at the creep's `pace`
  (1.6 m/s), with a pull of `orbitK` per metre back onto that circle, and a man who walks takes the circle with him; the share toward or
  away closes or opens the gap, down to `keyM` (the stick's own taper, `intoKeep`). He goes round no further than `orbitEdge` short of
  the grab's own arc (`close.ts BEHIND_COS`, inside where the creep ends), and waits there, so the grab is still on offer. His hips turn
  toward the man as far as they do with a gun up. Keys let go, the held button walks him in as before. The stick (`STALK.drag`, the lab's) is taken the same way. With it up the aim's weight
  (`aimweight.ts`, which turned him to the cursor's floor point, left where the press was) has no say in a creep: he faces the man. ON
  in the page, OFF in the module and on the frozen stand, a `FROZEN_HOLDS` row; a recording from before it replays with it off. The lab
  has the toggle ('keys go round him') and the three numbers ('nearly across' is `orbitSnap`). THE CHECK is `stalkorbit-check.ts` (`probes.ts stalkorbit`, the grab and
  stealth families; `STALKORBIT_BREAK=1` reds eight of its eleven lines), both stands: round (the key across him for a second, after 20 frames of
  creep: 57° round him at 1.51 m, the gap within 1 cm, facing him within 3°), slant (the view turned 12° so that key is off square: the
  same, and 34 cm off with `orbitSnap` 0), nogun (no round in a creep: his hands are empty in one, `stalk.ts hands`, and drawing ends
  it; the pistol drawn out of one with the cursor a quarter turn off swings there at `AIMWEIGHT.rate`, not in a frame, so leaving the
  aim's weight out while a creep is on gives no free turn onto a target), edge (six seconds: stops at -0.42 against the grab's -0.25, the creep on), in and out
  (closes to 0.80 m against `keyM` 0.8, the nearest 0.79; away opens 1.08 m in 0.75 s), walking (a man walking away at 1.2 m/s: the gap
  within 17 cm over a second), reach (from 0.9 m: stops at -0.51 and the key takes him), stick (the lab's drag across him: 53° round,
  within 6 cm), letgo (walked into reach in 2.6 s), off (a move key ends it), harness. `stalk-check` and `stalkdrag-check` hold it down
  (their cards are of a key that ends the creep and of the stick's own way). The real page (`stalk-page.cjs`) drives it with a real button and key and picks the clearest of the four. Nobody
  has played it and it was never seen on a GPU; the harness has no hand on the keys. One seed: a fixed staging.
- **The sneak lab's knobs in groups (10-23; `src/host/sneaklab.ts` GROUPS, NUMS, TOGS).** The maintainer, of the panel on his GPU:
  "it's hard to tweak the knobs in the debug panel, illegible. maybe more grouping, shorter names, alt text would help? and some
  explanation of what to look for / test in the alt text?" The one long "The creep" list is ten sections that fold (Start and stop,
  Pace, Pose, The grab, Right click, Passing guards, Fast crouch walk, Corner wait, When he turns, Old pose), the first three of the
  game's own feel open; each has its own '↺', a header hover saying what to watch, and a live "N moved" summary; every switch sits in
  its group; every slider has a revert dot. Names are short enough for the 372 px column; each hover says what the number is, what
  to look for and what to try. The page drive reads it: 12 sections, 79 rows, none cut short, none without a hover. Panel code
  (`src/ui/panel.ts`) is unchanged. A new STALK number still needs its row here (`sneaklab-check` words).
- **The grab's disarm, second pass (`HOLD.strip`, `HOLD.bareGrip`; `disarm.ts`, `character.ts`).** The move itself is `HOLD.disarm` (`?disarm=0`,
  `TPS_DISARM=1` with `TPS_HOLDDROP=1`): Sam's right hand takes the gun out of the man's hand 0.2 s into the grab and lets it go at 0.5 s; its voices are
  `docs/agents/sounds.md`'s. Judged on stills, the first pass set the gun down at his thigh (it slid down his leg and lay under his foot) and the held man's
  open right hand waved over the pair. Now the gun is torn out to a straight arm at Sam's right (`strip.low`), his chest going with it (`strip.yaw` -16),
  and thrown from there (`strip.push` 1.3 m/s out, `strip.spin`). Third pass: let go earlier (`strip.drop` 0.42 s, was 0.5) from a LEVEL arm with the gun
  level, the arm held out `strip.follow` 0.1 s after it; it lands a metre clear on the same beat as before (0.83 s; `grabvoice` green), and the knock is
  the floor's alone (a height test then, `GUN_FLOOR`; a thrown gun may touch a wall on its way, which moved the beat). FOURTH PASS (2026-10-24, the maintainer's own
  beats, set by ear on the listening page: "strip: new 2 at 0.25 s · gun down: in the game at 0.70 s"): `strip.take` 0.2 → 0.26, the tear in two thirds
  of the time (`strip.out` 0.34 → 0.35, `strip.drop` 0.42 → 0.41; the strip voice's own click is 0.13 s into it, just before he lets go), `strip.free`
  0.3 → 0.36 to follow the take, and THE FALL IS TIMED (`strip.fall` 0.311 s; `disarm.ts letGo`): he throws it down as hard as it takes to be on what
  lies under its landing place that long after it leaves the hand (about 2 m/s from a level arm; the fixed push was 1.05), so the knock does not move a
  frame with the height of the hand. `fall` 0 or absent = the fixed push (`journal.ts`: a recording from before it). THE BEATS ARE COUNTED AS THE PAGE
  PLAYS THEM: there the grab begins inside an update, so the catch is heard on that frame and the move's clock already reads one step at its end; a
  check that calls `startGrab` from outside a step is a frame ahead of its own voices (the first retime was a frame short for that reason, found on the
  real page). `grabvoice` now takes him by the row's key inside a step for every beat it holds. MEASURED so, headless on the lobby's open floor, one
  staging, seed 4471, both stands: the strip 15 frames after the catch (0.250 s) and the knock 42 (0.700 s), pistol and carbine (it was 0.80 by the old
  ruler); `take` and `drop` are mid-frame values and 0.311 is the middle of the falls that land 18 frames after the let-go (0.303 to 0.318). A wall
  in the way of the throw: he throws it that much shorter (`letGo` casts the throw's own reach), so the gun does not rub down the wall and the knock is on the same frame (it was one to two frames late, found on the real page's first guard); rapped out by Sam's own pistol it is at 0.62 s (not timed). WITH `HOLD.stripFirst` UP
  (the page) the lead lets go at 0.30 s, the fall is longer by `strip.drop - first.drop` in whole steps (0.428 s; from a low hand that is a small lob,
  the down push may go to -1.5), and the knock is on the same frame from the grab's frame: strip 0.150 s, catch 0.267, his protest 0.467, gun down 0.700
  (from the strip: 0.117 / 0.317 / 0.550), pistol and carbine, both stands. His 0.25 s was picked with the catch first, and nobody has asked him which
  order it was for. The gun rests about 0.97 m from Sam (was 1.06; measured before the last frame's shift). Sam's hand carries the gun at 3.5 to 4.5 m/s
  where it was 2 to 3, and AS IT LEAVES THE HAND the gun's velocity changes by about 5 m/s in a frame (the hand is going back and up at 4 m/s, the gun
  leaves out and down at 2.4); that jump was 3.8 before, and nobody has watched either. The knock asks WHAT FACE the gun struck (`throwables.ts
  onBounce` hands the normal on; `disarm.ts gunDown` wants one that faces up) where it asked a height (`GUN_FLOOR` 0.25 m): thrown down harder the gun
  met the wall under that height and knocked there, and a gun landing on a low slab would have said nothing. `disarm`, `grabvoice`, `stripfirst`,
  `holddrop` green on both stands; on the real page (software adapter) the log reads the same frames in both orders. Judged on mesh stills (made with
  the catch first, a frame before the last shift) and these numbers only; never seen on a GPU, and nobody has watched it move. With no knife in the hold the man's right hand is on the arm across his throat from the start (`HeldPose.bare`, `HOLD.bareGrip`
  0.9) instead of half up and open beside his head. CHECK: `tools/qa/disarm-check.ts` (probe `disarm`; beats, pose, ends, off, harness; `DISARM_BREAK=1`
  fails), both stands. Where the gun lands is the item's own physics and was read off stills in one open room; never seen on a GPU.
- **The close-in poses as pictures with no Blender: `tools/qa/close-stills.ts` + `tools/qa/pose-mesh-raster.py`.** `close-stills.ts [--scene approach-crouch |
  approach-stand | stops-crouch | stops-stand | hold | stalk | stalk-rifle | stalk-pause | stalk-corner | disarm…] [--out dir] [--set '{"CLOSE":{"reachUp":false}}']` stages the real game headless (the page's stand unless
  `TPS_PROFILE` says otherwise), runs the game's own entry points, and at each moment skins BOTH men's worn meshes on the CPU into one PLY in the taken man's
  first frame, with a line of numbers a moment (gap, hands, knees, feet). `python3 -I tools/qa/pose-mesh-raster.py dir/<scene>.json [--tile 300]` draws the
  scene as a contact sheet with numpy and Pillow alone (a small z-buffer rasteriser: from the side, the game camera's pitch from behind and from in front,
  from above); it reads `pose-mesh.ts` / `ready-pose-probes.ts` PLYs too. `pose-mesh-render.py` (Blender) is the better picture where there is one. No light,
  no cloth, no camera framing: it is the mesh the page skins at the poses the game reaches.
- **The attention thread runs the way he will walk** (`ATTENTION.way`, attention.ts `attentionWay`, drawn by ui/attentionviz.ts `threadPoints`; the maintainer,
  10-22, off the stealth tutorial mission, of a thread drawn from a man in a hut straight through its wall: "weird that the line here is a straight line, not a
  pathed one. i'd expected pathed from squad commands"). For a man WALKING to the place (`AttentionMark.walking`: a `go` hold not yet at the thing) the dotted
  thread is his feet, every corner of his way, the place: his own nav path from where he is on it when it is the walk to this place, else the nav grid's answer
  kept `wayReask` 0.5 s (the first frames, before he has a path). A man who only LOOKS (a turned head, a lent hold, a man standing at the thing) and a place the
  floor has no way to keep the straight thread. PICTURE ONLY, so it is ON in the module and on BOTH stands, no `FROZEN_HOLDS` row: nothing in the update reads
  it, and it WRITES NOTHING OF THE GAME'S: the kept answer and the tables the grid is searched on are the ASKER'S (the overlay's own in ui/attentionviz.ts,
  handed in as `kept`; `NavGrid.findPathAside` searches on them and leaves the grid's own as they were), so a run that asks for every way each frame digests
  AND hashes (`stateHash`, statics too) as the run that never asks. A first cut kept the answer in a named side table of the game and searched on the grid's
  own tables: the digest was equal, the state hash was not (`game.col.nav.scratch.open`), which is how a picture gets into a snapshot. Off: `?straightthread` on the address, Tab ▸ the attention group ▸ 'the thread runs the way he will walk'. CHECK `probes.ts
  attentionway` (tools/qa/attentionway-check.ts; `ATTENTIONWAY_BREAK=1` fails `way`), both stands: on tut-quiet, the office and lights-out a knock 5 m off
  behind a wall is 13.3 / 5.5‥6.3 / 14.1 m of walk; the thread starts at his feet, ends at the place, no step on blocked floor; he then walks within 0.23 m of
  the thread he set off with. One seed, one man a level. A TRAP MET ON THE WAY: a kept answer must not be started 'from the corner nearest him' (a way that
  doubles back passes near him again further on, and the thread then cuts the wall) — floorplan.ts `wayOf` still starts its kept leg that way. NOT SEEN: the
  overlay itself (no page was driven, nothing on a GPU): the dots at a corner, the thread across a door's leaf, a thread half out of the view.
- **The choke hauls him up and back** (`TAKEDOWN.haul`, character.ts `HOLD.haul`, fed by player.ts `holdTail` as `haul` on both poses; the maintainer, 10-22,
  off the stealth tutorial mission: "the choking animation needs to be more intense. in chaos theory sam has him in a chokehold and then lifts him up and back
  out of the air a bit when choking"). The choke was posed standing: the elbow closed, Sam leaned back four degrees, the man sagged on his own two feet until
  he was lowered. Now, a third of a second in, Sam leans 26° further back over planted feet with the arm going up and back with the man's neck, and the man is
  tipped back onto him, hips ahead of his shoulders, both feet off the floor and kicking; he is set back on his feet as his hands come off the arm (done by half
  way), before the lowering takes him down, so the lowering, the fall and the frame he goes out on are as they were. THE REFERENCE: the Chaos Theory clips the
  takedown work was read from (the notes and beat tables under rebuild/takedowns-like-chaos-theory): Sam straightens a tenth of a second in and hauls him up,
  the man's head forced back, and leans back through the squeeze. The man's FEET ARE OUT OF FRAME in every frame of them: 'off his feet' is the maintainer's
  word, not something the clips show. SWITCH: its own key, ON in the page (`?nohaul` on the address, Tab ▸ Takedowns ▸ 'the choke hauls him up and back'), OFF
  in the module and on the frozen stand (`TPS_HAUL=1`, with `TPS_TAKEDOWN=1`), a `FROZEN_HOLDS` row, rides a recording's tables, a recording from before the key
  replays with it off; off is the build as it was (every changed expression is behind `hauled`; the hold scene's meshes byte for byte). POSE ONLY, no rule: the
  roots do not move and he is out on the same frame, but both men's head and chest bones move (Sam's head some 15 cm back for a second), and sight lines and
  the light meter read Sam's. CHECK `probes.ts haul` (tools/qa/haul-check.ts, families takedown and close; `HAUL_BREAK=1` fails `haul`), both stands, against
  the same choke with the key down: his feet 11‥12 cm up, his head 8 cm up, Sam's neck 13.5 cm further back, the choking wrist where it was against his neck
  to 1 cm and his hands against that wrist to 0.5 cm; the two heads never closer than with the key down (18.5 cm at the least, 26‥31 at its height); feet down
  by 1.5 s and every joint the key down's from 1.6 s; no joint over 5 cm in a frame (4.8, a finger of his as his hands come off); the key put down mid-haul
  brings his feet down at 1.2 cm a frame; the hold broken mid-haul and a man grabbed again a quarter of a second on moves nothing further than with the key
  down. One seed, one man, the lobby's open floor. TRAPS MET: (1) lifted 11 cm with Sam's hips pushed forward under the lean, the man's cap went through Sam's
  head (15.6 cm between the head bones where the key down has 18): Sam's head has to go back FURTHER than the man's. (2) Sam's knees must not go through the
  lowering's pinned-feet branch for the haul: switching it snapped his knee 3.4 cm in a frame, twice a choke. (3) The haul kept from a hold broken mid-haul
  came back whole on the next hold's first frame (13 cm): it is folded into the layer's weight on a fresh hold, as the lowering is. HELD OFF THE HAUL: the
  older choke lines of takedown-check.ts (`chokeRun`) and hold-pose-probes.ts hold-struggle (b), whose windows the haul's own motion falls in; the haul's frames
  are haul-check's. Pictures: `close-stills.ts --scene choke` (before: `--set '{"TAKEDOWN":{"haul":false}}'`). NOT SEEN: anything on a GPU or in the page; how
  it reads from the game's camera at play size; the two men's clothes and the cap through each other (bones are read, not meshes); no tally was run.
- **A teammate sees what the picture shows (`FOG.mates`, 10-25).** The maintainer, asked whether the men's own eyes should pass thin things as
  the fog's lines do (the open call under `FOG.thin`): "and yeah i think teammates should see whatever we see". Before, the fog's lines passed a
  static marked thin and free while a teammate's own sight test (`guards.ts eyeContact`) stopped at it: a man behind a window's bar or a
  stovepipe was in the picture, and could be called, while the teammate standing there did not notice or shoot him. THE RULE: an OPERATIVE's own
  sight line is handed the mask the fog's lines use. ONE MASK: `fogofwar.ts fogThrough()` (glass, and with `FOG.thin` the thin marks) is what
  `sightBlocked` asks; `guards.ts teamThrough()` is that under `FOG.mates` and glass alone without; `eyeThrough(gd)` is the team's for an
  operative and glass alone for every other side. A flag the fog's line learns to pass is added in `fogThrough` and nowhere else. WHERE:
  `canSeeChar`'s two looks (his eye, and his sights' eye in a room fight); through the bare line `guards.ts eyeBlocked(g, gd, a, b)`, the test of
  whether a man he just lost went BEHIND something (the lead fix) and the room fight's six lines from a teammate's eye to a man's chest
  (`roomfight.ts`: who turns to a shot, the turn point, a report's shooter in `cue` and `letGo`, a mate's target, footsteps); and the PLAYER's own
  line that tells the squad's net of a man the picture shows him (`picture.ts lookSam`: `teamThrough()`), so a man you see past a bar is a man
  your squad is told of. So a teammate's own test and the fog's line from his head say the same of a man across a thin thing. THE MARKS are a level's
  (`scene/thin.ts`, made at every stand-up) AND the bare studs of a wall a charge opened (`wallbreak.ts`), as for the fog. SIGHT ONLY: his rounds
  still meet the thing (`clearShot` holds a shot it is across: a man with a walk left walks on, a planted man waits with his gun on the man and
  is counted in contact until one of them moves), sound and light are untouched. A WINDOW'S BAR is the exception since `WINBARS` (`winbars.ts`,
  joined here from the build head): a line of fire passes a standing bar and the round breaks it, so past a bar he sees AND shoots; a post, a
  stovepipe and a stud still hold the shot. NO OTHER SIDE'S EYE CHANGES: a defender, a civilian and a camera
  stop at a thin thing as ever, so across a bar the teammate has the defender and the defender does not have him. It does not need the fog up; it
  does need the thin row. NOT the picture alone: who a teammate has noticed is the game's, so a digest can move. SWITCH: ON in the module and the
  page; `?fogmates=0` = his eye stops at a thin thing, as it was; the debugger's fog page has the row; frozen stand: off, `TPS_FOGMATES=1` raises
  it BUT ACTS ONLY WITH `TPS_FOGTHIN=1` (`FROZEN_HOLDS['FOG.mates']` says so: the frozen stand pins the thin row off too); the journal carries it
  (a recording without the key replays with it off). CHECK: `probes.ts fog-mates` (`tools/qa/fogmates-check.ts`, family `fog`; 5 lines;
  `FOGMATES_BREAK=1` reds bar, agrees and stood) on both stands. MEASURED, headless: The Pass, one staging seed: across its 16 thin marks, 1168 pairs of
  a teammate and a defender (sixteen bearings, nine spacings): the row gives him 707 of them, takes none, and his test differs from the fog's
  line on none (on 707 without it); the defender's eye is the same on all 1168; with the thin row off the row gives nothing. Stood: the pair kept across one mark for 30 of the game's own frames: with the row the room fight's
  meter on the man goes to 1.00 and he is the teammate's target on 25 frames; without, meter 0 and no target; the defender never takes the teammate. Played on The Pass,
  the squad sent at a hidden man, 20 s: with the thin row off the run is the same by digest and dice with and without this row (seed 3), on both
  stands; with both rows on (seeds 3 and 4) no defender's sight of a teammate differed on any sampled frame. THE ROOM CLEAR'S TALLY
  on the shipped stand (`roomclear-tally.ts`, the office: 92 marks, 39 of them across a standing man's sight lines; four policies, seeds 1 to
  12 = 48 runs): every run the same with the row and with `TPS_FOGMATES=0`, run for run, so on that floor the row changed no fight. THE PAGE
  (software adapter, The Pass, the squad of four, Hard, the pair kept across the mark at (14.10, 11.00) for 30 frames): 119 of 119 pipelines, no
  console or GPU error; the plain line between them stopped and the masked one clear; the teammate's meter on the man to 1 and the man his
  target on 24 frames; with `?fogmates=0` the same
  boot and lines, his meter 0 and no target (the drawn frames were the boot's and one burst: the rule draws nothing). NOT HELD: (a) never seen on a GPU and never played:
  whether a teammate noticing a man past a bar reads as fair is the maintainer's to judge; (b) the planted man above: nothing makes him lean or
  step for a shot past the thing; (c) a teammate's sight of things that are not men (a body, a door, a lamp) is unchanged; (d) one level's marks
  in the sweep, one staging seed, two played seeds; `tour.ts` and `soak.ts` put no teammate on the floor, so the rule cannot act in either and
  neither was run (the tally above is the measurement); (e) the asymmetry is by
  the maintainer's words (teammates), not a ruling that the enemy should stay blind past a bar: giving every eye the marks is one more row if he
  asks; (f) the room fight's turn-to lines and the player's line for the net are held only as written (the check counts the calls and asks the bare
  line across one pair), not by a fought run that needs them; (g) `lanes.ts gunsManned` and `pointInView` (a teammate's view of a place or a
  body) still stop at a thin thing.
- **Tap to step (`src/game/tapstep.ts` TAPSTEP, a prototype; `tools/qa/tapstep-check.ts`, also `probes.ts tapstep`).** The maintainer, 2026-10-25: "i love the tap to step idea! curious how we can make this feel awesome. and also generalize between creeping on a guy to grab him vs slithering through guards". Crouched, the move keys are steps: a press lifts the foot, the key kept down reaches (`reachM`), let go plants it (a tap is `tapM`), and between steps he stands dead still. A step is a least-jerk curve from rest to rest over `secs` (less for a shorter one), walked on its own numbers: his first cut, a trapezoid at 2 m/s, drew "the rhythm of them is nice but it looks like it'd be loud. the legs move in abrupt movements"; now 0.12 m/s at most in a frame, top 1.66 m/s, and the legs nearly stopped as the foot comes down. The legs go from wherever they stand to the next plant, and a creep let go of hands them over untouched: the first cut forced them back to its last plant, half a cycle in one frame, which he read as a snap to idle ("the animation can be paused at any point"). After a plant his weight settles for `settle` s: a held key waits it out, so holding is always the safe pace (about 0.75 m/s); a press inside it steps at once, quicker by `rushed`, and scuffs (up to `scuff`); a press just after it is on the beat, a `beatM` tap. A plant just after a near man's footfall is under it (`mask`). A press toward the back of a man he could stalk, inside `landM` of the spot `STALK.keyM` behind him and `landCos` of its line, bends onto that spot, settled at the press, and keys turned away take it back; on the spot a key is a plain step. His replay of the first cut: "weird snapping to the guard, stuck on them afterwards" (a tap carried 1.1 m, then every key was a step of no length). Behind a walker `follow` of his speed goes into the step. Shift is still the quick crouch walk. Switch: up in the lab and with `?tapstep=1`, `?tapstep=0` puts it down in the lab; down in the plain page and on the frozen stand (`TPS_TAPSTEP=1`), so no FROZEN_HOLDS row, as with `stalkdrag`. Rides a recording; one from before the key replays with it down. `TAPSTEP_BREAK=1` fails on both stands' lines; soft, away and letgo were also run against the first cut and fail there. Every number has a row under Tap to step in the lab. A replay of the lab can't be rerun headless yet (its scene is staged by the page, not on the tape). Never seen on a GPU.
