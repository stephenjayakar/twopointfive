// CUT BOXES — the in-page instrument (tools/qa/cut-cost.js `__cc.run()`) run in ONE headless Chromium page: the same call the maintainer makes in his console, driven
// from here so it can be checked on a machine without a GPU (SwiftShader: read ratios, not milliseconds). Everything is measured inside one process: cut against
// plain on the same pieces, and — the calm case — the tracing pipelines' text with CUT_BOXES true against false through a hot swap.
//   node tools/qa/cut-cost-page.cjs --base http://localhost:5199 --flags cutboxes --cases calm,pool --rounds 2 --n 5 --warm 1 --out docs/perf/cut-cost-sw-page.json [--noswap] [--w 640 --h 360]
// The page opens with cut pieces ON whether or not --flags names cutboxes; the boxes-as-before baseline is --flags nocutboxes.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'); const path = require('path');
const A = {}; for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (!k.startsWith('--')) continue; const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) A[k.slice(2)] = true; else { A[k.slice(2)] = v; i++; } }
const BASE = A.base || 'http://localhost:5199', W = Number(A.w || 640), H = Number(A.h || 360);
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(); const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('console', m => { const s = m.text(); if (m.type() === 'error' && !/smoke|number of storage textures \(5\)|Failed to load resource/i.test(s)) errs.push(s.slice(0, 400)); if (/^(cut-cost|census)/.test(s)) log(s.slice(0, 1800)); });
  page.on('pageerror', e => errs.push('pageerror ' + String(e).slice(0, 400)));
  await page.goto(`${BASE}/?paused&mute&quality=${A.quality || 'high'}${A.flags ? '&' + A.flags : ''}`);
  const opts = { rounds: Number(A.rounds || 2), n: Number(A.n || 5), warm: Number(A.warm ?? 1), smoke: false };
  if (A.cases) opts.cases = String(A.cases).split(','); if (A.noswap) opts.swap = false; if (A.gate) opts.gate = true; if (A.mix) opts.pool = { mix: A.mix };
  const out = await page.evaluate(async o => {
    await window.__ready; window.__testVisible = true; if (window.__cut && window.__cut.programs && window.__cut.programs.swap) await window.__cut.programs.ready;   /* the second set of ray programs (render/cutSwap.ts) compiles after boot: a cut piece is traced whole until it is in */ window.__pauseLoop = true; window.__menu.close();
    const dev = window.__engine.device; const gpu = []; dev.addEventListener('uncapturederror', ev => gpu.push(String(ev.error && ev.error.message).slice(0, 300)));
    await import('/qa/cut-cost.js');
    const r = await window.__cc.run(o); r.gpuErrors = gpu; return r;
  }, opts);
  out.consoleErrors = errs;
  if (A.out) { fs.mkdirSync(path.dirname(path.resolve(A.out)), { recursive: true }); fs.writeFileSync(A.out, JSON.stringify(out, null, 1)); }
  log(`switch ${out.on ? 'ON' : 'off'} · ${out.preset} ${out.res} · ${out.adapter} · ${out.secs} s in the page`);
  console.table(out.table);
  for (const [k, c] of Object.entries(out.cases)) { log(k, 'counts', JSON.stringify(c.counts)); if (c.census) log(k, 'census', JSON.stringify(c.census)); for (const [cfg, s] of Object.entries(c.configs)) log(k, cfg, `wall ${s.wall} [${s.wallLo}–${s.wallHi}] union ${s.union} [${s.unionLo}–${s.unionHi}]`, JSON.stringify(s.passes)); }
  log(`GPU validation errors: ${out.gpuErrors.length}${out.gpuErrors.length ? ' · ' + out.gpuErrors.slice(0, 3).join(' | ') : ''} · console errors: ${errs.length}${errs.length ? ' · ' + errs.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
})().catch(e => { console.error('SCRIPT ERROR', String(e && e.stack || e).slice(0, 2000)); process.exit(2); });
