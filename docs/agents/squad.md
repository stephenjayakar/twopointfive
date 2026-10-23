# Squad orders

One of the area files CLAUDE.md indexes. Everything below was moved here word for word from CLAUDE.md on 2026-10-13, in its old order;
"the bullet above / below" in a bullet means its neighbour there (each block says which lines it was), and a bullet named by its bold
title may now live in another file of this folder: `grep -l '<title>' docs/agents/*.md`. New bullets for this area go at the foot of this file.

<!-- was CLAUDE.md lines 237–239 -->
- **The orders menu** (`src/game/orders.ts`, `Game.orders`, `__orders`): `X` or the middle mouse button opens it on what the cursor is on (a door, a spot of floor, nothing),
  digits 1‥5 pick (1 the target's own order · 2 cover · 3 fall in · 4 hold · 5 a page: 'door tools ▸'), `T` steps who takes it (gold / red / blue / one man), `B` = the first
  row at once, `F` = the word for an order that waits on Sam. Nothing is ever on a digit above 5. Sam's own digits: 1 pistol · 2 rifle · 3 smoke · 4 stun · 5 frag (`game.ts KIT_ORDER`).

<!-- was CLAUDE.md lines 324–327 -->
- **Log lines on a squad mission name the man** (10-11, off a tape of the compound; each under `WORDS.on` — off = as it read): a unit's cut-off last line is logged
  under his own callsign (combat.ts killGuard, player.ts: 'Red Two: man down.', never 'guard:', as guards.ts `say` files a unit's line), a defender the PLAYER drops reads
  'Tango N down' ('guard down — dead' stays for the night watch), and a room clear that ends with Sam down and a teammate still up says 'player down' (it read 'Sam down' until 10-15), on the log and the
  objective row (roomclear.ts `endSay`; 'team wiped' only when nobody was up). `probes.ts roomclear-ends` holds both sides of the switch.

<!-- was CLAUDE.md lines 771–819 -->
- **Squad orders** (`src/game/orders.ts`, `Game.orders: SquadOrders`, `__orders`; records rebuild/room-clear/orders.md and — the press menu + who takes an order — rebuild/four-squad/orders.md): Sam's LIVE orders to the operative
  units on his side (any `gd.unit && gd.team === 'operative'` in `Game.guards` — the night breach's pair, or four in two pairs under `?squad4`), a Ready or Not style command menu.
  NOTHING IS HELD: a PRESS of `X` (or the middle mouse button, `ORDERS.mouseOpens`) puts the menu up on what the CURSOR was on at the press and it STAYS UP, frozen on that target
  (`orders.mark()` = the ring both overlays draw there), until a row is picked or it is dismissed (`X` again, Esc, a right click, the cancel row, `'Blur'`, Sam down, the men it was for all down — and THE TRIGGER, below);
  `open(target) / close() / pick(i)` are the same from code. The target (`targetUnder`: the cursor's own ray, never the auto-aim's snapped `aimPoint`; WHAT IS DRAWN UNDER THE CURSOR FIRST — a teammate's
  body the ray lands on, else (`ORDERS.doorRay`) a door whose own LEAF is under it or whose DOORWAY it looks through (`doorOnRay`: the ray crosses the doorway's rectangle with nothing of the scene in
  front and lands within `doorRayReachM`) unless Sam's own body is under it or another door is by the landing point — then what is NEAR the landing point: door within `ORDERS.doorPickM` / teammate / Sam
  himself, else free floor. Without `doorRay` an open doorway mostly got the floor's menu and a teammate a step from the landing point his own: neither has door rows. `probes.ts doormenu` holds it for
  every door of every start-card scenario), rows = the `OrderDef`s whose `targets` fit, one that cannot be carried out there (per man `can`, together `valid` → the reason:
  no nav path, a door locked against Sam on EVERY way — `route()`, which also hands `assign()` waypoints round one that is only on the short way —, no room at the
  jambs, no line to cover from) GREYED with the reason and refused aloud; a man who alone cannot do his part says so and is left as he was; FIXED digits
  (`OrderDef.key`: 1 the target's own order, 2 cover, 3 fall in, 4 hold; `register()` deals the first page's 5 and NEVER a digit above `ORDER_DIGITS` 5 — the
  left hand's reach from WASD, the maintainer's note; a menu with more to offer is in PAGES, Ready or Not's way: a row with `OrderDef.opens` turns the menu
  to the rows registered with that `page`, dealt 1 up, on the same target and men — `turn()` / `pageBack()`, Esc or a right click on a page = back a page, X
  closes from anywhere; digits 6‥9 are eaten and do nothing while a menu is up; `probes.ts orderkeys` walks every menu of every scenario for it); a digit picks its row at once; wheel / ↑↓ move
  the highlight and Space or THE MIDDLE BUTTON AGAIN gives the highlighted row (button twice = the first row). Everything the menu answers to is taken OUT of the frame's input
  first while it is up (a digit is not a weapon slot, the wheel not his pace, Esc / Space not the selector's, the right click not the OCP); the frame it OPENS on takes nothing
  else. THE LEFT BUTTON IS ALWAYS SAM'S TRIGGER: a left click with the menu up puts it away and fires (`ORDERS.clickGives`, off: the click gives the highlighted row instead and
  fires nothing — an A/B for the maintainer). `B`
  (`ORDERS.quickKey`) = the target's FIRST row at once with no menu (move there / stack up / fall in — RoN's default command). WHO takes the next order = `orders.who`
  (`'all'` | a `PairId` | a man's index), shown on the HUD at all times in the element's colour (`Tone` gold / red / blue; `OrderHudRow.tone` → `.t-<tone>` in index.html, `TONE` in
  the native overlay): `T` steps it — a squad in pairs (`orders.paired`) all (GOLD) → RED → BLUE → all, the one pair all → each living man → all (`cycleWho(dir)`) —, `T` with the
  cursor ON a teammate addresses that man (`address(gd)`; T on him again = everyone — `whoAfterT(point)` is the one rule, the HUD's T line reads it), a menu OPENED on a teammate is his alone (he goes down: the menu goes), and `ORDERS.wheelElement` (off) makes the wheel step the
  element as RoN's does instead of the highlight. A door tool given to one pair is worked by that pair (the other pair is left as it was). Orders: `move` (two spots abreast, gun up on the way,
  'set.'), `stack` (`stackPosts`: a man a jamb on Sam's side, both in file where one jamb has no floor), `cover` (gun on a point / a door from where he stands), `fallIn`
  (places back along Sam's crumb trail — through the doors he took — at Sam's measured pace + a gain on the gap; a man Sam walks back at steps aside and falls in behind:
  `aside()`; Sam stopped, a man already near him in plain sight stays put — `nearM / bandM`), `hold` (a stride on from a run). The men take turns acknowledging in a word; a man lowers his muzzle while Sam is in its line. The men are moved through squad.ts `order()` on `Guard.script`
  from `orders.tick()` (game.ts, after `nightBreach.tick`, before `tacticsTick`); `orders.input()` runs between `updateAim` and `updateInteract`. AN ORDER SETS WHERE A MAN IS
  AND WHERE HE WATCHES, never when he shoots: the seam for a fight layer = a man whose script somebody ended with state 'alert' is left to the fight AI while his fight is
  warm (a sighting / a shot heard / the hand-over inside `ORDERS.coldSecs`, or mid-reload — or `orders.fight.engaged(gd)` when a layer sets the `FightLease`; pinned on his
  post), then taken back. `register(def, before?)` adds a row at the foot (a later part's door tools — refuse in `valid`, never from `issue`; `OrderDef.tick` = its per-frame
  stages, `newGroup()`);
  `owners: SquadOwner[]` = drills that move the squad themselves (the night breach: an order while it is stacking / set calls it off, while it is going is refused, once
  inside recalls — `NightBreach.ownsPair / callOff()`, state `'recalled'`); F there takes the pair back. Inert (a pass over the guard list) with no squad, under any show /
  `quietUtility` / puppet. The HUD: `orders.hud()` → the interaction panel's rows (the open menu replaces them: a WHO row, the orders under 'on <target>', a cancel row, + its own hint line; else one
  'squad · orders to …' block: every man and what he is doing, the addressed ones marked, what B / X would do on what the cursor is on, T's choices), read by both
  overlays' `deriveInteractions`. QA: `probes.ts squadorders` (orders-off / menu / move / cover / stack / fallin / one / nightbreach / seams / edges — every order through the
  harness cursor and one-frame presses) + `probes.ts orderui` (the four: one order to gold / red / blue / one man with no key held, the HUD's words, a door tool to one pair). NOT arbitrated: a Director play program / the QRF scripting an operative who is under one of Sam's orders.
- **B is the squad's autopilot** (`src/game/autopilot.ts`, `AUTOPILOT.on`, `__autopilot`; ON in the page, `?noautopilot` / Tab ▸ Squad ▸ Order menu & keys ▸ 'B ▸ the squad picks the entry' = B is the target's first row as it was; OFF in the module and on the frozen stand, `TPS_AUTOPILOT=1` raises it, FROZEN_HOLDS row `AUTOPILOT.on`; in JOURNAL_KNOBS, a recording with no AUTOPILOT table replays with it off; page rebuild/commanding/read-first.md; the maintainer 10-13: '"B" is the "autopilot" mode where the squad does the reasonable thing (and then maybe briefly shows their plan and then fades out), while X is the sweatier mode'). orders.ts `input()` hands the quick key to `autoQuick(g, t)`: floor / nothing / a teammate / a door nobody of the addressed men waits on = the first row, as ever; a door they STAND on a plain 'stack up' at (`DoorTools.waitsOn` → `set`: every man on his mark — a second tap while they walk is 'stack up' again) = they go in by the entry `autoPick` takes, given to the men on the door and nobody else (`GiveOpts.men`); a door something else of theirs waits on (on the word, a held threshold, a charge set or being set) = the word to the men on that door (the pair: its held threshold's word, or its set charge blown by the row); a set charge nobody waits on = blown, never one on a word still gathering (`wordPending`). THE ENTRY (`autoEntries`, the first whose row's `valid` takes it): silent squad → open and clear only (never made loud); an enemy the team has in sight in the room beyond (the fog's picture where it is on, else `fight.teamSees`) and a stun left, or a room nobody has stood in (cleared.ts) and more than `keepBangs` 1 left → bang and clear; else open / kick / pick and clear; none of those and the door known shut → a charge, which is set and WAITS. Never a frag, a wall, or a second door: those are the menu's. THE PLAN: a quick-key row in the order book is stamped `auto` and floorplan.ts draws its men for `showSecs` 4 (the menu's own order: `PLAN.freshSecs` 2.5), the newest thing that names a man deciding; `AUTOPILOT.replan`: doortools.ts `haltAt` (a door found shut — they stop and stack) calls `orders.show(men)` the frame it re-assigns them and they are drawn the same way (`SquadOrders.shows`, picture only, in no digest). The HUD's B line (`autoHint`) is the FIRST choice in the row's words with no path search; the press may fall back. QA: `probes.ts autopilot` (tools/qa/autopilot-check.ts, in `squadorders`; nine lines, both stands; `AUTOPILOT_BREAK=1` fails eight and must): B through the game's input on the office room clear, four and the pair. MEASURED since (10-14): 'Who commands best: the three-hands tally' below. NEVER seen on a GPU, never played; the contact rule is checked with a STAGED sight only; the halt's own call of `show` is not staged (the picture path is, by a direct call).
- **X is where the plan is laid** (`src/game/planlay.ts`, `PLANLAY.on`, `__planlay`; his words 10-13: "X is the sweatier mode where you can micromanage them a bit"; the focus list's item 7: "The plan is laid in real time at the start mark, waits on F and survives Enter"). SWITCH: on in the page, `?noplanlay` off; off in the module and on the frozen stand, `TPS_PLANLAY=1` raises it; a `FROZEN_HOLDS` row; in `JOURNAL_KNOBS`, and `applyKnobs` puts it off for a recording from before the key. Tab rows under Squad › Order menu & keys: 'X ▸ wait for my word lays the plan', 'X ▸ a restart puts the plan back' (`keep`); `sticky` (the menu opens with the row on while a plan is laid) has no row. THE RULE: with the switch on, the menu's 'wait for my word' row (`wordRowOf`) is under every menu with an order in it — a door, the floor, a teammate, nothing; the pair too — and a row picked with it on is LAID (`layOrder`: `{ id, callsigns, door by its index on the level's list | spot | man }` on `SquadOrders.lay`), not given: nobody moves, nothing goes in `orders.log`, so the par clock and the hold-fire rule have not started. A man has one laid order (a new one takes him off the old; an order THE PLAYER gives at once — the menu with the row off, B — takes him off the plan: `layGiven`, called from `give` only under `byHand`, so a scenario's own 'fall in' leaves the plan alone; a man who is down is off it the next frame, `layPrune`). THE WORD'S KEY (`layKey()` = `DOORTOOLS.blowKey`, F — the one source for the press, the HUD's line and the floor's cap) with no menu up and a plan laid SENDS it (`laySend`, read in `orders.ts input` ahead of the quiet pair's mark, the wall charge and the door tools, and taken out of the frame): each laid order goes through `give` with `{ men, onWord }` — a door tool of the four's on the word as ever, so they walk, stack and wait and F AGAIN (or B on the door) is 'go'; everything else just goes. ONE EXCEPTION, which keeps the row as it was for men at a door: where EVERY laid door tool finds its men already on its door (`doorTools.waitsOn(...).set`: stacked on it, holding it from outside) the press is the word itself and they go (`doortest-check`'s held-door line passes on the shipped stand by this). Its order-book rows are stamped `laid`. With a menu up F is still the row's own key — except while a row of that page is on F AND can be given (`altRow`: 'go' with somebody waiting, a held threshold's word), where F stays that row's; the HUD shows F on one of the two only. For the four on the page a floor menu's 5 is 'go silent', so there the row's key is F. On a door's first page F now flips the row in place (it used to jump to the tools page). ENTER: the FIRST plan sent in a try is kept (`lay.kept`, for `tryKey`: the scenario kind, the cast's callsigns and the mark Sam stood on as the try began) and `orders.ts sync` — the fresh cast a restart stands up — finds it laid again (`layFresh`); a kept plan for another start is dropped, and switching `on` or `keep` off drops it too. A wall's or a thing's own order is found again by a point ON the wall / the thing (`LaidOrder.pick`), never by the spot the man stands on. DRAWN (`floorplan.ts` `FloorPlan.laid` → `ui/planfloor.ts`, `.plan .laid` in index.html): in the order mode each man's way from his feet to the door or the spot (a 20000-step path search, asked at most every `PLAN.reaskSecs`), a ring at his feet, the door's bar or the spot's ring and the F cap; with the menu down a laid order shows as it is laid and fades in `PLAN.freshSecs`. While a plan waits no other door's bar is marked `now`, and the squad's HUD block has 'F go · <who> on the plan'. STATE: `laySnapshot` / `layRestore`, filed by `savestate.ts` as `lay` with the switch on (a checkpoint with a unit on the floor is refused today, so only a forced / harness save carries one; `restoredT` keeps the cast a load stands up in the same step from wiping it). New read line: 'you: <who> — wait · <row>'. QA: `tools/qa/planlay-check.ts` (probe `planlay`, family `squadorders`): 12 lines through the menu's own keys on the office room clear — laid and nobody moves / drawn only in the order mode / replaced, struck by the player's own order and not by a scripted one, a man down off it / two doors sent, then one word / men already on the door go on the one press / survives a restart, `keep` off does not / the snapshot pair / the switch off = the row as it was / a wall's order found again (shipped stand only: the frozen one has no wall to charge) / the pair / a door found shut under the laid plan (the office's stairwell, locked and unknown: laid, sent, the lead tries it and says so, the pair left the plain stack on the marks the row given at once leaves; the line raises `DOORTOOLS.testDoor` itself, which the frozen stand holds) / a stack refused for Sam's own body is refused AT THE LAY in the stand's own words and nothing is laid (the barracks' sg_w, `inway-probes.ts`'s staging; Sam off the place, it is laid and F sends it) — ALL PASS on both stands; `PLANLAY_BREAK=1` fails 10 of the 12 on both (recounted 10-15 on the build head; the two that pass are the switch-off line and the snapshot pair). The probes that list a menu's rows as the four's door tools had them (no row on a floor menu, off on every new menu, F on a door's first page turns to the tools: `squadplay`, `thresholdmenu`, `orderkeys`, `pressorders`, `doormenu`, `doortools-menu`, `orders-menu`) are run with `PLANLAY.on` held off on every stand, in ONE place — `tools/qa/probes.ts run()` `ROWS_AS_THEY_WERE` sets `TPS_PLANLAY=0` round them unless the caller named the word; they went red on the shipped stand otherwise, by design. `TPS_PLANLAY=1` in front of one runs it with the rule on. MEASURED since (10-14): 'Who commands best: the three-hands tally' below. Never seen on a GPU; nobody has played it; the overlay's laid marks were only read as the list `floorPlan` hands over and, on the software adapter, as SVG. Known: the door tools' own 'F go · … waiting' line stays up beside the plan's while both wait, though the key is the plan's first.
  MEND 10-14 (the doors thread's claim): with the row under every menu, the menu took F as the row's key before `doortools.ts input()` saw it, so for the PAIR holding a
  threshold F with the floor's menu up, or with the held door's own first page up (its fifth row reads 'F: go'), flipped the row and was not the word. Now `orders.ts`
  asks `DoorTools.wordKeyHeld()` first (input()'s own test, nothing given): a held threshold's word outranks the row, the key is left alone, and the HUD does not show F
  on the 'wait' row then. Inside `PLANLAY.on` only. Seen by `probes.ts calls-held` on shipped (2 FAIL before, 7/0 after; frozen with `TPS_PLANLAY=1` the same).
- **The orders ring on Tab, a PROTOTYPE to play before it is committed to** (`src/game/cmdring.ts`, `CMDRING.on`, drawn by `src/ui/cmdring.ts`; the maintainer, 10-20:
  "want to play with it in game a bit before we commit to it", and of the one key "yeah I like that!"; the design and what he agreed, with his words:
  rebuild/commanding/command-mode.md). SWITCH: OFF in the module, OFF in the page, OFF on BOTH stands (no `FROZEN_HOLDS` row: the stands do
  not differ); `?cmd` on the address or the debugger's tick 'Tab ▸ the orders ring (to try)' puts it on; the table is in the knob registry and the journal
  (a recording from before the key replays with it off). Off = the build as it was: Tab is nobody's, and the only shared code moved is the quick key's give and
  its HUD words, now `SquadOrders.quickGive` / `quickWords` (after it the squadorders, checkpoints and calls families are all green on the frozen stand; on
  shipped all green but orders-cover, orders-stack, checkpoint-autosave, checkpoint-civilians and calls-rally, each red the same way on the untouched build
  head of that day). WHAT IT IS: Tab DOWN puts the order
  menu up as a ring at the cursor (the menu itself: `open` / `turn` / `pick`, so every row, refusal and reason is the menu's; `SquadOrders.cmdRing` beside it
  holds the ring's middle and the lit wedge; `ringInput` runs ahead of the menu's input; the panel lists no menu while a ring is up, and the menu's own mark
  in the world is not drawn: its words, who → what, sit under the ring); Tab UP gives the lit wedge. The first page's first wedge is the QUICK KEY'S order, so a tap is B exactly. Held: a digit 1 to 5, or the cursor out of the ring's middle
  (`flickPx`), lights that wedge; a wedge that opens a page turns the ring to it and lights nothing; the wheel steps who; a left click on a man (his body as T
  reads it, or his feet inside `manPx`) makes the orders his and starts the ring again, first wedge lit; Esc, or a right click on the first page, gives
  nothing; a left click on nobody is Sam's trigger and the ring goes. The cursor counts from the ring's middle and only once it has been back there since the
  ring last changed under it (a page, a digit, a man, a ring opened at the view's edge and stood in by `edgeX` / `edgeY`), so the hand coming back picks
  nothing on the way. BEFORE THE KEY (`CMDRING.hint`: off in the module and on both stands, raised by the page with the ring, `?nocmdhint` or the debugger's tick
  'Tab ▸ the ring ▸ a hint at the cursor' leaves it off, and a recording from before the key replays without it; a picture only; the maintainer, 10-20: "we
  should some visual indication of what type of menu will open when you hit tab on the cursor. this could be a door icon, a wall icon, etc on the cursor"):
  `SquadOrders.hintView` names what the cursor is on as the ring would take it (door, wall, man, floor, thing, foe, or the squad itself where the cursor is
  on nothing an order goes to) and `ui/cmdring.ts updateHint` draws a glyph for it up and right of the cursor (the other way at the view's edge) and the
  thing's outline on the floor (a doorway's line, a stretch of wall never past the wall's ends, a ring at a man's feet or on the spot; the squad's menu has
  a glyph alone), in the colour the ring would open in. It is drawn only where the key would open a ring (`ringFree`, shared with `ringInput`: no menu up,
  Shift not down, nothing the key backs out of instead); with the ring up the glyph sits in its middle and is the ring's own target. Before the key the
  target is asked again whenever the camera has moved (hover()'s kept answer is dropped), so the outline stays under the cursor. No words are put on the
  cursor (the panel's line has them). THE RING'S SIZE FOLLOWS THE WINDOW (`CMDRING.ref`, `ringZoom`): the flick, the edge margins, a click near a man's
  feet and the picture grow together in a window over 1920 × 1080, and `ui/cmdring.ts` puts the ring in the zoomed layer's own pixels (ui/textsize.ts), so
  the wedge under the cursor is the wedge the game lights; a text size step chosen by hand does not change the ring. HIS OWN HANDS ON THE SAME RING (`CMDRING.hands`, `interact.ts`: off in the module and on both stands, raised by the page with the ring,
  `?nocmdhands` or the debugger's tick 'Tab ▸ the ring ▸ Space the same way (to try)' leaves Space as it was, and a recording from before the key replays
  with the list; the maintainer, 10-20: "i'm curious if we can unify some of these squad command interactions with ours. our space menu feels really
  clumsy today"): Space DOWN over something to choose puts the rows Space already had up as a ring at the cursor at once (`Player.sel.ring`; the
  highlighted row lit, his colour the HUD's bright), Space UP does the lit row, so a tap is the tap it was. A digit (not his weapon slot while it is up)
  or the cursor out of the middle lights another row that has a wedge; the wheel and the arrows step the highlight as they did; a right click, a left
  click (his trigger, never the arm hold's knife), the back key or the window losing the keys give nothing. No quarter second, no cancel row, and his feet
  are his own (`Player.listOpen` is the one question the feet, the cancel row, the hands and the panel ask: open as a LIST). A wedge's words are the
  row's up to its dash; the thing's name and the lit row's words in full sit under the ring. The rows, their order, what each does, the sustained verbs and
  how they stop are untouched. The two rings never stand together (Space under a held squad ring is taken; the squad's key over his is the back key).
  Not on it: a row past the fifth (the wheel reaches it; nothing is lit), nothing on open floor. ONE GUARD ON THE CLOCK, both rings (`tapSecs` 0.15 s): the
  cursor lights nothing in the key's first moment, and one already out of the middle by then lights nothing until it has been back, so a tap made with
  the hand sweeping is still the first wedge; a digit counts from the first frame (`ringOpen` / `ringWant` in `cmdring.ts` are the halves both rings
  share). Shift held with Tab opens no ring: that is plan mode's toggle (the next bullet). TAB IS ALSO THE BACK KEY (`BACKKEY.tab`): with
  a menu, a Space list, a running verb or the launcher's arc to back out of, the press is theirs and no ring opens; on the page Esc is the pause, and a ring
  held under the pause card is gone, nothing given, when play comes back (the 'Paused' tick). NOT ON THE RING YET: rows on letters (the
  throw page on G, 'go'), the 'wait for my word' row (a ring's order goes at once), picking several men (one click is one man). B, X and T work beside it;
  with the ring on, Tab is not the debug tools' key (`main.ts`; `TABKEY.does` is 'off' in the page anyway). A load, or the tick put off, puts a held ring away
  (`ringRestore`). CHECK: `bun run tools/qa/cmdring-check.ts` (`probes.ts cmdring`, family squadorders), 17 lines through the game's own input on the office
  room clear, the check raising the switch itself (22 lines since the tap's own rule, the next bullet); `CMDRING_BREAK=1` (the switch left off) fails 18 of the 22 on both stands (the four that hold are the ones that say 'as it was'). SEEN: the first 17 lines on both
  stands, one seed; the page on the software adapter with `?cmd` through real key and mouse events (the ring draws at the cursor and whole at the view's
  edge, the lit wedge fills, a tap stacks, a digit and the cursor each light a wedge and the key up gives it, a page turns and lights nothing, a click on a
  man tints the ring his pair's colour and fires nothing, no console or GPU error) and without it (Tab opens nothing). The hint on the same page, at 960 ×
  540 and at 2560 × 1440 (text factor 1.33): a glyph and outline for the floor, a man (his pair's colour), a wall, a door and the squad's own menu, none
  with Shift down, the glyph 15 px of the ring's own up and right of the cursor and the other way at the view's edge, in the ring's middle once the key is
  down, the cursor 0.8 of the flick out lighting nothing and 1.2 lighting a wedge at both sizes, no console or GPU error. The floor's glyph was redrawn (a
  pin) after that look and has not been seen. Sam's own ring on the same page (960 × 540, Space pressed for real at a shut door): up on the key, his colour,
  two wedges, the cursor lighting the second, the key up easing the leaf, Space again stopping it, no console or GPU error. With the ring off the
  selector probes are all green on the frozen stand; on shipped selector-rows and selector-sustained are red the same way on the untouched build head of
  that hour. NOT seen on the page: Esc, which
  there is the pause — a ring held under the pause card going away on the 'Paused' tick is in the check, by the tick alone. A ring opened near the view's top
  left sits under the squad panel. NEVER seen on a GPU, never played by a hand: whether the hold feels right, whether the ring hides what it is opened on,
  and whether Sam's aim swinging with the cursor matters are the maintainer's to judge. No tally was run: with the switch off nothing moves, and the ring
  gives only orders the menu already gave.
- **A tap of the ring's key opens no ring** (`CMDRING.holdSecs`, 0.2 s, `SquadOrders.cmdPress` in `orders.ts ringInput`; the maintainer after playing
  the ring, 10-20: "let's focus on just single tab for now (the reworked B equivalent)", "it does feel like a bit of a regression from B on a single
  playthrough", "we shouldn't open the radial menu on just a single tab press, only after some (very short) delay"). THE RULE: the key going down opens
  nothing. It remembers what the cursor was on (`cmdPress.t`) and the cursor hint's outline goes as bright as the ring's, so the press is seen to land
  (`hintView().press`; the glyph stays beside the cursor). Let go inside `holdSecs`, the quick key's own order is given on that thing (`quickGive`:
  B's order, word for word, the autopilot's pick included) and no menu was ever up. Still down when the hold is over, the ring goes up for that thing,
  at the cursor where it now is, and the cursor counts at once (the hold was the wait; `tapSecs` guards a tap only with the hold at 0). WHAT THE TAP
  NO LONGER LOSES, each a way the first build's tap could differ from B: a ring was opened and shut for it (a flash, and a tap slower than `tapSecs`
  with the hand moving lit another wedge and gave THAT order); a left click inside it put the ring away and gave nothing (now it is his trigger, and
  the order still goes); a menu that would not open on the thing gave nothing; Shift down refused the key (his sprint: now only when plan mode is on,
  whose toggle Shift + the key is, `ringFree`). Another key going down inside the tap never loses it either (Space, the menu's key); only the RING is
  not put up over a menu, a list or a running verb when the hold ends. SWITCH: the knob is in the ring's own table, so it rides the ring's switch
  (`?cmd`; both stands off). `holdSecs` 0 = the ring the frame the key goes down, as first built; `journal.ts applyKnobs` sets 0 for a recording whose
  table has no `holdSecs`, and `ringRestore` clears a press a load finds. WHAT `?cmd` RAISES NOW: the Tab key, its hint and Space's ring, as before;
  NOT plan mode, which is `?cmd&cmdplan` (with it on, Shift + Tab is the toggle, so a tap made at a sprint orders nothing: the reason it left the
  default while the single key is being got right). CHECK: `cmdring-check.ts` lines 15 to 19 through the game's own input (a tap held 10 of the 12
  frames shows no ring, no menu and nothing listed, the hint pressed, and gives 'move' on the key up with no ring ever opened · the cursor swept 330 px
  with a left click inside the tap, and the menu's key inside another: the order goes to where the key went down · kept down: nothing at 11 frames,
  then the ring for the spot the key went down on, at the cursor 184 px on, wedge 2 lit by the flick and given on the key up · Shift down orders with
  plan mode off and toggles that mode with it on · the hold at 0 is the ring at once, and a recording with no `holdSecs` applies 0); `planmode-check`
  line 2 keeps the key down past the hold. SEEN: 22 of 22 on both stands, one seed; `CMDRING_BREAK=1` fails 18 of 22 on both. NEVER seen on a GPU and
  never played: whether 0.2 s is the right hold, and whether an order on the key coming UP (not going down, as B's is) is quick enough to feel like B,
  are the maintainer's to say. No tally run: the switch is off on both stands.
- **Q is the squad's command key; B gives nothing; Tab is the page's again** (`KEYMAP.qCmd`, `MOVED`, `cmdOnQ()` in `src/host/keymap.ts`; the
  maintainer, 10-21, once walking into a wall had made the wall hold's key spare: "snapping feels good, we can remove Q", "let's move the squad command
  button to Q then too", "from tab", "let's unmap B too then", "so it's just Q, and the quick tap should be exactly the same as B, right?"). WHERE IT
  SITS: on the BOARD, nowhere in the game. `ORDERS.quickKey` is still the code 'KeyB', which every recording, tape and tool writes; the board gives that
  code off the Q key and gives nothing off the B key (the quick order's row, id `KeyB`, has `['KeyQ']` for its keys in the build). So a tap of Q IS the
  press B was, by the one read the game has for it: no knob table, no `FROZEN_HOLDS` row, no journal key, and both stands (whose Input has no keyboard)
  are as they were. The row keeps its id, so a table kept before with the command on another key means what it meant, and its cap in the build's words
  stays 'B': `keyText` / `keyCap` turn 'B on the blue door', the key card's 'X · B · T · F' and the HUD's cap into the key it is on. No row was added
  and the wall hold's cap is still 'Q'. ONLY WITH `qFree`: `?qfree=0` (Q the wall's) leaves the command on B. `?bkey` = the command on B for a visit.
  `?keybinds=0` leaves it on Q (the build's own board). Q NEVER MEANS TWO THINGS: while the command has Q the wall hold does not fall back to Q when
  walking in is switched off (`freeNow()` ignores `freeWhen`); it then has no key until the player gives it one in Options ▸ Controls, and the walk-in
  row's line says so. Q GIVEN TO ANOTHER ROW (the wall hold by hand, or a table kept while Q was spare with Reload on it) leaves the command on B, its own code's key, as it
  was before the move; nothing is kept for that, so it is on Q again when that row moves away, and on no key only when B is held too (`keysNow`). The command put back on B by hand is kept
  as he set it, like a freed row, and Reset is Q again. THE RING'S KEY (`CMDRING.key`) is the command's own code and no longer Tab: under `?cmd` a tap
  of Q gives the order as the key comes up (inside `holdSecs`, the one way it differs from the plain key, which gives it as the key goes down), Q kept
  down opens the ring, and plan mode's toggle (`?cmd&cmdplan`) is Shift + Q. Where the bullets above say Tab for the ring's key, read the command key;
  `main.ts` gives Tab back to `ui/tabkey.ts` and the back key. THE MARK AT THE CURSOR IS A GAME SETTING (`CMDRING.hint`; the maintainer of the glyph
  and outline that were always there with the ring on: "I don't really like the always on icon", "we can make the always on icon a game setting"): OFF
  unless chosen, a row in Options ▸ Game ('Order mark at the cursor') kept on the machine (`twopointsix.options`, `cmdhint`), `?cmdhint` for a visit,
  with the ring or without (`hintView` no longer waits on `CMDRING.on`). Off, the outline and glyph show only while the ring's key is down and in the
  ring's middle. HIS QUESTION, whether overlays stay longer after a tap: the plan a quick order draws is the same stamped row either way
  (`AUTOPILOT.showSecs`, `floorplan.ts showSecsOf`), 4.0 s after the quick key and 4.0 s after a tap by `cmdring-check.ts` line 21; what stayed was
  that always-on mark under a resting cursor. CHECKS: `tools/qa/qkey-check.ts` (`probes.ts qkey`, families squadorders and player; `QKEY_BREAK=1` =
  the board as it was, every line fails), 5 of 5 on both stands: the boot and its three words · Q gives 'KeyB', B gives '', no other key moved, the
  wall hold keyless with the walk-in on or off · the words · his own keys (back on B and kept, Reset, an old table, Q given to another row, 2,563 moves by a
  die with no key on two rows) · THE GAME on this stand, the room clear with four: the floor, a door, the door again once stacked, the floor, once
  with the code written straight in and once off the Q key through `game/input.ts`'s own listeners, leave the same four rows to the millisecond
  (move, stack, bangClear, move) and one run digest, and the B key files nothing. `cmdring-check.ts` 25 of 25 on both stands (lines 20 to 22 are
  new: Tab gives nothing, the plan's time, the mark with the ring off; `CMDRING_BREAK=1` fails 17) and `planmode-check.ts` 28 of 28 on both.
  `keybinds-check.ts` asks the wall hold's rule by itself, the command left on B (its boots add `bkey`), 13 of 13 on both stands; the last three
  lines of `keybinds-page.cjs` were given `bkey` the same way and that page tool was NOT rerun. ON THE PAGE, real keys, headless Chromium on the
  software adapter, three loads of the four-man room clear with no console or GPU error: plain, Tab and B give nothing, Q down is 'move' in the order
  book on that frame, no mark at the cursor, the HUD's cap reads Q · `?cmd`, Q down shows the pressed mark and gives nothing, Q up gives 'move', Q kept
  down opens the ring and gives the lit wedge · `?cmdhint`, the mark is at the cursor with no ring. NOT DONE: nobody has played it; never seen on a
  GPU; the Options row was not clicked in a browser.
- **Q on a door, then F, with one or two teammates** (`DOORTOOLS.wordSmall`, `?wordsmall=0`): the word's key sends a small squad in from a plain
  stack as it does the four — the rule, its edges and its check are the door tools' bullet "The word sends a small squad in from its stack"
  (`docs/agents/door-tools.md`). Q on the stacked door again is still the squad's own pick of entry.
- **A man back from the fight walks for where his order stands: ON IN THE PAGE since 10-22** (`ORDERS.retakeGoal`, `orders.ts tick`; `?retakegoal=0` ·
  `TPS_RETAKEGOAL=1`; OFF in the module and on the frozen stand, a `FROZEN_HOLDS` row, the journal turns it off for a recording from before the key;
  debugger: Player, doors & props ▸ 'back from a fight: walks for his place'). A find of the code review: back on his order a man is handed the way
  from where the fight left him, but his goal was left alone, so with the new way straight he walked to a corner of the way he was on before, stood on
  it, and after `stuckSecs` said he could not get through, his order marked stopped short. On: his goal is the new way's first corner, or his place.
  It moves walks after a fight, so it is a switch. CHECK: `probes.ts retake` (tools/qa/retake-check.ts, family squadorders; 4 lines, both stands;
  `RETAKE_BREAK=1` fails the walk line: all four stand at the old corner five to seven metres off their places). The rig writes the corner into each
  man's way by hand and hands him to the fight by its own seam (`endGuardScript(gd, 'alert')`). NOT measured: how often play meets it; no tally was run
  with it on; nobody has played it; never seen on a GPU.
- **A cover's and an arc hold's squad row carry no compass word while the dialogue pass is on** (`orders.ts` the cover order and the hold's arc; no new
  switch: it follows `WORDS.on`, on in the page, off on the frozen stand). The rows read 'covering west' and 'holding · east' on the HUD, where no
  compass word belongs, and `orders-cover` pinned it. Now: 'covering <the place watched, by the level's own name>' or 'covering that way'; 'holding ·
  <the place>' or 'holding' (`dialogue.ts watchedPlace`). With the pass off the rows are as they were. Row words are in no digest. `orders-cover` and
  `squadplay`'s hold line read the stand; line 3 of `probes.ts retake` asks both ways.
- **A longer press of Q is the orders ring and it stays up; Shift + Q is plan mode: ON IN THE PAGE since 10-22** (`CMDRING.on`, `stay`,
  `stayHoldSecs`, `tapNow`, `plan`, `planRts`, `planRun` in `src/game/cmdring.ts`; `ringLatch`, `ringHoldSecs` there; `orders.ts ringInput`,
  `planmode.ts planShift`; the maintainer, 10-22: "longer press for Q opens up squad, doesn't require holding it", "shift Q for plan mode"). The ring and
  plan mode are no longer behind `?cmd`. WHAT THE KEY DOES NOW: let go inside the hold it is the quick order, the same order as before, filed as the
  key comes UP (it was filed as the key went down: a tap's own length later, the price of telling a tap from a hold); kept down `stayHoldSecs` (0.3 s,
  in place of the 0.2 of the ring that goes with its key) the order menu goes up as a ring at the cursor and STAYS when the key comes up. Left up: a
  digit 1 to 5 gives its wedge at once (a page's wedge turns the ring), a left click anywhere but on a man gives the lit wedge and is not Sam's
  trigger (a click with nothing lit, a page just turned, gives nothing), the key again gives the lit wedge, a right click steps a page back or puts
  the ring away, the back key (Tab on the page; only a ring that stays: one that goes with its key hears Esc alone, as it was built) puts it away,
  and so do Esc where it reaches the game, the pause and a lost window. Kept down,
  taken out to a wedge and let go, the key still gives that wedge (`ringLatch`: one rule a second ring can read; Space's own ring is not latched by
  this change). Plan mode's ring on the right button is not latched. A DIGIT INSIDE THE PRESS (`stayDigit`, on with `stay`, off with it; a read from
  the squad lessons: for the 0.3 s of the hold a quick "Q, 2" was the rifle's slot and opened its setup): a digit 1 to 5 going down while the key is
  still down inside its hold puts the ring up at once and gives that digit's wedge; it is never the gun's slot. A tap let go before the digit is
  still a tap and the digit after it is the gun's; where no ring can go up the digit stays the gun's. `FROZEN_HOLDS` row `CMDRING.stayDigit`
  (`TPS_QSTAY=1`); a recording with no such key replays with it off; line 8b of `qring`. `tapNow`: a press already up in its own tick (down and up inside one tick, and
  every one-frame press a headless line makes) is given on that tick, so lines that press the quick key for one frame read as they did. SHIFT + Q
  toggles plan mode (as `?cmd&cmdplan` had it, Sam parked and the view on the walk keys) EXCEPT out of a sprint (`planRun`): Shift with a walk key down
  and the mode down is his run, and Q there is the quick order as at a walk; with the mode up Shift + Q leaves it whatever else is down, and so does
  the back key once nothing nearer is up to back out of, a menu, a ring, a Space list, a running verb or the launcher's arc (`SquadOrders.planBack`,
  `backFree`, `Game.backable`; the page's own Esc the same way, last in `Game.escape`). SWITCHES: ON in the page; `?qring=0` = the key as it was (its
  order as it goes down, no ring, no plan mode), `?qstay=0` = the ring only while the key is down, given as it comes up, `?qplan=0` (or `?nocmdplan`)
  = no plan mode; `?cmd` now only raises Space's own ring (`CMDRING.hands`) beside it. OFF in the module and on the frozen stand: `FROZEN_HOLDS` rows
  `CMDRING.on` / `tapNow` (`TPS_QRING=1`), `stay` (`TPS_QSTAY=1`), `plan` / `planRts` / `planRun` (`TPS_QPLAN=1`; the last two words need the first). The
  journal carries the table: a recording with no `stay` / `tapNow` / `planRun` key replays with them off. Debugger: Team feel ▸ 'Tab ▸ the orders ring',
  '… ▸ stays up without the key', '… ▸ plan mode'. CHECK: `probes.ts qring` (tools/qa/qring-check.ts, family squadorders; 15 lines; `QRING_BREAK=1`
  fails 12 on the page's stand and 11 on the frozen), both stands. The older `cmdring` and `planmode` checks pin the ring that goes with its key and
  Shift always the mode's (25 and 28 lines, both stands); `qkey`'s game line reads the stand (the order on the tick the key is seen up, with the ring
  on). A LOADED MEMORY SAVE (a squad on the floor: `savestate.ts loadMem`) puts a ring that stood in it away and plan mode down, he on his feet
  (`orders.ts loaded`, `planmode.ts planLoaded`; the men's chains go on as saved): brought back, the ring took the next click for a wedge. Line 10b of
  `qring`, both stands; `QLOAD_BREAK=1` fails it. DRAWN: the status column (`#interact`) goes faint while the ring's words lie over it (`ui/cmdring.ts clear`, `body.ringover`; no switch: a ring
  put up on a door near that corner was read through the column's plates). DRIVEN ON THE PAGE (headless Chromium, the software adapter, real key and
  pointer presses, a four, a duo and every new switch off; no console or GPU error): the floor's ring and its throws, the door's ring, its tools and
  'more', each right click back a ring, plan mode's knee, pan, right drag, a hold and a door's wait off and on, an early word not kept, the word, Tab
  and the view's ease back. NOT measured: no tally (the play-through's commander presses no key); nobody has played it; never seen on a GPU.
- **The ring stays on its point; the key on a door is dark until it is live (10-22, from the maintainer's play of the first tutorial mission).**
  THE RING (`CMDRING.pin`, `cmdring.ts ringPin`, `orders.ts ringUp` / `ringInput`; "radial menu should stick on the point for the action, not move
  with the camera"): a ring keeps its place over the thing it was opened on (the target's `at`, and where the ring's middle stood from it) as the
  view moves, still whole inside the view's edge; a cursor the hand has not moved lights no other wedge, so a ring sliding under a cursor at rest
  changes nothing. ON in the page, `?ringpin=0` = it stays where it was opened on the screen; OFF in the module and on the frozen stand
  (`FROZEN_HOLDS` `CMDRING.pin`, `TPS_RINGPIN=1`, needs `TPS_QRING=1`); a recording with no `pin` key replays with it off; debugger: Team feel ▸
  'Tab ▸ the ring ▸ stays on its point'. Line 8c of `probes.ts qring` (he walks with the ring up: it stands within 2 px of its place, lit wedge
  unchanged, nothing told, a digit still gives), `RINGPIN_BREAK=1` fails it, both stands. Plan mode's ring on the right button is pinned the same
  way; the ring on E (handring.ts) is not. Its place from its point is the CURSOR's when it came up (not where the view's edge stood it: the edge
  is asked again every tick, so a ring opened in a corner stays whole in the corner). The game works the place out before the tick's camera step,
  so the page draws it from the picture's own camera (`ui/cmdring.ts pinned`; the game's `ax` / `ay`, a tick old, still decide the wedge under the
  cursor). `probes.ts cmdring` asked "at the cursor" some ticks after the key: on the page's stand its lines 1 and 17 now ask that it stands on its
  point's place (`astray`), and say how far that is from the cursor. Known: the view leads toward the cursor (`camera.ts aimLead`), so the ring
  shifts a little as the cursor goes out to a wedge; a ring put up right after a fast sweep of the cursor ends some px off it as the view
  finishes easing (25 px after the check's instant jump; a cursor at rest lights nothing); and it can slide under the weapon panel as he walks. Driven on the real page (headless
  Chromium, the software adapter): he walked with the ring up and it moved 45 px with the floor, a digit then gave its wedge; never seen on a GPU.
  THE QUIET PAIR'S MARK FOLLOWS THE SAME RULE (10-22; the maintainer in the pair's tutorial mission, the order just given: "what is F here"): the key
  a step ahead of a man who waits on the word was lit from the order on (`ready: true`), and its bar ran through the cap, so it read as a key struck
  out, at a step where the lesson had not taught the word. Now its `ready` is the man's own 'set' (or held for a watcher: the press sends him anyway),
  so the cap is DARK while he works round and LIT when he is set; `ui/planfloor.ts` draws no bar for `why: 'pair'` (there is no doorway under it); and
  a lesson that still holds the word shut (`rails.locks('word')`) lists no pair mark at all. No switch of its own: it rides on `PLAN.keyLit` and
  `RAILS.on`; picture only, no digest moves. `plan-check` line 16 has a second line for it (dark just ordered, lit when set, none under a lesson's
  lock; both stands), and the pair mission's scripted player fails if the mark is up before its `word` step or not ready at it. Never seen on a GPU.
  THE KEY'S CAP (`PLAN.keyLit`, `floorplan.ts capOf`, `PlanDoor.ready`, `ui/planfloor.ts`, `.plan .lit` in index.html; "need some indicator on the
  F on the door when it's queued vs live. maybe black background to lighting up to yellow background"): a stack waits on the word from the moment
  it is ordered, so the cap was on the door at once and looked the same walking or stood. Now every door that waits on the key carries its cap:
  DARK while its men are still on their way (their feet not on their places, or a fight has them) or while the press would not send it, LIT in
  their colour once they stand there and the press sends them. A picture only, on on both stands like the rest of `PLAN`; `?keylit=0` = the cap
  only on the door the key would send now, on its plate; debugger: 'plan ▸ the key on a door is dark until it is live'. Line 6b' of `probes.ts
  plan`, `KEYLIT_BREAK=1` fails it, both stands. Driven on the real page (the same drive): the cap read near black with a dim F while the four
  walked to a door, and their colour with a dark F once all four stood. NOT measured; nobody has played either; never seen on a GPU.
- **Q and F are the squad's only keys; the ring carries every order: ON IN THE PAGE since 10-22** (`CMDRING.only`, `ringSeats` in
  `src/game/cmdring.ts`; `orders.ts seats`, `ringInput`, `ringView`; `KEYMAP.qOnly`, `DROPPED` in `src/host/keymap.ts`; the maintainer, 10-22: "squad is
  now just q and f. everything is through the radial menu (which is 1-5? is that sufficient) so we don't need all the other keys"). IS 1 TO 5 ENOUGH:
  every ring fitted five wedges but two, a floor's (move, cover, fall in, hold, go silent, and throw there on G) and the door tools' (four tools, frag
  and clear on G, the big slot's tool on H). THE SEATS: a row with a digit keeps its wedge; a row that had a letter of its own takes a spare wedge of
  its page; where a page has more such rows than spare wedges its last spare wedge is 'more', a ring of the rest seated from wedge 1 (no wedge spare:
  the last wedge is 'more' and its own row leads the rest, which is what a wall's ring does with 'wall tools' and 'throw there'). A right click on
  'more' is the page it is the rest of. Left out of a ring: the word's own rows (F gives them). On a place's ring the squad's posture rows (go
  silent / go loud) come last and only onto a wedge nothing else wants (a floor with no throws to order keeps go silent on 5, which is what the quiet
  pair's lesson teaches); they never make a 'more', and they are always on the ring opened on Sam himself or on a teammate. A first page's wedge 1 is
  the quick order's and never a spare. A row that comes or goes under an open ring (a carrier down) re-seats the wedges and puts the light out, so the
  next click cannot give a row the hand did not light. So a floor's fifth wedge is the throws, the door tools' fifth is
  frag and clear for a pair and 'more' (the big tool, frag and clear) for the four. 'Wait for my word' has no wedge and never had: the command key
  stacks them, they wait, and the word or a tool from the ring sends them. WHAT IS NOBODY'S: while a ring is up a row's own letter (G, H, V) is taken
  and does nothing; the middle button opens no menu; the squad panel lists no key for the menu and none for who. THE BOARD (the page only): the
  orders menu's row (code 'KeyX') and the who row ('KeyT') have no key, the way the wall hold's has none; the game's reads of both codes stand, so
  every recording and every headless line that presses them reads as it did, and Options ▸ Controls can put either back on a key. Who an order goes
  to is the ring's wheel or a click on a man with the ring up, or plan mode's picks. SWITCHES: ON in the page with the ring; `?qonly=0` = the wedges
  and the letters as they were and X and T back on the board (`?qring=0` the same, with the ring gone). OFF in the module and on the frozen stand:
  `FROZEN_HOLDS` row `CMDRING.only` (`TPS_QONLY=1`, needs `TPS_QRING=1`); the journal carries the table, a recording with no `only` key replays with
  it off. Debugger: Team feel ▸ 'Tab ▸ the ring ▸ carries every order'. CHECK: `probes.ts qonly` (tools/qa/qonly-check.ts, family squadorders; 10
  lines; `QONLY_BREAK=1` fails 8 on the page's stand and 7 on the frozen), both stands; `qkey`'s board line knows the two freed rows. The older ring
  checks pin `only` off. KNOWN COSTS: a door with a look-under row (a wand carried) has six first-page rows, so its fifth wedge is 'more' holding
  'door tools' and the look, one ring deeper; a line of words that names the orders key (a lesson's 'X on the ground, then 5') reads 'hold Q …' ('Hold Q …' at the start of a sentence or a line, plain 'Q' after a 'hold' already written, 'Q held' after 'with'; `keymap.ts rebuild` and `keyText`; `qonly`'s board
  line), but lines that name T (the pairs lesson's three steps, a kit card's note) are not rewritten and are stale while the row has no key, and
  the Controls list still says 'or the middle mouse button' on a row that reads as no key; THE WORD FREES WHOEVER WAITS (`doortools.ts wordMen`; the maintainer: "pressing F only releases the people blocked on it"): with the orders going to
  men who are not waiting on it, F goes to the men who are, and the squad block offers the key for them ('F go · blue waiting' where it read 'blue
  waiting · T, then F'; `squadplay-go` reads the stand: red in, the orders still red's, F sends blue). A press while the chosen men still walk and
  another pair waits therefore sends the pair that waits. THE PLAN'S KEY MARK FOLLOWS (`floorplan.ts waitsOnKey` asks `wordMen`, not the orders' own
  men: the door's mark said no key while the key sent them; `probes.ts plan` lines 6c read the stand, red on the page's stand until this). The
  ring on Sam shows 'fall in' twice (the quick order's wedge and its own); with the quick throw's own switch on (off in the page) G held under a ring
  still starts Sam's own throw. The older menu's probes (`orders-probes`, `orderui-probes`, `pressorders-probes`) pin `only` off in their rigs. NOT measured: no tally; nobody has played it; never
  seen on a GPU.
- **Plan mode: a way to look, its own waits, the knee at the radio: ON IN THE PAGE since 10-22** (`src/game/planmode.ts`; three switches, each OFF in
  the module and on the frozen stand, each needing plan mode). (1) `CMDRING.planLook` (`?planlook=0` · `TPS_PLANLOOK=1`; the maintainer: "you should
  be able to right click drag on a path and have them check that direction, like door kickers" · "if they're given an angle while not moving, they
  should probably just cover that" · "we expect squad mates to be very smart on their own and not need micromanaging like this"): a right press
  dragged `planLookPx` (24, three times a left drag's `planDragPx`: a trackpad's click slides) is an order with a way. Down on the floor: the click's own order, its stop keeps the way (drawn as an arrow), the men cover
  that way once they stand there (`orders.ts coverFor`: the plain 'cover' order on a point `planLookM` out), and a chain with more stops walks on
  after `planLookSecs` (phase 'look'). Down on a man, on Sam or on nothing: nobody walks, the man (the picked men) cover that way where they stand, the way measured from
  where THEY stand to where the button came up. With Shift, off a man who is on a plan: nobody is taken off it and its last floor stop keeps the way
  (men already stood on their last stop turn now). A stop whose cover every man refuses (a wall at each shoulder) is not waited at.
  On a door, a thing, a man of the other side, or let go within half a metre: the plain click. A drag never opens the button's ring. (2)
  `CMDRING.planWaits` (`?planwaits=0` · `TPS_PLANWAITS=1`; "let's also make it possible to add and remove F waits in the plan. and then I think we
  can change the flow to be that pressing F only releases the people blocked on it"): a left click on a stop (within `planStopPx`) steps its waits
  instead of picking men. A floor stop: a hold there, on and off. A chain's last door: its threshold wait, on and off. A door with stops after it:
  both, the threshold's alone, the one after alone, neither. A wait taken off under men stood on it lets them go at once; taken off a door they
  cannot go through (locked: refused at once, or tried and given up) it is back on with its mark; a hold put on while the men look a way is kept. The word frees only men stood waiting on it: a press while they walk is theirs (the stack's
  own early word does not get it) and is not kept, and `planLate` keeps nothing. (3) `CMDRING.planKnee` (`?planknee=0` · `TPS_PLANKNEE=1`, needs the
  view's own switch `planRts`; "plan mode should also show the player taking a knee and talking on the radio, and then camera can decouple from them
  and move (up to some limit) with wasd and then gently snap back when exiting the mode"): the mode up, he crouches (his real crouch: lower to a
  round and to an eye), the long gun low, the left hand at the handset (`player.ts`, `anim.radio`); the mode down by any road (the key, a restart with it up, the last man lost: `planTorn`), he stands again if he stood before
  and there is room; no knee while he is down, drags a body, holds a man, or is in a takedown or a kick (`planKnee`), and the view comes back to him over `planBackSecs` on a smoothstep (`planLook`, `PlanState.back`, in the snapshot) instead of on
  the follow camera's own damping. The reach was already there (`planPanReachM` from the box of Sam and the men). `FROZEN_HOLDS` rows
  `CMDRING.planLook` / `planWaits` / `planKnee`; the journal carries them, a recording with none replays with them off. Debugger: Team feel ▸ 'Tab ▸
  plan mode ▸ a right drag sets where they look' / '… its waits are the plan's own' / '… he takes a knee at the radio'. CHECK: `probes.ts planplus`
  (tools/qa/planplus-check.ts, family squadorders; 18 lines, the real buttons and keys on the office with four, the view walked to each door first; `PLANPLUS_BREAK=1` fails
  16), both stands. A door the men do not hold a stack at on a stand (the break room's two on the page's, an old red of `orders-stack`) is passed over
  for the next and the line says so. KNOWN COSTS: a click on a stop no longer picks the man stood on it (click beside it); a door with its wait off still stops if the entry is
  refused; the cover a look gives stands until the next order, as any cover does; the knee makes him a smaller target for as long as the mode is up.
  NOT measured: no tally, one seed; whether men on a path cover an obvious way by themselves was not judged; nobody has played it; never seen on a GPU.
- **An order's line starts on the leg he is on** (`floorplan.ts wayOf`; picture only, no switch). A way kept from a stride ago starts behind the
  man, so its line began "from the corner nearest him" of its first six: on a way that doubles back that skipped the corners between and the line cut
  the wall. Now from the end of the leg he is nearest on, looked for over the way's first two metres (`Leg.from` is where it was asked), the same way
  `attention.ts attentionWay` draws a guard's thread. Checked by `probes.ts plan` on both stands; the doubling-back case itself has no line of its own
  here (the attention thread's check plays it for its copy). THE KEPT LEGS ARE THE ASKER'S (2026-10-23): `floorplan.legs` was a side table of the game and its search ran on the
  grid's own tables, so a game drawn and one not drawn differed in the full state hash. Now `floorPlan(g, kept)` takes the asker's own store
  (`PlanKept`: the overlay's in `ui/planfloor.ts`, a check's own from `planKept()`; with none, nothing is kept past the one ask) and searches with
  `NavGrid.findPathAside` on that store's tables; the module keeps nothing. `probes.ts plan` line 9 asks every frame, once as he walks and once with
  his own path set aside so the grid is asked, and holds the run's digest AND its whole state (`stateHash`) equal to the run never asked: red on the
  code before ("whole state DIFFERS") and with `PLANKEPT_BREAK=1` (the search put back on the grid's own tables), green on both stands. A kept leg is
  used again only when asked from within 2.5 m of where it was asked (the store is outside the rollback snapshot: a restore leaves it an answer from
  the other time line). STILL OPEN, not this module's: with the THROW PAGE up `floorPlan` reads `squadthrow.ts squadThrowPlans`, whose `view`
  question keeps its answer in that module's own table and searches on the game's, so a game drawn and one not drawn still differ in the whole
  state there (digest equal); line 9 does not play the throw page. Never seen on a GPU.
- **Plan mode reaches one room, not the level** (`CMDRING.planNear`, `planNearSideM` 6.5 / `planNearAwayM` 4.5 / `planNearBackM` 6;
  `planmode.ts pan / planNear`; ON in the page with the mode and its RTS view, `?plannear=0`; off in the module and on the frozen stand,
  `TPS_PLANNEAR=1` beside `TPS_QRING=1 TPS_QPLAN=1`; the journal carries it, a recording without the key replays with it off; debugger: 'Tab ▸ plan
  mode ▸ the view stays near you'). The maintainer, 2026-10-23: "balancing plan mode: it's too easy to just play this like an RTS. we should instead
  make it so you can only move a bounded amount from the player. like maybe the player has to roughly be on screen but can be in a corner. the mental
  model is that it should be good for clearing one room but not the whole level. and we should design things so there's not always a safe place for
  the player to hide and command, it's really a situational thing."
  WAS: the view's point went `planPanReachM` (25 m) outside the box Sam AND the men stand in, so it followed the men down the level. NOW: it stays
  where SAM IS STILL ON THE SCREEN: a box round him in the camera's own basis, at the camera's own distance 6.5 m to either side, 4.5 m with the view
  pushed up the screen (he is at the bottom) and 6 m with it pulled down (he is at the top). He is parked while the mode is up, so the box does not
  move; at an edge the view stops going out and slides along it, and in a corner of the box he is in a corner of the screen (the harness's 1600 x
  1000 view: his feet 92 px in and 99 px up at the bottom corners, 97 px down at the top). ZOOMED IN the box shrinks with the camera's distance
  (less 1.4 m kept for his own height at the top edge), so he stays on the screen; ZOOMED OUT it does not grow. A view found outside the box (a
  file from before, a frame's lock let go) is walked in at twice the pan's speed, never jumped. No mark is drawn for the edge. To plan further
  on he puts the mode down and walks. NOT HELD where a tutorial frame has taken his feet (rails `move` locked: he cannot walk nearer), so the plan
  mission (`tut-plan`, led from the gate with no feet) plays as it did: 19 of 19 steps by its scripted player on the page's stand with the rule
  on. That mission's hall and two gates are 19 m from where he is parked and its guardroom view asks for 5.5 m, so to hold the bound it would
  have to walk him or move him between its parts, and until it does the lesson teaches a reach the game no longer has (its thread's, and the
  maintainer's call). SINCE 10-23 IT WALKS HIM (the maintainer's pick, "You walk to each spot, then plan"): three walk steps, his feet from the first
  of them, and the bound holds there from that step on (`docs/agents/missions.md`, the plan mission's "He walks to three spots"). NOT BOUNDED: where an order may be given (anything on the screen takes a right click: from an edge about 15 m from him at
  the camera's own distance, about 22 m zoomed all the way out), chains already laid (they walk on and the word still frees them wherever they
  wait) and a mark of the plan outside the view (it is off the screen). CHECK `probes.ts plannear` (9 lines, both stands, one deal: the rule has
  no die in it; `PLANNEAR_BREAK=1` fails lines 1, 2, 3, 4 and 6 on both): a walk key for five seconds and a second key to the corner; all eight
  ways out with his feet and head on the screen; the camera at 12 and at 40; the men put 30 m off; the frame's lock and the walk back in; a view
  filed further out; a right click from a corner and the ease back; the journal; the stands. `planmode-check`'s rig holds the rule off (its lines
  19 and 21 ask the reach as first built), so `planmode` and `planplus` do not play it. THE LEVEL HALF of his note (no place that is always safe
  to command from) is not built here: it is level design, for the level skill and the missions. Nobody has played it; never seen on a GPU.
- **The squad's ring is two rings deep and nothing rides the cursor** (2026-10-23; `CMDRING.flat` / `plainHint`; `cmdring.ts flatSeats`,
  `FLAT_TOP`, `FLAT_LEFT`; `orders.ts flatRows`, `menuRows`, `seats`, `hintView`, `OrderDef.gone`). The maintainer: "radial menu tree needs some
  work, way too nested"; "loud and quiet should be an option on squad wheel"; "let's remove the icons on mouse position from squad orders
  entirely". BOTH: ON in the page (`flat` with `only`), `?ringflat=0` / `?plainhint=0`; off in the module and on the frozen stand,
  `TPS_RINGFLAT=1` (beside `TPS_QRING=1 TPS_QONLY=1`) / `TPS_PLAINHINT=1`; a tick each in the debugger; a recording from before the keys replays
  with them off. THE TREE (`flat`): the ring holds every order of the thing under the cursor, never a page. Floor, wall, a thing: 1 what a tap
  gives · 2 cover that way · 3 fall in · 4 hold position · 5 more (frag there · bang there · a wall charge when the squad carries one · go
  silent). A door: 1 what a tap gives · 2 cover this door · 3 open and clear · 4 bang and clear · 5 more (charge, or shut that door · clear from
  outside · shotgun and clear · frag and clear · go silent); fall in and hold position are NOT on a door's ring. The squad's own ring (on a man,
  on Sam, on nothing): 1 fall in · 4 hold position · 5 go silent. An enemy: no ring, as before. Rules: a row that says what wedge 1 says has no
  wedge of its own and its digit is wedge 1's (`seats().same`: 3 is still fall in on the squad's own ring; stacked on a door the entry the squad
  would pick is on 1 only); no ring has one row (a lone left-over sits on wedge 5 itself); a row for kit the squad never carried or a tool this
  door never takes is not offered (`gone`: a wall charge with none brought, a charge or the big slot's tool on steel, the big slot's tool on an
  open door), one off only for now stays greyed; the posture row is the last of every second ring and gives up its place first when rows
  overflow. No key sets loud or quiet, before or now. A TUTORIAL MISSION (rails live) KEEPS THE PAGED TREE: its lines name the old digits
  ("[X], then press [3]", "Press [5], then [3]"), the tutorial's own to move. THE CURSOR (`plainHint`): the outline on the floor of what the
  key orders on, no glyph beside the cursor or in the ring's middle. AND NO OUTLINE (`CMDRING.bareHint`, later the same day, his play note at
  a wall with the ring up: "the line and circle are weird, don't need them"): `hintView` answers null, so nothing of the squad's cursor mark is
  drawn, at rest, with the key down or under a ring; ON in the page, `?barehint=0`; off in the module and on the frozen stand, `TPS_BAREHINT=1`;
  a tick; the journal; ringflat lines 9 and 9b; `cmdring-check` holds it off in its rig; the Options row "Order mark at the cursor" is not
  listed while it is on. What a tap orders, and on what, is then only the corner's line on the key. THE SQUAD'S CORNER cut down to its key lines (his same notes) is NOT here:
  it is the page's own layer's, which reads `orders.hud()` whole, so the order book's lines are as they were. CHECK `probes.ts ringflat`
  (family squadorders; 12 lines, both stands, one deal seed 3: the rules have no die in them; `RINGFLAT_BREAK=1` fails lines 1 to 6 and 9 on
  both). `qonly-check` holds `flat` off in its rig (its lines ask the ring by the menu's pages). Neighbours' files touched for it:
  `wallcharge.ts`, `doortools.ts` (the `gone` rows), `squadthrow.ts` (the throw's arc on a flat ring), `ui/cmdring.ts` (one line, the glyph),
  `ui/options.ts` (the hint's words). Nobody has played it; never seen on a GPU.
- **A held door's key lights when the men say so** (2026-10-23; `PLAN.thrTold`, `floorplan.ts waitsOnKey` / `PlanDoor.ready`; picture only, on on
  both stands like `PLAN.keyLit`, `?thrtold=0`, a tick in the debugger). Found by the squad's own behaviour work: on a door held from outside the
  word pressed before the men's "holding · on your word" call cuts their slice of the room short, and the key's cap was lit from the moment their
  feet were on the jambs. Now that cap is dark until `thr.told`, then lit; the key does what it did. CHECK `tools/qa/plan-check.ts`, the last
  line, both stands (one deal, the conference door: dark with feet on the jambs, lit 3.5 to 4.5 s later at the call; `THRTOLD_BREAK=1` red on
  both). NOT covered: the HUD's own word line (`doortools.ts wordNote`, "go · … waiting") still shows from the stack, and several doors on one
  word (`planOne`) wait for every stack to FORM, not for a call. Never seen on a GPU.
- **What the cursor is on is kept by whoever reads the HUD** (2026-10-23; `orders.ts hover / hud / hintView`, `HoverKept`, `ui/hoverkept.ts`; picture
  only, no switch). `hover()`'s answer, kept a tenth of a second while the cursor rests, and the camera it was asked under were fields of the order
  book (`orders.hov`, `orders.hovCam`): a game whose HUD was read each frame differed in the whole state from one never read. Now `hud(kept)` and
  `hintView(kept)` take the asker's store (the page's one store for both, `ui/hoverkept.ts`); with none nothing is kept and every ask looks again.
  CHECK `probes.ts cmdring`, the last line, both stands: read every frame against never read, digest equal, the answer in the store, and no field of
  the order book another value after a read than before it; `HOVERKEPT_BREAK=1` (the book handed in as the store, so kept on it again) is red on
  both. The store is outside the rollback snapshot (after a restore it can hold the other time line's answer for its tenth of a second). The page's
  own wiring (`overlay.ts`, `ui/cmdring.ts` passing the one store) is held by no check and the page was not driven. STILL OPEN, not held by that line and not this module's: a HUD read
  still writes the room clear drill's memo of its two men (`nightbreach.ts drillOf`, a getter that keeps its answer) and the collision world's query
  stamps under the cursor's pick (`game.col.stamp`, `world.rgStamp`), so the whole state still differs (the line prints where). Never seen on a GPU.
  (Both since mended: the drill's memo by its own module, the pick's stamps by the last bullet of this file.)
- **One word is one signal** (`CMDRING.planOne`: ON in the page with the mode, `?planone=0`; off in the module and on the frozen stand,
  `TPS_PLANONE=1` beside `TPS_QPLAN=1`; the journal carries it, a recording without the key replays with it off; debugger: 'Tab ▸ plan mode ▸ one word,
  one signal'). The maintainer, 10-22, of a plan with a pair on each of a room's two doors: "simultaneous breach on mission 2 didn't really work. and
  the second team threw a flashbang when our guys were already on the inside". WAS: `planmode.ts word()` gave every waiting chain its own entry, each its
  own order with its own clock — the pair that had to re-form for its throw was seconds behind the other, whose men were inside when the can came.
  NOW: the entries one press starts (open and clear, bang and clear; two or more) are put on ONE word of the door tools (`doortools.ts oneWord`: the
  four's own `Word`, run by `wordTick`): nobody makes a sound until every stack on it is formed (`wordStack` at most), the cans go first, a door with no
  can keeps its leaf shut for the men behind the can beside it, and they all step in together (`wordIn` at most after the first sound). A press that
  frees ONE door is the entry it always was; a charge the autopilot picks for a door known shut is not on the word; a door that halts at its stack
  (found locked) drops off it and the other goes on. CHECK: `probes.ts onesignal` (tools/qa/onesignal-check.ts, family squadorders; the plan mission's
  own level with its frame off, the guardroom, a pair laid on each door through `planOrder`, the word's own key, played with a can a door and with one
  can to spend), both stands; `PLANONE_BREAK=1` fails line 1. MEASURED (headless, two seeds that play the same, each stand): off, the first men through
  the two doors are 1.2 to 2.8 s apart (2.8 where one door has no can: its pair is inside 2.5 s before the other's can); on, under 0.2 s apart, nobody
  through before the last burst, nobody of ours dazzled. KNOWN COSTS: the press now waits for the slower stack — on the guardroom's front door the pair
  re-forms from a split stack to a file for the throw, about 3 s, and the first man is through 5.7 to 6.6 s after the press on the page's stand (it was
  1.8 to 3.4 s for the quicker door); the two leaves are shoved up to 0.7 s apart on the page's stand (each lead steps to his own handle). NOT
  measured: three stacks on one word, a charge beside it, a locked door on it, a squad of two, any tally or digest; nobody has played it; never seen
  on a GPU.
- **Plan mode, a prototype** (`src/game/planmode.ts`, `CMDRING.plan`; the maintainer's words: an RTS's way with a squad, "for advanced players that
  requires explicitly leaving"; the design: `rebuild/commanding/command-mode.md`). OFF in the module and on BOTH stands (no `FROZEN_HOLDS` row: it is
  not a shipped-on rule); the page raises it only when asked beside the ring (`?cmd&cmdplan`, or the debugger's tick 'Tab ▸ the ring ▸ plan mode on
  Shift+Tab'; `?cmd` alone was enough until the maintainer's 10-20 word to get the single key right first, the bullet above); the journal turns it off for a recording from before the key; it needs the ring's own switch. SHIFT+TAB TOGGLES IT, where Tab is
  free (with a menu, a Space list, a verb or the launcher's arc to back out of, Tab backs out, Shift or no). WHILE IT IS UP THE MOUSE IS THE SQUAD'S:
  Sam neither fires nor aims (`planAfter`, at the end of `orders.input`, strips both buttons from the tick's copy), and Shift is not his sprint. SAM
  STANDS AND THE VIEW IS THE HAND'S (the maintainer, 10-20: "your player character is stuck, wasd moves the camera around … it should feel like you're
  switching into an RTS mode temporarily"): the walk keys are stripped from the tick's copy too and move `plan.look` instead (`planPanMps`, the
  camera's own basis, no further than `planPanReachM` outside the box he and the men stand in); `Game.followPos()` hands the follow camera that point
  in his place (`planLook`), with no aim lean (host/loop.ts, tools/qa/headless.ts); his aim point is held as it was when the mode went up
  (`plan.aim`, written back over `Game.aimPoint` by `planAfter`), so he goes on facing what he faced; the mode put down, the camera eases back to
  him; a restart or a fresh cast with the mode up starts the view on him again (`planHome`). Every other key is still his. ALL OF THAT, AND THE RIGHT
  BUTTON'S HOLD BELOW, IS `CMDRING.planRts`: off in the module and on both stands, raised by the page with the mode (`?nocmdrts` = the mode as it
  was first built: he walks with it up, the view is on him, a right click orders as it goes down), off for a recording from before the key. LEFT
  BUTTON PICKS: a click on a man (body, or within `manPx` of his feet), Shift click adds or removes him, a drag (past `planDragPx`) boxes men by
  their feet, a click on nothing is everyone. Everyone, a whole pair and one man are kept as the who key's own `who`; any other set is
  `plan.pick` (callsigns), which `recipients()` reads ahead of `who` ONLY when the caller names no `who` (`give(id, t)` and the quick key go to the
  pick; a scenario's `give(id, t, 'all')` never does); T or the ring's click on a man lets it go. RIGHT BUTTON ORDERS, BY STARCRAFT'S RULES: a plain
  right click is `SquadOrders.quickFor(men, t)` — the squad's own choice there (`autoPick`, asked whether or not the quick key's switch is on) —
  and REPLACES the chain those men were on; refused, nothing changes. THE BUTTON IS READ WHEN IT COMES UP (`plan.rmbT`), because KEPT DOWN
  `planHoldSecs` IT IS THE RING ("long right click opens the radial menu"): `SquadOrders.ringByButton` puts the order menu up as the ring at the
  cursor for the picked men (`RingState.rmb`: kept up by that button, no tap guard), the button let go gives the lit wedge — the first is the
  click's own order with its chain (`planOrder`), any other an order by hand — and a left click puts it away. With Shift down the button never
  opens it. Shift + right click ADDS the stop to the end of each chain those men are on
  (men picked out of a bigger chain part from it, keeping its stops; a man on no chain starts one). A CHAIN (`PlanChain`: callsigns, stops written
  down as planlay.ts writes a place, a phase) is given a stop at a time: `go` → at a door `wait` (stacked: `doorTools.waitsOn(...).set`) → the
  word's key → `in` (the entry the squad picks) → no door order has its men any more → with a stop after it `held` until the word's key, else done
  (they hold the room, as ever). An entry given up (a lock: back on their marks) is `wait` again. A stop on the floor is no pause; a thing sent to
  be worked is one, like a room. THE WORD'S KEY (`DOORTOOLS.blowKey`): a chain of the picked men that WAITS takes it ahead of every other reader;
  a press with men still walking to a chained door is kept for that threshold (`spent`: the mark comes off the plan, and the plan shows
  `planShowSecs` with the mode down) only when nothing else could want it (no charge set, nobody stood waiting, no plan laid); a press NOBODY took
  by the end of the door tools' and wall charges' own reads is kept for the next pause (`planLate`, game.ts). An order given any other way (X, the
  ring, B) takes its men off their chains — but a way in given on the door a chain waits at, or the word, is that chain's word. STATE:
  `SquadOrders.plan` (per order book), `planSnapshot` / `planRestore` (savestate.ts files it with the switch on; `restoredT` keeps the chains
  through the fresh cast a load stands up); `PLAN_STATS` is a tally. PICTURE (ui/cmdring.ts `updatePlan`, index.html `.planmode`): a frame round
  the view and PLAN under it, a circle at each man's feet in his pair's colour (bright: picked), the box, each chain as a broken line from its men
  through its stops with the key's cap where it is still to be pressed (lit where they wait now); with the view the hand's, Sam's own ring at
  his feet (solid, gold) and, once the view has left him, a head at the view's edge pointing the way back (`.pself`, `.pe`). CHECK: `bun run tools/qa/planmode-check.ts`
  (`probes.ts planmode`, family squadorders), 28 lines through real keys and buttons on the room clear with four (18: two rooms chained for one pair; 19 to 27: Sam stands and the view
  pans, he faces what he faced, the reach, the right button read as it comes up, kept down the ring, its first wedge the click's own order, Shift
  never opens it, a left click puts it away, the file keeps the view, a restart starts it on him; 28: `planRts` off is the mode as first built);
  `PLANMODE_BREAK=1` fails 27 of 28 on both stands. LIMITS, as built: a chain's stop is always the first wedge (no other row can be chained); a chained 'fall in' is done at
  once; the men of a chain are named when it is laid (a man who joins the pick later is not on it); men who part from a chain while it waits at a
  door go in with the rest on that door's word. With `planRts`: Shift + the button kept down never opens the ring (a chained stop is the first
  wedge's); Sam cannot fire, walk or turn while the mode is up and time is not slowed, so the mode is a risk taken (slowed time on easier modes is
  the maintainer's open call); a throw key pressed with the mode up throws at the aim he held. SEEN: on the page with the software adapter at
  960 × 540, real keys and mouse, no console or GPU errors — the first build's keys, and on 10-20 the RTS's: D and A moved the view and Sam stood
  (his mark went to the view's edge and came back), the cursor swept the view and he did not turn, a right click ordered as the button came up, the
  button kept down put the ring up and its second wedge gave 'cover', the view was walked to a door off his screen with W and A and the ring let go
  there laid the stack as a chain with its key's cap, the mode down brought the view back and he walked. Never seen on a GPU, never played, and no
  tally has been run with it: whether chains beat B is not measured.
- **Who commands best: the three-hands tally** (`tools/qa/command-tally.ts`; his words 10-14: "we should also make it so micromanaging > autopilot commanding > doing it
  yourself", "so there's incentive to go beyond just mashing b"; record rebuild/commanding/read-first.md 'Balance, measured'). NO GAME SWITCH: a tool only.
  The same floor played three ways by scripted players on the SHIPPED stand with the real keys: `solo` (the squad never told anything), `b` (B and nothing else), `plan`
  (orders by hand in X: two doors on one word where a second door is unlocked, within 30 m and reached over floor the team has stood on; else a frag while there is one or
  the last stun on B's stack; else B). Sam's rifle is the same in all three; god mode on, every ROUND on him counted (the caller of his flinch is combat.ts samHit: a stagger,
  a dazzle and a blast play the same flinch and are counted apart). A CLEAN floor = taken with Sam never shot down. Verdict: plan over B = as many clean floors and fewer men
  lost; B over solo = more clean floors. `--hard --scn a,b --seeds 1-16 --jobs 4 --json out.json`, `--trace hand:scn:seed`, `--mortal`; env `CT_NOTOOLS=1`, `CT_ANYDOOR=1`.
  MEASURED 10-14 (hard, 7 four-man room clears x 16 seeds = 112 floors a hand, 0 errors): plan 101 taken, 47 clean, 1.61 men lost a floor, squad wiped on 14, 109 s · b 96
  taken, 32 clean, 2.10, wiped on 32, 101 s · solo 100 taken, 0 clean (9.7 downs a floor), 0.92, 50 s. Held on each half (seeds 1-8: 23 / 16 / 0 clean; 9-16: 24 / 16 / 0).
  By level, clean plan / b: office 14 / 10, killhouse 10 / 9, depot 3 / 3 (the plan loses MORE men there, 2.75 to 1.69: its frag entry on the first room lost 39 men to B's 23
  over 16 rooms), barracks 1 / 0, warehouse 2 / 4, block 11 / 2, compound 6 / 4. The first room of a floor, met in the same state by both (112 rooms): B's entry lost 95 men,
  the frag by hand 68. Two doors on one word were possible on 19 of 112 floors only, and 12 of the 22 men lost in those rooms fell on the walk to the second door. NO TUNING
  was done: the order comes from the autopilot's scope (one door, no frag, its last stun kept). With god mode on, solo is still fastest and loses fewest. LIMITS: scripts, not
  hands; every hand knows which rooms are held and walks to the last men through the fog; a frag that would have killed Sam under god mode is not a down; never played, never
  seen on a GPU. The first counts of 10-14 (before 04:00Z) were from a tool that booked the squad's own stuns as rounds on Sam, dropped rooms the plan was wiped in, picked
  tools from the head count behind the door and ended a run at a wipe: do not quote them.
  RECOUNT 10-15 17:38Z on the build head 385850ee (the same 7 levels x 16 seeds, hard, no run in error): plan 104 taken / 52 clean / 1.69 men lost a floor / wiped on 16 / 113 s · B 99 / 33 / 2.16 / 33 / 103 s · solo 100 / 0 / 0.92 / 0 / 51 s; each half holds (clean 27 / 19 / 0 and 25 / 14 / 0); the depot is still the exception (the frag by hand lost 36 men to B's 23 in the paired first rooms), the warehouse has B ahead on clean floors (6 to 4) with the plan keeping more men; two doors on one word on 23 of 112 floors. The order has not moved in a day of merges.
- **'Move there' fits the room** (`src/game/roomfit.ts` over `src/game/roomread.ts`; `ROOMFIT.on` DEFAULT ON, `?noroomfit` / the table by name = orders.ts `spotsAt`'s line abreast
  exactly as it was; record rebuild/squad-spots/read-first.md). `roomRead(g, p, reach, hint)` = the STATELESS read both this and a room clear can take: the floor shared with a
  point (a flood that stops at door frames, gap lines and passage mouths — finer than cleared.ts's rooms) and its WAYS out (cover.ts's openings: which side the space is on, the floor
  beyond, `farKnown` by cleared.ts, shut / locked). orders.ts 'move' asks `fitSpots(g, at, n, face, sam, bodies, held)`: the ways weighted (near · uncleared over known · open over shut
  over locked · the side Sam faced) + long uncleared floor as sectors → each man a THING TO WATCH and a place to watch it from — in sight of it, off the frame and out of every way's
  funnel, a wall at his back, ≥ `apart` from mates and bodies, nobody in anybody's lane; a second gun only on uncleared ways; spare men watch the longest run; ONE man stands on the
  point itself. `null` (no room for them) = the old line. `Assignment.fit` carries it: the watch is taken up within `watchInM` of the mark, the row reads 'in position · on the <door>
  door', arrival is by his feet (a watch the fight AI holds him off does not keep the order 'moving'), and `fitTick` re-looks once a second ONLY when the known rooms / the doors /
  a mate's watch changed — the gun moves to a heavier unwatched threat, the feet never. No dice, nothing saved (an Assignment is not in a checkpoint), no panel rows. Frozen digests pin
  it off (threshold-probes.ts, nvg-probes.ts). A HALL'S LENGTH (10-11, the missions goal's hall level): a way stands for a long run of floor only where it lies ACROSS the run (`sectorAcross` 0.5 = the cosine by which it must face back up it; 0 = any way near the bearing, as first shipped — a hall with doors down its sides then got four guns on doors and none on its length), and a run past `sectorFarM` 10 m in a room the team has stood in counts `sectorFarK` 0.7, not `knownK` 0.35. QA: `probes.ts roomfit` (rooms over every level × 2 / 3 / 4 men, cleared, hall, walk, off; in `all-quick`; on the shipped stand the lived-in rooms leave less floor out of the funnels and a man's first third of a second off the mark is 0.07‥0.08 m (the same with `TPS_UNSEEN=0`: not the sneak rule; which shipped row it is was not chased) — the bars say so), `bun run tools/qa/roomfit-map.ts
  [--level f] [--men n] [--at x,z]` (the plan as ASCII, fitted against abreast), `node tools/qa/roomfit-look.cjs` (the real page headless: both, a still each).

<!-- was CLAUDE.md lines 990–1108 -->
- **'Fall in' puts no two men on one spot** (`ORDERS.fileSpread`, `fileApart` 0.9, `fileTight` 0.75: ON in the page — `?filespread=0` — OFF in the module and on the frozen stand,
  `TPS_FILESPREAD=1`; a `FROZEN_HOLDS` row, a recording or a run tape from before the key replays with it off (journal.ts `applyKnobs`); Tab ▸ Player, doors & props ▸ 'fall in: no two
  places on one spot'). Found by the wall charge's own check on block-squads: Sam put down at (13.6, 10.3) with no trail behind him, Blue One's and Blue Two's fall-in goals came out
  0.25 m apart beside door `m_w`, both read 'arrived', and they shoved each other for as long as he stood there. WHY: the file's places run straight back from Sam past the end of his
  crumb trail (`slot(back)`), so with a wall behind him several places CLAMP where the floor stops; with the doorway manners on (the page) the rear man is 'standing on a mate'
  (`onTop`), so he is sent on to his exact place, a quarter metre from the other's. The level's door swings only changed the walk in. THE RULE (orders.ts `apartSlot`, asked only with
  Sam stopped, the place not one the doorway manners have just moved off a door's lane and not one along Sam's own wall): a place within `fileApart` of where a man AHEAD of him in the file — or a teammate on a post — will stand, with
  nothing solid between, is dealt again at the nearest clear floor (doorway.ts `doorwayClearNear`: off every door frame and lane) — in Sam's sight first, else in sight of the place
  itself, else both asked again with a bare body's width (`fileTight`) between places, and where the floor has none of it the man STOPS SHORT: where he stands, once he is within 1.5 m
  of the place, a body's room from the others and off the frames. One point per assignment, kept while his place and theirs stand, so he walks to it once; a deal that found no floor
  is not searched again for a second. No dice, nothing saved (an Assignment is not in a checkpoint), no words. `bun run tools/qa/filespread-check.ts [--verbose]` (`probes.ts
  filespread`, in family `squadorders`; both stands — it raises the manners itself; `FILESPREAD_BREAK=1` must fail): the found case off (2 still moving after twenty seconds, 1 pair of
  places on one spot) and on (nobody moving, no two places within 0.85 m, everybody arrived, nobody further from Sam), then Sam put down on the start and in the held rooms of four
  squad levels — shipped stand, 19 places: men still moving 10 → 2, places on one spot 8 → 0, dealt again at 12, every file that stood still without the rule stands still with it
  (9 of 9); frozen stand 9 → 3, 4 → 0, 11 of 11. IT ACTS IN TRAINING 6 at 0:11 (the two squad sound replays are held against it: `replay-at.ts public/assets/replays/train-pairs.json.gz
  --at 50 --rerun`, and `train-orders` `--at 106`). KNOWN: the two men still moving at compound-four (17.83, 15.92) are one of them walked ≤ 1.8 m by the cover's own step
  (`COVER.step`) onto an open door, not a jostle; places 0.65–0.7 m apart still shuffled, which is why `fileTight` is 0.75; 'stopped' is Sam's measured pace at or under 0.3 m/s (`samStopped`), so a Sam
  creeping at about that pace flips the rule on and off; a man ahead's goal can be a corner of his walk in, not yet his place; a Sam who walks back over his own short trail gets a file bunched round him with the rule or without (the places are the trail's). MEASURED (shipped stand, scripted commander, rule on against off, block-squads / compound / depot / the office room clear four × seeds 1–8, no error or stall): 14 of 32 run digests equal, won 19 both, teammates up 54 against 49 of 128 — not a difference at that size. `probes.ts wallkeep`'s count of nav-cell crossings in its quiet re-reads on block-squads reads 1 with the rule (3 before it). `unseen-probes.ts follow` fires its one test shot with `FRIENDS.lowReady` held off: that walk turns Sam back on his own file, and whether a teammate stood in his line (so the round never left: red on the office with the rule or without, on records only with it) was where the file happened to stand. Never seen on a GPU or played by anybody.
- **No floor and no stopping short: he holds, he is never sent into a mate** (`ORDERS.fileHold`, 10-13: ON in the page — `?filehold=0` — OFF in the module and on the
  frozen stand, `TPS_FILEHOLD=1`; a `FROZEN_HOLDS` row, the pin lists; journal: a recording whose ORDERS row has no such key replays with it off). Found by
  `filespread` line 3 on the shipped stand, room-clear-four's storage corner (Sam at (33.00, 7.03)): the spread found no floor for Blue Two's place, he was 0.5 m
  from Blue One's place so could not stop short (the bar is `fileApart`), and `apartSlot` handed him the place as it fell, 0.40 m from Blue One's: both still
  moving for as long as Sam stood (0.27 m each in 5 s). On: within 1.5 m of that place and off every frame and lane he holds where he stands (asked live, never
  kept), and where a mate's place is nearer him than `fileTight` the held point is the step straight away from it (then a little either side) that makes it
  `fileTight`, or as much of it as the floor has, 5 cm at a time; further off than 1.5 m he walks on toward the place as before. Only `apartSlot`'s two 'no
  floor' returns changed. Measured there: 2 moving, places 0.40 m apart → 0 moving, places 0.70 m and bodies 0.66 m apart. `probes.ts filespread`, both stands,
  `FILEHOLD_BREAK=1` (the corner is STAGED for the frozen stand, whose men never walk into it: doors stay, the storage door stood open, the two put in the
  pocket; and line 3's 19 places). One level, one corner, no seeds (the stand is fixed). Never seen on a GPU, never played.
- **Teammates falling in never shove you** (`src/game/noshove.ts`, `NOSHOVE.on`: ON in the page — `?noshove=0` — OFF in the module and on the frozen stand,
  `TPS_NOSHOVE=1`, a `FROZEN_HOLDS` row, in the knob registry and a journal's tables: a recording from before the key replays with it off; off = the build as
  it was; the maintainer's yes of 10-21 to a card from the team pace work). THE FLAW, reproduced before anything was changed: a man walking to his place
  under 'fall in' was as solid to the player as an enemy (player.ts `keepOffGuards`: "you are the one who yields"), so one whose place lay on the player's far
  side walked into him and shouldered him aside — 0.22 to 0.81 m staged on room-clear-four, 0.23 m on the compound (room taken through k_p, 'fall in' with the
  player stood inside) — and orders.ts, which reads the player's pace off the ground he covers, took the shove for a WALK: the file's places moved (stopped /
  not stopped flips `clearBack`), and the man keeping the room's other door walked 0.54 m out of "his way" (`aside()` comes before the keep).
  TWO HALVES, each with its own key under the switch. `round`: a man of the player's own under 'fall in', on his order's legs (`noShoveMan`: `post === null`
  and a script — the fight's own moves, a man on any other order, a man running from a live grenade (`fragRunning`: that leg is run through the same
  walker under a borrowed script) and every enemy are as they were), is the one who yields, in squad.ts `runGuardScript` after
  his step (`noShoveKeep`): his own step never takes him nearer the player than `ring` 0.6 (or than he already stood) — where a ray from the player's shin to
  the side finds `ring` + his radius of floor he walks ROUND, the side his way already lies on (square on: his right), else the other; his order's place
  itself inside the ring: he STOPS SHORT at it; no room either side (a passage, a doorway): `through` on, he squeezes past as a man in a narrow doorway always
  did and the player is not moved, `through` off he stops short and waits; left standing inside the player's keep-off (a restart, a load, an enemy who shoved
  the player onto him) he steps back out at `back` 1.2 m/s; a corner of his way that lies under the player is skipped for the next (or for his place) where
  that is a straight walk, and one he cannot cut he waits for. HELD SHORT HE STANDS: `noShoveKeep` answers true and the walker zeroes his pace, so his legs
  do not cycle on the spot and followPath's stuck side-step is not woken (the review of 10-21 found him walking on the spot at 2.2 m/s). The player's side
  (`keepOffGuards`, and `keepHeldOffGuards` for the pair with a man in his arm): such a man never moves him — only what his OWN legs closed on the man this
  update is taken back (`noShoveBack`, measured from where he would stand had his legs not moved: a walk past a follower's shoulder stays AT the keep-off and
  the man is not made to step back), so he still cannot walk through a follower. `own`: every push `keepOffGuards` gives him, from anybody, is written down for the frame
  (`Player.shoved` / `shovedT` / `shovedFrom`, set and read inside one update: no save holds them), and orders.ts `tick` reads his pace and heading off
  `noShoveOwn`: a frame nobody moved him in reads as it always did (a harness that walks him by small teleports still reads as a walk); one a man did reads
  the step his own legs took inside that update, less what the men took back of it (the part of their shove that runs against his step, no more than
  they gave) — a standing player shoved reads 0, a walk into a man who stands reads 0, sliding round one reads the ground covered, and what a door leaf did to him since the last tick is not his walking either (the compound's case: the leaf pushed him back each frame
  and the first cut read THAT as 1.8 m/s). Not touched: the trail's crumbs, the sneak's and the unseen squad's own reads of him, `playerGroundVel` (what a
  watcher sees of him is still the ground he covers). Tab ▸ Team feel: 'teammates ▸ never shove you falling in', '… go round you', '… a shove is not you
  walking', '… squeeze past in a tight place'. CHECK `tools/qa/noshove-check.ts` (`probes.ts noshove`, family `squadorders`; 12 lines, each rule line
  played off AND on, green on both stands; `NOSHOVE_BREAK=1` fails 11 of the 12 on both, the journal line apart): the found case staged small (off 0.22 m and
  a pace read of 1.7 m/s → on 0.000 m and 0.00, the man round him); the walk from 2.5 m square on and a foot off his line with `ORDERS.nearM` held off
  (off 0.25 / 0.81 m → on 0.000, round him and in his place); a 1.2 m passage (squeezes past, 0.000 m; `through` off: held at the ring for the whole
  take, his legs at 0.00 m/s and the stuck side-step woken 0 times); his place under the player (the mover asked directly: at the ring); set down on top
  of each other (he steps out, the player stays); the player walked at a follower (no nearer than 0.55 m) and past one's shoulder (0.550 m, the man made
  to step back on 0 frames; off 0.52); a teammate on a 'move' order through the standing player (still shouldered 0.44 m — he is not falling in —
  pace read 0.00 against 2.0 to 2.6 off, the follower in the line of the shove still against 0.84 m off); the arithmetic; THE COMPOUND'S KEEPER, which is
  the shipped stand's case (the frozen entry walks nobody across him, said so by the line): off 0.23 m and the keeper 0.54 m off his spot on his own legs,
  `own` alone the player shoved and the keeper's legs still, on 0.003 m and nobody's legs. `roomkeep-check.ts`'s wider bar for a shoved player
  (`ORDERS.asideOff`) is no longer reached with the rule on. THE PAGE: `tools/qa/noshove-page.cjs` (the real bundle in headless Chromium on the software adapter, `PORT=… node tools/qa/noshove-page.cjs` against a dev server: the page opens with the
  switch on, the standing player moved 0 m and the man went round him no nearer than 0.58 m; `?noshove=0`: off, 0.227 m; no page error).
  MEASURED 10-21: switch off = the build as it was, 21 of 21 run digests equal on EACH stand (`PT_DIGEST=1 playthrough.ts --seeds 1`, the page's stand with
  `TPS_NOSHOVE=0`). On against off on the page's stand, 21 scenarios x seeds 1 and 2 (the tool's own player; its JSON carries `noshove`): 31 of the 42 runs
  are the same run (the rule never fired), 11 differ; men up 64 of 148 on, 66 off; ends the same (21 taken, 13 wiped, 5 lost, 3 rescued); smells 147 on,
  141 off (twitch 114 / 111, unaware 24 / 23, block 3 / 1 — one of the new blocks names a man on his fall-in mark 0.87 m from a stopped player, one a man on
  a door order: two seeds do not say whether that is the rule); a follower was turned round the player on 198 frames, a shove kept out of his pace on 724,
  never held short or squeezed past. The tour and the soak were NOT run. NOT SEEN, NOT PLAYED: nothing of this on a GPU; nobody has watched a man walk round the player
  (his body still faces his next corner while his feet go round: a side-step that may read stiff) or squeeze through him in a passage; `ring`, `back` and
  the squeeze-or-wait call are first numbers. STILL AS IT WAS, for whoever takes it up: a teammate walking to a mark on ANY OTHER order shoulders the player
  (only his pace is no longer read off it), and a teammate the fight has moving.
- **The file's further back off a doorway ends with the floor** (`ORDERS.backEnd`, 10-13: ON in the page — `?backend=0` — OFF in the module and on the frozen
  stand, `TPS_BACKEND=1`; a `FROZEN_HOLDS` row, the pin lists; journal: a recording whose ORDERS row has no such key replays with it off). Found by
  `ordereddoor-round` on the shipped stand ("the four fall in round by the corridor, and are with Sam": Blue One stood at the server door, 8.9 m off, marked
  arrived). Sam stood at (27.5, 11.4) with no trail, 'behind him' pointing into the manager's open door: `slot()` stops where the floor ends, in that frame,
  however far back it is asked, so `clearBack` added its full 2.4 m for every man after the first and each man inherited the one ahead's (file distances
  1.3 / 4.8 / 8.3 / 11.8 m), and the 'near enough already' band (file distance + `bandM`) took a man 8.86 m off in plain sight for one in his place. On:
  `clearBack` stops adding the moment 0.3 m further back moves the place by under a centimetre (file distances 1.3 / 2.4 / 3.5 / 4.6 m there). NO PLACE MOVES
  by the key (once further back stops moving `slot()` it never moves it again: the count only went on to its eighth step on the same spot) — only the number,
  which the near band, `unseenWallSlot` and `sneakFollow` read (those two get the shorter file distance in that one case, which no check stages:
  `unseen-probes.ts wall` on the shipped stand prints the same with the key on and off, `sneak-stand` is green). Measured there, the fall in from the
  server room at 14 s: Red One 2.9 · Red Two 3.6 · Blue One 8.9 · Blue Two 4.4 m → 2.9 · 3.6 · 4.4 · 5.2 m, all arrived, nobody moving.
  `probes.ts ordereddoor-round`, both stands, `BACKEND_BREAK=1` (the far man is STAGED for the frozen stand, whose men shoulder the manager's leaf shut and
  so never show it: the order given from the server room, the men then put in the corridor with the last 8 m off, the leaf held open; and a control that no
  place differs by the key). One level, one door, no seeds (the stand is fixed). Never seen on a GPU, never played.
- **A stack refused only for Sam's own body says so** (`ORDERS.inWay`, 10-13: ON in the page — `?inway=0` — OFF in the module and on the frozen stand,
  `TPS_INWAY=1`; a `FROZEN_HOLDS` row, the pin lists, a debugger toggle; journal: a recording whose ORDERS row has no such key replays with it off). The
  owner, on 'stack up' refused while HE stood on a stack place in a tight bay: "they should tell you you're in the way". `orders.ts noRoomWords(plain, ask)`:
  on a 'no room' refusal the very ask is asked once more with Sam left out (`samOut`, the own-mark rule's second ask: every maker reads `samPlace`); places
  for every man that way = the one thing on the door is him, and the man says `IN_WAY_WORDS` ("you're in the way.", the one place the string lives) — the
  order's answer, the spoken line and the menu's greyed word alike. Asked at the stack's `valid` / `issue` and the door tools' `stackable` / threshold
  issue (`doortools.ts`). WORDS ONLY: nothing is dealt from the second ask, the makers' counters (`STACK_OWN`, `DOORMANNERS_STATS`, `STACKROOM_STATS`,
  `GLASSPEN_STATS`), `leafOutGave` and the memos the makers fill (`stackroom.ts stackRoomBookKeep`: the floors a first reading takes off the leaves as they
  stand; the shots asked through glass) are put back, no die is thrown; no order is taken or refused by the key and no place moves. NOT built, on purpose: stacking anyway with a
  man held back; giving the order again when he steps off. Not covered: 'no room to stand off.' (the charge's stand-off reads Sam's body directly, not
  `samPlace`) still says that with Sam on a stand-off mark; the second ask does not
  ask `reach` or the lock, so a door he steps off of can still answer "can't get there."; the shorter line's bubble is up a sixth of a second less. `probes.ts stack-inway` (family `inway`, `tools/qa/inway-probes.ts`), both stands,
  `INWAY_BREAK=1` fails on both: the barracks' sg_w from the gallery, Sam on the last of the four places → refused, "Red One: you're in the way."; Sam
  stepped off → taken, a man dealt the place he stood on; the compound's hall_n (no room for four, Sam 6+ m off or stood in front of it) → 'no room on
  that door.'; key off → 'no room on that door.' at sg_w; every man's order, door, place and position the same key on and off (0.000000 m); the second ask
  leaves counters, run digest and die as they stood; and COLD, on a game that has never asked that door, the words differ by the key and nothing else
  does (a tripwire: sg_w is shut and has no glass, so the memo restores read the same there with or without them). Two stagings (one level, one door each), seed 1, no run tally. Nobody has seen or played it; never seen on a GPU.
- **A walk tries a door nobody has tried** (`ORDERS.walkTries`, 10-13: ON in the page — `?walktries=0` — OFF in the module and on the frozen stand,
  `TPS_WALKTRIES=1`; a `FROZEN_HOLDS` row, the pin lists, a debugger toggle; journal: a recording whose ORDERS row has no such key replays with it off).
  Acts only where `DOORTOOLS.testDoor` is on. The fault: 'move there' to a spot whose only way in is a door locked or wedged against the team was refused
  at once with the door's name ("store door is locked.", the menu's row greyed with it) — `orders.ts route` reads the real lock, and told the player of
  one no hand had been on, where the door orders learn a door at its handle. Now `route` hands back the door a lock refusal is about and the face the
  way comes to it by (`lock`: a field more, nothing else of the way-round search is touched); `walkTry` asks `doorTools.untried` of it, and for 'move'
  alone an untried one is no refusal: `walkStacks` deals the men whose way runs at it that door's stack marks (`stackPostsWait`, as 'stack up'), they
  walk there on their 'move' (`Assignment.tries`), and `doortools.ts walkTried` has the man on the jamb try the handle as he comes onto his mark: locked
  → the halt's own line ("locked. holding on it — your call." / "wedged from inside. …", `shutSaid`, shared with `haltAt`), the log's 'tried' /
  'halted' / 'end: found shut' under `move <door>`, the men left the plain stack a halted door order leaves (`stackLeft`, shared with `plainStack`;
  'stacked · <door> · locked'), and `haltBack` now steps halted WALKERS back from another pair's charge as it does a halted entry; it turns (he says
  the stack's own "it's not locked."), or the leaf came open → `orders.ts walkOn` asks the walk again as a fresh order would be asked: the next
  untried door on the way gets its own marks and its own try (a review run had the handback walk both men through a second, untried lock), a refusal
  (a known door, no way, no room) is said by one man and they stop where they stand ('stopped short'), else each man is handed the 'move' he was
  given. One try per face of a door whoever's order sent the walkers; the halt and the handback are a group of their own (`newGroup`: nobody
  else's 'set.' waits on them); a walker reads 'moving' until the try; a walker sent off to throw keeps `tries` in `squadthrow.ts`'s `back` copy. Back on his walk after a mate has tried the door (the team knows it shut), he is sent to his stack mark and nothing is said or counted again; a group with a man still carrying `tries` calls no 'set.' (a second review's two finds, 10-14; the first has a check line, the second is read only).
  The team knows from then on and the same order is refused and greyed as before. As they were: a door the team knows, one Sam's ring opens, an open
  door, a spot with another way in, and EVERY OTHER order that asks `reach` (stack, the door tools' stack and stand-off, work a thing, the wall
  charge, the pair orders, throws, shutdoor: they would walk a man through the leaf) — those still refuse with the door's name untried; fall in is not
  touched. Known and left: no room to stack on that door → 'no room on that door.' (the stack's refusal, on a 'move'); the refusal names the door on
  the way the lock search found, which is the one walked to; a lead stopped short of his mark tries it from where he stands; a second cast is left
  out; the silent squad's stand-in for the move row (`pairorders.ts pairDark`) asks `reach` and still names an untried lock (out of this mend's
  reach, left). `probes.ts move-walktries` (family `walktries`, `tools/qa/walktries-probes.ts`, 21 lines, sets `testDoor` itself), both stands,
  `WALKTRIES_BREAK=1` fails on both (14 lines): the office's manager door from the corridor, the pair → key off refused "manager door is locked." and
  greyed; key on taken, row live, walked ~20 m at no more than a plain move's 2.00 m/s, one handle tried, the line said once, both stacked within
  2.6 m of the frame on the corridor's side and still, then refused and greyed; the four with red alone sent (blue does not move); the Mousehole's
  store door wedged BY HAND, the four ("wedged from inside. holding on it — your call."); open door, known door and Sam's key the same key on and off
  (0.00 m); twice the same (0.000000 m); the journal. Staged since the review: the door unlocked, and opened from inside, two seconds into the walk
  (the move completes; one try and "it's not locked." once; an open leaf is not tried); two locks on the way (the pair in the storage room, its door
  hand-locked, its key on the ring mid-walk: the manager's door gets its own try, nobody in the room at any frame); 'hold position' mid-walk (no try
  after, nothing left on the men); the jamb's man down (his mate tries); the four with blue ordered meanwhile (a 'set.' each); `testDoor` off with the
  key on (the key-off words); 'no room on that door.' FORCED (the makers' answer for that door stubbed to none — no real door here has no room for
  a walk: Sam on a mark only has the marks dealt again). UNSTAGED: a real throw order mid-walk (the hand-back is staged by hand); a mixed order whose plain movers arrive before the try; a lead who stopped short tries from where he stands (as a stack's lead does); a lead stopped short; a refusal at the handback; two
  orders' walkers on one door. `orders-edges`' line 'move there through a door locked against Sam is refused with the door named' went red on the
  shipped stand (it found no refused door) and now asks with the key held off: it is the refusal itself, read against the ring. Two levels, three doors, one seed, no run tally. Nobody has seen or played it;
  never seen on a GPU; the level's own wedges (a defender's) were not staged.
- **An ordered walk keeps off lit floor that an uncleared room can see** (`src/game/seenwalk.ts`, `SEENWALK.on`: ON in the page, `?seenwalk=0`; off in the
  module and on the frozen stand, `TPS_SEENWALK=1`; panel 'walk ▸ keeps off lit floor in view'; the table is in the journal, a recording from before it
  replays with it off). Found at the glasshouse (the squad's walk to a door went past lit glass); the maintainer, asked whether to build a rule for
  glass, 10-16: "can that just work with the regular visibility systems? men will consider themselves visible in that condition". So NO RULE FOR GLASS: a
  block of floor is dear to the walker when it is LIT (the place's own steady light on the meter's scale, `calmtorch.ts placeLight`, at or over `litAt`
  0.1, the sneak's own bar) and IN VIEW (a sight line, `segmentBlocked`: glass passes it, a wall or a leaf stops it, to where somebody might stand in a
  room nobody of the team has been in — `cleared.ts unknownEyes`, a point every 2 m of its floor — inside a guard's reach of a man that lit,
  `guards.ts eyeReach`). Asked in `orders.ts route()` AFTER the lanes (`laneWay`: the lanes' own way is found exactly as before, then this one of the
  way they left him): the way round is taken only by the doors the short way takes, at no lock, through no more uncleared room and no more than half a metre more lane, at
  most `long` 1.35 times as long + 1 m (of the way the lanes left him, so on top of their own 1.6), and `less` 1.5 m or more the less in view. WHOSE
  WALKS: every walk that router finds but a menu's question — an order's, a man back on his order, the marks a door tool, a wall charge, a rescue or a
  search walks its men to (assigned through the same router, as the lanes are), and the walk the throw planner reads of it (`squadthrow.ts walkLine`).
  The room he is ordered INTO counts as a room that can see him until it is cleared, so the last metres to an open door bend to its wall. No such way: the way as it was — an order is never refused and a
  mark never moved for it; a spot the player points at is his order, only the way to it is weighed. Where the walk was dark already, or every room in
  reach is known, nothing is asked. MEASURED (shipped stand, one man's walk from the squad's start to both faces of every door, seven levels, 223
  walks): 47 take another way; metres of walk on such floor 1204 → 1049; the office floor 188 → 153 (6 of 14), the barracks 469 → 407 (22 of 54), the
  depot 245 → 208 (8 of 26), the block 133 → 121 (7 of 31), the warehouse 56 → 48 (4 of 40), the compound 41 → 41. AT THE GLASSHOUSE ITSELF NOTHING
  CHANGES: the forecourt is lit and in view of the glazed rooms wall to wall (10 m of the 18.5 m walk to the front door) and there is no dark way to a
  door in a glass wall — that stays the level's lesson. COST: asked when a walk is begun and by the throw planner when it plans a walk; a route asked cold is 2 to 10 ms on
  average with the rule against under 1 without, 26 ms the worst seen (the office floor; a shared cloud core), paid on the tick an order is given. A
  block is read once a tick and shared by every walk asked that tick (the men of one order). NOTHING IS KEPT PAST THE TICK, on purpose: the picture asks
  walks too (the throw planner's drawn plan) and what is drawn must never decide what the game reads; `seenReset` on a restart and a checkpoint loaded.
  The throw planner with its page open (shipped, both kinds asked every tick for 90 ticks of each of 17 targets on the office floor, 35 at the
  barracks): it asked the rule 10 and 48 times in all; its mean time a tick 1.64 → 1.46 ms and 1.07 → 1.03 ms, the worst tick 55 → 42 ms and 100 → 91
  ms (its own cold flood; no cost of the rule's to be seen in it).
  Check: `probes.ts seenwalk` (family orders; `SEENWALK_BREAK=1` fails seven lines), both stands: the way; the same BY HAND with none of the rule's
  own price (the meter at each half metre, a line from every floor cell of every uncleared room: 19.2 m lit and in view → 11.0); a man walking it
  (26.1 m with 16.5 in view → 28.0 m with 8.9), and the same walk to the bit, 879 ticks, with the picture asking walks of its own between the
  ticks; nothing lit / every room known = the way as it was; the glasshouse's forecourt (and the rule was asked
  of it); journal and boot; what is read is kept for the tick and no longer (read again with a door moved, the clock moved, a reset), the same way each time. NOT DONE: it reads where a defender MIGHT stand, never where one is (that is `sneak.ts sneakWalk`'s, for the silent pair); men following Sam
  are not routed by it; Sam's own lit state is his. Never seen on a GPU; nobody has played it: whether a way a third
  longer for 8 m less in view is the bargain a loud squad should take is the maintainer's to say (`long`, `less`).
- **A man on his stack mark is walked round, not into** (`DOORMANNERS.ownPlace`, src/game/doorway.ts `doorwayGate`; 10-13). A stack's second-rank man reached his
  mark first, the man bound for the wall place beyond it walked into him and shoved him onto that place, and the two stood on each other's marks. Now a friend
  within `ownM` (0.45 m) of the mark his order gave him is a standing man whatever his last steps say, a corner is put beside him when the walker's way goes on
  past, and the gate is also asked on the last `ownEndM` (2.5 m) of a walk to an order's mark that ends by a door (there it looks at nothing but such a mate).
  The round is at the plain rule's distance (`round`): at half a metre it put two men head-on in the barracks passage. ON in the page under the doorway manners
  (`?nodoormanners` takes the whole table off; Tab ▸ 'doors ▸ round a man on his mark', kept per machine); the frozen stand has it with the manners raised
  (`QA_DOORMANNERS=1`); off = the gate as it was; a recording from before the key replays with it off. QA: `bun run tools/qa/stack-furniture-check.ts` (it
  raises the door rules itself; the played line: no man short of his mark, no more men a metre off with the furniture rule on than off) — ALL PASS on both
  stands, and red on the shipped stand before the mend (5 men a metre off against 4); `OWNPLACE_BREAK=1` is red on the SHIPPED stand only: on the frozen stand
  the marks put no mate in the way, so the break stays green there (a gap, known). Also run on the join, both stands: `stackroom-check --walk`, `stack-own`,
  `stack-back`, `doorway-step`, `stack-marks`, `lived-stack`, `filespread`, `rearwatch`, `roomkeep`, `openhand`, `doorlook`, `own-can` (green but `filespread`
  on shipped, red at room-clear-four before the mend too). NOT MEASURED: no play-through tally was run for it. Never played, never seen on a GPU.
- **The squad row's word for a follower is latched** (a display mend, no switch, the same on both stands; `orders.ts followWord` / `shownThere`, `ORDERS.wordFarM` 2.0, `wordHoldS` 2.5 game seconds; both 0 = as it was). The fault: the row printed `arrived` (0.8 m off a place dealt again in 0.5 m jumps), so 'with you' / 'falling in' flipped about every 0.2 s on every man while Sam walked: 586 flips in 152 s on the floodlit yard tape 033934. Now on when in place, off only past `wordFarM` or after `wordHoldS` out of place; `A.arrived` is untouched and the latch is a module `WeakMap` (not on the saved / digested state), read by `statusOf` and the replay trace's `ord`.
  Check: `probes.ts foursquad-follow`'s line 'the squad row on a walk' (10 s, four men: word changes 0/0/0/0 frozen, 0/0/1/1 shipped, against 35‥59 flips a man of the bare bit), `FOLLOWWORD_BREAK=1` must fail (it does, both stands). 1.5 m / 0.5 s was tried first and let 4‥7 changes through (a walking file is out of place up to 1.7 s / 1.7 m at a time). Run digests equal before and after on both stands. The page on the software adapter (`?roomclear&squad4`, a scripted 15.5 m walk): 2/2/2/2 word changes against 40‥52 flips of the bit. Never seen on a GPU; not replayed against the tape itself.
- **A rear man with no door behind him watches a way in, not a wall** (`cover.ts COVER.rearRead` over `roomfit.ts watchablesAt`: ON in the page — `?rearread=0` — OFF in the module and on the
  frozen stand, `TPS_REARREAD=1`; a `FROZEN_HOLDS` row, a recording from before the key replays with it off; Tab ▸ Player & weapons ▸ Player, doors & props ▸ 'rear men watch a way in, not a wall'; the maintainer, 10-13, on the
  floodlit yard: "weird that these guys are covering a wall"). A spare man (`Assignment.spare`: a stack's rear men, a wall charge's stand-off rear — wallcharge.ts `spareRear` —, the mate
  covering a teammate who works a thing) whom the cover's deal gives no opening watches 'the rear' = the way he came (`A.from`). At a door stack that is the approach; at a mark with NO DOOR
  (`!A.door`) it was the spot he stood on when the order was given: at a wall-charge stand-off four metres from the yard wall, his gun and weapon light rested on the wall. With the rule,
  once within `rearReadIn` 1 m of his mark, he takes the heaviest thing roomfit's read of the floor round him offers within `rearReadM` 14 m (`readRear`: a door or gate nobody of ours has
  been beyond, else the longest run of open floor; in his sight, no teammate in the line), a thing another rear man already has is left to him where the floor has a second
  (`rearReadDeg` 35 apart BY ITS BEARING FROM THIS MAN'S OWN FEET — two ways in only when all but the same bearing —, else both share it; a mate's read older than a re-read and a half holds nothing back), re-read once a second and kept through anything not `rearReadSticky` 1.3 × heavier; his gun rests `rearLook` 6 m along it. Nothing found = the
  old rule. A rear man WITH a door (every door stack) is never read, so stacks are as they were. Where he looks, never when he shoots; no dice; nothing saved (an Assignment is not in a
  checkpoint). `bun run tools/qa/rearread-check.ts [--verbose]` (`probes.ts rearread`, also under `cover` and `wallcharge`; both stands; `REARREAD_BREAK=1` must fail): floodlit, a charge on
  the guard room's west wall — off, the south rear man's line meets the yard wall at 4.6 m; on, it is on the foot gate with 30 m open; two rear men on one side take the gate and the east
  run, 107° apart; a plain stack on the front door stands and watches the same on and off.
  MEASURED (shipped stand, the scripted wall commander `PT_WALL=1 PT_WALLOUTER=1`, 12 seeds, rule on against off, no error or stall): Mousehole from the yard won 12 both,
  teammates up 46 against 40 of 48 (no two runs alike); the floodlit yard won 12 both, 32 against 32 (the same count on every seed) — not a difference at that size. With no wall charge played
  (compound-four, the office room clear four × seeds 1–4) the run digests are equal on and off, 8 of 8. Never seen on a GPU or played by anybody.
- **A man walking backwards on the door behind, let go of, keeps his way while he turns** (`cover.ts COVER.backTurn`: `turnFrom` / `turnOut` / `unturn`. ON in the page — `?backturn=0` —
  OFF in the module and on the frozen stand, `FROZEN_HOLDS` row, word `TPS_BACKTURN=1`; a Tab row 'a rear man turns round on his way'; a recording from before the key replays with it
  off). THE FAULT: the rear man of a file walks backwards with his gun on the opening behind (the runner's strafe). When the deal lets go of that opening (a wall in its line, a mate has
  it, Sam turned the file round) the order's own pose is 'walk forward', and a man walks forward along his BODY, still turned to the rear: a quarter of a metre back the way he came, a
  hook, three quarters of a second gone. THE RULE: from the let-go (a dropped job, or a kept gun's time up) his feet keep the path (strafe), his body turns to the corner of his path
  he is walking to, his gun carried in front of it, until the body is within `backTurnBody` (cosine 0.7) of that way or `backTurnSecs` 1 are up; stood, run on over `backOut`, or not
  posed for a frame, it ends; dealt a new opening meanwhile he meets it as a man walking backwards (backKeep holds him the same way); taken by an order that does not leave him free,
  a daze or the knob going off, his script is given back as a job's is. Seen on the registry walk, beside the doorway rule that walks a man round an open leaf. CHECK
  `tools/qa/backturn-check.ts` (`probes.ts backturn`, family cover; `BACKTURN_BREAK=1` fails on both stands): the registry walk with four, rule off then on. MEASURED 10-17, one walk
  per stand, headless: shipped 42 let-goes with the body turned, 5.16 m walked against the path (worst 0.42) → 35 let-goes, 0.09 m (worst 0.03), path made in the 0.8 s after 0.44 →
  1.19 m; frozen stand with the switch raised 2.76 m → 0.02 m, 0.66 → 1.08 m. The walk's stuck man-frames (0.65 % off, 0.73 % on, shipped) are a rear man stood ON his own place over
  6.5 m behind a stopped Sam at three stops, with the rule or without: the file's length, not this. NOT DONE: a new opening within `twist` of his way while his body is 45 to 90
  degrees off it lets him walk forward (a small hook left); the man run on over `backOut` turns as he did. Never seen on a GPU, nobody has played it.
- **Teammates throw a frag or a stun canister on order** (`src/game/squadthrow.ts`, `SQUADTHROW.on`: ON in the page — `?nosquadthrow` = no such rows — OFF in the module and on the frozen
  stand, `TPS_SQUADTHROW=1`; a `FROZEN_HOLDS` row, in the knob registry and a journal's tables, a recording from before the table replays with it off; Tab ▸ Squad ▸ 'teammates throw frag / stun
  on order'; the maintainer, 10-13: "would be nice to be able to instruct teammates to throw frags/stuns"). Until here a teammate's grenade left his hand only inside a door order. THE KEYS: X on
  a spot of FLOOR, **G** (the floor menu's row 'throw · frag N · bang N ▸', `throwThere`, a page: `OrderDef.hotKey` = `FRAG.orderKey`, no digit of the first page taken), then **1** = 'frag there'
  (`fragThere`) / **2** = 'bang there' (`stunThere`; the order menu's one word for this can is BANG — the door rows' 'bang, then go in', the spoken 'bang out!' / 'no bangs left.' — see dialogue.md); Esc / right click = back a page. Nothing held, no digit above 2 on the page. WHO THROWS: of the men the menu goes to (T's pick as ever), the
  nearest to the spot with a hand free — not setting a charge, at a lock, working a thing or changing a magazine (`handsBusy`) — and an arc that brings the thing to REST on it — squadsmoke.ts's own tests, exported for this (`squadHandFree`, `squadArcTo`; a frag's run past its landing
  is `SQUADTHROW.fragRollK` 0.04, measured: where the fuse found it was 0.11 m from the spot on average, 0.30 m at most, over throws of 3‥12 m) — and not inside `againSecs` 1.2 of his last
  throw. Nobody else answers: the rows are `free` and `only` the thrower's, so a stack, a hold or a drill is left as it was (and where one of them has a throw from where he stands, nobody walks). THE COUNT is the door tools' own bag
  (`g.doorTools.frags` / `.bangs`, `take()`), the one the squad block already shows; nothing is spent on a refusal. THE THROW is the door tools' own: a frag on `FRAG.orderFuse` from the hand, a
  canister on `flashFuse` from where it lands, the quick toss, 'frag out!' / 'bang out!', and it goes off by the game's own road under the thrower's id (frag.ts `blast`, combat.ts
  `detonateStun`), so it does to the player what it does to anybody. SENSE, asked when the menu is read and again as the order is given: none left ('no frags left.' / 'no frags in this kit.' /
  'no bangs left.'), no arc for anybody addressed ('no throw from here.'), and A FRAG IS NEVER THROWN ONTO ITS OWN — the player, any teammate still breathing (the thrower too; a man down wounded or out cold where he lies), a rescue's hostage, the
  man to take alive or a civilian within `FRAG.woundM` + 1 m, with a line, of where it would rest or of the spot asked for = the row greyed naming who ('you are in it.' / 'Red Two is in it.' /
  'hostages. no frag.'; with the dialogue pass on, the man a snatch came for by his own name — '<name> is in it. no frag.' — and anybody else unarmed 'a civilian is in it. no frag.': neither is a hostage). A STUN is the player's call: never refused for its own side, but its row NAMES who of ours it would catch (' · too close: you, Red One': `detonateStun`'s own tests asked
  with each reach `slackM` 1 m long, so it may over-warn). A SILENT squad: both rows are silent.ts `LOUD_ROWS` (marked ' · LOUD'; giving one takes the squad out of silent). The squad block
  names the throw for `shownSecs` 2.5 ('Red Two · frag out'); the order is on `orders.log` under its own id. G ON A DOOR's menu is still that door's frag row, G again with the throw page up is eaten (it never falls through to a quick throw), and the frozen stand's G quick throw
  is not also taken by the press (`player.throwEaten`). State per Game in a WeakMap (each man's last throw, what the block shows, the stun row's warning), no dice, not in a checkpoint (none is
  written with a unit on the floor). `bun run tools/qa/squadthrow-check.ts` (`probes.ts squadthrow`, also inside family `squadorders`; both stands — it raises the switch itself;
  `SQUADTHROW_BREAK=1` must fail); `tools/qa/orderkeys-probes.ts` walks a page whose opener sits on a letter. NOT built: a throw at a DOOR or through one (the door tools' 'frag and clear' / 'bang
  and clear' are that), smoke (squadsmoke.ts has its own row), any defender's answer to it beyond what a blast already does. Never seen on a GPU or
  played by anybody.
- **A teammate fires a 40 mm grenade on order** (`src/game/squad40.ts`, `SQUAD40.on`: on in the page, `?nosquad40` off; off in the module and on the frozen stand, `TPS_SQUAD40=1` raises it; Team feel
  'teammates fire 40 mm on order'; the maintainer on the gear screen, 10-19: "should be symmetric between self and teammates (e.g. 40mm should work for squad)"). Until here the launcher's
  high-explosive round was the player's alone. THE KEYS: X on a spot of FLOOR, **G** (the throws' page), then **3** = '40 mm there · N left' (`shellThere`; the row that opens the page then reads
  'throw · frag N · bang N · 40 mm N ▸'). With the throws' switch off there is no page and so no row. THE ROW IS THERE ONLY WHILE A
  TEAMMATE'S CARD BROUGHT A ROUND: kit.ts `kitStage` hands `squad40Stage` each man's `MemberKit.shells` at every staging; with none carried nothing is kept for the Game, nothing is registered
  and a run digests as before on either stand. The card's own row (and slots.json's `who` / `maxPerMan` for `shell40`) is the kit screen's; `squad40Here()` is what a card asks ('does a
  teammate's 40 mm work in this build': the switch on and not broken — as `wallHere()` is the wall charge's). THE COUNT IS EACH MAN'S OWN, not a bag: a round rides in the pouch of the man whose
  tube it goes down, a man down takes his with him, and the row and the squad block ('40 mm N') show what the men on their feet carry. WHO FIRES: of the men the menu goes to, one with a round,
  a long gun in his hands whose weapons.ts row has the launcher (`launcher !== false`, not a pistol, not a shotgun: his sidearm up = no shot), a hand free (`squadHandFree`, squadthrow.ts
  `handsBusy`), `LAUNCHER40.cd` since his last, and A SHOT: he40.ts `shellSolve` from his tube (0.55 m ahead of him toward the spot, 1.35 m up or 0.3 under his head) goes off within `nearM` 1.2
  of the spot having flown `HE40.armM` + `armSlack` 0.5 — the solve stops on the player, a civilian, a hostage, the man to take alive (= no shot: a round in flight stops on them) and on a man
  of the other side the player can see (= it goes off on HIM, if armed there). To the plan a TEAMMATE in the line is a body too (the round in flight would pass him: nobody fires through a friend's back). A man whose gun is on the spot is asked first, then the
  nearest. HE POINTS IT FIRST: a man whose gun is UP (a fight, or an order with it at his shoulder) and whose `aimYaw` is within
  `aimRad` 0.2 of the spot fires on the frame of the pick and keeps what he was doing (the fight too); anybody else is turned to it — lent from his order by squadthrow.ts `squadLend` (only a
  man `mayWalk` passes: no drill, door tool or fight has him), an assignment under the row's id with the spot as `watch`, the round when his gun is on it (up `raiseSecs` 0.35 at least) and the floor still says yes (`aimSecs`
  2 at most), then `squadHandBack`. NOBODY WALKS FOR IT. THE ROUND is he40.ts `fireShell` and nothing else — the same fuze, the same frag.ts `blast` on whoever stands in it, the player too —
  under the firer's id; he calls 'forty out!'; the squad block names it for `shownSecs` ('Red Two · 40 mm out'); the order is on `orders.log` under its own id. SENSE, asked as the menu is read
  and again as the round goes, nothing spent on a refusal: 'no 40 mm left.' · 'none with them.' (the men addressed carry none, another man does) · 'not ready.' (the men who carry one have no
  launcher in a free hand, a tube still open, or are not ours to turn) · 'too close to arm.' · 'no shot from here.' · NEVER ONTO ITS OWN — anybody of ours with a line inside `FRAG.woundM` +
  `reachSlack` 0.5 of where it goes off OR of the spot it is sent at (a man of the other side it would stop on may have stepped out of its line; squadthrow.ts `squadFragCatches` with its new
  `burst` argument: nobody is counted on to duck a round that goes off as it lands, the player included — no 'too close: you' call as a frag has) = refused by name, the frag row's own words
  with 'no 40 mm.' for 'no frag.'; a man whose round would have one of ours in it is passed over for the next man with a shot (read in the code only: the office has no place to stage it).
  The menu's re-reads are kept 0.3 s per asker (the row's two questions); the picture keeps nothing: a drawn frame writes no state. A SILENT squad:
  the row is one of silent.ts `LOUD_ROWS` and holdfire.ts `LIFT_ORDERS`. THE PICTURE: ui/squadthrowviz.ts draws `squad40Plans` (who fires, the arc, where it goes off, the burst's two radii) for
  the highlighted row and while a man turns (`SQUAD40.draw`). squadthrow.ts changed for it, behaviour as it was: `handsBusy` / `mayWalk` exported, the walk's borrow-and-return lifted out as
  `squadLend` / `squadHandBack` (which now takes the walk-back policy), the floor-order log line as `squadLogRow`, `fragIn` takes a reach. `bun run tools/qa/squad40-check.ts` (`probes.ts squad40`, also inside `squadorders`; 22 lines, both stands — it raises the switch and
  gives a teammate's card its rounds itself, raising the pouches table's most-a-teammate for the run; `SQUAD40_BREAK=1` breaks the order in the module and must fail). On the page: `PORT=5199 node tools/qa/squad40-page.cjs` (a dev server on that port; the software adapter: the page as it opens with a
  round staged by `__squad40.stage` — X, G, 3 and the man fires — and the same under `?nosquad40`). Measured once, headless,
  the office with the four holding by the start: the row was live on 23 of 811 floor spots (594 no shot, 192 too close) — indoors it is a round for a hall or a yard. KNOWN, left as it is: a body the fog hides is not in the plan (it is not in the player's own reticle either), so a round can go off on a man nobody saw, short of the spot; in contact only a
  man whose gun is already on the spot fires (the fight is not asked to give a man up: 'not ready.'); a turn that ends in a refusal has already taken a silent squad loud (as a walk to a throw
  does). NOT built: the 40 mm row of a TEAMMATE's card and the pouches table that lets him carry one (the kit screen's: until then no card in the page brings a round, and the row is never there); a teammate's
  ring airfoil or sticky camera on order (the tube and the borrow are here; each needs its own solve and sense), a walk to a shot, any defender's answer beyond what a blast does. Nobody has
  seen it on a GPU or played it.
- **A door an enemy opens is looked at** (`ROOMFIGHT.doorEars`, on; `doorLookSecs` 3.5; Team feel 'team ▸ looks at a door an enemy opens' / 'door look ▸ s', kept per machine; off = nobody
  turns for a door, as it was; pinned off in threshold-probes.ts's identity and the nvg digests; the barricaded rooms goal's trace of the compound on hard, once its garage door `g_e` opened
  outward: a defender pulled it from outside, stood at its jamb three seconds and shot three of four in the back — the man kept on that door had no line to the jamb, the man with a line never
  turned). roomfight.ts `hear`: a `'door'` event under a hostile unit's HAND (a boot is its own kind), within 9 m of a teammate — by path and loudness as a footfall is heard
  (`hearPath`), at a lower bar (0.05 against 0.12: a leaf moving in his sight is seen as much as heard) — with a line from his eye to the doorway a hand's width his side of the middle of
  the opening, sets `Op.doorBy` (the door, who, when, the point); `cue()` then looks at it ONLY IF THE LEAF HAS COME OPEN (off its latch and more than 0.1 rad round: a rattle, a pick, a
  wedge going in, a leaf slammed to or latched turn nobody) and turns him to that doorway for `doorLookSecs` after his own beat, ONCE PER OPENING (the cue is used up; the leaf's next noise
  off its stop starts nothing; the steps' look does not take a door look's point) — EVERY such man (the steps' look is one man's), only with nobody else to turn to (a shot or a mate's
  call takes it over), never a man on his way to a door's mark or through it, a man holding a dealt arc only inside it, and A GUN AN ORDER HAS ON ANOTHER DOOR KEEPS IT (arrived, not
  `spare`, his `watch` on his order's own door: a stack's jamb men, a threshold's, a door he was told to cover) while a freer man can look — with none, the one of them with the least
  turn looks and the rest keep their door. Where he looks, never when he shoots — but a look is a turn like any other: his weapon light comes on by the light rule, and the man who
  opened it is no surprise to him. KNOWN: a man an entry left on a room's other door (`otherDoorM`, `lastOut`) is free by this rule; two doors opened inside one look take every free gun
  to the second. No dice, no state in a checkpoint (an Op is not saved); a recording from before the key replays with it off. MEASURED (the rule as it stands, after its review; shipped stand, scripted commander, rule on against off, won · teammates up, no error or stall in any run): the compound on hard, 24 seeds, 11 · 22
  against 10 · 12 of 96 (teammates killed by the man at that door 24 against 36, by anybody 74 against 84); hard, 12 seeds, of 48: barracks 7 · 17 against 5 · 15, block-squads 6 · 13 both run
  for run, the depot 12 · 34 against 10 · 28, the warehouse 9 · 20 against 4 · 8 — four neighbours 34 against 25 won of 48, 84 against 64 up of 192; the compound on standard 4 · 7
  against 4 · 8 (the rule as first cut — any door noise, no one-look rule, door guns not kept — read much the same: the compound 11 · 18 against 11 · 13). `bun run tools/qa/doorlook-check.ts` (`probes.ts doorlook`, in family `roomfight`; both stands; the compound's `g_e`: every man with a line has his gun on the doorway
  inside a second and a half, the man with no line, a door a teammate works and a leaf that stays shut turn nobody, the leaf's second noise starts no look again, the look ends by itself;
  `DOORLOOK_BREAK=1` must fail). Never played by anybody.
- **Four teammates in two pairs** (`NIGHTBREACH.squad` 2 | 4, default 2 = the pair build exactly as it was; `?squad4[=seed]` = the room clear with four + fog, native
  `--squad4 [seed]`, Tab ▸ Sandbox ▸ 'night breach ▸ teammates'; record rebuild/four-squad/men.md): nightbreach.ts `SQUAD4` = Red One / Red Two /
  Blue One / Blue Two, each man's pair IN DATA (`Guard.unit.pair: PairId` via `UnitOpts.pair`) and in his suit (tint / tint2 — untuned, never seen rendered). Red is
  the FIRST pair = `NightBreach.drillOps` (the F drill's two; callOff / the hand-over touch only them); Blue stands by on a goal-less script until ordered.
  **`SquadOrders.men(sel)` is THE one place to ask for men**: `'all'` | `'red'` | `'blue'` | roster number | a Guard → living men in roster order (`{down: true}` = all);
  `pairOf(gd)`, `pairs()`; `Who` accepts a pair (T steps all → red → blue: the *Squad orders* bullet). Every order is generic over n: follow = a file
  1.3 / 2.4 / 3.5 / 4.6 m back, pairs adjacent; move = ranks of two; stack = a file per jamb (`StackPost.group` 0 latch / 1 hinge / 2 second rank or `rearPosts`,
  `lead` = the man AT a jamb), places Sam or a teammate outside the order already holds on that door skipped (a pair / a man sent to a door the others hold files in
  behind them — only with more than two on the roster); `pair(men, spots, groups)` deals 3–4 men exhaustively with a 1000 m price per pair split across files.
  doortools: behind a bang the far-jamb file stands a place back; entry alternates jambs — first two to the plan's deep pods, the next two to near points inside the
  entry wall (`pods(d, side, n)`), a man with no pod stays outside (`outside ·` beat); CLEAR FROM OUTSIDE by three or more = the pair's own choreography for TWO (the
  lead + his pair's man slice from the lead's jamb) and the rest `DoorOp.rear`, on down that wall facing out (the far jamb is in the room's near corner's line through
  the open door: four slicing from both jambs lost 3–4 men a run where the pair lost none); a dead lead's place goes to the nearest mark, not the roster's first.
  BUDGETS: ten characters (`SQUAD4_BUDGET`, `UnitOpts.budget` lifts spawnUnit's 8 up to skinning's 16); the proxy table still holds 8, so while a night breach is up
  game.ts draws the LIVING first once more than 8 are drawn (bodies lose shadow / reflection proxies first; with all ten up the last two defenders spawned go
  without); steady lights 63 of 64 by spawnUnit's count; the PROBE's 32 queries a frame: nine units' meters + lines would be 35, so with more than 8 guards the
  smoke lines of men not hostile to Sam are not asked (29 measured headless, fog's ≤ 6 on top are the first dropped); fog of war takes FIVE eyes (`FOG_EYES`, the
  kernel's two arrays carry the literal). QA: `probes.ts foursquad` (off / stage / follow / stack / clear — incl. charge, outside, lanes — / drill / budget).
  THE PAIRS APART (all behind `orders.big` = more than two men; the pair build is untouched — `probes.ts pairs-off`): `orders.give(id, t, who, { onWord })`; a door order
  goes to the side of the door THE MEN can reach without crossing the room (`forMen` → `sideFor`: penalised nav paths per face; else Sam's side — a pair-aware menu
  should ask `forMen` before greying a row); `Assignment.shy` = a door the walk to a mark goes ROUND, not through (stacks and door tools set it); HOLD by a pair deals
  ARCS (`holdArcs`: the ways out of where they stand split between the two, gun and weapon light up along each, a door within `holdDoorM` watched instead; a man told
  alone keeps the old hold) and the room fight does the rest unordered; a posted gun (`LANE_ORDERS`) comes down while a man of the OTHER pair is in its line.
  doortools: THE WORD — order `'go'` (registered only for the four; `doorTools.go(who)`): everything waiting among the addressed men goes together — a pair on a plain
  stack (→ an open-and-clear from its marks, `fromStack`), a tool given `onWord` (phase `'ready'`, 'ready on your word · …'), a pair held outside, a charge set or still being set (blown) —
  loud ones first, the quiet doors shoved on one frame after (`wordTick`, `wordStack` / `wordIn` caps); the order is ONLY the waiting men's (`OrderDef.only`: the rest keep
  their order, and a drill that owns them is not asked to let go); pairs stacked on both faces of one door: Sam's face goes; a bang on a word spares every order on it; two pairs into one room get pods apart
  (`podsApart`); a tool on a door the other pair is plain-stacked on makes that pair STEP BACK to rear security, its order still `'stack'` (`holders / stepBacks /
  makeRoom`); a charge is refused with a teammate behind the door or with a holder who cannot stand off, and one of ours beyond a blown door is dazzled, never
  knocked down. QA: `probes.ts pairs` (off / side / hold / go / tool / lanes); page rebuild/four-squad/pairs.md in the project files.
  THE FOUR FROM THE KEYS (the press menu + the pairs on one tree; guide rebuild/four-squad/play.md; all behind `orders.big`): the word is the menu's **F row** (`OrderDef.hotKey`: its key shown, no
  digit) on a floor menu and on Sam's / a teammate's own, under its own header (`OrderDef.head` = `WORD_HEAD`; its label names who of the menu's men is waiting;
  `listed` keeps it off a DOOR's menu, where F is 'wait for my word', though give('go') still fits a door target; with that row up F IS the row — greyed, it is
  refused and the menu goes away, the press never reaching the trigger or the drill) AND **F** with no menu (`DOORTOOLS.wordOnKey`, default on — off, the row is digit 5 of those menus:
  `doorTools.input` gives `'go'` to the men the orders go to while anything of theirs is waiting — a set charge of theirs goes with it, and the press is left in the
  frame for a breach drill of theirs that is set / stacking, so one F sends both; nothing of theirs waiting = F as before: a set charge — unless it is on a word
  still waiting for the other pair (`onPendingWord`: swallowed) — else the drill, which never gets the press as its 'stack up' within `wordTap` of a word or while
  its pair is on a door order: a second tap does not pull red out of its entry); a door tool is given ON THE WORD by the **'wait for my word' row** of the door's TOOLS page (WITH `PLANLAY.on`, THE PAGE, THIS IS NOW TWO PRESSES: a row
  picked with it on is LAID and nobody walks; F sends the plan — they walk, stack and wait — and F again is the word; men already stacked go on the one F.
  What follows is the switch off, `?noplanlay` / `TPS_PLANLAY=0`, and the frozen stand. See 'X is where the plan is laid' above) (digit 5
  `ORDERS.waitKey`, or F `ORDERS.waitAlt` — on the door's first page F turns to the tools with the row already on —, or the highlight + Space: it flips
  `Menu.onWord`, which is the menu's and survives a step back a page; the menu stays up, the `OrderDef.onWord` rows —
  open and clear, bang and clear, and the threshold page's three (its opener on the tools page says '· on my word: ON') — read 'wait · …' and are given with `{ onWord: true }`; off again on every new menu; only on a door); the menu
  greys and words its rows for the MEN's face of the door (`Menu.menSide` ← `sideFor`, asked when the menu opens and again only when `Menu.sideKey` changes — the
  men, or one of them or Sam crossing to the door's other face — never on the `refreshSecs` re-read; the header says '· far side' when it is not Sam's); bang and
  clear is refused with a teammate behind the door, like the charge; `orders.notes` may return keyed lines (`OrderNote`): the squad block shows '[F] go · red + blue
  waiting' or 'blue waiting · T, then F', 'word given · waiting for blue', and says 'F blows it' of a set charge only while F would.
  A cursor on a door picks it only where the camera can SEE the doorway (a wall in front hides its foot: point at the visible part, or turn the camera).
  QA: `probes.ts squadplay` (go / wait / try / side / key / off — every order a one-frame press, nothing held).

<!-- was CLAUDE.md lines 2550–2563 -->
- **A teammate works a thing** (`src/game/workthings.ts`, `Game.work: WorkThings`; `WORK.on` — on in the page, `?noworkthings` = as it was; the frozen stand holds it off,
  `TPS_WORKTHINGS=1`): the orders' menu opened on the BREAKER (its own panel under the cursor — `workOn` in targetUnder — or the floor at its foot on its own side of
  the wall — `workNear` in targetAt) or on the MISSION'S THING once the objective is to take it (stage 'drive': the rack's drive, a quiet mission's thing in its holder)
  is a floor target carrying `thing: WorkThing` (`at` = the cell a man stands on to work it, `standFor`, re-read once a second), and `workRows` puts its own order
  (`'work'`, digit 1: 'throw the breaker' / 're-arm the mains' / 'pull the drive' / 'take <thing>') where 'move there' is — so B and the button twice give it. `only`:
  the nearest man who can get there works it, his partner (the other of his pair) covers from a mark behind him on a plain 'move' with `spare` eyes, everybody else is
  left as he was. The worker's `tick`: on the stand cell, squared to it, a clear line → hand out (`workHand` ← game.ts handsOnDoors → the door-hand layer) → after
  `handSecs` + `breakerSecs` (the mission's thing: DRIVE_SECS) Sam's own effect (`Game.setBlackout(86400, 'hand')` / `endBlackout` / mission.ts `drivePulled`), a word,
  then a plain 'hold' with his back to it. A man the orders stop short (his mark moved to his feet) never works it from there; the fight takes him and gives him back
  (hand off, clock over). With the switch on lighting.ts neither hands a TEAMMATE the 'check the breaker' errand nor lets one re-arm it by standing there (`workNotHis`). Nor (`WORK.posted`, on with the switch; false = as it was; `workStaysPut`) is that errand handed to a man who cannot leave where he stands — held, pinned or on a script, so every defender of a room clear: he radioed "power's out — checking the breaker" and stood there. It goes to the nearest man who can walk it, or to nobody; never asked under a show.
  THE ERRAND STANDS AT THE PANEL'S OWN FACE (`WORK.ownFace`, on with the switch; false = as it was; `breakerErrand(g)`, asked by lighting.ts `setBlackout` and `breakerResetNear`, so handwork.ts `leverStand` follows): lighting.ts sent the man to a spot at a fixed offset from the panel and re-armed the mains for anyone inside a bare 1.3 m of another, right only where the panel hangs facing the way the office's does — on the relay station (panel on the compound wall, facing in) the spot is in the wall, one patrol set re-armed it from OUTSIDE the wall and the other never did. Now the fixed spot is kept wherever a man has floor there and a line to the panel (walls only, door leaves out: the office and every level it worked on are the same man, time and place), else the errand goes to `standFor`'s cell in front of the panel's real face with the reach measured from there; and the re-arm always wants nothing solid between his chest and the panel. A recording from before the key replays with it off. `probes.ts work-face` (the fault shown with the rule off on both relay patrol sets, the office unmoved, every level file with a breaker swept: the spot moves exactly where the fixed one is no floor or has no line; `WORKFACE_BREAK=1` must fail).
  A MAN AT HIS THING PASSES OVER A MAN HE MAY NOT SHOOT (`WORK.heldPass`, on with the switch; false = as it was; `workPasses(g, gd, h)`, asked by roomfight.ts where it picks a teammate's target and in `cue()` — a mate's call, a footfall, a look already standing — beside `pairPasses`): with the squad's fire held (silent.ts `silentHolds`: the silent order, the sneak, the hold nobody has lifted, which is the page's own state until the team is found) and a defender who has noticed nobody in his sight, the man sent kept his muzzle on that man, the room fight turned his chest to him, the order turned it back to the panel, and the thing was never worked for as long as the hold stood (seen as `work-breaker` red on the shipped stand once a deal stood a defender in view of the office's panel). Now, stood on the spot his thing is worked from (`atThing`: arrived, within 0.45 m of the stand), that man is not his target and neither a mate's call nor his footfalls turn him: he works the thing, and a man who covers him has the defender (a man sent alone turns his back on him: that is the order). The frame `silentHolds` no longer holds his round (the man is alert or searching or past the `noticed` bar, the hold is lifted) it is false and the fight has him as ever, the hand coming off. NOT passed, by design: a man held only by spotted.ts's rule (suspicious, or roused and no danger yet) or only for a pane in the way (`silentGlassHolds`) — he has noticed something, the gun stays on him, and the thing waits. A door an enemy opens in his sight is still looked at. On the walk there nothing changes. With the key on `silentHolds` is asked in the target pick for the man at his thing, so the holds' own `held` counts rise there. A recording from before the key replays with it off. `probes.ts work-held` on both stands (the fault shown with the key off: 45 s at the panel, muzzle on the man, mains on; key on: mains out, no round, the cover's gun on the man for every frame the hand is out, the hand out once; the same with the man's footfalls in their ears; the man made to notice with the hand out is the worker's target and is shot; `WORKHELD_BREAK=1` must fail). Measured on the office's room clear, one seed, the breaker only: a drive or a charge (several seconds of hand) was not staged. Nobody has seen or played it; nothing here was drawn on a GPU.
  A FOLLOWER IS NOT LEFT STANDING ON THE WALK OF THE MAN WHO COMES TO THE BREAKER (`WORK.offWalk`, `walkM` 2.5, on with the switch; false = as it was; `workComing(g, gd, h)`, asked by sneak.ts `sneakFollow` and by spotted.ts `hide`; 10-18, from a replay of play on lights out as two, hard: the partner threw the breaker on order, 'fall in' came 1.2 s later, Sam walked on past the man sent to the panel, and the partner — the sneak's follower, 'holding. it's lit and he's looking.' — waited 4 m from the panel for that man's back, ON that man's walk, for five seconds until the man reached him: 'he's made me! contact!', the alarm 11.8 s after the throw; a headless re-run of the tape matched the page to 0.01 m and named the rule). True of a defender who carries the mains errand (lighting.ts `task.kind 'breaker'`, said on the net: 'power's out — checking the breaker') and is walking it (suspicious, his route's end the errand's own spot: not a patrol leg he has yet to leave, not a noise he turned off to) when the teammate is within `walkM` of what is left of that walk — where the man stands, the corners of his route still ahead, the errand's spot — with nothing solid between him and it. For THAT man, while Sam is going on (Sam moving, or the follower not yet at his place), the follower does not wait short of a stretch the man is looking at, does not keep him as a remembered looker, does not back off down the way he is coming (sneak.ts: he crosses after Sam, as low as Sam), and is not stood still by spotted.ts's freeze (he is still on a knee whenever the man has a line to him). Once the man is past him (the walk left no longer passes within `walkM`) every one of those rules is his again: on the tape's run he then knelt still 2 to 3 m off while the man went by, and followed on. NOT changed: a suspicious man on any other business; ANOTHER man's eyes on the stretch, or the line of a shut door Sam is at (those waits stand); Sam stood still on the walk with the follower at his place (the back-off and the freeze are his as before); a partner POSTED at the panel (he holds there until moved: the maintainer's call of 10-13 stands). KNOWN, not built: the crossing follows Sam's steps whatever they do — a trail that runs up the man's own route meets him head on (it is Sam's lead; on the tape he passed 2.0 m off); no hysteresis at `walkM`; the same hole stands for any suspicious man who walks to a noise where the follower waits (a claim for the sneak's owner; since mended behind `SNEAK.noiseWalk`, team-feel.md). Measured headless, the men's own senses (nobody dazzled, Sam not kept dark), one seed, the level's own mission, Sam moved along the taped way at 1.4 m/s: key off, still on the walk 2.6 s (frozen stand with SNEAK and SPOTTED raised) / 3.5 s (shipped), the man alert at 11.2 / 11.7 s; key on, nobody roused, the man put the mains back at 16.0 s, the follower passed 2.0 m from him in the dark and ended at Sam's shoulder, low on 581 of the 585 frames of that walk, fastest 1.45 m/s. The tape re-run with the key raised by hand: the partner crossed at 40.9 s, passed 2.5 m from the man, the man re-armed the mains and went back to his patrol, nobody alert up to 61 s (past the point the re-run parts from the tape the page's GPU reads are served stale: an indication, not a proof). QA `probes.ts work-walk` (six lines, green on both stands, the neighbours' `sneak`, `spotted`, `pair`, `pairup`, `lights-out`, `journal`, `shipped` families green beside it; `WORKWALK_BREAK=1` fails three of them). A recording from before the key replays with it off (journal.ts). Nothing drawn on a GPU, never played.
  A job on a thing of the RUN's (`drive`, `defuse`) ends with no word when the run ends under the man's hand (Sam down: `tick` asks `g.player.down` ahead of `moot`, whose "it's already gone." would be false of a thing still in its holder), and 'charge is safe.' is said only once `defuse.states[i]` reads safe after `makeSafe` (which has its own reasons to do nothing); a breaker job goes on, the mains being the level's.
  No save slice (a checkpoint is refused with a unit on the floor); a recording without the table replays with it off (journal.ts). QA: `probes.ts workthings`
  (work-breaker / work-four / work-objective / work-edges / work-posted / work-face / work-held / work-walk / work-defuse / work-off / work-harness). A pose layer reads `workHand(g, c)` (where and when: the
  thing's face point, its normal, weight) and `workJob(g, c)` (what: verb `breakerOff | breakerOn | drive | defuse`, seconds in, seconds it takes) — reads only; the pose is not this file's.
- **The squad's plan is drawn on the floor** (`src/game/floorplan.ts` = WHAT, `src/ui/planfloor.ts` = the drawing, index.html `.plan …` = the look; `PLAN.on` ON on every stand — it is picture only —
  `?noplan` = nothing drawn; Tab ▸ Squad ▸ Order menu & keys ▸ 'plan drawn on the floor' + three part rows, this visit only; page rebuild/plan-on-floor/read-first.md).
  `floorPlan(g)` ONLY READS: the squad's assignments as they stand (`orders.of(gd)`), each man's own nav path (`gd.path` from `gd.pathI` where `gd.pathGoal` is this order's and the path runs
  to it, else the nav grid's answer kept ≤ `reaskSecs` in the ASKER'S own store (`PlanKept`, since 2026-10-23: the module keeps nothing; see 'An order's line starts on the leg he is on'); no way on the floor = nothing drawn, never a line through a wall), the
  open menu's men, and the books of whatever waits on the key. Per living teammate WITH A MARK (`Assignment.post`, or the order's own `goal` a step off it with no `via`: the unasked cover's
  step; a follower has none and is not drawn): walking = the dotted WAY feet → corners (`via`) → mark, a dashed ring at the mark with his two-character tag IN it (`planTag`: 'R1'), the fan
  he WILL watch; standing (his feet within 0.45 m of the mark — not `A.arrived`, which also wants his gun round) = the ring filled, the tag UNDER it, the fan along his gun AS IT POINTS
  (`aimYaw`: the cover's deal, a fitted watch, the rear watch all show), a hair line to his order's door while his gun is on it (to any other watched point only while the order is fresh);
  taken off his order by the fight (`yieldT` ≥ 0) = the mark alone; on a man under the order (`script.over`) = all of it, dim. An order under `freshSecs` 2.5 old is drawn at full strength
  with a ring at each man's feet (WHO); the menu up rings the men its orders go to, and the one whose menu it is in gold (`FloorPlan.you`, `.py`; his word 10-13: 'when hitting x we should have the player with a gold circle'). Every ring is a 48-point floor circle (`RING_N`; 14 showed corners on his screen). Colours = the man's pair (`.t-red` / `.t-blue`, gold for a mixed door, the HUD's green for a squad with
  no pairs). NOTHING OF AN ENEMY: a man whose order took its mark from a foe (`Assignment.foe`: the quiet pair's take / watch) is listed only while the team's fog has that foe seen and
  never with a watch; a watched point is drawn only where it is the order's own door, the room fit's, or the player's own point (cover / move / hold) — a door tool's 'threat first' writes
  a SENSED place into `A.watch`; a new writer of `A.watch` / `A.post` that reads an enemy must keep to that. `doors` = everything WAITING ON THE PLAYER'S KEY — `waitsOnKey` REPEATS, as a
  reader, the press rules of files that are other goals': doortools.ts (`waiting4` + `thresholdHeld` + `set` + `input`: the word to what the addressed men have waiting, else the nearest free
  set charge; the pair's word takes its set charges too; a charge on a word already given is nobody's), wallcharge.ts (`set` + `input`: it has the press first where its charge is nearer
  Sam than any door's) and the room clear's drill stacked (`nightBreach.state === 'set'`) — a rule changed there must be changed here, and plan-check's key lines (F pressed where the bar
  has no key: nothing goes; where it has: it goes) are the tripwire. Drawn as a bar across the doorway (along a wall charge's wall), dashed, and solid with the key (`DOORTOOLS.blowKey`'s
  letter; filled for a charge) on the one the key pressed NOW would send; none while Sam is down. PER SEAT, for a second player: `who` and a door's `now`; `men` are the squad's. Hidden
  under body.breaching / attract / blinded (nothing asked then). A TEAMMATE'S THROW (`PLAN.throws`, `FloorPlan.throws: PlanThrow[]`;
  Tab row 'plan ▸ a teammate's throw'): squadthrow.ts's own reader `squadThrowPlans(g)` drawn in the plan's marks — a filled ring under the thrower, his walk dotted to a ring
  where he will throw from (only if his order's way is not already drawn), the arc dashed through the air and on along the floor (the reader's arc ends at the first bounce, 2 m short on the check's throw: floorplan adds the last leg), a ring where it comes to rest and, for a frag, a faint ring at
  `FRAG.lethalM` round it; fainter while it is only OFFERED (the throw page up), full once ordered, gone when the thing leaves his hand (a throw from where he stands is listed
  only while offered). While the plan draws them `planDrawsThrows()` is true and `ui/squadthrowviz.ts` (the throw order's own stopgap picture) draws nothing — its one clause;
  `PLAN.throws` or `PLAN.on` off hands the picture back to it. ONLY IN THE ORDER MODE (`PLAN.menuOnly`, ON on every stand — picture only; `?planalways` / Tab row 'plan ▸ only with the order menu up' = for as long as the
  orders stand, as it was; his word 10-13: 'they should only show when you're in the mode after pressing x. in normal gameplay they shouldn't show up'): with no
  menu up (`FloorPlan.mode` false) `men` holds only a man whose assignment is since an order the ORDER BOOK was given inside `freshSecs` (`S.log`: a module's own
  re-assign is no order and shows nothing), aged from that order and faded out by planfloor; `doors` (the key) and an ordered throw are NOT held back — a prompt and
  a grenade, not the plan. The diamond with a distance in his shot is the mission's objective mark (ui/overlay.ts `.objmark`), the small ring the aim reticle: not
  the plan's. plan-check 1‥10 run with it off, 11‥16 with it on, 17 is the rule. THE TWO OTHER READERS OF THE KEY (10-13): the rescue's entry held for its second word (`g.rescue.entry` with `gate.go` false, `active`, no `result`:
  a bar on each live op's door from the first F on; `now` only where the press gets PAST the pair, a set wall or door charge, the door tools' word and the drill —
  rescue.ts reads the key LAST) and the quiet pair's mark (`g.pair.waiting()`: `why: 'pair'`, no door — a 0.6 m bar `PLAN.pairBarM` ahead of the waiting man's feet
  across his gun's line, the key on it; pairorders.ts reads the key FIRST, so while a man waits on the mark no door's bar has the key). The pair's bar is at OUR
  man's feet, never at the man he waits on. NOT here: enemies, time; the rescue's FIRST F (it stacks them: an order, not a wait). QA: `probes.ts plan` (tools/qa/plan-check.ts, also under `squadorders`; both stands; `PLAN_BREAK=1` must fail; its last lines
  = asked every frame, the run's digest is the same; the pair's drill) and, on the real page (software adapter, starts its own dev server), `node tools/qa/plan-look.cjs [--q '<query>']
  [--name n]` = nine stills (given / walking / on marks / menu / stack given / stacked + the bar / a throw offered / the throw ordered / off)
  with the SVG's counts beside each. Never seen on a GPU.
  **A MAN WITH NO THROW WALKS TO ONE** (`SQUADTHROW.walk`, on with the switch; Tab ▸ Squad ▸ 'throw order ▸ a man walks to a throw'; off = such a spot is 'no throw from here.' as above; a
  recording whose SQUADTHROW table has no `walk` replays with it off; the maintainer, 10-13: "it would be good to have the squad move to do a throw (and maybe visualize who's doing it and the path
  on the ground?)"). Only where NOBODY addressed has a throw from where he stands: `walkSpot` floods the nav grid out from the men who may be walked (`mayWalk`: no drill owns him, not in a door
  tool's or a wall charge's op, not in a fight — 'alert', the fight AI's lease, or the room fight's gun on a man (`fight.opOf(gd).tgt`) —, not a stack's or stand-off's rear man (`Assignment.spare`), his order none / move / stack / cover / hold / fall in) — 4-neighbour, ≤ `walkM` 12 m COUNTED IN GRID STEPS, never through a door leaf where it stands nor a room the squad
  has not been in (and the way the ORDERS' own router would then walk him is asked the same: `wayOk`) — and takes the first cell `minM`‥`maxM` from the spot with a clear line at head height AND from the hand to the spot's floor, an arc that also holds from 0.3 m to each side
  (he stops within a stride of his mark), no own man in a frag's reach of the spot or of where it rests (the thrower judged where he WILL stand), and a walk the orders' own `reach` allows; ≤ `tries` 12 arcs a search, the answer kept
  `keepSecs` 0.4 — the menu's and the order's kept apart from the picture's, so what is drawn never decides what the game reads — (0.2 ms an arc, 1‥2 arcs a search on the office and 32 at most; the check bounds a search by its ARCS — `tries` × 5 — and only prints the time: a wall clock is the machine's). GIVEN, he is `assign`ed that post UNDER THE ROW'S OWN ID ('moving to throw.', HUD 'moving to throw · frag');
  the row's `tick` (`walkTick`) throws once he is there, turned and has an arc from where he really stands (asked again; none = one more search, twice, then 'no throw from here.'), every refusal
  asked again at the hand; THE CAN IS TAKEN AT THE THROW, so an order that takes him mid-walk (any `assign` not this walk's: swept in `squadThrowKey`) or `walkSecs` 16 running out spends nothing.
  THROWN, HE GOES BACK (`SQUADTHROW.back`; off = he holds where he threw), in an order group of his own: fall in = the fall-in order given him again, move / stack / cover / hold = that assignment at the mark he left — unless it was shared and no man he shared it with still holds it (the stack gone in without him: a hold at the mark he left) —, else a hold where he stood. A frag is refused AT THE HAND, nothing spent, if one of ours has stepped into its reach meanwhile ('you are in it.'). A frag's own
  reach rule means a walked frag is thrown from 9‥11.5 m with a straight line; a stun walk is usually a short hop to a line. Teammates never run to it (the team's pace). THE PICTURE
  (`SQUADTHROW.draw`; `squadThrowPlans(g): SquadThrowPlan[]` = {gd, from, points, land, kind, preview?, walk?} — one `preview` entry while the throw page is up on a spot with a throw row highlighted (that row's throw and no other: what is drawn is what the next pick gives), one live entry per walk until the thing leaves the hand — drawn by `src/ui/squadthrowviz.ts` on the overlay's `#traj` SVG in the thrower's pair colour: a ring at his
  feet, his walk dashed, a small ring where he will throw from, the arc, a ring where it comes to rest and, for a frag, a dotted ring at `FRAG.lethalM` and a fainter one at `FRAG.woundM`; no words; a floor-plan drawer may
  read the same export instead). `bun run tools/qa/squadthrow-walk-check.ts` (`probes.ts squadthrow-walk`, in families `squadthrow` / `squadorders`; both stands; `SQUADTHROW_WALK_BREAK=1` must
  fail); squadthrow-check.ts pins `walk` off (it asks about throws from where a man stands). On the real page: `THROW=1 PORT=<dev server> node tools/qa/page-look.cjs <outDir> four='…&roomclear&squad4&freshstart=0'` (the throw page, the walk and the throw, a still each; `__squadthrow`). KNOWN: a walked frag is a long lob, so indoors it is often refused where a stun is not; a man in a fight, owned by a drill or keeping the rear is never the one walked, so a squad all busy says 'no throw from here.'. The drawing has been seen only on the software adapter.
- **A man works his throw out; a frag is thrown where the men can duck; a frag near the player is his call** (`SQUADTHROW.lob` / `.duck` / `.samCall`,
  three keys under the throw order's switch, each ON in the module like `walk` and inert on the frozen stand, where `SQUADTHROW.on` is held off —
  `TPS_SQUADTHROW=1` raises all of it; `?throwlob=0` = the straight arc or nothing as it was, and the other two off with it; `?throwduck=0`; `?samcall=0`;
  Tab ▸ Squad ▸ 'throw order ▸ a man works his throw out' / '▸ frag where men can duck' / '▸ a frag near you is your call'; a recording
  whose SQUADTHROW table has no `lob` replays with the three off; squadthrow-check.ts's rig pins `lob` off, so the older throw / walk / plan checks ask
  what they asked). The maintainer, 10-15: "ordering your squad to throw a grenade is still pretty useless. they should figure out how to throw to a
  spot". WHAT IT WAS, measured headless on the shipped stand, the office with the four holding by Sam, 270 floor spots 2.5‥15 m from him: a frag at a
  spot he could SEE was refused 88 % of the time ('you are in it.': a frag reaches `FRAG.woundM + 1` = 9 m and he is in the room), usable 11 %; over all
  the floor, no throw 67 %. THE THREE RULES. `lob` (`src/game/throwplan.ts`): `throwFlight` is the item pool's own step (throwables.ts `update`: two
  half steps, the swept ray, the bounce, the safety floor) and the fuse's own rule (a frag's from the hand, a canister's from first contact, `maxAir`)
  flown from a hand at a velocity to where it GOES OFF, moving nothing and throwing no die — KEPT APART from throwables.ts (the gear goal's file): a
  change to how a thrown thing flies runs `probes.ts squadthrow-lob`, whose first line throws twelve for real against the forecast. `throwTo` tries a
  man's throws at a spot — straight at `lobPaces` (the solver's 7.5 m/s, 10, 5), then at up to `lobWalls` walls within `lobWallM` of the spot
  (`throwWalls`; `lobBankPaces`), each only with a line from his hand — and takes the one that goes off nearest it: within `lobNearM` 1.5, no more than
  `lobUpM` over its floor, nothing solid between, and STILL by it when flown at each of `lobSteps` (1/120, 1/40: the page steps at the display's rate,
  the forecast at a sixtieth). `squadThrowPlan`'s order: the straight arc from where a man stands · a worked-out throw from where a man stands · a walk
  to the straight arc · a walk to a worked-out throw (`walkSpot`'s second flood: `lobCells` cells with a line from the hand to over the spot or to a
  wall by it, the same throw holding a step to each side) — and under `lob` the first that is CLEAN (a frag that catches nobody of ours, the thrower
  where he will stand; the player is the row's own question); nothing clean = the first found, and the row is refused by name as before. A search
  flies `lobSims` 48 throws at most (+ half for the men where they stand), its answer kept `lobKeepSecs` 1 s; a walker comes to a stand `settleSecs`
  0.5 before his throw is asked for again (a walking man's hand is lower: three walks in forty ended 'no throw from here.' before this), re-flies the
  throw he walked for from where his hand now is, and turns to the way it leaves his hand. `duck`: the squad already steps off its own frag
  (frag.ts `fragFlee`); `fragClears` asks `fleeSpot` — the same function, the squad's pace, `duckSecs` 0.5 of the fuse in hand, `duckThrowSecs` more
  for the thrower, later for a man far from the hand — BEFORE the throw: a man whose dealt spot the burst has no line to is not 'in it'. Never inside
  `duckMinM` 5 (what it kills at + 1), never to a spot within `duckApartM` 1 of another of ours or of another man's spot, only with `FRAG.fleeWise`
  on (so inert on the frozen stand unless that is raised too), and a cell thrown from on the strength of it must hold at eight steps round it; a walker
  who stops short of such floor looks again instead of calling it off. `samCall`: a frag that reaches the player and nobody else of ours is thrown and
  the row reads ' · too close: you' (never inside `duckMinM` of him: refused as before). The frag verdict is kept 0.3 s for the menu's and picture's
  per-frame re-reads (`squadFragCatches(…, kept)`), never for the order's own ask nor the hand's. MEASURED (headless, never on a GPU, nobody has
  played it): the check's office lattice, 661 spots — a frag nobody of ours is caught by 90 → 161 (shipped; 133 frozen, where `duck` is inert), a stun
  210 → 221, none lost; frags ONLY the duck rule allows, ordered and thrown for real with the team mortal, 30 spots a level on the office, the depot
  and the barracks (scratch runs, one deal each): 88 of 90 thrown (two called off at the hand, by a mate's name), 0 of ours killed, 1 WOUNDED — a
  thrower whose real flee was dealt, with the thing still in the air, a corner hidden from where frag.ts `rollOn` guessed it would rest and open to
  where it did (the forecast here knew: worst 0.15 m between forecast and burst over the 88; 60 stuns, worst 0.11 m). Two earlier passes of the same
  120 found three other wounds, each closed by a rule above (a mate pushed out of cover by a man ducking to his corner → `duckApartM`; throwers
  stopped a stride off their floor → the eight steps, the stand, the second look; a thrower inside 4 m → `duckMinM`).
  COST: 3.8 ms a search that finds nothing, worst 43 ms on a loaded machine (48 flights), at most once a `lobKeepSecs` for a spot. NOT DONE, on
  purpose: nobody opens a shut door for a throw (a room behind shut doors is still 'no throw from here.': the door orders' ground); a hidden mate is
  not held behind his cover while it burns (frag.ts lets a man on an order walk); the real flee runs from `rollOn`'s guess, not from this forecast
  (the wound above: a claim for the gear goal — let an ordered frag carry where it will go off). SINCE (10-15, on the build that carries the gear
  goal's `FRAG.restProps` / `fleeApart` / `fleeOnto`, `?nofleemates`): the duck forecast asks `fleeSpot` as the deal does — of the man himself
  (`who`) and with the deal's own list of the floor his mates have a claim to (frag.ts `fleeMates`; `?nofleemates` = the forecast as it was). Two men
  forecast to one corner is still a refusal (`duckApartM`: the deal tells men in the order they hear it, which the forecast does not know); the list
  is read from where the men stand NOW, so a thrower forecast at a far post is judged again at the hand, as before. The same 90 frags again
  (scratch runs): 88 thrown (two walkers on the depot called it off at the hand, aloud), 0 killed, 0 WOUNDED, worst 0.35 m forecast to burst; the lattice 90 → 163 shipped (133 frozen, as it was). `bun run tools/qa/squadthrow-lob-check.ts` (`probes.ts squadthrow-lob`, in `squadthrow` /
  `squadorders`; both stands; `SQUADTHROW_LOB_BREAK=1` fails six of its eight lines on both). THE ROW ASKS WHAT THE SEARCH ASKED (10-15, under `lob`): the row is
  the thrower's alone (`only`), and asked of him alone the search was another one — its count of flights not shared — so it could come back with a
  throw that catches a mate where the squad's caught nobody: a clean throw refused by a mate's name. `only` now leaves the men it was asked of
  (`State.asked`), the row's question goes to them first and stands when it still names him and catches nobody; else he is asked alone, as before.
  The two answers are kept apart (the kept slot's name ends '1' for one man): before, each put the other out, so every opening of the page and
  every refresh of it (orders.ts `refreshSecs`, one a second — not every frame) searched two or three times over (measured headless: ten openings
  of the page on one worked spot 1,110 flights → 37). On the build with `FRAG.wallFlee` the lattice
  reads frag 84 → 147 of 661 shipped (walls a burst opens are no cover: fewer spots anybody may throw at, with the rule or without).
- **Esc is only the pause; Tab backs out** (`src/game/backkey.ts`, `BACKKEY.tab`; the maintainer, 10-17: "esc is overloaded -- exiting out of menus as well as
  going to pause. maybe we make tab exit out of menus and esc is always pause?"). SWITCH: ON in the page (`?tabback=0` = Esc backs out first and pauses only
  with nothing to back out of, as it did), OFF in the module and on the frozen stand (`TPS_TABBACK=1`); the table is in the knob registry and the journal,
  and a recording from before the key replays with it off. WHAT ESC BACKED OUT OF, and Tab does now: the squad's order menu (a page of it: back to the first
  page), the open Space list, a running sustained verb (the leaf being eased, the pick, the choke, the drive), the launcher's held arc. In the tick the back
  key is a press like any other (`backTake` in orders.ts with the menu up, `backHit` in interact.ts and player.ts); an Escape that reaches the tick still
  backs out, so the harness's presses and an older tape's hold. ON THE PAGE no Escape reaches the tick with the rule on: main.ts takes the press out of the
  frame's keys and toggles the pause, so no recording holds it. `'Paused'`: a key let go under the pause card would act on the tick play comes back (the
  list does its row, the launcher sends its round), so with the rule on the loop (`host/loop.ts`) hands the first tick after a frozen frame the one-tick code
  `'Paused'`, as Input hands it `'Blur'`: interact.ts shuts a held list with its press spent, player.ts lets go of a held arc unsent. It is a press in the
  tick's keys: a recording carries it, a replay does the same, and nothing of the game changes between ticks for it (the start card is a frozen frame too:
  a run's first tick holds one, and it is nothing to that tick). The order menu and a running verb are still there after the pause. TAB'S TRIAL
  (`ui/tabkey.ts`) keeps the key whenever there is nothing to back out of (`Game.backable`, which counts a verb that cannot be taken back, the knife in the
  hold and the breaker's lever, for the half second it runs); with its 'who' choice Tab no longer steps who while the order menu is up (T does).
  WHAT SHOWS: the order menu's line and the Space list's line name `tab` where they named `esc`; Options ▸ Controls gains a Tab row under Esc. NOT TOUCHED:
  the screens outside the fight (the pause card and its options, the mission list, team and kit: Esc is still back there), the showcases (Esc ends one),
  a focused field of the debugger (Esc lets go of it). Check: `tabback` (family `orders`; each of the four staged as play stages it, rule on and off, then
  the pause under `stepFrame` with Space let go under the card, the same keys tick by tick as a replay gives them, the switch in a recording;
  `TABBACK_BREAK=1`), both stands. Never seen on a GPU.
- **The throw page's picture writes nothing of the game's** (2026-10-23; `squadThrowPlans(g, V)`, `SquadThrowKept` / `squadThrowKept()` in
  src/game/squadthrow.ts; `Collision.aside` and `NavGrid.aside` in src/scene/collision.ts). The page's preview is a whole search (flights, walks, who a
  frag would catch). It kept its answer in `squadthrow.states` (the 'v' slot) and looked with the game's own tables, so a game drawn and the same game
  not drawn differed in whole state, run digest equal. Now the preview is asked ASIDE: its kept answer, its verdict of who is caught and the walk
  search's marks live in the asker's store (ui/squadthrowviz.ts keeps one a game, the floor plan's `PlanKept.throws` carries one; a store asked of another game starts empty; with none handed in nothing
  is kept and every ask is a whole search), the rays and path searches run on the asker's tables (`Collision.aside` swaps the query stamps, the segment
  scratch, the cos / sin cache and the walk grid's search tables, and holds off the sound routes' cache: `SoundPaths.asking`), the walks the orders are
  asked about are kept in the store too (`SquadOrders.askAside` swaps `reached`), the duck's memo (`duckMates`) is put back as it was, and two answers OF
  THE TICK that other modules keep by game (`frag.WALLS_FOR`, `seenwalk.shared`, named in `TICK_KEPT`) stand aside while it asks and are put back. Not a switch: the picture is the same (the check's `same`
  line) and no run digest moves. CHECK: `bun run tools/qa/throwview-check.ts` (probe `throwview`, family squadthrow), both stands,
  `THROWVIEW_BREAK=1` must fail `state` and `ask`: a frag and a stun, worked-out throws on and off, one seed; lines state (two games, thirty frames of
  the page), ask (ONE game with a fight on and the men shifted about, 150 frames: the state hashed before and after each ask, the module variables
  looked at — before the mend an ask wrote `orders.reached` on 4 to 11 of them), none, same, plan (the floor plan asked on its own store), kept (1 or
  2 searches in the thirty frames with a store, 30 with none). One break for all the swaps: it does not prove each apart; the sound cache and the
  duck memo were mended from a review's reading and were never seen writing in a run. A NEW cache a
  search fills in turns `state` red on the stand that has the rule, and the line prints the table's name: add it to `TICK_KEPT`, or to
  `Collision.aside` when it is the collision's own. NOT COVERED: `squad40Plans` (the 40 mm's picture) was not looked at; `orders.hud()` read with no
  menu up writes `orders.hov` (a drawn game differs from an undrawn one there too, digest equal). Never seen in a page.
- **The cursor's pick, read for the picture, writes nothing of the game's** (no switch: nothing a player reads, and the run digest never moved).
  `SquadOrders.hover(kept?)` is what the HUD's lines and the ring's hint read every frame. Its answer was already kept in the asker's store; the
  pick under it (`targetUnder`) still wrote the game's own state, so a game whose cursor is read and the same game never read differed in whole
  state on EVERY frame, run digest equal. Measured writers: `world.rgStamp`, `rgRay`, `rcBest`, `rcBi`, `rcBn` (frozen stand); on the shipped
  stand also `game.col.stamp`, `stampId`, `cellStamp`, `game.work.cache.t`, and with a leaf swinging `doors.list[].posAngle` / `posAt`. Found by
  a review's reading, never seen written in a run: `wallcharge.skyMemo` (the simulation's own ask of the aim point usually fills it first).
  Now the read runs the pick inside five wrappers, on `HoverKept.pick` (made anew for another game), or on a throwaway store when none is handed
  in: `Collision.aside` (the collision's query stamps, cell caches and path scratch, as for the throw page); the new `BoxWorld.rayAside`
  (`src/scene/boxes.ts`: the world's ray grid stamps and counter swapped, its last-hit scratch put back); the new `WorkThings.askAside`
  (`workthings.ts`: the list of things to be worked is kept in the asker's store for its second, the game's own kept list put back, no hand
  record dropped); the new `Door.posAside` / `Doors.posAside` (`doors.ts`: each leaf's kept centre put back); the new `skyAside`
  (`wallcharge.ts`: what the ask adds to the memo of sky faces taken out again). ONLY the read is aside: the pick the simulation makes for
  itself on a key or a click (`orders.ts` update, `planmode.ts`) is the game's own and unchanged; `host/handsoff.ts` (the hands-off driver)
  still asks it straight. IN THE PAGE this changes two small things nobody has looked at: a key press no longer finds a list of things to be
  worked that the HUD made up to a second before (it makes its own), and stale hand records are dropped only on the simulation's own asks.
  CHECK `probes.ts hoverpick` (`tools/qa/hoverpick-check.ts`; families squadorders), the squad mission on the office, seed 11, eight seconds,
  the cursor carried round Sam, onto a teammate, onto a door and (shipped stand) onto a wall a charge might go on, moved after the step so the
  read comes before the simulation's own ask of the point, a door swung twice; the cursor's points are found on a game of their own. Lines: ask
  (ONE game, the state hashed before and after each read, with the store and with none, and the module variables looked at: 0 of 480 frames),
  state (read every frame against never read: whole state and digest equal), same (the pick aside on the kept store is the pick straight on all
  480 frames: kind, place, door and side, man, wall, thing). `HOVERPICK_BREAK=1` (the pick asked straight) fails ask and state on both stands:
  one break for all five wrappers, it does not prove each apart. One seed, one level. NOT ON THE CURSOR'S WAY: a man of the other side, a
  thing to be worked, a leaf drawn in the fog of war, the room seen through a doorway. THE HUD'S ROW LIST IS HELD TOO (10-23): on the
  shipped stand `SquadOrders.hud` filled the wall charge's memo of digitless rows (`wallcharge.ts standIns`) the first time it listed a
  floor's rows; that memo is a module `SideMap` marked `asMemo()` now (the charges' own mend), and the check's read asks `hud(kept)` every
  frame after the pick, so `ask` and `state` stand for the whole HUD read. The store is outside the rollback snapshot (scratch and a list a
  second old). Never seen in a page.
- **The squad reaches you, and the quick key says why** (`src/game/squadnet.ts`, table `SQUADNET`, one `SquadNet` on the Game as `game.squadNet`;
  drawn by `src/ui/bubbles.ts`; Tab ▸ 'Squad net'). The maintainer picked it from the AI legibility doc: "The squad reaches you, and Q says why.
  Off-screen teammate lines arrive near you with a radio click, a man down has its own sound, the Q row says 'Bang and clear. Nobody's been in
  there.', and 'clear' means clear." Three rules from that pick, a fourth found while building it and a fifth from his first play note, a switch each, all ON in the page and OFF in the
  module and on the frozen stand.
  FAR LINES (`SQUADNET.on`, `?squadnet=0`, `TPS_SQUADNET=1`): a bubble was drawn only over a head on the screen, so a teammate's line said two
  rooms off was said to nobody. With the rule his bubble is drawn NEAR YOU (`SQUADNET.near` × the view's shorter side from you, toward where he
  is on the screen; about the middle of the view while you are off it yourself: the plan's camera, a man watched) as `↙ Red One: stacked up.`,
  class `bubble net` + his tone, one row, each further line a row higher, never under a HUD card. `say()` asks `squadNet.line()` for a click
  when his head (`guards.ts headOf`, the point and the `onScreen` test the HUD draws by) is off the screen: `'radio'` at `SQUADNET.click`, rate
  `clickRate` 1.3 so that it is not the defenders' net's squelch (cues.ts, rate 1), once a frame. A teammate whose state turns `dead` is a row of
  its own on `squadNet.rows` (`Red Two is down.`, 5 s, drawn over where he fell while that is on the screen and near you otherwise) with the
  same voice louder and at rate 0.55: there is no voice of its own for it in `audio/sfx.ts` yet, that is the sound work's to make. Nothing
  writes a `Guard.bubble`: the run with it on is the run with it off by digest (the check holds it). A man already down when a run starts or a
  checkpoint loads is not called; a roster stood up again under the same names is. NOT DONE: a line said on the screen whose man the camera
  then leaves moves to the near place with no click; a cue's own bubble (`cues.aside`) on a far teammate is drawn near and does not click.
  AT THE EDGE (`SQUADNET.edge`, `?netedge=0`, `TPS_NETEDGE=1`): his note on playing the first rule, "the off screen 'red two: moving' is nice,
  but it should be more towards the edge of the screen". `squadnet.ts netPlace()` is the one place `bubbles.ts` asks where a far line goes:
  with the rule, where the straight way from you (the middle of the view while you are off it) to the man leaves the view, `SQUADNET.edgeIn`
  (0.04 of the view's shorter side, a slider under Tab ▸ 'Squad net') inside the border with the line's own box kept whole, or at him where
  he is inside that; off, `near` out from you and up a row from a taken one, as it was. Where you stand out by the border yourself the way is
  laid from a point 0.15 of the shorter side further in, so a man past your border does not put the line on you and it does not jump as his
  bearing crosses straight up. A spot that lies on something moves ALONG THE BORDER it is at, the nearest free place first: up or down a row
  at a side border; at the top or the bottom a row or two in (two men off the same way read as a list), then sideways. What it keeps clear
  of: the far lines already drawn, the HUD's cards, and with the rule your own figure (a box about it) and the objective's mark (its diamond
  and metres, read off the mark's own element). A teammate behind the eye's plane (far down the screen with the view zoomed in) was dropped
  with no line though the net had clicked: with the rule he is called at the edge his way (off: dropped, as it was). The page's alone: no run
  reads it. A man-down row off the screen goes by it too. NOT SEEN: any of it on a GPU or in play; the objective's mark and a far line
  together; a line for a man behind the eye; a view zoomed by the text size setting. A line whose edge place is under a wide card can end
  several rows or a line's width from where the way to him leaves the view.
  WHY (`SQUADNET.why`, `?qwhy=0`, `TPS_QWHY=1`): `squadnet.ts whyWords(pick)` gives the reason when the autopilot's pick on a door the men wait
  on is not a plain open: at the end of the quick key's row (`orders.ts hud()`, one `autoPick` a frame for the words and the reason) and in the
  answer of the man who takes the order (`GiveOpts.ack`, in place of the row's own; `autoQuick` and a plan's `quickFor` both pass it):
  `nobody's been in there` / `banging it. nobody's been in there.` · `they see one inside` / `banging it. i see one in there.` · `they're saving
  the last bang` / `going in. i'm saving the last bang.` (`AutoPick.kept`: an unknown room opened plain because `AUTOPILOT.keepBangs` holds
  the last stun) · `they can't open it` / `we can't open it. setting a charge.` (the press only: the HUD's line asks no lock). A plain open, a
  silent squad and a stack say nothing more; no press waits. The answer changes a bubble's length, so a run with it on is not the run with it
  off by digest once such a line is said.
  CLEAR (`SQUADNET.clear`, `?honestclear=0`, `TPS_HONESTCLEAR=1`): the lead's call at an entry's end (`doortools.ts`, a room of the room clear's
  own) goes through `roomCall()`: `<room> clear.` only with nobody standing in it AND a search that was not cut short (`RoomSearch.left` under
  `DOORTOOLS.deadCells`, the search's own bar for floor no man could see); `<room>'s quiet. we didn't see all of it.` (`bunks are quiet. …` for
  a name in the plural) with a search cut short and no enemy of the room in the team's sight; nothing with one in sight, or one standing on
  floor they saw (as before: nothing was said there). An entry with no search of its own (open floor) is called as it was. The floor counted is
  the room fight's flood, the name and who stands inside are the room clear's own rectangle: two models of a room, not reconciled here.
  EVERY ENTRY ENDS WITH A CALL (`SQUADNET.endCall`, `?endcall=0`, `TPS_ENDCALL=1`): the lead called only a room of the room clear's own list,
  so an entry into any other room (the office's conference room, a hall, every room of a mission with no list) ended with nothing said. With
  the rule, at the same place in `doortools.ts`: a lead who stands in no room of the list calls the listed room the entry's own points are in;
  with none there either he calls the room fight's flood with no name through `squadnet.ts plainCall()`: `room clear.` / `room's quiet. we
  didn't see all of it.` by `roomCall`'s own rule (who stands inside is `inFlood()`: the flood's cells and the room's own doorways, a man who
  has dropped his gun left out as in the named call), and of open floor (`openFloor`, which nobody searches) `clear so far.` unless an enemy
  on it is in the team's sight. Sam's own squad only (`g.orders.sams`): the response team runs the same door orders as a cast of its own and
  says none of it. The same test now guards the far lines' click in `guards.ts say()`: before it, the response team's lines clicked the
  squad's net (7 clicks over two of its entries with no squad on the floor). It adds a line where there was none, so a run with it on is not
  the run with it off by digest once one is said; off is the build as it was (seeds 1–4, two entries each, both stands, against the build
  head it was merged on). The pre-existing named call has no such guard: a response team that ends an entry in a listed room of a room clear
  would call it by name, as it did before any of this (not seen, not changed here).
  CHECK `bun run tools/qa/squadnet-check.ts` (also `probes.ts squadnet`: why · clear · end · net · off; `end` runs under `doortools` too;
  `SQUADNET_BREAK=1` fails all five; `net` holds where a far line is put by `netPlace`: eight ways out, you out by the border, a spot under a card or on another line, 960 placings none off the view), both stands, the room clear on the office with four, seeds 5, 7 and 11, and the response team on seed
  41. It reads what a man SAID off his bubble, a frame at a time. MEASURED on the office (the squad of four, the quick key's own pick, the
  defenders of the room beyond left as dealt, every switch on): entries into the room clear's four listed rooms, seeds 1–4 on the shipped
  stand, 16 of 16 called by name (all `clear`; floor unseen 0 or 1 cell, under the bar); entries into the conference room, which is on no
  list, seeds 1–8: 8 of 8 silent before the rule (shipped stand) and 8 of 8 `room clear.` with it (each stand). So on the office the honest call changes
  nothing a player would hear, and the fourth rule is what he hears. A COUNT THIS FILE CARRIED WAS WRONG: an earlier pass read 24 of 60
  entries into listed rooms as ending with no call. It counted rows of the message log, and `say()` files a row only for a man off the
  screen or in the fog, so every call made in view was missed. NOT MEASURED: any level but the office; a live entry onto open floor (`clear
  so far.` is held as words only); a mission with no room list (rescue, the quiet missions as two), where every entry now takes the
  no-name call. ON THE PAGE (`PORT=<port> node
  tools/qa/squadnet-look.cjs <dir>`, software adapter): the far lines and the down row are read off the HUD's own elements with where they lie
  against you and against the man; `ENTRY=1` in front of it drives an entry into the conference room and read `↑ Red Two: room clear.` as a
  far line near you (the lead off the screen; read before the edge rule), counted once, no page or console errors. THE EDGE, read the same way
  on a 960 by 540 view: with the squad off the bottom of the view two lines sat at the bottom edge, one a row in from the other (712, 494 and
  673, 468; rule off 655, 386 and 638, 419, about 100 px from you), and the man-down row at 679, 494 (off: 658, 425); with the squad off the
  bottom left corner, where the kit card stands, the two sat side by side on the bottom edge to the right of the card (303, 494 and 489, 494;
  off 535, 333 and 533, 303). No page or console errors either way. Never seen on a GPU, never played, never heard: the click's level and pitch and the pitched-down click for a
  man down are guesses. The words are lower case like the rows and answers beside them. OPEN: where the reason sits on the quick key's row is
  the commanding work's to settle (its flat wheel and the corner panel draw that row); the reason for a charge is not on the HUD's line (the
  hint does not ask the lock, so it shows the open it will not do).
