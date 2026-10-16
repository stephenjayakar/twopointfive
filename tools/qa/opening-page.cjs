// THE NIGHT'S OPENING ON THE REAL PAGE: boot the page in headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's recipe — SwiftShader, no GPU)
// twice — as it ships, and under ?fairstart=0 — and read where the page itself stood the shift (src/game/opening.ts; the headless check is opening-check.ts).
//   PORT=5231 node tools/qa/opening-page.cjs        (a dev server on that port: PORT=5231 bun run tools/serve.ts)
// exit 0 = shipped: nobody of the shift within 8 m (straight) of the spawn, and ?fairstart=0: the routes' first waypoints as before · 1 = otherwise / a page error
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  let failed = false;
  for (const [name, q, wantNear] of [['shipped', 'solo', false], ['fairstart=0', 'solo&fairstart=0', true]]) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 }); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&${q}`);
    const R = await page.evaluate(async () => { await window.__ready; const g = window.__game, s = g.level.playerSpawn;
      return { fatal: document.getElementById('fatal')?.textContent || '', men: g.guards.filter(x => !x.unit && x.team === 'guard').map(x => ({ who: x.callsign, at: [+x.char.pos[0].toFixed(1), +x.char.pos[2].toFixed(1)], wp: x.wp, d: +Math.hypot(x.char.pos[0] - s[0], x.char.pos[2] - s[2]).toFixed(1) })) }; });
    const near = R.men.filter(m => m.d < 8), ok = !R.fatal && !errors.length && R.men.length > 0 && (wantNear ? near.length > 0 : near.length === 0);
    if (!ok) failed = true;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${name}: ${R.men.map(m => `${m.who} (${m.at[0]}, ${m.at[1]}) ${m.d} m from the spawn, next waypoint ${m.wp}`).join(' · ') || 'no shift'}${R.fatal ? ' · FATAL ' + R.fatal : ''}${errors.length ? ' · errors: ' + errors.slice(0, 3).join(' | ') : ''}`);
    await page.close();
  }
  await browser.close();
  console.log(failed ? '=== opening-page: FAILED ===' : '=== opening-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
