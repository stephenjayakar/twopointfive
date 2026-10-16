// PICKS LOOK: the short list (scene/picks.ts, ui/picks.ts) on the REAL page in headless Chromium on the software WebGPU adapter (SwiftShader — no GPU needed):
// what the fake-DOM probes (tools/qa/picks-probes.ts) cannot see — the rows as laid out and drawn, real key events, real page loads and the redirect.
//   node tools/qa/picks-look.cjs <outDir>          env: PORT (the dev server's, default 5199) · SIZE (default 1280x720) · QUALITY (default verylow) · ONLY=boot,fresh,pick,quiet,off (some of the five parts; the rows are always read first)
// PASS / FAIL lines, stills beside a report.json, exit 1 on a FAIL or a page error. About ten minutes: four pages are waited on until their renderer is up.
//   boot     the boot card (the renderer still compiling) already carries the rows; S / ↓ / W walk them; the real start card behind them keeps the row the
//            keys had; Enter = a page load of that row's own URL; the page booting that mission carries no rows
//   fresh    a start card nobody has touched: the focus is on Missions, a bare Space opens the list and loads nothing; the row started a page ago says 'played';
//            then THE ONE CHOICE by the keys: S onto a row, D onto its other difficulty, Enter = a page load of the same mission at that difficulty, which is
//            in force on the page it loads, and whose pause card carries the choice on to the next row
//   pick     ?pick=<place> is answered with ONE redirect to that row's URL, the visitor's flags kept; the page it loads stands the level up at the row's hour
//            and weather, straight in; its pause card offers 'Next: <the row after>' = that row's URL
//   quiet    a row's page (the one with `silentstart` where the list has one: the team silent from the first second; else the last scenario row): Quit to
//            scenarios = a page load of the plain URL, onto the rows
//   off      ?nopicks: no rows on the card, Missions primary; ?pick=3&nopicks is not redirected
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const outDir = process.argv[2] || 'picks-look';
const PORT = process.env.PORT || 5199;
const [W, H] = (process.env.SIZE || '1280x720').split('x').map(Number);
const QUALITY = process.env.QUALITY || 'verylow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, want = n => !ONLY || ONLY.includes(n);
// (the rows the list gives ONE difficulty, read off the table itself and not off the page under test)
const ONE = JSON.parse(require('child_process').execFileSync('bun', ['-e', "import { PICKS } from './src/scene/picks.ts'; console.log(JSON.stringify(PICKS.filter(p => p.oneDifficulty).map(p => p.id)))"], { cwd: path.join(__dirname, '..', '..'), encoding: 'utf8' }));
const T0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
fs.mkdirSync(outDir, { recursive: true });
const BASE = `http://localhost:${PORT}/`, Q = `paused&quality=${QUALITY}&mute&pickstraight&cards`;   // (?pickstraight: a click starts the row — the card this script was written against; the loadout-first card is tools/qa/picks-loadout-look.cjs's)
const report = { checks: [], errors: [] };
const check = (ok, label, detail) => { report.checks.push({ ok: !!ok, label, detail }); console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
function watch(page) {
  page.on('pageerror', e => { report.errors.push(String(e).slice(0, 300)); log('PAGE ERROR', String(e).slice(0, 300)); });
  page.on('console', m => { if (m.type() !== 'error') return; const t = m.text(); if (NOISE.test(t) || /Failed to load resource/.test(t)) return; /* (a failed load is named with its URL by the response hook) */ report.errors.push(t.slice(0, 300)); log('console error', t.slice(0, 300)); });
}
const rowsOf = page => page.evaluate(() => [...document.querySelectorAll('#menu .picks .prow')].map(a => ({ id: a.getAttribute('data-pick'), href: a.getAttribute('href'), n: a.querySelector('.pn')?.textContent, title: a.querySelector('.ptitle')?.textContent, tags: [...a.querySelectorAll('.ptag')].map(t => t.textContent), line: a.querySelector('.pline')?.textContent, done: a.querySelector('.pdone')?.textContent ?? '', h: Math.round(a.getBoundingClientRect().height),
  alt: (b => b ? { text: b.textContent, href: b.getAttribute('href'), id: b.getAttribute('data-alt'), right: Math.round(b.getBoundingClientRect().right), card: Math.round(document.querySelector('#menu .card').getBoundingClientRect().right) } : null)(a.parentElement.querySelector('.palt')) })));
const buttonsOf = page => page.evaluate(() => [...document.querySelectorAll('#menu button')].filter(b => b.offsetParent !== null).map(b => b.textContent + (b.classList.contains('primary') ? ' [primary]' : '') + (b.disabled ? ' [disabled]' : '')));
const ready = page => page.waitForFunction(() => window.__menu && window.__game, null, { timeout: 420000, polling: 1000 });
const shot = (page, name) => page.screenshot({ path: path.join(outDir, name), timeout: 120000 }).catch(e => log('no still', name, String(e).slice(0, 120)));

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  // ---- boot + keys
  let rows = [];
  { const page = await ctx.newPage(); watch(page);
    await page.goto(`${BASE}?${Q}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#menu .picks .prow', { timeout: 60000 });
    rows = await rowsOf(page);
    if (want('boot')) {
    const btns = await buttonsOf(page), early = await page.evaluate(() => !window.__game), status = await page.evaluate(() => { const s = document.querySelector('#menu .bootstatus'), r = document.querySelector('#menu .picks'); return { text: s?.textContent, above: !!s && !!r && s.getBoundingClientRect().bottom <= r.getBoundingClientRect().top + 1 }; });
    check(rows.length >= 5 && rows.length <= 7 && rows.every((r, i) => r.n === String(i + 1) && r.title && r.line && r.href.includes(`pick=${r.id}`) && r.href.endsWith(`&${Q}`)) && early && btns.some(b => /^Missions/.test(b)) && status.above,
      'the boot card carries the rows before the renderer is up: numbered, titled, each a link to its own URL with the visitor\'s flags behind it; Missions beside them; the boot\'s status line over the rows', `${rows.length} rows · game up: ${!early} · ${btns.join(' · ')} · status '${status.text}'\n    ${rows.map(r => `${r.n} ${r.title} [${r.tags.join(' · ')}] ${r.h}px → ${r.href}`).join('\n    ')}`);
    { const sc = rows.filter(r => !/[?&]solo\b/.test(r.href) && !ONE.includes(r.id)), other = r => (/difficulty=hard/.test(r.href) ? 'standard' : 'hard');
      check(sc.length > 0 && sc.every(r => r.alt && r.alt.id === r.id && r.alt.text === `${other(r)} ›` && r.alt.href === r.href.replace(/difficulty=\w+/, `difficulty=${other(r)}`) && r.alt.right <= r.alt.card) && rows.every(r => /[?&]solo\b/.test(r.href) || ONE.includes(r.id) ? !r.alt : true) && ONE.every(id => rows.some(r => r.id === id)),
        `the one choice on a row: at the end of every scenario row a link to the same mission at the other difficulty (standard / hard), inside the card; none on the solo night, none on a row the list gives one difficulty (${ONE.join(', ') || 'no such row'})`, rows.map(r => `${r.id}: ${r.alt ? `${r.alt.text} (right edge ${r.alt.right} of ${r.alt.card})` : 'none'}`).join(' · ')); }
    const at = () => page.evaluate(() => document.activeElement?.getAttribute?.('data-pick') ?? (document.activeElement?.getAttribute?.('data-alt') ? `alt:${document.activeElement.getAttribute('data-alt')}` : document.activeElement?.tagName));
    const f0 = await at(); await page.keyboard.press('KeyS'); const f1 = await at(); await page.keyboard.press('ArrowDown'); const f2 = await at(); await page.keyboard.press('KeyW'); const f3 = await at(); await page.keyboard.press('KeyS'); const f4 = await at();
    check(f0 !== rows[0].id && f1 === rows[0].id && f2 === rows[1].id && f3 === rows[0].id && f4 === rows[1].id, 'no row holds the focus until asked; S lands on the first row not yet played, S and ↓ walk down, W back up (taps, no held key)', `${f0} → ${f1} → ${f2} → ${f3} → ${f4}`);
    await ready(page); await page.waitForFunction(() => window.__menu.mode === 'start', null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(600);
    const after = await rowsOf(page), focus = await at(), card = await page.evaluate(() => { const c = document.querySelector('#menu .card'), b = [...document.querySelectorAll('#menu button')].find(x => x.textContent === 'Missions').getBoundingClientRect(); return { w: Math.round(c.getBoundingClientRect().width), h: c.clientHeight, scroll: c.scrollHeight, missionsBottom: Math.round(b.bottom), win: innerHeight }; });
    check(after.length === rows.length && focus === rows[1].id && card.missionsBottom <= card.win, 'the real start card behind it carries the same rows, the row the keys had walked to still has the focus, and the Missions button is on screen without scrolling', `${after.length} rows · focus ${focus} · Missions button's bottom at ${card.missionsBottom} of ${card.win}px (the card ${card.w} wide, ${card.h} of ${card.scroll}px)`);
    await shot(page, 'start-card.png');
    await page.keyboard.press('Enter');
    await page.waitForFunction(id => new URLSearchParams(location.search).get('pick') === id, rows[1].id, { timeout: 30000 }).catch(() => {});
    const to = await page.evaluate(() => location.search), kept = await page.evaluate(() => { try { return localStorage.getItem('twopointsix.picks'); } catch { return null; } });
    check(to === rows[1].href && kept === JSON.stringify([rows[1].id]), 'Enter on the highlighted row is a page load of that row\'s own URL, remembered as started', `${to} · kept ${kept}`);
    await page.waitForSelector('#menu .card', { timeout: 60000 }).catch(() => {}); await page.waitForTimeout(1500);
    const onMission = (await rowsOf(page)).length;
    check(onMission === 0, 'the page that is now booting that mission carries no rows on its boot card (W S Space there are the game\'s, not a way off the page)', `${onMission} rows`);
    }
    await page.close(); }
  // ---- a fresh start card: the keys start nothing by themselves
  if (want('fresh')) { const page = await ctx.newPage(); watch(page);
    await page.goto(`${BASE}?${Q}`, { waitUntil: 'domcontentloaded' });
    await ready(page); await page.waitForFunction(() => window.__menu.mode === 'start', null, { timeout: 60000 }).catch(() => {}); await page.waitForTimeout(900);
    const focus = await page.evaluate(() => document.activeElement?.textContent?.slice(0, 20)), before = await page.evaluate(() => location.search);
    await page.keyboard.press('Space'); await page.waitForTimeout(700);
    const list = await page.evaluate(() => !!document.getElementById('missions')?.classList.contains('on')), still = await page.evaluate(() => location.search);
    check(focus === 'Missions' && list && still === before, 'the start card opens with the focus on Missions, as before: a bare Space opens the mission list and loads nothing', `focus '${focus}' · list up ${list} · ${still}`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    const played = (await rowsOf(page)).filter(r => r.done).map(r => r.id);
    if (want('boot')) check(played.length === 1 && played[0] === rows[1].id, "the row started a page ago says 'played' here (kept per machine) and no other does", played.join(' · ') || 'none');   // (the boot section started it, in this same browser profile)
    await shot(page, 'start-card-played.png');
    // THE ONE CHOICE by the keys: S (the first row not yet played), D onto its other difficulty, A back, D again, Enter
    const at = () => page.evaluate(() => document.activeElement?.getAttribute?.('data-pick') ?? (document.activeElement?.getAttribute?.('data-alt') ? `alt:${document.activeElement.getAttribute('data-alt')}` : document.activeElement?.tagName));
    await page.keyboard.press('KeyS'); const k1 = await at(); await page.keyboard.press('KeyD'); const k2 = await at(); await page.keyboard.press('KeyA'); const k3 = await at(); await page.keyboard.press('ArrowRight'); const k4 = await at();
    const row = rows.find(r => r.id === k1);
    check(!!row && !!row.alt && k2 === `alt:${row.id}` && k3 === row.id && k4 === `alt:${row.id}`, 'S lands on the first row not yet played; D or → steps onto its other difficulty, A back (taps, no held key, no digit)', `${k1} → ${k2} → ${k3} → ${k4}`);
    await shot(page, 'start-card-alt.png');
    if (row && row.alt) {
      await page.keyboard.press('Enter');
      await page.waitForFunction(h => location.search === h, row.alt.href, { timeout: 30000 }).catch(() => {});
      const to = await page.evaluate(() => location.search);
      check(to === row.alt.href, 'Enter there is a page load of the same mission at the other difficulty', to);
      await ready(page); await page.waitForTimeout(600);
      const want = new URLSearchParams(row.alt.href).get('difficulty');
      const st = await page.evaluate(() => ({ difficulty: window.__picks.difficulty(), pick: window.__picks.current()?.id ?? null, units: window.__game.guards.filter(g => g.unit).length, card: document.getElementById('menu').classList.contains('on') }));
      await page.evaluate(() => { window.__menu.open('pause'); });
      const btns = await buttonsOf(page), next = btns.find(b => /^Next: /.test(b)), i = rows.indexOf(row), nx = rows[i + 1], carried = nx && nx.alt && !nx.href.includes(`difficulty=${want}`);
      check(st.difficulty === want && st.pick === row.id && st.units > 0 && !st.card && (nx ? next === `Next: ${nx.title}${carried ? ` · ${want}` : ''} ›` : !next), 'the page it loads is that row at that difficulty, straight in, and its pause card carries the choice on to the next row', `${JSON.stringify(st)} · ${next ?? 'no next'}`);
    }
    await page.close(); }
  // ---- ?pick=3: one redirect, the mission with its settings, its own start card, the pause card's next, the quit
  if (want('pick')) { const page = await ctx.newPage(); watch(page); let navs = 0; page.on('framenavigated', f => { if (f === page.mainFrame()) navs++; });
    const k = rows.findIndex(r => /roomclear/.test(r.href) && /hour=|weather=/.test(r.href)), K = k < 0 ? 2 : k;
    await page.goto(`${BASE}?pick=${K + 1}&${Q}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /pick=[a-z]/.test(location.search), null, { timeout: 30000 }).catch(() => {});
    const at = await page.evaluate(() => location.search);
    check(at === rows[K].href && navs === 2, `?pick=${K + 1} is answered with one redirect to that row's URL, the visitor's flags kept`, `${at} · ${navs} navigations`);
    await ready(page); await page.waitForTimeout(600);
    const q = new URLSearchParams(rows[K].href);
    const st = await page.evaluate(() => ({ hour: window.__hour?.id, weather: window.__weather?.kind ?? null, units: window.__game.guards.filter(g => g.unit).length, card: document.getElementById('menu').classList.contains('on'), pick: window.__picks.current()?.id ?? null }));
    check(st.hour === (q.get('hour') ?? 'night') && st.weather === q.get('weather') && st.units > 0 && !st.card && st.pick === rows[K].id, 'the page it loads stands the level up at the row\'s hour and in its weather, the teams staged, and goes straight in (no card in the way)', JSON.stringify(st));
    await page.evaluate(() => { window.__menu.open('pause'); });
    const btns = await buttonsOf(page), next = btns.find(b => /^Next: /.test(b));
    check(rows[K + 1] ? next === `Next: ${rows[K + 1].title} ›` : !next, 'its pause card offers the row after it', btns.join(' · '));
    await shot(page, 'pause-card.png');
    if (next) {
      await page.evaluate(() => { [...document.querySelectorAll('#menu button')].find(b => /^Next: /.test(b.textContent)).click(); });
      await page.waitForFunction(id => new URLSearchParams(location.search).get('pick') === id, rows[K + 1].id, { timeout: 30000 }).catch(() => {});
      const to = await page.evaluate(() => location.search);
      check(to === rows[K + 1].href, 'a click on it is a page load of that row\'s own URL', to);
    }
    await page.close(); }
  // ---- the quiet pick's switch on the page, and a quit out of a pick
  if (want('quiet')) { const page = await ctx.newPage(); watch(page);
    const ks = rows.findIndex(r => /[?&]silentstart\b/.test(r.href)), k = ks >= 0 ? ks : rows.map(r => !/[?&]solo\b/.test(r.href)).lastIndexOf(true);
    if (ks < 0) log('no row carries silentstart: the quiet-start check is skipped, the quit is checked on the last scenario row');
    if (k >= 0) {
      await page.goto(`${BASE}${rows[k].href}`, { waitUntil: 'domcontentloaded' });
      await ready(page); await page.waitForTimeout(600);
      const st = await page.evaluate(() => { window.__menu.close(); window.__runFrames(6);   /* (few: every frame handed to the software adapter is seconds its GPU process must finish before the quit's page load goes through) */ return { team: window.__game.guards.filter(g => g.unit && g.team !== 'hostile' && g.state !== 'dead').length, pick: window.__picks.current()?.id ?? null, ...window.__picks.silent() }; });
      if (ks >= 0) check(st.team === 1 && st.pick === rows[k].id && st.start && st.squad, 'the quiet pick\'s page: one partner beside you, and the team is silent from the first second', JSON.stringify(st));
      else check(st.team > 0 && st.pick === rows[k].id && !st.start, 'the last scenario row\'s page is that pick, its team staged, nobody told to start silent', JSON.stringify(st));
      await page.evaluate(() => { window.__menu.open('pause'); });
      const quitUp = await page.evaluate(() => [...document.querySelectorAll('#menu button')].some(b => b.textContent === 'Quit to scenarios'));
      if (quitUp) await Promise.all([page.waitForURL(u => !/pick=/.test(String(u)), { timeout: 600000, waitUntil: 'domcontentloaded' }).catch(e => log('the quit did not load', String(e).slice(0, 120))),   // (the load can take minutes here: the software adapter's GPU process finishes the frames it was handed first)
        page.evaluate(() => { [...document.querySelectorAll('#menu button')].find(b => b.textContent === 'Quit to scenarios').click(); }).catch(() => {})]);
      else check(false, 'the pause card of a pick offers Quit to scenarios', (await buttonsOf(page)).join(' · '));
      await page.waitForSelector('#menu .picks .prow', { timeout: 120000 }).catch(() => {});
      const to = await page.evaluate(() => location.search), back = (await rowsOf(page)).length;
      check(to === `?${Q}` && back === rows.length, 'Quit to scenarios out of a pick is a page load of the plain URL (the pick\'s settings gone) and lands on the rows', `${to} · ${back} rows`);
    }
    await page.close(); }
  // ---- the switch off
  if (want('off')) { const page = await ctx.newPage(); watch(page);
    await page.goto(`${BASE}?pick=3&nopicks&${Q}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#menu button', { timeout: 60000 }); await page.waitForTimeout(2500);
    const off = await rowsOf(page), btns = await buttonsOf(page), at = await page.evaluate(() => location.search), css = await page.evaluate(() => !!document.getElementById('picks-css'));
    check(off.length === 0 && at === `?pick=3&nopicks&${Q}` && btns[0] === 'Missions [primary]' && !css, '?nopicks: no rows and none of their styles on the card, Missions the primary button, and ?pick=3 is not redirected', `${off.length} rows · ${at} · ${btns.join(' · ')} · styles ${css}`);
    await page.close(); }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
  const fails = report.checks.filter(c => !c.ok).length;
  console.log(`=== picks-look: ${fails || report.errors.length ? `${fails} FAIL, ${report.errors.length} page errors` : 'ALL PASS'} (${report.checks.length} checks) ===`);
  process.exit(fails || report.errors.length ? 1 : 0);
})().catch(e => { console.log('FAILED', String(e).slice(0, 600)); process.exit(1); });
