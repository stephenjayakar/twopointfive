# What cut pieces cost a frame

2026-10-09 00:55Z (first version 00:25Z; added since: the worst case, the gate test, the heads) · part of the goal "Broken pieces and shards are not plain boxes".
Instrument and raw numbers: the branch this file is on (the renderer at `00eaff8` plus the measuring tools). Not in the single build of 10-09.

## Short answer

- **Nothing here ran on a real GPU.** Frames were timed in headless Chromium on a software renderer (SwiftShader, 13 to 15 s a frame). Those times are
  only good as ratios, and for the main finding even the ratio may not carry over to a Mac. The check at the bottom settles it in about a minute.
- **The cut itself is free as far as software can tell.** The same broken room drawn with its pieces cut and with the same pieces as whole boxes:
  −0.8 % after a blast, −0.9 % with the glass shot out (both inside the noise), +2.5 % in a synthetic view where a third of the screen is
  8-plane lumps, +3 % in the worst a blast could leave (364 cut pieces at once: the full pool, 260 small fragments, 40 edge plates).
- **The switch itself is not free in software: +9 to +14 % of every frame, with or without anything broken.** Calm room 1.09 and 1.14 (two methods),
  blast room 1.13, glass 1.13. It is the same number in all three cases, so it is not the pieces: it is the extra branch in the ray-box test. I think
  a real GPU skips that branch and the software renderer does not, so on your Mac I expect 0 to 0.1 ms. That is an inference. If it did carry over
  whole it would be about 1.5 ms of the 10 to 11 ms frame.
- **CPU: small.** Packing boxes for the GPU costs 0.05 to 0.06 ms more a frame on this box, under 0.01 ms on yours.
- **Ship direction: ON with no switch, if the Mac check shows the calm room within 0.1 ms.** If it shows more than about 0.2 ms, fix that first. The
  small fix I named first (a once-a-frame "any cut piece?" test) is ruled out: I tried it and it changes nothing in software. The way out that
  remains is below, not built.

## The switch

