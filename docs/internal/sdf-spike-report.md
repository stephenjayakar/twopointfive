# SDF hero object — spike report

Branch `sdf-spike` (worktree `.worktrees/sdf-spike`), one commit of code (`856a3aa`) + this report. **Throwaway**: the point is what
it took and what it should cost, not the code. Written without a GPU or browser — every WGSL line here is uncompiled, every cost is
a reasoned expectation plus CPU-side statistics from a TypeScript port of the same field, and the measurement script at the bottom is
how the lead turns those into numbers.

## Headline findings

1. **The box grid is a perfectly good BVH top level for non-box things.** Registering the object's world AABB as an ordinary static
   `Box` with a new flag bit (`BoxFlag.Sdf = 128`, the last free bit of the GPU flag byte) means the DDA, the empty-run skipping, the per-cell
   24-slice height cull, the per-item quantised y extent and the direct pass's tile culling all deliver rays to the object with zero
   new traversal code. The three ray queries (`traceClosest`, `occluded`, `occludedT`) each needed one 6-line branch: "if the candidate
   item carries BOX_SDF, sphere-trace instead of slab-test". That is the whole tracing integration.
2. **Materials were the part that would have sprawled, and a cheap trick contained it:** every consumer looks materials up *by box
   index* (`hitRadiance`, the gather's inline hit shading, the composite's emissive fetch through the G-buffer id, the `BOX_EMISSIVE`
   early-outs). So each SDF material slot is a centimetre-sized `NoShadow|NoPrimary` "carrier" box parked under the floor, and an SDF
   hit reports `hit.idx = matBase + slot`. Nothing downstream changed — not `Hit`, not `lighting_common.wgsl`, not `fgather.wgsl`, not
   `composite.wgsl`, not the G-buffer formats. (Production should not do this; see §8. But it tells you the real interface an SDF
   object needs from the renderer: *an albedo, an emissive, an owner byte, per hit* — nothing else.)
3. **Primary visibility fits the existing G-buffer with `frag_depth` and no format change.** A 36-vertex proxy cube of the bound,
   same render pass / targets / depth buffer as the boxes and skinned characters, marched per fragment; depth-tested both ways against
   everything else because they share `depth32float` with `less`. Cost of that choice: early-z is off for the proxy draw only.
4. **Expected cost is small and concentrated, but there is one tax to measure first:** the sphere tracer is inlined into the three
   hottest functions in the renderer, so even with the object switched off its registers may lower occupancy for *every* ray
   ("uber-shader tax"). Measure `sdfHero=false` on this branch against `main` before anything else (§7, protocol step B0). If that
   delta is not ~0, production needs the SDF march out-of-line (separate any-hit pass or a specialised pipeline variant), which changes
   the design.
5. **Per-march work is low for this object**: CPU port statistics — primary rays converge in 3–7 field evaluations, moon shadow rays
   crossing the bound average 4.7 (max 27, none out of 48 steps), random secondary rays ~6 (0.8 % run out of a 24-step budget, all
   grazing). One field evaluation = 6 nodes ≈ 150 flops + 6 × 64 B of uniform reads, so a typical march ≈ 20–30 box slab tests. The
   expensive rays are silhouette grazers, exactly where the 8×8 SIMD divergence also bites (§6).
6. **Emissive SDF surfaces light the scene only through gather/cascade hits** (like emissive boxes before `AreaLit` existed): fine for
   the glowing pearl lighting its own bowl (large solid angle from the bowl walls), useless for "an SDF lamp lights the floor" (small
   solid angle → fireflies the gather clamps away). An emissive node that should really *light* things needs an analytic light with the
   node's geometry excluded from that light's shadow rays — the owner-byte mechanism already does exactly this for torches (§4).
7. **Estimate for a real v1** (several objects, data-driven, per-class LOD, CPU picking, tour-proof): **6–8 working days** (§9).

## 1. What was built (and how to toggle it)

