# Team feel, night vision, silent, sneaking

One of the area files CLAUDE.md indexes. Everything below was moved here word for word from CLAUDE.md on 2026-10-13, in its old order;
"the bullet above / below" in a bullet means its neighbour there (each block says which lines it was), and a bullet named by its bold
title may now live in another file of this folder: `grep -l '<title>' docs/agents/*.md`. New bullets for this area go at the foot of this file.

<!-- was CLAUDE.md lines 1109–1293 -->
- **The room fight's feel rules (the maintainer's play notes, 10-05;** record rebuild/play-fixes/play-fixes.md): six switches, each ON, each with its
  old behaviour one flag away, all live only while `fightLive(g)` (a scenario — never the night game, a tour or a showcase). `combat.ts FLASH` = the canister in a
  room fight: a man the fireball has a line to is BLIND `secs` [7, 4] s by distance AND FOLDED `stagger` [2.5, 1] s (rooted, gun down, no round — the blind burst
  a watched door was owed is mostly lost), half of both (`concussK`) for a man with no line inside `concussM` of sound path, the thrower's side touched only inside
  `ownM`, Sam's own can cooked (`fuse` 0.7 s after it lands); on a booted door the second man's can goes in on the boot. `guards.ts PACE` = a teammate's legs stop
  at `max` 2.2 m/s whoever asks, gained at `accel` 2.6 m/s² (`ORDERS.run / brisk / onto / entry` sit under it; Sam walks at 1.55, so they keep up with a walk and
  are left by a sprint). `fogofwar.ts FOG.doors` (a leaf that moves unseen is drawn where the team last saw it) / `FOG.lasers` (an enemy's beam drawn only along
  the stretch the team has a line to, never for a lingering man). `guards.ts LIGHTS` + `teamLit` = weapon lights of men under Sam's orders: dark in file behind
  him, stacked, holding; ON walking somewhere on their own (a mark more than `onM` off, or back to Sam from past `aloneM` — a teammate sees only what a light is
  on), through an entry and its search, fighting / hot, and `stepSecs` after an enemy's footfall. `DOORTOOLS.corners` (near corner, deep corner, then the sweep)
  and `DOORTOOLS.search` (the room's floor looked over cell by cell, a man sent on to floor nobody can see; the entry ends on 'searched'). `ROOMFIGHT.stepEars`
  (a hostile's `'step'` event reaching a teammate by the hearing model's rule stamps `Op.stepT`; the best-placed hearer — a line, the least turn — looks:
  `Op.stepBy` → `cue`) and `ROOMFIGHT.arcHalfDeg` 100 (a man holding a dealt arc answers calls / steps only inside it; 180 = as it was). `ORDERS.asideHold` = a
  follower keeps stepping aside for 1.5 s after Sam's measured pace last asked. Rows: Tab ▸ Sandbox ▸ Team feel (next bullet). QA: `probes.ts flashweight` (pace / flash / night / fog / lights /
  corners / entry — each in every start-card scenario; entry = `tools/qa/bang-tally.ts`, every door of every held room under open / bang / Sam's own can, `--json`
  `--md`, `trace <scn>:<door>:<arm>:<seed>`). The rescue-flow probes walk Sam at his WALK (1.55) since the team no longer jogs.
