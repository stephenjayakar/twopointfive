// A MISSION REFUSED FOR THE KEPT 'NO AI' SWITCH IS TRIED AGAIN FROM ITS CARD, ON THE REAL PAGE (headless Chromium on the software WebGPU adapter,
// tools/qa/page-look.cjs's recipe): the cheat planted in this browser's store, a rescue's own link loaded — the card must say it did not start with its
// 'no AI' box ticked; the box unticked — and the page must load the link again by itself with the rescue up, nothing said.
//   PORT=5231 node tools/qa/refused-retry-page.cjs        (a dev server on that port: PORT=5231 bun run tools/serve.ts)
// exit 0 = refused, then up after the box with no other press · 1 = otherwise / a page error
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', Q = process.env.MISSION || 'levelFile=registry.json&rescue';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage|refused: the AI is switched off/;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 }); const errors = []; let failed = false;
  const line = (ok, text) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${text}`); };
  page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
  // (planted ONCE: the init script runs again on the reload under test, where the store must be what Options left)
  await page.addInitScript(() => { try { if (!sessionStorage.getItem('planted')) { sessionStorage.setItem('planted', '1'); localStorage.setItem('twopointsix.sandbox', JSON.stringify({ noAi: true })); } } catch { /* */ } });
  await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&${Q}`);
  const A = await page.evaluate(async () => { await window.__ready; const g = window.__game; window.__loadMark = 1;
    return { ai: g.aiEnabled, up: !!(g.rescue.active || g.nightBreach.active || g.quiet.active), said: document.querySelector('#menu .refused')?.textContent || '', chip: [...document.querySelectorAll('#menu .sandbox label')].find(l => /no AI/.test(l.textContent || ''))?.querySelector('input')?.checked ? 'ticked' : '' }; });
  line(!A.ai && !A.up && /did not start/.test(A.said) && A.chip === 'ticked', `refused at boot: AI ${A.ai ? 'on' : 'off'}, mission ${A.up ? 'UP' : 'not up'} · '${A.said.slice(0, 70)}' · no AI box ${A.chip || 'NOT ticked'}`);
  const reload = page.waitForEvent('load', { timeout: 600000 });
  const B = await page.evaluate(() => { const box = [...document.querySelectorAll('#menu .sandbox label')].find(l => /no AI/.test(l.textContent || ''))?.querySelector('input');
    const before = !!box?.checked; box?.click(); return { found: !!box, before, after: !!box?.checked, ai: window.__game.aiEnabled }; }).catch(e => ({ err: String(e) }));
  line(!B.err && B.found && B.before && !B.after && B.ai, `the card's 'no AI' box unticked${B.err ? ' · ' + B.err : ''}`);
  await reload.catch(() => { failed = true; console.log('- FAIL — the page did not load again after Options closed'); });
  const C = await page.evaluate(async () => { await window.__ready; const g = window.__game;
    return { fresh: !window.__loadMark, ai: g.aiEnabled, up: !!(g.rescue.active || g.nightBreach.active || g.quiet.active), said: document.querySelector('#menu .refused')?.textContent || '', fatal: document.getElementById('fatal')?.textContent || '', q: location.search }; });
  line(C.fresh && C.ai && C.up && !C.said && !C.fatal, `loaded again by itself (${C.q}): AI ${C.ai ? 'on' : 'off'}, mission ${C.up ? 'up' : 'NOT up'}${C.said ? ` · still says '${C.said}'` : ''}${C.fatal ? ' · FATAL ' + C.fatal : ''}`);
  line(!errors.length, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
  console.log(failed ? '=== refused-retry-page: FAILED ===' : '=== refused-retry-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
