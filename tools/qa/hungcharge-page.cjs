// A CHARGE ON A BOARD THAT HANGS ON THE WALL, ON THE REAL PAGE (src/game/wallcharge.ts WALLCHARGE.hung): headless Chromium on the software WebGPU adapter
// (tools/qa/page-look.cjs's recipe), the block's room clear as the page deals it, and the first line of tools/qa/hungcharge-check.ts done with the page's own
// Game: the notice board on the mess's wall found by the engine's own `hungAt`, a wall charge set on it, blown.
//   PORT=5199 node tools/qa/hungcharge-page.cjs        (a dev server on that port: PORT=5199 bun run tools/serve.ts)
//   on    the page as it opens: the switch reads on, the wall holes, the board is gone, in slabs on both sides of the wall
//   off   the same page under ?hungcharge=0: the switch reads off, the same charge opens nothing and the board hangs on (the build as it was)
//   STILLS=<dir>  also keeps frames of the `on` run read back from the page: before, and 0.1 / 0.3 / 0.7 / 2 s after the charge goes (software adapter, verylow)
//   EXTRA=<query> more of the query string for both runs (EXTRA='hour=midday&wallsafe=0': the block by day, and the charge's blinding reach as it was
//                 before the safety radius — at 2.6 m Sam is flash-blind for the first second otherwise, and so is the picture)
// exit 0 = both, with no page error · 1 = otherwise. The verdict is game logic only: nothing here judges a picture.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', STILLS = process.env.STILLS || '', EXTRA = process.env.EXTRA ? `${process.env.EXTRA}&` : '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);

// in the page: the game stepped with no frame drawn
const STEP = (n) => { const g = window.__game, e = window.__engine, real = e.render; e.render = () => { e.world.upload(); }; try { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; window.__runFrames(1, 1 / 60); } } finally { e.render = real; } };
// in the page: the board, the place on it, the charge set (not blown)
const SET = async () => {
  await window.__ready;
  const g = window.__game, K = window.__knobs.registry().WALLCHARGE, H = K.height; g.godMode = true; g.tune.chaos = 0.5;
  let pick = null;
  for (const B of g.destr.walls.all()) { if (B.kind !== 'wall') continue; const b = B.box, ax = b.h[0] >= b.h[2], L = ax ? b.h[0] : b.h[2], T = ax ? b.h[2] : b.h[0];
    for (const side of [1, -1]) for (let u = -L + 0.2; u <= L - 0.2; u += 0.125) { const p = ax ? [b.c[0] + u, H, b.c[2] + side * (T + 0.06)] : [b.c[0] + side * (T + 0.06), H, b.c[2] + u];
      for (const j of g.destr.walls.hungAt(B.id, p, K.hungM)) { const x = g.col.boxes[j], d = Math.hypot(x.c[0] - p[0], x.c[2] - p[2]); if (x.h[1] >= 0.39 && (!pick || d < pick.d)) pick = { j, d, wall: B.id, p, side, ax }; } } }
  if (!pick) return { err: 'the staging is gone: no board hangs on a breakable wall of this floor' };
  const from = pick.ax ? [pick.p[0], 0, pick.p[2] + pick.side * 2.6] : [pick.p[0] + pick.side * 2.6, 0, pick.p[2]];
  g.teleportPlayer(from);   // (Sam on the charge's side: the wall's row is asked from where he stands)
  window.__hung = { pick, from };
  return { board: pick.j, wall: pick.wall, at: [pick.p[0], pick.p[2]], side: pick.side, ax: pick.ax, rule: K.hung, col: Array.from(g.col.boxes[pick.j].albedo) };
};
const BLOW = (n) => {
  const g = window.__game, C = g.wallCharge, { pick } = window.__hung, b = g.col.boxes[pick.j];
  const w = g.orders.targetAt([pick.p[0], 0, pick.p[2]]).wall; if (!w || !w.ok || w.index !== pick.wall) return { err: `the wall's row is not offered at the board: ${w ? w.why : 'no wall'}` };
  window.__hung.had = new Set(g.destr.debris.list); window.__hung.wspot = w;
  C.set.push({ wall: w, t: g.time, by: 'probe', paid: 0 }); const r = C.blow(C.set[C.set.length - 1]);
  return { hole: !!(r && r.hole), flags: b.flags };
};
const READ = () => {
  const g = window.__game, C = g.wallCharge, { pick, had, wspot } = window.__hung, b = g.col.boxes[pick.j], col = b.albedo;
  const mine = g.destr.debris.list.filter(c => !had.has(c) && c.box.albedo.every((v, k) => Math.abs(v - col[k]) < 0.004) && Math.min(c.box.h[0], c.box.h[2]) <= Math.min(b.h[0], b.h[2]) + 0.002);
  const off = c => (pick.ax ? c.box.c[2] - wspot.box.c[2] : c.box.c[0] - wspot.box.c[0]) * pick.side;
  return { holeNow: !!C.holeAt(wspot), gone: (b.flags & 1) !== 0, slabs: mine.length, back: mine.filter(c => off(c) > 0.2).length, through: mine.filter(c => off(c) < -0.2).length, fatal: (document.getElementById('fatal') || {}).textContent || '' };
};
const GRAB = async (n) => {
  const dev = window.__engine.device;
  const yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 6000); await dev.queue.onSubmittedWorkDone(); await yieldMacro(); }
  window.__engine.render(window.__cam, window.__game.time, 1 / 60, false); const fr = await window.__engine.readbackFrame(); if (!fr) return null;
  if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
  for (let i = 3; i < fr.data.length; i += 4) fr.data[i] = 255;
  const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h; c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0);
  return c2.toDataURL('image/png');
};

