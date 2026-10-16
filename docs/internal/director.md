# The Director (level scripting M1) — lane notebook
> 2026-10-09: `BREACH_STAGING`, named below as kept, was an unwired seam and has been removed from `game/breach.ts`; `BreachDrill` and the `Breach` facade stand. The rest of this page is the record as written.

## WHERE I AM / NEXT (resume block — keep ≤ 15 lines, update on every commit)
- Worktree `.worktrees/director`, branch `feat/director` from main @0b51b27. Spec: docs/design/level-scripting.md (M1 row + decisions 1/3/4/5/6/7 as recommended).
- DONE: everything in §1 below — director.ts, levels/office.script.ts (program 'breach'), Level.script (non-enumerable) + volumes slot, Game.director + tick before
  tacticsTick, canSave hook, mission objective override, breach.ts = BreachDrill + BREACH_STAGING kept + `Breach` FACADE, main.ts reads director.frame, __director,
  probes.ts `director` family (4 probes), frozen pre-port beat log fixture (= after the port, frame for frame), page check on :5240 (stills docs/shots/director_breach_*).
- GATES (§6): typecheck ✓ build ✓ probes breach ✓ (6, breach-probes.ts untouched) director ✓ (4) tactics/needs/civilians/teams-identity ✓ level ✓ tour 2/2 ✓ ·
  `gate.sh perf player doors qrf checkpoints journal` EXIT 0 (24 / 166 / 14 / 41 / 17 / 5 PASS lines, 0 FAIL) · soak 1,2 × 8 min: seed 1 clean, seed 2 logs 2 PRE-EXISTING
  `alert-planted-at-door (g21/g23 stairwell)` — the same command on MAIN @1aa1977 logs the same two at the same frames: not this lane's.
- Merge: `git merge-tree main feat/director` is conflict-free (main's later game.ts / main.ts hunks are the rain / dust regions). NEXT: report; the merge is the lead's.

## 0. Ten-line summary

The **Director** exists (`src/game/director.ts`, ~700 lines): a level's script is a plain function `(D: DirectorApi) => void` that imports nothing from `src/` at run
time; its define pass yields a **manifest** (every mark / door / volume / route / plan / loadout / light group / variant it names, its programs, beats, triggers,
expectations) that is **linted against the level at load** — a miss disarms the script with a console error, the game stays playable; programs are started on demand
(`director.start(name)` — synchronous, between frames), their **triggers** (`onStart / after / onEvent / onSignal / onEnter / when`) start **beats that are generators**
resumed by an explicit scheduler on the game clock inside `Game.update` right before `tacticsTick`; a beat yields `wait / frames / until / on / done / all / any`, commands
actors over `spawnUnit` + squad.ts (`spawn / order / release / drill.breach|clear|hold|exchange / say / radio / control`), the world (`lights / doors / stimulus / objective`),
and — only in programs declared `showcase: true` — the camera, captions, veil, staging, daylight and the shift's bench (`scanShowcaseVerbs` finds them statically elsewhere and
they throw at run time). **The breach is now `levels/office.script.ts` program `breach`** driving the SAME `BreachDrill`; `Breach` in breach.ts is a 50-line facade so
`tools/qa/breach-probes.ts` is byte-identical and green, and the pre-port beat log frozen on main (47 beats, two seeds) reproduces **frame for frame**. With no program running
`tick()` returns on its first line: tactics / needs / civilians / teams identity cards and a 40 s idle digest are unchanged.

## 1. What M1 built, against the doc's M1 row

