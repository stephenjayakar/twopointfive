# Experiment E3 — glass

> **Merged 2026-08-09 with the shatter replaced by cracks.** The maintainer's call: the panes look fine, the shattering looked lame. On the merged
> tree a round STOPS in the pane (every round — bullets never pass our glazing) and stars it: an 8 mm hole, a milky collar and a crack star drawn ON the
> glass by composite.wgsl from a `'glassHit'` decal (decals.wgsl `glassMarks`; three looks, seeded off where it hit; several hits overlap; restart wipes
> them with the other marks); `glassCrack` replaces `glassBreak`, the `'glass'` event stays; a stun charge stars nearby panes quietly, kicks do nothing;
> `BoxFlag.Broken`, the shard pool, break-all / restore and every pane-removing path are gone. Everything below about **shatter / Broken / shards** is
> the branch's record, superseded; the rest (data, the flag bit, where the glass ray lives, CPU semantics, smoke, cost) stands. The frame flag moved to
> `268435456` (decals own 4194304) and `glassCfg` sits at byte 512 of the Frame block.

Branch `exp/glass` (on top of `main` @ 10a99d8; `git log 10a99d8..` for the steps). Not merged: play it from its own page and decide.
Boots ON; `?noglass` boots it off; Tab ▸ **Renderer — glass (EXP)** or the pause card's *Graphics — trade-offs* row flips it live.

## What to look at first

Stand in the corridor outside the conference room (Sam spawns in the lobby: through the arch, turn left). The whole
partition between the corridor and the conference room is glazed now — six panes between the mullions, sill to header.

1. Walk along it and rotate the camera (Ctrl-drag / Q-E): square-on the panes are a faint grey-green veil over the room
   (4 % Fresnel + the tint); the more glancing the view, the more they mirror the corridor floor, the sill line, you.
2. Let the corridor guard come past with his torch: the beam goes through the glass into the room (mullion shadows and all),
   and where it meets the pane there is a soft bright lobe ON the glass — the grime catching it. Stand lit inside the room and
   he takes you through the glass; crouch dark behind it and he walks by.
3. Shoot the glass (pistol, one round): the pane goes with a crash, a dozen shards tumble into the room and settle on the
   carpet, the bay is an opening from then on (the next round goes through to the far wall; whistle through it and he hears
   you — whistle behind an intact pane and he does not). Everyone within 30 m hears the crash and comes to look.
4. A stun canister within 2.5 m of the glazing takes the nearby panes out; kicking the manager's door in takes his sidelight.
5. Also glazed: the manager's office has a sidelight beside its door (the desk lamp shows through it from the corridor), the
   lobby frontage (south and west, a pane a bay — moonlight through them lands tinted on the stone), every other exterior window.
   Shift+Enter (restart) mends everything.

Debug view "specular (gloss + glass)" (backquote cycles) shows what the panes add, alone; the albedo view washes pixels
behind glass teal so you can find them.

## Design as built

**Data.** A pane is an ordinary static box flagged `Glass` (levels/office.json flag name `Glass`, `BoxFlag.Glass = 1<<17`),
12 mm thick, standing in the wall's centre plane, its albedo = the transmission tint per crossing (`glass` 0.80/0.87/0.83
interior, `glassExt` 0.70/0.75/0.79 exterior). Authored in officeGen.ts (`paneX/paneZ`, `Opening.glass: 'bay'|'whole'`)
and exported; the `level` probe family is green (generator ≡ JSON, digest d00af8fbe53a7). 22 panes: conference partition 6,
manager sidelight 1, lobby south 4 + west 4 (a pane a bay), and one pane an opening for the cubicle / break-room / storage
windows and the two clerestory strips. Panes fill their holes exactly and pass straight through the mullions and jambs that
are thicker than they are (harmless: see below) so no untinted sliver shows at an edge.

