// THE FIXED STEP AND THE DRAWING BETWEEN TICKS ON THE REAL PAGE (src/host/loop.ts FIXEDSTEP, src/host/tween.ts TWEEN): the page in headless Chromium on the software
// adapter, its OWN frame loop let run (a script's __runFrames names its dt and bypasses both). Nothing is seen drawn: this reads what the loop did, and that nothing threw.
//   node tools/qa/tween-page.cjs      env: PORT (the dev server's, default 5199) · QUERY (extra URL words, e.g. 'roomclear&squad=4') · REAL (frames drawn by the engine's
//   own render before the stand-in takes over, default 3: a frame is seconds on this adapter)
// the page opens with both on · the engine's own render draws live frames under both, some of them between two ticks with the blend hung, with no console or GPU error · at a display twice and 2.4 times the tick rate (the
// page's clock scaled: __timeScale) every update is 1/60 s, the frames fall between ticks (a factor strictly between 0 and 1 on some) and the men and boxes are blended,
// the picture a part of a tick behind (the lag is printed) · under the pause card nothing is hung · TWEEN off = the fixed step with nothing hung · FIXEDSTEP off = one
// update a frame on the frame's own time · ?fixedstep=0 and ?tween=0 at the boot.
// PASS / FAIL lines; exit 0 = all pass, 1 = a FAIL or a page error, 2 = the script died.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUERY = process.env.QUERY ? '&' + process.env.QUERY : '', REAL = +(process.env.REAL ?? 3);
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
let bad = 0;
const check = (ok, what, detail) => { console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); if (!ok) bad++; };

