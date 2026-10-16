# Deep review ledger (started 2026-08-12, overnight)

> **Status 2026-08-12 08:45** — passes 1–11 done; fix lanes game-A / game-B / tools / world MERGED (f767ad6, f719250, 0d3b050, 900aa57) plus impulses ac2c4aa, direct-quality a8ad86c, capsule cleanup 13cbd33, gi-motion b46ba72, wind f862a2a. Every ledger line marked LANE … above is now FIXED with its merge hash; PARKED = render fixes waiting for a render lane (R1.x/R2.x/R10.x), medium refactors (B7.4/B7.7/B7.9), determinism notes; YOU = T4.14 publish strip list, legacy deletion, A6.2's default. Wave 3 (re-review of everything the fixes touched, the probe files themselves, viewer internals) runs next; 'CLEAN BILL' is written here when it comes back clean.

The maintainer asked for deep review passes over EVERY file until the tree gets a clean bill of health, with maintainability /
architecture in view (this is growing into a real engine + game). This file is the coverage + findings ledger. Passes are
whole-subsystem, read-only reviewers; every finding below was verified by reading the path (many confirmed headlessly).
Status legend: FIXED <hash> · LANE <name> (being fixed) · PARKED (waits for a lane to merge / a decision) · WONTFIX (why) · YOU (maintainer decides).

## Coverage

