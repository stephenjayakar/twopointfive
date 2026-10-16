// EVERY THING THAT WENT, ON THE REAL PAGE (src/game/wallreact.ts WALLREACT.everyGone): headless Chromium on the software WebGPU adapter
// (tools/qa/page-look.cjs's recipe), the warehouse's room clear as the page deals it, and the staging of tools/qa/wallreact-probes.ts wallreactCrate done
// with the page's own Game: a defender put kneeling behind a crate, the crate blown with the furniture round it, eight seconds stepped.
//   PORT=5199 node tools/qa/everygone-page.cjs        (a dev server on that port: PORT=5199 bun run tools/serve.ts)
//   on    the page as it opens: the switch reads on, the crate goes and leaves him open, he leaves for somewhere hidden
//   off   the same page under ?everygone=0: the switch reads off, the same blast, he kneels on in the open (the build as it was)
// exit 0 = both, with no page error · 1 = otherwise. Game logic only: nothing here looks at a picture.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);

const STAGE = async () => {
  await window.__ready;
  const g = window.__game, e = window.__engine, nav = g.col.nav, K = window.__knobs.registry().WALLREACT;
  const step = n => { const real = e.render; e.render = () => { e.world.upload(); }; try { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; window.__runFrames(1, 1 / 60); } } finally { e.render = real; } };   // (the game stepped, no frame drawn)
  const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]), mad = (c, d, k) => [c[0] + d[0] * k, 0, c[2] + d[2] * k];
  g.godMode = true; g.tune.chaos = 0.5; step(60);
  const defs = () => g.fight.defs.filter(D => D.gd.state !== 'dead'), D = defs()[0]; if (!D) return { err: 'no defender on the floor' };
  const offLine = (c, T, q, d) => { const ex = q[0] - T[0], ez = q[2] - T[2], t = Math.max(0, Math.min(1, ((c[0] - T[0]) * ex + (c[2] - T[2]) * ez) / (ex * ex + ez * ez || 1))); return Math.hypot(T[0] + ex * t - c[0], T[2] + ez * t - c[2]) > d; };
  const somewhere = (P, T, c, rad) => { for (let r = 1.5; r <= 7; r += 0.75) for (let a = 0; a < 16; a++) { const q = [P[0] + Math.sin(a * Math.PI / 8) * r, 0, P[2] + Math.cos(a * Math.PI / 8) * r];
    if (nav.isBlocked(q[0], q[2]) || !g.col.segmentBlocked([T[0], 1.15, T[2]], [q[0], 0.9, q[2]]) || !offLine(c, T, q, rad + 0.5)) continue;
    const path = nav.findPath(P, q); let L = 0, z = P; for (const x of path || []) { L += flat(z, x); z = x; } if (path && path.length && L < 1.5 * r + 1.5) return true; } return false; };
  let pick = null;
  for (const w of g.destr.walls.all()) {
    if (w.kind !== 'cover' || w.open || (pick && pick.near)) continue; const c = w.box.c, rad = Math.max(w.box.h[0], w.box.h[2]);
    if (defs().some(x => x !== D && flat(x.gd.char.pos, c) < 3) || g.orders.squad().some(m => flat(m.char.pos, c) < 9)) continue;
    const goes = g.destr.wallsFor([c[0], 0.6, c[2]], { radius: 1.2 }); if (goes.some(o => o.kind === 'wall')) continue;
    for (let a = 0; a < 8 && !(pick && pick.near); a++) { const d = [Math.sin(a * Math.PI / 4), 0, Math.cos(a * Math.PI / 4)];
      const P = mad(c, d, -(rad + 0.55)); if (nav.isBlocked(P[0], P[2])) continue;
      if (g.col.segmentBlocked([P[0], 1.15, P[2]], [c[0], w.box.c[1] + w.box.h[1] + 0.3, c[2]])) continue;
      for (const far of [5, 4, 3.2]) { const T = mad(c, d, far); if (nav.isBlocked(T[0], T[2])) continue;
        if (!g.col.segmentBlocked([T[0], 1.15, T[2]], [P[0], 0.9, P[2]])) continue;
        if (g.col.segmentBlocked([T[0], 1.15, T[2]], [c[0], w.box.c[1] + w.box.h[1] + 0.3, c[2]])) continue;
        if (goes.length && g.destr.withWallsOpen(goes, () => g.col.segmentBlocked([T[0], 1.15, T[2]], [P[0], 0.9, P[2]]))) continue;
        const near = somewhere(P, T, c, rad); if (!pick || near) pick = { w, P, T, near }; break; } }
  }
  if (!pick) return { err: 'no crate on this floor with a spot behind it' };
  const { w, P, T, near } = pick, gd = D.gd, c = gd.char;
  for (const m of g.orders.squad()) m.dazzledUntil = g.time + 1e6;
  c.pos[0] = P[0]; c.pos[2] = P[2]; c.bodyYaw = c.aimYaw = Math.atan2(T[0] - P[0], T[2] - P[2]); gd.path = []; gd.pathGoal = null; if (gd.script) gd.script = null;
  gd.hold = true; gd.pinned = true; D.mode = 'hold'; D.station = [P[0], 0, P[2]]; D.room = g.fight.roomAt(P); D.ev = D.room ? D.room.entries.map(() => 0) : []; D.watch = D.want = D.glanceTo = -1; D.glanceUntil = -1; D.glanceNext = g.time + 60;
  D.home = [T[0], 0, T[2]]; D.pt[0] = T[0]; D.pt[2] = T[2]; c.crouch = true; step(18);
  gd.sightPos = [...T]; gd.sightT = g.time;
  const d0 = [...c.pos], hid0 = g.col.segmentBlocked([T[0], 1.15, T[2]], [d0[0], 0.9, d0[2]]);
  const res = g.destr.blast([w.box.c[0], 0.6, w.box.c[2]], { radius: 1.2, who: 2, chaos: false }); step(6);
  const open1 = !g.col.segmentBlocked([T[0], 1.15, T[2]], [d0[0], 0.9, d0[2]]);
  for (let i = 0; i < 480; i++) { if (i < 60) gd.sightPos = [...T]; step(1); }
  const p1 = c.pos, moved = flat(p1, d0), hid1 = g.col.segmentBlocked([T[0], 1.15, T[2]], [p1[0], 0.9, p1[2]]);
  return { rule: K.everyGone, wallreact: K.on, furnblast: window.__knobs.registry().FURNBLAST.on, crate: w.id, at: [w.box.c[0], w.box.c[2]], cover: res.cover, near, d0: [d0[0], d0[2]], p1: [p1[0], p1[2]], moved, hid0, open1, hid1, state: gd.state, mode: D.mode, fatal: (document.getElementById('fatal') || {}).textContent || '' };
};

