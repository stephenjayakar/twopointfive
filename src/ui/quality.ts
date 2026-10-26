// Quality presets + adaptive resolution + an 'auto' mode that picks the preset for this machine: keeps the demo above ~30 fps on
// smaller GPUs without hand tuning, and climbs back up on big ones.
import { Engine } from '../engine';
import { defaultRcConfig, type RcConfig } from '../render/rc';
import type { SmokeSystem } from '../smoke/smoke';

export type QualityName = 'ultra' | 'high' | 'medium' | 'low' | 'verylow';
export const QUALITY_NAMES: QualityName[] = ['ultra', 'high', 'medium', 'low', 'verylow'];
export const AUTO_LADDER: QualityName[] = ['verylow', 'low', 'medium', 'high'];   // auto never picks ultra (it is 'high' with more headroom spent; opt in by hand); 'verylow' is the rung under low for GPUs
                                                                                    // that cannot hold 30 fps on low even at the resolution floor (an M1-class laptop GPU on a HiDPI panel, by the cost model below)
const LS_MODE = 'twopointsix.quality', LS_AUTO = 'twopointsix.autoPreset', LS_SCALE = 'twopointsix.autoScaleRel';   // (autoScaleRel since 08-11: the scale is relative to the window's cap now — a value remembered under the old 'autoScale' key meant something else and is left unread)
const RENDER_PASSES = ['composite', 'post', 'fxaa', 'gbuffer'];   // render-pass timestamps are not load (they include the drawable wait) — excluded from every total here
/** The render scale is RELATIVE TO THE CAP (engine.ts resize: internal height = min(preset maxH, CSS height × dpr) × scale): 1.0 = the preset's full resolution on this window and
 *  every step below it is real. So the floor is a fraction of the preset's own resolution — high never under 500 rows, verylow never under 300 — and past it the ladder
 *  changes preset instead (a cheaper preset buys more than fewer pixels by then). Until 08-11 the scale multiplied the WINDOW and was then capped: 0.35 of a 1440-px HiDPI
 *  pane was 504 rows at 'high' but sat above verylow's 600-px cap altogether, i.e. adaptive could do nothing at all on the rung that needs it most. */
export const SCALE_FLOOR = 0.5;
/** scale steps land on this grid (the ladder's cuts round down to it, its climbs are one step, plan() solves onto it): a handful of internal sizes per preset instead of a new one
 *  per step, so a size the ladder returns to finds its render targets still pooled (passes.ts / texpool.ts) and the step costs nothing */
export const SCALE_STEP = 0.05;
const snapDown = (v: number) => Math.floor(v / SCALE_STEP + 1e-6) * SCALE_STEP;
/** auto's compute budget at boot (plan): 15 ms of GPU compute ≈ a presented 50–55 fps once the raster passes, the CPU and vsync slop are added — was 24 ms (≈ 30 fps)
 *  until 08-10, when the maintainer asked for the ladder to hold ~50–60 rather than tolerate anything over 29 (the merged experiments took 'high ×1.0' on the
 *  reference machine from ~45 to ~37 fps and nothing reacted, by design). The runtime ladder's bands below are set to match. */
export const PLAN_BUDGET_MS = 15;
/** the runtime ladder's frame-time bands (seconds per frame): adaptive resolution cuts under CUT_FPS aiming at AIM_FPS and gives pixels back over RESTORE_FPS;
 *  the preset steps down when STARVED with the scale already cut, up when CRUISING at full scale for a while. stepCooldown: no two scale steps closer than this (s) —
 *  each step is at least SCALE_STEP, and a step is one resample of the histories (passes.ts), cheap but not free */
/** GI-IN-MOTION lane, docs/internal/gi-motion.md §5 — the 'noise in motion' the maintainer saw is the DIRECT chain's (ReSTIR's temporal reuse under a moving camera + the resolve's motion
 *  terms), and these are the rows of those two that measurably calm it: ReSTIR's spatial reuse everywhere + the extra penumbra ray, the resolve's motion α and RCAS motion sharpen halved.
 *  Measured at high (docs/internal/gi-motion.md §5): −14 … −51 % of the S1 pan flow per tile, the STILL tiles −28 … −55 % (spatial reuse halves ReSTIR's static crawl there too), the daylight
 *  breach wall +7 %, ≈ +0.6 ms union; the trades (softer contact shadows with spatial reuse — image-quality.md's D2 — and softer motion with α 0.25 — tjank.md raised it to 0.4 for that)
 *  were the maintainer's to weigh BY EYE — and they did (08-12: 'seems to fix a lot of the direct lighting noise issues … looks great'): main.ts switches the bundle ON at boot
 *  (?nomotioncalm, Tab ▸ Frame, __gimo.calm(false) put it off); OFF = every row exactly as the preset / the engine defaults have it. `Quality.motionCalm` re-applies it after every preset change while it is on. */
export const MOTION_CALM = { restirSpatialAll: true, restirPenRays: true, taauMotionAlpha: 0.25, taauSharpenMotion: 0.15 };   // (the reservoir memory stays at the tier's own 20: cutting it to 10 / 6 bought 3–6 % more under the pan and cost the STILL tiles half of what spatial reuse wins there and the daylight breach wall +23 / +32 % swim)
/** … and what 'off' puts back for the rows no preset places (engine.ts defaultSettings' values — kept here as literals: importing the engine module at runtime would drag WebGPU globals into the headless tools that import this file) */
export const MOTION_CALM_OFF = { restirSpatialAll: false, restirPenRays: false, taauMotionAlpha: 0.4, taauSharpenMotion: 0.3 };
export const LADDER = { cutFps: 45, aimFps: 50, restoreFps: 58, starvedFps: 40, cruisingFps: 57, cutGpuFrac: 0.55, hopFits: 0.9, cruiseWindows: 6, cruiseWindowsBlind: 12, hopFailSecs: 30, hopHoldSecs: 60, stepCooldown: 2.0 };   // (cutGpuFrac: a cut / a preset drop only when the GPU's union is at least this share of the aim's 20 ms frame budget (11 ms: the union leaves out the raster passes and any overlap, so a truly GPU-limited frame reads well over it; a paced one with an idle GPU well under) — a page paced to 30 fps by the browser or the display with the GPU idle two thirds of the time is not helped by fewer pixels, and half resolution makes the direct light shimmer: the maintainer's ultra ×0.50 at 8.6 ms, 08-13))
// (cruising = 'auto may go UP a preset': it used to ask for avg > 62 fps, which a 60 Hz display's rAF can never average — auto ↑ only ever fired on faster panels, and a machine calibrated low
//  during a loaded boot or stepped down by a transient stayed down all session. Now: the rate at the display's own (≥ cruisingFps 57, under any refresh) AND — when GPU timings exist — the
//  compute union PRICED AT THE NEXT PRESET by the cost model (COST: medium → high ≈ ×1.5, low → medium ≈ ×1.9 — ×2.1 on the coarse cache grid — on this window) under hopFits × PLAN_BUDGET_MS, for
//  cruiseWindows windows; without timings the rate alone for twice as long. A hop that comes straight back down (auto ↓ within hopFailSecs of the ↑) holds that hop off hopHoldSecs,
//  doubling per repeat — the one memory apply() does not clear.)
/** THE HEADROOM-AWARE CLIMB (settings.ladderClimb; docs/internal/gi-motion.md §A): frame RATE alone cannot see headroom past the display's refresh — a machine presenting 60 fps with the GPU
 *  busy 9 ms of every 16.7 sits at its tier's starting scale for ever. With GPU timings the ladder can: over 1-s windows in which the frame rate held the display rate (≥ LADDER.restoreFps) AND
 *  the UNION of the compute passes' GPU intervals stayed under `headroom` × the frame budget (1000 / budgetFps ms), for `windows` windows running, it takes ONE step up — the render scale by
 *  SCALE_STEP past the tier's own start up to 1.0; at 1.0 with the union still under `divisorRoom` × the budget, the lossy divisors in a fixed order (the gather ⅓ → ½, then the volumetrics
 *  ¼ → ½); then, only with settings.capClimb, the output cap toward the window's device rows in `capStep`-row steps — with ≥ `climbGap` s between climbs. A window over `backoff` × the
 *  budget or under `backoffFps` with a climb standing UNDOES the last step at once and remembers the rung that failed for `failSecs` (no oscillation); the plain ladder's cut / preset logic
 *  runs on top as ever. Every step is one the pool + history resampling (passes.ts) make cheap. Off = the ladder as it was, byte for byte. */
export const CLIMB = { budgetFps: 60, headroom: 0.60, divisorRoom: 0.65, backoff: 0.80, backoffFps: 55, windows: 3, climbGap: 4.0, failSecs: 60, capStep: 100 };
/** one rung the climb has taken, newest last (undone in reverse) */
type ClimbStep = { kind: 'scale'; from: number; to: number } | { kind: 'gather' } | { kind: 'vol' } | { kind: 'cap'; from: number; to: number };
/** THE LADDER'S ONE TARGET (settings.ladderAim, DEFAULT 60 since the maintainer's pick of 10-10; ?aim=asnow|60|90|120|display, ?aim=0 = asnow; rebuild/performance/auto-quality.md). 0 = 'as now': every band is the literal LADDER / CLIMB / PLAN_BUDGET_MS number
 *  above and no line below takes another road — the ladder byte for byte as it was (aims at a 60 Hz budget, spends headroom on resolution, cuts only under 45 fps). N > 0 = HOLD N fps (never more
 *  than the display has been seen to show — Quality.displayHz; AIM_DISPLAY = that rate itself): the climb, the cut and the preset hop all work to N.
 *    · the GPU budget is U = 1000 / N − overheadMs (what a frame costs past the compute union: raster passes, CPU, present — the 1.67 ms PLAN_BUDGET_MS always implied at 60); the climb's bands
 *      keep their SHARE of it (headroom ⅔ U, back-off 8⁄9 U, a hop must fit hopFits × U, the boot plan fits U), so hold 60 climbs exactly as today does;
 *    · the CUT is firm: two 1-s windows under `cut` × N with the GPU the limit → the scale goes straight to what the cost model says lands on `aim` × N (below the tier's start too, to the floor),
 *      and two windows with the union over the back-off band take one step off BEFORE the rate shows it; a preset drops when that has run out of road (the same floor / deep-cut rule);
 *    · pixels come back on the union's room, not on a frame rate a display at N can never exceed — a step at a time while the union priced at the next step stays `restore` of the way to the
 *      back-off band, a level that just cost frames held off as a failed rung is;
 *    · 'the GPU is the limit' = the frame takes no more than `pacedMs` over the union, or the union alone does not fit U: a page paced by its display, the browser or the CPU is not helped by
 *      fewer pixels — and `pacedWindows` of that running say what this page can show: the aim comes down to it (never under 60) until its frames are seen faster again;
 *    · the windows an aim judges leave their one longest frame out (a hitch a second is not a rate), and `cruise` sits above `cut`: no rate is both 'at the aim' and 'under it'.
 *  Known limits (the page has them): the display's rate is only what the page's own frames have shown (a fixed-rate display whose frames never fit one refresh reads as half its rate); U
 *  assumes the 1.67 ms of overhead, a Mac take shows ~2.8 — the cut by rate is what corrects it at 90 / 120. */
export const AIM_DISPLAY = 999;
export const HOLD = { cut: 0.965, aim: 1.03, cruise: 0.975, pacedMs: 6, pacedWindows: 5, hotWindows: 2, blindWindows: 8, restore: 0.9, restoreWindows: 6, overheadMs: 1000 / CLIMB.budgetFps - PLAN_BUDGET_MS };
/** THE PACED CHECK (as now: settings.ladderPaced; under an aim: settings.ladderHeld, the block under PACED — with it off an aim has only its own `holdBound`; default on, `?ladderpaced=0`; off = the rule as it was: 'the union over LADDER.cutGpuFrac of the
 *  frame = the GPU is the limit'). A page held to 30 fps by something no pixel buys off (the browser's energy saver, a power mode, a slow display) with High at its start costing 12‥14 ms of
 *  union read as GPU-bound by that rule, was cut to ×0.57 and on down for nothing, and nothing gave the pixels back (the way up wants 58 fps): the maintainer's Mac, 10-10 — 30 fps at ×0.57
 *  and ×0.50 with the union at 8.9 ms. `Quality.pacedStep`, once a window, judged on the window's mean frame without its longest one:
 *    · PROVEN paced = the frame is longer than TWICE (the union + HOLD.pacedMs). Whatever the display's refresh, a frame the GPU is the limit of is under twice its GPU work (free-running it IS
 *      the work; missing a vsync it is the next whole refresh up, which is under twice the work once the work is over one refresh) — so this cannot be load, as long as the work the union does
 *      not count (the raster passes, the present) is under those 6 ms. Such a window is never cut and never starves a preset. (A union the timer did not give = the rule as it was.)
 *    · Between the two (the union over the old floor, the frame not provably paced: 33 ms with 12.6 ms of union is a paced page AND a 60 Hz display missing its vsync) the cut is still taken, as
 *      before — and JUDGED, with any cut and any preset given up that follow inside `trialSecs`: once the GPU is no longer the limit (proven, or the union under the old floor) for `windows`
 *      windows and the frame is no shorter than before the first cut (within `gain`), fewer pixels bought nothing: preset and scale go straight back to where the cut found them, and that frame
 *      rate is remembered as this page's PACE (`pacedAt`): while the rate stays within `band` of it (followed as it drifts; `windows` windows outside = left) and the frame stays more than
 *      6 ms over the union, no cut. A not-slow window forgets it. A pace that no window proves is put to the same test again after `recheckSecs`, doubling to × 2^`recheckMax` — a fixed 60 Hz
 *      display whose load comes to miss its vsync at the very rate the page was paced to looks the same from here, and there the cut does buy the frame rate back.
 *      A take-back needs the frame where the cut started to have been more than 6 ms over its union (a state the check itself keeps), and one followed by a cut inside `backSecs` holds the
 *      next off, doubling (CLIMB.failSecs).
 *    · On a PROVEN paced window a scale below the tier's start (a cut from a fight before the pacing began) is GIVEN BACK after `upWindows` such windows — only as far as the cost model
 *      keeps the page proven paced (so the GPU still makes the frame in half the pace: nothing lost when the pacing lifts, even on a fixed display); a step after which the frame grew by
 *      `gain` is taken off again and held off as a failed climb rung is. The rest of the way up is the plain restore's (58 fps), and the climb past the tier's start keeps its own rule. */
export const PACED = { band: 0.06, gain: 0.05, windows: 2, upWindows: 4, trialSecs: 12, backSecs: 30, recheckSecs: 120, recheckMax: 3, probeGain: 0.15 };
/** SHARP SHED (settings.ladderShed, default on, `?laddershed=0`; the maintainer's pick of 10-25 off his own takes: 'Auto drops it'). UNDER AUTO, where the ladder would take pixels off
 *  the tier's own picture — the cut by rate, the step for the back-off band, the cut taken with a load spike's rungs, an aim's judged cut, a preset starved away — and sharp direct is drawing and the tier's
 *  to place (no ?sharp / ?nosharp / ?noiq), it lets sharp direct go INSTEAD, with its two riders (the decoupled jitter, GBAA): the output-size kernels are the one part of a frame that
 *  fewer pixels do not shrink (the maintainer's Mac at High ×0.5: 4.9 of 15.5 ms, and he saw no difference in a fight with it off). Rungs the climb put ON TOP of the tier's start still come off first: they are
 *  extras. The shed stays across auto's preset hops (a hop is priced without it) and ends with the auto spell (a pin, auto chosen again) or the switch.
 *  It comes back when the tier is at its own scale again, the rate at the aim (or the page paced), no preset hop about to be taken, and the union PRICED WITH IT ON THE TIER'S OWN
 *  PICTURE — rungs the climb took meanwhile are priced off and come off with the move: the tier's own row before the extras — still `HOLD.restore` of the way to the back-off band,
 *  `HOLD.restoreWindows` windows running (without timings: the rate alone, `HOLD.blindWindows` of them); and no sooner than `holdSecs` after it was shed, doubling each time it is shed
 *  again within twice that hold of coming back (16× at most). ITS PRICE is the cost model's share, or what this machine's own union showed if that is more (never over `seenCap` × the
 *  model): off a shed, what the union gave back — trusted for twice the hold-off only, since a spike that ended in the same second reads as its price; on the way back, what the union
 *  took on in a calm scene — that reading replaces the other and stands `backSecs`. So a machine the model underprices tries it once, reads the price, and leaves it. Where it does not
 *  fit, the climb spends the room on pixels instead — to 0.95, as with sharp direct on, so there is a size left for it to come back at. Turned back on by hand (the Tab row), the
 *  ladder holds no shed against it.
 *  Off = the ladder as it was. NOT covered: a pinned preset keeps sharp direct whatever its frame rate, and the boot's pick (plan) still prices every tier with it on. */
export const SHED = { holdSecs: 60, seenCap: 3, backSecs: 900 };
/** THE SAME CHECK UNDER AN AIM (settings.ladderHeld, default on, `?ladderheld=0`; off = an aim as it was: `holdBound` alone decides, and every line below is skipped). An aim stepped a
 *  held page down on the union's SIZE alone (two windows over the back-off band; over its budget, by rate) and gave the pixels back only with the union priced under `restore` of that
 *  band. On a page the browser holds to 30 fps the GPU clocks down and every pass reads about half again longer (the maintainer's Mac on a low battery, 10-14: 6.7‥7.4 ms free-running,
 *  10.7‥12 ms held, same settings), so High's start read 13.9 ms, went down to 600 rows for a rate that stayed 30, and never came back. With the switch on `pacedStep` runs for an aim too:
 *    · PROVEN for an aim is also: slow, with the union fitting the aim's frame less HOLD.pacedMs (`holdProof`: 10.7 ms at 60) and the frame more than those 6 ms over it. Whatever the
 *      display, a frame the GPU is the limit of would be inside the aim there — so this is a page pixels cannot buy off, as long as the work the union does not count is under 6 ms;
 *    · between the two (slow, the frame far over a union that is over that floor: a held page AND a 60 Hz display missing its vsync) an aim took no cut by rate and could not tell.
 *      With the union inside the back-off band too (over it the band's own step goes first, as ever, and is judged like any cut) a cut is now taken to where the cost model prices
 *      the union under the floor (`probeScale`; none if the scale floor does not reach it; a step further if it lands short) and JUDGED there as as-now's cuts are: the frame no
 *      shorter → the pixels go straight back to where the chain began, with the failed-rung marks it left, and that rate is this page's pace; shorter by `probeGain` (a missed vsync
 *      bought back is a whole refresh: a fifth of the frame at the least; less is the rate's own wobble) → it was the pixels, the cut is kept and the level it left is a failed rung
 *      (the way back up does not walk into it again seconds later). No step up while such a cut waits for its verdict. One that proves nothing by the end of its trial goes back to
 *      where it started with no pace learnt, the next held off as a failed rung is; and after a judged take-back the next comes no sooner than the re-test would (`probeUntil`,
 *      recheckSecs doubling — a rate that wobbles in and out of its pace is not cut every time it does);
 *    · at the pace (proven, or remembered with the frame still more than 6 ms over the union) an aim takes no cut by rate, no step for the back-off band and starves no preset, and a
 *      scale under the tier's start comes back a grid step at a time on the frame's own room (the union priced at the step, `gain` on top, still 6 ms inside the frame) — each step judged
 *      on its first window as as-now's give-back is: the frame grew → the step comes off, is held off as a failed rung, and the pace is forgotten;
 *    · the pace is left as as-now's is (the frame plainly the GPU's work, the rate gone two windows, the re-test after `recheckSecs` — which here is the next such cut), and a not-slow
 *      window forgets the pace and any cut being judged (the hold-offs and the failed rungs stand).
 *  Known limits: the proof needs the union to FIT, so a fight that starts on a held page before its pace is known, or a re-test that lands inside one, is cut as before and stays cut
 *  until the fight is over (the floor cannot bring 23 ms under 10.7). Load that arrives at the very rate the page was held to with no fast second between (a hold lifting mid-fight on a
 *  fixed 60 Hz display) waits for the re-test, as under as-now. And every 'proof' here rests on HOLD.pacedMs: a machine whose frame runs more than 6 ms over its union by itself reads as
 *  held — the judged steps are what bound the damage there; and a frame rate that wobbles 15 % a second by itself can read as a cut that helped (a step under the tier's start then
 *  stays held off as a failed rung). */
