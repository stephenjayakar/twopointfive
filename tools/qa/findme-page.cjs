// FINDING YOUR OWN MAN, AND THE CAMERA UNDER THE HAND, ON THE REAL PAGE (src/host/findme.ts, src/ui/findme.ts): headless Chromium on the software WebGPU
// adapter (tools/qa/page-look.cjs's recipe), the page as it opens, its own Options screen clicked and its own keyboard and mouse events sent.
//   PORT=5241 node tools/qa/findme-page.cjs [outDir]     (a dev server on that port: PORT=5241 bun run tools/serve.ts)
//   rows     Options > Game has the four rows under their two headings, all at their starts on a fresh machine (nothing kept, the camera's lead as built)
//   live     each row moved by its own control: the table is kept in the page's store at once and the camera's lead follows the pan
//   picture  with the row on, the overlay draws the ring at his feet
//   hand     a real Ctrl + mouse drag turns the view the reversed way by the same angle; a real double tap of Ctrl brings the view round to his facing, and
//            with the mouse off to one side he still faces what he faced, until a real move of the mouse; a real press held for most of a second does nothing
//   kept     after a reload the rows and the camera's lead are as they were left; Reset to defaults puts all four back, in the store too
//   exit 0 = all of it with no page error · 1 = otherwise. The verdict is the page's DOM and the game's numbers: nothing here judges a picture. With an
//   outDir it also keeps two pictures (the software adapter's frame with the page's own overlay laid on it) for a person to look at, never for the verdict.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5241, QUALITY = process.env.QUALITY || 'verylow', outDir = process.argv[2] || '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
if (outDir) fs.mkdirSync(outDir, { recursive: true });
const LS = 'twopointsix.findme', LABELS = ['Ring at your feet', 'Aim pan', 'Turn direction', 'Double tap Ctrl'];

// in the page: n frames with the HUD laid over them, the last one drawn
const STEP = (n) => window.__runFrames(n, 1 / 60, [], false);
// in the page: draw n frames one at a time, read the last one back as a PNG data URL (page-look.cjs DRAW)
const DRAW = async (n) => {
  const dev = window.__engine.device;
  const yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 600); await dev.queue.onSubmittedWorkDone(); await yieldMacro(); }
  window.__engine.render(window.__cam, window.__game.time, 1 / 60, false); const fr = await window.__engine.readbackFrame(); if (!fr) return null;
  if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
  for (let i = 0; i < fr.data.length; i += 4) fr.data[i + 3] = 255;
  const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h;
  c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0);
  return c2.toDataURL('image/png');
};
// in the page: the Options screen on its GAME tab, from the pause card
const OPEN = () => { window.__menu.open('pause'); const b = [...document.querySelectorAll('#menu button')].find(x => x.textContent.trim() === 'Options'); if (!b) return 'no Options button on the pause card'; b.click();
  const t = document.querySelector('#options .op-tab[data-tab="game"]'); if (!t) return 'no Game tab'; t.click(); return ''; };
const ROWS = () => ({ heads: [...document.querySelectorAll('#options .op-sec')].map(e => e.textContent), rows: Object.fromEntries([...document.querySelectorAll('#options .op-row')].map(r => [r.querySelector('.op-label').textContent,
  r.querySelector('.op-switch') ? r.querySelector('.op-switch').textContent : r.querySelector('.op-range') ? r.querySelector('.op-val').textContent : [...r.querySelectorAll('.op-opt.on')].map(b => b.textContent).join('|')])),
  kept: localStorage.getItem('twopointsix.findme'), lead: window.__cam.aimLead });
const MOVE = ([label, how]) => { const r = [...document.querySelectorAll('#options .op-row')].find(x => x.querySelector('.op-label').textContent === label); if (!r) return `no row ${label}`;
  if (how === 'flip') r.querySelector('.op-switch').click(); else if (typeof how === 'number') { const i = r.querySelector('.op-range'); i.value = String(how); i.dispatchEvent(new Event('input', { bubbles: true })); }
  else { const b = [...r.querySelectorAll('.op-opt')].find(x => x.textContent === how); if (!b) return `no choice ${how}`; b.click(); } return ''; };
const RESET = () => { const b = document.querySelector('#options [data-act="reset"]'); if (!b) return 'no Reset'; b.click(); return ''; };
const SHUT = () => { document.querySelector('#options [data-act="back"]')?.click(); window.__menu.close(); if (window.__smoke) window.__smoke.params.enabled = false; window.__game.godMode = true; window.__game.aiEnabled = false; };
// in the page: what the overlay has drawn
const DOM = () => { const q = s => document.querySelector(s), on = e => !!e && e.style.display !== 'none' && q('.findme').style.display !== 'none';
  return { group: !!q('.findme'), ring: on(q('.findme .fr')) ? (q('.findme .fr').getAttribute('points') || '').split(' ').length : 0, gone: !q('.findme path') && !q('.findme use') && !q('.findme filter'), fatal: (q('#fatal') || {}).textContent || '' }; };
