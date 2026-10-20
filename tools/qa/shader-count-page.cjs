// HOW MUCH A PAGE COMPILES (gpu/device.ts, ui/boot.ts): the real page in headless Chromium on the software WebGPU adapter, with every createShaderModule and
// create{Compute,Render}Pipeline[Async] call counted before the page's own script runs. For each page of the walk it prints
//   · shader modules made: how many, how many DISTINCT texts, their size, and the page-thread time spent inside the calls
//   · pipelines made: asynchronously (off the thread that draws) and synchronously (a compile the next submit waits for), before and after the page came ready
//   · how many of those texts and pipelines an EARLIER page of the same walk had already made, character for character — the most a browser's own shader cache
//     can hand back on that load (a text that differs by one const is a new text to it, whatever the kernel reads)
//   · which of the pipelines made before ready a pass actually took (setPipeline) in the seconds after it, and which none did: at the quality the page stands
//     at, with nobody playing — a lower bound on what the first frames need, not a list of what is safe to leave out
//   · the page's own boot line (window.__boot.line)
// and, with --settle S, what was made in the S seconds after ready with nobody touching anything (the background sets).
// --then <quality> takes the options menu's quality row once a page has settled and prints what THAT made (modules, pipelines, how many of them a repeat).
//   node tools/qa/shader-count-page.cjs [--port 5199] [--settle 4] [--then high] [--json out.json] [address …]
// An address is a query string ('?levelFile=compound.json&roomclear&squad4'); 'kit:<query>' is that mission as the Team & kit picture opens it (its own window,
// its own device). No address = the walk a first visit makes: the title, a mission's kit picture, the mission, a second mission.
// The software adapter compiles nothing like a GPU's driver does: the COUNTS are the page's, no time printed here is a price on a real machine.
// Exit 0 = every page came ready with no GPU error on its console, 1 = one did not.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const argv = process.argv.slice(2); const opt = (k, d) => { const i = argv.indexOf('--' + k); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const PORT = opt('port', process.env.PORT || 5199), SETTLE = Number(opt('settle', 4)), JSON_OUT = opt('json', null), THEN = opt('then', null);
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const WALK = argv.length ? argv : ['?', 'kit:?levelFile=compound.json&roomclear&squad4', '?levelFile=compound.json&roomclear&squad4', '?levelFile=block.json&roomclear&squad4'];
const KIT = '&kitview&mute&noreplay&kitloud';
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);

