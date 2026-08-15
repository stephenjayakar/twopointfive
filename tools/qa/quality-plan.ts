// Auto quality's boot decision on paper. src/ui/quality.ts calibrates behind the start card: a couple of seconds of GPU compute-pass timings at the
// starting preset ('high' on a first visit) → plan(gpuMs, fixedMs, preset, effectiveScale, cssH, dpr) → the preset AND render scale predicted to fit
// PLAN_BUDGET_MS of compute (15 ms ≈ a presented 50–55 fps since 08-10; 24 ms ≈ 30 fps before). This script feeds plan() the timings a given machine WOULD report — machines are "k × the reference M4 Max
// per unit of work" on a given window, priced with the same per-pass cost model plan() uses (COST / REF in quality.ts) — and prints, per machine:
// what plan() picked from the same numbers under the OLD SCALE SEMANTICS (until 08-11: internal = min(cap, window × scale), presets at 1.0 / 1.0 / 0.8 / 0.65 / 0.5,
// floor 0.35 of the window, the solved scale to 0.01), what it picks now (internal = min(cap, window) × scale, presets all 1.0, floor 0.5 of the cap, scales on the
// 0.05 grid), and what the model says each pick really costs; then the fixed points behind the 'does an M1-class GPU hold the budget on low' question. No GPU
// involved: the absolute numbers are only as good as REF / FACTOR, which the lead corrects from measured pass timings — the point is the decision logic and the ratios.
//   bun run tools/qa/quality-plan.ts [--budget 15] [--k 4.5 --css 1440x900 --dpr 2]   (the flags add one machine of your own to the table)
import { plan, COST, PRESETS, QUALITY_NAMES, REF, SCALE_FLOOR, SCALE_STEP, AUTO_LADDER as LADDER_NAMES, type QualityName, type Plan, PLAN_BUDGET_MS, presetCost } from '../../src/ui/quality.ts';

const argv = process.argv.slice(2);
const arg = (k: string, d: string) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const BUDGET = Number(arg('--budget', String(PLAN_BUDGET_MS)));   // the game's own budget (quality.ts) unless overridden

// ---------------------------------------------------------------- the model as a virtual GPU ----------------------------------------------------------------
interface Machine { name: string; k: number; cssW: number; cssH: number; dpr: number }
/** effective scale (internal / CSS×dpr) the preset's cap gives machine m's window at render scale 1.0 (engine.ts capScale) */
const capOf = (name: QualityName, m: Machine) => Math.min(1, PRESETS[name].maxH / (m.cssH * m.dpr));
/** effective scale of preset `name` at render scale `scale` — the CURRENT semantics: relative to the cap */
const effOf = (name: QualityName, scale: number, m: Machine) => capOf(name, m) * Math.min(1, scale);
/** …and the semantics until 08-11: the scale multiplied the window and was then capped */
const effOld = (name: QualityName, scale: number, m: Machine) => Math.min(scale, PRESETS[name].maxH / (m.cssH * m.dpr));
const mpxOf = (eff: number, m: Machine) => (m.cssW * m.dpr * eff) * (m.cssH * m.dpr * eff) / 1e6;
/** compute ms the model says preset `name` costs on machine m at effective scale `eff` (per-pixel part scaled from the reference pixel count + the fixed part, × k) */
const msAtEff = (name: QualityName, eff: number, m: Machine) => m.k * (COST[name].pixel * mpxOf(eff, m) / REF.mpx + COST[name].fixed);
const trueMs = (name: QualityName, scale: number, m: Machine) => msAtEff(name, effOf(name, scale, m), m);
const fixedMsOf = (name: QualityName, m: Machine) => m.k * COST[name].fixed;

// ---------------------------------------------------------------- plan() as it was until 08-11 (same cost model, old scale semantics), verbatim ----------------------------------------------------------------
const OLD_SCALE: Record<QualityName, number> = { ultra: 1.0, high: 1.0, medium: 0.8, low: 0.65, verylow: 0.5 }; const OLD_FLOOR = 0.35;
function capPlan(gpuMs: number, fixedMs: number, cur: QualityName, effNow: number, cssH: number, dpr: number, budgetMs = PLAN_BUDGET_MS): Plan {
  const pixelMs = Math.max(0.5, gpuMs - fixedMs); const c0 = COST[cur];
  const capOfP = (name: QualityName) => PRESETS[name].maxH / Math.max(1, cssH * dpr);
  const fixedOf = (name: QualityName) => fixedMs * (COST[name].fixed / c0.fixed);
  const perEff2 = (name: QualityName) => pixelMs * (COST[name].pixel / c0.pixel) / Math.max(1e-4, effNow * effNow);
  const predict = (name: QualityName, scale: number) => fixedOf(name) + perEff2(name) * Math.min(scale, capOfP(name)) ** 2;
  for (let i = LADDER_NAMES.length - 1; i >= 1; i--) { const name = LADDER_NAMES[i]; const pr = predict(name, OLD_SCALE[name]); if (pr <= budgetMs) return { preset: name, scale: OLD_SCALE[name], predicted: pr, note: 'fits' }; }
  const solve = (name: QualityName): Plan => {
    const cap = capOfP(name); const room = budgetMs - fixedOf(name);
    const need = room > 0 ? Math.sqrt(room / perEff2(name)) : 0;
    const scale = cap <= need ? OLD_SCALE[name] : Math.min(OLD_SCALE[name], Math.max(OLD_FLOOR, Math.floor(need * 100) / 100));
    const predicted = predict(name, scale);
    return { preset: name, scale: +scale.toFixed(2), predicted, note: predicted <= budgetMs + 1e-6 ? (scale >= OLD_SCALE[name] - 1e-3 ? 'fits' : `${name}, reduced scale`) : 'below target even at the floor' };
  };
  const low = solve('low'); if (low.predicted <= budgetMs + 1e-6) return low;
  return solve('verylow');
}