* A ~1.55 m sculpture on a 0.4 m plinth at **(5.0, 0, 18.5)** in the lobby, against the west glazing: moonlit from the window side
  (the moon is a *sharp*-class light: crisp SDF-shaped shadow — ring included — thrown north-east across the stone floor toward
  reception), and under the two lobby ceiling panels when they are on (*broad* class; `__game.setGroup('lobby', true)`, which is also
  what the tour's opening shot does — that shot, captioned "Everything here is boxes", frames exactly this floor).
  Six nodes: plinth = round box 0.84×0.40×0.84 r 4 cm (slot 0 stone) · neck = capsule r 8.5 cm smooth-unioned k 12 cm (slot 1
  terracotta) · body = sphere r 0.33 at y 1.20, k 10 cm (slot 1) · ring = torus R 0.37 r 0.04 tilted 26°, k 5 cm (slot 2 pale) ·
  bite = sphere r 0.18 smooth-*subtracted* k 3.5 cm from the upper shoulder, facing up so the follow camera sees into it (slot 1) ·
  pearl = sphere r 7.5 cm unioned *after* the bite, resting in the bowl (slot 3, emissive (10, 4.2, 1.2)). The CPU port confirms the
  follow camera's ray (pitch 55°, yaw −22°) into the bowl lands on the pearl, and that the field is one continuous solid from y 0 to 1.525.
* Object-space bound (derived from the nodes, padded k/4 + 1 cm for the smooth-union bulge): x −0.43…0.478, y −0.02…1.565,
  z −0.45…0.43 → world box centre (5.024, 0.772, 18.49), half (0.454, 0.792, 0.44). It registers in grid cells x 4–5, z 18 (two
  cells; the tracer marches it once per ray regardless, see §3).
* The brief's suggested spot "(6.5, 0, 6.5), reception around x 4–9 z 3–9" is the conference room; the lobby is x 4–12, z 12.2–24
  (reception desk at (8.2, 15.2), spawn (5.1, 15.2)). The chosen spot is clear of the `lobby_break` patrol waypoint (6.5, 17.5), the
  low table (z ≥ 19.85) and the couch; nav bakes around it; headless tour ×1 and soak (2 seeds × 8 min) pass with it in place.

**Toggles** (Tab panel ▸ *SDF hero (spike)*, or `__engine.settings.*`):

| setting | default | effect |
|---|---|---|
| `sdfHero` | **true** | object exists. Off ⇒ its bound Box gets `NoShadow` before the frame's grid build (no ray ever meets a `BOX_SDF` item), the proxy draw is skipped, frame flag `2097152` clear. What remains vs `main`: one `flags & BOX_SDF` test per candidate box per ray + whatever the inlined tracer costs in registers (finding 4). |
| `sdfInGather` | true | per-ray-class LOD, frame flag `4194304`: `traceClosest` (final gather, cascade intervals) and `occluded` (secondary-vertex shadow rays inside `hitRadiance`, gather's `directAtPoint`, RC parent visibility, volumetric beam + smoke shadow rays) march the field. Off ⇒ those rays pass **through** the object (no bounce off it, no contact darkening round the plinth, no shadow in beams). The G-buffer and the direct pass's shadow rays (`occludedT`) always see it; **`probe.wgsl` (light meter / AI) forces it on** via a private override so the meter never disagrees with the shadow on screen. I chose *skip* over *opaque box* for the off state: a 0.9×1.6×0.9 m black box in the beams and in the GI would be a far more visible error than a little leaked bounce. |
| `sdfSteps` | 48 | step cap, primary + shadow rays |
| `sdfGatherSteps` | 24 | step cap, secondary rays (their own budget = what a per-class LOD does) |
| `sdfEpsMm` | 1.5 | surface epsilon; an out-of-steps ray within 8× of it is also a hit |

The uniform is repacked every frame (1.1 KB), so all of these are live.

## 2. Integration points touched (file : function — what, why)

| where | what | why |
|---|---|---|
| `src/scene/boxes.ts` : `BoxFlag` | `Sdf: 128` | route rays by item flag; bits 0–7 flags, 8–15 owner ⇒ 128 was the last free bit of the flag byte. Bits 16–31 of the GPU word are actually unused (`upload()` masks `& 0xff`), but the CPU numbering parks CPU-only flags there (`SoundSeal = 1<<16`), so a production `kind` byte at bits 16–23 means renumbering the CPU-only flags — cheap, but a real change to `BoxFlag`. |
| `src/scene/sdf.ts` (new) | node/material/object types; `objectBounds()`; `addHeroSculpture(boxes, origin, yaw)` appends the bound Box (`Sdf|NoPrimary`) + 4 carrier boxes and returns the desc; `packSdf()` → 1104 B | CPU half. Called at the end of `buildLevel()` so indices are level ≡ static indices and nothing earlier moves. |
| `src/scene/level.ts` : `buildLevel`, `Level.sdf` | one call + one optional field | placement. |
| `src/render/shaders/sdf.wgsl` (new, in the prelude after common.wgsl) | `struct SdfNode/SdfObject`, `@group(0) @binding(12) var<uniform> sdf`, iq primitives, `sdHero(p) → (d, slot)`, `sdfNormalWorld`, `sdfTrace(ro, rd, tmax, maxSteps) → (t, code)`, `sdfSecondaryOn()`, private `sdfMat` / `sdfForceSecondary` | the object itself. Uniform not storage: group 0 already holds 6 storage buffers and rc.wgsl adds 3 — the same per-stage-limit reason `smokeOcc` is a uniform. |
| `src/render/frame.ts` : `scenePrelude`, `createSceneLayout`, `SceneBuffers`, `createSceneBindGroup`, `FrameFlags` | append sdf.wgsl; binding 12 (uniform, **VERTEX**+FRAGMENT+COMPUTE — the proxy cube's vertex shader reads the bound); flags `Sdf = 2097152`, `SdfSecondary = 4194304` (1048576 left alone for the other lane) | every pass that includes the prelude gets the object; one bind group entry. |
| `src/render/shaders/common.wgsl` : consts | `FLAG_SDF`, `FLAG_SDF_SECONDARY`, `BOX_SDF` | — |
| `common.wgsl` : `traceClosest` | per ray: `sdfSec = sdfSecondaryOn()`, `sdfDone`; in the cell item loop, a `BOX_SDF` item → `sdfTrace(ro, rd, hit.t, sdf.steps.z)`; a hit sets `hit.t`, `hit.idx = sdf.info.z + sdfMat` (carrier), `code = 7|8`; after the walk `code 8 ⇒ hit.n = sdfNormalWorld(P)` (7 = inside ⇒ the existing `inside` path) | closest-hit semantics preserved: the DDA keeps walking while `tCell ≤ hit.t`, so a box nearer than the SDF hit in a later cell still wins, exactly as for a multi-cell box. |
| `common.wgsl` : `occluded` | same branch, `sdfTrace(...).x >= 0 ⇒ return true` under `sdfSecondaryOn()` | any-hit. |
| `common.wgsl` : `occludedT` | same branch under `FLAG_SDF` only (primary shadow rays always see it), budget `sdf.steps.y`, feeds `bestInCell` | the blocker distance drives the PCSS penumbra hint like a box face would. |
| `src/render/shaders/probe.wgsl` : `main` | `sdfForceSecondary = true;` | one model for picture and AI (finding in §1 table). |
| `src/render/shaders/gbuffer.wgsl` : `vsSdf` / `fsSdf` (new entry points) | proxy cube from `sdf.bmin/bmax/origin`; fragment: `rd = normalize(wp − camPos)`, `sdfTrace(camPos, rd, 400, sdf.steps.x)`, miss ⇒ `discard`, hit ⇒ albedo (rgba8) = carrier's `boxAlbedo`, normal (rgb10a2, n·0.5+0.5) = gradient, id (r32uint) = carrier index (owner 0, isChar 0, cap 0), `@builtin(frag_depth)` = clip.z/clip.w of the hit | §5. |
| `src/render/gbuffer.ts` : ctor, `encode(..., drawSdf)` | second render pipeline (same module/layout/targets/depth state, cull back), `draw(36, 1)` after boxes + skin when asked | — |
| `src/engine.ts` : `RenderSettings`, ctor, `ensureSceneBG`, `render` | 5 settings; `sdfBuf`; `sdfObject`; per frame: flip `NoShadow` on the bound Box **before** `world.upload()` (grid build), pack + write the uniform, set the two frame flags from the booleans (and strip them from `settings.flags`), pass `drawSdf` to the G-buffer | booleans are the single source of truth, like the lossless/lossy bits. |
| `src/main.ts` | `engine.sdfObject = level.sdf` | the viewer never sets it ⇒ count 0, flags never set, nothing drawn. |
| `src/ui/bindings.ts` | panel section | knobs for the measurements. |
| `src/smoke/smoke.wgsl` : `bakeObstacles` | skip mask `10u → 138u` | smoke drifts *through* the sculpture rather than round an invisible box (the lesser oddity; a real version voxelises the field: `sdHero(cellCentre) < 0`, trivially, since the bake already runs per cell). |
| `tools/sdf-wgsl-dump.ts` (new) | prints a pass assembled exactly as the engine compiles it | `bun run tools/sdf-wgsl-dump.ts direct \| pbcopy` then `await __wgsl(src, {prelude:false})` on **any** running page (even main's) compile-checks this branch without booting it. Names: direct fgather rc probe volumetrics gbuffer (softblur temporal dtemporal composite also work). |

Deliberately **not** touched: `Hit`, `lighting_common.wgsl`, `fgather.wgsl`, `direct.wgsl`, `volumetrics.wgsl`, `rc.wgsl`, `composite.wgsl`, denoisers, `lights.ts`, any CPU gameplay code.

## 3. Data layout

```
uniform SdfObject (group 0, binding 12), 1104 B:
  info   vec4u  x nodeCount (0 = none) · y bound box index · z matBase (carrier of slot 0) · w –
  steps  vec4u  x primary · y shadow · z secondary · w –
  origin vec4f  xyz world origin · w yaw   (Box convention: local +X → world (cos,0,−sin); yaw only, so |dir| and t are frame-invariant)
  bmin   vec4f  xyz object-space bound min · w eps (m)
  bmax   vec4f  xyz bound max · w –
  nodes  array<SdfNode,16>, 64 B each:
    p vec4f  centre (capsule: end a) · w = blend k of this node's op
    q vec4f  quaternion node-local→object (round box / torus / cylinder) — capsule: end b
    s vec4f  sphere r | round box hx hy hz r | torus R r | capsule r | cylinder halfH r
    m vec4u  kind (0 sphere 1 roundBox 2 torus 3 capsule 4 cylinder) · op (0 ∪ smooth, 1 ∖ smooth) · material slot · –
fold: d = 1e9; for node i in order: d = op ? smax(d, −dᵢ, k) : smin(d, dᵢ, k)   (polynomial smin, bulge ≤ k/4)
material at p: slot of the node with the smallest |dᵢ(p)| (so a subtraction's carved wall takes the subtractor's slot)
boxes: bound = Box{c,h,yaw, flags Sdf|NoPrimary} (grid item + CPU collision + nav + LOS); carriers = Box{h 1 cm, y −0.6, NoShadow|NoPrimary, albedo/emissive of the slot}
```

## 4. Exactness / ordering questions hit, and what I did

* **Closest vs any hit.** `traceClosest`: the SDF hit is recorded like a box hit and the DDA continues while `tCell ≤ hit.t`, so
  ordering against boxes in later cells is exact (same argument as a box registered in several cells). `occluded`: trivially fine.
  `occludedT` returns "nearest blocker *in the first cell that has one*": an SDF hit lying in the bound's *second* cell is returned
  from the *first* cell's iteration, so a thin box in that second cell nearer than the SDF surface would be skipped for the hint — the
  same near-first approximation multi-cell boxes already have there; it only widens/narrows a penumbra hint.
* **Multi-cell registration ⇒ re-marching.** A box re-tested in a later cell costs one slab test and is a no-op under the strict `<`;
  an SDF re-tested would cost a whole march. `sdfDone` (one bool per ray) marches it once: exact, because a later cell could only ask
  over a sub-interval (`hit.t` only shrinks; `tmax` fixed for the any-hit queries) of what the first march already covered.
* **Height cull / empty-run skip stay exact for free**: the packed item's qmin/qmax and the cell masks come from the bound Box like any
  other; the SDF surface is inside the bound by construction (`objectBounds` pads each additive node by k/4 + 1 cm; the CPU port
  measures min field value on the bound's faces = +1.0 cm). Caveat: that is *tight* — a node list edited by hand without re-deriving
  the bound would clip silently. Production: derive always, assert `field > 0` on the faces at build (the CPU port does it in 20 lines).
* **Tie order**: SDF vs box at equal t — strict `<` keeps whichever was found first (DDA order), same rule as box vs box.
* **Self-intersection on curved surfaces.** Two different origins matter:
  *Shadow rays from SDF pixels* (direct pass): `Po = P + N·0.015` with P rebuilt from `depth32float` (error ≈ 0.1 mm at 20 m) and N
  from rgb10a2 (≈0.2 % direction error). Field(Po) ≈ 13–16 mm ≫ eps 1.5 mm, and the march only moves *away* on the lit side. CPU
  port: 1486 lit-side surface points (N·L > 0.2), zero blocked within 1 cm / zero "inside at start". Concave regions (the bowl, the
  smooth-union fillets) self-shadow legitimately. *Secondary rays* start at `P + N·0.01/0.02` (existing constants) — same margin.
  So **no SDF-specific offset was needed**; the renderer's existing 1–2 cm normal offsets are an order of magnitude above eps. If eps is
  raised toward 10 mm (panel allows it) expect acne: the offset/eps ratio is the invariant, not either number.
* **Origin inside the solid** (a cascade probe centre inside the body, a gather origin under a fillet): reported as code 7 / t 0 —
  "blocked from the start", radiance 0 — precisely what `isectBox` answers for a box, so probes inside the sculpture behave like probes
  inside a cabinet (RC visibility weighting already handles those).
* **Out of steps.** The one knowingly inexact rule: a ray that exhausts its budget while `d < 8·eps` counts as a hit, otherwise it is
  let through. Grazing silhouette rays are the population (CPU port: 0.8 % of random secondary rays at 24 steps, 0 at 48). For shadow
  rays "let through" = a faint light fringe along the silhouette's shadow edge, which the penumbra filter blurs anyway; the opposite
  policy (out of steps ⇒ blocked) gives a dark fringe. Neither is visible at 48; at `sdfSteps 8–16` you should see it — worth one capture.
* **Lipschitz honesty.** All six primitives are exact distances; polynomial smin/smax of exact fields is ≤ the true distance to the
  blended surface in practice but not provably 1-Lipschitz everywhere — over-relaxation (ω≈1.2–1.6) was left out for that reason (and
  because marches already converge in ~5 evaluations: nothing to win).
* **`NoShadow` / `NoPrimary` semantics kept**: `NoShadow` on the bound = object invisible to every ray (that *is* the off switch);
  `NoPrimary` on the bound = the box raster skips it (the proxy pass draws the field instead). Owner byte: the bound's owner is 0 so
  `skipsOwner` never drops it; an SDF prop bolted to a character would put the character id in the bound's owner byte and inherit
  self-shadow masking for free — the branch sits *after* the `skipsOwner` test on purpose.
* **Globals**: a bound big enough to become a "global" (footprint > 96 cells) would be slab-tested as a box by the globals loop (no
  `BOX_SDF` test there). Irrelevant for props; noted.

## 5. What the G-buffer path needed

Formats matched exactly (`rgba8unorm` albedo, `rgb10a2unorm` n·0.5+0.5, `r32uint` id = boxIdx | owner<<20 | isChar<<28 | cap<<29,
`depth32float`), so **no consumer can tell an SDF pixel from a box pixel**: direct.wgsl rebuilds P from depth and takes owner from the
id; fgather the same (+ its `directAtPoint` reprojection test `distance < 0.12 && dot(N) > 0.7` works on the curved surface); the
composite fetches `boxEmissive(id & 0xFFFFF)` → the pearl glows on screen through its carrier; temporal reprojection is depth-based.
`frag_depth` + `depth32float` + `less` was *not* awkward — WGSL takes `@builtin(frag_depth)` in the output struct, WebGPU has no
conservative-depth qualifier so the only price is early-z off for that one draw (the proxy covers a few % of the screen). The proxy is
built from the *uniform's* bound, not from the grid Box, so raster and tracer agree bit for bit; front faces only (`cullMode: 'back'`)
since the follow camera (distance ≥ 6 m) never enters a 1.6 m bound — a first-person camera would need back faces + `max(tEnter, 0)`
(the march already clamps). Rejected alternative: a compute pass overwriting G-buffer texels — needs depth as a storage/readable
texture, a second write path for three formats, and manual depth compare; strictly worse here.
Things to **look for** in captures (I could not): (a) the silhouette against the floor should be clean to the pixel — eps 1.5 mm vs
≈9 mm/px at the default zoom; (b) `debugView 2` (normals) should show smooth gradients with no faceting and no 2 mm-stencil noise;
(c) `debugView 6` (depth) continuous across box/SDF contacts (plinth on floor); (d) the penumbra filter uses plane-distance + normal
weights, so on the curved body it will blur *less* than on a wall → slightly grainier soft shadows *on* the sculpture under the panels;
(e) FXAA handles the proxy silhouette like any other edge.

## 6. Cost / divergence expectations per pass (reasoning; numbers to be filled by §7)

Per field evaluation: 6 nodes, ≈150 flops (two quaternion rotations dominate — an interpreter cost; codegen folds them for unrotated
nodes) + 6×64 B uniform loads (constant cache, broadcast across the wave: cheap). Per march: entry slab test + mean 4.7–6.3
evaluations (CPU port), silhouettes up to ~27; a hit in `traceClosest`/G-buffer adds 4 evaluations for the normal.
So **one march ≈ 20–30 slab tests; a grazing one ≈ 100+.**

| pass | who marches | expectation (M4 Max, 1600×1000 high, object on screen at default zoom) |
|---|---|---|
| gbuffer (+proxy) | every proxy fragment (≈2–4 % of pixels at dist 19; ≈15 % zoomed to 7 m) × (5–7 evals + 4 normal) | +0.05–0.2 ms; render-pass timestamps are unreliable on Metal (CLAUDE.md) — judge by total frame time or by the compute passes staying put. |
| direct (`occludedT`) | shadow rays whose segment crosses cells (4–5, 18) below y 1.6: the moon-shadow wedge NE of the object, panel shadows W of it, rays from the sculpture's own pixels; ×(samples per leader: up to 8 sharp / 4 broad, adaptive) | +0.2–0.6 ms. **Divergence is the multiplier**: an 8×8 tile where 3 pixels' rays cross the bound holds the whole SIMD group for the march. The tile culling does not help (it culls lights, not occluders). |
| softblur / dtemporal | nothing new | 0 (indirectly: more hint-carrying tiles near the new shadow ⇒ a hair more filter work). |
| gather (`traceClosest` + `occluded` via `directAtPoint`/`hitRadiance`) | cosine rays from pixels within a few metres whose direction hits the bound's cells; 4 rays/px at half res | +0.3–1.0 ms with `sdfInGather`, ≈0 without. Register pressure from the inlined tracer may show here even when off (finding 4). |
| rc c0–c3 (`traceClosest`, `occluded` in parent visibility + `hitRadiance`) | intervals crossing two grid cells out of 1120, height-culled above 1.6 m | +0.05–0.2 ms total; c0/c1 (short intervals near the object) more than c2/c3. |
| volumetrics (`occluded`) | beam march samples whose light segment crosses the bound: moon has `volumetric 0.05`, panels 0 ⇒ almost nothing in the lobby; a guard torch pointed at the sculpture is the worst case (steps × 1 ray) | ≈0 normally; +0.1–0.3 ms with a torch beam on it. |
| probe | 6 dirs × lights × ≤ a few queries | negligible (forced on). |
| **off-tax** (`sdfHero=false` vs `main`) | every ray: one extra flag AND+branch per candidate item; plus register allocation of three functions that now *contain* a march loop | **the number I most want**: if direct/gather/rc move by more than ~1–2 % with the object off, the inlined design is wrong for production. |

## 7. Measurement script for the lead

**Boot this branch** (its `common.wgsl` differs, so `__wgsl` on main's page can only check it via the dump tool):
`PORT=5180 bun run dev` in `.worktrees/sdf-spike` → `http://localhost:5180/?paused&quality=high&mute`. First look at the console for
`[WGSL error]` lines (13 shader modules share the prelude, so one error in sdf.wgsl is reported 13 times — read the first). If it is easier, compile
first from any page: `bun run tools/sdf-wgsl-dump.ts gbuffer | pbcopy`, then `await __wgsl(<paste>, {prelude:false})` (repeat with
`direct`, `fgather`, `rc`, `probe`, `volumetrics`).

Run `bun run tools/shot-server.ts` (:5174) alongside for `__png`. Paste once (framing + timing helpers; follows CLAUDE.md's protocol:
serialised frames + MessageChannel yield, compute passes only):
```js
window.__testVisible = true; __menu.close();
const S = __engine.settings, dev = __engine.device;
const yieldMC = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
async function frames(n) { for (let i = 0; i < n; i++) { __runFrames(1); await dev.queue.onSubmittedWorkDone(); await yieldMC(); } }
function park() {                       // determinism: guards held far away with torches off, Sam's rail light off, lobby panels on
  __game.guards.forEach(g => { g.hold = true; g.flashlight.enabled = false; });
  __game.player.pistol.lightOn = false; __game.setGroup('lobby', true);
  [...__game.guards.map(g => g.char), __game.player.char].forEach(c => { if (c.anim) c.anim.phase = 0; });
}
async function frame(name, player, yawDeg, dist) {   // the follow cam targets the player: stand him next to the piece
  __game.teleportPlayer(player); __cam.yaw = yawDeg * Math.PI / 180; __cam.desiredDistance = __cam.distance = dist;
  __resetClock(); await frames(45);                  // let the camera damp onto him and the histories settle
  console.log('framed', name);
}
const F = {   // three framings: establishing (≈ the tour's opening shot), close three-quarter, close from the window side
  wide:  () => frame('wide',  [6.6, 0, 17.0], -22, 16),
  close: () => frame('close', [5.9, 0, 17.7], -22, 7),
  side:  () => frame('side',  [5.9, 0, 17.7],  68, 7),
};
const PASSES = ['direct', 'softblur', 'gather', 'temporal', 'rc c0', 'rc c1', 'rc c2', 'rc c3', 'rc dice', 'volumetrics', 'probe'];
async function time(label, patch, n = 40) {
  Object.assign(S, patch); await frames(12);                       // warm-up (grid rebuild, histories)
  const acc = new Map(); for (let i = 0; i < n; i++) { await frames(1); for (const [k, v] of __engine.timer.results) acc.set(k, (acc.get(k) ?? 0) + v); }
  const row = Object.fromEntries(PASSES.filter(p => acc.has(p)).map(p => [p, +(acc.get(p) / n).toFixed(3)]));
  row.total = +PASSES.reduce((s, p) => s + (acc.get(p) ?? 0) / n, 0).toFixed(3); console.log(label, JSON.stringify(row)); return row;
}
async function views(prefix) {           // final / direct-only / indirect-only / normals / depth, losslessly
  for (const [v, name] of [[0, 'final'], [3, 'direct'], [4, 'indirect'], [2, 'normals'], [6, 'depth']]) { S.debugView = v; await frames(2); console.log(await __png(`${prefix}_${name}`)); }
  S.debugView = 0;
}
park();
```
**A. Does it work at all** (close framing): `await F.close(); await views('sdf_close_on');` then
`S.sdfHero = false; await frames(20); await views('sdf_close_off'); S.sdfHero = true;` and `await F.side(); await views('sdf_side_on')`.
Crop (CLAUDE.md: 200–400 px tiles, ×3–4): ① the silhouette of body + ring against the floor, ② the moon shadow on the floor NE of the
plinth (should show the ring as a thin loop and soften correctly — moon radius 0.009 rad), ③ the bowl: pearl glow on the bowl walls
in `indirect` (that is emissive-through-gather working) and the pearl itself in `final`, ④ the plinth/floor contact in `indirect` with
`sdfInGather` on vs off (contact darkening should vanish when off), ⑤ `normals` over the smooth-union fillets (neck→plinth, ring→body):
continuous gradients, no banding from rgb10a2 beyond what boxes show, ⑥ `depth`: no seam where plinth meets floor.
Then the failure hunts: `S.sdfSteps = 8` (expect holes/fringes at silhouettes — confirms the out-of-steps rule is what you see),
`S.sdfEpsMm = 8` (expect acne in the fillets and a fatter silhouette), back to 48 / 1.5.
**B. Timing** (do `wide` and `close`; interleave as listed, twice, and average — A/B/A/B per CLAUDE.md):
```
B0  main @ 07f2e5a, same URL/framing/park()      ← baseline for the off-tax (separate boot on :5173)
B1  await time('off',            { sdfHero: false })
B2  await time('prim+shadow 48', { sdfHero: true, sdfInGather: false, sdfSteps: 48 })
B3  await time('all 48/24',      { sdfHero: true, sdfInGather: true,  sdfSteps: 48, sdfGatherSteps: 24 })
B4  await time('all 24/24',      { sdfSteps: 24 })
B5  await time('all 96/24',      { sdfSteps: 96 })
B6  await time('all 48/48',      { sdfSteps: 48, sdfGatherSteps: 48 })
B1  again … (reverse order on the second lap)
```
Report per pass: B1−B0 (off-tax), B2−B1 (primary+shadow), B3−B2 (secondary), B4/B5 vs B3 (step sensitivity: I expect ~flat, since
marches converge in ≈5 evaluations — if 96 costs visibly more than 48, grazing rays dominate and the LOD budget matters), B6 vs B3.
The G-buffer cost is only visible as total-frame delta (render-pass timestamps lie on Metal); `S.debugView` must be 0 while timing.
**C. Two sanity interactions**: walk Sam into the plinth (he should stop ≈3–5 cm outside the visible stone: the collision box is the
bound, half 0.454 vs plinth 0.42), and stand him in the sculpture's moon shadow with the HUD up: `player E=` should drop (probe rays
see the object even with `sdfInGather` off).

## 8. How materials / emissive plug into the light pipeline — and what production should do instead

* Today's path for the pearl: its carrier box has a non-zero emissive, so `BoxWorld.upload()` sets `BOX_EMISSIVE` on it, hence
  (a) the composite adds `boxEmissive(carrier)` at the pearl's pixels (on-screen glow + bloom), and (b) `hitRadiance` / fgather's
  inline hit shading add it whenever a cascade interval or a gather ray *hits the pearl* ⇒ the bowl walls and the nearby body receive
  orange bounce. That is the complete list. **No shadow ray is ever aimed at it**, so
  a surface that sees the pearl under a small solid angle gets a rare, bright gather sample → the firefly clamp (`lum > 24`) eats it →
  systematic darkening rather than noise. Fine for a jewel in a bowl; wrong for a lamp.
* "Does an emissive SDF node become an area light?" Not by itself: `game.ts` derives kind-3 disk lights only from *switchable* thin
  emissive **boxes** (thinnest axis ≤ 6 cm, area ≥ 0.01 m², side chosen by a segment test) and then sets `AreaLit` so rays ignore the
  box's own emission. The equivalent for a node: emit a point light (sphere node: `radius = r`, kind 0) or a disk (flat round box /
  cylinder cap: kind 3) at the node, mark the *slot* "area-lit" (needs one bit — the carrier box's `AreaLit` flag works unchanged since
  consumers test `boxGeo[carrier].flags`!), **and stop the node's own geometry from shadowing its light**: give the object an owner id
  and set `light.owner` to it — `skipsOwner` then drops the whole object for that light's shadow rays, which is right for a bulb on a
  stalk and wrong for a lamp inside a cage (the cage should shadow). Per-node exclusion would need the march to skip one node for one
  light: a `skipNode` parameter threaded through `sdfTrace` — doable, ugly. Estimated: half a day for the owner-based version.
* Production should drop the carrier boxes: give `Hit` a compact material (`albedo: vec3f, emis: vec3f` or a `matId` into a real
  material table shared by boxes and SDF objects), and give the G-buffer an emissive path that does not go through a box index (either
  an `rgba16f` emissive target — +8 B/px — or a material-id in the id texture's free bits 20–27 when owner is 0). The carrier trick
  costs 4 boxes per object and couples SDF materials to `maxBoxes`; it was right for a spike because it made the diff 380 lines.

## 9. What a production version should do differently (and the estimate)

1. **Object table, not a singleton**: `array<SdfObject>` in a *storage* buffer (needs the storage-buffer budget: rc.wgsl is at 6+3;
   either raise `maxStorageBuffersPerShaderStage` reliance — already requested at adapter max — or move `lights` to uniform, which was
   measured slower on Apple), node lists concatenated, per-object `firstNode/count/bound/transform/stepScale`. The grid item's box
   index → object index via a small indirection (`boxMat` row of the bound box has 4 spare-able floats: store the object index there —
   no new binding). `sdfDone` becomes "last object id marched".
2. **Data-driven palette vs codegen.** Interpreter (this spike): any object editable live, one pipeline; costs a `switch` per node per
   evaluation and unfoldable quaternion maths. Codegen (emit `fn sdObject_k(p)` WGSL from the TS description, `switch (objKind)` at
   the call site): 2–4× cheaper evaluations, constants folded, but a pipeline rebuild (13 modules, ~1 s) per edit and shader bloat per
   object *kind*. Recommendation: **interpreter for authoring (viewer), codegen for shipped kinds** — the TS description is the same.
3. **BVH per object** only when node counts pass ~16–24: a flat list with per-node bound-sphere early-outs (`if |p−c| − R > d, skip`)
   gets most of the win first (each node's field is ≥ its bounding-sphere distance). Not needed at 6 nodes.
4. **LOD per ray class** — keep the split, but by *caller*, not by query function: this spike proves the mechanism
   (`sdfForceSecondary` set by probe.wgsl); production wants `sdfClass` = {primary, shadow, gather, cascade, volume, probe} set by each
   pass's entry point, mapping to (steps, eps, on/off, maybe "coarse field" = first N nodes only). Cascades c2+ (intervals ≥ 10 m
   away) could see bound-as-box or nothing.
5. **Cone-traced eps for primary rays** (eps ∝ t · pixel angle) and over-relaxation once the fields are guaranteed bounds.
6. **CPU picking / collision**: port `sdHero` to TS (the port used for this report is 25 lines and matched the shader's decisions);
   cursor/aim (`world.raycast`, which today passes *through* the bound because of `NoPrimary`), bullets (`col.raycast`, which today
   stops *at the bound*: sparks off invisible air 3 cm from the stone), and `collideCircle` (sample the field at capsule height, push
   out along the gradient) all want it. Nav can stay on the bound.
7. **Smoke**: voxelise the field in `bakeObstacles` (one evaluation per cell inside the bound) instead of skipping it.
8. **Tour / QA**: the headless harness never sees rendering; add a probe-based assertion ("meter drops in the sculpture's shadow") so
   the AI/picture agreement is regression-tested.
9. **Kill the flag-bit dependence**: a `kind` byte in the GPU flag word (bits 16–23 are free once the CPU-only flags move up) so
   SDF objects and any future non-box kinds share one `switch` in the three queries instead of one flag bit each.

**Estimate for v1** (multi-object storage table + indirection, material path without carriers incl. G-buffer emissive, per-caller
LOD, owner-based analytic light for emissive nodes, CPU port for cursor/bullets/collision, smoke voxelisation, viewer authoring page
with live interpreter, tour stop + QA probe assertion, measured and tuned on device): **6–8 days**; +2 if codegen for shipped kinds is
in scope; +1–2 if finding 4 forces the march out of line (a separate "SDF any-hit" formulation per pass is real surgery in direct.wgsl).

## 10. Hacks, dead ends, and what I could not resolve without a GPU

* **Uncompiled WGSL.** The WGSL could not be compiled offline. Everything
  was instead reviewed by hand against the spec's sharp edges (no mixed `&&`/`||` without parens, bitwise-vs-relational parens, `discard`
  behaviour, swizzles from vec2 to vec3, uniform layout rules, module-scope order independence — sdf.wgsl's declarations are used by
  common.wgsl above them, which WGSL allows). Risk that remains: a Tint-specific nit (e.g. an identifier I believe is unreserved —
  `mid`, `ext`, `slot` — or an unreachable-code warning promoted somewhere). First boot will tell; fixes should be one-liners.
* **Not verified visually**: everything in §5's "look for" list, the pearl's brightness (emissive (10, 4.2, 1.2) was picked by analogy
  with the panels' 11 and the street lamp's 40 — may bloom too much or read dull), the terracotta albedo under sodium/moon light, whether
  the ring's 4 cm tube survives FXAA at the wide framing (≈4 px), and whether the smooth-union fillets read as intended or as blobs.
* **Not measured**: all of §6. In particular the off-tax (finding 4) decides the production architecture and I can only argue about it.
* **Hacks by design**: carrier boxes (§8); the bound doubling as gameplay collision (player stops in air up to 5 cm from the plinth,
  bullets hit air, cursor passes through); `sdfDone` instead of single-cell placement; smoke passing through; the 8·eps out-of-steps rule;
  the panel's epsilon slider going far past sane values on purpose (to *see* acne); the object repacked every frame.
* **Dead end avoided on purpose**: an "opaque box" LOD for secondary rays — it would have been less code than skipping but puts a
  box-shaped hole in the beams and the bounce, which is the kind of defect this project grades hardest.
* **Brief vs level**: the coordinates in the brief pointed at the conference room; the lobby placement above is my call (moon + panels
  + the tour's opening framing), easy to move: `addHeroSculpture(boxes, [x, 0, z], yaw)` in `level.ts` — keep it off patrol waypoints
  and ≥ 0.8 m from furniture for the 0.3 m capsules, and re-read §1's cell note if it straddles more than two cells (harmless, but the
  CPU collision box grows with yaw).

## 11. Measured on the reference machine (lead, 08-07, M4 Max, Chrome/Tint, 1777×1000 "high" with the folded trade-offs)

**Compile / correctness.** The whole branch — proxy-cube G-buffer path with `frag_depth`, the three trace branches, `sdf.wgsl` —
compiled on the live device on the FIRST boot with no console or validation errors (383 lines of never-compiled WGSL). The object
renders as designed: smooth shading on the sphere/torus/capsule/round box with no faceting, correct depth composition against floor,
furniture and the skinned character, a crisp SDF-shaped moon shadow on the stone (ring and neck included), self-shadowing of the
ring onto the body, and the emissive pearl lighting its bowl through gather hits exactly as §6 predicted (warm ring in the
indirect-only view, no fireflies). One cosmetic defect: a small dark speck on the pearl in the final view (looks like epsilon /
seam acne where the pearl meets the smooth-subtracted bowl) — would need the usual per-material offset tuning.

**Timing** (serialized frames, medians of ~35 frames after warm-up, interleaved; compute passes only):

| case | direct | gather | cascades | TOTAL | Δ vs branch-off |
|---|---|---|---|---|---|
| base `07f2e5a` (no SDF code at all), wide lobby view | 9.6–9.7 | 2.12 | 2.1 | **18.2** | −0.35 |
| branch, `sdfHero=false` (code present, object off) | 10.04 | 2.19 | 2.20 | **18.55** | 0 |
| branch, object ON, `sdfInGather=true`, steps 48/24 | 10.75 | 2.62 | 2.33 | **19.8** | **+1.25** |
| … `sdfInGather=false` (gather/cascade rays see nothing) | 10.77 | 2.19 | 2.25 | 19.33 | +0.8 |
| … steps 96/48 | 10.78 | 2.62 | 2.51 | 20.07 | +1.5 |
| … steps 24/12 | 10.72 | 2.58 | 2.32 | 19.77 | +1.2 |
| close view (object ~3× the pixels), OFF → ON | 10.27 → 10.87 | 2.32 → 3.01 | 2.22 → 2.35 | 18.9 → **20.3** | +1.4 |

Readings: (1) the **uber-shader tax is real but small: +0.35 ms/frame (+1.9 %), all of it in the direct pass (+0.4 ms, +4 %)** with the
object switched off — the inlined tracer costs occupancy on rays that never meet it. Production should compile it out with an
override constant / pipeline variant so a level without SDF objects pays nothing. (2) **One hero object costs +1.25…1.4 ms (~7 %)**
at this resolution, split direct ≈ 0.6–0.7 (moon + panel shadow rays crossing two grid cells), gather ≈ 0.4–0.7, cascades ≈ 0.1.
(3) Step budget hardly matters (24 ≈ 48; 96 adds 0.25 ms in the cascades) — marches converge in a handful of evaluations as the CPU
port said; cost is dominated by the rays that enter the bound at all, i.e. by screen/grid footprint, not by march length. (4) The
per-ray-class LOD switch is worth keeping: dropping the object from gather/cascade rays saves a third of its cost and the bounce
it then lacks is invisible at this object size (an emissive node is the exception — the pearl's bowl glow needs gather hits).

**Verdict.** Feasible exactly along the lines of the report: the grid-as-top-level + carrier-material trick + proxy-cube primary path
all held up on the GPU first time; budget ~1–1.5 ms per hero object of this size at 1777×1000, plus a fixed ~0.35 ms unless the
tracer is compiled out when unused. The v1 estimate (6–8 days) stands; the first production task is the pipeline specialisation, the
second is replacing carrier boxes with a real per-hit material interface. Code discarded as agreed (branch `sdf-spike` deleted after
this note); frames kept: `docs/shots/board_sdf_spike.jpg` (final, close), and the report lives here.
