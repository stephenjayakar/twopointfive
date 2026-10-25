// REPLAY THE QUALITY LADDER OVER AN F9 RECORDING — no GPU needed (rebuild/performance/auto-quality.md is the write-up).
//
//   bun run tools/qa/ladder-replay.ts <perf-….json>… [--aim asnow|60|90|120|display|all] [--hz N] [--paced on|off] [--held on|off] [--shed on|off] [--sharpk N] [--sweeps] [--check] [--md] [--timeline] [--hold k=v,…]
//   bun run tools/qa/ladder-replay.ts --selftest
//
// An F9 dump (ui/perfrec.ts) carries, per frame, the frame time, the compute passes' GPU union, the resolution and the preset, and the ladder's own moves as events. That is everything
// `Quality.sample()` is fed in the page, so the REAL class (src/ui/quality.ts, over a stub engine as tools/qa/quality-plan.ts builds one) can be driven by a recording:
//
//   · while the replayed ladder sits where the recording's sat, a frame is fed back exactly as recorded (dt, union; NaN where the readback was stale — two frames with the same pass table);
//   · where it sits elsewhere (another aim cut the scale, dropped a preset, climbed a rung) the frame is RE-PRICED by the cost model: union' = union × model(replayed state) ÷ model(recorded
//     state), frame' = max(display interval, union' + the frame's own overhead), and the recorded second is replayed as however many of those frames fit in it (the scene's timeline stays the
//     recording's). MODEL below = quality.ts presetCost + two corrections measured on the Mac's sweep take (take 3): a fixed 1.6 model-ms the table does not carry, and ×1.07 on presets under
//     high. Scale steps at high then land within 1 % of the sweep's measured flips; medium within the correction; low / verylow are the model alone.
//
//   --check   as-now only: the replayed moves must be the recording's own 'ladder' events (same moves, same order, each within 2.5 s). The ladder's counters at the moment F9 was pressed are
//             not in a dump, so the window phase and the roomy count are tried over their few values and the best fit is named. Exit 1 if no start state reproduces the take.
//   --selftest  synthetic closed-loop machines: what each aim must do (PASS / FAIL lines, exit 1 on a FAIL).
import { readFileSync } from 'node:fs';
import { PRESETS, REF, SCALE_FLOOR, LADDER, CLIMB, HOLD, PACED, SHED, sharpForce, AIM_DISPLAY, PLAN_BUDGET_MS, QUALITY_NAMES, ladderBands, ladderAimOf, displayRateOf, presetCost, plan, withSmoke, costTable, type QualityName, type Preset } from '../../src/ui/quality.ts';
import type { PerfDump, PerfFrame } from '../../src/ui/perfrec.ts';

const G = globalThis as unknown as Record<string, any>;
G.GPUBufferUsage ??= { MAP_READ: 1, MAP_WRITE: 2, COPY_SRC: 4, COPY_DST: 8, INDEX: 16, VERTEX: 32, UNIFORM: 64, STORAGE: 128, INDIRECT: 256, QUERY_RESOLVE: 512 };
G.GPUTextureUsage ??= { COPY_SRC: 1, COPY_DST: 2, TEXTURE_BINDING: 4, STORAGE_BINDING: 8, RENDER_ATTACHMENT: 16 };
G.GPUShaderStage ??= { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 }; G.GPUMapMode ??= { READ: 1, WRITE: 2 };
const store = new Map<string, string>();
G.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); } };
G.document = { hidden: false }; G.window = { devicePixelRatio: 2, __testVisible: true };
const { Quality } = await import('../../src/ui/quality.ts');
const { defaultRcConfig } = await import('../../src/render/rc.ts');
const defaults = (await import('../../src/engine.ts')).defaultSettings as unknown as () => Record<string, any>;

// ---- the response model: what the union does when the ladder sits somewhere else -------------------------------------------------------------------------------------------------------------
/** measured on the Mac's sweep take (rebuild/performance/mac-recordings.md, take 3: High ×0.95 gather ½, 13.9 ms union): 0.95 → 0.90 gave back 0.94 ms (ratio 0.932), 0.95 → 0.77 gave
 *  3.27 ms (0.765), all of Medium 7.62 ms (0.452). presetCost alone says 0.924 / 0.747 / 0.380: its fixed part is short of what a frame carries today (fog of war, the mesh refit, the
 *  probe's traffic). `extraFixed` model-ms on every preset puts the two scale steps at 0.930 / 0.765; `under` on the presets below high puts Medium at 0.452. */
const MODEL = { extraFixed: 1.6, under: 1.07, overheadMs: 2.8, sharpK: 1 };   // (sharpK: sharp direct's part × this — the same Mac's sweep of 10-25 priced it at 4.9 of 15.5 ms at High ×0.5, well over presetCost's share: the fog pass, the g-buffer and the composite at the output size ride with it; 1 = the model's own, as every machine here before SHARP SHED ran)
interface State { preset: QualityName; scale: number; gatherThird: boolean; volQuarter: boolean; maxH: number; sharp: boolean }
interface Win { cssW: number; cssH: number; dpr: number }
const rowsOf = (s: State, w: Win) => Math.min(s.maxH, w.cssH * w.dpr) * s.scale;
function modelCost(s: State, w: Win, base: Record<string, any>): number {
  const pc = withSmoke(PRESETS[s.preset], typeof base.smokeKeep === 'number' ? base.smokeKeep : 0);   // (a take from before SMOKE KEEP carries no such setting: its presets ran their own smoke rows)
  const live: Preset = { ...pc, lossy: { ...pc.lossy, gatherThird: s.gatherThird, volQuarter: s.volQuarter }, maxH: s.maxH, scale: s.scale, iq: { ...pc.iq, sharp: s.sharp && base.taau !== false } };
  const c = presetCost(live, base.oneCacheGrid === true); const rows = rowsOf(s, w); const mpx = rows * rows * (w.cssW / w.cssH) / 1e6;   // (a take from before ONE CACHE GRID carries no such setting: its low and verylow ran the coarse grid and are priced on it, as replay() has the ladder price them)
  return (s.preset === 'high' || s.preset === 'ultra' ? 1 : MODEL.under) * (c.fixed + (MODEL.sharpK - 1) * c.passes.sharp + MODEL.extraFixed + c.pixel * mpx / REF.mpx);
}

// ---- a stub engine on the recording's window ---------------------------------------------------------------------------------------------------------------------------------------------------
function mkEngine(w: Win, settings: Record<string, any>) {
  G.window.devicePixelRatio = w.dpr;
  const E: any = { settings: { ...defaults(), ...settings }, rc: { cfg: { ...defaultRcConfig } }, rebuildRc(cfg: any) { this.rc.cfg = cfg; }, gpu: { canvas: { clientHeight: w.cssH, clientWidth: w.cssW } },
    get capScale() { return Math.min(1, this.settings.maxInternalHeight / (w.cssH * w.dpr)); }, get effectiveScale() { return this.capScale * Math.min(1, this.settings.renderScale); },
    timer: { enabled: true, results: new Map<string, number>(), total() { return 0; }, unionMs() { return 0; } } };
  return E;
}
/** a Quality standing where a session stands once its boot is behind it: `preset` applied, calibration done, auto or pinned-with-adaptive, then the recording's own settings laid over */
function mkQuality(w: Win, preset: QualityName, auto: boolean, settings: Record<string, any>, aim: number, hz: number, shed0 = false) {
  store.clear();
  const E = mkEngine(w, {}); const q: any = new Quality(E as never, { params: { rbIters: 4 } } as never);
  q.auto = auto; q.apply(preset); q.adaptive = true; q.climbAllowed = true; q.calib = { ...q.calib, done: true };
  for (const k of ['renderScale', 'gatherThird', 'volQuarter', 'ladderClimb', 'capClimb', 'ladderPaced', 'ladderHeld', 'oneCacheGrid', 'smokeKeep', 'taau', 'sharpDirect', 'rcHalfRate', 'maxInternalHeight']) if (k in settings) E.settings[k] = settings[k];
  E.settings.ladderShed = settings.ladderShed === true;   // (SHARP SHED only where a machine or a take says so: every case and every take from before the switch runs the ladder as it was)
  if (shed0 && auto && E.settings.ladderShed && !E.settings.sharpDirect) q.shed = true;   // (a take begun with the shed standing, PerfDump.shedAtStart: the ladder knows sharp direct is its own to bring back)
  E.settings.ladderAim = aim; q.displayHzPin = hz; q.cooldown = 0; q.lastChange = '';
  return { E, q };
}
const stateOf = (q: any, E: any): State => ({ preset: q.current, scale: E.settings.renderScale, gatherThird: !!E.settings.gatherThird, volQuarter: !!E.settings.volQuarter, maxH: E.settings.maxInternalHeight, sharp: !!E.settings.sharpDirect });

// ---- the replay --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
interface Move { t: number; text: string; state: State; rows: number }
interface Result { aim: number; target: number; moves: Move[]; secs: number; meanFps: number; held: number; worst1: number; worst2: number; rowsMean: number; rowsMin: number; rowsMax: number; presetShare: Record<string, number>; scaleShare: Record<string, number>;
  timeline: { t0: number; fps: number; worst: number; union: number; preset: string; scale: number; rows: number }[]; overhead: number; hz: number; win: Win; recorded: { meanFps: number; worst1: number; worst2: number; held: (fps: number) => number } }
interface Warm { acc: number; roomy: number }   // the ladder's state when F9 was pressed, as far as a dump cannot say: how far into its 1-s window it was, how many roomy windows it had counted (its last step taken long ago)

function loadDump(path: string): PerfDump { return JSON.parse(readFileSync(path, 'utf8')) as PerfDump; }
const presetOfLabel = (label: string): { preset: QualityName; auto: boolean } => { const m = /^auto \((\w+)\)$/.exec(label); return m ? { preset: m[1] as QualityName, auto: true } : { preset: label as QualityName, auto: false }; };
const gpuKey = (f: PerfFrame) => { let s = ''; for (const k in f.gpu) s += k + ':' + f.gpu[k] + ','; return s; };
function windowOf(d: PerfDump): Win {
  const f = d.frames.find(x => x.eff > 0 && x.res?.[1] > 0)!; const dpr = d.dpr || 1;
  const devH = f.res[1] / f.eff, devW = f.res[0] / f.eff; return { cssW: Math.round(devW / dpr), cssH: Math.round(devH / dpr), dpr };
}
/** the display's rate as the take shows it: the page's own estimator (quality.ts displayRateOf — the fastest eight consecutive frames) over the recorded frame times */
function hzOf(d: PerfDump): number { return displayRateOf(d.frames.map(f => f.dt).filter(x => x > 2 && x < 100), 0.08) || 60; }   // (8 %: a dump's dt is the callback's clock, a millisecond looser than the rAF timestamps the page reads)

/** --paced on|off: the as-now paced check (settings.ladderPaced) forced for a replay; unset = the take's own setting — a take from before the switch has none and replays under the rule as it was */
let pacedForce: boolean | undefined;
/** --held on|off: the same check under an aim (settings.ladderHeld) forced for a replay; unset = the take's own setting, and a take from before the switch (10-14) has none and replays
 *  with it OFF, as its page ran — `--held on` asks what the rule would have done with that take */
let heldForce: boolean | undefined;
/** --shed on|off: SHARP SHED (settings.ladderShed) forced for a replay; unset = the take's own setting, and a take from before the switch (10-25) replays with it OFF, as its page ran —
 *  `--shed on` asks what the rule would have done with that take (`--sharpk N` = the response model's price of sharp direct, MODEL.sharpK) */
