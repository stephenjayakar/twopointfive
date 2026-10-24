# Showcases and the Director

One of the area files CLAUDE.md indexes. Everything below was moved here word for word from CLAUDE.md on 2026-10-13, in its old order;
"the bullet above / below" in a bullet means its neighbour there (each block says which lines it was), and a bullet named by its bold
title may now live in another file of this folder: `grep -l '<title>' docs/agents/*.md`. New bullets for this area go at the foot of this file.

**THE TWO SHOWCASES WERE REMOVED (2026-10-17; the maintainer: "reusing the very old scenes from the showcases looks very hokey now. we should just remove the two
showcases and make a new benchmark").** Gone for good, code deleted (git keeps it): the NIGHT showcase (program `'night'`: `?demo`, `__night`, Extras ▸ Night showcase)
and the DAY showcase (program `'breach'`: `?breach`, `__breach`, the `Breach` facade, Extras ▸ Day showcase), with `levels/office.script.ts` (the only level script),
`src/game/showkey.ts`, `ui/menu.ts SHOWCASE_BUTTONS`, main.ts `startNight` / `seekShow` / `quitShow` / `syncShowClass`, index.html `body.breaching`, and the checks that
ran them (`probes.ts night`, `day`, `breach-run / -restore / -tour`, `director-breach-digest` and its two fixtures, `oneway-night`, `show-key-check.ts`). `?demo` and
`?breach` are now plain flags nothing reads: the page opens on the title. What stays, and is described below: the old tour (`__demo`, `tools/qa/tour.ts`), `BreachDrill`
(the night breach scenario runs it live), the daylight variant (`setDaylight`, `__daylight`), `plans.breach`, and the Director ENGINE with no program on any shipped level.
The bullets below were cut down to what is still true; other area files still mention the shows in passing as history. THE BENCHMARK, which played the day showcase as
its scene, plays three real floors instead (docs/agents/qa.md 'THE BENCHMARK'). Since the removal the page has been driven on the software adapter only
(`tools/qa/bench-page.cjs`: the title, its Extras list with no showcase rows, three mission pages); never seen on a GPU.

<!-- was CLAUDE.md lines 695–758 -->
- **Showcase tour** (`src/game/demo.ts`; `__demo.start()` by console and `tools/qa/tour.ts` only — no key, card or URL flag starts it; P or Esc over it ends it to the start card): `Shot {dur,pos,yaw,yawTo,swing,dist,distFrom,caption,sub,enter,exit,
  at,tick}`; beats drive the *real* player through `game.puppet` (goal/aim/crouch/walk/target/throwAt/fixtures) and
  synthetic keys; cuts happen under `fade`; `Guard.hold`/`pinned` are scripted-only flags; `rearm()` must rack a
  round (`chamber=1`); anything that resets guards calls `game.clearAftermath()` first; the hand-over stop calls
  `restartEncounter()` which also restores authored light/door state (`resetLevelState`). Soak the whole tour
  headlessly after edits (13 stops now, no errors, count `player.hitFlash` spikes — Sam must never be hit). Guards can be
  choreographed through `Guard.script` + `src/game/squad.ts` (runner, `order()`, `Sweep`, the `RoomClear` drill) instead of hold/pinned.
- **The breach drill and the daylight variant** (`src/game/breach.ts BreachDrill`; it was the choreography of the removed DAY showcase and is now run live by the night breach scenario, `game/nightbreach.ts`, and offered to a level script as `drill.breach`). `lighting.ts
  setDaylight(g, on)` swaps `level.daylight` in (a kind-2 sun added to the LightSet, sky / haze / exposure swapped, `groupsOn/Off`, moon out) and
  back out bit for bit (state in a WeakMap; `isDaylight`); volumetrics.wgsl marches kind-2 lights through the haze UNDER the ceiling only
  (up-ray roof test per step; the moon carries volumetric 0 so night is unchanged).
  `BreachDrill` is battle drill six: wait → approach (a RUN at `lowReady` = the `lowLong` carriage) → stack (latch side, #2's fist up WITH the
  stun can — two boxes off `bones.handL` through `Game.fx`, one-frame ttl: rigProps draws held cans in the right hand only) → breach → kick (`kickDoor({ leg:
  'left' })`; on the impact frame #1 strafes BACK to `plan.retreat` on his own side — he never crosses the opening — and #2's chop, started `CHOP_LEAD` early,
  releases the can `TOSS_AFTER_IMPACT` 0.15 s after impact; both `aimAt` down-and-away for the flash) → bang (`FUSE_AFTER_LAND`) → enter (per-man `OpFlow`:
  into → centre (`CENTRE_SECS` sweep, then the exchange may engage) → corner (route to his POD, sweep `cornerAim`, bark) → hold; #1 at bang + 0.4, #2 once #1 is
  inside `plan.bounds`) → clear ('room clear', the L held `NEXT_AFTER_CLEAR`) → restack (both to `plan.next.stack` on the next door, #2 point) → done (= the
  cut). `beats[]` logs it all (kickL, retreat, toss, land, in/centre/corner/hold1‥2, eyes/shot/down:k, next, stack2, cut). Its men carry
  `Guard.team` operative / hostile, so `stagedExchange`'s rounds (SETTLE / PAIR / SHIFT, spread 0.01, always a full pair) really hit through fireWeapon →
  killGuard; the drill kills by hand only if both rounds found furniture; `down:k` is logged off the state change whoever caused it. Operatives still carry
  `GuardScript.hot` in the room. (The unwired `BREACH_STAGING` seam that stood here was removed 10-09.)
  `level.breach: BreachPlan` = RoomClearPlan + hostiles / retreat / toss / `flow: [BreachFlow, BreachFlow]` (into, centre, corner, podFace, cornerAim, hold) /
  `targets[{centre, corner}]` / `next {door, stack, stackFace, stackSide, stackAim}` / breachLines (entry / entryAim kept = the flows, for RoomClear dry runs).
  QA: `probes.ts breach` = `breach-daylight` (the daylight round trip, bit for bit) + `clear-doctrine` (squad.ts RoomClear keeps the same doctrine); the drill itself is
  exercised by `probes.ts nightbreach`. Nothing runs it as a Director drill any more.
- **The Director = level scripting M1** (`src/game/director.ts`, `Game.director`, `__director`; spec docs/design/level-scripting.md, record docs/internal/director.md; merged 54fd23c):
  a level's SCRIPT is a plain function `(D: DirectorApi) => void` in `levels/<name>.script.ts` importing NOTHING from src/ at run time (`import type` only; scene/level.ts
  `withScript` attaches one as a NON-ENUMERABLE `Level.script`). NO SHIPPED LEVEL HAS ONE: the office's held only the two removed showcases, so `withOfficeScript` now attaches
  the office's scenario data alone and every Game's Director has no manifest and idles. Define time = handles by name (`D.mark / door / volume / route / plan / loadout / lightGroup /
  variant`) + `D.program(name, P => …, {showcase, lowerThird, endVeil, endHold})` + `D.expect.*` / `D.systems.*` → a MANIFEST linted against the level in the Game constructor
  (`lintManifest`: a missing door / volume / route / plan / group, an unknown weapon, an undeclared beat… = `armed` false, one console error, `start()` refused — the game plays on).
  TRIGGERS per program (`P.onStart / after / onEvent(kind, beat, filter) / onSignal / onEnter(volume, beat, {who}) / when(pred)`, once a run) start BEATS = GENERATORS
  (`P.beat(name, function* (c) {…})`) resumed by an explicit scheduler INSIDE `Game.update` right before `tacticsTick` (drills → bursts → news → triggers → beats); a beat yields
  `c.wait / frames / until / on / done / all / any`, flows with `start / cancel / signal / flag / note / finish`, reads ONLY `c.query` (t, escalation, unit alive / arrived / state /
  room / pos, door, groupOn, inside, plan data, flag — never Guard fields) and `c.rand()` (its own mulberry32), commands `spawn` (= spawnUnit) / `order` (= squad.ts) / `release` /
  `drill.breach` (= BreachDrill) / `drill.clear` (= RoomClear) / `drill.hold` / `drill.exchange` / `say` / `radio` / `control` / `lights.*` / `doors.*` / `stimulus.charge|burst`
  (a CAUSE: an item on its fuse, real fireWeapon rounds; `charge`'s `toss: true` = the thrower plays the animator's quick toss, off = a still hand as before the word) / `objective`; ONLY in `showcase: true` programs `stage / puppet / press / click / camera.pin|release / caption / chapters /
  fade / variant / shift` (`scanShowcaseVerbs` = a lint error in a play program, and they throw at run time). `director.start(name)` is synchronous (a showcase: flags saved, quiet
  + touring + god + invisible, aftermath cleared, doors reset, input locked to P); `stop()` / `c.finish()` tear down (cast despawned, night back, `restartEncounter` under the veil,
  camera and flags restored; play programs hand their units to the AI). A throwing beat is `failed`, logged with its step, its men released (`strict` — headless.ts — rethrows).
  `director.log` (2500-row ring) is what probes assert on; `director.frame {look, caption, sub, fade, lowerThird, program}` is what main.ts reads while a showcase has the frame.
  Checkpoints refused while a program runs (`blocksSave`). `Level.volumes` (levelLoad, iff authored) makes `onEnter` real. main.ts hands the Director the camera and the input
  (`director.attach`) and reads `director.frame` for the veil, the caption, the look-at and the chapter bar; over a running program P / Esc end it to the start card (`endShow`).
  What main.ts no longer does for a program: seek its chapters (`seekShow` is gone — the bar shows them, a click does nothing), or style a `lowerThird` (the flag is still on the
  frame; `body.breaching` is gone). QA: `probes.ts director` = `director-lint` (the shipped office carries no script and refuses a start by name; a bad script is reported and not
  armed) / `director-showcase-scan` / `director-scheduler` + idle identity, each on a script the probe stages itself; a level with no script = no programs = the game exactly.
  Not checked by anything since the removal: a showcase program end to end, `drill.breach` under the Director. `src/game/demo.ts` (the old 13-stop tour) is unreachable from the
  UI but still lapped by tools/qa/tour.ts. NOT yet: workbench Director mode / keyframes / scrub (M3), teams as data, saves inside a set piece.
  **What the day showcase's loud half added to the Director** stays as verbs no shipped script calls (each default = as it was): `c.chaos(k | null)`
  (showcase-only; `Destruction.showChaos` read by `chaosOf` even under touring, nulled by the runtime at the end), `c.doors.kick(door, by, {leg})` / `kickSpot` (anim.kickDoor now, doors.ts
  kickIn on the impact frame — `Run.kicks`), `c.doors.open(d, angle?, {hold})` (hold = the closer off: quietT −3600 until a touch or Door.reset), `c.order(u, {aimAt: unit})` TRACKS the man
  (`Run.tracks`, chest eased 14/s), `OrderPatch.flinch` → `GuardScript.flinch` (suppression.ts: the anim start alone for a scripted man), `OrderPatch.smoke` → `GuardScript.smoke` (smokebreak.ts: he has a smoke where he stands; `docs/agents/missions.md`, "A man told to have a smoke"), `OrderPatch.direct` → `GuardScript.direct` (lanes.ts lanePenalty: his walk goes the short way, not priced by the lanes his side knows are covered — without it a man sent down a road the squad has guns on goes round, as the first tutorial mission's roadblock did), `LoadoutSpec.god` → `Guard.god` (combat.ts's
  victim loop passes him; showcase runs only, and the lint refuses it beside a play program), finished bursts pruned; **cues between beats are FLAGS the other beat polls** (`c.on('signal')`
  sees a signal only on the tick it is fresh — a beat inside a burst's wait then never hears it).
