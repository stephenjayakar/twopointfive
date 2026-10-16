# Direct light in motion — ReSTIR's temporal reuse under a moving camera (lane `fix/direct-motion`, 2026-08-11/12)

Worktree `.worktrees/dmotion`, branch `fix/direct-motion` from main @ 5e9fb65, main merged in twice (last at 54fd23c → 3661f5f); served on :5232 (shot sink
:5233), main beside it on :5234 for the identity hashes. The instrument is the gi-motion lane's (`tools/qa/gi-motion.js` → `__gim`, docs/internal/gi-motion.md
§1): S1 = Sam walking east under the follow camera across the window-lit cubicle floor at high (1368×770 → 1777×1000; 2.44 output px = (1.93, −0.56) internal px
a frame on the floor), S1 still = the same tiles under a pinned camera, S2 = the daylight breach wall (static camera, a man walking); FLOW = temporal sd of 8-bit
luma per world point followed through the pan, mean over the tile, in levels. Tiles: `unlit` (the dark floor lit by a dozen distant panels, L 34), `lightEdge` (the
window light's penumbra on that floor, L 78 — gi-motion's stand-in for 'the stripes', the largest relative flow), `unlitAisle` (L 31), `litFloor` (panel-lit, L 133),
`sillWall` (L 89). Repeatability of one variant in one page: ±2 % unlit, ±3 % edge / lit (gi-motion §1; a repeat here agreed to the third decimal).

## RESUME NOTES

DONE and shipped on the branch (see §0). If resumed: the report to the lead is §0 + §3–§6; nothing is pending but the by-eye call in §7.

## 0. Summary

- **What ships: `settings.restirMotion` = 6 by default** = (b) MOTION-SCALED CONFIDENCE — a pixel's reservoir memory (M cap) is whole under `restirMotionV` 1.1 px a
  frame of its own screen motion (px at 1000 internal rows, scaled to the target; measured off the raster's exact point through prevViewProj + gVel) and cut to
  `restirMotionMin` × the cap past 1.6× that — plus (c) the spatial pass opened at every moving pixel with at least `restirMotionTaps` taps. The presets tier the trade
  (`Preset.restir.motionMin / motionTaps`): ultra 0.1 · 6, high 0.1 · 0, medium 0.2 · 6, low 0.5 · 6, verylow 1.0 (no cut) · 6. (a), the STOCHASTIC reprojection the
  brief led with, is built in both a per-pixel bilinear and a global-dither form and stays an A/B row: it wins the light's edge (−46 %) but coalesces lineages on the
  lit floor (+32 %) and costs a slow pan +12‥34 % — a negative (§4).
- **Flow at high, fresh boot per variant** (S1 pan, unlit / lightEdge / unlitAisle / litFloor): main .378 / 1.313 / .441 / .441 → shipped .350 / .745 / .444 / .320
  = **−7 / −43 / +1 / −27 %** (with 6 taps, the ultra / medium form: .358 / .703 / .441 / .298 = −5 / −46 / 0 / −32 %). Ultra −28 / −51 / 0 / −50 %, medium −5 /
  −34 / −1 / −40 %, low +4 / −26 / 0 / −9 %, verylow −9 / −17 / −4 / −35 %. Against the brief's bar (≥ 25 % out of the dark tiles at high): the light's edge and the lit
  floor clear it at every tier, the dark multi-panel floor does not below ultra (−7 % at high) — nothing in restir.wgsl moved that tile more than 10 %: under a 2-px
  pan ReSTIR there is a 1–2-ray-a-pixel estimator against the leader path's nine (its .29), and the resolve under motion is the rest (§4).
- **Still picture unchanged**: back-to-back stills identical to the third decimal (edge .210 / .210), S2's static wall identical to the third decimal for every
  variant, and the deterministic identity stills hash-identical to main EVEN WITH THE DEFAULT ON (v3 6bf48737 / v1 6653f25d at high on both trees): the levers
  live in a twin of the estimator's program (restir.wgsl compiled a second time behind `const RESTIR_MOTION = true`) that only frames on which the CAMERA moved
  dispatch; a still camera runs main's program. `?norestirmotion` / restirMotion 0 = main byte for byte always.
- **Bias**: main DARKENS the moving picture — pan tile means vs the still's −1.3 / −3.6 / −3.4 / −1.0 % (the neighbour-history bias of p2a-restir.md §3.4, induced by
  the reprojection handing histories about); shipped −0.1 / +0.4 / −1.7 / +0.2 %.
