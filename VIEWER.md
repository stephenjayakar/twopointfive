# Character / prop viewer (+ the gait lab)

One tool for everything that gets tuned on the mannequin and pasted back into the game: the props bolted to it (`RIG` in
`src/game/rigProps.ts` — goggles, the pistol, the knife, the guards' torch / pistol / carbine, Sam's FN2000 in the hands and slung), the long gun's carriages (`LONG`, one table for the carbine and the FN2000), the hold's contact constants (`HOLD`), the wall hold's pose
(`WALL_POSE`), the shot / canister effect numbers (`src/game/effects.ts`), and — folded in from the old `/gait` page — every
constant of the locomotion's naturalism pass with the live gait numbers. The game and the viewer go through the same functions
(`rigBoxes()` / `rigLightPose()` / `rigTorchPos()` / the animator's own inputs), so what you tune is what the game draws.

**It lives in the WORKBENCH now** (`workbench.html` → `src/workbench/main.ts`, docs/level-format.md 'Editor'): the viewer is its **Characters**
and **Effects** modes, beside the level editor's Level / Materials modes, on ONE engine, camera and inspector column. What changed for the hands:
the camera is the workbench's shared orbit camera — **RMB** drag orbits (LMB is the rig gizmo's alone), MMB or Space+LMB pans, the wheel zooms to
the cursor, **T** is the plan view and the turntable moved to **Y**, F / H frame as before; scenes ▸ variants are a tree in the left column (the
chips stay in the top bar); a new **Staging** scene stands the figure IN THE LEVEL the editor has open (a guard walking the vending fronts, one
stood by them, Sam under the desk lamp, a guard on the lobby stone) — pick it from any mode. Every hook below keeps its name.

```
bun run dev      →  http://localhost:5173/workbench#mode=chars                              (/viewer, /viewer.html and /gait forward here with their old hash:
                    http://localhost:5173/workbench#mode=chars&scene=sam/jog                 /viewer#sam/jog lands on this; /gait on …&scene=sam/walk)
                    http://localhost:5173/workbench#mode=fx&scene=fx/muzzle                  (the Effects mode = the props & FX / muzzle / tracer scenes)
bun run build    →  dist/workbench.html (+ dist/viewer.html / dist/gaitlab.html, forwards)
```

`?quality=verylow|low|medium|high|ultra` pins a preset as in the game. Needs the same WebGPU browser. The page is silent (no audio system).

