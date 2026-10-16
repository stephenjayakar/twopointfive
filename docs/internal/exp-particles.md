# EXPERIMENT E4 — GPU particles: sparks, debris chips, dust, spent brass (`exp/particles`)

Branch off `2eb28b0`. Not merged: play it from its own page and decide. **ON by default** here (`engine.settings.gpuParticles`);
`?noparticles` boots the CPU box sparks of `game/sparks.ts` byte for byte and none of the new effects; Tab ▸ **Renderer — particles (EXP)**
has the switch, the stats line, five *burst test at cursor* buttons and every per-kind number; `window.__particles` is the console object
(`.stats`, `.params`, `.on`, `.test(kind, at?)`, `.emit(kind, pos, dir, count, opts)`, `.clear()`).

## What to look at first

1. **Shoot the server racks in the dark** (2 → the FN2000, Z for auto, L off; the room is straight ahead of the spawn): a shower of
   white-yellow sparks off the steel that cools orange as it falls, skitters along the tiles and is gone in half a second; a couple of dark
   chips stay. `docs/shots/exp-particles/rack_sparks_flash.jpg` (the frame of the shot: the flash lights the chips already in the air),
   `rack_sparks_fall.jpg` (+0.15 s), `crop_rack_sparks_x3.png`.
2. **Put a burst into the corridor plaster where a torch is looking** (any wall; the corridor's north wall by the server-room door is what
   the captures use): pale gypsum chips and a puff of dust come off it, the chips bounce and lie on the lino — bright flecks inside the
   torch pool, dim grey outside it, silhouetted dark while they fall between you and the pool. `wall_chips_torch.jpg`, `wall_chips_rest.jpg`,
   `crop_chips_in_pool_x3.png` vs `crop_chips_in_dark_x3.png`, `crop_dust_in_beam_x3.png`.
3. **Empty half a magazine on auto and look down**: the FN2000's empties trundle out of the front of the gun (forward ejection — its cases
   leave by the muzzle, not the wrist), tumble, bounce, and lie on the lino at whatever angle they landed, each one heard landing half a
   second after its round (a small high *tink*, quiet under the report). A guard's AK flings lacquered-steel cases hard right instead.
   `brass_firing.jpg`, `brass_rest.jpg`, `crop_brass_rest_x3.png`, `crop_brass_flight_x3.png`.
4. A stun canister (4, click) — `bang_0p15s.jpg` / `bang_0p3s.jpg`; kick a locked door in (sprint into it) for the plaster and splinters off
   the jamb; a ring airfoil into a wall (2, 2 again for RING, RMB) clacks a few sparks.

## Design as built

