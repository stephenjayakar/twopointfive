// THE BIG SLOT'S MOVES ON THE REAL PAGE (src/game/kit.ts BIGSLOT.moves, src/game/bigkit.ts, src/game/character.ts bigTool): headless Chromium on the software
// WebGPU adapter (tools/qa/bigslot-page.cjs's recipe), a kit with the hammer in YOUR big slot and in Red One's planted in the store, the pair's room clear.
//   PORT=5231 node tools/qa/bigmoves-page.cjs [outDir]       (a dev server on that port: PORT=5231 bun run tools/serve.ts)
//   sam    from where a stack's second man stands (1.5 m past the latch edge, by the wall — out of the hand's reach of the leaf) the door's row is the
//          hammer's and the HUD's row is lit; Space: he WALKS to a place beside the frame, never in the opening, the hammer coming off his back into his
//          hands (anim.bigK 0 → 1, his hands off his gun), one blow, the door ends open, the hammer goes back while his legs are his own, his hands are his
//          own after
//   off    the same place under ?nobigmoves: no row from there (the build before: step to the leaf first)
//   mate   X on a shut door, then H: Red One takes the hammer off his back, swings it from beside the frame, puts it back; the door ends open
// exit 0 = all of it, with no page error · 1 = otherwise. With an outDir the renderer's own frames are written there (the software adapter, quality
// `QUALITY`, default low: Sam before / wound up / at the blow / after, Red One wound up / at the blow) — they are for LOOKING at, nothing reads them.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'low', OUT = process.argv[2] || '', ONLY = process.env.ONLY || '', [VW, VH] = (process.env.SIZE || '960x540').split('x').map(Number);
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const man = (big) => ({ weapon: 'rifle', smoke: 1, bangs: 1, frags: 1, shells: 0, charges: 0, walls: 0, big });
const KIT = JSON.stringify({ v: 2, members: [man('hammer'), man('hammer')] });
if (OUT) fs.mkdirSync(OUT, { recursive: true });
// (in the page) two real frames, then the renderer's frame read back as a PNG
const DRAW = async () => {
  const dev = window.__engine.device, yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  for (let i = 0; i < 2; i++) { window.__runFrames(1, 1 / 2000); await dev.queue.onSubmittedWorkDone(); await yieldMacro(); }
  window.__engine.render(window.__cam, window.__game.time, 1 / 60, false); const fr = await window.__engine.readbackFrame(); if (!fr) return { err: 'no frame' };
  if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
  for (let i = 0; i < fr.data.length; i += 4) fr.data[i + 3] = 255;
  const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h; c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0);
  return { url: c2.toDataURL('image/png') };
};
// (in the page) helpers every section shares, on window: the door's own frame, an undrawn step, the camera and a work lamp on a spot
const HELP = () => {
  window.__bmStep = (n) => { const e = window.__engine, real = e.render; e.render = () => { e.world.upload(); }; try { window.__runFrames(n, 1 / 60, []); } finally { e.render = real; } };
  window.__bmU = (d) => { const a = d.def.closedDir; return [Math.cos(a), Math.sin(a)]; };   // (the CLOSED leaf's line: d.dir() swings with the leaf)
  window.__bmPt = (d, s, al, off, y = 0) => { const u = window.__bmU(d), [hx, hz] = d.def.hinge; return [hx + u[0] * al + u[1] * s * off, y, hz + u[1] * al - u[0] * s * off]; };
  window.__bmAlong = (d, p) => { const u = window.__bmU(d), [hx, hz] = d.def.hinge; return (p[0] - hx) * u[0] + (p[2] - hz) * u[1]; };
  window.__bmOff = (d, s, p) => { const u = window.__bmU(d), [hx, hz] = d.def.hinge; return ((p[0] - hx) * u[1] - (p[2] - hz) * u[0]) * s; };
  // the camera on a point at chest height, off to one side of the face's normal, from the first side and distance with a clear line; a soft lamp on the same side
  window.__bmPin = (d, s, look, dist = 4.2, pitch = 0.95) => { const g = window.__game, col = g.col, u = window.__bmU(d), n = [u[1] * s, 0, -u[0] * s], y0 = Math.atan2(n[0], n[2]); let pick = [0.8, dist];
    find: for (const dd of [dist, dist * 0.85]) for (const t of [0.9, -0.9, 0.4, -0.4]) { const y = y0 + t, cp = Math.cos(pitch), eye = [look[0] + Math.sin(y) * cp * dd, look[1] + Math.sin(pitch) * dd, look[2] + Math.cos(y) * cp * dd]; if (!col.solidBlocked(eye, look)) { pick = [t, dd]; break find; } }
    window.__stage({ look, yaw: y0 + pick[0], pitch, dist: pick[1] }, {});
    const L = window.__engine.lights, old = window.__lamp; if (old) { old.enabled = false; old.ttl = 0; old.age = 1; }
    const sg = Math.sign(pick[0]) || 1, at = [look[0] + n[0] * 1.3 + n[2] * sg * 0.7, 2.3, look[2] + n[2] * 1.3 - n[0] * sg * 0.7];
    window.__lamp = L.flash(at, [1, 0.95, 0.85], 10, 7, 600, 0); window.__lamp.radius = 0.18; };
  // a shut wooden door with floor where a stack's second man stands on the face it opens AWAY from: [door, side, that place]
  window.__bmDoor = (from) => { const g = window.__game, col = g.col;
    const wood = g.doors.list.filter(d => !d.off && d.isClosed() && !d.def.steel).sort((a, b) => Math.hypot(from[0] - a.pos[0], from[2] - a.pos[2]) - Math.hypot(from[0] - b.pos[0], from[2] - b.pos[2]));
    for (const d of wood) for (const s of [1, -1]) { const W = d.def.width, p = window.__bmPt(d, s, W + 1.5, 0.6), mid = window.__bmPt(d, s, W / 2, 0.6), by = window.__bmPt(d, s, W + 0.3, 0.6);
      if (g.doors.bootHolds(d, mid) || col.nav.isBlocked(p[0], p[2]) || col.nav.isBlocked(by[0], by[2]) || col.solidBlocked([p[0], 1, p[2]], [by[0], 1, by[2]]) || col.solidBlocked([by[0], 1, by[2]], [mid[0], 1, mid[2]])) continue;
      return { d, s, p }; }
    return null; };
};
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); let failed = false;
  const line = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const open = async (q) => {
    const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 }); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.addInitScript(k => { try { localStorage.setItem('twopointsix.kit', k); } catch { } }, KIT);
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&${q}`);
    const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return document.getElementById('fatal')?.textContent || ''; });
    if (fatal) errors.push('fatal: ' + fatal);
    await page.evaluate(HELP);
    await page.evaluate(() => { const g = window.__game; window.__smoke.params.enabled = false; g.aiEnabled = false; g.godMode = true; window.__bmStep(30); });
    return { page, errors };
  };
  const still = async (page, name) => { if (!OUT) return; const cap = await page.evaluate(DRAW).catch(e => ({ err: String(e).slice(0, 160) }));
    if (cap.url) fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(cap.url.split(',')[1], 'base64')); else console.log(`    (no still ${name}: ${cap.err})`); };
  // Sam put where a stack's second man stands at a door unlocked by hand; what that place offers
  const stage = (page) => page.evaluate(() => { const g = window.__game, pl = g.player, F = window.__bmDoor(pl.char.pos); if (!F) return { why: 'no shut wooden door with floor beside it' };
    const { d, s, p } = F; d.angle = 0; d.vel = 0; d.latched = true; d.locked = false; d.lockBroken = false; window.__bmD = d; window.__bmS = s;
    g.teleportPlayer(p); const cv = document.querySelector('#view'), aim = () => { const [sx, sy] = window.__cam.project([d.frameCentre[0], 1, d.frameCentre[2]], cv.clientWidth, cv.clientHeight); window.__mouse(sx, sy); };
    window.__bmPin(d, s, window.__bmPt(d, s, d.def.width + 0.55, 0.55, 1.0)); aim(); window.__bmStep(14);
    const b = document.querySelector('#equip .slot.big'), rows = g.nearby.filter(r => r.kind === 'door' && (!r.door || r.door === d)).map(r => r.verb);
    return { door: d.def.name, W: d.def.width, reach: Math.hypot(p[0] - d.frameCentre[0], p[2] - d.frameCentre[2]), bigKit: pl.bigKit, moves: window.__knobs?.registry?.().BIGSLOT?.moves, rows, lit: !!b && b.classList.contains('sel'), bigK: pl.char.anim.bigK, posed: !!pl.char.anim.bigTool }; });

  if (!ONLY || ONLY === 'sam') { const { page, errors } = await open('roomclear&nocutboxes');
    const S = await stage(page);
    line(!S.why && S.moves === true && S.bigKit === 'hammer' && S.reach > 1.35 && S.rows.includes('hammer') && S.lit && S.bigK === 0 && !S.posed, 'YOU, THE HAMMER, where a stack\'s second man stands (1.5 m past the latch edge, by the wall — outside the hand\'s reach of the leaf): the door\'s row is the hammer\'s, the HUD\'s row is lit, the hammer on your back', JSON.stringify(S));
    if (S.why) { line(errors.length === 0, 'no page error (sam)', errors.join(' · ') || 'none'); await page.close(); await browser.close(); console.log('\nbigmoves-page: FAILED'); process.exit(1); }
    await still(page, 'moves-1-on-his-back');
    // Space — to the frame before the wind-up is at its top
    const A = await page.evaluate(() => { const g = window.__game, pl = g.player, d = window.__bmD, s = window.__bmS, an = pl.char.anim, W = d.def.width;
      const ok = g.selectVerb('door', 'hammer') && g.hover?.door === d; if (ok) { window.__input.pressed.add('Space'); window.__bmStep(1); }
      const T = window.__bmT = { began: !!pl.kick?.tool?.moves && pl.kick.door === d, inOpening: 0, walked: 0, posed: 0, offGun: 0, kMax: 0, frames: 0 };
      window.__bmWatch = () => { const p = pl.char.pos, al = window.__bmAlong(d, p), off = window.__bmOff(d, s, p); T.frames++; if (pl.kick) { if (al > 0.05 && al < W - 0.05 && off < 1.3) T.inOpening++; if (an.speed > 0.2) T.walked++; }
        if (an.bigTool) T.posed++; if (an.hideHeldItem) T.offGun++; T.kMax = Math.max(T.kMax, an.bigK); };
      for (let i = 0; i < 400 && pl.kick; i++) { window.__bmStep(1); window.__bmWatch(); const B = an.bigTool; if (B && B.blows.length && B.blows[0] - B.t < 0.1) break; }
      return { ok, ...T, t: an.bigTool?.t ?? null, blow: an.bigTool?.blows?.[0] ?? null, bigK: an.bigK }; });
    await still(page, 'moves-2-wound-up');
    const B = await page.evaluate(() => { const g = window.__game, pl = g.player, d = window.__bmD;
      for (let i = 0; i < 120 && d.latched && !d.lockBroken; i++) { window.__bmStep(1); window.__bmWatch(); }
      return { broken: !!d.lockBroken, t: pl.char.anim.bigTool?.t ?? null, at: [window.__bmAlong(d, pl.char.pos), window.__bmOff(d, window.__bmS, pl.char.pos)] }; });
    await still(page, 'moves-3-the-blow');
    const C = await page.evaluate(() => { const g = window.__game, pl = g.player, d = window.__bmD, an = pl.char.anim;
      for (let i = 0; i < 240 && pl.kick; i++) { window.__bmStep(1); window.__bmWatch(); }
      const free = { posed: !!an.bigTool, lock: pl.equipT }; let n = 0; for (; n < 240 && (n < 40 || an.bigTool || an.kitBusy || pl.equipT > 0); n++) { window.__bmStep(1); window.__bmWatch(); }   // (to the frame a round could leave his gun: the tool back on him, then the kit's own draw)
      return { ...window.__bmT, free, gunBack: n / 60, open: Math.abs(d.angle) > 0.5, after: { posed: !!an.bigTool, bigK: an.bigK, offGun: an.hideHeldItem, lock: pl.equipT } }; });
    await still(page, 'moves-4-after');
    line(A.ok && A.began && C.walked >= 15 && C.inOpening === 0 && (B.at[0] < -0.05 || B.at[0] > S.W + 0.05) && B.at[1] < 0.9, 'Space from there: he WALKS to a place beside the frame — never in the opening — and works it hard by the wall', `began ${A.began} · frames his legs walked ${C.walked} · frames in the opening ${C.inOpening} · he stood ${B.at[0].toFixed(2)} m along a ${S.W.toFixed(2)} m leaf, ${B.at[1].toFixed(2)} m off the wall`);
    line(C.posed > 30 && C.kMax > 0.99 && C.offGun > 30 && B.broken && C.open && C.free.posed && C.free.lock > 0.3 && !C.after.posed && C.after.bigK === 0 && !C.after.offGun && C.after.lock === 0 && C.gunBack < 2, 'the hammer comes off his back into his hands (his hands off his gun), ONE blow, the door ENDS OPEN; it goes back while his legs are his own, and his hands are his own after', JSON.stringify({ posed: C.posed, kMax: C.kMax, offGun: C.offGun, broken: B.broken, open: C.open, free: C.free, 'gun back s after his legs': C.gunBack, after: C.after }));
    line(errors.length === 0, 'no page error (sam)', errors.join(' · ') || 'none'); await page.close(); }

  if (!ONLY || ONLY === 'off') { const { page, errors } = await open('roomclear&nocutboxes&nobigmoves');
    const S = await stage(page);
    line(!S.why && S.moves === false && S.bigKit === 'hammer' && !S.rows.includes('hammer') && !S.lit, '?nobigmoves: the same place offers no row (the build before: step to the leaf first)', JSON.stringify(S));
    line(errors.length === 0, 'no page error (off)', errors.join(' · ') || 'none'); await page.close(); }

  if (!ONLY || ONLY === 'mate') { const { page, errors } = await open('roomclear&nocutboxes');
    const M = await page.evaluate(() => { const g = window.__game, pl = g.player, O = g.orders, mates = g.guards.filter(x => x.unit && x.team === 'operative' && x.state !== 'dead'), gd = mates[0]; if (!gd) return { why: 'no teammate' };
      const F = window.__bmDoor(gd.char.pos); if (!F) return { why: 'no shut wooden door with floor beside it' }; const { d, s, p } = F; window.__bmD = d; window.__bmS = s; window.__bmG = gd;
      g.aiEnabled = true;   // (the squad walks on its orders; the floor's defenders are parked out of the fight below)
      for (const x of g.guards) if (x.team !== 'operative' && x.state !== 'dead') { x.state = 'unconscious'; x.koT = 1e9; }
      g.teleportPlayer(window.__bmPt(d, s, d.def.width + 2.6, 1.4)); window.__bmPin(d, s, window.__bmPt(d, s, d.def.width / 2, 0.5, 1.0), 3.8); window.__bmStep(6);
      const up = O.open(O.targetAt(d.frameCentre)); window.__bmStep(2); const shown = (O.hud().menu?.rows ?? []).flatMap(r => r.opts.map(x => `${x.key ? `[${x.key}] ` : ''}${x.text}`)).join(' | ');
      window.__input.pressed.add('KeyH'); window.__bmStep(1);
      const T = window.__bmT = { posed: 0, offGun: 0, kMax: 0, out: 0 }, an = gd.char.anim; let wound = false;
      window.__bmWatch = () => { if (gd.bigOut) T.out++; if (an.bigTool) T.posed++; if (an.hideHeldItem) T.offGun++; T.kMax = Math.max(T.kMax, an.bigK); };
      for (let i = 0; i < 1500 && !wound; i++) { window.__bmStep(1); window.__bmWatch(); const H = gd.bigOut, t = H ? g.time - H.t0 : 0; wound = !!H && H.blows.length > 0 && H.blows[0] - t < 0.1 && H.blows[0] - t > 0; }
      return { door: d.def.name, W: d.def.width, name: gd.callsign, up, shown, wound, big: g.doorTools.ops.some(op => op.big) }; });
    if (M.why) { line(false, 'A TEAMMATE, X then H', M.why); await page.close(); await browser.close(); console.log('\nbigmoves-page: FAILED'); process.exit(1); }
    await still(page, 'moves-5-mate-wound-up');
    const N = await page.evaluate(() => { const d = window.__bmD; for (let i = 0; i < 200 && d.latched && !d.lockBroken; i++) { window.__bmStep(1); window.__bmWatch(); }
      const gd = window.__bmG; return { broken: !!d.lockBroken, at: [window.__bmAlong(d, gd.char.pos), Math.abs(window.__bmOff(d, 1, gd.char.pos))] }; });
    await still(page, 'moves-6-mate-the-blow');
    const P = await page.evaluate(() => { const d = window.__bmD, gd = window.__bmG; for (let i = 0; i < 240; i++) { window.__bmStep(1); window.__bmWatch(); }
      return { ...window.__bmT, open: Math.abs(d.angle) > 0.5, after: { out: !!gd.bigOut, posed: !!gd.char.anim.bigTool, bigK: gd.char.anim.bigK } }; });
    line(!M.why && M.up && /H: hammer and clear/.test(M.shown || '') && M.big && M.wound && N.broken && P.open && P.out > 30 && P.posed > 30 && P.kMax > 0.99 && P.offGun > 20 && !P.after.out && !P.after.posed && P.after.bigK === 0 && (N.at[0] < -0.05 || N.at[0] > M.W + 0.05) && N.at[1] < 0.9,
      'A TEAMMATE, X then H: the hammer comes off his back into his hands, is swung from beside the frame and out of the opening, the door ends open, and it is on his back again', JSON.stringify({ ...M, ...N, ...P }));
    line(errors.length === 0, 'no page error (mate)', errors.join(' · ') || 'none'); await page.close(); }
  await browser.close();
  console.log(failed ? '\nbigmoves-page: FAILED' : '\nbigmoves-page: ALL PASS'); process.exit(failed ? 1 : 0);
})().catch(e => { console.log(`- FAIL — the script died\n    ${String(e && e.stack || e).slice(0, 600)}\n\nbigmoves-page: FAILED`); process.exit(1); });
