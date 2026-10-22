// A DOOR THAT OPENS TOWARD THE PLAYER, ON THE REAL PAGE (src/game/doors.ts DOORWAY.solid): boot the page in headless Chromium on the software WebGPU adapter
// (tools/qa/sprintdoor-page.cjs's recipe), start the plain night with the guards frozen, and walk the player — the real walk key, W held through `__runFrames` — at
// one office door from the face it opens toward: the switch must be on, the leaf must never be through him (never inside its length on one face and on the next
// frame inside it on the other; never more than 10 cm into him anywhere along it), and he must be in through the doorway with the key still held. Then the same
// page under ?doorsolid=0: the switch off and the leaf through him, as it was.
//   PORT=5231 node tools/qa/doorsolid-page.cjs        (a dev server on that port: PORT=5231 bun run tools/serve.ts)        ONLY=on | off: that page alone
// exit 0 = all hold with no page error · 1 = otherwise.   What this cannot say: how any of it LOOKS (the software adapter draws it; nobody judges a still here).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', DOOR = process.env.DOOR || 'server_manager', ONLY = process.env.ONLY || '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  let failed = false;
  for (const [name, q] of [['on', ''], ['off', 'doorsolid=0']].filter(([n]) => !ONLY || n === ONLY)) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 }); const errors = []; page.setDefaultTimeout(900000);
    page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&solo${q ? '&' + q : ''}`);
    const boot = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; window.__menu.close(); await window.__runFrames(5);
      const g = window.__game; g.godMode = true; g.playerInvisible = true; g.aiEnabled = false;
      const D = window.__knobs.registry().DOORWAY;
      return { fatal: document.getElementById('fatal')?.textContent || '', on: !!D.solid, oneWay: !!D.oneWay }; });
    const R = await page.evaluate(async ([doorName]) => {
      const g = window.__game, cam = window.__cam, pl = g.player, c = pl.char, d = g.doors.list.find(x => x.def.name === doorName);
      for (const x of g.doors.list) { x.reset(); if (x === d) { x.angle = 0; x.vel = 0; x.latched = true; x.closing = false; x.locked = false; x.place(); } }
      const a = d.def.closedDir, ux = Math.cos(a), uz = Math.sin(a), W = d.def.width;
      const off = (f, o) => [d.def.hinge[0] + ux * W * 0.5 - uz * o * f, 0, d.def.hinge[1] + uz * W * 0.5 + ux * o * f];
      const face = g.doors.pullFace(d, off(1, 0.8)) ? 1 : -1, dirIn = [uz * face, -ux * face];
      g.teleportPlayer(off(face, 1.3)); pl.crouch = false; await window.__runFrames(5);
      let yaw = 0, best = -2; for (let i = 0; i < 720; i++) { cam.yaw = i * Math.PI / 360; cam.rebuild(); const f = cam.planarBasis().fwd, dot = f[0] * dirIn[0] + f[2] * dirIn[1]; if (dot > best) { best = dot; yaw = cam.yaw; } }
      const out = () => (-(c.pos[0] - d.def.hinge[0]) * uz + (c.pos[2] - d.def.hinge[1]) * ux) * face;
      const read = () => { const [hx, hz] = d.def.hinge, u = d.dir(), px = c.pos[0] - hx, pz = c.pos[2] - hz, along = px * u[0] + pz * u[1], perp = u[0] * pz - u[1] * px, t = Math.max(0, Math.min(W, along));
        return { inside: along > 0.14 && along < W, face: perp >= 0 ? 1 : -1, along, pen: 0.34 + d.thick / 2 - Math.hypot(px - u[0] * t, pz - u[1] * t) }; };
      let crossed = false, deepest = 0, cross = -1, wide = 0, last = read(); const s0 = { ...g.doors.solids };
      for (let i = 0; i < 200 && cross < 0; i++) { cam.yaw = yaw; cam.rebuild(); await window.__runFrames(1, 1 / 60, ['KeyW']); const r = read();
        if (r.inside && last.inside && r.face !== last.face) crossed = true; if (r.along > 0.14) deepest = Math.max(deepest, r.pen); last = r; wide = Math.max(wide, d.angle * d.swing); if (out() < -0.5) cross = (i + 1) / 60; }
      const s = g.doors.solids;
      return { crossed, deepest, cross, wide, reached: s.reached - s0.reached, held: s.held - s0.held, carried: s.carried - s0.carried, stopped: s.stopped - s0.stopped };
    }, [DOOR]);
    const want = name === 'on', f = x => Number.isFinite(x) ? x.toFixed(2) : '—';
    const ok = !boot.fatal && !errors.length && boot.on === want && boot.oneWay && R.cross > 0 && R.wide > 0.9 && (want ? !R.crossed && R.deepest <= 0.1 && R.reached >= 1 && R.stopped === 0 : R.crossed && R.held + R.carried + R.reached === 0);
    if (!ok) failed = true;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${name}: switch ${boot.on ? 'on' : 'off'} · one-way doors ${boot.oneWay} · ${DOOR}, the walk key held at the face it opens toward: through him ${R.crossed}, deepest in it ${f(R.deepest * 100)} cm, in through the doorway ${R.cross < 0 ? 'NEVER' : 'at ' + f(R.cross) + ' s'}, the leaf ${f(R.wide)} rad at its widest · hand ${R.reached}, ${R.held} frames stood back, ${R.carried} carried, ${R.stopped} stops${boot.fatal ? ` · FATAL: ${boot.fatal.slice(0, 200)}` : ''}${errors.length ? ` · ${errors.length} page error(s): ${errors[0]}` : ''}`);
    await page.close();
  }
  await browser.close();
  console.log(failed ? '=== doorsolid-page: FAILED ===' : '=== doorsolid-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