// ---------------------------------------------------------------- 1. the cost table ----------------------------------------------------------------
const f1 = (v: number) => v.toFixed(1).padStart(5), f2 = (v: number) => v.toFixed(2);
console.log(`Cost model (src/ui/quality.ts COST): modelled compute ms on the reference M4 Max at ${REF.mpx} Mpx internal, per preset — per-pixel passes | fixed part | ratios plan() uses`);
console.log(`  preset    direct softbl gather tempor volume bloom | cascad probe |  pixel (rel)   fixed (rel)   what it switches`);
for (const n of QUALITY_NAMES) {
  const c = COST[n], P = c.passes, p = PRESETS[n], L = p.lossy;
  const sw = [`${p.ds.join('/')} rays`, `hist ${p.hist}`, `maxH ${p.maxH}`, `scale ${p.scale}`, ...(['checkerDirect', 'gatherThird', 'rcHalfRate', 'volQuarter', 'dimRays'] as const).filter(k => L[k]).map(k => k === 'dimRays' ? `dimRays<${L.dimBelow}` : k)].join(', ');
  console.log(`  ${n.padEnd(8)} ${f1(P.direct)}  ${f1(P.softblur)}  ${f1(P.gather)}  ${f1(P.temporal)}  ${f1(P.volumetrics)} ${f1(P.bloom)} | ${f1(P.rc)}  ${f1(P.probe)} | ${f1(c.pixel)} (${f2(c.pixel / COST.ultra.pixel)})  ${f1(c.fixed)} (${f2(c.fixed / COST.ultra.fixed)})   ${sw}`);
}
// what each preset renders on the two window classes, old vs new semantics (the visible consequence of 'scale is relative to the cap, presets all 1.0')
{
  const wins: Machine[] = [{ name: '1000-row window @1 (the reference)', k: 1, cssW: 1777, cssH: 1000, dpr: 1 }, { name: '900-row HiDPI pane @2 (1800 device rows)', k: 1, cssW: 1440, cssH: 900, dpr: 2 }, { name: '1080p monitor @1', k: 1, cssW: 1920, cssH: 1080, dpr: 1 }];
  console.log(`\nInternal rows per preset at its own starting scale — before 08-11 (min(cap, window × {1, 1, .8, .65, .5})) → now (min(cap, window) × 1.0):`);
  for (const m of wins) console.log(`  ${m.name.padEnd(42)} ${QUALITY_NAMES.map(n => `${n} ${Math.floor(m.cssH * m.dpr * effOld(n, OLD_SCALE[n], m))}→${Math.floor(m.cssH * m.dpr * effOf(n, PRESETS[n].scale, m))}`).join(' · ')}`);
}

// ---------------------------------------------------------------- 2. calibration picks, before / after ----------------------------------------------------------------
const MACHINES: Machine[] = [
  { name: 'M4 Max, reference window', k: 1, cssW: 1777, cssH: 1000, dpr: 1 },
  { name: 'M4 Max, 1440×900 HiDPI panel', k: 1, cssW: 1440, cssH: 900, dpr: 2 },
  { name: 'M-series Pro class (2.5×), 1512×982 @2', k: 2.5, cssW: 1512, cssH: 982, dpr: 2 },
  { name: 'M1 / M2 base (4.5×), 1440×900 @2', k: 4.5, cssW: 1440, cssH: 900, dpr: 2 },
  { name: 'M1 if it is 5.5×, 1440×900 @2', k: 5.5, cssW: 1440, cssH: 900, dpr: 2 },
  { name: 'M1 base on a 1080p monitor (4.5×) @1', k: 4.5, cssW: 1920, cssH: 1080, dpr: 1 },
  { name: 'iGPU (8×), 1920×1080 @1', k: 8, cssW: 1920, cssH: 1080, dpr: 1 },
  { name: 'iGPU (12×), 1366×768 @1', k: 12, cssW: 1366, cssH: 768, dpr: 1 },
];
if (argv.includes('--k')) {
  const [w, h] = arg('--css', '1440x900').split('x').map(Number); const m: Machine = { name: `yours (${arg('--k', '1')}×), ${w}×${h} @${arg('--dpr', '1')}`, k: Number(arg('--k', '1')), cssW: w, cssH: h, dpr: Number(arg('--dpr', '1')) };
  if (![m.k, m.cssW, m.cssH, m.dpr].every(v => isFinite(v) && v > 0)) { console.error('usage: --k 4.5 --css 1440x900 --dpr 2 (all positive numbers)'); process.exit(2); }
  MACHINES.push(m);
}

const showPickOld = (r: Plan, m: Machine) => { const e = effOld(r.preset, r.scale, m); return `${r.preset.padEnd(7)} ×${f2(r.scale)} (eff ${f2(e)}, ${Math.floor(m.cssH * m.dpr * e)} rows)  model ${f1(msAtEff(r.preset, e, m))} ms  ${r.note}`; };
const showPick = (r: Plan, m: Machine) => { const e = effOf(r.preset, r.scale, m); return `${r.preset.padEnd(7)} ×${f2(r.scale)} (eff ${f2(e)}, ${Math.floor(m.cssH * m.dpr * e)} rows)  model ${f1(trueMs(r.preset, r.scale, m))} ms  ${r.note}`; };
console.log(`\nCalibration on a first visit (measuring at 'high', scale 1.0 = the window's cap), budget ${BUDGET} ms of compute — the same cost model both sides; only the meaning of 'scale' differs:`);
console.log(`  machine                                      measured at high          | BEFORE 08-11 (scale × window, then capped; floor ${OLD_FLOOR} of the window)     | NOW (scale × the cap; presets 1.0; floor ${SCALE_FLOOR} of the cap; ${SCALE_STEP} grid)`);
let gridMisses = 0;
for (const m of MACHINES) {
  const eff = effOf('high', PRESETS.high.scale, m); const gpu = trueMs('high', PRESETS.high.scale, m), fixed = fixedMsOf('high', m);
  const before = capPlan(gpu, fixed, 'high', eff, m.cssH, m.dpr, BUDGET), after = plan(gpu, fixed, 'high', eff, m.cssH, m.dpr, BUDGET);
  if (Math.abs(after.scale / SCALE_STEP - Math.round(after.scale / SCALE_STEP)) > 1e-6 && Math.abs(after.scale - PRESETS[after.preset].scale) > 1e-6) gridMisses++;   // (a preset's own starting scale — high's 0.77, medium's 0.67 under TAAU — is a legitimate landing off the 0.05 grid: one more fixed size per preset, still a handful for the pool)
  console.log(`  ${m.name.padEnd(44)} ${f1(gpu)} ms (fixed ${f1(fixed)}) ×${f2(eff)} | ${showPickOld(before, m).padEnd(80)} | ${showPick(after, m)}`);
}
console.log(`  (model = what the cost model says the pick costs at the rows it renders; a pick's rows are what changed for the user — same on HiDPI where the cap ruled, a solved scale is coarser by the grid, and a machine that sat 'reduced' between two grid steps lands on the lower one)`);