let shedForce: boolean | undefined;
function replay(d: PerfDump, aim: number, opts: { hz?: number; warm?: Warm } = {}): Result {
  const w = windowOf(d); const hz = opts.hz ?? hzOf(d); const S0 = d.settingsAtStart as Record<string, any>;
  const first = d.frames[0]; const { preset: p0, auto } = presetOfLabel(first.preset);
  const { E, q } = mkQuality(w, p0, auto, S0, aim, hz, d.shedAtStart === true); if (pacedForce !== undefined) E.settings.ladderPaced = pacedForce; if (heldForce !== undefined) E.settings.ladderHeld = heldForce; else if (!('ladderHeld' in S0)) E.settings.ladderHeld = false;
  if (shedForce !== undefined) E.settings.ladderShed = shedForce;
  if (!('smokeKeep' in S0)) E.settings.smokeKeep = 0;   // (… and before SMOKE KEEP: every preset on its own smoke rows)
  if (!('oneCacheGrid' in S0)) E.settings.oneCacheGrid = false;   // (a take from before ONE CACHE GRID: its low and verylow ran the coarse grid — the replayed ladder prices them so, as modelCost does)
  if (opts.warm) { q.sinceClimb = 99; q.acc = opts.warm.acc; q.frames = Math.max(1, Math.round(opts.warm.acc / (first.dt / 1000))); q.roomy = opts.warm.roomy; q.unionAcc = (first.gpuUnion ?? 0) * q.frames; q.unionN = first.gpuUnion ? q.frames : 0; }
  // the recorded ladder's state per frame: the scale off the resolution, the divisors off the 'settings' events, the preset off the label
  const rec: State = { preset: p0, scale: S0.renderScale, gatherThird: !!S0.gatherThird, volQuarter: !!S0.volQuarter, maxH: S0.maxInternalHeight, sharp: 'sharpDirect' in S0 ? !!S0.sharpDirect : !!E.settings.sharpDirect };   // (a take from before the key: as the replayed preset places it, so the two sides price alike)
  const setEv = d.events.filter(e => e.kind === 'settings'); let se = 0;
  const applySettings = (text: string) => { for (const m of text.matchAll(/(\w+) (\S+?) → ([^\s,]+)/g)) { const [, k, , v] = m; if (k === 'gatherThird') rec.gatherThird = v === 'true'; else if (k === 'volQuarter') rec.volQuarter = v === 'true'; else if (k === 'sharpDirect') rec.sharp = v === 'true'; else if (k === 'maxInternalHeight') rec.maxH = +v; } };
  // the frame's own overhead past the union, for frames the display paced (a 120 Hz frame with 4 ms of GPU work is not '4.3 ms of overhead'): the take's median over its GPU-bound frames
  // (… and not the frames something else HELD: one more than a whole refresh + HOLD.pacedMs over its union is no vsync the GPU missed — a browser holding the page to 30 fps, a CPU hitch.
  // Such a frame stays as long as it was whatever the ladder renders, until the re-priced work itself outgrows it; before 10-14 its whole wait counted as overhead that moved with the union)
  const heldOut = (dt: number, u: number) => u > 0 && dt - u > 1000 / hz + HOLD.pacedMs;
  const over: number[] = []; for (const f of d.frames) if (f.gpuUnion && f.dt > 1000 / hz * 1.15 && f.dt < 60 && !heldOut(f.dt, f.gpuUnion)) over.push(f.dt - f.gpuUnion);
  over.sort((a, b) => a - b); const overMed = over.length > 50 ? over[over.length >> 1] : MODEL.overheadMs;
  const B = ladderBands(aim, hz); const target = B.hold ? B.target : 60;
  const moves: Move[] = []; let last = q.lastChange; let carry = 0; let lastUnion = 0; let prevKey = '';
  let tSum = 0, nFrames = 0, heldT = 0, rowsT = 0, rowsMin = 1e9, rowsMax = 0; const presetT: Record<string, number> = {}, scaleT: Record<string, number> = {};
  const wins: { t: number; n: number; r: number; u: number; rows: number; rT: number; rN: number }[] = [];   // 1-s windows of the scene's timeline: frames shown, time, mean union; the recording's own beside
  for (const f of d.frames) {
    while (se < setEv.length && setEv[se].t <= f.t) applySettings(setEv[se++].text);
    { const labelNow = presetOfLabel(f.preset).preset; if (labelNow !== rec.preset) { rec.preset = labelNow; rec.maxH = PRESETS[labelNow].maxH; rec.gatherThird = PRESETS[labelNow].lossy.gatherThird; rec.volQuarter = withSmoke(PRESETS[labelNow], typeof S0.smokeKeep === 'number' ? S0.smokeKeep : 0).lossy.volQuarter; } }   // (a recorded preset hop: its rows — the 'settings' event of a hop lists only its first eight keys)
    if (f.res?.[1] > 0) rec.scale = +(f.res[1] / Math.min(rec.maxH, w.cssH * w.dpr)).toFixed(2);
    if (!(f.dt < 500)) continue;   // (main.ts feeds no frame of half a second or more)
    const key = gpuKey(f); const stale = key === prevKey; prevKey = key;
    const union = f.gpuUnion ?? 0; if (union > 0 && !stale) lastUnion = union;
    const sim = stateOf(q, E);
    const same = sim.preset === rec.preset && Math.abs(sim.scale - rec.scale) < 0.004 && sim.gatherThird === rec.gatherThird && sim.volQuarter === rec.volQuarter && sim.maxH === rec.maxH && sim.sharp === rec.sharp;
    let dt2 = f.dt, union2 = union;
    if (!same) {
      const R = modelCost(sim, w, S0) / modelCost(rec, w, S0); const u = union > 0 ? union : lastUnion;
      union2 = union > 0 ? union * R : 0;
      const paced = f.dt <= 1000 / hz * 1.15; const o = paced ? Math.min(Math.max(0, f.dt - u), overMed) : Math.max(0, f.dt - u);
      dt2 = u > 0 ? (heldOut(f.dt, u) ? Math.max(f.dt, u * R + overMed) : Math.max(1000 / hz, u * R + o)) : f.dt;
    }
    // the scene's f.dt of wall time, shown as frames of dt2
    const rows = rowsOf(sim, w); const sec = Math.floor(f.t / 1000);
    const wn = (wins[sec] ??= { t: 0, n: 0, r: 0, u: 0, rows: 0, rT: 0, rN: 0 }); wn.t += f.dt; wn.n += f.dt / dt2; wn.u += union2 * f.dt; wn.rows += rows * f.dt; wn.rT += f.dt; wn.rN += 1;
    tSum += f.dt; nFrames += f.dt / dt2; rowsT += rows * f.dt; rowsMin = Math.min(rowsMin, rows); rowsMax = Math.max(rowsMax, rows);
    presetT[sim.preset] = (presetT[sim.preset] ?? 0) + f.dt; { const k = `${sim.preset} ×${sim.scale.toFixed(2)}`; scaleT[k] = (scaleT[k] ?? 0) + f.dt; }
    carry += f.dt / dt2;
    while (carry >= 1) {
      carry -= 1; q.sample(dt2 / 1000, E.timer.enabled ? (union <= 0 ? 0 : stale ? NaN : union2) : 0);
      if (q.lastChange !== last) { last = q.lastChange; const st = stateOf(q, E); moves.push({ t: f.t / 1000, text: last, state: st, rows: rowsOf(st, w) }); }
    }
  }
  const W = wins.filter(x => x && x.t > 500); const fpsW = W.map(x => 1000 * x.n / x.t); const recW = W.map(x => 1000 * x.rN / x.rT);
  for (const x of W) if (1000 * x.n / x.t >= HOLD.cut * target) heldT += x.t;
  const worst2 = (a: number[]) => { let m = 1e9; for (let i = 0; i + 1 < a.length; i++) m = Math.min(m, (a[i] + a[i + 1]) / 2); return m; };
  const timeline: Result['timeline'] = []; const step = 15;
  for (let i = 0; i < wins.length; i += step) { const seg = wins.slice(i, i + step).filter(x => x && x.t > 500); if (!seg.length) continue; const t = seg.reduce((a, x) => a + x.t, 0);
    const lastMove = [...moves].reverse().find(m => m.t <= i + step); const st = lastMove?.state ?? { preset: p0, scale: S0.renderScale } as State;
    timeline.push({ t0: i, fps: 1000 * seg.reduce((a, x) => a + x.n, 0) / t, worst: Math.min(...seg.map(x => 1000 * x.n / x.t)), union: seg.reduce((a, x) => a + x.u, 0) / t, preset: st.preset, scale: st.scale, rows: seg.reduce((a, x) => a + x.rows, 0) / t }); }
  const share = (m: Record<string, number>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v / tSum]));
  const totT = W.reduce((a, x) => a + x.t, 0);
  return { aim, target, moves, secs: tSum / 1000, meanFps: 1000 * nFrames / tSum, held: heldT / totT, worst1: Math.min(...fpsW), worst2: worst2(fpsW), rowsMean: rowsT / tSum, rowsMin, rowsMax, presetShare: share(presetT), scaleShare: share(scaleT), timeline, overhead: overMed, hz, win: w,
    recorded: { meanFps: 1000 * d.frames.filter(f => f.dt < 500).length / tSum, worst1: Math.min(...recW), worst2: worst2(recW), held: (fps: number) => W.reduce((a, x, i) => a + (recW[i] >= fps ? x.t : 0), 0) / totT } };
}

