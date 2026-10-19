// OFF THE LINE OF HIS FIRE ON THE REAL PAGE (src/game/fireline.ts): headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's recipe),
// the four-man room clear staged, the defenders kept calm by hand. fireline-check.ts's own stage: Sam on the cubicles' middle aisle firing the rifle down
// it with real clicks, a teammate given 'move there' across it.
//   PORT=5241 node tools/qa/fireline-page.cjs        (a dev server on that port: PORT=5241 bun run tools/serve.ts)
//   on     the page opens with the switch on (the bundle's own module, booted by the page): the teammate stops short of the lane while the rounds go
//          down it, is never in it under fire, and is on his mark after the fire stops
//   off    the same page with ?nofireline: the switch is off and the same order walks him into the lane under fire
// exit 0 = both, with no page error · 1 = otherwise. Nothing here looks at a picture: it reads the game the page runs.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const URL = extra => `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&roomclear&squad4&freshstart=0&nocutboxes${extra}`;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); let failed = false;
  const line = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log('\n=== fireline-page: on the real page a teammate waits short of the lane the player fires down; with ?nofireline he walks into it ===');
  const open = async extra => { const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(URL(extra));
    const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return document.getElementById('fatal')?.textContent || ''; });
    if (fatal) errors.push('fatal: ' + fatal);
    return { page, errors }; };
  const stage = () => {
    const g = window.__game, e = window.__engine, input = window.__input, cam = window.__cam, real = e.render, K = window.__knobs.registry(); window.__menu.close(); window.__smoke.params.enabled = false;
    const Z = 18.0, X = 19.5, SAM = [13, 0, Z], FROM = [X, 0, 22.4], TO = [X, 0, 14.6], pl = g.player, O = g.orders, canvas = document.getElementById('view');
    K.FRIENDS.lowReady = false; g.godMode = true;
    const ops = g.guards.filter(x => x.team === 'operative' && x.state !== 'dead'), mate = ops[0], foes = g.guards.filter(x => x.team !== 'operative' && !x.civ && x.state !== 'dead');
    const home = new Map(foes.map(h => [h, [h.char.pos[0], 0, h.char.pos[2]]]));
    const put = (gd, p) => { gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.char.vel[0] = gd.char.vel[2] = 0; gd.path = []; gd.pathGoal = null; };
    const calm = () => { for (const h of foes) if (h.state !== 'dead') { h.state = 'patrol'; h.awareness = 0; put(h, home.get(h)); } ops.slice(1).forEach((o, i) => put(o, [10 + i * 0.9, 0, 22.6])); };
    let trigger = false, f = 0;
    const step = (n = 1) => { e.render = () => { e.world.upload(); }; try { for (let i = 0; i < n; i++) { calm(); pl.char.pos[0] = SAM[0]; pl.char.pos[2] = SAM[2];
      const s = cam.project([SAM[0] + 9, 1.3, Z], canvas.clientWidth, canvas.clientHeight); if (s[2]) { input.mouseX = s[0]; input.mouseY = s[1]; }
      if (trigger && f % 24 === 0) { pl.fireCd = 0; input.clicked |= 1; } f++; window.__runFrames(1, 1 / 60); } } finally { e.render = real; } };
    g.teleportPlayer(SAM); put(mate, FROM); step(30);
    if (!pl.rifleUp) { input.pressed.add('Digit2'); step(1); if (!pl.rifleUp) { input.pressed.add('KeyE'); step(1); } step(90); }
    if (pl.rifle.def.auto && pl.rifle.automatic) { input.pressed.add('KeyB'); step(2); }
    const dx = Math.sin(pl.char.aimYaw), dz = Math.cos(pl.char.aimYaw), F = K.FIRELINE, FF = K.FRIENDLYFIRE;
    const why = O.give('move', O.targetAt(TO), undefined, { men: [mate] }); const shots0 = pl.rifle.shotsFired;
    let inLane = 0, still = 0, stillMax = 0, there = false, thereFiring = false; trigger = true; f = 0; const t0 = g.time;
    for (let i = 0; i < 20 * 60; i++) {
      if (trigger && g.time - t0 >= 7) trigger = false;
      step();
      const p = mate.char.pos, m = pl.char.muzzle, rx = p[0] - m[0], rz = p[2] - m[2], along = rx * dx + rz * dz, side = Math.abs(rx * dz - rz * dx), firing = pl.rifle.shotsFired > shots0 && g.time - pl.lastFireT < F.fireS;
      if (firing) { if (along > 0.15 && side <= FF.bodyM + F.clearM + along * FF.coneK * F.spread) inLane++; if (Math.hypot(mate.char.vel[0], mate.char.vel[2]) < 0.1) { still += 1 / 60; stillMax = Math.max(stillMax, still); } else still = 0; }
      if (!there && Math.hypot(p[0] - TO[0], p[2] - TO[2]) < 0.5) { there = true; thereFiring = firing; }
      if (there && !trigger && g.time - pl.lastFireT > 2) break;
    }
    return { on: F.on, why, fired: pl.rifle.shotsFired - shots0, inLane, stillMax: +stillMax.toFixed(2), there, thereFiring, state: mate.state, who: mate.callsign };
  };
  const A = await open('');
  const a = await A.page.evaluate(stage);
  line(a.on === true && !a.why && a.fired >= 12 && a.inLane === 0 && a.stillMax >= 4 && a.there && !a.thereFiring && a.state !== 'dead' && !A.errors.length,
    'the page opens with the switch on: the teammate stops short of the lane while the rounds go down it, is never in it under fire, and is on his mark after',
    `FIRELINE.on ${a.on} · ${a.who}: ${a.fired} rounds · frames in the lane ${a.inLane} · stood ${a.stillMax} s · on his mark ${a.there}${a.thereFiring ? ' (under fire)' : ''} · ${a.state}${a.why ? ` · order refused: ${a.why}` : ''} · errors ${JSON.stringify(A.errors.slice(0, 3))}`);
  await A.page.close();
  const B = await open('&nofireline');
  const b = await B.page.evaluate(stage);
  line(b.on === false && !b.why && b.fired >= 12 && b.inLane >= 20 && !B.errors.length, 'the same page with ?nofireline: the switch is off and the same order walks him into the lane under fire',
    `FIRELINE.on ${b.on} · ${b.who}: ${b.fired} rounds · frames in the lane ${b.inLane} · stood ${b.stillMax} s · ${b.state}${b.why ? ` · order refused: ${b.why}` : ''} · errors ${JSON.stringify(B.errors.slice(0, 3))}`);
  await browser.close();
  console.log(failed ? '=== fireline-page: FAIL ===' : '=== fireline-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log(`- FAIL — the page check threw\n    ${String(e && e.stack || e).slice(0, 600)}`); process.exit(1); });
