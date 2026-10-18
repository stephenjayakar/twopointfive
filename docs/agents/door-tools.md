# Door tools and entries

One of the area files CLAUDE.md indexes. Everything below was moved here word for word from CLAUDE.md on 2026-10-13, in its old order;
"the bullet above / below" in a bullet means its neighbour there (each block says which lines it was), and a bullet named by its bold
title may now live in another file of this folder: `grep -l '<title>' docs/agents/*.md`. New bullets for this area go at the foot of this file.

<!-- was CLAUDE.md lines 820–989 -->
- **Door tools** (`src/game/doortools.ts`, `Game.doorTools`, `__doortools`; record rebuild/room-clear/door-tools.md): a page of door rows on the order
  menu when it is opened on a door, registered through `orders.register` on a PAGE of their own (the door's first page has row 5 'door tools ▸' = the `TOOLS_PAGE` opener; on the page: ids
  `openClear` 1 · `bangClear` 2 · `charge` 3 · `thr` 4 = 'work it from the threshold ▸', the opener of a page BEHIND the page (`THR_PAGE`: `thresholdHold` 1 'hold the door until I say' · `threshold` 2 'step in once it goes quiet' · `outside` 3 — Esc / right click step back ONE page) — an order for a door = 5, then its digit; the threshold's = 5, 4, its digit. While men the menu's orders go to hold a threshold on that door (`thresholdHeld`: phase 'thr', either form) the first page's row 5 is 'threshold held ▸' instead (`HELD_PAGE`, a STAND-IN row: orders.ts `OrderDef.standsIn { for, when }` — listed in another row's place on its digit while `when` says so, re-read on `refreshSecs`): `thrBang` 1 · `thrStep` 2 ('step in · no bang'; `DOORTOOLS.thrBangFirst` — the *Calls taken* bullet) · `thrLeave` 3 · `thrWord` F (= `thresholdThen` step / bang / leave, and the word); F is the pair's word with a menu up too. QA `probes.ts thresholdmenu` (rows / held: all seven start-card scenarios, everything by keys; `THRESHOLDMENU_BREAK=1` = its red path). The menu re-reads its list the frame a stand-in comes or goes and a page opened by one every frame (`SquadOrders.due`); an opener whose page has a row on a key of its own names it ('threshold held ▸ · F: go') and that key works from the first page too): open and clear (stack, the keyed shove or the lead's boot on a door locked against the team, in to the level's clear-plan points or geometric
  ones), bang and clear (only the opener at the frame, the rest filed behind him; the can goes off IN THE AIR `airIn` inside — `detonateStun` with the entry's men
  off its list; nobody crosses until the bang AND the defenders' blind burst has run dry; `FIGHT_SKILL.hostile.daze` [1, 2] s = a flashed man is no quicker on a
  watched door for that long after his sight is back), breach with a charge (a man `setSecs` at the lock, the squad stood off `standoff` m along the wall, then NOTHING
  until Sam's F — `doorTools.input` reads it before the night breach does — or the row again, which reads 'blow the charge': `blow()` = `kickIn` + far-side men inside
  `knockM` down ('struck'), inside `stunM` with no wall or other shut door between dazzled AND `staggerUntil` (no blind burst), near-side men inside `backblastM`
  dazzled), clear from outside (one arc of stations from the opener's jamb round the front of the door, muzzle across each station's wedge, held outside until an
  entry order). `DOORTOOLS.charges` 2 / `.bangs` 3 per run (a new operative roster = `reset()`, checked by `sync()` wherever an order or a count comes in); a bang
  and clear TAKES its can at the word (`DoorOp.bangHeld`; `refund` if the order ends before the throw), a charge is spent on being set and comes back if its door
  comes open before the trigger (a charge sits on a SHUT leaf); the night breach's F drill takes its can from the same count (refunded on a call-off). A job only
  one man was at (setting the charge, the boot) starts over with the next man when he is lost or re-ordered (`newLead`). Men are
  moved ONLY through `SquadOrders.assign` (an op drops a man whose assignment is no longer the one it handed him) and never fire here — the room fight does, through
  `GuardScript.over`; weapon lights go ON with the entry / slice assignments (an operative sees in a dark room only what his light is on). A can an ended op (or the
  F drill, breach.ts `casualties`) left unfired is put on a short fuse. At the 64-light cap the blast's flash light is simply not uploaded; the stun is CPU-side.
  QA: `probes.ts doortools` (menu / charge / bang / outside / counts / edges / lights / firstman — the last = on an alerted floor a bang or a charge loses fewer first men than
  the plain door; on a quiet floor the plain door wins by surprise).
