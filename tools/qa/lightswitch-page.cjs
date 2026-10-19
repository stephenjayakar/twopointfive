// A ROOM'S WALL SWITCH ON THE REAL PAGE (src/game/lightswitch.ts): headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's recipe), the
// office as the page opens it, and the middle of tools/qa/lightswitch-check.ts done with the page's own Game and the page's own Space.
//   PORT=5199 node tools/qa/lightswitch-page.cjs [outDir]     (a dev server on that port: PORT=5199 bun run tools/serve.ts)
//   on    the page as it opens: the switch reads on and the level has plates; Sam stood at the manager's plate has the row; Space puts the room's lights
//         out, Space again puts them back; no page error
//   off   the same page under ?lightswitch=0: the switch reads off, no plate, no row at the same place
// exit 0 = both, with no page error · 1 = otherwise. The verdict is game logic only: nothing here judges a picture. With an outDir it also keeps three
// stills of the plate (lit, dark, back) as the software adapter draws them — for a person to look at, never for the verdict.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', outDir = process.argv[2] || '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
if (outDir) fs.mkdirSync(outDir, { recursive: true });

// in the page: the game stepped with no frame drawn
const STEP = (n) => { const e = window.__engine, real = e.render; e.render = () => { e.world.upload(); }; try { for (let i = 0; i < n; i++) window.__runFrames(1, 1 / 60); } finally { e.render = real; } };
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
const SET = () => {
  const g = window.__game, S = window.__lightswitch; if (!S) return { err: 'no __lightswitch hook' };
  window.__menu?.close?.(); if (window.__smoke) window.__smoke.params.enabled = false; g.godMode = true; g.aiEnabled = false;
  const L = S.list(), i = L.findIndex(s => s.targets[0].group === 'manager'), at = [27.03, 0, 9.44];
  const r = { rule: S.knobs.on, plates: L.length, i };
  const sw = L[i]; g.teleportPlayer(sw ? [sw.stand[0], 0, sw.stand[2]] : at);
  if (sw) window.__lsw = { i, look: [sw.pos[0], 1.1, sw.pos[2]], yaw: Math.atan2(-sw.n[0], -sw.n[2]) };
  return r;
};
const READ = () => { const g = window.__game, S = window.__lightswitch, k = window.__lsw;
  return { rows: g.nearby.map(r => `${r.kind}:${r.verb}`).join(' '), lit: k ? S.lit(k.i) : null, on: k ? S.list()[k.i].targets.filter(t => t.on).length : -1, flips: S.stats.flips, fatal: (document.getElementById('fatal') || {}).textContent || '' }; };
const TAP = (verb) => { const g = window.__game; const ok = g.selectVerb('switch', verb); if (ok) window.__input.pressed.add('Space'); return ok; };
const LOOK = () => { const k = window.__lsw; window.__stage({ look: k.look, yaw: k.yaw, pitch: 0.55, dist: 3.2 }, {}); };

(async () => {
  let red = 0; const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  for (const job of [{ name: 'on', query: '' }, { name: 'off', query: 'lightswitch=0&' }]) {
    const page = await (await browser.newContext({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300)); });
    const url = `http://localhost:${PORT}/?${job.query}paused&quality=${QUALITY}&mute`; log(`${job.name}: ${url}`);
    const r = {}, still = async (tag) => { if (!outDir || job.name !== 'on') return; const u = await page.evaluate(DRAW, 4); if (u) fs.writeFileSync(path.join(outDir, `lightswitch-${tag}.png`), Buffer.from(u.split(',')[1], 'base64')); log(`  still ${tag}`); };
    try {
      await page.goto(url); await page.evaluate(async () => { await window.__ready; }); await page.evaluate(STEP, 30);
      Object.assign(r, await page.evaluate(SET)); if (r.err) throw new Error(r.err);
      await page.evaluate(STEP, 3); r.a = await page.evaluate(READ);
      if (job.name === 'on') {
        if (outDir) await page.evaluate(LOOK); await still('lit');
        r.tap1 = await page.evaluate(TAP, 'lightsOff'); await page.evaluate(STEP, 3); r.b = await page.evaluate(READ); await still('dark');
        r.tap2 = await page.evaluate(TAP, 'lightsOn'); await page.evaluate(STEP, 3); r.c = await page.evaluate(READ); await still('back');
      }
    } catch (e) { r.err = String(e).slice(0, 300); }
    await page.close();
    const clean = !errs.length && !(r.a || {}).fatal;
    const ok = !r.err && clean && (job.name === 'on'
      ? r.rule === true && r.plates > 0 && r.i >= 0 && /switch:lightsOff/.test(r.a.rows) && r.a.lit === true && r.tap1 && r.b.lit === false && r.b.on === 0 && /switch:lightsOn/.test(r.b.rows) && r.tap2 && r.c.lit === true && r.c.flips === r.a.flips + 2
      : r.rule === false && r.plates === 0 && !/switch/.test(r.a.rows));
    if (!ok) red++;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${job.name === 'on' ? "the page as it opens: the switch is on, the office has plates, Sam at the manager's has the row, Space puts the room out and Space puts it back" : 'under ?lightswitch=0: the switch is off, no plate, no row at the same place'} — ${JSON.stringify(r).slice(0, 500)}${errs.length ? ` · page errors: ${errs.slice(0, 2).join(' | ')}` : ''}`);
  }
  await browser.close();
  console.log(`=== lightswitch-page: ${red ? 'FAILURES above' : 'ALL PASS'} ===`);
  process.exit(red ? 1 : 0);
})();
