// CUT BOXES — the cost A/B across TWO BUILDS, frame by frame (the in-page instrument is tools/qa/cut-cost.js; this drives two pages of it under headless Chromium).
// Page A boots with ?cutboxes, page B with ?nocutboxes; each stages the same case from the same seeded restart; then the configs are sampled in ALTERNATING rounds
// (A·cut, B·plain, A·plain | reversed | …), one page rendering at a time, every frame serialized — so drift and a busy machine land on both sides alike.
//   node tools/qa/cut-cost-run.cjs --base http://localhost:5199 --cases calm,pool --quality high --w 640 --h 360 --rounds 2 --n 6 --warm 1 --out docs/perf/cut-cost-sw.json [--flags glassbreak]
// On a machine without a GPU the adapter is SwiftShader (the flag set of rebuild/iteration/probe.md §4): its milliseconds are a CPU rasteriser's — read the RATIOS.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'); const path = require('path');
const A = {}; for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (!k.startsWith('--')) continue; const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) A[k.slice(2)] = true; else { A[k.slice(2)] = v; i++; } }
const BASE = A.base || 'http://localhost:5199', W = Number(A.w || 640), H = Number(A.h || 360), ROUNDS = Number(A.rounds || 2), N = Number(A.n || 6), WARM = Number(A.warm ?? 1);
const CASES = String(A.cases || 'calm,pool').split(','), QUALITY = A.quality || 'high';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(); const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
const sorted = a => [...a].filter(Number.isFinite).sort((x, y) => x - y); const q = (a, p) => { const b = sorted(a); return b.length ? b[Math.min(b.length - 1, Math.floor(p * b.length))] : NaN; };

async function boot(tag, flag) {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('console', m => { const s = m.text(); if (m.type() === 'error' && !/smoke|number of storage textures \(5\)|Failed to load resource/i.test(s)) errs.push(s.slice(0, 400)); if (/^cut-cost stage/.test(s)) log(tag, s.slice(0, 1500)); });
  page.on('pageerror', e => errs.push('pageerror ' + String(e).slice(0, 400)));
  await page.goto(`${BASE}/?paused&mute&quality=${QUALITY}&${flag}${A.flags ? '&' + A.flags : ''}`);
  const info = await page.evaluate(async ([emit]) => {
    await window.__ready; window.__testVisible = true; window.__pauseLoop = true; window.__menu.close();
    const dev = window.__engine.device; window.__ccErrs = []; dev.addEventListener('uncapturederror', ev => window.__ccErrs.push(String(ev.error && ev.error.message).slice(0, 300)));
    if (emit) await import(emit);
    await import('/qa/cut-cost.js'); window.__cc.OPT.smoke = false; await window.__cc.emitters();
    const e = window.__engine; return { on: window.__cc.on, adapter: e.gpu.adapterInfo, internal: [e.width, e.height], out: [e.outWidth, e.outHeight], timer: e.timer.enabled, pipelines: window.__boot && window.__boot.pipelines, preset: window.__quality && window.__quality.current, programs: window.__cut && window.__cut.programs && window.__cut.programs.info, emit: Object.keys(window.__cc.EMIT) };
  }, [null]);
  log(tag, 'ready', JSON.stringify(info));
  return { tag, browser, page, info, errs };
}