Source: `src/viewer/` — `runtime.ts` (the stage runtime: `Runtime.create` for a page of its own, `Runtime.attach(canvas, gpu, engine, …, {input,
cam, hosted})` on a host's engine; the frame split `orbitFromInput · simulate · present` so the workbench composes its own; the figure stands on
`home`), `state.ts` (the one state object = `window.__viewer`, + the staging fields world / home / legYawDeg / legM), `scenes.ts` (the table below),
`sheet.ts` (property groups), `gait.ts` (the gait lab's knobs / meter / paste block), `ui.ts` (chrome; takes its containers, can leave the URL hash to
a host, `staging` lists the in-level scenes) — the old standalone boot `viewer/main.ts` is gone (nothing served it). `src/workbench/main.ts`
is the page: it re-houses the chrome (tree left, FIGURE · STAGE outliner + PROPERTIES sheet in the right column, chips + gait strip in the top bar).
Headless checks (no GPU): `bun run tools/qa/viewer-scenes.ts` (the table: every variant applies clean, a switch leaves no residue, the paste
blocks keep their shape) · `bun run tools/qa/viewer-ui.ts` (the chrome on a fake DOM over a real Character: every variant's sheet, every selection
kind, gear + all knobs, every button / toggle / select poked, the scrub field's arithmetic). Neither sees pixels — the stage is judged in the browser.

## Layout

* **Top bar** — SCENE tabs, under them the VARIANT chips of the current scene; for locomotion variants a third strip with the live gait
  numbers (planted-foot slip · cadence · stance share · pelvis bob · eye line, over the last 3 s, measured as `tools/qa/gait.ts`
  measures), the **ALL TWEAKS OFF** flip and *copy gait constants*. Right: **⚙** (gear menu) and **◨** (hide / show the inspector, `Tab`).
* **Stage** — the studio floor with 1 m marks, back wall (drops to a lip when you orbit behind it), 0.5 m cube, 1.8 m post, key /
  fill / rim lights. HUD top-left, log bottom-centre, the **constants box** bottom-left when something was copied.
* **Inspector** (right, resizable by its left edge, width and split remembered) — **OUTLINER** on top, **PROPERTIES** below.
* **⚙ gear menu** — *all knobs…* (the flat, searchable list of EVERY group: the old panel, for when the curation hides something),
  *copy ALL changed constants* (every table with a value off its shipped default, each in its paste format), constants box / copy RIG /
  shot → docs/shots, **Stage & camera** (frame body / back / head / hand / feet / profile / ¾ / front / game cam, track, distance,
  pitch, yaw, fov, back wall, floor marks, key / fill / rim, sky), **Renderer** (GPU pass times, quality preset, adaptive, scale,
  exposure, debug view, haze, bloom, emissive scale, fxaa), the hotkey list.

## Scenes ▸ variants

A variant is a declarative patch over a BASE state (`scenes.ts`): switching first puts every variant-settable field back (kit, drive,
stance, loops, the hold, the door marker, raw clip, pause) so nothing of the previous variant survives; the camera, your RIG / LONG / knob edits
and the view preferences stay. Re-clicking the current chip re-applies it (respawn + its one extra). Every variant only drives machinery
the animator / the old pages already had.

| scene | variant | what it sets |
|---|---|---|
| **Sam** (goggles, slot 1, relaxed carry) | idle · walk · jog · sprint · crouch-walk · creep | speed 0 / 1.55 / 3.3 / 4.7 / 1.3 crouched / 0.6 crouched + `deliberate` 1 — the gait lab: strip + Locomotion + the gait knob groups |
| | wall hug · wall sidle · peek | stance `wall`, holstered, upper none; sidle = 1.4 m/s (legs turn 55° like player.ts, torso stays on the wall); peek = `wallPeek` 1 (+ the 30° neck crane) — groups Tactical + WALL_POSE |
| | lockpick | `anim.lockpick` (forced crouch, hands at the keyway 0.45 ahead / 0.96 up, pistol leaves the hand at half weight) + the door marker at 0.5 m |
| | kick door | `anim.kickDoor` every 2.2 s + the door marker at 0.78 m: the leaf is flung on the `kickImpact` frame (KICK_IMPACT 0.38 s) |
| | signals · flinch / hit · reload | loop `signal('go')` 1.6 s (pick hold / go / rally in Tactical) · `flinch()` 1.5 s · `reload()` 2.6 s |
| | throw (canister) | slot 2, `throwItem()` every 2.5 s; a real smoke can (dead fuse) is put in the air at THROW_RELEASE with a throw's velocity (toggle in Tactical) |
| | rifle: calm carry · low ready · shouldered · port | the FN2000 in both hands (`rifle` 2, the pistol on the thigh): `longStance` forced patrolLong / lowLong (crouched) / shoulder (+ upper aim, the fore-end light lit) / portLong — the R1 solve with RIG.sc20k's foregrip point; groups Long gun + RIG.sc20k |
| | rifle: slung · rifle: fire (K) | `rifle` 1: across the back off the chest joint (RIG.sc20k.slung rows / the group node's gizmo), framed from behind · shouldered + upper *shoot*: effects.ts `muzzleFx.sc20k` every 0.6 s for grading |
| | rifle: shouldered · crouch-walk · shouldered, crouched · low ready, crouched · sprint (low ready) · port · calm carry (guards') | the FN2000 in both hands (`rifle` 2, the pistol on the thigh), `longStance` forced as player.ts forces it: shoulder = whenever it is in his hands (bore on aimDir, over the aim clip's trunk, the fore-end light lit; crouch-walk / crouched = the same crouched — the CROUCHED table on show) · lowLong at the sprint's 4.7 (and crouched: a rifleman ducking under fire) · portLong (the kick, a leaf) · patrolLong = the guards' / operatives' calm carry, never the player's — the R1 solve with RIG.sc20k's foregrip point, per posture (groups *Long gun carriage, standing (LONG)* and *…crouched (LONG_CROUCH)*: the same rows, L· / C·, blended by the crouch shown), steadied against the gait (standing group ▸ *steady against the gait* as-the-game / off / on, `steady` per carriage, `LONG_STEADY.tau / runYaw`); + RIG.sc20k |
| | rifle: slung · rifle: fire (K) | `rifle` 1: flat across the back in the back's own frame off the mid-back joint (RIG.sc20k.slung off / bore / roll / follow rows, or the group node's gizmo), framed from behind and above (⚙ ▸ *over the back*) · shouldered + upper *shoot*: effects.ts `muzzleFx.sc20k` every 0.6 s for grading |
| **Guard** (tan kit) | patrol walk | torch carry (`upper` torch), 1.15 m/s, torch lit — strip + Locomotion + Kit + RIG.torch |
| | low ready · aim (pistol) · port / stack | pistol drawn: stance lowReady at 1.15 m/s · upper aim, weapon light lit · stance stack, side R |
| | torch sweep | guards.ts *search* emulated: aimYaw = bodyYaw + 1.1·sin(1.1t), head + 0.4·sin(1.9t), torch lit |
| | carbine: calm carry · low ready · shouldered · port · shouldered, crouched · low ready, crouched | carbine on, `longStance` forced patrolLong / lowLong / shoulder (+ upper aim, light lit) / portLong, standing or crouched — groups Long gun standing + crouched (rows follow the carriage on show) + RIG.carbine |
| | carbine: tracers (K) | shouldered + upper *shoot* with `tracerAll` on: every K round is traced against the stage and flies as the game's tracer (`tracers.ts`: streak + head light + ember) — Effects group has the `tracerFx` rows and the "tracer every round" toggle (off = the game's rule off a stand-in gun: every third + the last three of thirty; pistols never) |
| | reload beat · death / ragdoll | `reload()` loop · `ragdollize` shoved from the camera on apply (X or the chip again = respawn + die) |
| **Pair: hold** (one figure of the pair; grey stick + cube = the other man) | grab · held (arm / knife) · held (pistol) · choke-out · pistol-whip | Sam's `holdPose`: phase grab (loops) / held arm (knife in the fist) / held gun / choke (loops 2.6 s) / whip (lands at 0.6 s, follow-through on the way out) — groups Hold + HOLD constants + RIG.knife / RIG.pistol |
| | swap knife ↔ pistol (E) · release / re-grab | held + the variant flipped every 2 s (the layers' hand-over, HOLD.secs.swap) · `on` toggled every 2.5 s (the way out, then the reach) |
| | held man · (gun to head) · choked out · whipped | the guard's `heldPose` in the same phases (agitation = the struggle; K = a round past his ear) |
| **Pair: takedown** | strike (Sam) · victim (guard folds) | `anim.strike()` (Punch_Cross) every 2 s, holstered · `ragdollize(forward, quiet)` on apply |
| **Door** (marker doorway: leaf + jambs, traced) | kick in (Sam) · kick in (guard, carbine) · pick the lock · stack on it | as above; the rifleman's derived carriage goes to the high port for the kick |
| | push through · push, walking, gun hand busy | `anim.doorPush` fed as game.ts `handsOnDoors` feeds it (palm spot on the leaf face in front of the shoulder at chest height, normal back at him): holstered → right hand, looping w 1 / 0 every 3 s · pistol drawn at 1.55 m/s → the left hand |
| **Props & FX** | smoke can (plume) · (floor vent) · stun can | fires `smoke.spawnCanister` / `spawnVent` / `spawnBurst` on the floor mark 1.6 m ahead on apply — group Canisters (all their numbers) + Smoke solver |
| | dropped items | tosses a pistol on apply; the group has pistol / Five-seveN (can) / torch / AKS-74U / FN2000 / ring airfoil / smoke can / stun can / magazine + clear (no knife item exists in throwables.ts) |
| | muzzle flash / sparks (K) · night vision (N) · rail light (L) | upper *shoot* (a round every 0.6 s; emitter anchors are gizmo nodes) — Effects group · NV on — RIG.goggles · light on + upper aim — RIG.pistol |

Left out (no backing code in the viewer / animator today): the interrogation exchange with bubbles, body drag, the two-man stack &
clear drill, the knife as a droppable item, the ring airfoil's flight (the game's launcher.ts needs a Game).

