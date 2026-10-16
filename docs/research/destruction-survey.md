# Destruction survey — glass that gives, furniture that fails, walls that leak (research, 2026-08-11)

The maintainer's ask, verbatim: *"can you kick off some research on how destruction works in games like control? both for glass (i'd like it to be
procedurally generated where it only shatters into pieces after a few bullets, and then breaks up based on where the bullet points are), furniture (we
already do this a little bit in chaos mode), etc. curious what fits into our frame budget, has some cool gameplay elements, wow factor (like the gpu
particle effects), and fits into our art style"* — plus the later framing: *"stuff like the seoul mission works really well too, where we're the quiet one
sneaking around when there are two loud teams going at it … we'd want the beats to be pretty heavily scripted but the actual destruction, etc., should be
dynamic"* (Splinter Cell: Chaos Theory's Seoul: NKPA and ROK forces in running firefights, both hostile to Fisher on sight [22]).

This is a survey of how shipped games do it, read against what THIS engine is: a box-only ray-traced renderer where every photon is dynamic, glass is an
analytic pane list (`SceneInfo.glass`, ≤ `MAX_GLASS` 32, 23 authored), destruction is a bounded, hash-deterministic heat model (`game/destruction.ts` +
`debris.ts`), particles are a 16 384-slot GPU pool with capped births, decals are a 512 ring, smoke is 64³ Eulerian domains (8, the expensive thing), and
guards see and hear through the same light meter, smoke field, sound propagation and floor materials the player is shown. Page: docs/review/destruction-research.html.

## 1. What the reference games actually do

**Control (Remedy / Northlight, 2019).** Johannes Richter's GDC 2020 talk [1][2] frames destruction as *granularity*: "nature is sort of a continuum
from very big objects down to dust and very thin veils of smoke", represented in three overlapping layers — rigid bodies ("chunks and parts of props and
environments — all of that is RBDs"), a middle layer of "mesh particles, rigid body hierarchies, and material decals", and sprite/mesh particles for
"embers, sparks, smoke, fire, splinters, gravel, sand" [2]. The economy is that fragments and reactions are authored **per material, not per object**
("grass spawns bits of leaves … concrete breaks into smaller concrete bits and then spawns dust; shoot a metal pipe and it spawns water" [2]) through a
Houdini pipeline that tags props with material metadata; props are hierarchies of parts joined by breakable connections, "so if you break a table in half
the parts will fall and collapse realistically" [3]. The budget model reported from the talk [4]: roughly 200 simultaneous dynamic objects, chunks in
excess demoted to sprite particles, collision throttled for a few frames after an explosion. (Those three numbers come from a secondary write-up of the
talk; the talk video [1] is the primary.) *What matters for us*: the layering (rigid few, particles many, decals free), per-material rules, and the hard
cap with graceful demotion — which is exactly the shape `destruction.ts` already has (debris pool 64/32 → refusal → chip burst).

**Rainbow Six Siege (Ubisoft / RealBlast, 2015)** — the primary source is Julien L'Heureux's GDC 2016 deck [5], and it is the closest engineering match to
the maintainer's glass ask. RealBlast's *surface* destruction is planar: "3D → 2D projection", "use arbitrary cutting polygons to cut a planar surface",
the cut pattern "depends on impact position in local space of object + combination of inputs and material parameters (cutter)", intersected by
Weiler–Atherton clipping and re-triangulated by ear clipping, then extruded back to 3D. Cutters come in classes: perimeter cutters (random ellipse,
spline), inner-fragment cutters (**Voronoi**), and ones that define both — "**Glass**, Texture" (a tileable crack motif generated in UV space) [5 slides
35–42]. The model under it is a "connection-based leaf graph": the game damages connections, the graph decides what is still attached [5 s.29–33]. Their
performance choices are the lesson: "**No procedurally cut dynamic fragments** — well-placed replacements, instanced, recycled aggressively; dynamic
fragments don't collide together; vaporize fragments on explosion; simple collision primitives (**always boxes**)" [5 s.54–55]; budgets "roughly 6 ms for
a wall", a single bullet hole 0.33 ms on PC / 1.1 ms on PS4 [5 s.58, 74]; work is asynchronous and time-sliced [5 s.61–68]. Determinism: "seed a RNG based
on some input value — on R6:S: based on impact position; with enough granularity, the player will never see it's the same" [5 s.81] — which is
`glass.ts hitSeed(bi, point)` word for word. And the systems it had to make dynamic are ours: "AI navigation navlink update", "destruction changes the
acoustic of the environment drastically — sound (& propagation) is an important feature", "AI visibility through partially broken walls" [5 s.25–26].
Gameplay-side, Siege's glass and barricades are thin surfaces where holes accumulate per bullet and windows are deliberately shot out for sight lines [6].