(async () => {
  let red = 0; const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  for (const job of [{ name: 'on', query: '' }, { name: 'off', query: 'everygone=0&' }]) {
    const page = await (await browser.newContext({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300)); });
    page.on('response', r => { if (r.status() >= 400) log(`  (${r.status()} ${r.url()})`); });   // (a file the server has not got is named, not counted: the game's own errors are)
    const url = `http://localhost:${PORT}/?levelFile=warehouse.json&roomclear=8&squad4&${job.query}paused&quality=${QUALITY}&mute`; log(`${job.name}: ${url}`);
    let r; try { await page.goto(url); r = await page.evaluate(STAGE); } catch (e) { r = { err: String(e).slice(0, 300) }; }
    await page.close();
    const f = v => v.map(x => x.toFixed(1)).join(', ');
    if (r.err) { red++; console.log(`- FAIL — ${job.name}: ${r.err}${errs.length ? ` · ${errs[0]}` : ''}`); continue; }
    const detail = `everyGone ${r.rule} · WALLREACT ${r.wallreact} · FURNBLAST ${r.furnblast} · crate #${r.crate} at (${f(r.at)}), cover cells gone ${r.cover} · hidden before ${r.hid0} · open after ${r.open1} · cover within a run ${r.near} · stood (${f(r.d0)}) → (${f(r.p1)}), ${r.moved.toFixed(1)} m · hidden now ${r.hid1} · mode ${r.mode} · state ${r.state} · page errors ${errs.length}${errs.length ? `: ${errs[0]}` : ''}${r.fatal ? ` · #fatal: ${r.fatal.slice(0, 120)}` : ''}`;
    const staged = r.cover > 0 && r.hid0 && r.open1 && r.near && r.wallreact && r.furnblast && !errs.length && !r.fatal;
    const ok = job.name === 'on' ? staged && r.rule === true && r.moved > 1 && r.hid1 : staged && r.rule === false && r.moved < 0.5 && !r.hid1;
    if (!ok) red++;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${job.name === 'on' ? 'the page as it opens: the rule is on, the crate and the furniture round it go, he leaves for somewhere he is hidden again' : '?everygone=0: the rule is off, the same blast, he kneels on in the open (the build as it was)'}\n    ${detail}`);
  }
  await browser.close();
  console.log(`=== everygone-page: ${red ? 'FAILURES above' : 'ALL PASS'} ===`);
  process.exit(red ? 1 : 0);
})();
