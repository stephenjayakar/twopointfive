// THE ONE STARTING PAGE LOOK (ui/startpage.ts): the page on the REAL build in headless Chromium:
// what is on it, that every mission is on it and goes through its loadout to Deploy, the keys through both halves, real page loads, and the switch off.
// The page's two steps: MISSION (the list, the briefing, the Setup rail of value rows) and TEAM & KIT (the loadout's rows); the rail's rows stand in for the list's own setting rows, which stay in the page unseen.
//   node tools/qa/startpage-look.cjs <outDir>      env: PORT (the dev server's, default 5199) · SIZE (default 1440x900) · QUALITY (default verylow) · ALL=1 (deploy EVERY mission) · STILLS=0 (no stills) · GPU=1 (see below)
// PASS / FAIL lines, stills beside a report.json, exit 1 on a FAIL or a page error.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const outDir = process.argv[2] || 'startpage-look';
const PORT = process.env.PORT || 5199;
const [W, H] = (process.env.SIZE || '1440x900').split('x').map(Number);
const QUALITY = process.env.QUALITY || 'verylow';
// GPU=1: the software WebGPU adapter under the page (SwiftShader) — the renderer really boots, and every page load then waits minutes for its shaders. The
// default is NO adapter at all: the boot stops at 'No WebGPU adapter', its error panel is hidden, and what is left is exactly what these checks are about —
// the start card, the list and the loadout are plain DOM that is live from the first tick, and a deploy is a page load.
const GPU = process.env.GPU === '1';
const FLAGS = GPU ? ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'] : ['--disable-gpu'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
const T0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
fs.mkdirSync(outDir, { recursive: true });
const BASE = `http://localhost:${PORT}/`, Q = `paused&quality=${QUALITY}&mute`;
const report = { checks: [], errors: [] };
const check = (ok, label, detail) => { report.checks.push({ ok: !!ok, label, detail }); console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
function watch(page) {
  page.on('pageerror', e => { if (!GPU && /WebGPU|adapter/i.test(String(e))) return; report.errors.push(String(e).slice(0, 300)); log('PAGE ERROR', String(e).slice(0, 300)); });
  page.on('console', m => { if (m.type() !== 'error') return; const t = m.text(); if (NOISE.test(t) || /Failed to load resource|Failed to fetch/.test(t) || (!GPU && /WebGPU|adapter/i.test(t))) return; /* (a fetch cut off by the next page load is not a fault) */ report.errors.push(t.slice(0, 300)); log('console error', t.slice(0, 300)); });
}
const shot = (page, name, ms = 30000) => page.screenshot({ path: path.join(outDir, name), timeout: ms }).then(() => true, e => { log('no still', name, String(e).split('\n')[0].slice(0, 120)); return false; });
const query = u => [...new URLSearchParams(String(u).replace(/^[^?]*\?/, ''))].map(([k, v]) => v ? `${k}=${v}` : k);
// what the page shows right now
const stateOf = page => page.evaluate(() => {
  const R = document.getElementById('missions'), L = R?.querySelector('#loadout'), dep = L?.querySelector('[data-act="deploy"]'), r = dep?.getBoundingClientRect();
  const vis = e => { if (!e) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).display !== 'none'; };
  return { up: !!R && R.classList.contains('on') && R.classList.contains('one'), pane: R?.classList.contains('pane-loadout') ? 'loadout' : R?.classList.contains('pane-list') ? 'list' : 'none',
    heads: [...(R?.querySelectorAll('.msec') ?? [])].map(h => h.textContent), rows: [...(R?.querySelectorAll('.mrow') ?? [])].map(a => a.getAttribute('data-mission')),
    // (the groups fold: which heading is open, what number each shows, which rows are drawn, and every row's heading)
    open: [...(R?.querySelectorAll('.msec.open') ?? [])].map(h => h.textContent), counts: [...(R?.querySelectorAll('.msec') ?? [])].map(h => { const c = getComputedStyle(h, '::after').content; return vis(h) ? Number(String(c).replace(/"/g, '')) : -1; }),
    shown: [...(R?.querySelectorAll('.mrow') ?? [])].filter(vis).map(a => a.getAttribute('data-mission')), under: Object.fromEntries([...(R?.querySelectorAll('.mrow') ?? [])].map(a => { let g = a.getAttribute('data-group'); if (g == null) { let e = a; while (e && !e.classList.contains('msec')) e = e.previousElementSibling; g = e?.textContent ?? ''; } return [a.getAttribute('data-mission'), g]; })),   // (a row names its group; the list before the groups had its heading as an earlier sibling)
    sel: R?.querySelector('.mrow.sel')?.getAttribute('data-mission') ?? null, title: R?.querySelector('.mst')?.textContent ?? '', tip: R?.querySelector('.mtip')?.textContent ?? '',
    hour: R?.querySelector('[data-hour].on, [data-hour].sel, [data-hour][aria-pressed="true"]')?.getAttribute('data-hour') ?? null,
    loadout: L ? { title: L.querySelector('.lo-title')?.textContent ?? '', inSheet: !!L.closest('.msheet'), kits: [...L.querySelectorAll('[data-row="squadkit"] [data-kit]')].map(b => b.textContent), deploy: dep?.textContent ?? '',
      deployInView: !!r && r.top >= 0 && r.bottom <= innerHeight && r.width > 0, backShown: vis(L.querySelector('[data-act="back"]')),
      // (the foot bar's filled block: which button carries the accent fill, and whether the page's own 'Team & kit' button is drawn)
      kitShown: vis(L.querySelector('[data-act="kit"]')), kitWords: L.querySelector('[data-act="kit"]')?.textContent ?? '', filled: [...L.querySelectorAll('.lo-actions button')].filter(b => vis(b) && !/rgba\(0, 0, 0, 0\)|transparent/.test(getComputedStyle(b).backgroundColor)).map(b => b.getAttribute('data-act')), headShown: vis(L.querySelector('.lo-head')) } : null,
    goShown: vis(R?.querySelector('.mgo')), menuInert: document.getElementById('menu')?.hasAttribute('inert') ?? false };
});
const cardOf = page => page.evaluate(() => ({ buttons: [...document.querySelectorAll('#menu .actions button')].map(b => b.textContent), picks: document.querySelectorAll('#menu .picks .prow').length,
  focus: document.activeElement?.textContent?.slice(0, 20) ?? '' }));

(async () => {
  const browser = await chromium.launch({ headless: true, args: FLAGS });
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  if (!GPU) await ctx.addInitScript(() => { addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#fatal { display: none !important; }'; document.head.appendChild(s); }); });
  const page = await ctx.newPage(); watch(page);
  // a DEPLOY is a page load of another URL. What that URL boots is tools/qa/picks-probes.ts picks-boot's to say; here the load is answered with an empty page,
  // so the software adapter is not left compiling a mission's shaders under the next check (minutes each)
  let stub = false;
  await page.route('**/*', r => (stub && r.request().isNavigationRequest() && r.request().resourceType() === 'document' ? r.fulfill({ contentType: 'text/html', body: '<title>deployed</title>' }) : r.continue()));
  const boot = async (q = Q) => { stub = false; await page.goto(BASE + '?' + q, { waitUntil: 'domcontentloaded', timeout: 180000 }); await page.waitForSelector('#menu .actions button', { timeout: 60000 }); await page.waitForTimeout(500); };
  const open = async (q = Q) => { await boot(q); await page.click('#menu .actions button.primary'); await page.waitForSelector('#missions.one.on', { timeout: 20000 }); await page.waitForTimeout(500); };
  // a click on a mission's row: back to the Mission step first where the page is on Team & kit (the list is not drawn there), then its group's
  // heading where the group is folded shut (a real click each)
  const goRow = async (id, opt) => { const sel = `#missions .mrow[data-mission="${id}"]`;
    const away = await page.evaluate(() => { const l = document.querySelector('#missions .mgrid, #missions .mlist'); return !!l && l.getClientRects().length === 0; });
    if (away) { await page.click('#missions .mstep[data-step="list"]'); await page.waitForTimeout(200); }
    const head = await page.evaluate(q => { const e = document.querySelector(q); return e && e.classList.contains('shut') ? e.getAttribute('data-group') : null; }, sel);
    if (head) { await page.click(`#missions .msec[data-head="${head}"]`); await page.waitForTimeout(150); }
    await page.click(sel, opt); };
  const deployed = () => { const before = page.url(); stub = true; return page.waitForURL(u => String(u) !== before, { timeout: 60000 }); };   // (a deploy is a page load of another URL)
  await boot();

  // ---- the card under the page: one button to it
  const card = await cardOf(page);
  check(card.buttons[0] === 'Play ›' && !card.buttons.includes('Start') && !card.buttons.includes('Missions') && card.picks === 0, "the card has ONE way in: 'Play ›' (no short list of its own, no Missions, no Start)", `buttons: ${card.buttons.join(' | ')} · short-list rows on the card ${card.picks}`);
 

  // ---- the page: everything on it
  await page.click('#menu .actions button.primary'); await page.waitForSelector('#missions.one.on', { timeout: 20000 }); await page.waitForTimeout(500);
  const s0 = await stateOf(page);
  const first = ['compound-four', 'rescue-registry', 'warehouse-four', 'depot-four', 'barracks-four', 'solo-night'];
  const GROUPS = ['Tutorial', 'Raids', 'Strongholds', 'On the clock', 'Quiet, alone', 'Quiet, as two'], inGroup = (s, h) => s.rows.filter(id => s.under[id] === h);
  check(s0.up && s0.heads.join('|') === GROUPS.join('|') && s0.rows.length > first.length && new Set(s0.rows).size === s0.rows.length && s0.rows.every(id => GROUPS.includes(s0.under[id]))
    && GROUPS.every((h, k) => s0.counts[k] === inGroup(s0, h).length && s0.counts[k] >= 1 && s0.counts[k] <= 8) && GROUPS.every(h => { const g = inGroup(s0, h), p = first.filter(id => g.includes(id)); return p.every((id, i) => g[i] === id); }),
    'the page lists every mission once, each under one of six headings that are all drawn with how many they hold (eight at most); inside a group the short list\'s missions come first, in play order', `${s0.heads.map((h, k) => `${h} ${s0.counts[k]}`).join(' / ')} · ${s0.rows.length} rows: ${s0.rows.join(', ')}`);
  check(s0.sel === first[0] && s0.open.join() === s0.under[first[0]] && s0.shown.join() === inGroup(s0, s0.under[first[0]]).join(), 'a fresh visit opens on the short list\'s first mission, and only ITS group shows its rows', `on ${s0.sel} · open '${s0.open.join()}' · drawn: ${s0.shown.join(', ')}`);
  check(!!s0.loadout && s0.loadout.inSheet && s0.loadout.title === s0.title && s0.loadout.kits.some(k => /wall charge/i.test(k)) && s0.loadout.deployInView && !s0.loadout.backShown && !s0.goShown && s0.pane === 'list',
    "the highlighted mission's LOADOUT is mounted on the same page (its Squad kit row, with 'One wall charge', waits in the Team & kit step), and Deploy is in view without scrolling", s0.loadout ? `'${s0.title}' · squad kit: ${s0.loadout.kits.join(' | ') || 'no row'} · '${s0.loadout.deploy}' in view ${s0.loadout.deployInView} · tip: ${s0.tip.slice(0, 60)}` : 'no loadout on the page');

  // ---- the filled block leads on: 'Team & kit' on the Mission step (Deploy a quiet word beside it), Deploy on the Team & kit step; a lesson (no kit to pick) has Deploy on both
  { const urlK = page.url(); await page.click('#missions #loadout [data-act="kit"]'); await page.waitForTimeout(250); const k1 = await stateOf(page);
    await page.click('#missions .mstep[data-step="list"]'); await page.waitForTimeout(250); const k2 = await stateOf(page);
    const lesson = s0.rows.find(r => /^train-/.test(r)) ?? s0.rows.find(r => r === 'tut-sky'); let k3 = null;   // (the Training lessons are out: the first tutorial mission is the one played with the kit as issued)
    if (lesson) { await goRow(lesson); await page.waitForTimeout(300); k3 = await stateOf(page); await goRow(s0.sel); await page.waitForTimeout(300); }
    const k4 = await stateOf(page);
    check(s0.loadout?.kitShown && s0.loadout.filled.join() === 'kit' && k1.pane === 'loadout' && !k1.loadout.kitShown && k1.loadout.filled.join() === 'deploy' && k1.loadout.deployInView && k2.pane === 'list' && k2.loadout.filled.join() === 'kit'
      && (!k3 || (k3.sel === lesson && !k3.loadout.kitShown && k3.loadout.filled.join() === 'deploy')) && k4.sel === s0.sel && k4.pane === 'list' && k4.loadout.filled.join() === 'kit' && page.url() === urlK,
      "the one filled button on the Mission step is 'Team & kit' and a click on it is the Team & kit step, where the filled button is Deploy; a lesson, with no kit to pick, has Deploy filled on the Mission step; nothing loads",
      `mission step: '${s0.loadout?.kitWords}' shown ${s0.loadout?.kitShown}, filled [${s0.loadout?.filled}] · after the click: pane ${k1.pane}, filled [${k1.loadout?.filled}] · back: [${k2.loadout?.filled}] · ${lesson ?? 'no lesson row'}: ${k3 ? `kit button ${k3.loadout.kitShown}, filled [${k3.loadout.filled}]` : '-'} · back on ${k4.sel}: [${k4.loadout?.filled}]`); }

  // ---- the keys: S walks the rows and the loadout follows; Enter steps into it; Esc steps back; Enter Enter deploys
  const url0 = page.url();
  await page.keyboard.press('s'); await page.waitForTimeout(200); const s1 = await stateOf(page);
  check(s1.sel === s0.rows[s0.rows.indexOf(s0.sel) + 1] && s1.loadout?.title === s1.title && s1.title !== s0.title && page.url() === url0, 'S moves to the next mission and the loadout under it is THAT mission\'s; nothing loads', `${s0.sel} → ${s1.sel} · loadout '${s1.loadout?.title}'`);
  await page.keyboard.press('Enter'); await page.waitForTimeout(250); const s2 = await stateOf(page);
 
  await page.keyboard.press('s'); await page.waitForTimeout(150); const s2b = await stateOf(page);
  check(s2.pane === 'loadout' && s2b.sel === s1.sel && page.url() === url0, 'Enter steps INTO the loadout (nothing loads); W S there move its rows, not the mission', `pane ${s2.pane} · mission after S ${s2b.sel}`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200); const s3 = await stateOf(page);
  check(s3.up && s3.pane === 'list' && s3.sel === s1.sel && !!s3.loadout, 'Esc steps back to the missions with the same one highlighted and its loadout still there', `pane ${s3.pane} · ${s3.sel}`);
  await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  await Promise.all([deployed(), page.keyboard.press('Enter')]);
  const u1 = query(page.url());
  check(u1.includes('pick=warehouse') && u1.includes('difficulty=standard'), 'Enter, Enter from a short-list row is in the game: ONE page load of that row\'s own URL (so its \'next\' and \'played\' still work)', new URL(page.url()).search);

  // ---- the groups fold: the keys walk every row and cross into the next group, which opens; a click on a heading is its first row
  await open(); const g0 = await stateOf(page), gi = g0.rows.indexOf(g0.sel), gEnd = g0.rows.lastIndexOf(g0.shown[g0.shown.length - 1]);
  for (let k = gi; k <= gEnd; k++) { await page.keyboard.press('s'); await page.waitForTimeout(80); } await page.waitForTimeout(150); const g1 = await stateOf(page);
  await page.keyboard.press('w'); await page.waitForTimeout(200); const g2 = await stateOf(page);
  check(g1.sel === g0.rows[gEnd + 1] && g1.open.join() === g1.under[g1.sel] && g1.open.join() !== g0.open.join() && g1.shown.join() === inGroup(g1, g1.open[0]).join() && g1.heads.join() === g0.heads.join()
    && g2.sel === g0.rows[gEnd] && g2.open.join() === g0.open.join() && g2.shown.join() === g0.shown.join(),
    'S off the last row of a group is the first row of the next, which opens as the one left folds (every heading still drawn); W goes back the same way', `${g0.sel} '${g0.open}' → S × ${gEnd - gi + 1} → ${g1.sel} '${g1.open}' (${g1.shown.length} rows drawn) → W → ${g2.sel} '${g2.open}'`);
  await page.click('#missions .msec[data-head="Quiet, as two"]'); await page.waitForTimeout(200); const g3 = await stateOf(page);
  await page.click('#missions .msec[data-head="Tutorial"]'); await page.waitForTimeout(200); const g4 = await stateOf(page);
  check(g3.open.join() === 'Quiet, as two' && g3.sel === inGroup(g3, 'Quiet, as two')[0] && g3.shown.join() === inGroup(g3, 'Quiet, as two').join() && g3.loadout?.title === g3.title && g4.open.join() === 'Tutorial' && g4.sel === inGroup(g4, 'Tutorial')[0] && g4.pane === 'list',
    'a click on a heading puts the cursor on that group\'s first row: the group opens, its mission is the one on the sheet', `'Quiet, as two' → ${g3.sel} ('${g3.title}') · 'Tutorial' → ${g4.sel}`);
  // (the groups as tiles, their missions as cards: every card of the open group is whole inside the grid, each has its picture, and no title or heading is cut short)
  const room = await page.evaluate(() => { const R = document.getElementById('missions'), G = R.querySelector('.mgrid'), gb = G.getBoundingClientRect(), cards = [...G.querySelectorAll('.mrow:not(.shut)')];
    return { n: cards.length, out: cards.filter(c => { const b = c.getBoundingClientRect(); return b.top < gb.top - 0.5 || b.bottom > gb.bottom + 0.5 || b.left < gb.left - 0.5 || b.right > gb.right + 0.5; }).map(c => c.getAttribute('data-mission')),
      bare: cards.filter(c => { const v = c.querySelector('canvas.mthumb'), b = v?.getBoundingClientRect(); return !v || b.width < 80 || b.height < 50; }).map(c => c.getAttribute('data-mission')),
      tiles: [...R.querySelectorAll('.mgroups .msec')].filter(h => { const v = h.querySelector('canvas'), b = v?.getBoundingClientRect(); return !v || b.width < 60 || b.height < 30; }).map(h => h.textContent),
      cut: [...R.querySelectorAll('.mrow:not(.shut) .mtitle, .msec .mgname')].filter(e => e.scrollWidth > e.clientWidth + 0.5).map(e => e.textContent) }; });
  check(room.n >= 1 && !room.out.length && !room.bare.length && !room.tiles.length && !room.cut.length, 'the open group\'s missions are cards, each whole inside the grid with its picture; every group is a picture tile; no title or heading is cut short',
    `${room.n} cards · outside the grid: ${room.out.join(', ') || 'none'} · no picture: ${room.bare.join(', ') || 'none'} · tiles with no picture: ${room.tiles.join(', ') || 'none'} · cut: ${room.cut.join(', ') || 'none'}`);
  // ---- ?nogroups: the list as it was before the groups — the short list on top with no heading, every other mission under one, nothing folded
  await open(Q + '&nogroups'); const ng = await stateOf(page);
  check(ng.heads.join() === 'Every other mission' && first.slice(0, 6).every((id, i) => ng.rows[i] === id) && ng.shown.length === ng.rows.length && ng.rows.length === s0.rows.length,
    '?nogroups: the short list on top in play order with no heading over it, every other mission under one heading, every row drawn', `${ng.heads.join(' / ')} · ${ng.shown.length} of ${ng.rows.length} drawn · on ${ng.sel}`);

  // ---- the mouse: a click on a squad kit, then the Deploy button
  await open(); await page.waitForTimeout(300);
  await page.click('#missions .mrail .mteam'); await page.waitForTimeout(200); const s4a = await stateOf(page);
  await page.click('#missions [data-row="squadkit"] [data-kit]:nth-of-type(2)', { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(200);
  const s4 = await stateOf(page); const kit = await page.evaluate(() => localStorage.getItem('twopointsix.kit'));
 
  await Promise.all([deployed(), page.click('#missions #loadout [data-act="deploy"]')]);
  check(s4a.pane === 'loadout' && s4.pane === 'loadout' && !!kit && query(page.url()).some(k => /^pick=/.test(k)), "a click on the rail's 'Team & kit' row is the Team & kit step; a click on 'One wall charge' there picks it and the Deploy button starts the mission", `pane ${s4a.pane}, ${s4.pane} · kit saved ${kit ? kit.length + ' B' : 'no'} · ${new URL(page.url()).search}`);

  // ---- hard, and a row with an hour of its own
  await open();
  await page.keyboard.press('d'); await page.waitForTimeout(200);
  await page.keyboard.press('Enter'); await page.waitForTimeout(500); await Promise.all([deployed(), page.keyboard.press('Enter')]);
  check(query(page.url()).includes('difficulty=hard'), 'D on the missions sets Defenders to hard and the deploy carries it', new URL(page.url()).search);
  // a MOUSE click on the rail's Difficulty row, then the keys: Enter is the page's (into the team step, then Deploy), not that row again; reached with Tab the row keeps its Enter
  await open();
  const diffRow = '#missions .mrail .mval:not(.lever):not(.mteam):not([hidden])';   // (the rail's first row: Difficulty. A click steps it on, as a click on the list's own Hard button did)
  const valOf = () => page.evaluate(q => (document.querySelector(q)?.querySelector('b')?.textContent ?? '').toLowerCase(), diffRow);
  const shown0 = await valOf(); await page.click(diffRow); await page.waitForTimeout(200);
  const shown = await valOf();
  await page.keyboard.press('Enter'); await page.waitForTimeout(400); const sM = await stateOf(page);
  const uM = await Promise.all([deployed(), page.keyboard.press('Enter')]).then(() => query(page.url()), () => []);
  await open();
  const shownT0 = await valOf(); await page.focus(diffRow); await page.keyboard.press('Enter'); await page.waitForTimeout(300); const sT = await stateOf(page);
  const shownT = await valOf();
  check(/^(standard|hard)$/.test(shown) && shown !== shown0 && sM.pane === 'loadout' && uM.includes('difficulty=' + shown) && sT.pane === 'list' && shownT !== shownT0, "a mouse click on the rail's Difficulty row steps it (standard, hard), and Enter Enter then deploys what it reads (the clicked row does not keep the Enter); focused with Tab, Enter is still that row's", `the click: '${shown0}' → '${shown}', pane ${sM.pane}, deploy ${uM.join('&') || 'no load'} · focused: pane ${sT.pane}, '${shownT0}' → '${shownT}'`);
  await open();
  await goRow('barracks-four'); await page.waitForTimeout(300);
  const s5 = await stateOf(page);
  await page.keyboard.press('Enter'); await page.waitForTimeout(500); await Promise.all([deployed(), page.keyboard.press('Enter')]);
  const u5 = query(page.url());
  check(s5.sel === 'barracks-four' && u5.includes('hour=midday') && u5.includes('pick=barracks-day'), 'the barracks row shows at its own hour (midday) and deploys as the short list\'s row', `${new URL(page.url()).search}`);

  // ---- a weather of the player's own on a short-list row: Deploy carries it (and the row's hour) — it is then the mission's own link, no longer the short list's row
  await open();
  await goRow('barracks-four'); await page.waitForTimeout(300);
  await page.keyboard.press('j'); await page.waitForTimeout(300);
  await page.keyboard.press('Enter'); await page.waitForTimeout(500); await Promise.all([deployed(), page.keyboard.press('Enter')]);
  const u5w = query(page.url());
  check(u5w.some(k => /^weather=/.test(k)) && u5w.includes('hour=midday') && u5w.some(k => /^levelFile=barracks/.test(k)) && !u5w.some(k => /^pick=/.test(k)), 'J on a short-list row: the deploy carries that weather and the row\'s hour, as the mission\'s own link (no pick=)', new URL(page.url()).search);

  // ---- a mission with NO KIT STEP (played with the kit as issued: the first tutorial mission): nothing on the page leads to an empty TEAM & KIT — the
  //      head names one step, the rail has no team row, the key line says what Enter does, and Enter on its row is in the game
  //      ("hitting enter (rather than clicking deploy) goes to an empty loadout screen rather than starting")
  await open();
  if (!(await stateOf(page)).rows.includes('tut-sky')) check(false, 'the first tutorial mission is a row of the page', 'no row tut-sky');
  else {
    await goRow('tut-sky'); await page.waitForTimeout(300);
    const look = () => page.evaluate(() => { const R = document.getElementById('missions'), vis = e => { if (!e) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).display !== 'none'; };
      return { nokit: R.classList.contains('nokit'), pane: R.classList.contains('pane-loadout') ? 'loadout' : 'list', what: R.querySelector('[data-row="actions"]')?.getAttribute('data-what') ?? '', step: vis(R.querySelector('.mstep[data-step="loadout"]')), team: vis(R.querySelector('.mteam')) }; });
    const n0 = await look(), before = page.url();
    const went = await Promise.all([deployed(), page.keyboard.press('Enter')]).then(() => true, () => false), un = query(page.url()), n1 = went ? null : await look();
    check(n0.nokit && n0.pane === 'list' && /Enter deploy/.test(n0.what) && !/team and kit/.test(n0.what) && !n0.step && !n0.team && went && un.includes('levelFile=tut-sky.json'),
      'a mission with no kit to pick: its key line says Enter deploys, the head and the rail name no second step, and Enter on its row is ONE page load into the mission',
      `nokit ${n0.nokit} · '${n0.what}' · step shown ${n0.step} · team row shown ${n0.team} · Enter: ${went ? new URL(page.url()).search : `no load (pane ${n1.pane}, ${before === page.url() ? 'same page' : 'moved'})`}`);
    // …a mission WITH a kit still steps into it, and the link that opens a mission on its kit (?loadout=) opens this one on its rows
    await open(); await goRow('compound-four'); await page.waitForTimeout(200); await page.keyboard.press('Enter'); await page.waitForTimeout(300); const m0 = await look();
    await boot(Q + '&loadout=tut-sky'); await page.waitForTimeout(300); const m1 = await look(), sm = await stateOf(page);
    check(m0.pane === 'loadout' && !m0.nokit && /Enter deploy/.test(m0.what) && sm.up && sm.sel === 'tut-sky' && m1.pane === 'list' && m1.nokit,
      'a mission WITH a kit still steps into it on Enter; ?loadout= on the tutorial\'s mission opens on its rows, never on an empty kit', `compound: pane ${m0.pane} · ?loadout=tut-sky: up ${sm.up}, ${sm.sel}, pane ${m1.pane}, nokit ${m1.nokit}`);
  }

  // ---- a mission that is not on the short list: its own link, through the same loadout
  await open();
  const other = s0.rows.find(id => !first.includes(id) && s0.under[id] !== 'Tutorial') ?? s0.rows[s0.rows.length - 1];
  await goRow(other); await page.waitForTimeout(300); const s6 = await stateOf(page);
 
  await page.keyboard.press('Enter'); await page.waitForTimeout(500); await Promise.all([deployed(), page.keyboard.press('Enter')]);
  check(s6.sel === other && s6.loadout?.title === s6.title && !query(page.url()).some(k => /^pick=/.test(k)), 'a mission off the short list is on the same page, with its loadout, and deploys by its own link', `${other}: '${s6.title}' → ${new URL(page.url()).search}`);

  // ---- every mission through its loadout to a page load (ALL=1)
  if (process.env.ALL) {
    const bad = [];
    for (const id of s0.rows) { await open(); await goRow(id); await page.waitForTimeout(300); const st = await stateOf(page);
      await page.keyboard.press('Enter'); await page.waitForTimeout(500);
      const ok = await Promise.all([deployed(), page.keyboard.press('Enter')]).then(() => true, () => false);
      log(id, ok ? new URL(page.url()).search : 'NO LOAD'); if (!ok || !st.loadout || !st.loadout.deployInView) bad.push(id); }
    check(bad.length === 0, `every one of the ${s0.rows.length} missions: highlighted, its loadout on the page with Deploy in view, Enter Enter loads it`, bad.length ? `failed: ${bad.join(', ')}` : 'all loaded');
  }

  // ---- Esc on the missions: the card behind (controls, sandbox), and the button brings the page back
  await open(); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  const s7 = await stateOf(page), c7 = await cardOf(page);
  await page.keyboard.press('Enter'); await page.waitForTimeout(400); const s8 = await stateOf(page);
  check(!s7.up && c7.buttons[0] === 'Play ›' && s8.up, "Esc on the missions is the card behind, the focus on 'Play ›'; Enter there is the page again", `page up ${s7.up} → focus '${c7.focus}' → page up ${s8.up}`);

  // ---- ?loadout=<mission>: the page on that mission, the keys in its loadout
  await boot(Q + '&loadout=depot-four&squad=2'); await page.waitForTimeout(300); const s9 = await stateOf(page);
  check(s9.up && s9.sel === 'depot-four' && s9.pane === 'loadout', '?loadout=depot-four opens the page on that mission with the keys in its loadout', `up ${s9.up} · ${s9.sel} · pane ${s9.pane}`);

  // ---- not under ?paused: a plain visit opens on the TITLE (Play, Options, Controls), and the page comes up by itself only when a mission was quit by a page load
  stub = false; await page.goto(BASE + `?quality=${QUALITY}&mute`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForSelector('#menu .actions button', { timeout: 60000 }); await page.waitForTimeout(1500);
  const title = await page.evaluate(() => ({ page: document.getElementById('missions')?.classList.contains('on') ?? false, title: document.getElementById('menu').classList.contains('title'), btns: [...document.querySelectorAll('#menu .actions button')].map(b => b.textContent) }));
  check(!title.page && title.title && title.btns[0] === 'Play ›' && title.btns.includes('Options') && title.btns.includes('Controls'), 'a plain visit (no ?paused) opens on the title screen: Play, Options, Controls, the page not up yet', `page up ${title.page} · title ${title.title} · ${title.btns.join(' | ')}`);
  await page.evaluate(() => sessionStorage.setItem('twopointsix.missions.reopen', '1')); await page.goto(BASE + `?quality=${QUALITY}&mute`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const auto = await page.waitForSelector('#missions.one.on', { timeout: 30000 }).then(() => true, () => false);
  const once = await page.evaluate(() => sessionStorage.getItem('twopointsix.missions.reopen'));
  check(auto && once === null, 'a visit that follows a mission quit by a page load opens on the page by itself, once', `page up ${auto} · flag left ${once}`);

  // ---- a smaller window: Deploy still in view
  await page.setViewportSize({ width: 1280, height: 720 }); await open(); const sS = await stateOf(page);
  check(!!sS.loadout?.deployInView, 'at 1280 x 720 Deploy is still in view without scrolling', `in view ${sS.loadout?.deployInView}`);
  await page.setViewportSize({ width: W, height: H });

  // ---- the switch off: ?cards
  await boot(Q + '&cards'); const cc = await cardOf(page);
  await page.click('#menu .actions button:has-text("Missions")'); await page.waitForTimeout(300);
  const off = await page.evaluate(() => ({ list: document.getElementById('missions')?.classList.contains('on'), one: document.getElementById('missions')?.classList.contains('one'), lo: !!document.getElementById('loadout') }));
  check(cc.picks >= 5 && cc.buttons.includes('Missions') && cc.buttons.includes('Start') && off.list && !off.one && !off.lo, '?cards: the start card with its short list, Missions and Start, and the list as a screen of its own, as it was', `rows ${cc.picks} · ${cc.buttons.join(' | ')} · list ${off.list} one ${off.one} loadout ${off.lo}`);

  // ---- a narrow window, the squad line at its longest ('One wall charge' picked): nothing on the sheet runs off its right edge
  await boot(); await page.click('#menu .actions button.primary'); await page.waitForSelector('#missions.one.on', { timeout: 20000 });
  await goRow('compound-four'); await page.waitForTimeout(300);
  const listFits = async w => { await page.setViewportSize({ width: w, height: H }); await page.waitForTimeout(300);
    return page.evaluate(() => { const sh = document.querySelector('#missions .msheet'), r = sh.getBoundingClientRect();
      return { over: [...sh.querySelectorAll('.mrail > *, .mbrief > *, .lo-actions > *')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > r.right + 0.5; }).map(e => e.className),
        cut: [...sh.querySelectorAll('.mrail .mval b')].filter(e => e.scrollWidth > e.clientWidth + 0.5).map(e => e.textContent), wide: sh.scrollWidth - sh.clientWidth }; }); };
  const l1 = await listFits(1000), l2 = await listFits(1120); await page.setViewportSize({ width: W, height: H });
  check(!l1.over.length && l1.wide <= 0 && !l1.cut.length && !l2.over.length && l2.wide <= 0 && !l2.cut.length, 'at 1000 and 1120 px wide the Mission step fits: the briefing, the Setup rail and the Deploy bar inside the sheet, no value cut short', `1000: ${l1.over.join(', ') || 'all inside'} (${l1.wide}), cut: ${l1.cut.join(', ') || 'none'} · 1120: ${l2.over.join(', ') || 'all inside'} (${l2.wide}), cut: ${l2.cut.join(', ') || 'none'}`);
  await page.click('#missions .mrail .mteam'); await page.waitForTimeout(200);
  await page.click('#missions [data-row="squadkit"] [data-kit]:nth-of-type(2)', { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(300);
  const fits = async w => { await page.setViewportSize({ width: w, height: H }); await page.waitForTimeout(300);
    return page.evaluate(() => { const sh = document.querySelector('#missions .msheet'), r = sh.getBoundingClientRect();
      const over = [...sh.querySelectorAll('.lo-noteline > *, .lo-slots > *, .lo-kits > *, .mfacts > *, .lo-actions > *')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > r.right + 0.5; }).map(e => e.className);
      const cut = [...sh.querySelectorAll('.lo-slot.in .lo-name')].filter(e => e.scrollWidth > e.clientWidth + 0.5).map(e => e.textContent);   // (a name the tab cuts short: 'Red O…')
      const two = [...sh.querySelectorAll('.lo-slot.in .lo-name')].filter(e => e.getBoundingClientRect().height > parseFloat(getComputedStyle(e).fontSize) * 1.9).map(e => e.textContent);   // (a name on two lines: its second word can sit under the pinned Deploy bar, and the tabs then read 'Red, Red, Blue, Blue')
      return { over, cut, two, wide: sh.scrollWidth - sh.clientWidth, pool: sh.querySelector('.lo-pool')?.textContent ?? '' }; }); };
  const n1 = await fits(1000), n2 = await fits(1120); await page.setViewportSize({ width: W, height: H });
  check(/wall charge/.test(n1.pool) && !n1.over.length && n1.wide <= 0 && !n1.cut.length && !n1.two.length && !n2.over.length && n2.wide <= 0 && !n2.cut.length && !n2.two.length, "at 1000 and 1120 px wide nothing on the sheet runs off its right edge and every team tab has its whole name on one line, 'One wall charge' picked", `1000: ${n1.over.join(', ') || 'all inside'} (sheet ${n1.wide} px too wide), names cut: ${n1.cut.join(', ') || 'none'}, on two lines: ${n1.two.join(', ') || 'none'} · 1120: ${n2.over.join(', ') || 'all inside'} (${n2.wide}), names cut: ${n2.cut.join(', ') || 'none'}, on two lines: ${n2.two.join(', ') || 'none'} · '${n1.pool}'`);

  // ---- the stills, last and on ONE boot (the software adapter holds every frame until its shaders are compiled: minutes after each page load)
  if (process.env.STILLS !== '0') {
    await boot(); log('stills: waiting for the first frame…');
    let up = false; for (let k = 0; k < 12 && !up; k++) up = await shot(page, 'card.png', 60000);
    if (up) {
      await page.click('#menu .actions button.primary'); await page.waitForSelector('#missions.one.on', { timeout: 20000 }); await goRow('compound-four'); await page.waitForTimeout(400); await shot(page, 'page.png');
      await page.keyboard.press('Enter'); await page.waitForTimeout(300); await shot(page, 'page-in-loadout.png');
      await page.click('#missions [data-row="squadkit"] [data-kit]:nth-of-type(2)', { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(300); await shot(page, 'page-wall-charge.png');
      await goRow('barracks-four'); await page.waitForTimeout(400); await shot(page, 'page-barracks.png');
      await goRow(other); await page.waitForTimeout(400); await shot(page, 'page-other-mission.png');
      await goRow('solo-night').catch(() => {}); await page.waitForTimeout(400); await shot(page, 'page-solo.png');
      await page.setViewportSize({ width: 1280, height: 720 }); await goRow('compound-four'); await page.waitForTimeout(500); await shot(page, 'page-1280x720.png');
      await page.keyboard.press('Enter'); await page.setViewportSize({ width: 1000, height: 800 }); await page.waitForTimeout(500); await shot(page, 'page-1000x800.png');
      await page.setViewportSize({ width: W, height: H });
    }
    log('stills:', up ? fs.readdirSync(outDir).filter(f => f.endsWith('.png')).join(' ') : 'the first frame never came');
  }
  check(report.errors.length === 0, 'no page error and no console error on any of the pages', report.errors.join(' | ') || 'none');
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
  await browser.close();
  const bad = report.checks.filter(c => !c.ok).length; console.log(bad ? `=== startpage-look: ${bad} FAIL ===` : '=== startpage-look: ALL PASS ===');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