// ---------------------------------------------------------------- 3. the M1 question ----------------------------------------------------------------
console.log(`\nDoes an M1-class GPU hold the budget (≤ ${BUDGET} ms compute) on low at 1440×900 CSS × dpr 2?  (low ×1.0 = its 720-row cap = eff 0.40 there; the floor ×${SCALE_FLOOR} of that = ${Math.round(720 * SCALE_FLOOR)} rows; verylow ×1.0 = 600 rows = eff 0.33; medium ×1.0 = 900 rows = eff 0.50)`);
for (const k of [3.5, 4.5, 5.5]) {
  const m: Machine = { name: '', k, cssW: 1440, cssH: 900, dpr: 2 };
  const row = (label: string, name: QualityName, scale: number) => { const ms = trueMs(name, scale, m); return `${label} ${f1(ms)} ms ${ms <= BUDGET ? 'fits' : 'MISSES'}`; };
  console.log(`  ${k.toFixed(1)}×:  ${row('low ×1.0 (720 rows):', 'low', 1)}   ${row(`low ×${SCALE_FLOOR} (${Math.round(720 * SCALE_FLOOR)} rows):`, 'low', SCALE_FLOOR)}   ${row('verylow ×1.0 (600 rows):', 'verylow', 1)}   ${row(`verylow ×${SCALE_FLOOR} (${Math.round(600 * SCALE_FLOOR)} rows):`, 'verylow', SCALE_FLOOR)}   ${row('medium ×1.0 (900 rows):', 'medium', 1)}`);
}
console.log(`  (an M1 base GPU is taken as ~4.5× the M4 Max per unit of ray work; the designer's brother saw ~20 fps on low there, i.e. ≥ 40 ms — nearer the 5.5× row if his build already had the trade-offs folded in, the 4.5× row if it predated them. Before 08-11 adaptive could not go under verylow's 600 rows on that window at all — the window-relative floor 0.35 = 630 rows sat above the cap; now the floor is 300 rows)`);

// ---------------------------------------------------------------- 4. sanity: the runtime console example in the dev notes terms ----------------------------------------------------------------
const ex: [number, number, QualityName, number, number, number][] = [[58, 9, 'high', 1, 1000, 1], [30, 4, 'high', 1, 1000, 1], [17, 3.2, 'high', 1, 1000, 1], [140, 14, 'high', 1, 1000, 1], [40, 3, 'low', 0.35, 900, 2]];
console.log(`\nplan() on the bare synthetic pairs the calibration commit quoted (gpuMs, fixedMs at preset ×eff, cssH@dpr → pick):`);
for (const [g, fx, cur, e, h, d] of ex) { const r = plan(g, fx, cur, e, h, d, BUDGET), o = capPlan(g, fx, cur, e, h, d, BUDGET); console.log(`  ${String(g).padStart(4)} ms (fixed ${String(fx).padStart(3)}) at ${cur} ×${e} ${h}@${d} → ${r.preset} ×${f2(r.scale)} pred ${f1(r.predicted)} (${r.note})   [before 08-11: ${o.preset} ×${f2(o.scale)} pred ${f1(o.predicted)} (${o.note})]`); }
if (gridMisses) console.log(`  *** ${gridMisses} pick(s) off the ${SCALE_STEP} grid ***`);

// ---------------------------------------------------------------- 5. what applying each preset writes (the real Quality.apply over a stub engine) ----------------------------------------------------------------
// No GPU: the engine is a bag holding defaultSettings(), an rc.cfg and a rebuildRc that records the request; the smoke system is { params }. This is the path the menu's
// Quality select, the Tab panel, ?quality= and auto's ladder all take, so it doubles as the "nothing throws when a preset applies" check the headless tour cannot make.
{
  const G = globalThis as unknown as Record<string, unknown>;   // engine.ts names the WebGPU usage enums at module load; plain Bun has none (the same shim tools/qa/headless.ts uses)
  G.GPUBufferUsage ??= { MAP_READ: 1, MAP_WRITE: 2, COPY_SRC: 4, COPY_DST: 8, INDEX: 16, VERTEX: 32, UNIFORM: 64, STORAGE: 128, INDIRECT: 256, QUERY_RESOLVE: 512 };
  G.GPUTextureUsage ??= { COPY_SRC: 1, COPY_DST: 2, TEXTURE_BINDING: 4, STORAGE_BINDING: 8, RENDER_ATTACHMENT: 16 };
  G.GPUShaderStage ??= { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 }; G.GPUMapMode ??= { READ: 1, WRITE: 2 };
  const { Quality } = await import('../../src/ui/quality.ts');
  const { defaultRcConfig } = await import('../../src/render/rc.ts');
  let defaults: () => Record<string, unknown>;
  try { defaults = (await import('../../src/engine.ts')).defaultSettings as unknown as () => Record<string, unknown>; }
  catch (e) { console.log(`  (engine.ts did not import here — ${(e as Error).message}; the stub starts from empty settings instead of defaultSettings())`); defaults = () => ({}); }
  const KEYS = ['renderScale', 'maxInternalHeight', 'volSteps', 'directSamplesTop', 'directSamplesOther', 'directAdaptiveMin', 'directHistory', 'checkerDirect', 'gatherThird', 'rcHalfRate', 'volQuarter', 'dimRays', 'dimRaysBelow', 'giFireflyK'];
  const engine = { settings: defaults(), rc: { cfg: { ...defaultRcConfig } }, rebuilds: 0, rebuildRc(cfg: Record<string, unknown>) { this.rc.cfg = cfg as typeof this.rc.cfg; this.rebuilds++; }, effectiveScale: 1, capScale: 1 };
  const smoke = { params: { rbIters: 4 } };
  const q = new Quality(engine as never, smoke as never);   // (no localStorage / document here: the constructor's try/catch covers the first, calibration is never ticked)
  console.log(`\nQuality.apply() per preset — the settings it writes (constructed in auto mode at '${q.current}'):`);
  for (const n of QUALITY_NAMES) {
    const before = engine.rebuilds; q.apply(n);
    const S = engine.settings; const vals = KEYS.map(k => `${k.replace('direct', 'd').replace('Internal', '')}=${typeof S[k] === 'boolean' ? (S[k] ? 'ON' : 'off') : S[k]}`).join(' ');
    console.log(`  ${n.padEnd(8)} ${vals} rc=${engine.rc.cfg.nx}×${engine.rc.cfg.ny}×${engine.rc.cfg.nz}/${engine.rc.cfg.cascades}${engine.rebuilds > before ? ' (rebuilt)' : ''} rbIters=${smoke.params.rbIters}`);
  }
  // a hand override sticks until the next apply: flip one, re-apply the same preset, it is back
  q.apply('low'); (engine.settings as Record<string, unknown>).gatherThird = false; const stuck = (engine.settings as Record<string, unknown>).gatherThird; q.apply('low');
  console.log(`  override check: low → gatherThird flipped off by hand = ${stuck} → apply('low') again → ${(engine.settings as Record<string, unknown>).gatherThird} (expected false → true)`);
}

