// GLASS AS BUILDINGS HAVE IT, IN THE REAL PAGE (src/game/glassbreak.ts GLASSREAL; the headless lines are glassreal-check.ts): boot the page in headless Chromium on
// the software WebGPU adapter (as glass-page.cjs does — no GPU needed) and ask it what the visitor gets:
//   plain                       both rules on; the office's conference partition is toughened and a north window float; one round into the partition: the sheet
//                               still stands three steps on (drawn: the white sheet), is gone inside a fifth of a second (drawn: the fall), no console error
//   off=glassdrop=0&glassplace=0   both rules off; the partition is float and the window toughened, as they were
// What this shows: the two defaults reach the page and the URL takes them out, and the page draws a sheet standing crazed and a sheet gone with the rules on and
// throws nothing. What it cannot show: how any of it LOOKS (the software adapter is not a GPU a player has).
//   node tools/qa/glassreal-page.cjs <outDir>      env PORT (5199: a server of this checkout must be up there) · QUALITY (verylow) · SIZE (640x360)
// Exit 1 on a console / page error that is not the smoke solver's known noise on this adapter, or a state that is not the job's; 2 = the driver died.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const outDir = process.argv[2] || 'glassreal-page';
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow';
const [W, H] = (process.env.SIZE || '640x360').split('x').map(Number);
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/, NOISE_MAX = 80;   // (glass-page.cjs: the smoke solver's pipelines never compile on this adapter)
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
fs.mkdirSync(outDir, { recursive: true });
const JOBS = [{ name: 'plain', query: '', on: true }, { name: 'off', query: 'glassdrop=0&glassplace=0', on: false }];
const DRAW = async (n) => {
  const dev = window.__engine.device;
  const yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 600); await dev.queue.onSubmittedWorkDone(); await yieldMacro(); }
  window.__engine.render(window.__cam, window.__game.time, 1 / 60, false); const fr = await window.__engine.readbackFrame(); if (!fr) return { err: 'no frame' };
  if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
  let sum = 0; for (let i = 0; i < fr.data.length; i += 4) { sum += fr.data[i] + fr.data[i + 1] + fr.data[i + 2]; fr.data[i + 3] = 255; }
  const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h;
  c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0);
  return { w: fr.w, h: fr.h, mean: +(sum / (fr.w * fr.h * 3)).toFixed(2), url: c2.toDataURL('image/png') };
};
/** n fixed steps of the game with nothing drawn (a drawn frame on this adapter costs seconds) */
const STEP = (n) => { const e = window.__engine, real = e.render; let threw = null; e.render = () => {};
  try { for (let i = 0; i < n && !threw; i++) { try { window.__runFrames(1, 1 / 60); } catch (x) { threw = `frame ${i}: ${x && x.stack || x}`; } } } finally { e.render = real; }
  return threw; };
/** the two panes by where they stand in the office (tools/qa/office-pane.ts: the conference partition's second sheet, the 4 m north window), the switches, the kinds */
const STATE = () => { const g = window.__game, R = window.__knobs.registry().GLASSREAL, gb = window.__glassbreak;
  const at = (x, z) => window.__glass.panes.find(bi => { const b = g.level.boxes[bi]; return Math.abs(b.c[0] - x) < 0.01 && Math.abs(b.c[2] - z) < 0.01; });
  const part = at(7.5, 10), win = at(16, 24);
  return { table: !!R, drop: R && R.drop, place: R && R.place, hang: R && R.hang, live: gb.live, gpu: gb.gpu, part, win, partKind: part === undefined ? null : g.glassBreak.typeOfPane(part), winKind: win === undefined ? null : g.glassBreak.typeOfPane(win) }; };
/** one round into the partition's sheet, made toughened so both jobs break the same kind; the camera on it */
const BREAK = (bi) => { const g = window.__game, gb = window.__glassbreak, b = g.level.boxes[bi]; gb.setType(bi, 'tempered');
  window.__stage({ look: [b.c[0], b.c[1], b.c[2]], yaw: b.yaw || 0, pitch: 1.0, dist: 4.5 }, {});
  gb.impact(bi, [b.c[0] + 0.1, b.c[1] - 0.3, b.c[2]], [0, 0, -1], 1); return { t: g.time }; };
