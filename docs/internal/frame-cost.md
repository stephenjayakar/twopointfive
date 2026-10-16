# Where a frame's time goes, mission by mission

Measured 2026-10-08 on the one build, `everything-one-build-f6mcwz`. The headline tables are that build at `a7ce1d6`, with the cast, the motion pass, the turn weight, the glass parts and the defenders' frags on, as its page opened. **The build to play has since moved to `dee9595`, which adds destruction, on as the page opens.** That build is measured in its own section, "The build to play now", with destruction on and off side by side; it costs the same per frame and adds one hitch to the list: the frame a wall is blown. The tool is on `frame-cost-measured` @ `f9fade6` (`tools/qa/framecost*.ts`); no file under `src/` is changed.

Every number here carries one of three marks:

- **M** measured: timed on this cloud box (4 × Xeon 2.1 GHz, no graphics card), under bun unless the table says V8.
- **C** counted: read off a recording stand-in for the graphics card. It is exact as a count and it is **not a time**.
- **I** inferred: my reading of the two above. Each one says what it rests on.

**There is no GPU here.** Nothing on this page is GPU time. No software adapter was run either, so there are no "relative" GPU timings to mistrust. The GPU half is an inventory: which passes run, how much work each asks for, what the CPU rewrites for them.

### Which build, which switches

Every section says in its first line which of these it ran. All under bun unless the section says V8.

| name on this page | commit | switches |
|---|---|---|
| a7ce1d6 shipped | `a7ce1d6` | `TPS_CAST=1 TPS_MOVES=1 TPS_TURN=1 GLASSFX=on`, `--set '{"FRAG":{"defenders":true}}'`. Destruction is not in this build |
| dee9595 shipped | `dee9595` | the same, plus `PT_DESTR=1`: destruction on, as that page opens |
| dee9595 no destruction | `dee9595` | the same without `PT_DESTR`: that page under `?nodestruction` |
| harness | `a7ce1d6` or `25e5e7c` | none of them: the QA harness as it stands |

`PT_DIGEST=1` is set on every run. The merge thread's own as-you-play-it line is "dee9595 shipped" without `TPS_CAST`; the tool sets it because the page draws the cast. The picks (weather, hour, extra enemies, pair) are named where they are used.

## In short

- **The CPU frame as shipped costs 1.6 to 3.9 ms on average and 4.7 to 10.0 ms at p99 on this box (M).** The solo night is the lightest (1.59 mean, 4.69 p99). The big squad maps are the heaviest: barracks-four 3.90 mean, compound-four 3.80, room-clear-four 3.75; block-squads has the worst p99 at 9.96.
- **No mission meets the 4 ms p99 yardstick (M).** Every one meets it at the median (1.4 to 3.5 ms).
- **Three things are two thirds of the average frame (M):** animating the characters (1.01 ms, 32 %), line-of-sight tests against the level (0.59 ms, 19 %; just over half of them asked by the fog of war), and re-packing the whole box list every frame (0.46 ms, 15 %).
- **Under V8, the engine the page runs on, garbage costs 3 to 7 % of frame time, and less on a newer V8 (M).** A run allocates 1.0 to 3.7 MB a frame under node 22 (V8 12.4) and 0.9 to 3.1 MB under node 24 (V8 13.6, nearer the browser's); about a tenth is a headless-only stand-in (**I**). Under node 22 the collector is 6 to 7 % of frame time and sits inside 40 % of the frames over 8 ms; under node 24 it is 2.6 to 4.3 % and 24 %. `Math.hypot` leaves less garbage on newer V8s (23 bytes a call in Chromium 141 against 59 under node 22), not none.
- **The build to play now, dee9595 with destruction on, costs the same per frame (M).** Pooled mean 3.20 ms against 3.19 ms with destruction off, and off it plays a7ce1d6's games exactly (36 of 36 digests). Destruction's own column is 0.01 to 0.03 ms a frame. What it adds is a hitch when a wall opens: in the depot and The block the frame a charge blows is 34 to 64 ms, and 10 to 14.5 ms of that is one call that re-decides which floor each light reaches (up to 17 ms in a frame elsewhere).
- **The frames that would be seen as hitches are few and have names (M):** a rig fit of 13 to 44 ms the first time each cast outfit appears, path-finding bursts of 11 to 40 ms at fixed moments in the big maps, a few line-test bursts of 11 to 40 ms, and 216 to 347 ms in the first frames after a mission stands up.
- **Everything on costs little except through head count (M).** A downpour and dusk do not grow the weather's own column; the frame total moved by −6 to +12 %, which this box cannot tell from the spread between sittings. Six more defenders add 1.1 to 1.8 ms to the mean and 2.8 to 3.9 ms to the p99.
- **The night's features cost little on the CPU (M).** The motion pass with the turn weight adds 3 to 13 µs a character a frame (0.03 to 0.19 ms a frame). The cast adds 0.02 to 0.04 ms and brings the rig-fit hitches. Glass parts and the defenders' frags are under 0.01 ms. At 25e5e7c, and at a7ce1d6 with those features off, the game plays the same runs at the same cost (2.82 and 2.86 ms pooled); as shipped it is 3.16 ms.
- **GPU side, counted (C):** about 22 M compute-shader threads a frame at high in a 1728 × 1000 window, 21 compute and 5 render passes, 180 KB of buffers rewritten. The shadow denoiser (`softblur`) is 24 % of the threads, and five passes at output size plus bloom are another 48 %. A smoke domain costs about 2.1 M threads a frame, and a frame with eight of them asked for 34 M, more than everything else together.
- **The cast is the triangle count (C):** a cast character is 27,164 triangles against the mannequin's 13,743, so the g-buffer draws about twice the triangles (176 k against 96 k a frame with six characters up) and the mesh-shadow pass skins twice as much.

## The ten heaviest costs, ranked (and one more on the build to play)

Ranked by what they do to a frame on this box. 1 to 7 are steady costs (mean ms a frame, **M**); 8 to 11 are hitches (single frames, **M**; what causes each is **I** where marked). The tables behind each row are further down. GPU work is ranked apart below, because a count cannot be put on the same scale as a time.

| # | cost | size on this box | where it lives | mark |
|---:|---|---|---|---|
| 1 | Animating characters: clips sampled and blended, the skeleton, IK | 1.01 ms mean, 32 % of the frame; p99 1.2 to 4.0 ms; 73 to 131 µs a character a frame | `src/game/character.ts:2619` `Character.update` (the call timed) → `:936` `CharacterAnimator.update`; `src/anim/skeleton.ts:25` `sampleClip`, `:53` `blendPose`, `:94` `SkeletonInstance.update`, `:173` / `:192` `PoseFK.run` / `runFrom` (the forward kinematics the two-bone IK calls) | M |
| 2 | Line tests against the level's boxes | 0.59 ms mean, 19 %; p99 up to 3.8 ms (barracks-four); 34 to 265 outermost calls a frame in the squad missions at 3 to 7 µs each (172 to 732 counting the nested ones) | `src/scene/collision.ts:148` `segmentBlocked`, `:10` `lineBox`; against moving boxes `segmentBlockedDynamic` → `src/scene/boxes.ts` `rayBox`. 52 % asked by the fog of war: `src/game/fogofwar.ts:130` `FogOfWar.update`, its sight lines in the helpers at `:244` to `:263` | M |
| 3 | The box list packed and the trace grid rebuilt, every frame | 0.46 ms mean, 15 %; a pack is 0.46 to 0.69 ms in the 782-box office and 0.29 to 0.49 on the other maps | `src/scene/boxes.ts:369` `BoxWorld.upload`, called by `Engine.render` | M |
| 4 | The engine's CPU half of a frame | 0.25 to 0.40 ms, a floor | `src/engine.ts:343` `render`: `src/render/lights.ts:129` `upload` + `glassLightMasks` (engine.ts), frame uniforms + probe + submit, `src/render/passes.ts` `encode` | M |
| 5 | Guards: senses, state, feet | 0.17 ms mean; p99 0.8 | `src/game/guards.ts:1837` `updateGuard`, `:1156` `eyeContact` | M |
| 6 | Building the frame's moving boxes (door leaves, props, everything bolted to a man) | 0.17 ms mean; 140 to 390 boxes a frame | `src/game/game.ts:1227` on; `src/game/rigProps.ts:284` `seg`, `:265` `applyAdj` | M |
| 7 | Garbage: 0.9 to 3.7 MB allocated a frame | collector time 0.04 to 0.16 ms a frame under V8 13.6 (2.6 to 4.3 % of frame time; in 24 % of frames over 8 ms) and 0.12 to 0.39 ms under V8 12.4 (6 to 7 %; in 40 %). Which the browser is nearer to is **I**: the newer | by bytes: see "Who allocates" | M |
| 8 | Hitch: the rig fit for each new cast outfit | 13 to 44 ms in one frame (64 once), a few times a run | `src/game/game.ts:1270` → `fitRig` in `src/render/sdfrig.ts` | M, cause I |
| 9 | Hitch: path-finding bursts on the big maps | 11 to 40 ms inside frames of 20 to 63 ms, at fixed moments 11 to 39 s in | `NavGrid.findPath` (`src/scene/collision.ts`), asked by the room clear's planning | M, cause I |
| 10 | Hitch: the first frames after a mission stands up | 216 to 347 ms once | first run of every path through `Game.update` | M, cause I |
| 11 | Hitch, dee9595 with destruction on: the frame a wall is blown | 34 to 64 ms in that frame in the depot and The block; 10 to 14.5 ms of it is destruction's own bucket, which timed apart is one call (10.0 and 11.5 ms); that bucket reaches 17 ms in a frame elsewhere | `src/game/game.ts:625` `Game.reachTick` (the lights' reach masks re-decided after a wall changes), then the reactions' line tests | M; why the call overruns its budget is I |

Next in line (**M**, mean ms): the player 0.09, characters → skin instances 0.085, doors 0.07, the room fight 0.07, the box world's raycast 0.06, squad orders 0.05, the fog of war's own work 0.04 (its line tests are in row 2), weather's game half 0.04. Destruction, glass and gear are each 0.02 or less on average; with destruction switched on in the build to play, its column is 0.01 to 0.03 (see "The build to play now").

Garbage was row 4 in this page's first version, on node 22's numbers alone. On the newer V8 it is about half that, so it now sits at 7.

### The GPU side, ranked by counted work (C; the order as a cost is I)

