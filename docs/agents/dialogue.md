# Spoken and radio lines

One of the area files CLAUDE.md indexes. Everything below was moved here word for word from CLAUDE.md on 2026-10-13, in its old order;
"the bullet above / below" in a bullet means its neighbour there (each block says which lines it was), and a bullet named by its bold
title may now live in another file of this folder: `grep -l '<title>' docs/agents/*.md`. New bullets for this area go at the foot of this file.

<!-- was CLAUDE.md lines 1428–1443 -->
- **The dialogue pass = every line fits who says it and where** (`src/game/words.ts`, ONE switch `WORDS.on`: ON in the page — `?oldwords` = every line as it was — OFF in the module and on the
  frozen harness stand, `TPS_WORDS=1`; a `FROZEN_HOLDS` row, in the knob registry and a journal's tables; off = the build by run digest, since a bubble's time on screen is its length). `w(now, was)`
  is evaluated WHERE A LINE IS READ, never in a table built as a module loads; a table row that changes carries an optional field (`now`, `own`, `away`, `bare`, `only`, `office`) resolved at the read
  site. HOSTAGES have their own voice (dialogue.ts `HOSTAGE_LINES` by moment — wait / threat / aimed / shot / entry / alone / secured + the team's answer — said through civilians.ts `hostageSay`,
  timed by rescue.ts `voices()`; label 'hostage'; the lines she repeats all mission are a bubble only, never a log row). A DEFENDER (teams.ts `defenderWords(gd)` = a hostile unit) speaks of the
  team as 'them', never says the team's label for a mate (`spokenName` null → 'one of ours'; the squad net's `mate()` says 'Ten'), is the hard man when held (`temperamentOf`) and runs none of
  the night watchman's scripts (`only: 'shift'` / `needs: ['office']` rows). OFFICE THINGS (corridor, lift, fourth floor, desks, cleaning staff, security, the server room) are said only where
  `isOffice(level)`; elsewhere the level's own place names or words that name nothing. Door ids are said through orders.ts `doorIdWords` (compass letters as words, no token dropped). A DOOR WHOSE ID IS SHORTHAND
  is named by the rooms it joins (`src/game/doornames.ts`: 'hall-side mess door', 'mess hall to galley door', 'outer galley door', 'bunks 2 door from bunks 1', 'first / second day room door' off the level's room clear structure, hung on the
  Door at Game construction; never the office, never a Training lesson's level — its lines name its doors; `shorthandId(id)` is THE test, tactics.ts asks it too: a compass letter or whole compass word, one or two letters, letters with a digit, no vowel, 'off' / 'his' — a bare number is a word, 'back_1' is said 'back 1'; a place it is taken from that is itself named by a bearing is left out of the name) and that ONE name is what the squad's rows (orders.ts `doorWords(d)`), a defender's call (tactics.ts `gateCall`) and digin.ts's wedged-door line
  say; `rescue.ts doorName` still says by id. No bearing is said on a squad row: roomfit.ts `wayWords / runWords` and cover.ts `nameOf` name the place watched (dialogue.ts `watchedPlace`),
  else 'the opening' / 'the far end'. A door or wall CHARGE's report carries `GameEvent.charge` (combat.ts detonateStun `borrowed`; not saved, as `frag` is not) and is called a charge, not a
  flashbang; no man calls 'a door going in' at a door his own side's blast or boot took (`frag.ts ownNoise`: the line only — he is roused as before). roomclear.ts calls rooms that come
  clear within 0.6 s in ONE line (so the line comes that beat after the room empties, and a room that empties inside the beat before the run ends is not called) and words a room the team never stood in (its first floor cell asked of `g.cleared.roomAt / isKnown`) 'nobody left in …'; the rule for when a room counts clear is untouched. `words-doors` also holds that no said name carries a bearing its room's own name does not. One errand
  rides the switch: lighting.ts `theirMains` (only a side hostile to Sam walks to the breaker). A new spoken line follows the same rules; `probes.ts words` (lint / hostage / off / routes / log / doors / frag, in all-quick) and
  `lintDialogue()` hold them. Under `TPS_WORDS=1` `orders-stack` and part of `enemysquads-radiocheck` are red only for matching old text. Page: rebuild/dialogue/read-first.md.

<!-- added 2026-10-13, after the cut -->
- **One can, two words, each in its place** (the squad goal asked; the call is the dialogue pass's, 10-13): in the ORDER MENU and in a MOUTH the stun canister is a BANG — the door rows
  'bang, then go in · N left' / 'step in · no bang' (doortools.ts), the floor rows 'throw · frag N · bang N ▸' and 'bang there · N left', the squad block 'moving to throw · bang' /
  'throwing · bang' (squadthrow.ts `word()`), 'bang out!', 'no bangs left.' — because it is one squad count and the man calls it that. The THING keeps its name where kit is picked or
  held: Team & kit 'N stun', the HUD's 'stun canister', the key card's 'smoke · stun · frag'; what it DOES is 'stunned'. Tab rows (the debugger) say what the code says and are not
  player lines. A new row or line about this can takes the word of the place it stands in. `tools/qa/squadthrow-check.ts` asserts the rows' text. Never seen on a GPU; nobody has
  played the renamed rows.
- **The end card's verdict is one or two words in capitals, never a sentence** (`src/game/verdict.ts`; the card and its switch are the 'Every run ends on a verdict' bullet in menus.md):
  won — CLEAR · RESCUED · TAKEN ALIVE · DEFUSED · OUT (a solo mission walked out of); lost — DOWN (every player down; the why is 'by <who>') · WIPED (the team) · DEAD (the man who was
  to be taken alive) · GOT AWAY (he left the floor) · LOST (the hostages) · BLOWN (the charge went off) · FAILED (a mission stage failed). The why under it is the mission's own end
  line (`roomclear.endWhy`, `rescue.result.why`, the snatch's `why`), not a new sentence. Small words: the tag 'cheats' (a cheat was on: nothing is kept of the try), the count rows
  'defenders' and 'hostages' — the game's own nouns (never 'enemies', 'tangos', 'civilians' for a hostage). A new end takes a word of this kind: what happened, in the past, no verb
  of blame, no compass word, no number.
- **A man out on a look does not say he is coming AT anybody** (`tactics.ts flankCall`, 10-13; the hard-defenders goal's claim, mended as an after-close step of the dialogue pass). The
  flanker of a pursuit plan says 'moving round — coming at him / them from <place>'. A plan forms on a last-known spot, so the pair hard sends to where the team was last put after
  `sweepSecs` of nothing (pressure.ts `PRESSURE.sweep` goLook · enemysquads.ts `drillLook`; enemies.md) said 'him' with nobody seen. Now: when EVERY man of the plan is out on that look
  (`pressure.ts lookSince` / `enemysquads.ts squadLookSince`, readers added for this) and no man of their side has had eyes on the team since the look was called, he says 'moving
  round — coming in from <place>'. Any man of the plan not on a look, or one sight since the call, and the line is as it was. Words only — no rule reads either reader, who walks
  where is untouched — and only under the pass (`WORDS.on` off = the old line, so the frozen stand's lines stand). `tools/qa/sweep-check.ts` has the line on both its levels (asked
  where the pass is on: shipped, or `TPS_WORDS=1`; `FLANKCALL_BREAK=1` must fail there). Never heard in play; never seen on a GPU.
- **'to' in a door id is a word** (10-13, after the depot and the block were rebuilt with ids like `kitchen_to_hall`, `battery_to_yard`). `doornames.ts shorthandId` counted
  every token of two letters as its author's shorthand, so an id of two places joined by 'to' was shorthand: the squad's row said 'kitchen to hall door' (`orders.ts doorIdWords`)
  while a defender's call (`tactics.ts gateCall`) dropped that name for the nearest room's or 'this door' — two names for one door. `JOIN` (`doornames.ts`) lets 'to' through;
  letters either side of it are shorthand as before (`m_to_k`). A door the room clear structure LISTS is still named by its rooms only when its id is shorthand, so a listed
  `x_to_y` door now keeps its id's words (none is listed today: all twelve on the depot and the block are doors the structure leaves out). Words only, and only under the pass.
  `words-doors` asks it (`WORDS_BREAK=1` must fail) and asks the rebuilt block's room-named doors (`m_s`, `m_k`, `b_f`). Read, not heard: no run had a defender stack on one.
- **A man who runs, and a man at a dark doorway: their lines** (10-13, the enemy morale goal's steps; lines in the modules' own `LINES` tables, said through `g.say`, `he` / `they`
  picked as morale.ts has it — a scenario's defender under the pass is up against a team). `runner.ts`: `done`, shouted at the enemy the beat before the gun goes down ("no. no,
  I'm done. I'm done!"); `mates`, shouted to his own as he runs in on them ("don't shoot — it's me! it's me!", "… they're right behind me!"). `darkdoor.ts`: `call` as he stops
  and calls a mate ("I'm not going in there alone. get up here."), `self` with nobody to call ("pitch black. no. not alone."), `copy` the mate setting off ("copy. coming."),
  `with` the mate at his shoulder, `nobody` when no one came ("nobody. forget that room."), `alone` when he is sent in anyway ("all right. slow. going in."). Their authors call
  them placeholders: the writing pass is the maintainer's. Read by the dialogue pass and left as they are — a frightened man's short words, no bearings, nothing a trained squad
  says — but for ONE: `with` had 'on you. light it up.', which reads as an order to open fire; it is 'on you. get a light in there.' (their sibling line is 'lights on — go.').
  Read in the source; never heard in play.
- **The net goes quiet: its lines** (10-13, the enemy morale goal's third slice; `src/game/netquiet.ts` `LINES`, said through `g.say` on the net — `body` aloud once nobody is
  left on it; the switch `NETQUIET.on`, its words and its check are the 'The net goes quiet' bullet in enemies.md). Six kinds: `name`, the first man who does not answer, his name
  again, flat, as the squad's own ask names him ("{name}. … {name}."); `why`, a second or later silence with others still on the net ("why's nobody answering?"); `last`, nobody
  at all left on the net ("is anyone left on this net?"); `body`, the finder of a man nobody heard go — never a man who heard the shot ("he's down. nobody heard a thing?");
  `alone`, the last of a squad of two or more, other squads still up ("nobody left in here but me."); `ask`, a roused man nobody has asked calls the net himself ("all posts,
  answer up."). Their author calls them placeholders: the writing pass is the maintainer's. Read by the dialogue pass and TWO MENDED, each said of the wrong count: "that's two of
  you quiet" is owed at the second silence and at every later one (now "that's another of you quiet. come on."), and "they're all gone quiet" was the survivor of a PAIR speaking
  of his one mate (now "it's gone quiet in here. i'm on my own."). Left as they are: "that's my whole squad quiet" from a pair's survivor, and the lower-case 'i' (breach.ts and
  sneak.ts lines have it, enemysquads.ts writes "I'm" — no rule yet). A squad of one never says `alone` (`knowsSquad` wants two men). The pick is by index off the game's die, so
  the two mends move no draw; after them `probes.ts netquiet` is ALL PASS on the frozen stand (`TPS_MORALE=1 TPS_NETQUIET=1`) and on shipped, and the `words` family on
  both. Read, not heard; never seen on a GPU.
- **A guard's attention: its lines** (10-13, the attention goal's step; `src/game/attention.ts`, six small pools said through `g.say`, never on the net; the rule, its
  switch `ATTENTION.on` and its checks are the attention bullet in stealth.md). The split is by side: `gd.team === 'guard'` = the night staff, anybody else = a defender.
  `WARY` / `WARY_FOE`, the second taking inside his memory, said INSTEAD of 'huh?' ("again?", "…that's twice." / "again. stay sharp.", "twice now."); `SPENT` / `SPENT_FOE`,
  the taking that is no look at all — he draws and searches ("no. somebody's doing that.", "that's no accident. come out." / "that's bait. search the place.", "someone's
  playing us. sweep it."); `BROKE`, both sides, the hold broken by a man at the edge of his eye ("—wait.", "what—"); `DONE_FOE`, a defender done looking ("…nothing.",
  "nothing there."). The staff's word for done is their old one, MOVED: 'must have been nothing' ('clear here — staying on it' once the floor is raised) is said `tellSecs`
  before the look ends, not on the walk back, under guards.ts's rules for that line (never within 4 m of a known body, never on top of his own radio line, never with Sam
  down); `attentionTold` keeps the walk back from saying it twice. Their author calls them placeholders: the writing pass is the maintainer's. Read by the dialogue pass,
  ONE MENDED: a defender's "that's bait. find him." — a defender speaks of the team as 'them' and 'find him' is the night staff's (teams.ts says so) — is now "that's bait.
  search the place.", which names nobody and is what he then does. Left: "twice" in two lines is true only while `ATTENTION.spent` is 3 (the wary line is the second
  taking's alone; a larger `spent` would have a third taking say 'twice'); "stay sharp" from a defender with no mate in earshot. The pick is by index off the game's die: the
  mend moves no draw; after it `probes.ts attention` (2 probes) is ALL PASS on frozen (`TPS_ATTENTION=1`) and on shipped, and the `words` family on both. Read, not heard.

- **A shout heard: a hidden defender's shout that reaches an ear is a quiet row on the strip** (10-16, `src/game/cues.ts overheard`; the maintainer's call on the open
  question 'a shout from a defender you can't see': yes — a quiet row on the radio strip, only when the shout really reaches the player's ears or a living teammate's,
  no name, no place). Switch `CUES.overheard`: ON in the page (`?overheard=0` = such a shout is no row, as it was), OFF in the module and on the frozen stand
  (`TPS_OVERHEARD=1` raises it; `TPS_PROFILE=shipped` has it up); a `FROZEN_HOLDS` row; `CUES` now rides a recording (`JOURNAL_KNOBS`), and a recording from before the
  key replays with it down. THE RULE: `guards.ts say()` hands every SPOKEN line (never one on a net) to `overheard()`. A row only when all of: the speaker is hostile
  to the player, alive, and the fog hides him (a man in sight has his bubble; the fog off = never); the line is SHOUTED = its writer put a '!' in it (`isShout` —
  the tables' own mark, so a new shouted line needs nothing but its '!'); it has not just been drawn (the same words inside `dupSecs`, any two `overheardGap` 4 s
  apart); the strip has a FREE row; and an ear of the team's gets it by the shout's own law (digin.ts `heardBy`: flat distance and the path both under `DIGIN.shoutM`
  18 m × the propagation's carry — mouth at 1.2 m, ears at 1.6 m: the player's if he is up, each living teammate's). The cheap questions come first and the hearing
  model is asked with `hearPath(..., keep = false)` (`SoundPaths.propagate`'s new third argument): the row leaves NO route in the half-second cache the AI's own
  hearing reads. WHAT IS DRAWN: the words alone under the word HEARD (`stripRows` gives `'heard: …'`; ui/overlay.ts draws `<span class="rx heard old"><b>HEARD</b>…`,
  the strip's existing dim row — no colour of its own, so the menus' colour rules reach it through `.rx`). No callsign, no squad, no room, no door, no side of the
  screen. NEVER IN A ROW'S WAY: the row is a field of its own (`Cues.heardRow`), not one of `Cues.rows` — nothing that files, ranks, counts or reads the net's rows
  meets it (the gap rule, `netWait`, the squelch, the playthrough bot's leads); the first row filed onto a full strip ends it for good; a checkpoint load (`adopt`)
  and a clock gone back clear it. `Cues.heardLog` says why each offered shout was or was not drawn ('dup' · 'gap' · 'full' · 'far'); `stats.shouts` / `shoutsDrawn`.
  It moves no man and no die: a row is not a sensing (the AI is told nothing, the bot is told nothing). CHECK: `bun run tools/qa/probes.ts words-overheard` (families
  `words`, `cues`; `tools/qa/overheard-check.ts`, 15 verdicts: a bare clock for who gets a row and who does not; levels/block-squads.json under the fog, every hidden
  defender shouting in turn with the player's ear brought beside him — on shipped 1,096 shouts in earshot drew, 632 out of it drew none, 0 wrong, and across 1,252
  questions that went round walls the route cache grew by 0 (frozen with the switch raised: 869 · 697 · 0 · 1,578 · 0); one seed with the switch down and up, 60 digests equal; the stands' row, the word, the recording) — ALL PASS on frozen
  and on shipped; `OVERHEARD_BREAK=1` (the switch left down) = 7 FAIL on each, exit 1. The page: `PORT=<port> node tools/qa/overheard-page.cjs` (headless Chromium, the
  software adapter) — the page has the switch up and the strip's element is that one span; with `?overheard=0` no such row. MEASURED (playthrough.ts, the shipped
  stand, block-squads · depot-four · rescue-registry · floodlit-four · killhouse-four · night-breach × seeds 1–4 = 24 runs): 77 hidden defenders' shouts offered,
  12 drawn (42 out of earshot, 14 inside the 4 s gap, 9 with no free row); the words drawn: 'flashbang!' ×3, 'cover — get to cover!' ×2, 'CONTACT!', 'fire in the
  hole!', 'get that against the door!', "the wall's down — watch it!", 'they got him! they got him!', "they're hitting the others — move!". The same 24
  with `TPS_OVERHEARD=0`: every run ends the same way at the same second with the same team, kills and deaths (24 of 24) — taken 17, rescued 4, wiped 3 either way.
  NOBODY HAS SEEN IT ON A GPU OR HEARD ANYTHING: whether a dim row under HEARD reads as 'I heard that' and not as a radio line, whether one row in two
  fights is too few or 4 s too tight, and whether '!' is the right mark for a shout are by-eye calls. Left as found: a shout has no SOUND of its own (the row is the
  only trace); a hidden defender's quiet spoken line is still nothing; teammates' ears count but the row does not say whose. The
  rule asks who is hostile to the player, not which mission: the night staff's shouts under a quiet mission's fog are rows too — NOT measured (the 24 runs are loud
  missions) and nobody has played it.

- **On a defender's net 'they' and 'them' are the team; the hostages are named** (10-18, read against the hostage rescue's ending, `src/game/rescueflush.ts`). Two of
  its radio lines used the two words for the hostages and for the team in one breath — "they're gone — they're moving them! cut them off!" and "on the way out
  — they don't leave with them!" — which on the strip, with no picture, takes a second read. Now "the hostages are gone — they're moving them! cut them off!"
  and "on the way out — they don't leave with the hostages!": the hostages are named once (the defenders' net already says "moving to the hostage door!") and
  every 'they' / 'them' left is the team, as in every other defender line. Words only: said by the same man at the same moment, no draw moved. Left as read:
  "I'm going in for them!" (either reading is true of what he does). ALSO FOUND, the same day: `words-hostage` was RED on the shipped stand at the build head (green on
  frozen) — its line 'the room is the team's: one of them speaks, a teammate answers a beat later' kills every man of theirs to make the room the team's, and
  under the new ending (`RESCUEEND.on`: nobody of theirs left = won `clearSecs` 1.5 s later) the result came before the teammate's answer at +2.4 s. THE RED
  WAS THE CHECK'S, NOT THE GAME'S: its listening stopped at the result. The answer is said all the same (`rescue.ts voices()` runs on after the result; the
  rescue's owner measured it on three levels: she asks at once, the result at +1.5 s, his answer at +2.4 s, the end card at +3.5 s over the rest of his
  bubble), and the check now listens the beat out and hears it on both stands. A first note here said the answer was never said in play: that was wrong.
  Left for play: whether the card coming over his line reads well (a presentation call in the debrief's file, nobody is building it). After it
  `probes.ts words` (8) and `rescueflush` are ALL PASS on both stands. Read, not heard; never seen on a GPU.
- **Read 10-19, left as they are: the office's response lines keep 'the west stairwell' and 'nobody west of the lobby arch'.** The office names its
  own places with bearings all through (the same team says 'south lot', the handler 'Fire exit, east end.', the held
  worker 'They come up the west stairs.'), and men who work a building speak that way: the lines fit who says them. The no-compass rule is for what the
  player steers by: a row on the HUD, a door's name on the squad's menu. A rewording was built and taken back out, for a reason the next session needs:
  A BUBBLE'S TEXT IS IN THE RUN DIGEST (digest.ts folds it to length + hash, and a held civilian's bubble stays up by its length), so changing a line that is said
  under a switch that already exists makes every recording in which it was said replay to a different digest. A changed line is therefore a key of its own
  that the journal carries (journal.ts, as `ORDERS.inWay` was), or it is a line no recording can hold yet. Taking the bearings out of the office's speech is
  that kind of job, over a dozen lines and two door labels, and nobody has asked for it. Also read that day, all fit: the levels' own response lines (site,
  team, tag and way phrases; no other level's `response` block says a bearing: seven files read). The hostage check's last line ('and then they are quiet')
  listened one step on the shipped stand, where the result is already in: it now listens six seconds there.
- **A level names its own doors where the rooms cannot (10-19, `WORDS.doors`).** The squad's rows, the hover words, 'covering …' and '… is locked.' read a
  door's name through `orders.ts doorWords`; `doornames.ts` makes that name from the rooms only for a door the room clear structure lists, so every other
  door with a bearing in its id read 'gate north door', 'fence east door', 'break room west door': a compass word on a HUD that has no compass. A default
  without the bearing cannot work (the crossing's five gates would all be 'gate door'), and renaming ids moves the level fingerprint and every plan that
  holds one. So the level says the name: `scenarios.doorNames`, rows of `{ door, name }`, the name as a row reads it ('yard gate', no 'the';
  `scene/scenarios.ts LevelScenarios`, `KEYS.scenarios` and a rule in `levelData.ts` — a door the level has, once, 1 to 40 characters; the editor's
  `scenarioRefs` knows the slot, so a rename follows and a delete is refused; `docs/level-format.md`). Not in the fingerprint (door ids, routes, boxes).
  `doornames.ts nameDoors` hangs three things on the Door at construction: the made name as it was, the written name, and the made names as they come out
  BESIDE the written ones (a 'second hall door' is a 'hall door' once the first is a 'loading door'). `doorSaidName` gives written, then made-beside, WHILE
  THE KEY IS UP, and the old made name with it down: the key is asked when a name is read, not when the game is built (the harness writes its switches after
  the Game is made). ONE NAME A DOOR: `doorWrittenName(d)` (the written name, key up, else undefined) is read first by the lines that named a door some other
  way — a rear man's 'holding ·' row (`rearwatch.ts`), the rescue's held-door label (`rescue.ts doorName`), the response team's 'stack on …' and 'by the …'
  (`qrf.ts doorSaid`), and the office's own men on the net (`tactics.ts gateCall`; another level's men already read `doorSaidName`). A door with no written
  name says in each of those exactly what it said. A written name need not end in 'door': gateCall's '…down in the <door>way' drops the 'way' then.
  THE KEY: ON in the page, `?doornames=0` = every door called what it was; OFF in the module and on the frozen stand, `TPS_DOORNAMES=1` raises it (read only
  with the words switch on); `FROZEN_HOLDS` row, `STAND_ENV` word, the stand's pinned line; it rides the WORDS table in a recording, and one from before the
  key replays with it down (`journal.ts applyKnobs`) — a door's name is said in bubbles and a bubble's text is in the run digest. What the key does NOT hold:
  a name written into a level file LATER changes what a recording made on that level in between replays to, like any other change to a level's scenario
  data (none of it is in the fingerprint). NAMED SO FAR: the office's two (`levels/office.scenarios.ts`: 'corridor-side break room door', 'cubicles-side
  break room door', by what each is taken from — the same words the rooms rule would make if the office were not left out of it). OWED: 96 doors in 25 level
  files, door for door in `tools/qa/words-probes.ts DOORS_OWED` — the levels' own to write; a door named comes off the list in the same change
  (`DOORNAMES_CENSUS=1` in front of the check prints the list as it now is). Check `bun run tools/qa/probes.ts words-doornames` (6 lines: the lookup on a
  made-up level with the key up and down; a written name says no bearing and begins with no 'the'; no two doors of a level called the same; the doors
  still called by a bearing are exactly the owed list; the office stood up, the row and a line that names the door another way, key up and down; the two
  stands' row, the word either way and an old recording). `DOORNAMES_BREAK=1` reads the names with the key down and is red (the office's two owed again),
  on both stands. NOT TOUCHED: the debrief's timeline names a kicked or picked door by its id's words (`chronicle.ts chronDoor`), and the office's men say
  'break room west door' of a door nobody wrote a name for — there is none left on the office. Headless only: no row seen on a page; never seen on a GPU.
