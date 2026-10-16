// ONE BLAST, ONE FLOOD, ON THE REAL PAGE (src/game/wallreact.ts WALLREACT.blastFlood): headless Chromium on the software WebGPU adapter
// (tools/qa/page-look.cjs's recipe), the block's room clear as the page deals it, and the stage tools/qa/blastflood-check.ts finds there done with the page's
// own Game: a defender either side of wall #54, a different figure of evidence for each door of the nearer one's room, one charge that opens two walls.
//   PORT=5199 node tools/qa/blastflood-page.cjs        (a dev server on that port: PORT=5199 bun run tools/serve.ts)
//   on    the page as it opens: the switch reads on, two walls go, he still has every figure he had
//   off   the same page under ?blastflood=0: the switch reads off, the same blast, figures are lost (the build as it was)
// exit 0 = both, with no page error · 1 = otherwise. The place is the check's (its 'staging' line prints it): a level edit that moves the wall shows here
// as 'the staging is gone', not as a verdict on the rule. Game logic only: nothing here looks at a picture.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
// (blastflood-check.ts on block-squads, seed 6: the charge, and the two defenders' posts and faces)
const PLACE = { mid: [21.0, 12.0], charge: [21.0, 11.7], p1: [23.2, 14.4], f1: [21.0, 13.2], p2: [21.0, 9.6], f2: [21.0, 10.8] };

const STAGE = async (PLACE) => {
  await window.__ready;
  const g = window.__game, e = window.__engine, K = window.__knobs.registry().WALLREACT, F = g.fight;
  const step = n => { const real = e.render; e.render = () => { e.world.upload(); }; try { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; window.__runFrames(1, 1 / 60); } } finally { e.render = real; } };   // (the game stepped, no frame drawn)
  const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  g.godMode = true; g.tune.chaos = 0.5; step(60);
  const mid = [PLACE.mid[0], 0, PLACE.mid[1]], defs = F.defs.filter(D => D.gd.state !== 'dead').sort((x, y) => flat(x.gd.char.pos, mid) - flat(y.gd.char.pos, mid));
  if (defs.length < 2) return { err: 'fewer than two defenders on the floor' };
  const post = (D, p2, f2) => { const p = [p2[0], 0, p2[1]], to = [f2[0], 0, f2[1]], gd = D.gd, c = gd.char; c.pos[0] = p[0]; c.pos[2] = p[2]; c.bodyYaw = c.aimYaw = Math.atan2(to[0] - p[0], to[2] - p[2]); gd.path = []; gd.pathGoal = null; if (gd.script) gd.script = null;
    gd.hold = true; gd.pinned = true; D.mode = 'hold'; D.station = [p[0], 0, p[2]]; D.room = F.roomAt(p); D.ev = D.room ? D.room.entries.map(() => 0) : []; D.watch = D.want = D.glanceTo = -1; D.glanceUntil = -1; D.glanceNext = g.time + 60; D.home = [to[0], 0, to[2]]; D.pt[0] = to[0]; D.pt[2] = to[2]; };
  // (the fault needs the THIRD room to be one the fight already knows — a cached Room is what the first row's fill stops at. In play a room is known once a
  //  defender is dealt into it or the fight asks about it; the check knows them all from looking for its place. Here: every room of the floor asked for once)
  { const nav = g.col.nav; for (let x = 0.5; x < nav.W * nav.cell; x += 1) for (let z = 0.5; z < nav.H * nav.cell; z += 1) if (!nav.isBlocked(x, z)) F.roomAt([x, 0, z]); }
  const [D1, D2] = defs; post(D1, PLACE.p1, PLACE.f1); post(D2, PLACE.p2, PLACE.f2); step(30);
  if (!D1.room || !D2.room || D1.room === D2.room) return { err: 'the staging is gone: the two posts are not in two rooms' };
  D1.ev = D1.room.entries.map((_, i) => 0.1 * (i + 1));
  const before = D1.room.entries.map((en, i) => [en.door, D1.ev[i]]);
  const res = g.destr.blast([PLACE.charge[0], 1.0, PLACE.charge[1]], { who: 2, chaos: false }); step(6);
  const E = D1.room.entries, kept = before.filter(([d, v]) => { const i = E.findIndex(en => en.door === d); return i >= 0 && (D1.ev[i] === undefined ? NaN : D1.ev[i]) >= v - 0.05; }).length;
  return { rule: K.blastFlood, wallreact: K.on, walls: res.walls, doors0: before.length, doors: E.length, kept, same: D1.room === D2.room, who: D1.gd.callsign, after: E.map((en, i) => `${en.door.def.name}=${(D1.ev[i] === undefined ? NaN : D1.ev[i]).toFixed(1)}`).join(' '), fatal: (document.getElementById('fatal') || {}).textContent || '' };
};

(async () => {
  let red = 0; const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  for (const job of [{ name: 'on', query: '' }, { name: 'off', query: 'blastflood=0&' }]) {
    const page = await (await browser.newContext({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300)); });
    page.on('response', r => { if (r.status() >= 400) log(`  (${r.status()} ${r.url()})`); });   // (a file the server has not got is named, not counted: the game's own errors are)
    const url = `http://localhost:${PORT}/?levelFile=block-squads.json&roomclear=6&squad4&${job.query}paused&quality=${QUALITY}&mute`; log(`${job.name}: ${url}`);
    let r; try { await page.goto(url); r = await page.evaluate(STAGE, PLACE); } catch (e) { r = { err: String(e).slice(0, 300) }; }
    await page.close();
    if (r.err) { red++; console.log(`- FAIL — ${job.name}: ${r.err}${errs.length ? ` · ${errs[0]}` : ''}`); continue; }
    const detail = `blastFlood ${r.rule} · WALLREACT ${r.wallreact} · walls opened ${r.walls} · ${r.who} knew ${r.doors0} doors, holds ${r.doors} now · kept ${r.kept} of ${r.doors0} · the same room as the man beyond ${r.same} · after: ${r.after} · page errors ${errs.length}${errs.length ? `: ${errs[0]}` : ''}${r.fatal ? ` · #fatal: ${r.fatal.slice(0, 120)}` : ''}`;
    const staged = r.walls >= 2 && r.doors0 >= 2 && r.wallreact && !errs.length && !r.fatal;
    const ok = job.name === 'on' ? staged && r.rule === true && r.same && r.kept === r.doors0 : staged && r.rule === false && r.kept < r.doors0;
    if (!ok) red++;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${job.name === 'on' ? 'the page as it opens: the rule is on, one charge opens two walls, and he still has what he knew of every door' : '?blastflood=0: the rule is off, the same blast, what he knew of some doors is lost (the build as it was)'}\n    ${detail}`);
  }
  await browser.close();
  console.log(`=== blastflood-page: ${red ? 'FAILURES above' : 'ALL PASS'} ===`);
  process.exit(red ? 1 : 0);
})();