## Outliner

```
Stage                         → Stage & camera + Renderer in the sheet
  LIGHTS  key · fill · rim · rail light — Sam · torch / weapon light — guard   → intensity, enabled / lit, emitter radius, cone
  LOOSE ITEMS (n)  pistol · smoke …                                            → position / state, remove
  door marker                                                                  → the Door group
Figure: Sam (pistol) | guard (torch / pistol / carbine)                        → the Kit group
  SKELETON (collapsed)  trunk · left / right arm · left / right leg ▸ joints   → world position (read-only), orbit about it, close up
  ATTACHED PROPS  pistol ▸ slide / grip / suppressor / rail / lens · goggles ▸ housing / lenses · holster · knife ▸ … · torch ▸ … ·
                  guard pistol ▸ … · carbine ▸ … / support-hand grip point · FN2000 (in the hands: `sc20k` ▸ hull / butt / mag / grip / fore /
                  suppressor / rail / optic / foregrip / light / lens / grip point; slung: `sc20k.slung`, its own adj + off / bore / roll rows) ·
                  shot emitters ▸ bore jet / side ports / muzzle wisp
```
Clicking a prop row (or the prop in the view) selects it: the gizmo's arrows / rings appear on it and the sheet's top group becomes
**Selected: ‹path›** — the node's free adjustment `off xyz` (m) / `rot xyz` (°) as scrub fields (exactly what the handles drag: two views of
one value, revert dots against the shipped adj), *parent (U)* / *zero* / *deselect (Esc)*, then the structured RIG numbers behind that node
(`RIG.pistol.slide.l0 …`), then the whole `RIG.<group>`. The tree follows the kit: only props drawn this frame exist (slot / NV / guard decide).

