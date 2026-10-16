// EACH MAN'S PICTURE ON THE REAL PAGE (game/picture.ts, ui/pictureviz.ts): boot the four-man room clear in headless Chromium on the software WebGPU adapter
// (tools/qa/page-look.cjs's recipe) with the floor view asked for (?picture=all), run a second of play, hand one teammate an idea of an enemy two metres from
// where that enemy stands, and read the page's own SVG: the view's group is shown and its threads and rings carry path data; the same page under ?nopicture:
// the switch is off, the group is hidden and nothing is drawn. No page error on either. A software adapter says nothing about how the marks LOOK.
//   PORT=5199 node tools/qa/picture-page.cjs [outDir]        (a dev server on that port: PORT=5199 bun run tools/serve.ts; outDir = a still of each;
//   ONLY=view|off = that page alone: each is some eight minutes on the software adapter)
// exit 0 = both hold with no page error · 1 = otherwise
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', OUT = process.argv[2] || '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  let failed = false;
  for (const [name, q] of [['view', 'picture=all'], ['off', 'picture=all&nopicture']].filter(x => !process.env.ONLY || x[0] === process.env.ONLY)) {
    const page = await browser.newPage({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 }); const errors = []; page.setDefaultTimeout(900000);
    page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&roomclear&squad4&${q}`);
    const r = await page.evaluate(async () => { await window.__ready; window.__testVisible = true;
      // (the game steps with the draw left out, as hungcharge-page.cjs does: a drawn frame on the software adapter is tens of seconds; one real frame at the end)
      const step = n => { const e = window.__engine, real = e.render; e.render = () => { e.world.upload(); }; try { for (let i = 0; i < n; i++) window.__runFrames(1, 1 / 60); } finally { e.render = real; } };
      step(60);
      const g = window.__game, P = window.__picture, sw = window.__knobs.registry().PICTURE;
      const men = g.guards.map((gd, i) => ({ gd, i })).filter(x => x.gd.team === 'operative' && x.gd.char.alive && x.gd.state !== 'dead'), foes = g.guards.map((gd, i) => ({ gd, i })).filter(x => x.gd.team === 'hostile' && x.gd.char.alive && x.gd.state !== 'dead');
      if (men.length && foes.length) { const m = men[0], f = foes[0], c = m.gd.char.pos; P.tell(m.i, f.i, [c[0] + 3, 0, c[2] + 2], 0); P.tell(m.i, foes[foes.length - 1].i, [c[0] - 2, 0, c[2] + 3], 8); }
      step(30); window.__runFrames(1, 1 / 6000); await window.__engine.device.queue.onSubmittedWorkDone();
      const grp = document.querySelector('#traj g.picture'), paths = grp ? [...grp.querySelectorAll('path')].filter(e => (e.getAttribute('d') || '').length > 0).length : -1;
      return { fatal: document.getElementById('fatal')?.textContent || '', on: !!(sw && sw.on), show: sw && sw.show, men: men.length, foes: foes.length, ideas: men.length ? P.ideas(men[0].i).length : 0, views: P.views().length,
        shown: !!grp && grp.style.display !== 'none', paths, summary: P.summary(), looks: P.stats.looks, state: window.__roomclear && window.__roomclear.state }; });
    if (OUT) await page.screenshot({ path: `${OUT}/picture-${name}.png`, timeout: 120000 }).catch(() => console.log(`  (no still of ${name}: the page did not hand one over)`));
    const want = name === 'view';
    const ok = !r.fatal && !errors.length && r.men === 4 && r.foes > 0 && r.on === want && (want ? r.ideas >= 2 && r.views === 4 && r.shown && r.paths >= 3 && r.looks > 0 : r.ideas === 0 && r.views === 0 && !r.shown && r.looks === 0);
    if (!ok) failed = true;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${name}: switch ${r.on ? 'on' : 'off'} (show '${r.show}') · ${r.men} teammates, ${r.foes} enemies standing · the first man holds ${r.ideas} idea(s) · ${r.views} picture(s) for the floor · the view's group ${r.shown ? 'shown' : 'hidden'} with ${r.paths} drawn path(s) · ${r.looks} looks · panel: ${r.summary}${r.fatal ? ' · FATAL ' + r.fatal : ''}${errors.length ? ' · ERRORS ' + errors.slice(0, 3).join(' | ') : ''}`);
    await page.close();
  }
  await browser.close();
  console.log(failed ? '=== picture-page: FAILED ===' : '=== picture-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