/** the bands one aim puts the ladder on (fps thresholds; `budget` = the frame budget CLIMB's fractions multiply, ms; `planBudget` = the union the boot plan and a preset hop must fit, ms; `gpuFloor` = the union under which a slow frame is 'pacing, not load' as-now, ms) */
export interface Bands { hold: boolean; target: number; cutFps: number; aimFps: number; restoreFps: number; starvedFps: number; cruisingFps: number; backoffFps: number; budget: number; planBudget: number; gpuFloor: number }
const AS_NOW: Bands = { hold: false, target: 0, cutFps: LADDER.cutFps, aimFps: LADDER.aimFps, restoreFps: LADDER.restoreFps, starvedFps: LADDER.starvedFps, cruisingFps: LADDER.cruisingFps, backoffFps: CLIMB.backoffFps, budget: 1000 / CLIMB.budgetFps, planBudget: PLAN_BUDGET_MS, gpuFloor: LADDER.cutGpuFrac * (1000 / LADDER.aimFps) };
export function ladderBands(aim: number, displayHz = 0): Bands {
  if (!(aim > 0)) return AS_NOW;
  const target = Math.min(aim, Math.max(CLIMB.budgetFps, displayHz));   // (the display's rate not seen yet: 60 — every display shows that; its first second of frames says the rest. Never a cut for a rate nobody has seen.
  // NEVER UNDER 60 either: the 'display rate' is only the fastest the page's own frames have been, and on a machine too slow for its preset that is the load itself — an aim that followed it
  // down held 30 fps at High and cut nothing, where as-now cut. The paced rule in sample() has the same floor.)
  const u = Math.max(2, 1000 / target - HOLD.overheadMs);
  return { hold: true, target, cutFps: HOLD.cut * target, aimFps: HOLD.aim * target, restoreFps: Infinity, starvedFps: HOLD.cut * target, cruisingFps: HOLD.cruise * target, backoffFps: HOLD.cut * target, budget: u * (1000 / CLIMB.budgetFps) / PLAN_BUDGET_MS, planBudget: u, gpuFloor: 0 };
}
/** ?aim= / a menu's word → settings.ladderAim (null = not one of them; '0' is 'asnow' said as the setting's own number) */
export function ladderAimOf(word: string | null | undefined): number | null {
  const w = (word ?? '').trim().toLowerCase();
  return w === 'asnow' || w === '0' ? 0 : w === '60' ? 60 : w === '90' ? 90 : w === '120' ? 120 : w === 'display' ? AIM_DISPLAY : null;   // (the five the card and the Tab row offer, no others: a row that cannot show the value it holds would lie)
}
/** the refresh rates displays come in (host/loop.ts snaps the fixed step onto the same list): a rate SEEN within 3 % of one is taken as it, anything else rounds DOWN */
const DISPLAY_RATES = [50, 60, 72, 75, 90, 100, 120, 144, 165, 240];
export const snapRate = (hz: number, tol = 0.03) => DISPLAY_RATES.find(r => Math.abs(hz - r) <= tol * r) ?? Math.floor(hz);
/** the rate a run of frame intervals (ms) shows the display to reach: the fastest EIGHT CONSECUTIVE intervals, their shortest left out, averaged (the short catch-up frame after a long
 *  one is not a refresh, and timestamps coarsened to a millisecond — 16, 17, 17 — average back to 16.7), snapped within `tol`; 0 = too few to say */
export function displayRateOf(intervals: ArrayLike<number>, tol = 0.03): number {
  const K = 8; let best = Infinity;
  for (let i = 0; i + K <= intervals.length; i++) { let sum = 0, min = Infinity; for (let j = i; j < i + K; j++) { const d = intervals[j]; sum += d; if (d < min) min = d; } if (sum - min < best) best = sum - min; }
  return best > 0 && best < Infinity ? snapRate(1000 * (K - 1) / best, tol) : 0;
}
const rungKey = (s: ClimbStep) => s.kind === 'scale' ? `scale:${s.to.toFixed(2)}` : s.kind === 'cap' ? `cap:${s.to}` : s.kind;
const probesOf = (p: Preset, one = true) => { const g = rcGridOf(p, one); return g.nx * g.ny * g.nz; };   // (rcGridOf: under the table below)

/** the lossy trade-offs a preset switches (engine settings of the same names; engine.render mirrors them into passes.setDivisors / rc.halfRate / the CheckerDirect frame
 *  flag / frame.lossyCfg.z every frame, so writing the booleans IS what the pause-menu rows do) + the near-black threshold dimRays works under + the final gather's
 *  relative firefly bound (settings.giFireflyK → lossyCfg.w, fgather.wgsl: each ray ≤ K × the radiance cache's estimate ÷ π; the Tab ▸ Indirect light slider): it cut
 *  the boil round a torch held near a wall by ~40 % (42e3e22) but it is a one-sided clamp — the review measured −24 % linear indirect on the floor 0.3 m from a
 *  70 W/sr hotspot, −8 % at 0.6 m, nothing past 0.9 m — so it is a trade like the rest: 4 on the ladder presets, 0 = off on ultra (the reference energy, boil and all) */
type Lossy = { checkerDirect: boolean; gatherThird: boolean; rcHalfRate: boolean; volQuarter: boolean; dimRays: boolean; dimBelow: number; fireflyK: number; rcPeriods: readonly number[] };   // rcPeriods = settings.rcPeriods (render/rc.ts, docs/internal/p0a-cascades.md): per cascade level [c0 — always whole, c1, c2, c3] the frames a level takes to refresh all its probes, an interleaved 1/period per frame at constant cost; [1,1,1,1] = every level whole every frame (the reference). It REPLACES rcHalfRate on the ladder presets: the same average saving on a throughput-bound GPU but flat frame to frame instead of a whole-levels-on / off saw-tooth, and the near field (c0, the dice everyone reads) stays this-frame fresh
/** the worst-case caps (renderer v3 Phase 0, docs/internal/renderer-v3.md §2 — the loud minute: QRF weapon lights + rain + a pool full of smoke + a firefight's particles): every tier
 *  runs the same capped paths, scaled. vol = settings.volLightCap / volShadowEvery / volStepVoxels (volumetrics.wgsl: K lights per smoke-march step / haze ray, shadow-ray reuse
 *  period, march step in voxels); births = the GPU particles' births per frame (render/particles.ts maxBirthsPerFrame — the queue carries the rest to the next frames).
 *  (The smoke solver has no row here: which of its bricks step is its own rule, by how fast their air moves and how far they are from the view — smoke.ts calmCells / sparse.)
 *  volEvery is 2 everywhere, ultra included: refreshing every traced light's shadow ray each 8 cm step bought nothing visible in the crops and cost ultra a third of
 *  its march (torture take: K 6 / every 1 = 22 ms vs 15 at every 2, 1777×1000); 3 starts to comb. (08-12: the classic tiering first shipped ultra / high at every 1 —
 *  the loud minute at high measured volumetrics 9.9 → 7.1 ms mean, 14.7 → 10.3 p95 going back to K 4 / every 2, so those are the values again; the per-pixel PATH,
 *  which was the visible difference, stays.) */
export interface Caps { volK: number; volEvery: number; volStep: number; births: number; debris: number; rain: number; marchLights: number; vol: 'classic' | 'froxel' }   // vol: 'classic' = the PER-PIXEL volumetric march for haze AND smoke, every kept light shadow-rayed every step (the pre-v3 look the maintainer picked side by side on 08-12: 'this looks better … let's get the smoke better and we can ship') — ultra / high; 'froxel' = the froxel haze + the K-lit smoke march (renderer v3 P2b) — medium and below, where the millisecond it saves is the point   // marchLights = settings.smokeMarchLights: lights the froxel-lit smoke march lights per step itself, J keeping the ambient (docs/internal/smoke-look.md — ultra 4 / high 3 / medium 2 / low+verylow 0 = the J-lit march as it was)   // debris = settings.debrisCap: the destruction lane's rigid-debris pool (game/debris.ts) — 64 ultra / high, 32 below: the stage-2 chaos budget (64 tumbling casters +2 ms at high, no boil)   // rain = settings.particleRainCount (the particle rain's cap on drops alive at once, game/rainFx.ts — inert while settings.particleRain is off): 6000 / 4000 / 2500 / 1500 / 800
/** ReSTIR DI per tier (renderer v3 Phase 2a; settings.restirRays / restirSpatial / restirHistory — engine.ts words them): the SAME estimator scaled by shadow rays per pixel,
 *  spatial taps and history cap — ultra 4/5 · high 4/3 · medium 4/2 · low 3/2 · verylow 2/1, cap 20 everywhere. Measured in the stress minute (docs/internal/p2a-restir.md):
 *  direct 13.2 → 7.1 ms at ultra 2133×1200, 5.95 → 3.16 at high 1368×770 (9.3 → 5.1 at 1777×1000), 3.96 → 1.98 medium, 2.08 → 0.98 low, 0.87 → 0.45 verylow; rays 6
 *  (a second fresh candidate + the final ray) bought ultra nothing (13.1 → 12.7) and rays 5 cost it +3.5 for spatial reuse everywhere — so no tier runs them; they stay on
 *  the Tab slider. `ds` below stays what the OFF path (?norestir, direct.wgsl) runs with. */
export interface RestirTier { rays: number; spatial: number; history: number; held: number; motionMin: number; motionTaps: number }   // held = settings.heldRays: the HYBRID estimator's K (direct-quality lane, docs/internal/direct-quality.md — carried lights bypass the reservoirs and take K stratified rays per leader at the pixels they reach; 0 = off, the transient stratum as it was) · motionMin / motionTaps = settings.restirMotionMin / restirMotionTaps: the direct-motion lane's per-tier trade under a CAMERA PAN (docs/internal/direct-motion.md §2 — the reservoir memory a fast-moving pixel keeps, as a fraction of `history`, and the spatial taps it takes meanwhile): the light's edge and the lit floor want the memory cut to nothing at every tier (−26‥47 % pan flow), the dark floor under a dozen distant panels wants it kept below high (3–4 rays and 2 taps a pixel cannot stand in for it: floor 0.1 there = +26 % medium / +57 % low), and six taps while moving buy most of that back — so ultra 0.1 · 6, high 0.1 · 0 (its own 3 taps run at every cut pixel through the young rule anyway; 3 → 6 bought −6 % more at the edge for +0.4 ms of moving frames — the Tab row has it), medium 0.2 · 6, low 0.5 · 6, verylow 1.0 · 6 (no cut at all: at 2 rays and 1 tap a pixel every cut lost the dark floor more than it won the edge, the taps alone −4‥35 % everywhere); settings.restirMotion itself (the switch) is not a preset's business
/** froxel volumetrics per tier (renderer v3 Phase 2b, render/froxels.ts — settings.froxelH / froxelD / froxelK / froxelHistory): grid rows (W follows the aspect) × depth slices, shadow-rayed
 *  lights per froxel, history weight. The same kernels on every tier, scaled — every tier's froxel is ~7–9 of its own pixels across (a beam edge reads alike on all of them):
 *  ultra 180 × 56 · 5 — high 135 × 64 · 4 — medium 108 × 48 · 3 — low 80 × 32 · 2 — verylow 64 × 24 · 2 (ultra measured 2.36 ms p95 in the gate minute at 180 × 64 · 6 against its 2.0 budget:
 *  a seventh fewer slices and one light fewer per froxel, not coarser froxels — the beam edge is what shows). Memory (3 haze volumes + the half-res smoke J + transient + clusters,
 *  rgba16f): ultra ≈ 86 MB · high 56 · medium 27 · low 10 · verylow 5. */
export interface FroxelTier { h: number; d: number; k: number; hist: number; topRays: number /* depth strata (shadow rays) for each froxel's strongest light, 1‥3 */ }
/** per-preset TAAU knobs (engine settings taauPhases / taauClipGamma / taauSharpen — engine.ts RenderSettings.taau): the deeper the upscale, the longer the jitter cycle (finer sample coverage
 *  of each output pixel), the looser the clip (fewer samples per output pixel per frame to judge history by) and the firmer the sharpen */
type Taau = { phases: number; clipGamma: number; sharpen: number };
/** per-preset v3 DENOISER tiers (engine settings dnShadowIters / dnShadowCap / dnGiIters / dnGiCap / dnSpecIters — render/denoise.ts): the same core scaled — à-trous iterations and the
 *  history cap per client. The shadow chain's strides are 1, 2, 4, 8, 16, so 3 iterations already travel 7 px = the 10-px penumbra cap's worth; a 4th only matters with the cap raised.
 *  + GI IN MOTION (docs/internal/gi-motion.md; settings.giFullRes / giFullIters / giYoungRays): giFull = the diffuse client accumulated + filtered at the INTERNAL resolution (its history's
 *  reprojection error an internal pixel, not a gather texel), giFullIters à-trous iterations there; giYoungK = the final gather's ray multiplier for young-history texels (1 = off). */
type Dn = { shIters: number; shCap: number; giIters: number; giCap: number; spIters: number; giFull?: boolean; giFullIters?: number; giYoungK?: number };
/** RAY-TRACED REFLECTIONS per tier (renderer v3 phase 4 — settings.rtReflect / rtReflectDiv / rtRays / rtMaxRough / rtAtrous; docs/internal/p4-materials.md): the reflection target's divisor, traced
 *  rays per pixel, the roughness cutoff, the reflection chain's à-trous iterations — ultra ÷2 · 2 · ≤ 0.55 · 4, high ÷2 · 1 · ≤ 0.45 · 3, medium ÷3 · 1 · ≤ 0.35 · 3, low / verylow off (the one BRDF's finish
 *  table and the detail layer stay on at every tier: they live in the g-buffer and cost nothing measurable). ?nortreflect vetoes `on` for the visit (rtVeto). */
export interface RtTier { on: boolean; div: number; rays: number; maxRough: number; atrous: number }
export const RT_OFF: RtTier = { on: false, div: 2, rays: 1, maxRough: 0.45, atrous: 3 };
/** RENDERER V3 PHASE 5 — the ULTRA-only extras (settings.giResample / giResampleRays / rtMeshHits / rtHitReuse; docs/internal/p5-ultra.md): the final gather's reservoir resampling (mode + fresh
 *  rays per texel — gather 10.0 → 7.5 ms in the stress minute, union p95 32.2 → 28.0), characters as their skinned mesh in reflections (free), the reflections' second-ray decorrelation +
 *  hit-lighting reuse (measured no gain at the output — the specular denoiser already holds that noise — so ultra leaves it off; the Tab row stays for A/B). Every preset but ultra carries
 *  P5_OFF = every pass byte for byte as it was (hash-proven at high / medium); optional by design — a preset hop off ultra puts all three back. */
export interface P5Tier { gi: 'off' | 'temporal' | 'full'; giRays: number; mesh: boolean; reuse: boolean }
export const P5_OFF: P5Tier = { gi: 'off', giRays: 2, mesh: false, reuse: false };
/** IMAGE-QUALITY program (docs/internal/image-quality.md §7, page docs/review/image-quality.html): the RESOLVE configuration a tier ships. sharp = settings.sharpDirect (the
 *  output-size g-buffer + exact U + composite + 1 : 1 TAA under TAAU below scale 1); decouple = settings.sharpDecouple (the output raster on the camera's unjittered matrices,
 *  the internal raster keeping its Halton jitter — hard shadow edges stay supersampled while geometry stands still); gbaa = settings.gbaa (analytic single-frame box-edge AA —
 *  it wants exactly the still 1 : 1 raster sharp + decouple give it, so it rides only with them); histSharp = settings.taauHistSharp (C2: the history de-blur in motion, free).
 *  IQ_OFF = every one of them off = the resolve as it was (main byte for byte; ?noiq forces it for the visit, ?nosharp forces just sharp direct + its two riders off). */
export type IqTier = { sharp: boolean; decouple: boolean; gbaa: boolean; histSharp: number };
export const IQ_OFF: IqTier = { sharp: false, decouple: false, gbaa: false, histSharp: 0 };
/** C3j + C2 — the program's finalist: crawl roughly halved against main (0.108 vs 0.158 px at high, half the pre-v3 renderer's), motion width 1.69 vs 1.87, still detail +10 %, hard
 *  shadow edges smooth, noise at or under main's on the broad floors; +1.9 ms union at high, ±0 at ultra (run at 0.9), +1.4 medium, +0.6 / +0.5 low / verylow (stress means) */
