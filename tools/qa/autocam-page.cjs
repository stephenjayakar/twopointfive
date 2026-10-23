// THE CAMERA RUNNING ITSELF, ON THE REAL PAGE (src/host/autocam.ts, host/loop.ts, host/findme.ts, ui/findme.ts): headless Chromium on the software WebGPU adapter
// (tools/qa/page-look.cjs's recipe), the page as it opens, its own Options screen clicked and its own keyboard and mouse events sent.
//   PORT=5241 node tools/qa/autocam-page.cjs     (a dev server on that port: PORT=5241 bun run tools/serve.ts)
//   row      Options > Game has the Auto camera row, Off on a fresh machine with nothing kept, and no row for the double tap of its own
//   on       a real double tap of the camera's key puts the mode on (kept in the page's store) and the view comes round to where he looks
//   frames   with the mode on the mouse carried across the screen moves the look-at nowhere; with it off the look-at follows the cursor as it always did
//   off      the key held + a real drag of the mouse gives the view back (the store keeps nothing) and that drag turns the view
//   walk     on again by the double tap; the key held with a walk key down gives it back too
//   kept     the row flipped on is kept over a reload; Reset to defaults puts it off
//   THE CAMERA'S KEY is read from the page (`__keys.camCap()`), as findme-page.cjs reads it. exit 0 = all of it with no page error · 1 = otherwise.
//   The verdict is the page's DOM, its store and the camera's numbers: nothing here judges a picture, and none of it has been seen on a GPU.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5241, QUALITY = process.env.QUALITY || 'verylow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
const LS = 'twopointsix.autocam';

const STEP = (n) => window.__runFrames(n, 1 / 60, [], false);
const WALK = (n) => window.__runFrames(n, 1 / 60, ['KeyW'], false);
const OPEN = () => { window.__menu.open('pause'); const b = [...document.querySelectorAll('#menu button')].find(x => x.textContent.trim() === 'Options'); if (!b) return 'no Options button on the pause card'; b.click();
  const t = document.querySelector('#options .op-tab[data-tab="game"]'); if (!t) return 'no Game tab'; t.click(); return ''; };
const ROWS = () => Object.fromEntries([...document.querySelectorAll('#options .op-row')].map(r => [r.querySelector('.op-label').textContent, r.querySelector('.op-switch') ? r.querySelector('.op-switch').textContent : '']));
const FLIP = (label) => { const r = [...document.querySelectorAll('#options .op-row')].find(x => x.querySelector('.op-label').textContent === label); if (!r) return `no row ${label}`; r.querySelector('.op-switch').click(); return ''; };
const RESET = () => { const b = document.querySelector('#options [data-act="reset"]'); if (!b) return 'no Reset'; b.click(); return ''; };
const SHUT = () => { document.querySelector('#options [data-act="back"]')?.click(); window.__menu.close(); if (window.__smoke) window.__smoke.params.enabled = false; window.__game.godMode = true; window.__game.aiEnabled = false; };
const VIEW = () => { const g = window.__game, c = window.__cam, f = c.planarBasis().fwd, a = g.player.char.aimYaw, p = g.player.char.pos;
  return { yaw: c.yaw, aim: a, dot: f[0] * Math.sin(a) + f[2] * Math.cos(a), lead: Math.hypot(c.desired[0] - p[0], c.desired[2] - p[2]), look: [c.desired[0], c.desired[2]], kept: localStorage.getItem('twopointsix.autocam'), fatal: (document.querySelector('#fatal') || {}).textContent || '' }; };

