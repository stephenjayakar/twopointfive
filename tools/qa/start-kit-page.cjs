// THE KIT THE CARD'S OWN START HANDS SAM, ON THE REAL PAGE: boot the page in headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's recipe)
// with no mission in its URL, press nothing but Start (the card's close), and read what is on him; then the same page under ?solo. The two must carry the same
// things: the pouches rule's Sam (src/game/kit.ts kitSoloIf — main.ts asks it of the plain night whichever way it was started).
//   PORT=5231 node tools/qa/start-kit-page.cjs        (a dev server on that port: PORT=5231 bun run tools/serve.ts)
// exit 0 = Start and ?solo put the same cans, grenades and launcher rounds on him, after a restart too · 1 = otherwise / a page error
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const got = {}; let failed = false;
  for (const [name, q] of [['start', ''], ['solo', 'solo']]) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 }); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute${q ? '&' + q : ''}`);
    const R = await page.evaluate(async () => { await window.__ready; const g = window.__game;
      const kit = () => { const pl = g.player; return { smoke: pl.canisters, stun: pl.flashbangs, frags: pl.frags, shells: pl.rifle.shells, rifle: pl.hasRifle }; };
      window.__menu.close(); await window.__runFrames(3);
      const first = kit(); g.restartEncounter(); await window.__runFrames(3);
      return { fatal: document.getElementById('fatal')?.textContent || '', first, again: kit() }; });
    got[name] = R; const same = JSON.stringify(R.first) === JSON.stringify(R.again);
    if (R.fatal || errors.length || !same) failed = true;
    console.log(`- ${!R.fatal && !errors.length && same ? 'PASS' : 'FAIL'} — ${name}: ${JSON.stringify(R.first)} · after a restart ${same ? 'the same' : JSON.stringify(R.again)}${R.fatal ? ' · FATAL ' + R.fatal : ''}${errors.length ? ' · errors: ' + errors.join(' | ') : ''}`);
    await page.close();
  }
  await browser.close();
  const eq = JSON.stringify(got.start?.first) === JSON.stringify(got.solo?.first); if (!eq) failed = true;
  console.log(`- ${eq ? 'PASS' : 'FAIL'} — the card's Start hands him what ?solo does`);
  console.log(failed ? '=== start-kit-page: FAILED ===' : '=== start-kit-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
