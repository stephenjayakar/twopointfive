# Sounds

One of the area files CLAUDE.md indexes. Everything below was moved here word for word from CLAUDE.md on 2026-10-13, in its old order;
"the bullet above / below" in a bullet means its neighbour there (each block says which lines it was), and a bullet named by its bold
title may now live in another file of this folder: `grep -l '<title>' docs/agents/*.md`. New bullets for this area go at the foot of this file.

<!-- was CLAUDE.md lines 2890–2953 -->
- **The game's sound table** (`src/audio/audio.ts gameSfx(ctx)`, what the mixer loads, read once when the audio starts): the redone table (`audio/sfx.ts`) with the OLD voice laid
  over it for the names in `audio/sfxWas.ts WAS_IN_GAME` — thirteen: the maintainer's 'better before' votes on the listening page, 10-12 (pistolSuppressed, carbineReport, dryFire,
  click, nvOn, nvOff, stairBoots, lockPick, powerDown, powerUp, alarmChirp, glassTinkle) + rifleSuppressed, old until a new take is picked. `?oldsounds` (`SFX_TABLE.was`) = the old
  table whole (a voice it never had keeps the redone one), `?newsounds` (`SFX_TABLE.redone`) = the redone table whole. The mixer's ears only: nothing the game hears with reads it,
  and a replay holds no sound, so either flag is the listener's. A vote that changes = a name in or out of `WAS_IN_GAME`. `bun run tools/qa/gunfire-table-check.ts` holds all three
  tables (`GUNFIRE_BREAK=1` must fail).