| Doc M1 item | Built | Where |
|---|---|---|
| `director.ts`: scheduler, generators, log | yes | `src/game/director.ts` `Director.tick / start / stop`, `LiveBeat`, `Cond`, `holds()`, `resumeAll()` (multi-pass), `LogRow` ring (400) |
| actor / world verbs over squad.ts / spawnUnit / engage | yes | `ctxOf()`: `spawn` (guards.ts `spawnUnit`), `order` (squad.ts `order`), `release` (`endGuardScript`), `drill.breach` (breach.ts `BreachDrill`), `drill.clear` (squad.ts `RoomClear`), `drill.hold`, `drill.exchange` (guards.ts `engage`), `say / radio / control`, `lights.group / mains / blackout`, `doors.lock / open / fling / shut / latch`, `stimulus.charge / burst` (items + `fireWeapon`), `objective`, `chronicle` |
| showcase camera lifted from breach.ts `Shot` | yes, verbatim math | `frameShot()` = the old `Breach.update` framing (track-damp look, hold–swing–hold yaw / dist via smoothstep(0.1, 0.9), pitch fixed, `cam.pin` written each tick); `enterShow / exitShow` = the old `start()` / `restore()` plumbing generalised; the cut = `beginFinish` → the ending tail (endVeil 0.35 / endHold 0.5) |
| `Game.director` ticked before `tacticsTick` | yes | game.ts: constructed LAST in the constructor from `level.script`; `this.director.tick(dt, input, cam)` immediately before `tacticsTick`; `restartEncounter` → `director.onEncounterRestart()` (a play program ends with its encounter; a showcase's own restore is left alone) |
| `main.ts` reads `director.frame` | yes | caption / sub, veil opacity, `body.breaching` (← `frame.lowerThird`), the listener position, the pitch easing skip, the chapters timeline, P stops a showcase; attract is not ticked while a showcase has the frame; `__director` on window |
| the breach as `levels/office.script.ts` program `breach` | yes | §4 |
| `Breach` class deleted | **kept as a facade** (§7-1) | breach.ts: `BreachDrill` + `BREACH_STAGING` unchanged (plus an opt-in `guaranteeDowns`, default = as it was), `Breach` = 50 lines over `game.director` |
| atomic beats: saves refused while running | yes (whole program, §7-4) | savestate.ts `canSave` → `director.blocksSave()` |
| define-time lint + showcase-verb scan + probe | yes | `manifestOf / lintManifest / scanShowcaseVerbs`; `probes.ts director-lint / director-showcase-scan` |
| frozen pre-port breach.log digest | yes | `tools/qa/fixtures/breach-beats-main.json` (@0b51b27, seeds 11/12) ← `director-probes.ts --write`; `probes.ts director-breach-digest` (also rides `breach`) |
| volumes reach the runtime (for `onEnter`) | yes (small addition) | `Level.volumes` (level.ts `VolumeDef`), levelLoad writes iff authored, `levelToData` writes them back |

Not built (out of M1 by the brief / the doc): the tour as a program (M2), level folders + transpile route + `Director.replace` + Tab ▸ Director (M3), `units[]` /
`director` save slices and journaled replay (M3), `marks[] / loadouts[] / lines{} / rooms[]` in LevelData v2 (M3), workbench Director mode (M4), `drill.advance`.

## 2. The API as implemented (types in `src/game/director.ts`; a script sees them through `import type`)

**Define time — `DirectorApi` (`D`)**: `mark(id, pos?, yaw?)` (LevelData has no marks[]: a script declares the literal — the lint errors on a mark with no
position), `volume(id)`, `route(id)`, `door(id)`, `plan(id)` (`'breach'` → `level.breach`; anything else = a room-clear plan by room name or door), `loadout(id,
{team, weapon?, tint?, tint2?, light?, trained?})` (declared in the script until loadouts[] exist), `lightGroup(name)`, `variant('daylight')`, `program(name, P
=> …, { showcase?, lowerThird?, endVeil?, endHold? })`, `expect.order(program, beats) / within(program, a, b, max) / never(what)` (recorded in the manifest; the
scheduler probe checks an `order` against a run's log), `systems.qrf / needs / civilians / autosave(on)` (applied for a PLAY program's length, restored after),
`util.yawTo / distXZ / lerp / add / ahead` (so a script needs no runtime import for arithmetic).

**Per program — `ProgramApi` (`P`)**: `onStart(beat)`, `after(secs, beat)` (program clock), `onEvent(kind, beat, filter?)` (a hearing `GameEvent` kind; the
filter gets an `EventView {kind, pos, level, loud, who, near(door|place, m)}`), `onSignal(name, beat)`, `onEnter(volume, beat, {who: 'sam' | 'anyUnit' | unit,
once})`, `when(pred(q), beat, {label})`, `beat(name, function* (c) {…}, {atomic})`. Every trigger fires at most once a run (M1); a beat already running is not
started twice.

**In a beat — `BeatCtx` (`c`)**: waits `wait(secs)` (first tick with programT ≥ t_yield + secs — `wait(0)` continues synchronously), `frames(n)` (holds from
tick_yield + n), `until(pred(q), label?)`, `on(kind | 'signal', filter | name)` (news of the yield's own tick does not count), `done(beat | drill)`, `started(beat)`,
`all(…)` (EVERY branch evaluated every tick; holds when all do at once), `any(…)` (→ `{index, event}` handed back into the generator); flow `start(beat)`,
`cancel(beat)`, `signal(name, data)`, `flag` (a per-run `Record<string, Json>`), `note(what, data)`, `finish()` (the program ends: a showcase cuts — veil, restore
— a play program stops), `rand()` (the run's own mulberry32), `query`, `dt`; actors `spawn(loadout, place, {callsign, yaw, light}) → UnitRef`, `despawn(u)`,
`unit(callsign)`, `order(u, {goal, speed, face, strafe, aimAt (place | unit), stance, stackSide, crouch, upper, light, hot})`, `arrived(u)`, `release(u, state)`,
`drillOf(plan | name)`, `drill.breach(plan, [op1, op2], {hostiles, guaranteeDowns}) / clear(plan, [a, b?], {live}) / hold(units, places, faces) / exchange(a[], b[],
{timeout, surprise, pin})` → `DrillRef {name, beat, phase, t, done, aborted, cleared, since(what), has(what), ops}`, `say(u, line, {radio})`, `radio(callsign, line)`,
`control(line)`; world `lights.group(g, on) / mains(on) / blackout(secs)`, `doors.lock / open / fling(d, by) / shut / latch`, `stimulus.charge(place, {by, kind, fuse})`
(a CAUSE: the item's own fuse detonates it), `stimulus.burst(u, place | unit, rounds, {cadence, spread}) → Cond` (real `fireWeapon` rounds), `objective(text | null,
markAt?)` (mission.ts shows it over the stage machine's line while the program runs), `chronicle('objective', text)`; **showcase-only** `stage(u | 'sam', place,
{yaw})`, `puppet(p | null)`, `press(key)`, `click(button)`, `camera.pin({look: place | () => Vec3, lookY, track, yaw, yawTo, pitch, dist, distTo, dur, title,
chapter}) / release() / shotT`, `caption(title, sub)`, `chapters([{title, dur}])`, `fade(to, secs)`, `variant(daylight, on)`, `shift(on)` (bench / unbench the
level's own men, torches out).

**`Query` (`q`)** (decision 5 — never Guard fields): `t`, `time`, `escalation`, `mainsOn`, `daylight`, `alive(u)`, `arrived(u)`, `state(u)`, `room(u | 'sam')`,
`pos(u | 'sam' | place)` (Sam's own position only in a showcase), `door(d) → {angle, open, latched, locked, broken}`, `groupOn(g)`, `inside(volume, who)`,
`plan(ref) → the authored BreachPlan / RoomClearPlan (data)`, `flag(name)`.

**The Director object** (`game.director`, `window.__director`): `manifest`, `problems`, `scan`, `armed`, `programs`, `canStart(name)`, `start(name, {seed})`,
`stop(finished)`, `run`, `lastRun`, `log` / `rowsOf(serial)`, `frame` (`{look, caption, sub, fade, lowerThird, program}` while a showcase has the frame), `showing`,
`lowerThird`, `chapters()`, `objective`, `blocksSave()`, `strict` (headless.ts sets it: a throwing beat fails the PROBE; in the page it fails the beat and the frame goes
on), `onProgramEnd`, `attach({cam, input})`, `summary()`.

## 3. Tick order (per frame, inside `Game.update`, immediately before `tacticsTick`)

`R.t += dt; tickN++` → the current camera shot's clock += dt → **drills** ticked (BreachDrill.tick(dt) — its own clock stamps its beats, forwarded to the log; RoomClear on
its clock; hold / exchange watched) → scripted **bursts** fire due rounds → this frame's **news** collected (hearing events not seen before, by object identity — nothing is
renumbered; signals raised since last tick) → **triggers** evaluated in declaration order, each firing at most once → **beats resumed** in start order, each synchronously until
it yields an unsatisfied condition (≤ 64 resumes a beat a tick, else failed as a runaway), passes repeated while any beat moved (≤ 8) so `done(beat)` lands the same tick
whatever the order → the **showcase tail**: the shot framed and `cam.pin` written (or, once `finish()` was called, the veil brought up and at endHold + full veil the program
stopped and everything restored) → `frame` published for main.ts. `start(name)` does the showcase plumbing (or the systems switches), fires `onStart`, runs the same
resume pass with dt 0 and the tail once — the world is staged between frames exactly as `Breach.start()` staged it. `stop()` cancels beats (`it.return()`), ends drills
(`BreachDrill.end`, `BREACH_STAGING.reset`, RoomClear.end), then showcase: units despawned → shift unbenched → daylight out → aftermath / smoke cleared →
`restartEncounter()` → camera unpinned and its yaw / pitch / distance put back → flags → input unlocked → 'restore' logged; play: units released to the AI ('search' for
staff, 'alert' otherwise), systems restored. A beat that throws: `failed`, logged `threw at step k: …`, its men released, its camera pin dropped, the frame goes on.

## 4. What the breach script looks like (`levels/office.script.ts`, 110 lines)

Handles: `D.plan('breach')`, `D.variant('daylight')`, `D.mark('park', [1.5, 0, 1.5])`, `D.loadout('blue', {operative, fn2000, Sam's tints, light off})`,
`D.loadout('tango', {hostile, aks74u, olive / black, light off})`; `D.expect.order('breach', [the drill's ORDER])`, `within('breach', 'door-flung', 'toss', 0.2)`,
`never('samHit')`. Program `breach` `{ showcase: true, lowerThird: true, endVeil: 0.35, endHold: 0.5 }`, `P.onStart('show')`:
- beat **show**: `fade(1, 0)` · `variant(day, true)` (logs 'daylight') · `shift(false)` · `stage('sam', park)` · reads the plan (`q.plan(conf)`) and spawns Blue One / Two
  at `from ?? stack` facing their stack marks and Tango 1‥3 on `hostiles[i]` · `note('cast')` · `drill.breach(conf, ops, {hostiles})` (constructs + starts THE BreachDrill)
  · `start('camera')` · `yield until(drill.since('done') > 0.05 || drill.aborted)` · `finish()`.
- beat **camera**: the five shot definitions (title / caption / dur / minDur / pitch / dist(To) / yaw(To) / lookY / track / look literal or `q => pair position clamped` /
  `until(drill)` cue on `phase` / `since('toss' | 'corner1|2' | 'next')`) → `chapters(...)`; per shot `camera.pin({...s, chapter: i, look})`, `caption`, (shot 0: `start('veil')`),
  `yield any(wait(dur), all(wait(minDur), until(cue)))`; then holds.
- beat **veil**: `yield wait(0.1); fade(0, 0.45)` — the opening comes up out of black; every later cut is hard.
Nothing in it reaches into `Game`; the drill's doctrine and fourteen clocks stay in breach.ts where the doc left them.

## 5. The lint and the scan

`manifestOf(script)` runs the define pass against a recording API with no Game and no Level (beat bodies kept, not run). `lintManifest(M, level)`: every door /
route / volume named exists; `plan 'breach'` needs `level.breach` with its `door` and `next.door` in the level and ≥ 1 hostile, any other plan a room-clear plan of
that room / door; every mark resolves to a finite position; loadouts name a spawnable side (guard / operative / hostile) and a real `WEAPONS` row with tints in
range; light groups exist among the lights' / switchables' / devices' groups; `variant` is 'daylight' and the level has the block; per program: beats declared once,
every trigger names a declared beat, `after` finite, `onEnter` names a declared volume, ≤ 32 `when`s, endVeil / endHold positive; expectations name declared programs.
Any error → `armed = false`, one console error listing them, `start()` refused with the reason. `scanShowcaseVerbs(M)`: for every program NOT declared showcase, each
beat's `Function.prototype.toString()` with comments stripped, searched for `.verb(` / `.verb.` of `SHOWCASE_VERBS` = stage puppet press click camera caption chapters fade
variant shift → `{program, beat, verb}`; hits are lint errors too, and the same verbs throw `showcase-only` at run time from `ctxOf`. Probes: `director-lint` (the office
manifest complete + a synthetic script with 11 different misses, each reported by name, the Director on it disarmed, start refused, the game stepping on),
`director-showcase-scan` (the office clean; a synthetic play program's ten uses found by program / beat / verb, none in a comment-only beat or in the sibling showcase
program, and the run-time refusal with Sam unmoved).

## 6. Gates (run headless in the worktree; outputs kept in the lane's scratchpad)

- `bun run typecheck` — clean. `bun run build` — clean (the script is in the bundle).
- `bun run tools/qa/probes.ts breach` — **ALL PASS · 6 probes** (breach-daylight, breach-run, breach-restore, breach-tour, clear-doctrine + director-breach-digest);
  `git diff main -- tools/qa/breach-probes.ts` is empty.
- `bun run tools/qa/probes.ts director` — ALL PASS · 4 (digest: seeds 11 / 12 = 47 beats identical to main @0b51b27 frame for frame; lint; scan; scheduler: onStart tick 0,
  after(1.5) tick 91, onEvent inside the step the event is pushed, when(t>1.25) tick 75, any → tick 3 index 1, all(wait .5, frames 2) → tick 33, onSignal next tick, done(beat)
  same tick, spawn / order / arrived / release, doors.open, lights.group, a throwing beat failed at its step, a runaway caught, the program still finished, canSave refused
  mid-program only, two seeded runs' logs identical, the script's expect.order holds, 40 s idle identity digest 8dd92468 both ways).
- The frozen digest before / after: `daylight@0 cast@0 shot:Ten a.m.@0 shot:Stack@436 shot:Entry@853 shot:Corners@1093 shot:Clear@1464 start@0 go@157 approach-done@436
  stacked@592 squeeze@736 kick@795 kickL@795 door-flung@818 retreat@818 toss@827 land@857 bang@884 enter1@908 enter2@966 in1@986 centre1@986 eyes1:0@1006 shot1@1027 down:0@1028
  shot1@1037 in2@1037 centre2@1037 corner1@1038 eyes1:2@1045 eyes2:1@1057 shot1@1066 down:2@1067 shot1@1076 shot2@1078 down:1@1079 shot2@1088 corner2@1089 hold1@1153 hold2@1215
  clear@1246 next@1379 stack2@1618 cut@1709 done@1709 restore@1743` — identical on both trees (the probe loop counts 1743 steps now vs 1742: the restore lands INSIDE the last
  step's Game.update instead of before it; the restore itself is on frame 1743 either way).
- `bun run tools/qa/probes.ts tactics-identity | needs-identity | civilians-identity | teams-identity | level` — ALL PASS each.
- `bun run tools/qa/tour.ts --runs 2 --quiet` — 2/2 PASS. `sh tools/qa/gate.sh perf player doors qrf checkpoints journal` — **EXIT 0**: perf 24 PASS / 0 FAIL (frame-layout, perf-cards,
  perf-flags, perf), player 166 / 0 (20 probes), doors 14 / 0 (aim-door, aim-door-chase, aim-door-sweep, far-refix, door-rules), qrf 41 / 0 (8 probes — qrf-gating drives the breach through the
  same facade), checkpoints 17 / 0 (6), journal 5 / 0 (roundtrip, pagelike, perturb, knob, 2 fixtures replay identically).
- `bun run tools/qa/soak.ts --seeds 1,2 --minutes 8 --quiet` — seed 1 clean; seed 2 logs 2 × `alert-planted-at-door (g21 / g23 : stairwell)` at 384 / 389 s (QRF units rooted a
  metre off the stair door with Sam beside them at vis 0.02) → exit 1. **The same command on main @1aa1977 logs the same two violations at the same frames (f23034 / f23346)** — a
  pre-existing QRF-at-the-stair-door smell, nothing of this lane (no program runs in the soak; the idle Director returns on its first line, and the identity digests agree).
- Page: `PORT=5240` from the worktree, `?breach&paused&quality=low&mute`: armed, no lint problems, `body.breaching` set at start, 5 units (Blue One / Two 20‥21, Tango 1‥3
  22‥24), the show stepped start → cut at 29.05 s with `__runFrames`, captions / chapters advancing on the drill's cues, finished = true, class removed, start card back, pin
  released, sun out, three fresh staff; a second run stopped with a synthetic P at 3 s: finished = false, restored, input unlocked; **no console errors**. Stills:
  docs/shots/director_breach_t5 / t12 / t17 / after.jpg (the Browser pane cannot screenshot the WebGPU canvas — they went through `__shot`).

## 7. Deviations from the doc, and why

1. **`Breach` is a facade, not deleted.** The gate says `probes.ts breach` unchanged and green; breach-probes.ts constructs `new Breach(game, cam, W.smoke, input)` and reads
   `.active / .t / .drill / .log / .cast / .onStop / .update()`. Deleting the name means editing that file. So breach.ts keeps `BreachDrill` + `BREACH_STAGING` (as the brief
   allows) and a 50-line `Breach` that delegates to `game.director` (`log` presents the legacy grouping — show notes, then drill beats, then 'restore' — off the Director's
   chronological rows). M2 retires it together with `Demo` when tour.ts is touched anyway.
2. **`c.variant(daylight, on)` and `c.shift(on)` are two showcase-only verbs the doc does not list.** The breach needs the daylight variant and the shift benched (Sam + 3 + 5
   > the 8-character budget, and today's show lifts the shift out); both gate live systems (isDaylight, the roster) so they belong with the showcase set (scanned + refused
   elsewhere). Loadouts and the park mark are declared IN the script with literals (`D.loadout(id, spec)`, `D.mark(id, pos)`) until LevelData v2 (M3) — the doc's `D.loadout(id)`
   / `D.mark(id)` by name then drop the literals.
3. **`camera.pin` takes `dur` (and `title / chapter`)** — the hold–swing–hold easing needs the shot's length; `chapters([...])` declares the timeline up front. Angles in DEGREES as
   the old Shot list had them.
4. **Saves are refused for the whole program, not only inside a beat** (`blocksSave`): between beats the cursor is fired-triggers + flags + signals + live units, which has no
   save slice until M3's `director` / `units[]` slices. M1 ships no play program, so nothing observable changes; the scheduler probe holds the refusal and its release.
5. **`all()` evaluates every branch every tick and the scheduler makes up to 8 passes** — so `all(wait, frames)` counts both from the yield and `done(beat)` resumes the waiter
   the same tick regardless of start order (the first cut short-circuited and was order-dependent; the probe caught both).
6. **Events are tracked by object identity (a WeakSet), never renumbered** — `eventSeq` (in the digest) is untouched by the Director; a program only ever sees events pushed
   after it started.
7. **The level's script rides on `Level` as a NON-ENUMERABLE property** (`withScript`): level-identity's generator ≡ JSON structural diff and key-order line walk the Level as
   data and must not see code. `buildLevel()` / relief / `?level=local` / `?levelFile=` (main.ts) attach the office script; `loadLevel` stays pure.
8. Cast as `spawnUnit` units (the doc's own M1 risk): units are exempt from game.ts's carbine deal by construction, so the show no longer forces `tune.carbineGuards = 'none'`;
   an off-screen unit's line logs as `Blue One: …` rather than `guard: …` (guards.ts say) — presentation only. Everything the digest sees is identical.

## 8. What M2+ needs from here

- **M2 (tour)**: `puppet / press / click` exist but are untested beyond the scan; the tour's `goto(k)` = re-sim; `Demo`'s per-stop `enter/exit/at/tick` closures become beats
  with `frames()` / `wait()`; `tour.ts`'s asserts read `director.frame` + rows. Retire `Breach` + `Demo` facades together; attract can stay.
- **M3**: level folders + `levels/registry.ts` (replace `withOfficeScript`), the transpile route + `Director.replace(module)` + `__simFrames`, LevelData v2 `marks[] / loadouts[]
  / lines{} / rooms[]` (then `D.mark(id)` / `D.loadout(id)` lose their literals and the lint gains 'used by beat' via the manifest), the `director` + `units[]` save slices with
  journaled replay (`ctx.query` / `rand` are already the only reads, by construction), Tab ▸ Director over `director.log`, `once: false` re-arming, `drill.advance`.
- The soak should learn `--program <name>` and the doc's script invariants once a PLAY program exists; `D.expect.*` should be checked by a generic `script` family rather than
  only the scheduler probe's order check.

## 9. CLAUDE.md bullet (draft for the lead to paste at merge)

- **The Director = level scripting** (`src/game/director.ts`, docs/design/level-scripting.md M1, docs/internal/director.md; `Game.director`, `window.__director`): a level's SCRIPT is a
  plain function `(D: DirectorApi) => void` in `levels/<name>.script.ts` that imports NOTHING from src/ at run time (`import type` only — the API is injected); scene/level.ts attaches
  the office's (`withOfficeScript`, a NON-ENUMERABLE `Level.script`: code, not level data). Define time = HANDLES by name (`D.mark(id, pos)` / `door` / `volume` / `route` / `plan('breach'
  | room)` / `loadout(id, spec)` / `lightGroup` / `variant('daylight')`) + `D.program(name, P => …, {showcase, lowerThird, endVeil, endHold})` + `D.expect.*` + `D.systems.*` → the
  MANIFEST (`manifestOf`), LINTED against the level in the Game constructor (`lintManifest`: a missing door / volume / route / plan / group, a mark with no position, an unknown
  weapon, an unspawnable side, an undeclared beat, a NaN delay = an error → `armed` false, one console error, `start()` refused — the game plays on). Per program TRIGGERS
  (`P.onStart / after / onEvent(kind, beat, filter) / onSignal / onEnter(volume, beat, {who}) / when(pred)`, each fires once a run) start BEATS = GENERATORS (`P.beat(name, function*
  (c) {…})`) resumed by an explicit scheduler INSIDE `Game.update` right before `tacticsTick` (drills → bursts → news → triggers → beats, multi-pass, ≤ 64 resumes a beat a tick →
  showcase tail); a beat yields `c.wait / frames / until / on / done / all / any`, flows with `start / cancel / signal / flag / note / finish`, reads ONLY `c.query` (t, escalation,
  alive / arrived / state / room / pos(unit), door, groupOn, inside, plan data, flag — never Guard fields) and `c.rand()` (its own mulberry32), commands `spawn` (= guards.ts spawnUnit)
  / `order` (= squad.ts order) / `release` / `drill.breach` (= breach.ts BreachDrill) / `drill.clear` (= squad.ts RoomClear) / `drill.hold` / `drill.exchange` (= engage) / `say` /
  `radio` / `control` / `lights.group|mains|blackout` / `doors.lock|open|fling|shut|latch` / `stimulus.charge` (an item on its own fuse — a CAUSE) / `stimulus.burst` (real
  fireWeapon rounds) / `objective` (mission.ts shows it); ONLY in `showcase: true` programs `stage / puppet / press / click / camera.pin|release / caption / chapters / fade / variant /
  shift` (`scanShowcaseVerbs` finds them statically in a play program = lint error, and they throw at run time). `director.start(name)` is SYNCHRONOUS (a showcase: flags saved,
  quiet + touring + god + invisible + AI on, aftermath cleared, doors reset, input locked to P; onStart beats run to their first wait — the world staged between frames);
  `stop()` / `c.finish()` tear down (showcase: cast despawned, shift back, night back, `restartEncounter` under the veil, camera and flags restored; play: units handed to the
  AI). A throwing beat is `failed` and logged with its step, its men released, the frame goes on (`strict` — headless.ts sets it — rethrows). `director.log` (400-row ring: trigger
  / beat / yield / note / spawn / drill / radio / stimulus / camera / error rows, `rowsOf(serial)`) is what probes assert on; `director.frame {look, caption, sub, fade, lowerThird}`
  is what main.ts reads while a showcase has the frame (veil, `body.breaching`, listener, pitch, chapters, P). Checkpoints are refused while a program runs (`canSave` →
  `blocksSave`; M3 brings the save slice). **The breach IS program 'breach' of `levels/office.script.ts`** (same BreachDrill, cast, marks, shots, cues, timings — the pre-port
  beat log frozen in tools/qa/fixtures/breach-beats-main.json reproduces frame for frame); `game/breach.ts` keeps `BreachDrill` + `BREACH_STAGING` and `Breach` as a FACADE
  (`?breach`, the card's button, `__breach.start/stop/t/drill/log`, tools/qa/breach-probes.ts unchanged). `Level.volumes` (levelLoad, iff authored) makes `onEnter` real.
  QA: `probes.ts director` (breach-digest — also under `breach` — / lint / showcase-scan / scheduler + idle identity); a level with no script = no programs = the game exactly.