export const IQ_C3J: IqTier = { sharp: true, decouple: true, gbaa: true, histSharp: 0.5 };
// (The SDF character rig has no tier: the fitted round cones are every ray's character test at every preset — measured free, −0.3 … +0.5 ms at high, docs/internal/sdf-characters.md §8 —
// and its two extras, the smooth-union closest hit in reflections and the drawn character shadows, are rows no preset touches: engine settings sdfRigSmooth / charSoftShadow.)
export interface Preset { restir: RestirTier; rt: RtTier; p5: P5Tier; dn: Dn; iq: IqTier /* the resolve configuration for the tier (IMAGE-QUALITY program: sharp direct + decoupled jitter + GBAA + the history de-blur — IqTier above; ?sharp / ?nosharp / ?noiq force it for the visit) */; scale: number /* the render scale the preset starts at UNDER TAAU, relative to its cap (ultra 1.0 = TAA only … verylow 0.5 = a 2× upscale per axis); with TAAU off every preset starts at 1.0 as before — maxH is the preset's OUTPUT resolution either way; the ladder / the Tab slider trim below it */; taau: Taau; maxH: number; volSteps: number; rc: { nx: number; ny: number; nz: number }; rcCoarse?: { nx: number; ny: number; nz: number } /* the row's cache grid with ONE CACHE GRID off (rcGridOf below the table) */; smokeOwn?: boolean /* the floor's row: SMOKE KEEP leaves this row's smoke alone (withSmoke below the table), and FIRE SMOKE SHED draws an open fire without its smoke on it (fireSmokeOf) */; cascades: number; rbIters: number; ds: [number, number, number]; hist: number; mesh: boolean | 'near'; cards: boolean; lossy: Lossy; caps: Caps; froxel: FroxelTier; }   // cards = settings.torchBounceCards (the carried spots' footprints as analytic one-bounce emitters, docs/internal/perf-2026-08-10.md: +0.13 ms gather at high, +0.27 at ultra, and the torch's first bounce off a wall comes back at its physical level instead of 4–15 % of it — a LOOK change, so on where it was eyeballed: ultra + high); ds = direct-light shadow samples [strongest light, other leaders, adaptive stop] — measured: 8/4/3 → 1/1/2 halves the direct pass (7.2 → 3.8 ms at 1600×1000), so the cheaper presets spend fewer rays as well as fewer pixels; hist = settings.directHistory (temporal reuse of the direct estimate: 0.5 = the default ≈ 2 frames, 0.7 ≈ 3 — verylow leans on it to hide its one-ray penumbra grain)
const RC_WHOLE = [1, 1, 1, 1] as const;   // every cascade level whole every frame
const ALL_OFF: Lossy = { checkerDirect: false, gatherThird: false, rcHalfRate: false, volQuarter: false, dimRays: false, dimBelow: 0.01, fireflyK: 0, rcPeriods: RC_WHOLE };
const FIREFLY_K = 4;   // the bound every preset but ultra runs the gather with (was the engine-wide default)
export const PRESETS: Record<QualityName, Preset> = {
  // the cascade probe volume is only a radiance CACHE now (read at the final gather's hit points, one bounce from the
  // eye), so it can be coarse: 1 m probes look the same as 0.5 m ones through the gather and cost a third.
  // rbIters = red/black pairs of the smoke pressure solve (4 pairs ≈ the old 20 Jacobi sweeps, better converged) — the rows run only under ?onesolve=0: the page
  // solves with high's at every preset (ONE SMOKE SOLVE below; smoke.ts's own default is the same 4 for a host with no Quality)
  // trade-offs folded in after a side-by-side eyeball with all five on (08-07): ultra stays the untouched reference; high takes the three measured invisible at
  // rest (third-res gather −3.4 ms, checkerboard rays −0.9, dim-pixel rays) and keeps half-res beams + full-rate cascades; medium and low take all five.
  // low and verylow raise the near-black threshold to 0.02 (≈ 4 % of display white after AgX instead of 2 %): more of a dark floor's pixels take the one-ray path.
  // verylow (08-08) = low with one shadow sample per leader (the measured half of the direct pass), more temporal reuse to carry it, 8 beam steps and a 600-px
  // internal cap — the rung auto drops to when low at the floor still starves.
  // rc: ONE grid for every preset since ONE CACHE GRID (below the table); `rcCoarse` on low and verylow is the grid those two ran before it and run with it off. Every reader
  // goes through rcGridOf — the preset put on, the grids parked at boot and the cost model — so the switch off is the ladder as it was, prices included.
  // fireflyK: every ladder preset keeps the gather's relative firefly bound at 4; ultra runs without it (see Lossy) — the Tab slider still moves it by hand.
  // hist: high runs the direct estimate's temporal reuse at 0.7 (perf-2026-08-10 §D: the one free knob that moved the torch-shadow boil beside a lying body — per-pixel
  // temporal sd p99 1.57 → 1.21, −23 %, at +0 ms; verylow was already there for its one-ray penumbrae); ultra keeps 0.5 as the reference.
  // scale (08-11): 1.0 for every preset now that the render scale is relative to the cap — maxH is the preset's resolution (1200 / 1000 / 900 / 720 / 600 rows on any
  // window at least that tall in device pixels, i.e. exactly what every HiDPI window already rendered under the old 1.0 / 1.0 / 0.8 / 0.65 / 0.5, where the cap always
  // won); a dpr-1 window shorter than the cap renders its own height at every preset whose cap is above it (medium on a 1000-row window: 900 rows, was 800).
  // rcPeriods (08-10, docs/internal/p0a-cascades.md): ultra + high trace every cascade level whole every frame (the chunked dispatch already took the cache from
  // 1.77 to 1.05 ms with the same bits, under high's 1.5 ms budget); the ladder presets refresh the FAR field over several frames instead of running the whole
  // cache at half rate — medium c2 over 2 / c3 over 4 frames, low c1 2 · c2 3 · c3 6, verylow c1 2 · c2 4 · c3 8 — c0 + the dice bake whole every frame everywhere.
  // dn (renderer v3 phase 3, the shared denoiser's tiers): shadow à-trous iterations / history cap · diffuse iterations / cap · specular iterations = ultra 4/16 · 5/32 · 2, high 3/12 · 4/24 · 1,
  // medium 3/10 · 3/16 · 1, low 2/8 · 3/12 · 1, verylow 2/8 · 2/8 · 1 — the same pipeline scaled; the clamp / edge-stop knobs are engine defaults shared by every tier.
  // scale + taau (renderer v3 phase 1): under TAAU each preset renders FEWER pixels than its cap and resolves up to it — ultra 1.0 (temporal AA only, no upscale) · high 0.77 (0.59× the
  // pixels) · medium 0.67 (0.45×) · low 0.6 (0.36×) · verylow 0.5 (0.25×); jitter cycle 8 where the ratio is mild, 16 for the deep upscales; clip γ 1.0 → 1.25 and sharpen 0.2 → 0.5 likewise.
  ultra:   { restir: { rays: 4, spatial: 5, history: 20, held: 8, motionMin: 0.3, motionTaps: 6 }, rt: { on: true, div: 2, rays: 2, maxRough: 0.55, atrous: 4 }, p5: { gi: 'temporal', giRays: 2, mesh: true, reuse: false }, dn: { shIters: 4, shCap: 16, giIters: 5, giCap: 32, spIters: 2 }, iq: IQ_C3J, scale: 0.9,  taau: { phases: 8,  clipGamma: 1.0,  sharpen: 0.2 }, maxH: 1200, volSteps: 24, rc: { nx: 40, ny: 4, nz: 28 }, cascades: 4, rbIters: 5, ds: [8, 4, 3], hist: 0.5, mesh: true, cards: true, lossy: ALL_OFF, caps: { volK: 6, volEvery: 2, volStep: 1.5, births: 512, debris: 64, rain: 6000, marchLights: 4, vol: 'classic' }, froxel: { h: 180, d: 56, k: 5, hist: 0.93, topRays: 3 } },
  high:    { restir: { rays: 4, spatial: 3, history: 20, held: 4, motionMin: 0.35, motionTaps: 6 }, rt: { on: true, div: 2, rays: 1, maxRough: 0.45, atrous: 3 }, p5: P5_OFF, dn: { shIters: 3, shCap: 12, giIters: 4, giCap: 24, spIters: 1 }, iq: IQ_C3J, scale: 0.77, taau: { phases: 8,  clipGamma: 1.0,  sharpen: 0.25 }, maxH: 1000, volSteps: 20, rc: { nx: 40, ny: 4, nz: 28 }, cascades: 4, rbIters: 4, ds: [8, 4, 3], hist: 0.7, mesh: 'near', cards: true, lossy: { checkerDirect: true, gatherThird: true, rcHalfRate: false, volQuarter: false, dimRays: true, dimBelow: 0.01, fireflyK: FIREFLY_K, rcPeriods: RC_WHOLE }, caps: { volK: 4, volEvery: 2, volStep: 1.5, births: 384, debris: 64, rain: 4000, marchLights: 3, vol: 'classic' }, froxel: { h: 135, d: 64, k: 4, hist: 0.93, topRays: 2 } },
  medium:  { restir: { rays: 4, spatial: 2, history: 20, held: 4, motionMin: 0.2, motionTaps: 6 }, rt: { on: true, div: 3, rays: 1, maxRough: 0.35, atrous: 3 }, p5: P5_OFF, dn: { shIters: 3, shCap: 10, giIters: 3, giCap: 16, spIters: 1 }, iq: IQ_C3J, scale: 0.67, taau: { phases: 16, clipGamma: 1.1,  sharpen: 0.4 }, maxH: 900,  volSteps: 14, rc: { nx: 40, ny: 4, nz: 28 }, cascades: 4, rbIters: 3, ds: [6, 3, 3], hist: 0.5, mesh: false, cards: false, lossy: { checkerDirect: true, gatherThird: true, rcHalfRate: false, volQuarter: true,  dimRays: true, dimBelow: 0.01, fireflyK: FIREFLY_K, rcPeriods: [1, 1, 2, 4] }, caps: { volK: 3, volEvery: 2, volStep: 1.5, births: 256, debris: 32, rain: 2500, marchLights: 2, vol: 'froxel' }, froxel: { h: 108, d: 48, k: 3, hist: 0.93, topRays: 2 } },
  low:     { restir: { rays: 3, spatial: 2, history: 20, held: 3, motionMin: 0.5, motionTaps: 6 }, rt: RT_OFF, p5: P5_OFF, dn: { shIters: 2, shCap: 8, giIters: 3, giCap: 12, spIters: 1 }, iq: IQ_C3J, scale: 0.6,  taau: { phases: 16, clipGamma: 1.2,  sharpen: 0.5 }, maxH: 720,  volSteps: 10, rc: { nx: 40, ny: 4, nz: 28 }, rcCoarse: { nx: 32, ny: 3, nz: 22 }, cascades: 4, rbIters: 3, ds: [4, 2, 2], hist: 0.5, mesh: false, cards: false, lossy: { checkerDirect: true, gatherThird: true, rcHalfRate: false, volQuarter: true,  dimRays: true, dimBelow: 0.02, fireflyK: FIREFLY_K, rcPeriods: [1, 2, 3, 6] }, caps: { volK: 2, volEvery: 2, volStep: 2.0, births: 192, debris: 32, rain: 1500, marchLights: 0, vol: 'froxel' }, froxel: { h: 80, d: 32, k: 2, hist: 0.93, topRays: 1 } },
  verylow: { restir: { rays: 2, spatial: 1, history: 20, held: 2, motionMin: 1.0, motionTaps: 6 }, rt: RT_OFF, p5: P5_OFF, dn: { shIters: 2, shCap: 8, giIters: 2, giCap: 8, spIters: 1 }, iq: IQ_C3J, scale: 0.5,  taau: { phases: 16, clipGamma: 1.25, sharpen: 0.5 }, maxH: 600,  volSteps: 8,  rc: { nx: 40, ny: 4, nz: 28 }, rcCoarse: { nx: 32, ny: 3, nz: 22 }, smokeOwn: true, cascades: 4, rbIters: 3, ds: [1, 1, 2], hist: 0.7, mesh: false, cards: false, lossy: { checkerDirect: true, gatherThird: true, rcHalfRate: false, volQuarter: true,  dimRays: true, dimBelow: 0.02, fireflyK: FIREFLY_K, rcPeriods: [1, 2, 4, 8] }, caps: { volK: 2, volEvery: 2, volStep: 2.0, births: 128, debris: 32, rain: 800, marchLights: 0, vol: 'froxel' }, froxel: { h: 64, d: 24, k: 2, hist: 0.93, topRays: 1 } },
};
/** ONE SMOKE SOLVE (settings.oneSmokeSolve, default on, `?onesolve=0`; off = each preset's own `rbIters`, as it was: ultra 5, high 4, the rest 3). A sight line through smoke
 *  (a defender's eye to the player, the room fight's pairs, a camera's: game/sensors.ts → render/shaders/probe.wgsl kind 1) is the optical depth of the SOLVER's density along the
 *  line. The red/black pairs of the pressure solve decide how well the velocity field is projected each step, so how a plume rolls and spreads: with the pairs a preset row, the
 *  cloud that hides a man had a different shape at medium than at high, and the auto ladder changed it under a fight each time it stepped. A game rule that read the graphics
 *  setting, as the light meter's cache grid was (ONE CACHE GRID below). One count for every preset, high's: the cloud drawn at ultra is no longer finer than the one sight reads
 *  at medium. Price: one pair more (two dispatches over the live bricks) a solver step on medium, low and verylow, one fewer on ultra — the cost model does not price the solver
 *  (it lands in the measured fixed part) and nobody has timed it. How far a plume's shape moved between 3, 4 and 5 pairs was never measured either. */
export function rbItersOf(p: Preset, one: boolean): number { return one ? PRESETS.high.rbIters : p.rbIters; }
/** FIRE SMOKE SHED (settings.fireSmokeShed, default on, `?fireshed=0`; off = every preset keeps an open fire's smoke, as it was). An open fire (game/fire.ts) files a hot
 *  smoke source on the solver every second while it is near the view, so near a fire the solver is awake and steps the plume's bricks: by the solver's figures on the
 *  maintainer's Mac (0.43 ms awake + 0.39 µs a stepping brick, 10-10) and the fire's own brick count (about 1,300, software adapter) 0.5 ms where other smoke already runs
 *  and 0.95 ms where the fire is the only smoke — the same at every preset, and fixed: the render scale does not shrink it. Against the model's rungs that is 3.5 to 6.5 %
 *  of high and 6 to 11 % of medium, which the scale pays; 11 to 20 % of low, which the scale pays where other smoke already runs and cannot where the fire is the only smoke
 *  (a machine that only just holds low goes to the floor beside such a fire); and 17 to 32 % of verylow, whose whole per-pixel part is 1.0 model-ms on the scale floor: it
 *  cannot be paid there. So the rung that keeps its own smoke (`smokeOwn`: verylow, the floor, where the smoke is the last thing the ladder sheds — SMOKE KEEP below) draws the
 *  fire without its smoke; every rung above keeps it and the scale pays. NOT a game rule: the source is look-only and its foot is over a standing man's head (the fire's notes:
 *  lines at 1.7 m and under kept all their light with the plume and without), but in the page a sight line over 1.9 m beside a fire reads the plume on low and up and none on
 *  verylow. None of it timed on a GPU.
 *  UP FROM THE FLOOR THE SHED STANDS ONE RUNG (fireSmokeFor): the hop verylow → low is priced off a frame measured with no fire smoke, so a low that put the smoke back
 *  would find itself 0.5 to 0.95 ms short beside a fire, fall to the floor, find room again and hop — the plume coming and going each time. So while AUTO moves the
 *  preset, the rung straight above a shedding one keeps the shed it arrived with; the smoke is back from the rung above that (medium, where the scale has the room) or
 *  when a preset is put on by hand. A machine that came DOWN to low keeps its smoke there. */
export function fireSmokeOf(p: Preset, shed: boolean): boolean { return !(shed && !!p.smokeOwn); }
/** … for preset `name` as it is put on: `auto` = the ladder is moving the preset, `now` = settings.fireSmoke as it stands (false = shed on the rung being left) */
export function fireSmokeFor(name: QualityName, shed: boolean, auto: boolean, now: boolean | undefined): boolean {
  if (!fireSmokeOf(PRESETS[name], shed)) return false;
  const i = AUTO_LADDER.indexOf(name);
  return !(auto && now === false && i >= 1 && !fireSmokeOf(PRESETS[AUTO_LADDER[i - 1]], shed));
}
/** ONE CACHE GRID (settings.oneCacheGrid, default on, `?onegrid=0`; off = low and verylow on their `rcCoarse`, as it was). The light meter the guards and teammates see by is the
 *  shadowed direct light PLUS the cache's dice (render/shaders/probe.wgsl), read trilinearly at the asked point — so the probe lattice is part of the reading. On the coarser lattice
 *  (1.25 m cells, three layers up the wall against 1 m and four) the same tight shadow read two to three times darker on low and verylow than on medium and up (a night yard's low
 *  wall: E 0.044 against 0.115, software adapter, 10-23): a game rule that read the graphics setting, and one the auto ladder moved under a mission each time it stepped between
 *  medium and low. One lattice for every preset takes the setting out of the reading, and the cache swap (a parked grid's stale field for some frames) out of that step. It does
 *  NOT make the read right: the meter still blends the cells around the man, some of them inside the wall beside him (docs/agents/render.md, BOUNCE WALLS 'not mended').
 *  Price: low and verylow trace 2.1 × the probes at their own refresh periods — in the cost model their fixed part 1.9 → 2.4 and 1.4 → 1.9 model-ms. */
export const rcGridOf = (p: Preset, one: boolean) => one || !p.rcCoarse ? p.rc : p.rcCoarse;
/** SMOKE KEEP (settings.smokeKeep, default 1, `?smokekeep=0|1|2`, Tab ▸ Frame; 0 = every preset's own smoke rows, as it was). The maintainer, with auto on medium (10-23): 'a ton
 *  of the smoke became very blocky … the smoke looks so sick in our game that i'd rather we keep it closer to high but then tradeoff other things in the frame budget'. The
 *  blocks are the quarter-size march (`lossy.volQuarter`: one march texel under 4 × 4 internal pixels, where high's half-size march has 2 × 2); under it medium and below also
 *  light the march with fewer lights a step and, on low and verylow, a longer step that combs a plume's shadow edges. 1 = on medium and low the SMOKE's rows are the better of
 *  its own and high's — the march at half size, high's lights a step (`caps.volK`, `caps.marchLights`), its shadow refresh and step length — on the preset's own path (the
 *  froxel haze stays: beams are not the smoke); everything else on the rung is still shed, and the ladder's render scale pays the difference. 2 = high's whole volumetric path
 *  too (`caps.vol` 'classic', high's beam steps): the smoke exactly as high draws it, at the preset's pixel count. The solver's iterations (`rbIters`) are not a look row: ONE SMOKE SOLVE above.
 *  A row with `smokeOwn` keeps its smoke at 1 and 2: verylow, the floor — the rung with nothing beneath it to pay, so the smoke is the LAST thing the ladder sheds.
 *  Every reader takes the preset through withSmoke — the rows put on, the live preset and the cost tables — so 0 is the ladder as it was, prices included. */
export const SMOKE_KEEP_DEFAULT = 1;
/** settings.smokeKeep from a setting or a ?smokekeep= word: 0 ('0', 'off', 'false') · 2 · anything else that is said 1; nothing said = the default */
export function smokeKeepOf(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return SMOKE_KEEP_DEFAULT;
  if (typeof v === 'string') return v === '2' ? 2 : v === '0' || v === 'off' || v === 'false' ? 0 : 1;
  return Math.max(0, Math.min(2, Math.round(v) || 0));
}
export function withSmoke(p: Preset, keep: number): Preset {
  if (!(keep > 0) || p.smokeOwn) return p;
  const H = PRESETS.high, K = p.caps, HK = H.caps, classic = keep >= 2 && HK.vol === 'classic';
  return { ...p, volSteps: classic ? Math.max(p.volSteps, H.volSteps) : p.volSteps, lossy: { ...p.lossy, volQuarter: p.lossy.volQuarter && H.lossy.volQuarter },
    caps: { ...K, volK: Math.max(K.volK, HK.volK), volEvery: Math.min(K.volEvery, HK.volEvery), volStep: Math.min(K.volStep, HK.volStep), marchLights: Math.max(K.marchLights, HK.marchLights), vol: classic ? 'classic' : K.vol } };
}
/** ?nortreflect (main.ts): the RT reflections held OFF for this visit whatever preset auto or a menu applies — the by-hand Tab row still works. Module state, so every Quality instance
 *  and every apply() honours it. */
export const rtVeto = { on: false };
/** ?nop5: renderer v3 phase 5's three extras vetoed for the visit (apply() writes P5_OFF whatever the preset says) — ultra's frame as it was before the phase, for A/B and the identity hashes */
export const p5Veto = { on: false };
/** ?sharp / ?nosharp: sharp direct forced on / off for the visit whatever the presets place (null = the preset's own `sharp`) — main.ts sets it, apply() honours it */
export const sharpForce: { v: boolean | null } = { v: null };
/** ?noiq: the whole IqTier forced OFF for the visit (= the resolve exactly as it was: the identity A/B against main) */
export const iqForce = { off: false };
/** ?gbaa: GBAA + the TAA's jitter off forced for the visit whatever the presets place (main.ts sets it, apply() honours it after the tier's own taau rows) */
export const gbaaForce = { on: false };
/** ?nogim: GI-in-motion's two renderer switches (the internal-res diffuse chain, the young-history gather rays) vetoed for the visit whatever the presets place — the identity A/B against main */
export const gimVeto = { on: false };
/** ?nofroxel: the per-pixel volumetric march at every tier for the visit; ?froxel: the froxel path even at ultra / high (the A/B against the classic smoke those tiers ship) */
export const froxelVeto = { on: false }; export const froxelForce = { on: false };
/** the render scale a preset starts at on THIS engine: its TAAU scale with the resolve on, 1.0 without it (the old behaviour, ?notaau) */
export const startScale = (p: Preset, taauOn: boolean) => taauOn ? p.scale : 1.0;