- **Sound lanes on the engine replay, and new takes to pick from** (`src/replay/soundlanes.ts`, hooked by ONE line of main.ts after the tape attaches: `if (tape) soundLanes(tape, audio)`;
  A DEBUG MODE, OFF BY DEFAULT: `soundLanes()` makes nothing unless the address carries `soundlanes` (`soundlanes=0` = off) — without it no dock, no card, no `body.sndl`, no
  `--sndl-h`, no tap on the mixer, no `__sndlanes`; the two keep-lists (engineplay.ts `NOT_THE_RUNS`, ui/replaykey.ts `VISIT_FLAGS`) carry the word through the replay's redirect and the listening
  page's 'In play' links add it (soundlanes-page.cjs opens with it and holds a page without it bare); `__sndlanes`; the maintainer, 10-12: "a special replay viewer mode where we have the audio tracks in the timeline below, and I can see what's playing and then
  flag individual ones. and being able to pick between a few options (or maybe even parameterize them)"): on a `?playtape=` page a panel over the timeline has one LANE per sound the
  tape has asked the mixer for, a mark each time (dim = asked but out of earshot or over the voice cap), the name lit while it sounds. A click on a lane or a mark opens its CARD: which
  TAKE plays on this page (`before` = audio/sfxWas.ts, `after` = audio/sfx.ts, `new 1` / `new 2` = audio/sfxAlt.ts; the game's own is marked), three dials (pitch, tone = a low-pass,
  level), ▶ to hear it alone, a flag at that moment and a few words; 'copy picks' = ONE line of text to paste into the chat (`copyText()`). The mixer's side is five members of
  `AudioEngine` that nothing in the game calls or sets: `tap` (told of every sound asked for: name, gain, seconds, heard 0 / 1 / 2), `trims` (per name: another loaded buffer, rate, gain, a
  low-pass), `loadTake(name, take, buf)`, `again(name, mix)` (a sound played once more AS IT WAS MIXED — `SoundAsk.mix`: where it was to the listener, gain, rate, cut, send, filled only for a tap — under the trims as they stand now; never told to the tap) and `hush()`; with no tap and no trims `play()` is as it was. THE LANES ONLY LISTEN AND TRIM: nothing of it is read by the simulation (the mixer draws
  `sysRandom()`), so a tape plays the same run whatever is picked. Picks are this browser's (localStorage `twopointsix.soundpicks`), act on replay pages only, and the lanes' marks ride
  sessionStorage across the page load a seek backwards costs. NOT ON A `?mute` PAGE: a muted page never starts the mixer, so there is no buffer to swap (marks are filed as unheard,
  the card offers no takes). THE NEW TAKES (`src/audio/sfxAlt.ts`: `altTakes(name)`, `altSay(name, k)`, `altNames()`, `altTake(ctx, name, k)`): two more renders each of the fourteen
  sounds he called toys (rifleSuppressed, magOut, magIn, rack, footHard, doorBang, doorLatch, doorRattle, stairDoor, chokeLimp, lightBreak, wallDebris, murmur, heldProtest), offered
  on the lane's card and on the listening page (`/sounds`: 'new 1' / 'new 2' beside before and after, and in the vote), NEVER in the game's table until he picks one — a pick is
  moved into audio/sfx.ts by hand. HIS PICKS OF 10-13 (pasted from the lanes' 'copy picks'): footHard 'new 1', magIn 'new 2', rack 'new 2' ARE the game's voices now (their
  bodies moved into sfx.ts sample for sample; the place each had in sfxAlt.ts is `PICKED` — `altPicked(name, k)` — so the take beside it keeps its number, a picked place
  renders nothing (`altTake` → null) and is offered on no card and no vote), and the four he FLAGGED were redone in sfx.ts to his words, each with ONE other take in sfxAlt.ts to
  hear beside it: propScrape ("maybe it should just be a single scrape?": one swell with a few uneven catches, no chopped beat; `HEARD.propScrape` 0.05; its other take = on
  castors, rolling and coasting — the chair's MOTION is the props owner's, and a per-kind roll voice would follow that), propThud ("doesn't seem natural": one knock with what
  sits on it, no second bounce), lockBreak ("the high pitched end … sounds weird": the plate bent out as a dull clack, the jamb settling, a piece on the floor — no ring above
  2.7 kHz in its tail), magDrop ("hollow, high pitched": a flat slap with weight under 500 Hz, bounces as knocks). The contact helpers `knock / cluster / clack` live in sfx.ts
  (exported; sfxAlt.ts imports them). `bun run tools/qa/sound-takes-check.ts [name …]` (every take finite, not silent, not clipped, not the take beside it, its length and spectrum
  printed beside before and after, for the fourteen toys and the four flagged; exactly the three picked places are picked; the default table unchanged; `TAKES_BREAK=1` must fail), `PORT=<dev server> node tools/qa/soundlanes-page.cjs [outDir]` (`TAPE=<id>`; the real page
  on the software adapter, the browser muted and the page NOT: lanes fill as it plays, a click on a mark opens its card, a picked take is the buffer the mixer plays next, flag and picks
  come out as text, the replay still plays step for step, the open panel has height, Esc in the note field reaches nothing else, a checkpoint set by a click and its stretch heard again in the picked take then in another with no step run and no mark filed, and a page whose kept picks / marks / checkpoints are garbage still
  comes up; ~25 min). THE KEYS STAY THE REPLAY'S: game/input.ts, engineplay.ts and main.ts's Esc all listen on window in the capture phase and were registered first, so nothing the card
  does can pre-empt them — instead no control of the card keeps the keyboard (a pressed button or a moved dial blurs itself; Esc / Enter in a text field blurs it, main.ts's
  `panelWantsEsc` counts `#sndcard` with `#panel`). WHAT THE BROWSER KEPT IS NEVER TRUSTED (`pickOf`, the events' shape check), and no throw of the lanes reaches main.ts's fatal card:
  every handler goes through `safe()`, the frame loop through `fail()` (the lanes take themselves off the page, tap and trims cleared, one console error). Marks are kept for the next
  page load on pagehide / hidden / a 5 s timer, never per sound. CHECKPOINTS AND 'AGAIN' (the maintainer, 10-13: "having a few checkpoints to rewind to would be great"): the dock's
  head reads left to right, in words: `▾` (alone folds it) · 'N sounds · N flagged' · `＋ checkpoint` (six a replay, localStorage `twopointsix.soundlanes.cp` by the tape's key) · the
  checkpoints as NUMBERED chips ('1 0:12', time order) · `↺ again from m:ss` (it names where it goes back to — `againFrom()`; plain and off with nowhere to go; `■ stop` meanwhile) · `⟳ loop` · `copy picks (N)` (off at 0). ONE OPAQUE DOCK, NOTHING FLOATS: `#sndl` is `DOCK` 260 px tall on the bar while open (the lanes scroll inside it) and the card `#sndcard` opens INSIDE it, a `CARD` 360 px column at the right with its own scroll — the lanes take the width left (`view()` reads the lanes' own box); no button is a lone glyph but ▶ ✕ M S, no title is a sentence. THE LANES HAVE THEIR OWN WINDOW (`view()`: `span` 30 s, the wheel 10‥120, kept; its head — the stretch heard
  again, else now — 75 % across, pinned at 0 near the start), right of an opaque gutter of names, under a RULER (m:ss) with each checkpoint a numbered flag. THREE COLOURS: green = now,
  gold = flags, cyan = hearing again (chips, flags, its head and stretch, the loop). The map is the replay bar's to place (top right in its rework; the lanes carry no rule for it). `↺ again`, a chip, a
  flag or a click on the ruler HEARS THAT STRETCH AGAIN (`relisten(from)`; alone = from where it was last heard, else the nearest checkpoint behind, else the last 10 s): the tape is PAUSED and only the stretch's SOUND is played, on the lanes' own clock (`reTick`), each heard mark handed back to the mixer through `again()` with the mix it was filed with (kept
  across a page load: `mixRow` / `mixOf`) — a take or dial changed on the card is heard at once, no step run, no mark filed (it plays on if it was playing; `■ stop`
  leaves it paused). Shift-click a chip or flag = the replay's own seek there (back = a page load), right click takes it away. No key. Not in a stretch: sounds out of earshot, looping beds. A STRETCH ENDS at the next checkpoint before the tape's step,
  else there; AND IT LOOPS (`⟳ loop`, lit while on; this visit's, sessionStorage `twopointsix.soundlanes.loop`; put on with no stretch set it MAKES one, from where 'again' would start — else the last 5 s — to the tape's step, and put off it takes the stretch with it): a stretch
  heard again REPEATS — the next pass `LOOP_GAP` 0.25 s after one ends, under the takes and dials as they stand then — until `■ stop` (which, on a loop, lets a tape that was
  playing play on), the replay played on or a seek; put off mid-loop = the running pass is the last. A DRAG along the ruler (4 px or more) sets an explicit stretch, an outlined band behind the tape's step with a cyan HANDLE at each end on the ruler (dragged, that end moves):
  heard at once, and what `↺ again` hears until let go by a click on the ruler (heard from there) or a right click. `__sndlanes.loop(on?)`, `.region(f0, f1 | null)` (steps, [f0, f1)), `.relistening()` =
  `{on, from, to, passes, loop, region, n, played}`. Held by soundlanes-page.cjs's layout and loop lines, each part in ONE turn of the page (its own frames tick a stretch too).
  A SOUND TUNED ON ITS CARD (`src/replay/soundtune.ts`; the maintainer, 10-13: "having a few options, ways to tune them (i'm familiar with audio engineering!), parameters for the generation, etc. would go a long way to cut down on
  iteration times"): the card's takes row has one more, `tuned` = the take that was up (`SoundTune.base`) BUILT AGAIN under his numbers and handed to the mixer as take 'tuned' (`audio.loadTake(name, 'tuned', buf)`, selected by the
  existing trim), re-rendered `TUNE_MS` 80 ms after a dial moves, so ▶, `↺` and a loop's next pass play it. THE HOOK is in the instruments (audio/synth.ts `TUNING` / `Tune` / `Layer`): while a voice is built under a Tune every
  instrument call (hiss, ring, thump, tone, sweep, …) is NUMBERED in call order and may have its numbers laid over (`over[k]`), be muted or soloed, the voice's noise re-seeded; `sfx.ts buildOne(ctx, name, tune)` / `sfxAlt.ts
  altOne(ctx, name, k, tune)` build ONE voice so. THE RULE: under a Tune that changes nothing the buffer is the table's SAMPLE FOR SAMPLE, and with no Tune the instruments run the statements they always ran (the table the game
  loads is unchanged: `sound-takes-check` holds both, for all 49 instrument-built voices — 432 layers — and the 29 other takes; 16 voices are written as bare render loops and have no layers: seed and post only). A mute or a solo is
  rendered at the WHOLE voice's level (two passes: the scale is taken from the full voice). THE CARD: POST = pitch in cents and level in dB (the mixer's `rate` / `gain` trims, as before), HP in Hz and one bell (f, dB, Q) baked
  into the tuned buffer (`synth.ts post`), LP in Hz (the mixer's `tone` trim); SYNTH = the seed (a number, ⚄ rerolls) and one line a layer `k kind summary` with M / S, a click on a line opens its dials (ms, Hz on a log slider, dB,
  a ring's pitch in cents, its decay ×, …); every dial has its number beside it (typed in its unit), a double click puts it back, a changed one is marked; a small spectrum of the take as the mixer will play it; `keep` files the
  tune as `mine 1`‥`3` (click = recall, right click = forget), `reset` = the base take as written. KEPT inside the pick (`SoundPick.tune`, `.mine`; localStorage `twopointsix.soundpicks`), read back through `pickOf` → `tuneOf`
  (clamped, anything else dropped, 'tuned' without a tune is no take). `copyText()` says only what differs from the base, in units: `propScrape: tuned from after · seed 141 · L0 hiss lo 180 Hz, D 150 ms · L2 hiss mute · hp 90 Hz ·
  bell 2400 Hz -4 dB Q 1.2 · pitch -71 ¢ · level -2 dB` (L<k> = the layer's place in call order, from 0, as the card lists them). Replay pages only; nothing in src/game reads any of it. A pick of his is still moved into
  audio/sfx.ts by hand — from that line. `__sndlanes.tune(name, t => …)`, `.tuneState(name)`. THE PEAK IS SHOWN AND GUARDED: the spectrum's corner reads `peak −1.2 dBFS` of the buffer the mixer is handed with the level dial laid on ('over' past 0: only the
  level dial can take it there); a tuned buffer that comes out past full scale (a bell at +18 dB took pistolLoud to 8.3) is pulled down whole to 0.98 when it is made (`soundtune.ts renderTune`, `GUARD_PEAK`, `pulledOf`) and the card says
  `· pulled 18.6 dB` in red, so he hears his dial and not the mixer's compressor. A dial shows the tune's own number (the instruments' log is 'as written'); Esc in a number or seed field throws the typed number away (main.ts marks
  the field `data-esc` round the blur it does); a typed seed fills the card again only after the click that took the focus has landed; a kept level is never under the dial's floor (−24 dB); a click on a checkpoint marker lets a
  dragged stretch go as a strip click does. The page check opens a layer, moves a dial and asks that the mixer's next buffer is `<name>@tuned` and not the base take's.
  Nobody in the cloud has heard any take, tuned or not, and the card has only been seen on the software adapter's stills.
- **A rolling chair's voice = a looped voice that follows a moving thing** (the maintainer, 10-13, on the chair's scrape: "i'd also expect the chair to have wheels and roll"; no switch: the roll
  itself is props.ts `CASTOR`). THE GAME'S HALF (game.ts `rollTick(dt)`, right after `props.update`; `ROLL_VOICE {gain, fullV, minV, grace}`): a PropEvent `'roll'` `'start'` only enters the
  chair in `Game.rolls` (one entry a chair); each step the chair's REAL displacement is measured — never its velocity or the props' `rolling` word alone: a chair pinned against a desk
  keeps both and goes nowhere — and the step it is seen to move faster than `minV` 0.12 m/s it gets ONE voice, `audio.play('chairRoll', pos, gain, { follow })`, which ends once it has not
  moved for `grace` 0.5 s (a pause shorter than that is one roll), is gone from `props.props` (a chair destroyed mid-roll raises no 'stop'), or the clock went back (a load). The asks hang
  on game state alone (a muted page and a replay make the same ones), nothing of it is read by the simulation, no die is drawn. A ROLLING chair's `'scrape'` events play no `propScrape`
  (the die for its jitter is drawn and the hearing event filed as ever — the mixer's ears only; whether anybody on the floor should hear a chair roll is a rule nobody has asked for).
  THE MIXER'S HALF (`audio.ts follow`, `FollowSrc = () => { pos, k, t } | null`): a looped positional voice whose LEVEL AND PITCH follow `k` every frame in `AudioEngine.update`
  (`followGain`: nothing at rest, 0.3‥1 of `gain` moving; pitch 0.8‥1.1) and whose panner and low-pass are re-aimed with the other loops' (four times a second; reverb send and HRTF are
  the start's); `t` = the game's clock (standing still more than 0.2 s — a pause, a frozen card, a paused replay — = silent); `null` = faded out over 140 ms. At most `MAX_FOLLOW` 4
  alive (a nearer newcomer takes the FARTHEST one's place, any other is not started) and two more still fading (a churn of starts and ends is bounded). It cannot run on: stopped — not
  just released — after `FOLLOW_SECS` 45, silent the moment the tab is hidden, and its source carries a hard end (`PlayOpts.maxSecs`). The buffer loops over the stretch `FOLLOW_LOOPS`
  names (`sfx.ts ROLL_LOOP` → `PlayOpts.loopAt`; `rollLoop` makes it seamless by a crossfade and leaves a faded head and tail, so the row is also a plain 2.5 s sound for the listening
  page and a lane's 'again'). The tap is told once, at the start (a lane's mark = the push). A restart or a load forgets every roll (`restartEncounter`: the chairs go home in one step, which is not a roll). KNOWN: a roll the mixer did not start (the house full, or first asked while the mixer was off — a seek's undrawn steps) or gave to a nearer one stays silent
  until that chair has paused longer than `grace`; a pinned chair being leaned on makes neither a scrape nor a roll. A replay recorded before chairs rolled plays with `CASTOR` off
  (journal.ts) and has no roll in it. Nobody in the cloud has heard it.
- **Hear again has a picture** (`src/replay/soundfilm.ts`, made by soundlanes.ts and so only under `?soundlanes`): the lanes wrap `tape.frame` to `capture(t)` right after each PLAYED frame's render (not while hearing again, not in a seek), `reTick` ends on `film.show(head time)`, `reStop` and a paint with nothing heard again `hide()`; a stretch from before the first picture kept shows none and the dock's head says 'no picture before m:ss'. `fail()` puts `tape.frame` back and disposes the film. Held by soundlanes-page.cjs's three picture lines (the replay PLAYED frame by frame through `__runFrames(1, 0.1)`, then `#sndfilm` over `#view`, another picture a second on, gone when stopped) and its no-flag line (no `#sndfilm` after played frames).
- **The lanes' dock after its review (10-13)** (`src/replay/soundlanes.ts`; still only under `?soundlanes`, `=0` = absent): THE WINDOW HOLDS STILL — it follows the tape's step, and while a stretch is heard again or a ruler / handle drag is held it stands where it stood (`win`; widened or shifted ONCE by `fit` if the stretch did not fit), so a loop's head crosses the same lanes every pass. `⟳ loop` LOOPS AT ONCE (makes a stretch up to now if none is set, starts hearing it; put off = the sound stops, the stretch goes); it and its stretch are kept together per replay for the visit (sessionStorage `twopointsix.soundlanes.loop` = `{k, reg}`). A click on the ruler or on a checkpoint AHEAD of the tape starts nothing and keeps the stretch (`relisten` first, the stretch let go only if it started); checkpoints the tape has not passed are drawn dim. Each chip carries a `×` (the flag on the ruler still takes a right click); every head control and chip has a title of four words at most; `−` / `+` beside the ruler's seconds do what the wheel does (one wheel event ≤ ×1.25, the span written 300 ms after the last change). ESC: stops the stretch being heard, the next shuts the card, else nothing — read on KEYUP, because the bar's keydown listener (engineplay.ts) stops every key before later listeners; an Esc a field used (focusout within 600 ms) or that shut the bar's big map is not the lanes'. The dock comes up OPEN on every load with the flag (folded is that page load's only; `twopointsix.soundlanes` keeps the span alone). Heard again where the film holds nothing: `#sndnopic`, a cyan-edged tag ON the view ('no picture here · play through it once'), in place of the head's words. The head wraps on a narrow window, the card is `min(360px, 45 %)` wide and ONE scroller, no text under 11 px, the card's orange is gone (green = what plays now, gold = flags, cyan = hearing again). `undo()` takes everything off the page (frame wrap, style, listeners, dock, card, tag, class, `--sndl-h`) for `fail()` AND for a throw in the constructor. `__sndlanes.film.stats` = `{taken, dropped, failed, kept}`; the frame a seek lands on is not captured. Held by soundlanes-page.cjs (window start equal across a loop pass, Esc ×3 and Esc under the map, ruler / chip ahead, `open:false` kept, the tag, 800 px, taken down by `fail` and by a constructor throw, `soundlanes=0` and no flag: no copy of the view per played frame). Software adapter only: NEVER SEEN ON A GPU, never used by a person; the card's hidden gestures (double-click a dial = its default, right-click 'mine N' = forget) are still hidden.
- **The lanes' dock, second look (10-13)** (`src/replay/soundlanes.ts`, `soundfilm.ts`; only under `?soundlanes`): THE RECORDED PICTURE FITS WHAT THE DOCK LEAVES OF THE VIEW — `SoundFilm.box` (the lanes give it `above()`: the view's top down to the dock's top) lays `#sndfilm` letterboxed there (`object-fit:contain`, dark round it, the cyan edge on all four sides; with no box it covers the view and draws its own "↺", as soundfilm-page.cjs holds); the lanes put `#sndfilmtag` in its corner, "↺ recorded m:ss" (the stretch's head), and set `body.sndfilm-on`, under which the game's live HUD is `visibility:hidden` (the `HUD` list: #overlay #equip #lcol #meters #log #objective #alarm #checkpoint #journal #caption #blind #veil — NOT #tapebar, #tapemap); class and tag go with the picture (`pictured`, `reStop`, `undo`). THE DOCK IS AS TALL AS ITS CONTENT with no card up (head + ruler + lanes, 120 … 260 px, the lanes scroll past that), 260 with the card; `--sndl-h` follows in the same layout pass. GREEN IS ONLY "NOW" (the tape's head, a lane sounding): the selected lane's name is white and bold, the picked take a white outline, a dial at rest grey and one moved off its default white (thumb, number, "•"); the game's own take carries an "in game" badge; a dial that is off says "off" / "open" with no unit, the pitch reads in cents alone. THE RULER IS TWO ROWS (`RULE` 30: flags, then times; the flags have no pole), a stretch's handles hang BELOW it in the overlay (`.ov .hnd`), the tape's head is drawn over everything. "copy picks" is not there at 0; the peak is said under the spectrum (`.pk`), not over its curve; the card fades at its bottom edge while there is more below (`.more`); the card runs name + ▶ / again · takes · flag + note · picture · dials · layers. Held by soundlanes-page.cjs (the picture's box ends at the dock's top, its edge and tag, the HUD hidden and back, the dock's height with and without the card, no copy button at 0, the card's order, no green on the card, the ruler's rows). Software adapter only: NEVER SEEN ON A GPU, never used by a person.
- **Sound replays recorded again on build head 30d6c3d9 (10-13)**: train-orders, train-pairs and wall-charge, each parting at step 1 from its old recording (levels/train-orders.json, train-pairs.json, mousehole.json and the defender rules had changed under them); then train-move, train-hands, train-silent and whip, which still played as recorded but sat on levels whose fingerprint had moved (headless tools refused them without `--force`). Scripts untouched, seed 1. train-orders no longer plays `carbineReport` (still in train-pairs and office-loud) and train-pairs no longer `doorCreak`; cover stays 65 of 66 (`shove` in none). `sound-tapes.cjs --check` as recorded for all 13, headless on the software adapter: NEVER SEEN ON A GPU.
- **`soundlanes-page.cjs` is one line red on the new wall-charge** ('twenty seconds in, the marks are spread…', line 136 wants `now >= 20`): the check walks to 240 steps past the first `rifleSuppressed`, which is now step 904 (was 975), so it stops at 19.1 s; the spread itself (53 %) passes. The other 97 lines pass.
- **More music than the one theme (10-14)** (the maintainer: "can we add more music? the single theme is getting a bit repetitive. overall i love the original amon tobin soundtrack for
  chaos theory"; `src/audio/pieces.ts MUSIC.pieces`: ON in the page, `?onetheme` = the theme alone as it was; OFF in the module and on the frozen stand, `TPS_MUSIC=1`; a `FROZEN_HOLDS`
  row; registered in knobs.ts, NOT in the journal: the listener's ears only, `PAGE_ONLY` in knobs-check, and `onetheme` is one of engineplay's this-visit words. A RUN TAPE DOES
  CARRY IT (every registry table, runtape.ts) and its player would have put it over the page's: `knobs.ts VISIT_OWN` names the tables that are the viewer's own, and the player's
  two table puts go through `knobsPlayed()`, so `?onetheme` holds on a tape made without it and a tape made under it takes the pieces from nobody; music-check 'a tape').
  THE SCORE IS GENERATIVE SYNTHESIS, nothing recorded: `music.ts` is the sequencer (a 25 ms look-ahead on `intensity` = `game.tension()`), `musicBackend.ts` the Web Audio voices. Five
  ORIGINAL pieces sit beside the theme, each the same three layers (calm · suspicious · firefight) with its own tempo, metre, key and band: Night Shift (78, C minor, a slow lean:
  upright bass, muted trumpet and clarinet, felt piano, brushes; then toms and shivering strings), Paper Walls (84, 12/8, D hirajoshi: koto, breathy flute, taiko), Dead Freight (160,
  an even 4/4, E minor: upright riff, electric piano, a break on a ride cymbal), Undertow (68, B flat minor: bells three against four, congas, a half-time kit that DOUBLES to a
  backbeat at 136 above x 0.6, horns, a kettledrum), Glass Rain (96, F sharp phrygian, no thirds: frame drum, hammered dulcimer, felt piano, strings a half step apart). A PIECE = data +
  one `tick` a sixteenth, playing through `Hands` (the voices behind the sequencer's one die; every acoustic note lands up to 6 ms late at its own weight). HIS NOTES OF 10-14 on the
  first cut, each built: "night shift seems a bit too upbeat" (it was 92 with a walking blues riff and a ride pattern); "paper walls is great" (its notes are untouched); "dead freight
  also awesome ... i wonder if the 7/8 stutter isn't quite the right fit for a game based on *smooth* operators. the snare roll is what gave it away" (it was 7/8 with a snare roll: no
  piece rolls a snare now, a phrase turns on a run down the toms and a cymbal); "love the bells on undertow ... the firefight version feels too slow ... should go to double time";
  "glass rain also feels a bit too upbeat (feels kinda chrono trigger esque ...) ... the main melodies in firefight glass rain do sound very synth-y" (congas, electric piano arpeggios,
  major chords and sawtooth stabs gone); "more diverse instrumentation and making them sound more acoustic rather than synth (specifically the accents and percussion, the long drawn out
  glissando pads and the fat synth bass are great)". So THE BAND IS ACOUSTIC wherever a thing is struck, plucked, bowed or blown, and the theme's pad, sub and reese stay under every
  piece. `src/audio/acoustic.ts` = physical models as plain arithmetic, each rendered ONCE into a buffer and played like a recording (nothing IS recorded): `plucked()` a
  Karplus-Strong string tuned by an allpass (bass, koto, harp, guitar, dulcimer, felt piano, a pizzicato section), `modal()` decaying partials (kick, snare with its wires, toms,
  taiko, congas, tabla, frame drum, wood, marimba, kalimba, celesta, kettledrum, a gong whose highs bloom), `metal()` a cluster of partials on no scale (hats, ride, crash, a cymbal
  roll that breaks three seconds in), grains (shaker, tambourine, brushes). `struckAt / tunedAt` make each once per device rate (low drums at half rate); the backend warms the kit a
  buffer every 12 ms from the first piece's first note. `musicBackend.ts PieceVoices`: `perc`, `cymbalRoll`, `pluck`, `keys` (FM vibes / rhodes / bell beside the acoustic kinds),
  `strings` (saws through a body's three resonances with bow hiss: bow / trem / short), `wind` (flute, clarinet, muted trumpet, horn), a generated room + echo. No newer piece plays
  the theme's oscillator drums (music-check holds that); Paper Walls alone keeps the theme's struck metal and its swell, as he heard it. A kit comes in under `Hands.ease` (0.4 → 1
  over a band of x), and Undertow's gear is latched on the bar line with hysteresis (in above 0.6, out under 0.5). The bass string starts as the triangle a finger pulls it into
  (`StringSpec.pulled`: fundamental on top on every note; a noise burst gave each note its own spectrum) and each note stops the one before. THE THEME IS NOT TOUCHED:
  `Music.tick`, its voices and its draw order are as they were, and with the switch off nothing of pieces.ts draws, schedules or builds a node. THE DEAL (`Music.next / turn / mission`):
  (SINCE 10-15 THE PAGE PLAYS EACH LEVEL ITS OWN TWO, 'The level's own music' below; what follows is the deal under `?shuffle`)
  a shuffled bag on the page's die (`sysRandom`), the visit opens on a newer piece, every newer one is heard before the theme comes round; a piece hands over after `MUSIC.minutes` 4 at a
  four-bar phrase end once the floor is calm (twice that whatever the floor is doing), behind one bar of swell; a mission that starts once a piece has had `MUSIC.missionAfter` 45 s gets
  the next (main.ts: a new `game.mission` with nothing on its clock — a load, a recording's start and the tour's scratch copy are not cues). Backtick ▸ Mixer ▸ 'piece' picks one by hand.
  THE BREAK AND THE BASS (third cut; the maintainer, 10-14, of the record he was listening to: "the jazzy breakbeats and phenomenal bass work as the foundation are really
  what pull me in"): two more pieces stand on exactly that, COLD STORAGE (172, G minor: the kit at speed, the band in half time over it — first written at 92; he said "love the tempo for dead freight" of the one fast piece) and WIRE ACT (twelve eight at 98, A minor). `pieces.ts drum()` plays a
  written two-bar break on the acoustic kit (kick / snare with ghosts / ride / the foot's hat) a beat at a time, so the kick and snare of a bar can be cut from the beats of either bar (`CUTS`:
  whole beats and half bars only, nothing shredded; the ride and the foot are never cut) and a phrase turns over on a fill and a crash; `soft` = the uneasy drummer (a stick across the rim, ghosts only on
  the head). `walk()` plays a `Line` (two bars of step / semitones / length / weight / slide): the weight-1 notes are the line's bones and sound at rest, the pops,
  passing notes and pickups come in with x; `Hands.pluck(…, slide)` → `PieceVoices.pluck(…, from)` slides the string into a note. `growl()` puts the reese under the bones in
  a firefight. A piece at rest calls `rest()` on its bar line (the drummer's two cells of `h.m`, 8 and 9, are cleared: no stale fill is picked up mid bar) and `latch()` moves the
  kit between soft and whole on a bar line only. `Piece.warm` → `PieceVoices.warmTuned` makes a run's or a chord's strings ahead (Cold Storage's harp was 18 ms in one step).
  The five older pieces are untouched by it (Undertow's gear change now reads `latch`). No new switch. CHECKED: music-check 'the foundation' (bass notes a bar at rest, the
  break's ghosts / ride / rim when uneasy, backbeats and slides in a firefight; red under `MUSIC_BREAK=1`) on FROZEN and on `TPS_PROFILE=shipped`; the deal lines count
  `PIECES.length` (an hour of calm, four seeds). MEASURED, one 40 s render each in Chromium (music-page.cjs): Cold Storage -21 / -17 / -15 dB and Wire Act -19 / -16 / -14 dB (its bass taken down a touch after that run: uneasy was 3.7 dB over the theme with the limit at 4) at
  calm / uneasy / firefight against the theme's -22 / -20 / -15, no clip, no click at a handover. Read once as a drummer and a bassist by a second reviewer, and applied.
  NOBODY HAS HEARD EITHER PIECE; never run under the game on a GPU.
  THE MAIN MENU PLAYS THE THEME ALONE (the maintainer, 10-14: "also btw we should only have the main theme on the main menu"): main.ts sets `audio.scoreMenu` (→ `Music.menu`, from before the gesture that makes the score) while `menu.mode === 'start'`
  (the title and its start pages; not the pause or end card); nothing is dealt while it is up, the first piece is handed over to at the next bar line when play begins (at once
  on a page that loads straight into a mission), and coming back to the menu hands back to the theme. No key of its own: it only narrows where the pieces switch deals.
  Its edges, each a line in music-check 'the menu, at its edges': a handover still on its way when the menu comes back is called off; `mission()` deals nothing on the menu (main.ts
  sets the flag and deals the mission in one frame); a lead-out already sounding is the one that hands back (no second swell); out to the menu and back before the theme took over
  keeps the piece; a piece picked by hand (the panel) is left alone until the menu next opens or closes. Seen on the real page (software adapter, muted): Theme on the menu,
  a newer piece 9 s after Start, Theme 9 s after the menu came back.
  CHECKS: `bun run tools/qa/music-check.ts` (`probes.ts music`; `MUSIC_BREAK=1` must fail; both stands) drives the sequencer over a recording backend: the theme's note stream against
  digests pinned from the tree before pieces.ts (switch off, and switch on over a backend without the newer voices), each piece plays in time at three tensions, no two pieces the same
  notes or the same tempo and metre, the deal on four seeds; 'smooth' (Dead Freight: 16 steps, two backbeats a bar, no two snare strokes within a sixteenth), 'double time'
  (Undertow: one backbeat a bar uneasy, four in a firefight), 'acoustic' (every struck and tuned voice made as the page makes it: finite, peak 0.9, struck at once, dead by its end, every
  string within 12 cents; `MUSIC_BREAK=1` fails it). `PORT=<port> node tools/qa/music-page.cjs [--table]` drives `/music` in Chromium and RENDERS every piece off line through
  `webaudio.ts masterChain` at three tensions: on 10-14 every piece within 2.5 dB RMS of the theme at the same tension (−22 / −20 / −15 dBFS), peaks under 0.9 after the compressor and
  under 1.0 before it, no silent second, no click at a handover. THE LISTENING PAGE: `/music` (music.html + src/music/main.ts; `bun run tools/page-artifact.ts music` = one file to
  publish): a row a piece, the tension under a slider, keep / cut marks to paste back. Two musical reviews by reading (harmony spelled chord by chord, grooves, voice bodies; then the acoustic models) were applied.
  NOBODY HAS HEARD ANY OF IT: what a piece sounds like, whether a voice reads as its instrument, and whether it is in the vein he asked for are his ears' calls. Never on a GPU page with
  the game running under it (the room's impulse is ~6 ms of main thread on the first click); the levels above are Chromium's renderer on the software stack.
- **The level's own music (10-15)** (the maintainer: "we should curate the music for each level, not do it randomly"; `src/audio/setlist.ts SETLISTS`, `pieces.ts MUSIC.byLevel`:
  ON in the page, `?shuffle` = the shuffled bag as it was; OFF in the module and on the frozen stand, raised with the pieces by the one word `TPS_MUSIC=1`; its `FROZEN_HOLDS`
  row; `shuffle` is one of engineplay's this-visit words). THE TABLE is keyed by level file name (`office` = the bundled level; `<level>-gwot.json` is the same level) and,
  before that, `<level>:<kind>` (the office holds four kinds of mission: the solo night, the night breach, the room clear and the rescue each have a row). A row is two piece
  NAMES in playing order: the first opens the level when play begins (off the menu's theme, or on a page that loads straight in), the second takes over after `MUSIC.minutes`
  at a calm phrase end (twice that in a fight), then back. The theme is
  on no row (it is the main menu's), so with this on the theme is never heard in play. A new mission on the same page keeps its music (`Music.mission()` does nothing while a
  list is in force): a restart is not a new piece. A piece picked by hand (the debugger's 'piece' row) plays its minutes and then gives way to the level's first. A level with
  no row plays `SETLIST_ELSE` (so does a `levelFile` that is not there: the page boots the office under the missing file's name; `?level=local`, the editor's own
  document, is read as the office). HOW IT REACHES THE SCORE: main.ts says it at boot from the URL (`audio.scoreSet = setlistOfQuery(location.search)` in `pageAudio`) and
  again from the running game at every new Mission (the frame loop's audio line: `setlistOf(setlistLevel(levelFileQ), runningScenario(…)?.kind)` — a scenario quit or started
  in the page is another kind of mission on the same level); `AudioEngine.scoreSet` holds it until the first gesture makes the `Music`; `Music.setlist` is read at every deal
  (`next()`), and a list that changes in play brings its first piece in at the next bar line unless the piece playing is on it. Nothing is drawn from the page's die. A NEW
  LEVEL NEEDS A ROW: music-check 'every level' is red on a mission whose level has none, on a row for a level file that is not there, on a row that is not two pieces or
  has the theme, and on a piece that opens no level (the listening page and a pairing pasted back are two slots: a third piece is a change to all three). CHECKS: `bun run tools/qa/probes.ts music` on both stands ('stand', 'every level', "the level's music": the list in its order on
  four seeds of the page's die, a lead-out at each handover, the first piece off the menu's theme, a restart keeps it, a list of one plays on, another list said in play,
  the two statements in main.ts and the two in audio.ts still there by their text, `?shuffle` deals as before;
  `MUSIC_BREAK=1` takes the records row away and tells the score no level: both lines FAIL); `tools/qa/music-page.cjs` (the listening page's LEVELS rows: a row a level, its
  first button plays the piece that opens it, a pairing changed joins the line to paste back). MEASURED: music-check ALL PASS on both stands (33 lines), its red path red on
  both new lines; music-page.cjs ALL PASS in Chromium (35 level rows on the listening page); THE REAL PAGE: `PORT=5199 node tools/qa/music-levels-page.cjs [query …]` boots a level in
  headless Chromium on the software adapter (muted, a browser a page), presses a key and reads `__audio`: the list the score was told is the level's row, the piece playing
  is its first, one piece begun; under `?shuffle` the switch reads off and a newer piece plays. Three to five minutes a page (a slow check: it runs behind a build, not in
  the bar). Run 10-15 on build head 385850ee, five pages ALL PASS: the records office → Paper Walls, the office rescue → Dead Freight, the counting house → Wire Act, the
  warehouse with the four → Cold Storage, the solo night under `?shuffle` → a piece off the bag (and the solo night → Night Shift on d2eed13b). It is the only check that
  plays the wiring; music-check holds those statements by their text. The pairing was read once by a second reviewer for key and metre at each handover (fifths and
  shared metres preferred, tritone handovers removed). NOBODY HAS HEARD IT: whether a piece suits its level is the maintainer's ear; he changes a pairing on the score page's
  LEVELS rows (two pickers a level) and pastes the line back, and a row here is edited to match. Glass Rain opens only two levels on purpose: it is the piece he liked least
  before its rewrite and he has not heard it since.
- **Whose nerves the score follows (10-17)** (`src/game/guards.ts tension(g, theirs)`, switch `MUSIC.theirs` in `audio/pieces.ts`). The score's `intensity` is
  `game.tension()`: the highest state of any man on the floor. It counted teammates too, and a man under a script never drains his awareness (`updateGuard` returns
  into the script before the decay), so whatever a blast, a noise or a tripped breaker left on a teammate held the score up until his order ended: 0.32 after a frag
  that left him standing (0.92 x 0.35), 0.21 after a flashbang at his feet, 0.68 if his order took him back in 'search', with every defender down. With the switch
  ON, in LIVE PLAY a teammate counts only while he is in a fight of his own ('alert'); everything else the score reads is the opposition, the blackout and the alarm,
  as before. WHILE A SHOW RUNS (`g.touring`, `g.director.showing`) every man counts as ever: the day showcase's pair are put in 'search' as its cue, and with them
  left out the show's loud half played to the calm score (a review caught it; stepped headless on both stands, 132 s: the two readings equal on every frame). The
  rule is a PARAMETER the page passes (`main.ts`: `game.tension(MUSIC.theirs)`, and the debugger's 'force tension' row), so no game module reads the listener's
  table and a bare `game.tension()` (every tool, the frozen stand) is the reading as it was. In a room fight the team's own part was already nothing (the men fight
  under their scripts in 'patrol'; two real entries watched frame by frame, the records office and the depot: 0.0 s in which the team alone held the tension above
  the defenders'), so a fight sounds as it did. SWITCH: ON in the page, `?teamnerves` = every man counts, as it was; OFF in the module and on the frozen stand;
  `TPS_MUSIC=1` raises it with the other two (`FROZEN_HOLDS['MUSIC.theirs']`); `teamnerves` is a visit word of a replay link (`ui/replaykey.ts VISIT_FLAGS`). No
  rule reads it and no digest moves: the tension feeds the score alone. CHECK: `probes.ts music`, the line "the team's nerves" (a real records-office mission stood
  up headless on the stand's own level file, a teammate under his script at 0.92, every defender down, ten seconds on: 0.32 as it was, 0.00 now; left searching
  0.68 / 0.00; a defender alert or a teammate alert still 1.00; searching while a show runs 0.68; `main.ts` hands the switch over, by text) and a third 'stand'
  line, on BOTH stands; `MUSIC_BREAK=1` must fail it. MEASURED 10-17 on one seed a level (records office, depot): the hold reproduced with one of the player's own
  cans (flash 0.21, frag at 5 m 0.32, unchanged 80 s after the last defender fell). A SECOND RULE ON THE SAME READING (`CONDITION.ownCalm`, game/condition.ts, in a tree
  that has it): a teammate at rest in 'patrol' does not count, whoever asks and show or not; it leaves one left in 'search' or 'suspicious' counting. The two stack:
  with both on this one holds the reading in live play, being the wider. The check holds that rule off for its as-it-was readings and prints it alone. NOT DONE: defenders under a script hold their wariness the same way and still
  count (that is the opposition's state, left alone); the cause itself (nothing takes a scripted man's wariness down) is not touched here; nobody has heard the
  difference, and nothing here was run on a GPU or with sound.
- **The lanes' dock, three nits (10-15)** (`src/replay/soundlanes.ts`; only under `?soundlanes`; no switch, nothing that plays changed): THE CORNER MAP GOES WITH THE HUD —
  `#tapemap` joins the `HUD` list, so `body.sndfilm-on` hides it for as long as the recorded picture is up and it is back the moment the HUD is (it showed NOW's places on
  THEN's picture and sat on its corner; the bar and the big map, M, stay). THE CARD UNSCROLLED SHOWS WHAT IS USED MOST: the mixer's three dials (pitch · level · tone — the
  low-pass, "lp" before) are one row of three cells (`.d3`: word, a 44 px number and a fixed 16 px unit over the slider, so the number boxes line up and do not move when a
  unit appears; a moved one is white, without the "•") right under the flag and note, so ▶, the takes and all three are in sight with the card unscrolled at the two sizes
  checked, 1280×800 and 1440×900; the picture, the take's own filters (`post`: hp, bell) and the layers follow and scroll. MORE LANES THAN FIT: a row at the foot of the
  names (`.ft`, there only while the lanes do not all fit) says how many are below, "▾ 4" (live; nothing at the list's end), and the edge above it fades (`.fd`) over the name
  that is cut; neither takes the pointer, and the wheel over the foot scrolls the list. `#sndfilmtag` and `#sndnopic` are opaque. The recorded picture already fills what
  the dock leaves of the view (height-bound at 1280×800): not enlarged. Held by soundlanes-page.cjs (the map hidden and back with the HUD; ▶, takes and the three dials whole
  inside the card at both sizes, at rest and moved to +1200 ¢ / −23.5 dB / 12000 Hz with the number boxes where they stood; the mark's count against the lanes really
  below after real scrolls, gone at the end). Headless, software adapter only: NEVER SEEN ON A GPU, never used by a person.
- **The listening page's replay links play in the same window (2026-10-15, his "replays should just play in the current window, not open a new tab").** `src/sounds/main.ts link()` sets no
  `target`; the selected row's name is kept for the visit (`sessionStorage` `sounds.sel`, written in `select()`, read where the rows are built) so Back lands on the row that was left, in view.
  Votes and notes were already saved on every change (`localStorage`, and the page's `db` when published), so leaving costs nothing. Check: `tools/qa/sounds-page.cjs` ("no replay link opens a
  new tab", "back on the page, the row that was selected is selected again and in view"). Headless only.
- **The new guns' reports and reload sounds (10-18)** (`src/audio/sfx.ts`, fifteen rows; the rows of `weapons.ts` name them in `own.voice`, read through `gunlook.ts voiceOf` only with
  `GUNLOOK` on; the feeding sounds are `gunreload.ts`'s to play). REPORTS, each built as the four older ones are (a front, bands of noise, slaps, the room, the action's steel):
  `mk12Suppressed` (5.56 from a long barrel through a longer can: lower and rounder than `rifleSuppressed`, centroid 0.85 kHz against 1.6, buffer at 38 ms, bolt at 82),
  `mp7Suppressed` (the smallest and highest: nothing under 350 Hz, a light bolt at 14 / 34 ms, a sixth of a second of room so fifteen a second keep a floor — a string dips 28 dB
  between rounds), `mk46Report` (one hard front, no fireball's second one, the carrier, a link and the bolt in every round, a short thin tail: twelve a second dip 21 dB),
  `m1014Report` (two wide fronts, no crack, 39 % of it under 150 Hz, the gas action at 45 / 62 ms, a second of dark tail), `m870Report` (the same shell from a short barrel with
  more bark, NO action in the shot, then the pump by hand: back at 0.30 s, forward at 0.48, the hollow tube under both — the row's 0.9 s between shells holds it), `hk45Suppressed`
  (no crack, a low soft front, then a heavy slide at 30 / 68 ms nearly as loud as the shot: the quietest gun), `g18Report` (the bare 9 mm with what stacks cut short — six slaps,
  a quarter second of tail, a fast slide at 12 / 30 ms: twenty a second dip 17 dB). FEEDING: `beltCoverUp`, `beltBoxOff`, `beltBoxOn`, `beltLay`, `beltCoverDown`, `chargeLmg`
  (the Mk 46's belt change, in that order), `shellIn` (one shell into a tube: ONE buffer, so each play is dealt its rate — 0.94‥1.06, off the shell's place in the tube, `gunreload.ts shellRate` — and no two neighbours are the same) and `boltDrop`.
  LEVELS (`HEARD`) are set by hand against the older rows, there being no table before them: the two shotguns just over the bare pistol, the belt gun and the Glock 18 just
  under it, the MP7 and the HK45 under every other gun. None is in `sfxWas.ts`, so `?oldsounds` plays these too. ON THE LISTENING PAGE (`src/sounds/catalog.ts`): a group of
  their own, 'New guns: reports and reloads (first takes)', second on the page — each report alone and as a string at its row's cadence, each feeding sound alone, the whole belt
  change on the `beltCoverUp` row, four shells and an empty M1014's reload on the `shellIn` row. The gains of the feeding rows there are the game's own (`gunreload.ts feedCues`: 0.8 to 0.9, the
  first shell dropped in the port 0.6); the belt change's times are the Mk 46 row's beats, by hand. CHECKED: every one finite, under full scale, no longer than
  declared and at its level at 48 and 44.1 kHz; `gunfire-table-check`, `sound-takes-check`, `audio-render` and `sounds-page.cjs` (every row and every other use plays, nothing on
  the console) ALL PASS. FIRST TAKES, WRITTEN BLIND: NOBODY HAS HEARD ONE. `sound-sheet.ts` says of `mp7Suppressed` 'colour never moves' (as it does of `rifleSuppressed`).
- **A lane's light scales with the playback speed (2026-10-19).** `src/replay/soundlanes.ts ring(dur)` = `max(0.15, dur) × tape.speed`: the light is timed on the tape's clock and the sound
  plays at wall speed, so a 1 s sound is lit 4 tape seconds at 4× and a quarter at ¼× (before, it went out early at 2× / 4× and would have hung on at ¼× / ½×). A speed changed while a
  sound rings is not followed. Check: `tools/qa/soundlanes-page.cjs` ("a lane stays lit as long as its sound is heard at any playback speed"). Headless only, never seen on a GPU.

- **The sound table is made before the first click, a voice at a time (2026-10-19, a play test: "a hitch in the audio right when it gets started").** `src/audio/audio.ts SFX_WARM`
  (ON; `?sfxwarm=0` = the whole table inside the first click, as it was — a switch of the page: no knob, no stand row; a benchmark page and a muted or kit-picture page do not warm).
  The mixer cannot start before a click, and it synthesised all 81 voices inside it (0.8‥0.95 s in bun on the cloud machine). Now `main.ts` calls `warmSfx()` as soon as the engine
  is asked for: `sfx.ts buildSfxLater` builds the table with every row the CALL that renders it (`lazy`; each voice has its own seed, so one rendered alone is the same samples),
  `gameSfxLater` lays the old voices over it as `gameSfx` does (a `WAS_IN_GAME` name's redone voice is no longer made at all), and one voice is rendered per idle moment
  (`requestIdleCallback`, only in a moment long enough for the usual voice; half a second without one is one anyway). `AudioEngine.start()` hands the mixer what is made and takes
  the rest as it comes; a voice asked for before its turn is made on the spot (`play`, `again`). The rate: a page cannot ask its output's rate before the click, so it warms at the
  rate the mixer last started at in this browser (`localStorage twopointsix.sfxRate`), 48000 on a first visit; a wrong guess drops what was made at the click and makes the table
  at the device's rate the same way. Only the first mixer on a page is fed. `window.__sfxWarm()` = `{left, waiting, slices, longest, rate, live}`.
  Checks: `tools/qa/sfxwarm-check.ts` (bun: one at a time and out of order = the whole table sample for sample at 48000 and 44100, both tables; the hand-over, a second mixer, a
  wrong guess, a voice asked early; `SFXWARM_BREAK=1` must fail) and `tools/qa/shaderwait-page.cjs` (the real page: every sound made before any click, the mixer's start under a
  third of `?sfxwarm=0`'s, the buffers there — measured there, three browsers sharing the cloud machine: 678 ms against 2918 ms). What is still inside the click: the mixer's own
  set-up (`webaudio.ts`'s reverb impulse, the ambience loops, the score's backend) — about a quarter of what the click was. Nobody has HEARD it: the samples are equal by the
  check, the start's timing on a real output is not measured.
- **The wall hold's two voices (2026-10-21)** (`src/audio/sfx.ts` rows `wallOn`, `wallOff`; played by player.ts `wallVoice` under `WALLSNAP.voice`, see
  `stealth.md`, 'The wall hold, heard and unhurried'). `wallOn` 0.42 s: a soft knock with its weight between 100 and 500 Hz (a laptop's speakers carry it;
  54 % of its energy under 500 Hz), two brushes of cloth, two ticks of webbing. `wallOff` 0.34 s: cloth swelling in with a little stick-slip, then a sole
  turning on the floor at 0.13 s (25 % under 500 Hz). Plain `render` rows, not levelled to a `HEARD` number (no voice before them to keep a level from);
  both on the listening page under 'hands'; the old table (`sfxWas.ts`) has neither, so `?oldsounds` plays these. Graded by `tools/qa/audio-render.ts --all`
  and held by `probes.ts wallfelt`'s table line. Played at `WALLSNAP.voiceOn` 0.35 and `voiceOff` 0.5. Written blind: nobody has heard them.
- **The grab's three voices (2026-10-23; the maintainer's picks 10-24)** (`src/audio/sfx.ts` rows `grabCatch`, `gunStrip`, `gunDown`; other takes in `sfxAlt.ts`; rows on the
  listening page under 'hands', where `grabCatch` also plays the whole grab in order, pistol and carbine). The maintainer: "we should also make the grab super
  satisfying. cool animation where sam disarms him and satisfying sounds". They ride the disarm move's switch (`HOLD.disarm` under `HOLD.dropGun`, both in `src/game/character.ts`; the rule is `game/disarm.ts`): ON in the page
  (`?disarm=0`), off in the module and on the frozen stand (`TPS_DISARM=1` with `TPS_HOLDDROP=1`); off, the grab says what it said (`grabScuffle`, the knocked-out
  gun's borrowed `magDrop`). WHO PLAYS WHAT: `player.ts startGrab` (through `disarm.ts disarmCatch`, one condition for all three) plays `grabCatch` at his throat on the grab's frame (gain 0.5, rate pinned to 1 so the beat does
  not wander); `game/disarm.ts take()` plays `gunStrip` at the gun on the frame it leaves his hand (0.45; 0.25 s after the catch); the item's
  first landing plays `gunDown` ONCE at the floor (0.4, less for a slow landing; 0.70 s after the catch, pistol or carbine, on open floor and beside a wall alike (he throws it short of a wall in its way), 0.62 s when
  Sam's own pistol raps it out; measured on one staging each, seed 4471, the same on both stands). It knocks for a face that looks up (a floor, a step, a slab's top), never for a wall.
  All of these are counted as the page plays them, on a man taken by the row's key inside a step (`grabvoice` does so; `startGrab` called from outside a step is a frame ahead of its own voices).
  WITH THE DISARM LEADING (`HOLD.stripFirst`, on in the page, `?stripfirst=0`; the close-in work's rule, `docs/agents/stealth.md`, the disarm leads) the order is the strip 0.15 s after the frame he is taken on, the catch at 0.27 s as the
  arm lands (played by `disarmTick`), and the gun down still at 0.70 s: he lets go sooner and the timed fall is longer by that in whole steps (`disarm.ts`, the call of `letGo`). The
  maintainer's beats were picked on the page with the catch first; the listening page has both orders (the gun-first rows are under `gunStrip`, timed from the strip: catch 0.12, protest 0.32, gun down 0.55), and `grabvoice` holds all four rows to the game to the frame. NOBODY HAS ASKED HIM which order his 0.25 s was meant for.
  Gains: `disarm.ts DISARM_GAIN`. A carbine is the same strip and knock at rate 0.8; the rapped strip is at 1.12. `heldProtest` still comes in as the hold locks.
  HIS PICKS (10-24, by ear on the listening page: "catch: new 1 · strip: new 2 at 0.25 s · gun down: in the game at 0.70 s"): the catch and the strip are
  the takes he chose, moved from `sfxAlt.ts` into `sfx.ts` with their seeds (the same buffers to the sample; their places in `sfxAlt.ts` are `PICKED`, so
  the take beside each keeps its number), the knock is the first one written, and the two beat times are the move's own now (`character.ts HOLD.strip`,
  fourth pass: `stealth.md`, 'The grab's disarm'). THE VOICES: `grabCatch` 0.32 s, the forearm dragged over his collar, a soft bump 0.055 s in, his breath
  pinched off (half its energy above 2 kHz: more sleeve than thump); `gunStrip` 0.16 s, one snap and, 0.13 s later, one click, nothing between them;
  `gunDown` 0.30 s, one knock and three dying ticks. In the game by `audio-render.ts`'s yardstick (dB against the takedown's `bodyHit`): catch -1.1 (the
  scuffle was +0.8, the whip is +7.6), knock -2.8, strip -4.1. WHAT THE ROOM HEARS is what it heard before, to the number: the grab's one `prop` event at level 0.12 on the grab's frame and nothing for the
  strip or the gun set down (the knocked-out gun never was an event either). A second man 3.5 m off on open floor goes from 0 to 0.083 awareness and turns to
  look, one 4.5 m off hears nothing (the rule is `guards.ts`: heard while `0.12 * (1 - d / 12)` is over 0.08, so just under 4 m, less through a door).
  Checks: `probes.ts grabvoice` (`tools/qa/grabvoice-check.ts`, family `grab`: each voice by frame, place, gain and rate; the listening page's whole grab on the
  game's beats; the move's key without `HOLD.dropGun` = the scuffle; a carbine; the pistol hold; the same frame and place for the knock on a second die (two
  seeds: this is one staging, not a tally); let go before the take; the room's one event and the two listening men; `GRABVOICE_BREAK=1` must fail; it raises
  both keys itself, so it asks the same on both stands; since 10-24 it stands on open floor, holds BOTH page rows (pistol, carbine) to the game's beats to the frame, and has a line beside a wall). `probes.ts audio-hold` asks for the grab's first voice by the keys (`grabVoice`), and `holddrop`
  holds the move off to ask the older rule's own frame. Also `audio-render.ts --all` (the three graded as he picked them: cloth and a soft bump, a dry snap, a dull knock, each loudest
  at its start) and `sound-takes-check.ts` (the four takes still offered, and his two picks' places). `tools/qa/grab-sounds-render.ts <dir>` writes every take and the whole
  grab, old and new, as WAVs with their numbers. He heard the takes on a page that plays the game's buffers at the game's gains with no room on them;
  nothing was heard through the real mixer's room or in the game, and the rate 0.8 was never judged as a carbine.
- **A fire's two voices (2026-10-23)** (`src/audio/sfx.ts` rows `fireBed`, `fireCrack`; played by `game/fire.ts`, the whole rule in `docs/agents/render.md`, "An
  open fire burns"). `fireBed` is 7.6 s of low, slowly swelling noise with sparse ticks, looped between `FIRE_LOOP`'s marks 0.12 and 7.12 s (`rollLoop` takes a
  span now; `audio.ts FOLLOW_LOOPS` has the row) and held as a follow voice at the drum: the fire asks for one on its first frame, again when it is lit again after a restart or a load (the book of what was asked is the host's, `engine.hostBooks.fire`,
  dropped by who abandons the moment: the old voice lets go; a still frame keeps it; a page frozen past the mixer's own hold has no bed until the next mark), and
  hands on to a fresh one every `FIRE.bedSecs` 12 s (a followed voice is let go after its own time, and one the mixer never took is asked for again then); its
  level and pitch follow the fire's heat (the follow voice's `k`, ⅔ at full heat). `fireCrack` 0.3 s plays with each pop of the wood, the same pop that throws embers and kicks the light, at
  `FIRE.crack` 0.55 × how hard, its rate 0.8 to 1.3. Levelled by hand under a footstep on a hard floor (`HEARD` 0.03 and 0.075). The mixer's alone: no sound
  event is filed, nobody in the game hears a fire. Both on the listening page under 'things'. Off with `?fire=0`. Written blind: nobody has heard them.
