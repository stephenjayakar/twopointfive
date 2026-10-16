# The night showcase (Director program `night`) — lane notebook

## WHERE I AM / NEXT (resume block — keep ≤ 15 lines, update on every commit)
- Worktree `.worktrees/night`, branch `feat/night-showcase` from main @d937da7. Spec: docs/design/showcases.md (§ NIGHT beat sheet + Decisions 1/2/3/4/8).
- DONE: program `night` in `levels/office.script.ts` (eight chapters + the tour's hand-over, 188 s), the Director's showcase additions (§3), the wiring (start card ▸ Night
  showcase, `?demo`, P — all `director.start('night')`; `__night`), `tools/qa/night-probes.ts` = `probes.ts night` (night-run / night-restore / night-tour), sixteen framings
  placed by eye on :5262 with a still per chapter (`docs/shots/night_ch*_*.jpg`), this notebook.
- GATES (re-run after the review pass @66010a9): typecheck ✓ · `probes.ts night` ALL PASS (13 lines) · `sh tools/qa/gate.sh director breach` EXIT 0 (10 / 15 PASS, 0 FAIL — the
  breach's frozen beat log still reproduces frame for frame) · `tour.ts` PASS (2/2 before, 1/1 after the player.ts aim line) · `probes.ts selector` ALL PASS · `bun run build` ✓ ·
  the page on :5262 (high and medium): started from the card's button, from `__night.start()` and from P, stopped by P at 2 s (everything back), run to the end three times
  (finished, veil whole at the hand-over frame → 0 within 0.6 s, caption up, floor live), P over the held caption starts run 2 and P again stops it clean; no console / GPU errors.
- NOT done (§7): demo.ts is NOT deleted (unreachable from the UI; tour.ts still laps it); no wet PRINTS visible on the lino (§6); the tour as its own program (M2).
- NEXT: the lead's merge; the maintainer's eye on §6's taste list.

## 0. Ten-line summary

`levels/office.script.ts` now carries a second program, **`night`** (`showcase: true, lowerThird: true, freshEncounter: true`): the office after dark played as ONE continuous
infiltration by the REAL player on the puppet's strings — he taps his own interaction rows (`c.select` + a queued Space), so every verb shown is the game's: the fire exit
eased in the rain and its sodium wedge across the lino · Kowalski's coffee run into the hold, the side door's code out of him (`c.learnCode` → `Player.codes`), the choke, the
body hauled along the counter · the corridor camera's fixture put out with the OCP from the north doorway, the crossing west under the shin laser with Reyes's torch beyond it ·
a smoke canister down Novak's aisle, his line, Sam behind the plume 4.6 m off him for the doorway · the keypad taking the code it heard a minute earlier, the drive out of rack 6,
Control sending Reyes (the mission's own `sendRackCheck` — the mission thread runs live under the puppet for that chapter) · the storage lock picked under the chest beam, the
breaker put out THROUGH the eased doorway, the beacons, two seconds of the tube, Control's line · out through the break room under the sweeping beacon past the body, the
restrike group by group, the fire exit, a far stroke · the tour's hand-over card verbatim and a live floor. 188 s; the hand-over at 180.0. The three staff men are taken in hand
(`c.order`, blind while scripted) at show seconds their authored routes already put them where the beat wants them; Sam is invisible to the AI throughout (the showcase runtime's
flag) — nobody's eyes decide anything, the picture does. Deterministic: two seeds land every one of the 36 spine beats within a second of each other (night-run).

## 1. The chapters as built (seed 11, headless trace; the page runs the same clock)

| # | lower third | show s | what happens (beats in `director.log`) | set-ups (`NS.*`) |
|---|---|---|---|---|
| 0 | 02:14 · east lot | 0.0 – 16.5 | veil up on Sam crouched by the fire exit in the storm (`c.weather({storm .7, rain .55, seed 214})`), the near stroke on cue at 1.6 (`stroke1`, bearing 1.75 rad, 34°, 1.1 km — the whole lot goes blue-white for a quarter second, thunder 3.2 s on) | `lot` — from the ENE clear of the lamp post, pushing in |
| 1 | 02:14 · the fire exit | 16.5 – 29.2 | `tap door:ease` → the leaf eased by hand (`door:eased`), the sodium wedge fans across the lino toward the lens, Sam through at 20.3 (`inside`), down to the hide south of the door's sweep | `doorIn` — inside, low off the lino from the WSW |
| 2 | 02:15 · break room | 29.2 – 65.4 | Kowalski's radio line as the chapter opens (`kow:coffee`, his needs line verbatim), through the north door with the torch low (`kow:in` 34.5), at the machine (`kow:counter` 38.2); Sam's creep; `tap guard:grab` 46.8 → `held` 47.2; the pair turned off the counter toward the door; SAM 'The side door. The code.' 48.7 → Kowalski's answer 51.0 → `code` (learnCode pad_side, news) 51.5; `tap held:choke` 55.1 → `kow:down` 58.1; `tap body:drag` 59.6 → hauled 2.45 m along the counter → `tap body:drop` → `dragged` 64.2 | `breakWide` (the torch through the haze), `hold` (tight from the west, tracking Kowalski), `drag` (higher, tracking Sam) |
| 3 | 02:16 · corridor | 65.4 – 83.9 | up to the north door, `tap door:ease` 70.0 → eased into the corridor (−1.3 rad, 72.4); the Five-seveN out; `ocp:panel` 73.6 = RMB on `panel_corridor_20` snapped under the ring — the pool under the corridor camera dies for `tune.ocpDuration`; Reyes cued up the corridor from the lobby (`signal:corridorDark`); Sam west along the dark corridor at a crouch-walk, the cut to the over-shoulder once he is past the leaf (80.8), into the cubicles' east opening (`crossed:corridor` 83.9, Reyes then at x 9.5 with 14 m of corridor and the shin beam between them) | `corrDoor` (from up under the corridor camera, west), `corrWest` (over the shoulder: the laser's line, the torch beyond) |
| 4 | 02:16 · cubicles | 83.9 – 103.0 | Novak sent east down the north aisle (`novak:go`); `smoke:thrown` 85.0 (slot 3, `puppet.throwAt` (20.7, 13.35), a real canister → a real solver domain); Novak walks into the light of it and stops: '…what is that?' 87.3 (`novak:what`), creeps a stride nearer and holds (`novak:stopped` 92.5, torch on the plume); Sam waits for Reyes's torch to pass the doorway east (`reyes:eastEnd`), then goes behind the plume for the corridor: `crossed` 100.8 with **gap 4.62 m** to Novak | `cubAisle` (down the aisle from the east: Sam near, the plume, the torch), `cubCross` (high from the NE: the man, the plume, Sam) |
| 5 | 02:17 · server room | 103.0 – 136.2 | `c.mission(true)`; the rail light on (L) through the unlit manager's office; `tap door:code` 107.4 → `code:entered {open: true}` 108.6 (the pad took the code from ch.2 — `Player.codes` had it, `padState` did the rest); to rack 6, `tap objective:drive` 112.7 → `drive:pulled` 116.2 (the mission's own DRIVE_SECS); light off; back through the side door to wait in the dark office; Control's line at pull + 6 s and `release Reyes` → the mission's `sendRackCheck` picks him: `reyes:sent {state: suspicious}` 123.2; `c.mission(false)`; his weapon light comes up the corridor and past the office (`corrTorch` tracks him) | `officePad` (in the office, west onto the pad), `serverRack` (along the rack fronts), `corrTorch` (ahead of Reyes, tracking) |
| 6 | 02:18 · going dark | 136.2 – 167.6 | Reyes ordered on west to the corridor's far end (`reyes:west`); Sam east to the storage door; puppet released for the pick (`updatePicking` breaks off under a puppet goal): `tap door:pick` 143.5 → `picked` 147.9 (4.2 s, the real clicks); `tap door:ease` → −1.38 rad; to the one square metre of corridor that sees the breaker through that doorway (30.55, 10.5); `ocp:breaker` 153.1 (RMB, `lighting.ts ocp` → its own LOS test → `setBlackout(ocpDuration × 2.5)`) → `blackout {ok: true}`; the beacons; `nv:on` 154.9 → `nv:off` 156.9 (two seconds of the tube, N); Control's line 157.7 (Novak, scripted in the cubicles, is the man `setBlackout` radios — Control answers him); through the north door, across the break room under the sweeping beacon past Kowalski's body; `mains:back` 164.1 = `c.lights.mains(true)` at dark + 11 s → the restrike group by group on the fixtures' own staggers (corridor 2.8 s, break room 5.3 s …); `tap door:push` on the fire exit 167.2 | `storeDoor` (low from the WSW: the pick under the beam, the corridor away west with the torch at its end), `blackout` (from the corridor's east end west: beacon, beam, exit sign, the tube), `breakDark` (the break room's SW corner) |
| 7 | 02:19 · east lot | 167.6 – 180.0 | out into the rain (`outside` 169.5, holstered), the far stroke 172.5 (`stroke2`, 3.4 km, 22°), the leaf swinging to on the wedge | `lotOut` — outside from the ENE, pulling out |
| — | (hand-over) | 180.0 – 188.1 | `c.handover(…)`: the tour's last stop verbatim — weather back, aftermath + smoke cleared, `restartEncounter()` under a whole veil lifted 0.1 s on (`c.fade(0, 0.45)`), flags live, camera unpinned on Sam at the spawn, input unlocked, caption 'Your turn — …' for `NT.handoverHold` 8 s, then `finish` (no second restart: `exitShow` sees `handedOver`); P over the held caption starts the show afresh; a `watchdog` beat at `NT.watchdog` 260 s makes the same hand-over itself if the spine never got there | the player's own camera |

Length **187.98 s** (the beat sheet asked ~3:00 + hand-over). The chapter strip under the lower third is `c.chapters([...])` with the same eight titles.

## 2. How it is staged (the decisions that make it deterministic)

- **Fresh encounter at t 0** (`ProgramOpts.freshEncounter` → `enterShow` calls `restartEncounter()`): the shift's three men start on their routes' first points every run, so a
  show second is a place. Each man is taken in hand (`c.order`, `upper: 'none'` = the torch carried low as on patrol; a scripted staff man perceives nothing) at the second his
  own patrol has him where the beat wants him: Kowalski held at the corridor's east end from 28.3 (his route's wp1 dwell), Reyes parked at the lobby desk at 58, Novak at the
  cubicles' NW corner at 62. Before those seconds they are simply patrolling — the torches you see moving in chapter 0–1 are the real patrol.