`?cutboxes` in the page's address, or `localStorage twopointsix.cutboxes = '1'`; `?nocutboxes` forces it off. Read at boot, so a change needs a
reload. Off is the base build hash for hash (the renderer part's check, not repeated here).

## The three cases

| case | staging |
| --- | --- |
| 1. calm room | cubicles, nothing broken, no cut box anywhere |
| 2. room after a blast | five wall charges along the corridor wall: the piece pool full at 64, plus 13 standing ragged wall pieces and the heaps |
| 3. shot-out glass front | the conference partition's four panes shot out with 79 rounds, 37 plates on the floor |
| extra: synthetic worst view | 64 test pieces (`__cut.test`) packed on a 2.6 m disc under the camera: 32 lumps of 8 planes, 19 of 2, 13 wedges of 1 |
| extra: the worst a blast could leave | the same 64, plus 260 small fragments (15 to 35 cm long, 1 or 2 planes) over a 3.6 m disc, plus 40 plates in two rows along a 6 m line: 364 cut pieces, 923 planes. The record table has no cap below the world's 4,096 boxes, so this is what the look fragments and edge plates add if every one carries a cut. |

- Cases 2 and 3 use the real emitters, on a local trial merge of the walls part (`f7d006e`) and the glass part (`b5edb67`) onto the renderer at
  `156e25f`. The merge is local only and was not polished.
- The heads have moved since. The renderer's final is `00eaff8` (a ninth table row per box for the colour of cut faces, parallel planes merged); the
  worst case and the gate test below ran on it. The glass part is at `9cfa0a5` and still being reworked (a polished finish, maybe a screen-door
  discard in the cut g-buffer shader), so what drawing the glass plates costs may move; no ray meets a plate either way.
- Nothing crumbled twice in these numbers: with the switch on, cases 2 and 3 evicted no piece (the glass case holds 37 plates in a pool of 64). The
  trial merge still calls both parts' eviction hooks; see the findings.
- Case 3 uses the conference partition, not the lobby front: the lobby's glass is tempered and dices into particles, so it leaves no plates to cut.
- One charge gives about 15 pieces, so "pool full" takes five charges with the switch on and six with it off.
- The camera pins for cases 2 and 3 were computed, not looked through. The count below of how much of the screen shows cut pieces is the check on them.

## What does not depend on the hardware (counted)

| | calm | synthetic | blast, on | blast, off | glass, on | glass, off |
| --- | --- | --- | --- | --- | --- | --- |
| pieces alive in the pool (cap 64 at high) | 0 | 64 test pieces | 64 | 64 | 37 | 36 |
| boxes with a cut record | 0 | 64 | 69 (56 in the pool, 13 standing) | 0 | 37 | 0 |
| planes in all | 0 | 307 | 152 | 0 | 154 | 0 |
| planes per cut box (how many boxes) | | 1: 13 · 2: 19 · 8: 32 | 1: 17 · 2: 26 · 3: 21 · 4: 5 | | 3: 3 · 4: 27 · 5: 5 · 6: 2 | |
| boxes sent to the GPU | 1,085 | 1,149 | 1,179 | 1,175 | 1,134 | 1,133 |
| box vertices drawn (and if the same pieces were whole) | 36,684 | 42,060 (38,988) | 42,720 (39,456) | 39,312 | 40,224 (38,448) | 38,412 |
| cut table bytes sent a frame | 0 | 8,192 | 8,192 | 0 | 4,736 | 0 |
| pixels showing a cut piece | 0 | 33 % | 35 % | | 0.2 % | |
| shadow rays that reach a cut test | 0 | 42 % | 14 % | | 0 | |
| bounce rays that reach a cut test | 0 | 41 % | 13 % | | 0 | |
| planes read per shadow ray, average over all rays | 0 | 1.91 | 0.38 | | 0 | |

The worst case, counted the same way (on `00eaff8`): 364 cut boxes, 923 planes (1 plane: 117 · 2: 195 · 8: 52); 1,449 boxes sent; 67,260 vertices
drawn (49,788 if the same pieces were whole, 36,684 with none); 52,416 cut table bytes a frame; 39 % of pixels show a cut piece; 45 % of shadow rays
and 47 % of bounce rays reach a cut test; 2.1 planes read per shadow ray.

- The ray rows are a CPU walk of the staged scene from the pinned camera: one camera ray per 6 pixels each way, a shadow ray from each hit to each
  of the 34 lights in reach weighted by how much light it would bring, and four cosine bounce rays a hit. It counts rays that enter the uncut bounds
  of a cut box, which is when the GPU reads the planes.
- Real pieces are light: 2.2 planes a piece after the blast and 4.2 a glass plate, against 4.8 in the synthetic view.
- No ray meets a glass plate (they are flagged that way, as shards were before), and the plates are small on screen. In case 3 the cut costs
  only the drawing of 37 small plates.
- With the switch on the emitters behave differently, so on against off is never the same room: after the blast, on asks for more chips (952 against
  562) and dust (300 against 40), re-breaks 5 pieces on landing and evicts none (off evicts 9); the glass leaves one plate more. That is why every
  case is also measured a third way, the on room with its pieces drawn whole.

## What was measured in software

Headless Chromium, SwiftShader, quality high, 640 x 360, smoke solver off, every frame awaited before the next, configs alternated round by round.
Median wall time per frame with the quartiles. The engine's GPU timer is not usable in software (it returns no stamp for the direct and gather passes
on one of the two pages), so wall time is the number. Ten frames per config.

| case | on, pieces cut | on, same pieces whole | off build | cut against whole | on against off |
| --- | --- | --- | --- | --- | --- |
| 1. calm, two pages | 14.20 s (7 frames) | | 13.0 s | | 1.09 |
| 1. calm, one page, ray passes recompiled | 14.34 s [13.91 to 14.36] | | 12.53 s [12.15 to 12.83] | | 1.14 |
| 2. blast | 14.66 s [14.12 to 14.88] | 14.78 s [14.07 to 15.05] | 12.97 s [12.68 to 13.30] | −0.8 % | 1.13 |
| 3. glass | 14.23 s [14.02 to 14.76] | 14.35 s [14.12 to 14.74] | 12.57 s [12.16 to 12.95] | −0.9 % | 1.13 |
| synthetic worst view | 14.98 s [14.80 to 15.20] | 14.62 s [14.25 to 15.17] | (no pieces: 14.42 s) | +2.5 % | |
| 1. calm again, on `00eaff8` | 14.24 s [14.02 to 14.56] | | 13.02 s [12.52 to 13.59] | | 1.09 |
| 1. calm, the cut test behind a frame word that is never set | 14.87 s [14.19 to 15.03] | | (same 13.02 s) | | 1.14 |
| worst a blast could leave, on `00eaff8` | 15.52 s [15.21 to 16.30] | 15.06 s [14.60 to 15.46] | (no pieces: 14.08 s [13.75 to 14.40]) | +3.0 % | |