// in the page, before its script: the counters
const COUNT = () => {
  const P = typeof GPUDevice === 'function' ? GPUDevice.prototype : null; if (!P) return;
  const hash = s => { let a = 0x811c9dc5, b = 0x1b873593; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 0x85ebca6b) + (b >>> 13); } return (a >>> 0).toString(36) + (b >>> 0).toString(36); };
  const C = window.__shaderCount = { mods: [], pipes: [], ready: -1 };
  const ofMod = new WeakMap(), ofPipe = new WeakMap();
  for (const E of [typeof GPUComputePassEncoder === 'function' ? GPUComputePassEncoder : null, typeof GPURenderPassEncoder === 'function' ? GPURenderPassEncoder : null]) { if (!E) continue;
    const sp = E.prototype.setPipeline; E.prototype.setPipeline = function (p) { const row = ofPipe.get(p); if (row) { if (!row.used) row.firstUse = performance.now(); row.used++; } return sp.call(this, p); }; }
  const stage = s => s ? `${ofMod.get(s.module) ?? '?'}/${s.entryPoint ?? ''}/${JSON.stringify(s.constants ?? {})}` : '';
  const keyOf = d => hash(`${stage(d.compute)}|${stage(d.vertex)}|${stage(d.fragment)}|${JSON.stringify(d.fragment?.targets ?? null)}|${JSON.stringify(d.primitive ?? null)}|${JSON.stringify(d.depthStencil ?? null)}`);
  const sm = P.createShaderModule; P.createShaderModule = function (d) { const t = performance.now(); const m = sm.call(this, d); const h = hash(d.code); ofMod.set(m, h); C.mods.push({ label: d.label ?? '', h, chars: d.code.length, at: t, ms: performance.now() - t }); return m; };
  for (const [name, sync] of [['createComputePipeline', true], ['createRenderPipeline', true], ['createComputePipelineAsync', false], ['createRenderPipelineAsync', false]]) {
    const f = P[name]; P[name] = function (d) { const t = performance.now(); const row = { label: d.label ?? '', key: keyOf(d), sync, at: t, ms: 0, done: -1, used: 0, firstUse: -1 }; C.pipes.push(row);
      const r = f.call(this, d); row.ms = performance.now() - t; if (sync) ofPipe.set(r, row); else Promise.resolve(r).then(p => { row.done = performance.now(); if (p) ofPipe.set(p, row); }, () => { row.done = -2; }); return r; }; }
};

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const ctx = await browser.newContext({ viewport: { width: 320, height: 180 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { window.__testVisible = true; });
  await ctx.addInitScript(COUNT);
  const seenText = new Set(), seenPipe = new Set(); const out = []; let red = 0;
  for (const addr of WALK) {
    const kit = addr.startsWith('kit:'); const query = (kit ? addr.slice(4) + KIT : addr).replace(/^\?&/, '?');
    const q = new URLSearchParams(query.replace(/^\?/, '')); if (!q.has('mute')) q.set('mute', ''); if (!q.has('quality')) q.set('quality', 'medium');
    const url = `http://localhost:${PORT}/?${q.toString().replace(/=(?=&|$)/g, '')}`;
    const page = await ctx.newPage(); const errs = [], gpuErrs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
    page.on('console', m => { if (m.type() === 'error' && /WebGPU|GPU device|pipeline/i.test(m.text())) gpuErrs.push(m.text().slice(0, 300)); });
    log(url);
    const t = Date.now();
    await page.goto(url, { waitUntil: 'commit' });
    let ok = true;
    try { await page.waitForFunction(() => !!window.__ready, null, { timeout: 900000 }); await page.evaluate(async () => { await window.__ready; window.__shaderCount.ready = performance.now(); }); }
    catch (e) { ok = false; red++; console.log(`- FAIL — ${addr}: the page did not come ready — ${String(e).slice(0, 200)}${errs.length ? ` · ${errs[0]}` : ''}`); }
    const wall = (Date.now() - t) / 1000;
    if (ok && SETTLE > 0) await page.waitForTimeout(SETTLE * 1000);
    // --then <quality>: the options menu's quality row, taken once the page has settled — what a change of quality makes
    let changedAt = -1;
    if (ok && THEN) { changedAt = await page.evaluate(q => { const t = performance.now(); window.__quality.apply(q); return t; }, THEN); await page.waitForTimeout(Math.max(SETTLE, 4) * 1000); }
    const got = ok ? await page.evaluate(() => ({ c: window.__shaderCount, boot: window.__boot?.line ?? '', pl: window.__boot?.pipelines ?? null })) : null;
    await page.close();
    if (!got) continue;
    const { c } = got; const boot = x => x.at <= c.ready;
    const texts = new Set(c.mods.map(m => m.h)), keys = new Set(c.pipes.map(p => p.key));
    const row = {
      address: addr, readySecs: +wall.toFixed(1),
      modules: c.mods.length, distinctTexts: texts.size, textKB: Math.round(c.mods.reduce((s, m) => s + m.chars, 0) / 1024), moduleCallMs: Math.round(c.mods.reduce((s, m) => s + m.ms, 0)),
      modulesBeforeReady: c.mods.filter(boot).length,
      pipelines: c.pipes.length, distinctPipelines: keys.size,
      asyncBeforeReady: c.pipes.filter(p => !p.sync && boot(p)).length, syncBeforeReady: c.pipes.filter(p => p.sync && boot(p)).length,
      asyncAfterReady: c.pipes.filter(p => !p.sync && !boot(p)).length, syncAfterReady: c.pipes.filter(p => p.sync && !boot(p)).length,
      syncLabels: c.pipes.filter(p => p.sync).map(p => p.label),
      textsSeenBefore: [...texts].filter(h => seenText.has(h)).length, pipelinesSeenBefore: [...keys].filter(k => seenPipe.has(k)).length,
      repeatedInPage: c.pipes.length - keys.size,
      usedOfBoot: c.pipes.filter(p => boot(p) && p.used > 0).length, neverSet: c.pipes.filter(p => boot(p) && !p.used).map(p => p.label),
      slowest: c.pipes.filter(p => !p.sync && p.done > 0).map(p => ({ label: p.label, ms: Math.round(p.done - p.at) })).sort((a, b) => b.ms - a.ms).slice(0, 8),
      bootCounted: got.pl, boot: got.boot, gpuErrors: gpuErrs,
      labels: c.mods.map(m => `${m.label}:${m.h}`),
    };
    for (const h of texts) seenText.add(h); for (const k of keys) seenPipe.add(k);
    out.push(row);
    console.log(`  ready in ${row.readySecs} s (software adapter) · modules ${row.modules} (${row.distinctTexts} texts, ${row.textKB} KB, ${row.moduleCallMs} ms in the calls) · pipelines ${row.pipelines} (${row.distinctPipelines} distinct)`);
    console.log(`  before ready: ${row.asyncBeforeReady} async + ${row.syncBeforeReady} sync · in the ${SETTLE} s after: ${row.asyncAfterReady} async + ${row.syncAfterReady} sync${row.syncLabels.length ? ` · sync: ${row.syncLabels.join(', ')}` : ''}`);
    console.log(`  an earlier page of this walk had made ${row.textsSeenBefore} of its ${row.distinctTexts} texts and ${row.pipelinesSeenBefore} of its ${row.distinctPipelines} pipelines`);
    if (changedAt >= 0) { const after = x => x.at >= changedAt, pm = c.pipes.filter(after), mm = c.mods.filter(after); const earlier = new Set(c.pipes.filter(x => !after(x)).map(x => x.key)), earlierText = new Set(c.mods.filter(x => !after(x)).map(x => x.h));
      row.qualityChange = { to: THEN, modules: mm.length, modulesNewText: mm.filter(x => !earlierText.has(x.h)).length, sync: pm.filter(x => x.sync).map(x => x.label), async: pm.filter(x => !x.sync).map(x => x.label), again: pm.filter(x => earlier.has(x.key)).length };
      console.log(`  quality → ${THEN}: ${mm.length} modules (${row.qualityChange.modulesNewText} with a text this page had not made) · pipelines ${pm.length}: ${row.qualityChange.sync.length} sync (${row.qualityChange.sync.join(', ') || '—'}) + ${row.qualityChange.async.length} async (${row.qualityChange.async.slice(0, 12).join(', ') || '—'}) · ${row.qualityChange.again} of them the page had already made, character for character`); }
    console.log(`  of the ${row.asyncBeforeReady + row.syncBeforeReady} made before ready, a pass took ${row.usedOfBoot} in those ${SETTLE} s; never taken: ${row.neverSet.join(', ') || 'none'}`);
    if (gpuErrs.length) { red++; console.log(`- FAIL — ${addr}: ${gpuErrs.length} GPU error(s) on the console — ${gpuErrs[0]}`); } else console.log('  no GPU error on the console');
    if (row.boot) console.log(`  ${row.boot}`);
  }
  await browser.close();
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 1));
  process.exit(red ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
