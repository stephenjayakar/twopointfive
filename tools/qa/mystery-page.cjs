// HOW MANY ARE INSIDE IS A MYSTERY, AND THE LARGE MAP IS LEFT BY A CLICK BESIDE IT — ON THE REAL PAGE (ui/missions.ts MYSTERY `?mystery=0`,
// ui/kitBrief.ts KITBRIEF.outside `?mapout=0`). The maintainer, 10-23: "clicking outside the map should close it. we should also remove all defender counts
// from the menus, etc., it should be a mystery!"
// Headless Chromium with no WebGPU adapter (the start page and a mission's load page are plain DOM, live from the first tick), REAL keys and clicks:
//   · the Team & kit step, the Mission step behind it and the mission's load page draw no Defenders cell, and none of their words says a head count;
//   · the map opened large is put back by a click anywhere off it, and that click does nothing else (the team size under it is as it was, the step is
//     still the kit step); a click ON the large map and M put it back as before;
//   · `?mapout=0`: a click beside the large map leaves it up (as it was); `?mystery=0`: the cells are back, a count past five as a word.
//   node tools/qa/mystery-page.cjs [outDir]      env: PORT (the dev server's, default 5199) · SIZES · MYSTERY_BREAK=1 (both switches off on every page: must FAIL)
// PASS / FAIL lines, exit 1 on a FAIL or a page error. The tables' half (every row, pick line and Hard sentence): tools/qa/mystery-check.ts.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const outDir = process.argv[2] || '';
const PORT = process.env.PORT || 5199;
const SIZES = (process.env.SIZES || '1440x900,1000x673').split(',').map(s => s.split('x').map(Number));
const BREAK = process.env.MYSTERY_BREAK === '1';
const OFF = BREAK ? '&mystery=0&mapout=0' : '';
const MISSIONS = ['compound-four', 'rescue-registry', 'warehouse-four', 'solo-night'];
// (a number put on the enemy: tools/qa/mystery-check.ts countsIn has the same nouns)
const NUM = '(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\\d+)';
const COUNT = new RegExp(`\\b${NUM}\\s+(armed\\s+|more\\s+|other\\s+)?(enemies|enemy|defenders?|guards?|gunmen|gunman|men|sentries|sentry|captors?|hostiles?|shooters?)\\b|\\bagainst\\s+${NUM}\\b|\\b${NUM}\\s+(hold|holds|holding|of\\s+us|inside|on\\s+shift|on\\s+patrol)\\b`, 'i');
let fails = 0; const errors = [];
const check = (ok, label, detail) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
if (outDir) fs.mkdirSync(outDir, { recursive: true });

/** the step as it stands: which pane, the facts drawn, every word of the sheet that is on screen, the map and the team size */
const read = page => page.evaluate(() => {
  const root = document.querySelector('#missions'), vis = e => !!e && e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
  const map = document.querySelector('.msheet > .mmap'), r = map?.getBoundingClientRect();
  return { pane: root.classList.contains('pane-loadout') ? 'kit' : 'mission', big: root.classList.contains('kb-big'),
    facts: [...document.querySelectorAll('.msheet .mfact')].filter(vis).map(f => `${f.querySelector('i').textContent} ${f.querySelector('b').textContent}`),
    words: ['.mst', '.mplace', '.mblurb', '.mcsum', '.kb-cap', '.mdiff', '.mread'].map(s => { const e = document.querySelector(`.msheet ${s}`) ?? document.querySelector(`#missions ${s}`); return vis(e) ? e.textContent.trim() : ''; }).filter(Boolean).join(' · '),
    map: map && vis(map) ? { l: r.left, t: r.top, r: r.right, b: r.bottom, title: map.title } : null,
    team: document.querySelector('#loadout .lo-team .lo-words')?.textContent ?? '',
    sig: `${location.search} · ${document.querySelector('#loadout')?.innerHTML.length ?? 0} · ${document.querySelector('#loadout [data-row].sel')?.getAttribute('data-row') ?? ''} · ${document.querySelector('#loadout .lo-slot.pick .lo-name')?.textContent ?? ''}`, win: { w: innerWidth, h: innerHeight } };
});
const cells = s => s.facts.filter(f => /^Defenders/i.test(f));
/** a point of the window off the map: on a live button of the step the map does not cover where there is one (`on`: the step WOULD take a click there),
 *  else on bare ground beside it */