// ---------------------------------------------------------------- 6. 'auto' chosen later = the boot's auto path (review #24) ----------------------------------------------------------------
// The real Quality over a stub engine WITH timers, a Map-backed localStorage and a visible document: (A) a visit that boots pinned ('low' remembered) and picks
// 'auto' on the pause card must calibrate ONCE behind that card and settle — before the fix calib.done was simply left false, so it did that by accident, off
// whatever frame was up, with a stale note; (B) auto boot → calibrated → pin ultra → 'auto' again must start from what auto settled on here (not high ×1.0
// crawling down the runtime ladder for 10–20 s, the old setAuto) and re-measure the same way. PASS / FAIL; a failure exits 1 at the end.
let stateFails = 0;
{
  const G = globalThis as unknown as Record<string, any>;
  const store = new Map<string, string>();
  G.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); } };
  G.document = { hidden: false }; G.window = { devicePixelRatio: 2, __testVisible: true };
  const { Quality: Q2, AUTO_LADDER } = await import('../../src/ui/quality.ts');
  const { defaultRcConfig } = await import('../../src/render/rc.ts');
  const defaults = (await import('../../src/engine.ts')).defaultSettings as unknown as () => Record<string, any>;
  /** a machine `k`× the reference on a 1440×900 @2 window: its timer reports what the cost model says the CURRENT preset costs at the effective scale */
  const mkEngine = (k: number) => {
    const E: any = { settings: defaults(), rc: { cfg: { ...defaultRcConfig } }, rebuildRc(cfg: any) { this.rc.cfg = cfg; }, gpu: { canvas: { clientHeight: 900 } }, q: null as any,
      get capScale() { const name = this.q?.current ?? 'high'; return Math.min(1, PRESETS[name as QualityName].maxH / (900 * 2)); },   // engine.ts resize: what render scale 1.0 gets under the current preset's cap on this window …
      get effectiveScale() { return this.capScale * Math.min(1, this.settings.renderScale); },                                            // … × the render scale = the true internal / CSS×dpr ratio
      timer: { enabled: true, results: new Map<string, number>(), total(excl: string[]) { let s = 0; for (const [n, v] of this.results) if (!excl.includes(n)) s += v; return s; } } };
    E.tick = () => {   // refresh the timer for this frame: per-pixel part at the effective scale + the fixed part, × k
      const name = (E.q?.current ?? 'high') as QualityName; const eff = E.effectiveScale; const mpx = (1440 * 2 * eff) * (900 * 2 * eff) / 1e6;
      const R = E.timer.results; R.clear(); R.set('direct', k * COST[name].pixel * mpx / REF.mpx); R.set('rc c0', k * COST[name].fixed * 0.9); R.set('probe', k * COST[name].fixed * 0.1); R.set('composite', 16);   // (a render pass, excluded from the total like the real ones)
    };
    return E;
  };
  const pump = (E: any, q: any, frames: number) => { let decided = 0; for (let i = 0; i < frames; i++) { E.tick(); const was = q.calibrating; if (q.calibrating) q.calibrateTick(1 / 60); if (was && !q.calibrating) decided++; } return decided; };
  const check = (ok: boolean, what: string) => { console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${what}`); if (!ok) stateFails++; };
  console.log(`\n'auto' chosen after boot (the real Quality over a stub engine with timers; a 4.5× machine on 1440×900 @2):`);
  // (A) boots pinned low, 'auto' on the pause card
  {
    store.clear(); store.set('twopointsix.quality', 'low');
    const E = mkEngine(4.5); const q = new Q2(E as never, { params: { rbIters: 4 } } as never); E.q = q; let fired = 0; q.onCalibrated = () => { fired++; };
    check(!q.auto && q.current === 'low' && !q.calibrating, `pinned boot: auto ${q.auto}, at ${q.current}, calibrating ${q.calibrating} (want false / low / false)`);
    const idle = pump(E, q, 120); check(idle === 0 && !q.calibrating, `two seconds pinned: no calibration runs (${idle} decisions)`);
    q.setAuto(); const startedAt = q.current; const note0 = q.lastChange;
    check(q.auto && q.calibrating && /calibrating/.test(note0), `setAuto → auto ${q.auto}, calibrating ${q.calibrating}, note “${note0}”`);
    const d1 = pump(E, q, 100); const settled = `${q.current} ×${E.settings.renderScale.toFixed(2)}`;
    check(d1 === 1 && !q.calibrating && /^calibrated/.test(q.lastChange) && fired === 1, `~1.3 s behind the card: decided ${d1}× (started at ${startedAt}, settled ${settled}), onCalibrated fired ${fired}×, note “${q.lastChange}”`);
    const d2 = pump(E, q, 300); check(d2 === 0 && `${q.current} ×${E.settings.renderScale.toFixed(2)}` === settled, `then quiet: ${d2} more decisions over 5 s, still ${q.current} ×${E.settings.renderScale.toFixed(2)}`);
    check(store.get('twopointsix.quality') === 'auto' && store.get('twopointsix.autoPreset') === q.current && Math.abs(Number(store.get('twopointsix.autoScaleRel')) - E.settings.renderScale) < 1e-6 && !store.has('twopointsix.autoScale'), `remembered: mode ${store.get('twopointsix.quality')}, autoPreset ${store.get('twopointsix.autoPreset')}, autoScaleRel ${store.get('twopointsix.autoScaleRel')} (the pre-08-11 window-relative 'autoScale' key is neither written nor read: ${store.get('twopointsix.autoScale')})`);
  }
  // (B) auto boot on the same slow machine → settles; pin ultra; 'auto' again → starts from the settled pick, not high ×1.0, and re-measures once
  {
    store.clear();
    const E = mkEngine(4.5); const q = new Q2(E as never, { params: { rbIters: 4 } } as never); E.q = q;
    check(q.auto && q.calibrating && q.current === 'high', `first visit: auto, calibrating from ${q.current}`);
    const d0 = pump(E, q, 100); const first = { preset: q.current, scale: E.settings.renderScale };
    check(d0 === 1 && (AUTO_LADDER as string[]).indexOf(first.preset) < (AUTO_LADDER as string[]).indexOf('high'), `boot calibration: decided ${d0}× → ${first.preset} ×${first.scale.toFixed(2)} (“${q.lastChange}”)`);
    q.pin('ultra'); const dPinned = pump(E, q, 120);
    check(!q.auto && q.current === 'ultra' && dPinned === 0, `pin ultra: auto ${q.auto}, ${q.current}, ${dPinned} decisions while pinned`);
    q.setAuto();
    check(q.current === first.preset && Math.abs(E.settings.renderScale - first.scale) < 1e-6 && q.calibrating, `setAuto: starts at ${q.current} ×${E.settings.renderScale.toFixed(2)} = what auto settled on here (not high ×1.00), calibrating ${q.calibrating} (“${q.lastChange}”)`);
    const d3 = pump(E, q, 100);
    check(d3 === 1 && !q.calibrating && q.current === first.preset && Math.abs(E.settings.renderScale - first.scale) < 0.02, `re-measured once behind the card: ${q.current} ×${E.settings.renderScale.toFixed(2)} — the same answer from the same machine, no crawl (“${q.lastChange}”)`);
  }
  // (C) ?quality= style pin for the visit (auto = false + apply, no pin()) then 'auto': same path as (A)
  {
    store.clear();
    const E = mkEngine(1); const q = new Q2(E as never, { params: { rbIters: 4 } } as never); E.q = q;
    pump(E, q, 100);                                   // the fast machine settles on its first visit (high ×0.77 since TAAU: 0.59× the pixels puts the reference M4 Max back under the 15 ms budget at high; medium ×1.0 before)
    const settledAt = q.current as QualityName;
    q.auto = false; q.apply('medium');                 // main.ts ?quality=medium
    const dq = pump(E, q, 120); check(dq === 0 && !q.calibrating, `?quality=medium: nothing calibrates while it holds (${dq})`);
    q.setAuto(); check(q.current === settledAt && q.calibrating, `setAuto on the fast machine: from its remembered ${q.current} (auto settled at ${settledAt} on the first visit), calibrating`);
    const dd = pump(E, q, 100); check(dd === 1 && q.current === settledAt && Math.abs(E.settings.renderScale - PRESETS[settledAt].scale) < 1e-6, `settles once: ${q.current} ×${E.settings.renderScale.toFixed(2)} (${settledAt} at its own starting scale ×${PRESETS[settledAt].scale})`);
  }
  // (D) the runtime ladder must actually CUT when frames are slow — and every cut must be a real cut in pixels (08-10 field dumps: eff sat pinned at the cap for
  //     whole sessions at 33–54 fps while lastChange announced 'adaptive ↓ scale 1.00' — a trailing comment had swallowed the renderScale assignment; and before
  //     08-11 the top of the scale's travel was dead under a HiDPI cap anyway). Also: steps ≥ SCALE_STEP, on the grid, never closer than LADDER.stepCooldown,
  //     never under the floor; and pixels come back when it is fast again.
  {
    store.clear();
    const { LADDER: LD, SCALE_FLOOR: FLOOR } = await import('../../src/ui/quality.ts');
    const E = mkEngine(1); const q = new Q2(E as never, { params: { rbIters: 4 } } as never); E.q = q;
    q.auto = false; q.apply('high'); (q as any).adaptive = true; (q as any).calib = { ...(q as any).calib, done: true };
    const eff0 = E.effectiveScale, rows0 = Math.floor(1800 * eff0);   // high's 1000-row cap on 900 CSS × 2 = eff 0.556 at render scale 1.0
    const steps: { t: number; scale: number; eff: number }[] = []; let t = 0, lastScale = E.settings.renderScale;
    const run = (secs: number, dt: number) => { for (let i = 0; i < Math.round(secs / dt); i++) { t += dt; q.sample(dt); if (E.settings.renderScale !== lastScale) { steps.push({ t, scale: E.settings.renderScale, eff: E.effectiveScale }); lastScale = E.settings.renderScale; } } };
    run(8, 1 / 40);                                                 // eight seconds of 40 fps frames
    const cuts = steps.length;
    check(E.settings.renderScale < 1 - 1e-3 && E.effectiveScale < eff0 - 0.01 && /adaptive ↓ scale 0\./.test(q.lastChange), `slow frames: the ladder really cuts, in pixels (render scale 1.00 → ${E.settings.renderScale.toFixed(2)}; ${rows0} → ${Math.floor(1800 * E.effectiveScale)} rows; “${q.lastChange}”)`);
    const gaps = steps.slice(1).map((s, i) => s.t - steps[i].t), sizes = steps.map((s, i) => Math.abs(s.scale - (i ? steps[i - 1].scale : 1)));
    const onGrid = steps.every(s => Math.abs(s.scale / SCALE_STEP - Math.round(s.scale / SCALE_STEP)) < 1e-6);
    check(cuts >= 1 && gaps.every(g => g >= LD.stepCooldown - 1e-6) && sizes.every(z => z >= SCALE_STEP - 1e-6) && onGrid && steps.every(s => s.scale >= FLOOR - 1e-6),
      `${cuts} cut(s) at t = ${steps.map(s => s.t.toFixed(1)).join(' / ')} s → scales ${steps.map(s => s.scale.toFixed(2)).join(' / ')}: gaps ≥ ${LD.stepCooldown} s (${gaps.map(g => g.toFixed(1)).join(', ') || '—'}), steps ≥ ${SCALE_STEP}, on the grid, ≥ floor ${FLOOR}`);
    const cut = E.settings.renderScale; const nCut = steps.length;
    run(12, 1 / 70);                                                // then twelve seconds comfortably fast: it gives pixels back, up to the preset's own scale
    const ups = steps.slice(nCut); const upGaps = ups.slice(1).map((s, i) => s.t - ups[i].t);
    check(E.settings.renderScale > cut + 0.01 && upGaps.every(g => g >= LD.stepCooldown - 1e-6) && ups.every(s => Math.abs(s.scale / SCALE_STEP - Math.round(s.scale / SCALE_STEP)) < 1e-6), `fast again: pixels come back (${cut.toFixed(2)} → ${E.settings.renderScale.toFixed(2)} in ${ups.length} step(s), gaps ${upGaps.map(g => g.toFixed(1)).join(', ') || '—'} s)`);
    run(30, 1 / 40);                                                // and a long starve pinned at high (auto off): down to the floor and no further
    check(Math.abs(E.settings.renderScale - FLOOR) < 1e-6, `a 30 s starve pinned at high stops at the floor: render scale ${E.settings.renderScale.toFixed(2)} = ${Math.floor(1800 * E.effectiveScale)} rows (floor ${FLOOR} of the ${rows0}-row cap)`);
  }
  // (E) THE HEADROOM-AWARE CLIMB (GI in motion, quality.ts CLIMB): pinned high, adaptive on, presented at 60 fps with the GPU union handed to sample(). With the union well
  //     under 60 % of the 16.7-ms budget it must climb — scale first, 0.05 a rung, ≥ climbGap apart, never past 1.0, then the gather's divisor — and with the union over
  //     80 % (or the frame rate under 55) it must undo the newest rung at once, hold that rung off for failSecs, and never oscillate; with no union at all it never acts;
  //     under auto below the top of the ladder the PRESET goes up instead.
  {
    store.clear();
    const { CLIMB: CL, LADDER: LD } = await import('../../src/ui/quality.ts');
    console.log(`\nThe headroom-aware climb (CLIMB: headroom ${CL.headroom} / divisors ${CL.divisorRoom} / back-off ${CL.backoff} of a ${CL.budgetFps}-fps budget, ${CL.windows} windows, gap ${CL.climbGap} s, fail hold ${CL.failSecs} s):`);
    const mk = () => { const E = mkEngine(1); const q = new Q2(E as never, { params: { rbIters: 4 } } as never); E.q = q; q.auto = false; q.apply('high'); (q as any).adaptive = true; (q as any).calib = { ...(q as any).calib, done: true }; return { E, q }; };
    type Ev = { t: number; scale: number; g3: boolean; v4: boolean; maxH: number; note: string };
    /** CLOSED LOOP: the union re-derived every window from what is being RENDERED (presetCost of the live preset — scale, divisors, cap — × k, on the stub's 1440×900 @2 window), so a rung the
     *  climb takes makes the next window dearer and a hop is priced against a union that moved; `k` = the machine (ms of union per modelled ms). fps fixed (the rate is not modelled here). */
    const liveUnion = (q: any, E: any, k: number) => { const S = E.settings; const name = q.current as QualityName; const pc = PRESETS[name]; const live = { ...pc, lossy: { ...pc.lossy, gatherThird: !!S.gatherThird, volQuarter: !!S.volQuarter, rcHalfRate: !!S.rcHalfRate }, maxH: S.maxInternalHeight || pc.maxH, scale: S.renderScale }; const c = presetCost(live as any); const rows = Math.min(live.maxH, 900 * 2) * S.renderScale; const mpx = rows * rows * (1440 / 900) / 1e6; return k * (c.fixed + c.pixel * mpx / REF.mpx); };
    const driveLive = (q: any, E: any, secs: number, fps: number, k: number, log: Ev[], t0: { t: number }) => { const dt = 1 / fps; let last = JSON.stringify([q.current, E.settings.renderScale, E.settings.gatherThird, E.settings.volQuarter]); for (let w = 0; w < secs; w++) { const u = liveUnion(q, E, k); for (let i = 0; i < fps; i++) { t0.t += dt; q.sample(dt, u); const now = JSON.stringify([q.current, E.settings.renderScale, E.settings.gatherThird, E.settings.volQuarter]); if (now !== last) { log.push({ t: t0.t, scale: E.settings.renderScale, g3: E.settings.gatherThird, v4: E.settings.volQuarter, maxH: E.settings.maxInternalHeight, note: `${q.lastChange} [∪ ${u.toFixed(1)}]` }); last = now; } } } };
    const drive = (q: any, E: any, secs: number, fps: number, union: number, log: Ev[], t0: { t: number }) => { const dt = 1 / fps; let last = JSON.stringify([E.settings.renderScale, E.settings.gatherThird, E.settings.volQuarter, E.settings.maxInternalHeight]); for (let i = 0; i < Math.round(secs * fps); i++) { t0.t += dt; q.sample(dt, union); const now = JSON.stringify([E.settings.renderScale, E.settings.gatherThird, E.settings.volQuarter, E.settings.maxInternalHeight]); if (now !== last) { log.push({ t: t0.t, scale: E.settings.renderScale, g3: E.settings.gatherThird, v4: E.settings.volQuarter, maxH: E.settings.maxInternalHeight, note: q.lastChange }); last = now; } } };
    // E1: climbs with headroom — the scale to its TOP (0.95 while sharp direct rides under TAAU: at 1.0 there is nothing to decouple and the resolve configuration would switch off), then the divisors
    { const { E, q } = mk(); const log: Ev[] = []; const T = { t: 0 }; const s0 = E.settings.renderScale; const topWant = E.settings.sharpDirect && E.settings.taau !== false ? 0.95 : 1.0;
      drive(q, E, 60, 60, 8.0, log, T);   // a minute at 60 fps with the GPU 8 ms busy of 16.7 (48 %)
      const scaleRungs = log.filter(e => /climb ↑ scale/.test(e.note)); const gaps = log.slice(1).map((e, i) => e.t - log[i].t);
      const orderOk = (() => { let sawGather = false; for (const e of log) { if (/gather/.test(e.note)) sawGather = true; else if (/climb ↑ scale/.test(e.note) && sawGather) return false; } return true; })();
      check(scaleRungs.length >= 3 && Math.abs(E.settings.renderScale - topWant) < 1e-6 && log.every(e => e.scale <= topWant + 1e-9), `headroom (∪ 8 ms @ 60 fps): the scale climbs ${s0.toFixed(2)} → ${scaleRungs.map(e => e.scale.toFixed(2)).join(' → ')} and stops at ${topWant.toFixed(2)} (sharp direct ${E.settings.sharpDirect ? 'on: 1.0 would switch it off' : 'off'}), never above`);
      check(gaps.every(g => g >= CL.climbGap - 1e-6) && log[0].t >= CL.windows - 1e-6, `≥ ${CL.climbGap} s between climbs (gaps ${gaps.map(g => g.toFixed(1)).join(', ')}), the first only after ${CL.windows} roomy windows (t = ${log[0].t.toFixed(1)} s)`);
      check(!E.settings.gatherThird && orderOk && log.filter(e => /gather/.test(e.note)).length === 1, `then the divisors, in order: gather ⅓ → ½ once the scale is at its top (gatherThird ${E.settings.gatherThird}); no scale rung after a divisor rung; volQuarter untouched at high (${E.settings.volQuarter} — the preset never had it)`);
      check(E.settings.maxInternalHeight === PRESETS.high.maxH, `capClimb off: the output cap stays at ${E.settings.maxInternalHeight}`);
      // E2: back-off on the GPU: the union jumps to 14 ms (84 %) → the newest rung (the gather) is undone within about a window, then a scale rung per window + cooldown; failed rungs are held
      const nUp = log.length; drive(q, E, 1.6, 60, 14.0, log, T);
      const firstUndo = log[nUp];
      check(!!firstUndo && firstUndo.g3 === true && /undid gather/.test(firstUndo.note), `∪ 14 ms: the newest rung goes first and at once — “${firstUndo?.note}” at t = ${firstUndo?.t.toFixed(1)} s`);
      drive(q, E, 12, 60, 14.0, log, T);
      const downs = log.slice(nUp); const failedNow = (q as any).climbState.failed as string[];
      check(downs.length >= 3 && downs.slice(1).every((e, i) => e.scale <= downs[i].scale + 1e-9) && E.settings.renderScale < topWant && failedNow.length >= 3, `held over the band: rungs come off one by one, newest first (${downs.map(e => /undid (\S+)/.exec(e.note)?.[1] ?? '?').join(', ')}), scale now ${E.settings.renderScale.toFixed(2)}, ${failedNow.length} rungs held off`);
      // E3: no oscillation: headroom straight back (8 ms) — the rungs that just failed stay off for their hold; nothing re-climbs inside it past the lowest failed scale; a rung failing AGAIN doubles its hold
      const nDown = log.length; const scaleBefore = E.settings.renderScale; drive(q, E, 40, 60, 8.0, log, T);
      const reclimbs = log.slice(nDown).filter(e => /climb ↑/.test(e.note));
      const lowestFailedScale = Math.min(...failedNow.filter(f => f.startsWith('scale:')).map(f => parseFloat(f.slice(6))));
      check(reclimbs.every(e => e.scale < lowestFailedScale - 1e-6 || !/scale/.test(e.note)) && !reclimbs.some(e => /gather/.test(e.note)), `headroom back for 40 s: no failed rung re-taken inside its hold (re-climbs: ${reclimbs.map(e => /scale/.test(e.note) ? e.scale.toFixed(2) : 'gather').join(', ') || 'none'}; lowest failed scale ${isFinite(lowestFailedScale) ? lowestFailedScale.toFixed(2) : '—'}, from ${scaleBefore.toFixed(2)})`);
      drive(q, E, 40, 60, 8.0, log, T);   // past the hold (60 s since the failures): it may climb again
      check(E.settings.renderScale > scaleBefore + 1e-6 || reclimbs.length > 0, `after the hold it climbs again (scale ${E.settings.renderScale.toFixed(2)})`);
      const n2 = log.length; drive(q, E, 4.2, 60, 14.0, log, T); const again = log.slice(n2).find(e => /undid/.test(e.note));
      check(!!again && /held 120 s/.test(again.note), `the same rung failing a second time is held twice as long — “${again?.note}”`);
    }
    // E4: fps dips count as no headroom: 50 fps with an idle GPU never climbs; and two windows under 55 with rungs standing drop ALL of them at once (a load spike must not wait a window per rung), the newest held off
    { const { E, q } = mk(); const log: Ev[] = []; const T = { t: 0 };
      drive(q, E, 20, 50, 6.0, log, T);
      check(log.filter(e => /climb ↑/.test(e.note)).length === 0, `50 fps with the GPU idle (∪ 6 ms): no climb (${log.length} changes: ${log.map(e => e.note).join(' | ') || 'none'})`);
      drive(q, E, 50, 60, 6.0, log, T); const up = log.filter(e => /climb ↑/.test(e.note)).length; const standing = ((q as any).climbState.standing as string[]).length;
      const nB = log.length; drive(q, E, 3.2, 50, 6.0, log, T); const dropAll = log.slice(nB).find(e => /all rungs/.test(e.note));
      check(up >= 2 && standing >= 2 && !!dropAll && Math.abs(dropAll.scale - PRESETS.high.scale) < 1e-9 && ((q as any).climbState.standing as string[]).length === 0 && ((q as any).climbState.failed as string[]).length === 1, `then 60 fps: ${up} climbs (${standing} standing, the last well before the dip); then 50 fps: within two windows every rung comes off at once, back to the preset's ×${PRESETS.high.scale} — “${dropAll?.note}” — one rung (the newest) held off`);
      // E4b: a dip that begins RIGHT AFTER a climb is that rung's doing: only the newest comes off
      const { E: E2, q: q2 } = mk(); const log2: Ev[] = []; const T2 = { t: 0 };
      drive(q2, E2, 12, 60, 8.0, log2, T2); const st2 = ((q2 as any).climbState.standing as string[]).slice();
      const n2 = log2.length; drive(q2, E2, 3.2, 50, 8.0, log2, T2); const undo = log2.slice(n2).find(e => /undid/.test(e.note));
      check(st2.length >= 2 && !!undo && ((q2 as any).climbState.standing as string[]).length === st2.length - 1, `a dip straight after a climb (${st2.length} standing, the last ${'<'} 6 s old): only the newest comes off — “${undo?.note}” — ${((q2 as any).climbState.standing as string[]).length} still standing`);
    }
    // E5: no GPU timings (union 0): never acts, however fast
    { const { E, q } = mk(); const log: Ev[] = []; const T = { t: 0 }; drive(q, E, 30, 60, 0, log, T); check(log.length === 0 && Math.abs(E.settings.renderScale - PRESETS.high.scale) < 1e-9, `no union handed in: nothing moves in 30 s at 60 fps (scale ${E.settings.renderScale.toFixed(2)})`); }
    // E6: the switch off = the ladder as it was: same 60 s of headroom, ladderClimb false → nothing climbs
    { const { E, q } = mk(); E.settings.ladderClimb = false; const log: Ev[] = []; const T = { t: 0 }; drive(q, E, 60, 60, 8.0, log, T); check(log.length === 0, `ladderClimb off: nothing climbs (${log.length} changes)`); }
    // E7: under AUTO at medium with headroom the preset goes up first (the cruising rule), not the scale — AT EXACTLY 60.0 fps: a 60 Hz display's rAF never averages better, and the old
    // 'avg > 62 fps' cruising test could not fire on one (auto ↑ only ever happened on faster panels; a machine calibrated low during a loaded boot stayed low all session)
    { store.clear(); const E = mkEngine(1); const q = new Q2(E as never, { params: { rbIters: 4 } } as never); E.q = q; pump(E, q, 100); q.apply('medium'); (q as any).calib = { ...(q as any).calib, done: true };
      const log: Ev[] = []; const T = { t: 0 }; const p0 = q.current; drive(q, E, 20, 60.0, 6.0, log, T);
      check(p0 === 'medium' && q.current === 'high' && !log.some(e => /climb ↑ scale/.test(e.note) && e.t < (log.find(x => /preset|auto ↑/.test(x.note))?.t ?? 1e9)), `auto at medium, 60.0 fps (a 60 Hz panel), ∪ 6 ms: ${p0} → ${q.current} by the cruising rule before any scale climb (${log.map(e => e.note.split(' (')[0]).join(' | ')})`); }
    // E7b (CLOSED LOOP — the union follows what is rendered): a medium machine whose union is 9.5 ms at ×0.67: high is priced ~×1.7 = 16 ms → no hop; the scale climbs a rung or two on the
    // room there is, each rung making the window dearer, and — union × hopRatio being invariant under its own rungs — it never talks itself into the hop; a LOW machine at 9.5 ms likewise
    // (medium ≈ ×2.1: the flat '×2' rule hopped it, fell to ~41 fps, came back and cycled every ~15 s); WITHOUT timings (union 0) the rate alone decides, over twice the windows
    { store.clear(); const E = mkEngine(1); const q = new Q2(E as never, { params: { rbIters: 4 } } as never); E.q = q; pump(E, q, 100); q.apply('medium'); (q as any).calib = { ...(q as any).calib, done: true };
      const k = 9.5 / liveUnion(q, E, 1); const log: Ev[] = []; const T = { t: 0 }; driveLive(q, E, 60, 60.0, k, log, T);
      check(q.current === 'medium' && E.settings.renderScale > PRESETS.medium.scale + 1e-6, `closed loop, medium, ∪ 9.5 ms at ×${PRESETS.medium.scale}: after 60 s still ${q.current}, scale ${E.settings.renderScale.toFixed(2)} (∪ now ${liveUnion(q, E, k).toFixed(1)}; high priced ×${q.hopRatio('high').toFixed(2)} = ${(liveUnion(q, E, k) * q.hopRatio('high')).toFixed(1)} ms vs ${(0.9 * PLAN_BUDGET_MS).toFixed(1)}) — ${log.map(e => e.note.split(' (')[0]).join(' | ') || 'no changes'}`);
      store.clear(); const E4 = mkEngine(1); const q4 = new Q2(E4 as never, { params: { rbIters: 4 } } as never); E4.q = q4; pump(E4, q4, 100); q4.apply('low'); (q4 as any).calib = { ...(q4 as any).calib, done: true };
      const k4 = 9.5 / liveUnion(q4, E4, 1); const log4: Ev[] = []; const T4 = { t: 0 }; driveLive(q4, E4, 90, 60.0, k4, log4, T4);
      check(q4.current === 'low', `closed loop, low, ∪ 9.5 ms at ×${PRESETS.low.scale}: after 90 s still ${q4.current}, scale ${E4.settings.renderScale.toFixed(2)} (medium priced ×${q4.hopRatio('medium').toFixed(2)} = ${(liveUnion(q4, E4, k4) * q4.hopRatio('medium')).toFixed(1)} ms) — ${log4.map(e => e.note.split(' (')[0]).join(' | ') || 'no changes'}`);
      store.clear(); const E3 = mkEngine(1); const q3 = new Q2(E3 as never, { params: { rbIters: 4 } } as never); E3.q = q3; pump(E3, q3, 100); q3.apply('medium'); (q3 as any).calib = { ...(q3 as any).calib, done: true };
      const log3: Ev[] = []; const T3 = { t: 0 }; drive(q3, E3, 8, 60.0, 0, log3, T3); const early = q3.current; drive(q3, E3, 10, 60.0, 0, log3, T3);
      check(early === 'medium' && q3.current === 'high', `no GPU timings, 60.0 fps: still medium after 8 s (${early}), high after 18 s (${q3.current}) — the rate alone, twice the windows`);
      // a hop that comes straight back down is held off (doubling) and the hold survives the apply()s; after the hold it is re-tried on REAL room (closed loop: medium's own rungs neither fake room nor block it)
      store.clear(); const E5 = mkEngine(1); const q5 = new Q2(E5 as never, { params: { rbIters: 4 } } as never); E5.q = q5; pump(E5, q5, 100); q5.apply('medium'); (q5 as any).calib = { ...(q5 as any).calib, done: true };
      const k5 = 6.0 / liveUnion(q5, E5, 1); const log5: Ev[] = []; const T5 = { t: 0 }; driveLive(q5, E5, 12, 60.0, k5, log5, T5); const hopped = q5.current;
      for (let s2 = 0; s2 < 24 && q5.current === 'high'; s2++) drive(q5, E5, 1, 36, 14.0, log5, T5);   // (high turns out starved on this machine — a scene the model under-priced)
      const back = q5.current; const heldNote = log5.map(e => e.note).find(n => /auto ↓/.test(n)) ?? '';
      driveLive(q5, E5, 30, 60.0, k5, log5, T5); const during = q5.current;
      driveLive(q5, E5, 60, 60.0, k5, log5, T5);
      check(hopped === 'high' && back === 'medium' && /held off/.test(heldNote) && during === 'medium' && q5.current === 'high', `closed loop: medium ∪ 6 → ${hopped}; starved there → ${back} (“${heldNote.split(' [')[0]}”); ∪ 6-ish at medium for 30 s → still ${during} (held); a minute on → ${q5.current} (re-tried after the hold, over the rungs the climb put up meanwhile)`); }
    // E7c: the climb itself on a 60.0 Hz-capped machine with the GPU 9 ms busy at high (pinned from a menu): it climbs
    { const { E, q } = mk(); const log: Ev[] = []; const T = { t: 0 }; drive(q, E, 30, 60.0, 9.0, log, T);
      check(log.filter(e => /climb ↑/.test(e.note)).length >= 2 && E.settings.renderScale > PRESETS.high.scale + 1e-6, `60.0 fps exactly, ∪ 9 ms at high: climbs (${log.map(e => e.note.split(' (')[0]).join(' | ')})`); }
    // E8: capClimb: past 1.0 and the divisors the cap climbs in CLIMB.capStep rows toward the window's 1800 device rows, never past them
    { const { E, q } = mk(); E.settings.capClimb = true; const log: Ev[] = []; const T = { t: 0 }; drive(q, E, 140, 60, 5.0, log, T);
      const caps = log.filter(e => /cap \d+ rows/.test(e.note)).map(e => e.maxH);
      check(caps.length >= 2 && caps[0] === PRESETS.high.maxH + CL.capStep && caps.every((c, i) => c <= 1800 && (i === 0 || c === Math.min(1800, caps[i - 1] + CL.capStep))), `capClimb on, ∪ 5 ms for 140 s: the cap climbs ${PRESETS.high.maxH} → ${caps.join(' → ')} (steps of ${CL.capStep}, ≤ the window's 1800 rows)`); }
    void LD;
  }
}
if (stateFails) { console.log(`\n${stateFails} state check(s) FAILED`); process.exit(1); }