- **The big slot's row on a door's tools: H** (`doortools.ts BIG_ORDER` 'bigClear', `BIG_KEY` KeyH, `bigKey`; kit.ts `BIGSLOT.shut` — the whole rule, its switch, check and what
  was measured: `docs/agents/player.md`, *The big slot's tools open ANY shut door*). Registered on `TOOLS_PAGE` before `fragClear` while a man of the squad carries the hammer or the
  breaching shotgun, on a key of its own (the digits are taken): the first page's row 5 reads 'door tools ▸ · H: hammer and clear' and H works from there (X, then H). It is an
  `openClear` with `DoorOp.big`: the tool takes the door locked or not, no halt at a door found shut, one trip to the door. In `holdfire.ts LIFT_ORDERS` and `silent.ts LOUD_ROWS`.
- **The tool's man stands hard by the frame** (`shotgun.ts breachSpot(…, close)` → `bigkit.ts bigSpots`; kit.ts `BIGSLOT.moves` — the whole rule, its switch, check and what
  was measured: `docs/agents/player.md`, *The big slot's tools are carried, walked to the frame and swung*). With the moves on, `toGun` sends a man whose tool is KIT (the big
  slot's hammer or shotgun) to the tool's own places first — the hammer: latch jamb, the hinge jamb on the face the leaf opens away from, then off the lead's shoulder; the
  shotgun: latch jamb, the shoulder, then the hinge jamb — skipping one that is crowded, behind glass or, for a shell, across a mate; the list before stood him a metre and
  more off the wall. `hammerStep` takes the hammer off his back as he is sent (`hammerOut`), tells the animator each blow a wind-up ahead, holds it wound up for a word
  (`WORD_LEAD`), and `tick()` puts it back when the door is no longer his (`hammerOutTick`). Off = the spots and the strike clip of before.
- **A room worked from the threshold** (doortools.ts kind `'threshold'`, phases `'thr'` → `'pocket'` → the entry's own; on the door menu behind X, 5, 4 — the *Door tools* bullet's pages;
  records rebuild/threshold/stage.md and menu.md): stack a man on each jamb, open the door, and NOBODY goes in — both jamb men hold their
  diagonals STILL (`thrStill`; the opener's slice `thrSlice` ships OFF: a lit muzzle walked round a doorway is seen first — roomfight.ts lampGlare — and lost
  38–47 of 112 where still guns kept 49–65), one light on the door (`thrLight`), the rear men of four keep the squad's back (`Assignment.spare`); whoever
  comes to the noise is the room fight's, from outside. TWO ORDERS: `threshold(men, t, onWord)` goes on by itself once nobody at the door has had a man in
  sight nor a defender fired within `thrShotM` for `thrQuiet` s (≥ `thrMin`, ≤ `thrCap`); `thresholdHold(men, t, onWord)` says 'holding on the door' then
  and KEEPS the jambs until told — `thresholdThen('step' | 'bang' | 'leave', men, t?)` (`canThresholdThen` = a row's `valid`): step in with no can · bang
  (≥ 1 can, pocket or not; refused with no cans or a teammate behind the door) then step in · leave it (the order ends 'stood down', its men a plain
  'stack' on their marks, nobody crossed, no can spent). THE WORD (`go()`; F — the pair's key too while a threshold is on its jambs, a set charge going
  with it) = bang the pockets and step in, either order; for the four it rides the `Word` with whatever else is waiting (crossing together from 'wait').
  Pockets = floor no lit muzzle has been across from outside (`thrLitCell`, the entry's search model): ≤ `thrBangs` cans from the kit's count, thrown by a
  man who is not first in, each where it lights the most unseen floor; none when all was seen or one of ours is in there. Step in = `shallowPods` (≤ 2.5 m
  inside, `thrIn` men; the rest outside), then corners / search / sectors as any entry. ON THE MENU since the door-menu part: X, 5, 4, then 1 (hold) or 2 (step in by itself); what next behind X, 5 while held (the *door tools* bullet's page list). Harness: `thresholdOn(door, who?, side?, hold?)`,
  `thresholdTell(what, door?, who?)`, `order('threshold', men, door, side, gate, hold)`, `PT_TOOL=threshold | hold` for playthrough.ts (hold = order (b) with the scripted commander answering 'holding on the door' a second later: 'bang, then step in' with a pocket's worth of floor unseen, else 'step in'; `PT_TELL=step|bang` pins his answer). Team feel rows
  'threshold ▸ …' (twelve). With nothing ordered the game is af55d89's digest for digest (`threshold-identity`). THE ROOM'S OTHER DOORS ARE HELD after
  a threshold entry (`thrDoors`, on; `holdDoors`: once the floor is searched each other door of the room gets one man of the entry — in place with a line
  inside `thrDoorsM`, else he walks up BESIDE it, ≤ `thrDoorsWalk` by the floor — recorded in `held` with `door`, 'holding · <door>'): the stage used to end
  with every man on a 4 m crossing sector by the entry wall, and the depot's crew room let a man in by its far door unseen. `thrDark` (on): jamb men who
  wear goggles hold the door dark; `thrTube` (on): floor seen through the tube is no blind pocket; `thrSet` (OFF, measured neutral): the far gun steps
  onto its diagonal before the door moves. MEASURED BEFORE THAT (98a47a0, 48 seeds × the seven scenarios): 436 (stepping in by itself) and 421 (held, then
  told) of 864 against today's entry's 498, the men lost standing at the open door; better with the four in the office and for the registry's hostages, worse
  for a pair and in the depot; one can / both lit / the slice move nothing overall (record rebuild/threshold/threshold.md). MEASURED WITH
  THE DOORS HELD (and `thrDoorsStay` 1: with no man left on the door they came in by, one of the entry's men is never sent — a lone survivor sent to a side
  door lost 8 of 32 registry rescues) over 48 seeds × the seven scenarios, on a0a2d50's game (864 teammates;
  rebuild/away-build/threshold-survival.md): threshold 495 → 532 up (paired +37, 95 % interval 9 to 67), today's entry 511; the depot
  101 → 134 of 192 (today 145); hostages alive 106 of 192 either way (today 80); squads wiped 81 → 67 of 336 (today 100); everything but `thrDoors` is
  inside the scatter. The night breach drops 89 → 84 of 96 in the script's last hunt (not at the door). `thrLast` (on; Team feel 'threshold ▸ last warning heard', pinned off in threshold-identity):
  a hostage only ever dies by the captor's own clock, and at a hostage room's door that clock is known — `rescue.ts lastWarning(door)` = the captor
  of the room behind this door is on his last step ('about to': the step the HUD words for Sam; no sound is propagated for it), raising the gun, or has
  already shot one. Then a plain threshold order (not held, not on the word, no gate) stops being patient (`doortools.ts lastCall`): the stack does not
  wait for a man still more than `thrLastM` 2 m from his mark (`lastStack`: the jamb man who IS on his mark opens — the door handed to him if the lead was
  the one walking; a late man bound for the far jamb takes the first free place behind the lead on the near wall, clear of Sam, instead of crossing the
  opening — with no floor there he keeps his jamb) and the hold at the open door is skipped: ONE can at once (`T.force`), then in — a can `thrFirst` threw
  inside `thrLastFresh` 3 s IS that can. One that burst on the team's side of the door (`Threshold.wide`) is not, and `thrFirstOnly` never holds the last-warning can back. Traced on 1df2ad2's registry rescue: all 8 hostages lost were shot by the clock 0.3‥3.4 s before the can, with
  Blue Two 12 m back on cover when the order came. Registry from the threshold, 48 seeds, hostages / teammates up of 96 (48 of 48 won in every cell):
  neither rule 88 / 62 · `thrFirst` alone 95 / 96 (seed 32: stacked 5.2 s after the order, the can in the air 0.2 s after the shot) · `thrLast` alone
  96 / 71 · both, as shipped, 96 / 96; the office rescue 96 / 96 in all four, everything without a clock untouched
  (rebuild/away-build/registry-hostages.md). Other entry tools on a hostage door still wait for their stack. The play-through's
  `--json` carries the captor's `clock` {t0, secs, log} per rescue run and `last: 'stack' | 'hold' | 'both'` per entry; `PT_WHERE=a-b` with `--trace`
  prints where every man stands twice a second; `probes.ts threshold-last` = the door staged by hand (late far man / late lead / Sam in the place / off)
  + two played seeds with and without. `bun run tools/qa/threshold-tally.ts --col "today=a.json" --col "threshold=b.json" [--md]
  [--by-scn] [--windows 8]` = the before / after tables over play-through `--json` files (teammates lost and where, defenders dropped from outside / inside
  their room, seconds a door, cans, entries into floor nobody saw or banged; every difference paired by scenario and seed against the first column with a
  bootstrap interval). A CAN FIRST ON A HOT DOOR (10-06, `DOORTOOLS.thrFirst` 0 never · 1 on a hot floor, shipped · 2 every door; Team feel rows 'threshold ▸ can 1st' / 'thr ▸ can 1st hold' /
  'thr ▸ can 1st stale' / 'thr ▸ can 1st m in' / 'threshold ▸ can 1st is the only can'; record rebuild/away-build/open-door-hold.md): every man the stage lost holding an open door was lost on a LATER door of a
  run, the floor already loud and the room's guns on the doorway as the jamb men stepped onto their diagonals. So while a shot / charge / boot is inside
  `ROOMFIGHT.teamHot` in the ears of a man of the order (`RoomFight.hotFor`), the leaf is opened from the jamb, the FIRST of the stage's `thrBangs` cans goes in on the shove (`tossAfterOpen`) with
  everybody still behind the wall (`Threshold.first` 'can' → 'burst' → 'done', phase 'pocket' before 'thr'; beat '… · a can first'), its blind burst runs dry on a
  bang's own count, and only then `thrOut` sends the jamb men onto their diagonals for a hold of `thrFirstMin` 2 s at least (1 s measured worse: more lost stepping in than saved at the door; a can that went off on the team's side — `Threshold.wide` — earns a plain hold); a hold that ends more than
  `thrFirstStale` s after that can counts its floor blind again (0, shipped = banged once stays banged); `thrFirstIn` m = that can cooked short of its pocket (0, shipped = at the pocket); `thrFirstOnly` (on) = that can is the door's ONLY can (`thrCans`; off = the stage's `thrBangs`, as the rule first went in: floor the first can left dark got a second before anybody crossed; with it on the stale rule has nothing to do; Sam's word and a told 'bang' get the stage's count either way — `Threshold.asked` / `force`). MEASURED from the threshold, four room scenarios, same seeds (192 runs, 576 teammates a block): lost holding the door 38 → 19 (seeds 1–48) and 50 → 27 (49–96), teammates up 382 → 407 and 342 → 380, won 161 → 163 and 146 → 153; with the switch off 396 / 379 up, 160 / 156 won and ~25 more cans a block (the same within the scatter); the depot alone gets no better: 48 → 46 won of 48 on seeds 1–48 (switch off 45), 46 → 45 on 49–96. Negatives: a 1 s hold behind the can, the can cooked short, and stepping straight in off the diagonals with no turn in to the jambs (no better on seeds 1–48, 19 teammates worse on 49–96). Never on a word (given on it or let go by it: `DoorOp.worded`), a gate, an order held until told, with no can
  in the kit, or with a teammate of any squad's size or Sam beyond the door inside the can's reach; F / `go()` while that can is in the air is kept (`Threshold.early`) and taken as they step out; told 'bang' behind it, the first can is not the one asked for; 0 = the stage as it was (pinned so in threshold-identity). QA: `probes.ts threshold` (pair / four / hold / first / doors / last / play / identity).
- **A taken room's other door** (`DOORTOOLS.otherDoorM` 9 m, on; 0 = as it was, pinned 0 in threshold-identity and the nvg / irlaser digests; Team feel
  'entry ▸ other door m'): during a bang / open and clear, each other door of the room that nobody of the squad has been beyond (entrypoints.ts `farKnown`)
  gets the nearest man of the entry on his point with a line to it — his gun goes onto it where he stands (`doortools.ts otherDoors`, `DoorOp.other`), at
  most half the men while the floor is searched — and none while fewer than three living men are on the order (a pair, or a four cut down to two), whose doors are dealt at 'in': both guns stay the room's until then (`probes.ts doortools-firstman`; per ORDER, so two pairs sent into one room by two doors on a word each deal none until 'in') —, an inside door before an outside one; kept on the hold (`watches`, re-dealt each tick) until an order takes
  him, and GIVEN BACK (his sector again) when the squad has gone through it, another order works it or a teammate is told to watch it. The door they came in
  by gets its `lastOut` man first. QA: `bun run tools/qa/other-door-check.ts` (`--off` must fail); playthrough.ts `deaths[].other` / `runs[].other`;
  record rebuild/missions/fixes/other-door.md.
- **An entry clears the WHOLE room** (`DOORTOOLS.flowOn`, on; off = the search as it was, run for run — pinned off in threshold-identity and the nvg /
  irlaser digests; Team feel 'whole room ▸ unseen part is gone into'; the maintainer: "in corner fed rooms like this, the squad should really clear the whole
  thing without being told"). The points of domination sit 2–4 m from the door whatever the room's shape, and `moveOn` only ever walked ONE man to where
  unseen floor is best SEEN from — the mouth of the gap — so a second half round a wall's end, the far leg of an L, the far end of a hall stayed nobody's.
  `doortools.ts flowIn` (first thing in `moveOn`, before its vantage move): the biggest connected piece of floor nobody has looked at, `flowCells` (28) cells
  or more, is GONE INTO — the man nearest it leads; where his walk first crosses onto it is its mouth; within `flowBound` (8 m by foot) a PAIR goes through
  (`away(…, pair = true)`: the buddy rules, asked for two) to two points past the mouth, about `flowDeep` in, by walls, to either hand, each in the other's
  view, each facing his share of the piece; farther they go a BOUND toward it; refused for the distance from the men who stay (`awayFar`), the rest CLOSE UP
  on the lead (`besidePod`, a man on another door of the room gives it up and it is dealt again) and the walk is asked again — a long room is crossed in
  bounds, the rear behind the front. Two men whose partners hold doors of the room pair up (`lent`). A pair of two alone is never both sent (nobody would
  stay). ≤ `flowMoves` (5) flows and as many close-ups a search; the search's time cap grows `flowSecs` (10 s) for each and by the time its men spend in a
  fight (≤ `flowFight` 20 s; one clock per floor, counted only of an order with a man through the frame). One spoken line a search ('pushing through.'). Stats `flowed / closedUp / flowLate`; beats `flow:` /
  `bound:` / `close up:` / `flow: no · N cells · why`. QA: `bun run tools/qa/wholeroom-check.ts [scenario …] [--door d] [--verbose]` (every door onto a room
  with a part its entry points cannot see, hostiles off the floor, 'open and clear' with the rule off then on: floor left unseen, men in the hidden part,
  seconds; exit 1 if any door is left worse), `tools/qa/cornerfed-survey.ts` (which doors those are, level by level), playthrough.ts `PT_RESCUE=side` (the
  consulate's side door alone, by the order menu — the picture the ask came with). Record rebuild/room-clearing/read-first.md.
- **The whole-room rule stops at yards and very large rooms** (`DOORTOOLS.openAir`, on: floor with no roof over most of it is open floor, not a room — an
  entry onto it sweeps from the door and stops, no search of it, none of its far doors dealt; `DOORTOOLS.flowMax` 400 nav cells = 100 m²: a bigger room is
  looked over from where its floor can be seen and nobody is walked into its unseen parts or down it in bounds; 0 = no limit. Team feel rows 'whole room ▸ a
  yard is open floor' / 'whole room ▸ cells'; off / 0 = the whole-room rule as it first shipped; the maintainer, 10-11: "i like that they try to fully clear
  rooms now, but it doesn't make sense for outdoor spaces or very large rooms"). `wholeroom-check.ts` holds both limits.
- **A door found shut, a kick from beside it, one order to clear from outside** (the maintainer's notes on barricaded doors, 10-11; three switches, each ON
  in the page and OFF on the frozen stand — `FROZEN_HOLDS` rows, in a journal's tables, a recording from before a key replays with it off; Tab ▸ Player, doors
  & props). `DOORTOOLS.testDoor` (`?doortest=0`, `TPS_DOORTEST=1`): what the TEAM KNOWS of a door is kept per run and PER FACE (`DoorTools.tried`, cleared by
  `reset()`; a door locked from one face says nothing of the other): a jamb man on a plain 'stack' tries the handle and says what he found ("wedged from inside." / "it's not locked."; `testStacks`), and the player
  standing at a door's lock rows makes it known too. An entry order given from the MENU at a door that turns out locked or wedged against the team, which the
  team did not know, HALTS at 'stacked' (`haltAt`: "<why>. holding on it — your call.", the op ends 'found shut', its men on a plain stack) — and the door's
  rows read 'kick and clear · <why>' / 'kick, bang and clear' from then on (`entryVerb`), so X, 5, 1 again boots it. THE MENU DOES NOT READ A LOCK FOR
  THEM: `stackable()` greys an entry row for a lock (steel, a frame that holds the boot) only once the team knows that face is shut; an unknown locked
  steel door halts like any other ('steel, and locked. holding on it — your call.') and is greyed after. Never halted: an order given by code
  (`order()`: `DoorOp.coded` — every scenario's own entry and the scripted commander's `PT_TOOL`), a captor's last warning, a silent squad
  (its own pick rules), a face the frame holds (open()'s own words). playthrough.ts's commander re-gives the row once after a halt. `DOORWAY.sideKick`
  (`?sidekick=0`, `TPS_SIDEKICK=1`): the boot is thrown from beside the latch jamb (`Doors.kickSpotSide`: 0.3 m past the latch edge, 0.55 m off the frame,
  out of the opening) — the squad's lead whenever that floor is free (`doortools.ts bootSpot`), the player when he stands beside the jamb
  (`player.ts sideKickSpot`); else the square kick. `DOORTOOLS.outsidePlain` (`?outsideplain=0`, `TPS_OUTSIDEPLAIN=1`): row 4 of the door tools is ONE
  order, 'clear from outside' (= `thresholdHold`: the jambs held until told; the threshold's page and the 'threshold held ▸' page are not on the menu);
  while ANY addressed man holds that door (`heldPlain`; all of them under `thrHeldAll`) rows 1 / 2 of the same page read 'go in and clear · no bang' /
  'bang, then go in · N left' (= `thresholdThen('step' | 'bang')`, given to the men who hold: `only`; with 'wait for my word' on they keep the jambs and the
  word then does what the row said — `thenOnWord`, `Threshold.wordStep`: F after row 1 steps in with no can), F is still the word (with `PLANLAY.on`, the page, a row picked with 'wait for my word' on is first LAID — squad.md 'X is where the plan is laid' — and F sends it; from there it is this), and a can asked for at a held door is ONE can (`thrCans`). So an older 'X, 5, 4, then 1 or 2'
  path in this file is the switch OFF; every older threshold probe runs on the frozen stand and is unchanged. `bun run tools/qa/doortest-check.ts`
  (`probes.ts doortest`, in family `doortools`; both stands; `DOORTEST_BREAK=1` must fail). Never seen on a GPU or played by anybody.
- **Jamb men slice a doorway before they call it held; a man on a cut leans** (the maintainer's tape and note, 10-18: the pair told to 'clear from
  outside' stood on its two diagonals, said "holding on the door" with 21 of 47 cells unseen and a man dead centre 2.5 m in, in the wedge neither diagonal
  shows, and was shot stepping in; "men should try to pie from the outside as much as they can before considering their job done", and "some element of
  leaning to the AI (but probably not our movement for now)"). TWO switches, each ON in the page, OFF in the module and on the frozen stand, a
  `FROZEN_HOLDS` row, a standup pin, a debugger toggle ('jamb men slice a doorway', 'a slicing man leans'), and a journal line (a recording from before
  either key replays with it off): `DOORTOOLS.thrPie` (`?thrpie=0`, `TPS_THRPIE=1`) and `DOORTOOLS.thrLean` (`?thrlean=0`, `TPS_THRLEAN=1`; it does
  nothing without thrPie). **thrPie**: in the hold (`case 'thr'`) BOTH jamb men walk cuts (`pieSet`: his diagonal first, stood square exactly as with
  the rule off, then the stations of `thrPieArc` further toward the middle of the opening, never across the frame line, none within `thrPieApart` of the
  other man; the hinge man of a leaf that stands on the team's face — `thrPull` — has no edge and takes none). A cut is taken only if it still shows
  floor no muzzle has been across (`pieNext`, asked of the room search with the same light test the hold counts by, from a kneeling eye for a knee cut),
  its clock starts when his hips are on it (or `PIE_WAIT` after), a man in his sight keeps him on the angle that shows him, and 'holding · on your word'
  waits for both men to be done (still inside `thrCap`). Three manners from the play-through's death records: a man who shows while he is stepping to
  a cut stops him where he is; a man in his sight with no round at him — the jamb across his own bore, `RoomFight.noShot` — brings the gun round after
  the eye (`PIE_GUN`: a hand toward the middle, three times at most, then the cut is given up for the one before, beat 'no shot from the cut'); when
  the hold moves on or ends mid-cut nobody is left leaned or on a knee (`pieOff`). **thrLean** (teammates only; the player's movement is untouched):
  on a cut his hips stop `thrLeanM` short of the station and his head and gun go the rest of the way (`CharacterAnimator.lean`, `LEAN_POSE` in
  character.ts — a roll through the spine with the head levelled; carried by `GuardScript.lean`, written by orders.ts only while he is on his mark);
  what he sees is asked from his head bone (`lineTo`), so the picture and the model agree; the cuts that look down the door's own line (`thrKneeIn`)
  are taken on a knee. `bun run tools/qa/thrpie-check.ts` (`probes.ts thrpie`, in family `doortools`; both stands; `THRPIE_BREAK=1` must fail): the
  tape's door staged, off = as it was (both men still on their diagonals, the man in the middle never seen); on = both men stood on every cut they
  were sent to and were done before the door was called held, the man in the middle seen and dropped from outside, nobody lost, 8 cells unseen against
  24 of 51 (frozen; 8 against 19 of 47 shipped) and the door called held 0.1–0.15 s later; nobody's hips or head near the frame line; the lean in the bones
  (head 0.14 m to one side, 0.15–0.19 m to the other, past his hips; in the door runs 0.2–0.3 m toward the middle against 0–0.18 square); knees only
  with the lean; the word given mid-cut leaves nobody bent; the journal and the page flags. RUN 10-18: that check and its break word on both stands;
  families threshold, thresholdmenu, doortools, foursquad, doortest on both stands and doormenu on the shipped stand, all green (the shipped
  `orderkeys` family is red by 30 lines with both switches off too: not this rule's); knobs-check, rollback-check --static, dice-check, both
  typechecks, the build. MEASURED, and it is NOT a gain there: the scripted play-through, `TPS_PROFILE=shipped PT_TOOL=hold`, 21 scenarios × seeds
  1–8 (167 paired runs): teammates up 287 of 588 with both switches on against 303 with both off (−0.10 ± 0.09 a run: inside the noise), wipes 44
  against 43, the five pair scenarios 64 against 61 of 80. Why it is no gain: a man seen from a cut is an even duel through an open door with no can
  thrown, and the scripted commander bangs most held rooms anyway; before the three manners above it was 275 against 293 on the same runs, with 17
  deaths (against 4) of a man on his killer with the jamb across his own line in the six scenarios read. Those three manners have no staged check of
  their own: they are read from the play-through's death records only. Never seen on a GPU — the lean and the knee have been seen by nobody — and
  nobody has played it.
- **A pair halted on a door the other pair is charging steps back off it** (`DOORTOOLS.haltBack`, 10-13: ON in the page — `?haltback=0` — OFF in the
  module and on the frozen stand, `TPS_HALTBACK=1`; a `FROZEN_HOLDS` row, the pin lists, a debugger toggle next to the two above; journal: a recording whose
  DOORTOOLS row has no such key replays with it off). The fault, found by `pairs-probes.ts` on the played rules: the step back to rear security is asked
  of a pair stacked on a door ONCE, as the other pair's charge order is given (`startCharge`); a pair that came after on an entry order and halted there
  'found shut' (`testDoor`) stayed plain-stacked inside `backblastM` and the charge Sam blew dazzled his own man (`backblast 1`). `doortools.ts
  haltBack(op)`, the last thing `haltAt` does: a charge order live on that face of that door, or a TEAMMATE's charge left set on it with its order gone →
  the same `stepBacks` and `makeRoom` → 'rear security · <door>', order still 'stack'. ONLY the halted order's men are asked (everyone else is handed to
  `holders` as not his to move). Kept clear: the charge order's stand-off marks, as `startCharge` hands them, and every other mark a teammate has on that
  door — a halted man whose entry mark is beyond what `holders` counts as on the door (2.6 m; out of the blast, not asked, reads 'stacked · … · locked'
  still) had his mate dealt a place 0.2 m from him without it (shipped, Sam at the door). NO WORDS and no `must`: a man with floor steps back, a man
  without keeps his mark, nothing is said of it. NOT covered: a charge Sam set by his own hand that no pair has been stood off from (a stacked pair is
  not stepped back for that one either); a plain 'stack up' given on a door already under a charge; a blow while the pair is still walking back.
  `probes.ts pairs-haltback` (family `pairs`, 13 lines), both stands — the probe sets `testDoor` and the key itself after the stand-up, so it asks the
  same of both — `HALTBACK_BREAK=1` exits 1 on both: the office's locked manager door, blue the charge, red 'open and clear' five frames later, Sam down
  the corridor (at the door's lock rows he KNOWS it locked and nothing halts); key on = both of red rear security, marks 1.6 m or more off the frame and
  equal (0.000000 m) to those of a pair stacked BEFORE the charge order, backblast 0, the charge order ends 'in', nobody reads 'setting the charge',
  blue's marks and the blast beyond the door the same as key off; key off = stacked, backblast 1 (the fault, asserted); no charge = nobody moved by the
  key; the orders given with Sam at the door, Sam then put down the corridor and the lock he read forgotten by hand (halts on either stand) = no two
  marks within 0.85 m, backblast 0; AS PLAYED, Sam staying at the door = shipped halts, one man steps back past his mate (1.05 m apart), backblast 0 —
  frozen does not halt there (the order ends 'in') and the line passes saying so; a charge LEFT SET (blue arms it, is moved off down the corridor, its
  order ends 'nobody left on it', then red halts) = key on rear security and backblast 0, key off backblast 1 (shipped) / 2 (frozen); the journal.
  Shipped `pairs-tool`'s printout is the same with `TPS_HALTBACK=0` and without. STILL UNSTAGED: a halted man with no floor to step back to (and his
  mate going alone); a third man plain-stacked on the door, not of the halted order; blue told 'fall in' rather than moved off; any other door or
  level. Five stagings, one level, one door, seed 5, defenders kept dazzled, no run tally, no tour or soak. Nobody has seen or played it; never seen on
  a GPU.
- **Sam beyond a door is one of ours to the squad's own stun can** (`DOORTOOLS.behindSam`: ON in the page, `?behindsam=0`; off in the module and on the frozen stand, `TPS_BEHINDSAM=1`; journal: the key rides in a recording's `flags`, its tables never carry `DOORTOOLS` — no flag = off, a flag = as recorded). `canBehind()` = `behind()`'s teammate, or Sam by `canFirst`'s own test of him, any squad size: the word at a held door steps in with the can kept (beat 'no bang · you are in there') and the bang rows are refused ('you are behind that door.'); a plain bang and clear asks again at the toss, as the frag does (given 'on my word' or from a walk away, he may have gone in since: the can back in the kit, the same beat, in without it — on a word shared with another door it waits in step, `hold` 2, as behind a bang; the line to Sam is asked without that door's own leaf, which a shove or a leaf found ajar sweeps across it); his own can, or one he watches from outside, blinds him as before (`SAMSTUN.ownSeen`).
  Off the owner's tape 20261013-044521 (floodlit yard, 6:47.9: the word given from inside the held guard room, the squad's can blinded him). Check: five lines in `probes.ts threshold-hold` (records-pair and depot-four, seed 1: Sam in the room at the word; Sam outside, a labelled control; a plain bang and clear with Sam gone in after the row; the same with the leaf found 1 rad ajar; the journal round trip, a control; both stands; `BEHINDSAM_BREAK=1` must fail — it fails the three rule lines). Never seen on a GPU or played by anybody.
- **A known threat first** (`DOORTOOLS.threatFirst`, on; Team feel 'entry ▸ known threat first', `threatSecs` 12, `threatCap` 1.5; off = the entry as it
  was, pinned off in threshold-probes.ts's identity and the nvg digests; the maintainer on a replay, 10-11: "the point man here saw his buddy go down, knows
  roughly where the enemy is in the room and looks the wrong way going in"): while a door is worked the order remembers where ITS OWN men's senses put an
  enemy in the room beyond (a man one of them had in sight; the muzzle of a round that hit or passed within `threatNearM` of one of them — a round that dropped a
  mate counts only where a man of the order still up has a line to where he fell) — never a true position nobody sensed; the room beyond is asked again
  every 2 s, and a man there is 'down' to them only once one of them sees him down (`sees`). On the entry's first frame the first man in is dealt the known place nearest the doorway (the second the next, or the same one
  until the first has a line): his gun and chest stay on it as he side-steps to his point (`Assignment.strafe`), and his corners' clock starts when it lets
  him go (the man down, the place looked at and empty for `cornerSecs`, stood on, the cap, old news). Where he looks, never when he shoots. A MAN HELD UP SHORT OF
  THE FRAME lets the place go (`threatStuck` 1 s without a stride, the room fight's seconds not counted; 0 = kept until old news, as it first shipped): with a defender
  standing behind a booted leaf both men kept their guns on a place deep in the room for twelve seconds and never looked round the leaf at him, where the entry's
  own corner watch has him in two — `bun run tools/qa/frag-own-check.ts` (the frag's own check, the office's break-room door) was red on four lines for it and holds it now.
  `bun run tools/qa/threatfirst-check.ts` (`probes.ts threatfirst`, in family `doortools`; the compound's shed door; `THREATFIRST_BREAK=1` must fail). MEASURED
  (shipped stand, scripted commander, the tree before the review's fixes, rule on against off, won · teammates up of 48 a cell): seeds 1–12 — the compound 7 · 11 against 8 · 18, the office
  room clear four 11 · 24 both (run for run: nothing is known at any entry there), block-squads (OLD floor) 5 · 10 against 6 · 10, the depot 11 · 38 against 11 · 36; the compound again on seeds 13–24
  6 · 14 against 8 · 15. Four missions 34 against 36 won of 48 and 83 against 88 up of 192; the compound over 24 seeds 13 against 16 won, 25 against 33 up of 96 — not a difference at that
  size, and the rule acts at few doors (the commander's entries are mostly on rooms nobody has sensed a man in). WHERE THE COMPOUND'S RUNS PART it is mostly not this rule: at the bunk room's
  door (`a_s`) whether the SECOND man's gun and weapon light come down round the jamb hangs on 1‥4 cm of guards.ts `colleagueInLine`'s margin against the first man, and the dug-in man in
  the dark corner (Tango 10) drops two men when he sees a lit muzzle first — any change to the first man's path moves that margin. Never played by anybody.
- **A stun canister is not thrown at a leaf** (`DOORTOOLS.bangWay`, ON since 10-11; Team feel 'bang ▸ not thrown at a door', kept per machine; off = thrown on the shove whatever the
  leaf did, as it was; pinned off in threshold-probes.ts's identity and the nvg digests; a recording from before the key replays with it off). The frag's look at the leaf (`fragWay`)
  asked of the can of a 'bang and clear' — never a threshold's cans: it leaves the hand only with the leaf STANDING OPEN (≥ `fragWayOpen` 1.15 rad either way) or well round and still
  going AWAY from the team (≥ `fragWayAjar` 0.6 rad); else the thrower waits up to `fragWayWait` 1 s (beat 'can waits: the door is in the way'), and then the can goes back on his belt
  ('door is in the way — no bang. going in.', beat 'can held') and they go in without it. WHY IT IS ON (the maintainer: "the squad does waste a lot of bangs"; the barricaded rooms
  goal's claim): with one-way doors a door the squad PULLS open swings toward the stack, and a can thrown `tossAfterOpen` 0.15 s after it started to move met the leaf and burst on the
  squad's own side, the room not flashed. Toward the team a leaf is never 'round and going away', so the can waits for it to stand open, about 0.15 s more. A SHOVED leaf's throw is
  frame for frame the old one; behind a BOOT (`tossAfterKick` 0.05) the can leaves a tick or two later. MEASURED (shipped stand, `tools/qa/bang-tally.ts --arms bang`, every door face
  of every held room of fourteen squad missions × 3 seeds, 417 entries an arm, rule off → on): cans that burst outside 51 → 0, teammates lost 178 → 159 of 1264, rooms taken 310 both;
  in the 46 entries of the eleven-mission half where the can had burst outside, 22 teammates lost → 2. Seven entries with no can outside part too (a booted door's later can): The
  block's `mb` (OLD floor) lost 3 more over two of them. A whole mission played by the scripted commander mostly does not meet it (his bangs go on push faces; 12 seeds, won · teammates up of 48, off against on:
  the compound 7 · 11 both, the depot 11 · 38 both run for run, block-squads (OLD floor) 5 · 10 against 5 · 11 with five runs parting). `bun run tools/qa/bangway-check.ts` (`probes.ts bangway`, in family `doortools`; the depot's bay door `ab` from its pull face: 0 cans outside with the rule,
  most without, a pushed door the same either way; the pulled-door lines need one-way doors, so run it under `TPS_PROFILE=shipped` as well — `BANGWAY_BREAK=1` must fail there). A
  beat that starts 'bang' is the burst itself ('bang · inside …' / 'bang · OUTSIDE'). A CAN TOLD AT A HELD DOOR THAT HAS COME SHUT (a replay of Mousehole, 10-13: the squad held a door
  from outside, a teammate shut it, and 'bang, then go in' threw the can at the shut leaf): the pocket stage looks at the leaf under the same switch — never for a `thrFirst` can, whose
  own shove is its opening — and where the door no longer stands open it is opened again first (beat 'can waits: the door has come shut'), the can waits up to `fragWayWait` for it,
  and then goes back on the belt with the bang's own words ('door is in the way — no bang. going in.', beat 'can held') and they step in; a door left standing open is banged beat
  for beat as before. `bun run tools/qa/heldshut-check.ts` (`probes.ts heldshut`, in family `doortools`; both stands; `HELDSHUT_BREAK=1` must fail). Never played by anybody.
- **A bang and clear's can is thrown INTO the room, and leaves the hand** (`DOORTOOLS.bangInto`: ON in the page, `?banginto=0`; off in the module and on
  the frozen stand, `TPS_BANGINTO=1`; panel 'bang ▸ thrown into the room'; journal: a recording from before the key replays with it off). The maintainer's
  play, 10-16, with a tape: "with bang and clear for a door, they often don't really throw the flash bang into the room". On the tape the thrower stood two
  metres down the wall, the can APPEARED in the door frame and went off in the air 1.75 m inside a third of a second later. Counted on 944 staged entries
  (shipped stand, seven levels): 593 of 695 cans burst at exactly 1.6 m in and 0.6 m up, 0.3 s after appearing (`airIn` / `airH`: the air burst fires as
  soon as the can is that far in and coming down); the can showed 1.6 m from the thrower on average, 2 m or more in 304, with a wall or the leaf between
  them in 197. Never outside the doorway — it read as not thrown, not as thrown short. WHERE IT GOES: `bangSpot` — the free floor the doorway opens onto
  (a 0.6 m lattice, `bangIntoDeep` × ±`bangIntoWide`, a line from the doorway's middle above the furniture); the can is offered every row of every other file
  of it, in the room the door opens onto only (`fight.roomAt`; no room known there and the best point lighting under half the floor: no pick). Of the
  points `bangIntoMin` 1.5 m or more inside, in a throw (`thrThrowM`), with a clear line from the door's edge, with none of ours in the flash (NOT the
  men `bang()` spares: this order's, its word's and gate's, and whoever of the team stands on this side by the door, Sam by the same test), that light
  `bangIntoLit` of what the best of them lights, the DEEPEST whose arc gets there; it bursts as it gets there, chest high. No such point (a closet, one
  of ours gone into the room since the order): the landing as it was. Cost, once a toss: under a thousand sight lines, 0.4 ms the median and 2.3 the worst over every door of three levels. WHERE IT LEAVES: the
  thrower's own hand; when he stands more than `bangHandM` from the opening's edge it is passed along the wall to the edge at `bangPassV` and goes in
  from there (one bounce sound at the door); an order cut short during the pass turns the can in at the door all the same (`defuse`), not on down the
  wall on our side. TWO DOORS ON ONE SIGNAL: a can thrown deep is in the air longer
  than one that kept the old landing, so each door on a gate waits the other's burst out too and they still go in together (`rescue-doortools`' two-door
  line went red on the shipped stand without it: 0.2 s apart). WHO throws, the `secondThrows` row, the
  frag's path, the cans of a door held from outside and `landAt` are untouched. Measured, shipped stand, 99 shut doors on three levels, one seed, off →
  on: burst depth 1.6 → 3.1 m on average (42 of 99 at 3.5 m or more; 15 still under 2 m: small rooms, and the 6 that kept the old landing), flight
  0.36 → 0.61 s, the can first shows 1.6 → 1.0 m from the thrower (40 passed from the hand). NOT MENDED: at a door that opens toward the stack the open
  leaf stands between the thrower and the opening's edge, there is no clear pass, and the can still first shows at the frame (33 of 99 with the leaf or
  a wall between, as before). Defenders in the room stunned 44 of 53 → 45 of 52: no change to speak of — the rule moves where the can is seen to go,
  not what it does. Ours dazzled 0. Check: `probes.ts
  bangs` (family doortools; `BANGINTO_BREAK=1` fails three lines), both stands. The 0.3 s longer flight is a cost nobody has weighed in play. Never seen
  on a GPU: whether the pass round the jamb reads as a throw, and whether a can four metres in looks right in a small room, are the maintainer's to say.
- **The word at a door held from outside spends no can** (`DOORTOOLS.wordNoCan`, acting with `outsidePlain`: ON in the page, `?wordnocan=0`; off in the
  module and on the frozen stand, `TPS_WORDNOCAN=1`; panel 'clear from outside ▸ the word spends no can'; journal: off when the key is absent). The
  maintainer, 10-16: "when externally clearing a room, the men shouldn't throw a bang unless i tell them to. i can do that by doing x 5 2 again". On his
  tape row 4 was given, then the word 7.6 s later, and a can nobody ordered went into an empty room 0.7 s after it. With the rule the word (the key, or
  from code) to men holding the jambs steps them in — the same path as a word given `wordStep` — and the pair's go label reads 'go · step in · no bang'.
  The can is his to order: row 2 given again to the men at the door ('bang, then go in': ONE can, then in), as before. A `thr` op that is not row 4's
  hold, and the old two-stage outside order with `outsidePlain` off, bang on the word as they did. Check: `probes.ts threshold-hold`, the line THE WORD
  SPENDS NO CAN (`WORDNOCAN_BREAK=1` fails it; the same doors with the rule off must throw), both stands; the stand, journal and boot lines are in
  `probes.ts bangs`. EVERY OTHER staging in `tools/qa/threshold-probes.ts` holds the rule off on both stands: those lines ask what the word's can does
  (the kit, the pockets, Sam behind the door). Nobody has played it.
- **A bang or frag order on a door that stands open walks nobody across it** (`DOORTOOLS.openHand`, on; Team feel 'bang ▸ nobody crosses an open door', kept per machine; off = the deal as
  it was; pinned off in threshold-probes.ts's identity and the nvg digests; a recording from before the key replays with it off; the maintainer's replay, 10-12: "after being ordered to frag
  after externally clearing, blue one crosses across a dangerous threshold"). A pair holding an open door from outside has a man on each jamb; 'frag and clear' / 'bang and clear' is a fresh
  `bangClear` order, and with two men `start()` files the second BEHIND THE LEAD on the lead's wall — so he walked through the open doorway's own view to get there (the office's
  `breakroom_w`: 3.4 m across it). Now, only where `kind === 'bangClear'` and the leaf stands open (stackroom.ts `stackViewOpen`): the lead is a jamb man who need not change hands where
  there is one (an open door has no handle to work), and `keepHands` gives any other man whose dealt place is on the other hand of the opening from where he stands his OWN hand's wall —
  a place (then two, three) back from that jamb's mark, else the jamb's mark itself, floor of this room and clear of the other men's places; none = the place as dealt, never a refusal
  (beat 'hand kept · <callsign>', `stats.handKept`). The hand measure is the plain stack's (`STACKROOM.viewOut / viewMen`); a man in front of the opening, on the other face or far off
  is on no hand and is dealt as ever. The can is thrown by the second man from his own end and they go in from both jambs. Shut doors, 'open and clear' and the threshold are untouched;
  three or more men mostly never had the fault (the other jamb's file already kept its wall). `bun run tools/qa/openhand-check.ts [scenario …] [--verbose]` (`probes.ts openhand`, in
  family `doortools`; both stands; his door by keys — X, 5, 4, then X, 5, G — for the pair and the four, then the first door of every squad room clear, then a shut door dealt the same
  either way; `OPENHAND_BREAK=1` must fail). Frozen stand, men in front of the open door before the burst over 16 missions: 2 without the rule (the two pair missions), 0 with; the frag
  bursts inside and they go in, nobody lost, in every one. AFTER ITS REVIEW: a man carrying the shield is never re-dealt (his place is the lead's own business); a place Sam or a
  teammate outside the order stands on is not taken; a man is 'on a hand' only with nothing solid between him and that jamb's mark, 5 cm clear of the opening's own line. THE LEAD AND A LONE MAN TOO (`leadHand`, off a replay, 10-13: the last man of a pair
  sent alone at a blown storage door was dealt the latch jamb — the one place of the face — from the hinge side, and shot crossing in front of it): a lead whose dealt mark is across
  the open doorway from where he stands takes a lead mark of the deal on his own hand nobody else has, else the dealt mark mirrored about the doorway's middle (floor of this room,
  a clear line to it, nobody on it; none = as dealt). AND A CHARGE ORDER WHOSE DOOR COMES OPEN UNDER IT (`stayHands`, the same switch; a replay of Mousehole, 10-13: the order
  ended on "door's open." and three men kept walking to stand-off marks past the far jamb, one shot in the doorway): where a charge order ends because its door stands open
  (the 'place' stage, or the stand-off with the charge gone), each man still walking whose mark is across the opening from him is handed a plain 'stack' where he stands
  (beat 'hand kept · <callsign>'); a door that stays shut is charged beat for beat as before. `bun run tools/qa/chargeopen-check.ts [--scn id] [--door name] [--hand hinge|latch]`
  (`probes.ts chargeopen`, in family `doortools`; both stands — which hand the stand-off marks are dealt on differs between them, so the check stages the men on the hand the
  order walks them across from; `CHARGEOPEN_BREAK=1` must fail). KNOWN: `firstIn`
  may still pick a kept man who stands a place back as first through; `newLead` (the lead lost) may walk a man across; a re-dealt place is not asked `behindGlass`; on a pull face the hinge man holding in front of the opening reads as on no hand and is dealt as ever. MEASURED (shipped stand,
  scripted commander, rule on against off, no error or stall): the 20 squad missions × seeds 1–4, 77 of 80 run digests equal, won 55 against 57, teammates up 141 against 144 of 280 —
  hands kept 2 (the three that part: the lead changed on room-clear-four:4, 'hand kept · Red Two' on block-squads:1's `m_s` (OLD floor), defuse-four:2 taken 4 of 4 either way); the four
  missions it acts in (room-clear-pair, room-clear-four, block-squads (OLD floor), defuse-four) × seeds 5–16, 32 of 48 digests equal, won 39 against 38, teammates up 94 against 90 of 168, hands
  kept 10 (the pair's four parted runs keep no hand: there it is the lead that changes). Not a difference at either size: the scripted commander never clears from outside first, so he
  meets the rule only at doors his own walk left standing open. Never played by anybody.

<!-- was CLAUDE.md lines 1294–1307 -->
- **Two doors on one signal open on one frame** (`DOORTOOLS.gateHand`, src/game/doortools.ts `toHandle` / `bootBeside` / `handStep`; 10-13). Several doors on one
  gate (the rescue's F through both doors of the hostage room, the pairs' word), one of them booted and another only wanting a hand: the hand door's lead waited on
  his jamb for the boot beside him to land and only THEN walked to its handle (handleside.ts `toolSpot`, live where doors open one way), so that leaf, its can and its
  men came a walk behind the booted door's — 1.8 s on the office's hostage room (leaves 23.8 / 25.6 s, entries 2 s apart). On, he steps to the handle as the signal
  is given, the boot is not swung before his hand is on it (`kickCap` at most on the kick spot), and he shoves on the boot's frame. A second hand door waiting on the
  same boot is no boot to the others. THE CANS ARE STILL 0.2 s APART and so are the men: a can is not thrown at a leaf (`bangWay`) and a shoved leaf is slower out
  of its way than a booted one — kept. ON in the page and in the module; nothing to it where no lead has a handle to step to (the frozen stand as it stands: there
  the same shove on the boot's frame as ever); with `ONEWAY=1` raised on the frozen stand it acts. Off = the step after the boot; Tab ▸ 'two doors ▸ hand on the
  handle first' (kept per machine); a recording from before the key replays with it off (journal.ts applyKnobs). No URL flag, no FROZEN_HOLDS row. QA:
  `bun run tools/qa/probes.ts rescue-flow-twodoor` — the line 'both set → both leaves on one frame' asks the leaves inside 0.02 s and, where doors open one way, the
  cans and the men inside a quarter of a second (a tenth on double-acting leaves, as it was): green on the shipped stand (leaves 23.9 / 23.9, bangs 24.3 / 24.5,
  the room taken 6 of 6 with 12 of 12 hostages), green on the frozen stand plain and with the door rules raised (25.0 / 25.0); `GATEHAND_BREAK=1` is red on the
  shipped stand and on the frozen stand with the door rules raised, green on the frozen stand plain (the rule is inert there). The probe's other shipped red, 'one
  man on a cover of Sam's: F is a man short', is not this rule's (the lone man is shot at the kick spot; left red by the enemies-in-the-dark work as its call).
  Families `doortools`, `pairs`, `rescue`, `threshold`, `shutdoor`, `sidedoor` on shipped and `doortools`, `pairs` with the door rules raised: the same failed
  lines as the build before it, less this one. KNOWN: with the walk to the handle longer than the boot's walk-up the boot is later than it was (1.1 s on the frozen
  stand with the door rules raised) — both leaves then, not one early; a lock shot or picked on the same signal is not held for a hand. NOT MEASURED: no
  play-through tally. Never played, never seen on a GPU. WITH `HANDLE.toolNear` (the bullet below; joined 10-13): `toHandle` asks `toolSpot` as a door order's
  lead, so on a shared signal he takes the near stand past the latch jamb (or works it from his mark, and then the boot is not held at all); where toolNear falls
  back to the old spot he stands in the opening for the boot's walk-up (`kickCap` at most) — known, not mended. The consulate's split entry on the shipped stand
  (`PT_RESCUE=split ships.ts --scn rescue-consulate --seeds 1-6`): the two doors' first men cross 38.17 / 38.17 s on five seeds and 26.77 / 26.77 on the sixth
  (rule off, before the join: 38.13 / 39.23 and 26.77 / 27.85); rescued 6 of 6, hostages the same either way (2 of 3 on five seeds).
- **No boot from beside a latch jamb in front of glass** (`DOORWAY.kickGlass`, src/game/doortools.ts `bootSpot`; the maintainer, 10-13, of a lead lit
  and shot through a sidelight as he booted: "yeah maybe this should force kicking from the front?"). The lead's side spot (`DOORWAY.sideKick`) is asked
  the stack's own question, `orders.glassEyes` (the floor lattice's points beyond the door with a line of fire onto him through a pane, counted afresh for
  the very spot): at `GLASSPEN.stackEyes` (3) or more he boots square in front of the leaf, as every kick was before sideKick — where there is floor
  there and clearly fewer of those lines reach it (at most `GLASSPEN.stackLeastK`, 0.75, of them: glazing along the whole wall looks onto both spots, and
  beside the jamb he is at least out of the opening). The squad's lead only; the player's kick is thrown from where he stands. ON in the page
  (`?kickglass=0` off; Tab > doors 'no side kick in front of glass'), OFF in the module and on the frozen stand (`TPS_KICKGLASS=1`, a `FROZEN_HOLDS` row;
  it acts only with `TPS_SIDEKICK=1 GLASSFX=on` up as well); a recording from before the key replays with it off. Check:
  `bun run tools/qa/kickglass-check.ts [level…] [--list]` (probes.ts `kickglass`, family doortools) shuts every door of every level file and asks both
  faces (1,044; 990 with floor for a side boot), raising the rule, the side kick and rounds through glass itself on either stand, with its own count of
  the lines; `KICKGLASS_BREAK=1` leaves it off and is red (and red on a set of levels the rule moves nothing in). With it on 31 faces boot from the front
  on both stands (gwot twins counted: the office's manager and break room exit, the records office's staff_east both faces, front from outside, strong
  room and office, the warehouse's office both faces and lb, the block's s_j, the barracks' k_hall and n12, the mousehole's store, the bazaar's
  pharmacy store); 20 stay beside a jamb in front of a pane, the front no better (the office's conference door both faces, the barracks' h_yard, o_hall
  and n4b, the consulate's visa door, the registry's reading room, the glasshouse lab, the hall's bunks, the records front from inside, the bazaar's
  phone shop). Measured, shipped stand: `bang-tally --arms open --seeds 1-3` on records / warehouse / room-clear-four / block / mousehole / barracks, on
  against `TPS_KICKGLASS=0`: 186 entries, every row the same (145 of 696 teammates lost, 231 of 339 of the rooms' men down, 113 rooms taken, both ways) —
  no boot of the tally lands on a face the rule moves. The one played difference seen: doortools' staged locked door (the pair, 'bang and clear'): the
  kick at 12.62 s against 13.18 s, and the lead sees a man inside (and is in the opening) at 13.08 s, before 'go', where from beside the jamb the first
  sighting was at 15.22 s after the cross; both runs end 'in'. tour 3/3. Never played by a person, never seen on a GPU.
- **No point of an entry in another door's frame** (`DOORTOOLS.podFrames`, `podFrameM` 0.55, src/game/doortools.ts `inFrame`; 10-13, off the barracks'
  fault B2: the gallery entry by n_end dealt a man onto n4b's threshold). A doorway's floor is floor to the walk grid, so `pods2` / `podsAsWere` / `shallowPods`
  gave the hand of a door with no room the threshold of the next door along the wall. On: a candidate between another door's jambs within 0.55 m of its line,
  or beyond one from this door's mouth, is refused; that hand is then dealt down the middle (a threshold gets one more depth, 2.5 m) and entrypoints.ts moves
  it as it does any point. Authored door plans and pods2's own down-the-middle fallback are not asked. ON in the page (`?podframes=0` off; Tab 'entry: no
  point in another door'), OFF in the module and on the frozen stand (`TPS_PODFRAMES=1`, a `FROZEN_HOLDS` row); a recording from before the key replays with
  it off. Check: `bun run tools/qa/podframes-check.ts [level…] [--list]` asks every door of every level file, both faces (4,176 deals: an entry's 2 and 4, a
  threshold's 2 and 4), raising the rule itself on either stand; `PODFRAMES_BREAK=1` leaves it off and is red (229 dealt points in a frame, 1 beyond one; 27
  door faces' two-point entries over 13 level files, gwot twins aside). With it on 294 of the deals differ on the frozen stand's floor, 303 on shipped's.
  Measured, shipped stand, `bang-tally --arms open --seeds 1-3` on barracks / compound / kill house / warehouse, rule on against off: 97 counted entries
  over 33 doors, teammates lost 75 of 388 both ways, the room's men down 171 against 170 of 180, rooms taken 89 against 88; one door's row differs (barracks
  ng_e). The barracks' own `barracks-check --fault B2` marks pass with it on the barracks thread's level (b59cc104). Headless only: nobody has played an
  entry with it or seen one on a GPU.
- **A door order's lead never stands in the opening to work the handle** (`HANDLE.toolNear`, handleside.ts `nearStand`, asked by doortools.ts `open()` and the
  word's peek through `toolSpot(…, order = true)`; ON in the page, `?notoolnear` = as it was; OFF in the module and on the frozen stand, `TPS_TOOLNEAR=1`
  raises it there — a `FROZEN_HOLDS` row; debugger: 'Player, doors & props' ▸ 'a door order's lead keeps out of the opening'; a recording from before the key replays with it
  off; off in threshold-identity's pin list beside `HANDLE.on`). The fault, off the maintainer's tapes (the floodlit yard 044521 at 0:53.8 and 4:42.0,
  lesson 5 051816 twice, the barracks 053220 at 1:35.1 — five deaths in three visits; "we don't want them to feel dumb"): on the face a leaf opens AWAY
  from, the lead walked 0.9–1.3 m from his stack mark to the handle's place (`standIn` 0.3 inside the latch jamb, 0.6 out: the middle of the opening — all
  7 such places on floodlit.json), shoved, and was shot there or on his first step back. Now he steps from his mark toward the handle only as far as the
  arm needs — the point of that line `reach` − 0.07 = 0.88 m from the handle — and never nearer the opening than `nearBody` 0.38 m past the latch jamb (his middle: his body's radius `body` 0.34 and 4 cm) (a
  point short of that is moved out along the wall to it, and in toward the wall until the handle is in reach; then the same at his own distance off the
  wall); no floor there, he shoves from his mark when it is past the jamb and within `nearPost` 1.3 m; only then the old place. Within reach already: he
  does not move, as before. The shove, the wait for a word and the way back onto his jamb are doortools.ts's own, unchanged. Ordinary door use (the PUSH /
  PULL places of `handleSpot`), the drill's own man (tactics.ts) and the response's (qrf.ts) do not change; `HANDLE.toolPost` and its toggle are as they
  were. Counters: `HANDLE_STATS.toolNears` / `toolPosts` beside `toolWalks`. NOT COVERED: a lead filed on the HINGE jamb (no floor past the latch jamb:
  floodlit radio_room and shed, barracks h_yard, o_s1, k_hall — 2 of 7 and 3 of 15 push faces) still walks to the old place, the handle being a leaf's
  width from him; a PULL face is another shape (its place is beside the latch jamb already, 0.05–0.15 m of body past it, clear of the sweep; a corner
  door's long reach stands in front); a charge is set at the leaf by hand; 'clear from outside' as the slicing order walks its stations across the front.
  Check: `probes.ts handleside-tools` (toolnear-check.ts, family handleside; `TOOLNEAR_BREAK=1` = the rule left off, 6 lines FAIL on each stand) — the
  floodlit yard's front door and the barracks' galley back door (k_out), each under open and clear / bang and clear / clear from outside, defenders taken
  off the floor, seed 1, BOTH stands: the lead steps 0.34–0.35 m where the walk was 1.15 m, his body's edge (middle less `body` 0.34) stays 0.11–0.22 m clear of the opening's corridor
  from the order until the men go in, the leaf opens, `toolWalks` 0, four men over the frame line, the order ends 'in'. Side effect seen: a threshold
  order's 'set' beat counts more of the room unseen (105 of 116 cells where 36), the lead no longer having looked in from the opening. The page on the
  software adapter (`shipped-page.cjs plain`) stands on the shipped stand's switches, and `?notoolnear` reads `HANDLE.toolNear` false there. No play-through,
  tour or soak was run on it and no tally re-measured; nobody has played it. Never seen on a GPU: the arm working a handle from up to 0.88 m (the pose
  is whatever 'on the handle' drew before, now further from the leaf), and whether the shorter step reads as a man opening a door.
- **Entry paths through the door (10-08;** `src/game/doorpath.ts`, `DOORPATH`; record rebuild/cast-close-and-hurt/entry/paths/notes.md): in a door
  order's 'enter' stage each man walks a LAID path instead of the nav grid's — a lane square through the half of the opening the leaf is not in (`at / outM / inM`), round the
  free tip of any leaf standing in his way (`leafClear / tipM`; a point in the pocket behind a leaf is moved to floor he can reach, `moveM` — SET `moveM` 0 ONCE THE DOORS
  GOAL'S RULE FOR WHERE A BODY STANDS BY A LEAF IS IN THE SAME TREE, theirs wins), in one file in the order the door order dealt (`gapM` 0 / `shortM` 0.6: the second gun 0.3 s
  behind the first, nobody inside a body's width of the man ahead; never held past `cap`). Takes any count of entrants; changes no point of domination but a moved one,
  no order, and (as shipped) no gun. `DOORPATH.on`: ON in the page (`?nodoorpath` = the old entry, 48 run digests equal 4b510dd), OFF in the harness unless
  `TPS_DOORPATH=1[,knob=value…]`; the native host never sets it. `DOORPATH.gun` (OFF, `?doorpath=gun`, `TPS_DOORPATH=1,gun=1`): a walking teammate's rifle is carried along his walk /
  lowered to the low ready where its line crosses an open leaf — measured, it costs teammates (the office −23 of 576 against the walk alone) and buys rifles and lights out of
  the server door's leaf; `bodyM` (0, untallied) = a point within that of a fallen man is moved off him. Seams in doortools.ts (the enter stage's queue asks `g.doorPath.mayGo`)
  and game.ts (`doorPath.tick` before the men walk, `.after`); roomfight.ts untouched. MEASURED (page arm `TPS_CAST=1 TPS_MOVES=1 TPS_TURN=1`, 144 seeds, paired by seed against the old entry): room clear four
  402 → 451 of 576 teammates up (+49, 95 % +13 to +85), the depot 408 → 441 (+33, −6 to +73); a man in a door leaf 443 → 2 and 681 → 0 spells. QA `probes.ts doorpath`
  (paths / gun / file / off; `DOORPATH_OLD=1` = the old entry, must fail paths and gun; `DOORPATH_FILE_BREAK=1` = file with every entry let go back to front (`tools/qa/doorpath-backward.ts` preloaded),
  must fail (file reads the entry's own queue, not who stood nearer the frame: from an uneven split stack the deal sends the far jamb's man second — listed, not failed; on the SHIPPED stand file is red on one crossing,
  the barracks' first door: the go comes with Blue One still 4.5 m off, he is dealt third and crosses ahead of Red Two who stood a metre nearer — the deal's, there since at least 10-13); `doorpath-off` = each run against ITSELF with the walk taken out of the
  process (`tools/qa/doorpath-inert.ts` preloaded: the walk's entries emptied, its calls throwing), three runs on the frozen stand and three on shipped, the walk pinned off on
  both — no frozen digests since 10-13, ordinary merges kept moving them; `DOORPATH_ALL=1` = six runs a stand; its red paths, each must fail: `DOORPATH_OFF_BREAK=1` the walk on in both
  runs · `=2` the walk switched on behind the pin in the preloaded run alone · `=3` the walk on in both and only its knobs set to nonsense in the second — each with a 'red
  path' line that must PASS, saying it went red for that reason and not for a preload that fell over), the watcher
  `tools/qa/paths-watch.ts` behind playthrough.ts `PT_PATHS=1 | rec` (`RunOut.paths`: spells leaf / friend / near / jamb / body / rifle / light, `cross` = who crossed each
  frame line when; `PT_NOCLOSER=1` = no door shuts itself), `bun run tools/qa/entry-strip.ts` = a top-down before / after strip of one entry.
- **The charge row's stand-off test asks the dealing the order makes, two men too (10-14; a claim from the picture-of-the-fight work, checked in the code).**
  `doortools.ts standoffFits` (the charge row's valid, and a hand-set charge's) asked `orders.reach` of the least-total-walk pairing (`orders.pair`) for one or
  two men and of `standoffDeal` only for three or more; `startCharge` always deals by `standoffDeal` (the man nearest the frame takes the first mark). For two
  men the two could differ, so the row could stand on a pairing the order never makes (a man sent to a mark he cannot reach) or be refused over one it never
  makes. The test now iterates `standoffDeal` for every count. No switch: it makes the test agree with its own order, on both stands. CHECK `probes.ts
  standofffit` (family `doortools`; `STANDOFFFIT_BREAK=1` must fail), 5 lines, both stands: the office's break room door, two men staged so the deal and the
  least walk differ, `reach` wrapped to refuse one man one mark each way, three and four men as by hand, and the order given. The old line fails lines 2 and 3.
  Families `doortools`, `owncharge`, `standfire`, `wallsafe` green on both stands after it; no tour, soak or digest run was made. Headless only, never played.
- **The threshold family on the SHIPPED stand** (10-14, tests only; read on join 386, 50e4669c). Frozen: ALL PASS, as before. Shipped, each red said for
  what it is: `threshold-identity` is the frozen stand's question — its digests were frozen there — and under `TPS_PROFILE=shipped` it says NOT ASKED and
  checks nothing. `threshold-first`'s two can lines (thrFirstOnly off gives the dark pocket its second can; the word's can) were red there because
  `DOORTOOLS.outsidePlain` is one can a door, on the word too (`thrCans`), not for want of a door: they are now asked with that rule held off after each
  stand-up (`NO_PLAIN` in threshold-probes.ts — a stand that names `TPS_OUTSIDEPLAIN` writes the rule again every stand-up), and a stand that has the rule
  gets a line more, ONE CAN A DOOR at the same dark-pocket door (hall-four seed 1, `front`). Green on frozen, shipped and frozen + `TPS_OUTSIDEPLAIN=1`.
  TWO STAYED RED on shipped at that step (ONE now: the next bullet's rule turned `threshold-four` green and took its row off), with rows in `EXPECTED_RED_SHIPPED` (tools/qa/expected-red.ts — the list's shipped-only table, new with this step):
  `threshold-four`, one run of six (depot-four seed 2 at a_s): a defender's frag lands by the stack mid-hold, all four run from it, the stage's clocks run on
  with its men 6 to 7 m from the frame, thrThrower's last case makes the lead the thrower with no reach asked and `handAt` puts the hand in the doorway — the
  can leaves the door with the thrower 6.6 m away, and he is then first man in. A REAL FAULT, not staging (no staged order reads `fragFlee`): the thrower's
  reach is a mend owed as a step of its own; what an order does when a frag lands on its men is the maintainer's call, not built. `threshold-last`, the two
  played lines: on shipped the captor's clock is dealt 35 s on registry seeds 32 / 44 (29.7 / 30.1 s on frozen, where they were picked as the shortest), so
  the order at 16.8 s finds no last warning to act on; and on seed 32 (as of 10-13) both teammates are lost at the hostage door — a POSSIBLE rear-security
  fault, cause not traced. It stays red until an owner traces it or the call on who watches a pair's back at a held door. Headless only; nothing here was played or seen on a GPU.
  TRACED 10-15, and the row is off (`threshold-last` green on both stands): both halves were the probe's staging on that stand. The played arms were
  run with destruction held OFF (`PT_DESTR=0`, kept from before the destruction goal), a stand the page never opens on; with it off, registry seed 32
  loses both teammates before anybody crosses, rule or no rule — Roamer 1, 6 m down the corridor, wins a face-to-face with Blue One at 19.0 s on the walk
  to the stack, and Blue Two carries the order on alone with that man alive at his back for 9 s and is shot from 100 degrees off his muzzle at 28.2 s
  as he steps in. With the page's own destruction on, the same seed has Blue Two drop the roamer at 17.9 s and plays clean (2 of 2, rescued at 42 s).
  And that stand deals the captor's clock to the second (samestart.ts, 35 s: his last step at 28.4 s, after the entry), so no seed could show a last
  warning. On shipped the played arms now keep the stand's own destruction and set the clock to 24 s (`RESCUE.resolveSecs`; last step at 19.6 s, on the
  walk to the stack): the warning is acted on ('both'), held 0 s, across at 22.9 / 23.3 s before the round could come at 25.6 s, against 26.3 / 26.7 s
  with the rule off. Frozen is untouched. STILL OPEN, not a door rule and not mended: a pair's last man carrying a door order on with his mate's killer
  alive behind him (seen only with destruction off; passed to the squad rules' owner as a claim).
- **No can from a hand that is not at the door** (`DOORTOOLS.thrHand`, `thrHandWait` 6 s, `thrHandEvery` 0.25 s; src/game/doortools.ts the 'pocket' step's
  gate, `thrPick` / `thrAt`; 10-14, off the red above). THE FAULT: a threshold's can leaves the hand in the doorway (`handAt`) whoever throws it, and the
  stage's pick asks no reach of the far-jamb man or the lead — with the stack run off the door by a defender's frag the lead was made the thrower from
  6.6 m down the wall and was then first man in (the depot's a_s, seed 2, as the page ships). THE RULE: the picked man throws while he is not the lead
  and is AT THE DOOR (within `throwReach`, 4 m, of the frame, on the squad's face; no line test); otherwise one test (`thrPick`'s hand form: the pick's
  own order of men, each at the door with a pocket from his end, the lead only with no other man still off the door AND off his mark) says who may. A
  different man: 'can to X · at the door', his after his own `thrTurn`. Nobody: the can WAITS in the pocket step ('can waits: no hand at the door …',
  the lead says "hold the bang — back on the door.", asked again every `thrHandEvery`). The wait is the ORDER's (asks and hand-over turns summed over
  its cans): spent, 'can waited 6 s · thrown as it was' and the stage is as it was for the rest of the order — THE OLD FAULT INCLUDED, so on a floor hot
  enough that nobody walks back in 6 s the lead still throws from down the wall and goes first. It neither hangs an order nor takes its can. NOT ASKED:
  under a captor's last warning (`lastStack` / `lastHold` / `rescue.lastWarning`), and of a door that SHARES a word with another (their men would stand
  on their jambs past their own flash; one door let go by the word is asked). THE COST: a lead who is the picked thrower waits out the order's wait for
  a man off the door and off his mark who never comes. Nothing else of the order moves: the hold clock, the step in, the search are as they were, and
  with every man at the door or on his mark no beat changes. The word's key during the wait is what it is during the pockets. NOT decided here: what an
  order does when a frag lands on its men (carry on, pause, end) — no staged order reads `fragFlee`, the men still step in while walking back, and who
  crosses first is then whoever is nearest (in the repro the lead still is): the maintainer's call. NOT touched: a bang and clear's thrower. SWITCH: ON
  in the page (`?thrhand=0` off; Tab 'threshold: can only from the door'), OFF in the module and on the frozen stand (`TPS_THRHAND=1`, a `FROZEN_HOLDS`
  row); a recording from before the key replays with it off (journal.ts); pinned off by name in threshold-identity and the nvg / irlaser digests. CHECK
  `probes.ts threshold-hand` (family `threshold`; `THRHAND_BREAK=1` must fail, and does on both stands), 5 lines, both stands, the rule raised by the
  probe, ONE seed of two doors — the depot's c_w (four) and the records office's front (the pair), held, every man put 5.5 m off from a second before
  'bang, then step in' until a second after (a teleport, not a frag). Off: the can leaves with its thrower 5.5 m away (frozen the far-jamb man, shipped
  the lead). On: it waits 1.9 / 3.3 s (frozen) and 2.6 / 3.8 s (shipped) and is thrown from 3.0 to 3.9 m by a man who is not the lead. Kept off for
  9 s: 'can waited' at 6.1 s, thrown by the same man as with the rule off. Nobody run off: beat for beat the same with and without. And the journal
  line. The natural run: `threshold-four` on shipped is green again (depot-four seed 2, a_s: the can waits at 16.1 s, goes to Red Two at 18.2, thrown
  at 18.8; that one seed; its row is off `EXPECTED_RED_SHIPPED`). 10-17: that seed is lost on shipped again since an ordered walk keeps off
  lit floor (the stack is called 0.8 s later, and all four are shot on their marks from across the yard by men of other rooms; no grenade; traced by
  that rule's owner, whose 16 seeds of the run lose the whole four 3 times with the walk rule on and 4 with it off). `judge` passes such a run over in
  its four lines about the room and says so in a line of its own, 'A RUN SHOT OFF THE DOOR FROM OUTSIDE THE ROOM': every man of the order lost before
  any step in, each to a defender not at home in the room behind the door; never more than one run in three, never every run of a floor. NOT covered by any line: the lead-only branch with a man off his mark, a wait summed
  over two cans, a can first, a shared word, more seeds. Headless only: never played, never heard (the spoken line), never seen on a GPU.
- **Two door checks take the yard's guns off the floor (10-17).** `threshold-four` and `threshold-first` read the depot's `a_s`, the door on the
  floodlit yard that two other rooms watch. Who of four men stacked on it lives to the step in is the yard fight's dice: over 16 seeds 24 of 64
  are lost with the rear man's turn on and 25 with it off (that rule's owner's count), and which of the three seeds read holds a wipe moved with every change that shifted a walk by half a second (three
  flips of `threshold-four` on shipped in a day: the seen walk, an open leaf gone round, the rear man's turn — none a door rule's). As the order
  is given every defender not at home in the room behind the door is taken off the floor (threshold-probes `YARDOUT`, those two checks only): the
  lines ask what the threshold does with the ROOM. Green on both stands with the rear man's turn on and off (four: 11 lines; first: 10 shipped,
  9 frozen). The pass-over line above stays for a door that still has such guns. NOT judged by any door check now: a stack under fire from
  across a yard.
- **A man left on another door stands where its open leaf does not hide it (10-17).** `DOORTOOLS.thrDoorsLeaf`: ON in the page (`?thrdoorsleaf=0`
  off; Tab → Player, doors & props 'other doors: never behind the leaf'), OFF in the module and on the frozen stand (`TPS_THRDOORSLEAF=1`, with `ONEWAY=1`: it
  asks nothing of a double-acting leaf). The posts of `thrDoors` were tried with the leaf as it stood, shut; on the hinge side a door that opens
  into the room swings round between the man and the opening. At the depot's store the man left on `c_n` stood 3.5 to 4.0 m down the door's
  own wall, hidden from it by its leaf, on all three seeds on both stands. The rule: `leafAcross` gives the share of the leaf's sweep, from where
  a pushed leaf comes to rest (1.45 rad) to its stop, that lies across his line to the door. A threshold's last act no longer lets a man keep or
  take such a door from where he stands (`otherDoors(…, seen)`); `holdDoors` posts one, a hidden post costing `LEAF_COST` m of walk and more the
  more of the sweep hides it, with two posts tried last beside a door that opens in (`LEAF_POSTS`, 0.2 and 0.5 m past a jamb, 2.4 m deep: the
  store's door is in a corner and every post out along its wall is behind the leaf). On an ordinary entry (`otherDoorM`, nobody walks) the man it
  hides the door from least is taken first, and a door is never left unheld for the rule. Check: `threshold-leaf` (rule off beside rule on, three
  seeds, the yard's guns out, plus the journal line), `THRDOORSLEAF_BREAK=1` red, both on both stands; with the rule on the man stands 2.3 to
  2.5 m off, a line to it, clear of the leaf from 1.45 rad to its stop. The check's `line` now reads the point the rule holds the door on (the
  old point lay in the jamb for a man down the door's own wall). Measured at that one door only. NOT measured: other levels' corner doors, what
  the move costs a man stood nearer the door's own line under fire through it. Never played, never seen on a GPU.
- **Two door checks run on ROOM-FIGHT floors (10-17).** `doortools-firstman` and `threshold-hold` hold squads from the rooms (SQUADDEAL) off inside
  their own runs, by the stand's own word (`TPS_SQUADDEAL=0` round the stand-up: `rig`'s `deal: false`, threshold-probes' `NODEAL`). On a dealt floor
  the room's men are their squad's and dig in on its word (that rule's owner's reading, its runs): four seconds after a bang they are still
  thinking, so the plain door loses no first man (0 of 6, against 4 of 6 on a room-fight floor) and a bang has nothing to beat; twenty-five seconds
  after, every door is wedged and nobody gets in either way; and a hold told after ten seconds steps into a room that has set (the records pair's
  last man lost on the line; the depot four's order at `c_w` ends 'nobody left on it' 3.3 s after 'step in', no can). Both were red on shipped for that from the build of
  10-17 and are green again with the rule held off (firstman: plain 4 of 6 first men lost, bang 0, charge 1; threshold-hold 15 of 15; frozen the
  same lines as before). NOT judged by any door check: what the door tools do on a dealt floor. What that drill means for play is the
  defenders' own call, with the maintainer. Headless, the seeds the checks had; never played.
- **A grenade by a held door: two answers, ON IN THE PAGE since 10-16 (built 10-15, the maintainer said yes to both).** His calls were: what an
  order does when a grenade lands on its men (pause until they are back at the door, then go), and what the can does when its wait runs out with
  nobody at the door (no can, the lead says so, they go in and keep it). Both are on in the page (`?thrfraghold=0` / `?thrnocan=0` put one off;
  `?fraghold=0`, the bullet below, puts thrFragHold off with it), false in the module and on the frozen stand, a `FROZEN_HOLDS` row each: every
  frozen digest is as it was. `DOORTOOLS.thrFragHold` (Tab 'threshold: wait for
  the men who ran', `TPS_THRFRAGHOLD=1` raises it on the frozen stand, `=0` puts it off on shipped): the men of a threshold who ran from a grenade (frag.ts
  `fragRunning`) are kept in `T.fled` until each is back at the door or on his mark (`thrBack`; a man down or re-ordered drops out). While any is
  out, the hold does not count the door quiet (its own `thrCap` still ends it) and the pockets give neither a can nor the step in ('the door waits',
  said by a man who did not run), whoever sent them there (the hold's clock, its cap, the word, 'bang, then step in'). The wait at the pockets is the
  ORDER's one wait, `thrHandWait` (6 s), shared with thrHand's own wait: spent, the stage goes on as it was ('on without … · the order's wait is
  spent'; 'not waited for' under a last warning). Back in time, the thrower is picked afresh and has his turn; the last of them down or re-ordered,
  'nobody left to wait for'. `threshold-hand` holds both off for its own runs. NOT held: Sam's plain 'step in', a captor's last warning, a door that shares
  a word with another, the step in behind a can of the order's own that has just gone off (`entryCap`), and a grenade that lands while a can is in the
  air or its burst is running ('fuse' / 'wait' do not look). A man whose mark the stuck rule has moved to where he stands counts as back.
  THE WORD THAT SPENDS NO CAN (`wordNoCan`, 10-17) went straight to the step in and past this wait: mended under this same switch. The word to a held
  door whose men ran is OWED (`wordStepIn`: the hold goes on, off the word if it was on one, 'the door waits'), and paid in the hold's tick (`wordOwed`)
  when they are back or the order's one wait is spent; the word AGAIN, outside `wordTap` of the first, pays it at once ('on without … · not waited
  for'). Sam's own 'step in' row is still his say there and then. Measured, one seed, two doors, both stands: off, 'step in' on the word's frame; on, 1.4
  to 2.7 s after it with every man back; the wait cut to 0.3 s, 0.3 s; the word again 1.5 s later, on that frame (one door a stand; the other's men
  were back first). The entry that follows has no can, and how it ends is the room fight's (printed, not judged): on the shipped stand the depot's four end 3 of 4
  up with the wait against 1 of 4 without; the records pair, down to one man in the hold, loses him inside with the wait and keeps him without. One
  seed: no tally says which way it leans.
  `DOORTOOLS.thrNoCan` (Tab 'threshold: no can with nobody at the door', `TPS_THRNOCAN=1` frozen, `=0` shipped; acts only under thrHand): the wait spent
  and still no hand at the door, the can stays in the kit ('no bang · nobody at the door', the lead says so) and the stage goes on as with no pocket
  worth a can; a later can of that order goes only from the picked man's own hand at the door. A recording from before the keys replays with both
  off (journal.ts). CHECK `probes.ts threshold-grenade` (family `threshold`; `THRFRAGHOLD_BREAK=1` and `THRNOCAN_BREAK=1` must each fail), 15 lines (five are the word's),
  both stands, the rules raised by the probe, ONE seed of two doors (the depot's c_w, four men; the records office's front, the pair), a REAL
  defender's grenade put down at the stack (the men kept from its burst). Measured: both off, Sam says bang a second after it lands, and 'step in' is
  said with men 4.0 to 5.3 m off the door (frozen both doors, shipped the pair; the shipped depot's men step off no further than a throw). With
  thrFragHold: 'the door waits' 0.9 to 2.0 s, then the can from 2.6 to 3.9 m and 'step in' with every man back, the same with thrHand on too. The
  wait cut to 0.3 s: 'on without' at 0.3 s, the can goes. A hold that steps in by itself: off, the depot's ends 1.1 s after its men are back (frozen)
  or 2.5 s BEFORE (shipped); on, never sooner than `thrQuiet` after. thrNoCan, men kept off 9 s: off, thrown from 5.5 m after 6.1 s; on, no can, kit
  3 → 3, in they go. Nobody run off, or a hand back in time: beat for beat the same. NOT covered by any line: a man killed by the grenade (the probe
  keeps them alive), a shared word, a last warning during the wait, a can first, two cans, more seeds; no tally of what either costs or saves.
  Headless only: never played, never heard, never seen on a GPU.
- **A grenade scatters the men of ANY door order: the order waits for them before its door is opened (`DOORTOOLS.fragHold`, 10-16).** The
  maintainer's call (pause until they are back at the door, then go) for open and clear, bang and clear, the charge, and the orders a scenario makes
  itself. ON in the page (`?fraghold=0` puts it AND thrFragHold off), false in the module and on the frozen stand (`TPS_FRAGHOLD=1` raises it there,
  `TPS_FRAGHOLD=0` puts this rule alone off on shipped), a `FROZEN_HOLDS` row, Tab 'door order: wait for the men who ran', in the nvg-off / ir-off
  pin lists, the journal line (a recording from before the key replays with it off). What it does (`fragStep`, first thing in `step()` for an order
  in `PRE` or 'kick'): the order's men who are `fragRunning` (frag.ts) are kept in `op.fled` until each is back within 0.8 m of his own mark
  (`fragBack`; a man down or re-ordered drops out). While any is out and the stage is one that holds (`fragHolds`), the order does not move, its own
  stage clock does not run, 'the door waits: …' goes in the log once and a man who did not run says 'hold — back on the door.' The stages: the walk to
  the stack and its call; a ready stack once Sam's word has been given (a stack still WAITING for the word holds nothing, who ran is kept, and the wait
  begins when the word comes); a boot, shove, shell or hammer not yet begun; a charge whose own man ran (what his hands had done of it is not kept);
  'stood off'; a set charge on a given word. A word shared by several doors holds its first sound for all of them (`wordTick`, the word's own clock
  for a late door held with it), and so does the signal several scenario orders share (`together()`). The wait is the ORDER's one wait,
  `fragHoldCap` 8 s, summed over its stages: spent, 'on without … · the order's wait is spent' and it goes on as it would have. Sam's word given
  AGAIN while a word is held lets it go at once ('the word again', 'on without … · not waited for'): the go key outside `wordTap` of the first
  press, or the 'go' row, which is not greyed for it. A signal that scenario orders share has no second press. NOT held: a
  door already opened and everything after it (a can in the air, the entry), a blow begun, a hand on a pick, Sam's own trigger on a set charge, a charge somebody's opening of the door has taken off it, a
  captor's last warning, the response team's own door orders (Sam's squad only: `g.orders.sams`). A threshold's hold and its pockets are
  thrFragHold's. CHECK `probes.ts door-grenade` (family `doortools`; `FRAGHOLD_BREAK=1` must fail: 9 lines red on both stands), 12 lines, both
  stands, ONE seed, the depot's c_w and the office's breakroom doors with four men (the pair for one charge row), a REAL defender's grenade put
  down at the feet of the stack's rear man (2.3 m and more off the frame, so its burst does not take the leaf; the men are kept from the burst).
  Measured: rule off, the word a second after the grenade opens the door at once with two to four men running (frozen, and the shipped depot); the
  shipped office door is opened 2.6 s later with a man 1.9 m off his mark. Rule on: 'the door waits' at the word, 'the men are back' 3.9 to 5.3 s
  after the grenade, the door opened 0 to 0.8 s after that with every man within 0.8 m of his mark, 'in' every time; bang and clear the same, the
  can from 1.2 to 1.5 m. Cap cut to 0.3 s: 'on without' 0.30 s after the wait began. The word again: opened on that frame (frozen), 1.8 and 2.8 s
  later on shipped, where the man who opens it had run and has to be at the handle. Since 10-17 that line judges the door only (the
  words, the frame, opened no later than by waiting): how an entry sent on without its men then ends is the room fight's, printed beside it. On the
  shipped depot the four sent on that way are all lost inside on the build of 10-17 (they ended 'in' on 10-16; the line was red on the untouched
  build head for it, and with the squads-from-rooms rule or the infrared light's own rule put off one of four is left and it ends 'in'). An order on its own clock, men short of their marks: the stack is
  called only with them back (the rule off waits for a walking man too; the rule says so and keeps `stackCap` from running under it). A locked door,
  the grenade as the lead steps off to it: frozen, no boot until the men are back (4.5 s); shipped, the boot lands 0.4 s after the grenade, before a
  man has moved, and is not stopped (the line passes on either and prints which). The charge: where its man ran, 'set' 2.4 to 2.5 s after he is back; where
  he stayed, he sets it and 'armed' is said only with the others back. One word for two doors, and one signal for two scenario orders: neither door
  before the grenade door's men are back (4.3 to 4.7 s, against 1.0 to 1.4 with the rule off). No grenade: beat for beat the same, to the frame.
  KNOWN LIMITS: a man whose mark the stuck rule (orders.ts) has moved to where he stands counts as back there; N doors on one word can hold it N
  caps at the worst; a running man can push an unlocked leaf ajar on his way (seen once, frozen: the order then shoves it, still after the men are
  back); the pick's lost progress is not counted while the order is held; the HUD's word note shows nothing for a held word (the spoken line and
  the log carry it). NOT covered by any line: the go key's own press (the check gives the 'go' order the key gives), a man killed by the grenade, a grenade on a stack
  still waiting for the word with the word given much later, the hammer and the shell, a pick, a second grenade, more seeds or levels; no tally of
  what the wait costs or saves in a room fight (the men up at the end are the same with and without on every shipped row; one frozen row ends a
  man fewer with the rule). Headless
  only: never played, never heard (the spoken line), never seen on a GPU.