- **Sam is the real `Player` under `Game.puppet`** (goal / aim / crouch / walk / fixtures / throwAt) plus queued keys and clicks (`c.press / c.click` → `Director.injectInput` at
  the top of the NEXT `Game.update`, because the tick runs after `updatePlayer` and `input.endFrame()` clears edges). Every verb is his own row: `tap(kind, verb)` =
  `c.select` (→ `Game.selectVerb`) the frame the row is offered and in reach, then Space. Nothing is faked through a side door: the ease is `Player.easing`, the grab / question /
  choke are `Hold`, the drag is `dragging`, the OCPs are `g.ocp()` off `aimTarget` (fixtures snapped within 60 px of the projected aim point), the code is `Player.coding`, the
  pull is `mission.driveT`, the pick is `Doors.pick`, NV is the N key, the rail light is L, the canister is slot 3 + LMB with `puppet.throwAt`.
- **`playerInvisible` is up for the whole show** (the showcase runtime's flag, as for the breach): the plume, the dark, the timing are staged to READ as stealth; no guard's
  eyes are consulted. night-run still asserts nobody went alert and nobody's `canSee` fired on him (the flag makes that vacuous for eyes; ears are live — the pick's clicks, the
  doors, the canister's clank are all under the men's thresholds at those distances, which the probe does exercise).
