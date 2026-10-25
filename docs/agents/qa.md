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
  not (five today: DESTRUCTION and LIVED by a recording's env, LOOK and PLAN picture only, RECAP reads only); knobs-check is red on a written table that is neither — and on a table `journal.ts` asks a FILE for (`k.tables.X`, the rules that put a key off for a recording from before it) that no recording carries: such a rule reads every file as one from before the key (PAIR's four keys and ROOMFIGHT.doorEars stood so until 10-22).

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

`src/main.ts` exposes hooks on `window`: `__game __engine __cam __demo __input __smoke __menu __audio __quality __marks __particles __weather __findme __glass __wet __froxel __rt __gi __mark __save __sharp __civ __sdfrig __wind __qrf __needs __destr __taa __dn __attract __stage __meshTrace __boot __ready __perfrec __journal __replay __prewarm __anim __killGuard __readout`
(+ since the rebuild, the squad game's: `__orders __roomclear __nightbreach __rescue __scenarios __picks __doortools __doors __doorblast __fight __wallcharge __glassbreak __director __pair __wounds __hour __fow __extra`)
(+ the hot-swap hooks `__hotVol __hotDirect __hotRestir __hotFroxel __hotDenoise __hotReflect __hotGather`: recompile a pass from source WITH its real preludes — prefer them to `__wgsl` for the big kernels;
`__hotCommon(src?, variant?)` swaps an edited common.wgsl / `TRACE_VARIANT` into EVERY tracing pipeline at once — the ray-traversal lab's hook, see the *Stratified gather directions + the trace lab* bullet)
(+ URL flags `?sharp` / `?nosharp` / `?noiq` / `?gbaa` / `?nomv` from the image-quality program, `?sdfsmooth` / `?charsoft` / `?charsoftmarch` + `__rigTrace(rays)` from the SDF character rig),
`__runFrames(n, dt=1/60, keys=[], draw=true)` (fixed-step frames with synthetic keys held; `draw` false = only the burst's last step is drawn, the others pack the world as a draw would and go on — what a script on the software adapter wants, and NOT a check of the drawn-every-step path: the GPU's senses then answer once a burst), `__mouse(x, y, buttons?)`,
`__click`, `__pauseLoop` (stop the rAF loop; step only via `__runFrames`), `__resetClock()`, `__shot(name, q, scale)`
(JPEG to the shot server), `__panelShot(name, {frame?, quality?, scale?})` (the tweak PANEL (the debugger, on the backslash key: `player.md`, empty hands are a slot) is HTML, outside the frame `__shot` reads back: `#panel` rasterised through
editor/domshot.ts and laid over the frame + the overlay's canvases; native sliders in the raster), `__png(name)` (lossless readback for pixel A/B), `__timeScale`, `__wgsl(src, {prelude:'scene'|'lighting'})`
(compile-check WGSL against the live device with the same prelude the scene passes get — 'scene' for direct/softblur/
temporal, 'lighting' adds lighting_common for gather/rc/probe/volumetrics — `naga` is not installed here, so Chrome/Tint through the page is the WGSL validator; a Linux sandbox could run naga if ever
needed).
URL flags: `?paused` (deterministic boot, nothing runs until stepped), `?quality=verylow|low|medium|high|ultra` (pins a preset,
auto off), (`?demo` and `?breach` started the night and day showcases; both were removed with `__night` / `__breach` — docs/agents/showcases.md — and the flags now do nothing; the old tour is `__demo.start()` only), `?mute` (or `localStorage twopointsix.testMute=1` once in the automation
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
**`__runFrames` draws every frame it steps (unless its fourth argument is false) and does not wait for the GPU** (only the last of a burst is put on the canvas). On a GPU slower than the script the
frames pile up behind it. Measured 10-17 on the software adapter, 1280×720, Very low, `?roomclear`: a drawn frame is about 30 s of GPU (the first one out from
under the menu 3½ min) and a burst of 60 is queued in under a second, so three bursts leave an hour and a half of drawing queued, and a later call does not come
back until the browser takes more (a page check's fourth `__runFrames(60)` not back inside four minutes, no error anywhere: it reads as a hang in the game and is
not one; that it is the browser holding the call is read off the numbers, not seen). So on that adapter a tool that only needs the GAME to have run steps with the
draw stubbed — `const e = __engine, real = e.render; e.render = () => { e.world.upload(); }; try { __runFrames(n); } finally { e.render = real; }`, the stub packing
the world as replays.md's 'an undrawn step must pack the world' says, thirty-odd page tools do — and draws the frames it wants to look at one at a time, each waited
for (`__runFrames(1); await __engine.device.queue.onSubmittedWorkDone()`). Same page, same day: eight stubbed bursts of 60 back in 0.2–0.5 s each, the game's clock
eight seconds on, then one drawn frame through the GPU in 32 s. What lives in the draw stands still while it is stubbed: the smoke solver, the GPU particles, the
light meter's answers (and its asks queue up from the first stubbed ticks — draw a frame or two before reading it; read off render/probe.ts `put`, not measured).
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
  A MAN CAUGHT MID-TURN (10-24; `SAVETIMELINE.turn`, savestate.ts: ON in the page, `?saveturn=0`; OFF in the module and on the frozen stand,
  `TPS_SAVETURN=1`; a `FROZEN_HOLDS` row; the journal carries the table, and a recording from before the key replays with it off — its go-backs started a
  turning man from rest; its own key, whatever `SAVETIMELINE.on` says): with the turn weight on (`character.ts TURN`, the page and the shipped stand) a
  guard's turn was not in the file, so after a load he started from rest facing where his weight had let him get to and his AI eased from there, not from
  its wish: continue and load parted on his first frame (`checkpoint-identity` on the SHIPPED stand was red from the build step that moved its staging so
  the save lands while a man turns; `TPS_TURN=0` passed). The turn is filed now (`GuardSnap.turn`, nine numbers: where he has got to, the speeds his weight
  carries, where his AI wants him, where he stood, the neck's lead; `character.ts turnSnap` / `turnPut`, which reads the nine as untrusted — finite or
  nothing, the speeds held to a turn's top rates and the lead to the neck's reach — and marks him weighed for the loader's bake: game.ts `dealWeapons`
  writes `turn.on` only on his next frame; with the weight off at the load, `?turn=0`, nothing is put back and he is the file's yaws). The loader bakes a living man with `bakeLoaded`: posed where his weight had got him, his yaws then handed back
  AS FILED, so a wish written after his own update on the frame of the save (two men turning to talk: `dialogue.ts updateAmbient`) is still what his next
  frame eases from. No key with the weight or the switch off (those files are byte for byte what they were), on a body, or on a scripted man; a file from
  before the key loads as it did. CHECK, both stands: `probes.ts checkpoint-turn` (in `checkpoints`; it raises `TPS_TURN=1 TPS_SAVETURN=1` itself), three
  lines: the patrols walk until a man has over 1 rad/s in his feet and over 0.3 rad to come round, saved there, every man's place and yaws the same frame
  for frame over the first 30 frames of A, B and C and one digest over the 3 s after, and a file made after a load holds the same turns and yaws; the same
  again with his body yaw written 0.4 rad on after his update (the loader with a plain `update(0)` fails this line); with the switch off no file says a
  turn, the rest of the guards' slice is the same, and a file that has one loads frame for frame as the same file with the key taken out (the load's
  own reading of the switch). `CHECKPOINT_TURN_BREAK=1` (the key taken out of the file before the load) fails the first two on both
  stands, from frame 1. `savetimeline-check.ts` no longer puts TURN off for its file comparison (it did on the grounds that no file held a turn). One
  seed, the office; in play the gap it closes was small (a turn restarted). The page, headless on the software adapter (the office, a man handed a turn of 1.6 rad and saved three frames in, 1.9 rad/s in his feet): the turn straight after the load is the saved one and four frames on load and continue agree to the bit, 0 console errors. Never seen on a GPU, and nobody has watched a load land on a turning man.
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
- **Saves keep a timeline** (`SAVETIMELINE`, `src/game/savestate.ts`, 10-19; the maintainer, from a play test: one quick save is awkward, "especially in the tutorial";
  "a rolling buffer"; "maybe we have a screenshot"; "let those have a timeline"). ON in the page (`?savetimeline=0` puts it off), OFF in the module and on the frozen
  stand; the word `TPS_SAVETIMELINE=1`; a `FROZEN_HOLDS` row; in the knob registry and the journal (a recording from before the key replays with it off). OFF = the build
  as it was: three autosaves and the one manual slot, no F5, no strip, no pictures. ON:
  · **Two rings that never push each other out**: the newest FIVE autosaves (`auto.0‥4`, was three) and the newest FIVE made by hand (`manual`, `manual.1‥4`: the first empty
    slot, then the oldest). An old build's slots read and list as they are (`manual` IS hand slot 0), and with the switch back off every slot written under it still loads.
  · **F5 saves by hand.** Read in `updatePlayer` (`input.hit('F5')` → `Checkpoints.askSave`, written at the end of that update), so a run tape replays it like any press; the
    page keeps a bare F5 from the browser while a run is up (`Input.saveKey`, the page's to say: not on the start page, behind a mission's brief, on a replay,
    in the kit picture's window, under a show's key lock (`Input.lockExcept`: no F5 reaches the game there) or over a broken frame). ON THE PAUSE CARD the world is
    held and no update reads a key, so the page keeps the press (main.ts `savePend`, the loop's hotkeys; only on the card itself, not with the Options or the
    mission list over it) and hands it over as a press of F5 on every live frame until a tick has moved the clock — the save stays the recording's own input —
    while the mission and `Game.time` are the ones of the press (a restart or a save loaded with the card up drops it). The card's strip shows a dashed tile
    where the save will stand (`Menu.saveAsked` lays the strip alone, the keys' place on the card kept; `MenuDeps.saveDue`; `.tile.due`), and none when the
    save would be refused (`Checkpoints.handNo` asks, writes nothing): the refusal is then said on the feed at that tick as ever. The F5 line of `input.ts`
    stands BEFORE the typing-target return, so an Options slider that kept the focus does not let a bare F5 reload the page under a run. On the end cards F5
    stays kept and does nothing: a reload there would throw away the saves the DOWN card is showing, and there is nothing to save. Known: with five saves by
    hand the tile to come is a sixth until the oldest is replaced. What a file cannot
    hold is refused with its reason on the feed (`not saved: …`; `canSave`: his hands full, a can on its fuse, a body still falling …). A man alerted does NOT refuse
    a save by hand and a save by hand is never marked regretted: it is the player's word, and the strip is how he goes further back than it. The Tab ▸ Checkpoints
    buttons go on as before (`bindings.ts`, straight to `Checkpoints.write`; its slot picker still reaches four).
  · **A team on the floor saves in memory.** A file holds no unit (`canSave` refuses), so Training five to seven and every squad mission never had a checkpoint. With the
    switch on a save made with a unit up is a rollback snapshot (`rollback.ts takeSnapshot`, kept behind a closure on the `Checkpoints` so no snapshot walks into another):
    its own two rings of five, `SlotInfo.mem`, key `twopointsix.save.mem.<slot>.<i>`, nothing in the store. It lasts THIS RUN ON THIS PAGE: a restart, another mission or a
    reload of the tab drops it. Its gate is `canSnap` (no show or puppet, the Director not blocking, Sam up, the run not over, the response not out) and the soft autosave
    gates as ever; the REGRET rule under the switch counts any man against him going alert (a mission's defenders are units too: `!x.unit` never saw them), and the
    rooms an autosave is asked at and named for are the level's own on every level (`roomHere`: the office's table named a lesson's street 'cubicles'). Loading one
    restores the Game in place (`loadMem`). NOT taken back, as a file's load leaves them: the run's save and load counts, the controller's log and stats, the autosave
    switch, the three hooks, the sandbox row, the tune rows; any OTHER setting kept on the Game goes back with the save. The page's run books start over (main.ts
    `vRun = null`: the Mission is the same object, and a load is another try). Then it calls
    `Checkpoints.onPutBack` — `src/host/putback.ts`: the books of "what was last sent to the GPU" roll back with the Game while the GPU's buffers do not, so the host
    forgets them (`BoxWorld.forgetSent`, `LightSet.forgetSent`, `CharacterRenderer.forgetSent`, the marks, and `Game.rehand()` for the snow, the wind's map and the dust grid,
    smoke and particles cleared, the TAA history cut, the world cache dropped) — A HAND-KEPT LIST: a new "sent only when changed" book inside the Game's reach needs
    its line there, or is a `HostOwned` no snapshot touches (the GPU light meter's buffers and count book are: `render/probe.ts` `Plumbing`, `docs/agents/replays.md`; its line here only drops the answers still out, `IrradianceProbe.putBack`). A check of 'a save put back drops X' runs the real hook headless through `tools/qa/putback-host.ts hostPutBack(g)` (it stands in the GPU calls the harness's engine lacks), never a hand on the host's field. (`putback.ts` imports game modules as TYPES only, and `player.ts` imports nothing of `savestate.ts` — `askSave` reads the switch: a value
    import in either was one more door into the game's import cycle and broke a tool whose first import was `digest.ts`.) The page adds the camera cut and drops held keys. Enter once down goes through `loadInStep` (a memory save is put back at the END of that update,
    never under the modules still running; one that will not load is refused in the step and the restart happens, as with a file).
  · **A picture per save**, taken by the page, never by the game: `Checkpoints.picture(info)` is a seam the page fills (main.ts: after the next PRESENTED frame, the canvas
    drawn 256 px wide into a JPEG, `setPicture`). A file save's picture is one more store key (`twopointsix.save.pic.<slot>`, stamped with its save's time so a stale one is
    never shown); a memory save's stays in memory. Every store write is in a `try` (`put`): a full store drops the pictures and writes the save again, a store that throws
    leaves the game running with the save refused. No picture (the harness, a hidden tab) = a plain tile.
  · **The strip** (`menu.ts saveStrip`, `#menu .saves` in index.html): on the pause card and the DOWN card, this run's saves in time order — picture, age, a small diamond
    on one made by hand, a regretted autosave dimmed, one that is ahead of the mission clock marked. One stop for the keys (Left / Right or A / D walk it, Enter loads),
    or a click. Fewer than two saves = no strip. `Restart from checkpoint`, Enter once down and `newest()` are as they were: the newest sound one.
  Check: `probes.ts savetimeline` (families `checkpoints`, `all`; `SAVETIMELINE_BREAK=1` fails; green on BOTH stands): the rings roll at five and five and neither kind
  pushes out the other; every file entry loads and the next 10 s digest as the run that simply went on (the camera put back and MOVES off for the comparison: the
  camera is the host's and the animator's momentum is in no file, as the head of savestate.ts says; a turn's weight is in one since 10-24, `SAVETIMELINE.turn`); an old build's slots list and load, on and back off; a store that
  refuses, throws or is full; Training five with its pair: memory saves, each loads and plays on to the same digest with the animator as the stand has it, the store
  untouched, F5, Enter once down, a restart drops them. `checkpoint-slots` / `checkpoint-autosave` read the ring's size from the stand. ONE SAVE WEIGHS (headless, one
  seed): the plain night's file 28 KB frozen / 31 KB shipped; Training one's 9 / 11 KB; Training five in memory 5.0 / 6.9 MB (14–19 thousand objects, about 30 ms to
  take here: a hitch of a frame or three at each such save on a real machine is likely and is NOT timed on the page), so ten of those are 50–70 MB of the tab's
  heap; a picture is 256×144 and about 4 KB as stored (the software adapter's frame at 1024×576), so ten files with pictures are near 350 KB of the store. `tools/qa/savetimeline-page.cjs` drives
  the real page on the software adapter (Chromium, SwiftShader, `verylow`; four jobs, each a boot of several minutes): the plain night — F5 as a real keydown, kept
  from the browser, three times → three tiles in time order with pictures that are not flat, the middle tile loads to its own mission clock, the DOWN card shows
  them; Training five — four saves in memory on the strip with pictures, then a bulb put out AFTER a save and that save loaded from its tile: the bulb glows again
  on the frame after the load (259 nearly white pixels at the save, 0 with it out, 258 after the load), and with `SAVEPUTBACK_BREAK=1` (the host not told) it stays
  dark there (0) though the game has it lit, so that line fails as it must; `?savetimeline=0` — F5 writes nothing and is the browser's, no strip; `card` (10-20, the page's own loop let go with the pause card up) — F5 is kept, nothing is written and the world does not move while the card is up, the strip shows the tile to come, the card closed writes ONE save by hand with its picture, the button the keys had walked to keeps the focus, a save that would be refused shows no tile, a restart made with the card up drops the press, and under a key lock F5 is the browser's; `SAVECARD_BREAK=1` (the kept press not handed over) writes none and fails as it must. No page error.
  NEVER SEEN ON A GPU, never played. Known and open: smoke hanging at a memory save is gone after its load (the fluid lives on the GPU) and a sound that was playing
  plays out; a load from a card is between steps and cuts the run tape, as a card's load always has; an F10 recording ENDS at a load or a restart made between frames and a new one is asked for (10-22, `SessionRecorder.cut`, called by `Checkpoints.load` / `loadMem` and `Game.restartEncounter`; `docs/agents/replays.md`, the journal bullet; check `recordcut`), while Enter once down is inside an update and on the tape, and the recording runs on over it: it replays for a file written inside the recording, for a file from before it (the file carries the store's rows and that slot's text) and for a save in memory made under the tape (the sensors' stream is the host's); a save in memory from before the recording ends the recording with that frame, and a save or an import made between frames (the panel) ends it before the save (`docs/agents/replays.md`, the journal bullet; check `recordload`); the Tab list shows a memory
  save as 0 KB.
- **A save carries what his body is holding** (`SAVETIMELINE.holds`, 10-20; `?saveholds=0`, `TPS_SAVEHOLDS=1`; its own key, whatever `SAVETIMELINE.on` says): Sam's
  wall hold with the walk-in take's clock, and the close-in mode's held gait with the man it is held on. The rule, the cause (`savetimeline` (2) red on the
  page's stand once walls were taken by walking) and the checks: `docs/agents/stealth.md`, the wall taken without the key.
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
- **THE BENCHMARK (`src/ui/bench.ts`, `src/ui/benchrun.ts`, `src/host/benchScenes.ts`, `src/host/handsoff.ts`, 2026-10-17; title ▸ Extras ▸ Benchmark, or `?bench`
  on the game's address; `__bench`).** For a machine nobody on the project can sit at, and for tuning the quality levels: one press, hands off, about seven
  minutes. ITS SCENES ARE REAL FLOORS (the set `floors-1`; the day showcase it once played was removed with both showcases): the pass in night snow, the block
  with the mains thrown by a teammate (red emergency lights, the men's torches), the compound in a storm; four teammates, hard, each a mission of the list on
  its own deal and die. A LEVEL IS ONLY LOADED AT BOOT, so a run is A PAGE PER SCENE: `benchBegin` writes a small record to the tab's session store and loads
  the first scene's address (the mission's own query with `roomclear=<seed>&seed=<seed>&difficulty=hard&noverdict&nokeep&benchrun=<i>`); each page finds the
  record (`benchLegOfPage`), plays its part (`BenchLeg`) and hands its lines on with the next page's load; the last page shows the card, and Close (or an Esc
  with nothing to show) loads the address the run was asked on. Of the visitor's flags only `mute`, `nomusic` and `quality` ride along: anything else would
  make it another fight than the set's. A reload in the middle is a plain mission page (the page marks the record before it plays); `?bench` on the address
  goes to the first scene BEFORE the game boots (`main()`'s first lines, a `replace`: that load is the machine's first and the one the report's `load` line
  times, and Back does not ask again), the row is a second load and the report says so. EACH SCENE IS PLAYED BY THE HANDS-OFF PLAYER (`HandsOff`, the page
  twin of `command-tally.ts`'s hand `b`): W A S D along the nav path, the cursor on a door, the quick key B (stack, then B again when the men have arrived),
  the rifle on whoever the fog shows on a clear line after a rolled beat, then a hunt for whoever is left; all of it written onto the host `Input` in the
  loop's `beforeTick`, before the tick samples the command, so the game is played by its own keys and its own AI on both sides. Sam cannot go down while it
  plays (`godMode`, put back after; mortal he went down inside half a minute in a quarter of the dark runs), the real keyboard is locked out of the scene
  (`input.lockExcept`), and its one direct write is the door verb in the no-teammates-left path (`selectVerb('door','kick')`). A scene plays at most 75 s of
  game time. In order: page one holds the world while auto quality finishes measuring and times that opening picture AS THE PAGE OPENED, then plays its
  scene live with auto quality doing what it does in play; page two its scene; page three its scene until ITS HEAVY MOMENT (a round fired in the last 0.4 s,
  a dozen seconds in; none by 45 s = held where it stands, and the report says so), the world held still and that picture timed as it stood, then under each
  preset of `AUTO_LADDER` from the bottom up (a preset under eight frames a second is the last one tried), then, everything put back, with each heavy feature
  flipped alone (the F8 sweep, one round, `SweepOpts.inside`), then the fight plays out. It ends on a card (the world held under it) with a text report (the
  GPU by name off WebGL's unmasked renderer, the browser, the system, the screen, on battery or not; the first page's BOOT timings; a line per window and per
  scene; `floors`: how each fight ended, so two machines' numbers are known to be of the same fight only where those agree; the ten features that move the
  frame most) and a Copy button, and the LAST page's take downloads as the F9 recorder's json with one `bench` event carrying all of it (`set`, `scenes[]`
  with each scene's address, end and boot; the earlier scenes' frames are not in the file, their lines are). `tools/qa/perf-report.ts` prints the report
  first. NOTHING IS SENT ANYWHERE. Esc stops a run and puts everything back. HANDS OFF: the page's Esc and hotkeys stand down while a run is on, no attract
  reel starts. `?bench=N` = N seconds a window; `?benchcap=N` = N seconds a scene (the page check's). A tab hidden during a run starts that window over, or
  leaves that frame out of the scene's line. While a window is timed on a held picture the page's quality model does not run. A scene that will not start is
  said in the report and the next page loads all the same. SEEDS: `bun run tools/qa/bench-seeds.ts` plays each scene headless (the shipped stand) over a range
  of seeds and picks, among the runs that take the floor, the one nearest the set's medians in seconds, rounds fired and teammates lost (each over its MAD);
  `--check` holds each kept seed to still taking its floor, `--twice scn:seed` to the same digest twice. KEPT (12 seeds a
  scene, the 75 s cut): snow 10 (the floor taken in 63 s, 21 rounds, one teammate lost; medians 61 s, 25.5 rounds, one lost; 10 of 12 took it inside the cut),
  dark 1 (the mains out 5 s in, two rooms banged and cleared, 6 rounds, nobody lost, 4 of 8 defenders left; medians 8.5 rounds, none lost, 4 left), storm 6
  (22 rounds, one lost, 4 of 11 left; medians 23.5 rounds, one lost, 4 left).
  THE PAGE'S FIGHT IS NOT PROMISED TO BE THE HEADLESS ONE: the page steps the game at a fixed 60 Hz, the camera with the tick, and draws a blend between
  ticks (`FIXEDSTEP.on`, `TWEEN.on`: docs/agents/replays.md; the hands-off player's keys go on before each tick), so a display's rate alone no longer
  makes another fight. But no check has shown a benchmark scene on a page equal to the headless run of its seed (the page's men read the GPU's light and
  smoke, the headless ones their stand-ins), nor two machines equal; the `floors` line is how a report says which fight it saw. The seeds are picked
  headless. Checks: `bun run tools/qa/bench-check.ts` (a fake page and a fake tab:
  the acts on each of three pages, the lines carried, everything back at the end and from every stop, the slow-machine cuts, a tab hidden, the ring full, no
  heavy moment, the addresses, the reload guard, the report's text; `BENCH_BREAK=1` must fail), `tools/qa/perf-sweep-logic.ts` (the sweep inside another
  take), and on a real page `PORT=<port> node tools/qa/bench-page.cjs` (the software adapter, quality pinned: `?bench` goes to the first scene and Esc comes
  back, then the row's run start to finish over three pages with the hands-off player seen giving its orders on each and walking on the first, keys
  pressed into a scene, the game's clock read every frame, the card, the one download, Close; the page's own frames play each scene under the fixed step,
  a frame there taking seconds and the wall's cut put out of reach, so a scene ends by the player's own cut after `CAP` game seconds and the last page's
  tail is the fake page's to prove; `STEP=script` has the check step the scenes with `__runFrames` instead; about 80 minutes at 320x180). NEVER RUN ON A GPU: no number of its report has been read on a real machine, the seven
  minutes are an estimate, and nobody has watched a scene played or looked at the card.
- **Stalls: the recorder watches the page's own thread** (`ui/perfrec.ts`, from 10-25). A frame's marks see only inside the frame, and a stall is nearly
  always between two frames. While a take runs ON THE PAGE (never headless: a headless take is the file it was; `perfrec.watch = false` leaves it off on
  a page too) a 4 ms timer answers, and each frame's `beat` is the longest it went silent in the GAP before the frame: from the end of the step before to
  the start of this one, so neither frame's own work is in it. What the browser itself reports as a long task or a long frame becomes a `long` event at the
  moment it began, with the script it blames by file name (300 of a kind a take, then one `longcap` line; they start at 50 ms, so the beat is the finer of
  the two; on a page whose usual frame is itself long only one well over it is kept), and the tab going out of sight and coming back are `tab` events. A checkpoint written or put back during a take is a `save` / `load` event of the step it
  happened in (a save with a squad up walks the whole game and takes its picture off the canvas), and the report sets what the take says happened in a
  stall's own stretch beside it (a save, the ladder's step, a resize). Mind the frame time's own shape: a frame's `dt` runs from the start of the
  step before to the start of this one, so a slow step shows in the NEXT frame's `dt`, and the reader looks at the row before for it. Reading: a long
  frame after a long step, or under a long GPU frame = IN THE FRAME; with a beat over three tenths of the gap = the thread was HELD between frames (a timer, a collection, another
  script; also what the page itself does in its callback after the step is recorded: a sweep's flip, a benchmark's scene change); with a short beat = the thread was FREE and the browser handed the page no frame (its compositor, the GPU's queue, the page around an embedded
  one). `tools/qa/perf-report.ts` prints a STALLS block (`tools/qa/perf-stalls.ts`: frames over 35 ms and over twice the frames around them, so a slow
  stretch is not a stall; bursts and how often they come; each stall read as above with the long lines that fall in it; long frames with the tab hidden
  counted apart; and the slowest ten seconds of the take where they are well under its usual frame, since a slow stretch reads as stutter with no stall
  in it). It does not guess the display's refresh: frame times on the maintainer's 120 Hz display are not whole refreshes (a take at 45 fps reads a steady
  22 ms, not 16.7 and 25), and two ways of guessing both gave wrong answers on real takes. The watch is on for every take on a page, the sweep's and the benchmark's too (a timer of three
  operations 250 times a second; its cost was never measured on a GPU, `watch = false` is the way to an A/B). Check: `bun run tools/qa/perfrec-check.ts`
  (`PERFREC_BREAK=1` must fail; one part of it runs the real timer on the real clock, one the wiring on a stand-in observer). Why: the maintainer's first take from an embedded page had 40 stalls of about 50 ms in
  three minutes with the GPU and the frame's CPU as ever, and nothing in the file could say whose they were. Run on a real page on the software adapter;
  no take from a GPU carries a beat yet.
- **A page's own rows in the F8 sweep** (`ui/perfsweep.ts PerfSweep.extra`, a list of `SweepExtra { id, label, flip, liveOnly?, warm? }`; the page's
  sweep is `window.__perfsweep`). For a switch that is a page's own and no row of `SWEEP_ROWS` (a prototype page's panel): `flip({ live })` is asked once
  as the take begins and answers `{ from, to, apply: () => undo, settleMs?, ready? }` or, as a string, why the row is skipped here (`ready` = a `warm`
  row's own picture draws). Added rows are flipped in the same rounds as the build's own (after them in the first round; later rounds shuffle all the
  take's rows together, so the build's rows are not in the order of a take without added rows) and named in the take's begin line like any row, so
  `tools/qa/perf-report.ts` prints them with no change (`from` / `to` are printed as the row's change: small plain values). Skipped, each with its
  reason under the name `added row '<id>'`, never stopping the take: an id already taken (`base` too), a flip that throws or is not one, values a line
  cannot carry. A flip must not go through `Quality` (that reads as a hand change and stops the take). The benchmark's sweep (`SweepOpts.inside`) takes
  the build's rows alone. None added (the game's page) = the take as it was. With these the sweep also runs EVERY undo when one throws (it stopped at
  the first) and its closing line then says one row's way back failed. The finished take is on `window.__lastPerfDump`, and `serializeDump`
  (`ui/perfrec.ts`) gives its JSON in parts for a page that cannot download. Check: `bun run tools/qa/perf-sweep-logic.ts` (the hand-change line for
  a page's own row and the block at its end). Run once on a real page on the software adapter with added rows; never on a GPU.
- **The missions gate's commander hunts first (tools/qa/missions-gate.ts; the gate only).** It passes `PT_HUNT=first` to its `ships.ts` run: with no room held the scripted
  commander goes for whoever is left before he walks the rooms again. `playthrough.ts`'s default (every room first) is unchanged, so tallies made with it still compare, and
  `ships.ts --seeds 1-2` by itself still stalls where the gate does not. Why: with the last defender standing out in the open the default ran the compound's seed 2 to the 300 s
  cap with the team 4 of 4 (seven rooms walked from 171 s, the hunt begun at 281 s); an earlier build stalled the warehouse's seed 2 the same way. The cap stays 300. Read on
  one build, 42 squad runs as shipped: every row ends, the longest at 195 s; 3 rows reach a different end than under the default (the compound 2 stalled → taken, the warehouse
  2 taken → wiped, the two charges 2 taken at 178 s → at 120 s). The gate judges a stall, never who won; its report line says which commander ran, and a row is played again
  with `PT_HUNT=first bun run tools/qa/ships.ts --trace <id>:<seed>`. `PT_HUNT=rooms` in the caller's env = the default order under the gate. Headless only.
- **A mission's page waits for Start; a script's page does not** (2026-10-19, `src/ui/loadbrief.ts`; `docs/agents/menus.md` has the screen). A page
  whose address names a mission resolves `__ready` with the mission's brief up and the world held: nothing ticks until the brief is started. A tool is
  never held by it: no brief is made under `?paused`, a replay, `?kitview` or a benchmark scene, `?mute` (or the test profile's mute) drops it at the
  boot's end, and a hook that drives the game (`__runFrames`, `__mouse`, `__click`, a save or a load, `__journal.start`) drops it at the loop's next
  step. A tool that loads a mission with none of those and only watches or shoots the page (`__shot`, `__png`, `__demo.start`) is looking at a held
  world under the brief: it presses Enter, or loads the page with `?loadbrief=0`.

- **A lost GPU device: quiet when the page is leaving, one fresh load for a real loss, then a card that says what was lost (2026-10-19, a play test: the game did not come up on an
  AMD machine; its notes hold "GPU device lost: A valid external Instance reference no longer exists.").** `src/gpu/device.ts GPU_LOST` (ON; `?gpuretry=0` = the red card at once
  for any loss, as it was). That message is the one Chrome gives a device whose page is going — a load to another address, a closed tab, the Team & kit picture's window dropped
  (reason `destroyed`) — and it used to put the card up on the page being left and print an error for every kit picture closed: now it is one `console.info`. A real loss on the
  game page loads the page again (twice a tab at most, never twice inside a minute; never on a benchmark page, a driven page (`navigator.webdriver`) or the kit picture's window),
  and the card that follows carries the adapter, the browser's reason and where the boot stood (`gpuStory`: "while compiling shaders, 37 of 119"). `tools/qa/gpulost-check.ts`
  (the rule as a table; `GPULOST_BREAK=1` must fail) and `tools/qa/shaderwait-page.cjs` (the real page, on `?paused` pages that draw nothing: once the browser has TOLD the loss,
  `device.destroy()` puts no card up and prints no error; under `?gpuretry=0` the old one-line card. On the software adapter the loss is told by the browser's GPU side, minutes
  late behind a drawn frame: a check that waits a second for it passes "no card" without the loss ever having arrived). NOT FOUND: why the AMD machine failed. Nothing here has been run on one; the other line in its notes ("invalid: resource doesn't exist")
  is not a string of the page. What would find it: the card's new second line from that machine, its `chrome://gpu` text, and whether the title drew before the card.
- **How much a page compiles: `node tools/qa/shader-count-page.cjs [--port] [--settle S] [--json f] [address …]`** (2026-10-19). Wraps `createShaderModule`, the four pipeline
  makers and `setPipeline` before the page's script runs and prints, per page of a walk (default: the title, a mission's kit picture, the mission, a second mission): modules,
  distinct texts and their size; pipelines asynchronous and synchronous, before and after ready; how many texts and pipelines an EARLIER page of the walk had made character for
  character (the most a browser's shader cache can hand back); which boot pipelines a pass took after ready; the boot line. Exit 1 on a page that did not come ready or printed a
  GPU error. The counts are the page's; no time it prints is a price on a real machine (a page is three to seven minutes on the software adapter).
- **The night breach's probes on the SHIPPED stand** (2026-10-25; tests only). `nightbreach-stage` and `nightbreach-stop` read 'tune CHANGED' there: the
  rig (`tools/qa/nightbreach-probes.ts rig`) took its `before.tune` and THEN wrote `game.tune.chaos` itself, and the shipped stand stands the game up at
  chaos 0.5 where the frozen one has 0 — the rig's own write read as the staging's. The write is before the snapshot now; both are green on both stands.
  STILL RED THERE AND KNOWN, not mended: `nightbreach-contested` ('the man Sam's rifle pins fires no blind round; the two it cannot reach fire theirs')
  and `nightbreach-restart` (its last line wants `blindRounds > 0`). Both are bars set on the frozen stand's fight; on the shipped stand a run has 0 to 2
  blind rounds (`nightbreach-fight`, seeds 11‥20: none in two of ten, the room cleared in all ten), so a line that needs one fails by the seed. Whether
  dazzled defenders SHOULD fire blind more than that on the page is the room fight's question, not a probe's. The mission itself is off the list
  (`docs/agents/menus.md`, its foot); the staging under it is the room clear's and the rescue's.
