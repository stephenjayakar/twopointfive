# The cut record: contract, version 1

2026-10-08 · part "Renderer draws and traces cut boxes" · branch `renderer-cut-boxes`, based on the build to play `20318fe`

For the glass part (Jz5fR) and the walls and furniture part (4HSKo): this is what you build pieces against. The type, the helper and the switch are in the first
commit on the branch (named at the bottom); the drawing and the rays land on the same branch after it, with no change to anything on this page. If anything here
has to change, the parent thread hears at once and this page gets a dated line under "Changes".

## 1. What a cut box is

A box may carry up to **8 planes** in its **own local frame** (origin at the box centre, axes the box's own, metres, before `yaw` / `rot`). Each plane keeps one side:

```
solid = { p : |p.x| ≤ h.x, |p.y| ≤ h.y, |p.z| ≤ h.z }  ∩  { p : n_k · p ≤ d_k  for every plane k }
```

`n` is a unit normal pointing at what is REMOVED, `d` is how far the plane stands from the box centre along `n`. Because the planes are local, they move, yaw and
tumble with the box for free. The solid is always convex. One plane makes a wedge or a snapped end, three or four across a thin slab make a glass shard, six or
eight off the corners make a lump of rubble.

## 2. The type (in `src/scene/cut.ts`, and one new field on `Box` in `src/scene/boxes.ts`)

```ts
export interface CutPlane { n: Vec3; d: number }     // box-local; the box keeps n · p ≤ d
export const MAX_CUT_PLANES = 8;

interface Box { …; cut?: CutPlane[];                 // absent or empty = a plain box
                   cutCore?: Vec3 }                  // optional: the colour the CUT faces show (see below); absent = the box's own
```

`cutCore` (added 10-08, optional, nothing changes without it): the colour a box's cut faces show in the picture, drawn matte: white gypsum under paint, pale wood
under varnish. The box's own six faces keep its albedo and finish. It is picture only: a ray that lands on a cut face (bounce, reflections, the light meter's
bounce) still reads the box's own colour. On a static, set it together with a fresh `cut` array (it is packed with the record).

Rules the record must obey (the builder below guarantees them; a hand-made record must too):

- every `n` is unit length; at most 8 planes; no plane that leaves the box untouched or removes all of it;
- the array is treated as immutable: to change the cut of a STATIC box, assign a new array (the upload compares its identity, as it does for `marks`); a dynamic
  box is repacked every frame anyway;