const PANE = (bi) => { const p = window.__glassbreak.panes().find(x => x.bi === bi); return p ? { open: +p.open.toFixed(3), gone: p.gone, walkable: p.walkable, t: window.__game.time } : null; };

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  let bad = 0;
  for (const job of JOBS) {
    const errors = []; let noise = 0;
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    page.on('console', m => { const t = m.type(), x = m.text(); if (t !== 'error' && !(t === 'warning' && !/WebGPU is experimental|SwiftShader|powerPreference|fallback adapter/i.test(x))) return;
      if (/Failed to load resource/.test(x)) return;
      if (NOISE.test(x) && noise < NOISE_MAX) noise++; else errors.push(`${t}: ${x.slice(0, 600)}`); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 800)));
    try {
      const url = `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute${job.query ? '&' + job.query : ''}`;
      log(job.name, 'goto', url); await page.goto(url);
      const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return document.getElementById('fatal')?.textContent || ''; }); if (fatal) errors.push('fatal: ' + fatal);
      await page.evaluate(() => { window.__menu.close(); window.__smoke.params.enabled = false; });
      let threw = await page.evaluate(STEP, 60); if (threw) errors.push('step threw: ' + threw);
      const c0 = await page.evaluate(DRAW, 1); if (!c0 || c0.err) errors.push('draw: ' + (c0 ? c0.err : 'nothing came back'));
      const S = await page.evaluate(STATE); log(job.name, 'state', JSON.stringify(S));
      const kinds = job.on ? S.partKind === 'tempered' && S.winKind === 'annealed' : S.partKind === 'annealed' && S.winKind === 'tempered';
      if (!S.table || S.drop !== job.on || S.place !== job.on || !S.live || !S.gpu || !kinds) errors.push(`state: the job wants the two rules ${job.on ? 'on' : 'off'} and the panes' kinds to follow — ${JSON.stringify(S)}`);
      const B = await page.evaluate(BREAK, S.part);
      threw = await page.evaluate(STEP, 3); if (threw) errors.push('step threw: ' + threw);
      const p3 = await page.evaluate(PANE, S.part); const c1 = await page.evaluate(DRAW, 1);
      if (c1 && c1.url) fs.writeFileSync(path.join(outDir, `${job.name}-standing.png`), Buffer.from(c1.url.split(',')[1], 'base64')); else errors.push('draw: ' + (c1 ? c1.err : 'nothing came back'));
      threw = await page.evaluate(STEP, 8); if (threw) errors.push('step threw: ' + threw);
      const p12 = await page.evaluate(PANE, S.part); const c2 = await page.evaluate(DRAW, 1);
      if (c2 && c2.url) fs.writeFileSync(path.join(outDir, `${job.name}-falling.png`), Buffer.from(c2.url.split(',')[1], 'base64')); else errors.push('draw: ' + (c2 ? c2.err : 'nothing came back'));
      threw = await page.evaluate(STEP, 60); if (threw) errors.push('step threw: ' + threw);
      const pEnd = await page.evaluate(PANE, S.part);
      log(job.name, 'pane', JSON.stringify({ broke: B, three: p3, twelve: p12, end: pEnd }));
      // the drop: standing (a little open: the blow's own clump) three steps on, gone by the twelfth. the wave: part open at the twelfth, gone at the end
      const dropped = !!p3 && !p3.gone && p3.open < 0.2 && !!p12 && p12.gone && p12.open === 1, waved = !!p12 && !p12.gone && p12.open > 0 && p12.open < 1 && !!pEnd && pEnd.gone;
      if (job.on ? !dropped : !waved) errors.push(`the sheet did not ${job.on ? 'stand and then drop at once' : 'let go in the wave'}: ${JSON.stringify({ three: p3, twelve: p12, end: pEnd })}`);
    } catch (x) { errors.push('driver: ' + String(x && x.stack || x).slice(0, 800)); }
    await page.close();
    log(job.name, errors.length ? `FAIL — ${errors.length} problem(s)` : 'PASS', `(${noise} lines of the smoke solver's noise passed over)`); for (const e of errors) console.log('   ', e);
    bad += errors.length;
  }
  await browser.close();
  console.log(bad ? `=== glassreal-page: ${bad} problem(s) ===` : '=== glassreal-page: ALL PASS ===');
  process.exit(bad ? 1 : 0);
})().catch(x => { console.error(x); process.exit(2); });
