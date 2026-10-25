// THE UNPLAYED ROWS STAND APART, ON THE REAL PAGE (src/ui/missions.ts UNPLAYED_UI; the lists as data are tools/qa/unplayed-check.ts): headless Chromium on the
// software WebGPU adapter (tools/qa/page-look.cjs's recipe — no GPU here, so this reads the DOM and the computed style; it judges no rendering of the game).
// The title's Play opens the start page's Mission step; what is read: every group's cards in order with their classes, that a group's unplayed cards stand last
// and the first of them (where a played one stands before it) wears the break and starts a line of its own, the opacity a quiet card's picture and title are
// drawn at against a played one's and against the highlighted one's; the older list (?cards, then Missions) and the flat one (?nogroups); and under ?unplayed=0
// that no card wears either class.
//   PORT=5233 node tools/qa/unplayed-page.cjs        (a dev server on that port: PORT=5233 bun run tools/serve.ts)   OUT=<dir> also saves stills (no GPU at all): unplayed-on.png / -off.png / -list.png
// exit 0 = all of it holds and no page printed an error · 1 = otherwise
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', OUT = process.env.OUT || '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
(async () => {
  const live = new Set(), t0 = Date.now(); let failed = false;   // (A BROWSER PER PAGE: on the software adapter a closed page's frames can hold the next page's up for minutes)
  const dog = setTimeout(async () => { console.log('- FAIL — no end after eight minutes (the software adapter under load): stopped'); console.log('=== unplayed-page: FAILED ==='); await Promise.race([Promise.all([...live].map(b => b.close())), new Promise(r => setTimeout(r, 5000))]); process.exit(1); }, 480000);
  const shut = x => Promise.race([x.close().then(() => live.delete(x)), new Promise(r => setTimeout(r, 8000))]);   // (the software adapter's GPU process can keep a close waiting for good: eight seconds, then on — the exit at the foot ends it)
  const line = (ok, s) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); if (process.env.TIMES) console.log(`    (${Math.round((Date.now() - t0) / 1000)} s)`); };
  /** the rows of the list that is up, group by group, with what each wears and how its picture and title are drawn */
  const read = page => page.evaluate(() => {
    const root = document.getElementById('missions'), rows = [...root.querySelectorAll('.mrow')], op = e => e ? Number(getComputedStyle(e).opacity) : null;
    return { root: root.className, rows: rows.map(a => ({ id: a.getAttribute('data-mission'), group: a.getAttribute('data-group') || '', quiet: a.classList.contains('unplayed'), first: a.classList.contains('first'), sel: a.classList.contains('sel'),
      shown: a.offsetParent !== null, x: Math.round(a.getBoundingClientRect().left), y: Math.round(a.getBoundingClientRect().top), h: Math.round(a.getBoundingClientRect().height), thumb: op(a.querySelector('.mthumb')), title: op(a.querySelector('.mtitle')),
      rule: a.classList.contains('first') ? getComputedStyle(a, '::before').borderTopWidth + ' ' + Math.round(parseFloat(getComputedStyle(a, '::before').width)) + ' ' + getComputedStyle(a).borderTopWidth + ' ' + getComputedStyle(a).marginTop : '' })),
      grid: (g => g ? Math.round(g.clientWidth - parseFloat(getComputedStyle(g).paddingLeft) - parseFloat(getComputedStyle(g).paddingRight)) : 0)(root.querySelector('.mgrid')), words: root.innerText };
  });
  const open = async (q, viaCards, ctx) => {
    const own = ctx ? null : await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); if (own) live.add(own);
    const page = await (ctx ? ctx.newPage() : own.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(`http://localhost:${PORT}/?mute&quality=${QUALITY}${q ? '&' + q : ''}`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await page.waitForSelector('#menu .actions button', { timeout: 60000 }); await page.waitForTimeout(500);
    if (viaCards) await page.evaluate(() => { [...document.querySelectorAll('#menu button')].find(b => b.textContent.trim() === 'Missions').click(); });
    else await page.evaluate(() => { document.querySelector('#menu .actions button.primary').click(); });   // (the title's Play; a click from inside the page: the software adapter's frames keep a pointer click waiting on a 'stable' button)
    await page.waitForSelector('#missions .mrow', { state: 'attached', timeout: 20000 }); await page.waitForTimeout(500); await page.mouse.move(2, 2);
    return { page, errors, own };
  };
  const groupsOf = rows => [...new Set(rows.map(r => r.group))];
  const lastOk = rows => groupsOf(rows).every(g => { const of = rows.filter(r => r.group === g), k = of.findIndex(r => r.quiet); return k < 0 || of.slice(k).every(r => r.quiet); });
  const firstOk = rows => groupsOf(rows).every(g => { const of = rows.filter(r => r.group === g), k = of.findIndex(r => r.quiet); return of.every((r, i) => r.first === (k > 0 && i === k)); });
  const lay = rows => groupsOf(rows).map(g => { const of = rows.filter(r => r.group === g); return `${g || '(no group)'} ${of.length} (${of.filter(r => r.quiet).length} unplayed${of.some(r => r.first) ? ', break at ' + of.find(r => r.first).id : ''})`; }).join(' · ');

  // ---- the start page's cards, the switch on
  const CUT = ['night-breach', 'room-clear-four', 'block-squads', 'quiet-yard-alone', 'quiet-yard-two'];   // (the rows cut from the list — scene/scenarios.ts offList; the page's entry puts OFFLIST_UI on)
  let wordsOn = '', boxesOn = [], gOn = ''; const sorted = t => t.split(/\n+/).map(x => x.trim()).filter(Boolean).sort().join('\n');   // (the page's words as a bag of lines: a row that moves adds no word)
  { const { page, errors, own } = await open('', false), A = await read(page); wordsOn = A.words;
    line(/\bone\b/.test(A.root) && /\btiles\b/.test(A.root) && A.rows.length > 0 && errors.length === 0, `the title's Play opens the Mission step as cards with no page error (${A.rows.length} cards)${errors.length ? ' — ' + errors.join(' ; ').slice(0, 400) : ''}`);
    line(A.rows.some(r => r.quiet) && lastOk(A.rows) && firstOk(A.rows), `cards: in every group the unplayed stand last, and the break is on the first of them where a played card stands before it — ${lay(A.rows)}`);
    // (open a group that holds both kinds: its heading is the tile over the first break's group; the cursor lands on its first card, a played one)
    line(CUT.every(id => !A.rows.some(r => r.id === id)), `the rows cut from the list are on no card (${CUT.join(', ')}): ${A.rows.length} cards`);
    const g = A.rows.find(r => r.first).group; gOn = g; await page.evaluate(h => { document.querySelector(`#missions .msec[data-head="${h}"]`).click(); }, g); await page.mouse.move(2, 2); await page.waitForTimeout(400);
    const B = (await read(page)), of = B.rows.filter(r => r.group === g), q = of.filter(r => r.quiet), p = of.filter(r => !r.quiet && !r.sel), s = of.find(r => r.sel), f = of.find(r => r.first);
    line(of.every(r => r.shown) && q.every(r => r.thumb < 0.6 && r.title < 0.6) && p.every(r => r.thumb >= 0.9 && r.title === 1) && !!s && s.thumb === 1,
      `'${g}' open: ${q.length} quiet cards drawn at picture ${q[0]?.thumb} / title ${q[0]?.title}, ${p.length} played at ${p[0]?.thumb} / ${p[0]?.title}, the highlighted (${s?.id}) at ${s?.thumb} / ${s?.title}`);
    boxesOn = of.map(r => [r.x, r.y, r.h].join()); void f;   // (the cards' boxes with the switch on: the same boxes are wanted with it off — no line is broken for the unplayed, no card squeezed)
    await page.mouse.move(q[0].x + 40, q[0].y + 40); await page.waitForTimeout(200); const H = (await read(page)).rows.find(r => r.id === q[0].id); await page.mouse.move(2, 2);
    await page.evaluate(id => { document.querySelector(`#missions .mrow[data-mission="${id}"]`).click(); }, q[0].id); await page.waitForTimeout(300); const C = (await read(page)).rows.find(r => r.id === q[0].id);
    line(H.thumb === 1 && H.title === 1 && C.sel && C.quiet && C.thumb === 1 && C.title === 1, `a quiet card under the pointer is drawn at ${H.thumb} / ${H.title}, and highlighted at ${C.thumb} / ${C.title} with its class kept: the cursor still reads`);
    await page.evaluate(h => { document.querySelector(`#missions .msec[data-head="${h}"]`).click(); }, g); await page.mouse.move(2, 2); await page.waitForTimeout(600);
    line(errors.length === 0, `no page error through all of that${errors.length ? ' — ' + errors.join(' ; ').slice(0, 400) : ''}`);
    await shut(own); }
  // ---- the same page under ?unplayed=0
  { const { page, errors, own } = await open('unplayed=0', false), A = await read(page);
    const g = gOn; if (g) { await page.evaluate(h => { document.querySelector(`#missions .msec[data-head="${h}"]`).click(); }, g); await page.mouse.move(2, 2); await page.waitForTimeout(600); }
    const B = await read(page), of = B.rows.filter(r => r.group === g && !r.sel);
    line(A.rows.length > 0 && A.rows.every(r => !r.quiet && !r.first) && of.every(r => r.thumb >= 0.9 && r.title === 1) && sorted(A.words) === sorted(wordsOn) && B.rows.filter(r => r.group === g).map(r => [r.x, r.y, r.h].join()).join(' ') === boxesOn.join(' ') && errors.length === 0,
      `?unplayed=0: no card wears either class, every card of '${g}' is drawn at ${of[0]?.thumb} / ${of[0]?.title}, the page's words are the same with the switch on or off (it adds none), and the group's ${boxesOn.length} cards stand in the same boxes either way (no line broken, no card squeezed)${errors.length ? ' — ' + errors.join(' ; ').slice(0, 400) : ''}`);
    await shut(own); }
  // ---- ?offlist=0: the cut rows are drawn again
  { const { page, errors, own } = await open('offlist=0', false), A = await read(page);
    line(CUT.every(id => A.rows.some(r => r.id === id)) && errors.length === 0, `?offlist=0: the cut rows are cards again (${A.rows.length} cards)${errors.length ? ' — ' + errors.join(' ; ').slice(0, 400) : ''}`);
    await shut(own); }
  // ---- the older list (?cards, then Missions), and the flat one (?nogroups)
  { const { page, errors, own } = await open('cards', true), A = await read(page), q = A.rows.filter(r => r.quiet && !r.sel), f = A.rows.filter(r => r.first);
    line(q.length > 0 && q.every(r => r.title < 0.6) && A.rows.filter(r => !r.quiet).every(r => r.title === 1) && f.length > 0 && f.every(r => r.rule.split(' ')[0] === '1px' && r.rule.split(' ')[2] === '0px') && errors.length === 0,
      `the older list: ${A.rows.length} rows, ${A.rows.filter(r => r.quiet).length} quiet at ${q[0]?.title}, a ${f[0]?.rule.split(' ')[0]} rule in ${f[0]?.rule.split(' ')[3]} of room over (the row's own box untouched) ${f.map(r => r.id).join(', ')}${errors.length ? ' — ' + errors.join(' ; ').slice(0, 400) : ''}`);
    await shut(own); }
  { const { page, errors, own } = await open('nogroups', false), A = await read(page); await shut(own); const off = await open('nogroups&unplayed=0', false), B = await read(off.page); await shut(off.own);
    line(A.rows.some(r => r.quiet) && A.rows.every(r => !r.first) && A.rows.map(r => r.id).join() === B.rows.map(r => r.id).join() && B.rows.every(r => !r.quiet) && errors.length + off.errors.length === 0,
      `?nogroups: ${A.rows.length} rows in the same order with the switch on or off, ${A.rows.filter(r => r.quiet).length} quiet, no break`);
    void page; }
  clearTimeout(dog);
  // ---- THE STILLS, for a person's eye (OUT=<dir>): a second browser with NO GPU at all (tools/qa/startpage-look.cjs's way — a still of the page over the software
  // adapter's frames does not come back), the page's own 'no WebGPU' notice hidden; the menus are DOM and are drawn the same. A still's absence fails nothing.
  if (OUT) { const B = await chromium.launch({ headless: true, channel: 'chromium', args: ['--disable-gpu'] }), ctx = await B.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.addInitScript(() => { addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#fatal { display: none !important; }'; document.head.appendChild(s); }); });
    const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}`, timeout: 60000 }).then(() => console.log(`  still: ${OUT}/${name}`), e => console.log(`  no still ${name}: ${String(e).split('\n')[0].slice(0, 120)}`));
    const group = (page, id) => page.evaluate(id => { const h = document.querySelector(`#missions .mrow[data-mission="${id}"]`)?.getAttribute('data-group'); if (h) document.querySelector(`#missions .msec[data-head="${h}"]`).click(); }, id);
    for (const [q, name, viaCards] of [['', 'unplayed-on.png', false], ['unplayed=0', 'unplayed-off.png', false], ['cards', 'unplayed-list.png', true]]) {
      try { const { page } = await open(q, viaCards, ctx); if (!viaCards) await group(page, 'records-pair'); await page.mouse.move(2, 2); await page.waitForTimeout(1500); await shot(page, name); await page.close(); }
      catch (e) { console.log(`  no still ${name}: ${String(e).split('\n')[0].slice(0, 120)}`); } }
    await shut(B); }
  console.log(failed ? '=== unplayed-page: FAILED ===' : '=== unplayed-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