- **Cost** (M4 Max, serialized interleaved ABAB, quiet GPU): at rest 0.00 at every tier (main's program); WHILE PANNING high +0.13 direct / +0.20 union (b alone, as
  shipped; +0.59 with 6 taps), ultra +0.46 direct / +0.52 union (6 taps). The twin program dispatched at rest measured +0.20 ms direct doing nothing — why the
  dispatch keys on camera motion.
- Slow pans keep their history: at 0.78 internal px a frame main is already good (.256 / .433 / .332) and every cut or dither made it worse; the ramp leaves it alone
  (shipped .256 / .445 / .332). TAAU off: −10 / −33 / −6 / −46 %. Validation: 65 cases × 5 presets under an orbiting camera, zero GPU errors. Gates green (§6).

## 1. What was built (restir.wgsl header MOTION; passes.ts / engine.ts / quality.ts / main.ts `__dmo` / bindings.ts 'restir: motion — …' rows)

- `RestirU` grew `mot: vec4f` after `jitter` (x = the full-confidence motion in px at this resolution, y = the floor, z = the spatial threshold px, w = the dither
  switch); fwd / inv / prevLights moved +16 B (`RESTIR_U_HEAD` 192). cfg.w bits 256 / 512 / 1024 = a / b / c; cfg.y bits 8‥11 = the motion tap count (packed only
  for the twin program, so main's `let kSpatial = ru.cfg.y` reads what it always read).
- The MOTION of a pixel = its raster point P through `prevViewProj` (+ gVel) → unjittered position last frame − unjittered position now: 0 to float precision at
  rest whatever TAAU's jitter does, the true flow under motion. NOT the reprojected domain point Pu: rebuilt from this pixel's depth at the unjittered centre and pushed
  back onto the tangent plane, it sits tenths of a pixel beside the true point on an oblique floor by an amount that changes with the jitter phase — under a
  bilinear pick that handed a STILL pixel its neighbour's history three frames in ten (the first cut's still regression, §4).