| piece | how |
|---|---|
| **pool** | ONE storage buffer (`render/particles.ts`): a 64 B header of counters + **16 384 × 64 B** particles (`pos age · vel life · size bits seed colour · shade spin`). Two RINGS dealt in FIFO order by the CPU — SHORT `[0, 6144)` for sparks + dust, LONG `[6144, 16384)` for chips + brass — so a spark storm can never evict resting brass; a lapped ring overwrites its oldest (oldest-die, no bookkeeping). Only each ring's live WINDOW (tail‥head; the tail retires when every particle of an emit has outlived its longest possible life) is simulated and drawn: nothing alive = no dispatch, no draw call. |
| **emit** | Game code calls `Particles.emit(kind, pos, dir, count, opts)` (`particles.ts:127`); records queue on the CPU and `prepare()` (`:145`, called by `engine.render`) packs ≤ 128 records + the windows + the per-kind numbers into one 14.6 KB **uniform** block. Kernel `emit` (`shaders/particles.wgsl:23`), one thread per birth, finds its record, draws direction / speed / life / size from `pcg(seed, index)` (shapes: cone, ground burst, ring, puff), pre-integrates a random fraction of dt (a burst is a spray, not a shell) and writes its slot. No `Math.random` anywhere on the path: seeds count off the system's own serial, so `?paused` captures repeat (probe: two runs, identical stream). |
| **update** | Kernel `update` (`particles.wgsl:119`), one thread per window slot, same compute pass: age out; gravity + exponential drag; **collision = `traceClosest` through the trace grid** from where it was to where it is going (the boxes every other ray sees: walls, desks, door leaves, props, capsules — the owner byte keeps a case blind to its shooter's arm): bounce with per-kind restitution / tangential keep, sparks keep skittering as long as they burn, chips and brass slower than `sleepV` on an up face go to SLEEP (no integration; one short down-ray every 16th frame re-tests the support so a swung leaf drops them); born inside geometry = culled and counted. Then **shading, per particle, here** (the draw only reads `shade`): a spark = the CPU sparks' own cooling ramp (white-hot hold → orange → red, ×25 HDR, the bloom is the glow); chips / dust / brass are LIT — `particleLight` (`:83`) scores every light unshadowed behind the reach masks (doorway-only lights at ¼), shadow-rays the **three strongest**, credits the untraced rest at 35 %, adds the radiance cache's dice (a resting chip reads it like a floor point, a puff the whole sphere's mean) × `indirectScale`; brass adds a Blinn-Phong glint off the strongest light with a normal that spins in flight (it twinkles) and is up at rest. |
| **draw** | `particles_draw.wgsl`: one `draw(6 × liveSlots)` with no vertex buffer, straight **into the HDR target between the composite and the bloom** (`passes.ts:412` hook; `engine.ts:259`), premultiplied blend (a spark writes alpha 0 = pure add; a chip its coverage). Each particle is a screen-space capsule from a shutter-time ago to now (a spark's streak IS its speed; a resting chip / case is a dash at its resting angle; a puff a soft disc that grows), **never thinner than 1.5 px** — thinner is widened and its intensity / coverage scaled down by as much, so a 2 mm ember ten metres off neither crawls nor pops. Depth: the g-buffer depth at the pixel vs the particle's own distance, softened over ~2 cm (a chip ON the floor is biased to show; one under the desk top does not); fog: the volumetric texture's transmittance to the surface behind, raised to the particle's share of the distance, plus that share of the in-scatter. Nothing drawn has a history behind it, so nothing smears. Debug views keep the screen (drawn only in view 0). |
| **frame plumbing** | Frame flag `Particles` = **16777216** (`render/frame.ts`, `FLAG_PARTICLES` in common.wgsl — informational: no scene pass reads it); `engine.particles` / `setParticles` / `particlesOn` (`engine.ts:149`); the pass is `'particles'` in the HUD list. Bindings against Chrome/Metal's 10-storage-buffers-a-stage: sim = scene group (8) + { pool rw, uniform block, dice texture } = 9; draw = scene group + { pool read-only in VERTEX, the block, g-buffer depth, vol texture } = +1 in the vertex stage, +0 in fragment. |
| **sites** (`game/particleFx.ts`, all behind `gpuFx(g)` `:21` = setting ∧ a system attached) | **bullet impact** `impactFx` `:84` ← `combat.ts:111`: the material of the very box / prop / leaf the scan found (palette name by exact albedo → metal / plastic / glass / wood / cardboard / drywall / concrete / carpet / fabric / foliage, `IMPACT` recipes; a rifle round ×1.4): sparks off the racks, 10 pale chips + 6 puffs off plaster, splinters off a leaf… · **muzzle powder** `muzzleSparksFx` `:107` (effects.ts `shot.spark*` numbers) + **casing** `casingFx` `:165` ← `combat.ts:73`, per row (`CASINGS`: port offsets in the gun's frame, throw direction, brass vs lacquered steel, diameter, tink delay), the tink CPU-scheduled and played by `updateParticleFx` `:179` ← `game.ts update` · **stun charge** `bangFx` `:117` ← `combat.ts:330`: 160 fragments (effects.ts `sparks` kinematics) + a 40-puff dust ring + 10 over the can; `spawnBurst` is asked for only the dozen CPU sparks that carry smoke trails · **door kick** `kickDustFx` `:126` ← `game.ts:664` (the DoorEvent), `breach.ts:225`, `squad.ts:295` · **ring clack** `clackFx` `:137` ← `launcher.ts:157` · **tracer ember** `sparkSink` `:194` (Tracers' `SparkSink`) · `clearAftermath` clears the windows and pending tinks. |

## Cost (M4 Max, Chrome/Metal, `?quality=high` 1777×1000, serialized `__runFrames` + `onSubmittedWorkDone` + yield, ms)

| scenario | `particles` compute pass | note |
|---|---|---|
| 0 alive | **0** (no dispatch, no draw call) | frame total 15.2–15.8 either way |
| ~1 900 sparks alive, moving + colliding (window 3 290) | **0.016 – 0.027** | 0.010 with collision off |
| 1 783 lit chips resting, in view (window 2 000) | **0.057 – 0.060** | 0.040 with the shadow rays off — budget was 0.15 |
| 15 650 alive: 10 240 lit resting chips + ~5 400 sparks (both rings full) | **0.043 – 0.062** (4 runs; one 40-frame sample read 0.124) | 0.029 – 0.040 rays off — budget was 0.6 |
| the splat, 16 k on screen | **≈ 0.17** wall-clock A/B (`drawEnabled` off/on, median of 7 interleaved 25-frame pairs; spread −0.3 … +1.5) | the render-pass timestamp (`particlesTimeDraw` → `pdraw`) reads 13.5 like `composite` reads 15.3 — the Metal drawable-wait trap, unusable; budget was 0.3 |

## QA

`bun run tools/qa/probes.ts particles` (`tools/qa/particles-probes.ts`, in `gate.sh`): **queue** (block packing at the documented word
offsets, births, ring dealing in order, the record cap and the birth cap drop-and-count, a lapped ring = oldest-die with the window
never past the ring, expiry, clear, prepare(off)) · **sites** (a Particles attached to the harness engine, GPU on: Five-seveN into plaster
= 10 chips + 6 puffs + 20 powder sparks + 1 case owned by Sam, the CPU pool EMPTY, the tink once at 0.47 s and never a hearing event;
FN2000 = ×1.4 and its case born < 0.3 m from the muzzle; a rack = impact sparks, no dust; the bang = 160 + 50 on the GPU and exactly the
12 trail carriers in the CPU pool; a kicked door = 14 puffs + 14 splinters; the ring's clack = 5; a tracer ember = 3 with the CPU pool
untouched) · **off** (setting off: zero GPU emits, no tink, 20 powder sparks / 72 fragments in the CPU pool and their streak boxes in
dynBoxes — today) · **determinism** (two runs → the identical emit stream). Gates green: `gate.sh particles weapons breach`, `tour.ts
--runs 1`, `soak.ts --seeds 1 --minutes 6`; `weapons-identity` byte for byte (the harness engine has no `setParticles`, so headless =
the CPU path). WGSL: both modules compile clean on the live device (no messages), and every capture above was rendered by them.

## Uglies / not done

- **The splat is timed by wall clock only** (above). A compute-shader software splat would be timeable but needs atomics for the add.
- **Untraced lights are a heuristic** (top-3 traced, rest × 0.35, doorway lights × 0.25): a chip beside a fourth bright lamp is 65 % dark
  to it. Cheap to raise `P_SHADOW_K`; the numbers say there is room.
- **Particles do not light anything and cast no shadows** — 160 white-hot fragments do not brighten the floor under them (the flash does).
  A transient light per burst is the obvious follow-up (the tracer's ember already does it on the CPU).
- **Fog is approximate**: `T_surface^(z_p/z_s)` assumes a homogeneous medium along the pixel's ray, so a spark INSIDE a smoke plume but in
  front of a far wall is dimmed too little. Sorted / order-independent blending is not done either: overlapping puffs composite in slot order.
- **Resting particles rest on what they hit when they landed**; a prop shoved under them wakes them only through the 16-frame support
  ray (they drop, they are not pushed), and a leaf swinging THROUGH resting brass passes through it.
- **Casings' tink is CPU-scheduled at a fixed delay** and lands where the throw says, not where the case actually bounced (the GPU cannot
  call back without a readback); it is audio only, deliberately not a hearing event (the report is one, louder, at the same spot).
- **Material = palette albedo match** (`OFFICE_DATA.materials`), inline-albedo boxes fall back on brightness; the level format's per-box
  material key at runtime (G1) would replace `surfOf`. 'black' is treated as metal (racks, bezels, chair bases alike).
- Sizes / counts / speeds in `PFX` and the four `KIND_DEFAULTS` rows are first passes graded from the crops above, not viewer-tuned; the
  bang was cut from 420 to 160 fragments after the first capture read as a firework. The panel has every one of them.
- Not eyeballed in the page (probes only): the door-kick puff + splinters, the ring's clack sparks, tracer embers on the GPU.
