// THE TRAINING GROUP ON THE REAL PAGE: headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's recipe — SwiftShader, no GPU). What the headless
// lesson checks cannot see: that the bundle boots a lesson level, and the words the page really puts on the objective row.
//   PORT=5231 node tools/qa/lesson-page.cjs [name …]      (a dev server on that port: PORT=5231 bun run tools/serve.ts; default names: train-move train-pairs; `list` alone = only the list)
//   · the mission list (off the boot card): a 'Training' heading and a row per Training mission, each with its own link
//   · per name, the row's own link loaded: no page error, a scenario of the row's kind up, the row reads "training 1/N ▸ <step 1's line>"
//   · the same link with &nolesson: the lesson off, the row is the mission's own
//   · THE KIT AS ISSUED: every page is loaded on a machine that KEEPS A CHANGED KIT (a card with no rifle, one smoke, no frag, planted in localStorage before the
//     page's own scripts run). The list's page must read that card (so the plant is real); a Training row's Loadout screen shows no kit card and says 'as issued';
//     a lesson's page wears the issue kit (the rifle is in the kit, the cans as issued) and leaves the kept card in the store as it was
// About a minute and a half a page load. exit 0 = all pass · 1 = a FAIL or a page error.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', ROOT = path.resolve(__dirname, '../..');
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
const names = process.argv.slice(2).length ? process.argv.slice(2) : ['train-move', 'train-pairs'];
const BASE = `http://localhost:${PORT}/`, Q = `paused&quality=${QUALITY}&mute`;
const CARD = JSON.stringify({ v: 2, members: [{ weapon: 'pistol', smoke: 1, bangs: 1, frags: 0 }] }), KIT_LS = 'twopointsix.kit';
const plant = page => page.addInitScript(([k, v]) => { try { if (localStorage.getItem(k) === null) localStorage.setItem(k, v); } catch { /* no store: the page is as issued anyway */ } }, [KIT_LS, CARD]);
let failed = false;
const check = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
function watch(page, errors) {
  page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
}
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  // ---- the list, off the boot card (the list is plain DOM: it does not wait for the renderer)
  const hrefs = {};
  { const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); const errors = []; watch(page, errors); await plant(page);
    await page.goto(`${BASE}?${Q}&cards`, { timeout: 180000 });
    await page.locator('#menu button', { hasText: 'Missions' }).waitFor({ state: 'attached', timeout: 60000 });
    const L = await page.evaluate(() => { [...document.querySelectorAll('#menu button')].find(x => x.textContent === 'Missions').click();
      const r = document.getElementById('missions'), out = { heads: [...r.querySelectorAll('.msec')].map(h => h.textContent), rows: [] };
      for (const a of r.querySelectorAll('.mrow')) { if (!/^train-/.test(a.dataset.mission || '')) continue; a.click();
        out.rows.push({ id: a.dataset.mission, title: a.querySelector('.mtitle')?.textContent ?? '', href: r.querySelector('.mgo')?.getAttribute('href') ?? null, loadout: !!document.querySelector('#loadout.on, .loadout.on') }); }
      return out; });
    const lessons = fs.readdirSync(path.join(ROOT, 'levels')).filter(f => /^train-.*\.json$/.test(f) && JSON.parse(fs.readFileSync(path.join(ROOT, 'levels', f), 'utf8')).scenarios?.lesson);
    check(L.heads.some(h => /training/i.test(h)) && L.rows.length === lessons.length && !errors.length, `the mission list has a Training heading and a row per lesson level (${lessons.length})`,
      `headings: ${L.heads.join(' · ')}\n    rows: ${L.rows.map(r => r.title).join(' | ')}${errors.length ? '\n    errors: ' + errors.join(' | ') : ''}`);
    for (const r of L.rows) hrefs[r.id] = r.href;
    // a Training row's Loadout screen on this machine with its changed kit: the card is read here (the plant is real), and the screen shows no kit to change
    const K = await page.evaluate(() => { const r = document.getElementById('missions'), a = [...r.querySelectorAll('.mrow')].find(x => x.dataset.mission === 'train-kit'); a.click(); r.querySelector('.mgo').click();
      const lo = document.getElementById('loadout'); return { kept: window.__kit.KIT.members[0].weapon, up: !!lo, card: lo?.querySelector('.lo-kit')?.children.length ?? -1, kits: !!lo?.querySelector('[data-row="squadkit"]'), note: lo?.querySelector('.lo-note')?.textContent ?? '', pool: lo?.querySelector('.lo-pool')?.textContent ?? '' }; });
    check(K.kept === 'pistol' && K.up && K.card === 0 && !K.kits && /kit as issued/.test(K.note) && !/your own kit/.test(K.note) && !K.pool, `this machine keeps a changed kit (no rifle); a Training row's Loadout screen shows no kit card and says the lesson is played as issued`,
      `kept card's weapon '${K.kept}' · loadout up ${K.up} · kit card children ${K.card} · squad kit row ${K.kits} · note "${K.note}" · pool "${K.pool}"`);
    await page.close(); }
  // ---- each lesson by its row's own link, then with the lesson off
  for (const name of names.filter(n => n !== 'list')) {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'levels', `${name}.json`), 'utf8')), steps = data.scenarios.lesson.steps;
    const id = Object.keys(hrefs).find(k => (hrefs[k] || '').includes(`${name}.json`)) ?? null, href = id ? hrefs[id] : null;
    if (!href) { check(false, `${name}: its row on the list carries a link to its level`, `links: ${JSON.stringify(hrefs)}`); continue; }
    for (const off of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 }); const errors = []; watch(page, errors); await plant(page);
      await page.goto(`${BASE}${href}&${Q}${off ? '&nolesson' : ''}`, { timeout: 180000 });
      const R = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; window.__runFrames(2);
        const g = window.__game; return { fatal: document.getElementById('fatal')?.textContent || '', row: document.getElementById('objective')?.textContent || document.querySelector('#interact .it.sec')?.textContent || '',   /* (the corner panel's objective section where the top line says nothing: ui/corner.ts) */ text: g.objectiveText(), on: window.__lesson.on, i: window.__lesson.i,
          lesson: window.__lesson.summary(), kit: { card: window.__kit.KIT.members[0].weapon, rifle: g.player.hasRifle, smoke: g.player.canisters, stun: g.player.flashbangs, frags: g.player.frags, stored: localStorage.getItem('twopointsix.kit') }, quiet: !!g.quiet?.active, clear: !!g.roomClear?.active, team: g.guards.filter(x => x.unit && x.team === 'operative').length, faults: window.__lesson.check() || [] }; });
      const want = `training 1/${steps.length} ▸ ${steps[0].line}`, up = R.quiet || R.clear;
      if (!off) check(R.kit.card === 'pistol' && R.kit.rifle === true && R.kit.smoke === 4 && R.kit.stun === 2 && R.kit.frags > 0 && R.kit.stored === CARD, `${name}: on a machine that keeps a kit with no rifle the lesson is played with the kit as issued, and the kept card is left as it was`,
        `the kept card on this page's table '${R.kit.card}' (kit.ts kitIssuedPage: the table stays the machine's, the staging wears the issue cards) · rifle in the kit ${R.kit.rifle} · ${R.kit.smoke} smoke · ${R.kit.stun} stun · ${R.kit.frags} frag · the store ${R.kit.stored === CARD ? 'unchanged' : 'CHANGED: ' + R.kit.stored}`);
      if (!off) check(!R.fatal && !errors.length && up && R.text === want && R.row.includes(steps[0].line) && !R.faults.length, `${name}: the row's link boots the lesson and the objective row is its first step`,
        `${href}\n    scenario: ${R.quiet ? 'quiet' : R.clear ? 'room clear' : 'NONE'} · teammates ${R.team} · objectiveText "${R.text}"\n    #objective "${R.row}" · ${R.lesson}${R.faults.length ? '\n    faults: ' + R.faults.join(' | ') : ''}${R.fatal ? '\n    FATAL ' + R.fatal : ''}${errors.length ? '\n    errors: ' + errors.slice(0, 3).join(' | ') : ''}`);
      else check(!R.fatal && !errors.length && up && R.on === false && !/^training /.test(R.text) && !R.row.includes(steps[0].line), `${name}: with &nolesson the row is the mission's own`,
        `objectiveText "${R.text}" · #objective "${R.row}" · ${R.lesson}${R.fatal ? ' · FATAL ' + R.fatal : ''}${errors.length ? ' · errors: ' + errors.slice(0, 3).join(' | ') : ''}`);
      // ANOTHER MISSION'S LOADOUT FROM THIS LESSON'S PAGE (kit.ts kitIssuedPage): the card with no scenario's pause on it (the start card — what the boot card
      // is while a lesson's page loads) has the Missions button, which opens the list in this page; a mission that is not a lesson must show the kept card
      // (no rifle) and its kit cards, and the lesson restarted UNDER that screen must still be staged with the issue kit, the store untouched
      if (!off) { const M = await page.evaluate(async () => { const out = { btn: null, up: false, shown: '', cards: -1, text: '', rifle: null, after: '', stored: '' };
          window.__menu.open('start'); const b = [...document.querySelectorAll('#menu button')].find(x => /^(Missions|Play)/.test(x.textContent || '')); out.btn = b?.textContent ?? null; b?.click();
          const r = document.getElementById('missions'), row = r && [...r.querySelectorAll('.mrow')].find(x => x.dataset.mission === 'night-breach');
          row?.click(); if (!document.getElementById('loadout')) r?.querySelector('.mgo')?.click();
          const lo = document.getElementById('loadout'); out.up = !!lo; out.shown = window.__kit.KIT.members[0].weapon; out.cards = lo?.querySelector('.lo-kit')?.children.length ?? -1; out.text = (lo?.querySelector('.lo-kit')?.textContent ?? '').replace(/\s+/g, ' ').slice(0, 90);
          window.__game.restartEncounter(); window.__runFrames(2); out.rifle = window.__game.player.hasRifle; out.after = window.__kit.KIT.members[0].weapon; out.stored = localStorage.getItem('twopointsix.kit'); return out; });
        check(!!M.btn && M.up && M.shown === 'pistol' && M.cards > 0 && M.rifle === true && M.after === 'pistol' && M.stored === CARD && !errors.length, `${name}: from the lesson's page the loadout of another mission shows the kept card, and the lesson restarted under that screen still has the rifle`,
          `button '${M.btn}' · loadout up ${M.up} · night breach shows '${M.shown}' with ${M.cards} kit card element(s) ("${M.text}…") · rifle after a restart under it ${M.rifle} · the table then '${M.after}' · the store ${M.stored === CARD ? 'unchanged' : 'CHANGED: ' + M.stored}${errors.length ? ' · errors: ' + errors.slice(0, 3).join(' | ') : ''}`); }
      await page.close();
    }
  }
  await browser.close();
  console.log(failed ? '=== lesson-page: FAILED ===' : '=== lesson-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