**Source engine `func_breakable_surf` (Half-Life 2 / CS:S window glass)** — the classic precedent for "shatters after a few bullets, based on where they
landed", and I read the shipped code [7]. A pane is a grid of ≤ 16 × 16 panels of 12 units. A bullet shatters the panel it hits, plus the neighbour if the
hit was within 0.2 of a panel edge, plus "occasionally" the one or two above; blast damage shatters a radius. Then `BreakThink` recomputes **support**
for every intact panel as a weighted sum of its neighbours (frame edges count as full support: bottom 1.25, sides/top 1.0, lower diagonals 1.0, upper
diagonals 0.25, normalised by `WINDOW_MAX_SUPPORT` 6.75) and iterates; any panel under `WINDOW_BREAK_SUPPORT` 0.20 × fragility either drops as a falling
pane entity or shatters in place, so an unsupported tongue of glass between two hit clusters falls out a beat later; the client draws each surviving
panel with an edge style chosen from the bitmask of broken neighbours. Tile surfaces skip the support pass. It is crude, fully deterministic given the
hits, costs nothing, and players remember it fondly — the bar to clear.

**Fracture placed at the impact.** The academic line the ask points at is Müller, Chentanez & Kim 2013 [8]: pre-authored *fracture patterns applied at
the impact location* at run time (the stated flaw of plain pre-fracture being that "the fracture pattern does not align with the impact location"),
with partial fracture at several places on one object. NVIDIA's APEX/Blast lineage productised the data model: a chunk hierarchy, a **support graph** of
bonds (chunk–chunk and chunk–world) carrying health, user "damage shader" functions (radial, shear), actors splitting into islands when bonds break, an
optional stress solver — and, pointedly, "no physics or collision representation … no graphics representation" [9]; APEX's authoring also had bitmap
"cutout" fracture for brick/glass motifs [10]. Unreal's Chaos is the same shape (Voronoi uniform / clustered / **radial** fracture, cluster levels, damage
thresholds, anchor fields) [11]. Parker & O'Brien's FEM fracture for The Force Unleashed [12] is the physically-serious end — irrelevant to boxes.

**Real glass** (forensics, SWGMAT [13]): radial cracks form first, from the impact outward (initiating on the far, tensioned face); concentric cracks
come second, "usually in straight segments that terminate in an existing radial crack"; a high-velocity projectile makes a **cone/crater** wider on the
exit side, often just a hole with short radials; and "the sequence of multiple impacts can be deduced when the cracks caused by a subsequent impact
terminate at previously formed cracks" — i.e. crack networks from several bullets partition the pane into cells bounded by each other's cracks, which
is why a Voronoi-of-impacts reads right. Glass TYPE decides the failure [14]: **annealed** breaks into large sharp shards progressively; **tempered**
(exterior/safety glazing) holds until its compression skin is breached and then **dices all at once** into cubes; **laminated** cracks into a held
spider-web and stays in the frame. Three behaviours, one parameter.

**Voxel / structural / server-side (contrast, not candidates).** Teardown [15] represents everything as voxels with an 8-bit material palette, splits
bodies by connectivity when voxels are removed, and for multiplayer replays destruction as "a stream of deterministic commands … 'cut hole in this shape
at voxel coord x,y,z'" in fixed-point — the determinism-by-command idea is ours already; the representation is not. Red Faction: Guerrilla's stress
system walks a building's supports over several frames and fails whatever carries more than its strength, chain-reacting [3][16]; DICE's Frostbite did
"remove a piece of the geometry → add detail meshes around the destroyed section → add the destruction mask (albedo + normal replacement via a distance
field / deferred decal) → particles and mesh debris" [17] — the decal-masking step is what our `damage` decals do in the g-buffer; The Finals runs the
whole simulation server-side so every client sees one truth [18]; Noita simulates every pixel in 64² chunks [19]. All of these solve scale or
multiplayer problems we do not have; none fits a 1 m trace grid of ≤ 4096 boxes.

## 2. Mapping onto this engine (the numbers)

Budget facts to price against: high tier ≤ 14 ms union p95 in the loud minute, calm office 8–11 ms; a tumbling shadow-casting dynamic box costs ≈ **0.03
ms** at high (P6: 8 → 64 boxes = 8.5 → 9.9 ms [image-quality §4]) and the debris pool is capped 64/32 for exactly that reason; a live smoke domain of dust
costs **+2 ms at high / +2.5–4 at ultra** while it hangs (shadow + gather rays sampling it) [destruction.md]; particles are ≈ free (2 000 live sheets +
a bang read at the 65 µs timer quantum), births capped 384/frame at high with a 512-record queue; decals are free (512 ring, ≤ 48/cell); the box list is
782 statics + ~300 dynamics of `MAX_BOXES` 4096, repacked on the CPU every frame (O(all)); glass is 23 of `MAX_GLASS` 32 uniform slots, ~22 slab tests per
glass pixel in composite + one mirror ray in fgather; `StaticCollision` skips `NoShadow` statics at query time (the destruction lane's runtime-hide
mechanism), so *hiding* a static costs nothing and un-blocks sight, sound, rounds and shins in one flag write.