// ---- --check: as-now must make the recording's own moves ------------------------------------------------------------------------------------------------------------------------------------
const moveKey = (text: string) => text.replace(/\s*\(.*$/, '').replace(/\s+—.*$/, '').trim();   // 'climb ↑ scale 0.80 (gpu ∪ 8.1 ms of 16.7)' → 'climb ↑ scale 0.80'
const isStep = (text: string) => /^(climb|adaptive|auto|paced|shed|hold \d+) [↑↓]/.test(text);   // the ladder's steps (not its 'frame pacing' notes, a calibration's line, a hand's pin)
const laddersOf = (d: PerfDump) => d.events.filter(e => e.kind === 'ladder' && isStep(e.text)).map(e => ({ t: e.t / 1000, key: moveKey(e.text), text: e.text }));
const aimOfTake = (d: PerfDump) => Number((d.settingsAtStart as Record<string, unknown>).ladderAim) || 0;   // (a take recorded under an aim is checked under that aim)
/** the start state under which as-now replays closest to the recording's own moves */
function bestWarm(d: PerfDump, hz?: number) {
  const want = laddersOf(d);
  let best: { warm: Warm; r: Result; matched: number; err: number; extra: number } | null = null;
  for (let acc = 0; acc < 1; acc += 0.05) for (const roomy of [0, 1, 2, 3]) {
    const warm = { acc, roomy }; const r = replay(d, aimOfTake(d), { warm, hz }); const got = r.moves.filter(m => isStep(m.text));
    let matched = 0, err = 0; const used = new Set<number>();
    for (const wv of want) { const j = got.findIndex((g, i) => !used.has(i) && moveKey(g.text) === wv.key && Math.abs(g.t - wv.t) <= 2.5); if (j >= 0) { used.add(j); matched++; err += Math.abs(got[j].t - wv.t); } }
    const extra = got.length - used.size;
    if (!best || matched - extra > best.matched - best.extra || (matched - extra === best.matched - best.extra && err < best.err)) best = { warm, r, matched, err, extra };
  }
  return best!;
}
function checkAsNow(d: PerfDump, name: string, hz?: number): boolean {
  const want = laddersOf(d); const b = bestWarm(d, hz); const ok = b.matched === want.length && b.extra === 0;
  console.log(`\n${name}: ${aimName(aimOfTake(d))}, replayed against the recording's own ${want.length} ladder moves (start state tried over 20 window phases × 4 roomy counts; best: ${(b.warm.acc * 1000).toFixed(0)} ms into a window, roomy ${b.warm.roomy})`);
  const got = b.r.moves.filter(m => isStep(m.text));
  for (const wv of want) { const g = got.find(x => moveKey(x.text) === wv.key && Math.abs(x.t - wv.t) <= 2.5); console.log(`  ${g ? 'PASS' : 'FAIL'} — recorded ${wv.t.toFixed(1).padStart(6)} s  ${wv.text}${g ? `   ← replay ${g.t.toFixed(1)} s  ${g.text}` : '   ← no such move in the replay'}`); }
  for (const g of got) if (!want.some(wv => moveKey(g.text) === wv.key && Math.abs(g.t - wv.t) <= 2.5)) console.log(`  FAIL — the replay moved where the recording did not: ${g.t.toFixed(1)} s  ${g.text}`);
  console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${b.matched} of ${want.length} recorded moves reproduced, ${b.extra} extra; mean |Δt| ${(b.matched ? b.err / b.matched : 0).toFixed(2)} s; replayed mean ${b.r.meanFps.toFixed(1)} fps vs recorded ${b.r.recorded.meanFps.toFixed(1)}`);
  return ok;
}

// ---- reporting -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const aimName = (a: number) => a === 0 ? 'as now' : a >= AIM_DISPLAY ? 'hold display' : `hold ${a}`;
const pct = (x: number) => `${(100 * x).toFixed(0)} %`;
function report(name: string, d: PerfDump, rs: Result[], md: boolean, timeline: boolean) {
  const r0 = rs[0]; const w = r0.win;
  const head = `${name}: ${r0.secs.toFixed(0)} s, ${d.frames[0].preset}, window ${w.cssW}×${w.cssH} @${w.dpr} (${w.cssH * w.dpr} device rows), display taken as ${r0.hz} Hz, frame overhead past the GPU union ${r0.overhead.toFixed(1)} ms`;
  const recLine = `recorded: mean ${r0.recorded.meanFps.toFixed(1)} fps, worst second ${r0.recorded.worst1.toFixed(0)}, worst two seconds ${r0.recorded.worst2.toFixed(0)}; at or over 58 fps ${pct(r0.recorded.held(HOLD.cut * 60))} of the time, 87 fps ${pct(r0.recorded.held(HOLD.cut * 90))}, 116 fps ${pct(r0.recorded.held(HOLD.cut * 120))}`;
  const rows = rs.map(r => { const top = Object.entries(r.scaleShare).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${pct(v)}`).join(', ');
    return [aimName(r.aim), r.aim ? `${r.target} fps` : '(60 Hz budget)', r.meanFps.toFixed(1), r.aim ? pct(r.held) : `${pct(r.held)} (of 58)`, r.worst1.toFixed(0), r.worst2.toFixed(0), `${r.rowsMean.toFixed(0)} (${r.rowsMin.toFixed(0)}‥${r.rowsMax.toFixed(0)})`, Object.entries(r.presetShare).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v)}`).join(', '), top, String(r.moves.length)]; });
  const cols = ['aim', 'works to', 'mean fps', 'time at the aim', 'worst 1 s', 'worst 2 s', 'rows mean (min‥max)', 'preset', 'most of the time at', 'moves'];
  if (md) { console.log(`\n**${head}**\n\n${recLine}\n\n| ${cols.join(' | ')} |\n|${cols.map(() => '---').join('|')}|`); for (const r of rows) console.log(`| ${r.join(' | ')} |`); }
  else { console.log(`\n${head}\n  ${recLine}`); const wd = cols.map((c, i) => Math.max(c.length, ...rows.map(r => r[i].length))); console.log('  ' + cols.map((c, i) => c.padEnd(wd[i])).join('  ')); for (const r of rows) console.log('  ' + r.map((c, i) => c.padEnd(wd[i])).join('  ')); }
  if (timeline) for (const r of rs) {
    console.log(md ? `\n${aimName(r.aim)}, every 15 s: ` + '`' + r.timeline.map(x => `${x.t0}s ${x.fps.toFixed(0)}fps(min ${x.worst.toFixed(0)}) ${x.rows.toFixed(0)}r`).join(' · ') + '`' : `\n  ${aimName(r.aim)} — every 15 s: mean fps (worst second) · mean union · rows`);
    if (!md) for (const x of r.timeline) console.log(`    ${String(x.t0).padStart(4)} s  ${x.fps.toFixed(0).padStart(4)} fps (${x.worst.toFixed(0).padStart(3)})  ∪ ${x.union.toFixed(1).padStart(5)} ms  ${x.rows.toFixed(0).padStart(5)} rows`);
    console.log(md ? `\n${aimName(r.aim)} moves:\n` : `  ${aimName(r.aim)} — moves:`);
    for (const m of r.moves) console.log(`${md ? '- ' : '    '}${m.t.toFixed(1).padStart(6)} s  ${m.state.preset} ×${m.state.scale.toFixed(2)} = ${m.rows.toFixed(0)} rows  ${m.text}`);
  }
}

// ---- --selftest: synthetic machines ------------------------------------------------------------------------------------------------------------------------------------------------------------
function selftest(): boolean {
  let fails = 0; const check = (ok: boolean, what: string) => { console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${what}`); if (!ok) fails++; };
  const w: Win = { cssW: 1456, cssH: 873, dpr: 2 }; const S0 = { sharpDirect: true, taau: true, oneCacheGrid: true, smokeKeep: 1 };   // (the synthetic machines run the page as it opens: one cache grid, as the ladder's own cost table prices it)
  /** `secs` on a machine whose union is `k`(t) × the model's cost of what the ladder is rendering, shown on a `hz` display (`vrr`: a frame takes what it takes above the display's interval;
   *  else whole display intervals), with `paceMs` = something else holding every frame to at least that; returns the 1-s fps windows and the moves */
  const run = (q: any, E: any, secs: number, hz: number, k: (t: number) => number, o: { vrr?: boolean; paceMs?: number | ((t: number) => number); timed?: boolean; t0?: number; hitch?: () => number } = {}) => {
    const fps: number[] = []; const moves: string[] = []; let last = q.lastChange; let t = 0, wt = 0, wn = 0; const iv = 1000 / hz;
    while (t < secs * 1000) {
      const union = k((o.t0 ?? 0) + t / 1000) * modelCost(stateOf(q, E), w, S0); let dt = Math.max(iv, union + MODEL.overheadMs, typeof o.paceMs === 'function' ? o.paceMs((o.t0 ?? 0) + t / 1000) : o.paceMs ?? 0); if (o.vrr === false) dt = Math.ceil(dt / iv - 1e-9) * iv; { const h = o.hitch?.() ?? 0; if (h > 0) dt = h; }
      q.sample(dt / 1000, o.timed === false ? 0 : union); t += dt; wt += dt; wn++;
      if (q.lastChange !== last) { last = q.lastChange; moves.push(`${((o.t0 ?? 0) + t / 1000).toFixed(1)} s ${last}`); }
      if (wt >= 1000) { fps.push(1000 * wn / wt); wt = 0; wn = 0; }
    }
    return { fps, moves };
  };
  const base = modelCost({ preset: 'high', scale: PRESETS.high.scale, gatherThird: true, volQuarter: false, maxH: PRESETS.high.maxH, sharp: true }, w, S0);   // model-ms of high at its start on this window
  const at = (ms: number) => ms / base;   // the machine factor that makes high-at-its-start cost `ms` of union
  const mk = (aim: number, hz: number, auto = false, preset: QualityName = 'high') => mkQuality(w, preset, auto, { ladderClimb: true }, aim, hz);
  const minOf = (a: number[]) => Math.min(...a);
  const sc = (x: { E: any }) => x.E.settings.renderScale as number; const words = (m: string[]) => m.map(x => x.split(' (')[0].replace(/^[\d.]+ s /, '')).join(' | ') || 'none';

  console.log('\nThe bands each aim puts the ladder on:');
  { const b0 = ladderBands(0), b60 = ladderBands(60, 120), b90 = ladderBands(90, 120), b120 = ladderBands(120, 120), bd = ladderBands(AIM_DISPLAY, 144), b12060 = ladderBands(120, 60);
    check(b0.cutFps === LADDER.cutFps && b0.aimFps === LADDER.aimFps && b0.restoreFps === LADDER.restoreFps && b0.starvedFps === LADDER.starvedFps && b0.cruisingFps === LADDER.cruisingFps && b0.backoffFps === CLIMB.backoffFps && b0.budget === 1000 / CLIMB.budgetFps && b0.planBudget === PLAN_BUDGET_MS && b0.gpuFloor === LADDER.cutGpuFrac * (1000 / LADDER.aimFps) && !b0.hold, `as now = the literal LADDER / CLIMB numbers: cut < ${b0.cutFps}, aim ${b0.aimFps}, restore > ${b0.restoreFps}, cruising ${b0.cruisingFps}, back-off ${b0.backoffFps} fps, budget ${b0.budget.toFixed(2)} ms, plan ${b0.planBudget} ms`);
    check(Math.abs(b60.budget - b0.budget) < 1e-9 && Math.abs(b60.planBudget - PLAN_BUDGET_MS) < 1e-9 && b60.cruisingFps > b60.cutFps && b60.cruisingFps < 60, `hold 60 climbs on today's bands: budget ${b60.budget.toFixed(2)} ms (headroom ${(CLIMB.headroom * b60.budget).toFixed(2)}, back-off ${(CLIMB.backoff * b60.budget).toFixed(2)}), hop / plan ${b60.planBudget.toFixed(2)} ms, cruising ${b60.cruisingFps.toFixed(1)} fps; but cuts under ${b60.cutFps.toFixed(1)} fps (as now: ${b0.cutFps})`);
    for (const [n, b] of [['hold 90', b90], ['hold 120', b120]] as const) console.log(`  ${n}: GPU union budget ${b.planBudget.toFixed(2)} ms (climb under ${(CLIMB.headroom * b.budget).toFixed(2)}, step off over ${(CLIMB.backoff * b.budget).toFixed(2)}), cuts under ${b.cutFps.toFixed(1)} fps, cuts aim for ${b.aimFps.toFixed(1)}`);
    check(b12060.target === 60 && Math.abs(b12060.budget - b60.budget) < 1e-9, `hold 120 on a display seen at 60 Hz = hold 60 (target ${b12060.target})`);
    check(bd.target === 144 && ladderBands(AIM_DISPLAY, 0).target === 60 && ladderBands(120, 0).target === 60, `hold display = the rate seen (144 on a 144 Hz display); until the first frames have said, every aim is 60`);
    check(ladderBands(60, 29).target === 60 && ladderBands(120, 29).target === 60 && ladderBands(AIM_DISPLAY, 40).target === 60 && ladderBands(120, 90).target === 90, `a rate seen under 60 never lowers an aim (a slow machine's own frame rate is not its display): hold 60 seen at 29 = ${ladderBands(60, 29).target}, hold 120 seen at 29 = ${ladderBands(120, 29).target}, seen at 90 = ${ladderBands(120, 90).target}`);
    check(displayRateOf(Array.from({ length: 60 }, (_, i) => [16, 17, 17][i % 3])) === 60 && displayRateOf(Array.from({ length: 60 }, (_, i) => i % 20 === 0 ? 25 : i % 20 === 1 ? 8.4 : 16.67)) === 60 && displayRateOf(Array.from({ length: 60 }, (_, i) => i > 20 && i < 32 ? 8.33 : 14)) === 120, `the display's rate off frame times: 16/17/17 ms timestamps read 60, one short catch-up frame after a long one does not read 120, a second of 8.33 ms frames does`);
    check(ladderAimOf('asnow') === 0 && ladderAimOf('0') === 0 && ladderAimOf('60') === 60 && ladderAimOf('90') === 90 && ladderAimOf('120') === 120 && ladderAimOf('display') === AIM_DISPLAY && ladderAimOf('75') === null && ladderAimOf('') === null, `?aim= words: asnow (or 0) 0 · 60 · 90 · 120 · display ${AIM_DISPLAY} · anything else refused`);
  }

  console.log('\nA GPU-bound machine on a 120 Hz variable-rate display (frame = union + 2.8 ms), pinned high with adaptive resolution:');
  { // (1) a fight that takes high from 11 ms to 17 ms of union: as now rides it out over 45 fps; hold 60 cuts and holds
    const load = (t: number) => at(t < 20 ? 11 : t < 80 ? 17 : 11);
    const a = mk(0, 120); const ra = run(a.q, a.E, 80, 120, load);
    const h = mk(60, 120); const rh = run(h.q, h.E, 80, 120, load);
    const fightA = ra.fps.slice(26, 78), fightH = rh.fps.slice(26, 78); const cutAt = rh.moves.find(m => /hold 60 ↓/.test(m));
    check(minOf(fightA) > 45 && minOf(fightA) < 56 && !ra.moves.some(m => /adaptive ↓/.test(m)), `as now: the fight runs at ${minOf(fightA).toFixed(0)}‥${Math.max(...fightA).toFixed(0)} fps and nothing below the tier's start is cut (over 45 fps is fine by it); moves: ${ra.moves.map(m => m.split(' (')[0]).join(' | ') || 'none'}`);
    check(!!cutAt && parseFloat(cutAt) < 24.5 && minOf(fightH) >= HOLD.cut * 60 - 0.5, `hold 60: cut within ${cutAt ? (parseFloat(cutAt) - 20).toFixed(1) : '?'} s of the fight starting, then ${minOf(fightH).toFixed(0)}‥${Math.max(...fightH).toFixed(0)} fps to its end at ×${h.E.settings.renderScale.toFixed(2)} — ${rh.moves.map(m => m.split(' (')[0]).join(' | ')}`);
    const n0 = rh.moves.length; const rh2 = run(h.q, h.E, 120, 120, load, { t0: 80 });
    check(h.E.settings.renderScale >= PRESETS.high.scale - 1e-6 && minOf(rh2.fps.slice(4)) >= HOLD.cut * 60 - 0.5, `the fight over: the pixels come back on measured headroom — ×${h.E.settings.renderScale.toFixed(2)} after two minutes, never under ${minOf(rh2.fps.slice(4)).toFixed(0)} fps on the way (${rh2.moves.length} moves: ${rh2.moves.map(m => m.split(' (')[0]).join(' | ')})`);
    void n0;
    // (2) steady load: no oscillation
    const s = mk(60, 120); const rs = run(s.q, s.E, 300, 120, () => at(15.5)); const late = rs.moves.filter(m => parseFloat(m) > 30);
    check(minOf(rs.fps.slice(8)) >= HOLD.cut * 60 - 0.5 && late.length <= 6, `steady load (15.5 ms at the tier's start) for five minutes: settles at ×${s.E.settings.renderScale.toFixed(2)}, ${minOf(rs.fps.slice(8)).toFixed(0)}‥${Math.max(...rs.fps.slice(8)).toFixed(0)} fps, ${late.length} moves after the first 30 s (${late.map(m => m.split(' (')[0]).join(' | ') || 'none'})`);
  }

  console.log('\nHold 90 and hold 120 under auto on the same machine (the preset may move):');
  for (const aim of [90, 120]) {
    const h = mk(aim, 120, true); const r = run(h.q, h.E, 120, 120, () => at(11)); const tail = r.fps.slice(40);
    check(minOf(tail) >= HOLD.cut * aim - 1 || (h.q.current === 'verylow' && h.E.settings.renderScale <= SCALE_FLOOR + 0.01), `hold ${aim}, 11 ms at high's start: after 40 s ${h.q.current} ×${h.E.settings.renderScale.toFixed(2)} (${rowsOf(stateOf(h.q, h.E), w).toFixed(0)} rows) at ${minOf(tail).toFixed(0)}‥${Math.max(...tail).toFixed(0)} fps — ${r.moves.map(m => m.split(' (')[0]).join(' | ')}`);
    const late = r.moves.filter(m => parseFloat(m) > 60); check(late.length <= 4, `… and it stays put: ${late.length} moves in the second minute (${late.map(m => m.split(' (')[0]).join(' | ') || 'none'})`);
  }

  console.log('\nWhat an aim must NOT do:');
  { const h = mk(120, 60); const r = run(h.q, h.E, 60, 60, () => at(9), { vrr: false });
    check(h.E.settings.renderScale >= PRESETS.high.scale - 1e-6 && !r.moves.some(m => /↓/.test(m)), `hold 120 on a 60 Hz display with 9 ms of GPU work: no cut (×${h.E.settings.renderScale.toFixed(2)}; it holds 60 — ${r.moves.map(m => m.split(' (')[0]).join(' | ') || 'no moves'})`);
    const p = mk(60, 60); const rp = run(p.q, p.E, 30, 60, () => at(5), { paceMs: 33.3 });
    check(p.E.settings.renderScale >= PRESETS.high.scale - 1e-6 && rp.moves.some(m => /frame pacing/.test(m)), `hold 60, a page paced to 30 fps with the GPU 5 ms busy: resolution left alone (×${p.E.settings.renderScale.toFixed(2)}) — “${rp.moves.find(m => /pacing/.test(m))?.replace(/^\S+ s /, '')}”`);
    const v = mk(60, 60); const rv = run(v.q, v.E, 40, 60, () => at(16), { vrr: false });
    check(v.E.settings.renderScale < PRESETS.high.scale - 1e-6 && minOf(rv.fps.slice(10)) >= 59, `hold 60 on a fixed 60 Hz display missing its vsync (16 ms of GPU work shows as 30‥45 fps): that IS load — cut to ×${v.E.settings.renderScale.toFixed(2)}, ${minOf(rv.fps.slice(10)).toFixed(0)} fps from 10 s on`);
    const b = mk(60, 120); const rb = run(b.q, b.E, 60, 120, () => at(17), { timed: false });
    check(b.E.settings.renderScale < PRESETS.high.scale - 1e-6 && minOf(rb.fps.slice(17)) >= HOLD.cut * 60 - 0.5 && rb.moves.length <= 3, `hold 60 with no GPU timings: cuts on the rate alone, tries one step back blind, takes it off again and holds it off (×${b.E.settings.renderScale.toFixed(2)}, ${minOf(rb.fps.slice(17)).toFixed(0)} fps from 17 s on — ${rb.moves.map(m => m.split(' (')[0]).join(' | ')})`);
    // the display seen at 120 earlier, the window now on a 60 Hz one (nothing pinned: the page has to find out)
    const mv = mk(120, 0, true); mv.q.displayHz = 120; const rmv = run(mv.q, mv.E, 150, 60, () => at(9), { vrr: false }); const told = rmv.moves.find(m => /shows no more/.test(m));
    check(!!told && parseFloat(told) < 40 && mv.q.displayHz === 60 && mv.q.current === 'high' && mv.E.settings.renderScale >= PRESETS.high.scale - 1e-6, `hold 120, seen at 120 Hz then moved to a 60 Hz display (9 ms of GPU work): cut as 120 would need, then at ${told ? parseFloat(told).toFixed(0) : '?'} s “${told?.replace(/^\S+ s /, '').split(' — ')[1] ?? ''}”, back at ${mv.q.current} ×${mv.E.settings.renderScale.toFixed(2)} by the end (lowest: ${rmv.moves.filter(m => /↓/.test(m)).map(m => (/(scale \d\.\d+|auto ↓ \w+)/.exec(m) ?? [''])[0]).join(', ')})`);
    // the CPU holds every frame to 19 ms with the GPU inside its budget; one long hitch a second
    const cp = mk(60, 120); const rcp = run(cp.q, cp.E, 30, 120, () => at(10.5), { paceMs: 19 });
    check(cp.E.settings.renderScale >= PRESETS.high.scale - 1e-6, `hold 60, the CPU pinning frames at 19 ms (53 fps) with 10.5 ms of GPU work: no pixels given up for nothing (×${cp.E.settings.renderScale.toFixed(2)}; ${rcp.moves.length} notes)`);
    const hi = mk(60, 60); let n = 0; const rhi = run(hi.q, hi.E, 30, 60, () => at(10.5), { vrr: false, hitch: () => (++n % 60 === 0 ? 60 : 0) });
    check(hi.E.settings.renderScale >= PRESETS.high.scale - 1e-6 && !rhi.moves.some(m => /↓/.test(m)), `hold 60 on a 60 Hz display, one 60 ms hitch a second: not a frame rate — nothing cut (×${hi.E.settings.renderScale.toFixed(2)})`);
    const pin = mk(120, 120); const rpin = run(pin.q, pin.E, 60, 120, () => at(14));
    check(pin.q.current === 'high' && Math.abs(pin.E.settings.renderScale - SCALE_FLOOR) < 1e-6, `hold 120 on a preset pinned from the menu that cannot make it: the scale stops at the floor ×${pin.E.settings.renderScale.toFixed(2)}, the preset is the player's (${pin.q.current}; ${rpin.fps[rpin.fps.length - 1].toFixed(0)} fps)`);
  }
  console.log('\nAs now, on a page something else paces (settings.ladderPaced; the maintainer\'s Mac 10-10: 30 fps shown, ×0.57 then ×0.50, GPU union 8.9 ms):');
  { const mkP = (on: boolean, auto = true, scale?: number) => mkQuality(w, 'high', auto, scale === undefined ? { ladderClimb: true, ladderPaced: on } : { ladderClimb: true, ladderPaced: on, renderScale: scale }, 0, 120);
    const words = (m: string[]) => m.map(x => x.split(' (')[0]).join(' | ') || 'none'; const sc = (x: { E: any }) => x.E.settings.renderScale as number;
    // (1) THE FAULT, with the check off: 30 fps by pacing, 12.6 ms of union at high's start → ×0.57 (= 0.77 − 0.20: the one scale the as-now cut reaches off the 0.05 grid), kept; a heavier spell → the floor and a preset down, kept
    const o = mkP(false); const ro = run(o.q, o.E, 40, 120, () => at(12.6), { paceMs: 33.33 }); const s1 = sc(o);
    const ro2 = run(o.q, o.E, 80, 120, t => at(t < 50 ? 16.5 : 12.6), { paceMs: 33.33, t0: 40 });
    check(Math.abs(s1 - 0.57) < 1e-6 && minOf(ro.fps) > 29 && Math.max(...ro.fps.slice(4)) < 31 && sc(o) <= 0.57 + 1e-6 && Math.max(...ro2.fps) < 31, `the check OFF (the rule as it was): cut to ×${s1.toFixed(2)} for nothing (30 fps before and after) and kept; ten heavier seconds take the rest and the preset (${o.q.current} ×${sc(o).toFixed(2)}, still 30 fps), never given back in two minutes — ${words([...ro.moves, ...ro2.moves].filter(m => /↓|↑/.test(m)))}`);
    // (2) the same page with the check on: the one cut is judged and taken back; the heavier spell cuts nothing
    const n = mkP(true); const rn = run(n.q, n.E, 40, 120, () => at(12.6), { paceMs: 33.33 }); const back = rn.moves.find(m => /paced ↑/.test(m)); const sn1 = sc(n);
    const rn2 = run(n.q, n.E, 80, 120, t => at(t < 50 ? 16.5 : 12.6), { paceMs: 33.33, t0: 40 });
    check(!!back && parseFloat(back) < 12 && Math.abs(sn1 - PRESETS.high.scale) < 1e-6 && Math.abs(sc(n) - PRESETS.high.scale) < 1e-6 && n.q.current === 'high' && !rn2.moves.some(m => /↓/.test(m)), `the check ON: the cut is taken back at ${back ? parseFloat(back).toFixed(0) : '?'} s (“${back?.replace(/^\S+ s /, '').split(' (')[1]?.replace(/\)$/, '') ?? ''}”), ×${sc(n).toFixed(2)} from there through the heavier spell — ${words(rn.moves.filter(m => /↓|↑/.test(m)))}`);
    // (3) a scale already at the floor when the pacing is met (a fight before it): given back as far as the page stays PROVEN paced (12.6 ms at high's start: ×0.55 — 10 ms of union in a 33 ms frame), no further
    const f = mkP(true, true, SCALE_FLOOR); const rf = run(f.q, f.E, 40, 120, () => at(12.6), { paceMs: 33.33 }); const up = rf.moves.find(m => /paced ↑/.test(m));
    check(sc(f) > SCALE_FLOOR + 1e-6 && sc(f) < PRESETS.high.scale - 1e-6 && !!up && parseFloat(up) < 12 && !rf.moves.some(m => /↓/.test(m)), `starting at the floor on that page: ×${sc(f).toFixed(2)} by ${up ? parseFloat(up).toFixed(0) : '?'} s — what stays provably free, and held there (${words(rf.moves.filter(m => /↓|↑/.test(m)))})`);
    const fl = mkP(true, true, SCALE_FLOOR); run(fl.q, fl.E, 40, 120, () => at(8), { paceMs: 33.33 });
    check(Math.abs(sc(fl) - PRESETS.high.scale) < 1e-6, `… and with a lighter scene (8 ms at high's start) all the way: ×${sc(fl).toFixed(2)}`);
    const f0 = mkP(false, true, SCALE_FLOOR); run(f0.q, f0.E, 40, 120, () => at(12.6), { paceMs: 33.33 });
    check(Math.abs(sc(f0) - SCALE_FLOOR) < 1e-6, `… where the check off leaves it at ×${sc(f0).toFixed(2)} for good (the way up wants 58 fps)`);
    // (4) what it must NOT change: real load — the same moves with the check on and off
    const same = (name: string, secs: number, hz: number, k: (t: number) => number, opts: Parameters<typeof run>[5], auto = true) => {
      const a = mkP(true, auto), b = mkP(false, auto); const ra = run(a.q, a.E, secs, hz, k, opts), rb = run(b.q, b.E, secs, hz, k, opts);
      const eq = JSON.stringify(ra.moves) === JSON.stringify(rb.moves) && sc(a) === sc(b) && a.q.current === b.q.current;
      check(eq && ra.moves.some(m => /↓/.test(m)), `${name}: cut all the same, move for move with the check off (${ra.moves.filter(m => /↓|↑/.test(m)).length} moves, ends ${a.q.current} ×${sc(a).toFixed(2)})`);
    };
    same('a fixed 60 Hz display missing its vsync (14 ms of union shows as 30 fps)', 60, 60, () => at(14), { vrr: false });
    same('a GPU-bound fight on a 120 Hz display (24 ms of union, 37 fps)', 60, 120, t => at(t < 10 ? 11 : 24), {});
    same('a machine too slow for high (30 ms of union): down the presets', 90, 120, () => at(30), {});
    same('paced at 30 with 28 ms of union at high\'s start (the frame is nearly all GPU work: nothing to take back)', 120, 120, () => at(28), { paceMs: 33.33 });
    { const mk2 = (on: boolean) => { const x = mkP(on); const r = run(x.q, x.E, 300, 60, () => at(16), { vrr: false, paceMs: (t: number) => t >= 120 && t < 180 ? 33.33 : 0 }); return { x, r }; }; const a = mk2(true), b = mk2(false);
      const s60 = (r: { fps: number[] }, from: number, to: number) => r.fps.slice(from, to).filter(v => v > 57).length / Math.max(1, Math.min(to, r.fps.length) - from);
      check(a.x.q.current === 'high' && s60(a.r, 185, 300) >= s60(a.r, 30, 120) - 0.1 && b.x.q.current !== 'high', `a fixed 60 Hz display that settled under high's start (16 ms there), a minute paced to 30, then free: the page is back where it was before the spell (${a.x.q.current}, at 60 fps ${(100 * s60(a.r, 185, 300)).toFixed(0)} % of the time after, ${(100 * s60(a.r, 30, 120)).toFixed(0)} % before), no scale raised it cannot carry — the check off loses the preset to the spell for good (${b.x.q.current})`); }
    // (5) paced at 30, then load that really is slower than the pace: cut
    const l = mkP(true); const rl = run(l.q, l.E, 60, 120, t => at(t < 20 ? 12.6 : 40), { paceMs: 33.33 }); const cut = rl.moves.find(m => parseFloat(m) > 20 && /adaptive ↓|auto ↓/.test(m));
    check(!!cut && parseFloat(cut) < 26, `paced at 30, then 40 ms of union arrives at 20 s: that is load — cut at ${cut ? parseFloat(cut).toFixed(0) : '?'} s (ends ${l.q.current} ×${sc(l).toFixed(2)}, ${rl.fps[rl.fps.length - 1].toFixed(0)} fps)`);
    // (6) the pacing lifts: the ladder is the ladder again (climbs on the room it sees)
    const e = mkP(true); const re = run(e.q, e.E, 90, 120, () => at(9), { paceMs: t => t < 30 ? 33.33 : 0 });
    check(sc(e) > PRESETS.high.scale + 1e-6 && !re.moves.some(m => /↓/.test(m)), `paced for 30 s with 9 ms of union, then free: nothing cut, and the climb takes its steps once the frames come (×${sc(e).toFixed(2)})`);
    // (8) the review's cases
    let hn = 0; const hi2 = mkP(true); const rh = run(hi2.q, hi2.E, 120, 120, () => at(12.6), { paceMs: 33.33, hitch: () => (++hn % 30 === 0 ? 60 : 0) }); const stepsH = rh.moves.filter(m => /↓|↑/.test(m));
    check(Math.abs(sc(hi2) - PRESETS.high.scale) < 1e-6 && stepsH.length <= 2, `that page with a 90 ms hitch every second: the one judged cut and no more in two minutes (${stepsH.length} steps, ×${sc(hi2).toFixed(2)})`);
    const hv = mkP(true); const rv = run(hv.q, hv.E, 60, 120, () => at(14.5), { paceMs: 33.33 });
    check(Math.abs(sc(hv) - PRESETS.high.scale) < 1e-6 && hv.q.current === 'high', `a heavier scene on it (14.5 ms at high's start, 10.6 after the cut — under the old floor, short of proof): taken back all the same (×${sc(hv).toFixed(2)}; ${words(rv.moves.filter(m => /↓|↑/.test(m)))})`);
    const hp = mkP(true); const rp = run(hp.q, hp.E, 90, 120, () => at(17), { paceMs: 33.33 });
    check(Math.abs(sc(hp) - PRESETS.high.scale) < 1e-6 && hp.q.current === 'high' && rp.moves.some(m => /auto ↓/.test(m)), `heavier still under auto (17 ms: the cuts run into a preset down): the preset comes back with the scale (${hp.q.current} ×${sc(hp).toFixed(2)}; ${words(rp.moves.filter(m => /↓|↑/.test(m)))})`);
    const ao = mkP(true); ao.q.adaptive = false; const rao = run(ao.q, ao.E, 60, 120, () => at(12.6), { paceMs: 33.33 });
    check(ao.q.current === 'high', `adaptive resolution off, auto on: the preset is not starved away for good either (${ao.q.current}; ${words(rao.moves.filter(m => /↓|↑/.test(m)))})`);
    const fx = mkP(true, false), fx0 = mkP(false, false); const kfx = () => at(15), ofx = { vrr: false, paceMs: (t: number) => t < 30 ? 33.33 : 0 };
    const rfx = run(fx.q, fx.E, 400, 60, kfx, ofx), rfx0 = run(fx0.q, fx0.E, 400, 60, kfx, ofx); const t60 = rfx.fps.findIndex((x, i) => i > 30 && x > 57), t600 = rfx0.fps.findIndex((x, i) => i > 30 && x > 57);
    const share = (r: { fps: number[] }, from: number) => r.fps.slice(from).filter(x => x > 57).length / Math.max(1, r.fps.length - from);
    check(t60 > 0 && t60 < 30 + PACED.recheckSecs + 15 && share(rfx, 150) >= share(rfx0, 150) - 0.1, `a fixed 60 Hz display, paced to 30 for half a minute, then free with 15 ms of union missing its vsync at that same 30: the remembered pace is put to the test again — 60 fps from ${t60} s (the check off: from ${t600} s)`);
    // (7) an aim is untouched by the switch
    const h1 = mkQuality(w, 'high', true, { ladderClimb: true, ladderPaced: true }, 60, 120), h0 = mkQuality(w, 'high', true, { ladderClimb: true, ladderPaced: false }, 60, 120);
    const r1 = run(h1.q, h1.E, 60, 120, t => at(t < 20 ? 11 : 17), { paceMs: t => t > 40 ? 33.33 : 0 }), r0 = run(h0.q, h0.E, 60, 120, t => at(t < 20 ? 11 : 17), { paceMs: t => t > 40 ? 33.33 : 0 });
    check(JSON.stringify(r1.moves) === JSON.stringify(r0.moves), `hold 60 makes the same ${r1.moves.length} moves with the switch on and off (it has its own paced rule)`);
  }
  console.log('\nHold 60 as the default (settings.ladderAim 60 since 10-10): a slow machine, and a page something else paces:');
  {
    // (1) a machine too slow for High whose page has never shown more than 29 fps (the watched 'display rate' = its own load): the aim stays 60 and the ladder cuts, then drops the preset under auto
    const s = mk(60, 120, true); (s.q as any).displayHzPin = 0; (s.q as any).displayHz = 29; const rs = run(s.q, s.E, 40, 120, () => at(31));
    const a = mk(0, 120, true); const ra = run(a.q, a.E, 40, 120, () => at(31));
    check(s.q.aimState.target === 60 && rs.moves.some(m => /↓/.test(m)) && rs.fps[rs.fps.length - 1] >= ra.fps[ra.fps.length - 1] - 1 && rs.fps[rs.fps.length - 1] > rs.fps[0] + 5, `a page never seen over 29 fps, 31 ms of union at high's start: hold 60 still aims at ${s.q.aimState.target} and cuts — ${rs.fps[0].toFixed(0)} → ${rs.fps[rs.fps.length - 1].toFixed(0)} fps at ${s.q.current} ×${sc(s).toFixed(2)} (as now: ${ra.fps[ra.fps.length - 1].toFixed(0)} fps at ${a.q.current} ×${sc(a).toFixed(2)})`);
    // (2) a page paced to 30 fps (the browser's energy saver), 11 ms of union at high's start: nothing is cut for the pacing; a heavy spell (17 ms) is cut as load; and once it is over the pixels come back while the page is STILL at 30
    const p = mkQuality(w, 'high', false, { ladderClimb: true, ladderHeld: false }, 60, 120); const r1 = run(p.q, p.E, 20, 120, () => at(11), { paceMs: 33.33 }); const s1 = sc(p);   // (ladderHeld off: an aim's own rule, as it was)
    const r2 = run(p.q, p.E, 20, 120, () => at(17), { paceMs: 33.33, t0: 20 }); const s2 = sc(p);
    const r3 = run(p.q, p.E, 200, 120, () => at(11), { paceMs: 33.33, t0: 40 }); const s3 = sc(p);
    check(Math.abs(s1 - PRESETS.high.scale) < 1e-6 && !r1.moves.some(m => /↓/.test(m)) && s2 < s1 - 0.04 && Math.abs(s3 - PRESETS.high.scale) < 1e-6 && Math.max(...r3.fps) < 31 && p.q.current === 'high', `hold 60 on a page paced to 30 fps: left at ×${s1.toFixed(2)} (11 ms of union); 20 s at 17 ms cut it to ×${s2.toFixed(2)}; back to ×${s3.toFixed(2)} afterwards with the page still at ${r3.fps[r3.fps.length - 1].toFixed(0)} fps — ${words([...r2.moves, ...r3.moves].filter(m => /↓|↑/.test(m)))}`);
  }
  console.log('\nHold 60 on a page something else holds (settings.ladderHeld; the maintainer\'s Mac on a low battery, 10-14: 30 fps shown at 600 rows with the GPU clocked down — 11.6 ms of union there, 13.9 at high\'s start):');
  {
    const ON = process.env.LADDERHELD_BREAK !== '1';   // LADDERHELD_BREAK=1: these cases run with the switch off and must FAIL
    const mkH = (on: boolean, o: { scale?: number; auto?: boolean; hz?: number } = {}) => mkQuality(w, 'high', !!o.auto, o.scale === undefined ? { ladderClimb: true, ladderHeld: on } : { ladderClimb: true, ladderHeld: on, renderScale: o.scale }, 60, o.hz ?? 120);
    /** `secs` a second at a time: the share of them that END at the tier's start or above, the moves, the fps windows, the share of windows at 58 fps or more */
    const watch = (x: { q: any; E: any }, secs: number, hz: number, k: (t: number) => number, o: { paceMs?: number | ((t: number) => number); vrr?: boolean; t0?: number } = {}) => { let at77 = 0, scSum = 0; const moves: string[] = [], fps: number[] = []; for (let t = 0; t < secs; t++) { const r = run(x.q, x.E, 1, hz, k, { ...o, t0: (o.t0 ?? 0) + t }); moves.push(...r.moves); fps.push(...r.fps); scSum += sc(x); if (sc(x) >= PRESETS.high.scale - 1e-6) at77++; } return { share: at77 / secs, scale: scSum / secs, moves, fps, at60: fps.filter(f => f >= 58).length / Math.max(1, fps.length), mean: fps.reduce((a, b) => a + b, 0) / Math.max(1, fps.length) }; };
    /** the same with the frame's own time past the union at `ms` (the machines above all run MODEL.overheadMs = 2.8; the proof's floor allows HOLD.pacedMs = 6) */
    const withOver = <T,>(ms: number, f: () => T): T => { const o0 = MODEL.overheadMs; MODEL.overheadMs = ms; try { return f(); } finally { MODEL.overheadMs = o0; } };
    // (1) held to 30 from the first frame, the clocked-down GPU reading 13.9 ms at high's start (over the 13.3 back-off band, inside the 15 ms budget): as it was, stepped down for the band and never back; now the band's steps and then a cut to where the union fits the proof's floor are judged together, taken back when the frame is no shorter there, and the pace holds
    const o1 = mkH(false), n1 = mkH(ON); const ro1 = watch(o1, 300, 120, () => at(13.9), { paceMs: 33.33 }), rn1 = watch(n1, 300, 120, () => at(13.9), { paceMs: 33.33 });
    check(sc(o1) < PRESETS.high.scale - 0.04 && ro1.share < 0.05 && !ro1.moves.some(m => /↑/.test(m)), `the switch off (an aim as it was): five minutes held at 30 fps end at ×${sc(o1).toFixed(2)}, ${(100 * ro1.share).toFixed(0)} % of them at the tier's start — ${words(ro1.moves.filter(m => /↓|↑/.test(m)))}`);
    check(Math.abs(sc(n1) - PRESETS.high.scale) < 1e-6 && rn1.share > 0.85 && rn1.moves.some(m => /paced ↑/.test(m)) && Math.max(...rn1.fps) < 31, `on: the same five minutes end at ×${sc(n1).toFixed(2)}, ${(100 * rn1.share).toFixed(0)} % of them at the tier's start (one cut to where the union fits, judged and taken back; the re-tests are the rest) — first moves: ${words(rn1.moves.filter(m => /↓|↑/.test(m)).slice(0, 4))}`);
    // (2) the hold lifts (the GPU back on its own clock: 13.9 → 9.3 ms): the pace is forgotten on the first fast window, nothing is cut, the frames come at the display's rate
    const rl = watch(n1, 30, 120, () => at(13.9 / 1.5), { t0: 300 });
    check(!rl.moves.some(m => /↓/.test(m)) && (n1.q as any).pacedAt === 0 && minOf(rl.fps.slice(2)) > 58, `the hold lifts: no cut, the pace forgotten, ${minOf(rl.fps.slice(2)).toFixed(0)} fps and up from there (×${sc(n1).toFixed(2)})`);
    // (3) a page that ARRIVES cut (×0.60, as the take of 10-14 stood) and held: as it was the band never reads low enough to give a step back; now one judged cut finds the pace and the pixels come back on the frame's own room, each step judged
    const o3 = mkH(false, { scale: 0.6 }), n3 = mkH(ON, { scale: 0.6 }); watch(o3, 300, 120, () => at(13.9), { paceMs: 33.33 }); const rn3 = watch(n3, 120, 120, () => at(13.9), { paceMs: 33.33 });
    check(sc(o3) < PRESETS.high.scale - 0.04 && Math.abs(sc(n3) - PRESETS.high.scale) < 1e-6 && Math.max(...rn3.fps) < 31, `arriving at ×0.60 on a held page: off, still ×${sc(o3).toFixed(2)} after five minutes; on, ×${sc(n3).toFixed(2)} inside two — ${words(rn3.moves.filter(m => /↓|↑/.test(m)))}`);
    // (4) a fight on a page whose pace is known (held at 30 for the 20 s before it; 23 ms at high's start on the clocked-down GPU = take 4's fight × 1.5): nothing is cut for it at all — as it was: the floor for as long as it lasts
    const o4 = mkH(false), n4 = mkH(ON); watch(o4, 20, 120, () => at(11), { paceMs: 33.33 }); const ro4 = watch(o4, 60, 120, () => at(23), { paceMs: 33.33, t0: 20 }); watch(n4, 20, 120, () => at(11), { paceMs: 33.33 }); const r4 = watch(n4, 60, 120, () => at(23), { paceMs: 33.33, t0: 20 });
    check(sc(o4) <= SCALE_FLOOR + 1e-6 && ro4.share < 0.1 && Math.abs(sc(n4) - PRESETS.high.scale) < 1e-6 && !r4.moves.some(m => /↓/.test(m)) && r4.share === 1 && Math.max(...r4.fps) < 31, `a minute's fight (23 ms) on a page held at 30 for the 20 s before it: off, cut to ×${sc(o4).toFixed(2)}; on, no cut (×${sc(n4).toFixed(2)} throughout; the frame stays 10 ms over its GPU work)`);
    // (5) NOT a held page: a fixed 60 Hz display whose 17 ms of union misses its vsync (33 ms frames, the same numbers from here) — the cut buys the frame rate back and is kept, move for move as with the switch off
    const o5 = mkH(false, { hz: 60 }), n5 = mkH(ON, { hz: 60 }); const ro5 = watch(o5, 60, 60, () => at(17), { vrr: false }), rn5 = watch(n5, 60, 60, () => at(17), { vrr: false });
    check(JSON.stringify(rn5.moves) === JSON.stringify(ro5.moves) && rn5.fps[rn5.fps.length - 1] > 59 && sc(n5) < PRESETS.high.scale - 0.04, `a fixed 60 Hz display missing its vsync at 17 ms of union: the cut is kept (×${sc(n5).toFixed(2)}, ${rn5.fps[rn5.fps.length - 1].toFixed(0)} fps), the same ${rn5.moves.length} moves as with the switch off`);
    // (6) load that really is slower than the pace arrives on the held page (40 ms of union: the frame is the GPU's work): cut, as as-now's check does
    const n6 = mkH(true); watch(n6, 30, 120, () => at(13.9), { paceMs: 33.33 }); const r6 = watch(n6, 20, 120, () => at(40), { paceMs: 33.33, t0: 30 }); const cut6 = r6.moves.find(m => /hold 60 ↓/.test(m));
    check(!!cut6 && parseFloat(cut6) < 36, `held at 30, then 40 ms of union arrives at 30 s: that is load — cut at ${cut6 ? parseFloat(cut6).toFixed(0) : '?'} s (×${sc(n6).toFixed(2)})`);
    // (8) the re-test is a test: the pace of case (1) is dropped at PACED.recheckSecs and the judged cut is taken again (not re-learnt in the same window from numbers that prove nothing)
    check(rn1.moves.filter(m => /paced ↑/.test(m)).length >= 2 && rn1.moves.filter(m => /held page or a missed vsync/.test(m)).length >= 2, `the re-test of a remembered pace is a judged cut again: ${rn1.moves.filter(m => /paced ↑/.test(m)).length} take-backs in case (1)'s five minutes`);
    // (9) a take-back gives the failed-rung marks back with the pixels: after the re-tests of a held page whose cuts go by rate, the tier's start is not held off
    { const x = mkH(ON); watch(x, 900, 120, () => at(15.4), { paceMs: 33.33 }); const key = `scale:${PRESETS.high.scale.toFixed(2)}`; const fc = (x.q as any).failCount.get(key) ?? 0;
      check(Math.abs(sc(x) - PRESETS.high.scale) < 1e-6 && fc === 0 && !(x.q as any).failed.has(key), `fifteen minutes held with 15.4 ms at high's start (every re-test a cut by rate, taken back): ×${sc(x).toFixed(2)}, the tier's start not marked as a failed rung (count ${fc})`); }
    // (10) NOT held, off the 2.8 ms the other machines run: fixed 60 Hz displays whose frame runs 4.5 ms past its union, variable-rate ones 7 and 8 ms past it — on never shows fewer seconds at 58 fps, nor a lower mean
    for (const [name, over, hz, vrr, load] of [['a fixed 60 Hz display, 4.5 ms past the union, 10 → 19 → 15 ms', 4.5, 60, false, (t: number) => at(t < 20 ? 10 : t < 80 ? 19 : 15)], ['a fixed 60 Hz display, 4.5 ms past the union, a steady 12.8 ms (its vsync missed by a hair)', 4.5, 60, false, () => at(12.8)], ['a variable-rate 120 Hz display, 8 ms past the union, 16 ms', 8, 120, true, () => at(16)], ['a variable-rate 120 Hz display, 7 ms past the union, 12 ms', 7, 120, true, () => at(12)]] as const) {
      const o = mkH(false, { hz }), n = mkH(ON, { hz }); const ro = withOver(over, () => watch(o, 400, hz, load, { vrr })), rn = withOver(over, () => watch(n, 400, hz, load, { vrr }));
      check(rn.at60 >= ro.at60 - 0.02 && rn.mean >= ro.mean - 0.5, `${name}: at 58 fps or more ${(100 * ro.at60).toFixed(0)} % → ${(100 * rn.at60).toFixed(0)} % of 400 s, mean ${ro.mean.toFixed(1)} → ${rn.mean.toFixed(1)} fps (×${sc(o).toFixed(2)} → ×${sc(n).toFixed(2)})`);
    }
    // (11) auto on the held page: no preset is given up for the hold (as it was: the fight starves high away)
    { const o = mkH(false, { auto: true }), n = mkH(ON, { auto: true }); const k = (t: number) => at(t < 20 ? 11 : t < 80 ? 23 : 11); const ro = watch(o, 140, 120, k, { paceMs: 33.33 }), rn = watch(n, 140, 120, k, { paceMs: 33.33 });
      check(n.q.current === 'high' && !rn.moves.some(m => /auto ↓/.test(m)) && rn.share > 0.9, `auto on the held page through a minute's fight: stays high, at the tier's start ${(100 * rn.share).toFixed(0)} % of the time (off: ${o.q.current} ×${sc(o).toFixed(2)}, ${(100 * ro.share).toFixed(0)} %${ro.moves.some(m => /auto ↓/.test(m)) ? ', a preset given up' : ''})`); }
    // (12) a judged cut that tells nothing (a held page whose GPU time does not follow the pixels: 13 ms whatever the scale, so the cut never lands under the floor): the pixels go back at the end of its trial, no pace is learnt, and the next one is held off
    { const x = mkH(ON); const r = watch(x, 300, 120, () => 13 / modelCost(stateOf(x.q, x.E), w, S0), { paceMs: 33.33 }); const told = r.moves.filter(m => /told nothing/.test(m)).length;
      check(Math.abs(sc(x) - PRESETS.high.scale) < 1e-6 && r.share > 0.85 && told >= 1 && told <= 3 && (x.q as any).pacedAt === 0, `a cut that cannot land under the floor (13 ms at any scale): put back ${told} time${told === 1 ? '' : 's'} in five minutes with no pace learnt, ${(100 * r.share).toFixed(0)} % of them at the tier's start`); }
    // (13) NOT held, the union over the back-off band: a fixed 60 Hz display missing its vsync at 14.2 ms — the band's own steps bring it back as ever; the judged cut waits for them (it would go to the proof's floor and stay there)
    { const off = mkH(false, { hz: 60 }), on = mkH(true, { hz: 60 }); const a = watch(off, 300, 60, () => at(14.2), { vrr: false }), b = watch(on, 300, 60, () => at(14.2), { vrr: false });
      check(words(a.moves) === words(b.moves) && Math.abs(sc(off) - sc(on)) < 1e-6 && sc(on) >= 0.7 - 1e-6, `a fixed 60 Hz display nothing holds, 14.2 ms at high's start (over the band, its vsync missed): the band's steps, the same ${b.moves.length} moves off and on (×${sc(on).toFixed(2)}, ${b.mean.toFixed(0)} fps)`); }
    // (14) held, and the cost model wrong about this machine (35 % of its GPU time follows the pixels, the model says 60): the judged cut lands short of the floor — put back, held off, no cut / step up / cut loop
    { const real = (x: { E: any }) => 13.7 * (0.65 + 0.35 * (sc(x) / PRESETS.high.scale) ** 2); const one = (on: boolean) => { const x = mkH(on); const r = watch(x, 900, 120, () => real(x) / modelCost(stateOf(x.q, x.E), w, S0), { paceMs: 33.33 }); return { r, downs: r.moves.filter(m => /↓/.test(m)).length }; };
      const off = one(false), on = one(ON);
      check(on.downs <= 20 && on.r.scale >= off.r.scale - 0.02, `held at 30 with 13.7 ms that follows the pixels less than the model says: ${on.downs} steps down in fifteen minutes (${off.downs} with the switch off), mean ×${on.r.scale.toFixed(3)} against ×${off.r.scale.toFixed(3)}`); }
    // (15) NOT held: a fixed 60 Hz display, 5.5 ms past the union, 12.5 ms — the judged cut buys its 60 back and the level it left is a failed rung (no cut / climb back / cut every twenty seconds)
    { const one = (on: boolean) => withOver(5.5, () => { const x = mkH(on, { hz: 60 }); const r = watch(x, 600, 60, () => at(12.5), { vrr: false }); return { r, downs: r.moves.filter(m => /↓/.test(m)).length }; }); const off = one(false), on = one(ON);
      check(on.downs <= 6 && on.r.at60 >= 0.9 && on.r.at60 >= off.r.at60, `a fixed 60 Hz display, 5.5 ms past the union, 12.5 ms: at 58 fps or more ${(100 * off.r.at60).toFixed(0)} % → ${(100 * on.r.at60).toFixed(0)} % of ten minutes, ${on.downs} cuts (the level each left held off, doubling)`); }
    // (16) NOT held: the CPU is the limit and its frame wobbles (25 ms ± 8 % a second, 12.1 ms of union on a variable-rate display) — the judged cut is no more frequent than the re-test and the wobble is not read as a cut that helped
    { const wob = (t: number) => { const v = Math.sin((t + 1) * 12.9898) * 43758.5453; return v - Math.floor(v); }; const x = mkH(ON); const r = watch(x, 900, 120, () => at(12.1), { vrr: true, paceMs: t => 25 * (0.92 + 0.16 * wob(Math.floor(t))) }); const downs = r.moves.filter(m => /↓/.test(m)).length;
      check(downs <= 5 && r.share >= 0.95 && Math.abs(sc(x) - PRESETS.high.scale) < 1e-6, `the CPU the limit, 25 ms ± 8 % a second: ${downs} judged cuts in fifteen minutes, ${(100 * r.share).toFixed(0)} % of them at the tier's start (×${sc(x).toFixed(2)})`); }
    // (7) a GPU-bound machine nothing holds: the switch changes no move (the fight of the first block: 11 → 17 → 11 ms on a 120 Hz variable-rate display)
    const load = (t: number) => at(t < 20 ? 11 : t < 80 ? 17 : 11); const o7 = mkH(false), n7 = mkH(true); const ro7 = watch(o7, 200, 120, load), rn7 = watch(n7, 200, 120, load);
    check(JSON.stringify(rn7.moves) === JSON.stringify(ro7.moves) && rn7.moves.length > 0, `nothing holding the page (a fight on a GPU-bound machine): the same ${rn7.moves.length} moves with the switch on and off`);
  }
  console.log('\nOne light-cache grid at every preset (settings.oneCacheGrid: the light meter reads the cache, so its probe grid is part of what a guard sees):');
  {
    const ON = process.env.ONEGRID_BREAK !== '1';   // ONEGRID_BREAK=1: the walk runs with the switch off and the first three must FAIL
    const walk = (on: boolean) => {
      store.clear(); const E = mkEngine(w, { oneCacheGrid: on }); const grid = () => `${E.rc.cfg.nx}x${E.rc.cfg.ny}x${E.rc.cfg.nz}`;
      let rebuilds = 0; const real = E.rebuildRc; E.rebuildRc = function (cfg: any) { rebuilds++; real.call(this, cfg); };
      const parked = new Set<string>(); E.prewarmRc = (cfgs: any[]) => { for (const c of cfgs) parked.add(`${c.nx}x${c.ny}x${c.nz}`); };
      const q: any = new Quality(E as never, { params: { rbIters: 4 } } as never); const seen: Record<string, string> = {};
      for (const n of [...QUALITY_NAMES, ...[...QUALITY_NAMES].reverse()]) { q.apply(n); seen[n] = grid(); }   // (ultra down to verylow and back up: every step the ladder or a menu can take)
      return { seen, rebuilds, parked: [...parked] };
    };
    const on = walk(ON), off = walk(false), fine = '40x4x28', coarse = '32x3x22';
    check(QUALITY_NAMES.every(n => on.seen[n] === fine), `every preset reads the one grid: ${QUALITY_NAMES.map(n => `${n} ${on.seen[n]}`).join(' · ')}`);
    check(on.rebuilds === 0, `the cache is not rebuilt on any step from ultra down to verylow and back: ${on.rebuilds} rebuilds`);
    check(on.parked.length === 1 && on.parked[0] === fine, `the boot parks no second grid: ${on.parked.join(', ')}`);
    check(off.seen.low === coarse && off.seen.verylow === coarse && off.seen.ultra === fine && off.seen.high === fine && off.seen.medium === fine && off.rebuilds === 2 && off.parked.length === 2,
      `the switch off = the grids as they were: ${QUALITY_NAMES.map(n => `${n} ${off.seen[n]}`).join(' · ')}, ${off.rebuilds} rebuilds on the walk, ${off.parked.length} grids parked`);
    // the ladder prices the grid that runs: a 4.5 × machine's boot pick (61.1 ms at high, 25.0 of it fixed, 1440 × 900 at 2) on the ladder's own tables, and a live Quality's hop price
    const pick = (one: boolean) => { const r = plan(61.1, 25.0, 'high', 0.43, 900, 2, PLAN_BUDGET_MS, true, one); return `${r.preset} ×${r.scale.toFixed(2)}`; };
    const hop = (one: boolean) => { const x = mkQuality(w, 'low', true, { oneCacheGrid: one }, 60, 120); return x.q.hopRatio('medium') as number; };
    check(pick(false) === 'low ×0.50' && pick(ON) === 'verylow ×0.50' && hop(false) > hop(ON) + 0.1,
      `the ladder prices the grid that runs: a 4.5 × machine boots at ${pick(false)} with the switch off (as it was) and ${pick(ON)} with it on; low → medium priced ×${hop(false).toFixed(2)} off, ×${hop(ON).toFixed(2)} on`);
  }
  console.log('\nOne smoke pressure solve at every preset (settings.oneSmokeSolve: a sight line reads the solver\'s density, so its pairs are part of what smoke hides):');
  {
    const ON = process.env.ONESOLVE_BREAK !== '1';   // ONESOLVE_BREAK=1: the walk runs with the switch off and the first line must FAIL
    const walk = (on: boolean | undefined) => {
      store.clear(); const E = mkEngine(w, on === undefined ? {} : { oneSmokeSolve: on }); const sm = { params: { rbIters: 0 } }; if (on === undefined) delete E.settings.oneSmokeSolve;
      const q: any = new Quality(E as never, sm as never); const seen: Record<string, number> = {};
      for (const n of [...QUALITY_NAMES, ...[...QUALITY_NAMES].reverse()]) { q.apply(n); seen[n] = sm.params.rbIters; }
      return seen;
    };
    const on = walk(ON), off = walk(false), bare = walk(undefined), H = PRESETS.high.rbIters;
    check(QUALITY_NAMES.every(n => on[n] === H), `every preset solves with high's ${H} pairs: ${QUALITY_NAMES.map(n => `${n} ${on[n]}`).join(' · ')}`);
    check(QUALITY_NAMES.every(n => off[n] === PRESETS[n].rbIters) && off.ultra !== off.medium, `the switch off = the rows as they were: ${QUALITY_NAMES.map(n => `${n} ${off[n]}`).join(' · ')}`);
    check(QUALITY_NAMES.every(n => bare[n] === H), 'a settings object with no such key (a tool\'s mock) solves as the page does');
  }
  console.log('\nThe floor rung sheds an open fire\'s smoke (settings.fireSmokeShed: the solver need not stay awake for a brazier on verylow; every rung above keeps it):');
  {
    const ON = process.env.FIRESHED_BREAK !== '1';   // FIRESHED_BREAK=1: the walks run with the switch off and the first two lines must FAIL
    /** the presets of `path` put on in turn, by hand (auto off) or as the ladder does (auto on): what settings.fireSmoke says after each */
    const walk = (on: boolean | undefined, auto: boolean, path: QualityName[]) => {
      store.clear(); const E = mkEngine(w, on === undefined ? {} : { fireSmokeShed: on }); if (on === undefined) { delete E.settings.fireSmokeShed; delete E.settings.fireSmoke; }
      const q: any = new Quality(E as never, { params: { rbIters: 0 } } as never); q.auto = auto; if (on !== undefined) E.settings.fireSmoke = true;   // (the constructor's own first preset is not this walk's)
      return path.map(n => { q.apply(n); return E.settings.fireSmoke as boolean | undefined; });
    };
    const hand: QualityName[] = [...QUALITY_NAMES, ...[...QUALITY_NAMES].reverse()], climb: QualityName[] = ['medium', 'low', 'verylow', 'low', 'low', 'medium', 'low'];
    const row = (path: QualityName[], s: (boolean | undefined)[]) => path.map((n, i) => `${n} ${s[i] ? 'smoke' : 'none'}`).join(' → ');
    const byHand = walk(ON, false, hand), up = walk(ON, true, climb), offHand = walk(false, false, hand), offUp = walk(false, true, climb), bare = walk(undefined, false, hand);
    check(hand.every((n, i) => byHand[i] === (n !== 'verylow')), `put on by hand, verylow draws a fire without its smoke and every other preset with it, down the ladder and back up: ${row(hand.slice(0, 5), byHand)}`);
    check(up.join() === [true, true, false, false, false, true, true].join(), `moved by auto, the first rung up from the floor keeps the shed (the hop was priced without the smoke), the rung above it has the smoke back, and coming down to low keeps it: ${row(climb, up)}`);
    check(offHand.every(v => v === true) && offUp.every(v => v === true), `the switch off = every preset keeps the fire's smoke, as it was, by hand and under auto: ${row(climb, offUp)}`);
    check(hand.every((n, i) => bare[i] === (n !== 'verylow')), 'a settings object with no such key (a tool\'s mock) sheds as the page does');
  }
  console.log('\nThe smoke keeps high\'s look down the ladder (settings.smokeKeep: under high the march stays at half size with high\'s lights; the rung sheds everything else):');
  {
    const BREAK = process.env.SMOKEKEEP_BREAK === '1';   // SMOKEKEEP_BREAK=1: the 'on' walks run with the switch at 0 and the first two lines must FAIL
    const SMOKE = ['volQuarter', 'volLightCap', 'volShadowEvery', 'volStepVoxels', 'smokeMarchLights', 'volSteps', 'froxelVol'];
    const put = (name: QualityName, keep: number) => { store.clear(); const E = mkEngine(w, { smokeKeep: keep, oneSmokeSolve: false }); const q: any = new Quality(E as never, { params: { rbIters: 4 } } as never); q.auto = false; q.apply(name); return { S: { ...E.settings } as Record<string, any>, rb: q.smoke.params.rbIters as number, q, E }; };
    const diff = (a: Record<string, any>, b: Record<string, any>) => Object.keys({ ...a, ...b }).filter(k => k !== 'smokeKeep' && JSON.stringify(a[k]) !== JSON.stringify(b[k])).sort();
    const H = put('high', 0).S, under: QualityName[] = ['medium', 'low'];
    const on = (n: QualityName) => put(n, BREAK ? 0 : 1).S;
    check(under.every(n => { const S = on(n); return S.volQuarter === false && S.volLightCap === H.volLightCap && S.volStepVoxels === H.volStepVoxels && S.volShadowEvery === H.volShadowEvery && S.smokeMarchLights === H.smokeMarchLights; }),
      `medium and low march the smoke as high does: ${under.map(n => { const S = on(n); return `${n} ${S.volQuarter ? 'quarter' : 'half'} size, ${S.volLightCap} / ${S.smokeMarchLights} lights a step, step ${S.volStepVoxels}`; }).join(' · ')} (high: ${H.volLightCap} / ${H.smokeMarchLights}, step ${H.volStepVoxels})`);
    const moved = under.map(n => diff(on(n), put(n, 0).S));
    check(moved.every(d => d.length > 0 && d.every(k => SMOKE.includes(k))) && under.every(n => on(n).froxelVol === true && on(n).volSteps === put(n, 0).S.volSteps && put(n, BREAK ? 0 : 1).rb === put(n, 0).rb),
      `… and nothing else of the rung moves (the froxel haze, the beam steps, the solver's iterations, every ray count and size): ${under.map((n, i) => `${n} ${moved[i].join(' ')}`).join(' · ')}`);
    check(diff(put('verylow', 0).S, put('verylow', 1).S).length === 0 && diff(put('verylow', 0).S, put('verylow', 2).S).length === 0, 'verylow, the floor, keeps its own smoke at 0, 1 and 2: the last thing the ladder sheds');
    const off = { medium: put('medium', 0).S, low: put('low', 0).S, verylow: put('verylow', 0).S };
    check(off.medium.volQuarter === true && off.medium.volLightCap === 3 && off.medium.smokeMarchLights === 2 && off.medium.volStepVoxels === 1.5 && off.low.volQuarter === true && off.low.volLightCap === 2 && off.low.smokeMarchLights === 0 && off.low.volStepVoxels === 2 && off.verylow.volQuarter === true && off.verylow.smokeMarchLights === 0 && off.verylow.volStepVoxels === 2,
      `0 = the rows as they were: medium quarter size, ${off.medium.volLightCap} / ${off.medium.smokeMarchLights} lights, step ${off.medium.volStepVoxels}; low and verylow quarter size, ${off.low.volLightCap} / ${off.low.smokeMarchLights} lights, step ${off.low.volStepVoxels}`);
    check((['high', 'ultra'] as QualityName[]).every(n => diff(put(n, 0).S, put(n, 1).S).length === 0 && diff(put(n, 0).S, put(n, 2).S).length === 0), 'high and ultra are the same rows at 0, 1 and 2');
    const two = under.map(n => put(n, 2).S);
    check(two.every(S => S.froxelVol === false && S.volSteps === H.volSteps && S.volQuarter === false), `2 = high's whole path under high: the per-pixel march, ${H.volSteps} beam steps (medium ${two[0].volSteps}, low ${two[1].volSteps})`);
    const px = (keep: number) => costTable(true, keep).medium.pixel, hop = (keep: number) => { const x = put('medium', keep); x.q.auto = true; return x.q.hopRatio('high') as number; };
    check(px(0) < px(1) && px(1) < px(2) && hop(0) > hop(1) && Math.abs(costTable(true, 0).high.pixel - costTable(true, 2).high.pixel) < 1e-9,
      `the ladder prices the smoke that runs: medium's per-pixel part ${px(0).toFixed(1)} · ${px(1).toFixed(1)} · ${px(2).toFixed(1)} model-ms at 0 · 1 · 2, medium → high priced ×${hop(0).toFixed(2)} · ×${hop(1).toFixed(2)} (at 2 ×${hop(2).toFixed(2)}: the model, a calm still, drops the froxel term and does not know a fight); high's own price unmoved`);
    { const x = put('medium', 0); x.q.climbed = [{ kind: 'vol' }]; x.E.settings.volQuarter = false; x.E.settings.smokeKeep = 1; x.q.resmoke(); const d = diff(x.E.settings, put('medium', 1).S);
      check(d.length === 0 && x.q.climbed.length === 0, `the Tab row's by-hand step (resmoke) lands on the rows a preset put on at 1 would have, and forgets a climbed quarter-to-half rung${d.length ? `: ${d.join(' ')}` : ''}`); }
    { const x = put('medium', 1); x.q.lastCut = { from: 0.7 }; x.q.upTrial = { from: 0.55 }; x.q.apply('low'); check(x.q.lastCut === null && x.q.upTrial === null, 'a preset put on still clears the judged cut and the judged step up'); }
  }
  console.log('\nAuto lets sharp direct go before it shrinks the picture (settings.ladderShed; the maintainer\'s pick of 10-25. His Mac\'s sweep priced sharp direct at 4.9 of 15.5 ms at High ×0.5, and the machine below is priced so):');
  {
    const ON = process.env.LADDERSHED_BREAK !== '1';   // LADDERSHED_BREAK=1: the 'on' machines run with the switch off and twenty lines must FAIL
    const hi = (scale: number, sharp = true): State => ({ preset: 'high', scale, gatherThird: true, volQuarter: false, maxH: PRESETS.high.maxH, sharp });
    const withK = <T,>(k: number, f: () => T): T => { const k0 = MODEL.sharpK; MODEL.sharpK = k; try { return f(); } finally { MODEL.sharpK = k0; } };
    const c5 = presetCost({ ...withSmoke(PRESETS.high, 1), scale: 0.5 }, true), mpx5 = (1000 * 0.5) ** 2 * (w.cssW / w.cssH) / 1e6, share = 4.9 / 15.45;
    const macK = share * (c5.fixed - c5.passes.sharp + MODEL.extraFixed + c5.pixel * mpx5 / REF.mpx) / (c5.passes.sharp * (1 - share));   // the sharpK that makes sharp direct that share of High ×0.5 on this window
    const mkS = (on: boolean, o: { auto?: boolean; aim?: number; adaptive?: boolean; hz?: number } = {}) => { const x = mkQuality(w, 'high', o.auto ?? true, { ladderClimb: true, ladderShed: on }, o.aim ?? 60, o.hz ?? 120); if (o.adaptive === false) x.q.adaptive = false; return x; };
    /** `secs` a second at a time: the moves, the fps windows, and the ladder's state at the end of every second */
    const watch = (x: { q: any; E: any }, secs: number, k: (t: number) => number, o: { paceMs?: number; timed?: boolean; t0?: number; hz?: number; vrr?: boolean } = {}) => { const moves: string[] = [], fps: number[] = [], st: State[] = []; for (let t = 0; t < secs; t++) { const r = run(x.q, x.E, 1, o.hz ?? 120, k, { ...o, t0: (o.t0 ?? 0) + t }); moves.push(...r.moves); fps.push(...r.fps); st.push(stateOf(x.q, x.E)); } return { moves, fps, st }; };
    const steps = (m: string[]) => m.filter(x => /↓|↑/.test(x)), tOf = (m?: string) => m ? parseFloat(m) : NaN, first = (m: string[], re: RegExp) => m.find(x => re.test(x));
    const sharpOn = (x: { E: any }) => !!x.E.settings.sharpDirect;
    withK(macK, () => {
      const start = modelCost(hi(PRESETS.high.scale), w, S0), bare = modelCost(hi(PRESETS.high.scale, false), w, S0); const A = (ms: number) => ms / start;   // A(ms): the machine on which high at its start, sharp direct on, costs `ms` of union
      // (1) a fight under auto at High: 12 → 17 → 12 ms
      const fight = (t: number) => A(t < 20 ? 12 : t < 80 ? 17 : 12);
      const o = mkS(false), n = mkS(ON); const ro = watch(o, 300, fight), rn = watch(n, 300, fight);
      const lowO = Math.min(...ro.st.slice(20, 80).map(s => s.scale)), lowN = Math.min(...rn.st.slice(20, 80).map(s => s.scale)); const shedAt = tOf(first(rn.moves, /shed ↓/)), fightN = rn.fps.slice(27, 78);
      check(lowO < PRESETS.high.scale - 0.1 && ro.st.every(s => s.sharp) && !ro.moves.some(m => /shed/.test(m)), `the switch off (the ladder as it was): the fight cuts the picture to ×${lowO.toFixed(2)} with sharp direct on throughout — ${words(steps(ro.moves).slice(0, 3))}`);
      check(/shed ↓/.test(steps(rn.moves)[0] ?? '') && shedAt < 24.5 && Math.abs(lowN - PRESETS.high.scale) < 1e-6 && minOf(fightN) >= HOLD.cut * 60 - 0.5, `on: sharp direct goes ${(shedAt - 20).toFixed(1)} s into the fight and the picture keeps its size (×${lowN.toFixed(2)}, never under the tier's start) at ${minOf(fightN).toFixed(0)}‥${Math.max(...fightN).toFixed(0)} fps — ${words(steps(rn.moves).slice(0, 3))}`);
      const m2 = mkS(ON); watch(m2, 30, fight);
      check(!m2.E.settings.sharpDirect && !m2.E.settings.sharpDecouple && !m2.E.settings.gbaa && m2.q.shedState.shed, `… with its two riders (the decoupled jitter, GBAA) off too: sharpDirect ${m2.E.settings.sharpDirect}, sharpDecouple ${m2.E.settings.sharpDecouple}, gbaa ${m2.E.settings.gbaa}`);
      // (2) what the union showed when it went is the price of having it back
      const real = A(17) * (start - bare), seen = m2.q.shedState.seenMs as number; MODEL.sharpK = 1; const modelOnly = A(17) * bare * (modelCost(hi(PRESETS.high.scale), w, S0) / modelCost(hi(PRESETS.high.scale, false), w, S0) - 1); MODEL.sharpK = macK;
      check(Math.abs(seen - real) < 0.15 * real && seen > 1.5 * modelOnly, `this machine's own price for it is learnt off the shed: ${seen.toFixed(1)} ms seen (it costs ${real.toFixed(1)} here; the cost model alone says ${modelOnly.toFixed(1)})`);
      // (3) the fight over at 12 ms (9.3 without it): while it is held off the room goes to pixels, never past 0.95; then it comes back ON THE TIER'S OWN PICTURE — the climb's rungs come off for it — and stays
      const ups = rn.moves.filter(m => /shed ↑/.test(m)), upT = tOf(ups[0]), topSc = Math.max(...rn.st.map(s => s.scale)), afterUp = rn.moves.slice(rn.moves.indexOf(ups[0]) + 1);
      check(ups.length === 1 && upT - shedAt >= SHED.holdSecs && /rungs? off/.test(ups[0]) && topSc > PRESETS.high.scale + 0.04 && topSc <= 0.95 + 1e-6 && sharpOn(n) && Math.abs(sc(n) - PRESETS.high.scale) < 1e-6 && !afterUp.some(m => /shed ↓/.test(m)) && minOf(rn.fps.slice(84)) >= HOLD.cut * 60 - 0.5,
        `the fight over at 12 ms: held off, the room goes to pixels (×${topSc.toFixed(2)} at the most, never past ×0.95 so there is a size left for it); at ${upT.toFixed(0)} s it is back on the tier's own picture, the rungs off for it (“${ups[0]?.split('(').pop()?.replace(/\)$/, '') ?? ''}”), and stays: ×${sc(n).toFixed(2)} with it, ${minOf(rn.fps.slice(84)).toFixed(0)} fps and up (the switch off ends ×${sc(o).toFixed(2)})`);
      { const mk3 = (forget: boolean) => { const x = mkS(ON); const r1 = watch(x, 80, t => A(t < 20 ? 12 : 17)); if (forget) x.q.shedSeen = null; const r2 = watch(x, 900, () => A(13.5), { t0: 80 }); return { x, moves: [...r1.moves, ...r2.moves] }; }; const kept = mk3(false), lost = mk3(true);
        const upsOf = (m: string[]) => m.filter(x => /shed ↑/.test(x)), back = tOf(upsOf(lost.moves)[0]), backK = tOf(upsOf(kept.moves)[0]), again = lost.moves.find((m, i) => i > lost.moves.indexOf(upsOf(lost.moves)[0]) && /shed ↓/.test(m));
        check(upsOf(kept.moves).length === 1 && upsOf(lost.moves).length === 1 && backK > back + 30 && !!again && !sharpOn(kept.x) && !sharpOn(lost.x) && Math.abs(sc(kept.x) - PRESETS.high.scale) < 1e-6 && kept.x.q.shedState.seenMs > 0,
          `… where the cost model underprices it (13.5 ms after the fight: it prices 11.8, the machine pays 13.5, over the band): ONE try in fifteen minutes — at ${backK.toFixed(0)} s, once the price read off the fight is too old to stand (that price forgotten: at ${back.toFixed(0)} s, off again at ${tOf(again).toFixed(0)} s, ${/not back for (\d+) s/.exec(again ?? '')?.[1] ?? '?'} s held) — the try reads ${(kept.x.q.shedState.seenMs as number).toFixed(1)} ms for it in a calm scene, and from there it is left off (×${sc(kept.x).toFixed(2)}, the picture its own size throughout)`); }
      // (4) a fight that ends in a light scene: back, no sooner than the hold-off, with the tier at its own scale first
      const b = mkS(ON); const rb = watch(b, 400, t => A(t < 20 ? 12 : t < 80 ? 22 : 9)); const dn = tOf(first(rb.moves, /shed ↓/)), up = tOf(first(rb.moves, /shed ↑/)); const upI = Math.max(0, Math.floor(up) - 1);
      check(up - dn >= SHED.holdSecs && rb.st[upI]?.scale >= PRESETS.high.scale - 1e-6 && rb.st[upI]?.preset === 'high' && sharpOn(b) && b.E.settings.sharpDecouple && b.E.settings.gbaa && minOf(rb.fps.slice(Math.floor(up))) >= HOLD.cut * 60 - 0.5, `a fight that ends in a light scene (12 → 22 → 9 ms): off at ${dn.toFixed(0)} s, back at ${up.toFixed(0)} s with its riders — the tier at ×${rb.st[upI]?.scale.toFixed(2)} first — and never under ${minOf(rb.fps.slice(Math.floor(up))).toFixed(0)} fps after (ends ×${sc(b).toFixed(2)})`);
      // (5) down the presets and back: the shed rides the hops
      const slow = (t: number) => A(t < 90 ? 30 : 7); const po = mkS(false), pn = mkS(ON); const rpo = watch(po, 400, slow), rpn = watch(pn, 400, slow);
      const idx = (r: { st: State[] }) => Math.min(...r.st.map(s => QUALITY_NAMES.indexOf(s.preset) < 0 ? 0 : -QUALITY_NAMES.indexOf(s.preset))); const hopDn = tOf(first(rpn.moves, /auto ↓/)), hopUp = tOf(first(rpn.moves, /auto ↑ high/)), back5 = tOf(first(rpn.moves, /shed ↑/));
      const lowest = (r: { st: State[] }) => QUALITY_NAMES[-idx(r)];
      check(/shed ↓/.test(steps(rpn.moves)[0] ?? '') && hopDn > 0 && rpn.st.slice(Math.ceil(hopDn), Math.floor(hopUp)).every(s => !s.sharp) && rpn.st[Math.floor(hopUp) + 1]?.sharp === false && back5 > hopUp && sharpOn(pn) && pn.q.current === 'high' && -idx(rpn) <= -idx(rpo),
        `a machine too slow for High (30 ms), light again at 90 s: sharp direct first, then the cuts and ${lowest(rpn)} (the switch off goes down to ${lowest(rpo)}); it stays off across both hops (${hopDn.toFixed(0)} s down, ${hopUp.toFixed(0)} s up, priced without it) and comes back at ${back5.toFixed(0)} s on High`);
      // (6) fights that keep coming: each shed after a give-back holds it off twice as long
      const f = mkS(ON); const rf = watch(f, 900, t => A(t % 150 < 60 ? 17 : 10)); const holds = rf.moves.filter(m => /shed ↓/.test(m)).map(m => +(/not back for (\d+) s/.exec(m)?.[1] ?? 0));
      check(holds.length >= 3 && holds[0] === SHED.holdSecs && holds.every((h, i) => i === 0 || h === 2 * holds[i - 1]), `a fight every 150 s: held off ${holds.join(' → ')} s — it converges on left alone instead of flipping with every fight (${rf.moves.filter(m => /shed/.test(m)).length} sheds and returns in fifteen minutes)`);
      // (7) a page something else holds to 30 fps (13.9 ms: over the back-off band): the shed is judged with the cut after it and goes back with the pixels
      const h = mkS(ON); const rh = watch(h, 300, () => A(13.9), { paceMs: 33.33 }); const onShare = rh.st.filter(s => s.sharp).length / rh.st.length;
      check(sharpOn(h) && Math.abs(sc(h) - PRESETS.high.scale) < 1e-6 && rh.moves.some(m => /sharp direct with them/.test(m)) && onShare > 0.9 && h.q.shedState.sheds === 0, `held to 30 fps by something else: the shed buys no frame rate there, is taken back with the judged cut (“${first(rh.moves, /sharp direct with them/)?.split(': ').pop()?.replace(/\)$/, '') ?? ''}”) and counts for nothing — sharp direct on ${(100 * onShare).toFixed(0)} % of five minutes, the re-tests the rest`);
      // (8) the other roads to a smaller picture: adaptive resolution off (a preset would go), no GPU timings (the rate alone), the as-now bands
      const ad = mkS(ON, { adaptive: false }); const rad = watch(ad, 200, t => A(t < 60 ? 19 : 8));
      check(/shed ↓/.test(steps(rad.moves)[0] ?? '') && sharpOn(ad) && ad.q.current === 'high', `adaptive resolution off: sharp direct goes before the preset does, and is back on High afterwards — ${words(steps(rad.moves))}`);
      const bl = mkS(ON); const rbl = watch(bl, 200, t => A(t < 60 ? 19 : 8), { timed: false }); const blUp = tOf(first(rbl.moves, /shed ↑/));
      check(/shed ↓/.test(steps(rbl.moves)[0] ?? '') && blUp >= SHED.holdSecs && sharpOn(bl), `no GPU timings: off by the rate alone, back at ${blUp.toFixed(0)} s by the rate alone (${HOLD.blindWindows} good windows after the hold-off) — ${words(steps(rbl.moves))}`);
      const an = mkS(ON, { aim: 0 }); const ran = watch(an, 60, t => A(t < 10 ? 11 : 24));
      check(/shed ↓/.test(steps(ran.moves)[0] ?? ''), `as now (?aim=asnow), 24 ms: the cut under 45 fps lets it go first too — ${words(steps(ran.moves).slice(0, 3))}`);
      // (9) what it must NOT touch
      const same = (name: string, mk: (on: boolean) => { q: any; E: any }, k: (t: number) => number, secs = 120, want = (m: string[]) => m.some(x => /↓/.test(x))) => { const a = mk(true), z = mk(false); const ra = watch(a, secs, k), rz = watch(z, secs, k); check(JSON.stringify(ra.moves) === JSON.stringify(rz.moves) && !ra.moves.some(m => /shed/.test(m)) && want(ra.moves) && sharpOn(a) === sharpOn(z), `${name}: the same ${steps(ra.moves).length} moves with the switch on and off, sharp direct ${sharpOn(a) ? 'on' : 'off'}`); };
      same('a preset pinned by hand (High, adaptive resolution) through that fight', on => mkS(on, { auto: false }), fight);
      same('a machine with room (8 ms: it climbs)', on => mkS(on), () => A(8), 120, m => m.some(x => /climb ↑/.test(x)));
      sharpForce.v = false; try { same('?nosharp (sharp direct forced off for the visit)', on => { const x = mkS(on); x.q.apply('high'); x.q.cooldown = 0; x.q.lastChange = ''; return x; }, fight); } finally { sharpForce.v = null; }
      sharpForce.v = true; try { same('?sharp (forced on)', on => { const x = mkS(on); x.q.apply('high'); x.q.cooldown = 0; x.q.lastChange = ''; return x; }, fight); } finally { sharpForce.v = null; }
      { const a = mkS(true), z = mkS(false); delete a.E.settings.ladderShed; const ra = watch(a, 120, fight), rz = watch(z, 120, fight); check(JSON.stringify(ra.moves) === JSON.stringify(rz.moves), 'a settings object with no such key (a tool\'s mock) = the ladder as it was'); }
      // (10) the shed ends with the switch, a pin, a new auto spell
      const sw = mkS(ON); watch(sw, 40, fight); const was = sharpOn(sw); sw.E.settings.ladderShed = false; const rsw = watch(sw, 2, fight, { t0: 40 });
      check(!was && sharpOn(sw) && sw.E.settings.gbaa && !sw.q.shedState.shed && rsw.moves.some(m => /shed ↑ sharp direct back \(the switch is off\)/.test(m)), `the switch put off mid-fight (the Tab row): sharp direct is back within two seconds — ${words(rsw.moves)}`);
      const pinned = mkS(ON); watch(pinned, 40, fight); const wasP = sharpOn(pinned); pinned.q.pin('medium'); const pinOn = sharpOn(pinned); pinned.q.setAuto(); pinned.q.calib = { ...pinned.q.calib, done: true };
      check(!wasP && pinOn && !pinned.q.shedState.shed && sharpOn(pinned) && pinned.q.shedState.sheds === 0, 'a preset pinned from the menu mid-fight has its own rows (sharp direct on), and auto chosen again starts with it on and nothing held off');
    });
    // (12) a spike that ends inside the second the price is read (17 ms for 3 s, then 10.2: the reading is the spike ending, not sharp direct): the reading does not stand for ever
    { const x = mkS(ON); const r = watch(x, 400, t => at(t < 20 ? 12 : t < 23 ? 17 : 10.2)); const dn = tOf(first(r.moves, /shed ↓/)), up = tOf(first(r.moves, /shed ↑/)), reads = (x.q.shedState.seenMs as number);
      check(dn > 0 && up - dn >= SHED.holdSecs && up - dn <= 3 * SHED.holdSecs && sharpOn(x) && r.moves.filter(m => /shed ↓/.test(m)).length === 1, `a three-second spike, then 10.2 ms: off at ${dn.toFixed(0)} s, and the price read off the spike's own end is not kept past twice the hold-off — back at ${up.toFixed(0)} s and it stays (it reads ${reads.toFixed(1)} ms for it there)`); }
    // (13) a fixed 60 Hz display, 5.5 ms of frame past the union, 12.5 ms at High's start: inside the band, its vsync missed (30 fps). An aim's judged cut would take pixels: sharp direct goes instead
    { const O0 = MODEL.overheadMs; MODEL.overheadMs = 5.5; try { const o = mkS(false, { hz: 60 }), n = mkS(ON, { hz: 60 }); const ro = watch(o, 200, () => at(12.5), { hz: 60, vrr: false }), rn = watch(n, 200, () => at(12.5), { hz: 60, vrr: false });
      check(sc(o) < PRESETS.high.scale - 0.04 && sharpOn(o) && Math.abs(sc(n) - PRESETS.high.scale) < 1e-6 && !sharpOn(n) && rn.fps[rn.fps.length - 1] > 59 && ro.fps[ro.fps.length - 1] > 59, `a fixed 60 Hz display missing its vsync with the union inside the band (12.5 ms, 5.5 ms of frame past it): the switch off cuts to ×${sc(o).toFixed(2)} with sharp direct on; on, it goes instead and every pixel stays (×${sc(n).toFixed(2)}, ${rn.fps[rn.fps.length - 1].toFixed(0)} fps) — ${words(steps(rn.moves).slice(0, 2))}`); } finally { MODEL.overheadMs = O0; } }
    // (14) down to Medium in a fight, then a light scene on a page something holds to 30 fps: the hop up can never be taken at that rate, and must not hold sharp direct off
    { const x = mkS(ON); const r = watch(x, 90, () => at(30)); const mid = x.q.current as string; const r2 = watch(x, 500, () => at(5), { t0: 90, paceMs: 33.33 });
      check(/shed ↓/.test(steps(r.moves)[0] ?? '') && mid !== 'high' && x.q.current === mid && sharpOn(x) && r2.moves.some(m => /shed ↑/.test(m)), `30 ms for 90 s (down to ${mid}, the shed kept), then 5 ms on a page held to 30 fps: no hop up at that rate, and sharp direct is back on ${x.q.current} at ${tOf(first(r2.moves, /shed ↑/)).toFixed(0)} s`); }
    // (15) put back on by hand while shed (the Tab row): the ladder holds no shed against it, and may let it go again
    { const x = mkS(ON); watch(x, 30, t => at(t < 5 ? 12 : 17)); const was = x.q.shedState.shed; x.E.settings.sharpDirect = true; watch(x, 1, () => at(12), { t0: 30 }); const cleared = !x.q.shedState.shed; const r = watch(x, 30, () => at(19), { t0: 31 });
      check(was && cleared && /shed ↓/.test(steps(r.moves)[0] ?? ''), 'sharp direct put back on by hand while shed: the ladder forgets its shed within a second, and in the next fight lets it go again before any pixel'); }
    // (16) a take begun with the shed standing (PerfDump.shedAtStart): the replayed ladder knows sharp direct is its own to bring back; without the stamp it is a row put off by hand, and stays off
    { const mk = (stamp: boolean) => { const x = mkQuality(w, 'high', true, { ladderClimb: true, ladderShed: ON, sharpDirect: false }, 60, 120, stamp); const r = watch(x, 200, () => at(8)); return { x, r }; }; const a = mk(true), z = mk(false);
      check(a.x.E.settings.sharpDirect === true && a.r.moves.some(m => /shed ↑/.test(m)) && z.x.E.settings.sharpDirect === false && !z.r.moves.some(m => /shed/.test(m)), `a take begun mid-shed replays with the shed standing (sharp direct back at ${tOf(first(a.r.moves, /shed ↑/)).toFixed(0)} s in a light scene); the same settings without the stamp = put off by hand: left off`); }
    // (11) the cost model's own machine, a steady 14.5 ms: the picture stays at High's start where it was cut a step
    { const o = mkS(false), n = mkS(ON); watch(o, 300, () => at(14.5)); const rn = watch(n, 300, () => at(14.5));
      check(sc(o) < PRESETS.high.scale - 0.04 && sharpOn(o) && Math.abs(sc(n) - PRESETS.high.scale) < 1e-6 && !sharpOn(n) && steps(rn.moves).length === 1 && minOf(rn.fps.slice(5)) >= HOLD.cut * 60 - 0.5, `on the cost model's own machine, a steady 14.5 ms: ×${sc(n).toFixed(2)} without sharp direct for five minutes in one move, ${minOf(rn.fps.slice(5)).toFixed(0)} fps and up (the switch off: ×${sc(o).toFixed(2)} with it)`); }
  }
  if (fails) console.log(`\n${fails} check(s) FAILED`); else console.log('\n=== ladder-replay selftest: ALL PASS ===');
  return fails === 0;
}

