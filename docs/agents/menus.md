# Menus, HUD screens, the debugger

One of the area files CLAUDE.md indexes. Everything below was moved here word for word from CLAUDE.md on 2026-10-13, in its old order;
"the bullet above / below" in a bullet means its neighbour there (each block says which lines it was), and a bullet named by its bold
title may now live in another file of this folder: `grep -l '<title>' docs/agents/*.md`. New bullets for this area go at the foot of this file.

<!-- was CLAUDE.md lines 16–36 -->
- **The menus are one game from the title to the debrief** (the look is ONE set of tokens, `src/ui/theme.ts menuTheme()`: warm black ground, sand text, flat fills, one orange
  accent `--m-accent`, the condensed heading stack `--m-head`; a canvas — the floor plans, the debrief's map — and the kit silhouettes repeat `--m-base` as literals).
  A fresh visit opens on the TITLE (`#menu.title`: **Play ›** · Options · Controls · Extras; Esc does nothing there; W S walk the buttons; EXTRAS swaps the title's own column for the list `ui/menu.ts EXTRAS` — the level editor and the character / effects viewer = `workbench.html#mode=level|chars`, the replay viewer `replay.html`, the listening page `sounds.html`, each a link, a NAME only (its sentence is the row's tooltip), Esc back; the BENCHMARK row starts in place from the live title (no page load), and its link — what it is while the page boots, or in a new tab — is `?bench` with the visitor's other flags kept; the list's first section was the two SHOWCASES, removed 2026-10-17 with their `?demo` / `?breach` pages (docs/agents/showcases.md); the one-file build lists no tool page (tools/artifact-page.py marks its page, `onePage`); the workbench's rail and the replay viewer's bar each carry a '‹ Game' link back; a row added to that table is a row on the title; what is kept and not listed, and why: rebuild/menus/tools.md); Play opens the ONE STARTING PAGE
  (`src/ui/startpage.ts` over the mission list — its rows in the list's six groups (`scenarios.ts MISSION_GROUPS`: training · raids · strongholds · against the clock · quiet alone · quiet as two), drawn the way Door Kickers 2 draws them (the maintainer, 10-11: "i think door kickers did a good job of this btw"): the groups are PICTURE TILES in a rail down the left (`.mgroups .msec`, each its first mission's picture and its count), the open group's missions a grid of CARDS, a picture and a name each (`.mgrid .mrow`, canvas `.mthumb`), the short list's missions first inside a group, a fresh visit on the compound; `?nogroups` = the short list on top as text rows, no tiles — in TWO STEPS named on its head, MISSION › TEAM & KIT — Enter goes on, Esc back, Enter on the second deploys. A CARD'S PICTURE IS KEY ART (the maintainer: "our art style is also AWESOME so if we could highlight it" · "use your artistic judgment though. and it can be synthetic, doesn't have to literally be a rendering of the level. make it awesome!"): `public/assets/menu/<mission id>.jpg` + `stills.json`, read by `src/ui/menuStills.ts` (a list that is not there is the answer for the page's life; a server that did not answer, a 5xx or a picture that failed to load is asked for again when the Play page is next opened: `bun run tools/qa/menustills-check.ts`); since 10-12 (the maintainer on the composed set: "they look somewhat staged and repetitive … our actual gameplay looks a lot cooler!") a mission that has a RECIPE in `tools/menu-shots/recipes.cjs` is a frame of the REAL page with the mission being PLAYED — `PORT=<dev server> node tools/menu-shots/shots.cjs make [id …]` boots the mission's own link in headless Chromium on the software adapter, the in-page director (`director.js`, `window.__ms`: Sam on the walk keys, the squad on the menu's own orders, the fight the game's) plays it undrawn until the recipe's moment (a can going off, a round, a wall coming down), then the frame is drawn from a pinned camera (minutes a picture; `shots.cjs serve` keeps pages alive for finding a moment; a recipe gives that KIND of moment again, not the frame to the pixel; across a group no two recipes share a moment, an hour and a camera) — every other mission's picture is still the first set, COMPOSED offline by `bun run tools/menu-art.ts [id …]` — a small CPU path tracer over the mission's own level file (the look's file where there is one: boxes, paint, lamps, door leaves) with a cast placed for the picture (weapon lights and lasers in haze on a loud mission, one man low in the dark and the guards' torches on a quiet one, the captor and hostages on a rescue), its mood by GROUP (`MOODS`) and its place by mission where the level's own start does not make a picture (`PIN`: the office is five missions on one floor, each its own corner); not a capture of play, nothing is marked on it, no GPU; a mission added since gets its picture by running the tool again (two to three minutes a picture a core at the shipped 760 × 475, 40 samples: about half an hour for all of them on four cores; do not edit the tool while it runs — each picture is a fresh bun that imports it. A picture is aimed by its `PIN` row: who stands where — `at`, `ops`, `guards`, `aim` —, the camera — `look`, `yaw`, `pitch`, `dist` —, doors `ajar`, and any field of the mood) and until then — and in the one-file build, which has no folder beside it — its card shows the menu's own drawn model of the place, `src/ui/planArt.ts` (the level's boxes tilted as the game's camera sees them, walls cut, flat fills: also THE MAP SHEET beside the list, where the way in is marked). MISSION: the
  cards · a briefing · a SETUP rail of one row a setting with its VALUE (Difficulty, its three levers hung under it (a fourth since 10-23, `You're told`: stealth.md), Hour,
  Weather, Way in; a click or its key steps it; the list's own setting rows are parked unseen in `.mstore` and the rail's rows press THEIR buttons, so what a setting may
  be is still `ui/missions.ts`'s) · a Team & kit row · the place as that map sheet under the rail (with the tiles; not drawn in a window under 730 px tall). SHOW, NOT TELL (the maintainer, 10-11: "we should generally show, not tell. e.g. no \"play this first\", wordy explanations of different options, etc."): a group's heading is a word or two with its row count, no sentence explains a setting (a row's sentence is its `title` tooltip and the screen reader's live region `.mread`; a Custom difficulty arms in its own row as 'Custom → <level>'; the place line shows only where a mission has no plan; the kit step repeats no setting, the Approach fact and a chip's 'Sam' / 'Red pair' line are not drawn), the way in is an accent dot on the plan at the picked start — rings at every start for 'Dealt' (`ui/missions.ts drawPlan(…, mark)` off the level file's `scenarios`; none for the office's rows or a quiet mission), a roster chip shows what differs man to man as icons — his gun, what he carries a count of, the wand (`.lo-ics`, `loadout.ts CHIP_SHOWS`), a kit tile speaks only when a step is refused, and a carried wand or card camera on a mission with no fog of war — nothing for it to look into: the solo night always, a quiet mission with its fog lever off — says so on its own tile: the value reads 'no use here' in the dim grey with a faint icon, the label lit and the arrows live (`.kc-row.idle` ← kitCard.ts `MemberCardOpts.idle`, asked by loadout.ts `noFog()` off the mission's own link, redrawn when the screen's fog lever moves; an empty tile is like any other. It was the whole tile at 40 %, still reading CARRIED: the maintainer, 10-12, "wand greyed out"). A new line on a menu screen needs the same test: can it be shown instead. TEAM & KIT: team size, squad kit, the roster chips, THE PICKED MAN IN 3D (`src/ui/kitFigure.ts`: the cast's own mesh and the rig's own prop boxes — rigProps.ts, read only — posed by the game's animator and drawn by a small SOFTWARE view of the menu's own on a 2D canvas, LIT BY RAYS as the game is (`src/ui/figureTrace.ts`: a lattice of points over him and a patch of the mission's ground keeps what each lamp and the second-hand light put on it, traced a slice a frame on the CPU, through a mirror of post.wgsl's tone curve — keep the two in step) and breathing on the game's own idle, in the dress the mission will give him and under the HOUR picked for it (`FigureAsk.hour` → `lightOf`: that hour's own sun and sky off `game/hours.ts HOURS`, scaled by `FIGURE.day` and put under the mission's weather by `FigureAsk.cloud` → hours.ts `cloudLight`; night or none = the figure's own key lamp, pale rim and `FIGURE.glow`, a soft glow on the backdrop behind him: `FIGURE.back`; the ground's paint is `FIGURE.ground`, lifted at night — `ground.night` — so the key lamp shows its pool and his cast shadow, and by day as the sun comes down or the cloud closes — `day.ground` / `groundCloud`). THE SIDEARM IS DRESSED FOR THE CLOSE VIEW, in the figure's own picture only (`dress()` reads rigBoxes' part list — `RigNodeMeta` — and draws the pistol's one-box slide as slide + frame + sights + trigger guard, the can eight-sided with a bore, a shell round the holstered pistol; `FIGURE.yawPistol` turns a pistol man so he shows round it, the lamps turning with the view and the camera looking `FIGURE.lead` m in front of him so a held-out gun is not cut by the frame; the game's rig and every box the game draws are untouched) (`TPS_PROFILE=shipped bun run tools/qa/kit-figure-sheet.ts --out DIR [--only substr] [--per N] [--part k/n]` = rows of men over many kit cards, no page; `--part k/n` in n processes draws the sweep side by side: 63 figures in about two minutes on four cores); what he holds and carries follows his kit rows and the picked chip, a drag turns him; it reads the card it is handed and writes nothing, shows for each roster place the man the mission will stand up (`figureMan` → `game/cast.ts operatorAt`, the ONE deal of a teammate's cast variant: by his place among the team as staged, not by his id, which a rescue's captors move — `bun run tools/qa/kit-figure-roster-check.ts`, `ROSTER_BREAK=1` must fail; a show's cast keeps the deal by id), builds its man under a die of its own, and draws nothing until main.ts has handed it the loaded cast — `setFigureCast` — so a page whose boot died shows no figure; he is drawn on the page's one thread at `FIGURE.fps` 30 pictures a second (every second frame of a 60 Hz display, every fourth of 120: 24 fell 3, 2, 3, 2 frames apart on 60 Hz), `fpsSlow` 20 where a frame of him costs over `slowMs` of that thread, only the box of the canvas that changed is laid again, and the canvas says what a frame costs (`data-ms`, `data-fps`); THE LEVEL IS NOT DRAWN BEHIND A PAGE THAT HIDES ALL OF IT (the maintainer, 10-12, on Team & kit: "framerate isn't great here -- are we rendering this + the level?" — we were: the world under the start page and the options layer is frozen and both paint over the whole view, yet the level's whole frame was drawn every display frame; main.ts `viewHidden` now skips `engine.render` `behind.warm` 90 frames after such a page goes up — never while calibrating, under a sweep or a recording, a script's `__runFrames` or a tape; the title, the pause card and the options layer opened over a paused run — it lets the frame show through: `.over-game` — show the level and are drawn as ever; `?menurender` = drawn every frame as it was, `__behind {on, warm, drawn, skipped, hidden}`; `PORT=<dev server> node tools/qa/menu-idle-page.cjs` = the real page on the software adapter); `PORT=<dev server> node tools/qa/menu-art-page.cjs [outDir]` = the real page on the software adapter: the figure drawn and changed by a kit row and by the pick, the key art on the cards, and the drawn plan in its place on a page marked as the one-file build, ~8 min), the picked man's kit as tiles (`ui/kitCard.ts`,
  icons `src/ui/kitIcons.ts`). A sticky foot bar on both with the page's ONE filled block, which leads on: 'Team & kit ›' on MISSION (the page's own button on the loadout's bar, `.sp-next`; Deploy a quiet word beside it — the maintainer, 10-12: "confusing that CTA is to deploy but that skips the kit selection screen"), DEPLOY on TEAM & KIT; a mission played with the kit as issued (a Training lesson, root `.nokit`) has no kit to pick and keeps Deploy as the block on both). A man's kit holds ONE LINE on his roster chip however full his card is (the things are sized in ems of ONE icon height for all five chips: 17 px, or the chip's width over the fullest man's row — `--u` on `.lo-slots`, loadout.ts `drawSlots`; `PORT=<dev server> node tools/qa/kitline-page.cjs`, no GPU needed, `KITLINE_BREAK=1` must fail). The page comes up by itself only for
  `?loadout=<id>` or after a quit by page load (sessionStorage `twopointsix.missions.reopen`, read once by `missions.ts missionsReopenAsked`). OPTIONS is a full-screen
  layer of its own (`src/ui/options.ts`, `#options`: tabs GRAPHICS · AUDIO · GAME · CONTROLS on 1‥4, W S rows, A D change, Esc back), opened from the title and from the
  pause card (which is a narrow card: Resume · Restart · Options · Run so far · Missions · Quit); it took the place of the pause card's Settings and Controls tabs, so
  an older 'pause card ▸ Settings ▸ …' path in this file is Options ▸ that tab. The three cheats live on Options ▸ Game (a 'Cheats on: …' chip on the title while one is
  on); the four volumes and the hints switch are kept per machine in localStorage `twopointsix.options` (never the 0 a `?mute` page pins the master at). TAB IS ON TRIAL (`src/ui/tabkey.ts`, the
  maintainer: "maybe try a few things and see what works. i do hesitate to add more concepts though"): Options ▸ Game ▸ 'Tab key (trying out)' / `?tab=run|who|keys|off`, kept with the
  options — nothing (the default; WHILE TAB IS THE BACK KEY, `BACKKEY.tab` in docs/agents/squad.md, the row's words follow it through `tabChoices`: the first choice reads 'Nothing more' with the line 'In the fight Tab backs out: a list, the order menu, a thing under way. Nothing more.', and each other choice's line ends 'Backing out comes first.'; `?tabback=0` / the frozen stand = 'Nothing', 'Tab does nothing.' as before; no switch of its own, words only; held by a line of `tools/qa/tabback-check.ts`, which fails under `TABBACK_BREAK=1`; read on the real page in headless Chromium on the software adapter with and without `?tabback=0`, never seen on a GPU, never read by the maintainer) · `run` = the pause card on 'Run so far' and back (main.ts `tabKey`) · `who` = Tab steps who takes the next order AS WELL AS T (main.ts hands a Tab press to the tick as a press of `ORDERS.whoKey`, so the HUD's, the lessons' and a tape's T all still hold) · `keys` =
  Options ▸ Controls over the paused game and back; each an existing thing, the losers come out when he has picked. `?cards` = the
  older start card (short list + Missions + Start + the sandbox row) that the next bullet describes, which the `*-look.cjs` tools other than startpage-look still drive.
- **The fight screen wears the menus' look** (2026-10-16; the maintainer's "sure a" to the call "The fight screen in the menus' colours: move the mint green
  monospace over to the menus' sand and orange"; before it the two read as two games). NO SWITCH, on purpose: it is a look, not a rule of the game (STYLE.md: no
  player-facing switches for art constants), nothing of the simulation reads it, so a run's digest is the same on both stands. WHERE: every rule of the fight screen is
  in `index.html`'s one sheet, and that sheet now opens with a `:root` block of `--h-…` tokens, the fight screen's ROLES (ink, plate, edge …), each
  `var(--m-…, <that token's value>)`: the menus' own token once `menuTheme()` has run (the Overlay's constructor calls it too now), the literal for the moments before
  the first script. So `--m-accent` moves the fight screen as it moves a menu (theme.ts gained `--m-bright-rgb` for the marks drawn in bright sand at an alpha).
  WHAT MEANS WHAT: sand is the ink (`--h-ink`; values and lit things `--h-hi`; hints `--h-soft` / `--h-dim` / `--h-faint`; hairlines `rgba(var(--h-edge), a)`; backings
  `rgba(var(--h-plate), a)`, warm black where they were blue-black). ORANGE (`--h-acc`) is spent on what leads on and nothing else: the lit interaction row's left bar
  and its OWN key cap (`.it.primary > .what + .opt kbd`: not the hint keys under it, and a row that cannot be done keeps its dim cap; the row's FRAME is the selected
  kit slot's sand frame, so 'chosen' is one thing in both columns; every other key cap is a plain sand cap; the cancel row lit is bright sand), the objective (its
  diamond, its reticle, its dot, and the line's own word: `overlay.ts` sets 'objective ▸' apart as a `<b>` label, caps in the orange, the text read back from
  `#objective` unchanged and a par clock in front of it left plain), the LIGHT bar while Sam is lit (`#meters.hot`), a lost man's way (it was the accent as a literal
  already), the debugger's chosen system / focus / ticked box, the showcase timeline's playhead. NOT orange: a row header of kind 'objective', because `orders.ts`
  uses that kind for every squad row that is not a door's; it is the bright ink. EVERY OTHER HUE KEPT ITS MEANING AND ITS VALUE: gold / red / blue = who an order
  goes to, amber then red = alarm and REC, blue = a door, salmon = a body, red = a man, amber = a breaker / RING / a key / an off thing, yellow = a changed row in
  the debugger; the one hue dropped is the cancel row's salmon (it sat a few degrees from the orange). NO GLOW, FLAT BARS: every coloured halo, the amber, blue and
  red ones too, became a dark one or none, and the bars' fills are flat (the menus are flat); text that sits on the picture takes `--h-shadow` (the old 1 px drop plus a
  5 px dark halo), since sand has no hue to stand off a sunlit floor with; for the same reason the objective line has a plate under it (and is not drawn while empty),
  unlit kit rows went from 0.55 to 0.7 opacity and the kit's key hints from the faintest ink to `--h-soft`. TYPE: labels (`.what`, LIGHT / SOUND, ALARM, CHECKPOINT,
  REC, kit names, the marks' words) are `--h-head` 700 at 11 or 12 px, kit tags 10 px; rows (`.opt`, `.hint`, radio, speech, the objective's text) are `--h-font`; key
  caps and the bars' numbers are `--h-mono`. `body` is still mono and so is `#hud` (the debug read-out is columns) and the debugger (`#panel`, `#ptip`): they are
  recoloured, not reset. ROW HEIGHTS WERE HELD: line heights are set so the open five-order door menu is 294 px tall (307 before) and a five-slot kit column 206
  (205), measured in Chromium on the page's own markup; the kit column is 326 px wide against 309 where `--h-head` falls back to Inter, and narrower than that on a
  Mac, whose 'Avenir Next Condensed' is the face the labels were sized for. FROM CODE: `ui/overlay.ts` gives the throw arc's two shapes a class (`.trajpath`,
  `.trajland`: an attribute cannot hold a `var()`) and colours the objective's dot from `--h-acc-rgb`. A NEW ROW ON THE FIGHT SCREEN takes these tokens, never a
  literal green or a typeface by name. CHECK: `bun run tools/qa/hud-look-check.ts` (reads files only, so there is no stand to run it on: no green-to-teal literal,
  pale mints included, and no green or blue near-black in any rule of the sheet bar the named things that ARE green, a can's paint and two keys of the debrief's
  map; each `--h-` fallback equal to theme.ts's value; every `font` in the fight screen's rules a token; no green in overlay.ts); `HUDLOOK_BREAK=1` adds one rule in
  the old look and 'no green' and 'type' must both fail ('tally' too: the next bullet). SEEN, all on the software adapter in headless Chromium at 1440 × 900, never on a GPU and never on a Mac:
  the real page on `?roomclear&squad4` (deployed, the order menu on a door, after a stack order, the debugger open) and the solo night at a door, each beside the
  same DOM under the old sheet, with no console error; the alarm line, CHECKPOINT, REC, radio rows, speech, head marks, both reticles and the order mark only as
  static markup under the real sheet. NOT SEEN BY ANYONE: the labels in the condensed face they were sized for, any of it over a sunlit floor at play speed, a lit
  LIGHT bar, a lost man's row, a par clock in front of the objective, the showcase timeline, the close-in windows, the throw arc. NOT TOUCHED, each its owner's and
  still mint mono on this screen: the F7 tag (`ui/replaykey.ts TAG_CSS`), two edges of the engine replay's bar (`replay/engineplay.ts`), the one-off tools
  (`ui/sceneTweak.ts`, `ui/perfsweep.ts`), the debug floor views (`windviz`, `pictureviz`). TWO OVERLAPS REPORTED ON THIS SCREEN ARE NOT MENDED and were not seen
  in any of the pictures above: a long order menu reaching the kit column in a window under about 640 px tall (it reached it before; the menu is now 13 px
  shorter), and the objective's diamond drawn over the squad block when the objective lies up and to the left.
- **The run tally cuts no label** (10-20, a look and one word, no switch: `index.html` `#menu .db-stats`, `#menu .db-grid`; `src/ui/debrief.ts`). The tally on the pause
  card's *Run so far* and on the debrief ended three labels in an ellipsis at every window and text size ('bodies found' and 'doors kicked' 2 px over a tile's
  83, 'called in by security' 55 over). Now a label too long for its tile takes a second line and the tile holds its number at its foot, so a row's numbers stay
  on one line; a tile's side padding is 6 px (it was 8), which puts every label of the plain night on one line on the pause card at its full width (on the debrief, 12 px narrower, or with a scroll bar drawn, the two 85 px ones take two); the long one reads
  'called in' (its hover line still says a camera or a tripwire radioed you in; the summary line's words, chronicle.ts, are as they were). THE TALLY AND ITS MAP
  wrap by the CARD's width, not the window's: side by side while the card holds 360 + 18 + 420 px, and under that the map goes below the tally and takes the
  row's whole width, as the old one-column sheet gave it (the tally grows 999 parts to the map's 1, so beside it the map stays 420 px). It was a window rule at
  820 px: on the pause card the tally's column ran from nothing just over 820 px to its full width near 1260 px (136 px at a 1000 px window, every label cut).
  The 360 is chosen for SCROLL BARS: the debrief card holds 842 px and the pause card 854, so the pair stays side by side with a bar of 15 to 17 px drawn, as
  it did before (a first cut at 400 dropped the map under the timeline whenever a drawn bar appeared). In the narrowest band a few more labels take two lines,
  and a single word too long for its tile breaks, never spills. CHECK: two lines of `tools/qa/hud-look-check.ts`, both red under `HUDLOOK_BREAK=1`: 'tally' (no
  rule of the tally holds an ellipsis, `nowrap` or a line clamp; a tile is a column with its number at the foot) and 'tally pair' (the pair wraps, and its
  least widths fit the debrief card less a 17 px bar). SEEN: measured on the real pause card of the solo night, booted on the software adapter, before the
  change (the three cut, tile 101 px); after it only as markup laid out again under the new sheet, never a booted game: the pause card's own markup at 700 to
  1920 px wide with the five rarer long labels added (nothing cut; scroll bars hidden, as the headless browser has them), and a made-up debrief and pause card
  with 15 px scroll bars drawn at 400 to 1920 px wide (side by side wherever the old sheet was, nothing spilt). NOT SEEN BY ANYONE: on a GPU, on a Mac, on
  Windows, at a text size other than the first, on the debrief of a finished squad mission, or the squad-down card's replay picture where the pair wraps.
- **A quiet mission's gear screen** (2026-10-17; the maintainer: "quiet missions should have different gear screen stuff i think. be creative!", with
  show, not tell). The PANEL side of Team & kit; the picture beside it is the kit figure's. WHEN: the mission's kind is quiet or it is the solo night
  (`ui/kitNoise.ts quietGear`), on the Team & kit step only: the root wears `quiet` (`ui/startpage.ts`, where `nokit` is set). `kitloud` on the address = the
  panel as it was. No FROZEN row and no knob: it is DOM and a look, nothing of the simulation reads it. WHAT: (1) THE LIGHTS ARE OUT: on that step
  `--m-accent` is the bright sand, so nothing on it is orange and the night picture is the brightest thing in the window. The cursor is told from 'on' by
  weight, not hue: 4 px of bright sand under a tab or beside a tile where 'on' is 2 px of the soft ink, and the roster's standing bar a step dimmer. Deploy is
  a hollow block: a 2 px bright frame over a faint fill. (2) THE TILES ARE SOLID PLATES (the panel colour at 0.94; they were the edge colour at 0.06), so the
  room does not show through them. (3) THE KIT READS BY NOISE, no word added: every tile carries `data-noise` 0‥3 (`ui/kitCard.ts`, from `kitNoise.ts`), and
  on this screen a tile above 0 wears a sound mark after its VALUE (the name's line is cut with an ellipsis in a narrow tile and holds the arrows): a source
  and one arc = heard nearby and no alarm (an event with `loud: false`: the suppressed pistol's report, a smoke can's pop, a sticky camera fired and
  striking), two arcs = the floor hears it (`loud: true`: every other gun, a stun can, a charge, a hammer), three = the blast (`level: 2`, frag.ts blast(): a
  frag and a 40 mm grenade). Colour is spent on what he CARRIES: two arcs in the alarm's amber, three in its red (index.html `#alarm.l1` / `.l2`); one arc,
  and every mark on a thing he has none of, in the ink. A gun's step is read off its `WEAPONS` row when asked; the fixed ones are a table that cites the
  event each copies. So the quiet set reads at a glance: one arc on the pistol, and its one frag is the only colour on the card. (4) NONE CARRIED SINKS:
  a tile with a count of none, an empty big slot or no wand (`.zero`; never a fitting switched off, such as a teammate's suppressor) goes to the
  ground colour with its words at 0.65 (0.9 under the cursor). (5) AN EMPTY BIG SLOT is a tile like the rest, not the card's widest; with something in
  it, it is wide as before. NOT DONE: the tiles keep their order (the keys walk the card's own order); the picture's fade under the panel is the kit
  figure's (`ui/kitView.ts`). A loud mission's screen is untouched (every rule is under `#missions.one.quiet.pane-loadout`). CHECKS:
  `bun run tools/qa/kitnoise-check.ts` (a gun's step follows `WEAPONS[...].report` for Sam's three picks and six teammate cards; each fixed step still has
  the line of the game it copies; which missions take the look; `KITNOISE_BREAK=1` must fail) and `PORT=<port> node tools/qa/quietgear-page.cjs [outDir]`
  (the real page in headless Chromium, no adapter needed: the look, the steps, a mark on every noisy tile and no other, the big slot, the quiet set's gun at
  one arc, `kitloud`, the solo night, a loud mission as it was, no page error; `QUIETGEAR_BREAK=1` must fail). SEEN: stills of the real page's DOM at
  1440 × 900 with no picture behind it, looked at twice by a reviewer. NOT SEEN BY ANYONE: the panel over the real night picture, on a GPU, in a Mac's
  condensed face, with a pair (a teammate's card), in a window under 1180 px wide.
- **Team & kit shows the team at the mission's way-in door** (2026-10-13, the owner's pick; `src/ui/kitView.ts` + `src/host/kitView.ts`). SWITCHES, BOTH UI-ONLY:
  `KIT_VIEW.on` / `?oldfigure` (off = the standing man, `kitFigure.ts`, everywhere, as before; ON = he is not on the page at all, 10-20: below) and `KIT_VIEW.acts` / `?stillkit` (THE LOOP, 2026-10-14; off = the still picture: staged, warm, held, every
  kit change a plain restage, nothing played — the parent opens the child `&stillkit`, which is what the child reads), both on in the page, both in the UI module's table (with `wait` 10 s and `kitMs` 150). No `src/game` code reads either, so
  neither has a knobs-registry row, a journal key or a `FROZEN_HOLDS` row (`knobs-check` scans only `src/game`), and neither exists on a headless stand. The staging numbers are the HOST module's `KIT_VIEW_STAGE`, the light
  `KIT_VIEW_LIGHT`, the page layout `KIT_VIEW_PLACE` (ui): three names, three things. THE SEAM (10-15): the child holds NO geometry of its own — `place()` asks
  `src/host/kitViewPlan.ts` (on the game's own nav grid, the hidden boxes sunk and the grid rebaked first) for the anchor, the five places, the wall's face
  and top, the lamps, the camera, the floor behind and the stack's hand, and mirrors its own framing by that hand; the parent knows no level and no kind of
  mission. A level changes its picture in its own `scenarios.kitView` block and nowhere else (the next bullet; keys: `docs/level-format.md`). WHERE IT SHOWS: the Team & kit step of a room clear whose level file has
  `scenarios.kitView.ways[way]` (`ui/missions.ts kitViewWays` off the plan's own fetch; the way is the PAGE's own, `MissionsScreen.way`, which folds `any`
  under SAMESTART; docs/level-format.md `kitView`) in a window over 720 px wide. A DEALT way in is the standing man:
  the loadout's query carries no seed, so the child's die would deal another door than Deploy's. Everything else (the office, every other level, the
  Mission step, Options) is today's DOM and CSS: no element made, no class set. WHAT IT IS: the Game behind the start page is not the picked mission's
  level, so the picture is a SECOND instance of the page in an `<iframe class="kv">` (last child of `.mbody`, behind the sheet, `pointer-events: none`,
  `tabindex -1`), src = the very query Deploy loads + `&kitview&mute&noreplay` (+ `&stillkit` with the loop off; + `&quality=<this page's tier>` once the outer renderer is up: the child draws at the OUTER page's tier —
  the low tier caps the render height at 720, so a taller iframe shows it upscaled and soft). ONE ELEMENT PER
  QUERY: a query that changes (less its team size) drops the element and makes another — no entry in the tab's history, and a message counts only from the
  current element's own window. The child says `boot` (its listener is up; on every load of its page the parent answers with
  `{kv:'frame', cx, cy, h, w, man, door, left, right, keep}` off the `.onefig` column's rectangle and, where the tiles moved since its query, the kit), `ready`, `none`, and — still mode only — `held` (`dip` / `undip` are gone, 10-14: the child dissolves inside itself, below; the parent ignores the two words from an older child). A kit
  tile or the size is `{kv:'kit', members: KIT.members, squad}` at once on the first change (the LEADING edge; `kitMs` 150 only folds the clicks that follow into one more), and nothing else: the CHILD works out what moved. The loop's two more: `{kv:'sel', who, field}` (the open card's member and the highlighted tile's field, null on the sets;
  said when either changes and again at every `boot`) and `{kv:'pause', on}` (on = the step is not showing: `show(null)`). THE PARENT'S HOOKS, all there are: `MemberCardOpts.onSelect(i, field)` (kitCard.ts, told from `draw()` when the highlighted row is another: a move changes no value, so `onChange` never said it), `loadout.ts` routes it to its `onPaint`, `startpage.ts paintFigure` passes `member: s.member, row: s.card?.at()` to `show()`. NOBODY STANDS IN FOR THE PICTURE (10-20; the maintainer: "we show the original gear screen before the new one fades in. let's just remove the old one with
  the figure?"). The standing man (`ui/kitFigure.ts`) used to be drawn while the child booted past a 2.5 s grace (`KIT_VIEW.grace`, `?kitgrace`: both gone) and
  wherever there was no picture; a second game slower than the grace therefore showed him for a moment and then faded the picture in over him. With the
  switch on he is NOT ON THE PAGE: `startpage.ts` mounts him only when `KIT_VIEW.on` is off (`?oldfigure` = no picture, the standing man everywhere, the page
  as it was — the word menu-art-page and menu-idle-page already open him with), and `show()` answers true for every case the column is the picture's:
  shown (`#missions.kv-on`), WAITED FOR — the level's ways not yet fetched, or the child not yet `ready` (its own word, 12 drawn frames in), however long
  that takes: `#missions[data-kv-wait]`, the column empty and its hairline off so nothing shows and goes — or NONE TO BE HAD, for the page's life on that
  query: the child said `none` (before `ready` or AFTER it), its load errored, the level has
  no block or the way in is dealt: `#missions[data-kv-none]`, the column empty. THE WAIT HAS NO CLOCK (10-20): a child was given 10 s to say `ready`
  (`KIT_VIEW.wait`, `?kitwait`: both gone) and then called none for the page's life — the standing man's cue while he stood in; with nobody standing in, a
  second game slower than that (a cold shader cache, a slow adapter) left the column blank for good. Every fatal card in the child says `none`
  (`main.ts kitViewFatal`), so a child that says nothing is one still coming up. `show()` is false only with the switch off or under 720 px. CHECK:
  kitview-page's outer half (the rows 'a slow child' — 12 s of nothing and still waited for, then shown on its `ready`: red on the build with the clock — 'says `none`', 'no
  kitView block'; `STANDIN_BREAK=1` puts a canvas in the column while the slow child is waited for and that row must fail on the canvas alone — it used to
  open the row `?oldfigure`, where no iframe is made, and failed on the iframe count; `GRACE_BREAK` is gone with the grace). Headless Chromium with a stub child, and one run of the real page with the
  real child on the software adapter; never seen on a GPU. STILL IN THE REPO: `kitFigure.ts` and `figureTrace.ts`, reached only by `?oldfigure` and their own
  sheets and checks — deleting them is the kit figure's owner's call. THE SECOND GAME LIVES ONLY WHILE IT CAN SHOW: dropped on `none` / a failed
  boot / a mission with no block / a dealt way / a window gone under 720 px (the ResizeObserver repaints across the line) / Deploy / the page closing;
  kept across the Mission step — the OLD instance stays alive while another row is picked there, until Team & kit opens again and decides. LAYOUT: one CSS block; ONE root
  class `#missions.kv-on`, on only while the picture is shown (the iframe's own rules stand without it — it must be laid out, at opacity 0, for its page
  to draw; `.mbody:has(> iframe.kv)` is its containing block); `KIT_VIEW_PLACE` in column widths: the iframe 2.75 wide, the picture HUNG ON THE DOOR (10-14: the door stood at the column's right edge, 94 % across, and the whole room behind it was under the tiles — nothing thrown through it could be seen) — the door's line (its middle, a metre up) at `door` 0.62, the five places' reach (`KIT_VIEW_STAGE.reach` 0.33 m) kept `left` 0.05 / `right` 0.03 inside the column, the men no smaller than `keep` 0.85 of the old fit (the places' middle at `cx` 0.62 with `w` 0.88 to stand in: still sent, and what a child told no door frames by) — past that the places hold the left margin and the door sits right of 0.62; a standing man at most 0.19 of its height. MEASURED (the check's inner half, the page's own frame message; door's line a metre up as a share of the column · least margin of any place · floor inside the door left of the column's edge · a man against the old fit): 1440x900 front 62.0 % · 16 px · 1.28 m · 106 px (85 %), west 65.3 % (its top 61.0 %; held by `keep`) · 17 px · 1.07 m · 114 px (85 %); 1270x790 both 62.0 % · 16 px · 1.25 m · 103 px (95 % / 88 %); 1000x800 front 68.9 % · 12 px · 0.94 m · 89 px (84 %), west 66.0 % · 13 px · 1.05 m · 87 px (86 %),
  the fade by the MASK ALONE — whole to the column's right edge (`fade0` 0; it was 0.03 short of it), three tenths at the first tile's left edge (+0.07, or the tiles' own left edge if that is nearer: no tile has more picture under it than it had), gone one column on (no rule of a tile is
  touched) — and a radial layer that lets the picture run on right under the last tile row (`.lo-kit`'s bottom); the child's own page darkens its top
  15 % (index.html `body.kitview::after`). No `#missions.one` rule edited. THE `?kitview` PAGE (main.ts imports host/kitView.ts FIRST: at load it makes
  this window's Storage writes no-ops, hides `indexedDB` — so the replay keeper, which would open a database, prune it and ask for persistent storage,
  stands down — makes `navigator.storage.persist` answer false, and stops every key / mouse event; `body.kitview` hides all but `canvas#view`): after the
  URL's scenario has staged, `stage()` = `none` if the room clear did not start, fog off, everyone not on the team parked dark, the way's `hide` /
  `hidePaint` boxes sunk 30 m (picked by the file's ids and groups, the plan's `hidden`: `host/kitViewPlan.ts`; a box is never taken out of the world),
  the team on slots by the door (worked out from the door + the side the team starts on, or the level's authored `slots` / `pin`; Sam
  across the door and no nearer its middle than `KIT_VIEW_STAGE.samClear` 1.8 m — a door charge dazzles within 1.6 m, and the charge's moment goes off
  beside him; the records office's authored slots moved for it 10-13: Sam 0.38 m and the fifth man 0.35 m on the front way, Sam 0.55 m on the west; ONE FRAMING PER WAY: the camera (worked out: `KIT_VIEW_STAGE.yaw` 1.206 from square-on, the wall and the file of men running up the column at
  about 65° on the screen) is fitted to the way's FIVE places and the door's jambs, by 0.76 of the column's height and — hung on the door — the door's line and the places' reach across it (`aim()`), whatever the team's size, so men come and go in their slots and nothing
  else moves), ONE `game.update(0)` to pose, the light (`KIT_VIEW_LIGHT`, one table, every place door-relative [along, out, up]: a PORCH kind-3
  disk r 0.28 over the door 0.55 m off the face and 2.4 m up, facing down and ~35° out, [1, 0.76, 0.5] × 15, with a small glowing box on the wall for its
  source — the porch alone has a `fixture`; a FILL kind-3 disk r 1.5, 6.5 m out and 2 m up, [0.85, 0.9, 1] × 2.5 (0 = none); `roomLights` 0 = every
  light's group switched off before the posing step, so their fixtures go dark too, EXCEPT the keep-list `exterior`, `player`, `flashlights`,
  `transient`, `weather`, `kitview`, any directional light and any light with a lifetime — a level whose yard lamps sit in another group loses them; on a
  night the `moon` × 1.65 and the sky's two colours × 1.6; Sam's weapon light on but 9 / 8°–24° / volumetric 0.25 at the foot of the door, written once
  after the pose; teammates' lights off; the door shut; a way's `light` lies over it), `cam.setPin`; a throw anywhere in it posts `none`. Then, STILL (`&stillkit`):
  `loop.frozen`, `KIT_VIEW_STAGE.warm` 90 frames drawn (`?kitview=N` asks another count) and the picture HELD — main.ts's frame returns before
  stepping or drawing (`kitView.rest()`) until a `kit` message (cards through `kitLoad` over a store that is the message; `squad` only as a number 0‥4;
  then a FULL `restartEncounter` and `stage()` — a team the game did not make the asked size is `none`), a `frame` message or a resize. THE LOOP: never frozen (below).
  `window.__kitview { state: boot|staging|warm|held|none · rest|beat|swap|paused, drawn, skipped, blocked, men[{name,x,z,yaw,gun,light,slot}], door, way, pin,
  lamps{porch,fill}, beat: null | {n, field, i, t, phase, marks}, queue ([the thing asked for]), restarts, rehangs, cuts, preempt (a check's switch), dissolve{n, phase, cuts}, settled, pace{hz, every, base, slow}, pacer(), skip(ts), last (the beat + how: done|cut|cap|threw|down, rest, peak, flash, drift), refused, stroke, again(), stage() }`.
  THE LOOP (2026-10-14; `BEATS` in `host/kitView.ts`, numbers in `KIT_VIEW_LOOP`; REWORKED the same day on the owner's play of it: "after selecting something, it should start the demo
  animation immediately … kind of jerky … i don't like the fade to black animations. switching between squad members should have them swap places in the stack … okay for switching weapons to have them holster what they've got, instantly get the new stuff, and then unholster"). No new switch: all of it is the loop's (`KIT_VIEW.acts` / `?stillkit`; UI-only, no stand has it). NEVER FROZEN:
  `loop.frozen` false but while staging or `none`; `{kv:'pause', on:true}` = `rest()` true once the first picture was shown. `ready` is still 12 drawn frames. FOR A LONG RUN, in `live()` at every staging: `godMode`,
  `infiniteAmmo`, `saves.enabled` false, `tune.qrf` false, `&noreplay`; the defenders parked and calmed before and after every step (`park()`); a man down or `roomClear.end` = a restage under the dissolve; what lies on the floor is taken off `items` once 8 s old (never under the eye), a smoke can's vent is cut 5 s after it began, every transient light is held to `flashMax` 18, a LIGHTNING stroke to `strokeK` of the night's own directional light with the sky's flash turned down by as much (`__kitview.stroke`), Sam's `hitFlash` and `dazzledUntil` are put out after every step.
  ONE TABLE: every demo is a `Row` `{ door: shut|open|none, damage: none|leaf|world, rest, cap, start, tick }`; pre-emption, undo and looping read only those fields. ONE MAN ACTS: the open card's (`sel.who`; a card whose man is not on the team = Sam).
  (1) A PICK IS IMMEDIATE: a `sel` to another tile, or a value changed on the open card, CUTS whatever runs in the next frame (`cut()`) and starts that tile's row from the pose and place he is in — never via his slot, no rest first (first motion measured 7 to 17 ms after the message at the check's clock × 1; the budget is 100). The parent sends the kit message on the LEADING edge (`kitMs` 150 only folds later clicks). The open card's man LIVES on the head slot by the jamb; a throw or the light is a half step (`half` 0.5 m, `lightStep` 0.4 m) with his hand on the leaf from the first frame (`openSecs[0]` 0.3). CUT RULES: a quiet row = the same frame; a throw before release = the wind-up cancelled (`pendingThrow` cleared), the open leaf the next row's if it has `door: open`, else pulled to WHILE the next row runs (`tidy()`); a can already out = not waited for, not taken away, its vent shut (`ttl = min(ttl, age)`, held shut `ventKill` 6 s); a frag not yet burst = the item taken away; a door order under way = `doorTools.reset()`; damage done (door blown, frag burst) = the dissolve now and the new row under it. THE LOOP HOLDS ON THE HIGHLIGHTED TILE (it never wanders through his other kit): rests quiet 1.5 s, smoke / stun 4 s, a damaging row held 6 s from its mark then the dissolve, repeat; no tile under the highlight = gun, then light, 3 s rests. A TILE PLAYS AT A COUNT OF 0 (`pools(f)` gives the playing thing one; the number is the tile's job). A row that is refused plays the gun's (never a dead cursor); a tile with no row (goggles, wall charge, shells, cameras, wand, Sam's own frag and door charge) = gun then light.
  (2) NO FADE TO BLACK: ONE mechanism for what cannot be live — `dissolve(work)`: the last drawn frame is copied to a 2D canvas `#kv-veil` laid over the game's (in the task that drew it), the work is done under it on the next frame, `settle` 8 frames are drawn, the copy fades over `dissolveMs` 250. The team's size, the goggles, a suit / trim back to 'issued' with nothing to go back to, a frag's room, a man down, a tick that threw = `restage()` (the full `restartEncounter` + `stage()` with every man PUT BACK WHERE HE STOOD and the file's order kept: `Keep {perm, poses, sam}`); a blown door = `rehang()` only (`Door.reset()`, decals, moving debris, door tools: nobody staged). The child never says `dip` / `undip`; the parent ignores them from an older child and has no `kv-dip` class or `dipMax`. Damage is undone only when the next row starts or the hold ends.
  (3) LIVE CHANGES (no restart): a teammate's gun or suppressor = `swapGun` — `anim.kitSwap(from, to)` at t = 0, `route.weapon` written at `swapAt` 0.55 s, the gun's row from `swapUp` 0.85 s (a new pick before the write only changes what is written); his light = `lightDeadUntil`; suit / trim = `char.tint` / `tint2` at once, then an eased quarter turn (90°, `turnEase` 0.65 s at least, held 0.6 s — at the body's rate it takes about 1.5 s each way); Sam's gun = his real holster (`KeyE`), `kitShow` + `kitPlayer` while his hands are empty, the draw (`Digit1` / `Digit2`), the gun's row; the rest of Sam's card = `kitShow` + `kitPlayer` as he stands. A COUNT (`COUNTS`) writes the pools and plays if it is the open card's. Main.ts hands `gun(i)`, `tints(i)`, `samCard()`, `turn(spec)` through `KitViewDeps`.
  (4) THE CARD SWITCH IS A SWAP OF PLACES (`rotate()`): no restage — the SAME men walk, two lanes: the man whose card opened steps out `lane` 0.7 m into the yard on a diagonal, walks up at `swapPace` 1.6 m/s and cuts in at the head slot; the men ahead of his old slot step BACK one slot each at 1.3, their chests kept on the door (`Assignment.strafe`), rearmost first at 0.25 s then every 0.15 s; his thing begins as he arrives (`arriving()`, 4 s at most; measured slot 3 → head about 2.8 s). Sam never moves; the fourth man (behind Sam) steps round Sam's yard side to `act4` and back when his card shuts. WALKS are declarative (`go()` / `walks()`: re-sent whenever a man is found with no order of this kind).
  (5) THE JERK: a teammate's yaws are weighed by the game's own TURN (character.ts: his AI's yaws are wishes) — at 630°/s gun and 400°/s body as shipped; `live()` sets it, in this page only, to `gunRate` 150°/s / `bodyRate` 100°/s reached in `ramp` 0.15 s through the page's own `?turn=` reading (`setTurn`, handed in by main.ts). Sam has no TURN: his `bodyYaw` / `aimYaw` are accessors over a channel that chases the game's writes under the same rates (`govern()`). A quiet row's aim POINT is on a channel of its own, minimum-jerk from where the gun points to the target and back (`own()`; 0.45 s up to 45°, 0.65 s above, never over the rate; sweep 30°/s); under `torso` 35° off his rest only the chest turns; the watch is dropped only when the ease back has ended. THE LIGHT: ON in the first frame on the ground at his feet (`feetDeg` 65° down), the leaf pushed to 1.3 rad, the beam rises (`riseSecs` 0.85) and slices THROUGH THE DOOR from the far edge of the opening to as near straight in as he gets (`slice()`: never within `wallMin` 25° of the wall's line; the beam's line is the DRAWN gun's yaw, written after the step), held 0.4 s, off before the gun comes back. THE WHITE RECTANGLE ON THE WALL: a guess — the porch lamp's glow box (albedo 0.9, lit by a weapon light) — its albedo is now 0.04; NOT confirmed on a picture.
  (6) THE PACE (`kitViewPacer`, `KIT_VIEW_PACE {target 60, floor 30, edge 0.1, near 1.25, probe 12, lost 5, lostMax 300, peek 3, settle 32, secs 2, late 0.3, ease 0.8, hold 3, fresh 0.5, stay 4, tries 2, again 300, proof 15}`; main.ts `frame()` asks `kitView.skip(ts)` first, under `?kitview` only; REBUILT 10-14 after two reviews): every n-th display frame stepped and drawn (a frame passed over does not touch the clock: the next step takes the real time), from the rAF stamps ALONE — no thread time. PERIOD: only a frame PASSED OVER shows one period (a rAF after long work is a whole number of them), so the first frames at boot are passed over until eight gaps are read (a machine slow from frame one was 25 / 33 ms mixed for ever); period = the agreeing gaps over the periods they span (the fastest alone read short under uneven stamps: 240 Hz ±0.5 ms read 272), read again `settle` gaps later, then kept. Faster: taken as seen. Slower: a PEEK — no gap near it for `lost` s, frames passed over until one is (same display: asked half as often, to 300 s; costs one period) or `peek` show another. BASE n = `floor(hz / 60 + edge)` (60–100 Hz: 1; 120, 144, 165: 2; 180: 3; 240: 4) — never a pace under 57 a second, BECAUSE OF THE QUALITY LADDER: `Quality.sample` runs in the child (main.ts frame(): `adaptive` is on, the child is opened `&quality=<tier>` so `auto` is off) on every WORKED frame with the gap since the last worked one — frames passed over are not counted — and at the default aim (60) it cuts the render scale under 57.9 fps; 165 Hz every third (55) read as a slow machine. A pacer stepped DOWN does read as slow there and the ladder cuts scale: that is load taken off, so `loop.render` watches `settings.renderScale` + the tier and calls `pacer.eased()` (used-up tries given back, one step up tried after `stay`). SLOW: over `late` (30 %) of a 2 s window's worked gaps longer than n periods, staying over `ease` of that for `hold` s and in the last `fresh` s too → n + 1, ONE step, never past `round(hz / 30)`; a hitch of 2 s (a frag, a restage) or one late frame in ten moves nothing. BACK: one step up after `stay` s; dropped again inside `proof` s doubles `stay`; after `tries` it is tried every `again` s — never parked until reload. `pace` is `{hz, every, base, slow}`. SIMULATED under bun (the reviewers' model and cases, 120–600 s): every steady rate, ±0.5 ms stamps at every rate (40 seeds; 120 Hz survives ±1, not ±1.5), work that swallows a rAF, 1–2.5 s hitches: no change; 90 Hz 9–13 ms even 45, 60 Hz 14–18 ms even 30, presents 14–19 ms off even 40, slow from boot at 120 / 144 / 165 / 240 even — all settled by 32 s. STILL MOVING after that, by design: slow spells over 3 s that recur (down and back each time), and a load with 25–32 % of its frames late (down, then a try every 300 s; at 20 % it stays up, uneven). NOBODY HAS SEEN real rAF timing under GPU load, nor the ladder and the pacer together on a GPU: the model is the reviewers', the ladder's part is traced from the source.
  (7) SLOTS `KIT_VIEW_STAGE.gap` 1.1 m in the picture (the level file's 0.9 m stack is spread from the head slot, `authored` 0.9; the file is not edited). STUN SHORT: Sam's aimed `samStunM` in from the door's middle; a teammate's stun is the door tools' own order and cannot be aimed.
  (8) THE DIRECTOR WAITS, AND ENDS WHOLE (review, 10-14): `waits()` — a row is not begun into a refusal about to clear: a teammate's while `Game.puppet` walks Sam the half step home, a door order's (`door: 'none'`) while the leaf is not to; `asked` is kept, `KIT_VIEW_LOOP.wait` 2.5 s at most, then begun as it stands (it was: the pick used up, the gun's row instead). `arriving()` under Sam's card: no row of his while a man's walk dealt in the last `swapSecs` has not arrived. Sam's swap however it ends (`finish()`: still in 'stow' = `samCard()` + the draw), and a swap never begun (another pick took its place) leaves `samCardDue`; `samCard()` puts his marker light back as `place()` set it. `cut()` counts a frag burst in the step before it (`stats.frags > base`) as damage. A teammate's long gun for another long gun: `anim.longGun` is put false for the instant before the step re-arms him, so game.ts `dealWeapons` writes his muzzle again (nothing in `src/game` edited).
  (9) THREE KIT DEMOS (10-14, rows of `BEATS`, src/game not edited; TWO SINCE 10-18 — the shield left the game and its row, `shieldAt`, `shieldTwo` and its knee went with it; what follows about it is how it was): THE SHIELD (`shield`, a teammate who carries it) — to `shieldAt` a metre off the shut door, plate squared, pistol up, `Assignment.crouch` on a knee, number two closed up (`shieldTwo`: at his back, or behind his shoulder where the nav grid still holds a hidden box), 3.0 to 3.4 s, both home; SAM'S OWN DOOR CHARGE (`charges` on YOUR card) — walked to `ownPost`, `Game.puppet` let go (all that refused it), his own row and ONE Space tap, set in the game's 2 s while `standOff()` steps the stack a slot back, walked home, `doorTools.trigger` at 3.6 to 4.0 s, nobody in the backblast, the leaf held then hung again under the dissolve; SAM'S OWN FRAG (`frags` on YOUR card, `thrown('frag')`) — in through the door, the leaf pulled to `ajar` 0.35 rad, Sam home and everybody on a knee through the fuse, burst 4.2 s in, `Guard.god` on the teammates IN THIS PAGE ONLY, a restage under the dissolve after the hold. Every man a row takes off his slot is on `Beat.moved` and sent home by `finish()`; tile → demo is ONE table, `TILES` (a field whose VALUE names the demo is one line there: THE BIG SLOT's tile, field `big` — kit.ts BIGSLOT, on in the page — the shotgun, the hammer and a wall charge in it have rows of their own, item (11); nothing in it is the gun's row). CHECK: 13 rows a way ("THE THREE KIT DEMOS"), `KITCUT_BREAK=1` turns each demo's pick and cut rows red. NEVER SEEN ON A GPU; heads turned away is not built.
  (10) THE DEMOS' REVIEW (10-14, `src/host/kitView.ts` only): Sam's own charge is NOT held by `waits()` for an open leaf — its row pulls the leaf to under his walk and the ask (picked from his light, smoke or stun nothing played for a second and more, and he walked home and out again); it is REFUSED in `start()` where that can be known (a steel door, `?noowncharge`, no leaf: the gun's row instead) and a charge the door never offers ends 'kept' with why in `refused` and a short rest (`restQuiet`, any 'kept' row; it was the 6 s hold); NO ROW OF SAM'S begins while a man the last row took off his slot is not home (`homing()`: the stack stood off his charge — `Game.puppet` held them where they stood for the whole next row), `swapSecs` at most, the cut itself still on the pick's frame; Sam's quiet rows walk him to his own slot (`samStand`: a cut left him at the door); `after()` puts Sam's stagger out as it does his dazzle, and counts what it puts out (`__kitview.hits`: Sam staggered, a teammate dazzled or doubled over under Sam's charge — a check reads after the frame, when both are already out).
  (11) THE REST OF THE KIT (10-15, the owner: "animations for all the pieces of gear", then, having played it: "guns when selected should do something! like shooting through window", "selecting an item should still demo it even if it's at zero", "big slots don't seem to do anything"; rows of `BEATS` in `src/host/kitView.ts`, two deps from `src/main.ts` — `fire` = combat.ts `fireWeapon(…, { steady })`, `panes` = `glassPanes` — src/game not edited, no new switch, knob table or flag: the numbers are `KIT_VIEW_LOOP`'s). THE GUN FIRES (`gunRow`, `fireLine()`; a teammate's and Sam's): a short burst by the game's own fire path (`fireN` 3 of a long gun, 2 of a pistol, 1 shell) through the PANE by the door he has a line to — from his own place first, else a TEAMMATE walks to a post `paneOut` 1.6 m out abreast of it (nobody within `fireClear` 25° of the line, no man's slot within `fireOff`) — else through the DOORWAY from a half step out, the leaf his hand's (`gunDoor`); SAM NEVER WALKS for it (every row of his starts where a cut left him); the row ends with the man back on his slot (`home`); the pane, shards and marks are put back plain as the next row begins or `hold` after (`mend()`: `glassBreak.reset()`). Measured: Sam on the front way fires from his slot through the pane 0.5 s in (the pane gone, 2.2 s in all), on the west through the doorway 0.5 to 0.6 s in; members 2 and 3 on the front walk 1.1 m and fire through the pane 1.7 to 2.1 s in, on the west they fire through the doorway 0.9 to 1.05 s in; nobody else moved, raised a gun, was hurt, no defender alerted. ZERO COUNTS (`pools(f)`): the played field's item is handed to the man in the picture's own game — a tile at 0, the wand off, all play; the card is not written (a steel door, a wall that takes no charge are still refused, with why). THE OPTICAL WAND (`wandRow`): Sam kneels at the shut door by the game's own row, the lens through 2.6 to 2.75 s in, turned 35° each way, 5.3 s, the fog of war the game's for the row and lifted for every draw. A STICKY CAMERA (`camRow`, `camSpot()` from where he STOPPED): the leaf pushed to `camWide` 1.75 rad, one shot by the launcher's own button 0.7 to 0.9 s in, stuck 1.0 to 1.1 s in on a wall 5.4 m inside (front) / 7.9 m (west), taken away as the next row begins. THE 40 MM (`shellRow`): shouldered down the wall AWAY from the stack, 20° off its line, and NOT fired (it arms 8 m out: through this door a dud), 4.5 to 5.2 s. THE WALL CHARGE (`wallRow`, a teammate's big slot): the squad's own order to the stack's men only, set 2.4 s in at `wallAt` 2.6 m, blown 5.2 s in with nobody in the backblast, the hole held, ONE restart stands the wall again — FRONT WAY ONLY: on the west the order refuses every spot on the stack's wall (its own words go to `refused`, the gun's row plays). THE BIG SLOT'S TOOLS (`bigMate`, `bigSam`, key `bigtool`; RE-POINTED at the second join, (14), to the build's own mechanic: any shut door that is not steel, worked from beside the latch jamb — NOTHING is locked by the picture, `lockUp()` / `unlock()` are gone, the row's mark is `gave` = the door's `lockBroken`, the leaf off or moved): a teammate by the squad's own order `bigClear` (doortools.ts `BIG_ORDER` through `game.orders.give`, the H row; the M870 off its sling for the shotgun; the door given 0.96 to 2.65 s in by shotgun, 3.2 s by hammer, worked 0.21 to 0.82 m beside the frame; the order taken down as the door gives and the leaf pushed to 1.3 rad by his hand: nobody goes in), Sam by the door's own row (verbs `breach` / `hammer` = 'shoot it open — LOUD' / 'hammer it open — LOUD', one committed beat) from the game's own spot beside the latch jamb (bigkit.ts `samBigSpot`) pulled in to `bigReach` 1.0 m of the frame's centre — walked to from his slot the game's spot was outside the door row's reach and the row was never offered — (0.3 m beside the frame, the door given 1.2 s in, the leaf to 1.9 rad, home 2.3 s), the leaf hung again under the dissolve. THE HAMMER IS NOT DRAWN in anybody's hands (bigkit.ts draws none): the blows play empty-handed. IDLE LIFE (`idle()`, `scan()`): a man in no row lets his gun wander `scanDeg` ±5 to 6° about his rest aim, eased, out of step, feet still, and stops the frame a row takes him (teammates by `Assignment.watch`, Sam by his cursor; nobody scans under a row of Sam's — `Game.puppet` has their orders). CHECK: the inner half's "THE REST OF THE KIT" block on each way (pick by frames, the thing measured, the loop, a cut made in the page on a frame, the stand whole after), `KITCUT_BREAK=1` turns each demo's pick and cut rows red. KNOWN / NOT BUILT: no teammate has a pane post on the west way and the head man has none on the front (the doorway instead); a loud gun and a suppressed one are not told apart by the check (both reach the picture's flash ceiling, `flashMax` 18); Sam's gun is seen to swing 19 to 30° aside for a moment as an acting teammate steps back under his cursor (the game's own aim from the cursor; why is not established); the wand's lens glow, the camera's feed and the heads' turn are not built; the shield went from the page on 10-15 and from the game on 10-18 (docs/agents/player.md). NEVER SEEN ON A GPU and never watched in motion: all of it — the counts above are positions, yaws, glass and lock state on the software adapter with the render stubbed.
  (12) THE REST OF THE KIT, REVIEWED (10-15, `src/host/kitView.ts` + two deps in `src/main.ts`, src/game not edited; it overrules (11)'s KNOWN lines on Sam's swing and on loud / suppressed). SAM'S REST AIM is written to his governed aim channel (`samAt`, `after()`), not taken from the cursor's ray: that ray landed on whoever stepped onto its pixel and the man was the aim point (19 to 30° aside); the cursor is still put on the line, at the first of three depths whose ray meets no body. Sam's own rows and the wand's cursor are as they were. THE MEND (`mend()`, only after a row that fired): decals, `resetGlass` + `resetGlassPen` (`deps.mendGlass`), the glass break list, `Destruction.reset()`, shards, `PropSystem.reset()`, `repairLights()`, and the porch fixture's box hung again (`WallBreak.reset` cuts the statics back to the authored ones). It does NOT touch doors, switches or men (their rows' own `tidy()`), and smoke and casings run out on their own clocks. `waits()` holds neither big-slot row for an open leaf: each pulls it to in its own first phase (`ajar`, `bigGive`). A CUT's walk home is at the swap's pace with no stagger, bounded by `homeSecs` (the one `homing()`: (13), (14)); Sam's own walk is his next row's. `finish()` hands Sam's aim channel the gun's real yaw before the puppet is let go (the wall charge's row had left it elsewhere: 25° of swing toward the stack on the next row). A burst goes through `Firearm.fire()` (`deps.fire`), so the rounds are counted and the gun's own tracer rule lights (AKS-74U: one in three; the FN2000 and the pistols carry none); the magazine is topped up as the row ends. The launcher rows read the hand the cut row was about to put back (`handDue`, `handWas()`): a can cut by the camera's tile left him the pistol. CHECK (new rows, inner half; RED on the tree before = run once against it, way 1): Sam within 8° of his rest aim on every frame of every teammate row, and the idle row's 8° for him too (red: 19 to 20°); thirty gun rows on end and the room as at boot — wall damage, open cells, solids, statics, hidden boxes, screens, props, fixtures, panes, marks — with a tracer to each burst (red: no tracer); the mend's resets under 8 ms of this thread (0.2 ms; red at 13 ms where cells had opened); tracers and the magazine (red); a loud and a suppressed gun differ by the flash the game ASKS for (153 against 48.6) and the report's voice — what is drawn is under `flashMax` for both (green before too: the difference was always there, the check did not read it); a teammate cut mid-burst is asserted; each tile at zero has its own thing happen in the game with the page's card at zero through it, and the outer half reads the parent's card (green before); the breaching shotgun picked with the leaf open, a teammate's and Sam's (red: 2.1 and 2.5 s held); a cut's next row inside 1.7 s (red: 1.8 s); the wall charge on Sam's card cut early, the gun never over 5° outside its start and its firing line (red: 25.6°); the can cut by the camera's tile, rifle back in hand (red: pistol). The light-to-gun row is 8 s again; where his burst goes through the DOORWAY the leaf cannot be to WHILE that row runs (it is what he fires through), so there it is to within 3 s of the row's end, still inside the 8. The swallowed waits are frame-counted and fail by name (`must`, `settled2`). NOT READABLE from the page: glass-pen holes (the reset is called, its result is not counted); how long any of it takes on a GPU. NEVER SEEN ON A GPU and never watched in motion: all of it.
  (13) HOME (10-15, `src/host/kitView.ts` only; a drive of the real page found the stack left 0.16 / 0.26 m short of its slots under Sam's next row, a restage that staged men where a burst had sent them, and Sam's frag off in the yard). Switch `__kitview.home` (on; off = as it was, the check's `KITHOME_BREAK=1`). `KIT_VIEW_LOOP.homeM` 0.08: `settled` and `homing()` hold every teammate to it (was `onSlot` + 0.1 = 0.3, and `homeMen` named nobody after a restart); `walks()` sends any man the row has not placed (`placed()`: its actor, `beat.moved`) to his place every frame and stands him up unless the row has the team on a knee (`kneel`); a row of SAM's waits `homeSecs` 1.5 for it (3 before the second join; tidy() does not walk Sam home meanwhile: his puppet freezes the men; Sam's own walk is his next row's and is NOT waited for — a row of his after one that moved nobody still begins on the next frame, where he stands — and a man still on the row's slow walk, or held by its stagger, is put on the swap's pace while a row waits), then — or at once for a man `farM` 2.5 off, any row — `seat()` puts the men home under the dissolve (`seats` counts). `place()` with `keep` keeps WHO is where and the yaws, never a position: every restage ends on the slots. SAM'S FRAG: thrown from `fragHalf` 0.5 toward the door (ACROSS it, away from his side: on the front way he crouches behind a window, and with its pane gone a burst about the door's axis has a line to him — one at rest 2.89 m in, 0.13 m off the axis, staggered him) with the leaf at `fragWide` 1.5, aimed each frame from his hand through the middle of the gap between the latch jamb and the leaf's tip (`fragAim`), the click held until the game's solved arc lands `fragLand` 1 m inside; a grenade found, after a bounce, under `fragMin` 1 m inside (or at rest where `destr.doorsFor` says its burst takes the leaf) is taken away, 'kept'; the men's own flight from it (frag.ts fragFlee, before any order or hold) is held for the row by the KNOB `FRAG.fleeM` 0 through `window.__knobs.registry()`, put back in finish() / live(); and, whatever the game's men would do about a grenade, THE HOLD in after() (post-step, nothing of the AI asked): from the row's start every teammate over 0.10 m off his place is put on it (pos, vel, speed, path, body yaw) and, 0.3 s after the row has them down, a knee that is not held is (`anim.crouchTarget` / `crouch`) — `__kitview.pins` counts each time it had to, 0 on this build (the rows hold it to 0: after a merge that changes what teammates do round a frag, a count says the game is fighting it) — a per-man 'holds for a grenade' flag in src/game would be the honest accessor. CAUSE of the yard burst: with his chest square to the wall his hand stood in front of the latch jamb. A teammate's row cut by opening YOUR card: Sam's row now waits for the man's walk home (0.65 s measured; the 10-14 row said within 100 ms — the cut and first motion still are). ROWS (`ROWS=home`, stepped by `__pauseLoop` + `__runFrames(1, dt)` at 1/60 and 0.05 s, both ways): the drive's order, his frag from two starts, the three older throws. MEASURED (software adapter, render stubbed, two runs each way, both steps): his frag crosses the door's line 0.25 to 0.43 m inside the nearer jamb (was 0.11 to 0.15, or the jamb) and lies 2.67 to 2.89 m inside on both ways, 0.70 to 1.08 m to the stack's side of the door's axis on the front way and 0.42 to 0.71 m on the west (12 bursts, both steps), no line to Sam with every pane counted gone (the rows' own measure); a grenade whose burst the game says has a line to Sam (frag.ts exposedTo, 0.3 s before it goes) is taken away, 'kept'; the others 0 m off their slots, `pins` 0, the door on, hits 0. NEVER SEEN ON A GPU; nobody has looked at the men being put home under the dissolve.
  (14) THE SECOND JOIN (10-15: (11) + (12) joined with (13), then the build to play merged in; `src/host/kitView.ts` and the check, src/game not edited, no new switch). ONE HOME: (13)'s invariant is the base — one `homing()`, one tolerance `homeM` 0.08, one bound `homeSecs` 1.5, one fallback `seat()`; (12)'s second `homing()`, its put-home and its wait for Sam's own walk are deleted, its intent kept (no stagger on a cut, the swap's pace — the actor's walk home too — both walks together, the wait short). The wall charge's men stay stood off until its restage (`placed()` counts `apart`). TWO ROWS CHANGED IN MEANING, by the owner's "nobody off a slot" over "immediately": YOUR card opened as a teammate walks home from his firing post, and the idle row ended by YOUR card, begin the frame every teammate is home (measured 0.27 to 1.27 s after the pick, the furthest man 0.18 to 1.02 m off at the pick and 0.08 m as Sam's row began; bound 1.7 s) — they said the next frame / 100 ms; with nobody off a slot they still do. The shield man's row picked while Sam is off at a pane waits for Sam the same way. THE BIG SLOT'S TOOLS re-pointed: (11). THE SHIELD IS GONE FROM THE GAME (10-18): the picture offers and shows none — the card's sanitize drops a stored one — and its demo, (9), and the check's `&shield` page went with it. FRAGS on the build's flee rules (all behind `FRAG.fleeM`, which the row holds at 0): through Sam's frag and a teammate's, both ways, 1/60 and 0.05 s steps, the men the row is not about 0 m off their slots, the deepest knee 0, `pins` 0, the door on, hits 0 — nothing more needed pinning. A PASTED LOADOUT (`kitPaste`, C / V on the cards) reaches the child as one kit message and no `sel`. NEVER SEEN ON A GPU and never watched in motion: all of it; the hammer is still not drawn.
  CHECK: `PORT=<dev server> node tools/qa/kitview-page.cjs` (354 rows, about 36 min here; the clock × 2, and × 1 for every row timed against the wall). INNER, the render stubbed, `&stillkit` first, then each way: the pacer fed a model of display frames by hand, several seeds a case (every steady rate; ±0.5 ms stamps; work that swallows a rAF, one late frame in ten and 1–2 s hitches move nothing; 90 Hz 9–13 ms an even 45; presents 14–19 ms off an even 40 and back once `eased`; slow from the first frame goes even; back after a slow spell with the period known, and 300 s after the tries are used up; a move between 120 and 60 Hz, a hidden tab; `KITPACE_BREAK=1` feeds the rows a pacer that never skips: 9 red) and the game's clock under skipped frames; Sam's smoke asked before the first picture, then the loop holding on it; the kit for four = ONE restart under the dissolve with the copy up and the men put back within 0.15 m; slots 1.1 m; the card switch (same objects, no restart, slots re-dealt, first motion ≤ 100 ms, nobody within 0.5 m of anybody); gun → light → gun with no tile; a pick from rest and mid-beat ≤ 100 ms; the leaf pulled to under the next row; a door charge picked with his light's leaf open = the CHARGE once the leaf is to; a gun, a suit, the light and Sam's gun changed live with no restart; a long gun for a long gun has that gun's `muzzleAhead`; Sam's swap cut in the stow ends with the new card and the gun in hand; Sam's card opened mid-switch: nobody off his slot as his row begins; a count gained and a tile at 0 both play; a blown door HELD, then hung again at the pick under the dissolve with nobody staged; a frag cut before it bursts (no item left) and one let burst (held, one restart, the order kept); a can already out (left lying, no vent open after); Sam's throw cut before release (no can, the leaf reused); the big slot (the shotgun and the hammer in it play the door's demo — a teammate's by `bigClear`, Sam's by the door's row, nothing locked — with one restart for a teammate's hammer and none after); a big slot with NOTHING in it under the highlight restarts nothing and plays the gun (10-18: the row that planted a shield card; this row's text is new and has NOT been run); the check's `&shield` page and the shield's own rows went with the shield (10-18: three inner pages a full run, not four); the two demos' picks by FRAMES with a step taken after the new beat is up, their cuts made in the page on a frame (the charge with his hands on it, set but not blown, just blown, picked from his smoke with the leaf open, refused on steel, kept; the frag in the room: Sam never staggered); every thing thrown at rest INSIDE (smoke 0.5 to 1.8 m — a teammate's rests 0.77 to 0.99 m in — Sam's stun 0.8 to 1.5 m: 1.08 to 1.38 measured); a pick row timed on the wall clock (100 / 150 ms) also passes by the second frame (the third under the dissolve's copy); EVERY FRAME of all of it: no aim yaw over 150°/s (+10 %), no body yaw over 100°/s (+10 %), the lit beam never within 25° of the wall's line once up, never out of the room, never within 20° of a teammate; never `dip` said; the error paths and the frame as before. OUTER: as before, plus a kit message there inside 60 ms of the click, a child's `dip` changing nothing, `?nobigslot` (the child opened `&nobigslot&noslots`) and A LOADOUT PASTED onto a teammate's card (C on one card, V on another: ONE kit message — one restage under the child's dissolve at most — one write of the store, NO `sel`, the open card and highlight as they were, nobody else's card moved). `KITVIEW_BREAK=1`, `KITMOMENT_BREAK=1`, `KITCUT_BREAK=1` (`__kitview.preempt` false: a pick waits its turn), `KITHOME_BREAK=1` (`__kitview.home` off; `ROWS=home` runs its rows alone) and `GRACE_BREAK=1 ONLY=outer` must each FAIL (at the second join: 21, 2, 62, 6 and 1 red rows, exit 1 each; the full tool green twice on end, 354 rows, 2172 and 2176 s).
  MEASURED AT THE JOIN (10-15, the software adapter, the render stubbed, three full runs): a teammate's smoke at rest 0.81 to 0.82 m inside on the front way, 0.99 to 1.02 m on the west; Sam's smoke 1.08 to 1.32 m; Sam's stun 1.08 to 1.36 m on either way; first motion 2 to 33 ms after a pick; after a cut that left men off their slots Sam's gun row began 0.57 s (the shield's number two), 1.25 to 1.8 s (his charge: hands on, set, blown) later with nobody over 0.35 m off his slot — before `homing()` it began on the next frame with a man 0.96 to 1.23 m off; his charge picked from his smoke began on the next frame (it was 2.1 s); a charge kept: the next row 1.7 s after (it was 6.0 s); Sam staggered by his own frag 0 times.
  MEASURED IN THE CHECK (10-14, one page at a time, the software adapter with the render stubbed, both ways, one run each of the final tree plus three earlier of one way): first motion 6 to 22 ms after a pick; the fastest aim yaw of any man on any frame 150°/s, body 100°/s; the lit beam no nearer the wall's line than 51° (front) / 56° (west); Sam's smoke at rest 1.31 m inside, a teammate's 1.02 to 1.05 m, Sam's stun 1.12 m (front) and 1.33 to 1.38 m (west: close under the row's 1.4 — `samStunM` 0.24; 0.2 gave 1.06 on the front, 0.35 gave 1.59); a teammate's door charge 6.3 s, his frag 4.6 to 5.5 s, his stun by the door tools' own order about 5 to 8 s (over the 2.5 s asked for a bang: the order's own stack and kick); 5 dissolves a page, none without its copy; the gun's swap written 0.58 s after the pick. Sam's leaf for a throw is 1.3 rad (`wideSam`), not the 0.9 asked: at 0.9 his line from across the door met the leaf and the can stopped 0.58 m in.
  NO CHECK FOR: a page left live for hours, the loop at the page's real 12 / 90 frames, `pause` under a beat or a dissolve, a kit message under a dissolve, a restage that throws, a beat that ends `cap`, `lost` or `shut` (`kept`: Sam's charge only), a refused order, a suppressor's swap, the trim, Sam's charge with `?noowncharge` or picked from his light or stun, Sam's marker light after a NEW gun (with the big slot on no change of his card builds one), Sam truly caught by his own frag (0 staggers counted here: nothing was moved), the goggles, the fourth man's step round Sam, a second teammate's card opened mid-swap, a frag burst two steps before a cut (counted, the row's tick not yet run: the frame after the burst IS checked), a wait left running across a card switch (`waitT`, reset in `pick()`), the wait running out, a man down under a beat, a way-in door that IS locked, any level but the records office, the pacer on a real 120 Hz display, the copy of a WebGPU canvas on a real adapter (`dissolve.cuts` counts a copy that could not be had: the work is then done as a cut), the white rectangle. KNOWN: under a beat of Sam's own `Game.puppet` takes every teammate's order away, so a man off his slot stands where he is until Sam's beat ends — Sam's row now waits for walks under way (8), 4 s at most (and `fight.live` is false under it: roomfight.ts — the goggles' draw rule); the gun and light rows start on arrival, not on the last leg of the walk. NEVER SEEN ON A GPU, AND NEVER WATCHED IN MOTION ANYWHERE: all of it — the rotation, the hands' move on a gun change, the dissolve, the eased aim, the light through the door, the 60 cap. The check's numbers are positions, yaws and counters, not a picture.
- **Every pick's picture shows its kit at work** (2026-10-18; the maintainer, of the picture beside the cards on Mousehole with the hammer picked: "some
  demos still don't really do anything (e.g. dynamic hammer here)"; `src/host/kitView.ts`, five levels' `kitView` blocks through their generators,
  `tools/qa/kitview-work.cjs`, a row of `tools/qa/kitview-plan.ts`). NO NEW SWITCH: picture only (the `?kitview` child page), both stands the same;
  `src/game` not edited.
  THE CAUSE, MEASURED (the real page, headless Chromium on the software adapter, the render stood in for): a row that works a LEAF — the hammer, the
  breaching shotgun, a door charge, the wand, a teammate's bang or frag on order, Sam's sticky camera — is refused where the way's anchor has none
  ('no leaf at this way in') or is steel ('steel: it holds'), and `begin()` plays the GUN's row instead; on a blank wall with no pane the gun's row
  only raises and scans. BEFORE, picks idle of 27: mousehole way 1 (a wall span) 16, glasshouse way 1 (a wall span) 16, snatch (an open gate) 13,
  mousehole way 2 (a steel fire exit) 9, the office's door 2 (a teammate's wand and goggles, which had no row). `kitview-levels.cjs` passes that
  fallback ("the GUN's row with the reason kept: said, and a pass"), which is why nothing was red.
  WHAT CHANGED. (1) EVERY WAY ANCHORS ON A DOOR THAT IS NOT STEEL (docs/level-format.md says the rule; `kitview-plan` section C fails any other way,
  `KITPLAN_BREAK=1` reads every door as steel): mousehole's `ward` set has a side door `mh_side` in the wall the stack stands on, both ways anchor on
  it, and the wall charge still opens the wall beside it; glasshouse way 1 is the `front` door seen from the forecourt (`ref`; the gun has its pane
  there); floodlit and snatch are the `front` door the open gate leads to; depot way 1 is the first hut's door `a_s`. The span code stays (a level
  may still be planned on one: the dry run) but no shipped way is a span. (2) THE FIRST TURN: a pick that cut a row of Sam's began with his OLD card
  (`samCardDue` was applied in `before()` only while no row of his was up, and `direct()` cuts and begins in one step) — his hammer or shotgun, just
  put in the big slot, ended 'big: the door never offered it' and only the loop's second turn worked. `direct()` now puts the owed card on him before
  `begin()`. (3) A TEAMMATE'S WAND has a row (`wandMate`: the squad's own `wandLook` order to him alone, the fog the game's for its length and lifted
  for every draw as in Sam's row, the wand on his staged card for the row; asked with `whyNot` first, so a refusal is not said aloud every step; mark
  `through` off `WANDORDER_STATS.live`). (4) HIS GOGGLES' TILE plays the quarter turn that shows him (`TILES.nvg`), as his suit's does: worn kit, and
  no order lowers them (nvg.ts). (5) The quiet rows say their work for a check: `lit` (the beam swept through the opening), `turn`.
  (6) A TEAMMATE'S FRAG AFTER A CHARGE AT A LOCKED DOOR: the leaf hung again under the dissolve is the level's own locked door again (`Door.reset`), frag
  and clear halts at a handle that does not turn, and the row ended `lost` in a second — at the office about one pick in eight (whenever nothing had
  unlocked the leaf in between). `byOrder` unlocks the way-in door first, as every other row that works it does: 14 of 14 after.
  THE CHECK: `node tools/qa/kitview-work.cjs` (env in its header; needs `bun run dev` on PORT) picks every tile of Sam's card and a teammate's and
  every thing the big slot holds, and reads the FIRST row begun for the pick (after a wall's opening charge or a gun's swap): AT WORK = the pick's own
  thing with its work mark; the gun's row instead, or its own row to no mark, is IDLE and red. `SETS=1` says what a squad kit set and a member's set
  play (not judged: a set has no row). `KITWORK_BREAK=1` (the big slot told empty under the pick) must exit 1. EXCUSED, said as a pass: Sam's wall
  charge when he is ALONE (the picture's wall charge is the squad's order). Exit 2 on an unknown pick name.
  A pick idle on its first pick is picked twice more: idle again on either is red; at work both times is a pass that says it MISSED ITS FIRST TURN
  ONCE and is counted in the tally (Sam's frag that came back off the leaf and was taken away, `kept`: once in some twenty throws here, on the depot's
  hut door). Also EXCUSED: the sticky camera where the way in opens on a yard (12 m of open floor or more behind the leaf: `camReach` finds no wall to
  stick it to — the police post's gate), and a teammate's frag on a RESCUE (the order is refused with hostages on the floor: the consulate). The big slot's shotgun and hammer on the LONG HALL (the level
  issues its own kit — `kitIssue` — and a card's big slot never reaches the men: `Player.bigKit` stays 'none', no `bigClear` order), and the wall charge
  at the records' WEST door (too short a stretch of wall beside it). The PASS: the wall charge (no floor behind the gate set's wall) and Sam's frag
  (the wicket opens on the yard: its burst always has a line to him, and it is taken away). (7) THE WAND AFTER THE CAMERA
  (found by the wand's owner with `DEBUG_EVAL`, mended here): the sticky camera's row leaves the leaf held at `camWide`; picked next, `wandRow` walked
  Sam to his post inside the leaf's arc, the leaf came round to him, went back and stayed, and the door never offered the wand (the block's kitchen
  door in the table's order, the crossing's and the bazaar's gates). The row now pulls the leaf HOME first (phase `shut`, `wandShut` s at most) with
  him out of its sweep — where he stands if `wandClear` clear of it, else his own place — and only then walks him to its foot. Real page after:
  the block way 1 31 of 31 with no excuse, the crossing's and the bazaar's gates 9 of 9 (charges, camera, wand, three times round), mousehole way 1
  31 of 31. `DEBUG_EVAL='<expression of g>'` samples the game through a pick's turn. An idle turn of a door order prints the order's stages and the leaf's angle;
  `REPEAT=n` plays the picks n times on one boot.
  MEASURED AFTER (the real page, headless Chromium on the software adapter, the clock at 2, one turn a pick, 27 picks a picture and 13 with Sam
  alone): before the join with the build's head, every pick AT WORK on mousehole ways 1 and 2, depot way 1, glasshouse way 1, snatch, floodlit, the
  office (Sam and 4) and the vault quiet with one teammate; the vault quiet with Sam alone 12 of 13, the wall charge the one excused; `KITWORK_BREAK=1`
  on mousehole 4 FAIL, exit 1. On the join: mousehole both ways 54 of 54, snatch and floodlit 27 of 27, the office 26 of 27 (the teammate's frag of
  (6), before its mend), depot way 1 26 of 27 (Sam's frag `kept` once; 8 of 8 on a repeat), the police post (quiet, Sam alone) 11 of 13: the wall
  charge and the camera at a yard gate, both excused. `kitview-levels.cjs` on mousehole way 1: 30 PASS of 30. The console said nothing on any.
  SINCE THE TWO GUN TILES: the check also picks each man's `primary` and `secondary` tile (both play the gun's row), 31 picks a picture;
  mousehole way 1 on that join 31 of 31.
  THE WHOLE SWEEP ON THE JOINS (every level with a block bar the lessons, 36 ways): every pick at work on mousehole, depot, glasshouse, barracks,
  killhouse, block-squads, compound, warehouse (both ways each), snatch, floodlit, the office, defuse, registry, the records' front; the misses are the
  excused ones named above (the long hall's big tools, the consulate's frag on order, the pass's wall charge and Sam's frag, the records' west wall
  charge, the block's wand for Sam (mended since: (7)), a quiet man alone's wall charge, the camera at the police post's and lights-out's gates). A first turn missed once:
  Sam's wand at the crossing's and the bazaar's gate (the same fault: (7)), his frag at the depot's hut door, his gun on the long hall's first pick after the boot.
  NOT DONE, SAID ON THE PAGE'S LIST: the 40 mm is shouldered and never fired (the round arms 8 m out); a squad kit set has no demo of its own; the quiet picture still plays the loud answers (an open
  call with the kit figure's owner, not decided here).
  NEVER SEEN ON A GPU: every picture named above as changed (mousehole's door in the ward's wall and its lintel, the four re-anchored ways), the
  teammate's wand row, the goggles' turn. Stills were drawn on the software adapter only.
- **The standing man holds his gun as the mission's man does** (2026-10-18; `src/ui/kitFigure.ts`, the picked man the start page draws by itself: under
  `?oldfigure` only since 10-20 — he no longer stands in where the live picture is not up). He was laid out without IN HAND (`src/game/inhand.ts INHAND`, docs/agents/player.md): the figure
  poses a `Character` of its own and never said the drawer's word, so a teammate's rifle or carbine had its pistol grip 4.2 cm short of the palm and his
  9 mm stood 4.7 cm off the fist. NOW, with `INHAND.on` (no switch of its own; `?inhand=0` = the figure as it was), the bake says the word the game's
  drawer would, row for row (combat.ts `handPropsRaw` for you, `guardKit` for a teammate): a long gun stays put and the trigger hand goes onto its grip
  (`longHold`, under `INHAND.long`; yours under kit handling is fitted into the hand instead and gets no word, as in the game), a pistol is drawn in the
  hand's own frame (`inHand`, a teammate's Five-seveN with `INHAND.fit`). A change of the switch builds him again (`sigOf`).
  CHECK: `bun run tools/qa/kit-figure-roster-check.ts` (both stands; eight gun poses through the measuring hook `figureHold`: the word is the game's, the
  grip is in the fist's hollow by inhand-check's own tolerances, a long gun and the hand on its fore-end are where they were, no word with the rule off;
  `KITFIGHAND_BREAK=1` = laid out without the word, must fail). MEASURED (grip to the hollow of the fist, without the rule → with it, two seconds of his
  idle, the same on both stands unless said): a teammate's quiet rifle, loud rifle and shotgun 4.2 → 1.0 cm, the gun's boxes unmoved, the trigger wrist
  moved 4.8 cm, the other wrist 0.0 mm; a teammate's Five-seveN 2.4 → 1.7 cm (the gun 2.4 cm into the hand), his 9 mm 4.7 → 2.4 cm (4.4 cm); your pistol
  1.6 → 1.7 cm under kit handling (2.4 → 1.7 on the frozen stand); your rifle 1.0 cm either way under kit handling (4.2 → 1.0 on the frozen stand).
  THE HAND ON THE FORE-END, MENDED WITH IT (no switch: the figure was wrong, on the shipped stand only): a teammate with the quiet rifle had his SUPPORT
  hand laid by `sc20kGrip(…, fit)`, the hold of your fitted rifle, while his rifle is drawn unfitted — its wrist 3.9 cm from where the game has a
  teammate's (`sc20kGrip()`, game.ts). Now the fitted hold is yours alone, as in the game (player.ts); two rows of the same check hold it (red before
  the mend on the shipped stand, 3.9 cm). The figure wears no belt torch and no defender's holster (the rule's `belt` and `holsterOut` are defenders'
  things): nothing of those shows on it.
  SEEN: one offline still of a teammate's rifle hand each way (the software view; the fist moves up onto the gun). NEVER SEEN ON A GPU, nor on the page,
  nor by the maintainer: whether the fist reads as closed round the grip, the pistols' new place in the hands, the idle in motion.
- **The picture's door outlasts the gun's row** (2026-10-22; `src/host/kitView.ts`; no switch of its own: with `DOORSHOT` off, `?doorshot=0`, no
  round does more than mark a leaf and none of this is reached; `__kitview.leafMend` is the flag a check turns off). `doorblast.ts DOORSHOT` (10-19)
  makes a wooden leaf go in pieces once it has met plasterboard's count of rounds, six rifle rounds on the page, and the count never decays. The
  picture's gun row puts rounds into its own door: at the records office's second way in all three of a burst through the doorway meet the leaf held
  open beside it; at the first, one or two of a burst fired from off his slot meet the shut one. The row is `damage: 'none'` and loops, so the leaf
  splintered on the second or third turn and nothing hung it again: every row that works a leaf (charges, the wand, the big slot's tools, the
  throws) was refused from then on and the gun's row played in its place. A whole run of `kitview-page.cjs` was 26 rows red on the second way in;
  nobody had run that half since before the rule (the first way in passed: fewer rounds meet its leaf and a charge's rehang came before the
  count was full — in one run on a loaded machine the leaf went there too). NOW: `mend()`, which already puts back
  everything else a burst leaves as the next row begins, zeroes the leaf's count too (`Door.shot`); and `finish()` marks a leaf found in pieces
  after ANY row as `dirty = 'leaf'`, so the next row begins under the dissolve with the leaf hung again (`rehang()`, as for a blown one) — one
  burst worth the whole count still splinters the door, as the game has it, and is mended. CHECK: `kitview-page.cjs`, THE LEAF UNDER FIRE, two rows
  in the inner half: the count set half a round short after his burst is 0 as the next gun's row begins and the leaf never goes; the count set half
  a round short as a row begins, the leaf goes in pieces under it and is hung again under one dissolve (at a way in where no round of his meets the
  leaf in four rows there is nothing to try and the row says so: the first way in). `KITLEAF_BREAK=1` (the second way in by default) turns both red.
  Measured, software adapter, one run each: outer 32 / 32, the first way in 161 / 161, the second 155 / 155. NOT DONE, and for the list: a burst
  through the doorway still goes into the open leaf rather than past it at the second way in (seen in the rounds' own log; why was not looked
  into); the quiet picture's one round at the lamp does not count as a burst for `mend()` (a miss into the leaf is counted until the next restage).
  Never seen on a GPU: what the splinters of a one-row leaf look like under the dissolve, and whether its GPU debris (about 20 s of life) outlasts it.
- **The picture and the standing man follow the tree card's new rows** (2026-10-19; `src/host/kitView.ts`, `src/ui/kitFigure.ts`; no switch of its
  own: it follows `KITTREE`, and with that off no card has these tiles and the man is drawn as before). THE STANDING MAN read both of his guns by
  one flag (yours: always suppressed; a teammate's: his `suppressed` for both) and drew your goggles whatever the card said: under the tree the check
  found five of the six cards it tries drawn wrong. He now reads each slot's gun from the game's own `kit.ts kitSlotDef` (a can taken off is the
  same gun, bare: `gunlook.ts bareLong` / `bareSide`) and your goggles from your `nvg` row, as `combat.ts` does through `kitYouNvg`. THE PICTURE: the
  secondary's suppressor (`sideCan`) plays the gun's row, as `secondary` and `suppressed` do; SPONGE ROUNDS (`rings`, yours alone) play the
  launcher's row with that load on the tube (`tubeRow('ring')`, the 40 mm's row by another load: shouldered down the wall away from the stack and
  NOT sent, because a teammate stands along that wall and a round to the head puts a man out cold); `rings` is a COUNT, written to the picture's
  own rifle. Your `suppressed`, `light` and `nvg` rows were already the gun's, the light's and the turn's; a card of yours with NO light now plays the gun's
  row dark on the light's tile, as a teammate's always did (it swept a beam he does not carry). A teammate's `sideCan` (and his goggles)
  still restage the room under the dissolve: his sidearm is dealt at staging. CHECKS: `kit-figure-roster-check.ts` has nine rows for it (34 lines on
  both stands; seven of them are red on the figure before this); `kitview-work.cjs` has the picks `sam.suppressed`, `sam.sideCan`, `sam.light`,
  `sam.nvg`, `sam.rings`, `mate.sideCan`; `kitview-page.cjs` has one row for the sponge rounds (its own row, the load on the tube, nothing in the
  air), and its rows about a teammate's loud rifle take either row a card's unsuppressed issue rifle is (`aks74u`, or `mk18bare` under
  `GUNSLOTS.bare`: no tracer spec, the suppressed gun's reach, a round kept in the chamber), where four of them had gone red on the build. NOT DONE: a teammate's 40 mm tile has no row of its own in the picture (the gun's row plays); the sponge round is never seen to fly.
  Never seen on a GPU.
- **The gear screen per level: the plan, the set loader, and the picture staged from them (10-15)**. The owner:
  "can we make it nicely abstracted so tweaks to one of them don't require churn elsewhere?" / "feel free to make a bespoke set for the gear screen …
  it should then just show off the vibe of the level / be recognizable". `src/host/kitViewPlan.ts` measures a way in from the level's own boxes (the
  anchor a `door` or a `span`; an authored key always wins). `src/host/kitViewSet.ts kitViewSetLevel(levelData, way)`: under `?kitview` ONLY (main.ts
  `bootLevel`, between parse and `loadLevel`), a way that names a `set` loads the set's boxes / doors / lamps in the level's place — name, materials,
  surfaces, sky, daylight and directional lights kept; stand-ins for what any level must have (two sunk breaker boxes, the objectives, a one-room
  `roomClear` on the plan's five places, a far leaf where the set has none) — and the scenario started is a room clear whatever the mission's kind
  (`kitViewSetQuery`). No switch: a way with no set returns the SAME OBJECT, so both stands and every digest are as they were.
  CHECK: `bun run tools/qa/kitview-plan.ts` (section F: a set held in the check over records and registry, through the validator, `loadLevel` and the
  headless game; 49 level files untouched and loading byte for byte; `KITPLAN_BREAK=1` reds it; same rows under `TPS_PROFILE=shipped`). A level's block no
  longer takes a `lived-check` base revision (`scenarios.kitView` is exempt there). How to stage one level: the kit figure thread's
  `per-level/how-to-stage-a-level.md`; the keys: `docs/level-format.md`.
  WIRED (10-15, later the same day): `kitView.ts place()` stages from the plan (`__kitview.plan` is the readout); `levelLoad.ts levelFileOf` hands the child the
  file's own boxes / doors / lights. Records-only numbers that moved INTO the records block: `slotGap 0.9` (both ways), the front way's `show ['lived.yard']` and
  `light.fill.offset [0, 6.62, 2]`. A WAY WITH NO LEAF (`span`): a gap plays gun, light and throws through the opening; a blank wall is 'a door that opens once,
  loudly' — a row that needs an opening (`Row.opening`: light, throws) is first the wall charge on the span (`Beat.prelude`), the hole is KEPT (`Staged.hole`,
  the men put home under the dissolve, the wall not stood again) and the row plays through it; the wall charge's own tile stands the wall again first; a row
  that works a leaf (`Row.leaf`) plays the gun's with the reason in `refused`. A frag's restage also stands the wall again (the next throw opens it again).
  Sets: a set way's `roomLights` defaults to 1; a derived fill lamp pulled in on a short floor is dimmed by the square of the pull; boxes under 0.25 m
  (`KIT_PLAN.lowTop`) are never occluders; LOOK TWINS by `material: 'look|plain'` (`kitViewSet.ts kitSetPaint`); the bundled office goes through the loader
  too (main.ts `bootLevel`). THE OFFICE's block is `KIT_VIEW` in `levels/office.scenarios.ts` (data-only from here: the `server` door from the corridor, indoors — THE GLASSHOUSE, THE OFFICE AND THE BLOCK'S SQUAD ROWS below);
  the parent asks with no `level` (`ui/missions.ts kitViewWays()`), the child builds the office and stages from that block. KINDS: the child stages room clear /
  rescue / night breach teams, and a QUIET or SOLO mission with its own men (`stagedWay … fixed`: Sam alone, or Sam and his partner; a `kit` message does not
  resize it; a quiet mission deals its start, so its way writes `ref`). REVIEW FIXES (10-15): a kept hole and its wall can no longer disagree (`mend()` never
  stands a wall while `Staged.hole`; after `holeBursts` bursts through it the room is restaged under the dissolve) and the hole is kept only ON the span, else
  the reason is remembered (`shutWall`) and the row is the gun's; the span's charge touches nobody (the order is every teammate's, Sam is walked out of its
  reach first, and it blows only with `blastShare` 0 on every man, else it comes down unblown after `wallLate`; a `kitview-levels` row); the picture's two lamps come off the light list
  across a restart (the office stands near the 64-light buffer: `spawnUnit` refused its fourth man and the picture went out on its first restage); an authored `hide` wins outright and a derived occluder that is not a thing is a plan
  `problem` (`__kitview.plan.problems`, warned once, a FAIL row in `kitview-levels`); a broken block no longer takes the real mission down
  (`parseLevelData(text, { kitView: 'drop' })` in `bootLevel` without `?kitview`; the child and the tools stay strict, and a child whose level will not parse
  says `none` instead of staging the office). WHICH LEVELS HAVE A BLOCK is not listed anywhere (a thread staging its own levels edits no shared list): `grep -l '"kitView"' levels/*.json`, or the first line of
  `bun run tools/qa/kitview-plan.ts --quiet`; a level with a look twin carries the SAME block in both files (the parent reads `X.json`, the child loads
  `X-gwot.json`) and the plan tool FAILS a pair that disagrees. CHECKS, both list the office beside `levels/*.json`:
  `bun run tools/qa/kitview-plan.ts [level …]` (static; `KITPLAN_BREAK=1` must exit 1; `KITPLAN_OUT=<file>` writes the dry run's table — nothing is written by default);
  `PORT=… node tools/qa/kitview-levels.cjs` (the page, one level-way at a time; `LEVEL=`, `WAY=`, `LOOK=plain`, `KIND=`, `SQUAD=`; knows no level; `KITLEVELS_BREAK=1` must exit 1);
  `kitview-page.cjs` (the records office's own rows; + Sam stood on his row's firing post, `__kitview.beat.post`, at the first round after his charge is cut).
  THE SECOND REVIEW (10-16; `src/host/kitView.ts`, `kitViewPlan.ts`, the three checks; src/game not edited; no new switch — picture-only, both stands the same).
  The wall charge's row over with NOTHING BLOWN (the stand-clear gate ran out, its order refused once Sam had walked clear, the charge lost, the cap) is
  REMEMBERED per way (`shutOwn`; on the span itself also `shutWall`): the tile is the gun's row from then on, the reason in `refused`, nobody walked out each
  loop; at a wall anchor the order is every teammate's at every spot; a charge on the wall comes down under the restage's dissolve (a pick's cut too), never
  popped off (`tidy()` leaves it while the room waits). `__kitview.standClear = false` is a check's switch: the gate held shut. The child plans a way with
  `kitViewPlanChild` (both passes; the first pass's "not a thing to sink" problem now reaches `__kitview.plan.problems`). After a charge opened the wall on a
  teammate's card Sam is seated with the men; `?stillkit` takes the lamps off the list before its restart. AT A GAP ANCHOR (and only there) the plan's
  porch lamp and its box are worked out onto the jamb's wall or post at the STACK'S end of the opening (the other end's where that one is under
  `KIT_PLAN.porchCarry` 2.0 m), `porchHand` 0.2 m past the jamb and under that wall's own top — no box, the light alone overhead, where neither end is
  tall enough; before, both hung at along 0 under the lower side's top, in the open air (authored `light.porch.offset` / `fixture.at` win as ever; a door
  and a wall span plan to the byte as before; kitview-plan D's rows, 179 PASS; planned only, never seen on a GPU). CHECKS: kitview-plan 173 PASS (both stands),
  `KITPLAN_BREAK=1` exit 1; kitview-levels mousehole both ways 49 of 49 (the remembered refusal's row among them); the office's room clear 23 of 23.
  kitview-levels' office default is now three runs (room clear, rescue, night breach) — the rescue was red until 10-16: `stagedWay()` read
  'whatever `.end` holds' as the mission's end, and a rescue's `.end` is its own METHOD — 'ended' every frame, a restage every frame (1785 in 1785 frames), no row.
  THE RULE: a kind's end is its own record read by name (`roomClear.end`, `rescue.result`; night breach and quiet keep none). Rescue and night breach 23 of 23 each.
  kitview-page's no-block row finds its own mission (`KITNOBLOCK=plant` = the planted case; both 33 of 33 on the outer half).
  A SET'S MEN ARE THE MISSION'S (10-16): `kitViewSetQuery` says the size outright where the mission's own link carries none — a quiet mission alone (`?quiet`, no
  `squad` key: alone is the kind's own size) and the solo night are `squad=0`, a quiet pair `squad=1`, a `squad4` beside `quiet` dropped — because a room clear
  with no size key is Sam and two, so a lone quiet mission on a set showed three men; no switch (a link that names a room clear, a rescue or the night breach is
  copied as before), and both checks now ask with the mission's OWN link, built by the start page's two functions (`squadSearch` over `scenarioQuery`:
  kitview-plan `missionQuery` and F's row 'the set's men are the mission's' over all 142 links — 180 PASS both stands, 178 and 2 FAIL before the mend;
  kitview-levels builds its URL the same way through bun and prints it).
  THE DRESS ON A SET IS THE MISSION'S (10-16; was NOT MENDED: `game/cast.ts sneakSuit` asked `activeScenario`, a set is a room clear, so a quiet or solo
  mission's men stood there in the issue dress, helmet and plates). cast.ts's owner landed the hook (`scene/look.ts setSuitAs` / `suitAs`, read by
  `sneakSuit` before the scenario); `host/kitViewSet.ts kitViewSetDress(q)` reads the mission's own link as `kitViewSetQuery` does — a quiet mission
  `{ suit: 'quiet', sling: 2 }`, a link naming no mission (the solo night) `{ suit: null, sling: 2 }`, a loud one null — and `main.ts` says it once, on a
  set only, in `?kitview`'s OWN window (an iframe: its own page and modules; the start page that hosts it is not touched): `setSuitAs(suit)` and
  `KITANIM.sling = 2` (the rifle across the back, which is what those two missions show by the table's own 0; kitanim.ts not edited). A level's own way
  and a loud mission's set: nothing said. kitview-plan G: one row, the mission as itself against its set headless — the suit man for man (alone, as two,
  the solo night) and `kitSlingFront` — on both stands (the row holds `KITANIM.on` on at each reading, so unsaid the rifle is in front on FROZEN too and
  the sling half can fail there: the eight findings below, 4), red under the break, everything put back after it. Headless only: the suit on a set has not
  been drawn on a page; kitview-levels JUDGES the suit on a quiet or solo mission's set (below, 3: written, not yet run).
  NOBODY HAS SEEN any of it on a GPU: every page run was the software adapter with the render stubbed — how a set LOOKS (its light, its paint, the hole) is unjudged.
  TWO ROWS THAT PASSED IN ONE RUN AND FAILED IN THE NEXT (10-16, records' front way, the same tree): (a) THE CHECK'S RACE — a pick is a message, a task: a
  display frame can run between kitview-levels telling it and the page hearing it, and on that frame the loop's own next turn of the tile still under the
  highlight begins for the card still open (Sam's wall charge, as teammate 1's card was asked for); the pick cut it a frame later, as a pick cuts any row,
  and the tool read it as the pick's row. The director was right and is not changed for it: it has no pick to honour before the message is heard. `__kvRow`
  now counts a row as the pick's only when it began after the pick was HEARD (its own listener, added after the director's), and the turn begun in between is
  printed and held to: cut by the pick, no mark, nothing left set, nobody off his place. (b) THE PICTURE — a teammate's stun could find SAM: where the can
  has a line to his head the game blinds and folds him whoever threw it (`SAMSTUN.ownSeen`, combat.ts `detonateStun`; doortools.ts `bang` spares him only
  with no line), `after()` put the stamps out and counted `hits.sam`, but `Character.hitFrom` had already knocked him on his place. One teammate's bang in
  39 logged. Now `spareSam` holds `SAMSTUN.ownSeen` off (the page's knob registry, as `FRAG.fleeM` is held) while a teammate's stun row runs or a
  teammate's can lies unfired, so the door tools' own-side rule is Sam's too; Sam's OWN can keeps the game's rule and `hits.sam` still counts it. No switch
  and no break word of its own: the line is there one turn in many, and the row that holds it is 'what was thrown … touched nobody'.
  THE FOURTH MAN'S ACTING PLACE KEEPS A BODY'S CLEARANCE (10-16; read from the numbers by the session staging yard gates, never seen on a page): with HIS card
  open he stands at `act4` — 0.2 m past Sam's jamb, 0.9 m off the line — and Sam's place is 0.45 m past the same jamb, pushed out only while that is inside
  `samClear`: 0.72 m apart at a 0.86 m door, 0.51 m on mousehole's 1.5 m span, 0.39 m on any opening of 2 m or more. `kitViewPlan.ts kitPlanAct4` (what
  the stage now calls; `KIT_PLAN.actClear` 0.7 = `KIT_VIEW_LOOP.actClear`) slides the ACTING place along the wall toward the anchor's middle, 5 cm at a
  time, to the first that is 0.7 m from every other man's place and on free floor; no slot moves, a place already clear is the one written to the bit, and
  every staged way's plan is the same to the byte. ONE STAGED WAY CHANGES: mousehole's wall span (both looks), where the fourth man with his card open now
  stands 0.3 m nearer the span's middle. Checks: kitview-plan C3 (every way as the child plans it and bare anchors 0.86 to 6 m wide, every card open at
  squads of 1 to 4, no two places within 0.7 m; `KITPLAN_BREAK=1` = the place as written: mousehole's span and the bare anchors FAIL) — 201 PASS both
  stands; kitview-levels opens the LAST teammate's card as well (one pick, his gun's row) and holds every man 0.5 m from every other once it is over.
  THE SEAM, MENDED ON A PART THREAD'S CLAIMS (10-16, the registry and consulate's staging; `src/game` not edited; no switch — picture-only; planned and
  typechecked only: NOTHING BELOW HAS RUN ON A PAGE, never seen on a GPU). (a) LOOSE PROPS GO WITH THEIR THING: a `hide` took a group's boxes and left its
  stool standing (the file's `props` are no boxes). `kitViewPlan` now reads the file's props (`levelFileOf(...).props`, index for index the game's) and
  says `hiddenProps`: a prop the `hide` names (its id, or the group it is OF: id = group + a dotted tail), and with no `hide` a prop of a sunk box's group
  within `KIT_PLAN.propNear` 0.8 m of it, less `show`; the child takes them off `game.props` by its own `remove()` in `place()` and again after `mend()`'s
  reset (`dropProps`). No staged way hides a prop (every plan the same but for an empty `hiddenProps`). kitview-plan D: two rows, red under the break.
  (b) A NAME FOR WHAT THE STAND LEFT OUT IS NO PROBLEM: under `?lived=0` a `hide` / `show` of a `lived.*` group was "no box or group by that name".
  `levelFileOf(...).left` = the ids and groups of the boxes and the ids of the props the loader left out (lived off, dressing off); the plan takes a name
  among them as naming nothing. kitview-plan D: one row, a copy of records loaded both ways through `loadLevel`, red under the break.
  (c) THE PLAN'S PANE IS THE GUN ROW'S: unwritten, the plan named the pane nearest any place in whatever wall, and the child's `fireLine` never looked at
  it (the consulate's line said a south-wall pane, the page shot through the west window). `kitViewPlan` now uses the child's filter and order (glass
  within `paneWall` 0.5 m of the anchor's line, `paneAlong` 6 m along it = `KIT_VIEW_LOOP.paneReach`, held equal in A; the nearest along first) and says
  `pane.along`. The child is NOT changed: only what the plan and the static line say. Staged ways: records' two keep their box (now with `along`), every
  other had none and has none. NOT MENDED (it would change staged pictures): the child's reach lets a man walk 4 to 5 m to a pane past the frame's edge
  — a level writes `pane: false` or the box. kitview-plan D: one row, red under the break.
  (d) ONE PLACE WRITTEN ALONE: `slots` is positional and the validator refused a hole; `null` now holds a place left to the plan (validator, `KitViewWay`,
  the planner). No file writes one yet. kitview-plan D: one row through the validator and the plan, red under the break.
  (e) THE STATIC CHECK JUDGES A WAY BY THE CHILD'S PLAN: C's rows took one pass, with every worked-out occluder still on the floor, and failed a way for
  "a place stepped over" on a thing the child sinks before it plans the places (the registry's own door, the scribe's table). `judged()` in
  kitview-plan.ts: the child's two passes; what one pass alone said is printed beside the row, not failed. Every staged way's one pass and child's plan
  were already the same, so no row of theirs moved. D: one row (a crate on a stack place), red under the break.
  (f) READ FROM THE CODE, ANSWERED: THE SIDE — the worked-out side reads free floor and the screen hand, never the hinge or the swing; NOT MENDED and no
  defect at the shipped default: outside doors opening outward SHIPS OFF (`DOORWAY.exitsOut`), the leaf goes in, and the records office's own authored
  pictures stack on the hinge's side. Under `?exitsout` (or an authored `swing` toward the team) a hinge-side stack is behind the open leaf: the level
  writes `side`. THE FOURTH MAN — `rotate()` walks him round Sam's yard side and never across the anchor; the worked-out place is always behind Sam, and
  one WRITTEN nearer the anchor or on the stack's side is now a plan problem (kitview-plan D: one row, red under the break; the child not changed).
  kitview-levels NOW PLAYS A TEAMMATE'S FRAG ROW (`MATE` + `frags`: one row more a level-way, NOT YET RUN); teammate 4 it already played (the last
  teammate's card, his gun's row). (g) `KITLEVELS_BREAK=1` WITH SAM ALONE exited 0 — its shove acted on a teammate and found none: it now shoves Sam a
  metre out from the wall (NOT YET RUN: `KITLEVELS_BREAK=1 KIND=quiet LEVEL=<a quiet level with a block> node tools/qa/kitview-levels.cjs` must exit 1).
  EIGHT FINDINGS OF THE NEXT REVIEW (10-16; `host/kitViewPlan.ts`, three lines of `host/kitView.ts`, the three checks; `src/game` not edited; no switch —
  picture-only, both stands the same; the 19 staged ways' plans the same to the byte, one pass and the child's two. STATIC ONLY: kitview-plan 210 PASS on
  both stands, 73 FAIL under the break; NOTHING BELOW HAS RUN ON A PAGE, never seen on a GPU.) (1) A STEPPED PLACE WRITTEN ALONE CLEARS ITS PROBLEM:
  `stepped` counted the whole worked-out line, places the way had written too, so `slots: [null, null, null, [x, z, yaw]]` could not clear "N places
  stepped over". `kitPlanSlots` returns `steps` per place; the plan sums the places left to the line. D: one row (a crate on the third stack man's place,
  the way holding its `side` and `hide: []`), red under the break. (2) A WRITTEN PANE THE GUN ROW CANNOT SHOOT THROUGH IS A PROBLEM: the plan named any
  box a way wrote as its `pane`; the child puts it through its own tests (within `paneWall` of the anchor's line, `paneReach` along, `paneY`) and shot
  through the doorway when it failed. The plan now says the problem and no pane; D's row asserts it (the wall's own pane written, with a `stand`: taken;
  a pane free in the yard written: a problem). The child reads the plan's `pane.stand` for a WRITTEN pane — a teammate's post, tried after his own place
  and before the row's own; Sam shoots from his place or the doorway — and no level writes a box, so that line has never run. (3) kitview-levels JUDGES
  THE DRESS on a set of a quiet mission (every man in the suit) or the solo night (Sam), off `__charmat`; a loud set, a level's own way, `LOOK=plain`:
  said only. The sling is not read on a page. (4) THE DRESS ROW'S SLING HALF COULD NOT FAIL ON FROZEN (`kitSlingFront` is false with `KITANIM.on` off,
  and `standUp` puts the stand's value back): the row holds `KITANIM.on` / `equip` at each reading and requires 'in front' unsaid; with the sling line
  taken out of the row it is 1 FAIL on FROZEN and on SHIPPED. (5) `dropProps` HAD NO CHECK: kitview-levels reads `plan.hiddenProps` against
  `game.props` as the page comes up, in the first reading after a gun burst's `mend()`, and at the end (every staged way hides none: true of nothing
  there, and the count is printed). (6) THE CHILD READS `KIT_PLAN.paneWall` / `paneY` (it wrote 0.5, 1.5, 1.2 out). KNOWN, NOT MENDED: the child tries a
  pane from the man's own place first and takes the first he has a line to; the plan has no line of fire and passes over a pane with no free place
  before it — with two panes in the wall they can name different ones (written on `KitViewPlanned.pane`); a level that cares writes the box.
  (7) kitview-page's `spread()` threw on a `null` in the file's `slots`: null-safe, and a way with a hole takes its five places off `__kitview.plan`
  (the records office's two ways, written in full, are read as before). (8) A TEAMMATE'S STUN AND FRAG MUST BE THROWN where the plan says the way has
  a throw (a door or a gap, no "for a throw" problem): the row's mark `bang` / `frag`, or `refused` naming the tile; it passed a row that ended `lost`
  with nothing said. `lost` is also the game's own answer when `fragWay` keeps the grenade on the belt or the handle does not turn: on such a way the
  row is now red, and that is its finding (nobody has seen which ways). OWED ON A PAGE: `node tools/qa/kitview-levels.cjs` (all, then
  `KITLEVELS_BREAK=1`, and `KIND=quiet` / `KIND=solo` on a level whose block has a set), `node tools/qa/kitview-page.cjs`.
  FIVE CLAIMS OF THE QUIET LEVELS' PART (10-16; kitView `host/kitView.ts`, `kitViewPlan.ts`, `kitViewSet.ts`, `scene/levelData.ts`, `scenarios.ts`, two lines
  of `main.ts`, two checks; `src/game` not edited; no switch — picture-only, both stands the same; the 19 staged ways' plans the same to the byte. STATIC
  ONLY: kitview-plan 217 PASS on both stands, 79 FAIL under the break; NOTHING BELOW HAS RUN ON A PAGE, never seen on a GPU.) (4) kitView `litInside`: on a
  level's own way the kept light groups are 'exterior' and the plan's `keepLights` (lamps under the open sky), so a roofed room in the wedge behind the
  door is black. A default that kept it lit would move a staged picture (the records front's `duty_lamp`), so it is ONE WRITTEN WORD on the way:
  `litInside: true` adds the groups of the lamps behind the wall's far face that reach the floor a metre in (`kitPlanLitInside`, `KIT_PLAN.litIn / litY /
  litReach`; a spot's cone and a wall between are not asked about). kitview-plan C prints a note where such a lamp goes out. (5) kitView DEVICES ARE INERT:
  a camera over the stack saw a lit Sam and raised the floor (the counting house's front door, headless, the meter held at 0.8: suspicion 4.2 s, alarm
  5.8 s). `kitViewInert(game)` writes the game's own two Sandbox switches, `tune.devices` and `tune.lasers`, off — beside `tune.qrf` in the same spirit —
  with every `park()` (the staging step, before and after every step of the loop): drawn, panning, glowing, reporting nothing. kitview-plan G: the
  fixture's lens found from its data, a control run that reports, the picture's that does not; kitview-levels: a row that no device reported, the floor
  never went up and no alarm was placed (NOT RUN). (6) kitView `hide` BY GENERATED ID: kitview-plan C prints `- WARNING —` where a `hide` / `show` /
  `pane.box` names a `box_NNNN` (the box's place in the file; four ways do today: the records front's car, mousehole's second way) and `note —` where a
  written `hide` takes a box in no line of the camera's, or leaves one standing in it. Never a FAIL. A box's `name` or a `group` of its own is stable
  (`levelLoad.ts`: a named box's id is its name). (8) kitView ON A QUIET MISSION plays the same rows as on a loud one (no row reads the mission's kind): NOT
  CHANGED — a design call; the 40 mm tile (`shells` → `shellRow`: the launcher shouldered down the wall, never fired) is now among the rows
  kitview-levels plays (NOT RUN). (9) kitView `add { boxes, lamps }` ON A LEVEL'S OWN WAY: a piece or a lamp for the picture alone, in level coordinates,
  the level format's records, validated like a set's boxes (look alternatives too), ids new to the level, refused on a set way. `kitPlanAdd` (in
  `kitPlanGeometry`) lays them AFTER the level's boxes for every planner; `kitViewAddLevel` lays them into the data `?kitview` builds (`main.ts
  bootLevel`, both paths) and marks the block `add.laid` — on the LEVEL-FILE path only: the bundled office's Level takes its scenarios from the script
  and carries no such word; the added lamps' groups are kept lit. The mission to play never calls it. SIX FINDINGS ON IT (10-16, review13; all in
  `tools/qa/kitview-plan.ts`, each with a `KITPLAN_BREAK=1` path, 223 PASS on both stands; NOTHING RUN ON A PAGE): (a) TWO WAYS MAY ADD A PIECE UNDER
  THE SAME ID — one way is ever laid: `kitViewAddLevel` takes every other way's `add` off the block it hands on (left on, both ways' levels were
  refused), and the validator judges a way's ids against the level's OWN records. (b) THE CHILD NEVER LAYS (`kitPlanWayBuilt` in `kitView.ts
  planFor`): its records are the built level, so a piece the world lacks (the office's Level; a `lived.*` piece with lived-in rooms off) is not in
  the plan either — a console line says which. THE WAY THE PAGE LAYS IS THE WAY THE MISSION STAGES: `kitViewWayOfLink` (a room clear's `way`
  folded; a rescue, the night breach, a quiet or the solo night: way 0 whatever `way` the link carries) in `bootLevel`, both paths. (c) THE VALIDATOR
  RUNS THE LEVEL'S OWN BOX AND LIGHT RULE on a way's added records (a thin lamp, an unknown flag passed it and died at the picture's boot); the
  bundled office's block goes through the validator in kitview-plan C. (d) AN ADDED PIECE IS SHOWN: never an occluder, never sunk for the camera;
  where it stands between the camera and a MAN the plan says "the added 'x' hides the stack: move it" (the way's `show` with its name = it stays,
  nothing said), on a place the line passed over "the added 'x' stands on the line of places"; an authored `hide` naming it still takes it. (e)
  `kitview-levels.cjs`: the alarm is LATCHED per display frame and judged in every tile's row (a restage cleared the log before the one reading at the
  end); `KIND=solo LEVEL=<x>` keeps the file; the dress row has no level on the default list — its fixture is written by `KITPLAN_FIXTURE=<path> bun
  run tools/qa/kitview-plan.ts` (commands in the .cjs head). NOT RUN. Tried headless on the part's crossing way (a drum and a lamp behind the wall): validates, plans, no
  problem. OWED ON A PAGE: `node tools/qa/kitview-levels.cjs` (all; then `KIND=quiet` on a level with a camera at its way), a way that writes
  `litInside` and one that writes `add`, each looked at.
  SIX CLAIMS OF THE BUILDING DOORS' PART (10-16; kitView `host/kitViewPlan.ts`, three lines of `host/kitView.ts`, one of `main.ts`, `scene/scenarios.ts`,
  `scene/levelData.ts`, the plan check; `src/game` not edited; no switch — picture only, the 19 staged ways' plans the same to the byte. STATIC ONLY:
  kitview-plan 226 PASS on both stands, 88 FAIL under the break; NOTHING BELOW HAS RUN ON A PAGE, never seen on a GPU.) (3) kitView THE PORCH LAMP IS ON
  THE LEVEL'S PHOTOCELL: the picture's lamp and its glowing box hung at every hour (group `kitview` is always kept), so a mission opened by day (the short
  list's `barracks-day`, the one row off night) had a porch lamp lit at noon while the level's own `exterior` lamps were out (`game/hours.ts lampsOut`).
  `kitPlanPorchLit` (pure) + the child's dep `lampsOut()` (main.ts: `hourOf` / `HOURS[h].lamps` — DAYLIGHT is the game's own word for it: midday and
  the grey day; dawn, dusk and night burn): under the open sky the lamp is at the way's `light.porch.day`, not written 0 — no lamp, no box; a way under
  a roof (the plan's `indoors`) burns at every hour. NOT "a written porch key wins": the barracks writes its lamp's intensity and colour for its night,
  and that rule left the reported picture lit. STAGED WAYS: none changes at the hour its mission opens (all night); at a midday or a grey day PICKED on
  the sheet the records office's two ways, mousehole's fire exit and the office lose the lamp and its box (the block is indoors; the ward has
  none; the pass's set has a gate lamp OF ITS OWN, `ps_lamp` with its glowing box, which this rule did not reach — it burned at noon: SEVEN FINDINGS (3) below). (4) kitView A STACK PLACE PAST THE WALL'S END: the line of places runs 0.45 + k × 1.1 m from the jamb whatever the wall's length — a door 2.4 m
  from its wall's corner stood the third man 0.2 m past it and every row passed. Now a plan PROBLEM for a WORKED-OUT stack place (1 ‥ 3; a door or a wall
  anchor) with nothing standing on the anchor's line where he is: "place 3 … is 0.21 m past the end of the wall the stack stands on: write the way's
  `side` … or his place in `slots`". A written place is the author's word; a gap's stack is not asked. NOT TIGHTENED to fit: the gap is the picture's
  own (`KIT_VIEW_STAGE.gap`: at 0.9 two men overlap in the image; the step back and the lane are laid by it, and stack neighbours under 1.09 m are a
  problem already). kitview-plan E's dry run says it of proposed anchors too (never a fail). (6) kitView THE PLAN'S `cam` IS THE PIN, NOT THE PAGE'S
  CAMERA — REAL, NOT MENDED: `kitView.ts aim()` keeps the pin's yaw and pitch, slides the look point and scales the distance to the parent's `frame`
  and the view's aspect, which no plan has. Worked through headless (aim()'s loop copied with the projection written out, three real page sizes, 35
  ways: scratch only, never held against a page): the camera ends 5 to 8 m from the pin's place; the occluder list is the same on 32 ways, and on 3
  the pin names boxes the slid camera's lines do not meet (the office's `box_0713`, six of the warehouse dock's eight), never the reverse — the pin
  over-hides. No staged way's sunk list differs (the office writes its `hide`). What was done: `KitViewPlanned.cam` and kitview-plan C say what it is
  and that nothing may be ray-tested from it. PROPOSED, not built (over 80 lines, and a way with no `hide` would sink by window size): the fit as one
  pure function in `kitViewPlan.ts` that `aim()` and the plan both call (the frame message is a constant of `KIT_VIEW_PLACE` — the iframe is 2.75
  columns wide, so column / frame is the same at every size — and only the aspect varies), the occluder pass under it at a nominal aspect, a page row
  that holds the two cameras equal. (7) kitView `hideMore`: a written `hide` replaces the plan's own list, so one thing more meant copying the list
  out. `hideMore [names]` is ADDED — to what the plan works out where no `hide` is written (`src.hide` stays 'derived'), to the written `hide` where
  one is; a piece of the building named in it is the author's word and no "not a thing to sink" problem; the generated-id WARNING covers it. (1)(2) THE
  SHARED STILL DRIVER (on the mount, `per-level/tools/drive.cjs`; NOT RUN): a lost GPU device or a blank canvas (luminance 0) ends the run with a plain
  line and exit 1, no black still saved — ONE BROWSER AT A TIME ON A MACHINE; a `LEVELS` row's `way: N` clicks the sheet's Way in button from the
  page's own script and holds the iframe's link to `way=N`. OWED ON A PAGE: a mission at `?hour=midday` on a way under the open sky (no lamp, no box,
  no console line) and one that writes `light.porch.day`; `node tools/qa/kitview-levels.cjs` on a way with `hideMore`; the driver once with a `way` row.
  SEVEN FINDINGS OF A REVIEW OF THE ABOVE (10-16; kitView `host/kitViewPlan.ts`, `host/kitView.ts` place(), `scene/scenarios.ts`, `scene/levelData.ts`,
  the plan check, the page check, the driver on the mount; `src/game` not edited; no switch — picture only; the 19 staged ways' plans the same to the
  byte. STATIC ONLY: kitview-plan 234 PASS on both stands, 96 FAIL under the break; NOTHING BELOW HAS RUN ON A PAGE, never seen on a GPU.)
  (3) kitView THE WAY'S OWN LAMPS ARE ON THE PHOTOCELL TOO: a set's own lamp is in the plan's `keepLights` (under the open sky) and the game's photocell
  opens only group `exterior` — the pass picked at Midday or Overcast showed its gate lamp lit and its box glowing. `kitPlanDayOut` (pure): at an hour
  with the outside lamps out, on a way under the open sky, the way's own lamps — its set's `lights`, its `add.lamps` — are out, BY ID (an added lamp may
  share a group with the level's own), at the game's own light switch (`target.on`: lamp and fixture glow together, what the photocell itself opens),
  every restage. The way's new word `dayLights [ids or groups]` keeps the ones it names burning; a name that is no own lamp is a plan problem. No level
  file edited. A LAMP UNDER A COVER (a ceiling or roof box over it: `kitPlanCovered`, the test `keepLights` is measured by) is a room's and burns. (4) kitView A HEADER BEAM IS NO WALL TO STACK ON:
  the past-the-end test took any box thin across the line at any height — a barracks door's third man stood in an open 3 m gateway under its beam. Now
  wall = a box on the line whose underside is below 1.5 m (`KIT_PLAN.wallFoot`; glass counts: a window is a wall by its pane or its sill) or ANOTHER DOOR
  of the level on the line. (5) …and never a box the plan takes out of the picture (`hidden`: `hide`, `hideMore`, the occluders, the child's first
  pass); THE FOURTH MAN'S PLACE IS ASKED TOO where it is worked out ("place 4 … behind Sam"). Over every door of every level, both team sides, both stack
  sides (1396 plans): 975 such problems before (places 1/2/3: 87/352/536), 1363 after (87/359/545 and 372 of place 4): 16 more on the stack places (15
  a header alone, 1 a hidden box), none fewer, no other problem moved; no staged way gained one. (6) kitView ONE NAME IN `show` AND IN `hide` /
  `hideMore` IS A PLAN PROBLEM (its boxes went, its loose props stayed). (7) THE PAGE ROW: `HOUR=midday node tools/qa/kitview-levels.cjs` puts
  `hour=midday` on each link and requires, on a way under the open sky at an hour the page's own table has the lamps out, the porch lamp disabled, its
  box not among the world's statics (`__kitview.fixtureUp`), and the way's own lamps off at the game's switch with dark boxes; any other hour: said,
  nothing judged. It is the row that fails if the child's photocell line is deleted or `main.ts lampsOut` inverted (the plan check holds only the pure
  rule and the switch on a headless game). (1)(2) THE DRIVER (on the mount; NOT RUN): a device lost AFTER the picture is live (the next read of the
  dropped iframe throws) ends with the NO STILL line and exit 1 as a loss before it does; the run exits 1 when ANY level saved no still or did not end
  'done' (it exited 0 on "died", "never live", no row, no button, the wrong way, not started); `way: 1` passes on a link with no `way=` (the sheet
  writes the key from 2 up). OWED ON A PAGE: `HOUR=midday node tools/qa/kitview-levels.cjs` (all, then `HOUR=night` as the control); the pass looked
  at by day; the driver once, and once with a `way: 1` row.
  THE TWO RESCUE LEVELS' PICTURES (10-16; data only: `tools/levels/consulate.ts`, `tools/levels/registry.ts` and their four files). The team starts INSIDE the
  front door on both, so neither way stands on the start. CONSULATE: its own `front` door from the street (`ref [1, 18.75]`), all else measured. REGISTRY: a
  set `front` of its own front (`REGISTRY_KITVIEW`: 34 boxes, one door, one lamp `rg_lamp`, `pane: false`) — the scribe's table and typewriter up the wall past
  the stack, the forms desk and the number post in the lit lobby wedge; no umbrella (the ground the camera sees beside the wall narrows to under a metre past
  the last stack man and the frame cut the canopy); a set with no lamp of its own leaves that wedge black. kitview-plan 241 PASS, `KITPLAN_BREAK=1` exit 1;
  kitview-levels `KIND=rescue` 25 of 25 on each level in both looks (software adapter). `KITLEVELS_BREAK=1` not run on them. NEVER SEEN ON A GPU: the
  registry's lobby lamp (`intensity: 30`) may be bright beside the men, the consulate's lobby wedge reads near black.
  THE BUILDING-DOOR LEVELS (10-16; data only: `tools/levels/{warehouse,barracks,killhouse,defuse,hall}.ts` and their ten files; no switch, no Tab row, no word on
  the screen; both stands the same; the files differ from before in `scenarios.kitView` alone). Warehouse `staff` / `dock_s`, barracks `s_end` / `k_out`,
  killhouse `front` / `back` and the hall's `front` are on their own doors with `roomLights` up and a porch lamp of each level's own colour; where the room
  behind the wall has no lamp of its own lit (the dock, the kill house's passage) the picture's FILL lamp hangs inside it (`light.fill.offset` with a negative
  out). The dock door's three stack places are written (`slots`: its wall is 2.3 m past the jamb, the worked-out file needs 2.65 and put the last man
  past the building's corner; the same file, 0.23 m nearer the door). Defuse is on a set `front` (its own wall line and door as `df_front`: the firing wire, its battery plate, a charge, the bench it was built on, one
  warm bulb). The barracks row opens at MIDDAY (the short list's `barracks-day` sets the hour), so its picture is a daylight one. CHECKS: kitview-plan 176
  PASS on the ten files (0 FAIL over every level, both stands; `KITPLAN_BREAK=1` exit 1); kitview-levels 25 of 25 on each of the 8 ways in both looks (16 runs
  on the software adapter, the teammate's frag row among them: its first runs on a page; `KITLEVELS_BREAK=1` on the hall exit 1). Stills: the software
  adapter's, never seen on a GPU.
  THE QUIET MISSIONS' LEVELS (10-16; data only: `tools/levels/{bazaar,police-post,vault,crossing,quiet-relay,quiet-yard,lights-out}.ts`, the five lessons'
  generators, their twelve files and one new helper; no switch, no Tab row, no word on the screen; both stands the same; the files differ from before in
  `scenarios.kitView` alone). A quiet mission shows `ways[0]` with ITS OWN MEN (Sam alone, or Sam and his partner, in the sneaking suit, on a set too), not
  the standing man; each way writes `ref`, since a quiet mission deals its start. ON A DOOR OF THE LEVEL: bazaar `gate_s`, police-post `gate_n`, the counting
  house (vault) its own `front` door (porch lamp and bike in `hide`, `keepLights ['count']` so the room behind is lit), crossing `gate_s` (pallet and tyres
  in `hide`), quiet-relay `gate_w`, quiet-yard `gate_w` (one block, both yard rows). CROSSING AND QUIET-RELAY ADD PIECES FOR THE PICTURE ONLY (`add`, the
  first on a page): each a work bulb on a pole against the wall behind the gate (point, range 7; crossing 14 past the HESCO column, the relay 13 and 1.5 m up
  the wall from the gate so no line from it to the pair's places passes the gate) and one thing of the level's own, stood over 1 m because the camera sees
  tops there, not floor: the crossing a spare boom laid along the HESCO column, banded red (2 m of arm: at 2.9 its end ran under the cards); the relay
  a spare section of the mast on a block plinth, 3.4 m of its own lattice with two panels, a small dish and the red light (a dish alone, this format's
  square plate, read as a blank white board on the still). Vault and crossing hide by generated box id (their groups hold the whole
  yard): a change of box order in those generators means reading the ids again. ON A SET: lights-out `shed` (door `lo_gate`: a lean-to on the yard wall with
  the generator, the breaker, the fuel, one work bulb). THE SHELL: `tools/levels/train-ground-kitview.ts yardGateShell(prefix)` is the shared walled yard's
  (`train-ground.ts`) west wall, gate and ground as a set's `ref` / `doors` / `boxes`, its numbers COPIED from the yard as exported (a change to the yard is
  made there too); a level spreads it and adds its own pieces. Why a set: from `gate_w` every level on that yard is the same mud wall, and what makes each
  one stands deeper than the two metres behind the wall that the clear column shows. THE FIVE LESSONS (train-move `pool`, train-hands `court`, train-lights
  `power`, train-kit `range`, train-silent `well`) carry a set on that shell AS DATA ONLY: a lesson is played with the kit as issued (`loadout.ts
  kitAsIssued`) and its page has no Team & kit step, so no player sees them; they were staged before that was found. CHECKS: kitview-plan 163 PASS on the
  twelve files on both stands (`KITPLAN_BREAK=1` exit 1); kitview-levels `KIND=quiet` on the real page (software adapter) exit 0 on each of the eight rows,
  19 of 19 for a lone Sam (bazaar, police-post, vault, quiet-yard) and 24 of 24 for a pair (crossing, quiet-relay, lights-out, quiet-yard);
  `KITLEVELS_BREAK=1` on a lone Sam (bazaar) exit 1. For a lone Sam `walls` plays the gun's row (nobody to take it), and `cams` does where there is no wall
  inside to stick one to (police-post, the set). NEVER SEEN ON A GPU; the stills are the software adapter's. CROSSING AND QUIET-RELAY (the `add` step, on build
  78cc3abb): kitview-plan 178 PASS on the twelve files on both stands; crossing's page check 27 of 27 with its pieces; QUIET-RELAY'S IS RED, 24 of 27, WITH AND
  WITHOUT ITS PIECES (run three ways): the charge row and the wall row raise the floor with no device reporting, and the no-alarm row falls with them — the
  picture's own fault at that gate, not these pieces'. The bulbs' numbers were set from two software-adapter stills each (the crossing's at 30 over a HESCO
  cell burned its top white: moved and cut to 14; the relay's cut from 18 to 13); no light can be judged there. A reviewer ranked the first round's stills
  (crossing fine, the relay acceptable for its dish); the second round's, with the mast section and the shorter boom, only their author has looked at. `tools/qa/lived-check.ts` walks an added box whose centre is within 0.3 m
  of the floor as a place a man goes (it exempts `sets`, not `add`): the relay's mast section stands on a taller plinth for that. NOBODY HAS:
  watched a quiet row's tiles play, seen the counting house's picture on a GPU with `cam_yard` live over its door, run the lessons' rows on the page since
  the seam was merged (before it: 19 of 19, train-silent 23 of 23), or played the 40 mm tile (not among the rows the page check plays).
  SIX ITEMS AFTER THE MERGE (10-16; `host/kitView.ts`, `host/kitViewPlan.ts`, `host/kitViewSet.ts`, `scene/levelData.ts`, the three checks; no switch, no
  Tab row, no word on the screen, nothing under `src/game`; both stands the same; every staged way's plan the same to the byte, one pass and the child's
  two. STATIC ONLY: kitview-plan 582 PASS on both stands, 173 FAIL under the break; NOTHING BELOW HAS RUN ON A PAGE, never seen on a GPU.) (1) kitView THE
  LEVEL'S OWN MEN RAISE NO ALARM: on the relay station's quiet row the page check saw the floor go 0 → 1 under Sam's charge and 1 → 2 under the wall
  charge with no device reporting. WHO: `guards.ts updateEscalation`, by the picture's own park. A row's blast is made INSIDE the game's step (the door
  tools' tick; the director's trigger is said after `park()`), so park's "what is in the air is numbered and behind him" came a step late: the five staff
  parked 69 to 77 m from `gate_w` (a charge carries 80; the crossing's gate is out of that reach) heard it in the step that made it, went `alert` with
  a fix, updateEscalation placed the alarm on the fix and opened an episode, park() calmed them, and the next step read the episode as over and raised
  the floor. `park()` is now the exported `kitViewPark(game)`: as before, and each man's `heardUpTo` set to `KIT_VIEW_DEAF` (the guards' and civilians'
  own "heard as far as" mark, past any event's number: deaf UNTIL THE GAME WRITES THAT MARK AGAIN — a man it stands up mid-step is given the count
  as it then is: `qrf.ts`, `guards.ts spawnUnit` — and every park renews it, before and after each step), and — for a man made alert by another
  road — `alarm.episode` / `alarm.placed` dropped, ONLY WHILE THE FLOOR IS AT 0 (a floor already up keeps its marks, and the page checks see it up). Headless over the 18 level-missions with a door anchor, the anchor's charge blown: the old park raised the floor on
  5 (police-post, quiet-relay, quiet-yard alone and as two, vault), the new on 0. kitview-plan G, two rows: the fixture's door nearest the parked
  staff, a control parked as it was that DOES raise it, the picture's that does not; a man put to `alert` by hand. The partner still says "compromised"
  at the blast (the quiet mission's own word, no alarm). OWED ON THE PAGE: `LEVEL=quiet-relay WAY=1 KIND=quiet SQUAD=1 node tools/qa/kitview-levels.cjs`
  (3 FAIL of 27 before). (2) `lived-check` does not walk a way's `add` for floor points (a low added box's centre was "a place a man goes"). (3) kitView
  `add`, three review notes: a FILE that writes `add.laid` is refused (the validator takes the word only from the object `kitViewAddLevel` made:
  `levelData.ts kitAddLaid`, by identity — a copy of the loader's output is refused too); `kitViewPlanWay` hands the caller's `hiddenStand` / `alsoHide`
  on to a way with an `add` (it dropped every option with the level's floor — the `floor` AND a passed `free` are dropped there: below); an added piece is blamed for a stepped place only where the place is free
  without it. (4) kitview-page's ROW THAT FAILED ONCE IN FIVE ("the breaching shotgun in member 2's big slot … a new beat frame 1: weapon by member 2 ·
  0 cut") WAS THE CHECK'S RACE, the one kitview-levels had: `__kvPick` read the beat count and told the pick in one task, from 'rest'; the loop's own
  next turn of the tile under the highlight (his gun) began on a display frame before the page heard the message. The director can turn a big-slot pick
  into the gun's row only through a refusal, which writes `refused`, and from `settled` nothing in the row's start refuses. `__kvTold` (one helper, its
  listener after the director's): a pick's row counts from the HEARING; the turn begun in between is `stray`, printed, and held to a cut with no mark.
  (5) kitView `__kitview.held { n, field, why[], s, frames }`: THE DIRECTOR'S OWN WORD FOR A PICK IT KEPT BACK ('mend', 'arrive', 'home', 'sam', 'leaf'),
  said in `direct()` where it turns back. kitview-levels allowed the picture's wait from a reading taken BEFORE the pick, which knew Sam's half step and
  the leaf only: Sam's wand, picked with the stack still stood off his charge, waits for the men to walk home (`homing()`) — "up 17 frames, 284 ms" on
  a bound of 4, at 60 Hz frames: the director's wait, not the machine's. The tool now reads `held` for the very beat. (6) kitView A WRITTEN STACK PLACE
  AND THE DOOR: places 1 to 3 written INSIDE THE OPENING (past the jamb the wrong way) or INSIDE THE LEAF'S SWING (`KIT_PLAN.leafStop`) are plan
  problems; of the 18 written stack places in the tree none gains one. NOT ASKED: "nearer the jamb than a body" (`KIT_PLAN.man` 0.3) — the warehouse
  dock door's written place 1 stands 0.22 m past its jamb, in both looks, and would gain a problem.
  **THE REVIEW OF THOSE SIX, 10-16** (seven fixes; STATIC ONLY: kitview-plan 584 PASS on both stands, 175 FAIL under the break, the staged plans'
  dump the same; NOTHING HERE HAS RUN ON A PAGE). (a) `__kitview.held` IS NOW `{ n, field, i, why[], by{rule: frames}, s, frames }` AND MUST ACCOUNT
  FOR THE DELAY: as first written, one held frame bought a row kitview-levels' whole 3 s `WAIT_MS`, `mend` was an excuse every pick after a row that
  broke something met (`dirty` outlives the rest), a frame the director did not run on (a dissolve still asked for) was in no count, and a word left
  by a pick that never began excused the next pick's row. The director: `heard()` (every place a pick is taken) starts the pick's clock and DROPS a
  pending word; `i` is the open card's member; `by` counts the frames each rule held; a frame under a dissolve asked for between two frames holds
  under 'mend'; `s` runs from the hearing to the row's begin. kitview-levels (`heldJudge`): the word is the begun beat's (number, member, thing — or
  the gun's row `refused` names it for); the frames the page WORKED (`drawn` moved) less the frames a rule held are FRAMES at most; every rule is in
  its table `HELD` with its bound — `mend`: FRAMES of it, and a row held by mend alone begins within FRAMES display frames as kitview-page asks of a
  restage; `home` / `sam` / `leaf` / `arrive`: `WAIT_MS` from the pick; display frames passed over whole are held to the page's own pace
  (`pace.every`). (b) THE PARK SAYS WHAT IT PUT RIGHT: `kitViewPark` returns `{ men, alarms }` — the level's men it found `suspicious` / `alert` /
  `search`, the marks it dropped — and the child adds them on `__kitview.roused` for every park but a staging's own, never reset (the park calms the
  men and drops the marks before any page reader runs: the checks' "an alarm placed" and "N alert" could no longer be true of what it mended).
  kitview-levels' alarm limb of every tile row and its whole-run row, kitview-page's `sound()` and a whole-run row there, go red when it rises or is
  not said; kitview-plan G holds it to 0 under the charge and to 1 man, 2 marks for the man set alert by hand. Headless over 31 mission links (way
  1, the anchor's charge on the door ways, 6 s): 0 counted — NOBODY HAS SEEN the count on a page, where sight is the GPU meter's and the squad
  fires. (c) A written place and the leaf: the stop asked is THE ONE ON THE TEAM'S SIDE (`maxAngle` on the positive side of doors.ts's `into = n0 ×
  swing`, minus `minAngle` on the other; it was the wider of the two — a door that cannot open toward the team, or stops at a right angle there,
  said "inside the leaf's swing"); a place further the wrong way than the anchor is wide is said PAST THE FAR JAMB, not "inside the opening".
  (d) `kitViewPlanWay` drops a passed `free` with the `floor` under an `add` it lays (as on a set): `free` answers before the floor, and one made on
  the bare level stood a man in the added crate with nothing stepped over. The child does not come that way. (e) kitview-page: the two rows that
  tell their own pick (a door charge with the leaf open, a door order while Sam is walked home) keep the loop's stray turn (`__kvStrayOf`) and hold
  it through `strayHeld` like every pick; `__kvTold` numbers the message it posts (`kvn`: the director reads only the keys it knows) and hears that
  one, where any `kit` message matched — kitview-levels' `__kvRow` too. ROWS WHOSE MEANING MOVED (to run again): kitview-levels every timed tile
  row and both alarm rows; kitview-page every row through `sound()`, the two inline rows, the new whole-run park row.
  THE GLASSHOUSE, THE OFFICE AND THE BLOCK'S SQUAD ROWS (10-16; data only: `tools/levels/glasshouse.ts`, `tools/levels/blocksquads.ts`, their three
  files and `levels/office.scenarios.ts`; no switch, no Tab row, no word on the screen; both stands the same). GLASSHOUSE: way 1 a `span` of the blank
  end wall (the wall the mission breaches; a teammate's rows that need a leaf play the gun's row there), way 2 door `back` with `keepLights ['store']`.
  THE OFFICE (five rows, one way): INDOORS, door `server` from the corridor (shut as authored: `breakroom_w`, `manager` and `conference` stand open as
  authored, and a leaf that stands open cannot be an anchor), the corridor's partition written out by generated id (`box_0120`, `box_0121`, `box_0380`,
  `box_0390`: a change of box order in `src/scene/officeGen.ts` means reading them again; kitview-plan WARNS of such ids), `roomLights 1`, the third
  man's place written (the worked-out one stood on `laser_corridor`). BLOCK SQUADS: way 1 is `block.ts`'s kitchen door; way 2 is `crib_to_loading`
  from the loading hall with the picture's own lamp and fill kept (that hall's panels are off: indoors is not lit), the south wall, the crib's
  pegboard, `lived.street` and `lived.staging` hidden; the thirteen boxes hidden by id are FOUND at export by place with their count checked
  (`cribWayOut`), never typed. The part's page checks: 31/28 (glasshouse), 28/28 (block squads), 83 of 84 and 28 of 28 alone (office); the office's
  solo night was 20 of 22 on its tree — the parked men heard the `server` door's charge — which is THE LEVEL'S OWN MEN RAISE NO ALARM above (parked
  men deaf, not parked further: any one spot is in earshot of some door). TAKEN, NOT BUILT: a door authored open as an anchor; lamps off by default
  from `plan.indoors`; a hidden wall's look paint staying up; a worked-out place on a laser tripwire. Never seen on a GPU.
  A PAGE OPENED FROM DISK (10-16; `host/kitView.ts kitViewOnDisk` / `kitViewPostTo` / `kitViewFrom`, their three lines again in `ui/kitView.ts`; no
  switch): the picture and its page post to each other by `location.origin`. On a `file:` address Chromium reads that as 'file://', drops a message
  posted to it (a console warning, no throw), and gives a message that does arrive the origin 'null' — so nothing was said either way and the
  picture was dropped after its full wait. On such a page the target is now anywhere and a listener takes the origin 'null'; each listener still
  holds a message to the very window it must come from (`e.source`). A served page is as it was (records 56 of 56, kitview-page's outer half 33 of
  33, the relay's quiet row as two 27 of 27 with the first form of this). MEASURED on the one-file build opened from disk, no WebGPU adapter, two
  runs each: before, the page heard nothing and took the frame down at 10.07 s; now it hears the picture's `none` at 0.75 s and the picture hears
  its two `frame` messages. NOT SEEN: the picture itself up on a page from disk (the software adapter had not booted it in 150 s; no GPU here),
  any browser but Chromium (the first form tested only the word 'null', which Chromium never gives: it changed nothing there). THE CHECK:
  `bun run build:one && node tools/qa/kitview-disk.cjs` (the built file opened from disk, no adapter, no server: 6 of 6, two runs; `KITDISK_BREAK=1`
  = a target of '*' put back to `location.origin`, must exit 1: 4 FAIL, the frame down at 10.08 s).
  THE QUIET PICTURE (10-17; `host/kitView.ts KIT_VIEW_QUIET`, ON in the page; `?kitloud` = off, forwarded to the picture by `ui/kitView.ts`,
  whose own `KIT_VIEW.quiet` the same word puts off: the picture and its fade exactly as they were, on every kind. A host table like its
  neighbours: nothing in the game reads it, so it has no row in the knob registry or the frozen holds). The maintainer: "quiet missions
  should have different gear screen stuff". On a QUIET KIND — a quiet mission's link, alone or as two, and the solo night, read off the
  LINK (`host/kitViewSet.ts kitViewQuietKind`, the reading the set's dress always used; never `game.quiet.active`: a set way is staged as
  a room clear) — and only where the porch lamp burns (by day, with no `light.porch.day`, the old picture), the picture is ONE image: Sam
  DOWN, his gun put away and the rifle across his back (`KITANIM.sling` 2 on every quiet way now), 1.1 m along the wall from the door's
  middle, beside a small warm POOL under the door's lamp (the porch place, a spot of 24 deg at 16 turned down and tipped 0.25 m out —
  `outerDeg` is a HALF angle: 1.07 m of floor in radius under a 2.4 m lamp, a 0.2 m rim; a way's own `light.porch` keys still lie over
  it); the level's own lamps on the team's side that reach the door's foot are out; the moon x0.5 and BLUE (`moonTint` [0.4, 0.62, 1]
  over its own colour: the moon is the floor's light), the fill bluer and low (0.8: it lights the wall's face and the men, next to
  nothing of the floor), the sky x1.2; no weapon light; the leaf 16 deg ajar on a room whose own lamps burn at 0.15 of themselves, and
  at every door a small warm lamp of the picture's own low behind the gap (`own`: 0.4 m back, 0.25 m past the frame on the LATCH's side, 1.2 m up, 2.5 — the leaf stands ajar INTO the room and its gap is
  seen only from there): a blade of light out across his floor, slanting toward the hinge's side through where the pool is.
  THE ROOF STAYS ON (`roofs`; `kitViewQuietRoofs`, pure): where the team stands under the sky, the cover slabs the game's camera looks
  through (`NoPrimary`) that lie wholly behind the wall are DRAWN (the flag cleared for the picture's life, put back by `quietUndo`),
  so the room behind the door is a dark slab and not the largest warm shape in the column; a throw through the door lands unseen.
  THE FRAMING (`frame`): one subject — the lamp's fixture at 0.30 of the clear column's height, his boots at 0.67, his spine 0.55 of
  the way across; the distance follows (the page tells the picture the column's `top` / `bottom` in its `frame` message; the picture's
  page alone takes its whole window as the column). A partner rests on a knee 1.0 m behind him and stands at the door
  while his own card is open. A level's WRITTEN first place wins; a worked-out one that is not free floor leaves the plan's.
  THE POOL LAMP IS A LAMP OF THE GAME'S: the host builds a `LightTarget` over the picture's own light and glowing box and pushes it on
  `game.targets` (`kitViewPoolTarget`; nothing under `src/game` was edited), so the player's round puts it out by the game's own
  `shootOut` and a restart's `repairLights` mends it. WHAT PLAYS, by `QUIET_BEATS` (a table over `BEATS`: a thing not in it, or a quiet
  row whose start refuses, plays its old row): Sam's `weapon` with a SUPPRESSED gun in hand — the gun out, a rise to a half crouch on
  the lamp (0.65 s), ONE round, the pool dies — A CUT (`cut`): the next frame takes no history, the gun's gas is taken out of the smoke
  solver (unlit it drew as soot on the door) and the dead lamp's lead does not arc for this row (`FIXLOOK.on` held off: the fixture's
  own burst is the only sparks, gone in half a second), with a cold flick at the muzzle as the round goes (`flick`) —, the moon lifts
  x1.7 and the fill x1.3 over 1.2 s (the floor comes up blue), he walks down ACROSS the doorway, through where the pool was, to the FAR jamb (`jambFar`; 0.2 m
  past the frame, 0.6 m off the wall; no free floor there: the jamb on his own side), the dark held 4 s from the round, then the room staged again under the dissolve and a 3.5 s rest; `suit` / `trim` — a lean of 0.4 m
  into the pool, held 0.6 s, and back; the throws from the crouch with a 1.1 m step; the wand and the sticky camera their own rows, he
  stays down. No tile under the highlight: the rest pose alone (`quietIdle`, the seam a torch pass hangs on).
  LOUD KIT ON A QUIET KIND SHOWS ITS COST (`KIT_VIEW_QUIET.cost`; under the picture's own switch: `KIT_VIEW_QUIET.on`, `?kitloud` off,
  nothing on a loud mission). A row that is loud by nature (`Row.loud`: the frag, the stun, the door charge, the wall charge, the big
  slot's tools, a gun's burst) and that WENT OFF (`kitViewCostly`, pure: its bang's mark; a gun's row by a round fired from a gun
  whose `def.suppressed` is false, Sam's or a teammate's; never a pick's cut, a thing kept on the belt, the wall charge that only
  opens a wall for another row) plays as on every kind, and as it ends: the room behind the door at full behind the leaf still ajar,
  the blade's own lamp at twice itself through the gap (`quietInside(1, cost.blade)`); Sam starts up out of the crouch at once;
  `slit` 0.4 s later the leaf is thrown to 100 deg by the game's own silent `crack` and the blade's lamp AND THE POOL LAMP are out (`cost.pool` 0:
  its base, which the game multiplies each step — no round, no event, back as the cost ends), so that ONE lamp of the picture's own
  lights the yard (`kitViewCostLamp`: a point, radius 0.01, at 64, 1.9 m up, behind the wall, slid along it away from him; where
  the leaf's hinge is on the far jamb it stays inside the doorway, 8 cm off that jamb, in the leaf's own sweep, where the walker's
  grid is not asked). IT IS A WEDGE WITH THE DOORWAY'S SHAPE, NOT A SLAB (the second art review, 10-17: the slab read "the lights
  came on", not "caught"). `past` 0.25 (was 0.75) lets the lamp hang 0.35 m behind the wall (was 0.15): the fan between the jambs
  runs from 8 deg past straight out on the door's far side to 53 deg toward him (60 wide; the slab was 75) and its edge falls 1.35 m
  along the wall at his distance from it, a quarter metre past where he rests at 1.1 — he stands just inside it, and the floor along
  the wall behind him and on the door's far side stays dark. THE FAN'S WIDTH IS SET BY HIM: he rests a body's width off the wall, so
  a lamp 1.0 m back, which throws a narrower and more door-like fan (32 deg), puts its edge 0.84 m along and MISSES him (one still).
  `cost.room` (1) is the share the room's own lamps burn at once the leaf is thrown: under the roof that stays on they add nothing
  to the yard's floor (stills at 1 and at 0.15: the same), the seam is there for a way where they would flood it. HE IS FROZEN
  (`tidy`: under a cost Game.puppet has no goal and its aim is the door's middle, `cost.aimY` 1.2 m up): no walk home under the
  hold, his feet where the row left them (`__kitview.cost.last.moved`), and ALL of him comes round to the door at `cost.turn` 240
  deg/s: a throw leaves his gun on the door and his feet 50 deg off it, the game turns only the chest to an aim that near, and he
  stood twisted — a stride's pose in a still — so `yaws()` asks his body's own channel for the door too (89 to 139 deg in under
  half a second, by the page's log). Held
  1.5 s, then the lamp out, the room dim, and the room staged again under the dissolve (every man ON his place, the leaf ajar, the
  pool lamp burning, he down); the loop rests 3 s. About 2.1 s from the row's end. A pick ends it at once, the same way.
  `__kitview.settled` is false while it is up; `__kitview.cost` says what played. NO man of the level's stands in the wedge on any
  way (not built); nobody is roused. THE BLADE (`KIT_VIEW_QUIET.own`): the lamp behind the leaf ajar is nearly a
  point (radius 0.02: at 0.1, behind a slot three fingers wide, the whole blade was the lamp's own half shadow, and at 2.5 it was a
  tenth over the floor), at 8 (the second art review: at 22 it was a third of the pool, a half metre ribbon that made the pool a
  comet and pulled the eye off the man; at 8 it is a tenth of the pool, a faint band beside one clean disc, and the cost's slit
  still flares over it at twice that), 1.9 m up under the lintel, 0.4 m behind the wall and 0.1 m past the latch's jamb. `kitViewBladeLine`
  (pure) works out the fan that gets out between the leaf's free edge and the jamb, in degrees off the door's own line: the leaf
  stands ajar INTO the room, so the blade can lie straight out or toward the HINGE's side and never the other way; at rest 14 to 25
  deg. LIFE AT REST (`KIT_VIEW_QUIET.idle`) IS SWITCHED OFF (`idle.on` false; `kitViewIdleOn`, pure; no beat ever begins, on any way,
  on the page or off it) by the second art review: as built it swings AWAY from the man, its pivot is hidden in the pool so that the
  pool seems to wag a tail, and on the Team & kit page both ends of the swing fall outside the clear column. The code, its pure
  functions and their rows stay, and a check raises it for itself (`__kitview.idleOn = true`; null = the table's word). What it
  does when raised: after 15, 14, 16, 14.5, 15.5 s of rest in turn (a fixed list, the game's clock, no dice)
  the lamp behind the door slides 0.5 m along the wall over 1.2 s, stays 0.6 s and slides back (`kitViewIdleAt`, pure), dark to a
  tenth for 0.4 s on the way out; for those 3 s nobody's idle sway moves (`scan()` held as it stands, Sam and a partner). WHICH WAY:
  further past the LATCH (at a gap with no leaf: away from Sam), so the blade swings from its line out across the yard round toward
  the wall on the hinge's side (56 to 66 deg) and back. As first built it slid away from Sam, which on a leaf hinged on the far jamb
  is BEHIND the leaf: the blade only went out. On the vault and the crossing Sam rests on the latch's side, so the blade swings AWAY
  from him: "toward his boots" cannot be had at such a door. It never begins under a row, a pick, a cost, a dissolve, or with a
  highlighted tile's next turn due inside its length; a row begun under it ends it that frame (the lamp put back at once). Not at a
  blank wall. `__kitview.life`; `__kitview.idleEvery` is a check's own short wait, `__kitview.idleOn` its own raise. SAM'S LIGHT TILE on a quiet kind
  (`KIT_VIEW_QUIET.light`, `quietLight`): from the crouch the gun comes out, the beam is on as his aim leaves the door's far jamb,
  crosses to the near one in 0.5 s, held 0.2 s, off; the gun goes away at rest. Mark 'beam'. No step, no hand on the leaf, no cost. A
  teammate's light, a blank wall: the old row. `Row.loud` and `quietInside(share, blade)` (the room's lamps, 0.15 at rest) are the
  seams.
  THE PAGE: on a quiet kind the picture's fade under the tile
  panel runs from the column's edge to NOTHING at 40% of the picture's own window, or at the first tile's left edge where that is
  further (`KIT_VIEW_PLACE.quietEnd`; before, and still on a loud kind: three tenths at the first tile's left edge, gone one column's
  width past the column) and the pool of picture under the last tile row is not laid: a dark stage showed through the gaps as noise.
  THREE THINGS THE PARTNER'S ROWS NEEDED: a door order waits for the pulled-to leaf to LATCH (`leafWait`), and under a teammate's row Sam
  is left up to 0.25 m more off his place (`tidy`) — he rests a body's width from where the game stacks a man on the door, the partner
  shouldered him 4 cm over the line, and the walk home that gave him is `Game.puppet`, which took the partner's frag order away;
  and HE GIVES WAY FIRST (`KIT_VIEW_QUIET.stepBack` 0.5): since the re-shoot Sam rests where the game stacks a man who works the door,
  and a partner at the door shouldered him up to 0.45 m. With a partner's card the open one Sam's place IS a step back along the wall
  (1.6 m from the door's middle: `kitViewQuietPlaces().back`, `Staged.samRest` / `samBack`, set by the open card in `tidy`); he walks
  there as the card opens, a row of the partner's waits for it as for any half step of his (`waits`, 'sam'), and he comes forward with
  his own card. The page check's allowance for a shouldered Sam is out again.
  THE CHECKS: `bun run tools/qa/kitview-plan.ts` section I, both stands, 667 of 667 (the kind off 144 links, `kitloud` and the table off
  null on every one; each of the 12 quiet ways' pool lamp and rest place; headless, the lamp hung as the page hangs it is put out by one
  round from the rest place, the park's count 0, the floor at 0, and `repairLights` mends it; the roof slabs drawn lie wholly behind the wall and over no man's place, and the vault's hut keeps its
  roof); `KITQUIET_BREAK=1` = the link read with `kitloud`, the round aimed beside the lamp, the roofs asked with the key off: 16 FAIL,
  exit 1. The page, software adapter, the render stood in:
  `LEVEL=vault KIND=quiet node tools/qa/kitview-levels.cjs` 24 of 24 (one round, 'shot' 'dark' 'walk', one restart, roused 0, console
  clean), the same with `FLAGS=kitloud` 23 of 23 (the old rows, the page says nothing of it), `LEVEL=crossing KIND=quiet SQUAD=1` 29 of
  29 (28 of 28 with `FLAGS=kitloud`), `LEVEL=records WAY=1` 29 of 29 (its 28 and the new row: a loud link says nothing of it). Rows whose meaning moved on a quiet kind are listed at the head of kitview-levels.cjs
  (the places are the staged ones; the leaf hung is the leaf at its rest; the gun's row ends in a restage).
  THE JOIN (10-17, the look with the cost, the beat and the blade): `tools/qa/kitview-plan.ts` 749 of 749 on both stands — section I
  also holds Sam's step back on every quiet way (free floor, no nearer the door than his old 1.55 m, short of the partner's own
  place); section J which endings cost (11 cases) and none where the picture is not staged quiet, the cost's and the beat's timelines,
  on every quiet way the cost's lamp behind the wall on free floor or in the doorway's own sweep, the blade's fan at rest and at the
  slide's end (it still gets out, swung 25 deg or more), and headless the leaf thrown wide by the game's own hand with nobody roused
  and hung again by the restart. `KITQUIET_BREAK=1` (also: the step back read as no step) 29 FAIL, `KITCOST_BREAK=1` (the suppressor
  read the wrong way round, the leaf thrown at no speed, the idle lamp slid behind the leaf) 27 FAIL, exit 1 each. The page, software
  adapter, the render stood in: `LEVEL=vault KIND=quiet` 28 of 28 (costs after Sam's stun, frag and door charge, each 2.1 s, the leaf
  108 to 110 deg, one restart each; the light one blink; a beat at rest cut by a pick), `LEVEL=crossing KIND=quiet SQUAD=1` 33 of 33
  (the partner's charge: the furthest man 0.00 m off his place, where Sam was shouldered 0.45 m), `LEVEL=records WAY=1` 30 of 30 and
  the vault with `FLAGS=kitloud` 24 of 24 (no cost, no beat), `LEVEL=office KIND=solo` 28 of 28, `LEVEL=kv-quiet-set KIND=quiet` 29 of 29 (the fixture the plan check writes, never committed).
  MEASURED ON STILLS (the vault, 7 x 7 px means as above, RELATIVE only): at rest the pool 12 to 18, the floor 0.25, the BLADE where
  it leaves the pool 4.0 to 4.4 and 2.5 out in the moon's shadow — a warm line from the door's foot across the yard, the second
  brightest thing on the floor; at the slide's end the blade lies from the pool's rim up along the wall on the hinge's side, 4.5 to
  5.8 beside the pool and 1.3 to 1.5 further along (0.3 there at rest): two stills, the swing between them never seen in motion. UNDER
  THE COST (Sam's frag, about half a second after the leaf is thrown): the slab's core in front of the door 20 to 28 (the pool at rest
  12 to 18, and lost in it), 8 to 16 two metres out, 3 to 7 at three metres and beyond, the dark floor beside it 0.3; its far edge a
  straight line out from the hinge's jamb; Sam up in it, 2.5 at the chest against 0.1 at rest, his shadow thrown long across the yard
  to the frame's foot. The slab is the brightest thing on the floor. NOBODY HAS SEEN any of it on a GPU or in motion at speed: the
  swing of the blade and the throw of the leaf are two stills each; a better preset's bounce will soften the slab's edges and lift the
  floor round it. WEAK: the blade is a ribbon about half a metre wide at the frame's edge, not a hairline (its edges are soft on this
  adapter); under the cost Sam is lit from behind, a rim and a long shadow, not a bright figure (his suit is dark and the lamp is
  behind the wall); on the whole page the column goes warm from the door's foot past his boots with him up and lit in it, but at that size the slab's edges are soft (one still, its cost begun at rest by hand, not by a tile).
  THE SECOND ART REVIEW'S THREE CORRECTIONS (10-17; all under the picture's own switch, nothing on a loud kind): the blade at rest at
  8, the idle beat off, the cost a wedge from one lamp with the pool out and him frozen in it — each told in its place above; where the join's
  measures just above say otherwise (the slab, the pool lit inside it, the blade at 4, a beat at rest), these are the newer.
  CHECKS: `tools/qa/kitview-plan.ts` 763 of 763 on both stands. Section J also holds that the beat's switch is off and that it
  plays only raised; that once the leaf is thrown the pool lamp is at 0; and on each of the 13 quiet ways that the cost's fan is
  no wider than 66 deg, its far edge within 12 deg of straight out and its near edge 0.2 to 0.6 m past his middle (47 to 64 deg
  wide, 0.25 m past him on every one). `KITQUIET_BREAK=1` 29 FAIL, `KITCOST_BREAK=1` (also: the lamp hung as the old slab's, the
  beat read as raised) 41 FAIL, exit 1 each. The page, software adapter, the render stood in: `LEVEL=vault KIND=quiet` 29 of 29 — a
  row more: held 8 s at rest with a 1 s wait asked for, no beat begins and none began over the run; only then is the beat's own
  row run, the switch raised by the check; and under every cost his feet moved 0.00 m (0.15 allowed) with the pool lamp out —
  `LEVEL=crossing KIND=quiet SQUAD=1` 34 of 34 (seven costs, Sam's and the partner's), `LEVEL=records WAY=1` 30 of 30 and the vault
  with `FLAGS=kitloud` 24 of 24 (both unmoved: no cost, no beat).
  MEASURED ON STILLS (the vault, the same adapter, preset and 7 x 7 px means: RELATIVE only). AT REST: the pool 12 to 14, the band
  beside it 1.5 (it was 4.0 to 4.4), the floor 0.1 to 0.3 — one clean disc and a faint band half a metre wide, not a hairline.
  UNDER THE COST, Sam's real frag, half a second after the leaf is thrown: the wedge's core in front of the door 15 to 24 (12 at the
  door's foot, where the frag's own smoke stands), 9 to 15 two metres out, 3 to 9 at three metres, the dark floor beside it 0.3;
  0.62 of the yard's floor in view is dark (0.54 under the old slab); the floor at his boots 14, the man himself 2 — a
  silhouette: the camera sees his back and the lamp is beyond him. He stands square to the door with his feet together, and his
  shadow is one, long, with clean edges: his legs and, a finger beside them, his near arm. The edge on his side is hard; the far
  edge is hazy with the frag's smoke (hard with no frag). ON THE WHOLE PAGE (the cost begun at rest by hand, the lamp then at
  48): a warm band across the column from the door's foot to his boots, 17 to 22, dark floor above it 0.4 and behind him along the
  wall 0.2, the man 1.5 to 3 standing in it; its edges are crumbly at that size on this preset.
  THE MAT'S BLOTCHES ARE NOT MARKS: the frag leaves 8 decals and the restage takes all 8 (0 at rest, 8 under the cost, 0 after), and
  the mat at rest and after the restage is clean at six times the exposure. The dark blotches show only under the cost's lamp,
  with a frag or with none, and drift and fade from one frame to the next: this preset's sampling of the one low lamp, with the
  frag's smoke adding its own. Left as it is.
  NOBODY HAS SEEN any of this on a GPU, or in motion: the turn to the door and the rise are read off the page's own log (his body
  89 to 139 deg in under half a second) and one still. WEAK: the wedge is 60 deg wide, a broad door shape and not a narrow one,
  because he must stand in it where he rests; he is a dark figure in the light, not a lit one; the band at rest is still half a
  metre wide; no still of the cost at the crossing or as two.
  LOUD UNMOVED: every change
  is behind the link's kind; the plan check's sections A to H print the same lines as before on both stands and its dry-run file is
  byte-identical. NOT SEEN: anything on a GPU; the loop at speed (stills on the software adapter only: the pool reads soft and wide
  there and the half crouch is hard to tell from the crouch). THE RE-SHOOT (10-17, the same adapter and preset; 7 x 7 px means,
  sRGB^2.2 x 100, after the tonemap: RELATIVE only), the vault's rest picture before / after: the pool's core 8.5 / 11.3, the yard's
  floor 2.2 brown / 0.25 blue, the floor in the moon's shadow 0.04 / 0.01, the room behind the wall 6.2 / a roof at 0.7, the wall's
  top 15.7 / 5.8, the door's leaf 15.3 / 3.8, the man 1.0 / 0.2: the pool is the brightest thing but its own fixture. WHAT STOPS
  10 : 1 : 0.5: the vault's pale wall takes about twenty times what its dirt floor does of the same moon, so a floor at a tenth of the
  pool puts the wall over it; the fill, low and far out, does not reach the floor, so the moon's shadow is black. One test with the moon
  off showed the room lit by its OWN lamp at 0.15, not by the sky. The page: the fixture at 0.30 of the column, the pool's middle 0.55,
  his head 0.59, his boots 0.67. NOT READING YET (the blade and the partner's shoulder were here: see THE JOIN above): after the round he is a dark shape on a dark floor and his own shadow lies on the wall
  behind him; the vault's dark mat cuts a straight edge through the pool; where no roof lies over the room (the crossing's compound)
  the lamp behind the door shows it dim and warm; no cone in the air (the lowest preset drew none at `volumetric` 0.2: the key is not
  set). Never seen: any of it on a GPU or at speed; the walk across the doorway in motion; the solo night's picture (the same framing, under a roof: no slab drawn); any quiet way but the vault's and the crossing's on a page.
- **The start page** (`src/ui/menu.ts`; under `?cards`) opens on the SHORT LIST (no heading over it since 10-11; `src/scene/picks.ts PICKS` + `src/ui/picks.ts`: compound, registry, warehouse, depot,
  barracks-day, night-breach, solo — a row is a link that deploys straight in; `?nopicks` = the old card, `?pick=<id>`). **Missions** opens the mission list
  (`src/ui/missions.ts`: the solo night + one row per `SCENARIOS` entry, Hour / Weather rows on its sheet), a pick opens the **Loadout** screen (`src/ui/loadout.ts` +
  `src/ui/kitCard.ts`: how many come, each man's kit card, the Squad kit row; `?loadout=<mission id>`), and Deploy is a PAGE LOAD of the mission's URL.

<!-- was CLAUDE.md lines 759–770 -->
- **The debrief = the chronicle** (`src/game/chronicle.ts`, `Game.chronicle`, replaced by `restartEncounter`): a capped timeline `events[]` of `{ t (mission
  clock), kind, room, pos, data }` — kinds `objective spotted contact heard lost calm alarm radio shot lightShot ocp blackout thrown grab interrogated keyTaken ko kill
  bodyFound doorKicked lockPicked hit down checkpoint` — Sam's PATH sampled every 0.5 s (flat Float32Array, thins itself at PATH_CAP), and the counters MissionStats
  lacks (`counts`). Written by ONE-LINE hooks at the true sites (guards.ts hearingCheck ×5 / the alert transition / dropToSearch / the search's end / raiseEscalation +
  stepDown / say(radio) / both body-found sites; combat.ts fireWeapon ×3 + killGuard; lighting.ts setBlackout + ocp ×2; player.ts takeKey / kick impact / pick done /
  throw release / startGrab; game.ts interrogate; mission.ts spotted / objectives / `tickChronicle`) through the SAME gate as the tallies (`missionLive`: nothing under
  the tour / puppet, nothing once done or failed). New verbs: call `chronicle(g, kind, data, pos?)` or add a `chronX` helper there; G5's seam is `chronCheckpoint(g,
  'save'|'load', label)`. `roomOf(pos)` = the ROOMS table (nominal partition lines; replace with the level format's rooms block when G1 lands). Reading: `debriefOf(g)`
  → counts + `stealthScore` (100 minus SCORE's price list — every term only subtracts; probes hold monotonicity) + `ratingOf` (BANDS: GHOST ≥ 90 · SHADOW ≥ 70 ·
  OPERATIVE ≥ 40 · ASSAULT) + `badgesOf` (BADGE knobs) + the summary line; `fmtEvent` words a row. The card is `ui/debrief.ts renderDebrief(host, game, actions)`
  (menu.ts: mode 'debrief' on `mission.debrief` — raised on exfil AND `DOWN_CARD_SECS` after Sam drops — plus the pause card's *Run so far* tab; CSS `#menu .db-*`);
  the map is a canvas at nav-grid resolution + percent-placed DOM pins (PIN table). QA: `probes.ts debrief` (run / rooms / doorname / charge / loud / score / dom), soak's 'leak chronicle' invariant.

<!-- was CLAUDE.md lines 1735–1757 -->
- **The start card's sandbox row** (ui/menu.ts `sandboxRow`, `SANDBOX_LS` = localStorage `twopointsix.sandbox`, applied by main.ts `loadSandbox` at boot): god mode ·
  no AI · unlimited ammo — the same `Game.godMode / aiEnabled / infiniteAmmo` the pause card and Tab ▸ Sandbox flip; unlimited ammo covers magazines, canisters AND ring airfoils.
- **The tweak panel = the debugger (ui/panel.ts + bindings.ts), on BACKTICK since 10-10 (Tab is left to the game; no key steps the debug views: they are the 'debug view' row on its Frame page)**:
  a two-level tool since 08-12 — SYSTEMS down a left rail (since 10-10 the GAME's pages first: Sandbox (cheats, the kit, the chaos dial) · Missions (difficulty,
  the scenarios, fog of war) · Squad (orders, door tools, Team feel split by subject) · Enemy AI · Stealth · Player & weapons · Destruction · Effects · Weather & wind, then the renderer's:
  Frame · Direct · Indirect · Volumetrics · Materials · Denoiser · Renderer fx · Audio · Checkpoints; `bindings.ts SYS` is the list, a section is filed on a page by the
  `panel.system(SYS.x)` line above it, and a Team feel block in the Squad section the `tf = TF.<subject>` line above its `feelRows(table, rows)` call last set — the table's name does NOT pick the section) and collapsible SECTIONS on each page (live `summary()` in the header, ↺ where a defaults
  table exists); a status strip; search across every system (results carry their 'System ▸ Section' path); 'all knobs' reveals the A/B rows (`adv`) and rare sections; ← / → or
  [ / ] walk the rail (keys reach the panel FIRST through `Input.keyVeto` = `panel.onKey` while the pointer hovers it or focus sits inside it: the nav keys step it and any plain letter
  opens its search — Space and Cmd/Ctrl/Alt chords stay the game's — so a game hotkey pressed over the panel never reaches `input.pressed`; BACKTICK is the exception: it is main.ts's
  hotkey (`panel.toggle()`, not while a card has the game frozen), `onKey` hands it back and it is never typed into the search, and a FIELD inside the panel that holds the keyboard — the
  search box, a slider just dragged, a list, a number — shuts the panel on backtick through the panel's own capture listener, since Input never sees a key a field keeps. Tab is only
  `preventDefault`ed by game/input.ts and handed to the game like any key — nothing in src/game reads it yet; the mission list and the `?kit` preview cards walk their own focus with
  it while they are up. The WORKBENCH: backtick hides / shows its right-hand panel (the inspector) in every mode, Tab does nothing, and its debug views are ⚙ ▸ Renderer ▸ 'debug view'
  in the Characters / Effects modes and the 'view' list in the level top bar's second row in the Level / Materials modes; `[` `]` are still exposure. The native host: backtick
  toggles its panel, no debug-view key); open page / section / scroll kept in
  localStorage `twopointsix.panel`. Rows for WIND / AIM / WHISTLE / TACTICS / NEEDS / CHAOS / QRF / DEVICES come from
  `knobRows(spec)`; everything with custom logic stays hand-written. `tools/qa/panel-inventory.ts` (`probes.ts panel-inventory`, family `ui`) freezes the row inventory against
  fixtures/panel-inventory-main.json — a row may move but never vanish (a row REWORDED on purpose: `--reword [map.json]` rewrites only the fixture rows that went missing, each from the live row of the same kind and label, or the label the map gives); `PORT=<dev server port> node tools/qa/panel-keys.cjs` = the keys pressed for real in headless Chromium (the software
  adapter): backtick opens / shuts the panel from the game, from its search box and from a focused slider, Tab reaches the game, no debug view is stepped (exit 0 / 1, 2 = the script died).
  Every 'Tab ▸ X ▸ Y' path in this file, in code comments and in docs/internal means the debugger's page X, section Y — the key moved, and on 10-10 the old Sandbox page's sections were dealt to the six game pages above (a 'Tab ▸ Sandbox ▸ …' path is that section on Missions / Squad / Enemy AI / Stealth / Player & weapons now, 'Team feel' the Squad page's sections; sections renamed that day: the two called 'Glass' are 'Glass (the picture)' on Renderer fx and 'Glass breaking' on Destruction, 'Renderer — decals / particles' are 'Decals' / 'Particles', the weather's is 'Weather'); a row's label is unchanged unless the page rebuild/debug-tools/read-first.md lists it (some forty were reworded), so the panel's search finds a row by the words after the last ▸.
  `Weather & wind ▸ Wind — field view` (ui/windviz.ts, drawn by overlay.ts on the 2D canvas): arrows on a floor lattice from `wind.at()`, the sources' cones / gusts, the ≤ 8
  records the particles get, a probe at the cursor; ~0.35 ms CPU at its 534-sample maximum, nothing when off, the frame untouched.

<!-- added 2026-10-13, after the cut -->
- **The down card says who shot you, and from where** (the death recap goal, 'Every death explains itself'; `src/game/deathrecap.ts` `RECAP.on` + `src/ui/recap.ts`; step 1 = commit
  456c2e1b, in the build since 8d2c2785; its page is rebuild/death-recap/read-first.md): when Sam goes down the down
  card has a small plan above the route map — the man who shot him in the menu's orange with his name, the line of the round with an arrowhead, Sam as a white cross, a faint wedge for where
  he was looking — and under it the man's name, his gun, the distance. The same record is kept for every teammate and hostage who goes down (rounds, fragmentation bursts, a hostage shot by
  her captor; a stun canister is never named a killer, a knocked-out civilian is not a death). NOTHING IS SHOWN WHILE ANYBODY IS STILL PLAYING: the record is handed to the card only once the
  run is over (Sam down, or the mission ended either way); played on past the end ('Back to the floor'), what happens after the end stays hidden until he is down. It only READS the game: a
  run digests the same with it on and off. Off: `?norecap`, or Tab ▸ Player & weapons ▸ Player, doors & props ▸ 'end card: who shot whom'. `bun run tools/qa/deathrecap-check.ts` (`probes.ts
  deathrecap`, in family `ui`; both stands; `RECAP_BREAK=1` must fail), `PORT=<dev server> node tools/qa/deathrecap-page.cjs <outDir>` (the real page: a guard shoots Sam, the card's panel
  names the man the game's own log names; no panel under `?norecap`). STEP 2 (commit 4dcb3322, in the build since
  ecfbfd0a): THE PLAN PLAYS THE TAKE — the last `RECAP.secs` 8 seconds before he fell and the `after` 1.2 past it, at the speed they happened, a 1.8 s rest on who did it, then again
  (`src/ui/recap.ts mountRecap`: the DISPLAY's clock, never the game's; every man placed between the kept samples by `recapMenAt`; asleep while the card is put away, stopped when the
  panel leaves the page; a still of the fall alone where the viewer asks for less motion or the host has no frame clock; a chip a man, by name, when more than one of ours was lost;
  `window.__recap` {show, seek, stop, take}). The software adapter fires no animation frames once the game is up, so `deathrecap-page.cjs` steps it with `seek(k)` and
  `deathrecap-check.ts` holds the clock on a fake frame clock (`RECAP_BREAK=snap` — every man read off the last sample alone — must fail; a `look` argument after the page tool's
  outDir adds a squad page with no verdict, stills only). STEP 3 (commit 1743d599, in the build since 09e6b525): WHILE THE RUN IS ON (`RECAP.live`,
  `?recaplive=0`; `deathrecap.ts lostLive` / `lostOf`) a squad man down has his squad-block row struck (`orders.ts` hud opts gone / lost, `overlay.ts`), and only if a man still up saw
  him fall or heard the shot does the squad get, a beat later, the way it came from, to an eighth of a turn, in the
  witness's side word ('from the left!', 'from behind us!' — the fog's own sides, `cues.aside`, never a compass word); never the shooter. NOTHING OF IT IS DRAWN since 10-14: the
  arrow on the row and the `.lostfrom` stroke on the ground at him are only under `RECAP.liveArrows`, off everywhere (`?recaparrows=1`; the bullet 'A lost teammate's way is no longer drawn' below). `deathrecap-page.cjs` holds three squad pages: `live` (as shipped, nothing
  drawn), `livearrows` (`?recaparrows=1`), `liveoff` (`?recaplive=0`); `ONLY=live` runs the three, `ONLY=<name>` one. The hearing test repeats
  `SoundPaths.propagate`'s rule WITHOUT its cache. Check = section 11 of `tools/qa/deathrecap-check.ts` (`RECAP_BREAK=seen` must fail) and the live pages of `deathrecap-page.cjs`. On
  a squad's card the recap is a `verdictPanels` panel (`debrief.ts recapPanel`), under the men's rows; over the route map otherwise. Seen only on the software adapter.
- **Unplayed mission rows are drawn apart on the list** (2026-10-13; the owner: 'The 25 untuned rows are the backlog: play each once, say keep, fix or cut. Unplayed rows sit apart and
  earn no medals' — this is 'sit apart' only; medals are not built here). Switch `UNPLAYED_UI.on` (ui/missions.ts, beside `GROUPS_UI`: a drawing switch, the same on both stands, not a
  knob and not in `FROZEN_HOLDS`); the way back is `?unplayed=0` = the list in the order and with the DOM it had. THE RULE, `unplayed(m)`: the row is `untuned` and the short list does
  not name it (`onShortList`; under `?nopicks` every untuned row) — exported for whatever a mission earns to ask, and the sheet's 'untuned' tag asks it. Today 25 untuned, 20 unplayed.
  DRAWN: inside each group the unplayed rows come after the others (`unplayedLast`, a stable partition, taken by `missionList`; the start page's `startPageList` puts the short list's
  rows in front of both halves; the keys walk the same list); each wears `.mrow.unplayed` (picture 0.45, title and tags 0.5, full again under the pointer or the highlight) and the first
  of a group's wears `.first` when a played row stands before it: on the older list a thin rule in 15 px of room above the row, outside the row's own box. ON THE CARDS NO LINE IS BROKEN
  (tried and taken out the same day: a line of their own for the unplayed added a row of cards to two groups, and at 1366 x 650 and at two columns the grid squeezed every card of the
  group until titles sat on the rule) — there the unplayed stand last and quieter, nothing else. No word is added (the page's words are the same on and off). The loadout screen's
  'untuned' tag asks the same `unplayed()`. A group of nothing but unplayed rows (Quiet, as two) has no break; `?nogroups` moves no row and draws the quiet look only. On the start page the order
  did not move today (its short list already stood first and no other played row stood behind an unplayed one); on the older list 8 rows stand elsewhere. CHECK:
  `probes.ts unplayed` (family missions; `tools/qa/unplayed-check.ts`, lists as data and both screens on the fake DOM; the switch-off order is written out again in the check, with no literal,
  so a row added to the table or taken off it moves nothing) — ALL PASS on both stands, `UNPLAYED_BREAK=1` fails on both. `missions-list`'s order line holds the switch off (it pins the order before this). LOOKED AT:
  `tools/qa/unplayed-page.cjs` on the software adapter at 1280 x 720 (classes, order, computed opacity, the list's rule, `?unplayed=0`, `?cards`, `?nogroups`; no page
  error) and stills taken with no GPU at all; the page script also holds the open group's cards to the SAME BOXES with the switch on and off. Never seen on a GPU, nobody has played with it.
- **Every run ends on a verdict** (`src/game/verdict.ts`, `Game.verdict`, ticked in `Game.step` after `defuse.tick`; `VERDICT {on, winSecs, lossSecs}` in the knob registry,
  ON, `?noverdict` = the game and the end card as they were; READS ONLY — on and off digest the same). A TRY starts at the par clock's rule (the first order logged, Sam
  1 m off his mark, a round or a throw); `ended()` names each mission kind's end (CLEAR / RESCUED / TAKEN ALIVE / DEFUSED / OUT · DOWN / WIPED / LOST / GOT AWAY / BLOWN /
  FAILED); `result: RunVerdict` = word, clock, a row per man (path, where he fell, the defenders he dropped), the way a WON run was won — `Approach` doors / walls / dark /
  quiet, one a run, the rarest it earned: nobody ever hunted the team (the stealth game: no alarm, nothing spotted either) = quiet, the mains cut before it was found =
  dark, a man by a hole a blast made = walls, else doors — `clean` (nobody lost) and `void` (a cheat on during the try; its own latch — `m.stats.sandbox` latches before
  the try too). The mission's own card flag (`m.debrief`) raises the card where it has one; every other end is polled by main.ts `postUpdate` (`takeDue()`, a beat after).
  THE PAGE keeps what a machine has won (`src/ui/verdictStore.ts`, localStorage `twopointsix.verdicts`, key = mission id | difficulty: tries, the streak since the last
  win, per way the fewest tries and whether clean): main.ts `vBooks()` counts a try the frame it starts (a checkpoint load is another try; never under a cheat or a
  tape) and files the end BEFORE the card opens (`Verdict.kept`). The card: `src/ui/verdictCard.ts` (head, men, `verdictPanels` = the slot other goals' panels fill)
  hosted by ui/debrief.ts (`.vd-squad` hides the stealth game's rating / numbers / timeline, `.vd-solo` keeps them), pips `src/ui/verdictPips.ts`; the START PAGE's
  mission rows get the same pips from `src/ui/verdictRows.ts` (`watchMissionRows()`, a MutationObserver on `#missions` — the list's own files are not edited; no pips on
  Training rows). QA: `bun run tools/qa/verdict-check.ts` (`probes.ts verdict`; `VERDICT_BREAK=1` must fail), `node tools/qa/verdict-look.cjs <dir> [win|down|solo|off|cards]`
  (the real page, software adapter; `cards` needs no adapter). Page: rebuild/run-verdict/read-first.md. Never seen on a GPU.
- **Three rows are cut from the mission list** (2026-10-13; the maintainer's tap 'Three' on the card 'Cut which untuned rows from the mission list?'): `room-clear-four` (the office a third
  time), `quiet-yard-alone` and `quiet-yard-two` (the quiet engine's test floor). Each carries `offList: true` in `scene/scenarioList.ts` and STAYS A ROW OF THE TABLE: its id, its own
  address, its level file, `?loadout=<id>` and every tool that names it hold as they were. Switch `OFFLIST_UI.on` (ui/missions.ts): off in the module and in every harness (the list
  probes pin the whole table, untouched), put ON by the page's entry (main.ts, beside `wireMissions`); `?offlist=0` = every row drawn, as before the cut. `listedMissions(list, keep)`
  is what the Missions screen and the start page draw when handed no list; `keep` = a row the visit names, so a cut row asked for by name is drawn that once. `missionList()` is
  unchanged (lookups by id go through it). CHECK: `probes.ts offlist` (family missions; `tools/qa/offlist-check.ts`), `OFFLIST_BREAK=1` fails; the real page by
  `tools/qa/unplayed-page.cjs` (no card for a cut row; cards again under `?offlist=0`). To cut another row: `offList: true` on it and its id in BOTH `CUT` lists
  (`tools/qa/offlist-check.ts`, `tools/qa/unplayed-page.cjs`) — only on the maintainer's yes. Of the block pair, `block-squads` was cut later the same day (the bullet at the
  foot of this file); `block-four` stays. Never seen on a GPU.
- **A Training lesson ends on the verdict card too, graded as a lesson** (same switch as the verdict: `VERDICT`, `?noverdict`): lessons 5 and 6 are room clears, so their end is the
  room clear's `'taken'` / `'wiped'` and the card comes up a beat later like any squad mission's (before the verdict a room clear had no card at all: only the row 'structure taken
  — shift+enter stages it again'); lessons 1 to 4 and 7 end at the exfil on the stealth mission's own card. On a lesson's card NOTHING IS GRADED OR KEPT: no ways pips, no tries
  ticks, no record under `twopointsix.verdicts` (`main.ts vBooks`: the running row's `group === 'training'` → `KeptNote.lesson`; `verdictCard.ts verdictHead` draws the word and the
  clock only; `verdictLine` leaves the approach out). A lesson WON leads with `Next: <the next Training row's title> ›` (`src/ui/verdictNext.ts nextLessonOf`, wired in
  `menu.ts debrief`: the first button, primary, the focus; the row's own page load by `missionHref`; none after lesson 7, on a loss, or under `?noverdict`). The room can fall
  before the lesson's last step is done (lesson 5's scripted run: the card was due 5.7 s before the last line went by): the card wins, as the row already did. QA:
  `bun run tools/qa/verdict-lessons.ts [name …]` (the scripted player of `lesson-run.ts` plays each of the seven to its end, input only; the run must end WON with a card due;
  ~1.5 min; `VERDICT_BREAK=1` must fail), `node tools/qa/verdict-look.cjs <dir> lesson` (the real page, software adapter: lesson 6 taken, the card up by itself, no pips, no
  ticks, nothing kept, `Next: 7 · …` first and focused, its link the next row's). Never seen on a GPU; never played by a person to the card.
- **The block's three-squads row is cut from the mission list too** (2026-10-13, the fourth of the maintainer's tap 'Three': "One of the two block rows goes later, when the block's
  rebuild says which"). The rebuilt block is for `block-four` (eight men who hold their rooms); `block-squads` carries `offList: true` and stays a row of the table, as the other
  three do: its own address, `block-squads.json` and `?loadout=block-squads` hold (its `ways` now name the rebuilt floor's two starts, the same as `block-four`'s: the two files
  share them). The cut changes no check on the level file: what is red on the rebuilt block floor is the floor's (docs/agents/levels.md), not this row's. `?offlist=0` draws it again. `probes.ts offlist` and
  `tools/qa/unplayed-page.cjs` name the four. Checked headless and on the real page with the software adapter; never seen on a GPU.
- **A partner's men are on Sam's stealth card** (`src/game/teamtally.ts`, `TEAMTALLY.on`; the maintainer's yes 15:33Z 10-13 to the quiet levels page's call 35. ON in the
  page — `?noteamtally` (or `?teamtally=0`) = only the player's own are counted, as it was; OFF in the module and on the frozen stand, `TPS_TEAMTALLY=1` there;
  `FROZEN_HOLDS`, `standup.ts`, `standEnv.ts`, `knobs.ts` + `JOURNAL_KNOBS`, `journal.ts applyKnobs`: a file without the row replays off): `combat.ts killGuard` prices
  a man only when `by === 'player'`, and the partner's round (combat.ts, `'guard'` + `killerId`), his ordered takedown (`pairorders.ts`, no `killerId`) and his own
  (`spotted.ts`) all arrive as `'guard'` — so a quiet mission as two where he shot the shift read 'kills 0 · no kills · pacifist'. On, `teamTallyTick` (game.ts, the
  step's tail, before the checkpoint and the journal close the frame; quiet missions with a partner only) tallies each defender the partner put down THAT step as the
  player's would be: a round that kills = a kill, anything else = a knockout, a round into a man = a round near a man (so no 'pacifist'), with its timeline row
  (`… shot dead (Blue One's round)`). A round `killerId` does not give to a teammate stays on nobody's card (a defender's stray); a man struck or choked by `'guard'`
  is the partner's whoever is named. Stateless (`diedAt === g.time`), nothing in a checkpoint. Squad missions are untouched (their card has no stealth numbers).
  Unswitched, with it: on the verdict's own rows an unnamed takedown ticks the partner's row where the team has one AI man (`verdict.ts onlyMate`). QA:
  `bun run tools/qa/teamtally-check.ts` (`probes.ts teamtally`, family `quiet`; seven lines; `TEAMTALLY_BREAK=1` must fail; both stands — the check sets the table
  itself after the stand-up). Never played by a person; the card with a partner's kill on it never seen on a page.
- **A lost teammate's way is no longer drawn (`RECAP.liveArrows`, 10-14; the maintainer: "we shouldn't show the arrows, feels unrealistic").** The live recap
  (`RECAP.live`, `deathrecap.ts lostLive`) drew the way the round came from twice: an arrow on the man's struck row in the squad block and an orange stroke with
  a head on the ground at him (`.lostfrom`, `ui/overlay.ts`). Both are now behind `lostArrowsShown()` and off: the row is still struck and the man who saw still
  says which side — the squad's own word is all the player gets. `?recaparrows=1` = both back; `?recaplive=0` still turns the whole live rule off. The key is
  false in the module and on both stands (the overlay only: no step reads it, no digest moves, not in the journal). Check: `probes.ts deathrecap` (28 lines; the
  new one reads the staged 'mate' run, the key both ways, and that overlay.ts asks before the stroke and before the row's arrow; `RECAP_BREAK=arrows` red) on
  both stands. Never seen on a GPU, never played.
- **The end card opens the run's replay (10-14; the maintainer, of the verdict card: "would be nice to be able to open the replay immediately here").** The card
  (`ui/menu.ts debrief()`: the verdict card, the down card, a lesson's) has a **Replay** button after its own buttons and before Copy summary. One press does
  Shift+F7's work (`ui/replaykey.ts openViewer('card')`, the key goes the same road now): the last stretch saved to
  the shelf, then THIS WINDOW sent to `replay.html#id=<n>` (no tab: 'One window' in replays.md), staying on the game if nothing was shelved. Armed half a second after the card is up, like
  its neighbours. NO button where nothing could be viewed (`ReplayKey.canView`: the one-file build has no viewer page; `?noreplay` or the stored switch has no
  buffer) — the page hands the card its opener through `MenuDeps.replay`, asked each time the card is drawn. No switch (a button, not a rule); nothing in the
  game reads it. `__replay.view()` / `__replay.canView` are the hook's. CHECK `probes.ts cardreplay` (family `replay`; `CARDREPLAY_BREAK=1` = the browser hands
  back no tab: must fail), 4 lines, both stands. What the replay holds is the buffer's last stretch of PLAY, as F7's (`REPLAY.seconds`, 300: the card
  up stops the clock, so waiting on it loses nothing): a run longer than that has lost its start and opens at the buffer's own, and after restarts the file
  still holds the earlier attempts but the viewer opens it at the run the card is for (the last restart's mark, `replay/format.ts lastRun`, for a file whose
  why is 'card': the F7 bullet in replays.md). NEVER SEEN ON A GPU; the page look is on the software adapter.
- **The end card's Replay plays the run in the engine (10-15; the maintainer: "clicking on replay after a mission should start in engine").** The card's press
  (`ReplayKey.openViewer('card')`) still saves the last stretch, and the window (no new tab since 10-15: 'One window' in replays.md) now goes to the GAME PAGE on the file's run
  tape (`replaykey.ts engineUrl`: `index.html?playtape=<shelf id>`, the address the map viewer's 'Play in engine' has), with `&at=<step>` at the first steps of
  the LAST try so it opens on the run the card is about (the tries before it are run through unseen first; one try = from the top). That step is read off both
  halves of the file: the trace's last restart mark (`format.ts lastRun`, the map viewer's rule for a card's file; it also has a restart made INSIDE a step —
  Shift+Enter, Enter once down — which is on no tape row) and the tape's last restart row + 1 (one older than the trace's 300 s). A file with NO TAPE TO PLAY goes
  to the map viewer as before, and so does Shift+F7: `rerun` absent or `{dead}` — a checkpoint loaded (the down card's default 'Restart from checkpoint' on the
  solo and quiet missions), a scenario started or quit from a menu inside the visit, an F10 recording, past `RUNTAPE.minutes`. No switch (a button's address;
  nothing a step reads). The engine page opens standing on its big ▶ (the player's own: a page just loaded has no gesture for sound), so it is one more press to roll; its
  bar's 'Map' goes to the 2D viewer. Check: `cardreplay` (family `replay`; a real tape off the key's own buffer with a restart in it; `CARDREPLAY_BREAK=1`), both
  stands. Never seen on a GPU.
- **Copy and paste for loadouts** (2026-10-15; the maintainer: "we should have copy and paste for loadouts"). On Team & kit, **C** copies the picked
  man's kit and **V** pastes the copied kit onto the picked man, from any row of the screen (Ctrl / Cmd with either is the same press while no text on the
  page is selected and no text field has the keys; the two go by the LETTER on the key, `kitCard.ts clipKey`, the screen's other keys by their place);
  the mouse has two buttons, Copy and Paste, at the end of the card's sets line (`.kc-clip`, not `.kc-set`: the sets are still three). `src/ui/kitCard.ts
  KIT_CLIP {on, card}` holds the one copied card for the page's life (UI only: nothing in the game reads it, so it is no knob table and no journal row;
  `?nokitcopy` = no buttons, no keys, the card as it was; ON in the module, so the headless probes' cards carry the two buttons as the page's do). THE
  PASTE IS `src/game/kit.ts kitPaste(i, card)` (`kitPastePeek` = the same, nothing written): every ROW of the man's own card takes the copied card's
  value where his row offers it, a count over his row's most comes down to it, a row that cannot show the copied value at all keeps what it had (a
  teammate's wall charge onto you with your own charges off: your big slot is left alone; your cans as one of four splits with the pouches rule off), a field his card has no row for is never
  written, and `cardWhy` is asked as for a set: so a pasted card is one his own tiles could have made, and a paste the squad has no room for (a table
  with a squad limit) is refused with the reason under the rows. HIS COLOURS STAY HIS OWN (suit and trim, as under a squad kit: the trim is how the men
  are told apart). ONE write of his card and of the store per paste (the door picture's one `kit` message), none when nothing would move; the highlight
  is not moved by the keys. SHOWN, NOT TOLD: Copy is lit on every card that WEARS the copied kit (`kitWears`: a paste there would move no row, so Paste
  is dim), the tiles a paste moved flash once (`.kc-row.pasted`), and the roster marks each man who wears it (`.lo-slot.clip`, two sheets in the chip's
  corner). The one start page's key line gains "C copy · V paste" while there are cards (`ui/startpage.ts say`, asked again at every paint: a mission's
  own issue takes the cards away after the screen is up). A Ctrl / Cmd press is not kept for its release (`eaten`): macOS sends no keyup for a key let
  go under Cmd. CHECKS: `bun run tools/qa/kitpaste-check.ts` (`probes.ts kitpaste`, also in `kit`; it sets the pouches rule, the big slot and your own
  charges / wand / cameras each way itself, so it asks the same on both stands: 8,000 pastes over seeded squads the tiles made, each a legal squad and a
  card of the man's own tiles, plus named cases; `KITPASTE_BREAK=1` = the copied card written unfitted, 13 lines fail on both stands) and
  `PORT=<dev server> node tools/qa/kitpaste-page.cjs` (the real page in headless Chromium, no GPU needed: the keys, the button, Ctrl+C / Ctrl+V, one
  store write a paste, the flash, the marks, `?nokitcopy`, a mission that issues its own kit; `KITPASTE_BREAK=1` must fail). WITH THE SHIELD GONE FROM THE
  GAME (10-18) a stored card that says shield reads as a card without one, and a paste hands over what the card SHOWS: the empty big
  slot, never a shield. A
  DEPLOY WITH A PASTED KIT, end to end: `PORT=<dev server> node tools/qa/kitpaste-deploy-page.cjs` (SLOW, about eight minutes: the real page on the software
  adapter; C, V, the Deploy button's page load, then the mission's own kit table — four staged, the pasted man's card and the squad's count; first run
  10-15 on the build of that day, 6 lines pass; `KITPASTE_BREAK=1` = nothing pasted, 3 lines fail). It reads the table, not the men: nobody has looked at the staged man's
  hammer. The Cmd key of a Mac (no keyup for the letter) and a Dvorak board are two lines of the page check, made of key events built by hand: no
  such keyboard has pressed them. Never seen on a GPU, and never with the door picture up behind the tiles; nobody has played it.
- **What a mission hands you shows on your card** (2026-10-16; a claim from the stealth goal's mission wand). A quiet mission played under the fog hands Sam
  its sticky cameras for the visit (`scenarioRun.ts` → `stickyVisitSet`, to a card with the rifle) and, where `quietfog.ts QUIETFOG.wand` is up (`?quietwand=0` off), an
  optical wand with them; the Team & kit card read his CARD alone and said 'none' beside both. Now `ui/kitCard.ts MemberCardOpts.lent(field)` (how many the mission
  hands him) marks a tile `lent` where that is more than his card carries: the thing drawn lit, the mission's count and `LENT_WORD` ('mission’s') where the
  value is (his own count stays in front where he carries some: '1 · mission’s 2', so an arrow pressed still moves a number he can see), the row's line for
  a man who has it, no pouch rate on a tile the mission alone fills, the reason on the tile (`LENT_WHY`). `ui/loadout.ts lentNow` answers it from the link
  the screen would deploy, by the game's own rule (`scenarioRun.ts quietCamsOfLink`, the one `startFromQuery` hands to `stickyVisitSet`; the fog lever and
  the Sticky cameras row are on that screen: moved, the card is drawn again); you only, quiet missions only, never a lesson, no cameras beside a pistol.
  `worn()` lays the same kit over the card it hands the drawn man, so the figure beside the card is dressed in what he will deploy with. NOTHING OF THE
  CARD OR THE POUCHES IS WRITTEN: whether lent kit stays free is the maintainer's open call on the stealth page, and a card that carries its own wand still
  pays its pouch. SWITCH: `KIT_LENT.on` (UI only, no knob table, nothing in the game reads it), ON in the module and the page, `?nokitlent` = every tile
  and the drawn man read the card alone. CHECK: `bun run tools/qa/kitlent-check.ts` (`probes.ts kitlent`, also in `kit`; a headless DOM, it sets its
  switches itself so it asks the same on both stands; `KITLENT_BREAK=1` must fail), 10 lines, one of them THE GAME'S OWN WORD: the screen's own link
  started in a headless game, the cameras (and the wand) the tiles promised are what is on him. The real page: `PORT=<port> node tools/qa/kitlent-page.cjs` (the
  software adapter, about four minutes a page: the screen as it opens, the fog kept off, `?nokitlent`). Not on the roster's chips or the one-line card. Never seen
  on a GPU; nobody has played it.

- **A stealth mission's kit is what your card starts at there** (2026-10-20; the maintainer on Team & kit of the solo night: "not sure it makes sense to
  have "mission's" for equipment. that should just be defaults. and if we want to have required equipment, that should just be a constraint on the stuff
  you pick." and "quiet default also looks jank"). The build before HANDED a quiet mission's sponge rounds, sticky cameras and optical wand to you over
  your card at the staging, for no pouch, and the tiles above read 'mission's': a second kind of gear no row could change. Now NOTHING IS HANDED OVER A
  CARD. On a stealth mission (a quiet mission; the night alone) you wear a STEALTH CARD of your own, kept apart from the loud one, and what it is issued as
  is the mission's kit (`kit.ts stealthIssue`): the launcher's five sponge rounds, the cameras the link carries, the wand, nothing loud (no frag, no HE),
  and a smoke / stun canister in turn where a pouch is left (no fog: five rounds, two smoke, one stun). Every row is yours to change and is priced like any
  other; the sponge rounds ride FIVE TO A POUCH (`slots.json` sponge `holds: 5`, read only under the switch), so the kit as issued fills the four pouches:
  1 + 2 cameras + the wand. 'As issued' on that screen puts the mission's kit back. A stealth card still as issued is not stored and FOLLOWS the mission
  (the fog lever moved on the screen, another link's cameras); one changed by hand is kept (`twopointsix.kit` gains `stealth`, the card; `members[0]` stays
  the loud card) and is worn on every stealth mission while it is a legal fill. `kitMission(hand)` says which mission the table's first card is for: the
  loadout screen as its card is mounted and as the fog lever moves (`loadout.ts syncHand`), null as it closes; a staging puts the run's card first for the
  length of its own call and puts the table back (`forRun`), so nothing read off the table between stagings moves with the last run played. THE QUIET KIT'S
  CARD FOR YOU is that same kit under the switch (the table's, a pistol alone with three smoke and a frag, predates the rounds, the cameras and the wand),
  so on a stealth mission the row of kits does not list Quiet beside the same card as issued; the teammates' Quiet cards are the table's. NOT COVERED: a
  mission's own issue and a lesson's page wear the issue cards (nobody's card: a lesson's page with the hand-overs as they were, a mission's own card for
  you with none since `ISSUE.whole`, `docs/agents/missions.md`); the tile seam (`lent`, `LENT_WORD`,
  `KIT_LENT`) is kept and inert under the switch, and is the page as it was under `?nokitstealth`. REQUIRED EQUIPMENT: no mission requires a thing today;
  one that did would be a refusal with its reason (`kitRowCan`), never a second kind of gear. SWITCH: `KITDEAL.stealth` (a key of the registered table,
  journaled; a recording from before the key replays with it off), OFF in the module and on the frozen stand (`FROZEN_HOLDS` row, `TPS_KITSTEALTH=1`; reads
  only under the card as a tree), ON in the page (`?nokitstealth`; a box in the debugger). Off = the build before: the hand-overs, the tiles that say
  whose, a sponge round a pouch each. CHECK: `bun run tools/qa/probes.ts kitstealth` on BOTH stands (13 lines: off to the count, the card, a reload, the follow, the
  store, As issued, the Quiet kit, four staged runs, the journal); `KITSTEALTH_BREAK=1` fails 6 on each. The real page: `PORT=<port> node
  tools/qa/kitstealth-page.cjs` (`STEALTH_BREAK=1` must fail). Probes written against the hand-overs run with the key held off by the runner
  (`STEALTH_AS_IT_WAS` in `probes.ts`; `kitanim-midswap` beside it, whose night alone throws a frag; `lesson-check.ts` holds it for its kit block, whose 'same start off a lesson's page' is a quiet run alone — a lesson's page under a kept stealth card is kitstealth's own line). A run tape carries the kept stealth card beside the cards (`kit.stealth`). Never seen on a GPU; nobody has played
  it; whether five rounds, two cameras and a wand is the right kit to start a quiet night with is the maintainer's to say.

- **A suppressed gun is drawn and named as one on the kit card** (2026-10-17; the maintainer on the Team & kit screen of a quiet mission: "quiet missions
  should have different gear screen stuff i think. be creative!"; his shot showed the quiet set's guns tile reading 'GLOCK 19 ONLY' beside a bare pistol).
  THIS IS ONE PART OF THAT ASK, the guns tile's; nothing in it asks whether the mission is quiet, and the rest of the ask belongs to the screen's picture
  and panel. Both of your guns wear a suppressor (`weapons.ts suppressed`, drawn so in the game), and nothing drawn on the card showed it. Now
  `game/kit.ts kitGunCan(i, m)` (the gun in his hands is a suppressed one: both of yours whatever the card's `suppressed` field holds, a teammate's by his
  Suppressor row, never the shotgun) puts the can on the gun's drawing (`ui/kitIcons.ts GUN_CAN`, `kitIcon(field, value, can)` / `gunIcon(weapon, can)`:
  the tube on the muzzle, one dark band where it screws on) in the three places a gun is drawn, all asked through `ui/kitCard.ts gunCanOf`: the guns
  tile, the roster's chip (`.lo-ics`, the drawing the one start page shows) and the roster's gun over its words (`.lo-gun`, the `?cards` screen's). Your
  pistol carried alone reads 'Suppressed Glock 19' on its tile (`youGunsCan`); the rifle's words stay 'Mk 18 + Glock 19' (two guns on one tile, and the
  floor hears the rifle as gunfire all the same); a teammate's tile keeps his row's word, the Suppressor row beside it says the rest. `kitWords` and
  `YOU_GUNS` are NOT changed (the roster's line, the card's line under the tiles and several checks read them), so on the `?cards` screen those two
  lines still say 'Glock 19 only' under a tile that says 'Suppressed Glock 19'; the one start page shows neither line. SWITCH: `KIT_CAN.on` (UI only, no
  knob table, no `FROZEN_HOLDS` row: nothing in the game reads it and no frozen fixture reads a drawing, as `KIT_LENT` beside it), ON in the module and
  the page, `?nokitcan` = the bare drawings and 'Glock 19 only'. CHECK: `bun run tools/qa/kitcan-check.ts` (`probes.ts kitcan`, also in `kit`; a
  headless DOM, it sets its switches itself so it asks the same on both stands; `KITCAN_BREAK=1` must fail), 7 lines. Looked at on the real page on the
  software adapter at 1280 x 720 only (the tile's words fit uncut, no page error); under 1180 wide the one page hides the tile's drawing and only the
  roster's chip carries the can, not looked at; the `?cards` screen's narrower tile not measured. THE MAINTAINER'S CALL, not taken: the quiet set still
  carries a frag (`setCard` builds it on the issued card). Never seen on a GPU; nobody has played it.

- **The squad's kit is dealt over the men who come** (2026-10-18; the maintainer, over Team & kit on The pass with a team of four as issued: "as
  issued still has blue team pretty empty"). The issued kit (`src/game/kit.ts ISSUED`) and every named squad kit (`src/game/slots.json` loadouts) are
  written down as the FIRST TWO teammates carry them, so that a pair, a three and a four add up the same; with three or four coming the others stood
  on the roster with a gun and `pouches 0 / 4`. No level deals a kit: the table is one for every mission (a level changes it only by
  `scenarios.issue.members`, today the long hall's alone, or by `scenarios.roomClear.wallCharges`), so the fault was on every squad mission at +3 and
  +4 under every kit. ON: the cards are WORN shared out (`kitWorn(n)`, `kitShown(i)`): while the teammates' counted small things (door charges, stun,
  frags, smoke) are the issue's or a named kit's, `deal()` hands them one at a time to the man of those who come with the fewest, a man without that
  thing first, Red and Blue by turns. As issued, of four: Red One 1 stun + 1 charge, Red Two 1 stun + 1 frag, Blue One 1 charge + 1 frag, Blue Two 1
  stun, so each pair has a stun and a charge of its own. THE TABLE'S CARDS ARE NEVER REWRITTEN FOR IT: `KIT.members` and the store stay in the table's
  layout; the deal is what the roster, a man's card and the drawn man show, and the card a staged man carries (`kitStage`, `kitOf`). The squad's count
  is a sum over the men who come (`kitPool`), so it does not move at any size and a run is the run it was by digest; nothing in the simulation reads
  which man holds a counted thing. A CHANGE BY HAND is made to the card as worn (`onWorn`): a counted thing changed on a teammate makes the worn cards
  the player's own, kept as they stand at every size (so a smaller team then leaves behind what its men at home hold, as hand-made cards always did);
  any other change (a gun, a look, a big thing, your own card) is written onto the table's cards and the layout stays, unless it costs a pouch that
  man's card in the table has not got (a wand on Red One, full as issued): then the worn cards are kept too, so no stored card is ever over its
  pouches; a refused change and a peek write nothing; men put back on their shares are the named kit again (`dealSettle`, only into a layout their
  other things leave room for). Cards kept as the player's own are marked so (`dealOwn`, saved as `own` in the store, dropped by a squad kit put on by
  name or a reset): they are worn as written even where they come to read as a kit's table (Blue One's last canister given up on purpose), and the
  squad kit row then names no kit. The Team & kit picture is sent the worn cards and wears them as written (`ui/kitView.ts`, `main.ts kitCards`). A man's own set (As issued, Quiet, Loud) at three or four is HIS
  SHARE of that kit, so Loud on a man of four may add no stun to him. A mission's own issue that changes a teammate's counts is not a named kit and is
  worn as its file writes it. A TOOL EACH PAIR (`KITDEAL.more`, 10-18; the maintainer's pick on the card that asked whether a four should carry more
  as issued: "A tool each pair"): a team of three or four is LENT a big tool each pair, Red Two the breaching shotgun and Blue Two the hammer, in a
  big slot that stands empty; pouches as the deal gave them. THE PAIR'S SECOND MAN CARRIES IT, NOT ITS FIRST (so of three, where Blue One comes
  alone, only Red Two is lent one). The card the maintainer picked on said Red One and Blue One, and that was built first and MEASURED WORSE THAN NO
  TOOL (the shipped stand, the office room clear, the blue pair told 'open and clear' at the manager's door with red stacked on it, seeds 1 to 8):
  with the hammer on Blue One the pair lost 10 men of 16 and was wiped twice, where with no tool it lost 4 and with the hammer on Blue Two it lost 2
  and went in every time. Why: `doortools.ts toGun` sends the order's lead to the lock when he carries the tool, the door goes with the hammer still
  in his hands, and the second man waits on the lead for the threat in the doorway ('until the first man has it'), so nobody fires for a second.
  With the tool on the second man the lead keeps his gun up and has that threat down inside 0.3 s. STILL OPEN, the door tools' own: a carrier who
  is also the order's lead (the tool put on him by hand, or the second man standing on the latch jamb) goes in as before; no rule yet hands the lead
  to his mate. THE TOOLS ARE WORN, NEVER WRITTEN (`lend`, applied where the cards are worn: `kitWorn`,
  `kitIssuedShown`, a man's own As issued set): no card of the table or the store ever holds one, not after another row is changed, not after a
  counted thing is (`onWorn` writes a slot empty where it holds the very tool the deal would lend back), so one or two teammates come as they did and
  the key off is the deal alone at once. A big thing put on that man by hand is his, written, at every size. HIS SLOT EMPTIED BY HAND IS MARKED ON
  HIS CARD (`MemberKit.bare`, kept in the store, dropped when something is put in the slot): the lent tool stepped off, or a thing put on by hand and
  cleared again, leaves the slot empty until he is given something, and moves nothing a smaller team carries (a first pass kept it by making the
  cards the player's own, which halved a pair's grenades and wrote the other man's tool; and a cleared slot showed the lent tool at once). WHICH CARDS
  ARE LENT (`lendable`): the teammates' counted things are the issue's, or the cards are the player's own and no named kit's. NO NAMED SQUAD KIT IS
  LENT ONE (each says what its men carry, and the Quiet kit's men would pay for a loud tool they keep slung), cards that leave a named kit by a
  counted change keep its empty slots (the same mark, dropped again when they settle back into it), and a mission's issue that writes its own counts
  is worn as its file writes it; a mission's plain issue lends them (the long hall). `dealSettle` never settles into a layout that would lend a man
  a tool or stop lending him one. What it gives the four: the big slot's row on a door's tools (H) and a lock taken by the shotgun where the lead
  booted it. NOBODY COMES WITH A GUN ALONE, the same key: a man the deal leaves with nothing counted is handed one stun canister more (while his
  pouches and the table's most-a-man and most-a-squad allow), which `kitPool` (it now reads the cards as worn) counts: only the Quiet kit of four has
  such a man, so it carries four stun where it carried three. THAT ONE CANISTER IS THE ONLY THING OF THE DEAL THAT MOVES THE SQUAD'S COUNT. SWITCH OF
  ITS OWN: `KITDEAL.more`, OFF in the module and on the frozen stand (a `FROZEN_HOLDS` row, `TPS_KITMORE=1`; reads only with the deal and the big
  slot on), ON in the page and on the shipped stand (`?nokitmore`; the debugger's Big slot section, 'a tool each pair as issued'); a recording
  whose KITDEAL table has no such key replays with it off (`journal.ts applyKnobs`). Its check is the `kitdeal-more` family and the lines it adds to
  the run, the screen and the stands (`KITMORE_BREAK=1` fails 13 on both stands); the older families hold the key off and ask of the deal alone, but
  for the seeded walk, which now walks the whole rule and reads the big row after every press. MEASURED (the shipped stand, the office room clear,
  four as issued, the manager's door locked against Sam, seeds 8, 9, 10, the same on each): 'open and clear' takes the lock in 14.6 s with the
  shotgun drawn once and no boot, where the key off it took the same 14.6 s with one boot; the big slot's own row takes it in 14.2 s where the key
  off there is no such row; both door charges are still carried either way. (So the tool buys no time at a door a boot opens: it buys the doors a
  boot is refused at, and a lead who goes in with his gun up.) Not measured as issued: a door locked on the face it opens toward (the boot's
  refusal, the tools' answer: `bigslot-shut` asks it with cards set by hand). PROBES WRITTEN FOR A FOUR WITH EMPTY BIG SLOTS are held to that on
  every stand by the runner (`probes.ts MORE_AS_IT_WAS`: the word and the table, unless whoever runs the tool set the word himself), as the deal's
  own older probes are: `frameholds-tools`, `doortest`, `silent-pick`, `silent-boot` (a locked or wedged door such a four boots is one the tool
  takes), the ones that read a door's tools page row for row against the pair's or count its rows by their digits (`doormenu-rows`,
  `thresholdmenu-rows`, `shutdoor-menu`, `silent-tools`, `pressorders-squad4`, `pressorders-nightbreach4`), and `kitpaste` (its squads' big slots
  are the table's; a paste over a lent tool is a `kitdeal-more` line); the page as it opens is walked, in every scenario, by `orderkeys-walk`. THE PASTE'S TWO PAGE CHECKS READ THE RULE (10-19): `tools/qa/kitpaste-page.cjs` and the slow `kitpaste-deploy-page.cjs` paste a hammer card onto Blue Two of four, the one man the deal lends that hammer, so the store holds his counts and big 'none', his Big slot tile and his card's line read the hammer before and after, and three tiles flash; the first runs its opening part again under `?nokitmore`, where the hammer is written and four tiles flash (both were written to the store's hammer and went red on the page as it opens; headless Chromium, never seen on a GPU). ONE THING THE PLAYER NOW MEETS ON EVERY DOOR, OF FOUR: the big slot's row is on H, a key of its own beside G, since the
  page's five digits are taken; `orderkeys` knows the key now (it never met the row: nobody was issued a tool). The maintainer's call whether H
  is near enough to the left hand.
  STILL LEFT: a four as issued fills 2, 2, 2 and 1 of its sixteen pouches. SWITCH: `KITDEAL.on`, OFF in the module and on the frozen stand (a `FROZEN_HOLDS` row, `TPS_KITDEAL=1`, reads only with `SLOTS=on`), ON in the
  page and on the shipped stand (`?nokitdeal`; the debugger's Big slot section, 'squad kit dealt over who comes'); in the knob registry and
  `JOURNAL_KNOBS`, and a recording from before the table replays with it off. Off at any moment = every card shown and staged as the table writes it.
  CHECK: `bun run tools/qa/kitdeal-check.ts` (`probes.ts kitdeal`, also in `kit`; 39 lines on both stands, `KITDEAL_BREAK=1` fails 3 on both: nobody
  comes bare, a pair a door, the roster of four); the real page: `PORT=<port> node tools/qa/kitdeal-page.cjs` (with `more`: the roster's lines
  name the two tools, the staged four have the big row, `?nokitmore` is the deal alone). The older card probes (`kit-*`,
  `pouch-*`, `squadsmoke-*`, `bigslot-card`, `wand-mate`) press a pouch too many on the table's own layout at four, so `probes.ts DEAL_AS_IT_WAS`
  holds the deal off for them on every stand; the worn cards are this check's, with 3000 seeded presses of its own. `bigslot-check.ts` run BY ITS
  OWN FILE takes the same holds itself (the deal for its card part, the two gun rows for every part: it was red on the shipped stand alone while
  green inside the gate), and now runs its `weight` part too. A MISSION'S ISSUE IS NOBODY'S OWN LAYOUT: `asIssued` holds the player's own-layout
  mark off for the staging, so cards changed by hand never stage a mission's issue undealt (the check's hall line, red without it). LISTING: `bun run
  tools/qa/kit-audit.ts` (`--deal=off` for the cards before, `--more=off` for the deal alone) prints every kit at every size and one row a mission. MEASURED: The pass, four, 240
  frames, one seed: the same digest on as off; a pair and one man count what they counted; the long hall, whose block names nobody since the shield left the game, counts the same;
  60,000 seeded presses (eight seeds, sizes stepped) left no stored or worn card outside the rule on either stand. Never seen on a GPU; nobody has
  played it.
- **The gear screen is a tree, the same for every man** (`src/game/kittree.ts KITTREE`, `kit.ts buildRowsTree`, `ui/kitCard.ts`, `ui/gunStats.ts`; the
  maintainer on Team & kit, 10-19: "have some way of distinguishing different guns (some stats?), attachments like silencer should be per gun", "should
  be symmetric between self and teammates (e.g. 40mm should work for squad)", "sponge should show up, should only be part of stealth builds by default",
  "ideally rifle attachments should be hierarchical under the rifle", "weird that we have both per person defaults (as issued, quiet set, etc.) and
  then squad kits too"). With the switch on a card is ONE list of rows for you and a teammate. Each gun is a box: its tile, FOUR BARS of what it is
  good at (Reach, Volume, Handling, Quiet: `gunStats(def)` read off its `weapons.ts` row, no number shown), and under it, set in off a rule, what
  rides on it (`KitRow.under`): its own suppressor (`suppressed` the primary's, `sideCan` the secondary's, new), the weapon light, and on a gun with
  the tube (`KitRow.has`) sponge rounds (`rings`, a row for the first time), 40 mm grenades and sticky cameras. A suppressor row on a gun that has no
  choice reads what it is and has no arrows (`KitRow.fixed`), and its flag is put back on when the gun leaves the card (`homeCans`): a paste or a kit
  never carries an 'off' nobody could see. YOUR card has the suppressor, light and goggles rows a teammate's always had, and you deploy with them: a
  suppressor off is the same gun with a bare muzzle (the pick's own bare row, `gunslots.ts PICKS`: the row a teammate's card makes of it), no light is
  a dead L, no goggles a dead N and no goggles drawn (`kitYouLight`, `kitYouNvg`, asked every frame, so a checkpoint cannot bring
  one back). SPONGE ROUNDS are a count, none as issued; a quiet or solo mission hands you `KITTREE.lend` (5) over your card as it hands its cameras
  (`kitRingsLent`; the tile reads `5 · mission's`), so a stealth run starts with the five every launcher used to carry and a loud one with none. ONE
  PLACE FOR NAMED KITS (the maintainer's tap, 'Squad row only'): the card's row of sets is one `Reset` beside Copy and Paste, and the screen's row of
  kits (labelled `Kit`) is shown and live at every team size; alone it lists the kits that put a different card on YOU and a press writes your card
  only (`kitLoadout(id, only)`, `kitLoadouts(only)`, `kitLoadoutOf(only)`). A stored card from before the tree: yours takes its suppressors, light and
  goggles as issued, a teammate's one Suppressor row is both his guns'; a card written under the tree keeps its new fields through a visit with the
  switch off. A TEAMMATE'S 40 mm: his card has the `40 mm grenades` tile under his primary where yours is, none as issued and one at
  most (`SHELLS_MATE_MAX`; `slots.json shell40` names a teammate with a most of 1, a pouch), only where the round can be fired: the card a tree and
  the order in the build (`mateShells` = the tree and `squad40.ts squad40Here`; the order is X on a spot of floor, G, 3, switch `SQUAD40.on`,
  `?nosquad40`). A primary with nothing under its barrel takes the tile and the round off the card (`homeShells`), his line under his name says
  `1 × 40 mm`, and `kitStage` hands the round to `squad40Stage` as it always did. No sponge round and no sticky camera for a teammate.
  SWITCH: `KITTREE.on`, OFF in the module and
  on the frozen stand (a `FROZEN_HOLDS` row, `TPS_KITTREE=1`; it reads only with `GUNSLOTS` and `BIGSLOT` up), ON in the page and on the shipped
  stand (`?nokittree`); in the knob registry and `JOURNAL_KNOBS`, and a recording from before the table replays with it off. Off = the card of the
  build before, row for row: one Suppressor row for both a teammate's guns, your guns always suppressed, five sponge rounds with every launcher, the
  two rows of sets. CHECK: `bun run tools/qa/kittree-check.ts` (`probes.ts kittree`: `kittree-rows`, `-guns`, `-sponge`, `-off`, `-mate40`; 31 lines on both
  stands, `KITTREE_BREAK=1` fails 18 on the frozen stand and 19 on the shipped one); the real page, `PORT=<port> node tools/qa/kittree-page.cjs` (20
  lines: bars, tiles under their gun, sponge none on a loud mission and the mission's five on a quiet one, the one Reset, the row of kits alone, and
  at 1000, 1180, 1353, 1440 and 1512 px wide nothing cut and nothing run into; `KITTREE_BREAK=1` fails 4); a deploy off the card,
  `tools/qa/kittree-deploy-page.cjs` (two mission boots on the software adapter, slow). The older card probes that read a row's place (`wand-kit`,
  `wand-tile`) hold the tree off on every stand (`probes.ts ROWS_BEFORE_THE_TREE`), as `gunslots-check.ts` does in its own `raise`; `loadout-screen`
  reads 'bare' in a man's line where it read the old row's name, and `kitpaste-page.cjs` counts the one Reset on a tree card. A MAN'S LINE under his
  name (`kitWords`) names his guns by their picks under the tree, with `bare` after one whose suppressor the card has taken off. LEFT, the
  maintainer's calls: a sponge round costs a pouch and on a quiet run buys nothing over the lent five; the Quiet kit names no sponge; which four
  bars, and their scale (untuned, nobody has compared guns by them in play); a bare Mk 18 in a teammate's hands is the old unsuppressed row, in yours
  the suppressed row with a bare report; the empty sponge load is still a stop on the launcher's cycle. NOT DONE: the player's suppressor is still
  DRAWN when the card has it off (the guns' look), the Team & kit figure does not know `sideCan` / `rings` (`host/kitView.ts`), a bare gun weighs
  what it did suppressed and sponge rounds weigh nothing (`kitload`). Never seen on a GPU; nobody has played it.
- **The dense kit card: guns side by side, a pop-up per gun, the kit in one line of tiles** (2026-10-20; `src/ui/kitDense.ts KITDENSE`, `ui/kitCard.ts`
  `MemberCardOpts.dense`; the maintainer on Team & kit beside a loadout card of Door Kickers 2: "this menu is pretty unwieldy, door kickers is a lot
  better. we shouldn't copy it but maybe we have a popup menu per gun, more information density, etc."). The picked man's card on the one starting page
  is the SAME card (the tree's rows, values, refusals, lent and idle tiles, copy and paste: nothing of the kit's rules moved) in another lay-out:
  one line of pouches and the two weight bars; THE TWO GUNS as tiles side by side (`.kc-guns`), each its drawing large, its name, the four bars, the
  mark that the tile opens beside the slot's name (`.kc-label::after`: the gun's own line is the sound mark's on a quiet mission), and
  what rides on it as CHIPS in the tile's corner (`.kc-chips`: lit where fitted or carried, a count on a round, faint where not, `lent` where the
  mission hands it); THE REST OF THE KIT as one line of small tiles (`.kc-gear`: the thing drawn, how many, its name; the arrows stand either side of the
  drawing on the tile the mouse or the keys are on); the colours and Reset · Copy · Paste a strip under it (`.kc-look`). A GUN'S TILE OPENS ITS OWN
  POP-UP (`.kc-pop[data-pop]`, under both tiles, over the kit): the guns the row offers side by side (`.kc-pick`), each with its drawing, name and the
  same four bars under one another, the one on the card lit, one the pouches have no room for dimmed with the reason as its tooltip; under them the
  gun's fittings and rounds, the tree's own tiles (`.kc-kids`; a tile with words beside its count, `lent` or `idle`, is two tiles wide). A press on a gun puts it on the card at once through `kit.ts kitPaste` (so it is fitted
  and refused as a paste is, and never steps through the guns between). SHUT BY: a press anywhere off it (a `pointerdown`: the kit figure eats the mouse event), Esc, Enter on the gun, the keys leaving the
  card. IT NEVER COVERS THE FOOT: `MemberCardOpts.floor` is the top of the host's foot (the loadout's buttons), and a pop-up that would pass it is
  drawn that much higher, over the foot of the guns' tiles (`kitCard.ts fit`, again when the window is sized or the page scrolls) — the maintainer's own window is about
  1000 x 673, where a Mk 18's five things are two lines. THE KEYS are the card's (W S move, A D change): shut, W S walk the tiles as they lie (guns, kit, colours, sets) and A D on a gun's tile is the
  next gun; Enter on a gun's tile opens its pop-up, where W S walk the gun and its things and stop at the ends, A D change. A gun's refusal is said on
  the card's own line, or in the pop-up while it is open (`.kc-pop-note`, which also takes a set's or a paste's refusal: the pop-up lies over the
  card's line). The chips and the tiles ask ONE rule what the mission makes of a row (`kitCard.ts given`: idle, handed, lent). A QUIET mission's
  wider cursor (`startpage.ts QUIET_CSS`) is drawn inside a dense tile, so no tile moves under the keys. The whole screen fits with nothing scrolled from 1200 x 675 up; a short
  window lowers the guns' tiles, one with room to spare (900 px tall and 1500 wide) draws everything larger. `MemberCard.pop()` / `.open(slot)` for a
  host or a check. NOT the older screen of its own (`?cards`), and not a card with the tree off (`?nokittree`): both keep the list. SWITCH: UI only,
  `KITDENSE.on`, on in the module; `?kitdense=0` on the address = the card as it was (the tree laid out in full). Nothing in the game reads it, it is in
  no recording and no knob table; like `KIT_LENT` it is on in the module, so a headless tool that opens the start page's loadout builds a dense card on
  its stand-in page on both stands (the rows and what they say are the tree's own, which is all those tools read). CHECK: the real page,
  `PORT=<port> node tools/qa/kitdense-page.cjs [outDir]` (20 lines: the lay-out, the chips, the pop-up by the mouse and by the keys alone, a gun put on
  and kept, the walk to Deploy, four window sizes for you and a teammate, a quiet mission's lent rounds, a quiet mission at 1000 x 673 and
  1200 x 675 — no tile moves under the keys, the pop-up ends over the foot —, the largest text size; `KITDENSE_BREAK=1` = the page with
  `kitdense=0`, fails 18 of the 20). `kittree-page.cjs` reads the tree's own lay-out, so it opens every page with `kitdense=0`;
  `kitpaste-page.cjs` takes the pouches on a line of their own as clear of Copy and Paste; `bigslot-page.cjs` reads the big slot as the last of the
  KIT's rows on a dense card (the colours' strip follows it); `kitview-page.cjs` opens a gun's pop-up before it clicks a row inside one. LEFT, the maintainer's calls: W S walk a line of tiles
  that lies left to right (the card's standing keys; a walk by the four directions would be a change of the screen's keys); a count's tile has no
  pop-up, only its arrows; in a short window the pop-up lies over the lower part of the guns' tiles. Seen only in
  headless Chromium on the software adapter: never on a GPU, nobody has played it.
- **The kit step says the job, and a tutorial mission teaches planning on it** (2026-10-22, the walkthrough moved onto a tutorial mission 10-23; `src/ui/kitBrief.ts KITBRIEF`, `src/ui/kitGuide.ts KITGUIDE`; the maintainer: "we should
  teach how to pick squad layouts! so maybe a tutorial on the gear page for a mission (that's skippable). honestly it doesn't make a ton of sense right
  now since you don't know anything about the objective or map when picking kit"). TWO THINGS, EACH ITS OWN SWITCH, both UI only (nothing under
  `src/game` reads either, no knob table, no journal key, no `FROZEN_HOLDS` row: they are mounted by `ui/startpage.ts` alone, which no headless stand
  opens; the one game rule beside them, a lesson's kit that can be picked, is `ISSUE.picked`). **THE BRIEF** (`?kitbrief=0` = the step's head as it was, the name alone): Team & kit keeps a band across its top — the mission list's own map
  sheet at the left with the way in marked (`.msheet > .mmap`; a click or M makes it large over the step with the name and the job under it, `.kb-cap`;
  again, Esc or Enter puts it back; the foot's key line gains 'M map' where there is a map to open), and beside it the name, what is set (`.mcsum`), the
  facts and the job (`.mblurb`), the list's own elements shown by this file's rules and no new sentence. It adds to the facts row WHAT THE PLACE ASKS OF
  A KIT, counted off the level's file by the plan's own fetch AS THE MISSION IS STAGED (`ui/missions.ts placeNeeds`, `Plan.needs`): the doors found
  locked, those of them that are steel, a rescue's hostages — a rescue's side door (`scenarios.rescue.side.door`) is unlocked by its staging and is not
  counted; the bundled office's rescue is read from `levels/office.scenarios.ts`. The cells are `.mfact.kb`, drawn on this step only; a count is a digit
  to five and a word past it (`countWords`), and the list's Defenders cell was drawn AGAIN by this file with its count in words ('eleven'; since 10-23 only under `?mystery=0`), the list's
  own cell hidden on this step. IN A SHORT WINDOW (800 px tall and under: the maintainer's own is about 1000 x 673) THE BAND IS NOT A PIXEL TALLER THAN
  THE NAME ALONE WAS: the map a small mark, the name, the facts under it, and no job sentence (no text is cut to fit: `textsize-page` holds that) — the
  job is read on the large sheet. `kitdense-page`'s bars (a gun's pop-up ends over the foot at 1317 x 775, nothing scrolls at 1200 x 675) are why.
  Under `?nogroups`, in a window under 900 px wide, or where the plan did not come there is no map on the step, only the words, and M is not taken.
  **THE WALKTHROUGH IS A TUTORIAL MISSION'S OWN PLAN** (2026-10-23; `src/ui/kitPlan.ts KIT_PLANS`, the engine `src/ui/kitGuide.ts`; the maintainer, of
  the walkthrough that first came up on every mission: "this tutorial is good but we should attach it to a tutorial mission (and make it bespoke and
  explain how to plan), not for the regular ones"). A REGULAR MISSION PLAYS NONE and has no word for one. The walkthrough is a SCRIPT (`GuideScript`:
  beats as data — the row a card sits by, its words for the step as it stands, what counts as done, the key it is remembered under, the word on the
  head, `auto` = played unasked), and the one played unasked is the plan written for one mission, the tutorial's squad mission ('A harder fight',
  `tut-squad`): the first the player walks into with the four, after the mission that had him throw each grenade by hand, on a street with what a kit
  is chosen for. Its row is the one lesson NOT played with the kit as issued (`game/kit.ts ISSUE.picked`, `docs/agents/missions.md`), so its cards are
  on the step. THE BEATS, each a small card beside ONE lit row, the rest of the step dimmed and still live, the keys put on the lit row, gone when its
  thing is DONE or on its 'Next': **Plan it first** (the map opened and put back — large, it names the street's rooms, the machine gun and the locked
  hall as words pinned on the sheet, `.kb-pin`, placed through the sheet's own projection: `planArt.ts sheetView`, `missions.ts sheetSpots`; and the
  line under it says what to look for) · **Pack for the rooms** (Stun heavy put on: the squad throws one into a room first when it has one to spare,
  it is sent into three rooms on that street by the lesson's own door lines, and the card counts what they carry now, three as issued, so nothing to
  spare — the step's own 'Squad carries' line stays in view under the row) · **The machine
  gun** (your own card opened: a frag goes over sandbags; Stun heavy took yours and one will be handed over, but pack your own, so a smoke canister is traded for a frag grenade — or, with one
  carried, 'keep it') · **The four** (a teammate's card opened) · **That's a plan** (Deploy; packed with no frag it says one will be handed over, which
  the page does, `kit.ts kitLessonPage`, and his card's frag tile reads '1 · mission's' on that step: `loadout.ts lentNow`). A beat whose row the step does not have, or whose thing is already so (Stun heavy on), is left out. THE WORDS
  follow the writing rules (`docs/agents/writing.md`): to "you", who presses the key; a count in a sentence is written out; no digit, no compass word.
  ENTER UNDER A CARD IS THE CARD'S 'NEXT' wherever it would otherwise deploy (every row but the named kits, the man's card and Deploy's own): a first
  press of Enter on a card never starts the mission. 'Skip' on every card, or Esc: the first Esc is the walkthrough's, the next is the step's own.
  Finished, skipped or deployed UNDER A CARD, it is not shown again, under ITS OWN key (localStorage `twopointsix.kitplan.tut-squad`: a browser that
  went through the general walkthrough has not been through this); THE WAY BACK is the word 'How to plan' on the step's head. NOT PLAYED UNASKED IN A
  BROWSER A SCRIPT DRIVES (`navigator.webdriver`, `KITGUIDE.driven`): every other page tool measures the step as it stands; the brief and the word ARE
  on their pages. THE SWITCHES: `?kitguide=0` = no walkthrough and no word on any step (that mission's cards stay) · `?kitguide=1` = played on this
  visit whatever the browser remembers, and ON A REGULAR MISSION the step's GENERAL walkthrough (`kitGuide.ts GENERIC`: the job · who comes · a kit for
  the squad · each man · his card · go; word 'How to pick', key `twopointsix.kitguide`), kept for comparing and played only so · `?kitpack=0` = the
  game's rule off: that mission as issued again, no cards on its step and so no plan. UI only but for that rule. THE SEAMS, in `ui/loadout.ts`:
  `LoadoutOpts.embedded.key(code, repeat)`, asked before any row of the kit screen (the map's M, and the keys that put the large sheet back);
  `embedded.rest(code, repeat)`, asked after the highlighted row and before the screen's own Enter / Esc (the walkthrough: an open gun pop-up's Esc
  shuts the pop-up first); `LoadoutScreen.kitName`, the named kit that is on ('' = a mix of the player's own). WHAT IT CHANGES AND KEEPS: the things it
  asks the player to do are real changes to the kit this machine keeps, and that kit is what the mission is then played with. CHECK:
  `PORT=<dev server> node tools/qa/kitguide-page.cjs [outDir]` — the real page in headless Chromium, no GPU needed, real keys and clicks at 1440 x 900,
  1353 x 770 and 1000 x 673: the brief's map, words and counts on the registry and the office's rescue, no digit above 5 among the facts, M, the short
  band no taller than the old head; a regular mission with no card, no word and a bare map; the squad mission's cards at its own four, the five words
  pinned on its large map (each on the sheet, clear of the others), every beat's card up beside its lit row, whole in the window and clear of the row,
  no digit and no compass word on it, put away by its own thing and not by another, the squad's line in view and counted as the card counts it, its own
  key, the word, both Esc, a browser that finished the general walkthrough still walked through, Enter as Next, a pop-up's Esc, the words with the kit
  as issued and with no frag packed, each switch, the general walkthrough under `?kitguide=1`, the handed frag read whole on its tile, a driven browser (148 PASS); `KITGUIDE_BREAK=1` = the
  walkthrough and the brief off: FAILS. The game's side has its own check (`probes.ts kitpack`, `docs/agents/missions.md`): the plan's marks lie in the
  level's rooms of those names, what its cards say of the kits is true of the kits, and the mission is played through on five kits. NOT SEEN: on a GPU
  (so never with the team's picture in the left column behind it, and the pinned words never over the sheet as a GPU's browser draws it), by a
  first-time player. (The Mission step's facts row wrote 'Defenders 11' as digits: since 10-23 no screen draws that cell, `MYSTERY`.) OPEN, for the menus' owners: a named kit a mission
  recommends (a field on its row, a mark on the Kit row's button) is not built for regular missions — only what the place asks is said. OPEN, for the
  squad mission's owner: its frame refuses the player's smoke and stun slots all mission, so of what he packs for himself only the frag is used.
- **The scene tweak panel (`?tweak`, a ONE OFF tool, 10-15) is not the debugger and not a menu of the game's** (`src/ui/sceneTweak.ts` the panel and its
  bookkeeping, `src/ui/sceneLayers.ts` the list, `src/render/shaderTune.ts` the shader half; the maintainer on a night clip of the snow pass: "could you make
  a one off UI for tweaking a scene like this? i'm curious what all the "layers" are for the effects and what variables we can configure"). Any link with
  `&tweak` gets a small panel (top left, drag it by its head, ▾ folds it): the picture's LAYERS back to front under Light · Ground · Air · Lens, each with a
  switch and, opened, its numbers on sliders, all live; `copy` puts the changed numbers on the clipboard by the code's own names with what they were, under the
  file each default lives in (shift = every number); `reset`, `none`, `all`. It changes NO default and is no switch of the game's: without the word nothing of
  it is made, and the kept copy (localStorage `twopointsix.sceneTweak.<level>`, one a level, put back only on a `?tweak` page so a restart keeps the hand's
  work) is never read. ONLY A HAND'S MOVE IS A CHANGE: a number the game itself moves later (the hour's exposure) is not copied and not kept; rows the quality
  ladder owns (march steps, sharpen, the particle caps) are not on the list at all.
  THE LIST IS BUILT FROM THE TABLES: `table()` makes a row of every number in an authored table (SNOWFX, SNOWWISPS, SNOWGRAINS, SNOWTRACKS, SNOWBLAST,
  SNOWBREATH, SNOW_SURF, AIR, AIR_SIM), so a number added to one shows up by itself, its hover text the table's own comment (`src/ui/sceneNotes.ts`, GENERATED:
  `bun run tools/gen-scene-notes.ts` after changing a table's comments; `--check` is red when stale and the check below runs it). `consts()` reads a look's
  WGSL constants out of the shader text (SNOW_SPARKLE_*, SNOW_GLOW_*, GRAIN_*, WISP_*, FLAKE_*); a move sets an override in `SHADER_TUNE` and rebuilds that ONE
  program (`LightingPasses.retuneComposite`, `Particles.retune`: both program sets through `ProgramSet.patch`, so cut boxes stay cut, unlike the `__hot*`
  hooks) — the shader FILES are never changed and with the map empty `tuned(text) === text`, the bundled text itself, which is what every check that reads
  program text sees; each owner skips a text it already runs, so only a ⟳ row costs a build, and that on release, not while dragged. A layer whose own switch is read at boot is switched off live by MUTING (its weight held at zero; the row and the copied text keep the
  hand's value); the lying surface alone reloads (`↻`, `?snowlook=0`). Rows marked ◆ are the few the simulation reads too (torches, the sky and moon, the storm's
  wind: they always were, on the debugger's own sliders) and `none` / `all` leave a ◆ layer's switch be; every other row is picture only. The fog of war is on
  the list for its SHADE alone (the fog is a rule; its switch stays on the debugger). A row's box takes a number inside the slider's reach or nothing. Marks: `›` reaches the next ones born, `⟳` rebuilds a shader (a
  short hitch). A NEW LAYER is one `layers.push` in sceneLayers.ts. The check: `bun run tools/qa/scenetweak-check.ts` (also `probes.ts scenetweak`; BOTH
  stands; `SCENETWEAK_BREAK=1` must fail) — the list, nothing written by making it, every number round-trips, mute, the text, one line of one program, the
  kept copy, the notes fresh, and 300 frames of the pass on two seeds with every picture-only number moved and every hand switch flipped: one digest. The page
  half: `node tools/qa/scenetweak-page.cjs` (software adapter: the DOM, real pipelines rebuilt and drawn with, a reload, a page without the word). Never seen
  on a GPU; nobody has judged a slider's reach by eye.
  - THE SNOW AS IT STANDS SINCE ONE AIR AND THE BLAST (10-15, after-close step): `Snow in one air` is a layer with a switch and no numbers — `SNOW_LOOK.oneAir`,
    read every frame, so LIVE here (shown where the particle shaders were built to read the wind sim). It and `Wind sim` are `mode` switches (how the air
    runs, not layers to hide): `none` / `all` leave both be, the copied text names one that is off. WHAT NOTHING READS IS DIMMED (`TweakVar.idle` /
    `TweakLayer.idle`, asked each refresh; `readWhen` throws on a row it cannot find): with the SWITCH on, the Blown grains layer and the blast's `throwS` /
    `throwShare` / `out` / `up` (the grains stand down on the switch, in force or not); with one air IN FORCE (`oneAirActive`: the switch and a field to
    ride), the wisps' `speedK` / `gustLen` / `gustPow`; not in force, the flakes' `airLow` / `airHigh` / `airLift` / `skid`, the wisps' `liftLo` / `liftHi` /
    `dropK`, the blast's `flakes` / `flakeUp` / `flakeLife`. A BLOWN MAN'S BREATH (10-19): while the hard breath rule is on (`character.ts HARDBREATH`,
    `?hardbreath=0`) the steam reads the rule's numbers, so the Breath layer lists both sets and dims the one nothing reads — the breath table's
    `everyHard` / `hardK` / `effortUp` / `effortDown` with the rule on, the rule's eight steam numbers (`blown every` … `wind back in`: `HARDBREATH.every`,
    `puffs`, `count`, `jet`, `size`, `carry`, `up`, `down`; lists `BREATH_SOFT` / `BREATH_HARD` in sceneLayers.ts) with it off. REAL STEAM (10-20): while the breath is gas in the smoke solver
    (`SNOW_LOOK.steam`, `?breathsteam=0`) the layer also lists `snowBreath.ts BREATHSTEAM`'s twelve numbers (`steam radius` … `steam reach`); it dims them
    when no solver is drawing (every breath is puffs then), and dims the puffs' own twelve (`BREATH_PUFF`: count, speed, spread, life, size, opacity,
    colour) when every man steams (`reach` 0). The layer's mute zeroes the steam's `density` with the puffs' `opacity`. The rule's switch and its
    four chest numbers are no rows: they move bones. The check's `breath` verdict runs the steam's emitter against a recording stand-in for the pool,
    rule on and off: a dimmed set moved files the same records, a lit one does not; the page check flips the rule in the page's own table
    (`window.__knobs`) and reads the rows both ways. The blast's `dig` / `digS` rows are held to 3 × and 5 s (the dig is asked again every frame for
    `digS`, and at the table's own 4 × reach a dig fifty metres wide cost 0.2 to 1.3 s a frame, measured headless); the check's digest run sends `digS`
    to its short end for the same reason (it was one to thirteen minutes of the run). A dimmed row still moves and still copies. `Blast marks` (Ground, wherever snow lies) is the
    SNOWBLAST table, its switch `SNOW_LOOK.blast` live (a blast reads it as it goes off), and the one BUTTON on the panel (`TweakLayer.act`): `blast` calls
    `snowBlastAt` three metres ahead of the player — the snow marked as a frag there would, no blast, no sound; the check's digest run presses it with the
    switch on. `FLAKE_WALL_IN` is a ⟳ row of Falling flakes (the CPU's copy of it in snowFx.ts is a check's, nothing in the page reads it). The check's
    tenth verdict (`oneair`) and the page check's own cover these; headless, one air is never IN FORCE (no pool, no field): the in-force dimming is the
    software page's to prove (its verdict is red unless the page opened with one air in force).
  - `Things mark the snow` (Ground; the snow goal's own layer, 10-15): the SNOWMARKS table, its switch `SNOW_LOOK.marks` live and a `mode` one; the mark's
    forming and kick numbers are SNOWTRACKS rows of Boot prints, the puff's motes WISP_MOTE_* rows of Blown wisps: all came by themselves. The panel step
    after it added only the layer's hover line and reaches held to what the comments say (0‥1 rows, whole-number rows); the check's `notes` verdict is now
    red on a layer with no hover line, so the next layer added by another hand cannot lack one.
- **The debrief calls a door what its level calls it (10-19, rides `WORDS.doors`).** A kicked, picked or keyed door's row was worded from the door's
  id ('kicked in the breakroom w door') while the squad's rows said the name its level wrote (`scenarios.doorNames`, `doornames.ts`). Now
  `chronicle.ts eventText(e, g)` and `fmtEvent(e, g)` take the game the row is of, and a door row asks `doorWrittenName` of that door WHEN THE ROW IS
  READ: 'kicked in the cubicles-side break room door', 'picked the lock on the …', 'keyed the code — the …', '… gave up the code to the …' (the written
  name is the whole name: no ' door' added to a 'yard gate', no possessive hung on 'double doors'). The row's DATA is untouched (the id, as ever): nothing
  in a checkpoint, a recording or a digest moves, and a row from before, a loaded checkpoint or a flipped key all read by the keys as they are now. No
  written name, the key down (`?doornames=0`), the words pass off (`?oldwords`), or no game behind the row (a tool printing a timeline with
  `fmtEvent(e)`): the line exactly as it was. So the frozen stand reads as it did (`TPS_WORDS=1 TPS_DOORNAMES=1` raise it), and the door names key is the
  switch: off = the card as it was. The card's two readers pass the game (`ui/debrief.ts`: the timeline's row, the map pin's hover line). NOT DONE: a
  door with only a MADE name ('hall-side mess door') still reads its id on the card: `doorWords` would also spell an unnamed door's bearing out ('vault
  west door'), and the card has no compass. Check `bun run tools/qa/probes.ts debrief-doorname` (families `debrief`, `words`: the stand's own keys
  first, then the keys by hand; `DOORNAMES_BREAK=1` asks for the name with the key down and is red) and a line of `debrief-dom` (the card on the fake
  DOM: the row and the pin), both stands. Only the office's two break room doors have written names so far, so that is where it shows.
- **A wall charge's rows on the debrief say a charge (10-19, rides `WALLKILL`).** A man at the charge when it went read 'shot dead (a wall charge)' and
  the player 'DOWN — the wall charge's round'. `chronicle.ts eventText` now words them 'killed — the wall charge' and 'DOWN — the wall charge' (a `by`
  that ends in 'charge' takes no 'round'); the rows' data is as the charge files it, every other kill and down row reads as it did, and the end card's
  own line ('by the wall charge') needed nothing. Both rows exist only with `WALLKILL` up, so its switch is theirs. THE KNOCK THROUGH THE WALL (older than
  `WALLKILL`, on both stands): a man or a civilian knocked out behind the wall it opened was filed and read as 'the takedown'. `chronDown` and
  `civilians.ts` now file the row's `method` as 'charge' from the charge's own line ('… behind the wall when it went') and the row reads 'out cold —
  the wall charge'. That is a row's data and words only (no tally, no digest: a digest holds a row's kind and time), and a Training lesson's
  'downed how: takedown' step no longer counts a charge's knock. A checkpoint saved before keeps its 'takedown' rows. Check
  `bun run tools/qa/probes.ts debrief-charge` (family `debrief`; the rows' own words, the same on both stands). Text only; nobody has played to it.
- **Options ▸ Game ▸ 'Walk into a wall to take it'** (10-20; `ui/options.ts`, shown only with the wall hold's feel pass on): flips `WALLSNAP.press`, kept in
  `twopointsix.options` as `wallpress`, a `?wallpress` in the URL wins over the kept value, Reset puts it back on. The rule: `docs/agents/stealth.md`, the
  wall taken without the key. The Controls list and the Options key list do not mention it.
- **Finding your own man, and the camera under the hand: twelve rows on trial in Options > Game (10-19; six, cut to four and back to five 10-20; the outline's width row 10-21, its strength, two light rows, teammates and colour 10-22;
  `src/host/findme.ts` the table, `src/ui/findme.ts` the ring, the rows and the outline's frame, `src/render/outline.ts` the outline's pass).** From a play test: a new player kept losing his own man on the screen, in the dark and behind
  walls, and reached for a camera that turns the other way and one that snaps behind him. The maintainer asked for settings to play with, none a new
  default, so THERE IS NO SWITCH AND NO `FROZEN_HOLDS` ROW: `FINDME` starts as `{ pan: 1, ring: false, outline: false, width: 1, opacity: 0.6, picture: true, lit: 0.3, dark: 0.12, picLit: 0.3, picDark: 0.12, mates: 1, colour: 0.6, turn: 1, behind: false }` on the page and on
  both stands, and at those starts the build is the build as it was (measured against the build head each time: the same game digest and the same
  view matrix over 15 s of a scripted hand, two seeds, free step and fixed, frozen and shipped). Kept per machine in localStorage
  `twopointsix.findme`, read once at load; Reset to defaults on the Game tab puts all twelve back. THE ROWS: `Aim pan` (a slider, none to today's: it
  scales `FollowCamera.aimLead` as built; none = he is the middle of the screen wherever the mouse goes), `Ring at your feet` (the gold ring the order
  menu draws, `PLAN.ringM * 1.35`, on at all times; it stands down while the menu's own is up: `PlanFloor.youOn`), `Turn direction` (the camera's key + mouse
  turns the view the other way: one function, `host/findme.ts ctrlTurn`, asked by the loop's orbit and by the engine replay's own Ctrl turn,
  `replay/engineplay.ts ctrlTurn`), `Double tap Ctrl` (named after the camera's key, `host/keymap.ts camCap`: it reads `Double tap Space` on the page
  while the Space bar is spare, and `watchCtrlTaps` listens for that key; two short presses, answered as the second comes up, bring the view round over about a quarter
  of a second to look where he looked at the tap; a hand's orbit, a pin, a show or a spectated man drops it; `TapTwice`: a press held is never a tap,
  nor one with another key, a button, the wheel or more than 12 px of orbit in it). The maintainer played them 10-20: "aim pan zero and turn
  direction reversed feel good"; whether those become the starts is his to say.
  THE DOUBLE TAP AND HIS AIM (10-20, from that play: "the mouse's position probably wasn't at 12 oclock, so the player rotates again after the
  camera rotates"): he faces the cursor's point in the world and the system cursor stays where it is on the screen, so left to that he turned AGAIN
  as the view came round. Now his aim is CARRIED with the view (`host/findme.ts AimCarry`, `carryStep`; the loop's `carryAim`, right before each tick
  samples its input): the game's cursor (`Input.mouseX / mouseY`: the aim ray, the reticle, the input record) is put where the point he faced at the
  tap stands on the screen, the same way out from his feet as he walks, until the hand takes the mouse up again: moved more than `CARRY.letGoPx`
  (10 px; less is a tremor), a button pressed, or any key off `CARRY_KEYS` (walking, pace, stance, light, goggles, reload and Ctrl hold it; any other
  key may read the cursor, so it gives the cursor back first). Then the cursor is the real mouse to the pixel before the tick reads it, and he turns
  to it. A button held since before the tap does not let go (a burst goes on to where it was going). It is input as data: the carried cursor is what
  the tick's record holds. WHAT THE PLAYER SEES THAT IS NEW: while the carry holds, the system's own pointer is not where he aims (it cannot be
  moved without pointer lock); the reticle is. Behind the same row, nothing with the row off. Truly owning the reticle (the system cursor hidden,
  ours moved from 12 o'clock on) is still the camera key's own work.
  THE OUTLINE IN THE DARK IS THE RENDERER'S (10-20). The first one, and a `Shape through walls` beside it, were drawn in the overlay's SVG from his
  joints, each limb a stroke as wide as a bare limb with a filter's rim round the lot, and were only ever looked at close in on the office level. From
  a squad level's distance an arm was two pixels wide and the outline was a stick figure's (the loop of his arms a box, his legs a zigzag); the
  maintainer's shots, and his word: "it should be a proper silhouette. if it's not really possible given our rendering pipeline we can just shelve the
  idea". It is possible: the G-buffer's id target (`gbuffer.wgsl`: `owner << 20`, on his skinned mesh and on every box emitted for him) says whose
  each pixel is. So `Outline in the dark` (off at its start) is now ONE PASS over the composite, after the fog of war and before the resolve
  (`render/outline.ts OutlinePass`, `shaders/outline.wgsl`; the one call in `render/passes.ts`): a blended triangle inside a scissor round him, in which
  a pixel that is not his takes a pale ink by how near the nearest of his pixels is (`OUTLINE`: 1.125 to 2.25 pixels of the composite by its height since 10-21, the
  outer pixel fading) and only from one of his that stands in front of it by the G-buffer's depth, so a wall top, a table or a teammate between him
  and the camera is not drawn on. His body, kit and gun are in it because they carry his owner byte; so do a round of his for the frame it leaves the
  muzzle and a charge while his hands set it, and they take the rim too. HOW STRONG is the light meter's word (`host/findme.ts outlineWant`: full at
  `Player.visibility` 0.12 and under, none at 0.3 and over as the rows start, none under the goggles), eased at 6 a second, taken whole on a frame with no time in it
  (the row flipped under the pause card shows at once). The page fills the frame once a frame (`ui/findme.ts findMeOutline`: off with the row off,
  the man down, and where the HUD's own marks of him stand down: a stun's white-out, attract mode, the kit's picture); `Engine.render` adds the box
  on the picture from the camera it draws with (`outlineBox`; he behind the lens = no pass), so a still or a card's settled frame has its own. WHAT
  IT COSTS: with the row off, nothing: the pass object is not made and `encode` is not called. First frame on: one bind group layout, a small
  uniform buffer, one small module compiled off the frame; until that is in, and for good if it fails (said once), nothing is drawn. On and he is in the
  dark: one render pass on the composite (load and store), a scissor of about a tenth of the picture close in and a fiftieth from a squad level's
  distance, up to 49 id reads a pixel inside it (81 with the width row at its most). No scene group, no storage buffer, no timer row (a render pass's stamp
  is left off here as the particles' draw's is). On and he is lit: no pass (BY THE METER; by the picture, below, it runs lit or dark and reads a
  copy of the composite). A kept line from the stick figure's days that says `outline: true`
  turns this one on. UNDER THE RESOLVE: the rim is drawn before it, so it is anti-aliased with the picture, and the pixel next to him rides his
  motion vector; the outer pixel has the floor's and may trail him by a few frames as he moves. Nobody has seen that on a GPU.
  ITS WIDTH (10-21, 10-22). The maintainer, having seen the rim on his GPU: "outline in the dark is good but can you add a slider to the options
  for the width? it's just a touch too fat"; and a day on, with the slider at its least: "can you make the outline slider go to zero? still large
  at 50%". THE RIM ITSELF IS A QUARTER THINNER than first built: `OUTLINE` is 1.125 to 2.25 pixels by the composite's height (it was 1.5 to 3);
  the quarter is a guess at "a touch", and it is in the rule, not in the row. `Outline width` IS A ROW (a slider under the outline's row, none to
  150 % in steps of 5; `FINDME.width`, starts at 1). Over 100 % the row multiplies the radius. UNDER 100 % IT SCALES WHAT THE RIM COVERS, not its
  radius: the shader fades the outer pixel (radius + 0.5 less the distance), so a rim of radius r covers r − 0.5 of a pixel beside him, and
  `outlineRadius(h, wide)` = 0.5 + (the rule − 0.5) × the row squared. Every step of the row is a different rim on any composite, finest where
  it is thinnest, down to none, where the frame is off and nothing is drawn; and no kept row under 100 % is drawn wider than before (the row
  first multiplied the radius and stopped at a floor of 0.9: on a short composite its low end did nothing, and on a tall one 50 % was still a
  whole pixel and more). A LINE IS NEVER NARROWER THAN ITS PIXEL: under one pixel covered, thinner is that pixel fainter, and a composite pixel is more than one
  of the screen's wherever the canvas is capped under the window. At most 3.4 pixels for him and 4 for anyone (`OUTLINE.capPx`): up to 81 id reads
  a pixel inside a man's scissor.
  HOW VISIBLE, AND BY WHAT LIGHT, ARE ROWS TOO (10-22): "can you also add a slider for how visible it is? i think it should probably fade in and
  out smoothly based on how lit up sam is -- sliders to calibrate that". `Outline strength` (`FINDME.opacity`, the ink's opacity at the full,
  none to 100 %, starts at 60 %: the 0.6 that was `OUTLINE.alpha`; none = the frame off), `Outline shows under light` (`FINDME.lit`, starts at
  30 %) and `Outline full under light` (`FINDME.dark`, starts at 12 %): the two ends `outlineWant` fades between, by the light meter, in the
  HUD's own LIGHT number; neither row crosses the other (each stops at it, so the number a row shows is the one in force; Reset writes both
  whole). The three start at the numbers the rim was built with; what he
  settles on is to become their starts, and FOR THAT THE STORE KEEPS ONLY THE ROWS THAT ARE NOT AT THEIR STARTS (`keep`; Reset leaves `{}`), so
  a start tuned later reaches every machine whose row stands at the old start (one put back there by hand too: rows on trial). A full line kept
  by an older build reads as before and is written again that way as it is read. WHAT HE CALLS ITS PULSING ("on levels like the block with the
  breaker thrown, the current pulsing of the outline really ruins the lighting. we'll tweak it") is the meter crossing those two ends as he
  moves: nothing in the pass moves with time but the ease. Both light rows at 100 % hold the rim steady; the strength row dims it.
  THE METER IS NOT THE PICTURE (his next line: "the light meter is a little funky. is it just measuring at a single point?"). It is asked at his
  chest and his head, the brighter kept; each is the brightest of six facings of shadowed direct light (one ray to each light's centre) plus the
  bounce (`probe.wgsl`, `Game.lightMeter`), eased at 6 a second, a frame or two late. So window light on one side of him reads lit while the side
  the camera sees is dark (no rim where one is wanted), and a dark man on a lit floor reads dark (a rim where none is needed). The meter is the
  guards' and is not to be bent for this; a rim that fades by how he is DRAWN against what is behind him is the picture's own job and is NOT
  BUILT (put to the maintainer as a choice).
  BY THE PICTURE, PART BY PART (10-22, an hour on, the rims in colour on his GPU: "these feel a lot better already"): "is there a way to make it
  so it naturally turns on for dark parts of the character and off for bright parts? that might make it feel less pulsey". `Outline fades by`
  IS A ROW (`FINDME.picture`: `Picture`, where it starts, or `Light meter`, the rim as first built). By the picture the meter is not asked at
  all: `outline.wgsl`, at every pixel beside a man, takes the mean light of the few pixels of HIS within the rim's reach off this frame's
  composite, makes of it a brightness on the screen (the exposure on, l / (1 + l), a square root: 0 black … 1 white) and fades the rim between
  two ends. A lit shoulder has no rim and the leg in shadow under it has one; nothing swings as the meter's one number crosses a line, and
  nothing is eased (the frame's `whole`: 1 but for the goggles). THE PICTURE HAS ITS OWN TWO ENDS (`FINDME.picLit`, `picDark`): the two light
  rows show and move the pair of whichever the row above says, so the meter's numbers are never read as brightness on the screen nor the other
  way; both pairs start at 30 % and 12 %, which were tuned for the meter and are a GUESS for the picture (a part darker than 12 % of white has
  the whole rim, one brighter than 30 % none). THE COMPOSITE IS READ FROM A COPY (the pass cannot read the target it draws on): `hdrCopy`, which
  GBAA already fills each frame before its edge blends and the fog; where GBAA does not run (render resolution at 100 %, TAAU off, its own
  toggle) `passes.setOutlineCopy` keeps that texture for the outline alone (the engine mirrors the frame's `on` and `picture` before resize, as
  it does the fog's switch; the composite's set is made again only when that changes what it holds) and `passes.ts` fills it just before the
  pass. A frame handed no copy goes by the meter. WHAT IT COSTS: by the picture the pass runs every frame the outline's row is on, lit or dark
  (by the meter it ran only in the dark), reads the copy only at pixels that are a man's, and without GBAA adds one copy of the composite a
  frame and its 8 bytes a pixel. NOT EASED, AND THAT MAY SHOW: a muzzle flash that lights him takes the rim for the frames it lasts; whether
  that reads as right or as a blink nobody has seen. Line (10) of the check holds the frame, the slot, what is bound and the two pairs; what
  the shader makes of the copy only a device can say: `findme-squad-page.cjs` counts the rims' ink on the software adapter with the rows at
  their most, at none, at their starts, and at their most again with GBAA put off. MEASURED on that adapter, one run, a squad of four stood in a dark room, strongly coloured pixels in the men's
  boxes: 1501 with the rows at their most, 66 at none, 1629 at their starts (men that dark have the whole rim; the resolve had more frames
  to gather it), 2442 at their most with GBAA off (the copy kept for the outline; that picture is not anti-aliased, so more of it counts), no
  GPU error in any. That is the ends and the two copies; NOT MEASURED: a man half lit, which is the case the row is for. `findme` is green
  on both stands, its break word red with seven lines. THE TWO COPIES ARE NOT THE SAME PICTURE: GBAA's is taken before its edge blends and
  the fog of war, the outline's own after both; the team's own men are never fogged and the blend moves edge pixels only, so the mean over
  a man's pixels is near enough the same. Nobody has seen any of it on a GPU, and nobody has timed the pass by the picture.
  HIS OWN ROWS when he said so (a screenshot, 10-22): width 25 %, strength 60 %, the light rows at their starts, teammates 80 %, colour 50 %.
  Not made the starts: he has not called them settled.
  HIS TEAMMATES HAVE RIMS TOO, AND THE RIMS HAVE COLOURS (10-22): "can you also add outlines for teammates + have a separate slider for thickness
  multiplier relative to the player? make the outline for the player yellow and for teammates red/blue and have a slider for saturation".
  `Teammate outline width` (`FINDME.mates`, none to 200 %, starts at 100 %; none = no teammate has a rim) and `Outline colour`
  (`FINDME.colour`, none = the pale ink the rim was first drawn in, 100 % = `OUTLINE_INK`: yellow for him, red for the red pair, blue for the
  blue pair, a duo's partner and a squad not in pairs; starts at 60 %, a guess). THE TEAMMATES' ROW IS A SHARE OF WHAT HIS RIM COVERS on the
  same picture, whatever his own width row made that (`OutlineMan.times`, `outlineRadius(h, wide, times)`: 50 % is half his, at any width; it
  first multiplied his row, which the curve under 100 % squared), never over `OUTLINE.capPx` 4, so his row at its most with theirs at its most
  stops there. WHO: the living men of his squad (`SquadOrders.men()`, the roster, whatever the orders menu is doing: a show's men too), each
  BY HIS OWN LIGHT METER (`Guard.visibility`, the unit's meter the hostiles' eyes read) through the same two light rows, each eased on his own;
  nobody else's man ever. The frame is the player's man plus `mates` (`OutlineMan`, a pool keyed by owner byte: a man dead gives his place
  up); `outlineBoxes` boxes each for the render's camera (a man off to the side whose box crosses the lens's plane gets an empty box, not the
  whole picture). THE PASS is still one render pass: a scissored triangle a man, each from his own 256-byte slot of one uniform buffer (a
  dynamic offset; `OUTLINE_MEN` 8 slots), THE TEAMMATES FIRST AND THE PLAYER LAST, so where two rims meet his is the one on top and in a crowd
  his place is kept. WHAT IT COSTS: five men are five small draws and one bind group; men stood close are each looked for in their own box, so
  where boxes overlap the id target is read once a man (a stack of five at a door: five times the reads over that patch, a few per cent of the
  picture). A machine that kept the outline on gets the teammates' rims and the colours at once (that is the ask: with `picture`, the only rows
  whose start is not the outline as first built); with the outline off nothing is asked of the squad's list. Line (11) of the check stands a
  squad of four up and holds all of it, on a device that writes down what it is asked (the layout's dynamic offset, a slot and a scissor a
  man), and that a squad stepped with the outline on ends digest for digest where it ends with it off. `tools/qa/findme-squad-page.cjs` is
  the real page's word on it (the four rimmed, the program in, a draw, no console line; stills to look at). Nobody has seen the colours on a
  GPU; the three inks were picked by number.
  Nothing reads these rows with the outline off; the page reads them every frame, so they move live under Options. Line (1) of the check holds
  what is kept; line (10) the rim's own width inside its two pixel counts, every step of the width row, the strength row and the light rows'
  ends; the page check moves every slider and takes width and strength to None and back. Nobody has seen any of them on a GPU.
  SHELVED STILL: `Shape through walls` (no row, no key; a kept line that names it reads without it). A proper one is him drawn once more with the
  depth test off into a mask and filled where a wall hides him: a pass of its own, to be built only once the outline has been seen on a GPU.
  ONE MODEL HOLDS: pan, turn and behind change the seat's view, which is the player's input and rides the record as data (`cmd.ts`), so a recording
  replays the view it was made with; the ring and the outline read his position and his light and write nothing of the game's (a run with both on
  and asked every frame is the run with them off, digest for digest: the picture's own, as the fog of war's pass is; no sense and no meter reads
  the composite after it). Checks: `bun run tools/qa/probes.ts findme` (family `ui`; `FINDME_BREAK=1` = the rows moved and the table not: pan,
  turn, behind, the carry, the ring, the outline and the teammates' must fail), the same on both stands: its line (10) runs the outline's pass on a stand-in device
  that writes down what it is asked (nothing while off, one program, no draw until it is in, a scissored draw, never after a failed program);
  `PORT=… node tools/qa/findme-page.cjs` (the real page on the software adapter: the rows exist, move live, are kept over a reload and reset; the
  outline's program compiles there and draws with no GPU error; a real drag with the camera's key held, a real held press, a real double tap with the mouse to one side
  and a real move of the mouse after it; the check asks the page which key that is, `__keys.camCap()`, looks for the last row under that name and
  presses that key, so it follows the page as it opens). NOT DONE: the Controls tab has no line for the double tap. The camera's key is the Space bar
  on the page while the board leaves it spare (`KEYMAP.camSpace`, docs/agents/player.md); under `?camspace=0` it is Ctrl as it was, and there a double
  tap is two more presses of it: on Windows Ctrl then W still closes the tab. NEVER SEEN ON A GPU by anyone here; how fast the view should come round,
  whether 250 / 300 ms is the right tap and 10 px the right let-go are first guesses in `BEHIND`, `TAPTWICE` and `CARRY`.
- **The camera runs itself: a double tap of the camera's key puts it on, the key held with the mouse or a walk key gives the view back** (`src/host/autocam.ts`,
  `AUTOCAM.on`, 10-23; the maintainer: "double tap space just turns on auto camera mode, and then space + movement disables to go to manual mode", and "the
  squad AI is already magical and just tapping Q feels amazing. i think we can do the same for the camera"). SWITCH: on in the page (`?autocam=0` = the page as it
  was; `?autoturn=0` = it never turns the view, `?autozoom=0` = it never zooms), OFF in the module and on the frozen stand (`FROZEN_HOLDS['AUTOCAM.on']`,
  `TPS_AUTOCAM=1`), in the knob registry and `JOURNAL_KNOBS` (a recording from before the key replays with it off). The MODE is not the switch: `AUTOVIEW.on`
  (`host/findme.ts`), off until the key is tapped twice, kept per machine (`localStorage` `twopointsix.autocam`), also the row "Auto camera" in Options > Game,
  which stands where "Double tap Space" stood (Reset puts it off). With the switch on and the mode never put on the game and the view are the build's, by run
  digest, on the free and the fixed step.
  WHAT MOVED: the double tap was the Options row "look where he looks" (`FINDME.behind`, off at the start). Now the tap puts the mode on AND brings the view
  round as that row did; with the mode on, a tap twice brings it round again. Under `?autocam=0` the old row is back.
  THE RULE (all in `autoRead` / `autoFrame` / `turnGoal`, called from `host/loop.ts camStep`, which only a tool that steps through `stepFrame` reaches):
  the look-at is his feet moved toward, in rising order, the middle of the room he is in, the door under his hand or the way out he walks at (and the floor
  past it), the squad's beat for a few seconds (a door order changing phase, a post newly given), the enemies he could shoot (hostile, in the picture, a clear
  line: never one `fogOfWar.hidden` says is hidden). It is held inside a box on the screen so he never leaves the middle (`sideM` / `awayM` / `backM`, scaled
  by the zoom), eased, and frozen while a mouse button is down. NOTHING LEANS ON THE CURSOR (the maintainer had already put the aim pan at none). The zoom is
  the hand's own, a little tighter in a room and in close-in, wider under the sky and in a fight, and out to fit what is framed; it never zooms in on a fight;
  the wheel under the key still zooms and that becomes the base. THE TURN: the view is the seat's input (walk keys and the aim ray are read through it), so the
  view turns by itself only with his feet still for half a second, no button down, no hostile man shown in his line (or within `nearM`, 9 m, in his line or
  not), no shot for three seconds, and at most once every 2.5 s, for two reasons: a wall stands between the lens and him, or what is framed lies on the lens's side of him. A walk key, a click, the hand taking the cursor back, or anything that would have stopped it
  beginning ends such a turn where it is. His aim goes round with the view (`AimCarry`); a long turn looks at his point past walls it did not look past before, so `carryStep` takes
  an `aimOf` and, where the cursor's ray would land off his line, puts the cursor on another point of that line (`CARRY.tries`, `CARRY.heights`): measured on
  a 141° turn beside a door, 0.01° off at the end and at the most on the way (it was 8° to 38° mid-turn before that). GIVING IT BACK (`autoHand`): the key
  held and the mouse moved more than 12 px inside 0.4 s, or the key held over a quarter second with a walk key down; two quick taps with a walk key held still
  put it ON. Going off, the zoom goes back to the hand's own. IT STANDS DOWN, the mode still on, under a pin, a show, a spectated man, plan mode's look point, the sky seat, a puppet, and with him down; it
  starts no turn while a lesson locks the camera or teaches the view. Sounds are NOT used: the sound list is every sound on the floor, enemy footsteps
  included, and a camera that leaned toward them would point at men the fog hides.
  CHECK: `bun run tools/qa/probes.ts autocam` (`tools/qa/autocam-check.ts`, 13 lines: the frame and the turn from made-up scenes; the mode on and off
  through `stepFrame`; a real door walked at and stood by; a real hostile man shown and fog-hidden; the stand-downs; three CONTROL lines: switch on and mode
  never on = the same digest and view, the scene read every frame and never used = the same game, the stand words and the journal). ALL PASS on both stands;
  `AUTOCAM_BREAK=1` (the switch left off) fails four of them on both. On the real page, software adapter: `PORT=… node tools/qa/autocam-page.cjs` (the row,
  a real double tap, the look-at no longer following the mouse, the key + a real drag, the key + a walk key, kept over a reload, Reset).
  `findme-page.cjs` now opens the page with `autocam=0` and `findme-check.ts` stands the switch off: their subject is the old row's double tap. One floor (the office), one seed. NOBODY HAS SEEN OR PLAYED
  IT, AND NEVER ON A GPU: every number in `AUTOCAM` is a first guess (how far it leans, how long it lingers on the squad, the turn's speed and its 2.5 s
  gap, the zoom range). KNOWN: with the mouse held still, a frame that leans or zooms slides the floor under the cursor, so his aim drifts a little toward
  where the frame went (worst with the cursor near his feet); the frame freezes under a held button for that reason. No HUD mark says the mode is on: the
  view coming round is the answer to the tap.
- **The auto camera may turn in a fight and on the move, smoothly: the sway** (`AUTOCAM.sway`, `src/host/autocam.ts autoSway`, 10-23; the maintainer, of
  the bullet above: "i think we could play with auto camera moving during battle so long as it does so smoothly. bonus points for being correlated with
  moment and reversible so it still feels somewhat connected to human control", and then "smoothness is the only thing that's mandatory"). SWITCH: on in the
  page (`?autosway=0` = the turn rule of the bullet above, only at rest), OFF in the module and on the frozen stand (`FROZEN_HOLDS['AUTOCAM.sway']`,
  `TPS_AUTOSWAY=1`); a key of the `AUTOCAM` table, so a recording from before it replays with it off (`journal.ts applyKnobs`). Nothing with the mode off.
  THE RULE: the yaw the hand left the view at is the anchor (`cam.yaw − A.sway`); the sway is a lean round it, a function of the moment and not a sum of
  turns. It leans toward the middle of the MEN OF THE FIGHT, so the fight comes up the screen where the picture is longest (`swayFight`, 0.6 of the angle to
  them, 38° at the most; a man of the fight is a hostile man the picture shows who was in his line within `swayLinger`, 2 s, so one stepping in and out of
  cover does not rock the view; men gone round behind the lens to the other side do not flip the side it took; their middle within 1.5 m of him leans
  nothing), and, while no fight asks for a lean, toward the side he moves to ("moment" was read as movement: `swayMove`, 14° at 2.5 m/s across the view;
  straight up or down the screen leans nowhere), 45° in all. SMOOTH IS THE BAR (his one hard rule): what the scene asks for is worked out ten times a second
  and eased (`swayEase`), the yaw goes to it by a critically damped spring (`swayHz`) whose speed is capped (`swayRate`, 11.5° a second), and every stop or
  change of mind goes through that spring or a decay: a mouse button down (its speed dies away over a fifth of a second, and it stays stopped 0.6 s after the
  button comes up, so tapped shots are one stop), a wall (it never goes to a yaw that puts a wall between the lens and him or a man in his line where the
  hand's own view has none; the share the walls allow falls at once and comes back only after a second clear), the view gone to plan mode or a show (it
  coasts to a stop and is where it was when the view is his again). REVERSIBLE: the cause gone, it comes back to the hand's yaw, to the bit; a turn the hand
  made meanwhile is kept. A come-round (the double tap) takes the view from it at once, and a turn at rest waits for it to be home. NOTHING CARRIES HIS AIM
  through it: the view turns slowly under a live cursor, and a held walk key bends his path at the same slow rate, as in any game whose camera follows.
  CHECK: `autocam` lines 14 to 16. 14, from made-up scenes: the lean and its first step (a seventh of the cap), home to the bit, the walk, a button and ten
  tapped shots, a wall and a wall that flickers, the kept side, one of two men in and out each second (3.5° of movement, the worst case: longer out than the
  linger), the men's middle beside him, a turn by hand mid-lean kept, the switch off; and over ALL of it no step past the cap and no step that differs from
  the one before by more than the spring can make it. 15: a real hostile man to one side through `stepFrame` on the fixed step (the lean, a second behind a
  wall and still a man of the fight, home when the fog hides him), and the same with the sway off: the yaw never moves. 16: the stand words and the journal.
  ALL PASS on both stands; `AUTOSWAY_BREAK=1` fails 14 and 15 on both. Lines 1 to 13 run with the sway off: they are the rule as it was. A second reader
  simulated the first cut and found a 2.9° jump at the snap home after a hand's tremor, rocking when one of several men peeked and a stutter under tapped
  fire: all mended, and the rate came down from 26° to 11.5° a second on that reading. Real page: `autocam-page.cjs` walks across the view with the mode on
  (the lean, the cap, home). One floor, one seed. NOBODY HAS SEEN OR PLAYED IT, NEVER ON A GPU: whether a view that turns under a held walk key and a live
  cursor is welcome in a fight is the maintainer's to say, and every number is a first guess.
- **The auto camera's numbers are the player's: a mode and rows on Options, gentle where nobody has chosen** (`AUTOCAM.tune`, the foot of
  `src/host/autocam.ts`, the rows in `src/ui/findme.ts autoRows`, 10-23; the maintainer, of his first play of the mode: "I was getting a little bit
  motion sick with my first test of the auto camera. I think it's from like having too much rotation ... come up with like a ton of different
  options of like modes or like sliders to configure in the settings panel, then we can iterate on that"). WHAT WAS FOUND IN THE CODE: a turn of
  the mode's own took a share of what was left each second (`turnRate` 5), so it BEGAN at its fastest: a quarter turn opened at about 450 degrees a
  second, and the double tap's swing (`BEHIND.rate` 12) at more than twice that. A turn at rest for the thing framed on the lens's side is also
  most of a half turn, each time he stops at a door the lens is past.
  SWITCH: on in the page (`?autotune=0` = every number the module's, the camera of the two bullets above, and no rows), OFF in the module and on
  the frozen stand (`FROZEN_HOLDS['AUTOCAM.tune']` and a row for each number gentle moves, `TPS_AUTOTUNE=1`; pinned in `host/standup.ts`). It
  rides `AUTOCAM`: a recording from before the key replays with the switch off and the numbers it has no word for at the module's, the ones it
  carries left alone (`autoTuneOld`, `journal.ts applyKnobs`). The view is the seat's input, so no recording and no digest can tell one tuning
  from another.
  THE MODES (`AUTO_MODES`; `AUTOTUNE.mode`): `free` = the numbers as built · `gentle` (THE START) = a turn at rest only for a wall that hides
  him (`restAhead` off), every turn of its own EASED (`turnCap` 30 degrees a second) and the double tap's swing eased too (`swingCap` 180), the
  fight's lean 15 degrees at 6 a second and none for the way he walks · `rest` = those turns and no lean · `never` = the view turns only by
  the hand and by the double tap he asks it with (the frame and the zoom go on).
  THE EASED TURN (`turnEase`, `host/loop.ts comeRound`): a critically damped spring with a top speed and a ramp up to it (`turnRamp` 0.6 s),
  whose rate is the top speed over `turnLand` (0.24 rad), so it starts from rest, brakes over the same angle at any speed, and lands without
  going past or stepping; a goal gone round to the other side, or a speed handed on from a faster turn, is braked no harder than a landing
  brakes. One ended by a walk key, a button or the hand's own turn dies away (`turnCoast`); one under way as the view goes to somebody else
  (plan mode, the sky seat, a show) ends there. Rules changed WITH it, and only where `turnCap` is over none: the hand's mouse does not end it
  and his aim is not carried through it (it is seconds long, and slow enough for the hand to follow, as the sway is; a quick turn as built
  still carries the aim and ends at the mouse); `gap` is counted from where an eased turn or swing is SEEN TO STOP (`turnSeen`, a degree a
  second: from where it began, a turn stopped midway began again at once; the last of its settling is not waited out). The swing in the mode
  goes by the same spring under `swingCap`: it keeps the aim carry (the tap is "look where I look"), a walk key does not end it (he may tap
  on the run, and walks an arc while it turns), a shot does, and the hand taking the view back ends it.
  THE ROWS, each read off the table and written through `setAutoTune`, a row over a mode kept only while it differs from the mode's own (the
  mode stays lit and its line reads "This is Gentle with your own changes below"): turn when a wall hides you (`rest`) and turn to face the
  door ahead (`restAhead`), each on its own; turn speed (`turnCap`; one notch past the fastest is "Quick", the share as built); wait before it
  turns (`still`); time between turns (`gap`); turn in a fight (`swayFightMax`, to `swayMax`; at none a fight leans nothing for his walk
  either); lean when you move sideways (`swayMove`); lean speed (`swayRate`; over the speed as built the sway's spring is that much stiffer, or
  a small lean never reached it); swing when you double tap (`swing`: off, the tap that puts the mode on turns nothing); swing speed
  (`swingCap`, "Quick" as above); framing (`leanK`, a share of every lean of the frame, to none); framing speed (`lean`); zoom (`zoomAmt`, a
  share of how far the zoom leaves the hand's own, to none); zoom speed (`zoomRate`); stay on the squad (`beatSecs`). A slider's ends are
  `AUTO_RANGE`, in the table's units; the notch a mode's own number shows as puts back that number.
  KEPT PER MACHINE (localStorage `twopointsix.autotune`: the mode and the rows over it; nothing where it is the start), read once as the
  module loads: a line whose mode this build has not is not read at all, a key of the wrong kind is dropped, a number is held to `AUTO_RANGE`.
  Reset on Options puts the start back. `?autoturn=0`, `?autozoom=0` and `?autosway=0` still stand over all of it.
  CHECK: `autocam` lines 17 to 20 (lines 1 to 16 run with the tuning off, on the numbers as built), both stands, `AUTOTUNE_BREAK=1` red on 17,
  18 and 19: the modes, what is kept and what is refused; gentle's turns and each reason on its own row; the eased turn (from rest, under its
  top speed, no step, there without going past, every notch a quicker turn, ended midway it dies away); the sway's two mends; the two shares;
  and through the whole Game on the free and the fixed step: the swing off, the swing eased, a shot ending a slow swing, a wall's turn tick by
  tick with the mouse moved in the middle of it, a walk key ending it, and the next turn waiting out the gap from there. Not in a line: a turn
  under way as plan mode opens, and an eased turn meeting a lean of the sway's (lines 17 to 19 run with the sway parked off). `tools/qa/autocam-page.cjs` drives the real page:
  its old lines under `?autotune=0`, then the page as it opens (a real double tap's swing frame by frame, the rows, a mode clicked, rows slid,
  a reload, Reset; `ONLY=tune` for those alone).
  MEASURED (one floor, one seed, headless): a wall's 45 degrees at 10 / 20 / 30 / 40 / 60 / 80 / 100 / 120 degrees a second takes 15.4 / 8.0 /
  5.5 / 4.2 / 3.0 / 2.4 / 2.0 / 1.7 s, the last part of each a slow settle; its first step is 2.8% of the top speed's, where the turn as
  built covered 10 degrees of a 120 degree turn in its first frame; a half turn of the swing at 180 degrees a second takes 2.0 s; a walk key
  at 30 degrees a second leaves 2.5 degrees more.
  NOT DONE: nothing on the HUD says the mode came on when the swing is off; the springs of the sway and of the turn are two copies of one
  idea; a recording played back writes its own numbers into the table until the visit ends (the mode's line then says they are not the
  mode's). The modes' numbers are FIRST GUESSES for his hand to settle (a row he settles on becomes a mode's own). Never seen on a GPU.
  NOBODY HAS PLAYED IT: whether gentle is calm enough, and whether a slow turn that does not carry his aim reads right, are his to say.
- **The auto camera comes in on a man he sneaks up on: the soft lock** (`AUTOCAM.lock`, `src/host/autocam.ts` read and frame, 10-23; the
  maintainer, of a review of Chaos Theory's "closer than ever" chapter: "there's definitely stuff for the auto camera mode to learn"). WHAT THE
  REVIEW SAYS OF THAT CAMERA (from a machine's rough transcript of its narration, so in our words): with an enemy on screen the camera shifts
  its focus to him, more strongly the nearer the player gets, as if softly locked on, and most players never notice; in a narrow hall it shifts
  to the side he is not on to show what is ahead; at a corner it moves out a little to see round it. WHAT WAS FOUND IN THE CODE: the mode leaned
  the frame half way to the middle of the men he could shoot, never came in on a man in his line ("it never comes in on a fight"), and a held
  button stilled the frame, so through the whole of a stalk (the held click) the camera did nothing.
  THE RULE: the man he is stalking (`game/stalk.ts`, while its click is held), or else the nearest hostile man the picture shows in his line
  who is not `alert` and whom he could take (`close.ts closeSubject`; one searching counts, as for a stalk), is the lock's man from `lockM`
  (8 m) in. The man it has is kept until another is `lockStick` (0.75 m) nearer and through `lockLinger` (1 s) out of his line (a pillar he
  passes). NOBODY is the lock's man in a FIGHT: while any hostile man is alert, in the picture or not, and for `lockCalm` (4 s) after; and but for a stalk
  nobody is while he is not sneaking (the close-in mode's list less the wall hold: the rifle up, a sprint, a body in tow, a kick, a lock, the
  wand, hands at work; and a throw being aimed. The list is kept by hand beside `close.ts modeNow`). Its strength goes from none at `lockM` to full
  at `lockNearM` (2 m), eased (`lockEase`). By that strength the frame goes from the middle of the men he could shoot to the middle of the two
  of them (`lockK`), and the camera goes from where it would be toward the lock's own distance: the place's zoom less `lockIn` (40%), never so
  near that another man he could shoot leaves the picture's reach (`fitMost` stands; a door ahead and the squad's beat hold the zoom out under
  it, not the lock in full). The zoom as it was is worked out untouched under it (`A.goal`: the place's own zoom, the band; the lock's is
  `A.lockTo`), so it begins with no step under the sky and in a room alike. `lockIn` goes by the hand's share of the zoom (`zoomAmt`): with
  either at none the distance is as it was to the bit. One rule of the zoom gives way to it: "it never comes in on a fight" holds the zoom
  out while any man is in his line, and the lock's man lets it back in by the lock's strength (else a zoom gone out to fit men earlier would
  starve it). A man out of his line for the linger, or stalked from behind something, is framed as he was in it. A man he holds keeps the
  camera in close (the close-in mode's zoom under it) and leaves the frame as it is. A held button stills it as it stills the frame (the
  strength, and the share it takes: the men he could shoot are still kept in the picture), but for the held click of a stalk or of the wait
  at a corner (it aims at nothing; the wait is read off the stalk polish's own picture, `stalkWait`), a man in his arm, and letting go once a
  fight has begun (a stalk the man broke, the button still down: the camera goes back out; a man shot under a held aim with nobody onto him:
  it waits for the button). A fight stamped ahead of the clock (a checkpoint loaded) is none. The view gone to somebody else (plan mode, a
  show): the lock lets go at once and the distance is the zoom's own (`autoRest`).
  NO TURN is added: it moves and zooms the frame only.
  SWITCH: on in the page (`?autolock=0` = the frame and the zoom as they were), OFF in the module and on the frozen stand
  (`FROZEN_HOLDS['AUTOCAM.lock']`, `TPS_AUTOLOCK=1`; pinned in `host/standup.ts`). It rides `AUTOCAM`; a recording from before the key replays
  with it off (`journal.ts applyKnobs`). The view is the seat's input: no digest can tell it on from off.
  ROWS (under the tuning's, only with the lock on): "Zoom in when you sneak up" (`lockIn`, none to 60%) and "Start zooming in from" (`lockM`,
  4 to 12 m). They are numbers of every mode, kept as the tuning's rows are.
  CHECK: `autocam` lines 21 to 23, both stands, `AUTOLOCK_BREAK=1` red on 21 and 22 (`AUTOCAM_BREAK=1` on 22 too). 21, the frame function:
  the frame and the zoom by the lock's strength from rest with no step; the place's zoom at 1.15 and at 0.92; a plain held button, a stalk's,
  and the button still down with his man gone (kept in close with nobody onto him, let go in a fight); two men with the lock's share told
  apart from the fight's; a man in his arm; a second man kept in reach and a door ahead that does not hold it out; `lockIn` at none and
  `zoomAmt` at none and at a half; the zoom held out for a man in his line as it was (no lock's man, a fight, the lock's zoom at none, the
  switch off: the last two to the bit) and let in by the lock's man; his man out of the line framed as in it; the view gone to somebody
  else. 22, the
  whole Game on the free and the fixed step: a man stood at the end of a clear line and closed on in stages, a button held as he is moved back
  out, a second man 0.4 m and 1.5 m nearer, the stalked man over the nearest, a man in his arm, half a second and a second and a half out of
  his line, the rifle up, a body in tow, the corner wait's click, the man onto him, the calm after, and a fight stamped ahead of the clock.
  NOT in a line: a real stalk begun by the held click and a man really held (the lock is handed its man), and a walk up to him past a door
  (he is put there in stages). `tools/qa/autocam-page.cjs` (`ONLY=tune`) does 9 m and 3 m on the real page.
  MEASURED (one floor, one seed, headless, the frozen stand): the hand's distance 21 m; at 8 / 7 / 5.5 / 4 / 3 / 2 m from him the camera at
  20.6 / 20.0 / 17.5 / 14.3 / 12.5 / 11.7 m (the page's stand ends at 10.2 m: the close-in mode's own zoom is under it there); a button held
  and he 6 m off again: 15.8 m, 17.0 once it is up.
  NOT DONE, from the same review: the corridor's side shift and the move out at a corner (the frame already leans to the room he is in and to
  the door ahead; neither was built or measured against these); his head turning to the man is the sneak's, which may ask the camera for its
  man (`autoLock`). KNOWN: the hand taking the view back in the middle of a sneak puts the distance back to the hand's own, as it always did,
  and from full lock that is a long way out (eased by the camera's own damping); a stalk's click still held after its man is lost with
  nobody onto him is a plain held button, and the camera stays in until it is up; with the stalk polish off the corner wait's click is a
  plain button too. Nobody has played it, and it has never been seen on a GPU: whether 40% is too much, and whether coming back out when a man turns on him
  reads as a lurch, are his to judge.
- **A mission's page loads behind that mission's brief and waits for Start** (2026-10-19; the maintainer, after watching a first-time player: "having
  the loading screen make more sense (e.g. being a pre mission brief) that you then click through rather than flashing the controls"; that player's
  notes: "stay on loading screen longer, would like to read"). `src/ui/loadbrief.ts`. BEFORE: a page whose address names a mission booted behind the
  old start card's look-alike (`ui/menu.ts bootCard`: a grey Start, the notes, the whole controls list, the shader count) and the mission began under
  it the moment the boot was done. NOW that page shows the mission, in a layer of its own (`#brief`, z 30: over the menu and the list, under the
  options and the fatal card): the heading it is listed under, its title, place and one line, the sheet's three cells (Team AS DEPLOYED, Defenders,
  Approach), THE MAP of its level (below; the file did not come = the words alone), and ONE block, START, which fills by the boot's own status line and is
  live when the boot is done. Every word is the mission list's (`briefOfQuery`: the row its address boots; deployed at a size no row has, the row of
  that kind on that level; `?solo` alone = the solo night; NONE for an address that picks its level by `?level=` — the editor's own level plays the
  moment it loads, under no other level's words); the only words that are the screen's own are Start, Enter, Controls and Back. IT STAYS
  UNTIL STARTED (a click on the block, Enter or Space) with the world stood up and held still behind it — `main.ts`: `briefHolds()` is one more term
  of the loop's `frozen`, as under the pause card, the quality ladder takes no sample under it, and it counts as a page that hides the view
  (`viewCovered`: the frame is not drawn behind it once the warm-up frames are) — so the run's first tick, its try and its par
  clock are the player's, and the first frames' warm-up is spent behind the brief. A PRESS WHILE IT BOOTS IS KEPT (the block sits pressed in) and the
  run starts the moment it can: the brief never adds wait. A second press takes it back, and so does opening Controls: the run never starts under a
  page the player is reading. The keys are the brief's while it is up (its listener is first at the window: no game key
  and no pause-card Esc is read under it); CONTROLS opens Options ▸ Controls over it (where the keys are from every other screen; shut, the focus is START's), BACK / Esc is a
  page load of the address a quit of that mission leaves, onto the list. It is a layer of the game's text size (`#brief` in `ui/textsize.ts LAYERS`:
  drawn at the window's factor and the player's step like the menus; its viewport units are divided by the factor and its `@media` are px, by that
  module's rule — it had a scale of its own for a day, `--u`, which is gone). NOT FOR A PAGE NOBODY SITS AT: none is made under `?paused`, a replay's tape, `?kitview`'s window or a benchmark's scene; one that is up is
  dropped unstarted at the boot's end on a muted test rig (`?mute`), for a show, for a mission whose start was refused (the start card says why), and
  at the loop's next step once a hook that drives the game is called (`__runFrames`, `__mouse`, `__click`, a save or load; NOT one that only
  shoots the page: `docs/agents/qa.md`); the headless harness never comes through `main.ts`. A restart, a
  checkpoint and the next try are not page loads and show no brief. A TUTORIAL mission's brief also carries its row's `scene` and a 'You will learn' list (`teaches`): `docs/agents/missions.md`, the opening card. SWITCH `LOADBRIEF.on` (`ui/loadbrief.ts`): ON in the page, `?loadbrief=0` = the
  boot card and the straight start as the build was; OFF in the module, a page-only screen like `START_PAGE` — no game rule reads it, no knob table
  or journal carries it, no `FROZEN_HOLDS` row: both stands are the build as it was, there being no code of it on either. WHO OWNS WHAT IN THE BOOT:
  this screen is the card line, its branch of the READY block, the `frozen` term, the ladder's guard and its word in `viewCovered` in `main.ts`; when the level is READY
  (`gpu/device.ts`, `engine.init`, `ui/boot.ts`, the status text — keep 'N / M' in it, the brief's fill reads it — `__ready`) is the boot's own.
  CHECKS: `bun run tools/qa/probes.ts loadbrief` (family `ui`; `tools/qa/loadbrief-check.ts`: all 37 rows' words off their own addresses, the screen
  and its hand-over on a fake DOM, `main.ts`'s wiring as text, the switch off on the stand; green on both stands, `LOADBRIEF_BREAK=1` red on both) and
  `PORT=… node tools/qa/loadbrief-page.cjs` (the real page, one job for each kind of mission and one Training lesson, each started another way, then
  `?loadbrief=0` and the automation boot; it runs the page's frames undrawn unless `REAL=1`). MEASURED 10-19 on the software adapter
  (frames undrawn, 1024 x 576, verylow, about 5 minutes a boot): 8 of 8 PASS, no page error — night breach (Enter), the depot room clear (a click),
  the registry rescue (a click made while it booted: kept, started by itself), the counting house quiet (Space), Training 1 (Controls opened, Esc,
  the focus on START, Enter), the solo night (a script's `__runFrames`: the brief gone, its 3 frames run), `?loadbrief=0` (no brief, the old card's
  14 control rows, the run under way unpressed) and `?paused&mute` (no brief at any point); in each brief job the game's clock stood at 0 across
  the hold and ran after the start, with no key left held and no pause card. Night breach was also run once with its frames DRAWN (`REAL=1`,
  about 9 minutes after the boot) before the review's mends: the same verdict. The brief's buttons were also driven in a page with no GPU boot at
  all (a press kept, taken back by a second, taken back by Controls; a chorded Esc opens nothing; `?level=local` and `?loadbrief=0` show the old card).
  NOBODY HAS SEEN IT ON A GPU OR PLAYED IT: the brief itself is plain DOM and was looked at as Chromium lays it out at 960 x 540, 1280 x 720, 1920 x
  1080, 2560 x 1440, 3440 x 1440, 3840 x 2160 and a 700 px wide window; how long the hold feels, the fade into the first frames, and the sound that
  starts on the press are unjudged.
  THE MAP, NOT THE PICTURE (10-20; the maintainer on the first cut, seen on his own machine: "better but let's show the map vs. the (kinda low res)
  level art"): beside the words is the mission list's own map sheet of the level (`ui/missions.ts drawMissionMap` → `drawPlan` / `ui/planArt.ts
  drawSheet`: the place as a model, a 10 m scale, the way in the address asks for marked as the list marks it — `wayOfLink`, one fold for the list
  and the brief), chosen over the flat plan and the maps of play because it is the one that shows the ground and where the team starts before a run
  exists. It is the level AS THE PAGE LOADS IT (`scene/look.ts lookLevelFile`: the dressed file under the default look, the plain one under
  `?look=plain`; the list's own sheet still draws the plain file), so the furniture on the map is the furniture of the run, and the file is the one
  the boot fetches anyway. It is drawn in the screen's own pixels (the canvas is its shown width × the text size factor × the device's pixel ratio,
  480 to 2880, redrawn on a resize or a text size step), so it is sharp on a dense screen where the 760 px picture was not; its box is the sheet's
  40 : 28 at the largest width the column and the window's height leave, so nothing of it is cut in a short window or letterboxed in a narrow one;
  a file that did not come is asked for again at the next resize; the canvas's pixels are let go when the brief goes. The mission pictures
  (`ui/menuStills.ts`) are no longer shown here; the cards keep them. KNOWN: a window dragged to a screen of another pixel density with no resize
  keeps the old density until one; the parsed level stays in the list's plan cache for the page's life, as it does after a visit to the list.
  CHECKED 10-20: the probe's map line on both stands (the level's file by the stand's look, the way in exact, the sheet's shape, its pixels let
  go); laid out in a real browser page (no GPU boot) at 1300 x 780 at 2 device pixels, 1920 x 1080 (dressed and `?look=plain`), 3840 x 2160, the
  largest text step, 1920 x 700, 1400 x 480, 700 x 900, 820 x 600, and with the level's first fetch failed then a resize — the canvas is the shown
  size in device pixels (or its 480 floor) each time, inked, inside the window, nothing scrolls; `loadbrief-page.cjs` holds the same on the booted
  page (software adapter, 1024 x 576: night breach, the depot room clear, the counting house and Training 1 PASS with the map of their own level
  drawn at the shown size; the registry rescue, started early, PASS). The map on the brief has not been seen on a GPU page or by the maintainer yet.
- **The game has its own text size, and the page no longer zooms** (`src/ui/textsize.ts`, `TEXTSIZE.on`, 10-19; a play test on a 3840 × 2160 screen:
  the words were too small to read, the browser's zoom keys grew the page until the layout broke, and the mission select's names were cut). ONE FACTOR,
  `--tz` on the root (which wears the class `tsz` while the switch is on), drawn as CSS `zoom` on every layer of the page that carries words (`LAYERS`:
  the menu, the Play page, the options, the fight screen's read-outs, the marks over the picture, the debugger; never the picture's canvas). WITH NOTHING
  CHOSEN it is the window over 1920 × 1080, never under 1 and never over 3: 3840 × 2160 draws at 2, 2560 × 1440 at 1.33, 1920 × 1080 and anything
  smaller as it always did. A page zoomed from the browser's own menu is a smaller window, so the words stay the size they were. THE SETTING is Options ▸
  Graphics ▸ Display ▸ Text size: five steps drawn as the letter at each size (0.85, 1, 1.15, 1.3, 1.5 times the window's), live while the page boots,
  kept per machine (localStorage `twopointsix.textsize`, the step's index; nothing kept = the window's; Graphics ▸ Reset forgets it). A step never
  takes the layout under 1200 × 675 of its own pixels (the smallest window the screens hold whole at, measured with the page check on the build before):
  where the largest step asks for more room than there is, the larger steps share what there is (1366 × 768: 1.04, 1.08, 1.14; 1280 × 720: up to
  1.07), and on a window of 1200 × 675 or less they do nothing. THE KEYS: Ctrl or ⌘ with + and − step it from anywhere, with 0 it is the window's
  again; those chords, Ctrl + wheel and a pinch are taken from the browser (Ctrl + wheel over the picture is still the camera's).
  FOUR THINGS A ZOOMED LAYER DOES NOT DO BY ITSELF, and a new screen has to: a viewport unit in a layer is written `calc(25vw / var(--tz, 1))` (the
  check is red on a bare one in `index.html` or `src/ui`); an `@media` width or height is rewritten by the module to ask for px × factor (also when a
  style sheet joins later, one microtask after it joins), and a script asks `uiMatch('(max-width: 720px)')` in place of `matchMedia`; a rectangle a
  script measures off a zoomed element is in window pixels and one it writes into a layer is in the layer's, so divide by `rectZoom()` (the speech
  bubbles' blockers, the debugger's tooltip, the kit picture's width), and a size read off the window or the picture's canvas by `textZoom()` (the
  overlay's marks, `uiSize()`); a 2D canvas inside a layer multiplies its device pixels by `textZoom()` or it is stretched (the kit figure, the
  debrief's map, the wind graph do). A new layer of the page joins `LAYERS`. The replay player's own bar, map and sound lanes are NOT layers (they
  stay the size they were); its rules that move the fight screen's read-outs clear of them divide the bar's window pixels by the factor.
  THE MISSION SELECT'S CUT NAMES (the play test's other note) had a cause of their own: the grid of cards has a fixed height and its lines shared it,
  so on a tall window with few lines the picture (16:9 of a wide card) took the whole line and the name and tags hung out under the next line's picture;
  at 3840 × 2160 no name could be read, at 1920 × 1080 the tags were cut. With the switch on a card's line is `minmax(0, 1fr) auto auto` with a floor of
  the picture cropped to 2:1 plus its captions: the picture gives way before the words do, then the grid scrolls. The screen's look at 1920 × 1080 and
  under is otherwise as it was; with the switch off it is the build before to the rectangle.
  SWITCH: ON in the page, `?textsize=0` off (no factor, no class, no row, the browser's own zoom keys, every rule as written; `var(--tz, 1)` is 1), OFF
  in the module, never in the Team & kit picture's own window. It is a look of the page, not a rule of the game: nothing under `src/game` reads it, it
  is in no knob registry, journal or digest, the headless harness never boots it, so there is no stand word and no run can move. Hook `window.__textsize`
  (`on`, `zoom`, `step`, `set(i | null)`, `layers`, `table`, `want(w, h, i)`, `media()`). CHECKS: `bun run tools/qa/probes.ts textsize` (family `ui`:
  the factor's table, the browser-zoom invariance, the floor and the shared room, the media rewrite, the keys, the lints; `TEXTSIZE_BREAK=1` fails,
  the same on both stands) and the real page, `PORT=<dev server> node tools/qa/textsize-page.cjs [outDir]` (`WAS=<port of a server of the build
  before>` holds `?textsize=0` to it; `GPU=1` adds the pause card and the fight screen on the software adapter; `TEXTSIZE_BREAK=1` fails).
  MEASURED 10-19 in headless Chromium with no adapter: at 3840 × 2160, 2560 × 1440, 1280 × 720, 2560 × 1440 at 1.5 device pixels and 1920 × 1080 at
  2, and at the largest and smallest step, no text cut or covered on the title, the six groups of the mission select (33 cards), Team & kit or the
  options, and every `@media` rule asked at its px × factor; the row, the keys, the wheel, the kept step across a load; `?textsize=0` at 3840 × 2160
  equal to the build before in 588 text rectangles. On the SOFTWARE ADAPTER, one boot of the solo night at the three sizes: the kit, the meters and the
  objective inside the window at the window's factor, the aim ring over the same point of the picture at the largest step as at none, the options
  over the pause card whole (the pause card's run tally already ends three long labels in an ellipsis at 1280 × 720 on the build before; the check
  holds the card to that). NEVER SEEN ON A GPU, and nobody has played it: not the sharpness of the words or of the three canvases, not the kit
  picture's window inside the zoomed Play page (no adapter here draws it), not a real pinch or a real Ctrl + wheel. Chromium only: Safari was never
  run (the boot asks the engine which pixels it measures a zoomed element in, and that answer has only ever been Chromium's). The replay player was
  not run with a tape after its six rules changed.
- **Options ▸ Controls rebinds the keys (10-21; `src/host/keymap.ts` the table, `src/ui/keybinds.ts` the caps, the remap itself in
  `src/game/input.ts`'s keyboard listener).** The maintainer: "could you add key remapping (plus reset) to settings? that way i could tweak
  settings without a rebuild". WHERE IT SITS: at the keyboard and nowhere else. The listener asks `gameCode()` what a key IS before it files it,
  so the game still asks for the codes it always did and the tick's record, the session journal, a run's tape and a replay hold those codes:
  a recording made on a rebound board plays the same on any machine. It is no rule of the game: no knob table, no `FROZEN_HOLDS` row (the
  harness's Input has no keyboard), and OFF in the module, so a headless tool, the level editor, the viewer and the workbench keep the
  build's keys whatever the machine has kept; the game page turns it on in `main.ts`'s first line (`keysBoot`). OFF ON THE PAGE:
  `?keybinds=0` (the build's keys and the plain list for the visit, the kept table left alone). KEPT in localStorage `twopointsix.keys`
  (only rows not as built; cleaned row by row as it is read). PAGE HOOK `__keys` (the module: `bindKey(id, code)`, `resetKeys()`,
  `keysKept()`, `setKeys()`). WHAT MOVES: the 26 rows of `KEY_ACTS` (W A S D, Shift, C, Q, Space, V, N, R, Z, L, E, 1 to 5, X, B, T, F, G, H,
  the backtick). It is the KEY that moves, not the verb: E still puts away and swaps a hold, V still whistles and is the order menu's wand
  row, the digits are the kit and the menu's rows. H and G (rows of the order menu on letters) got rows on the list so that a key given to
  another row is never theirs unseen. WHAT STAYS: the mouse and the wheel, the camera's Ctrl, and the page's own keys, which no row can take
  (Esc, Enter, Tab, the arrows, the F row, Ctrl / Alt / Cmd, P [ ], Caps Lock). THE SCREEN: a movable cap is a button (the fixed ones are
  drawn hollow); a click, or Enter on it (W S walk the caps), and it waits for the next key. A key another row has SWAPS the two and the
  other cap flashes (a row with two keys in the build, Shift, keeps its other one); with no key to give back the other row is left with
  none and reads — , dashed. Backspace or Delete = no key. Esc or a click elsewhere = nothing changed. A page's own key shakes the cap,
  which goes on waiting; the F row passes through. Reset to defaults (that tab's button) = every row as built, nothing kept. THE NAMES
  FOLLOW: `keyCap` for a cap the HUD is handed (the Space rows and the order menu's keys, the kit column's slot numbers), `keyText` for keys
  named in words (the rows' hints, the order menu's hint, the objective line and so Training's steps, the kit column's L and N tags, the
  order mark, captions, the pause and down cards' foot lines, the old start card's list). `keyText` reads finished words and that is a
  guess: a moved cap standing alone is the key unless the words round it make it a place's letter ('room B', 'Vault B', 'B wing',
  'T-junction'); a digit only where the words say key ('then 3', '2 again'); W A S D only in a list of keys. KNOWN TO BE LEFT AS BUILT:
  '1 to 5 picks an order', the tour's 'WASD and mouse', speech bubbles, the debugger's own tooltips, a thing's name on the Space rows, and
  the Tab trial's 'as T' follows only on the Options list. Lines that handed the HUD a code instead of a letter would need no guessing;
  they are written all over the game and that is a pass of its own. NOT THE KEY'S LETTER ON ANOTHER LAYOUT: a cap is named by where the
  key sits on a US board, as the build's own list always was. CHECK `bun run tools/qa/probes.ts keybinds` (family `player`), on BOTH stands
  (`TPS_PROFILE=shipped` in front for the page's): the table (off in the module, the boot and `?keybinds=0`, a swap, 4,000 moves by a
  die leave no key with two rows, the page's keys refused, no key, Reset, the store written and read back, a bad kept table cleaned, the
  words); the keyboard listener on a window that is a list of listeners (nothing rebound = exactly the codes the build filed; rows moved
  = the same codes off the new keys; a dead key lets go of nothing; a key rebound while down lets go of what it put down); and one script
  of hands (330 ticks: walk, crouch, sprint, the rifle, a reload, the wall, holster, Space) played three ways into a fresh game — codes
  written straight in, the keyboard as built, a board with 12 rows moved — ending in ONE digest on each stand. `KEYBINDS_BREAK=1` (a stray
  kept table while the 'nothing rebound' lines are asked) fails on both. ON A PAGE `PORT=<port> node tools/qa/keybinds-page.cjs [outDir]`
  (headless Chromium, real key presses; the screen needs no adapter, `GPU=1` adds the game on the software adapter, two boots,
  about twenty minutes; `ONLY=game` leaves the screen out). NEVER SEEN
  ON A GPU, and nobody has played it: not the feel of any moved key, not a Mac's keys (Cmd chords, a trackpad), not Safari or Firefox.
  ROWS THE BUILD HAS ELSEWHERE WHILE EMPTY HANDS ARE A SLOT (`KEYMAP.slotWhen`, `SLOT`, `ALIAS`, 10-22): the slot's row (code `'Digit0'`) on backtick,
  the debugger's on backslash, E's row with no key and its letter in a line read as the slot's key. The bullet is in `player.md`.
  A ROW THE BUILD GIVES NO KEY (`KEYMAP.qFree`, the wall hold's, 10-21): `home(a)` is a row's keys in the build, and 'as built', the swap, the kept
  table and Reset all measure against that, not against the row's code. The bullet is in `stealth.md` ('Q is free').
- **A mission that leans loud is not graded as a sneak (10-22, `VERDICT.loudCard`).** The maintainer, off the solo tutorial's end card ('ASSAULT 14'
  on a won fight): 'weird that we show a score (and a low one) for loud missions'. The stealth game's rating prices every man shot and every time
  he was seen; a row of the list whose `lean` is `'loud'` but whose kind is the stealth game's (`tut-solo`, `train-kit` today) ended on that card.
  `game/verdict.ts loudRow(g)` = the key up, a quiet mission up, and its row leans loud. The game is not told the page's `levelFile`, so the row
  is found off the level's own name (`rowFile`: `<name>.json`, or the file whose look that is — `scene/look.ts LOOK_LEVELS`). `chronicle.ts
  debriefOf` carries it as `Debrief.scored` and `Debrief.grade` ('GHOST 94', '' when not scored). Not scored: the card (`ui/debrief.ts`, class
  `db-loud`, which nothing styles) builds no rating word, no score, no line of what was docked, no badges, and the sneak's cells (seen, alarms,
  floor up, bodies found, kills, doors kicked, called in, checkpoint loads, the civilians' saw / told) stand untoned — a hit taken and a civilian
  hurt keep their red; the copied line opens on the clock; `mission.ts`'s two end lines ('exfiltrated', 'mission complete') read `grade` and stop
  at the clock. The numbers, the timeline and the map stay. A row that leans quiet or either way, the plain night, and every squad kind (its end
  card never showed the rating; its 'run so far' and its card under `?noverdict` still do) are as they were. Reads only: no run's digest differs.
  ON in the page (`?loudcard=0` = the rating on every card it stood on); off in the module and on the frozen stand (`TPS_LOUDCARD=1`); a
  `FROZEN_HOLDS` row; a recording carries it (`VERDICT` is the last name of `JOURNAL_KNOBS`: `mission.ts`'s two end lines are worded by it), and
  one from before the key, or the table, replays with it off (`journal.ts applyKnobs`). CHECK `probes.ts debrief-loud` (the
  rule, the key down, a quiet row, the plain night, a room clear on a loud row, every row's level file and its look's file read back as the row's
  file, a recording with and without the key, mission.ts's two lines) and a block of `debrief-dom` (the card on a fake DOM, key up and down, counts that would tone every cell);
  `LOUDCARD_BREAK=1` fails both on both stands. NEVER SEEN ON A GPU; nobody has played to the card since. Left as it was: the stealth game's
  cells and timeline still stand on a loud row's card (a loud card of its own would be new work).
- **A row with its own hour or weather draws no Hour or Weather row** (2026-10-22; `src/game/rowset.ts` `rowHour` / `rowWeather`, `ROWSET.on`,
  `?rowset=0`; the rule and its check are in `missions.md`, "A mission row can name its own hour and weather"). What does not apply is not drawn: H and J
  do nothing on such a row, the start page's Setup rail follows (it already skips a row that is not drawn), and the older kit figure (`?oldfigure`)
  stands in the row's hour under its cloud (`MissionsScreen.startHour` / `startWeather`: what the highlighted row is started in). A row that names only
  one keeps the other row, whose note reads the mission's own for the hidden one. Its LINK is any row's link: the visitor's Hour and Weather picks stay
  on it and on every later link, and the row's own win when the page boots. The debugger's 'weather kind' buttons say so and do nothing on a row with
  its own weather. No row names one yet.
- **How many are inside is a mystery, and the large map is left by a click beside it** (10-23; `src/ui/missions.ts` `MYSTERY`, `src/ui/kitBrief.ts`
  `KITBRIEF.outside`). The maintainer, off the Team & kit step with its map opened large: "clicking outside the map should close it. we should also
  remove all defender counts from the menus, etc., it should be a mystery!" **THE COUNT** (`?mystery=0` = the cells as they were): no screen draws a
  Defenders cell: the Mission step's sheet, the same cell on the Team & kit step (`kitBrief.ts`) and the fact on a mission's load page
  (`loadbrief.ts`) all ask `defendersShown(m)`, which is '—' ("no cell") while the switch is on, and the pause card's intel cell says how many were
  questioned without "of N". The facts row loses the cell and not a gap (`.mfacts.nodef`: three columns on the old sheet, no row at all on the one
  starting page's Mission step, where Defenders was its only cell, nor on a kit band with nothing to say of locks or hostages). A row's `defenders`
  number is untouched: the stand-up, the picks probe and the levers still count on it. THE WORDS
  are changed in the data and have no switch (a wording change, like the writing guide's): the rows that said a head count say the place instead
  (`scene/scenarioList.ts`: the pair's break room, the block's squads, the warehouse, the compound, the barracks, the kill house; `scene/picks.ts`
  the warehouse's line), Hard's sentence names no number of guards (`game/difficulty.ts`), and the kit lesson's first card no longer says the band "shows who holds the
  floor": it sends the player to the map, where the job is read (`ui/kitGuide.ts`; true in a short window too, where the band has no room for the job). KEPT ON PURPOSE: a smaller number that is the puzzle's premise ("two sentries who watch each
  other", "a gunman waits in one of them"), every Training and tutorial row (the number is the exercise; the lessons' own steps are their
  owners'), and the end-of-run card's "N of M down" (after the fact). NOT TOUCHED, and claimed to their owners: what the enemy SAYS during a
  mission (the last-stand call "{n} of us left", the staff radio check's roll of callsigns, a questioned guard's "{N} of us tonight", the response
  team's "{n} of us", the numbered Tango callsigns on the radio strip). **THE MAP** (`?mapout=0` = as it was: a click on the map, M, Esc, Enter or
  Space): large, the sheet reads as a card laid over the step, so a click anywhere off it puts it back. The click, and the press that begins it, are caught on the document before
  the step hears them and do nothing else: a teammate's slot under the pointer is not picked, a kit card does not take the keys, the figure does not
  start to turn. Small, a click on the step is the step's own; so is a click made after the window was narrowed until the sheet is no longer drawn. Both
  switches are UI only: nothing under `src/game` reads them, no recording carries them, no frozen row. CHECKS: `bun run tools/qa/mystery-check.ts`
  (also `probes.ts mystery`, families ui and words: no mission has a cell, no row, pick line or Hard sentence says a head count, no file under
  `src/ui` but `missions.ts` reads a row's `defenders`; `--list` prints the lessons' numbers it does not judge; `MYSTERY_BREAK=1` must fail), the
  missions-screen probe (the sheet's cell with the switch on and off) and `PORT=<dev server> node tools/qa/mystery-page.cjs [outDir]` (the real
  page in headless Chromium, real keys and clicks at 1440 x 900 and 1000 x 673: no cell and no count word on the kit step, the large map's
  caption, the Mission step and three load pages; the click beside the large map on a teammate's slot; each switch off; `MYSTERY_BREAK=1` must
  fail). SEEN: those two runs and stills of the three screens, on the software adapter. NOBODY has seen it on a GPU or played it, and the pause
  card's intel tooltip was read in the code only.

- **Tab shows the objectives and the squad** (2026-10-23; `ui/tabkey.ts` choice `brief`, `ui/tabcard.ts`, `index.html #tabcard`; the maintainer, with
  the corner panel cut down to what the two keys do: "if you don't have a menu open, tab opens up an objectives modal that also has your squad
  equipment?"). With nothing to back out of (Tab is the back key first: `game/backkey.ts`; the card also stays down over anything `game.backable()`
  names where `?tabback=0` has the back key off) and no menu open, Tab HOLDS THE GAME (`main.ts frozen`, as a pausing card does) on a card in the
  middle of the screen: the OBJECTIVE under its own word with the par or clock at the right, its sentence, and where it lists (`objectiveList`,
  only under the word 'objective': a room clear's rooms) each thing with a tick (taken), an arrow (the one being called) or a ring (to do); the
  SQUAD with the block's own title note at the right (loud or quiet, the formation), a line a man in the squad's order with what he is doing
  and what he covers (`orders.statusOf` and `cover.tail`, the block's own line past his name) and under it his kit in a line, a man lost struck, then the block's plain notes (what the squad carries between them, a
  charge set, who waits on him). A man's kit is the STAGED card (`kit.ts kitOf`, then `kitWords(i, m)`): what this run gave him, not this machine's
  table; its counted things read 'started with 1 stun, 1 charge' (`tabcard.ts staged`), because throwables and charges are one squad
  pool once the run is on and the live count is the note under the men. His own kit has no section (the slot bar shows it). Tab again or Esc goes back (Esc alone does not open the pause card over it); a menu,
  Options, a lesson's card or a script that steps the page puts it away. F5 under it puts it away and saves by hand, as on the pause card. Every word is one the game already makes, through `keyText`; the card lays them out once
  as it comes up (not a live readout) and scales with the text size (`textsize.ts LAYERS`). It is the home of what the corner panel stopped saying
  (`docs/agents/player.md`, the corner panel). THE SWITCH is the Tab key's row on Options, Game (the row is 'Tab key' now, no longer '(trying out)'; 'Objectives', beside Nothing, Run so far, Order
  who, Controls): it is what Tab does where nobody has chosen (`TABKEY.first`, set by the page before its menu is made), `?tab=off` = nothing for a visit, and a choice
  made on Options stands, Nothing included (`picked`, kept with the choice: a kept 'off' from before this was written by every machine and is no
  choice). OFF in the module, for anything headless and on a page a script drives (`navigator.webdriver`: the page tools press Tab for other
  things; they pass `?tab=brief` to see it). No rule of the game reads it and nothing of it is in a recording: under a replay or a script that
  steps the page (`__runFrames`) the hold does not apply and the card is put away on the next frame. CHECK: `tabcard` (family `ui`), both
  stands, `TABCARD_BREAK=1` red: the choice, what settles it and what is kept, the list, the card of a room clear with the squad of four (a
  staged kit, a man lost), the page's wiring read as text. DRIVEN on the real page on the software adapter (`tut-squad`, a room clear, four men,
  `?tab=brief`, no picture drawn): Tab put the card up at 560 x 422 in the middle with the six rooms, the four men each with his words and kit and
  the two carry notes, the clock stood still under it, Tab took it down and the clock ran, Tab put it up again, Esc took it down with no pause
  card; the same page without the word showed nothing on Tab; no console errors. MEASURED: nothing; it moves no tally. DECLINED, from review: the card as one of
  `overlay.card`'s (those are a lesson's, with its own key and locks) or a page of `#menu` (the menu is the pause, with its own Tab); the
  objective handed over in parts by `mission.ts` (the line is the one source the top line, the corner and this card all read; the list is cut
  from it only under 'objective'); a place in `bubbles.ts BLOCKER_IDS` (the card is above the bubbles by z-index and holds the game); one page-level 'what holds the game' reader
  for the load brief, a lesson's card, the menu and this card (a change to `main.ts` wider than this card; the check pins each site it added);
  `picked` and `kept` as one field (the kept file's two keys are already on machines); the menu's HTML escaper shared (a private one-liner of a
  neighbour's file); the break reaching the list and the page lines (both are fixed inputs: a break there would be by fiat). NOT DONE: a
  lesson's frame does not teach or lock it (the frame's key locks do not know Tab's card); nobody tracks what a man himself has left (the pool is the squad's), so a man's counts stay
  what he started with; a run's end line still says to press Enter while the card holds the game (Tab or Esc first). Never seen on a GPU. NOBODY HAS PLAYED IT.
- **Enter deploys a mission that has no kit step (2026-10-23; `ui/startpage.ts` `noKit` / `onward`).** The maintainer: "bug for tutorial 1 where hitting
  enter (rather than clicking deploy) goes to an empty loadout screen rather than starting". A mission played with the kit as issued (`kitAsIssued`: a
  tutorial mission with no kit plan of its own, `.nokit` on the page) draws Deploy as the block on the MISSION step, but Enter on its row still stepped
  into TEAM & KIT, where there is nothing to pick. Now nothing on the page leads there for such a mission: Enter or Space on its row is Deploy, the key
  line under the list reads "Enter deploy", the head names one step, the rail has no Team & kit row, and `setPane` itself refuses the kit step, so
  `?loadout=<that mission>` opens on its rows. A mission with a kit steps into it as before. No switch (a page's navigation; nothing a run reads).
  CHECK: `tools/qa/startpage-look.cjs`, two lines ("a mission with no kit to pick", "a mission WITH a kit still steps into it"), on the real page with no
  adapter under it; the look's group name 'Training' was stale since the old lessons went and reads 'Tutorial' now. Nobody has pressed it on a GPU page.