| # | technique (source) | what it looks like HERE (boxes, quads, decals) | implementation sketch in our files | cost vs budget | bounded / deterministic | wow | stealth hooks | risk | verdict |
|---|---|---|---|---|---|---|---|---|---|
| G1 | **Impact-list crack growth** (SWGMAT radial→concentric; Siege glass cutter; Source panels) | each hit keeps its star decal; between hits the pane shows a hairline **Voronoi network of the impacts** (F2−F1 edge distance) + long radials that run to the frame as damage rises; laminated milkiness along cracks | `glass.ts`: per-pane `impacts[≤16] {u,v,energy,seed}` + `damage`; `boxes.ts packGlass` writes 4–5 more vec4 per pane (impacts as f16 pairs, cell mask, type); `composite.wgsl glassMarks` adds the Worley edge term + radial spokes per impact (analytic, AA like markings); `fgather glassShade` reflection ×(1+k·crack) as now | +16 distance evals per glass pixel ≈ < 0.05 ms; uniform +2.5 KB | ≤ 16 impacts/pane (17th merges into nearest), seeds = `hitSeed`; no Math.random | medium alone, high as the tell before G2 | every hit is already a `'glass'` event (0.85); crack density readable by the player as "one more and it goes" | Worley cracks are stylised, not fracture-exact — matches the flat art rule better than a texture | **Stage 1a** |
| G2 | **Cell drop-out = Voronoi cells of the impacts** (Source support pass; Müller impact-aligned patterns) | when a cell fails, that polygon of the pane vanishes (view, light, rounds pass), its outline stays as bright crack rims on the survivors; the tongue below an unsupported cluster follows a beat later; frame-hugging cells hang (laminated) | pane keeps ONE analytic slab; a 16-bit `dropped` mask (bit i = cell of impact i gone) rides in the pane record; `glassTrace`/composite/direct `glassTransmit`: nearest-impact lookup → hole; CPU `segmentBlocked/raycast/shotBlocked` get the same `paneOpenAt(bi, point)` test (rounds re-cast past a hole); support = Source's rule over the Delaunay neighbours (frame contact = support), evaluated on hit + 0.3 s think; `'glassBreak'` event level 1.0 / 40 m | 0 persistent GPU (fewer glass pixels, skipped mirror rays); CPU: ≤ 16-point tests on pane crossings only | cells ≤ 16/pane, drops hashed off `hitSeed`; smoke `obstaclesChanged` when ≥ ½ open | **high**: a pane coming apart piece by piece between two shooters | NEW hole = new ROUND path both ways (guards' `clearShot` starts returning true through it), new straight SOUND path (SoundPaths `solidBlocked`), exterior hole = storm GUST into the room (wind.ts source ∝ open area → smoke leans, papers lift, rain spray) | `direct.wgsl` tint-through-hole per shadow ray is the one hot loop — accept untinted-through-damaged-pane instead (GI/vol already ignore tint) | **Stage 1b** |
| G3 | **Shard particles** (Control's particle layer; Siege "always boxes, recycled") | falling cells become 20–60 thin oriented **glass quads** (the `sheet` kind's state rows) — tinted, two-sided, a GGX glint off the 3 shadow-tested lights + bloom → they *flash* through a torch beam; tempered panes instead **dice**: 200–400 3 cm cube chips at once | 7th particle kind `shard` in `particles.ts KIND_DEFAULTS` + `particles.wgsl` (sheet air with KN_Q≈1, no flutter lift, restitution 0.3, sleep flat) + splat branch (spec instead of albedo/π); `glass.ts dropCell → Particles.emit('shard', …, {aspect, size = cell extent/√n})`; CPU-scheduled `glassTinkle` sfx like `casingTink` | inside births cap (a pane = 1–2 frames of births); splat ≈ quantum | LONG ring recycles; seeds off the system serial | **very high** per ms — specular showers in beams are what this renderer does best | landing tinkles are `'prop'` 0.3 events blamed on the shooter (`Chunk.who` convention) → a calm man goes to look; Sam shooting glass as a lure | shards cast no shadows (accepted for sheets already); sort/alpha of transmissive quads → draw additive spec + tinted multiply approximated as premultiplied | **Stage 1b** |
| G4 | **Shards underfoot** (one model: floor materials change what guards hear) | a glitter patch on the floor under the pane (resting shard quads + a faint gloss-up decal) | `floor.ts`: runtime `patches[] {aabb, mat:'shards'}` consulted before the static map; `FLOOR.shards {loud 1.5, hard, sample 'glassCrunch'}`; `wet.ts`-style print of nothing; cleared in `resetLevelState` | 0 | ≤ 1 patch per pane | low visually, **high systemic** | Sam (and guards, and civilians) CRUNCH crossing it — footsteps ×1.5 hearing level through the same `footfall` both mixer and AI read; the QRF crossing their own breakage announces them to Sam | none | **Stage 1c** |
| G5 | Tempered vs annealed vs laminated as ONE authored param | exterior frontage dices whole (G3 cubes) on the Nth hit; interior partitions shard cell by cell; the manager's sidelight (laminated) spider-webs and never opens | `LevelData materials.glass.type` (`'annealed'|'tempered'|'laminated'`, default by `glassExt`/`glass` paint) → `Box.glassType` → threshold + failure mode in `glass.ts` | 0 | — | high (variety reads as physical) | tempered lobby panes = a one-shot loud opening + weather in; laminated = safe to hide behind, never a path | KEYS registry + validator + both load directions (the level-format rule) | **Stage 1b** |
| F1 | **Jointed box furniture** (Control prop hierarchies [3]; Blast bonds [9]) | a desk = top slab + pedestals: a pedestal shot through at E ≥ 4 hides and the top **hinges** down about its surviving edge until the free edge meets the floor, spilling its indexed clutter/paper; a shelf plank drops one end and its binders slide off; chairs finally topple | `destruction.ts index` gains `assemblies` found by shape (slab-on-supports); `Debris` gains kind `'slab'` with a 1-DOF hinge integrator (θ¨ = 3g/2L·cosθ, contact by `col.raycast` of the free edge) before going free/sleeping; supports → ordinary chunks; knock-offs reuse `knockOff`; `'prop'` 0.5 landing event | 1–3 dynamic casters per failure × 0.03 ms while moving; counts against the 64/32 pool | pool + `knocksPerSec`; hashed | medium-high (big silhouettes moving under panel light) | new LOW COVER shapes (a tilted desktop is a ramp of shadow); loud landings attributed to the shooters, not Sam; a toppled shelf can block a doorway line (nav: props already re-route men? statics do not — see risk) | a hidden static's footprint stays in the NAV grid and `collideCircle` skips NoShadow statics → men walk through where the pedestal was but not through the fallen top (dynamic box contact exists for props only) — needs the fallen slab registered as a prop-like obstacle | **Stage 2a** |
| F2 | **Dangling fixture** (physically-motivated light = the house taste) | a corridor panel / the storage bulb shot loose hangs by its flex from one end and **swings**, still lit but stuttering: penumbrae sweep the floor, the froxel beam swings through the gypsum dust, gloss floors mirror it | `lighting.ts`: fixture record gains `hang {pivot, θ, ω}` (spherical pendulum, damped, kicked by later rounds via the impulse record); the fixture's emissive box + its `RtLight` pos/dir rewritten per frame (light identity maps keep ReSTIR history); flicker = the existing restrike envelope; `'creak'` sfx | ≈ 0 (one moving light; ReSTIR is flat in light count) | ≤ 2 hanging at once; deterministic ODE | **highest wow per ms in this renderer** | the light METER swings with it → Sam crosses in the dark half of the period; guards' sight of him oscillates through the same meter — a pure Chaos Theory beat that emerges from a stray burst | hard moving shadow trails 1–2 frames (image-quality §4) — a ≤ 1 m/s pendulum is inside what P0/P4 found acceptable; cap swing speed | **Stage 2b** |
| F3 | **Extinguisher / CO₂ burst into the smoke solver** (Control: "shoot a metal pipe and it spawns water") | the corridor extinguisher (16.42, 1.0, 10.12) holed: a white jet then a cold plume that **sinks and rolls along the floor** (negative buoyancy), lit by the panels, marched by the guards' sight-line probe | `destruction.ts index` kind `'extinguisher'` (found by shape+paint red cylinder) → `smoke.emit({kind:'jet', temperature −0.4, density 6, ttl 8 s})` + `'hiss'` loop + `'prop'` 0.6 event; one per encounter | **+1–2 ms at high for ~10 s** (one domain — the same price as a thrown smoke can, inside the loud minute's 8) | 1 emitter, solver caps | high (a floor-hugging cloud in panel light) | Sam makes concealment with one suppressed round, at the price of a hiss the floor hears; hostiles' stray rounds can do it for him | domain budget contention with muzzle gas in a firefight (`smoke.budget()` gate already exists) | **Stage 2c** |
| F4 | Water: cooler bottle / sprinkler pipe → puddle | streak particles + a dark **Gloss puddle** slab growing on the lino that mirrors the swinging lamp; wet prints walking out of it | pooled thin `Dynamic` box (rough 0.1) laid 1 mm over the floor, radius eased; `wet.ts` soaks feet inside its AABB → existing `'wetprint'` decals; `floor.ts` patch `'wet'` (splash sample, loud 1.2) | RT reflections scale with glossy pixels on screen: ≈ +0.1–0.3 ms at high while the puddle is in view | ≤ 2 puddles | high on gloss floors | splashing footsteps heard; prints are player-visible evidence (guards ignoring prints is an existing residual) | reflection cost is view-dependent; medium tier RT ÷3 | Stage 2d (optional) |
| F5 | Vending front / server racks (material rules) | vending: the emissive marking field cracks (crack look 2, lit variant), the marking light stutters out, 4–6 can-sized chunks roll out clattering; racks: spark showers (`breakerSparkFx`), LED bitmaps die block by block, a wisp of smoke | `destruction.ts` rules keyed on the switchable kind / rack markings; cans = `Debris 'clutter'` chunks with a rolling friction hack; `markGain` blocks → 0 | ≈ 0 (+≤ 6 chunks) | caps as clutter | medium | **noise lure**: 3 s of rolling cans (`'prop'` 0.25 ×N) pulls a calm man; a darker break room | can rolling on 3-DOF debris looks boxy (it is boxes — on brand) | Stage 2e (cheap garnish) |
| W1 | **Drywall punch-through between box studs** (Siege soft walls; Frostbite remove-piece + detail + mask) | authored `Drywall` partitions = studs every 0.6 m (always solid) + sheet boxes; sustained fire opens **lattice-aligned rectangular holes** (12.5 cm cells, growing to a stud bay) with a chipped `damage` rim; light from the lit side stabs through the dust on the dark side — froxel beams through a ragged row of holes | level: `BoxData.wall:'drywall'` (KEYS + validator + officeGen); runtime: sheet static hidden, ≤ 4 remainder boxes from a 64-box pool placed round the hole (top/bottom/left/right strips), merged as holes grow; `reach.ts` masks of lights within range **re-dirtied** (else a "known dark" light never leaks); `smoke.obstaclesChanged`; gypsum puff + chips as now | +3 boxes/hole in one grid cell ≈ unmeasurable per ray; pool 64 boxes = ≤ 16 holes; CPU repack +64 boxes ≈ nothing; GI converges through the hole over ~0.5 s (looks like dust settling) | holes ≤ 4/wall, ≤ 16/encounter, lattice-snapped, hashed growth | **very high** (new light paths are THE showcase of a fully dynamic GI renderer) | murder holes both ways: `segmentBlocked` (eyes, cameras), `shotBlocked` (their fire), `solidBlocked` (sound straight through), light through the hole raises Sam's meter where he thought he was dark; never walkable (studs + ≥ 0.5 m sill strip) so NAV is untouched | biggest surgery: level format, officeGen partitions rebuilt as stud walls (box count +150?), reach-mask invalidation, tactics' corner logic seeing through holes; hole edges are axis-aligned rectangles by construction (fits the art rule, but say so) | **Stage 3** |
| X | Voxels (Teardown), stress graphs (RFG/Blast stress), FEM (DMM), mesh fracture libs (Chaos/Blast geometry), server-side sim (The Finals) | — | — | representation mismatch: no meshes, 1 m grid, 4096 boxes | — | — | — | — | **skip** |

