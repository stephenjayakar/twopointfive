// SQUADNET LOOK: a read of a teammate's line from off the screen and of a teammate down (src/game/squadnet.ts; drawn by src/ui/bubbles.ts) off the real
// page on the software WebGPU adapter — the four-man room clear, you walked off from the squad until none of them is on the screen, one of them made to say a
// line, then one put down. What is read is the HUD's own elements: the text, its class, where it is drawn against you, and the way the man it names
// lies from you on the screen (degrees, clockwise from the right) beside the way the line lies. SHOTS=1 also tries a screenshot of each (the software adapter's
// canvas can hold one up for half a minute: the canvas is hidden for it, so it shows the HUD alone).
//   node tools/qa/squadnet-look.cjs <outDir> [extra query, e.g. squadnet=0]      env: PORT (default 5199) · SIZE (default 960x540) · QUALITY (default verylow)
// Slow by nature (page-look.cjs says why): about a minute and a half to boot.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const outDir = process.argv[2] || 'squadnet-look', extra = process.argv[3] || '';
const PORT = process.env.PORT || 5199, [W, H] = (process.env.SIZE || '960x540').split('x').map(Number), QUALITY = process.env.QUALITY || 'verylow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(); const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
fs.mkdirSync(outDir, { recursive: true });
/** the bubbles as the page has them: text, class, centre in CSS px, opacity */
const READ = () => { const cv = document.querySelector('#view'), cr = cv.getBoundingClientRect(), g = window.__game, pl = g.player.char.pos, [px, py] = window.__cam.project([pl[0], pl[1] + 1.1, pl[2]], cv.clientWidth, cv.clientHeight);
  const deg = (x, y) => Math.round(Math.atan2(y - py, x - px) * 180 / Math.PI), men = {}; for (const m of g.orders.squad()) { const [mx, my] = window.__cam.project(m.char.pos, cv.clientWidth, cv.clientHeight); men[m.callsign] = deg(mx, my); }
  return { you: [Math.round(px), Math.round(py)], view: [cv.clientWidth, cv.clientHeight], men, bubbles: [...document.querySelectorAll('.bubble')].filter(e => e.style.display !== 'none').map(e => { const r = e.getBoundingClientRect(); return { text: e.textContent, cls: e.className, at: [Math.round(r.left + r.width / 2 - cr.left), Math.round(r.top + r.height / 2 - cr.top)], lies: deg(r.left + r.width / 2 - cr.left, r.bottom - cr.top), w: Math.round(r.width), op: e.style.opacity }; }) }; };
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 600)));
  page.on('console', m => { if (m.type() === 'error' && !/smoke|storage textures|Failed to load resource/i.test(m.text())) errors.push(m.text().slice(0, 300)); });
  const url = `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&roomclear&squad4&freshstart=0&nocutboxes${extra ? '&' + extra : ''}`;
  log('goto', url); await page.goto(url);
  await page.evaluate(async () => { await window.__ready; window.__testVisible = true; });
  log('ready', JSON.stringify(await page.evaluate(() => window.__knobs?.registry?.().SQUADNET)));
  // (frames are stepped undrawn: a drawn frame is seconds on the software adapter, and nothing here reads the picture)
  await page.evaluate(() => { window.__play = (n, dt) => { const e = window.__engine, real = e.render; e.render = () => {}; try { window.__runFrames(n, dt); } finally { e.render = real; } }; });
  await page.evaluate(() => { window.__menu.close(); window.__smoke.params.enabled = false; const g = window.__game; g.godMode = true; g.aiEnabled = false; window.__play(20, 1 / 60); });
  const shot = async (name) => { if (process.env.SHOTS !== '1') return; try { await page.evaluate(() => { document.querySelector('#view').style.visibility = 'hidden'; }); await page.screenshot({ path: path.join(outDir, name + '.png'), timeout: 90000 }); log('shot', name); } catch (e) { log('no shot', name, String(e).slice(0, 80)); } finally { await page.evaluate(() => { document.querySelector('#view').style.visibility = ''; }); } };
  // you, walked off: put where no teammate's head is on the screen, on each of two sides of them in turn
  const stage = (dx, dz) => page.evaluate(({ dx, dz }) => { const g = window.__game, S = g.orders.squad().filter(m => m.state !== 'dead'), c = S[0].char.pos; g.teleportPlayer([c[0] + dx, 0, c[2] + dz]); window.__play(40, 1 / 60); return { squad: S.map(m => m.callsign), on: S.map(m => window.__cam.project(m.char.bones.head ?? m.char.pos, 1, 1, 0.9)[2]) }; }, { dx, dz });
  const out = {};
  for (const [name, dx, dz] of [['east', 14, 0], ['north', 0, -12]]) {
    const st = await stage(dx, dz); log('staged', name, JSON.stringify(st));
    await page.evaluate(() => { const g = window.__game, S = g.orders.squad().filter(m => m.state !== 'dead'); g.say(S[0], 'stacked up.'); if (S[2]) g.say(S[2], "can't get there."); window.__play(12, 1 / 60); });
    out[name] = await page.evaluate(READ); log(name, JSON.stringify(out[name])); await shot(`line-${name}`);
    await page.evaluate(() => window.__play(300, 1 / 60));
  }
  // a teammate put down, off the screen and then with where he fell on it
  const down = await page.evaluate(() => { const g = window.__game, m = g.orders.squad().filter(x => x.state !== 'dead')[1]; m.god = false; m.state = 'dead'; window.__play(6, 1 / 60); return { who: m.callsign, rows: g.squadNet.rows.map(r => r.text), stats: g.squadNet.stats }; });
  log('down', JSON.stringify(down)); out.down = await page.evaluate(READ); log('down off the screen', JSON.stringify(out.down)); await shot('down-far');
  await page.evaluate(() => { const g = window.__game, r = g.squadNet.rows[0]; if (r) g.teleportPlayer([r.at[0] + 2, 0, r.at[2] + 1]); window.__play(30, 1 / 60); });
  out.downNear = await page.evaluate(READ); log('down on the screen', JSON.stringify(out.downNear)); await shot('down-near');
  fs.writeFileSync(path.join(outDir, 'read.json'), JSON.stringify({ out, errors }, null, 1));
  log(errors.length ? `ERRORS (${errors.length}): ${errors.slice(0, 5).join(' | ')}` : 'no page or console errors');
  await browser.close(); process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