- (a) `prevTexelAt`: bit 256 → one of the four texels round the reprojected point drawn by bilinear weight from a per-pixel-per-frame hash (a spatial tap at pixel q
  re-derives q's own pick), each validated by depth like the nearest one, a rejected candidate's probability going to the rest; ± 0.02 dead zone. `restirMotionDither`
  = the second form: ONE global sub-pixel offset a frame (R2 sequence) — a bijective shift, no lineage duplicated. Both A/B rows.
- (b) `mCapPix *= 1 − (1 − mot.y)·smoothstep(mot.x, 1.6·mot.x, motionPx)` after the penumbra-cap line: what the pixel uses this frame AND stores.
- (c) the spatial gate `… || motSpatial` with `kSp = max(k, motionTaps)` at a moving pixel.
- passes.ts: `pRestir` (const false) / `pRestirM` (const true), `restirMotionLive` (engine: `camMovedAny` = the unjittered view-projection changed since the last
  render and it was not a cut, or `settings.restirMotionStatic`) picks the pipeline AND gates the mot bits in the uniform; `hotSwapDirect('restir')` builds both.
- Knobs: `restirMotion` (bitmask), `restirMotionV` 1.1, `restirMotionMin` (tiered), `restirMotionPx` 0.5, `restirMotionTaps` (tiered), `restirMotionDither` false,
  `restirMotionStatic` false; `?norestirmotion`, `?restirmotion=N`; `__dmo {knobs, set, on, summary}`; Tab ▸ Direct light ▸ Estimator ▸ 'restir: motion — …' (9 rows,
  the sliders under 'all knobs'). gi-motion.js: variants m0 / ma / mad / mb / mab / mabc / calmOff / nc* / t*, `run(tag, {prefix, file})`.

## 2. Numbers — flow (levels; S1 pan · S1 still; tiles unlit / lightEdge / unlitAisle / litFloor / sillWall)

### 2.1 High, one FRESH BOOT per variant (docs/perf/dmotion-dm_*.json; crops docs/shots/dmo_dm_{m0,final}_s1v0_<tile>_f11-13.jpg ×3, boil maps docs/shots/ab/dmo_*_boil.png)

| variant | pan | still | S2 wall / wallHigh / door |
|---|---|---|---|
| m0 = main (motion-calm rows on, restirMotion 0) | .378 1.313 .441 .441 .270 | .088 .198 .101 .077 .029 | .915 .127 1.111 |
| **shipped at high: b (V 1.1, floor 0.1, no extra taps)** | **.350 .745 .444 .320 .274** (−7 / −43 / +1 / −27 %) | .087 .209 .099 .078 .014 | — |
| b + 6 taps (= ultra's / medium's form; `dm_final`, `dm_final2` with the camera-keyed dispatch: identical) | .358 .703 .441 .298 .274 (−5 / −46 / 0 / −32 %) | .087 .209 .099 .078 .014 | .915 .127 1.111 |
| a (per-pixel bilinear pick) alone | .337 .715 .427 **.582** .276 (−11 / −46 / −3 / **+32** %) | .088 .199 .100 .077 .028 | — |
| a + b | .400 .771 .456 .347 .272 | .088 .208 .100 .077 .015 | — |
| a + b + c | .351 .717 .451 .330 .271 | .088 .208 .100 .077 .015 | — |
| motion-calm rows OFF (= main before 08-12) | .440 1.580 .530 .639 .319 | .189 .245 .129 .155 .045 | .857 .129 1.027 |
| calm OFF + motion 6 | .430 .850 .495 .333 .315 (−2 / −46 / −7 / −48 % vs calm off) | .191 .230 .131 .124 .038 | .856 .129 1.027 |
| gi-motion's references: leader path (restir off) · 'floor' · OLD renderer | .292 .704 .411 .296 · .235 .531 .379 .306 · .244 .749 .401 .270 | .005 .095 .013 .017 · … · .089 .346 .105 .128 | |

Pan tile MEANS vs the still's (bias): m0 −1.3 / −3.6 / −3.4 / −1.0 / +0.1 %; shipped (b+6) −0.1 / +0.4 / −1.7 / +0.2 / +0.5 %. The still column's one difference —
edge .209 vs .198, sill .014 vs .029 — is take ORDER: `run` measures the still 1 s after the pan from a nearby camera, so the pan's reservoirs reproject into it;
back-to-back stills read m0 .210 / final .210 / .211, and S2 (static camera throughout) is identical to the third decimal. It is the settle-after-motion transient:
the shipped memory regrows 2 → 20 over 18 frames after the camera stops (edge +7‥11 % for that second), main keeps its motion-scrambled lineages (sill wall 2× the
shipped for that second).

### 2.2 The other tiers and the slow pan (one boot per tier, ranking takes; docs/perf/dmotion-rank-*.json)

| tier (internal res; walking pan in internal px) | m0 pan | shipped pan (Δ %) | still m0 → shipped | notes |
|---|---|---|---|---|
| ultra (1920×1080; 2.6 px) | .419 1.606 .412 .574 | .302 .786 .412 .286 (−28 / −51 / 0 / −50) | .051 .112 .071 .058 → .050 .111 .070 .056 | floor .1 + 6 taps (k 5 → 6) |
| high (1368×770; 2.0 px) | .378 1.313 .441 .441 | .344‥.350 .734‥.745 .443 .299‥.320 (−7‥9 / −43‥44 / 0 / −27‥32) | = | floor .1; + 6 taps: .351 .693 .441 .289 for +0.4 ms moving |
| high, SLOW pan (walk 0.4: 0.78 px) | .256 .433 .332 | .256 .445 .332 (0 / +3 / 0) | | main is GOOD here; floor-.1-everywhere .323 .499 .353 (+26 / +12 / +6), a′ .297 .599 .337 (+16 / +34), a′+b .330 .545 .354 — why the cut is a RAMP on motion |
| medium (1072×603; 1.47 px) | .403 1.761 .505 .620 | .382 1.154 .502 .372 (−5 / −34 / −1 / −40) | .110 .221 .144 .099 → = | floor .2 + 6 taps; without the taps floor .1 = +26 / −44 / +5 / −38, .3 = +6 / −24 / −1 / −27, .5 = −2 / −12 / −1 / −11 |
| low (768×432; 1.05 px) | .525 1.547 .616 .576 | .548 1.142 .618 .527 (+4 / −26 / 0 / −9) | | floor .5 + 6 taps; taps alone −8 / −7 / −5 / −3; floor .1 = +57 / −43 / +30 / −28 |
| verylow (533×300; 0.73 px) | .616 1.258 .726 .897 | .561 1.043 .695 .584 (−9 / −17 / −4 / −35) | | NO cut (floor 1.0), 6 taps (k 1 → 6); any cut lost the dark floor: floor .5 +11 / −20 / +8 / −39 |
| high, TAAU off (1777×1000 native) | .351 1.154 .454 .594 | .317 .773 .425 .319 (−10 / −33 / −6 / −46) | | no GPU errors |

The knee sweep at high (fast · slow pan): V 0.9 .346 .722 .448 .297 · .260 .460 .333 | V 1.1 .347 .724 .448 .298 · .256 .445 .332 | V 1.4 .348 .740 .449 .351 · =
m0 (the lit floor's 1.6-px flow is mid-ramp) → 1.1. Floor .2 at high: .353 .780 .439 .316. The first (linear) form of (b), k .5 / floor .15: .358 .748 .442 .327; k 1 /
floor .1 (cap 2 everywhere): .346 .721 .448 .297 — the ramp keeps that under the walking pan and gives the slow pan its history back.

## 3. Cost (M4 Max, Chrome / Metal; serialized frames, interleaved ABAB, `sh tools/qa/gpu-quiet.sh` before each take; medians, p95 within 0.3 ms of them)

| take | motion 0 direct / union | shipped direct / union | Δ |
|---|---|---|---|
| high, STILL (v3 cubicles, ×4 blocks of 20) — twin program dispatched at rest (before the camera-keyed dispatch) | 3.932 / 11.40 | 4.129 / 11.53 | +0.20 / +0.13 (a tap guard and parking motionPx across the trace loop did not move it: the bigger kernel) |
| high, STILL — as shipped (main's program at rest) | = | = | **0.00** (and hash-identical) |
| high, WALKING PAN (ABAB 4 × 40 game frames) — b alone (as shipped at high) | 4.129 / 11.14 | 4.260 / 11.34 | **+0.13 / +0.20 while moving** |
| high, pan — b + 4 taps · b + 6 taps | 4.129 / 11.14 · 4.063 / 11.01 | 4.391 / 11.47 · 4.653 / 11.60 | +0.26 / +0.33 · +0.59 / +0.59 (≈ 0.1 ms a tap a moving frame) |
| ultra, STILL (v3, ×2) | 7.93 / 22.35 | 7.93 / 22.28 | 0.00 |
| ultra, WALKING PAN (4 × 36) — b + 6 taps (as shipped at ultra) | 8.192 / 21.10 | 8.651 / 21.63 | **+0.46 / +0.52 while moving** |

## 4. Negatives and what the numbers taught (in the order they were learned)

1. **(a) as first written regressed the STILL picture** (+26‥36 % in the dark tiles): the reprojected DOMAIN point sits a few tenths of a pixel off the true
   unjittered centre at rest (depth-at-the-wrong-pixel + the tangent-plane push, varying with the jitter phase); a nearest pick never notices (< ½ px), a bilinear pick
   hands the still pixel its neighbour's history three frames in ten. Fixed by measuring the flow off the raster's own point (§1) — after which (a) is inert at rest.
2. **(a) coalesces lineages**: two neighbours can adopt one parent, so under a pan patches of shared ancestry grow ~√M px — the lit floor's blotch size went 3.5 →
   6.4 px and its flow +10‥32 %. The global-dither form (a′) avoids that (a bijective shift) and wins −33 % at the edge with no lit-floor loss, but BOTH forms lose a
   slow pan (a′: edge +34 %): dithering converts main's slow, systematic 0.2‥0.4-px-a-frame slide of the reservoir pattern into a ±½-px per-frame jitter of a
   pixel-scale pattern, which this metric — and, I expect, the eye — likes less. (a) + (b) is not additive either (unlit +6 % over m0). Left as A/B rows.
3. **The cut is not about slip rate.** The nearest pick's per-frame slip is 0.33 px on the slow pan and 0.45–0.6 on the walking one, yet main is good on the first
   and bad on the second and a hard cut helps only the second: the history under a 2-px pan is worth about two candidates, under a 0.8-px pan all twenty. So (b)
   became a ramp on |motion| (whole under 1.1 px @1000 rows, floor past 1.76), and the maintainer's 1024×1000 window (1.4 internal px walking, measured as bad as the
   reference framing by gi-motion) sits past the knee.
4. **Below high the cut is a trade** the dark multi-panel floor loses (3–4 rays and 2 taps a pixel cannot stand in for the memory: floor .1 = +26 % medium, +57 %
   low) — six spatial taps at the moving pixels buy most of it back (medium floor .1: +26 → +3 %; the taps trace no rays), hence the per-tier floors and taps, and
   verylow keeps its whole memory.
5. **The dark floor at high moved 7 %, not 25.** (a) −11 %, (b) −8 %, both together worse; the leader path itself flows .29 there against v3's still .09 — under a
   pan that tile is the resolve and the shadow client re-converging behind a 1–2-spp estimator, not the reservoir reprojection. Out of this file's reach.
6. **The twin program costs 0.2 ms direct at rest doing nothing** (levers inert; guarding the taps' flow computation and parking motionPx did not change it — the
   Metal compiler simply schedules the bigger kernel worse), so it dispatches only on frames the camera moved; a still camera runs main's program, which also makes
   the default-ON tree hash-identical to main in every still.

## 5. Checks

- Identity (deterministic stills, `__sh.identityHash`, boot → v3(40) → v1(40), high 1777×1000): main @ 5e9fb65 v3 02a40478 / v1 58523d49 = the lane with
  `?norestirmotion` (before the merges); main @ 54fd23c v3 6bf48737 / v1 6653f25d = the merged lane with `?norestirmotion` AND with the default (restirMotion 6,
  camera still → main's program).
- Validation (`docs/perf/dmotion-validate.json`): 5 presets × {motion 7 per-pixel / dither, motion 6 with the static-camera program, debug views 11 / 12 / 3 / 0,
  restir off → on, render scale 0.6 → back, motion 0 ↔ 6} under an orbiting camera — 65 cases, 0 validation / OOM errors, 0 uncaptured.
- Moving lights under a still camera (a door's wedge, a switched panel, a torch sweep): the camera is still, so main's program runs — main's behaviour byte for
  byte (S2's walking men under a static camera: identical numbers). With `restirMotionStatic` on, a mover's OWN pixels get the cut (faster response, not slower).
- TAAU off: works (jitter 0, camera flow only), −10 / −33 / −6 / −46 %, no errors.

## 6. Gates (on the tree with main @ 54fd23c merged in)

`bun run typecheck` clean · `bun run build` OK · `sh tools/qa/gate.sh perf` 24 PASS / 0 FAIL (frame-layout, perf-cards, perf-flags, perf) · `probes.ts
journal-fixtures` ALL PASS (5400 frames, 45 digests agree, 0 divergences) · `probes.ts panel-inventory` PASS (0 missing of 621, 9 added) · `probes.ts materials`
ALL PASS · in the page: boots clean at every preset, no console / GPU errors.

## 7. For the maintainer's eye

- The light's edge and the lit floor under a walking pan are where it shows (crops dmo_dm_m0 vs dmo_dm_final _lightEdge / _litFloor, and the boil maps): the sliding
  blotches become finer, whiter grain that the resolve eats. The dark floor is where it barely does.
- The one visible trade: for the first ~⅓ s after the camera STOPS, penumbra edges carry a shorter memory (M regrowing 2 → 20) — slightly grainier for that
  moment than main, which instead holds its scrambled pattern for a second (§2.1's still-after-pan row). By eye in play: stop walking beside the window light.
- If high wants the extra 6 % at the edge / 5 % on the lit floor: Tab ▸ Direct light ▸ 'restir: motion — spatial taps under motion' 6 (+0.4 ms of moving frames).
- The motion-calm rows still earn their keep on top (calm off + motion 6: .430 / .850 vs .358 / .703 with them) — mostly the resolve terms and spatialAll's halved
  still crawl; dropping calm's spatialAll + penRays would save their 0.66 ms at rest and give back the still crawl (.09 → .19). Not proposed; noted.
