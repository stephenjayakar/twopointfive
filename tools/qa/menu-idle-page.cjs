// THE LEVEL IS NOT DRAWN BEHIND A PAGE THAT HIDES ALL OF IT (src/main.ts `viewHidden`). The maintainer, 10-12, on Team & kit: "framerate isn't great here -- are we
// rendering this + the level?" — we were: the one starting page and the options layer paint over the whole view, the world under them is frozen, and the level's whole
// frame was still drawn every display frame. The REAL page in headless Chromium on the software adapter: `__behind` counts frames drawn / skipped.
//   node tools/qa/menu-idle-page.cjs      env: PORT (the dev server's, default 5199) · QUALITY (verylow) · WARM (frames still drawn after such a page goes up; the
//   page's own is 90, the tool asks for 6) · REAL=1 (the engine's own render kept: a frame is seconds on this adapter, and the waits below are then too short)
// (booted `?paused`, then the page's own loop let run with the smoke solver off: nothing here calls `__runFrames`, which the rule stands down for.)
// the title draws · the start page stops the drawing after the warm frames, on both its steps · the figure is drawn there and says what a frame of it costs ·
// back on the title the level is drawn again · the options layer opened from the title the same, opened over a paused run still drawn · `?menurender` = drawn every frame as it was.
// PASS / FAIL lines; exit 0 = all pass, 1 = a FAIL or a page error, 2 = the script died.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', WARM = +(process.env.WARM || 6), REAL = process.env.REAL === '1';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
let bad = 0;
const check = (ok, what, detail) => { console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); if (!ok) bad++; };