Three things give the most wow per millisecond in THIS renderer, in order: **(F2) a shot-loose fixture swinging its light** (≈ 0 ms: moving penumbrae,
a swinging froxel beam, gloss reflections, and the light meter swinging with it); **(G2+G3) panes coming apart cell by cell into specular shard showers**
(≈ 0 ms persistent, particles at the timer quantum, and every hole is a new round/sound/wind path); **(W1) light through fresh holes in drywall into a
dark room** (a few boxes; the GI does the rest). The one recurring cost to police is smoke-solver density (dust, CO₂): +2 ms per hanging plume at high —
already gated by `smoke.budget()` and `puffDomains`.

## 3. Destruction in a scripted crossfire (the Seoul framing)

Principle: **beats scripted, breakage dynamic.** Who breaches which door when, where the firefight sets up, when the mains go — `squad.ts order()` /
`Guard.script` / `BreachDrill` / `qrf.ts` / `lighting.ts setBlackout` on a timeline. What breaks is only ever `fireWeapon → destr.round / glassHit` and
`detonateStun → destr.bang / crackNear` from REAL rounds the sides (teams.ts `operative` / `hostile` / `guard`) fire at each other through `stagedExchange`
or the alert AI — so a pane fails where their bursts actually landed, and two runs of the same beat break different things (seeded, so a capture still
repeats). Each technique above was also judged on *does it read from across the room while Sam watches* and *does it hand him an opportunity*.

