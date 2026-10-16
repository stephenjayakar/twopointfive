# Glass that comes apart into rigid shards — the port (`feat/glassbreak`, worktree `.worktrees/glassbreak`, dev server :5252, shot sink :5253)

> **SUPERSEDED MODEL (2026-10-08).** The Voronoi-cell model this notebook describes (impact lists → cells → `failHits`) was replaced by the fracture model in
> `src/game/glassPattern.ts` + `glassbreak.ts` (radial cracks and chords per impact site, daggers once a pane runs, type by pane, a support rule that stands / hangs pieces,
> dice clumps for tempered, a web for laminated; a 36-row record per pane). The seams, the switch, the boot const and the off-identity argument below still hold; the cell
> rule, `failHits`, the 14-row record and the by-eye questions about cells do not. Plots: `bun run tools/qa/glass-plot.ts --out DIR`. Probes: `probes.ts glassbreak` (12).


## WHERE I AM / NEXT (resume block — update on every commit)

- Branch `feat/glassbreak` off main @ 66bdd89 (main since: 6b33e61, STATUS only). Source ported FROM (read-only): `.worktrees/physics` @ 3a07ae2, `src/pphys/glassbreak.ts` (with
  f220463 frozen sites + 2c051f7 chaos gate), its hooks (0428d71 CPU, 9ca440a GPU, 1aec648 gust). NOT brought: wallbreak, showcase, scenes, fire, water, sprinkler, Destruction.hideStatic.
- DONE: 14ec6d9 seams · 01e5bf0 GPU side · 45849bd the game module + hooks + `tune.glassBreak` · 92b0278 boot const / `__glassbreak` / Tab ▸ Destruction ▸ Glass · 505889f localised
  first cell + the instrument (`tools/qa/glassbreak-scenes.js` `__gbs`) + `tools/qa/cdp.ts` + proof shots / crops · caf8ffa probes (`probes.ts glassbreak`, 9 probes, + 7 under `glass`).
