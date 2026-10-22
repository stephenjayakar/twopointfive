// AN ALERTED MAN DOES NOT WAIT AT A SHUT DOOR, ON THE REAL PAGE (src/game/doorforce.ts): headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's
// recipe), the solo night on the office, one of its staff stood alert three metres off a shut wooden door on the face it opens away from, free to move, the
// player close behind the leaf and walking on the spot (his footfalls filed as his walk files them). Everybody else parked blind and deaf.
//   PORT=5243 node tools/qa/doorforce-page.cjs        (a dev server on that port: PORT=5243 bun run tools/serve.ts)
//   on     the page opens with the switch on (the bundle's own module, booted by the page): he puts rounds through the shut leaf, then boots it in
//   off    the same page with ?doorforce=0: the switch is off, no round is fired while the leaf is shut and its keep is never torn out (he opens it by hand)
// exit 0 = both, with no page error · 1 = otherwise. Nothing here looks at a picture: it reads the game the page runs.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const URL = extra => `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&freshstart=0&nocutboxes${extra}`;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); let failed = false;
  const line = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log('\n=== doorforce-page: on the real page an alerted man fires through a shut wooden door and boots it in; with ?doorforce=0 he opens it by hand ===');
  const open = async extra => { const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(URL(extra));
    const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return document.getElementById('fatal')?.textContent || ''; });
    if (fatal) errors.push('fatal: ' + fatal);
    return { page, errors }; };
  const stage = () => {
    const g = window.__game, e = window.__engine, real = e.render, K = window.__knobs.registry(); window.__menu.close(); window.__smoke.params.enabled = false;
    g.godMode = true; g.aiEnabled = true; g.playerInvisible = false;
    const step = (n = 1, each = () => { }) => { e.render = () => { e.world.upload(); }; try { for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 60, []); each(); } } finally { e.render = real; } };
    step(2);
    const d = g.doors.byName('server_manager'); if (!d || d.def.steel) return { on: K.DOORFORCE.on, why: 'no such wooden door on this page' };
    const c = d.def.closedDir, ux = Math.cos(c), uz = Math.sin(c), W = d.def.width, mx = d.def.hinge[0] + ux * W * 0.5, mz = d.def.hinge[1] + uz * W * 0.5;
    const at = (s, off) => [mx - uz * s * off, 0, mz + ux * s * off], sPull = g.doors.pullFace(d, at(1, 1)) ? 1 : -1, pAt = at(sPull, 0.9), gAt = at(-sPull, 3.0);
    const G = g.guards[0], cc = G.char;
    g.guards.forEach((o, i) => { if (o === G) return; o.hold = true; o.pinned = true; o.dazzledUntil = 1e9; o.heardUpTo = 1e12; o.char.pos[0] = 37.5; o.char.pos[2] = 25 + i * 1.2; o.char.vel[0] = o.char.vel[2] = 0; o.path = []; o.pathGoal = null; o.flashlight.enabled = false; });
    d.angle = 0; d.vel = 0; d.latched = true; g.teleportPlayer(pAt.slice());
    cc.pos[0] = gAt[0]; cc.pos[2] = gAt[2]; cc.vel[0] = cc.vel[2] = 0; cc.bodyYaw = cc.aimYaw = Math.atan2(pAt[0] - gAt[0], pAt[2] - gAt[2]);
    G.hold = false; G.pinned = false; G.state = 'alert'; G.awareness = 1; G.foe = 'player'; G.reactT = 0; G.fireCd = 0.3; G.reloadT = -1; G.lastSeenT = -100; G.lastKnown = [pAt[0], 0, pAt[2]]; G.path = []; G.pathGoal = null; G.heardUpTo = g.eventSeq; G.dazzledUntil = -1; G.script = null; G.flashlight.enabled = false;
    let f = 0, shutShots = 0, mag = G.weapon.roundsReady, openedAt = -1, brokeAt = -1;
    step(12 * 60, () => { f++; if (f % 18 === 1) g.events.push({ kind: 'step', pos: pAt.slice(), time: g.time, loud: false, level: 0.26 });
      const shut = !d.off && Math.abs(d.angle) < 0.25; const m = G.weapon.roundsReady; if (m < mag && shut) shutShots += mag - m; mag = m;
      if (openedAt < 0 && !shut) openedAt = f / 60; if (brokeAt < 0 && d.lockBroken) brokeAt = f / 60; });
    const r2 = x => +x.toFixed(2);
    return { on: K.DOORFORCE.on, why: '', who: G.callsign, shutShots, openedAt: r2(openedAt), brokeAt: r2(brokeAt), angle: r2(d.angle) };
  };
  const tell = (r, E) => r.why ? `DOORFORCE.on ${r.on} · ${r.why}` : `DOORFORCE.on ${r.on} · ${r.who} fired ${r.shutShots} round(s) while the leaf was shut · the leaf left its frame at ${r.openedAt} s · its keep torn out at ${r.brokeAt} s (-1 = never) · the leaf at ${r.angle} rad · errors ${JSON.stringify(E.slice(0, 3))}`;
  const A = await open('');
  const a = await A.page.evaluate(stage);
  line(a.on === true && !a.why && a.shutShots > 0 && a.brokeAt > 0 && !A.errors.length, 'the page opens with the switch on: he puts rounds through the shut leaf, then boots it in', tell(a, A.errors));
  await A.page.close();
  const B = await open('&doorforce=0');
  const b = await B.page.evaluate(stage);
  line(b.on === false && !b.why && b.shutShots === 0 && b.brokeAt < 0 && !B.errors.length, 'the same page with ?doorforce=0: the switch is off, no round while the leaf is shut, its keep never torn out', tell(b, B.errors));
  await browser.close();
  console.log(failed ? '=== doorforce-page: FAIL ===' : '=== doorforce-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log(`- FAIL — the page check threw\n    ${String(e && e.stack || e).slice(0, 600)}`); process.exit(1); });
