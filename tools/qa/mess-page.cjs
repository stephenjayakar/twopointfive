// WHAT A BLAST LEAVES ON THE FLOOR, on the real page (src/game/floormess.ts CHAOS.mess; the headless half is tools/qa/mess-check.ts). Headless Chromium on the
// SOFTWARE adapter: this proves the decal shader's new looks COMPILE in the page's own pipeline and that the marks are laid there, and it keeps stills to look
// at — it is not a GPU and nobody has played it.
//   PORT=<port> node tools/qa/mess-page.cjs     two boots of the block (?pall=0 both, so no cloud stands over the floor): the page as it opens, and ?mess=0.
//                                               In each: a wall charge on the first inner wall a charge opens and a hand grenade 2.6 m off it, the debris pool
//                                               cut to 4 so pieces are taken; four seconds on (the game stepped with nothing drawn, the particles on their own
//                                               clock), a second grenade among the pieces
//                                               and two seconds more, the marks counted. PASS = a clean console, the rule as the URL says, on: films and rubble marks laid,
//                                               off: none.
//   ONLY=on|off     one of the two
//   STILLS=<dir>    keeps mess-<run>-0-before / 1-after / 2-after-albedo .png (the camera straight down on the wall's foot)
//   QUALITY=<preset> (default low) · EXTRA=<query> · SECS=<seconds stepped after the blast, default 4>
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'low', STILLS = process.env.STILLS || '', EXTRA = process.env.EXTRA ? `${process.env.EXTRA}&` : '', SECS = +(process.env.SECS || 4);
const ONLY = (process.env.ONLY || 'on,off').split(',');
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);

// in the page: the wall, Sam on its charge's side, the camera over its foot, no cloud asked of the solver (the picture is the floor's)
const SET = async () => {
  await window.__ready;
  const g = window.__game, R = window.__knobs.registry(), H = R.WALLCHARGE.height, C = g.wallCharge; g.godMode = true; g.tune.chaos = 0.5; g.aiEnabled = false; g.smoke.emit = () => { };
  let pick = null;
  for (const B of g.destr.walls.all()) { if (pick) break; if (B.kind !== 'wall') continue; const b = B.box, ax = b.h[0] >= b.h[2], T = ax ? b.h[2] : b.h[0];
    for (const side of [1, -1]) { const p = ax ? [b.c[0], H, b.c[2] + side * (T + 0.06)] : [b.c[0] + side * (T + 0.06), H, b.c[2]], from = ax ? [p[0], 0, p[2] + side * 2.6] : [p[0] + side * 2.6, 0, p[2]];
      g.teleportPlayer(from); const w = g.orders.targetAt([p[0], 0, p[2]]).wall;
      if (w && w.ok && !w.outer && w.index === B.id && !C.openAt(w) && C.farFloor(w) && g.destr.walls.wouldOpen(p, {}).some(o => o.id === B.id && o.hole)) { pick = { wall: B.id, p, side, ax, T, from }; break; } } }
  if (!pick) return { err: 'no inner wall of this floor is offered a charge that opens it' };
  window.__mess = { pick };
  window.__stage({ look: [pick.p[0], 0, pick.p[2]], yaw: Math.atan2(pick.ax ? 0 : pick.side, pick.ax ? pick.side : 0), pitch: 1.35, dist: 8.5 }, {}); window.__runFrames(1, 1 / 60);
  return { wall: pick.wall, rule: R.CHAOS.mess.on };
};
const BLOW = () => {
  const g = window.__game, C = g.wallCharge, { pick } = window.__mess; g.engine.settings.debrisCap = 4;   // (set here: a preset applied at boot writes its own)
  g.teleportPlayer(pick.from); const w = g.orders.targetAt([pick.p[0], 0, pick.p[2]]).wall; if (!w || !w.ok || w.index !== pick.wall) return { err: `the wall's row is not offered: ${w ? w.why : 'no wall'}` };
  C.set.push({ wall: w, t: g.time, by: 'probe', paid: 0 }); const r = C.blow(C.set[C.set.length - 1]);
  const n = pick.ax ? [0, 0, pick.side] : [pick.side, 0, 0], t = pick.ax ? [1, 0, 0] : [0, 0, 1];
  g.teleportPlayer([pick.p[0] + n[0] * 2.2 + t[0] * 4.5, 0, pick.p[2] + n[2] * 2.2 + t[2] * 4.5]);
  const it = g.items.spawn('frag', [pick.p[0] + n[0] * 2.6 + t[0] * 1.2, 0.1, pick.p[2] + n[2] * 2.6 + t[2] * 1.2], [0, 0, 0]); it.who = 1; it.fuse = 1 / 60;
  return { hole: !!(r && r.hole) };
};
// in the page: a second grenade a step along, once the first blasts' pieces lie at rest (the pool gives a RESTING piece's slot: thrown on one frame, a full pool refuses)
const AGAIN = () => {
  const g = window.__game, { pick } = window.__mess, n = pick.ax ? [0, 0, pick.side] : [pick.side, 0, 0], t = pick.ax ? [1, 0, 0] : [0, 0, 1];
  const it = g.items.spawn('frag', [pick.p[0] + n[0] * 1.2 - t[0] * 0.6, 0.1, pick.p[2] + n[2] * 1.2 - t[2] * 0.6], [0, 0, 0]); it.who = 1; it.fuse = 1 / 60;
};
// in the page: n frames of the game with nothing drawn, the particles stepped on their own clock (engine.ts render's own calls for that, alone)
const STEP = async (n) => {
  const g = window.__game, e = window.__engine, dev = e.device, real = e.render;
  const light = () => { e.world.upload(); const P = e.particles, on = !!P && e.particlesOn; if (P) P.prepare(1 / 30, on, e.settings.particleBirths);
    const enc = dev.createCommandEncoder(); if (on && P.hasWork) P.encodeUpdate(enc, e.sceneBG, e.rc.diceView); dev.queue.submit([enc.finish()]); if (P) P.afterSubmit(); };
  e.render = light; try { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; window.__runFrames(1, 1 / 30); if (i % 20 === 19) await dev.queue.onSubmittedWorkDone(); } } finally { e.render = real; }
  const look = (d) => d.kind === 'damage' ? Math.floor(d.param) : -1, L = g.decals.list;
  return { films: L.filter(d => look(d) === 6 && d.pos[1] < 0.05).length, tops: L.filter(d => look(d) === 6 && d.pos[1] >= 0.05).length, rubble: L.filter(d => look(d) === 7 || look(d) === 8).length, marks: L.length,
    evicted: g.destr.debris.stats.evicted, pool: g.destr.debris.list.length, cap: g.destr.debris.cap(), fatal: (document.getElementById('fatal') || {}).textContent || '' };
};
const GRAB = async (view) => {
  const e = window.__engine, v0 = e.settings.debugView; e.settings.debugView = view;
  try { e.render(window.__cam, window.__game.time, 1 / 60, false); const fr = await e.readbackFrame(); if (!fr) return null;
    if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
    for (let i = 3; i < fr.data.length; i += 4) fr.data[i] = 255;
    const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h; c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0);
    return c2.toDataURL('image/png'); } finally { e.settings.debugView = v0; }
};