## Properties (the sheet)

Composed top to bottom from: the selection's groups · **Figure** (always: body yaw, speed, crouch, upper body, aim pitch / yaw offset /
look yaw, right hand = holstered / pistol / canister, FN2000 = off / slung / in the hands, guard kit + carry, carbine, goggles / NV / light, die / respawn) · the variant's
groups · **Playback · clips** (pause, rate, turntable, raw clip + scrub, draw props, NV screen effect, gun smoke, emitter gizmos).

Numeric fields: **drag sideways on the number to scrub** (one step per 2 px; **Shift** = fine ×0.1, **Alt / Ctrl** = coarse ×10), click to
type (Enter / blur commits, Esc cancels), ↑ / ↓ or the wheel while typing. Sliders only where the range means something (0–1 weights,
angles with natural limits). A row off its shipped value turns gold and grows a **●** that reverts it. Groups over authored tables carry
*● changed*, **reset to shipped** and **copy constants**.

Groups: Locomotion (speed presets = the game's speeds, clip 1:1 = the natural clip speeds, speed, crouch, backpedal, path: treadmill /
2 m circle / back-and-forth 5 m / turn on the spot, deliberate, floor marks, ALL TWEAKS OFF, reset / copy) · the gait lab's groups (Clip
speeds, Gait blend, Head: gaze, Run: bounce / warps / linger, Run: soft knee, Standing: breathing / mass / weight shift, Standing: planted
feet, Crouch walk) · Tactical (stance, side, wall peek, lockpick, one-shot buttons, *loop this one-shot* + N s, spawn a can at release,
status line) · Long gun carriage, standing / crouched (`LONG` / `LONG_CROUCH.<carriage on show>` rows, steady rows, copy LONG tables) · Wall hold pose (`WALL_POSE` tree) · Hold (pose on,
figure, variant, phase, t, auto, gun out / pitch, agitation, fire past him, swap, let go, knife regardless, partner marker) · Hold contact
constants (`HOLD` tree) · Kit · Dropped items · Canisters · Effects: the shot · Smoke solver · RIG.goggles / pistol / torch / guardPistol /
knife / carbine / sc20k · Door marker · timings · Stage & camera · Renderer.

## Copy formats (paste-back)

* **RIG** — `rigSource()`: the complete `export const RIG: Rig = {…};` statement, byte-for-byte the old viewer's; paste over the block
  between the *paste target* markers in `src/game/rigProps.ts`. (Any RIG group's *copy*, ⚙ ▸ copy RIG, and the constants box follows the
  gizmo live while it shows RIG.)
* **LONG** — *copy LONG tables*: `export const LONG …= {…};` then `export const LONG_CROUCH …= {…};` then `export const LONG_STEADY = {…};` — paste over the three
  statements in `character.ts` (LONG_CROUCH ships as `cloneShape(LONG.…)` lines; the paste makes it a literal).
* **Gait constants** — the gait lab's block, unchanged: `// gait lab, <date> — paste over the matching lines in src/game/character.ts` +
  `defaultAnimParams / BLEND / BOB / RUN_WARP / SPRINT_WARP / RUN_LINGER / GAZE_EL + GAZE / LIFE / FEET` + the SNEAK comment line.
  `SOFT_KNEE` copies as its own one-liner (it was never in the block).
* **HOLD, WALL_POSE, effects (shot / canisters / smoke solver)** never had a paste format (their source lines carry comments): *copy*
  emits a *changed values* list — `HOLD.knife.hand = [-0.17, 1.555, 0.36];   // was [-0.165, 1.555, 0.36]` — to apply by hand.
* **⚙ ▸ copy ALL changed** concatenates every one of the above that has something off its shipped value.

## Controls