1. **Conference-room siege** — hostiles (2) hold the conference room; operatives stack on its corridor door (the breach drill verbatim) while a second
   pair suppresses from the corridor's east end. Their rounds star the six partition panes (G1), cells drop between the mullions (G2), shards shower onto
   the corridor lino in the panel light (G3) and leave a crunching patch across Sam's obvious east–west route (G4); the holes turn the partition into a
   two-way firing line (both AIs' `clearShot` now pass) and carry corridor footsteps into the room. Sam needs the manager's office beyond: cross behind the
   stack during the bang, or go round through the cubicles. Systems: glass Stage 1, suppression, BreachDrill, tactics doorGate. Worst case: 6 panes × 16
   impacts, ≤ 6 failures × ~50 shards + one tempered-style dice never (interior) — births spread over frames; persistent GPU ≈ 0; the muzzle gas and
   flashes are the real cost and are already in the loud minute.
2. **Cubicle bay push** — the QRF element comes through the west stair door and pushes east through the cubicles at hostiles falling back on the break
   room. Tracers shred the fabric partitions, paper storms lift and re-lift under each bang (impulses), monitors die screen by screen so **the bay gets
   darker as the fight goes on** (light meter → Sam's concealment improves dynamically), gypsum dust off the corridor wall hangs in the torch cones
   (concealment the sight-line probe honours — measured: a man's detection through it drops to a seventh–two fifths for seconds), a ceiling tile lets go;
   with Stage 2 a desk pedestal gives and the top tilts its binders onto the floor (landings blamed on the shooters, `Chunk.who`, so Sam's debrief stays
   clean). Worst case: the measured +2–3.5 ms at high while dust hangs; debris ≤ 64; decal ring recycling bullet holes after ~40 s of sustained fire
   (oldest first — acceptable, say so on the page).
3. **Lobby, lights out, one lamp swinging** — scripted: operatives cut the mains at T+40 s (blackout beacons); dynamic: a hostile burst had already shot a
   lobby fixture loose (F2), so one lit panel swings on its flex over the reception stone, its pool sliding back and forth in the gloss; a stray burst
   takes a tempered frontage pane whole (G5) — 300 cubes glittering under the sodium lamps, then the storm gusts in through the opening (wind → papers,
   rain spray, moths scatter) and wet prints follow whoever uses it. Sam crosses the lobby in the dark half of each swing. Cost: ≈ 0 GPU beyond the
   blackout itself; one wind source.
4. **Server-room lift under cover of someone else's breach** — Sam wants the drive; operatives breach the manager's office next door with a stun (panes
   star, papers fly, the tile above drops), hostiles answer down the corridor; a stray round holes the corridor extinguisher (F3) and a cold white cloud
   rolls along the floor past the server-room door — eight seconds of concealment Sam did not have to make (or he makes it himself with one suppressed
   round and eats the hiss). Cost: one smoke domain, +1–2 ms for ~10 s.
5. **Break-room garnish** — the vending front cracks and stutters dark, cans roll out clattering (F5) and pull the one calm guard left on the floor away
   from the fire exit; the water-cooler bottle finally lets go into a puddle that mirrors the muzzle flashes (F4). Cheap, optional, funny.

Boundedness when two squads empty magazines for a minute (≈ 15 rounds/s sustained): heat saturates by construction; decals 12/s + holes → the 512 ring
turns over in ~40 s; puffs ≤ 8/s inside `puffDomains` 6; knock-offs 4/s; debris ≤ 64/32 with eviction; glass ≤ 16 impacts × 32 panes, shards through the
births cap and the LONG ring; tiles ≤ 8; drywall holes ≤ 16; hanging fixtures ≤ 2; extinguisher 1. Nothing allocates; everything hashes a serial.

## 4. Recommended staged plan

| stage | what ships | files it touches | cost (high, union) | risk | wow | stealth gameplay | QA gate |
|---|---|---|---|---|---|---|---|
| **1a** glass tells | per-pane impact list + Worley crack network + radial spokes; `damage` scalar; panel line | glass.ts, boxes.ts packGlass (+ SceneInfo words), common.wgsl glass record, composite/decals.wgsl glassMarks, glass-probes | < 0.05 ms | low | medium | readable "about to go" state; every hit already heard | `probes.ts glass` + identity: 0 impacts = today's frame hash |
| **1b** glass gives | Voronoi-cell drop-out with Source-style support, `glassType` param (annealed / tempered dice / laminated hold), `shard` particle kind (specular quads, tinkles), `'glassBreak'` event, holes pass rounds / sight-tint / sound / wind, smoke obstacle refresh | + collision.ts pane-open test, combat.ts re-cast, particles.ts/wgsl kind 6, wind.ts hole source, levelData KEYS `glassType`, sfx | ≈ 0 persistent; births-capped transients | medium (direct.wgsl tint loop: take the "damaged pane = untinted" shortcut) | **high** | new fire/sound/wind paths both ways; lure by shooting glass; tempered = loud one-shot opening | glass family re-frozen; soak stimulus `shoot-glass`; pane-open invariants (mask ⊆ impacts, ≤ 16); `__png` identity with no hits |
| **1c** shards underfoot | floor.ts runtime patches, `'shards'` material + `glassCrunch`, guards/civilians crunch too | floor.ts, audio sfx, glass.ts | 0 | low | low | one model: crunching footing under every broken pane | `probes.ts glass-sound` extended: Sam on shards heard at ×1.5 |
| **2a** furniture joints | assemblies by shape (desk tops on pedestals, shelf planks), `Debris 'slab'` hinge-then-free, clutter/paper spill, chair topple | destruction.ts, debris.ts, props.ts (fallen slab as obstacle) | ≤ 3 casters × 0.03 ms per failure; pool-capped | medium (nav/collision of fallen slabs) | medium-high | new low cover; loud landings blamed on shooters | destruction family + `player` (wall-clip brute force must stay green with fallen slabs) |
| **2b** dangling fixture | `hang` state on fixtures, pendulum + flicker, light + emissive box moved per frame, impulse-kickable | lighting.ts, effects (creak), destruction.ts rule | ≈ 0 | low-medium (moving hard shadow trail; cap ω) | **highest** | light meter swings → timing puzzle for Sam, oscillating guard sight | chaos-scenes P-new: swing lag/residue vs P0's numbers; `probes.ts lighting` |
| **2c** extinguisher → smoke | `'jet'` cold emitter, hiss, one per encounter | destruction.ts, smoke/types.ts, sfx | +1–2 ms for ~10 s | low (budget gate exists) | high | self-made concealment at a noise price | `__ds.sight()`-style transmittance probe; smoke budget invariant |
| 2d/2e | puddle + wet prints; vending cans; rack sparks | wet.ts, floor.ts, destruction.ts | +0.1–0.3 ms view-dependent / ≈ 0 | low | medium | splash steps; can lure | — |
| **3** drywall punch-through | `Drywall` walls as studs + sheets in the level, remainder-box hole pool, reach-mask invalidation, smoke obstacles, gypsum | levelData/levelLoad/officeGen/office.json, destruction.ts, reach.ts, boxes.ts, tactics.ts review | boxes ≈ 0; GI settles ~0.5 s | **high** (level format + generator + reach + AI seeing through holes) | **very high** | murder holes: sight, fire, sound and LIGHT both ways; never nav | level family (identity will go stale — say so), reach probes, `aim-door-sweep`-style trap sweep through holes, soak `--holes` |

Skip outright: voxelisation, stress solvers, FEM, mesh-fracture libraries, per-bullet geometric pinholes in 10 cm walls (sub-cell geometry for a 1 cm
hole is the wrong trade; W1's lattice holes after sustained fire are the box-native version).

## 5. Open questions for the maintainer (one-line decisions)

1. `GLASS_FAIL_HITS` — interior annealed pane: first cell drops on the **3rd** hit within 0.5 m (else 4th anywhere)? Tempered exterior dices on the **5th**? Laminated (sidelight, clerestory) never opens?
2. Reverse the 08-09 call explicitly: panes MAY open again (as cells, never the old whole-pane pop) — yes/no.
3. Do guards read wreckage as evidence (a shattered pane / fallen desk in a calm room → suspicious, like an open door), or stay ears-only as today?
4. Shards underfoot louder for EVERYONE (guards announce themselves on their own breakage) — confirm the one-model reading is wanted even when it helps Sam.
5. Dangling fixture: may a SECOND burst cut it down entirely (light dies, fixture becomes debris), or does it always keep swinging lit (the prettier lie)?
6. Extinguisher cloud: one per encounter and 8–10 s, priced like a smoke can — acceptable inside the loud minute's domain budget, or only when `smoke.budget() ≥ 6`?
7. Stage 3 changes the level format and makes `level-identity` stale until the generator is retired — green-light the format change now or park W1 behind G1b/F2?
8. Crossfire set-pieces: build them as a third showcase (`?crossfire`, like `?breach`) on the timeline runner first, or straight into the mission as an escalation tier above the QRF?
9. Bullet-hole decal turnover under a minute of two squads (512 ring ≈ 40 s): acceptable, or raise the ring to 1024 (buffer ×2, still one storage binding)?
10. Tempered dice count per pane (200 / 300 / 400 cubes) — a taste number for the sodium-lamp glitter vs the LONG ring's turnover.

## Sources

[1] Richter, J. (Remedy). *Destructible Environments in Control: Lessons in Procedural Destruction*, GDC Summer 2020 — https://gdcvault.com/play/1030643/ · video https://www.youtube.com/watch?v=kODJsQGXanU  
[2] Game Developer, "Using procedural destruction to unleash chaos in Control" (talk write-up, quotes) — https://www.gamedeveloper.com/production/using-procedural-destruction-to-unleash-chaos-in-i-control-i-  
[3] Brown, M. (GMTK), "How Games Do Destruction" (Control prop joints, RFG stress walk-through, Teardown, The Finals) — https://gmtk.substack.com/p/how-games-do-destruction  
[4] Kreonit, "How Destruction Works in Control" (secondary: the ~200-object cap, sprite demotion, collision throttling) — https://kreonit.com/programming-and-games-development/how-destrustion-works-in-control/  
[5] L'Heureux, J. (Ubisoft Montréal). *The Art of Destruction in Rainbow Six: Siege*, GDC 2016, slides — https://media.gdcvault.com/gdc2016/Presentations/LHeureux_Julien_Art_Of_Destruction.pdf · vault https://www.gdcvault.com/play/1023307/  
[6] Rainbow Six Wiki, "Destruction" (surface classes, glass/barricade rules) — https://rainbowsix.fandom.com/wiki/Destruction ; Ubisoft, interview with J. L'Heureux — https://news.ubisoft.com/en-us/article/4GHX2yepSaKkflLjLAlpwO/  
[7] Valve, Source SDK 2013, `game/server/func_breakablesurf.cpp` / `.h` (WINDOW_PANEL_SIZE 12, MAX_NUM_PANELS 16, RecalcSupport / BreakThink) — https://github.com/ValveSoftware/source-sdk-2013 ; entity docs https://developer.valvesoftware.com/wiki/Func_breakable_surf  
[8] Müller, M., Chentanez, N., Kim, T.-Y. "Real Time Dynamic Fracture with Volumetric Approximate Convex Decompositions", ACM TOG 32(4), 2013 — https://matthias-research.github.io/pages/publications/fractureSG2013.pdf  
[9] NVIDIA Blast SDK documentation (support graph, bonds, damage shaders, ExtStress) — https://nvidia-omniverse.github.io/PhysX/blast/index.html · https://github.com/NVIDIAGameWorks/Blast  
[10] NVIDIA APEX Destruction, FractureTool (Voronoi / slice / bitmap cutout fracture) — https://archive.docs.nvidia.com/gameworks/content/gameworkslibrary/physx/apexsdk/APEX_Destruction/FractureTool.html  
[11] Epic, Chaos Destruction overview / Fracturing Geometry Collections (uniform / clustered / radial Voronoi, cluster levels, damage thresholds, anchor fields) — https://dev.epicgames.com/documentation/en-us/unreal-engine/chaos-destruction-overview · https://dev.epicgames.com/documentation/unreal-engine/fracturing-geometry-collections-user-guide  
[12] Parker, E., O'Brien, J. "Real-Time Deformation and Fracture in a Game Environment", SCA 2009 — http://graphics.berkeley.edu/papers/Parker-RTD-2009-08/  
[13] SWGMAT, *Glass Fractures* (2004): radial then concentric, terminations order impacts, Hertzian cone — https://www.asteetrace.org/static/images/pdf/02%20Glass%20Fractures.pdf  
[14] Glass Technology Services, "6 glass breakage patterns" / ToughGlaze, "How glass breaks" (annealed shards, tempered dicing, laminated retention) — https://www.glass-ts.com/news/6-glass-breakage-patterns-and-how-to-identify-them/ · https://www.toughglaze.com/how-glass-breaks-and-why-it-matters  
[15] Gustafsson, D. Voxagon blog — "The unlikely story of Teardown Multiplayer" (2026, deterministic destruction commands, fixed-point) https://blog.voxagon.se/2026/03/13/teardown-multiplayer.html ; "Teardown design notes" https://blog.voxagon.se/2020/11/05/teardown-design-notes.html ; 80.lv interview https://80.lv/articles/teardown-developer-breaks-down-multiplayer-and-voxel-destruction-tech  
[16] The Ringer, "The Destruction (and Reconstruction) of Destructible Environments" (Volition / DICE / Embark developer quotes) — https://www.theringer.com/2024/02/02/video-games/destruction-video-games-battlefield-bad-company-red-faction-battlebit-teardown-the-finals ; Red Faction Wiki, Geo-Mod 2.0 — https://www.redfactionwiki.com/wiki/Geo-Mod_2.0  
[17] Kihl, R. (DICE). "Destruction Masking in Frostbite 2 using Volume Distance Fields", SIGGRAPH 2010 Advances course — https://advances.realtimerendering.com/s2010/Kihl-Destruction%20in%20Frostbite(SIGGRAPH%202010%20Advanced%20RealTime%20Rendering%20Course).pdf  
[18] Embark, *Engineering Mayhem: Technical Deep-Dive into Environmental Destruction in THE FINALS*, GDC 2024 — https://gdcvault.com/play/1034307/ ; Digital Trends preview (server-side destruction) — https://www.digitaltrends.com/gaming/the-finals-preview-destruction-will-make-developers-panic/  
[19] Purho, P. *Exploring the Tech and Design of Noita*, GDC 2019 (notes) — https://braindump.jethro.dev/posts/gdc_vault_exploring_the_tech_and_design_of_noita/  
[20] Hypesio, "Destruction in video games" (RealBlast 2D pipeline summary, connection graphs, networking modes) — https://hypesio.fr/en/destruction-in-video-games/  
[21] Game Developer, "Video: Why real-time destruction is the core of Rainbow Six: Siege" — https://www.gamedeveloper.com/design/video-why-real-time-destruction-is-the-core-of-i-rainbow-six-siege-i-  
[22] Splinter Cell Wiki, "Seoul" (Chaos Theory mission 8: NKPA vs ROK firefights, both hostile to Fisher) — https://splintercell.fandom.com/wiki/Seoul  

Engine-side references: docs/internal/destruction.md, docs/internal/exp-glass.md, docs/internal/image-quality.md §4, src/game/glass.ts, src/game/destruction.ts, src/game/debris.ts, src/game/sheetModel.ts, src/render/particles.ts, src/scene/boxes.ts, src/scene/collision.ts, src/game/floor.ts.
