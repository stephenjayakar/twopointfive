// A PARKED VEHICLE'S LAMPS ON THE REAL PAGE (src/game/carlamps.ts): headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's recipe), the
// office as the page opens it, and the middle of tools/qa/carlamps-check.ts done with the page's own Game, the page's own cursor and the page's own trigger.
//   PORT=5199 node tools/qa/carlamps-page.cjs [outDir]     (a dev server on that port: PORT=5199 bun run tools/serve.ts)
//   on    the page as it opens: the switch reads on and the office's two cars give eight lamps, four burning; Sam stood with a line to a tail lamp, the
//         cursor put on it and the left button pressed: the lamp is broken, its glow gone and its box painted dark; the same at a head lamp; no page error
//   off   the same page under ?carlamps=0: the switch reads off and no lamp is a target
// exit 0 = both, with no page error · 1 = otherwise. The verdict is game logic only: nothing here judges a picture. With an outDir it also keeps two stills
// of the car's tail (whole, broken) as the software adapter draws them — for a person to look at, never for the verdict.
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
  const g = window.__game, C = window.__carlamps; if (!C) return { err: 'no __carlamps hook' };
  window.__menu?.close?.(); if (window.__smoke) window.__smoke.params.enabled = false; g.godMode = true; g.aiEnabled = false;
  const L = C.list(); return { rule: C.knobs.on, lamps: L.length, burning: L.filter(t => t.on).length, targets: g.targets.length };
};
const GUN = () => { const g = window.__game; if (g.player.pistolUp) return true; window.__input.pressed.add(window.__gunTry++ ? 'KeyE' : 'Digit1'); return false; };
// in the page: Sam put where a line to the lamp is clear, about `d` metres off it (the first of the ring that is floor and has the line)
const PLACE = ([what, d]) => {
  const g = window.__game, t = window.__carlamps.list().find(x => x.name === what); if (!t) return null;
  for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2, p = [t.pos[0] + Math.sin(a) * d, 0, t.pos[2] + Math.cos(a) * d];
    if (g.col.nav.isBlocked(p[0], p[2])) continue;
    const e = [p[0], 1.35, p[2]], v = [t.pos[0] - e[0], t.pos[1] - e[1], t.pos[2] - e[2]], len = Math.hypot(v[0], v[1], v[2]), h = g.col.raycast(e, [v[0] / len, v[1] / len, v[2] / len], 60);
    if (h && h.t < len - 0.05 && !t.boxes.includes(h.index)) continue;
    g.teleportPlayer(p); return p; }
  return null;
};
// in the page: the cursor on the lamp, as the page's own camera draws it
const AIM = (what) => { const t = window.__carlamps.list().find(x => x.name === what), v = document.getElementById('view'); const [sx, sy, front] = window.__cam.project(t.pos, v.clientWidth, v.clientHeight); window.__mouse(sx, sy); return { sx: Math.round(sx), sy: Math.round(sy), front, w: v.clientWidth, h: v.clientHeight }; };
const READ = (what) => { const g = window.__game, t = window.__carlamps.list().find(x => x.name === what), b = g.engine.world.statics[t.boxes[0]];
  return { broken: t.broken, glow: Array.from(b.emissive).map(x => +x.toFixed(2)), paint: Array.from(b.albedo).map(x => +x.toFixed(3)), aim: g.aimTarget ? g.aimTarget.name : null, shot: window.__carlamps.stats.shot, fatal: (document.getElementById('fatal') || {}).textContent || '' }; };
const LOOK = (what) => { const t = window.__carlamps.list().find(x => x.name === what); const p = window.__game.player.char.pos; window.__stage({ look: [t.pos[0], 0.7, t.pos[2]], yaw: Math.atan2(p[0] - t.pos[0], p[2] - t.pos[2]), pitch: 0.45, dist: 4.5 }, {}); };

(async () => {
  let red = 0; const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  for (const job of [{ name: 'on', query: '' }, { name: 'off', query: 'carlamps=0&' }]) {
    const page = await (await browser.newContext({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300)); });
    const url = `http://localhost:${PORT}/?${job.query}paused&quality=${QUALITY}&mute`; log(`${job.name}: ${url}`);
    const r = {}, still = async (tag, what) => { if (!outDir || job.name !== 'on') return; await page.evaluate(LOOK, what); const u = await page.evaluate(DRAW, 4); await page.evaluate(() => window.__stage(null, {})); if (u) fs.writeFileSync(path.join(outDir, `carlamps-${tag}.png`), Buffer.from(u.split(',')[1], 'base64')); log(`  still ${tag}`); };
    try {
      await page.goto(url); await page.evaluate(async () => { await window.__ready; }); await page.evaluate(STEP, 30);
      Object.assign(r, await page.evaluate(SET)); if (r.err) throw new Error(r.err);
      if (job.name === 'on') {
        await page.evaluate(() => { window.__gunTry = 0; });
        for (let i = 0; i < 4 && !(await page.evaluate(GUN)); i++) await page.evaluate(STEP, 50);
        for (const what of ['tail lamp 1', 'head lamp 1']) {
          const o = r[what] = {}; o.stood = await page.evaluate(PLACE, [what, 4]); await page.evaluate(STEP, 6);
          if (what === 'tail lamp 1') await still('whole', what);
          for (let k = 0; k < 10; k++) { o.cursor = await page.evaluate(AIM, what); await page.evaluate(STEP, 5); }   // (the view follows him and he has to come round to it: the cursor is put back on the lamp as the camera settles)
          o.cursor = await page.evaluate(AIM, what); await page.evaluate(STEP, 1);
          o.before = await page.evaluate(READ, what);
          await page.evaluate(() => window.__click(0)); await page.evaluate(STEP, 6); o.after = await page.evaluate(READ, what);
          if (what === 'tail lamp 1') await still('broken', what);
        }
      }
    } catch (e) { r.err = String(e).slice(0, 300); }
    await page.close();
    const fatal = Object.values(r).some(o => o && typeof o === 'object' && o.after && o.after.fatal), clean = !errs.length && !fatal;
    const dark = (o) => !!o && !!o.after && o.after.broken === true && o.after.glow.every(x => x === 0) && o.after.paint.join() === '0.035,0.035,0.04' && o.before.broken === false;
    const ok = !r.err && clean && (job.name === 'on'
      ? r.rule === true && r.lamps === 8 && r.burning === 4 && dark(r['tail lamp 1']) && r['tail lamp 1'].before.glow[0] > 0.4 && dark(r['head lamp 1'])
      : r.rule === false && r.lamps === 0);
    if (!ok) red++;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${job.name === 'on' ? 'the page as it opens: the switch is on, the office has eight lamps for targets and four burn; the cursor on a tail lamp and the trigger pressed breaks it, glow gone and painted dark; the same at a head lamp' : 'under ?carlamps=0: the switch is off and no lamp is a target'} — ${JSON.stringify(r).slice(0, 900)}${errs.length ? ` · page errors: ${errs.slice(0, 2).join(' | ')}` : ''}`);
  }
  await browser.close();
  console.log(`=== carlamps-page: ${red ? 'FAILURES above' : 'ALL PASS'} ===`);
  process.exit(red ? 1 : 0);
})();