- **Polish pass, 10-05 → (while the maintainer was away;** record rebuild/polish/log.md): `src/game/teamfeel.ts` = the feel rules above gathered for
  ONE Tab section (Sandbox ▸ 'Team feel', `feelRows` in bindings.ts) and KEPT PER MACHINE (localStorage `twopointsix.teamfeel`, only the keys a row touched and
  that differ from shipped; `KEPT` is the list with each row's range — a row whose key is not in it is refused; `loadTeamFeel()` in the Game constructor,
  `resetTeamFeel`, `teamFeelSummary`; `probes.ts flashweight-feel`). The panel's slider labels are cut at ~19 characters and its switch labels at ~37: keep new
  rows inside that and put the sentence in the `title`. New rules, each a row there, each scoped by `teamPaced` / `fightLive` (a scenario, never the night game):
  `PACE.turn` 8 rad/s (guards.ts `teamTurn`, used by squad.ts's runner: a scripted teammate's gun TRAVELS to a point an order or the cover gives it, round his
  front; a point his own eyes gave him — `GuardScript.over`, the room fight's — is NOT slowed; 0 = the snap) · `ORDERS.offDoor` 0.8 m (Sam stopped: no follower's
  place falls in an open door frame — `clearBack` pushes it, and the places behind it, back along the trail) · `ROOMFIGHT.teamHot` 45 s (a teammate stays
  ROUSED that long after a shot / charge / boot reached his ears: a sighting alone is a man to him; it was a literal 10, and a defender walking in a side door a
  quarter of a minute after a room was taken beat the man watching it) · `ROOMFIGHT.cued` (no surprise beat for the man `Op.turn` already had him coming round
  to) · `ROOMFIGHT.letGo` 0.8 s (held off his man for a friend in the line with nowhere to step, and an enemy shooting from elsewhere in his sight: `Op.pass`
  drops the masked man for 2 s and he turns to the shooter) · `COVER.leaf` (an OPEN door is dealt only to a man with a line INTO its doorway — from the side the
  leaf swung to he was 'watching' the back of the door) · `COVER.step` (ON; 10-06: a door standing open by the squad that NO free man has a line into gets one man —
  stood still, under 'fall in' with Sam standing or a plain 'hold' — who walks ≤ `stepM` 1.8 m from his place to a spot he sees through it from, never in or
  across an opening nor into a gun's lane, and is then dealt the doorway; cover.ts `stepDeal / stepSpot`, orders.ts asks `cover.stepOf` — a follower's goal,
  a holder walked off a mark that stays put; a FOLLOWER steps only once he stands within `COVER.stepPlaceM` 0.6 m of where 'fall in' has him — he closes up first, then covers; 0 = from wherever he stands still, as it was; `probes.ts cover-step`; `threshold-identity` pins it off; numbers in rebuild/away-build/polish-items/open-door.md). **Rear security ships ON, room cover OFF** (24 seeds × six scenarios, numbers in the log): `COVER.stacked`
  (orders.ts `spareRear`: a stack's last man — the last two of four — has `Assignment.spare` + `.from`: cover.ts deals him an opening, or his own rear = the
  way he came, from his last `COVER.rearWalkM` 5 m to the mark and while it waits — on the walk before that he keeps up with the file, gun forward: with the
  rear his for the whole walk he came backwards, metres behind his mate (it first shipped at 3 m, unmeasured: 98 teammates of 192 standing over 72 runs where 5 m
  leaves 119, 8 m 121 and the whole walk 119 — measure a default before it ships; `pairs-tool` stages its charge-under-an-opened-door check twice for it,
  plain stack and as shipped); `probes.ts orders-stack` pins the switch OFF (the plain stack: every gun on the door) and `cover-order` holds the ON contract (only the rear men are dealt, never a jamb man, never before the last steps) (doortools.ts `PRE` phases, every tick; every gun turns in as the can / boot / shove goes; cover.ts
  `spare()` wants a living mate's gun still on that door) · `COVER.inRoom` (the men an entry leaves on their pods get `spare` at 'in': cover deals them the
  room's other doors — no gain, costs rooms). **THE SECOND ROUND (found by sorting every teammate's death by what he was doing — playthrough's `deaths` rows),
  each a Team feel row, each off = as it was:** `ROOMFIGHT.closeLane` (+ `pointBlank` 2 m; roomfight.ts `closeLane()` used by `friendInLine` for MATES only —
  Sam is owed the whole lane BETWEEN a gun and its man; standing PAST the man he is owed his own breadth + a fifth of how far past, `ROOMFIGHT.samBehind` (off = the whole lane there too: a gun lowered for him is a weapon light lowered, and the man they could no longer see shot them) — and by guards.ts `colleagueInLine` for the team in a room fight: a mate's clearance ≤ 0.3 m + ¼ of how far along the line he
  stands, one beyond a point-blank man only if the line passes through him; in a doorway scrum every gun was down for the mate beside the man they were all
  on) · `ROOMFIGHT.nearest` (`closeM` 2.5, `noShot` 0.4: he leaves his man for one aiming at the team inside 2.5 m, and a man he has had no clear round at
  for 0.4 s — `Op.blockT` — loses his hold) · `ROOMFIGHT.turnWalk` (`GuardScript.over.walk`: a WALKING man whose threat is more than 1.2 rad off the way he
  is going turns his chest to it and walks on sideways / backwards — squad.ts strafes his path, `walkWatch` hands a wedged man back to followPath; the
  hysteresis is on his direction of TRAVEL, never his chest) · `ROOMFIGHT.samLine` (Sam in a fighting teammate's line: gun to the low ready, not held up on
  him) · `ROOMFIGHT.stepLook` (+ `stepLookSecs` 5: the nearest ears with NO line to the walker look at where the steps come from; a shot or a mate's call
  takes the look over; never on the way to a door's mark or through it) · `PACE.swing` 30 rad/s (the fight's own point is never slowed, but when it passes
  behind his back the twist clamp no longer flips shoulder to shoulder in a frame) · `DOORTOOLS.sectors` (`keepSectors`: a man holding the sector an entry
  left him swings it off a mate standing in it; the swing keeps the first arrival's `arrT`) · `COVER.edge` (an open door whose leaf hides its doorway: a man
  with NOTHING ELSE takes the leaf's free edge — `LiveOpening.edge / edgeBy`, never dealt, never `by`, not in the published `live`) · `COVER.laneWalk` (a
  walking man keeps his opening `laneSecs` through a mate crossing his line — a file on the move no longer swings its guns to and fro) · `COVER.backKeep` (on, `backBody` 0 — keep that under cos(`twist`); row 'cover ▸ keeps walking
  backwards'; pinned off in the frozen-digest lists: a man ALREADY walking backwards on his opening keeps to it until his body has come round to the way he goes — he
  changed his mind every frame and shuffled two seconds on the spot beside a door) and, landed with it, sneak.ts `SNEAK.sideStop` 0.25 (the partner's step aside: the
  last quarter metre short of the spot is asked for sight as well as the spot; 0 = the spot alone; no row). A recording or run tape from before the two keys replays with
  `backKeep` off and `sideStop` 0 (journal.ts `applyKnobs`), one that carries them keeps its own; `bun run tools/qa/backkeep-check.ts` holds the walk and both replay
  lines (`--off` must fail) · `LIGHTS.lookDark`
  SHIPS OFF (a lit man on his mark looking into the dark burns his light: it keeps a holder lit, reads the CPU light estimate, and broke `flashweight-lights`). 
  **THE THIRD ROUND = THE MAINTAINER'S CQB FOOTAGE** (five Controlled Pairs videos read as frames + his pasted transcripts; rebuild/polish/footage/
  what-the-footage-says.md is the record, narrator quoted with times), each a Team feel row, each off = as it was: `DOORTOOLS.secondThrows` (+ `throwReach` 4, `tossTurn`
  0: the bang is thrown by the man BEHIND the first man on every door — 'you never use handhelds with your number one man' — the first man's gun stays on the opening
  and he is first through; `tossTurn` > 0 lets a thrower who was rear security until the shove come round to the door first — at 0.35 s the door stood open
  with no can in the air that much longer and `pairs-hold` lost four of twelve, so he throws as he turns; it was the opener's own throw on any door not booted) · `LIGHTS.litOff` (+ `litAt` 0.5, `litM` 15, `litMarkM` 6; guards.ts `litPlace` / `placeLitSeen`: the PLACE decides — a man keeps his weapon light off for
  EVERY reason while the floor under him, every metre along his gun and every third down both edges of its cone to the first wall, under the man his eyes have and on a
  mark he is within 6 m of is all at `litAt` or over, by the CPU's direct estimate with nothing carried counted. 0.5 = where the room's own light makes a standing man a
  sighting at 9 m; the first cut at 0.3 with five samples left men blind in dim rooms and lost 18 teammates in 72 runs. THE START CARD'S NIGHT FLOORS ARE ALL UNDER
  0.5: as shipped the rule spares no light on them (it is for a lit level; the bar is the maintainer's row). `flashweight-lights` judges a lit place by the rule's
  reading AND its own reading of the floor under the man, holds that lights burn in the dark at the shipped bar, and lets the bar down to 0.2 on the four-man room clear
  to see lights spared with every other check of the entry holding) · `DOORTOOLS.slicePace` 0.9 (a slicing man's step between stations; 0 = the pace of any other walk
  to a mark) · `DOORTOOLS.lastOut` (+ `lastOutM` 3: three or more left holding a room — the last man through WITH A LINE to the doorway keeps his gun on the door they
  came in by, his watch point 3 m on through it so Sam in the frame brings the gun down; `keepSectors` never swings him off it; beat `door · <callsign>`).
  **CORNERS AND WHO GOES FIRST (10-06,** record rebuild/away-build/polish-items/corners-and-lead.md), four Team feel switches on DOORTOOLS, each ON, each off = as it
  was (all four off = a0a2d50 digest for digest): `cornerOwed` (the seconds the room fight has an entry man's muzzle on a man do not run his corner's `cornerCap` — it used to run
  from the frame whatever his gun did, and a man who shot on the way in gave corners up unlooked) · `collapse` (his man DOWN with a corner owed and a mate through the frame behind him: roomfight.ts restores him at once
  instead of resting half a second on the spot — `DoorTools.owesCorner`) · `cornerTurn` (on his point with the owed corner > 1.3 rad round from his chest he turns his body to it:
  the runner's twist clamp is 1.5 rad) · `leadSeen` (+ `leadSeenMin` 12 cells, `leadSeenSecs` 30, `leadSeenM` 11: `src/game/floorseen.ts FloorSeen` records per teammate when each
  nav cell was last in his eye's wedge with a line; of the front men of the two files — at a threshold, the jamb men — the one who has seen `leadSeenMin` more cells of the room
  than the lead goes first (`firstIn` / `seenMost`; beat `first:<callsign>`), never the man who threw the can; a shut door nobody has looked through stays the lead's). QA
  `probes.ts cornerlead` (corners / lead: before and after on a fixed handful of doors) and `bun run tools/qa/cornerlead-probes.ts [--seeds 1-3] [--jobs 3] [--tools open,bang,thr]
  [--json f] [--md] | trace <scn>:<door>:<tool>:<seed>:<before|after>` = the count over every held room's doors. `threshold-identity` pins the four off beside the goggles.
  **ENTRY POINTS AND REAR GUNS (10-06,** records rebuild/away-build/polish-items/entry-points.md and rear-guns.md; the four pieces measured together:
  rebuild/away-build/polish-items.md): `src/game/entrypoints.ts` (`Game.entry`, table `ENTRY`: `offOpenings` ON, `watch` ON, `nearM` 3, `gaps` off) remembers per opening
  which side one of the squad has stood on with a line to it; a point of domination (doortools.ts `pods()` → `entry.clearOf`; `podsAsWere` = unmoved) or a search
  point (`moveOn`) within `nearM` of, and in the line of, a door nobody has been beyond moves to the nearest clear floor of the same room, and its man then holds with
  his gun on that door (`Pod.watch` → `onSector`). cover.ts `REAR` (`settle` ON, `secs` 0.75, `file` off): a gun the cover's deal has just let go of stays on its
  opening `secs` before the order's own watch has it back (a stack's rear men only unless `file`) — the deal itself is untouched (`kept` / `keptOf` / `unkeep`).
  QA `probes.ts entrypoints` (known / count / off; `bun run tools/qa/entrypoints-probes.ts table`) and `cover-settle` (in family `cover`). **Every frozen-digest probe
  pins ALL of 10-06's switches off together beside the goggles** — `ENTRY.offOpenings`, `REAR.settle`, `COVER.step`, DOORTOOLS `cornerOwed / collapse / cornerTurn /
  leadSeen` (`threshold-identity`, nvg-probes.ts `digestLines`): with all seven off the scripted play-throughs equal a0a2d50 digest for digest; a new default-on
  switch joins that list (since joined by `ORDERS.workOut`: on a door face with no floor at either jamb and no authored marks the men work their own stack and
  stand-off marks out — orders.ts `workedMarks` / `workedPick`, Team feel row 'orders ▸ a door with no room at its jambs', `probes.ts sidedoor`; off = such a face is refused as before — and by `DOORTOOLS.buddy`: a walk that takes a man away from everybody is taken by his pair or not at all,
  doortools.ts `away()`, knobs `buddyM / buddyPairM / buddyLeftM`, Team feel row 'stay together', counted by playthrough.ts's off-alone watcher (`RunOut.alone`); off = the old one-man deals. A threshold entry's FAR DOORS stay one man's each either way: by pairs is `DOORTOOLS.buddyDoors`, shipped OFF (measured worse: the block (OLD floor) 303 → 269 men up of 576), so it needs no pin. The laser digest, irlaser-probes.ts `digestLines`, pins both too). Pinned off there as well: `ORDERS.hallFile` (ON: a door that fills the end of a passage, where every older answer was 'no room on that door' — the men the jambs have no room for file back down the passage against its wall, orders.ts `hallPlaces`, also a charge's last stand-off; Team feel row 'orders ▸ stack down a passage'; off = refused as before; `bun run tools/qa/barracks-check.ts --fault B1 --static`). `ENTRY.offMouth` (a point dealt past the mouth of the door the entry came by is never moved back into it; row 'entry ▸ points off the way in') SHIPS OFF: on the barracks it frees the first doorway and the scripted commander, no longer stuck there, walks his file out into a counterattack seconds sooner — count it with a commander who waits before turning it on.
  **THE WAY AN ORDER WALKS A MAN (`src/game/cleared.ts`, `Game.cleared`, 10-08; the maintainer playing the warehouse: "they'll route to the room through a different
  door … even worse they'll go through uncleared rooms to get there").** `ClearedRooms` floods the level's ROOMS once on its own books (the room fight's rule: nav
  cells joined without crossing a doorway cell, a flood past 2400 cells = open floor = never a room) and marks a room KNOWN when a teammate or Sam has STOOD in it
  (4 Hz, ticked before the door tools; forgotten by `resetGuards`; NOT in checkpoints — after a load the rooms the team stands in are known, the rest relearnt).
  Three default-on `ORDERS` switches read it, each off = the build as it was, all three in the frozen-digest pin lists: `cleared` — orders.ts `route()` (every
  mark an order walks a man to), the fall-in file (`roundRooms`, corners in `Assignment.via` while `post` is null) and the retake from the fight price every cell of
  a room nobody has been in `clearedDear` (20) times known floor and walk the corners of that way; the mark's own room and the room he stands in are never dear, a
  doorway locked against Sam stays dearer (×1000), and with no way round the short way is walked — an order is never refused for a room. `knownFace` — `sideFor()`
  (the squad of four's stack face) takes the face whose floor is known when the other's is not; the men's walks decide only between two known or two unknown faces
  (the old rule alone dealt the face INSIDE the room to be cleared whenever its other door stood open). `ownDoor` — an entry's assignments carry
  `Assignment.thru` = the ordered door (doortools.ts: the points of domination, `sendOn`, the far doors): `byDoor()` walks a man who is not at it to the door's
  mouth by known floor — the entry's own room dear whatever is known of it — and in through it; null (the short way) for the man whose short way crosses it, a man
  already in the room or in one of its doorways, or a door locked against the team; dropped once he is in the room. Team feel rows 'orders ▸ all in by the ordered
  door / stack on the cleared side / walk round uncleared rooms / uncleared room ×'; `g.cleared.summary()` / `.stats` (round · through · face · mouth). QA
  `probes.ts ordereddoor` (face / feet / late / round — the office, the server room taken and its side door standing open: each FAULT is asserted with the switches
  off beside the fix), playthrough.ts `PT_WAYS=1` (tools/qa/ways-watch.ts: every doorway a teammate walks through, flagged 'otherDoor' / 'uncleared') and
  `PT_DIRECT=1` (a commander who gives the door tool straight, no fall in / stack between rooms — the scripted commander's own walk otherwise makes every room on the
  way known before his men move).
  **The way round only when it is worth it (`ORDERS.roundCap`, 10-13; the owner's tape, floodlit yard 033934 at 1:56.6: a wall charge after a clear from outside
  walked three men 28–36 m round the building, by the back door and the unknown store, for ways of 9–13 m).** `route()` / `roundRooms` refuse a way round that still
  crosses unknown floor (`route()`: unless at most `ROUND_LESS` 0.5 of the short way's unknown floor — 1 m against 10 m is taken) or is over `roundCap` × the short way + 3 m: the short way, as with no way round. Page `ROUND_CAP` 1.6 (`?roundcap=0`); 0 in the module and frozen
  (`TPS_ROUNDCAP=1`, `FROZEN_HOLDS`, the pin lists; journal: the number rides in a recording's `flags`, no flag = 0). `probes.ts ordereddoor-round`, both stands, `ROUNDCAP_BREAK=1`: the yard staged once, four men 26–31 m → 7–13 m walked by the front door. Never seen on a GPU. **THE CAP SPARES A PAIR'S WAY ROUND TO ITS OWN DOOR (`ORDERS.roundOwn`, 10-15; a claim from the bodies-and-doors goal):** the cap's guard for "the short way runs through his own door" held only for the four (`round` wants `orders.big`), so a PAIR standing behind the ordered door was refused its way round and a man pulled the door open in the stack stage to walk through it. `roundOwn` (true in the module, it does nothing while `roundCap` is 0, so the frozen stand is as it was; page `?roundown=0`; journal: an `ORDERS` table without the key replays false; panel row 'way round ▸ kept off the stack's door') = the cap never refuses a way round that keeps off the door he is to stack on when the short way crosses it (a way round that itself crosses that door — a pair's own door is not priced as a wall, only the four's — is still capped). NOT "never through it": a pair between two KNOWN sides, and one whose way round crosses about as much unknown floor as the short way (`left > offM - OFF_M`), still walks through the ordered door as before the cap (not touched; no walk-length bound but the search's, as for the four). `probes.ts ordereddoor-round`, both stands, `ROUNDOWN_BREAK=1` fails on both: the office, fire exit, Sam outside, the pair inside: its leaf first moves at frame 847 with no man on Sam's side (cap, key off) → 1235 with both there (key on; the same as no cap); frozen with the cap written 845 → 1152. One seed, one door. Never seen on a GPU, nobody has played it.
  The night breach names its own
  objective (`NightBreach.objective()`), the controls list has the X · B · T · F row, long order rows wrap. **Two QA tools:** `node tools/qa/page-look.cjs <outDir>
  name='query' …` = the REAL PAGE in headless Chromium on the software WebGPU adapter (SwiftShader; ~2 min boot, ~4 min a scenario at verylow; env PORT SIZE
  QUALITY SECS FRAMES PANEL='<panel search>'; the tool switches the smoke solver off — it compiles there since the brick pool, but a step costs ~3 ms a brick; `bun run dev`'s bundler serves the tree AS IT
  IS at each page load, so do not edit under a running take) — what a bundle-only break, the HUD's words and a drawn frame look like without a GPU; and
  `bun run tools/qa/playthrough.ts [--scn ids] [--seeds 1-6] [--jobs 4] [--json f] [--set '{"PACE":{"turn":0}}'] | --trace <scn>:<seed>` (`PT_COVER=1` adds the
  cover's deal every second, `PT_FIGHT=34-36.5` the room fight's own state per teammate at 10 Hz over that stretch — target, cue, track, the beat before he may
  fire, his eyes' meters —, `PT_TWITCH=1` the cover's last deals in each twitch line) = every start-card scenario PLAYED to its end by a scripted commander on his own feet (fall in → stack → bang / open and clear →
  walk in → next, then a hunt for a last defender who has left the rooms; never fires, not seen, and — since the second round — STEPS OUT OF HIS MEN'S LINES
  OF FIRE (`offLine`; `PT_STAND=1` = the old statue, who stood in doorways face to face with a hostile and got the men behind him killed: every table made
  before that change measured the driver)) under a WATCHER counting what a competent team would not be seen doing (stuck, hung, overlap, doorway, flag, wall, snap,
  twitch, behind, block, unaware = killed from outside his arc, friendly) and keeping a row per teammate DEATH (`--json` → `runs[].deaths`: his order, target,
  whether he was on his killer, the beat he still owed, gun down for a friend, lights, blind — sort them by cause before guessing at a fix); exit 1 on an error or a stall. Runs are chaotic per seed: read 12 seeds × six scenarios at the least (72 runs, ~6 min at --jobs 4), 24 to call a default, and do not
  edit src/game or the runner under a running set — every run is a fresh bun that imports the tree as it is (measure from a `git worktree` snapshot and keep working).
- **Calls taken, 10-06 (while the maintainer was away;** record rebuild/away-build/calls.md = one row per open call the earlier pages left him: the pick, why,
  how to flip, checked or guessed — then the calls still his): every call TAKEN is a Team feel row (labelled `calls ▸ …` until 10-10; now named by what each does: `thr menu ▸ …`, `held door ▸ …`, `pair ▸ F is the word with a menu up`, `defenders ▸ rally ×`, `fog ▸ last seen s`) (own `Object.assign(KEPT.…)` lines under teamfeel.ts's
  table, own `feelRows` blocks in bindings.ts) whose shipped value is the pick and whose other side is one flick away; `probes.ts calls` (tools/qa/calls-probes.ts on
  thresholdmenu-probes.ts's rig) holds BOTH sides of each. The threshold's menu (doortools.ts `thrRows()`, re-dealt from `sync()` when `thrSigNow()` moves — the switches work
  live): `thrHoldFirst` true (hold = X, 5, 4, 1; false = the two forms trade keys) · `thrBangFirst` true (**the held page is `thrBang` 1 · `thrStep` 2 worded 'step in · no
  bang'** — the plain step in was the one clearly bad row to have under key 1; false = as built) · `thrOutsideRow` true · `thrLeaveFallIn` false ('leave it' = stay stacked;
  true = the `fallIn` order) · `thrHandsOff` false (true: the step-in-by-itself form gets no held page — `heldOn`) · `thrHeldAll` false (true: with the four the held page only
  when every addressed man holds) · `thrMenuWord` true (false: the pair's F with a menu up that is NOT the held door's own is not the word and falls through to whatever else F is
  — in the room clear that is the drill, which takes the men off the door). `ROOMFIGHT.rallyK` 1 (× `FIGHT_SKILL.*.rallyChance` in `rally()`; the dice are drawn either way, so 1
  is the game as it was and 0 = nobody leaves his room). `FOG.lastSeen` 0 s (fogofwar.ts `lastSeen()` → a thin fading '(?)' where an enemy now out of the picture was last
  seen, `.marker.lastseen` in overlay.ts + the native overlay; HUD only, nobody's AI reads it; 0 = off = as shipped — the ready answer if the game reads too hard without enemy
  lasers). Changing a shipped value here moves the scripted tallies and `threshold-identity`: pin the old value in tools/qa/threshold-probes.ts as the rescue part did.
- **Rescue with goggles on (10-06;** record rebuild/away-build/rescue-goggles.md): the scripted office rescue fell from 22 to 4 of 24 once the team had
  night vision; with these rules it is 24 of 24, and the seven scenarios together 106 → 142 of 168 with goggles on (128 → 134 off). Six switches (Tab ▸ Sandbox ▸
  Team feel unless said; each off / 0 = as it was — with all at their old values the play-throughs come back run for run against the base): `ROOMFIGHT.samTravel` ON
  (roomfight.ts `friendInLine`: the room Sam is owed in a teammate's line of fire widens by how fast he is really GETTING somewhere — an eased displacement,
  `samSpeed` — capped by the pace he asks for; `Character.vel` is the COMMANDED velocity, so a commander shuffling beside a corridor line counted as crossing it at a
  walk, every gun behind him came down and nobody fired until the hostages' clock ran out) · `ROOMFIGHT.samBeside` ON (Sam level with or behind the muzzle is not in
  the line at all, and the lane opens from 0.3 m at the muzzle to the whole lane a stride ahead; it was measured from the muzzle POINT for a man behind it, so
  walking shoulder to shoulder with a teammate held his gun, and its light, down whichever way it pointed) · `NVG.huntFrees` OFF (nvg.ts: a defender alert or
  searching in a teammate's sight no longer counts as COMPROMISED — only what is loud, or an alarm, frees the weapon lights. Through a tube the pair sees the roamer
  behind the conference glass seconds in; the old rule put two white lights on him through the pane, he fired blind into it, and that gunfire brought the door man
  and the captor up ten seconds early) · `ROOMFIGHT.keepTrack` ON (a man out of a teammate's sight for under 1.5 s — a leaf swung across, a jamb passed — comes back
  with the aim he had less what the gap cost: `Op.kept`) · `ROOMFIGHT.noShotGo` 1.5 s (`walkOn`: a teammate ON HIS WAY somewhere who has had his gun on a man that
  long with no round at him — glass, a jamb — says 'no shot — moving.', lets him go for `noShotPass` 4 s and walks on; the pass lifts the moment a round would
  reach, and `cue()` does not turn him back to that man meanwhile; nothing on the rescue as shipped, 15 → 23 of 24 once the lights are freed) · `RESCUE.holdHot` OFF
  (Tab ▸ Sandbox rescue rows; on, a flow cover man stays on a hot room past `hotHold` — measured: nothing gained with goggles on, ten more teammates lost with them
  off, so it ships off). `playthrough.ts --set` now reaches `RESCUE` as well as the feel tables. A new KEPT row goes in teamfeel.ts's `Object.assign` lines under the
  table, not into the table's own lines (other parts merge against those).
- **Dark on a lit man (10-06;** record rebuild/away-build/night-breach-hunt.md): `LIGHTS.litMan` ON, ONE Team feel switch for two halves (Tab ▸
  Sandbox ▸ Team feel ▸ 'light ▸ dark on a man who stands lit'; off = 1df2ad2 run for run). A teammate who stands in the DARK with his eyes on a man standing in
  the place's own STEADY light (guards.ts `onLitMan` / `darkOnLitMan`: both read at `litAt` off `lightEstimateAt(…, steadyOnly)` — nothing carried, no ttl /
  transient light, no blackout beacon: the first cut counted the flash of a round landing by the man as a lamp and blinked the team's lights off on a man in the dark) (1) keeps his weapon light
  off (`teamLit` returns false first; held through `Op.kept`'s 1.5 s blink unless a cue is turning him to somebody else) and (2), walking on an order that CLOSES on that man with Sam in his line — gun down
  for it — holds his feet where he is until the line clears (roomfight.ts `holdShort` → `fight.short(gd)` read by orders.ts's fall-in and post legs, the stuck
  clocks stamped while held; `ROOMFIGHT.holdShortSecs` 4 at most a hold, 0 = never). WHY: the night breach worked from the threshold lost a man in a run in
  four in the commander's last hunt — sent past Sam at Tango 1 under the lot's lamp outside the fire exit, Blue Two walked at an aimed man with his gun down and
  his lens lit. MEASURED (`PT_TOOL=threshold`, night breach, 96 seeds no version had been run on, 337–432): 165 → 184 of 192 teammates up, but runs won 96 →
  92 of 96 — the losses that remain take BOTH men (he steps into the lamp's spill with the jamb still blocking his bore). Either half alone is far worse than
  neither (42 and 59 of 192 against 155), hence one switch; a nine-metre range limit on it cost 27 men over 528 runs and is not there. Seven scenarios from the
  threshold 626 → 635 of 864; today's entry 322 → 319 of 432 goggles on, 288 → 284 off (neither a difference; the depot leaned down in those and came back 307 →
  305 of 384 on 96 fresh seeds). Pinned off in threshold-probes.ts's identity and in the nvg-probes.ts / irlaser-probes.ts digests (guarded: the same file runs in a checkout without the knob). QA
  `probes.ts litman` (the rule asked of its own functions on a staged night breach: lit / dark / flash / blink / turn / feet / cap / switch; `LITMAN_BREAK=1` must fail).
  OPEN: no hysteresis at a lamp pool's edge; 'he stands in the dark' is the CPU's direct estimate (no bounce, no moon); the held man's body still steers at his
  next waypoint (runner at speed 0), `short()` lets go a quarter second late, the cap re-arms after a second's gap, a hold begun inside the runner's settle band
  can end with his mark moved to his feet; `litPlace`, nvg.ts `nvgPlaceLight` and doortools.ts `thrLitCell` still count round flashes and tracers as the place's light.
- **Eyes on the sights (10-06;** record rebuild/four-man-entries/fix.md, cause in trace.md beside it): guards.ts `canSeeChar` reads every man's eye as the mean of
  his chest and head directions, and with a long gun in the shoulder that look sits 42–63° OFF his own gun line (bladed chest, head on the stock) — with a 58° cone he was nearly
  blind along his sights and past 3.5 m did not see the door he was covering. `ROOMFIGHT.sights` ON (Tab ▸ Sandbox ▸ Team feel ▸ 'eyes on the sights ▸ teammates'; off = adf4d0a run
  for run): an operative unit with his long gun in the shoulder and its bore within 30° of his aim (`SIGHTS_COS`) ALSO sees an AI man through the same eye laid along `aimYaw` — a
  cone of `ROOMFIGHT.sightsDeg` 45 either side of it + the near field; a union, tried only when the old eye has him out of cone; only while `fightLive`, never Sam (`isPlayer`: the
  stealth game's sighting is untouched), nothing for a gun lowered for a friend (`gd.muzzleDown`: the low ready; the entry dip under `MOVES.entryEyes` is the one exception — the MOVES second-pass bullet). WHY 45 AND NOT THE EYE'S OWN 58: the room fight owes a SURPRISE beat for a man first seen more than
  `FIGHT_SKILL.operative.sectorDeg` 50 off the aim, so a sights cone wider than the sector makes a man seen in the 50–58° band, while the gun is still swinging to him, a surprise
  (seen sooner, shot later) — at 58 that lost one office rescue of 48 and one registry rescue of 48 from the threshold; at 45 both are back (keep `sightsDeg` ≤ the sector;
  `roomfight-eyes` checks it). `ROOMFIGHT.sightsFoe` (every other side) ships OFF: measured, it costs the team more men than their own eyes find (the depot −44 of 288). MEASURED
  (the usual entry, goggles on, 144 seeds a scenario, paired by seed against 8a7961e's recorded runs): room clear four 369 → 404 of 576 teammates up (+35, 95 % +2 to +68; at 58°
  +44), wiped squads 21 → 15; the depot 438 → 425 (−13, −39 to +12: inside the scatter — its men are lost to a defender who walks into the back of a standing file, which no eye on
  a gun line sees). Negatives in fix.md: four cover-deal rules tried beside it moved nothing and are not in the tree. NOT touched: `FloorSeen` (the entry's seen-floor record keeps
  the old wedge), fogofwar's eyes. Pinned off in threshold-probes.ts's identity and, guarded, in the nvg-probes.ts / irlaser-probes.ts digests (a new default-on switch: the
  frozen-digest list above grows by this one). QA `probes.ts roomfight-eyes` (in family `roomfight`; `ROOMFIGHT_EYES_BREAK=1` must fail). playthrough.ts `PT_FIGHT` prints per enemy
  why a teammate does not see him, `PT_NOTES=1` the room fight's notes.

<!-- was CLAUDE.md lines 1308–1391 -->
- **Night vision for the team** (`src/game/nvg.ts`, 10-06; the maintainer: "the squad members should have night vision and use it accordingly. this could
  either be following your lead or knowing when they haven't been compromised and flashlight would ruin that" — "but the lights make sense too, especially when
  things are loud"; `NVG.on` default ON, a Team feel switch — **OFF = the build before it frame for frame**: `bun run tools/qa/nvg-probes.ts digest` here and
  the same file in a checkout of af55d89 print the same seven hashes). Per frame (`nvgTick`, game.ts right after `fight.tick`), for operative units while
  `fightLive`: the TEAM is `dark` or `free` — THE LEAD (`NVG.lead`): Sam's light switched on with that gun in his hands (the switch, not `pl.light.enabled`: a
  sprint lowers the beam) → free; his goggles down, light off → dark, quiet or loud; else THEIR OWN JUDGEMENT (`NVG.own`): dark until COMPROMISED = a loud thing in
  a teammate's ears (roomfight `Op.hotT` / `fight.hotT`), an alarm (`escalationOf ≥ 1`), or a hunting hostile in the team's sight, for `quietSecs` 30 after the
  last ('going dark.' said once on the way back). A DARK man's weapon light is vetoed in guards.ts `attachFlashlight` AFTER the light rule has run (`nvgDark`;
  only men `lightRuled` has) — except, on own judgement, where what he is looking at within 8 m is BLACK EVEN TO THE TUBE two readings running (`blackAt`;
  the CPU's direct light + the moon, no bounce, so it fires more headless than the picture warrants). GOGGLES DOWN = his light off and his place dim
  (`darkAt` 0.5: feet, 2‥16 m along the gun, his mark, his target; `downSecs` / `upSecs` dwell). WHAT THEY DO = one term in `sightGainOn`: `light = max(visibility,
  lampGlare, nvgSight)` with `tubeVis(g, E)` = post.wgsl's intensifier curve at `settings.nvGain` / exposure read back onto the meter's 0‥1 (E 0.03 = bare 0,
  tube 0.59; E 0 = 0 — a tube amplifies) — cone, range, smoke, motion untouched; hostiles never have it. Drawn by combat.ts handProps (`nvgWorn` / `nvgDown` →
  rigProps `gogglesBoxes`; a downed teammate keeps his). Rows: Tab ▸ Sandbox ▸ Team feel ▸ 'night vision ▸ …' / 'nv ▸ …' (teamfeel.ts `KEPT.NVG`) + `nvgSummary`.
  QA `probes.ts nvg` (quiet / lead / loud / sight / fight / rig / off; `NVG_BREAK=1 … nvg-quiet` must fail). Older probes that assumed bare eyes are PINNED to them
  (`NVG.on = false` for that block, restored after) because they measure something the goggles supersede or break the premise of: flashweight-lights and
  rescue-orders' light line (the LIGHTS rule alone), cover-side (its defenders stand dazzled in dark rooms — a goggled team shoots them on the walk up),
  rescue-flow-states' 'hot room goes cold' (the man parked out of sight in the dark is seen through a tube), roomfight-sight's dark run ('dark, no light: not
  a round' is the bare-eyes rule; nvg-sight holds the other half), nightbreach-contested's canister tally (one-room-in-fifteen margins tuned bare-eyed; with
  goggles 14 rooms / 4 lost against the canister's 14 / 10). Two were made to say their rule rather than a seed's luck: roomclear-rooms (the break room is
  'cleared' exactly while no defender is up inside it) and nightbreach-stop (a lightning stroke is not a steady light). KNOWN: a teammate who SEES a man he has no line of fire to (through
  glass) leaves his order and stares (roomfight `heldForLine`) — better eyes make it commoner (the hostage rescue's first roamer). Not modelled: bloom-out under
  white light, the tube's field of view, the lens glow as something enemies see (the IR laser is the next bullet; the IR light on the goggles the one after).
- **IR lasers** (`src/game/irlaser.ts`, 10-06; the maintainer: "and then we could also model IR lasers (assuming enemies don't have night vision)"; `IR.on` default
  ON, a Team feel switch — **OFF = the merged base (de5e1c4 + a66eb1e) box for box**: `bun run tools/qa/irlaser-probes.ts digest` here and the same file in a
  checkout of 28d9f7e print the same seven hashes, every dynamic box of every frame in them). The squad's laser is ONE device whose BAND follows its carrier's
  goggles — no key: `laserBand(g, gd)` = 'ir' while `nvgDown`, 'visible' (the red line, as the base drew it) with goggles up and for every man who wears no
  goggles (showcase casts, hostiles under the sandbox's `LASER.enemy`). `laserOn(g, gd)` (combat.ts handProps asks for every armed man): the old rule (alert / search, muzzle not lowered, not held) OR, infrared, whenever his gun is at his shoulder (`IR.carry`) — MEASURED: a scenario's teammate
  is never in alert / search (roomfight drives him in 'patrol'), so before this module a scenario teammate showed NO laser at all, and goggles-up he still shows
  none. SAM (`IR.sam`, `samLaserOn` / `samLaserBoxes` right after his rig): an IR line along his bore while a scenario's team is on the floor, his goggles down
  and a gun UP (`anim.upper === 'aim'`: the rifle whenever it is in his hands, the pistol only once it is pointed — at the relaxed carry the bore is not his
  aim; not sprinting / holding / down); nothing bare-eyed. WHO SEES IT: `irViewer(g)` = `Player.nvAmount > 0.5` (and no debug view), the very threshold at
  which post.wgsl swaps the picture for the tube's — `beamBoxes(…, ir)` is THE ONE PLACE an infrared box is made and makes none otherwise (hueless `IR_TINT` at
  the red laser's luminance, albedo 0; UNTUNED BY EYE). An IR beam also stops on a standing civilian (`laserReach(…, civ)`: the hostages; the red one never did), and an IR line whose bore lies on Sam or a
  teammate that frame is simply off (`paintsOwn`, asked with `laserReach().on` = the body it met; the red one is left alone). THE ONE-MODEL RULE is held by construction: a weapon laser of either band is NoShadow emissive boxes —
  never in the trace grid, never a light — so no eye, camera, meter or CPU estimate reads one (**enemies do not notice a teammate's red laser either**; an open
  call, nothing built). `combat.ts laserReach(g, c, self, civ)` = the bore ray both use (returns `on`, the character it ended on). Rows: Tab ▸ Sandbox ▸ Team feel ▸ 'IR lasers ▸ …' (three: `on` / `sam` / `carry`; teamfeel.ts `KEPT.IR`) +
  `irSummary`. QA `probes.ts irlaser` (ir-draw: eight ways round, both pictures, the 0.49 / 0.51 threshold, band follows each man's goggles, on with the gun
  up · ir-sam · ir-unseen: five runs a scenario — IR on / off × Sam's goggles up / down — hash the game, every man's awareness / irradiance / visibility, every
  camera and the light list identically, then Sam LIT in front of an enemy with his laser on / off: awareness rises the same — and in front of a camera: with a
  team on the floor its integrator stays 0 either way (devices.ts `sensing` is off under every team scenario), alone in the office it fills and no laser exists ·
  ir-off; `IR_BREAK=1 … ir-draw` must fail). NOT built: enemies with night vision, a laser's dot as something heard of (the IR ILLUMINATOR is the next bullet).
- **An IR light on the goggles** (`src/game/irlight.ts`, 10-15; the maintainer, of a depot whose rooms were flat black noise through the tube: "maybe we should
  model IR lights on the nvg so even totally dark rooms are visible. and we can assume enemies never have nvg"). SWITCH `IRLIGHT.on`: ON in the page
  (`?noirlight` puts it off), OFF in the module and on the frozen stand (`TPS_IRLIGHT=1` raises it; `FROZEN_HOLDS`, standup pin, standEnv); registered in
  knobs.ts and carried by the journal (a recording from before the key replays with it off). **Off = the build before it**: `nvg-probes.ts digest` and
  `irlaser-probes.ts digest` (both pin it off) print the hashes a checkout of 93bb1005 prints. WHO: Sam, whenever the picture is the tube's (on exactly
  while `Player.nvAmount` > 0.5, post.wgsl's own swap — no tube frame without it, no bare-eyed frame with it; no key, it is part of the goggles; at a
  door with the wand under it and `WAND.nv`, the flood is the lens's); with `IRLIGHT.team` (on) every teammate whose goggles are down (`nvgDown`). Enemies
  have no night vision and nothing of theirs reads it. WHAT: a real spot light at the brow along `aimYaw`, tipped `dip` 6° down, half angle `cone` 65°
  (`core` 20°), `reach` 22 m, shadowed like any light; `power` 8 (30, 40° and 11° until 10-16: below) = on-axis intensity × the picture's exposure (the tube counts exposed luminance, so the
  flood reads the same through it at every hour and Brightness). HOW IT STAYS OUT OF THE ONE MODEL — by construction, four ways: (1) the lights live in
  `LightSet.ir` (render/lights.ts), never in `lights.lights`, so no CPU reader, digest, fog class, reach mask, bounce card or glass mask counts them;
  (2) they are uploaded only on a frame whose picture is the tube's (`LightSet.tube` = `settings.nvAmount > 0.5`, post.wgsl's own swap), flagged
  `LIGHT_IR` (bit 27 of the kind word) and NOT transient: in a tube frame each is a steady light like a carried torch — reservoirs, bounce, reflections
  (as transients, the first cut, each cost the gather's flash subtraction a shadow ray per flood per on-screen hit every frame the goggles were down: the
  performance thread's read, 10-16; a steady light costs that loop nothing, and the tube now shows the flood's bounce too);
  (3) `evalLightTrue` (all probe.wgsl, the GPU light meter, asks) and `directIrradiance` (the cascades its bounce comes from) refuse the bit — **Sam's LIGHT
  bar does not move**: it says what enemies see, and they see the room dark; (4) the frame the tube comes off after an infrared light was in it, the engine
  calls `passes.restartHistories` (the resolve, the bounce, the reservoirs: the bare-eyed picture starts from raw estimates, as after a cold boot).
  THE TEAM HALF (`IRLIGHT.team`; off = Sam's alone, a picture and nothing else, the run digest for digest the one with the switch off): `nvgSight` adds
  `irOnMan` (a CPU estimate of the infrared light on the man looked at: the shader's falloff, window and cone, one segment test) to the light the meter
  reads on him, for a GOGGLED TEAMMATE'S eye only; nvg.ts `readPlace`'s `black` (too dark for the tube, so the white light comes on) retires
  (`irCarried`) — goggled teammates no longer put a white light on because a room has no light of its own; doortools.ts `thrTube` counts floor a jamb
  man's gun is across as seen when his own flood would show a man there (`irShowsAt`). Rows: Tab ▸ Sandbox ▸ Team feel ▸ 'IR light ▸ …' (eight: on the
  goggles / the team carries one too / only where it is too dark / by the light the picture has / floor min / power / half angle / reach; teamfeel.ts `KEPT.IRLIGHT`) + `irLightSummary`. QA `probes.ts irlight` (irl-list: 21
  scenarios — a lamp per pair of goggles down, at the brow, the upload's bits for a bare and a tube picture, never out under a tube frame, the shader's
  text · irl-unseen: a held-door play of 2,160 frames a scenario, Sam's goggles down, the light on and off — the game digest, every man's awareness /
  irradiance / visibility, every camera, the light list and the light estimate on the lit floor identical frame for frame; `IRLIGHT_BREAK=1` puts the
  lamps in the list everybody sums and must FAIL · irl-team: a man with no light on him in a goggled teammate's flood is seen by the tube, not from behind
  him, not past a wall, not by an enemy, not with either half off; `black` never rises · irl-off) — ALL PASS on both stands. Page check
  `node tools/qa/irlight-page.cjs <out dir>` (the depot's dark room `b_n` from its door, four stills: bare / tube without the light / with it / bare
  again; the GPU meter in the room, Sam's own reading, the Tab rows, console errors) — ALL PASS on the software adapter (very low, 960×540): the
  room's middle 120 → 195 of 255 through the tube with the light, the meter there 0.210 / 0.218 W/m² where the flood's axis would add about 3.7, the
  bare-eyed frame 11.2 before and 12.1 after, histories restarted, no console error. MEASURED, headless (CPU sight, no GPU): the team half on against off, shipped
  stand, `bang-tally --arms open --seeds 1-3` on night breach / hostage rescue / records / block / compound / barracks = 132 counted entries: 115 of 444
  teammates lost and 111 rooms taken BOTH ways, 127 runs identical in every field, five differing by under a second to the last man down — a HOT door has
  the team loud and on white light already, so the entry tally does not see it. What moves is the quiet approach (irl-team's held-door play, frozen stand
  with the switch raised, one seed, 21 scenarios, the light on / off, man-frames): 'too dark for the tube' 0 against 21,455 (night breach 93 · hostage
  rescue 1,639 · records 434 · block 2,069 · compound 2,536 · barracks 2,351); goggles down 73,737 against 69,096; a white light burning 30,760 against
  36,034 (block 1,602 against 2,311; compound 2,557 against 3,508; barracks 1,158 against 2,274; night breach 784 against 770); enemies down the same in
  20 of the 21 (the consulate rescue goes the other way: 4 down against 2, the fight starts sooner, so goggles down 4,359 against 6,385
  and a white light 4,551 against 2,572). No tour, no soak, nobody has played it.
  NOBODY HAS SEEN IT ON A GPU: `power`, the cone and the reach are untuned by eye; unjudged are the blow-out on walls inside two metres, the noise of four
  overlapping floods under ReSTIR's one-pick-per-class, the first bare-eyed frames after the histories restart, the frame rate with five more shadowed
  lights, the wand's flood (level, a hand above the floor: it lights walls and legs more than the floor a view from above sees), and rain / smoke / dust in the flood (`volumetric: 0` stops the haze beam only; those particles are lit like anything else, and a shard or a
  splash keeps the shading it was given for up to three frames / its life after the goggles come off).
  **It moves where the squad goes on the shipped stand** (10-16): a live sweep that lets the team act (`doormenu-drawn` teleports Sam round every door with
  the squad following) samples other rooms and doors with the light on, because goggled teammates read dark rooms (`IRLIGHT.team = false` gives the old
  sample number for number). That sweep's one red on the compound was not the light: two doors open in one corner, the second door's leaf drawn through the
  first doorway, the menu rightly the leaf's door (staged by hand the same ray picks the same door with the light off); the probe now counts that case apart.
  **Less bright, and only where it is too dark** (10-16; the maintainer, of the pass's yard at night with four teammates, every man in a white pool:
  "IR lights are a bit too bright. is it realistic to only have them turn on when it's actually too dark to see?"). It is: a tube works on the light that
  is there, and an illuminator is for where there is none. TWO CHANGES. (1) THE NUMBERS, no switch (they are the tube's picture and nothing the sim
  reads moves a digest with the light off): `power` 30 → 8, `core` 40° → 20°, `dip` 11° → 6°. The tube's picture is `log(1 + lum·gain) / log(1 + gain)`
  and its hot shoulder starts at 0.75: at 30 one light put floor two metres off at 0.84 and five overlapping put floor four metres off there; at 8 one
  light on open floor reads at most 0.68 (1.5 m off, the probe's sample of nine scenarios). Every tally above was measured at 30 and is not re-measured.
  (2) SWITCH `IRLIGHT.auto`: ON in the page (`?noirauto`), OFF in the module and on the frozen stand (`TPS_IRAUTO=1`; `FROZEN_HOLDS`, standup pin,
  standEnv), in the journal's knob table (a recording from before the key replays with it off). Off = a light that burns whenever the goggles are down,
  the build before it. THE RULE (`burn`, per carrier): the place's own light (`nvgPlaceLight`: fixtures, the moon, nothing carried, nothing infrared — so
  no light of this file answers its own question) through the tube (`tubeVis`) under `NVG.blackAt` (0.15 of the tube's range: the line the team already
  called 'too dark for the tube' — no second threshold) on the floor under him, or on two or more readings of a fan across his flood (eleven rays,
  −60° ‥ +60°, at 1.5 ‥ 12 m, each to the first wall; one dark reading alone is the shadow behind a cabinet in a lit office, and brought the light on
  for two seconds as Sam turned his head — found by the probe on the registry and the snatch). Read every 0.25 s of the game's clock, each carrier on
  his own beat (Sam's own floor every frame); on from a dark reading until `IRLIGHT.hold` (1.5 s) after the last, eased in over 0.15 s and out over
  0.5 s, at full at once on the first reading after the goggles come down. Sam's wand has its own reading (the lens is in another place). Nothing is
  saved: the reading starts again after a load. `irShowsAt` (the threshold's 'his flood would show a man there') stops at 12 m under the rule: past it
  nothing brings his light on. Moonlit ground reads about 0.6 through the tube, so outdoors at night no light burns. COST: the lights are steady lights
  (above), so a light that is out costs the frame nothing — the five shadowed spots are now only in the picture where a place is dark; the rule's own
  cost is CPU: 8‥19 µs a reading, at most 78 readings a carrier every 0.25 s (0.4‥0.8 ms measured for a whole fan, headless). Row: 'IR light ▸ only
  where it is too dark'; `irLightSummary` says 'off (light enough here)'. The performance sweep's GOGGLES stand (`tools/qa/perf-sweep-page.cjs`) holds
  the rule off so that its lane still measures the light. QA `probes.ts irl-auto` (21 scenarios, the places taken off the level: Sam where everything
  he could look at inside 13 m is light — none burns, the rule off and it does; on black floor — burning inside 0.1 s, full by 0.5; back in the light
  — out at the hold and its fade; the team over four seconds — a goggled man on black floor has his, one with no black floor in sight keeps none; the
  one-light brightness line; the stand): ALL PASS on both stands and on the frozen stand with both words raised, `IRAUTO_BREAK=1` (every place reads
  dark) RED on both (shipped: a light place for Sam in 8 of 21 scenarios, black floor in 11; teammate-frames on black floor 1,290, all lit; with no
  black floor in sight past the hold 581, none lit). The other four irlight probes pin the rule off (they check the light that burns whenever goggles
  are down); the family 89 verdicts on each stand, `nvg` 188 on each, `IRLIGHT_BREAK=1` still red on both. Page check, software adapter (very low,
  960×540), `MODE=yard node tools/qa/irlight-page.cjs <out>` (the pass, four teammates, hard, where the maintainer's shot was taken): the page as it
  opens 0 lights burning and the frame's middle 146 of 255 through the tube; every light forced on at 8: 160, 3 % of the middle at the tube's ceiling;
  at 30: 180, 20 %. The depot's dark room (`MODE=room`): tube alone 119, with the light 156 and 0 % at the ceiling; at the old numbers 195 and 18 %.
  NOT MEASURED: no entry tally, tour or soak with the rule or the new power. NEVER SEEN ON A GPU, and only a player can judge: whether 8 is now too dim
  in a big dark room, the moment a light comes on walking from a lit hall into a dark room (0.15 s) and its fade behind him, a light that stays out
  when the only dark floor is one sliver or lies past 12 m, and whether five lights coming on at different moments reads as a team or as flicker.
  **By the light the picture has** (10-18; the maintainer, of the vault's strongroom — its own bulb off, the room plain in his goggles round a pool of
  his flood: "still feels like the IR light here is unnecessary"). WHY IT BURNED: the rule's question went to the CPU's light estimate
  (`lightEstimateAt`: direct light only, "no bounce"), to which every room with no lamp of its own is 0 — while the tube shows that room by what comes
  round the door frame and off the walls. SWITCH `IRLIGHT.meter`: ON in the page (`?noirmeter`), OFF in the module and on the frozen stand
  (`TPS_IRMETER=1`; `FROZEN_HOLDS`, standup pin, standEnv), in the journal's knob table (a recording from before the key replays with it off). Off =
  the CPU's estimate alone, the build before. THE RULE (`burn`, the `live` branch): the CPU's rule keeps the FIRST word — where it calls a place light
  nothing is asked — and the renderer's light meter (the probe pass: shadowed direct light + the radiance cache; it refuses the infrared bit, so no
  light of this file answers its own question) gets the LAST word on what the CPU calls dark: the floor under him by the meter key that already reads
  it every frame (`playerChest`, a teammate's `unitC<id>`; the wand's lens asks its own) and a spread of up to five (`IRL_METER.slots`) of the dark
  points his fan found, asked through `Game.lightQuery` on his beat under his own keys (`irl<id>:<slot>`) and read every frame (one read sequence a
  frame: the sensors' journal writes its key list at every change of it). A point is dark when the PICTURE of it is under `IRLIGHT.show` (0.1 of the
  tube's range; row 'IR light ▸ floor min' (a slider's label is cut at about nineteen characters)): the CPU's direct light + the meter's bounce × `settings.indirectScale` (0.35 — the meter's
  bounce is physical, the picture's is scaled in fgather.wgsl) through the tube's curve (`nvg.ts tubeSig`). A line of its own, higher than
  `NVG.blackAt` (where a MAN is lost to a goggled eye, about 0.035 of the range): direct light is well over that or nothing, bounce is every value
  between, and floor at 0.05 of the range is grain to the player; the maintainer's strongroom read about 0.3 in his shot. Under this branch the
  CPU's first word is asked by the same line. The same count decides (his own floor, or two of the points). A point not yet answered waits `IRL_METER.wait` (0.25 s, no light), then takes the CPU's word; the first reading that
  is decided still puts his light at full or out at once. WHERE NO RENDERER ANSWERS — headless, `SENSE.cpu`, a page before its first frame (Sam's own
  meter has no answer) — the CPU's rule is the whole rule at once, so HEADLESS NOTHING MOVES on either stand: every tally and digest is the build's.
  The question 'does the renderer answer' is one read of `playerChest` a frame, made only when somebody's goggles are down (10-18: read every frame it
  made eleven sensor reads a step of a goggles-up run on the shipped stand, and `replaybuf-probes.ts`, which plants 'no answer' on every eleventh read,
  then wrote that kind once in 1,800 steps and went red on its 'every kind' line; with nobody's goggles down this file reads no sensor).
  KNOWN EDGES: the meter also has carried white light, so a torch on the floor he looks at puts his light out a hold later; `irShowsAt` and nvg.ts
  `readPlace` still go by the CPU (a man in a bounce-lit room is read by his own meter, which has the bounce); up to five more probe places a
  carrier on his beat, only where the CPU finds dark (the probe has 64 a frame); in the page the fan no longer stops at its second dark reading
  (it needs them all to pick a spread), 0.4‥0.8 ms a carrier a beat as measured headless before. Row: 'IR light ▸ by the light the picture has'.
  QA `probes.ts irl-meter` (21 scenarios; no renderer headless, so its answers are PLANTED through the swapped `Game.lightAt`: on floor the CPU calls
  black with Sam's goggles brought down afresh — answered lit: not one frame of his light or a teammate's, and with the switch off it burns; answered
  dark: burning the frame his goggles are down, at full; 0.015 W/m²: dark at the picture's bounce scale, light with the scale at 1; the fan's points
  never answered: light 0.27 s after his question; nothing answered at all, or `SENSE.cpu`: nothing asked, light at once; floor the CPU calls light:
  nothing asked; at most ten points asked in a frame; forgotten with his goggles; the stand, the row, a recording without the key): black floor in
  11 scenarios, light in 7 (8 shipped). ALL PASS on both stands; `IRMETER_BREAK=1` (the switch held off) RED on both, 11 lines each. The family: 112
  verdicts on each stand, the three of the frozen stand with all three words raised 50; `nvg` 188 on each; `IRAUTO_BREAK=1` and `IRLIGHT_BREAK=1`
  still red (shipped). The five older irlight probes hold the switch off. HEADLESS NOTHING MOVES, checked: four scenarios, 900 frames each on the
  shipped stand, goggles down, the switch on and off — the same game digest and the same count of burning lights (2,719‥4,492 light-frames). Page
  check, software adapter (very low, 640×360), `MODE=vault node tools/qa/irlight-page.cjs <out>` (the maintainer's address, Sam in the middle of the
  strongroom, its bulb off): ALL PASS for who decides — the line at 0.02 and the renderer's answers put his light out where the switch off burns it;
  at 0.4 it burns; every answer planted dark and it burns. TOLD, not asked: on that adapter at that quality his light STILL BURNS there at the line
  as it ships, door open or shut — the dark points of his fan read 0.011‥0.025 W/m² at the meter, 0.05‥0.09 of the range in the picture (grain),
  while the floor under him in the door's light reads 0.34. The maintainer's own shot reads about 0.3 over that floor (80 of 255 where the lamp-lit
  counting room reads 202 for a computed 0.78‥0.90, and 100 in a court whose floor has no direct light at all): his GPU's picture has several
  times the bounce the software adapter's very low has, and by the picture's line his room is light. NOT RUN: the page check's yard and room modes
  after this change, a tour, a soak, an entry tally. NEVER SEEN ON A GPU, and only a player can judge: whether the meter on his GPU reads that room
  as his picture shows it (if his light still burns there, lower 'floor min'), a light that comes on for the darker half of a room
  as he turns, and a torch beam crossing dark floor putting his light out for a moment.
- **Silent or loud, on Sam's word** (`src/game/silent.ts`, 10-07; the maintainer: "some way of telling the squad to be silent or not. silent implies walking
  quietly, no flashlight, etc."; scope page rebuild/silent-order/scope.md): the squad's POSTURE, one order — `go silent` on **X, 5** of the
  floor's menu and of a man's (under the header 'the whole squad'; a door's menu keeps 5 for the door tools; the order fits any target through `give`), the row
  reading `go loud` in its place while they are silent (`standsIn`). Squad-wide whoever was addressed, it stays until he says otherwise, and it moves nobody:
  `OrderDef.free` = no owner is asked to release a man and it is NOT pushed to `orders.log` (the rescue starts its clock on his first logged order). Loud is the
  team exactly as it was: state lives in a WeakMap made on the first order, every rule returns on its first line otherwise (never ordered = ec3a2ec digest for
  digest over nvg-probes.ts `digest`), and `squadSilent` also wants `SquadOrders.active` (never a showcase's cast, never the tour). A silent teammate: legs
  capped at `SILENT.pace` 1.6 inside `guards.ts teamPace` (so every leg — orders, door tools, the fight AI; just over Sam's upright 1.55 so 'fall in' keeps up;
  it holds under fire unless `hotPace`); footfalls at `step` 0.2 in both treads AND in Hard's `pressure.ts teamBoots` (the only ears a scripted teammate's
  boots have); weapon light held off in `attachFlashlight` (goggles and IR stay nvg.ts's / irlaser.ts's by their own rules); his lines over the net (`say`:
  `net`); doors eased (the guards' DoorContact `quiet`, the door tools' shove a creak for the bash — the leaf's speed is untouched: a slow leaf shut on the men
  and the shove files no door event either way); no boot — a door locked against them is PICKED by the lead (`SILENT.picks`, on: `doortools.ts open()` → `toPick` / `pickStep` inside the 'kick' stage: 'locked. picking.', he kneels at the keyway (`anim.lockpick`) and runs the player's own `Doors.pick` — 4.2 s, clicks at 0.16, the snap at 0.3, filed for hearing under his id — then back onto his jamb and the order goes on as at an unlocked door; hands off while the fight has him (the fight AI's lease, blind, folded, or compromised with a gun on a man; ≤ `kickCap` + 3 s at a stretch); only a cylinder is picked (`pickable`: not steel, not a keypad's, not digin's wedge); a keypad's / a WEDGED door (on a squads level the defenders wedge on Standard too: roomfight.ts runs digInTick under `squadsLive`) is BOOTED once the squad has been compromised at any point since the order (`SILENT.bootWedged`, on: `silentBoot` reads the sticky `State.was`, not the 45 s `hot` the HUD word shows — 'wedged from inside. booting it.' once per door, beat 'silent boot', `SILENT_STATS.booted`, the posture stands), and never compromised ends the op as before with the line naming the fix ('… no quiet way in. go loud and we boot it.' — he gives the door again after his word; probe `silent-boot`); told loud / a loud tool / a captor's last warning mid-pick = `open()` asked again = the boot; steel is refused at the menu as ever; switch off = 'locked. no boot while we are silent.' and the op ends on the door); no cans
  by himself (`canFirst`, `thrCans` — on the word too: the pair's word reads 'go · step in · no bang'); FIRE HELD on a man who has not noticed the team
  (`silentHolds` at roomfight.ts's fire gate: not alert / searching, awareness < `noticed` 0.5 — the gun stays on him, 'eyes on. holding.'), and THROUGH STANDING GLASS on any man who has raised no alarm
  (`SILENT.glass`, on: `silentGlassHolds` right after `clearShot` — the line from his gun to the point on the man crosses a standing pane, `glasspen.ts
  glassOnLine`; held until he is alert / searching, a quiet gun too since the pane is the noise; a man held for glass is passed over for `GLASS_LOOK` 4 s
  in tickOp's scoring, so another man he may shoot takes the muzzle, and a man who has raised the alarm outranks any man he is only holding on; a loud squad shoots through glass exactly as before — unless it is sneaking with Sam unfound, when unseen.ts's `UNSEEN.hold` / `UNSEEN.glass` hold by this same rule; off = glass is nothing to a SILENT man's hold; `probes.ts holdglass`,
  `tools/qa/holdglass-tally.ts`). THE LOUD TOOLS stay
  on the menu marked ` · LOUD` (`LOUD_ROWS`: bangClear, charge, thrBang, through `SquadOrders.posture {word, mark, given}`) and picking one takes the squad out
  of silent with one line, as does `DoorTools.order('bangClear')` (a scenario's F). COMPROMISED = loud in a silent man's ears SINCE the order (`reached`:
  `fight.hotFor` ∧ `hotOf ≥ since`): said once ('compromised.'), shown in the HUD word ('SILENT · compromised'), and he then shoots whoever a loud man would —
  pace, lights, cans and boots stay as ordered. A captor at his last warning (`rescue.lastWarning`) un-holds rounds and the boot. The HUD: the squad block's
  header `squad · loud|SILENT · orders to …` (orders.ts `hud()`, read by both overlays — the native twin has it by construction). `SILENT.start` = the posture
  a FRESH cast stands up in (the loadout screen's knob; `setSilent(g, on, 'api')`); a man joining / leaving leaves his word standing. Knobs `SILENT` kept by
  teamfeel (Tab ▸ Team feel ▸ silent rows + `silentSummary`). **The QA harness stands the game up with `SILENT.on` false** (src/host/standup.ts, like chaos 0:
  the menu and the squad block as every older probe was written against); `probes.ts silent` (tools/qa/silent-probes.ts: order / hud / walk / doors / pick / cans /
  tools / fire / hush / start / off) turns it on. Not judged by anyone yet: how the walk, the dark and the net lines FEEL; the hold-fire rule in play.
  **A silent stack beside unaware men is set** (`SILENT.stackSet`, 10-13; a claim from the hold-fire goal, reproduced: a silent pair told `stack` inside a room with
  two unaware men stood 0.04 m off its marks with both guns on a man, never `arrived` — the row read 'stacking', 'set.' was never said): orders.ts's arrival test
  counts a silent man on his stack mark as arrived while `silentOnMan` says the man the room fight has him on is one the ORDER's own fire hold will not let him
  shoot (asked afresh, nothing counted; never a loud man — `holdFireOnMan` beside it is his), and stamps the assignment (`heldSet`); doortools.ts `testStacks`
  reads that stamp and keeps his hand off the handle while it is true (the stamp, not a fresh ask: testStacks runs before the orders' tick, and the frame the
  man is lost a fresh 'no' beside last frame's `arrived` tried the handle with the gun 2.3 rad off the door). Only the order `stack` (entries never waited on
  it: `waiting()` has its own clock), only the fire hold: a round held for glass alone, or by spotted.ts / the pair's 'watch him', still reads 'stacking'. ON in
  the page (`?nosilentset`), OFF in the module and on the frozen stand (`TPS_SILENTSET=1`; `FROZEN_HOLDS['SILENT.stackSet']`). The journal: `SILENT` joined
  `JOURNAL_KNOBS` with this key (knobs-check wants every table the page's boot writes carried) — a recording from before it has no SILENT row and replays with the
  key off and the posture's other rules as the process has them, as they always did; a new one carries the whole table. QA `probes.ts silent-set` (in the
  `silent` family; green on both stands; `SILENTSET_BREAK=1` fails the rule's lines on each): set at 18 s frozen / 17 s shipped with 'set.' once and no round;
  the key off = 'stacking' for 38 s; a locked door under `DOORTOOLS.testDoor` is not tried while held on a man, is tried only with the gun back on the door once
  the men are gone, and is tried with the room empty (control). One seed, one room, headless: never seen on a GPU, never played. No Tab row.
- **The way to a man's back is read by the moon its walker stands in** (`sneak.ts sneakWalk`, `SNEAK.stalkAmbient`, 10-13; tape quiet-as-two 052432 at 1:35.7: on 'take him on my mark' Blue One walked 1.7 m of moonlit yard through Novak's view — the stalk's light was the CPU estimate, 0.000, `lightEstimateAt` has no moon; his own meter read 0.46‥0.56 — Novak alert at 1:38.0, Sam down at 1:39.9). The stalk's steps now read the estimate PLUS the walker's own meter over the estimate of where he stands: all of it on open ground when he stands on open ground (`weather.underRoof`), by a crumb's proportion where he or the step is under a roof; meter = estimate changes nothing. The excess is taken off the LOWER of his eased meter and what it reads this frame (`Guard.irradiance`), so a meter still falling after he steps out of a lamp pool is not read as light on the dark way (stateless: replays and loads read the same).
  ON in the page (`?stalkambient=0`), OFF in the module and on the frozen stand (`TPS_STALKAMBIENT=1`); a `FROZEN_HOLDS` row; journal: the key rides in a recording's `flags` (its tables never carry `SNEAK`) — no flag = off, a flag = as recorded. QA `probes.ts pairup-one-eye` (d): six lines, green on both stands, `STALKAMBIENT_BREAK=1` fails two (the roofed line and the lamp-pool lag line are labelled controls; the lag line fails on the rule as it was before the lower-of-two).
  Measured on that one tape, re-run by hand on its own input (no seeds, no tally): rule off he walks and Novak is alert at 1:38.0; rule on `stalk()` is exposed by Novak at 1:35.7 / 1:36.6 (cost 2.27 / 1.55 against 0.12) and from the order on he holds at (22.9, 20.4), 'waiting · Novak is looking across the way to Reyes'. At 1:37.4 the rest of the way is already out of Novak's view (cost 0).
  LIMITS: it is the light of where he STANDS — from under a roof's edge or a wall's moon shadow the yard ahead still reads dark until his meter rises (one stalk read, 0.3 s, later); a per-cell CPU moon by the collision's shadow test disagreed with the taped meter at his own spot, so none is used. Nobody has played it; never seen on a GPU.
- **A follower is not left standing on the walk of a man who comes to a sound** (`sneak.ts sneakComing`, `SNEAK.noiseWalk`, `noiseWalkM` 2.5, 10-19; a
  claim left by the breaker mend, `WORK.offWalk` in squad.md: "the same hole stands for any suspicious man who walks to a noise where the follower waits").
  The sneak's follower waits short of a stretch a defender is looking at until that man's back is turned; a man WALKING at him never turns it, and the
  follower was walked into. ON in the page (`?noisewalk=0` off; the debugger panel's row 'off the walk of a man coming to a sound'), OFF in the module and
  on the frozen stand (`TPS_NOISEWALK=1` raises it; `TPS_NOISEWALK=0` puts it off on the shipped one); SNEAK is a journal table, and a recording from
  before the key replays with it off. Off = the build as it was (`sneakComing` is then `workComing` alone, asked where that was asked). With it on, a man
  counts when he is suspicious, has no errand, no body to see to, is not held to a post or in Sam's arm, has none of them in view this moment (a sighting
  inside `SPOTTED.freshSecs`: that is spotted.ts's to answer, still and low), is still on his route, the route ends at the place he means to look at, and
  what is left of it passes inside `noiseWalkM` of the teammate with nothing solid between. For THAT man the breaker man's manners hold: while Sam is going
  on the follower crosses after him instead of waiting, does not keep him as a remembered looker, does not back off down the way he is coming, and is not
  stood still by spotted.ts's freeze. With the key on, ANOTHER man's eyes are asked on their own (the read of a step names only the first looker it
  meets): a second man watching the stretch, or the follower where he stands, holds him as before — for the breaker man's walk too. NOT counted: a man
  on an errand other than the breaker (a device, a rack, a colleague's route), the found-body script, a man who has arrived and is looking round.
  KNOWN, not built: no test of how far off the man still is (a lit stretch is crossed now for a meeting ten seconds away); the crossing follows Sam's
  steps wherever they go; `noiseWalkM` is wider than the eye's near field (`nearM` 2.1). QA `probes.ts sneak-noisewalk` (`tools/qa/noisewalk-check.ts`,
  8 lines, green on both stands; `NOISEWALK_BREAK=1` fails 3 on both): the breaker check's own stage (lights out as two, the mains thrown, Sam walks
  on) with ONE thing staged by hand — the errand taken off the man sent to the panel and his interest kept up as a whistle keeps it, so he walks there
  as a man who heard something (one sound alone lets a man talk himself out of it inside about ten metres). Key off: the follower stood still on the
  walk 2.6 s (frozen) / 3.4 s (shipped) and the man was alert 11.2 / 11.7 s after the throw; key on: nobody roused, the man passed 2.0 m off, the
  follower low on 581 of 585 frames and at Sam's shoulder at the end, the game's own asking answered yes 53 times. RUN beside it, green on both stands:
  the families `sneak`, `spotted`, `workthings`, `pair`, `pairup`, the `lights-out` run; knobs, rollback (static) and dice checks. MEASURED: the paired
  sneak (`tools/qa/pair-sneak.ts`, shipped stand, records-pair and room-clear-pair, seeds 433-480, arm pair), key on against off: all 96 pairs identical
  by run digest — on those two levels the scripted sneak never meets the case, so the tally says the key costs nothing there and nothing about what it
  gains. One stage, in the dark, one seed; the lit case has no check. Never seen on a GPU; nobody has played it.
- **A squad nobody has found sneaks when Sam sneaks** (`src/game/unseen.ts`, 10-10; the maintainer: "if we're not compromised and i'm sneaking around to get into a better
  position, my teammates should do the same"; page rebuild/teammates-sneak/read-first.md). NO ORDER: a LOUD squad reads the player. Sam sneaks = not
  sprinting and (crouched, or on a wall hold, or pace ≤ `paceAt`), `linger` 1.5 s after he stops; the squad is FOUND = `g.fight.hotFor` any living squad man (a shot, a bang or
  a kick in his ears) or any guard hostile to it in 'alert' / 'search'. `unseenLive(g)` (cached per frame, per-Game state in a WeakMap) is both; `unseenMan(g, gd)` = that for a
  squad man NOT in a live door op (an entry Sam orders is never slowed or held). Seams: orders.ts's follower leg (`unseenWallSlot` = a place along Sam's own wall face behind
  him, one side per hold, never past Sam, a knee where there is no place or a window behind the chest; `unseenFollow` = Sam's pace plus what closes the gap, low with him;
  `unseenPost` for move / cover) and silent.ts's rule functions, each `silentMan ? the order's own rule : unseen's` (pace cap, footfall level, hush, eased doors, the fire hold
  on a man who has not noticed — `unseenHolds` — and through standing glass until he is alert — `unseenGlass`; the squad line reads 'loud · sneaking'). THE SWITCHES ARE PER
  POSTURE: `SILENT.holdFire` / `SILENT.glass` are a SILENT man's alone; for a loud squad sneaking with Sam the hold and its glass half are `UNSEEN.hold` / `UNSEEN.glass`
  (counted in `UNSEEN_STATS.held / heldGlass`, never in `SILENT_STATS`). A SILENT squad nobody has found follows Sam's sneak the same way in its CARRIAGE (the orders.ts seams
  ask `unseenMan`, whatever the posture: low with him, his pace, his wall), keeps the order's own rule functions term for term, and a crouched silent man's footfall is
  min(`SILENT.step`, `UNSEEN.lowStep`) — the ordered squad is never the louder one in the same crouch. `UNSEEN.lights` (teammates' lights follow Sam's) ships OFF. Switches `UNSEEN.*` in the
  knob registry; `?nosneakwith` = all of it off, `?sneakfire` = no fire hold. The FROZEN stand holds `UNSEEN.on` off (`TPS_UNSEEN=1`); the shipped stand has it on. QA:
  `bun run tools/qa/unseen-probes.ts [follow|wall|hold|entry|idle|all] [arm]` (pair and four, office and records; each check in its own process, raising the switch itself; passes on both stands — under `TPS_PROFILE=shipped` the doors' manners hand a wall place in an open doorway's lane back, `UNSEEN_STATS.wallLost`, and the man is off the face on a knee: the office's corridor by the lobby arch; on a short run of face — a furnished room's — the place is on the side with room and a file on the other side of Sam is not walked past him to it, `UNSEEN_STATS.wallPast`, a knee where they are; the probe's wall search tries 3 m, then 2 m, then 1.5 m of clear face either side).
- **An unfound squad never fires first** (`src/game/holdfire.ts`; the maintainer: "while nobody has found the squad, nobody fires until you do or you order it, whatever your
  posture"). While nobody has FOUND a LOUD squad, a teammate's round at a man who has not noticed anybody is held — gun on him, 'eyes on. holding.' — walking or sneaking; a man
  who is himself alert / searching or past `SILENT.noticed` may be shot by the teammate on him, and a captor's last warning holds nothing. `HOLDFIRE {on, liftSecs 45, glass,
  quiet}`: ON in the page (`?noholdfire`), OFF in the module and on the frozen stand (`TPS_HOLDFIRE=1`; `FROZEN_HOLDS['HOLDFIRE.on']`, in the knob registry and a journal's
  tables — a recording from before the key replays with it off); Tab ▸ Squad ▸ Silent squad ▸ 'unfound squad holds fire'. THE THREE SEAMS: the fire gate = silent.ts `silentHolds` /
  `silentGlassHolds` → `holdFireHolds` / `holdFireGlass` (a loud man only, after unseen.ts's own answer; `HOLDFIRE_STATS` counts only holds that are new by this rule); an order =
  orders.ts `give` → `holdFireOrder(g, id)` for the ids in `LIFT_ORDERS` (every door tool, `go`, `fragThere` / `stunThere` by name), nightbreach.ts `order()` 'go' →
  `holdFireDrill`, doortools.ts `goMen` / `blow` and wallcharge.ts `blow`; Sam's round = combat.ts `fireWeapon` → `holdFireShot`. A lift is for the whole squad, lasts `liftSecs`
  after the last shot or order and while a door order is being WORKED (`working()`: also a rescue on the clock, the F drill going in); `restartEncounter` resets it. FOUND is this
  file's own test, `holdFireFound`, STRICTER than unseen.ts `squadFound`: loud in a living teammate's ears (`fight.hotFor`), or a defender alert / searching WITH a real sighting
  (`Guard.lastSeenT` ≥ 0) — a man 'alert' because he planted or dug in on a noise, having seen nobody, ends nothing. WHAT DOES NOT LIFT: Sam's ring / sponge round (the 40 mm HE
  lifts at its burst, by being loud), a plain stack, a tool given on the word until the word (`{ onWord }`; its op is not 'worked' while it waits), a charge until the blow
  (`BLOW_ORDERS`). With it on `?sneakfire` alone no longer makes a sneaking squad shoot on sight (add `?noholdfire`), and a quiet gun is held too. QA: `bun run
  tools/qa/holdfire-check.ts` (`probes.ts holdfire`; passes on both stands, counts every team round and measures 'unfound' itself; `HOLDFIRE_BREAK=1` must fail);
  playthrough.ts `out.holdfire` = the stats, `--set '{"HOLDFIRE":{"on":false}}'`. Not saved (snapshot / restore exported). Never played by anybody. A plain `stack` set beside a man the rule holds: orders.ts counts a man on his mark as arrived while `holdFireOnMan` says the man the room fight has him on is one THIS rule will not let him shoot (the rule's own conditions asked afresh, no stamp: it stands through a change of man, Sam in his line and Sam low with the sneak's hold answering; never a silent man), so 'set.' is said once and the row reads 'stacked' with the guns still on the man, and doortools.ts `testStacks` keeps the lead's hand off the handle while it is true (no rattle for the held man to hear) — holdfire-check's two C lines (the second on a locked door with `DOORTOOLS.testDoor` raised), `probes.ts orders-stack` breakroom_n #4 sets at 13.6 s headless under shipped with its muzzle line reading '2 held on a man'; a moment with no man in his sight and his gun not yet back on the door still reads 'stacking'; never seen on a GPU. `HOLDFIRE.loud` (10-13, the maintainer: "loud" itself means weapons free "only for a squad that was silent and is told loud"; on with the table, no URL flag or env word of its own, as `glass` / `quiet`; a recording without the key replays with it off — journal.ts `applyKnobs`): the menu's 'go loud' given to a squad that IS silent lifts the hold as a fire order does (orders.ts `give` asks `holdFireSilent` before the row is issued; never a squad that was loud, a loud tool's row, a new cast or `setSilent` by any other road) — and while that lift stands (`liftSecs` from the order: its own stamp `loudT` in the rule's state, carried by `holdFireSnapshot` / `holdFireRestore` and cleared with the lift's) `holdFireLoud` keeps the sneak's hold (unseen.ts) from answering first at silent.ts `silentHolds` / `silentGlassHolds`, so Sam low when he says it frees them too; no other lift touches the sneak's hold — holdfire-check's seven L lines, the first and the crouched one red under `HOLDFIRE_BREAK=1`, and `probes.ts holdglass-release` 'told loud' green under shipped; headless only, never played, never seen on a GPU. The stack's handle test reads a STAMP, and any man's (10-14; two claims from the silent stack's review, both reproduced headless under shipped: the frame the held men went down the lead tried the locked handle at step 0 with his gun 2.50 rad off the door, and with only the second man held the lead, his gun on the door, tried it): orders.ts stamps `A.heldFire` every tick (on his stack mark with `holdFireOnMan` true, his gun on the door or not; `arrived` is still that fresh answer) and doortools.ts `testStacks` waits while the lead's fresh answer OR `stackHeld` — any man of that door's stack so stamped, not one down, yielded to the fight or no longer arrived — says held; the silent stamp (`heldSet`) is still the lead's alone; holdfire-check's two further C lines (the men gone: tried only with the gun back on the door; only the second man held, the lead dazzled: not tried), never seen on a GPU. Both mends have a sub-key of their own, on with the table like `glass` / `quiet` / `loud` (no flag, env word or frozen-stand row), so that a recording from before each replays as made: `HOLDFIRE.stackSet` off = nothing asks `holdFireOnMan` for arrival or the handle (a held man is 'stacking' until his gun is the door's and the lead tries the handle, the build before the set), `HOLDFIRE.stackWait` off = the handle waits on the lead's own fresh answer only (the build before the stamp; it means nothing without `stackSet`), and journal.ts `applyKnobs` gives a recording with no HOLDFIRE row both off, one whose row lacks `stackSet` that key on only when the row has `loud` (the set joined the played build in the same step as `loud`), and one that lacks `stackWait` that key off — holdfire-check's three further C lines (stackSet off: not set, set once raised; stackWait off: the handle tried once with the second man still held; the journal control), headless only, never played, never seen on a GPU.
- **The partner's quiet orders, four mends** (`src/game/pairorders.ts`, 10-13; three claims from the quiet levels): `PAIR.sweep` (+ `ringM`: floor a
  standing man's swinging look reaches is a PRICE on the way to a back, never an exposure verdict), `PAIR.keepWay` (the way is kept up to 6 s; a new one
  only when over 20 % shorter), `PAIR.habitStood` (a man who has just stopped is read as he stands: the way he mostly faces follows in the seconds stood,
  0.5 to 6), `PAIR.lookBack` (a watched hold stays held while the watcher has only turned his head: "he'll look back. your call.", F still sends him; it
  lets go when he turns for good, when the light goes off what he would see, or when he walks). All default on, off = as it was; a recording without the
  keys replays with them off (`journal.ts applyKnobs`); not frozen-stand holds (`PAIR.on` is). Check: `probes.ts pair-watched` (the look-back scenes, each
  red with its fix out; green on both stands). Measured headless, scripted: relay station ways flips 3 to 5 a run down to 0 to 2 over 12 starts; the
  border hold 0.6 to 3.9 s up to tens of seconds on one F; relay quiet runs 5 of 18 done before and after. Never played, never seen on a GPU.
- **Each man's own picture** (`src/game/picture.ts`, table `PICTURE`, 10-14; the maintainer, of two teammates who stood off a wall charge in a known
  enemy's line: "each actor has ideas of where other enemies are (which may be out of date), where is safe, what good cover points are"). Every fighter of
  both sides keeps an IDEA per enemy: the place he last saw him, heard him fire or was told of him, and when. It is never refreshed from the truth (a man
  who walks off unseen leaves his idea where it was); a place he has looked at, could make out and found empty marks it LOST; a man down out of his sight
  is believed up until he sees the body or is told. His net tells him (the squad's radio with Sam's own eyes on it, the staff's, a defender squad's men or
  a defender inside `shoutM`): only what a man saw or heard himself, `tellSecs` after he knew it, as old as it is. The rules ask `exposedAt` /
  `exposedFor` (is this spot in a believed enemy's line, weighed by the idea's age, with the places he may have walked to since), `safestSets`, `coverNear`.
  WHAT ASKS IT TODAY, each its own key: `PICTURE.standoff` (a door charge's stand-off file: of the files the wall has room for, after the room rule, the
  first no known enemy has a line to and the men can walk to AS DEALT, the row's own walk test `standoffWalk`; `doortools.ts standoffPosts`; the open
  menu re-asks it each `ORDERS.refreshSecs` and with an enemy known that is every file's lines again, the walks kept by orders.ts under a second),
  `PICTURE.cover` (a pinned man's shift, `suppression.ts coverFrom`: the first fit hidden from EVERY enemy he knows of, the place as it was dealt if there
  is none; one pass) and `PICTURE.wall` (the wall charge's stand-off out of known fire, the squad good sense goal's `WALLCHARGE.outOfFire`:
  `wallcharge.ts knownFoes()` is the fog's record AND, for a man the fog does not give, where the squad's pictures have him inside the same
  `fireKnownS` — `knownPlaces`: heard firing, told of, remembered across a loaded game; a union, so that goal's `standfire` lines stand as written; with
  the fog off its rule still counts every living enemy where he stands, which is theirs) and `PICTURE.flee` (getting off a live grenade, either
  side's men, `frag.ts fleeSpot(…, who)`: a spot the blast has no line to loses `fleeCost` (8 of a hidden spot's 100, four metres of leg) times how
  far it is in a believed enemy's line, asked of the man down at the spot through `exposureAsker` — the ideas dealt once a deal; a spot past what
  his legs make pays it whole, so the rule never sends him to one he barely reaches; the leg he is on pays only for a firm line, half or more, so an
  ageing idea does not turn him round under a burning fuse; never a spot in the blast's line for it; `fragStepOff`, the scripted commander walking
  Sam, passes no man and is as it was) and `PICTURE.fallback` (a defender giving his room up, `roomfight.ts breakOff`: the door he leaves by and the
  spot he holds it from are judged against every enemy he has a FIRM idea of — `believedOf`: not seen empty, no staler than `staleSecs` — not the one
  `threatOf` point, which still returns what it did: a door within 3 m of a believed man, or whose far side a step out is in the straight line of
  one he has fresh word of and is not already in, is passed over; his walk passes within 2 m of none, along the legs and not only at the corners; of
  the nine spots beyond a door the first no believed man has a line to, the first as it was if its walk does not hold; a door with a hidden spot
  before a nearer one without; no door left = `coverFrom`, as when there was none. The rally branch, `D.movedAt`, the door branch's writes and the
  counts are as they were: `stats.fallBackOut` counts up to the first spot that fits; with ideas only stale or seen empty no door or walk is barred,
  but they still weigh, less, in the lines asked of the spot and the door's far side) and `PICTURE.stack` (a stack's marks, `orders.ts stackSeen`
  round the whole chain inside `stackPosts` / `stackPostsWait`: where the marks HANDED OUT sum 0.5 or more of `exposedFor`, the chain is asked again
  with the whole order filed on one hand of the door — `fileHand`, read in `stackPostsLeafIn`, where `stackFileOn` builds the file under the same
  boxes as the marks it replaces and never where those were null — and the file is given whose marks as handed out sum to `stackK` (0.5) of the
  dealt ones' or less; the latch hand on a tie; no hinge-hand file on the face the leaf opens toward; a place counts only on the room's floor
  (`stackRoomHas`), by the three-line seam test, off furniture; never more lines through glass than the marks replaced, nor a place behind glass
  that was not; on a door that stands open a hand is offered only if no man of the order stands on the other; men who stand on their marks at the
  door are dealt the marks they stand on, the file included, and nothing is chosen afresh; off for another cast; the trial asks put the makers'
  counters and the room rule's book back and the answer is the winning trial's own). NOT YET: hold spots,
  the open doorway of an uncleared room on a flee (the squad gear goal's call for the maintainer), and every all-seeing read the
  audit lists (`rebuild/own-picture/what-each-rule-knows.md`, 58 rules). Switch `PICTURE.on`: ON in the page (`?nopicture` = the build
  as it was), OFF in the module and on the frozen stand (`TPS_PICTURE=1`; shipped off = `TPS_PICTURE=0`); a `FROZEN_HOLDS` row, in `knobs.ts`, a recording
  without the table replays with it off (`journal.ts applyKnobs`), a snapshot / restore pair in `savestate.ts` (ideas, downs, each man's look phase, the
  calls' clock). THE VIEW (`src/ui/pictureviz.ts`, a debug view: `?picture` = the man under the cursor, `?picture=all` = every teammate's ideas, or the
  debugger's 'Picture' section): a ring where he BELIEVES each enemy to be (coral eyes, amber ears, blue told; fainter with age; broken = looked and
  gone), a dashed circle for how far the man may have walked, coral dots on the floor he counts as in a line, green rings on cover he rates. Drawn from
  the draw, it deals nothing the rules read (`VIEWING`). Checks: `probes.ts picture` (`tools/qa/picture-check.ts`, 19 lines: his own, told, both sides,
  out of date, safe, cover, lost, by ear, the save slice, down, the stand-off file at a door, the cover shift, the grenade flee, the stack's hand,
  the fall-back, the wall charge's known enemies, memory alone moves no digest; `PICTURE_BREAK=1` fails 17) green on both stands; `PORT=<port> node tools/qa/picture-page.cjs` (the real page on the software adapter, view on and
  `?nopicture`, no page error; some eight minutes a page). MEASURED 10-14, headless, shipped stand: `command-tally --hands b,plan --scn
  room-clear-four,killhouse-four --seeds 1-6` with the switch on and with `TPS_PICTURE=0`: 24 runs each, not one run differs (end, seconds, men,
  hits, rounds). In six traced runs the stand-off rule was asked in one (48 asks, the same file) and `coverFrom` was never called: nobody in a room
  fight takes the pinned shift. So the two rules move no scripted fight; the memory fills (a run: 20 to 58 seen, 16 to 38 heard, up to 32 told, 4 to 14
  lost). Gates green on the tree: journal, shipped, doortools, wallcharge, roomfight, suppression, picture. Never played, never seen on a GPU (the
  view's colours and weights are guesses). `soak` (3 seeds, 12 minutes) and `tour` on the shipped stand are the same with the switch on and with
  `TPS_PICTURE=0`, their standing reds included (soak seed 3 standoff-far twice; tour 0 of 3 at stop2-wide, stop5-stun, stop7-thrown); frozen tour 3
  of 3. STEP 2, the same day (`PICTURE.wall`; a routed gunshot placed in the two-metre square it came from, as guards.ts places one near its source,
  not at the listener's doorway; 'he is not there' passed on the net; the door file's walk test): the same 24 runs on and off again, none differs — no
  scripted hand orders a wall charge, so the evidence for the wall rule is the check's line (m) and `probes.ts standfire` green on both stands with the
  rule on. A change to `wallcharge.ts knownFoes` runs `probes.ts picture` as well as `standfire`. A recording without `PICTURE.wall` replays with it off.
  STEP 3, the same day (`PICTURE.flee`): the same 24 runs, on against `TPS_PICTURE=0`: 2 differ, by under a second each (plan killhouse-four seed 5
  76.9 s → 77.0 s, plan room-clear-four seed 2 64.2 s → 63.4 s); every end, man, hit and round the same, and the off tally byte for byte step 2's.
  Grenades are rare in those hands: 13 of the 24 runs see one, 22 bursts, 23 flees dealt, and the rule changed the spot in 2 (the two runs that differ). `probes.ts frag` green frozen with `TPS_PICTURE=1`, shipped, and shipped with
  `TPS_PICTURE=0`; line (n) holds the rule (the spot differs, is out of both lines, the rule off gives the old spot, a leg to the new spot is kept,
  a leg into a firm line is left, the asker agrees with `exposedAt`). A recording without `PICTURE.flee` replays with it off. A change to
  `fleeSpot` runs `probes.ts picture` as well as `frag`. Never played: nobody has watched a man pick the longer leg.
  STEP 4, the same day (`PICTURE.fallback`): `ships.ts --hard --scn room-clear-four,depot-four,barracks-four,warehouse-four,compound-four --seeds
  1-8`, on against `--set '{"PICTURE":{"fallback":false}}'`: 5 of 40 runs differ (room-clear-four 5; barracks-four 3, 7, 8; compound-four 3), every
  end the same (26 taken, 13 wiped, 1 other both ways); teammates standing at the end 68 → 64 over the 40, seconds 4750 → 4882, defenders left 62
  both; the room fight's own counts: fell back through a door 25 → 23, took cover in the room 7 → 10. So on Hard it costs the squad a man in four
  of forty runs and no mission: five runs is a small sample, read it as a direction. Line (o) holds the rule on a stand of its own (a man believed
  on the spot: the same door, another spot out of his line; a man believed in the doorway: another door or cover; the rule off: as it was). A
  recording without `PICTURE.fallback` replays with it off. A change to `breakOff` runs `probes.ts picture` as well as `roomfight`. Never played.
  STEP 5, the same day (`PICTURE.stack`, `stackK`): a sweep of every door face with marks (`stackPosts` and `stackPostsWait`, two men and four),
  an enemy believed at each floor cell in sight of a mark: room-clear-four frozen 1376 asks, 62 answered with a file on 20 of 80 faces (shipped 1368,
  44, 12 faces, 4 on the hinge hand); depot-four 1936, 66 on 22 of 104 (shipped 1868, 140 on 26, 78 hinge); barracks-four 4698, 250 on 46 of 216
  (shipped 4472, 324 on 44, 120 hinge). No ask answered null, no mark off the room's floor, no ask with more lines through glass; the only non-lead
  marks in a doorway (10, barracks, frozen) are marks the walls' own answer has there too. Frozen deals no hinge-hand file: its doors swing both
  ways. So the rule is rare: an eighth to a quarter of faces can get a file at all, and most asks with an enemy in a mark's line keep the walls'
  marks (no hand at half the lines). Cost, room-clear-four, per ask: 0.03 ms the rule off, 0.04 nobody known, 0.12 a trial that deals no file,
  0.15 a file (shipped 0.07 / 0.14 / 0.29 / 0.20). `ships.ts --scn room-clear-four,killhouse-four,depot-four --seeds 1-8`, on against
  `--set '{"PICTURE":{"stack":false}}'`: 1 of 24 runs differs (depot-four 4: 125.7 → 119.8 s, three teammates standing → four), 22 taken and 2
  wiped both ways. `PICTURE_STATS.filed` / `filedHinge` count the files handed out. A recording without `PICTURE.stack` replays with it off. A
  change to the makers of stack marks runs `probes.ts picture` as well as `pairs`, `handleside`, `stack-inway`, `glasstune`, `stackroom-check`.
  Never played: nobody has watched four men file on one hand, nor the entry that follows from a file.
  STEP 6, 10-15 (`PICTURE.step`; tuning `stepAt` 0.5, `stepFree` 0.25, `stepM` 2.5, `stepAfter` 0.6, `stepRest` 1.5, `stepSecs` 5; `?picstep=0`
  puts it off, the debugger's Picture toggle too): built on a lean while the maintainer was away — his call 1 on the own-picture page; HE HAS
  SINCE PLAYED THE BUILD WITH IT ON AND SAID KEEP (10-18). Two places the squad chose for itself are left when a man learns an enemy
  has a line to them. (1) The file behind Sam (`orders.ts` follow pose → `pictureStep`): Sam standing, a follower whose place (where he stands
  when that is his place, else his slot) has been `stepAt` or more exposed for `stepAfter` s walks to cover inside `stepM` that no believed enemy
  has a line to, standing or on a knee, hidden a foot either way, a straight walk from the place, never up to a believed man. He goes back when
  nobody he knows of has the place (`stepFree`), gives a cover up that he cannot get onto in `stepSecs`, and the step is over the moment nobody
  asks (Sam walks, another order, the fight AI has him). Not a man with a target, not one `cover.ts` has stepped to watch a door, not the silent
  squad, not a man keeping a door or held short; a spot Sam pointed at is never bent (call 2: lean no, not built). (2) A wall charge's stand-off
  marks (`wallcharge.ts repick`, with `safe` and `outOfFire`): while the charge waits for the word, a man whose mark is under known fire at two
  asks a second apart is dealt the least-fired place `safePosts` has, if nobody can shoot it or it is two steps of `underFire` better — once a
  man, by a walk no deeper into the blast than he stands, four searches an order at most. Lines (q) and (r) of `probes.ts picture` hold both
  (the tape's wall on The pass: Blue Two fire 5 → 3, the other two keep theirs). `ships.ts --scn room-clear-four,killhouse-four,depot-four
  --seeds 1-8`, on against `--set '{"PICTURE":{"step":false}}'`: 4 of 24 runs differ (all depot-four), 22 taken and 2 wiped both ways,
  teammates standing 68 on, 64 off, 4 steps taken. `--hard`, five levels, seeds 1-8: 4 of 40 differ (all depot-four), 25 taken on against 26
  off (depot-four 1: wiped at 27 s on, taken with one man off), teammates standing 68 on, 69 off, 7 steps. So it is rare in a scripted fight and
  its direction is not settled: a small gain on standard, one mission the other way on Hard. `PICTURE_STATS.stepped` counts both kinds; a run's
  JSON row carries the counts (`playthrough.ts` `picture`). Not built: a door charge's stand-off dealt again, stack marks, hold and entry
  points, the enemy's side, the floor view drawing the step. A recording without `PICTURE.step` replays with it off. Never played, never seen
  on a GPU: nobody has watched a man leave the file for cover, nor whether it reads as sense or as fidgeting.
  STEP 7, 10-15 (`PICTURE.shot`; `?picshot=0`, the Picture toggle): built on a lean while he was away — his call 3, the first of the enemy's
  all-seeing reads; HE HAS SINCE PLAYED THE BUILD WITH IT ON AND SAID KEEP (10-18), the next read to go with it (step 8). His call 2 is answered too: a spot
  he points at himself (move there, hold) never bends to cover — nothing is built for it, and nothing should be. `guards.ts colleagueFirePos` used to hand a man who heard a colleague fire the TRUE place of the colleague's target, through
  any wall. Now he gets the shooter's own idea of that man, at its own age: the hearer's picture takes it as a call, his fix is stamped with the
  idea's time (so the search, the frag and the squad's 'freshest fix' read a stale word as stale), and he keeps what he works from when his own
  word is the newer or the shooter has seen the place empty. A shooter with no idea of his man, a show (`g.touring`: no pictures are kept), the
  rule off: as it was. Line (s) holds it. Same runs, on against `--set '{"PICTURE":{"shot":false}}'`: standard 1 of 24 differs (room-clear-four
  8: three teammates standing at 51 s on, one at 110 s off), 22 taken both ways; Hard 13 of 40 differ, 25 taken and 13 wiped both ways, teammates
  standing 68 on, 74 off. On Hard 42 of 1766 hearings got a place a metre or more from the truth and 710 kept their own newer word; on standard
  none of 327 was off and 146 kept theirs. So the place handed over is nearly always right (a man firing mostly sees his man) and what changes a
  run is the hearer keeping his own fresher fix; the squad does not come out better for it in these runs (six fewer standing over 40 Hard runs
  that go both ways: read as noise, not as a gain). `PICTURE_STATS.shotPlaced` / `shotOff` / `shotKept` count hearings, one a hearer. The other
  all-seeing reads the audit lists are untouched (step 8 takes the next). A recording without `PICTURE.shot` replays with it off. The
  measurements are of the branch before its last merge of the build head.
  STEP 8, 10-18 (`PICTURE.run`; `?picrun=0`, the Picture toggle 'a runner: only who HE knows of'; off on the frozen stand with the rest of the
  picture, no hold of its own): THE MAN WHO DROPS HIS GUN AND RUNS GOES BY HIS OWN PICTURE — the second of the enemy's all-seeing reads to go.
  `runner.ts` planned his whole run round every living enemy's TRUE place, through any wall: the floor he may reach (`flood`), the outside nobody
  has a line to, the corner farthest from them, the dear cells of his way (`route`), the look ahead for a man in it (`wayBarred`), the wall he
  turns his face to. With the rule each is reckoned from `known()`: every idea his picture still holds (seen, heard fire, told before he ran;
  the picture forgets at `forgetSecs`) but a place he has since seen empty, each man where he BELIEVES him. So a man he knows nothing of bars no
  way of his until he sees him, and then the look ahead (every `replanSecs`) turns him as it always did; a man who walked off after he last saw
  him is still steered round where he was. THE WORLD'S OWN RULE KEEPS THE TRUTH: he is taken off the floor only when no enemy truly has a line
  to him, and is low while one has. Stopped outside with a man's eyes on him he looks about him and HAS that man (a line runs both ways:
  `pictureTell` of the true watchers on the `retrySecs` look), so he goes on to floor that man cannot see instead of sitting in plain view. From
  the drop on he is off his side's net in the picture too (`picture.ts onNet`, as netquiet.ts and enemysquads.ts have him): he is told nothing
  and calls nothing; what he tells his mates he shouts (runner.ts `tell`, unchanged: the place the enemy stood when he broke). `runnerBreak`,
  the seam that starts a run directly, reads the nearest man he KNOWS of for that place. The run's own geometry is kept (one ray from the eye to
  1.2 m over the cell, `shyM`), so on against off differ in WHO is known and nothing else. Line (t) of `probes.ts picture` holds it on both
  stands: an enemy he knows nothing of standing on his way turns nothing; a man he was told is there turns it though nobody is; a word he has
  forgotten, or a place seen empty, turns nothing; out and stopped, watched by a man he did not know of, he has him, moves on, and leaves the
  floor only out of that man's line; the rule off, the true place turns the way and a told one does not. `PICTURE_BREAK=1` fails it with the
  rest (21 of 23). `runner-check.ts` passes on both stands with the rule on: its player who is teleported out to the yard is now a step the
  man is TOLD of (a walk he would have watched). `PICTURE_STATS.ran` / `ranOff` count the ways planned from a picture and those planned on one
  that was not the truth. MEASURED, and it tells little: `ships.ts`, seeds 1-8, standard (room-clear-four, killhouse-four, depot-four) on against
  `--set '{"PICTURE":{"run":false}}'`: 24 runs, none differs; Hard (five levels, 40 runs): `ran` is 0 in every run, as on standard — the scripted
  commander never baits a man dry at arm's length, so NOBODY RUNS in these fights and the rule is never reached. What holds it is line (t) and
  the runner's own check. A recording without `PICTURE.run` replays with it off. Never seen on a GPU, never played:
  nobody has watched a man run past a teammate he had not seen.
  WITH IT, A MEND TO STEP 2's COVER RULE (`PICTURE.coverHard`, a key the journal carries so an older recording replays as it played; no flag,
  no toggle): `suppression.ts coverFrom` kept ONE fallback place while it looked for cover hidden from every known man, and with rounds passing
  thin walls (wallpen.ts) that slot went to whichever kind came first — so a man with no place hidden from everybody could be dealt a spot the
  shooter's rounds go through in place of the hard cover he had before either rule. Now a place that STOPS the shooter's round though another
  known man has a line to it is kept over a thin one (a slot each; the upgrade may spend plans only while eight of the twelve are unspent, so a
  later place hidden from everybody is still reached). Line (l) was red on the shipped stand for it at the build head and is green; its staging
  no longer believes the second enemy on the pinned man's own spot. MEASURED, the same runs with the mend against without: none of 24 standard
  and none of 40 Hard differs (21 and 30 taken both ways), so it is rare in a scripted fight; the check line is what shows it.
- **No wary mark over a man of your own** (`src/ui/headmark.ts headMark`, drawn by `overlay.ts`; the maintainer, 10-16, of the yellow dots over
  his squad: telegraph a man's state through his animation instead). The row of yellow dots (`awareness`) and the yellow '?' (`search` /
  `suspicious`) are the stealth game's read of a man who may find you out. A teammate under an order runs no senses, so nothing drains his
  number: whatever a stun can (0.6), a frag that left him up (0.92), a charge's backblast (0.6) or the mains going (0.34) wrote stood over him
  as dots for the rest of the mission. A LIVING OPERATIVE now carries neither mark, nor the '◎' of a man who has you lined up (his '!' in a
  fight is a plain one). Unchanged: every mark over a defender, a civilian's own marks, and over a teammate the '!' of a fight, the '✹' of a
  stun (in the yellow it had) and 'zz' / '✚' / '✕' on the floor. NO SWITCH: the HUD only — nothing the simulation, a save or a digest reads.
  NOT MENDED HERE: `Guard.awareness` is written on a teammate as before, and what reads it off every man still does (guards.ts `tension`,
  the score's intensity: a teammate a frag left at 0.92 holds it at 0.32 until his order ends); a teammate's speech bubble kept the wary
  yellow while he was left searching — MENDED 10-17 by the dialogue pass, the same way and with no switch: `bubbles.ts bubbleTone` gives a living man of the
  player's own the calm tone while he is searching or suspicious (the red of a fight stays his, as his '!' does; a defender's and a civilian's tones as they
  were); the check's lines (2b), the defender's bubble line and the bubbles.ts line say so, and `HEADMARK_BREAK=1` puts the yellow back with the marks. Check `tools/qa/headmark-check.ts` (`probes.ts headmark`, family `ui`; the same on both
  stands; `HEADMARK_BREAK=1` puts the marks back and lines 1, 2, 2b and 3 must fail) asks `headMark` what would be drawn over each man of a staged
  room clear; `tools/qa/headmark-page.cjs` reads the marks off the real page on the software adapter. Never seen on a GPU, never played.
- **A man's condition: a blast that leaves a man standing leaves him HURT** (`src/game/condition.ts`, table `CONDITION {on, hurtPace 1.5, hurtSup
  0.35, hurtSecs 0, ownCalm, looks}`; ON in the page, `?nocondition`; OFF in the module and on the frozen stand, `TPS_CONDITION=1`; in the knob registry
  and the journal's tables, so a recording from before it replays with it off). The maintainer, 10-16: telegraph a man's state through his
  animation, "effectively just a health system ... but with very high lethality", "apply that system across the board". ONE MODEL for the
  player, his men and the defenders: `conditionOf(g, man)` = {shaken, blind, folded, hurt, down}, read off stamps the game already kept on both
  `Guard` and `Player` (`sup.v`, `dazzledUntil`, `staggerUntil`) plus the one new stamp, `hurtAt` (-1 = never). NOBODY GAINS A ROUND: how a man
  goes down is not touched (`Player.MAX_HITS` 1, a defender and a teammate one round each), there is no count of anything, and a condition only
  ever takes something from a man. WHO IS HURT: a man `frag.ts blast` reports 'wounded' (a frag, a 40 mm, the bomb a defuse lost: in its line
  inside `woundM`, and the dice left him up). NOT a 'shielded' or 'stunned' man, not a civilian, not a man the debugger keeps whole, not the
  player in god mode, nobody while a showcase runs (and `isHurt` reads false for its length). A door charge, a wall charge and the player's own
  charge fold and blind as they did and leave a man SOUND (a call left with the maintainer). WHAT IT COSTS, for the rest of the mission
  (`hurtSecs` 0; > 0 = it wears off): PACE, an AI man is never asked for more than `hurtPace` — `conditionPace` inside `teamPace`,
  `stepAlongPath`, tactics.ts `stepGate` and the two planners that pick the corner a man can reach from a grenade (frag.ts, squadthrow.ts);
  the player loses his sprint (player.ts: Shift is not a run for him, so it stops no reload and lets go of nothing). SPREAD, his rounds open as
  if fire were on him at `hurtSup` — `conditionSup` (the larger of that and the fire really on him) asked by `guardFireMods`, `samSpread` and
  the room fight's / the covering man's own line; how FAST he fires is not touched; with `tune.suppression` off nobody's rounds open, his
  included. `looks` (true): the figures are dealt each state's look; false = the model and its costs with nobody showing it, QA's lever for
  what the looks alone do to a run. `ownCalm`: guards.ts `tension` no longer counts a teammate's `awareness` at rest (nothing drains it under an order: a frag held the
  score's intensity up for the mission) — with the switch off it counts it as before. Saves: `hurtAt` is an optional key written only for a
  hurt man, so an older save loads and a save with nobody hurt is byte for byte what it was. The panel: `condition ▸ you hurt · Reyes folded
  hurt` (`Game.conditionSummary()`). HOW IT SHOWS is the poses' (docs/agents/anim.md, "A man's condition on the figure"), and with them on a
  stunned teammate's '✹' is gone from the HUD (`headmark.ts`: `CONDITION.on` and `MOVES.on` and `MOVES.dazzle`; a defender keeps his; headmark-check
  line 3b). Checks: `tools/qa/condition-check.ts` (`probes.ts condition`, which also runs `condition-pose`; twelve lines — off, on, the fold's
  seconds unchanged, pace through followPath / stepAlongPath, the player's sprint, spread and the gap, one round still downs each of the three
  while hurt, god mode, the score, a checkpoint, who is not hurt, the registry; `CONDITION_BREAK=1` leaves the switch off and eight lines must
  fail), ALL PASS on both stands; `tools/qa/condition-page.cjs` on the real page (software adapter). MEASURED on the shipped stand
  (`ships.ts`, 21 loud missions on seeds 1 and 2, the rule on against `--set '{"CONDITION":{"on":false}}'`; the commander there plays in god
  mode, so the player is never hurt in it): a man was left hurt in 2 of 42 runs (4 men) — grenades are rare, so what hurt costs is the check's
  to show, not this tally's. Ends on / off: taken 24 / 23, wiped 10 / 11, rescued 5 / 5, lost 3 / 3; teammates up 80 / 81 of 148; defenders
  left 65 / 63 of 294; mean 84.0 / 82.7 s. THE LOOKS MOVE A RUN: 34 of the 42 play out differently by digest, 32 of them with nobody hurt — a
  figure's head and muzzle are where the simulation reads them, and a man under fire now tucks 10 cm. Six of those replayed with `looks` false
  equal the switch-off digest run for run; with `ownCalm` false, the switch-on one. NOT SEEN, NOT PLAYED: nothing
  of this on a GPU; nobody has played a mission with a hurt man in it; `hurtPace` and `hurtSup` are first numbers.
