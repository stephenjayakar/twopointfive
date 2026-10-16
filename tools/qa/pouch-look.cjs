// POUCH LOOK: the member cards and the loadout screen under the pouches rule (game/kit.ts SLOTS), as the real page draws them in headless Chromium on the
// SOFTWARE WebGPU adapter (SwiftShader — no GPU; the cards are HTML, so what a still shows of THEM is what a browser draws; nothing here says how the frame
// behind them looks on a real GPU). Stills, each with the state it was taken in printed beside it:
//   cards-issued        ?kit, all five as issued: the meter under each name (a teammate's with the squad's beside it while the table sets a squad limit; slots.json v7 sets none), each priced row's cost
//   cards-refused       Red One's stun › pressed with none of his own pouches free: the reason on the row, the dimmed arrows
//   cards-squad-refused Blue One's stun › pressed: his own pouches empty — taken (the name is from when the squad's seven were full and refused it)
//   cards-traded        Red One's frag given up, Blue One's stun canisters in their pouches (two: the first press is taken too with no squad limit)
//   cards-you-refused   › on your smoke row as issued
//   cards-quiet · cards-loud   the two sets on everybody (the table's 'quiet' and 'stun' loadouts) · cards-shield  the table's 'shield' loadout
//   cards-set-refused   Red Two quiet, Blue One two stun, Red Two back to as issued (refused while a squad limit had no room for it; taken with none)
//   cards-saved-over    a kit saved outside the rule, read back: brought inside it, the cards say what was left behind
//   cards-off           ?kit&noslots: the rule off — no meter, no costs, the Cans row
//   loadout-issued · loadout-refused · loadout-you · loadout-off(-you)   the loadout screen on the room clear with four
//   loadout-squadkit    the Squad kit row pressed: 'Stun heavy' on all five · loadout-wall / cards-wall  'One wall charge' (only in a build whose wall
//                       charge takes its count from the cards: the button is not there otherwise, and the notes say so)
//   node tools/qa/pouch-look.cjs <outDir>      env: PORT (5199) · QUALITY (verylow)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const outDir = process.argv[2] || 'pouch-look';
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
fs.mkdirSync(outDir, { recursive: true });
const BASE = `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&cards`;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const R = { errors: [], noise: 0, notes: [] };
  const open = async (q, sel, store) => {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
    page.on('console', x => { const t = x.type(), s = x.text(); if (t !== 'error' || /Failed to load resource/.test(s)) return; if (NOISE.test(s) && R.noise < 200) R.noise++; else R.errors.push(`${q}: ${s.slice(0, 300)}`); });
    page.on('pageerror', x => R.errors.push(`${q} pageerror: ` + String(x && x.stack || x).slice(0, 500)));
    if (store !== undefined) await page.addInitScript((s) => { try { if (s === null) localStorage.removeItem('twopointsix.kit'); else localStorage.setItem('twopointsix.kit', s); } catch {} }, store);
    await page.goto(BASE + q, { timeout: 240000 }); await page.waitForSelector(sel, { timeout: 240000 });   // (the software adapter boots slowly, slower still beside other work)
    await page.evaluate(async () => { await window.__ready; window.__testVisible = true; });
    return page;
  };
  const state = (page) => page.evaluate(() => ({ on: window.__kit.slots.on, cost: window.__kit.cost().map(c => `${c.used}/${c.total}`).join(' '), squad: window.__kit.squad(), legal: window.__kit.legal(), words: window.__kit.words(), pool4: window.__kit.pool(4) }));
  try {
    // ── the cards
    { const page = await open('&kit', '#kit-preview .kc', null); log('cards: ready');
      const box = async (name) => { const r = await page.evaluate(() => { const b = document.querySelector('#kit-preview .kp').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; }); await page.screenshot({ path: path.join(outDir, `${name}.png`), clip: r }); R.notes.push(`${name}: ${JSON.stringify(await state(page))}`); };
      const card = (i) => `#kit-preview .kc[data-member="${i}"]`, row = (i, f) => `${card(i)} .kc-row[data-field="${f}"]`, next = (i, f) => `${row(i, f)} .kc-step:last-of-type`, prev = (i, f) => `${row(i, f)} .kc-step:first-of-type`;
      const says = async (what, sel) => R.notes.push(`${what}: ` + JSON.stringify(await page.evaluate((s) => document.querySelector(s).textContent, sel)));
      await page.evaluate(() => window.__kit.reset()); await box('cards-issued');
      await page.click(next(1, 'bangs')); await box('cards-refused'); await says('Red One stun row says', `${row(1, 'bangs')} .kc-note`);
      await page.click(next(3, 'bangs')); await box('cards-squad-refused'); await says('Blue One stun row says', `${row(3, 'bangs')} .kc-note`);
      await page.click(prev(1, 'frags')); await page.click(next(3, 'bangs')); await box('cards-traded');
      await page.evaluate(() => window.__kit.reset());
      // your own card: one more smoke canister as issued
      await page.click(next(0, 'smoke')); await box('cards-you-refused'); await says('your smoke row says', `${row(0, 'smoke')} .kc-note`);
      // the rifle swapped away: the 40 mm row comes to none, its pouches free; a round asked for is refused
      await page.evaluate(() => window.__kit.reset()); await page.click(next(0, 'weapon')); await says('your 40 mm row, no rifle', `${row(0, 'shells')} .kc-note`); await page.click(next(0, 'shells')); await box('cards-norifle'); await says('… a round asked for', `${row(0, 'shells')} .kc-note`);
      await page.evaluate(() => window.__kit.reset());
      for (const p of ['quiet', 'loud']) { await page.evaluate((p) => window.__kit.preset(p), p); await box(`cards-${p}`); }
      R.notes.push('loadout shield: ' + JSON.stringify(await page.evaluate(() => window.__kit.loadout('shield')))); await box('cards-shield');
      { const wall = await page.evaluate(() => (window.__kit.reset(), window.__kit.loadout('wall'))); R.notes.push('loadout wall: ' + JSON.stringify(wall) + ' · wallHere ' + JSON.stringify(await page.evaluate(() => window.__kit.wallHere()))); if (wall === 'done') await box('cards-wall'); }
      // a set on one card the squad has no room for: Red Two quiet, Blue One takes the two pouches, Red Two back to As issued
      await page.evaluate(() => window.__kit.reset()); await page.click(`${card(2)} .kc-set[data-set="quiet"]`); await page.click(next(3, 'bangs')); await page.click(next(3, 'bangs')); await page.click(`${card(2)} .kc-set[data-set="issued"]`);
      await box('cards-set-refused'); await says('Red Two card says', `${card(2)} .kc-words`);
      await page.evaluate(() => window.__kit.reset()); await page.close(); }
    // ── a kit saved over the budget (as a visit with the rule off would have left it)
    { const over = JSON.stringify({ v: 2, members: [{ smoke: 6, bangs: 4, frags: 3, shells: 4, suit: 'navy' }, { bangs: 3, charges: 2, frags: 2 }, null, { bangs: 3, charges: 1 }, null] });
      const page = await open('&kit', '#kit-preview .kc', over); log('saved-over: ready');
      const r = await page.evaluate(() => { const b = document.querySelector('#kit-preview .kp').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; });
      await page.screenshot({ path: path.join(outDir, 'cards-saved-over.png'), clip: r }); R.notes.push('cards-saved-over: ' + JSON.stringify(await state(page)) + ' · store untouched: ' + JSON.stringify(await page.evaluate((o) => localStorage.getItem('twopointsix.kit') === o, over)));
      await page.close(); }
    // ── the rule off
    { const page = await open('&kit&noslots', '#kit-preview .kc', null); log('off: ready');
      await page.evaluate(() => window.__kit.reset());
      const r = await page.evaluate(() => { const b = document.querySelector('#kit-preview .kp').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; });
      await page.screenshot({ path: path.join(outDir, 'cards-off.png'), clip: r }); R.notes.push('cards-off: ' + JSON.stringify(await state(page)));
      await page.close(); }
    // ── the loadout screen (room clear with four), Red One picked
    for (const [name, q] of [['loadout', ''], ['loadout-off', '&noslots']]) {
      const page = await open(`&loadout=room-clear-four${q}`, '#loadout .lo-slot', null); log(`${name}: ready`);
      await page.evaluate(() => window.__kit.reset());
      await page.click('#loadout .lo-slot[data-slot="1"]');
      await page.waitForTimeout(150);
      if (name === 'loadout') { await page.screenshot({ path: path.join(outDir, 'loadout-issued.png') });
        await page.click('#loadout .kc .kc-row[data-field="bangs"] .kc-step:last-of-type'); await page.waitForTimeout(100); await page.screenshot({ path: path.join(outDir, 'loadout-refused.png') });
        R.notes.push('loadout: slots ' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('#loadout .lo-pouch')].map(x => x.textContent))) + ' · squad ' + JSON.stringify(await page.evaluate(() => document.querySelector('#loadout .lo-squadp')?.textContent)) + ' · pool ' + JSON.stringify(await page.evaluate(() => document.querySelector('#loadout .lo-pool')?.textContent)) + ' · fits the window: ' + JSON.stringify(await page.evaluate(() => { const b = document.querySelector('#loadout .lo-card')?.getBoundingClientRect(); return b ? { w: Math.round(b.width), h: Math.round(b.height), inW: b.right <= innerWidth && b.left >= 0, inH: b.bottom <= innerHeight && b.top >= 0, scroll: document.querySelector('#loadout .lo-card').scrollHeight > document.querySelector('#loadout .lo-card').clientHeight } : null; })));
      } else { await page.screenshot({ path: path.join(outDir, 'loadout-off.png') }); R.notes.push('loadout-off: foot ' + JSON.stringify(await page.evaluate(() => document.querySelector('#loadout .lo-foot')?.textContent))); }
      if (name === 'loadout') {   // the Squad kit row: one press puts a loadout of the table on all five
        await page.evaluate(() => window.__kit.reset()); R.notes.push('squad kit buttons: ' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('#loadout .lo-set')].map(x => x.textContent))));
        await page.click('#loadout .lo-set[data-kit="stun"]'); await page.waitForTimeout(100); await page.screenshot({ path: path.join(outDir, 'loadout-squadkit.png') });
        if (await page.$('#loadout .lo-set[data-kit="wall"]')) { await page.click('#loadout .lo-set[data-kit="wall"]'); await page.click('#loadout .lo-slot[data-slot="1"]'); await page.waitForTimeout(100); await page.screenshot({ path: path.join(outDir, 'loadout-wall.png') }); R.notes.push('loadout-wall: pool ' + JSON.stringify(await page.evaluate(() => document.querySelector('#loadout .lo-pool')?.textContent)) + ' · walls ' + JSON.stringify(await page.evaluate(() => window.__kit.walls(4)))); }
        else R.notes.push('loadout-wall: no "One wall charge" button — this build\'s wall charge takes no count from the cards');
        await page.click('#loadout .lo-set[data-kit="issued"]');
      }
      // your own card too (seven rows under the rule)
      await page.click('#loadout .lo-slot[data-slot="0"]'); await page.waitForTimeout(150); await page.screenshot({ path: path.join(outDir, `${name}-you.png`) });
      await page.close();
    }
  } catch (e) { R.errors.push('threw: ' + String(e && e.stack || e).slice(0, 800)); }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(R, null, 1));
  for (const n of R.notes) log(n);
  log(R.errors.length ? `ERRORS (${R.errors.length}):\n` + R.errors.join('\n') : `no page errors (${R.noise} known software-adapter lines)`);
  process.exit(R.errors.length ? 1 : 0);
})();