// ---- main --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const args = process.argv.slice(2); const flag = (n: string) => args.includes(n); const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const KNOWN = ['--aim', '--hz', '--check', '--md', '--timeline', '--selftest', '--hold', '--paced', '--held', '--shed', '--sharpk', '--sweeps'];
{ const p = opt('--paced'); if (p !== undefined) { if (p !== 'on' && p !== 'off') { console.error(`--paced ${p}: on | off`); process.exit(2); } pacedForce = p === 'on'; } }
{ const p = opt('--held'); if (p !== undefined) { if (p !== 'on' && p !== 'off') { console.error(`--held ${p}: on | off`); process.exit(2); } heldForce = p === 'on'; } }
{ const p = opt('--shed'); if (p !== undefined) { if (p !== 'on' && p !== 'off') { console.error(`--shed ${p}: on | off`); process.exit(2); } shedForce = p === 'on'; } }
{ const k = opt('--sharpk'); if (k !== undefined) { if (!(+k >= 0.2 && +k <= 10)) { console.error(`--sharpk ${k}: 0.2‥10`); process.exit(2); } MODEL.sharpK = +k; } }
{ const h = opt('--hold'); if (h) for (const kv of h.split(',')) { const [k, v] = kv.split('='); if (!(k in HOLD) || !Number.isFinite(+v)) { console.error(`--hold ${kv}: HOLD has ${Object.keys(HOLD).join(', ')}`); process.exit(2); } (HOLD as Record<string, number>)[k] = +v; } }   // tuning: replay with a HOLD constant moved (--hold restore=0.8,restoreWindows=6)
for (const a of args) if (a.startsWith('--') && !KNOWN.includes(a)) { console.error(`unknown flag ${a} (known: ${KNOWN.join(' ')})`); process.exit(2); }
const files = args.filter((a, i) => !a.startsWith('--') && !['--aim', '--hz', '--hold', '--paced', '--held', '--shed', '--sharpk'].includes(args[i - 1]));
let ok = true;
if (flag('--selftest')) ok = selftest() && ok;
if (!files.length && !flag('--selftest')) { console.error('usage: bun run tools/qa/ladder-replay.ts <perf-….json>… [--aim asnow|60|90|120|display|all] [--hz N] [--paced on|off] [--held on|off] [--shed on|off] [--sharpk N] [--sweeps] [--check] [--md] [--timeline] | --selftest'); process.exit(2); }
const aimArg = opt('--aim') ?? 'all'; const aims = aimArg === 'all' ? [0, 60, 90, 120, AIM_DISPLAY] : aimArg.split(',').map(a => { const v = ladderAimOf(a); if (v === null) { console.error(`--aim ${a}: not one of asnow | 0 | 60 | 90 | 120 | display`); process.exit(2); } return v; });
const hzArg = opt('--hz') ? Number(opt('--hz')) : undefined; if (hzArg !== undefined && !(hzArg >= 24 && hzArg <= 480)) { console.error(`--hz ${opt('--hz')}: a display rate, 24‥480`); process.exit(2); }
for (const path of files) {
  const d = loadDump(path); const name = path.split('/').pop()!.replace(/\.json$/, '');
  if (d.events.some(e => e.kind === 'sweep')) { if (!flag('--sweeps')) { console.log(`\n${name}: a sweep take (the ladder was held still) — nothing to replay (--sweeps replays it anyway)`); continue; } console.log(`\n${name}: A SWEEP TAKE replayed anyway (--sweeps): its rows flip features under the ladder, so read the moves and the rows, not the fps`); }
  if (flag('--check')) ok = checkAsNow(d, name, hzArg) && ok;
  else { const warm = bestWarm(d, hzArg).warm; report(name, d, aims.map(a => replay(d, a, { hz: hzArg, warm })), flag('--md'), flag('--timeline')); }   // (every aim from the start state as-now's own replay fits best)
}
process.exit(ok ? 0 : 1);