// ---- cost model for auto's calibration (plan() below; tools/qa/quality-plan.ts prints it and exercises plan() with synthetic machines) ----
// Only RATIOS between presets are used: calibration measures the real ms at the current preset and asks "what would preset X at scale s cost on THIS machine".
// Reference: the M4 Max, cubicles view, 1777×1000 internal, compute passes with frames serialized (08-07, bccea3d), at what 'high' was before the fold = ultra's
// per-pixel settings with 20 beam steps: 24.9 ms = direct 9.8 + softblur 3.3 + gather 6.6 + indirect temporal/à-trous ≈1.0 + volumetrics 0.8 + bloom ≈0.2
// (per-pixel: they scale with internal pixels) + cascades c0‥c3 + dice bake 3.0 + light-meter probe ≈0.2 (fixed: per probe / per voxel; the smoke solver is
// fixed too but idle behind the start card, so it is not in the model). Measured option factors, same session, off/on/off/on: checkerboard rays direct
// 9.8 → 9.0 (×0.92 — the design expectation was ×0.6–0.65 of the ray phase; on this GPU the late tracers + the exchange eat most of it, a slower GPU may
// do better: RE-MEASURE), third-res gather 6.6 → 3.2 (×0.485; temporal + à-trous assumed to follow at the same ratio, 4/9 of the texels), quarter-res
// volumetrics 0.8 → 0.3 (×0.375), half-rate cascades 3.0 → 2.8 averaged on the M4 (×0.93 — suspect: structurally it is ½ the dispatches + the pair's
// overheads, so the model says ×0.6 until a slow GPU says otherwise: RE-MEASURE), dim-pixel rays nothing in a lit view (dark rooms only: ×0.97 at
// 0.01, ×0.95 at 0.02 — a guess). Shadow-ray budget (e235894, 1600×1000): direct 7.2 ms at 8/4/3 → 3.8 at 1/1/2 (×0.53); 6/3/3 and 4/2/2 interpolated
// on rays actually spent (≈85 % of pixel×leader pairs agree and stop at the adaptive minimum, the rest spend the budget): 8/4/3 ≈ 3.5 rays, 6/3/3 ≈ 3.25
// (×0.95), 4/2/2 ≈ 2.15 (×0.745 — the adaptive stop 3 → 2 is most of it), 1/1/2 = 1 (×0.53).
// So, per pixel at equal pixel count (ultra = 1): high 0.77 · medium 0.72 · low 0.63 · verylow 0.55; fixed (ultra/high = 1): medium 0.63 · low/verylow 0.33 on their coarse cache grid (0.38 / 0.30 of ultra's on the one grid).
// The lead re-measures per-preset pass timings at one fixed scale and corrects REF / FACTOR; everything downstream follows.
export const REF = { direct: 9.8, softblur: 3.3, gather: 6.6, temporal: 1.0, vol20: 0.8, vol2D: 0.3, froxelHigh: 0.8, bloom: 0.2, rc: 3.0, probe: 0.2, mpx: 1.777, taau: 0.25, reflect: 1.3, sharp: 1.7, gbaa: 0.15, mesh: 0.13, meshNearDirect: 0.12 };   // mesh: the skin + refit pass with the men on the floor (a fixed 0.13 ms at high AND ultra, M4 Max); meshNearDirect: what high's near-only walk + the self-shadow add to the direct rays in a lit-men view (docs/internal/render-defects-0812.md §1)   // gbaa: the copy + blend pass at high's 1777×1000 output (image-quality.md §3), per output pixel   // sharp: 'sharpU' + 'compS' at high's 1777×1000 OUTPUT in the calm cubicles still (0.92 + 0.79 ms serialized, M4 Max, docs/internal/sharp-direct.md §2) — scales with the preset's output pixels like the resolve   // reflect: the RT reflections (trace + their denoise chain) per REF.mpx INTERNAL pixels at a ÷2 target, 1 ray, on a lino-heavy view (docs/internal/p4-materials.md §2); ×(1 + 0.58 (rays − 1)), × (2/div)² for other divisors   // vol2D / froxelHigh (renderer v3 phase 2b, froxel volumetrics ON — the default): the 2D pass keeps only the smoke march + rain (≈0.3 ms at REF.mpx in the gate minute, per pixel, ÷4 under volQuarter) and 'volFroxel' is a FIXED ≈0.8 ms at high's 240×135×64 grid, k 4 + the strongest light's second stratum, scaling with froxels × (k + strata + 1) — measured docs/internal/p2b-froxels.md §2; vol20 stays for the march (froxelVol off)   // taau: the resolve at high's 1777×1000 OUTPUT (renderer v3 phase 1; measured 0.24 ms there, 0.34 at ultra's 2133×1200, serialized, M4 Max) — it scales with the preset's output pixels (maxH²), not with the render scale, so the model files it under 'fixed'
export const FACTOR = { checker: 0.92, third: 0.485, quarter: 0.375, halfRate: 0.6, dim: { 0.01: 0.97, 0.02: 0.95 } as Record<number, number>, rays: { '8/4/3': 1, '6/3/3': 0.95, '4/2/2': 0.745, '1/1/2': 0.53 } as Record<string, number>, cards: 1.055,
  restir: { 6: 1.0, 5: 0.8, 4: 0.52, 3: 0.45, 2: 0.42 } as Record<number, number> };   // restir: the ReSTIR estimator's direct pass ÷ the leader/tail pass at 8/4/3 it replaces, by rays per pixel (docs/internal/p2a-restir.md: cubicles at high 7.1 → 3.55 / 2.97 / 2.54 ms; the stress minute 0.50–0.55 at every tier; 5 and 6 from the ultra takes). The checkerboard and dimRays factors do not apply to it (restir.wgsl ignores both)
/** the v3 denoiser's tiers in the model (docs/internal/p3-denoise.md §2, calm still, serialized, M4 Max): the SHADOW client costs ≈ (0.85 + 0.30 × iterations) ms per internal Mpx —
 *  4 iterations 5.37 ms at 2.56 Mpx, 3 → 1.77 at 1.05, 2 → 0.46 at 0.33 — i.e. ×1.17 / 1.0 / 0.83 of the legacy softblur term at 4 / 3 / 2 iterations (legacy = 3.3 at REF.mpx = v3 at 3);
 *  the DIFFUSE + SPECULAR clients on the gather grid ≈ 2× the legacy temporal + giblur term at 4 iterations (0.26 vs 0.13 ms at high, 1.05 vs 0.46 at ultra's 5), ×(0.5 + 0.125 × gi iterations) */
export const dnShadowFactor = (iters: number) => (0.85 + 0.30 * iters) / 1.75;
export const dnGiFactor = (iters: number) => 2.0 * (0.5 + 0.125 * iters);   // cards: the gather with torch bounce cards on (perf-2026-08-10: 4.835 → 5.102 ms at ultra half res, 1.605 → 1.731 at high third res — ×1.055 / ×1.08 with one card lit; ×1.055 taken, the torches are rarely all on a wall at once). halfRate: honestly measured on 08-10 it is ×0.49 on the M4 (the ×0.93 the timers used to show was stale-timestamp phantom cost, docs/internal/p0a-cascades.md §4); ×0.6 kept as the conservative model
/** the schedule's factor on the cascade cost: each level's share of the whole-cache WORK (c0 + dice 0.10, c1 0.15, c2 0.30, c3 0.45 — the unchunked split, i.e. what a throughput-bound
 *  GPU pays; the M4 itself is latency-bound there and gains less) divided by its refresh period. [1,1,1,1] → 1; medium's [1,1,2,4] → 0.51; verylow's [1,2,4,8] → 0.31 */
export const rcPeriodsFactor = (p: readonly number[]) => { const share = [0.10, 0.15, 0.30, 0.45]; let f = 0; for (let n = 0; n < 4; n++) f += share[n] / Math.max(1, n === 0 ? 1 : (p[Math.min(n, p.length - 1)] || 1)); return f; };
/** modelled compute cost of a preset on the reference machine at the reference pixel count: per-pixel passes (ms at REF.mpx internal megapixels) and the fixed part, itemised */
export function presetCost(p: Preset, oneGrid = true) {   // oneGrid: settings.oneCacheGrid — false prices low and verylow on their coarse cache grid, as they were
  const L = p.lossy; const rays = FACTOR.rays[p.ds.join('/')] ?? 1;
  // the direct pass is the ReSTIR estimator now (settings.restir defaults on and no preset switches it): priced by its rays per pixel; the leader/tail formula it replaces —
  // REF.direct × rays × checker × dim — is what ?norestir costs (the runtime ladder catches the difference if somebody boots that way)
  const direct = FACTOR.restir[p.restir.rays] !== undefined ? REF.direct * FACTOR.restir[p.restir.rays] : REF.direct * rays * (L.checkerDirect ? FACTOR.checker : 1) * (L.dimRays && p.ds[0] > 1 ? (FACTOR.dim[L.dimBelow] ?? 0.97) : 1);   // (at 1/1 the dim-pixel path changes nothing)
  const gather = REF.gather * (L.gatherThird ? FACTOR.third : 1) * (p.cards ? FACTOR.cards : 1), temporal = REF.temporal * (L.gatherThird ? FACTOR.third : 1) * dnGiFactor(p.dn.giIters);
  const softblur = REF.softblur * dnShadowFactor(p.dn.shIters);   // (the v3 denoiser is the engine default: its shadow client files under 'softblur', its gather-grid clients under 'temporal', both tiered by iterations)
  const classicVol = p.caps.vol === 'classic';   // (08-12: ultra / high run the per-pixel march for haze and smoke — priced per pixel at vol20 × volSteps/20 with no froxel term; the froxel tiers keep the 2D smoke+rain pass + the fixed froxel term)
  const vol = (classicVol ? REF.vol20 * (p.volSteps / 20) : REF.vol2D) * (L.volQuarter ? FACTOR.quarter : 1);   // (froxels on: the 2D pass = smoke march + rain; the beams' cost is the fixed froxel term below — a smaller error than the model's own on this pass)
  const F = p.froxel, FH = PRESETS.high.froxel;
  const froxel = classicVol ? 0 : REF.froxelHigh * (F.h / FH.h) ** 2 * (F.d / FH.d) * ((F.k + F.topRays + 1) / (FH.k + FH.topRays + 1));   // 'volFroxel' (0 on the classic tiers): ∝ froxels (rows² at a fixed aspect × slices) × shadow rays per lit froxel
  const rc = REF.rc * (probesOf(p, oneGrid) / probesOf(PRESETS.ultra)) * (p.cascades / 4) * (L.rcHalfRate ? FACTOR.halfRate : 1) * rcPeriodsFactor(L.rcPeriods);
  const taau = REF.taau * (p.maxH / PRESETS.high.maxH) ** 2;   // the resolve at this preset's output size (with TAAU off the machine simply measures a smaller fixed part; the ratios stay close)
  const sharp = p.iq.sharp && p.scale < 1 ? (REF.sharp + (p.iq.gbaa ? REF.gbaa : 0)) * (p.maxH / PRESETS.high.maxH) ** 2 : 0;   // sharp direct's output-size kernels ('sharpU' + 'compS') where the preset places it (Preset.sharp): per OUTPUT pixel like the resolve, live only where the preset renders below its cap (docs/internal/sharp-direct.md §2)
  const reflect = p.rt.on ? REF.reflect * (1 + 0.58 * Math.max(0, p.rt.rays - 1)) * (2 / Math.max(1, p.rt.div)) ** 2 : 0;   // RT reflections ('reflect' + 'rdenoise'): per pixel of the reflection target, roughly linear in rays past the first
  const mesh = p.mesh ? REF.mesh + (p.mesh === 'near' ? REF.meshNearDirect : 0) : 0;   // mesh-traced character shadows: the refit pass (+ high's near-only share of the direct rays; ultra's every-ray walk was measured inside its direct REF)
  const pixel = direct + softblur + gather + temporal + vol + REF.bloom + reflect, fixed = rc + REF.probe + taau + froxel + sharp + mesh;
  return { pixel, fixed, passes: { direct, softblur, gather, temporal, volumetrics: vol, volFroxel: froxel, bloom: REF.bloom, reflect, rc, probe: REF.probe, taau, sharp, mesh } };
}
/** the table for another setting of the two switches that move a preset's price: ONE CACHE GRID off prices low and verylow on their coarse grid, SMOKE KEEP 0 / 2 the smoke
 *  rows as each preset has them / on high's path (both off = the table as it was) */
type CostTable = Record<QualityName, ReturnType<typeof presetCost>>;
const costTables = new Map<string, CostTable>();
export function costTable(oneGrid = true, smokeKeep = SMOKE_KEEP_DEFAULT): CostTable {
  const keep = smokeKeepOf(smokeKeep), key = `${oneGrid ? 1 : 0}/${keep}`;
  let t = costTables.get(key); if (!t) { t = Object.fromEntries(QUALITY_NAMES.map(n => [n, presetCost(withSmoke(PRESETS[n], keep), oneGrid)])) as CostTable; costTables.set(key, t); }
  return t;
}
/** the table of the page as it opens: one cache grid, SMOKE KEEP 1 */
export const COST = costTable();

export interface Plan { preset: QualityName; scale: number; predicted: number; note: string }
/** The pure part of auto's boot decision (Quality.decide), exercised with synthetic numbers by tools/qa/quality-plan.ts: given the measured compute ms (total and its
 *  fixed part) at preset `cur` and effective scale `effNow` (internal / CSS×dpr, engine.effectiveScale) on a canvas `cssH` CSS px tall at `dpr`, return the highest ladder
 *  preset — and the render scale RELATIVE TO THAT PRESET'S CAP on this window (engine.ts resize; snapped down onto SCALE_STEP) — predicted to fit `budgetMs` of compute
 *  (PLAN_BUDGET_MS: 15 ms ≈ a presented 50–55 fps once the render passes, the CPU and vsync slop are added). Order of preference: high → medium → low at full scale; low
 *  with the scale solved for the budget (never under the floor); verylow at full scale; verylow solved down to the floor; and if even that misses, verylow at the floor
 *  flagged 'below target' (the runtime ladder has nothing cheaper either). */
export function plan(gpuMs: number, fixedMs: number, cur: QualityName, effNow: number, cssH: number, dpr: number, budgetMs = PLAN_BUDGET_MS, taauOn = true, oneGrid = true, smokeKeep = SMOKE_KEEP_DEFAULT): Plan {
  const table = costTable(oneGrid, smokeKeep);   // (the grid and the smoke rows the presets run: settings.oneCacheGrid, settings.smokeKeep)
  const pixelMs = Math.max(0.5, gpuMs - fixedMs); const c0 = table[cur];
  const capOf = (p: Preset) => Math.min(1, p.maxH / Math.max(1, cssH * dpr));                            // the effective scale that preset's cap gives this window at render scale 1.0
  const fixedOf = (name: QualityName) => fixedMs * (table[name].fixed / c0.fixed);
  const perEff2 = (name: QualityName) => pixelMs * (table[name].pixel / c0.pixel) / Math.max(1e-4, effNow * effNow);   // ms per unit of effective scale² at that preset
  const predict = (name: QualityName, scale: number) => fixedOf(name) + perEff2(name) * (capOf(PRESETS[name]) * Math.min(1, scale)) ** 2;
  const start = (name: QualityName) => startScale(PRESETS[name], taauOn);   // the scale a preset starts at: its TAAU scale, or 1.0 with the resolve off
  for (let i = AUTO_LADDER.length - 1; i >= 1; i--) {            // high → medium → low at their starting scale
    const name = AUTO_LADDER[i]; const pr = predict(name, start(name));
    if (pr <= budgetMs) return { preset: name, scale: start(name), predicted: pr, note: 'fits' };
  }
  /** `name` with its scale solved for the budget: the effective scale that lands on the budget ÷ what the cap gives at 1.0, snapped DOWN onto the step grid, no lower than the
   *  floor, no higher than the preset's own starting scale (every value below it renders fewer pixels — there is no cap left to hide behind) */
  const solve = (name: QualityName): Plan => {
    const p = PRESETS[name]; const cap = capOf(p); const room = budgetMs - fixedOf(name); const top = start(name);
    const need = room > 0 ? Math.sqrt(room / perEff2(name)) : 0;    // the effective scale that lands exactly on the budget
    const scale = Math.min(top, Math.max(SCALE_FLOOR, snapDown(need / Math.max(1e-4, cap))));
    const predicted = predict(name, scale);
    return { preset: name, scale: +scale.toFixed(2), predicted, note: predicted <= budgetMs + 1e-6 ? (scale >= top - 1e-3 ? 'fits' : `${name}, reduced scale`) : 'below target even at the floor' };
  };
  const low = solve('low'); if (low.predicted <= budgetMs + 1e-6) return low;
  return solve('verylow');                                          // fits at its own scale, fits reduced, or the flagged floor — solve() says which
}

const clamp01 = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** document.hidden, unless an automation run says the pane is being pumped anyway (`window.__testVisible`): the headless Browser pane reports hidden
 *  even while it renders, which would keep calibration from ever running under test */
const pageHidden = () => document.hidden && !window.__testVisible;

