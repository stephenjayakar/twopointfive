// WORKSTOW LOOK: stills of a gun put away for a charge (src/game/workstow.ts) off the real page on the software WebGPU adapter — the four-man room clear, you at
// the nearest shut door with the rifle in your hands, a door charge going on by your own hands, the rifle back after; then a teammate sent to charge the next
// shut door, his gun hung while both hands are on it, and his again after. The camera is pinned low and close on the charge (handwork-look.cjs's recipe).
//   node tools/qa/workstow-look.cjs <outDir> [extra query, e.g. noworkstow]      env: PORT (default 5199) · SIZE (default 960x540) · QUALITY (default low) · ONLY=you,mate
// Slow by nature (page-look.cjs says why): ~95 s to boot, 5–15 s a drawn frame. It prints what the game says is in each man's hands at every still.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const outDir = process.argv[2] || 'workstow-look', extra = process.argv[3] || '';
const PORT = process.env.PORT || 5199, [W, H] = (process.env.SIZE || '960x540').split('x').map(Number), QUALITY = process.env.QUALITY || 'low';
const ONLY = (process.env.ONLY || 'you,mate').split(',');
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const KIT = JSON.stringify({ v: 2, members: [{ weapon: 'rifle', smoke: 0, bangs: 1, frags: 0, shells: 0, charges: 2, walls: 0 }] });
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
  const g = window.__game, pl = g.player, wi = pl.char.anim.workInfo(), m = window.__wsLead;
  return { t: +g.time.toFixed(2), you: pl.pistolUp ? 'pistol' : pl.rifleUp ? 'rifle' : pl.holstered ? 'nothing' : String(pl.slot), work: wi.pose ? `${wi.pose.kind} w ${wi.w.toFixed(2)} two ${wi.two}` : null, charging: !!pl.charging, put: pl.workStow ? JSON.stringify(pl.workStow) : null,
    mate: m ? { who: m.callsign, away: !!m.workStow, hung: !!m.char.anim.stowed, two: m.char.anim.workInfo().two } : null, set: window.__doortools.set.length };
};
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 600)));
  page.on('console', m => { if (m.type() === 'error' && !/smoke|storage textures|Failed to load resource/i.test(m.text())) errors.push(m.text().slice(0, 300)); });
  await page.addInitScript(k => { try { localStorage.setItem('twopointsix.kit', k); } catch { } }, KIT);
  const url = `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&roomclear&squad4&freshstart=0&nocutboxes${extra ? '&' + extra : ''}`;
  log('goto', url); await page.goto(url);
  await page.evaluate(async () => { await window.__ready; window.__testVisible = true; });
  await page.evaluate(async () => { const P = window.__cut?.programs, r = P?.swap ? P.ready : null; if (r) await Promise.race([Promise.resolve(r).catch(() => 0), new Promise(d => setTimeout(d, 300000))]); });
  log('ready', JSON.stringify(await page.evaluate(() => ({ workstow: window.__knobs?.registry?.().WORKSTOW?.on, handwork: window.__knobs?.registry?.().HANDWORK?.on, kitanim: window.__knobs?.registry?.().KITANIM?.on }))));
  await page.evaluate(() => { window.__menu.close(); window.__smoke.params.enabled = false; const g = window.__game; g.godMode = true; });
  const still = async (name) => { const cap = await page.evaluate(DRAW, 2); if (cap.url) fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(cap.url.split(',')[1], 'base64')); log('still', name, cap.err || ''); };
  const play = async (secs, tap, cursor) => { const r = await page.evaluate(PLAY, { secs, tap, cursor }); log('  play', secs, JSON.stringify(r)); return r; };
  // the camera low and close on a spot at hand height, off to one side of the line out of the thing's face (n: toward the man), from the first side and
  // distance with a clear line from the lens to the spot
  const pin = (p, n, turn = 1.3, dist = 1.9, pitch = 0.32) => page.evaluate(({ p, n, turn, dist, pitch }) => { const col = window.__game.col, look = [p[0] + n[0] * 0.3, p[1] - 0.05, p[2] + n[2] * 0.3], y0 = Math.atan2(n[0], n[2]); let pick = [turn, dist];
    find: for (const d of [dist, dist * 0.75, dist * 0.55]) for (const t of [turn, -turn, turn * 0.6, -turn * 0.6, 0.25, -0.25]) { const y = y0 + t, cp = Math.cos(pitch), eye = [look[0] + Math.sin(y) * cp * d, look[1] + Math.sin(pitch) * d, look[2] + Math.cos(y) * cp * d]; if (!col.solidBlocked(eye, look)) { pick = [t, d]; break find; } }
    window.__stage({ look, yaw: y0 + pick[0], pitch, dist: pick[1] }, {}); return pick[0]; }, { p, n, turn, dist, pitch });
  // a work lamp for the still: a soft white point light over free floor on the man's side of the thing, off to the camera's side — staging only, taken away by the next
  const lamp = (p, n, turn) => page.evaluate(({ p, n, turn }) => { const L = window.__engine.lights, old = window.__lamp; if (old) { old.enabled = false; old.ttl = 0; old.age = 1; }
    const col = window.__game.col, to = [p[0] + n[0] * 0.3, p[1], p[2] + n[2] * 0.3], sg = Math.sign(turn) || 1, sx = n[2] * sg, sz = -n[0] * sg; let at = null;
    find: for (const d of [0.55, 0.8, 1.1, 1.5]) for (const sd of [1.3, 1.0, 0.7, 0.35]) for (const up of [0.9, 0.6]) { const q = [p[0] + n[0] * d + sx * sd, Math.min(2.5, p[1] + up), p[2] + n[2] * d + sz * sd]; if (!col.nav.isBlocked(q[0], q[2]) && !col.solidBlocked(q, to)) { at = q; break find; } }
    at = at || [to[0], Math.min(2.5, p[1] + 0.8), to[2]];
    window.__lamp = L.flash(at, [1, 0.95, 0.85], 10, 7, 600, 0); window.__lamp.radius = 0.18; return at; }, { p, n, turn });
  // the shut, latched, wooden doors by how near Sam's start they are: for each, the lock at hand height and the face he came from
  const doors = await page.evaluate(() => { const g = window.__game, home = [...g.player.char.pos], out = [];
    for (const d of g.doors.list) { if (d.off || !d.isClosed() || !d.latched || d.locked || d.def.steel) continue; const u = d.dir(), [hx, hz] = d.def.hinge, w = d.def.width, mid = [hx + u[0] * w * 0.5, 0, hz + u[1] * w * 0.5];
      const sides = [1, -1].map(s => ({ n: [u[1] * s, 0, -u[0] * s], at: [mid[0] + u[1] * s * 0.75, 0, mid[2] - u[0] * s * 0.75] })).filter(s => !g.col.nav.isBlocked(s.at[0], s.at[2])).sort((a, b) => Math.hypot(a.at[0] - home[0], a.at[2] - home[2]) - Math.hypot(b.at[0] - home[0], b.at[2] - home[2]));
      if (!sides.length) continue; const s = sides[0];
      out.push({ name: d.def.name, dist: Math.hypot(mid[0] - home[0], mid[2] - home[2]), at: s.at, n: s.n, lock: [hx + u[0] * (w - 0.22), 1.05, hz + u[1] * (w - 0.22)], mid: [mid[0], 1.05, mid[2]] }); }
    return out.sort((a, b) => a.dist - b.dist); });
  log('doors', doors.map(d => `${d.name} ${d.dist.toFixed(1)} m`).join(' · '));
  await play(0.5);
  if (ONLY.includes('you') && doors[0]) {   // ---- a door charge by your own hands
    const d = doors[0];
    await page.evaluate(({ at }) => { const g = window.__game, pl = g.player; g.aiEnabled = false; g.teleportPlayer(at); pl.slot = 'rifle'; pl.holstered = false; pl.equipT = 0; }, d);
    await lamp(d.lock, d.n, await pin(d.lock, d.n)); await play(1.2, false, d.lock); await still('you-0-gun-in-hands');
    const ok = await page.evaluate(() => window.__game.selectVerb('door', 'charge')); log('row', ok);
    await play(1.9, true, d.lock); await still('you-1-both-hands-on-it');
    for (let i = 0; i < 80; i++) { const r = await page.evaluate(() => !!window.__game.player.charging); if (!r) break; await play(0.1); }
    await play(0.9, false, d.lock); await still('you-2-gun-back');
    await page.evaluate(() => { window.__game.aiEnabled = true; });
  }
  if (ONLY.includes('mate') && doors.length > 1) {   // ---- a teammate sent to charge the next door
    let d = null, why = '';   // (the first other door the squad takes the order on)
    for (const x of doors.slice(1)) { why = await page.evaluate(({ mid, at, n }) => { const g = window.__game, O = window.__orders; g.teleportPlayer([at[0] + n[0] * 3, 0, at[2] + n[2] * 3]); return O.give('charge', O.targetAt([mid[0], 0, mid[2]])) ?? 'taken'; }, x); log('the order on', x.name, why); if (why === 'taken') { d = x; break; } }
    if (!d) { log('no door took the order'); await browser.close(); process.exit(1); }
    let on = false; for (let i = 0; i < 400 && !on; i++) { on = await page.evaluate(() => { const D = window.__doortools, op = D.ops[0]; window.__wsLead = op?.lead ?? null; return !!op && op.phase === 'place' && !isNaN(op.setT); }); if (!on) await play(0.15); }
    log('on the job', on);
    if (on) { await lamp(d.lock, d.n, await pin(d.lock, d.n)); await play(1.1); await still('mate-1-both-hands-on-it');
      for (let i = 0; i < 80; i++) { const s = await page.evaluate(() => window.__doortools.set.length + (window.__doortools.ops[0]?.phase === 'place' ? 0 : 10)); if (s > 0) break; await play(0.1); }
      await play(0.7); await still('mate-2-gun-back'); }
  }
  if (errors.length) log('ERRORS', errors.slice(0, 8).join('\n'));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
