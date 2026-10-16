// PICKS → LOADOUT LOOK: the short list's rows opening the loadout screen first (scene/picks.ts PICKS_UI.loadout, ui/picks.ts pickLoadout) on the REAL page in
// headless Chromium on the software WebGPU adapter (SwiftShader — no GPU needed): what the fake-DOM probe (tools/qa/picks-probes.ts picks-card) cannot see —
// the rows and their links as laid out, real key events through both screens' listeners, real page loads.
//   node tools/qa/picks-loadout-look.cjs <outDir>      env: PORT (the dev server's, default 5199) · SIZE (default 1280x800) · QUALITY (default verylow) · READY=1 (also wait for the renderer and repeat the click on the real start card: minutes)
// PASS / FAIL lines, stills beside a report.json, exit 1 on a FAIL or a page error.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const outDir = process.argv[2] || 'picks-loadout-look';
const PORT = process.env.PORT || 5199;
const [W, H] = (process.env.SIZE || '1280x800').split('x').map(Number);
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
const BASE = `http://localhost:${PORT}/`, Q = `paused&quality=${QUALITY}&mute&cards`;   // (?cards: the start card with its short list — the one starting page, ui/startpage.ts, has tools/qa/startpage-look.cjs)
const report = { checks: [], errors: [] };
const check = (ok, label, detail) => { report.checks.push({ ok: !!ok, label, detail }); console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
function watch(page) {
  page.on('pageerror', e => { if (!GPU && /WebGPU|adapter/i.test(String(e))) return; report.errors.push(String(e).slice(0, 300)); log('PAGE ERROR', String(e).slice(0, 300)); });
  page.on('console', m => { if (m.type() !== 'error') return; const t = m.text(); if (NOISE.test(t) || /Failed to load resource|Failed to fetch/.test(t) || (!GPU && /WebGPU|adapter/i.test(t))) return; /* (a fetch cut off by the next page load is not a fault) */ report.errors.push(t.slice(0, 300)); log('console error', t.slice(0, 300)); });
}
const rowsOf = page => page.evaluate(() => [...document.querySelectorAll('#menu .picks .pwrap')].map(w => { const a = w.querySelector('.prow'), g = w.querySelector('.palt.go'), d = w.querySelector('.palt:not(.go)');
  return { id: a.getAttribute('data-pick'), href: a.getAttribute('href'), title: a.querySelector('.ptitle')?.textContent, go: g ? { text: g.textContent, href: g.getAttribute('href') } : null, alt: d ? { text: d.textContent, href: d.getAttribute('href') } : null,
    right: Math.round((d ?? g ?? a).getBoundingClientRect().right), card: Math.round(document.querySelector('#menu .card').getBoundingClientRect().right) }; }));
const loadoutOf = page => page.evaluate(() => { const L = document.getElementById('loadout'); if (!L) return null;
  return { title: L.querySelector('.lo-title')?.textContent ?? '', kits: [...L.querySelectorAll('[data-row="squadkit"] [data-kit]')].map(b => b.textContent), deploy: L.querySelector('[data-act="deploy"]')?.textContent ?? '', members: L.querySelectorAll('.lo-slots > *').length, inert: document.getElementById('menu')?.hasAttribute('inert') ?? false }; });
const focusOf = page => page.evaluate(() => { const a = document.activeElement; return a ? (a.getAttribute('data-pick') ? `row:${a.getAttribute('data-pick')}` : a.getAttribute('data-go') ? `go:${a.getAttribute('data-go')}` : a.getAttribute('data-alt') ? `alt:${a.getAttribute('data-alt')}` : a.id || a.tagName) : 'none'; });
const shot = (page, name) => page.screenshot({ path: path.join(outDir, name), timeout: Number(process.env.SHOT_MS) || 20000 }).catch(e => log('no still', name, String(e).split('\n')[0].slice(0, 120)));   // (the software adapter compiling shaders can hold a frame for minutes after a boot: SHOT_MS=150000 to wait for every still)
const sameQuery = (a, b) => { const p = s => [...new URLSearchParams(s.replace(/^[^?]*\?/, ''))].map(([k, v]) => `${k}=${v}`).sort().join('&'); return p(a) === p(b); };

(async () => {
  const browser = await chromium.launch({ headless: true, args: FLAGS });
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  if (!GPU) await ctx.addInitScript(() => { addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#fatal { display: none !important; }'; document.head.appendChild(s); }); });
  const page = await ctx.newPage(); watch(page);
  // a row started is a page load of its URL. What that URL boots is tools/qa/picks-probes.ts picks-boot's to say; here the load is answered with an empty
  // page, so the software adapter is not left compiling a mission's shaders under the next check (minutes each)
  let stub = false;
  await page.route('**/*', r => (stub && r.request().isNavigationRequest() && r.request().resourceType() === 'document' ? r.fulfill({ contentType: 'text/html', body: '<title>started</title>' }) : r.continue()));
  const loaded = () => { stub = true; return page.waitForURL(u => /pick=/.test(String(u)), { timeout: 30000 }); };
  const open = async (q = Q) => { stub = false; await page.goto(BASE + '?' + q, { waitUntil: 'domcontentloaded', timeout: 180000 }); await page.waitForSelector('#menu .picks .prow, #menu button', { timeout: 60000 }); await page.waitForTimeout(600); };   // (past the rows' arming beat: a key already down as a card opens starts nothing)

  // ---- the card
  await open(); const rows = await rowsOf(page);
  await shot(page, 'card.png');
  check(rows.length >= 5 && rows.every(r => r.go && r.go.text === 'go ›' && r.go.href === r.href) && rows.every(r => r.right <= r.card), "every row carries a 'go ›' link to its own URL, and nothing runs off the card's edge",
    rows.map(r => `${r.id}: ${r.go?.text ?? 'no go'}${r.alt ? ` · ${r.alt.text}` : ''} (right ${r.right} of ${r.card})`).join(' · '));

  // ---- by the keys: S onto the first row, Enter = its loadout (nothing loads), Esc = the card with the row still highlighted
  const url0 = page.url();
  await page.keyboard.press('s'); const f1 = await focusOf(page);
  await page.keyboard.press('Enter'); await page.waitForTimeout(250);
  const L1 = await loadoutOf(page); await shot(page, 'loadout-first-row.png');
  check(f1 === `row:${rows[0].id}` && !!L1 && L1.title === rows[0].title && page.url() === url0 && L1.inert, "S then Enter on the first row opens THAT mission's loadout over the card; nothing loads",
    `focus ${f1} · ${L1 ? `'${L1.title}' · squad kit: ${L1.kits.join(' | ') || 'no row'} · ${L1.deploy}` : 'no screen'} · url ${page.url() === url0 ? 'unchanged' : page.url()}`);
  check(!!L1 && L1.kits.some(k => /wall charge/i.test(k)), "the screen carries the Squad kit row with 'One wall charge' (pouches rule on, a squad mission)", L1 ? L1.kits.join(' | ') : 'no screen');
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  const f2 = await focusOf(page), gone = (await loadoutOf(page)) === null;
  check(gone && f2 === `row:${rows[0].id}` && page.url() === url0, 'Esc closes it onto the card: the same row still has the highlight, nothing loaded', `screen ${gone ? 'gone' : 'still up'} · focus ${f2}`);

  // ---- D D: go ›, then the other difficulty; Enter there = the loadout at that difficulty, said in the title
  await page.keyboard.press('d'); const f3 = await focusOf(page); await page.keyboard.press('d'); const f4 = await focusOf(page);
  await page.keyboard.press('Enter'); await page.waitForTimeout(250); const L2 = await loadoutOf(page);
  await shot(page, 'loadout-hard.png');
  check(f3 === `go:${rows[0].id}` && f4 === `alt:${rows[0].id}` && !!L2 && / · hard$/.test(L2.title) && page.url() === url0, "D steps row → go › → hard ›; Enter on hard › opens the same loadout with hard said in its title", `${f3} → ${f4} · '${L2?.title ?? 'no screen'}'`);
  // Enter again on the screen = Deploy = the page load of the row at hard
  await Promise.all([loaded(), page.keyboard.press('Enter')]);
  check(sameQuery(page.url(), rows[0].alt.href), 'Enter on the loadout is Deploy: ONE page load of the row at that difficulty', new URL(page.url()).search);

  // ---- by the mouse: a click on a row, then the Deploy button
  await open(); const again = await rowsOf(page), k = 1;
  const played = await page.evaluate(id => document.querySelector(`#menu .picks .prow[data-pick="${id}"]`)?.classList.contains('played'), rows[0].id);
  await page.click(`#menu .picks .prow[data-pick="${again[k].id}"] .ptitle`); await page.waitForTimeout(250);
  const L3 = await loadoutOf(page); await shot(page, 'loadout-click.png');
  await Promise.all([loaded(), page.click('#loadout [data-act="deploy"]')]);
  check(played && !!L3 && L3.title === again[k].title && sameQuery(page.url(), again[k].href), "a click on a row opens its loadout and the Deploy button loads the row's own URL; the row deployed a page ago says played", `'${L3?.title ?? 'no screen'}' → ${new URL(page.url()).search} · first row played ${played}`);

  // ---- go ›: straight in
  await open(); const r3 = (await rowsOf(page))[3];
  await Promise.all([loaded(), page.click(`#menu .picks .palt.go[data-go="${r3.id}"]`)]);
  check(sameQuery(page.url(), r3.href), "'go ›' is ONE click straight in: the row's own URL, no screen between", new URL(page.url()).search);

  // ---- the switch off: ?pickstraight
  await open(Q + '&pickstraight'); const off = await rowsOf(page); await shot(page, 'card-pickstraight.png');
  await Promise.all([loaded(), page.click(`#menu .picks .prow[data-pick="${off[2].id}"] .ptitle`)]);
  check(off.every(r => !r.go) && sameQuery(page.url(), off[2].href) && /pickstraight/.test(page.url()), '?pickstraight: no go › links, and a click on a row is the page load, as it was (the flag rides along)', `go links ${off.filter(r => r.go).length} → ${new URL(page.url()).search}`);

  // ---- the real start card, the renderer up (minutes on the software adapter)
  if (process.env.READY) {
    await open(); log('waiting for the renderer…');
    await page.waitForFunction(() => window.__menu && window.__game, null, { timeout: 600000, polling: 1000 }); await page.waitForTimeout(800);
    await shot(page, 'start-card.png');
    const rr = await rowsOf(page); await page.click(`#menu .picks .prow[data-pick="${rr[0].id}"] .ptitle`); await page.waitForTimeout(400);
    const L4 = await loadoutOf(page); await shot(page, 'start-card-loadout.png');
    const mode = await page.evaluate(() => window.__menu.mode);
    check(!!L4 && L4.title === rr[0].title && mode === 'start', 'on the real start card (renderer up) a click on a row opens its loadout and the card stays the start card under it', `'${L4?.title ?? 'no screen'}' · menu ${mode}`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    const after = await page.evaluate(() => ({ mode: window.__menu.mode, lo: !!document.getElementById('loadout') }));
    check(after.mode === 'start' && !after.lo, 'Esc there is the start card again, not the game', JSON.stringify(after));
  }
  check(report.errors.length === 0, 'no page error and no console error on any of the pages', report.errors.join(' | ') || 'none');
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
  await browser.close();
  const bad = report.checks.filter(c => !c.ok).length; console.log(bad ? `=== picks-loadout-look: ${bad} FAIL ===` : '=== picks-loadout-look: ALL PASS ===');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