(async () => {
  let red = 0; const check = (ok, what, detail = '') => { if (!ok) red++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}${detail ? `\n    ${detail}` : ''}`); };
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await (await browser.newContext({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 })).newPage();
  page.setDefaultTimeout(900000); page.setDefaultNavigationTimeout(900000);   // (a boot on the software adapter is minutes, and the reload is a second one)
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  const url = `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute`, wait = ms => new Promise(r => setTimeout(r, ms));
  const boot = async (again) => { if (again) await page.reload(); else await page.goto(url); await page.evaluate(async () => { await window.__ready; }); await page.evaluate(STEP, 20); };
  const dist = (a, b) => Math.hypot(a.look[0] - b.look[0], a.look[1] - b.look[1]);
  try {
    log(url); await boot(false); log('booted');
    const cap = await page.evaluate(() => (window.__keys && window.__keys.camCap ? window.__keys.camCap() : 'Ctrl')), KEY = cap === 'Ctrl' ? 'Control' : cap;
    const twice = async () => { await wait(500); await page.keyboard.press(KEY, { delay: 40 }); await wait(60); await page.keyboard.press(KEY, { delay: 40 }); await page.evaluate(STEP, 90); return page.evaluate(VIEW); };
    // row
    let e = await page.evaluate(OPEN); if (e) throw new Error(e);
    const a = await page.evaluate(ROWS), k0 = await page.evaluate(k => localStorage.getItem(k), LS);
    check(a['Auto camera'] === 'Off' && !(`Double tap ${cap}` in a) && k0 === null, 'Options > Game has the Auto camera row, Off with nothing kept, and no row for the double tap of its own', `Auto camera: ${a['Auto camera']} · kept ${k0} · the camera's key ${cap}`);
    await page.evaluate(SHUT); await page.evaluate(STEP, 10);
    // frames, the mode off: the look-at follows the cursor
    await page.mouse.move(150, 300); await page.evaluate(STEP, 60); const f0 = await page.evaluate(VIEW);
    await page.mouse.move(880, 300); await page.evaluate(STEP, 60); const f1 = await page.evaluate(VIEW);
    // on
    await page.mouse.move(300, 520); await page.evaluate(STEP, 40); const hs = await page.evaluate(VIEW);   // (the mouse to one side of him: he faces it, and it is not ahead of the view)
    let t1 = hs; for (let tries = 0; tries < 3 && t1.kept !== '1'; tries++) t1 = await twice();
    check(hs.kept === null && t1.kept === '1' && t1.yaw !== hs.yaw && t1.dot > 0.98, `a real double tap of ${cap} puts the mode on, kept in the page's store, and the view comes round to where he looks`,
      `kept ${hs.kept} → ${t1.kept} · the view was ${(Math.acos(Math.max(-1, Math.min(1, hs.dot))) * 180 / Math.PI).toFixed(0)}° off his facing, now ${(Math.acos(Math.max(-1, Math.min(1, t1.dot))) * 180 / Math.PI).toFixed(1)}°`);
    // frames, the mode on: the mouse carried across the screen moves the look-at nowhere it would not have gone
    await page.mouse.move(150, 300); await page.evaluate(STEP, 60); const g0 = await page.evaluate(VIEW);
    await page.mouse.move(880, 300); await page.evaluate(STEP, 60); const g1 = await page.evaluate(VIEW);
    check(dist(f0, f1) > 0.5 && dist(g0, g1) < 0.05 && g1.kept === '1', 'with the mode on the mouse carried across the screen moves the look-at nowhere; with it off the look-at followed the cursor',
      `off: the look-at moved ${dist(f0, f1).toFixed(2)} m with the mouse · on: ${dist(g0, g1).toFixed(3)} m, ${g1.lead.toFixed(2)} m from his feet`);
    // off: the key held + a drag
    await page.mouse.move(400, 300); await page.evaluate(STEP, 30); const v0 = await page.evaluate(VIEW);
    await page.keyboard.down(KEY); await page.mouse.move(450, 300); await page.mouse.move(500, 300); await page.keyboard.up(KEY); await page.evaluate(STEP, 2); const v1 = await page.evaluate(VIEW);
    check(v0.kept === '1' && v1.kept === null && v1.yaw !== v0.yaw, `${cap} held + a real drag of the mouse gives the view back, and that drag turns the view`, `kept ${v0.kept} → ${v1.kept} · yaw ${(v1.yaw - v0.yaw).toFixed(4)} rad`);
    // walk: on again, then the key held with a walk key
    let w0 = v1; for (let tries = 0; tries < 3 && w0.kept !== '1'; tries++) w0 = await twice();
    await page.keyboard.down(KEY); await page.evaluate(WALK, 30); await page.keyboard.up(KEY); await page.evaluate(STEP, 2); const w1 = await page.evaluate(VIEW);
    check(w0.kept === '1' && w1.kept === null, `on again by the double tap; ${cap} held with a walk key down gives the view back too`, `kept ${w0.kept} → ${w1.kept}`);
    // kept: the row, a reload, Reset
    e = await page.evaluate(OPEN); if (e) throw new Error(e); e = await page.evaluate(FLIP, 'Auto camera'); if (e) throw new Error(e);
    const r1 = await page.evaluate(ROWS), k1 = await page.evaluate(k => localStorage.getItem(k), LS);
    log('reloading'); await boot(true); e = await page.evaluate(OPEN); if (e) throw new Error(e);
    const r2 = await page.evaluate(ROWS), k2 = await page.evaluate(k => localStorage.getItem(k), LS);
    e = await page.evaluate(RESET); if (e) throw new Error(e); const r3 = await page.evaluate(ROWS), k3 = await page.evaluate(k => localStorage.getItem(k), LS);
    check(r1['Auto camera'] === 'On' && k1 === '1' && r2['Auto camera'] === 'On' && k2 === '1' && r3['Auto camera'] === 'Off' && k3 === null, 'the row flipped on is kept over a reload; Reset to defaults puts it off',
      `flipped: ${r1['Auto camera']}, kept ${k1} · after a reload: ${r2['Auto camera']}, kept ${k2} · after Reset: ${r3['Auto camera']}, kept ${k3}`);
    const fatal = (await page.evaluate(VIEW)).fatal;
    check(!errs.length && !fatal, 'no page error, no console error, nothing on the fatal card', errs.length ? errs.slice(0, 4).join(' | ') : fatal);
  } catch (err) { red++; console.log(`- FAIL — the run stopped: ${String(err).slice(0, 400)}`); }
  await browser.close();
  console.log(red ? `\nautocam-page: FAIL (${red})` : '\nautocam-page: ALL PASS'); process.exit(red ? 1 : 0);
})();