| # | what | counted | where | mark |
|---:|---|---|---|---|
| 1 | The shadow denoiser, five kernels at internal size | 5.2 M threads a frame, 24 % | `src/render/shaders/denoise.wgsl` (pack, temporal, three à-trous), `src/render/denoise.ts` | C |
| 2 | Five passes at output size (1728 × 1000), and bloom | 1.73 M each when it runs: sharp direct, composite, GBAA, the resolve, the fog of war; bloom is 2.0 M over its chain; 48 % together | `sharp_direct.wgsl`, `composite.wgsl`, `gbaa.wgsl`, `taau.wgsl`, `src/render/fogofwar.ts`; bloom | C |
| 3 | The smoke solver, while smoke or dust is up | 2.1 M a live domain a frame (4.0 M on a frame it steps); 14 to 34 M in the busiest frame | `src/smoke/smoke.wgsl` (the pressure solve's red and black sweeps are 52 % of it) | C |
| 4 | Direct light, reflections and their denoiser | direct 1.04 M and reflections 0.26 M (rays); the reflection denoiser 1.05 M (texture reads) | `restir.wgsl`, `reflect.wgsl`, `denoise.wgsl` | C |
| 5 | Character triangles | 150 to 344 k a frame, up to 456 k | `src/render/gbuffer.ts`, the cast's mesh | C |

Rows 1 and 2 and the reflection denoiser are cheap threads (texture reads). The smoke solver, direct light and reflections are dear ones (a pressure solve; rays through the scene). On a real GPU the order may well turn over: that is why this is **I** as a ranking.

## The yardstick, and whose it is

The yardstick is the performance thread's, **not the maintainer's**: 60 fps on his Mac means 16.6 ms for everything, and the CPU step should sit under about 4 ms at p99 on this 4-core box.

Against it, as shipped (M, this box, bun): the mean frame is 1.6 to 3.9 ms; p95 is 2.3 to 6.3 ms; p99 is 4.7 to 10.0 ms. With the engine's own CPU half added (`--gpu`) the mean is 2.1 to 4.0 ms and p99 5.9 to 10.4 ms. Under V8 (one seed, and each frame short of three quarters of a box pack: see that section) the mean is 2.1 to 6.2 ms and p99 6.2 to 19.4 ms under node 22, and 170 of 54,390 frames (0.3 %) ran past 16.6 ms on the CPU alone; under node 24 the same runs read 1.7 to 5.8 ms, 4.8 to 15.3 ms, and 72 frames (0.13 %).

How that maps to his Mac is **I**, not measured: his cores are faster than this box's, by an amount nobody has measured for this code. So the 4 ms p99 line is a guard on this box, and the shape (what is big, what spikes) is what carries over.

## How to run it again

```
bun run tools/qa/framecost.ts                       # all 13 missions as shipped, seed 1, the tables below
bun run tools/qa/framecost.ts --seeds 1-3 --verify  # three seeds, and every run replayed without the tool: digests must agree
bun run tools/qa/framecost.ts --json before.json    # ...change something...  --json after.json
bun run tools/qa/framecost.ts --compare before.json after.json
bun run tools/qa/framecost.ts --gpu                 # the real engine on the recording device: the CPU frame as the page runs it + the GPU inventory
bun run tools/qa/framecost.ts --v8 [--hot|--alloc]  # the same runs under node (V8): frames, collector pauses, who burns time, who allocates
bun run tools/qa/framecost.ts --arms everything     # also: downpour, dusk, cap, pair, harness, nocast, nomoves, noglass, nofrags, nodestr
PT_WALL=1 bun run tools/qa/framecost.ts             # any PT_ switch of the play-through passes through: here, rooms taken by wall charge
```

"Shipped" raises destruction (`PT_DESTR=1`) on a build that has it, as the page does; `--arms nodestr` is the page under `?nodestruction`. On a build from before destruction the switch does nothing.

The takes behind this page are on the tool's branch: `docs/perf/framecost-a7ce1d6-shipped.json` (the headline, three seeds), `-shipped-take2.json`, `-gpu.json`, `-v8.json`, `-features-off.json`, `framecost-25e5e7c.json`, and for the build to play `framecost-dee9595-shipped.json`, `-nodestruction.json`, `-wallcharge.json`, `-wallcharge-reach.json` and `-wallcharge-reach-office.json`, `-gpu.json`, `-gpu-nodestruction.json`; the node 24 collector take is `framecost-a7ce1d6-v8-node24.json` (allocation profile: `-node24-alloc.json`). Take your own "before" in the same sitting as your "after" rather than comparing against these (see the noise section).

For a before and after that must hold a digest, use the plain mode (no `--gpu`, no `--v8`): `--verify` replays each run without the tool and compares the play-through's digest. On the second take, the one `--verify` ran on, all 36 play-throughs had the same digest with and without the tool (**M**); the three solo soaks have no digest to compare. Keep `--jobs 1` (the default) and nothing else running: four jobs at once read 29 to 51 % high on the mean and more than double the p99 (**M**).

**What the tool changes, exactly.** Nothing on disk. As files load it rewrites them in memory:

- `src/game/game.ts`: 45 timing marks (three are new for destruction and find nothing before dee9595) in front of line heads inside `Game.update`. They only read a clock.
- `tools/qa/headless.ts`: `W.step` is bracketed (begin, camera, lights, upload, end).
- `src/game/guards.ts` (three places: lines 302, 822, 2352) and `src/game/civilians.ts:561`: the CPU light estimate that stands in for the GPU light probe is wrapped so its time can be taken out (see "One headless-only cost").
- Only under `--gpu`: the harness's stand-in engine and smoke lines in `tools/qa/headless.ts` are swapped for the real `Engine` and `SmokeSystem` on the recording device, and `src/engine.ts` reads the window's pixel ratio from the tool instead of `window`.
- Only under `--v8`: node has no TypeScript loader, so the tool's own loader transpiles every file and rewrites `import.meta`.
- The wall engine's two entry points (`WallBreak.round`, `.blast`) and `Game.reachTick` are wrapped like the other services, on a build that has them.
- Destruction's one switch is raised when the arm says so (`PT_DESTR=1`), as `src/main.ts` raises it on the page.
- It also raises `settings.charMats` when the mesh is the cast, as `src/main.ts` does on the page. Digests stay equal with it.

## What a "frame" is here

The plain mode times the harness's step: `Game.update`, the camera, the light set, and the box list packed with its trace grid. The play-through packs the box list every fourth frame and the page every frame, so the tables give the frame **at the page's cadence**: a frame that did not pack is given the run's mean pack. The first 60 frames of each run are left out and reported apart.

`--gpu` runs the page's own order on the real `Engine`: update, smoke solver, camera, lights, `Engine.render` (which packs the box list itself, every frame). That adds the engine's CPU half. Audio and the HUD are in neither.

### One headless-only cost, kept out of every total

Where the GPU light probe has not answered, four meters fall back to a CPU estimate (`guards.ts:2310 lightEstimateAt`: every light times a line test). Headless the probe never answers, so the estimate runs every frame for every man who is not shift staff (the squad, the defenders, spawned units; the solo night's guards make almost no calls): 0.04 to 0.83 ms a frame on average and up to 2.1 ms at p99 (**M**). On the page the GPU answers within a frame or two, so this code should not run there (**I**: read from the code, the fallback is taken only while the probe has no answer). The tool times it apart as "(probe stand-in)" and leaves its time out of every frame total on this page. Its garbage cannot be taken out the same way: the V8 allocation and collector numbers include it, and that section says so. Any headless frame number taken without this tool includes it.

## The frame as shipped, mission by mission (M)

*Build: a7ce1d6 shipped.* Three seeds a mission (the solo night is three two-minute soaks), ms a frame. "One box upload" is the mean cost of one pack; it is inside the frame columns.

| mission | frames | mean | p50 | p95 | p99 | max | update mean | update p99 | one box upload | (stand-in, left out) | p99 under 4 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| solo-night | 21420 | 1.59 | 1.44 | 2.32 | 4.69 | 148.72 | 1.14 | 3.54 | 0.46 | 0.04 | NO |
| night-breach | 3906 | 2.65 | 2.38 | 3.93 | 7.01 | 17.99 | 2.05 | 6.37 | 0.59 | 0.51 | NO |
| room-clear-pair | 9968 | 3.04 | 2.86 | 4.26 | 7.18 | 27.47 | 2.40 | 6.50 | 0.63 | 0.56 | NO |
| room-clear-four | 9104 | 3.75 | 3.53 | 5.27 | 8.24 | 24.26 | 3.06 | 7.52 | 0.69 | 0.83 | NO |
| hostage-rescue | 7129 | 2.71 | 2.46 | 4.31 | 7.69 | 25.95 | 2.08 | 6.83 | 0.62 | 0.25 | NO |
| records-pair | 9933 | 2.42 | 2.23 | 3.66 | 6.46 | 31.80 | 2.13 | 6.15 | 0.29 | 0.41 | NO |
| depot-four | 8561 | 2.68 | 2.44 | 4.14 | 7.39 | 37.72 | 2.37 | 7.00 | 0.30 | 0.31 | NO |
| block-four | 10686 | 3.29 | 3.07 | 5.20 | 8.51 | 22.94 | 2.90 | 8.06 | 0.39 | 0.36 | NO |
| block-squads | 10717 | 3.59 | 3.12 | 6.07 | 9.96 | 54.97 | 3.15 | 9.48 | 0.43 | 0.45 | NO |
| warehouse-four | 23981 | 3.46 | 3.29 | 5.22 | 7.75 | 60.94 | 3.04 | 7.27 | 0.42 | 0.68 | NO |
| compound-four | 18856 | 3.80 | 3.40 | 6.13 | 8.95 | 54.81 | 3.32 | 8.38 | 0.48 | 0.64 | NO |
| barracks-four | 35784 | 3.90 | 3.52 | 6.32 | 8.78 | 45.04 | 3.41 | 8.20 | 0.49 | 0.62 | NO |
| rescue-registry | 6882 | 2.37 | 2.19 | 3.61 | 7.26 | 33.21 | 2.01 | 6.85 | 0.36 | 0.16 | NO |

Pooled over all 176,927 frames the mean is 3.16 ms. "Update" is `Game.update` alone. The max column is one frame; see "Worst single frames" for what each was.

### Split by system, mean ms a frame (M)

A service's time (animation, line tests, paths, sound) is taken out of the system that called it and shown in its own column.

| mission | animation | line tests | guards AI | squad | room fight | dyn boxes | box upload | chars to GPU | player | feet vs walls | doors, props | nav paths | sound | tactics | destruction | glass | gear | weather | fog of war | other |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| solo-night | 0.46 | 0.12 | 0.13 | 0.01 | 0.00 | 0.10 | 0.45 | 0.06 | 0.08 | 0.01 | 0.06 | 0.01 | 0.00 | 0.01 | 0.00 | 0.00 | 0.01 | 0.04 | 0.00 | 0.05 |
| night-breach | 0.79 | 0.24 | 0.17 | 0.15 | 0.06 | 0.21 | 0.59 | 0.06 | 0.10 | 0.01 | 0.08 | 0.00 | 0.01 | 0.01 | 0.01 | 0.01 | 0.02 | 0.05 | 0.00 | 0.07 |
| room-clear-pair | 0.89 | 0.49 | 0.20 | 0.12 | 0.06 | 0.17 | 0.63 | 0.07 | 0.10 | 0.01 | 0.09 | 0.01 | 0.02 | 0.01 | 0.00 | 0.00 | 0.01 | 0.05 | 0.04 | 0.06 |
| room-clear-four | 1.12 | 0.75 | 0.24 | 0.14 | 0.08 | 0.21 | 0.69 | 0.08 | 0.10 | 0.02 | 0.09 | 0.01 | 0.02 | 0.01 | 0.01 | 0.00 | 0.02 | 0.05 | 0.05 | 0.07 |
| hostage-rescue | 0.68 | 0.44 | 0.14 | 0.13 | 0.05 | 0.16 | 0.62 | 0.07 | 0.10 | 0.02 | 0.09 | 0.00 | 0.01 | 0.01 | 0.00 | 0.01 | 0.02 | 0.05 | 0.04 | 0.07 |
| records-pair | 0.86 | 0.33 | 0.18 | 0.11 | 0.06 | 0.15 | 0.29 | 0.08 | 0.09 | 0.01 | 0.07 | 0.00 | 0.01 | 0.01 | 0.00 | 0.01 | 0.02 | 0.04 | 0.04 | 0.05 |
| depot-four | 1.00 | 0.40 | 0.20 | 0.12 | 0.07 | 0.18 | 0.30 | 0.08 | 0.09 | 0.01 | 0.06 | 0.01 | 0.01 | 0.01 | 0.01 | 0.00 | 0.02 | 0.04 | 0.04 | 0.05 |
| block-four | 1.15 | 0.58 | 0.24 | 0.12 | 0.08 | 0.20 | 0.38 | 0.10 | 0.09 | 0.01 | 0.10 | 0.01 | 0.04 | 0.01 | 0.01 | 0.00 | 0.02 | 0.04 | 0.06 | 0.05 |
| block-squads | 1.21 | 0.70 | 0.26 | 0.14 | 0.11 | 0.19 | 0.43 | 0.11 | 0.09 | 0.01 | 0.09 | 0.02 | 0.04 | 0.01 | 0.00 | 0.00 | 0.02 | 0.04 | 0.06 | 0.05 |
| warehouse-four | 1.16 | 0.78 | 0.21 | 0.12 | 0.09 | 0.19 | 0.42 | 0.09 | 0.08 | 0.01 | 0.11 | 0.01 | 0.02 | 0.01 | 0.00 | 0.00 | 0.01 | 0.04 | 0.05 | 0.04 |
| compound-four | 1.28 | 0.82 | 0.25 | 0.13 | 0.10 | 0.19 | 0.48 | 0.10 | 0.09 | 0.02 | 0.12 | 0.01 | 0.04 | 0.01 | 0.00 | 0.00 | 0.02 | 0.04 | 0.05 | 0.05 |
| barracks-four | 1.18 | 1.11 | 0.21 | 0.12 | 0.09 | 0.20 | 0.49 | 0.09 | 0.09 | 0.01 | 0.13 | 0.01 | 0.03 | 0.01 | 0.00 | 0.00 | 0.01 | 0.03 | 0.06 | 0.04 |
| rescue-registry | 0.82 | 0.23 | 0.17 | 0.16 | 0.05 | 0.15 | 0.36 | 0.09 | 0.10 | 0.01 | 0.07 | 0.00 | 0.01 | 0.01 | 0.01 | 0.01 | 0.02 | 0.02 | 0.05 | 0.04 |

### The same split at its worst: p99 of each column (M)

Not additive: each column's own bad frames.

| mission | animation | line tests | guards AI | squad | room fight | dyn boxes | box upload | chars to GPU | player | feet vs walls | doors, props | nav paths | sound | tactics | destruction | glass | gear | weather | fog of war | other |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| solo-night | 1.18 | 0.25 | 0.47 | 0.05 | 0.00 | 0.20 | 1.01 | 0.11 | 0.18 | 0.05 | 0.17 | 0.04 | 0.08 | 0.04 | 0.00 | 0.01 | 0.03 | 0.09 | 0.00 | 0.13 |
| night-breach | 3.09 | 1.16 | 0.44 | 0.65 | 0.22 | 0.46 | 0.89 | 0.12 | 0.21 | 0.05 | 0.22 | 0.05 | 0.31 | 0.05 | 0.05 | 0.04 | 0.13 | 0.13 | 0.01 | 0.17 |
| room-clear-pair | 1.90 | 1.49 | 0.60 | 0.45 | 0.18 | 0.31 | 0.94 | 0.11 | 0.19 | 0.06 | 0.24 | 0.05 | 0.51 | 0.05 | 0.04 | 0.01 | 0.12 | 0.11 | 0.11 | 0.16 |
| room-clear-four | 2.50 | 2.39 | 0.66 | 0.55 | 0.22 | 0.37 | 1.00 | 0.13 | 0.20 | 0.07 | 0.22 | 0.07 | 0.54 | 0.05 | 0.04 | 0.02 | 0.12 | 0.11 | 0.12 | 0.16 |
| hostage-rescue | 1.64 | 1.92 | 0.46 | 0.51 | 0.18 | 0.30 | 0.95 | 0.12 | 0.20 | 0.06 | 0.22 | 0.03 | 0.19 | 0.04 | 0.03 | 0.04 | 0.11 | 0.12 | 0.10 | 0.16 |
| records-pair | 1.82 | 1.44 | 0.47 | 0.39 | 0.18 | 0.28 | 0.44 | 0.13 | 0.18 | 0.06 | 0.17 | 0.04 | 0.41 | 0.05 | 0.04 | 0.06 | 0.11 | 0.11 | 0.11 | 0.13 |
| depot-four | 3.61 | 1.50 | 0.63 | 0.44 | 0.22 | 0.34 | 0.44 | 0.13 | 0.17 | 0.05 | 0.16 | 0.07 | 0.39 | 0.05 | 0.04 | 0.01 | 0.12 | 0.10 | 0.10 | 0.12 |
| block-four | 2.93 | 1.82 | 0.73 | 0.44 | 0.24 | 0.36 | 0.58 | 0.15 | 0.18 | 0.05 | 0.22 | 0.06 | 0.93 | 0.06 | 0.04 | 0.01 | 0.13 | 0.10 | 0.14 | 0.13 |
| block-squads | 3.97 | 2.46 | 0.89 | 0.51 | 0.47 | 0.38 | 0.63 | 0.16 | 0.19 | 0.06 | 0.26 | 0.09 | 1.22 | 0.05 | 0.04 | 0.01 | 0.14 | 0.11 | 0.14 | 0.14 |
| warehouse-four | 2.94 | 2.35 | 0.57 | 0.40 | 0.27 | 0.35 | 0.61 | 0.16 | 0.18 | 0.06 | 0.26 | 0.05 | 0.76 | 0.04 | 0.03 | 0.01 | 0.08 | 0.10 | 0.12 | 0.11 |
| compound-four | 3.17 | 2.65 | 0.75 | 0.44 | 0.33 | 0.34 | 0.72 | 0.16 | 0.19 | 0.07 | 0.31 | 0.09 | 0.92 | 0.04 | 0.03 | 0.01 | 0.10 | 0.11 | 0.15 | 0.13 |
| barracks-four | 2.97 | 3.78 | 0.61 | 0.36 | 0.26 | 0.35 | 0.70 | 0.17 | 0.18 | 0.05 | 0.28 | 0.05 | 0.93 | 0.04 | 0.02 | 0.01 | 0.08 | 0.09 | 0.16 | 0.11 |
| rescue-registry | 2.14 | 1.22 | 0.46 | 0.51 | 0.17 | 0.27 | 0.54 | 0.13 | 0.20 | 0.06 | 0.17 | 0.04 | 0.34 | 0.05 | 0.04 | 0.01 | 0.12 | 0.07 | 0.11 | 0.12 |

### The buckets behind the columns, all missions pooled (M)

| bucket | mean | share | worst mean in | its mean | worst p99 in | its p99 |
|---|---:|---:|---:|---:|---:|---:|
| svc: animation + skeleton (Character.update) | 1.012 | 32.0% | compound-four | 1.28 | block-squads | 3.97 |
| svc: static line tests (sight, fire, reach) | 0.589 | 18.6% | barracks-four | 1.07 | barracks-four | 3.73 |
| step: box list pack + trace grid (world.upload) | 0.464 | 14.7% | room-clear-four | 0.69 | solo-night | 1.01 |
| guards: updateGuard (senses, state, feet) | 0.174 | 5.5% | block-squads | 0.24 | block-squads | 0.82 |
| dynamic boxes (leaves, props, debris, rig props, fx) | 0.172 | 5.4% | night-breach | 0.21 | night-breach | 0.46 |
| player (aim, interact, move, fire) | 0.088 | 2.8% | night-breach | 0.10 | night-breach | 0.21 |
| characters → skin instances + shadow proxies | 0.085 | 2.7% | block-squads | 0.11 | barracks-four | 0.17 |
| doors | 0.073 | 2.3% | barracks-four | 0.10 | barracks-four | 0.23 |
| room fight (both sides: watch, fear, shoot) | 0.073 | 2.3% | block-squads | 0.11 | block-squads | 0.47 |
| svc: box world raycast (cursor, lasers, rounds) | 0.056 | 1.8% | room-clear-four | 0.12 | room-clear-pair | 0.21 |
| squad: order menu + orders | 0.050 | 1.6% | night-breach | 0.07 | night-breach | 0.20 |
| fog of war | 0.044 | 1.4% | barracks-four | 0.06 | barracks-four | 0.16 |
| weather, wet, wind, moths, rain fx (game half) | 0.038 | 1.2% | night-breach | 0.05 | night-breach | 0.13 |
| squad: door tools | 0.028 | 0.9% | block-four | 0.04 | block-four | 0.20 |
| props (furniture) | 0.025 | 0.8% | hostage-rescue | 0.04 | hostage-rescue | 0.14 |
| svc: sound propagation | 0.022 | 0.7% | block-four | 0.04 | block-squads | 1.22 |
| scenario (director, breach, room clear, rescue) | 0.020 | 0.6% | rescue-registry | 0.05 | hostage-rescue | 0.17 |
| fixtures + devices | 0.017 | 0.5% | night-breach | 0.04 | night-breach | 0.10 |
| squad: entry points, cleared rooms, cover | 0.015 | 0.5% | night-breach | 0.03 | night-breach | 0.34 |
| svc: circle collide (feet vs walls) | 0.014 | 0.4% | room-clear-four | 0.02 | compound-four | 0.07 |
| sensors (meter + smoke line asks) | 0.011 | 0.3% | block-squads | 0.01 | block-squads | 0.05 |
| update: tail (cues, checkpoints, journal) | 0.010 | 0.3% | block-squads | 0.01 | block-squads | 0.06 |
| tactics (flank, lone corner, doorways) | 0.009 | 0.3% | block-four | 0.01 | block-four | 0.06 |
| escalation + QRF | 0.009 | 0.3% | solo-night | 0.02 | solo-night | 0.09 |

### Who asks for the line tests, and how many calls a frame (M)

In the second table a cell is "all calls / outermost calls" a frame: a line test that calls another service inside itself counts once on the right. The times on this page are of the outermost calls.

| asker | ms a frame |
|---|---:|
| fog of war | 0.307 |
| room fight (both sides: watch, fear, shoot) | 0.064 |
| squad: door tools | 0.060 |
| player (aim, interact, move, fire) | 0.054 |
| guards: updateGuard (senses, state, feet) | 0.044 |
| squad: order menu + orders | 0.044 |
| squad: entry points, cleared rooms, cover | 0.007 |
| scenario (director, breach, room clear, rescue) | 0.004 |
| weather, wet, wind, moths, rain fx (game half) | 0.004 |
| tracers + sparks | 0.003 |

| mission | headless only: CPU light estimate standing in for the GPU light probe | animation + skeleton | box world raycast | circle collide | nav paths | sound propagation | static line tests |
|---|---:|---:|---:|---:|---:|---:|---:|
| solo-night | 0 / 0 | 6 / 6 | 3 / 3 | 5 / 5 | 6 / 0 | 0 / 0 | 17 / 3 |
| night-breach | 5 / 5 | 6 / 6 | 3 / 3 | 6 / 6 | 3 / 1 | 0 / 0 | 206 / 34 |
| room-clear-pair | 5 / 5 | 8 / 8 | 3 / 3 | 6 / 6 | 10 / 0 | 0 / 0 | 384 / 96 |
| room-clear-four | 8 / 8 | 10 / 10 | 3 / 3 | 8 / 8 | 12 / 0 | 0 / 0 | 628 / 167 |
| hostage-rescue | 3 / 3 | 8 / 8 | 3 / 3 | 6 / 6 | 3 / 0 | 0 / 0 | 226 / 70 |
| records-pair | 5 / 5 | 8 / 8 | 1 / 1 | 6 / 6 | 7 / 0 | 0 / 0 | 342 / 84 |
| depot-four | 7 / 7 | 10 / 10 | 1 / 1 | 8 / 8 | 5 / 1 | 0 / 0 | 397 / 124 |
| block-four | 7 / 7 | 13 / 13 | 1 / 1 | 8 / 8 | 16 / 0 | 0 / 0 | 522 / 181 |
| block-squads | 9 / 9 | 16 / 16 | 1 / 1 | 10 / 10 | 20 / 0 | 0 / 0 | 630 / 211 |
| warehouse-four | 8 / 8 | 16 / 16 | 1 / 1 | 10 / 10 | 19 / 1 | 0 / 0 | 659 / 196 |
| compound-four | 9 / 9 | 16 / 16 | 1 / 1 | 10 / 10 | 27 / 0 | 0 / 0 | 682 / 214 |
| barracks-four | 8 / 8 | 16 / 16 | 1 / 1 | 10 / 10 | 23 / 0 | 0 / 0 | 732 / 265 |
| rescue-registry | 4 / 4 | 8 / 8 | 1 / 1 | 7 / 7 | 4 / 1 | 0 / 0 | 172 / 60 |

## The build to play now: dee9595, destruction on (M)

*Build: dee9595 shipped (destruction on), three seeds a mission, taken on two pinned cores while the same build with destruction off ran on the other two.*

| mission | frames | mean | p50 | p95 | p99 | max | update mean | update p99 | one box upload | (stand-in, left out) | p99 under 4 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| solo-night | 21420 | 1.69 | 1.50 | 2.46 | 5.33 | 67.23 | 1.22 | 3.89 | 0.47 | 0.05 | NO |
| night-breach | 3906 | 3.05 | 2.71 | 5.39 | 8.26 | 17.21 | 2.27 | 7.22 | 0.78 | 0.57 | NO |
| room-clear-pair | 12726 | 2.85 | 2.69 | 4.09 | 7.14 | 32.93 | 2.27 | 6.50 | 0.58 | 0.43 | NO |
| room-clear-four | 10965 | 3.62 | 3.44 | 5.13 | 8.05 | 32.66 | 2.98 | 7.32 | 0.63 | 0.70 | NO |
| hostage-rescue | 7129 | 2.87 | 2.56 | 4.71 | 7.93 | 39.00 | 2.21 | 7.08 | 0.66 | 0.26 | NO |
| records-pair | 9942 | 2.56 | 2.35 | 3.74 | 7.23 | 68.81 | 2.25 | 6.84 | 0.31 | 0.42 | NO |
| depot-four | 9194 | 2.82 | 2.59 | 4.33 | 7.36 | 30.20 | 2.48 | 6.97 | 0.34 | 0.29 | NO |
| block-four | 10686 | 3.43 | 3.23 | 5.24 | 9.07 | 26.06 | 3.02 | 8.61 | 0.41 | 0.36 | NO |
| block-squads | 5739 | 4.53 | 4.10 | 7.42 | 11.46 | 66.42 | 4.08 | 11.00 | 0.44 | 0.61 | NO |
| warehouse-four | 34939 | 3.33 | 3.06 | 5.18 | 7.49 | 72.56 | 2.91 | 7.00 | 0.41 | 0.60 | NO |
| compound-four | 21201 | 3.80 | 3.50 | 6.18 | 9.19 | 39.92 | 3.32 | 8.58 | 0.48 | 0.50 | NO |
| barracks-four | 35051 | 3.86 | 3.59 | 6.27 | 8.64 | 29.79 | 3.33 | 8.06 | 0.53 | 0.57 | NO |
| rescue-registry | 6882 | 2.37 | 2.22 | 3.57 | 7.00 | 20.63 | 2.01 | 6.55 | 0.36 | 0.16 | NO |

- **The frame costs what it cost on a7ce1d6 (M).** The mean is 1.7 to 4.5 ms and p99 5.3 to 11.5 ms; pooled over 189,780 frames the mean is 3.20 ms, against 3.16 ms over 176,927 frames on a7ce1d6. No mission's p99 is under 4 ms, as before.
- **The order of the systems is unchanged (M).** Animation, line tests and the box upload are the first three in every squad mission (in the solo night the guards edge the line tests, as they did on a7ce1d6), and the tool found every one of its 45 marks in this build's update, so nothing new is hiding in "other".
- **Three rows were taken again.** The first minutes of the first take overlapped other jobs of mine on the box. In it the solo night read 9 % higher than in a clean second take, and with destruction off the night breach read 7 % and the pair's room clear 12 % higher. The rows for those three missions, here and in the next table, are the second take's; the other ten are the first's.

### Destruction on against off, side by side (M)

*Builds: dee9595 no destruction, then dee9595 shipped; the last column is a7ce1d6 shipped from the earlier sitting.* "Same game off and on" counts the seeds whose play-through had the same digest both ways. The solo soaks have no digest.

| mission | off mean | on mean | Δ | off p99 | on p99 | Δ | destruction column, mean | its p99 | box upload off → on | groups that moved (mean ms) | same game off and on | how the runs ended (off · on) | a7ce1d6 shipped mean / p99 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| solo-night | 1.67 | 1.69 | +0.02 | 4.79 | 5.33 | +0.54 | 0.009 | 0.04 | 0.47 → 0.47 | player +0.03 | no digest | soa/soa/soa · soa/soa/soa | 1.59 / 4.69 |
| night-breach | 2.83 | 3.05 | +0.22 | 7.74 | 8.26 | +0.52 | 0.019 | 0.09 | 0.66 → 0.77 | box upload +0.11, player +0.04 | 3 of 3 | tak/tak/tak · tak/tak/tak | 2.65 / 7.01 |
| room-clear-pair | 3.04 | 2.85 | -0.19 | 7.37 | 7.14 | -0.22 | 0.014 | 0.07 | 0.60 → 0.57 | player +0.04 · animation -0.07, line tests -0.06 | 0 of 3 | wip/tak/wip · wip/tak/wip | 3.04 / 7.18 |
| room-clear-four | 3.73 | 3.62 | -0.12 | 8.35 | 8.05 | -0.30 | 0.016 | 0.07 | 0.68 → 0.63 | player +0.04 · line tests -0.07, box upload -0.05 | 0 of 3 | wip/tak/tak · tak/tak/tak | 3.75 / 8.24 |
| hostage-rescue | 2.79 | 2.87 | +0.08 | 7.42 | 7.93 | +0.51 | 0.015 | 0.07 | 0.64 → 0.65 | player +0.04 | 1 of 3 | res/los/res · res/los/res | 2.71 / 7.69 |
| records-pair | 2.40 | 2.56 | +0.16 | 6.30 | 7.23 | +0.93 | 0.016 | 0.07 | 0.29 → 0.31 | animation +0.04 | 0 of 3 | tak/wip/tak · tak/wip/tak | 2.42 / 6.46 |
| depot-four | 2.73 | 2.82 | +0.09 | 7.35 | 7.36 | +0.02 | 0.017 | 0.07 | 0.32 → 0.34 |  | 0 of 3 | wip/tak/tak · tak/tak/tak | 2.68 / 7.39 |
| block-four | 3.42 | 3.43 | +0.01 | 9.05 | 9.07 | +0.03 | 0.018 | 0.08 | 0.41 → 0.41 |  | 1 of 3 | wip/tak/wip · wip/tak/wip | 3.29 / 8.51 |
| block-squads | 3.61 | 4.53 | +0.92 | 9.62 | 11.46 | +1.84 | 0.033 | 0.12 | 0.41 → 0.44 | animation +0.43, guards AI +0.11, line tests +0.07 | 2 of 3 | wip/tak/wip · wip/wip/wip | 3.59 / 9.96 |
| warehouse-four | 3.46 | 3.33 | -0.13 | 7.96 | 7.49 | -0.47 | 0.015 | 0.06 | 0.41 → 0.41 |  · animation -0.12 | 0 of 3 | tak/wip/wip · tak/wip/wip | 3.46 / 7.75 |
| compound-four | 3.71 | 3.80 | +0.09 | 8.58 | 9.19 | +0.61 | 0.016 | 0.07 | 0.45 → 0.47 |  | 0 of 3 | tak/tak/wip · tak/tak/tak | 3.80 / 8.95 |
| barracks-four | 3.97 | 3.86 | -0.11 | 8.74 | 8.64 | -0.10 | 0.014 | 0.06 | 0.49 → 0.53 | box upload +0.04, player +0.04 · line tests -0.14, animation -0.05 | 0 of 3 | tak/tak/tak · tak/tak/tak | 3.90 / 8.78 |
| rescue-registry | 2.19 | 2.37 | +0.18 | 6.57 | 7.00 | +0.43 | 0.018 | 0.08 | 0.32 → 0.36 | animation +0.05, player +0.04, box upload +0.04 | 0 of 3 | res/res/res · res/res/res | 2.37 / 7.26 |

| bucket | mean on | mean off | worst mean in | its mean | worst p99 in | its p99 | worst frame in | ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| destruction (heat, debris) | 0.005 | 0.004 | block-squads | 0.015 | block-squads | 0.08 | warehouse-four | 11.01 |
| destruction: a wall or cover breaking (rounds and blasts on it: holes, pieces, re-baked paths) | 0.000 | 0.000 | solo-night | 0.000 | solo-night | 0.00 | night-breach | 0.31 |
| destruction: both sides react to a break | 0.002 | 0.002 | block-squads | 0.004 | block-squads | 0.03 | compound-four | 3.23 |
| destruction: wall charge, fire at cover | 0.008 | 0.002 | block-squads | 0.014 | block-squads | 0.06 | block-four | 5.68 |

Reading the two tables:

- **With destruction off, dee9595 plays the same games as a7ce1d6 (M):** 36 of 36 scripted play-throughs end on the same digest. So the merge changed nothing for a page opened with `?nodestruction`, and the a7ce1d6 tables on this page stand for it.
- **Destruction on costs nothing this box can see (M).** Pooled, 3.20 ms on against 3.19 ms off. Mission by mission the difference runs from 0.19 ms cheaper to 0.92 ms dearer, and that is the runs, not the switch: with destruction on the rounds chew cover, so only 7 of the 36 scripted seeds play the same game both ways. The +0.92 on The block with three squads is one seed that ended wiped where it had been taken, in 2,656 frames instead of 7,634: the long quiet tail of a won run is gone and the mean is the fight's alone.
- **How far to trust a row (M).** The night breach is the same game on all three seeds, on and off, and on a7ce1d6. Timed three times it read 2.65, 2.83 and 3.05 ms. It is the shortest mission (3,906 frames), and that 15 % is what this box does to a short run from one sitting to the next. For the other eleven, the same games with destruction off read within 8 % of a7ce1d6, 2 % at the median.
- **Destruction's own column is 0.01 to 0.03 ms a frame (M),** p99 0.12 ms at most. By bucket, pooled: heat and debris 0.005 ms (0.004 with it off), both sides reacting to a break 0.002, the wall charge and fire at cover 0.008 (0.002 off).
- **It is in none of the worst frames, but it has one of its own (M).** No destruction bucket is among the three largest parts of any mission's three worst frames; those are the kinds under "Worst single frames" (a one-off in the doors, a man's proxies, the animation or the player; bursts of path finding, here up to 50 ms inside a 73 ms frame; bursts of line tests). The largest single frame of a destruction bucket is 11.0 ms, in the warehouse, with no wall charge in the run: the call the next section times.
- **More boxes on seven maps (C); their time is not resolved (M).** Walls that can break and cover that can be chewed are stood up as 41 to 95 more static boxes there. The box upload moved by −0.01 to +0.04 ms on those maps, and by −0.05 to +0.11 ms on the office missions, whose boxes did not change, so this box cannot tell it from nothing.

### Rooms taken by wall charge (M)

*Build: dee9595 shipped with `PT_WALL=1`: the scripted commander takes a held room through its wall where a partition allows, else by its door. Seven room missions, three seeds.* "Wall engine" is the time inside the two calls that break things (`WallBreak.round` and `.blast`), wherever in the frame a round or a blast lands.

| mission | frames | mean | door entry mean | p99 | door entry p99 | max | destruction column mean | its p99 | wall engine, its worst frame | how the runs ended |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| room-clear-four | 9616 | 4.01 | 3.62 | 9.60 | 8.05 | 75.27 | 0.083 | 2.40 | 0.25 | tak/tak/tak |
| depot-four | 12925 | 2.73 | 2.82 | 7.67 | 7.36 | 63.40 | 0.048 | 0.20 | 0.07 | tak/tak/wip |
| block-four | 10480 | 3.43 | 3.43 | 9.19 | 9.07 | 43.16 | 0.047 | 0.24 | 0.09 | tak/tak/tak |
| block-squads | 18322 | 3.38 | 4.53 | 8.75 | 11.46 | 64.46 | 0.039 | 0.16 | 1.09 | tak/tak/tak |
| warehouse-four | 36173 | 3.24 | 3.33 | 7.84 | 7.49 | 70.23 | 0.031 | 0.12 | 1.64 | tak/tak/wip |
| compound-four | 22038 | 3.77 | 3.80 | 8.96 | 9.19 | 48.48 | 0.025 | 0.10 | 0.22 | tak/tak/tak |
| barracks-four | 33245 | 4.10 | 3.86 | 8.75 | 8.64 | 34.41 | 0.027 | 0.10 | 0.50 | tak/wip/tak |

| bucket | mean | worst p99 | worst frame ms | in |
|---|---:|---:|---:|---:|
| destruction (heat, debris) | 0.0222 | 2.38 | 17.06 | block-four |
| destruction: a wall or cover breaking (rounds and blasts on it: holes, pieces, re-baked paths) | 0.0000 | 0.00 | 1.64 | warehouse-four |
| destruction: both sides react to a break | 0.0057 | 0.07 | 8.21 | block-four |
| destruction: wall charge, fire at cover | 0.0082 | 0.05 | 4.94 | depot-four |

| mission | seed | at, s | whole frame, ms | largest parts, ms |
|---|---:|---:|---:|---:|
| depot-four | 1 | 8.17 | 63.40 | characters → skin instances + shadow proxies 27.0 · destruction 12.1 · static line tests 6.4 |
| depot-four | 2 | 8.17 | 53.53 | characters → skin instances + shadow proxies 17.8 · destruction 11.5 · static line tests 6.5 |
| depot-four | 3 | 8.17 | 36.74 | destruction 12.2 · static line tests 7.2 · destruction: both sides react to a break 4.6 |
| block-four | 3 | 7.98 | 43.16 | destruction 11.0 · static line tests 9.8 · destruction: both sides react to a break 8.2 |
| block-four | 2 | 7.98 | 35.37 | destruction 10.2 · static line tests 7.2 · destruction: both sides react to a break 3.7 |
| block-four | 1 | 7.98 | 33.64 | destruction 10.4 · static line tests 6.6 · destruction: both sides react to a break 3.7 |
| block-squads | 2 | 7.98 | 64.46 | characters → skin instances + shadow proxies 21.7 · destruction 12.2 · static line tests 7.4 |
| block-squads | 1 | 7.98 | 52.52 | destruction 14.5 · static line tests 10.1 · destruction: both sides react to a break 6.2 |
| warehouse-four | 3 | 24.25 | 62.97 | characters → skin instances + shadow proxies 29.8 · static line tests 10.8 · destruction: both sides react to a break 3.6 |
| barracks-four | 2 | 63.52 | 31.12 | static line tests 12.0 · destruction: both sides react to a break 7.3 · weather, wet, wind, moths, rain fx 2.6 |

Reading it:

- **Whether a wall entry costs more on average is not resolved (M).** Five of the seven missions are within 5 % of their door-entry mean. The office is 11 % higher (p99 19 % higher) and the barracks 6 %. These are different games: the commander walks other ways and the runs end differently (the block with three squads reads lower here because all three wall runs were won and ran about 6,000 frames with a long quiet tail, where its door runs were all lost inside 2,700). Destruction's own column is 0.03 to 0.08 ms, 1.2 to 5 times the door entry's and still under 3 % of the frame.
- **The frame the charge blows is a hitch (M).** In the depot (8.17 s, all three seeds) and The block (7.98 s; three seeds with one pool of defenders, two listed with three squads) it is 34 to 64 ms, two to four frames at 60 Hz. In those eight frames: 10 to 14.5 ms in destruction's own bucket in every one, 6.4 to 10.1 ms of line tests, 3.7 to 8.2 ms of both sides reacting where that makes the top three (five of them), and in three an 18 to 27 ms one-off that is not destruction's (a man's proxies fitted the first time; it lands here because the blast is the first thing to drop a man, **I**).
- **Two more frames are probably the same event (I).** The office's frame at 16.53 s is 50 to 75 ms on all three seeds and the warehouse's at 24.25 s is 63 and 70 ms on two. Destruction's buckets are not among their three largest parts (a proxy fit, line tests and, in the office, 8 to 10 ms of glass are), so the re-decide is under 10 ms in the office's and under 4 ms in the warehouse's.
- **The 10 to 14.5 ms is one call (M, two frames).** Timed apart on one seed (`framecost-dee9595-wallcharge-reach.json`, `-reach-office.json`): `Game.reachTick` (`src/game/game.ts:625`), which re-decides which floor each light can reach now that a wall has changed, is 11.5 ms of the depot's blast frame and 10.0 ms of The block's. Its largest single frame in a run is 11.3 to 15.9 ms, and over the three-seed take the bucket it sits in reaches 17.1 ms. Its own comment budgets about 1.5 ms a frame. The rest of destruction in a blast frame is small: the wall engine's two calls, holes, pieces and re-baked paths together, are under 1.7 ms at their worst anywhere, debris and heat about 1 ms.
- **It does not need a wall charge (M).** With plain door entries the same bucket has an 11.0 ms frame in the warehouse: rounds opening cover or a wall queue the same work.
- **Why it overruns (I, from reading it, not timed apart):** the tick's budget counts cells decided, not time, and it takes up to eight lights before it looks at the budget again. One of the lights queued for a hole is the moon, whose mask goes through `buildDirReach` (`game.ts:638`), which buckets every static box of the level before it tests a ray, whatever the size of the hole. Nothing in the simulation reads a reach mask, so spreading that work over frames changes no game.
- **In the office the tail lasts (M).** With about 34 lights live there, the masks are re-decided a few lights a frame for many frames after a break: destruction's p99 is 2.4 ms, against 0.10 to 0.24 ms on the other six maps.
- **Paths are not the cost (M).** The nav grid is re-baked over the hole's footprint inside the wall engine's call: under 1.7 ms.

### What the build to play asks of a GPU (C)

*Builds: dee9595 shipped, all missions, seed 1; then four missions with destruction off. Same window and quality as the GPU section below.*

| mission | arm | internal | compute passes | render passes | dispatches | threads M (max) | raster texels M | triangles k (max) | KB rewritten (max) | write calls | textures MB peak |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| solo-night | shipped | 1330×770 | 20.2 | 5.0 | 55 | 19.05 (35.2) | 7.94 | 183 (190) | 192 (237) | 29 | 441 |
| night-breach | shipped | 1330×770 | 20.1 | 5.0 | 57 | 19.64 (44.0) | 7.94 | 184 (190) | 203 (252) | 29 | 441 |
| room-clear-pair | shipped | 1330×770 | 21.3 | 5.0 | 59 | 21.44 (33.6) | 7.94 | 134 (209) | 188 (247) | 31 | 512 |
| room-clear-four | shipped | 1330×770 | 21.4 | 5.0 | 64 | 22.65 (41.8) | 7.94 | 183 (266) | 204 (267) | 31 | 512 |
| hostage-rescue | shipped | 1330×770 | 21.6 | 5.0 | 68 | 23.41 (34.4) | 7.94 | 193 (239) | 226 (280) | 32 | 512 |
| records-pair | shipped | 1330×770 | 21.7 | 5.0 | 69 | 23.54 (37.1) | 7.94 | 151 (231) | 142 (192) | 33 | 512 |
| depot-four | shipped | 1330×770 | 21.2 | 5.0 | 61 | 22.05 (49.9) | 7.94 | 212 (285) | 138 (190) | 31 | 512 |
| block-four | shipped | 1330×770 | 21.7 | 5.0 | 94 | 28.96 (50.5) | 7.94 | 244 (310) | 144 (199) | 32 | 512 |
| block-squads | shipped | 1330×770 | 21.7 | 5.0 | 74 | 24.64 (49.0) | 7.94 | 216 (312) | 152 (195) | 32 | 512 |
| warehouse-four | shipped | 1330×770 | 21.3 | 5.0 | 59 | 21.66 (40.3) | 7.94 | 329 (426) | 184 (231) | 31 | 512 |
| compound-four | shipped | 1330×770 | 21.4 | 5.0 | 63 | 22.47 (37.9) | 7.94 | 330 (448) | 192 (234) | 31 | 512 |
| barracks-four | shipped | 1330×770 | 21.3 | 5.0 | 59 | 21.73 (45.9) | 7.94 | 329 (428) | 213 (257) | 31 | 512 |
| rescue-registry | shipped | 1330×770 | 21.3 | 5.0 | 61 | 21.97 (33.9) | 7.94 | 169 (236) | 116 (175) | 31 | 512 |

| mission | arm | static boxes | lights live | characters | dynamic boxes | particles | decals | smoke domains | panes listed | panes hit | debris | character model |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| solo-night | shipped | 782 | 36.9 / 39 | 6.0 / 6 | 313.1 / 319 | 3631.5 / 7203 | 1.4 / 4 | 0.3 / 4 | 22.0 / 22 | 0.0 / 0 | 0.0 / 0 | cast: 27164 tris, 53 joints |
| night-breach | shipped | 782 | 34.2 / 39 | 6.0 / 6 | 377.9 / 393 | 3776.3 / 7059 | 0.3 / 5 | 0.3 / 7 | 22.0 / 22 | 0.0 / 0 | 0.1 / 1 | cast: 27164 tris, 53 joints |
| room-clear-pair | shipped | 782 | 33.5 / 36 | 4.3 / 7 | 350.0 / 380 | 2447.8 / 7059 | 0.6 / 2 | 0.6 / 5 | 22.0 / 22 | 0.0 / 0 | 0.6 / 1 | cast: 27164 tris, 53 joints |
| room-clear-four | shipped | 782 | 34.4 / 40 | 6.1 / 9 | 384.6 / 417 | 2264.1 / 7059 | 0.7 / 4 | 1.0 / 5 | 22.0 / 22 | 0.0 / 0 | 0.5 / 1 | cast: 27164 tris, 53 joints |
| hostage-rescue | shipped | 782 | 34.8 / 39 | 6.4 / 8 | 362.6 / 383 | 3071.2 / 4887 | 5.5 / 9 | 1.5 / 4 | 22.0 / 22 | 1.4 / 2 | 0.5 / 1 | cast: 27164 tris, 53 joints |
| records-pair | shipped | 270 | 16.9 / 21 | 5.0 / 8 | 138.4 / 162 | 4719.7 / 5553 | 6.3 / 19 | 1.5 / 5 | 7.0 / 7 | 0.8 / 1 | 0.7 / 1 | cast: 27164 tris, 53 joints |
| depot-four | shipped | 306 | 14.3 / 21 | 7.3 / 10 | 174.2 / 208 | 4102.6 / 5117 | 8.6 / 15 | 0.8 / 8 | 4.0 / 4 | 0.0 / 0 | 1.4 / 3 | cast: 27164 tris, 53 joints |
| block-four | shipped | 307 | 16.1 / 21 | 8.5 / 11 | 242.3 / 270 | 2713.3 / 3701 | 5.9 / 8 | 3.4 / 8 | 4.0 / 4 | 0.0 / 0 | 0.8 / 1 | cast: 27164 tris, 53 joints |
| block-squads | shipped | 307 | 15.2 / 20 | 7.5 / 11 | 225.3 / 257 | 3078.2 / 3907 | 3.9 / 6 | 2.2 / 8 | 4.0 / 4 | 0.0 / 0 | 1.0 / 2 | cast: 27164 tris, 53 joints |
| warehouse-four | shipped | 484 | 18.1 / 25 | 11.5 / 15 | 250.4 / 278 | 4488.2 / 7600 | 5.9 / 8 | 0.7 / 6 | 3.0 / 3 | 0.0 / 0 | 2.0 / 3 | cast: 27164 tris, 53 joints |
| compound-four | shipped | 411 | 13.9 / 18 | 11.6 / 16 | 297.4 / 323 | 2650.7 / 5965 | 5.5 / 9 | 1.0 / 4 | 0.0 / 0 | 0.0 / 0 | 1.1 / 2 | cast: 27164 tris, 53 joints |
| barracks-four | shipped | 622 | 15.0 / 22 | 11.3 / 15 | 297.7 / 326 | 5465.2 / 7554 | 14.4 / 27 | 0.7 / 6 | 12.0 / 12 | 0.0 / 0 | 5.5 / 9 | cast: 27164 tris, 53 joints |
| rescue-registry | shipped | 392 | 8.7 / 12 | 5.7 / 8 | 145.3 / 160 | 4468.5 / 6224 | 0.5 / 1 | 0.9 / 5 | 7.0 / 7 | 0.0 / 0 | 0.5 / 1 | cast: 27164 tris, 53 joints |

| mission | arm | internal | compute passes | render passes | dispatches | threads M (max) | raster texels M | triangles k (max) | KB rewritten (max) | write calls | textures MB peak |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| night-breach | nodestr | 1330×770 | 20.1 | 5.0 | 55 | 19.26 (43.2) | 7.94 | 184 (190) | 203 (251) | 29 | 441 |
| block-four | nodestr | 1330×770 | 21.6 | 5.0 | 76 | 25.09 (41.8) | 7.94 | 187 (310) | 136 (192) | 31 | 512 |
| hostage-rescue | nodestr | 1330×770 | 21.6 | 5.0 | 68 | 23.48 (40.3) | 7.94 | 194 (239) | 226 (279) | 32 | 512 |
| warehouse-four | nodestr | 1330×770 | 21.3 | 5.0 | 59 | 21.72 (41.1) | 7.94 | 342 (455) | 188 (241) | 31 | 512 |

| mission | arm | static boxes | lights live | characters | dynamic boxes | particles | decals | smoke domains | panes listed | panes hit | debris | character model |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| night-breach | nodestr | 782 | 34.2 / 39 | 6.0 / 6 | 378.1 / 393 | 3773.7 / 7059 | 0.3 / 4 | 0.2 / 6 | 22.0 / 22 | 0.0 / 0 | 0.1 / 1 | cast: 27164 tris, 53 joints |
| block-four | nodestr | 254 | 15.5 / 20 | 6.5 / 11 | 223.3 / 261 | 3236.4 / 3529 | 1.2 / 2 | 2.3 / 7 | 4.0 / 4 | 0.0 / 0 | 0.6 / 1 | cast: 27164 tris, 53 joints |
| hostage-rescue | nodestr | 782 | 35.3 / 39 | 6.4 / 8 | 362.7 / 383 | 3066.3 / 4887 | 5.5 / 9 | 1.5 / 5 | 22.0 / 22 | 1.4 / 2 | 0.5 / 1 | cast: 27164 tris, 53 joints |
| warehouse-four | nodestr | 426 | 20.0 / 26 | 11.9 / 16 | 262.6 / 289 | 4960.5 / 7398 | 7.2 / 10 | 0.6 / 6 | 3.0 / 3 | 0.0 / 0 | 2.0 / 3 | cast: 27164 tris, 53 joints |

Reading the counts (**C**; one seed, and runs with destruction on and off are different games, so small differences are the run's):

- **The same passes, the same textures.** 20 to 22 compute passes and 5 render passes a frame, 441 MB of textures in the solo night and the night breach and 512 MB in the rest, exactly as on a7ce1d6. Destruction adds no pass and no texture.
- **Compute threads a frame are 19.0 to 29.0 M**, against 19.1 to 24.6 M on a7ce1d6. The one mission that moved is The block: 29.0 M with destruction on against 25.1 M with it off on this build. Its run with destruction on held 3.4 smoke domains live on average against 2.3. That is smoke the fight made, on one seed; whether destruction's dust is what tips it is not shown by one run (**I**: partly, since a break puffs dust into the solver).
- **The maps with destruction on carry more static boxes**, because walls that can break and cover that can be shot through are stood up as their own boxes: records 229 to 270, depot 258 to 306, block 254 to 307, warehouse 426 to 484, compound 371 to 411, barracks 549 to 622, registry 297 to 392. The office stays at 782. What that costs the box upload is inside this box's noise (see the on-against-off tables).
- **Debris on the floor is 0 to 5.5 pieces on average**, 9 at most (barracks). The bytes rewritten a frame are 116 to 226 KB, the same band as before.

## How far to trust the numbers: the noise (M)

*Build: a7ce1d6 shipped.* The same 39 runs were taken twice, each on two pinned cores, both takes running side by side. Take 1 is the headline above.

| mission | mean 1 | mean 2 | Δ | p95 1 | p95 2 | Δ | p99 1 | p99 2 | Δ | max 1 | max 2 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| solo-night | 1.59 | 1.62 | +1.9% | 2.32 | 2.34 | +0.6% | 4.69 | 4.95 | +5.6% | 148.72 | 234.80 |
| night-breach | 2.65 | 2.70 | +2.0% | 3.93 | 3.90 | -0.9% | 7.01 | 6.52 | -7.0% | 17.99 | 16.50 |
| room-clear-pair | 3.04 | 2.99 | -1.7% | 4.26 | 4.14 | -2.7% | 7.18 | 7.18 | -0.1% | 27.47 | 23.49 |
| room-clear-four | 3.75 | 3.67 | -2.4% | 5.27 | 5.31 | +0.7% | 8.24 | 8.17 | -0.8% | 24.26 | 49.88 |
| hostage-rescue | 2.71 | 2.76 | +2.0% | 4.31 | 4.47 | +3.7% | 7.69 | 7.69 | +0.0% | 25.95 | 33.06 |
| records-pair | 2.42 | 2.38 | -1.5% | 3.66 | 3.51 | -4.1% | 6.46 | 6.66 | +3.0% | 31.80 | 27.79 |
| depot-four | 2.68 | 2.69 | +0.6% | 4.14 | 4.11 | -0.9% | 7.39 | 7.04 | -4.7% | 37.72 | 33.45 |
| block-four | 3.29 | 3.34 | +1.5% | 5.20 | 5.22 | +0.5% | 8.51 | 8.66 | +1.8% | 22.94 | 28.41 |
| block-squads | 3.59 | 3.48 | -3.0% | 6.07 | 5.70 | -6.1% | 9.96 | 9.07 | -8.9% | 54.97 | 52.71 |
| warehouse-four | 3.46 | 3.39 | -2.2% | 5.22 | 5.29 | +1.4% | 7.75 | 7.70 | -0.6% | 60.94 | 62.70 |
| compound-four | 3.80 | 3.69 | -3.1% | 6.13 | 5.86 | -4.4% | 8.95 | 8.55 | -4.4% | 54.81 | 46.37 |
| barracks-four | 3.90 | 3.83 | -2.0% | 6.32 | 6.08 | -3.8% | 8.78 | 8.53 | -2.8% | 45.04 | 35.16 |
| rescue-registry | 2.37 | 2.48 | +4.6% | 3.61 | 4.88 | +35.3% | 7.26 | 8.82 | +21.6% | 33.21 | 66.98 |

Between the two takes the mean moves by 2.0 % at the median and 3.1 % at most; p95 by 2.7 % at the median; p99 by 3.0 % at the median and 8.9 % at most (block-squads). That leaves out rescue-registry, whose second take overlapped another job of mine on the box (mean +4.6 %, p99 8.82 against 7.26): read it as a spoiled row, not as noise. A system column's mean moves by 0.001 ms at the median and 0.07 ms at most. The max column is not repeatable.

Between sittings it is wider. The pick and feature takes further down ran 20 to 40 minutes later, on two seeds, with other takes on the box's other two cores. Runs there that played the same game frame for frame (same digest) read 2.69 to 2.84 ms mean and 5.97 to 7.49 p99 on night-breach, and 3.36 to 3.50 and 8.14 to 9.68 on block-four (**M**): about 5 % on the mean and 20 to 25 % on the p99, with only a feature worth a few hundredths of a ms between them. A p99 over 2,600 frames is 26 frames.

So: **in one sitting, a change under about 5 % of a mean or 10 % of a p99 is inside the noise.** Between sittings, or on two short runs, go by the system columns, which hold to a few hundredths of a ms, and do not read a p99 difference under about 25 %. Take both sides of a comparison the same way, back to back.

## The CPU frame as the page runs it: with the engine's half (M)

*Build: a7ce1d6 shipped, `--gpu`.* Real `Engine` on the recording device, seeds 1 and 2. On the real engine the game takes the page's paths (GPU particles, decals, the smoke solver), so a seed plays out as another run than in the tables above. The render columns time JavaScript against stand-in GPU calls, so they are a **floor**: a real driver adds validation and its own bookkeeping to every call.

| mission | arm | frames | mean | p50 | p95 | p99 | max | animation | line tests | guards AI | squad | dyn boxes | box upload | chars to GPU | smoke CPU | render CPU |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| solo-night | shipped | 14280 | 2.05 | 1.88 | 2.88 | 5.91 | 26.23 | 0.47 | 0.13 | 0.13 | 0.01 | 0.11 | 0.47 | 0.05 | 0.01 | 0.31 |
| night-breach | shipped | 2595 | 3.03 | 2.74 | 4.47 | 7.00 | 15.30 | 0.79 | 0.24 | 0.17 | 0.15 | 0.22 | 0.54 | 0.05 | 0.01 | 0.36 |
| room-clear-pair | shipped | 9540 | 3.40 | 3.12 | 5.12 | 8.24 | 28.91 | 0.96 | 0.45 | 0.17 | 0.11 | 0.18 | 0.55 | 0.06 | 0.01 | 0.37 |
| room-clear-four | shipped | 6677 | 3.97 | 3.67 | 6.18 | 9.62 | 34.59 | 1.07 | 0.71 | 0.21 | 0.15 | 0.20 | 0.56 | 0.08 | 0.01 | 0.40 |
| hostage-rescue | shipped | 5024 | 3.24 | 2.84 | 5.63 | 8.64 | 31.04 | 0.71 | 0.48 | 0.16 | 0.13 | 0.17 | 0.59 | 0.06 | 0.01 | 0.37 |
| records-pair | shipped | 5426 | 3.17 | 2.89 | 4.93 | 8.47 | 29.63 | 1.02 | 0.37 | 0.22 | 0.13 | 0.16 | 0.28 | 0.08 | 0.01 | 0.37 |
| depot-four | shipped | 8684 | 2.97 | 2.66 | 4.57 | 7.42 | 20.79 | 1.02 | 0.38 | 0.18 | 0.13 | 0.18 | 0.29 | 0.07 | 0.01 | 0.28 |
| block-four | shipped | 4331 | 3.86 | 3.62 | 6.12 | 10.37 | 31.25 | 1.31 | 0.52 | 0.28 | 0.14 | 0.20 | 0.36 | 0.09 | 0.02 | 0.35 |
| block-squads | shipped | 11825 | 3.44 | 3.09 | 5.74 | 9.44 | 69.01 | 1.07 | 0.60 | 0.20 | 0.12 | 0.19 | 0.35 | 0.08 | 0.01 | 0.29 |
| warehouse-four | shipped | 27267 | 3.66 | 3.36 | 5.89 | 8.48 | 42.15 | 1.03 | 0.92 | 0.18 | 0.12 | 0.20 | 0.39 | 0.09 | 0.01 | 0.25 |
| compound-four | shipped | 11455 | 3.81 | 3.47 | 6.37 | 9.83 | 51.88 | 1.12 | 0.79 | 0.22 | 0.12 | 0.19 | 0.41 | 0.09 | 0.01 | 0.26 |
| barracks-four | shipped | 20012 | 4.00 | 3.73 | 6.53 | 9.39 | 36.87 | 1.15 | 0.96 | 0.20 | 0.12 | 0.20 | 0.43 | 0.09 | 0.01 | 0.27 |
| rescue-registry | shipped | 4598 | 2.54 | 2.40 | 3.80 | 7.75 | 21.11 | 0.79 | 0.22 | 0.16 | 0.16 | 0.14 | 0.26 | 0.07 | 0.01 | 0.30 |

| mission | arm | cascades encode | decal list | frame uniforms, probe, submit | g-buffer + mesh shadows encode, mo | light list + reach / glass masks u | lighting passes encode | particles | smoke solver encode | step: smoke solver update |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| solo-night | shipped | 0.01 | 0.01 | 0.08 | 0.01 | 0.10 | 0.06 | 0.02 | 0.01 | 0.01 |
| night-breach | shipped | 0.01 | 0.01 | 0.10 | 0.01 | 0.11 | 0.08 | 0.03 | 0.02 | 0.01 |
| room-clear-pair | shipped | 0.01 | 0.01 | 0.09 | 0.01 | 0.14 | 0.07 | 0.02 | 0.02 | 0.01 |
| room-clear-four | shipped | 0.01 | 0.01 | 0.09 | 0.01 | 0.15 | 0.07 | 0.02 | 0.03 | 0.01 |
| hostage-rescue | shipped | 0.01 | 0.01 | 0.10 | 0.01 | 0.11 | 0.07 | 0.02 | 0.03 | 0.01 |
| records-pair | shipped | 0.01 | 0.04 | 0.11 | 0.01 | 0.05 | 0.08 | 0.02 | 0.03 | 0.01 |
| depot-four | shipped | 0.01 | 0.04 | 0.08 | 0.01 | 0.04 | 0.07 | 0.02 | 0.02 | 0.01 |
| block-four | shipped | 0.01 | 0.04 | 0.10 | 0.01 | 0.04 | 0.08 | 0.02 | 0.04 | 0.02 |
| block-squads | shipped | 0.01 | 0.05 | 0.08 | 0.01 | 0.03 | 0.07 | 0.02 | 0.03 | 0.01 |
| warehouse-four | shipped | 0.01 | 0.03 | 0.07 | 0.01 | 0.03 | 0.07 | 0.02 | 0.01 | 0.01 |
| compound-four | shipped | 0.01 | 0.03 | 0.08 | 0.01 | 0.02 | 0.07 | 0.02 | 0.02 | 0.01 |
| barracks-four | shipped | 0.01 | 0.02 | 0.07 | 0.01 | 0.05 | 0.07 | 0.02 | 0.02 | 0.01 |
| rescue-registry | shipped | 0.01 | 0.00 | 0.11 | 0.01 | 0.04 | 0.08 | 0.02 | 0.03 | 0.01 |

The engine's half adds 0.25 to 0.40 ms a frame as a floor (**M**): the light list with its reach and glass masks (0.02 to 0.15 ms, most in the 782-box office levels), the frame uniforms with the probe and the submit (0.07 to 0.11), encoding the lighting passes (0.06 to 0.08), the decal list (up to 0.05), the smoke solver's encode (0.01 to 0.04), the particles (0.02 to 0.03), the smoke solver's own CPU update (0.01 to 0.02). The g-buffer and cascade encodes are 0.01 each.

## Under V8, the page's JavaScript engine: frames and collector pauses (M)

*Build: a7ce1d6 shipped, under node 22.22 (V8 12.4), seed 1; the last subsection repeats it under node 24.9 (V8 13.6).* The same runs under node 22, seed 1, with V8's own `--trace-gc` lines matched to frames. bun is JavaScriptCore; the page is V8. V8 also plays some seeds as another run than bun does (the two engines' maths differ in a last bit): of the 12 play-throughs, 4 had bun's digest, 7 differed at the same length and ending, and one (barracks-four) ran to another length.

| mission | frames | mean | p95 | p99 | max | scavenges /min × mean / max ms | mark-compacts /min × mean / max | GC share | KB allocated a frame | MB a game s | frames > 8 ms with a GC | > 16.6 with a GC | (stand-in time, left out) | same run as bun, seed 1 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| solo-night | 7140 | 2.10 | 3.50 | 6.17 | 56.08 | 207 × 1.79 / 13.0 | 3.0 × 19.05 / 48.1 | 5.7% | 991 | 58 | 16 of 41 | 3 of 4 | 0.03 | no digest (soak) |
| night-breach | 1302 | 2.88 | 5.77 | 9.03 | 30.61 | 362 × 1.80 / 11.8 | 5.5 × 4.04 / 5.0 | 6.5% | 1652 | 97 | 7 of 25 | 1 of 3 | 0.58 | yes |
| room-clear-pair | 1993 | 3.51 | 6.12 | 11.19 | 47.27 | 464 × 1.47 / 7.2 | 7.2 × 12.25 / 24.5 | 6.1% | 2217 | 130 | 18 of 45 | 6 of 7 | 0.71 | no, same length |
| room-clear-four | 2414 | 5.32 | 11.12 | 19.36 | 81.53 | 643 × 2.08 / 21.5 | 7.5 × 10.69 / 17.7 | 7.4% | 3078 | 180 | 78 of 275 | 17 of 40 | 1.21 | yes |
| hostage-rescue | 2047 | 3.60 | 7.82 | 14.57 | 92.86 | 357 × 2.05 / 8.4 | 7.0 × 10.74 / 18.6 | 6.2% | 1721 | 101 | 33 of 97 | 7 of 17 | 0.36 | no, same length |
| records-pair | 2487 | 3.31 | 5.83 | 10.20 | 74.25 | 405 × 1.73 / 15.1 | 5.8 × 10.54 / 15.4 | 6.4% | 1919 | 112 | 23 of 50 | 9 of 10 | 0.50 | no, same length |
| depot-four | 1579 | 3.92 | 7.24 | 13.46 | 47.12 | 504 × 1.72 / 12.2 | 6.8 × 12.50 / 24.2 | 6.7% | 2450 | 144 | 21 of 49 | 5 of 7 | 0.37 | yes |
| block-four | 3169 | 4.08 | 7.39 | 12.55 | 64.28 | 534 × 1.73 / 11.6 | 4.5 × 18.10 / 30.4 | 6.8% | 2490 | 146 | 40 of 107 | 6 of 8 | 0.43 | no, same length |
| block-squads | 903 | 6.18 | 10.36 | 18.24 | 120.58 | 793 × 1.50 / 7.4 | 8.0 × 8.21 / 12.5 | 5.7% | 3709 | 217 | 52 of 146 | 9 of 12 | 0.76 | no, same length |
| warehouse-four | 12567 | 3.18 | 5.50 | 8.67 | 61.95 | 517 × 1.45 / 22.9 | 3.4 × 6.29 / 11.4 | 6.7% | 2363 | 138 | 71 of 162 | 14 of 20 | 0.51 | no, same length |
| compound-four | 5760 | 4.06 | 7.18 | 10.90 | 56.04 | 662 × 1.46 / 39.4 | 4.4 × 6.50 / 19.6 | 6.8% | 3049 | 179 | 89 of 180 | 17 of 19 | 0.62 | no, same length |
| barracks-four | 10748 | 3.99 | 7.07 | 10.25 | 66.28 | 654 × 1.51 / 11.0 | 4.0 × 6.27 / 18.9 | 7.0% | 2971 | 174 | 126 of 271 | 14 of 19 | 0.69 | no, other length |
| rescue-registry | 2281 | 2.51 | 4.81 | 8.61 | 44.84 | 292 × 1.87 / 11.9 | 3.2 × 6.21 / 8.8 | 6.3% | 1314 | 77 | 13 of 27 | 3 of 4 | 0.16 | yes |

Reading it (this table is node 22; the newer V8 is in the last subsection, and it is kinder):

- **These frames are not at the page's cadence.** They are the harness step as it ran: the box list packed every fourth frame, so each frame is short of about three quarters of a pack (0.2 to 0.5 ms) against the tables above. Twelve of the 13 means are still higher than bun's (warehouse-four is lower). One seed against three, so that is a rough reading and not a ratio. Use this section for the collector, not as a second frame table.
- **The allocation and collector numbers are for the whole process.** They include the garbage of the headless-only light estimate (about a tenth of the bytes, **I** from the caller shares below) and of the scripted player. The page would allocate that much less.
- **Allocation is 1.0 to 3.7 MB a frame (M).** At 60 fps that is 58 to 217 MB a second through the young generation.
- **Short collections (scavenges): 207 to 793 a game minute at 1.5 to 2.1 ms mean; the longest was 39 ms (M).** At 500 a minute, one frame in seven holds one.
- **Full collections (mark-compact): 3 to 8 a game minute at 4 to 19 ms mean; the longest was 48 ms (M).** How Chrome schedules these differs from node (it can use idle time between frames); that the pauses are shorter on the page is **I**.
- Pooled over the 13 missions, 587 of the 1,475 frames over 8 ms held a collection (40 %), and 111 of the 170 frames over 16.6 ms (65 %) (**M**).

The two profiles below are pooled over block-four, hostage-rescue and warehouse-four, seed 1; the callers column is block-four's. Line numbers in "where" are of the transpiled file: near, not exact (`collision.ts:217` there is `:148` in the source). Both include the headless-only light estimate: `lightEstimateAt` is 37 % of `segmentBlocked`'s time and a third of its bytes, and that part does not run on the page.

### Who allocates (M, V8 sampling profiler, node 22)

| function | where | KB a frame | share | callers (in block-four) |
|---|---:|---:|---:|---:|
| lineBox | src/scene/collision.ts:9 | 357.8 | 15.3% | segmentBlocked 100%, shotThroughGlass 0% |
| hypot | :0 | 279.6 | 11.8% | sampleClip 11%, blendPose 11%, substep 9% |
| rayBox | src/scene/boxes.ts:1160 | 207.8 | 8.8% | segmentBlocked 90%, raycast 6%, segmentBlockedDynamic 2% |
| update | src/anim/skeleton.ts:142 | 101.5 | 4.3% | update 90%, updateRagdoll 10% |
| applyAdj | src/game/rigProps.ts:171 | 101.0 | 4.3% | seg 54%, carbineLightPose 13%, holsterBoxes 8% |
| segmentBlocked | src/scene/collision.ts:217 | 97.7 | 4.1% | lightEstimateAt 33%, doorSeen 25%, eyeContact 22% |
| update | src/game/doors.ts:147 | 72.3 | 3.0% | updateDoors 100% |
| seg | src/game/rigProps.ts:191 | 42.7 | 1.8% | sc20kBoxes 55%, holsterBoxes 33%, carbineBoxes 12% |
| substep | src/game/ragdoll.ts:240 | 39.4 | 1.6% | step 100% |
| lightEstimateAt | src/game/guards.ts:3751 | 34.3 | 1.5% | (anonymous) 52%, unitLightMeter 36%, standIn 9% |
| next | :0 | 31.3 | 1.4% | update 16%, handsOnDoors 9%, tick 9% |
| sampleClip | src/anim/skeleton.ts:22 | 30.7 | 1.3% | update 86%, sampleJog 14% |
| normalize | src/math/vec.ts:29 | 29.8 | 1.3% | twoBoneIK 73%, longArms 7%, canSeeChar 3% |
| blendPose | src/anim/skeleton.ts:88 | 29.7 | 1.3% | update 99%, longArms 1%, sneakLayer 0% |
| (anonymous) | src/render/sdfrig.ts:127 | 25.3 | 1.1% | forEach 61%, fitRig 39% |
| (anonymous) | src/game/character.ts:1862 | 25.0 | 1.1% | hand 52%, longArms 27%, forEach 20% |
| twoBoneIK | src/anim/skeleton.ts:404 | 22.6 | 1.0% | lifeLayer 34%, solve 33%, mvHips 9% |
| extractRotation | src/game/ragdoll.ts:687 | 20.0 | 0.8% | shapeMatch 100% |
| gogglesBoxes | src/game/rigProps.ts:215 | 19.8 | 0.8% | rigBoxes 71%, handPropsRaw 29% |
| rotateModel | src/anim/skeleton.ts:370 | 19.7 | 0.8% | turn 57%, twoBoneIK 36%, mvTrunk 3% |
| eyeContact | src/game/guards.ts:1793 | 18.6 | 0.8% | canSeeChar 69%, (anonymous) 16%, lineToMan 12% |
| fromBasis | src/math/vec.ts:64 | 18.6 | 0.8% | seg 78%, gogglesBoxes 12%, handRot 8% |
| wp | src/game/character.ts:3558 | 17.6 | 0.8% | readBones 100% |
| handsOnDoors | src/game/game.ts:1641 | 17.6 | 0.7% | updateDoors 100% |
| rotate | src/math/vec.ts:98 | 16.9 | 0.7% | gridRegister 29%, applyAdj 27%, update 8% |
| cap | src/game/character.ts:3710 | 16.2 | 0.7% | capsules 98%, sole 2% |
| boxes | src/game/throwables.ts:216 | 16.2 | 0.7% | update 100% |
| step | src/game/props.ts:286 | 15.4 | 0.7% | update 100% |

### Who burns the time, by function (M, V8 CPU profiler, self time, node 22)

| function | where | self ms a frame | share | callers (in block-four) |
|---|---:|---:|---:|---:|
| segmentBlocked | src/scene/collision.ts:217 | 0.463 | 10.5% | lightEstimateAt 37%, eyeContact 21%, doorSeen 13% |
| rayBox | src/scene/boxes.ts:1160 | 0.318 | 7.3% | segmentBlockedDynamic 88%, rayTest 7%, (anonymous) 1% |
| (garbage collector) | :0 | 0.310 | 7.0% | (root) 100% |
| lineBox | src/scene/collision.ts:9 | 0.217 | 4.9% | segmentBlocked 97%, solidBlocked 1%, lightEstimateAt 1% |
| sampleClip | src/anim/skeleton.ts:22 | 0.144 | 3.2% | update 89%, sampleJog 11% |
| segmentBlockedDynamic | src/scene/collision.ts:190 | 0.127 | 2.9% | segmentBlocked 95%, reach 5%, propagate 0% |
| update | src/game/game.ts:1187 | 0.122 | 2.7% | step 100% |
| update | src/anim/skeleton.ts:142 | 0.111 | 2.5% | update 88%, updateRagdoll 12%, updateGuard 0% |
| run | src/anim/skeleton.ts:262 | 0.098 | 2.2% | twoBoneIK 51%, lifeLayer 18%, longArms 12% |
| blendPose | src/anim/skeleton.ts:88 | 0.086 | 1.9% | update 72%, longArms 28%, mvPost 0% |
| update | src/game/character.ts:1081 | 0.077 | 1.7% | update 99%, runGuardScript 0%, updateGuard 0% |
| runFrom | src/anim/skeleton.ts:296 | 0.064 | 1.4% | twoBoneIK 99%, lifeLayer 1%, solve 0% |
| len | src/math/vec.ts:21 | 0.055 | 1.2% | segmentBlockedDynamic 28%, segmentBlocked 27%, twoBoneIK 20% |
| normalize | src/math/vec.ts:29 | 0.053 | 1.2% | twoBoneIK 46%, longArms 10%, headDir 8% |
| lightEstimateAt | src/game/guards.ts:3751 | 0.049 | 1.1% | (anonymous) 94%, nvgPlaceLight 4%, standIn 1% |
| step | tools/qa/headless.ts:97 | 0.048 | 1.1% | step 100%, until 0% |
| update | src/game/character.ts:3479 | 0.042 | 0.9% | updateGuard 48%, runGuardScript 38%, updatePlayer 14% |
| step | tools/qa/playthrough.ts:957 | 0.039 | 0.9% | until 53%, go 28%, wait 16% |
| updateGuard | src/game/guards.ts:2818 | 0.037 | 0.8% | update 99%, step 1% |
| rotateModel | src/anim/skeleton.ts:370 | 0.035 | 0.8% | turn 58%, twoBoneIK 37%, lifeLayer 2% |
| substep | src/game/ragdoll.ts:240 | 0.034 | 0.8% | step 100% |
| makeBox | src/scene/boxes.ts:32 | 0.034 | 0.8% | seg 54%, boxes 32%, gogglesBoxes 14% |
| upload | src/scene/boxes.ts:425 | 0.034 | 0.7% | step 100% |
| extractRotation | src/game/ragdoll.ts:687 | 0.033 | 0.7% | shapeMatch 99%, substep 1% |
| update | src/game/doors.ts:147 | 0.033 | 0.8% | updateDoors 100% |
| seg | src/game/rigProps.ts:191 | 0.032 | 0.7% | sc20kBoxes 55%, holsterBoxes 29%, carbineBoxes 14% |
| applyAdj | src/game/rigProps.ts:171 | 0.030 | 0.7% | seg 48%, gogglesBoxes 18%, pistolFrame 15% |
| (anonymous) | src/render/sdfrig.ts:127 | 0.028 | 0.6% | fitRig 100% |

### Which V8, and what changes on a newer one (M)

Everything above in this section is node 22.22, whose V8 is 12.4. The page runs on Chrome's V8, which is newer: 14.1 in the Chromium 141 on this box. The performance thread's reading of V8's source was that `Math.hypot` builds a scratch array on every call up to 12.x and no longer does for two or three arguments from 13.0. Measured here, 20 million calls in a loop, garbage read off the collector's own lines (**M**, to about 10 %):

| engine | bytes of garbage a call, 2 / 3 / 4 arguments | ns a call, 2 / 3 / 4 |
|---|---:|---:|
| node 22.22 (V8 12.4) | 59 / 67 / 74 | 29 / 31 / 34 |
| node 24.9 (V8 13.6) | 32 / 32 / 81 | 17 / 21 / 38 |
| Chromium 141 headless (V8 14.1) | 23 / 23 / 64 | 14 / 18 / 40 |

The same loop with `Math.sqrt(x*x + y*y + z*z)` written out makes no garbage and takes 2.1 to 2.4 ns in all three.

So the claim holds in part. On a newer V8 a two- or three-argument call leaves 40 to 55 % of what it leaves under node 22, not nothing: 23 to 32 bytes, which is what two boxed numbers weigh (**I**: the argument and the result of a call that is not inlined). Four arguments allocate as before. And the call is still six to ten times the time of the written-out form.

The whole collector take again under node 24 (**M**; the same 13 runs, the same frame counts):

| mission | frames (24) | frames (22) | KB a frame, node 22 | node 24 | scavenges /min × ms, node 22 | node 24 (/ max) | GC share, node 22 | node 24 | frame mean, node 22 | node 24 | p99, node 22 | node 24 | > 8 ms with a GC (24) | > 16.6 with a GC (24) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| solo-night | 7140 | 7140 | 991 | 884 | 207 × 1.79 | 50 × 2.96 / 8.9 | 5.7% | 2.6% | 2.10 | 1.69 | 6.17 | 4.75 | 3 of 11 | 0 of 1 |
| night-breach | 1302 | 1302 | 1652 | 1523 | 362 × 1.80 | 108 × 2.88 / 6.3 | 6.5% | 4.3% | 2.88 | 2.17 | 9.03 | 7.24 | 4 of 12 | 0 of 0 |
| room-clear-pair | 1993 | 1993 | 2217 | 1905 | 464 × 1.47 | 130 × 2.13 / 5.3 | 6.1% | 2.8% | 3.51 | 2.81 | 11.19 | 7.66 | 2 of 16 | 0 of 4 |
| room-clear-four | 2414 | 2414 | 3078 | 2695 | 643 × 2.08 | 164 × 2.42 / 9.2 | 7.4% | 3.3% | 5.32 | 3.65 | 19.36 | 10.74 | 9 of 49 | 2 of 8 |
| hostage-rescue | 2047 | 2047 | 1721 | 1527 | 357 × 2.05 | 104 × 2.67 / 4.7 | 6.2% | 3.2% | 3.60 | 2.50 | 14.57 | 7.95 | 6 of 20 | 2 of 4 |
| records-pair | 2487 | 2487 | 1919 | 1658 | 405 × 1.73 | 112 × 2.13 / 4.4 | 6.4% | 2.8% | 3.31 | 2.40 | 10.20 | 6.03 | 2 of 9 | 0 of 5 |
| depot-four | 1579 | 1579 | 2450 | 1981 | 504 × 1.72 | 137 × 2.54 / 5.2 | 6.7% | 3.2% | 3.92 | 3.13 | 13.46 | 9.27 | 6 of 26 | 2 of 5 |
| block-four | 3169 | 3169 | 2490 | 2144 | 534 × 1.73 | 131 × 2.65 / 5.5 | 6.8% | 3.2% | 4.08 | 3.15 | 12.55 | 7.55 | 10 of 28 | 0 of 3 |
| block-squads | 903 | 903 | 3709 | 3100 | 793 × 1.50 | 235 × 2.33 / 5.7 | 5.7% | 2.8% | 6.18 | 5.80 | 18.24 | 15.31 | 16 of 97 | 2 of 8 |
| warehouse-four | 12567 | 12567 | 2363 | 2166 | 517 × 1.45 | 122 × 2.96 / 13.4 | 6.7% | 3.8% | 3.18 | 2.75 | 8.67 | 6.95 | 16 of 65 | 2 of 11 |
| compound-four | 5760 | 5760 | 3049 | 2690 | 662 × 1.46 | 156 × 2.20 / 4.2 | 6.8% | 2.9% | 4.06 | 3.45 | 10.90 | 8.02 | 17 of 60 | 2 of 9 |
| barracks-four | 10748 | 10748 | 2971 | 2723 | 654 × 1.51 | 153 × 2.62 / 8.8 | 7.0% | 3.3% | 3.99 | 3.47 | 10.25 | 8.22 | 31 of 125 | 2 of 10 |
| rescue-registry | 2281 | 2281 | 1314 | 1167 | 292 × 1.87 | 85 × 2.75 / 7.4 | 6.3% | 3.4% | 2.51 | 1.97 | 8.61 | 6.82 | 5 of 17 | 3 of 4 |

Reading the two side by side:

- **Allocation is 8 to 19 % lower under node 24 (M):** 0.9 to 3.1 MB a frame against 1.0 to 3.7. In the allocation profile `Math.hypot` falls from 280 to 157 KB a frame (11.8 % of the bytes to 7.4 %) and `lineBox` and `rayBox`, the line tests' own garbage, do not move (358 and 208 KB under node 22, 356 and 206 under node 24). Under node 24 they are the top two; under node 22 `Math.hypot` sat between them.
- **Short collections are a quarter as many and each is longer (M; the reason is I):** 50 to 235 a game minute at 2.1 to 3.0 ms, against 207 to 793 at 1.5 to 2.1. My reading is that node 24 gives the young generation more room; the game is not allocating a quarter as much. The collector's share of frame time is 2.6 to 4.3 %, against 5.7 to 7.4 %.
- **The frames are faster too (M; one seed and one take on each engine, an hour apart):** the mean is 13 to 31 % lower on twelve missions and 6 % lower on the thirteenth (903 frames, inside this box's spread); the range is 1.7 to 5.8 ms against 2.1 to 6.2, and p99 is 4.8 to 15.3 ms against 6.2 to 19.4. 535 frames ran over 8 ms, against 1,475, and a collection sat inside 127 of them (24 %); 72 ran over 16.6 ms, against 170, with a collection inside 17.
- **Which is the page (I):** Chrome's V8 is newer than both, so the node 24 column is the better guide, and Chrome packs its heap tighter than node (a boxed number is 12 bytes there against 16), so bytes on the page should be lower again. Nobody has measured the page itself: that needs his Mac.

## Everything on: what he can pick (M)

*Build: a7ce1d6 shipped plus the picks named; destruction is not in this build, so it is not in "everything" here. For destruction see "The build to play now".* "Everything" is the shipped build plus a downpour, dusk, and extra enemies up to the cap of 11 defenders. The tool adds enemies only to room-clear missions that stage fewer than 11 (the "+N"); rescues and the night breach get none, and missions already at 11 are unchanged. The solo night's soak takes no weather, hour or enemy count, so it is measured as shipped only. Seeds 1 and 2, against the shipped table's three seeds: runs end differently, so small differences are run-to-run, not the picks. In the last column the endings are shortened: tak(en), wip(ed out), res(cued), los(t), soa(k).

| mission | arm | frames | mean | Δ vs shipped | p99 | Δ | max | groups that moved (mean ms) | how the runs ended (arm vs shipped) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| night-breach | everything | 2601 | 2.88 | +0.23 | 7.77 | +0.75 | 20.70 | box upload +0.12, animation +0.05 | tak/tak vs tak/tak |
| room-clear-pair | everything (+6) | 5464 | 4.50 | +1.46 | 10.78 | +3.60 | 58.61 | animation +0.76, line tests +0.29, guards AI +0.16 | wip/wip vs wip/tak |
| room-clear-four | everything (+6) | 7241 | 4.85 | +1.09 | 11.06 | +2.82 | 33.20 | animation +0.55, line tests +0.24, guards AI +0.13 | tak/wip vs wip/tak |
| hostage-rescue | everything | 5057 | 2.60 | -0.11 | 6.82 | -0.87 | 22.57 |  | res/los vs res/los |
| records-pair | everything (+6) | 2888 | 4.17 | +1.75 | 10.37 | +3.90 | 32.10 | animation +0.74, line tests +0.32, guards AI +0.20 | wip/wip vs tak/wip |
| depot-four | everything (+6) | 4908 | 4.10 | +1.42 | 10.63 | +3.24 | 64.81 | animation +0.64, line tests +0.30, guards AI +0.16 | wip/tak vs wip/tak |
| block-four | everything (+3) | 6110 | 3.84 | +0.55 | 9.97 | +1.47 | 60.07 | animation +0.28, guards AI +0.09, line tests +0.05 | tak/wip vs wip/tak |
| block-squads | everything | 4693 | 3.99 | +0.40 | 10.12 | +0.15 | 60.36 | animation +0.25, line tests +0.07, guards AI +0.04 · box upload -0.03 | wip/wip vs wip/tak |
| warehouse-four | everything | 17845 | 3.41 | -0.05 | 7.94 | +0.19 | 67.28 |  · animation -0.04 | tak/wip vs tak/wip |
| compound-four | everything | 15157 | 3.91 | +0.11 | 8.45 | -0.49 | 37.25 | line tests +0.11 | tak/tak vs tak/tak |
| barracks-four | everything | 22722 | 3.80 | -0.10 | 9.19 | +0.42 | 35.84 |  · line tests -0.07, animation -0.04 | tak/tak vs tak/tak |
| rescue-registry | everything | 4568 | 2.25 | -0.12 | 6.70 | -0.56 | 23.59 |  · animation -0.04 | res/res vs res/res |

Where enemies were added (+6) the mean rose 1.1 to 1.8 ms and the p99 2.8 to 3.9 ms; with +3 (block-four) 0.55 and 1.5. The columns that grow are the per-character ones: animation, line tests, guards AI. That is about 0.2 to 0.3 ms of mean frame per extra defender (**M**). Where nothing was added the frame moved by −0.12 to +0.40 ms (up to 11 %, block-squads): two seeds against three, in another sitting, so I cannot tell it from the spread between sittings (see the noise section).

### The picks one at a time, four missions (M)

| mission | arm | frames | mean | Δ vs shipped | p99 | Δ | max | groups that moved (mean ms) | how the runs ended (arm vs shipped) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| night-breach | downpour | 2603 | 2.81 | +0.16 | 6.98 | -0.03 | 18.08 | box upload +0.11, animation +0.03 | tak/tak vs tak/tak |
| block-four | downpour | 4904 | 3.68 | +0.39 | 9.60 | +1.09 | 30.53 | animation +0.14, guards AI +0.05, line tests +0.05 | wip/tak vs wip/tak |
| hostage-rescue | downpour | 5050 | 2.71 | +0.01 | 8.02 | +0.33 | 28.51 |  | res/los vs res/los |
| warehouse-four | downpour | 18223 | 3.36 | -0.10 | 7.83 | +0.08 | 63.22 |  · animation -0.05 | tak/wip vs tak/wip |
| night-breach | dusk | 2596 | 2.75 | +0.10 | 7.04 | +0.02 | 16.82 | box upload +0.06 | tak/tak vs tak/tak |
| block-four | dusk | 5495 | 3.48 | +0.19 | 9.68 | +1.17 | 35.44 | animation +0.05, line tests +0.03, guards AI +0.03 | wip/tak vs wip/tak |
| hostage-rescue | dusk | 5057 | 2.73 | +0.02 | 7.45 | -0.24 | 26.29 |  | res/los vs res/los |
| warehouse-four | dusk | 17859 | 3.25 | -0.21 | 7.76 | +0.01 | 78.47 |  · animation -0.07, line tests -0.06 | tak/wip vs tak/wip |
| night-breach | cap | 2603 | 2.69 | +0.04 | 5.97 | -1.04 | 27.77 | box upload +0.05 | tak/tak vs tak/tak |
| block-four | cap (+3) | 5501 | 4.08 | +0.79 | 11.28 | +2.77 | 32.65 | animation +0.41, guards AI +0.09, line tests +0.09 | tak/wip vs wip/tak |
| hostage-rescue | cap | 5050 | 2.75 | +0.04 | 7.84 | +0.15 | 24.51 | box upload +0.04 | res/los vs res/los |
| warehouse-four | cap | 18315 | 3.28 | -0.18 | 7.61 | -0.14 | 63.52 |  · animation -0.09, line tests -0.04 | tak/wip vs tak/wip |

The weather's own column does not grow under a downpour or at dusk: 0.03 to 0.05 ms either way (**M**). Frame totals moved by −6 to +12 % on the mean and up to +14 % on the p99. Block-four at dusk played seeds 1 and 2 exactly as shipped did (same digests) and still read +6 % and +14 % against the shipped row: that is the spread between sittings, not the hour. The cap on block-four (+3 defenders) is real: animation +0.41 ms.

### Two person stealth (M)

| mission | arm | frames | mean | Δ vs shipped | p99 | Δ | max | groups that moved (mean ms) | how the runs ended (arm vs shipped) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| room-clear-pair | pair | 6745 | 2.59 | -0.45 | 6.59 | -0.59 | 22.81 |  · animation -0.20, line tests -0.11 | tak/tak vs wip/tak |
| records-pair | pair | 6131 | 1.97 | -0.46 | 5.51 | -0.96 | 20.37 |  · animation -0.23, guards AI -0.06 | tak/tak vs tak/wip |

## What the night's features cost on the CPU (M)

*Build: a7ce1d6.* Shipped with one feature put back off, four missions, seeds 1 and 2. Δ is that arm minus shipped (three seeds, an earlier sitting), so a negative Δ would be what the feature costs. "harness" has all of them off. The frame totals here are inside the spread between sittings; the reading below goes by each feature's own column.

| mission | arm | frames | mean | Δ vs shipped | p99 | Δ | max | groups that moved (mean ms) | how the runs ended (arm vs shipped) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| night-breach | harness | 2603 | 2.57 | -0.08 | 7.21 | +0.19 | 18.24 |  · animation -0.08 | tak/tak vs tak/tak |
| block-four | harness | 7835 | 2.90 | -0.40 | 8.16 | -0.34 | 24.25 |  · animation -0.14, line tests -0.11 | wip/tak vs wip/tak |
| hostage-rescue | harness | 5528 | 2.83 | +0.12 | 7.18 | -0.51 | 24.14 | line tests +0.07, box upload +0.04 · chars to GPU -0.03 | res/res vs res/los |
| warehouse-four | harness | 25360 | 3.08 | -0.38 | 7.01 | -0.74 | 65.47 |  · animation -0.22, chars to GPU -0.04 | tak/tak vs tak/wip |
| night-breach | nocast | 2603 | 2.81 | +0.17 | 6.63 | -0.38 | 20.88 | box upload +0.11, animation +0.04 | tak/tak vs tak/tak |
| block-four | nocast | 5495 | 3.39 | +0.10 | 8.14 | -0.37 | 23.91 | animation +0.05, line tests +0.04 · chars to GPU -0.04 | wip/tak vs wip/tak |
| hostage-rescue | nocast | 5050 | 2.67 | -0.03 | 7.23 | -0.46 | 31.66 |  · chars to GPU -0.03 | res/los vs res/los |
| warehouse-four | nocast | 18315 | 3.17 | -0.29 | 7.23 | -0.52 | 57.57 |  · animation -0.10, box upload -0.05 | tak/wip vs tak/wip |
| night-breach | nomoves | 2603 | 2.61 | -0.04 | 6.18 | -0.83 | 15.59 | box upload +0.05 · animation -0.07 | tak/tak vs tak/tak |
| block-four | nomoves | 7835 | 2.98 | -0.31 | 8.22 | -0.28 | 32.06 |  · animation -0.14, line tests -0.11 | wip/tak vs wip/tak |
| hostage-rescue | nomoves | 4156 | 2.85 | +0.14 | 8.03 | +0.34 | 30.85 | line tests +0.04, box upload +0.03, squad +0.03 | res/res vs res/los |
| warehouse-four | nomoves | 23697 | 3.15 | -0.32 | 7.10 | -0.65 | 70.67 |  · animation -0.19, box upload -0.03 | tak/tak vs tak/wip |
| night-breach | noglass | 2603 | 2.84 | +0.20 | 7.49 | +0.47 | 24.05 | box upload +0.09, animation +0.05 | tak/tak vs tak/tak |
| block-four | noglass | 5495 | 3.36 | +0.07 | 8.92 | +0.42 | 34.29 |  | wip/tak vs wip/tak |
| hostage-rescue | noglass | 5533 | 3.07 | +0.37 | 8.04 | +0.35 | 50.42 | box upload +0.11, line tests +0.08, animation +0.08 | res/res vs res/los |
| warehouse-four | noglass | 18315 | 3.25 | -0.21 | 7.72 | -0.03 | 60.55 |  · animation -0.08, line tests -0.05 | tak/wip vs tak/wip |
| night-breach | nofrags | 2603 | 2.83 | +0.19 | 6.93 | -0.09 | 24.67 | box upload +0.12 | tak/tak vs tak/tak |
| block-four | nofrags | 5495 | 3.50 | +0.21 | 9.14 | +0.63 | 24.62 | animation +0.05, box upload +0.04, guards AI +0.03 | wip/tak vs wip/tak |
| hostage-rescue | nofrags | 5050 | 3.00 | +0.30 | 8.55 | +0.86 | 29.71 | box upload +0.07, animation +0.06, line tests +0.05 | res/los vs res/los |
| warehouse-four | nofrags | 18315 | 3.26 | -0.20 | 7.61 | -0.14 | 57.02 |  · animation -0.07, line tests -0.06 | tak/wip vs tak/wip |

By each feature's own column (**M**):

- **The motion pass with the turn weight** (`nomoves`): animation costs 3 to 13 µs less a character a frame without it (night-breach 131 → 120, block-four 88 → 78, hostage-rescue 84 → 81, warehouse-four 73 → 60). That is 0.03 to 0.19 ms a frame. It also changes how the runs play out, as it should.
- **The cast** (`nocast`, the same game frame for frame as shipped): "characters → skin instances" is 0.04 to 0.06 ms without it and 0.06 to 0.10 with it, so 0.02 to 0.04 ms a frame, and that column is where the rig-fit hitches sit. Animation does not change: same skeleton.
- **Glass parts** (`noglass`): the glass column is under 0.01 ms either way.
- **The defenders' frags** (`nofrags`): the gear column is 0.012 to 0.015 ms without them and 0.017 to 0.022 with them.
- **All of them together** (`harness`): animation −0.08 to −0.22 ms on three missions and no change on hostage-rescue, skin instances −0.01 to −0.04, gear under −0.01. So the night's features cost 0.04 to 0.27 ms of mean CPU frame, nearly all of it the motion pass.

### The same tool at 25e5e7c, the sure way back (M)

*Builds: 25e5e7c harness; a7ce1d6 harness; a7ce1d6 shipped.*

| mission | 25e5e7c mean | p99 | a7ce1d6 features off mean | p99 | a7ce1d6 shipped mean | p99 | Δ mean shipped − 25e5e7c | Δ p99 | groups that grew (mean ms) | how the runs ended (old · off · shipped) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| solo-night | 1.55 | 4.92 | 1.64 | 5.63 | 1.59 | 4.69 | +0.05 | -0.24 |  | soa/soa · soa/soa · soa/soa/soa |
| night-breach | 2.57 | 6.20 | 2.59 | 6.33 | 2.65 | 7.01 | +0.07 | +0.81 | animation +0.08 | tak/tak · tak/tak · tak/tak/tak |
| room-clear-pair | 2.60 | 6.43 | 2.60 | 6.63 | 3.04 | 7.18 | +0.44 | +0.75 | animation +0.18, box upload +0.07, line tests +0.06, guards AI +0.04 | tak/tak · tak/tak · wip/tak/wip |
| room-clear-four | 3.17 | 7.30 | 3.22 | 6.98 | 3.75 | 8.24 | +0.58 | +0.94 | animation +0.24, box upload +0.08, guards AI +0.07, line tests +0.05 | wip/tak · wip/tak · wip/tak/tak |
| hostage-rescue | 2.83 | 7.20 | 2.94 | 7.15 | 2.71 | 7.69 | -0.12 | +0.49 | chars to GPU +0.03 | res/res · res/res · res/los/res |
| records-pair | 2.37 | 6.60 | 2.35 | 6.50 | 2.42 | 6.46 | +0.06 | -0.13 | chars to GPU +0.04, animation +0.03 | tak/tak · tak/tak · tak/wip/tak |
| depot-four | 2.21 | 5.98 | 2.22 | 6.14 | 2.68 | 7.39 | +0.47 | +1.41 | animation +0.26, line tests +0.06, chars to GPU +0.04, guards AI +0.04 | tak/tak · tak/tak · wip/tak/tak |
| block-four | 2.73 | 7.32 | 2.82 | 7.70 | 3.29 | 8.51 | +0.56 | +1.19 | animation +0.20, line tests +0.14, chars to GPU +0.05, guards AI +0.03 | wip/tak · wip/tak · wip/tak/wip |
| block-squads | 3.20 | 8.13 | 3.06 | 8.09 | 3.59 | 9.96 | +0.39 | +1.83 | animation +0.17, chars to GPU +0.05, box upload +0.05, guards AI +0.04 | wip/wip · wip/wip · wip/tak/wip |
| warehouse-four | 3.05 | 6.90 | 3.12 | 7.04 | 3.46 | 7.75 | +0.41 | +0.85 | animation +0.21, box upload +0.04, chars to GPU +0.03, guards AI +0.03 | tak/tak · tak/tak · tak/wip/wip |
| compound-four | 3.57 | 8.63 | 3.69 | 8.61 | 3.80 | 8.95 | +0.23 | +0.32 | animation +0.15, box upload +0.05, chars to GPU +0.05 | wip/tak · wip/tak · tak/tak/wip |
| barracks-four | 3.47 | 8.13 | 3.53 | 8.13 | 3.90 | 8.78 | +0.43 | +0.64 | animation +0.19, line tests +0.15, box upload +0.04, chars to GPU +0.04 | tak/tak · tak/tak · tak/tak/tak |
| rescue-registry | 1.85 | 5.92 | 1.84 | 5.55 | 2.37 | 7.26 | +0.52 | +1.34 | animation +0.17, box upload +0.07, squad +0.06, chars to GPU +0.06 | los/los · los/los · res/res/res |

At 25e5e7c the tool runs with nothing switched on: that build has no frag table and no cast module, and four of the tool's 42 marks (the pair's two, the door tools' menu, the frag tick) find nothing there, as expected. Seeds 1 and 2, taken in one sitting with the middle columns; the shipped columns are the headline take's three seeds.

- **25e5e7c and a7ce1d6 with the night's features off are the same game at the same cost (M).** All 26 runs have the same digest in both. Pooled over the same 140,145 frames the frame is 2.82 ms at 25e5e7c and 2.86 ms at a7ce1d6 (+1.4 %, inside the noise), and no system column differs by more than 0.01 ms. So the night's merges added no CPU cost outside their switches.
- **With the features on, as shipped, the pooled frame is 3.16 ms: +0.3 ms, about +11 % (M).** Per mission that is −0.12 to +0.58 ms on the mean and −0.24 to +1.83 on the p99. By column, pooled: animation +0.15 ms, line tests +0.05, characters → skin instances +0.035, the box upload +0.02, guards AI +0.02, gear +0.005. Animation and skin instances are the motion pass and the cast, as measured above. The rest is **I**: with the features on the runs play out to other lengths and endings (and the shipped row has a third seed), so those columns see another game, not new code.

## What a frame asks of a GPU (C)

*Build: a7ce1d6 shipped, seeds 1 and 2, unless a table says otherwise.* Window 1728 × 1000 CSS pixels at ×2, quality high pinned. **The window is my assumption** (a 16-inch MacBook Pro browser window); `--view 1512x860@2` or any other re-counts it. At high that renders 1330 × 770 internally and resolves to 1728 × 1000.

"Threads" is compute-shader invocations: workgroups × workgroup size, summed over a pass's dispatches. It is the nearest thing to a cost a count can give, and it is a poor one: a `softblur` thread does a few texture reads and a `direct` thread traces shadow rays through the scene. **Ranking passes by threads is I, not M.**

| mission | arm | internal | compute passes | render passes | dispatches | threads M (max) | raster texels M | triangles k (max) | KB rewritten (max) | write calls | textures MB peak |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| solo-night | shipped | 1330×770 | 20.2 | 5.0 | 55 | 19.10 (35.2) | 7.94 | 185 (198) | 201 (266) | 30 | 441 |
| night-breach | shipped | 1330×770 | 20.1 | 5.0 | 55 | 19.30 (43.2) | 7.94 | 184 (190) | 203 (251) | 29 | 441 |
| room-clear-pair | shipped | 1330×770 | 21.4 | 5.0 | 61 | 21.87 (36.2) | 7.94 | 173 (240) | 203 (261) | 31 | 512 |
| room-clear-four | shipped | 1330×770 | 21.4 | 5.0 | 62 | 22.29 (45.0) | 7.94 | 204 (292) | 216 (291) | 31 | 512 |
| hostage-rescue | shipped | 1330×770 | 21.5 | 5.0 | 66 | 22.94 (49.6) | 7.94 | 172 (239) | 218 (279) | 32 | 512 |
| records-pair | shipped | 1330×770 | 21.5 | 5.0 | 65 | 22.58 (41.7) | 7.94 | 149 (228) | 131 (184) | 32 | 512 |
| depot-four | shipped | 1330×770 | 21.4 | 5.0 | 65 | 22.94 (49.8) | 7.94 | 226 (289) | 140 (185) | 31 | 512 |
| block-four | shipped | 1330×770 | 21.7 | 5.0 | 74 | 24.63 (45.9) | 7.94 | 248 (366) | 151 (203) | 32 | 512 |
| block-squads | shipped | 1330×770 | 21.4 | 5.0 | 69 | 23.73 (53.9) | 7.94 | 308 (445) | 162 (217) | 31 | 512 |
| warehouse-four | shipped | 1330×770 | 21.3 | 5.0 | 59 | 21.61 (41.1) | 7.94 | 344 (456) | 184 (241) | 31 | 512 |
| compound-four | shipped | 1330×770 | 21.4 | 5.0 | 63 | 22.48 (44.3) | 7.94 | 305 (454) | 181 (234) | 31 | 512 |
| barracks-four | shipped | 1330×770 | 21.3 | 5.0 | 60 | 21.87 (52.3) | 7.94 | 325 (450) | 198 (251) | 31 | 512 |
| rescue-registry | shipped | 1330×770 | 21.3 | 5.0 | 61 | 21.95 (33.9) | 7.94 | 168 (235) | 106 (165) | 31 | 512 |

### The scene behind those counts (C)

| mission | arm | static boxes | lights live | characters | dynamic boxes | particles | decals | smoke domains | panes listed | panes hit | debris | character model |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| solo-night | shipped | 782 | 37.0 / 47 | 6.0 / 6 | 313.2 / 319 | 5063.5 / 11348 | 2.2 / 7 | 0.3 / 4 | 22.0 / 22 | 0.6 / 3 | 0.0 / 0 | cast: 27164 tris, 53 joints |
| night-breach | shipped | 782 | 34.2 / 39 | 6.0 / 6 | 378.0 / 393 | 3774.4 / 7059 | 0.3 / 4 | 0.2 / 6 | 22.0 / 22 | 0.0 / 0 | 0.1 / 1 | cast: 27164 tris, 53 joints |
| room-clear-pair | shipped | 782 | 34.9 / 40 | 5.7 / 8 | 358.8 / 397 | 2934.1 / 7059 | 1.7 / 4 | 0.8 / 5 | 22.0 / 22 | 0.0 / 0 | 1.4 / 3 | cast: 27164 tris, 53 joints |
| room-clear-four | shipped | 782 | 35.4 / 40 | 6.8 / 10 | 389.1 / 425 | 2575.2 / 7059 | 1.3 / 4 | 0.9 / 8 | 22.0 / 22 | 0.2 / 1 | 1.0 / 3 | cast: 27164 tris, 53 joints |
| hostage-rescue | shipped | 782 | 34.8 / 39 | 5.6 / 8 | 377.0 / 401 | 3956.9 / 6673 | 7.2 / 12 | 1.4 / 8 | 22.0 / 22 | 1.7 / 2 | 21.4 / 38 | cast: 27164 tris, 53 joints |
| records-pair | shipped | 229 | 18.0 / 21 | 5.0 / 8 | 139.9 / 180 | 3929.8 / 5500 | 8.7 / 21 | 1.1 / 5 | 7.0 / 7 | 0.8 / 1 | 1.0 / 3 | cast: 27164 tris, 53 joints |
| depot-four | shipped | 258 | 15.8 / 24 | 7.9 / 10 | 174.8 / 198 | 3988.7 / 7150 | 10.8 / 24 | 1.2 / 8 | 4.0 / 4 | 0.0 / 0 | 1.3 / 3 | cast: 27164 tris, 53 joints |
| block-four | shipped | 254 | 15.7 / 20 | 8.7 / 13 | 235.3 / 269 | 3113.5 / 3753 | 1.9 / 4 | 2.1 / 7 | 4.0 / 4 | 0.0 / 0 | 1.0 / 2 | cast: 27164 tris, 53 joints |
| block-squads | shipped | 254 | 14.9 / 21 | 10.9 / 16 | 243.1 / 282 | 3454.8 / 7056 | 14.4 / 28 | 1.7 / 8 | 4.0 / 4 | 0.0 / 0 | 2.5 / 4 | cast: 27164 tris, 53 joints |
| warehouse-four | shipped | 426 | 20.0 / 27 | 12.0 / 16 | 265.4 / 299 | 4898.0 / 7675 | 11.3 / 19 | 0.6 / 6 | 3.0 / 3 | 0.0 / 0 | 2.1 / 3 | cast: 27164 tris, 53 joints |
| compound-four | shipped | 371 | 14.2 / 19 | 10.7 / 16 | 283.9 / 311 | 3405.5 / 5973 | 6.8 / 10 | 1.1 / 7 | 0.0 / 0 | 0.0 / 0 | 0.6 / 1 | cast: 27164 tris, 53 joints |
| barracks-four | shipped | 549 | 16.0 / 23 | 11.2 / 16 | 290.2 / 330 | 5128.5 / 7541 | 15.1 / 33 | 0.7 / 8 | 12.0 / 12 | 0.0 / 0 | 2.0 / 3 | cast: 27164 tris, 53 joints |
| rescue-registry | shipped | 297 | 8.7 / 12 | 5.7 / 8 | 145.4 / 160 | 4471.8 / 6225 | 0.5 / 1 | 0.9 / 5 | 7.0 / 7 | 0.0 / 0 | 0.5 / 1 | cast: 27164 tris, 53 joints |

### Passes, all missions pooled (C)

| pass | kind | runs a frame | threads M | share | raster texels M | triangles k | most threads in | M |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| softblur | compute | 1.00 | 5.20 | 23.7% |  |  | solo-night | 5.20 |
| bloom | compute | 1.00 | 2.01 | 9.2% |  |  | solo-night | 2.01 |
| smoke | compute | 0.35 | 1.95 | 8.9% |  |  | block-four | 4.42 |
| gbuffer | render | 1.00 |  |  | 1.73 | 254.6 |  |  |
| sharpU | compute | 1.00 | 1.73 | 7.9% |  |  | solo-night | 1.73 |
| compS | compute | 1.00 | 1.73 | 7.9% |  |  | solo-night | 1.73 |
| particlesDraw | render | 1.00 |  |  | 1.73 | 8.4 |  |  |
| gbaa | compute | 1.00 | 1.73 | 7.9% |  |  | solo-night | 1.73 |
| taau | compute | 1.00 | 1.73 | 7.9% |  |  | solo-night | 1.73 |
| post | render | 1.00 |  |  | 1.73 | 0.0 |  |  |
| fxaa | render | 1.00 |  |  | 1.73 | 0.0 |  |  |
| fogofwar | compute | 0.87 | 1.51 | 6.9% |  |  | room-clear-pair | 1.73 |
| rdenoise | compute | 1.00 | 1.05 | 4.8% |  |  | solo-night | 1.05 |
| direct | compute | 1.00 | 1.04 | 4.7% |  |  | solo-night | 1.04 |
| gdown | render | 1.00 |  |  | 1.02 | 0.0 |  |  |
| temporal | compute | 1.00 | 0.83 | 3.8% |  |  | solo-night | 0.83 |
| meshShadows | compute | 1.00 | 0.57 | 2.6% |  |  | block-squads | 0.63 |
| reflect | compute | 1.00 | 0.26 | 1.2% |  |  | solo-night | 0.26 |
| volumetrics | compute | 1.00 | 0.26 | 1.2% |  |  | solo-night | 0.26 |
| gather | compute | 1.00 | 0.12 | 0.5% |  |  | solo-night | 0.12 |
| rc c1 | compute | 1.00 | 0.07 | 0.3% |  |  | solo-night | 0.07 |
| rc c0 | compute | 1.00 | 0.07 | 0.3% |  |  | solo-night | 0.07 |
| rc c3 | compute | 1.00 | 0.04 | 0.2% |  |  | solo-night | 0.04 |
| rc c2 | compute | 1.00 | 0.04 | 0.2% |  |  | solo-night | 0.04 |
| rc dice | compute | 1.00 | 0.00 | 0.0% |  |  | solo-night | 0.00 |
| particles | compute | 1.00 | 0.00 | 0.0% |  |  | barracks-four | 0.01 |
| probe | compute | 1.00 | 0.00 | 0.0% |  |  | block-four | 0.00 |

### Buffers the CPU rewrites every frame (C)

| buffer | KB a frame | calls a frame | max KB in a frame |
|---|---:|---:|---:|
| boxMat | 50.3 | 1.10 | 93.2 |
| jointMats | 36.2 | 1.00 | 64.0 |
| boxGeo | 24.2 | 1.00 | 37.7 |
| gridItems | 16.4 | 1.00 | 22.8 |
| decals | 15.4 | 0.35 | 44.4 |
| gridCells | 13.1 | 1.00 | 13.1 |
| lightReach | 6.0 | 1.00 | 12.9 |
| restirU | 4.2 | 1.00 | 4.2 |
| capsules | 3.3 | 1.00 | 3.8 |
| visibleBoxes | 2.9 | 1.00 | 4.5 |
| sceneInfo | 2.4 | 1.00 | 2.4 |
| lights | 1.4 | 1.00 | 2.9 |
| smokeSimParams | 1.0 | 0.48 | 8.3 |
| charInsts | 0.8 | 1.00 | 1.5 |
| particleEmits | 0.8 | 3.00 | 4.5 |
| frame | 0.8 | 1.00 | 0.8 |
| frameOut | 0.8 | 1.00 | 0.8 |
| probeQueries | 0.7 | 1.00 | 1.6 |
| fogofwar | 0.1 | 0.87 | 0.2 |
| taauParams | 0.1 | 1.00 | 0.1 |
| dnParams | 0.1 | 1.00 | 0.1 |
| dnParamsRefl | 0.1 | 1.00 | 0.1 |

`boxMat` and `boxGeo` are the whole box list, rewritten every frame whether or not a box moved (74 + 37 KB in the 782-box office levels). `jointMats` is every character's joint palette (64 KB with 16 men up). The decal list is rewritten whole (44 KB) on the frames a mark lands.

Textures held at the peak: 441 MB in the two missions without the fog of war, 512 MB with it (**C**). The smoke solver's volumes are 112 MB of that (five at 16 MB, four at 8 MB). The fog of war's own copy is 13 MB; the other 53 MB is a second set of four output-size targets (`hdr`, `hdrCopy`, `sharpE0`, `sharpE1`) made when the fog switches on while the first set is still held. Whether the page lets the first set go afterwards is not something this count shows: a claim for the drawing part to check.

Under the recording device a smoke domain retires earlier than on the page (its mass comes back by a readback that never answers here), so smoke domain time, and with it the smoke pass's share, is a **lower bound**.

### Characters: the cast against the mannequin (C)

| | triangles | vertices | joints | parts |
|---|---:|---:|---:|---:|
| the cast | 27,164 | 22,208 | 53 | 31 |
| the mannequin | 13,743 | 8,547 | 53 | 1 |

A cast character is 2.0 times the triangles and 2.6 times the vertices of the mannequin on the same skeleton (**C**). With the same head count that shows where expected (shipped is seeds 1 and 2, the mannequin seed 1): the g-buffer draws 176 k triangles a frame against 96 k in night-breach (six characters) and 334 k against 174 k in warehouse-four (twelve); the mesh-shadow pass, which skins every character and refits its shadow tree, asks for 0.49 M threads against 0.25 M and 0.63 M against 0.32 M (**C**). The joint upload does not change (same joints). Characters are 88 to 96 % of all triangles drawn; the level's boxes are 4 to 14 k.

### Everything on, and the harness (all features off), four missions, seed 1 (C)

| mission | arm | internal | compute passes | render passes | dispatches | threads M (max) | raster texels M | triangles k (max) | KB rewritten (max) | write calls | textures MB peak |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| night-breach | everything | 1330×770 | 20.1 | 5.0 | 55 | 19.26 (43.2) | 7.94 | 189 (201) | 201 (250) | 29 | 441 |
| block-four | everything | 1330×770 | 21.6 | 5.0 | 79 | 25.76 (49.9) | 7.94 | 287 (447) | 162 (225) | 32 | 512 |
| hostage-rescue | everything | 1330×770 | 21.6 | 5.0 | 68 | 23.45 (37.1) | 7.94 | 197 (244) | 225 (276) | 32 | 512 |
| warehouse-four | everything | 1330×770 | 21.3 | 5.0 | 59 | 21.77 (41.3) | 7.94 | 345 (466) | 186 (238) | 31 | 512 |
| night-breach | harness | 1330×770 | 20.1 | 5.0 | 56 | 19.28 (39.7) | 7.94 | 103 (110) | 203 (251) | 29 | 441 |
| block-four | harness | 1330×770 | 21.6 | 5.0 | 80 | 25.73 (41.5) | 7.94 | 104 (162) | 136 (187) | 31 | 512 |
| hostage-rescue | harness | 1330×770 | 21.6 | 5.0 | 70 | 23.66 (39.8) | 7.94 | 85 (91) | 193 (246) | 31 | 512 |
| warehouse-four | harness | 1330×770 | 21.2 | 5.0 | 58 | 21.26 (48.0) | 7.94 | 183 (241) | 184 (235) | 31 | 512 |

| mission | arm | static boxes | lights live | characters | dynamic boxes | particles | decals | smoke domains | panes listed | panes hit | debris | character model |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| night-breach | everything | 782 | 33.2 / 38 | 6.0 / 6 | 366.1 / 381 | 6611.8 / 12706 | 0.3 / 4 | 0.2 / 6 | 22.0 / 22 | 0.0 / 0 | 0.1 / 1 | cast: 27164 tris, 53 joints |
| block-four | everything | 254 | 15.5 / 21 | 10.1 / 16 | 242.7 / 315 | 4233.7 / 5770 | 5.2 / 8 | 2.7 / 8 | 4.0 / 4 | 0.0 / 0 | 0.8 / 1 | cast: 27164 tris, 53 joints |
| hostage-rescue | everything | 782 | 34.3 / 38 | 6.4 / 8 | 350.6 / 364 | 4683.8 / 8660 | 5.5 / 9 | 1.5 / 5 | 22.0 / 22 | 1.4 / 2 | 0.5 / 1 | cast: 27164 tris, 53 joints |
| warehouse-four | everything | 426 | 19.0 / 25 | 11.8 / 16 | 249.8 / 277 | 8061.8 / 13329 | 7.7 / 11 | 0.7 / 6 | 3.0 / 3 | 0.0 / 0 | 1.9 / 3 | cast: 27164 tris, 53 joints |
| night-breach | harness | 782 | 34.2 / 39 | 6.0 / 6 | 377.9 / 393 | 3776.7 / 7059 | 0.3 / 4 | 0.3 / 6 | 22.0 / 22 | 0.0 / 0 | 0.1 / 1 | mannequin: 13743 tris, 53 joints |
| block-four | harness | 254 | 15.5 / 20 | 6.7 / 11 | 224.6 / 262 | 3140.3 / 3529 | 1.3 / 2 | 2.5 / 7 | 4.0 / 4 | 0.0 / 0 | 0.6 / 1 | mannequin: 13743 tris, 53 joints |
| hostage-rescue | harness | 782 | 34.5 / 40 | 5.0 / 5 | 355.2 / 372 | 1892.2 / 4795 | 9.4 / 15 | 1.8 / 7 | 22.0 / 22 | 0.0 / 0 | 0.0 / 0 | mannequin: 13743 tris, 53 joints |
| warehouse-four | harness | 426 | 19.9 / 28 | 12.1 / 16 | 266.5 / 296 | 4831.3 / 7540 | 10.6 / 14 | 0.6 / 8 | 3.0 / 3 | 0.0 / 0 | 2.0 / 3 | mannequin: 13743 tris, 53 joints |

### What the night added on the GPU side, over 25e5e7c (C)

| mission | arm | internal | compute passes | render passes | dispatches | threads M (max) | raster texels M | triangles k (max) | KB rewritten (max) | write calls | textures MB peak |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| night-breach | harness | 1330×770 | 20.1 | 5.0 | 56 | 19.28 (39.7) | 7.94 | 103 (110) | 203 (251) | 29 | 441 |
| block-four | harness | 1330×770 | 21.6 | 5.0 | 80 | 25.73 (41.5) | 7.94 | 104 (162) | 136 (187) | 31 | 512 |
| hostage-rescue | harness | 1330×770 | 21.6 | 5.0 | 70 | 23.66 (39.8) | 7.94 | 85 (91) | 193 (246) | 31 | 512 |
| warehouse-four | harness | 1330×770 | 21.2 | 5.0 | 58 | 21.26 (48.0) | 7.94 | 183 (241) | 184 (235) | 31 | 512 |

At 25e5e7c these four missions play the same runs as a7ce1d6 with the features off (same digests), and the frame asks the GPU for exactly the same work: every pass's thread count, the triangles, the textures and the buffers are equal to the last digit (**C**). The table above is therefore also the "harness" rows of the table before it. So everything the night added on the GPU side sits behind its switches:

- **The cast**: twice the triangles in the g-buffer and twice the skinning in the mesh-shadow pass (see the characters section), and one more small buffer for its materials (`charMats`).
- **Glass parts**: no new pass, texture or buffer (**C**). They change the text of shaders that already run (a cell test inside the glass trace), which a count cannot see. What that costs a ray on his Mac is not known here.
- **The motion pass, the turn weight, the defenders' frags**: nothing of their own on the GPU. Frags show up only as the smoke, dust, decals and particles they cause, which differs run to run.
- Compute threads a frame as shipped against 25e5e7c on the same four missions: 19.3 against 19.3 M, 24.6 against 25.7, 22.9 against 23.7, 21.6 against 21.3 (**C**). Those are differences of smoke between runs, not of passes.

### Destruction's dust: a claim I could only count

The destruction goal's page estimates about +2 ms at high while a burst's dust hangs. That is a GPU time and cannot be checked here. What can be counted: every live smoke domain costs the solver about 2.1 M compute threads a frame on average, 4.0 M on a frame it steps (**C**), against about 20 M for all the rest of a frame. Missions held 0.2 to 2.1 live domains on average and 4 to 8 at the worst moment, and the busiest single frame asked the solver for 13.6 to 33.6 M threads (**C**). Dust puffs open or feed those domains (up to six by `puffDomains`). The +2 ms was about shadow and gather rays sampling the extra domains, which a count cannot see. On dee9595 with destruction on (one seed, **C**), The block held 3.4 live domains on average against 2.3 with it off and asked for 29.0 M threads a frame against 25.1 M; the other missions did not move. So: not confirmed, not refuted; the solver's share alone says hanging dust can double a frame's compute work, and it wants a real timing on his Mac.

## Worst single frames (M)

*Build: a7ce1d6 shipped, both takes.* The first 60 frames of every run are apart: their worst is 216 to 347 ms (**M**), the first frames after the stand-up, when the engine compiles the code it is running for the first time (**I**).

| mission | seed | game s | ms | top buckets |
|---|---:|---:|---:|---:|
| solo-night | 1 | 4.9 | 148.72 | squad: door tools 125.25; doors 20.53; step: box list pack + trace grid (world.upload) 0.83 |
| solo-night | 1 | 39.2 | 116.18 | svc: animation + skeleton (Character.update) 73.61; weather, wet, wind, moths, rain fx (game half) 41.07; step: box list pack + trace grid (world.upload) 0.51 |
| night-breach | 1 | 22.5 | 17.99 | svc: animation + skeleton (Character.update) 14.50; step: box list pack + trace grid (world.upload) 0.77; tactics (flank, lone corner, doorways) 0.75 |
| night-breach | 2 | 20.4 | 15.43 | squad: door tools 6.51; guards: updateGuard (senses, state, feet) 2.15; svc: animation + skeleton (Character.update) 1.36 |
| room-clear-pair | 1 | 1.4 | 27.47 | svc: animation + skeleton (Character.update) 24.64; step: box list pack + trace grid (world.upload) 0.63; guards: updateGuard (senses, state, feet) 0.54 |
| room-clear-pair | 3 | 21.6 | 19.92 | svc: nav paths (A*, walkable, nearest free) 11.47; tactics (flank, lone corner, doorways) 2.60; svc: animation + skeleton (Character.update) 1.80 |
| room-clear-four | 3 | 25.9 | 24.26 | characters → skin instances + shadow proxies 20.77; svc: animation + skeleton (Character.update) 1.13; step: box list pack + trace grid (world.upload) 0.71 |
| room-clear-four | 2 | 1.4 | 23.72 | step: box list pack + trace grid (world.upload) 18.70; fixtures + devices 1.65; svc: animation + skeleton (Character.update) 1.18 |
| hostage-rescue | 2 | 2.6 | 25.95 | characters → skin instances + shadow proxies 22.07; svc: animation + skeleton (Character.update) 1.05; step: box list pack + trace grid (world.upload) 0.62 |
| hostage-rescue | 3 | 2.6 | 23.48 | characters → skin instances + shadow proxies 19.73; svc: animation + skeleton (Character.update) 1.01; svc: static line tests (sight, fire, reach) 0.63 |
| records-pair | 1 | 6.4 | 31.80 | svc: animation + skeleton (Character.update) 30.00; guards: updateGuard (senses, state, feet) 0.36; step: box list pack + trace grid (world.upload) 0.29 |
| records-pair | 2 | 41.7 | 22.81 | svc: static line tests (sight, fire, reach) 11.45; svc: nav paths (A*, walkable, nearest free) 5.52; squad: door tools 3.50 |
| depot-four | 1 | 21.7 | 37.72 | svc: static line tests (sight, fire, reach) 33.15; squad: order menu + orders 1.55; svc: animation + skeleton (Character.update) 1.37 |
| depot-four | 3 | 10.2 | 33.73 | characters → skin instances + shadow proxies 30.08; svc: animation + skeleton (Character.update) 1.42; dynamic boxes (leaves, props, debris, rig props, fx) 0.36 |
| block-four | 3 | 83.8 | 22.94 | svc: static line tests (sight, fire, reach) 16.73; squad: door tools 2.21; svc: nav paths (A*, walkable, nearest free) 1.79 |
| block-four | 2 | 8.4 | 22.42 | characters → skin instances + shadow proxies 18.26; svc: animation + skeleton (Character.update) 1.48; dynamic boxes (leaves, props, debris, rig props, fx) 0.56 |
| block-squads | 2 | 11.5 | 54.97 | svc: nav paths (A*, walkable, nearest free) 38.88; scenario (director, breach, room clear, rescue) 6.31; svc: static line tests (sight, fire, reach) 4.28 |
| block-squads | 1 | 10.9 | 54.91 | svc: nav paths (A*, walkable, nearest free) 40.20; scenario (director, breach, room clear, rescue) 5.14; svc: static line tests (sight, fire, reach) 3.71 |
| warehouse-four | 1 | 27.0 | 60.94 | svc: nav paths (A*, walkable, nearest free) 23.43; svc: static line tests (sight, fire, reach) 15.80; scenario (director, breach, room clear, rescue) 10.38 |
| warehouse-four | 1 | 85.9 | 32.52 | svc: animation + skeleton (Character.update) 18.80; svc: static line tests (sight, fire, reach) 12.15; step: box list pack + trace grid (world.upload) 0.42 |
| compound-four | 2 | 14.2 | 54.81 | svc: nav paths (A*, walkable, nearest free) 35.19; scenario (director, breach, room clear, rescue) 7.54; svc: static line tests (sight, fire, reach) 5.48 |
| compound-four | 1 | 11.3 | 49.17 | characters → skin instances + shadow proxies 44.20; svc: animation + skeleton (Character.update) 1.69; step: box list pack + trace grid (world.upload) 0.87 |
| barracks-four | 2 | 31.7 | 45.04 | svc: static line tests (sight, fire, reach) 40.47; svc: animation + skeleton (Character.update) 1.84; step: box list pack + trace grid (world.upload) 0.75 |
| barracks-four | 3 | 19.0 | 36.62 | svc: nav paths (A*, walkable, nearest free) 22.87; scenario (director, breach, room clear, rescue) 4.87; svc: static line tests (sight, fire, reach) 3.75 |
| rescue-registry | 2 | 33.4 | 33.21 | svc: animation + skeleton (Character.update) 31.64; step: box list pack + trace grid (world.upload) 0.36; dynamic boxes (leaves, props, debris, rig props, fx) 0.21 |
| rescue-registry | 3 | 13.7 | 25.44 | characters → skin instances + shadow proxies 20.58; svc: animation + skeleton (Character.update) 1.31; dynamic boxes (leaves, props, debris, rig props, fx) 0.73 |

Each JSON keeps a mission's three worst frames, so "both takes" below means it was among the three worst in both. Reading the two takes side by side (**M**, then **I** for the cause):

- **"Characters → skin instances" at 13 to 44 ms** (64.5 ms once, in the take with the disturbed rescue-registry row). Depot-four seed 3 at 10.2 s and rescue-registry seed 3 at 13.7 s are in both takes, so it is the game's own work, not the runtime. It is the per-outfit rig fit: `src/game/game.ts:1270` calls `fitRig(this.ch, c.parts)` the first time a cast part mask is drawn ("solved once per mask, ~10 ms" by its own comment); the V8 profile has `fitRig`'s inner loop (`src/render/sdfrig.ts`) at 130 to 200 ms a run, spent in a handful of frames. **I**: every new outfit that walks on screen is a dropped frame or two.
- **Path-finding at 11 to 40 ms, inside frames of 20 to 63 ms**, repeats exactly: block-squads at 10.9 to 11.5 s on all three seeds in both takes, compound-four at 13.9 to 14.2 s, warehouse-four at 26.4 to 27.7 s, barracks-four at 19.0 to 19.4 s; block-four seed 3 has two more at 22.2 and 38.6 s. The scenario bucket is 5 to 10 ms in most of the same frames (it is normally 0.02), so **I**: it is the room clear's own planning asking for many long paths at once (`NavGrid.findPath`, reached from `src/game/` scenario and squad code). The tool does not say which caller.
- **Line tests at 11 to 40 ms in one frame**: block-four seed 3 at 83.8 s in both takes (17 and 19 ms, with door tools at 2.2 and 2.6 in the same frame); depot-four seed 1 at 21.7 s (33 ms, with the order menu at 1.5) and barracks-four seed 2 at 31.7 s (40 ms) in one take each; warehouse-four's path-finding frame at 27.0 s carries 16 to 17 ms of them in both. **I**: a squad order or a door tool that sweeps many sight lines in one frame; the tool does not name the caller.
- **One-off frames that move between takes** (solo-night 235 ms in one take under the box upload, 149 ms in the other under door tools; an animation frame of 10 to 74 ms here and there; "fixtures + devices" at 46 ms once): **I** the runtime pausing (a collection or a compile) under whichever code was running. They are real for this box and say little about the page.

## Calls I made, and what is not here

Calls (defaults I picked, his to change):

- The window for the GPU counts is 1728 × 1000 at ×2, quality high pinned.
- "As shipped" is the harness's own switches for what the page opens with: cast, motion pass, turn weight, glass parts, defenders' frags, chaos 0.5, and destruction on a build that has it (dee9595 on). The table under "Which build, which switches" has the exact line.
- The headline stays a7ce1d6. The build to play moved while this page was being written; dee9595 has its own section rather than a second copy of every table, because with destruction off it plays the same games as a7ce1d6 (36 of 36 digests) and with it on the frame costs the same.
- "Everything on" is a downpour + dusk + enemies up to 11 defenders. Other weathers and hours were not swept.
- Three seeds for the headline, two for the picks and the features, one under V8 and for the GPU counts of the picks.

Not here:

- Any GPU time. Nothing on this page says how long a pass takes on his Mac.
- What the page's CPU pays that the harness never runs: the HUD and its DOM writes, speech bubbles, the Tab panel, audio mixing, the recorder. None of it is measured here.
- What a real graphics driver does with each upload and each pass. `--gpu` times the engine's JavaScript against stand-in calls, so that half is a floor.
- Frame pacing on the page (vsync, the browser's own work).
- The native Mac app: retired for now (the maintainer, 15:35Z), so nothing of it was measured.
- Chrome's own collector. The V8 numbers are node's (22 and 24); Chrome's V8 is newer still, packs its heap tighter and can collect in idle time between frames.
- Which caller asks for the path-finding and line-test bursts.

Claims passed to the performance thread for the two cutting parts: the headless-only light estimate, the allocation sites, the fog of war's share of line tests, the per-outfit rig fit, the box list rewritten whole every frame, the second set of output-size targets under the fog of war; and, after the build moved, what `Math.hypot` leaves behind on each V8, and what destruction costs on dee9595.
