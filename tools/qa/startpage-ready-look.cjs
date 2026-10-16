// THE ONE STARTING PAGE WITH THE RENDERER UP (ui/startpage.ts): the two things tools/qa/startpage-look.cjs cannot see with no adapter under the page — the solo
// night deployed off the page on the REAL start card is Start (no page load: the page and the card close and the game runs), and the pause card's Missions
// button opens the same page. Headless Chromium on the software WebGPU adapter (SwiftShader): the boot takes minutes.
//   node tools/qa/startpage-ready-look.cjs <outDir>      env: PORT (default 5199) · QUALITY (default verylow)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const outDir = process.argv[2] || 'startpage-ready-look';
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage|Failed to load resource/;
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
fs.mkdirSync(outDir, { recursive: true });
const report = { checks: [], errors: [] };
const check = (ok, label, detail) => { report.checks.push({ ok: !!ok, label, detail }); console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
(async () => {
  const browser = await chromium.launch({ headless: true, args: FLAGS });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.on('pageerror', e => { report.errors.push(String(e).slice(0, 300)); log('PAGE ERROR', String(e).slice(0, 300)); });
  page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text())) { report.errors.push(m.text().slice(0, 300)); log('console error', m.text().slice(0, 300)); } });
  await page.goto(`http://localhost:${PORT}/?quality=${QUALITY}&mute`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForSelector('#menu .actions button.primary', { timeout: 60000 }); await page.click('#menu .actions button.primary');   // (a plain visit opens on the title: Play is the way to the page)
  await page.waitForSelector('#missions.one.on', { timeout: 60000 });
  await page.evaluate(() => { window.__testVisible = true; });
  log('the page is up; waiting for the renderer…');
  await page.waitForFunction(() => window.__menu && window.__game && window.__menu.mode === 'start', null, { timeout: 900000, polling: 1000 });
  const up = await page.evaluate(() => ({ page: document.getElementById('missions').classList.contains('one') && document.getElementById('missions').classList.contains('on'), mode: window.__menu.mode }));
  check(up.page && up.mode === 'start', 'the page opened off the boot card is still the one up when the real start card arrives under it', JSON.stringify(up));
  const url0 = page.url();
  // (clicks go in through the DOM: with the software adapter drawing a frame every few seconds the pointer's 'is it stable' wait never ends)
  const click = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error('nothing at ' + s); e.click(); }, sel);
  await click('#missions .mrow[data-mission="solo-night"]'); await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'page-solo-ready.png'), timeout: 60000 }).catch(() => log('no still'));
  await page.keyboard.press('Enter'); await page.waitForTimeout(500); await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
  const st = await page.evaluate(() => ({ mode: window.__menu.mode, page: document.getElementById('missions').classList.contains('on'), menu: document.getElementById('menu').classList.contains('on'), lo: !!document.getElementById('loadout') }));
  check(st.mode === 'closed' && !st.page && !st.menu && !st.lo && page.url() === url0, 'the solo night deployed off the page is Start: no page load, the page and the card are gone, the game has the floor', `${JSON.stringify(st)} · url ${page.url() === url0 ? 'unchanged' : page.url()}`);
  await page.evaluate(() => window.__menu.open('pause')); await page.waitForTimeout(400);
  const pause = await page.evaluate(() => [...document.querySelectorAll('#menu .actions button')].map(b => b.textContent));
  await page.evaluate(() => [...document.querySelectorAll('#menu .actions button')].find(b => b.textContent === 'Missions').click()); await page.waitForTimeout(500);
  const p2 = await page.evaluate(() => ({ one: document.getElementById('missions').classList.contains('one') && document.getElementById('missions').classList.contains('on'), back: document.querySelector('#missions .mback')?.textContent, lo: !!document.querySelector('#missions .msheet #loadout') }));
  await page.screenshot({ path: path.join(outDir, 'page-over-pause.png'), timeout: 60000 }).catch(() => log('no still'));
  check(pause.includes('Resume') && pause.includes('Missions') && p2.one && p2.lo && p2.back === '‹ Back', "the pause card's Missions button opens the same page, its back button worded for the pause card", `${pause.join(' | ')} → ${JSON.stringify(p2)}`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  const p3 = await page.evaluate(() => ({ page: document.getElementById('missions').classList.contains('on'), mode: window.__menu.mode }));
  check(!p3.page && p3.mode === 'pause', 'Esc there is the pause card again, not the game', JSON.stringify(p3));
  // ---- 'Quit to scenarios' on a RUNNING scenario: the one page is back over the card, the scenario's flags off the address (a second boot: minutes).
  //      QUITROW picks the mission: an office mission off the short list (the default) quits IN PLACE — the start card and the page put up over the night floor;
  //      a short-list row or a level of its own quits by a page load, and the page that comes up is the boot's own
  if (process.env.QUIT !== '0') {
    const rowId = process.env.QUITROW || 'room-clear-pair';
    await page.evaluate(() => [...document.querySelectorAll('#menu .actions button')].find(b => b.textContent === 'Missions').click()); await page.waitForTimeout(500);
    await click(`#missions .mrow[data-mission="${rowId}"]`); await page.waitForTimeout(400);
    await page.keyboard.press('Enter'); await page.waitForTimeout(500);
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 900000 }), page.keyboard.press('Enter')]);
    const urlS = page.url(); log(rowId, 'is loading:', new URL(urlS).search);
    await page.evaluate(() => { window.__testVisible = true; });
    await page.waitForFunction(() => window.__menu && window.__game && typeof window.__runFrames === 'function', null, { timeout: 900000, polling: 1000 });   // (a scenario's own link has no start card: it is straight in)
    await page.waitForTimeout(1500);
    const card = await page.evaluate(() => ({ page: document.getElementById('missions')?.classList.contains('on') ?? false, mode: window.__menu.mode, live: !!(window.__game.nightBreach?.active || window.__game.rescue?.active) }));
    await page.evaluate(() => window.__menu.open('pause')); await page.waitForTimeout(500);
    const pb = await page.evaluate(() => [...document.querySelectorAll('#menu button')].map(b => b.textContent));
    await page.evaluate(() => { window.__lookMark = 1; [...document.querySelectorAll('#menu button')].find(b => b.textContent === 'Quit to scenarios').click(); }).catch(() => {});
    await page.waitForTimeout(3000);
    const READ = () => { const R = document.getElementById('missions'); return { same: window.__lookMark === 1, one: !!R && R.classList.contains('one') && R.classList.contains('on'), mode: window.__menu?.mode ?? 'booting', rows: R ? R.querySelectorAll('.mrow').length : 0,
      sel: R?.querySelector('.mrow.sel')?.getAttribute('data-mission') ?? null, lo: !!R?.querySelector('.msheet #loadout'), deploy: R?.querySelector('#loadout [data-act="deploy"]')?.textContent ?? '', search: location.search }; };
    let q1 = null; for (let i = 0; i < 90 && !(q1 && q1.one); i++) { q1 = await page.evaluate(READ).catch(() => null); if (!(q1 && q1.one)) await page.waitForTimeout(1000); }   // (a quit by a page load: the old page's context goes, the new page's boot card puts the page up)
    q1 = q1 ?? { same: false, one: false, mode: '?', rows: 0, sel: null, lo: false, deploy: '', search: '?' };
    const how = q1.same ? 'in place' : 'by a page load';
    await page.screenshot({ path: path.join(outDir, 'page-after-quit.png'), timeout: 60000 }).catch(() => log('no still'));
    check(!card.page && card.mode === 'closed' && card.live && pb.includes('Quit to scenarios') && q1.one && (!q1.same || q1.mode === 'start') && q1.rows >= 13 && q1.lo && !/nightbreach|roomclear|levelFile|pick=|rescue/.test(q1.search),
      `'Quit to scenarios' on a running scenario (${rowId}, ${how}) puts the one page back over the card, its loadout on it, the scenario's flags off the address`, `scenario page: ${new URL(urlS).search} · once up: ${JSON.stringify(card)} · after quit: ${JSON.stringify(q1)}`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    const q2 = await page.evaluate(() => ({ page: document.getElementById('missions').classList.contains('on'), mode: window.__menu?.mode ?? 'booting', buttons: [...document.querySelectorAll('#menu .actions button')].map(b => b.textContent) }));
    check(!q2.page && (!q1.same || q2.mode === 'start') && q2.buttons.includes('Play ›'), 'Esc there is the card with Play ›', JSON.stringify(q2));
  }
  check(report.errors.length === 0, 'no page error and no console error', report.errors.join(' | ') || 'none');
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
  await browser.close();
  const bad = report.checks.filter(c => !c.ok).length; console.log(bad ? `=== startpage-ready-look: ${bad} FAIL ===` : '=== startpage-ready-look: ALL PASS ===');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
