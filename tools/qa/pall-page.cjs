// A BLAST'S PALL ON THE REAL PAGE (src/game/destruction.ts CHAOS.pall): headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's recipe),
// the block's room clear as the page deals it. What tools/qa/pall-check.ts cannot see, read here: the page's own smoke solver carrying the pall, and what a
// SIGHT LINE reads through it — the same `sensors` segment a guard's eye asks (transmittance 0‥1; the game's sight factor is (tr − 0.3) / 0.5 clamped, so
// under 0.3 a man behind it is hidden and over 0.8 he is as plain as ever), over the seconds after a wall charge and after a hand grenade, with real frames.
//   PORT=5199 node tools/qa/pall-page.cjs        (a dev server on that port: PORT=5199 bun run tools/serve.ts)
//   on-charge / on-frag     the page as it opens: the rule reads on, the blast asks the solver for its pall, the line through it goes dark and comes back
//   off-charge / off-frag   the same page under ?pall=0: the rule reads off, no pall is asked, the same line stays about as clear as it ever was
//   ONLY=<names>   a comma list of runs instead of those four; also `look-charge` (?pall=look: the particle layer alone, nothing in the solver) and `can`
//                  (a smoke can on the same lines, for scale)
//   SECS=<n>       seconds read after the blast (default 6) · FPS=<n> the frame rate the page is stepped at (default 30: one solver step a frame, as a
//                  machine drawing 30 a second runs it; the game's own steps stay 1/60)
//   STILLS=<dir>   also keeps frames read back from the page: before, and 0.25 / 1 / 2 / 3.5 / 5 s after (as far as SECS reaches) (software adapter, verylow)
//   EXTRA=<query>  more of the query string (EXTRA='hour=midday&wallsafe=0': the block by day, the charge's blinding reach as it was)
// exit 0 = every run asked for holds, with no page error · 1 = otherwise. Nothing here judges a picture.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', STILLS = process.env.STILLS || '', EXTRA = process.env.EXTRA ? `${process.env.EXTRA}&` : '', SECS = +(process.env.SECS || 6), FPS = +(process.env.FPS || 30);
const ONLY = (process.env.ONLY || 'on-charge,on-frag,off-charge,off-frag').split(',');
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
const HIDDEN = 0.3, CLEAR = 0.8;   // (the game's own two numbers: devices.ts lensGain, guards' sight — clamp((tr − 0.3) / 0.5))