const VIEW = () => { const g = window.__game, c = window.__cam, f = c.planarBasis().fwd, a = g.player.char.aimYaw; return { yaw: c.yaw, aim: a, orbit: window.__input.orbitDX, dot: f[0] * Math.sin(a) + f[2] * Math.cos(a) }; };
const DOT = (a) => { const f = window.__cam.planarBasis().fwd; return f[0] * Math.sin(a) + f[2] * Math.cos(a); };

(async () => {
  let red = 0; const check = (ok, what, detail = '') => { if (!ok) red++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}${detail ? `\n    ${detail}` : ''}`); };
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await (await browser.newContext({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 })).newPage();
  page.setDefaultNavigationTimeout(900000);   // (a boot on the software adapter is minutes, and the reload is a second one)
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  const url = `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute`, wait = ms => new Promise(r => setTimeout(r, ms));
  const boot = async (again) => { if (again) await page.reload(); else await page.goto(url); await page.evaluate(async () => { await window.__ready; }); await page.evaluate(STEP, 20); };
  const still = async (name) => { if (!outDir) return; const u = await page.evaluate(DRAW, 4); if (!u) return;
    await page.evaluate(src => { const v = document.getElementById('view'), i = document.createElement('img'); i.id = 'findme-still'; i.src = src; i.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;'; v.parentNode.insertBefore(i, v.nextSibling); }, u);
    await page.evaluate(STEP, 1); const shot = await page.screenshot({ path: path.join(outDir, name), timeout: 180000 }).then(() => true, () => false);   // (a picture for a person: one that will not come is said, never a red)
    await page.evaluate(() => document.getElementById('findme-still')?.remove()); log(shot ? `kept ${name}` : `no picture ${name}: the screenshot did not come`); };
  try {
    log(url); await boot(false); log('booted');
    // rows
    let e = await page.evaluate(OPEN); if (e) throw new Error(e);
    const a = await page.evaluate(ROWS), startRows = { 'Ring at your feet': 'Off', 'Aim pan': '100 %', 'Turn direction': 'Normal', 'Double tap Ctrl': 'Off' };
    const atStart = r => LABELS.every(l => r.rows[l] === startRows[l]);
    check(LABELS.every(l => l in a.rows) && !('Outline in the dark' in a.rows) && !('Shape through walls' in a.rows) && a.heads.some(h => /^Finding yourself/.test(h)) && a.heads.some(h => /^Camera/.test(h)) && atStart(a) && a.kept === null && a.lead === 0.18, 'Options > Game has the four rows (the outline and the shape are shelved: no row), all at their starts, nothing kept, the camera\'s lead as built',
      `${LABELS.map(l => `${l}: ${a.rows[l]}`).join(' · ')} · kept ${a.kept} · lead ${a.lead}`);
    // live
    for (const m of [['Ring at your feet', 'flip'], ['Aim pan', 0], ['Turn direction', 'Reversed'], ['Double tap Ctrl', 'flip']]) { e = await page.evaluate(MOVE, m); if (e) throw new Error(e); }
    const b = await page.evaluate(ROWS), want = { pan: 0, ring: true, turn: -1, behind: true }, movedRows = { 'Ring at your feet': 'On', 'Aim pan': 'None', 'Turn direction': 'Reversed', 'Double tap Ctrl': 'On' };
    const keptOk = r => { try { return JSON.stringify(JSON.parse(r.kept)) === JSON.stringify(want); } catch { return false; } }, moved = r => LABELS.every(l => r.rows[l] === movedRows[l]);
    check(moved(b) && keptOk(b) && b.lead === 0, 'each row moved by its own control: shown, kept in the page\'s store at once, the camera\'s lead following the pan', `${LABELS.map(l => `${l}: ${b.rows[l]}`).join(' · ')} · kept ${b.kept} · lead ${b.lead}`);
    await page.evaluate(SHUT);
    // picture
    await page.evaluate(STEP, 3); await wait(500); await page.evaluate(STEP, 3);
    const d0 = await page.evaluate(DOM);
    check(d0.group && d0.ring >= 40 && d0.gone && !d0.fatal, 'the overlay draws the ring at his feet, and no figure of him (shelved)', `ring of ${d0.ring} points · figure ${d0.gone ? 'none' : 'STILL IN THE PAGE'}`);
    await still('findme-ring.png');
    // hand: the turn
    await page.mouse.move(400, 300); await page.evaluate(STEP, 1); const v0 = await page.evaluate(VIEW);
    await page.keyboard.down('Control'); await page.mouse.move(450, 300); await page.mouse.move(500, 300); await page.keyboard.up('Control');
    const v1 = await page.evaluate(VIEW); await page.evaluate(STEP, 1); const v2 = await page.evaluate(VIEW);
    check(v1.orbit > 0 && Math.abs((v2.yaw - v0.yaw) + v1.orbit * 0.006) < 1e-9, 'a real Ctrl + mouse drag to the right, with the turn reversed: the view turns the other way by the same angle', `the drag read as ${v1.orbit} px · yaw ${(v2.yaw - v0.yaw).toFixed(4)} rad (as it was: +${(v1.orbit * 0.006).toFixed(4)})`);
    // hand: a press held does nothing; two taps bring the view round
    await page.evaluate(() => window.__cam.rotate(1.5)); await page.evaluate(STEP, 2); const h0 = await page.evaluate(VIEW);
    await page.keyboard.down('Control'); await wait(700); await page.keyboard.up('Control'); await page.evaluate(STEP, 30); const h1 = await page.evaluate(VIEW);
    await page.mouse.move(300, 520); await page.evaluate(STEP, 40); const hs = await page.evaluate(VIEW);   // (the mouse to one side of him: he faces it, and it is not ahead of the view)
    let t1 = hs, tries = 0; const a0 = hs.aim;
    for (; tries < 3 && !(t1.yaw !== hs.yaw); tries++) { await wait(500); await page.keyboard.press('Control', { delay: 40 }); await wait(60); await page.keyboard.press('Control', { delay: 40 }); await page.evaluate(STEP, 90); t1 = await page.evaluate(VIEW); }
    const dot = await page.evaluate(DOT, a0);
    check(h1.yaw === h0.yaw && dot > 0.999999, 'a real press of Ctrl held 0.7 s turns nothing; a real double tap brings the view round to look where he looked', `held: yaw ${h0.yaw.toFixed(4)} → ${h1.yaw.toFixed(4)} · two taps (try ${tries}): view · his facing at the tap ${DOTS(hs, a0)} → ${dot.toFixed(6)}`);
    // …and his aim came round with it: he faces what he faced with the mouse where it lay; a real move of the mouse and the cursor is the mouse again
    const off = (x, y) => Math.abs(Math.atan2(Math.sin(x - y), Math.cos(x - y))) * 180 / Math.PI;
    const c1 = await page.evaluate(() => ({ mx: window.__input.mouseX, my: window.__input.mouseY }));
    await page.mouse.move(380, 520); await page.evaluate(STEP, 1); const c2 = await page.evaluate(() => ({ mx: window.__input.mouseX, my: window.__input.mouseY }));
    await page.evaluate(STEP, 60); const t2 = await page.evaluate(VIEW);
    check(hs.dot < 0.9 && off(t1.aim, a0) < 1 && Math.hypot(c1.mx - 300, c1.my - 520) > 20 && c2.mx === 380 && c2.my === 520 && off(t2.aim, a0) > 5,
      'with the mouse to one side at the double tap he still faces what he faced when the view has come round; a real move of the mouse and he turns to it',
      `at the tap the view was ${DOTS(hs, a0)} off his facing · after: his facing ${off(t1.aim, a0).toFixed(2)}° off the tap's, the game's cursor at ${c1.mx.toFixed(0)}, ${c1.my.toFixed(0)} with the mouse at 300, 520 · the mouse moved to 380, 520: the cursor ${c2.mx}, ${c2.my}, and he has turned ${off(t2.aim, a0).toFixed(0)}°`);
    // kept
    await boot(true); log('reloaded'); const k0 = await page.evaluate(() => window.__cam.aimLead);
    e = await page.evaluate(OPEN); if (e) throw new Error(e); const c = await page.evaluate(ROWS);
    e = await page.evaluate(RESET); if (e) throw new Error(e); const r = await page.evaluate(ROWS), startKept = { pan: 1, ring: false, turn: 1, behind: false };
    check(k0 === 0 && moved(c) && keptOk(c), 'after a reload the four rows and the camera\'s lead are as they were left', `${LABELS.map(l => `${l}: ${c.rows[l]}`).join(' · ')} · lead at boot ${k0}`);
    check(atStart(r) && r.lead === 0.18 && JSON.stringify(JSON.parse(r.kept)) === JSON.stringify(startKept), 'Reset to defaults puts all four back, in the store too, and the camera\'s lead with them', `${LABELS.map(l => `${l}: ${r.rows[l]}`).join(' · ')} · kept ${r.kept} · lead ${r.lead}`);
  } catch (err) { red++; console.log(`- FAIL — the run stopped: ${String(err).slice(0, 400)}`); }
  check(!errs.length, 'no page error', errs.slice(0, 4).join(' | '));
  await browser.close();
  console.log(red ? `\nfindme-page: FAIL (${red})` : '\nfindme-page: ALL PASS'); process.exit(red ? 1 : 0);
})();
function DOTS(v, a) { return (-Math.sin(v.yaw) * Math.sin(a) - Math.cos(v.yaw) * Math.cos(a)).toFixed(4); }
