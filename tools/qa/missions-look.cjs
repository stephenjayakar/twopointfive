// MISSIONS LOOK: the mission list (ui/missions.ts) on the REAL page in headless Chromium on the software WebGPU adapter (SwiftShader — no GPU needed): what the
// fake-DOM probes (tools/qa/missions-probes.ts) cannot see — the screen as laid out and drawn, real key events against main.ts's own listeners, a real page load.
//   node tools/qa/missions-look.cjs <outDir>          env: PORT (the dev server's, default 5199) · SIZE (default 1280x720) · QUALITY (default verylow) · ONLY=card,solo,quit (default all)
// Four pages, one at a time (about eight minutes in all), PASS / FAIL lines, stills beside a report.json, exit 1 on a FAIL or a page error:
//   card   the list opened off the BOOT card (the renderer still compiling) and still up once the real start card is behind it; a still per mission and one at a
//          narrow window; the floor plans fetched; S / ↓ / W move, D / A set the defenders; Esc closes the LIST and leaves the card (main.ts's own Esc handler
//          would have started the game); Space on a row = its loadout screen, whose Enter loads that row's own URL
//   solo   ?solo boots the plain night with NO start card
//   quit   'Quit to scenarios' out of a scenario lands on the list: in place on the office, and across the page load on a level file of its own (the depot)
// The software adapter's smoke-pipeline console noise is passed over exactly as tools/qa/page-look.cjs does (same pattern, the same cap for each page load).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const outDir = process.argv[2] || 'missions-look';
const PORT = process.env.PORT || 5199;
const [W, H] = (process.env.SIZE || '1280x720').split('x').map(Number);
const QUALITY = process.env.QUALITY || 'verylow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
const NOISE_MAX = 80;
const T0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
fs.mkdirSync(outDir, { recursive: true });
const BASE = `http://localhost:${PORT}/`, Q = `paused&quality=${QUALITY}&mute&cards`;   // (?cards: the list as a screen of its own — the one starting page, ui/startpage.ts, has tools/qa/startpage-look.cjs)

const report = { checks: [], errors: [], noise: 0 };
const noiseOf = {};   // per page LOAD (each boot prints the adapter's ~50 lines again)
const check = (ok, label, detail) => { report.checks.push({ ok: !!ok, label, detail }); console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
function watch(page, name) {
  let load = 0; page.on('framenavigated', f => { if (f === page.mainFrame()) load++; });
  page.on('console', m => { const t = m.type(), x = m.text(); if (t !== 'error') return; if (/Failed to load resource/.test(x)) return; const k = `${name}/${load}`;
    if (NOISE.test(x) && (noiseOf[k] ?? 0) < NOISE_MAX) { noiseOf[k] = (noiseOf[k] ?? 0) + 1; report.noise++; } else report.errors.push(`${name} console: ${x.slice(0, 400)}`); });
  page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) report.errors.push(`${name} http ${r.status()}: ${r.url()}`); });
  page.on('pageerror', x => report.errors.push(`${name} pageerror: ${String(x && x.stack || x).slice(0, 600)}`));
}
// in the page: what the list shows right now
const STATE = () => { const r = document.getElementById('missions'), rows = [...r.querySelectorAll('.mrow')], cv = r.querySelector('.mplan');
  let ink = 0; if (cv && cv.style.display !== 'none') { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) ink++; }
  return { on: r.classList.contains('on'), rows: rows.length, sel: rows.findIndex(a => a.classList.contains('sel')), ids: rows.map(a => a.dataset.mission), title: r.querySelector('.mst')?.textContent ?? null,
    hard: !!r.querySelector('.dbtn.on[data-difficulty=hard]'), href: r.querySelector('.mgo')?.getAttribute('href') ?? null, plan: cv ? cv.dataset.level : null, ink,
    fits: (() => { const c = r.querySelector('.mcard'); if (!c) return false; const b = c.getBoundingClientRect(); return b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight; })(),
    go: (() => { const b = r.querySelector('.mgo')?.getBoundingClientRect(), f = r.querySelector('.mfoot')?.getBoundingClientRect(), sh = r.querySelector('.msheet'); return !!b && !!f && b.height > 0 && b.bottom <= f.top + 0.5 && sh.scrollHeight <= sh.clientHeight + 1; })(),
    clipped: rows.filter(a => a.querySelector('.mtitle').scrollWidth > a.querySelector('.mtitle').clientWidth + 1).map(a => a.dataset.mission) }; };
