// HANDWORK LOOK: stills of the hands at work (src/game/handwork.ts) off the real page on the software WebGPU adapter — Sam's finger on the server room's keypad,
// his hand on the breaker's lever, both hands in the rack and the drive put away, both hands on a wall charge; a guard's hand to his radio; a guard's torch to
// sidearm swap as a strip; the guard sent to the breaker with his hand on the lever. The camera is pinned low and close on the hands.
//   node tools/qa/handwork-look.cjs <outDir> [extra query, e.g. nohandwork]      env: PORT (default 5199) · SIZE (default 960x540) · QUALITY (default low) · ONLY=pad,breaker,drive,charge,radio,swap,guard
// Slow by nature (page-look.cjs says why): ~95 s to boot, 5–15 s a drawn frame.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const outDir = process.argv[2] || 'handwork-look', extra = process.argv[3] || '';
const PORT = process.env.PORT || 5199, [W, H] = (process.env.SIZE || '960x540').split('x').map(Number), QUALITY = process.env.QUALITY || 'low';
const ONLY = (process.env.ONLY || 'pad,breaker,drive,charge,radio,swap,guard').split(',');
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
// the page's own loop for `secs`, undrawn; a Space tap first when asked; the cursor held on a world point when given
const PLAY = ({ secs, tap, cursor }) => {
  const e = window.__engine, real = e.render; e.render = () => {};
  const aim = () => { if (!cursor) return; const cv = document.querySelector('#view'), [sx, sy] = window.__cam.project(cursor, cv.clientWidth, cv.clientHeight); window.__mouse(sx, sy); };
  try {
    aim();
    if (tap) { window.__input.pressed.add('Space'); window.__runFrames(1, 1 / 60, ['Space']); window.__runFrames(1, 1 / 60); }
    for (let i = 0, n = Math.max(0, Math.round(secs * 60)); i < n; i++) { aim(); window.__runFrames(1, 1 / 60); }
  } finally { e.render = real; }
  const g = window.__game, pl = g.player, wi = pl.char.anim.workInfo();
  return { t: +g.time.toFixed(2), pos: Array.from(pl.char.pos).map(v => +v.toFixed(2)), work: wi.pose ? wi.pose.kind + ' w ' + wi.w.toFixed(2) : null, rows: g.nearby.map(r => r.kind + ':' + (r.verb || '-')).join(' '), msg: g.message ?? null };
};
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 600)));
  page.on('console', m => { if (m.type() === 'error' && !/smoke|storage textures|Failed to load resource/i.test(m.text())) errors.push(m.text().slice(0, 300)); });
  const url = `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&difficulty=hard${extra ? '&' + extra : ''}`;
  log('goto', url); await page.goto(url);
  await page.evaluate(async () => { await window.__ready; window.__testVisible = true; });
  await page.evaluate(async () => { const P = window.__cut?.programs, r = P?.swap ? P.ready : null; if (r) await Promise.race([Promise.resolve(r).catch(() => 0), new Promise(d => setTimeout(d, 300000))]); });
  log('ready');
  await page.evaluate(() => { window.__menu.close(); window.__smoke.params.enabled = false; const g = window.__game; g.godMode = true; g.playerInvisible = true; });
  const still = async (name) => { const cap = await page.evaluate(DRAW, 2); if (cap.url) fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(cap.url.split(',')[1], 'base64'));
    log('still', name, cap.err || '', await page.evaluate(() => { const L = window.__engine.lights, l = window.__lamp; return l ? `lamp ${L.lights.includes(l) ? 'slot ' + l.slot : 'GONE'} at ${Array.from(l.pos).map(v => v.toFixed(2))} · ${L.lights.filter(x => x.enabled).length} lights on` : 'no lamp'; })); };
  const play = async (secs, tap, cursor) => { const r = await page.evaluate(PLAY, { secs, tap, cursor }); log('  play', secs, JSON.stringify(r)); return r; };
  // the camera low and close on a spot at hand height, off to one side of the line out of the thing's face (n: toward the man)
  // (…from the first side and distance with a clear line from the lens to the spot: a partition or a rack row may stand where the asked side would put it. Returns the turn it took: the lamp goes to the same side)
  const pin = (p, n, turn = 0.95, dist = 2.5, pitch = 0.5) => page.evaluate(({ p, n, turn, dist, pitch }) => { const col = window.__game.col, look = [p[0] + n[0] * 0.25, p[1] - 0.05, p[2] + n[2] * 0.25], y0 = Math.atan2(n[0], n[2]); let pick = [turn, dist];
    find: for (const d of [dist, dist * 0.75, dist * 0.55]) for (const t of [turn, -turn, turn * 0.6, -turn * 0.6, 0.25, -0.25]) { const y = y0 + t, cp = Math.cos(pitch), eye = [look[0] + Math.sin(y) * cp * d, look[1] + Math.sin(pitch) * d, look[2] + Math.cos(y) * cp * d]; if (!col.solidBlocked(eye, look)) { pick = [t, d]; break find; } }
    window.__stage({ look, yaw: y0 + pick[0], pitch, dist: pick[1] }, {}); return pick[0]; }, { p, n, turn, dist, pitch });
  const ai = (on) => page.evaluate((on) => { window.__game.aiEnabled = on; }, on);
  const sam = (pos, holster = true) => page.evaluate(({ pos, holster }) => { const g = window.__game; g.teleportPlayer(pos); g.player.holstered = holster; }, { pos, holster });

  // a work lamp for the still (the office is a night level): a soft white point light up and to the camera's side of the spot — staging only, taken away by the next (a ttl of minutes, not 1e9: lights.ts floors the envelope's step at 1e-6 of the ttl, and a flash that long comes out at a hundred-thousandth of its strength)
  const lamp = (p, n, turn = 0.95, side = false) => page.evaluate(({ p, n, turn, side }) => { const L = window.__engine.lights, old = window.__lamp; if (old) { old.enabled = false; old.ttl = 0; old.age = 1; }
    const col = window.__game.col, to = [p[0] + n[0] * 0.3, p[1], p[2] + n[2] * 0.3], sg = Math.sign(turn) || 1, sx = n[2] * sg, sz = -n[0] * sg; let at = null;   // (over FREE FLOOR on the man's side of the thing, off to the camera's side, with a clear line to just off its face: a doorway or a rack row has walls where a fixed spot would be)
    find: for (const d of side ? [0.55, 0.8, 1.1, 1.5] : [1.3, 0.9, 1.7, 0.6]) for (const sd of side ? [1.3, 1.0, 0.7, 0.35] : [0.7, 0.35, 0, -0.5]) for (const up of [0.9, 0.6]) { /* (`side`: along the face from the camera's side, for a man square in front of the thing with both hands on it — a lamp behind him lays his own shadow over his hands) */ const q = [p[0] + n[0] * d + sx * sd, Math.min(2.5, p[1] + up), p[2] + n[2] * d + sz * sd]; if (!col.nav.isBlocked(q[0], q[2]) && !col.solidBlocked(q, to)) { at = q; break find; } }
    at = at || [to[0], Math.min(2.5, p[1] + 0.8), to[2]];
    window.__lamp = L.flash(at, [1, 0.95, 0.85], 10, 7, 600, 0); window.__lamp.radius = 0.18; return at; }, { p, n, turn, side });

  await play(0.3);   // (the page's first frames, before any staging: what a fresh floor does on its first update is done)
  if (ONLY.includes('pad')) {   // ---- the keypad on the server room's side door
    await ai(false);
    const K = await page.evaluate(() => { const g = window.__game, K = g.devices.keypads[0]; g.player.codes.add(K.def.name); const f = K.door.frameCentre; return { p: Array.from(K.def.pos), n: [Math.round(K.n[0]), 0, Math.round(K.n[2])], f: Array.from(f) }; });
    await sam([K.f[0] + K.n[0] * 0.9, 0, K.f[2] + K.n[2] * 0.9]); await lamp(K.p, K.n, await pin(K.p, K.n, 1.0)); await play(0.3);
    await page.evaluate(() => window.__game.selectVerb('door', 'code')); await play(0.8, true); await still('pad-1-key');
    await pin(K.p, K.n, 0.55, 1.25, 0.3); await play(0.24); await still('pad-2-close');
    await play(1.5);
  }
  if (ONLY.includes('breaker')) {   // ---- the mains breaker, by his hand
    await ai(false);
    const B = await page.evaluate(() => { const b = window.__game.level.breaker.pos; return { p: [b[0], b[1], b[2] + 0.06], n: [0, 0, -1] }; });
    await sam([B.p[0], 0, B.p[2] - 0.95]); await lamp(B.p, B.n, await pin(B.p, B.n, 1.0)); await play(0.4);
    await page.evaluate(() => window.__game.selectVerb('breaker')); await play(0.42, true); await still('breaker-1-hand');
    await pin(B.p, B.n, 0.55, 1.25, 0.3); await play(0.03); await still('breaker-2-close');
    await play(1.0); await page.evaluate(() => { const g = window.__game; if (g.blackout.active) g.endBlackout(); }); await play(1.5);
  }
  if (ONLY.includes('drive')) {   // ---- the objective: the drive out of the rack
    await ai(false);
    const R = await page.evaluate(() => { const g = window.__game, f = g.level.mission.rack.front; g.mission.stage = 'drive'; return { p: [f[0], f[1], f[2]], n: [0, 0, 1] }; });
    // (side-on and low, here and at the wall charge: square in front of the thing his body hides both hands from any camera behind him)
    await sam([R.p[0], 0, R.p[2] + 0.9]); await lamp(R.p, R.n, await pin(R.p, R.n, 1.3, 1.8, 0.3), true); await play(0.4);
    await page.evaluate(() => window.__game.selectVerb('objective', 'drive')); await play(1.2, true); await still('drive-1-hands-in');
    for (let i = 0; i < 80; i++) { const s = await page.evaluate(() => window.__game.mission.stage); if (s !== 'drive') break; await play(0.05); }
    await play(0.2); await still('drive-2-put-away'); await play(1.0);
  }
  if (ONLY.includes('charge')) {   // ---- a breaching charge on a partition, by his own hands
    await ai(true);
    const Wl = await page.evaluate(() => { const g = window.__game, free = p => !g.col.nav.isBlocked(p[0], p[2]);
      for (const w of g.destr.walls.all()) { if (w.kind !== 'wall') continue; const b = w.box, ax = b.h[0] >= b.h[2], L = ax ? b.h[0] : b.h[2], T = ax ? b.h[2] : b.h[0]; if (L < 1.6) continue;
        for (let u = -L + 1.2; u <= L - 1.2; u += 0.6) for (const side of [1, -1]) { const mid = ax ? [b.c[0] + u, 1.05, b.c[2]] : [b.c[0], 1.05, b.c[2] + u], n = ax ? [0, 0, side] : [side, 0, 0], off = d => [mid[0] + n[0] * d, 0, mid[2] + n[2] * d];
          if (![0.6, 1.2, 2.4].every(d => free(off(d)) && free(off(-d)))) continue; return { p: [mid[0] + n[0] * T, 1.2, mid[2] + n[2] * T], n, top: [mid[0], b.c[1] + b.h[1], mid[2]], foot: off(T + 0.55) }; } }
      return null; });
    log('wall', JSON.stringify(Wl));
    if (Wl) {
      await sam(Wl.foot); await lamp(Wl.p, Wl.n, await pin(Wl.p, Wl.n, 1.3, 1.8, 0.3), true); await play(0.5, false, Wl.top);
      const ok = await page.evaluate(() => window.__game.selectVerb('wall', 'charge')); log('row', ok);
      await play(0.9, true, Wl.top); await still('charge-1-hands-on');
      await play(0.6, false, Wl.top); await still('charge-2-cap'); await play(1.5, false, Wl.top);
    }
  }
  // (`right`: the camera goes round to his gun-hand side by `turn`, whichever sign that is — the hand's own trip to the belt is the subject)
  const guardPin = (i, turn = 0.9, dist = 2.4, pitch = 0.42, right = false, h = 1.25) => page.evaluate(({ i, turn, dist, pitch, right, h }) => { const g = window.__game, c = g.guards[i].char, y = c.bodyYaw, b = c.bones;
    if (right && b.upperArmR && b.upperArmL) { const rx = b.upperArmR[0] - b.upperArmL[0], rz = b.upperArmR[2] - b.upperArmL[2]; if (Math.sin(y + turn) * rx + Math.cos(y + turn) * rz < 0) turn = -turn; }
    window.__stage({ look: [c.pos[0], h, c.pos[2]], yaw: y + turn, pitch, dist }, {}); return { p: [c.pos[0], h, c.pos[2]], n: [Math.sin(y), 0, Math.cos(y)], name: g.guards[i].callsign, turn }; }, { i, turn, dist, pitch, right, h });
  if (ONLY.includes('radio') || ONLY.includes('swap') || ONLY.includes('guard')) await sam([8, 0, 17]);   // (Sam out of these: the guards are the subject)
  if (ONLY.includes('radio')) {   // ---- a hand to the radio while his line is on the net
    await ai(false); await play(0.5);
    await page.evaluate(() => { const g = window.__game; g.say(g.guards[0], 'control, east corridor is clear', true); }); await play(0.6); const G0 = await guardPin(0, 0.6); await lamp(G0.p, G0.n, 0.6); await play(0.05); await still('radio-1-hand-up');
    await guardPin(0, 0.35, 1.4, 0.25); await play(0.1); await still('radio-2-close'); await play(3.0);
  }
  if (ONLY.includes('swap')) {   // ---- the torch put away and the sidearm drawn: a strip
    // (out onto open floor first: on his beat among the desks a cabinet or a chair stands between any close camera and his belt)
    const open = await page.evaluate(() => { const g = window.__game, c = g.guards[1].char, nav = g.col.nav; let best = null, bs = 1e9;
      for (let dx = -9; dx <= 9; dx += 0.5) for (let dz = -9; dz <= 9; dz += 0.5) { const x = c.pos[0] + dx, z = c.pos[2] + dz; let ok = !nav.isBlocked(x, z);
        for (let a = 0; a < 12 && ok; a++) for (const r of [0.6, 1.2, 1.8, 2.4]) if (nav.isBlocked(x + Math.cos(a * Math.PI / 6) * r, z + Math.sin(a * Math.PI / 6) * r)) { ok = false; break; }
        for (const p of g.props.props) if (ok && Math.hypot(p.x - x, p.z - z) < 2.6 + p.radius) ok = false;
        const d = dx * dx + dz * dz; if (ok && d < bs) { bs = d; best = [x, 0, z]; } }
      if (best) { c.pos[0] = best[0]; c.pos[2] = best[2]; } return best; });
    log('open floor', JSON.stringify(open));
    await ai(true); await play(0.3); let G1 = await guardPin(1, 1.1, 1.9, 0.3, true, 1.1); await lamp(G1.p, G1.n, G1.turn); await play(0.05); await still('swap-0-torch');
    await page.evaluate(() => window.__game.escalate());
    let k = 1; for (const dt of [0.2, 0.12, 0.14, 0.4]) { await play(dt); G1 = await guardPin(1, 1.1, 1.9, 0.3, true, 1.1); await lamp(G1.p, G1.n, G1.turn); const s = await page.evaluate(() => { const a = window.__game.guards[1].char.anim.swapInfo(); return a.a.toFixed(2) + ' to ' + a.to; }); log('swap', s); await play(0.02); await still(`swap-${k++}`); }
  }
  if (ONLY.includes('guard')) {   // ---- the man sent to the breaker: his hand on the lever
    await ai(true); await page.evaluate(() => { const g = window.__game; g.setBlackout(600, 'ocp'); });
    let seen = false; for (let i = 0; i < 400 && !seen; i++) { await play(0.2); seen = await page.evaluate(() => window.__game.breakerFixT > 1.2); }
    const B = await page.evaluate(() => { const b = window.__game.level.breaker.pos; return { p: [b[0], b[1], b[2] + 0.06], n: [0, 0, -1] }; });
    await lamp(B.p, B.n, await pin(B.p, B.n, 1.0, 2.5)); await play(0.03); await still('guard-breaker');
  }
  if (errors.length) log('ERRORS', errors.slice(0, 8).join('\n'));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
