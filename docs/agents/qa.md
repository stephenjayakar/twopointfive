# Run, check, drive headlessly

One of the area files CLAUDE.md indexes. Everything below was moved here word for word from CLAUDE.md on 2026-10-13, in its old order;
"the bullet above / below" in a bullet means its neighbour there (each block says which lines it was), and a bullet named by its bold
title may now live in another file of this folder: `grep -l '<title>' docs/agents/*.md`. New bullets for this area go at the foot of this file.

<!-- was CLAUDE.md lines 244–260 -->
- **THE HARNESS HAS TWO STANDS, AND ONE LIST OF WHAT SEPARATES THEM** (`src/host/profile.ts`). FROZEN (the default) = the stand every frozen digest, tally, probe bound and session
  fixture was recorded on: `src/host/standup.ts standGame({harness})` and `tools/qa/headless.ts` hold the newer rules off, each line behind `pinned('<its env word>')`. SHIPPED
  (`TPS_PROFILE=shipped` in front of any headless tool) = the page as it opens with no URL flag on a machine that has kept nothing: none of those lines runs, `shippedBoot()` calls
  `pageSwitches('')` — THE function `src/main.ts` calls with the page's own query for the switches its boot writes (destruction, furniture, wall reactions, wall charge, the door
  walk) — reads the kit from an empty store, takes the squads' page-only `?radiocheck=call`, and the cast is loaded. `FROZEN_HOLDS` there lists every row the two stands differ in (73 when this line was last touched; the table is the count, not this line)
  with the word that raises each on a frozen run (`TPS_MOVES=1`, `GLASSFX=on`, `SLOTS=on`, `SQUADS=radiocheck-call`, …); under shipped a pin's own word still holds
  (`TPS_PROFILE=shipped TPS_MOVES=0`), except that a PLAY-THROUGH writes the door rules and chaos itself on either stand (`--set` there). Held by: `probes.ts shipped`
  (shipped-check.ts: the two stands differ in exactly those rows, plain and with a mission staged; every pin's word is in `src/host/standEnv.ts STAND_ENV`) and
  `PORT=<dev server> node tools/qa/shipped-page.cjs [name=query …]` (the REAL page on the software adapter, `window.__knobs` against the shipped stand: 0 rows may differ; ~3 min
  a page — run it when a boot switch or a page-only module default is added). `tools/qa/stand-dump.ts [--profile shipped|frozen] [--query q] [--out f] | --diff a b` = every knob
  table, `Game.tune` and the sandbox flags of a stand-up as JSON. `tools/qa/ships.ts` = the play-through under the shipped profile (`--base` = frozen, `--partial` = the five rows
  it raised before the profile existed — frags, `GLASSFX=on`, `TPS_MOVES=1`, `TPS_TURN=1`, `TPS_CAST=1` — which six `*-check.ts` scripts still ask for: their bounds were read on
  it). A plain night or a quiet mission alone stood on the shipped stand has the page's `?solo` Sam (one of each can, one round: `kit.ts kitSoloStand`, asked by `standGame` and `startFromQuery`; frozen = as built, nothing written) — and the PAGE's plain night is that Sam whichever way it was started: main.ts asks `kitSoloIf` for `?solo` and for a page with no mission, show or quiet run in its URL, so the card's own Start no longer hands him the eleven things (`PORT=<dev server> node tools/qa/start-kit-page.cjs`: Start and `?solo` carry the same, after a restart too). What shipped still is not: the player (a scripted commander who cannot be hurt), the GPU's light meter and smoke lines (headless = the CPU stand-in), localStorage, V8.
  STILL ON THE OLD FIVE ROWS and calling it 'shipped' / 'the page': kit-cells.ts, snap-probes.ts `PAGE` (framecost.ts's shipped arms and frame-spikes.ts `--ship` stand on `TPS_PROFILE=shipped` now; the five-row arm is kept there as `shipped5` / `pair5` / `--ship5`).
- **One knob registry** (`src/game/knobs.ts knobRegistry()` — built lazily: the import cycle): every module knob table by name. The session journal (`JOURNAL_KNOBS` = the subset a
  recording carries), `playthrough.ts --set` and its put-back, the probe runner's copy / put-back round every probe (`knobsCopy / knobsBack`, in place, every depth; it also puts back `KIT_SOLO.on`, which is in no table) and the page's
  `__knobs` all read it. A new table = one line there; `bun run tools/qa/knobs-check.ts` holds the round trip and is red on an exported table with an `on` switch that is neither registered nor on that file's `UNREGISTERED` list with its reason (six today: four look tables, the kit's two).
  (Added 10-13, the switches goal's step c28ba4fb:) A TABLE THE PAGE'S BOOT WRITES — any `NAME.key = …` in `host/profile.ts pageSwitches` — differs between the page and the stand a
  replay is stood on, so it is carried by a recording (its name at the END of `JOURNAL_KNOBS`) or excused on knobs-check's `PAGE_ONLY` list with how a replay gets it or why it need
  not (five today: DESTRUCTION and LIVED by a recording's env, LOOK and PLAN picture only, RECAP reads only); knobs-check is red on a written table that is neither.

<!-- was CLAUDE.md lines 319–323 -->
- **The gates.** `bun run tools/qa/missions-gate.ts` (`probes.ts missions-shipped`) plays every squad mission of the Missions list × 2 seeds to its end AS SHIPPED and is red on a run
  that throws or stalls (≈ 4 min at four jobs; not judged: who won); the QUIET rows (`QUIET_MISSIONS`) are played by `solo-night.ts`'s ghost on that tool's own stand, × 2 seeds — for
  them the gate holds 'starts and runs to the debrief', not 'as shipped'. `tools/qa/expected-red.ts` = the reds somebody has explained, by probe name; probes.ts prints its reds against it
  after the verdict (EXPECTED RED · NEW RED · GREEN AGAIN) and gate.sh carries the lines — the exit code is unchanged, red is red. `EXPECTED_RED_SHIPPED` in the same file =
  the rows that hold under `TPS_PROFILE=shipped` only (read on that stand alone, so a probe green on the frozen stand never reads GREEN AGAIN there). tools/qa is typechecked by its own
  `tools/qa/tsconfig.json` (`bun run typecheck:qa`).

<!-- was CLAUDE.md lines 398–468 -->
## Run · build · check

```bash
bun run dev            # tools/serve.ts → http://localhost:5173  (loopback only, HOST=… overrides; game at /, the WORKBENCH at /workbench = level editor + character/prop viewer in one shell; /viewer /editor /gait /index.html forward; GET/POST /levels/ — POST wants X-Level-Editor: 1)
bun run build          # tools/build.ts → dist/ (Bun HTML bundler; WGSL imported as text)
bun run typecheck      # node vendor/typescript/bin/tsc --noEmit -p tsconfig.json   ← run before every commit (vendor/typescript is gitignored: in a cloud checkout run a system `tsc --noEmit -p tsconfig.json` — 6.0.2 passes on src/)
bun run tools/shot-server.ts   # :5174 capture sink (loopback only; CORS granted to loopback pages on any port): __shot() → docs/shots/<name>.jpg, __png() → docs/shots/ab/<name>.png
```
There are no unit tests, but there IS a headless QA harness under `tools/qa/` (the whole Game over a Proxy GPU device, ~1 s
of wall per simulated minute): `bun run tools/qa/tour.ts --runs 3 --quiet` (the 13-stop tour with the by-hand checks as
assertions, exit 1 on failure), `bun run tools/qa/soak.ts --seeds 1,2,3 --minutes 12 --quiet` (seeded randomized soak with
per-frame invariants — among them: the player never crosses a static between frames and never ends a frame inside one), `bun run tools/qa/
probes.ts <name>` (single-situation repros; `player` = the player-side PASS/FAIL set incl. the wall-clip brute force, `wall-clip` = that
family in full with its 4-minute door sweep, `attract` = tools/qa/attract.ts, the start card's attract mode without a page). THE EXIT CODES ARE VERDICTS:
probes.ts runs every probe through one `run(name, fn)` (failed = returned false / threw / printed a FAIL or error line; the rest still run) and exits 1 naming
the failed ones, 2 on an unknown name (the known list printed, nothing ran), 0 with an `=== probes.ts <name>: ALL PASS ===` banner (`NO VERDICT` when what ran
checked nothing); soak.ts exits 1 on any exception / invariant violation and 2 on an unknown `--flag` (the valid ones listed); `sh tools/qa/gate.sh fam1 fam2 …`
prints every sub-family verdict, counts both check-line shapes (`- PASS —` and the editor / level probes' two-space `  PASS`), and is red (exit ≠ 0) on any FAIL /
error line, a non-zero probes.ts exit, or a family that printed neither a verdict nor one counted check (`probes.ts selftest` / `selftest-quiet` exercise the red
paths); `bun run tools/qa/replay.ts <session.json[.gz]> | --all [--strict] [--invariants]` replays SESSION JOURNALS recorded with F10 (the *Session journal* bullet: exit 0 =
identical, 1 = diverged with the frame / field / sensor key named, 2 = bad file; `probes.ts journal` = its self-test + the fixtures in `tools/qa/sessions/`). Run tour + soak after every gameplay merge, and `probes.ts player` after touching movement,
doors' contacts or props. Since 08-12 the runner returns a real verdict (`bun run tools/qa/probes.ts <name|family|all>`: unknown name exits 2 with
the list, any failed probe exits 1, a probe that checks nothing is 'NO VERDICT'; `tools/qa/gate.sh <families…>` prints every sub-verdict, counts both check formats and
exits non-zero on a failure / unknown family / silent probe; it finds a time cap it can use — timeout, gtimeout, a perl alarm — so a stock macOS runs it, `GATE_TIMEOUT` overrides) and the soak rejects unknown `--flags` and exits 1 on any violation. `probes.ts all-quick` (`sh tools/qa/gate.sh all-quick`; ~20 min on the maintainer's Mac before the rebuilt families joined it, an hour on a busy four-core cloud box with them: 170 probes, red today only in `expected-red.ts`'s rows) = the union of the gate lists a lane runs before handing back (perf · player · doors · qrf · checkpoints · journal · ui + every identity card, and since 10-09 the rebuilt game's: roomclear · threshold · silent · lineoffire · doorpath · kit · missions · depot · registry · shipped) where `all` is hours; `probes.ts repros` = the informational who-does-what tables (NO VERDICT by design, out of `all`); `probes.ts list` = the name index. The runner snapshots the module knob tables (CIV, WHISTLE, NEEDS, AIM …) round every probe, so a probe cannot tint the next one's identity digest. The deep-review fixes carry their
own staged families: `review-a` (perception / doors / rings / items — docs/internal/review-ledger.md passes 6–8) and `review-b` (checkpoints × civilians, score, UI —
passes 3 / 9); soak `--body-light on|off` A/Bs the bodies-by-light rule. "Verified" still also means driven in the browser (below) with no console/GPU errors and the thing visibly working,
plus a clean typecheck — the harness cannot see rendering, the light meter, smoke sight-lines or audio.

## Driving the app headlessly (Browser pane / any automation)

`src/main.ts` exposes hooks on `window`: `__game __engine __cam __demo __input __smoke __menu __audio __quality __marks __particles __weather __glass __wet __froxel __rt __gi __mark __save __sharp __civ __sdfrig __wind __breach __qrf __needs __destr __taa __dn __attract __stage __meshTrace __boot __ready __perfrec __journal __replay __prewarm __anim __killGuard __readout`
(+ since the rebuild, the squad game's: `__orders __roomclear __nightbreach __rescue __scenarios __picks __doortools __doors __doorblast __fight __wallcharge __glassbreak __night __director __pair __wounds __hour __fow __extra`)
(+ the hot-swap hooks `__hotVol __hotDirect __hotRestir __hotFroxel __hotDenoise __hotReflect __hotGather`: recompile a pass from source WITH its real preludes — prefer them to `__wgsl` for the big kernels;
`__hotCommon(src?, variant?)` swaps an edited common.wgsl / `TRACE_VARIANT` into EVERY tracing pipeline at once — the ray-traversal lab's hook, see the *Stratified gather directions + the trace lab* bullet)
(+ URL flags `?sharp` / `?nosharp` / `?noiq` / `?gbaa` / `?nomv` from the image-quality program, `?sdfsmooth` / `?charsoft` / `?charsoftmarch` + `__rigTrace(rays)` from the SDF character rig),
`__runFrames(n, dt=1/60, keys=[])` (fixed-step frames with synthetic keys held), `__mouse(x, y, buttons?)`,
`__click`, `__pauseLoop` (stop the rAF loop; step only via `__runFrames`), `__resetClock()`, `__shot(name, q, scale)`
(JPEG to the shot server), `__panelShot(name, {frame?, quality?, scale?})` (the tweak PANEL (the debugger, on backtick) is HTML, outside the frame `__shot` reads back: `#panel` rasterised through
editor/domshot.ts and laid over the frame + the overlay's canvases; native sliders in the raster), `__png(name)` (lossless readback for pixel A/B), `__timeScale`, `__wgsl(src, {prelude:'scene'|'lighting'})`
(compile-check WGSL against the live device with the same prelude the scene passes get — 'scene' for direct/softblur/
temporal, 'lighting' adds lighting_common for gather/rc/probe/volumetrics — `naga` is not installed here, so Chrome/Tint through the page is the WGSL validator; a Linux sandbox could run naga if ever
needed).
URL flags: `?paused` (deterministic boot, nothing runs until stepped), `?quality=verylow|low|medium|high|ultra` (pins a preset,
auto off), `?demo` (starts the NIGHT SHOWCASE — the Director's program 'night'; the old tour is `__demo.start()` only), `?breach` (starts the daytime breach showcase — `__breach.start()/.stop()`, `.t`, `.drill.phase/.beats`, `.log`), `?mute` (or `localStorage twopointsix.testMute=1` once in the automation
profile — **keep test pages silent**, the user listens to their own audio), `?nodecals` / `?noparticles` / `?noweather` / `?noglass` / `?nocivilians` (each merged experiment off from boot — its untouched path), `?nortreflect` (+ `?detail=0‥1`; `?nortreflect&detail=0` = renderer v3 phase 4 off: main's frame bit for bit), `?nomarkings` / `?level=relief` / `?levelFile=<name>.json` (the markings bullet), `?decalStress=N`, `?level=local` (boot on the level EDITOR's current document: the workbench's ▶ *play from here*
stashes it under localStorage `twopointsix.editorLevel` and opens this — an unreadable stash falls back to the bundled office with a console error), `?nogatherstrata` / `?nomotioncalm` (the two 08-12 defaults off), `?hud` (the debug read-out under the HUD on
from boot — otherwise opt-in per machine, Tab ▸ Frame ▸ debug read-out), `?nop5` (renderer v3 phase 5's ultra extras off from boot AND vetoed for the presets — ultra's frame as it was before the
phase; the Tab rows still flip them), `?reachUniform` (A/B only: force the reach masks' uniform binding instead of the storage buffer). The viewer = the workbench's Characters / Effects modes (`src/viewer/` runtime + chrome housed by `src/workbench/main.ts`, VIEWER.md;
`/workbench#mode=chars&scene=guard/carbine-shoulder`; `/viewer#guard/carbine-shoulder` and `/gait` forward with the hash translated) has
`__viewer __char __step __gizmo __rig __rigSource __toss __cans __vtime __shot` (+ `__viewer.scene(name, variant)`, `__tac __hold __long __M`, `__vui` the chrome, `__vrt` the viewer Runtime — NOT `__rt`, which is the game page's RT-reflection knobs).
The level editor = the workbench's Level / Materials modes (`src/editor/app.ts` housed by `src/workbench/main.ts`, docs/level-format.md 'Editor'; `/workbench#mode=level&file=<name>` (`&autosave` / `&blank`);
`/editor#file=…` forwards; `__wb` {mode, setMode, scene(id|null, variant), staged} switches modes / stands a staging figure in the level) has `__ed` (every edit as a
function over the same undo stack: `__ed.box.add/move/resize/…`, `light`, `door` (+ `makeFrame` / `cutOpening`), `route.draw`, `volume`, `mark`, `select`,
`undo/redo`, `validate()`, `lint()`, `serialize()`, `load(text, {lenient?})`, `camera()/pin()`, `step(n)`, `shot(name)`; every multi-op verb inside `doc.transact` = all-or-nothing), `__edshot(name)` (view + overlay), `__tools __view __scene`;
its rAF loop also stops on a hidden pane — dispatch mouse events then `__ed.step(n)`. QA: `probes.ts editor` + `probes.ts level-lint`; `bun run tools/qa/level-lint.ts levels/office.json`.
`__stage(pin | null, { park, guards:[{i,pos,yaw,torch,aimPitch}], player:{pos,yaw,crouch,holstered,invisible} })` pins the camera VERBATIM
(`FollowCamera.setPin` → `pin`: look-at, yaw, pitch, dist — no damping, no aim lead; the numbers must be finite, dist is clamped ≥ near + 0.05 and |pitch| ≤ 89°, the applied pin comes back
in the result; null releases it AND puts the free camera's yaw / pitch / zoom back) and stages actors in one call — use it for every capture: the follow
camera drifts under scripts and framed walls instead of the subject for a whole day of renderer notes. Move the player with `__game.teleportPlayer([x,0,z])`, never by assigning `player.char.pos` (his collision is a sweep from the last settled spot, so a raw
write becomes a walk that stops at the first wall). **The boot is asynchronous** (every pipeline through `createComputePipelineAsync`, `Engine.init()` awaited
behind a start card that counts them in): `window.__ready` is a Promise that exists from the first tick and resolves once every hook above is assigned and the
card is live (rejects if the boot dies) — `await window.__ready` is the one line a script needs; the hooks are ONLY assigned at that moment, so the older loops that
poll for `__engine && __runFrames` stay correct. `window.__boot` = the boot timeline (`ui/boot.ts`: marks, `pipelines {done,total,failed}`, long tasks, frame gaps,
first-frame GPU) and one `boot … ms to interactive · …` console line prints at GPU-ready. Typical script: navigate with `?paused&quality=medium`, `await __ready`, wait for `#view.clientWidth > 0`
(a hidden pane gives a 0×0 canvas, rAF stops and timers throttle), `__menu.close()`, then step with `__runFrames`.
The start card has an idle **attract mode** (`src/game/attract.ts`, `__attract`): 6 s without input and the world starts running behind the card with the
camera cutting round the level — never under `?paused`, `__testVisible`, or once any of `__runFrames/__mouse/__click` has been called, but a plain page left
on the start card WILL start it (any key / click / mouse move puts the still view and a fresh encounter back; `__attract.start()/.stop()` by hand).
Synthetic input goes through `input.keys/pressed/clicked`; during the tour real input is locked (`Input.lockExcept`)
but synthetic writes still work.

<!-- was CLAUDE.md lines 2730–2764 -->
- **Checkpoints + autosave** (STATUS G5, `src/game/savestate.ts` — the schema, what is NOT saved and why, the determinism statement and the autosave rules are the
  file's head comment; keep it current): `saveState(g, {label, kind, force}) → SaveState v1` (plain JSON: Sam's kit / place, every ROSTER man's state / fix / clocks /
  errand / body script / pair / weapon / witness + talk, bodies as SETTLED ragdolls at their particles (`Ragdoll.settleAt`), items on the floor (in-flight / on a fuse
  → written spent), doors, furniture, fixtures + blackout, devices, the mission and the CHRONICLE (so the debrief survives a load; a 'checkpoint' row on save and on
  load, loads cost SCORE.load), escalation + rollcall, needs / whistle / tactics / dialogue ledgers (small `*Snapshot/*Restore` pairs beside their state), the CIVILIANS
  (`civilians.ts civiliansSnapshot/Restore`: place, gait, mark, fright, target / teller by callsign, corner + promise, dice, a downed one's particles, the floor's queue of
  words due as data — restored AFTER the men and after `eventSeq`, ears re-stamped even for a file without the slice), the storm with its dice, wet coats, the decal ring;
  NOT smoke, sparks, tracers, particles, search plans / pies / standoffs / flank roles (re-dealt inside a frame), scripts, a whistle event in the air (resolved once per
  object — dropped on load)), `loadState(g, s)` = `restartEncounter()` (the clean slate: fresh Player / Guards / civilians, units despawned, level as authored, nothing in
  the air; `resetGuards` also drops the tactics' memory) then every slice applied and the derived state rebuilt (poses, torch lights, leaf boxes, `updateTargets(g, 0)`);
  **`Game.time` comes back as saved** (every stamp is against it; nothing outside the Game reads it). `canSave(g, force)` / `canLoad(g, s)` return the reason: refused
  under the tour / attract / breach / any puppet, daylight, a unit on the floor or `qrf.state !== 'idle'` (no checkpoint inside the response), Sam down, the run OVER
  (stage failed / done — canLoad refuses such a file too, never rewritten to exfil); a scripted man / the clearing pair / Sam mid-action refuse a plain save and FILE under `force`
  (let go of in the file — the running game is never touched: saving is read-only but for the chronicle row, and a `kind: 'harness'` snapshot writes not even that);
  a plain save also waits for a BODY STILL FALLING (it is filed settled); a file of another level (`levelFingerprint`: door + route names, box / target / prop counts, every
  static's centre + size to the cm) or version is refused. A load takes daylight out first, pre-marks the restored hearing events as seen by the glass / the QRF, and
  forgets the floor-wide bark clocks (`forgetGuardClocks` / `forgetSuppressionClocks`) — Game.time has gone BACK, and any new module clock keyed by the Game must
  tolerate that (compare like `wet.ts`, or reset in loadState). DETERMINISM: with the harness's seeded Math.random re-seeded after the save and after the load, the
  next 10 s digest identically (continue ≡ load into the same game ≡ load into a fresh game — `probes.ts checkpoint-identity`); in the browser only the dice differ.
  `Game.saves: Checkpoints` (ticked LAST in update): AUTOSAVE requests on the stage advancing, first entry into a room region (chronicle.ts `roomOf`), a hauled body
  let go of ≥ `CKPT.bodyHideM`, every `CKPT.quietSecs` 90 of quiet play; written once the gates pass (missionLive, AI on, nobody alert / searching / awareness >
  `awareMax` 0.4, no civilian startled / frightened / running / telling / hiding from him untold and no word of theirs pending — `civilianCompromise`, `playerBusy`
  null, nothing on a fuse, plus canSave) after `debounceSecs` 2, never within `minGapSecs` 10 of the last, dropped after `pendingSecs`
  25; an autosave followed inside `regretSecs` 8 by a man going alert / an alarm episode is REGRETTED (`SlotInfo.regret`: kept, but `newest()` passes over it —
  a checkpoint a stride ahead of being seen is a death loop); three rotating localStorage slots `twopointsix.save.auto.N` + `…manual` + `…index` (`store` is a `SaveStore`: `localStore` / `memoryStore()` — headless.ts
  hands the Map one), `enabled` persisted `twopointsix.autosave`; `write(g, slot, label, force)`, `load(g, key|state)`, `slots()/newest(preferRun)/read/clear`,
  `importText`, `ageWords` ('40 s ago' off the mission clock for this run's, wall-clock otherwise), `flash` (overlay.ts: the CHECKPOINT tag top-right, `#checkpoint`),
  `summary/log/stats`, `onSaved` (QA). UI: the DOWN card's default is 'Restart from checkpoint (N s ago)' (menu.ts `checkpointButton`, `MenuDeps.loadCheckpoint` =
  main.ts: show stopped, camera cut), the pause card offers it beside Resume + Settings ▸ Game ▸ Autosave, a bare Enter once down loads this run's newest (player.ts;
  Shift+Enter restarts as ever), Tab ▸ Checkpoints (save now / force / why not, load newest / chosen, slot list, export .json / import / clear), `__save` {save,
  load, slots, newest, export, import, clear, auto, summary, canSave, snapshot}. Sizes: ~26 KB fresh, ~30–90 KB in play, ≈ 215 KB only in a synthetic worst case
  (512 marks + 520 rows + every prop moved). QA: `W.snapshot(label, force)` / `W.restore(s)` in headless.ts (start a probe from a staged file), `probes.ts
  checkpoints` (identity — civilians in the digest — / autosave / death / slots / refuse / civilians), `probes.ts review-b` (the deep review's game-systems fixes: run-over
  refusal, tactics reset, the civilians' gate term, laser cut by a civilian, whistle not re-answered, score counters past the timeline cap, rain bed in the annex, glass
  reset), `soak.ts --checkpoint-at MIN` (+ the always-on autosave invariants and the `checkpoints` smell line).
- **A stand-up sets every held rule again from its word** (10-13, the switches owner's line, after a check's pin was found undone). `src/host/standup.ts standGame` writes each
  held table on EVERY stand-up — `if (pinned('TPS_X')) X.on = <the word TPS_X is '1'>` — so on the frozen stand a check that sets `X.on = true` and THEN stands a game up gets it
  put back off, silently. A check's own pin goes AFTER each stand-up (each one: a second stand-up in the same process undoes it again), or the run uses the word (`TPS_X=1`),
  which every stand-up then honours. By design: one stand-up = one known stand. On the shipped stand a table is written only where its word is given (`pinned(env)`), so nothing
  is claimed here about a pin made before a stand-up there. Read in `standup.ts` on the rows around the opening, the kit and the dust; not every row was read, nothing run.
- **Not every `FROZEN_HOLDS` word is a `TPS_` word** (10-13, read off `src/host/profile.ts`; the knob registry's owner's note). Raised by a word of their own: the door rules
  (`ONEWAY=1`, `QA_FRAMEHOLDS=1`, `QA_DOORMANNERS=1`, `QA_DOORBLAST=1`, `QA_DOORSTAY=1`), `SLOTS=on`, `CUTBOXES=1`, `GLASSFX=on` (three rows), `SQUADS=radiocheck-call` (three
  rows). No word under probes.ts at all: `DESTRUCTION.on`, `RUBBLE.on`, `EVICT.on` (`PT_DESTR` / `PT_KICK` / `PT_POP`, playthrough.ts alone), `FRAG.defenders` (`--set`),
  `tune.chaos` (the tool's own), `AIM.player.lightSnapPx`, `SILENT.on` and `ROOMCLEAR.fresh` (each set by its own probe). So "the frozen stand with X raised" is the row's own
  word in `FROZEN_HOLDS`, never a guessed `TPS_X=1` (nothing reads a guessed word: the rule stays off and no line says so).
- **`laststand-callout`'s last-man line is two lines, each staged for one rule (10-13, tools/qa/laststand-probes.ts; the probe only, nothing in `src/`).** The line kept the
  office post's first man and wanted `named` = the room he stood in. On the FROZEN stand that man is out hunting when he says he is the last (his squad is in contact the frame
  a mate of it drops: the squads' radio check is held off there), and laststand.ts names NO room for a man out hunting (`tellOnly` / `tickCheck`: `free ? null : w`, 'a man out
  hunting is not a room to go to'). It only held because he said it in the corridor; since the compound's second hand-placement pass (a620967d: rooms listed house first, the
  office post's mark) he says it walking through the bunk room → `truly in bunk then, named ''`, red, and not a rule's. Now: (a) THE GUARD HUT'S man, a squad of one, so no mate of
  his drops and he holds his post on both stands: he must say the hut, be holding, and the net must name the hut; (b) the office's man as before, read by what he is doing the
  frame he says it (`g.fight.defs` mode): he says where he truly is (room, or the level's place word), and the net names his room only if he HOLDS one, nothing if he is out
  hunting (frozen: out hunting in the bunk room, named nothing; shipped: holding the office, named office). `LASTSTAND_BREAK=1` = call out left off for those two runs: both lines
  fail on both stands (run), pass without it. A re-placed compound that sends the hut's man walking turns (a) red on purpose: restage it on a man who holds, do not loosen it.
  Not done: the mode is read the frame he speaks, the rule reads it when the check closes (the same in every run here). The shipped stand's 'the answers reach the radio strip'
  is an older red, untouched. Headless only.
- **`scenario-level-probes`' commander hunts a defender who has left his room (10-13, tools/qa/scenario-level-probes.ts `Clear.hunt` / `left` / `run`; the probe only,
  nothing in `src/`).** A room is not called clear while a man dealt to it lives (roomclear.ts tick), and a flanker can be left holding a door on floor nobody holds
  (enemysquads.ts: 'holds where he is', then at home where he ended up). The commander walked his empty room three times and waited out the cap: 'finished: every seed ran to
  the scenario's own end inside the cap' red on barracks (shipped, the four's seed 1: the day room's man in the wash room), compound (frozen, the pair's seed 1: the shed's man
  in the pantry) and compound (shipped, the four's seed 1). Now: from the second pass a room with no live defender in it is not taken again, its men are walked to (a move
  order onto each man's spot), and twice more after the passes; the first pass and any room with a man in it are played as before. IT READS THE DEFENDER'S TRUE POSITION,
  which a player does not have: the line is a liveness check, not a claim that a player finds him. `HUNT_BREAK=1` skips it: the barracks' and the compound's seeds above stall
  again and the line fails (run), passes without it. Run on both stands over compound, barracks, mousehole, warehouse, glasshouse, depot, office: the three stalls are taken and no
  other seed line moved (51 seed lines a stand, against the same run with the hunt only after the passes). Still red with or without it, older: 'it can be won' for the pair on mousehole and warehouse (shipped), the office's rescue data
  (roamer 2 in furniture). Tried and dropped: a hunt after EVERY pass (the warehouse's frozen pair seed 1 turned from taken to wiped). Headless only.
- **The one-button hold probes hold the close-in mode off** (`tools/qa/grab-probes.ts oneButtonRows`, 2026-10-15): `grab-gate`, `grab-release` and
  `controls-behind` were written before the close-in mode (`CLOSE.on`) and read the rows of the build without it, so on the shipped stand they were ten red
  lines that said nothing (the knife / knockout pair where they wanted the one takedown, the take from in front, the alert man still in reach). They now lay
  `CLOSE.on = false` after each stand-up and put it back when done: on the shipped stand they are the check of the `?noclose` page; the mode's own rows are
  family `close`. Measured on the build head 275316ac, headless: family `grab` shipped 13 FAIL lines → 3, frozen 55 PASS 0 FAIL before and after, `close`
  shipped 0 FAIL. The three left are NOT the close-in mode's (red with every close-in switch off): `controls-behind` (d) the card counts no shot on a
  pistol click's frame, (f) a can's click is no throw on its frame; `guard-key` (b) the closer never latches the server door again (reads as doors stay
  where left, inferred). No single `TPS_<NAME>=0` turns any of the three green (every word in `STAND_ENV` tried but the snow, music, picture and words ones).