- **The code pays off for real**: `c.learnCode(pad, kow)` = devices.ts `learnCode` (the same call the interrogation's `'code'` intel makes) → `Player.codes` → a minute later the
  `code` row is what `buildInteractables` offers on `server_manager` and `padState` opens it. Kowalski's LINE is authored text with the digits in it (`NL.kowCode`, '7-3-9-1');
  the pad's code is the level's (`devices[].code`). If the level's code changes, the line lies — night-run asserts the door opened, not the words. (Taste item §6.)
- **The mission thread runs live only for chapter 5** (`c.mission(true/false)` = `Game.missionInTour`): the room announces itself, the rack's row is offered, the pull runs on
  `DRIVE_SECS`, and — because Reyes is `release`d the frame before Control's line — the game's own `sendRackCheck` picks him and sends him. Off again before chapter 6 so
  the exfil stage cannot raise the debrief card when Sam walks out of the fire exit.
- **The breaker is put out through physics, with a net**: `lighting.ts ocp` on the breaker tests a segment from Sam's head to the panel face; the storage door eased to −1.38 rad
  leaves a band about a metre long on the corridor floor that sees it (x 30.2–31.2 at z 10.45–10.55, found headless — `scratch geo.ts los2`); the beat walks to (30.55, 10.5),
  waits ≤ 1.5 s for the snap, clicks. If the mains are still up 1.2 s later the beat notes `blackout:byHand` and calls `c.lights.mains(false)` — night-run FAILS on that note, so
  the net is for a live page whose door got nudged, never a way to pass.
- **A watchdog owns the ending**: `P.after(NT.watchdog = 260)` starts a beat that — unless the spine flagged `handedOver` — cancels the spine, makes the hand-over and finishes.
  Whatever a system fails to answer, an unattended kiosk gets its card back inside 4½ minutes.
- **Every wait on a system carries a clock** (`untilT(c, pred, label, secs)` = `c.any(until, wait)`): a wait that runs out logs `late {what}` and the beat goes on to the next
  thing it can do; night-run counts a `late` as a failure. `walk()` caps each leg (14 s → `walk:capped`), `tap()` gives up after its seconds (`tap:missed`). The show cannot hang.
- **Weather**: `c.weather()` saves storm / rainRate once, pins them, reseeds the storm's own dice (`Weather.seed(214)`), and `strike()`s on cue; `exitShow` / `handOver` put the
  two numbers back. The scheduler's own strokes still happen off the seeded dice between the two authored ones (deterministic given the seed).

## 3. What the Director gained (all showcase-scoped, all in the head comment of director.ts)

`D.device(id)` handle + manifest lint (an unknown device disarms the script) · `c.learnCode(device, from?)` · `c.say(unit | 'sam', line, {radio})` (forced past the chatter
gates; Sam's line = his bubble + murmur + a `SAM:` radio row) · `c.puppet(spec | null)` (goal / aim / crouch / walk / fixtures / throwAt) · `c.press(key)` / `c.click(button)`
QUEUED into the next frame's input (`Director.injectInput`, called first thing in `Game.update`; cleared by `stop()` and on show entry) · `c.select(kind, verb)` · `c.view:
SamView` (a read-only snapshot of the player: pos, hover row, rows, holding, dragging, easing / picking / coding, driveT, pulled, codes, aimTarget, ocp charge, canisters …) ·
`c.weather({storm, rain, seed, strike})` · `c.mission(on)` · `c.handover(caption, sub)` + `DirectorFrame.handedOver` (main.ts skips the pitch easing and the pin; the chapters
strip and lower third drop) · `ProgramOpts.freshEncounter`. `SHOWCASE_VERBS` grew `select view weather mission handover` so `scanShowcaseVerbs` refuses them in a play program.
`exitShow` also clears `missionInTour` and ends a timed blackout; after a hand-over it restores only `touring` (the hand-over already handed the floor back).

## 4. Wiring

main.ts: `startNight()` (refuses while a show runs; pokes attract; closes the menu; `director.start('night')`; syncs the body class) is what the start card's **Night showcase**
button (`MenuDeps.startTour`), `?demo` (1.5 s after boot, as before) and **P** call; P during the show stops it (the Director's own key). `onProgramEnd('night')` reopens the
start card when the show was started unattended (attract → showcase hand-off, as the tour did). `__night {start, stop, active, t, handedOver, log, chapters, summary}`.
`src/game/demo.ts` is untouched and no longer reachable from the UI; `tools/qa/tour.ts` still laps it (2/2 PASS) and `probes.ts night-tour` laps it after a night run.

## 5. QA — `probes.ts night` (tools/qa/night-probes.ts; also `bun run tools/qa/night-probes.ts trace|run|restore|tour [--seed N]`)

```
- PASS — seed 11: runs to its hand-over and end by itself inside the authored length
- PASS — seed 11: the spine's 36 beats all present and in order (D.expect.order), no tap missed, no walk capped, no wait run out, no by-hand net
- PASS — seed 11: the systems paid off — the code learned in the hold then taken by the pad, the camera's fixture really out, the drive really out and Reyes really sent,
         the mains really down then back, the body hauled, the crossing 2‥6 m from Novak
- PASS — seed 11: Sam never hit or down, nobody alert or with eyes on him, nothing NaN, ≤ 8 characters, the camera pinned verbatim through the show and the player's after the hand-over
  (the same four for seed 12)
- PASS — two seeds: every spine beat lands within a second of itself
- PASS — run to its end (the hand-over): three fresh guards on their routes with their own lit torches, night, nothing in the air, Sam at the spawn playable, every switch and
         door as authored, the storm as it was, the mission fresh, no code kept, input free
- PASS — P at 30 s: (the same list)      - PASS — P at 140 s: (the same list)
- PASS — 13 stops, no throw, guards = routes throughout, Sam never hit          (the old tour after a night run)
=== probes.ts night: ALL PASS · 3 probes run ===
```
`gate.sh director breach night` EXIT 0; `tour.ts --runs 2` PASS; build ✓. In the page (high, 1777×1000): started from the card, from `__night.start()` and from P; stopped by
P at 2 s (flags / lock / pin / storm / guards restored); run to the end twice (finished: true, classes cleared, floor live, no console errors).

## 6. For the maintainer's eye (taste, one line each — all constants in `levels/office.script.ts` `NIGHT / NT / NL / NS`)

- **The hold is dark.** The pair stands at the coffee machine 5 m off the vending fronts at a steep angle to them; turned toward the door they read as silhouettes + goggles +
  his raised hands (night_ch2_hold). Options: stage the coffee spot 1.5 m south (more of the machines' glow), or let Kowalski's dropped torch die slower. Left as built.
- **The corridor's opening set-up has the eased leaf large in frame** for ~3 s (night_ch3_corridor_lit): the north door swings INTO the corridor toward any lens east of it and
  faces any lens west of it. The over-shoulder cut (night_ch3_corridor_west — the laser's line, the torch beyond) is the frame that sells the chapter; an ease to ~45° instead
  of 75° would shrink the slab (`> 1.3` in the spine → `> 0.75` + a Space to stop the ease).
- **Kowalski's code line carries the digits as text** ('7-3-9-1' in `NL.kowCode`) while the pad's code is the level's — change one, change both.
- **No wet prints show on the break-room lino** in the stills: Sam is only ~20 s in the rain before the door (coat ≈ 0.55, `WET.prints` steps are laid but faint on the dark
  floor at that framing). A longer chapter 0 or `WET.printK` up would show them; not forced.
- **Novak's '…what is that?' is a bubble over him plus a `Novak (says):` radio row** (`c.say` forced) — the beat sheet's only guard line. Control's two lines and Kowalski's
  needs line are the only other words, all radio, per Decision 2.
- **The blackout's Control line answers Novak**, because `setBlackout` radios the nearest free man and Novak (scripted in the cubicles) is nearer the breaker than Reyes:
  'Novak: power's out — checking the breaker' → CONTROL: 'Negative — stay on your loop…'. Reads fine; it is the game's own errand line, not authored.
- Set-up numbers (yaw °: 0 looks north, 90 west, −90 east; the eye sits `dist` back, `pitch` up): all sixteen in `NS`, each with the reason it sits where it does. Interiors keep
  pitch ≥ 12° (a level lens shows the sky where the NoPrimary ceiling is) and the eye inside the room it looks at (or above 3.2 m).
- `NT.handoverHold` 8 s of caption before `finish`; `endVeil` 0.35 / `endHold` 0.4 are moot after a hand-over (no veil: the floor is already the player's).

## 6b. The background review (one pass over the whole branch) — what it found and what happened to it

FIXED: unbounded waits after taps (→ `untilT` everywhere + the watchdog) · a refused start from the attract loop stranded a closed card over a live floor (→ the card
reopens) · `canStart` refused *night* with `tune.teams` off over the BREACH's loadouts (→ the gate counts only a program whose beats spawn) · the hand-over rendered its
restart frame through a 96 % veil (→ the veil stays whole until the beat lifts it) · `handOver` restarted the encounter with a spawning program's cast still listed (→ cast
out first, as `stop()` does) · P over the hand-over's held caption silently stopped the run its card says P restarts (→ P there ends it finished and starts afresh) ·
night-restore's storm line was vacuous (the show's numbers = the module defaults → the probe now sets 0.4 / 0.3 first) and nothing checked the pin / lock / flags after an
ABORT (→ `restoredCheck` does) · the alert de-dup keyed on the wrong string · 'nobody with eyes on him' oversold a check the runtime's invisibility makes moot (→ worded so).
Also found on the page, not by the review: a scripted aim was the eye's ray THROUGH the projected point, so a leaf or a man between a set-up behind Sam and Sam turned his arm
round on it (the office door he had walked open: he aimed back over his shoulder, rail light in the lens) → `player.ts updateAim`: under `puppet.aim` the point itself is
the aim point; the cursor still places the ring / snap / hover. The tour's puppet recipes ride the same line (tour.ts 2/2 PASS after it; its aims were never occluded).
CLEAN per the review: every restore path (finished / P / thrown beat), `injectInput` ordering (nothing fires under the pause card; cleared on stop / entry / hand-over),
use-after-restart at the hand-over, `samViewOf` when down / empty-handed, the main.ts wiring's polarity and chaining, no Guard field read by the script.

## 7. Not done, and why

- **`src/game/demo.ts` is not deleted** (Decision 7 says the old tour goes once NIGHT replaces it). It is unreachable from the UI (card, `?demo`, P all start `night`), but
  `tools/qa/tour.ts` — a merge gate — laps `Demo` and asserts its 13 stops; re-pointing tour.ts at the night program is a probe rewrite (night-run already covers the same
  ground: ends by itself, Sam never hit, restore) that belongs in a clearly separate commit with the lead's say-so. `probes.ts night-tour` proves the two coexist.
- **The tour as a Director program (M2)** — not attempted; `night` is written straight against the Director, not ported from demo.ts.
- **No new gameplay system.** Everything shown is a shipped system through its shipped entry point; the Director additions are verbs over existing calls (learnCode, say,
  selectVerb, the puppet, the weather's strike / seed, missionInTour) plus the input queue and the hand-over.
- **Wet prints / a longer soak, a 45° ease, a brighter hold** — §6, the maintainer's calls.
- **Cost**: nothing per frame beyond the breach's (one pinned camera, ≤ 3 `order`ed men, one smoke domain in chapter 4, the storm that is on at night anyway). Not separately timed.

## 8. Files

`levels/office.script.ts` (program `night`: `NIGHT` marks, `NT` clocks, `NL` lines, `NS` set-ups, helpers `at / walk / tap / untilT`, beats night · veil · kowalski · reyes ·
novak · corrWestCut) · `src/game/director.ts` (§3) · `src/game/game.ts` (one line: `director.injectInput(input)` first in `update`) · `src/main.ts` (§4) · `tools/qa/night-probes.ts`
+ `tools/qa/probes.ts` (family `night`) · stills `docs/shots/night_ch0_lot(.jpg|_flash)`, `night_ch1_fire_exit`, `night_ch2_break_room_torch / hold / body`,
`night_ch3_corridor_lit / ocp / west`, `night_ch4_cubicles_plume / crossing`, `night_ch5_keypad / side_door / rack / torch`, `night_ch6_pick / blackout / night_vision /
break_room_beacon`, `night_ch7_out / out_stroke`, `night_ch8_your_turn` (in the MAIN checkout's docs/shots — the sink writes there).
