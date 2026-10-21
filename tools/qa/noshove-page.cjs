// TEAMMATES FALLING IN NEVER SHOVE YOU, ON THE REAL PAGE (src/game/noshove.ts): headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's
// recipe), the four-man room clear staged, the defenders kept calm by hand, no key down.
//   PORT=5243 node tools/qa/noshove-page.cjs        (a dev server on that port: PORT=5243 bun run tools/serve.ts)
//   on     the page opens with the switch on (the bundle's own module, booted by the page): 'fall in' with one man a pace from the standing player and his
//          place on the player's far side — the player is not moved, the man goes round him
//   off    the same page with ?noshove=0: the switch is off, the same man shoulders the player aside
// exit 0 = both, with no page error · 1 = otherwise. Nothing here looks at a picture: it reads the game the page runs.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const URL = extra => `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&roomclear&squad4&freshstart=0&nocutboxes${extra}`;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); let failed = false;
  const line = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log('\n=== noshove-page: on the real page a man falling in goes round the standing player; with ?noshove=0 he shoulders him aside ===');
  const open = async extra => { const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(URL(extra));
    const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return document.getElementById('fatal')?.textContent || ''; });
    if (fatal) errors.push('fatal: ' + fatal);
    return { page, errors }; };
  const stage = () => {
    const g = window.__game, e = window.__engine, real = e.render, K = window.__knobs.registry(); window.__menu.close(); window.__smoke.params.enabled = false;
    const SAM = [9.35, 0, 20.05], pl = g.player, O = g.orders; g.godMode = true;   // (open floor: a body's room and more every way — tools/qa/noshove-check.ts finds the same spot)
    const ops = g.guards.filter(x => x.team === 'operative' && x.state !== 'dead'), foes = g.guards.filter(x => x.team !== 'operative' && !x.civ && x.state !== 'dead');
    const home = new Map(foes.map(h => [h, [h.char.pos[0], 0, h.char.pos[2]]]));
    const put = (gd, p) => { gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.char.vel[0] = gd.char.vel[2] = 0; gd.path = []; gd.pathGoal = null; gd.speed = 0; };
    const calm = () => { for (const h of foes) if (h.state !== 'dead') { h.state = 'patrol'; h.awareness = 0; put(h, home.get(h)); } };
    const step = (n = 1, each = () => { }) => { e.render = () => { e.world.upload(); }; try { for (let i = 0; i < n; i++) { calm(); window.__runFrames(1, 1 / 60, []); each(); } } finally { e.render = real; } };
    const at = i => i === 0 ? [SAM[0], 0, SAM[2] - 0.58] : [SAM[0] + (i - 2) * 0.9, 0, SAM[2] + 2.2 + 0.45 * i];
    const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
    g.teleportPlayer([SAM[0] + 60, 0, SAM[2]]); step(2); ops.forEach((o, i) => put(o, at(i)));
    g.teleportPlayer(SAM); step(2); ops.forEach((o, i) => put(o, at(i)));
    const why = O.give('fallIn', O.targetAt(SAM), undefined, { men: ops });
    const s0 = [pl.char.pos[0], 0, pl.char.pos[2]], m = ops[0]; let shoved = 0, nearest = 9, passed = false;
    step(5 * 60, () => { shoved = Math.max(shoved, flat(pl.char.pos, s0)); nearest = Math.min(nearest, flat(m.char.pos, pl.char.pos)); if (m.char.pos[2] - pl.char.pos[2] > 0.3) passed = true; });
    const r3 = x => +x.toFixed(3);
    return { on: K.NOSHOVE.on, why, shoved: r3(shoved), nearest: r3(nearest), passed, who: m.callsign, up: ops.filter(o => o.state !== 'dead').length };
  };
  const tell = (r, E) => `NOSHOVE.on ${r.on} · the player moved ${r.shoved} m · ${r.who} came to ${r.nearest} m of him, round him ${r.passed} · ${r.up} up${r.why ? ` · fall in refused: ${r.why}` : ''} · errors ${JSON.stringify(E.slice(0, 3))}`;
  const A = await open('');
  const a = await A.page.evaluate(stage);
  line(a.on === true && !a.why && a.shoved < 0.01 && a.nearest >= 0.55 && a.passed && !A.errors.length, 'the page opens with the switch on: the standing player is not moved, the man goes round him', tell(a, A.errors));
  await A.page.close();
  const B = await open('&noshove=0');
  const b = await B.page.evaluate(stage);
  line(b.on === false && !b.why && b.shoved > 0.1 && !B.errors.length, 'the same page with ?noshove=0: the switch is off, and the man shoulders the player aside', tell(b, B.errors));
  await browser.close();
  console.log(failed ? '=== noshove-page: FAIL ===' : '=== noshove-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log(`- FAIL — the page check threw\n    ${String(e && e.stack || e).slice(0, 600)}`); process.exit(1); });