**The flag bit.** The GPU flag word was always a u32: flags in the low byte, the owner id in the second, bits 16-31 never sent
(upload masked `Box.flags & 0xff` because the one higher bit, `SoundSeal`, is CPU-only). Rather than repurpose `Cutaway` (the
viewer's stage wall uses it — the viewer is untouched and boots clean) the word is **widened**: `Glass` is bit 17 on both sides
(`BOX_GLASS = 131072u`) and `upload()` passes exactly that bit through. `Broken = 1<<18` is CPU-only runtime state (a shattered
pane), masked on export like `AreaLit`. Nothing else moved.

**Where the glass ray lives.** No traced ray and no raster triangle ever meets a pane: `BoxWorld.upload()` keeps Glass boxes out
of the trace grid AND the visible list (on or off, intact or broken — the `glass-off` probe holds the grid + visible digests
equal to the level with its panes made nothing) and instead writes the intact ones, nearest the look-at first, into
`SceneInfo.glass` (uniform: count + ≤ 32 panes × 3 vec4f = centre/cos, half/sin, tint/index). Three places ask
`common.wgsl glassTrace()` — ≤ 22 slab tests on uniform data:
- **composite.wgsl** (full res, per pixel): the view ray camera → G-buffer point. A crossing makes what the G-buffer shaded the
  TRANSMITTED picture: × `tint^(depth ÷ cos θ)` for every pane crossed, × (1 − F) for the nearest (Schlick, n 1.5); then adds
  the pane's own contribution from the specular texture (below), upsampled with the indirect's joint-bilateral taps.
- **fgather.wgsl `glassShade()`** (gather res, only for texels whose view ray crosses a pane): ONE exact mirror ray off the
  nearest pane, traced and shaded like `glossReflection` shades its ray (emission incl. area-lit fixtures, albedo/π × (direct at
  the hit + cached bounce), sky on a miss) + `glossGlints()`' analytic image of small emitters in the mirror cone, × F ×
  strength; plus a **dust glow**: every steady light's irradiance ON the pane (both faces, reach-masked), the two strongest
  shadow-tested (+ smoke), × 0.035/π. It leaves through the gloss floors' `spec` texture → the same temporal + one à-trous pass
  (passes.ts runs that chain under `Gloss | Glass`) → composite. Two panes in line: both tint, the nearest reflects.
- **direct.wgsl** (light THROUGH glass): a leader light whose shadow rays came back lit is multiplied by `glassTransmit()` over
  the panes between the pixel and the light — as a visibility factor (S only; U keeps the untinted light, so the ratio filter
  treats a pane's edge like a penumbra's). Which panes can matter is worked out per light on the CPU each frame
  (`engine.ts glassLightMasks`: in range, bright enough at the pane to show — `GLASS_MIN_E` 0.02 W/m² — inside a spot's cone /
  in front of a panel, a face of the pane inside the light's reach mask) and rides in the upper 24 bits of `Light.owner`;
  each 8×8 tile narrows a point light's mask to the panes touching the box (tile ∪ light). Nearly every pair is 0.
  GI (cascades, gather secondary hits) and the volumetric march see no glass at all: light through a pane reaches the cache
  untinted and beams are not dimmed by it (a 15 % tint on a bounce or a haze beam is invisible; the cost would not be).

**Smoke.** The fluid solver's obstacle bake (smoke.wgsl bakeObstacles) reads the pane table too — panes are in no grid — fattening the 12 mm sheet
to just over half a voxel each way so it bakes as one closed layer: a canister vented in the corridor fills the corridor and comes round through the
door, it does not seep through the glazing (`exp_glass_q9_smoke_glass.jpg` vs `…_noglass.jpg`, from inside the room). Baked once per domain like
every obstacle, so a pane broken beside a live plume opens for the next domain, as a door does; with the experiment off the count is 0 and the
openings are open, as before.

**CPU semantics (one model).** `collision.ts segmentBlocked(a, b, shrink, through = BoxFlag.Glass)` is the floor's line of
SIGHT and passes glass (eyes, torch cones on Sam, the light between a man and a lamp, the dazzle, camera auto-yaw…);
`solidBlocked()` (= `through 0`) is the SOLID question and an intact pane blocks it — SoundPaths (all four of its tests), the
step / lunge / arm's-reach gates in player.ts, squad.ts, guards.ts, breach.ts, game.ts interrogate, dialogue's chat line.
`shotBlocked()` (the same walk today, named for the question — added 08-12 after the wave-3 probe review) is the line of FIRE:
guards.ts `clearShot` (the alert branch's `blocked`, the standoff's aimed round) and tactics.ts `losOpen` (the presser's / flanker's
cover point, the lone man's corner) ask it, so a man who SEES Sam through the conference glazing knows he has no shot from there and
goes round through the door — before it, clearShot asked the sight line and he planted on the corridor putting round after round
into the pane (aim-door-sweep's seven red traps; `probes.ts glass-lines` stages it both ways).
`collideCircle`, `gather` and `raycast` (rounds, canisters, sparks, shins) hit intact glass and skip Broken. `BoxWorld.raycast`
(the cursor's aim) skips glass, so you aim at the man behind the pane and the round finds the glass on its way. reach.ts's
wall raster skips Glass (light passes). Feet never actually meet glass in this level: every pane stands on a sill (0.5 m conference, 0.3 m the
sidelight, higher outside) that reaches into the capsules' collision band, so a broken pane is an opening for rounds, sound and sight, not
for walking — player and guards alike still go round by the door (and the nav grid, baked with everything whole, would not rebake anyway).

**Shatter** (`src/game/glass.ts`). `combat.ts fireWeapon`: the round stopped in a static that is an intact pane → `breakPane`
(the round is spent in it). `updateGlass` reads this frame's `kick` events (≤ 1.0 m from a pane's nearest point) and `bang`
events (≤ 2.5 m), each once. A break: `Broken` set (out of the GPU list next upload, out of every CPU query), 8-14 shards
(seeded off `fxSeed`; gravity, drag, `col.raycast` bounces, settle flat, 90 s life, pool 120, drawn as thin rotated
`Dynamic|NoShadow` boxes at half the pane's tint), sfx `glassBreak` (new procedural voice), `GameEvent` kind **`'glass'`**
(level 0.85, horizon `GLASS.hearM` 30 m, through the usual propagation; guards.ts hearingCheck: awareness → ≤ 0.85 toward
where it came from, calm men bark once; chronicle words it 'glass breaking'), the player's noise meter if it was his.
`resetLevelState` (restart, the tour's hand-over) mends every pane and sweeps the shards; panel *break all* / *restore*.

**UI / hooks.** Tab ▸ Renderer — glass (EXP): on/off, reflection strength (× the physical F), tint depth, dust glow, break
all / restore, a status line. Pause card: *Glass panes (experimental)*. `window.__glass` {on, reflect, tintDepth, dust,
breakAll(), restore(), break(bi), summary(), listed, panes, state(), knobs}. `?noglass`.

## Cost (M4 Max, high, 1555×1000, serialized 30-frame means, A/B/A/B interleaved)

| view | pass | glass ON | OFF | Δ |
|---|---|---|---|---|
| corridor → conference glass (6 panes + sidelight on screen, torch-free) | direct | 7.49 | 7.31 | **+0.18** |
| | gather | 2.32 | 2.18 | **+0.14** |
| | temporal (spec chain) | 0.21 | 0.15 | +0.055 |
| server room (no pane on screen) | direct | 6.55 | 6.46 | +0.09 |
| | gather | 1.96 | 1.93 | +0.03 |
| | temporal | 0.20 | 0.15 | +0.05 |

Composite is a render pass (Metal timestamps span the drawable wait — CLAUDE.md) so it is not in the table; its share is
≤ 22 slab tests per pixel + the 9-tap upsample for glass pixels, ≈ 0.1 ms by op count. Total ≈ **0.5 ms** in the glass
view, ≈ 0.25 ms with no glass in sight (target was ≤ 0.6). Getting the direct pass there took four rounds: the first cut
(tint inside the scoring loop, per-tile masks over every pane × every light) cost +0.4 ms everywhere; the fixed part turned
out to be the moon's 22-pane walk on one lane of every tile and six 64-byte Light copies per pixel — hence CPU masks in
the light record, no per-tile walk for directional lights, and the tint asked only for a lit leader.

## Probes / gates

`tools/qa/glass-probes.ts`, family `glass` (38 checks): **glass-flags** (name ↔ bit, 22 panes as briefed, Broken masked on
export), **glass-sight** (eye→chest: sight clear / solid blocked; Sam walks into the pane and stops; lit behind it → ALERT
in 0.5 s; dark → nothing), **glass-sound** (door shut: routed 7.2 m carry 0.32, a scrape and a whistle unheard; pane broken:
direct 2.4 m carry 1, the scrape turns him), **glass-shot** (round 1 stops at z 10.01, one pane Broken, one `glass` event,
one crash, 12 shards; a man 20 m off → 0.59 suspicious with his fix at the glazing; round 2 → the far wall at z 4.2; shards
settle in 4 s within the pool; a guard's round breaks glass too; restart mends and reseals), **glass-blast** (kick takes the
sidelight not the conference glass; a bang takes exactly the 4 panes within 2.5 m; events consumed once; pool cap under
'break all' ×4), **glass-off** (visible + grid digests on ≡ off ≡ panes-made-nothing; glassInfo 22 / 0; nearest-first row
layout; Broken drops out and returns; BOX_GLASS on panes only, CPU bits never uploaded).
`gate.sh glass level player weapons` → all green (weapons-identity included). `tour.ts --runs 2` PASS ×2. `soak.ts --seeds 1,2
--minutes 6` clean twice — the second run with the soak's new `break-glass` stimulus dealt (3 panes in seed 2) and its
`glass-shard-pool` / `glass-shard-astray` invariants holding; 0 violations, 0 exceptions.
Typecheck clean. Viewer boots clean.

## Uglies / honest notes

- Reflection edges are 2 px soft where a pane's footprint ends without a mullion in front (half-res spec, zero taps outside):
  in this level that is only the sill line, and the sill hides it from the game camera.
- The dust glow is deliberately modest (albedo 0.035): the torch lobe on the pane is there at ×3 but you look for it. The knob
  goes to 4× if the maintainer wants dirtier glass.
- Settled shards are diffuse chips (no glint) — set dressing, not glass. Flying they read well against a lit room.
- No door vision panel (the brief's break-room door): a leaf is ONE dynamic box that seals sound, blocks sight and takes the
  boot as a unit; a see-through hole in it means splitting the leaf and teaching `segmentBlockedDynamic` about the hole —
  more doors.ts surgery than a 20 cm pane is worth on an experiment branch.
- Nobody walks through a broken pane: the sills are in the collision band (above). A level with floor-to-ceiling glass would let the player
  through and still route the guards round (baked nav).
- Fixed after review: a round fired pressed right up to the glazing (the muzzle already past the sheet) used to vanish into armThrough's
  panel rule — the pane between shoulder and muzzle now breaks; the un-stick's 'same room' test is solid again (no snapping a stuck man across
  a pane); a torch within a metre of a bay no longer drops its tint bit between the facing test's sample points; guards' lasers pass glass.
- Sky pixels (depth 1) never get glass; no pane can sit between this camera and the sky.
- Thrown canisters and rings clack off glass without breaking it (only rounds, kicks and bangs do).
- With indirect light switched off in the panel there are no reflections either (they ride the gather, like the gloss floors).
- The importance-picked tail light and the volumetric beam are not tinted by glass; the checkerboard-direct lossy path
  inherits the tint through the published S/U ratio.

## Captures (docs/shots/, all `high` 1555×1000; graded from the ×2/×3 crops, not the frames)

| file | what | verdict |
|---|---|---|
| `exp_glass_q1_conf_lit_oblique.jpg` vs `…_noglass.jpg`, crops `exp_glass_crop_conf_oblique[_noglass]_x3` | conference room lit, seen along the glazing from the corridor | the veil, the mirrored sill line and the mullion-cut reflection read as glass; no stipple or noise in the pane at ×3; the door leaf in front (green from the exit sign) is not glass and looks it |
| `exp_glass_q1_conf_lit.jpg`, `exp_glass_conf_a/b.jpg`, `exp_glass_q8_followcam.jpg` | the game camera's own framings | subtle square-on, as it should be (F ≈ 4 %): a grey-green cast over the room and a soft sheen; the follow-cam frame shows the torch's lobe on the pane at gameplay scale |
| `exp_glass_q2_torch_room.jpg` vs `…_noglass.jpg`, crops `exp_glass_crop_torch_room[_noglass]_x3` | the guard's torch through the pane, seen from inside the dark room | beam continues inside with the mullion shadows; the dust lobe on the glass is there but polite (knob); the mullion's own stair-stepped edge is pre-existing thin-geometry aliasing |
| `exp_glass_q2_torch_room_spec.jpg`, `exp_glass_conf_b_spec.jpg` | debug view 10 (what the panes add), exposure ×3-4 | pane footprints crisp, mullion gaps clean, the mirrored corridor floor + Sam's silhouette smooth — no fireflies |
| `exp_glass_q3_shatter_burst2.jpg` / `…_settled.jpg`, crops `exp_glass_crop_shatter_*_x3` | one round through the east run's middle pane, lit room | mid-burst reads well (tumbling chips catching the panel light, the bay instantly clear beside its veiled neighbours); settled chips were white tiles at first — halved their albedo and size after this capture |
| `exp_glass_q5_moon_lobby.jpg` vs `…_noglass.jpg`, crops `exp_glass_crop_moon_lobby*_x2` | moonlight through the west frontage onto the lobby stone | the patches land ≈ 15 % darker and a touch bluer through the solar glass (measured on the frame: sRGB 51/60/75 vs 62/70/83); mullion shadows unchanged; the grass outside shows green through the panes |
| `exp_glass_q6_sidelight.jpg` | the manager's sidelight with the desk lamp behind | badly framed (low pitch onto the corridor wall) but the sidelight is the dark glossy slot right of the ajar door |
| `exp_glass_q7_yaw_moving_spec.jpg` vs `…_settled_spec.jpg`, crops `exp_glass_crop_yaw_*_x2` | spec view mid-way through a 20°/s yaw vs 30 frames after it stopped | no double edges or trails at the pane borders; the interior grey is the same both ways — the history rides the surface behind the glass exactly as the gloss floors' does |
| `exp_glass_q9_smoke_glass.jpg` vs `…_noglass.jpg` | a smoke canister venting in the corridor against the east run, seen from inside the room 6 s in | with glass the plume stays behind the pane line and enters only by the doorway (right); without, it rolls over the sill into the room — the solver and the picture agree |
| `exp_glass_conf_b_ind.jpg` | indirect-only view of the glazing | the panes are invisible to GI by construction (no double count); the view is the level's as it was |

## Files touched (merge risk)

High-traffic: `src/render/shaders/direct.wgsl` (tile phase + shadow phase), `common.wgsl` (Frame + SceneInfo structs, the
glass block), `fgather.wgsl`, `composite.wgsl`, `src/scene/collision.ts` (segmentBlocked signature + Broken skips),
`src/game/guards.ts` (hearing block + 3 solidBlocked sites), `player.ts` (4 sites), `combat.ts` (2 lines), `game.ts`
(GameEvent kind, update hooks, resetLevelState), `engine.ts` (settings, masks), `boxes.ts` (flags, upload, SceneInfo size),
`frame.ts` (FRAME_BYTES 432, flag), `lights.ts` (owner packing), `levelData.ts` / `levelLoad.ts` (flag name, DERIVED),
`officeGen.ts` + `levels/office.json` (regenerated: 913 boxes). New: `src/game/glass.ts`, `tools/qa/glass-probes.ts`,
sfx `glassBreak`, soak stimulus. Shots: `docs/shots/exp_glass_*.jpg` (+ `exp_glass_crop_*` ×2/×3 tiles).
