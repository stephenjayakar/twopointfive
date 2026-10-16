# Architecture & maintainability review — twopointsix

Repo `the repo` @ `main` (b737470), read-only pass, 2026‑08‑11. Inputs taken as given: CLAUDE.md, README, STATUS top, docs/internal/review-ledger.md (pass 5 C/D), docs/level-format.md, VIEWER.md, docs/internal/code-health-2026-08-06.md. Every number below was measured on this tree (scripts in the session scratchpad: import graph, reach-through table, knob counts).

## Executive summary (10 lines)

1. Size: src = 5.3 MB / 54 k physical lines (≈ 68 kloc at 80 ch) of TS+WGSL; tools/qa = 3.1 MB / 28 k lines (0.6× the product, and **outside the type system**: tsconfig includes only `src/**`, tools reach src through 400 `await import(\`${ROOT}/src/…\`)` sites typed `any`).
2. The game layer is one runtime import cycle: 22 files (30 with type edges) strongly connected through `game/game.ts` (fan‑in 39, fan‑out 57); 30 modules reach 59 `Game` members 2 513 times; 44 `WeakMap/WeakSet` side tables + 13 `X_STATS/LOG/DEBUG` singletons hold per‑Game state the Game cannot see, which is why reset/save bugs (ledger G3.1/3.3/3.8, U9.10) recur.
3. The engine is *almost* game‑agnostic in its types; the leaks are few and nameable (engine.ts→game/camera, render/particles→game/sheetModel, `WeatherFrame.interior/annex`, `debrisCap/hitFlash/nvAmount` in RenderSettings, the composition root living inside `Game`'s constructor). An `EngineHost` interface = what `tools/qa/headless.ts:96` already fakes.
4. Configuration is spread over 7 mechanisms: 169 `RenderSettings` keys (≈45 of them A/B / experiment / legacy‑off rows), 31/32 frame‑flag bits, 43 `tune` keys + ~40 module knob tables, 36 localStorage keys, 32 URL flags parsed at 25 sites in main.ts + 6 `force/veto` singletons, 466 hand‑written Tab rows (bindings.ts, 171 KB), 57 `window.__*` hooks. One typed knob registry would generate five of the seven.
5. Merge pain is structural, not incidental: over 1 111 commits / 133 merges the same central lists are touched by every lane — game.ts 155 commits (13 %), bindings.ts 121, main.ts 108, engine.ts 95, guards.ts 93, probes.ts 90 (a 200‑branch `if (which === …)` chain, probes.ts:1629–2297), CLAUDE.md 84, quality.ts PRESETS (5 rows × ~700 chars). Registries + generated tables remove most of these as conflict surfaces.
6. WGSL is assembled by string concatenation at 22 sites with 6 bespoke hot‑swap re‑implementations; ~14 host↔GPU structs are hand‑packed and only `Frame`/flags/`BoxFlag` are machine‑checked; passes.ts (1 248 lines/142 KB) carries 23 layouts, 155 `binding:` literals, 46 view + 56 bind‑group fields, 7 parity counters, 8 hand‑unrolled realloc functions. A 60‑line include/define preprocessor + struct/binding codegen + a declarative TargetSet is the right size of fix; a general render graph is not.
7. A second level is blocked architecturally by: `WORLD` compile‑time dims baked into every shader prelude before the level loads (main.ts:88 vs :119), capacity constants scattered over 6 files, office tables in code (ROOMS, BUILDING×2, INTERIOR/ANNEX, QRF_MARKS, NEED_SPOTS, CIV_SPOTS, `rack${n}_leds`/`server_leds`/`emergency` name conventions in game.ts:690–776), the one‑of‑each mission stage machine, and tour/breach/attract choreography as code (128 KB).
8. The QA harness (whole Game over a Proxy GPU, 285 soak invariants, seeded digests) is the project's best asset and must survive; what needs restructuring is registration, baselines-as-files, gate = exit code, and a "feature profile" so identity probes stop patching out later systems by hand (`(game as any).civilians.length = 0` in needs/tactics probes).
9. Type safety is good where it matters (strict TS, 0 `@ts-ignore`, game/ 0.3 `any`/kloc, render/ 0.2) and poor at the seams (main.ts 46 `as any`, editor 28/kloc, tools 83/kloc); the frame loop stops on the first throw by design (main.ts:483) and device loss is a fatal card with no re‑init — fine for a demo, not for a game.
10. Recommended month: 15 steps, front‑loaded with the mechanical de‑conflicting ones (typed tools, probe registry, hook registry, knob registry, phase table, subsystem storage) that agents can run overnight with byte‑identity gates, then the judgment steps (EngineHost boundary, struct/binding codegen, TargetSet, level‑format II, runtime world dims). No rewrite; every step keeps the identity A/B culture.

---

## 0. What was measured

| area | files | phys. lines | KB | notes |
|---|---:|---:|---:|---|
| src/game | 45 | 23 441 | 2 314 | guards.ts 2 860 / 312 KB, character.ts 2 387 / 271 KB, dialogue.ts 1 826 / 196 KB, player.ts 1 582 / 169 KB, game.ts 1 318 / 154 KB, civilians 1 045, tactics 973 |
| src/render (+shaders) | 18 + 40 | 4 366 + 10 156 | 413 + 732 | passes.ts 1 248 / 142 KB; common.wgsl 1 058, fgather 738, denoise 720, restir 628 |
| src/scene | 10 | 3 713 | 367 | officeGen 1 063 / 138 KB (legacy generator), levelData 634 |
| src/ui | 10 | 2 202 | 339 | bindings.ts 669 lines / **171 KB** (255 B/line), quality.ts 379 / 55 KB |
| src/editor+viewer+workbench | 24 | 6 301 | 674 | |
| src top (main/engine/…) | 7 | 1 682 | 213 | engine.ts 791 / 114 KB, main.ts 601 / 84 KB |
| tools/qa | 94 | 28 304 | 3 162 | probes.ts 2 302, soak.ts 1 727 (285 invariant kinds), 45 `*-probes.ts`, 15 `.js` page harnesses, 8 `.py` report builders |
| history | | | | 1 111 commits in 7 days, 133 merges, 22 branches, 17 live worktrees |

Import graph over src/**.ts: 127 files, 686 value edges, 202 type‑only edges.

---

## 1. Diagnosis

### 1.1 Module boundaries

**The `Game` hub.** `src/game/game.ts:480` — ≈75 public mutable fields, ≈60 methods (40 of them one‑line delegators kept "so ui/demo need no edits", per code‑health‑08‑06), a 120‑line constructor (game.ts:658–780) that is also the composition root for *render* objects (CharacterRenderer, MeshShadows, fitRig, Particles, IrradianceProbe, Decals, reach masks, wear map), and `update()` (game.ts:975–1090). game.ts also *houses* `Player` (146), `Guard` (332), `LightTarget`, `GameEvent`, `Interactable`, `Mission`, `TEMPERAMENT`, `CALLSIGNS`, `KIT_ORDER`, `isBreathing`, `fmtClock` — so 10 modules import **values** back from the hub (`Guard`, `isBreathing`, `TEMPERAMENT`, `KIT_ORDER`, `fmtClock`), which is what closes the runtime cycle.

What everything reaches through it for (regex over `g.`/`game.` in src/game/*, members of `Game` only):

| member | refs · modules | member | refs · modules |
|---|---|---|---|
| `time` | 590 · 24 | `level` | 77 · 16 |
| `player` | 329 · 26 | `doors` | 62 · 12 |
| `guards` | 238 · 24 | `mission` | 50 · 11 |
| `col` (collision/nav/sound) | 190 · 23 | `quietUtility` | 49 · 14 |
| `audio` | 148 · 22 | `events` (hearing bus) | 47 · 15 |
| `tune` | 104 · 15 | `chronicle` | 35 · 4 |
| `puppet` | 102 · 10 | `engine` | 34 · 12 |
| `msg` | 93 · 13 | `blackout/decals/devices/props` | 26/26/25/24 |

i.e. the *services* a subsystem actually needs are: clock, roster (player/guards/civilians), world queries (`col`), audio, config, event bus, log, level, doors, mission state, and **mode gates**. Breadth of reach per module: savestate 32 members, player 28, guards 25, combat 22, civilians 21, demo 20, devices 19, lighting 17.

**Hidden coupling — side state outside `Game`.** 44 `WeakMap/WeakSet` tables in src/game (24 keyed by the Game/Level/"object = the game", 20 by Guard/Character/Talk/GameEvent): guards.ts:169,668(×3),704,1067,1069,1277,2330,2804; dialogue.ts:337,399,790,1125,1126,1562,1746; whistle.ts:76,87,118; suppression.ts:139(×3); tactics.ts:133,140; needs.ts:96,106; wet.ts:49,53; civilians.ts:240,262; lighting.ts:125; glass.ts:28; particleFx.ts:161; squad.ts:29; mission.ts:127; chronicle.ts:111; savestate.ts:187; rigProps.ts:483. Plus module‑level mutable singletons: `X_STATS/X_LOG/X_DEBUG` ×13 (whistle, destruction, civilians, wet, aim, guards×3, suppression, needs×3, tactics×2), `let` state ×5 in game/ (savestate `runSerial`, rigProps `curOwner`, guards `unitSerial`, particleFx `matByAlbedo`, combat `strayGun`, wet `dripN`), the mutable knob tables ×~40 (`AIM`, `NEEDS`, `WHISTLE`, `CIV`, `WET`, `GLASS`, `CKPT`, `SUPPRESSION`, `CHAOS`, `PFX`, `RING`, `HOLD`, `LONG`, …), and quality.ts's `rtVeto/p5Veto/sharpForce/iqForce/gbaaForce/rigForce`. Consequences already paid: every one needs bespoke lifecycle code — 18 exported `reset*/clear*/forget*` functions called by name from `resetGuards`/`restartEncounter`/`resetLevelState`/`clearAftermath` (game.ts:821,923,935,950), 10 `*Snapshot/*Restore` pairs pulled into savestate.ts (27 imports), and the headless harness "constructs many Games per process" so anything module‑level leaks across probes (meshShadows.ts:27 comment; soak's `leak chronicle` invariant exists for this reason).

**Mode gates re‑derived everywhere.** `quietUtility`, `touring`, `puppet`, `aiEnabled`, `isDaylight`, `qrf.state`, `player.down` are combined into ≥9 bespoke predicates — `missionLive` (mission.ts:16), `sensing` (devices.ts:159), `needsLive` (needs.ts:150), `civiliansOnFloor` (civilians.ts:251), `live` (qrf.ts:168), `chaosOf` (destruction.ts:78), `radioLive`/`ambientLive` (dialogue.ts:1569,1748), `canSave` — and demo.ts:345/381, breach.ts:474/522, attract.ts:92/107 each save and restore *their own bag* of Game flags by hand. There is no mode stack; "is the game live for X" has nine answers.

**Update order as a correctness contract.** `Game.update` is 116 lines with ~35 ordered steps whose constraints live in prose ("after the guards … before updateTargets bakes the rack", game.ts:1018–1034; `saves.tick` "the last thing", :1089; rings "after the man who fired … before they move", :999). It is correct and well‑commented, but every lane inserts into the same 116 lines (155 commits on the file), and nothing but review enforces "X after Y".

**Import graph.**
- Runtime (value) cycles: one SCC of **22** game files {aim, chronicle, civilians, combat, destruction, devices, dialogue, game, guards, interact, launcher, lighting, mission, needs, player, qrf, savestate, squad, suppression, tactics, weather, wet}; with type edges it is 30. Plus `scene/{level,levelData,levelLoad}` (3) and `editor/{editor,paint}` (2). ES modules tolerate it only because no top‑level statement uses an import; the first lane that adds a module‑level `new Guard(...)`‑style constant gets a TDZ crash at boot.
- Fan‑in top 15: math/vec 90, game/game 39, scene/boxes 37, game/character 24, gpu/device 23, scene/level 21, game/camera 16, engine 15, scene/levelData 15, game/doors 15, game/consts 15, game/weapons 15, game/input 14, scene/world 14, render/lights 14.
- Fan‑out top 15: game/game 57, main 42, game/guards 37, game/player 29, ui/bindings 29, viewer/runtime 27, game/savestate 20, game/combat 19, engine 17, game/breach 16, workbench/main 15, editor/app 13, editor/ui 13, game/qrf 13, debugHooks 12.
- Layering violations (low → high): `engine.ts:17 → game/camera` (VALUE, uses 9 members of FollowCamera), `render/particles.ts:19 → game/sheetModel` (VALUE), `audio/audio.ts:6–7 → game/audio_iface + game/floor` (VALUE), `scene/level.ts:13, levelData.ts:23 → game/weapons` (type), `smoke/smoke.ts:4 → engine` (VALUE; smoke sits *above* the engine, not inside it). game→render VALUE edges from game.ts (decals, lights, meshShadows, particles, probe, reach, sdfrig, wear) are the composition‑root‑in‑the‑ctor smell, not violations per se. ui→game: bindings.ts value‑imports 19 game modules — expected for a panel, but it is why bindings.ts is the #2 conflict file.

### 1.2 Engine vs game separation

Game‑agnostic today (by types, not by comments): gpu/**, render/{texpool, gbuffer, denoise, froxels, rc, probe, meshbvh, meshShadows, sdfrig, lights, reach, passes, frame}, scene/{boxes, collision (capsule‑vs‑grid, NavGrid A*, SoundPaths), markings, world}, smoke/**, anim/**. `RtLight` (lights.ts:7) is clean: `owner`, `transient`, `broad`, `card`, `markRef` are renderer concepts. Decal kinds (`bullet|scorch|scuff|chip|glassHit|wetprint|damage`, decals.ts:33), particle kinds (`spark|debris|dust|casing|sheet`), smoke emitter kinds (`flash|wisp|canister|…|puff`) are game vocabulary living in engine files, but as *data tables* — acceptable if they become registrable kinds.

Where the game leaks in:
- `engine.ts:17` imports `FollowCamera` from game/; the engine needs `{viewProj, invViewProj, prevViewProj, pos, forward, target, fov, aspect, rebuild()}`.
- `render/particles.ts:19` imports `SHEET/IMP_RESPONSE` from `game/sheetModel.ts` (the CPU reference of a shader's constants) — the reference should live beside the shader.
- `render/frame.ts:40–56 WeatherFrame.interior/annex`: two office rectangles ride in the `Frame` uniform (weatherC/D @496/@528) and volumetrics.wgsl tests them; a second level with three roofs cannot be expressed. Should be N "no‑precipitation AABBs" in `SceneInfo` or the box list.
- `RenderSettings` holds gameplay/HUD state: `debrisCap` (game/debris pool), `hitFlash`, `nvAmount` (written from `game.player` every frame, main.ts:522).
- Owner byte = character id in the GPU flag word (boxes.ts, bits 8–15) and `PLAYER_ID`/`10+i`/`20‥24`/`40,41` id conventions: fine as an engine concept ("owner id, ≤255"), but the *allocation* of ids is scattered across game.ts:773, breach, qrf, civilians.
- Composition root: `Game`'s constructor creates and attaches render objects and reads `engine.settings.*` (game.ts:668–683, 726–745); the game duck‑types the engine as optional (`engine.gbuffer?.setWearMap`, `engine.setParticles?`, `(g.engine as { particles?: … })` ×6 in particleFx/wet/weather) precisely because the harness stand‑in (`tools/qa/headless.ts:96`: `{ device, sceneLayout, skin, lights, world, settings, effectiveScale }`) does not satisfy `Engine`. That 7‑field object *is* the engine interface the game needs; it just isn't written down.
- Capacities are engine constants scattered and inconsistent: `MAX_LIGHTS 64` (lights.ts:46), `MAX_CHARS 16` (anim/characters.ts:8) vs `MESH_MAX_CHARS 8` (meshbvh.ts:17) vs `MAX_CAPSULES 128 = 15 × 8.5` (boxes.ts:154), `maxBoxes 4096`, `MAX_GLASS 32`, `WORLD 40×28×8` (world.ts) — the "9th character throws" rule in CLAUDE.md is an emergent property of four files.

A clean boundary (see §2): `engine/` exports `EngineHost` {caps, world writer, lights, materials/markings, particles, smoke, decals, characters/skinning, camera view, probe queries, env/look frame inputs, quality, capture/hooks}; the game implements `GameModule { attach(host), update(dt, input), boxes(out), … }` against it and never touches `device`.

### 1.3 Configuration sprawl

| mechanism | count | where |
|---|---:|---|
| `RenderSettings` keys | **169** | engine.ts:20–246 (interface is 226 lines of comments = the real docs); ≈50 are per‑tier values presets write, ≈8 lossless‑proven toggles kept only for A/B (`tileCull…gridSlabs, lightReach`), ≈35 A/B‑measured‑worse or experiment rows (`restirSpatialAll/Coherent/SampleHue/RatioRaw/Permute/PenCap/PenRays`, `taauLightJump/MotionClip`, `directSeedHold`, `giAdaptiveHistory`, `rtHitReuse`, `charSoft*`×8, `sdfRigSmooth`, `sharpEdge*`, `gloss`, `markingReflPattern`…), 4 legacy off‑paths (`taau:false`, `restir:false`, `denoiser:'legacy'`, `froxelVol:false` ≈ 1 470 lines per STATUS), 3 gameplay/HUD values |
| Frame flag bits | 31 of 32 | frame.ts:58 (bit 31 is the only free one and is sign‑hazardous under JS `|`; CLAUDE.md says none free and FRAME_BYTES 752 — code says 784 since the SDF lane: live doc drift) |
| `Game.tune` keys | 43 | game.ts:630–656 (+ DEVICE_TUNE_DEFAULTS spread in) |
| module knob tables | ~40 | `export const UPPER = {…}` in game/*.ts (AIM, TRAINED, NEEDS, WHISTLE, CIV, WET, GLASS, CKPT, SUPPRESSION, CHAOS, PFX, RING, HOLD, LONG×3, SNEAK, FEET, LIFE, GAZE, …) |
| persisted keys | 36 | 10 bespoke `load/save/reset` trios (aim, civilians, destruction, devices, needs, qrf, tactics, wet, whistle + quality) each with its own JSON shape and clamping |
| URL flags | 32 in main.ts (62 across src) | `new URLSearchParams(location.search)` constructed **25×** in main.ts (:59, :93–111, :153, :201, :204, :240, :243, :262, :263, :281, :338, :454–458) + `rtVeto/p5Veto/sharpForce/iqForce/gbaaForce/rigForce` module singletons in quality.ts:94–137 so presets honour the URL |
| Tab panel rows | 466 | bindings.ts: 260 sliders, 106 toggles, 52 texts, 38 button rows, 10 selects in 21 sections — each row re‑states label, range, default and a doc string that duplicates the engine.ts comment |
| `window.__*` hooks | 57 in main.ts, 69 across src | debugHooks.ts types 27 of them (D5.E); the rest via `(window as any)` (43 casts in main.ts) |
| presets | 5 × 19 columns | quality.ts:121–125, one ~700‑char line per tier; every renderer lane appends a column to all five |

The same knob is therefore declared up to six times (settings interface + default + preset column + engine.render mirror into passes + panel row + URL flag + CLAUDE.md bullet), by hand, in five central files.

### 1.4 WGSL composition

- Assembly = string prepend at 22 sites: `scenePrelude()` (frame.ts:198 = world consts + REACH/MESH consts + common.wgsl 1 058 lines + sdfrig consts + sdfrig.wgsl 215) is prepended to ~30 modules; then per family `+ lightingCommon`, `+ volCommon`, `+ gatherCommonSrc + markingsSrc`, `+ directCommonSrc`, `+ particlesCommon`, `+ decalWgslConsts(10) + decalsSrc + markingsSrc + \`const SHARP: bool = ${sharp};\`` (passes.ts:262,422,444–447,458–483; froxels.ts:58; denoise.ts:96; probe.ts:27; rc.ts:98; gbuffer.ts:51,178; particles.ts:157–160; smoke.ts:180; main.ts:189 for `__wgsl`). Entry points share preludes *by convention*; `composite.wgsl` and `taau.wgsl` are compiled twice behind a prepended `const SHARP`.
- Hot swap re‑implements the assembly six times (`hotSwapVol/Reflect/Gather/Direct` passes.ts:509–631, denoise.ts:139, froxels.ts:73) and is exposed as seven `__hot*` hooks — each recomputing the prelude's line offset for error messages (`pre.split('\n').length - 1`, passes.ts:522,549,619).
- Host↔GPU layout duplicated by hand for ~14 structs: `Frame` (784 B byte table frame.ts:10–34 + `writeFrame`), `Light` (64 B pack in lights.ts), `BoxGeo`/mat rows (`GEO_STRIDE/MAT_STRIDE`, boxes.ts:84–85), `SceneInfo`, `SmokeDomain`+`SimParams` (smoke.ts:56–64), `Capsule`, `Particle`+`ImpulseRec` (`P_BYTES 80`, particles.ts:45–47), `RestirU` (176 + 64×MAX_LIGHTS, passes.ts:155), `DnParams` 112 B, `TaauParams` 144 B, `PostParams`, `RcParams`, `ProbeParams`, `CharInst` 80 B, `MarkRec`. Only Frame + FrameFlags + BoxFlag are machine‑checked (tools/qa/frame-layout.ts — which already implements WGSL's layout rules, i.e. the generator exists as a checker).
- Bindings: 287 `@binding` in WGSL vs 310 `binding:` literals in TS (passes.ts 155, frame.ts 28, smoke 25, rc 20, denoise 20…), 54 `createBindGroupLayout`, 53 `createBindGroup`, 28 `createPipelineLayout`. passes.ts constructor (layouts + pipelines) is 198 lines / 22 KB, `ensure*BG` 149 lines / 18 KB, `encode` 188 lines / 21 KB; lines containing `binding:` across render+smoke total 43 KB. `decalWgslConsts(binding)` (decals.ts:84) and `sdfRigWgslConsts()` show the project already generates WGSL from TS where it hurt most.
- Cold compile is dominated by prelude size (STATUS: restir/fgather/reflect ≈ 2–3 s each cold, 98 pipelines): every module drags all 1.3 k prelude lines whether it traces or not (code‑health A2 proposed the split on 08‑06; still pending).

### 1.5 Resource lifetimes

passes.ts owns ~60 textures in hand‑named fields with parallel `*View` arrays, 7 parity counters (`dParity, parity, taaParity, rParity, rtParity, hitParity, giParity`), 7 lazies (`rtEverOn/rtRanLast, giEverOn/giRanLast, hitEverOn/hitRanLast, restirRanLast`), and 8 hand‑unrolled realloc functions keyed by *resolution class* — `reallocFull` (internal), `reallocGather` (÷gatherDiv), `reallocVol` (÷volDiv), `reallocRefl` (÷rtDiv), `reallocOut` (output), `reallocComp` (composite = internal or output), `reallocMask`, `reallocGi/Hit` (passes.ts:582–616, 731–851) — each re‑stating per texture: format, usage, ping‑pong arity, carry policy (`blits` linear / `nearest` / `nearestU` / none) and which bind groups to null. `resize()` (passes.ts:696–717) decides which classes changed; `engine.render` mirrors ~60 settings into passes fields every frame before that (engine.ts:598–605, 762–773 — one line assigns 17 restir fields). texpool.ts (107 lines) + `TargetOps` are already the right primitives; froxels.ts and gbuffer.ts repeat the pattern for their own sets. Known costs: R1.1 (`rtEverOn` never cleared → 15–28 MB kept), R1.3 (pool keys accumulate), R2.7 (`resetClocks` zeroes parities without re‑pairing).

Is there a render‑graph‑shaped abstraction to extract? **Half of one.** The pass *order* is linear and short (~25 encodes in `passes.encode` + engine.render), WebGPU tracks hazards itself, and the culture depends on knowing exactly what runs — automatic scheduling would buy nothing and cost the byte‑identity story. What *is* worth extracting is a **declarative target registry** ("TargetSet"): each target declares {resolution class, format, usage, ping‑pong arity, carry policy, existence predicate, placeholder size}; resize/resample/pool/clear/`targetBytes()`/`lastRealloc` become generic; bind groups are cached against target *versions* instead of 15 hand‑nulled fields (`dropBindGroups`, `froxelViewsChanged`, `externalViewsChanged`). Cost ≈ 2 days incl. identity proof; benefit: every future pass (the direct‑quality lane, gi‑motion, trace‑perf variants) stops editing `resize()` and the ctor.

### 1.6 Testing shape

Keep: the headless whole‑Game harness (headless.ts, ~1 s wall per simulated minute), seeded soaks with 285 invariant kinds, the tour fixture log, `gate.sh`'s "every sub‑verdict" rule, frame‑layout.ts, level identity/round‑trip, the in‑page JS harnesses for GPU work (they are the only place rendering can be judged and they follow the crop discipline).

Restructure:
- **Registration**: probes.ts:1629–2297 is a 200‑branch `if (which === 'a' || which === 'family' || which === 'all')` chain (242 distinct names) interleaved with 1 600 lines of probe bodies; unknown family = 0/0 exit 0 (T4.3), half the families' exit codes are not verdicts (T4.10), verdicts are grepped from stdout (`=== … ALL PASS`).
- **Baselines**: frozen digests are literals pasted into probe files (`EXPECT_IDENTITY = {"digest":"eade1caa",…}`, needs-probes.ts:86, tactics-probes.ts:128, teams/weapons/discipline/devices/checkpoint), regenerated by `--print` and hand‑paste.
- **Feature profile**: identity probes freeze "the game as it was at commit X", so each new actor must be switched off inside every older probe (`(game.tune as any).civilians = false; (game as any).civilians.length = 0` in needs-probes.ts:57, tactics-probes.ts:78; headless.ts:97 pins `chaos = 0` for everyone). This will not scale past the next three systems; the harness needs a named baseline profile (`calm-office@v3` = {civilians off, chaos 0, needs off…}) that probes request and that new systems join by default‑off.
- **Types**: tools are not type‑checked at all and bind to internals through `any` (1 893 `any`, 400 dynamic imports); a rename in src is a runtime failure in a background agent's gate an hour later.
- **Shared fixtures**: `parkOthers/stageLeaf/placeGuard/armAlert` (probes.ts:1643–1660) and their cousins are re‑declared per probe file.
What would make lanes safer: (a) tools in the type system; (b) per‑subsystem contract probes colocated with the subsystem (its `invariants()` run by the soak automatically); (c) golden *numbers*, not golden images, for the renderer (the tile‑mean / temporal‑sd / identity‑hash metrics the p3/p4/iq harnesses already compute, checked into `docs/perf/*.json` and compared with tolerances by a probe that drives the page) — image goldens across GPUs/drivers will flake; the same‑machine `__png` identity hash stays the merge gate for "off = untouched".

### 1.7 Data vs code — what still blocks a second level

In lift order:
1. `WORLD` (scene/world.ts) — bounds 40×8×28, grid 40×28, `rcSize`, `maxBoxes` — injected as WGSL `const`s into every prelude by `engine.init()` which main.ts:88 starts *before* the level is chosen (:112–119); 14 importers size CPU arrays from it (collision, reach, decals buckets, rc, smoke, wear, destruction, editor lint). STATUS already records "WORLD is compile‑time and full → the approach is its own level".
2. Level‑specific tables in code (ledger D5.D + mine): `ROOMS` + `BUILDING` (chronicle.ts:20,31), `BUILDING` again (floor.ts:31), `INTERIOR`/`ANNEX` (weather.ts:33,36 → Frame uniform), `QRF_MARKS` (qrf.ts:39), `NEED_SPOTS` (needs.ts:33), `CIV_SPOTS` (civilians.ts:44), dialogue `ROOM_MENACE` keyed by room name (dialogue.ts:1187), floor.ts owning surfaces while the file only mirrors them (level-format.md:47), attract vantages, `CONFERENCE_CLEAR` (demo.ts:28).
3. Name conventions as schema: game.ts:690–776 keys behaviour on group strings (`'player'`, `'flashlights'`, `'server_leds'`, `'server_glow'`, `'emergency'`, `` `rack${n}_leds` ``), lighting.ts on `'exterior'`/`'mains'`, qrf.ts on door `'stairwell'`.
4. Mission = exactly one `reach`/`drive`/`exfil` (level.ts:163, level-format.md:59) driving a fixed stage machine (mission.ts, 127 lines) and the debrief's `roomOf`.
5. Shows as code: demo.ts (64 KB), breach.ts (51 KB), attract.ts (13 KB) — positions, yaws, captions, beats against office coordinates.
6. Capacities (`MAX_LIGHTS`, chars, capsules, glass) and the id allocation scheme.
7. Multi‑floor: `floors[]`/`connectors[]` are typed stubs (G2); collision has no steps/ramps; nav grid is 2D.
8. Content addressing: levels are Bun‑inlined JSON imports (level.ts:11–12) or a dev‑server fetch; there is no content manifest (level + shows + strings + spots) and no notion of "current level id" for saves beyond `levelFingerprint`.

### 1.8 Concurrency of development

The recurring conflict files are all *append‑a‑row‑to‑a‑central‑list* files: game.ts (`tune` literal, ctor tail, `update()` body, reset lists), main.ts (URL block :93–111, hooks block, HUD `order` array :556), bindings.ts (rows), quality.ts (`Preset` interface + 5 rows), passes.ts (ctor/resize/encode), frame.ts tail + common.wgsl `struct Frame` + `writeFrame`, probes.ts chain, soak.ts flags/invariants, CLAUDE.md lists, debugHooks.ts. A typical gameplay lane's landing commit touches 12–28 files (whistle ff0c4b4: 12 incl. game.ts, guards.ts, bindings.ts, menu.ts, probes.ts, soak.ts, CLAUDE.md, README; civilians d7c3289: 28). The structural fixes are the classic ones: registries the feature file writes into (knobs, hooks, probes, invariants, panel rows, savestate slices, dyn‑box contributors), one‑line‑per‑entry manifests where a central order is genuinely needed (frame phases, subsystem manifest — sorted, so two lanes' inserts auto‑merge), one file per feature's tier column instead of one row per tier, and tables in CLAUDE.md generated from those registries.

### 1.9 Type safety and error handling

- `any` per kloc: game 0.3, render 0.2, ui 2.7, scene 14.3 (mostly the JSON validator — legitimate), anim 12.7, workbench 17, editor **28.1**, main.ts 46 casts, tools/qa **83**. Non‑null `!`: game 126, render 32, ui 24 (passes.ts fields are `!:` definite‑assignment by construction order). Strict mode on, `noUnusedLocals` off, zero `@ts-ignore`.
- Exceptions: `frame()` wraps `step()` in one try/catch that **stops the loop** and shows the fatal card (main.ts:470–483, 592–599); `window.onerror/unhandledrejection` route to the same card. Deliberate and right for a tech demo ("stepping on with broken state would only bury this message"); for a game, a throw in `needsTick` should quarantine *needs* (subsystem disabled + HUD note + chronicle row), not end the session. The Subsystem boundary in §2 is where that policy hooks in.
- GPU: `device.lost → showFatal` (gpu/device.ts:33), `uncapturederror` → console only (:34; boot collects them into `__boot`). No re‑initialisation path; every GPU object is held by concrete field, so re‑init = reload. Acceptable now; note that TargetSet + shader lib make re‑creation tractable later.
- Boot: `Engine.render()` before `init()` throws a readable error (engine.ts:596) — good pattern, extend it (Game before level, hooks before ready).

### 1.10 Performance architecture (CPU)

- Per‑frame CPU is not the problem: F9 dumps in docs/perf (08‑10, M4 Max) give `cpu.update` median 0.9–1.4 ms, p95 1.5–2.9, **max 6–8 ms**; `cpu.render` (upload+encode) median 0.5–0.6, p95 ≤ 1.0. The max column is GC + one‑off work: `spawnUnit`'s CharacterAnimator tables (4–9 ms, B7.13), `buildDirReach` (~30 ms when the breach adds a sun, game.ts:526–560), A* bursts (`findPath maxIter 6000`, collision.ts:236) when tactics re‑deals.
- Allocation discipline is casual in `update()`: `this.events = this.events.filter(…)` (game.ts:1028), `all`/`contacts`/`bodyContacts`/`spots` arrays and per‑character closures for wet instances (:1036–1069), `buildInteractables` ~40 objects/frame, `v3.*` temporaries everywhere, `glassLightMasks` per frame (R1.4). At 60 Hz this is a few thousand short‑lived objects/frame — fine on V8 today, the source of the 6–8 ms max spikes tomorrow with 8 men + civilians + QRF.
- Boot: pipelines are async now; the **Game constructor is the longest main‑thread task (0.3–0.5 s)**: StaticCollision grid, wear map, mesh BVH, rig fit, reach masks ("a few tens of ms"), 6 Characters, Destruction's shape index, all synchronous inside `new Game` (main.ts:133).
- Worker candidates, in value order, *later*: level parse/validate/load + StaticCollision + reach/wear/BVH builds (pure functions of level data → transferable typed arrays; removes the ctor long task); NavGrid A* as an async service with a one‑frame answer (tactics/qrf already tolerate re‑deals); SoundPaths precompute per door‑state change. **Not** the light‑meter/smoke probe (already a 1–2 frame GPU readback; more latency breaks the one‑model contract) and not guards' per‑frame logic (determinism + shared mutable roster).

### Top‑15 structural liabilities

| # | item | evidence | cost today | fix |
|---:|---|---|---|---|
| 1 | Central append‑lists are the merge surface | game.ts 155 commits, bindings 121, main 108, engine 95, probes.ts 90, CLAUDE.md 84; 133 merges/7 days | every lane conflicts with every other; lead hand‑merges | registries + sorted one‑line manifests + generated doc tables (steps 2–5) |
| 2 | Config sprawl ×7 mechanisms | 169 settings, 31 flag bits, 43 tune + ~40 tables, 36 storage keys, 32 URL flags @25 sites, 466 panel rows, 57 hooks | a knob = 6 hand edits in 5 files; drift (D5.A/E) | typed knob registry generating settings/presets/panel/URL/persist/hooks/docs (steps 4–5) |
| 3 | `Game` god object + value cycle | ~75 fields/60 methods; fan‑in 39/out 57; 22‑file runtime SCC; Guard/Player/consts housed in game.ts | untestable in parts; TDZ hazard; every module can touch everything | `GameCtx` services + roster/events modules; move Guard/Player/consts out; delegators deleted (step 7) |
| 4 | Per‑Game state hidden in 44 Weak tables + 13 singletons | §1.1 list | bespoke reset ×18, snapshot ×10; ledger G3.1/3.3/3.8, U9.10 are this bug class | `sub(g,'needs')` typed storage + Subsystem lifecycle iterated by the Game (step 7) |
| 5 | Frame order implicit in 116 lines of prose‑commented code | game.ts:975–1090 | each lane edits the same block; order regressions only caught by soak | literal phase table, one line per step (step 6) |
| 6 | Mode gates duplicated ×9; shows save/restore flag bags by hand | mission.ts:16, devices.ts:159, needs.ts:150, civilians.ts:251, qrf.ts:168, destruction.ts:78, dialogue.ts:1569/1748; demo/breach/attract | tour/breach leaks (code‑health C, U9.8) | `ModeStack` with capabilities + `whyNot()` (step 7) |
| 7 | Engine/game boundary by convention | engine.ts:17→game/camera; particles.ts:19→game/sheetModel; `WeatherFrame.interior/annex`; `debrisCap/hitFlash/nvAmount` in RenderSettings; `(g.engine as {…})` ×6; headless fakes 7 fields | harness stand‑in drifts; second host (workbench) re‑does boot | `EngineHost` interface + import‑layer lint (step 8) |
| 8 | passes.ts god class | 1 248 lines; 23 layouts, 155 `binding:` literals, 46 views, 56 BGs, 28 pipelines, 7 parities, 7 lazies, 8 realloc fns; engine mirrors ~60 fields/frame | every renderer lane edits ctor+resize+encode; R1.1/R1.3/R2.7 | per‑pass modules + TargetSet + settings snapshot (steps 11–12) |
| 9 | WGSL by concatenation; layouts by hand | 22 prepend sites, 6 hot‑swap copies, ~14 hand‑packed structs (3 checked), 287/310 binding literals | silent GPU garbage on a missed offset; 2–3 s cold compiles from fat preludes | include/define preprocessor + `defineStruct`/`defineBindings` codegen (steps 10–11) |
| 10 | tools/qa outside the type system | tsconfig `include: src/**`; 400 `import(\`${ROOT}/src…\`)`; 1 893 `any` | renames break gates at runtime in background agents | static imports + tools tsconfig (step 1) |
| 11 | Probe registration/baselines/gate semantics | 200‑branch chain probes.ts:1629–2297; digests as pasted literals; verdict by stdout grep; identity probes patch out later systems | T4.3/T4.10; every new actor edits N old probes | `defineProbe` + baselines/*.json + profiles + exit‑code gate (step 2) |
| 12 | Second‑level blockers in code | WORLD consts baked pre‑level (main.ts:88 vs :119); ROOMS/BUILDING×2/INTERIOR/ANNEX/QRF_MARKS/NEED_SPOTS/CIV_SPOTS; group‑name conventions game.ts:690–776; one‑of‑each mission; shows as 128 KB of code | approach.json must be "its own level"; every AI system is office‑only | level‑format II regions/spots + WorldDims at load + objective list (steps 13–15) |
| 13 | CLAUDE.md as hand‑maintained contract | 857 lines/127 KB in every agent's context; FRAME_BYTES 752 vs 784, "no bit free", 776 boxes (D5.A) | agents act on stale facts | generate the tables (flags, Frame layout, hooks, URL flags, knobs, capacities) into an included file (step 5/9) |
| 14 | Error policy = stop the world | main.ts:483; device lost = fatal, no re‑init | fine for a demo; a shipped game loses the session to one subsystem's throw | per‑subsystem quarantine in non‑dev builds via the Subsystem runner (step 7, flag‑gated) |
| 15 | Synchronous 0.3–0.5 s Game ctor; casual per‑frame allocation | main.ts:133; game.ts:1028–1069; perf max 6–8 ms | jank on restart/level load; GC spikes | staged async ctor now; builders → worker later; scratch arrays in hot loops (step 8 tail / backlog) |

---

## 2. Target

### 2.1 Directory / package structure

```
src/engine/                 ← imports nothing from game/, content/, shell/ (lint-enforced)
  gpu/          device.ts timer.ts texpool.ts
  caps.ts       Capacities: MAX_LIGHTS, MAX_CHARS(=skin=mesh=capsule owner budget), maxBoxes, MAX_GLASS, WorldDims (runtime, from content meta)
  world/        boxes.ts grid markings.ts materials.ts collision.ts (capsule/grid, NavGrid, SoundPaths — generic spatial services)
  lights/       lights.ts reach.ts
  render/       host.ts(Engine implements EngineHost) frame.ts targets.ts(TargetSet) shaderlib.ts structs.ts bindings.ts
                passes/ direct.ts restir.ts denoise.ts gather.ts reflect.ts volumetrics.ts froxels.ts taau.ts sharp.ts post.ts …(one file per pass family: layout+pipeline+encode+targets it owns)
  shaders/      *.wgsl (+ *_common includes)         smoke/  particles/  decals/  characters/(skinning meshbvh meshShadows sdfrig)  camera.ts  probe.ts
  config/       registry.ts (defineKnobs) quality.ts (tiers = columns collected from knob files; auto ladder + cost model unchanged)
  dev/          hooks.ts (registry → window.__*) capture.ts wgsl-lint.ts hot.ts (generic recompile)
src/game/                   ← imports engine via EngineHost + engine types only
  core/         game.ts (state + GameCtx) frame.ts (phase table) subsystem.ts modes.ts (ModeStack) events.ts (hearing bus) roster.ts (ids, teams) manifest.ts (sorted list of subsystems)
  actors/       character.ts anim/* ragdoll.ts rigProps.ts player/* guards/{perception,statemachine,search,standoff,escalation,rollcall,units}.ts civilians.ts
  systems/      needs tactics qrf devices whistle suppression aim destruction debris glass weather wet marks particleFx tracers sparks launcher throwables props doors lighting mission chronicle savestate dialogue
  shows/        demo.ts breach.ts attract.ts (runners; choreography → content)
  ui/           menu overlay debrief bubbles bindings.ts (= registry rows + the few bespoke game rows)
src/content/    levelData.ts levelLoad.ts level.ts contentSet.ts officeGen.ts(legacy)      levels/*.json shows/*.json strings/*.json
src/shell/      main.ts (game page) workbench/ editor/ viewer/  — hosts: boot, DOM, hooks install
tools/qa/       harness/(headless.ts run.ts gate profiles.ts fixtures.ts) probes/<family>.ts baselines/*.json soak/(soak.ts invariants come from subsystems) pages/*.js reports/*.py
```

### 2.2 Core abstractions (sketches)

```ts
// engine/render/host.ts — what a game is handed. This is tools/qa/headless.ts:96 made explicit and typed.
export interface EngineHost {
  readonly caps: Capacities;                       // one table; "the 9th character" is caps.maxChars, not four files
  readonly world: WorldWriter;                     // setStatics(Box[]), dynamics, resetCapsules/addCharacterCapsules, repackMarkings, CPU raycast/segment (the CPU mirror)
  readonly lights: LightSet;
  readonly probe: IrradianceQueries;               // query/querySegment/get — the one-model window; a table stub headless
  readonly render: Readonly<Pick<RenderKnobs, 'flashlightRadius' | 'emissiveScale' | 'markingTexel'>>;  // the 3 render values the game legitimately reads
  env: EnvFrame;                                   // was WeatherFrame: rain, shear, wet, flash, rainTop, noPrecip: Aabb[] (N boxes, not INTERIOR/ANNEX)
  look: LookFrame;                                 // nvAmount, hitFlash (game-owned post inputs; out of RenderSettings)
  attach<K extends keyof Attachments>(k: K, v: Attachments[K] | null): void;   // 'skin' | 'meshShadows' | 'rigFit' | 'particles' | 'decals' | 'wearMap'
  createCharacterRenderer(mesh: GltfCharacter): CharacterRendererLike;         // device stays inside the engine (game/ has 5 `engine.device` uses today, all constructing render objects)
  onAfterSubmit(f: () => void): Unsub;
  readonly view: { sharpStill: boolean; effectiveScale: number };             // the two facts mPerPx needs (game.ts:1047)
}
export interface CameraView { viewProj: Mat4; invViewProj: Mat4; prevViewProj: Mat4; pos: Vec3; forward: Vec3; target: Vec3; fov: number; aspect: number; rebuild(): void; }
// Engine.render(cam: CameraView, …) — FollowCamera stays in game/ and implements it.
```

```ts
// engine/config/registry.ts — ONE configuration model
export type Tier = 'ultra' | 'high' | 'medium' | 'low' | 'verylow';
export interface KnobSpec<T extends number | boolean | string | readonly number[]> {
  def: T; range?: readonly [number, number]; step?: number; choices?: readonly T[];
  tier?: Partial<Record<Tier, T>>;            // the preset column lives WITH the knob (kills quality.ts PRESETS rows); absent = def everywhere
  persist?: 'machine';                         // localStorage twopointsix.<group>.<key>; reset/export for free
  url?: true | string;                         // ?key=v, ?nokey for booleans; parsed once
  panel?: { section: string; label?: string } | false;
  doc: string;                                 // the ONE doc string → panel tooltip, docs table, CLAUDE.md include
  ab?: true;                                   // experiment / measured-worse row: never in a tier, listed in the A/B table
  offIsIdentity?: true;                        // the byte-identity promise: surfaced in docs; a probe enumerates them
  hook?: false;                                // default: readable/settable under window.__knobs.<group>.<key>
}
export declare function defineKnobs<S extends Record<string, KnobSpec<any>>>(group: string, spec: S, opts?: { scope: 'render' | 'game' | 'dev' }): KnobGroup<S>;
// Derived, generated at boot (and by `bun run tools/gen-tables.ts` for docs):
//   RenderKnobs / GameKnobs typed views (replaces RenderSettings + Game.tune + the 40 UPPER tables' persisted subset)
//   applyTier(t): writes every knob's tier column — Quality.apply() becomes 10 lines; auto's plan()/REF/FACTOR untouched
//   parseUrl(location.search) once; panelRows(section) for bindings.ts; persist load/save/reset; window.__knobs; docs/generated/knobs.md
// FrameFlags: flags become `defineFlag('GridSkip', { knob: render.gridSkip })` entries in the same registry; the u32 is assembled from it (engine.ts:691–695 goes).
```

```ts
// game/core/subsystem.ts — the unit a lane adds
export type Phase = 'sense' | 'prePlayer' | 'player' | 'projectiles' | 'preAi' | 'ai' | 'postAi' | 'world' | 'mission' | 'physics' | 'targets' | 'env' | 'items' | 'renderSync' | 'meter' | 'late';
export interface Subsystem<State = void, Save = never> {
  readonly id: string;                                             // 'needs' — keys its state, knobs, hooks, save slice, panel line, docs row
  create?(g: GameCtx): State;                                      // per-Game state: replaces WeakMap<Game,…> and module lets; g.sub('needs') reads it typed
  perActor?: { create(g: GameCtx, a: Actor): unknown };            // replaces WeakMap<Guard,…>; dies with the actor, iterated by savestate
  steps?: Partial<Record<Phase, (g: GameCtx, s: State, dt: number) => void>>;   // referenced BY the phase table; never self-ordering
  live?(g: GameCtx): string | null;                                // why-not, composed from ModeStack capabilities (replaces needsLive/sensing/civiliansOnFloor/…)
  resetEncounter?(g: GameCtx, s: State): void;                     // restartEncounter iterates the manifest (kills the 18 named reset calls)
  clearAftermath?(g: GameCtx, s: State): void;
  snapshot?(g: GameCtx, s: State): Save;                           // savestate slice, JSON-safe; absent = "not saved" is now discoverable
  restore?(g: GameCtx, s: State, saved: Save): void;
  boxes?(g: GameCtx, s: State, out: Box[]): void;                  // dynamic geometry (doors/props/items/destr/devices/rings/handProps/fx/tracers/sparks today: game.ts:1037–1053)
  knobs?: KnobGroup<any>;                                          // colocated; scope 'game'
  hooks?(g: GameCtx, s: State): Record<string, unknown>;           // → window.__needs (registry-installed; debugHooks.ts types generated)
  summary?(g: GameCtx, s: State): string;                          // panel + __<id>.summary()
  stats?(s: State): Record<string, number>;                        // replaces X_STATS singletons; soak prints them
  invariants?(g: GameCtx, s: State, v: Violate): void;             // soak runs every registered subsystem's invariants — colocated with the code they police
}
export interface GameCtx {          // the narrow parameter that replaces `g: Game` over time (both accepted during migration: Game implements GameCtx)
  readonly time: number; readonly dt: number; readonly level: Level; readonly col: WorldQueries; readonly audio: GameAudioLike;
  readonly roster: Roster;          // player, guards, civilians, units, byId, onFloor(), teams
  readonly events: HearingBus;      // push/scan/markSeen — the 0.5 s window (game.ts:1028) owned here
  readonly modes: ModeStack; readonly log: MsgLog; readonly knobs: GameKnobs; readonly host: EngineHost;
  sub<K extends SubsystemId>(k: K): SubState<K>;
}
```

```ts
// game/core/frame.ts — THE order: a literal, one line per step, the "why" as the third argument (today game.ts:975–1090)
export const FRAME: readonly Step[] = [
  step('aim',         updateAim,          'builds the interaction rows'),
  step('interact',    updateInteract,     'Space selector → g.act'),
  step('aim.track',   trackPlayer),
  step('threat',      threatProximity,    'presentation only'),
  sub ('suppression', 'prePlayer',        'before player + guards read it'),
  step('player',      updatePlayer),
  sub ('launcher',    'projectiles',      'after the shooter, before guards move'),
  step('deal',        dealLongGuns),
  sub ('tactics',     'preAi'), sub('needs', 'preAi'),
  step('guards',      updateGuards),
  sub ('civilians',   'ai',               'after the shift moved/heard, before escalation reads anybody'),
  step('escalation',  updateEscalation), sub('qrf', 'postAi'),
  step('doors',       updateDoors), step('mission', updateMission, 'before targets bake the rack'), step('props', updateProps), sub('destruction', 'physics'),
  step('events.age',  ageEvents), step('targets', updateTargets), sub('devices', 'targets'), sub('weather', 'env'), sub('wet', 'env'),
  step('items',       updateItems), sub('glass', 'items'),
  step('renderSync',  syncCharactersAndBoxes,  'dyn boxes from every boxes() contributor, capsules, skin instances'),
  step('meter',       lightMeterQueries), step('act.clear', clearAct), sub('savestate', 'late', 'the whole settled frame'),
];
// Game.update = for (const s of FRAME) s.run(ctx, dt) — wrapped per step in dev with timing (perfrec gets per-system CPU ms for free) and, in ship builds, quarantine-on-throw.
```

```ts
// game/core/modes.ts — one answer to "is the game live for X"
export type Capability = 'ai' | 'sensing' | 'scoring' | 'logging' | 'needs' | 'civilians' | 'autosave' | 'qrf' | 'chaos' | 'radio' | 'ambient' | 'devices';
export interface ModeStack {
  push(name: 'tour' | 'breach' | 'attract' | 'puppet' | 'daylight' | 'debug', o: { deny: Capability[]; set?: Partial<ModeFlags> }): ModeToken;  // saves what it changes
  pop(t: ModeToken): void;                       // restores exactly — replaces demo/breach/attract's hand-rolled `saved` bags
  can(c: Capability): boolean; whyNot(c: Capability): string | null; readonly active: readonly string[];
}
```

```ts
// engine/render/shaderlib.ts + structs.ts + bindings.ts — minimal, no deps
lib.add('common', commonSrc); lib.add('lighting_common', lightingCommonSrc); …          // still Bun `with { type: 'text' }` imports
lib.module('restir', restirSrc, { includes: ['scene', 'direct_common'], defines: { SHARP: 0 } });
//   WGSL side uses comment directives so files stay valid WGSL for editors:   //#include "lighting_common"    //#if SHARP … //#else … //#endif
//   lib.text('restir') → the exact concatenation of today (asserted byte-identical in step 11); lib.compile(device, 'restir') caches modules;
//   lib.recompile('volumetrics', srcFromDisk) = the ONE hot-swap (line offsets computed once) → hooks __hot(name)
export const Frame = defineStruct('Frame', [ ['viewProj', 'mat4x4f'], …, ['rigCfgB', 'vec4f'] ]);
//   Frame.wgsl (struct text spliced into 'scene'), Frame.BYTES, Frame.offsets, Frame.writer(ab) with typed setters — frame-layout.ts's layout rules ARE the generator; the checker becomes a unit test of it
export const DirectIO = defineBindings(1, { outS: wStorageTex('rgba16float'), outU: wStorageTex('rgba16float'), histA: tex2d('float'), depthHist: tex2d('unfilterable-float'), tiles: rStorage() });
//   DirectIO.wgsl → `@group(1) @binding(0) var outS: texture_storage_2d<rgba16float, write>; …` prepended by lib; DirectIO.layout(device); DirectIO.bind(device, { outS: view, … }) — keys typed, order irrelevant, a missing resource is a compile error
```

```ts
// engine/render/targets.ts — RenderGraph-lite = a target registry, not a scheduler
type Cls = 'internal' | 'output' | 'comp' | 'gather' | 'vol' | 'refl' | 'tile8' | 'froxel';
targets.declare('dH',      { cls: 'internal', format: 'rgba16float', usage: SU, arity: [2, 2], carry: 'linear' });   // [class][parity]
targets.declare('dnHg',    { cls: 'internal', format: 'r32uint',     usage: SU, arity: [2],    carry: 'nearestU' });
targets.declare('refl',    { cls: 'refl',     format: 'rgba16float', usage: SU, when: c => c.rtOn, placeholder: [1, 1], idleReleaseFrames: 600 });
targets.declare('taaHist', { cls: 'output',   format: 'rgba16float', usage: SU, arity: [2], carry: 'linear', when: c => c.taau, onFresh: () => taaReset = true });
targets.configure({ internal: [w, h], output: [ow, oh], comp: sharp ? 'output' : 'internal', divisors: { gather, vol, refl }, cfg });  // → take/drop/blit/clear through texpool generically; lastRealloc/targetBytes derived
const bg = targets.group('restir', RestirIO, t => ({ outS: t.view('dS', cls), … }));   // cached; rebuilt when any named target's version changed (kills dropBindGroups & friends)
parity('direct').flip();   // named parities owned here; resetClocks re-pairs correctly (R2.7)
```

```ts
// content/contentSet.ts — Level/Content loader
export interface ContentSet { id: string; data: LevelData; level: Level; dims: WorldDims; regions: Region[] /* rooms, interior, noPrecip, serverRoom… by kind */;
  spots: Record<'qrf' | 'needs' | 'civilians' | string, Spot[]>; mission: Objective[] /* ordered list, N of each kind */; shows: Record<string, ShowScript>; lines?: LinesPatch; }