(async () => {
  const [PA, PB] = await Promise.all([boot('A(on)', 'cutboxes'), boot('B(off)', 'nocutboxes')]);
  if (!PA.info.on || PB.info.on) { console.error('the switch did not land: A', PA.info.on, 'B', PB.info.on); process.exit(2); }
  const out = { when: new Date().toISOString(), base: BASE, quality: QUALITY, css: [W, H], rounds: ROUNDS, n: N, warm: WARM, A: PA.info, B: PB.info, cases: {} };
  const sample = (P, cfg) => P.page.evaluate(([c, n, w]) => window.__cc.sample(c, n, w), [cfg, N, WARM]);
  for (const name of CASES) {
    const opt = name === 'pool' && A.mix ? { mix: A.mix } : {};
    const [cA, cB] = [await PA.page.evaluate(([n, o]) => window.__cc.stage(n, o), [name, opt]), await PB.page.evaluate(([n, o]) => window.__cc.stage(n, o), [name, opt])];
    log(name, 'staged · A', JSON.stringify(cA)); log(name, 'staged · B', JSON.stringify(cB));
    const census = name === 'calm' ? null : await PA.page.evaluate(() => window.__cc.census({ step: 6 }));
    if (census) log(name, 'census', JSON.stringify(census));
    const plan = name === 'calm' ? [[PA, PA.info && PA.info.programs && PA.info.programs.swap ? 'ship' : 'cut', 'on'], [PB, 'plain', 'off']] : [[PA, 'cut', 'on'], [PB, 'plain', 'off'], [PA, 'plain', 'onPlain']];
    const acc = {}; for (const p of plan) acc[p[2]] = [];
    for (let r = 0; r < ROUNDS; r++) for (const [P, cfg, key] of (r % 2 ? [...plan].reverse() : plan)) { const rows = await sample(P, cfg); acc[key].push(...rows); log(name, `round ${r} ${key}: wall ${rows.map(x => x.wall.toFixed(0)).join(' ')} · union ${rows.map(x => Number.isFinite(x.union) ? x.union.toFixed(0) : '-').join(' ')}`); }
    await PA.page.evaluate(() => window.__cc.CONFIG.cut());
    const sum = {}; const names = new Set(); for (const rows of Object.values(acc)) for (const r of rows) for (const pn of Object.keys(r.passes)) names.add(pn);
    for (const [k, rows] of Object.entries(acc)) {
      sum[k] = { n: rows.length, wall: q(rows.map(r => r.wall), 0.5), wallLo: q(rows.map(r => r.wall), 0.25), wallHi: q(rows.map(r => r.wall), 0.75), union: q(rows.map(r => r.union), 0.5), unionLo: q(rows.map(r => r.union), 0.25), unionHi: q(rows.map(r => r.union), 0.75), sum: q(rows.map(r => r.sum), 0.5), passes: Object.fromEntries([...names].map(pn => [pn, q(rows.map(r => r.passes[pn] ?? 0), 0.5)])) }; }
    out.cases[name] = { countsOn: cA, countsOff: cB, stagedOn: await PA.page.evaluate(n => window.__cc.STAGED[n] ?? null, name), stagedOff: await PB.page.evaluate(n => window.__cc.STAGED[n] ?? null, name), census, summary: sum, raw: acc };
    if (A.out) { fs.mkdirSync(path.dirname(path.resolve(A.out)), { recursive: true }); fs.writeFileSync(A.out, JSON.stringify(out, null, 1)); }
    const off = sum.off; const line = k => `${k}: union ${sum[k].union.toFixed(0)} [${sum[k].unionLo.toFixed(0)}–${sum[k].unionHi.toFixed(0)}] wall ${sum[k].wall.toFixed(0)} [${sum[k].wallLo.toFixed(0)}–${sum[k].wallHi.toFixed(0)}]` + (k !== 'off' ? ` · vs off union ×${(sum[k].union / off.union).toFixed(4)} wall ×${(sum[k].wall / off.wall).toFixed(4)}` : '');
    for (const k of Object.keys(sum)) log(name, line(k));
    const big = [...names].filter(pn => (off.passes[pn] ?? 0) > 0.01 * off.sum).sort((a, b) => off.passes[b] - off.passes[a]);
    log(name, 'passes (off → on' + (sum.onPlain ? ' / onPlain' : '') + '): ' + big.map(pn => `${pn} ${off.passes[pn].toFixed(0)} → ${sum.on.passes[pn].toFixed(0)}${sum.onPlain ? ' / ' + sum.onPlain.passes[pn].toFixed(0) : ''}`).join(' · '));
    if (A.out) { fs.mkdirSync(path.dirname(path.resolve(A.out)), { recursive: true }); fs.writeFileSync(A.out, JSON.stringify(out, null, 1)); }
  }
  for (const P of [PA, PB]) { const g = await P.page.evaluate(() => window.__ccErrs); out[P.tag + ' errors'] = { gpu: g, console: P.errs }; log(P.tag, `GPU validation errors: ${g.length}${g.length ? ' · ' + g.slice(0, 3).join(' | ') : ''} · console errors: ${P.errs.length}${P.errs.length ? ' · ' + P.errs.slice(0, 3).join(' | ') : ''}`); }
  if (A.out) fs.writeFileSync(A.out, JSON.stringify(out, null, 1));
  await PA.browser.close(); await PB.browser.close();
})().catch(e => { console.error('SCRIPT ERROR', String(e && e.stack || e).slice(0, 2000)); process.exit(2); });
