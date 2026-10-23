// HANDS LOOK: stills of the hands' moves (src/game/hands.ts) off the real page on the software WebGPU adapter — a body taken up from its feet and from its
// head, hauled, laid down; the west gate of Training lesson 1 pulled open from the yard (it opens toward him), the hut door pushed open from outside. The camera is pinned close on the player.
//   node tools/qa/hands-look.cjs <outDir> [extra query, e.g. nohands]      env: PORT (default 5199) · SIZE (default 960x540) · QUALITY (default low) · ONLY=body|door · ENDS=feet,head · YAW (camera, rad; default: side-on)
// Slow by nature (page-look.cjs says why): ~95 s to boot, 5–15 s a drawn frame.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const outDir = process.argv[2] || 'hands-look', extra = process.argv[3] || '';
const PORT = process.env.PORT || 5199, [W, H] = (process.env.SIZE || '960x540').split('x').map(Number), QUALITY = process.env.QUALITY || 'low', ONLY = process.env.ONLY || '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(); const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
fs.mkdirSync(outDir, { recursive: true });
const DRAW = async (n) => {
  const dev = window.__engine.device;
  const yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 2000); await dev.queue.onSubmittedWorkDone(); await yieldMacro(); }
  window.__engine.render(window.__cam, window.__game.time, 1 / 60, false); const fr = await window.__engine.readbackFrame(); if (!fr) return { err: 'no frame' };
  if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
  for (let i = 0; i < fr.data.length; i += 4) fr.data[i + 3] = 255;
  const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h;
  c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0);
  return { w: fr.w, h: fr.h, url: c2.toDataURL('image/png') };
};
// the page's own loop for `secs`, undrawn, with keys held; a Space tap first when asked
const PLAY = ({ secs, keys, tap }) => {
  const e = window.__engine, real = e.render; e.render = () => {};
  try {
    if (tap) { window.__input.pressed.add('Space'); window.__runFrames(1, 1 / 60, ['Space']); window.__runFrames(1, 1 / 60); }
    window.__runFrames(Math.max(0, Math.round(secs * 60)), 1 / 60, keys || []);
  } finally { e.render = real; }
  const g = window.__game, pl = g.player;
  return { t: +g.time.toFixed(2), pos: Array.from(pl.char.pos).map(v => +v.toFixed(2)), drag: !!pl.dragging, haul: pl.haul ? pl.haul.end + '/' + pl.haul.phase : null, door: pl.doorMove ? pl.doorMove.stage : null, msg: g.message ?? null };
};
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 600)));
  page.on('console', m => { if (m.type() === 'error' && !/smoke|storage textures|Failed to load resource/i.test(m.text())) errors.push(m.text().slice(0, 300)); });
  const url = `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&levelFile=train-move.json&quiet&quietfog=off&difficulty=hard${extra ? '&' + extra : ''}`;
  log('goto', url); await page.goto(url);
  await page.evaluate(async () => { await window.__ready; window.__testVisible = true; });
  await page.evaluate(async () => { const P = window.__cut?.programs, r = P?.swap ? P.ready : null; if (r) await Promise.race([Promise.resolve(r).catch(() => 0), new Promise(d => setTimeout(d, 300000))]); });
  log('ready');
  await page.evaluate(() => { window.__menu.close(); window.__smoke.params.enabled = false; const g = window.__game; g.aiEnabled = false; g.godMode = true; g.playerInvisible = true; });
  const still = async (name) => { const cap = await page.evaluate(DRAW, 3); if (cap.url) fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(cap.url.split(',')[1], 'base64')); log('still', name, cap.err || ''); };
  const play = async (secs, keys, tap) => { const r = await page.evaluate(PLAY, { secs, keys, tap }); log('  play', secs, JSON.stringify(r)); return r; };
  // the camera pinned on a point between him and what he works on, from the game's own height but close
  const pin = (yaw = 0.6, dist = 4.6) => page.evaluate(({ yaw, dist }) => { const g = window.__game, p = g.player.char.pos, b = g.player.dragging?.char.bones.hips; const x = b ? (p[0] + b[0]) / 2 : p[0], z = b ? (p[2] + b[2]) / 2 : p[2]; window.__stage({ look: [x, 0.5, z], yaw, pitch: 0.95, dist }, {}); }, { yaw, dist });
  // which key carries him along a world direction, by the camera's own basis
  const keyFor = (dir) => page.evaluate((dir) => { const { fwd, right } = window.__cam.planarBasis(); const s = k => k[0] * dir[0] + k[2] * dir[1]; const c = [['KeyW', s(fwd)], ['KeyS', -s(fwd)], ['KeyD', s(right)], ['KeyA', -s(right)]]; c.sort((a, b) => b[1] - a[1]); return c[0][0]; }, dir);
  if (ONLY !== 'door') {
    await page.evaluate(() => { window.__killGuard(0, 'struck'); }); await play(2.5);
    for (const end of (process.env.ENDS || 'feet,head').split(',')) {
      const away = await page.evaluate((end) => { const g = window.__game, gd = g.guards[0], rag = gd.char.ragdoll, P = i => rag.point(i), m = (a, b) => [(P(a)[0] + P(b)[0]) / 2, 0, (P(a)[2] + P(b)[2]) / 2];
        const from = end === 'feet' ? m(14, 15) : m(4, 5), h = P(0); let dx = from[0] - h[0], dz = from[2] - h[2]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        g.teleportPlayer([from[0] + dx * 0.85, 0, from[2] + dz * 0.85]); g.player.holstered = true; return [dx, dz]; }, end);
      const side = process.env.YAW !== undefined ? Number(process.env.YAW) : Math.atan2(away[0], away[1]) + Math.PI / 2;   // across the body's own line: both his hands and the limbs they have in view
      await play(0.3); await pin(side); await play(0.05);
      await still(`body-${end}-0-before`);
      await page.evaluate(() => window.__game.selectVerb('body', 'drag')); await play(0.22, [], true); await still(`body-${end}-1-reach`);
      // (over the shoulder: the walk to its hips, the lift and the laying-down are each about a second; along the floor — `nohands`, or HANDS.carry off — the same stills just land later in each beat)
      const beat = async (want, cap) => { for (let t = 0; t < cap; t += 0.1) { const r = await page.evaluate(PLAY, { secs: 0.1 }); if (r.haul && r.haul.endsWith('/' + want)) return; } };
      await beat('rise', 2.6); await play(0.45); await pin(side); await still(`body-${end}-2-lift`);
      await beat('carry', 2); await play(0.4); await pin(side); await still(`body-${end}-3-held`);
      const key = await keyFor(away); await play(1.4, [key]); await pin(side); await play(0.25, [key]); await still(`body-${end}-4-haul`);
      await play(0.3); await page.evaluate(() => window.__game.selectVerb('body', 'drop')); await play(0.5, [], true); await pin(side); await still(`body-${end}-5-setdown`);
      await play(1.8); await still(`body-${end}-6-after`);
    }
  }
  if (ONLY !== 'body') {
    const door = async (name, at, yaw, which) => {
      await page.evaluate(({ at, which }) => { const g = window.__game, d = g.doors.byName(which); d.reset(); g.teleportPlayer(at); g.player.holstered = true; }, { at, which });
      await play(0.4); await pin(yaw, 4.2); await play(0.05); await still(`door-${name}-0-before`);
      await page.evaluate(() => window.__game.selectVerb('door')); await play(0.3, [], true); await still(`door-${name}-1-hand`);
      await play(0.3); await still(`door-${name}-2-swing`);
      await play(0.4); await still(`door-${name}-3-open`);
      await play(0.8); await page.evaluate(() => window.__game.selectVerb('door')); await play(0.45, [], true); await still(`door-${name}-4-shutting`);
      await play(1.2); await still(`door-${name}-5-shut`);
    };
    await door('pull-gate', [8.75, 0, 14.0], 0.6, 'gate_w');      // the west gate from the yard: it opens toward him, and he stands in its sweep (the hut's own pull side is under its roof)
    await door('push-outside', [22.3, 0, 9.7], 1.2, 'hut');
  }
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ url, errors }, null, 1));
  log('errors', errors.length, errors.slice(0, 5));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