const beside = page => page.evaluate(() => { const m = document.querySelector('.msheet > .mmap').getBoundingClientRect(), off = (x, y) => x < m.left - 8 || x > m.right + 8 || y < m.top - 8 || y > m.bottom + 8;
  for (const b of document.querySelectorAll('#loadout .lo-size[aria-pressed="false"], #loadout .lo-slot:not(.pick), #loadout button:not([disabled])')) { const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (r.width > 0 && off(x, y) && y < innerHeight - 2 && b.contains(document.elementFromPoint(x, y))) return { x, y, on: (b.textContent || b.className).trim().slice(0, 24) }; }
  for (const [x, y] of [[(m.left + m.right) / 2, m.bottom + 40], [m.left - 40, (m.top + m.bottom) / 2], [m.right + 40, (m.top + m.bottom) / 2], [(m.left + m.right) / 2, m.top - 12]])
    if (x > 4 && y > 4 && x < innerWidth - 4 && y < innerHeight - 4 && !document.elementFromPoint(x, y)?.closest?.('button, a, .kc, .mmap')) return { x, y, on: '' };
  return { x: 6, y: innerHeight - 6, on: '' }; });

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
  for (const [W, H] of SIZES) {
    const at = `${W}x${H}`, ctx = await browser.newContext({ viewport: { width: W, height: H } });
    await ctx.addInitScript(() => addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#fatal { display: none !important; }'; document.head.appendChild(s); }));
    const page = await ctx.newPage(); page.on('pageerror', e => { if (/WebGPU|adapter/i.test(String(e))) return; errors.push(String(e).slice(0, 200)); });
    const open = async (q, off = OFF) => { await page.goto(`http://localhost:${PORT}/?${q}&paused&mute&kitguide=0${off}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
      await page.waitForSelector('#missions.one.on #loadout .lo-slot.in', { timeout: 60000 }); await page.waitForTimeout(1200); };
    const shot = async name => { if (outDir) await page.screenshot({ path: path.join(outDir, `${name}-${at}${BREAK ? '-break' : ''}.png`) }).catch(() => {}); };

    // ── no cell and no head count: the kit step, the large map's caption, the Mission step ──
    const drawn = [], said = [];
    for (const id of MISSIONS) {
      await open(`loadout=${id}`); const kit = await read(page);
      await page.keyboard.press('m'); await page.waitForTimeout(350); const big = await read(page); if (id === MISSIONS[0]) await shot('map-large');
      await page.keyboard.press('m'); await page.waitForTimeout(250);
      await page.keyboard.press('Escape'); await page.waitForTimeout(400); const mis = await read(page); if (id === MISSIONS[0]) await shot('mission-step');
      for (const [where, s] of [['kit', kit], ['large map', big], ['mission', mis]]) { for (const c of cells(s)) drawn.push(`${id} ${where}: ${c}`); const m = COUNT.exec(s.words); if (m) said.push(`${id} ${where}: "${m[0]}"`); }
      if (mis.pane !== 'mission') drawn.push(`${id}: Esc did not reach the Mission step`);
    }
    check(drawn.length === 0, `${at}: no Defenders cell on the kit step, the large map or the Mission step`, drawn.join(' · ') || `${MISSIONS.length} missions, three screens each`);
    check(said.length === 0, `${at}: no word of those screens says a head count`, said.join(' · ') || 'none found');

    // ── the large map: a click beside it puts it back and does nothing else ──
    await open('loadout=compound-four'); let s = await read(page);
    if (!s.map) { check(false, `${at}: the kit step draws the map`, 'no map on the step'); await ctx.close(); continue; }
    await page.mouse.click((s.map.l + s.map.r) / 2, (s.map.t + s.map.b) / 2); await page.waitForTimeout(350); const up = await read(page);
    const pt = await beside(page); await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(350); const back = await read(page); await shot('after-click-beside');
    check(up.big && !back.big && back.pane === 'kit' && back.team === s.team && back.sig === s.sig, `${at}: a click beside the large map puts it back, and the step under it does not take the click`,
      `opened ${up.big} · clicked at ${pt.x.toFixed(0)},${pt.y.toFixed(0)}${pt.on ? ` on the step's "${pt.on}"` : ' on bare ground'} · still large ${back.big} · on ${back.pane} · the step ${back.sig === s.sig ? 'as it was' : `CHANGED (${s.sig} → ${back.sig})`}`);
    if (back.big) { await page.keyboard.press('m'); await page.waitForTimeout(300); }   // (a red run goes on from the step as a green one leaves it)
    check(/anywhere/.test(up.map?.title ?? ''), `${at}: large, its tooltip says a click anywhere goes back`, `"${up.map?.title ?? ''}"`);
    await page.mouse.click((s.map.l + s.map.r) / 2, (s.map.t + s.map.b) / 2); await page.waitForTimeout(350); const up2 = await read(page);
    await page.mouse.click((up2.map.l + up2.map.r) / 2, up2.map.t + 40); await page.waitForTimeout(350); const on = await read(page);
    await page.keyboard.press('m'); await page.waitForTimeout(300); const m1 = await read(page); await page.keyboard.press('m'); await page.waitForTimeout(300); const m2 = await read(page);
    check(up2.big && !on.big && m1.big && !m2.big, `${at}: a click on the large map and M still put it back`, `opened ${up2.big} · after a click on it ${on.big} · M ${m1.big} · M again ${m2.big}`);
    // a click beside the SMALL map is the step's own: the team size under the pointer still takes it
    { const t0 = (await read(page)).team; await page.click('#loadout .lo-size[aria-pressed="false"]'); await page.waitForTimeout(300); const t1 = (await read(page)).team;
      check(t1 !== t0, `${at}: with the map small a click on the step is the step's own`, `team "${t0}" then "${t1}"`); }

    // ── each switch off: the step as it was ──
    if (!BREAK) {
      await open('loadout=compound-four', '&mapout=0'); s = await read(page);
      await page.mouse.click((s.map.l + s.map.r) / 2, (s.map.t + s.map.b) / 2); await page.waitForTimeout(350); const u = await read(page); const o = await beside(page);
      await page.mouse.click(o.x, o.y); await page.waitForTimeout(350); const still = await read(page);
      check(u.big && (o.on ? still.sig !== u.sig : still.big), `${at}: ?mapout=0: a click beside the large map is the step's, as it was`, `opened ${u.big} · clicked ${o.on ? `the step's "${o.on}"` : 'bare ground'} · large after ${still.big} · the step ${still.sig === u.sig ? 'as it was' : 'took it'}`);
      await open('loadout=compound-four', '&mystery=0'); const k = await read(page); await page.keyboard.press('Escape'); await page.waitForTimeout(400); const mi = await read(page);
      check(cells(k).join() === 'Defenders eleven' && cells(mi).join() === 'Defenders 11', `${at}: ?mystery=0: the cells are back as they were (the kit step's a word past five)`, `kit: ${cells(k).join() || 'none'} · mission: ${cells(mi).join() || 'none'}`);
    }
    await ctx.close();
  }

  // ── a mission's load page ──
  { const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage();
    await ctx.addInitScript(() => addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#fatal { display: none !important; }'; document.head.appendChild(s); }));
    page.on('pageerror', e => { if (/WebGPU|adapter/i.test(String(e))) return; errors.push(String(e).slice(0, 200)); });
    const bad = [];
    for (const q of ['levelFile=compound.json&roomclear&squad=4', 'levelFile=registry.json&rescue', 'levelFile=warehouse.json&roomclear&squad=4']) {
      await page.goto(`http://localhost:${PORT}/?${q}&mute${OFF}`, { waitUntil: 'commit', timeout: 180000 }); await page.waitForSelector('#brief.on', { timeout: 90000 }); await page.waitForTimeout(800);
      const text = await page.evaluate(() => document.querySelector('#brief').innerText); const m = /Defenders[^\n]*\n?[^\n]*/i.exec(text) || COUNT.exec(text); if (m) bad.push(`${q.split('&')[0]}: "${m[0].replace(/\s+/g, ' ')}"`);
      if (outDir && q.includes('compound')) await page.screenshot({ path: path.join(outDir, `load-page${BREAK ? '-break' : ''}.png`) }).catch(() => {}); }
    check(bad.length === 0, "a mission's load page has no Defenders fact and says no head count", bad.join(' · ') || 'three missions read');
    await ctx.close(); }
  await browser.close();
  check(errors.length === 0, 'no page error', errors.join(' | ') || 'none');
  console.log(fails ? `\n=== mystery-page: ${fails} FAILED ===` : '\n=== mystery-page: ALL PASS ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
