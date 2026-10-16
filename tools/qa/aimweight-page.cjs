// THE AIM'S WEIGHT ON THE REAL PAGE: boot the page in headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's recipe), start the plain night,
// draw the rifle, park the cursor to one side of Sam, then FLICK it to the other side and read the HUD's own aiming circle (the `.reticle.aim` element) against
// the cursor: a few frames after the flick the circle must still be far from the cursor and marked as trailing, and a second later it must sit on it. Then the
// same page under ?noaimweight: the switch is off and the circle is on the cursor the frame the cursor moves, as it was.
//   PORT=5231 node tools/qa/aimweight-page.cjs [outDir]        (a dev server on that port: PORT=5231 bun run tools/serve.ts; outDir = a still of each moment)
// exit 0 = both hold with no page error · 1 = otherwise
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', OUT = process.argv[2] || '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
// a still is a nicety: on the software adapter a paused page can take minutes to hand one over, and the verdict must not wait on it
const still = (page, n) => OUT ? page.screenshot({ path: `${OUT}/aimweight-${n}.png`, timeout: 45000 }).catch(() => console.log(`  (no still of ${n}: the page did not hand one over)`)) : null;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  let failed = false;
  for (const [name, q] of [['weight', ''], ['off', 'noaimweight']]) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 }); const errors = []; page.setDefaultTimeout(900000);
    page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&solo${q ? '&' + q : ''}`);
    const read = () => page.evaluate(() => { const el = document.querySelector('.reticle.aim'); if (!el || el.style.display === 'none') return null;
      const c = document.getElementById('view').getBoundingClientRect(), r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - c.left, y: r.top + r.height / 2 - c.top, trail: el.classList.contains('trail') }; });
    const boot = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; window.__menu.close(); await window.__runFrames(5);
      window.__input.pressed.add('Digit2'); await window.__runFrames(60);
      const sw = window.__knobs.registry().AIMWEIGHT;
      return { fatal: document.getElementById('fatal')?.textContent || '', on: !!(sw && sw.on), rifle: !!window.__game.player.rifleUp }; });
    const A = [760, 300], B = [200, 240];
    await page.evaluate(async ([x, y]) => { for (let i = 0; i < 45; i++) { window.__mouse(x, y); await window.__runFrames(1); } }, A);
    const rest = await read();
    await page.evaluate(async ([x, y]) => { for (let i = 0; i < 4; i++) { window.__mouse(x, y); await window.__runFrames(1); } }, B);
    const mid = await read(); await still(page, `${name}-mid`);
    await page.evaluate(async ([x, y]) => { for (let i = 0; i < 50; i++) { window.__mouse(x, y); await window.__runFrames(1); } }, B);
    const end = await read(); await still(page, `${name}-end`);
    const d = (p, c) => p ? Math.hypot(p.x - c[0], p.y - c[1]) : NaN, f = p => p ? `(${p.x.toFixed(0)}, ${p.y.toFixed(0)})${p.trail ? ' trailing' : ''}` : 'no circle';
    const want = name === 'weight';
    const ok = !boot.fatal && !errors.length && boot.rifle && boot.on === want && d(rest, A) < 40 && d(end, B) < 40 && !end.trail
      && (want ? d(mid, B) > 120 && mid.trail : d(mid, B) < 40 && !mid.trail);
    if (!ok) failed = true;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${name}: switch ${boot.on ? 'on' : 'off'} · rifle up ${boot.rifle} · circle at rest ${f(rest)} for a cursor at (${A}) · four frames after the flick to (${B}) the circle is ${f(mid)}, ${d(mid, B).toFixed(0)} px from the cursor · under a second later ${f(end)}, ${d(end, B).toFixed(0)} px from it${boot.fatal ? ' · FATAL ' + boot.fatal : ''}${errors.length ? ' · errors: ' + errors.slice(0, 3).join(' | ') : ''}`);
    await page.close();
  }
  await browser.close();
  console.log(failed ? '=== aimweight-page: FAILED ===' : '=== aimweight-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
