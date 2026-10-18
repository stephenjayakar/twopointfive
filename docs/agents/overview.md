# Overview

One of the area files CLAUDE.md indexes. Everything below was moved here word for word from CLAUDE.md on 2026-10-13, in its old order;
"the bullet above / below" in a bullet means its neighbour there (each block says which lines it was), and a bullet named by its bold
title may now live in another file of this folder: `grep -l '<title>' docs/agents/*.md`. New bullets for this area go at the foot of this file.

<!-- was CLAUDE.md lines 2–15 -->

A 2.5D top-down **squad game** (since the 2026-10 rebuild: Sam + up to four AI teammates under an orders menu — see *What the game
is now* below; it grew out of a solo stealth **tech demo** whose touchstone was Splinter Cell: Chaos Theory, and that solo night is
still one mission) on **raw WebGPU/WGSL**:
box-only levels (the office + the squad levels under `levels/`) where every photon is dynamic (ray-traced direct light from sized emitters, a traced final
gather over a radiance-cascade cache, volumetric beams, an Eulerian GPU smoke solver), glTF characters (a modelled cast since the rebuild; `?mannequin` = the old mannequin) with
ragdolls, and guards that see/hear through the *same* light meter and sound propagation the player is shown.
Bun toolchain, **no npm dependencies** (TypeScript is vendored under `vendor/typescript`, gitignored).

## What the game is now (2026-10)

Every line checked against the code at 527a92a. The build is THE PAGE IN THE BROWSER (`bun run dev`); the Mac app (Swift + Metal) was removed 2026-10-11 and lives in git history.
- **A squad game.** Sam (the player) + 0‥4 AI teammates (`src/game/loadout.ts SquadSize`, `?squad=N`; `?squad4`), in pairs red / blue when four (`Guard.unit.pair`).

<!-- was CLAUDE.md lines 240–243 -->
- **Where the families live** (`src/game/`): SQUAD = orders.ts, pairorders.ts, silent.ts, unseen.ts, sneak.ts, spotted.ts, pairup.ts, squadsmoke.ts, shutdoor.ts, cover.ts, cleared.ts, roomread.ts, roomfit.ts, stackroom.ts, rearwatch.ts, entrypoints.ts,
  floorseen.ts, teamfeel.ts (the Tab rows), kit.ts + loadout.ts + slots.json, nvg.ts, irlaser.ts · DOORS = doors.ts, doortools.ts, doorpath.ts, doorway.ts, doorswing.ts, handleside.ts,
  doorblast.ts, shutdoor.ts · ROOM FIGHT (both sides of a room clear) = roomfight.ts, digin.ts, pressure.ts, laststand.ts, buddy.ts, enemysquads.ts, cues.ts, difficulty.ts, coverfire.ts,
  clearline.ts · GEAR = frag.ts, he40.ts, shotgun.ts, wallcharge.ts · DESTRUCTION = destruction.ts, destructionSwitch.ts, wallbreak.ts, wallreact.ts, furnblast.ts, glassbreak.ts, glasspen.ts, shards.ts.

