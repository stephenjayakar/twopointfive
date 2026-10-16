// A SPRINT INTO A DOOR ON THE REAL PAGE (src/game/sprintdoor.ts): boot the page in headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's
// recipe), start the plain night with the guards frozen, and run the player — real keys, W + Shift held through `__runFrames` — at one office door from 3 m off
// each face: the switch must be on, the face it opens away from must cost about a quarter of his speed and no more, the face it opens toward must stop him for a boot that takes
// the leaf off its hinges and still let him through. Then the same page under ?nosprintdoor: the switch off and not a tenth of his speed lost from either face.
//   PORT=5231 node tools/qa/sprintdoor-page.cjs [outDir]        (a dev server on that port: PORT=5231 bun run tools/serve.ts; outDir = a still of each run's impact)
// exit 0 = all hold with no page error · 1 = otherwise.   What this cannot say: how any of it LOOKS (the software adapter draws it; nobody judges a still here).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', OUT = process.argv[2] || '', DOOR = process.env.DOOR || 'server_manager', ONLY = process.env.ONLY || '';   // ONLY=weight | off: that page alone (each is most of an hour on the software adapter)
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  let failed = false;
  for (const [name, q] of [['weight', ''], ['off', 'nosprintdoor']].filter(([n]) => !ONLY || n === ONLY)) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 }); const errors = []; page.setDefaultTimeout(900000);
    page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&solo${q ? '&' + q : ''}`);
    const boot = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; window.__menu.close(); await window.__runFrames(5);
      const g = window.__game; g.godMode = true; g.playerInvisible = true; g.aiEnabled = false;
      const sw = window.__knobs.registry().SPRINTDOOR;
      return { fatal: document.getElementById('fatal')?.textContent || '', on: !!(sw && sw.on), oneWay: !!window.__knobs.registry().DOORWAY.oneWay }; });
    const runs = {};
    for (const toward of [false, true]) {
      // up to the frame of impact in one call, a still, then the rest
      const first = await page.evaluate(async ([doorName, toward]) => {
        const g = window.__game, cam = window.__cam, pl = g.player, c = pl.char, d = g.doors.list.find(x => x.def.name === doorName);
        for (const x of g.doors.list) { x.reset(); if (x === d) { x.angle = 0; x.vel = 0; x.latched = true; x.closing = false; x.locked = false; x.place(); } }
        const a = d.def.closedDir, ux = Math.cos(a), uz = Math.sin(a), W = d.def.width;
        const off = (f, o) => [d.def.hinge[0] + ux * W * 0.55 - uz * o * f, 0, d.def.hinge[1] + uz * W * 0.55 + ux * o * f];
        const pf = g.doors.pullFace(d, off(1, 0.8)) ? 1 : -1, face = pf * (toward ? 1 : -1), dirIn = [uz * face, -ux * face];
        g.teleportPlayer(off(face, 3)); pl.crouch = false; await window.__runFrames(5);
        let yaw = 0, best = -2; for (let i = 0; i < 720; i++) { cam.yaw = i * Math.PI / 360; cam.rebuild(); const f = cam.planarBasis().fwd, dot = f[0] * dirIn[0] + f[2] * dirIn[1]; if (dot > best) { best = dot; yaw = cam.yaw; } }
        const out = () => (-(c.pos[0] - d.def.hinge[0]) * uz + (c.pos[2] - d.def.hinge[1]) * ux) * face;
        const S = window.__sd = { d, dirIn, yaw, out, last: [c.pos[0], c.pos[2]], before: 0, slow: 99, cross: -1, i: 0, hit: -1, kick: false };
        S.step = async () => { cam.yaw = S.yaw; cam.rebuild(); await window.__runFrames(1, 1 / 60, ['KeyW', 'ShiftLeft']); const v = ((c.pos[0] - S.last[0]) * dirIn[0] + (c.pos[2] - S.last[1]) * dirIn[1]) * 60; S.last = [c.pos[0], c.pos[2]]; const o = out(); S.i++;
          S.kick = S.kick || !!pl.kick; if (o > 0.6 && S.hit < 0 && !pl.kick) S.before = v; if (S.hit < 0 && Math.abs(d.angle) > 0.02) S.hit = S.i; if (S.hit >= 0 && S.i - S.hit < 40) S.slow = Math.min(S.slow, v); if (S.cross < 0 && o < -0.5) S.cross = S.i / 60; };
        for (let k = 0; k < 120 && S.hit < 0; k++) await S.step();
        for (let k = 0; k < 3; k++) await S.step();
        return { hit: S.hit, angle: d.angle * d.swing };
      }, [DOOR, toward]);
      if (OUT) await page.screenshot({ path: `${OUT}/sprintdoor-${name}-${toward ? 'toward' : 'away'}.png`, timeout: 120000 }).catch(() => console.log('  (no still: the page did not hand one over)'));
      const rest = await page.evaluate(async () => { const S = window.__sd; for (let k = 0; k < 90; k++) await S.step();
        return { before: S.before, slow: S.slow, cross: S.cross, kick: S.kick, off: !!S.d.off, widest: S.d.angle * S.d.swing, sprinting: window.__game.player.sprinting }; });
      runs[toward ? 'toward' : 'away'] = { ...first, ...rest };
    }
    const want = name === 'weight', A = runs.away, T = runs.toward, f = x => Number.isFinite(x) ? x.toFixed(2) : '—';
    const ok = !boot.fatal && !errors.length && boot.on === want && boot.oneWay && A.hit > 0 && T.hit > 0 && A.cross > 0 && T.cross > 0 && !A.kick && !A.off
      && (want ? A.slow / A.before > 0.68 && A.slow / A.before < 0.85 && T.kick && T.off && T.slow < 0.2 : !T.kick && !T.off && A.slow / A.before > 0.9 && T.slow / T.before > 0.9);
    if (!ok) failed = true;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${name}: switch ${boot.on ? 'on' : 'off'} · one-way doors ${boot.oneWay} · ${DOOR} — opens away: ${f(A.before)} m/s before, ${f(A.slow)} slowest, through at ${f(A.cross)} s · opens toward: ${f(T.before)} before, ${f(T.slow)} slowest, kicked ${T.kick}, off its hinges ${T.off}, through at ${f(T.cross)} s · page errors ${errors.length}${errors.length ? '\n    ' + errors.slice(0, 4).join('\n    ') : ''}${boot.fatal ? '\n    fatal: ' + boot.fatal : ''}`);
    await page.close();
  }
  await browser.close();
  console.log(failed ? '=== sprintdoor-page: FAILED ===' : '=== sprintdoor-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