(async () => {
  let red = 0; const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  if (STILLS) fs.mkdirSync(STILLS, { recursive: true });
  for (const name of ONLY) {
    const page = await (await browser.newContext({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 400))); page.on('console', m => { if ((m.type() === 'error' || /Invalid|WGSL|error:/.test(m.text())) && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 400)); });
    const url = `http://localhost:${PORT}/?levelFile=block.json&roomclear=6&squad4&hour=midday&wallsafe=0&pall=0&${name === 'off' ? 'mess=0&' : ''}${EXTRA}paused&quality=${QUALITY}&mute`; log(`${name}: ${url}`);
    const still = async (tag, view = 0) => { if (!STILLS) return; const u = await page.evaluate(GRAB, view); if (u) { fs.writeFileSync(path.join(STILLS, `mess-${name}-${tag}.png`), Buffer.from(u.split(',')[1], 'base64')); log(`  still ${tag}`); } };
    let s = {}, b = {}, r = {};
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 0 }); page.setDefaultTimeout(0);
      s = await page.evaluate(SET); log(`  staged: ${JSON.stringify(s)}`);
      if (!s.err) { await still('0-before'); b = await page.evaluate(BLOW); await page.evaluate(STEP, Math.round(SECS * 30)); await page.evaluate(AGAIN); r = await page.evaluate(STEP, 60); log(`  ${JSON.stringify(b)} ${JSON.stringify(r)}`); await still('1-after'); await still('2-after-albedo', 1); }
    } catch (e) { errs.push(String(e).slice(0, 400)); }
    const clean = !errs.length && !r.fatal && !s.err && !b.err, want = name !== 'off';
    const ok = clean && s.rule === want && b.hole === true && (want ? r.films >= 4 && r.rubble >= 1 : r.films + r.tops + r.rubble === 0);
    if (!ok) red++;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${name}: ${want ? 'the page as it opens: a wall charge and a hand grenade leave films of dust on the floor and the marks of the pieces the pool took' : '?mess=0: the same blasts leave none of it (the floor as clean as it was)'}\n    rule ${s.rule} · wall #${s.wall} · hole ${b.hole} · films ${r.films} on the floor, ${r.tops} on tops · rubble marks ${r.rubble} (pieces taken ${r.evicted}, the pool ${r.pool} of ${r.cap}) · marks in all ${r.marks} · console ${errs.length ? errs.join(' | ') : 'clean'}${r.fatal ? ` · FATAL ${r.fatal}` : ''}${s.err || b.err ? ` · ${s.err || b.err}` : ''}`);
    await page.close();
  }
  await browser.close();
  console.log(`=== mess-page: ${red ? 'FAILURES above' : 'ALL PASS'} ===`);
  process.exit(red ? 1 : 0);
})();