(async () => {
  const browser = await chromium.launch({ headless: true, args: FLAGS });
  const open = async extra => {
    const ctx = await browser.newContext({ viewport: { width: 1270, height: 790 }, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#fatal { display: none !important; }'; document.head.appendChild(s); }));
    const page = await ctx.newPage();
    page.on('pageerror', e => { console.log('  PAGE ERROR', String(e).slice(0, 300)); bad++; });
    // booted paused (no attract reel, no calibration), then the page's own frame loop let run: the smoke solver off first — its warm-up can is seconds a step here
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute${extra}`, { waitUntil: 'domcontentloaded' });
    // (the dev server bundles the tree at a page load and may load the page once more when the bundle is fresh: a boot cut off by that is waited for again)
    for (let i = 0; ; i++) {
      try { await page.waitForFunction(() => !!window.__ready, null, { timeout: 60000 }); await page.evaluate(() => window.__ready); break; }
      catch (e) { if (i >= 3 || !/navigation|destroyed/i.test(String(e))) throw e; await page.waitForLoadState('domcontentloaded').catch(() => {}); }
    }
    await page.waitForSelector('#menu .actions button', { timeout: 240000 });
    // the frame itself is not this tool's question, and on this adapter it can be a quarter of a minute: `__behind` counts the render CALLS main.ts lets through, so the
    // engine's own render is stood in for by the world's pack (REAL=1 keeps it and wants minutes a line). No frame comes at all while the second set of programs compiles
    // (cutSwap, a couple of minutes after boot here): the first frames after the loop is let go are waited for
    const from = await page.evaluate(([w, real]) => { const e = window.__engine; if (!real) e.render = () => { e.world.upload(); };
      window.__smoke.params.enabled = false; window.__behind.warm = w; window.__pauseLoop = false; return window.__behind.drawn; }, [WARM, REAL]);
    await page.evaluate(() => window.__cut && window.__cut.programs && Promise.race([window.__cut.programs.ready, new Promise(r => setTimeout(r, 400000))]).then(() => 0)).catch(() => {});
    await page.waitForFunction(n => window.__behind.drawn > n + 2, from, { timeout: 600000 });
    return { ctx, page };
  };
  const counts = page => page.evaluate(() => ({ drawn: window.__behind.drawn, skipped: window.__behind.skipped, hidden: window.__behind.hidden }));
  // the counts now and `ms` later: what was drawn and what was skipped in between
  // (the page's frames stop coming for a while whenever this adapter is compiling programs: a count is taken only once two more have come)
  const flowing = page => page.evaluate(() => window.__behind.drawn + window.__behind.skipped).then(n => page.waitForFunction(n => window.__behind.drawn + window.__behind.skipped > n + 1, n, { timeout: 300000 })).catch(() => {});
  // (…and on a loaded machine a whole window was seen to pass with NO frame of the page at all: a window with nothing drawn AND nothing skipped says nothing
  // and is taken again, 5 times at most, then judged as it stands; any other is judged at once)
  const over = async (page, ms) => { for (let again = 0; ; again++) { await flowing(page); const a = await counts(page); await page.waitForTimeout(ms); const b = await counts(page), d = { drawn: b.drawn - a.drawn, skipped: b.skipped - a.skipped, hidden: b.hidden, again };
    if (d.drawn + d.skipped > 0 || again >= 5) return d; } };
  const said = d => `${d.drawn} drawn, ${d.skipped} skipped${d.hidden ? ', hidden' : ''}${d.again ? `, after ${d.again} empty window${d.again > 1 ? 's' : ''}` : ''}`;
  const hiddenSoon = page => page.waitForFunction(() => window.__behind.hidden, null, { timeout: 300000 }).then(() => true, () => false);
  const button = async (page, word) => { await flowing(page); const all = await page.$$('#menu .actions button'); for (const b of all) if (new RegExp(word, 'i').test(await b.textContent() || '')) { await b.click(); return true; } return false; };

  { console.log('the page as it ships');
    const { ctx, page } = await open('&oldfigure');   // (the standing figure's own frame cost is read below: `?oldfigure` keeps him on a mission whose level stages the team at its door instead — src/ui/kitView.ts; the level behind is hidden by the same rule either way)
    let d = await over(page, 4000);
    check(d.drawn > 0 && d.skipped === 0, 'the title shows the level: it is drawn', said(d));
    await flowing(page); await page.click('#menu .actions button.primary'); await page.waitForSelector('#missions.one.on');
    const went = await hiddenSoon(page); d = await over(page, 6000);
    check(went && d.drawn === 0 && d.skipped > 0, `the Mission step hides the level: after ${WARM} frames it is not drawn`, said(d));
    await page.keyboard.press('Enter'); await page.waitForSelector('#missions .onefig canvas[data-fig]', { timeout: 240000 }).catch(() => {});
    await page.waitForTimeout(5000); d = await over(page, 6000);
    const fig = await page.evaluate(() => { const c = document.querySelector('#missions .onefig canvas'); return c ? { fig: c.getAttribute('data-fig'), ms: c.getAttribute('data-ms'), fps: c.getAttribute('data-fps'), w: c.width, h: c.height } : null; });
    check(d.drawn === 0 && d.skipped > 0, 'Team & kit the same', said(d));
    check(!!fig && !!fig.fig && +fig.ms >= 0 && (fig.fps === '30' || fig.fps === '20'), 'the figure is drawn there and says what a frame of it costs', fig ? `${fig.w} x ${fig.h} px · ${fig.ms} ms a frame · ${fig.fps} a second (this box, the software adapter beside it)` : 'no figure canvas');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300); await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#missions.one.on'), null, { timeout: 30000 }).catch(() => {});
    d = await over(page, 5000);
    check(d.drawn > 0 && d.skipped === 0 && !d.hidden, 'back on the title the level is drawn again', said(d));
    const opened = await button(page, 'options'); await page.waitForSelector('#options', { timeout: 30000 }).catch(() => {});
    const went2 = opened && await hiddenSoon(page); d = await over(page, 5000);
    check(went2 && d.drawn === 0 && d.skipped > 0, 'the options layer hides it too', said(d));
    await page.keyboard.press('Escape'); await page.waitForTimeout(500); d = await over(page, 5000);
    check(d.drawn > 0 && !d.hidden, 'and Esc from it draws the level again', said(d));
    // over a PAUSED run the options layer lets the frame show through (Brightness, the tier are judged against it): drawn as ever
    await page.evaluate(() => { window.__menu.close(); }); await page.waitForTimeout(1500); await page.evaluate(() => { window.__menu.open('pause'); });
    const opened2 = await button(page, 'options'); const overGame = await page.waitForSelector('#options.over-game', { timeout: 30000 }).then(() => true, () => false);
    await page.waitForTimeout(3000); d = await over(page, 6000);
    check(opened2 && overGame && d.drawn > 0 && d.skipped === 0 && !d.hidden, 'the options layer over a paused run shows the frame through: still drawn', `${overGame ? '#options.over-game' : 'no #options.over-game'} · ${said(d)}`);
    await ctx.close(); }

  { console.log('?menurender');
    const { ctx, page } = await open('&menurender');
    await flowing(page); await page.click('#menu .actions button.primary'); await page.waitForSelector('#missions.one.on'); await page.waitForTimeout(8000);
    const d = await over(page, 6000);
    check(d.drawn > 0 && d.skipped === 0 && !d.hidden, 'the level is drawn behind the start page every frame, as it was', said(d));
    await ctx.close(); }

  await browser.close();
  console.log(bad ? `\n=== menu-idle-page: ${bad} FAILED ===` : '\n=== menu-idle-page: ALL PASS ===');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
