// THE END CARD ON THE REAL PAGE (src/game/verdict.ts, ui/verdictCard.ts): headless Chromium on the software WebGPU adapter boots a mission from its query,
// plays a try to its end through the page's own loop (the renderer stubbed out while it plays), and keeps a still of the card the page raises by itself.
//   node tools/qa/verdict-look.cjs <outDir> [job …]     jobs: win (the kill house taken at the third try, one man lost) · down (the player down) ·
//   solo (the stealth night, out) · off (win under ?noverdict: the card as it was) · cards (the start page's mission cards with a kept record: no adapter needed, seconds)          env: PORT (the dev server's, default 5199) · SIZE (default 1440x900)
// PASS / FAIL lines for what the card must show, stills beside a report.json; exit 1 on a FAIL or a page error. Slow by nature: about two minutes a job.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const outDir = process.argv[2] || 'verdict-look';
const want = process.argv.slice(3);
const PORT = process.env.PORT || 5199;
const [W, H] = (process.env.SIZE || '1440x900').split('x').map(Number);
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
fs.mkdirSync(outDir, { recursive: true });
const KILLHOUSE = 'levelFile=killhouse.json&roomclear&squad4';
// two tries already started and lost, and the mission once won unseen at the first try with nobody lost: the win staged here is try three, by the doors
const KEPT = { n: 2, s: 2, w: { quiet: { tries: 1, clean: true, secs: 80, wins: 1 } } };
const JOBS = {
  win: { query: KILLHOUSE, end: 'win', seed: true },
  down: { query: KILLHOUSE, end: 'down', seed: true },
  solo: { query: 'solo', end: 'out', seed: false },
  off: { query: KILLHOUSE + '&noverdict', end: 'win', seed: true },
  // a Training lesson's room clear (the fifth's is the same rule): it ends on the card too, with nothing graded and the next lesson leading
  lesson: { query: 'levelFile=train-pairs.json&roomclear=1&squad4&difficulty=hard', end: 'win', seed: false },
};
const report = { checks: [], errors: [] };
const check = (ok, label, detail) => { report.checks.push({ ok: !!ok, label, detail }); console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };

// in the page: n frames of the page's own loop, undrawn, with keys held
const PLAY = ([n, keys]) => { const e = window.__engine, real = e.render; e.render = () => {}; try { window.__runFrames(n, 1 / 60, keys || []); } finally { e.render = real; } };
const CARD = () => { const m = document.getElementById('menu'), q = s => [...m.querySelectorAll(s)], vis = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const V = window.__game.verdict;
  return { up: m.classList.contains('open') || vis(m.querySelector('.db')), db: !!m.querySelector('.db'), cls: m.querySelector('.db')?.className ?? '', word: m.querySelector('.vd-word')?.textContent ?? null, time: m.querySelector('.vd-time')?.textContent ?? null,
    pips: q('.vpip').map(p => p.className.replace('vpip ', '')), gold: !!m.querySelector('.vpips.gold'), tries: q('.vd-tries .try').length, win: q('.vd-tries .try.win').length, tag: !!m.querySelector('.vd-void'),
    men: q('.vd-man:not(.vd-count)').map(r => `${r.querySelector('.nm')?.textContent}:${r.className.match(/s-(\w+)/)?.[1]}`), counts: q('.vd-count .n').map(b => b.textContent), fell: q('.db-map .vfell').length,
    next: q('.btn.next').map(b => b.textContent), lead: m.querySelector('.db .btn.primary')?.textContent ?? null, focus: document.activeElement?.textContent ?? null,
    hidden: ['.db-rating', '.db-stats', '.db-timeline'].map(s => vis(m.querySelector(s))), t1: vis(m.querySelector('.db-t1')),
    kept: localStorage.getItem('twopointsix.verdicts'), line: V?.result ? V.summary?.() ?? '' : '', buttons: q('.actions button').map(b => b.textContent) }; };

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const wantCards = !want.length || want.includes('cards'), jobs = (want.length ? want : Object.keys(JOBS)).filter(n => n !== 'cards');
  for (const name of jobs) {
    const J = JOBS[name]; if (!J) { console.log(`unknown job '${name}' (${Object.keys(JOBS).join(' · ')})`); process.exitCode = 2; continue; }
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    if (J.seed) await ctx.addInitScript(rec => { try { if (!localStorage.getItem('twopointsix.verdicts')) localStorage.setItem('twopointsix.verdicts', JSON.stringify({ 'killhouse-four|standard': rec, 'killhouse-four|hard': rec })); } catch { } }, KEPT);
    const page = await ctx.newPage();
    page.on('pageerror', x => { report.errors.push(`${name}: ${String(x && x.stack || x).slice(0, 400)}`); log('PAGE ERROR', String(x).slice(0, 200)); });
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) { report.errors.push(`${name}: console: ${m.text().slice(0, 300)}`); log('console error', m.text().slice(0, 200)); } });
    try {
      const url = `http://localhost:${PORT}/?paused&quality=verylow&mute&nocutboxes&${J.query}`;   // (nocutboxes: the second set of ray programs compiles for minutes after boot on this adapter, and the page answers no screenshot meanwhile) log(name, 'goto', url);
      await page.goto(url, { timeout: 180000 });
      await page.evaluate(async () => { await window.__ready; window.__testVisible = true; window.__menu.close(); window.__smoke && (window.__smoke.params.enabled = false); });
      log(name, 'ready');
      const s0 = await page.evaluate(() => { const V = window.__game.verdict; return { live: V.live, started: V.started, n: window.__game.guards.length }; });
      await page.evaluate(PLAY, [45, []]);
      const idle = await page.evaluate(() => window.__game.verdict.started);
      await page.evaluate(PLAY, [150, ['KeyD']]); await page.evaluate(PLAY, [60, ['KeyA']]);
      const moved = await page.evaluate(() => ({ started: window.__game.verdict.started, kept: localStorage.getItem('twopointsix.verdicts') }));
      if (name !== 'off') check(s0.live && !idle && moved.started, `${name}: no try while he stands on the mark; his first stride starts one`, `live ${s0.live} · started after 45 idle frames ${idle} · after a walk ${moved.started}`);
      if (J.end === 'win') {
        await page.evaluate(() => { const g = window.__game, foe = g.guards.find(x => x.team !== 'operative' && x.state !== 'dead'); if (foe) foe.state = 'alert'; });   // the team is found: this is not the quiet way
        await page.evaluate(PLAY, [30, []]);
        await page.evaluate(() => { const g = window.__game, i = g.guards.findIndex(x => x.team === 'operative' && x.unit?.pair === 'blue'); window.__killGuard(i >= 0 ? i : g.guards.findIndex(x => x.team === 'operative')); });
        await page.evaluate(PLAY, [240, []]);
        for (let k = 0; k < 4; k++) { await page.evaluate(() => { const g = window.__game; const i = g.guards.findIndex(x => x.team !== 'operative' && x.state !== 'dead'); if (i >= 0) window.__killGuard(i); }); await page.evaluate(PLAY, [70, ['KeyW']]); }
        await page.evaluate(() => { const g = window.__game; g.guards.forEach((x, i) => { if (x.team !== 'operative' && x.state !== 'dead') window.__killGuard(i); }); });
        await page.evaluate(PLAY, [200, []]);
      } else if (J.end === 'down') {
        await page.evaluate(() => { const g = window.__game; const i = g.guards.findIndex(x => x.team !== 'operative' && x.state !== 'dead'); if (i >= 0) window.__killGuard(i); });
        await page.evaluate(PLAY, [180, ['KeyW']]);
        await page.evaluate(() => { window.__game.player.down = true; });
        await page.evaluate(PLAY, [260, []]);
      } else { await page.evaluate(PLAY, [240, ['KeyW']]); await page.evaluate(() => { const m = window.__game.mission; m.stage = 'done'; m.debrief = true; }); await page.evaluate(PLAY, [30, []]); }
      await page.waitForTimeout(400);
      const c = await page.evaluate(CARD); log(name, JSON.stringify(c).slice(0, 900));
      const rec = (() => { try { return JSON.parse(c.kept || '{}')['killhouse-four|standard'] ?? JSON.parse(c.kept || '{}')['killhouse-four|hard'] ?? null; } catch { return null; } })();
      const moved2 = (() => { try { const all = JSON.parse(c.kept || '{}'); return Object.entries(all).find(([, r]) => r.n !== KEPT.n || r.s !== KEPT.s)?.[1] ?? null; } catch { return null; } })();
      if (name === 'win') {
        check(c.db && c.word === 'CLEAR' && /^\d:\d\d$/.test(c.time || '') && /vd-squad/.test(c.cls), 'win: the page raised the card by itself, and it leads with the word and the clock', `${c.word} ${c.time} · ${c.cls}`);
        check(c.pips.length === 4 && c.pips.filter(p => / won/.test(p)).length === 2 && c.pips.some(p => /w-doors won now/.test(p)) && c.gold && c.tries === 3 && c.win === 1, 'win: the doors lit beside the way already won (gold), three ticks, the last the win', `${c.pips.join(' | ')} · gold ${c.gold} · ticks ${c.tries}`);
        check(c.men.length === 5 && c.men.filter(m => !/:up$/.test(m)).length === 1 && c.fell === 1 && c.counts.length === 1, 'win: a row a man, one of them down, his mark on the map, the defenders counted', `${c.men.join(' · ')} · defenders ${c.counts.join()}`);
        check(c.hidden.every(v => !v) && !c.t1, 'win: the stealth game\'s rating, numbers and timeline are not on a squad\'s card', `rating / stats / timeline shown: ${c.hidden.join(' / ')}`);
        check(!!moved2 && moved2.n === 3 && moved2.s === 0 && moved2.w?.doors?.tries === 3 && !moved2.w.doors.clean && !!moved2.w.quiet, 'win: kept on this machine — three tries, the doors won at the third with a man lost, the old way untouched', JSON.stringify(moved2 ?? rec));
      } else if (name === 'lesson') {
        check(c.db && c.word === 'CLEAR' && /^\d:\d\d$/.test(c.time || '') && /vd-squad/.test(c.cls), 'lesson: a Training room clear ends on the card by itself', `${c.word} ${c.time} · ${c.cls}`);
        check(c.pips.length === 0 && c.tries === 0 && !c.gold && (c.kept === null || !/train-/.test(c.kept)), 'lesson: nothing graded and nothing kept — no ways, no tries, no record of the lesson on this machine', `pips ${c.pips.length} · ticks ${c.tries} · kept ${c.kept}`);
        check(c.next.length === 1 && /^Next: 7 · /.test(c.next[0]) && c.lead === c.next[0] && c.focus === c.next[0], 'lesson: the next lesson leads the card (the first button, the focus)', `next ${JSON.stringify(c.next)} · primary '${c.lead}' · focus '${c.focus}'`);
        const href = await page.evaluate(() => document.querySelector('#menu .db .btn.next')?.dataset.href ?? null);
        check(/levelFile=train-silent\.json/.test(href || '') && !/train-pairs|roomclear|squad4/.test(href || ''), 'lesson: the button is the next row\'s own page load', String(href));
      } else if (name === 'down') {
        check(c.db && c.word === 'DOWN' && c.tries === 3 && c.win === 0 && c.pips.filter(p => / won/.test(p)).length === 1 && !c.pips.some(p => / now/.test(p)), 'down: the card says DOWN, three ticks and none a win, the pips as they were', `${c.word} ${c.time} · ticks ${c.tries} · ${c.pips.join(' | ')}`);
        check(c.men[0] === 'Player:dead' && c.fell === 1 && !!moved2 && moved2.n === 3 && moved2.s === 3 && !moved2.w?.doors, 'down: his row ends where he fell; the try is counted and no way is won', `${c.men.join(' · ')} · ${JSON.stringify(moved2)}`);
      } else if (name === 'solo') {
        check(c.db && c.word === 'OUT' && /vd-solo/.test(c.cls) && c.hidden.every(v => v) && c.men.length === 0 && c.pips.length === 4, 'solo: the stealth night\'s card keeps its rating, numbers and timeline under the verdict\'s head', `${c.word} ${c.time} · ${c.cls} · rating / stats / timeline shown: ${c.hidden.join(' / ')}`);
      } else {
        check(!c.word && c.pips.length === 0 && c.men.length === 0 && !moved2, 'off (?noverdict): no verdict on any card, nothing counted', `card up ${c.db} · kept ${c.kept}`);
        if (!c.db) await page.evaluate(() => window.__menu.open('debrief'));
      }
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(outDir, `${name}-page.png`), timeout: 60000 }).catch(e => log('no still', String(e).split('\n')[0]));
      const card = page.locator('#menu .db').first();
      if (await card.count()) await card.screenshot({ path: path.join(outDir, `${name}-card.png`), timeout: 60000 }).catch(e => log('no card still', String(e).split('\n')[0]));
      const head = page.locator('#menu .vd').first();
      if (await head.count()) await head.screenshot({ path: path.join(outDir, `${name}-head.png`), timeout: 60000 }).catch(() => {});
    } catch (e) { report.errors.push(`${name}: ${String(e && e.stack || e).slice(0, 500)}`); log(name, 'THREW', String(e).slice(0, 300)); }
    await ctx.close();
  }
  await browser.close();
  // ---- the mission cards on the start page: plain DOM, live before the renderer is — so no adapter at all (the boot's 'No WebGPU adapter' panel hidden)
  if (wantCards) {
    const b2 = await chromium.launch({ headless: true, args: ['--disable-gpu'] }), ctx = await b2.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => { addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#fatal { display: none !important; }'; document.head.appendChild(s); }); });
    const won = { 'compound-four': { n: 6, s: 0, w: { doors: { tries: 3, clean: false, secs: 190, wins: 2 }, walls: { tries: 1, clean: true, secs: 141, wins: 1 } } }, 'killhouse-four': { n: 2, s: 1, w: { quiet: { tries: 1, clean: true, secs: 80, wins: 1 } } },
      'warehouse-four': { n: 9, s: 0, w: { doors: { tries: 4, clean: false, secs: 300, wins: 1 }, dark: { tries: 2, clean: true, secs: 260, wins: 1 }, quiet: { tries: 1, clean: false, secs: 400, wins: 1 } } }, 'depot-four': { n: 4, s: 4, w: {} } };
    let tallOn = null;
    for (const [name, q] of [['cards', ''], ['cards-off', '&noverdict']]) {
      const page = await ctx.newPage();
      page.on('pageerror', x => { if (!/WebGPU|adapter/i.test(String(x))) report.errors.push(`${name}: ${String(x).slice(0, 300)}`); });
      try {
        await page.addInitScript(rec => { try { const all = {}; for (const [id, r] of Object.entries(rec)) for (const d of ['standard', 'hard', 'custom']) all[`${id}|${d}`] = r; localStorage.setItem('twopointsix.verdicts', JSON.stringify(all)); } catch { } }, won);
        await page.goto(`http://localhost:${PORT}/?paused&quality=verylow&mute${q}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
        await page.waitForSelector('#menu .actions button', { timeout: 60000 }); await page.waitForTimeout(500);
        await page.click('#menu .actions button.primary'); await page.waitForSelector('#missions.one.on', { timeout: 20000 }); await page.waitForTimeout(600);
        const read = () => page.evaluate(() => { const R = document.getElementById('missions'), rows = [...R.querySelectorAll('.mrow[data-mission]')], vis = e => !!e && e.getClientRects().length > 0;
          const of = id => { const r = R.querySelector(`.mrow[data-mission="${id}"]`), p = r?.querySelector(':scope > .vpips'); return p ? { cls: p.className, won: p.querySelectorAll('.vpip.won').length, one: p.querySelectorAll('.v1.on').length, all: p.querySelectorAll('.vall.on').length } : null; };
          const fit = rows.filter(vis).every(r => { const p = r.querySelector(':scope > .vpips'); if (!p) return true; const a = r.getBoundingClientRect(), b = p.getBoundingClientRect(); return b.left >= a.left - 0.5 && b.right <= a.right + 0.5 && b.bottom <= a.bottom + 0.5 && [...r.children].every(c => c === p || !vis(c) || c.classList.contains('mthumb') || c.getBoundingClientRect().right <= b.left + 0.5 || c.getBoundingClientRect().bottom <= b.top + 0.5); });
          return { rows: rows.length, strips: R.querySelectorAll('.mrow > .vpips').length, twice: rows.filter(r => r.querySelectorAll(':scope > .vpips').length > 1).length, train: rows.filter(r => /^train-/.test(r.getAttribute('data-mission')) && r.querySelector('.vpips')).length,
            lessons: rows.filter(r => /^train-/.test(r.getAttribute('data-mission'))).length, compound: of('compound-four'), warehouse: of('warehouse-four'), depot: of('depot-four'), fit,
            // (the menus' two rules for anything on a card: it does not change the card's height, and it takes no pointer — the card under it is the link)
            tall: Object.fromEntries(rows.filter(vis).map(r => [r.getAttribute('data-mission'), Math.round(r.getBoundingClientRect().height * 10) / 10])),
            inert: rows.filter(vis).every(r => { const p = r.querySelector(':scope > .vpips'); if (!p || !vis(p)) return true; const b = p.getBoundingClientRect(), hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return getComputedStyle(p).pointerEvents === 'none' && p.tabIndex < 0 && !(hit && p.contains(hit)); }),
            inset: (() => { const r = R.querySelector('.mgrid .mrow[data-mission="compound-four"]'), p = r?.querySelector(':scope > .vpips'); return r && p && vis(p) ? Math.round((r.getBoundingClientRect().right - p.getBoundingClientRect().right) * 10) / 10 : null; })() }; });
        const c = await read(); log(name, JSON.stringify(c));
        if (name === 'cards') {
          check(c.strips === c.rows - c.lessons && c.twice === 0 && c.train === 0 && c.lessons > 0, 'cards: every mission\'s card carries one strip of pips; the training lessons none', `${c.strips} strips on ${c.rows} rows (${c.lessons} lessons)`);
          check(c.compound && /gold/.test(c.compound.cls) && c.compound.won === 2 && c.compound.one === 1 && c.compound.all === 1 && c.warehouse?.won === 3 && c.depot && c.depot.won === 0 && /none/.test(c.depot.cls), 'cards: what is kept is what is lit — two ways and gold on the compound (one at the first try, one with nobody lost), three on the warehouse, four dim marks on a mission tried and never won', JSON.stringify({ compound: c.compound, warehouse: c.warehouse, depot: c.depot }));
          check(c.fit, 'cards: on every card drawn the strip sits inside the card and over nothing else on its line', `fit ${c.fit}`);
          tallOn = c.tall; check(c.inert, 'cards: the strip takes no pointer and no focus — a click on it lands on the card', `inert ${c.inert}, ${c.inset} px from the card\'s right edge`);
          await page.screenshot({ path: path.join(outDir, 'cards-page.png'), timeout: 60000 }).catch(e => log('no still', String(e).split('\n')[0]));
          const grid = page.locator('#missions .mgrid, #missions .mlist').first(); if (await grid.count()) await grid.screenshot({ path: path.join(outDir, 'cards-grid.png'), timeout: 60000 }).catch(() => {});
          const one = page.locator('#missions .mrow[data-mission="compound-four"]').first(); if (await one.count()) await one.screenshot({ path: path.join(outDir, 'cards-one.png'), timeout: 60000 }).catch(() => {});
          await page.keyboard.press('s'); await page.waitForTimeout(300); const c2 = await read();
          check(c2.strips === c.strips && c2.twice === 0, 'cards: walking the list leaves one strip a card', `${c2.strips} strips after a key`);
        } else {
          check(c.strips === 0, 'cards-off (?noverdict): no card carries a strip', `${c.strips} strips`);
          const ids = Object.keys(c.tall), off = ids.filter(id => tallOn && Math.abs((tallOn[id] ?? -1) - c.tall[id]) > 0.5);
          check(!!tallOn && ids.length > 0 && off.length === 0, 'cards: a card with its strip is the height it is without one', `${ids.length} cards drawn, ${off.length} differ${off.length ? ': ' + off.slice(0, 3).map(id => `${id} ${tallOn[id]} vs ${c.tall[id]}`).join(', ') : ` (${c.tall[ids[0]]} px)`}`);
        }
      } catch (e) { report.errors.push(`${name}: ${String(e && e.stack || e).slice(0, 500)}`); log(name, 'THREW', String(e).slice(0, 300)); }
      await page.close();
    }
    await b2.close();
  }
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
  const bad = report.checks.filter(c => !c.ok).length;
  console.log(bad || report.errors.length ? `verdict-look: ${bad} FAIL, ${report.errors.length} page errors` : `verdict-look: all ${report.checks.length} hold, no page errors`);
  process.exit(bad || report.errors.length ? 1 : (process.exitCode || 0));
})();