export class Quality {
  current: QualityName = 'high';
  adaptive = true;
  /** 'auto': the preset itself moves with the measured frame rate (and the pick is remembered for the next visit) */
  auto = true;
  /** ceiling for the adaptive scaler = the preset's scale */
  private maxScale = 1.0;
  private acc = 0; private frames = 0; private slow = 0; private fast = 0; private cooldown = 2.5;
  private starved = 0; private cruising = 0;   // auto mode: consecutive 1 s windows where resolution scaling was not enough / where there was obvious headroom
  // the headroom-aware climb's state (CLIMB above): the GPU union accumulated over the window, consecutive roomy windows, seconds since the last climb, the rungs standing (newest last), the rungs
  // that failed lately (key → seconds left), a clock for those
  private unionAcc = 0; private unionN = 0; private roomy = 0; private sinceClimb = 99; private climbed: ClimbStep[] = []; private failed = new Map<string, number>(); private failCount = new Map<string, number>(); private clock = 0; private dipping = 0;
  private lastClimbAt = -1e9; private undidForDip = false; private unsureAcc = false; private unsureRun = 0; private hopSlowAt = -1;   // (the fps back-off: when the last rung went up — undoing never touches it — and whether this dip already had its one newest-only undo)
  /** auto's preset hops: the last hop up (for 'straight back down = that hop failed') and the pairs held off since, `${from}>${to}` → until / repeat count — NOT cleared by apply() */
  private lastHop: { from: QualityName; to: QualityName; at: number } | null = null; private hopHold = new Map<string, { until: number; n: number }>();
  // SHARP SHED's state (SHED above; none of it moves while settings.ladderShed or auto is off): sharp direct is shed · what this machine's union showed it costs (ms at `rows` output rows) · the
  // union the shed was taken at, for the first window after it to measure against · no way back before `until` (`n` sheds in this run of them, `backAt` = when it last came back) · windows with room for it
  shed = false; private shedSeen: { ms: number; rows: number; until: number } | null = null; private shedMark: { union: number; scale: number; preset: QualityName; back?: boolean } | null = null; private shedHold = { until: 0, n: 0, backAt: -1e9 }; private shedRoomy = 0;
  /** the cost model's price of running preset `next` at its starting scale on this window, relative to `cur` at its current scale (COST's per-pixel and fixed parts; the union × this =
   *  the union to expect after the hop): medium → high ≈ 1.5, low → medium and verylow → low ≈ 2.2 at 720 CSS rows on the coarse cache grid (low → medium ≈ 1.9 on the one grid) — never the flat '×2' a threshold would assume */
  hopRatio(next: QualityName, cur: QualityName = this.current as QualityName): number {
    if (!(cur in COST) || !(next in COST)) return 2;
    const { cssH, cssW, dpr } = this.win();
    const taauOn = this.engine.settings.taau !== false;
    const S = this.engine.settings;
    const mpx = (maxH: number, scale: number) => { const rows = Math.min(maxH, cssH * dpr) * scale; return rows * rows * (cssW / cssH) / 1e6; };
    const costOf = (c: ReturnType<typeof presetCost>, maxH: number, scale: number) => c.fixed + c.pixel * mpx(maxH, scale) / REF.mpx;
    // the CURRENT preset priced as it is being rendered — the live scale (climbed above the start or cut below it), the live lossy divisors, the live cap — not as its rows say
    const pc = PRESETS[cur]; const live: Preset = cur === this.current ? this.livePreset(cur) : pc;
    const one = this.oneGrid(), table = costTable(one, this.smokeKeep());   // (the grid and the smoke rows the presets run: ONE CACHE GRID, SMOKE KEEP)
    const curCost = costOf(cur === this.current ? presetCost(live, one) : table[cur], live.maxH, cur === this.current ? S.renderScale : startScale(pc, taauOn));
    const nextCost = this.shed && this.shedOn() ? presetCost({ ...withSmoke(PRESETS[next], this.smokeKeep()), iq: { ...PRESETS[next].iq, sharp: false } }, one) : table[next];   // (SHARP SHED: the shed stays across the hop, so the next preset is priced as it will run)
    return costOf(nextCost, PRESETS[next].maxH, startScale(PRESETS[next], taauOn)) / Math.max(0.1, curCost);
  }
  /** preset `cur` (the current one) as it is being rendered: the live lossy divisors, cap and scale over its rows (scale + iq.sharp as they are: presetCost prices sharp direct by `iq.sharp && scale < 1`) */
  private livePreset(cur: QualityName): Preset { const S = this.engine.settings; const pc = withSmoke(PRESETS[cur], this.smokeKeep()); return { ...pc, lossy: { ...pc.lossy, gatherThird: !!S.gatherThird, volQuarter: !!S.volQuarter, rcHalfRate: !!S.rcHalfRate }, maxH: S.maxInternalHeight || pc.maxH, scale: S.renderScale, iq: { ...pc.iq, sharp: !!S.sharpDirect && S.taau !== false } }; }
  /** the climb is allowed at all this visit: false under a `?quality=` pin (main.ts) — 'pins a preset' means the rows the harnesses and A/B pages measure stay put; a preset pinned from a MENU
   *  keeps the climb (spending a roomy machine's headroom is what it is for), and settings.ladderClimb is the by-hand switch either way */
  climbAllowed = true;
  /** the motion-calm bundle (MOTION_CALM) is on for this visit: re-applied after every preset change */
  motionCalm = false;
  /** what the climb sees and holds, for the Tab panel / QA (`__quality.climbState`) */
  get climbState() { return { standing: this.climbed.map(rungKey), roomy: this.roomy, sinceClimb: +this.sinceClimb.toFixed(1), failed: [...this.failed.entries()].map(([k, t]) => `${k} ${Math.max(0, t - this.clock).toFixed(0)} s`), lastUnion: this.lastUnion, lastFps: this.lastFps, allowed: this.climbAllowed }; }
  private lastUnion = 0; private lastFps = 0;
  // the aim's own state (HOLD above; none of it is touched while settings.ladderAim is 0): consecutive windows with the union over the back-off band and no rung standing; the display's refresh
  // as far as this page has SEEN it (the fastest tenth of its rAF intervals, the highest so far — 0 = not yet; a display at 60 never shows more, one at 120 shows it the moment the frame fits);
  // `displayHzPin` > 0 = told (QA / the replay tool)
  private hot = 0; private paced = 0; private maxDt = 0; displayHz = 0; displayHzPin = 0; private vsWatching = false;
  private probeUntil = 0; private probeN = 0; private pacedAt = 0; private pacedSince = 0; private pacedChecks = 0; private pacedMiss = 0; private pacedRun = 0; private pacedBack = { at: -1e9, n: 0, until: 0 }; private pacedFailed = new Set<string>(); private lastCut: { from: number; preset: QualityName; avg: number; union: number; at: number; marks?: [string, number, number | undefined][]; probeFrom?: number; shed?: boolean } | null = null; private upTrial: { from: number; avg: number } | null = null;   // the paced check (PACED; as now under ladderPaced, an aim under ladderHeld): the verified pace (s a frame, 0 = none), paced windows running, the cut being judged (`marks`: the failed-rung state an aim's judged cuts found, put back with the pixels; `probe`: a chain of nothing but an aim's own judged cuts), the step up being judged
  /** settings.ladderAim as the ladder reads it (a stub engine without the row = 0 = as now) */
  get aim(): number { const a = Number((this.engine.settings as { ladderAim?: number }).ladderAim); return a > 0 ? a : 0; }
  /** the bands the ladder is on right now (ladderBands above) */
  get bands(): Bands { const a = this.aim; if (!a) return AS_NOW; this.watchDisplay(); const hz = this.displayHzPin || this.displayHz; if (a !== this.bandsOf.aim || hz !== this.bandsOf.hz) this.bandsOf = { aim: a, hz, b: ladderBands(a, hz) }; return this.bandsOf.b; }
  private bandsOf: { aim: number; hz: number; b: Bands } = { aim: 0, hz: 0, b: AS_NOW };
  /** what the aim sees, for the Tab panel / QA */
  get aimState() { const b = this.bands; return { aim: this.aim, hold: b.hold, target: +b.target.toFixed(1), displayHz: this.displayHzPin || this.displayHz, unionBudget: +b.planBudget.toFixed(2), cutFps: +b.cutFps.toFixed(1), hot: this.hot }; }
  /** the display's rate, watched on a rAF of the page's own while an aim is set (main.ts starts it at boot whenever an aim is set — the default's or ?aim='s —, the first `bands` read otherwise; it stops itself back under 'as now': nothing
   *  new runs there): every 60 intervals, displayRateOf says what the page has just reached; RAISED here whenever the frames show more, LOWERED only by sample() on HOLD.pacedWindows of
   *  frames that are slow with the GPU inside its budget (a window moved to a slower display, a browser that throttles) */
  watchDisplay() {
    if (this.vsWatching || typeof requestAnimationFrame !== 'function') return; this.vsWatching = true;
    let last = -1; let win: number[] = [];
    const tick = (ts: number) => {
      if (!this.aim) { this.vsWatching = false; return; }
      if (last >= 0) { const d = ts - last; if (d > 2 && d < 100) win.push(d); else win = []; }   // (a gap — a hidden tab, a stall — breaks the run)
      last = ts;
      if (win.length >= 60) { const seen = displayRateOf(win); win = []; if (seen > this.displayHz) this.displayHz = seen; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  lastChange = '';
  /** calibration (auto only): a couple of seconds of GPU pass timings behind the card that is up (the start card at boot, the pause card when auto is chosen
   *  there) → preset AND scale in one step, instead of crawling down 0.1 at a time while the player already suffers. `sample()` stays quiet until it has decided. */
  private calib: { frames: number; t: number; gpu: number[]; fixed: number[]; dts: number[]; done: boolean } = { frames: 0, t: 0, gpu: [], fixed: [], dts: [], done: false };
  get calibrating() { return this.auto && !this.calib.done; }
  /** fired when a calibration settles (decide) — main.ts refreshes the pause card's note, which otherwise goes stale while the card is up */
  onCalibrated: (() => void) | null = null;

  constructor(private engine: Engine, private smoke: SmokeSystem) {
    // remembered choice: 'auto' (default) resumes from the preset auto settled on last time; a named preset is a manual pin
    let mode: string | null = null;
    try { mode = localStorage.getItem(LS_MODE); } catch { /* private mode etc. */ }
    if (mode && (QUALITY_NAMES as string[]).includes(mode)) { this.auto = false; this.apply(mode as QualityName); }
    else this.startAuto();
    // the cascade grids the presets can ask for (one under ONE CACHE GRID — nothing to build; with it off two: ultra‥medium's and low / verylow's), built now behind the start card so
    // the ladder's first medium ↔ low step — or a pin from the menu — swaps a parked instance in instead of building one mid-game (engine.ts rebuildRc / prewarmRc; the stub engines of tools/qa have none)
    const one = this.oneGrid();
    const grids = new Map<string, RcConfig>(); for (const n of QUALITY_NAMES) { const p = PRESETS[n], g = rcGridOf(p, one); grids.set(`${g.nx}x${g.ny}x${g.nz}/${p.cascades}`, { ...defaultRcConfig, ...g, cascades: p.cascades, interval0: this.engine.rc.cfg.interval0 }); }
    this.engine.prewarmRc?.([...grids.values()]);
  }
  /** Auto from here: start at the preset (and scale) auto last settled on ON THIS MACHINE if it remembers one — else the current preset when it is on the ladder,
   *  else high (a remembered or current 'ultra' is a hand pin, never an auto pick) — and calibrate afresh behind whichever card is up. One path for the boot and
   *  for 'auto' chosen in a menu later, so the two can no longer disagree (review #24: a pinned boot left calib.done false and a later 'auto' re-measured off the
   *  paused frame, while auto → pin → auto never re-measured and restarted at high ×1.0 to crawl down the runtime ladder). Chosen from the pause card, the
   *  measurement runs behind that card exactly as the boot's runs behind the start card — the still frame is the same load — and decide() lands about 1.3 s of
   *  presented frames later, normally before Resume; a player quicker than that gets the one step within their first second, as one who beats the start card does. */
  private startAuto() {
    this.lastHop = null;   // (a hop under a previous auto spell says nothing about this one)
    this.auto = true; this.shed = false; this.shedSeen = null; this.shedMark = null; this.shedHold = { until: 0, n: 0, backAt: -1e9 }; this.shedRoomy = 0;   // (nor does a shed: this spell starts with the tier's own rows and measures them)
    let remembered: string | null = null, sc: number | null = null;
    try { remembered = localStorage.getItem(LS_AUTO); const v = parseFloat(localStorage.getItem(LS_SCALE) ?? ''); if (isFinite(v)) sc = v; } catch { /* */ }
    const onLadder = (n: string | null): n is QualityName => !!n && (AUTO_LADDER as string[]).includes(n);
    const start: QualityName = onLadder(remembered) ? remembered : onLadder(this.current) ? this.current : 'high';
    if (!onLadder(remembered)) sc = null;   // a remembered scale belongs to a remembered preset
    this.apply(start);
    if (sc !== null && sc < this.maxScale - 1e-3) this.engine.settings.renderScale = clamp01(sc, SCALE_FLOOR, this.maxScale); else sc = null;   // resume at the scale this machine settled on last time; calibration refines it
    this.calib = { frames: 0, t: 0, gpu: [], fixed: [], dts: [], done: false };
    this.starved = this.cruising = 0;
    this.lastChange = `auto: starting at ${this.current}${sc !== null ? ` ×${this.engine.settings.renderScale.toFixed(2)}` : ''}${onLadder(remembered) ? ' (this machine\'s last pick)' : ''} — calibrating`;
  }

  /** the smoke's rows of a preset, written to the settings: the march's size, its lights a step, shadow refresh and step length, the beam steps and the volumetric path — the ONE
   *  writer, for a preset put on (apply) and for SMOKE KEEP moved by hand (resmoke) */
  private putSmoke(p: Preset) {
    const S = this.engine.settings, K = p.caps;
    S.volSteps = p.volSteps; S.volQuarter = p.lossy.volQuarter; S.volLightCap = K.volK; S.volShadowEvery = K.volEvery; S.volStepVoxels = K.volStep; S.smokeMarchLights = K.marchLights;
    S.froxelVol = froxelVeto.on ? false : froxelForce.on ? true : K.vol === 'froxel';   // the tier's volumetric path (Caps.vol above; ?nofroxel / ?froxel force it for the visit)
  }
  /** SMOKE KEEP moved by hand (the Tab row): the current preset's smoke rows put on again, nothing else of the preset touched. A 'volumetrics ¼ → ½' rung the climb had
   *  standing is forgotten with it (the rows just written are the preset's start: undoing that rung later would put the march back at quarter size under a kept smoke). */
  resmoke() {
    if (!(this.current in PRESETS)) return;
    this.putSmoke(withSmoke(PRESETS[this.current], this.smokeKeep())); this.climbed = this.climbed.filter(st => st.kind !== 'vol');
  }
  /** ONE CACHE GRID as the engine has it (a stub engine without the setting counts as on — the default) */
  private oneGrid(): boolean { return this.engine.settings.oneCacheGrid !== false; }
  private oneSolve(): boolean { return this.engine.settings.oneSmokeSolve !== false; }
  private fireShed(): boolean { return this.engine.settings.fireSmokeShed !== false; }
  /** SMOKE KEEP as the engine has it, 0 ‥ 2 (a stub engine without the setting counts as the default) */
  private smokeKeep(): number { return smokeKeepOf(this.engine.settings.smokeKeep); }
  /** The label for menus: 'auto (high)' or the pinned preset. */
  get label() { return this.auto ? `auto (${this.current})` : this.current; }

  /** Pin a preset by hand (turns auto off — and any calibration in flight with it — and remembers the pin). */
  pin(name: QualityName) { this.auto = false; this.calib.done = true; this.lastHop = null; this.hopSlowAt = -1; this.apply(name); try { localStorage.setItem(LS_MODE, name); } catch { /* */ } }
  /** Back to auto (a menu's choice): remembered, then exactly the boot's auto path — this machine's last auto pick + scale if it has one, calibrate behind the card (startAuto). */
  setAuto() { try { localStorage.setItem(LS_MODE, 'auto'); } catch { /* */ } this.startAuto(); }

  apply(name: QualityName) {
    const p = withSmoke(PRESETS[name], this.smokeKeep()); const S = this.engine.settings; this.current = name; this.lastCut = null; this.upTrial = null;   // (a preset put on is nobody's cut to judge; SMOKE KEEP: its smoke rows are the better of its own and high's)
    const sc = startScale(p, S.taau !== false);   // (a stub engine without the setting counts as TAAU on — the default)
    S.renderScale = sc; S.maxInternalHeight = p.maxH; this.maxScale = sc;
    S.taauPhases = p.taau.phases; S.taauClipGamma = p.taau.clipGamma; S.taauSharpen = p.taau.sharpen;   // the resolve's per-tier knobs (Tab ▸ Frame rows move them by hand until the next preset)
    S.rtReflect = p.rt.on && !rtVeto.on; S.rtReflectDiv = p.rt.div; S.rtRays = p.rt.rays; S.rtMaxRough = p.rt.maxRough; S.rtAtrous = p.rt.atrous;   // RT reflections per tier (RtTier above; ?nortreflect vetoes the switch, the Tab ▸ Materials rows move them by hand until the next preset)
    { const p5 = p5Veto.on ? P5_OFF : p.p5; S.giResample = p5.gi; S.giResampleRays = p5.giRays; S.rtMeshHits = p5.mesh; S.rtHitReuse = p5.reuse; }   // phase 5's ultra extras (P5Tier above): on in ultra, off everywhere else — the Tab rows move them by hand until the next preset; ?nop5 vetoes them
    if (gbaaForce.on) { S.gbaa = true; S.taauPhases = 0; }   // ?gbaa: geometric edge AA + jitter off, over the tier's phases row above
    if (!this.shedOn()) this.shed = false;   // (SHARP SHED is auto's, under its switch: a preset pinned by hand has its own rows)
    const iq = iqForce.off ? IQ_OFF : p.iq; const sharpOn = sharpForce.v ?? (iq.sharp && !this.shed);   // the tier's resolve configuration (IqTier; ?noiq / ?sharp / ?nosharp force it; SHARP SHED keeps sharp direct off across auto's hops; the Tab ▸ Frame rows move each by hand until the next preset)
    this.putSharp(iq, sharpOn); S.taauHistSharp = iq.histSharp;
    S.dnShadowIters = p.dn.shIters; S.dnShadowCap = p.dn.shCap; S.dnGiIters = p.dn.giIters; S.dnGiCap = p.dn.giCap; S.dnSpecIters = p.dn.spIters;   // the v3 denoiser's tiers (render/denoise.ts; Tab ▸ Denoiser rows likewise) — inert under settings.denoiser 'legacy'
    S.giFullRes = !!p.dn.giFull && !gimVeto.on; S.giFullIters = p.dn.giFullIters ?? 4; S.giYoungRays = gimVeto.on ? 1 : (p.dn.giYoungK ?? 1);   // GI in motion per tier (Dn above; ?nogim vetoes both for the visit; Tab ▸ Indirect light rows move them by hand until the next preset)
    S.directSamplesTop = p.ds[0]; S.directSamplesOther = p.ds[1]; S.directAdaptiveMin = p.ds[2]; S.directHistory = p.hist;
    S.restirRays = p.restir.rays; S.restirSpatial = p.restir.spatial; S.restirHistory = p.restir.history; S.heldRays = p.restir.held; S.restirMotionMin = p.restir.motionMin; S.restirMotionTaps = p.restir.motionTaps;   // ReSTIR DI's tier (settings.restir itself is not a preset's business: ?norestir / the Tab row own it)
    const L = p.lossy; S.checkerDirect = L.checkerDirect; S.gatherThird = L.gatherThird; S.rcHalfRate = L.rcHalfRate; S.dimRays = L.dimRays; S.dimRaysBelow = L.dimBelow; S.rcPeriods = [...L.rcPeriods];   // plain settings writes = exactly what the pause-menu rows do (engine.render mirrors them into setDivisors / rc.halfRate / the frame flag / lossyCfg each frame); a row flipped by hand afterwards sticks until the next preset is applied — by hand or by auto's ladder
    S.giFireflyK = L.fireflyK;   // the gather's relative firefly bound, the same way (lossyCfg.w; the Tab ▸ Indirect light slider is the by-hand row)
    S.meshShadows = !!p.mesh; S.meshShadowsNear = p.mesh === 'near';   // mesh-traced character shadows: ultra every ray (measured free at 2133×1200: direct 17.4 / 17.9 / 17.1 ms off / on / off), high for NEAR receivers only (the contact seam between a limb and its proxy's shadow: +0.13 ms mesh pass + a bounded share of the direct rays — docs/internal/render-defects-0812.md §1), the rest off; the engine still ANDs meshShadowsAvailable; the pause-menu / Tab rows are the by-hand switch
    S.torchBounceCards = p.cards; // torch bounce cards: ultra + high (docs/internal/perf-2026-08-10.md — cheap everywhere, placed where the look was checked); Tab ▸ Indirect light is the by-hand switch
    const K = p.caps; this.putSmoke(p);   // the smoke's rows — the march's size, lights a step, shadow refresh, step length, the beam steps, the volumetric path (putSmoke: one writer with the Tab row's resmoke)
    // the worst-case caps (Caps above): the volumetric march / beams …
    const F = p.froxel; S.froxelH = F.h; S.froxelD = F.d; S.froxelK = F.k; S.froxelHistory = F.hist; S.froxelTopRays = F.topRays;    // … the froxel volume's grid / lights per froxel / history (FroxelTier above; settings.froxelVol itself is not the preset's: ?nofroxel / the Tab row own it) …
    S.particleBirths = K.births;                                                                           // … GPU particle births a frame (engine.render hands it to Particles.prepare; the queue carries the rest) …
    S.debrisCap = K.debris;                                                                                // … the destruction lane's rigid-debris pool (game/debris.ts reads it live: a full pool demotes new break-offs to particles) …
    S.particleRainCount = K.rain;                                                                          // … the particle rain's drop cap (rainFx.ts; nothing runs while settings.particleRain is off) …
    const cur = this.engine.rc.cfg, grid = rcGridOf(p, this.oneGrid());   // (ONE CACHE GRID: the same lattice under every preset, so the light meter's reading is not the setting's)
    if (cur.nx !== grid.nx || cur.ny !== grid.ny || cur.nz !== grid.nz || cur.cascades !== p.cascades) this.engine.rebuildRc({ ...defaultRcConfig, ...grid, cascades: p.cascades, interval0: cur.interval0 });
    this.smoke.params.rbIters = rbItersOf(p, this.oneSolve());   // (ONE SMOKE SOLVE: the same pressure pairs under every preset, so what smoke hides is not the setting's)
    S.fireSmoke = fireSmokeFor(name, this.fireShed(), this.auto, S.fireSmoke);   // (FIRE SMOKE SHED: the floor rung draws an open fire without its smoke, and auto's first rung up from it keeps that — game/fire.ts reads it)
    this.shedRoomy = 0; this.climbed = []; this.roomy = 0; this.sinceClimb = 0; this.failed.clear(); this.failCount.clear(); this.dipping = 0;   // (the climb's rungs and failures were the previous preset's: this one starts from its own rows)
    if (this.motionCalm) this.applyMotionCalm(true);   // (the opt-in motion-calm rows ride over the preset's own while the switch is on)
    this.lastChange = `preset ${name}`; this.cooldown = 3; this.slow = this.fast = 0;
    if (this.auto) { try { localStorage.setItem(LS_AUTO, name); } catch { /* */ } }
  }

  /** Boot calibration tick — call every presented frame (the start card renders the live scene behind it, which is the load that matters) until
   *  `calibrating` goes false. Uses GPU compute-pass timings when timestamp queries exist (vsync cannot hide headroom from those), else frame times. */
  calibrateTick(rawDt: number) {
    if (!this.calibrating || pageHidden() || rawDt >= 0.5) return;
    const c = this.calib; c.frames++;
    if (c.frames <= 24) return;                                   // pipelines warm up, first smoke/rc allocations, shader compiles
    c.t += rawDt; c.dts.push(rawDt);
    const tm = this.engine.timer;
    if (tm.enabled && tm.results.size) {
      let fixed = 0; for (const [k, v] of tm.results) if (/^rc |^probe$|^smoke$|^taau$|^volFroxel$|^sharpU$|^compS$|^gbaa$|^mesh$|^air$/.test(k)) fixed += v;   // per-probe / per-voxel / per-froxel / per-character work: does not shrink with resolution (nor does the TAAU resolve: it runs at the OUTPUT size, which the render scale leaves alone — and neither do sharp direct's two output-size kernels; 'mesh' = the mesh shadows' skin + refit)
      c.gpu.push(tm.total(RENDER_PASSES)); c.fixed.push(fixed);
    }
    if (c.dts.length >= 54 || c.t > 3) this.decide();
  }
  /** The pure decision (module-level `plan`), kept on the instance for the console: `__quality.plan(58, 9, 'high', 1, 900, 2)`. */
  plan(gpuMs: number, fixedMs: number, cur: QualityName, effNow: number, cssH: number, dpr: number, budgetMs = PLAN_BUDGET_MS): Plan { return plan(gpuMs, fixedMs, cur, effNow, cssH, dpr, budgetMs, this.engine.settings.taau !== false, this.oneGrid(), this.smokeKeep()); }
  private decide() {
    const c = this.calib; c.done = true;
    const med = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
    const S = this.engine.settings; const canvas = this.engine.gpu.canvas as HTMLCanvasElement; const dpr = window.devicePixelRatio || 1;
    let gpuMs = med(c.gpu), fixedMs = med(c.fixed); const dtMed = med(c.dts); const fps = 1 / dtMed;
    let source = 'gpu timers';
    if (!(gpuMs > 0)) {                                             // no timestamp queries: frame time is all we have — above ~50 fps it hides the headroom, so only act when slow
      if (fps > 50) { this.lastChange = `calibrated: ${fps.toFixed(0)} fps at ${this.current}, no GPU timers — leaving it to the runtime ladder`; this.onCalibrated?.(); return; }
      gpuMs = Math.max(4, 1000 * dtMed - 4); fixedMs = gpuMs * 0.3; source = 'frame time';
    }
    const B = this.bands;   // (an aim plans with the same measure against ITS budget — hold 60's is the 15 ms of today; the display's rate is rarely known this early, so 120 plans as 120 and the climb gives back what a slower display leaves)
    const r = this.plan(gpuMs, fixedMs, this.current, this.engine.effectiveScale || (this.engine.capScale || 1) * S.renderScale, canvas.clientHeight || 800, dpr, B.planBudget);   // (effectiveScale = the true internal / CSS×dpr ratio the sample was rendered at; before the first resize, what the formula will give)
    const from = `${this.current} ×${S.renderScale.toFixed(2)}`;
    if (r.preset !== this.current) this.apply(r.preset);
    S.renderScale = Math.min(this.maxScale, r.scale); this.cooldown = 2.5; this.slow = this.fast = this.starved = this.cruising = 0;
    this.lastChange = `calibrated (${source}): ${gpuMs.toFixed(1)} ms compute at ${from} → ${r.preset} ×${S.renderScale.toFixed(2)} (predicted ${r.predicted.toFixed(1)} ms; ${r.note})${B.hold ? ` — holding ${B.target.toFixed(0)} fps: ${B.planBudget.toFixed(1)} ms of GPU` : ''}`;
    try { localStorage.setItem(LS_AUTO, r.preset); localStorage.setItem(LS_SCALE, String(S.renderScale)); } catch { /* */ }
    this.onCalibrated?.();
  }

  /** Feed real frame times (only for frames actually presented at display rate). `gpuUnionMs` = the union of the last resolved frame's compute-pass GPU intervals (main.ts hands
   *  engine.timer.unionMs; omitted / 0 without timestamp queries — the climb then never sees headroom and never acts). */
  sample(dt: number, gpuUnionMs = 0) {
    if (!this.adaptive && this.climbed.length) this.unclimbAll('adaptive off');   // (nothing below runs to undo them otherwise: the settings would keep the climbed values)
    if (!this.adaptive && !this.auto) return;
    if (this.calibrating) return;                                   // the boot calibration decides first
    this.acc += dt; this.frames++; this.cooldown -= dt; this.clock += dt; this.sinceClimb += dt; if (dt > this.maxDt) this.maxDt = dt;
    if (Number.isNaN(gpuUnionMs)) this.unsureAcc = true; else if (gpuUnionMs > 0) { this.unionAcc += gpuUnionMs; this.unionN++; }   // (NaN = timings exist but no readback resolved lately: no verdict this window — neither 'roomy' nor 'cruising' advances on a frozen or absent number)
    if (this.acc < 1.0) return;
    const B = this.bands;   // the aim's bands (AS_NOW's literals at settings.ladderAim 0)
    const avgT = this.frames > 1 ? (this.acc - this.maxDt) / (this.frames - 1) : this.acc / this.frames;   // the window without its one longest frame
    const avg = B.hold ? avgT : this.acc / this.frames; this.acc = 0; this.frames = 0; this.maxDt = 0;   // (an aim judges the window without its one longest frame: a hitch a second is not a frame rate — it cuts under 3.5 %, where as-now's 45 has 25 % to absorb one)
    const unionAvg = this.unionN ? this.unionAcc / this.unionN : 0; const unsureRaw = this.unsureAcc && !this.unionN; this.unionAcc = 0; this.unionN = 0; this.unsureAcc = false;
    this.unsureRun = unsureRaw ? this.unsureRun + 1 : 0; const unsure = unsureRaw && this.unsureRun < 10;   // (ten windows running without a fresh readback = the timer has stalled for good this session: from there the window counts as BLIND — the rate-only rules — rather than 'no verdict' for ever)
    this.lastUnion = +unionAvg.toFixed(2); this.lastFps = +(1 / avg).toFixed(1);
    for (const [k, t] of this.failed) { if (t <= this.clock) this.failed.delete(k); }
    const S = this.engine.settings;
    const climbOn = this.adaptive && !!S.ladderClimb && this.climbAllowed;
    if (!climbOn && this.climbed.length) this.unclimbAll('climb switched off');
    if (this.shed && !this.shedOn()) this.unshed('the switch is off');
    if (this.shed && S.sharpDirect) { this.shed = false; this.shedMark = null; this.shedRoomy = 0; }   // (put back on by hand, the Tab row: a by-hand row stands until the next preset, and the ladder holds no shed against it)
    // the climb's frame-rate back-off counts consecutive windows under CLIMB.backoffFps (a single hitch is not a verdict); kept outside the cooldown gate so a step's own cooldown cannot hide a dip
    if (avg > 1 / B.backoffFps) this.dipping++; else this.dipping = 0;
    if (this.cooldown > 0) return;
    // the render scale is relative to the window's cap (engine.ts resize), so every step of it is a real change of pixel count and the ladder reasons on it directly —
    // no 'effective vs nominal' bookkeeping, no dead rungs under a HiDPI cap (the 08-10 field dumps: 63 cuts announced, none taken). With the CLIMB standing the scale may sit ABOVE the
    // tier's start (maxScale): the ceiling the plain ladder restores toward is then wherever the climb has put it.
    const top = climbOn ? Math.max(this.maxScale, S.renderScale) : this.maxScale;
    const sc = Math.min(top, S.renderScale);
    // the cruising rule's room test (auto ↑ a preset): with GPU timings, the union priced at the NEXT preset by the cost model (hopRatio) must fit hopFits of the plan budget, and a hop that
    // failed lately is held off; without timings the rate alone decides. Under auto the CLIMB defers to it — presets first — except at the top of auto's ladder, or when the next preset will
    // not fit (or is held off) but a scale step still might (a medium machine 9.5 ms busy at 60 fps: high would cost ~14, no; 0.5 ms of pixels, yes)
    const timed = unionAvg > 0;
    // SHARP SHED, what this machine pays for sharp direct: the first judged window after it moved, nothing else moved since. OFF a shed: what the union gave back — the largest standing is
    // kept, for twice the hold-off only (a spike that ended inside that window reads as sharp direct's price, and a reading nothing could test again would keep it off for the spell). On
    // the way BACK: what the union took on, read in a calm scene — it replaces whatever stood, for SHED.backSecs
    if (this.shedMark) { const m = this.shedMark; this.shedMark = null; const ms = m.back ? unionAvg - m.union : m.union - unionAvg;
      if (timed && m.preset === this.current && Math.abs(m.scale - S.renderScale) < 1e-3 && (m.back ? !this.shed && ms > 0 : this.shed && ms > this.shedSeenMs())) this.shedSeen = { ms, rows: this.outRows(), until: this.clock + (m.back ? SHED.backSecs : 2 * Math.max(0, this.shedHold.until - this.clock)) }; }
    const ai = AUTO_LADDER.indexOf(this.current as QualityName); const nextUp = ai >= 0 && ai < AUTO_LADDER.length - 1 ? AUTO_LADDER[ai + 1] : null;
    const hopHeld = !!nextUp && (this.hopHold.get(`${this.current}>${nextUp}`)?.until ?? -1) > this.clock;
    const roomForNext = !!nextUp && !hopHeld && (!timed || unionAvg * this.hopRatio(nextUp) < LADDER.hopFits * B.planBudget);
    const autoWantsPreset = this.auto && !!nextUp && roomForNext;
    // THE PACED CHECK (PACED; as now, and an aim under ladderHeld): is this slow window a page something else paces? 2 = it moved the ladder itself
    const pacedNow = this.pacedStep(B, avg, avgT, unionAvg, sc, top); if (pacedNow === 2) return;
    const gpuBound = !pacedNow && (unionAvg <= 0 || (B.hold ? this.holdBound(avg, unionAvg, B) : unionAvg > B.gpuFloor));   // (union unknown this window: assume it is; known and well under the budget: the rate is capped by pacing, not by pixels; a page the paced check has as paced: neither cut nor starved of its preset)
    // SHARP SHED, the way back (SHED): the tier at its own scale, the rate at the aim (or the page paced), no preset hop waiting, the hold-off over, and the union priced with sharp direct on
    // still under the restore band (a page the paced check has as paced: the frame's own room, as a step given back there) — counted here, given back in auto's block below
    const pacedPage = timed && !gpuBound && avg > 1 / B.cutFps;   // (slow with the GPU inside its budget and the frame far over its union: something else paces this page — it will never show the target, and the union alone says whether the pixels fit)
    const fitsBack = (priced: number) => pacedNow ? priced * (1 + PACED.gain) + HOLD.pacedMs < avg * 1000 : priced < HOLD.restore * CLIMB.backoff * B.budget;   // (a page the paced check has as paced, ladderHeld: the frame's own room — what comes back leaves it more than its GPU work, as the pace needs; the band is for a GPU on its own clock)
    let sharpFits = false; const sp = this.shed ? this.sharpPrice(unionAvg) : null;
    if (sp) {   // (priced on the tier's OWN picture: rungs the climb took meanwhile come off for it, auto's block below — the tier's own row before the extras; a hop that cannot be taken at this rate does not hold it off)
      sharpFits = this.clock >= this.shedHold.until && sc >= this.maxScale - 1e-3 && !(autoWantsPreset && avg < 1 / B.cruisingFps) && (avg < 1 / B.cruisingFps || pacedPage) && (!timed || fitsBack(sp.bare + sp.add));
      if (!unsure) this.shedRoomy = sharpFits ? this.shedRoomy + 1 : 0;
    }
    if (this.adaptive) {
      if (avg > 1 / B.cutFps) { this.slow++; this.fast = 0; } else if (avg < 1 / B.restoreFps) { this.fast++; this.slow = 0; } else { this.slow = 0; this.fast = 0; }
      if (avg > 1 / B.cutFps && this.lastHop && this.hopSlowAt < 0) this.hopSlowAt = this.clock;   // (the first slow window since the last hop up: hopFailSecs counts from here)   // under 45 fps for two windows: cut; over 58 for four: give pixels back (was 29 / 45: 'anything over 29 is fine' — retuned 08-10 toward a 50–60 hold)
      // THE CLIMB's back-off first, before the plain cut below has to. The frame RATE under its band for two windows running: a dip that began within a climb gap of the LAST CLIMB (a
      // stamp no undo touches) is that rung's doing — undo it alone, once, whatever the union says; a dip out of nowhere or one that outlives that single undo (the QRF minute) is a LOAD
      // SPIKE — every rung off at once (only the newest held off: the load, not the rungs, was the cause) and the plain cut follows a cooldown later only if the rate is
      // still under its band (`starved` waits those windows too). The GPU alone over the back-off band with the rate holding: the newest rung off (and held off).
      const budget = B.budget;
      if (climbOn && this.climbed.length && this.dipping >= 2) {
        const fresh = this.clock - this.lastClimbAt < CLIMB.climbGap + 2;
        if (fresh && !this.undidForDip) { this.unclimb(`${(1 / avg).toFixed(0)} fps${unionAvg > CLIMB.backoff * budget ? `, gpu ${unionAvg.toFixed(1)} ms` : ''}`); this.undidForDip = true; }   // (whatever the union says: an overshoot right after a rung crosses both bands at once on a GPU-bound machine; if the dip outlives this one undo, everything comes off two windows on)
        else {
          const want = B.hold ? (timed ? this.holdWant(sc, avg, unionAvg, B) : sc * Math.sqrt((1 / B.aimFps) / avg)) : 0, bound = B.hold && !pacedNow && (!timed || this.holdBound(avg, unionAvg, B));   // (priced before the rungs come off: at the climbed scale the windows were measured at; a paced page keeps its tier's start)
          this.unclimbAll(`${(1 / avg).toFixed(0)} fps${unionAvg > CLIMB.backoff * budget ? `, gpu ${unionAvg.toFixed(1)} ms` : ''}`, true); this.cooldown = LADDER.stepCooldown;
          // AN AIM does not wait a cooldown and two more windows for the plain cut: where the rungs alone do not bring the rate back (the model's scale for the aim sits under the tier's start), the cut is taken with them
          if (bound) { const from = Math.min(this.maxScale, S.renderScale); const to = +Math.max(SCALE_FLOOR, Math.max(snapDown(sc - 0.3 + 1e-6), snapDown(want))).toFixed(2); if (to < from - 1e-3) {
            if (this.canShed()) this.lastChange += ` · ${this.shedSharp(B, from, avg, avgT, unionAvg, true, false)}`;   // (SHARP SHED: before anything of the tier's own picture; no measure of it here — the rungs' cost came off the union in the same window)
            else { S.renderScale = to; this.pacedCut(B, from, avgT, unionAvg); this.holdLeft(from, true); this.lastChange += ` · hold ${B.target.toFixed(0)} ↓ scale ${to.toFixed(2)}`; } } }
        }
        this.dipping = 0; this.slow = 0; return;
      }
      if (climbOn && unsureRaw && avg >= 1 / B.cruisingFps) this.roomy = 0;   // (no union this window, but the rate alone says not roomy)
      if (climbOn && this.climbed.length && unionAvg > CLIMB.backoff * budget) { this.unclimb(`gpu ${unionAvg.toFixed(1)} ms`); this.undidForDip = true; this.slow = 0; return; }   // (counts as this dip's one single undo, should the rate follow the union down)
      if (B.hold) this.hot = !pacedNow && !this.climbed.length && unionAvg > CLIMB.backoff * budget ? this.hot + 1 : 0;   // (an aim, nothing climbed: the union over the back-off band is counted — two windows of it take a step off below; never on a page the paced check has as paced)
      if (B.hold) {   // frames slow with the GPU inside its budget, window after window: that is the rate this page shows (a slower display than was seen, a throttled tab) — the aim comes down to it
        this.paced = timed && !gpuBound && avg > 1 / B.cutFps ? this.paced + 1 : 0;
        if (this.paced >= HOLD.pacedWindows && !this.displayHzPin) { const seen = Math.max(CLIMB.budgetFps, snapRate(1 / avg)); this.paced = 0; if (seen < B.target) { this.displayHz = seen; this.slow = 0; this.lastChange = `hold ${B.target.toFixed(0)}: ${(1 / avg).toFixed(0)} fps with the GPU at ${unionAvg.toFixed(1)} ms of ${B.planBudget.toFixed(1)} — this page shows no more: holding ${seen} until its frames come faster`; return; } }
      }
      // AN AIM, ladderHeld: slow, the frame far over a union the aim's own rules let be (inside the budget AND the back-off band: over the band the step below is taken first, as ever,
      // and judged), no pace known — a held page AND a display missing its vsync. A cut to where the union fits the proof's floor tells them apart (pacedStep judges it there); not while
      // a take-back is held off (a cut right after one said that take-back was wrong), nor sooner after a judged one than the re-test would come (`probeUntil`: a rate that wobbles)
      if (B.hold && this.slow >= 2 && !gpuBound && !pacedNow && timed && this.pacedOn(B) && !this.climbed.length && unionAvg <= CLIMB.backoff * budget && this.clock >= this.pacedBack.until && this.clock >= this.probeUntil) {
        if (this.canShed()) { this.lastChange = `${this.shedSharp(B, sc, avg, avgT, unionAvg)} (a held page or a missed vsync: the paced check tells which)`; return; }   // (SHARP SHED: before that cut too — a missed vsync bought back keeps every pixel; a held page gives it back with the verdict, pacedStep)
        const to = sc > SCALE_FLOOR + 0.01 ? this.probeScale(sc, unionAvg, B) : 0;
        if (to > 0) {
          this.pacedCut(B, sc, avgT, unionAvg, this.current as QualityName, true); S.renderScale = to; this.holdLeft(sc, false); this.slow = 0; this.hot = 0; this.cooldown = LADDER.stepCooldown;
          this.lastChange = `hold ${B.target.toFixed(0)} ↓ scale ${to.toFixed(2)} (${(1 / avg).toFixed(0)} fps with the GPU at ${unionAvg.toFixed(1)} ms: a held page or a missed vsync — a cut to where the union fits tells which)`; return;
        }
      }
      if (this.slow >= 2 && !gpuBound) { this.slow = 0; this.lastChange = `${(1 / avg).toFixed(0)} fps but the GPU takes ${unionAvg.toFixed(1)} ms — frame pacing (display / browser / power), not load: resolution left at ×${sc.toFixed(2)}`; }
      if (this.slow >= 2 && this.canShed()) this.lastChange = this.shedSharp(B, sc, avg, avgT, unionAvg);   // SHARP SHED: where the cut below would have been taken (the GPU is the limit: the line above), sharp direct goes first and the picture keeps its size
      else if (this.slow >= 2 && sc > SCALE_FLOOR + 0.01) {   // proportional step: pixels ∝ scale², so aim straight at the scale that would give ~AIM fps — at least one grid step, at most 0.2 down, snapped down onto the grid, never under the floor
        const want = B.hold && unionAvg > 0 ? this.holdWant(sc, avg, unionAvg, B) : sc * Math.sqrt((1 / B.aimFps) / avg);
        S.renderScale = B.hold ? +Math.max(SCALE_FLOOR, Math.min(snapDown(sc - 1e-3), Math.max(snapDown(sc - 0.2 + 1e-6), snapDown(want)))).toFixed(2)   // (an aim's cuts land ON the grid: the clamps too — the sizes the pool and the way back up already know)
          : +Math.max(SCALE_FLOOR, Math.min(sc - SCALE_STEP, Math.max(sc - 0.2, snapDown(want)))).toFixed(2);
        this.slow = 0; this.cooldown = LADDER.stepCooldown; this.lastChange = `adaptive ↓ scale ${S.renderScale.toFixed(2)} (${(1 / avg).toFixed(0)} fps)`;
        this.pacedCut(B, sc, avgT, unionAvg);
        if (B.hold) { this.holdLeft(sc, true); this.lastChange = `hold ${B.target.toFixed(0)} ↓ scale ${S.renderScale.toFixed(2)} (${(1 / avg).toFixed(0)} fps${unionAvg > 0 ? `, gpu ∪ ${unionAvg.toFixed(1)} ms` : ''})`; }
      }
      else if (this.fast >= 4 && sc < this.maxScale - 1e-3) { S.renderScale = +Math.min(this.maxScale, snapDown(sc) + SCALE_STEP).toFixed(2); this.fast = 0; this.cooldown = LADDER.stepCooldown; this.lastChange = `adaptive ↑ scale ${S.renderScale.toFixed(2)}`; }
      // AN AIM, nothing climbed, the union over the back-off band two windows running: one grid step off before the frame rate has to say so
      else if (B.hold && this.hot >= HOLD.hotWindows && !this.climbed.length && this.canShed()) this.lastChange = this.shedSharp(B, sc, avg, avgT, unionAvg, avg > 1 / B.cutFps);   // (SHARP SHED: … and sharp direct before that step too — judged where that step is, with the rate under the aim)
      else if (B.hold && this.hot >= HOLD.hotWindows && !this.climbed.length && sc > SCALE_FLOOR + 0.01) {
        S.renderScale = +Math.max(SCALE_FLOOR, Math.min(sc - 0.01, snapDown(sc - 1e-3))).toFixed(2); this.holdLeft(sc, false);
        if (avg > 1 / B.cutFps) this.pacedCut(B, sc, avgT, unionAvg);   // (a step for the band while the rate is under the aim: judged, ladderHeld — a held page's clocked-down GPU reads over the band and the step buys nothing)
        this.hot = 0; this.slow = 0; this.cooldown = LADDER.stepCooldown; this.lastChange = `hold ${B.target.toFixed(0)} ↓ scale ${S.renderScale.toFixed(2)} (gpu ∪ ${unionAvg.toFixed(1)} ms, over its ${(CLIMB.backoff * budget).toFixed(1)} band; ${(1 / avg).toFixed(0)} fps)`;
      }
      // AN AIM, the scale under the tier's start: pixels come back on measured room — the rate at the target (or the page PACED by something else: a browser holding it to 30 fps never shows
      // the target, and a cut from a fight would otherwise stay for the session) AND the union, PRICED AT THE NEXT STEP UP by the cost model, still HOLD.restore of
      // the way to the band that would take the step off again (so a step given back is not a step taken off a second later; the climb past the tier's start keeps its own, stricter headroom
      // band) — HOLD.restoreWindows windows running (twice the climb's: a lull inside a fight is not the fight over), a climb gap since the last step either way (without timings: the rate alone, HOLD.blindWindows of them); one grid step, never onto a level that
      // cost frames lately
      else if (B.hold && sc < this.maxScale - 1e-3) {
        const to = +Math.min(this.maxScale, snapDown(sc + 1e-6) + SCALE_STEP).toFixed(2);
        const room = fitsBack(unionAvg * (1 + this.pixelShare() * ((to / sc) ** 2 - 1)));
        if (!unsure) this.roomy = (avg < 1 / B.cruisingFps || pacedPage) && (!timed || room) && this.lastCut?.probeFrom === undefined ? this.roomy + 1 : 0;   // (never while a judged cut waits for its verdict: a step up under it would be cut again and keep the trial open)
        if (this.roomy >= (timed ? HOLD.restoreWindows : HOLD.blindWindows) && this.sinceClimb >= CLIMB.climbGap && !this.failed.has(`scale:${to.toFixed(2)}`)) {
          S.renderScale = to; this.roomy = 0; this.sinceClimb = 0; this.cooldown = LADDER.stepCooldown;
          if (pacedNow) this.upTrial = { from: sc, avg: avgT };   // (a step given back at the pace is judged on its first window, pacedStep: the frame grew → it comes off)
          this.lastChange = `hold ${B.target.toFixed(0)} ↑ scale ${to.toFixed(2)} (${timed ? pacedNow ? `${(1 / avg).toFixed(0)} fps with the GPU at ${unionAvg.toFixed(1)} ms: frame pacing, not load — the frame has the room` : `gpu ∪ ${unionAvg.toFixed(1)} ms, room under its ${(CLIMB.backoff * budget).toFixed(1)} band` : `${(1 / avg).toFixed(0)} fps`})`;
        }
      }
      // THE CLIMB itself: display rate held AND the GPU under the headroom band for CLIMB.windows windows running, the last climb long enough ago → one rung up (scale → its top, then the
      // divisors, then — capClimb — the output cap), skipping rungs that failed lately
      else if (climbOn && unionAvg > 0 && !autoWantsPreset && !sharpFits) {   // (SHARP SHED: room that fits sharp direct back is its room first, auto's block below)   // (under auto a cheaper preset with room for the next goes UP A PRESET first — the cruising rule below; the climb spends what is left at the top of auto's ladder, under a preset the next will not fit over, or on a preset pinned from a menu)
        const roomyNow = avg < 1 / B.cruisingFps && unionAvg < CLIMB.headroom * budget;   // (the rate gate sits UNDER any display's refresh — a 60 Hz panel's rAF never averages better than 60.0 — and the headroom itself is read off the GPU union, never off the rate)
        this.roomy = roomyNow ? this.roomy + 1 : 0;   // (never reached in an unsure window: unionAvg is 0 then and this branch is skipped — the count simply waits)
        if (this.roomy >= CLIMB.windows && this.sinceClimb >= CLIMB.climbGap && sc >= this.maxScale - 1e-3) { const step = this.nextRung(S.renderScale, unionAvg < CLIMB.divisorRoom * budget); if (step) { this.climb(step, unionAvg, B); this.roomy = 0; } }
      }
      if (this.auto) { try { localStorage.setItem(LS_SCALE, String(Math.min(this.maxScale, S.renderScale))); } catch { /* */ } }   // (a climbed scale is this session's finding, re-earned next visit: what is remembered stays within the tier's own range)
    }
    if (this.auto) {
      // the preset moves only when resolution scaling has run out of road: still slow with the scale already well down → a cheaper preset (a standing climb never delays this: its rungs
      // are all off by the time `starved` can count, see the back-off above); comfortably fast at the preset's full scale for a while → the next one up — unless the climb is what is
      // spending that room at the top of the ladder. Long windows + cooldowns so it settles.
      const i = AUTO_LADDER.indexOf(this.current as QualityName);
      const atFloor = sc <= SCALE_FLOOR + 0.02;                               // adaptive will not step from here
      const cutDeep = sc <= this.maxScale - 0.14;                             // a real cut has already been taken off — a cheaper preset (fewer rays, a slower cache refresh) buys more than pixels now
      const floorHit = !this.adaptive || atFloor || cutDeep;
      if (avg > 1 / B.starvedFps && floorHit && gpuBound) this.starved++; else this.starved = 0;   // (a paced page with an idle GPU never starves its preset away either)
      // cruising: the display's rate held (a threshold UNDER any refresh, so a 60 Hz panel can reach it) with the scaler holding nothing back, AND — with GPU timings — the union priced at
      // the next preset fitting the plan budget (roomForNext above); without timings the rate alone, for twice the windows; a window without a fresh timer verdict leaves the count alone
      const rateOk = avg < 1 / B.cruisingFps && sc >= this.maxScale - 1e-3 && !!nextUp && !hopHeld;   // (everything but the union is known in an unsure window: a bad rate resets the count regardless; only the union's verdict is withheld)
      if (rateOk && !unsure && roomForNext) this.cruising++; else if (!rateOk || !unsure) this.cruising = 0;   // (rungs standing do not block it: the room is priced at the climbed cost, and apply() puts the next preset's own rows in their place)
      if (this.shed && sp && this.shedRoomy >= (timed ? HOLD.restoreWindows : HOLD.blindWindows) && this.sinceClimb >= CLIMB.climbGap) {   // SHARP SHED, the way back
        const rungs = this.climbed.length; if (rungs) this.unclimbAll('room for sharp direct');
        this.unshed(timed ? `gpu ∪ ${unionAvg.toFixed(1)} ms, ~${(sp.bare + sp.add).toFixed(1)} with it${rungs ? ` and the climb's ${rungs === 1 ? 'rung' : `${rungs} rungs`} off` : ''}, room under the ${(CLIMB.backoff * B.budget).toFixed(1)} band` : `${(1 / avg).toFixed(0)} fps`, timed ? sp.bare : 0);
      }
      else if (this.starved >= 2 && this.canShed()) this.lastChange = this.shedSharp(B, sc, avg, avgT, unionAvg);   // (… and before a preset is given up: adaptive resolution off, or the scale already at its floor by hand)
      else if (this.starved >= 2 && i > 0) {   // keep the scale adaptive had reached: relative to a LOWER cap now, so the cheaper preset starts with fewer pixels than it left, never more
        const from = this.current, keep = S.renderScale, chain = this.lastCut; this.apply(AUTO_LADDER[i - 1]); S.renderScale = Math.min(keep, S.renderScale); this.cooldown = 4; this.starved = 0;
        this.lastCut = chain; this.pacedCut(B, sc, avgT, unionAvg, from);   // (a preset given up is judged with the cuts before it, PACED)
        let held = '';
        if (this.lastHop && this.lastHop.to === from && this.lastHop.from === this.current && this.clock - (this.hopSlowAt >= 0 ? this.hopSlowAt : this.lastHop.at) < LADDER.hopFailSecs) {   // (counted from the first SLOW window after the hop: the way down — cooldown, cuts, starving — takes 14 s and more by itself)   // straight back down from a hop up: that hop is held off, doubling per repeat (kept across apply(): it is about the pair of presets, not the rungs)
          const key = `${this.current}>${from}`; const n = (this.hopHold.get(key)?.n ?? 0) + 1; const secs = LADDER.hopHoldSecs * Math.min(16, 2 ** (n - 1)); this.hopHold.set(key, { until: this.clock + secs, n }); held = ` — ${from} held off ${secs} s`;
        }
        this.lastChange = `auto ↓ ${this.current} (${(1 / avg).toFixed(0)} fps)${held}`;
      }
      else if (this.cruising >= (timed ? LADDER.cruiseWindows : LADDER.cruiseWindowsBlind) && i >= 0 && i < AUTO_LADDER.length - 1) { const from = this.current; const predicted = timed ? unionAvg * this.hopRatio(AUTO_LADDER[i + 1]) : 0; this.apply(AUTO_LADDER[i + 1]); this.lastHop = { from, to: this.current, at: this.clock }; this.hopSlowAt = -1; this.lastChange = `auto ↑ ${this.current} (${(1 / avg).toFixed(0)} fps${timed ? `, gpu ∪ ${unionAvg.toFixed(1)} ms → ~${predicted.toFixed(1)} predicted` : ''})`; this.cooldown = 4; this.cruising = 0; }
    }
  }

  // ---- SHARP SHED (SHED): can → shed → price → back ----
  /** the rule stands: auto, and settings.ladderShed (a stub engine without the row = off, the ladder as it was) */
  private shedOn(): boolean { return this.auto && !!this.engine.settings.ladderShed; }
  /** sharp direct is the ladder's to let go right now: the rule stands, nothing forces the tier's resolve rows, the tier places it and it is drawing (on, under TAAU, below scale 1) */
  private canShed(): boolean { const S = this.engine.settings; return this.shedOn() && !this.shed && sharpForce.v === null && !iqForce.off && !!PRESETS[this.current as QualityName]?.iq.sharp && !!S.sharpDirect && S.taau !== false && S.renderScale < 1; }
  /** sharp direct and its two riders as the ladder writes them (a preset put on, a shed, the way back) */
  private putSharp(iq: IqTier, on: boolean) { const S = this.engine.settings; S.sharpDirect = on; S.sharpDecouple = on && iq.decouple; S.gbaa = gbaaForce.on || (on && iq.gbaa); }
  /** this window: its CSS size and device pixel ratio (720p at 1× where there is no canvas) */
  private win() { const cv = this.engine.gpu?.canvas as HTMLCanvasElement | undefined; return { cssH: cv?.clientHeight || 720, cssW: cv?.clientWidth || 1280, dpr: (typeof window !== 'undefined' && window.devicePixelRatio) || 1 }; }
  /** the cost model's ms for preset rows `p` as they would run on this window */
  private costAt(p: Preset): number { const { cssH, cssW, dpr } = this.win(), rows = Math.min(p.maxH, cssH * dpr) * p.scale, c = presetCost(p, this.oneGrid()); return c.fixed + c.pixel * (rows * rows * (cssW / cssH) / 1e6) / REF.mpx; }
  /** the output rows of this window under cap `maxH` (the live one: what sharp direct's kernels run at) */
  private outRows(maxH: number = this.engine.settings.maxInternalHeight): number { const { cssH, dpr } = this.win(); return Math.min(maxH || Infinity, cssH * dpr); }
  /** what this machine's union showed sharp direct costs, at `rows` output rows (0 = never measured, or measured too long ago to stand: `until`) */
  private shedSeenMs(rows: number = this.outRows()): number { const s = this.shedSeen; return s && this.clock < s.until ? s.ms * (rows / s.rows) ** 2 : 0; }
  /** the live rows with every rung the climb holds taken off again: the tier's own picture as it would stand now */
  private ownPreset(live: Preset): Preset {
    return this.climbed.reduceRight<Preset>((p, s) => s.kind === 'scale' ? { ...p, scale: Math.min(p.scale, Math.max(this.maxScale, s.from)) } : s.kind === 'gather' ? { ...p, lossy: { ...p.lossy, gatherThird: true } } : s.kind === 'vol' ? { ...p, lossy: { ...p.lossy, volQuarter: true } } : { ...p, maxH: Math.min(p.maxH, s.from) }, live);
  }
  /** let sharp direct go where a cut from `from` would have been taken; `judge` = the paced check judges it as it would that cut (a shed that bought no frame rate goes back with the
   *  chain's pixels, pacedStep); `mark` = this window's union is the 'before' of its measure. Returns the move's words */
  private shedSharp(B: Bands, from: number, avg: number, avgT: number, unionAvg: number, judge = true, mark = true): string {
    const S = this.engine.settings, H = this.shedHold; this.putSharp(PRESETS[this.current as QualityName].iq, false); this.shed = true; this.shedRoomy = 0;
    if (judge) { this.pacedCut(B, from, avgT, unionAvg); if (this.lastCut) this.lastCut.shed = true; }
    H.n = this.clock - H.backAt < 2 * SHED.holdSecs * Math.min(16, 2 ** Math.max(0, H.n - 1)) ? H.n + 1 : 1; H.until = this.clock + SHED.holdSecs * Math.min(16, 2 ** (H.n - 1));
    this.shedMark = mark && unionAvg > 0 ? { union: unionAvg, scale: S.renderScale, preset: this.current as QualityName } : null;
    this.slow = 0; this.hot = 0; this.starved = 0; this.roomy = 0; this.sinceClimb = 0; this.cooldown = LADDER.stepCooldown;
    return `shed ↓ sharp direct off (${(1 / avg).toFixed(0)} fps${unionAvg > 0 ? `, gpu ∪ ${unionAvg.toFixed(1)} ms` : ''}): the picture keeps its size — not back for ${Math.round(H.until - this.clock)} s`;
  }
  /** sharp direct back, priced off this window's union: `bare` = the union on the tier's own picture without it (the live union less what the climb's standing rungs cost, by the cost
   *  model's ratio), `add` = what it adds there, ms: the model's share, or what this machine showed if more (never over SHED.seenCap × the model) */
  private sharpPrice(unionAvg: number): { bare: number; add: number } {
    const cur = this.current as QualityName; if (!(cur in COST) || !(unionAvg > 0)) return { bare: unionAvg, add: 0 };
    const live = this.livePreset(cur), own = this.ownPreset(live), cost = (p: Preset, sharp: boolean) => Math.max(0.1, this.costAt({ ...p, iq: { ...p.iq, sharp } }));
    const bare = unionAvg * cost(own, false) / cost(live, false), model = bare * (cost(own, true) / cost(own, false) - 1);
    return { bare, add: Math.max(model, Math.min(this.shedSeenMs(this.outRows(own.maxH)), SHED.seenCap * model)) };
  }
  /** sharp direct back as the tier places it; `wrong` = the shed bought no frame rate (the paced check took it back): it does not count toward the next one's hold-off */
  private sharpBack(wrong = false) {
    const iq = iqForce.off ? IQ_OFF : PRESETS[this.current as QualityName].iq, H = this.shedHold; this.shed = false; this.shedRoomy = 0; this.shedMark = null; this.putSharp(iq, sharpForce.v ?? iq.sharp);
    if (wrong) H.n = Math.max(0, H.n - 1); else H.backAt = this.clock;
  }
  /** the way back as a move of the ladder's own (room for it again, the switch put off) */
  private unshed(why: string, bare = 0) {   // (`bare` = the union priced without it on the picture it comes back to: the 'before' of the measure of what it adds)
    this.sharpBack(); this.roomy = 0; this.sinceClimb = 0; this.cooldown = LADDER.stepCooldown; this.lastChange = `shed ↑ sharp direct back (${why})`;
    if (bare > 0 && this.engine.settings.sharpDirect) this.shedMark = { union: bare, scale: this.engine.settings.renderScale, preset: this.current as QualityName, back: true };
  }
  /** what the shed holds, for the Tab panel / QA (`__quality.shedState`) */
  get shedState() { return { on: this.shedOn(), shed: this.shed, backIn: this.shed ? Math.max(0, Math.round(this.shedHold.until - this.clock)) : 0, sheds: this.shedHold.n, seenMs: +this.shedSeenMs().toFixed(2), roomy: this.shedRoomy }; }

  // ---- the climb's rungs (CLIMB): next → take → undo ----
  /** the scale the climb may reach: 1.0 — except while sharp direct rides under TAAU, where the LAST GRID VALUE BELOW 1.0 is the top: at 1.0 the internal size equals the output size and engine.resize
   *  has nothing to decouple, so sharp direct, its decoupled jitter and GBAA all switch off — the '1.0 + TAA' picture docs/internal/image-quality.md measured worse on every column than 0.9 + C3j
   *  (why ultra starts at 0.9); the divisor rungs come after 0.95 instead */
  private scaleTop(): number { const S = this.engine.settings; return (S.sharpDirect || this.shed) && S.taau !== false ? +(1.0 - SCALE_STEP).toFixed(2) : 1.0; }   // (SHARP SHED: shed is not gone — the size it comes back at is kept)
  /** the next rung from here, in the fixed order (scale by SCALE_STEP up to scaleTop() → the gather's divisor 3 → 2 → the volumetrics' 4 → 2 → the output cap by CLIMB.capStep toward the window's device
   *  rows), passing over rungs that failed lately; `divisorsToo` = the union leaves CLIMB.divisorRoom (the divisor / cap rungs cost more than a scale step); null = nothing left to spend on */
  private nextRung(scale: number, divisorsToo: boolean): ClimbStep | null {
    const S = this.engine.settings; const topScale = this.scaleTop();
    if (scale < topScale - 1e-3) { const to = +Math.min(topScale, snapDown(scale + 1e-6) + SCALE_STEP).toFixed(2); const step: ClimbStep = { kind: 'scale', from: scale, to }; return this.failed.has(rungKey(step)) ? null : step; }   // (a failed scale rung blocks the ones above it too: no leap-frogging a ceiling that just cost frames)
    if (!divisorsToo) return null;
    if (S.gatherThird && !this.failed.has('gather')) return { kind: 'gather' };
    if (S.volQuarter && !this.failed.has('vol')) return { kind: 'vol' };
    if (S.capClimb) {   // (the cap's rungs cost mostly the RENDER passes' per-output-pixel work — the g-buffer raster, composite, post — which the union the trigger reads excludes: the frame-rate back-off is the backstop for them; and each re-makes both target sets, so the ReSTIR reservoirs restart per rung)
      const cv = this.engine.gpu.canvas as HTMLCanvasElement; const rows = Math.floor((cv.clientHeight || 0) * (window.devicePixelRatio || 1));
      if (rows > S.maxInternalHeight + 8) { const to = Math.min(rows, S.maxInternalHeight + CLIMB.capStep); const step: ClimbStep = { kind: 'cap', from: S.maxInternalHeight, to }; if (!this.failed.has(rungKey(step))) return step; }
    }
    return null;
  }
  private climb(step: ClimbStep, unionAvg: number, B: Bands = AS_NOW) {
    const S = this.engine.settings;
    if (step.kind === 'scale') S.renderScale = step.to; else if (step.kind === 'gather') S.gatherThird = false; else if (step.kind === 'vol') S.volQuarter = false; else S.maxInternalHeight = step.to;
    this.climbed.push(step); this.sinceClimb = 0; this.lastClimbAt = this.clock; this.undidForDip = false; this.cooldown = LADDER.stepCooldown; this.fast = 0;
    this.lastChange = `climb ↑ ${step.kind === 'scale' ? `scale ${step.to.toFixed(2)}` : step.kind === 'gather' ? 'gather ½ res' : step.kind === 'vol' ? 'volumetrics ½ res' : `cap ${step.to} rows`} (gpu ∪ ${unionAvg.toFixed(1)} ms of ${B.hold ? `${B.planBudget.toFixed(1)}, holding ${B.target.toFixed(0)} fps` : (1000 / CLIMB.budgetFps).toFixed(1)})`;
  }
  /** an aim's cut, with GPU timings: the scale the cost model says lands the frame on the aim — the frame is the union + an overhead that stays, and only the per-pixel share of the union
   *  (presetCost at the live rows, as hopRatio prices a hop) shrinks with the scale²; 0 = no scale would (the caller's 0.2-a-step and floor clamps take it from there) */
  private holdWant(sc: number, avg: number, unionAvg: number, B: Bands): number {
    const pix = unionAvg * this.pixelShare(); const over = avg * 1000 - 1000 / B.aimFps;   // ms to come off the frame
    return pix - over > 0 ? sc * Math.sqrt((pix - over) / pix) : 0;
  }
  /** the share of the compute union that scales with the pixel count at the live preset / scale / divisors on this window, per the cost model (priced as hopRatio prices the current preset) */
  pixelShare(): number {
    const cur = this.current as QualityName; if (!(cur in COST)) return 0.6;
    const { cssH, cssW, dpr } = this.win();
    const live = this.livePreset(cur); const c = presetCost(live, this.oneGrid()); const rows = Math.min(live.maxH, cssH * dpr) * live.scale; const pixel = c.pixel * (rows * rows * (cssW / cssH) / 1e6) / REF.mpx;
    return pixel / Math.max(1e-6, pixel + c.fixed);
  }
  /** an aim's 'is the GPU the limit?' with timings: the frame no more than HOLD.pacedMs over the union (the usual overhead: nothing else paces it), or the union alone past the aim's budget
   *  (fewer pixels do buy time whatever else is slow — a display that missed its vsync shows a frame far longer than its GPU work and is still GPU-bound). A frame long with the GPU inside
   *  its budget is paced by something pixels cannot buy off: the display, the browser, the CPU */
  private holdBound(avg: number, unionAvg: number, B: Bands): boolean { return unionAvg > B.planBudget || avg * 1000 - unionAvg <= HOLD.pacedMs; }
  /** an aim's proof that a slow window is not the GPU's (ladderHeld): the union fits the aim's frame less HOLD.pacedMs and the frame is more than those 6 ms over it — on any display a
   *  frame the GPU is the limit of would be inside the aim there */
  private holdProof(avg: number, unionAvg: number, B: Bands): boolean { return unionAvg <= 1000 / B.target - HOLD.pacedMs && avg * 1000 - unionAvg > HOLD.pacedMs; }
  /** the scale an aim's judged cut goes to (ladderHeld): the highest grid level under `sc` where the cost model prices the union under `holdProof`'s floor; 0 = the
   *  scale floor does not reach it (nothing could be proved there: no cut) */
  private probeScale(sc: number, unionAvg: number, B: Bands): number {
    const floor = 1000 / B.target - HOLD.pacedMs, share = this.pixelShare();
    for (let k = snapDown(sc - 1e-3); k >= SCALE_FLOOR - 1e-6; k = +(k - SCALE_STEP).toFixed(2)) if (unionAvg * (1 + share * ((k / sc) ** 2 - 1)) <= floor) return +k.toFixed(2);   // (no margin on the model: a cut that lands short of the floor goes a step further next, or — nothing told at the end of its trial — is put back, pacedStep)
    return 0;
  }
  /** does the paced check stand on these bands? as now: settings.ladderPaced; an aim: settings.ladderHeld */
  private pacedOn(B: Bands): boolean { const S = this.engine.settings; return B.hold ? !!S.ladderHeld : !!S.ladderPaced; }
  /** an aim took the scale down from `from`: a gap before any step up, and — `costFrames`: the RATE fell under the aim there — that level held off as a failed climb rung is (CLIMB.failSecs,
   *  doubling per repeat under this preset); a step the union's band took off before the rate showed anything holds nothing off (the room test alone decides when it comes back) */
  private holdLeft(from: number, costFrames: boolean) { if (costFrames) this.fail({ kind: 'scale', from: this.engine.settings.renderScale, to: +from.toFixed(2) }); this.roomy = 0; this.sinceClimb = 0; }
  /** remember a rung as failed: held off CLIMB.failSecs the first time, doubling on every repeat under this preset (capped at 16×) — a rung this machine cannot afford in this scene converges to
   *  'left alone' instead of being re-taken and re-failed every minute (each cycle a resize + a reservoir restart + a second under the band) */
  private fail(step: ClimbStep) { const key = rungKey(step); const n = (this.failCount.get(key) ?? 0) + 1; this.failCount.set(key, n); const hold = CLIMB.failSecs * Math.min(16, 2 ** (n - 1)); this.failed.set(key, this.clock + hold); return hold; }
  /** undo the newest rung (the GPU over the back-off band): put its setting back, hold it off, hold off climbing for a gap */
  private unclimb(why: string) {
    const step = this.climbed.pop(); if (!step) return;
    this.undoStep(step); const hold = this.fail(step);
    this.sinceClimb = 0; this.roomy = 0; this.dipping = 0; this.cooldown = LADDER.stepCooldown;   // (dipping afresh: the window straddling this undo's resize must not count toward dropping the rest)
    this.lastChange = `climb ↓ undid ${rungKey(step)} (${why}) — held ${hold} s`;
  }
  /** THE PACED CHECK for one window (PACED; as now: settings.ladderPaced; an aim: settings.ladderHeld, the block under PACED): 0 = not paced — the rule as it was decides; 1 = paced — no cut, no preset starved away; 2 = the check moved
   *  the ladder itself (a judged cut taken back, a step given back or taken off again) and the window is spent. `avgT` = the window's mean frame without its longest one. */
  private pacedStep(B: Bands, avg: number, avgT: number, unionAvg: number, sc: number, top: number): 0 | 1 | 2 {
    const S = this.engine.settings;
    if (!this.pacedOn(B)) {   // off (as now: ladderPaced; an aim: ladderHeld): nothing of the check stands — the steps it held off included, and a judged cut still waiting goes back
      const lc0 = this.lastCut; if (lc0 && lc0.probeFrom !== undefined && this.adaptive && lc0.preset === this.current && lc0.probeFrom > sc + 1e-3) S.renderScale = +Math.min(top, lc0.probeFrom).toFixed(2);
      this.probeUntil = 0; this.probeN = 0; this.pacedAt = 0; this.pacedRun = 0; this.pacedChecks = 0; this.pacedMiss = 0; this.lastCut = null; this.upTrial = null; this.pacedBack = { at: -1e9, n: 0, until: 0 };
      if (this.pacedFailed.size) { for (const k of this.pacedFailed) { this.failed.delete(k); this.failCount.delete(k); } this.pacedFailed.clear(); }
      return 0;
    }
    const timed = unionAvg > 0, ms = avgT * 1000, fps = (s: number) => (1 / s).toFixed(0);
    const up = this.upTrial; this.upTrial = null;
    if (up && this.adaptive && S.renderScale > up.from + 1e-3 && avgT > up.avg * (1 + PACED.gain)) {   // a step given back is judged on its first window: the frame grew → it was not free
      const to = S.renderScale; S.renderScale = up.from; const held = this.fail({ kind: 'scale', from: up.from, to }); this.pacedFailed.add(`scale:${to.toFixed(2)}`); this.pacedRun = 0; this.slow = 0; this.cooldown = LADDER.stepCooldown;
      if (B.hold) this.pacedAt = 0;   // (an aim gives back at a remembered pace too: a frame that follows the pixels is no pace)
      this.lastChange = `paced ↓ scale ${up.from.toFixed(2)} (${fps(up.avg)} → ${fps(avgT)} fps at ×${to.toFixed(2)}: that step was not free — held off ${held} s)`; return 2;
    }
    if (avg <= 1 / B.cutFps) {   // not slow: no pace to speak of (and a cut that was being judged helped — an aim's own judged cut: the level it left cost the frame rate, a failed rung)
      const lc0 = this.lastCut; if (lc0 && lc0.probeFrom !== undefined && this.adaptive && lc0.preset === this.current && lc0.probeFrom > sc + 1e-3) this.holdLeft(lc0.probeFrom, true);
      this.pacedAt = 0; this.pacedRun = 0; this.pacedChecks = 0; this.pacedMiss = 0; this.probeN = 0; this.lastCut = null; return 0;
    }
    const proven = timed && (ms > 2 * (unionAvg + HOLD.pacedMs) || (B.hold && this.holdProof(avgT, unionAvg, B)));
    if (this.pacedAt > 0 && timed) {   // the remembered pace: still this page's?
      const off = Math.abs(avgT / this.pacedAt - 1) > PACED.band;
      this.pacedMiss = off ? this.pacedMiss + 1 : 0;
      if (ms - unionAvg <= HOLD.pacedMs || this.pacedMiss >= PACED.windows) this.pacedAt = 0;   // (the frame is plainly the GPU's work / the rate has left the pace two windows running: faster = the pacing is over, slower = now something IS load)
      else if (proven) { if (!off) this.pacedAt = avgT; this.pacedSince = this.clock; }
      else if (this.clock - this.pacedSince >= PACED.recheckSecs * 2 ** this.pacedChecks) { this.pacedAt = 0; this.pacedChecks = Math.min(PACED.recheckMax, this.pacedChecks + 1); }   // (a pace no window proves is put to the test again: the rule as it was takes its cut — an aim: its own judged cut, sample() — and the cut is judged)
      else if (!off) this.pacedAt = avgT;   // (a pace that drifts is followed)
    }
    const paced = proven || (timed && this.pacedAt > 0);
    const calm = paced || (timed && !B.hold && unionAvg <= B.gpuFloor);   // (under the old floor the rule as it was calls this window pacing too; an aim has no such floor: its calm window is a proven one, or one at the remembered pace)
    this.pacedRun = calm ? this.pacedRun + 1 : 0;
    if (proven && !this.pacedAt && this.pacedRun >= PACED.windows) { this.pacedAt = avgT; this.pacedSince = this.clock; this.pacedMiss = 0; }
    let lc = this.lastCut;
    if (lc && this.clock - lc.at >= PACED.trialSecs) {
      // (an aim's own judged cut that landed short of the proof's floor — the model was off, the load moved — has told nothing, and the frame is no shorter for it: its pixels go back
      // to where it started, no pace is learnt, and the next such cut is held off as a failed rung is, doubling. The rule's own cuts before it in the chain stay, as before)
      if (lc.probeFrom !== undefined && this.adaptive && lc.preset === this.current && lc.probeFrom > sc + 1e-3 && avgT >= lc.avg * (1 - PACED.probeGain)) {
        this.lastCut = null; S.renderScale = +Math.min(top, lc.probeFrom).toFixed(2);
        const pb = this.pacedBack; pb.n++; pb.until = this.clock + CLIMB.failSecs * Math.min(16, 2 ** (pb.n - 1)); this.pacedRun = 0; this.slow = 0; this.cooldown = LADDER.stepCooldown;
        this.lastChange = `paced ↑ scale ${S.renderScale.toFixed(2)} (${fps(lc.avg)} fps before the cut, ${fps(avgT)} after it, the GPU still at ${unionAvg.toFixed(1)} ms: the cut told nothing — the pixels go back, the next one in ${Math.round(pb.until - this.clock)} s)`; return 2;
      }
      lc = this.lastCut = null;
    }
    if (lc && calm && this.pacedRun >= PACED.windows) {   // A CUT BEING JUDGED: the GPU is no longer the limit by either test — did the frame rate move?
      this.lastCut = null;
      const hop = lc.preset !== this.current;
      const same = avgT >= lc.avg * (1 - (lc.probeFrom !== undefined ? PACED.probeGain : PACED.gain));   // (an aim's own judged cut: a missed vsync bought back is a whole refresh shorter, a fifth of the frame at the least — under `probeGain` it is the rate's own wobble)
      const shedToo = !!lc.shed && this.shed;   // (SHARP SHED: the chain let sharp direct go — it bought as little, and goes back with the pixels)
      if (same && lc.avg * 1000 - lc.union > HOLD.pacedMs && this.clock >= this.pacedBack.until && (hop ? this.auto : (this.adaptive && lc.from > sc + 1e-3) || shedToo)) {   // (… and where the cut started the frame was more than its GPU work: a state the check itself would keep)   // it did not: fewer pixels (a cheaper preset) bought nothing — back to where the cut found it
        if (hop) this.apply(lc.preset);
        if (shedToo) this.sharpBack(true);
        S.renderScale = +Math.min(hop ? this.maxScale : top, lc.from).toFixed(2);
        this.takeMarksBack(lc);
        if (B.hold) this.probeUntil = this.clock + PACED.recheckSecs * 2 ** Math.min(PACED.recheckMax, this.probeN++);   // (the next judged cut no sooner than the re-test of this pace would come, whatever becomes of the pace meanwhile)
        this.pacedAt = avgT; this.pacedSince = this.clock; this.pacedMiss = 0; this.pacedRun = 0; this.slow = 0; this.starved = 0; this.cooldown = hop ? 4 : LADDER.stepCooldown; this.pacedBack.at = this.clock;
        this.lastChange = `paced ↑ ${hop ? `${this.current} ` : ''}scale ${S.renderScale.toFixed(2)} (${fps(lc.avg)} fps before the cut, ${fps(avgT)} after it with the GPU at ${lc.union.toFixed(1)} → ${unionAvg.toFixed(1)} ms: frame pacing, not load — the pixels go back${shedToo ? ', sharp direct with them' : ''})`; return 2;
      }
      if (!same && !hop && lc.probeFrom !== undefined && this.adaptive && lc.probeFrom > sc + 1e-3) this.holdLeft(lc.probeFrom, true);   // (it was the pixels: the level an aim's own judged cut left cost the frame rate — a failed rung, so the way back up does not walk into it again a few seconds on)
    }
    // a scale under the tier's start on a PROVEN paced window (a cut from a fight before the pacing began): given back as far as the cost model keeps the page proven paced — on any
    // display that is also a frame the GPU still makes in half the pace, so the pixels cost nothing now and nothing when the pacing lifts (the rest is the plain restore's, once frames are fast)
    if (proven && !B.hold && !this.lastCut && this.adaptive && this.pacedRun >= PACED.upWindows && sc < this.maxScale - 1e-3) {   // (an aim gives back in its own restore branch of sample(), at any pace it knows)
      const fits = (to: number) => 2 * (unionAvg * (1 + this.pixelShare() * ((to / sc) ** 2 - 1)) * (1 + PACED.gain) + HOLD.pacedMs) < ms;
      let to = sc; for (let k = +Math.min(this.maxScale, snapDown(sc + 1e-6) + SCALE_STEP).toFixed(2); k <= this.maxScale + 1e-6 && fits(k) && !this.failed.has(`scale:${k.toFixed(2)}`); k = +(k + SCALE_STEP).toFixed(2)) to = k;
      if (to > sc + 1e-3) {
        S.renderScale = to; this.upTrial = { from: sc, avg: avgT }; this.pacedRun = 0; this.slow = 0; this.cooldown = LADDER.stepCooldown;
        this.lastChange = `paced ↑ scale ${to.toFixed(2)} (${fps(avgT)} fps with the GPU at ${unionAvg.toFixed(1)} ms: frame pacing, not load — these pixels cost nothing here)`; return 2;
      }
    }
    return paced ? 1 : 0;
  }
  /** an aim's cuts mark the level they left as a failed rung (holdLeft): a chain judged wrong gives those marks back with its pixels, as each cut found them (oldest last) */
  private takeMarksBack(lc: { marks?: [string, number, number | undefined][] }) { if (lc.marks) for (let k = lc.marks.length - 1; k >= 0; k--) { const [key, n, until] = lc.marks[k]; if (n > 0) this.failCount.set(key, n); else this.failCount.delete(key); if (until === undefined) this.failed.delete(key); else this.failed.set(key, until); } }
  /** a cut (or a preset given up) the paced check will judge: a chain of them is judged against where its first one started */
  private pacedCut(B: Bands, from: number, avgT: number, union: number, preset: QualityName = this.current, probe = false) {
    if (!this.pacedOn(B)) return;
    const lc = this.lastCut; const chained = !!lc && this.clock - lc.at < PACED.trialSecs; this.lastCut = chained ? { ...lc!, at: this.clock } : { from, preset, avg: avgT, union, at: this.clock };
    if (probe) this.lastCut.probeFrom ??= from; else delete this.lastCut.probeFrom;   // (where the chain's run of an aim's own judged cuts began: only that run goes back when it tells nothing; a cut of the rule's own after it ends the run)
    if (B.hold) { const key = `scale:${from.toFixed(2)}`; (this.lastCut.marks ??= []).push([key, this.failCount.get(key) ?? 0, this.failed.get(key)]); }   // (called BEFORE the cut's holdLeft: the failed-rung state as the cut found it)
    const pb = this.pacedBack; if (this.clock - pb.at < PACED.backSecs) { pb.n++; pb.until = this.clock + CLIMB.failSecs * Math.min(16, 2 ** (pb.n - 1)); pb.at = -1e9; }   // (cut again right after a take-back: that take-back was wrong — the next is held off, doubling)
  }
  private undoStep(step: ClimbStep) { const S = this.engine.settings; if (step.kind === 'scale') S.renderScale = +Math.min(S.renderScale, Math.max(this.maxScale, step.from)).toFixed(2); else if (step.kind === 'gather') S.gatherThird = true; else if (step.kind === 'vol') S.volQuarter = true; else S.maxInternalHeight = Math.min(S.maxInternalHeight, step.from); }   // (min: a scale / cap the player has since set LOWER by hand stays where they put it)
  /** every rung down at once — the climb switched off, adaptive off, or the frame rate under the band with rungs standing (`markNewest`: hold off just the newest rung; the rest may be re-earned) */
  private unclimbAll(why: string, markNewest = false) {
    let hold = 0; if (markNewest && this.climbed.length) hold = this.fail(this.climbed[this.climbed.length - 1]);
    while (this.climbed.length) this.undoStep(this.climbed.pop()!);
    this.roomy = 0; this.sinceClimb = 0; this.dipping = 0; this.lastChange = `climb ↓ all rungs (${why})${hold ? ` — the newest held ${hold} s` : ''}`;
  }
  /** the motion-calm bundle on / off (MOTION_CALM above): on = those four rows; off = the engine defaults for them (no preset places any of the four) */
  applyMotionCalm(on: boolean) {
    const S = this.engine.settings; const p = PRESETS[this.current as QualityName] ?? PRESETS.high; const D = MOTION_CALM_OFF; this.motionCalm = on;
    if (on) { S.restirSpatialAll = MOTION_CALM.restirSpatialAll; S.restirPenRays = MOTION_CALM.restirPenRays; S.taauMotionAlpha = MOTION_CALM.taauMotionAlpha; S.taauSharpenMotion = MOTION_CALM.taauSharpenMotion; }
    else { S.restirSpatialAll = D.restirSpatialAll; S.restirPenRays = D.restirPenRays; S.taauMotionAlpha = D.taauMotionAlpha; S.taauSharpenMotion = D.taauSharpenMotion; }
    S.restirHistory = p.restir.history;   // (either way the tier's own reservoir memory)
    this.lastChange = `motion-calm rows ${on ? 'ON (restir spatialAll + penRays · resolve motion α 0.25, sharpen 0.15)' : 'off (the preset\'s own)'}`;
  }
  /** QA / the Tab panel: feed the ladder synthetic 1-s windows without presenting anything — `secs` seconds of frames at `fps` with the GPU union at `unionMs` (tools/qa/quality-plan.ts drives the climb's
   *  checks through this; the calibration must be done or off) */
  simulate(secs: number, fps: number, unionMs: number) { const dt = 1 / fps; const n = Math.round(secs * fps); for (let i = 0; i < n; i++) this.sample(dt, unionMs); return { scale: this.engine.settings.renderScale, sharp: this.engine.settings.sharpDirect, gatherThird: this.engine.settings.gatherThird, volQuarter: this.engine.settings.volQuarter, maxH: this.engine.settings.maxInternalHeight, preset: this.current, last: this.lastChange, climb: this.climbState }; }
}