- GATES so far (all green): typecheck · `bun run build` · frame-layout ALL PASS · `sh tools/qa/gate.sh glass weapons destruction perf` exit 0 (glass 76/0 · weapons 67/0 · destruction 25/0 ·
  perf 24/0) · `probes.ts journal-fixtures` ALL PASS · panel-inventory PASS (0 missing, 7 added = the Glass rows; NOT re-frozen — additions pass, and a rewrite here would only conflict
  with other lanes' rows) · `probes.ts glass` on main (7 probes, 42 lines) vs the branch (14 probes, 76 lines): every main line present verbatim, all pass.
- IDENTITY (const false = main): HOLDS — §Identity. GPU validation: const ON and const OFF each 5 presets × views 0/1/3/10 with three panes holed, 20/20 clean both. COST: §Cost —
  nothing measurable (docs/perf/glassbreak-cost-high.json). ALL DELIVERABLES IN; the servers (:5252 lane, :5253 sink, :5254 main-beside) are STOPPED at hand-back.
- NEXT (for the lead): merge `feat/glassbreak` (no conflicts expected but tools/qa/probes.ts / bindings.ts / main.ts hunks beside other lanes'); the by-eye questions below.

## What this is

The GLASS half of the physics showcase's merge map (docs/internal/pphys.md in the physics worktree, "Review" §merge map steps 1–2): panes come apart CELL BY CELL where the
rounds landed (Voronoi cells of the impacts clipped to the pane, Source-style support), fallen cells become rigid `Debris` chunks of kind `'shard'` + chip particles, and the
hole is real to every consumer (view / mirror / shadow rays, rounds, sound, steps, the wind through an exterior pane). Behind ONE switch `tune.glassBreak`, default OFF;
off = main hash for hash (the GPU side is a compile-time prelude const `GLASS_BREAK` decided at boot from the persisted switch).

## What is on the branch (file by file)

- `src/game/glassbreak.ts` — the module (a game module like glass.ts): `GlassBreak` on `Game.glassBreak` (always constructed; attaches `world.glassCellFill`, `col.glassOpen`,
  `col.glassWalkable`), `GLASSBREAK` knobs, `GB_STATS`, `glassBreakLive(g)` = `tune.glassBreak && chaosOf(g) > 0` (the gate every entry point takes first: switch off / chaos 0 /
  the tour = the game byte for byte), `loadGlassBreak / saveGlassBreak / glassBreakPersisted` (localStorage `twopointsix.glassbreak`: on + failHits + dropSupport + blastM),
  `hit / blast / update / reset / openAt / walkable / openFraction / fill / breakTest / summary`. Ported verbatim but for: the review's nits (blast's range test before any state,
  the wasted `smoke.obstaclesChanged` dropped, a blast's first two seeded impacts on crackNear's stars — same seed, same construction), the movement rule (`walkable`, below), and
  ONE behaviour change found staging the proof: **the first cell out of a pane is LOCAL to the blow** (`localise`: an impact whose Voronoi cell exceeds `cellMaxM2` 0.3 m² gets
  5–7 zero-energy crack-tip sites on a hashed irregular ring of `ringR` 0.34 m ± 35 % round it before the cell is queued — two rounds in one spot used to bring the WHOLE 1 × 2 m sheet
  down as three slabs, since one site's cell is the sheet; now a hand-sized polygon drops and the sheet stands as wedges off the hole, each a cell a later round takes; tip sites
  draw no radials — composite skips `e ≤ 0`).
- `src/game/glass.ts` — two hooks: `glassHit` → `g.glassBreak?.hit` (cause ≠ 'bang'), `updateGlass` → `g.glassBreak?.blast` beside `crackNear`. Everything glass.ts did happens first.
- `src/game/game.ts` — `glassBreak` field, `tune.glassBreak: false`, `loadGlassBreak`, constructed after `destr`, `update(dt)` after `updateGlass`, `reset()` in `resetLevelState`
  after `destr.reset()` (the shards go with the debris pool). `src/game/debris.ts` — kind `'shard'` (tinkle on landing). `src/game/wind.ts` — `WindWhy 'glass'` branch (base written
  by the module each frame). `src/game/destruction.ts` — untouched (no `hideStatic`: that was wallbreak's).
- `src/scene/collision.ts` — `glassOpen(bi, p)` consulted by `raycast` (a round through a fallen cell flies on) and `segmentBlocked` (sound / a step / a line of fire through the
  hole; sight passed glass already), `glassWalkable(bi)` consulted by `collideCircle` and `gather` (the movement rule). Both null = the file as it was.
- `src/scene/boxes.ts` — `GB_STRIDE 14 / GB_ROWS 32×14`, `matBuf` + 7 KB tail, `glassCellFill` hook filled by `packGlass` in SceneInfo order, uploaded only while a pane has impacts.
- `src/render/frame.ts` — `glassBreakConfig` + the prelude line `const GLASS_BREAK: bool = …; const GB_BASE: u32 = MAX_BOXES * 4u + MARK_TABLE_ROWS;` (generated — the review's literal
  drift trap closed). `common.wgsl` — `gbHeader / gbSite / gbEnergy / gbUV / gbLocal / gbCell / glassCellOpen` + one `if (GLASS_BREAK)` line each in `glassTrace` and `glassTransmit`.
  `composite.wgsl` — `gbCracks` (network + radials + hole rims) + one `if (GLASS_BREAK)` line at each of the two `glassMarks` sites (`let gm` → `var gm`).
- `src/main.ts` — the const raised BEFORE the Engine from the persisted switch (`?glassbreak` / `?glassbreak=0` force one boot), `__glassbreak {on, gpu, live, knobs, stats, log,
  panes(), openAt(p, bi?), hit(bi, p, dir, n), blast(p), test(), reset(), summary()}`. `src/ui/bindings.ts` — Tab ▸ Destruction ▸ Glass: the switch (its tip and its message
  say RELOAD for the renderer's half; the section summary flags a const/switch mismatch), annealed / tempered fail counts, support threshold, blast reach, 'break test' (star + hole
  the pane under the cursor: three hits through glass.ts's path), 'reset glass'.
- QA: `tools/qa/glassbreak-probes.ts` (family `glassbreak`; gate/frozen/open/walk/caps/reset/gust also under `glass`), `tools/qa/glassbreak-scenes.js` (`__gbs`), `tools/qa/cdp.ts`
  (private headless Chrome over CDP — copied from the fix/render-parked lane).

## The movement rule (the review's gap)

A pane stays the obstacle it always was to a walker's capsule (`collideCircle`) and to shoved furniture (`gather`) until EVERY cell of it reaching below `walkClearH` 1.9 m has
fallen; then it is ignored by both (`PaneState.walkable`, recomputed on each drop over the frozen partition). So feet and `solidBlocked` never disagree about a pane a man could
pass: holed at head height only = a wall to his shins AND blocked to solidBlocked at shin height (probe glassbreak-walk holds both directions on a diced frontage sheet and a
head-holed partition sheet). The nav grid is NOT rebaked (A* keeps routing round the frame; a man pushed through walks it). In THIS office every sheet stands on a sill ≥ 0.5 m,
so a walkable pane never actually opens a route — the sill still meets the capsule; the rule is for levels with floor-to-ceiling glazing.

## Bounds, determinism, checkpoints

≤ 16 sites a pane (the 17th merges into the nearest; crack tips count), ≤ `shardsPerFrame` 6 rigid spawns a frame (+ ≤ 2: the last cell taken may add three), a diced pane ≤ 6
crumbs, chips through the particle birth cap; the debris pool is destruction's (cap 64 / 32 by tier): a spawn over the cap EVICTS the oldest resting chunk, with none resting it is
REFUSED and the shard is all chips (`GB_STATS.refused`) — so a charge among the conference panes can evict every resting tile / housing of an earlier burst (one pool, by design;
probe glassbreak-caps drives 19 panes apart with the pool never over 64). Every choice hashes the pane index, the impact point (`hitSeed`) or a serial; the module never touches
Math.random (glassbreak-determinism: two seeded volleys + a charge → identical sites / energies / masks / debris rest poses / events / particle records). Holes are NOT saved: a
checkpoint load is `restartEncounter` → `resetLevelState` → whole panes; no static is ever appended or resized, so `levelFingerprint` is untouched (glassbreak-reset asserts it with
two panes open) and `journal-fixtures` replays identically.

## Identity (const false = main), fresh boot per side per view, main @ 6b33e61 served beside on :5254

sharp-harness's `identityHash` recipe (seeded, parked, pinned, grain 0, 40 fixed steps, one offscreen render, FNV of the readback) + one crack star on pane 110 for the glazing view:

| view | tier | branch (`GLASS_BREAK false`) | main | |
|---|---|---|---|---|
| gb — conference glazing 109‥111 + a crack star on 110 (composite's glass path + glassMarks in the hash) | high 1777×1000 | `7d130353` | `7d130353` | = |
| gb | medium 1600×900 | `30c5d1ac` | `30c5d1ac` | = |
| v3 — cubicles under the panels | high | `6bf48737` | `6bf48737` | = |
| v2 — corridor torch on the north wall | high | `4520ccf3` | `4520ccf3` | = |

(Informational: booted with the const TRUE and no pane touched, gb and v3 also hash `7d130353` / `6bf48737` — the on-program over an all-zero table draws the same frame.)
CPU identity with the switch off: probe glassbreak-off (a seeded 30-round volley into the glazing + a charge, chaos 0.5: rounds / events / audio / particle records / decals /
furniture / debris / statics' flags identical with the module's three seams nulled; counters 0) and `journal-fixtures` (main's F10 sessions replay identically).

## GPU validation

`__gbs.validate()`: three panes holed and their shards down in the 'wide' view, then every preset × debug views 0 / 1 / 3 / 10, a `validation` error scope round 12 frames each +
the uncaptured-error list. Const ON (`?glassbreak`): 20 / 20 clean. Const OFF (`?glassbreak=0`, cells dropping on the CPU under main's programs): 20 / 20 clean. No console error on any
boot of the lane's page (104 / 104 pipelines with the const either way; the one 'Failed to load resource 404' is the favicon, as on main).

## Cost

docs/perf/glassbreak-cost-high.json. M4 Max (shared; `gpu-quiet.sh` before each take), high, the headless window's 1230×582 internal → 1600×757 out, the 'wide' view (panes 109–111 on
screen), serialized frames (onSubmittedWorkDone + a task yield each), medians. Render-pass stamps (post / fxaa / gbuffer) span the drawable wait — ignored as everywhere.

| take | union | direct | compS | sharpU | gather | reflect | particles |
|---|---|---|---|---|---|---|---|
| in-boot A: every pane whole (const on), 3 × 50 | 9.287 | 2.754 | 0.545 | 0.795 | 1.383 | 0.251 | — |
| in-boot B: three panes holed, shards down, 3 × 50 | 9.159 | 2.570 | 0.548 | 0.792 | 1.357 | 0.249 | 0.096 |
| cross-boot: const OFF, panes whole, 3 × 50 | 9.033 | 2.599 | 0.542 | 0.788 | 1.310 | 0.250 | — |
| cross-boot: const ON, panes whole, 3 × 50 | 9.095 | 2.653 | 0.543 | 0.791 | 1.319 | 0.249 | — |

Read: three holed panes filling a third of the frame cost nothing measurable (composite +0.003 ms; union −0.13 = noise — a hole is one fetch + ≤ 16 distance tests per pane crossing,
and it passes light untinted); the const itself with whole panes is +0.06 union / +0.05 direct across two boots, inside cross-boot noise (one extra `boxMat` fetch per pane crossing
per ray); const false = main's programs = 0 by construction. The CPU side: Voronoi / support ≤ 0.1 ms a think (the prototype's number; a think is 0.28 s apart and only for a pane
with something pending), the per-frame table fill ≤ 32 Map lookups + one 7 KB writeBuffer while any pane carries impacts.

## Known residuals / by-eye questions (carry to the maintainer)

1. **Shard opacity / albedo** — shards are OPAQUE pale boxes (`shardAlbedo` .72 .8 .82, rough 0.05); on the dark conference carpet they read as pale tiles more than glass
   (docs/shots/gb_crop_shards_carpet_x3.jpg). A Glass-flagged dynamic box would take one of the 32 pane slots each — not viable for dozens of shards. Alternatives to try by eye: a
   darker glass-grey (.4 .48 .5) that leans on the RT reflections' glint, or thinner + fewer shards with more chips.
2. **Fail counts** — annealed 3 hits (a spot hit twice goes at 2), tempered 5 then the whole sheet dices, laminated never; blast reach 2.6 m takes 3+ cells out of every annealed
   pane it reaches. All four are Tab rows.
3. **The first hole's polygon** — 5–7 crack tips on a jittered ring: still reads as a fairly regular polygon at ×3 (gb_crop_hole_corridor_x3.jpg); `ringR` / the jitter are the constants.
4. The hole's boundary is a per-pixel binary decision on the unjittered output raster under sharp direct: stair-steps at ×3 on diagonal edges (the frost rim sits on the intact side only).
5. Cracks + rims draw only under `FrameFlags.Decals` (up while any mark exists — every hole came with a star, so in play it always is; `?nodecals` = holes without drawn cracks).
6. `typeOf` / `exterior` no longer key on floor.ts `BUILDING`: a pane is OUTSIDE glass when open sky stands over exactly one of its faces (`skySide`: nine up-rays a side from mid height in the pane's own frame, ≥ 5 clear; the gust blows away from that face), on every level;
   the office comes out as the rectangle had it (15 of 22), records 7 of 7 (the rectangle said none), registry 6 of 7. Authoring a type per pane in the level file is still not there (`setType` is the override).
7. Muzzle smoke was switched off for the proof captures (three rounds from a metre fog the very pane being shown); the game keeps it.
