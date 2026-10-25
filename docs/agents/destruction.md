# Destruction, glass, particles

One of the area files CLAUDE.md indexes. Everything below was moved here word for word from CLAUDE.md on 2026-10-13, in its old order;
"the bullet above / below" in a bullet means its neighbour there (each block says which lines it was), and a bullet named by its bold
title may now live in another file of this folder: `grep -l '<title>' docs/agents/*.md`. New bullets for this area go at the foot of this file.

<!-- was CLAUDE.md lines 271–318 -->
- **A wall charge goes on an OUTER wall** (`WALLCHARGE.outer` in `src/game/wallcharge.ts`: on in the page, `?noouterwall` = off = every outer wall refused in words as before;
  frozen stand off, `TPS_OUTERWALL=1`; Tab ▸ Destruction ▸ Walls and cover rows). `outerWall(g, i)` = structure up to `outerThick` 0.26 m (the levels' shells are 0.24), not steel, ≥ `outerMinLen`, with the open
  sky over ONE face (`skyFaces`: nine upward `col.solidBlocked` rays off each face — the 1 m roofed-cell map is wrong for shells, roof slabs overhang) or over both with
  `outerYard` (yard / perimeter walls). `wallAt` then answers `ok` + `outer` and every verb of the partition's charge is the same (X · 5 · 3, Sam's Space row 'wall · outer wall',
  F). NOTHING is indexed up front: at `blow()` the engine takes that one wall on (`wallbreak.ts adopt(index)` → a `hard` Breakable, 0.5 m columns of sill + upper) and
  `BlastOpts.breach` opens `WALLS.blast.minHole` columns floor to top — rounds, grenades and any blast that is not THE charge set on it never touch a hard wall
  (`round` / `workLeft` / the blast loop skip it), and a holed one takes another charge only while the switch is on. The ROOM FIGHT's rooms do not pour through the hole:
  the nav cells a breach opened are `walls.shellGaps`, a barrier to `roomfight.ts roomAt`'s flood like a doorway with no door (a partition's hole still joins its rooms). Its pieces are `breakTable.ts` row `blockwork` (no Surf maps to it; `shedCell` / `heap` take it by name). A restart lets hard
  walls go (`reset`); a checkpoint carries them (`WallsSave.b[i][3] = 1`, `restore` adopts first). Unused, on = off by digest; a partition charge digests the same either way.
  Checked by `bun run tools/qa/outerwall-probes.ts` (three maps × sites / squad / sam / hard / rooms / inside / off / reset / live; `probes.ts outerwall` = block-squads) on both stands.
  Not done: no wind gust through a breached shell, `cleared.ts` does not re-flood for one, the hole is floor to top (no lintel).
  **FURNITURE AGAINST THE FAR FACE IS NOT 'NO FLOOR BEHIND IT'** (`WALLCHARGE.farFurn`: on in the page, `?wallfurn=0` = the nav grid as it stands is the only answer, as it was; frozen
  stand off, `TPS_WALLFURN=1`; a `FROZEN_HOLDS` row; a recording from before the key replays with it off; no Tab row): `settle()` tries every slide under the plain rule FIRST, so a place
  that had floor is the place it was; only where none has does `farFloor(W, true)` ask `mouthAfter`: `furnblast.ts Furniture.firstToGo(at, src)` = the ONE group the blast breaks first
  (the nearest in its plan's order — the chunk budget is whole for it; nothing is promised of a second piece, so a piece on the squad's OWN side nearer the charge still means a refusal),
  and then, for EVERY middle the hole could have (`farSlack` 0.5 m either way of the charge, inside the wall's own length — the engine lands it on its columns), a point within `farReach`
  0.375 m of that middle (holeAt's own search) whose near cell at the face, the wall's own cell, the cell behind the far face and the far cell (`mouthIn` in), all at that ONE place along the wall, will be open — and on the near side there is floor a man can stand on TODAY, in the cell at the face or the next one out (sandbags against the near face shut both): open today, or shut only by this wall (its box or, once holed, the pieces standing
  in for it — compared by the engine's id) with what is left of it beside the hole clear of the bake's circle, and, on the far side, by parts of that first group the blast takes from the
  hole's far mouth (`floorAfter` → `NavGrid.cellBlockers` → `wouldTake(first, i, mouth)`: in the shatter band, a line from the mouth; of a long run — a LIVED-IN room's cot is one: the bedding and locker dealt onto and beside it are one piece with it — the floor-standing parts in the
  band and what those hold up, fixed()'s own rule with the shorter reach (`rowTake`); never a cover panel). Shared with the blast so they cannot drift: `chargeSource(radius)` (destruction.ts asks it too), `chargeAt(W)`; the hole's columns are NOT shared (the check
  is the link). The barracks' south wall between bunks 3 and 4 (static 52, a cot against it inside each room, a partition between them) was refused along its whole length; now a charge
  asked at its middle settles half a metre along, over one cot. `bun run tools/qa/wallfurn-check.ts` (`probes.ts wallfurn`, also under `wallcharge`; every squad mission's and squad
  lesson's level + the office, twelve, ~40 s: a place the plain rule accepts is the same place with the rule on — 0 moved; EVERY place the rule adds is really blown — 76 on the frozen stand, 85 under `TPS_PROFILE=shipped`: RUN IT ON BOTH, the lived-in furniture is only on the second, where the first cut took half the barracks wall and one place with sandbags across the near mouth — and must leave
  a man-sized hole, floor behind it and a short walk through; the barracks wall off / on, a second charge beside the first's hole, the four ordered through it; `WALLFURN_BREAK=1` must
  fail; `--baseline` = the same asked of the plain rule's own places). Cost: a refused place's `settle` ~40 µs a frame while the cursor is on it, and the furniture index is made on the
  first ask (1–4 ms once). KNOWN, the plain rule's and not this one's: a place accepted on floor DIAGONALLY behind the charge (du ± 0.4) can still blow with no way in (a mess table hard
  against the far face, the end of another wall behind the charge) — `--baseline` counts them.
  **…NOR IS WHAT THE BLOWN HOLE ITSELF CLEARS** (`WALLCHARGE.farMouth`, on in the module — it acts only with `farFurn` and while furnblast.ts `FURN.mouth` is on, so the frozen stand is as it
  was; false = the furniture index alone; a recording from before the key replays with it off; no Tab row, no URL flag; the maintainer, 10-11, on Mousehole from the yard: "still seeing no wall
  behind it"): the promise above knew only the furniture INDEX, and a blown hole clears more than the index lists (`mouth()`: things over its size bars, whole, with what rests on them). The
  ward's cots are 0.706 m³ against the index's 0.7, so its west outer wall was refused 'no floor behind it' along six metres although every place of it opened a way in when blown. `floorAfter`
  now also passes a far-side cell shut only by things `Furniture.mouthWouldTake(i, zone)` says go (mouth()'s own tests through shared helpers `mouthMine / mouthOk / mouthStack`, or a thing
  resting on one; zone = the narrowest hole at that middle, `FURN.mouth.depth` out from either face, half a step short at each end; whether a thing is takeable is kept for the frame). Mousehole
  as shipped: 712 → 752 of 770 asks accepted, the 29 places the rule adds all blown to a way in. THE BLAST KEEPS THAT PROMISE whoever takes the support first: what rests on a thing another rule has already taken out of the zone (a shelf the wall engine's capped fall dropped, its binders left in the air — the warehouse's shelving, found by this check) goes with the hole too, and a thin thing is a 'post' only if it is tall in itself. Held by `wallfurn-check` (Mousehole's
  own lines: the wall found, refused by the index alone, accepted with the clearing counted, the four ordered through it from the yard; on the frozen stand: the promise says no more than a
  blast that clears nothing; `WALLFURN_BREAK=1` fails them). A refused place costs ~50–120 µs an ask.
  **THE SAFETY RADIUS** (`WALLCHARGE.safe`: on in the page, `?wallsafe=0` / `?nowallsafe` = the old radii exactly; frozen stand off, `TPS_WALLSAFE=1`; Tab ▸ Destruction ▸ Walls and cover ▸
  'wall charge ▸ larger safety radius'; a `FROZEN_HOLDS` row, a journal from before the key replays with it off). Two radii, each a pair [the charge's face under open sky, under a roof] —
  `chargeIndoors(g, W)` = nine upward solid rays off the charge's own face, the level's geometry only; `safeRadius(g, W)` is the one place both are read: the squad's STAND-OFF 2.6 / 2.0 m →
  `safeStandoff` 4 / 6 m, and the REACH inside which the blast catches a man on the charge's side with a line to it, `DOORTOOLS.backblastM` 1.6 m → `safeReach` 3 / 5 m (a teammate dazzled
  `safeSecs` 3 s at the wall easing to 1 s at the edge, where it was a flat 1.5 s; never a hit point, nobody knocked down). The marks (`safePosts`): along the wall at the stand-off or, within
  `safeHideM` 9 m and `safeWalkM` 16 m of walking, a place with something solid between it and the charge (round a corner, out of the room) — those first, the open floor straight back only to
  fill; A DOOR LEAF IS NEVER THAT SOMETHING SOLID (`noLeaves`: the blast flings it or takes it off its hinges — a mark behind an open leaf 2.85 m from the charge was dealt on block-squads (OLD floor); the marks, the too-close warning and 'no room' ask with the leaves out, the blast itself with them where they stand), NOR IS A PANE OF GLASS, the cover has to hold 0.4 m either way of the mark (a man stops within a stride of it), and never a place the lead cannot walk to (the far side of a locked door). EVERY MARK IS ON FLOOR THE SQUAD HOLDS (`ours`: the room the charge is set from, a room `g.cleared` knows, or open floor — and the walk to a hidden mark keeps to such floor: the nearest place out of the blast's line is very often the next room, and on block-squads (OLD floor) that sent all four into the mess among three defenders); where the floor has neither, the old marks (which ask none of this), and the man who calls it says "can't get clear of it. your call." in place of 'stood off.' — as he does whenever a man of the order is inside the reach at the call (the order is never refused for it; the
  `mateM` refusal is unchanged). BACK AT THE HOLE WHILE THE BLAST STILL HOLDS THE ROOM (`WALLCHARGE.safeBack`, on in the module, `safeBackM` 9; acts only with `safe`, so the frozen stand is as it was; false = the marks and the wait as they were; a recording from before the key replays with it off; no Tab row, no URL flag; the maintainer's replay of Mousehole, 10-13: a charge set from inside the held ward stood all four off out in the north yard and round the building, the first man back at the hole 7.9 s after the blast, the stun spent): a hidden mark is taken only within `safeBackM` of WALK from the charge (it was `safeWalkM` 16) and the marks are dealt nearest by that walk first (they were dealt by the straight line: through a wall is near); where the floor has not a mark a man inside that, the old marks and "can't get clear of it. your call.", as ever; and with nobody of the order caught by the blast the men leave their marks ON the blast (`blowWait`: `afterBlow` 0.7 s is the time before anybody is AT the hole, less their walk at the team's pace) where they stood it out on marks 4‥6 m back. Mousehole's ward → exam partition, shipped stand, first man within 1.5 m of the hole · the last, off → on: charge low on the wall 5.2 · 6.3 → 2.8 · 4.3 s (all four west of the building → one in the ward out of its line, three just outside the hole), mid wall 3.9 · 5.0 → 3.4 · 4.3 (the same four yard marks, the wait alone), high on the wall 3.3 · 8.2 → 1.9 · 3.6 (no four places inside 9 m: they stay in the ward, are told so, and are blind 1‥2 s); the defenders there are blind 2.7‥5.1 s and folded 2. What is left of the delay is the indoor radii themselves (stand-off 6 m, reach 5 m: with `safe` off the first man is at the hole in 1.8 s). Mousehole's wall tallies in this file were taken before it. KNOWN: the warning asks with door leaves out and the blast with them where they stand, so a shut leaf can warn of a man the blast then spares; whoever stands BEYOND the wall inside the stun's reach of where it will open is named too (`behind(c)` → ' · behind the wall: you, Red Two' on the row, Sam's F line and the squad note: a teammate who walked round, and Sam while `SAMSTUN` is on — blow()'s own far-side rule asked with leaves out from three points along the far face, so it can name a man the blast then spares, never the other way); the WALKS a wall's menu row asks (`orders.reach`, the hid posts' `findPath`) are KEPT between that menu's 1 s re-reads (`keptWalks`: one Map per open menu, used only when the row is asked of the menu's own target object, thrown away when its stamp moves — keys / codes / locked leaves / rooms known / wall + geometry serials / the nav grid's hash — and at reset / stop; every line and distance is asked afresh, and an order GIVEN plans afresh, so the marks cannot turn on it; `WallCharge.keep.on` is the checks' handle for the paired run, not a knob; `probes.ts wallkeep` = rows, digests and marks equal kept and not kept + the far-side names); 'the charge's side' is a half-plane, so a man past the end of a short wall counts. SAM inside the reach (`blastShare`, 1 at the wall → 0 at the edge): knocked along the blast (`anim.hitFrom`), no round or throw for `samSecs` 2 → 0.6 s
  (`fireCd`), his suppression filled from `samSup` (his spread opens, it decays as ever) and the hit flash — all state the Player already had and a checkpoint already carries; the log line
  ends '· you were too close'; with `SAMSTUN.on` he is also BLIND the seconds a teammate there gets (the samstun bullet). Every row that offers the trigger says who is inside (`tooClose`: '… · too close: you, Red One' on the menu row and Sam's F line, '· TOO CLOSE: …' on the squad block's note).
  Checked by `bun run tools/qa/wallsafe-check.ts` (`probes.ts wallsafe`, also under `wallcharge`; the office + block-squads (OLD floor) + Mousehole's ward for the walk back: indoors / outdoors read, marks over every site, a man and Sam in
  and out of the radius, indoors further than outdoors, the tight room, the mark behind a locked door, no mark in a room the squad has not been in with the defenders in place, switch off = the old marks and reach; `WALLSAFE_BREAK=1` = the switch left off and the same lines asked: must fail); `probes.ts wallcharge` is green on the frozen stand AND under `TPS_WALLSAFE=1` (its squad line takes a man who crosses past the hole's own record where the blast took the wall too — men stood off further come in at a slant —, its refusal forces the safe marks away as well, its trigger row may name who is too close; blastfeel asks each puff's line on the frame it is made). On a level named by `--scn` (never the two it runs by default) whose every room is too small to get clear in from a fresh start, its played-in-a-room line is staged again with the building taken — every room known, the defenders off the floor — and says so. THE SQUAD BLOCK COUNTS CARRIED WALL CHARGES: `wall charges N` (wallcharge.ts `hudNotes`) while the run brought wall charges of its own (`WallCharge.carried` not null, more than none brought: `setCarried`, or whatever else raises the run's count); no line under the whole-bag rule, whose count is the door tools' own 'charges N' (`probes.ts wallcharge-cost`); read as the count stands — a HUD read never re-syncs the roster. Numbers never played by anybody.

- **The men who stand off a wall charge keep out of the fire of the enemies the team knows of** (`WALLCHARGE.outOfFire`, 10-14; a mend from the
  maintainer's play of The pass, his F7 tape: "the two guys move away from the wall charge to a place that doesn't make sense (isn't safe since there are known
  enemies that can shoot them from there)"). The switch: ON in the page (`?standfire=0` = the marks as they were; debugger row 'wall charge ▸ stand off out of
  known fire'), OFF in the module and on the frozen stand (`TPS_STANDFIRE=1`; it acts only with `WALLCHARGE.safe`, itself held: `TPS_WALLSAFE=1
  TPS_STANDFIRE=1` raises both); a recording from before the key replays with it off. THE CAUSE, read off a headless re-run of his tape: a charge on the bunk
  room's long wall from the yard; `safePosts` dealt the three nearest safe marks along the wall past its end, at (27.2 / 26.3 / 25.4, 18.7) — across the lane of
  the bunk room's west window, a quarter metre off the line of the man in that room Blue One had called 9 s before. No enemy was in the sum at all. THE RULE:
  `safePosts` looks for no new place; the same places (along the wall, hidden out of the blast's line, back across the floor) are DEALT IN ANOTHER ORDER —
  the ones no known enemy can shoot first, then the least under fire (`underFire`: per known enemy inside `fireM` 30, the share of six lines a round can take —
  glass passes — to the chest and head of a man on the mark and the chest of one `fireStep` 0.5 m either way, over his distance, in whole steps of `fireGrain`
  so a stride's worth of difference does not buy a longer walk); the hidden places' few walks are spent twice over, on the unwatched ones and then on the
  watched, so a floor whose unwatched places are all too far a walk still has every place the search had without the rule (the review's find: one budget
  starved the near corners and dropped the squad to the old 2.6 m marks). THE WALL ABOUT TO GO IS NO COVER where it will open: a line that crosses it inside
  the hole's width (`WALLS.blast.radius × holeK`) with nothing else on it either side is a line, so the floor square in front of the charge is the lane of
  whoever is known behind it (the review's other find: those fan marks scored 0 behind the very wall being blown). Out of the blast still comes
  first: a mark under fire is taken before a mark in the blast, and where every safe mark is watched the men still stand on one. KNOWN (`knownFoes()`, the
  one place the file asks it — the seam the per-man picture goal swaps): a living enemy in the team's picture now where he stands, or seen in the last
  `fireKnownS` 30 s where he was last seen, off the fog's own record (`fogofwar.ts sighting(gd)`, a new read-only query; a man the squad is shooting at —
  `firedOn` — counts where he stands); with the fog off or standing aside the picture shows everybody, so every living enemy counts where he stands. With
  the men's own pictures on (`PICTURE.wall`, `picture.ts knownPlaces`; `?nopicture` off) and the fog up, known is that record AND what the squad's men
  saw, heard or were told inside the same 30 s, less anybody whose place one of them has since seen empty: a man heard and never shown is stood off from
  too (a change to `knownFoes` runs `probes.ts picture` as well as `standfire`). A door
  leaf stops a line where it hangs (the blast test strips leaves; this one does not); bodies, loose props, smoke and the dark stop none. On his tape's moment the marks become (25.4, 18.7), (24.5, 18.7) and
  (27.8, 20.3) — worst 3 steps of fire where it was 5 — or, with Sam not standing on it, the one unwatched pocket of the yard first. THAT YARD IS WATCHED
  NEARLY ALL OVER by what the team knew (the tea room's window, the bunk room's west window): the rule picks the least bad safe floor, it does not find
  floor that is not there. The check: `bun run tools/qa/standfire-check.ts` (`probes.ts standfire`, family `wallcharge`), twelve lines on both stands, his
  moment staged on The pass with the team's knowledge written as the tape had it; `STANDFIRE_BREAK=1` fails six on both. Cost: the open menu's re-read
  asks it afresh, as it asks every line — whether a hidden place is watched at all stops at its first clear line, the full count is taken only of the places
  that reach the deal (the tape's plan with three known enemies: 12 to 13 ms against 6 with the rule off, on this container). NOT DONE: the men do not re-pick when an enemy shows up after the
  marks are dealt; a checkpoint load forgets what the team knew (the fog's record is not saved: for `fireKnownS` after a load the marks are dealt on what is
  seen now); an enemy only HEARD is not known; the walk TO a mark is not judged; they still wait with their backs to the charge whatever watches them; the old (`safe` off) marks are
  untouched. Never seen on a GPU; nobody has played it.
- **The men with Sam step back from a charge set on a wall** (`WALLCHARGE.menClear`, 10-16; the maintainer, The pass, the trigger's row reading TOO
  CLOSE with two of his men named: "after i place a wall charge, my guys should move away with standoff"). The cause: a man on 'fall in' keeps his place in
  the file behind Sam, and Sam at the wall's foot puts the whole file inside the radius; only an ORDERED charge dealt stand-off marks. The rule
  (`wallcharge.ts clearOf`, asked by `orders.ts` in the fall-in branch every step): the place a follower would take — where he stands when that is his
  place, his place in the file, or the step cover / his picture gave him — in the line of any charge on a wall and nearer than its stand-off distance (4 m outdoors, 6 m indoors, less
  `menClearIn` 0.1 m: wider than the reach the row warns by) is swapped for a stand-off mark: the same marks an ordered charge deals (`safePosts`: along the wall past the radius, out of the
  blast's line, back across the floor, only on floor the squad holds), clear of EVERY charge on a wall, the nearest to him that nobody else has or stands
  on (an ordered charge's men keep theirs) and that he can walk to; no mark left = straight back from a charge to its stand-off where that is floor he can
  walk to; none = he keeps his place, the row still names him, and he is asked again a second on. A kept mark that a second charge puts in ITS line is
  dealt again. Asked LAST in the fall-in branch, of the place the lines above it settled on (a rear man keeping a door: where he stands; the silent
  squad's man: the sneak's own goal), so with nothing on a wall or the switch off the branch runs as it did. He keeps the mark until his place has been
  clear `menClearS` 0.75 s (Sam walking away with the file behind him, or the charge blown / off the wall), then falls in as before. Pace `ORDERS.brisk`
  (never a sprint); the silent squad and a squad nobody has found at `ORDERS.walk`, low with Sam. It outranks the cover step, the picture step and a rear
  man keeping a door; it does not outrank stepping out of Sam's way, a man the sneak has mid-crossing or a man held short in the dark. NOT in it: a man in a hot fight
  (the branch is not reached); a man on an order of his own (hold, a
  door, a pair's job) keeps it and the row names him; door charges set by hand; the blast's far side; the walk TO a mark is not checked against the
  blast. The switch: ON in the page (`?menclear=0`; debugger row 'wall charge ▸ men with you step back'), OFF in the module and on the frozen stand
  (`TPS_MENCLEAR=1`; acts only with `WALLCHARGE.safe`: `TPS_WALLSAFE=1 TPS_MENCLEAR=1`); a recording from before the key replays with it off; stat
  `wallCharge.stats.cleared`. Nothing of the player's own set / F row flow changed: one public method and two private maps on `WallCharge`. THE CHECK:
  `tools/qa/menclear-check.ts` (`probes.ts menclear`, family `wallcharge`), his case staged on The pass (four on fall in bunched at the bunk room's yard
  wall, a charge by 'Sam'): off, all four named; on, the row names only 'you' after 2.5 s (3.0 s silent, at 1.5 m/s), four on marks 4 to 6 m off, each
  dealt once; Sam clear → they fall in; Sam back → they stand off; a second charge by their marks → dealt again, out of both; a held man holds; the
  charge off the wall → the file closes up; journal and boot lines. `MENCLEAR_BREAK=1` fails six lines on both stands. Cost: the radius is read once a
  charge, the marks once (again when more men ask, another charge goes on, or two seconds on), then a distance test a man a step, a ray inside it. One site, one seed, headless: never seen on a GPU, nobody has played it.
- **The wall checks' stage on the REBUILT block** (10-13; `tools/qa` only — no rule of the game moved, no switch, no tally). The block's floor was rebuilt (every
  held room an L, one bare hall from the squad's start to the far end, lived-in things against walls) and the probes that pick their stage by a scan picked a bad
  one: `wallcharge-squad` / `-standoff` gathered the squad INSIDE the mess (the +side of the partition nearest the start) among its defenders; `wallreact-cover` /
  `-port` / `-hole` (shipped stand also `-flank`, `-crate`) stood their defender at a hall face the squad looks down from its start, where he was shot, at a corner
  where one blast opens two walls; `wallsafe` asked three places that each stand alone where its part (3) deals four together; `wallbreak-off` read the furniture
  rule's work at its wall as the wall engine's. WHAT THE SCANS NOW ASK: `wallcharge-probes.ts partitions` works a wall from floor no living defender's room
  (`fight.roomAt`) before its other face and lists such places first; the squad probe's man 'in view down the room' is looked for to either side where a room runs
  along the wall, and its man 'out of view' is also out of the squad's line from where it gathers and from every stand-off mark; `wallreact-probes.ts spots` puts
  a CLEAN place first — neither face in a teammate's line of fire from the start, and `Destruction.wallsFor` listing no wall but its own for a charge against either
  face or a stride off it — and does without one where a level has none (the next bullet: the two other floors); the crate probe passes over a crate
  whose blast lists a wall and a kneeling spot with no line to the crate's top, the block then has NOTHING to stage (low benches, things against walls, the loading
  hall's two panels beside the team) and `probes.ts wallreact-crate` asks the line on the compound (`wallreactCrate(level, orElse)`); `wallsafe-check.ts roomy`
  deals the whole staging; `wallbreak-off`'s 'tune.wallBreak off: the level stands' runs with `FURNBLAST.on` false, as `wallbreak-caps` did. `wallsafe`'s two
  block lines (the mark behind a locked door, no mark in a room the squad has not been in) needed nothing: the mess's wall on the loading hall and the hall's
  wall of the mess are where they were, and both deal the marks they dealt. CHECKED on the join with the build at e0d7d074, BOTH stands: `probes.ts wallcharge`
  (24), `wallreact` (6), `wallbreak` (14), `outerwall` (9), `furnblast` (8), `wallfurn`, `wallkeep`, `wallstun`, `wallissue`, `blasthole`, `doorstun`, `blastfeel`
  ALL PASS; both typechecks; knobs-check. What was still red then — four shipped families, and these two files by themselves on the compound and the warehouse —
  is the next bullet's. Headless only; nothing here is a picture, nothing was seen on a GPU.
- **The wall checks on the COMPOUND and the WAREHOUSE, and four old shipped reds** (10-13; `tools/qa` only — no rule of the game moved, no switch, no tally).
  `wallreact-probes.ts` and `wallcharge-probes.ts` run by themselves ask all three floors (the gate asks the block); the four families `breaks-overflow`,
  `coverfire`, `destruction-dust`, `destruction-impulses` were red on the shipped stand on the old floor too. EVERY ONE BUT THREE LINES WAS STAGING:
  - `wallreact-probes.ts spots` RANKS a place: 2 = out of the team's line and a charge at EITHER face opens that wall alone, 1 = the same of one face (the
    spot is handed over turned, so `blow` works from that face: in a narrow room a stride-off charge ports the wall behind), 0 = neither; the widest margins
    that hold a ranked place win, `spots(R, clear, true)` (the cover probe) takes the widest margins first. The crate probe passes over a crate whose burst
    lists a wall, one the man cannot kneel AT (no line from his spot to its top), and one whose own going does not open him (`withWallsOpen`).
  - `wallcharge-probes.ts`: `gather(p, secs, keep)` — a teammate fallen in within the menu's reach (`ORDERS.manM`) of the place on the wall Sam points at IS
    the cursor's target (his rows, not the wall's), so he is stood a stride off it and HELD, asked again until the file has stopped closing up (every gather
    passes the wall point; `blastfeel-probes.ts` too); `post(gd, p)` puts a defender AND makes the place his post in the room fight (the squad probe's three
    men: one the fight had falling back out of a lost room walked on into the hole's view from wherever he was put); the man 'out of view' is hidden from the
    whole mouth, not its middle; the menu probe looks for open floor out to six metres and asks the door NEAREST Sam; the reset probe waits for the camera
    after its teleport (150 frames).
  - `breaks-overflow`: with `EVICT.on` (the page) an evicted piece goes as chips BY ITS SIZE (`BREAKS.sizedChips`), 7 for the probe's slab, not the fixed 4 to 6.
    `destruction-dust`: with the one switch on, twenty rifle rounds at chaos 1 OPEN the plaster — the line asks the dust of a wall that stands
    (`tune.wallBreak` off for that part). `destruction-impulses`: whether a falling trunk meets the floor at the thud's speed is the pose's luck (the same
    stage 2.1 frozen, 1.2 shipped; a shot man the other way round) — men are dropped until one LANDS and every landing the ragdoll reports must queue its
    thud. `coverfire`: two of the page's rules answered its staging first — an unfound squad holds its first round (`HOLDFIRE`: the teammate under an order
    never fired) and a defender with a frag THROWS it at a man down behind a stack (the man runs, nobody is behind the stack) — both held out of the file.
  - the build's new racking bay in the block's loading hall (10-13, `tools/levels/block.ts` 'things to wreck') stands behind the wall `wallbreak-wallsfor`
    and `breaks-wall` charge: the furniture rule razes it through the hole by the wall engine's road — a row `wallsFor` does not forecast, by design, and at
    the small pool its binders take the slot of the wall's heap slab. Both charges now go off with `FURNBLAST.on` held false, as `-off` and `-caps` do.
  WHAT STAYS RED, AND IS THE GAME (reported, not mended here): (1) `wallcharge-hold [compound-four]`, FROZEN stand only — the wall place at (28.6, 17.9) deals its
  fourth stand-off post at (30.7, 14.7), 0.19 m from the c_n door's frame centre, with `WALLCHARGE.offFrame` 0.8 on (1 of 51 places; 3 with it off; the
  shipped stand's lived-in compound deals 36 places and none in a doorway. SETTLED since, in the CHECK: it is the rule's own written fallback, not a
  fault — `standoffPosts` tries each stand-off distance out of doorways and then, 'where that leaves no room for them all, the marks as they would have
  been'; at that one place neither distance (2.6 m, 2.0 m) deals four out of doorways, so it is dealt as without the rule (its marks with the rule equal
  its marks with `offFrame` 0; the nearer stand-off alone deals the same four; the page's `WALLCHARGE.safe` dealing never meets it: 36 places, none). The
  hold line now holds the rule to that word: a doorway mark only at a place dealt exactly as without the rule, at most one such place a floor, and fewer
  doorway marks than without it (frozen compound 1 of 3; the other five floor-stands 0 of 1 to 4); `OFFFRAME_BREAK=1` (the rule never on) fails on both
  stands, all three floors. Its limit, said in the probe: 'dealt as without the rule' is also what a rule that missed that one mark would look like — the
  module has no word for 'the fallback fired', and none was added. `wallcharge-probes.ts hold`, three floors: 19 of 19 frozen and shipped. A rule that
  would rather refuse the order, or send the fourth man further off, at such a place is a choice nobody has made);
  (2) `wallreact-crate [warehouse]`, shipped — `wallreact.take` keeps ONE pending question a man and the newest row replaces it: with the furniture rule on one
  blast files the crate's row and then the furniture's, he is asked about the second ('nothing beyond it to hide from') and stays kneeling in the open
  (MENDED since: the next bullet, `WALLREACT.everyGone`);
  (3) asked by nothing now that the spots are clean: when ONE blast opens two walls (a corner) a defender keeps a fraction of his door evidence across the re-flood (compound, shipped: 0.4 of 8
  doors' worth; the log reads 'rooms 3+8 flooded again → 4' and then 'rooms 4 flooded again → 4' five times — the cause is not pinned). CHECKED on the join with the build at e84a8149,
  BOTH stands: `wallreact-probes.ts` by
  itself, all three floors: frozen ALL PASS (81), shipped the one line of (2) red (80 pass); `wallcharge-probes.ts` by itself, all three: frozen the one line
  of (1) red of 262, shipped ALL PASS (262) — they were 9 of 253 and 28 of 227; `probes.ts` `wallcharge` (24), `wallreact` (6), `wallbreak` (14),
  `outerwall` (9), `furnblast` (8), `destruction` (10), `breaks` (11), `coverfire` (75 lines), `wallfurn`, `wallkeep`, `wallstun`, `wallissue`, `wallsafe`,
  `blasthole`, `doorstun`, `blastfeel` ALL PASS on both; both typechecks; knobs-check; dice-check. Headless only; nothing here is a picture, nothing was seen on a GPU.
- **One blast, one flood of the rooms** (`WALLREACT.blastFlood`, 10-13; a mend of a fault). `wallreact.ts tick` took the feed's rows one at a time and
  flooded the rooms again for each (`reflood`). A blast that opens TWO walls files two rows in one frame, and the first was flooded with the second hole
  already in the floor: the fill from a touched room ran on through that hole into a room the row never touched and stopped there as 'the same room'
  (`roomfight.ts roomAt`'s capped-fill rule), a room whose door list was still its old one; each defender's evidence, carried over door by door, was mapped
  onto that short list and what he knew of every other door was dropped — the second row's flood put the doors back, not the evidence (the block, wall #54:
  1 or 2 of 12 doors' figures kept; first met on the lived-in compound, walls #45 and #63). ON: the rows of one tick are flooded ONCE, at the first row
  that opened floor, over the floor all of them opened (`floodAll`) — every room any of them touches is in the one flood, the lower-numbered Room lives on as
  it always did. THE SWITCH: on in the page (`?blastflood=0` = a flood a row), off in the module and on the frozen stand (`TPS_BLASTFLOOD=1`; `FROZEN_HOLDS`
  row; `STAND_ENV`); it rides the `WALLREACT` table — a recording from before the key replays with it off (`journal.ts applyKnobs`). Off = the build as it
  was. Not in the frozen-digest pin lists: off in the module. THE CHECK: `tools/qa/blastflood-check.ts` (`probes.ts blastflood`, also under `wallreact` and
  `all`), 7 lines — the stand; a wall place where one charge opens two walls and, a flood a row, the defender beside it loses figures (looked for by the
  blast's own plan and then by trying it: the stage must show the fault); with the rule the two defenders hold the same room with a figure a door, and all
  12 of 12 are kept; two charges in one frame at two places apart come out room for room as a flood a row puts them (nothing joined that was apart);
  `applyKnobs`; `pageSwitches`. `BLASTFLOOD_BREAK=1` fails on BOTH stands. THE FAULT NEEDS the third room to be one the fight already KNOWS (a cached Room
  is what the first row's fill stops at): a room a defender was dealt into or the fight has asked about — the check knows them all from looking for its
  place. NOT COVERED: two holes opened in two different ticks (the first is flooded before the second exists: no fault to mend); a single row whose fill
  meets a capped room (the fight's own rule); a hole made while the module was not live (AI off, a tour: its row is dropped and never flooded, and a later
  row's fill can run through it — as it was). ON THE PAGE (`PORT=5199 node tools/qa/blastflood-page.cjs`, headless Chromium on the software adapter, the
  check's place staged with the page's own Game on `?levelFile=block-squads.json&roomclear=6&squad4`, every room asked for once first): as it opens the switch reads on, two walls go and Tango 1 keeps 12 of 12 doors' figures; under `?blastflood=0` it
  reads off and he keeps 5 of 12; no page error. NOBODY HAS SEEN IT:
  game logic only, never on a GPU, never played — what a player could notice is defenders who still know which doors they heard you at after a charge takes
  two walls at once.
- **A man beside a blast is asked about EVERY thing it took** (`WALLREACT.everyGone`, 10-13; a mend of a fault). `wallreact.ts take` kept one question a
  man and the newest change row replaced it: a blast that takes his crate AND the furniture round it files two rows beside him, he was asked about the
  cupboard ('nothing beyond it to hide from'), never about his crate, and knelt on in the open — on the page, where the furniture rule and the lived-in rooms
  are on; `wallreact-crate [warehouse]` was red on the shipped stand for it. ON: the question keeps each thing that went before the newest while he is still
  owed the answer (`Pend.also`, newest first: its rect, its breach, whose doing it was — each its own), and they are asked IN TURN (`asks`): the newest
  first, exactly as a row alone is asked (`threatFor`, then 'open through what went'); only where it has nothing to say to him ('nothing beyond it', 'hidden
  where he is') is the one before it asked, and the move is planned about the breach of the thing that answered. So a newest row that moves him moves him as
  it always did — a first cut that asked 'through ANY of them' sent the compound's defender to a worse spot (hidden from the charge's setter, open to the
  hole) and was dropped for this. No more than `goneMax` (6) things a question: past that the one FURTHEST from where he is asked (his feet; a
  teammate's mark) is let go (what hid him stood beside him), never merged into a bigger area. A breach grown into another (`upsert`, `Breach.into`) is
  followed for the OLDER things; the newest thing's breach is left as it was asked. One thing that is the mend's own: an older thing that says 'nowhere to
  go' keeps the question alive for its retry, as a lone crate's row always did, where the newest row alone had closed it. A teammate standing on his mark is beside a
  row by his feet and by his mark: asked once (as it was in effect: the second ask rewrote the same question). THE SWITCH: on in the page (`?everygone=0` =
  the newest row alone), off in the module and on the frozen stand (`TPS_EVERYGONE=1` raises it; `FROZEN_HOLDS` row; `STAND_ENV`); it rides the `WALLREACT`
  table, already registered and journalled — a recording from before the key replays with it off (`journal.ts applyKnobs`). Off = the build as it was:
  one thing, asked as it was. Not in the frozen-digest pin lists: off in the module, like the wall charge's own switches. THE CHECK:
  `tools/qa/everygone-check.ts` (`probes.ts everygone`, also under `wallreact` and `all`), 13 lines — the warehouse's crate line with the furniture rule and
  the lived-in rooms in on either stand: the stand's own value and its row; the one blast files two rows within `nearM` of him; with the rule he leaves for
  cover (3.6 m, hidden); without it, on the same stage, he kneels on; nine rows handed to the module hold `goneMax` things, the newest in front, the one
  nearest him still there with its own doer; asked newest first (both on his line → the newest answers; the newest off it → the one before); a teammate on his mark holds one thing for one row; three rows of one wall, the third growing two breaches into
  one, are three things about the breach that is left; `applyKnobs` with no key → off; `pageSwitches` '' → on, `everygone=0` → off. `EVERYGONE_BREAK=1`
  fails on BOTH stands. MEASURED (one seed a line, the probes' own): `wallreact-probes.ts --level all` shipped 81 of 81 with the rule (80 and the warehouse
  crate line red with `TPS_EVERYGONE=0`), frozen 81 of 81 held off and with `TPS_EVERYGONE=1`. No tour or soak was run: the rule is held off on the frozen
  stand, where those tallies are kept. ON THE PAGE (`PORT=5199 node tools/qa/everygone-page.cjs`, headless Chromium on the software adapter, the probe's
  staging done with the page's own Game on `?levelFile=warehouse.json&roomclear=8&squad4`): as it opens the switch reads on and he leaves crate #210 for
  (14.1, 12.3), 3.6 m, hidden; under `?everygone=0` it reads off and he kneels on; no page error; `shipped-page.cjs` on the warehouse: no row differs
  between the page and the shipped stand. NOBODY HAS SEEN IT: game logic only, never on a GPU, never played — what a player would see is a defender leaving a
  blown crate for the next cover where he used to stay kneeling.

<!-- was CLAUDE.md lines 2034–2227 -->
- **A wall charge set on a board that hangs on the wall takes the board and the wall** (`WALLCHARGE.hung`, 10-13; a mend of a fault, his word "both,
  ideally it looks sick too!!"). THE FAULT: the charge sits 6 cm off the face and the blast's plan (`wallbreak.ts planOf`) asks a ray from an eye 0.3 m over
  it to every column; a thin board hung on that face (a notice board, a whiteboard) took every ray, no column was exposed, the row was offered and the
  charge opened nothing. Found by a neighbour's `wallfurn-check --baseline` on a block floor whose mess table had left the notice board. ON: `blow()` names
  its wall to the blast (`BlastOpts.hung {wall, r}`) and (1) that wall goes AT THE CHARGE whatever stands on its face — the column it lies against joins the
  hole, widened to `minHole` as ever — so a sign or a set is no shield either; (2) the BOARDS on that face at the charge (`WallBreak.hungAt`: an authored
  static off the floor against the face, no deeper than `WALLS.hung.deep` 0.1, at least 0.5 long and 0.3 tall, within `WALLCHARGE.hungM` 0.35 of the charge
  on the plan and between the charge and the eye; never an item, a fixture's box, the breaker, a tilted box) are hidden for the plan — flags every ray reads,
  put back — so the wall opens cell for cell as the same wall bare; (3) once a column behind one is open from the floor up its boards go with it, INSIDE the hangers' own rule (`hangers()`: past the half
  rule and past what stands under the board), so the hole's row is filed with the board down (`walkable`, `shellGaps`, what was pinned on the board) — where
  the cells alone would leave one up (a long board, the hole under its end) a checkpoint keeps it as `WallsSave.h` `[board, wall]` (optional key: a file
  without it loads as it did; `check()` refuses an entry that is not a board by its authored shape); (4) a board of the set goes IN PIECES (`furnblast.ts hungGoes`, `FURN.hung`): up to 8 slabs, the ones under the charge (a long slab only with its
  middle within `holeM` 0.5 of it) driven through the hole at 7–11 m/s, the rest torn back into the room at 3.5–7 and along the wall, tumbling, splinters both ways; the `board` break row whatever
  the paint reads as. The slabs are rigid debris: heard landing, in a prop's way, not in a checkpoint. THE SWITCH: on in the page (`?hungcharge=0` = the
  dud, as it was), off in the module and on the frozen stand (`TPS_HUNGCHARGE=1`; `FROZEN_HOLDS` row; `STAND_ENV`); it rides the `WALLCHARGE` table — a
  recording from before the key replays with it off (`journal.ts applyKnobs`). Off = no `hung` on any blast: the build as it was. Not in the frozen-digest
  pin lists: off in the module. THE CHECK: `tools/qa/hungcharge-check.ts` (`probes.ts hungcharge`, also under `wallcharge` and `all`), 12 lines — the
  stand; every board on a breakable wall of the block, the office and the warehouse (7 boards), a charge on each at the place the game offers (settled,
  standing room, floor behind) or staged at its middle, blown on a fresh floor three ways (no rule / rule / no rule with the board taken off): without the
  rule nothing opens, with it every one holes where the bare wall holes, the same cells as bare, the board gone in 8 slabs on both sides of the wall; the
  plan asked ahead; a wall with no board is byte for byte the same with and without the rule; the walls' and furniture's slices re-applied on the level put
  back; the board re-cut in the level's data — 6.6 m long with the charge a metre inside its end (goes, the hole's row says feet pass, `h` names it with its wall and reads as sound, a slice naming a wall as a board is refused, comes back gone), 0.4 m square (no
  board, no shield: the wall holes and the sign comes down); `applyKnobs`; `pageSwitches`. `HUNGCHARGE_BREAK=1` fails on BOTH stands. MEASURED: by the plan,
  on the shipped stand 46 places the game OFFERS on those boards were duds (office 28, warehouse 18; frozen 54 with the block's 8) and all hole with the
  wall named. NOT COVERED: a hung thing deeper than 0.1 m (a shelf: the wall still goes at the charge, the shelf by the hangers' rule); a wall the bare
  charge does not hole for a reason of its own (the office's wall #126, a rack behind the block's #79: as they were); a slab the pool refuses goes as
  splinters; a board over `fallMaxVol` 0.5 m³ stays up, as anything that size does; a charge 0.2–0.35 m past a board's end throws no slab through. ON THE PAGE (`PORT=<port> node tools/qa/hungcharge-page.cjs`, headless Chromium on the software adapter, the block's room clear as the
  page deals it): as it opens the switch reads on, the charge on the notice board holes the wall, a way through, the board gone in 8 slabs (4 back in the
  room, 4 through), no page error; under `?hungcharge=0` the same charge opens nothing and the board hangs on. NOBODY HAS SEEN IT on a GPU and nobody has
  played it: the stills (`STILLS=<dir>`, `EXTRA='hour=midday&wallsafe=0'`, the camera on the charge's side facing the wall) are the software adapter's
  at verylow; the picture goes dark between about 0.3 and 0.7 s after the blast in them, as after any wall charge (not looked into here).
- **A blast's pall: a wall charge, a hand grenade and a 40 mm raise a real cloud of dust and smoke** (`CHAOS.pall`, `destruction.ts`, 10-14; his words:
  "i'd also expect much more dust/smoke from a wall charge" / "same goes for 40mm" / "and frag"). BEFORE: a blast raised the bullet's puff a few times over
  (`CHAOS.puff`: radius 0.2, a third of a second, under the round's caps of 2 a frame and 8 a second) and `WALL_BLAST.dust`, particles the picture alone
  carries. ON: the charge (`wallcharge.ts blow` → `Destruction.pallWall`: 4 emitters on its own side, 3 beyond when the wall opened, none beyond a wall that
  held) and every burst that comes through `blast()` with its chaos (`pallBurst`: the grenade, the 40 mm, a bomb — a ring of 5 round it sized by the blast's
  radius / 2.5, and a darker, hotter column over it) hand THE SMOKE SOLVER wide dust emitters (`kind: 'puff'`, radius 0.45 / 0.42, 1.2–1.8 s, tinted by
  the wall's surface) — so it is real density: every sight line reads it, both sides', like any smoke (one model) — plus a slower, bigger particle layer
  for the picture (`emitDust`, 4–4.5 s, 0.5–0.6 m). Its own allowance, not the puffs': `perWindow` 6 palls in `windowSecs` 4 over the floor (3 at first; raised on his word, 10-14: "it should feel pretty chaotic with HE going off. make it
  feel great first and we can think about gameplay implications next" — which also settles the open call below: the dust is real and hides), a burst
  past that inside it raises the old dust alone; the wall charge is never the one refused (and counts). A solver with fewer than `slack` 8 slots free is asked for
  none of it, and then the particle layer does not go either (no cloud nobody is hidden by). WHERE AN EMITTER MAY STAND (`pallEmit`): the solver lays an
  emitter down as a gaussian through whatever is thin (it masks solid cells, nothing more), so a place with a solid between it and the blast is mirrored
  through the blast's point into its own room, and left out where that is shut too (never laid on the blast's point: a ring's blocked half would heap
  there — a review's find, 9 a second on one spot in a slot by a locker); it is pushed off anything solid within `clear` 1.8 radii (eight ways, twice,
  judged at `clearY` 1.7 m over the furniture or its own height if higher, never into what stands at its own height) and, still without room, shrinks to
  `minRadius` 0.5 of its radius at the least with its density up by the ratio to the 1.5, capped at `maxGain` 2. So in a tight spot the pall is thin (the
  block's slot: one emitter of six) — the old dust goes as ever. NOT under a level script's
  show (`showChaos` set: its cameras keep their picture), not at chaos 0, not with the one switch off. NOT the door charge and not the stun (neither comes
  through `blast()` with chaos; not asked). Dice: a stateless hash of place, moment and index (`pallHash`) — none of the lane's own; `pallAt` (the window)
  is cleared by the lane's `reset()` and not saved (it gates emitters only). `PALL_STATS` is a tool's, apart from `DESTR_STATS` (older digests carry that
  whole). The panel's ↺ (`resetChaosKnobs`) puts the numbers back and leaves the switch. THE SWITCH: on in the page (`?pall=0` = the dust as it was;
  `?pall=look` = `CHAOS.pall.solver` off: the particle layer alone, nobody hidden — the other answer to the open call below, one flag away), off in the
  module and on the frozen stand (`TPS_PALL=1`; `FROZEN_HOLDS` row; `STAND_ENV`); it rides `CHAOS` in the journal — a recording from before the key replays
  with it off (`journal.ts applyKnobs`). Off = no call past `pallTake`'s first line: the build as it was. Not in the frozen-digest pin lists: off in the
  module. THE CHECK: `tools/qa/pall-check.ts` (`probes.ts pall`, also under `destruction`, `wallcharge` and `all`), 17 lines, both stands, `TPS_PALL=1`,
  `PALL_BREAK=1` red: headless the solver is a null object, so it reads what the game ASKS of it (which emitters, where, how much) and that the game
  digests the same with the rule on and off. MEASURED ON THE PAGE (`tools/qa/pall-page.cjs`: headless Chromium, software adapter, the block's room clear,
  the page's own solver and probe stepped at 30 a second, the whole picture drawn twice a second; the transmittance a guard's eye reads at 1.2 m, where
  under 0.3 is hidden and over 0.8 plain): a wall charge that
  opens its wall — the line through the hole reads 0 from 0.8 s, hidden for about 4 s, 0.42 at 6.4 s; along the wall on the charge's side hidden about
  3.5 s, beyond it 2.5 s, from the stack to the wall 2.75 s; under `?pall=0` the line through the hole read 0.25 / 0.27 / 0.49 / 0.74 at 1 / 2 / 3 / 4 s
  (the charge's old smoke already hid it for two seconds) and the other three 0.57 to 1.0. A hand grenade on open floor — hidden across it 2.5 to 4 s by
  the line, 3 s at eye height, 1.25 s a metre to one side, 0.42 to 0.75 at 6.4 s: a haze lingers, nothing is back over 0.8 by then. The first numbers
  (density 2.0) read 0 on every line for 3 s and more and were cut to 0.8 / 0.85. A SECOND RUN on the final code (the placement rule in, 6 s): the charge — through the hole hidden 3.5 s (0.47 at 6 s), the charge's side, beyond and the stack each 2.25 s; `?pall=0` through the hole hidden 1 s, 0.32 at 2.25 s; the grenade — across it 2.75 / 3.5 s, eye height 4.25 s, a metre aside 0.25 s. So: about 2 to 4 s hidden, run to run. Two runs each, one wall, one seed. The 40 mm was not measured on the
  page (the same `pallBurst`, 0.88 the size). The amounts asked are about a thirtieth to a fiftieth of a smoke can's (135 by the same
  measure against 4.3 and 2.6): a pall, not a screen. NOT SEEN ON A GPU, NOT PLAYED: the look (stills from the software adapter at verylow only), the
  frame cost of up to 42 more emitters in a window (fewer when the solver is short: `slack`), how a fight through the dust feels. HIS CALL, GIVEN (10-14,
  the words above): the pall hides men, both sides, for a few seconds; what that does to a fight is to be thought about after he has played it
  (`?pall=look` stays as the one flag back to a cloud nobody is hidden by).
- **A blast leaves the floor a mess: films of settled dust, the marks of the pieces the pool took** (`src/game/floormess.ts`, numbers `CHAOS.mess` in
  `destruction.ts`; the maintainer 10-14: "maybe we've just blown up too much stuff but the office floor looks too clean"). WHY IT WAS CLEAN: the pall thins in
  seconds, chips are particles that live eighteen, and the debris pool (`settings.debrisCap`, 64 / 32) gives a resting chunk's slot to the next one thrown —
  after a long fight nothing recorded it. THE RULE (`CHAOS.mess.on`: ON in the page, `?mess=0` off; OFF in the module and on the frozen stand, word
  `TPS_MESS=1`; `FROZEN_HOLDS` row, `STAND_ENV`, journal `applyKnobs`: a recording from before the key replays with it off). Every mark is a `'damage'` decal
  laid ONLY FOR THE PICTURE (`look: true` + `lookDecal`: the digest does not count it, a full ring drops it before any mark play laid and takes none when it
  is full of play's own, a checkpoint carries it like any decal): no ray, foot, eye, ear or die knows it, the module keeps no state (a film "already there" is
  read off the decal list) and draws no dice. What is NOT held equal with the rule on, as with every picture-only mark: a later play mark's look seed and a
  stun scorch's size jitter read `decals.count`.
  · FILM (`decals.wgsl damageMark` look 6): a burst through `blast()` with the lane's chaos (hand grenade, 40 mm, bomb; `messBurst`, none above `roofY`)
  lays a HEART at the burst and `lobes` round it; a wall charge (`wallcharge.ts blow → messWall`) a fan each side it reached (the far side only through a
  hole); a wall / cover cell opened by fire or a fall (`wallbreak.ts openCells → messOpened`) a small one each side of its foot. FITTED TO THE ROOM: a
  patch's reach is the distance to the nearest static whose span meets the band `standY`‥`clearY` (1.05‥1.7 m: a wall, a pane, a cabinet — not a desk, a
  sill, a door's header), measured to the box itself (a film abreast of a doorway stops at its jambs; the dust goes through as a lobe of its own), + `under`;
  a centre inside one, or with something standing between it and the heart at either height, is left out. The floor film lies at y 0 (a rug is inside the
  mark's plane tolerance); every static top between `top.lo` and `top.hi` standing in a patch gets a film at its own height (one a height, three heights a
  patch: a mark's plane takes every surface at that height), a prop under its middle one that rides the prop. Two films nearer than `crowd` × the smaller
  reach are one. The soot is the heart's alone (the look seed's top bit), rayed out, not meeting in the middle; grit specks are asked of their 5 cm square.
  · RUBBLE (looks 7 grit / 8 splinters, by the piece's break row): `breakTable.ts evicted → messEvicted` — the piece's longest half extent × `grow`
  (`min`‥`max`), long along the way it lay (its `rot`), on what a look down from it finds (a prop's top rides the prop), none within `crowd` of another.
  · CHECK `bun run tools/qa/probes.ts mess` (= `tools/qa/mess-check.ts`; in the `destruction` and `wallcharge` families; `MESS_BREAK=1` must fail): 16 lines —
  the stand; a grenade on open floor on / off (heart + lobes, all picture-only, none through anything standing: 24 looks out of each film at both heights
  of the band); a second grenade on the spot lays no second film; a 40 mm; hard by a wall no blast opens (a grenade against it, a 40 mm a hand off it): none
  beyond, none reaching under; a wall charge both sides, a whole wall its own side alone; a wall chewed open by rifle fire; a pool of six: marks where
  pieces lay; tops; six bursts and a charge pack with nothing dropped; a ring full of play's marks; chaos 0 / the one switch off / a show; ↺; ONE DIGEST on
  and off with play's marks equal in number; journal; page boot. PAGE: `PORT=<port> node tools/qa/mess-page.cjs` (software adapter: the shader's new looks
  compile in the page's pipeline, marks laid, stills with `STILLS=<dir>`): run 10-14 on the block at `low` — a clean console, on: 18 films and 2 rubble
  marks after a charge and two grenades with the pool cut to 4 (a pool filled on ONE frame refuses, it takes a slot only from a piece at rest: the second
  grenade is what evicts), `?mess=0`: none. Stills read as pale banks of dust with fine grit round the scorch on both sides of the hole; in the block's own
  light at midday they are faint (the room is dark). NOT SEEN ON A GPU, NOT PLAYED: the look at play's camera and light, the office's polished floor, the
  frame cost of a room full of films (a film is a 1 to 2 m mark every pixel under it evaluates). `tools/qa/wallwear-probes.ts` counts play's marks only now
  (its "one decal a round" line counted the foot films of the port it opened on the shipped stand).
  · KNOWN: 48 newer marks in one 1 m square drop the oldest there from the drawn list (`DECAL_MAX_PER_CELL`) — a film would lose that square, straight
  edged (as a scorch always could). Not dusted: props not under a patch's middle, walls. A film is one flat tone mix (plaster pale `0.68 0.66 0.61`): it
  lifts a dark floor, on a floor near that tone only its grit, soot and matte read.
- **Glass** (E3; docs/internal/exp-glass.md = the branch's record — the SHATTER half of it is superseded): a static box flagged `BoxFlag.Glass` (level flag
  name `Glass`, albedo = transmission tint; 22 panes: conference partition ×6, manager sidelight, lobby frontage 4 + 4, the other windows) is a PANE: never in
  the raster nor the trace grid, listed nearest-first in `SceneInfo.glass` (boxes.ts packGlass, ≤ `MAX_GLASS` 32) and tested analytically by composite
  (tint × (1−F) on what the G-buffer shows behind it + the spec texture's contribution), fgather `glassShade` (one mirror ray + glints + dust glow → the
  gloss floors' spec chain, which passes.ts runs under `Gloss | Glass`) and direct.wgsl (a lit leader × `glassTransmit`, per-light CPU pane masks in the top
  24 bits of `Light.owner`, engine.ts glassLightMasks). CPU: `col.segmentBlocked` = SIGHT (passes glass: eyes, cameras, torch cones, the dazzle, guards'
  laser dots), `col.solidBlocked` = sound / feet / reach / a step a man can take (an intact pane blocks; the QRF's station step and the tactics' shoulder
  step ask this one), `col.shotBlocked` = a line of FIRE (the same solid walk, named for the question: guards.ts `clearShot` — the alert branch's `blocked` —
  and tactics.ts `losOpen` for the presser's / flanker's cover point and the lone man's corner; a man who SEES Sam through a pane has no shot from there and
  goes round through the door instead of planting on the corridor putting rounds into the glass, and no corner is taken behind a pane; aim.ts `noteBore`'s
  reach is his own half of the line, so a far jamb eating rounds also moves him); device tripwire beams END at glass like at any solid. A Glass box thicker than `THICK_GLASS_HALF` (5 cm) across its thin axis would be SOLID glass (same pane treatment, glassHit stars only sheets) — nothing in the office uses it since the water-cooler bottle went back to a plain box (a refracting box read as an ice cube). Panes NEVER break IN THIS MODULE'S OWN RULE (what the game is with `?glassfx=0`, and what the harness stands up; since the rebuild the page ships `GLASSFX` on and a pane cracks, lets rounds through and comes apart — the three glass bullets below): `game/glass.ts glassHit(g, bi, p, dir, who)` (combat.ts: a
  round whose static hit is a pane — the round STOPS in it, the next one too — or the pane between shoulder and muzzle when pressed to it) adds a decal of
  kind `'glassHit'` on that pane (`Decal.pane` = its static index; radius 0.075‥0.2 and the 12-bit look seed from `hitSeed(bi, point)` — the same shot
  draws the same star), plays `glassCrack`, pushes GameEvent `'glass'` (level `GLASS.hearLevel` 0.85, horizon `hearM` 30; guards.ts hearingCheck) and
  ticks Sam's noise; `updateGlass` reads each `'bang'` event once → `crackNear` (`bangM` 2.5): `bangCracks` quiet stars per pane, seeded off the blast's
  position; kicks do nothing. composite.wgsl draws the stars where the view ray crosses the pane (`decals.wgsl glassMarks/glassStar`: hole 8 mm + milky
  collar + a star in three looks — star / cone / runners — off seed % 3; transmission cut along cracks and collar, reflection ×(1 + 2.5·crack),
  `paneLight()` = what falls ON the pane from either face lights the powder; only under `FrameFlags.Decals`, only the nearest pane crossed, not over sky
  pixels) reading the decal buffer at composite group 1 binding 10. Restart wipes them with every other mark (`decals.clear()` in resetLevelState).
  `settings.glass/glassReflect/glassTintDepth/glassDust/glassRefract/glassIor` (default ON; `?noglass`, `?norefract`), Tab ▸ Renderer — glass (+ 'crack test' = `game.crackTest()`),
  `__glass` {on, reflect, tintDepth, dust, refract, ior, crack(), hit(bi, p, dir), cracks, summary(), listed, panes}. QA: `probes.ts glass` (flags / sight / sound /
  shot / blast / off / lines — `glass-lines` also runs in `doors`), `aim-door-sweep` (its traps include every through-glass sighting), soak stimulus `crack-glass` + the pane-count invariant.
  **A PANE'S CRASH IS HEARD FROM BOTH ITS FACES** (`GLASS.bothFaces`, `GLASS.earOff` 0.55 = past one walk-grid cell, since a routed sound is searched and cached per cell: ON in the page — `?glassears=0` = as it was — OFF in the module and on the frozen stand, `TPS_GLASSEARS=1`; a `FROZEN_HOLDS` row, a recording from before the key replays with it off; no Tab row). A 'glass' event stood at the point the round met the pane, i.e. on the SHOOTER's side of a sheet that is a wall to sound, so a window shot out from outside was routed round the building to the men in the room behind it (Mousehole, a replay of the maintainer's: the three men 5 to 9 m from the window heard nothing — 29 to 39 m of path against the rule's 30 — and one man 12 m off by the front door went to look). Now `glass.ts glassEvent` (THE one place a 'glass' event is made: glassImpact ×2, glassbreak.ts emit) also files `GameEvent.ears` = a point `earOff` off each face, and `guards.ts glassHeard(g, e, ear)` (hearingCheck and civilians.ts ask it for every 'glass' event) takes the event's own point unless it has no clear run and one of the faces arrives better by the glass rule's own weight — so nobody hears a pane worse for it. `ears` rides a checkpoint's event rows. The reach, level and thresholds of the glass rule are untouched: on Mousehole that window now takes all nine defenders to suspicious through their shut doors (awareness 0.5 to 0.65, nobody alert), by the rule as it always stood. `bun run tools/qa/glass-ears-check.ts` (`probes.ts glassears`, also under `glass`; both stands; `GLASSEARS_BREAK=1` must fail). Never played or heard by anybody.
  **REFRACTION** (`settings.glassRefract` default ON, `glassIor` 1.5; `?norefract`; Tab ▸ Renderer — glass ▸ refraction / index of refraction; `__glass.refract / .ior`;
  docs/internal/glass-refraction.md): ONE law for every Glass box, panes and the bottle alike, INSIDE composite (no extra pass, no HDR copy): the pixel's view ray bends into the
  box it met (Snell, `refractDir`), crosses it to the face it leaves by (`slabExit` in the box's yawed frame; a face past the critical angle mirrors it back in — ≤ 3 legs), bends
  out; the tint = `gh.trans^(glassTintDepth × len ∕ unit)` × (1 − F) — Beer–Lambert by the glass actually crossed with `unit` = twice the box's thinnest half-extent (the authored
  albedo READ AS the transmittance square through the box's own thickness: a pane square-on is tinted exactly as before, a graze by 1∕cosθt instead of the old 1∕max(cosI, .35),
  the bottle's diagonals / mirrored legs deeper); and the surface the pixel shows is READ where the bent ray comes out (`refractedRead`: the exit ray followed to the plane of what
  the pixel already shows, ≤ `REFR_MAX_M` 1.5 m, projected with THIS raster's own matrices, offset ≤ `REFR_MAX_PX` 0.12 × height and shrunk continuously to stay on screen, refused
  — the pixel keeps its own read — where the sky shows there or the surface there is nearer than the exit point) → the paint / normal / id / direct / indirect / emissive / RT
  reflection are loaded at that pixel `sPix` (nearest texel; TAAU's jitter dithers it smooth) while the pane's own reflection field, the cracks and the fog stay keyed on the
  pixel (`zg` / `Ng`). A 12 mm pane moves nothing but a pixel or two at a graze; the bottle bends the cabinet edge behind it by centimetres. `passes.ts` compiles composite (and
  its sharp twin) a SECOND time behind `const GLASS_REFRACT: bool = true` (`pCompR` / `pCompSR`, boot pipelines) taken while `passes.glassRefract` (= setting ∧ glass ∧ a pane
  listed); **false = the module exactly as it was — OFF is hash-identical to main**; `frame.glassCfg.w` = the index (0 = off). Cost: +0.07 ms compS at high with the conference
  glazing filling the view, 0.00 without glass on screen. The pure helpers live in `render/shaders/refract_common.wgsl` (no bindings: `fresnelSchlick / fresnelF0 / refractDir /
  slabExit / beerLambert / refractProbeDist / screenRefractPx / clampRefractOffset`) so the particle rain's water streaks (exp/prain) share the law. Screen space only: what a bent
  ray sees must already be on screen behind the glass; TAA reprojects the bottle's interior with the motion of the surface behind it (mild ghosting inside it under a fast
  camera). Harness `tools/qa/refract-harness.js` (`__rf`: views, `abStill`, `cost`, `identity` / `pngs` — fresh-boot rule — `validate`).
- **Decals** (E1, `render/decals.ts` + `shaders/decals.wgsl`, docs/internal/exp-decals.md): a 512-entry ring of marks {kind bullet | scorch | scuff | chip |
  glassHit, pos, n, t, radius, param, seed, box?/pane} bucketed into the 1 m XZ cells (≤ 48 newest per cell, 4096 list entries), ONE read-only storage
  buffer rewritten only on change, read by the g-buffer's FRAGMENT stage (group 1 binding 3; `decalWgslConsts(binding)` prepends the binding + layout
  consts) which edits the albedo / normal / gloss-keep (albedo target alpha, × the gloss floors' spec in composite) it stores — so direct light, the bounce
  at the pixel and the gloss term respond by themselves (secondary hits and the AI's light meter do not). Marks on dynamic boxes ride them (local frame,
  `sync`). Emit sites, one call each, in `game/marks.ts`: combat.ts fireWeapon → `bulletMark`, detonateStun → `bangScorch` (+ splashes), player.ts /
  squad.ts kick impact → `kickScuff`, launcher.ts clack → `chipMark`; glass.ts → 'glassHit' (drawn by composite, skipped by the g-buffer). Never touches
  Math.random. `settings.decals` (default on; `?nodecals`, `?decalStress=N` = measurement), Tab ▸ Renderer — decals, `__marks` {test, random, clear, bang,
  scuff}. Cleared by resetLevelState. QA: `probes.ts decals` (ring / sites / follow / off / identity — identity also under `weapons`), soak invariants.
  · `probes.ts decals` ON THE SHIPPED STAND (10-14; red there for 170 build steps and more, never run on it before): `decals-sites` asked for a plain
  'bullet' on the face of a wall the wall engine can break, where a round's one mark is the wall's WEAR mark (`wallwear.ts`: the same record edited into
  kind 'damage', a wear look, on the mid-plane of a thin partition with the half thickness folded into its radius — `WEAR_MARK`). The probe now reads which
  of the two the round must leave off the wall it meets (the walls' own gate: `wallBreakOn`, `wear.on`, breakable, not hard) and holds each to its own
  shape: one mark either way, the wall's normal, world-fixed. Green on both stands; no game code changed.
- **GPU particles** (E4, `render/particles.ts` + `shaders/particles*.wgsl`, docs/internal/exp-particles.md): one 16 384 × 80 B pool in two FIFO rings
  (SHORT sparks + dust, LONG chips + brass + paper), emits queued on the CPU (`Particles.emit(kind, pos, dir, count, opts)`, ≤ 128 records a frame in one
  uniform block, seeds off the system's own serial), kernel `emit` + `update` in ONE compute pass after the cascades (collision = `traceClosest` through
  the trace grid, resting chips sleep, shading per particle: sparks on the CPU sparks' cooling ramp, chips / dust / brass LIT off the three strongest
  shadow-tested lights + the dice), then a splat into the HDR target between composite and bloom (`passes.encode(…, overlayHdr)`). Sites in
  `game/particleFx.ts` behind `engine.particlesOn` (= `settings.gpuParticles` ∧ attached; OFF = the CPU box sparks byte for byte): impactFx by material,
  muzzleSparksFx, casingFx (+ the CPU-scheduled `casingTink`), bangFx, kickDustFx, clackFx, the tracers' `sparkSink`. `?noparticles`, Tab ▸ Renderer —
  particles, `__particles` {stats, params, on, test(kind, at), emit, clear}. QA: `probes.ts particles` (queue / sites / off / determinism).
  The fifth kind `sheet` (id 4, LONG ring; `game/sheetModel.ts` = the CPU REFERENCE of its equations, keep the two in step — `probes.ts destruction-sheet`
  compares the constants): a leaf of office paper as a LIT two-sided oriented quad (width `size` × `aspect`; the struct's 5th row = octahedral normal + f16
  angular velocity + aspect, `pOctEncode/Decode`, `sheetFrame`), gravity + drag through the sheet scaled by airspeed (a gliding leaf gets lift) + flutter torque
  off the offset centre of pressure (`sheetAir`), traceClosest lays it flat on floors / desks and puts it to sleep, walls let it slide; `sheetLight` = one pass
  scoring front and back irradiance (three strongest shadow-rayed, `TRANS` 0.3 of the back face shows through); the splat antialiases its rim over `fwidth(loc)`,
  gives each leaf its own tone and writes a LOW reactive weight at rest (litter keeps its TAA history). Sheets cast no shadow (a splat, not a box). Every kind
  now carries `aspect` (`EmitOpts.aspect/tumble/nrmJit` → the record's posB; 1 = the chip as it was — a splinter is a chip with aspect 3).
- **Destruction under sustained fire** (`src/game/destruction.ts` + `debris.ts`, STATUS stage 3b; docs/internal/destruction.md, page docs/review/destruction.html):
  ONE knob `tune.chaos` 0‥1 (default 0.5, persisted `twopointsix.chaos`, Tab ▸ Sandbox ▸ chaos rows; **0 = the game byte for byte as it was** — both hooks
  return on their first line, `probes.ts destruction-identity` holds it; `chaosOf(g)` is also 0 while `touring`). Rounds (anybody's — combat.ts fireWeapon calls
  `g.destr.round(shooter, hitP, dir, hit, def)` right after impactFx) and stun charges (`g.destr.bang(at)` after bangScorch) pour HEAT into a 2 m grid with a 2 s
  memory; ESCALATION E = heat × 2 × chaos gates what a hit does ON TOP of the marks / bursts it always made: E ≥ 1 a `'damage'` decal by material (decals.ts kind 7,
  the last free code — LOOK = floor(param): 0 dent in metal, 1 shred in fabric partitions, 2 crack in a dark screen; strength = fract) + a paper stack near the hit or
  under the round's path CONVERTED to `sheet` particles (its static hidden: flags |= NoPrimary | NoShadow, restored on reset) + a monitor / TV whose screen or
  housing took the round DIES (`LightTarget.broken` → factor 0, a crack, sparks); E ≥ 1.5 bigger material bursts (splinters, gypsum, fluff, sparks) + a DUST PUFF into
  the smoke solver (SmokeEmitter kind `'puff'`, coarse lattice, optically thin, ttl 0.35 — real density: the froxels light it in the beams and the guards' GPU
  sight-line probe marches it, ONE MODEL; ≤ `puffsPerFrame` 2, ≤ `puffsPerSec` 8, only while `smoke.budget()` has slack — the dust was THE cost of this lane under the box solver: +2 ms union at high / +2.5–4 at ultra while a burst's dust hung, all of it shadow /
  gather rays sampling the extra domains; not re-measured on the brick pool, where the `puffDomains` gate that bounded it is gone with the domains); E ≥ 4 desk clutter within `knockReachM`
  (mugs, phones, binders — indexed by SHAPE once at construction: paper = thin pale NoShadow slabs on furniture, screen = screenOff sheets + the housing paired
  behind each, clutter / binder = small dark-or-not statics 0.7–1.6 m up inside the building, never a fixture's box; things standing on each other form a `group`
  knocked together) and a monitor housing on a direct hit KNOCKED OFF as rigid debris, a chair a round finds spun; E ≥ 9 (≈ 1.2 s of the FN2000 on AUTO at 0.5, or
  one stun charge = `bangHeat` 9) a CEILING TILE over the beaten zone drops (one per 0.6 m square, ≥ `tileGapSecs` 2.2 apart, ≤ `tilesPerEncounter` 8, indoors,
  nothing solid under the slab there). `game/debris.ts Debris` = the RIGID pool: `Chunk {kind tile|housing|clutter|binder|chunk, box (Dynamic, mkey MKEY.debris +
  serial), v, w}`, swept centre-ray contact against statics + leaves + props with the box's own support distance, dead bounces, `layFlat` toward the face nearest
  down on each floor touch, sleep (rests on a prop until that prop moves), a world-floor fallback; capped by `settings.debrisCap` (quality.ts `Caps.debris` 64 / 64
  / 32 / 32 / 32 = the image-quality program's chaos budget) — over it a spawn EVICTS the oldest resting chunk, and with none resting REFUSES → the caller demotes the
  break-off to a chip burst (Control's rule); the first hard landing plays its knock and files GameEvent `'prop'` (tile 0.4, housing 0.5, clutter / binder 0.25,
  who 0 → a calm man goes to look); paper and dust are silent. Velocity policy: knock-offs topple at ~1 m/s at chaos ≤ 0.5, × up to 2.5 at chaos 1 (the
  kinetic-mode seed). Everything BOUNDED (exact sliding-window `RateCap`s per second, per-frame and per-encounter caps, the pools) and DETERMINISTIC (every choice
  `hash01(serial++)`, never Math.random; renderer switches — decals off, no Particles attached — never change the counter's consumption). `StaticCollision`
  raycast / segmentBlocked / gather / collideCircle skip NoShadow statics at QUERY time (only ever a runtime-hidden one: the cells never held a NoShadow box).
  game.ts: `destr` built after devices, `destr.update(dt)` after updateProps, `destr.boxes(dynBoxes)`, `resetLevelState → destr.reset()` (statics restored, pools
  / heat / caps / serial zeroed), `clearAftermath → clearMoving()`. Not in checkpoints (a load = restart = restored). The harness (`headless.ts`) stands the game
  up at chaos 0 so every older probe measures the game as it was; `soak.ts --chaos K` (default 0.5) + invariants (debris ≤ cap, hidden ≤ indexed, log ≤ 200, finite,
  chaos-0 counts nothing, nothing moves under the tour). `__destr` {chaos (not persisted — `save()` does), stats, log, knobs, debris, inventory(), summary(), heat(p),
  escalation(p), bang(p), burst(p, n, every), reset(), defaults()}; `tools/qa/destr-scenes.js` (`__ds.paper/dust/tile/monitor/sight/cost`). QA: `probes.ts destruction` (sheet / caps /
  dust / screen / hearing / reset / identity / determinism / bounds; identity also under `weapons`).
- **The blast frame's picture-only work is paced** (`destructionSwitch.ts BLAST_PACE {on, reachHold 1, dripSamples 16, dripHold 8}`, ON on every stand; `?blastpace=old` /
  `TPS_BLASTPACE=old` in front of a headless tool = all of it on the blast frame, as it was; play is the same either way by run digest, so the switch is on knobs-check's
  `UNREGISTERED` list as picture-only): (1) `game.ts reachChanged(rect)` only NOTES the rect; `reachTick` reads the wall raster one frame later (`reachRead`) and decides masks from
  the frame after — masks land exactly 2 frames later (`reachPending` counts the notes too; `REACH_PACE.whole` and a null rect = a reset still read at once); (2) `rainFx.ts` re-finds
  the drip lines `dripSamples` edge samples a frame (`dripWalk` over a `DripJob` of plain numbers, in the host's book since 10-23: `docs/agents/weather.md`; an indoor sample costs 1/16) once the statics' count and `geomSerial` have stood still `dripHold` frames,
  the old lines dripping meanwhile (`rainDripPending`; `rainDripPoints` finishes a walk whole); (3) `destr.furn.warm()` makes the furniture index when a wall charge is SET
  (wallcharge.ts, both set sites) — other blast sources still make it on their first blast. Exact and unswitched: `roomfight.ts roomAt`'s flood allocates nothing per cell.
  `bun run tools/qa/blast-pace-check.ts` = reach masks (turning beacons aside: a beacon's mask is of the frame it is decided), drip lines and the digest equal between the two paces
  240 frames after each of three blasts on five levels; `tools/qa/blast-frame.ts --scn <mission> --passes 3 --warm 1` (pin two cores, nothing else running) = the game step on every
  wall-charge frame of a played mission, warm and cold, `--split --only a,b` = named methods' share, `--mark` + `blast-frame-prof.ts` = a CPU profile cut to the frame. Numbers and
  what is left on the frame (play's own: hearing paths, the room reflood, the wall and furniture coming apart): rebuild/performance/blast-frame.md. Never seen on a GPU.
- **Cut boxes** (`src/scene/cut.ts`, the contract docs/internal/cut-boxes-contract.md; switch read at BOOT by `initCutSwitch()` — ON in the page since the one-build merge; `?nocutboxes` / localStorage `twopointsix.cutboxes` = '0' =
  OFF = the build hash for hash: no flag bit, no table, the same shader programs; the headless harness stays off unless `CUTBOXES=1`, and a cross-build identity
  rig comparing against an older build must boot this side with `?nocutboxes`): `Box.cut?: CutPlane[]` (≤ `MAX_CUT_PLANES` 8 planes `{n, d}` in the box's LOCAL frame,
  solid = box ∩ {n·p ≤ d}) makes one box a wedge / shard / snapped end. ONE MODEL: the g-buffer draws it cut (`gbuffer_cut.wgsl` `vsBoxCut` / `fsBoxCut`, a SECOND module +
  pipeline made only under the switch — six faces + a quad per plane, fragments off the solid discarded; KEEP IN STEP with gbuffer.wgsl vsBox / fsBox; cut faces show the bare
  material: no markings, no detail layer), every GPU ray meets it cut (`common.wgsl isectCut` inside `isectBox` behind prelude const `CUT_BOXES`; a cut face answers code −1 − k,
  decoded by `boxNormalFromCode`), and so do `rayBox` / `lineBox` on the CPU (`cut.ts cutClip` — rounds, sight, sound, lines of fire). What still meets the WHOLE box: everything
  that pushes (collideCircle, gather, nav, debris / prop contact), the trace grid's registration, the smoke obstacle bake; reach masks treat a cut static as open ground. GPU home:
  bit 16 of the geo flags word (`GEO_CUT`) + `CUT_STRIDE` 9 vec4 rows per box INDEX in boxMat's tail after the markings and glass tables and the weather's air grid (`CUT_BASE`: `CUT_ROWS` 8 plane rows, then the
  core row) — no cap on cut records but the world's box count; `Box.cutCore?: Vec3` = the colour CUT faces show in the picture, matte (raster only: rays on a cut face read the
  box's own colour; packed with the record); `Box.cutGlass?: { see, rim, anim }` (cut.ts `CutGlass`, in the core row's w: 1 = a plain core, + 2 glass …) = PICTURE-ONLY
  glass: the box's two z faces are a per-pixel screen door stepped along the TAAU jitter cycle inside a rim in the core colour — fallen glass plates (shards.ts `SHARDS.cutSee / cutRim /
  cutEdge / cutBody / cutAnim`, all 0 = an opaque plate; at REST `cutSeeRest` 0.45 / `cutRestBody` 0.3 = less seen through and a pale sheen, both 0 = as in flight; `probes.ts cutglass-look`; never seen on a GPU); `cutRecord` merges repeated / parallel planes before the 8-plane limit; cut boxes ride AFTER the plain
  ones in `visible` (`BoxWorld.visibleCutCount`). A static re-packs when its `cut` ARRAY is replaced (not edited in place). Builders `cutRecord / cutThrough / cutThrough3 /
  cutPrism / cutFit / fitCutBox`; `__cut` {on, stats, test(at, 'wedge'|'shard'|'snap'|'lump'), clear, ray}; a journal carries `env.cutBoxes`; `CUTBOXES=1|0` (also `CUT_BOXES`) in front of a headless tool forces the switch (headless.ts standUp; a replay's env wins). The switch is table `CUT` in the knob registry (src/game/knobs.ts: put back round every probe; not in a recording's tables) and one of `FROZEN_HOLDS`' rows (src/host/profile.ts): the frozen harness stand leaves it off, the SHIPPED stand (`TPS_PROFILE=shipped`, so the missions gate) raises it as the page does. QA: `probes.ts cutboxes` (record /
  ray / off / pack; also under `perf`). Seen only on SwiftShader so far (rebuild/cut-pieces/renderer/notes.md in the project files); the native .metal twins are NOT ported.
  **A CALM ROOM PAYS NOTHING (`render/cutSwap.ts`, `cutConfig.swap`, default on with the switch):** the boot compiles EVERY program from the prelude WITHOUT the cut rule
  (`scenePrelude()` = the `?nocutboxes` text character for character; only the g-buffer's cut module takes `scenePrelude(true)`), then, after the pipelines' boot mark,
  `cutSwap.build()` compiles a SECOND set of the programs that trace boxes behind `scenePrelude(true)` in the background (`CutSwappable.buildCut / useCut` on LightingPasses
  — `traceJobs(pre, T, jobs)` is the one list both sets come from: direct, restir ×2, the four gathers, reflect ×2, cards, volumetrics + its dust twin, composite ×2, + the lazily
  built sharp trio —, every RadianceCascades instance, Froxels inject ×2, LightProbe, Particles emit / update, the fog-of-war pass; same layouts, bind groups and histories) and
  `engine.render` calls `cutSwap.frame(world.cutTraced)` after the upload: the cut set is on the frame while a cut box a ray can meet is alive (`BoxWorld.cutTraced`: cut and not
  NoShadow — a glass plate is picture only and never swaps), the boot set again after `HOLD_FRAMES` 240 without one (pieces coming and going inside the hold never flap the sets). So with nothing cut the frame is the switch-off frame by
  construction. THE RASTER FOLLOWS THE RAYS (`cutSwap.drawsCut`, `engine.cutWhole`): until the second set is in (seconds after boot), or if it fails to compile (`state 'failed'`, one
  console error), a traceable cut piece is DRAWN WHOLE and traced whole — the cut list leads with the traceable boxes (`BoxWorld.visibleCutTraced`) and the g-buffer draws those with the
  plain pipeline; glass plates are drawn cut always; the frame standing pieces change shape on resets the resolve like a camera cut. The CPU's lines meet the cut shape from the frame a
  piece is born. A hot swap (`__hotCommon`, `__hotDirect` …) compiles from the prelude without the rule, so it first puts the boot set back everywhere and PINS it (`cutSwap.hot()`:
  cut pieces whole for picture and rays until a reload — dev pages only); `?cutprograms=boot` = one set with the rule in from boot (the build before the swap, and what
  tools/qa/cut-cost.js's 'gate' text needs). `__cut.programs` {swap, state, live, ready (a Promise: await it before staging a cut piece in a capture), force 'cut' | 'base' | null,
  info}; `__cut.stats.traced / .drawnWhole`. A new pass that traces boxes joins by implementing the two methods and calling `cutSwap.add(this)`.
- **Glass that comes apart** (`src/game/glassbreak.ts`, merged 1d6d99e from the physics showcase; `tune.glassBreak` DEFAULT ON since the rebuild (game.ts `tune`; `glassBreakPersisted()` is on unless this machine said off; the harness stands it off — standup.ts; under the master switch `GLASSFX`, the *three parts as one* bullet), persisted `twopointsix.glassbreak`, `?glassbreak` (`?glassbreak=0` off);
  OFF = main hash for hash: the GPU side is behind the scene prelude's `GLASS_BREAK` const — `frame.ts glassBreakConfig`, raised at BOOT from the persisted switch or the flag, so
  flipping the Tab row wants a reload (the row says so); const off = the shader text main compiled before). **THE FRACTURE MODEL (rebuild, 10-08; pure geometry in
  `src/game/glassPattern.ts` — keep it and `common.wgsl gp*/gb*` + `composite.wgsl gbCracks` in step, `probes.ts glassbreak-open` compares the rule over the uploaded rows):** a blow
  leaves a SITE (≤ 8 a pane): 9‥12 hashed RADIAL cracks + straight CHORDS between neighbouring radials (partial concentric rings) → a crater (band 0), ring pieces (bands 1, 2)
  and, once the pane has RUN, forked DAGGERS to the frame, most snapped across once (bands 3‥6; fid = site × 84 + band × 12 + sector; territories = a power diagram). BY TYPE
  (`typeOfPane` — on the page the kind now comes from where the pane SITS, the *Glass as buildings have it* bullet; what follows is the first rule, the frozen stand's: OUTSIDE glass tempered — a pane with open sky over exactly ONE face, found from the level's own geometry on every level (`skySide`, cached, also the gust's inward direction; the office comes out
  as its facade rectangle had it) — interior partitions annealed, narrow sidelights / clerestory laminated; `setType` = the per-pane override, nothing authored in the level file): annealed = a round punches the crater, a round on a piece
  knocks that piece out, at `breakE.annealed` 3 (or one blow of `runSingleE`) the cracks run, the blow's own star breaks out (`runStar`) and the SUPPORT rule (`heldSet`: stands
  on the sill / a held piece below with its centre over the footing, or hangs within `hangArea` per metre of grip) drops the rest a beat later, staggered; tempered = DICES whole
  at `breakE.tempered` 1 in a ragged wave of irregular clumps; laminated = a web that never opens, only a close blast blows the sheet out. TWO SEAMS: `glass.ts glassImpact(g,
  pane, point, dir, energy, who, cause?, quiet?, { through }?) → GlassImpact` (what a round / a blow calls) and `GlassBreak.onRelease(f: GlassFragment)` (one call per fragment: outline, centre,
  velocity, tint, kind piece | dagger | clump | sheet, cause hit | support | blast | dice; null = the stand-in's `Debris` 'shard' boxes + chips). `blast(at, {radius, power, who})`
  = what a blast calls (a stun's `'bang'` arrives through `bang` at `bangPower`); the constructor hooks `g.destr.onBlast` where the build has one (its count added to `res.panes`; the break STARTS
  on that frame — pieces leave over the next ones), and one charge fed twice (that feed + its own `'bang'`) is one blow per pane: within 0.25 s at the same spot a pane takes the second arrival only
  where it is the stronger there, and then only the DIFFERENCE (`blasted`: energy, damage and the star count end as the stronger blow's alone, whichever came first; the stars and queued pieces the weaker arrival already made stay as made). `glassImpact`'s 9th argument `{ through }` = a caller that judged the round itself (the penetration part's toll): true = a hole where it passed (the
  cracks run if there was no room for a star) / tempered dices, false = annealed keeps every piece (tempered still dices at its break energy), absent = the energy decides; laminated never opens; teeth (`toothArea`) stay in the frame under a weak blast. The record =
  `GB_STRIDE` 36 rows a pane in boxMat's tail (`boxes.ts glassCellFill` ← `fill()`); a shot-out EXTERIOR pane is a wind gust source (wind.ts `'glass'`). ONE MODEL: a fallen piece
  is open to view / mirror / shadow rays (`common.wgsl glassCellOpen`), `col.raycast` / segment tests (`StaticCollision.glassOpen`), rounds and sound; a pane is WALKED THROUGH once
  nothing but teeth reaches below 1.9 m (`glassWalkable`; the nav grid is NOT rebaked). Inert when the switch is off, at chaos 0, under the tour. Holes are not saved (a load =
  restart = intact); `levelFingerprint` untouched. Deterministic (hashes of pane, point, piece — never Math.random). The NATIVE engine's reader (`trace.metal`) opens only a pane
  gone WHOLE — the per-piece rule is not ported. Tab ▸ Destruction ▸ Glass, `__glassbreak`; QA `probes.ts glassbreak` (13: off / gate / pattern / support / release / open / blast / seams /
  walk / caps / reset / gust / determinism; all but off + determinism also under `glass`), `bun run tools/qa/glass-plot.ts --out DIR` = the 2D crack plots (SVG per moment + model
  checks); notebook docs/internal/glassbreak.md (the first port's identity hashes and cost — its Voronoi model is superseded). NOT merged from that branch: wall-break (needs the checkpoint fingerprint over appended statics; since 10-08 walls DO break, by the destruction goal's own engine `src/game/wallbreak.ts` — not that branch's), fire × water,
  the showcase page.
- **Rounds through glass** (`src/game/glasspen.ts`, notes rebuild/glass/penetration.md in the project files; `GLASSPEN.on` — the PAGE ships ON, `standGame({harness})` stands it OFF
  (`glassPenHarness`: every frozen digest was recorded with rounds stopping in glass; `GLASSPEN=on` env / `?glasspen=0|1` force it; persisted `twopointsix.glasspen`, Tab ▸ Renderer fx ▸
  Glass ▸ 'rounds pass through glass'); off, or `Game.touring`, = the base digest for digest). A round carries ENERGY (`GLASSPEN.energy` by row: fn2000 1.0 · aks74u 0.9 · fiveseven 0.6 ·
  guard9mm 0.5); a SHEET takes `cost[type]` (annealed 0.10 · tempered 0.16 · laminated 0.42 — `GlassBreak.typeOf`'s typing) × thickness ∕ 12 mm × min(3, 1 ∕ cos θ) × ¼ through an earlier hole
  (`holeR` 4 cm); under `minEnergy` 0.12 left, past ~80° off the normal, or the 5th pane = SPENT in the pane (the old stop). Through: the round flies on from the far face turned ≤
  `deflectDeg` 5° × toll ∕ energy (bearing hashed off `hitSeed` — never Math.random) + a bend toward the normal. combat.ts `fireWeapon`: `roundPath()` = the flight as LEGS (`pen` null = every
  statement as it was — no pane first in the round's way allocates nothing); with `pen`, `tHit / st.t / ph.t` are metres of PATH, `st0` is the first raw hit (the contact rule's), `dir` after
  the scan is the LAST leg's; `commitCrossings` files each pane crossed BEFORE tHit once (`paneImpact(…, through)` → glass.ts `glassImpact(… energy × GLASSPEN.fractureK, 'shot', false, { through })`: true from
  `commitCrossings`, false from `spentInPane` — the toll's verdict IS the fracture's; `GLASSPEN_HOOKS.crossed` (entry / exit / dirOut / energy) is wired in game.ts to `g.shards.crossed`
  = the exit-side jet); a leg born inside a frame (`bornIn`, 1 mm past the face) is spent, inside an abutting pane crosses that too; `armThroughGlass`
  = a muzzle already past the sheet fires on. ONE MODEL: `col.shotBlocked(a, b, shrink, energy?)` collects the panes across the line and asks the same `paneToll` through `col.glassPen`
  (guards.ts clearShot / roomfight sideStep / breach pass `shotEnergy(g, c)` = the gun in his hands; callers without a man ask with `defaultEnergy` 0.5 = the 9 mm: cautious) — sight
  (segmentBlocked) and the solid walk are untouched. Holes are saved (`SaveState.glassPen`, only when present) and put back by a load ONLY while the fracture model is not live (`glassPenRestore`: with it live a load leaves every pane whole, so the holes are dropped with the cracks — where a blow filed a plain star decal instead of cracks, the star does come back with the marks, on a pane that takes the full toll again, as a starred pane always did), the switch is journaled (`knobTables`). `GLASSPEN.foesThrough` (true; Tab row 'defenders shoot through glass', `?glassfoes=0`, kept with the switch): off = `shotEnergy` — and `sideShotEnergy` for the places picked ahead of the shot: tactics.ts `losOpen`'s corners, pressure.ts's stand-off spots — hands a side hostile to Sam no energy, so a standing pane is a wall to ITS lines of fire as on the base (rounds that meet glass still cross, so a pinned man, who fires without asking `clearShot`, still puts rounds through; Sam's side still shoots through, and enemysquads.ts's `fire` is the TEAM's reach, untouched). QA: `probes.ts glasspen` (player /
  ai / rule / lines + the no-tunnel brute force / near / off; all but -off ride `glass`, -off rides all-quick); whole-run identity = `PT_DIGEST=1 tools/qa/playthrough.ts` against the base.
- **Glass, the three parts as one + the tuning rounds** (record rebuild/glass/tuning.md): ONE master switch `glass.ts GLASSFX` (`?glassfx=0|1`, env
  `GLASSFX=on|off` under bun, Tab ▸ Destruction ▸ Glass breaking ▸ the first row, persisted `twopointsix.glassfx`; ON in the page) over the fracture (`tune.glassBreak`), rounds through
  (`GLASSPEN.on`) and falling glass (`tune.glassShards`, `src/game/shards.ts`: plates + the `shard` particle kind + landing sounds + litter underfoot) — off = glass as it was
  before any of it, by run digest; the harness (standup.ts) stands all three OFF unless the run says `GLASSFX=on`, and then `GLASSBREAK=off` / `GLASSPEN=off` / `GLASSSHARDS=off`
  take one part out for an A/B (`GLASSPARTS=shipped` leaves the three as the page ships them whatever the master says: `GLASSFX=off GLASSPARTS=shipped` = the page under `?glassfx=0`, the
  stand-up the build's off-equals-the-base digests were run on; `tools/qa/glass-levels.ts` = every scenario level started the page's way with the parts as shipped — live, a pane of each kind
  shot, then the same with the master off; `node tools/qa/glass-page.cjs DIR [name=query …]` = the real page on the software adapter: the switch, the boot const, a pane broken and drawn,
  the console's errors, exit 1 when the state is not what the query should give; a session file carries `env.glassFracture` = did the recording's renderer draw the fracture's cracks —
  glass.ts files a pane's star decal, which the digest counts, only where it did not, so `standUp({env})` puts it on the replay's engine: `tools/qa/glass-journal.ts` records rounds into a
  pane as the page would and replays them — record rebuild/glass/build.md). A round feeds the fracture by its ENERGY (`glasspen.ts paneImpact` → `glassImpact(… energy × GLASSPEN.fractureK)`). NO ROUND SPRAYS TWICE: through float glass = the crater fragment's powder (`SHARDS.craterPerM2 / craterMax`, 18 % back) + the exit jet (`exitFines / exitSpeed`); through a laminated web (it never opens) = `spall` off the NEAR face only + the exit jet; spent in the pane = `spall` off both faces (`shards.spall(…, far)`, called by glass.ts only when nothing was released and the pane did not dice). GLASS IS NOT COVER: `orders.ts
  stackPosts` deals a stack off any jamb a rifle reaches through a pane (`behindGlass` ← `glasspen.ts shotThroughGlass`, `GLASSPEN.stackEyes` 3 / `stackEnergy`; 0 = off; a face
  with glass at both hands and no other floor falls back to its base marks; what `behindGlass` remembers per place is dropped whenever `glasspen.ts glassTollSig` moves — a through-hole, a piece out, a restart; NOT on a `setType` override or a live edit of `GLASSPEN.cost / stackEnergy`, which want a restart). THE TUNED CONSTANTS live in the three tables: `GLASSBREAK.blastRunK / blastDiceK / blastSheetK`
  0.2 / 0.45 / 0.75 (blast strength = power × (1 − d ∕ reach) at which float glass runs / toughened dices / a laminated sheet leaves its frame: a stun 1.2 m off opens a partition
  and only stars the frontage), `rakeOpen / rakeM` (SAM walking INTO a run pane ≥ half open — most of his pace at the sheet, within `rakeM` of it — takes the remains with him; guards never rake: the nav grid has every pane as a wall and a file passing one must not take it down), `diceHang / diceSpeed`; `SHARDS.hitFineMin /
  hitBackShare / spallOut / spallBack` (one round is seen: spray off both faces, also off a laminated web that never opens), `soundGap / soundThicken / soundOwedSecs` (landings inside a gap
  merge into the next voice, which is thickened only if it comes inside `soundOwedSecs` 0.6), `liveCap` 4000 (≤ `LIVE_CAP_MAX` 8000: overCap × it stays inside the LONG ring); `restFrost` + `restCrumbs` / `crumbSize` (round five: glass AT REST shows — a resting shard particle is drawn as the handful of grains it stands for, `particles_common.wgsl SHARD_REST_*`: wider, frosted, each grain its own brightness, small ones as soft heaps and slivers with their own outline, both strongest lights shadow-rayed; a resting plate sheds crumbs round its outline; `Particles.shardRestFrost` = block flag 8, Tab row 'glass ▸ fallen glass shows at rest', off = resting glass as it flies, which on any floor was nothing) + `thinEase / capFloor / overCap / pressLife / pressFrom` (the particle budget under a firefight: thinner, shorter-lived, never
  nothing); `GLASS.liveGap` (one 'glass' hearing event per pane PER SHOOTER per 0.2 s) and `GLASS.crackGap` (no two hit cracks start inside 45 ms floor-wide; kept per machine with the switch). Instruments (headless, no
  GPU): `GLASSFX=on bun run tools/qa/glass-tune.ts --scene all --out DIR --tag rN [--set '{…}']` (30 scenes: type × gun × one / burst / magazine / tight / walk-in / stun) →
  `glass-tune-plot.ts --in DIR --tag a,b --out DIR [--png]` (timelines + a before → after table), `glass-mix.ts` (the scene's sounds summed to a WAV + voice counts),
  `glass-fight.ts` (firefights and defenders shooting back through the conference glazing, the frontage and the sidelight). QA: `probes.ts glasstune` (blast / rake / spall /
  sound / budget / stack / off), with `glass`, `glassbreak`, `glasspen`, `shards`. NOT ported to the native engine (it keeps the base's glass); nobody has seen or heard any of
  it on a GPU.

<!-- added 2026-10-13, after the cut -->
- **Glass as buildings have it: toughened glass drops at once, and a pane's glass comes from where it sits** (2026-10-21; `src/game/glassbreak.ts GLASSREAL`,
  two rules, each ON in the page and off in the module and on the frozen stand; `FROZEN_HOLDS` rows `GLASSREAL.drop` → `TPS_GLASSDROP=1`, `GLASSREAL.place` →
  `TPS_GLASSPLACE=1` (both act only with the glass up, `GLASSFX=on`); the table is in the knob registry and the session journal, a recording from before it replays
  with both off; Tab ▸ Destruction ▸ Glass breaking, two rows). The maintainer, of a toughened window: "it seems like there are two types of glass breaking -- one
  where a shot "propagates" out a ripple and one where it breaks the glass into shards", then "let's fix toughened glass ripples to be realistic (no visible wave,
  just instant and drop) and then apply your principle for float vs. toughened glass architecturally". **DROP** (`?glassdrop=0` = the wave): a toughened sheet's
  stored stress crazes all of it in a millisecond, so nothing travels across it an eye could follow. The blow opens its own clump as before, the sheet stands
  crazed white `hang` 0.1 s, and on the step the clock passes it EVERY clump leaves (`stepDice` → `dropAll`); the renderer's one threshold on the dice key jumps
  to the end, so no shader changed. The sheet is handed on in square blocks of clumps, at most `blocks` 48 (a fragment a clump was several hundred emit records on
  one step from a facade sheet; falling glass sends 24 a step and holds 96): they fall, out along the round a little and most near it, nothing across the pane.
  A blast that dices a pane drops it the same way. What moves with it: the pane is open to rounds, sight and feet 0.1 s after the blow instead of over half a
  second, and its falling is heard once. **PLACE** (`?glassplace=0` = outside toughened, inside float): `typeOf` reads the pane, not the wall: a foot under
  `lowM` 0.7 m (it reaches the floor) or a panel of a door (within `doorM` 0.3 m of a door's opening on the plan, foot under `doorFootM` 1.5: glass beside a door within a body's reach, not a light over it) = TOUGHENED; a
  window from a sill = FLOAT; the laminated two as they were (a narrow inside sidelight, a high outside strip). Nothing is authored in a level file; `setType`
  still overrides a pane. The distance to a door is worked out each time and kept nowhere: a table of answers was game state a restarted level did not share with
  a fresh one (`probes.ts cleanrestart` line 5 on the page's stand went red on it; run that after adding any field to `GlassBreak`). WHAT CHANGED KIND, level by level (the -gwot looks, the relief and the squads block as their base): office, 9 outside windows float and
  the conference partition's 6 sheets toughened (the frontage's 4, the 2 strips and the manager's sidelight as they were); glasshouse, its 4 inside partitions
  toughened, so every pane there is; registry and consulate, the reading room's / the visa hall's partition toughened and 4 / 5 outside windows float; records, 5
  windows float (its two door sidelights reach the floor: toughened still); mousehole, 2 windows float; warehouse 3, test-rooms 1, defuse 2, block 4, bazaar 3,
  barracks 12 and the pass 8: every window float; killhouse and hall unchanged (their glass starts 0.15 m up). No pane today is toughened by the door clause
  alone. So on the page most outside windows no longer open with one round (a hole, then daggers at about three), and office-style partitions do. Rounds through
  (`GLASSPEN.cost` by kind) and stacks dealt behind glass follow the kind. THE CHECK: `tools/qa/glassreal-check.ts` (`probes.ts glassreal`, also under `glass`
  and `all`), 9 lines, each arm setting the switches itself; `GLASSREAL_BREAK=1` fails 2 to 9; run on both stands. Line 9 is every level's panes by kind against
  a table, on and off: a new level with glass adds its row. The glass probes written before this (`glass`, `glassbreak`, `glasspen`, `glasstune`, `shards`,
  `cutglass`) run with BOTH rules as the stand has them (no hold in the runner: one stood here until the build after this rule's, and on the page's stand it left
  those families asking nothing of the glass the page ships). They stage a KIND of glass in a frame they know, plain float in the conference partition, which by
  place is toughened now: so each one's stage makes the partition's sheets float with `setType` (`tools/qa/office-pane.ts floatPartition`; a no-op with the
  placement off), every other pane is by the rule, and toughened glass drops at once under them. Three of their lines were about the wave and say the drop's own thing
  when it is on (`glassbreak-pattern`: what leaves at the blow, then everything on one step `hang` later in at most `blocks` blocks; `glassbreak-open`: the sheet
  caught standing crazed, not mid-wave; `glassbreak-caps`: at most `blocks` fragments a frame from a dropping pane). The determinism volleys of `glassbreak` and
  `shards` strike one sheet made toughened, so a sheet dicing (the wave, or the drop) is inside what is compared run to run on either stand; `cutglass`'s volley
  does not. A stand-up added to those six files without `floatPartition` passes on the frozen stand and fails on the page's. Red on the page's stand since
  before this rule and not from it, same lines on the build before: `glassbreak-off`, `shards-off`, `cutglass-shape`, `cutglass-gone`, `cutglass-off`. A new line about float glass in the office stages it the same way; `glass-tune.ts` sets its scene's pane to the kind the scene
  names. The page:
  `node tools/qa/glassreal-page.cjs <outDir>` (a server of the checkout on PORT) boots it on the software adapter plain and with both flags at 0, reads the two
  switches and two panes' kinds, breaks one toughened sheet and reads it standing at step 3 and gone by step 11 (off: the wave), no console error. HEARD: `hang`
  stays under `GLASSBREAK.crackGap` 0.25, so a dropped sheet is one crack and one hearing event (the wave filed one for each 0.25 s it ran: inferred from `emit`, not counted on a big
  sheet); nobody has listened to it. MEASURED: headless only, one seed, no tour, soak or play-through tally run with the rules on against off. One round into the 1 m partition sheet: gone 0.117 s after it, 36 fragments on one
  step. The 4 m window made toughened, falling glass attached: 3576 grains born against the wave's 3764, 637 trimmed against 1087, the last record out two steps
  after the drop. NOBODY HAS SEEN any of it on a GPU or played it: the white sheet standing a tenth of a second, the fall, the look of big blocks pouring as
  dice, and how the levels play with their windows float. OPEN, the maintainer's: laminated frontage for a secure building (a level's own word on a pane) is not
  built; the manager's sidelight is laminated still, where the rule for a door's panel would make it toughened.
- **Stunned, not killed, behind a wall the burst itself broke** (`frag.ts FRAG.wallStun`, on; false = the game as it was, and a recording from before the key replays with it off —
  journal.ts; the maintainer's tap on the card, 10-13: "Stun, like doors"; an after-close step of the gear goal, commits 2efdff94 (the rule) and 578a922d (glass probes), in the build since efccd497;
  its page is rebuild/gear-and-glass/wall-stun.md; the module's own line is the frag.ts line in overview.md):
  a frag or a 40 mm burst judges everybody in reach on the lines it had BEFORE it broke anything (after the glass, which goes first as before). A man hidden then and shown afterwards was
  hidden only by the wall, cover or furniture this burst broke: it took the fragments as they flew, so he is STUNNED and folds, like a man behind a door the burst tore off (`FRAG.doorStun`) —
  never killed, never wounded. A man partly shown before the burst is judged on the part that showed; to the NEXT burst the hole is a hole. Only with the destruction switch on and chaos above
  0, so the frozen stand's play-throughs cannot move. Words: the player's line "the frag — the blast broke through your cover, stunned", the log line ends ", N stunned behind what it broke".
  `bun run tools/qa/probes.ts wallstun` (nine lines; also in families `frag` and `he40`; `WALLSTUN_BREAK=1` must fail). MEASURED by the sender (`PT_DESTR=1 PT_FRAG=1`, 20 scenarios × seeds
  1–4, 80 paired runs, rule off → on; 24 runs move): defenders killed by the squad's frags 59 → 41, wounded 45 → 34, stunned 3 → 28; teammates up 181 → 175 of 280, missions taken or rescued
  64 → 62 — the team totals inside what four seeds scatter. LEFT OPEN: a second charge on the same tick is judged through the first one's hole; `exposedTo` (what a man counts as cover BEFORE
  the burst) still counts a wall the burst will hole as cover, so a man who runs behind drywall is stunned there where before he was killed (a proper answer needs destruction to say which
  walls a burst will open); a pane only the engine's arrival takes reads as cover on the burst frame; play-through tallies do not split 'behind a door' from 'behind cover'. Never seen on a GPU.

<!-- added 2026-10-13, after the cut: the gear branch's own words for the rule above, as they stood in its frag.ts entry; the rule is in this tree from the merge that adds this line -->
- A BURST THAT HOLES A WALL OR BREAKS COVER STUNS THE MEN BEHIND IT TOO (`FRAG.wallStun`, on; false = as it was, and a recording from before the key replays so; the maintainer's card, 10-13, from his replay dump: his own 40 mm killed a teammate 4 m inside the break room through drywall it had just holed): `Destruction.blast` opens the wall inside the burst's own call and the men were judged after it, through the hole; now `blast()` asks everybody's `exposure()` BEFORE that call (after the glass, which stays the burst's by its own rule) and judges on it — a man it had no line to then and has one to now is `'stunned'` with `BlastHit.behind 'cover'` (a torn door's is `'door'`), never killed; a man who showed a part of himself is judged on the part that showed; the NEXT burst — a frame later, or a second charge on the same tick (`Defuse.blow`) — is judged through the hole; a pane only the engine's own glass arrival takes (after the snapshot; reachable only with `FRAG.glassPower` turned well down) reads as cover the burst broke. The log line ends ', N stunned behind what it broke', the player's reads 'the blast broke through your cover'. Asked only with `DESTRUCTION.on` at chaos > 0 (inert on the frozen stand's play-throughs; `PT_DESTR=1` tallies move, `--set '{"FRAG":{"wallStun":false}}'` = as recorded before); a man reckoning his cover BEFORE a burst (`exposedTo`) still counts a wall it would hole as cover. `bun run tools/qa/wallstun-check.ts` = `probes.ts wallstun`, also under `frag` / `he40`, both stands, `WALLSTUN_BREAK=1` must fail; never seen on a GPU.
- **Nobody runs onto a live grenade** (`frag.ts FRAG.fleeWise`: ON in the page, `?nofleewise` = the flee as it was; OFF in the module and on the frozen stand, `TPS_FLEEWISE=1`; a `FROZEN_HOLDS` row; a recording from before the key replays with it off; Tab ▸ 'frag ▸ nobody runs onto it'). THE FAULT, the owner's tape 'the depot' 052901: a defender's grenade landed behind the stack at door `cc` and rolled 2 m on; the flee scored a spot by its END alone from where the grenade WAS, dealt the men again each 0.4 m of roll, and its stand-still margin left men crouched in the open inside `lethalM` — one was sent over it, one got four goals.
  THE RULE, either side, the pace the flee already had (teammates `PACE.max`): judged from where it will REST (`rollOn`: the item step replayed on a copy for the fuse left, ten times a second — statics and door leaves, loose furniture not asked); no step of a leg nearer that point than he stands (0.2 m given) nor nearer the floor it has yet to roll over, its end 0.3 m farther off; the leg he has kept unless another beats it by `fleeKeep` 1.0; no ground made for a second = another leg; inside `lethalM` any such leg beats staying. Straight legs still; nothing about lines of fire or uncleared rooms.
  CHECK: `bun run tools/qa/probes.ts frag-react` lines g–k (the depot's four stacked on a held room's door, `a_s`: the door, the marks, all three rolls and, for k, one grenade AT REST are read off the level, so it stages on the old floor and the rebuilt one; the one at rest lies in front of the pair at one end of the stack, the wall at their backs, 1.9 s on it (at 1.8 the slowest man to see it has no leg worth the run on the rebuilt floor), 3.7 m out where the floor is that deep and nearer where it is not — 2.2 m on the old floor's `a_s`: as it was both got down where they stood inside `lethalM`; `FLEEWISE_BREAK=1` must fail — it fails j and k at `a_s` on the old floor (i too at the tape's `cc`, which the rebuilt floor does not have); g and h are labelled controls), both stands. MEASURED headless (the tape's door `cc` on the old floor, one deal × three rolls × both stands, rule off → on): off = the build before by run digest 6/6 and the tape walks the same; legs passing nearer 2 → 0, men turned about 9 → 0, teammates down 19 → 17 of 24 — the pair in the corner by the door has no leg that holds and still dies. Line j is NOT 'two goals at most': a man is dealt a new straight leg on arrival, and that counts as going on, not back. Never seen on a GPU, never played.
- **The rest guess counts loose furniture, and a mate's corner is his** (`frag.ts FRAG.restProps` / `FRAG.fleeApart` / `FRAG.fleeOnto`, `fleeApartM` 1.0,
  `fleeLaneM` 0.9; 10-15, two claims from the throw order's scratch runs, where a teammate's frag is thrown BECAUSE its mates can get off it). THREE SWITCHES, ONE
  WORD: OFF in the module and on the frozen stand (`TPS_FLEEMATES=1` raises all three; `FROZEN_HOLDS` rows; `STAND_ENV`), ON in the page
  (`?nofleemates` = all off; a row on the debugger's page beside the flee's own); they act only with `FRAG.fleeWise` (`TPS_FLEEWISE=1` on frozen);
  a recording from before them replays with all off (`journal.ts applyKnobs`). `restProps`: `rollOn` flew the item off the walls alone, the pool
  flies it off loose furniture too (`throwables.ts`, its ray): a grenade a chair stopped was guessed up to 3.5 m on, and a man was dealt a corner
  hidden from the guess and open to the burst. Now the same ray (asked only when some furniture stands within its reach), and the guess is judged
  from the height it rests at (`restY`: a table top, a fuse that finds it in the air), not the floor under it; a struck chair is NOT pushed in the
  guess. `fleeApart`: `takenBy` lists where others of his side are STAYING (no line to him · down where he was dealt or got to · folded or blind ·
  beyond `fleeM`) and GOING (a leg off this grenade not yet made); `fleeSpot` refuses a leg that would shoulder a staying mate (`shoulders`: its
  end within `fleeApartM`, or its way within `fleeLaneM` — bodies meet at 0.6, `squad.ts`, and a fall-in man is RE-SLOTTED by his own order when a file mate
  comes within 0.85, `doorway.ts DOORMANNERS.apart`, so the lane is wider than that — and either way nearer him than the man stands now,
  nothing solid between) and a HIDDEN spot within `fleeApartM` of where a mate is going (no wall between). Open floor farther off is anybody's
  (the stack's four rows of frag-react print as before); the leg he has is not asked again; inside `lethalM` the rule GIVES WAY when it would
  leave him no leg at all (the best refused leg is dealt: a mate shouldered beats a man dead). `fleeOnto`: a script calls a leg arrived at 0.3 m (`squad.ts`), and a
  corner's last stride is often the one that breaks the line: a man who 'arrived' 0.27 m short and still in the line was asked again, found no
  ring nearer than 1.2 m and was told to get down where he stood, in the open. Now a leg whose man is still walking onto its mark is not asked
  again until he is on it (0.06 m) or has stopped. WHAT THE TWO REPORTED THROWS WERE (staged without the order, the hand and velocity its run
  recorded): the barracks thrower was that short stop, NOT furniture (the guess was exact there, no prop struck); the depot's wounded man was
  down behind cover on fall in when a mate was dealt a corner 0.82 m off, and his own order's re-slot (0.85) walked him out, not a shove.
  KNOWN LIMITS: a corner goes to whoever is dealt
  first, not to the nearer man; a mate in the line who has not yet noticed the grenade is counted as gone; nothing holds a hidden mate behind
  his cover if his ORDER walks him out (a 70-spot depot grid by a worker, ends rule only: runs with one of ours wounded 23 → 1 of 58, the one
  left is this); a man whose near corners are all a mate's can be dealt a far one his legs do not make (depot, 0.67 s after Sam moved: one
  wounded on the way, where two were with the rules off); the player's corner is not counted; the throw order's own forecast (on its branch at this writing, not in
  the build) passes no list and keeps its own apart rule — `fleeMates(g, man, rest)` is exported for it (the deal's list before anybody is dealt; pass
  it as `wise.apart` and the man as `who`; row (b6) of the check). CHECK: `probes.ts frag-mates` (in `frag`), both stands, `FRAGMATES_BREAK=1` fails (a),
  (b), (b2), (b4) on both and (b5) on the page's stand: (a) four throws at the office's chairs, reckoned at release where they then lay (0.00 m; the walls alone 1.6 to 3.5 m
  off); (b) five stagings read off the level — the corner `fleeSpot` itself deals a man, a mate put down in it: no leg within 1 m of him, he is
  not moved 0.15 m, killed or wounded, the man still gets a leg (rules off: the man is dealt the mate's own spot in 5 of 5 and the mate is
  shoved 0.23 to 0.29 m in 4 on frozen; 4 and 3 on the page's stand); (b2) five stagings, two men one corner: never both dealt it (off: 5 of 5
  frozen, 2 of 5 page); (b3) control, 18 stagings × 3 layouts of staying mates 0.7 m off him: never left with no leg; (b4) the barracks throw: the thrower comes onto his corner and none of ours is
  killed or wounded (off: he is wounded at 6.7 m, in the open); (b5) the depot throw at two moments of the team's walk, asked on the page's
  stand only (on frozen the team does not come after Sam from the start): none of ours killed or wounded (off: two wounded each); (c) the journal line;
  (d) the stand. For the record in (b): the men themselves hit 2 of 5 either way on frozen (rules on: two wounded; off: two killed at the
  corner's mouth). MEASURED headless only, one seed a staging, defenders standing in for either side; never seen on a GPU, nobody has played
  it. A change to `fleeSpot` or `rollOn` runs `frag`, `picture` and (once it is in the build) `squadthrow-lob`.
- **Sam's place is a mate's who is staying** (`frag.ts FRAG.fleeSam`, the same word as the three above: ON in the page, `?nofleemates`; off in the module
  and on the frozen stand, `TPS_FLEEMATES=1`; the panel's 'frag ▸ furniture and a mate's corner' box; in the journal's FRAG table, a recording from
  before the key replays with it off). FOUND 10-17 on `frag-own` (b), the office's manager door, shipped stand: the kicker's leg off the squad's own
  ordered grenade was dealt onto the floor Sam stood on (`takenBy` listed the AI's men only), he stalled against him in its line for a second, and was
  killed 3.7 m from it — or was dealt again by the 'no ground made for a second' rule with a twentieth of a second of fuse to spare: which of the two
  was a matter of when the stack had formed, and the walk rule (`seenwalk.ts`, a stack that forms half a second later) tipped the check's seed 11.
  With it, a teammate's deal has Sam's place in `stay`: no spot within `fleeApartM` of him, no leg within `fleeLaneM` of his shoulder. Sam is read
  where he is: where he will go is his own business. MEASURED (shipped, the walk rule on, the ordered frag at three doors of the office floor × 20
  seeds, 60 blasts): without it the kicker is killed in 7 (all at the manager's door, each after 55 ticks stood still on a leg in its line), with it
  in none, and no man stands still on a leg in its line for half a second in any. Check: `probes.ts frag-own` line (b3), staged still on either stand
  (Sam stood on the spot the deal would give: his place is listed, the spot dealt is 1 m or more from him by a leg 0.9 m or more off his shoulder);
  `FLEESAM_BREAK=1` fails it on both stands. NOT DONE: a defender's deal does not read Sam (he is not of their side); the floor plan's forecast reads
  him where he stands when it is asked. Never seen on a GPU; nobody has played it.
- **A wall the burst will open is no cover to a man getting off a grenade** (`frag.ts FRAG.wallFlee`, 10-15; the twin of the door-leaf rule in
  `exposedTo`, built on the walls lane's read-only ask `Destruction.wallsFor` / `withWallsOpen`). A SWITCH: OFF in the module and on the frozen
  stand (`TPS_WALLFLEE=1`; a `FROZEN_HOLDS` row; `STAND_ENV`), ON in the page (`?nowallflee`; a row on the debugger's page beside the flee's own);
  a recording from before the key replays with it off (`journal.ts applyKnobs`). `exposedTo` — what a man reckons his cover by BEFORE the burst:
  the flee's hidden spots, "he is behind a wall, he stays", the mates list, a defender's own-safety gate, the door order's "a mate is in it" —
  read a hidden man again with the walls and cover the burst's own plan would open taken out (asked first, with the door leaves in, then the
  leaves it would take filtered out inside the view: the order `wallsFor`'s header asks for). Before it a man a stride behind drywall with a
  grenade at its foot "stayed behind his wall" and was folded when the burst holed it (`FRAG.wallStun`; killed through the hole with that off).
  THREE KINDS OF FLOOR in `fleeSpot` while `FRAG.wallStun` is on too: a spot the burst has no line to even with its walls open (scored as hidden
  ever was), a spot behind what it will take (`shade`: folded there, not hit — scored between, +40), open floor; a man who stands behind what
  it will take and has nothing better than open floor to go to is dealt no leg and gets down where he is — never a stun traded for a wound.
  The plan is asked once a tick a point (`WALLS_FOR`: keyed on the game's time and the walls' serial, 64 points at most), 0.12 ms a plan on the
  office; on that floor at chaos 0.5 a hand grenade's plan lists a wall at 78 of 104 floor points, so this moves most flees near drywall.
  Nothing with the destruction switch off, at chaos 0 or with walls that do not break. KNOWN LIMITS: it is the plan's limits (a plain burst
  only; beside a door the same burst takes, the real blast can open a little other than the plan; bare studs are not in the read, so a stud bay
  reads open); the picture's own `exposedTo` (`picture.ts`, a man's idea of the fight) is not this one; a STANDING man whose wall the burst will
  only port above a crouch is dealt a leg to another spot rather than ducking where he is (the deal judges him at his head's height, a spot
  at a crouch's); the older frag rows that stage "a wall between him and it" now pick a wall the burst leaves standing where the rule is on
  (`frag-probes.ts` `spot`, frag-mates (b)). CHECK: `probes.ts frag-wallflee` (in
  `frag`), both stands (it raises the destruction switch and dial itself), `WALLFLEE_BREAK=1` fails (a) and (b) on both: (a) a man a stride
  behind a whole drywall partition, a grenade a hand off its other face: 0 as the wall stands, reckoned 1, and the burst then leaves him 1;
  (a2) asking changes nothing (box flags, moving boxes, the walls' serial, the run digest); (a3) a grenade whose plan opens nothing: the plain
  test; (b) his own side's grenade live there: he is dealt a leg and is behind real cover at the burst, 3 to 4 m off (off: no leg, stunned
  behind cover at 1.4 m); (b2) from 66 sampled spots behind what a burst there would take (2.0 s and 0.8 s left), `fleeSpot` deals no floor in its plain
  line (61 to a spot it has no line to even with the wall open, 5 farther along behind what it takes; nobody had to stay down, and with only two
  kinds of floor the count was 0 too: at this site the middle kind never changed an outcome — it is a guard, not a measured gain);
  (c) the journal line; (d) the stand. MEASURED headless only, one site, one seed; never seen on a GPU, nobody has
  played it.
- **Caught by a grenade with no cover, a man leaves by a doorway that already stands open** (`frag.ts FRAG.fleeDoor`, `fleeByDoor`, 10-16; the
  maintainer's call on "a grenade lands on the squad in a bare room": they go out through the already open doorway beside them, never opening a
  shut door, never sprinting). A SWITCH: OFF in the module and on the frozen stand (`TPS_FLEEDOOR=1`; a `FROZEN_HOLDS` row; `STAND_ENV`), ON in
  the page (`?nofleedoor`; a row on the debugger's page beside the flee's own); a recording from before the key replays with it off
  (`journal.ts applyKnobs`). Only with `FRAG.fleeWise`. `fleeSpot` deals ONE STRAIGHT LEG, so in a room with nothing to get behind every leg
  ended on open floor inside what the burst kills at. Now, when the leg it deals is nothing, is in the burst's line (`exposedTo`), or stands in
  the mouth of an open doorway (`fleeDoorMouth`: the floor the others' way out runs over), `fleeByDoor` is asked: spots beside each open doorway
  within his legs' reach, on its FAR side, either hand, that the burst has no line to; the way there is the floor's own path (`nav.findPath`,
  walked by `goTo` like any script goal) and must go through that doorway, through no door that is not open, no step of it nearer the thing than
  he stands by more than `fleeDoorDip`, within what his legs make in the fuse left (`fleeDoorIn`), and not a mate's spot (`fleeApartM`). For
  the squad, floor it has cleared is preferred to floor it has not (`fleeDoorNew`), but unknown floor beats dying. The way is found as his
  own feet will find it (`goTo`'s prices), so the path checked is the path walked as it stands at the deal. OPEN = the leaf off its hinges, or
  unlatched, not swinging to, and `fleeDoorOpen` rad off its frame: a shut or barely open door is never a way out and nobody touches a handle for it. THE LEAF:
  the floor's path does not know a leaf, and a man who walks into an open one from behind swings it shut in the doorway on the men coming
  through (measured: it shut the way on all four). So no leg may come within `fleeDoorLeaf` of a leaf standing open, nearer it than he began
  (`openLeaves` / `legByLeaf`) — the way out, and with the rule on `fleeSpot`'s own straight leg too; a man the leaf stands in front of is
  dealt the floor in front of the doorway past the leaf's end first (`via`, budget `fleeDoorVia`) and is dealt again as he gets there
  (`fleeDoorViaM`, in stride, `Live.via`), or, when that takes him nearer the thing or there is no time, he keeps a straight leg. The pace is
  the flee's own (`min(runSpeed, PACE.max)` for a teammate). `FRAG_STATS.byDoor` counts the deals. Off = `fleeByDoor` and the leaf test are
  never asked: the build as it was. KNOWN LIMITS: one doorway takes about one man a second, so of four men a stride or two from a door with
  three seconds left two get out, not four; the men behind an inward leaf with the grenade behind them mostly do not; the door is judged when
  the leg is dealt (a leaf somebody then swings is not asked again until he is dealt again; his feet may re-plan on the way); a man dealt
  again past the jamb can get down where he is; the squad throw's own forecast of where mates will get to (`squadthrow.ts`) does not know
  this leg; the scripted run this came from no longer has a grenade land in that hall on the current build, so it is not a repro any more.
  CHECK: `probes.ts frag-fleedoor` (in `frag`), both stands, `FLEEDOOR_BREAK=1` fails (a) on both. The site is read off the four-man floodlit
  level (the first door with a bare side: the yard gate): (a) the gate open, four men by it, a grenade three metres in with 3.2 s left: on
  either stand 3 deals of the way out, 2 men beyond the frame and unhurt at the burst, 2 killed; rule off: nobody dealt it, 2 wounded and 2
  killed; (a2) nobody moves faster than the flee's pace; (b) the gate shut: nobody is dealt it and the leaf is on its latch until the burst;
  (c) the men the open leaf stands in front of are never dealt the way straight through it — round its end, or nothing (with the leaf not
  reckoned the same pick does send them through); (d) the journal line; (e) the stand. ALSO MEASURED by a scratch sweep, page stand, four men,
  the door open, fuse left 2.6 / 3.2 / 3.8 / 4.4 s — unhurt of four, rule on against off: the yard gate 0 2 3 3 against 0 0 0 1; the hall
  the report came from (the front door open inward) 1 2 2 3 against 1 1 1 1; killed never more than with it off; the hall with the door shut
  0 of 4 either way. Headless only, one seed a staging; never seen on a GPU, nobody has played it.
  THE COST OF A DEAL (10-17, the grenade goal's reading of it: with every door open and a defender's pace a deal ran a floor path a candidate spot, up
  to 20 ms a man): only the nearest `fleeDoorMost` 2 doorways standing open inside his reach are asked, their spots the nearest him first, a doorway is
  done with at `fleeDoorTry` 4 ways found, and the path's leash is `fleeDoorNodes` 1500 (goTo's is 6000: a way found inside the leash is the same way).
  Measured on the two stagings above, four fuses each: the same men unhurt as before the caps (hall 1 2 2 3, gate 0 2 3 3), floor paths asked at the
  3.8 s fuse 72 → 51 and 98 → 67 (`FRAG_STATS.doorWalks`); `frag-fleedoor` green on both stands. Not timed on the many-doors floors it was reported on.
- **Lying snow in a blown hole's mouth goes with the blast (10-15; the maintainer, of a wall charge on the pass: "couldn't path through a hole from a wall
  breach").** His tape (76 s, re-run headless to 0.01 m of the page): the charge cut 1.56 m out of the tea room's outer wall (box 40) and two snow banks at its
  foot (tops 0.22 and 0.36 m — over the 0.2 m a body and the walk grid are stopped from; the level keeps such banks 1.4 m off every DOOR, `pass-check` 6, and
  a charge makes a door anywhere) stood in the gap: Sam slid along it, the way across was 12.8 m round by the door, and the charge's own 'is it a hole' ray
  (`wallcharge.ts holeAt`, knee height) met the bank: "charge blown — the wall · it held", no entry, nobody past the wall felled. The hole's mouth rule
  (`furnblast.ts mouth()`, FURN.mouth) left them because a snow paint reads as the ground to a blast (`SNOW_SIM` asphalt = structure in `mouthMine`).
  SWITCH `FURN.mouth.snow` — ON in the page (`?holesnow=0` off), OFF in the module and on the frozen stand (`TPS_HOLESNOW=1`; acts only with
  `TPS_HOLECLEAR=1`), a `FROZEN_HOLDS` row, `STAND_ENV`, carried in the FURN table (a recording from before the key replays with it off: `journal.ts
  applyKnobs`; his own tape re-runs as it was played). On: a box in a snow paint (`render/snowField.ts snowPaintOf`) standing in a mouth is the rule's to take,
  roofed or not, and the furniture's size bar (`vol`) is not asked of it (a bank 15 m long is 3.7 m³) — it goes WHOLE, as every thing neither engine lists
  does, but as a SPRAY of chips from where the blast met it, never rigid pieces (a bank 16 m long cut in the mouth's dozen was slabs 4 to 7 m long, tumbling);
  the feed's 'cover' row counts a bank by its stretch at the hole (2 m, not 16: `wallreact` questions every man near the row's rect), the walk grid is
  re-baked under all of it, and a checkpoint that holds a bank is taken whatever the switch says at the load (`mouthOk(i, saved)`). With it on his tape reads: both banks gone, a 1.5 m hole, the way across straight, "charge blown — the wall · 1 down".
  Check: `holesnow` (family `furnblast`; his place from both sides, a checkpoint of it, and the five biggest banks at a wall's foot on the pass, a fresh
  stand each; `HOLESNOW_BREAK=1`), both stands. A second reader blew 14 of the 309 places where the order newly promises floor behind the wall: 14 holes. KNOWN, LEFT: (1) PICTURE — the snow field is baked at the level's start and still draws its smooth hill where the bank's box has gone (men walk
  through a drawn hill a hand or two high): the snow look's to follow, a claim sent; (2) a bank goes whole however long, for a 1.5 m hole (no rule here cuts a
  plain static); (3) 40 mm and frag go the same road (`mouth()` is the blast's) but only his wall-charge place and five more were asked. Never seen on a GPU.
  SINCE (10-16): the snow thread's step that would have made the pass's deep tiers picture-only was withdrawn (its banks still stop feet) and it took the
  banks from the outside foot of the pass's walls, the long ones among them: no bank left by a chargeable wall was over the furniture's size bar or much
  longer than a hole, so two of the check's tests could no longer fail. `holesnow` now stands the level as the file has it and draws one site's bank out
  to 15 m itself (its sixth line; the feed row asked under 3 m, was 6). Proved by breaking the rule two ways in a side tree: the row not clipped to the hole
  (row 15.0 m) and the size bar holding snow (the bank stands) each turn that line red; the lines before it stayed green under the second. Both stands.
- **What the walk grid calls floor, feet cross** (`UNDERFOOT` in `src/scene/collision.ts`, 10-17; the maintainer, of two wall charges on the pass: "one
  set of guys couldn't pathfind through the wall breach"). His tape, re-run: the pair at the store's wall were sent through their hole and walked on the
  spot at the wall's line (z 5.0) until the tape ended. The store keeps sacks against that wall; the blast took the pile's upper layers and left the
  bottom one in the hole (two sacks, top 0.2 m). The walk grid's bake asks from 0.25 m up, so the route went straight across them; a walking body was
  asked from 0.2 m up, and a top AT 0.2 is in that band. THE RULE: a circle test that begins at 0.2 m or above and under 0.25 begins at 0.25
  (`collideCircle`, `circleTouches`): every walker — the men, the player, civilians, the stand-here tests — is stopped by what the bake calls blocked and
  by nothing lower. Nothing re-baked, nothing drawn. SWITCH `UNDERFOOT.on` — ON in the page (`?underfoot=0` off), OFF in the module and on the frozen
  stand (`TPS_UNDERFOOT=1`), a `FROZEN_HOLDS` row, in the registry and the journal (a recording from before the table replays off), a debugger row.
  Check: `underfoot` (family `furnblast`; his breach blown on a fresh stand, a body walked along the grid's own way with the walkers' call, the level at
  rest, a slab 0.2 m high the check lays across open floor and re-bakes over, off, the journal; `UNDERFOOT_BREAK=1` fails on both stands). MEASURED: the tape walked on from 127 s with the rule raised — both men in the
  store and holding by 133.8 s, against never; every level file stood up on the page's stand and its grid's floor asked with the walkers' call: at rest
  the two bands part on the pass alone (23 cells: the low steps of three snow banks, tops 0.22 to 0.25 m — on, those steps are waded and the bank stops
  feet one step further in) and on one 0.2 m box of the pairs lesson. SINCE (`FURN.mouth.base`, its own bullet below): the hole's last pass takes that bottom layer too, so at his
  breach the hole is clear and this rule is what holds wherever such a low thing is still left on floor the grid routes across (a man walks THROUGH it: feet
  do not rise); the check holds `FURN.mouth.base` off so that his breach keeps the sacks its line asks about. A hauled body and a
  shoved chair are asked lower than a walker and still meet such a thing (a body dragged behind its carrier catching there: not looked at); a thing whose
  top is 0.25 m or more is a wall to feet and grid alike, as before. Never seen on a GPU; nobody has played it.
- **A window's bar breaks from one round** (`src/game/winbars.ts`, `src/scene/bars.ts`; the maintainer, 2026-10-25, of The Pass's windows: "for gameplay
  it'd be nice if they broke off with the glass and just as fast. so each bar breaks up with just a single bullet?"; page rebuild/window-bars/read-first.md).
  SWITCH `WINBARS.on`: ON in the page (`?winbars=0` = a bar stops every round like the piece of wall it was), OFF in the module and on the frozen stand
  (`TPS_WINBARS=1` raises it; `FROZEN_HOLDS` row; journal: a recording with no `WINBARS` table replays with it off), inert while a showcase runs. No panel
  row. WHAT A BAR IS (`bars.ts barLevel`, run as a level is stood up beside `thinLevel`; the mark is `BoxFlag.Bar`, CPU-only, stripped on export): an upright
  no more than 10 cm across and 25 cm deep, at least 40 cm high, plain (not glass, lit, tilted, cut or a picture), standing on a sill at least 20 cm off the
  floor and under a lintel, each a piece of a wall the bar is 0.72 to 0.88 times as deep as (the kit builds 0.8: `levelKit.ts` mullions). By the box alone,
  glazed or not: 180 bars over the level files as they stand, every upright the kit stood in a window and nothing else (the check counts them against the
  kit's own paint; The Pass 4, the barracks 22, some of them in windows with no glass). NOT bars: posts, table legs, jambs, and the office
  conference wall's four floor-to-ceiling uprights (they stand on the floor and hold the wall's head: left as structure, a call for the maintainer).
  THE RULE, one for Sam, the squad and the defenders: a round that would stop in a standing bar takes it and flies on — no toll, no turn, any gun, one
  pellet of buck as much as a rifle round (`combat.ts fireWeapon`: the bar is hidden for the rest of that round's flight and the flight asked again, panes
  and thin walls and all, up to `perRound` 4 bars; once the round's end is known every bar it reached is broken and one behind a man or a chair on the near
  side stands as it stood). A line of FIRE passes a standing bar (`collision.ts shotBlocked`, `firePass`): a man shoots at what is behind a bar exactly when
  his round would get there. Sight, sound, feet, a thrown thing and a gun pushed against one meet a standing bar as before. A BROKEN bar is hidden the way the
  lane hides everything (NoPrimary | NoShadow; the geometry serial moves, sound routes and the smoke's obstacles are asked again; no nav change — a bar
  stands on a sill), so guards, aim, sight, the fog's eye and sound all treat it as gone. It leaves as `pieces` 3 uneven lengths in the debris pool, thrown the
  way the round went (they land and are heard by the pool's rule, hurt nobody, stop nothing), plus chips where GPU particles run; the round's impact sound
  plays at the bar. A blast the destruction lane judges takes every standing bar inside its radius (× `blastK` 1) that it has a clear line to — asked at
  the bar's middle and toward each end (a burst at the wall's foot has no line to a bar's foot past its own sill), every bar in reach judged as if the
  others were not there, the pieces thrown out from the blast — before the walls are judged. A burst's lethal line (`frag.ts burstBlocked`) asks the line of
  fire, so it too passes a standing bar while the rule is live. Deterministic (`hash01` of the bar's index and the height struck). A restart stands every bar again; a checkpoint files which are gone
  (`savestate.ts` slice `bars`, absent when none is: the file is then what it was) and refuses a slice that names a static that is no bar.
  A GLAZED BAR: the kit's panes meet inside the bar, so with rounds through glass off (the frozen stand) the round that takes the bar stops in the glass where
  it stood; on the page it goes on through. NOT built: `wallpen.ts thinLine` (a man firing through a thin wall at a man he knows is behind it) still reads a
  standing bar as the end of his round; a round that enters a pane at a slant so close beside a bar that it would leave the glass inside the bar is spent
  in the pane, as before, and the bar stands for the next one; no sound of its own; every number in `WINBARS` is a constant nobody has played.
  CHECKS, both stands: `probes.ts winbars` (also in the `glass` family) = `winbars-check` (the inventory against the kit's paint on every level and each
  GWOT twin's count; off: the round stops in the bar and the line of fire is blocked; on: the line of fire is clear across a standing bar while sight and a
  plain ray still meet it, one rifle round / one pistol round / one shell takes the bar, the round kills the man 1.3 m behind it, three pieces come to rest
  below the sill; the near-side man spares it; a glazed bar on The Pass; a blast with the lane on, and with the rule off; restart; checkpoint into a fresh
  game and the refused slice; the journal row, the page's flag, the showcase inert; `WINBARS_BREAK=1` must fail, on each stand). ONE CHECK OF ANOTHER RULE HOLDS IT OFF, with the reason in place:
  `glasspen-probes.ts` glasspen-lines (it asks that the line of fire and glasspen's `roundPath` agree line for line; with bars live the line passes a
  standing bar that `roundPath` alone stops in — red on the shipped stand until held: 94.28 % of 2640 lines against the 99.5 % asked).
  ON THE REAL PAGE, software adapter: `node tools/qa/winbars-page.cjs` (The Pass as it opens and with `?winbars=0`: one clicked round and the bar is gone
  and in pieces / the round ends at the bar and it stands; no console error).
  MEASURED 2026-10-25, headless: off = the base by run digest — the frozen stand on The Pass and the barracks × seeds 1-2, and the shipped stand with
  `--set '{"WINBARS":{"on":false}}'` on The Pass, the barracks, the registry and the consulate × seeds 1-3, each run's digest the base build's own. The same
  12 shipped runs with the rule on: 8 differ by digest (bars are shot in play), 11 of 12 won on both arms, squad men standing 28 → 27 of 42, defenders
  left 2 → 2 of 84. Twelve runs say the rule plays through, nothing about balance.
  NEVER SEEN ON A GPU, never played: how the pieces and chips look, whether a bar going reads at a glance, and how a window fight feels without them.
- **Rounds through thin walls and doors** (`src/game/wallpen.ts`; the maintainer, 2026-10-16: "a rifle round carries on through drywall, partitions and
  wooden doors with the energy it has left, as it already does through glass"; page rebuild/thin-walls/read-first.md). SWITCH `WALLPEN.on`: ON in the page
  (`?wallpen=0` = a round stops in the first built thing it meets, as it did), OFF in the module and on the frozen stand (`TPS_WALLPEN=1` raises it;
  `FROZEN_HOLDS` row; journal: a recording with no `WALLPEN` table replays with it off), inert while a showcase runs; Tab ▸ Renderer fx ▸ Glass ▸ 'rounds pass
  through thin walls and doors' + a counter line. No state: nothing rides in a checkpoint. THE ROUND: it carries the glass rule's ENERGY (rifle 1, 9 mm 0.5,
  one pellet 0.3); a THIN THING is plasterboard in the wall paints up to 17 cm with ceiling over both its faces (the wall engine's own partition test, asked
  of a sill or a header too: a building's shell is structure whatever its paint), wood up to 12 cm, a fabric screen, cardboard, a plant, and a door leaf that is
  not steel and still hangs; the toll is `base[stuff] + perM[stuff] × metres of path inside the box` (a slant pays more by its longer path; over `maxThru` it
  is running along inside the sheet and is spent), under `minEnergy` left or past `maxThings` things it is spent, and NOTHING ELSE MAY STAND IN THE SPAN (a
  jamb post, a planter under its plant: the round stops there as before). So a rifle round has four or five partitions or three door leaves in it, a 9 mm two
  partitions or one leaf, a pellet one partition and no leaf (the shotgun's lock rule keeps its pellets). It leaves turned inside a small hashed cone, marks
  and chips BOTH faces, and where it went in the wall engine still counts it (a partition still opens under sustained fire — it no longer has to first). One
  flight for Sam, the squad and the defenders; a round that is through is a round (no hit points anywhere). Concrete, stone, steel, a steel door, anything
  tilted, lit, a fixture: stopped, as ever. With the rule off `fireWeapon` flies glasspen.ts `roundPath` untouched; `thinPath` is the same loop with thin
  things added (over glass alone the two are swept equal by the check). THE MEN (`WALLPEN.men`, a row of the same rule, no switch of its own in the page):
  a man who KNOWS an enemy is behind a thin thing — his own sighting, cover fire's books — asks `thinLine` whether his gun's round gets there and puts a burst
  of at most `thruRounds` (4) through it on that sighting (`coverfire.ts ask`, kind 'thru': defender, teammate on the fight AI, teammate under an order;
  a wooden door leaf too; never on a mate's call, never past a friend / hostage / civilian in the lane as far as the round would fly, never through glass
  for a side whose rounds are not laid through panes; booked as `thru` / `thruShots`, not as a chew; cover fire now also runs with the destruction switch off
  when this is live, and a partition a round crosses is fired THROUGH, not chewed open); and a man picking cover from a gun (`suppression.ts coverFrom`: pinned
  men, the room fight, the clear line, the wall reactions) takes a place the hardest round in the game does not reach before one that is only hidden — the
  hidden one is still his when there is no other. NOT built: the line of fire asked about an enemy in SIGHT (`shotBlocked`) still ends at a partition; door
  stacks do not move off thin walls; nobody fires at a sound through a door (a call for the maintainer). CHECKS, both stands: `probes.ts wallpen` =
  `wallpen-check` (toll arithmetic, chains by gun, slant and graze, hard wall and steel door, fired rounds on and off through a partition and a leaf, the
  near-side and far-face man, 6000 flights with no box inside any span crossed, glass-only flights equal to `roundPath`'s, the wall engine's count, the
  showcase inert, the journal row; `WALLPEN_BREAK=1` must fail) and `wallmen-check` (the line says yes exactly where the round arrives; the three kinds of
  shooter fire through a partition and a leaf at a man they saw, not at one they did not, not through concrete; one sighting = one burst, seen again =
  another; 120 cover picks; `WALLMEN_BREAK=1` / `WALLPEN_BREAK=1` must fail). FIVE CHECKS OF OTHER RULES HOLD IT OFF, each with the reason in place: `coverfire-probes.ts` (it asks the chew), `destruction-probes.ts` dust (it asks
  the dust of a burst that stays in the plaster; beside its hold on the wall engine, for the same reason), `wallwear-probes.ts` (it counts one
  mark a round that STOPS in the wall; a round that goes through marks the far face and what it meets beyond — where it went in, the wall engine's wear look
  still takes its mark, and the game digest is the same with that look on and off: `wallpen-check` asks both) and `roomfight-probes.ts` next-room (its fight is a
  teammate's rounds INTO a wooden door for the noise; with this rule they come through past the two men inside, `lanes.ts` opens a lane on that door, and
  nobody walks over alone to a fight at a lane's guns: 0 of 8 went, 6 of 8 with the rule off — two rules together, as each is written); and `enemysquads-probes.ts` contact (a
  teammate's rounds at a man by the mess's far partition go on through it and the comms room's, a man of the third squad drops in his own room, and that
  squad is in contact before its word — its own rule reading its man down, not the answer to a call on the net that the probe asks; seen on the shipped stand
  only after the build carried the rule, seed 2).
  ON THE REAL PAGE, software adapter: `node tools/qa/wallpen-page.cjs` (the page as it opens and with `?wallpen=0`: a clicked round ends beyond a partition's
  far face / at it, the Tab row and its counter, no console error).
  `tools/qa/wallpen-inventory.ts` prints, per level, the metres of full-height wall a round goes through. Off = the base by run digest: four squad missions
  × 3 seeds on each stand. EVERY NUMBER IN `WALLPEN` IS A CONSTANT NOBODY HAS PLAYED. MEASURED 2026-10-17, shipped stand, the autopilot squad, the same
  seeds off and on (`ships.ts --scn <rows> --seeds 1-12 --set '{"WALLPEN":{"on":false}}'` against `--set '{}'`): the 19 listed squad rows, 228 runs an
  arm, won 158 → 153, squad men lost 350 → 353 of 792, defenders left standing 302 → 325, squad men killed by a man with no line of sight 68 → 84
  (Mousehole 5 → 18), 98 bursts through (201 rounds); with the men's row off (`--set '{"WALLPEN":{"men":false}}'`) won 151, lost 354: the rounds move it,
  the men little. The 10 two-way rows on their second way: won 83 → 82 of 120, lost 246 → 250 of 456; two of those 120 runs with the rule on hit the 300 s
  cap with a last defender holding outside (not seen in any other arm, not explained). ONE ROW LOOKS MOVED: rescue-consulate over seeds 1-36 won 27 → 20,
  squad lost 49 → 61 of 144, every lost run the captor's clock (no hostage was hit by a round, off or on); compound-four's 6 → 4 on 12 seeds was chance
  (20 → 22 over 36). Twelve seeds a row is thin: a run diverges from the first round that goes through.
  Never seen on a GPU (the marks and chips on the far face, the rounds' tracers through a wall); never heard.
- **The bottom layer of a pile a blown hole takes goes with it** (`furnblast.ts mouth()`, `FURN.mouth.base`; the maintainer, 10-17, of two wall charges on the
  pass: "one set of guys couldn't pathfind through the wall breach"). The store keeps sacks in piles against that wall, each layer 0.2 m thick; the blast took the
  layers above and left the bottom one lying in the hole, because the hole rule passes over what is no higher than a step (top at or under 0.2 m: a mat, a kerb,
  a low bank) and the furniture's own bands never list a thing that low (`FURN.root.minTop`). The feet's side of that tape is `UNDERFOOT` (collision.ts, check
  `underfoot`: a walker's test begins where the walk grid's bake does); this is the blast's side. THE RULE, a last pass of `mouth()` over the zone: a low thing
  with a body (`FURN.mouth.baseThick` 0.08 m: no mat) that CARRIED something now gone, by this blast or an earlier one, goes too, with whatever still rests on
  it; one that carried nothing stays, as does one with a thing on it the hole rule never takes. `mouthWouldTake` is as it was (nothing that low shuts a cell of
  the walk grid). SWITCH: ON in the page (`?holebase=0`), OFF in the module and on the frozen stand (`TPS_HOLEBASE=1`; acts only with a blown hole cleared,
  `TPS_HOLECLEAR=1`); in the journal with the rest of `FURN`, a recording from before the key replays with it off. Check: `holebase` (family `furnblast`;
  his breach with the rule on and off, the bars on the same site with the piles reshaped — a 0.06 m mat under taken layers, a block past the rule's height bar
  on a bottom layer —, the switch; `HOLEBASE_BREAK=1`), both stands (the piles are the store's lived-in dressing: the check raises `LIVED.on`, which the
  frozen stand holds off, so the site is the same on both); each bar was also broken in the code in turn and the line it holds went red. MEASURED,
  headless, his site only: of 14 sacks in the two piles by the hole, 4 bottom ones were left before and none are now; the bank at the wall's foot (top 0.17 m)
  stays. Across the levels every small floor thing with a top at 0.2 m is the bottom of such a pile (read off the level files, 10 levels have them). Nobody
  has seen the hole on a GPU or played it.
- **A wall shot's smoke is thinner and its shock fills the room** (`WALLSHOT`, `src/game/wallcharge.ts`; the maintainer, 10-19, of rooms on the mousehole
  taken through blown walls: "the smoke after a wall shot makes it too hard -- we should probably (1) turn down its density a little and (2) make it so
  everyone in the room gets more of a shock"). WHAT HIS RUN SHOWED (his replay walked headless, exact): the one man in the first room, 3 m from the
  charge, was folded 2.0 s and blind 4.7 s, came up inside the pall and shot the first man at the hole 2.7 s after the blast. THE RULE: (1) the charge's
  pall is asked at `pall` 0.75 of its density (`CHAOS.pall.wall.density` 0.8 → 0.6; a trailing `gain` on `pallWall`, the picture's own dust count scaled
  with it; a grenade's pall and the charge's borrowed report untouched). (2) Every DEFENDER in the room the hole opens into (`cleared.roomAt`, found by
  stepping in from the far face: furniture against the wall is no floor to the room map; open floor is no room) is shocked: with a line to the hole,
  folded `staggerSecs` 3.5 s (it was `DOORTOOLS.staggerSecs` 2.0) and blind `stunSecs` 8 · 4 s at the wall · at 8 m (it was 6 · 2.5); with NO line, or
  past 8 m, where he was untouched, folded the same 3.5 s out to `roomM` 12 m and not blinded (the flash needs the line). One of ours and the player
  beyond the wall with a line: blind `oursSecs` 2.0 s (it was 1.5), never folded (one of a team of TWO beyond the wall takes what a defender there takes, as
  he always did, so the longer numbers are his too). The reach inside which a man behind the wall is killed is as it was and needs the line; nothing here
  touches health. The room map is asked once BEFORE the blast, so that a map nobody had built yet is not flooded through the new hole (a map first built
  on a floor that already has holes, a restored one, can still name no room: then only the lined men are shocked, as before). SWITCH: ON in the page (`?wallshot=0`), OFF in the module and on the frozen stand (`TPS_WALLSHOT=1`); its
  own table in the registry and the journal, a recording from before the key replays with it off. Check: `wallshot` (family `wallcharge`; his first,
  second and third walls on a fresh stand of his level: the lined man's numbers by the table, a man with no line folded where he was untouched, furniture
  against the far face and that man rooted to the end of his fold with the game running, a lined man inside the killing reach killed either way, the
  room's reach drawn in, the next room untouched, ours and the player the same seconds, the pall's emitters each at 0.75 with the blast's other emitters
  unchanged, the switch in a recording; `WALLSHOT_BREAK=1`), both stands. MEASURED ON THE PAGE (`tools/qa/pall-page.cjs` on-charge, the block's
  wall, software adapter, verylow, two runs with `?wallshot=0` and two without): the line THROUGH THE HOLE read hidden (under 0.3) 2.75 s both times before and 2.25 and
  2.5 s now (0.02 → 0.06 a second after the blast, 0.13 → 0.22 two seconds after); along the wall on the charge's side 2.0 s before, 1.5 s now. So a lined
  man, who came up at 2.0 s inside a hole still hidden, now comes up at 3.5 s, a second after it reads again. Runs differ by a quarter second. NOT
  MEASURED: no tally over seeds (how often a room taken through a wall costs a man before and after); never seen on a GPU or played; the seconds are a
  first setting for the maintainer's play, not a tuned one.
- **A wall charge kills whoever stands at it** (`WALLKILL {on, nearM 1.5}`, `src/game/wallcharge.ts blow`; the maintainer, 10-19, a room clear on the kill
  house on hard, god mode off, standing 0.9 m from a charge he had set on a wall when he pressed the trigger — the log said 'you were too close' and he walked
  on: "blowing a wall charge with me right next to it should kill me"). A blast does to the player what it does to anyone, so it is ONE rule for every man on
  the floor (the player, ours, the defenders, a civilian who is in the building): on the charge's OWN side nearer than `nearM` with a line to it he is killed
  — dead as a frag leaves a man (`'shot'`; he was blind 3–1 s by the safety radius, the player rocked and blind with him); BEHIND a wall it opened, nearer
  than `DOORTOOLS.knockM` 2.0 m with a line to the hole, he goes down as a defender there always did (the charge's knock, `'struck'`) — now the player too
  (he was blind 2.0 s), and one of ours whatever the team's size (a big team's man was blind 2.0 s; a team of two's already went down); past that reach one
  of ours behind the wall is blind as one of ours whatever the team's size (on a team of two he took a defender's 8–4 s and its fold: the claim nobody had
  built — the WALLSHOT bullet's 'one of a team of TWO' sentence is true only with this off). The player goes down as a round puts him down (`hitPlayer`, his
  one hit): never in god mode, never the tour's scripted player; a man with `Guard.god` is passed over. Past `nearM` the safety radius is as it was. A wall
  that held is still a wall to the men behind it. WHO BLOWS IT: the player's trigger and his order's release — and a plan's own clock
  (`host/kitView.ts`), which is no press of his: that caller passes `pressed` false and its blast is the blast as it was (its own gate waits for the charge's
  side to be clear on a wall way and asks nothing of who is behind the wall: the plan's owner's to decide). With the safety radius on (the page) the
  trigger's row names who is too close and who is behind the wall before the press. On the debrief a man killed at the charge is a kill by 'a wall charge'
  (`chronicle.ts chronDown`, told by the line); the knock behind the wall is filed as it always was (a knockout, a 'takedown' on the timeline: not mended
  here). The lead killed at a wall that held does not say 'no way through.': whoever of his is left does. THE DOOR CHARGE IS UNTOUCHED (its own side
  dazzles inside 1.6 m, the player beyond it is dazzled). SWITCH: ON in the page (`?wallkill=0`), OFF in the module and on the frozen stand
  (`TPS_WALLKILL=1`); `FROZEN_HOLDS`, `STAND_ENV`, the `pinned` line, its table in the registry and the journal (a recording from before the key replays
  with it off). Check: `wallkill` (family `wallcharge`; the mousehole's long wall on a fresh stand each time: the player 0.9 m from his own charge down
  and still down 0.75 s on, up in god mode, up and blind by the radius 1.9 m back; one of ours and a defender at the charge dead where they were blind;
  the player, one of ours and a defender behind the wall inside 2 m down by the one knock; one of ours past it blind 2.0 s on a team of four and of two; a
  wall that held; the plan's clock; the switch in a recording — 11 lines; `WALLKILL_BREAK=1` fails 6), both stands. `wallsafe` holds this rule off in its
  own stand (it stages men 0.9 m from the charge for the radius's own numbers). MEASURED: his own tape walked headless to the blast (drift under a
  centimetre): he stood 0.94 m from the charge, indoors, 0.81 of the blast's share — with the rule off the log's line is the one he got, with it on he is
  down on the blast's step. NOT MEASURED: no tally over seeds (the soak's bot blows no wall charge it stands at); a civilian and a `god` man at the charge
  are in the code and not in the check; never seen on a GPU or played — the body thrown and the down card are the round's own. `nearM` is a first setting
  for the maintainer's play. THE SETTER'S WORD (10-19, a claim measured by another lane on five walls: the man the squad sends to set a charge stands
  0.5 m from it as it goes on and takes 1.1 to 1.2 s to pass 1.5 m; a press on his "charge set." killed him five times of five): with the rule on he
  says "charge set." once he is `nearM` from the charge he set (`WallOp.owes`, said in the stand-off phase; a man who cannot get that far says only
  the call), not with his hands on it. The trigger refuses nothing and the row's TOO CLOSE is as it was. Rule off: his word on the frame it is set, as
  before. Check line 12 of `wallkill` (the ward's four: 0.53 m as it goes on, his word 1.15 s later at 1.50 m, blown on the word nobody lost;
  `WALLKILL_BREAK=1` now fails 7). The squad never blows a wall charge itself: `blow()` is called by the player's trigger, by the order's row released
  again on a set charge, and by a plan's clock (which does not ask this rule).
- **A second look before a man settles for open floor** (`frag.ts FRAG.fleeLook`, the same word as the flee's other mends: ON in the page,
  `?nofleemates`; off in the module and on the frozen stand, `TPS_FLEEMATES=1`; the panel's 'frag ▸ furniture and a mate's corner' box; in the
  journal's FRAG table, a recording from before the key replays with it off). FOUND 10-20 on the depot throw of `frag-mates` (b5), swept over the
  moment of the team's walk behind Sam (the check held two moments, both clean at either pace): at 27 of 57 moments (every 3 frames, the page's
  pace) the thrower, 5 m from where the squad's own grenade would rest and with a mate staying between him and the nearest cover, was dealt OPEN
  floor 7.3 to 7.8 m off it (inside `woundM`) and wounded there. Not the walk's pace (the old pace: 7 of 14 moments): `fleeSpot` asks 32 turns on
  rings at 1.2, 2, 3, 4 m, `fleeApart` bars every leg within `fleeLaneM` of a staying mate, the 20-odd covered spots the walk asked were all that
  mate's, and the covered floor between the rings and the turns was never asked. With the key, a walk that ends on open floor or on nothing AND
  met covered floor that was a mate's is walked once more on the rings between (`LOOK_RINGS`), each turned half a step: the same tests and score;
  only cover, or floor past `woundM`, is taken from it; it hands nobody a leg that shoulders a mate (the `bar` fallback is the first walk's alone).
  A man the first walk finds cover for, and a man with no mate's cover in reach, is dealt exactly as before — the second walk is not run for him.
  It runs for either side's men (a defender beside a mate's cover too) and under the squad's duck forecast, which asks `fleeSpot` as the deal does
  (`squad.md`). COST: the deal of the man it runs for is about twice the first walk's (a review's measure on the office before the walk was
  narrowed to a mate's cover: 0.19 → 0.38 ms a call); nobody else pays. CHECK: `frag-mates` (b7), either stand: the four and Sam stood by hand
  where that deal found them — key off, open floor 7.6 m off it; key on, covered floor, no nearer a staying mate than a leg may pass. (b8), the
  page's stand: the throw at ten moments of the walk, one of ours hurt at no more than 1 (0 measured; 4 with the key off), and the journal and
  `FROZEN_HOLDS` row. `FLEELOOK_BREAK=1` = the key left off: (b7) fails on both stands, (b8) on the page's. MEASURED headless only, ONE staging
  (the depot's four, seed 1): 27 of 57 moments → 4 of 57 at the page's pace; at the old pace, with the walk not yet narrowed, 7 of 14 → 4 of 14.
  `frag`, `squadthrow` and `picture` hold on both stands. The soak on the page's stand (seeds 1, 2, 3, 12 minutes) prints the
  same lines with the change and without it (it is red there either way, as the tour is). NOT MEASURED: defenders getting off the player's
  grenades, any tally over seeds or levels. WHAT IS LEFT (the 4): one deal where the second walk finds nothing either; two where a man dealt cover is dealt again
  onto floor in its line; one who gets down on a covered spot with half of him still in its line (the same with the key off). The lattice is
  still a lattice: cover between both walks is missed, and a search of the floor round a mate's cover would be the better rule. Never seen on a
  GPU, nobody has played it.
- **The player's grenade and 40 mm checks run on the loud card** (`frag-player`, `he40-*`, `burst-breaks`; no game code). A night alone on the page
  wears your STEALTH card (`kit.ts KITDEAL.stealth`), which issues no frag and no HE round, so on the shipped stand these stood a Sam with nothing
  to throw or fire and were red from the step that brought that card. They ask the grenade and the round, which only the loud card issues: they
  are on the probe runner's hold for checks written against one card (`probes.ts STEALTH_AS_IT_WAS`; `TPS_KITSTEALTH` set by hand wins). What a
  stealth run is issued is `kitstealth-check.ts`'s. `he40-keys` (d) also said 'teammates have no such row': a teammate's card has the row where
  his one round can be fired on your order (the card as a tree and `squad40.ts`; `kittree-check.ts` holds it), and the line now asks exactly that.
- **A burst kills a man who is down and breathing** (`frag.ts FRAG.downKill`, 10-22; from play: two men put out with sponge rounds, a 40 mm burst
  beside them, and both lay there breathing — `blast()` passed over every man already down, and `killGuard` returns on one). OFF in the module and
  on the frozen stand (`TPS_DOWNKILL=1`; a `FROZEN_HOLDS` row; `STAND_ENV`), ON in the page (`?nodownkill`; a row on the debugger's page beside the
  grenade's others); the journal carries it and a recording from before the key replays with it off. The rule: an ENEMY of the player's who is out
  cold (struck, choked) or down wounded is judged where he lies — his hips (the range is measured to them), chest, head and a shin, the same lines
  and the same wall and door rules as a man on his feet. Inside `lethalM` any line to him kills (no 'wounded' for a man who cannot flinch); past
  it, the burst's own chance; a burst that does not kill him leaves him exactly as he was and writes no row. Everything through `blast()` has it:
  the hand grenade, the 40 mm HE round, anybody's. The books, as `wounds.ts` does for a round into a wounded man: `downKind` 'shot'; by the
  player's burst a kill on the card in place of the knockout that was there, a 'kill' row on the timeline naming the grenade, a shooting for
  whoever watched; by a partner's on a quiet mission as two, the same swap (`teamtally.ts teamTallied`, new: the test that module makes the step a
  man goes down, asked of him later); by anyone else's, his record names that man and the player's card does not move. The report counts him in
  `killed` and in `finished`, and the log's 'N down' is the men who were up. The body is shoved off the burst (`downShove`). A defender does not
  throw where the burst would reach a mate of his who is down breathing (`ownClear`, as `squadthrow.ts` already has it for the team). NOT ASKED:
  a teammate or a hostage who is down, and a civilian (what her death costs is `civilians.ts`'s to say); a wall charge and the stun charge (they
  do not go through `blast()`). NOT MENDED, seen on the way: a man on his feet killed by a burst is filed on the timeline under the gun in hand
  (`chronicle.ts chronDown` reads the weapon off the hand), so one burst can write two weapons. Check: `frag-down` (three men put down the way a
  ring to the head puts them, a burst beside them: dead in the open, breathing behind a wall and past the reach; the 40 mm's call; a wounded man;
  a defender's grenade; the pair's card both ways; a watcher's memory and his own throw; a teammate passed over; off = as it was; the journal;
  the stand), 14 lines green on both stands; `DOWNKILL_BREAK=1` fails (a), (a2), (d), (e), (f), (f2), (f3), (g2) on both. Never seen on a GPU,
  nobody has played it.