export declare function loadContent(ref: { bundled: string } | { url: string } | { local: true }): Promise<ContentSet>;   // validate → typed; ids resolved; the Game still never sees ids
```

```ts
// game/core/input → actions (keeps synthetic input working: scripts press ACTIONS, probes stop hard-coding 'KeyG')
export interface Actions { axis(a: 'move' | 'look'): Vec2; pressed(a: ActionId): boolean; held(a: ActionId): boolean; released(a: ActionId): boolean; synth: { press(a: ActionId): void; hold(a: ActionId, on: boolean): void; click(b: 0|1|2): void } }
// bindings table (KeyW → 'move.fwd', Space → 'interact', digits → 'kit.n') is data; Input.lockExcept becomes modes.push('tour', { denyActions: [...] }).
```

```ts
// tools/qa/harness — QA API
export const p = defineProbe({ name: 'needs-telegraph', families: ['needs', 'ai-pass'], profile: 'calm-office@3',
  async run(t) { const W = await t.standUp({ seed: 4242 }); … t.eq('Kowalski coffee absence s', got, 40); t.digest('lap', frames, { baseline: 'needs-telegraph.lap' }); } });
// run.ts <name|family|all> [--rebaseline] [--profile X]: discovers tools/qa/probes/*.ts, unknown name = exit 2, verdict = exit code + JSON summary (gate.sh becomes `run.ts "$@"`);
// profiles.ts: named feature sets applied through the knob registry (civilians off, chaos 0, needs off …) — a new subsystem declares its identity-off default once, old probes never learn its name.
// soak: invariants = the union of registered subsystems' invariants() + the cross-cutting ones; stimuli likewise registrable.
```

### 2.3 Conventions (the rules a lane follows)

- **Where state may live**: on the Game through `g.sub(id)` / `perActor`; module scope holds only `const` tables that are never mutated at runtime and pure functions. Knob tables that the panel mutates are `defineKnobs` groups (the registry owns the mutable copy, persistence and reset). `X_STATS/X_LOG` become `stats()`/a capped log on the subsystem state. A grep gate (`tools/qa/lint-state.ts`: no `new WeakMap<Game`/`export let`/mutable exported object literals under src/game) keeps it true.
- **A lane adds a feature end‑to‑end by**: creating `game/systems/foo.ts` exporting `defineSubsystem({...})` with its knobs, hooks, save slice, invariants and summary inside; adding **one line** to `game/core/manifest.ts` (sorted) and, if it needs frame time, **one line** per phase to `game/core/frame.ts`; adding `tools/qa/probes/foo.ts`; adding prose to CLAUDE.md's *Systems* section only (the tables regenerate). It touches no other central file. A renderer lane likewise: `engine/render/passes/foo.ts` (declares its targets, bindings, module, knobs with tier columns), one line in the pass order table in `host.ts`, one struct field via `defineStruct` if it needs Frame space (offsets regenerate; frame-layout stays green by construction).
- **Identity culture preserved**: every knob with `offIsIdentity` is listed by `probes identity-contracts`; every migration step below has a byte/hash gate; generated WGSL text is asserted byte‑identical to the previous concatenation before any semantic refactor.
- **Docs**: CLAUDE.md keeps the prose (workflow, taste, systems narratives); `docs/generated/tables.md` (flags, Frame layout, capacities, knobs by group with tier columns, URL flags, hooks, storage keys, probe families) is generated and included by reference; the review‑ledger drift class D5.A/E disappears.

---

## 3. Migration plan (15 steps, each ≤ 1 lane‑day, game shippable + probes green after each)

Legend: **M** = mechanical, safe for an overnight agent with the stated gate; **J** = needs the maintainer's judgment (API shape / taste / risk). "Identity" = the project's own protocol (`?paused`, `__png`/identity hash vs main served beside, or seeded headless digest).

| # | step | kind | gate |
|---:|---|:---:|---|
| 1 | **Tools into the type system.** Replace the 400 `await import(\`${ROOT}/src/x.ts\`)` with static relative imports (Bun resolves them; keep dynamic only where laziness matters, via a typed `lazy(() => import('../../src/x'))`), add `tools/tsconfig.json` (`strict`, `noImplicitAny: false` initially) and run it in `bun run typecheck`. No behaviour change. | M | typecheck (now incl. tools) · gate.sh over every family: PASS/FAIL line counts identical to a pre‑change run captured to a file |
| 2 | **Probe registry + baselines + gate semantics.** `defineProbe` in each `*-probes.ts` (families declared there), probes.ts → `run.ts` discoverer (its 25 inline probes move to `probes/player-*.ts` etc. verbatim), unknown name = exit 2, verdict = exit code + `--json`; pasted digest literals → `tools/qa/baselines/*.json` + `--rebaseline`; introduce `profiles.ts` with `calm-office@3` = exactly what headless.ts/needs/tactics probes pin by hand today. | M | old runner and new runner both in tree for one commit: identical verdict lines per family (diff), then delete the chain |
| 3 | **Hook registry.** `dev/hooks.ts register(name, value | getter, {doc, type})`; main.ts's 61 hook lines and the seven `__hot*` collapse to module‑side registrations (game hooks from `Game`/subsystems, engine hooks from `Engine`); debugHooks.ts `Window` block generated from the registry (checked in). Aliases kept for every existing name. | M | `Object.keys(window).filter(k => k.startsWith('__')).sort()` identical before/after on the game page and the workbench; tour.ts; viewer-ui/viewer-scenes/editor probes |
| 4 | **Knob registry v0 — game side.** `defineKnobs` for `Game.tune` (43) and the persisted subsets of the ~10 module tables (aim, needs, whistle, wet, tactics, qrf, devices, civilians, chaos, ckpt); generated persistence (old storage keys read as aliases once, then rewritten), Tab ▸ Sandbox/Weather rows generated, `__knobs`. Non‑persisted authored tables (RIG, LONG, effects) stay as they are (viewer paste‑back culture). | M→J (row wording) | `*-identity` families (needs, tactics, teams, weapons, civilians, destruction) · new probe `knobs-roundtrip` (defaults → persist → reload → equal; reset restores defaults) · panel row count per section unchanged |
| 5 | **Knob registry v1 — render side + tiers as columns + generated tables.** RenderSettings becomes the registry's typed view; each feature file (taau, restir, denoise, froxel, rt, p5, iq, rig, caps, lossy) declares its knobs with `tier` columns; `PRESETS` reduces to the genuinely per‑tier scalars (maxH, scale, rc grid, ds, volSteps); URL parsing once (`parseUrl`), the six force/veto singletons become `registry.pin(key, value, 'url')`; FrameFlags assembled from flag entries; `tools/gen-tables.ts` writes `docs/generated/tables.md` and CLAUDE.md links it. | J | new probe `quality-apply-identity`: for each of the 5 tiers `JSON.stringify(sorted settings)` after `apply()` equals the file captured from main · `quality-plan.ts` output identical · frame-layout · `__png` identity at high and medium (`?paused`) · every URL flag in the old list still flips the same setting (scripted table) |
| 6 | **Frame phase table.** `game/core/frame.ts` literal (order copied verbatim from game.ts:975–1090, inline blocks such as threat proximity / carbine deal / renderSync become named functions in their natural modules); `Game.update` = the loop with per‑step dev timing into perfrec. Zero reordering. | M | seeded headless digest of 3 × 3‑minute soaks (seeds 1,2,3) byte‑identical before/after · `checkpoint-identity` · the 13-stop tour green (`tour.ts --runs 3`; the old fixtures/tour-seed4242.log was deleted 08-12 — unreferenced and drifted; the journal fixtures under tools/qa/sessions/ are the byte-identity gate now) |
| 7 | **Subsystem storage + lifecycle + ModeStack.** `g.sub(id)`/`perActor` replace the 44 Weak tables and 5 module `let`s (one module per commit, mechanical); `manifest.ts`; `restartEncounter/clearAftermath/resetLevelState/saveState/loadState` iterate the manifest (existing bespoke functions become the subsystem's methods unchanged); `X_STATS/LOG` onto state with the old export names kept as getters for the probes; `ModeStack` introduced with `can()/whyNot()` implemented *in terms of* today's flags first (so behaviour is identical), then demo/breach/attract switch to push/pop. | M (storage) → J (ModeStack caps) | after each module: its probe family + `checkpoints` family + soak `--seeds 1,2,3 --minutes 12` (leak invariants) + the identity digests of step 6 · after ModeStack: `standoff-tour`, `breach`, `needs-interrupts` (tour lap), attract probe, tour hitFlash = 0 |
| 8 | **EngineHost boundary + layering lint + Game ctor out of the composition root.** Write `EngineHost`/`CameraView`/`Capacities`; `Engine implements EngineHost`; headless.ts's stand‑in becomes `class HeadlessHost implements EngineHost` (type errors now tell you when the harness drifts); main.ts/workbench construct render attachments and hand them to `attach()`; `render/particles` takes sheet constants by injection (sheetModel moves beside particles as the shader's CPU reference); `WeatherFrame.interior/annex` → `env.noPrecip: Aabb[]` (N ≤ 4 in SceneInfo; office passes its two); `debrisCap/hitFlash/nvAmount` → game knobs / `look`; `tools/qa/lint-layers.ts` (import‑graph rules: engine ↛ game/content/shell, content ↛ game values, no `new WeakMap<Game` in game/) added to `typecheck`. Also make `new Game` a staged `Game.create()` that yields between the heavy builders (removes the 0.3–0.5 s long task without workers). | J | typecheck + lint · `__png` identity at high (`?paused`, weather on and off — the noPrecip path must hash equal) · `weather` family · tour/soak · boot line: no long task > 100 ms in `__boot` |
| 9 | **Directory move** to `engine/ game/{core,actors,systems,shows,ui} content/ shell/` with `git mv` + scripted import rewrite; guards.ts split along its own `// ----` section seams into `game/actors/guards/*.ts` (perception, state machine, search/darkness, standoff, threshold discipline, escalation+rollcall, units/engage) — pure cut/paste, `guards.ts` re‑exports everything for one release so tools and lanes in flight keep compiling; CLAUDE.md architecture map regenerated from the tree. Do it at a quiet moment (announce; lanes rebase with the rewrite script). | M (timing = J) | typecheck+lint · build · shader text unchanged ⇒ identity hash at high · full gate.sh · soak |
| 10 | **Struct codegen.** `defineStruct` (generator = frame-layout.ts's rules) for `Frame` first: emits the WGSL struct text spliced into the scene prelude and the TS writer; `writeFrame`'s hand offsets deleted; then `Light`, `SceneInfo`, `RestirU`, `DnParams`, `TaauParams`, `CharInst`, `Particle` one per commit. | J (API) → M (each struct) | per struct: generated WGSL text diff‑equal to the hand‑written struct (whitespace‑normalised) · frame-layout · `__png` identity per tier vs main served beside (the standard cross‑build protocol) · restir-bench identity for RestirU |
| 11 | **Shader lib + include/define preprocessor + generic hot‑swap; `defineBindings` pilot** on direct/restir, composite (both variants) and taau. First commit: preprocessor produces text **byte‑identical** to today's concatenations for all ~30 modules (asserted by a tools test that compares `lib.text(name)` with the legacy expression); second: `_common` files become `//#include`s and `const SHARP` a define; third: the three pilot passes' layouts/bind groups from `defineBindings` (generated `@group(1)` declarations replace the hand‑written ones — text changes, so identity is proven by pixels). Optional fourth: prelude trimming per module (code‑health A2) for cold‑compile time, byte‑identity of *pixels* required. | J | text‑identity test · every pipeline compiles (boot with 0 GPU errors in `__boot`) · `__png` identity per tier · `__hot('volumetrics')` etc. still work (p3/p4 harness smoke) · cold boot time not worse |
| 12 | **TargetSet.** Declare passes.ts/gbuffer/froxels targets; `resize()` and the 8 realloc functions become `targets.configure()`; named parities; bind‑group cache keyed by target versions; idle‑release generic (fixes R1.1/R1.3/R2.7 as a side effect). | J | scripted ladder (`__stress` resize sequence + preset hops + taau/sharp/gbaa/rt/gi toggles): `passes.lastRealloc` created/reused/resampled/cleared counts and `targetBytes()` identical to main at every step · p0b history‑resample probe · `__png` identity after the sequence · v3-gate stress minute p95 within noise |
| 13 | **Level‑format II (a): regions + spots + surfaces wired.** `regions[]` {id, kind: room|building|interior|noPrecip|serverRoom|…, rect/aabb, floor} and `spots{ qrf, needs, civilians }` blocks in LevelData (KEYS + validator + both directions + officeGen emits today's constants); chronicle/floor/weather/qrf/needs/civilians/dialogue read `g.level`; floor.ts reads `surfaces`; group‑name conventions in game.ts:690–776 become explicit fields (`switchable.role: 'rackLeds'|'beaconDome'|'emergency'`, `light.role`). | M (plumbing) + J (schema names) | `level` family (identity: export not stale, validate, round trip) · qrf/needs/civilians/weather/debrief/dialogue families · tour fixture log identical · `level-lint` on office + approach.json |
| 14 | **Runtime WorldDims + Capacities.** `meta.bounds/grid` read from the chosen content *before* `engine.init()` (bundled JSON parse is ms; `?levelFile` fetch moves ahead of init); `wgslWorldConsts(dims)`; BoxWorld/collision/reach/rc/decals/smoke/wear sized from `caps.dims`; capacities table replaces the scattered MAX_*; pipeline cache keyed by dims (a level of another size recompiles — acceptable, async). | J | office: identity hash at high + full gate · approach.json (56×40 or whatever it declares) boots with 0 GPU errors, `probes level-lint`, a 3‑minute soak on it · cold boot within +100 ms |
| 15 | **Mission as an objective list + shows as content.** mission.ts generalised to N ordered objectives of the existing kinds (+ `read`/`reachSpot` when the second space needs them) with the debrief/room logic reading regions; demo/breach/attract choreography (`Shot[]`, vantages, beats' coordinates and captions) serialised to `content/shows/*.json` with the runners unchanged (functions referenced by name from a small registry: `enter: 'rearm'`, `tick: 'throwAt'`). | J (taste: what stays code) | `debrief` family · `breach` family (order, doctrine timings, restore) · tour: 13 stops, 0 errors, hitFlash 0, fixture log identical · attract probe |

Backlog after the month (not sized here): Actions layer for input; per‑subsystem quarantine policy in ship builds; worker offload of level builders and A*; character.ts split (animator/layers/ragdoll drive) once the anim lanes are quiet; editor `any` cleanup; deleting the legacy off‑paths once the reference instruments are redefined on v3 (already in STATUS).

---

## 4. Do NOT do

- **No general render graph** (automatic pass scheduling, transient‑resource aliasing, barrier inference). WebGPU validates hazards, the pass list is ~25 and linear, and the team's leverage is *knowing* what ran; extract targets/bindings/structs, keep `encode()` an explicit sequence.
- **No ECS / component soup for actors.** ≤ 10 characters, deeply bespoke behaviour, determinism by construction; an ECS would shred guards.ts's readable state machines and the seeded‑digest culture for zero perf gain. Subsystems + a typed roster is the ceiling.
- **No DI container / interface‑per‑class conversion of "plain functions taking the Game".** Keep functions; narrow the parameter to `GameCtx` opportunistically. The pattern is good; the *width* of `Game` is the problem.
- **No implicit ordering.** Do not derive frame order from `after:` constraints/topological sorts, and do not let subsystems self‑register into phases; the literal table is the contract and the review surface.
- **No shader framework / npm dependency** (wgsl linkers, naga‑in‑wasm bundlers, TypeGPU‑style DSLs). A ~60‑line comment‑directive preprocessor + two small codegens fit the "no deps" rule and keep files valid WGSL for `__wgsl` and editors.
- **Never change shader text and shader structure in the same commit.** Metal's compiler is demonstrably sensitive to program size/shape (reflect vs reflect_p5 last‑bit note in CLAUDE.md); step 11's first commit must reproduce today's bytes exactly, and every later text change is proven by pixels per tier.
- **Do not break the off‑path identities while refactoring config.** `?norestir/?notaau/?legacydenoise/?nofroxel/?nosharp/?noiq/?nop5/?nortreflect&detail=0/?nomarkings&level=relief` are the instruments' references; the registry must reproduce each flag's exact settings write (step 5's URL table gate) until the maintainer signs off the legacy deletion.
- **Do not rename hooks, URL flags, storage keys or probe family names without aliases** — background agents, docs pages and the maintainer's muscle memory depend on them; aliases are free in a registry.
- **Do not split guards.ts/character.ts/dialogue.ts by line count or while a lane has them open.** Split only along the existing section seams, cut/paste only, with a re‑export shim, at an announced quiet point (step 9).
- **Do not move gameplay to workers pre‑emptively.** CPU update is ~1 ms median; the light meter is already 1–2 frames of GPU latency and the one‑model rule makes added latency a design change, not an optimisation. Builders first, A* maybe, perception never.
- **Do not replace the headless whole‑game probes with unit tests.** Add unit tests only for pure kernels that now get an API (levelData validation, knob registry, struct codegen, preprocessor, sheet/aim models); the whole‑game harness stays the primary gate.
- **Do not auto‑generate CLAUDE.md's prose** or let agents rewrite it wholesale; generate the tables, hand‑write the narrative, keep the file under ~40 KB by moving system narratives next to their code (`game/systems/needs.md`) and linking.
- **Do not chase `any` in tools to zero.** Type the imports (step 1) and the harness API; probe bodies poking privates through `any` are a feature of a QA harness, not a debt.
- **Do not introduce a second level by forking tables** ("if level === 'approach'") anywhere in game/ — every such branch is a permanent tax; steps 13–15 exist so the second space lands as content only.

Relevant paths for the lead: `src/game/game.ts`, `src/engine.ts`, `src/render/passes.ts`, `src/render/frame.ts`, `src/ui/quality.ts`, `src/ui/bindings.ts`, `src/main.ts`, `src/scene/world.ts`, `tools/qa/probes.ts`, `tools/qa/headless.ts`, `tools/qa/frame-layout.ts`, `docs/internal/review-ledger.md`.
