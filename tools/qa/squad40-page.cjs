// A TEAMMATE'S 40 mm GRENADE ON ORDER, ON THE REAL PAGE (src/game/squad40.ts): headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's
// recipe), a room-clearing deal with four teammates, and the middle of tools/qa/squad40-check.ts done with the page's own Game and the page's own keys.
//   PORT=5199 node tools/qa/squad40-page.cjs        (a dev server on that port: PORT=5199 bun run tools/serve.ts)
//   on    the page as it opens: the switch reads on; as dealt nobody carries a round and the row is not there; a round staged on the first teammate
//         (`__squad40.stage`: the cards' own row is the kit screen's) puts '40 mm there' third on the throw page; X on a spot he has a shot to, G, 3:
//         he fires it, his count falls, the order is on the log
//   off   the same page under ?nosquad40: the switch reads off, the same staging registers no row and nothing is fired
// exit 0 = both, with no page error · 1 = otherwise. The verdict is game logic only: nothing here judges a picture.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', EXTRA = process.env.EXTRA ? `${process.env.EXTRA}&` : '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);

// in the page: the game stepped with no frame drawn
const STEP = (n) => { const g = window.__game, e = window.__engine, real = e.render; e.render = () => { e.world.upload(); }; try { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; window.__runFrames(1, 1 / 60); } } finally { e.render = real; } };
// in the page: as dealt, then a round on the first teammate, then a spot of floor the row is live on (the farthest: the arc is the thing to see)
const SET = () => {
  const g = window.__game, O = window.__orders, S = window.__squad40; if (!S) return { err: 'no __squad40 hook' };
  g.godMode = true;
  const has = () => O.defs.some(d => d.id === 'shellThere');
  const r = { rule: S.knobs.on, squad: O.squad().length, dealt: S.brought(), rowDealt: has() };
  S.stage([2]); window.__runFrames(1, 1 / 60);
  r.brought = S.brought(); r.row = has(); r.left = S.left();
  if (!r.row) return r;
  const def = O.defs.find(d => d.id === 'shellThere'), men = O.men('all'), who = O.squad()[0], nav = g.col.nav; let best = null;
  for (let z = 0; z < nav.H; z += 2) for (let x = 0; x < nav.W; x += 2) { if (nav.blocked[z * nav.W + x]) continue;
    const t = O.targetAt([(x + 0.5) * nav.cell, 0, (z + 0.5) * nav.cell]); if (!t || t.kind !== 'floor' || O.whyNot(def, t, men) !== null) continue;
    const d = Math.hypot(t.at[0] - who.char.pos[0], t.at[2] - who.char.pos[2]); if (!best || d > best.d) best = { at: t.at, d }; }
  if (!best) return { ...r, err: 'no spot of this floor has a shot from where the team stands' };
  window.__s40 = best; r.spot = best.at; r.range = best.d;
  return r;
};
const OPEN = (key) => { const O = window.__orders; if (!key) O.open(O.targetAt(window.__s40.at)); else window.__input.pressed.add(key); };
const MENU = () => { const O = window.__orders, M = O.menu; return { page: M ? M.page ?? null : 'shut', rows: ((O.hud().menu || {}).rows || []).slice(1).map(r => `${(r.opts[0] || {}).key || ''} ${(r.opts[0] || {}).text || ''}`) }; };
const READ = () => { const g = window.__game, S = window.__squad40, O = window.__orders, L = S.log[S.log.length - 1] || null;
  return { fired: S.stats.fired, left: S.left(), of0: S.of(0), menuUp: !!O.menu, logged: O.log.some(l => l.order === 'shellThere'), who: L ? L.who : null, burstOff: L ? Math.hypot(L.burst[0] - window.__s40.at[0], L.burst[2] - window.__s40.at[2]) : -1,
    drawn: (document.querySelector('#traj .squadthrow') || { innerHTML: '' }).innerHTML.length, fatal: (document.getElementById('fatal') || {}).textContent || '' }; };

(async () => {
  let red = 0; const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  for (const job of [{ name: 'on', query: '' }, { name: 'off', query: 'nosquad40&' }]) {
    const page = await (await browser.newContext({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300)); });
    page.on('response', r => { if (r.status() >= 400) log(`  (${r.status()} ${r.url()})`); });   // (a file the server has not got is named, not counted: the game's own errors are)
    const url = `http://localhost:${PORT}/?roomclear=7&squad4&${job.query}${EXTRA}paused&quality=${QUALITY}&mute`; log(`${job.name}: ${url}`);
    let r = {};
    try {
      await page.goto(url); await page.evaluate(async () => { await window.__ready; }); await page.evaluate(STEP, 60);
      const s = await page.evaluate(SET); Object.assign(r, s); if (s.err) throw new Error(s.err);
      if (job.name === 'on') {
        await page.evaluate(OPEN, ''); await page.evaluate(STEP, 3); await page.evaluate(OPEN, 'KeyG'); await page.evaluate(STEP, 3); r.menu = await page.evaluate(MENU);
        await page.evaluate(STEP, 12); r.preview = (await page.evaluate(READ)).drawn;
        await page.evaluate(OPEN, 'Digit3');
        for (let i = 0; i < 16; i++) { await page.evaluate(STEP, 15); if ((await page.evaluate(READ)).fired) break; }
        await page.evaluate(STEP, 150);   // (the round lands and goes off; the man is handed back)
      } else await page.evaluate(STEP, 60);
      Object.assign(r, await page.evaluate(job.name === 'on' ? READ : () => ({ fired: window.__squad40.stats.fired, fatal: (document.getElementById('fatal') || {}).textContent || '' })));
    } catch (e) { r.err = String(e).slice(0, 300); }
    await page.close();
    if (r.err) { red++; console.log(`- FAIL — ${job.name}: ${r.err}${errs.length ? ` · ${errs[0]}` : ''} · ${JSON.stringify(r).slice(0, 400)}`); continue; }
    const clean = !errs.length && !r.fatal, third = r.menu ? r.menu.rows[2] || '' : '';
    const ok = job.name === 'on'
      ? clean && r.rule === true && r.squad === 4 && r.dealt === 0 && !r.rowDealt && r.row && r.brought === 2 && r.menu.page === 'throw' && /^3 40 mm there · 2 left/.test(third) && r.fired === 1 && r.left === 1 && r.of0 === 1 && r.logged && !r.menuUp && r.burstOff >= 0 && r.burstOff < 1.5
      : clean && r.rule === false && r.dealt === 0 && !r.rowDealt && !r.row && r.fired === 0;
    if (!ok) red++;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${job.name === 'on' ? "the page as it opens: the rule is on, nothing is there as dealt, a staged round puts the row third on the throw page, and X · G · 3 on a spot with a shot has the man fire it" : 'under ?nosquad40: the rule is off, the same staging registers no row and nothing is fired'} — ${JSON.stringify({ ...r, spot: r.spot ? r.spot.map(x => +x.toFixed(1)) : undefined, range: r.range ? +r.range.toFixed(1) : undefined, burstOff: r.burstOff != null ? +(+r.burstOff).toFixed(2) : undefined })}${errs.length ? ` · page errors: ${errs.slice(0, 3).join(' | ')}` : ''}`);
  }
  await browser.close();
  console.log(`=== squad40-page: ${red ? 'FAILURES above' : 'ALL PASS'} ===`);
  process.exit(red ? 1 : 0);
})();