| | |
|---|---|
| mouse | **drag** orbit · **shift-drag / right-drag** pan (frees the focus) · **wheel** zoom · **click a prop** select |
| `F` `H` | frame the body · head close-up |
| `T` `P` | turntable · pause the character |
| `K` `X` | shoot · die (ragdoll, shot from the camera; again = respawn + die) |
| `N` `L` | night vision · rail light / torch |
| `G` `C` | guard kit · carbine (turns the guard kit on) |
| `0` `1` `2` · `4` | holstered · pistol · canister · the FN2000: not carried → slung → in the hands |
| `E` | with a hold posed: swap knife ↔ pistol |
| `U` `Esc` | select the parent node · deselect (Esc first closes the gear / all-knobs overlay) |
| `Tab` `` ` `` `[` `]` | inspector · debug views · exposure |

## Automation hooks

`__viewer` is the state object itself (`speed`, `crouch`, `upper`, `slot`, `rifle` (0 off · 1 slung · 2 in the hands), `guard`, `carbine`, `longStance`, `stance`, `stackSide`, `peek`,
`lockpick`, `tacShot / tacLoop / tacEvery`, `hold.{on,who,variant,phase,t,auto,…}`, `doorHand`, `door`, `nv`, `lightOn`, `paused`, … — set a
field and the next frame follows; `__viewer.drive = i` still takes the old DRIVES index) plus **`__viewer.scene('guard', 'carbine-shoulder')`**
(switch like the top bar; throws with the valid names) and `__viewer.select('rig:carbine.gripL' | 'light:key' | 'bone:head' | null)`.
Scene ids: `sam guard hold takedown door fx`; `__scenes` lists every variant id. The URL hash mirrors it: `#guard/carbine-shoulder&sel=rig:carbine.gripL`.

Unchanged: `__char` (getter: respawn replaces the Character), `__rig` (live RIG), `__rigSource()`, `__gizmo`, `__engine`, `__cam`, `__step(n)`,
`__toss(kind, suppressed?)`, `__cans.{smokeCan,stunCan}`, `__vtime`, `__shot(name)` (readback → capture sink on :5174), `__tac.{stance,peek,kick,
signal,flinch,throw,lockpick,loop,at,resume,long}` (stills: `__tac.at(0.38, 'kick')` pauses the clock, settles, fires, steps to t),
`__hold.set({...})` / `__hold.HOLD`, `__long.{LONG,source}`. New: `__M` (the gait meter: `slip cadence stance bob gaze gazeBob`, `line()`), `__lab`
(= `__viewer`), `__ui`, `__vui` (the viewer's chrome), `__vrt` (the viewer `Runtime` itself — it was `__rt`, which on the GAME page means the RT-reflection knobs;
one name, one meaning).

## Workflow

1. `#fx/nv`, `H`, toggle `N` a few times, scrub the `RIG.goggles` rows (or drag the handles) until the lenses sit on the eyes / forehead from all
   sides (turntable), check with *look yaw* and a crouch that they follow the skull.
2. `#fx/raillight` ▸ frame *hand*, sweep *aim pitch*: slide, can, rail body and lit lens stay rigid on the hand and the hot spot on the wall sits
   on the bore line; repeat with *relaxed* and a sprint.
3. *copy constants* (or ⚙ ▸ copy ALL changed), paste over the block(s), `bun run typecheck`, look at it in the game.
   The FN2000: `#sam/rifle-slung` from behind (⚙ ▸ back) for the sling's off / bore / roll or the group node's arrows; `#sam/rifle-calm` … `rifle-port` for the
   carriages with the bullpup (drag `sc20k.gripL` to move the left fist on the foregrip; the LONG rows are shared with the carbine); `#sam/rifle-fire` + K
   for the muzzle card (effects.ts `muzzleFx.sc20k`, UNTUNED).
   The FN2000: `#sam/rifle-slung` from behind and above (⚙ ▸ over the back) for the sling's off / bore / roll / follow or the group node's arrows — walk / crouch /
   kick him and it should stay flat on the back; `#sam/rifle-shoulder` (walk him), `rifle-crouch`, `rifle-low` (the sprint) for how he HOLDS it: LONG.shoulder /
   lowLong rows (`sway`, `steady`, hand offsets) + `LONG_STEADY.tau / runYaw`, with *steady against the gait ▸ off* for the before; `rifle-port` / `rifle-calm` the
4. Locomotion: `#sam/jog`, path *circle* with floor marks, watch the strip's slip / cadence while scrubbing *stance linger* / *jog stride ×*; flip
   ALL TWEAKS OFF for the before / after; *copy gait constants*.