- nothing random: build records from hashes of a serial, never `Math.random` (the destruction lane's rule).

## 3. Building one (all pure, all in `src/scene/cut.ts`)

| helper | what it does |
| --- | --- |
| `cutThrough(p, n)` | the plane through local point `p`, removing the side `n` points to |
| `cutThrough3(a, b, c)` | the plane through three local points |
| `cutPlane(n, d)` | a plane from any (unnormalised) normal and offset |
| `cutRecord(h, planes)` → `{ cut, empty, dropped }` | THE builder: normalises, merges a plane given twice (or parallel planes) into the tighter one, drops planes that touch nothing or are redundant, keeps the 8 deepest if more are given (`dropped` says how many were left out: the piece is then slightly bigger than asked), says `empty` when nothing is left |
| `cutPrism(axis, halfT, poly)` → `{ off, h, cut, dropped, empty }` | a convex outline (points `(u, v)`, either winding) extruded ± `halfT` along `axis`: the fitted box and its record. `(u, v)` are the next two axes in order: axis x → (y, z), y → (z, x), z → (x, y). A glass shard is its cell's outline across the pane's thin axis; a wall chunk its outline across the wall's |
| `cutFit(h, cut)` → `{ off, h, cut }` and `fitCutBox(box)` | the same solid in the tightest box of the same orientation (`fitCutBox` moves the box's `c`, `h` and `cut` in place). Emit pieces FITTED: the uncut box is what collision, the trace grid and the raster's cover use |
| `cutVerts(h, cut)`, `cutBounds(h, cut)`, `cutContains(h, cut, p)` | the solid's corners, its local bounds, a point test |

```ts
import { cutBoxesOn, cutRecord, cutThrough, cutPrism, fitCutBox, cutToWorld } from '../scene/cut';

// a snapped plank end: one slanted plane across the long axis
const r = cutRecord(b.h, [cutThrough([b.h[0] * 0.6, 0, 0], [1, 0.4, 0.2])]);
if (cutBoxesOn() && !r.empty) { b.cut = r.cut; fitCutBox(b); }

// a glass shard from a triangle in the pane's plane (pane thin along local z), 6 mm thick
const s = cutPrism(2, 0.003, [[0, 0], [0.22, 0.03], [0.05, 0.31]]);
if (!s.empty) { const w = cutToWorld(s.off, pane.yaw); chunk.box.c = [pane.c[0] + w[0], pane.c[1] + w[1], pane.c[2] + w[2]]; chunk.box.h = s.h; chunk.box.cut = s.cut; }
```

## 4. The switch

One switch: `cutConfig.on` (`cutBoxesOn()`), raised once at boot by `?cutboxes` in the page's URL or `localStorage twopointsix.cutboxes = '1'` (`?nocutboxes` forces it
off). The shaders are compiled from it, so flipping it needs a reload. **Off = `Box.cut` is ignored by everything: the plain box, the base build's frame.**
So: emit cut pieces only when `cutBoxesOn()`, and emit your plain boxes otherwise (a cut piece drawn uncut is its whole bounding box). Headless: `CUTBOXES=1`
(or `0`) in front of any tool that stands the game up through `tools/qa/headless.ts` forces the switch (`CUT_BOXES` is read too); a replayed journal's own
`env.cutBoxes` wins over it; a probe may also set `cutConfig.on` itself before the stand-up.

## 5. What meets the cut, and what still meets the whole box

| | sees the CUT solid | still sees the UNCUT box |
| --- | --- | --- |
| picture | the rasteriser: cut faces drawn with their own normal and the box's bare material (albedo, finish, decals); markings and the detail layer (edge wear, grime) stay on the box's own faces, in the picture and at reflection hits alike | |
| GPU rays | every one: shadows, bounce / final gather, cascades, reflections, the light meter, smoke sight lines, particle collision (all through `common.wgsl isectBox`) | the trace grid's registration (a superset: costs a test, never a hit); the smoke solver's obstacle bake. The per-light reach masks treat a cut static as open ground (a ray decides), the safe direction |
| CPU | `rayBox` (so `BoxWorld.raycast`, `StaticCollision.raycast`, props' raycast: rounds, aim, throw arcs, lasers) and `lineBox` (so `segmentBlocked` / `solidBlocked` / `shotBlocked`: sight, sound, lines of fire) | everything that PUSHES: `collideCircle`, `gather`, the nav grid, debris and prop contact (support distance of the uncut box), `Box` bounds helpers |

So a fitted piece collides as its bounding box and looks, shades, shadows and blocks sight as the cut shape.

Not cut, by construction: a `Glass` pane box (panes are not rasterised or traced as boxes; a pane's holes are glassbreak's cell table). Fallen glass SHARDS are
ordinary debris boxes and do take a record. A `NoShadow` box is drawn cut and no ray meets it, as ever.

## 6. How it reaches the GPU (for reference; emitters need none of this)

- A cut box raises **bit 16 of its GPU flags word** (`GEO_CUT` in common.wgsl, 65536; the CPU's own bit 16, `SoundSeal`, is never uploaded, so the bit was free on the GPU).
  Only under the switch.
- The planes live in a **cut table in the tail of `boxMat`**, after the marking table and the glass cell table: 9 vec4 rows per box INDEX,
  row `CUT_BASE + 9·bi + k = (n.xyz, d)` of plane `k` < 8; an unused row is `(0, 0, 0, 1)` (the LAST row's w may be `1 + Box.cutArc` on a round: a trial, `scene/lorryTry.ts`) and a zero normal ends the record; row 8 = `(cutCore.rgb, 1)`, or
  zeros without a core colour. No new binding, no slot allocation, no
  dedup; a box can carry markings and a cut at once. 4096 boxes × 9 rows × 16 B = 590 KB, uploaded only over the index ranges packed that frame (the statics
  whose record changed, and the dynamics, a range each).
- A STATIC is re-packed when its `cut` is a different array than last frame: to change a static's cut, ASSIGN a new array (or `undefined`); planes edited in
  place are not noticed. Dynamics are packed every frame, so anything goes there.
- The raster draws cut boxes in a second instanced draw (the box's six faces + one quad per plane, fragments outside the solid discarded); plain boxes keep their
  draw and their shader.

## 7. Limits and cost

- 8 planes a box.
- **No cap on cut records of their own.** The table is addressed by box index and sized for every box the world can hold, so any box may carry a record. The
  only ceiling is the one every box already has: statics + dynamics ≤ `WORLD.maxBoxes` (4096) in a frame; past it `BoxWorld.upload` throws, cut or not, as on
  the base. Nothing is ever drawn uncut or dropped on the renderer's side: what bounds the count is whoever spawns the pieces (the debris pool's cap, the wall
  breaker's piece slots, the look fragments' cap). `engine.world.cutStats` (`__cut.stats`) = `{ boxes, planes }` listed by the last upload.
- A ray pays for a cut only on a cut box whose uncut slab it already hits: two dot products and a divide per plane, stopping at the first unused row. Keep
  big static pieces to the planes they need; small flying pieces can use all eight.
- Raster: 36 + 6 × 8 vertices per cut box instead of 36 (unused planes collapse).
- No measured GPU cost yet: there is no GPU in the cloud. The measured cost is the cost part's.

## 8. Status

- Landed on `renderer-cut-boxes`: the type, builders and switch; the CPU rays (`rayBox`, `lineBox`); the GPU rays (`common.wgsl isectCut` inside
  `isectBox`); the raster (`gbuffer_cut.wgsl`, a second pipeline that exists only under the switch); probes `bun run tools/qa/probes.ts cutboxes`.
- Checked in the cloud on SwiftShader (no GPU): every pipeline compiles with the switch on, cut pieces draw and shadow as their cut shape, and with the switch
  off the frame hashes as the base build. Notes and stills: `rebuild/cut-pieces/renderer/`.
- Debug hook on the page: `__cut.test(at, 'wedge' | 'shard' | 'snap' | 'lump')`, `__cut.clear()`, `__cut.stats`, `__cut.ray(o, d)`.
- A session journal (F10) records the switch (`env.cutBoxes`) and the replay harness raises it, so a recording made with cut pieces replays with them.
- `__cut.test(at, kind, { core: [r, g, b] })` stands a test piece with a core colour.

## Changes

- 10-08, renderer landing. Nothing about the record or the builders changed. Added: the static re-pack rule in §6 (assign a new array to re-cut a static);
  the detail layer joins markings in staying off cut faces (§5); the WGSL const for the bit is `GEO_CUT` (was written `BOX_CUT` here; emitters never name it).
- 10-08, later, three additions; nothing an emitter already does has to change. (1) `Box.cutCore`, optional (§2): the colour cut faces show; the table grew a
  ninth row per box for it (§6). (2) `cutRecord` merges a plane given twice and parallel planes before the 8-plane limit (found by the glass part: an outline
  with a point mid-edge could lose a real edge to the limit). (3) `CUTBOXES=1` for headless tools (§4), and the cap question answered in §7: there is no cap on
  cut records beyond the world's box count.
