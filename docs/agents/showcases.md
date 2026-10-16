# Showcases and the Director

One of the area files CLAUDE.md indexes. Everything below was moved here word for word from CLAUDE.md on 2026-10-13, in its old order;
"the bullet above / below" in a bullet means its neighbour there (each block says which lines it was), and a bullet named by its bold
title may now live in another file of this folder: `grep -l '<title>' docs/agents/*.md`. New bullets for this area go at the foot of this file.

<!-- was CLAUDE.md lines 695–758 -->
- **Showcase tour** (`src/game/demo.ts`; `__demo.start()` only — P no longer starts it and no card offers it, game/showkey.ts): `Shot {dur,pos,yaw,yawTo,swing,dist,distFrom,caption,sub,enter,exit,
  at,tick}`; beats drive the *real* player through `game.puppet` (goal/aim/crouch/walk/target/throwAt/fixtures) and
  synthetic keys; cuts happen under `fade`; `Guard.hold`/`pinned` are scripted-only flags; `rearm()` must rack a
  round (`chamber=1`); anything that resets guards calls `game.clearAftermath()` first; the hand-over stop calls
  `restartEncounter()` which also restores authored light/door state (`resetLevelState`). Soak the whole tour
  headlessly after edits (13 stops now, no errors, count `player.hitFlash` spikes — Sam must never be hit). Guards can be
  choreographed through `Guard.script` + `src/game/squad.ts` (runner, `order()`, `Sweep`, the `RoomClear` drill) instead of hold/pinned.