// in the page: the game stepped with no frame drawn
const STEP = (n) => { const g = window.__game, e = window.__engine, real = e.render; e.render = () => { e.world.upload(); }; try { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; window.__runFrames(1, 1 / 60); } } finally { e.render = real; } };
// in the page: a wall of this floor a charge opens (the walls' own order, the check's own pick), Sam 2.6 m off it, the sight lines round the place
const SET = async () => {
  await window.__ready;
  const g = window.__game, R = window.__knobs.registry(), K = R.WALLCHARGE, H = K.height, C = g.wallCharge; g.godMode = true; g.tune.chaos = 0.5; g.aiEnabled = false;
  let pick = null;
  for (const B of g.destr.walls.all()) { if (pick) break; if (B.kind !== 'wall') continue; const b = B.box, ax = b.h[0] >= b.h[2], T = ax ? b.h[2] : b.h[0];
    for (const side of [1, -1]) { const p = ax ? [b.c[0], H, b.c[2] + side * (T + 0.06)] : [b.c[0] + side * (T + 0.06), H, b.c[2]], from = ax ? [p[0], 0, p[2] + side * 2.6] : [p[0] + side * 2.6, 0, p[2]];
      g.teleportPlayer(from); const w = g.orders.targetAt([p[0], 0, p[2]]).wall;
      if (w && w.ok && !w.outer && w.index === B.id && !C.openAt(w) && C.farFloor(w) && g.destr.walls.wouldOpen(p, {}).some(o => o.id === B.id && o.hole)) { pick = { wall: B.id, p, side, ax, T, from }; break; } } }
  if (!pick) return { err: 'no inner wall of this floor is offered a charge that opens it' };
  const n = pick.ax ? [0, 0, pick.side] : [pick.side, 0, 0], t = pick.ax ? [1, 0, 0] : [0, 0, 1], Y = 1.2, f = pick.p, at = (dn, dt, y = Y) => [f[0] + n[0] * dn + t[0] * dt, y, f[2] + n[2] * dn + t[2] * dt], far = -(2 * pick.T + 0.12);
  const c = at(2.6, 0, 0.1), ct = (dn, dt, y = Y) => [c[0] + n[0] * dn + t[0] * dt, y, c[2] + n[2] * dn + t[2] * dt];
  const W = window.__pall = { pick, n, t, c, wide: 0, all: 0, puffs: 0,
    charge: [{ key: 'pallThru', name: 'through the hole', a: at(2.6, 0), b: at(far - 2.6, 0) }, { key: 'pallNear', name: 'along the wall, the charge\'s side', a: at(0.8, -2.5), b: at(0.8, 2.5) },
      { key: 'pallFar', name: 'along the wall, beyond', a: at(far - 0.8, -2.5), b: at(far - 0.8, 2.5) }, { key: 'pallStack', name: 'the stack to the wall', a: at(2.6, 0), b: at(0.3, 0) }],
    burst: [{ key: 'pallAcross', name: 'across the burst', a: ct(0, -3), b: ct(0, 3) }, { key: 'pallCross', name: 'across it the other way', a: ct(-2.2, 0), b: ct(2.2, 0) },
      { key: 'pallOff', name: 'a metre to one side', a: ct(1, -3), b: ct(1, 3) }, { key: 'pallEye', name: 'across it at eye height', a: ct(0, -3, 1.6), b: ct(0, 3, 1.6) }] };
  let inPall = false; const pe = g.destr.pallEmit.bind(g.destr); g.destr.pallEmit = (...a) => { inPall = true; try { return pe(...a); } finally { inPall = false; } };   // (`wide`: asked by the pall's own one emitter call)
  const real = g.smoke.emit.bind(g.smoke); g.smoke.emit = (e) => { W.all++; if (e.kind === 'puff') W.puffs++; if (inPall) W.wide++; return real(e); };
  return { wall: pick.wall, at: [f[0], f[2]], side: pick.side, ax: pick.ax, c: [c[0], c[2]], rule: R.CHAOS.pall.on, solver: R.CHAOS.pall.solver };
};
const BLOW = (what) => {
  const g = window.__game, C = g.wallCharge, W = window.__pall, { pick } = W; W.wide = W.all = W.puffs = 0;
  if (what === 'charge') { g.teleportPlayer(pick.from); const w = g.orders.targetAt([pick.p[0], 0, pick.p[2]]).wall; if (!w || !w.ok || w.index !== pick.wall) return { err: `the wall's row is not offered: ${w ? w.why : 'no wall'}` };
    C.set.push({ wall: w, t: g.time, by: 'probe', paid: 0 }); const r = C.blow(C.set[C.set.length - 1]); return { hole: !!(r && r.hole) }; }
  g.teleportPlayer([W.c[0] + W.t[0] * 4 + W.n[0] * 0.5, 0, W.c[2] + W.t[2] * 4 + W.n[2] * 0.5]);
  const it = g.items.spawn(what === 'can' ? 'smoke' : 'frag', [W.c[0], 0.1, W.c[2]], [0, 0, 0]); it.who = 1; it.fuse = 1 / 60; return { hole: false };
};
// in the page: `frames` real frames (the solver and the probe run in the frame's own passes), every line asked each frame and read every `every`
// (on the software adapter a whole picture with smoke in it is a minute or more: the picture is drawn on the first frame after the blast — which is also what
// tells the shaders the solver is live — then every `full` frames and for each still; the frames between run the page's own solver step, its own particle
// step and its own probe pass and draw nothing: engine.ts render's own calls for those three, alone)
const MEASURE = async ({ which, frames, every, from, full, fps }) => {
  const g = window.__game, e = window.__engine, dev = e.device, W = window.__pall, segs = W[which], out = [], real = e.render;
  const yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  const light = () => { e.world.upload(); window.__smoke.stepAlone(1 / fps, window.__cam.focus); const P = e.particles, on = !!P && e.particlesOn; if (P) P.prepare(1 / fps, on, e.settings.particleBirths);
    const enc = dev.createCommandEncoder(); if (on && P.hasWork) P.encodeUpdate(enc, e.sceneBG, e.rc.diceView); for (const f of e.extraPasses) f(enc, e.sceneBG, e.rc.diceView, () => undefined); dev.queue.submit([enc.finish()]); if (P) P.afterSubmit(); for (const f of e.afterSubmit) f(); };
  for (let i = 1; i <= frames; i++) { for (const s of segs) g.sensors.askSegment(s.key, s.a, s.b); g.player.visibility = 0.05;
    e.render = full <= 1 || (from + i) % full === 1 ? real : light; try { window.__runFrames(1, 1 / fps); } finally { e.render = real; }
    if ((from + i) % every === 0) { await dev.queue.onSubmittedWorkDone(); await yieldMacro(); await yieldMacro(); out.push({ t: (from + i) / fps, v: segs.map(s => { const x = g.sensors.read(s.key); return x === undefined ? null : +x.toFixed(3); }) }); } }
  return { out, wide: W.wide, all: W.all, puffs: W.puffs, names: segs.map(s => s.name), fatal: (document.getElementById('fatal') || {}).textContent || '' };
};
const GRAB = async () => {
  window.__engine.render(window.__cam, window.__game.time, 1 / 60, false); const fr = await window.__engine.readbackFrame(); if (!fr) return null;
  if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
  for (let i = 3; i < fr.data.length; i += 4) fr.data[i] = 255;
  const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h; c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0);
  return c2.toDataURL('image/png');
};