(async () => {
  const browser = await chromium.launch({ headless: true, args: FLAGS });
  const open = async extra => {
    const ctx = await browser.newContext({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage(); const cons = [];
    page.on('pageerror', e => { cons.push('pageerror: ' + String(e).slice(0, 300)); });
    page.on('console', m => { if (m.type() === 'error') cons.push('console: ' + m.text().slice(0, 300)); });
    await page.goto(`http://localhost:${PORT}/?paused&quality=verylow&mute&seed=7${QUERY}${extra}`, { waitUntil: 'domcontentloaded' });
    for (let i = 0; ; i++) {
      try { await page.waitForFunction(() => !!window.__ready, null, { timeout: 60000 }); await page.evaluate(() => window.__ready); break; }
      catch (e) { if (i >= 3 || !/navigation|destroyed/i.test(String(e))) throw e; await page.waitForLoadState('domcontentloaded').catch(() => {}); }
    }
    await page.evaluate(() => {
      window.__testVisible = true; window.__smoke.params.enabled = false;
      const g = window.__game, e = window.__engine, T = window.__tw = { dts: [], frames: [], real: e.render.bind(e), standIn: false };
      const upd = g.update.bind(g); g.update = (dt, ...a) => { T.dts.push(dt); return upd(dt, ...a); };
      e.render = (...a) => { const F = window.__fixedstep; T.frames.push({ ticks: F.ticks, drew: F.drew, real: !T.standIn }); if (T.standIn) { e.world.upload(); e.lights.upload(0); } else T.real(...a); };
    });
    return { ctx, page, cons };
  };
  const take = (page) => page.evaluate(() => { const T = window.__tw, o = { dts: T.dts.slice(), frames: T.frames.slice() }; T.dts.length = 0; T.frames.length = 0; return o; });
  const run = async (page, n, timeout = 600000) => { const from = await page.evaluate(() => window.__tw.frames.length); await page.waitForFunction(([f, k]) => window.__tw.frames.length >= f + k, [from, n], { timeout }); };
  const said = o => { const fr = o.frames, hung = fr.filter(f => f.drew), frac = hung.filter(f => f.drew.a > 0.01 && f.drew.a < 0.99); const dts = [...new Set(o.dts.map(d => +d.toFixed(6)))];
    return { hung: hung.length, frac: frac.length, men: hung.filter(f => f.drew.men > 0).length, boxes: hung.filter(f => f.drew.boxes > 0).length, dts,
      text: `${fr.length} frames, ${o.dts.length} updates of ${dts.slice(0, 4).join(' / ')} s · ${hung.length} frames with the tween standing, ${frac.length} strictly between two ticks · men blended on ${hung.filter(f => f.drew.men > 0).length}, keyed boxes on ${hung.filter(f => f.drew.boxes > 0).length}${hung.length ? ` · the picture ${hung[hung.length - 1].drew.lag.toFixed(3)} of a tick behind` : ''}` }; };

  { console.log(`the page as it ships (${QUERY || 'no extra word'})`);
    const { ctx, page, cons } = await open('');
    const K = await page.evaluate(() => ({ fixed: window.__fixedstep.knobs.on, hz: window.__fixedstep.knobs.hz, tween: window.__fixedstep.tween.on, seed: window.__game.dice && window.__game.dice.seed }));
    check(K.fixed === true && K.tween === true && K.hz === 60, 'the page opens with the fixed step and the drawing between ticks on', `FIXEDSTEP.on ${K.fixed} at ${K.hz} Hz · TWEEN.on ${K.tween} · the die's seed ${K.seed}`);
    // the engine's own render, a few frames, a man walking
    await page.evaluate(() => { window.__menu.close(); window.__input.keys.add('KeyW'); window.__pauseLoop = false; });
    await page.evaluate(() => window.__cut && window.__cut.programs && Promise.race([window.__cut.programs.ready, new Promise(r => setTimeout(r, 400000))]).then(() => 0)).catch(() => {});
    await run(page, REAL); await page.evaluate(() => window.__engine.device.queue.onSubmittedWorkDone());
    let o = await take(page), s = said(o);
    check(o.frames.length >= REAL && s.dts.length === 1 && Math.abs(s.dts[0] - 1 / 60) < 1e-6 && s.hung > 0 && cons.length === 0, `the engine's own render: ${REAL} live frames drawn under both switches, every update 1/60 s, no console or GPU error`, s.text + (cons.length ? ' ✗ ' + cons.slice(0, 3).join(' ✗ ') : ''));
    // …and with a blend hung: the clock slowed until each of these slow frames is half a tick (a frame here is capped at 50 ms = three ticks)
    await page.evaluate(() => { window.__timeScale = 1 / 6; }); await run(page, 1); await take(page); await run(page, REAL + 1); await page.evaluate(() => window.__engine.device.queue.onSubmittedWorkDone());
    o = await take(page); s = said(o);
    check(o.frames.every(f => f.real) && s.frac > 0 && s.men > 0 && s.boxes > 0 && cons.length === 0, `the engine's own render with the blend hung: frames between two ticks drawn, no console or GPU error`, s.text + (cons.length ? ' ✗ ' + cons.slice(0, 3).join(' ✗ ') : ''));
    await page.evaluate(() => { window.__timeScale = 1; });
    // a display at twice, then 2.4 times, the tick rate (the page's clock scaled; the render stood in for by the packs)
    for (const [scale, name] of [[0.5, 'twice'], [1 / 2.4, '2.4 times']]) {
      await page.evaluate(sc => { window.__tw.standIn = true; window.__timeScale = sc; }, scale);
      await run(page, 20); await take(page); await run(page, 240); o = await take(page); s = said(o);
      const perFrame = o.dts.length / o.frames.length;
      check(s.dts.length === 1 && Math.abs(s.dts[0] - 1 / 60) < 1e-6 && s.frac > 20 && s.men > 20 && s.boxes > 20 && perFrame < 0.9 && cons.length === 0, `a display at ${name} the tick rate: every update 1/60 s, frames fall between ticks and are drawn blended`, `${s.text} · ${perFrame.toFixed(2)} updates a frame` + (cons.length ? ' ✗ ' + cons.slice(0, 3).join(' ✗ ') : ''));
    }
    // the pause card
    await page.evaluate(() => { window.__menu.open('pause'); }); await run(page, 3); await take(page); await run(page, 10); o = await take(page); s = said(o);
    check(o.dts.length === 0 && s.hung === 0, 'under the pause card: no update, nothing hung', s.text);
    await page.evaluate(() => { window.__menu.close(); }); await run(page, 3); await take(page); await run(page, 30); o = await take(page); s = said(o);
    check(s.hung > 20 && s.men > 5 && cons.length === 0, 'play again: blended again', s.text + (cons.length ? ' ✗ ' + cons.slice(0, 3).join(' ✗ ') : ''));
    // the two switches, live (the Tab rows write the same tables)
    await page.evaluate(() => { window.__fixedstep.tween.on = false; }); await run(page, 3); await take(page); await run(page, 30); o = await take(page); s = said(o);
    check(s.hung === 0 && s.dts.length === 1 && Math.abs(s.dts[0] - 1 / 60) < 1e-6, 'TWEEN off: the fixed step with nothing hung', s.text);
    await page.evaluate(() => { window.__fixedstep.tween.on = true; window.__fixedstep.knobs.on = false; }); await run(page, 3); await take(page); await run(page, 30); o = await take(page); s = said(o);
    check(s.hung === 0 && o.dts.length === o.frames.length && o.dts.every(d => Math.abs(d - 1 / 60) > 1e-5), 'FIXEDSTEP off: one update a frame on the frame\'s own time, nothing hung', s.text);
    await ctx.close();
  }
  for (const [word, wantF, wantT] of [['&fixedstep=0', false, true], ['&tween=0', true, false]]) {
    const { ctx, page, cons } = await open(word);
    const K = await page.evaluate(() => ({ fixed: window.__fixedstep.knobs.on, tween: window.__fixedstep.tween.on }));
    check(K.fixed === wantF && K.tween === wantT && cons.length === 0, `?${word.slice(1)}: that switch off at the boot`, `FIXEDSTEP.on ${K.fixed} · TWEEN.on ${K.tween}` + (cons.length ? ' ✗ ' + cons.slice(0, 3).join(' ✗ ') : ''));
    await ctx.close();
  }
  await browser.close();
  console.log(bad ? `=== tween-page: ${bad} FAILED ===` : '=== tween-page: ALL PASS ===');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('TWEEN-PAGE ERROR', String(e).slice(0, 600)); process.exit(2); });