- **Breach showcase** (`src/game/breach.ts`, `?breach` / `__breach`; the start card's button only while `ui/menu.ts SHOWCASE_BUTTONS` is on — it is off; P stops it): the DAYTIME second demo. `lighting.ts
  setDaylight(g, on)` swaps `level.daylight` in (a kind-2 sun added to the LightSet, sky / haze / exposure swapped, `groupsOn/Off`, moon out) and
  back out bit for bit (state in a WeakMap; `isDaylight`); volumetrics.wgsl marches kind-2 lights through the haze UNDER the ceiling only
  (up-ray roof test per step; the moon carries volumetric 0 so night is unchanged). The cast are real `Guard`s (ids 20‥24) on scratch routes pushed
  onto `level.routes` for the show's length (game.ts deals weapons off the route every frame: ops `fn2000`, hostiles `aks74u`), the shift's Guard
  objects lifted out of `Game.guards` untouched (torches off) and put back before `restartEncounter()` — never call `resetGuards` with the cast in the list.
  `BreachDrill` is battle drill six: wait → approach (a RUN at `lowReady` = the `lowLong` carriage) → stack (latch side, #2's fist up WITH the
  stun can — two boxes off `bones.handL` through `Game.fx`, one-frame ttl: rigProps draws held cans in the right hand only) → breach → kick (`kickDoor({ leg:
  'left' })`; on the impact frame #1 strafes BACK to `plan.retreat` on his own side — he never crosses the opening — and #2's chop, started `CHOP_LEAD` early,
  releases the can `TOSS_AFTER_IMPACT` 0.15 s after impact; both `aimAt` down-and-away for the flash) → bang (`FUSE_AFTER_LAND`) → enter (per-man `OpFlow`:
  into → centre (`CENTRE_SECS` sweep, then the exchange may engage) → corner (route to his POD, sweep `cornerAim`, bark) → hold; #1 at bang + 0.4, #2 once #1 is
  inside `plan.bounds`) → clear ('room clear', the L held `NEXT_AFTER_CLEAR`) → restack (both to `plan.next.stack` on the next door, #2 point) → done (= the
  cut). `beats[]` logs it all for the probes (kickL, retreat, toss, land, in/centre/corner/hold1‥2, eyes/shot/down:k, next, stack2, cut). The cast carry
  `Guard.team` operative / hostile, so `stagedExchange`'s rounds (SETTLE / PAIR / SHIFT, spread 0.01, always a full pair) really hit through fireWeapon →
  killGuard; the drill kills by hand only if both rounds found furniture; `down:k` is logged off the state change whoever caused it. Operatives still carry
  `GuardScript.hot` in the room. (The unwired `BREACH_STAGING` seam that stood here was removed 10-09.)
  `level.breach: BreachPlan` = RoomClearPlan + hostiles / retreat / toss / `flow: [BreachFlow, BreachFlow]` (into, centre, corner, podFace, cornerAim, hold) /
  `targets[{centre, corner}]` / `next {door, stack, stackFace, stackSide, stackAim}` / breachLines (entry / entryAim kept = the flows, for RoomClear dry runs).
  Camera: five `Shot`s applied through `FollowCamera.pin` every frame (verbatim: no follow damping; `track` rate for the one moving shot; yaw/dist eased
  hold-swing-hold), hard cuts on drill cues (`until`), veil only at start/end; `restore()` nulls the pin. `document.body.classList 'breaching'` for the show's
  length (guarded for headless): index.html turns the caption into a one-line lower third and hides kit / meters / markers / prompts. QA: `probes.ts breach`
  (daylight round trip; breach-run = order + doctrine timings + the funnel test + the L geometry + pinned camera + shoulder-line p-p steadied vs not — its 'show length' window is
  the WHOLE show's now, 118‥150 s, since the loud half runs on past the cut; restore after finish / abort; tour after breach; clear-doctrine = squad.ts RoomClear keeps the same doctrine).
- **The Director = level scripting M1** (`src/game/director.ts`, `Game.director`, `__director`; spec docs/design/level-scripting.md, record docs/internal/director.md; merged 54fd23c):
  a level's SCRIPT is a plain function `(D: DirectorApi) => void` in `levels/<name>.script.ts` importing NOTHING from src/ at run time (`import type` only; scene/level.ts
  `withOfficeScript` attaches the office's as a NON-ENUMERABLE `Level.script`). Define time = handles by name (`D.mark / door / volume / route / plan / loadout / lightGroup /
  variant`) + `D.program(name, P => …, {showcase, lowerThird, endVeil, endHold})` + `D.expect.*` / `D.systems.*` → a MANIFEST linted against the level in the Game constructor
  (`lintManifest`: a missing door / volume / route / plan / group, an unknown weapon, an undeclared beat… = `armed` false, one console error, `start()` refused — the game plays on).
  TRIGGERS per program (`P.onStart / after / onEvent(kind, beat, filter) / onSignal / onEnter(volume, beat, {who}) / when(pred)`, once a run) start BEATS = GENERATORS
  (`P.beat(name, function* (c) {…})`) resumed by an explicit scheduler INSIDE `Game.update` right before `tacticsTick` (drills → bursts → news → triggers → beats); a beat yields
  `c.wait / frames / until / on / done / all / any`, flows with `start / cancel / signal / flag / note / finish`, reads ONLY `c.query` (t, escalation, unit alive / arrived / state /
  room / pos, door, groupOn, inside, plan data, flag — never Guard fields) and `c.rand()` (its own mulberry32), commands `spawn` (= spawnUnit) / `order` (= squad.ts) / `release` /
  `drill.breach` (= BreachDrill) / `drill.clear` (= RoomClear) / `drill.hold` / `drill.exchange` / `say` / `radio` / `control` / `lights.*` / `doors.*` / `stimulus.charge|burst`
  (a CAUSE: an item on its fuse, real fireWeapon rounds) / `objective`; ONLY in `showcase: true` programs `stage / puppet / press / click / camera.pin|release / caption / chapters /
  fade / variant / shift` (`scanShowcaseVerbs` = a lint error in a play program, and they throw at run time). `director.start(name)` is synchronous (a showcase: flags saved, quiet
  + touring + god + invisible, aftermath cleared, doors reset, input locked to P); `stop()` / `c.finish()` tear down (cast despawned, night back, `restartEncounter` under the veil,
  camera and flags restored; play programs hand their units to the AI). A throwing beat is `failed`, logged with its step, its men released (`strict` — headless.ts — rethrows).
  `director.log` (2500-row ring) is what probes assert on; `director.frame {look, caption, sub, fade, lowerThird, program}` is what main.ts reads while a showcase has the frame.
  Checkpoints refused while a program runs (`blocksSave`). **The breach IS program 'breach' of `levels/office.script.ts`** — same BreachDrill, cast, marks, shots, cues, timings; its
  pre-port beat log frozen in tools/qa/fixtures/breach-beats-main.json reproduces frame for frame; `game/breach.ts` keeps `BreachDrill` and `Breach` as a
  FACADE (`?breach`, the card, `__breach`, breach-probes.ts unchanged). `Level.volumes` (levelLoad, iff authored) makes `onEnter` real. QA: `probes.ts director` (breach-digest /
  lint / showcase-scan / scheduler + idle identity); a level with no script = no programs = the game exactly. **The NIGHT SHOWCASE is program `'night'`** (since 08-13; docs/internal/night-showcase.md, `probes.ts night`): the office after dark as one
  continuous infiltration in time · place chapters, the REAL player on the puppet's strings tapping his own rows (start card ▸ Night showcase when `SHOWCASE_BUTTONS` is on, `?demo`; `__night`; P only STOPS a show unless the card offers them and the floor is fresh — game/showkey.ts); BOTH showcases end on
  the start card (no 'Your turn' hand-over), Esc / P quit them to it, ← / → and the clickable timeline SEEK chapters (main.ts `seekShow`: ahead = the simulation run forward without drawing or
  sound until the program's own camera enters that chapter; back = the program restarted first — ~1–2 s of wall for the far end). `src/game/demo.ts` (the old 13-stop tour) is unreachable from the
  UI but still lapped by tools/qa/tour.ts. NOT yet: workbench Director mode / keyframes / scrub (M3), teams as data, saves inside a set piece.
  **THE DAY SHOWCASE'S LOUD HALF** (docs/internal/day-showcase.md; `levels/office.script.ts loudHalf` = the
  spine past the drill's `cut`, `loudBeats` = Blue Two's thread + the four hostiles' + the trading's camera cuts, tables `LOUD` marks / `LT` clocks / `LL` lines / `LS` set-ups): the corridor
  door booted, four hostiles spawned in the lobby (the room's three dead despawned then: 8 characters / 64 steady lights), a firefight of REAL rounds down the corridor and the middle / south
  aisles at the program's own chaos 0.8, the charge, smoke, bounds out through `breakroom_ext`; the whole show 132 s. Its Director additions (each default = as it was): `c.chaos(k | null)`
  (showcase-only; `Destruction.showChaos` read by `chaosOf` even under touring, nulled by the runtime at the end), `c.doors.kick(door, by, {leg})` / `kickSpot` (anim.kickDoor now, doors.ts
  kickIn on the impact frame — `Run.kicks`), `c.doors.open(d, angle?, {hold})` (hold = the closer off: quietT −3600 until a touch or Door.reset), `c.order(u, {aimAt: unit})` TRACKS the man
  (`Run.tracks`, chest eased 14/s), `OrderPatch.flinch` → `GuardScript.flinch` (suppression.ts: the anim start alone for a scripted man), `LoadoutSpec.god` → `Guard.god` (combat.ts's
  victim loop passes him; showcase runs only, and the lint refuses it beside a play program), finished bursts pruned; **cues between beats are FLAGS the other beat polls** (`c.on('signal')`
  sees a signal only on the tick it is fresh — a beat inside a burst's wait then never hears it). QA: `probes.ts day` (day-run over two Director rng streams / day-destruction / day-restore;
  `bun run tools/qa/day-probes.ts trace [--seed N] [--pre N] [--rounds]` = the beat / movement / round timeline the marks were walked with), `director-breach-digest` = the pre-port
  fixture as a frame-identical PREFIX (nothing new at or before the cut) + the whole show against tools/qa/fixtures/day-beats-main.json (`--write` re-freezes it, with provenance).