(async () => {
  let red = 0; const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  if (STILLS) fs.mkdirSync(STILLS, { recursive: true });
  for (const name of ONLY) {
    const [rule, what0] = name === 'can' ? ['off', 'can'] : name.split('-'), what = what0, query = rule === 'off' ? 'pall=0&' : rule === 'look' ? 'pall=look&' : '';
    const page = await (await browser.newContext({ viewport: STILLS ? { width: 1024, height: 576 } : { width: 512, height: 288 }, deviceScaleFactor: 1 })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300)); });
    const url = `http://localhost:${PORT}/?levelFile=block.json&roomclear=6&squad4&${query}${EXTRA}paused&quality=${QUALITY}&mute`; log(`${name}: ${url}`);
    let r = {}, rows = []; const still = async (tag) => { if (!STILLS) return; const u = await page.evaluate(GRAB); if (u) { fs.writeFileSync(path.join(STILLS, `pall-${name}-${tag}.png`), Buffer.from(u.split(',')[1], 'base64')); log(`  still ${tag}`); } };
    try {
      await page.goto(url); await page.evaluate(async () => { await window.__ready; }); await page.evaluate(STEP, 60); const s = await page.evaluate(SET); if (s.err) throw new Error(s.err); Object.assign(r, s); log(`  staged: wall #${s.wall}`);
      const which = what === 'charge' ? 'charge' : 'burst';
      if (STILLS) {   // the camera on the charge's side of the wall, off to one side (the picture is Sam's cone's: he stands in the room there)
        await page.evaluate(({ s, which }) => { const look = which === 'charge' ? [s.at[0], 0.9, s.at[1]] : [s.c[0], 0.6, s.c[1]];
          window.__stage({ look, yaw: Math.atan2(s.ax ? 0 : s.side, s.ax ? s.side : 0) + 0.55, pitch: 0.62, dist: which === 'charge' ? 7 : 6 }, {}); }, { s, which });
        await page.evaluate(MEASURE, { which, frames: 3, every: 99, from: 0, full: 1, fps: FPS }); await still('0-before'); }
      const b = await page.evaluate(BLOW, what); if (b.err) throw new Error(b.err); Object.assign(r, b);
      const Q = Math.round(FPS / 4), marks = STILLS ? { [Q]: '1-at-0.25s', [4 * Q]: '2-at-1s', [8 * Q]: '3-at-2s', [14 * Q]: '4-at-3.5s', [20 * Q]: '5-at-5s' } : {}, total = Math.round(SECS * 4) * Q;
      for (let done = 0; done < total; done += Q) { const m = await page.evaluate(MEASURE, { which, frames: Q, every: Q, from: done, full: 8 * Q, fps: FPS }); rows.push(...m.out); Object.assign(r, { wide: m.wide, all: m.all, puffs: m.puffs, names: m.names, fatal: m.fatal });
        if (marks[done + Q]) await still(marks[done + Q]); if ((done + Q) % (4 * Q) === 0) log(`  ${((done + Q) / (4 * Q)).toFixed(0)} s read: ${m.out.map(x => x.v.join(' ')).join(' | ')}`); }
    } catch (e) { r = { err: String(e).slice(0, 300) }; }
    await page.close();
    if (r.err) { red++; console.log(`- FAIL — ${name}: ${r.err}${errs.length ? ` · ${errs[0]}` : ''}`); continue; }
    // per line: the darkest it reads, how long it reads hidden (< 0.3), when it is last short of clear (< 0.8)
    const lines = r.names.map((nm, k) => { const v = rows.map(x => ({ t: x.t, v: x.v[k] })).filter(x => x.v !== null); const lo = v.reduce((a, x) => Math.min(a, x.v), 1);
      return { nm, n: v.length, lo, hid: v.filter(x => x.v < HIDDEN).length * 0.25, last: v.filter(x => x.v < CLEAR).reduce((a, x) => Math.max(a, x.t), 0), end: v.length ? v[v.length - 1].v : null }; });
    console.log(`  ${name}: t ${rows.map(x => x.t.toFixed(2)).join(' ')}`); r.names.forEach((nm, k) => console.log(`    ${nm.padEnd(34)} ${rows.map(x => x.v[k] === null ? '  - ' : x.v[k].toFixed(2)).join(' ')}`));
    const main = lines[0], clean = !errs.length && !r.fatal, read = main.n >= rows.length / 2;
    const ok = !clean || !read ? false
      : name === 'can' ? main.lo < HIDDEN
      : rule === 'on' ? r.rule === true && r.wide >= 4 && (what !== 'charge' || r.hole) && main.lo < HIDDEN && main.hid >= 1 && main.end > HIDDEN
      : rule === 'look' ? r.rule === true && r.solver === false && r.wide === 0
      : r.rule === false && r.wide === 0 && (what !== 'charge' || r.hole);
    if (!ok) red++;
    const label = name === 'can' ? 'a smoke can on the same lines, for scale' : rule === 'on' ? `the page as it opens: the rule is on, the ${what === 'charge' ? 'wall charge' : 'hand grenade'} asks the solver for its pall, the line through it reads hidden for a second or more and is coming back by the end`
      : rule === 'look' ? '?pall=look: the rule on with nothing asked of the solver' : `?pall=0: the rule is off and no pall is asked (the build as it was): what the same line reads is the old dust's`;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${name}: ${label}\n    rule ${r.rule} · solver ${r.solver} · wall #${r.wall}${what === 'charge' ? ` · hole ${r.hole}` : ''} · asked of the solver: ${r.all} emitters, ${r.puffs} of dust, ${r.wide} the pall's · ${lines.map(l => `${l.nm}: darkest ${l.lo.toFixed(2)}, hidden ${l.hid.toFixed(2)} s, short of clear until ${l.last.toFixed(2)} s, ${l.end === null ? 'no answer' : `${l.end.toFixed(2)} at ${SECS} s`}`).join(' · ')} · page errors ${errs.length}${errs.length ? `: ${errs[0]}` : ''}${r.fatal ? ` · FATAL ${r.fatal.slice(0, 120)}` : ''}`);
  }
  await browser.close();
  console.log(`=== pall-page: ${red ? 'FAILURES above' : 'ALL PASS'} ===`);
  process.exit(red ? 1 : 0);
})();
