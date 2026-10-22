// A DOOR WALKED OPEN INTO A MAN, ON THE REAL PAGE (src/game/doors.ts DOORTHROW, src/game/doorthrow.ts): boot the page in headless Chromium on the software
// WebGPU adapter (tools/qa/page-look.cjs's recipe), start the plain night with the guards frozen, stand one of them a hand's breadth behind a shut office door
// and walk the player at it from the face it is pushed from — the real W key, held through `__runFrames`. As the page opens: the switch is on, the man is
// carried clear and STARTLED (suspicious, the doorway his place to look; never folded or blind), the door opens and Sam is through the frame. Then the same
// page under ?doorthrow=0: the switch off, the man at his round and the door held shut on Sam, as it was.
//   PORT=5231 node tools/qa/doorthrow-page.cjs        (a dev server on that port: PORT=5231 bun run tools/serve.ts)        ONLY=on | off: that page alone
// exit 0 = both hold with no page error · 1 = otherwise.   The renderer is stubbed (rules, not pixels): what this cannot say is how any of it LOOKS.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', DOOR = process.env.DOOR || 'server', ONLY = process.env.ONLY || '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  let failed = false;
  for (const [name, q] of [['on', ''], ['off', 'doorthrow=0']].filter(([n]) => !ONLY || n === ONLY)) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 }); const errors = []; page.setDefaultTimeout(900000);
    page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&solo${q ? '&' + q : ''}`);
    const r = await page.evaluate(async (doorName) => {
      await window.__ready; window.__testVisible = true; window.__menu.close(); window.__smoke.params.enabled = false; window.__engine.render = () => {}; await window.__runFrames(5);
      const g = window.__game, cam = window.__cam, pl = g.player, c = pl.char, d = g.doors.list.find(x => x.def.name === doorName), T = window.__knobs.registry().DOORTHROW;
      g.godMode = true; g.playerInvisible = true; g.aiEnabled = false;
      for (const x of g.doors.list) { x.reset(); if (x === d) { x.angle = 0; x.vel = 0; x.latched = true; x.closing = false; x.locked = false; x.place(); } }
      const a = d.def.closedDir, ux = Math.cos(a), uz = Math.sin(a), W = d.def.width, S = d.swing, n = [-uz * S, ux * S];   // n: the side it opens into
      const at = (along, out) => [d.def.hinge[0] + ux * along + n[0] * out, 0, d.def.hinge[1] + uz * along + n[1] * out];
      const v = g.guards[0], p0 = at(W * 0.6, 0.48); v.hold = true; v.pinned = true; v.dazzledUntil = -1; v.staggerUntil = -1; v.char.pos[0] = p0[0]; v.char.pos[2] = p0[2]; v.char.update(0);
      g.guards.forEach((o, i) => { if (i) { o.hold = true; o.pinned = true; } });
      g.teleportPlayer(at(W * 0.6, -1.3)); pl.crouch = false; await window.__runFrames(3);
      let yaw = 0, best = -2; for (let i = 0; i < 720; i++) { cam.yaw = i * Math.PI / 360; cam.rebuild(); const f = cam.planarBasis().fwd, dot = f[0] * n[0] + f[2] * n[1]; if (dot > best) { best = dot; yaw = cam.yaw; } }
      let fold = -1, wide = 0, st = '', beat = 0, look = 99;
      for (let k = 0; k < 150; k++) { cam.yaw = yaw; cam.rebuild(); await window.__runFrames(1, 1 / 60, ['KeyW']); wide = Math.max(wide, Math.abs(d.angle)); if (fold < 0 && Math.max(v.staggerUntil, v.dazzledUntil) > g.time) fold = 1;
        if (!st && v.state !== 'patrol') { st = v.state; beat = v.reactT; look = v.lastKnown ? Math.hypot(v.lastKnown[0] - d.frameCentre[0], v.lastKnown[2] - d.frameCentre[2]) : 99; } }
      const through = (c.pos[0] - d.def.hinge[0]) * n[0] + (c.pos[2] - d.def.hinge[1]) * n[1];
      return { fatal: document.getElementById('fatal')?.textContent || '', on: !!(T && T.on), push: T ? T.pushSecs : 0, oneWay: !!window.__knobs.registry().DOORWAY.oneWay, startle: T ? T.startle : 0, fold, st, beat, look, wide, through,
        moved: Math.hypot(v.char.pos[0] - p0[0], v.char.pos[2] - p0[2]), alive: v.state !== 'dead' && !v.wound };
    }, DOOR);
    const want = name === 'on', f = x => Number.isFinite(x) ? x.toFixed(2) : '—';
    const ok = !r.fatal && !errors.length && r.on === want && r.alive && (want ? r.fold < 0 && r.st === 'suspicious' && r.beat > r.startle - 0.1 && r.look < 0.05 && r.moved > 0.2 && r.wide > 0.9 && r.through > 0 : r.fold < 0 && !r.st && r.moved < 0.15 && r.wide < 0.5 && r.through < 0);
    if (!ok) failed = true;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${name}: switch ${r.on ? 'on' : 'off'} · one-way doors ${r.oneWay} · '${DOOR}', W held 2.5 s at it with a man 0.48 m behind — ${r.st ? `he is startled (${r.st}, stopped ${f(r.beat)} s, the doorway his place to look)` : 'he is at his round'}, ${r.fold < 0 ? 'never folded or blind' : 'FOLDED'}, moved ${f(r.moved)} m, the leaf at most ${f(r.wide)} rad wide, Sam ${r.through > 0 ? `${f(r.through)} m through the frame` : `${f(-r.through)} m short of it`}${r.fatal ? ` · FATAL: ${r.fatal.slice(0, 200)}` : ''}${errors.length ? ` · ${errors.length} page error(s): ${errors[0]}` : ' · no page error'}`);
    await page.close();
  }
  await browser.close();
  console.log(failed ? '=== doorthrow-page: FAILED ===' : '=== doorthrow-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
