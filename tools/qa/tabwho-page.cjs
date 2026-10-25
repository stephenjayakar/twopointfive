// OPTIONS OFFERS NO DEAD "ORDER WHO" CONTROL — ON THE REAL PAGE (src/ui/tabkey.ts TABKEY.whoGone, src/ui/options.ts the who row; game/cmdring.ts
// `wholeSquad`, `?wholesquad=0`). The maintainer, 10-24: "quick Q mode should always do the whole squad. you should only be able to issue commands to
// parts of the squad in plan mode". With that rule on, as the page opens:
//   · Options ▸ Controls lists no "Who takes the next order" row (no dashed cap to put a dead key on); a machine that gave the row a key earlier keeps
//     its row, which says it works only in plan mode, until Reset takes the key off it;
//   · Options ▸ Game, where it is drawn (it needs the game stood up: without a WebGPU adapter the line says so and is not counted), offers no
//     'Order who' for the Tab key (a kept choice is tabwho-check.ts's line, not this page's);
//   · `?wholesquad=0`: the row with its dashed cap and its own words, and the choice, as they were.
//   node tools/qa/tabwho-page.cjs      env: PORT (the dev server's, default 5199) · TABWHO_BREAK=1 (the rule off on every page: must FAIL)
// PASS / FAIL lines, exit 1 on a FAIL or a page error. The module's half: tools/qa/tabwho-check.ts.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199;
const BREAK = process.env.TABWHO_BREAK === '1';
let fails = 0; const errors = [];
const check = (ok, label, detail) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
const WHO = 'Who takes the next order';

const openTab = async (page, tab) => { await page.waitForSelector('#menu .actions button', { timeout: 60000 });
  await page.evaluate(() => { if (!document.querySelector('#options.on')) [...document.querySelectorAll('#menu .actions button')].find(b => /^Options/.test(b.textContent))?.click(); }); await page.waitForSelector('#options.on', { timeout: 10000 });
  await page.evaluate(t => document.querySelector(`#options .op-tab[data-tab="${t}"]`).click(), tab); await page.waitForTimeout(200); };   // (a click by the page's own hand: under the software adapter a pointer waits for a frame that is seconds late)
const controls = page => page.evaluate(WHO => { const row = [...document.querySelectorAll('#options .op-krow')].find(r => (r.querySelector('.op-what')?.firstChild?.textContent ?? '') === WHO), cap = document.querySelector('#options button.op-key[data-key="KeyT"]');
  return { rows: document.querySelectorAll('#options .op-krow').length, row: !!row, small: row?.querySelector('small')?.textContent ?? '', cap: cap ? cap.textContent : null, capClass: cap ? cap.className : '',
    squad: [...document.querySelectorAll('#options .op-kgroup')].find(g => g.querySelector('.op-sec')?.textContent === 'Squad')?.querySelectorAll('.op-krow').length ?? 0 }; }, WHO);
const game = page => page.evaluate(() => { const row = [...document.querySelectorAll('#options .op-row, #options [class*="op-r"]')].find(r => /Tab key/.test(r.textContent) && r.querySelector('.op-seg')), b = row ? [...row.querySelectorAll('.op-opt')] : [];
  return { drawn: !!row, opts: b.map(x => x.textContent), on: b.find(x => x.classList.contains('on'))?.textContent ?? '' }; });

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
  const fresh = async (store = {}) => { const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(s => { for (const [k, v] of Object.entries(s)) try { if (localStorage.getItem(k) === null) localStorage.setItem(k, v); } catch { /* no store */ } }, store);
    await ctx.addInitScript(() => addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#fatal { display: none !important; }'; document.head.appendChild(s); }));
    const page = await ctx.newPage(); page.on('pageerror', e => { if (/WebGPU|adapter/i.test(String(e))) return; errors.push(String(e).slice(0, 200)); }); return { ctx, page }; };
  const url = (more = '') => `http://localhost:${PORT}/?paused&quality=verylow&mute${BREAK ? '&wholesquad=0' : ''}${more ? '&' + more : ''}`;

  // ── as the page opens: the rule on ──
  { const { ctx, page } = await fresh(); await page.goto(url(), { waitUntil: 'domcontentloaded' });
    await openTab(page, 'controls'); const c = await controls(page);
    check(c.rows > 20 && !c.row && c.cap === null, 'Controls lists no "Who takes the next order" row, and no cap for it', `${c.rows} rows, ${c.squad} under Squad · the who row ${c.row ? 'LISTED' : 'not listed'} · its cap ${c.cap === null ? 'none' : `'${c.cap}'`}`);
    await openTab(page, 'game'); const g = await game(page);
    if (!g.drawn) console.log("- NOTE — Options, Game: the Tab key row is not drawn on this page (no game stood up without a WebGPU adapter): the choices are held by tabwho-check.ts");
    else check(!g.opts.includes('Order who') && g.opts.length === 4, "Game: the Tab key's choices do not offer 'Order who'", g.opts.join(' · '));
    await ctx.close(); }
  // ── a machine that gave the who row a key ──
  { const { ctx, page } = await fresh({ 'twopointsix.keys': '{"KeyT":"KeyT"}' }); await page.goto(url(), { waitUntil: 'domcontentloaded' });
    await openTab(page, 'controls'); const c = await controls(page);
    check(c.row && c.cap === 'T' && /only works in plan mode/.test(c.small), 'a machine that gave the who row a key keeps its row, which says it works only in plan mode', `the who row ${c.row ? 'listed' : 'NOT LISTED'} · cap '${c.cap}' · "${c.small}"`);
    await page.click('#options [data-act="reset"]'); const d = await controls(page);   // (the list is built once: a row that loses its key must not stay as a dashed cap)
    check(!d.row && d.cap === null, 'Reset to defaults takes that row off the list with its key', `the who row ${d.row ? 'STILL LISTED' : 'not listed'} · its cap ${d.cap === null ? 'none' : `'${d.cap}'`}`);
    await ctx.close(); }
  // ── the rule off: as it was ──
  if (!BREAK) { const { ctx, page } = await fresh(); await page.goto(url('wholesquad=0'), { waitUntil: 'domcontentloaded' });
    await openTab(page, 'controls'); const c = await controls(page);
    check(c.row && c.cap === '—' && /none/.test(c.capClass) && c.small === 'everyone, red, blue or one teammate', '?wholesquad=0: the who row with its dashed cap and its own words, as it was', `the who row ${c.row ? 'listed' : 'NOT LISTED'} · cap '${c.cap}' [${c.capClass}] · "${c.small}"`);
    await openTab(page, 'game'); const g = await game(page);
    if (g.drawn) check(g.opts.includes('Order who') && g.opts.length === 5, "?wholesquad=0: 'Order who' is a choice again", g.opts.join(' · '));
    await ctx.close(); }
  await browser.close();
  check(errors.length === 0, 'no page error', errors.join(' | ') || 'none');
  console.log(fails ? `\n=== tabwho-page: ${fails} FAILED ===` : '\n=== tabwho-page: ALL PASS ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
