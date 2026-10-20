// THE TEAM'S PACE ON THE REAL PAGE (src/game/teampace.ts): headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's recipe), the
// four-man room clear staged, the defenders kept calm by hand.
//   PORT=5243 node tools/qa/teampace-page.cjs        (a dev server on that port: PORT=5243 bun run tools/serve.ts)
//   on     the page opens with the switch on (the bundle's own module, booted by the page): four men sent across the floor walk under the player's own
//          walk, and fallen in behind a player who sprints (the real keys held) all four run with him
//   off    the same page with ?teampace=0: the switch is off, the same order walks them at the orders' old pace and nobody runs behind his sprint
// exit 0 = both, with no page error · 1 = otherwise. Nothing here looks at a picture: it reads the game the page runs.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const URL = extra => `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&roomclear&squad4&freshstart=0&nocutboxes${extra}`;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); let failed = false;
  const line = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log('\n=== teampace-page: on the real page an ordered team walks slower than the player and runs behind his sprint; with ?teampace=0 neither ===');
  const open = async extra => { const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(URL(extra));
    const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return document.getElementById('fatal')?.textContent || ''; });
    if (fatal) errors.push('fatal: ' + fatal);
    return { page, errors }; };
  const stage = () => {
    const g = window.__game, e = window.__engine, real = e.render, K = window.__knobs.registry(); window.__menu.close(); window.__smoke.params.enabled = false;
    const SAM = [13, 0, 18], TO = [19.5, 0, 14.6], pl = g.player, O = g.orders; g.godMode = true;
    const ops = g.guards.filter(x => x.team === 'operative' && x.state !== 'dead'), foes = g.guards.filter(x => x.team !== 'operative' && !x.civ && x.state !== 'dead');
    const home = new Map(foes.map(h => [h, [h.char.pos[0], 0, h.char.pos[2]]]));
    const put = (gd, p) => { gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.char.vel[0] = gd.char.vel[2] = 0; gd.path = []; gd.pathGoal = null; };
    const calm = () => { for (const h of foes) if (h.state !== 'dead') { h.state = 'patrol'; h.awareness = 0; put(h, home.get(h)); } };
    const v = gd => Math.hypot(gd.char.vel[0], gd.char.vel[2]);
    const step = (n = 1, keys = [], each = () => { }) => { e.render = () => { e.world.upload(); }; try { for (let i = 0; i < n; i++) { calm(); window.__runFrames(1, 1 / 60, keys); each(); } } finally { e.render = real; } };
    // the order: all four across the floor, the player standing
    g.teleportPlayer(SAM); ops.forEach((o, i) => put(o, [11 + i * 0.9, 0, 22.4])); step(30);
    const why = O.give('move', O.targetAt(TO), 'all'); let walkTop = 0; step(90);   // (a second and a half for a man who was closing on the player to come down to the walk)
    step(4 * 60, [], () => { for (const o of ops) walkTop = Math.max(walkTop, v(o)); });
    // fallen in, the player sprints (the real keys): the way his legs get furthest of the four the keys give
    const whyIn = O.give('fallIn', O.targetAt(SAM), undefined, { men: ops }); step(8 * 60);   // (the four by name: a man standing by the point would take the order alone)
    let best = { ran: 0, tops: [], key: '', sprinted: 0 };
    for (const key of ['KeyW', 'KeyD', 'KeyS', 'KeyA']) {
      g.teleportPlayer(SAM); step(4 * 60);
      const tops = ops.map(() => 0); let sprinted = 0; step(150, [key, 'ShiftLeft'], () => { if (pl.sprinting) sprinted++; ops.forEach((o, i) => { tops[i] = Math.max(tops[i], v(o)); }); });
      const ran = Math.hypot(pl.char.pos[0] - SAM[0], pl.char.pos[2] - SAM[2]);
      if (ran > best.ran) best = { ran, tops, key, sprinted };
    }
    const r2 = x => +x.toFixed(2);
    return { on: K.TEAMPACE.on, why, whyIn, walkTop: r2(walkTop), walk: r2(g.tune.playerWalk), k: K.TEAMPACE.k, ran: r2(best.ran), key: best.key, sprinted: best.sprinted, tops: best.tops.map(r2), up: ops.filter(o => o.state !== 'dead').length };
  };
  const tell = (r, E) => `TEAMPACE.on ${r.on} · ordered: fastest ${r.walkTop} m/s (the player walks ${r.walk}) · behind his sprint (${r.key}, ${r.sprinted} frames, ${r.ran} m): followers' tops ${r.tops.join(' / ')} m/s · ${r.up} up${r.why ? ` · move refused: ${r.why}` : ''}${r.whyIn ? ` · fall in refused: ${r.whyIn}` : ''} · errors ${JSON.stringify(E.slice(0, 3))}`;
  const A = await open('');
  const a = await A.page.evaluate(stage);
  line(a.on === true && !a.why && !a.whyIn && a.walkTop > 0.8 && a.walkTop <= a.walk * a.k * 1.15 + 0.05 && a.ran > 4 && Math.min(...a.tops) >= 3 && !A.errors.length,
    'the page opens with the switch on: the ordered four walk under the player\'s own walk, and behind his sprint all four run', tell(a, A.errors));
  await A.page.close();
  const B = await open('&teampace=0');
  const b = await B.page.evaluate(stage);
  line(b.on === false && !b.why && !b.whyIn && b.walkTop >= 1.8 && b.ran > 4 && Math.max(...b.tops) <= 2.5 && !B.errors.length,
    'the same page with ?teampace=0: the switch is off, the order walks them at the old pace and nobody runs behind his sprint', tell(b, B.errors));
  await browser.close();
  console.log(failed ? '=== teampace-page: FAIL ===' : '=== teampace-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log(`- FAIL — the page check threw\n    ${String(e && e.stack || e).slice(0, 600)}`); process.exit(1); });
