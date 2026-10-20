// A RESTART ON THE REAL PAGE (src/game/cleanrestart.ts): headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's recipe), the office as
// the page opens it. The level's own light factors are read on its first five frames; the mains are pulled and a fixture broken, the level left dark for two
// seconds; the page's own restart key (Shift+Enter) is pressed, and the five frames after it are read again and three of them drawn.
//   PORT=5199 node tools/qa/cleanrestart-page.cjs [outDir]     (a dev server on that port: PORT=5199 bun run tools/serve.ts)
//   on    the page as it opens: the switch reads on; every light's factor on each of the five frames after the restart is the one a fresh boot had on
//         that frame (the dying tubes apart: their dropouts follow the absolute clock), no beacon turns, nothing is said of the mains, the camera stands by
//         the man as a fresh boot's does, the picture's histories were restarted once, no page error
//   off   the same page under ?cleanrestart=0: the switch reads off, the restart is the one it was (fittings restrike, beacons turn, the host is not told)
// exit 0 = both, with no page error · 1 = otherwise. The verdict is game state and counters only: nothing here judges a picture — the software adapter is not
// a GPU, and how the first frames after a restart LOOK has not been seen on one. With an outDir it keeps a still of the frame before the restart and of the
// third frame after it, for a person to look at, never for the verdict.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', outDir = process.argv[2] || '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
if (outDir) fs.mkdirSync(outDir, { recursive: true });

// in the page: the game stepped with no frame drawn
const STEP = (n) => { const e = window.__engine, real = e.render; e.render = () => { e.world.upload(); }; try { for (let i = 0; i < n; i++) window.__runFrames(1, 1 / 60); } finally { e.render = real; } };
// in the page: n frames stepped one at a time, each one's light factors kept (-2 for a dying tube: its dropouts follow the absolute clock, lighting.ts
// updateTargets — not a restart's to match)
const FRAMES = (n) => { const e = window.__engine, real = e.render, out = []; e.render = () => { e.world.upload(); };
  try { for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 60); out.push(window.__game.targets.map(t => t.fluorescentFlicker ? -2 : +t.factor.toFixed(5))); } } finally { e.render = real; } return out; };
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
const SET = () => { const g = window.__game, C = window.__cleanrestart; if (!C) return { err: 'no __cleanrestart hook' };
  window.__menu?.close?.(); if (window.__smoke) window.__smoke.params.enabled = false; g.godMode = true; g.aiEnabled = false;
  return { rule: C.knobs.on, picture: C.knobs.picture, targets: g.targets.length, dying: g.targets.filter(t => t.fluorescentFlicker).length }; };
// in the page: how far the camera's look-at is from the man (it leads his aim: never zero)
const CAM = () => { const p = window.__game.player.char.pos; return +Math.hypot(window.__cam.target[0] - p[0], window.__cam.target[2] - p[2]).toFixed(3); };
// in the page: the mains pulled by hand, one fixture on them broken, the man walked off so that the camera has somewhere to come back from
const WRECK = () => { const g = window.__game, t = g.targets.find(x => x.kind !== 'breaker' && x.mains && !x.broken); if (t) t.broken = true; g.setBlackout(86400, 'hand');
  const p = g.player.char.pos; for (let k = 1; k < 40; k++) { const q = [p[0] + k, 0, p[2]]; if (!g.col.nav.isBlocked(q[0], q[2]) && k >= 8) { g.teleportPlayer(q); break; } }
  return { broke: !!t, out: g.blackout.active }; };
const DARK = () => { const g = window.__game; return { dark: g.targets.filter(t => t.mains && t.factor < 0.01).length, fed: g.targets.filter(t => t.mains).length, camOff: +Math.hypot(window.__cam.target[0] - g.level.playerSpawn[0], window.__cam.target[2] - g.level.playerSpawn[2]).toFixed(2) }; };
const RESTART = () => { const i = window.__input; i.keys.add('ShiftLeft'); i.pressed.add('Enter'); };
const AFTER = () => { const g = window.__game, C = window.__cleanrestart, p = g.player.char.pos; window.__input.keys.delete('ShiftLeft');
  return { stats: { ...C.stats }, mains: { ...g.blackout }, beacons: g.beacons.filter(b => b.target.on).length, broken: g.targets.filter(t => t.broken).length,
    said: g.messages.map(m => m.text).filter(t => /mains|guards reset|encounter restarted|power/i.test(t)), cam: +Math.hypot(window.__cam.target[0] - p[0], window.__cam.target[2] - p[2]).toFixed(3),
    fatal: (document.getElementById('fatal') || {}).textContent || '' }; };

