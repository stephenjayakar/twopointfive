# Defenders, guards, civilians

One of the area files CLAUDE.md indexes. Everything below was moved here word for word from CLAUDE.md on 2026-10-13, in its old order;
"the bullet above / below" in a bullet means its neighbour there (each block says which lines it was), and a bullet named by its bold
title may now live in another file of this folder: `grep -l '<title>' docs/agents/*.md`. New bullets for this area go at the foot of this file.

<!-- was CLAUDE.md lines 358–366 -->
- **A calm guard burns his torch only where he needs it** (`src/game/calmtorch.ts`, `TORCH.calmOff`: on in the page, `?calmtorch=0`; frozen stand off, `TPS_CALMTORCH=1`; a `FROZEN_HOLDS`
  row, in the knob registry and a journal's tables; Tab ▸ Sandbox ▸ Detection & movement ▸ 'calm guards: torch only in the dark'): a STAFF man on a plain patrol (`handCarry` 'torch',
  awareness < `calmAw` 0.3, no errand / body duty; never under a show) still carries the hand torch, but its light is off while his place is lit enough to work in — the place's own steady
  light (`lightEstimateAt(…, steadyOnly)`, nothing carried) ≥ `litAt` 0.2 where he stands or on floor in plain view within `spillM` 3 m (by day, daylit floor within `dayM` 12 m, through
  glass), and the same `aheadM` 5 m down his way — and on in real dark (on after `onSecs` 0.3, off after `offSecs` 2 of floor at `offK` × the bar, ≥ `holdSecs` 1 between clicks; a soft
  `click` for the player, no event). The one seam is the last line of guards.ts `poseFlashlight`; the torch is one of the meter's lights, so this changes play by intent. Anything not calm
  (suspicious, a whistle answered, alert, search, drawn pistols, units) is as it was. The dwell is seconds counted, saved as the optional checkpoint slice `calmTorch`. The office's
  three, torch burning: night 3 / 39 / 20 % of the patrol (Kowalski / Novak / Reyes; the lobby, the break room, the cubicles' unlit ends), dusk 3 / 2 / 0 %. `bun run tools/qa/calmtorch-check.ts` (`probes.ts calmtorch`;
  `CALMTORCH_BREAK=1` must fail). Never seen on a GPU: the estimate has no bounce, so the bar is a guess.

<!-- was CLAUDE.md lines 1392–1427 -->
- **The difficulty switch + the harder defenders (10-07;** record rebuild/harder-defenders/numbers.md, the two parts' own pages beside it):
  `src/game/difficulty.ts` is ONE row — the start card's *Defenders: standard | hard* over the scenario picker (ui/menu.ts `difficultyRow`), Tab ▸ Sandbox ▸
  Difficulty, `?hard` / `?hard=0` / `?difficulty=hard|standard` — over two tables that both ship OFF: `pressure.ts PRESSURE` (defenders come to a held room
  TOGETHER after a think beat, some sent round by a second door, a failed push or a last man falls back; `pressOwns` at the head of roomfight.ts `rally()`,
  `pressTick`) and `digin.ts DIGIN` (men who stay home shut, wedge and cover their doors, drag furniture, radio it; five one-clause seams in roomfight.ts:
  `digInTick / digInStays / digInReset / digInBraced / digInLook`). STANDARD = both off = the room fight of 8a7961e run for run (digest-identical; nothing in
  either file runs). HARD = both on at the build's rows, joined by `HARD.reachM` (0: the press takes whom it wants; in b8ffda2 only the men it left at home dug in —
  18 measured EASIER than standard, a man kept home is a hunter the team never meets) plus four one-clause joins: the press never takes a man the reach rule
  holds (`consider`), a man on his beat toward a press does not start digging (`pressWants`), a man SET on his door does not give the room up at boots
  (`DIGIN.holdSet`), a man giving ground falls back INTO a dug-in room (`DIGIN.refuge` → `digInRefuge`). Since 10-07 one row of Hard's own, `HARD.keeperDigs` (OFF; true = b8ffda2's hard run for run): the man a press leaves to keep his room (`keepRoom`) does NOT dig in (`DIGIN.keeper` off under hard, Tab ▸ Sandbox ▸ Defenders dig in ▸ 'the room's keeper digs in'; `pressure.ts pressKeeps`) — dug in he sat behind the one door a can comes through and killed nobody, where at standard he came hunting; at reach 0 that leaves hard nearly without barricades. Record rebuild/hard-everywhere/block-and-six.md: per scenario why hard does or does not bite (The block's standard, on its OLD floor, is already near the floor; the depot's press goes early, far and one man at a time), and the rules tried and dropped — a picket, a reserve wave, a dash, reading the door, a siege — with their numbers and a patch that brings them back. Hard also raises `PRESSURE.second` (pressure.ts `standAndFight`; Tab row
  'stand and fight ▸ in the open'; off = Hard as it was at b8ffda2 run for run): a hunter a press called who SEES one of the team outside the room he was sent at —
  not in it, not in its door frame — with a line of fire, and not himself in a door frame, stops where he is and fights as a set gun ('contact — they're out in
  the open! stand and fight!', once per 6 s) instead of walking on; nothing under `PRESSURE.gather`. Record rebuild/hard-everywhere/straight-on.md. WHAT HARD TURNS ON IS ONE TABLE (`difficulty.ts HARD`, each row written to its table when the level is hard, each one switch from b8ffda2's hard): `reachM` 0 · `keeperDigs` false · `warned` true (→ `PRESSURE.warned`, STAND TO: gunfire before the team's first entry that is nobody's room being hit is called on their net, nobody walks off to the report alone, and when a room is hit it is all hands; inert for a team that kept surprise — lost-surprise.md) · `second` true · `byWay` true (→ `PRESSURE.byWay`: the men of a room that shares no door with the fight go together, by one door, nobody kept — depot-and-pairs.md) · `picket` false (built, measured, off) · `wayOut` true (→ `PRESSURE.wayOut`, THE WAY OUT: only on a level whose structure carries `wayOut: true` — `scene/scenarios.ts StructureData`, today `levels/records.json` alone, so every other level is Hard as it was run for run — the men a lost room draws form up on ONE door of it, the first man's nearest, and hold it from `wayOutM` past a stun charge's reach of where a can thrown out of that door goes off (`standOffSpot`: a line to the door, out of the place's own light and out of each other's lanes where the floor allows, never the stock spots beside the frame), nobody round, nobody in at the noise, nobody sent once the team has come out into it (`Press.sprung`); 'back off the doors — out of their flash! let them come out to us!' on their net is the cue, `wayOutSecs` 60 the patience — round2-records-pair.md) · `drilled` true (→ `PRESSURE.drilled`, the night breach by itself only: its three are half as shaken by a stun canister or a boot — roomfight.ts `DRILLED`, combat.ts detonateStun × `drilledK` — so their blind burst comes a second after the flash; nerves only, a breaching charge untouched — round2-night-breach.md). Sub-rows of the press picked on fresh seeds, each off / on = the rule as first measured: `secondKeeps` + `secondSet` ON (the stood man is planted on the man he is on as a set gun: roomfight.ts `standOn`), `keeperLeft` ON (the keeper is a man a mate of his room left for a press), `standPress` OFF (stood to, all hands through the press: easier for the team). All eight scenarios before and after, the rules apart and together, lost surprise, straight on, the threshold: rebuild/hard-everywhere/numbers.md. What is stored per machine is the level's NAME
  (`twopointsix.difficulty`); the row shown is read off the tables (`difficultyNow`: both off = standard, both on at the build's hard rows = hard, else
  custom — a sub-row moved by hand drops the name and stores the tables: `difficultyCustom`). `initDifficulty(q)` runs in main.ts BEFORE the boot card
  paints; a click on the card also rewrites the scenario links (`difficultyHref`) because a pick is a page load. Harness: `--set
  '{"DIFFICULTY":{"level":"hard"}}'` (then any table over it: `"PRESSURE":{"flank":false}`), `HARD.reachM` likewise; `out.pressure` / `out.digin` /
  `out.difficulty` per run; `tools/qa/defender-moves.ts --pair` for the paired intervals. The dig-in part's level 'The block' (`levels/block.json`, runner
  id `block-four`, eight defenders) is the start card's eighth row. Scripted numbers only — nothing of this was seen on a GPU. QA: `probes.ts picker-card`
  (the row, the links, custom), the room-fight families at standard.
- **Defender cues (10-07;** `src/game/cues.ts`, `Game.cues`, record rebuild/telegraphing/cues.md; the maintainer: "maybe we just need more
  telegraphing from the NPCs then"; `CUES.on` DEFAULT ON, Tab ▸ Sandbox ▸ 'Defender cues', `?nocues`, persisted `twopointsix.cues`; off = the strip and every line as they
  were, digest for digest). Three things, all for a ROOM FIGHT's defenders (team 'hostile' units while `fightLive`): (1) their radio lines reach the RADIO STRIP — `say()`
  hands them to `cues.heard`, both overlays draw `stripRows(game)` (the cues' own row list: an undrawn row can no longer push a drawn one out of the five-row message ring;
  `'radio: '` rows from `Game.msg` are filed as class 0, always drawn; `adopt()` on a checkpoint load); (2) the strip RANKS and RATE-LIMITS (classes 1 coming round / to help ·
  2 stood down · 3 holding on purpose · 4 the net knows · 5 fell back · 6 still alert — `CLASSES` regexes for the old lines, `LINES[kind].cls` for the new; dup 10 s, per-class
  gaps once two rows are up, ≤ 2 rows a class, a better class takes the worst row; one squelch a frame); (3) the SILENT decisions get a line (`LINES`: help, stay / stayOurs,
  huntOver, calm, cover, still, fellBack, planted / pinnedIn, squadHears / Copies / Stays / Quiet, + spoken surprised / flinch), read off `RoomFight.log` notes and each `Def`
  at the tail of `Game.update`. **THE FILE ONLY READS THE GAME: a cue is never put on `Guard.bubble` (the bark clocks read it and would move a die) — cue bubbles live in a
  WeakMap behind `cues.bubbleOf(gd)` (both bubble UIs), no `Math.random`, nothing a digest reads.** Two say-site rewordings ride the switch and DO change bubble text (so the
  frozen-digest probes pin `CUES.on` off: threshold-identity, nvg / irlaser `digestLines` — a new default-on switch, the list grows by this one): a unit's 'back to your posts'
  → "he's down — hold where you are", and tactics.ts names places through `dialogue.ts placeName` (a level's own rooms and its `scenarios.places` / 'outside the mess'; with the switch on
  `roomName` — the dialogue templates' noun — and two of rescue.ts's lines are the level's own too off the office, never 'the car park' / 'the corridor'; off = the office's
  table on every level, as it was: the frozen digests' words). A new note in roomfight / squads / pressure that is a decision wants a pattern in `Cues.note`. QA `probes.ts cues` (lines / strip / run: on vs
  off digests equal bar bubbles); playthrough.ts `--set '{"CUES":{"on":false}}'`, RunOut `cues` (+ `digestMove` = the digest without bubbles under `PT_DIGEST`), say-watch.ts
  `cues`. Nobody has heard or seen any of it (no GPU / audio in the cloud): the wording, the squelch gain and whether three rows read are by-eye calls.
  Since 10-16 the strip can carry one row that is NOT on the net: a hidden defender's shout that reached an ear (`CUES.overheard`, `Cues.heardRow` — a field of its
  own, never one of `rows`; the 'A shout heard' bullet in dialogue.md has the rule, the switch and the check). `CUES` rides a recording from that day.