(async () => {
  let red = 0; const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  if (STILLS) fs.mkdirSync(STILLS, { recursive: true });
  for (const job of [{ name: 'on', query: '' }, { name: 'off', query: 'hungcharge=0&' }]) {
    const page = await (await browser.newContext({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300)); });
    page.on('response', r => { if (r.status() >= 400) log(`  (${r.status()} ${r.url()})`); });   // (a file the server has not got is named, not counted: the game's own errors are)
    const url = `http://localhost:${PORT}/?levelFile=block.json&roomclear=6&squad4&${job.query}${EXTRA}paused&quality=${QUALITY}&mute`; log(`${job.name}: ${url}`);
    let r = {}; const still = async (tag) => { if (!STILLS || job.name !== 'on') return; const u = await page.evaluate(GRAB, 3); if (u) { fs.writeFileSync(path.join(STILLS, `hung-${tag}.png`), Buffer.from(u.split(',')[1], 'base64')); log(`  still ${tag}`); } };
    try {
      await page.goto(url); await page.evaluate(async () => { await window.__ready; }); await page.evaluate(STEP, 60); const s = await page.evaluate(SET); if (s.err) throw new Error(s.err); Object.assign(r, s);
      if (STILLS && job.name === 'on') {   // the camera on the charge's side of the wall, off to one side of Sam, who stands in the room there (the picture is his cone's)
        await page.evaluate(({ at, side, ax }) => { const out = ax ? [at[0], 0, at[1] + side * 2.6] : [at[0] + side * 2.6, 0, at[1]];
          window.__stage({ look: [at[0], 0.9, at[1]], yaw: Math.atan2(ax ? 0 : side, ax ? side : 0) + 0.55, pitch: 0.62, dist: 7 }, { player: { pos: out, yaw: Math.atan2(at[0] - out[0], at[1] - out[2]) } }); }, s);
        await page.evaluate(STEP, 20); await still('0-before'); }
      const b = await page.evaluate(BLOW); if (b.err) throw new Error(b.err); Object.assign(r, b);
      if (STILLS && job.name === 'on') { await page.evaluate(STEP, 5); await still('1-at-0.1s'); await page.evaluate(STEP, 12); await still('2-at-0.3s'); await page.evaluate(STEP, 24); await still('3-at-0.7s'); await page.evaluate(STEP, 49); }
      else await page.evaluate(STEP, 90);
      Object.assign(r, await page.evaluate(READ));
      if (STILLS && job.name === 'on') { await page.evaluate(STEP, 30); await still('4-at-2s'); }
    } catch (e) { r = { err: String(e).slice(0, 300) }; }
    await page.close();
    if (r.err) { red++; console.log(`- FAIL — ${job.name}: ${r.err}${errs.length ? ` · ${errs[0]}` : ''}`); continue; }
    const detail = `hung ${r.rule} · board #${r.board} on wall #${r.wall} at (${r.at.map(x => x.toFixed(2)).join(', ')}) · the charge: hole ${r.hole}, a way through now ${r.holeNow} · board gone ${r.gone} · slabs of it ${r.slabs}: ${r.back} back in the room, ${r.through} through · page errors ${errs.length}${errs.length ? `: ${errs[0]}` : ''}${r.fatal ? ` · #fatal: ${r.fatal.slice(0, 120)}` : ''}`;
    const clean = !errs.length && !r.fatal;
    const ok = job.name === 'on' ? clean && r.rule === true && r.hole && r.holeNow && r.gone && r.slabs >= 4 && r.back >= 1 && r.through >= 1 : clean && r.rule === false && !r.hole && !r.holeNow && !r.gone && r.slabs === 0;
    if (!ok) red++;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${job.name === 'on' ? 'the page as it opens: the rule is on, the charge on the notice board holes the wall and the board goes in slabs, some through and some back' : '?hungcharge=0: the rule is off, the same charge opens nothing and the board hangs on (the build as it was)'}\n    ${detail}`);
  }
  await browser.close();
  console.log(`=== hungcharge-page: ${red ? 'FAILURES above' : 'ALL PASS'} ===`);
  process.exit(red ? 1 : 0);
})();