- **How the calm row was measured twice.** First with two pages, one booted on and one off, frames alternated (three "on" frames that ran while
  another job was on the box are left out). Then inside one page booted on: the passes that trace rays were recompiled without the cut branch and
  back, so the only thing that differs is that shader text. The g-buffer pass, which the second method does not touch, timed the same both ways
  (518 against 522 ms). The two methods agree, and the quartiles of on and off do not overlap in any row.
- **Which share is the cut and which is the piece count.** None of the on against off difference can be pinned on either. It is 13 % with the pool
  full, 13 % with glass on the floor and 9 to 14 % with nothing broken, so it is the switch's shader text. Cut against whole is inside the noise in
  both real cases, and this method cannot see anything under about 3 % of a frame (0.3 ms on the Mac's scale).
- **Synthetic worst view.** Of the +0.36 s, 0.21 s is the g-buffer pass (906 ms cut, 700 whole, 552 with no pieces): a cut piece draws its faces and
  throws away the pixels outside the solid, which turns the early depth test off there. The rest is the planes read by rays. The quartiles of cut
  and whole overlap, so read +2.5 % as "between 0 and 5 %".
- **The gate test.** The renderer part's suggestion, run on my rig: the ray passes recompiled so the per-box cut test sits behind a word in the
  frame block that is always 0. If a once-a-frame gate could remove the calm cost, this row would drop to the off row. It does not (14.87 s against
  14.24 s ungated and 13.02 s off), so the software cost is the compiled-in body, not the test, and a frame gate is useless here. That fits the
  reading that a real GPU never takes the branch and pays nothing; it is still a reading until the Mac check.
- **Worst a blast could leave.** Cut against whole is +0.46 s (+3.0 %) and the quartiles overlap, so read it as "0 to 6 %". The 364 pieces
  themselves, cut or whole, cost about 7 % over the empty room (15.06 s against 14.08 s): that is the piece count, which plain boxes pay too. The
  g-buffer pass with the pieces whole is 771 ms against 550 ms with none; its stamp did not resolve in the cut rounds, so its cut share is not
  split out here (in the 64-piece view it was most of the difference).
- No GPU validation errors and no console errors in any of these runs.

## What I infer for your Mac (not measured)

The repo's reference is 10 to 11 ms of GPU time a frame at high, 1368 x 770, calm office, of which 5.5 to 6.5 ms traces rays.

| case | inferred extra GPU time with the switch on | why |
| --- | --- | --- |
| 1. calm room | most likely 0 to 0.1 ms; up to about 1.5 ms not ruled out | The hook is one test of a flag bit already loaded for the box (`common.wgsl:270`), then a call. A GPU takes or skips a branch per ray; the software renderer runs both sides for a group of rays and masks the result, which is where I think the 9 to 14 % comes from. If I am wrong and all of it carries over, 14 % of 10.5 ms is 1.5 ms. |
| 2. room after a blast | 0.1 to 0.35 ms on top of case 1 | 0.38 planes read per ray on average; one plane is one more 16-byte read and about twenty operations on a shadow ray the trace notebook puts at about 450 operations, so 3 to 10 % of a ray per plane: 5.5 to 6.5 ms x 0.38 x 3 to 10 % = 0.06 to 0.25 ms. Plus up to 0.1 ms for drawing 68 cut boxes with the early depth test off. Software agrees it is too small to see. |
| 3. shot-out glass | under 0.05 ms on top of case 1 | No ray meets a plate; 37 plates cover 0.2 % of the screen. |
| synthetic worst view | 0.4 to 1.3 ms on top of case 1 | Same sum with 1.5 to 1.9 planes a ray, plus about 0.1 ms of drawing. A deliberate ceiling, not a room the game makes. |
| worst a blast could leave (364 cut pieces in view) | 0.4 to 1.6 ms on top of case 1 | Same sum with 1.8 to 2.1 planes a ray (0.3 to 1.3 ms), plus 0.1 to 0.3 ms for drawing 364 cut boxes: 17,500 more vertices and the early depth test off over 39 % of the screen. Software's +3 % of a 10.5 ms frame would be 0.3 ms. Needs every fragment and plate cut, alive at once and in one view. |

## CPU, measured (bun, headless, this box; medians of three alternated takes)

| | blast on | blast off | glass on | glass off |
| --- | --- | --- | --- | --- |
| pack the boxes for the GPU, per frame | 0.378 ms | 0.330 ms | 0.352 ms | 0.288 ms |
| game step, median over the event | 1.25 ms | 1.36 ms | 1.20 ms | 1.09 ms |
| game step, worst frame | 46.8 ms | 40.0 ms | 20.7 ms | 7.7 ms |
| 20,000 aim rays (`world.raycast`) | 573 ms | 546 ms | 458 ms | 436 ms |
| 20,000 sight lines (`segmentBlocked`) | 124 ms | 117 ms | 90 ms | 86 ms |
| three-minute soak, wall time | 20.8 s, all pass | 20.5 s, all pass | | |

- CPU rays read 4 to 7 % slower in the on rooms, but those rooms hold different pieces, and the glass case contradicts itself: with the plates
  skipped (the default, so no cut test can run) on is 5 % slower, and with the plates tested the two are equal (584 against 586 ms). So 5 % is this
  box's noise for that timing and I cannot say the plane test costs anything measurable on the CPU.
- The worst glass frame is the one where panes let go and many plates get their outline at once: 20.7 ms here, so 2 to 3 ms on your Mac (this box is
  6 to 9 times slower). A single frame, not a rate.
- The soak passes both ways but stands up with wall breaking off, so it makes few cut pieces. It says the switch does no harm there, no more.
- In the headless staging the glass plates' cut records sat far apart in the box list, and the upload covers the whole stretch from the first to
  the last: 23,296 bytes a frame for 38 plates where 4,864 would do. In the page staging they sat together (4,736 bytes). Small either way. Those
  are at 128 bytes a box on `156e25f`; at `00eaff8` a box is 144 bytes, so about 26 KB a frame for that glass staging.

## Which way it would ship without the switch

ON, provided the calm row of the Mac check is within 0.1 ms. The look is the point of the goal, the real cases cost a few tenths of a millisecond
at most by the sums above, software cannot see the cut at all, and the CPU side is small.

What would change my mind: the calm row showing more than about 0.2 ms on the Mac. Then every frame of every mission pays for pieces that are not
there. What is left to do then (none built):
1. Not a once-a-frame "any cut box" test in the shader: the renderer part read the code (the per-box test is already one bit on a word in hand, an
   uncut box never reads the table) and the gate test above shows it buys nothing in software. If the Mac shows a calm cost, it is the larger
   shader compiling differently, and the way out is to run the programs built without the cut until the first cut piece exists, then swap. That
   is a recompile in the middle of a blast, so it needs care; the renderer part names it as the option, not for tonight.
2. If the cost is in a broken room instead: cap small flying pieces at four planes (the real emitters already stay at or under four for walls), and
   give the 260 small fragments no record at all (at that size a cut is hard to see from the game camera, which is a guess).
3. Draw a piece whole when it is under a few pixels.

## The check on your Mac, a minute or two

1. On a build with the cut pieces: `bun run dev`, then open `http://localhost:5173/?paused&mute&quality=high&cutboxes&glassbreak`.
2. In the console: `await import('/qa/cut-cost.js'); await __cc.run()`
3. It stages each case, times frames one at a time with the engine's GPU timer and prints one table. Read:
   - First `calm`, row `cut` against row `offText`, the "Δ union" column. Within 0.1 ms: the calm room is free, ship it on. Over 0.2 ms: it is not.
   - `pool`, `worst`, `blast`, `glass`, row `cut` against row `plain`: what the cut costs on the same pieces (`worst` is the 364-piece case).

On the renderer's branch alone the table has `calm`, `pool` (the synthetic view) and `worst`; `blast` and `glass` appear on a build that also has the two
emitters. It was run end to end in the software page: calm, pool and worst on the renderer's branch, blast and glass on the trial merge. It has not run on
a real GPU, and the "Δ union" column has never held a meaningful number.

## Findings passed to the goal

- The calm-room cost above. The renderer part read the code and adds no gate (see "Which way it would ship").
- In the trial merge an evicted glass plate would crumble twice, because the pool calls both parts' eviction hooks. One call has to go when the two
  parts are merged for real; it is in the brief of the goal's last part. No measured case here evicts a plate.

## Not fixed tonight

- The cut-record upload covers first-to-last cut box rather than only the cut ones: 144 bytes a box index, about 26 KB a frame in the spread-out
  glass staging. The renderer part leaves it: one write of that size costs less than several small ones.

## Files

- Instrument: `tools/qa/cut-cost.js` (`__cc.run()`, `__cc.census()`, `__cc.counts()`); recipes for cases 2 and 3: `tools/qa/cut-cost-recipes.js`.
- Drivers used here: `tools/qa/cut-cost-run.cjs` (two pages, on and off builds, alternated), `tools/qa/cut-cost-page.cjs` (one page, the same
  call as on the Mac), `tools/qa/cut-cost-cpu.ts` (CPU).
- Raw numbers: `cost-data/` beside this page (`cut-cost-sw-page-worst.json` holds the gate test and the worst case), and `docs/perf/cut-cost-sw-*.json` on the branch.