(async () => {
  let red = 0; const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  for (const job of [{ name: 'on', query: '' }, { name: 'off', query: 'cleanrestart=0&' }]) {
    const page = await (await browser.newContext({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300)); });
    const url = `http://localhost:${PORT}/?${job.query}solo&paused&quality=${QUALITY}&mute`; log(`${job.name}: ${url}`);
    const r = {}, still = async (tag) => { if (!outDir) return; const u = await page.evaluate(DRAW, 1); if (u) fs.writeFileSync(path.join(outDir, `cleanrestart-${job.name}-${tag}.png`), Buffer.from(u.split(',')[1], 'base64')); };
    let boot = [], after = [];
    try {
      await page.goto(url); await page.evaluate(async () => { await window.__ready; });
      Object.assign(r, await page.evaluate(SET)); if (r.err) throw new Error(r.err);
      boot = await page.evaluate(FRAMES, 5); r.camBoot = await page.evaluate(CAM); log(`${job.name}: booted, ${r.targets} lights`);
      await page.evaluate(STEP, 25); Object.assign(r, await page.evaluate(WRECK)); await page.evaluate(STEP, 120); Object.assign(r, await page.evaluate(DARK));
      await still('before');
      await page.evaluate(RESTART); after = await page.evaluate(FRAMES, 5); Object.assign(r, await page.evaluate(AFTER));
      r.drawn = !!(await page.evaluate(DRAW, 3)); await still('third-frame'); r.fatal = (await page.evaluate(AFTER)).fatal;
    } catch (e) { r.err = String(e).slice(0, 300); }
    await page.close();
    let off = 0, worst = 0; for (let f = 0; f < Math.min(boot.length, after.length); f++) for (let i = 0; i < boot[f].length; i++) { const d = Math.abs(boot[f][i] - (after[f][i] ?? -1)); if (d > 1e-4) off++; worst = Math.max(worst, d); }
    r.framesRead = Math.min(boot.length, after.length); r.factorsOff = off; r.worst = +worst.toFixed(4);
    const clean = !errs.length && !r.fatal, wrecked = r.broke && r.out && r.dark === r.fed && r.fed > 10 && r.camOff > 5;
    const ok = !r.err && clean && wrecked && r.framesRead === 5 && r.drawn && (job.name === 'on'
      ? r.rule === true && off === 0 && r.beacons === 0 && r.broken === 0 && r.said.length === 0 && r.mains.restoredAt === -100 && r.stats.restarts === 1 && r.stats.relit === 1 && r.stats.cuts === 1 && r.stats.pictures === 1 && Math.abs(r.cam - r.camBoot) < 0.25
      : r.rule === false && off > 0 && r.beacons > 0 && r.said.length > 0 && r.stats.restarts === 0 && r.stats.pictures === 0);
    if (!ok) red++;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${job.name === 'on' ? 'the page as it opens: the switch is on; the level put in the dark and restarted by Shift+Enter has, on each of its first five frames, every light (but the dying tubes, whose dropouts follow the clock) at the factor a fresh boot had on that frame, no beacon turning, nothing said, the camera by the man as on a fresh boot, the picture restarted once, three frames drawn' : 'under ?cleanrestart=0: the switch is off and the restart is the one it was (fittings restrike, beacons turn, the host is not told)'} — ${JSON.stringify(r).slice(0, 1100)}${errs.length ? ` · page errors: ${errs.slice(0, 4).join(' | ')}` : ''}`);
  }
  await browser.close();
  console.log(`=== cleanrestart-page: ${red ? 'FAILURES above' : 'ALL PASS'} ===`);
  process.exit(red ? 1 : 0);
})();
