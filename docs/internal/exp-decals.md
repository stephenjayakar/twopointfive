# Experiment E1 — decals: bullet holes, stun scorches, boot scuffs, chips

Branch `exp/decals` (not merged; played from its own page). Default **on** here: `settings.decals`, frame flag
`4194304`, Tab ▸ *Renderer — decals (EXP)* (toggle · spray test pattern · +100 random · clear · stats),
`?nodecals` boots with it off.

## What to look at in the page

1. **Fire a magazine into the lobby wall under the desk lamp** (or any wall a torch is on): each round that stops in a
   static, a door leaf or a piece of furniture leaves a hole — near-black core, grey wipe ring, a jagged flake of paler
   substrate round it, bevelled so a grazing torch catches the far rim. Guards' misses do the same. Nothing on flesh,
   nothing on glowing fixtures (their light really goes instead), nothing through the sky.
2. **Throw a stun canister in the break room** (4, then LMB): a ~1.3 m soot splat on the lino under where it went off —
   dense over the inner third, thinning in fingers to a brown fringe, a scoured paler middle — plus one weaker splash up
   each wall / leaf / chair standing within a metre. On the polished floors the soot also kills the gloss reflection
   (turn *Indirect light ▸ EXP: glossy floors* on and look along the corridor lino).
3. **Kick the storage door** (sprint into it, or Space ▸ kick): a rubber scuff by the lock at boot height on YOUR face of
   the leaf — and it rides the leaf as it flies and swings back. Shoot a chair, then shove it: the hole goes with it.
4. The FN2000's ring airfoil (2, 2 again, RMB at a wall) knocks a small pale chip out of the plaster where it clacks.
5. Tab ▸ Renderer ▸ *spray test pattern* puts every kind in front of Sam at once; *+100 random* fills the interior for
   the cost figures below; the stats line shows count / cell entries / busiest cell / uploads / flag.

## Design as built

- **CPU** (`src/render/decals.ts`): a 512-entry ring (oldest recycled) of `{kind, pos, n, t, radius, param, seed}`.
  Marks on a *dynamic* box (door leaf, prop part) are stored in that box's local frame with a `Box` reference,
  re-derived every frame from where the box now stands (`sync`, a cached-index check when nothing moved) and restricted
  on the GPU to that box's pixels; marks on statics are world-fixed and paint any coplanar surface (a scorch crosses the
  rug on the floor). Bucketed into the level's 40×28 one-metre XZ cells (newest 48 kept per cell, 4096 list entries
  in all), packed into ONE read-only storage buffer — header · cell table (start16|count16 per cell) · index list ·
  3×vec4 records — and written only when the list changed (`stats.uploads`). Cleared with the level's state
  (`resetLevelState` → restart / tour hand-over). Never touches `Math.random` (the look seed counts), so seeded QA
  runs are byte for byte what they were.
