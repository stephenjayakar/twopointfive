// A STICKY CAMERA ON THE REAL PAGE (software WebGPU adapter, no GPU needed; ~3–6 min): boots a quiet mission started the 'fog and cameras' way, steps the
// launcher to the camera with the 2 key, sends one at a wall with the right button and keeps what the page shows before and after — the console's errors, the
// HUD's tag, the fog's eye count, a still of each. What the headless checks cannot see: a module that breaks only in the bundle, and that anything is drawn.
//   PORT=5237 node tools/qa/sticky-look.cjs <outDir> [query]     (default query: levelFile=police-post.json&quiet=1&quietfog=team&cams=2)
// PASS / FAIL lines, exit 1 on a FAIL or a page error. The smoke solver is switched off (page-look.cjs says why).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const outDir = process.argv[2] || 'sticky-look', QUERY = process.argv[3] || 'levelFile=police-post.json&quiet=1&quietfog=team&cams=2', PORT = process.env.PORT || 5199;
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
fs.mkdirSync(outDir, { recursive: true });
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
let failed = false; const check = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
const DRAW = async (n) => { const dev = window.__engine.device, yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 600); await dev.queue.onSubmittedWorkDone(); await yieldMacro(); } return true; };
const PLAY = (arg) => { const e = window.__engine, real = e.render; let threw = null; e.render = () => {};
  try { for (let i = 0; i < arg.frames && !threw; i++) { if (arg.press && i === 0) window.__input.pressed.add(arg.press); try { window.__runFrames(1, 1 / 60); } catch (x) { threw = `frame ${i}: ${x && x.stack || x}`; } } } finally { e.render = real; }
  return threw; };
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 }); const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 400)); });
  page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 600)));
  const play = async (frames, press) => { const t = await page.evaluate(PLAY, { frames, press }); if (t) errors.push('play threw: ' + t); };
  await page.goto(`http://localhost:${PORT}/?paused&quality=verylow&mute&slotsetup=0&${QUERY}`);
  const ready = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return { fatal: document.getElementById('fatal')?.textContent || '' }; });
  log('ready', JSON.stringify(ready)); if (ready.fatal) errors.push('fatal: ' + ready.fatal);
  await page.evaluate(async () => { const P = window.__cut?.programs; if (P?.swap) await Promise.race([Promise.resolve(P.ready).catch(() => 0), new Promise(d => setTimeout(d, 300000))]); });
  const state = () => page.evaluate(() => { const g = window.__game, pl = g.player, rf = pl.rifle;
    return { quiet: !!g.quiet?.active, fog: !!g.fogOfWar?.active, cams: rf.cams, loads: rf.attachments.join(','), load: String(rf.attachment), rifleUp: !!pl.rifleUp, sent: pl.cams.length, stuck: pl.cams.filter(c => !c.vel).length,
      tag: [...document.querySelectorAll('.tag')].map(e => e.textContent).filter(t => /CAM/.test(t ?? '')).join('|'), msg: g.message ?? '' }; });
  await page.evaluate(() => { window.__menu.close(); window.__smoke.params.enabled = false; });
  await play(60); const s0 = await state(); log('staged', JSON.stringify(s0));
  check(s0.quiet && s0.fog && s0.cams === 2 && s0.loads === 'ring,he40,cam', 'the link deploys a quiet mission under the fog with two cameras on the rifle\'s launcher', JSON.stringify(s0));
  await play(60, 'Digit2'); await play(10, 'Digit2'); await play(10, 'Digit2'); await page.evaluate(DRAW, 3); const s1 = await state(); log('camera up', JSON.stringify(s1));
  await page.screenshot({ path: path.join(outDir, '1-camera-load.png') });
  check(s1.rifleUp && s1.load === 'cam' && /CAM/.test(s1.tag), '2 draws the rifle, 2 twice more steps the launcher to the camera, and the HUD\'s tag says so', JSON.stringify(s1));
  // the nearest wall face a round from his chest reaches: point the cursor at it (the game's own projection), hold the right button a few frames, let go
  const aim = await page.evaluate(() => { const g = window.__game, P = g.player.char.pos; let best = null;
    for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, d = [Math.cos(a), 0, Math.sin(a)], h = g.col.raycast([P[0], 1.4, P[2]], d, 12);
      if (h && h.t > 2.5 && (!best || h.t < best.t)) best = { t: h.t, at: [P[0] + d[0] * h.t, 0, P[2] + d[2] * h.t] }; }
    if (!best) return null; const c = window.__cam, vp = c.viewProj, p = best.at, w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
    const cv = document.getElementById('view'), x = (vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12]) / w, y = (vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13]) / w;
    const sx = (x * 0.5 + 0.5) * cv.clientWidth, sy = (0.5 - y * 0.5) * cv.clientHeight; window.__mouse(sx, sy, 4); window.__click(2); return { ...best, sx: Math.round(sx), sy: Math.round(sy) }; });
  log('aim', JSON.stringify(aim));
  await play(8); await page.evaluate(() => window.__mouse(window.__input.mouseX, window.__input.mouseY, 0)); await play(150); await page.evaluate(DRAW, 3);
  const s2 = await state(), eyes = await page.evaluate(() => { const g = window.__game, c = g.player.cams[0]; return { cam: c ? { pos: c.pos.map(v => +v.toFixed(2)), n: c.n.map(v => +v.toFixed(2)), si: c.si } : null }; });
  log('sent', JSON.stringify(s2), JSON.stringify(eyes)); await page.screenshot({ path: path.join(outDir, '2-camera-sent.png') });
  check(!!aim && s2.cams === 1 && s2.stuck === 1, 'the right button held and let go sends one: one fewer on the rifle, one stuck and watching', `${JSON.stringify(s2)} · ${JSON.stringify(eyes)}`);
  check(errors.length === 0, 'no console error, no page error', errors.join(' | ') || 'none');
  await browser.close(); console.log(failed ? '=== sticky-look: FAILED ===' : '=== sticky-look: ALL PASS ==='); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