| pass | scope | status |
|---|---|---|
| 1 render host | engine.ts, render/{passes,texpool,gbuffer,denoise,froxels,particles,lights,reach,rc,frame}.ts, gpu/device.ts, ui/quality.ts, main.ts boot | done — 5 findings |
| 2 shaders | restir/direct_common/direct, denoise, sharp_direct/sharp_edge/gdown/gbaa/taau, fgather/gather_common, froxel/volumetrics, composite, gbuffer/markings/detail/decals, reflect/reflect_p5 | done — 9 findings |
| 3 game systems (this week's) | civilians, savestate, destruction/debris/sheetModel, devices, tactics, needs, whistle, qrf, squad + seams | done — 8 findings |
| 4 tools + data | editor/**, workbench/**, viewer/{runtime,ui,scenes,state}, scene/{levelData,levelLoad,markings,markingDefaults,officeGen}, level-export, serve/build/html, artifact-page, qa/{headless,gate,probes,soak} | done — 15 findings |
| 5 drift ledger | CLAUDE.md/README/VIEWER/level-format vs code, dead/legacy footprint, duplicated helpers, TODO(LevelData), storage keys/hooks/flags | done — ledger A–E + top-10 |
| 6 game core A | game.ts, guards.ts, player.ts, combat.ts, interact.ts, mission.ts, lighting.ts, consts.ts | done — 9 findings |
| 7 game core B | character.ts, anim/**, camera, rigProps, doors, props, throwables, weapons, aim, suppression, launcher, tracers, sparks, effects, ragdoll, floor | done — 13 findings |
| 8 world/physics/smoke/audio | scene/{boxes,collision,world,level}.ts, smoke/**, audio/** | done — 13 findings |
| 9 UI + presentation | ui/**, game/{dialogue,chronicle,demo,breach,attract,weather,wet,glass,marks,particleFx,teams,input,audio_iface} | done — 12 findings |
| 10 render rest | render/{meshbvh,meshShadows,decals,wear,probe,sdfrig,rigDebug,rc,reach}.ts + shaders common(structs)/lighting_common/rc/probe/particles/cards/bloom/post/fxaa/sdfrig/markings/reflect/decals/detail | done — 10 findings |
| 11 architecture + maintainability | whole repo, structural | done — docs/internal/architecture-review.md (top-15 liabilities, target, 15-step plan) |
| 12+ (wave 3) | tools/qa probe files themselves, viewer sheet/gait/gizmo internals, docs; RE-REVIEW of every file changed by fixes → clean bill | queued |

## Findings

### Pass 1 — render host
- R1.1 passes.ts:533-546/829-850/710 · leak/perf · `rtEverOn` never cleared → reflection targets (~15–28 MB) kept + resampled on every resize on low tiers after auto calibration touched high. Fix: idle-release like setGi. — FIXED 17bda70 (fix/render-parked: setRt idle-release after 600 frames off; pool proof in docs/internal/render-parked.md)
- R1.2 quality.ts:29 + 364-366 · `cruisingFps 62` unreachable at 60 Hz → `auto ↑` never fires. — FIXED b46ba72 (gi-motion: 57 fps + union priced by the cost model)
- R1.3 texpool.ts:36-52 · empty free-list keys accumulate per resize. — FIXED 84f5893 (keys deleted with their last texture; probes.ts perf-texpool)
- R1.4 per-frame allocations (engine.ts:547 glassLightMasks, passes.ts:640/897/1229, frame.ts:128/171, lights.ts:128). — FIXED 92d2177 (hoisted; identity-hash neutral on five views vs main)
- R1.5 quality.ts:273 `volSteps` dead under froxels. — PARKED (doc/UI wording)

### Pass 2 — shaders
- R2.1 decals.wgsl:254… · `array<vec4f>` + bitcast of integer words (denormal/NaN patterns) — portability. Fix: `array<vec4u>`. — FIXED f3590a4 (array<vec4u>, bitcast<vec4f> at the float reads; hash-identical on the marks views)
- R2.2 gather_common.wgsl:52-58/115-120 · every hit walks all lights to find transients (loud-minute perf). Fix: transient tail range. — FIXED 69eebcf (the walk starts at lights.firstTransientSlot via the spare p5Cfg.w; exact — hash-identical to main WITH a stroke alive)
- R2.3 restir.wgsl:126/138/393/423 · 3-bit V quantization → verylow flicker in smoke. — PARKED (render fixes; direct-quality merged a8ad86c)
- R2.4 volumetrics.wgsl:208/237/265 · dynamically-indexed private arrays inside the stretch loop. — PARKED (perf)
- R2.5 froxel.wgsl:147/195/210 · `dirs` by value per light, sort moves 96 B. — PARKED (perf)
- R2.6 reflect_p5.wgsl:305 · hit-record bounds vs the wrong texture. — PARKED
- R2.7 passes.ts:894 resetClocks zeroes parities without re-pairing (one-frame glitch under __resetClock). — FIXED 03ddb59 (parities left alone: symmetric pairs no shader sees)
- R2.8 engine.ts:601-603 · camera cut never restarts froxel history (beam ghost on hard cuts). — FIXED 64461db (the TAA cut rule calls froxels.restartHistory; note in render-parked.md: a non-overlapping cut already rejected its history by reprojection — identical frames both builds — so the change only bites on turns in place)
- R2.9 denoise.wgsl:245-254 · sky pixels do full stats before early-out. — PARKED (looked at by fix/render-parked: no barrier hazard, but the early-out branch stores the neighbourhood variance + packed geometry that temporal-off surfaces need and silhouette neighbours read — not provably lossless, small saving; render-parked.md R2.9)

### Pass 3 — game systems
- G3.1 savestate × civilians · HIGH · civilians missing from checkpoints (resurrection on load; DEAF after load: heardUpTo stamped before eventSeq rewinds). — FIXED f719250 (game-B)
- G3.2 savestate.ts:200-216/470 · canSave allows a FAILED run (civilian kill) → loads as exfil. — FIXED f719250 (game-B)
- G3.3 tactics danger[] survives restartEncounter. Fix: tacticsReset from resetGuards. — FIXED f719250 (game-B)
- G3.4 Checkpoints.gate ignores alarmed/fleeing/reporting civilians. — FIXED f719250 (game-B)
- G3.5 debris landings `who 0` blame Sam in the chronicle. — FIXED ac2c4aa (impulses)
- G3.6 devices.ts:247 tripwire not cut by civilians. — FIXED f719250 (game-B)
- G3.7 civiliansRestore details (double reset, cowerAt). — FIXED f719250 (game-B) (with G3.1)
- G3.8 whistle events re-resolved after load. — FIXED f719250 (game-B)

### Pass 4 — tools + data
- T4.1 editor.ts:312-316 + paint.ts:239 · DATA-LOSS · resizing a marked box → invalid doc → unsaveable; autosave restore fails then gets OVERWRITTEN. — FIXED 0d3b050 (tools)
- T4.2 editor.ts:319 setBoxFlags drops `Glass`. — FIXED 0d3b050 (tools)
- T4.3 probes.ts:41 + gate.sh · unknown family = 0/0 exit 0; two-space PASS lines uncounted. — FIXED 0d3b050 (tools)
- T4.4 soak.ts no exit code; unknown flags ignored. — FIXED 0d3b050 (tools)
- T4.5 serve.ts binds 0.0.0.0; Host-header 'loopback' check spoofable. — FIXED 0d3b050 (tools)
- T4.6 editor rename keypad → door lock not rewritten; floor delete misses refs. — FIXED 0d3b050 (tools)
- T4.7 editor verbs commit PARTIAL commands on exception. — FIXED 0d3b050 (tools)
- T4.8 editor scene.ts:78 prop parts lose markings. — FIXED 0d3b050 (tools)
- T4.9 persist.ts:30 stashForPlay only knows /editor. — FIXED 0d3b050 (tools)
- T4.10 probes.ts exit codes not a verdict (half the families). — FIXED 0d3b050 (tools) (with T4.3)
- T4.11 viewer runtime collision not switched with the world (workbench). — FIXED 0d3b050 (tools)
- T4.12 MARK_TABLE_ROWS overflow silent; compaction via private fields. — FIXED 0d3b050 (tools) (lint rule + public resetMarkTable)
- T4.13 levelData routes/chokepoints name not type-checked. — FIXED 0d3b050 (tools)
- T4.14 publish-public.sh strip list predates docs/review, docs/perf, "maintainer" fingerprints. — YOU (what ships publicly)
- T4.15 workbench decodeURIComponent unguarded. — FIXED 0d3b050 (tools)

### Pass 5 — drift ledger (see the pass output; kept in full in the morning report)
- D5.A CLAUDE.md garbled Breach + FN2000 bullets, stale numbers, missing hooks/flags, __wgsl preludes — FIXED 7d88195 (architecture map refresh still to do — after the architecture pass)
- D5.B dead exports (14), dead pages src/viewer.ts + viewer/main.ts + editor.ts + editor/main.ts, unregistered tools/qa/attract.ts; legacy paths ≈1 470 lines await sign-off. — FIXED 0d3b050 (tools) (dead code) / YOU (legacy)
- D5.C duplicated helpers … — PARKED → architecture-review.md migration steps 4/5/7
- D5.D constants that should be data … — PARKED → architecture-review.md steps 13–15 (second-space blocker)
- D5.E … — PARTIAL (0d3b050: __vrt rename, typed hooks, flags documented, .fn2000 write dropped, resetQrfTune added but UNWIRED to a button; .civilians / .playerCrouch still without a reset path)

### Pass 6 — game core A
- A6.1 guards.ts:718 + 1872 · HIGH · a held CIVILIAN is a shield but never a standoff → alert men become mute statues; Sam walks past. — FIXED 501c975 — standoffPerceive takes a held civilian, the call names her ('he's got Marta, the cleaner …'); probe review-hostage-civ (civilians-comply restaged: its unseen-hold premise had leaned on the bug)
- A6.2 guards.ts:227-236 bodyInView ignores light + smoke (bodies found in pitch dark). — FIXED 501c975 — tune.bodyLight (default ON, Tab ▸ Sandbox rows, kept per machine): bodyInView asks the meter's reading at the body (probe query / CPU estimate; the finder's torch is one of the lights) against a bar eased 2 → 5 m, and the smoke segment; probe review-bodylight; soak --body-light on|off + bodiesFound smell (numbers in the lane report). Civilian bodies (civilians.ts bodyInViewOf) still use range/cone/line — a one-line follow-up for that lane
- A6.3 guards.ts:63 lightOut 'seen' through walls (distance only). — FIXED 501c975 — the lightOut event carries the fixture's position; lightOutSeen wants a line eye → fixture (or the floor under it); probe review-lightout
- A6.4 game.ts:1081 player meter NaN-poisoning (no isFinite guard). — FIXED 501c975 — isFinite guard + self-heal; probe review-meter
- A6.5 mission.ts:102 sendRackCheck can pick the HELD man (pistol pops into his fist). — FIXED 501c975 — held / scripted / unit / non-staff skipped; probe review-rack
- A6.6 guards.ts:2478 partnerWatch reads the leader's true position. — FIXED 501c975 — reports after PARTNER_UNSEEN_SECS unseen once within 2.5 m of where he last saw him (or 2× that anywhere); no truth distance
- A6.7 guards.ts:75-80 sub-gunshot report copies the shooter's exact feet when routed. — FIXED 501c975 — routed pop → prop.via (the doorway), direct → the source as before; probe review-routed-shot
- A6.8 lighting.ts:140 daylight on/off vs a PERMANENT blackout. — FIXED 501c975 + the 'Daylight puts back only a PERMANENT blackout' follow-up — DayState records the blackout it lifts and Off puts back a PERMANENT one (the breaker shot to scrap) quietly; a timed trip the day lifted stays lifted (breach-daylight's premise); probe review-day-blackout
- A6.9 game.ts:1128 door verbs performed for a Sam downed this frame. — FIXED 501c975 — updateDoors reads no act for a downed Sam; probe review-act-down

### Pass 7 — game core B
- B7.1 doors.ts:145 kicked/bashed leaf not sub-stepped → ghosts through a man at ≤ 20 fps (confirmed). — FIXED 777cf7a — a frame's kicked turn > 0.16 rad is walked in sub-steps stopping short of pressing a standing man (a 60 Hz kick is the single step it was: tactics-identity holds); probe review-kick-leaf (60 + 20 fps)
- B7.2 launcher.ts:129 rings pass through civilians. — FIXED 777cf7a — updateRings tests civilianBodies; head → civilianDown 'ring', body → flinch + toAlarmed('noise'); probe review-ring-civ
- B7.3 launcher.ts:129 vs character.ts:2383 point-blank ring passes through (origin inside cylinder). — FIXED 777cf7a — bodyHit (contact) instead of rayHit, the crown allowance trimmed to the ring's radius; probe review-ring-civ
- B7.4 ragdoll vs props (bodies fold through chairs). — PARKED (medium; after impulses)
- B7.5 throwables.ts:77 FIFO eviction can delete a live fuse / venting can. — FIXED 777cf7a — spent things first, then the oldest dropped gun; a live fuse / venting can never; probe review-item-cap
- B7.6 rigProps.ts:601 torchCarryDir per-frame lerp (frame-rate dependent torch = light meter). — FIXED 501c975 — 1 − e^(−13·dt); attachFlashlight threads dt; probe review-torch-dt
- B7.7 settled items not swept by door leaves. — PARKED
- B7.8 character.ts:1002 update(0) wipes kickHit. — FIXED 777cf7a — the kick clock only runs for dt > 0; probe review-kickhit
- B7.9 character.ts:1044 act clip hard cut. — PARKED (latent)
- B7.10 camera.ts:26 __stage(null) leaves zoom/yaw; degenerate pin. — FIXED 0d3b050 (tools) (hook) 
- B7.11 Math.random in ragdoll shove / suppression / ring kick. — PARKED (determinism note)
- B7.12 doors.ts:93 Door.reset keeps lastWho. — FIXED 777cf7a — reset() clears lastWho; probe review-door-reset
- B7.13 perf: CharacterAnimator tables per Character (4–9 ms on QRF spawn); ringSolve per frame. — PARKED

### Pass 8 — world / physics (running; one finding routed here early)
- W8.5 guards.ts ~1965 · the colleague shove added AFTER the static pass, unclamped → a man could end a frame inside a static and a ≥ 0.35 m one-frame shove resolved to the far side of a thin panel / pane (8/10 at 0.40 m). — FIXED 501c975 — collideGuard: statics swept from the frame's start in 0.2 m strides, the shove capped at 0.25 m and settled against the statics again the same frame when > 2 cm (needs / tactics identity hold); probe review-stack (cubicle panel + corridor pane, 60 + 20 fps); the soak's guard in-geometry invariant stays green

### Pass 9 — UI + presentation
- U9.1 main.ts:517 · HIGH · audio listener + mixer update commented out since 08-09. — FIXED 2197288
- U9.2 chronicle.ts:159-306 (+ civilians/devices) · score counters skipped once the event list is at MAX_EVENTS → score higher than earned in long sessions. — FIXED f719250 (game-B)
- U9.3 ui/panel.ts:48 JSON.parse of localStorage unguarded → boot loop. — FIXED f719250 (game-B)
- U9.4 bubbles.ts:19 forced layout per frame. — FIXED f719250 (game-B)
- U9.5 bindings.ts:640 spectate options stale with units. — FIXED f719250 (game-B)
- U9.6 menu.ts:178 / bindings.ts:300 glass copy says panes shatter. — FIXED f719250 (game-B)
- U9.7 boot.ts:26 longtask observer never disconnected. — FIXED f719250 (game-B)
- U9.8 demo.ts:376 goto runs the exit of a stop never entered. — PARKED (latent)
- U9.9 weather.ts:176 rain bed ignores ANNEX. — FIXED f719250 (game-B)
- U9.10 glass.ts:76 hits/log not reset per encounter. — FIXED f719250 (game-B)
- U9.11 input.ts:46 mouse position frozen under lockExcept. — FIXED f719250 (game-B)
- U9.12 bubbles.ts:22 bubbles can sit over kit/meters/objective/log. — FIXED f719250 (game-B) (HUD taste rule)

### Pass 10 — render rest
- R10.1 rc.ts:461 prewarmRc without invalidateWorld → parked grids start at 30 % dice blend for ~10 frames on the first hop (bounce + smoke ambient + LIGHT METER dip); parked instances miss world invalidations. — FIXED 5ee2ca3 (prewarm re-primes, invalidateWorldCache reaches parked grids + setDaylight calls it, BOOST_BAKES 4 in-frame bounce convergence; meter dip on the first hop chest −17 % → −2.5 %, day → night no longer 3.5× bright — render-parked.md R10.1)
- R10.2 particles.ts:191-199/158/27 birth-cap policy infers priority from kind==='spark'; a steady cosmetic non-spark emitter starves gameplay sparks and laps the LONG ring. — proto: third ring (not merged) / render fixes: explicit priority class PARKED
- R10.3 decals.wgsl float-typed buffer: cell/list words are SUBNORMAL patterns, world-fixed record bits are NaN patterns (extends R2.1). — FIXED f3590a4 (with R2.1)
- R10.4 meshShadows.ts:130 'inside-out' init boxes are INFINITE boxes under the symmetric slab test (O(N) walk on a never-refit slot; reachable from debugTrace). — PARKED
- R10.5 sdfrig.wgsl:70 flank-degenerate guard too wide (near-axis rays take the cap sphere: t late for PCSS/reflections). — PARKED (cleanup merged 13cbd33; guard untouched)
- R10.6 sdfrig.ts:50 CPU sdRoundCone lacks the WGSL guards (NaN on degenerate). — PARKED
- R10.7 probe.ts:38 + game.ts:1073 MAX_QUERIES 32 silently drops; Sam's meter queued LAST. — PARKED (game fixes round 2: queue player + smoke first, count drops)
- R10.8 probe.wgsl:38 meter ignores glassTransmit (AI meter ~10–15 % bright behind panes). — PARKED (one-model)
- R10.9 probe.ts:70 rejected mapAsync swallowed (buffer leak, stale values). — PARKED
- R10.10 rigDebug.ts:34 pipeline cache not keyed by device/layout. — PARKED (debug tool)

### Pass 8 — world / physics / smoke / audio
- W8.1 main.ts:517 audio listener/update commented out. — FIXED 2197288 (found independently by pass 9)
- W8.2 smoke.wgsl:84/93 bakeObstacles skips Dynamic → door LEAVES are never smoke obstacles (a plume fills the next room through a shut door; guards behind it blinded — one model, wrong physics); no re-bake when a leaf shuts or a static is hidden. — FIXED 900aa57 (world)
- W8.3 collision.ts:116 segmentBlocked entry-t test + origin-inside null → 49/52 wall faces leak forward (impact sounds propagate 'direct' through the wall they hit); propagate asymmetric. — FIXED 900aa57 (world)
- W8.4 collision.ts:290 nearestFree resolves across walls (31/180) → heardAt/pathLen in the wrong room. — FIXED 900aa57 (world)
- W8.5 guards.ts:1965 separation shove after the static pass → tunnelling through thin statics at ≥ 0.35 m/frame. — FIXED f767ad6 (game-A) (sent)
- W8.6 audio.ts:60-95 no voice cap / audibility cull (loud minute = 40–80 HRTF panners + a propagate per shot). — FIXED 900aa57 (world)
- W8.7 smoke.ts:246/306/224 domain placement never verified to contain the emitter (re-place every frame for high puffs); recycle ping-pong when all 8 slots busy. — FIXED 900aa57 (world)
- W8.8 music.ts:57 scheduler catch-up burst after a stall. — FIXED 900aa57 (world)
- W8.9 smoke.ts:351/481 omega/rbIters unclamped from the panel (SOR divergence → NaN slab). — FIXED 900aa57 (world)
- W8.10 smoke.ts:297 vs 439 emitters age while their half-rate domain sits out (thin muzzle gas at 30 fps). — FIXED 900aa57 (world)
- W8.11 level.ts:171 ?level=local: plans unvalidated → Game ctor can die every boot on a bad stash. — FIXED 900aa57 (world: main.ts try/catch + level.ts bootedLocalLevel/buildBundledLevel)
- W8.12 collision.ts:52/108/130 per-call Set allocations (GC churn) — reuse gather's stamp trick. — FIXED 900aa57 (world)
- W8.13 boxes.ts:506 origin-inside null rule: comment both sites (kept). — FIXED 900aa57 (world) (comment)

### Wave 3 (iii) — viewer / workbench / editor UI / page generators / JS harnesses
- V3.1 workbench/main.ts:52 painter key hook registered AFTER Input → Delete/arrows/[ ]/H/V reached the level tools while painting. — FIXED (this commit)
- V3.2 viewer/scenes.ts:139 staged-scene bodyYawDeg residue into later studio scenes. — FIXED (this commit); TODO: add a staging variant to viewer-scenes' residue chain
- V3.3 editor persist/app: unload wrote the autosave slot for a session that never edited (opening /viewer wiped an earlier unsaved level). — FIXED (this commit)
- V3.4 workbench levelCollision rebuilt per doc.rev (nav rebuild per slider mousemove; tossed items dropped). — PARKED (small)
- V3.5 `paint in materials` on parsed JSON (prototype keys). — FIXED (this commit, Object.hasOwn ×5)
- V3.6 idle throttle hands up to 0.3 s dt to simulate. — PARKED (sub-step)
- V3.7 viewer HOTKEYS table + VIEWER.md controls describe the standalone viewer. — PARKED (doc/UI wording)
- V3.8 autosave quota/denied failure silent. — PARKED
- V3.9 onProblems replaces the lint list. — PARKED
- V3.10 writeHash keeps the boot-time file after load/new. — PARKED
- V3.11 resetMotion captures turnTarget before the variant's heading. — PARKED
- V3.12 viewer sheet applies quality directly (workbench prefs out of sync). — PARKED
- V3.13 runtime canister loop keyed on wall clock. — PARKED (determinism nit)
- V3.14 editor/ui.ts:222 no-op filter. — PARKED (dead code)
- stale harness ports: p3-harness :5192, sdfrig-harness :5189, rig-identity :5215 hard-coded shot ports; p4/p5/legibility default lane ports. — PARKED (harness hygiene batch)
- CLEAN: no innerHTML with data in editor/viewer/workbench; paste-back generators match tonight's RIG/LONG shapes; every JS harness's engine/game/settings references exist; page generators self-contained.

### Wave 3 (i) — re-review of the merge queue (6efcc18..95e5d6b)
- No functional merge damage; every hand-resolved region matches a correct combination of both parents (re-merged with git merge-tree and diffed). 65 ledger lines CONFIRMED CLOSED in HEAD's code (review-a 15/15, review-b 10/10, checkpoints 6/6, editor-restore, wind 5/5 green).
- Fixed on the spot (docs/comments): CLAUDE.md duplicated flags line (a stale ?nosdfrig copy), Frame tail giCfg @784 / 800, engine.ts rigCfg comment, game.ts fn2000 comment, materials-probes verdict text, wind-probes re-baseline attribution (BISECTED: the seeded run moved with game-core-A's intended changes alone; the wind merge moved nothing).
- REOPENED: D5.A (drift re-introduced by later merges — fixed here), D5.E partial (see line). Cosmetic: probes.ts prints the checkpoints banner before checkpoint-civilians runs (verdict/exit still cover it).
- SIDE EFFECTS worth the maintainer knowing: bodies-by-light (A6.2) means an unlit body beyond 2 m is never found by a passer-by; a lockdown follower unable to reach the last-seen spot reports after 40 s (was 20); ring airfoils KO/frighten civilians (−10 on a head hit); dev servers bind 127.0.0.1 (LAN testing needs HOST=0.0.0.0); smoke stops at shut doors and wall-face impacts no longer leak sound through the wall (guards slightly less informed — intended physics); **the level re-export to 782 boxes changes levelFingerprint: checkpoint slots saved before the wind merge are refused once**; the cursor tracks through the tour lock (aim snaps to the real mouse when the tour ends).
- Pre-existing reds surfaced by the honest exit codes (identical on 6efcc18; probes predate civilians): `witness (a)`, `ko-rollcall` (both runs), `missing (A)`, `ko-kinds (b)` wording → `probes.ts ai-pass`, `ko-witness` and `all` exit 1 on HEAD. — FIXED by the probe-restaging lane (fix/probe-restage: dd5e31a baa68c5 0369fed d617b57; docs/internal/probe-restage.md): expectations updated with the commit that changed each behaviour named, ko-rollcall / missing (A) restaged civilians-off; the civilians-ON variant awaits the maintainer's answer to "is a civilian calling it in first a legitimate third outcome?"

### Wave 3 (ii) — the probe files themselves
- P3.1 MAIN IS RED IN FIVE FAMILIES nobody's gate list runs: `doors` (aim-door-sweep 7/431 traps — all through GLASS: the man sees Sam through a pane, rounds stop in it, he plants 4–6 s 'covered' = a REAL post-glass AI defect; far-refix — stale: predates the tactics lone-man rule), `ko-witness` (ko-kinds b wording 'guard down — dead'; ko-rollcall ×2 + `ai-pass` missing (A) — stale: the late worker now reports the body first, probes predate civilians; witness (a) — stale: the Five-seveN has been suppressed since 8b3f69d), `carbine` (carbine-fire 7: fresh guard 9 mm roundsReady 12 vs 11 — probe or re-deal off by one, CHECK before re-freezing), `teams` (teams-table wants 4 sides / 16 pairs; civilians made it 5 / 25). — glass defect FIXED 0513c00 (col.shotBlocked for clearShot + tactics stations + noteBore own-half rule; aim-door-sweep 1218/1218; doors family green); the four STALE families FIXED on fix/probe-restage (teams-table dd5e31a: five sides / 25 pairs; carbine-fire 7 baa68c5: neither side off by one — the box was read two frames after the deal with one fresh round already fired, now box + settle-frame rounds = the row's all-told load; ko-witness 0369fed: 'guard down — dead' per 7ecfb42, witness (a) to the suppressed pistol's truth per 8b3f69d, ko-rollcall civilians-off; ai-pass d617b57: missing (A) civilians-off + tactics-identity — ALSO red on main, bisected to 7fb3061's aim-ray-on-glass change, re-frozen 8e0cb169 with provenance); gate.sh ko-witness carbine teams ai-pass green there. STILL OPEN for the maintainer: is 'a civilian called it in first' a legitimate third outcome (a civilians-on variant of ko-rollcall / missing A waits on it — docs/internal/probe-restage.md §Question)
- P3.2 order dependence: fake DOM stubs left on globalThis (materials-probes / sdfrig-probes; editor-probes at import) → the breach threw in later probes of the same process. — FIXED 6784f19 (teardown + breach guards document.body); editor-probes' import-time stubs still install globally (latent, no verdict change today) — PARKED
- P3.3 / P3.4 frozen-baseline provenance FALSE in tactics-probes.ts:127 (literal written inside merge 78eebd3) and teams-probes.ts:99 (re-measured on the decals lane, evil-merged in 577f2af). — tactics-probes HALF FIXED d617b57 (the literal re-frozen to 8e0cb169 after a bisection to 7fb3061, its whole history written on it); teams-probes.ts:99 and the baselines/*.json move still OPEN
- P3.5 vacuous-if-empty floors missing in wall-clip speed/doors/shove/moves/ends + wall-snap sweep (probes.ts:791…1434). — FIXED 99a76d3 (ranAtLeast floors at ~half the 08-12 counts, a counted FAIL line under them)
- P3.6 far-refix red = tactics stance missing; aim-door-sweep = the glass defect (see P3.1). — FIXED 0513c00 (far-refix pinned pre-tactics with a comment; aim-door-sweep green)
- P3.7 uncounted assertion formats in corpse / follower-corpse / takedown-wall (prose '← FAIL'); corpse's counters rotted. — FIXED 03b47a5 (counted '- PASS/FAIL —' lines + a returned verdict; a staging with no victim / pair = FAIL; corpse's remark counter matches the KO wording — and reads ×0 in all four cases: whether bodyAftermath's second-man remark still fires over a KO'd body is a question for the guards lane, noted in harness-hygiene.md; takedown-wall restaged on spots the teleport keeps and asks col.solidBlocked)
- P3.8 carbine-fire 7 / ko-kinds b / witness a stale literals. — FIXED baa68c5 (carbine-fire 7: a measurement window, not a literal — see P3.1) + 0369fed (ko-kinds b, witness a)
- P3.9 ten NO-VERDICT informational probes inside `all` (leaf-wedge … motion). — FIXED 03b47a5 + a351d80 (SIX assert now: corpse, follower-corpse, takedown-wall, reclear, picked-door, body-clear; leaf-wedge / silent-repair / dead-script / motion = the `repros` family, out of `all`, runnable by name)
- P3.10 fixtures/tour-seed4242.log dead + 32-line drift; CLAUDE.md still names it. — FIXED 1d37644 (deleted — tour.ts has no diff mode; CLAUDE.md + architecture-review name the fixtures that exist)
- P3.11 checkpoint-probes soft-skips six documented refusals when staging fails. — FIXED 6c9ee8f (each un-stageable case pushes a STAGING fail)
- P3.12 quality-plan's 39 checks are in no gate list. — FIXED 2943e66 (`quality-plan` under perf via a runScript child; gate.sh perf counts 64 check lines)
- P3.13 coverage: no headless probe for PRESETS restir/dn/froxel/caps/iq/startScale blocks, heldRays → RestirU packing, or the 'OFF = byte-identical' battery (hand-run identityHash calls in commit prose). — OPEN (a `presets` probe + tools/qa/identity.js battery writing docs/perf/identity-<tier>.json vs a checked-in expected file)
- P3.14 editor-probes installs fake DOM/localStorage at import, never removed. — PARKED (latent)
- P3.15 civilians-probes writes CIV.greet without restoring; wind-identity's digest silently depends on greet's default. — FIXED e7d718b (the smaller change: probes.ts run() snapshots journal.ts knobTables() before every probe and restores after; selftest-knobs proves it) + 60db667 (wind-identity pins civilians on / greet on itself)
- P3.16 frame-layout FLAG regex decimal-only with no count guard; glass-probes / dialogue-probes loops with no count floor. — FIXED 7ef8f4b (literal reader for decimal / hex / shift + an unread literal is a FAIL + a 24 ≤ n ≤ FrameFlags count guard; floors on the conference-pane and forty-bangs loops and on dialogue-shapes' filtered script loops + Sam's sweep)
- P3.17 door-hands pageCase stands up without reseeding Math.random. — FIXED 4233d86
- P3.18 gate.sh `timeout` needs GNU coreutils; `all` is hours and cannot be green (P3.2 was one reason); checkpoints banner before checkpoint-civilians. — FIXED eab72b0 + 8910206 (timeout → gtimeout → perl alarm → uncapped with a warning, a capped family named as such, GATE_TIMEOUT; `all-quick` = perf · player · doors · qrf · checkpoints · journal · ui + the identity cards; the checkpoints banner after checkpoint-civilians and counting it)
- P3.19 wind/weapons baseline notes incomplete (wind's identity run pins neither civilians nor greet). — FIXED 60db667 (wind identityRun pins tune.civilians + CIV.greet; PROVENANCE / PROFILE blocks beside both literals: pinned vs inherited, the digest's history)
- P3.20 probes.ts head-comment name drift (`needs-frozen` → exit 2; ~60 names undocumented); perf-probes label says two owned flag bits are free; wall-shelf-pop passes but sits outside every set. — FIXED 538c068 (the head comment's index generated by the new `probes.ts list`, every registered name once; the label; wall-shelf-pop in wall-snap / player / all)
- FEATURE-PROFILE input recorded (the by-hand switches per probe: civilians / tactics / devices / needs / greet / wind / aim / discipline / carbines / qrf / bodyLight …) → architecture-review step 2 (`standUp({ profile })`).
- CLEAN: the runner/gate contract behaves exactly as documented; every registered probe outside the informational ten returns a boolean or prints counted lines; the newer families carry staging floors and restore what they patch; 40 of 45 families green in clean processes.

## Night of 08-12 → 13 (lead): what the overnight lanes closed
The five stale probe families → green (fix/probe-restage 8056711, no game changes; tactics-identity re-frozen with provenance); harness hygiene P3.5–P3.20 → FIXED (fix/harness-hygiene c6b74cd); the PARKED render batch R10.1 · R1.1 · R1.3 · R1.4 · R2.1+R10.3 · R2.2 · R2.7 · R2.8 → FIXED (fix/render-parked f35411a; R2.9 left with its reason; R2.3 / R2.4 / R2.5 / R2.6 / R10.2 untouched). What still stands between this ledger and a clean bill: P3.13 (a presets probe + identity battery), teams-probes.ts:99 provenance, R2.9 / R2.3–R2.6 / R10.2, and the YOU items (publish strip list, legacy deletion, A6.2 default, the civilians-ON question).


### Wave 4 (i) — renderer since 9fe2a91 (read-only, 08-12 ~09:30; runs: typecheck, frame-layout, materials, sdfrig all green)
- W4R.1 smoke.ts acceptance / reuse margins vs the new render fade band (a second can reusing a box vents inside the band). — FIXED a9a3a36 (coarse acceptOf = the band; SMOKE_EDGE_FRAC exported beside common.wgsl SMOKE_EDGE)
- W4R.2 raised fine domains' OPEN bottom face not eased. — FIXED a9a3a36 (floorClosed in SmokeDomain's pad word; smokeEdgeFade eases the bottom when open)
- W4R.3 voxelCoarse 0.065 put 28 % of coarse rows above the ceiling. — MOOT (voxel back to 0.055 the same morning by the maintainer's smoke-fidelity call, a9a3a36); comments restored
- W4R.4 the march's minor-light rule dropped a minor light in the strongest light's shadow (moon under an occluded sodium head → plume black there). — FIXED a9a3a36 (credited plainly in shadow); a staged still on the lot still worth taking
- W4R.5 the twin ReSTIR program is chosen by camera displacement while lever (b) cuts by per-pixel motion: a walking man's own pixels flip regime with camera drift. — PARKED (restirMotionStatic is the A/B; no still shows it)
- W4R.6 smoke_lab.wgsl's exactness reference predates the fade: `__sl.exact()` will mismatch in edge bands; the notebook's '0 mismatches' claim needs the fade folded into the reference. — OPEN (tooling truth)
- W4R.7 one frame of stale pooled hdrCopy refracted by rain after a composite-set realloc under GBAA. — PARKED (invisible)
- W4R.8 per-frame allocations left: engine.ts moving-frame tuples, v3.copy ×2, game.ts a closure per wet character. — OPEN (nit)
- W4R.9 hdrCopy (~14 MB at high) held for rain with GBAA off. — PARKED (every shipped tier has GBAA on)
- Verdict (theirs): no correctness bug in the passes; layouts agree; identity-at-rest constructions hold; between this and a clean bill stood W4R.1/2/4 (fixed) + W4R.6 + two stale comments (fixed).


### Wave 4 (ii) — game side since 9fe2a91 (read-only, 08-12 ~10:00; typecheck + glassbreak / director / wet-shading / review-lightout green)
- W4G.1 glassbreak gusts used a private storm test (a calm night / the breach blew through a hole). — FIXED (wind.ts stormWind shared) in the wave-4 game follow-up commit
- W4G.2 the OCP glance's fixture-in-view point was occluded by the fixture's own box (12 / 20 fixtures). — FIXED (a hand short of it)
- W4G.3 glassbreak update() (drops / support / events) not gated under the tour / switch off / chaos 0. — FIXED
- W4G.4 dice() = 16 sounds + 16 loud events per pane in a frame (a lobby charge: 64). — FIXED (one per pane per frame)
- W4G.5 the save's events slice dropped GameEvent.cause. — FIXED
- W4G.6 journal knobTables lacked GLASSBREAK. — FIXED
- W4G.7 RISK Director seams facing M2 (stopTour / startTour / loadCheckpoint key on breach.active; restoreSystems after resetCivilians for play programs; demo.start over a play program). — PARKED (unreachable with the one-program script; do with M2)
- W4G.8 RISK resumeAll walked R.beats by index while startBeat splices. — FIXED (snapshot)
- W4G.9 RISK maxImpacts console knob > 16 overran the GPU rows. — FIXED (clamped)
- W4G.10 RISK switch ON mid-run with the boot const off = CPU holes under an intact drawn pane until reload (the row says so); BoxWorld.raycast (aim ray) has no glassOpen hook (reticle sits on a hole's plane); the soak's 'never crosses a static' invariant has no walkable-pane exemption. — OPEN (small; before any chaos soak with the switch on)
- W4G.11 RISK OCP glance edges: 8–10 m with a line now gets nothing (old rule investigated); a decayed searcher takes the glance; only the first patrol man mutters. — PARKED (intended: quiet by the maintainer's ask; revisit if it plays wrong)
- W4G.12 RISK wetLine not in the save (a knee-deep man reloads wet all over); soak(line 0) = whole man; wet-shading asserts rows 8‥19 only. — OPEN (with the water lane)
- NITs: moths.ts allocates per frame with moths off; loadDust has no upper clamp; viewOf/signalView reach the Director through g.director. — OPEN (nits)
- Verdict (theirs): the Director port careful and everything the office script reaches checks out; glassbreak's core sound; between this and clean stood W4G.1–6 (fixed) + the three M2 seams.


### Wave 4 (iii) — particle rain v2 + the harness since 9fe2a91 (read-only, 08-12 ~10:15; gate.sh weather particles wet green, selftest red paths red, list 345 names)
- W4A.1 (look) under GBAA the rain's refraction taps read LAST frame's hdrCopy at this frame's coords — a one-frame ghost of lamp-pool edges in the streaks under a pan, one black frame of refrA on a realloc; with GBAA off the copy is this frame's. — PARKED (low; reproject or copy after the splat if it ever shows)
- W4A.2 popLog counts births before prepare() may drop a record-saturated frame's rain record → the lattice withdrawn under the disc with nothing replacing it for those frames. — OPEN (low)
- W4A.3 tune.wind 0 now makes the FAR lattice fall plumb (latticeLean overwrites the shear from the storm source); two stale 'against the wind' comments. — OPEN (low)
- W4A.4 per-frame allocations / per-frame disc re-integration with a still camera / drip edges built even headless. — OPEN (hygiene)
- W4A.5 one source of truth for INTERIOR / ANNEX / CEIL holds; day / ?noweather leave no drops; rain never touches Math.random or the fx serial; ring 3 cannot lap or starve the gameplay rings. — (sound)
- W4B.1 journal-fixtures passed on ZERO fixtures. — FIXED (floor 2) in the harness follow-up commit
- W4B.2 the glass banner could precede a red glass-break-under-glass probe. — FIXED
- W4B.3 all-quick lacked glassbreak-off / director-scheduler identity cards. — FIXED
- W4B.4 knob snapshot = journal knobTables: GLASSBREAK added (W4G.6); AMBIENT / WIND_FIELD / MOTHS / gait tables still outside (no probe writes them unguarded today). — PARKED (coverage)
- W4B.5 one silent probe inside a checking family is invisible to NO VERDICT (per-invocation CHECKED). — PARKED (by design; the remaining cannot-fail vector)
- Verdict (theirs): rain sound where it matters; harness red paths genuinely red; not a clean bill only by W4B.1 (fixed) + banner / list (fixed).

## Wave 4 verdict (2026-08-12, after the maintainer's morning notes) — CLOSE; what remains is small and listed
Every file that changed since yesterday morning has had a read-only pass (renderer, game side, rain, harness) with the deciding probe families run; every REAL bug found (W4R.1/2/4, W4G.1–6, W4B.1–3) is fixed with a hash the same morning. What stands between this ledger and a clean bill now: W4R.6 (the smoke lab's exactness reference vs the fade), W4G.10 (aim-ray glassOpen hook + the soak's walkable-pane exemption before any chaos soak with glass-break on), W4G.12 (wetLine in the save — with the water lane), W4A.2/3, the older opens (P3.13 presets probe + identity battery, teams-probes provenance, R2.9 / R2.3–2.6 / R10.2), the M2-facing Director seams (W4G.7), and the YOU items (publish strip list, legacy deletion, A6.2 default, the civilians-ON question). None is a correctness bug in play today.


### Wave 4 (iv) — today's smoke commits (2cf2cfb, a9a3a36, 2382b21, 4349541; read-only, 08-12 afternoon)
- W4S.1 panel-inventory red after the render-density tooltip. — FIXED b668447 (re-frozen, 640 rows)
- W4S.2 the diffusion weight was a plain bilinear of the half-res vol texel at output pixels: rim of blur on a man / jamb in front of a plume + shimmer. — FIXED c69a0b4 (gather-MAX of the four texels; verified on Sam's silhouette ×3)
- W4S.3 ultra / high at volEvery 1 against the file's own torture numbers. — FIXED c69a0b4 (high K 4 / every 2, ultra K 6 / every 2 after the interleaved loud-minute take: volumetrics 9.9 → 7.1 mean, 14.7 → 10.3 p95)
- W4S.4 cost model priced the classic tiers froxel-on. — FIXED c69a0b4 (vol20 × steps per pixel, no froxel term)
- W4S.5 the diffusion source was the bloom chain's Karis-weighted level (dark moat round bright edges). — FIXED c69a0b4 (its own plain box chain, passes.diffDown)
- W4S.6 densityScale 1.6 moves the guards' / cameras' / civilians' blind line to ~62 % of the former optical depth. — BY DESIGN (one model; the maintainer's pick; named in CLAUDE.md dfcbdbe)
- W4S.7 smoke_lab reference lacked the fade. — FIXED f13a6e0
- W4S.8 confined coarse emitters (stun jets, spark trails) keep the 2 cm acceptance and can vent inside a live canister box's fade band. — PARKED (low; brief, small sources)
- W4S.9 trivia: `?nofroxel&froxel` precedence until first apply; bloom up-chain dispatched at bloom 0 (no longer: the diffusion has its own chain); no SMOKE_EDGE_FRAC == SMOKE_EDGE assert. — PARKED / partly moot
- W4S.10 stale comments / CLAUDE.md smoke bullets. — FIXED c69a0b4 + dfcbdbe
- Loud minute at high after all of it (fresh boot, serialized union, 8 domains live): mean 25.0 / p95 31.2 ms — the same class as yesterday's main on this scenario (~28–29); the two levers left are the maintainer's calls: froxels back at high (−3 ms, the look they rejected) or held-light rays 4 → 2 (direct 11.3 → 8.8 mean, 18.6 → 11.9 p95 in that minute; noisier torch pools).

## Wave 3 verdict (2026-08-12 11:10) — NOT YET A CLEAN BILL
Coverage: every source file has had a pass (table above all 'done'); the merge queue was re-audited mechanically with no functional damage and 65 fixes confirmed closed. What stands between this and a clean bill: (1) five probe families red on main for stale expectations behind the civilians/tactics/suppression changes plus ONE real defect (guards planted 'covered' behind glass) — a probe-restaging lane + an AI fix; (2) harness hygiene: P3.5–P3.20 FIXED on fix/harness-hygiene (docs/internal/harness-hygiene.md) but for P3.13 (a presets probe + identity battery) and P3.3/P3.4's teams-probes half, still OPEN; (3) the PARKED render-fixes batch (R1.x / R2.x / R10.x, ~12 items) awaiting a render lane; (4) YOU items (T4.14 publish strip list, legacy deletion, A6.2 default). Everything else in this ledger is FIXED with a hash or PARKED with a reason.