- **GPU** (`src/render/shaders/decals.wgsl`, bound at the g-buffer's group 1 binding 3, FRAGMENT only): `fsBox`
  passes the fragment's world position (a new interpolated varying), face normal and box index to `decalSurface`,
  which reads its cell's word, walks the ≤ 48 entries — bounding-sphere reject on one load, then facing
  (cos ≥ 0.6) / plane distance (±3 cm) / owning-box tests — and edits what the g-buffer stores: **albedo** (darken +
  tint, the paler flake), the **normal** (tilted across the crater bevel by the flake's smooth outline only) and the
  albedo target's **alpha** = a gloss-keep factor that `composite.wgsl` multiplies the glossy floors' specular by
  (1.0 wherever no mark lies: untouched). Every edge is softened over the pixel's own footprint
  (`distance × 2·tan(fov/2) / screen height`) and sub-pixel texture (spall grain, soot mottle) fades under it, so a
  2 cm hole at 14 m neither aliases nor crawls (the g-buffer is not jittered; three sub-pixel-nudged frames in
  `docs/shots/exp_decals_gameplay_motionstrip.jpg`). Skinned characters are untouched.
- **Because it is the g-buffer that changes**, the traced direct light, the final gather's bounce *at the pixel* and
  the gloss term all answer without knowing decals exist (`docs/shots/exp_decals_group_debugviews.jpg`: direct-only ·
  bounce-only ×40 · indirect irradiance ×40 · albedo). What does NOT: the bounce *off* a marked surface onto its
  neighbours (secondary hits shade with the box's own material), and the AI's light meter (irradiance, not albedo —
  a scorched floor is not a darker place to stand). Storage-buffer budget: the fragment stage's 9th where the scene
  group carries 8 — inside the 10 Chrome offers on Metal, 7–8 on adapters where `frame.ts` already falls back.
- **Emit sites** (`src/game/marks.ts`, one call each): `combat.ts fireWeapon` → `bulletMark` (the prop it knocked,
  else the static / leaf it met; radius 2.5 cm pistol / 3.1 cm rifle, core scaled by the row's calibre; not through
  the panel at the muzzle); `combat.ts detonateStun` → `bangScorch` (down-ray for what it lay on — floor, desk, chair
  seat — r 0.62–0.9; sixteen level looks for ONE splash per box within a metre); `player.ts updateKick` at the impact
  and the guards' drill kick in `squad.ts RoomClear` (the breach showcase's boot) → `kickScuff` (kicker's face, by the
  lock, 0.8–0.92 m up, riding the leaf); `launcher.ts` clacks → `chipMark`.
  `markable()` refuses NoPrimary / NoShadow / emissive boxes and faces thinner than 12 mm; `clampTo` pulls a mark in
  from a face's edges by its radius and onto the face plane (no half-holes hanging off a jamb).

## Cost (M-series Mac, Chrome/Metal, 1600×1000 `?quality=high`, serialized frames, interleaved A/B)

The g-buffer render-pass timestamp does respond to fragment work offscreen, but at these sizes it sits at its noise
floor (±0.03 ms), so the honest figures come from `?decalStress=16` (the lookup evaluated 16× per fragment,
`decalDebug.repeat`; production is 1) divided back down; the un-amplified deltas agree with them.

| variant | g-buffer Δ per frame |
|---|---|
| flag down (no marks — the default until something is hit) | 0 |
| flag up, nothing marked on screen (one chip out on the lot) | +0.012 ms |
| 100 random interior marks, cubicles overview | +0.016 ms |
| 500 random interior marks — cubicles / corridor / break room views | +0.045 / +0.061 / +0.037 ms |
| pathological: a wall of 100 holes filling the frame at 1.85 m (one cell at its 48 cap for every pixel) | +0.57 ms |

Whole-frame wall time and every compute pass are unchanged within noise (the direct pass reads the same textures).
CPU: a rebuild + 45 KB write only on change, 0.1–0.35 ms for 500 (`stats.buildMs`); sync is a no-op while nothing
rides a moving box. So the per-cell list is enough — no finer structure was needed; the residual worst case is the
per-cell cap × a screen-filling cell, bounded by `DECAL_MAX_PER_CELL` (48: a magazine and a half into one square
metre before the oldest holes there stop drawing).

## Known uglies / limits (my own harsh read of the crops in `docs/shots/exp_decals_*.jpg`)

- `group_torch` (five 5.7 mm rounds at 2 m under a grazing torch, ×3): reads as holes in painted board — but the flake
  outline is value-noise "petals" rather than angular chips, the wipe ring's outer edge is airbrush-soft, and the two
  hairline cracks are all but invisible (deliberately faint after a first version drew spider legs). Overlapping
  flakes merge into one pale blob. In a blown-out torch pool the cores go grey, not black (correct for the exposure,
  looks odd).
- `scorch_lino` (×3): an irregular soot splat with a paler ring where the can lay; the edge lobes are soft and blobby
  (no fine spatter / droplets), the fingers are subtle, the brown fringe hardly shows on warm lino, and from the
  gameplay camera it is simply a dark ellipse. The "half under a desk shadow" staging never came off (my torch
  placements shadowed all or none of it); the tile shows the spot's edge crossing it instead.
- `scuff_door` (×3): a broad smear + two thin curved drags over a grime smudge — reads as *a* mark, not unmistakably a
  boot; earlier versions were dashed barcodes. Small from the gameplay camera.
- Splashes up walls are plain smaller scorches centred a hand up the wall, not a directional spray.
- Marks on statics paint anything coplanar within ±3 cm facing the same way: a hole at the very edge of a wall-art
  panel 2.5 cm proud of the wall also nicks the wall behind it; a scorch runs under a closed door's threshold.
- Off (`settings.decals` false) stops recording and drawing but keeps the list: on again shows the old marks.
- No decals on skinned characters, hand props, dropped items, sparks; ceilings (NoPrimary) and lit fixtures refuse
  them by design; the outdoor lot has no walls to catch a splash.
- Not visible to secondary rays or the light meter (above). The half-res gather smears the bevel normals a little in
  the indirect term (no artefact seen, ×40 tile).

## QA

- `bun run tools/qa/probes.ts decals` (family: `decals-ring` · `decals-sites` · `decals-follow` · `decals-off` ·
  `decals-identity`; identity also runs under `weapons`): the ring's order and the packed cell table entry by entry;
  the four emit sites (hole on the wall face facing out for Sam and for a guard, flesh / sky nothing, the floor scorch
  under the can + one splash up a wall half a metre off, the kick's scuff riding the storage leaf and turning with it,
  the ring's chip); a hole in a chair following the shoved chair to 0.1 mm with the right GPU slot + attached bit;
  off = nothing recorded / written; a seeded 15 s fight identical on vs off.
- `soak.ts` invariants: count ≤ cap every frame; every 5 s a hand sync + build with list-cap / stray-hidden / NaN
  checks; `decalsPeak` / `decalKinds` smells.
- Page: `window.__marks` = `{ test, random(n, seed), clear, bang(p), scuff(door, from) }`; `?decalStress=N`.
- Gates run here: typecheck clean; `probes.ts decals` / `weapons` / `player` / `breach` ALL PASS; `tour.ts --runs 2` PASS;
  `soak.ts --seeds 1,2 --minutes 6` no violations (decalsPeak reported). One pre-existing red on this branch's base
  (`rifle-slot` still pressing the pre-re-slot Digit4, and a dispatch block importing the deleted `sc20k-probes.ts`) is
  fixed here exactly as main fixed it since (`fn2000-probes.ts` two lines, the stale block dropped, `rifle-carry`
  registered once) — identical hunks, so the merge is clean.

## Files touched (merge risk)

Core renderer: `src/render/shaders/gbuffer.wgsl` (a `wp` varying on boxes; `fsBox` calls `decalSurface` under the
flag; the stress loop, inert at 1), `src/render/gbuffer.ts` (group 1 binding 3 + the extra `decalBuf` argument to
`encode`), `src/render/frame.ts` + `common.wgsl` (flag bit 4194304), `src/engine.ts` (settings.decals, `setDecals`,
`decalsOn`, `frame()` before the g-buffer, the flag, the buffer handed to `encode`), `composite.wgsl` (spec × albedo
alpha — 1.0 without marks). Game: `combat.ts` (2 lines), `player.ts` (1), `launcher.ts` (2), `props.ts` (raycast also
returns the part `box`), `game.ts` (field + construct + clear in `resetLevelState`), `main.ts` (`?nodecals`,
`?decalStress`, `__marks`), `squad.ts` (1 line), `ui/bindings.ts` (the section), `debugHooks.ts`. New: `src/render/decals.ts`,
`src/render/shaders/decals.wgsl`, `src/game/marks.ts`, `tools/qa/decals-probes.ts` (+ `probes.ts` dispatch,
`soak.ts` invariant).

## Publish

`bun run build && python3 tools/artifact-page.py` → `dist/artifact/index.html` + the chunk it names; the lead
publishes that page to a NEW URL for this
branch.