const shot = (page, name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  // ───────────── boot → card: ONE page. While the renderer compiles the software adapter gives the page no frames (no still, no settled click — everything by evaluate);
  //               the stills and the real key presses come once the page is ready
  const cardPage = async () => { const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 }); watch(page, 'card');
    await page.goto(BASE + '?' + Q);
    await page.locator('#menu button', { hasText: 'Missions' }).waitFor({ state: 'attached', timeout: 30000 });
    const boot = await page.evaluate(() => { const ready = !!window.__engine, b = [...document.querySelectorAll('#menu button')].find(x => x.textContent === 'Missions'); b.click(); return { ready, disabled: b.disabled }; });
    let s = await page.evaluate(STATE);
    check(s.on && s.rows >= 13 && s.sel === 0, 'off the BOOT card (the page not ready yet): Missions is live and the list comes up with every row', `page ready: ${boot.ready} · ${s.rows} rows · highlighted ${s.sel} (${s.title})`);
    log('waiting for the page to be ready (about a minute and a half on the software adapter)');
    const ready = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return { fatal: document.getElementById('fatal')?.textContent || '', mode: window.__menu.mode }; });
    if (ready.fatal) report.errors.push('fatal: ' + ready.fatal);
    await page.waitForTimeout(400); s = await page.evaluate(STATE);
    check(ready.mode === 'start' && s.on && s.rows >= 13, 'the boot finishing under it leaves the list up (the real start card went up behind)', `menu '${ready.mode}' · list up: ${s.on}`);
    check(s.fits && s.clipped.length === 0, 'the card sits inside the window and no row title is cut', `fits ${s.fits} · cut titles: ${s.clipped.join(', ') || 'none'}`);
    await page.waitForFunction(() => { const c = document.querySelector('#missions .mplan'); return c && c.style.display !== 'none'; }, null, { timeout: 8000 }).catch(() => {});
    const noPlan = [], noGo = [];
    for (const id of s.ids) { await page.click(`#missions .mrow[data-mission="${id}"]`); await page.waitForTimeout(450); const t = await page.evaluate(STATE); await shot(page, `list-${String(t.sel + 1).padStart(2, '0')}-${id}`); if (!(t.ink > 500)) noPlan.push(`${id} (${t.plan}, ${t.ink} px)`); if (!t.go) noGo.push(id); }
    check(noGo.length === 0, 'on every mission the Start button is whole on the sheet with nothing to scroll', noGo.length ? `cut or scrolled: ${noGo.join(', ')}` : `${s.ids.length} of ${s.ids.length} at ${W}×${H}`);
    check(noPlan.length === 0, "every mission's sheet draws its level's floor plan (fetched off /levels/)", noPlan.length ? `blank: ${noPlan.join(' · ')}` : `${s.ids.length} of ${s.ids.length} drawn`);
    await page.click(`#missions .mrow[data-mission="${s.ids[0]}"]`);
    await page.keyboard.press('KeyS'); const a = (await page.evaluate(STATE)).sel; await page.keyboard.press('ArrowDown'); const b = (await page.evaluate(STATE)).sel; await page.keyboard.press('KeyW'); const c = (await page.evaluate(STATE)).sel;
    await page.keyboard.press('KeyD'); const hard = await page.evaluate(STATE); await page.keyboard.press('KeyA'); const std = await page.evaluate(STATE);
    check(a === 1 && b === 2 && c === 1 && hard.hard && /difficulty=hard/.test(hard.href) && !std.hard && !/difficulty=hard/.test(std.href), 'real keys: S and ↓ move down, W up; D puts the defenders on hard (on the link too), A back', `highlight ${a} ${b} ${c} · ${hard.href} · ${std.href}`);
    const still = await page.evaluate(() => ({ t: window.__game.time, x: window.__game.player.char.pos[0], z: window.__game.player.char.pos[2] }));
    await page.setViewportSize({ width: 640, height: 720 }); await page.waitForTimeout(400); const narrow = await page.evaluate(STATE); await shot(page, 'list-narrow'); await page.setViewportSize({ width: W, height: H }); await page.waitForTimeout(300);
    check(narrow.fits && narrow.go, 'at a 640 px window the card still fits (the list stacks over the sheet, the plan goes) and the Start button is whole on the sheet', `fits ${narrow.fits} · start button whole: ${narrow.go}`);
    const tabs = []; for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); tabs.push(await page.evaluate(() => { const a = document.activeElement; return a?.closest('#missions') ? (a.textContent || '').trim().toLowerCase() : a?.closest('#menu') ? `MENU:${a.textContent}` : a === document.body ? 'page' : a?.tagName ?? 'none'; })); }
    await page.focus('#missions .mback'); await page.keyboard.press('Enter'); await page.waitForTimeout(150); const viaBack = await page.evaluate(() => ({ list: document.getElementById('missions').classList.contains('on'), mode: window.__menu.mode, search: location.search }));
    check(tabs.some(t => /back/.test(t)) && tabs.some(t => t === 'hard') && tabs.every(t => /back|standard|hard|dawn|midday|grey day|dusk|night|as it is|clear|overcast|rain|downpour|fog|dust|start mission|loadout/.test(t)) && !viaBack.list && viaBack.mode === 'start', "Tab walks the list's own buttons round and round, never the card's under it nor out to the page; Enter on Back presses THAT button — back to the card, nothing started", `Tab ×6: ${tabs.join(' → ')} · ${JSON.stringify(viaBack)}`);
    await page.click('#menu button:has-text("Missions")'); await page.waitForSelector('#missions.on');
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    const afterEsc = await page.evaluate(() => ({ list: document.getElementById('missions').classList.contains('on'), mode: window.__menu.mode }));
    check(!afterEsc.list && afterEsc.mode === 'start', "Esc closes the LIST and the start card stays (main.ts's own Esc handler did not start the game under it)", JSON.stringify(afterEsc));
    await shot(page, 'start-card');
    const btns = await page.evaluate(() => [...document.querySelectorAll('#menu .actions button')].map(b => `${b.textContent}${b.disabled ? ' (disabled)' : ''}${b.classList.contains('primary') ? ' [primary]' : ''}`));
    check(btns[0] === 'Missions' && btns.includes('Start') && await page.evaluate(() => document.querySelectorAll('#menu .picks .prow').length > 0), 'the real start card: the short list\'s rows lead it (tools/qa/picks-look.cjs), Missions first among the buttons and not the primary one, Start beside it', btns.join(' · '));
    await page.click('#menu button:has-text("Missions")'); await page.waitForSelector('#missions.on');
    await page.click('#missions .mrow[data-mission="warehouse-four"]'); await page.waitForTimeout(450); await shot(page, 'list-over-start-card');
    const want = (await page.evaluate(STATE)).href;
    // (the loadout screen stands between the list and the load — ui/loadout.ts wireMissions: Space opens it, Enter there deploys the mission's own team = the row's own URL)
    await page.keyboard.press('Space'); await page.waitForSelector('#loadout', { timeout: 5000 });
    await Promise.all([page.waitForNavigation({ waitUntil: 'commit', timeout: 15000 }), page.keyboard.press('Enter')]);
    const landed = new URL(page.url()).search;
    check(landed === want && /levelFile=warehouse\.json&roomclear&squad4/.test(landed) && /quality=/.test(landed), "Space on The warehouse, then Enter on its loadout: the page loads that row's own URL, the visitor's flags kept", `${landed}`);
    await page.close(); };
  // ───────────── solo: ?solo is the plain night with no start card
  const soloPage = async () => { const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 }); watch(page, 'solo');
    await page.goto(BASE + '?solo&' + Q); log('solo: waiting for the page to be ready');
    const r = await page.evaluate(async () => { await window.__ready; const g = window.__game; return { mode: window.__menu.mode, card: document.getElementById('menu').classList.contains('on'), scenario: window.__scenarios.current()?.title ?? null, guards: g.guards.length, units: g.guards.filter(x => x.unit).length, stage: g.mission.stage }; });
    check(r.mode === 'closed' && !r.card && r.scenario === null && r.units === 0 && r.guards === 3, '?solo: the plain night, straight in — no start card, no scenario, the shift of three', JSON.stringify(r));
    await page.close(); };
  // ───────────── quit: 'Quit to scenarios' lands on the LIST — in place on the office, and across the page load a level file's scenario quits by
  const LIST_UP = () => ({ list: document.getElementById('missions').classList.contains('on'), rows: document.querySelectorAll('#missions .mrow').length, mode: window.__menu.mode, scenario: window.__scenarios.current()?.title ?? null, search: location.search });
  const quitPage = async (name, query, reloads) => { const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 }); watch(page, name);
    await page.goto(BASE + '?' + query + '&' + Q); log(`${name}: waiting for the page to be ready`);
    const before = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return { scenario: window.__scenarios.current()?.title ?? null, mode: window.__menu.mode }; });
    if (reloads) { await Promise.all([page.waitForNavigation({ waitUntil: 'commit', timeout: 15000 }), page.evaluate(() => { window.__scenarios.quit(); })]); log(`${name}: quit = a page load; waiting for it`); await page.waitForFunction(() => !!window.__ready, null, { timeout: 60000 }); await page.evaluate(async () => { await window.__ready; }); }
    else await page.evaluate(() => { window.__scenarios.quit(); });
    await page.waitForTimeout(300); const after = await page.evaluate(LIST_UP);
    check(before.scenario !== null && after.list && after.rows >= 13 && after.mode === 'start' && after.scenario === null && !/roomclear|squad4|levelFile/.test(after.search), `'Quit to scenarios' out of ${before.scenario}${reloads ? ' (a level file of its own: the quit is a page load)' : ''}: the mission list is up over the start card, the scenario's flags off the URL`, JSON.stringify(after));
    await page.close(); };
  const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, want = n => !ONLY || ONLY.includes(n);   // ONLY=card,solo,quit
  if (want('card')) await cardPage();
  if (want('solo')) await soloPage();
  if (want('quit')) { await quitPage('office', 'roomclear', false); await quitPage('depot', 'levelFile=depot.json&roomclear&squad4', true); }   // (one at a time: a page booting beside another gets no frames on the software adapter)
  await browser.close();
  report.errors.forEach(e => console.log('   >', e));
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
  const bad = report.checks.filter(c => !c.ok).length;
  console.log(bad || report.errors.length ? `=== missions-look: ${bad} FAIL, ${report.errors.length} page errors ===` : `=== missions-look: ${report.checks.length} checks PASS, no page errors (${report.noise} lines of the software adapter's smoke-pipeline noise passed over) ===`);
  process.exit(bad || report.errors.length ? 1 : 0);
})().catch(e => { console.error('SCRIPT ERROR', String(e && e.stack || e).slice(0, 800)); process.exit(2); });