<!-- was CLAUDE.md lines 1444–1540 -->
- **Defender squads (10-07;** `src/game/enemysquads.ts`, record rebuild/enemy-squads/squads.md, the file format squad-format.md beside it):
  a level whose `scenarios.roomClear.squads` names squads (scenarios.ts `SquadData`; `levels/block-squads.json` ← `tools/levels/blocksquads.ts` = The block with
  Alpha 3 in the mess, Bravo 5 in workshop + store, Charlie 3 in comms `mayLeave: false`; `maxMen` ≤ `SQUAD_MAX_MEN` 11; start card row 'The block, three
  squads') stages its defenders as SQUADS (`squadsStage` from roomclear.ts onStaged, `squadsTick` in its tick, `squadsStop` in clear). A squad holds until ITS
  men meet the team (eyes on, a loud noise inside its own rooms, a man dropped at home with a mate to know it — never the team's true position) and calls it on
  the net; every OTHER squad, after `netLag` or on its own ears, thinks `SQUADS.think` s and says ONE choice before anyone moves: BARRICADE (digin.ts's wedge +
  cover, run for squad men whatever `DIGIN.on` says, only on the squad's `barricade` doors), FLANK (a pair by pressure.ts's exported `run / boots / loose` to a
  door of the hit room the team is not KNOWN to be at, never across that room or past a last-seen / last-heard team position) or HELP (≤ `helpMen` straight
  there, one man left a room). The choice is the SITUATION, no extra die: `mayLeave` false / under two spare / men still out / two squads already out →
  barricade; a holding ally with ≥ 2 up → the first answerer goes round, the second does the other thing; an ally at its last man → help; no answer → a
  strong squad's pair, else lock down; noise on open floor with nobody in contact → nobody is sent at it: every squad gets on its doors and STANDS TO (`Squad.ready`: the next contact call on the net is answered after `SQUADS.readyBeat` 0.4 s, no thinking beat, no settle wait — losing surprise buys the defenders a faster answer; `SQUADS.openPair` = the first cut, a pair sent round to the noise, which walked onto the team's guns in 42 of 144 scripted runs). Seams (each returns on its first line
  with no squads staged — a level without a block replays digest for digest): roomfight.ts `rally` (`squadOwns`) + `breakOff` (`squadRally`, `squadStaysIn`),
  pressure.ts `consider` / `lastMan`, digin.ts 'think' (`squadDefers`), `startBrace` (`squadMayWedge`) and its own net call. HEARD positions are jittered
  metres off the source: every ears-based room test uses the room's bounds with NO margin. `arrive` squads validate and load but nobody comes (16 skinned
  characters = Sam + 4 + 11). `SQUADS.way` (on; words only, needs the cues on): a hit squad's man answering 'coming to you' names the room or place his walk comes in by (dialogue.ts `wayName`, off the plain nav path: 'coming to you through the north gallery'; `bun run tools/qa/squad-way-check.ts`, `--off` must fail). `SQUADS` knobs: Tab ▸ Sandbox ▸ Enemy squads, `?nosquads` = one pool for the visit. QA: `probes.ts enemysquads` (stage / noise /
  contact), playthrough.ts `--scn block-squads` (+ `PT_NOISE=1`, `PT_FIRST=<room id>`, `--set '{"SQUADS":{"on":false}}'`; the JSON's `squads` = each squad's
  timeline, `squad ·` lines under `--trace`).
  **A SQUAD KNOWS ONLY WHAT ITS MEN'S SENSES AND ITS NET'S CHECK TELL IT — two knobs under one flag, both default OFF in `SQUADS` and the harness = run for run as before — but THE PAGE OPENS AS `?radiocheck=call` since 10-08 (enemysquads.ts; `?radiocheck=0` = off for the visit) (`?radiocheck` /
  harness env `SQUADS=radiocheck` = both; `?radiocheck=drop|eyes`, `SQUADS=radiocheck-drop|radiocheck-eyes` = one; record
  rebuild/quiet-squad-maps/change.md). (2) `SQUADS.noticedEyes` (Tab row 'unnoticed glimpse ▸ no contact'): off, a squad is in contact the
  frame a man of it at home has a hard sighting (`lastSeenT`, stamped at sight gain > 0.25/s whatever his awareness); on, only once HE has noticed (`noticed()`:
  his state is 'alert' — awareness past 0.85, guards.ts — or 'search'); the man is no slower, a 'glimpse' row goes in the squad's log. (1) UNSEEN DROPS
  (`SQUADS.radioCheck`, Tab ▸ Enemy squads ▸ 'unseen drops ▸ radio check or body'):** off, a squad is in contact the frame a man of it drops in its rooms with a
  mate at home, seen or not. On, the drop tells nobody unless a mate at home heard gunfire with it: (a) a fit man of the squad with the body in his view (guards.ts
  `bodySeen` = bodyInView's per-body test: 12 m, cone, line, the light on it) → contact as before; (b) the squad's own RADIO CHECK (`radioCheck()`: 'sound off' every
  `checkEvery` 40 s ± a fifth, half that once it knows of the team; the silent man asked for BY NAME at `checkAsk` 4 s; at `checkSend` 8 s up to `lookMen` 2 WALK to
  his post — `looks()`, their leg ended there, not by the room fight's `plant`, so a man who found nothing is back on his post wary, not roused — the body seen from
  the post = contact; none = 'no sign … back on our doors', `Squad.ready`, nothing on the net); (c) a mate who hears a small thing where he dropped asks for him by
  name a second or two later (`heardKnows` = that sound is contact; `heardAsks` off = it leads nowhere). A man out looking who meets the team between the squad's rooms calls it himself. A squad already in contact knows its men as before. Not covered: a man dropped outside his
  squad's rooms or out on its errand. QA: `probes.ts enemysquads-radiocheck`; `SQUADS=radiocheck bun run tools/qa/radiocheck-trace.ts --one <scn>:<seed> --arm pair
  --trace` = a pair-sneak run with the squads' rows and every radio line in step (`RC_DIGEST=1` adds a movement digest every half second). THE CHECK KEEPS ITS OWN
  DICE (`checkDice`: the squad's name × its men's stride phases, never Math.random) and its routine line files no chronicle row, so a run with the switch on IS the
  off run until the first frame the switch changes something — on against off is a paired comparison seed for seed; keep it so (the probe's `dice` check holds it).
  Its lines go out through `onNet()` (the log row + cues.ts `net`, as laststand.ts `voice()`), NEVER `g.say`: Guard.bubble holds back barks that draw the game's
  dice. After the review (rebuild/quiet-squad-maps/fixes.md; the probe's A1‥B1 checks): a looker at the post sees a body within `LOOK_ROUND_M`
  3.5 m of his FEET in any light (`bodySeen`'s numeric `around`); a check started by one man's ears (`Check.byEar`) dies with him; a check under way is dropped
  when the squad hears of the team (`Check.news0`, lookers by `Looker.news0`); a drop is loud the frame of the round (guards.ts `gunfireDue` = gunfire filed, not
  yet through a mate's ears); men go no sooner than `checkAsk` + 1 s; turned off on the panel mid-run, the drops it kept quiet become contact the old way.
  **A THIRD KNOB, `SQUADS.callBeat` — OFF by default AND off under plain `?radiocheck` / `SQUADS=radiocheck`** (its own value: `?radiocheck=call`, `SQUADS=radiocheck-call` =
  all three; `…call-eyes` = the body rule left instant; `…call-noask` = `callCutAsk` [0, 0], the knob as the one build carries it; rebuild/quiet-squad-maps/call-beat.md): on a QUIET floor (`callQuiet`: the squad never in
  contact, no news of the team, no living man of it has heard a shot, a kick or a bang) a man who has NOTICED the team — or, `callBody`, sees a mate's body — KEYS UP
  (`keyUp`: `Squad.calls`, one clock a man; '<Squad>: <callsign> — I've got—' through `onNet()` in the by-name class) and the squad is in contact only when his call
  ENDS, `callSecs` 1.5‥2.5 s later off the squad's own `callDie`; `callsCut`: the caller not `fit` (down, taken, blinded, reeling) = 'cut off', the squad told
  nothing of the team — but (THE ASK, `callCutAsk` [1, 2]; [0, 0] = none of it, run for run the knob without it) with the radio check on a caller off the net (down, taken)
  is FILED as a man who does not answer (taken at home: at his station; taken out looking or on an errand, or down: where he is, in the squad's rooms or out on its floor) and asked for BY NAME 1‥2 s later (its own
  `askDie`) by a fit mate — the check's own 'called' stage with him named when the check is free: its ask, its men to where he was; with the check's hands full (another
  man being asked for, men out looking, the squad's word due) he waits on `Check.cut` and `idle()` brings the next check in for him, no 'sound off' round first (`Check.beat` keeps the routine check's own time for when he comes back on the net unasked; `Check.late` = only an ask a call really held up gives its breath again — with no call cut the ask changes nothing, frame for frame); `callsTick`: the floor no longer quiet = every pending call through at once (his own
  first round is gunfire a living mate in earshot hears, so the beat is then at most the time to his first shot; a man with no living mate in earshot does not hear his
  own shot and says his call to its end); a call through files 'said' (eyes) or 'found … has said it' (a body) on the squad's timeline, which pair-sneak.ts reads as
  contact cause `'call'`. The man himself is never slower: his state, aim and feet are untouched. A man not `fit`
  never keys up (`keyUp` → true, no call), `callsCut` runs before the squad's 'every man down' exit, and the net's check waits while `Q.calls` holds a call. Probe section 18
  (learns at the end / cut off / gunfire = instant / the cue line / the env values / the men sent to look / the ask: none at [0, 0], a check under way, two cuts on one frame, a caller outside his rooms, no cut = the same game); `pair-sneak.ts` files each call's beat under `m.beats` (in Sam's lane, the
  partner's line, how it ended) and `PS_CALLERS=1` (tool only) makes the script go for a calling man first.
- **Defenders respect a lane that cost them** (`src/game/lanes.ts`, 10-11; the maintainer: "enemies do seem to run into held corridors a bit too eagerly, especially when they've already taken
  fire. was pretty easy to just hold a hallway and pick them off"; page rebuild/held-corridor/read-first.md). `LANES.on`: ON in the page (`?nolanes` = they come as they did),
  OFF in the module and on the frozen stand (`TPS_LANES=1`; a `FROZEN_HOLDS` row, in the knob registry and a journal's tables — a recording from before the table replays with it off; nothing of
  the file runs when off). Only a ROOM FIGHT's defenders (hostile units while `fightLive`), at any difficulty; no man, hit point or aim added. A LANE is opened by what the side SUFFERED: a
  man dropped by a round from ≥ `minM` off (1, once a man however many rounds were in the air), or rounds passing a living man with nothing solid between (`roundK` 0.5 each) — the wedge from
  where the fire came from along where it landed (`reachM / halfDeg / widthM`), plus everything those guns have a line of fire to within `fieldM` 12 m (the firing gun's wedge on the frame it
  opens, the rest — and a re-read against the doors and walls as they stand — one wedge each half second). ONE MODEL: it is nothing to anybody until a fit man of the side saw it (the man the
  rounds passed, a mate with a line to where it happened, a man who comes on the body) and has had `callSecs` to say it on their net ("they've got it covered — the hall! stay out of their
  line!"); what they know of the guns is where rounds that cost them left the muzzle. It lapses `secs` 150 (× the men lost there, ≤ 3) after it last cost them, or `movedSecs` 20 after every gun
  that made it has cost them from more than `movedM` 15 away, or is down (the guns have moved). THEN: its floor is `dear` in every walk the side plans (guards.ts goTo → `lanePenalty`: a way
  round wherever the level has one); a man whose way still lies down it is STOPPED SHORT out of the guns' sight (followPath → `laneGate` → `RoomFight.laneStop`: planted with his gun on its
  mouth; while he is held no press and no noise AT THOSE GUNS takes him off it — `laneHolds(g, gd, to)` in pressure.ts `consider` and roomfight.ts `rally`); NOBODY who knows of the lane walks
  over alone to a fight at its guns, held or not (`laneWarns` in `rally` — the one-at-a-time feed; a press may still take a man who is not held: together, by its own way); a man caught
  standing in it backs out to cover (`backOut`); a doorway drill is not stacked on a jamb the guns see (tactics.ts tryEngage → `laneCovers`) nor run through a doorway whose far side is in
  their line unless the charge that goes in first will burst on those guns (`laneDoor`); a hunter is not planted in it (pressure.ts `standAndFight` → `laneExposed`). Within
  max(`closeM`, `ROOMFIGHT.moveEngageM`) of a man he can see, or with a man in sight, the fight is his own: no gate, no plant. WHAT THEY DO INSTEAD OF WAITING: GO ROUND (`round`: of the men
  held, up to `roundMen` are sent at the guns by a way that shows them only at its end and from another side, every `roundGap` s, if the level has one — `flanking`) and THE CHARGE (`stun`: a
  held man with a stun charge — Hard's kit — inside `stunM` puts it on the guns; a stun charge OF THEIRS (`st.cans`: the side's own flash items in the air — a side knows whose can burst; the
  holders' own sends nobody) that bursts within `bangM` of a known lane's guns with nothing solid between, the lane's or the doorway drill's, sends the men held within `pushM` in behind it at
  a run for `pushSecs`: "they're blind — go, go!") and A LOOK ROUND THE CORNER (`peek`, the maintainer: "they can try peeking corners to see if their information is up to date"; off =
  a lane ends only by time or by the guns turning up elsewhere): a known lane quiet `peekQuiet` 10 s sends ONE man held within `peekReachM` of its mouth (`peekStart`: in 'hold', fit, nobody
  in his sights, a nav walk ≤ 1.4 × that) up to the corner at `peekPace`, his eye taken `peekLean` 0.35 m ahead of his feet (`peekStep`, every frame; `st.peek`, in `laneHolds`, skipped by the
  gate). One of the team within `peekNearM` of a gun spot in his GEOMETRIC sight (`gunsManned`: never the light meter — darkness must not make a held lane look empty) → "they're still on it — stay
  back!", `until` +`peekKeep`, back at a run and held again, the next look `peekGap` × 2ⁿ (≤ `peekMax`) later. The place round EVERY gun spot in view (`spotSeen`: the spot + the ring a
  man there could stand on, one miss) with nobody there for `peekLook` and nobody on their net with eyes on them there (`netSees`) → the lane is FORGOTTEN on the frame; with a mate held on
  it they move up together ("they're off it — move up, together!", `loose` at where the guns were), a lone man goes back to his place ("they've moved off it — eyes open!"). The spots in
  view but not all the floor round them = HALF a look (`Lane.peekPart`): clear only the second time running and after `peekSure` 45 s quiet — a muzzle shows past a corner its man stands
  behind, and the first cut's one-point test called a lane clear with the team a step behind a door frame (five then walked in). Measured: ~50 looks, none cost the man, none clear with the
  team on it; clear in 4 of 5 runs once Sam had left. No pose of its own. HELD AT TWO ANGLES, WITH FIRE (`pin`, on; the maintainer: "enemies try to hold you at some particular angles with fire while their teammates maneuver around you";
  off = only ways that hide their man to the end, and the mouths only watched): a way round whose end the guns would see for more than `roundShowM` 8 m (up to `pinShowM` 12) is taken as far
  as where they would first see the man (`round()` → `st.flankOf`, phase 'walk' → 'set'): he sets there, a held man on the lane's other side ("set — I've got an angle on them!"), and while one
  is set `flankTick` → `pinStart` sends the men held on the lane, in turn, to their corners (never one within `pinMinM` 7 m of a gun spot) for a SNAP BURST (`pinStep`, every frame from
  `peekStep`): from where the muzzle first has a line, up to `pinRounds` 3 rounds `pinEvery` apart at the gun spot — fire at a PLACE, `pinSpread` 0.24 wide, through `fireWeapon(… { steady,
  spread })`, so this is the file's one draw on the game's die — and back inside `pinSnap` 0.6 s; `pinMax` 4 bursts `pinGap` apart, then `pinRest` 20 s. `pinGo` (OFF: measured — the men set
  on the other side running in on the first round cost the defenders 7 more men over six holds on The block (OLD floor) and the team none). Six holds on The block (OLD floor), on against off: defenders down 17
  against 16 of 42, team 2 of 24 both, 10 men set on the other side, 19 bursts (13 rounds), 1 firer lost (SINCE the squad turns its guns to a door an enemy opens — `ROOMFIGHT.doorEars`, 10-12 — the same six holds set 3 men, 8 sent to a corner, 4 rounds; 8 men with that rule off: the team's rule changes these fights, about half the holds of seeds 1‥12 still show it and nobody is sent in on any); the depot, the office and the records hold never get to it. A recording from before
  the key replays with it off. THREE MENDS OFF A DUMP OF PLAYED TAPES (10-13; each a key, each off = as it was, a recording from before a key replays with it off; each a switch under 'all knobs' on the panel's 'Covered lanes' section since 10-13): `glass` (a lane keeps
  the energy of the gun that made it — `Lane.e`, glasspen's `shotEnergy` — and its floor is asked through panes at that energy, so a rifle's lane reaches through a window; shipped stand
  only: on the frozen stand glass stops rounds) · `stopClear` + `lookM` 1.5 (a man is not stopped short IN a doorway nor where a gun of the lane has a line a body's width wide, his look point is never
  under his own feet, a held man shoved onto such floor backs out again — never a man set on the lane's other side —, a lone man whose own look cleared the lane is the room fight's again,
  and the corner looked round is the lane's first floor on his walk, not a mouth seen slantwise through another door) · `roused` (a round passing a living man costs his side nothing unless he
  NOTICES it inside `reactSecs` 0.35: alert / searching, awareness ≥ 0.3, suppressed by it, a man in sight or a shot heard — two quiet rounds at a lamp past a calm man called a lane).
  Eight holds of The block, 150 s, hard, mends on against `stopClear` off: seconds a held man stood in a doorway 7 against 27, with a holder's rifle line on him 4 against 21; defenders down 31
  against 25 of 56 (not a difference at that size; the extra are men who went round — 17 against 11 — and met a holder whose gun had cost them nothing yet), team 1 down both.
  A GRENADE DOWN THE LANE THAT PINS HIM (`LANES.frag`, 10-13; the maintainer, asked whether a defender pinned by a hallway hold should throw a frag down the corridor that pins him:
  "yeah, that makes sense"). Before it he never did: a defender's own throw (`frag.ts fragThrowTick`) wants a fresh fix of his own and a line his rifle has lost, and a man this rule
  holds short of a lane has a watch point at his feet and no line. Now a man held on a known lane who CARRIES one (frag.ts deals them: `FRAG.defenders`, one defender in three, three a
  floor) puts it on the middle of where the lane's fire came from (`gunsMid`: the gun spot nearest their mean — a PLACE the net knows, so guns that have moved get it where they were).
  `fragOut` (4 s after the lane is known, `fragThink`; then no sooner than `fragGap` 30 s a lane; never while a look is out on it or a man is still walking to its other side) picks
  him. `fragStep`: first from where he is held, his ARM round his corner (`frag.ts armRound`, the stun charge's own half pace) — an arc and he shouts and throws without a step. None,
  and he can walk to the lane's mouth (`stepper`, the look's own pick): he comes toward it at a look's pace and one place every third frame is asked for an arc — where he is, then
  0.3, 0.6, 0.9 m on along his walk (`fragStepM`: what the wind-up's second lets him walk). The first with one: he shouts WHERE HE IS (the grenade comes out behind his corner), walks
  to that place and no further, throws and goes back. As far as the EDGE of the lane's floor and never onto it; none there either = back with it on his belt. He does not ask that
  place again (`State.fragNo`: the lane and where its guns were, until they are 1.5 m elsewhere) — nor after a grenade that stayed in his hand. No look, burst from a corner, stun
  charge or walk round goes out on the lane until `fragLook` 1.5 s after it has gone off. Everything else is frag.ts's and unchanged: `fragThrowAt` / `fragReady` (the seam this rule
  calls — frag.ts is the frag owner's file: `aimSpots`, `windUp` and `free` were cut out of `fragThrowTick` word for word so both throws go through them; the wind-up may carry the
  hand it leaves, `wind.hand` / `toward`; `Carrier.away` counts grenades that left his hand, `Carrier.spots` is a 1 s cache of open floor round the target) ask the reach (3.5‥13 m),
  the floor's 14 s between grenades, no hostage by it, none of his own in it, the scatter, the shout ('grenade out!' / 'fire in the hole!'), the second it takes him (shot in it: no
  grenade), the HUD cue 'they are shouting — a grenade is coming' and the team's own warning; at the release a mate in its reach or the arc lost = 'no — holding it!'. No new spoken
  line, no new HUD line, nobody goes in behind it. SWITCH: `LANES.frag` (module default true like `pin`: inert wherever `LANES.on` or `FRAG.defenders` is off, so the FROZEN stand
  runs none of it and needs no word of its own; on the page it is on — Tab ▸ Enemy AI ▸ Covered lanes ▸ 'lanes ▸ a grenade down it'; headless `--set '{"LANES":{"frag":false}}'`); a
  recording from before the key replays with it off (`journal.ts applyKnobs`). With the key off the build is as it was: twelve holds of the two charges, old tree against new with the
  key off, are the same kill for kill, walk-in for walk-in and stat for stat. CHECK: `corridor-check.ts` line 12 (a held carrier throws and it bursts within 5 m of where the team
  stood; nobody lost throwing; the same hold with the key off: no held man throws; `CORRIDOR_BREAK=1` reds it; both stands). The grenade moves these fights, so line 8's holds were
  picked again with it in (the two charges 16, 22, 23, 11: both rules show on one hold). MEASURED (hard, the page's stand, the two charges `defuse-four`, 150 s holds, seeds 1‥24,
  key off against on): a man held on a lane threw in 18 of 24 holds, 22 grenades, NO thrower lost (2 of 12 on the first cut, which wound him up at the lane's mouth), 1 stayed in his
  hand (he reached his place at once, was planted there, and dig-in walked him back to his cover inside the second: dig-in is not this rule's file); with the frag owner's own throws
  a hold drew a grenade in 21 of 24 against 10 of 24 (27 thrown against 11); all 26 that burst inside the hold did so within 4 m of where the team stood, 21 within 2 m; a Sam who
  never moved would be down by 24 of them, in 20 of the 24 holds (the tool's Sam cannot be hurt), no teammate killed by one (they get off it: 36 wounded against 11), none of their
  own hit. The scripted hold's own tallies do NOT move — defenders down 81 against 81 of 168, teammates down 26 against 28 of 96 — because the tool's team steps off the grenade and
  comes back: what it changes is that the spot cannot be STOOD ON, which only a played hold shows. Beside it, fewer men are spent on the lane's other answers: lost on a look 0
  against 3, corner firers lost 1 against 4 (41 → 28 bursts from a corner). The glasshouse: 1 lane grenade in 6 holds; the rebuilt block (`block-squads`, 6 holds): none, and its
  tallies are the old tree's to the man (no carrier is ever held on its one lane). Cost: at most 1,400 arc solves a hold, 0.03 ms each; the worst frame 4 ms run alone (a frame asks
  one place). Not this rule's: `frag-theirs` is red on the page's stand on the tree before this too (green frozen). Headless only, plus two boots of the real page on the software
  adapter (`shipped-page.cjs`: the page stands on the same switches) — nobody has seen a held man throw on a screen, never seen on a GPU, and whether a grenade at your feet most
  holds reads fair is a by-play call (the levers: the switch, `fragGap`, `fragThink`; frag.ts's `defShare` / `defMax` deal fewer).
  HIS OWN WHILE HE THROWS (`LANES.fragOwn`, 10-15, built while the maintainer was away: his to keep or flip). The 'stayed in his hand' above had grown on the build of 10-15
  (385850ee): 2 of 14 men who shouted for a lane in twelve holds were taken by the dig-in inside the wind-up's second — the room fight plants a man who has arrived at his throw
  place, `digInTick` adopts a planted man the next frame ('digs in … to cover' / 'goes to shut'), he is a metre off his arc at the release, says 'no — holding it!' and never asks
  that place again (`fragNo`). Now `roomfight.ts tickDef` does not run `digInTick` for a man `lanes.ts laneThrows` has: he has shouted and frag.ts's wind-up still has his arm
  (`winding`: the shout to the release, half a second past the wind-up's time at the most). The dig-in alone: a press, a rally or his squad's errand may still take him, and a look
  or a burst from a corner is not kept from the dig-in by this (nobody has measured whether it takes those). digin.ts is not touched (its owner named the seam, 10-13); its
  bookkeeping for that one man waits the second. SWITCH: module default true like `frag`, inert wherever `LANES.on`, `LANES.frag` or `FRAG.defenders` is off, so the FROZEN stand
  runs none of it; on the page Tab ▸ Enemy AI ▸ Covered lanes ▸ all knobs ▸ 'lanes ▸ his own while he throws'; headless `--set '{"LANES":{"fragOwn":false}}'`; a recording from
  before the key replays with it off. No URL flag and no FROZEN_HOLDS row of its own, as `frag` and `pin` have none. Off = the build as it was: twelve holds of the two charges,
  385850ee against this tree with the key off, are the same run for run. CHECK: `corridor-check.ts` line 13 (`OWN_HOLDS`, the two charges seed 12 cut at 45 s, then seed 10 at
  110 s: key off a lane grenade stays in a hand, on it leaves and none stays; `CORRIDOR_BREAK=1` reds it; played on the page's stand, from `probes.ts` in the check's child). Its off
  arm is about the BASE — only those 2 of seeds 1‥24 show the fault — so a step that moves those fights reds it with the rule intact: re-pick from `fragKept`. MEASURED (hard,
  the page's stand, the two charges, 150 s, seeds 1‥24, key off against on): lane grenades away 22 → 24, stayed in a hand 2 → 0, holds with one 18 → 19, throwers lost 0 → 1 (shot
  0.3 s after his grenade was away, walking back from the lane's edge), defenders down 77 → 79 of 168, teammates down 29 → 31 of 96; 4 of the 24 holds differ in who died. The same
  day, same build, twelve holds, the whole rule off against on: picked off 66 → 37 of 84, walked in after a loss and died 41 → 15, teammates down 22 → 9 of 48. Headless only,
  plus one boot of the real page on the software adapter (`shipped-page.cjs`, plain and the compound: no row differs) — never seen on a GPU, nobody has watched a throw.
  THE DOORWAY DRILL IS ASKED AGAIN (`LANES.drill`, 10-18, a mend after the rule was called done, built while the maintainer was away: his to keep or flip). `SQUADDEAL` (10-17)
  cuts every level's defenders into squads, so on a level whose file names none the men now come to a hit room together, on the fight's own chase, and `tactics.ts`'s doorway
  drill takes them at the door a mate has just dropped in. The loss that marks that doorway also opens the lane, but the lane is called about a second later, and the drill
  asked this rule once, as it took a man (`tryEngage`), and never again: on the records office hold (`records-pair`, seed 1631, Sam shooting from the maintainer's own spot)
  two more men then sliced the same door into a lane their side had called, 7 and 9 s after the first — 3 of 4 down. Now `runGate` asks `lanes.ts laneDrill` every frame
  for a man it has who has not committed (phases stack / wait / stacked / open / slice): his jamb, the handle he is walking to, the station he is slicing to, or the floor past
  the doorway in a lane his side knows of, and the drill lets him go (`releaseGate`) — this rule's own gate then has him like any man whose way lies down the lane (stopped
  short, a look, round, a charge). Left alone: a man whose charge is about to go in on those guns (`laneDoor`'s clause; his own, his mate's or his lead's), a second whose lead
  has thrown or gone in, the lead's thrower. One fight-log note ('the doorway drill has him at a doorway in a lane his side knows of: it lets him go'), no spoken line, no HUD
  line. SWITCH: module default true like `frag` and `pin`, inert wherever `LANES.on` is off, so the FROZEN stand runs none of it; on the page Tab ▸ Enemy AI ▸ Covered lanes ▸
  all knobs ▸ 'lanes ▸ door drill asked again'; headless `--set '{"LANES":{"drill":false}}'`; a recording from before the key replays with it off (`journal.ts applyKnobs`). No
  URL flag and no FROZEN_HOLDS row of its own, as `frag` and `pin` have none. CHECK: `corridor-check.ts` line 14 (the records office hold as dealt, 45 s: key off a defender is
  lost more than 2 s after the first; on, in line 6's own 110 s hold, none is, and a man is stopped short of the lane; `CORRIDOR_BREAK=1` reds it; from `probes.ts` in the check's child, on the page's
  stand). Its off arm is about the BASE, as line 13's is.
  THE CHECK WAS RE-STAGED WITH IT (10-18). `probes.ts corridor` had been red on the build since the squad deal went in: lines 7, 8 and 13 are about fights the deal no longer
  deals on those floors (a second man coming alone to a lane's corner; two angles on a lane; the dig-in taking a thrower), so they are now played on the page's stand with ONE
  row of it put off (`AS_WRITTEN` = `SQUADDEAL.on` false, by the hold's `--set`, read at staging and undone at the run's end); line 12's grenade is asked on the floor as dealt
  (`FRAG_HOLDS`, four holds at the most, no longer only when line 8 is red); line 13's on arm is its off arm with the key put on part way (corridor-hold.ts `flip`;
  `OWN_HOLDS` is now the two charges seed 11, 70 s, the key on from 40 s), because the key changes the fight from the hold's first lane grenade on and two whole runs no
  longer meet at the same shout. WHAT THE SQUAD DEAL COSTS THIS RULE'S SECOND ANGLE: `LANES.pin`'s two angles came in 3 of 12 holds before the deal and in 1 of 19 on dealt
  floors (the two charges, seed 12) — men who arrive together take the doorway drill or the lane's look, seldom two corners. Nobody has decided whether that step should be
  dealt a second man again.
  10-19: line 13 is also played with the defenders' gun deal held off (`AS_ARMED` = `GUNROLES.on` false): as dealt, seed 11's off arm no longer keeps a grenade (away 2, kept 0),
  so the line was red with the rule intact on the build that brought the gun roles in. Lines 7 and 8 are green with the gun roles on and are left as dealt.
  THE SEAM WITH THE HOSTAGE RESCUE'S FLUSH (10-19, `rescueflush.ts`, check line 15). The flush sends the men left for the hostages; it asks this rule only which door
  (`laneCovers` on the floor outside each) and whether the rule already holds the man at a corridor's mouth for that place (`laneHolds`), never whether he is warned off —
  where he is sent is where the team's guns are, and asked that way nobody ever came (8 of 8 scripted rescues barred, 5 of 8 stalled, on the build before its mend). Sent, he
  is this rule's on the walk: `corridor-check.ts` line 15 stages a rescue floor with the room fallen and no team (the office and the registry, as `rescueflush-check.ts`
  stages its own), plants a lane over the floor outside every door of the room (`lanesRestore`), and asks that the men sent are stopped short (none in its line before a
  look is under way), that a look finds it empty and the lane is forgotten, and that only then is a man of theirs in the room; `CORRIDOR_BREAK=1` reds it. NOT A FAULT, AND
  LEFT: with a team in the room a held man finds out it has walked the hostages out only at his next look (6 and 16 s after they start, two scripted runs) — he neither sees
  nor hears them go (a footfall carries 9 m by the walked path). The lever if he reads asleep in play is the look's back-off (`peekGap` 15 s, doubling to `peekMax` 60),
  which moves every hold: a by-play call. Headless only; nobody has played a rescue's end against this.
  MEASURED (hard, the page's stand, headless, this tree on the build of 10-18 with the levels' own response teams in): the records office hold, seed 1631 — key off 3 of 4
  down, 2 of them after the lane was called; on 1 of 4, 8 stops short of the lane, 3 looks (2 found him there). The two charges as dealt, seeds 1‥12, 150 s a hold — the whole
  rule off: 60 of 84 defenders down, 31 walked in after a loss and died, 9 of 48 teammates down; the rule on with this key off: 47, 16, 3; with it on: 40, 9, 4. Twelve holds:
  the teammates' 3 against 4 is inside the seeds. CHECKED: `corridor-check.ts` ALL PASS on both stands, `CORRIDOR_BREAK=1` reds lines 2‥4 and 6‥14; `gate.sh tactics` as it was
  (its one red is on `expected-red.ts`: `tactics-identity` reads what the untouched build read, on both stands). Headless only, plus one boot of the real page
  on the software adapter (`shipped-page.cjs`) — never seen on a GPU, nobody has watched a man let go at a door, and nobody has played a hold since the key went in.
  State is per Game (a WeakMap), reset with the guards, saved as the optional checkpoint slice `lanes` (a man's errand round, a burst and its volley clock are not: after a load they are dealt again). Tab ▸ Enemy AI ▸ 'Covered lanes'.
  MEASURED (hard, the shipped stand; record on the page): the team of four standing where The block (OLD floor) starts it for 150 s and shooting what comes, 12 seeds — defenders picked off 78 → 31 of
  84, walked in after a loss and died 50 → 10, the team lost 7 → 2 of 48; a team that MOVES (playthrough.ts's commander, six squad missions × 8 seeds, rule on against off) — won 30 against
  31 of 48, teammates up 75 against 77 of 192, defenders down 378 against 389 of 456: no difference at that size. The hold is no longer a win and not yet a loss: in most of those hold runs
  NO charge came (the man with one was not in reach) and NOBODY went round (no second way that hides them was found on The block (OLD floor; every held room of the rebuilt one has a second door); on the depot a man went round in 2 of 4 holds), so the
  defenders mostly WAIT — whether that reads smart or passive is a by-play call. AGAIN ON THE BUILD OF 10-13 (100 s holds, the same 12 seeds, off against on; the step that has alerted defenders burn their weapon lights — the page's stand only — moved the fight under the rule: lit, they see the holders first on some seeds): the page's stand — picked off 68 → 37 of 84, walked in after a loss and died 42 → 12, the team lost 12 against 18 of 48 (off, the team is wiped on seeds 1‥3); the frozen stand — 78 → 34, 40 → 7, the team 5 against 0. ON THE REBUILT BLOCK (10-13; every block figure before this sentence is the OLD floor's — `block-four` is one stay-put squad a room now and a hold where it starts draws nobody, rule on or off, so the hold is measured on `block-squads`, where two of the three squads may leave; 100 s holds, seeds 1‥12, off against on): the page's stand — picked off 44 → 28 of 120, walked in after a loss and died 13 → 2, the team lost 9 → 2 of 48; the frozen stand — 48 → 26, 9 → 1, the team 1 both. Nobody goes round there and nobody sets at a second angle (one hall: `round()` finds every way shown to the guns for its last 30 m), so held men stop short, look and wait. THE TWO CHARGES (`defuse-four`, 150 s, seeds 1‥12, the page's stand) is where the rule does most today: off 70 of 84 picked off, 44 walking in after a loss, the team lost 22 of 48; on 45, 15, 3 — the holders are safer too, since nobody rushes them. Held at two angles shows on 3 of those 12 holds (seeds 7, 8, 10) and on the glasshouse's seed 7, and there it COSTS the defenders: with `pin` off 39 of 84 down against 45, the team 3 both; 5 firers lost at their corner in 13 trips (1 in 19 bursts on the old block). `pinMinM` 10 on those three holds lost no firer and fired no round. Not retuned: three holds, and a scripted team of four with nothing to distract it. QA: `bun run tools/qa/corridor-check.ts` (`probes.ts corridor`; off against on, same seeds, on the shipped stand by name and the runner's own under probes.ts;
  `CORRIDOR_BREAK=1` must fail; ~3 min; lines 1‥5 are three holds of the block held by three squads (`block-squads`, seeds 5, 7, 12) since the block was rebuilt on 10-13 — line 1 asks a third of the men down, two of them fed in after a loss, line 3 a third fewer than off; `--mends` = lines 10 and 11 alone, the calm man and the pane, staged with round events; line 8, held at two angles, is asked of four holds in turn (`PIN_HOLDS`: the two charges' seeds 8, 7, 10, then the glasshouse's 7 — the rebuilt block never shows it) and two must show it; lines 6 and 7 are the corner look on the maintainer's own records-office hold — Sam at (9.6, 22.6), placement 1631 — staying, then leaving) and the measuring tool `bun run tools/qa/corridor-hold.ts --scn block-squads --seeds 1-4 --level hard [--set '{"LANES":{"on":false}}'] [--trace] [--json f]` (each run's `stops` = seconds men stood held, held in a doorway, held with a holder's line of fire on them; the
  shipped stand unless `TPS_PROFILE=frozen`). Never seen on a GPU or played by a person.

<!-- was CLAUDE.md lines 1611–1723 -->
- **QRF on going loud** (`src/game/qrf.ts`, `Game.qrf: Qrf`, STATUS E12(0)): trigger polled once a frame after updateEscalation — `escalationOf(g) ≥ 2`
  AND (a PLAYER 'shot' event at level ≥ 1 reached a living staff man within the hearing model's 80 m gunfire gate inside `LOUD_MEMORY_SECS`, OR ≥ 2 staff
  bodies `found`) AND `live(g)` (aiEnabled, !quietUtility, !touring, !isDaylight, Sam up) AND `tune.qrf`; `requestQrf(g, reason)` also from the panel.
  States idle → requested → inbound (+1.6 s, control's line) → arriving (ETA−10: the men are SPAWNED then, on the landing, `stairBoots`) → deployed (ETA:
  `flingOpen` the door, `stairDoor`); one wave (a second request = a refusal line); reset by `Game.resetGuards()` → `resetQrf` (restartEncounter goes
  through it). The men: `spawnUnit(team 'guard', weapon 'aks74u', light on)` + `Guard.trained` (aim.ts `TRAINED`: ×0.6 settle, ×0.7 hands; qrf.ts caps
  reactT 0.45) — staff-side units: hostile to Sam, colleagues to the shift, on its net (rollcall counts them), but held out of the lockdown pairing / posts
  / clearing / spokesman by `!x.unit` in guards.ts. Scripted through squad.ts `order()` with their OWN senses (`perceiveScripted`: hearingCheck minus
  events carrying their ids, canSee/sightGain → contact at awareness 0.85, bump, standoffPerceive, bodyInView → found + tally + radio) in state 'search';
  phases file → fan → move (point man A*, the rest on stations down his TRAIL, mutable goal Vec3s so goTo keeps the path) → stack (plan.stack + extension)
  → breach (keyed shove, then the bang from kickFrom to frameCentre + inward normal × 2.3, `detonateStun` with the element swapped out of g.guards and its
  'bang' event re-filed as a loud 'door' event under the point man's id so the shift do not answer their own side's charge) → flow (plan entry[0]/[1] pods,
  #3 searchPath[0], #4 formUp[1]) → called (Q.cleared + g.clearedAt) → hold 360 → pickTarget (room holding the fix, else nearest by nav; the fix out on
  the open floor = a 'point' target first) → …; contact → `toFight` (endGuardScript 'alert', the AI's fight) → `phaseFight` re-forms after `REGROUP_SECS`
  cold. Tier 2 `callPerimeter` (a QRF man down / ≥ 3 team-guard dead / ≥ 3 level-1 reports in 20 s counted from deploy+8 s, or the panel): `setGroup
  ('exterior', true)`, mission.stats.qrf = 2, men to `QRF_MARKS.posts` (spawn if `8 − 1 − guards.length` allows — never on this floor — else peel the
  element's rear men leaving two), pinned at the post, contact from the post → alert AI (pinned), cold → back to the post. Radio: `radio()`/`control()`
  write `'radio: …'` lines straight to g.msg (the HUD keys on that prefix; guards.ts `say` files a unit's radio under his callsign without it).
  `QRF_MARKS` (door 'stairwell', landing, entry fan, posts, outside spawns) live in qrf.ts with a TODO for LevelData; the door + landing boxes are in
  the level ('stairwell' LevelDoorDef: `steel` (doors.ts: kickIn → 'clang' DoorSound → loud 'door' event, no lockBroken; pick refuses; player.ts offers no
  pick row), `lock 'stairwell'`, `keySide −1`; the west plant moved to the SW corner out of the leaf's sweep). Knobs `tune.qrf/qrfEta/qrfSize/perimeter/
  perimeterEta/perimeterSize` (persisted `twopointsix.qrf`, Tab ▸ Sandbox ▸ QRF rows + 'call QRF now' / 'perimeter now' / 'stand down'). Character
  budget: skinning holds 16 (`MAX_CHARS`); the shadow-proxy table holds 8 — Sam + guards/units are guaranteed (a 9th unit throws in spawnUnit), civilians
  are appended last and lose their shadow proxies while a full QRF wave is up. QA: `probes.ts qrf` (trigger / timeline / element / wave / reset /
  gating / limits / perimeter), `soak.ts --loud-at MIN` (+ qrf invariants always on: state sane, men never below 'search', budget, radio ≤ 30/min).
- **Pursuit tactics** (`src/game/tactics.ts`, STATUS E12 a+b; `tune.tactics` on by default — OFF = the alert chase byte for byte as it was, `probes.ts
  tactics-identity` holds it; nothing under `quietUtility`). Hunting men with a fix and NO eyes on their man only (the fight inside 6 m, the standoff, the shot
  are untouched): (A) ≥ 2 alert men of one side on one fix, all > 6 m off → `planApproach` deals ROLES over the nav grid: PRESSER (shortest route; jogs to the
  last blocked→open transition of the sight line = his corner, kneels, waits), FLANKER (A* again with the presser's corridor cells + his quarter of the fix's 4 m
  disc ×6 via the new `NavGrid.findPath(a, b, maxIter, penalty?)` per-cell multiplier — must come in ≥ 90° round and ≤ 2.2× the length, else he is a SECOND
  presser 3 m behind; runs it, radios 'moving round' / 'set'), then 'go go go' and everybody pushes; arriving = `dropToSearch`. Re-dealt on a 4 m fix move / a
  lost or pinned presser; `tune.flankWait` = patience for a flanker getting nowhere. (B) a LONE alert man on an ARMED intruder (`armedIntruder`) > 5 m off holds
  the first corner on his route that sees the fix (`loneCorner`, ≥ 5.5 m off, shoulder to a wall), radios it — which raises his side — waits `tune.loneWait`,
  then goes on at a WALK. (C) KILL-ZONE DOORWAYS: `markDanger(door, team, why)` for `tune.doorDanger` s when a man drops within 2.2 m of one in a colleague's
  view (combat.ts killGuard → `tacticsManDown`), is found there (`tacticsBodyFound`), or a round crosses its opening at a man (`scanRounds` off the shot events'
  from/to); then goTo prices its cells ≥ ×20 (`tacticsPenalty`: a way round inside 2.5× wins), `bodyDutyBlocked` drops body duty by it, and `followPath →
  doorGate` takes any man whose path crosses it / ends by it: stack on the near jamb out of the opening (plan marks if `level.clearPlans` has that door from
  his side), radio + summon the nearest free colleague as second, wait `tune.doorWait`, open the leaf, a stun in first if `stunsOf` (giveStuns; staff carry
  none) else SLICE the pie (4 stations across, muzzle in), CROSS fast and split; banged+entered clears it. guards.ts seam: the alert branch's chase is now
  `chaseFix()` (the old lines) behind `tacticsAlert`, + goTo / followPath / the aim block (`tacticsLook`) / body discovery / bodyAftermath one-liners; game.ts
  `tacticsTick` before the guards + `loadTactics` (the four clocks kept per machine, Tab ▸ Sandbox rows). Panel/QA: `game.tacticsSummary()`, `tacticsRoleOf`,
  `TACTICS_DEBUG.log`, `TACTICS_STATS`; `probes.ts tactics` (flank / single / lone / door / rounds / decay / identity), soak `--doorway-kills-per-min N`,
  `--tactics off`, invariants + the `walkInAtDangerDoor` smell (must stay 0).
- **A pistol from behind a held man** (`src/game/gunhold.ts`, table `GUNHOLD`; `GUNHOLD.on` — ON in the page, `?nogunhold` = the standoff's ring as it was; OFF in the module and on the
  frozen stand, `TPS_GUNHOLD=1`; a `FROZEN_HOLDS` row, in the knob registry and a journal's tables, a recording from before the key replays with it off; never under `touring` or
  `quietUtility`). The maintainer, 10-12: "when you're holding a hostage, enemies pretty much ignore that you're shooting at them and you can just take them down. they should probably run
  for cover when you take out a gun and actively work on flanking you". The rule is the PISTOL's: the arm hold with no gun in it is the old ring frame for frame. Once a man of the
  standoff has SEEN the pistol in the hold, or a round has left it — COVER: a man in Sam's line of fire forward of his rear arc (`rearDeg` 70) runs for the nearest floor within `coverM`
  with something solid between him and the gun (low cover = a crouch; glass is not cover; none in reach = the ring as ever) · ROUND: each plans a way to Sam's back out of his line
  (≤ `flankMaxM`, open floor only in dashes of `dashM`), two men opposite ways where guards.ts `pickSide` dealt them so; of two or more the man most in front when the gun came out
  stays behind his cover and keeps him talking · LOOK: nobody's eyes on the pair for `peekEvery` s → a man in cover steps to its edge, looks `peekSecs`, steps back; the pair not
  there = the standoff is lost and it is the plain hunt · LINE: a man on the clean line at Sam's back (guards.ts `flankShot`: within 70° of dead astern, the held man clear, inside
  5 m) plants, and once Sam has FIRED from behind the man takes single aimed rounds down it (`GUNHOLD.fire`; false = cover and the way round, the line silent) — never before Sam's
  first round, never when the one he holds is a civilian. No man, hit point or steadier hand is added. ONE MODEL: `Known.sam` is where a man of the side last SAW the pair, never where it is. Their
  words are four small pools (`LINES`: gun / shot / round / gone, one line per 1.5 s a hold, through `g.say`; they say 'he' of the man with the gun — the night staff's voice; a DEFENDER — teams.ts `defenderWords`: a room fight's man who has left his post is neither held nor pinned and comes into a standoff like anybody — has his own four pools, `GUNHOLD_DEFENDER_LINES`: the man with the pistol is still 'he', as in the standoff's own lines, the one in his arm is never called theirs (he can be a civilian), and the news is where the gun is, not that there is one; picked by `gunHoldPool()` where the line is read, the one roll of the die drawn either way, so under `?oldwords` and on the frozen stand he says the staff's; no key of its own: a page tape with a defender in such a standoff parts there, the bubble's time being its length; `probes.ts words-lint` holds the pools and the pick). Seams in guards.ts: `standoffPerceive` (`gunHoldSee`), `standoffAlert` (`gunHoldFeet`, `gunHoldFree`),
  `standoffUpkeep` (`gunHoldKeeps`), updateGuard's suppression line (`gunHoldRuns`). State in WeakMaps per hold and per man, nothing saved (no checkpoint is written with a man in
  Sam's arm); its die is `simRandom`. Tab ▸ Enemy AI ▸ 'Gun in a hold (they take cover and go round)' (not kept per machine); `gunHoldStats(g)`, `gunHoldSummary`, `GUNHOLD_DEBUG.log`.
  QA: `bun run tools/qa/gunhold-check.ts [front|line|knife|all] [--verbose]` (`probes.ts gunhold-cover`, in family `gunhold` beside the pistol-to-the-head hold's own four; the
  standoff probes' staging run with the rule off, then on; by name on the shipped stand, under probes.ts the runner's own; `GUNHOLD_BREAK=1` must fail all but knife, which is an identity). Never seen on
  a GPU or played by anybody.
- **Needs-driven patrol variation** (`src/game/needs.ts`, STATUS E12 c; `tune.needs` on by default — OFF = the calm patrol byte for byte, `probes.ts needs-identity`
  holds it against a digest frozen before the module). Each STAFF man (team 'guard', no unit) is dealt 2–3 of `NEED_KINDS` coffee / smoke / water / stretch off
  `hashStr(callsign)` (which, the fill time inside `FILL_MIN`'s window, the starting level 0.3‥0.7, and the departure waypoint = the route waypoint with wait ≥
  `NEEDS.minWait` nearest the spot by path; a kind under `minTripM` of it is not dealt: Novak stands beside the cooler) — today: Kowalski coffee/water/smoke from the
  corridor's east end (wp1), Novak smoke/coffee from the cubicles' SE corner (wp4) + stretch from wp0, Reyes water/coffee from the break room (wp1). `NEED_SPOTS`
  (TODO(LevelData), checked headless like QRF_MARKS): coffee = the break-room counter (34.6, 14.4) facing the machine, smoke = out through the fire exit to (37.6,
  22.4), water = the cooler (26.9, 22.8), stretch = a five-point lap of the lobby from (8.4, 17). Levels fill (`needsTick`, game.ts before the guards) only for a
  calm man (patrol, awareness < 0.3, no hold/script/task/bodyDuty/leader/post) on a calm floor (`escalationOf` 0, no episode, mains on) in a live run (`needsLive`:
  AI on, !quietUtility, !touring, !puppet, !isDaylight, `qrf.state` idle, Sam up); a man through an alarm comes back capped at `afterAlert` 0.3. A full need +
  standing at ITS waypoint (`gd.wait > 0`) + fewer than `maxAway` (1) trips floor-wide + `floorGapSecs`/`restSecs` → `scheduleTrip`: phase `telegraph` for
  `announceLead` 20 s standing there (T−20 `anim.tell('watch')` then a `lookYawExtra` glance along the path's first leg; T−`sayLead` 12 `announce`: a bubble line
  from dialogue.ts `NEEDS_LINES.announce[kind]` to the nearest staff man within `partnerM` × carry by SoundPaths — he answers `replyAfter` 1.5 s later from
  `reply`/`replyOther` — else `say(…, radio)` in `NEEDS_LINES.radio`'s words ('Kowalski — two minutes, coffee' → the strip); T−`stretchLead` 5 `tell('neck')` +
  turn to `outYaw`) → `going` (goTo/followPath at the branch's walk pace, doors pushed as ever, `notGettingAnywhere` 6 s = give up) → `dwell` (`NEEDS.dwell` coffee
  25 / smoke 40 / water 12 facing `spot.face`; stretch walks `loop` instead) → `returning` to `route.points[T.wp]` → back: 'right, where was I' (`NEEDS_LINES.back`),
  level 0, the branch's frozen `wait` runs on and wp advances. Absences are constants (probes print them): Kowalski coffee 40 s / water 40 / smoke 69, Novak coffee
  49 / smoke 71 / stretch 34, Reyes coffee 37 / water 35. His `state` stays 'patrol' throughout (eyes, ears, bodies, kicked locks, whistles all as ever) and
  `interruptOf` cancels on the frame for anything (awareness ≥ 0.3, any state change, held/script/task/bodyDuty/hold/leader/post, floor up / episode / blackout /
  tour / QRF / Sam down / switch off): `cancelTrip` drops the record where he stands, level → `afterCancel` 0.5, nothing resumed. guards.ts seam: ONE line in the
  patrol branch's chain after post — `else if (T.needs && needsPatrol(g, gd, dt, walk)) moveSpeed = gd.speed;` (+ the import); character.ts `TellKind` /
  `TELL_DUR` / `tell()` / `telling` / `tellShown` / `tellLayer` (left arm IK + head, staggered dynMask like the signals; the gaze stabiliser leaves it alone);
  dialogue.ts `NEEDS_LINES` + `needsLines()` + `chatty` skips `needsBusy`; chronicle 'needBreak' rows (left / back with `away` s / cancelled with why); overlay's
  debug label shows kind:phase. Knobs `NEEDS` (rateK, maxAway, announceLead, dwell.* persisted with the switch: `twopointsix.needs`, Tab ▸ Sandbox ▸ needs rows +
  'send <name> for a coffee' = `needsSend(g, gd, kind)`: the full telegraph from wherever he stands, over the slot; `__needs.send(i, kind)` / `.trip(i)` / `.log`).
  QA: `probes.ts needs` (determinism / telegraph / one-away / interrupts incl. a whole headless tour lap / frozen-up / identity; telegraph + interrupts also in
  `ai-pass`), soak `--needs-rate K|off` (K > 1 adds the quiet-spell + send stimuli), invariants (≤ maxAway, no trip through a frozen floor or on a man not
  patrolling, levels / tellShown sane, lines only from the right mouths) + `needsStats`.
- **Civilians** (`src/game/civilians.ts`, STATUS E12 d; `tune.civilians` default ON — OFF, or `?nocivilians`, = nobody but the shift, byte for byte; `probes.ts
  civilians-identity` also holds that their calm PRESENCE (greetings off) moves nothing of the shift's seeded three minutes). The cleaner (Marta, id 40) and the late
  worker (Owen, 41) are `Guard` records with `team 'civilian'` (teams.ts: hostile to nobody, nobody hostile to them) and a `civ: Civ` record, kept in `Game.civilians`
  — NEVER in `Game.guards`, so no AI loop, pairing, rollcall, clear or QRF count sees them; built inside `withDice` (a private mulberry) so their construction draws
  nothing from Math.random. Authored as DATA (`levels/office.json civilians[]` ← officeGen; docs/level-format.md *Civilians*: marks + wait + task wipe / bin / sit /
  printer / cooler / shelf / stand + face; character.ts `anim.act` = a whole-body clip layer for the tasks). They perceive through the SAME functions as the men:
  `guards.ts eyeContact` + `sightGain` × `CIV.keenK` 0.6 (narrower `eyeBusy` cone while working, wider `eyeAlarmed` once frightened, × `gunK` when Sam's gun is
  out within `gunM`), smoke via the probe's segment query, hearing = their own pass over `g.events` with hearingCheck's horizons and `col.sound.propagate` (a
  suppressed shot carries ~7 m × carry). States `work → startled` (a glimpse: stop, look, shrug it off) `→ alarmed` (freeze 0.4–0.8 s + gasp, then a SCREAM the
  men hear through propagate within `screamM`) `→ flee` (target = cheapest by nav path of a living calm staff man (−4 m bonus), a wall phone, an exit (+6 m);
  +15 m for anything past the threat; re-chosen once a second; `runSpeed` 3.2) `→ report` (2.6 s beside him: he gets `lastKnown` = where she saw it, suspicious —
  or 'search' + his radio + `raiseEscalation(1, 'civilian')` if she saw a gun / a body / Sam up close) | `phone` (6 s → control's radio line, `devices.ts
  sendToLook` sends the nearest calm man, the floor up a step if armed) | `gone` (out through an exit; control hears 18 s later) `→ cower` (crouched in the
  nearest corner; whimpers; re-flees if Sam closes with a gun; after `loneSecs` alone tries again for a guard; settles back to work after `settleSecs` calm).
  Guards NOTICE them (`guardsNotice`): a screaming / running civilian heard or seen → suspicious toward where she came from; a cowering one found → 'what
  happened?' → her report second-hand; a civilian BODY found → bodyFound (tally, chronicle {civilian}), the floor up (dead → lockdown + control's outrage line).
  Sam's verbs: grab from behind (or any side once cowering) exactly like a guard (`startGrab` → `civilianGrabbed`); held rows `question` (CIV_LINES.intel: the
  cleaner gives the side door's code → `learnCode`; the worker: the QRF's stairs, Reyes's habits, the corridor camera), `comply` ('stay down, stay quiet' → released into cower for ≥ `complyMin`
  min, will not report unless a guard finds her), `choke` / `whip` = KO, as is the takedown; a round kills (combat.ts killGuard → `civilianDown` for any `gd.civ`). Chronicle kinds
  `civilianSpotted / Reported / Complied / KO / Killed`, SCORE −15 reported (first-hand causes only) / −10 KO / −40 killed, badge 'unseen by civilians' (id unseenStaff), the card's
  civilian block; `tune.civilianKillFails` (off) fails the mission on a kill instead. Hidden under the tour / breach / quietUtility (`civiliansOnFloor`); cleared
  off the floor ('evacuate' to the exits) when the QRF is called (never the man a snatch came for: `evacuationCheck` leaves `g.snatch.isMan` where he is). A calm civilian is no prop contact and yields to guards (they never feel her); frightened she
  shoves furniture like anybody. `CIV_SPOTS` phones / exits are constants with a headless check (TODO(LevelData)). Knobs `CIV` + `tune.civilians /
  civilianKillFails` + `CIV.greet` (persisted `twopointsix.civilians`; Tab ▸ Sandbox ▸ civilians rows: on, kill fails, greetings, 'panic the cleaner', 'send
  her to the phone', summary); `__civ` {list, panic(i, 'panic'|'phone'), set, knobs, stats, log, spots, check, summary}. QA: `probes.ts civilians` (spots /
  sight / phone / comply / scoring / hearing / determinism / identity), soak `--civilians on|off` + the civ-panic / civ-grab stimuli + invariants + `civStats`.
- **Hard, after-close rules (10-13; each a switch that steps back, none with a Tab row, none in a journal's tables — no recording is made with a room fight on the floor)**: `PRESSURE.stunKnown`
  (+ `stunKnowSecs`, `stunMovedSecs`: a defender's stun charge goes only where his side believes the team is) · `PRESSURE.lastHolds` (a last man holds without calling a press) ·
  `DIGIN.noticed` (+ `noticedSecs`: a dug-in room's contact report waits for the man to notice) · `DIGIN.lanes` (+ `laneSecs` 2; digin.ts `coverSpot` / the `'set'` phase through lanes.ts
  `laneCovers`, read only): a man picking where to hold his door from takes no spot — nor one whose last stride is — in the line of guns his side KNOWS of, and a set man found standing in
  such a line (asked twice a second, only until the team is in his room, never with a man in his sights) walks to a spot out of it; none = he stays exactly as he was and is not asked again
  for `4 × laneSecs`. Acts only where covered lanes are on (the page / shipped stand), so the frozen stand is as it was. Stats `DIGIN_STATS.laneMoved / laneKept`, log 'moves out of their
  line'. MEASURED (shipped, hard, scripted commander, rule on against off): block-four seeds 1–8 won 4 against 3, teammates up 9 against 7 of 32, defenders down 53 against 45 of 64, 7 moves;
  floodlit-four seeds 1–6 the same run for run (it never fired) — rare, and not easier. TRIED AND REMOVED: stand-off spots of the way out not seen through a pane (`PRESSURE.wayOutGlass`):
  records-pair on hard, 24 seeds, went from 3 to 22 team wins — the through-pane spots are that rule's teeth; a pane that has cost them is the covered lanes' to remember.
- **A lit man is seen from past 16 m** (`guards.ts GUARD_EYE.far` + `eyeReach(g, lit)`; the maintainer, 10-13: "yeah raise the range" — on his Mousehole tape he stood lit 17 to 21 m in
  the hatch gun's view for 40 s unseen. ON in the page — `?nofarsight` = every eye stops at 16 m whatever the light, as it was; OFF in the module and on the frozen harness
  stand, `TPS_FARSIGHT=1`; a `FROZEN_HOLDS` row; `GUARD_EYE` is a journaled knob table and journal.ts turns the rule off for a recording whose row has no `far` key; Tab ▸
  Stealth ▸ Detection & movement ▸ 'a lit man is seen from past 16 m' + 'lit man: seen to, m'). ONE RULE FOR EVERY MAN'S EYE ON EVERY MAN: `canSeeChar` hands the eye a reach
  of `reachFor(…)` = `eyeReach` of the light on the watched man — Sam's meter; an AI man's own (`Guard.visibility`) or his lit weapon light pointed at this eye (`lampGlare`),
  never the goggles' gain — which is `range` 16 m while that light is under `farLo` 0.4 (a man in the dark is exactly as hard to see as he was), easing (smoothstep) to
  `farRange` 26 m from `farHi` 0.8; never under a show. The rate's distance term (`distTerm`, shared by `sightGain`, `sightGainOn` and the standoff's `pairSightRate`) runs on
  past 16 m from its 0.2 down to `farK` 0.1 at 26 m, so the notice builds slower the further out: Sam standing still in full light has a calm man's full attention in 1.7 s
  at 12 m (as before), 2.6 s at 20 m, 5.8 s at 25 m (headless, the meter fed by hand). Inside 16 m nothing differs at any light. The standoff's view (`pairInView`) reaches as
  far as the pair's light gives. Teammates get the same eye on a lit defender, so a gun that sees Sam from 20 m can be seen and answered from there (the fog of war's picture
  never had a 16 m limit). NOT TOUCHED: cameras (their own `range`), civilians' eyes (`CIV`), bodies (12 m), quiet.ts's start check (`FIRST_SIGHT_M` 16: a start dealt lit
  16 to 26 m from a first waypoint passes it), sneak.ts (plans the partner against `GUARD_EYE.range`). The scripted commander is never seen, so what a play-through measures of
  it is man against man. QA: `probes.ts farsight` (tools/qa/farsight-check.ts, in all-quick: reach / eye / dark / men / notice, its numbers read off the table;
  `FARSIGHT_BREAK=1` must fail). MEASURED (shipped stand, on against `TPS_FARSIGHT=0`, playthrough.ts): the 20 squad missions × seeds 1-6 — 81 of 120 digests equal, won 77
  on / 80 off, teammates lost 221 / 209; nine missions moved, all but one inside a seed's noise. THE LONG HALL IS WHERE IT BITES: hall-four × seeds 7-18 played without the
  shield walk, taken 8 of 12 on / 11 off, teammates lost 34 / 18, and 22 of the 34 fall to a gun past 16 m (the hall's far pair, Tango 1 and 2) in the first 40 s — 1 of 18
  off; led down the hall behind the shield (`PT_HALL=file`, seeds 1-12; the shield has since left the game) 12 of 12 taken on both, lost 15 / 10, no killer past 12 m on either. records-pair × seeds 7-18: 11 of
  12 taken on both, lost 6 / 7 (the first tally's 3 / 5 was noise). On the frozen stand `TPS_FARSIGHT=1` moves no verdict in close, standoff, roomfight, quiet, silent, sneak,
  sticky, fog, pairup, pairs, lights-out, stealthpose, squadfire or journal. Never played: 26 m and the 0.4 / 0.8 meter bars are first numbers.
- **Shaken — the first slice of enemy morale** (`src/game/morale.ts`, table `MORALE`; `MORALE.on` — ON in the page, `?nomorale` = every man as steady as he
  was; OFF in the module and on the frozen stand, `TPS_MORALE=1` raises it, `TPS_PROFILE=shipped` has it on; `FROZEN_HOLDS` row, `JOURNAL_KNOBS` + `applyKnobs`
  so a recording from before the key replays with it off, the debugger's Missions ▸ 'Enemy nerve' section (below), `moraleSnapshot` / `moraleRestore` in the checkpoint, `moraleReset` in
  `clearAftermath`). One number a man, `dread` 0‥1 = SHOCK (events; half-life 25 s; capped at `shockCap` 0.5, so shock alone never breaks anybody) + STANDING
  (counted ONLY WHILE HE KNOWS SOMETHING IS UP — a shock still on him, or his state off calm patrol: a calm man alone in a dark corridor reads 0 and
  steady; `alone` 0.25: no living mate within 7 m with a line; `dark` 0.25: `inTheDark(g, gd)`, THE ONE MARKED FUNCTION (`darkRead` 'watch' hands it to `darkFoeBlind`, held off: below) — the
  CPU light estimate at his chest and head under `tune.visFloor`, the same on both stands, no GPU read). Rungs with 0.15 hysteresis: JUMPY ≥ 0.3, BROKEN ≥ 0.7
  AND `mayBreak` (alone and in the dark both): two blasts on a pair leave a pair. The only feed in this slice is a blast: `moraleBlast` from frag.ts `blast`,
  doortools.ts `blow`, wallcharge.ts `blow` (only when a hole opened) — FILED there and asked on the next `moraleTick` (the torn leaf still stands in
  collision on the blast's own frame); 0.35 inside 4 m, falling to 0.6 of it at 10 m, a line to the blast needed, the thrower's own side not fed, the hostage
  rescue's cast never (`rescue.hostiles`: any of them may hold its clock). The blast's own STAGGER is honoured first: while `staggerUntil` roots him he is
  low, takes no step and fires no round, and the sequence's clock stands. JUMPY: down for 2.5 s facing the blast, then the fight's man again; the nearest
  ducker shouts it (spoken). BROKEN, he says it then he does it: down 0.6 s → the cracked radio call nobody answers, AT THE START of the scrabble → backward
  from the hole, facing it, ≤ 3.5 m at 2 m/s (`backGoal`: straight back where that gives `straightM` 1.5 m, else the longest clear run of a fan — left and
  right by turns, 17.5° steps out to 70°, a fixed order; the body stops 0.3 m short of any goal, the script's own arrive line) → 5 ragged rounds into the dust at the hole (the room fight's blind-fire path, `spread` 0.3: never at a man) →
  holds low on the hole, a second call 6 s on if still alone. An enemy plainly in his eyes (the room fight's own sight bar; in the hold the same eye is also
  laid on the hole, a crouched man's chest and head sitting well off his gun line) ENDS it for good and he is the fight's man — except THE BAIT, once: a thing
  thrown through the hole, or a man seen inside `baitM` 2 m of it while the magazine is still his to spend, draws THE REST OF HIS MAGAZINE at the hole (not at
  the man), through `weapon.fire()` until the gun is dry by its own count; he shouts that he is out (spoken) on the frame the guards' own reload beat starts,
  stretched to `reloadSecs` 3.2 s — a real empty gun, so every fire site of his waits on it and no gate was added anywhere. A second throw draws `baitShort`
  5, a third a frightened word and no round. A staff guard (`team 'guard'`) is a man of it too: the frame his awareness crosses the alert line is left to
  `updateGuard`'s own promotion (CONTACT, the alarm), and a driven man is `drawn`. Seams, one gated line each: guards.ts `updateGuard` (`moraleScript`, posed
  through `runGuardScript` for the frame, as `fragFlee` is), roomfight.ts `tickDef` (`moraleOwns`), game.ts `update` after the room fight's tick, dialogue.ts
  agitation (`shakenOf`: dread only while shock is live — a man merely alone in the dark does not talk faster). No new animation (the crouch and the `clutch`
  fold), no HUD mark, no loud-noise bait yet, nobody runs or drops anything. Check `tools/qa/morale-check.ts` (`probes.ts morale`), `MORALE_BREAK=1` (the
  alone and dark terms count for nothing) red on both stands; 18 lines green frozen and shipped, ONE staging a case on fixed seeds, measured headless: stagger
  2.54 s with 0 m and 0 rounds in it; the call at 3.13 s with 0 m moved, first round 4.10 s; 1.23 m back; 5 shots measured off the sim's own ray, mean 0.07
  rad off the hole; a pair at 1.6 m both jumpy, shock 0.44 after a second blast; lit = jumpy; bait 25 of 25 in the gun, empty at the shout, 0 rounds in the
  3.20 s change, then 5, then none; a man 1.79 m from the hole and 0.59 rad off its bearing drew 25 shots mean 0.07 rad off the hole (0.58 off him) and the
  next sighting ended the hold; a night-staff man alert at 0.02 s with CONTACT and the alarm, broken, and the same man after a checkpoint; a restart between
  blast and tick fed nothing; the rescue's cast untouched. Its off line is a sanity line: OFF = THE BUILD AS IT WAS is the gate's frozen digests. Numbers
  UNTUNED. NOBODY HAS SEEN OR PLAYED IT, and it has never been seen on a GPU: the poses, whether the scrabble reads from the top-down camera, the lines.
  TRAINING (the second slice, same switch; no die): every man is GREEN or STEADY — `trainingOf(g, gd)`: a `gd.trained` man (the QRF) steady always; then
  the knob `MORALE.training` ('difficulty' default · 'green' · 'mixed' · 'trained'; 'none' = the first slice's men and nobody a leader — what `applyKnobs`
  gives a recording without the key, with `fanStep` 0, and what morale-check runs on); then the squad's own `training` key in the level
  (`SquadData.training`, in the lint's `SQUAD_KEYS`, authored in NO level); then `MORALE_AT` by the enemy AI's rung (`leversShown().ai`, read once a tick;
  rows hand-tuned under the lever = the rung `PRESSURE.on` implies): standard 'mixed' = the band's first man is its steady LEADER (`leaderOf`) and the rest
  are green; hard = every man steady but the last of a band of three or more. THE BAND is his squad (`enemysquads.ts squadOf(g, gd).men`); with no squads
  staged, the men the room clear staged in his ROOM (a lone keeper is a band of one: steady, his own leader); a man with no band (night staff, a defender
  nobody staged) goes by `TEMPERAMENT` ('nervy' = green; unnamed: green on the roster's odd places) and has no leader. It moves two things only. WHEN: a
  steady man is the first slice's (alone AND dark, at `broken` 0.7); a green man breaks ALONE, lit or dark, at `greenBroken` 0.5 (a lone green man in a lit
  room breaks to a blast inside about 8 m — and, ON PURPOSE, not on nerve 'steady': 0.495 under his line). HOW: a green man's sequence is the first
  slice's (his net call says he cannot see only in the dark; lit he has a line of his own); a steady man goes to a crouch (no fold), backs to the same
  goal, makes a flat call on the net (`clear` lines), fires NOTHING into the dust, and a bait draws `baitShort` 5, twice and no more, never his last round —
  no dry gun, no 'out'. A steady man's duck is `steadyDuck` 1 s, a green man's 2.5. NO BREAK IS FOR EVER: rung 2 needs more than `holdShock` 0.05 of shock
  still on him, and a broken sequence lets him go `holdMax` 70 s in. THE LEADER'S DEATH: one gated seam, combat.ts `killGuard` → `moraleManDown` before the
  state flips: his green men carry `leaderDown` 0.25 standing; those with him in their eye (`canSeeChar`) take `leaderShock` 0.3, a clock
  (`sawLeaderFall(gd)`, seconds since — the drop-and-run rule reads it at the join; `moraleShock(g, gd, x)` is the plain feed for later slices) and FLINCH
  (act 'flinch': down `flinchSecs` 0.8 s facing where he fell, then up); the NEAREST of them says a `lost` line on that frame, spoken — one line a squad a
  death — and is the squad's `lost` man: the ONE man a later blast may break with mates at his shoulder; the rest duck and stay in the fight. A LEADER
  NEVER DUCKS, whatever the mix: fed by a blast he takes the act 'stand' — on his feet, gun on the hole, one side step `sideM` 0.75 m off its line where the
  floor is free — and, with men of his ducked inside `orderM` 4 m and a line between them, gives the order, spoken, `orderBeat` 0.5 s after his stagger;
  their duck ends `orderSecs` 1 s after it, `orderGap` 0.15 s apart, the nearest answering. `MORALE.nerve` 'brittle' / 'normal' / 'steady' scales every
  shock by `nerveK` 1.4 / 1 / 0.7. A man inside a sequence keeps the training he went into it with. No aim, skill, reaction or health table is read or
  written (PRESSURE.on / DIGIN.on are read for the mix). THE PANEL: Missions ▸ 'Enemy nerve' (after Difficulty): one toggle a rule (today 'blasts shake
  men they do not hurt' = `MORALE.on`; a later rule is one line in `rules`; labels ≤ 37 characters), training (by difficulty / all green / leader and
  green / all trained; an old recording's 'none' is shown as itself), nerve, the roster line (`moraleRoster`: 'men ▸ S g g g · S g g g · S g g', a band at a time) and the per-man line that
  used to sit on the Stealth page; the toggle put OFF calls `moraleReset(game, true)` — every man's state dropped, back on starts clean. The duck's shout
  is the nearest ducker's, leader over him or not, and waits `shoutGap` 0.6 s on a line already in his mouth (the floor's own CONTACT). A choice by hand holds for the visit (`moraleKeep(row)` → the tab's sessionStorage, ONLY the row touched, read back by `moraleFromQuery` in
  `pageSwitches`: a change of level is a page load) and rides a recording as a string row. URL: `?training=green|mixed|trained`, `?nerve=brittle|steady`.
  Check `tools/qa/training-check.ts` (the `morale` family runs both); `TRAINING_BREAK=1` spoils the rule's own tables (MORALE_AT's rows swapped,
  `greenBroken` out of reach, the leader's death worth nothing, `orderM` 0) and is red on both stands, with `MORALE_BREAK=1`; 28 lines green frozen
  (`TPS_MORALE=1`) and shipped, one staging a case, headless: a compound re-cut to squads of 4, 4, 2, 1 reads standard `S g g g · S g g g · S g · S`, hard
  `S S S g · S S S g · S S · S`; no squads: 8 rooms, 8 steady of 11, a leader's death on his room's two men only; a lone green man lit: broken, 1.23 m back,
  5 rounds, the lit call; a lone steady man lit: ducks 0.99 s; steady in the dark: fold 0, 0 rounds into the dust, bait 5, 5, 0 with 20 left; leader's
  crouch 0.00 through a 2.54 s stagger, order at 3.05 s, the green man up 0.98 s after it, side step 0.47 m; leader killed before two green men: shock
  +0.30, the clock from 0, one `lost` line on the frame, both flinch 0.80 s; the blast after it: the `lost` man down, the other ducks; a green man alone
  in the dark let go at 70.01 s and at rung 1 once his shock is 0.03; the fan 1.24 m where straight back gave 0.01 m; 134 knob tables + FIGHT_SKILL
  deep-equal across all 15 choices. NOT DONE / NOT SEEN: nothing of it on a GPU or played; the lines are placeholders; the panel section was typechecked
  and built, never opened in a browser; `greenBroken` and every number are first guesses; no level authors `training`; several men getting up
  `orderGap` apart with one answer is written and not staged; no tour or soak on the shipped stand since green men break more often.
  JOINED (10-13): runner.ts reads `sawLeaderFall` (above) and darkdoor.ts reads `trainingOf`. THE DARK IS STILL READ WHERE HE STANDS: `MORALE.darkRead`
  'place' (default; `applyKnobs` gives it to a file without the key). 'watch' + `DARKFOE.on` = `inTheDark` returns darkfoe.ts `darkFoeBlind` — WIRED AND
  HELD OFF, because it asks another question (the floor he is WATCHING, at the meter's 0.3 on a third of it): as the default on the shipped stand it turned
  13 lines of morale / training red and 25 of runner's — the hut's man, in no light at all, reads NOT dark from the reading after his door is blown off
  (the lit yard through the hole, 6 of 8 points), so he drops under his broken line a second in; and morale-check (3)'s lamp-lit hut read dark. morale-check
  (D) holds the two readings side by side. No panel row, no URL word for it. morale-check / training-check hold `RUNNER.on` and `DARKDOOR.on` off AFTER
  EVERY STAND-UP (a pin made once is undone by `standUp` re-reading `TPS_RUNNER=1`: case (5) was red on the frozen stand with all three words raised).
- **Drops it and runs — the second slice of enemy morale** (`src/game/runner.ts`, table `RUNNER`; `RUNNER.on` — ON in the page, `?norunner` = a broken man
  stays and changes his magazine, as he did; OFF in the module and on the frozen stand, `TPS_RUNNER=1` raises it and it acts only with `TPS_MORALE=1` beside
  it, `TPS_PROFILE=shipped` has both on; `FROZEN_HOLDS` row, `JOURNAL_KNOBS` + `applyKnobs` so a recording from before the key replays with it off, the panel's
  row under morale's, `runnerSnapshot` / `runnerRestore` in the checkpoint). No surrender, nobody's hands go up (the maintainer, 10-13). WHO: a man morale.ts
  has BROKEN (rung 2), ALONE, DRY (its bait burst spent and he is mid-change, or the gun empty by its own count), with an enemy plainly in his eyes inside
  `closeM` 5 m — never on dread alone, never the rescue's cast, the response team, a choreographed man; `runnerBreak(g, gd)` starts it directly for a later
  slice. SAY THEN DO: he shouts it (spoken; the magazine change he was in is cancelled, count and clip), holds low for `beatSecs` 0.6, then `dropFromHand` puts his weapon on the floor and he is FLED (`runnerFled`):
  the gun's own count is held at nothing and no change is ever his (so no fire site needed a gate), `inHand` says empty (so `killGuard` drops nothing more),
  his light is put out, he is `state 'patrol'` with no fix and no foe, and guards.ts runs this file's script before any sense of his own. DRAWN: the existing
  empty-hands branch of `guardProps` — a rifleman keeps the sidearm on his thigh, a pistol man's holster is left empty (one line); no new pose, the arms are
  the unarmed upper body's. WHERE, at `tune.guardChase` and no faster: the armed mate nearest BY THE FLOOR, inside `mateM` 20 m of path (nobody that near: he
  tells nobody and goes straight out); within `tellM` 4 m with a line he shouts it and every mate inside `toldM` 8 m is TOLD — `RoomFight.told(gd, at)` (new,
  public: what `evidence()` does for a loud noise — the entry toward the place +1, the post's noise record, his glance ended) plus `digInOrder` (which runs
  only where `DIGIN.on`, OFF on both stands, or a squad is staged); a mate with no post gets the place and awareness `tellAware` 0.6. Then out: the nearest
  reachable nav cell outside the structure's rooms by `clearM` 1.5 under open sky (`outOfBuilding`'s test, copied — that method is private; the rooms'
  rectangle is worked out once a level), for choice one no enemy has a line to (`askCells` 60 on a metre's grid; a man out with eyes still on him looks
  wider, `askWide` 240, every `retrySecs`); no structure = within `edgeM` 2 of the map's rim. The flood never steps INTO a cell inside `shyM` 2 m of an
  enemy that is no farther from him than the cell it leaves (he may always step AWAY: a man with the enemy at one metre gains distance, he is not held at
  his feet), and his way is looked at every `replanSecs` 0.5 for an enemy inside `shyM` of the next `aheadM` 3 m: another way out, or the corner. guards.ts
  `followPath` passes a fled man through three gates — the door drill (`doorGate`), a covered lane, doorway manners; `handleGate` is KEPT (a leaf that opens
  toward him still has to be pulled — skipping it would stop him at every such door). A man with the player in his only doorway goes to the CORNER (two
  walls, farthest from every enemy), low, his face to the wall (away from the nearest enemy), silent, and looks again every `retrySecs` 2 — until `retries`
  3 runs at a way that would not let him through (stalled `stallSecs` 3, a door that will not open) have come to nothing: then he stays. Out with no
  enemy's line on him for `goneSecs` 2 a spawned unit is `despawnUnit`ed; a ROSTER man (the night staff) and a man in a Director exchange are never removed —
  they stay low where they got to. From the drop on he is `hold` + `pinned` and kept `state 'patrol'`, awareness 0 every frame, so the readers that ask for a
  free calm man (dialogue.ts `chatty`, needs.ts `manCalm`, the civilians' greetings, devices / mission errands) pass over him. COUNTING, one clause each:
  roomclear.ts tick (`live`, a room's `defenders`), nightbreach.ts (its "cast was despawned" restart test — the reviewed blocker: a fled man gone from the
  list restarted the encounter — its clear line, `objective`), breach.ts (`allDown`, the target queue's head, `seen`, the let-go of a man on the sights,
  both `guaranteeDowns`), director.ts drill `cleared`, verdict.ts nightbreach, laststand.ts `up`, guards.ts (both `living` of an engagement, `acquireFoe`'s
  pick and its keep, `poseFlashlight`: no light in Sam's arm or after a grenade's flee), enemysquads.ts `alive` (his squad counts him out; `lying` asks
  `state === 'dead'`, so no body is "found"), frag.ts (a wind-up ends, `runnerOwns`), stress.ts top-up; rescue.ts's own cast test is untouched (its cast
  never runs). roomfight.ts `tickDef` yields (`runnerOwns`) and `tickOp`'s eyes pass over him. THE PLAYER may still shoot him: a kill like any other,
  tallied and witnessed. NOT DONE: never re-arms; the roll call says nothing for a fled staff man; breach.ts's queue filters at staging still list him (the
  head shift drops him). Check `tools/qa/runner-check.ts` (`probes.ts runner`), `RUNNER_BREAK=1` = the fled mark wiped before every frame (the run goes on,
  every seam that asks is told no), red on both stands; `morale-check.ts` holds `RUNNER.on` off for itself (its case (5) is a dry man with the player in his
  eyes — with this slice on he runs, and it was red under `TPS_PROFILE=shipped` until it did); 29 lines green frozen (`TPS_MORALE=1 TPS_RUNNER=1`) and shipped, ONE staging a case on fixed seeds
  (the compound's hut man; the default level's first night-staff man and night breach through `runnerBreak`), headless: shout at 0.02 s with no item of his
  down, the rifle on the floor at 0.62 s; 3.74 m off two seconds on at top 2.70 m/s, 0 rounds; with two mates on their posts he told at 5.85 s (was 19 s
  before the path pick), evidence on the told man's entry 2.62 → 3.00, and left the floor at 12.35 s; no mates: 'taken' at 0.63 s with him running, gone at
  5.00 s, his squad 1/4 → 0/4 up; 2.5 s after gone the attempt, the staging count, the player and the head count unchanged (room clear twice; the bare night
  breach by the check's OWN `despawnUnit` — that level is one roof and the drill's men are never removed by the rule); nothing outside: the corner at 8.55 s,
  0.00 rad off straight away from the player, silent; held in place, 3 runs then he stays; enemy at 1.00 m: 6.54 m three seconds on; grabbed: 45 frames,
  light off, runs again; a scripted and an unscripted teammate with a line never on him (both controls took an armed man); a staff man: on the floor, held,
  pinned, patrol, and the game's own checkpoint brings the run back. Its off line is a sanity line: OFF = THE BUILD AS IT WAS is the gate's frozen digests.
  NOT STAGED: the frag wind-up cancelled (private to frag.ts's book), a REAL locked door (the retry cap is shown on a man held in place), the door gates
  skipped, a mid-run replan round an enemy who steps in, chat / needs / greetings themselves (hold + pinned is the proxy). Numbers UNTUNED. NOBODY HAS SEEN
  OR PLAYED IT, and it has never been seen on a GPU: the empty-handed run, the beat, the man low at a wall, whether a man vanishing in the yard reads, the lines.
  JOINED TO TRAINING (10-13) — THE OTHER WAY IN: a BROKEN GREEN man (`moraleOf(gd).green`, the training he broke with) who SAW HIS LEADER FALL
  (`sawLeaderFall(gd)` finite) runs with an enemy plainly in his eyes inside `closeM`, ROUNDS LEFT OR NOT, mates about him or not — `lost()` beside `ripe()`
  in `runnerTick`, the same `start`: the same shout, beat and drop. No knob of its own. runner-check (12), fixed seed 51, the compound's hut, no squads
  staged, training 'mixed': shout 0.02 s after the player stood 3 m off with 25 rounds ready, the rifle down a beat on; the control (the same green man
  broken alone, his leader alive) runs only once the bait has run him dry (2.83 s, 0 rounds). The rest of runner-check runs `MORALE.training` 'none' (the
  first slice's men, as it was written) and holds `DARKDOOR.on` off, after every stand-up; 31 lines green on both stands. The panel row moved to Missions ▸
  'Enemy nerve' ('broken men drop the gun and run'); no reset — a fled man stays empty-handed with the switch put off. Headless only, never seen, never played.
  AFTER A PAGE DRIVE (10-13, the hut's man baited dry with the player 3 m off: "I'm out!" and "I'm done!" a frame apart, then "Yard: contact" over the
  shout two frames on): `outSecs` 0.8 — `ripe` waits out morale.ts's bait and gives its 'out' line that long before the shout (still dry, the enemy still in
  his eyes, or no run); and enemysquads.ts `fit` / `contact()` pass over a man `runnerOwns`, so from his shout on he puts nothing on the squad's net.
  runner-check (17), squads staged: the shout 0.78 s after "I'm out!", no line of his after it to the frame he is gone (5.78 s); on the tree before the
  change both lines are red (0.00 s; "Gate: contact — guard hut!"). 33 lines green on both stands.
  WHO HE PLANS ROUND (10-18, `PICTURE.run`, picture.ts; `?picrun=0`): with the picture on, the way, the reachable floor, the outside he picks, the corner
  and the look ahead are reckoned from the men HE knows of, where he believes each to be, not from every enemy's true place; he leaves the floor on the
  TRUE lines as before. The rule, its check line and what was measured: `docs/agents/team-feel.md`, STEP 8 of the own-picture bullet.
- **Not in there alone — the dark doorway** (`src/game/darkdoor.ts`, table `DARKDOOR`; `DARKDOOR.on` — ON in the page, `?nodarkdoor` = every man walks into
  the dark as he did; OFF in the module and on the frozen stand, `TPS_DARKDOOR=1` raises it, `TPS_PROFILE=shipped` has it on; IT ACTS ONLY WITH `MORALE.on`
  AS WELL (frozen: `TPS_MORALE=1 TPS_DARKDOOR=1`); `FROZEN_HOLDS` row, `JOURNAL_KNOBS` + `applyKnobs` so a recording from before the key replays with it off,
  the panel's Enemies row under morale's, `darkDoorSnapshot` / `darkDoorRestore` in the checkpoint: every man's act and clocks, who is green, the rooms given
  up, the room readings). A GREEN man who is ALARMED (suspicious / search / alert — a calm patrol walks his dark rooms as ever), ALONE (no living mate
  within `pairM` 4 m with a line), who STANDS IN THE LIGHT (his own place reads `darkAt` 0.2, or `litBy` 0.1 over the room's mean: from one dark room into
  another, and in a blackout, nobody balks) and whose walk's next doorway, within `stopM` 2.5 m of path, stands OPEN (`openRad` 0.35) onto a DARK room
  stops `standM` 1.3 short of the frame, `sideM` 0.3 off its middle, and SAYS it as he stops. A SHUT door he opens as ever (noted while he is still in the
  light, `armSecs` 3), then balks and steps back off it. THE LINE IS THE CALL when a man can come (`freeMate`: of the `mateTry` 3 nearest free men the
  shortest nav PATH inside `mateM` 40 — never a follower, a post, a man on a need, a searcher, a held / pinned man): spoken inside `earM` 12 m, on the net
  with the chirp past it; the mate answers after `copySecs` 1.2 the same way, walks to him (the floor's suspicious walk, his fix kept on the caller), says
  his line inside `pairM` and both go in, the mate's fix the first man's goal for `withSecs` 10. A mate who dies, is taken (alert, search, an order) or
  covers no ground for `lagSecs` 5 is dropped, not called again, the next man asked every `callSecs` 2. Nobody to call: a different line, to himself. He
  sweeps his aim — his light with it — across the opening, `sweepSecs` 3.2 a pass. Nobody inside `waitSecs` 20: he says so and GIVES THE ROOM UP — its
  spots on his search plan struck (`unreachable`), the leg dropped by its owner's rule (`stallT` forced; an alert chase is `dropToSearch` with the fix on
  his feet). NO FREE PASS after that: sent at that ROOM again inside `fedUpSecs` 300 (`fedUpN` 2: quits counted a room) he says he is going in, stands
  `nerveSecs` 1.5 and goes in alone at `slowK` 0.5 of his pace; a door gone THROUGH does not stop him for `againSecs` 45. IN A FIGHT only the chase to a
  last-known fix is stopped (`fightWalk`): not a walk to cover or a role, not a foe who is down, and no balk BEGINS with a sighting newer than `seenSecs` 2
  — a balk he already has keeps him at the frame, its clock standing while he has eyes on, and he fires from there by the alert rules as they are; a balk
  outlasts his walk not asking by `keepSecs` 2 and the same door takes it up silently inside `resumeSecs` 12. DARK = cleared.ts's room on the far face
  (`roomBy`; open floor never), `samples` 40 floor cells by calmtorch.ts `placeLight` (CPU steady estimate, nothing carried), `darkShare` 0.7 under
  `darkAt`, kept `askSecs` 0.5; by day a cell `workLit` says daylight reaches is not dark (the estimate has no sun). The man is tested green BEFORE the
  room is read. GREEN was a STAND-IN (now morale.ts's training: the foot of this bullet), `greenMan`, dealt ONCE a man and kept, `DARKDOOR.who` 'rest' | 'all' | 'none' (`TODO(merge)`:
  morale.ts `trainingOf`): every squad man but `Q.men[0]`, of the squadless staff every second man dealt — the office's is Novak. NEVER: a scripted man,
  `gd.trained`, the rescue's cast, a man `moraleOwns` has, a man held / pinned (so a room fight's defenders ON THEIR POSTS are not in it: only once they
  are loose), a standoff, an errand (`task`, `bodyDuty`), a man called or going in as a pair. No die, no health / aim / reaction number. Seams, one gated
  line each: guards.ts `followPath` (`darkDoorGate`), guards.ts `updateGuard` after `tacticsLook` (`darkDoorLook`, not with eyes on a foe), game.ts
  `update` after `moraleTick`. Check `tools/qa/darkdoor-check.ts` (`probes.ts darkdoor`): 17 lines, all on the DEFAULT numbers, green frozen and shipped;
  `DARKDOOR_BREAK=1` (no room dark to the rule) reds 12 of them on both stands. ONE staging a line on fixed seeds, the office at night (the break room's
  west door, 0.85 dark) and the compound's room clear for squads, measured headless: the line at 2.27 s; waiting 1.44 m off the frame, 0.27 m off its
  middle, 4 aim passes in 14 s; mate at 7 m: call, 'copy' and his line spoken, through at 7.5 s / 9.4 s; mate at 13 m: call and 'copy' on the net,
  through at 11.1 s / 13.1 s; steady man and lit room (0.38): through at 3.68 s; alone: 'nobody's coming' at +20 s, patrol 3 s later; sent again: the
  line, 2.1 s, in at 0.87 m/s against 1.75; four calm minutes all green: 3 walks into the dark, no balk; a checkpoint mid-wait with the lamps put on two
  frames earlier: 600 frames continued = loaded, digests included; off and morale-off runs digest equal to a nobody-green run; alert chase: balk, quit to
  a search at his feet, then no re-entry (frozen) or the said slow one (shipped); shut door: line 0.02 s after the leaf stands open, 1.15 m back;
  blackout and dark-to-dark: through, no line; a mate stuck: dropped at 7.3 s, the next called, then 'nobody'; squads dealt `sggg sggg sgg`, a loose
  green man balks at `k_p`, the steady one walks in. FIRES FROM THE FRAME is proven only on a STAND-IN: headless nothing answers for Sam's GPU light
  meter, so that line feeds `player.visibility` the CPU estimate with the man's own torch in it (`lightEstimateAt`, nothing skipped) — then he sees a
  Sam 3 m inside, fires 14–19 rounds and stays out; the torch sweep lighting Sam on the real meter is NOT provable headlessly. Numbers UNTUNED; a balk is
  a 20 s gift to the player by design and nobody has weighed it. NOBODY HAS SEEN OR PLAYED IT, never seen on a GPU: the stand, the sweep, the lines, the
  radio chirp.
  JOINED TO TRAINING (10-13): `greenMan` IS morale.ts `trainingOf(g, gd) === 'green'`, asked fresh and kept nowhere (the stand-in, its per-man flag and the
  `dealt` count are gone; an old checkpoint's flag slot and `dealt` are read past, the slot is written -1); `DARKDOOR.who` 'all' / 'none' still override. With
  `MORALE.training` 'none' `trainingOf` calls every man steady, so NOBODY balks (a recording from before training replays with no balk; one from before this
  rule has it off anyway). guards.ts `followPath`: the gate passes a man `runnerFled`. The panel row moved to Missions ▸ 'Enemy nerve' ('green men wait at a
  dark doorway'); no reset — the switch off leaves a stopped man's record, which the tick ends `keepSecs` after it is on again. darkdoor-check stages
  `MORALE.training` 'mixed' and holds `RUNNER.on` off after every stand-up; 17 lines green on both stands, headless, never on a GPU, never played.
- **An enemy on alert does not sit blind in the dark** (`src/game/darkfoe.ts`, `DARKFOE.on`; page on, `?nodarkfoe`; frozen stand off, `TPS_DARKFOE=1`; on
  the shipped stand `TPS_DARKFOE=0` puts it off; journal: a recording from before the key replays with it off). The maintainer's ask (2026-10-13, a Mousehole
  tape: nine alert defenders stood up to 111 s at meter 0.00 with every weapon light dealt off). BEFORE: sight went only by the light ON THE TARGET
  (`guards.ts sightGain`); nothing asked whether the WATCHER could see, and mission defenders (`unit.light` false) never lit. NOW, for a hostile unit the
  mission dealt no light: BLIND = under `seeShare` of the floor down his aim (three rays, `lookM`, his own lamp left out, steady light + other people's lamps)
  reads `litAt` on the meter's scale — a man in the dark watching a lit doorway is NOT blind. He must KNOW: for good by his own ears / state / a mate's word
  (`knows`, latched), or for now by having a mate's burning lamp before his eyes (`word`, cone + clear line, `byLamp`). ONLY SUSPICIOUS IS NOT ENOUGH (the maintainer, 10-13, asked
  'light only once he's alerted': 'yeah, I think so' — the first cut lit a suspicious man's lamp, which lit a partner told to hold still before him; that was a
  default, not his words): `DARKFOE.suspect` false as shipped and in the module, Tab 'suspicious enemies light it too' puts the first cut back, and a recording
  whose DARKFOE table has no `suspect` key replays with it on (`journal.ts applyKnobs`). A man who CARRIES
  (`carry` of them by id, no dice; shipped 1 = every man, since every carbine is drawn with a light; Tab select none / half / all) burns the same weapon light
  every unit has after `onSecs` (+ id jitter), off after `offSecs` of a lit view, never twice in `holdSecs`: ONE seam, `guards.ts poseFlashlight` →
  `darkFoeLit(g, gd)`. It lights him and the room for the player, the meter reads it: that trade is the point. A man who carries NONE (`seek`): only an alert
  or searching defender the room fight has merely holding (`darkFoeKept` = null: not dug in, not his squad's, no lane, no press, not the captor / last stand,
  nobody seen for `quietSecs`, no shot for `calmSecs`) walks, at `stumbleK` of the investigate pace, to the nearest floor IN HIS ROOM he can see from (the dark
  edge of the light first, `edge`), by the room fight's own 'move' leg; `roam` (off) lets him out by a doorway. Exports for neighbours: `darkFoeBlind(g, gd)`,
  `darkFoeCarries(gd)`, `darkFoeLit(g, gd)`, `darkFoeKept`, `darkFoeOf`, `darkFoeSnapshot / Restore`. Tab ▸ Sandbox ▸ Detection & movement: the toggle, the
  carry select, 'suspicious enemies light it too', 'walk to where they can see', '…and may leave their room for it', a read-only summary line. CHECK
  `probes.ts darkfoe` (`tools/qa/darkfoe-check.ts`, 16 lines, both stands; `DARKFOE_BREAK=1` fails the off = base digest line and the only-suspicious line
  on both: a blind man held suspicious for 8 s burns his lamp 0 frames, and 374 of 480 with `suspect` on). MEASURED headless (CPU light estimate,
  scripted commander, shipped stand, an EARLIER cut of the rule whose walkers could leave their rooms; 3 seeds a cell): mousehole-four off / half carry / all
  carry = team wins 0/3 each, teammates lost 12/12 each, defenders killed 19 / 17 / 22 of 27, lamps 0 / 3.3 / 7.3 a run; hostage rescue byte-identical off
  against on in two of three seeds. Nobody carrying and walking to UNDER the light: the team won 3/3 with all 27 killed — walking a blind man into the light
  gets him shot, which is why the walk is fenced and every man carries. WHAT THE WALK DOES AS SHIPPED: almost nothing on Mousehole (stay-home squads: dig-in
  has 7 of 9; the dark rooms are dark all through), and on the floors as rebuilt by 10-13 NO in-room walk at all (frozen stand, real gunfire, nobody
  carrying, deals 1-3 of block, block-gwot, depot, depot-gwot, killhouse, hall, compound, barracks: dig-in has the men, or a man already has light in view, or
  his room has none); with `roam` 1 man leaves his room on depot.json deals 1 and 3. So the check's walker lines no longer lean on an authored floor: (d)
  shoots every fixture out by the field, hangs one ceiling lamp in a held man's own room where the rule's own search finds him a spot (the first of
  killhouse / hall / depot deal 1), and reads the walk there; `roam` is read on depot.json deal 1 as dealt. LIMITS: a blind man with no light whom dig-in has, or
  whose room has no light, stays as he was; dig-in choosing a post by what a man can see is digin.ts's (a claim, not built). NOBODY HAS SEEN ANY OF IT ON A
  GPU, nobody has played it; `litAt`, the dwell times and `carry` are first numbers.
- **Hard: go and look (10-13; the maintainer: 'harder settings have better trained guys, more proactive, higher morale, better kit' — this is the 'more
  proactive' half; morale and training are the morale goal's rows).** Switch `HARD.sweep` (`difficulty.ts`; OFF in the module and on the frozen stand, ON in
  the page — `host/profile.ts pageSwitches`, `?nosweep`; frozen word `TPS_SWEEP=1`; `FROZEN_HOLDS` row; `tablesOf` writes it to `PRESSURE.sweep`; a journal
  from before the key replays with it off — `journal.ts applyKnobs`, read off the recording's `HARD` row, since no recording carries `PRESSURE`). Read only while the difficulty is hard. Their side has had word of the team (a man of
  the team properly in a living man's sight — `lastSeenT`, not a faint glimpse; a loud thing in a man's ears; on squad levels a call on the net; never the
  team's true place, nothing from the dead) and then nothing for `sweepSecs` 20: a PAIR is called on their net and, `sweepBeat` 1.5 s later, let go at that
  place by the stock rally's hand-over (`loose`). One look per word; never to a room one of theirs holds; somebody always stays; A LOOK THAT LOSES A MAN IS
  THE LAST that fight (no farming pairs). No die drawn. Two forms: no squads — `pressure.ts goLook` ('gone quiet. with me — we go and look.'; mate within
  `sweepPairM` 12 m; skipped on a rescue, while a man is out, a press or fall-back is live or a report stands; stats `lookCalled / lookMen / lookOff`; a
  stood-to side that stands down says the look's line instead of 'stand down — hold where you are'); squads — `enemysquads.ts lookOut`
  (`SQUADS.drillLook`, `sweepSecs / sweepMen / sweepBeat`, Sent role `'look'`, squad event `'sweep'`; the pair walks back to its posts when it finds
  nothing: '<Squad>: no sign of them — back on our doors!'; `sweepStayers` on = a `mayLeave: false` squad still sends its look, which is the only thing
  hard does on Mousehole, where every squad stays home and hard was standard run for run). Check: `bun run tools/qa/sweep-check.ts` (both stands;
  `SWEEP_BREAK=1` must fail; `--trace`, `--only room|squads`). MEASURED, scripted commander, shipped stand, hard, seeds 1–8 against the build before it:
  the six no-squads levels and three of four squad maps identical run for run at the script's pace (72 of 80 runs the same; 0 looks called on the
  no-squads levels — the press already has a man out, and 'a man out is the look'); Mousehole changed in 8 of 8 (the team is wiped either way there: mean
  127 s → 119 s, defenders down 43 → 41 of 72); the block with three squads 1 of 8 (a win became a wipe). A SLOW team (`PT_WAIT=30`, four no-squads levels,
  seeds 1–8): 31 of 32 runs identical, one look. So: a team that keeps moving does not meet it; it is for the quiet spell. NOT measured: Sam alone, the
  newer squad levels (long hall, glasshouse, kill house), 144 seeds. Never seen on a GPU or played. KNOWN: a man let go on a look can bark the pursuit's
  'moving round — coming at him from …' with nobody seen (tactics.ts's bark, not changed).
- **Hard's kit, measured and NOT changed (10-13).** `--set '{"DIFFICULTY":{"level":"hard","kit":"stuns"}}'` (the Enemy kit lever on its upper rung, a
  stun charge each) against hard as built, seeds 1–8, shipped stand, scripted: the office four won 8 → 4, teammates up 24 → 7 of 32; the depot 29 → 24;
  the floodlit yard 19 → 11; the records pair unchanged; in all 74 → 44 of 112. `HARD.stuns` stays 0 (The block keeps its one each — `HARD_AT`): whether
  hard carries stuns everywhere is the maintainer's call, and the lever on the mission sheet already lets him play it.
- **The QRF takes a room by the squad's own door and room code (`tune.qrfSquad`, 2026-10-13; `src/game/squadcast.ts`, qrf.ts `startDrill` /
  `phaseDrill` / `dropDrill`).** At a room's door the element is A SECOND CAST of the classes Sam's squad runs: `squadCast(g, {mine, team, ring})` builds
  a `SquadOrders` and a `DoorTools` of its own over a VIEW of the Game (a Proxy on which only `orders` / `doorTools` read as the cast's pair; every other
  read and every write is the real Game's), and qrf.ts gives it `tools.order('bangClear' | 'openClear' | 'threshold', men, door, side)` and ticks
  `tools.tick()` then `orders.tick()` — stack marks off the door's own geometry, the door opened, the can, the flow and the room search, the threshold's
  jambs and slices are doortools.ts / orders.ts as the squad runs them, so a change there reaches the QRF with no second edit. KIND: the room that holds
  the fix = bang and clear (open and clear with no can left); any other room = the threshold first. STILL THE QRF'S OWN: when and where (the trigger, the
  landing, the file down the corridor, `pickTarget`), its senses (`perceiveScripted`), contact (`toFight` hands the men to the alert AI and lets the entry
  go: the unthrown can back in its pool), the perimeter, its radio lines; its can is re-filed as THEIRS to the shift (`theirBang`). A fresher fix
  elsewhere before anybody has crossed re-targets; a room called clear on a fix uses that fix up (`Qrf.spent` — the element's own drill goes back into
  the room that holds the fix for as long as it stands); `DRILL_CAP` 120 s is the net under the tools' own caps. THE SEAM IN THE SQUAD'S FILES (each
  neutral for Sam's squad — 6 of 6 playthrough digests equal to the build before on both stands, after it): orders.ts `OtherCast`, the constructor's
  second argument, `mine()` / `sams` / `team` / `ring()` / `samStood` (where Sam stands, to the marks: nowhere for another cast — unseamed, an unseen
  Sam stood on their rear man's mark moved the marks 5.9 m); doortools.ts reads those in `sync`, `lockedOut`, `bang` and the eleven mark makers that kept
  off Sam's place; its three `others` lists and `canFirst`'s 'one of ours beyond the door' are the cast's own men for a cast (they named
  operatives: a teammate of Sam's in the room would have kept the QRF's first can in the kit); orders.ts's step-aside lists (`others()`, the frame
  back-off) read `samStood` too. Still Sam's true place for any cast: `doorwayClearNear`'s last argument and the nearest-to-Sam pick by it. NOT YET THE CAST'S: the door code still names 'operative' / 'hostile' where it reads who fired and who else is about (`burstDry`,
  the threshold's watch, the shot scan, `others`), and `g.cleared` / `g.doorPath` / `g.cover` / `g.entry` are the Game's own (built over Sam's squad) —
  for the QRF those answer as for a squad nobody shot at; module states kept per Game (silent, sneak) are fresh for the view, so the cast is never
  'silent'. SWITCH: ON in the page (`?qrfsquad=0` = the element's own drill for the visit, never written to the machine; the backtick panel ▸ Stealth ▸ QRF
  'QRF ▸ clears rooms like your squad', persisted in `twopointsix.qrf`), OFF on the frozen stand (`FROZEN_HOLDS 'tune.qrfSquad'`, `TPS_QRFSQUAD=1`), a recording
  without the key replays with it off (`applyKnobs`). Off = the build as it was: two staged QRF nights × 240 half-second digests equal to aa17743c.
  CHECK: `bun run tools/qa/qrf-squad-check.ts` (`probes.ts qrfsquad`, in the `qrf` family; 12 lines, both stands; `QRFSQUAD_BREAK=1` fails every line
  but (3) and (6)); `qrf-probes.ts` pins the switch off (it measures the element's own drill). MEASURED, headless, hard, the scripted loud Sam made
  mortal when the team lands (`solo-night.ts --plan loud --hard --god --stand 90 [--stand-at 21.2,9.3] --linger 60`, 16 seeds an arm, the element two
  men — the perimeter takes two): AS SHIPPED, held from the rack in the open door's line Sam goes down 2 of 12 by either drill (four seeds stall
  before the stand on that stand); held from the corner the doorway cannot see, 4 of 12 by the element's own drill and 11 of 12 by the squad's (5 of
  them blind from their can). On the frozen stand (no samstun): door line 1 of 16 → 9 of 16, corner 3 of 16 → 1 of 16. Nothing of theirs but where
  they stand and where the can goes changed: no health, aim, count. NEVER SEEN on a GPU, never played by a person. THE PAGE (e8291995, headless Chromium on
  SwiftShader, the renderer stubbed for the run as `panel-keys.cjs` does): `__qrf.request('panel')` → `drill:bangClear` … `drill-end:in`, a cast
  built, no console error but the favicon's 404; `?qrfsquad=0` → the switch false, no cast, `squeeze` / `flow`; the row is in the panel's DOM and its
  checkbox moves the switch. The entry was never drawn. Frame cost of an entry headless: within noise of the old drill (2.1 ms a step against 1.7–2.3).
- **The response team is the level's own (`RESPONSE`, 2026-10-18; qrf.ts, `scenarios.response` — scene/scenarios.ts `ResponseData`).** The maintainer:
  "let's make it part of the level design and always make sense (ideally w.r.t. the concept/design of the level) and not all levels should have it";
  "having some randomization and modeling their knowledge based on what they've heard on the radio could make it really fun". BEFORE: the team was the
  office's one stairwell by constant (`QRF_MARKS`), and it armed on no mission row at all (a quiet level has no door named `stairwell`; the squad kinds
  are not `live`), only on the office's plain solo night. NOW a level has a team only where its file says so: WHY this place has one (a sentence, refused
  if absent), the radio's words for the place and the team, one to three WAYS (four muster marks out of sight, a four-man fan inside, an optional door
  they throw), `men` and `eta` as ranges, optional outside posts for the second lift, optional `sweep` places. WHICH LEVELS, and why: the office (its
  block is the old constant, mark for mark: `levels/office.scenarios.ts`), `police-post` (a district post with a radio room; the army picket comes by
  the main gate or the impound gate), `bazaar` (a street under curfew; the patrol comes up the street's open end or by either gate), `crossing` (a
  border company's duty section, by either yard gate on the house's side). LEFT WITHOUT, ON PURPOSE: `quiet-relay` (a hilltop: nobody is within reach,
  and its wired spot already brings its own men), `vault` (private hired guards who call nobody), `lights-out` (its one idea is the mains), `quiet-yard`
  (the test map), every Training level, and every squad level but the two a raid brings a team to (the next bullet). `response-check.ts`'s `WITH` list is the written-down answer.
  A CALL IS DEALT (`RESPONSE.deal`): when the call goes out, three draws off the game's own die pick the way, how many (inside `men`) and how long
  (inside `eta`, to 5 s) — after play began, so samestart.ts leaves it alone; a way with an enemy within `clearM` (12 m) of its muster is never dealt, and
  ten seconds out one he has walked up to is given up for another ('change of plan' on the net). The panel's 'call QRF now' is the sandbox's numbers on
  the first way. THE TEAM GOES ON WHAT WAS SAID (`RESPONSE.net`, needs `PICTURE.on`): control keeps THE NET'S WORD — per enemy, the freshest place a man
  on the defenders' net held as an idea for the picture's `tellSecs` (he has said it) or was told — past the man who said it; a man in an arm or a
  runner says nothing; a place since found empty adds nothing (the word only grows old). Where they go is that word, or the alarm's place when that was
  raised later; control's rolling line carries the brief ('last word: one man, the duty room, a minute old' / 'no word on where'). The second lift
  counts men FOUND down, not men who are. WITH NOTHING SAID, on a floor with no room plans (every quiet level), they walk the level's named places
  (`sweep`, else the quiet spots and `places`) nearest first, each once every ninety seconds, and come back to the way in. THEIR ENEMY is whoever is
  against them on the level by the shared sight test (a partner, a teammate), not Sam alone. BUDGET: with the switch on the team is spawned inside the
  frame's sixteen skinned characters less civilians (the eight shadow capsules were the old gate: men past the eighth cast no shadow capsule); element
  and outside posts together are never more than the block's `men[1]`. SWITCH: ON in the page (`?response=0`; `?responsedeal=0`, `?responsenet=0`;
  the backtick panel's QRF section: three rows and a line saying this level's team), OFF in the module and on the frozen stand (`FROZEN_HOLDS
  'RESPONSE.on'`, `TPS_RESPONSE=1`), in the knob registry and the journal (a recording without the table replays with it off). Off = the build as it
  was: `probes.ts qrf` on the frozen stand is line for line what it was before the change. The net's word is in a save (`savestate.ts qrf.word`).
  CHECK: `bun run tools/qa/response-check.ts` (`probes.ts response`, in the `qrf` family; lines (1) to (14) for this, both stands; `RESPONSE_BREAK=1` fails every line but
  (1) and (2), which read files and floors); the block against the built floor is `qrf.ts checkResponse`. THE LEVEL FILES' FINGERPRINTS DID NOT MOVE (the block is words and marks). `tools/qa/lived-check.ts` reads a level's block as today's (not held to a base revision, like the gear picture) and still asks every place it names against the room's furniture.
  MEASURED, headless, the shipped stand, god mode, a quiet mission gone loud by the real trigger (three rifle rounds heard, the floor locked down), eight
  seeds a level, 200 s each: every run called its team (24 of 24), every team came in on its fan (24 of 24, the last man 1.8 to 3.6 s after the way in was thrown), and with the
  player stood where he fired it made contact in 23 of 24; the deals over the eight seeds: the post 2 ways, 3 or 4 men, 50 to 85 s; the bazaar 3 ways, 2
  to 4 men, 45 to 75 s; the crossing 2 ways, 3 or 4 men, 65 to 95 s. No spawn refused, nobody capped, never over sixteen characters. (In god mode the
  fight never ends: a team that has him holds and fires for the rest of the run — not a measure of the fight.) Measured again after the review's fixes: the same counts. NOBODY HAS SEEN any of it on a GPU or played a run with a team on these levels: where the
  marks sit in the picture, whether men stood up outside a gate can be seen arriving from inside, the radio lines' length on the HUD, and whether three
  or four trained men on a solo quiet level is fair on hard are all unjudged. No arrival sound exists for a gate (the office's boots on the stairs are
  its own).
- **A squad's raid brings a level's team too, where its file says so (`RESPONSE.raid`, 2026-10-18; qrf.ts `raid`, `ResponseData.raid`).** The maintainer
  asked for teams on "both quiet and maybe even some loud" levels, as level design. BEFORE: no squad mission could bring anybody (the trigger wanted Sam's
  gunfire in a staff man's ears and a locked-down floor; defenders are units with neither). NOW a block that carries `raid: { room? }` answers a ROOM
  CLEAR on that level and nothing else: the team is spawned on the DEFENDERS' side (`hostile`: the squad's enemies and Sam's, friends of the garrison),
  never more than the eleven a squad ever faces with the garrison as staged (`SQUAD_MAX_MEN`), one lift, no outside posts. WHO CALLS: a living, un-held
  defender of the block's `room` (a `roomClear` room id: where the place's set or telephone is; none named = any defender) who heard gunfire at report
  level 1 or more (anybody's: suppressed rounds are not it, the defenders' own rifles are) and is still up `callSecs` (6 s) after the first of it HE
  heard (a man in an arm at the time heard nothing). Those
  men down first and nobody calls, whatever is fired afterwards: the response is something play can stop. WHICH LEVELS, and why: `depot` (a motor pool
  with trucks out on the road under escort; the signals hut is what talks to them, and going round the back to the hut and the mains was already the
  level's answer: the convoy escort, 2 or 3, by the main gate or the back gate) and `records` (a night desk with a telephone in the front office, 'the
  first room on a quiet floor': the night patrol, 2, off the street or round the back lane) and `snatch` (the village guard, 2, by the back gate or round
  the wall to the front gate, 20–40 s after the call: ONLY under `SNATCHOUT.on` — docs/agents/missions.md, *a snatch ends in the van* — where it is what the
  squad holds off while the player walks the man out; the house falling does not call it off there, only the snatch's own end does (`raidOver`). Two is all
  the sixteen figures leave on that floor: eight defenders, the four, the man). LEFT WITHOUT, ON PURPOSE: the office's three squad missions
  (its block answers a quiet night; they stay as tuned), block-squads / warehouse / compound / barracks (at eleven: nobody is left to come), registry and
  consulate (the hostage clock is the pressure), defuse / killhouse (each has its own clock), floodlit / mousehole / glasshouse (one idea each,
  and it is not this), pass (a snowed-in road). `block` (a telephone exchange, eight men) and `hall` (a police barracks wing) would suit one and have
  none yet: the maintainer's call. WHAT THE TEAM DOES: as on a quiet level, on the net's word — in a raid the net is the men at the set and the team itself (what another
  defender knows reaches control only by being told to a man at the set: `PICTURE`'s tell); with
  nothing said it looks in held rooms whose men have ALL gone quiet (an empty room counts) and the level's `places`, never walking through a room that
  still answers. THE STRUCTURE IS NOT TAKEN while the team it called is up (`roomclear.ts` asks `responseUp`: stood at its way in, or on the floor, a man
  living; one line says so, 'rooms clear — the convoy escort still on the ground', and the objective row keeps its name); a team still on the road
  when the run ends, won or lost, is called off and never arrives. The debrief's 'of N defenders' counts the team's men once they exist. A restage despawns them with the cast. SWITCH: `RESPONSE.raid`,
  on with `RESPONSE.on` in the page (`?responseraid=0`; the backtick panel's QRF section, 'the team: a raid brings it too'), nothing on the frozen stand
  (`RESPONSE.on` is off there); a recording whose `RESPONSE` table has no `raid` key replays with it off (`journal.ts`). CHECK: `response-check.ts` lines
  (15) to (21), both stands, and its `RAIDS` list ((18) also stages the office's hostage rescue: no block answers a rescue, so the rescue's own ending never has a team on its way); `RESPONSE_BREAK=1` fails all seven. MEASURED, headless, the shipped stand, god mode, eight seeds a
  level, 200 s, three rifle rounds at the start line and a squad that never leaves it (so not a played raid): the depot's hut called 8 of 8, the escort
  (2 or 3, 55 to 90 s) came in 8 of 8, always by the back gate (the squad stood at the main one) and met the squad 8 of 8 — it lost every man in 5 runs
  and put all four teammates down in 3; the records office's desk called 5 of 8 (in the other three the desk man came out and was shot inside his six
  seconds), the patrol (2, 55 to 90 s, both ways dealt) came in 5 of 5. No spawn refused, never over sixteen characters. Before the review's last fixes
  (the call is each man's own six seconds; the net is the set and the team); the check's lines ran after them. ON THE RECORDS OFFICE THE WAY IN DECIDES IT (10-19, after the newer guns joined; headless, a pair that fires three rounds and holds its start): from the dark lot the desk is the first man the pair meets and on the shipped stand he was down inside his six seconds in every start tried (9 of 9: nobody came; on the frozen stand he called, 3 of 3); from the other way in, the dark west side, he heard it and called every time (4 of 4 on each stand). Check line (21) plays both. THE REAL PAGE, on the software adapter (never a GPU): the depot under `?roomclear&squad=4` booted with every pipeline built and no console or page error (the dev server has no favicon: its 404 is the one line); called through the page's hook, the escort stood up on the defenders' side, was dealt away from the main gate to the back gate when the squad stood at the first, came in and swept the yard. NOBODY HAS SEEN OR PLAYED IT: whether six seconds is a
  window a player can use, whether two or three more men at 50 to 90 s is fair on the depot on hard, whether the squad's rear men are shot in the back at
  the gate they came in by, and how the radio lines read on the HUD in a firefight are all unjudged. The headless squad stands at its start line: no
  measurement here is of a played raid.
- **The calm torch check reads every frame, and holds the close rule's dark term for its raised-men line** (`tools/qa/calmtorch-check.ts`, 10-13; no game code moved). Two reds, neither the
  rule's: (1) FROZEN, 'night … no frame goes against the dwell', 22 frames, red on the build since the join with real-size doors (bisected: `ae9897b2`; green at the rule's own commit): the
  rule asks four times a second on a frame of its own and the check read every FIFTH frame, so a ONE-frame dip of Reyes's reading in the break room (137.60 s, lit → between → lit) fell on
  the rule's ask, restarted its two-second dwell, and was never seen by the check, which then called the torch 22 frames late. The check now reads every frame (the probe takes about 85 s,
  from 60). (2) SHIPPED, 'Sam stood on a man's beat', 0 man-frames: with `CLOSE.dark` (close.ts `closeNearK`) a calm man passes Sam unseen in the dark short of touching him, and Novak's
  waypoint is dark, so nobody was raised; the line is about raised men's lights, so that one term is held off for its walk. Both stands ALL PASS; `CALMTORCH_BREAK=1` fails on both.
  the energy of the gun that made it — `Lane.e`, glasspen's `shotEnergy` — and its floor is asked through panes at that energy, so a rifle's lane reaches through a window; shipped stand
  only: on the frozen stand glass stops rounds) · `stopClear` + `lookM` 1.5 (a man is not stopped short IN a doorway nor where a gun of the lane has a line a body's width wide, his look point is never
  under his own feet, a held man shoved onto such floor backs out again — never a man set on the lane's other side —, a lone man whose own look cleared the lane is the room fight's again,
  and the corner looked round is the lane's first floor on his walk, not a mouth seen slantwise through another door) · `roused` (a round passing a living man costs his side nothing unless he
  NOTICES it inside `reactSecs` 0.35: alert / searching, awareness ≥ 0.3, suppressed by it, a man in sight or a shot heard — two quiet rounds at a lamp past a calm man called a lane).
  Eight holds of The block, 150 s, hard, mends on against `stopClear` off: seconds a held man stood in a doorway 7 against 27, with a holder's rifle line on him 4 against 21; defenders down 31
  against 25 of 56 (not a difference at that size; the extra are men who went round — 17 against 11 — and met a holder whose gun had cost them nothing yet), team 1 down both.
  State is per Game (a WeakMap), reset with the guards, saved as the optional checkpoint slice `lanes` (a man's errand round, a burst and its volley clock are not: after a load they are dealt again). Tab ▸ Enemy AI ▸ 'Covered lanes'.
- **Hard's card on a squad map says the floor's kit (10-13).** `difficulty.ts difficultyWords`, the squads' branch: when `HARD_AT` gives the level's structure a
  stun charge the sentence ends 'Here each carries a stun charge, and throws it ahead of him before he comes at you' (the pool branch always said its own
  form of it; the squads' branch dropped it). Today that is one floor: the rebuilt block (`block.json`, structure 'the block', eight men as four stay-put
  squads of two, `squads: true`), which now has a `SQUAD_HARD` row of its own with no words, as the warehouse does ('the squads here are the standard ones. Nothing measured made this map
  harder and stayed fair: it is steep as it stands', then that clause), and a `DRILL_AT` row with the drill off to match (hard's runs are the same to the
  second with the row and without it, 20 of 20). By the go-round route (`PT_ROUTE=m_k,w_c,b_f,s_j`, `ROOMCLEAR.fresh` off) seeds 1–12: taken 12 of 12,
  34 of 48 men up, standard and hard the same run on every seed. Measured there by the hall doors, scripted
  team, shipped stand, seeds 1–8, standard against hard: wiped 8 of 8 on both, 7 of 8 runs the same to the second; the one that differs (seed 7) is the
  kit — with the Enemy kit lever on none it is standard's run again — and the trace shows it used by the lane rule ('a charge down it', then he pushes
  behind it). No look is ever called there: a squad of two in one room has no pair to spare (`lookOut` wants two men beyond one a room), and no squad may
  leave. NOT done: no hard rule of the block's own (whether hard should bite on this floor, and how, is a call for the maintainer); no check line holds the clause (`levers-probes` holds the sentence's opening only). Words only; never seen on a page.
  WORDS MENDED 10-13 (the words thread's two claims, both true): the card with no sentence of its own now reads 'hard: the squads here are the standard
  ones: this floor is steep as it stands' (the warehouse and the block; 'nothing measured…' was the test bench talking), and the kit clause 'Here each
  carries a stun charge, and throws it down a hallway he knows you hold' — on the block nobody leaves his room, so the only use measured is the lane
  rule's charge (1 of 8 hall-door deals, 0 of 12 by the go-round). A floor whose squads do come at you with one would want the older words back.
- **The net goes quiet** (`src/game/netquiet.ts`, `NETQUIET.on`; the third slice of the enemy's morale — the maintainer, 10-13: "Dread from unanswered
  radio checks and bodies found. Heard in the calls getting worse, seen in beams whipping to noises. Done-test: the last man never dies standing upright
  without firing"). ON in the page (`?nonetquiet` off; the debugger's Enemy nerve row 'a quiet net frightens them', kept for the visit), OFF in the module
  and on the frozen stand (`FROZEN_HOLDS` 'NETQUIET.on' → `TPS_NETQUIET=1`, which needs `TPS_MORALE=1`: it does nothing with MORALE off); rides the journal
  (a recording from before the key replays with it off) and a checkpoint (`netQuietSnapshot` / `Restore`, which also puts back the squads' hold and book:
  the squads tick before this file does). FEEDS, all through `moraleShock` (its cap and nerve), × `steadyK` 0.6 for a steady man: a mate who does not
  answer a check `unanswered` 0.12 to the asker and `heardIt` 0.06 to each man who heard it (enemysquads.ts radioCheck, guards.ts updateRollcall,
  laststand.ts tickCheck — the dead count: it is the dead who do not answer); a body found `body` 0.2 / `bodyTold` 0.08; a mate seen to fall
  `fallUnseen` 0.22 with no enemy in the watcher's view, `fallSeen` 0.08 with one (combat.ts killGuard after `moraleManDown`: a leader's fall is
  leaderShock once, not both). ONE DEAD MAN IS ONE SHOCK to one man: the largest of the three, not their sum (0.22, where it was 0.54). LINES, on the net
  `askBeat` 1.4 s after the check's own: the name again (the squad's own name for him, `mate()`) · "why's nobody answering?" from the second unanswered
  check · "somebody talk to me!" only with nobody of his side left on the WHOLE net; the finder of a body nobody heard go, `bodyBeat` 2 s after; the last
  of a squad with other squads still up has his own pool ("nobody left in here but me"); a roused man nobody has asked anything asks the net himself
  ("all posts, answer up"). Six pools of three, placeholders, in the file; no `w()` pair: they name no enemy. WHIP: a jumpy or broken man who HEARD an
  enemy's noise (his own ears' counts went up) has as what he watches, `whipShift` 0.12 s later, the place HIS EARS put it — `smallWhere` / the room
  fight's `noiseAt`: the doorway it came round, the source only through open air or when it is inside `whipNearM` 4 of that place and in plain view; never
  further than `whipM` 15, never a mate's rounds, never a noise he did not hear; his fix (`lastKnown` aliases the watched point) is never truer than his
  hearing. He comes round, gun and body, at `whipTurn` 10 / `whipTurnBroken` 14 rad/s for `whipSecs` 1.5 s, one target `whipHold` 0.8 s at the least, a
  second noise no second shift (roomfight.ts applyWatch → `netQuietLook`; guards.ts pose → `netQuietPose`); never with a man in his eyes. LAST MAN, as far
  as HE knows it: every man of his squad down and each known to him (asked for and silent, seen to fall, found, told of on the net) with no living man of
  his side in the open inside `mateM` 5 of him — or nobody of his side left at all AND a check gone unanswered in his hearing (nobody has asked: roused
  `calmSecs` 2 s he asks himself, and it is the silence that has him act; the world's truth only ever has him ASK). His line (a line a check has just had
  out of him is that line; a line owed is waited out; what he has just learned has `askBeat` first), `lastBeat` 1.5 s, then he backs (2 m/s, facing them)
  to the spot of his room with the most entries in view inside the narrowest arc (any arc ≤ `arcDeg` 40 as good as another; then far from the doors, near
  him, a wall at his back), goes low, is roused as `plant()` leaves any defender at a new post; a man his squad has out hunting comes back for it. He does
  not rally and his squad does not send him (roomfight.ts rally → `netQuietHolds`; enemysquads.ts home → `netFeedHolds`) — unless he has waited `giveUp`
  8 s for the fight to hand him back. A living mate at his side `calmSecs` and he is up, the act dropped (a man walking past does not do it). `alertSecs`
  15 s of nothing seen or heard and he is no longer 'alert': 'suspicious', held at `wary` 0.35, still low on the spot; anything he hears rouses him again.
  THE FLOOR'S EYE, found by walking Sam in (guards.ts canSeeChar / eyeContact, not changed): a man's eyes look half way between his chest and his head, in
  plan — about 41° round from his gun toward his chest, and the more that look is pitched the narrower. Fully crouched it is 48° round and 26° either
  way: past the near field (`nearM` 3.5) such a man does not see the man he is aiming at (measured: Sam walked 2.4 m into the room unseen; seen at the
  threshold, the sighting flickered and no round came in 6 s). So LOW is `crouch` 0.4 (41° round, 49° either way), and what he watches is the arc's middle
  moved round until every door is inside his eyes (`eyeDeg` 58 = GUARD_EYE.halfDeg, `eyeSlack` 4): his gun rests off the middle. A man the room fight or
  morale crouches right down has the same blind aim — not this file's to fix. A man `moraleOwns` is morale's. IMPORT CYCLE: enemysquads.ts must not
  import netquiet.ts (it pulls morale.ts forward and the headless boot throws in wind.ts) — its three seams go through the leaf `netquietfeed.ts`, read by
  netquiet's tick. UNSEEN / SILENT (unseen.ts `found`, silent.ts `silentHolds` read a defender 'alert' or 'search'): the last man is 'alert' from the frame
  he is low until `alertSecs` of quiet, never 'search'. Measured on the shipped stand, ten men dropped quietly: rule on he is alert at 13.4 s for 15 s; rule
  off his squad has him alert at about 31 s (one run, by hand, not a check line) — so the team's modes end sooner with the rule on (by 18 s there), and can come back.
  With the squads off an ordinary last man is never alert on his own: there the rule ends those modes where nothing did. An ordinary planted man with the
  squads off stays 'alert' for ever (awareness 0 after 30 s); with them on his squad calms him (search at 15 s, patrol at 40 s). Check
  `tools/qa/netquiet-check.ts` (family `netquiet`, 23 lines), `NETQUIET_BREAK=1` (every feed, the spot and the watch seam cut) red on both stands, the
  real-run lines among them. MEASURED, headless, compound room clear, Sam alone, frozen (`TPS_MORALE=1 TPS_NETQUIET=1`) and shipped. The done-test, 6
  seeds, Tango 3 in a two-door room, Sam WALKING in (1.4 m/s, no footfall, stopping where he is first seen) by the door the noise did not come from. Rule
  on, 6 of 6: nothing for five seconds while nothing has roused him; the door rattled, he asks the net at 1.6 s, his line at 3.0 s, backs from 4.6 s, low
  at 5.8 s after 1.78 m, arc 34°; Sam seen AT the threshold (0.02 m past it), first round 0.15‥0.30 s later (median 0.27). Rule off, the same man made
  ALERT and watching the door the noise came from (the owner's case), 6 of 6: upright, Sam's door 75° off his watch, Sam never seen in 6 s standing 2.5 m
  inside the room — no round. So the comparison is a man who sees the door against a man who does not; no reaction number differs (the upright man's own
  sighting-to-round beat was not measured: he never had a sighting). Other rooms and states, rule on: his squad's rules live and gunfire at his door (he was out searching,
  comes back 4.9 m) 1.10‥1.27 s after the sighting; a man whose spot is where he stands 1.12‥1.27 s; a three-door room has NO 40° spot (arc 83°):
  0.18‥2.63 s; 23 s of silence later ('suspicious') and no sound before Sam is in the doorway 1.07‥1.27 s, the door tried first 0.27 s. Whip: watches the
  noise at 0.17 s, gun on it at 0.27 s; off: a doorway at 0.72 s, never the noise; through a wall he whips to the doorway his ears gave him, 1.98 m from
  the source, and his fix is never nearer it; a mate's shot with a step of Sam's 39 m off: no whip; steps every 0.35 s: 1 flip in 3 s. REAL RUNS
  (shipped stand, a child process of the check — the frozen stand holds the squads' radio check off): ten men dropped quietly → the last defenders' own
  check closes unanswered at 9.3 s, "somebody talk to me" at 10.7 s, low at 13.4 s; three of one squad struck down 45 s apart then the rest → squad asks
  2, squad bodies 2, the name at 18.6 s, why at 59.9 s, the last line at 91.0 s (never while anybody else was up), low at 93.3 s; the office floor, one of
  the staff struck down → the roll call asks at 6.0 s, "Reyes? … Reyes." at 7.4 s. CALL OUT IS NO LONGER TELLING ONLY with this rule on: the last defenders' check, closed over dead men, shakes the men who heard it, so a run
  with call out on is not the run with it off (`laststand-callout`'s digest line went red on the shipped stand; that probe now holds NETQUIET off and says
  why). The shipped gate's other reds are the tree's own, the same lines on the commit this branched from (enemysquads-radiocheck 3, laststand-callout's
  radio strip 1, checkpoints 4). NOT DONE / NOT SEEN: nothing of it on a GPU or played; every number a
  first guess; the lines are placeholders; `wary` is this file's own (an ordinary calmed man goes right down to patrol: 0 gives that, and then a silent
  walk-in after 15 s of quiet drew no round in 6 s — measured once by hand); the body a 'found' is about is not passed through the seam — the
  nearest dead man of the squad the finder does not yet know of is taken; the self-ask is started by the world's truth (nobody IS left) — only the act
  waits on the silence; the staff's last man only says his line (he holds no room); a whole checkpoint is refused on the room clear (spawned units), so
  the check takes the slice and puts it back by hand; open floor with doors all round (arc > 180°) is left to the room fight's own watch; the
  drop-and-run slice's man is not excluded by name (that rule is not in this tree); the walk-in is Sam moved by hand, silent and lit; no tour, soak or
  tally was run with it on.
  JOINED (10-13) to the run and doorway rules: a man runner.ts has (`runnerOwns`: shout, drop, run, gone) is OFF THE NET — `onNet` — he hears no check, takes
  no shock from one, files none and finds no body; asked for by name he is a silence like a dead man's (`unanswered` to the asker); the tick drops any whip,
  owed line or last-man act of his and `free` keeps new ones off him: never whipped, never the last man. To the man he left he is gone (`lostTo`: dead, taken,
  run, or off the floor) once that man KNOWS it (asked for and silent — nobody is told by this file that a man ran: not wired), so the last of a squad whose
  other man ran does settle as the last man. `moraleOwns` already yields (`free`). THE LAST MAN'S HOLD WINS over the dark doorway: darkdoor.ts `own` asks
  `netFeedHolds` (the leaf), so he is never stopped at a doorway nor called to one, a balk of his ends on the frame he is the last man, and its sweep gives
  his aim back. Training: `trainingOf` / `sawLeaderFall` read as 39bc0d45 has them; under 'none' every man is steady (× `steadyK`) and nobody is a leader —
  no case of the check runs on it. The panel row stands in Enemy nerve with the rest. netquiet-check (Q13): Tango 4 run, deaf to the check for a dead mate,
  silent when asked for (+0.07 to the steady asker), never the last man, no line; Tango 5 then says his squad's line and is low at 9.37 s; the control (the
  same mate standing): no last man. The check pins RUNNER / DARKDOOR off after every stand-up but for (Q13); morale / training / runner / darkdoor checks and
  laststand-callout pin NETQUIET off after theirs. THE COMPOUND WAS PLACED AGAIN on the build (four squads — Yard five, Gate one,
  West two, Keep three —, the sala one man) and netquiet-check, training-check and darkdoor-check (17) are RESTAGED on it: they load `levels/compound.json`
  as it ships and name no man by callsign (the first-placement overlay and its fixture are gone). training-check: the mixes read on five / three / two /
  one; the lone man is the nearest who is not his squad's first, stood in the hut (the hut's own man is a squad of one: his own leader, who stands and does
  not duck); the leader and his green men are the Yard's. darkdoor (17): a squad of one is its steady man; the Yard's men at the pantry door. netquiet:
  the squad cases on the Yard (leader in the garage, four in the shed), the whip on the kitchen's man, three doors = the sala, the last man = the garage's
  man on that room's SECOND mark (where he is dealt his spot is where he stands: that is (Q6d)'s man who stays); (Q11)'s mate is stood at his side every
  frame (left alone a man of another squad walks home through the door inside 4 s and the wall makes him the last man again); (Q12b) is the Yard's leader
  struck at 1 s, a man of the shed at 100 s, the rest at 135 s, on FOUR casts (seed 5 with the shed's third, second and fourth man left; seed 7). THE
  RUNGS' REAL CONDITION: the squad asks only for a man whose fate it does not know (enemysquads.ts radioCheck) — a man a mate SEES down is a body found, no
  check. Seed 5: the second man lies 23 s unseen, the squad asks twice, and every cast says the name (42.9 s) · why (120.0 s) · the last line, in order.
  Seed 7: a mate has him in sight the frame he drops — one ask, the name, a body line, no "why", the last line; the check asserts that too. Seven casts
  run by hand: "why" came in every one with two asks and in none with one. Two things made a rung easier to lose and are changed: a line owed at a bad
  moment (a man in his eyes, his last line under `barkSecs` old, morale's hands on him) was DROPPED — it now waits, `sayHold` 4 s at the most; and the rung
  was the asker's own count — it is the net's (the most any man who hears him has heard go unanswered). THE SPOT AND DOORWAYS (`lowSpot`): a spot inside
  `doorM` of ANY entry is never taken, wherever he starts — the guard used to hold only for a man not already inside `doorM`, and the kitchen's man as
  dealt (1.94 m from `k_s`) backed to 1.47 m from `k_p`, the other door out of his arc. A man who starts inside `doorM` has that as his reason to move
  (to the best clear spot, better than where he stands or not); a room with no clear spot: the one furthest from its nearest entry, then the best arc.
  (Q6g), the kitchen's man as dealt, 3 seeds: walks 2.90 m to 3.50 m from the nearest entry, arc 46°, Sam's door in it, round 0.18‥0.30 s after the
  sighting. The sala's man (dealt 1.97 m from `s_e`) now takes 123° clear of every doorway, not 116° in one. The garage's man as dealt stays because
  where he stands is already the best class there is (both doors in view inside 36°, 3.3 m from the nearer; no spot beats it by `stayM`), not for want of
  a spot — and a man for whom no spot is found goes low where he stands (`settle`, the same path). 27 + 17 + 26 lines green frozen (the four
  words) and shipped. Headless only; never on a GPU, never played.
- **A far glimpse is no place to walk to until it is what has him looking** (`guards.ts GUARD_EYE.farCalm` + `farFaint`, 10-13; the quiet levels thread's finding on
  the relay). The fault: with the far reach on, a lit man half-seen from past 16 m — far too faintly to turn a head — still wrote the calm man's `lastKnown`
  (updateGuard's glimpse line: any rate over 0.05); the mains going (`lighting.ts setBlackout`: every patrolling man to 0.34) then made him wary and a wary man
  with a fix walks to it — 4 to 5 m off his post, in the dark the far reach was never to change. Now, PAST `range` ONLY: a calm man's fix lands on the frame the
  sight itself takes him over the 'huh?' line (0.3); a wary man's from `farFixAt` (0.5) aware and every glimpse from then on (from the blackout's 0.34 that is
  0.63 s of a man in full light at 20 m: he turns and goes 1.4 s before CONTACT, he does not stand till it); a man hunting takes every glimpse, as ever. The held
  pair's acquisition (the standoff's `!inIt` line) reads the same. Inside 16 m and with `far` off nothing changes. Switch: on in the page (`?nofarcalm`), off in
  the module and on the frozen stand (`TPS_FARCALM=1`, a `FROZEN_HOLDS` row); `GUARD_EYE` is a journal table and a recording with no `farCalm` key replays with
  it off. Tab ▸ Detection & movement ▸ 'a far glimpse is no place to walk to'. Check: `probes.ts farcalm` (also in the `farsight` family and all-quick), 11
  lines PASS on both stands, `FARCALM_BREAK=1` exit 1 on both (4 lines red). Measured headless, shipped stand, rule on against `TPS_FARCALM=0`: farsight,
  far-refix, quiet, darkfoe, calmtorch, whistle, close, stealthpose, sticky, quietfog, journal, shipped the same counts, 0 FAIL; `depot-run` (24 scripted runs)
  stalled 0 both, taken 18 against 17. The page boots with it on (shipped-page `plain=`: 138 tables, no row differs) and `?nofarcalm` puts it off there.
  NOT done here: the relay's own blackout play (the quiet levels thread's runner; `quiet-pair.ts` gave the same six outcomes with the rule on, off and with
  `far` off, so it does not exercise this); no tally over missions; never seen on a GPU, never played. NOT touched (other files' own senses, a claim to their
  owners): a scripted man's eye in `squad.ts` and `qrf.ts` still writes his fix off any far glimpse. A fix can land a frame or two before the 'huh?' when the
  rate is under the 'seen' line (the unseen decay runs after the glimpse): he is at the line either way.
- **Dig-in: the furniture comes home (10-13, `HAULHOME`, `src/game/digin.ts`).** A hauling defender was asked whether his furniture had made it the
  frame he stopped at his stand by the door (`case 'haul'`, planted). Furniture that had swung wide of him on the way was then 1.32 to 1.44 m from its
  place against the test's 1.3, with 4 to 6 s of `haulBy` unspent: 'the furniture did not make it to the door', and he took cover beside it. The compound's
  second hand placement (a620967d) re-dealt who hauls from where in the last stand and most deals fell in that hole (the haul's code had not changed): the
  doors thread's `frameholds-wedge` (its `FH_SEED`, seeds 1‥8, both stands) was green on 3 of 16 deals. ON (`bringsHome`): at his stand (< 0.9 m), his clock running, the
  thing within 1.2 m of him, the door still one a wedge holds, `haul()` goes on bringing it to `M.rest`; the same clock ends it, the same test wedges it;
  he logs 'brings it the last of the way' once a haul. He stops when it gains nothing for half a second (caught on something: asked as before), and a leg
  another rule gives him meanwhile is not a haul (`was moved off his furniture`, the thing stays where it is). The switch is a table of its own (`HAULHOME.on`: `difficulty.ts tablesOf` rewrites `DIGIN` from its
  defaults at every level change, so a stand's word cannot live there): off in the module and on the frozen stand (`TPS_HAULHOME=1`), on in the page
  (`host/profile.ts`, `?nohaulhome`); `FROZEN_HOLDS` row; registered in `knobs.ts` and carried by `JOURNAL_KNOBS`; a recording without the table replays
  with it off (`journal.ts applyKnobs`). Off = the old line of code, nothing else read. Check: `bun run tools/qa/haulhome-check.ts` on both stands (the
  compound's last stand, doors hung into the room and closing on their own; it plays deals 1‥8 with the switch off and replays with it on the ones where a
  man gives furniture up at the door, so a re-deal moves the deals and not the check: 10-13 shipped deals 3, 5, 6 go from 0 doors wedged to 2 each, frozen
  deal 6 from 1 to 2; `HAULHOME_BREAK=1` fails on both; in no probe family, run by hand). A play-through's `--set '{"HAULHOME":{…}}'` lands on both stands. The doors thread's probe with it on: 7 of 16 deals green.
  MEASURED (scripted team, the page's stand, on against `--set '{"HAULHOME":{"on":false}}'`): hard, seeds 1‥8 — room clear four, the depot and the
  barracks play the same run for run; the warehouse 6 of 8 the same (won 5 and 5, 9 wedges both); the compound, 16 deals: wedges placed 73 → 81, won 9 →
  7, team standing 24 → 23 of 64, 8 of 16 the same. Standard, seeds 1‥8 (squads dig in there too): the compound's wedges 36 → 39, won 4 → 3, team standing
  8 → 4 of 32; the warehouse won 5 and 5. So it gives the compound back wedges its placement was tallied without, and the compound is a little steeper for
  it: a claim to the compound's owner, `?nohaulhome` is the way back.
  NOT mended, and not this rule's: (1) with the furniture AT the door and the leaf not yet latched, his hand waits `latchSecs` (2.5 s) and then he lets
  the brace go without a word — a closing leaf a few frames from home (deal 2: 0.02 rad), or a mate still standing in the doorway (the probe's stay-open
  arm on deals 4, 7, 8: a mate 0.5 m from the door). That wait is `DIGIN.shutOpen`'s ground (7 s, pushes home, pulls again), which ships off because it
  overshot the barracks; (2) nothing about which furniture he picks or where he pushes from. Never seen on a GPU, never played by a person.
- **A calm guard with a long wait in the dark sits down and dozes (10-13)** (`src/game/doze.ts`, `DOZE.on`; page on, `?nodoze`; frozen stand off, `TPS_DOZE=1`;
  on the shipped stand `TPS_DOZE=0` puts it off; a `FROZEN_HOLDS` row; table in `knobs.ts` + `JOURNAL_KNOBS`, a recording from before the key replays with it
  off; Tab ▸ Sandbox ▸ Detection & movement 'calm guards doze in the dark' + a read-only line). The maintainer's ask (2026-10-13): 'guards sleeping in dark
  rooms … snoozing off in a chair. it should make sense why they're hanging out when they can't see.' BEFORE: a patrol waypoint with a long wait in an unlit
  room had the man stand there upright in the black (the calm torch rule puts his lamp out where the place is lit, not where it is dark; he burned it at a
  wall). NOW: a staff man (no unit, no civilian, no post, not a leader) who comes to a wait of `minWait` 20 s to `maxWait` 90 s (longer = he is POSTED there) at a
  waypoint that is not `workLit` (calmtorch.ts: steady lights only) and where the floor he faces is dark too (darkfoe.ts `darkFoeBlind`, asked as he comes
  onto the wait: a man in the dark with lit floor before him is a picket and can see what he is there to see — the relay's, 110 s with the lit door in his
  eye, never sits: both terms hold him, and a check line), with a chair of kind 'chair' within `chairM` 4.5 m that is itself in the dark, at rest and nobody else's, walks to it,
  sits (close.ts `closeSeat`: the rule NEEDS `CLOSE.on`), puts his torch out, nods for `nodSecs` 2.5 s and sleeps: head on his chest (`character.ts` animator
  `slump`, over `Sitting_Idle_Loop`), a 'z' that grows with his breath over him on the HUD (`overlay.ts`, `dozeMark`). His wait clock keeps running: he is up
  `riseSecs` 2 s before it ends and walks on, so the timetable is close, not equal: his wait clock runs on while he sleeps, but he gets up at the chair, not at his stand, and leaves a second or two late (the check's line (i): within three seconds of when he leaves with the switch off); and the quiet levels' owner reads (its claim, not traced here) that a seated man skips a need he would have walked off to, so on the relay Marsh leaves one stand 13.7 s sooner. ASLEEP: eyes shut (guards.ts `canSeeChar` /
  `pointInView` / `bodySeen` / `pairInView` and sneak.ts's two eye lists ask `dozeAsleep`, so a partner's take, a teammate's sneak read, a body and a kill are
  all unseen by him), ears dull: `hearingCheck(g, gd, ear)` runs for him with the small noises at `hearK` 0.6 (ONE copy of the gates; `ear` is 1 for everybody
  else, and a light going out is not seen at under 1) — a crouched step never wakes him, a walk does inside about two metres, a jog inside about six (open
  air; a wall between cuts it), a door or shoved furniture near him, glass, any shot, bang or kicked door as for a waking man, and a whistle that is HIS to
  answer by whistle.ts's own rule (the nearest calm man in its reach: he wakes and comes; a nearer man answering leaves him asleep). He says nothing asleep
  and is never the radio check's caller or the alarm's spokesman while another man can be (needs.ts `partnerReply`, guards.ts `radioCaller` / `spokesman`);
  he DOES count in on the radio check (one log line: a sleeper who did not would set the missing-man hunt going every check). Light on his face from a lamp that is not his own side's for `lightSecs` 0.8 s wakes him; so does his chair being shoved. WOKEN that way he is up,
  suspicious (`wakeAw` 0.55, a bump 0.7), placed on what woke him, rooted `stirSecs` 1.3 s while he comes round — and awake for the rest of the run. An
  alarm, the net raising him, the mains cut (nobody sits down to doze in one either), a script, a body duty or his seat taken away (the panel's 'everybody
  up') get him up by their own rules; a woken man's chair is free for the next man. The close-in 'seat' take (haul him out of the chair) is live on him from
  behind. A checkpoint carries it (`savestate.ts` `doze`). Excluded: lessons, tours, puppets, any escalation. `dozeWoke(g, gd)` is the seam for a rule about
  a woken man's lamp (darkfoe.ts does not read it yet); `dozeBreath` is the clock for a breath sound (there is none). WHERE they doze
  is the level's own light and chairs. MEASURED headless (CPU light estimate; shipped stand, one deal each, five minutes): quiet-relay Marsh (comms hut,
  50 s wait) asleep about 44 s a lap; police-post Reyes (48 s wait, about 42 s a lap) in the bunk-room chair — Okafor (25 s) and Brandt (37 s) dozed in it
  too until the screen below: now they sit to that; bazaar,
  crossing, vault, lights-out and the quiet yard nobody (no dark chair in reach of a dark long wait: e.g. the relay ops room's 110 s wait has only a lit
  chair, the bazaar kitchen's 26 s none). The frozen stand has no bunk-room chair at all (it is lived-in furniture, `LIVED` off there): the check loads the
  level with it. `bun run tools/qa/doze-check.ts` (`probes.ts doze`, family `quiet`; 22 lines: sits and sleeps, eyes shut against an awake control, dull
  ears both ways, woken by noise, by a whistle he answers, by light, by a shove, the alarm, the seat take, the timetable, nobody asleep in a lit place over four minutes, the relay's picket never off his feet in six, checkpoint (every record after a load = at the save),
  the six screen lines below, off = the base by digest; `DOZE_BREAK=1` fails that last line) — ALL PASS on both stands. NEVER SEEN ON A GPU, never played: the slumped pose, the 'z',
  whether 20 s is too eager, whether the chair he turns as he sits reads. The chair creeps a few decimetres each time he gets up (he shoves it rising).
- **… or sits to a screen there (10-13; the same switch, `DOZE.screen` its half)** (`doze.ts` phase 'work'). The maintainer's steer the same day: 'working
  on a computer in a dark room (with their face illuminated by light) … attention being on the screen (and maybe even headphones on?) so they'd be less
  perceptive … opportunities for funny writing too.' Where the chair is at one of the level's screens (a switchable in group `monitors`, not shot out,
  nobody at it, within `screenM` 1.5 m, the chair on its lit side) the wait can be sat out AT it: he PULLS THE CHAIR UP (at most `pullM` 0.5 m, 5 cm
  steps, nearest first, to where a man facing the screen has room for his feet by `col.circleTouches` and the screen in his eye; he walks to the nearest
  free floor — the nav grid is 0.5 m, coarser than a gap between a cot and a crate — and the seat takes him the last step), sits FACING it, switches it on
  if it was off (its analytic area light is a light like any other: on his face, in the room, to the meter and to every eye — a room built dark is lit
  while he is at it), torch out, awake, eyes whole (he sees what is in front of him: the screen), HEADPHONES ON: `hearingCheck(g, gd, ear, eyes, foot)`
  runs with the small noises at `noises` 0.6 and a footfall at `ears` 0.5 (`dozeEar`); a '♪' over him until something has reached him (then the HUD's own
  dots), and a word for the screen now and then (`SCREEN_LINES`, twelve; `sayFirst` 5–11 s in, then every `sayEvery` 16–30 s; a bubble only — no radio, no
  log row; no line twice on the floor until all are said; `dozeLines()` is in the words lint's list). WHICH: a wait under `napWait` 40 s takes the screen
  before the sleep, a longer one the sleep before the screen — one chair can be both. UP: whatever gets any seated man up (awareness 0.3 by the net, his
  chair shoved, the alarm, the mains — the screen is on them), and the screen going dark under his eyes (woken 'light', looking at it); got up that way,
  HAULED OUT of the chair or PUT DOWN in it (killed, knocked out), he LEAVES IT ON: it stays lit `idleSecs` 60 s with nobody at it and then blanks (`LEFT`, in the checkpoint), or the next man
  who sits to it switches it off as he leaves. At the end of his wait a man switches off what he switched on and gets up. NO DOZER SHOVES HIS OWN CHAIR
  as he leaves it: the 'up' record (no contact for the furniture, `dozeInChair`) lasts until he is 0.75 m clear of it, calm, 30 s at most — the screen man
  and the sleeper alike (10-13, after the quiet levels' owner saw a sleeper push the chair a screen man had turned 0.1 to 0.4 m further on every rising).
  The chair stays where the first screen man put it, which may be a hand AWAY from the screen (0.3 m on the post): it goes where he has room for his feet. The switch going off, a reset or the man leaving the roster switch his screen off with him. A sleeper's
  'light on his face' does not count the room's screens. A checkpoint carries it (the screen, whether he switched it on, his next word's clock, the said
  bag); a recording from before `screen` replays with it off, one with `screen` and no
  `idleSecs` with a left screen that stays lit (`journal.ts`). The longer rise has NO knob: a recording made on a join that carried the dozer and not this
  commit (none was a named build) may part from its replay where a sleeper shoved his chair. KNOWN LIMIT, not met on any level: a man whose NEXT waiting stand
  is inside 0.75 m of the chair he rose from keeps his 'up' record up to 30 s (he is not asked about that wait meanwhile, and the chair reads as taken). THE LEVEL: the police post got ONE terminal, built OFF, on the bunk room's
  footlocker (`tools/levels/police-post.ts`, `officeKit.monitor(…, standby)`: a switchable built dark; the last five boxes of the base layer, so no other
  box took a new id; the chair is the lived-in room's, so the frozen stand's post has the terminal and no chair — nobody sits there). `police-post.json`'s
  fingerprint MOVED: a tape or a save of that level from before this commit will not load. quiet-check 27 of 27 deals, `level-lint`, `quiet-light
  police-post` and `probes.ts quiet` green on both stands with it. MEASURED headless, one deal, six minutes, both stands: Okafor (generator, 25 s) at the
  screen 20 s, Brandt (bunk, 37 s) 64 s in two sits, Reyes (corridor, 48 s) asleep 62 s in the same chair in two sleeps (the lap between he stands his wait; why was not traced — Brandt had left the screen seconds before; after the merge of the build head that carried the attention rule the frozen stand reads 81 s for him, the shipped one still 62 s: the build's change, not traced); the chair 0.30 m from where the level put it and in the same place at both sleeps; 5 lines said; the light at the
  sitter's face 0.22 on the meter's scale (0 with the screen dark; the CPU estimate). No other level has a chair at a screen in reach of a dark wait (the
  office's and the quiet yard's monitors stand by lit or short waits). Check lines (m)–(r) of `doze-check`: sits to it / headphones / the screen dies / left lit
  and blanks, the same after a load (o2) / checkpoint (a load = the game carried on, by digest) / the shift, the chair in one place at every sleep / the
  half-switch; (b2) holds the sneak seam (`sneak.ts sneakWalk`: dark floor at a sleeper's elbow is not watched, at the same man's elbow awake it is). 22
  lines in all. ONE MORE DRAW AT STAND-UP on the police post, switch on or off: `game.ts` draws one number per light GROUP for the restrike stagger and the
  terminal is the level's first `monitors` switchable, so a seeded run of that level is not the run it was before the terminal (the level change, not the rule). THE SEAM with the attention rule (`attention.ts`, `ATTENTION.on`, another goal's; wired 10-13
  on the build head that first carried it): how held attention narrows his EYES is that rule's. `doze.ts` lends it the screen each frame he is at work
  (`attentionLend(g, gd, D.mon.pos, { ears: 1, noises: 1 })`): with that rule on he holds a `lent` attention at the screen, a man more than its `focusDeg`
  off the screen is taken in at its `sideK` (0.3), the floor shows its thread and ring (beside the '♪'), and a glimpse that adds up or a step that reaches
  him takes him off the screen by that rule (back on it `lentBackSecs` later if he is still sat). His EARS stay this file's (`dozeEar`): the lend passes 1
  and 1 so the headphones count ONCE and work with that rule off (left out, `ears` would be that rule's own half on top of ours). With that rule off his
  eyes are whole, as before the wiring. The lend has its own key, `DOZE.lend` (true; a recording from before the key replays with it off: `journal.ts`).
  Check line (n2) holds it with that rule raised on either stand: the hold, its floor mark, `guards.ts sightGain` for a man 39° off the screen at 2.2 m
  (0.136 a second against 0.453 with that rule or `lend` off), and the same walking step adding the same with the rule on as off. ON THE POLICE POST the
  edge of his view is over the cots and the wall: no floor a man can stand on is inside his cone and outside the focus, so the narrowed eye changes
  nothing a player can do there (the check writes the place, it does not walk to it). That rule holds nobody on a loud squad floor (its own `able`), and
  keeps a lend a quarter second past the last call: a man up at the end of his wait walks his first steps with the thread still on the dark screen.
  That rule's whistle glance swaps the lent hold for a look with its own ear half, so for the glance a footfall is at a quarter at his ear (ours × its):
  a claim for that rule's owner. NOT EXACT ACROSS A LOAD: that rule's checkpoint
  does not carry a lent hold, so for the first two frames after a load a man at his screen has whole eyes (the hold is re-lent and re-made); the
  checkpoint line (p) still matches by digest on both stands (nobody is in his eye there). A claim for that rule's owner, not mended here. NEVER SEEN ON A GPU, never played: the screen's glow on a seated man and in the bunk room,
  the terminal on the trunk, the pulled chair, the '♪', whether the lines land, whether a lit bunk room for 20–30 s at a time spoils the dark way in.
- **The calm torch check asks about the OCP** (`tools/qa/calmtorch-check.ts` line (h), 10-16; tests only, no game code moved). Asked by the kit animations
  thread, whose kit-slots probe went red on the shipped stand because its lit-torch line stood a calm man in a lit corridor: no check said what the OCP does
  to a torch the calm rule has put out. The rule was already written (lighting.ts `ocpable`: a man with no light on is nothing to the OCP) and the line now
  holds it for this case: not offered, no charge, no line, the man untouched; the frame after something has his attention the torch burns and is the OCP's
  like any light (fried, a charge spent, dark). PLAY, AS IT IS: on the page most patrol torches in lit corridors are out, so a torch to knock out with the
  OCP is found in the dark rooms or on a man already looking. Proved by taking `gd.flashlight.enabled` out of `ocpable` in a side tree: the line goes red.
  Both stands. Never seen on a GPU.
- **A blackout sends enemies to the breaker** (`src/game/powerout.ts`, `POWEROUT.on`, 10-17; the first slice of "defenders answer the plan the team
  chose": the answer to the mains being cut). BEFORE: a mission's defenders are every one of them held on a mark by the room fight, so with the `posted`
  rule nobody was handed the walk to the breaker and nobody said anything: the team cut the mains and the garrison stood in the dark for as long as the
  team cared to take. THE RULE, once per blackout, for the room fight's hostile defenders: a man NOTICES (a mains fixture burning in his plain view inside
  `seeM` 14 m, or the floor he stands on / watches / has about him going from lit to dark by the place's own light: `lightEstimateAt`, the CPU floor
  meter, read again `darkAfter` 0.3 s after the trip); `think` 3–6 s later (by the man's id, no dice) one of them says on their net what they do, nobody
  steps for `beat` 2 s after it, then up to `men` 2 of the FREE men nearest the breaker by the way they would walk (no further than `maxM` 60 m, a man
  left in every room that had one while that can be done, the nearest alone when nobody can be spared, a `mayLeave: false` squad too) walk there at the
  pace of a man going to look, weapon lights on, boots filed for the team's ears; the first puts his hand to the lever (lighting.ts's own re-arm, fumble
  and "breaker's back in"), the second stops short and watches the way they came; mains back, by anybody: they walk home and hold as they held. LINES (on
  the net, so on the team's strip; `cues.ts` reads the going lines as class 1 and the staying lines as class 3 already): "power's out — two moving to
  the breaker!" / "… on my way to the breaker!"; "power's out — that's them! Stay on your doors!" when the garrison already knows (a man alert or
  searching, gunfire / a boot / a charge in his ears, or hostages held: rescue.ts has every defender learn of the team by the dark itself);
  "power's out again — that's no fault. Stay on your doors!" the second time in one fight (`parties` 1); "… again — nobody goes." after a party that
  lost a man; "breaker's wrecked — that's them!" at a breaker shot to scrap; "he's down at the breaker — that's them!" from a mate who SEES the place his
  mate fell (or reaches his own place and finds nobody at the lever); "nothing from the breaker — that's them!" `overdue` 15 s past the walk's own
  length when a party that fell unseen has not been heard from. Every "that's them" line puts THE WORD out (`powerOutWord`): darkfoe.ts takes it as it
  takes a mate's lamp, a man of theirs whose view is dark lights his own while the mains are down. A fight starting while they are out: a hand already on
  the lever finishes, anybody else runs back to his post. The first man dazzled or taken at the beat: the second takes the lever; neither: nobody goes
  and the walk is not counted. The way is asked of the walk grid as it stands at the word and on every leg, so a blown wall or a wedged door changes the
  way they come. NOTHING here gives anybody better eyes, aim or health and no man is added; a defender acts on a light he lost, his net and his own
  senses on the walk, never on where the team is. SWITCH: ON in the page (`?nopowerout` off; the debugger row 'a blackout sends enemies to the
  breaker'), OFF in the module and on the frozen stand (`FROZEN_HOLDS` `'POWEROUT.on': 'TPS_POWEROUT=1'`), in the knob registry and the journal (a
  recording from before the key replays with it off), state in the checkpoint (`powerOutSnapshot` / `powerOutRestore` through savestate.ts; the
  debugger's timeline is not kept). SEAMS in others' files, one clause each: lighting.ts (`setBlackout` tells it; the re-arm reads `powerOutMan`),
  game.ts (the tick, the reset), guards.ts (`powerOutLit` in the torch pose), darkfoe.ts (the word). CHECK: `tools/qa/powerout-check.ts` (probe
  `powerout`, 18 lines (a)–(n): word before step, who goes and who does not, boots and lamps, mains back at the lever, home again, the second cut, a
  garrison that knows, a shot breaker, a fight while out, the snapshot round trip, a breaker in a man's own room, the glasshouse's floor-dark notice with
  the store bulb off, no mains light = nobody, the dazzled lead, the seen fall, the unseen fall, the switch thrown off under a walk, and off = base by 30
  run digests) ALL PASS on both stands; `POWEROUT_BREAK=1` red on (a) and (h). `workthings-probes.ts work-posted` holds the rule off inside its two
  room-clear rigs (it measures the stock errand with nobody free; a later rule held off as other checks hold the quiet net). GATES after it: frozen
  powerout, workthings, darkfoe, checkpoints, journal, shipped all pass; shipped powerout, darkfoe, darkdoor, depot, floodlit, calmtorch, farcalm,
  handwork, cues, glasshouse, shipped, journal pass. RED ON THE SHIPPED STAND AT THE BUILD HEAD WITHOUT THIS CHANGE (run on a clean copy, not this
  rule's): `work-breaker`, `night-restore`, `checkpoint-identity`, `checkpoint-autosave`, `checkpoint-death`. MEASURED (the scripted commander, shipped
  stand, breaker on order, night vision, rule on against off; small samples): glasshouse four 12 seeds, 10 of 12 taken and 31 of 48 up both ways (the
  team had been heard before the cut in all 12: "that's them", nobody walks); pass four 8 seeds, 7 taken both ways, 22 up against 19; warehouse four 8
  seeds, 6 taken against 5, 15 of 32 up against 12, mean 210 s against 166 (a party sent in 8 of 8); depot four 8 seeds, 8 taken and 20 of 32 up both
  ways ("that's them" in all 8). So in scripted play the walk is mostly seen when the team cuts the lights BEFORE it is heard. UNTUNED by play. KNOWN
  SHAPE: the free-man test repeats what enemysquads / darkfoe / lighting each ask in their own words (a shared "is this man the room fight's to send"
  would be roomfight's to own). NOBODY HAS PLAYED IT; NEVER SEEN ON A GPU: the two lamps crossing a dark hall, whether the line reads on the strip in
  time, whether a lone man leaving his room reads as an opening or as a blunder, the lights coming back under the team.
- **Squads from the rooms** (`src/game/squaddeal.ts`, `SQUADDEAL`; part of "defenders answer the plan the team chose"). WHAT WAS THERE: the contact
  call, the men who come to a hit room, the pair that goes round, the radio check and the men who walk to a silent post are all enemysquads.ts's, and
  none of it runs on a level whose file has no `scenarios.roomClear.squads` block (the depot, records, the kill house, the long hall, the floodlit yard,
  defuse, the snatch, the office room clear): there a loud way in drew nobody at standard and a man taken quietly at the back was missed by nobody. THE
  RULE: when a room clear's men are dealt, a structure with no squads block is handed one cut from ITS OWN ROOMS (`squadDeal`, called once in
  roomclear.ts `onStaged`), and from there it is enemysquads.ts's floor like any squads level — nothing in the new file moves a man or says a line.
  The file wins (a level that names squads keeps them word for word; `squads: []` = a level saying it is one pool; a Training lesson is left alone).
  How many: the men as dealt, `one` (5) or fewer one squad, `two` (8) or fewer two, more three, never more squads than rooms with a man. Which rooms:
  the rooms in a line along the house's longer side, cut where the men come nearest even shares, so a squad's rooms are neighbours and every squad has
  a man. Names: `names` (Alpha, Bravo, Charlie) along that line. Everything else is the squads' default (may leave, wedge the doors their rooms do not
  share). DYNAMIC: the block is made from THIS staging's placement, and every way a man then takes is asked of the walk grid as it stands, so a blown
  wall changes the way they come. No man is added and nobody's eyes, aim or health change. A pure function: no dice, no clock, no state (nothing for a
  checkpoint). WHAT IT COSTS, known: with squads staged the floor is a squads level to every rule that asks (`squadsLive`): the press stands down, men
  dig in on their squad's word, and HARD on these eight levels is the drilled garrison and no longer "the defenders come at you together" — the mission
  sheet says so (`difficulty.ts squadsHeld`, read by ui/picks.ts and ui/missions.ts; `squadsOf` stays the row's fact about its level FILE). The
  maintainer's call is asked on that. With the enemy kit on stun charges at standard, the office room clear's defenders put 1 charge through a door in 8 scripted runs
  where one pool puts three or more (it is the press that carries them, and the press stands down): the kit lever does little on these levels while
  the rule is on (`levers-run` holds the rule off for its two tallies: it measures the kit lever on one pool). SWITCH: ON in the page (`?nosquaddeal`; the debugger
  row 'enemies are in squads on every level'), OFF in the module and on the frozen stand (`FROZEN_HOLDS` `'SQUADDEAL.on': 'TPS_SQUADDEAL=1'`), in the
  knob registry and `JOURNAL_KNOBS` (a recording from before the key replays with it off). SEAMS in others' files, one clause each: roomclear.ts
  (`onStaged`), difficulty.ts (`squadsHeld`), ui/picks.ts and ui/missions.ts (the Hard sentence asks `squadsHeld`), enemysquads-probes.ts (its "no
  squads block = none staged" line holds the rule off), levers-probes.ts (as above). CHECK: `tools/qa/squaddeal-check.ts` (probe `squaddeal`), 7 lines:
  (a) the cut on the eight rows (every room in one squad, a man in each, the count the men call for, roomclear.ts `checkSquads` silent), (b) the file
  wins (the warehouse: the same object), (c) a loud way in draws men to the noise with their word 1.5 s or more before the first is there (the kill
  house: "Alpha: coming to you from the store — hold on!" at 2.4 s, there at 5.5), (d) a quiet one draws a man to the silent post (word 40.0 s, there
  44.1), (e) a blown wall changes the way (records: the first man's way 25.9 m, 21.7 m with the hole, and he passes 0.8 m from it), (f) off = the base
  by the digest of (c)'s run (a run the rule changes: the break path's digest differs), (g) the mission sheet's Hard sentence. ALL PASS on both stands;
  `SQUADDEAL_BREAK=1` red on (a) (c) (d) (f) (g) on both. MEASURED (`tools/qa/answers.ts`, below; shipped stand, seed 7, one seed): rows that answer
  the three plans with three different telegraphed moves, 4 of 19 without the rule, 13 of 19 with it, on standard and on hard. MEASURED (the scripted
  commander, `command-tally.ts --hands plan`, shipped stand, 8 seeds on each of depot, kill house, hall, floodlit, defuse, snatch, office room clear,
  four men; rule on against off; small samples): STANDARD taken 56 of 56 against 51 (5 ran out the cap), clean 29 against 30, wiped 10 against 9, men
  lost 1.54 against 1.38, Sam down 0.95 against 2.09 a run, 77.0 s against 85.5. HARD taken 55 of 56 both ways, clean 23 against 19, wiped 10 against
  13, men lost 1.70 against 1.91, Sam down 2.48 against 1.80, 76.3 s against 74.4 — but level by level it moves: the depot is harder with squads
  (wiped 5 of 8 against 2, Sam down 9.88 against 2.38), the long hall easier (wiped 2 against 7, clean 5 against 0). The standard tallies ran while
  tool files were being copied into the measuring tree (the rule's own file unchanged). UNTUNED by play: `one` / `two`, the cut, the names. NOBODY HAS
  PLAYED IT; NEVER SEEN ON A GPU: whether "coming to you" reads in time on the strip, whether two squads on a seven-man floor feel organised or thin,
  the depot on hard.
  A COST FOUND AFTER (10-17): the lone dark walk (darkfoe.ts: a blind man in a dark room walks to floor he can see) is for a man nobody else has,
  and on a floor dealt into squads the garrison digs in on its squad's word — a dug-in man is dig-in's (`darkFoeKept` reads 'dug in'), so on the
  levels that get squads here nobody takes that walk: on a blackout they send two to the breaker and the rest keep their rooms (a dug-in blind man
  who knows still lights his lamp). `darkfoe-check.ts`'s walker runs hold `TPS_SQUADDEAL=0` themselves (the floors they were written for; 4 of its
  16 lines were red on the shipped stand without that) and a new line asks that on the kill house as dealt nobody is sent and every man standing
  is somebody else's. Whether a dug-in blind man should still take the walk is an open call for the maintainer.
- **Squads that stay in their rooms still miss a room that goes silent** (`src/game/stayask.ts`, `STAYASK`; the quiet answer on the block and
  Mousehole). WHAT WAS THERE: a squad counts only its own men, and the net's roll call of whole squads (`SQUADS.netAsk`, another goal's, off in the
  page: `?radiocheck=net`) never sends a man of a `mayLeave: false` squad. On a floor where every squad stays — a room each, two or three men a room —
  the team takes a whole room without a sound and the garrison stands as it stood. THE RULE, on a floor where it holds (`stayAskHere`, read once at
  `squadsStage` and kept as `State.stayAsk`: two squads or more, EVERY one told to stay, no lesson on the level): the net's ask runs there whatever
  its own switch says (their words, beats and dice: "Alpha: all squads — radio check", "Charlie? … Charlie, sound off"), and the nearest squad with a
  man to leave at home sends `men` (one) to the silent squad's posts — "Alpha: nothing from Charlie — one moving to their rooms!", his boots filed for
  the team's ears — where a squad free to leave sends two. A squad's count of its OWN men is as it was: the net ask's last-man rule ("I'm alone here,
  somebody look!") stays its own switch's, so a man who misses his mate still walks to the post himself. Elsewhere nothing changes. NEEDS the radio
  check (`SQUADS.radioCheck`, on in the page; `TPS_STAYASK=1` alone on a frozen run changes nothing). No man is added, nobody is told where the team
  is (the places are their own posts); no dice or state of its own. SWITCH: ON in the page (`?nostayask`; the debugger row 'squads staying put
  miss a silent room'), OFF in the module and on the frozen stand (`'STAYASK.on': 'TPS_STAYASK=1'`), in the registry and `JOURNAL_KNOBS`.
  SEAMS in enemysquads.ts (another goal's file): `State.stayAsk`, `netAsks(g)` in place of seven reads of `SQUADS.netAsk`, and `netSend` (a squad
  that stays may send `STAYASK.men` on such a floor). KNOWN SHAPE: the man sent ends in another squad's room while `squadStaysIn` still answers yes
  for him (wallreact.ts, darkfoe.ts, laststand.ts judge him by his home room); nothing was seen to go wrong, nothing was run to find out. CHECK:
  `tools/qa/stayask-check.ts` (probe `stayask`), 6 lines: (a) (b) the block and Mousehole — roll call, the silent squad asked for by name, "one
  moving" in that order, ONE man off his post before any contact, his word 1.5 s or more before he is there (the block: 33.9 / 37.9 / 41.9 s, there
  55.4; Mousehole 32.7 / 36.7 / 40.7, there 46.9); (c) the warehouse (a squad may leave): no roll call; (d) the orders lesson: no roll call; (e) off
  = the base by the digest of (a)'s run; (f) ONE man of a room put down: his mate and the net do the same with the rule on and off. ALL PASS on both
  stands; `STAYASK_BREAK=1` red on (a) (b) (e) on both. MEASURED (`answers.ts`, shipped, seed 7): with both rules 15 of 19 rows answer the three
  plans, on standard and on hard (13 without this one: the block and Mousehole had words only on the quiet plan). NOT MEASURED: what it costs a team (the scripted
  commander goes in loud). NOBODY HAS PLAYED IT; NEVER SEEN ON A GPU: whether a lone man crossing the block reads as the garrison waking or as a gift.
- **A rescue's men check in by radio** (`src/game/rescuecheck.ts`, `RESCUECHECK`; the quiet answer on the three rescues, and the roamer's word on
  the other two plans). WHAT WAS THERE: a rescue's cast (captor, door man, guards, roamers: rescue.ts) are not squads, so none of the squads' senses
  ran there — a man put down quietly at the back was missed by nobody, and a roamer let off his post went without a word. THE RULE, while a rescue
  is staged and nobody of its cast is roused: every `every` s (first after `first`; beats from ids, no dice) the captor says "radio check — sound
  off"; `askSecs` later a man who is down and not known to be is asked for BY HIS POST, never by the team's label for him (dialogue.ts `placeName`:
  "the break room, sound off … the break room?"); `goSecs` later ONE man — a roamer on his post first, else the door man or a guard outside; never
  the captor, never a man in the hostage room, never one who has learned or whom Hard's crew has dealt with, never a man another rule has
  (`powerOutKept`) — says "nothing from the break room — one moving there!" and walks there at the investigate pace (powerout.ts's errand: `calmOf`
  / `run` / `calmBack`, now exported from it). On the way and at the post he looks for ANY man of theirs down and not yet found, by the game's own
  body test (`bodySeen`, the light on it; `feetM` at the post): "man down, the break room — they're inside!", the body is tallied and written to
  the chronicle as any found body, he is roused and the room fight's from there. Nothing at the post after `waitSecs`: "nothing at the break room —
  he's gone!" and he walks back. Nobody free: "nothing from the break room — nobody to spare. Stay on your doors!". A fight, a loud thing, or
  anything of the team in his ears on the way sends him home at a run. A man down in the hostage room is never asked for and nobody is walked into it: that room is the
  rescue's own (its clock, its hand-over). THE MAN WHO WENT AND DID NOT COME BACK is asked for at the next check where he was going, and the post he never reached is a
  question again. THE CLOCKS ARE THE RESCUE'S: a man walking to look who has noticed nothing has not learned of the team (`rescueCheckOwns`, one
  clause in rescue.ts's learned test; what he hears on the way he learns like any man) and the captor's clock is not touched. THE ROAMER'S WORD:
  `wordSecs` before the rescue lets a roamer off his post he says where he is going — "heard that — moving to cover it!" with a loud thing of the
  team's known, else "on my way — moving to the hostage door!" (not a man with the team in his eye; a noise that comes after his word is said as he
  goes) — and HIS WORD IS KEPT: let go with a noise known and nothing of the team seen since he learned, his fix is that noise, as the rescue gives
  it to a man who was calm (it leaves a man already alert with the fix his ears gave him, the doorway the echo came in through: he walked two
  metres and searched there). From Hard's alarm on its roamers are the crew's (`cast().crewed`): none of this speaks for them. No man added; nobody
  is told where the team is (a post is their own, the noise is what they heard). State per game with a snapshot / restore pair (savestate.ts
  `rescueCheck`; the page refuses a checkpoint while a rescue runs, so the pair is run by the check only). SWITCH: ON in the page
  (`?norescuecheck`; the debugger row "a rescue's men check in by radio"), OFF in the module and on the frozen stand (`'RESCUECHECK.on':
  'TPS_RESCUECHECK=1'`), in the registry and `JOURNAL_KNOBS`. SEAMS in rescue.ts (another goal's file): the clause above, `cast()` and `noiseAt`;
  game.ts ticks it after powerout. CHECK: `tools/qa/rescuecheck-check.ts` (probe `rescuecheck`), 7 lines: (a) (b) (c) the quiet way in on each
  rescue — check, ask, "one moving", found, in that order (15.4 / 19.4 / 23.4 s on all three; there 25.8, 27.8, 29.5 s), one man off his post,
  never the captor or a man of the hostage room, nobody learned before the body is found; (d) the loud way in: no radio check, the roamer's word
  6.5 s, at the noise 12.5 s; (e) the lights cut: his word 6.5 s, at the hostage door 14.2 s; (f) the rule's state saved, dropped and loaded while
  the man is on his way: the run ends as the unbroken one, line for line and by digest; (g) off twice = the same digests, quiet and loud. ALL PASS
  on both stands; `RESCUECHECK_BREAK=1` red on all seven on both. OFF = THE BUILD AS IT WAS, by hand: the three plans on hostage-rescue and the
  consulate digest the same on the commit before and on this one with the rule off, on both stands (12 runs). MEASURED: `answers.ts` below (the
  three rescues hold on standard); `rescue-tally.ts`, shipped, 16 seeds × crawl / rush / flow, rule on against off (run before the names and the
  lost-man rule were mended): flow 16 of 16 clean both ways, rush 2 clean and 14 Sam down both ways, crawl 1 clean both ways (1 costly run fewer
  with it on, 2 of 32 hostages saved against 3; that tally's own crawl target is red on this stand with the rule off too). ONE BOOT OF THE REAL PAGE (headless Chromium on a software adapter, no GPU; the first rescue, the beats shortened by hand, the roamer put down by
  the page's own hook): 118 pipelines, no page error, the radio check at 0.5 s, "the break room, sound off … the break room?" at 1.5 s, the door
  man's "nothing from the break room — one moving there!" at 2.5 s; not run on to the body. NOT RUN BY ANY CHECK:
  the empty-post line, the nobody-to-spare line, a man lost on his way, a word said late. NOBODY HAS PLAYED IT; NEVER SEEN ON A GPU: whether a
  body in a dark back room is found as a player would expect, how the radio check reads on the strip, whether a post's name tells a player which
  man they mean.
- **The table of answers** (`tools/qa/answers.ts`; `bun run tools/qa/answers.ts [--scn id,id] [--plan loud,quiet,lights] [--seed n] [--hard]
  [--json file]`, `TPS_PROFILE=shipped` in front for the page's rules; exit 1 while a row does not hold — it is a table, not a registered probe).
  Every listed room clear, rescue and night breach × three plans, staged as the mission's own row with no teammates and Sam out of everybody's sight:
  LOUD (a charge's report at the front room's door, a stun and three seconds of fire inside, the room's men shot), QUIET (the back room's men put
  down one a second without a sound), LIGHTS (the mains thrown by hand). Front and back are read off the floor (the defended room whose door is the
  shortest walk from Sam's start, and the longest, among rooms with a man the plan can take: never the one who holds the hostages). It names the
  move by where the movers got to — counter (a man at the noise), look (a man at a silent post), lights
  (a man at the breaker), pull (a rescue: a man at the hostage room's door, or stopped nearer it than his post with a clear line on it), brace (the squads' own word was to lock
  their doors, landed when the last man is set), away, words, none — and the telegraph as the earliest of a line on their net, a mover's boot and a
  mover's lamp. A row HOLDS when its three plans draw three different moves out of counter / look / lights / pull / brace, each with 1.5 s or more
  of lead. A level with ONE defended room (the night breach) has no front and back: it is printed ONE ROOM, held to the lights plan alone, and
  counted apart. SHIPPED, seed 7, with the three rules on (squaddeal, stayask, rescuecheck): on STANDARD 18 of 19 hold and the night breach is ONE ROOM;
  on HARD 15 hold, the night breach is ONE ROOM, and the three rescues fail on the loud plan ("words only" on two, "men moved, to nothing of the plan's" on the consulate) — Hard's rescue has a crew of its own
  (rescue.ts: the captor's "they're here! … guns on my door!", a roamer's "staying dark — I'll come up behind them."), whose move lands on a team
  stacked at the hostage door, and the table has no team: said, not seen to land. One seed; no GPU: a lamp is a flag, a line is a string.
- **A defender throws with his free hand** (`src/game/gunhand.ts`, `GUNHAND.on` + the key `throwFree`, 10-18; the maintainer on the in-hand pass's
  list, of "a defender throws overhand with the carbine in the throwing fist": "yep fix it"). THE FAULT: the throw (`character.ts throwItem` /
  `throwLayer`) is one move for everybody and its throwing arm is the right one; a man with a long gun is drawn with that gun off his right wrist, so
  the carbine went up behind his head and over the top with the grenade (bench: its grip 33 cm over the shoulder joint, 9.5 cm off the palm).
  THE RULE: a throw begun with a long gun in the hands (`anim.longGun`) is the FREE hand's — the authored swing MIRRORED: the trunk winds the other
  way, the left arm takes the right arm's path (the overhand, the short one and THROW_BY's underhand toss alike), and the right arm is left to the
  long hold: its carriage goes to the low ready for the swing and comes back up over the recovery, the trigger hand held where that hold has it (not
  swung round with the shoulders, and let down to 12 cm under the shoulder where a crouched low ready has it level with it). IN HAND's long hold
  stays on the grip through it (`anim.throwOff`). The grenade is drawn in the LEFT fist from the swing's first frame until it leaves
  (`rigProps.freeCanBoxes`, by `frag.ts fragInFist`: guards drew no grenade in the hand before), and the plain throw's grenade starts AT that hand
  where the hand has an arc to the same landing spot (`fragThrowTick`; otherwise, and with the rule off, from the point 35 cm ahead of his chest it
  always did). NOT CHANGED: who throws, the wind-up and release times, the scatter and the spot aimed at, the fuse. WHO IT REACHES: every caller of
  `throwItem` with a long gun up — defenders and responders with the carbine (frag.ts), a TEAMMATE at a lane's mouth putting a stun charge down it
  (lanes.ts `stun`: the swing only — that charge is in the air on the frame he starts, from his arm round the corner, as before), a defender's
  grenade round a corner (`fragThrowAt`: the swing and the fist's grenade; it still leaves from the arm-round-the-corner point). Teammates' ordered
  throws were already the support hand's (`tossItem`), and Sam throws with the rifle on his back — the slots' throws, and the G quick throw, which
  slings it first (player.ts): none is touched. A round that leaves inside the swing has the gun in the shoulder for it (`shootT` is asked before the
  throw's low ready), as every shot does. Pistol men throw as they did. STANDS: off on the frozen stand
  (`TPS_GUNHAND=1` raises it; `FROZEN_HOLDS['GUNHAND.on']`), on in the page (`?gunhand=0`), journalled (a recording from before the table replays
  with it off). OFF = the build as it was: 1,920 frames of throws by a carbine man and a pistol man (standing, low ready, crouched, walking, the
  short one, the toss, re-triggered mid-swing) hash the same pose and bones as the commit before. CHECK: `bun run tools/qa/probes.ts gunhand-throw`
  (family `gunhand`; `tools/qa/gunhand-throw-check.ts`, both stands; `GUNHAND_BREAK=1` leaves the key off and lines 3, 4, 5 and 9 fail). MEASURED,
  both stands, 7 bench throws of 44 frames each: grip to the palm's hollow 1.0 cm at worst, the trigger wrist 7.7 cm or more below its shoulder, the
  left wrist 28 cm over its own in the overhand and 32 to 48 cm ahead of it at the release, the can 2.3 cm from the left fist's hollow, the same
  swing, release frame and last frame with the rule off and on. One game run (frag-theirs' corridor, seed 3, a defender dealt the carbine): the
  same man throws 1.02 s after his shout either way, the bursts 5 to 10 cm apart, the grenade starts 0 cm from the left hand and is in that fist
  17 frames. NEVER SEEN ON A GPU OR IN PLAY: poses and boxes measured headless; how a left-handed overhand reads from above, and the gun's low
  ready beside it, nobody has looked at. The run with the switch on is not the run with it off (it changes the pose the game reads).
- **Defenders are dealt guns off the squad's table, and a gun is used for what it is for** (`src/game/gunroles.ts`, `GUNROLES.on`; the maintainer,
  10-18: "also should we model more firearms?"). On in the page (`?nogunroles` = the build before), off in the module and on the frozen stand
  (`FROZEN_HOLDS 'GUNROLES.on'`, `TPS_GUNROLES=1`); a recording from before the table replays with it off. No state of its own: a role is read off the gun
  in a man's hands each time it is asked (a sidearm out after a dry primary does not change whose man he is).
  THE DEAL (`gunDeal`, called once by `nightbreach.ts` and `rescue.ts` when the cast stands and the floor's doors are as the mission opens with them — every
  leaf is `place()`d first, or a line is measured through a door the staging has just shut): each man's line is a ray from his mark the way he is posted
  to look, 40 m at most. ONE BELT-FED GUN (`pkm`, a new row: 100 on the belt, strings of 6 to 10, handling 0.45, 6.5 s to feed, 7.5 kg and bulk 4 for the kit's score, which weighs no defender today) to a cast at most, to
  the longest line, and only when that line is a lane (`beltLane` 15 m with `beltMin` 5 men) or the cast is a big one (`beltSquad` 10); A PISTOL
  (`guard9mm`) to at most a quarter of a cast (`pistolMax`) among men whose line is under `pistolNear` 4 m; THE MAN WITH A HOSTAGE IN HIS HAND IS NOT
  DEALT (`captor`, off: he keeps the gun his rescue gave him; see the mend below); the rest half AKMS (`akms`, now enabled: two or three a pull, looser, 7.62) and half the short carbine as before. Every row is `oneShot` and there is
  no health to raise: nobody is harder to put down. THE DRAWS come off each man's own mark (a hash of where he stands and which man he is), so a restart
  deals the same guns (`samestart.ts`); with that switch off one number off the game's die salts them. Today's missions on the page's stand: a belt-fed
  gun in 7 of 21 (depot, floodlit and the long hall by their lane; the block with squads, warehouse, compound and barracks by their size), none in the
  office's room clear, the night breach, the three rescues, records, the four-room block, snatch, defuse, killhouse, mousehole, glasshouse or the pass.
  WHAT A GUN IS FOR (keys `entry` `lanes` `strings` `post`, all under `use`): ranks room (MP7, M1014) before rifle and pistol before reach (Mk 12) and belt
  (Mk 46, PKM). `orders.ts pair()` takes the frame a stack stands on and prices a long gun nearer it than a room gun (`fileCost`, under the pairs-together
  cost); `doortools.ts firstIn` and the threshold's first man pick among the room guns' men (`gunFirst`; the log beat `first:<callsign> · his gun is the
  room's` when the gun, not the room seen, decided); `enter()` and `wallcharge.ts enter()` send the Mk 12 and Mk 46 men last (`gunTurn`, `gunLast`);
  `cover.ts`'s deal adds `gunLane` (± `laneK` 0.6 by distance: the far opening to the long gun, away from a man with a pistol alone, half that for an
  MP7); `roomfight.ts tickOp` and `coverfire.ts`'s trigger fire the Mk 46 in strings of its row's own length at its own rate and the Mk 12 one aimed round
  a beat (`gunString`; the pair for every other gun); the belt-fed DEFENDER is not taken from his line (`gunKeepsPost`: `lanes.ts laneHolds` answers true
  for him, so no rally, press, errand or dark hunt, and `digin.ts` lets a noise next door lie); a blinded defender fires blind at his own gun's rate
  (`gunBlindGap`: a pistol a round a pull, not twelve in 1.2 s). A squad of issue carbines stacks, enters and fires exactly as with the switch off.
  NOT BUILT, on purpose: no gun holds its fire for range (a man who will not shoot reads as dumb; range is the rows' own spread and the cover's deal);
  the belt-fed man still falls back or takes cover when the squad is in his room (the room fight's own moves are not gated).
  Check: `bun run tools/qa/gunroles-check.ts` (families `gunroles-deal -entry -fight -lanes -off`, in `all-quick`), 23 lines on each stand (it raises the
  switch by the stand's own word before a floor is stood up); `GUNROLES_BREAK=1` fails every family. `gunroles-off`: ten seconds of the staged room clear
  digest the same off and on with nobody dealt and the cards as issued.
  MEASURED (headless, before = the commit this was built on, after = this one). The mission tally (`command-tally.ts --hands b`, the page's stand,
  room-clear-four, depot-four, warehouse-four and killhouse-four over seeds 1 to 4, sixteen floors): taken 15 → 16, clean 6 → 8, wiped 3 → 3, men lost a
  floor 1.88 → 2.06, seconds 97.0 → 96.1 — too few floors to call a move either way. Where the belt-fed gun shows is the depot's lane: rounds that hit Sam
  on its four seeds 13, 2, 1, 0 before and 14, 24, 30, 0 after (god mode counts them; men lost 2.50 → 2.75). The solo night's soak (page's stand, seeds
  1, 2, 3, twelve minutes): all pass, and its report is the same file as before but for the wall clock (no cast is dealt there). The tour on the frozen
  stand: 3 of 3 before and after (it is red 0 of 3 on the page's stand before this change and after: old reds, not this rule's).
  THE MEND OF 10-19 (`captor`). For a day the man holding the hostage was dealt a pistol with the rest, and `rescue-set` on the page's stand went red on
  it: over its six seeds a set hostage room cost the entering pair 7 of 12 men (5 of 12 alive) where it had cost none, and the room was lost on one seed.
  One gun did it: with only the captor back on his carbine the line passes with the old numbers (secured 6/6, pair 12/12, blind rounds 0 / 0 / 60, first
  man in 0.6 / 0.6 / 1.5 s); no AKMS, no near-post pistols or `use` off each left it red. Traced on seed 13: with the pistol up he has a man of the
  stack in his eye 4.7 s before the boot and fires a round every 0.9 s at the men outside his door; with the carbine he does not see them until they are
  in. (The line holds `DOORMANNERS`, `MOVES.gait` and the glass rule off; the same six runs with those on, as the page opens, ended 2 of 2 up either
  way — but nobody ships on that.) So he is not dealt: what that man carries and does is the rescue's. `captor` on is the pistol again; a recording of
  that one day (the table without the key) replays with it on (`journal.ts`). The check's deal family asks both (23 lines a stand now).
  The same gun was behind the doorway's `threshold-last` losing a man on registry seed 32 with guns dealt: it passes on the page's stand with the deal on
  again, and the hold that probe carried for it is gone. Run after the mend, both stands: `gunroles-check` 23 lines, `GUNROLES_BREAK=1` red in all
  five families, the `rescue` gate 132 lines; `rescue-set` and `threshold-last` on the page's stand. No tour, soak or tally was run on the mend.
  NEVER SEEN ON A GPU, NEVER PLAYED: who stands where in a stack and the strings are measured in the harness; how a seven-round string or a PKM's string
  looks and sounds, and whether a lane with the gun on it reads as a problem to solve or as a wall, nobody has seen. The PKM and the AKMS are STAND-INS:
  drawn as the short carbine, speaking with its report, no model, voice, reload or hand pose of their own.
- **The men left alive on a rescue come for the hostages** (2026-10-18; `src/game/rescueflush.ts`, `RESCUEFLUSH.on` — ON in the page, `?norescueflush`; OFF in
  the module and on the frozen stand, `TPS_RESCUEFLUSH=1`; a debugger toggle). The maintainer: "remaining enemies should try to flush you out and/or kill the
  hostage when loud". WHAT WAS THERE: the captor's clock passed to a man of theirs only if he happened to stand in the hostage room; with the room the team's,
  the men alive elsewhere stayed where the fight had left them. THE RULE, once the team has been LOUD (`rescue.noiseAt`) and THE ROOM HAS FALLEN (every man
  posted in it down or held): `afterSecs` later the nearest man of theirs outside says so on their net and goes for the hostages, and every `gapSecs` the
  next one follows — the first by the room's main door, the second by its side door where the level has one (two ways at once: he is sent to the floor OUTSIDE that door, `rescue.sideOutside`, and on in from
  there), in turn; each is let go as
  a roamer is let go to the noise (the room fight's 'free': his own eyes, grenades and pursuit drills; he fights whoever he meets). THE COVERED LANES ONLY
  CHOOSE HIS DOOR (`RESCUEFLUSH.lanesChoose`, 10-19, the mend below): the floor outside his turn's door in the line of guns his side knows of and the other
  door's not (`laneCovers`), he takes the other ('flush:lane:<name>', once a man); nobody is kept back for being warned off; his walk is priced and gated by
  the lanes as any walk is, and a man they already hold at a corridor's mouth is not taken off it for what lies at that corridor's guns (`laneHolds(g, gd,
  to)`, as the press and the rally ask it) — he stays the lanes' own man (their look, their grenade, their way round). A man come to rest with nobody
  in his sights is sent again `againSecs` after his last word. THEY'RE GONE: the first to stand in the room and find no hostage says so, and from then on they
  go to the team's last loud thing and to the way out, in turn. THE GUN ON HER: a man of theirs inside `reachM` of a living hostage with a line a ROUND can fly (`shotBlocked`: a
  pane that stops a round is a wall to this) and no smoke hiding her (`Game.sensors.segment`, under `smokeK`; headless the air is clear) HAS
  her, as the man standing in the room always did (rescue.ts `captor()` → `flush.holder`); one who came for her is `killSecs` from turning his gun on her,
  then `RESCUE.aimSecs` from the round — the same act, broken the same ways, and broken too if she leaves his line before the round (`act:broken`). Lines
  (their net, said once per errand): "it's gone quiet in there — I'm going in for them!" · "going round — I'll take the other door!" · "the hostages are
  gone — they're moving them! cut them off!" · "on the way out — they don't leave with the hostages!" · "moving on that noise — keep them boxed in!" (two of
  them reworded by the dialogue pass, 10-18: its bullet in dialogue.md). Never: a man added,
  more health, a response from outside, a place he has not heard or guarded (the room, a noise his side heard, the door the team came in by). SEAMS:
  rescue.ts `tick()` (`flush.tick()`), `captor()`, `clock()`, `letGo()`, `outsidePoint`. OFF = THE BUILD AS IT WAS (the check's (f)). CHECK: `bun run
  tools/qa/probes.ts rescueflush` (`RESCUEFLUSH_SEEDS=1,2,3`), per mission: they come (first word at `afterSecs`, the second by the side door) · the gun on
  her · not when quiet · they're gone (hostages stood at the way out: the room found empty, men sent on, one shot out there by a man outside the room) ·
  the state's pair · off · a lane known at both doors keeps nobody back · a lane on the main door's floor alone sends the first man by the side door (both
  with a lane planted through the lanes' own save, `lanesRestore`); `RESCUEFLUSH_BREAK=1` fails, `RESCUEFLUSH_BREAK=lanes` (`lanesChoose` off) fails those
  last two alone. NOT asked by the check: what a man sent DOES at a corridor the team's guns hold — that is the lanes' own (`probes.ts lanes` / `corridor`),
  and the check's floor has no team on it to hold one.
  THE MEND OF 10-19 (`lanesChoose`: module default true, inert wherever `RESCUEFLUSH.on` is off, so the frozen stand needs no word; a recording whose
  RESCUEFLUSH row has no such key replays with it off — `journal.ts applyKnobs`; no URL flag and no debugger row: off is the stall below). AS BUILT ON 10-18
  the rule asked `laneHolds` / `laneWarns` about the spot it sent a man TO. For the room that spot is a hostage, which is where the team's guns are, and
  `laneWarns` is true within 16 m of a known lane's guns: once their side knew of ANY lane (the entry fight nearly always opens one) both doors were
  barred and no man was ever sent. With the new ending that was a rescue that never ended by the clear. Found by the held-corridor work with
  `rescue-tally.ts` on the shipped stand. THE TALLIES' PLAYERS LEARNED THE PAGE'S ENDING with it (`rescue-tally.ts` `Run.hold()` / `leadOut()`, used by
  the office tally's `finish()` and the registry tally's; a plain step on the frozen stand): the room held `LEAD_AFTER` 20 s with no man of theirs shown and
  nothing said on their net (a man's first word, 'they're gone'), Sam leads the hostages out with the real keys, asking again every 5 s until the word has
  taken. MEASURED 10-19, shipped stand, `rescue-tally.ts --styles flow --seeds 1-8`: the build before the mend, 3 clean and 5 stalled at the 149 s cap (no
  man sent in those five: 'flush:lane' and nothing after); the mend with the old tally player, 4 clean and 4 stalled (the man is sent, is stopped short by
  the lanes' own gate at a corner by the side door and held there, and nobody leads the hostages out); the mend and the tally player that leads them out,
  no run stalled: 6 clean — 3 cleared at 28 to 64 s (he came and was shot) and 3 out at 64 to 66 s (the team walked them out) — and 2 lost with Sam down
  in the corridor at 68 and 75 s, shot by the last man on the walk out. `crawl` and `rush` on the same seeds are what they are on the build before it
  (crawl 0 of 8 clean with Sam down in 6, before the room has fallen: the same on an untouched copy of that build), and `registry-probes.ts tally --seeds
  1-4` ends every run of its seven styles. Sixteen-seed and thirty-two-seed tallies were NOT run. Whether a man the lanes hold should contest the walk out
  more or less than that is the lanes' rule and a question for play.
  MEASURED: `rescueflush` 30 of 30 lines on both stands, 90 of 90 on seeds 1,2,3 (shipped); `RESCUEFLUSH_BREAK=1` 24 of 27 FAIL on both (its three 'not when quiet'
  lines pass by design); `RESCUEFLUSH_BREAK=lanes` 6 FAIL, the two lane lines on each mission. In the check's scenes the first word comes 4.0 s after the room falls and the second 2.5 s later, round by the side door, on all
  three; a man sent round alone is at the side door and through it in about half a minute. UNTUNED: `afterSecs` 4, `gapSecs` 2.5, `againSecs` 8, `reachM` 10, `killSecs` 3 are first numbers. Headless only: nobody has
  played it; whether two men by two doors READS as a flush, and whether three seconds is fair warning, is a question for play.
- **An alerted man does not wait at a shut door** (`src/game/doorforce.ts`, `DOORFORCE.on`: ON in the page — `?doorforce=0` — OFF in the module and on the
  frozen stand, `TPS_DOORFORCE=1`, a `FROZEN_HOLDS` row, in the knob registry and a journal's tables: a recording from before the key replays with it
  off; off = the build as it was. The maintainer: "and if they're alerted they should behave realistically, like shooting through the door or
  eventually kicking through it".) WHAT WAS THERE: a defender who was up and knew a man stood at the far side of a shut door either rested his gun on it
  and waited (a man holding a post, every room fight's defender) or walked to its handle and opened it by hand into whoever was there (a free man);
  `coverfire.ts` gave one short burst through a wooden leaf to a man who had just SEEN somebody go behind it, and nothing to a man who only heard him.
  THE RULE, for a man of the defending sides in state 'alert' with nobody in his eyes (never a teammate, never a scripted or taken man; 'search' and
  calmer states are untouched): per shut door he keeps how SURE he is that an enemy is at its far face, and where, from his own senses.
  EARS: a footfall or a report made by an enemy within `behindM` 2.5 m of the leaf on its far face, which the hearing model says came to him ACROSS a
  shut leaf (`hearPath`: routed, carrying no more than `shutCarry` 0.5 — through open air or round an open way it is the fight AI's as before), adds
  `gain` 4 × (level × falloff × carry, `hearingCheck`'s own sum); a shot at the gunshot line adds `shot` 1; a door's own noise (a tried handle, a pick,
  a boot its frame held) is word of that door, at least `handle` 0.6, placed at the leaf's far face and counted only while its maker still stands
  there. Under `hearMin` 0.03 a sound adds nothing: a crouched tread through a shut leaf never counts. EYES: the man he was fighting, in his sight
  within `seenSecs` 3, with the shut leaf now the first thing in his eyes' line to where he last saw him: `seen` 1.5. Sureness fades to a third in
  `fadeSecs` 5; he takes a door on at `sure` 1 and stays on it down to `keep` 0.3 while his newest word is under `staleSecs` 6 old.
  THE NUMBERS THAT ANSWER "how sure, how long": three metres off a shut door with a man walking close behind it he is sure after 7 footfalls (1.8 s, the
  check's line 1), at once on a shot or a sighting, never on a crouched tread; two footfalls at a run would do it by the same sum (not staged). ROUNDS: through a WOODEN leaf only, and only where this gun's round
  crosses it by `wallpen.ts thinLine` (so nothing with `WALLPEN.on` or its `men` row off, nothing through steel): he stands, lays on the place by the
  aim law, puts `rounds` 4 through it, then listens — the next four want a newer word and `gapSecs` 1.5. Nobody of his side, no hostage and no civilian
  in the lane or past it (`coverfire.ts coverLane`, exported for this). A burst `coverfire.ts` has just put through the leaf on a sighting counts as
  the first. THE BOOT: a FREE man (no post, no hold) still sure `kickSecs` 4 s after he took the door on (`kickSecsNoShot` 2 with no round for it) walks to
  `doors.ts kickSpot`, squares to the leaf and kicks it in with the door's own `kickIn`; one man a door; then he is the fight AI's again with the
  place he believed in as his fix, and the door is left alone for `restSecs` 8. Where no boot opens it — steel, or the face the leaf opens toward,
  where the frame holds one (`DOORWAY.frameHolds`) — he throws none and goes through by the handle after the same wait, as he always went. A man
  holding a post never leaves it: his answer is the rounds. A door his room wedged and he is set on (`digin.ts`) is his barricade, not a door to force.
  His boot is his side's noise: `hearingCheck` asks `doorForceOwnBoot` and no man of his side (he least of all) takes it for an intruder's, and the torn
  keep is marked seen so a calm colleague does not stop to wonder at it. No dice: the heard place is put off by a hash, the rounds draw as any round of
  his does. State per game in a named side table; a restart or a load forgets it. What a flung leaf does to a man behind it is NOT here (its own rule).
  CALLS TAKEN, for play to judge: 'alert' only; a posted man fires and never boots; the pull face and steel go by the handle; a pistol's four rounds and
  the boot come before a pistol can splinter a leaf (`DOORSHOT` wants a dozen), a rifle's two bursts can take the leaf apart first; no new spoken line;
  his own belief store, not `picture.ts`'s, so the switch stands alone. Tab ▸ Player, doors & props: 'an alerted enemy does not wait at a shut door',
  '… fires through it', '… boots it in', 'seconds before the boot', and a counts row. CLAIMS on other owners' files: `guards.ts` (three hook lines in
  `hearingCheck` and the alert branch), `coverfire.ts` (`lane` exported as `coverLane`), `digin.ts` (`digInSetOn`, the question `digInBraced` asks with
  nothing counted), `game.ts` (tick and reset). KNOWN: the trigger in `doorForce` is `coverBlind`'s, copied — one helper for both is that file's to make.
  A locked door of theirs booted by one of them reads as 'forced' to `doorTamper`.
  CHECK `tools/qa/doorforce-check.ts` (`probes.ts doorforce`, family `doors`; 15 lines green on both stands, `DOORFORCE_BREAK=1` fails 8 on both): on the
  office, a posted man hears walked footfalls behind a shut wooden door, becomes sure at 1.83 s, fires at 2.17 s, 7 rounds in 8 s all across the leaf,
  0.00 m off his post, no boot; the same sounds to a calm man, an alert man with nothing known, and a crouched tread: nothing; a free man stands, puts 4
  through, walks 1.9 m up and boots it 5.95 s after he began (the keep torn, the leaf flung; his fix 0.12 m from the player; the boot heard as an
  intruder's by nobody of his side); the pull face with one-way doors raised: no boot, left to the handle at 5.55 s; steel (the same leaf made steel:
  the office has no steel door with floor both sides): no round, no boot; a sighting, injected and by the tick's own lost-sight hand-off: sure at once,
  rounds through (the hand-off's are `coverfire.ts`'s four, then he is on the door); a place with the wall in his eyes' line: nothing; a colleague past
  the door in the line: no round, 252 frames held; with `DOORSHOT` on and the boot put off the 12th pistol round takes the leaf apart and none follows;
  off: nothing kept; the journal. THE PAGE: `tools/qa/doorforce-page.cjs` (the real bundle in headless Chromium on the software adapter,
  `PORT=… node tools/qa/doorforce-page.cjs` against a dev server): the page opens with the switch on, the staged man puts 4 rounds through the shut leaf and
  tears its keep out at 5.95 s; `?doorforce=0`: off, no round while it is shut, opened by hand at 2.02 s; no page error either way.
  WITH THE THROWN-MAN RULE (`doorthrow.ts`, in the build since): his boot is a boot like any other — on the page's stand the player stood behind the leaf
  is folded for its 4 s by the staged boot (one staged run; `doorthrow` and `doorforce` checks green together on both stands).
  MEASURED 10-22 (on the build one step before the thrown-man rule joined it): switch off = the build as it was, 21 of 21 run digests equal on EACH stand (`PT_DIGEST=1 playthrough.ts --seeds 1`; the page's stand with
  `TPS_DOORFORCE=0`). On against off on the page's stand, all 21 scenarios x seeds 1, 2, 3 (the tool's own player; its JSON carries `doorforce`): 47 of
  the 63 runs are the same run digest for digest (the rule never fired in them); it fired in 16 — 29 doors taken on, 30 rounds through a leaf in 7 runs,
  194 frames a round was held for a friend (one stand on block-squads), 2 boots thrown and both doors gave (the compound), 4 left to the handle. Ends
  38 won of 63 off, 37 on; men up 107 of 222 off, 100 on; teammates killed 113 off, 120 on, of them by a round through an opening 24 off, 30 on. The
  compound moved most on those three seeds (8 of 12 up off, 2 on), so the four maps where it fires — compound, depot, barracks, block-squads — were played
  on seeds 4 to 9 as well: 14 of 24 won off, 13 on; men up 29 of 96 off, 35 on (compound 10 off, 12 on), 12 doors taken on, 15 rounds and 2 boots on
  the compound. Over all nine seeds of those four: won 21 off, 17 on; men up 45 of 144 off, 42 on. No difference is shown at that size; a run that
  parts from its twin parts for good, so single seeds swing. `tour.ts` and `soak.ts` were NOT run (the frozen stand they play on is this build with
  the rule off, digest for digest). UNTUNED: every number above is a first number. Headless only: nobody has played it and nothing of it has been
  seen on a GPU — whether rounds through a door at a stack READ as fair, and whether four seconds to the boot is right, are questions for play.