<!-- was CLAUDE.md lines 367–396 -->
- **Modules with no bullet below** (one line each, from their head comments): blastFeel.ts (a wall charge going off: picture and sound) · blastLook.ts (a set charge and its blast: picture) ·
  buddy.ts (a lone defender radios for a buddy; `BUDDY.on`, ships off) · cast.ts (which man wears which variant of the character mesh) · clearline.ts (a teammate steps off a friend's
  line to shoot; `?clearline`, ships off) · coverfire.ts (aimed fire chews breakable cover) · destructionSwitch.ts (the one switch of the destruction goal; off in the module, on in
  the page) · doorblast.ts (a blast takes a door off its hinges) · doorway.ts (doorway manners: how men of one side share a doorway) · dustLook.ts / edgeLook.ts / wallwear.ts /
  fixtureBreak.ts / lookDecals.ts (destruction's look only: dust, a broken wall's edges, wear before it gives, a fixture seen to break, picture-only decals) · frag.ts (the
  fragmentation grenade and the one `blast()` for a fragmenting explosion; a burst that does not put the PLAYER down stuns him — `FRAG.samStun`: knocked, a frame flash, no round or throw for the `stagger` seconds a man there is folded, aim thrown wide, under god mode too; false = a flinch and a line as before, and a recording from before the key replays so; `probes.ts frag-player` (k) / (l); A BURST THAT TAKES A DOOR OFF STUNS THE MEN BEHIND IT (`FRAG.doorStun`, on; false = as it was, and a recording from before the key replays so; the maintainer, 10-11, a 40 mm on the compound's hut door: "40mm on door should maybe stun around the blast?"): everybody is judged on the burst's own frame, with the leaf it has just torn off still standing in its frame, so the man straight behind the door came out 'shielded' and shot back a second later; now a man — anybody's, the player too — the burst has no line to ONLY for leaves this burst took off (asked again with those leaves out of `col.dynamicBoxes`) is `BlastResult 'stunned'`: the wound band's own fold (`stagger` by distance, inside `woundM`; the player by `samStun`), never a kill, counted in `BlastReport.stunned` / `FRAG_STATS.stunned` (men; the player is `BlastReport.player`), and the log line ends ', N stunned behind the door' for the men of them an eye of his side has a line to through the opening (never a civilian, who only flinches); leaves torn earlier on the same tick count too (`TORN`, per Game). AND BEFORE THE BURST a door it would take is no cover to a man reckoning his own: `exposedTo(g, from, feet, head)` = `exposure()`, asked again without the leaves `Destruction.doorsFor(at, {radius})` says a blast there takes (doorblast.ts `doorBlastReach` = `doorBlast`'s own filter, nothing torn) — who runs from a grenade and where to, the player's step-off cue, a defender's 'none of mine in it' (`ownClear`), doortools.ts `fragBehind`; a new reader of 'is he in cover from this grenade' asks `exposedTo`, a judge of a burst that has gone off asks `exposure`. A wall, a jamb, a leaf left hanging shield as ever; nothing of it where blasts take no doors off: `Destruction.blast` returns first with `DESTRUCTION.on` off or chaos 0 (the frozen stand, where a play-through raises chaos but not the switch), or `DOORBLAST.on` off; a door charge and a wall charge do not come through `blast()` and are as they were; `bun run tools/qa/doorstun-check.ts` = `probes.ts doorstun`, also under `frag` / `he40` / `off-hinges`, both stands, `DOORSTUN_BREAK=1` must fail; play-throughs count it apart (`teamStunned` / `ownStunned`); never seen on a GPU. A BURST THAT HOLES A WALL OR BREAKS COVER STUNS THE MEN BEHIND IT TOO (`FRAG.wallStun`, on; false = as it was, and a recording from before the key replays so; the maintainer's card, 10-13, from his replay dump: his own 40 mm killed a teammate 4 m inside the break room through drywall it had just holed): `Destruction.blast` opens the wall inside the burst's own call and the men were judged after it, through the hole; now `blast()` asks everybody's `exposure()` BEFORE that call (after the glass, which stays the burst's by its own rule) and judges on it — a man it had no line to then and has one to now is `'stunned'` with `BlastHit.behind 'cover'` (a torn door's is `'door'`), never killed; a man who showed a part of himself is judged on the part that showed; the NEXT burst — a frame later, or a second charge on the same tick (`Defuse.blow`) — is judged through the hole; a pane only the engine's own glass arrival takes (after the snapshot; reachable only with `FRAG.glassPower` turned well down) reads as cover the burst broke. The log line ends ', N stunned behind what it broke', the player's reads 'the blast broke through your cover'. Asked only with `DESTRUCTION.on` at chaos > 0 (inert on the frozen stand's play-throughs; `PT_DESTR=1` tallies move, `--set '{"FRAG":{"wallStun":false}}'` = as recorded before); a man reckoning his cover BEFORE a burst (`exposedTo`) still counts a wall it would hole as cover. `bun run tools/qa/wallstun-check.ts` = `probes.ts wallstun`, also under `frag` / `he40`, both stands, `WALLSTUN_BREAK=1` must fail; never seen on a GPU) · furnblast.ts (furniture thrown and broken by a blast; `?nofurnblast`; what it broke rides checkpoints as the optional slice `furn`, the pieces do not — `probes.ts furnblast-save`; A BLOWN HOLE IS CLEARED (`FURN.mouth`: on in the page, `?holeclear=0`; frozen stand off, `TPS_HOLECLEAR=1`, a `FROZEN_HOLDS` row; a recording from before the key replays with it off): after the bands have had their say, what still stands in a walking body's way in either mouth of a hole a blast opened — the stretch open from the floor up (`wallbreak.ts sillOpenIn`), `depth` 0.9 m out from each face — goes with it whoever owns it: the stretch of a cover piece the wall shielded from the burst (`walls.razeIn`), furniture too heavy for the bands, a thing under a roof neither engine lists (a counter in white, shelving on legs) and all that rests on it — or, something up there being a light's or fixture's box, none of it; never taller than `top` 2.3 m / over `vol` 3 m³, a structure paint but white, a post, the breaker, the mission's thing; an unlisted thing goes WHOLE; those ride the save slice as `furn.m`. A vending machine or a server rack still stands in a hole. `probes.ts blasthole` (tools/qa/blasthole-check.ts, in family `furnblast`: a 40 mm on both faces of every inside wall of twelve levels, a body walked through each hole; `BLASTHOLE_BREAK=1` must fail)) · he40.ts (the FN2000's 40 mm
  round) · kit.ts (each member's kit and uniform, kept per machine) · loadout.ts (how many teammates come: pure, `?squad=N`) · pairorders.ts / pairup.ts / spotted.ts (two-person
  stealth: quiet orders for one partner, the switch over its parts, what he does once spotted; `?pair`, ships off) · sandbox.ts (the start card's god / no AI / ammo row) ·
  rearwatch.ts (the stack's rear man is pinned to the open door at the stack's back from the stack through the boot / the can / the shove, then follows last on his turn or is the
  one left outside (`REARWATCH.hold`, off: kept on it until the others are through the frame — measured to cost men); a pair only while the stack waits; `REARWATCH.on`, ships on, `?norearwatch`, `TPS_REARWATCH` — off = the unasked cover's deal and every gun on the door, as before;
  a formed stack hands out no NEW watch until the door is going, and then only behind a can — a watch given at the entry order was taken back a quarter second later;
  the man who HAS the watch keeps it over the entry order whatever place the new file gives him (not the lead; the man the doorway's manners sent to the open door has it again
  when he comes up); `REARWATCH.short` 1.5 s = a rear man that long within a stride of his mark and not on it is let off until he is (gun behind him he ground on a leaf's edge and the stack never formed);
  `bun run tools/qa/rearwatch-check.ts [id …] [--max N] [--verbose] [--case door:side:other [--in-turn]]` = every squad level, each door face with another door of the floor
  open, rule on against off, red on a rear watch given and taken back inside a second; it stands AS SHIPPED unless `TPS_PROFILE=frozen` is in front — the frozen stand holds the rule
  off and the door rules its staged-open leaves need, so asked there the check raises `QA_DOORSTAY` and `ONEWAY` itself: four cases were red for the staging alone); A TAKEN ROOM'S OTHER DOOR IS KEPT OVER 'FALL IN'
  (`REARWATCH.room`, ships on, `?noroomkeep`, `TPS_ROOMKEEP`, a `FROZEN_HOLDS` row; off = the build as it was by run digest): the man an entry left on another door of the
  room (doortools.ts `doorKeepers()`) keeps his gun on it when 'fall in' comes — pinned through the cover like the stack's rear man, stood with NO goal (orders.ts asks
  `roomKept`: a runner held at speed 0 on a goal steers his chest at his next waypoint and the twist clamp drags the gun off) — until the squad is out of the room, the men who
  stood behind him have passed him with nobody who is on his way out of the room still in it (`REARWATCH.roomLast`, on: freed with mates queueing at the one doorway he was out ahead of one of them; false = as it was, and a recording from before the key replays so), `roomSecs` 8 after Sam left, Sam is `roomM` 8 m off, the squad has been beyond that door or another order has it; then he follows last. An order to stack ends the
  keep, and the kept door, still shut, counts as a way behind that stack while the squad is in the room (`Book.shut`).
  `bun run tools/qa/roomkeep-check.ts [id …] [--max N] [--off]` = rooms taken on the warehouse and the compound, 'fall in' with Sam in the room and then gone: gun on the kept
  door, feet still, let go, last out, the file back with Sam, nobody past the team's pace (`--off` must fail; `RK_LAST=0 … warehouse-four --case b_s:+` must fail 'last out'; `RK_MEN=1` = every man twice a second as the squad leaves)) ·
  stackline.ts (a man walking up to a 'stack' mark on a door that STANDS OPEN keeps the brisk walk through what the room beyond sees through it, instead of the slow last steps; the pace only — no way, mark, watch or entry is touched, a shut door and a silent team are as they were; `STACKLINE.on`, ships on, `?nostackline`, `TPS_STACKLINE`; `TPS_PROFILE=shipped bun run tools/qa/stackline-check.ts [id …] [--max N] [--face name] [--first on|off]` = every door face of every squad level walked up to, rule on against off (the second arm plays in a walked world: a worse reading is replayed with the arms swapped and counts only if it holds both ways); `PT_STACKLINE=1` on playthrough.ts + `tools/qa/stackline-tally.ts off=a.json on=b.json [--deaths]` = door-line time, stacks formed and men lost at a door in played fights) ·
  stackroom.ts (every mark a door order deals is on the floor of the room that face of the door is in, else dealt again; `STACKROOM.on`: on in the page, off = the marks as before; the frozen harness stand holds it off — `TPS_STACKROOM=1`, a `FROZEN_HOLDS` row, in a journal's tables; a door in a passage no wider than itself files the men the jambs have no room for back down the passage (`laneBack`), and the rule never refuses an order the build gave;
  `bun run tools/qa/stackroom-check.ts [id …] [--walk]` = every door face of every squad level, `--dump F` for a byte compare of the marks with the switch off; `STACKROOM.view` (on with it, off = the jamb marks; `viewHand` = its second half): a plain 'stack up' on a door whose leaf STANDS OPEN deals each place the floor beyond sees through the opening again along the door's own wall, the first place from that jamb it does not see, and a place a man would have to cross the front of the opening to reach onto the men's own hand of it — `stackViewFix` behind `orders.ts stackPostsWait`, asked by the 'stack' order alone: the door tools file their own stacks from `stackPosts`, shut doors are not asked, a place with nowhere to go stays — and what stays is settled against the places as they END UP (10-14: a place that stayed because one nearer the frame held the floor it wanted, in a pass that one then failed in, is asked again; before, which of the two moved hung on where the men stood when the order came, and at the barracks' bunk room door a stack asked again from its marks shuffled a jamb man 0.3 m along the wall and a row across — a level change had exposed it; 'the same mark' is within `SAME_M` 0.1 m, under the 0.15 m between the rule's two rows off a wall, where 0.15 itself was decided by rounding; no switch: with nobody standing on a mark, all levels, 310 marks moved where 302 did, 499 in view where 507 were, crossers and glass the same; headless only, never seen on a GPU or played); `TPS_PROFILE=shipped bun run tools/qa/stackview-check.ts [id …] [--walk] [--max N]` (`--max 0` walks every face the rule moved a mark on; a man whose mark the ORDER brought to his feet short of it is not held to it, as one who 'stopped short' is not), `stackview-trace.ts` = the count) ·
  shardModel.ts (CPU reference of the glass shard particle) · shotgun.ts (the breaching shotgun, weapons row `m870`) · shutdoor.ts ("shut that
  door" on order) · squadsmoke.ts (teammates' smoke on order) · stature.ts (the cast drawn at slightly different heights) · stress.ts (`?extra=N` extra enemies, a cost hook) ·
  wallbreak.ts (interior walls and cover come apart under rounds and blasts) · wallcharge.ts (the door charge's twin on a partition wall) · wallreact.ts (both sides react when
  the level breaks) · slots.json (the kit screen's pouch costs, data) · bigkit.ts (the big slot's breaching shotgun and dynamic hammer on a shut door: the row, the
  places beside the frame, the walk, the beat's clock and its tail — the pose is character.ts `bigTool`, the prop rigProps.ts `bigBoxes`; the card rule is kit.ts `BIGSLOT`).

<!-- was CLAUDE.md lines 507–619 -->
## Architecture map

```
src/main.ts          boot, frame loop, HUD, hotkeys, automation hooks      src/engine.ts   device, settings, frame orchestration
src/render/          passes.ts (pass graph + target lifecycles), frame.ts (uniforms/flags — THE flag table + Frame byte table + the scene prelude incl. TRACE_VARIANT), lights.ts (+ identity
                     maps for the reservoirs), rc.ts (cascades), probe.ts (the light meter / smoke probe queries), gbuffer.ts, texpool.ts (pooled targets + history resampling),
                     denoise.ts (the shared denoiser's pipelines), froxels.ts, particles.ts (GPU pool + impulses + wind records), decals.ts, reach.ts (per-light reach masks), wear.ts (traffic
                     map), meshbvh.ts + meshShadows.ts (mesh-traced character shadows at ultra), sdfrig.ts (round-cone proxy fit) + rigDebug.ts
src/render/shaders/  common.wgsl (structs, flags, box/grid traversal, glassTrace, round-cone character terms) + sdfrig.wgsl; direct: restir.wgsl (THE estimator + the hybrid held-light path) and
                     direct.wgsl (the ?norestir leader/tail path), both over direct_common.wgsl; sharp_direct / sharp_edge / gdown / gbaa (output-res direct + edge AA); refract_common.wgsl (pure refraction helpers: glass + rain); denoise.wgsl (one core, three
                     clients) + softtile; the LEGACY chain dtemporal / softblur / temporal / giblur (only under ?legacydenoise); fgather.wgsl (final gather + mainGi resampling; gatherStrata variant) over
                     gather_common + lighting_common; rc.wgsl / probe.wgsl (radiance cache, meter); reflect.wgsl + reflect_p5.wgsl (RT reflections; the ultra program), detail.wgsl, markings.wgsl,
                     decals.wgsl; froxel.wgsl + volumetrics.wgsl over vol_common (haze, smoke march, rain); particles.wgsl / particles_common / particles_draw (+ wind_field.wgsl shared with the solver);
                     gbuffer.wgsl, cards.wgsl, composite.wgsl (+ its SHARP compute twin) → taau.wgsl (or fxaa.wgsl on ?notaau) → bloom → post (AgX); resample.wgsl (history resampling); trace_lab.wgsl (the traversal lab);
                     smoke_read.wgsl (how every ray and march reads the smoke: appended to the scene prelude after common.wgsl)
src/smoke/           ONE POOL OF 8³-CELL BRICKS on a level-wide lattice (the *Smoke = one pool of bricks* bullet; the eight 64³ boxes it replaced are in git history before 2026-10-10): smoke.ts
                     (SmokeSystem), smoke.wgsl, smokeGrid.ts (the lattice + the consts both shader sides get), red-black SOR pressure solve, emitters; SoundSeal'd door LEAVES are obstacles (a
                     ≤ 32-leaf sealers uniform, re-baked when a leaf shuts / opens / moves and on `SmokeSystem.obstaclesChanged(c, r)`: destruction hides a static); ω clamped [1, 1.95];
                     wind_force.wgsl = the wind lane's forcing; types.ts = the face game code sees (`SmokeSystemLike`)
src/scene/           stage.ts (the viewer stage), markings.ts + markingDefaults.ts (the markings model + per-kind recipes), level.ts (runtime types Level / LightDef / PropDef / plans + buildLevel() = loadLevel(levels/office.json), imported so Bun
                     inlines it into the bundle), levelData.ts (the FILE format LevelData v1: ids, flag names, materials, refs by id; validate /
                     canonical serialize / digest / structuralDiff / id helpers — docs/level-format.md), levelLoad.ts (loadLevel data→Level and
                     levelToData Level→data, order-preserving: data.boxes[i] ≡ world.statics[i]), officeGen.ts (LEGACY procedural generator,
                     not imported by the game: tools/level-export.ts regenerates the JSON from it; probes.ts level = 0-diff identity gate),
                     boxes.ts (Box, flags, CPU raycast), collision.ts (capsule-vs-grid, nav grid + A*, sound propagation paths), world.ts
levels/              office.json — the level as data (782 boxes incl. 22 Glass panes and 6 vent grilles + their markings, lights, switchables, doors + locks, routes, props, mission, plans, daylight;
                     office-relief.json = the pre-markings 925-box office (?level=relief))
src/game/            game.ts (Game: state, constructor, event plumbing, doors/props glue, update() orchestration — the split-out
                     modules are plain functions taking the Game: mission.ts (stage machine, drive pull, down card), chronicle.ts (the run's timeline /
                     path / score — the debrief's memory, see below), combat.ts (shots,
                     kills, drops, hand props, throwables), guards.ts (hearing/vision, patrol→suspicious→alert→search, escalation
                     0/1/2, pairing, lockdown doors, body aftermath), player.ts (movement, the kit's slots by kind, pistol + OCP, FN2000 (slot 2) + its attachment on RMB, throws, takedown/drag, pick/kick,
                     interactables), launcher.ts (the FN2000's ring airfoils: flight, head KO / body stagger / clack), whistle.ts (V: Sam's low whistle — the event, who hears / answers / searches, the
                     `WHISTLE` knobs persisted), needs.ts (needs-driven patrol variation: the deal, the telegraph, the trip, `NEEDS` knobs persisted, `tune.needs`), civilians.ts (the cleaner + the late worker: perception through the guards' functions, work → alarmed → flee → report / phone → cower, held rows, scoring; `tune.civilians`),
                     lighting.ts (fixtures, OCP, breaker/blackout/restrike), aim.ts (the aim-settle model both ways: track/acquire gate,
                     target-crossing + shooter-feet cone terms, guards plant to shoot; `AIM` knobs persisted, `tune.aimModel`), suppression.ts (rounds past a man:
                     flinch / head-down / displace, Sam's spread), squad.ts (Guard.script runner, RoomClear
                     drill, live Clearing dispatcher), qrf.ts (the response to going loud: trigger, radio telegraph, the four-man
                     element through the west stair door, the perimeter tier), consts.ts),
                     marks.ts (decal emit sites), particleFx.ts (GPU particle sites), glass.ts (rounds star panes), weather.ts (the storm), wet.ts (wet characters: the model + prints / drips),
                     demo.ts (the old showcase tour: Shot list + puppet choreography; console and tools/qa/tour.ts only), breach.ts (BreachDrill: the two-man
                     breach the night breach scenario runs live), character.ts (anim graph, aim, tactical stances /
                     kick / signals / lockpick layers), camera.ts (follow cam; spectate auto-yaw + low pitch up close),
                     ragdoll.ts, doors.ts, props.ts (pushable furniture), throwables.ts (canisters, dropped mags/
                     weapons), weapons.ts, effects.ts (all muzzle/stun/vent emitter numbers + `tracerFx`), sparks.ts, tracers.ts
                     (carbine tracer streaks: pooled NoShadow boxes muzzle→impact + a transient head light, rule off the Firearm's counters,
                     one call in fireWeapon behind `tune.tracers`), launcher.ts (the FN2000's ring airfoil: flight, hit zones, items),
                     rigProps.ts (everything bolted to a mannequin: goggles, pistol parts, holster, torch, the guards' carbine,
                     Sam's FN2000 in hand / slung — the viewer's "copy constants" pastes into RIG here), input.ts
                     ALSO in src/game/ (each has its bullet below): teams.ts, interact.ts, devices.ts, attract.ts, savestate.ts, dialogue.ts, floor.ts, civilians.ts, tactics.ts, needs.ts, whistle.ts,
                     qrf.ts, destruction.ts + debris.ts + sheetModel.ts, wind.ts + moths.ts, wet.ts, weather.ts, glass.ts, marks.ts, particleFx.ts, audio_iface.ts, consts.ts
src/ui/              menu.ts (start/pause card + the debrief / down card), debrief.ts, bindings.ts (the tweak panel = the debugger, on backtick — every knob), quality.ts (presets, auto calibration, the ladder + climb),
                     overlay.ts (HUD), panel.ts, boot.ts (boot card + timeline), bubbles.ts, capture.ts, perfrec.ts (F9 recorder)
src/anim/            gltf.ts (loader; accepts embedded data-URI buffers), skeleton.ts, characters.ts (skinning, CharInst)
src/audio/ gpu/      audio.ts (mixer, propagation use, voice cap), music.ts (score; its newer pieces: pieces.ts), sfx.ts; gpu/device.ts (adapter/device, the Async pipeline helpers + progress), timer.ts (per-pass timestamps + union)
src/editor/ viewer/  the level editor (app.ts core host, editor.ts + doc.ts undo, paint/paintui, ui, tools, view, scene, lint, persist, api) and the character viewer runtime/ui/scenes/sheet — both housed
src/workbench/       by workbench/main.ts (modes, two worlds on one engine); src/math/ vec.ts; src/debugHooks.ts (typed window hooks)
tools/               serve.ts (+ levels-api.ts), build.ts, shot-server.ts, artifact-page.py, build-roadmap.ts (board generator), publish-public.sh,
                     level-export.ts (officeGen → levels/office.json; --check = stale test),
                     qa/ (headless harness: headless.ts, soak.ts, probes.ts, tour.ts, gait.ts = the animation's numbers, audio-render.ts,
                     mesh-shadow-ref.ts = the mesh-shadow BVH / capsule-vs-mesh numbers + the GPU replay fixture, level-probes.ts = the
                     level-as-data identity / validate / round-trip family, fixtures/ (panel-inventory-main.json = the frozen Tab-row inventory),
                     sessions/*.json.gz = the F10 journal fixtures the gate replays, gpu-quiet.sh,
                     the in-page instruments *.js (served at /qa/<file>.js) and the review-page generators *-page.py — see 'A lane's deliverables' under Workflow)
docs/                internal/<topic>.md = the notebooks (method, numbers, negatives) + review-ledger.md + architecture-review.md + morning-YYYY-MM-DD.html; review/<topic>.html = the self-contained
                     review pages published as Artifacts; perf/*.json = every measured take; shots/ = captures (shots/ab/ lossless, gitignored); design/ (level-scripting.md) + research/
                     (destruction-survey.md) = design work awaiting the maintainer's one-line decisions; level-format.md (VIEWER.md sits at the repo root)
docs/roadmap.json    build-board data (phases, log, vitals, shots) → `bun run tools/build-roadmap.ts` → Artifact
STYLE.md             the look as built, as rules to hold new work to (camera, light, the grade, colour, surfaces, places, people, gear, motion, effects, screens; each number names its file)
STATUS.md            a pointer since 2026-10-09: the queue through 08-16 is archived at docs/internal/status-archive-2026-08.md; the live queue is outside the repo (handoff.md + git log are the newest in-repo record)
```
Frame flags live in `src/render/frame.ts` / `common.wgsl` (Direct, Indirect, Volumetrics, Smoke, SoftShadow, Temporal,
NightVision, … plus the lossless default-on bits `TileCull` 4096 (per-tile light lists), `SoftTileSkip` 8192 (penumbra
filter copies hint-free 8×8 tiles through), (bit 32768 is FREE: `SmokeRenderSkip` went with the box smoke solver, 2026-10; a SHADOW ray through smoke takes `settings.smokeShadowSteps` samples, 8 = as it was); the render density (`smoke.params.densityScale`, Tab ▸ Volumetrics ▸ Smoke solver ▸ 'render density ×') defaults to **1.3** for CANISTER smoke (the 08-14 SHIP SET = the blind-pairs winner: density 1.3 · multiple scattering OFF · `smokeUpsampleRelax` on · `smokeTaaReact` 0.6 · diffusion on with the bilinear weight — docs/internal/smoke-look2.md; 1.6 was the 08-12 pick in stills) and `fxDensityScale` **1.0** for what is not canister smoke (gun gas, impact / destruction dust; the share is kept per cell), for EVERY reader, the guards' probe included (one model, by design, invisible to the headless probes); and the final blit DIFFUSES what is seen THROUGH a plume (`post.wgsl` SMOKE DIFFUSION, `passes.smokeDiffuse` 1.0, Tab row 'smoke blurs what is behind it', `?nosmokediffuse`): the volumetric pass writes the SMOKE-only transmittance into `volReact.g` (rgba16float) before the haze, post takes the most transparent of the four half-res texels round the pixel (nothing nearer than the smoke takes a rim) and mixes toward its own plainly box-downsampled quarter / eighth copies (`passes.diffDown`, three small dispatches while on) — a backlit front behind smoke loses its edges instead of staying pixel-crisp, `GridSkip` 131072 / `GridYCull` 262144 / `AxisBox` 524288 (trace-grid empty-run skipping, per-cell height
culling — the big one, ~15 % of the frame — and the unrotated-slab fast path; all exact), `GridSlabs` 1048576 (globals rejected by
segment bounds + tighter origin-cell spans, exact, ~7 % of the frame), `ReachMask` 32 (per-light CPU reach masks over the 1 m grid,
`render/reach.ts`: a walled-off light stays in U but is known dark — no leader slot, no tail pick, no ray — and doorway-only light ranks at ¼;
`settings.lightReach`, −5 % direct); the experiment bits `TailChroma` 16384 and `Gloss` 2097152 (traced glossy reflections on floors
flagged `BoxFlag.Gloss`: fgather.wgsl `glossReflection` → the passes' own half-res `spec` texture + history + one à-trous pass → composite
adds it after the diffuse terms; `settings.gloss`, default off, Tab ▸ Indirect light + pause menu; debug view 10 shows the term alone); and
the LOSSY option bit `CheckerDirect` 65536 mirrored from an `engine.settings` boolean the presets now set; the experiment bit `MeshShadows` 8388608
(`settings.meshShadows`, on in ultra (every ray) and — since 08-12 — HIGH in its NEAR-ONLY form (`settings.meshShadowsNear`, rigCfg bit 128: a ray walks a man's mesh only when it starts within 0.6 m of
his cull sphere, his round cones otherwise — the contact seam closed for a bounded cost, docs/internal/render-defects-0812.md §1), off below; `render/meshbvh.ts` = CPU topology + reference, `render/meshShadows.ts` = the one scene storage
buffer at binding 13 + skin/refit dispatches ('mesh' in the HUD), `common.wgsl meshShadowT` = the walk every `occluded()/occludedT()` takes instead of
the round-cone proxies; `engine.meshShadowsAvailable` false when the adapter's storage-buffer budget has no 10th slot; `tools/qa/mesh-shadow-ref.ts` = the numbers +
`--fixture` → `__meshTrace(fixture)` replays it on the GPU; `?meshShadows`); `Decals` 4194304 (up only while a mark exists), `Particles` 16777216
(informational: the pass graph, not a shader, reads it), the perf lane's `BounceCards` 33554432 / `DirectSeedHold` 67108864 / `GiAdaptiveHist` 134217728,
`Glass` 268435456 (`settings.glass`), `FroxelVol` 536870912 (`settings.froxelVol`, see the froxel bullet), `Restir` 1073741824 (`settings.restir`, the ReSTIR bullet) — bit 31 (the sign bit: compare with `>>> 0` / `!== 0` on the CPU) and bit 15 (32768, freed 2026-10) are the two left. **`frame.ts FrameFlags` is the one table** (common.wgsl's `FLAG_*` consts must
carry the same values under the same names) and the `Frame` uniform's tail is laid out cards @416 · cardSlots @432 · weatherA/B/C @464/480/496 · glassCfg
@512 · weatherD @528 · volCfg @544 · froxelA/B/C @560/576/592 · prevCam @608 · rtCfg @624 · matCfg @640 · p5Cfg @656 · jitter @672 · markCfg @688 · sharpCfg @704 · sharpCfgB @720 · sharpCfgC @736 · rigCfg @752 · rigCfgB @768 · giCfg @784 · weatherE @800 · weatherF @816 (the particle rain's two rows) · `FRAME_BYTES` 832 (byte table at the top of frame.ts); `bun run tools/qa/frame-layout.ts` (also `probes.ts frame-layout`, and under
`perf`) recomputes the struct's WGSL layout and fails on any offset / size / bit that disagrees — run it whenever you touch either side. Box flags in `scene/boxes.ts`
(`NoShadow` = invisible to every ray, `NoPrimary` = not rasterised, `Cutaway` (viewer stage only), `Dynamic`,
`Emissive` (auto), `AreaLit`, `Rot`, `Gloss` = 128 (polished floor finish: lobby stone, corridor / break-room lino — the last bit of the
GPU flag byte), CPU-only `SoundSeal` 1<<16, `Glass` 1<<17 (the one CPU flag past the byte that IS uploaded: `BOX_GLASS`); there is no `Broken` flag —
a pane that cracks and comes apart is `game/glassbreak.ts`'s per-pane state, not a box flag: see *Glass that comes apart*); bits 8–15 of the GPU flag word are the owner byte (character id) used for self-shadow masking — anything emitted for a
character must carry its owner. Storage buffers per stage at ultra on this Mac (limit 10): scene group 8 (6 + reach + mesh) in fragment / compute;
+2 the cascade trace / light probe (= 10, the ceiling), +1 the g-buffer's and the composite's decal buffer (9), +1 the particles' pool (9).

## The native engine — REMOVED 2026-10-11

The Mac app (bun + a Swift / Metal dylib under `tools/native`, `bun run native`) was deleted with its `native` probe family, its notebooks (`docs/internal/native-*.md`,
`docs/design/native-engine.md`), takes and captures; the last commit that has it all is f623b0fd. `src/host` stays: the page and the harness stand the game up through it.
Wherever this file still says 'the native host / overlay / engine', '.metal' or 'not ported natively', it is describing that removed code: there is nothing to port to or keep in step.

## Systems worth knowing before touching them

- **One model for presentation and AI.** Guards' vision uses the player's GPU light-meter irradiance and marches
  sight lines through the smoke density field; hearing uses the same propagation (`collision.ts` SoundPaths) the
  audio mixer uses. Don't add AI-only shortcuts that the picture doesn't show. Since 08-12 BODIES are found by the same rule (`guards.ts bodyLit / bodyVisibility`, `tune.bodyLight`
  default ON, Tab ▸ Sandbox: a probe query `bodyL<id>` at the trunk — the finder's torch is one of the lights — bar `BODY_LIGHT.lit` 0.22 from 5 m easing to 0.04 at
  2 m, any light inside 2 m, hidden inside live smoke; ≤ 6 probe slots a frame (note: Sam's own meter is still queued last — review R10.7 — so these add pressure rather than protect it)), a held CIVILIAN is a hostage the shift
  calls in and holds fire on (`standoffPerceive` accepts team 'civilian'), a light going out is noticed only with a clear line to it, and a routed sub-gunshot
  points the man at the doorway it came through (`heardAt`).

<!-- was CLAUDE.md lines 693–694 -->
- **Chaos Theory authenticity breaks ties:** one-shot kills both ways, silent takedowns, light + sound meters, a
  dropped torch goes dark, weapons leave dying hands as physical items, holstered guns are drawn on the body.

<!-- was CLAUDE.md lines 2974–2978 -->
- **`src/game/` is ONE runtime import cycle** — 22 files (in August; 84 of 124 by a script over the runtime imports at 527a92a) strongly connected through `game/game.ts` (docs/internal/architecture-review.md = the measured liabilities, a target `EngineHost` /
  registries structure and a 15-step migration plan whose steps the maintainer picks; docs/internal/review-ledger.md = every deep-review finding → FIXED hash / PARKED reason / needs them).
  It works only because no top-level statement USES an import: a module-level table or `new X()` built from another game module's exports captures `undefined` / TDZ-throws at boot — and
  the browser bundle orders bindings differently from bun's headless import, so it can break ONLY IN THE PAGE (journal.ts's eager `KNOB_TABLES`: every headless probe green, F10 threw on
  its first page frame; made lazy at cfd0047). Build such tables lazily and boot a new game module once in the page, not only under the harness.
